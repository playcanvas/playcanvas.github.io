/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightSheenPS = /* glsl */`

float sheenD(vec3 normal, vec3 h, float roughness) {
    float invR = 1.0 / (roughness * roughness);
    float cos2h = max(dot(normal, h), 0.0);
    cos2h *= cos2h;
    float sin2h = max(1.0 - cos2h, 0.0078125);
    return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * PI);
}

float sheenV(vec3 normal, vec3 view, vec3 light) {
    float NoV = max(dot(normal, view), 0.000001);
    float NoL = max(dot(normal, light), 0.000001);
    return 1.0 / (4.0 * (NoL + NoV - NoL * NoV));
}

float getLightSpecularSheen(vec3 h) {
    float D = sheenD(dNormalW, h, sGlossiness);
    float V = sheenV(dNormalW, dViewDirW, -dLightDirNormW);
    return D * V;
}
`;

export { lightSheenPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTaGVlbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2xpZ2h0U2hlZW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcblxuZmxvYXQgc2hlZW5EKHZlYzMgbm9ybWFsLCB2ZWMzIGgsIGZsb2F0IHJvdWdobmVzcykge1xuICAgIGZsb2F0IGludlIgPSAxLjAgLyAocm91Z2huZXNzICogcm91Z2huZXNzKTtcbiAgICBmbG9hdCBjb3MyaCA9IG1heChkb3Qobm9ybWFsLCBoKSwgMC4wKTtcbiAgICBjb3MyaCAqPSBjb3MyaDtcbiAgICBmbG9hdCBzaW4yaCA9IG1heCgxLjAgLSBjb3MyaCwgMC4wMDc4MTI1KTtcbiAgICByZXR1cm4gKDIuMCArIGludlIpICogcG93KHNpbjJoLCBpbnZSICogMC41KSAvICgyLjAgKiBQSSk7XG59XG5cbmZsb2F0IHNoZWVuVih2ZWMzIG5vcm1hbCwgdmVjMyB2aWV3LCB2ZWMzIGxpZ2h0KSB7XG4gICAgZmxvYXQgTm9WID0gbWF4KGRvdChub3JtYWwsIHZpZXcpLCAwLjAwMDAwMSk7XG4gICAgZmxvYXQgTm9MID0gbWF4KGRvdChub3JtYWwsIGxpZ2h0KSwgMC4wMDAwMDEpO1xuICAgIHJldHVybiAxLjAgLyAoNC4wICogKE5vTCArIE5vViAtIE5vTCAqIE5vVikpO1xufVxuXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyU2hlZW4odmVjMyBoKSB7XG4gICAgZmxvYXQgRCA9IHNoZWVuRChkTm9ybWFsVywgaCwgc0dsb3NzaW5lc3MpO1xuICAgIGZsb2F0IFYgPSBzaGVlblYoZE5vcm1hbFcsIGRWaWV3RGlyVywgLWRMaWdodERpck5vcm1XKTtcbiAgICByZXR1cm4gRCAqIFY7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
