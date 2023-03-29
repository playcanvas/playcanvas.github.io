/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingHejlPS = `
uniform float exposure;

vec3 toneMap(vec3 color) {
    color *= exposure;
    const float  A = 0.22, B = 0.3, C = .1, D = 0.2, E = .01, F = 0.3;
    const float Scl = 1.25;

    vec3 h = max( vec3(0.0), color - vec3(0.004) );
    return (h*((Scl*A)*h+Scl*vec3(C*B,C*B,C*B))+Scl*vec3(D*E,D*E,D*E)) / (h*(A*h+vec3(B,B,B))+vec3(D*F,D*F,D*F)) - Scl*vec3(E/F,E/F,E/F);
}
`;

export { tonemappingHejlPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdIZWpsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL3RvbmVtYXBwaW5nSGVqbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBleHBvc3VyZTtcblxudmVjMyB0b25lTWFwKHZlYzMgY29sb3IpIHtcbiAgICBjb2xvciAqPSBleHBvc3VyZTtcbiAgICBjb25zdCBmbG9hdCAgQSA9IDAuMjIsIEIgPSAwLjMsIEMgPSAuMSwgRCA9IDAuMiwgRSA9IC4wMSwgRiA9IDAuMztcbiAgICBjb25zdCBmbG9hdCBTY2wgPSAxLjI1O1xuXG4gICAgdmVjMyBoID0gbWF4KCB2ZWMzKDAuMCksIGNvbG9yIC0gdmVjMygwLjAwNCkgKTtcbiAgICByZXR1cm4gKGgqKChTY2wqQSkqaCtTY2wqdmVjMyhDKkIsQypCLEMqQikpK1NjbCp2ZWMzKEQqRSxEKkUsRCpFKSkgLyAoaCooQSpoK3ZlYzMoQixCLEIpKSt2ZWMzKEQqRixEKkYsRCpGKSkgLSBTY2wqdmVjMyhFL0YsRS9GLEUvRik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVhBOzs7OyJ9
