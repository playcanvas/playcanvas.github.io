/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowStandardPS = `
vec3 lessThan2(vec3 a, vec3 b) {
    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version
}

#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif

// ----- Direct/Spot Sampling -----

#ifdef GL2
float _getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
    float z = dShadowCoord.z;
    vec2 uv = dShadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
    float shadowMapSizeInv = 1.0 / shadowParams.x;
    vec2 base_uv = floor(uv + 0.5);
    float s = (uv.x + 0.5 - base_uv.x);
    float t = (uv.y + 0.5 - base_uv.y);
    base_uv -= vec2(0.5);
    base_uv *= shadowMapSizeInv;

    float sum = 0.0;

    float uw0 = (3.0 - 2.0 * s);
    float uw1 = (1.0 + 2.0 * s);

    float u0 = (2.0 - s) / uw0 - 1.0;
    float u1 = s / uw1 + 1.0;

    float vw0 = (3.0 - 2.0 * t);
    float vw1 = (1.0 + 2.0 * t);

    float v0 = (2.0 - t) / vw0 - 1.0;
    float v1 = t / vw1 + 1.0;

    u0 = u0 * shadowMapSizeInv + base_uv.x;
    v0 = v0 * shadowMapSizeInv + base_uv.y;

    u1 = u1 * shadowMapSizeInv + base_uv.x;
    v1 = v1 * shadowMapSizeInv + base_uv.y;

    sum += uw0 * vw0 * texture(shadowMap, vec3(u0, v0, z));
    sum += uw1 * vw0 * texture(shadowMap, vec3(u1, v0, z));
    sum += uw0 * vw1 * texture(shadowMap, vec3(u0, v1, z));
    sum += uw1 * vw1 * texture(shadowMap, vec3(u1, v1, z));

    sum *= 1.0f / 16.0;
    return sum;
}

float getShadowPCF3x3(sampler2DShadow shadowMap, vec3 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowParams);
}

float getShadowSpotPCF3x3(sampler2DShadow shadowMap, vec4 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
}
#else
float _xgetShadowPCF3x3(mat3 depthKernel, sampler2D shadowMap, vec3 shadowParams) {
    mat3 shadowKernel;
    vec3 shadowCoord = dShadowCoord;
    vec3 shadowZ = vec3(shadowCoord.z);
    shadowKernel[0] = vec3(greaterThan(depthKernel[0], shadowZ));
    shadowKernel[1] = vec3(greaterThan(depthKernel[1], shadowZ));
    shadowKernel[2] = vec3(greaterThan(depthKernel[2], shadowZ));

    vec2 fractionalCoord = fract( shadowCoord.xy * shadowParams.x );

    shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);
    shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);

    vec4 shadowValues;
    shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);
    shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);
    shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);
    shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);

    return dot( shadowValues, vec4( 1.0 ) ) * 0.25;
}

float _getShadowPCF3x3(sampler2D shadowMap, vec3 shadowParams) {
    vec3 shadowCoord = dShadowCoord;

    float xoffset = 1.0 / shadowParams.x; // 1/shadow map width
    float dx0 = -xoffset;
    float dx1 = xoffset;

    mat3 depthKernel;
    depthKernel[0][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx0)));
    depthKernel[0][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));
    depthKernel[0][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx1)));
    depthKernel[1][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx0)));
    depthKernel[1][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy));
    depthKernel[1][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx1)));
    depthKernel[2][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx0)));
    depthKernel[2][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));
    depthKernel[2][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx1)));

    return _xgetShadowPCF3x3(depthKernel, shadowMap, shadowParams);
}

float getShadowPCF3x3(sampler2D shadowMap, vec3 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowParams);
}

float getShadowSpotPCF3x3(sampler2D shadowMap, vec4 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowParams.xyz);
}
#endif


// ----- Omni Sampling -----

float _getShadowPoint(samplerCube shadowMap, vec4 shadowParams, vec3 dir) {

    vec3 tc = normalize(dir);
    vec3 tcAbs = abs(tc);

    vec4 dirX = vec4(1,0,0, tc.x);
    vec4 dirY = vec4(0,1,0, tc.y);
    float majorAxisLength = tc.z;
    if ((tcAbs.x > tcAbs.y) && (tcAbs.x > tcAbs.z)) {
        dirX = vec4(0,0,1, tc.z);
        dirY = vec4(0,1,0, tc.y);
        majorAxisLength = tc.x;
    } else if ((tcAbs.y > tcAbs.x) && (tcAbs.y > tcAbs.z)) {
        dirX = vec4(1,0,0, tc.x);
        dirY = vec4(0,0,1, tc.z);
        majorAxisLength = tc.y;
    }

    float shadowParamsInFaceSpace = ((1.0/shadowParams.x) * 2.0) * abs(majorAxisLength);

    vec3 xoffset = (dirX.xyz * shadowParamsInFaceSpace);
    vec3 yoffset = (dirY.xyz * shadowParamsInFaceSpace);
    vec3 dx0 = -xoffset;
    vec3 dy0 = -yoffset;
    vec3 dx1 = xoffset;
    vec3 dy1 = yoffset;

    mat3 shadowKernel;
    mat3 depthKernel;

    depthKernel[0][0] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy0));
    depthKernel[0][1] = unpackFloat(textureCube(shadowMap, tc + dx0));
    depthKernel[0][2] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy1));
    depthKernel[1][0] = unpackFloat(textureCube(shadowMap, tc + dy0));
    depthKernel[1][1] = unpackFloat(textureCube(shadowMap, tc));
    depthKernel[1][2] = unpackFloat(textureCube(shadowMap, tc + dy1));
    depthKernel[2][0] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy0));
    depthKernel[2][1] = unpackFloat(textureCube(shadowMap, tc + dx1));
    depthKernel[2][2] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy1));

    vec3 shadowZ = vec3(length(dir) * shadowParams.w + shadowParams.z);

    shadowKernel[0] = vec3(lessThan2(depthKernel[0], shadowZ));
    shadowKernel[1] = vec3(lessThan2(depthKernel[1], shadowZ));
    shadowKernel[2] = vec3(lessThan2(depthKernel[2], shadowZ));

    vec2 uv = (vec2(dirX.w, dirY.w) / abs(majorAxisLength)) * 0.5;

    vec2 fractionalCoord = fract( uv * shadowParams.x );

    shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);
    shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);

    vec4 shadowValues;
    shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);
    shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);
    shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);
    shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);

    return 1.0 - dot( shadowValues, vec4( 1.0 ) ) * 0.25;
}

float getShadowPointPCF3x3(samplerCube shadowMap, vec4 shadowParams) {
    return _getShadowPoint(shadowMap, shadowParams, dLightDirW);
}
`;

export { shadowStandardPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93U3RhbmRhcmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgbGVzc1RoYW4yKHZlYzMgYSwgdmVjMyBiKSB7XG4gICAgcmV0dXJuIGNsYW1wKChiIC0gYSkqMTAwMC4wLCAwLjAsIDEuMCk7IC8vIHNvZnRlciB2ZXJzaW9uXG59XG5cbiNpZm5kZWYgVU5QQUNLRkxPQVRcbiNkZWZpbmUgVU5QQUNLRkxPQVRcbmZsb2F0IHVucGFja0Zsb2F0KHZlYzQgcmdiYURlcHRoKSB7XG4gICAgY29uc3QgdmVjNCBiaXRTaGlmdCA9IHZlYzQoMS4wIC8gKDI1Ni4wICogMjU2LjAgKiAyNTYuMCksIDEuMCAvICgyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gMjU2LjAsIDEuMCk7XG4gICAgcmV0dXJuIGRvdChyZ2JhRGVwdGgsIGJpdFNoaWZ0KTtcbn1cbiNlbmRpZlxuXG4vLyAtLS0tLSBEaXJlY3QvU3BvdCBTYW1wbGluZyAtLS0tLVxuXG4jaWZkZWYgR0wyXG5mbG9hdCBfZ2V0U2hhZG93UENGM3gzKHNhbXBsZXIyRFNoYWRvdyBzaGFkb3dNYXAsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgZmxvYXQgeiA9IGRTaGFkb3dDb29yZC56O1xuICAgIHZlYzIgdXYgPSBkU2hhZG93Q29vcmQueHkgKiBzaGFkb3dQYXJhbXMueDsgLy8gMSB1bml0IC0gMSB0ZXhlbFxuICAgIGZsb2F0IHNoYWRvd01hcFNpemVJbnYgPSAxLjAgLyBzaGFkb3dQYXJhbXMueDtcbiAgICB2ZWMyIGJhc2VfdXYgPSBmbG9vcih1diArIDAuNSk7XG4gICAgZmxvYXQgcyA9ICh1di54ICsgMC41IC0gYmFzZV91di54KTtcbiAgICBmbG9hdCB0ID0gKHV2LnkgKyAwLjUgLSBiYXNlX3V2LnkpO1xuICAgIGJhc2VfdXYgLT0gdmVjMigwLjUpO1xuICAgIGJhc2VfdXYgKj0gc2hhZG93TWFwU2l6ZUludjtcblxuICAgIGZsb2F0IHN1bSA9IDAuMDtcblxuICAgIGZsb2F0IHV3MCA9ICgzLjAgLSAyLjAgKiBzKTtcbiAgICBmbG9hdCB1dzEgPSAoMS4wICsgMi4wICogcyk7XG5cbiAgICBmbG9hdCB1MCA9ICgyLjAgLSBzKSAvIHV3MCAtIDEuMDtcbiAgICBmbG9hdCB1MSA9IHMgLyB1dzEgKyAxLjA7XG5cbiAgICBmbG9hdCB2dzAgPSAoMy4wIC0gMi4wICogdCk7XG4gICAgZmxvYXQgdncxID0gKDEuMCArIDIuMCAqIHQpO1xuXG4gICAgZmxvYXQgdjAgPSAoMi4wIC0gdCkgLyB2dzAgLSAxLjA7XG4gICAgZmxvYXQgdjEgPSB0IC8gdncxICsgMS4wO1xuXG4gICAgdTAgPSB1MCAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lng7XG4gICAgdjAgPSB2MCAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lnk7XG5cbiAgICB1MSA9IHUxICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueDtcbiAgICB2MSA9IHYxICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueTtcblxuICAgIHN1bSArPSB1dzAgKiB2dzAgKiB0ZXh0dXJlKHNoYWRvd01hcCwgdmVjMyh1MCwgdjAsIHopKTtcbiAgICBzdW0gKz0gdXcxICogdncwICogdGV4dHVyZShzaGFkb3dNYXAsIHZlYzModTEsIHYwLCB6KSk7XG4gICAgc3VtICs9IHV3MCAqIHZ3MSAqIHRleHR1cmUoc2hhZG93TWFwLCB2ZWMzKHUwLCB2MSwgeikpO1xuICAgIHN1bSArPSB1dzEgKiB2dzEgKiB0ZXh0dXJlKHNoYWRvd01hcCwgdmVjMyh1MSwgdjEsIHopKTtcblxuICAgIHN1bSAqPSAxLjBmIC8gMTYuMDtcbiAgICByZXR1cm4gc3VtO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQQ0YzeDMoc2FtcGxlcjJEU2hhZG93IHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcyk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RQQ0YzeDMoc2FtcGxlcjJEU2hhZG93IHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcy54eXopO1xufVxuI2Vsc2VcbmZsb2F0IF94Z2V0U2hhZG93UENGM3gzKG1hdDMgZGVwdGhLZXJuZWwsIHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgbWF0MyBzaGFkb3dLZXJuZWw7XG4gICAgdmVjMyBzaGFkb3dDb29yZCA9IGRTaGFkb3dDb29yZDtcbiAgICB2ZWMzIHNoYWRvd1ogPSB2ZWMzKHNoYWRvd0Nvb3JkLnopO1xuICAgIHNoYWRvd0tlcm5lbFswXSA9IHZlYzMoZ3JlYXRlclRoYW4oZGVwdGhLZXJuZWxbMF0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMV0gPSB2ZWMzKGdyZWF0ZXJUaGFuKGRlcHRoS2VybmVsWzFdLCBzaGFkb3daKSk7XG4gICAgc2hhZG93S2VybmVsWzJdID0gdmVjMyhncmVhdGVyVGhhbihkZXB0aEtlcm5lbFsyXSwgc2hhZG93WikpO1xuXG4gICAgdmVjMiBmcmFjdGlvbmFsQ29vcmQgPSBmcmFjdCggc2hhZG93Q29vcmQueHkgKiBzaGFkb3dQYXJhbXMueCApO1xuXG4gICAgc2hhZG93S2VybmVsWzBdID0gbWl4KHNoYWRvd0tlcm5lbFswXSwgc2hhZG93S2VybmVsWzFdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG4gICAgc2hhZG93S2VybmVsWzFdID0gbWl4KHNoYWRvd0tlcm5lbFsxXSwgc2hhZG93S2VybmVsWzJdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG5cbiAgICB2ZWM0IHNoYWRvd1ZhbHVlcztcbiAgICBzaGFkb3dWYWx1ZXMueCA9IG1peChzaGFkb3dLZXJuZWxbMF1bMF0sIHNoYWRvd0tlcm5lbFswXVsxXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy55ID0gbWl4KHNoYWRvd0tlcm5lbFswXVsxXSwgc2hhZG93S2VybmVsWzBdWzJdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLnogPSBtaXgoc2hhZG93S2VybmVsWzFdWzBdLCBzaGFkb3dLZXJuZWxbMV1bMV0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMudyA9IG1peChzaGFkb3dLZXJuZWxbMV1bMV0sIHNoYWRvd0tlcm5lbFsxXVsyXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuXG4gICAgcmV0dXJuIGRvdCggc2hhZG93VmFsdWVzLCB2ZWM0KCAxLjAgKSApICogMC4yNTtcbn1cblxuZmxvYXQgX2dldFNoYWRvd1BDRjN4MyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIHZlYzMgc2hhZG93Q29vcmQgPSBkU2hhZG93Q29vcmQ7XG5cbiAgICBmbG9hdCB4b2Zmc2V0ID0gMS4wIC8gc2hhZG93UGFyYW1zLng7IC8vIDEvc2hhZG93IG1hcCB3aWR0aFxuICAgIGZsb2F0IGR4MCA9IC14b2Zmc2V0O1xuICAgIGZsb2F0IGR4MSA9IHhvZmZzZXQ7XG5cbiAgICBtYXQzIGRlcHRoS2VybmVsO1xuICAgIGRlcHRoS2VybmVsWzBdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZTJEKHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZTJEKHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MCwgMC4wKSkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzJdID0gdW5wYWNrRmxvYXQodGV4dHVyZTJEKHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MCwgZHgxKSkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZTJEKHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZTJEKHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkpKTtcbiAgICBkZXB0aEtlcm5lbFsxXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmUyRChzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMigwLjAsIGR4MSkpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmUyRChzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDEsIGR4MCkpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmUyRChzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDEsIDAuMCkpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmUyRChzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDEsIGR4MSkpKTtcblxuICAgIHJldHVybiBfeGdldFNoYWRvd1BDRjN4MyhkZXB0aEtlcm5lbCwgc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQQ0YzeDMoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcyk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RQQ0YzeDMoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcy54eXopO1xufVxuI2VuZGlmXG5cblxuLy8gLS0tLS0gT21uaSBTYW1wbGluZyAtLS0tLVxuXG5mbG9hdCBfZ2V0U2hhZG93UG9pbnQoc2FtcGxlckN1YmUgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBkaXIpIHtcblxuICAgIHZlYzMgdGMgPSBub3JtYWxpemUoZGlyKTtcbiAgICB2ZWMzIHRjQWJzID0gYWJzKHRjKTtcblxuICAgIHZlYzQgZGlyWCA9IHZlYzQoMSwwLDAsIHRjLngpO1xuICAgIHZlYzQgZGlyWSA9IHZlYzQoMCwxLDAsIHRjLnkpO1xuICAgIGZsb2F0IG1ham9yQXhpc0xlbmd0aCA9IHRjLno7XG4gICAgaWYgKCh0Y0Ficy54ID4gdGNBYnMueSkgJiYgKHRjQWJzLnggPiB0Y0Ficy56KSkge1xuICAgICAgICBkaXJYID0gdmVjNCgwLDAsMSwgdGMueik7XG4gICAgICAgIGRpclkgPSB2ZWM0KDAsMSwwLCB0Yy55KTtcbiAgICAgICAgbWFqb3JBeGlzTGVuZ3RoID0gdGMueDtcbiAgICB9IGVsc2UgaWYgKCh0Y0Ficy55ID4gdGNBYnMueCkgJiYgKHRjQWJzLnkgPiB0Y0Ficy56KSkge1xuICAgICAgICBkaXJYID0gdmVjNCgxLDAsMCwgdGMueCk7XG4gICAgICAgIGRpclkgPSB2ZWM0KDAsMCwxLCB0Yy56KTtcbiAgICAgICAgbWFqb3JBeGlzTGVuZ3RoID0gdGMueTtcbiAgICB9XG5cbiAgICBmbG9hdCBzaGFkb3dQYXJhbXNJbkZhY2VTcGFjZSA9ICgoMS4wL3NoYWRvd1BhcmFtcy54KSAqIDIuMCkgKiBhYnMobWFqb3JBeGlzTGVuZ3RoKTtcblxuICAgIHZlYzMgeG9mZnNldCA9IChkaXJYLnh5eiAqIHNoYWRvd1BhcmFtc0luRmFjZVNwYWNlKTtcbiAgICB2ZWMzIHlvZmZzZXQgPSAoZGlyWS54eXogKiBzaGFkb3dQYXJhbXNJbkZhY2VTcGFjZSk7XG4gICAgdmVjMyBkeDAgPSAteG9mZnNldDtcbiAgICB2ZWMzIGR5MCA9IC15b2Zmc2V0O1xuICAgIHZlYzMgZHgxID0geG9mZnNldDtcbiAgICB2ZWMzIGR5MSA9IHlvZmZzZXQ7XG5cbiAgICBtYXQzIHNoYWRvd0tlcm5lbDtcbiAgICBtYXQzIGRlcHRoS2VybmVsO1xuXG4gICAgZGVwdGhLZXJuZWxbMF1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHgwICsgZHkwKSk7XG4gICAgZGVwdGhLZXJuZWxbMF1bMV0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHgwKSk7XG4gICAgZGVwdGhLZXJuZWxbMF1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHgwICsgZHkxKSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHkwKSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMV0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjKSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHkxKSk7XG4gICAgZGVwdGhLZXJuZWxbMl1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHgxICsgZHkwKSk7XG4gICAgZGVwdGhLZXJuZWxbMl1bMV0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHgxKSk7XG4gICAgZGVwdGhLZXJuZWxbMl1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlQ3ViZShzaGFkb3dNYXAsIHRjICsgZHgxICsgZHkxKSk7XG5cbiAgICB2ZWMzIHNoYWRvd1ogPSB2ZWMzKGxlbmd0aChkaXIpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMueik7XG5cbiAgICBzaGFkb3dLZXJuZWxbMF0gPSB2ZWMzKGxlc3NUaGFuMihkZXB0aEtlcm5lbFswXSwgc2hhZG93WikpO1xuICAgIHNoYWRvd0tlcm5lbFsxXSA9IHZlYzMobGVzc1RoYW4yKGRlcHRoS2VybmVsWzFdLCBzaGFkb3daKSk7XG4gICAgc2hhZG93S2VybmVsWzJdID0gdmVjMyhsZXNzVGhhbjIoZGVwdGhLZXJuZWxbMl0sIHNoYWRvd1opKTtcblxuICAgIHZlYzIgdXYgPSAodmVjMihkaXJYLncsIGRpclkudykgLyBhYnMobWFqb3JBeGlzTGVuZ3RoKSkgKiAwLjU7XG5cbiAgICB2ZWMyIGZyYWN0aW9uYWxDb29yZCA9IGZyYWN0KCB1diAqIHNoYWRvd1BhcmFtcy54ICk7XG5cbiAgICBzaGFkb3dLZXJuZWxbMF0gPSBtaXgoc2hhZG93S2VybmVsWzBdLCBzaGFkb3dLZXJuZWxbMV0sIGZyYWN0aW9uYWxDb29yZC54KTtcbiAgICBzaGFkb3dLZXJuZWxbMV0gPSBtaXgoc2hhZG93S2VybmVsWzFdLCBzaGFkb3dLZXJuZWxbMl0sIGZyYWN0aW9uYWxDb29yZC54KTtcblxuICAgIHZlYzQgc2hhZG93VmFsdWVzO1xuICAgIHNoYWRvd1ZhbHVlcy54ID0gbWl4KHNoYWRvd0tlcm5lbFswXVswXSwgc2hhZG93S2VybmVsWzBdWzFdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLnkgPSBtaXgoc2hhZG93S2VybmVsWzBdWzFdLCBzaGFkb3dLZXJuZWxbMF1bMl0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMueiA9IG1peChzaGFkb3dLZXJuZWxbMV1bMF0sIHNoYWRvd0tlcm5lbFsxXVsxXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy53ID0gbWl4KHNoYWRvd0tlcm5lbFsxXVsxXSwgc2hhZG93S2VybmVsWzFdWzJdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG5cbiAgICByZXR1cm4gMS4wIC0gZG90KCBzaGFkb3dWYWx1ZXMsIHZlYzQoIDEuMCApICkgKiAwLjI1O1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQb2ludFBDRjN4MyhzYW1wbGVyQ3ViZSBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIF9nZXRTaGFkb3dQb2ludChzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcywgZExpZ2h0RGlyVyk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBdkxBOzs7OyJ9
