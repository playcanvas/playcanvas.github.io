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

float getShadowPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
}

float getShadowSpotPCF3x3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
}

float getShadowPCF1x1(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return textureShadow(shadowMap, shadowCoord);
}

float getShadowSpotPCF1x1(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return textureShadow(shadowMap, shadowCoord);
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

float getShadowPCF3x3(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowCoord, shadowParams.xyz);
}

float getShadowSpotPCF3x3(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF3x3(shadowMap, shadowCoord, shadowParams.xyz);
}

float _getShadowPCF1x1(sampler2D shadowMap, vec3 shadowCoord) {
    float shadowSample = unpackFloat(textureShadow(shadowMap, shadowCoord.xy));
    return shadowSample > shadowCoord.z ? 1.0 : 0.0;
}

float getShadowPCF1x1(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF1x1(shadowMap, shadowCoord);
}

float getShadowSpotPCF1x1(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF1x1(shadowMap, shadowCoord);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dTdGFuZGFyZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBsZXNzVGhhbjIodmVjMyBhLCB2ZWMzIGIpIHtcbiAgICByZXR1cm4gY2xhbXAoKGIgLSBhKSoxMDAwLjAsIDAuMCwgMS4wKTsgLy8gc29mdGVyIHZlcnNpb25cbn1cblxuI2lmbmRlZiBVTlBBQ0tGTE9BVFxuI2RlZmluZSBVTlBBQ0tGTE9BVFxuICAgIGZsb2F0IHVucGFja0Zsb2F0KHZlYzQgcmdiYURlcHRoKSB7XG4gICAgICAgIGNvbnN0IHZlYzQgYml0U2hpZnQgPSB2ZWM0KDEuMCAvICgyNTYuMCAqIDI1Ni4wICogMjU2LjApLCAxLjAgLyAoMjU2LjAgKiAyNTYuMCksIDEuMCAvIDI1Ni4wLCAxLjApO1xuICAgICAgICByZXR1cm4gZG90KHJnYmFEZXB0aCwgYml0U2hpZnQpO1xuICAgIH1cbiNlbmRpZlxuXG4vLyAtLS0tLSBEaXJlY3QvU3BvdCBTYW1wbGluZyAtLS0tLVxuXG4jaWZkZWYgR0wyXG5cbmZsb2F0IF9nZXRTaGFkb3dQQ0YzeDMoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIGZsb2F0IHogPSBzaGFkb3dDb29yZC56O1xuICAgIHZlYzIgdXYgPSBzaGFkb3dDb29yZC54eSAqIHNoYWRvd1BhcmFtcy54OyAvLyAxIHVuaXQgLSAxIHRleGVsXG4gICAgZmxvYXQgc2hhZG93TWFwU2l6ZUludiA9IDEuMCAvIHNoYWRvd1BhcmFtcy54O1xuICAgIHZlYzIgYmFzZV91diA9IGZsb29yKHV2ICsgMC41KTtcbiAgICBmbG9hdCBzID0gKHV2LnggKyAwLjUgLSBiYXNlX3V2LngpO1xuICAgIGZsb2F0IHQgPSAodXYueSArIDAuNSAtIGJhc2VfdXYueSk7XG4gICAgYmFzZV91diAtPSB2ZWMyKDAuNSk7XG4gICAgYmFzZV91diAqPSBzaGFkb3dNYXBTaXplSW52O1xuXG4gICAgZmxvYXQgc3VtID0gMC4wO1xuXG4gICAgZmxvYXQgdXcwID0gKDMuMCAtIDIuMCAqIHMpO1xuICAgIGZsb2F0IHV3MSA9ICgxLjAgKyAyLjAgKiBzKTtcblxuICAgIGZsb2F0IHUwID0gKDIuMCAtIHMpIC8gdXcwIC0gMS4wO1xuICAgIGZsb2F0IHUxID0gcyAvIHV3MSArIDEuMDtcblxuICAgIGZsb2F0IHZ3MCA9ICgzLjAgLSAyLjAgKiB0KTtcbiAgICBmbG9hdCB2dzEgPSAoMS4wICsgMi4wICogdCk7XG5cbiAgICBmbG9hdCB2MCA9ICgyLjAgLSB0KSAvIHZ3MCAtIDEuMDtcbiAgICBmbG9hdCB2MSA9IHQgLyB2dzEgKyAxLjA7XG5cbiAgICB1MCA9IHUwICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueDtcbiAgICB2MCA9IHYwICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueTtcblxuICAgIHUxID0gdTEgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di54O1xuICAgIHYxID0gdjEgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di55O1xuXG4gICAgc3VtICs9IHV3MCAqIHZ3MCAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUwLCB2MCwgeikpO1xuICAgIHN1bSArPSB1dzEgKiB2dzAgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MSwgdjAsIHopKTtcbiAgICBzdW0gKz0gdXcwICogdncxICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTAsIHYxLCB6KSk7XG4gICAgc3VtICs9IHV3MSAqIHZ3MSAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUxLCB2MSwgeikpO1xuXG4gICAgc3VtICo9IDEuMGYgLyAxNi4wO1xuICAgIHJldHVybiBzdW07XG59XG5cbmZsb2F0IGdldFNoYWRvd1BDRjN4MyhTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIF9nZXRTaGFkb3dQQ0YzeDMoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90UENGM3gzKFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhTSEFET1dNQVBfUEFTUyhzaGFkb3dNYXApLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zLnh5eik7XG59XG5cbmZsb2F0IGdldFNoYWRvd1BDRjF4MShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZCk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RQQ0YxeDEoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQpO1xufVxuXG4jZWxzZSAvLyBHTDFcblxuZmxvYXQgX3hnZXRTaGFkb3dQQ0YzeDMobWF0MyBkZXB0aEtlcm5lbCwgdmVjMyBzaGFkb3dDb29yZCwgc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICBtYXQzIHNoYWRvd0tlcm5lbDtcbiAgICB2ZWMzIHNoYWRvd1ogPSB2ZWMzKHNoYWRvd0Nvb3JkLnopO1xuICAgIHNoYWRvd0tlcm5lbFswXSA9IHZlYzMoZ3JlYXRlclRoYW4oZGVwdGhLZXJuZWxbMF0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMV0gPSB2ZWMzKGdyZWF0ZXJUaGFuKGRlcHRoS2VybmVsWzFdLCBzaGFkb3daKSk7XG4gICAgc2hhZG93S2VybmVsWzJdID0gdmVjMyhncmVhdGVyVGhhbihkZXB0aEtlcm5lbFsyXSwgc2hhZG93WikpO1xuXG4gICAgdmVjMiBmcmFjdGlvbmFsQ29vcmQgPSBmcmFjdCggc2hhZG93Q29vcmQueHkgKiBzaGFkb3dQYXJhbXMueCApO1xuXG4gICAgc2hhZG93S2VybmVsWzBdID0gbWl4KHNoYWRvd0tlcm5lbFswXSwgc2hhZG93S2VybmVsWzFdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG4gICAgc2hhZG93S2VybmVsWzFdID0gbWl4KHNoYWRvd0tlcm5lbFsxXSwgc2hhZG93S2VybmVsWzJdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG5cbiAgICB2ZWM0IHNoYWRvd1ZhbHVlcztcbiAgICBzaGFkb3dWYWx1ZXMueCA9IG1peChzaGFkb3dLZXJuZWxbMF1bMF0sIHNoYWRvd0tlcm5lbFswXVsxXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy55ID0gbWl4KHNoYWRvd0tlcm5lbFswXVsxXSwgc2hhZG93S2VybmVsWzBdWzJdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLnogPSBtaXgoc2hhZG93S2VybmVsWzFdWzBdLCBzaGFkb3dLZXJuZWxbMV1bMV0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMudyA9IG1peChzaGFkb3dLZXJuZWxbMV1bMV0sIHNoYWRvd0tlcm5lbFsxXVsyXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuXG4gICAgcmV0dXJuIGRvdCggc2hhZG93VmFsdWVzLCB2ZWM0KCAxLjAgKSApICogMC4yNTtcbn1cblxuZmxvYXQgX2dldFNoYWRvd1BDRjN4MyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIGZsb2F0IHhvZmZzZXQgPSAxLjAgLyBzaGFkb3dQYXJhbXMueDsgLy8gMS9zaGFkb3cgbWFwIHdpZHRoXG4gICAgZmxvYXQgZHgwID0gLXhvZmZzZXQ7XG4gICAgZmxvYXQgZHgxID0geG9mZnNldDtcblxuICAgIG1hdDMgZGVwdGhLZXJuZWw7XG4gICAgZGVwdGhLZXJuZWxbMF1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDAsIDAuMCkpKTtcbiAgICBkZXB0aEtlcm5lbFswXVsyXSA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSArIHZlYzIoZHgwLCBkeDEpKSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMF0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgwKSkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5KSk7XG4gICAgZGVwdGhLZXJuZWxbMV1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKDAuMCwgZHgxKSkpO1xuICAgIGRlcHRoS2VybmVsWzJdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLnh5ICsgdmVjMihkeDEsIGR4MCkpKTtcbiAgICBkZXB0aEtlcm5lbFsyXVsxXSA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSArIHZlYzIoZHgxLCAwLjApKSk7XG4gICAgZGVwdGhLZXJuZWxbMl1bMl0gPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkgKyB2ZWMyKGR4MSwgZHgxKSkpO1xuXG4gICAgcmV0dXJuIF94Z2V0U2hhZG93UENGM3gzKGRlcHRoS2VybmVsLCBzaGFkb3dDb29yZCwgc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQQ0YzeDMoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMueHl6KTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93U3BvdFBDRjN4MyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGM3gzKHNoYWRvd01hcCwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xufVxuXG5mbG9hdCBfZ2V0U2hhZG93UENGMXgxKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93Q29vcmQpIHtcbiAgICBmbG9hdCBzaGFkb3dTYW1wbGUgPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkpKTtcbiAgICByZXR1cm4gc2hhZG93U2FtcGxlID4gc2hhZG93Q29vcmQueiA/IDEuMCA6IDAuMDtcbn1cblxuZmxvYXQgZ2V0U2hhZG93UENGMXgxKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIF9nZXRTaGFkb3dQQ0YxeDEoc2hhZG93TWFwLCBzaGFkb3dDb29yZCk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RQQ0YxeDEoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjF4MShzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkKTtcbn1cbiNlbmRpZlxuXG5cbi8vIC0tLS0tIE9tbmkgU2FtcGxpbmcgLS0tLS1cblxuI2lmbmRlZiBXRUJHUFVcblxuZmxvYXQgX2dldFNoYWRvd1BvaW50KHNhbXBsZXJDdWJlIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgZGlyKSB7XG5cbiAgICB2ZWMzIHRjID0gbm9ybWFsaXplKGRpcik7XG4gICAgdmVjMyB0Y0FicyA9IGFicyh0Yyk7XG5cbiAgICB2ZWM0IGRpclggPSB2ZWM0KDEsMCwwLCB0Yy54KTtcbiAgICB2ZWM0IGRpclkgPSB2ZWM0KDAsMSwwLCB0Yy55KTtcbiAgICBmbG9hdCBtYWpvckF4aXNMZW5ndGggPSB0Yy56O1xuICAgIGlmICgodGNBYnMueCA+IHRjQWJzLnkpICYmICh0Y0Ficy54ID4gdGNBYnMueikpIHtcbiAgICAgICAgZGlyWCA9IHZlYzQoMCwwLDEsIHRjLnopO1xuICAgICAgICBkaXJZID0gdmVjNCgwLDEsMCwgdGMueSk7XG4gICAgICAgIG1ham9yQXhpc0xlbmd0aCA9IHRjLng7XG4gICAgfSBlbHNlIGlmICgodGNBYnMueSA+IHRjQWJzLngpICYmICh0Y0Ficy55ID4gdGNBYnMueikpIHtcbiAgICAgICAgZGlyWCA9IHZlYzQoMSwwLDAsIHRjLngpO1xuICAgICAgICBkaXJZID0gdmVjNCgwLDAsMSwgdGMueik7XG4gICAgICAgIG1ham9yQXhpc0xlbmd0aCA9IHRjLnk7XG4gICAgfVxuXG4gICAgZmxvYXQgc2hhZG93UGFyYW1zSW5GYWNlU3BhY2UgPSAoKDEuMC9zaGFkb3dQYXJhbXMueCkgKiAyLjApICogYWJzKG1ham9yQXhpc0xlbmd0aCk7XG5cbiAgICB2ZWMzIHhvZmZzZXQgPSAoZGlyWC54eXogKiBzaGFkb3dQYXJhbXNJbkZhY2VTcGFjZSk7XG4gICAgdmVjMyB5b2Zmc2V0ID0gKGRpclkueHl6ICogc2hhZG93UGFyYW1zSW5GYWNlU3BhY2UpO1xuICAgIHZlYzMgZHgwID0gLXhvZmZzZXQ7XG4gICAgdmVjMyBkeTAgPSAteW9mZnNldDtcbiAgICB2ZWMzIGR4MSA9IHhvZmZzZXQ7XG4gICAgdmVjMyBkeTEgPSB5b2Zmc2V0O1xuXG4gICAgbWF0MyBzaGFkb3dLZXJuZWw7XG4gICAgbWF0MyBkZXB0aEtlcm5lbDtcblxuICAgIGRlcHRoS2VybmVsWzBdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR4MCArIGR5MCkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR4MCkpO1xuICAgIGRlcHRoS2VybmVsWzBdWzJdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR4MCArIGR5MSkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR5MCkpO1xuICAgIGRlcHRoS2VybmVsWzFdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YykpO1xuICAgIGRlcHRoS2VybmVsWzFdWzJdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR5MSkpO1xuICAgIGRlcHRoS2VybmVsWzJdWzBdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR4MSArIGR5MCkpO1xuICAgIGRlcHRoS2VybmVsWzJdWzFdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR4MSkpO1xuICAgIGRlcHRoS2VybmVsWzJdWzJdID0gdW5wYWNrRmxvYXQodGV4dHVyZUN1YmUoc2hhZG93TWFwLCB0YyArIGR4MSArIGR5MSkpO1xuXG4gICAgdmVjMyBzaGFkb3daID0gdmVjMyhsZW5ndGgoZGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLnopO1xuXG4gICAgc2hhZG93S2VybmVsWzBdID0gdmVjMyhsZXNzVGhhbjIoZGVwdGhLZXJuZWxbMF0sIHNoYWRvd1opKTtcbiAgICBzaGFkb3dLZXJuZWxbMV0gPSB2ZWMzKGxlc3NUaGFuMihkZXB0aEtlcm5lbFsxXSwgc2hhZG93WikpO1xuICAgIHNoYWRvd0tlcm5lbFsyXSA9IHZlYzMobGVzc1RoYW4yKGRlcHRoS2VybmVsWzJdLCBzaGFkb3daKSk7XG5cbiAgICB2ZWMyIHV2ID0gKHZlYzIoZGlyWC53LCBkaXJZLncpIC8gYWJzKG1ham9yQXhpc0xlbmd0aCkpICogMC41O1xuXG4gICAgdmVjMiBmcmFjdGlvbmFsQ29vcmQgPSBmcmFjdCggdXYgKiBzaGFkb3dQYXJhbXMueCApO1xuXG4gICAgc2hhZG93S2VybmVsWzBdID0gbWl4KHNoYWRvd0tlcm5lbFswXSwgc2hhZG93S2VybmVsWzFdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG4gICAgc2hhZG93S2VybmVsWzFdID0gbWl4KHNoYWRvd0tlcm5lbFsxXSwgc2hhZG93S2VybmVsWzJdLCBmcmFjdGlvbmFsQ29vcmQueCk7XG5cbiAgICB2ZWM0IHNoYWRvd1ZhbHVlcztcbiAgICBzaGFkb3dWYWx1ZXMueCA9IG1peChzaGFkb3dLZXJuZWxbMF1bMF0sIHNoYWRvd0tlcm5lbFswXVsxXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuICAgIHNoYWRvd1ZhbHVlcy55ID0gbWl4KHNoYWRvd0tlcm5lbFswXVsxXSwgc2hhZG93S2VybmVsWzBdWzJdLCBmcmFjdGlvbmFsQ29vcmQueSk7XG4gICAgc2hhZG93VmFsdWVzLnogPSBtaXgoc2hhZG93S2VybmVsWzFdWzBdLCBzaGFkb3dLZXJuZWxbMV1bMV0sIGZyYWN0aW9uYWxDb29yZC55KTtcbiAgICBzaGFkb3dWYWx1ZXMudyA9IG1peChzaGFkb3dLZXJuZWxbMV1bMV0sIHNoYWRvd0tlcm5lbFsxXVsyXSwgZnJhY3Rpb25hbENvb3JkLnkpO1xuXG4gICAgcmV0dXJuIDEuMCAtIGRvdCggc2hhZG93VmFsdWVzLCB2ZWM0KCAxLjAgKSApICogMC4yNTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93UG9pbnRQQ0YzeDMoc2FtcGxlckN1YmUgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBsaWdodERpcikge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UG9pbnQoc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMsIGxpZ2h0RGlyKTtcbn1cblxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHVCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
