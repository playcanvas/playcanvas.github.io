/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = `
float getFalloffLinear(float lightRadius) {
    float d = length(dLightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFsbG9mZkxpbmVhci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2ZhbGxvZmZMaW5lYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldEZhbGxvZmZMaW5lYXIoZmxvYXQgbGlnaHRSYWRpdXMpIHtcbiAgICBmbG9hdCBkID0gbGVuZ3RoKGRMaWdodERpclcpO1xuICAgIHJldHVybiBtYXgoKChsaWdodFJhZGl1cyAtIGQpIC8gbGlnaHRSYWRpdXMpLCAwLjApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
