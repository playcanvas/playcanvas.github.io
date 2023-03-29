/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowEVSMPS = `
float VSM$(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    vec3 moments = texture2D(tex, texCoords).xyz;
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(sampler2D shadowMap, vec3 shadowParams, float exponent) {
    return VSM$(shadowMap, dShadowCoord.xy, shadowParams.x, dShadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(sampler2D shadowMap, vec4 shadowParams, float exponent) {
    return VSM$(shadowMap, dShadowCoord.xy, shadowParams.x, length(dLightDirW) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
`;

export { shadowEVSMPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93RVZTTS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dFVlNNLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBWU00kKHNhbXBsZXIyRCB0ZXgsIHZlYzIgdGV4Q29vcmRzLCBmbG9hdCByZXNvbHV0aW9uLCBmbG9hdCBaLCBmbG9hdCB2c21CaWFzLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHZlYzMgbW9tZW50cyA9IHRleHR1cmUyRCh0ZXgsIHRleENvb3JkcykueHl6O1xuICAgIHJldHVybiBjYWxjdWxhdGVFVlNNKG1vbWVudHMsIFosIHZzbUJpYXMsIGV4cG9uZW50KTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93VlNNJChzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd1BhcmFtcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICByZXR1cm4gVlNNJChzaGFkb3dNYXAsIGRTaGFkb3dDb29yZC54eSwgc2hhZG93UGFyYW1zLngsIGRTaGFkb3dDb29yZC56LCBzaGFkb3dQYXJhbXMueSwgZXhwb25lbnQpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90VlNNJChzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICByZXR1cm4gVlNNJChzaGFkb3dNYXAsIGRTaGFkb3dDb29yZC54eSwgc2hhZG93UGFyYW1zLngsIGxlbmd0aChkTGlnaHREaXJXKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLnosIHNoYWRvd1BhcmFtcy55LCBleHBvbmVudCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FiQTs7OzsifQ==
