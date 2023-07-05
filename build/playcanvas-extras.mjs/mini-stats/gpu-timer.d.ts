export class GpuTimer {
    constructor(app: any);
    _gl: any;
    _ext: any;
    _freeQueries: any[];
    _frameQueries: any[];
    _frames: any[];
    _timings: any[];
    _prevTimings: any[];
    enabled: boolean;
    unitsName: string;
    decimalPlaces: number;
    loseContext(): void;
    begin(name: any): void;
    mark(name: any): void;
    end(): void;
    _checkDisjoint(): void;
    _allocateQuery(): any;
    _resolveFrameTimings(frame: any, timings: any): boolean;
    get timings(): any[];
}
