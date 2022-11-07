/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_meshVS = `
    vec3 localPos = meshLocalPos;
    localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);
    localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);

    billboard(particlePos, quadXY);
`;

export { particle_meshVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbWVzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlX21lc2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWMzIGxvY2FsUG9zID0gbWVzaExvY2FsUG9zO1xuICAgIGxvY2FsUG9zLnh5ID0gcm90YXRlKGxvY2FsUG9zLnh5LCBpbkFuZ2xlLCByb3RNYXRyaXgpO1xuICAgIGxvY2FsUG9zLnl6ID0gcm90YXRlKGxvY2FsUG9zLnl6LCBpbkFuZ2xlLCByb3RNYXRyaXgpO1xuXG4gICAgYmlsbGJvYXJkKHBhcnRpY2xlUG9zLCBxdWFkWFkpO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQU5BOzs7OyJ9
