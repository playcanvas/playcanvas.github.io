/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterSpherePS = /* glsl */`
uniform float spawnBoundsSphere;
uniform float spawnBoundsSphereInnerRatio;

vec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {
    float rnd4 = fract(rndFactor * 1000.0);
    vec3 norm = normalize(inBounds.xyz - vec3(0.5));
    float r = rnd4 * (1.0 - spawnBoundsSphereInnerRatio) + spawnBoundsSphereInnerRatio;
#ifndef LOCAL_SPACE
    return emitterPos + norm * r * spawnBoundsSphere;
#else
    return norm * r * spawnBoundsSphere;
#endif
}

void addInitialVelocity(inout vec3 localVelocity, vec3 inBounds) {
    localVelocity += normalize(inBounds - vec3(0.5)) * initialVelocity;
}
`;

export { particleUpdaterSpherePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyU3BoZXJlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZVVwZGF0ZXJTcGhlcmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgc3Bhd25Cb3VuZHNTcGhlcmU7XG51bmlmb3JtIGZsb2F0IHNwYXduQm91bmRzU3BoZXJlSW5uZXJSYXRpbztcblxudmVjMyBjYWxjU3Bhd25Qb3NpdGlvbih2ZWMzIGluQm91bmRzLCBmbG9hdCBybmRGYWN0b3IpIHtcbiAgICBmbG9hdCBybmQ0ID0gZnJhY3Qocm5kRmFjdG9yICogMTAwMC4wKTtcbiAgICB2ZWMzIG5vcm0gPSBub3JtYWxpemUoaW5Cb3VuZHMueHl6IC0gdmVjMygwLjUpKTtcbiAgICBmbG9hdCByID0gcm5kNCAqICgxLjAgLSBzcGF3bkJvdW5kc1NwaGVyZUlubmVyUmF0aW8pICsgc3Bhd25Cb3VuZHNTcGhlcmVJbm5lclJhdGlvO1xuI2lmbmRlZiBMT0NBTF9TUEFDRVxuICAgIHJldHVybiBlbWl0dGVyUG9zICsgbm9ybSAqIHIgKiBzcGF3bkJvdW5kc1NwaGVyZTtcbiNlbHNlXG4gICAgcmV0dXJuIG5vcm0gKiByICogc3Bhd25Cb3VuZHNTcGhlcmU7XG4jZW5kaWZcbn1cblxudm9pZCBhZGRJbml0aWFsVmVsb2NpdHkoaW5vdXQgdmVjMyBsb2NhbFZlbG9jaXR5LCB2ZWMzIGluQm91bmRzKSB7XG4gICAgbG9jYWxWZWxvY2l0eSArPSBub3JtYWxpemUoaW5Cb3VuZHMgLSB2ZWMzKDAuNSkpICogaW5pdGlhbFZlbG9jaXR5O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDhCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
