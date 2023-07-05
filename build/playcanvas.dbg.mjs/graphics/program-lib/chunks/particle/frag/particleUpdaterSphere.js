/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterSpherePS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyU3BoZXJlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVVcGRhdGVyU3BoZXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IHNwYXduQm91bmRzU3BoZXJlO1xudW5pZm9ybSBmbG9hdCBzcGF3bkJvdW5kc1NwaGVyZUlubmVyUmF0aW87XG5cbnZlYzMgY2FsY1NwYXduUG9zaXRpb24odmVjMyBpbkJvdW5kcywgZmxvYXQgcm5kRmFjdG9yKSB7XG4gICAgZmxvYXQgcm5kNCA9IGZyYWN0KHJuZEZhY3RvciAqIDEwMDAuMCk7XG4gICAgdmVjMyBub3JtID0gbm9ybWFsaXplKGluQm91bmRzLnh5eiAtIHZlYzMoMC41KSk7XG4gICAgZmxvYXQgciA9IHJuZDQgKiAoMS4wIC0gc3Bhd25Cb3VuZHNTcGhlcmVJbm5lclJhdGlvKSArIHNwYXduQm91bmRzU3BoZXJlSW5uZXJSYXRpbztcbiNpZm5kZWYgTE9DQUxfU1BBQ0VcbiAgICByZXR1cm4gZW1pdHRlclBvcyArIG5vcm0gKiByICogc3Bhd25Cb3VuZHNTcGhlcmU7XG4jZWxzZVxuICAgIHJldHVybiBub3JtICogciAqIHNwYXduQm91bmRzU3BoZXJlO1xuI2VuZGlmXG59XG5cbnZvaWQgYWRkSW5pdGlhbFZlbG9jaXR5KGlub3V0IHZlYzMgbG9jYWxWZWxvY2l0eSwgdmVjMyBpbkJvdW5kcykge1xuICAgIGxvY2FsVmVsb2NpdHkgKz0gbm9ybWFsaXplKGluQm91bmRzIC0gdmVjMygwLjUpKSAqIGluaXRpYWxWZWxvY2l0eTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw4QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FsQkE7Ozs7In0=
