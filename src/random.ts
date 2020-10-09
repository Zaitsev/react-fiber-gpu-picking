import * as r from 'd3-random'

export type HeatMapContstraints = {
    routers_count: number,
    severity_min: number,
    severity_max: number,
    start_ts: number,
    end_ts: number,
}
export type HeatMapData = [
    string, //router name
    number, //router id
        number | null, //anomaly history id
        number | null, //severity_max
        number | null, //duration
        number | null, //start_ts
]



const NUM_R = 5; const DUR_ON_PROB = 0.5;
// const NUM_R = 80; const DUR_ON_PROB = 0.5;
// const NUM_R = 5000; const DUR_ON_PROB = 0.0005;
// @ts-ignore
const dur_anomaly: () => number = r.randomInt(1, 120);
// @ts-ignore
const dur_no_anomaly: () => number = r.randomInt(0, 3*60);
// @ts-ignore
const s = r.randomNormal(100,5000)
const severity: () => number = ()=> {
    return Math.round(s())+1;
};

export let random_data: HeatMapData[] = [];
export let random_constraints: HeatMapContstraints          = {
    routers_count: NUM_R,
        severity_max : -1,
        end_ts       : -1,
        start_ts     : -1,
        severity_min : -1,
} ;

const dur_on_fn = () => {
    // @ts-ignore
    const is_anomaly: () => number = r.randomBernoulli(DUR_ON_PROB)

    return () => {
        return is_anomaly() ? [1, dur_anomaly(), severity()] : [0, dur_no_anomaly(), severity()]
    }
};

export function generateData(start_from:Date,guard_to:Date,joinType='left outer') {
    let ah_id = 100000;
    random_data = []; //renew pointers
    random_constraints = {...random_constraints}; //renew pointers
    random_constraints.start_ts = Math.round(start_from.getTime() / 1000)
    random_constraints.end_ts = Math.round(guard_to.getTime() / 1000)
    random_constraints.severity_max = -1
    const get_anomaly = dur_on_fn();
    for (let rid=1;rid < NUM_R+1; rid++){
        let next_ts = random_constraints.start_ts;
        let ra = 0;
        // console.log(`${rid} enter tl`,next_ts-random_constraints.start_ts,next_ts < random_constraints.end_ts)
        while (next_ts <= random_constraints.end_ts) {
            const [is_a, duration, severity] = get_anomaly();
            if (is_a) {
                ra++;
                random_constraints.severity_max = Math.max(random_constraints.severity_max,severity)
                ah_id++;
                random_data.push([`r-${rid}`, rid, ah_id, severity, duration, next_ts]);
            }
            next_ts += duration;
        }
        if (ra===0 && joinType==='left outer'){
            random_data.push([`r-${rid}`, rid, null, null, null, null]);
            // random_constraints.severity_max = Math.max(random_constraints.severity_max,100)
            // random_data.push([`r-${rid}`, rid, ah_id++, 100, 1, random_constraints.start_ts+1]);
        }
        // console.log(`${rid} generated ${ra} in ${i} iterations JT="${joinType}"`)
    }
    // console.log(random_data);
    console.log(random_constraints);
    return {random_data,random_constraints}
}

