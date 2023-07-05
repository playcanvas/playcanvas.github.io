/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowStandardGL2PS = `
float _getShadowPCF5x5(sampler2DShadow shadowMap, vec3 shadowParams) {
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

    sum += uw0 * vw0 * texture(shadowMap, vec3(u0, v0, z));
    sum += uw1 * vw0 * texture(shadowMap, vec3(u1, v0, z));
    sum += uw2 * vw0 * texture(shadowMap, vec3(u2, v0, z));

    sum += uw0 * vw1 * texture(shadowMap, vec3(u0, v1, z));
    sum += uw1 * vw1 * texture(shadowMap, vec3(u1, v1, z));
    sum += uw2 * vw1 * texture(shadowMap, vec3(u2, v1, z));

    sum += uw0 * vw2 * texture(shadowMap, vec3(u0, v2, z));
    sum += uw1 * vw2 * texture(shadowMap, vec3(u1, v2, z));
    sum += uw2 * vw2 * texture(shadowMap, vec3(u2, v2, z));

    sum *= 1.0f / 144.0;

    sum = gammaCorrectInput(sum); // gives softer gradient
    sum = saturate(sum);

    return sum;
}

float getShadowPCF5x5(sampler2DShadow shadowMap, vec3 shadowParams) {
    return _getShadowPCF5x5(shadowMap, shadowParams);
}

float getShadowSpotPCF5x5(sampler2DShadow shadowMap, vec4 shadowParams) {
    return _getShadowPCF5x5(shadowMap, shadowParams.xyz);
}
`;

