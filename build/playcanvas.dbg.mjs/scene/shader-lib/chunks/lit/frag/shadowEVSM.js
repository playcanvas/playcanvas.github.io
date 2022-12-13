/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93RVZTTS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3NoYWRvd0VWU00uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IFZTTSQoc2FtcGxlcjJEIHRleCwgdmVjMiB0ZXhDb29yZHMsIGZsb2F0IHJlc29sdXRpb24sIGZsb2F0IFosIGZsb2F0IHZzbUJpYXMsIGZsb2F0IGV4cG9uZW50KSB7XG4gICAgdmVjMyBtb21lbnRzID0gdGV4dHVyZTJEKHRleCwgdGV4Q29vcmRzKS54eXo7XG4gICAgcmV0dXJuIGNhbGN1bGF0ZUVWU00obW9tZW50cywgWiwgdnNtQmlhcywgZXhwb25lbnQpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dWU00kKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHJldHVybiBWU00kKHNoYWRvd01hcCwgZFNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgZFNoYWRvd0Nvb3JkLnosIHNoYWRvd1BhcmFtcy55LCBleHBvbmVudCk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RWU00kKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHJldHVybiBWU00kKHNoYWRvd01hcCwgZFNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgbGVuZ3RoKGRMaWdodERpclcpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMueiwgc2hhZG93UGFyYW1zLnksIGV4cG9uZW50KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxtQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
