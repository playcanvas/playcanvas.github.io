/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var ltc = `
// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// code: https://github.com/selfshadow/ltc_code/

mat3 transposeMat3( const in mat3 m ) {
    mat3 tmp;
    tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
    tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
    tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
    return tmp;
}

vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
    const float LUT_SIZE = 64.0;
    const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
    const float LUT_BIAS = 0.5 / LUT_SIZE;
    float dotNV = saturate( dot( N, V ) );
    // texture parameterized by sqrt( GGX alpha ) and sqrt( 1 - cos( theta ) )
    vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
    uv = uv * LUT_SCALE + LUT_BIAS;
    return uv;
}

float LTC_ClippedSphereFormFactor( const in vec3 f ) {
    // Real-Time Area Lighting: a Journey from Research to Production (p.102)
    // An approximation of the form factor of a horizon-clipped rectangle.
    float l = length( f );
    return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}

vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
    float x = dot( v1, v2 );
    float y = abs( x );
    // rational polynomial approximation to theta / sin( theta ) / 2PI
    float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
    float b = 3.4175940 + ( 4.1616724 + y ) * y;
    float v = a / b;
    float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
    return cross( v1, v2 ) * theta_sintheta;
}

struct Coords {
    vec3 coord0;
    vec3 coord1;
    vec3 coord2;
    vec3 coord3;
};

float LTC_EvaluateRect( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in Coords rectCoords) {
    // bail if point is on back side of plane of light
    // assumes ccw winding order of light vertices
    vec3 v1 = rectCoords.coord1 - rectCoords.coord0;
    vec3 v2 = rectCoords.coord3 - rectCoords.coord0;
    
    vec3 lightNormal = cross( v1, v2 );
    // if( dot( lightNormal, P - rectCoords.coord0 ) < 0.0 ) return 0.0;
    float factor = sign(-dot( lightNormal, P - rectCoords.coord0 ));

    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize( V - N * dot( V, N ) );
    T2 =  factor * cross( N, T1 ); // negated from paper; possibly due to a different handedness of world coordinate system
    // compute transform
    mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
    // transform rect
    vec3 coords[ 4 ];
    coords[ 0 ] = mat * ( rectCoords.coord0 - P );
    coords[ 1 ] = mat * ( rectCoords.coord1 - P );
    coords[ 2 ] = mat * ( rectCoords.coord2 - P );
    coords[ 3 ] = mat * ( rectCoords.coord3 - P );
    // project rect onto sphere
    coords[ 0 ] = normalize( coords[ 0 ] );
    coords[ 1 ] = normalize( coords[ 1 ] );
    coords[ 2 ] = normalize( coords[ 2 ] );
    coords[ 3 ] = normalize( coords[ 3 ] );
    // calculate vector form factor
    vec3 vectorFormFactor = vec3( 0.0 );
    vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
    vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
    vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
    vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
    // adjust for horizon clipping
    float result = LTC_ClippedSphereFormFactor( vectorFormFactor );

    return result;
}

Coords dLTCCoords;
Coords getLTCLightCoords(vec3 lightPos, vec3 halfWidth, vec3 halfHeight){
    Coords coords;
    coords.coord0 = lightPos + halfWidth - halfHeight;
    coords.coord1 = lightPos - halfWidth - halfHeight;
    coords.coord2 = lightPos - halfWidth + halfHeight;
    coords.coord3 = lightPos + halfWidth + halfHeight;
    return coords;
}

float dSphereRadius;
Coords getSphereLightCoords(vec3 lightPos, vec3 halfWidth, vec3 halfHeight){
    // used for simple sphere light falloff
    // also, the code only handles a spherical light, it cannot be non-uniformly scaled in world space, and so we enforce it here
    dSphereRadius = max(length(halfWidth), length(halfHeight));

    // Billboard the 2d light quad to reflection vector, as it's used for specular. This allows us to use disk math for the sphere.
    vec3 f = reflect(normalize(lightPos - view_position), vNormalW);
    vec3 w = normalize(cross(f, halfHeight));
    vec3 h = normalize(cross(f, w));

    return getLTCLightCoords(lightPos, w * dSphereRadius, h * dSphereRadius);
}

// used for LTC LUT texture lookup
vec2 dLTCUV;
#ifdef LIT_CLEARCOAT
vec2 ccLTCUV;
#endif
vec2 getLTCLightUV(float tGlossiness, vec3 tNormalW)
{
    float roughness = max((1.0 - tGlossiness) * (1.0 - tGlossiness), 0.001);
    return LTC_Uv( tNormalW, dViewDirW, roughness );
}

//used for energy conservation and to modulate specular
vec3 dLTCSpecFres;
#ifdef LIT_CLEARCOAT
vec3 ccLTCSpecFres;
#endif
vec3 getLTCLightSpecFres(vec2 uv, vec3 tSpecularity)
{
    vec4 t2 = texture2DLodEXT(areaLightsLutTex2, uv, 0.0);

    #ifdef AREA_R8_G8_B8_A8_LUTS
    t2 *= vec4(0.693103,1,1,1);
    t2 += vec4(0.306897,0,0,0);
    #endif

    return tSpecularity * t2.x + ( vec3( 1.0 ) - tSpecularity) * t2.y;
}

void calcLTCLightValues()
{
    dLTCUV = getLTCLightUV(dGlossiness, dNormalW);
    dLTCSpecFres = getLTCLightSpecFres(dLTCUV, dSpecularity); 

#ifdef LIT_CLEARCOAT
    ccLTCUV = getLTCLightUV(ccGlossiness, ccNormalW);
    ccLTCSpecFres = getLTCLightSpecFres(ccLTCUV, vec3(ccSpecularity));
#endif
}

void calcRectLightValues(vec3 lightPos, vec3 halfWidth, vec3 halfHeight)
{
    dLTCCoords = getLTCLightCoords(lightPos, halfWidth, halfHeight);
}
void calcDiskLightValues(vec3 lightPos, vec3 halfWidth, vec3 halfHeight)
{
    calcRectLightValues(lightPos, halfWidth, halfHeight);
}
void calcSphereLightValues(vec3 lightPos, vec3 halfWidth, vec3 halfHeight)
{
    dLTCCoords = getSphereLightCoords(lightPos, halfWidth, halfHeight);
}

// An extended version of the implementation from
// "How to solve a cubic equation, revisited"
// http://momentsingraphics.de/?p=105
vec3 SolveCubic(vec4 Coefficient)
{
    float pi = 3.14159;
    // Normalize the polynomial
    Coefficient.xyz /= Coefficient.w;
    // Divide middle coefficients by three
    Coefficient.yz /= 3.0;

    float A = Coefficient.w;
    float B = Coefficient.z;
    float C = Coefficient.y;
    float D = Coefficient.x;

    // Compute the Hessian and the discriminant
    vec3 Delta = vec3(
        -Coefficient.z * Coefficient.z + Coefficient.y,
        -Coefficient.y * Coefficient.z + Coefficient.x,
        dot(vec2(Coefficient.z, -Coefficient.y), Coefficient.xy)
    );

    float Discriminant = dot(vec2(4.0 * Delta.x, -Delta.y), Delta.zy);

    vec3 RootsA, RootsD;

    vec2 xlc, xsc;

    // Algorithm A
    {
        float A_a = 1.0;
        float C_a = Delta.x;
        float D_a = -2.0 * B * Delta.x + Delta.y;

        // Take the cubic root of a normalized complex number
        float Theta = atan(sqrt(Discriminant), -D_a) / 3.0;

        float x_1a = 2.0 * sqrt(-C_a) * cos(Theta);
        float x_3a = 2.0 * sqrt(-C_a) * cos(Theta + (2.0 / 3.0) * pi);

        float xl;
        if ((x_1a + x_3a) > 2.0 * B)
            xl = x_1a;
        else
            xl = x_3a;

        xlc = vec2(xl - B, A);
    }

    // Algorithm D
    {
        float A_d = D;
        float C_d = Delta.z;
        float D_d = -D * Delta.y + 2.0 * C * Delta.z;

        // Take the cubic root of a normalized complex number
        float Theta = atan(D * sqrt(Discriminant), -D_d) / 3.0;

        float x_1d = 2.0 * sqrt(-C_d) * cos(Theta);
        float x_3d = 2.0 * sqrt(-C_d) * cos(Theta + (2.0 / 3.0) * pi);

        float xs;
        if (x_1d + x_3d < 2.0 * C)
            xs = x_1d;
        else
            xs = x_3d;

        xsc = vec2(-D, xs + C);
    }

    float E =  xlc.y * xsc.y;
    float F = -xlc.x * xsc.y - xlc.y * xsc.x;
    float G =  xlc.x * xsc.x;

    vec2 xmc = vec2(C * F - B * G, -B * F + C * E);

    vec3 Root = vec3(xsc.x / xsc.y, xmc.x / xmc.y, xlc.x / xlc.y);

    if (Root.x < Root.y && Root.x < Root.z)
        Root.xyz = Root.yxz;
    else if (Root.z < Root.x && Root.z < Root.y)
        Root.xyz = Root.xzy;

    return Root;
}

float LTC_EvaluateDisk(vec3 N, vec3 V, vec3 P, mat3 Minv, Coords points)
{
    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N * dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, N) basis
    //mat3 R = transpose(mat3(T1, T2, N));
    mat3 R = transposeMat3( mat3( T1, T2, N ) );
    // polygon (allocate 5 vertices for clipping)
    vec3 L_[ 3 ];
    L_[ 0 ] = R * ( points.coord0 - P );
    L_[ 1 ] = R * ( points.coord1 - P );
    L_[ 2 ] = R * ( points.coord2 - P );

    vec3 Lo_i = vec3(0);

    // init ellipse
    vec3 C  = 0.5 * (L_[0] + L_[2]);
    vec3 V1 = 0.5 * (L_[1] - L_[2]);
    vec3 V2 = 0.5 * (L_[1] - L_[0]);

    C  = Minv * C;
    V1 = Minv * V1;
    V2 = Minv * V2;

    //if(dot(cross(V1, V2), C) > 0.0)
    //    return 0.0;

    // compute eigenvectors of ellipse
    float a, b;
    float d11 = dot(V1, V1);
    float d22 = dot(V2, V2);
    float d12 = dot(V1, V2);
    if (abs(d12) / sqrt(d11 * d22) > 0.0001)
    {
        float tr = d11 + d22;
        float det = -d12 * d12 + d11 * d22;

        // use sqrt matrix to solve for eigenvalues
        det = sqrt(det);
        float u = 0.5 * sqrt(tr - 2.0 * det);
        float v = 0.5 * sqrt(tr + 2.0 * det);
        float e_max = (u + v) * (u + v);
        float e_min = (u - v) * (u - v);

        vec3 V1_, V2_;

        if (d11 > d22)
        {
            V1_ = d12 * V1 + (e_max - d11) * V2;
            V2_ = d12 * V1 + (e_min - d11) * V2;
        }
        else
        {
            V1_ = d12*V2 + (e_max - d22)*V1;
            V2_ = d12*V2 + (e_min - d22)*V1;
        }

        a = 1.0 / e_max;
        b = 1.0 / e_min;
        V1 = normalize(V1_);
        V2 = normalize(V2_);
    }
    else
    {
        a = 1.0 / dot(V1, V1);
        b = 1.0 / dot(V2, V2);
        V1 *= sqrt(a);
        V2 *= sqrt(b);
    }

    vec3 V3 = cross(V1, V2);
    if (dot(C, V3) < 0.0)
        V3 *= -1.0;

    float L  = dot(V3, C);
    float x0 = dot(V1, C) / L;
    float y0 = dot(V2, C) / L;

    float E1 = inversesqrt(a);
    float E2 = inversesqrt(b);

    a *= L * L;
    b *= L * L;

    float c0 = a * b;
    float c1 = a * b * (1.0 + x0 * x0 + y0 * y0) - a - b;
    float c2 = 1.0 - a * (1.0 + x0 * x0) - b * (1.0 + y0 * y0);
    float c3 = 1.0;

    vec3 roots = SolveCubic(vec4(c0, c1, c2, c3));
    float e1 = roots.x;
    float e2 = roots.y;
    float e3 = roots.z;

    vec3 avgDir = vec3(a * x0 / (a - e2), b * y0 / (b - e2), 1.0);

    mat3 rotate = mat3(V1, V2, V3);

    avgDir = rotate * avgDir;
    avgDir = normalize(avgDir);

    float L1 = sqrt(-e2 / e3);
    float L2 = sqrt(-e2 / e1);

    float formFactor = L1 * L2 * inversesqrt((1.0 + L1 * L1) * (1.0 + L2 * L2));
    
    const float LUT_SIZE = 64.0;
    const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
    const float LUT_BIAS = 0.5 / LUT_SIZE;

    // use tabulated horizon-clipped sphere
    vec2 uv = vec2(avgDir.z * 0.5 + 0.5, formFactor);
    uv = uv*LUT_SCALE + LUT_BIAS;

    float scale = texture2DLodEXT(areaLightsLutTex2, uv, 0.0).w;

    return formFactor*scale;
}

float getRectLightDiffuse() {
    return LTC_EvaluateRect( dNormalW, dViewDirW, vPositionW, mat3( 1.0 ), dLTCCoords );
}

float getDiskLightDiffuse() {
    return LTC_EvaluateDisk( dNormalW, dViewDirW, vPositionW, mat3( 1.0 ), dLTCCoords );
}

float getSphereLightDiffuse() {
    // NB: this could be improved further with distance based wrap lighting
    float falloff = dSphereRadius / (dot(dLightDirW, dLightDirW) + dSphereRadius);
    return getLightDiffuse()*falloff;
}

mat3 getLTCLightInvMat(vec2 uv)
{
    vec4 t1 = texture2DLodEXT(areaLightsLutTex1, uv, 0.0);

    #ifdef AREA_R8_G8_B8_A8_LUTS
    t1 *= vec4(1.001, 0.3239, 0.60437568, 1.0);
    t1 += vec4(0.0, -0.2976, -0.01381, 0.0);
    #endif

    return mat3(
        vec3( t1.x, 0, t1.y ),
        vec3(    0, 1,    0 ),
        vec3( t1.z, 0, t1.w )
    );
}

float calcRectLightSpecular(vec3 tNormalW, vec2 uv) {
    mat3 mInv = getLTCLightInvMat(uv);
    return LTC_EvaluateRect( tNormalW, dViewDirW, vPositionW, mInv, dLTCCoords );
}

float getRectLightSpecular() {
    return calcRectLightSpecular(dNormalW, dLTCUV);
}

#ifdef LIT_CLEARCOAT
float getRectLightSpecularCC() {
    return calcRectLightSpecular(ccNormalW, ccLTCUV);
}
#endif

float calcDiskLightSpecular(vec3 tNormalW, vec2 uv) {
    mat3 mInv = getLTCLightInvMat(uv);
    return LTC_EvaluateDisk( tNormalW, dViewDirW, vPositionW, mInv, dLTCCoords );
}

float getDiskLightSpecular() {
    return calcDiskLightSpecular(dNormalW, dLTCUV);
}

#ifdef LIT_CLEARCOAT
float getDiskLightSpecularCC() {
    return calcDiskLightSpecular(ccNormalW, ccLTCUV);
}
#endif

float getSphereLightSpecular() {
    return calcDiskLightSpecular(dNormalW, dLTCUV);
}

#ifdef LIT_CLEARCOAT
float getSphereLightSpecularCC() {
    return calcDiskLightSpecular(ccNormalW, ccLTCUV);
}
#endif
`;

