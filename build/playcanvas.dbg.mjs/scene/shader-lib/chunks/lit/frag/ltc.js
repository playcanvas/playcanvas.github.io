var ltcPS = /* glsl */`
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
vec2 getLTCLightUV(float gloss, vec3 worldNormal, vec3 viewDir)
{
    float roughness = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    return LTC_Uv( worldNormal, viewDir, roughness );
}

//used for energy conservation and to modulate specular
vec3 dLTCSpecFres;
#ifdef LIT_CLEARCOAT
vec3 ccLTCSpecFres;
#endif
vec3 getLTCLightSpecFres(vec2 uv, vec3 specularity)
{
    vec4 t2 = texture2DLodEXT(areaLightsLutTex2, uv, 0.0);

    #ifdef AREA_R8_G8_B8_A8_LUTS
    t2 *= vec4(0.693103,1,1,1);
    t2 += vec4(0.306897,0,0,0);
    #endif

    return specularity * t2.x + ( vec3( 1.0 ) - specularity) * t2.y;
}

void calcLTCLightValues(float gloss, vec3 worldNormal, vec3 viewDir, vec3 specularity, float clearcoatGloss, vec3 clearcoatWorldNormal, float clearcoatSpecularity)
{
    dLTCUV = getLTCLightUV(gloss, worldNormal, viewDir);
    dLTCSpecFres = getLTCLightSpecFres(dLTCUV, specularity); 

#ifdef LIT_CLEARCOAT
    ccLTCUV = getLTCLightUV(clearcoatGloss, clearcoatWorldNormal, viewDir);
    ccLTCSpecFres = getLTCLightSpecFres(ccLTCUV, vec3(clearcoatSpecularity));
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

float getRectLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
    return LTC_EvaluateRect( worldNormal, viewDir, vPositionW, mat3( 1.0 ), dLTCCoords );
}

float getDiskLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
    return LTC_EvaluateDisk( worldNormal, viewDir, vPositionW, mat3( 1.0 ), dLTCCoords );
}

float getSphereLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
    // NB: this could be improved further with distance based wrap lighting
    float falloff = dSphereRadius / (dot(lightDir, lightDir) + dSphereRadius);
    return getLightDiffuse(worldNormal, viewDir, lightDir, lightDirNorm) * falloff;
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

float calcRectLightSpecular(vec3 worldNormal, vec3 viewDir, vec2 uv) {
    mat3 mInv = getLTCLightInvMat(uv);
    return LTC_EvaluateRect( worldNormal, viewDir, vPositionW, mInv, dLTCCoords );
}

float getRectLightSpecular(vec3 worldNormal, vec3 viewDir) {
    return calcRectLightSpecular(worldNormal, viewDir, dLTCUV);
}

float calcDiskLightSpecular(vec3 worldNormal, vec3 viewDir, vec2 uv) {
    mat3 mInv = getLTCLightInvMat(uv);
    return LTC_EvaluateDisk( worldNormal, viewDir, vPositionW, mInv, dLTCCoords );
}

float getDiskLightSpecular(vec3 worldNormal, vec3 viewDir) {
    return calcDiskLightSpecular(worldNormal, viewDir, dLTCUV);
}

float getSphereLightSpecular(vec3 worldNormal, vec3 viewDir) {
    return calcDiskLightSpecular(worldNormal, viewDir, dLTCUV);
}
`;

export { ltcPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHRjLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbHRjLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBSZWFsLVRpbWUgUG9seWdvbmFsLUxpZ2h0IFNoYWRpbmcgd2l0aCBMaW5lYXJseSBUcmFuc2Zvcm1lZCBDb3NpbmVzXG4vLyBieSBFcmljIEhlaXR6LCBKb25hdGhhbiBEdXB1eSwgU3RlcGhlbiBIaWxsIGFuZCBEYXZpZCBOZXViZWx0XG4vLyBjb2RlOiBodHRwczovL2dpdGh1Yi5jb20vc2VsZnNoYWRvdy9sdGNfY29kZS9cblxubWF0MyB0cmFuc3Bvc2VNYXQzKCBjb25zdCBpbiBtYXQzIG0gKSB7XG4gICAgbWF0MyB0bXA7XG4gICAgdG1wWyAwIF0gPSB2ZWMzKCBtWyAwIF0ueCwgbVsgMSBdLngsIG1bIDIgXS54ICk7XG4gICAgdG1wWyAxIF0gPSB2ZWMzKCBtWyAwIF0ueSwgbVsgMSBdLnksIG1bIDIgXS55ICk7XG4gICAgdG1wWyAyIF0gPSB2ZWMzKCBtWyAwIF0ueiwgbVsgMSBdLnosIG1bIDIgXS56ICk7XG4gICAgcmV0dXJuIHRtcDtcbn1cblxudmVjMiBMVENfVXYoIGNvbnN0IGluIHZlYzMgTiwgY29uc3QgaW4gdmVjMyBWLCBjb25zdCBpbiBmbG9hdCByb3VnaG5lc3MgKSB7XG4gICAgY29uc3QgZmxvYXQgTFVUX1NJWkUgPSA2NC4wO1xuICAgIGNvbnN0IGZsb2F0IExVVF9TQ0FMRSA9ICggTFVUX1NJWkUgLSAxLjAgKSAvIExVVF9TSVpFO1xuICAgIGNvbnN0IGZsb2F0IExVVF9CSUFTID0gMC41IC8gTFVUX1NJWkU7XG4gICAgZmxvYXQgZG90TlYgPSBzYXR1cmF0ZSggZG90KCBOLCBWICkgKTtcbiAgICAvLyB0ZXh0dXJlIHBhcmFtZXRlcml6ZWQgYnkgc3FydCggR0dYIGFscGhhICkgYW5kIHNxcnQoIDEgLSBjb3MoIHRoZXRhICkgKVxuICAgIHZlYzIgdXYgPSB2ZWMyKCByb3VnaG5lc3MsIHNxcnQoIDEuMCAtIGRvdE5WICkgKTtcbiAgICB1diA9IHV2ICogTFVUX1NDQUxFICsgTFVUX0JJQVM7XG4gICAgcmV0dXJuIHV2O1xufVxuXG5mbG9hdCBMVENfQ2xpcHBlZFNwaGVyZUZvcm1GYWN0b3IoIGNvbnN0IGluIHZlYzMgZiApIHtcbiAgICAvLyBSZWFsLVRpbWUgQXJlYSBMaWdodGluZzogYSBKb3VybmV5IGZyb20gUmVzZWFyY2ggdG8gUHJvZHVjdGlvbiAocC4xMDIpXG4gICAgLy8gQW4gYXBwcm94aW1hdGlvbiBvZiB0aGUgZm9ybSBmYWN0b3Igb2YgYSBob3Jpem9uLWNsaXBwZWQgcmVjdGFuZ2xlLlxuICAgIGZsb2F0IGwgPSBsZW5ndGgoIGYgKTtcbiAgICByZXR1cm4gbWF4KCAoIGwgKiBsICsgZi56ICkgLyAoIGwgKyAxLjAgKSwgMC4wICk7XG59XG5cbnZlYzMgTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb25zdCBpbiB2ZWMzIHYxLCBjb25zdCBpbiB2ZWMzIHYyICkge1xuICAgIGZsb2F0IHggPSBkb3QoIHYxLCB2MiApO1xuICAgIGZsb2F0IHkgPSBhYnMoIHggKTtcbiAgICAvLyByYXRpb25hbCBwb2x5bm9taWFsIGFwcHJveGltYXRpb24gdG8gdGhldGEgLyBzaW4oIHRoZXRhICkgLyAyUElcbiAgICBmbG9hdCBhID0gMC44NTQzOTg1ICsgKCAwLjQ5NjUxNTUgKyAwLjAxNDUyMDYgKiB5ICkgKiB5O1xuICAgIGZsb2F0IGIgPSAzLjQxNzU5NDAgKyAoIDQuMTYxNjcyNCArIHkgKSAqIHk7XG4gICAgZmxvYXQgdiA9IGEgLyBiO1xuICAgIGZsb2F0IHRoZXRhX3NpbnRoZXRhID0gKCB4ID4gMC4wICkgPyB2IDogMC41ICogaW52ZXJzZXNxcnQoIG1heCggMS4wIC0geCAqIHgsIDFlLTcgKSApIC0gdjtcbiAgICByZXR1cm4gY3Jvc3MoIHYxLCB2MiApICogdGhldGFfc2ludGhldGE7XG59XG5cbnN0cnVjdCBDb29yZHMge1xuICAgIHZlYzMgY29vcmQwO1xuICAgIHZlYzMgY29vcmQxO1xuICAgIHZlYzMgY29vcmQyO1xuICAgIHZlYzMgY29vcmQzO1xufTtcblxuZmxvYXQgTFRDX0V2YWx1YXRlUmVjdCggY29uc3QgaW4gdmVjMyBOLCBjb25zdCBpbiB2ZWMzIFYsIGNvbnN0IGluIHZlYzMgUCwgY29uc3QgaW4gbWF0MyBtSW52LCBjb25zdCBpbiBDb29yZHMgcmVjdENvb3Jkcykge1xuICAgIC8vIGJhaWwgaWYgcG9pbnQgaXMgb24gYmFjayBzaWRlIG9mIHBsYW5lIG9mIGxpZ2h0XG4gICAgLy8gYXNzdW1lcyBjY3cgd2luZGluZyBvcmRlciBvZiBsaWdodCB2ZXJ0aWNlc1xuICAgIHZlYzMgdjEgPSByZWN0Q29vcmRzLmNvb3JkMSAtIHJlY3RDb29yZHMuY29vcmQwO1xuICAgIHZlYzMgdjIgPSByZWN0Q29vcmRzLmNvb3JkMyAtIHJlY3RDb29yZHMuY29vcmQwO1xuICAgIFxuICAgIHZlYzMgbGlnaHROb3JtYWwgPSBjcm9zcyggdjEsIHYyICk7XG4gICAgLy8gaWYoIGRvdCggbGlnaHROb3JtYWwsIFAgLSByZWN0Q29vcmRzLmNvb3JkMCApIDwgMC4wICkgcmV0dXJuIDAuMDtcbiAgICBmbG9hdCBmYWN0b3IgPSBzaWduKC1kb3QoIGxpZ2h0Tm9ybWFsLCBQIC0gcmVjdENvb3Jkcy5jb29yZDAgKSk7XG5cbiAgICAvLyBjb25zdHJ1Y3Qgb3J0aG9ub3JtYWwgYmFzaXMgYXJvdW5kIE5cbiAgICB2ZWMzIFQxLCBUMjtcbiAgICBUMSA9IG5vcm1hbGl6ZSggViAtIE4gKiBkb3QoIFYsIE4gKSApO1xuICAgIFQyID0gIGZhY3RvciAqIGNyb3NzKCBOLCBUMSApOyAvLyBuZWdhdGVkIGZyb20gcGFwZXI7IHBvc3NpYmx5IGR1ZSB0byBhIGRpZmZlcmVudCBoYW5kZWRuZXNzIG9mIHdvcmxkIGNvb3JkaW5hdGUgc3lzdGVtXG4gICAgLy8gY29tcHV0ZSB0cmFuc2Zvcm1cbiAgICBtYXQzIG1hdCA9IG1JbnYgKiB0cmFuc3Bvc2VNYXQzKCBtYXQzKCBUMSwgVDIsIE4gKSApO1xuICAgIC8vIHRyYW5zZm9ybSByZWN0XG4gICAgdmVjMyBjb29yZHNbIDQgXTtcbiAgICBjb29yZHNbIDAgXSA9IG1hdCAqICggcmVjdENvb3Jkcy5jb29yZDAgLSBQICk7XG4gICAgY29vcmRzWyAxIF0gPSBtYXQgKiAoIHJlY3RDb29yZHMuY29vcmQxIC0gUCApO1xuICAgIGNvb3Jkc1sgMiBdID0gbWF0ICogKCByZWN0Q29vcmRzLmNvb3JkMiAtIFAgKTtcbiAgICBjb29yZHNbIDMgXSA9IG1hdCAqICggcmVjdENvb3Jkcy5jb29yZDMgLSBQICk7XG4gICAgLy8gcHJvamVjdCByZWN0IG9udG8gc3BoZXJlXG4gICAgY29vcmRzWyAwIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMCBdICk7XG4gICAgY29vcmRzWyAxIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMSBdICk7XG4gICAgY29vcmRzWyAyIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMiBdICk7XG4gICAgY29vcmRzWyAzIF0gPSBub3JtYWxpemUoIGNvb3Jkc1sgMyBdICk7XG4gICAgLy8gY2FsY3VsYXRlIHZlY3RvciBmb3JtIGZhY3RvclxuICAgIHZlYzMgdmVjdG9yRm9ybUZhY3RvciA9IHZlYzMoIDAuMCApO1xuICAgIHZlY3RvckZvcm1GYWN0b3IgKz0gTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb29yZHNbIDAgXSwgY29vcmRzWyAxIF0gKTtcbiAgICB2ZWN0b3JGb3JtRmFjdG9yICs9IExUQ19FZGdlVmVjdG9yRm9ybUZhY3RvciggY29vcmRzWyAxIF0sIGNvb3Jkc1sgMiBdICk7XG4gICAgdmVjdG9yRm9ybUZhY3RvciArPSBMVENfRWRnZVZlY3RvckZvcm1GYWN0b3IoIGNvb3Jkc1sgMiBdLCBjb29yZHNbIDMgXSApO1xuICAgIHZlY3RvckZvcm1GYWN0b3IgKz0gTFRDX0VkZ2VWZWN0b3JGb3JtRmFjdG9yKCBjb29yZHNbIDMgXSwgY29vcmRzWyAwIF0gKTtcbiAgICAvLyBhZGp1c3QgZm9yIGhvcml6b24gY2xpcHBpbmdcbiAgICBmbG9hdCByZXN1bHQgPSBMVENfQ2xpcHBlZFNwaGVyZUZvcm1GYWN0b3IoIHZlY3RvckZvcm1GYWN0b3IgKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbkNvb3JkcyBkTFRDQ29vcmRzO1xuQ29vcmRzIGdldExUQ0xpZ2h0Q29vcmRzKHZlYzMgbGlnaHRQb3MsIHZlYzMgaGFsZldpZHRoLCB2ZWMzIGhhbGZIZWlnaHQpe1xuICAgIENvb3JkcyBjb29yZHM7XG4gICAgY29vcmRzLmNvb3JkMCA9IGxpZ2h0UG9zICsgaGFsZldpZHRoIC0gaGFsZkhlaWdodDtcbiAgICBjb29yZHMuY29vcmQxID0gbGlnaHRQb3MgLSBoYWxmV2lkdGggLSBoYWxmSGVpZ2h0O1xuICAgIGNvb3Jkcy5jb29yZDIgPSBsaWdodFBvcyAtIGhhbGZXaWR0aCArIGhhbGZIZWlnaHQ7XG4gICAgY29vcmRzLmNvb3JkMyA9IGxpZ2h0UG9zICsgaGFsZldpZHRoICsgaGFsZkhlaWdodDtcbiAgICByZXR1cm4gY29vcmRzO1xufVxuXG5mbG9hdCBkU3BoZXJlUmFkaXVzO1xuQ29vcmRzIGdldFNwaGVyZUxpZ2h0Q29vcmRzKHZlYzMgbGlnaHRQb3MsIHZlYzMgaGFsZldpZHRoLCB2ZWMzIGhhbGZIZWlnaHQpe1xuICAgIC8vIHVzZWQgZm9yIHNpbXBsZSBzcGhlcmUgbGlnaHQgZmFsbG9mZlxuICAgIC8vIGFsc28sIHRoZSBjb2RlIG9ubHkgaGFuZGxlcyBhIHNwaGVyaWNhbCBsaWdodCwgaXQgY2Fubm90IGJlIG5vbi11bmlmb3JtbHkgc2NhbGVkIGluIHdvcmxkIHNwYWNlLCBhbmQgc28gd2UgZW5mb3JjZSBpdCBoZXJlXG4gICAgZFNwaGVyZVJhZGl1cyA9IG1heChsZW5ndGgoaGFsZldpZHRoKSwgbGVuZ3RoKGhhbGZIZWlnaHQpKTtcblxuICAgIC8vIEJpbGxib2FyZCB0aGUgMmQgbGlnaHQgcXVhZCB0byByZWZsZWN0aW9uIHZlY3RvciwgYXMgaXQncyB1c2VkIGZvciBzcGVjdWxhci4gVGhpcyBhbGxvd3MgdXMgdG8gdXNlIGRpc2sgbWF0aCBmb3IgdGhlIHNwaGVyZS5cbiAgICB2ZWMzIGYgPSByZWZsZWN0KG5vcm1hbGl6ZShsaWdodFBvcyAtIHZpZXdfcG9zaXRpb24pLCB2Tm9ybWFsVyk7XG4gICAgdmVjMyB3ID0gbm9ybWFsaXplKGNyb3NzKGYsIGhhbGZIZWlnaHQpKTtcbiAgICB2ZWMzIGggPSBub3JtYWxpemUoY3Jvc3MoZiwgdykpO1xuXG4gICAgcmV0dXJuIGdldExUQ0xpZ2h0Q29vcmRzKGxpZ2h0UG9zLCB3ICogZFNwaGVyZVJhZGl1cywgaCAqIGRTcGhlcmVSYWRpdXMpO1xufVxuXG4vLyB1c2VkIGZvciBMVEMgTFVUIHRleHR1cmUgbG9va3VwXG52ZWMyIGRMVENVVjtcbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG52ZWMyIGNjTFRDVVY7XG4jZW5kaWZcbnZlYzIgZ2V0TFRDTGlnaHRVVihmbG9hdCBnbG9zcywgdmVjMyB3b3JsZE5vcm1hbCwgdmVjMyB2aWV3RGlyKVxue1xuICAgIGZsb2F0IHJvdWdobmVzcyA9IG1heCgoMS4wIC0gZ2xvc3MpICogKDEuMCAtIGdsb3NzKSwgMC4wMDEpO1xuICAgIHJldHVybiBMVENfVXYoIHdvcmxkTm9ybWFsLCB2aWV3RGlyLCByb3VnaG5lc3MgKTtcbn1cblxuLy91c2VkIGZvciBlbmVyZ3kgY29uc2VydmF0aW9uIGFuZCB0byBtb2R1bGF0ZSBzcGVjdWxhclxudmVjMyBkTFRDU3BlY0ZyZXM7XG4jaWZkZWYgTElUX0NMRUFSQ09BVFxudmVjMyBjY0xUQ1NwZWNGcmVzO1xuI2VuZGlmXG52ZWMzIGdldExUQ0xpZ2h0U3BlY0ZyZXModmVjMiB1diwgdmVjMyBzcGVjdWxhcml0eSlcbntcbiAgICB2ZWM0IHQyID0gdGV4dHVyZTJETG9kRVhUKGFyZWFMaWdodHNMdXRUZXgyLCB1diwgMC4wKTtcblxuICAgICNpZmRlZiBBUkVBX1I4X0c4X0I4X0E4X0xVVFNcbiAgICB0MiAqPSB2ZWM0KDAuNjkzMTAzLDEsMSwxKTtcbiAgICB0MiArPSB2ZWM0KDAuMzA2ODk3LDAsMCwwKTtcbiAgICAjZW5kaWZcblxuICAgIHJldHVybiBzcGVjdWxhcml0eSAqIHQyLnggKyAoIHZlYzMoIDEuMCApIC0gc3BlY3VsYXJpdHkpICogdDIueTtcbn1cblxudm9pZCBjYWxjTFRDTGlnaHRWYWx1ZXMoZmxvYXQgZ2xvc3MsIHZlYzMgd29ybGROb3JtYWwsIHZlYzMgdmlld0RpciwgdmVjMyBzcGVjdWxhcml0eSwgZmxvYXQgY2xlYXJjb2F0R2xvc3MsIHZlYzMgY2xlYXJjb2F0V29ybGROb3JtYWwsIGZsb2F0IGNsZWFyY29hdFNwZWN1bGFyaXR5KVxue1xuICAgIGRMVENVViA9IGdldExUQ0xpZ2h0VVYoZ2xvc3MsIHdvcmxkTm9ybWFsLCB2aWV3RGlyKTtcbiAgICBkTFRDU3BlY0ZyZXMgPSBnZXRMVENMaWdodFNwZWNGcmVzKGRMVENVViwgc3BlY3VsYXJpdHkpOyBcblxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbiAgICBjY0xUQ1VWID0gZ2V0TFRDTGlnaHRVVihjbGVhcmNvYXRHbG9zcywgY2xlYXJjb2F0V29ybGROb3JtYWwsIHZpZXdEaXIpO1xuICAgIGNjTFRDU3BlY0ZyZXMgPSBnZXRMVENMaWdodFNwZWNGcmVzKGNjTFRDVVYsIHZlYzMoY2xlYXJjb2F0U3BlY3VsYXJpdHkpKTtcbiNlbmRpZlxufVxuXG52b2lkIGNhbGNSZWN0TGlnaHRWYWx1ZXModmVjMyBsaWdodFBvcywgdmVjMyBoYWxmV2lkdGgsIHZlYzMgaGFsZkhlaWdodClcbntcbiAgICBkTFRDQ29vcmRzID0gZ2V0TFRDTGlnaHRDb29yZHMobGlnaHRQb3MsIGhhbGZXaWR0aCwgaGFsZkhlaWdodCk7XG59XG52b2lkIGNhbGNEaXNrTGlnaHRWYWx1ZXModmVjMyBsaWdodFBvcywgdmVjMyBoYWxmV2lkdGgsIHZlYzMgaGFsZkhlaWdodClcbntcbiAgICBjYWxjUmVjdExpZ2h0VmFsdWVzKGxpZ2h0UG9zLCBoYWxmV2lkdGgsIGhhbGZIZWlnaHQpO1xufVxudm9pZCBjYWxjU3BoZXJlTGlnaHRWYWx1ZXModmVjMyBsaWdodFBvcywgdmVjMyBoYWxmV2lkdGgsIHZlYzMgaGFsZkhlaWdodClcbntcbiAgICBkTFRDQ29vcmRzID0gZ2V0U3BoZXJlTGlnaHRDb29yZHMobGlnaHRQb3MsIGhhbGZXaWR0aCwgaGFsZkhlaWdodCk7XG59XG5cbi8vIEFuIGV4dGVuZGVkIHZlcnNpb24gb2YgdGhlIGltcGxlbWVudGF0aW9uIGZyb21cbi8vIFwiSG93IHRvIHNvbHZlIGEgY3ViaWMgZXF1YXRpb24sIHJldmlzaXRlZFwiXG4vLyBodHRwOi8vbW9tZW50c2luZ3JhcGhpY3MuZGUvP3A9MTA1XG52ZWMzIFNvbHZlQ3ViaWModmVjNCBDb2VmZmljaWVudClcbntcbiAgICBmbG9hdCBwaSA9IDMuMTQxNTk7XG4gICAgLy8gTm9ybWFsaXplIHRoZSBwb2x5bm9taWFsXG4gICAgQ29lZmZpY2llbnQueHl6IC89IENvZWZmaWNpZW50Lnc7XG4gICAgLy8gRGl2aWRlIG1pZGRsZSBjb2VmZmljaWVudHMgYnkgdGhyZWVcbiAgICBDb2VmZmljaWVudC55eiAvPSAzLjA7XG5cbiAgICBmbG9hdCBBID0gQ29lZmZpY2llbnQudztcbiAgICBmbG9hdCBCID0gQ29lZmZpY2llbnQuejtcbiAgICBmbG9hdCBDID0gQ29lZmZpY2llbnQueTtcbiAgICBmbG9hdCBEID0gQ29lZmZpY2llbnQueDtcblxuICAgIC8vIENvbXB1dGUgdGhlIEhlc3NpYW4gYW5kIHRoZSBkaXNjcmltaW5hbnRcbiAgICB2ZWMzIERlbHRhID0gdmVjMyhcbiAgICAgICAgLUNvZWZmaWNpZW50LnogKiBDb2VmZmljaWVudC56ICsgQ29lZmZpY2llbnQueSxcbiAgICAgICAgLUNvZWZmaWNpZW50LnkgKiBDb2VmZmljaWVudC56ICsgQ29lZmZpY2llbnQueCxcbiAgICAgICAgZG90KHZlYzIoQ29lZmZpY2llbnQueiwgLUNvZWZmaWNpZW50LnkpLCBDb2VmZmljaWVudC54eSlcbiAgICApO1xuXG4gICAgZmxvYXQgRGlzY3JpbWluYW50ID0gZG90KHZlYzIoNC4wICogRGVsdGEueCwgLURlbHRhLnkpLCBEZWx0YS56eSk7XG5cbiAgICB2ZWMzIFJvb3RzQSwgUm9vdHNEO1xuXG4gICAgdmVjMiB4bGMsIHhzYztcblxuICAgIC8vIEFsZ29yaXRobSBBXG4gICAge1xuICAgICAgICBmbG9hdCBBX2EgPSAxLjA7XG4gICAgICAgIGZsb2F0IENfYSA9IERlbHRhLng7XG4gICAgICAgIGZsb2F0IERfYSA9IC0yLjAgKiBCICogRGVsdGEueCArIERlbHRhLnk7XG5cbiAgICAgICAgLy8gVGFrZSB0aGUgY3ViaWMgcm9vdCBvZiBhIG5vcm1hbGl6ZWQgY29tcGxleCBudW1iZXJcbiAgICAgICAgZmxvYXQgVGhldGEgPSBhdGFuKHNxcnQoRGlzY3JpbWluYW50KSwgLURfYSkgLyAzLjA7XG5cbiAgICAgICAgZmxvYXQgeF8xYSA9IDIuMCAqIHNxcnQoLUNfYSkgKiBjb3MoVGhldGEpO1xuICAgICAgICBmbG9hdCB4XzNhID0gMi4wICogc3FydCgtQ19hKSAqIGNvcyhUaGV0YSArICgyLjAgLyAzLjApICogcGkpO1xuXG4gICAgICAgIGZsb2F0IHhsO1xuICAgICAgICBpZiAoKHhfMWEgKyB4XzNhKSA+IDIuMCAqIEIpXG4gICAgICAgICAgICB4bCA9IHhfMWE7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHhsID0geF8zYTtcblxuICAgICAgICB4bGMgPSB2ZWMyKHhsIC0gQiwgQSk7XG4gICAgfVxuXG4gICAgLy8gQWxnb3JpdGhtIERcbiAgICB7XG4gICAgICAgIGZsb2F0IEFfZCA9IEQ7XG4gICAgICAgIGZsb2F0IENfZCA9IERlbHRhLno7XG4gICAgICAgIGZsb2F0IERfZCA9IC1EICogRGVsdGEueSArIDIuMCAqIEMgKiBEZWx0YS56O1xuXG4gICAgICAgIC8vIFRha2UgdGhlIGN1YmljIHJvb3Qgb2YgYSBub3JtYWxpemVkIGNvbXBsZXggbnVtYmVyXG4gICAgICAgIGZsb2F0IFRoZXRhID0gYXRhbihEICogc3FydChEaXNjcmltaW5hbnQpLCAtRF9kKSAvIDMuMDtcblxuICAgICAgICBmbG9hdCB4XzFkID0gMi4wICogc3FydCgtQ19kKSAqIGNvcyhUaGV0YSk7XG4gICAgICAgIGZsb2F0IHhfM2QgPSAyLjAgKiBzcXJ0KC1DX2QpICogY29zKFRoZXRhICsgKDIuMCAvIDMuMCkgKiBwaSk7XG5cbiAgICAgICAgZmxvYXQgeHM7XG4gICAgICAgIGlmICh4XzFkICsgeF8zZCA8IDIuMCAqIEMpXG4gICAgICAgICAgICB4cyA9IHhfMWQ7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHhzID0geF8zZDtcblxuICAgICAgICB4c2MgPSB2ZWMyKC1ELCB4cyArIEMpO1xuICAgIH1cblxuICAgIGZsb2F0IEUgPSAgeGxjLnkgKiB4c2MueTtcbiAgICBmbG9hdCBGID0gLXhsYy54ICogeHNjLnkgLSB4bGMueSAqIHhzYy54O1xuICAgIGZsb2F0IEcgPSAgeGxjLnggKiB4c2MueDtcblxuICAgIHZlYzIgeG1jID0gdmVjMihDICogRiAtIEIgKiBHLCAtQiAqIEYgKyBDICogRSk7XG5cbiAgICB2ZWMzIFJvb3QgPSB2ZWMzKHhzYy54IC8geHNjLnksIHhtYy54IC8geG1jLnksIHhsYy54IC8geGxjLnkpO1xuXG4gICAgaWYgKFJvb3QueCA8IFJvb3QueSAmJiBSb290LnggPCBSb290LnopXG4gICAgICAgIFJvb3QueHl6ID0gUm9vdC55eHo7XG4gICAgZWxzZSBpZiAoUm9vdC56IDwgUm9vdC54ICYmIFJvb3QueiA8IFJvb3QueSlcbiAgICAgICAgUm9vdC54eXogPSBSb290Lnh6eTtcblxuICAgIHJldHVybiBSb290O1xufVxuXG5mbG9hdCBMVENfRXZhbHVhdGVEaXNrKHZlYzMgTiwgdmVjMyBWLCB2ZWMzIFAsIG1hdDMgTWludiwgQ29vcmRzIHBvaW50cylcbntcbiAgICAvLyBjb25zdHJ1Y3Qgb3J0aG9ub3JtYWwgYmFzaXMgYXJvdW5kIE5cbiAgICB2ZWMzIFQxLCBUMjtcbiAgICBUMSA9IG5vcm1hbGl6ZShWIC0gTiAqIGRvdChWLCBOKSk7XG4gICAgVDIgPSBjcm9zcyhOLCBUMSk7XG5cbiAgICAvLyByb3RhdGUgYXJlYSBsaWdodCBpbiAoVDEsIFQyLCBOKSBiYXNpc1xuICAgIC8vbWF0MyBSID0gdHJhbnNwb3NlKG1hdDMoVDEsIFQyLCBOKSk7XG4gICAgbWF0MyBSID0gdHJhbnNwb3NlTWF0MyggbWF0MyggVDEsIFQyLCBOICkgKTtcbiAgICAvLyBwb2x5Z29uIChhbGxvY2F0ZSA1IHZlcnRpY2VzIGZvciBjbGlwcGluZylcbiAgICB2ZWMzIExfWyAzIF07XG4gICAgTF9bIDAgXSA9IFIgKiAoIHBvaW50cy5jb29yZDAgLSBQICk7XG4gICAgTF9bIDEgXSA9IFIgKiAoIHBvaW50cy5jb29yZDEgLSBQICk7XG4gICAgTF9bIDIgXSA9IFIgKiAoIHBvaW50cy5jb29yZDIgLSBQICk7XG5cbiAgICB2ZWMzIExvX2kgPSB2ZWMzKDApO1xuXG4gICAgLy8gaW5pdCBlbGxpcHNlXG4gICAgdmVjMyBDICA9IDAuNSAqIChMX1swXSArIExfWzJdKTtcbiAgICB2ZWMzIFYxID0gMC41ICogKExfWzFdIC0gTF9bMl0pO1xuICAgIHZlYzMgVjIgPSAwLjUgKiAoTF9bMV0gLSBMX1swXSk7XG5cbiAgICBDICA9IE1pbnYgKiBDO1xuICAgIFYxID0gTWludiAqIFYxO1xuICAgIFYyID0gTWludiAqIFYyO1xuXG4gICAgLy9pZihkb3QoY3Jvc3MoVjEsIFYyKSwgQykgPiAwLjApXG4gICAgLy8gICAgcmV0dXJuIDAuMDtcblxuICAgIC8vIGNvbXB1dGUgZWlnZW52ZWN0b3JzIG9mIGVsbGlwc2VcbiAgICBmbG9hdCBhLCBiO1xuICAgIGZsb2F0IGQxMSA9IGRvdChWMSwgVjEpO1xuICAgIGZsb2F0IGQyMiA9IGRvdChWMiwgVjIpO1xuICAgIGZsb2F0IGQxMiA9IGRvdChWMSwgVjIpO1xuICAgIGlmIChhYnMoZDEyKSAvIHNxcnQoZDExICogZDIyKSA+IDAuMDAwMSlcbiAgICB7XG4gICAgICAgIGZsb2F0IHRyID0gZDExICsgZDIyO1xuICAgICAgICBmbG9hdCBkZXQgPSAtZDEyICogZDEyICsgZDExICogZDIyO1xuXG4gICAgICAgIC8vIHVzZSBzcXJ0IG1hdHJpeCB0byBzb2x2ZSBmb3IgZWlnZW52YWx1ZXNcbiAgICAgICAgZGV0ID0gc3FydChkZXQpO1xuICAgICAgICBmbG9hdCB1ID0gMC41ICogc3FydCh0ciAtIDIuMCAqIGRldCk7XG4gICAgICAgIGZsb2F0IHYgPSAwLjUgKiBzcXJ0KHRyICsgMi4wICogZGV0KTtcbiAgICAgICAgZmxvYXQgZV9tYXggPSAodSArIHYpICogKHUgKyB2KTtcbiAgICAgICAgZmxvYXQgZV9taW4gPSAodSAtIHYpICogKHUgLSB2KTtcblxuICAgICAgICB2ZWMzIFYxXywgVjJfO1xuXG4gICAgICAgIGlmIChkMTEgPiBkMjIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIFYxXyA9IGQxMiAqIFYxICsgKGVfbWF4IC0gZDExKSAqIFYyO1xuICAgICAgICAgICAgVjJfID0gZDEyICogVjEgKyAoZV9taW4gLSBkMTEpICogVjI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBWMV8gPSBkMTIqVjIgKyAoZV9tYXggLSBkMjIpKlYxO1xuICAgICAgICAgICAgVjJfID0gZDEyKlYyICsgKGVfbWluIC0gZDIyKSpWMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGEgPSAxLjAgLyBlX21heDtcbiAgICAgICAgYiA9IDEuMCAvIGVfbWluO1xuICAgICAgICBWMSA9IG5vcm1hbGl6ZShWMV8pO1xuICAgICAgICBWMiA9IG5vcm1hbGl6ZShWMl8pO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBhID0gMS4wIC8gZG90KFYxLCBWMSk7XG4gICAgICAgIGIgPSAxLjAgLyBkb3QoVjIsIFYyKTtcbiAgICAgICAgVjEgKj0gc3FydChhKTtcbiAgICAgICAgVjIgKj0gc3FydChiKTtcbiAgICB9XG5cbiAgICB2ZWMzIFYzID0gY3Jvc3MoVjEsIFYyKTtcbiAgICBpZiAoZG90KEMsIFYzKSA8IDAuMClcbiAgICAgICAgVjMgKj0gLTEuMDtcblxuICAgIGZsb2F0IEwgID0gZG90KFYzLCBDKTtcbiAgICBmbG9hdCB4MCA9IGRvdChWMSwgQykgLyBMO1xuICAgIGZsb2F0IHkwID0gZG90KFYyLCBDKSAvIEw7XG5cbiAgICBmbG9hdCBFMSA9IGludmVyc2VzcXJ0KGEpO1xuICAgIGZsb2F0IEUyID0gaW52ZXJzZXNxcnQoYik7XG5cbiAgICBhICo9IEwgKiBMO1xuICAgIGIgKj0gTCAqIEw7XG5cbiAgICBmbG9hdCBjMCA9IGEgKiBiO1xuICAgIGZsb2F0IGMxID0gYSAqIGIgKiAoMS4wICsgeDAgKiB4MCArIHkwICogeTApIC0gYSAtIGI7XG4gICAgZmxvYXQgYzIgPSAxLjAgLSBhICogKDEuMCArIHgwICogeDApIC0gYiAqICgxLjAgKyB5MCAqIHkwKTtcbiAgICBmbG9hdCBjMyA9IDEuMDtcblxuICAgIHZlYzMgcm9vdHMgPSBTb2x2ZUN1YmljKHZlYzQoYzAsIGMxLCBjMiwgYzMpKTtcbiAgICBmbG9hdCBlMSA9IHJvb3RzLng7XG4gICAgZmxvYXQgZTIgPSByb290cy55O1xuICAgIGZsb2F0IGUzID0gcm9vdHMuejtcblxuICAgIHZlYzMgYXZnRGlyID0gdmVjMyhhICogeDAgLyAoYSAtIGUyKSwgYiAqIHkwIC8gKGIgLSBlMiksIDEuMCk7XG5cbiAgICBtYXQzIHJvdGF0ZSA9IG1hdDMoVjEsIFYyLCBWMyk7XG5cbiAgICBhdmdEaXIgPSByb3RhdGUgKiBhdmdEaXI7XG4gICAgYXZnRGlyID0gbm9ybWFsaXplKGF2Z0Rpcik7XG5cbiAgICBmbG9hdCBMMSA9IHNxcnQoLWUyIC8gZTMpO1xuICAgIGZsb2F0IEwyID0gc3FydCgtZTIgLyBlMSk7XG5cbiAgICBmbG9hdCBmb3JtRmFjdG9yID0gTDEgKiBMMiAqIGludmVyc2VzcXJ0KCgxLjAgKyBMMSAqIEwxKSAqICgxLjAgKyBMMiAqIEwyKSk7XG4gICAgXG4gICAgY29uc3QgZmxvYXQgTFVUX1NJWkUgPSA2NC4wO1xuICAgIGNvbnN0IGZsb2F0IExVVF9TQ0FMRSA9ICggTFVUX1NJWkUgLSAxLjAgKSAvIExVVF9TSVpFO1xuICAgIGNvbnN0IGZsb2F0IExVVF9CSUFTID0gMC41IC8gTFVUX1NJWkU7XG5cbiAgICAvLyB1c2UgdGFidWxhdGVkIGhvcml6b24tY2xpcHBlZCBzcGhlcmVcbiAgICB2ZWMyIHV2ID0gdmVjMihhdmdEaXIueiAqIDAuNSArIDAuNSwgZm9ybUZhY3Rvcik7XG4gICAgdXYgPSB1dipMVVRfU0NBTEUgKyBMVVRfQklBUztcblxuICAgIGZsb2F0IHNjYWxlID0gdGV4dHVyZTJETG9kRVhUKGFyZWFMaWdodHNMdXRUZXgyLCB1diwgMC4wKS53O1xuXG4gICAgcmV0dXJuIGZvcm1GYWN0b3Iqc2NhbGU7XG59XG5cbmZsb2F0IGdldFJlY3RMaWdodERpZmZ1c2UodmVjMyB3b3JsZE5vcm1hbCwgdmVjMyB2aWV3RGlyLCB2ZWMzIGxpZ2h0RGlyLCB2ZWMzIGxpZ2h0RGlyTm9ybSkge1xuICAgIHJldHVybiBMVENfRXZhbHVhdGVSZWN0KCB3b3JsZE5vcm1hbCwgdmlld0RpciwgdlBvc2l0aW9uVywgbWF0MyggMS4wICksIGRMVENDb29yZHMgKTtcbn1cblxuZmxvYXQgZ2V0RGlza0xpZ2h0RGlmZnVzZSh2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIsIHZlYzMgbGlnaHREaXIsIHZlYzMgbGlnaHREaXJOb3JtKSB7XG4gICAgcmV0dXJuIExUQ19FdmFsdWF0ZURpc2soIHdvcmxkTm9ybWFsLCB2aWV3RGlyLCB2UG9zaXRpb25XLCBtYXQzKCAxLjAgKSwgZExUQ0Nvb3JkcyApO1xufVxuXG5mbG9hdCBnZXRTcGhlcmVMaWdodERpZmZ1c2UodmVjMyB3b3JsZE5vcm1hbCwgdmVjMyB2aWV3RGlyLCB2ZWMzIGxpZ2h0RGlyLCB2ZWMzIGxpZ2h0RGlyTm9ybSkge1xuICAgIC8vIE5COiB0aGlzIGNvdWxkIGJlIGltcHJvdmVkIGZ1cnRoZXIgd2l0aCBkaXN0YW5jZSBiYXNlZCB3cmFwIGxpZ2h0aW5nXG4gICAgZmxvYXQgZmFsbG9mZiA9IGRTcGhlcmVSYWRpdXMgLyAoZG90KGxpZ2h0RGlyLCBsaWdodERpcikgKyBkU3BoZXJlUmFkaXVzKTtcbiAgICByZXR1cm4gZ2V0TGlnaHREaWZmdXNlKHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBsaWdodERpciwgbGlnaHREaXJOb3JtKSAqIGZhbGxvZmY7XG59XG5cbm1hdDMgZ2V0TFRDTGlnaHRJbnZNYXQodmVjMiB1dilcbntcbiAgICB2ZWM0IHQxID0gdGV4dHVyZTJETG9kRVhUKGFyZWFMaWdodHNMdXRUZXgxLCB1diwgMC4wKTtcblxuICAgICNpZmRlZiBBUkVBX1I4X0c4X0I4X0E4X0xVVFNcbiAgICB0MSAqPSB2ZWM0KDEuMDAxLCAwLjMyMzksIDAuNjA0Mzc1NjgsIDEuMCk7XG4gICAgdDEgKz0gdmVjNCgwLjAsIC0wLjI5NzYsIC0wLjAxMzgxLCAwLjApO1xuICAgICNlbmRpZlxuXG4gICAgcmV0dXJuIG1hdDMoXG4gICAgICAgIHZlYzMoIHQxLngsIDAsIHQxLnkgKSxcbiAgICAgICAgdmVjMyggICAgMCwgMSwgICAgMCApLFxuICAgICAgICB2ZWMzKCB0MS56LCAwLCB0MS53IClcbiAgICApO1xufVxuXG5mbG9hdCBjYWxjUmVjdExpZ2h0U3BlY3VsYXIodmVjMyB3b3JsZE5vcm1hbCwgdmVjMyB2aWV3RGlyLCB2ZWMyIHV2KSB7XG4gICAgbWF0MyBtSW52ID0gZ2V0TFRDTGlnaHRJbnZNYXQodXYpO1xuICAgIHJldHVybiBMVENfRXZhbHVhdGVSZWN0KCB3b3JsZE5vcm1hbCwgdmlld0RpciwgdlBvc2l0aW9uVywgbUludiwgZExUQ0Nvb3JkcyApO1xufVxuXG5mbG9hdCBnZXRSZWN0TGlnaHRTcGVjdWxhcih2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIpIHtcbiAgICByZXR1cm4gY2FsY1JlY3RMaWdodFNwZWN1bGFyKHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBkTFRDVVYpO1xufVxuXG5mbG9hdCBjYWxjRGlza0xpZ2h0U3BlY3VsYXIodmVjMyB3b3JsZE5vcm1hbCwgdmVjMyB2aWV3RGlyLCB2ZWMyIHV2KSB7XG4gICAgbWF0MyBtSW52ID0gZ2V0TFRDTGlnaHRJbnZNYXQodXYpO1xuICAgIHJldHVybiBMVENfRXZhbHVhdGVEaXNrKCB3b3JsZE5vcm1hbCwgdmlld0RpciwgdlBvc2l0aW9uVywgbUludiwgZExUQ0Nvb3JkcyApO1xufVxuXG5mbG9hdCBnZXREaXNrTGlnaHRTcGVjdWxhcih2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIpIHtcbiAgICByZXR1cm4gY2FsY0Rpc2tMaWdodFNwZWN1bGFyKHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBkTFRDVVYpO1xufVxuXG5mbG9hdCBnZXRTcGhlcmVMaWdodFNwZWN1bGFyKHZlYzMgd29ybGROb3JtYWwsIHZlYzMgdmlld0Rpcikge1xuICAgIHJldHVybiBjYWxjRGlza0xpZ2h0U3BlY3VsYXIod29ybGROb3JtYWwsIHZpZXdEaXIsIGRMVENVVik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
