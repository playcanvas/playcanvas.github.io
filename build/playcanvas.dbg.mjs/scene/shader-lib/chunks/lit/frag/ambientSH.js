/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientSHPS = /* glsl */`
uniform vec3 ambientSH[9];

void addAmbient() {
    vec3 n = cubeMapRotate(dNormalW);

    vec3 color =
        ambientSH[0] +
        ambientSH[1] * n.x +
        ambientSH[2] * n.y +
        ambientSH[3] * n.z +
        ambientSH[4] * n.x * n.z +
        ambientSH[5] * n.z * n.y +
        ambientSH[6] * n.y * n.x +
        ambientSH[7] * (3.0 * n.z * n.z - 1.0) +
        ambientSH[8] * (n.x * n.x - n.y * n.y);

    dDiffuseLight += processEnvironment(max(color, vec3(0.0)));
}
`;

export { ambientSHPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1iaWVudFNILmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW1iaWVudFNILmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHZlYzMgYW1iaWVudFNIWzldO1xuXG52b2lkIGFkZEFtYmllbnQoKSB7XG4gICAgdmVjMyBuID0gY3ViZU1hcFJvdGF0ZShkTm9ybWFsVyk7XG5cbiAgICB2ZWMzIGNvbG9yID1cbiAgICAgICAgYW1iaWVudFNIWzBdICtcbiAgICAgICAgYW1iaWVudFNIWzFdICogbi54ICtcbiAgICAgICAgYW1iaWVudFNIWzJdICogbi55ICtcbiAgICAgICAgYW1iaWVudFNIWzNdICogbi56ICtcbiAgICAgICAgYW1iaWVudFNIWzRdICogbi54ICogbi56ICtcbiAgICAgICAgYW1iaWVudFNIWzVdICogbi56ICogbi55ICtcbiAgICAgICAgYW1iaWVudFNIWzZdICogbi55ICogbi54ICtcbiAgICAgICAgYW1iaWVudFNIWzddICogKDMuMCAqIG4ueiAqIG4ueiAtIDEuMCkgK1xuICAgICAgICBhbWJpZW50U0hbOF0gKiAobi54ICogbi54IC0gbi55ICogbi55KTtcblxuICAgIGREaWZmdXNlTGlnaHQgKz0gcHJvY2Vzc0Vudmlyb25tZW50KG1heChjb2xvciwgdmVjMygwLjApKSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsa0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
