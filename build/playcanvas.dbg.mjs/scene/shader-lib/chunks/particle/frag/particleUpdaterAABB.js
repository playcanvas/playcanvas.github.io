var particleUpdaterAABBPS = /* glsl */`
uniform mat3 spawnBounds;
uniform vec3 spawnPosInnerRatio;

vec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {
    vec3 pos = inBounds - vec3(0.5);

    vec3 posAbs = abs(pos);
    vec3 maxPos = vec3(max(posAbs.x, max(posAbs.y, posAbs.z)));

    vec3 edge = maxPos + (vec3(0.5) - maxPos) * spawnPosInnerRatio;

    pos.x = edge.x * (maxPos.x == posAbs.x ? sign(pos.x) : 2.0 * pos.x);
    pos.y = edge.y * (maxPos.y == posAbs.y ? sign(pos.y) : 2.0 * pos.y);
    pos.z = edge.z * (maxPos.z == posAbs.z ? sign(pos.z) : 2.0 * pos.z);

#ifndef LOCAL_SPACE
    return emitterPos + spawnBounds * pos;
#else
    return spawnBounds * pos;
#endif
}

void addInitialVelocity(inout vec3 localVelocity, vec3 inBounds) {
    localVelocity -= vec3(0, 0, initialVelocity);
}
`;

export { particleUpdaterAABBPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyQUFCQi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVVcGRhdGVyQUFCQi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBtYXQzIHNwYXduQm91bmRzO1xudW5pZm9ybSB2ZWMzIHNwYXduUG9zSW5uZXJSYXRpbztcblxudmVjMyBjYWxjU3Bhd25Qb3NpdGlvbih2ZWMzIGluQm91bmRzLCBmbG9hdCBybmRGYWN0b3IpIHtcbiAgICB2ZWMzIHBvcyA9IGluQm91bmRzIC0gdmVjMygwLjUpO1xuXG4gICAgdmVjMyBwb3NBYnMgPSBhYnMocG9zKTtcbiAgICB2ZWMzIG1heFBvcyA9IHZlYzMobWF4KHBvc0Ficy54LCBtYXgocG9zQWJzLnksIHBvc0Ficy56KSkpO1xuXG4gICAgdmVjMyBlZGdlID0gbWF4UG9zICsgKHZlYzMoMC41KSAtIG1heFBvcykgKiBzcGF3blBvc0lubmVyUmF0aW87XG5cbiAgICBwb3MueCA9IGVkZ2UueCAqIChtYXhQb3MueCA9PSBwb3NBYnMueCA/IHNpZ24ocG9zLngpIDogMi4wICogcG9zLngpO1xuICAgIHBvcy55ID0gZWRnZS55ICogKG1heFBvcy55ID09IHBvc0Ficy55ID8gc2lnbihwb3MueSkgOiAyLjAgKiBwb3MueSk7XG4gICAgcG9zLnogPSBlZGdlLnogKiAobWF4UG9zLnogPT0gcG9zQWJzLnogPyBzaWduKHBvcy56KSA6IDIuMCAqIHBvcy56KTtcblxuI2lmbmRlZiBMT0NBTF9TUEFDRVxuICAgIHJldHVybiBlbWl0dGVyUG9zICsgc3Bhd25Cb3VuZHMgKiBwb3M7XG4jZWxzZVxuICAgIHJldHVybiBzcGF3bkJvdW5kcyAqIHBvcztcbiNlbmRpZlxufVxuXG52b2lkIGFkZEluaXRpYWxWZWxvY2l0eShpbm91dCB2ZWMzIGxvY2FsVmVsb2NpdHksIHZlYzMgaW5Cb3VuZHMpIHtcbiAgICBsb2NhbFZlbG9jaXR5IC09IHZlYzMoMCwgMCwgaW5pdGlhbFZlbG9jaXR5KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsNEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
