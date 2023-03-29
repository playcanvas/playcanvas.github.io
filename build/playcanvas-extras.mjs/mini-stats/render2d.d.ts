export class Render2d {
    constructor(device: any, colors: any, maxQuads?: number);
    device: any;
    shader: any;
    buffer: any;
    data: Float32Array;
    indexBuffer: any;
    prims: any[];
    prim: any;
    primIndex: number;
    quads: number;
    watermarkSizeId: any;
    clrId: any;
    clr: Float32Array;
    screenTextureSizeId: any;
    screenTextureSize: Float32Array;
    blendState: any;
    quad(texture: any, x: any, y: any, w: any, h: any, u: any, v: any, uw: any, uh: any, enabled: any): void;
    render(clr: any, height: any): void;
}
