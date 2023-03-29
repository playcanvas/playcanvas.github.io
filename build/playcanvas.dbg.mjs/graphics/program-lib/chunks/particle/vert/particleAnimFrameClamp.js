/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleAnimFrameClampVS = `
    float animFrame = min(floor(texCoordsAlphaLife.w * animTexParams.y) + animTexParams.x, animTexParams.z);
`;

export { particleAnimFrameClampVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVBbmltRnJhbWVDbGFtcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlQW5pbUZyYW1lQ2xhbXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBmbG9hdCBhbmltRnJhbWUgPSBtaW4oZmxvb3IodGV4Q29vcmRzQWxwaGFMaWZlLncgKiBhbmltVGV4UGFyYW1zLnkpICsgYW5pbVRleFBhcmFtcy54LCBhbmltVGV4UGFyYW1zLnopO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLCtCQUEwQixDQUFBO0FBQzFCO0FBQ0EsQ0FGQTs7OzsifQ==
