export class StatsTimer {
    constructor(app: any, statNames: any, decimalPlaces: any, unitsName: any, multiplier: any);
    app: any;
    values: any[];
    statNames: any;
    unitsName: any;
    decimalPlaces: any;
    multiplier: any;
    get timings(): any[];
}
