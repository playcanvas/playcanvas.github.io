/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93RVZTTW4uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dFVlNNbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgVlNNJChzYW1wbGVyMkQgdGV4LCB2ZWMyIHRleENvb3JkcywgZmxvYXQgcmVzb2x1dGlvbiwgZmxvYXQgWiwgZmxvYXQgdnNtQmlhcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICBmbG9hdCBwaXhlbFNpemUgPSAxLjAgLyByZXNvbHV0aW9uO1xuICAgIHRleENvb3JkcyAtPSB2ZWMyKHBpeGVsU2l6ZSk7XG4gICAgdmVjMyBzMDAgPSB0ZXh0dXJlMkQodGV4LCB0ZXhDb29yZHMpLnh5ejtcbiAgICB2ZWMzIHMxMCA9IHRleHR1cmUyRCh0ZXgsIHRleENvb3JkcyArIHZlYzIocGl4ZWxTaXplLCAwKSkueHl6O1xuICAgIHZlYzMgczAxID0gdGV4dHVyZTJEKHRleCwgdGV4Q29vcmRzICsgdmVjMigwLCBwaXhlbFNpemUpKS54eXo7XG4gICAgdmVjMyBzMTEgPSB0ZXh0dXJlMkQodGV4LCB0ZXhDb29yZHMgKyB2ZWMyKHBpeGVsU2l6ZSkpLnh5ejtcbiAgICB2ZWMyIGZyID0gZnJhY3QodGV4Q29vcmRzICogcmVzb2x1dGlvbik7XG4gICAgdmVjMyBoMCA9IG1peChzMDAsIHMxMCwgZnIueCk7XG4gICAgdmVjMyBoMSA9IG1peChzMDEsIHMxMSwgZnIueCk7XG4gICAgdmVjMyBtb21lbnRzID0gbWl4KGgwLCBoMSwgZnIueSk7XG4gICAgcmV0dXJuIGNhbGN1bGF0ZUVWU00obW9tZW50cywgWiwgdnNtQmlhcywgZXhwb25lbnQpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dWU00kKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHJldHVybiBWU00kKHNoYWRvd01hcCwgZFNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgZFNoYWRvd0Nvb3JkLnosIHNoYWRvd1BhcmFtcy55LCBleHBvbmVudCk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RWU00kKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHJldHVybiBWU00kKHNoYWRvd01hcCwgZFNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgbGVuZ3RoKGRMaWdodERpclcpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMueiwgc2hhZG93UGFyYW1zLnksIGV4cG9uZW50KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxvQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9