/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_customFaceVS = `
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = customFace(particlePos, quadXY);
`;

export { particle_customFaceVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfY3VzdG9tRmFjZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlX2N1c3RvbUZhY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBxdWFkWFkgPSByb3RhdGUocXVhZFhZLCBpbkFuZ2xlLCByb3RNYXRyaXgpO1xuICAgIHZlYzMgbG9jYWxQb3MgPSBjdXN0b21GYWNlKHBhcnRpY2xlUG9zLCBxdWFkWFkpO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDRCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQSxDQUhBOzs7OyJ9
