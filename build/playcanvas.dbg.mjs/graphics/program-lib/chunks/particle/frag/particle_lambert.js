/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_lambertPS = `
    vec3 negNormal = max(normal, vec3(0.0));
    vec3 posNormal = max(-normal, vec3(0.0));
`;

export { particle_lambertPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbGFtYmVydC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlX2xhbWJlcnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWMzIG5lZ05vcm1hbCA9IG1heChub3JtYWwsIHZlYzMoMC4wKSk7XG4gICAgdmVjMyBwb3NOb3JtYWwgPSBtYXgoLW5vcm1hbCwgdmVjMygwLjApKTtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx5QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0EsQ0FIQTs7OzsifQ==
