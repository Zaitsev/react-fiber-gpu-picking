import {HeatMapContstraints, HeatMapData} from "./random";
import  {scaleLinear,scaleLog} from "d3-scale"
import * as THREE from "three";
const MAX_AXIS_RESOULTION = 16000;
const MAX_ROUTER_RESOULTION = 6000;
const MAX_TIME_RESOULTION = 16000;

 enum HeatMapDataColumn {
    router_name,
    router_id,
    history_id,
    severity_max,
    duration,
    start_ts,

}

function getInvalidGeometry(error: string) {
    const r = new THREE.BoxBufferGeometry(1, 1, 1);
    const sc = scaleLinear().domain([0, 1]).range([0, 1]);
    r.userData['axisXmax'] = 1;
    r.userData['error'] = error;
    r.userData['axisYmax'] = 1;
    r.userData['severityMax'] = 1;
    r.userData['scaleAxisX'] = sc;
    r.userData['scaleHeight'] = sc;
    r.userData['scaleAxisY'] = sc;
    r.userData['router_ord_map'] = [];
    return {tex: new Uint8Array([0, 0]), mergedGeometry: r as unknown as THREE.InstancedBufferGeometry};
}

function createHeightMapArray(constraints: HeatMapContstraints, data: HeatMapData[], axisRouterResolution: number, axisTimeResolution: number, heightScale = 'linear') {
    if (constraints.routers_count <= 0 || !data.length) {

        return {rids: [], axisXmax: 0, axisYmax: 0, tex: new Uint8Array([])};
    }
    performance.mark('compute:start');

    // console.table(data);

    const {routers_count, start_ts, end_ts, severity_max} = constraints;

    const axisYmax = Math.min(+routers_count, axisRouterResolution >= MAX_ROUTER_RESOULTION ? MAX_AXIS_RESOULTION : axisRouterResolution);
    const axisXmax = Math.min(end_ts - start_ts, axisTimeResolution >= MAX_TIME_RESOULTION ? MAX_AXIS_RESOULTION : axisTimeResolution);

    if (axisYmax * axisXmax > MAX_AXIS_RESOULTION * MAX_AXIS_RESOULTION) {
        //too high resolution
        return {rids: [], rids_map:[],axisXmax: -axisXmax, axisYmax: -axisYmax, tex: new Uint8Array([])};
    }

    const tex = new Uint8Array(axisYmax * axisXmax);
    const rowsCount = data.length;

    let y = 0;
    const rids: number[] = [];
    const rids_map: number[] = [];
    tex.fill(0);

    /** D3 scale     */
        // const scaleV      = ((hs: HeightScaleType) => {
        //     switch (hs) {
        //         case 'log10':
        //             return (v: number) => v === 0 ? 0 : Math.log10(v);
        //         case 'log2':
        //             return (v: number) => v === 0 ? 0 : Math.log2(v);
        //         default:
        //             return (v: number) => v;
        //     }
        // })(heightScale);
        // const scaleHeight = scaleLinear().domain([0, scaleV(severity_max)]).range([0, 255]);
        //

    console.log(`createHeightMapArray w=${axisXmax} H=${axisYmax}`);


    let _l = 0;
    let coord = 0;
    /** D3
     for (let i = 0; i < rowsCount; i++) {
        const [, rid, , v_max, duration, ts] = data[i];
        y                                          = rids.indexOf(rid);
        if (y < 0) {
            rids.push(rid);
            y = rids.length - 1;
        }
        if (v_max === null || duration === null || ts === null){
            continue;
        }
        _y = Math.round(scaleY(y));
        h8 = Math.floor(scaleHeight(v_max));
        for (let l = 0; (l < duration); l++) {
            _l = Math.round(scaleX(ts + l));
            if (_l >= axisXmax) {
                break;
            }
            coord = _l + (_y) * axisXmax;

            tex[coord] = Math.max(tex[coord], h8);
            // tex[coord] = 200;
        }
    }
     */

    /** Three */
    for (let i = 0; i < rowsCount; i++) {
        // const [, rid, , v_max, duration, ts] = data[i];
        // const r = data[i];
        y = rids.indexOf(data[i][HeatMapDataColumn.router_id]);
        if (y < 0) {
            rids.push(data[i][HeatMapDataColumn.router_id]);
            rids_map.push(-1);
            y = rids.length - 1;
        }

        const _y = Math.round(THREE.MathUtils.mapLinear(y, 0, routers_count, 0, axisYmax));
        rids_map[y] = _y;
        if (data[i][HeatMapDataColumn.severity_max] === null) {
            continue;

        }
        const h8 = Math.floor(THREE.MathUtils.mapLinear(data[i][HeatMapDataColumn.severity_max]!, 0, severity_max, 0, 255));

        for (let l = 0; (l < data[i][HeatMapDataColumn.duration]!); l++) {
            _l = Math.round(THREE.MathUtils.mapLinear(data[i][HeatMapDataColumn.start_ts]! + l, start_ts, end_ts, 0, axisXmax));
            if (_l >= axisXmax) {
                break;
            }
            coord = _l + (_y) * axisXmax;

            tex[coord] = Math.max(tex[coord], h8);
            // tex[coord] = 200;
        }

    }


    performance.mark('compute:end');
    performance.measure('compute tex', 'compute:start', 'compute:end');
    /**
     for (let i = 0; i < axisYmax; i++) {
        //router ticks
        tex[0 + i * axisXmax] = i * 20 + 10;
    }
     for (let i = 0; i < axisXmax; i++) {
        //time ticks
        tex[i] = i * 20 + 10;
    }
     */

    // console.table(performance.getEntriesByType('measure'));

    // Finally, clean up the entries.
    performance.clearMarks();
    performance.clearMeasures();
    // console.log(axisXmax, axisYmax, severity_max);
    // console.log([...tex]);
    return {rids, rids_map, axisXmax, axisYmax, tex};
}

