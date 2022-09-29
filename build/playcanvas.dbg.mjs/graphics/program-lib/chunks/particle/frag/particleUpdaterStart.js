/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterStartPS = `
float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 unpack3NFloats(float src) {
    float r = fract(src);
    float g = fract(src * 256.0);
    float b = fract(src * 65536.0);
    return vec3(r, g, b);
}

vec3 tex1Dlod_lerp(highp sampler2D tex, vec2 tc, out vec3 w) {
    vec4 a = texture2D(tex, tc);
    vec4 b = texture2D(tex, tc + graphSampleSize);
    float c = fract(tc.x * graphNumSamples);

    vec3 unpackedA = unpack3NFloats(a.w);
    vec3 unpackedB = unpack3NFloats(b.w);
    w = mix(unpackedA, unpackedB, c);

    return mix(a.xyz, b.xyz, c);
}

#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)
vec4 hash41(float p) {
    vec4 p4 = fract(vec4(p) * HASHSCALE4);
    p4 += dot(p4, p4.wzxy+19.19);
    return fract(vec4((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}

void main(void) {
    if (gl_FragCoord.x > numParticles) discard;

    readInput(vUv0.x);
    visMode = inShow? 1.0 : -1.0;

    vec4 rndFactor = hash41(gl_FragCoord.x + seed);

    float particleRate = rate + rateDiv * rndFactor.x;

    outLife = inLife + delta;
    float nlife = clamp(outLife / lifetime, 0.0, 1.0);

    vec3 localVelocityDiv;
    vec3 velocityDiv;
    vec3 paramDiv;
    vec3 localVelocity = tex1Dlod_lerp(internalTex0, vec2(nlife, 0), localVelocityDiv);
    vec3 velocity =      tex1Dlod_lerp(internalTex1, vec2(nlife, 0), velocityDiv);
    vec3 params =        tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);
    float rotSpeed = params.x;
    float rotSpeedDiv = paramDiv.y;

    vec3 radialParams = tex1Dlod_lerp(internalTex3, vec2(nlife, 0), paramDiv);
    float radialSpeed = radialParams.x;
    float radialSpeedDiv = radialParams.y;

    bool respawn = inLife <= 0.0 || outLife >= lifetime;
    inPos = respawn ? calcSpawnPosition(rndFactor.xyz, rndFactor.x) : inPos;
    inAngle = respawn ? mix(startAngle, startAngle2, rndFactor.x) : inAngle;

#ifndef LOCAL_SPACE
    vec3 radialVel = inPos - emitterPos;
#else
    vec3 radialVel = inPos;
#endif
    radialVel = (dot(radialVel, radialVel) > 1.0E-8) ? radialSpeed * normalize(radialVel) : vec3(0.0);
    radialVel += (radialSpeedDiv * vec3(2.0) - vec3(1.0)) * radialSpeedDivMult * rndFactor.xyz;

    localVelocity +=    (localVelocityDiv * vec3(2.0) - vec3(1.0)) * localVelocityDivMult * rndFactor.xyz;
    velocity +=         (velocityDiv * vec3(2.0) - vec3(1.0)) * velocityDivMult * rndFactor.xyz;
    rotSpeed +=         (rotSpeedDiv * 2.0 - 1.0) * rotSpeedDivMult * rndFactor.y;

    addInitialVelocity(localVelocity, rndFactor.xyz);

#ifndef LOCAL_SPACE
    outVel = emitterMatrix * localVelocity + (radialVel + velocity) * emitterScale;
#else
    outVel = (localVelocity + radialVel) / emitterScale + emitterMatrixInv * velocity;
#endif

    outPos = inPos + outVel * delta;
    outAngle = inAngle + rotSpeed * delta;
`;

export { particleUpdaterStartPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyU3RhcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZVVwZGF0ZXJTdGFydC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbnZlYzMgdW5wYWNrM05GbG9hdHMoZmxvYXQgc3JjKSB7XG4gICAgZmxvYXQgciA9IGZyYWN0KHNyYyk7XG4gICAgZmxvYXQgZyA9IGZyYWN0KHNyYyAqIDI1Ni4wKTtcbiAgICBmbG9hdCBiID0gZnJhY3Qoc3JjICogNjU1MzYuMCk7XG4gICAgcmV0dXJuIHZlYzMociwgZywgYik7XG59XG5cbnZlYzMgdGV4MURsb2RfbGVycChoaWdocCBzYW1wbGVyMkQgdGV4LCB2ZWMyIHRjLCBvdXQgdmVjMyB3KSB7XG4gICAgdmVjNCBhID0gdGV4dHVyZTJEKHRleCwgdGMpO1xuICAgIHZlYzQgYiA9IHRleHR1cmUyRCh0ZXgsIHRjICsgZ3JhcGhTYW1wbGVTaXplKTtcbiAgICBmbG9hdCBjID0gZnJhY3QodGMueCAqIGdyYXBoTnVtU2FtcGxlcyk7XG5cbiAgICB2ZWMzIHVucGFja2VkQSA9IHVucGFjazNORmxvYXRzKGEudyk7XG4gICAgdmVjMyB1bnBhY2tlZEIgPSB1bnBhY2szTkZsb2F0cyhiLncpO1xuICAgIHcgPSBtaXgodW5wYWNrZWRBLCB1bnBhY2tlZEIsIGMpO1xuXG4gICAgcmV0dXJuIG1peChhLnh5eiwgYi54eXosIGMpO1xufVxuXG4jZGVmaW5lIEhBU0hTQ0FMRTQgdmVjNCgxMDMxLCAuMTAzMCwgLjA5NzMsIC4xMDk5KVxudmVjNCBoYXNoNDEoZmxvYXQgcCkge1xuICAgIHZlYzQgcDQgPSBmcmFjdCh2ZWM0KHApICogSEFTSFNDQUxFNCk7XG4gICAgcDQgKz0gZG90KHA0LCBwNC53enh5KzE5LjE5KTtcbiAgICByZXR1cm4gZnJhY3QodmVjNCgocDQueCArIHA0LnkpKnA0LnosIChwNC54ICsgcDQueikqcDQueSwgKHA0LnkgKyBwNC56KSpwNC53LCAocDQueiArIHA0LncpKnA0LngpKTtcbn1cblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBpZiAoZ2xfRnJhZ0Nvb3JkLnggPiBudW1QYXJ0aWNsZXMpIGRpc2NhcmQ7XG5cbiAgICByZWFkSW5wdXQodlV2MC54KTtcbiAgICB2aXNNb2RlID0gaW5TaG93PyAxLjAgOiAtMS4wO1xuXG4gICAgdmVjNCBybmRGYWN0b3IgPSBoYXNoNDEoZ2xfRnJhZ0Nvb3JkLnggKyBzZWVkKTtcblxuICAgIGZsb2F0IHBhcnRpY2xlUmF0ZSA9IHJhdGUgKyByYXRlRGl2ICogcm5kRmFjdG9yLng7XG5cbiAgICBvdXRMaWZlID0gaW5MaWZlICsgZGVsdGE7XG4gICAgZmxvYXQgbmxpZmUgPSBjbGFtcChvdXRMaWZlIC8gbGlmZXRpbWUsIDAuMCwgMS4wKTtcblxuICAgIHZlYzMgbG9jYWxWZWxvY2l0eURpdjtcbiAgICB2ZWMzIHZlbG9jaXR5RGl2O1xuICAgIHZlYzMgcGFyYW1EaXY7XG4gICAgdmVjMyBsb2NhbFZlbG9jaXR5ID0gdGV4MURsb2RfbGVycChpbnRlcm5hbFRleDAsIHZlYzIobmxpZmUsIDApLCBsb2NhbFZlbG9jaXR5RGl2KTtcbiAgICB2ZWMzIHZlbG9jaXR5ID0gICAgICB0ZXgxRGxvZF9sZXJwKGludGVybmFsVGV4MSwgdmVjMihubGlmZSwgMCksIHZlbG9jaXR5RGl2KTtcbiAgICB2ZWMzIHBhcmFtcyA9ICAgICAgICB0ZXgxRGxvZF9sZXJwKGludGVybmFsVGV4MiwgdmVjMihubGlmZSwgMCksIHBhcmFtRGl2KTtcbiAgICBmbG9hdCByb3RTcGVlZCA9IHBhcmFtcy54O1xuICAgIGZsb2F0IHJvdFNwZWVkRGl2ID0gcGFyYW1EaXYueTtcblxuICAgIHZlYzMgcmFkaWFsUGFyYW1zID0gdGV4MURsb2RfbGVycChpbnRlcm5hbFRleDMsIHZlYzIobmxpZmUsIDApLCBwYXJhbURpdik7XG4gICAgZmxvYXQgcmFkaWFsU3BlZWQgPSByYWRpYWxQYXJhbXMueDtcbiAgICBmbG9hdCByYWRpYWxTcGVlZERpdiA9IHJhZGlhbFBhcmFtcy55O1xuXG4gICAgYm9vbCByZXNwYXduID0gaW5MaWZlIDw9IDAuMCB8fCBvdXRMaWZlID49IGxpZmV0aW1lO1xuICAgIGluUG9zID0gcmVzcGF3biA/IGNhbGNTcGF3blBvc2l0aW9uKHJuZEZhY3Rvci54eXosIHJuZEZhY3Rvci54KSA6IGluUG9zO1xuICAgIGluQW5nbGUgPSByZXNwYXduID8gbWl4KHN0YXJ0QW5nbGUsIHN0YXJ0QW5nbGUyLCBybmRGYWN0b3IueCkgOiBpbkFuZ2xlO1xuXG4jaWZuZGVmIExPQ0FMX1NQQUNFXG4gICAgdmVjMyByYWRpYWxWZWwgPSBpblBvcyAtIGVtaXR0ZXJQb3M7XG4jZWxzZVxuICAgIHZlYzMgcmFkaWFsVmVsID0gaW5Qb3M7XG4jZW5kaWZcbiAgICByYWRpYWxWZWwgPSAoZG90KHJhZGlhbFZlbCwgcmFkaWFsVmVsKSA+IDEuMEUtOCkgPyByYWRpYWxTcGVlZCAqIG5vcm1hbGl6ZShyYWRpYWxWZWwpIDogdmVjMygwLjApO1xuICAgIHJhZGlhbFZlbCArPSAocmFkaWFsU3BlZWREaXYgKiB2ZWMzKDIuMCkgLSB2ZWMzKDEuMCkpICogcmFkaWFsU3BlZWREaXZNdWx0ICogcm5kRmFjdG9yLnh5ejtcblxuICAgIGxvY2FsVmVsb2NpdHkgKz0gICAgKGxvY2FsVmVsb2NpdHlEaXYgKiB2ZWMzKDIuMCkgLSB2ZWMzKDEuMCkpICogbG9jYWxWZWxvY2l0eURpdk11bHQgKiBybmRGYWN0b3IueHl6O1xuICAgIHZlbG9jaXR5ICs9ICAgICAgICAgKHZlbG9jaXR5RGl2ICogdmVjMygyLjApIC0gdmVjMygxLjApKSAqIHZlbG9jaXR5RGl2TXVsdCAqIHJuZEZhY3Rvci54eXo7XG4gICAgcm90U3BlZWQgKz0gICAgICAgICAocm90U3BlZWREaXYgKiAyLjAgLSAxLjApICogcm90U3BlZWREaXZNdWx0ICogcm5kRmFjdG9yLnk7XG5cbiAgICBhZGRJbml0aWFsVmVsb2NpdHkobG9jYWxWZWxvY2l0eSwgcm5kRmFjdG9yLnh5eik7XG5cbiNpZm5kZWYgTE9DQUxfU1BBQ0VcbiAgICBvdXRWZWwgPSBlbWl0dGVyTWF0cml4ICogbG9jYWxWZWxvY2l0eSArIChyYWRpYWxWZWwgKyB2ZWxvY2l0eSkgKiBlbWl0dGVyU2NhbGU7XG4jZWxzZVxuICAgIG91dFZlbCA9IChsb2NhbFZlbG9jaXR5ICsgcmFkaWFsVmVsKSAvIGVtaXR0ZXJTY2FsZSArIGVtaXR0ZXJNYXRyaXhJbnYgKiB2ZWxvY2l0eTtcbiNlbmRpZlxuXG4gICAgb3V0UG9zID0gaW5Qb3MgKyBvdXRWZWwgKiBkZWx0YTtcbiAgICBvdXRBbmdsZSA9IGluQW5nbGUgKyByb3RTcGVlZCAqIGRlbHRhO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDZCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FuRkE7Ozs7In0=
