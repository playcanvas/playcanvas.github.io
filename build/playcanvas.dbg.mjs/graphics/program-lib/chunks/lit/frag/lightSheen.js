/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightSheenPS = `

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTaGVlbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9saWdodFNoZWVuLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbmZsb2F0IHNoZWVuRCh2ZWMzIG5vcm1hbCwgdmVjMyBoLCBmbG9hdCByb3VnaG5lc3MpIHtcbiAgICBmbG9hdCBpbnZSID0gMS4wIC8gKHJvdWdobmVzcyAqIHJvdWdobmVzcyk7XG4gICAgZmxvYXQgY29zMmggPSBtYXgoZG90KG5vcm1hbCwgaCksIDAuMCk7XG4gICAgY29zMmggKj0gY29zMmg7XG4gICAgZmxvYXQgc2luMmggPSBtYXgoMS4wIC0gY29zMmgsIDAuMDA3ODEyNSk7XG4gICAgcmV0dXJuICgyLjAgKyBpbnZSKSAqIHBvdyhzaW4yaCwgaW52UiAqIDAuNSkgLyAoMi4wICogUEkpO1xufVxuXG5mbG9hdCBzaGVlblYodmVjMyBub3JtYWwsIHZlYzMgdmlldywgdmVjMyBsaWdodCkge1xuICAgIGZsb2F0IE5vViA9IG1heChkb3Qobm9ybWFsLCB2aWV3KSwgMC4wMDAwMDEpO1xuICAgIGZsb2F0IE5vTCA9IG1heChkb3Qobm9ybWFsLCBsaWdodCksIDAuMDAwMDAxKTtcbiAgICByZXR1cm4gMS4wIC8gKDQuMCAqIChOb0wgKyBOb1YgLSBOb0wgKiBOb1YpKTtcbn1cblxuZmxvYXQgZ2V0TGlnaHRTcGVjdWxhclNoZWVuKHZlYzMgaCkge1xuICAgIGZsb2F0IEQgPSBzaGVlbkQoZE5vcm1hbFcsIGgsIHNHbG9zc2luZXNzKTtcbiAgICBmbG9hdCBWID0gc2hlZW5WKGROb3JtYWxXLCBkVmlld0RpclcsIC1kTGlnaHREaXJOb3JtVyk7XG4gICAgcmV0dXJuIEQgKiBWO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1CQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXJCQTs7OzsifQ==