export { ltc as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHRjLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbHRjLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBSZWFsLVRpbWUgUG9seWdvbmFsLUxpZ2h0IFNoYWRpbmcgd2l0aCBMaW5lYXJseSBUcmFuc2Zvcm1lZCBDb3NpbmVzXG4vLyBieSBFcmljIEhlaXR6LCBKb25hdGhhbiBEdXB1eSwgU3RlcGhlbiBIaWxsIGFuZCBEYXZpZCBOZXViZWx0XG4vLyBjb2RlOiBodHRwczovL2dpdGh1Yi5jb20vc2VsZnNoYWRvdy9sdGNfY29kZS9cblxubWF0MyB0cmFuc3Bvc2VNYXQzKCBjb25zdCBpbiBtYXQzIG0gKSB7XG4gICAgbWF0MyB0bXA7XG4gICAgdG1wWyAwIF0gPSB2ZWMzKCBtWyAwIF0ueCwgbVsgMSBdLngsIG1bIDIgXS54ICk7XG4gICAgdG1wWyAxIF0gPSB2ZWMzKCBtWyAwIF0ueSwgbVsgMSBdLnksIG1bIDIgXS55ICk7XG4gICAgdG1wWyAyIF0gPSB2ZWMzKCBtWyAwIF0ueiwgbVsgMSBdLnosIG1bIDIgXS56ICk7XG4gICAgcmV0dXJuIHRtcDtcbn1cblxudmVjMiBMVENfVXYoIGNvbnN0IGluIHZlYzMgTiwgY29uc3QgaW4gdmVjMyBWLCBjb25zdCBpbiBmbG9hdCByb3VnaG5lc3MgKSB7XG4gICAgY29uc3QgZmxvYXQgTFVUX1NJWkUgPSA2NC4wO1xuICAgIGNvbnN0IGZsb2F0IExVVF9TQ0FMRSA9ICggTFVUX1NJWkUgLSAxLjAgKSAvIExVVF9TSVpFO1xuICAgIGNvbnN0IGZsb2F0IExVVF9CSUFTID0gMC41IC8gTFVUX1NJWkU7XG4gICAgZmxvYXQgZG90TlYgPSBzYXR1cmF0ZSggZG90KCBOLCBWICkgKTtcbiAgICAvLyB0ZXh0dXJlIHBhcmFtZXRlcml6ZWQgYnkgc3FydCggR0dYIGFscGhhICkgYW5kIHNxcnQoIDEgLSBjb3MoIHRoZXRhICkgKVxuICAgIHZlYzIgdXYgPSB2ZWMyKCByb3VnaG5lc3MsIHNxcnQoIDEuMCAtIGRvdE5WICkgKTtcbiAgICB1diA9IHV2ICogTFVUX1NDQUxFICsgTFVUX0JJQVM7XG4gICAgcmV0dXJuIHV2O1xufVxuXG5mbG9hdCBMVENfQ2xpcHBlZFNwaGVyZUZvcm1GYWN0b3IoIGNvbnN0IGluIHZlYzMgZiApIHtcbiAgICAvLyBSZWFsLVRpbWUgQXJlYSBMaWdodGluZzogYSBKb3VybmV5IGZyb20gUmVzZWFyY2ggdG8gUHJvZHVjdGlvbiAocC4xMDIpXG4gICAgLy8gQW4gYXBwcm94aW1hdGlvbiBvZiB0aGUgZm9ybSBmYWN0b3Igb2YgYSBob3Jpem9uLWNsaXBwZWQgcmVjdGFuZ2xlLlxuICAgIGZsb2F0IGwgPSBsZW5ndGgoIGYgKTtcbiAgICByZXR1cm4gbWF4KCAoIGwgKiBsICsgZi56ICkgLyAoIGwgKyAxLjAgKSwgMC4wICk7XG59XG5cbnZlYzMgTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb25zdCBpbiB2ZWMzIHYxLCBjb25zdCBpbiB2ZWMzIHYyICkge1xuICAgIGZsb2F0IHggPSBkb3QoIHYxLCB2MiApO1xuICAgIGZsb2F0IHkgPSBhYnMoIHggKTtcbiAgICAvLyByYXRpb25hbCBwb2x5bm9taWFsIGFwcHJveGltYXRpb24gdG8gdGhldGEgLyBzaW4oIHRoZXRhICkgLyAyUElcbiAgICBmbG9hdCBhID0gMC44NTQzOTg1ICsgKCAwLjQ5NjUxNTUgKyAwLjAxNDUyMDYgKiB5ICkgKiB5O1xuICAgIGZsb2F0IGIgPSAzLjQxNzU5NDAgKyAoIDQuMTYxNjcyNCArIHkgKSAqIHk7XG4gICAgZmxvYXQgdiA9IGEgLyBiO1xuICAgIGZsb2F0IHRoZXRhX3NpbnRoZXRhID0gKCB4ID4gMC4wICkgPyB2IDogMC41ICogaW52ZXJzZXNxcnQoIG1heCggMS4wIC0geCAqIHgsIDFlLTcgKSApIC0gdjtcbiAgICByZXR1cm4gY3Jvc3MoIHYxLCB2MiApICogdGhldGFfc2ludGhldGE7XG59XG5cbnN0cnVjdCBDb29yZHMge1xuICAgIHZlYzMgY29vcmQwO1xuICAgIHZlYzMgY29vcmQxO1xuICAgIHZlYzMgY29vcmQyO1xuICAgIHZlYzMgY29vcmQzO1xufTtcblxuZmxvYXQgTFRDX0V2YWx1YXRlUmVjdCggY29uc3QgaW4gdmVjMyBOLCBjb25zdCBpbiB2ZWMzIFYsIGNvbnN0IGluIHZlYzMgUCwgY29uc3QgaW4gbWF0MyBtSW52LCBjb25zdCBpbiBDb29yZHMgcmVjdENvb3Jkcykge1xuICAgIC8vIGJhaWwgaWYgcG9pbnQgaXMgb24gYmFjayBzaWRlIG9mIHBsYW5lIG9mIGxpZ2h0XG4gICAgLy8gYXNzdW1lcyBjY3cgd2luZGluZyBvcmRlciBvZiBsaWdodCB2ZXJ0aWNlc1xuICAgIHZlYzMgdjEgPSByZWN0Q29vcmRzLmNvb3JkMSAtIHJlY3RDb29yZHMuY29vcmQwO1xuICAgIHZlYzMgdjIgPSByZWN0Q29vcmRzLmNvb3JkMyAtIHJlY3RDb29yZHMuY29vcmQwO1xuICAgIFxuICAgIHZlYzMgbGlnaHROb3JtYWwgPSBjcm9zcyggdjEsIHYyICk7XG4gICAgLy8gaWYoIGRvdCggbGlnaHROb3JtYWwsIFAgLSByZWN0Q29vcmRzLmNvb3JkMCApIDwgMC4wICkgcmV0dXJuIDAuMDtcbiAgICBmbG9hdCBmYWN0b3IgPSBzaWduKC1kb3QoIGxpZ2h0Tm9ybWFsLCBQIC0gcmVjdENvb3Jkcy5jb29yZDAgKSk7XG5cbiAgICAvLyBjb25zdHJ1Y3Qgb3J0aG9ub3JtYWwgYmFzaXMgYXJvdW5kIE5cbiAgICB2ZWMzIFQxLCBUMjtcbiAgICBUMSA9IG5vcm1hbGl6ZSggViAtIE4gKiBkb3QoIFYsIE4gKSApO1xuICAgIFQyID0gIGZhY3RvciAqIGNyb3NzKCBOLCBUMSApOyAvLyBuZWdhdGVkIGZyb20gcGFwZXI7IHBvc3NpYmx5IGR1ZSB0byBhIGRpZmZlcmVudCBoYW5kZWRuZXNzIG9mIHdvcmxkIGNvb3JkaW5hdGUgc3lzdGVtXG4gICAgLy8gY29tcHV0ZSB0cmFuc2Zvcm1cbiAgICBtYXQzIG1hdCA9IG1JbnYgKiB0cmFuc3Bvc2VNYXQzKCBtYXQzKCBUMSwgVDIsIE4gKSApO1xuICAgIC8vIHRyYW5zZm9ybSByZWN0XG4gICAgdmVjMyBjb29yZHNbIDQgXTtcbiAgICBjb29yZHNbIDAgXSA9IG1hdCAqICggcmVjdENvb3Jkcy5jb29yZDAgLSBQICk7XG4gICAgY29vcmRzWyAxIF0gPSBtYXQgKiAoIHJlY3RDb29yZHMuY29vcmQxIC0gUCApO1xuICAgIGNvb3Jkc1sgMiBdID0gbWF0ICogKCByZWN0Q29vcmRzLmNvb3JkMiAtIFAgKTtcbiAgICBjb29yZHNbIDMgXSA9IG1hdCAqICggcmVjdENvb3Jkcy5jb29yZDMgLSBQICk7XG4gICAgLy8gcHJvamVjdCByZWN0IG9udG8gc3BoZXJlXG4gICAgY29vcmRzWyAwIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMCBdICk7XG4gICAgY29vcmRzWyAxIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMSBdICk7XG4gICAgY29vcmRzWyAyIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMiBdICk7XG4gICAgY29vcmRzWyAzIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMyBdICk7XG4gICAgLy8gY2FsY3VsYXRlIHZlY3RvciBmb3JtIGZhY3RvclxuICAgIHZlYzMgdmVjdG9yRm9ybUZhY3RvciA9IHZlYzMoIDAuMCApO1xuICAgIHZlY3RvckZvcm1GYWN0b3IgKz0gTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb29yZHNbIDAgXSwgY29vcmRzWyAxIF0gKTtcbiAgICB2ZWN0b3JGb3JtRmFjdG9yICs9IExUQ19FZGdlVmVjdG9yRm9ybUZhY3RvciggY29vcmRzWyAxIF0sIGNvb3Jkc1sgMiBdICk7XG4gICAgdmVjdG9yRm9ybUZhY3RvciArPSBMVENfRWRnZVZlY3RvckZvcm1GYWN0b3IoIGNvb3Jkc1sgMiBdLCBjb29yZHNbIDMgXSApO1xuICAgIHZlY3RvckZvcm1GYWN0b3IgKz0gTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb29yZHNbIDMgXSwgY29vcmRzWyAwIF0gKTtcbiAgICAvLyBhZGp1c3QgZm9yIGhvcml6b24gY2xpcHBpbmdcbiAgICBmbG9hdCByZXN1bHQgPSBMVENfQ2xpcHBlZFNwaGVyZUZvcm1GYWN0b3IoIHZlY3RvckZvcm1GYWN0b3IgKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbkNvb3JkcyBkTFRDQ29vcmRzO1xuQ29vcmRzIGdldExUQ0xpZ2h0Q29vcmRzKHZlYzMgbGlnaHRQb3MsIHZlYzMgaGFsZldpZHRoLCB2ZWMzIGhhbGZIZWlnaHQpe1xuICAgIENvb3JkcyBjb29yZHM7XG4gICAgY29vcmRzLmNvb3JkMCA9IGxpZ2h0UG9zICsgaGFsZldpZHRoIC0gaGFsZkhlaWdodDtcbiAgICBjb29yZHMuY29vcmQxID0gbGlnaHRQb3MgLSBoYWxmV2lkdGggLSBoYWxmSGVpZ2h0O1xuICAgIGNvb3Jkcy5jb29yZDIgPSBsaWdodFBvcyAtIGhhbGZXaWR0aCArIGhhbGZIZWlnaHQ7XG4gICAgY29vcmRzLmNvb3JkMyA9IGxpZ2h0UG9zICsgaGFsZldpZHRoICsgaGFsZkhlaWdodDtcbiAgICByZXR1cm4gY29vcmRzO1xufVxuXG5mbG9hdCBkU3BoZXJlUmFkaXVzO1xuQ29vcmRzIGdldFNwaGVyZUxpZ2h0Q29vcmRzKHZlYzMgbGlnaHRQb3MsIHZlYzMgaGFsZldpZHRoLCB2ZWMzIGhhbGZIZWlnaHQpe1xuICAgIC8vIHVzZWQgZm9yIHNpbXBsZSBzcGhlcmUgbGlnaHQgZmFsbG9mZlxuICAgIC8vIGFsc28sIHRoZSBjb2RlIG9ubHkgaGFuZGxlcyBhIHNwaGVyaWNhbCBsaWdodCwgaXQgY2Fubm90IGJlIG5vbi11bmlmb3JtbHkgc2NhbGVkIGluIHdvcmxkIHNwYWNlLCBhbmQgc28gd2UgZW5mb3JjZSBpdCBoZXJlXG4gICAgZFNwaGVyZVJhZGl1cyA9IG1heChsZW5ndGgoaGFsZldpZHRoKSwgbGVuZ3RoKGhhbGZIZWlnaHQpKTtcblxuICAgIC8vIEJpbGxib2FyZCB0aGUgMmQgbGlnaHQgcXVhZCB0byByZWZsZWN0aW9uIHZlY3RvciwgYXMgaXQncyB1c2VkIGZvciBzcGVjdWxhci4gVGhpcyBhbGxvd3MgdXMgdG8gdXNlIGRpc2sgbWF0aCBmb3IgdGhlIHNwaGVyZS5cbiAgICB2ZWMzIGYgPSByZWZsZWN0KG5vcm1hbGl6ZShsaWdodFBvcyAtIHZpZXdfcG9zaXRpb24pLCB2Tm9ybWFsVyk7XG4gICAgdmVjMyB3ID0gbm9ybWFsaXplKGNyb3NzKGYsIGhhbGZIZWlnaHQpKTtcbiAgICB2ZWMzIGggPSBub3JtYWxpemUoY3Jvc3MoZiwgdykpO1xuXG4gICAgcmV0dXJuIGdldExUQ0xpZ2h0Q29vcmRzKGxpZ2h0UG9zLCB3ICogZFNwaGVyZVJhZGl1cywgaCAqIGRTcGhlcmVSYWRpdXMpO1xufVxuXG4vLyB1c2VkIGZvciBMVEMgTFVUIHRleHR1cmUgbG9va3VwXG52ZWMyIGRMVENVVjtcbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG52ZWMyIGNjTFRDVVY7XG4jZW5kaWZcbnZlYzIgZ2V0TFRDTGlnaHRVVihmbG9hdCB0R2xvc3NpbmVzcywgdmVjMyB0Tm9ybWFsVylcbntcbiAgICBmbG9hdCByb3VnaG5lc3MgPSBtYXgoKDEuMCAtIHRHbG9zc2luZXNzKSAqICgxLjAgLSB0R2xvc3NpbmVzcyksIDAuMDAxKTtcbiAgICByZXR1cm4gTFRDX1V2KCB0Tm9ybWFsVywgZFZpZXdEaXJXLCByb3VnaG5lc3MgKTtcbn1cblxuLy91c2VkIGZvciBlbmVyZ3kgY29uc2VydmF0aW9uIGFuZCB0byBtb2R1bGF0ZSBzcGVjdWxhclxudmVjMyBkTFRDU3BlY0ZyZXM7XG4jaWZkZWYgTElUX0NMRUFSQ09BVFxudmVjMyBjY0xUQ1NwZWNGcmVzO1xuI2VuZGlmXG52ZWMzIGdldExUQ0xpZ2h0U3BlY0ZyZXModmVjMiB1diwgdmVjMyB0U3BlY3VsYXJpdHkpXG57XG4gICAgdmVjNCB0MiA9IHRleHR1cmUyRExvZEVYVChhcmVhTGlnaHRzTHV0VGV4MiwgdXYsIDAuMCk7XG5cbiAgICAjaWZkZWYgQVJFQV9SOF9HOF9COF9BOF9MVVRTXG4gICAgdDIgKj0gdmVjNCgwLjY5MzEwMywxLDEsMSk7XG4gICAgdDIgKz0gdmVjNCgwLjMwNjg5NywwLDAsMCk7XG4gICAgI2VuZGlmXG5cbiAgICByZXR1cm4gdFNwZWN1bGFyaXR5ICogdDIueCArICggdmVjMyggMS4wICkgLSB0U3BlY3VsYXJpdHkpICogdDIueTtcbn1cblxudm9pZCBjYWxjTFRDTGlnaHRWYWx1ZXMoKVxue1xuICAgIGRMVENVViA9IGdldExUQ0xpZ2h0VVYoZEdsb3NzaW5lc3MsIGROb3JtYWxXKTtcbiAgICBkTFRDU3BlY0ZyZXMgPSBnZXRMVENMaWdodFNwZWNGcmVzKGRMVENVViwgZFNwZWN1bGFyaXR5KTsgXG5cbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG4gICAgY2NMVENVViA9IGdldExUQ0xpZ2h0VVYoY2NHbG9zc2luZXNzLCBjY05vcm1hbFcpO1xuICAgIGNjTFRDU3BlY0ZyZXMgPSBnZXRMVENMaWdodFNwZWNGcmVzKGNjTFRDVVYsIHZlYzMoY2NTcGVjdWxhcml0eSkpO1xuI2VuZGlmXG59XG5cbnZvaWQgY2FsY1JlY3RMaWdodFZhbHVlcyh2ZWMzIGxpZ2h0UG9zLCB2ZWMzIGhhbGZXaWR0aCwgdmVjMyBoYWxmSGVpZ2h0KVxue1xuICAgIGRMVENDb29yZHMgPSBnZXRMVENMaWdodENvb3JkcyhsaWdodFBvcywgaGFsZldpZHRoLCBoYWxmSGVpZ2h0KTtcbn1cbnZvaWQgY2FsY0Rpc2tMaWdodFZhbHVlcyh2ZWMzIGxpZ2h0UG9zLCB2ZWMzIGhhbGZXaWR0aCwgdmVjMyBoYWxmSGVpZ2h0KVxue1xuICAgIGNhbGNSZWN0TGlnaHRWYWx1ZXMobGlnaHRQb3MsIGhhbGZXaWR0aCwgaGFsZkhlaWdodCk7XG59XG52b2lkIGNhbGNTcGhlcmVMaWdodFZhbHVlcyh2ZWMzIGxpZ2h0UG9zLCB2ZWMzIGhhbGZXaWR0aCwgdmVjMyBoYWxmSGVpZ2h0KVxue1xuICAgIGRMVENDb29yZHMgPSBnZXRTcGhlcmVMaWdodENvb3JkcyhsaWdodFBvcywgaGFsZldpZHRoLCBoYWxmSGVpZ2h0KTtcbn1cblxuLy8gQW4gZXh0ZW5kZWQgdmVyc2lvbiBvZiB0aGUgaW1wbGVtZW50YXRpb24gZnJvbVxuLy8gXCJIb3cgdG8gc29sdmUgYSBjdWJpYyBlcXVhdGlvbiwgcmV2aXNpdGVkXCJcbi8vIGh0dHA6Ly9tb21lbnRzaW5ncmFwaGljcy5kZS8/cD0xMDVcbnZlYzMgU29sdmVDdWJpYyh2ZWM0IENvZWZmaWNpZW50KVxue1xuICAgIGZsb2F0IHBpID0gMy4xNDE1OTtcbiAgICAvLyBOb3JtYWxpemUgdGhlIHBvbHlub21pYWxcbiAgICBDb2VmZmljaWVudC54eXogLz0gQ29lZmZpY2llbnQudztcbiAgICAvLyBEaXZpZGUgbWlkZGxlIGNvZWZmaWNpZW50cyBieSB0aHJlZVxuICAgIENvZWZmaWNpZW50Lnl6IC89IDMuMDtcblxuICAgIGZsb2F0IEEgPSBDb2VmZmljaWVudC53O1xuICAgIGZsb2F0IEIgPSBDb2VmZmljaWVudC56O1xuICAgIGZsb2F0IEMgPSBDb2VmZmljaWVudC55O1xuICAgIGZsb2F0IEQgPSBDb2VmZmljaWVudC54O1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgSGVzc2lhbiBhbmQgdGhlIGRpc2NyaW1pbmFudFxuICAgIHZlYzMgRGVsdGEgPSB2ZWMzKFxuICAgICAgICAtQ29lZmZpY2llbnQueiAqIENvZWZmaWNpZW50LnogKyBDb2VmZmljaWVudC55LFxuICAgICAgICAtQ29lZmZpY2llbnQueSAqIENvZWZmaWNpZW50LnogKyBDb2VmZmljaWVudC54LFxuICAgICAgICBkb3QodmVjMihDb2VmZmljaWVudC56LCAtQ29lZmZpY2llbnQueSksIENvZWZmaWNpZW50Lnh5KVxuICAgICk7XG5cbiAgICBmbG9hdCBEaXNjcmltaW5hbnQgPSBkb3QodmVjMig0LjAgKiBEZWx0YS54LCAtRGVsdGEueSksIERlbHRhLnp5KTtcblxuICAgIHZlYzMgUm9vdHNBLCBSb290c0Q7XG5cbiAgICB2ZWMyIHhsYywgeHNjO1xuXG4gICAgLy8gQWxnb3JpdGhtIEFcbiAgICB7XG4gICAgICAgIGZsb2F0IEFfYSA9IDEuMDtcbiAgICAgICAgZmxvYXQgQ19hID0gRGVsdGEueDtcbiAgICAgICAgZmxvYXQgRF9hID0gLTIuMCAqIEIgKiBEZWx0YS54ICsgRGVsdGEueTtcblxuICAgICAgICAvLyBUYWtlIHRoZSBjdWJpYyByb290IG9mIGEgbm9ybWFsaXplZCBjb21wbGV4IG51bWJlclxuICAgICAgICBmbG9hdCBUaGV0YSA9IGF0YW4oc3FydChEaXNjcmltaW5hbnQpLCAtRF9hKSAvIDMuMDtcblxuICAgICAgICBmbG9hdCB4XzFhID0gMi4wICogc3FydCgtQ19hKSAqIGNvcyhUaGV0YSk7XG4gICAgICAgIGZsb2F0IHhfM2EgPSAyLjAgKiBzcXJ0KC1DX2EpICogY29zKFRoZXRhICsgKDIuMCAvIDMuMCkgKiBwaSk7XG5cbiAgICAgICAgZmxvYXQgeGw7XG4gICAgICAgIGlmICgoeF8xYSArIHhfM2EpID4gMi4wICogQilcbiAgICAgICAgICAgIHhsID0geF8xYTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgeGwgPSB4XzNhO1xuXG4gICAgICAgIHhsYyA9IHZlYzIoeGwgLSBCLCBBKTtcbiAgICB9XG5cbiAgICAvLyBBbGdvcml0aG0gRFxuICAgIHtcbiAgICAgICAgZmxvYXQgQV9kID0gRDtcbiAgICAgICAgZmxvYXQgQ19kID0gRGVsdGEuejtcbiAgICAgICAgZmxvYXQgRF9kID0gLUQgKiBEZWx0YS55ICsgMi4wICogQyAqIERlbHRhLno7XG5cbiAgICAgICAgLy8gVGFrZSB0aGUgY3ViaWMgcm9vdCBvZiBhIG5vcm1hbGl6ZWQgY29tcGxleCBudW1iZXJcbiAgICAgICAgZmxvYXQgVGhldGEgPSBhdGFuKEQgKiBzcXJ0KERpc2NyaW1pbmFudCksIC1EX2QpIC8gMy4wO1xuXG4gICAgICAgIGZsb2F0IHhfMWQgPSAyLjAgKiBzcXJ0KC1DX2QpICogY29zKFRoZXRhKTtcbiAgICAgICAgZmxvYXQgeF8zZCA9IDIuMCAqIHNxcnQoLUNfZCkgKiBjb3MoVGhldGEgKyAoMi4wIC8gMy4wKSAqIHBpKTtcblxuICAgICAgICBmbG9hdCB4cztcbiAgICAgICAgaWYgKHhfMWQgKyB4XzNkIDwgMi4wICogQylcbiAgICAgICAgICAgIHhzID0geF8xZDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgeHMgPSB4XzNkO1xuXG4gICAgICAgIHhzYyA9IHZlYzIoLUQsIHhzICsgQyk7XG4gICAgfVxuXG4gICAgZmxvYXQgRSA9ICB4bGMueSAqIHhzYy55O1xuICAgIGZsb2F0IEYgPSAteGxjLnggKiB4c2MueSAtIHhsYy55ICogeHNjLng7XG4gICAgZmxvYXQgRyA9ICB4bGMueCAqIHhzYy54O1xuXG4gICAgdmVjMiB4bWMgPSB2ZWMyKEMgKiBGIC0gQiAqIEcsIC1CICogRiArIEMgKiBFKTtcblxuICAgIHZlYzMgUm9vdCA9IHZlYzMoeHNjLnggLyB4c2MueSwgeG1jLnggLyB4bWMueSwgeGxjLnggLyB4bGMueSk7XG5cbiAgICBpZiAoUm9vdC54IDwgUm9vdC55ICYmIFJvb3QueCA8IFJvb3QueilcbiAgICAgICAgUm9vdC54eXogPSBSb290Lnl4ejtcbiAgICBlbHNlIGlmIChSb290LnogPCBSb290LnggJiYgUm9vdC56IDwgUm9vdC55KVxuICAgICAgICBSb290Lnh5eiA9IFJvb3QueHp5O1xuXG4gICAgcmV0dXJuIFJvb3Q7XG59XG5cbmZsb2F0IExUQ19FdmFsdWF0ZURpc2sodmVjMyBOLCB2ZWMzIFYsIHZlYzMgUCwgbWF0MyBNaW52LCBDb29yZHMgcG9pbnRzKVxue1xuICAgIC8vIGNvbnN0cnVjdCBvcnRob25vcm1hbCBiYXNpcyBhcm91bmQgTlxuICAgIHZlYzMgVDEsIFQyO1xuICAgIFQxID0gbm9ybWFsaXplKFYgLSBOICogZG90KFYsIE4pKTtcbiAgICBUMiA9IGNyb3NzKE4sIFQxKTtcblxuICAgIC8vIHJvdGF0ZSBhcmVhIGxpZ2h0IGluIChUMSwgVDIsIE4pIGJhc2lzXG4gICAgLy9tYXQzIFIgPSB0cmFuc3Bvc2UobWF0MyhUMSwgVDIsIE4pKTtcbiAgICBtYXQzIFIgPSB0cmFuc3Bvc2VNYXQzKCBtYXQzKCBUMSwgVDIsIE4gKSApO1xuICAgIC8vIHBvbHlnb24gKGFsbG9jYXRlIDUgdmVydGljZXMgZm9yIGNsaXBwaW5nKVxuICAgIHZlYzMgTF9bIDMgXTtcbiAgICBMX1sgMCBdID0gUiAqICggcG9pbnRzLmNvb3JkMCAtIFAgKTtcbiAgICBMX1sgMSBdID0gUiAqICggcG9pbnRzLmNvb3JkMSAtIFAgKTtcbiAgICBMX1sgMiBdID0gUiAqICggcG9pbnRzLmNvb3JkMiAtIFAgKTtcblxuICAgIHZlYzMgTG9faSA9IHZlYzMoMCk7XG5cbiAgICAvLyBpbml0IGVsbGlwc2VcbiAgICB2ZWMzIEMgID0gMC41ICogKExfWzBdICsgTF9bMl0pO1xuICAgIHZlYzMgVjEgPSAwLjUgKiAoTF9bMV0gLSBMX1syXSk7XG4gICAgdmVjMyBWMiA9IDAuNSAqIChMX1sxXSAtIExfWzBdKTtcblxuICAgIEMgID0gTWludiAqIEM7XG4gICAgVjEgPSBNaW52ICogVjE7XG4gICAgVjIgPSBNaW52ICogVjI7XG5cbiAgICAvL2lmKGRvdChjcm9zcyhWMSwgVjIpLCBDKSA+IDAuMClcbiAgICAvLyAgICByZXR1cm4gMC4wO1xuXG4gICAgLy8gY29tcHV0ZSBlaWdlbnZlY3RvcnMgb2YgZWxsaXBzZVxuICAgIGZsb2F0IGEsIGI7XG4gICAgZmxvYXQgZDExID0gZG90KFYxLCBWMSk7XG4gICAgZmxvYXQgZDIyID0gZG90KFYyLCBWMik7XG4gICAgZmxvYXQgZDEyID0gZG90KFYxLCBWMik7XG4gICAgaWYgKGFicyhkMTIpIC8gc3FydChkMTEgKiBkMjIpID4gMC4wMDAxKVxuICAgIHtcbiAgICAgICAgZmxvYXQgdHIgPSBkMTEgKyBkMjI7XG4gICAgICAgIGZsb2F0IGRldCA9IC1kMTIgKiBkMTIgKyBkMTEgKiBkMjI7XG5cbiAgICAgICAgLy8gdXNlIHNxcnQgbWF0cml4IHRvIHNvbHZlIGZvciBlaWdlbnZhbHVlc1xuICAgICAgICBkZXQgPSBzcXJ0KGRldCk7XG4gICAgICAgIGZsb2F0IHUgPSAwLjUgKiBzcXJ0KHRyIC0gMi4wICogZGV0KTtcbiAgICAgICAgZmxvYXQgdiA9IDAuNSAqIHNxcnQodHIgKyAyLjAgKiBkZXQpO1xuICAgICAgICBmbG9hdCBlX21heCA9ICh1ICsgdikgKiAodSArIHYpO1xuICAgICAgICBmbG9hdCBlX21pbiA9ICh1IC0gdikgKiAodSAtIHYpO1xuXG4gICAgICAgIHZlYzMgVjFfLCBWMl87XG5cbiAgICAgICAgaWYgKGQxMSA+IGQyMilcbiAgICAgICAge1xuICAgICAgICAgICAgVjFfID0gZDEyICogVjEgKyAoZV9tYXggLSBkMTEpICogVjI7XG4gICAgICAgICAgICBWMl8gPSBkMTIgKiBWMSArIChlX21pbiAtIGQxMSkgKiBWMjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIFYxXyA9IGQxMipWMiArIChlX21heCAtIGQyMikqVjE7XG4gICAgICAgICAgICBWMl8gPSBkMTIqVjIgKyAoZV9taW4gLSBkMjIpKlYxO1xuICAgICAgICB9XG5cbiAgICAgICAgYSA9IDEuMCAvIGVfbWF4O1xuICAgICAgICBiID0gMS4wIC8gZV9taW47XG4gICAgICAgIFYxID0gbm9ybWFsaXplKFYxXyk7XG4gICAgICAgIFYyID0gbm9ybWFsaXplKFYyXyk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGEgPSAxLjAgLyBkb3QoVjEsIFYxKTtcbiAgICAgICAgYiA9IDEuMCAvIGRvdChWMiwgVjIpO1xuICAgICAgICBWMSAqPSBzcXJ0KGEpO1xuICAgICAgICBWMiAqPSBzcXJ0KGIpO1xuICAgIH1cblxuICAgIHZlYzMgVjMgPSBjcm9zcyhWMSwgVjIpO1xuICAgIGlmIChkb3QoQywgVjMpIDwgMC4wKVxuICAgICAgICBWMyAqPSAtMS4wO1xuXG4gICAgZmxvYXQgTCAgPSBkb3QoVjMsIEMpO1xuICAgIGZsb2F0IHgwID0gZG90KFYxLCBDKSAvIEw7XG4gICAgZmxvYXQgeTAgPSBkb3QoVjIsIEMpIC8gTDtcblxuICAgIGZsb2F0IEUxID0gaW52ZXJzZXNxcnQoYSk7XG4gICAgZmxvYXQgRTIgPSBpbnZlcnNlc3FydChiKTtcblxuICAgIGEgKj0gTCAqIEw7XG4gICAgYiAqPSBMICogTDtcblxuICAgIGZsb2F0IGMwID0gYSAqIGI7XG4gICAgZmxvYXQgYzEgPSBhICogYiAqICgxLjAgKyB4MCAqIHgwICsgeTAgKiB5MCkgLSBhIC0gYjtcbiAgICBmbG9hdCBjMiA9IDEuMCAtIGEgKiAoMS4wICsgeDAgKiB4MCkgLSBiICogKDEuMCArIHkwICogeTApO1xuICAgIGZsb2F0IGMzID0gMS4wO1xuXG4gICAgdmVjMyByb290cyA9IFNvbHZlQ3ViaWModmVjNChjMCwgYzEsIGMyLCBjMykpO1xuICAgIGZsb2F0IGUxID0gcm9vdHMueDtcbiAgICBmbG9hdCBlMiA9IHJvb3RzLnk7XG4gICAgZmxvYXQgZTMgPSByb290cy56O1xuXG4gICAgdmVjMyBhdmdEaXIgPSB2ZWMzKGEgKiB4MCAvIChhIC0gZTIpLCBiICogeTAgLyAoYiAtIGUyKSwgMS4wKTtcblxuICAgIG1hdDMgcm90YXRlID0gbWF0MyhWMSwgVjIsIFYzKTtcblxuICAgIGF2Z0RpciA9IHJvdGF0ZSAqIGF2Z0RpcjtcbiAgICBhdmdEaXIgPSBub3JtYWxpemUoYXZnRGlyKTtcblxuICAgIGZsb2F0IEwxID0gc3FydCgtZTIgLyBlMyk7XG4gICAgZmxvYXQgTDIgPSBzcXJ0KC1lMiAvIGUxKTtcblxuICAgIGZsb2F0IGZvcm1GYWN0b3IgPSBMMSAqIEwyICogaW52ZXJzZXNxcnQoKDEuMCArIEwxICogTDEpICogKDEuMCArIEwyICogTDIpKTtcbiAgICBcbiAgICBjb25zdCBmbG9hdCBMVVRfU0laRSA9IDY0LjA7XG4gICAgY29uc3QgZmxvYXQgTFVUX1NDQUxFID0gKCBMVVRfU0laRSAtIDEuMCApIC8gTFVUX1NJWkU7XG4gICAgY29uc3QgZmxvYXQgTFVUX0JJQVMgPSAwLjUgLyBMVVRfU0laRTtcblxuICAgIC8vIHVzZSB0YWJ1bGF0ZWQgaG9yaXpvbi1jbGlwcGVkIHNwaGVyZVxuICAgIHZlYzIgdXYgPSB2ZWMyKGF2Z0Rpci56ICogMC41ICsgMC41LCBmb3JtRmFjdG9yKTtcbiAgICB1diA9IHV2KkxVVF9TQ0FMRSArIExVVF9CSUFTO1xuXG4gICAgZmxvYXQgc2NhbGUgPSB0ZXh0dXJlMkRMb2RFWFQoYXJlYUxpZ2h0c0x1dFRleDIsIHV2LCAwLjApLnc7XG5cbiAgICByZXR1cm4gZm9ybUZhY3RvcipzY2FsZTtcbn1cblxuZmxvYXQgZ2V0UmVjdExpZ2h0RGlmZnVzZSgpIHtcbiAgICByZXR1cm4gTFRDX0V2YWx1YXRlUmVjdCggZE5vcm1hbFcsIGRWaWV3RGlyVywgdlBvc2l0aW9uVywgbWF0MyggMS4wICksIGRMVENDb29yZHMgKTtcbn1cblxuZmxvYXQgZ2V0RGlza0xpZ2h0RGlmZnVzZSgpIHtcbiAgICByZXR1cm4gTFRDX0V2YWx1YXRlRGlzayggZE5vcm1hbFcsIGRWaWV3RGlyVywgdlBvc2l0aW9uVywgbWF0MyggMS4wICksIGRMVENDb29yZHMgKTtcbn1cblxuZmxvYXQgZ2V0U3BoZXJlTGlnaHREaWZmdXNlKCkge1xuICAgIC8vIE5COiB0aGlzIGNvdWxkIGJlIGltcHJvdmVkIGZ1cnRoZXIgd2l0aCBkaXN0YW5jZSBiYXNlZCB3cmFwIGxpZ2h0aW5nXG4gICAgZmxvYXQgZmFsbG9mZiA9IGRTcGhlcmVSYWRpdXMgLyAoZG90KGRMaWdodERpclcsIGRMaWdodERpclcpICsgZFNwaGVyZVJhZGl1cyk7XG4gICAgcmV0dXJuIGdldExpZ2h0RGlmZnVzZSgpKmZhbGxvZmY7XG59XG5cbm1hdDMgZ2V0TFRDTGlnaHRJbnZNYXQodmVjMiB1dilcbntcbiAgICB2ZWM0IHQxID0gdGV4dHVyZTJETG9kRVhUKGFyZWFMaWdodHNMdXRUZXgxLCB1diwgMC4wKTtcblxuICAgICNpZmRlZiBBUkVBX1I4X0c4X0I4X0E4X0xVVFNcbiAgICB0MSAqPSB2ZWM0KDEuMDAxLCAwLjMyMzksIDAuNjA0Mzc1NjgsIDEuMCk7XG4gICAgdDEgKz0gdmVjNCgwLjAsIC0wLjI5NzYsIC0wLjAxMzgxLCAwLjApO1xuICAgICNlbmRpZlxuXG4gICAgcmV0dXJuIG1hdDMoXG4gICAgICAgIHZlYzMoIHQxLngsIDAsIHQxLnkgKSxcbiAgICAgICAgdmVjMyggICAgMCwgMSwgICAgMCApLFxuICAgICAgICB2ZWMzKCB0MS56LCAwLCB0MS53IClcbiAgICApO1xufVxuXG5mbG9hdCBjYWxjUmVjdExpZ2h0U3BlY3VsYXIodmVjMyB0Tm9ybWFsVywgdmVjMiB1dikge1xuICAgIG1hdDMgbUludiA9IGdldExUQ0xpZ2h0SW52TWF0KHV2KTtcbiAgICByZXR1cm4gTFRDX0V2YWx1YXRlUmVjdCggdE5vcm1hbFcsIGRWaWV3RGlyVywgdlBvc2l0aW9uVywgbUludiwgZExUQ0Nvb3JkcyApO1xufVxuXG5mbG9hdCBnZXRSZWN0TGlnaHRTcGVjdWxhcigpIHtcbiAgICByZXR1cm4gY2FsY1JlY3RMaWdodFNwZWN1bGFyKGROb3JtYWxXLCBkTFRDVVYpO1xufVxuXG4jaWZkZWYgTElUX0NMRUFSQ09BVFxuZmxvYXQgZ2V0UmVjdExpZ2h0U3BlY3VsYXJDQygpIHtcbiAgICByZXR1cm4gY2FsY1JlY3RMaWdodFNwZWN1bGFyKGNjTm9ybWFsVywgY2NMVENVVik7XG59XG4jZW5kaWZcblxuZmxvYXQgY2FsY0Rpc2tMaWdodFNwZWN1bGFyKHZlYzMgdE5vcm1hbFcsIHZlYzIgdXYpIHtcbiAgICBtYXQzIG1JbnYgPSBnZXRMVENMaWdodEludk1hdCh1dik7XG4gICAgcmV0dXJuIExUQ19FdmFsdWF0ZURpc2soIHROb3JtYWxXLCBkVmlld0RpclcsIHZQb3NpdGlvblcsIG1JbnYsIGRMVENDb29yZHMgKTtcbn1cblxuZmxvYXQgZ2V0RGlza0xpZ2h0U3BlY3VsYXIoKSB7XG4gICAgcmV0dXJuIGNhbGNEaXNrTGlnaHRTcGVjdWxhcihkTm9ybWFsVywgZExUQ1VWKTtcbn1cblxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbmZsb2F0IGdldERpc2tMaWdodFNwZWN1bGFyQ0MoKSB7XG4gICAgcmV0dXJuIGNhbGNEaXNrTGlnaHRTcGVjdWxhcihjY05vcm1hbFcsIGNjTFRDVVYpO1xufVxuI2VuZGlmXG5cbmZsb2F0IGdldFNwaGVyZUxpZ2h0U3BlY3VsYXIoKSB7XG4gICAgcmV0dXJuIGNhbGNEaXNrTGlnaHRTcGVjdWxhcihkTm9ybWFsVywgZExUQ1VWKTtcbn1cblxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbmZsb2F0IGdldFNwaGVyZUxpZ2h0U3BlY3VsYXJDQygpIHtcbiAgICByZXR1cm4gY2FsY0Rpc2tMaWdodFNwZWN1bGFyKGNjTm9ybWFsVywgY2NMVENVVik7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxVQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
