/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var spotPS = `
float getSpotEffect(vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle) {
    float cosAngle = dot(dLightDirNormW, lightSpotDirW);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;

export { spotPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9zcG90LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBnZXRTcG90RWZmZWN0KHZlYzMgbGlnaHRTcG90RGlyVywgZmxvYXQgbGlnaHRJbm5lckNvbmVBbmdsZSwgZmxvYXQgbGlnaHRPdXRlckNvbmVBbmdsZSkge1xuICAgIGZsb2F0IGNvc0FuZ2xlID0gZG90KGRMaWdodERpck5vcm1XLCBsaWdodFNwb3REaXJXKTtcbiAgICByZXR1cm4gc21vb3Roc3RlcChsaWdodE91dGVyQ29uZUFuZ2xlLCBsaWdodElubmVyQ29uZUFuZ2xlLCBjb3NBbmdsZSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsYUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBTEE7Ozs7In0=
