import React, {useCallback, useEffect, useRef} from "react";
import {useSelector} from "react-redux";
import {State} from "./App";
import * as THREE from "three";
import {useFrame, useThree} from "react-three-fiber";
// language=GLSL
const heatVertex = `
    #define _FF 0x000000FFu
    uniform float hotThreshold;
    uniform int highlightBoxID;
    attribute vec2 offset;
    attribute vec2 scale;
    attribute uint color;
    varying vec2 vUv;
    varying float hValue;
    out vec4 vColor;
    vec4 unpac4x8(uint v){
        return vec4(
        float(v & _FF)/255.0,
        float(v >> 8 & _FF)/255.0,
        float(v >> 16 & _FF)/255.0,
        float(v >> 24 & _FF)/255.0
        );
    }
    void main() {
        vUv = uv;
        vec4 pos = vec4(position, 1.0);
        hValue = pos.z*hotThreshold;
        //        hValue = pos.z*hotThreshold;
        pos *= vec4(scale.x, 1.0, scale.y, 1.00);
        pos += vec4(offset, 0, 0);
        //        hValue = smoothstep(0.0,hotThreshold,pos.z);
        //        hValue = 0.99;
        gl_Position = projectionMatrix * modelViewMatrix   * pos;
        vColor = unpac4x8(color);
        if(gl_InstanceID==highlightBoxID){
          hValue=-1.0;  
        }
    }
`;
// language=GLSL
const heatFragment = `
    varying float hValue;
    in vec4 vColor;

    float square(float s) { return s * s; }
    vec3 square(vec3 s) { return s * s; }
    // honestly stolen from https://www.shadertoy.com/view/4dsSzr
    vec3 heatmapGradient(float t) {
        return clamp((pow(t, 1.5) * 0.8 + 0.2) * vec3(smoothstep(0.0, 0.35, t) + t * 0.5, smoothstep(0.5, 1.0, t), max(1.0 - t * 1.7, t * 7.0 - 6.0)), 0.0, 1.0);
    }
    vec3 neonGradient(float t) {
        return clamp(vec3(t * 1.3 + 0.1, square(abs(0.43 - t) * 1.7), (1.0 - t) * 1.7), 0.0, 1.0);
    }

    void main() {
        if (hValue < 0.0){
            gl_FragColor = vec4(1.0,1.0,1.0,1.0);
        }else{

            float v = abs(hValue - 1.);
            gl_FragColor = vec4(neonGradient(hValue), 0.8);
        }
    }
`;
// language=GLSL
const pickingFragment = `
    varying float hValue;
    in vec4 vColor;

    float square(float s) { return s * s; }
    vec3 square(vec3 s) { return s * s; }
    // honestly stolen from https://www.shadertoy.com/view/4dsSzr
    vec3 heatmapGradient(float t) {
        return clamp((pow(t, 1.5) * 0.8 + 0.2) * vec3(smoothstep(0.0, 0.35, t) + t * 0.5, smoothstep(0.5, 1.0, t), max(1.0 - t * 1.7, t * 7.0 - 6.0)), 0.0, 1.0);
    }
    vec3 neonGradient(float t) {
        return clamp(vec3(t * 1.3 + 0.1, square(abs(0.43 - t) * 1.7), (1.0 - t) * 1.7), 0.0, 1.0);
    }

    void main() {
        float v = abs(hValue - 1.);
        //        gl_FragColor = vec4(neonGradient(hValue), 0.9);
        //        gl_FragColor = vec4(1.0, 0, 0, 0.9);
        gl_FragColor = vec4(vColor.rgb, 1.0);
    }
`;

const HEIGHT = 50;
const WIDTH = 50;

const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        hotThreshold: {value: 1},
        highlightBoxID:{value:-1}
    },
    vertexShader: heatVertex,
    fragmentShader: heatFragment,
    transparent: true,

});
const pickingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        hotThreshold: {value: 1},
    },
    vertexShader: heatVertex,
    fragmentShader: pickingFragment,
    transparent: false,
});

const pickingMesh = new THREE.Mesh(
    new THREE.InstancedBufferGeometry(),
    pickingMaterial
)
const pickingGroup = new THREE.Group();

pickingGroup.add(pickingMesh);

const highlightBox = new THREE.Mesh(
    new THREE.BoxBufferGeometry(),
    new THREE.MeshPhongMaterial( { color: 0xffffff }
    ) );
let m4 = new THREE.Matrix4().makeTranslation(0.5, 0.5, 0.5);
highlightBox.geometry.applyMatrix4(m4);
highlightBox.renderOrder = 100;

