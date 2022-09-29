/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleVS = `
vec3 unpack3NFloats(float src) {
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 tex1Dlod_lerp(highp sampler2D tex, vec2 tc) {
    return mix( texture2D(tex,tc), texture2D(tex,tc + graphSampleSize), fract(tc.x*graphNumSamples) );
}

vec4 tex1Dlod_lerp(highp sampler2D tex, vec2 tc, out vec3 w) {
    vec4 a = texture2D(tex,tc);
    vec4 b = texture2D(tex,tc + graphSampleSize);
    float c = fract(tc.x*graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a, b, c);
}

vec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix) {
    float c = cos(pRotation);
    float s = sin(pRotation);

    mat2 m = mat2(c, -s, s, c);
    rotMatrix = m;

    return m * quadXY;
}

vec3 billboard(vec3 InstanceCoords, vec2 quadXY) {
    #ifdef SCREEN_SPACE
        vec3 pos = vec3(-1, 0, 0) * quadXY.x + vec3(0, -1, 0) * quadXY.y;
    #else
        vec3 pos = -matrix_viewInverse[0].xyz * quadXY.x + -matrix_viewInverse[1].xyz * quadXY.y;
    #endif

    return pos;
}

vec3 customFace(vec3 InstanceCoords, vec2 quadXY) {
    vec3 pos = faceTangent * quadXY.x + faceBinorm * quadXY.y;
    return pos;
}

vec2 safeNormalize(vec2 v) {
    float l = length(v);
    return (l > 1e-06) ? v / l : v;
}

void main(void) {
    vec3 meshLocalPos = particle_vertexData.xyz;
    float id = floor(particle_vertexData.w);

    float rndFactor = fract(sin(id + 1.0 + seed));
    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));

    float uv = id / numParticlesPot;
    readInput(uv);

#ifdef LOCAL_SPACE
    inVel = mat3(matrix_model) * inVel;
#endif
    vec2 velocityV = safeNormalize((mat3(matrix_view) * inVel).xy); // should be removed by compiler if align/stretch is not used

    float particleLifetime = lifetime;

    if (inLife <= 0.0 || inLife > particleLifetime || !inShow) meshLocalPos = vec3(0.0);
    vec2 quadXY = meshLocalPos.xy;
    float nlife = clamp(inLife / particleLifetime, 0.0, 1.0);

    vec3 paramDiv;
    vec4 params = tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);
    float scale = params.y;
    float scaleDiv = paramDiv.x;
    float alphaDiv = paramDiv.z;

    scale += (scaleDiv * 2.0 - 1.0) * scaleDivMult * fract(rndFactor*10000.0);

#ifndef USE_MESH
    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5, (alphaDiv * 2.0 - 1.0) * alphaDivMult * fract(rndFactor*1000.0), nlife);
#else
    texCoordsAlphaLife = vec4(particle_uv, (alphaDiv * 2.0 - 1.0) * alphaDivMult * fract(rndFactor*1000.0), nlife);
#endif

    vec3 particlePos = inPos;
    vec3 particlePosMoved = vec3(0.0);

    mat2 rotMatrix;
`;

export { particleVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyB1bnBhY2szTkZsb2F0cyhmbG9hdCBzcmMpIHtcbiAgICBmbG9hdCByID0gZnJhY3Qoc3JjKTtcbiAgICBmbG9hdCBnID0gZnJhY3Qoc3JjICogMjU2LjApO1xuICAgIGZsb2F0IGIgPSBmcmFjdChzcmMgKiA2NTUzNi4wKTtcbiAgICByZXR1cm4gdmVjMyhyLCBnLCBiKTtcbn1cblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbnZlYzQgdGV4MURsb2RfbGVycChoaWdocCBzYW1wbGVyMkQgdGV4LCB2ZWMyIHRjKSB7XG4gICAgcmV0dXJuIG1peCggdGV4dHVyZTJEKHRleCx0YyksIHRleHR1cmUyRCh0ZXgsdGMgKyBncmFwaFNhbXBsZVNpemUpLCBmcmFjdCh0Yy54KmdyYXBoTnVtU2FtcGxlcykgKTtcbn1cblxudmVjNCB0ZXgxRGxvZF9sZXJwKGhpZ2hwIHNhbXBsZXIyRCB0ZXgsIHZlYzIgdGMsIG91dCB2ZWMzIHcpIHtcbiAgICB2ZWM0IGEgPSB0ZXh0dXJlMkQodGV4LHRjKTtcbiAgICB2ZWM0IGIgPSB0ZXh0dXJlMkQodGV4LHRjICsgZ3JhcGhTYW1wbGVTaXplKTtcbiAgICBmbG9hdCBjID0gZnJhY3QodGMueCpncmFwaE51bVNhbXBsZXMpO1xuXG4gICAgdmVjMyB1bnBhY2tlZEEgPSB1bnBhY2szTkZsb2F0cyhhLncpO1xuICAgIHZlYzMgdW5wYWNrZWRCID0gdW5wYWNrM05GbG9hdHMoYi53KTtcbiAgICB3ID0gbWl4KHVucGFja2VkQSwgdW5wYWNrZWRCLCBjKTtcblxuICAgIHJldHVybiBtaXgoYSwgYiwgYyk7XG59XG5cbnZlYzIgcm90YXRlKHZlYzIgcXVhZFhZLCBmbG9hdCBwUm90YXRpb24sIG91dCBtYXQyIHJvdE1hdHJpeCkge1xuICAgIGZsb2F0IGMgPSBjb3MocFJvdGF0aW9uKTtcbiAgICBmbG9hdCBzID0gc2luKHBSb3RhdGlvbik7XG5cbiAgICBtYXQyIG0gPSBtYXQyKGMsIC1zLCBzLCBjKTtcbiAgICByb3RNYXRyaXggPSBtO1xuXG4gICAgcmV0dXJuIG0gKiBxdWFkWFk7XG59XG5cbnZlYzMgYmlsbGJvYXJkKHZlYzMgSW5zdGFuY2VDb29yZHMsIHZlYzIgcXVhZFhZKSB7XG4gICAgI2lmZGVmIFNDUkVFTl9TUEFDRVxuICAgICAgICB2ZWMzIHBvcyA9IHZlYzMoLTEsIDAsIDApICogcXVhZFhZLnggKyB2ZWMzKDAsIC0xLCAwKSAqIHF1YWRYWS55O1xuICAgICNlbHNlXG4gICAgICAgIHZlYzMgcG9zID0gLW1hdHJpeF92aWV3SW52ZXJzZVswXS54eXogKiBxdWFkWFkueCArIC1tYXRyaXhfdmlld0ludmVyc2VbMV0ueHl6ICogcXVhZFhZLnk7XG4gICAgI2VuZGlmXG5cbiAgICByZXR1cm4gcG9zO1xufVxuXG52ZWMzIGN1c3RvbUZhY2UodmVjMyBJbnN0YW5jZUNvb3JkcywgdmVjMiBxdWFkWFkpIHtcbiAgICB2ZWMzIHBvcyA9IGZhY2VUYW5nZW50ICogcXVhZFhZLnggKyBmYWNlQmlub3JtICogcXVhZFhZLnk7XG4gICAgcmV0dXJuIHBvcztcbn1cblxudmVjMiBzYWZlTm9ybWFsaXplKHZlYzIgdikge1xuICAgIGZsb2F0IGwgPSBsZW5ndGgodik7XG4gICAgcmV0dXJuIChsID4gMWUtMDYpID8gdiAvIGwgOiB2O1xufVxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIHZlYzMgbWVzaExvY2FsUG9zID0gcGFydGljbGVfdmVydGV4RGF0YS54eXo7XG4gICAgZmxvYXQgaWQgPSBmbG9vcihwYXJ0aWNsZV92ZXJ0ZXhEYXRhLncpO1xuXG4gICAgZmxvYXQgcm5kRmFjdG9yID0gZnJhY3Qoc2luKGlkICsgMS4wICsgc2VlZCkpO1xuICAgIHZlYzMgcm5kRmFjdG9yMyA9IHZlYzMocm5kRmFjdG9yLCBmcmFjdChybmRGYWN0b3IqMTAuMCksIGZyYWN0KHJuZEZhY3RvcioxMDAuMCkpO1xuXG4gICAgZmxvYXQgdXYgPSBpZCAvIG51bVBhcnRpY2xlc1BvdDtcbiAgICByZWFkSW5wdXQodXYpO1xuXG4jaWZkZWYgTE9DQUxfU1BBQ0VcbiAgICBpblZlbCA9IG1hdDMobWF0cml4X21vZGVsKSAqIGluVmVsO1xuI2VuZGlmXG4gICAgdmVjMiB2ZWxvY2l0eVYgPSBzYWZlTm9ybWFsaXplKChtYXQzKG1hdHJpeF92aWV3KSAqIGluVmVsKS54eSk7IC8vIHNob3VsZCBiZSByZW1vdmVkIGJ5IGNvbXBpbGVyIGlmIGFsaWduL3N0cmV0Y2ggaXMgbm90IHVzZWRcblxuICAgIGZsb2F0IHBhcnRpY2xlTGlmZXRpbWUgPSBsaWZldGltZTtcblxuICAgIGlmIChpbkxpZmUgPD0gMC4wIHx8IGluTGlmZSA+IHBhcnRpY2xlTGlmZXRpbWUgfHwgIWluU2hvdykgbWVzaExvY2FsUG9zID0gdmVjMygwLjApO1xuICAgIHZlYzIgcXVhZFhZID0gbWVzaExvY2FsUG9zLnh5O1xuICAgIGZsb2F0IG5saWZlID0gY2xhbXAoaW5MaWZlIC8gcGFydGljbGVMaWZldGltZSwgMC4wLCAxLjApO1xuXG4gICAgdmVjMyBwYXJhbURpdjtcbiAgICB2ZWM0IHBhcmFtcyA9IHRleDFEbG9kX2xlcnAoaW50ZXJuYWxUZXgyLCB2ZWMyKG5saWZlLCAwKSwgcGFyYW1EaXYpO1xuICAgIGZsb2F0IHNjYWxlID0gcGFyYW1zLnk7XG4gICAgZmxvYXQgc2NhbGVEaXYgPSBwYXJhbURpdi54O1xuICAgIGZsb2F0IGFscGhhRGl2ID0gcGFyYW1EaXYuejtcblxuICAgIHNjYWxlICs9IChzY2FsZURpdiAqIDIuMCAtIDEuMCkgKiBzY2FsZURpdk11bHQgKiBmcmFjdChybmRGYWN0b3IqMTAwMDAuMCk7XG5cbiNpZm5kZWYgVVNFX01FU0hcbiAgICB0ZXhDb29yZHNBbHBoYUxpZmUgPSB2ZWM0KHF1YWRYWSAqIC0wLjUgKyAwLjUsIChhbHBoYURpdiAqIDIuMCAtIDEuMCkgKiBhbHBoYURpdk11bHQgKiBmcmFjdChybmRGYWN0b3IqMTAwMC4wKSwgbmxpZmUpO1xuI2Vsc2VcbiAgICB0ZXhDb29yZHNBbHBoYUxpZmUgPSB2ZWM0KHBhcnRpY2xlX3V2LCAoYWxwaGFEaXYgKiAyLjAgLSAxLjApICogYWxwaGFEaXZNdWx0ICogZnJhY3Qocm5kRmFjdG9yKjEwMDAuMCksIG5saWZlKTtcbiNlbmRpZlxuXG4gICAgdmVjMyBwYXJ0aWNsZVBvcyA9IGluUG9zO1xuICAgIHZlYzMgcGFydGljbGVQb3NNb3ZlZCA9IHZlYzMoMC4wKTtcblxuICAgIG1hdDIgcm90TWF0cml4O1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGlCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBakdBOzs7OyJ9
