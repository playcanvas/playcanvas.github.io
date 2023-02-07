/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowVSM8PS = /* glsl */`
float calculateVSM8(vec3 moments, float Z, float vsmBias) {
    float VSMBias = vsmBias;//0.01 * 0.25;
    float depthScale = VSMBias * Z;
    float minVariance1 = depthScale * depthScale;
    return chebyshevUpperBound(moments.xy, Z, minVariance1, 0.1);
}

float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

float VSM8(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    vec4 c = texture2D(tex, texCoords);
    vec3 moments = vec3(decodeFloatRG(c.xy), decodeFloatRG(c.zw), 0.0);
    return calculateVSM8(moments, Z, vsmBias);
}

float getShadowVSM8(sampler2D shadowMap, vec3 shadowParams, float exponent) {
    return VSM8(shadowMap, dShadowCoord.xy, shadowParams.x, dShadowCoord.z, shadowParams.y, 0.0);
}

float getShadowSpotVSM8(sampler2D shadowMap, vec4 shadowParams, float exponent) {
    return VSM8(shadowMap, dShadowCoord.xy, shadowParams.x, length(dLightDirW) * shadowParams.w + shadowParams.z, shadowParams.y, 0.0);
}
`;

export { shadowVSM8PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93VlNNOC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3NoYWRvd1ZTTTguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGNhbGN1bGF0ZVZTTTgodmVjMyBtb21lbnRzLCBmbG9hdCBaLCBmbG9hdCB2c21CaWFzKSB7XG4gICAgZmxvYXQgVlNNQmlhcyA9IHZzbUJpYXM7Ly8wLjAxICogMC4yNTtcbiAgICBmbG9hdCBkZXB0aFNjYWxlID0gVlNNQmlhcyAqIFo7XG4gICAgZmxvYXQgbWluVmFyaWFuY2UxID0gZGVwdGhTY2FsZSAqIGRlcHRoU2NhbGU7XG4gICAgcmV0dXJuIGNoZWJ5c2hldlVwcGVyQm91bmQobW9tZW50cy54eSwgWiwgbWluVmFyaWFuY2UxLCAwLjEpO1xufVxuXG5mbG9hdCBkZWNvZGVGbG9hdFJHKHZlYzIgcmcpIHtcbiAgICByZXR1cm4gcmcueSooMS4wLzI1NS4wKSArIHJnLng7XG59XG5cbmZsb2F0IFZTTTgoc2FtcGxlcjJEIHRleCwgdmVjMiB0ZXhDb29yZHMsIGZsb2F0IHJlc29sdXRpb24sIGZsb2F0IFosIGZsb2F0IHZzbUJpYXMsIGZsb2F0IGV4cG9uZW50KSB7XG4gICAgdmVjNCBjID0gdGV4dHVyZTJEKHRleCwgdGV4Q29vcmRzKTtcbiAgICB2ZWMzIG1vbWVudHMgPSB2ZWMzKGRlY29kZUZsb2F0UkcoYy54eSksIGRlY29kZUZsb2F0UkcoYy56dyksIDAuMCk7XG4gICAgcmV0dXJuIGNhbGN1bGF0ZVZTTTgobW9tZW50cywgWiwgdnNtQmlhcyk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1ZTTTgoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMsIGZsb2F0IGV4cG9uZW50KSB7XG4gICAgcmV0dXJuIFZTTTgoc2hhZG93TWFwLCBkU2hhZG93Q29vcmQueHksIHNoYWRvd1BhcmFtcy54LCBkU2hhZG93Q29vcmQueiwgc2hhZG93UGFyYW1zLnksIDAuMCk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RWU004KHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHJldHVybiBWU004KHNoYWRvd01hcCwgZFNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgbGVuZ3RoKGRMaWdodERpclcpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMueiwgc2hhZG93UGFyYW1zLnksIDAuMCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
