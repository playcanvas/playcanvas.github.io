/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingFilmicPS = `
const float A =  0.15;
const float B =  0.50;
const float C =  0.10;
const float D =  0.20;
const float E =  0.02;
const float F =  0.30;
const float W =  11.2;

uniform float exposure;

vec3 uncharted2Tonemap(vec3 x) {
   return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 toneMap(vec3 color) {
    color = uncharted2Tonemap(color * exposure);
    vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W,W,W));
    color = color * whiteScale;

    return color;
}
`;

export { tonemappingFilmicPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdGaWxtaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvdG9uZW1hcHBpbmdGaWxtaWMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmNvbnN0IGZsb2F0IEEgPSAgMC4xNTtcbmNvbnN0IGZsb2F0IEIgPSAgMC41MDtcbmNvbnN0IGZsb2F0IEMgPSAgMC4xMDtcbmNvbnN0IGZsb2F0IEQgPSAgMC4yMDtcbmNvbnN0IGZsb2F0IEUgPSAgMC4wMjtcbmNvbnN0IGZsb2F0IEYgPSAgMC4zMDtcbmNvbnN0IGZsb2F0IFcgPSAgMTEuMjtcblxudW5pZm9ybSBmbG9hdCBleHBvc3VyZTtcblxudmVjMyB1bmNoYXJ0ZWQyVG9uZW1hcCh2ZWMzIHgpIHtcbiAgIHJldHVybiAoKHgqKEEqeCtDKkIpK0QqRSkvKHgqKEEqeCtCKStEKkYpKS1FL0Y7XG59XG5cbnZlYzMgdG9uZU1hcCh2ZWMzIGNvbG9yKSB7XG4gICAgY29sb3IgPSB1bmNoYXJ0ZWQyVG9uZW1hcChjb2xvciAqIGV4cG9zdXJlKTtcbiAgICB2ZWMzIHdoaXRlU2NhbGUgPSAxLjAgLyB1bmNoYXJ0ZWQyVG9uZW1hcCh2ZWMzKFcsVyxXKSk7XG4gICAgY29sb3IgPSBjb2xvciAqIHdoaXRlU2NhbGU7XG5cbiAgICByZXR1cm4gY29sb3I7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F0QkE7Ozs7In0=
