/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingAces2PS = `
uniform float exposure;

// ACES approximation by Stephen Hill

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 ACESInputMat = mat3(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutputMat = mat3(
     1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
);

vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

vec3 toneMap(vec3 color) {
    color *= exposure;
    color = color * ACESInputMat;

    // Apply RRT and ODT
    color = RRTAndODTFit(color);
    color = color * ACESOutputMat;

    // Clamp to [0, 1]
    color = clamp(color, 0.0, 1.0);

    return color;
}
`;

export { tonemappingAces2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdBY2VzMi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jb21tb24vZnJhZy90b25lbWFwcGluZ0FjZXMyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IGV4cG9zdXJlO1xuXG4vLyBBQ0VTIGFwcHJveGltYXRpb24gYnkgU3RlcGhlbiBIaWxsXG5cbi8vIHNSR0IgPT4gWFlaID0+IEQ2NV8yX0Q2MCA9PiBBUDEgPT4gUlJUX1NBVFxuY29uc3QgbWF0MyBBQ0VTSW5wdXRNYXQgPSBtYXQzKFxuICAgIDAuNTk3MTksIDAuMzU0NTgsIDAuMDQ4MjMsXG4gICAgMC4wNzYwMCwgMC45MDgzNCwgMC4wMTU2NixcbiAgICAwLjAyODQwLCAwLjEzMzgzLCAwLjgzNzc3XG4pO1xuXG4vLyBPRFRfU0FUID0+IFhZWiA9PiBENjBfMl9ENjUgPT4gc1JHQlxuY29uc3QgbWF0MyBBQ0VTT3V0cHV0TWF0ID0gbWF0MyhcbiAgICAgMS42MDQ3NSwgLTAuNTMxMDgsIC0wLjA3MzY3LFxuICAgIC0wLjEwMjA4LCAgMS4xMDgxMywgLTAuMDA2MDUsXG4gICAgLTAuMDAzMjcsIC0wLjA3Mjc2LCAgMS4wNzYwMlxuKTtcblxudmVjMyBSUlRBbmRPRFRGaXQodmVjMyB2KSB7XG4gICAgdmVjMyBhID0gdiAqICh2ICsgMC4wMjQ1Nzg2KSAtIDAuMDAwMDkwNTM3O1xuICAgIHZlYzMgYiA9IHYgKiAoMC45ODM3MjkgKiB2ICsgMC40MzI5NTEwKSArIDAuMjM4MDgxO1xuICAgIHJldHVybiBhIC8gYjtcbn1cblxudmVjMyB0b25lTWFwKHZlYzMgY29sb3IpIHtcbiAgICBjb2xvciAqPSBleHBvc3VyZTtcbiAgICBjb2xvciA9IGNvbG9yICogQUNFU0lucHV0TWF0O1xuXG4gICAgLy8gQXBwbHkgUlJUIGFuZCBPRFRcbiAgICBjb2xvciA9IFJSVEFuZE9EVEZpdChjb2xvcik7XG4gICAgY29sb3IgPSBjb2xvciAqIEFDRVNPdXRwdXRNYXQ7XG5cbiAgICAvLyBDbGFtcCB0byBbMCwgMV1cbiAgICBjb2xvciA9IGNsYW1wKGNvbG9yLCAwLjAsIDEuMCk7XG5cbiAgICByZXR1cm4gY29sb3I7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXRDQTs7OzsifQ==