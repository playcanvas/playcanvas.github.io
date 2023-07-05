var ambientEnvPS = /* glsl */`
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif

void addAmbient(vec3 worldNormal) {
    vec3 dir = normalize(cubeMapRotate(worldNormal) * vec3(-1.0, 1.0, 1.0));
    vec2 uv = mapUv(toSphericalUv(dir), vec4(128.0, 256.0 + 128.0, 64.0, 32.0) / atlasSize);

    vec4 raw = texture2D(texture_envAtlas, uv);
    vec3 linear = $DECODE(raw);
    dDiffuseLight += processEnvironment(linear);
}
`;

export { ambientEnvPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1iaWVudEVudi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2FtYmllbnRFbnYuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZm5kZWYgRU5WX0FUTEFTXG4jZGVmaW5lIEVOVl9BVExBU1xudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9lbnZBdGxhcztcbiNlbmRpZlxuXG52b2lkIGFkZEFtYmllbnQodmVjMyB3b3JsZE5vcm1hbCkge1xuICAgIHZlYzMgZGlyID0gbm9ybWFsaXplKGN1YmVNYXBSb3RhdGUod29ybGROb3JtYWwpICogdmVjMygtMS4wLCAxLjAsIDEuMCkpO1xuICAgIHZlYzIgdXYgPSBtYXBVdih0b1NwaGVyaWNhbFV2KGRpciksIHZlYzQoMTI4LjAsIDI1Ni4wICsgMTI4LjAsIDY0LjAsIDMyLjApIC8gYXRsYXNTaXplKTtcblxuICAgIHZlYzQgcmF3ID0gdGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIHV2KTtcbiAgICB2ZWMzIGxpbmVhciA9ICRERUNPREUocmF3KTtcbiAgICBkRGlmZnVzZUxpZ2h0ICs9IHByb2Nlc3NFbnZpcm9ubWVudChsaW5lYXIpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxtQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
