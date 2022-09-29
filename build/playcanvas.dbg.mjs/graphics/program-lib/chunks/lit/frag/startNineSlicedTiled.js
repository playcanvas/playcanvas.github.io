/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var startNineSlicedTiledPS = `
    vec2 tileMask = step(vMask, vec2(0.99999));
    vec2 tileSize = 0.5 * (innerOffset.xy + innerOffset.zw);
    vec2 tileScale = vec2(1.0) / (vec2(1.0) - tileSize);
    vec2 clampedUv = mix(innerOffset.xy * 0.5, vec2(1.0) - innerOffset.zw * 0.5, fract((vTiledUv - tileSize) * tileScale));
    clampedUv = clampedUv * atlasRect.zw + atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2(1.0) - tileMask);
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;
    
`;

export { startNineSlicedTiledPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhcnROaW5lU2xpY2VkVGlsZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc3RhcnROaW5lU2xpY2VkVGlsZWQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWMyIHRpbGVNYXNrID0gc3RlcCh2TWFzaywgdmVjMigwLjk5OTk5KSk7XG4gICAgdmVjMiB0aWxlU2l6ZSA9IDAuNSAqIChpbm5lck9mZnNldC54eSArIGlubmVyT2Zmc2V0Lnp3KTtcbiAgICB2ZWMyIHRpbGVTY2FsZSA9IHZlYzIoMS4wKSAvICh2ZWMyKDEuMCkgLSB0aWxlU2l6ZSk7XG4gICAgdmVjMiBjbGFtcGVkVXYgPSBtaXgoaW5uZXJPZmZzZXQueHkgKiAwLjUsIHZlYzIoMS4wKSAtIGlubmVyT2Zmc2V0Lnp3ICogMC41LCBmcmFjdCgodlRpbGVkVXYgLSB0aWxlU2l6ZSkgKiB0aWxlU2NhbGUpKTtcbiAgICBjbGFtcGVkVXYgPSBjbGFtcGVkVXYgKiBhdGxhc1JlY3QuencgKyBhdGxhc1JlY3QueHk7XG4gICAgbmluZVNsaWNlZFV2ID0gdlV2MCAqIHRpbGVNYXNrICsgY2xhbXBlZFV2ICogKHZlYzIoMS4wKSAtIHRpbGVNYXNrKTtcbiAgICBuaW5lU2xpY2VkVXYueSA9IDEuMCAtIG5pbmVTbGljZWRVdi55O1xuICAgIFxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDZCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVRBOzs7OyJ9
