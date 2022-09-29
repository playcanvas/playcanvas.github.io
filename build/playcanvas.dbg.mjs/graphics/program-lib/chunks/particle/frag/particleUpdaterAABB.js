/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterAABBPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyQUFCQi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlVXBkYXRlckFBQkIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gbWF0MyBzcGF3bkJvdW5kcztcbnVuaWZvcm0gdmVjMyBzcGF3blBvc0lubmVyUmF0aW87XG5cbnZlYzMgY2FsY1NwYXduUG9zaXRpb24odmVjMyBpbkJvdW5kcywgZmxvYXQgcm5kRmFjdG9yKSB7XG4gICAgdmVjMyBwb3MgPSBpbkJvdW5kcyAtIHZlYzMoMC41KTtcblxuICAgIHZlYzMgcG9zQWJzID0gYWJzKHBvcyk7XG4gICAgdmVjMyBtYXhQb3MgPSB2ZWMzKG1heChwb3NBYnMueCwgbWF4KHBvc0Ficy55LCBwb3NBYnMueikpKTtcblxuICAgIHZlYzMgZWRnZSA9IG1heFBvcyArICh2ZWMzKDAuNSkgLSBtYXhQb3MpICogc3Bhd25Qb3NJbm5lclJhdGlvO1xuXG4gICAgcG9zLnggPSBlZGdlLnggKiAobWF4UG9zLnggPT0gcG9zQWJzLnggPyBzaWduKHBvcy54KSA6IDIuMCAqIHBvcy54KTtcbiAgICBwb3MueSA9IGVkZ2UueSAqIChtYXhQb3MueSA9PSBwb3NBYnMueSA/IHNpZ24ocG9zLnkpIDogMi4wICogcG9zLnkpO1xuICAgIHBvcy56ID0gZWRnZS56ICogKG1heFBvcy56ID09IHBvc0Ficy56ID8gc2lnbihwb3MueikgOiAyLjAgKiBwb3Mueik7XG5cbiNpZm5kZWYgTE9DQUxfU1BBQ0VcbiAgICByZXR1cm4gZW1pdHRlclBvcyArIHNwYXduQm91bmRzICogcG9zO1xuI2Vsc2VcbiAgICByZXR1cm4gc3Bhd25Cb3VuZHMgKiBwb3M7XG4jZW5kaWZcbn1cblxudm9pZCBhZGRJbml0aWFsVmVsb2NpdHkoaW5vdXQgdmVjMyBsb2NhbFZlbG9jaXR5LCB2ZWMzIGluQm91bmRzKSB7XG4gICAgbG9jYWxWZWxvY2l0eSAtPSB2ZWMzKDAsIDAsIGluaXRpYWxWZWxvY2l0eSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTFCQTs7OzsifQ==
