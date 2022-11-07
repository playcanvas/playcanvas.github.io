/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fresnelSchlickPS = `
// Schlick's approximation
vec3 getFresnel(float cosTheta, vec3 f0) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = dGlossiness * dGlossiness;
    vec3 ret = f0 + (max(vec3(glossSq), f0) - f0) * fresnel;
    #ifdef LIT_IRIDESCENCE
        return mix(ret, dIridescenceFresnel, vec3(dIridescence));
    #else
        return ret;
    #endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;

export { fresnelSchlickPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJlc25lbFNjaGxpY2suanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvZnJlc25lbFNjaGxpY2suanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vIFNjaGxpY2sncyBhcHByb3hpbWF0aW9uXG52ZWMzIGdldEZyZXNuZWwoZmxvYXQgY29zVGhldGEsIHZlYzMgZjApIHtcbiAgICBmbG9hdCBmcmVzbmVsID0gcG93KDEuMCAtIG1heChjb3NUaGV0YSwgMC4wKSwgNS4wKTtcbiAgICBmbG9hdCBnbG9zc1NxID0gZEdsb3NzaW5lc3MgKiBkR2xvc3NpbmVzcztcbiAgICB2ZWMzIHJldCA9IGYwICsgKG1heCh2ZWMzKGdsb3NzU3EpLCBmMCkgLSBmMCkgKiBmcmVzbmVsO1xuICAgICNpZmRlZiBMSVRfSVJJREVTQ0VOQ0VcbiAgICAgICAgcmV0dXJuIG1peChyZXQsIGRJcmlkZXNjZW5jZUZyZXNuZWwsIHZlYzMoZElyaWRlc2NlbmNlKSk7XG4gICAgI2Vsc2VcbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICAjZW5kaWYgICAgXG59XG5cbmZsb2F0IGdldEZyZXNuZWxDQyhmbG9hdCBjb3NUaGV0YSkge1xuICAgIGZsb2F0IGZyZXNuZWwgPSBwb3coMS4wIC0gbWF4KGNvc1RoZXRhLCAwLjApLCA1LjApO1xuICAgIHJldHVybiAwLjA0ICsgKDEuMCAtIDAuMDQpICogZnJlc25lbDtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBakJBOzs7OyJ9
