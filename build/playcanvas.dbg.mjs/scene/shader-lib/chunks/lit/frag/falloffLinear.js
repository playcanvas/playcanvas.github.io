/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = /* glsl */`
float getFalloffLinear(float lightRadius, vec3 lightDir) {
    float d = length(lightDir);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFsbG9mZkxpbmVhci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2ZhbGxvZmZMaW5lYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldEZhbGxvZmZMaW5lYXIoZmxvYXQgbGlnaHRSYWRpdXMsIHZlYzMgbGlnaHREaXIpIHtcbiAgICBmbG9hdCBkID0gbGVuZ3RoKGxpZ2h0RGlyKTtcbiAgICByZXR1cm4gbWF4KCgobGlnaHRSYWRpdXMgLSBkKSAvIGxpZ2h0UmFkaXVzKSwgMC4wKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
