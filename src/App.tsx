import React, {useCallback, useEffect, useRef} from 'react';
import {Canvas as TCanvas, extend, useFrame, useThree} from 'react-three-fiber';

import './App.css';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import * as THREE from "three";
import {HeatMap} from "./HeatMap";
import {AnyAction, createStore, Reducer} from "redux";
import {Provider, useDispatch, useSelector, ReactReduxContext} from "react-redux";
import {generateData} from "./random";
import {createHeightMapGeoms} from "./db";
import {PerspectiveCamera} from "three";

extend({OrbitControls});

const Camera: React.FC<any> = (props) => {
    const ref = useRef<PerspectiveCamera>(null);
    const {setDefaultCamera} = useThree();
    // Make the camera known to the system
    useEffect(() => {

        if (ref.current !== null) {
            setDefaultCamera(ref.current);
        }
    }, [setDefaultCamera]);
    // Update it every frame
    // useFrame(() => ref.current.updateMatrixWorld());
    return <perspectiveCamera ref={ref} {...props} />;
};


const CameraControls = () => {
    // Get a reference to the Three.js Camera, and the canvas html element.
    // We need these to setup the OrbitControls component.
    // https://threejs.org/docs/#examples/en/controls/OrbitControls
    const {
        camera,
        gl: {domElement},
    } = useThree();
    // Ref to the controls, so that we can update them on every frame using useFrame
    const controls = useRef();
    // @ts-ignore
    useFrame((state) => controls.current.update());
    // @ts-ignore
    return <orbitControls ref={controls} dampingFactor={0.25} enableDamping={true} args={[camera, domElement]}/>;
};


const addToDO = (inc: number): AnyAction => {
    return {
        type: 'chstate',
        inc
    }
}
const guard_to = new Date();
const start_from = new Date(guard_to.getTime() - 60 * 10 * 1000);
const {random_data, random_constraints} = generateData(start_from, guard_to)
const initialState = {
    version: 1,
    constraints: random_constraints,
    data: random_data,
    tex: new Uint8Array([]),
    mergedGeometry: new THREE.InstancedBufferGeometry(),

}
export type State = typeof initialState;
const reducer: Reducer = (state: State, action): State => {
    console.log(action);
    if (action.type === 'chstate') {
        const version = state.version + 1;
        const {random_data, random_constraints} = generateData(start_from, guard_to)
        const {mergedGeometry, tex} = createHeightMapGeoms(random_constraints, random_data, 5000, 5000)
        return {...state, version, constraints: random_constraints, data: random_data, mergedGeometry, tex}
    }
    return state;
}

const store = createStore(reducer, initialState);

const Chart: React.FC = React.memo(() => {
    const dispatch = useDispatch();
    const v = useSelector(({version}: State) => version);
    const incV = useCallback(() => {
        dispatch(addToDO(1));
    }, [dispatch])
    useEffect(()=>{
        dispatch(addToDO(1));
    },[dispatch])
    return <div className="App">
        <div className={"Controls"}>
            {v}
            <button onClick={incV}>+</button>
        </div>
        <ReactReduxContext.Consumer>
            {({store}) => (
                <TCanvas
                    // gl={{autoClear:false}}
                    // camera={{ fov: 75, position: [21, 34, 55] }}
                >
                    <Camera position={[25, 80, 80]}/>
                    <ambientLight/>
                    <pointLight position={[10, 10, 10]}/>

                    <CameraControls/>
                    <Provider store={store}>
                        <HeatMap/>
                    </Provider>
                </TCanvas>)}
        </ReactReduxContext.Consumer>
    </div>

})

function App() {
    return (
        <Provider store={store}>
            <Chart/>
        </Provider>
    );
}

export default App;
