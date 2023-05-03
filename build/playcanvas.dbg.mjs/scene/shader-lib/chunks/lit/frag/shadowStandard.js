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

float _getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec3 shadowParams) {
    float z = shadowCoord.z;
    vec2 uv = shadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
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

float getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec3 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
}

float getShadowSpotPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
}

#else // GL1

float _xgetShadowPCF3x3(mat3 depthKernel, vec3 shadowCoord, sampler2D shadowMap, vec3 shadowParams) {
    mat3 shadowKernel;
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

float _getShadowPCF3x3(sampler2D shadowMap, vec3 shadowCoord, vec3 shadowParams) {
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

    return _xgetShadowPCF3x3(depthKernel, shadowCoord, shadowMap, shadowParams);
}

float getShadowPCF3x3(sampler2D shadowMap, vec3 shadowCoord, vec3 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowCoord, shadowParams);
}

float getShadowSpotPCF3x3(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowCoord, shadowParams.xyz);
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

float getShadowPointPCF3x3(samplerCube shadowMap, vec3 shadowCoord, vec4 shadowParams, vec3 lightDir) {
    return _getShadowPoint(shadowMap, shadowParams, lightDir);
}

#endif
`;

export { shadowStandardPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dTdGFuZGFyZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBsZXNzVGhhbjIodmVjMyBhLCB2ZWMzIGIpIHtcbiAgICByZXR1cm4gY2xhbXAoKGIgLSBhKSoxMDAwLjAsIDAuMCwgMS4wKTsgLy8gc29mdGVyIHZlcnNpb25cbn1cblxuI2lmbmRlZiBVTlBBQ0tGTE9BVFxuI2RlZmluZSBVTlBBQ0tGTE9BVFxuZmxvYXQgdW5wYWNrRmxvYXQodmVjNCByZ2JhRGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdFNoaWZ0ID0gdmVjNCgxLjAgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gKDI1Ni4wICogMjU2LjApLCAxLjAgLyAyNTYuMCwgMS4wKTtcbiAgICByZXR1cm4gZG90KHJnYmFEZXB0aCwgYml0U2hpZnQpO1xufVxuI2VuZGlmXG5cbi8vIC0tLS0tIERpcmVjdC9TcG90IFNhbXBsaW5nIC0tLS0tXG5cbiNpZmRlZiBHTDJcblxuZmxvYXQgX2dldFNoYWRvd1BDRjN4MyhTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgZmxvYXQgeiA9IHNoYWRvd0Nvb3JkLno7XG4gICAgdmVjMiB1diA9IHNoYWRvd0Nvb3JkLnh5ICogc2hhZG93UGFyYW1zLng7IC8vIDEgdW5pdCAtIDEgdGV4ZWxcbiAgICBmbG9hdCBzaGFkb3dNYXBTaXplSW52ID0gMS4wIC8gc2hhZG93UGFyYW1zLng7XG4gICAgdmVjMiBiYXNlX3V2ID0gZmxvb3IodXYgKyAwLjUpO1xuICAgIGZsb2F0IHMgPSAodXYueCArIDAuNSAtIGJhc2VfdXYueCk7XG4gICAgZmxvYXQgdCA9ICh1di55ICsgMC41IC0gYmFzZV91di55KTtcbiAgICBiYXNlX3V2IC09IHZlYzIoMC41KTtcbiAgICBiYXNlX3V2ICo9IHNoYWRvd01hcFNpemVJbnY7XG5cbiAgICBmbG9hdCBzdW0gPSAwLjA7XG5cbiAgICBmbG9hdCB1dzAgPSAoMy4wIC0gMi4wICogcyk7XG4gICAgZmxvYXQgdXcxID0gKDEuMCArIDIuMCAqIHMpO1xuXG4gICAgZmxvYXQgdTAgPSAoMi4wIC0gcykgLyB1dzAgLSAxLjA7XG4gICAgZmxvYXQgdTEgPSBzIC8gdXcxICsgMS4wO1xuXG4gICAgZmxvYXQgdncwID0gKDMuMCAtIDIuMCAqIHQpO1xuICAgIGZsb2F0IHZ3MSA9ICgxLjAgKyAyLjAgKiB0KTtcblxuICAgIGZsb2F0IHYwID0gKDIuMCAtIHQpIC8gdncwIC0gMS4wO1xuICAgIGZsb2F0IHYxID0gdCAvIHZ3MSArIDEuMDtcblxuICAgIHUwID0gdTAgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di54O1xuICAgIHYwID0gdjAgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di55O1xuXG4gICAgdTEgPSB1MSAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lng7XG4gICAgdjEgPSB2MSAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lnk7XG5cbiAgICBzdW0gKz0gdXcwICogdncwICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTAsIHYwLCB6KSk7XG4gICAgc3VtICs9IHV3MSAqIHZ3MCAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUxLCB2MCwgeikpO1xuICAgIHN1bSArPSB1dzAgKiB2dzEgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MCwgdjEsIHopKTtcbiAgICBzdW0gKz0gdXcxICogdncxICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTEsIHYxLCB6KSk7XG5cbiAgICBzdW0gKj0gMS4wZiAvIDE2LjA7XG4gICAgcmV0dXJuIHN1bTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93UENGM3gzKFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjMyBzaGFkb3dDb29yZCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhTSEFET1dNQVBfUEFTUyhzaGFkb3dNYXApLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zKTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93U3BvdFBDRjN4MyhTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIF9nZXRTaGFkb3dQQ0YzeDMoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xufVxuXG4jZWxzZSAvLyBHTDFcblxuZmxvYXQgX3hnZXRTaGFkb3dQQ0YzeDMobWF0MyBkZXB0aEtlcm5lbCwgdmVjMyBzaGFkb3dDb29yZCwgc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICBtYXQzIHNoYWRvd0tlcm5lbDtcbiAgICB2ZWMzIHNoYWRvd1ogPSB2ZWMzKHNoYWRvd0Nvb3JkLnopO1xuICAgIHNoYWRvd0tlcm5lbFswXSA9IHZlYzMoZ3JlYXRlclRoYW4oZGVwdGhLZXJuZWxbMF0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMV0gPSB2ZWMzKGdyZWF0ZXJUaGFuKGRlcHRoS2VybmVsWzFdLCBzaGFkb3daKSk7XG4gICAgc2hhZG93S2VybmVsWzJdID0gdmVjMyhncmVhdGVyVGhhbihkZXB0aEtlcm5lbFsyXSwgc2hhZG93WikpO1xuXG4gICAgdmVjMiBmcmFjdGlvbmFsQ29vcmQgPSBmcmFjdCggc2hhZG93Q29vcmQueHkgKiBzaGFkb3dQYXJhbXMueCApO1xuXG4gICAgc2hhZG93S2VybmVsWzBdID0gbWl4KHNoYWRvd0tlcm5lbFswXSwgc2hhZG93S2VybmVsWzFdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG4gICAgc2hhZG93S2VybmVsWzFdID0gbWl4KHNoYWRvd0tlcm5lbFsxXSwgc2hhZG93S2VybmVsWzJdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG5cbiAgICB2ZWM0IHNoYWRvd1ZhbHVlcztcbiAgICBzaGFkb3dWYWx1ZXMueCA9IG1peChzaGFkb3dLZXJuZWxbMF1bMF0sIHNoYWRvd0tlcm5lbFswXVsxXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy55ID0gbWl4KHNoYWRvd0tlcm5lbFswXVsxXSwgc2hhZG93S2VybmVsWzBdWzJdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLnogPSBtaXgoc2hhZG93S2VybmVsWzFdWzBdLCBzaGFkb3dLZXJuZWxbMV1bMV0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMudyA9IG1peChzaGFkb3dLZXJuZWxbMV1bMV0sIHNoYWRvd0tlcm5lbFsxXVsyXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuXG4gICAgcmV0dXJuIGRvdCggc2hhZG93VmFsdWVzLCB2ZWM0KCAxLjAgKSApICogMC4yNTtcbn1cblxuZmxvYXQgX2dldFNoYWRvd1BDRjN4MyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIGZsb2F0IHhvZmZzZXQgPSAxLjAgLyBzaGFkb3dQYXJhbXMueDsgLy8gMS9zaGFkb3cgbWFwIHdpZHRoXG4gICAgZmxvYXQgZHgwID0gLXhvZmZzZXQ7XG4gICAgZmxvYXQgZHgxID0geG9mZnNldDtcblxuICAgIG1hdDMgZGVwdGhLZXJuZWw7XG4gICAgZGVwdGhLZXJuZWxbMF1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDAsIDAuMCkpKTtcbiAgICBkZXB0aEtlcm5lbFswXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSArIHZlYzIoZHgwLCBkeDEpKSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5KSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgxKSkpO1xuICAgIGRlcHRoS2VybmVsWzJdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDEsIGR4MCkpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSArIHZlYzIoZHgxLCAwLjApKSk7XG4gICAgZGVwdGhLZXJuZWxbMl1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MSwgZHgxKSkpO1xuXG4gICAgcmV0dXJuIF94Z2V0U2hhZG93UENGM3gzKGRlcHRoS2VybmVsLCBzaGFkb3dDb29yZCwgc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQQ0YzeDMoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90UENGM3gzKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIF9nZXRTaGFkb3dQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zLnh5eik7XG59XG4jZW5kaWZcblxuXG4vLyAtLS0tLSBPbW5pIFNhbXBsaW5nIC0tLS0tXG5cbiNpZm5kZWYgV0VCR1BVXG5cbmZsb2F0IF9nZXRTaGFkb3dQb2ludChzYW1wbGVyQ3ViZSBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIGRpcikge1xuXG4gICAgdmVjMyB0YyA9IG5vcm1hbGl6ZShkaXIpO1xuICAgIHZlYzMgdGNBYnMgPSBhYnModGMpO1xuXG4gICAgdmVjNCBkaXJYID0gdmVjNCgxLDAsMCwgdGMueCk7XG4gICAgdmVjNCBkaXJZID0gdmVjNCgwLDEsMCwgdGMueSk7XG4gICAgZmxvYXQgbWFqb3JBeGlzTGVuZ3RoID0gdGMuejtcbiAgICBpZiAoKHRjQWJzLnggPiB0Y0Ficy55KSAmJiAodGNBYnMueCA+IHRjQWJzLnopKSB7XG4gICAgICAgIGRpclggPSB2ZWM0KDAsMCwxLCB0Yy56KTtcbiAgICAgICAgZGlyWSA9IHZlYzQoMCwxLDAsIHRjLnkpO1xuICAgICAgICBtYWpvckF4aXNMZW5ndGggPSB0Yy54O1xuICAgIH0gZWxzZSBpZiAoKHRjQWJzLnkgPiB0Y0Ficy54KSAmJiAodGNBYnMueSA+IHRjQWJzLnopKSB7XG4gICAgICAgIGRpclggPSB2ZWM0KDEsMCwwLCB0Yy54KTtcbiAgICAgICAgZGlyWSA9IHZlYzQoMCwwLDEsIHRjLnopO1xuICAgICAgICBtYWpvckF4aXNMZW5ndGggPSB0Yy55O1xuICAgIH1cblxuICAgIGZsb2F0IHNoYWRvd1BhcmFtc0luRmFjZVNwYWNlID0gKCgxLjAvc2hhZG93UGFyYW1zLngpICogMi4wKSAqIGFicyhtYWpvckF4aXNMZW5ndGgpO1xuXG4gICAgdmVjMyB4b2Zmc2V0ID0gKGRpclgueHl6ICogc2hhZG93UGFyYW1zSW5GYWNlU3BhY2UpO1xuICAgIHZlYzMgeW9mZnNldCA9IChkaXJZLnh5eiAqIHNoYWRvd1BhcmFtc0luRmFjZVNwYWNlKTtcbiAgICB2ZWMzIGR4MCA9IC14b2Zmc2V0O1xuICAgIHZlYzMgZHkwID0gLXlvZmZzZXQ7XG4gICAgdmVjMyBkeDEgPSB4b2Zmc2V0O1xuICAgIHZlYzMgZHkxID0geW9mZnNldDtcblxuICAgIG1hdDMgc2hhZG93S2VybmVsO1xuICAgIG1hdDMgZGVwdGhLZXJuZWw7XG5cbiAgICBkZXB0aEtlcm5lbFswXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDAgKyBkeTApKTtcbiAgICBkZXB0aEtlcm5lbFswXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDApKTtcbiAgICBkZXB0aEtlcm5lbFswXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDAgKyBkeTEpKTtcbiAgICBkZXB0aEtlcm5lbFsxXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeTApKTtcbiAgICBkZXB0aEtlcm5lbFsxXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMpKTtcbiAgICBkZXB0aEtlcm5lbFsxXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeTEpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVswXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDEgKyBkeTApKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDEpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVDdWJlKHNoYWRvd01hcCwgdGMgKyBkeDEgKyBkeTEpKTtcblxuICAgIHZlYzMgc2hhZG93WiA9IHZlYzMobGVuZ3RoKGRpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56KTtcblxuICAgIHNoYWRvd0tlcm5lbFswXSA9IHZlYzMobGVzc1RoYW4yKGRlcHRoS2VybmVsWzBdLCBzaGFkb3daKSk7XG4gICAgc2hhZG93S2VybmVsWzFdID0gdmVjMyhsZXNzVGhhbjIoZGVwdGhLZXJuZWxbMV0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMl0gPSB2ZWMzKGxlc3NUaGFuMihkZXB0aEtlcm5lbFsyXSwgc2hhZG93WikpO1xuXG4gICAgdmVjMiB1diA9ICh2ZWMyKGRpclgudywgZGlyWS53KSAvIGFicyhtYWpvckF4aXNMZW5ndGgpKSAqIDAuNTtcblxuICAgIHZlYzIgZnJhY3Rpb25hbENvb3JkID0gZnJhY3QoIHV2ICogc2hhZG93UGFyYW1zLnggKTtcblxuICAgIHNoYWRvd0tlcm5lbFswXSA9IG1peChzaGFkb3dLZXJuZWxbMF0sIHNoYWRvd0tlcm5lbFsxXSwgZnJhY3Rpb25hbENvb3JkLngpO1xuICAgIHNoYWRvd0tlcm5lbFsxXSA9IG1peChzaGFkb3dLZXJuZWxbMV0sIHNoYWRvd0tlcm5lbFsyXSwgZnJhY3Rpb25hbENvb3JkLngpO1xuXG4gICAgdmVjNCBzaGFkb3dWYWx1ZXM7XG4gICAgc2hhZG93VmFsdWVzLnggPSBtaXgoc2hhZG93S2VybmVsWzBdWzBdLCBzaGFkb3dLZXJuZWxbMF1bMV0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMueSA9IG1peChzaGFkb3dLZXJuZWxbMF1bMV0sIHNoYWRvd0tlcm5lbFswXVsyXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy56ID0gbWl4KHNoYWRvd0tlcm5lbFsxXVswXSwgc2hhZG93S2VybmVsWzFdWzFdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLncgPSBtaXgoc2hhZG93S2VybmVsWzFdWzFdLCBzaGFkb3dLZXJuZWxbMV1bMl0sIGZyYWN0aW9uYWxDb29yZC55KTtcblxuICAgIHJldHVybiAxLjAgLSBkb3QoIHNoYWRvd1ZhbHVlcywgdmVjNCggMS4wICkgKSAqIDAuMjU7XG59XG5cbmZsb2F0IGdldFNoYWRvd1BvaW50UENGM3gzKHNhbXBsZXJDdWJlIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgbGlnaHREaXIpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BvaW50KHNoYWRvd01hcCwgc2hhZG93UGFyYW1zLCBsaWdodERpcik7XG59XG5cbiNlbmRpZlxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
