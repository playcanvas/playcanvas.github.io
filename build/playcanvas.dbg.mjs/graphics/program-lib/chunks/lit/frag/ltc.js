/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
    vec4 t2 = texture2D( areaLightsLutTex2, uv );

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

    float scale = texture2D( areaLightsLutTex2, uv ).w;

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
    vec4 t1 = texture2D( areaLightsLutTex1, uv );

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHRjLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2x0Yy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gUmVhbC1UaW1lIFBvbHlnb25hbC1MaWdodCBTaGFkaW5nIHdpdGggTGluZWFybHkgVHJhbnNmb3JtZWQgQ29zaW5lc1xuLy8gYnkgRXJpYyBIZWl0eiwgSm9uYXRoYW4gRHVwdXksIFN0ZXBoZW4gSGlsbCBhbmQgRGF2aWQgTmV1YmVsdFxuLy8gY29kZTogaHR0cHM6Ly9naXRodWIuY29tL3NlbGZzaGFkb3cvbHRjX2NvZGUvXG5cbm1hdDMgdHJhbnNwb3NlTWF0MyggY29uc3QgaW4gbWF0MyBtICkge1xuICAgIG1hdDMgdG1wO1xuICAgIHRtcFsgMCBdID0gdmVjMyggbVsgMCBdLngsIG1bIDEgXS54LCBtWyAyIF0ueCApO1xuICAgIHRtcFsgMSBdID0gdmVjMyggbVsgMCBdLnksIG1bIDEgXS55LCBtWyAyIF0ueSApO1xuICAgIHRtcFsgMiBdID0gdmVjMyggbVsgMCBdLnosIG1bIDEgXS56LCBtWyAyIF0ueiApO1xuICAgIHJldHVybiB0bXA7XG59XG5cbnZlYzIgTFRDX1V2KCBjb25zdCBpbiB2ZWMzIE4sIGNvbnN0IGluIHZlYzMgViwgY29uc3QgaW4gZmxvYXQgcm91Z2huZXNzICkge1xuICAgIGNvbnN0IGZsb2F0IExVVF9TSVpFID0gNjQuMDtcbiAgICBjb25zdCBmbG9hdCBMVVRfU0NBTEUgPSAoIExVVF9TSVpFIC0gMS4wICkgLyBMVVRfU0laRTtcbiAgICBjb25zdCBmbG9hdCBMVVRfQklBUyA9IDAuNSAvIExVVF9TSVpFO1xuICAgIGZsb2F0IGRvdE5WID0gc2F0dXJhdGUoIGRvdCggTiwgViApICk7XG4gICAgLy8gdGV4dHVyZSBwYXJhbWV0ZXJpemVkIGJ5IHNxcnQoIEdHWCBhbHBoYSApIGFuZCBzcXJ0KCAxIC0gY29zKCB0aGV0YSApIClcbiAgICB2ZWMyIHV2ID0gdmVjMiggcm91Z2huZXNzLCBzcXJ0KCAxLjAgLSBkb3ROViApICk7XG4gICAgdXYgPSB1diAqIExVVF9TQ0FMRSArIExVVF9CSUFTO1xuICAgIHJldHVybiB1djtcbn1cblxuZmxvYXQgTFRDX0NsaXBwZWRTcGhlcmVGb3JtRmFjdG9yKCBjb25zdCBpbiB2ZWMzIGYgKSB7XG4gICAgLy8gUmVhbC1UaW1lIEFyZWEgTGlnaHRpbmc6IGEgSm91cm5leSBmcm9tIFJlc2VhcmNoIHRvIFByb2R1Y3Rpb24gKHAuMTAyKVxuICAgIC8vIEFuIGFwcHJveGltYXRpb24gb2YgdGhlIGZvcm0gZmFjdG9yIG9mIGEgaG9yaXpvbi1jbGlwcGVkIHJlY3RhbmdsZS5cbiAgICBmbG9hdCBsID0gbGVuZ3RoKCBmICk7XG4gICAgcmV0dXJuIG1heCggKCBsICogbCArIGYueiApIC8gKCBsICsgMS4wICksIDAuMCApO1xufVxuXG52ZWMzIExUQ19FZGdlVmVjdG9yRm9ybUZhY3RvciggY29uc3QgaW4gdmVjMyB2MSwgY29uc3QgaW4gdmVjMyB2MiApIHtcbiAgICBmbG9hdCB4ID0gZG90KCB2MSwgdjIgKTtcbiAgICBmbG9hdCB5ID0gYWJzKCB4ICk7XG4gICAgLy8gcmF0aW9uYWwgcG9seW5vbWlhbCBhcHByb3hpbWF0aW9uIHRvIHRoZXRhIC8gc2luKCB0aGV0YSApIC8gMlBJXG4gICAgZmxvYXQgYSA9IDAuODU0Mzk4NSArICggMC40OTY1MTU1ICsgMC4wMTQ1MjA2ICogeSApICogeTtcbiAgICBmbG9hdCBiID0gMy40MTc1OTQwICsgKCA0LjE2MTY3MjQgKyB5ICkgKiB5O1xuICAgIGZsb2F0IHYgPSBhIC8gYjtcbiAgICBmbG9hdCB0aGV0YV9zaW50aGV0YSA9ICggeCA+IDAuMCApID8gdiA6IDAuNSAqIGludmVyc2VzcXJ0KCBtYXgoIDEuMCAtIHggKiB4LCAxZS03ICkgKSAtIHY7XG4gICAgcmV0dXJuIGNyb3NzKCB2MSwgdjIgKSAqIHRoZXRhX3NpbnRoZXRhO1xufVxuXG5zdHJ1Y3QgQ29vcmRzIHtcbiAgICB2ZWMzIGNvb3JkMDtcbiAgICB2ZWMzIGNvb3JkMTtcbiAgICB2ZWMzIGNvb3JkMjtcbiAgICB2ZWMzIGNvb3JkMztcbn07XG5cbmZsb2F0IExUQ19FdmFsdWF0ZVJlY3QoIGNvbnN0IGluIHZlYzMgTiwgY29uc3QgaW4gdmVjMyBWLCBjb25zdCBpbiB2ZWMzIFAsIGNvbnN0IGluIG1hdDMgbUludiwgY29uc3QgaW4gQ29vcmRzIHJlY3RDb29yZHMpIHtcbiAgICAvLyBiYWlsIGlmIHBvaW50IGlzIG9uIGJhY2sgc2lkZSBvZiBwbGFuZSBvZiBsaWdodFxuICAgIC8vIGFzc3VtZXMgY2N3IHdpbmRpbmcgb3JkZXIgb2YgbGlnaHQgdmVydGljZXNcbiAgICB2ZWMzIHYxID0gcmVjdENvb3Jkcy5jb29yZDEgLSByZWN0Q29vcmRzLmNvb3JkMDtcbiAgICB2ZWMzIHYyID0gcmVjdENvb3Jkcy5jb29yZDMgLSByZWN0Q29vcmRzLmNvb3JkMDtcbiAgICBcbiAgICB2ZWMzIGxpZ2h0Tm9ybWFsID0gY3Jvc3MoIHYxLCB2MiApO1xuICAgIC8vIGlmKCBkb3QoIGxpZ2h0Tm9ybWFsLCBQIC0gcmVjdENvb3Jkcy5jb29yZDAgKSA8IDAuMCApIHJldHVybiAwLjA7XG4gICAgZmxvYXQgZmFjdG9yID0gc2lnbigtZG90KCBsaWdodE5vcm1hbCwgUCAtIHJlY3RDb29yZHMuY29vcmQwICkpO1xuXG4gICAgLy8gY29uc3RydWN0IG9ydGhvbm9ybWFsIGJhc2lzIGFyb3VuZCBOXG4gICAgdmVjMyBUMSwgVDI7XG4gICAgVDEgPSBub3JtYWxpemUoIFYgLSBOICogZG90KCBWLCBOICkgKTtcbiAgICBUMiA9ICBmYWN0b3IgKiBjcm9zcyggTiwgVDEgKTsgLy8gbmVnYXRlZCBmcm9tIHBhcGVyOyBwb3NzaWJseSBkdWUgdG8gYSBkaWZmZXJlbnQgaGFuZGVkbmVzcyBvZiB3b3JsZCBjb29yZGluYXRlIHN5c3RlbVxuICAgIC8vIGNvbXB1dGUgdHJhbnNmb3JtXG4gICAgbWF0MyBtYXQgPSBtSW52ICogdHJhbnNwb3NlTWF0MyggbWF0MyggVDEsIFQyLCBOICkgKTtcbiAgICAvLyB0cmFuc2Zvcm0gcmVjdFxuICAgIHZlYzMgY29vcmRzWyA0IF07XG4gICAgY29vcmRzWyAwIF0gPSBtYXQgKiAoIHJlY3RDb29yZHMuY29vcmQwIC0gUCApO1xuICAgIGNvb3Jkc1sgMSBdID0gbWF0ICogKCByZWN0Q29vcmRzLmNvb3JkMSAtIFAgKTtcbiAgICBjb29yZHNbIDIgXSA9IG1hdCAqICggcmVjdENvb3Jkcy5jb29yZDIgLSBQICk7XG4gICAgY29vcmRzWyAzIF0gPSBtYXQgKiAoIHJlY3RDb29yZHMuY29vcmQzIC0gUCApO1xuICAgIC8vIHByb2plY3QgcmVjdCBvbnRvIHNwaGVyZVxuICAgIGNvb3Jkc1sgMCBdID0gbm9ybWFsaXplKCBjb29yZHNbIDAgXSApO1xuICAgIGNvb3Jkc1sgMSBdID0gbm9ybWFsaXplKCBjb29yZHNbIDEgXSApO1xuICAgIGNvb3Jkc1sgMiBdID0gbm9ybWFsaXplKCBjb29yZHNbIDIgXSApO1xuICAgIGNvb3Jkc1sgMyBdID0gbm9ybWFsaXplKCBjb29yZHNbIDMgXSApO1xuICAgIC8vIGNhbGN1bGF0ZSB2ZWN0b3IgZm9ybSBmYWN0b3JcbiAgICB2ZWMzIHZlY3RvckZvcm1GYWN0b3IgPSB2ZWMzKCAwLjAgKTtcbiAgICB2ZWN0b3JGb3JtRmFjdG9yICs9IExUQ19FZGdlVmVjdG9yRm9ybUZhY3RvciggY29vcmRzWyAwIF0sIGNvb3Jkc1sgMSBdICk7XG4gICAgdmVjdG9yRm9ybUZhY3RvciArPSBMVENfRWRnZVZlY3RvckZvcm1GYWN0b3IoIGNvb3Jkc1sgMSBdLCBjb29yZHNbIDIgXSApO1xuICAgIHZlY3RvckZvcm1GYWN0b3IgKz0gTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb29yZHNbIDIgXSwgY29vcmRzWyAzIF0gKTtcbiAgICB2ZWN0b3JGb3JtRmFjdG9yICs9IExUQ19FZGdlVmVjdG9yRm9ybUZhY3RvciggY29vcmRzWyAzIF0sIGNvb3Jkc1sgMCBdICk7XG4gICAgLy8gYWRqdXN0IGZvciBob3Jpem9uIGNsaXBwaW5nXG4gICAgZmxvYXQgcmVzdWx0ID0gTFRDX0NsaXBwZWRTcGhlcmVGb3JtRmFjdG9yKCB2ZWN0b3JGb3JtRmFjdG9yICk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5Db29yZHMgZExUQ0Nvb3JkcztcbkNvb3JkcyBnZXRMVENMaWdodENvb3Jkcyh2ZWMzIGxpZ2h0UG9zLCB2ZWMzIGhhbGZXaWR0aCwgdmVjMyBoYWxmSGVpZ2h0KXtcbiAgICBDb29yZHMgY29vcmRzO1xuICAgIGNvb3Jkcy5jb29yZDAgPSBsaWdodFBvcyArIGhhbGZXaWR0aCAtIGhhbGZIZWlnaHQ7XG4gICAgY29vcmRzLmNvb3JkMSA9IGxpZ2h0UG9zIC0gaGFsZldpZHRoIC0gaGFsZkhlaWdodDtcbiAgICBjb29yZHMuY29vcmQyID0gbGlnaHRQb3MgLSBoYWxmV2lkdGggKyBoYWxmSGVpZ2h0O1xuICAgIGNvb3Jkcy5jb29yZDMgPSBsaWdodFBvcyArIGhhbGZXaWR0aCArIGhhbGZIZWlnaHQ7XG4gICAgcmV0dXJuIGNvb3Jkcztcbn1cblxuZmxvYXQgZFNwaGVyZVJhZGl1cztcbkNvb3JkcyBnZXRTcGhlcmVMaWdodENvb3Jkcyh2ZWMzIGxpZ2h0UG9zLCB2ZWMzIGhhbGZXaWR0aCwgdmVjMyBoYWxmSGVpZ2h0KXtcbiAgICAvLyB1c2VkIGZvciBzaW1wbGUgc3BoZXJlIGxpZ2h0IGZhbGxvZmZcbiAgICAvLyBhbHNvLCB0aGUgY29kZSBvbmx5IGhhbmRsZXMgYSBzcGhlcmljYWwgbGlnaHQsIGl0IGNhbm5vdCBiZSBub24tdW5pZm9ybWx5IHNjYWxlZCBpbiB3b3JsZCBzcGFjZSwgYW5kIHNvIHdlIGVuZm9yY2UgaXQgaGVyZVxuICAgIGRTcGhlcmVSYWRpdXMgPSBtYXgobGVuZ3RoKGhhbGZXaWR0aCksIGxlbmd0aChoYWxmSGVpZ2h0KSk7XG5cbiAgICAvLyBCaWxsYm9hcmQgdGhlIDJkIGxpZ2h0IHF1YWQgdG8gcmVmbGVjdGlvbiB2ZWN0b3IsIGFzIGl0J3MgdXNlZCBmb3Igc3BlY3VsYXIuIFRoaXMgYWxsb3dzIHVzIHRvIHVzZSBkaXNrIG1hdGggZm9yIHRoZSBzcGhlcmUuXG4gICAgdmVjMyBmID0gcmVmbGVjdChub3JtYWxpemUobGlnaHRQb3MgLSB2aWV3X3Bvc2l0aW9uKSwgdk5vcm1hbFcpO1xuICAgIHZlYzMgdyA9IG5vcm1hbGl6ZShjcm9zcyhmLCBoYWxmSGVpZ2h0KSk7XG4gICAgdmVjMyBoID0gbm9ybWFsaXplKGNyb3NzKGYsIHcpKTtcblxuICAgIHJldHVybiBnZXRMVENMaWdodENvb3JkcyhsaWdodFBvcywgdyAqIGRTcGhlcmVSYWRpdXMsIGggKiBkU3BoZXJlUmFkaXVzKTtcbn1cblxuLy8gdXNlZCBmb3IgTFRDIExVVCB0ZXh0dXJlIGxvb2t1cFxudmVjMiBkTFRDVVY7XG4jaWZkZWYgTElUX0NMRUFSQ09BVFxudmVjMiBjY0xUQ1VWO1xuI2VuZGlmXG52ZWMyIGdldExUQ0xpZ2h0VVYoZmxvYXQgdEdsb3NzaW5lc3MsIHZlYzMgdE5vcm1hbFcpXG57XG4gICAgZmxvYXQgcm91Z2huZXNzID0gbWF4KCgxLjAgLSB0R2xvc3NpbmVzcykgKiAoMS4wIC0gdEdsb3NzaW5lc3MpLCAwLjAwMSk7XG4gICAgcmV0dXJuIExUQ19VdiggdE5vcm1hbFcsIGRWaWV3RGlyVywgcm91Z2huZXNzICk7XG59XG5cbi8vdXNlZCBmb3IgZW5lcmd5IGNvbnNlcnZhdGlvbiBhbmQgdG8gbW9kdWxhdGUgc3BlY3VsYXJcbnZlYzMgZExUQ1NwZWNGcmVzO1xuI2lmZGVmIExJVF9DTEVBUkNPQVRcbnZlYzMgY2NMVENTcGVjRnJlcztcbiNlbmRpZlxudmVjMyBnZXRMVENMaWdodFNwZWNGcmVzKHZlYzIgdXYsIHZlYzMgdFNwZWN1bGFyaXR5KVxue1xuICAgIHZlYzQgdDIgPSB0ZXh0dXJlMkQoIGFyZWFMaWdodHNMdXRUZXgyLCB1diApO1xuXG4gICAgI2lmZGVmIEFSRUFfUjhfRzhfQjhfQThfTFVUU1xuICAgIHQyICo9IHZlYzQoMC42OTMxMDMsMSwxLDEpO1xuICAgIHQyICs9IHZlYzQoMC4zMDY4OTcsMCwwLDApO1xuICAgICNlbmRpZlxuXG4gICAgcmV0dXJuIHRTcGVjdWxhcml0eSAqIHQyLnggKyAoIHZlYzMoIDEuMCApIC0gdFNwZWN1bGFyaXR5KSAqIHQyLnk7XG59XG5cbnZvaWQgY2FsY0xUQ0xpZ2h0VmFsdWVzKClcbntcbiAgICBkTFRDVVYgPSBnZXRMVENMaWdodFVWKGRHbG9zc2luZXNzLCBkTm9ybWFsVyk7XG4gICAgZExUQ1NwZWNGcmVzID0gZ2V0TFRDTGlnaHRTcGVjRnJlcyhkTFRDVVYsIGRTcGVjdWxhcml0eSk7IFxuXG4jaWZkZWYgTElUX0NMRUFSQ09BVFxuICAgIGNjTFRDVVYgPSBnZXRMVENMaWdodFVWKGNjR2xvc3NpbmVzcywgY2NOb3JtYWxXKTtcbiAgICBjY0xUQ1NwZWNGcmVzID0gZ2V0TFRDTGlnaHRTcGVjRnJlcyhjY0xUQ1VWLCB2ZWMzKGNjU3BlY3VsYXJpdHkpKTtcbiNlbmRpZlxufVxuXG52b2lkIGNhbGNSZWN0TGlnaHRWYWx1ZXModmVjMyBsaWdodFBvcywgdmVjMyBoYWxmV2lkdGgsIHZlYzMgaGFsZkhlaWdodClcbntcbiAgICBkTFRDQ29vcmRzID0gZ2V0TFRDTGlnaHRDb29yZHMobGlnaHRQb3MsIGhhbGZXaWR0aCwgaGFsZkhlaWdodCk7XG59XG52b2lkIGNhbGNEaXNrTGlnaHRWYWx1ZXModmVjMyBsaWdodFBvcywgdmVjMyBoYWxmV2lkdGgsIHZlYzMgaGFsZkhlaWdodClcbntcbiAgICBjYWxjUmVjdExpZ2h0VmFsdWVzKGxpZ2h0UG9zLCBoYWxmV2lkdGgsIGhhbGZIZWlnaHQpO1xufVxudm9pZCBjYWxjU3BoZXJlTGlnaHRWYWx1ZXModmVjMyBsaWdodFBvcywgdmVjMyBoYWxmV2lkdGgsIHZlYzMgaGFsZkhlaWdodClcbntcbiAgICBkTFRDQ29vcmRzID0gZ2V0U3BoZXJlTGlnaHRDb29yZHMobGlnaHRQb3MsIGhhbGZXaWR0aCwgaGFsZkhlaWdodCk7XG59XG5cbi8vIEFuIGV4dGVuZGVkIHZlcnNpb24gb2YgdGhlIGltcGxlbWVudGF0aW9uIGZyb21cbi8vIFwiSG93IHRvIHNvbHZlIGEgY3ViaWMgZXF1YXRpb24sIHJldmlzaXRlZFwiXG4vLyBodHRwOi8vbW9tZW50c2luZ3JhcGhpY3MuZGUvP3A9MTA1XG52ZWMzIFNvbHZlQ3ViaWModmVjNCBDb2VmZmljaWVudClcbntcbiAgICBmbG9hdCBwaSA9IDMuMTQxNTk7XG4gICAgLy8gTm9ybWFsaXplIHRoZSBwb2x5bm9taWFsXG4gICAgQ29lZmZpY2llbnQueHl6IC89IENvZWZmaWNpZW50Lnc7XG4gICAgLy8gRGl2aWRlIG1pZGRsZSBjb2VmZmljaWVudHMgYnkgdGhyZWVcbiAgICBDb2VmZmljaWVudC55eiAvPSAzLjA7XG5cbiAgICBmbG9hdCBBID0gQ29lZmZpY2llbnQudztcbiAgICBmbG9hdCBCID0gQ29lZmZpY2llbnQuejtcbiAgICBmbG9hdCBDID0gQ29lZmZpY2llbnQueTtcbiAgICBmbG9hdCBEID0gQ29lZmZpY2llbnQueDtcblxuICAgIC8vIENvbXB1dGUgdGhlIEhlc3NpYW4gYW5kIHRoZSBkaXNjcmltaW5hbnRcbiAgICB2ZWMzIERlbHRhID0gdmVjMyhcbiAgICAgICAgLUNvZWZmaWNpZW50LnogKiBDb2VmZmljaWVudC56ICsgQ29lZmZpY2llbnQueSxcbiAgICAgICAgLUNvZWZmaWNpZW50LnkgKiBDb2VmZmljaWVudC56ICsgQ29lZmZpY2llbnQueCxcbiAgICAgICAgZG90KHZlYzIoQ29lZmZpY2llbnQueiwgLUNvZWZmaWNpZW50LnkpLCBDb2VmZmljaWVudC54eSlcbiAgICApO1xuXG4gICAgZmxvYXQgRGlzY3JpbWluYW50ID0gZG90KHZlYzIoNC4wICogRGVsdGEueCwgLURlbHRhLnkpLCBEZWx0YS56eSk7XG5cbiAgICB2ZWMzIFJvb3RzQSwgUm9vdHNEO1xuXG4gICAgdmVjMiB4bGMsIHhzYztcblxuICAgIC8vIEFsZ29yaXRobSBBXG4gICAge1xuICAgICAgICBmbG9hdCBBX2EgPSAxLjA7XG4gICAgICAgIGZsb2F0IENfYSA9IERlbHRhLng7XG4gICAgICAgIGZsb2F0IERfYSA9IC0yLjAgKiBCICogRGVsdGEueCArIERlbHRhLnk7XG5cbiAgICAgICAgLy8gVGFrZSB0aGUgY3ViaWMgcm9vdCBvZiBhIG5vcm1hbGl6ZWQgY29tcGxleCBudW1iZXJcbiAgICAgICAgZmxvYXQgVGhldGEgPSBhdGFuKHNxcnQoRGlzY3JpbWluYW50KSwgLURfYSkgLyAzLjA7XG5cbiAgICAgICAgZmxvYXQgeF8xYSA9IDIuMCAqIHNxcnQoLUNfYSkgKiBjb3MoVGhldGEpO1xuICAgICAgICBmbG9hdCB4XzNhID0gMi4wICogc3FydCgtQ19hKSAqIGNvcyhUaGV0YSArICgyLjAgLyAzLjApICogcGkpO1xuXG4gICAgICAgIGZsb2F0IHhsO1xuICAgICAgICBpZiAoKHhfMWEgKyB4XzNhKSA+IDIuMCAqIEIpXG4gICAgICAgICAgICB4bCA9IHhfMWE7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHhsID0geF8zYTtcblxuICAgICAgICB4bGMgPSB2ZWMyKHhsIC0gQiwgQSk7XG4gICAgfVxuXG4gICAgLy8gQWxnb3JpdGhtIERcbiAgICB7XG4gICAgICAgIGZsb2F0IEFfZCA9IEQ7XG4gICAgICAgIGZsb2F0IENfZCA9IERlbHRhLno7XG4gICAgICAgIGZsb2F0IERfZCA9IC1EICogRGVsdGEueSArIDIuMCAqIEMgKiBEZWx0YS56O1xuXG4gICAgICAgIC8vIFRha2UgdGhlIGN1YmljIHJvb3Qgb2YgYSBub3JtYWxpemVkIGNvbXBsZXggbnVtYmVyXG4gICAgICAgIGZsb2F0IFRoZXRhID0gYXRhbihEICogc3FydChEaXNjcmltaW5hbnQpLCAtRF9kKSAvIDMuMDtcblxuICAgICAgICBmbG9hdCB4XzFkID0gMi4wICogc3FydCgtQ19kKSAqIGNvcyhUaGV0YSk7XG4gICAgICAgIGZsb2F0IHhfM2QgPSAyLjAgKiBzcXJ0KC1DX2QpICogY29zKFRoZXRhICsgKDIuMCAvIDMuMCkgKiBwaSk7XG5cbiAgICAgICAgZmxvYXQgeHM7XG4gICAgICAgIGlmICh4XzFkICsgeF8zZCA8IDIuMCAqIEMpXG4gICAgICAgICAgICB4cyA9IHhfMWQ7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHhzID0geF8zZDtcblxuICAgICAgICB4c2MgPSB2ZWMyKC1ELCB4cyArIEMpO1xuICAgIH1cblxuICAgIGZsb2F0IEUgPSAgeGxjLnkgKiB4c2MueTtcbiAgICBmbG9hdCBGID0gLXhsYy54ICogeHNjLnkgLSB4bGMueSAqIHhzYy54O1xuICAgIGZsb2F0IEcgPSAgeGxjLnggKiB4c2MueDtcblxuICAgIHZlYzIgeG1jID0gdmVjMihDICogRiAtIEIgKiBHLCAtQiAqIEYgKyBDICogRSk7XG5cbiAgICB2ZWMzIFJvb3QgPSB2ZWMzKHhzYy54IC8geHNjLnksIHhtYy54IC8geG1jLnksIHhsYy54IC8geGxjLnkpO1xuXG4gICAgaWYgKFJvb3QueCA8IFJvb3QueSAmJiBSb290LnggPCBSb290LnopXG4gICAgICAgIFJvb3QueHl6ID0gUm9vdC55eHo7XG4gICAgZWxzZSBpZiAoUm9vdC56IDwgUm9vdC54ICYmIFJvb3QueiA8IFJvb3QueSlcbiAgICAgICAgUm9vdC54eXogPSBSb290Lnh6eTtcblxuICAgIHJldHVybiBSb290O1xufVxuXG5mbG9hdCBMVENfRXZhbHVhdGVEaXNrKHZlYzMgTiwgdmVjMyBWLCB2ZWMzIFAsIG1hdDMgTWludiwgQ29vcmRzIHBvaW50cylcbntcbiAgICAvLyBjb25zdHJ1Y3Qgb3J0aG9ub3JtYWwgYmFzaXMgYXJvdW5kIE5cbiAgICB2ZWMzIFQxLCBUMjtcbiAgICBUMSA9IG5vcm1hbGl6ZShWIC0gTiAqIGRvdChWLCBOKSk7XG4gICAgVDIgPSBjcm9zcyhOLCBUMSk7XG5cbiAgICAvLyByb3RhdGUgYXJlYSBsaWdodCBpbiAoVDEsIFQyLCBOKSBiYXNpc1xuICAgIC8vbWF0MyBSID0gdHJhbnNwb3NlKG1hdDMoVDEsIFQyLCBOKSk7XG4gICAgbWF0MyBSID0gdHJhbnNwb3NlTWF0MyggbWF0MyggVDEsIFQyLCBOICkgKTtcbiAgICAvLyBwb2x5Z29uIChhbGxvY2F0ZSA1IHZlcnRpY2VzIGZvciBjbGlwcGluZylcbiAgICB2ZWMzIExfWyAzIF07XG4gICAgTF9bIDAgXSA9IFIgKiAoIHBvaW50cy5jb29yZDAgLSBQICk7XG4gICAgTF9bIDEgXSA9IFIgKiAoIHBvaW50cy5jb29yZDEgLSBQICk7XG4gICAgTF9bIDIgXSA9IFIgKiAoIHBvaW50cy5jb29yZDIgLSBQICk7XG5cbiAgICB2ZWMzIExvX2kgPSB2ZWMzKDApO1xuXG4gICAgLy8gaW5pdCBlbGxpcHNlXG4gICAgdmVjMyBDICA9IDAuNSAqIChMX1swXSArIExfWzJdKTtcbiAgICB2ZWMzIFYxID0gMC41ICogKExfWzFdIC0gTF9bMl0pO1xuICAgIHZlYzMgVjIgPSAwLjUgKiAoTF9bMV0gLSBMX1swXSk7XG5cbiAgICBDICA9IE1pbnYgKiBDO1xuICAgIFYxID0gTWludiAqIFYxO1xuICAgIFYyID0gTWludiAqIFYyO1xuXG4gICAgLy9pZihkb3QoY3Jvc3MoVjEsIFYyKSwgQykgPiAwLjApXG4gICAgLy8gICAgcmV0dXJuIDAuMDtcblxuICAgIC8vIGNvbXB1dGUgZWlnZW52ZWN0b3JzIG9mIGVsbGlwc2VcbiAgICBmbG9hdCBhLCBiO1xuICAgIGZsb2F0IGQxMSA9IGRvdChWMSwgVjEpO1xuICAgIGZsb2F0IGQyMiA9IGRvdChWMiwgVjIpO1xuICAgIGZsb2F0IGQxMiA9IGRvdChWMSwgVjIpO1xuICAgIGlmIChhYnMoZDEyKSAvIHNxcnQoZDExICogZDIyKSA+IDAuMDAwMSlcbiAgICB7XG4gICAgICAgIGZsb2F0IHRyID0gZDExICsgZDIyO1xuICAgICAgICBmbG9hdCBkZXQgPSAtZDEyICogZDEyICsgZDExICogZDIyO1xuXG4gICAgICAgIC8vIHVzZSBzcXJ0IG1hdHJpeCB0byBzb2x2ZSBmb3IgZWlnZW52YWx1ZXNcbiAgICAgICAgZGV0ID0gc3FydChkZXQpO1xuICAgICAgICBmbG9hdCB1ID0gMC41ICogc3FydCh0ciAtIDIuMCAqIGRldCk7XG4gICAgICAgIGZsb2F0IHYgPSAwLjUgKiBzcXJ0KHRyICsgMi4wICogZGV0KTtcbiAgICAgICAgZmxvYXQgZV9tYXggPSAodSArIHYpICogKHUgKyB2KTtcbiAgICAgICAgZmxvYXQgZV9taW4gPSAodSAtIHYpICogKHUgLSB2KTtcblxuICAgICAgICB2ZWMzIFYxXywgVjJfO1xuXG4gICAgICAgIGlmIChkMTEgPiBkMjIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIFYxXyA9IGQxMiAqIFYxICsgKGVfbWF4IC0gZDExKSAqIFYyO1xuICAgICAgICAgICAgVjJfID0gZDEyICogVjEgKyAoZV9taW4gLSBkMTEpICogVjI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBWMV8gPSBkMTIqVjIgKyAoZV9tYXggLSBkMjIpKlYxO1xuICAgICAgICAgICAgVjJfID0gZDEyKlYyICsgKGVfbWluIC0gZDIyKSpWMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGEgPSAxLjAgLyBlX21heDtcbiAgICAgICAgYiA9IDEuMCAvIGVfbWluO1xuICAgICAgICBWMSA9IG5vcm1hbGl6ZShWMV8pO1xuICAgICAgICBWMiA9IG5vcm1hbGl6ZShWMl8pO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBhID0gMS4wIC8gZG90KFYxLCBWMSk7XG4gICAgICAgIGIgPSAxLjAgLyBkb3QoVjIsIFYyKTtcbiAgICAgICAgVjEgKj0gc3FydChhKTtcbiAgICAgICAgVjIgKj0gc3FydChiKTtcbiAgICB9XG5cbiAgICB2ZWMzIFYzID0gY3Jvc3MoVjEsIFYyKTtcbiAgICBpZiAoZG90KEMsIFYzKSA8IDAuMClcbiAgICAgICAgVjMgKj0gLTEuMDtcblxuICAgIGZsb2F0IEwgID0gZG90KFYzLCBDKTtcbiAgICBmbG9hdCB4MCA9IGRvdChWMSwgQykgLyBMO1xuICAgIGZsb2F0IHkwID0gZG90KFYyLCBDKSAvIEw7XG5cbiAgICBmbG9hdCBFMSA9IGludmVyc2VzcXJ0KGEpO1xuICAgIGZsb2F0IEUyID0gaW52ZXJzZXNxcnQoYik7XG5cbiAgICBhICo9IEwgKiBMO1xuICAgIGIgKj0gTCAqIEw7XG5cbiAgICBmbG9hdCBjMCA9IGEgKiBiO1xuICAgIGZsb2F0IGMxID0gYSAqIGIgKiAoMS4wICsgeDAgKiB4MCArIHkwICogeTApIC0gYSAtIGI7XG4gICAgZmxvYXQgYzIgPSAxLjAgLSBhICogKDEuMCArIHgwICogeDApIC0gYiAqICgxLjAgKyB5MCAqIHkwKTtcbiAgICBmbG9hdCBjMyA9IDEuMDtcblxuICAgIHZlYzMgcm9vdHMgPSBTb2x2ZUN1YmljKHZlYzQoYzAsIGMxLCBjMiwgYzMpKTtcbiAgICBmbG9hdCBlMSA9IHJvb3RzLng7XG4gICAgZmxvYXQgZTIgPSByb290cy55O1xuICAgIGZsb2F0IGUzID0gcm9vdHMuejtcblxuICAgIHZlYzMgYXZnRGlyID0gdmVjMyhhICogeDAgLyAoYSAtIGUyKSwgYiAqIHkwIC8gKGIgLSBlMiksIDEuMCk7XG5cbiAgICBtYXQzIHJvdGF0ZSA9IG1hdDMoVjEsIFYyLCBWMyk7XG5cbiAgICBhdmdEaXIgPSByb3RhdGUgKiBhdmdEaXI7XG4gICAgYXZnRGlyID0gbm9ybWFsaXplKGF2Z0Rpcik7XG5cbiAgICBmbG9hdCBMMSA9IHNxcnQoLWUyIC8gZTMpO1xuICAgIGZsb2F0IEwyID0gc3FydCgtZTIgLyBlMSk7XG5cbiAgICBmbG9hdCBmb3JtRmFjdG9yID0gTDEgKiBMMiAqIGludmVyc2VzcXJ0KCgxLjAgKyBMMSAqIEwxKSAqICgxLjAgKyBMMiAqIEwyKSk7XG4gICAgXG4gICAgY29uc3QgZmxvYXQgTFVUX1NJWkUgPSA2NC4wO1xuICAgIGNvbnN0IGZsb2F0IExVVF9TQ0FMRSA9ICggTFVUX1NJWkUgLSAxLjAgKSAvIExVVF9TSVpFO1xuICAgIGNvbnN0IGZsb2F0IExVVF9CSUFTID0gMC41IC8gTFVUX1NJWkU7XG5cbiAgICAvLyB1c2UgdGFidWxhdGVkIGhvcml6b24tY2xpcHBlZCBzcGhlcmVcbiAgICB2ZWMyIHV2ID0gdmVjMihhdmdEaXIueiAqIDAuNSArIDAuNSwgZm9ybUZhY3Rvcik7XG4gICAgdXYgPSB1dipMVVRfU0NBTEUgKyBMVVRfQklBUztcblxuICAgIGZsb2F0IHNjYWxlID0gdGV4dHVyZTJEKCBhcmVhTGlnaHRzTHV0VGV4MiwgdXYgKS53O1xuXG4gICAgcmV0dXJuIGZvcm1GYWN0b3Iqc2NhbGU7XG59XG5cbmZsb2F0IGdldFJlY3RMaWdodERpZmZ1c2UoKSB7XG4gICAgcmV0dXJuIExUQ19FdmFsdWF0ZVJlY3QoIGROb3JtYWxXLCBkVmlld0RpclcsIHZQb3NpdGlvblcsIG1hdDMoIDEuMCApLCBkTFRDQ29vcmRzICk7XG59XG5cbmZsb2F0IGdldERpc2tMaWdodERpZmZ1c2UoKSB7XG4gICAgcmV0dXJuIExUQ19FdmFsdWF0ZURpc2soIGROb3JtYWxXLCBkVmlld0RpclcsIHZQb3NpdGlvblcsIG1hdDMoIDEuMCApLCBkTFRDQ29vcmRzICk7XG59XG5cbmZsb2F0IGdldFNwaGVyZUxpZ2h0RGlmZnVzZSgpIHtcbiAgICAvLyBOQjogdGhpcyBjb3VsZCBiZSBpbXByb3ZlZCBmdXJ0aGVyIHdpdGggZGlzdGFuY2UgYmFzZWQgd3JhcCBsaWdodGluZ1xuICAgIGZsb2F0IGZhbGxvZmYgPSBkU3BoZXJlUmFkaXVzIC8gKGRvdChkTGlnaHREaXJXLCBkTGlnaHREaXJXKSArIGRTcGhlcmVSYWRpdXMpO1xuICAgIHJldHVybiBnZXRMaWdodERpZmZ1c2UoKSpmYWxsb2ZmO1xufVxuXG5tYXQzIGdldExUQ0xpZ2h0SW52TWF0KHZlYzIgdXYpXG57XG4gICAgdmVjNCB0MSA9IHRleHR1cmUyRCggYXJlYUxpZ2h0c0x1dFRleDEsIHV2ICk7XG5cbiAgICAjaWZkZWYgQVJFQV9SOF9HOF9COF9BOF9MVVRTXG4gICAgdDEgKj0gdmVjNCgxLjAwMSwgMC4zMjM5LCAwLjYwNDM3NTY4LCAxLjApO1xuICAgIHQxICs9IHZlYzQoMC4wLCAtMC4yOTc2LCAtMC4wMTM4MSwgMC4wKTtcbiAgICAjZW5kaWZcblxuICAgIHJldHVybiBtYXQzKFxuICAgICAgICB2ZWMzKCB0MS54LCAwLCB0MS55ICksXG4gICAgICAgIHZlYzMoICAgIDAsIDEsICAgIDAgKSxcbiAgICAgICAgdmVjMyggdDEueiwgMCwgdDEudyApXG4gICAgKTtcbn1cblxuZmxvYXQgY2FsY1JlY3RMaWdodFNwZWN1bGFyKHZlYzMgdE5vcm1hbFcsIHZlYzIgdXYpIHtcbiAgICBtYXQzIG1JbnYgPSBnZXRMVENMaWdodEludk1hdCh1dik7XG4gICAgcmV0dXJuIExUQ19FdmFsdWF0ZVJlY3QoIHROb3JtYWxXLCBkVmlld0RpclcsIHZQb3NpdGlvblcsIG1JbnYsIGRMVENDb29yZHMgKTtcbn1cblxuZmxvYXQgZ2V0UmVjdExpZ2h0U3BlY3VsYXIoKSB7XG4gICAgcmV0dXJuIGNhbGNSZWN0TGlnaHRTcGVjdWxhcihkTm9ybWFsVywgZExUQ1VWKTtcbn1cblxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbmZsb2F0IGdldFJlY3RMaWdodFNwZWN1bGFyQ0MoKSB7XG4gICAgcmV0dXJuIGNhbGNSZWN0TGlnaHRTcGVjdWxhcihjY05vcm1hbFcsIGNjTFRDVVYpO1xufVxuI2VuZGlmXG5cbmZsb2F0IGNhbGNEaXNrTGlnaHRTcGVjdWxhcih2ZWMzIHROb3JtYWxXLCB2ZWMyIHV2KSB7XG4gICAgbWF0MyBtSW52ID0gZ2V0TFRDTGlnaHRJbnZNYXQodXYpO1xuICAgIHJldHVybiBMVENfRXZhbHVhdGVEaXNrKCB0Tm9ybWFsVywgZFZpZXdEaXJXLCB2UG9zaXRpb25XLCBtSW52LCBkTFRDQ29vcmRzICk7XG59XG5cbmZsb2F0IGdldERpc2tMaWdodFNwZWN1bGFyKCkge1xuICAgIHJldHVybiBjYWxjRGlza0xpZ2h0U3BlY3VsYXIoZE5vcm1hbFcsIGRMVENVVik7XG59XG5cbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG5mbG9hdCBnZXREaXNrTGlnaHRTcGVjdWxhckNDKCkge1xuICAgIHJldHVybiBjYWxjRGlza0xpZ2h0U3BlY3VsYXIoY2NOb3JtYWxXLCBjY0xUQ1VWKTtcbn1cbiNlbmRpZlxuXG5mbG9hdCBnZXRTcGhlcmVMaWdodFNwZWN1bGFyKCkge1xuICAgIHJldHVybiBjYWxjRGlza0xpZ2h0U3BlY3VsYXIoZE5vcm1hbFcsIGRMVENVVik7XG59XG5cbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG5mbG9hdCBnZXRTcGhlcmVMaWdodFNwZWN1bGFyQ0MoKSB7XG4gICAgcmV0dXJuIGNhbGNEaXNrTGlnaHRTcGVjdWxhcihjY05vcm1hbFcsIGNjTFRDVVYpO1xufVxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsVUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTFiQTs7OzsifQ==
