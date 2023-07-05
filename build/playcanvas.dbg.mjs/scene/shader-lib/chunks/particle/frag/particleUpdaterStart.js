var particleUpdaterStartPS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyU3RhcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlVXBkYXRlclN0YXJ0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBzYXR1cmF0ZShmbG9hdCB4KSB7XG4gICAgcmV0dXJuIGNsYW1wKHgsIDAuMCwgMS4wKTtcbn1cblxudmVjMyB1bnBhY2szTkZsb2F0cyhmbG9hdCBzcmMpIHtcbiAgICBmbG9hdCByID0gZnJhY3Qoc3JjKTtcbiAgICBmbG9hdCBnID0gZnJhY3Qoc3JjICogMjU2LjApO1xuICAgIGZsb2F0IGIgPSBmcmFjdChzcmMgKiA2NTUzNi4wKTtcbiAgICByZXR1cm4gdmVjMyhyLCBnLCBiKTtcbn1cblxudmVjMyB0ZXgxRGxvZF9sZXJwKGhpZ2hwIHNhbXBsZXIyRCB0ZXgsIHZlYzIgdGMsIG91dCB2ZWMzIHcpIHtcbiAgICB2ZWM0IGEgPSB0ZXh0dXJlMkQodGV4LCB0Yyk7XG4gICAgdmVjNCBiID0gdGV4dHVyZTJEKHRleCwgdGMgKyBncmFwaFNhbXBsZVNpemUpO1xuICAgIGZsb2F0IGMgPSBmcmFjdCh0Yy54ICogZ3JhcGhOdW1TYW1wbGVzKTtcblxuICAgIHZlYzMgdW5wYWNrZWRBID0gdW5wYWNrM05GbG9hdHMoYS53KTtcbiAgICB2ZWMzIHVucGFja2VkQiA9IHVucGFjazNORmxvYXRzKGIudyk7XG4gICAgdyA9IG1peCh1bnBhY2tlZEEsIHVucGFja2VkQiwgYyk7XG5cbiAgICByZXR1cm4gbWl4KGEueHl6LCBiLnh5eiwgYyk7XG59XG5cbiNkZWZpbmUgSEFTSFNDQUxFNCB2ZWM0KDEwMzEsIC4xMDMwLCAuMDk3MywgLjEwOTkpXG52ZWM0IGhhc2g0MShmbG9hdCBwKSB7XG4gICAgdmVjNCBwNCA9IGZyYWN0KHZlYzQocCkgKiBIQVNIU0NBTEU0KTtcbiAgICBwNCArPSBkb3QocDQsIHA0Lnd6eHkrMTkuMTkpO1xuICAgIHJldHVybiBmcmFjdCh2ZWM0KChwNC54ICsgcDQueSkqcDQueiwgKHA0LnggKyBwNC56KSpwNC55LCAocDQueSArIHA0LnopKnA0LncsIChwNC56ICsgcDQudykqcDQueCkpO1xufVxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIGlmIChnbF9GcmFnQ29vcmQueCA+IG51bVBhcnRpY2xlcykgZGlzY2FyZDtcblxuICAgIHJlYWRJbnB1dCh2VXYwLngpO1xuICAgIHZpc01vZGUgPSBpblNob3c/IDEuMCA6IC0xLjA7XG5cbiAgICB2ZWM0IHJuZEZhY3RvciA9IGhhc2g0MShnbF9GcmFnQ29vcmQueCArIHNlZWQpO1xuXG4gICAgZmxvYXQgcGFydGljbGVSYXRlID0gcmF0ZSArIHJhdGVEaXYgKiBybmRGYWN0b3IueDtcblxuICAgIG91dExpZmUgPSBpbkxpZmUgKyBkZWx0YTtcbiAgICBmbG9hdCBubGlmZSA9IGNsYW1wKG91dExpZmUgLyBsaWZldGltZSwgMC4wLCAxLjApO1xuXG4gICAgdmVjMyBsb2NhbFZlbG9jaXR5RGl2O1xuICAgIHZlYzMgdmVsb2NpdHlEaXY7XG4gICAgdmVjMyBwYXJhbURpdjtcbiAgICB2ZWMzIGxvY2FsVmVsb2NpdHkgPSB0ZXgxRGxvZF9sZXJwKGludGVybmFsVGV4MCwgdmVjMihubGlmZSwgMCksIGxvY2FsVmVsb2NpdHlEaXYpO1xuICAgIHZlYzMgdmVsb2NpdHkgPSAgICAgIHRleDFEbG9kX2xlcnAoaW50ZXJuYWxUZXgxLCB2ZWMyKG5saWZlLCAwKSwgdmVsb2NpdHlEaXYpO1xuICAgIHZlYzMgcGFyYW1zID0gICAgICAgIHRleDFEbG9kX2xlcnAoaW50ZXJuYWxUZXgyLCB2ZWMyKG5saWZlLCAwKSwgcGFyYW1EaXYpO1xuICAgIGZsb2F0IHJvdFNwZWVkID0gcGFyYW1zLng7XG4gICAgZmxvYXQgcm90U3BlZWREaXYgPSBwYXJhbURpdi55O1xuXG4gICAgdmVjMyByYWRpYWxQYXJhbXMgPSB0ZXgxRGxvZF9sZXJwKGludGVybmFsVGV4MywgdmVjMihubGlmZSwgMCksIHBhcmFtRGl2KTtcbiAgICBmbG9hdCByYWRpYWxTcGVlZCA9IHJhZGlhbFBhcmFtcy54O1xuICAgIGZsb2F0IHJhZGlhbFNwZWVkRGl2ID0gcmFkaWFsUGFyYW1zLnk7XG5cbiAgICBib29sIHJlc3Bhd24gPSBpbkxpZmUgPD0gMC4wIHx8IG91dExpZmUgPj0gbGlmZXRpbWU7XG4gICAgaW5Qb3MgPSByZXNwYXduID8gY2FsY1NwYXduUG9zaXRpb24ocm5kRmFjdG9yLnh5eiwgcm5kRmFjdG9yLngpIDogaW5Qb3M7XG4gICAgaW5BbmdsZSA9IHJlc3Bhd24gPyBtaXgoc3RhcnRBbmdsZSwgc3RhcnRBbmdsZTIsIHJuZEZhY3Rvci54KSA6IGluQW5nbGU7XG5cbiNpZm5kZWYgTE9DQUxfU1BBQ0VcbiAgICB2ZWMzIHJhZGlhbFZlbCA9IGluUG9zIC0gZW1pdHRlclBvcztcbiNlbHNlXG4gICAgdmVjMyByYWRpYWxWZWwgPSBpblBvcztcbiNlbmRpZlxuICAgIHJhZGlhbFZlbCA9IChkb3QocmFkaWFsVmVsLCByYWRpYWxWZWwpID4gMS4wRS04KSA/IHJhZGlhbFNwZWVkICogbm9ybWFsaXplKHJhZGlhbFZlbCkgOiB2ZWMzKDAuMCk7XG4gICAgcmFkaWFsVmVsICs9IChyYWRpYWxTcGVlZERpdiAqIHZlYzMoMi4wKSAtIHZlYzMoMS4wKSkgKiByYWRpYWxTcGVlZERpdk11bHQgKiBybmRGYWN0b3IueHl6O1xuXG4gICAgbG9jYWxWZWxvY2l0eSArPSAgICAobG9jYWxWZWxvY2l0eURpdiAqIHZlYzMoMi4wKSAtIHZlYzMoMS4wKSkgKiBsb2NhbFZlbG9jaXR5RGl2TXVsdCAqIHJuZEZhY3Rvci54eXo7XG4gICAgdmVsb2NpdHkgKz0gICAgICAgICAodmVsb2NpdHlEaXYgKiB2ZWMzKDIuMCkgLSB2ZWMzKDEuMCkpICogdmVsb2NpdHlEaXZNdWx0ICogcm5kRmFjdG9yLnh5ejtcbiAgICByb3RTcGVlZCArPSAgICAgICAgIChyb3RTcGVlZERpdiAqIDIuMCAtIDEuMCkgKiByb3RTcGVlZERpdk11bHQgKiBybmRGYWN0b3IueTtcblxuICAgIGFkZEluaXRpYWxWZWxvY2l0eShsb2NhbFZlbG9jaXR5LCBybmRGYWN0b3IueHl6KTtcblxuI2lmbmRlZiBMT0NBTF9TUEFDRVxuICAgIG91dFZlbCA9IGVtaXR0ZXJNYXRyaXggKiBsb2NhbFZlbG9jaXR5ICsgKHJhZGlhbFZlbCArIHZlbG9jaXR5KSAqIGVtaXR0ZXJTY2FsZTtcbiNlbHNlXG4gICAgb3V0VmVsID0gKGxvY2FsVmVsb2NpdHkgKyByYWRpYWxWZWwpIC8gZW1pdHRlclNjYWxlICsgZW1pdHRlck1hdHJpeEludiAqIHZlbG9jaXR5O1xuI2VuZGlmXG5cbiAgICBvdXRQb3MgPSBpblBvcyArIG91dFZlbCAqIGRlbHRhO1xuICAgIG91dEFuZ2xlID0gaW5BbmdsZSArIHJvdFNwZWVkICogZGVsdGE7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDZCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
