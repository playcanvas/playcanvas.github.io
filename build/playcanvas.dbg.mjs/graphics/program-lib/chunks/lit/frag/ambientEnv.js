/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var ambientEnvPS = `
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif

void addAmbient() {
    vec3 dir = normalize(cubeMapRotate(dNormalW) * vec3(-1.0, 1.0, 1.0));
    vec2 uv = mapUv(toSphericalUv(dir), vec4(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize);

    vec4 raw = texture2D(texture_envAtlas, uv);
    vec3 linear = $DECODE(raw);
    dDiffuseLight += processEnvironment(linear);
}
`;

export { ambientEnvPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1iaWVudEVudi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9hbWJpZW50RW52LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZuZGVmIEVOVl9BVExBU1xuI2RlZmluZSBFTlZfQVRMQVNcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZW52QXRsYXM7XG4jZW5kaWZcblxudm9pZCBhZGRBbWJpZW50KCkge1xuICAgIHZlYzMgZGlyID0gbm9ybWFsaXplKGN1YmVNYXBSb3RhdGUoZE5vcm1hbFcpICogdmVjMygtMS4wLCAxLjAsIDEuMCkpO1xuICAgIHZlYzIgdXYgPSBtYXBVdih0b1NwaGVyaWNhbFV2KGRpciksIHZlYzQoMTI4LjAsIDI1Ni4wICsgMTI4LjAsIDY0LjAsIDMyLjApIC8gYXRsYXNTaXplKTtcblxuICAgIHZlYzQgcmF3ID0gdGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIHV2KTtcbiAgICB2ZWMzIGxpbmVhciA9ICRERUNPREUocmF3KTtcbiAgICBkRGlmZnVzZUxpZ2h0ICs9IHByb2Nlc3NFbnZpcm9ubWVudChsaW5lYXIpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1CQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FkQTs7OzsifQ==
