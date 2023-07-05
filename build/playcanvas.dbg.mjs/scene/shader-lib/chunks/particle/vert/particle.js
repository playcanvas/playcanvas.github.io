var particleVS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIHVucGFjazNORmxvYXRzKGZsb2F0IHNyYykge1xuICAgIGZsb2F0IHIgPSBmcmFjdChzcmMpO1xuICAgIGZsb2F0IGcgPSBmcmFjdChzcmMgKiAyNTYuMCk7XG4gICAgZmxvYXQgYiA9IGZyYWN0KHNyYyAqIDY1NTM2LjApO1xuICAgIHJldHVybiB2ZWMzKHIsIGcsIGIpO1xufVxuXG5mbG9hdCBzYXR1cmF0ZShmbG9hdCB4KSB7XG4gICAgcmV0dXJuIGNsYW1wKHgsIDAuMCwgMS4wKTtcbn1cblxudmVjNCB0ZXgxRGxvZF9sZXJwKGhpZ2hwIHNhbXBsZXIyRCB0ZXgsIHZlYzIgdGMpIHtcbiAgICByZXR1cm4gbWl4KCB0ZXh0dXJlMkQodGV4LHRjKSwgdGV4dHVyZTJEKHRleCx0YyArIGdyYXBoU2FtcGxlU2l6ZSksIGZyYWN0KHRjLngqZ3JhcGhOdW1TYW1wbGVzKSApO1xufVxuXG52ZWM0IHRleDFEbG9kX2xlcnAoaGlnaHAgc2FtcGxlcjJEIHRleCwgdmVjMiB0Yywgb3V0IHZlYzMgdykge1xuICAgIHZlYzQgYSA9IHRleHR1cmUyRCh0ZXgsdGMpO1xuICAgIHZlYzQgYiA9IHRleHR1cmUyRCh0ZXgsdGMgKyBncmFwaFNhbXBsZVNpemUpO1xuICAgIGZsb2F0IGMgPSBmcmFjdCh0Yy54KmdyYXBoTnVtU2FtcGxlcyk7XG5cbiAgICB2ZWMzIHVucGFja2VkQSA9IHVucGFjazNORmxvYXRzKGEudyk7XG4gICAgdmVjMyB1bnBhY2tlZEIgPSB1bnBhY2szTkZsb2F0cyhiLncpO1xuICAgIHcgPSBtaXgodW5wYWNrZWRBLCB1bnBhY2tlZEIsIGMpO1xuXG4gICAgcmV0dXJuIG1peChhLCBiLCBjKTtcbn1cblxudmVjMiByb3RhdGUodmVjMiBxdWFkWFksIGZsb2F0IHBSb3RhdGlvbiwgb3V0IG1hdDIgcm90TWF0cml4KSB7XG4gICAgZmxvYXQgYyA9IGNvcyhwUm90YXRpb24pO1xuICAgIGZsb2F0IHMgPSBzaW4ocFJvdGF0aW9uKTtcblxuICAgIG1hdDIgbSA9IG1hdDIoYywgLXMsIHMsIGMpO1xuICAgIHJvdE1hdHJpeCA9IG07XG5cbiAgICByZXR1cm4gbSAqIHF1YWRYWTtcbn1cblxudmVjMyBiaWxsYm9hcmQodmVjMyBJbnN0YW5jZUNvb3JkcywgdmVjMiBxdWFkWFkpIHtcbiAgICAjaWZkZWYgU0NSRUVOX1NQQUNFXG4gICAgICAgIHZlYzMgcG9zID0gdmVjMygtMSwgMCwgMCkgKiBxdWFkWFkueCArIHZlYzMoMCwgLTEsIDApICogcXVhZFhZLnk7XG4gICAgI2Vsc2VcbiAgICAgICAgdmVjMyBwb3MgPSAtbWF0cml4X3ZpZXdJbnZlcnNlWzBdLnh5eiAqIHF1YWRYWS54ICsgLW1hdHJpeF92aWV3SW52ZXJzZVsxXS54eXogKiBxdWFkWFkueTtcbiAgICAjZW5kaWZcblxuICAgIHJldHVybiBwb3M7XG59XG5cbnZlYzMgY3VzdG9tRmFjZSh2ZWMzIEluc3RhbmNlQ29vcmRzLCB2ZWMyIHF1YWRYWSkge1xuICAgIHZlYzMgcG9zID0gZmFjZVRhbmdlbnQgKiBxdWFkWFkueCArIGZhY2VCaW5vcm0gKiBxdWFkWFkueTtcbiAgICByZXR1cm4gcG9zO1xufVxuXG52ZWMyIHNhZmVOb3JtYWxpemUodmVjMiB2KSB7XG4gICAgZmxvYXQgbCA9IGxlbmd0aCh2KTtcbiAgICByZXR1cm4gKGwgPiAxZS0wNikgPyB2IC8gbCA6IHY7XG59XG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgdmVjMyBtZXNoTG9jYWxQb3MgPSBwYXJ0aWNsZV92ZXJ0ZXhEYXRhLnh5ejtcbiAgICBmbG9hdCBpZCA9IGZsb29yKHBhcnRpY2xlX3ZlcnRleERhdGEudyk7XG5cbiAgICBmbG9hdCBybmRGYWN0b3IgPSBmcmFjdChzaW4oaWQgKyAxLjAgKyBzZWVkKSk7XG4gICAgdmVjMyBybmRGYWN0b3IzID0gdmVjMyhybmRGYWN0b3IsIGZyYWN0KHJuZEZhY3RvcioxMC4wKSwgZnJhY3Qocm5kRmFjdG9yKjEwMC4wKSk7XG5cbiAgICBmbG9hdCB1diA9IGlkIC8gbnVtUGFydGljbGVzUG90O1xuICAgIHJlYWRJbnB1dCh1dik7XG5cbiNpZmRlZiBMT0NBTF9TUEFDRVxuICAgIGluVmVsID0gbWF0MyhtYXRyaXhfbW9kZWwpICogaW5WZWw7XG4jZW5kaWZcbiAgICB2ZWMyIHZlbG9jaXR5ViA9IHNhZmVOb3JtYWxpemUoKG1hdDMobWF0cml4X3ZpZXcpICogaW5WZWwpLnh5KTsgLy8gc2hvdWxkIGJlIHJlbW92ZWQgYnkgY29tcGlsZXIgaWYgYWxpZ24vc3RyZXRjaCBpcyBub3QgdXNlZFxuXG4gICAgZmxvYXQgcGFydGljbGVMaWZldGltZSA9IGxpZmV0aW1lO1xuXG4gICAgaWYgKGluTGlmZSA8PSAwLjAgfHwgaW5MaWZlID4gcGFydGljbGVMaWZldGltZSB8fCAhaW5TaG93KSBtZXNoTG9jYWxQb3MgPSB2ZWMzKDAuMCk7XG4gICAgdmVjMiBxdWFkWFkgPSBtZXNoTG9jYWxQb3MueHk7XG4gICAgZmxvYXQgbmxpZmUgPSBjbGFtcChpbkxpZmUgLyBwYXJ0aWNsZUxpZmV0aW1lLCAwLjAsIDEuMCk7XG5cbiAgICB2ZWMzIHBhcmFtRGl2O1xuICAgIHZlYzQgcGFyYW1zID0gdGV4MURsb2RfbGVycChpbnRlcm5hbFRleDIsIHZlYzIobmxpZmUsIDApLCBwYXJhbURpdik7XG4gICAgZmxvYXQgc2NhbGUgPSBwYXJhbXMueTtcbiAgICBmbG9hdCBzY2FsZURpdiA9IHBhcmFtRGl2Lng7XG4gICAgZmxvYXQgYWxwaGFEaXYgPSBwYXJhbURpdi56O1xuXG4gICAgc2NhbGUgKz0gKHNjYWxlRGl2ICogMi4wIC0gMS4wKSAqIHNjYWxlRGl2TXVsdCAqIGZyYWN0KHJuZEZhY3RvcioxMDAwMC4wKTtcblxuI2lmbmRlZiBVU0VfTUVTSFxuICAgIHRleENvb3Jkc0FscGhhTGlmZSA9IHZlYzQocXVhZFhZICogLTAuNSArIDAuNSwgKGFscGhhRGl2ICogMi4wIC0gMS4wKSAqIGFscGhhRGl2TXVsdCAqIGZyYWN0KHJuZEZhY3RvcioxMDAwLjApLCBubGlmZSk7XG4jZWxzZVxuICAgIHRleENvb3Jkc0FscGhhTGlmZSA9IHZlYzQocGFydGljbGVfdXYsIChhbHBoYURpdiAqIDIuMCAtIDEuMCkgKiBhbHBoYURpdk11bHQgKiBmcmFjdChybmRGYWN0b3IqMTAwMC4wKSwgbmxpZmUpO1xuI2VuZGlmXG5cbiAgICB2ZWMzIHBhcnRpY2xlUG9zID0gaW5Qb3M7XG4gICAgdmVjMyBwYXJ0aWNsZVBvc01vdmVkID0gdmVjMygwLjApO1xuXG4gICAgbWF0MiByb3RNYXRyaXg7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGlCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
