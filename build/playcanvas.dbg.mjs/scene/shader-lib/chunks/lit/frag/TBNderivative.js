var TBNderivativePS = /* glsl */`
uniform float tbnBasis;

// http://www.thetenthplanet.de/archives/1180
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    vec2 uv = $UV;

    // get edge vectors of the pixel triangle
    vec3 dp1 = dFdx( vPositionW );
    vec3 dp2 = dFdy( vPositionW );
    vec2 duv1 = dFdx( uv );
    vec2 duv2 = dFdy( uv );

    // solve the linear system
    vec3 dp2perp = cross( dp2, normal );
    vec3 dp1perp = cross( normal, dp1 );
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    float denom = max( dot(T,T), dot(B,B) );
    float invmax = (denom == 0.0) ? 0.0 : tbnBasis / sqrt( denom );
    dTBN = mat3(T * invmax, -B * invmax, normal );
}
`;

export { TBNderivativePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOZGVyaXZhdGl2ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL1RCTmRlcml2YXRpdmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgdGJuQmFzaXM7XG5cbi8vIGh0dHA6Ly93d3cudGhldGVudGhwbGFuZXQuZGUvYXJjaGl2ZXMvMTE4MFxudm9pZCBnZXRUQk4odmVjMyB0YW5nZW50LCB2ZWMzIGJpbm9ybWFsLCB2ZWMzIG5vcm1hbCkge1xuICAgIHZlYzIgdXYgPSAkVVY7XG5cbiAgICAvLyBnZXQgZWRnZSB2ZWN0b3JzIG9mIHRoZSBwaXhlbCB0cmlhbmdsZVxuICAgIHZlYzMgZHAxID0gZEZkeCggdlBvc2l0aW9uVyApO1xuICAgIHZlYzMgZHAyID0gZEZkeSggdlBvc2l0aW9uVyApO1xuICAgIHZlYzIgZHV2MSA9IGRGZHgoIHV2ICk7XG4gICAgdmVjMiBkdXYyID0gZEZkeSggdXYgKTtcblxuICAgIC8vIHNvbHZlIHRoZSBsaW5lYXIgc3lzdGVtXG4gICAgdmVjMyBkcDJwZXJwID0gY3Jvc3MoIGRwMiwgbm9ybWFsICk7XG4gICAgdmVjMyBkcDFwZXJwID0gY3Jvc3MoIG5vcm1hbCwgZHAxICk7XG4gICAgdmVjMyBUID0gZHAycGVycCAqIGR1djEueCArIGRwMXBlcnAgKiBkdXYyLng7XG4gICAgdmVjMyBCID0gZHAycGVycCAqIGR1djEueSArIGRwMXBlcnAgKiBkdXYyLnk7XG5cbiAgICAvLyBjb25zdHJ1Y3QgYSBzY2FsZS1pbnZhcmlhbnQgZnJhbWVcbiAgICBmbG9hdCBkZW5vbSA9IG1heCggZG90KFQsVCksIGRvdChCLEIpICk7XG4gICAgZmxvYXQgaW52bWF4ID0gKGRlbm9tID09IDAuMCkgPyAwLjAgOiB0Ym5CYXNpcyAvIHNxcnQoIGRlbm9tICk7XG4gICAgZFRCTiA9IG1hdDMoVCAqIGludm1heCwgLUIgKiBpbnZtYXgsIG5vcm1hbCApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxzQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
