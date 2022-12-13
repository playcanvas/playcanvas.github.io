/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOZGVyaXZhdGl2ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL1RCTmRlcml2YXRpdmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgdGJuQmFzaXM7XG5cbi8vIGh0dHA6Ly93d3cudGhldGVudGhwbGFuZXQuZGUvYXJjaGl2ZXMvMTE4MFxudm9pZCBnZXRUQk4oKSB7XG4gICAgdmVjMiB1diA9ICRVVjtcblxuICAgIC8vIGdldCBlZGdlIHZlY3RvcnMgb2YgdGhlIHBpeGVsIHRyaWFuZ2xlXG4gICAgdmVjMyBkcDEgPSBkRmR4KCB2UG9zaXRpb25XICk7XG4gICAgdmVjMyBkcDIgPSBkRmR5KCB2UG9zaXRpb25XICk7XG4gICAgdmVjMiBkdXYxID0gZEZkeCggdXYgKTtcbiAgICB2ZWMyIGR1djIgPSBkRmR5KCB1diApO1xuXG4gICAgLy8gc29sdmUgdGhlIGxpbmVhciBzeXN0ZW1cbiAgICB2ZWMzIGRwMnBlcnAgPSBjcm9zcyggZHAyLCBkVmVydGV4Tm9ybWFsVyApO1xuICAgIHZlYzMgZHAxcGVycCA9IGNyb3NzKCBkVmVydGV4Tm9ybWFsVywgZHAxICk7XG4gICAgdmVjMyBUID0gZHAycGVycCAqIGR1djEueCArIGRwMXBlcnAgKiBkdXYyLng7XG4gICAgdmVjMyBCID0gZHAycGVycCAqIGR1djEueSArIGRwMXBlcnAgKiBkdXYyLnk7XG5cbiAgICAvLyBjb25zdHJ1Y3QgYSBzY2FsZS1pbnZhcmlhbnQgZnJhbWVcbiAgICBmbG9hdCBkZW5vbSA9IG1heCggZG90KFQsVCksIGRvdChCLEIpICk7XG4gICAgZmxvYXQgaW52bWF4ID0gKGRlbm9tID09IDAuMCkgPyAwLjAgOiB0Ym5CYXNpcyAvIHNxcnQoIGRlbm9tICk7XG4gICAgZFRCTiA9IG1hdDMoVCAqIGludm1heCwgLUIgKiBpbnZtYXgsIGRWZXJ0ZXhOb3JtYWxXICk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsc0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
