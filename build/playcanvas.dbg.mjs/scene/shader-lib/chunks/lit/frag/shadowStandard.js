/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowStandardPS = /* glsl */`
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

float _getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowParams) {
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

    sum += uw0 * vw0 * textureShadow(shadowMap, vec3(u0, v0, z));
    sum += uw1 * vw0 * textureShadow(shadowMap, vec3(u1, v0, z));
    sum += uw0 * vw1 * textureShadow(shadowMap, vec3(u0, v1, z));
    sum += uw1 * vw1 * textureShadow(shadowMap, vec3(u1, v1, z));

    sum *= 1.0f / 16.0;
    return sum;
}

float getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowParams);
}

float getShadowSpotPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowParams.xyz);
}

#else // GL1

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
    depthKernel[0][0] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(dx0, dx0)));
    depthKernel[0][1] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));
    depthKernel[0][2] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(dx0, dx1)));
    depthKernel[1][0] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(0.0, dx0)));
    depthKernel[1][1] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy));
    depthKernel[1][2] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(0.0, dx1)));
    depthKernel[2][0] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(dx1, dx0)));
    depthKernel[2][1] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));
    depthKernel[2][2] = unpackFloat(textureShadow(shadowMap, shadowCoord.xy + vec2(dx1, dx1)));

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

#ifndef WEBGPU

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

#endif
`;

export { shadowStandardPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dTdGFuZGFyZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBsZXNzVGhhbjIodmVjMyBhLCB2ZWMzIGIpIHtcbiAgICByZXR1cm4gY2xhbXAoKGIgLSBhKSoxMDAwLjAsIDAuMCwgMS4wKTsgLy8gc29mdGVyIHZlcnNpb25cbn1cblxuI2lmbmRlZiBVTlBBQ0tGTE9BVFxuI2RlZmluZSBVTlBBQ0tGTE9BVFxuZmxvYXQgdW5wYWNrRmxvYXQodmVjNCByZ2JhRGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdFNoaWZ0ID0gdmVjNCgxLjAgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gKDI1Ni4wICogMjU2LjApLCAxLjAgLyAyNTYuMCwgMS4wKTtcbiAgICByZXR1cm4gZG90KHJnYmFEZXB0aCwgYml0U2hpZnQpO1xufVxuI2VuZGlmXG5cbi8vIC0tLS0tIERpcmVjdC9TcG90IFNhbXBsaW5nIC0tLS0tXG5cbiNpZmRlZiBHTDJcblxuZmxvYXQgX2dldFNoYWRvd1BDRjN4MyhTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgZmxvYXQgeiA9IGRTaGFkb3dDb29yZC56O1xuICAgIHZlYzIgdXYgPSBkU2hhZG93Q29vcmQueHkgKiBzaGFkb3dQYXJhbXMueDsgLy8gMSB1bml0IC0gMSB0ZXhlbFxuICAgIGZsb2F0IHNoYWRvd01hcFNpemVJbnYgPSAxLjAgLyBzaGFkb3dQYXJhbXMueDtcbiAgICB2ZWMyIGJhc2VfdXYgPSBmbG9vcih1diArIDAuNSk7XG4gICAgZmxvYXQgcyA9ICh1di54ICsgMC41IC0gYmFzZV91di54KTtcbiAgICBmbG9hdCB0ID0gKHV2LnkgKyAwLjUgLSBiYXNlX3V2LnkpO1xuICAgIGJhc2VfdXYgLT0gdmVjMigwLjUpO1xuICAgIGJhc2VfdXYgKj0gc2hhZG93TWFwU2l6ZUludjtcblxuICAgIGZsb2F0IHN1bSA9IDAuMDtcblxuICAgIGZsb2F0IHV3MCA9ICgzLjAgLSAyLjAgKiBzKTtcbiAgICBmbG9hdCB1dzEgPSAoMS4wICsgMi4wICogcyk7XG5cbiAgICBmbG9hdCB1MCA9ICgyLjAgLSBzKSAvIHV3MCAtIDEuMDtcbiAgICBmbG9hdCB1MSA9IHMgLyB1dzEgKyAxLjA7XG5cbiAgICBmbG9hdCB2dzAgPSAoMy4wIC0gMi4wICogdCk7XG4gICAgZmxvYXQgdncxID0gKDEuMCArIDIuMCAqIHQpO1xuXG4gICAgZmxvYXQgdjAgPSAoMi4wIC0gdCkgLyB2dzAgLSAxLjA7XG4gICAgZmxvYXQgdjEgPSB0IC8gdncxICsgMS4wO1xuXG4gICAgdTAgPSB1MCAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lng7XG4gICAgdjAgPSB2MCAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lnk7XG5cbiAgICB1MSA9IHUxICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueDtcbiAgICB2MSA9IHYxICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueTtcblxuICAgIHN1bSArPSB1dzAgKiB2dzAgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MCwgdjAsIHopKTtcbiAgICBzdW0gKz0gdXcxICogdncwICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTEsIHYwLCB6KSk7XG4gICAgc3VtICs9IHV3MCAqIHZ3MSAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUwLCB2MSwgeikpO1xuICAgIHN1bSArPSB1dzEgKiB2dzEgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MSwgdjEsIHopKTtcblxuICAgIHN1bSAqPSAxLjBmIC8gMTYuMDtcbiAgICByZXR1cm4gc3VtO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQQ0YzeDMoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGM3gzKFNIQURPV01BUF9QQVNTKHNoYWRvd01hcCksIHNoYWRvd1BhcmFtcyk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RQQ0YzeDMoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGM3gzKFNIQURPV01BUF9QQVNTKHNoYWRvd01hcCksIHNoYWRvd1BhcmFtcy54eXopO1xufVxuXG4jZWxzZSAvLyBHTDFcblxuZmxvYXQgX3hnZXRTaGFkb3dQQ0YzeDMobWF0MyBkZXB0aEtlcm5lbCwgc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICBtYXQzIHNoYWRvd0tlcm5lbDtcbiAgICB2ZWMzIHNoYWRvd0Nvb3JkID0gZFNoYWRvd0Nvb3JkO1xuICAgIHZlYzMgc2hhZG93WiA9IHZlYzMoc2hhZG93Q29vcmQueik7XG4gICAgc2hhZG93S2VybmVsWzBdID0gdmVjMyhncmVhdGVyVGhhbihkZXB0aEtlcm5lbFswXSwgc2hhZG93WikpO1xuICAgIHNoYWRvd0tlcm5lbFsxXSA9IHZlYzMoZ3JlYXRlclRoYW4oZGVwdGhLZXJuZWxbMV0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMl0gPSB2ZWMzKGdyZWF0ZXJUaGFuKGRlcHRoS2VybmVsWzJdLCBzaGFkb3daKSk7XG5cbiAgICB2ZWMyIGZyYWN0aW9uYWxDb29yZCA9IGZyYWN0KCBzaGFkb3dDb29yZC54eSAqIHNoYWRvd1BhcmFtcy54ICk7XG5cbiAgICBzaGFkb3dLZXJuZWxbMF0gPSBtaXgoc2hhZG93S2VybmVsWzBdLCBzaGFkb3dLZXJuZWxbMV0sIGZyYWN0aW9uYWxDb29yZC54KTtcbiAgICBzaGFkb3dLZXJuZWxbMV0gPSBtaXgoc2hhZG93S2VybmVsWzFdLCBzaGFkb3dLZXJuZWxbMl0sIGZyYWN0aW9uYWxDb29yZC54KTtcblxuICAgIHZlYzQgc2hhZG93VmFsdWVzO1xuICAgIHNoYWRvd1ZhbHVlcy54ID0gbWl4KHNoYWRvd0tlcm5lbFswXVswXSwgc2hhZG93S2VybmVsWzBdWzFdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLnkgPSBtaXgoc2hhZG93S2VybmVsWzBdWzFdLCBzaGFkb3dLZXJuZWxbMF1bMl0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMueiA9IG1peChzaGFkb3dLZXJuZWxbMV1bMF0sIHNoYWRvd0tlcm5lbFsxXVsxXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy53ID0gbWl4KHNoYWRvd0tlcm5lbFsxXVsxXSwgc2hhZG93S2VybmVsWzFdWzJdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG5cbiAgICByZXR1cm4gZG90KCBzaGFkb3dWYWx1ZXMsIHZlYzQoIDEuMCApICkgKiAwLjI1O1xufVxuXG5mbG9hdCBfZ2V0U2hhZG93UENGM3gzKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgdmVjMyBzaGFkb3dDb29yZCA9IGRTaGFkb3dDb29yZDtcblxuICAgIGZsb2F0IHhvZmZzZXQgPSAxLjAgLyBzaGFkb3dQYXJhbXMueDsgLy8gMS9zaGFkb3cgbWFwIHdpZHRoXG4gICAgZmxvYXQgZHgwID0gLXhvZmZzZXQ7XG4gICAgZmxvYXQgZHgxID0geG9mZnNldDtcblxuICAgIG1hdDMgZGVwdGhLZXJuZWw7XG4gICAgZGVwdGhLZXJuZWxbMF1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDAsIDAuMCkpKTtcbiAgICBkZXB0aEtlcm5lbFswXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSArIHZlYzIoZHgwLCBkeDEpKSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5KSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgxKSkpO1xuICAgIGRlcHRoS2VybmVsWzJdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDEsIGR4MCkpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSArIHZlYzIoZHgxLCAwLjApKSk7XG4gICAgZGVwdGhLZXJuZWxbMl1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MSwgZHgxKSkpO1xuXG4gICAgcmV0dXJuIF94Z2V0U2hhZG93UENGM3gzKGRlcHRoS2VybmVsLCBzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcyk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1BDRjN4MyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGM3gzKHNoYWRvd01hcCwgc2hhZG93UGFyYW1zKTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93U3BvdFBDRjN4MyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGM3gzKHNoYWRvd01hcCwgc2hhZG93UGFyYW1zLnh5eik7XG59XG4jZW5kaWZcblxuXG4vLyAtLS0tLSBPbW5pIFNhbXBsaW5nIC0tLS0tXG5cbiNpZm5kZWYgV0VCR1BVXG5cbmZsb2F0IF9nZXRTaGFkb3dQb2ludChzYW1wbGVyQ3ViZSBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIGRpcikge1xuXG4gICAgdmVjMyB0YyA9IG5vcm1hbGl6ZShkaXIpO1xuICAgIHZlYzMgdGNBYnMgPSBhYnModGMpO1xuXG4gICAgdmVjNCBkaXJYID0gdmVjNCgxLDAsMCwgdGMueCk7XG4gICAgdmVjNCBkaXJZID0gdmVjNCgwLDEsMCwgdGMueSk7XG4gICAgZmxvYXQgbWFqb3JBeGlzTGVuZ3RoID0gdGMuejtcbiAgICBpZiAoKHRjQWJzLnggPiB0Y0Ficy55KSAmJiAodGNBYnMueCA+IHRjQWJzLnopKSB7XG4gICAgICAgIGRpclggPSB2ZWM0KDAsMCwxLCB0Yy56KTtcbiAgICAgICAgZGlyWSA9IHZlYzQoMCwxLDAsIHRjLnkpO1xuICAgICAgICBtYWpvckF4aXNMZW5ndGggPSB0Yy54O1xuICAgIH0gZWxzZSBpZiAoKHRjQWJzLnkgPiB0Y0Ficy54KSAmJiAodGNBYnMueSA+IHRjQWJzLnopKSB7XG4gICAgICAgIGRpclggPSB2ZWM0KDEsMCwwLCB0Yy54KTtcbiAgICAgICAgZGlyWSA9IHZlYzQoMCwwLDEsIHRjLnopO1xuICAgICAgICBtYWpvckF4aXNMZW5ndGggPSB0Yy55O1xuICAgIH1cblxuICAgIGZsb2F0IHNoYWRvd1BhcmFtc0luRmFjZVNwYWNlID0gKCgxLjAvc2hhZG93UGFyYW1zLngpICogMi4wKSAqIGFicyhtYWpvckF4aXNMZW5ndGgpO1xuXG4gICAgdmVjMyB4b2Zmc2V0ID0gKGRpclgueHl6ICogc2hhZG93UGFyYW1zSW5GYWNlU3BhY2UpO1xuICAgIHZlYzMgeW9mZnNldCA9IChkaXJZLnh5eiAqIHNoYWRvd1BhcmFtc0luRmFjZVNwYWNlKTtcbiAgICB2ZWMzIGR4MCA9IC14b2Zmc2V0O1xuICAgIHZlYzMgZHkwID0gLXlvZmZzZXQ7XG4gICAgdmVjMyBkeDEgPSB4b2Zmc2V0O1xuICAgIHZlYzMgZHkxID0geW9mZnNldDtcblxuICAgIG1hdDMgc2hhZG93S2VybmVsO1xuICAgIG1hdDMgZGVwdGhLZXJuZWw7XG5cbiAgICBkZXB0aEtlcm5lbFswXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDAgKyBkeTApKTtcbiAgICBkZXB0aEtlcm5lbFswXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDApKTtcbiAgICBkZXB0aEtlcm5lbFswXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDAgKyBkeTEpKTtcbiAgICBkZXB0aEtlcm5lbFsxXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeTApKTtcbiAgICBkZXB0aEtlcm5lbFsxXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMpKTtcbiAgICBkZXB0aEtlcm5lbFsxXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeTEpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDEgKyBkeTApKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDEpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDEgKyBkeTEpKTtcblxuICAgIHZlYzMgc2hhZG93WiA9IHZlYzMobGVuZ3RoKGRpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56KTtcblxuICAgIHNoYWRvd0tlcm5lbFswXSA9IHZlYzMobGVzc1RoYW4yKGRlcHRoS2VybmVsWzBdLCBzaGFkb3daKSk7XG4gICAgc2hhZG93S2VybmVsWzFdID0gdmVjMyhsZXNzVGhhbjIoZGVwdGhLZXJuZWxbMV0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMl0gPSB2ZWMzKGxlc3NUaGFuMihkZXB0aEtlcm5lbFsyXSwgc2hhZG93WikpO1xuXG4gICAgdmVjMiB1diA9ICh2ZWMyKGRpclgudywgZGlyWS53KSAvIGFicyhtYWpvckF4aXNMZW5ndGgpKSAqIDAuNTtcblxuICAgIHZlYzIgZnJhY3Rpb25hbENvb3JkID0gZnJhY3QoIHV2ICogc2hhZG93UGFyYW1zLnggKTtcblxuICAgIHNoYWRvd0tlcm5lbFswXSA9IG1peChzaGFkb3dLZXJuZWxbMF0sIHNoYWRvd0tlcm5lbFsxXSwgZnJhY3Rpb25hbENvb3JkLngpO1xuICAgIHNoYWRvd0tlcm5lbFsxXSA9IG1peChzaGFkb3dLZXJuZWxbMV0sIHNoYWRvd0tlcm5lbFsyXSwgZnJhY3Rpb25hbENvb3JkLngpO1xuXG4gICAgdmVjNCBzaGFkb3dWYWx1ZXM7XG4gICAgc2hhZG93VmFsdWVzLnggPSBtaXgoc2hhZG93S2VybmVsWzBdWzBdLCBzaGFkb3dLZXJuZWxbMF1bMV0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMueSA9IG1peChzaGFkb3dLZXJuZWxbMF1bMV0sIHNoYWRvd0tlcm5lbFswXVsyXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy56ID0gbWl4KHNoYWRvd0tlcm5lbFsxXVswXSwgc2hhZG93S2VybmVsWzFdWzFdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLncgPSBtaXgoc2hhZG93S2VybmVsWzFdWzFdLCBzaGFkb3dLZXJuZWxbMV1bMl0sIGZyYWN0aW9uYWxDb29yZC55KTtcblxuICAgIHJldHVybiAxLjAgLSBkb3QoIHNoYWRvd1ZhbHVlcywgdmVjNCggMS4wICkgKSAqIDAuMjU7XG59XG5cbmZsb2F0IGdldFNoYWRvd1BvaW50UENGM3gzKHNhbXBsZXJDdWJlIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BvaW50KHNoYWRvd01hcCwgc2hhZG93UGFyYW1zLCBkTGlnaHREaXJXKTtcbn1cblxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
