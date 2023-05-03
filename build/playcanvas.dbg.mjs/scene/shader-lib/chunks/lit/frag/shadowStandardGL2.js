var shadowStandardGL2PS = /* glsl */`
float _getShadowPCF5x5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec3 shadowParams) {
    // http://the-witness.net/news/2013/09/shadow-mapping-summary-part-1/

    float z = shadowCoord.z;
    vec2 uv = shadowCoord.xy * shadowParams.x; // 1 unit - 1 texel
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

float getShadowPCF5x5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec3 shadowParams) {
    return _getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
}

float getShadowSpotPCF5x5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
    return _getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
}
`;

export { shadowStandardGL2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmRHTDIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dTdGFuZGFyZEdMMi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgX2dldFNoYWRvd1BDRjV4NShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgLy8gaHR0cDovL3RoZS13aXRuZXNzLm5ldC9uZXdzLzIwMTMvMDkvc2hhZG93LW1hcHBpbmctc3VtbWFyeS1wYXJ0LTEvXG5cbiAgICBmbG9hdCB6ID0gc2hhZG93Q29vcmQuejtcbiAgICB2ZWMyIHV2ID0gc2hhZG93Q29vcmQueHkgKiBzaGFkb3dQYXJhbXMueDsgLy8gMSB1bml0IC0gMSB0ZXhlbFxuICAgIGZsb2F0IHNoYWRvd01hcFNpemVJbnYgPSAxLjAgLyBzaGFkb3dQYXJhbXMueDtcbiAgICB2ZWMyIGJhc2VfdXYgPSBmbG9vcih1diArIDAuNSk7XG4gICAgZmxvYXQgcyA9ICh1di54ICsgMC41IC0gYmFzZV91di54KTtcbiAgICBmbG9hdCB0ID0gKHV2LnkgKyAwLjUgLSBiYXNlX3V2LnkpO1xuICAgIGJhc2VfdXYgLT0gdmVjMigwLjUpO1xuICAgIGJhc2VfdXYgKj0gc2hhZG93TWFwU2l6ZUludjtcblxuXG4gICAgZmxvYXQgdXcwID0gKDQuMCAtIDMuMCAqIHMpO1xuICAgIGZsb2F0IHV3MSA9IDcuMDtcbiAgICBmbG9hdCB1dzIgPSAoMS4wICsgMy4wICogcyk7XG5cbiAgICBmbG9hdCB1MCA9ICgzLjAgLSAyLjAgKiBzKSAvIHV3MCAtIDIuMDtcbiAgICBmbG9hdCB1MSA9ICgzLjAgKyBzKSAvIHV3MTtcbiAgICBmbG9hdCB1MiA9IHMgLyB1dzIgKyAyLjA7XG5cbiAgICBmbG9hdCB2dzAgPSAoNC4wIC0gMy4wICogdCk7XG4gICAgZmxvYXQgdncxID0gNy4wO1xuICAgIGZsb2F0IHZ3MiA9ICgxLjAgKyAzLjAgKiB0KTtcblxuICAgIGZsb2F0IHYwID0gKDMuMCAtIDIuMCAqIHQpIC8gdncwIC0gMi4wO1xuICAgIGZsb2F0IHYxID0gKDMuMCArIHQpIC8gdncxO1xuICAgIGZsb2F0IHYyID0gdCAvIHZ3MiArIDIuMDtcblxuICAgIGZsb2F0IHN1bSA9IDAuMDtcblxuICAgIHUwID0gdTAgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di54O1xuICAgIHYwID0gdjAgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di55O1xuXG4gICAgdTEgPSB1MSAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lng7XG4gICAgdjEgPSB2MSAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lnk7XG5cbiAgICB1MiA9IHUyICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueDtcbiAgICB2MiA9IHYyICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueTtcblxuICAgIHN1bSArPSB1dzAgKiB2dzAgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MCwgdjAsIHopKTtcbiAgICBzdW0gKz0gdXcxICogdncwICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTEsIHYwLCB6KSk7XG4gICAgc3VtICs9IHV3MiAqIHZ3MCAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUyLCB2MCwgeikpO1xuXG4gICAgc3VtICs9IHV3MCAqIHZ3MSAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUwLCB2MSwgeikpO1xuICAgIHN1bSArPSB1dzEgKiB2dzEgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MSwgdjEsIHopKTtcbiAgICBzdW0gKz0gdXcyICogdncxICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTIsIHYxLCB6KSk7XG5cbiAgICBzdW0gKz0gdXcwICogdncyICogdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHZlYzModTAsIHYyLCB6KSk7XG4gICAgc3VtICs9IHV3MSAqIHZ3MiAqIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHUxLCB2MiwgeikpO1xuICAgIHN1bSArPSB1dzIgKiB2dzIgKiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1MiwgdjIsIHopKTtcblxuICAgIHN1bSAqPSAxLjBmIC8gMTQ0LjA7XG5cbiAgICBzdW0gPSBzYXR1cmF0ZShzdW0pO1xuXG4gICAgcmV0dXJuIHN1bTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93UENGNXg1KFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjMyBzaGFkb3dDb29yZCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICByZXR1cm4gX2dldFNoYWRvd1BDRjV4NShTSEFET1dNQVBfUEFTUyhzaGFkb3dNYXApLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zKTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93U3BvdFBDRjV4NShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgcmV0dXJuIF9nZXRTaGFkb3dQQ0Y1eDUoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
