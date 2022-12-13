/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleAnimFrameLoopVS = `
    float animFrame = floor(mod(texCoordsAlphaLife.w * animTexParams.y + animTexParams.x, animTexParams.z + 1.0));
`;

export { particleAnimFrameLoopVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVBbmltRnJhbWVMb29wLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZUFuaW1GcmFtZUxvb3AuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBmbG9hdCBhbmltRnJhbWUgPSBmbG9vcihtb2QodGV4Q29vcmRzQWxwaGFMaWZlLncgKiBhbmltVGV4UGFyYW1zLnkgKyBhbmltVGV4UGFyYW1zLngsIGFuaW1UZXhQYXJhbXMueiArIDEuMCkpO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDhCQUEwQixDQUFBO0FBQzFCO0FBQ0EsQ0FBQzs7OzsifQ==