export { shadowStandardGL2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U3RhbmRhcmRHTDIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93U3RhbmRhcmRHTDIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IF9nZXRTaGFkb3dQQ0Y1eDUoc2FtcGxlcjJEU2hhZG93IHNoYWRvd01hcCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICAvLyBodHRwOi8vdGhlLXdpdG5lc3MubmV0L25ld3MvMjAxMy8wOS9zaGFkb3ctbWFwcGluZy1zdW1tYXJ5LXBhcnQtMS9cblxuICAgIGZsb2F0IHogPSBkU2hhZG93Q29vcmQuejtcbiAgICB2ZWMyIHV2ID0gZFNoYWRvd0Nvb3JkLnh5ICogc2hhZG93UGFyYW1zLng7IC8vIDEgdW5pdCAtIDEgdGV4ZWxcbiAgICBmbG9hdCBzaGFkb3dNYXBTaXplSW52ID0gMS4wIC8gc2hhZG93UGFyYW1zLng7XG4gICAgdmVjMiBiYXNlX3V2ID0gZmxvb3IodXYgKyAwLjUpO1xuICAgIGZsb2F0IHMgPSAodXYueCArIDAuNSAtIGJhc2VfdXYueCk7XG4gICAgZmxvYXQgdCA9ICh1di55ICsgMC41IC0gYmFzZV91di55KTtcbiAgICBiYXNlX3V2IC09IHZlYzIoMC41KTtcbiAgICBiYXNlX3V2ICo9IHNoYWRvd01hcFNpemVJbnY7XG5cblxuICAgIGZsb2F0IHV3MCA9ICg0LjAgLSAzLjAgKiBzKTtcbiAgICBmbG9hdCB1dzEgPSA3LjA7XG4gICAgZmxvYXQgdXcyID0gKDEuMCArIDMuMCAqIHMpO1xuXG4gICAgZmxvYXQgdTAgPSAoMy4wIC0gMi4wICogcykgLyB1dzAgLSAyLjA7XG4gICAgZmxvYXQgdTEgPSAoMy4wICsgcykgLyB1dzE7XG4gICAgZmxvYXQgdTIgPSBzIC8gdXcyICsgMi4wO1xuXG4gICAgZmxvYXQgdncwID0gKDQuMCAtIDMuMCAqIHQpO1xuICAgIGZsb2F0IHZ3MSA9IDcuMDtcbiAgICBmbG9hdCB2dzIgPSAoMS4wICsgMy4wICogdCk7XG5cbiAgICBmbG9hdCB2MCA9ICgzLjAgLSAyLjAgKiB0KSAvIHZ3MCAtIDIuMDtcbiAgICBmbG9hdCB2MSA9ICgzLjAgKyB0KSAvIHZ3MTtcbiAgICBmbG9hdCB2MiA9IHQgLyB2dzIgKyAyLjA7XG5cbiAgICBmbG9hdCBzdW0gPSAwLjA7XG5cbiAgICB1MCA9IHUwICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueDtcbiAgICB2MCA9IHYwICogc2hhZG93TWFwU2l6ZUludiArIGJhc2VfdXYueTtcblxuICAgIHUxID0gdTEgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di54O1xuICAgIHYxID0gdjEgKiBzaGFkb3dNYXBTaXplSW52ICsgYmFzZV91di55O1xuXG4gICAgdTIgPSB1MiAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lng7XG4gICAgdjIgPSB2MiAqIHNoYWRvd01hcFNpemVJbnYgKyBiYXNlX3V2Lnk7XG5cbiAgICBzdW0gKz0gdXcwICogdncwICogdGV4dHVyZShzaGFkb3dNYXAsIHZlYzModTAsIHYwLCB6KSk7XG4gICAgc3VtICs9IHV3MSAqIHZ3MCAqIHRleHR1cmUoc2hhZG93TWFwLCB2ZWMzKHUxLCB2MCwgeikpO1xuICAgIHN1bSArPSB1dzIgKiB2dzAgKiB0ZXh0dXJlKHNoYWRvd01hcCwgdmVjMyh1MiwgdjAsIHopKTtcblxuICAgIHN1bSArPSB1dzAgKiB2dzEgKiB0ZXh0dXJlKHNoYWRvd01hcCwgdmVjMyh1MCwgdjEsIHopKTtcbiAgICBzdW0gKz0gdXcxICogdncxICogdGV4dHVyZShzaGFkb3dNYXAsIHZlYzModTEsIHYxLCB6KSk7XG4gICAgc3VtICs9IHV3MiAqIHZ3MSAqIHRleHR1cmUoc2hhZG93TWFwLCB2ZWMzKHUyLCB2MSwgeikpO1xuXG4gICAgc3VtICs9IHV3MCAqIHZ3MiAqIHRleHR1cmUoc2hhZG93TWFwLCB2ZWMzKHUwLCB2MiwgeikpO1xuICAgIHN1bSArPSB1dzEgKiB2dzIgKiB0ZXh0dXJlKHNoYWRvd01hcCwgdmVjMyh1MSwgdjIsIHopKTtcbiAgICBzdW0gKz0gdXcyICogdncyICogdGV4dHVyZShzaGFkb3dNYXAsIHZlYzModTIsIHYyLCB6KSk7XG5cbiAgICBzdW0gKj0gMS4wZiAvIDE0NC4wO1xuXG4gICAgc3VtID0gZ2FtbWFDb3JyZWN0SW5wdXQoc3VtKTsgLy8gZ2l2ZXMgc29mdGVyIGdyYWRpZW50XG4gICAgc3VtID0gc2F0dXJhdGUoc3VtKTtcblxuICAgIHJldHVybiBzdW07XG59XG5cbmZsb2F0IGdldFNoYWRvd1BDRjV4NShzYW1wbGVyMkRTaGFkb3cgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGNXg1KHNoYWRvd01hcCwgc2hhZG93UGFyYW1zKTtcbn1cblxuZmxvYXQgZ2V0U2hhZG93U3BvdFBDRjV4NShzYW1wbGVyMkRTaGFkb3cgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIHJldHVybiBfZ2V0U2hhZG93UENGNXg1KHNoYWRvd01hcCwgc2hhZG93UGFyYW1zLnh5eik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXBFQTs7OzsifQ==
