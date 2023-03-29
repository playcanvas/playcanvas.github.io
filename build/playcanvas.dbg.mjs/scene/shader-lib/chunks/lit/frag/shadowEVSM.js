/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowEVSMPS = /* glsl */`
float VSM$(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    vec3 moments = texture2D(tex, texCoords).xyz;
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(sampler2D shadowMap, vec3 shadowCoord, vec3 shadowParams, float exponent, vec3 lightDir) {
    return VSM$(shadowMap, shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    return VSM$(shadowMap, shadowCoord.xy, shadowParams.x, length(lightDir) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
`;

export { shadowEVSMPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93RVZTTS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3NoYWRvd0VWU00uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IFZTTSQoc2FtcGxlcjJEIHRleCwgdmVjMiB0ZXhDb29yZHMsIGZsb2F0IHJlc29sdXRpb24sIGZsb2F0IFosIGZsb2F0IHZzbUJpYXMsIGZsb2F0IGV4cG9uZW50KSB7XG4gICAgdmVjMyBtb21lbnRzID0gdGV4dHVyZTJEKHRleCwgdGV4Q29vcmRzKS54eXo7XG4gICAgcmV0dXJuIGNhbGN1bGF0ZUVWU00obW9tZW50cywgWiwgdnNtQmlhcywgZXhwb25lbnQpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dWU00kKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93Q29vcmQsIHZlYzMgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCwgdmVjMyBsaWdodERpcikge1xuICAgIHJldHVybiBWU00kKHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHksIHNoYWRvd1BhcmFtcy54LCBzaGFkb3dDb29yZC56LCBzaGFkb3dQYXJhbXMueSwgZXhwb25lbnQpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90VlNNJChzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcywgZmxvYXQgZXhwb25lbnQsIHZlYzMgbGlnaHREaXIpIHtcbiAgICByZXR1cm4gVlNNJChzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgbGVuZ3RoKGxpZ2h0RGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLnosIHNoYWRvd1BhcmFtcy55LCBleHBvbmVudCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
