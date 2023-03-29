/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowEVSMnPS = `
float VSM$(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    float pixelSize = 1.0 / resolution;
    texCoords -= vec2(pixelSize);
    vec3 s00 = texture2D(tex, texCoords).xyz;
    vec3 s10 = texture2D(tex, texCoords + vec2(pixelSize, 0)).xyz;
    vec3 s01 = texture2D(tex, texCoords + vec2(0, pixelSize)).xyz;
    vec3 s11 = texture2D(tex, texCoords + vec2(pixelSize)).xyz;
    vec2 fr = fract(texCoords * resolution);
    vec3 h0 = mix(s00, s10, fr.x);
    vec3 h1 = mix(s01, s11, fr.x);
    vec3 moments = mix(h0, h1, fr.y);
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(sampler2D shadowMap, vec3 shadowParams, float exponent) {
    return VSM$(shadowMap, dShadowCoord.xy, shadowParams.x, dShadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(sampler2D shadowMap, vec4 shadowParams, float exponent) {
    return VSM$(shadowMap, dShadowCoord.xy, shadowParams.x, length(dLightDirW) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
`;

export { shadowEVSMnPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93RVZTTW4uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93RVZTTW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IFZTTSQoc2FtcGxlcjJEIHRleCwgdmVjMiB0ZXhDb29yZHMsIGZsb2F0IHJlc29sdXRpb24sIGZsb2F0IFosIGZsb2F0IHZzbUJpYXMsIGZsb2F0IGV4cG9uZW50KSB7XG4gICAgZmxvYXQgcGl4ZWxTaXplID0gMS4wIC8gcmVzb2x1dGlvbjtcbiAgICB0ZXhDb29yZHMgLT0gdmVjMihwaXhlbFNpemUpO1xuICAgIHZlYzMgczAwID0gdGV4dHVyZTJEKHRleCwgdGV4Q29vcmRzKS54eXo7XG4gICAgdmVjMyBzMTAgPSB0ZXh0dXJlMkQodGV4LCB0ZXhDb29yZHMgKyB2ZWMyKHBpeGVsU2l6ZSwgMCkpLnh5ejtcbiAgICB2ZWMzIHMwMSA9IHRleHR1cmUyRCh0ZXgsIHRleENvb3JkcyArIHZlYzIoMCwgcGl4ZWxTaXplKSkueHl6O1xuICAgIHZlYzMgczExID0gdGV4dHVyZTJEKHRleCwgdGV4Q29vcmRzICsgdmVjMihwaXhlbFNpemUpKS54eXo7XG4gICAgdmVjMiBmciA9IGZyYWN0KHRleENvb3JkcyAqIHJlc29sdXRpb24pO1xuICAgIHZlYzMgaDAgPSBtaXgoczAwLCBzMTAsIGZyLngpO1xuICAgIHZlYzMgaDEgPSBtaXgoczAxLCBzMTEsIGZyLngpO1xuICAgIHZlYzMgbW9tZW50cyA9IG1peChoMCwgaDEsIGZyLnkpO1xuICAgIHJldHVybiBjYWxjdWxhdGVFVlNNKG1vbWVudHMsIFosIHZzbUJpYXMsIGV4cG9uZW50KTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93VlNNJChzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd1BhcmFtcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICByZXR1cm4gVlNNJChzaGFkb3dNYXAsIGRTaGFkb3dDb29yZC54eSwgc2hhZG93UGFyYW1zLngsIGRTaGFkb3dDb29yZC56LCBzaGFkb3dQYXJhbXMueSwgZXhwb25lbnQpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90VlNNJChzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICByZXR1cm4gVlNNJChzaGFkb3dNYXAsIGRTaGFkb3dDb29yZC54eSwgc2hhZG93UGFyYW1zLngsIGxlbmd0aChkTGlnaHREaXJXKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLnosIHNoYWRvd1BhcmFtcy55LCBleHBvbmVudCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsb0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F0QkE7Ozs7In0=
