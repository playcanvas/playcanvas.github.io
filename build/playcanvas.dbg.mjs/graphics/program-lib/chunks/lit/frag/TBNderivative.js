/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var TBNderivativePS = `
uniform float tbnBasis;

// http://www.thetenthplanet.de/archives/1180
void getTBN() {
    vec2 uv = $UV;

    // get edge vectors of the pixel triangle
    vec3 dp1 = dFdx( vPositionW );
    vec3 dp2 = dFdy( vPositionW );
    vec2 duv1 = dFdx( uv );
    vec2 duv2 = dFdy( uv );

    // solve the linear system
    vec3 dp2perp = cross( dp2, dVertexNormalW );
    vec3 dp1perp = cross( dVertexNormalW, dp1 );
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    float denom = max( dot(T,T), dot(B,B) );
    float invmax = (denom == 0.0) ? 0.0 : tbnBasis / sqrt( denom );
    dTBN = mat3(T * invmax, -B * invmax, dVertexNormalW );
}
`;

export { TBNderivativePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOZGVyaXZhdGl2ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9UQk5kZXJpdmF0aXZlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IHRibkJhc2lzO1xuXG4vLyBodHRwOi8vd3d3LnRoZXRlbnRocGxhbmV0LmRlL2FyY2hpdmVzLzExODBcbnZvaWQgZ2V0VEJOKCkge1xuICAgIHZlYzIgdXYgPSAkVVY7XG5cbiAgICAvLyBnZXQgZWRnZSB2ZWN0b3JzIG9mIHRoZSBwaXhlbCB0cmlhbmdsZVxuICAgIHZlYzMgZHAxID0gZEZkeCggdlBvc2l0aW9uVyApO1xuICAgIHZlYzMgZHAyID0gZEZkeSggdlBvc2l0aW9uVyApO1xuICAgIHZlYzIgZHV2MSA9IGRGZHgoIHV2ICk7XG4gICAgdmVjMiBkdXYyID0gZEZkeSggdXYgKTtcblxuICAgIC8vIHNvbHZlIHRoZSBsaW5lYXIgc3lzdGVtXG4gICAgdmVjMyBkcDJwZXJwID0gY3Jvc3MoIGRwMiwgZFZlcnRleE5vcm1hbFcgKTtcbiAgICB2ZWMzIGRwMXBlcnAgPSBjcm9zcyggZFZlcnRleE5vcm1hbFcsIGRwMSApO1xuICAgIHZlYzMgVCA9IGRwMnBlcnAgKiBkdXYxLnggKyBkcDFwZXJwICogZHV2Mi54O1xuICAgIHZlYzMgQiA9IGRwMnBlcnAgKiBkdXYxLnkgKyBkcDFwZXJwICogZHV2Mi55O1xuXG4gICAgLy8gY29uc3RydWN0IGEgc2NhbGUtaW52YXJpYW50IGZyYW1lXG4gICAgZmxvYXQgZGVub20gPSBtYXgoIGRvdChULFQpLCBkb3QoQixCKSApO1xuICAgIGZsb2F0IGludm1heCA9IChkZW5vbSA9PSAwLjApID8gMC4wIDogdGJuQmFzaXMgLyBzcXJ0KCBkZW5vbSApO1xuICAgIGRUQk4gPSBtYXQzKFQgKiBpbnZtYXgsIC1CICogaW52bWF4LCBkVmVydGV4Tm9ybWFsVyApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXhCQTs7OzsifQ==
