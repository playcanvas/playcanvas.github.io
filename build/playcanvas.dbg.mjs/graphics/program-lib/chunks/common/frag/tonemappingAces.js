/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingAcesPS = `
uniform float exposure;

vec3 toneMap(vec3 color) {
    float tA = 2.51;
    float tB = 0.03;
    float tC = 2.43;
    float tD = 0.59;
    float tE = 0.14;
    vec3 x = color * exposure;
    return (x*(tA*x+tB))/(x*(tC*x+tD)+tE);
}
`;

export { tonemappingAcesPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdBY2VzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL3RvbmVtYXBwaW5nQWNlcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBleHBvc3VyZTtcblxudmVjMyB0b25lTWFwKHZlYzMgY29sb3IpIHtcbiAgICBmbG9hdCB0QSA9IDIuNTE7XG4gICAgZmxvYXQgdEIgPSAwLjAzO1xuICAgIGZsb2F0IHRDID0gMi40MztcbiAgICBmbG9hdCB0RCA9IDAuNTk7XG4gICAgZmxvYXQgdEUgPSAwLjE0O1xuICAgIHZlYzMgeCA9IGNvbG9yICogZXhwb3N1cmU7XG4gICAgcmV0dXJuICh4Kih0QSp4K3RCKSkvKHgqKHRDKngrdEQpK3RFKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FaQTs7OzsifQ==
