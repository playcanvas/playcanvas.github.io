/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var diffuseDetailMapPS = /* glsl */`
vec3 addAlbedoDetail(vec3 albedo) {
#ifdef MAPTEXTURE
    vec3 albedoDetail = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    return detailMode_$DETAILMODE(albedo, albedoDetail);
#else
    return albedo;
#endif
}
`;

export { diffuseDetailMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZnVzZURldGFpbE1hcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvZGlmZnVzZURldGFpbE1hcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBhZGRBbGJlZG9EZXRhaWwodmVjMyBhbGJlZG8pIHtcbiNpZmRlZiBNQVBURVhUVVJFXG4gICAgdmVjMyBhbGJlZG9EZXRhaWwgPSAkREVDT0RFKHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpKS4kQ0g7XG4gICAgcmV0dXJuIGRldGFpbE1vZGVfJERFVEFJTE1PREUoYWxiZWRvLCBhbGJlZG9EZXRhaWwpO1xuI2Vsc2VcbiAgICByZXR1cm4gYWxiZWRvO1xuI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