highlightBox.material.transparent=false;
// highlightBox.material.wireframe=false;
// highlightBox.material.depthTest=false;
highlightBox.material.depthFunc=THREE.LessDepth;
highlightBox.material.side=THREE.DoubleSide;


highlightBox.material.transparent=false;

const bg_texture = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
bg_texture.generateMipmaps = false;


class PickGPU {
    pickingTexture = new THREE.WebGLRenderTarget(5, 5);
    pixelBuffer = new Uint8Array(4);
    pickedObjectSavedColor = 0;
    pickedObject = Array(4);

    constructor(
        private renderer: THREE.WebGLRenderer,
        private camera: THREE.PerspectiveCamera,
        private scene: THREE.Scene
    ) {
        console.log('consturcted')
    }

    pick(renderer: THREE.WebGLRenderer, cssPosition: { x: number, y: number }): number {
        // console.log('pick')
        const {camera, scene, pickingTexture, pixelBuffer} = this;
        if (this.pickedObject) {
            // this.pickedObject.material.emissive.setHex(this.pickedObjectSavedColor);
            // this.pickedObject = null;
        }
        if (cssPosition.x < -100 && cssPosition.y < 1000) {
            return -1;
        }
        // set the view offset to represent just a single pixel under the mouse
        const pixelRatio = renderer.getPixelRatio();
        camera.setViewOffset(
            renderer.getContext().drawingBufferWidth,   // full width
            renderer.getContext().drawingBufferHeight,  // full top
            cssPosition.x * pixelRatio | 0,             // rect x
            cssPosition.y * pixelRatio | 0,             // rect y
            1,                                          // rect width
            1,                                          // rect height
        );
        //render the scene
        renderer.setRenderTarget(pickingTexture)
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        // clear the view offset so rendering returns to normal
        camera.clearViewOffset();

        //read the pixel
        renderer.readRenderTargetPixels(
            pickingTexture,
            0,   // x
            0,   // y
            1,   // width
            1,   // height
            pixelBuffer);
        const id =
            (pixelBuffer[2] << 16) |
            (pixelBuffer[1] << 8) |
            (pixelBuffer[0]);
        return id - 1;
        //     console.log(id, pixelBuffer);
        //
        //     this.pickedObject = [...pixelBuffer];
        // }
        //overlay color for debug
        // renderer.render(scene, camera);


    }
}