export function createHeightMapGeoms(constraints: HeatMapContstraints, data: HeatMapData[], axisRoutersResolution: number, axisTimeResolution: number, heightScale='linear'):{tex:Uint8Array,mergedGeometry:THREE.InstancedBufferGeometry} {
    if (constraints.routers_count <= 0 || !data.length) {
        console.log('nothing to compute');
        return getInvalidGeometry('No data found');
    }
    const {rids, rids_map,axisXmax, axisYmax, tex} = createHeightMapArray(constraints, data, axisRoutersResolution, axisTimeResolution, heightScale);
    if (axisXmax < 0 && axisYmax < 0) {
        return getInvalidGeometry(`Router_resolution x Time_resolution exceeds limit  ${MAX_AXIS_RESOULTION * MAX_AXIS_RESOULTION}`);
    }
    if (axisXmax === 0 && axisYmax === 0) {
        return getInvalidGeometry(`No anomalies found ${axisXmax} ${axisYmax}`);
    }
    const {routers_count, start_ts, end_ts, severity_max} = constraints;
    const is_native = axisXmax >= (end_ts - start_ts) && axisYmax >= routers_count;
    console.log('geom', axisXmax, axisYmax, +routers_count, heightScale);

    performance.mark('compute:start');
    /** D3 scale     */
    /** prevent height of any anomaly to be less than 1 */
    let scaleHeight;
    switch (heightScale) {
        case 'log2':
            scaleHeight = scaleLog().base(2).domain([0.01, severity_max]);
            break;
        case 'log10':
            scaleHeight = scaleLog().base(10).domain([0.01, severity_max]);
            break;
        default:
            scaleHeight = scaleLinear().domain([0, severity_max]);
    }
    scaleHeight = scaleHeight.range([1, 100]).clamp(true);
    const scaleX = scaleLinear().domain([start_ts, end_ts]).range([0, axisXmax]).clamp(true);
    const scaleY = scaleLinear().domain([0, routers_count - 1]).range([0, axisYmax]).clamp(true);
    // console.log(`Geom w=${axisXmax} H=${axisYmax} ts ${start_ts} - ${end_ts}`);

    // console.table(data);

    // console.log(`ds=${dur_scale}, xm=${axisXmax} y = ${axisYmax}`);
    // console.log(`bw=${boxWidth}, bh=${boxWidth} y = ${axisYmax}`);
    // const baseGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    // make it so it scales away from the positive Z axis
    // const translation = new THREE.Matrix4().makeTranslation(boxWidth/2, boxHeight/2 , 0.55);
    const _baseGeometry = new THREE.Geometry();
    _baseGeometry.vertices.push(
        new THREE.Vector3(-0.5, -0.5, 0.5),  // 0
        new THREE.Vector3(0.5, -0.5, 0.5),  // 1
        new THREE.Vector3(-0.5, 0.5, 0.5),  // 2
        new THREE.Vector3(0.5, 0.5, 0.5),  // 3
        new THREE.Vector3(-0.5, -0.5, -0.5),  // 4
        new THREE.Vector3(0.5, -0.5, -0.5),  // 5
        new THREE.Vector3(-0.5, 0.5, -0.5),  // 6
        new THREE.Vector3(0.5, 0.5, -0.5),  // 7
    );

    // baseGeometry.vertices.push(
    //     new THREE.Vector3(-2, -2, 2),  // 0
    //     new THREE.Vector3(2, -2, 2),  // 2
    //     new THREE.Vector3(-2, 2, 2),  // 2
    //     new THREE.Vector3(2, 2, 2),  // 3
    //     new THREE.Vector3(-2, -2, -2),  // 4
    //     new THREE.Vector3(2, -2, -2),  // 5
    //     new THREE.Vector3(-2, 2, -2),  // 6
    //     new THREE.Vector3(2, 2, -2),  // 7
    // );

    /*
         6----7
        /|   /|
       2----3 |
       | |  | |
       | 4--|-5
       |/   |/
       0----1
    */

    _baseGeometry.faces.push(
        // front
        new THREE.Face3(0, 3, 2),
        new THREE.Face3(0, 1, 3),
        // right
        new THREE.Face3(1, 7, 3),
        new THREE.Face3(1, 5, 7),
        // // back
        new THREE.Face3(5, 6, 7),
        new THREE.Face3(5, 4, 6),
        // left
        new THREE.Face3(4, 2, 6),
        new THREE.Face3(4, 0, 2),
        // top
        new THREE.Face3(2, 7, 6),
        new THREE.Face3(2, 3, 7),
        // bottom
        new THREE.Face3(4, 1, 0),
        new THREE.Face3(4, 5, 1),
    );
    const base_vertices = new Float32Array([
        -0.5, -0.5, 0.5,  // 0
        0.5, -0.5, 0.5,  // 1
        -0.5, 0.5, 0.5,  // 2
        0.5, 0.5, 0.5,  // 3
        -0.5, -0.5, -0.5,  // 4
        0.5, -0.5, -0.5,  // 5
        -0.5, 0.5, -0.5,  // 6
        0.5, 0.5, -0.5,  // 7

    ]);

    const base_indices = new Uint32Array([
        0, 3, 2,
        0, 1, 3,
        // right
        1, 7, 3,
        1, 5, 7,
        // // back
        5, 6, 7,
        5, 4, 6,
        // left
        4, 2, 6,
        4, 0, 2,
        // top
        2, 7, 6,
        2, 3, 7,
        // bottom
        4, 1, 0,
        4, 5, 1,

    ]); // 6 * 2 * 3 = 36 Int32
    // const indexStride = base_indices.length;
    // const vertexStride = base_vertices.length;
    const baseGeometry = new THREE.InstancedBufferGeometry();
    const bb = new THREE.BoxGeometry();
    baseGeometry.fromGeometry(bb);
    baseGeometry.setAttribute('position', new THREE.BufferAttribute(base_vertices, 3, false))
    baseGeometry.setIndex(new THREE.BufferAttribute(base_indices, 1, false))
    let m4 = new THREE.Matrix4().makeTranslation(0.5, 0.5, 0.5);
    baseGeometry.applyMatrix4(m4);
    // m4 = new THREE.Matrix4().makeScale(30, 1, 10);
    // baseGeometry.applyMatrix4(m4);
    // m4 = new THREE.Matrix4().makeTranslation(50, 1, 0);
    // baseGeometry.applyMatrix4(m4);
    console.log(baseGeometry);
    /** Fist pass
     *
     */
    performance.mark("Pass-1:start");
    let generated = 0;
    for (let y = 0; y < axisYmax; y++) {
        let  start = false, stop = false;
        for (let x = 0; x < axisXmax; x++) {

            const h8 = tex[x + y * axisXmax];
            if (!start && h8 > 0) {
                // console.log(`start on x=${x} y=${y} h8=${h8}`);
                start = true;
            }
            if (start && (x + 1 >= axisXmax || tex[(x + 1) + y * axisXmax] !== h8)) {

                //last point || next height differ
                stop = true; //stop on last
            }
            if (start && stop) {
                start = stop = false;
                generated++;
            }
        }
    }
    // console.log(`stop   x=${x} y=${y} h8=${h8} x0=${x0} x1=${x1}`);
    performance.mark("Pass-1:end");
    performance.measure("Pass-1", "Pass-1:start", "Pass-1:end");

    /** use TypedArya.set cause it has better performance
     * https://jsbench.me/i9kfkzwpvq/1
     */
    const offset = new Int16Array( generated*2);
    const scale = new Float32Array( generated*2);
    const color = new Uint32Array( generated);
    let cOffset = 0;
    let cScale = 0;
    let cColor = 0;
    for (let y = 0; y < Math.min(axisYmax); y++) {
        let x1 = 0, x0 = 0, start = false, stop = false;

        for (let x = 0; x < axisXmax; x++) {
            const h8 = tex[x + y * axisXmax];
            if (!start && h8 > 0) {
                start = true;
                x0 = x; //this
                x1 = x + 1; //this+ width
            }

            if (start && (x + 1 >= axisXmax || tex[(x + 1) + y * axisXmax] !== h8)) {
                stop = true; //stop on last
                x1 = x + 1;//this+width
            }

            if (start && stop) {

                const _h8 = 100 * h8 / 255;
                offset[cOffset] = x0;
                offset[cOffset+1] = y;
                scale[cScale] = x1-x0;
                scale[cScale+1] = _h8;
                color[cColor] = cColor+1;
                start = stop = false;
                cOffset += 2;
                cScale += 2;
                cColor++;
            }

        }

    }
    performance.mark('compute:end');
    performance.measure('compute geom', 'compute:start', 'compute:end');

    performance.mark('merge:start');
    console.log('generated geoms', generated);
    if (generated === 0) {
        return getInvalidGeometry(`No anomalies for ${constraints.routers_count} routers in current period`);
    }
    const mergedGeometry = baseGeometry.clone();
    mergedGeometry.setAttribute('offset',new THREE.InstancedBufferAttribute(offset,2,false))
    mergedGeometry.setAttribute('scale',new THREE.InstancedBufferAttribute(scale,2,false))
    mergedGeometry.setAttribute('color',new THREE.InstancedBufferAttribute(color,1,false))
    // mergedGeometry.setIndex(new THREE.BufferAttribute(indexes, 1, false))
    // console.log(indexes)
    // const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
    // mergedGeometry.translate(-axisXmax / 2, -axisYmax / 2, 0);
    mergedGeometry.userData['axisXmax'] = axisXmax;
    mergedGeometry.userData['axisYmax'] = axisYmax;
    mergedGeometry.userData['severityMax'] = severity_max;
    mergedGeometry.userData['scaleAxisX'] = scaleX;
    mergedGeometry.userData['scaleHeight'] = scaleHeight;
    mergedGeometry.userData['scaleAxisY'] = scaleY;
    mergedGeometry.userData['rids'] = rids;
    mergedGeometry.userData['rids_map'] = rids_map;
    mergedGeometry.userData['is_native'] = is_native;
    performance.mark('merge:end');
    performance.measure('merge tex', 'merge:start', 'merge:end');
    console.table(performance.getEntriesByType('measure'));

    // Finally, clean up the entries.
    performance.clearMarks();
    performance.clearMeasures();
    return {tex, mergedGeometry};
}
