/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSheenPS = `

void addReflectionSheen() {
    float NoV = dot(dNormalW, dViewDirW);
    float alphaG = sGlossiness * sGlossiness;

    // Avoid using a LUT and approximate the values analytically
    float a = sGlossiness < 0.25 ? -339.2 * alphaG + 161.4 * sGlossiness - 25.9 : -8.48 * alphaG + 14.3 * sGlossiness - 9.95;
    float b = sGlossiness < 0.25 ? 44.0 * alphaG - 23.7 * sGlossiness + 3.26 : 1.97 * alphaG - 3.27 * sGlossiness + 0.72;
    float DG = exp( a * NoV + b ) + ( sGlossiness < 0.25 ? 0.0 : 0.1 * ( sGlossiness - 0.25 ) );
    sReflection += vec4(calcReflection(dReflDirW, sGlossiness), saturate(DG * 1.0/PI));
}
`;

export { reflectionSheenPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNoZWVuLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25TaGVlbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG52b2lkIGFkZFJlZmxlY3Rpb25TaGVlbigpIHtcbiAgICBmbG9hdCBOb1YgPSBkb3QoZE5vcm1hbFcsIGRWaWV3RGlyVyk7XG4gICAgZmxvYXQgYWxwaGFHID0gc0dsb3NzaW5lc3MgKiBzR2xvc3NpbmVzcztcblxuICAgIC8vIEF2b2lkIHVzaW5nIGEgTFVUIGFuZCBhcHByb3hpbWF0ZSB0aGUgdmFsdWVzIGFuYWx5dGljYWxseVxuICAgIGZsb2F0IGEgPSBzR2xvc3NpbmVzcyA8IDAuMjUgPyAtMzM5LjIgKiBhbHBoYUcgKyAxNjEuNCAqIHNHbG9zc2luZXNzIC0gMjUuOSA6IC04LjQ4ICogYWxwaGFHICsgMTQuMyAqIHNHbG9zc2luZXNzIC0gOS45NTtcbiAgICBmbG9hdCBiID0gc0dsb3NzaW5lc3MgPCAwLjI1ID8gNDQuMCAqIGFscGhhRyAtIDIzLjcgKiBzR2xvc3NpbmVzcyArIDMuMjYgOiAxLjk3ICogYWxwaGFHIC0gMy4yNyAqIHNHbG9zc2luZXNzICsgMC43MjtcbiAgICBmbG9hdCBERyA9IGV4cCggYSAqIE5vViArIGIgKSArICggc0dsb3NzaW5lc3MgPCAwLjI1ID8gMC4wIDogMC4xICogKCBzR2xvc3NpbmVzcyAtIDAuMjUgKSApO1xuICAgIHNSZWZsZWN0aW9uICs9IHZlYzQoY2FsY1JlZmxlY3Rpb24oZFJlZmxEaXJXLCBzR2xvc3NpbmVzcyksIHNhdHVyYXRlKERHICogMS4wL1BJKSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBWkE7Ozs7In0=
