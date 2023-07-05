export class CpuTimer {
    constructor(app: any);
    _frameIndex: number;
    _frameTimings: any[];
    _timings: any[];
    _prevTimings: any[];
    unitsName: string;
    decimalPlaces: number;
    enabled: boolean;
    begin(name: any): void;
    mark(name: any): void;
    get timings(): any[];
}
