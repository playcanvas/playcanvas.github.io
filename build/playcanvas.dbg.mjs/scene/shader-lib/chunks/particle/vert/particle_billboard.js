/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_billboardVS = `
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = billboard(particlePos, quadXY);
`;

export { particle_billboardVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfYmlsbGJvYXJkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZV9iaWxsYm9hcmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBxdWFkWFkgPSByb3RhdGUocXVhZFhZLCBpbkFuZ2xlLCByb3RNYXRyaXgpO1xuICAgIHZlYzMgbG9jYWxQb3MgPSBiaWxsYm9hcmQocGFydGljbGVQb3MsIHF1YWRYWSk7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMkJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBLENBQUM7Ozs7In0=
