/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowStandardGL2PS = /* glsl */`
float _getShadowPCF5x5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowParams) {
    // http://the-witness.net/news/2013/09/shadow-mapping-summary-part-1/

    float z = dShadowCoord.z;
    vec2 uv = dShadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
    float shadowMapSizeInv = 1.0 / shadowParams.x;
    vec2 base_uv = floor(uv + 0.5);
    float s = (uv.x + 0.5 - base_uv.x);
    float t = (uv.y + 0.5 - base_uv.y);
    base_uv -= vec2(0.5);
    base_uv *= shadowMapSizeInv;


    float uw0 = (4.0 - 3.0 * s);
    float uw1 = 7.0;
    float uw2 = (1.0 + 3.0 * s);

    float u0 = (3.0 - 2.0 * s) / uw0 - 2.0;
    float u1 = (3.0 + s) / uw1;
    float u2 = s / uw2 + 2.0;

    float vw0 = (4.0 - 3.0 * t);
    float vw1 = 7.0;
    float vw2 = (1.0 + 3.0 * t);

    float v0 = (3.0 - 2.0 * t) / vw0 - 2.0;
    float v1 = (3.0 + t) / vw1;
    float v2 = t / vw2 + 2.0;

    float sum = 0.0;

    u0 = u0 * shadowMapSizeInv + base_uv.x;
    v0 = v0 * shadowMapSizeInv + base_uv.y;

    u1 = u1 * shadowMapSizeInv + base_uv.x;
    v1 = v1 * shadowMapSizeInv + base_uv.y;

    u2 = u2 * shadowMapSizeInv + base_uv.x;
    v2 = v2 * shadowMapSizeInv + base_uv.y;

    sum += uw0 * vw0 * textureShadow(shadowMap, vec3(u0, v0, z));
    sum += uw1 * vw0 * textureShadow(shadowMap, vec3(u1, v0, z));
    sum += uw2 * vw0 * textureShadow(shadowMap, vec3(u2, v0, z));

    sum += uw0 * vw1 * textureShadow(shadowMap, vec3(u0, v1, z));
    sum += uw1 * vw1 * textureShadow(shadowMap, vec3(u1, v1, z));
    sum += uw2 * vw1 * textureShadow(shadowMap, vec3(u2, v1, z));

    sum += uw0 * vw2 * textureShadow(shadowMap, vec3(u0, v2, z));
    sum += uw1 * vw2 * textureShadow(shadowMap, vec3(u1, v2, z));
    sum += uw2 * vw2 * textureShadow(shadowMap, vec3(u2, v2, z));

    sum *= 1.0f / 144.0;

    sum = saturate(sum);

    return sum;
}

float getShadowPCF5x5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowParams) {
    return _getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowParams);
}

float getShadowSpotPCF5x5(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams) {
    return _getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowParams.xyz);
}
`;

export { shadowStandardGL2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmRHTDIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dTdGFuZGFyZEdMMi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgX2dldFNoYWRvd1BDRjV4NShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgLy8gaHR0cDovL3RoZS13aXRuZXNzLm5ldC9uZXdzLzIwMTMvMDkvc2hhZG93LW1hcHBpbmctc3VtbWFyeS1wYXJ0LTEvXG5cbiAgICBmbG9hdCB6ID0gZFNoYWRvd0Nvb3JkLno7XG4gICAgdmVjMiB1diA9IGRTaGFkb3dDb29yZC54eSAqIHNoYWRvd1BhcmFtcy54OyAvLyAxIHVuaXQgLSAxIHRleGVsXG4gICAgZmxvYXQgc2hhZG93TWFwU2l6ZUludiA9IDEuMCAvIHNoYWRvd1BhcmFtcy54O1xuICAgIHZlYzIgYmFzZV91diA9IGZsb29yKHV2ICsgMC41KTtcbiAgICBmbG9hdCBzID0gKHV2LnggKyAwLjUgLSBiYXNlX3V2LngpO1xuICAgIGZsb2F0IHQgPSAodXYueSArIDAuNSAtIGJhc2VfdXYueSk7XG4gICAgYmFzZV91diAtPSB2ZWMyKDAuNSk7XG4gICAgYmFzZV91diAqPSBzaGFkb3dNYXBTaXplSW52O1xuXG5cbiAgICBmbG9hdCB1dzAgPSAoNC4wIC0gMy4wICogcyk7XG4gICAgZmxvYXQgdXcxID0gNy4wO1xuICAgIGZsb2F0IHV3MiA9ICgxLjAgKyAzLjAgKiBzKTtcblxuICAgIGZsb2F0IHUwID0gKDMuMCAtIDIuMCAqIHMpIC8gdXcwIC0gMi4wO1xuICAgIGZsb2F0IHUxID0gKDMuMCArIHMpIC8gdXcxO1xuICAgIGZsb2F0IHUyID0gcyAvIHV3MiArIDIuMDtcblxuICAgIGZsb2F0IHZ3MCA9ICg0LjAgLSAzLjAgKiB0KTtcbiAgICBmbG9hdCB2dzEgPSA3LjA7XG4gICAgZmxvYXQgdncyID0gKDEuMCArIDMuMCAqIHQpO1xuXG4gICAgZmxvYXQgdjAgPSAoMy4wIC0gMi4wICogdCkgLyB2dzAgLSAyLjA7XG4gICAgZmxvYXQgdjEgPSAoMy4wICsgdCkgLyB2dzE7XG4gICAgZmxvYXQgdjIgPSB0IC8gdncyICsgMi4wO1xuXG4gICAgZmxvYXQgc3VtID0gMC4wO1xuXG4gICAgdTAgPSB1MCAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lng7XG4gICAgdjAgPSB2MCAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lnk7XG5cbiAgICB1MSA9IHUxICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueDtcbiAgICB2MSA9IHYxICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueTtcblxuICAgIHUyID0gdTIgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di54O1xuICAgIHYyID0gdjIgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di55O1xuXG4gICAgc3VtICs9IHV3MCAqIHZ3MCAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUwLCB2MCwgeikpO1xuICAgIHN1bSArPSB1dzEgKiB2dzAgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MSwgdjAsIHopKTtcbiAgICBzdW0gKz0gdXcyICogdncwICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTIsIHYwLCB6KSk7XG5cbiAgICBzdW0gKz0gdXcwICogdncxICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTAsIHYxLCB6KSk7XG4gICAgc3VtICs9IHV3MSAqIHZ3MSAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUxLCB2MSwgeikpO1xuICAgIHN1bSArPSB1dzIgKiB2dzEgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MiwgdjEsIHopKTtcblxuICAgIHN1bSArPSB1dzAgKiB2dzIgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MCwgdjIsIHopKTtcbiAgICBzdW0gKz0gdXcxICogdncyICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTEsIHYyLCB6KSk7XG4gICAgc3VtICs9IHV3MiAqIHZ3MiAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUyLCB2MiwgeikpO1xuXG4gICAgc3VtICo9IDEuMGYgLyAxNDQuMDtcblxuICAgIHN1bSA9IHNhdHVyYXRlKHN1bSk7XG5cbiAgICByZXR1cm4gc3VtO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dQQ0Y1eDUoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGNXg1KFNIQURPV01BUF9QQVNTKHNoYWRvd01hcCksIHNoYWRvd1BhcmFtcyk7XG59XG5cbmZsb2F0IGdldFNoYWRvd1Nwb3RQQ0Y1eDUoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGNXg1KFNIQURPV01BUF9QQVNTKHNoYWRvd01hcCksIHNoYWRvd1BhcmFtcy54eXopO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDBCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