export const HeatMap: React.FC = React.memo(() => {
    const version = useSelector(({version}: State) => version);
    const tex = useSelector(({tex}: State) => tex);
    const mergedGeometry = useSelector(({mergedGeometry}: State) => mergedGeometry);
    const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, typeof shaderMaterial>>(null);
    const hoverRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
    const texMatRef = useRef<THREE.MeshLambertMaterial>(null);
    const meshGroupRef = useRef<THREE.Group>(null);
    const {axisXmax, axisYmax} = mergedGeometry!.userData;
    const pickPosition = useRef({x: -100000, y: -10000})
    const picker = useRef<PickGPU>(null)
    const pickedObject = useRef(-1)
    const {gl: renderer, gl: {domElement}, camera, scene} = useThree()

    // useFrame(({gl}) => {
    //     gl.autoClear = false;
    //     gl.render(scene, camera);
    const highlightObject = useCallback(function highlightObject() {
        const id = pickedObject.current;
        meshRef.current!.material.uniforms.highlightBoxID.value=id;

        if (id < 0) {
            return;
        }
        // const offset = (mergedGeometry.attributes['offset'].array as number[]).slice(id * 2, id * 2 + 2)
        // const scale = (mergedGeometry.attributes['scale'].array as number[]).slice(id * 2, id * 2 + 2)
        // const mg = highlightBox;
        // const alittlebit=0.02;
        // mg.position.x=offset[0]-alittlebit*0.5*scale[0];
        // mg.position.y=offset[1]-0.5*alittlebit;
        //
        // mg.scale.x= scale[0]*(1+alittlebit);
        // mg.scale.z= scale[1]*(1+alittlebit);
        // mg.scale.y=  1+alittlebit;

    }, [mergedGeometry])
    // }, 100);
    useFrame(({gl}) => {
        const pick = picker.current;
        if (pick === null) {
            return;
        }
        gl.autoClear = true;
        // gl.clearDepth();
        const id = pick.pick(gl, pickPosition.current);
        if (pickedObject.current !== id) {
            pickedObject.current = id;
            highlightObject();
        }
        // gl.clearDepth();
        gl.render(scene, camera);

    }, 10)
    useEffect(function mount() {
        function getCanvasRelativePosition(event: MouseEvent) {
            const rect = domElement.getBoundingClientRect();
            return {
                x: (event.clientX - rect.left) * domElement.width / rect.width,
                y: (event.clientY - rect.top) * domElement.height / rect.height,
            };
        }

        function setPickPosition(event: MouseEvent) {
            const pos = getCanvasRelativePosition(event);
            pickPosition.current.x = pos.x;
            pickPosition.current.y = pos.y;
            // console.log(pickPosition.current)
        }

        function clearPickPosition() {
            // unlike the mouse which always has a position
            // if the user stops touching the screen we want
            // to stop picking. For now we just pick a value
            // unlikely to pick something
            pickPosition.current.x = -100000;
            pickPosition.current.y = -100000;
        }

        window.addEventListener('mousemove', setPickPosition);
        window.addEventListener('mouseout', clearPickPosition);
        window.addEventListener('mouseleave', clearPickPosition);

    }, [domElement])
    useEffect(function initPicker() {
        const pickingscene = new THREE.Scene();
        // picingscene.translateX(-10);
        const g = new THREE.Group();
        g.rotateX(-Math.PI * 0.5);
        // g.translateX(50)
        g.add(pickingGroup);

        pickingscene.add(g);
        // @ts-ignore
        picker.current = new PickGPU(renderer, camera, pickingscene);
    }, [camera, renderer]);

    useEffect(() => {
        if (!texMatRef.current) {
            return;
        }
        if (axisXmax < 0 || axisYmax < 0) {
            return
        }

        // return;
        performance.mark('DataTexture:start');
        texMatRef.current.map = new THREE.DataTexture(tex, axisXmax, axisYmax, THREE.RedFormat, THREE.UnsignedByteType);
        performance.mark('DataTexture:end');
        performance.measure('DataTexture tex', 'DataTexture:start', 'DataTexture:end');
        console.table(performance.getEntriesByType('measure'));
        // Finally, clean up the entries.
        performance.clearMarks();
        performance.clearMeasures();

    }, [axisXmax, axisYmax, tex]);
    useEffect(function setNetGeometry() {
        if (meshRef.current === null) {
            return;
        }
        meshRef.current.geometry = mergedGeometry;
        pickingMesh.geometry = mergedGeometry;
        meshRef.current.frustumCulled = false;
        pickingMesh.frustumCulled = false;
        console.log(meshRef.current)

    }, [mergedGeometry]);
    useEffect(() => {
        if (meshGroupRef.current === null) {
            return;
        }
        const scaleX = WIDTH / axisXmax;
        const scaleY = HEIGHT / axisYmax;
        const scaleZ = 10 / 100;
        const mg = meshGroupRef.current;
        //position and scale group
        mg.position.x = -(scaleX * axisXmax) / 2;
        mg.position.y = -(scaleY * axisYmax) / 2;

        mg.scale.x = scaleX;
        mg.scale.y = scaleY;
        mg.scale.z = scaleZ;

        pickingGroup.position.x = -(scaleX * axisXmax) / 2;
        pickingGroup.position.y = -(scaleY * axisYmax) / 2;

        pickingGroup.scale.x = scaleX;
        pickingGroup.scale.y = scaleY;
        pickingGroup.scale.z = scaleZ;


    }, [axisYmax, axisXmax]);

    console.log('render mesh' + version);

    // @ts-ignore
    return <group>
        <axesHelper visible={true} args={[28]}/>
        <gridHelper args={[Math.max(WIDTH, HEIGHT), 10, 0x404040, 0x404040]}/>
        <group rotation={[-Math.PI * 0.5, 0, 0]}>
            <mesh
            >
                <planeBufferGeometry attach="geometry" args={[50, 50]}/>
                <meshLambertMaterial attach="material" map={bg_texture} ref={texMatRef} side={THREE.DoubleSide}>
                    {/*<dataTexture attach="map" args={[tex, axisXmax, axisYmax, THREE.RedFormat, THREE.UnsignedByteType]}*/}
                    {/*             flipY={false}*/}
                    {/*             generateMipmaps={false}*/}
                    {/*></dataTexture>*/}
                </meshLambertMaterial>
            </mesh>

            <group ref={meshGroupRef}
            >
                <mesh name={'meshRef'} ref={meshRef} material={shaderMaterial} renderOrder={1}>
                    <instancedBufferGeometry attach="geometry"/>
                </mesh>
                <primitive object={highlightBox} ref={hoverRef} />
                {/*<mesh name={"hovrMesh"} ref={hoverRef} renderOrder={10} >*/}
                {/*     @ts-ignore */}
                    {/*<boxGeometry name="hoverGeometry" />*/}
                    {/*<meshLambertMaterial transparent={false} color={0xFF0000} depthTest={true}/>*/}
                {/*</mesh>*/}
            </group>
        </group>

    </group>

})