/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
    sReflection += calcReflection(dNormalW, 0.0) * saturate(DG);
}
`;

export { reflectionSheenPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNoZWVuLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvblNoZWVuLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbnZvaWQgYWRkUmVmbGVjdGlvblNoZWVuKCkge1xuICAgIGZsb2F0IE5vViA9IGRvdChkTm9ybWFsVywgZFZpZXdEaXJXKTtcbiAgICBmbG9hdCBhbHBoYUcgPSBzR2xvc3NpbmVzcyAqIHNHbG9zc2luZXNzO1xuXG4gICAgLy8gQXZvaWQgdXNpbmcgYSBMVVQgYW5kIGFwcHJveGltYXRlIHRoZSB2YWx1ZXMgYW5hbHl0aWNhbGx5XG4gICAgZmxvYXQgYSA9IHNHbG9zc2luZXNzIDwgMC4yNSA/IC0zMzkuMiAqIGFscGhhRyArIDE2MS40ICogc0dsb3NzaW5lc3MgLSAyNS45IDogLTguNDggKiBhbHBoYUcgKyAxNC4zICogc0dsb3NzaW5lc3MgLSA5Ljk1O1xuICAgIGZsb2F0IGIgPSBzR2xvc3NpbmVzcyA8IDAuMjUgPyA0NC4wICogYWxwaGFHIC0gMjMuNyAqIHNHbG9zc2luZXNzICsgMy4yNiA6IDEuOTcgKiBhbHBoYUcgLSAzLjI3ICogc0dsb3NzaW5lc3MgKyAwLjcyO1xuICAgIGZsb2F0IERHID0gZXhwKCBhICogTm9WICsgYiApICsgKCBzR2xvc3NpbmVzcyA8IDAuMjUgPyAwLjAgOiAwLjEgKiAoIHNHbG9zc2luZXNzIC0gMC4yNSApICk7XG4gICAgc1JlZmxlY3Rpb24gKz0gY2FsY1JlZmxlY3Rpb24oZE5vcm1hbFcsIDAuMCkgKiBzYXR1cmF0ZShERyk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
