/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_billboardVS = `
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = billboard(particlePos, quadXY);
`;

export { particle_billboardVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfYmlsbGJvYXJkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfYmlsbGJvYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgcXVhZFhZID0gcm90YXRlKHF1YWRYWSwgaW5BbmdsZSwgcm90TWF0cml4KTtcbiAgICB2ZWMzIGxvY2FsUG9zID0gYmlsbGJvYXJkKHBhcnRpY2xlUG9zLCBxdWFkWFkpO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDJCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQSxDQUhBOzs7OyJ9
