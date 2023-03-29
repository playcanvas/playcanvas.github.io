/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fresnelSchlickPS = `
// Schlick's approximation
vec3 getFresnel(float cosTheta, vec3 f0) {
    float fresnel = pow(1.0 - abs(cosTheta), 5.0);
    float glossSq = dGlossiness * dGlossiness;
    vec3 ret = f0 + (max(vec3(glossSq), f0) - f0) * fresnel;
    #ifdef LIT_IRIDESCENCE
        return mix(ret, dIridescenceFresnel, vec3(dIridescence));
    #else
        return ret;
    #endif    
}

float getFresnelCC(float cosTheta, float glossiness) {
    float fresnel = pow(1.0 - abs(cosTheta), 5.0);
    float glossSq = glossiness * glossiness;
    const float f0 = 0.04;
    return f0 + (max(glossSq, f0) - f0) * fresnel;
}
`;

export { fresnelSchlickPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJlc25lbFNjaGxpY2suanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvZnJlc25lbFNjaGxpY2suanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2Bcbi8vIFNjaGxpY2sncyBhcHByb3hpbWF0aW9uXG52ZWMzIGdldEZyZXNuZWwoZmxvYXQgY29zVGhldGEsIHZlYzMgZjApIHtcbiAgICBmbG9hdCBmcmVzbmVsID0gcG93KDEuMCAtIGFicyhjb3NUaGV0YSksIDUuMCk7XG4gICAgZmxvYXQgZ2xvc3NTcSA9IGRHbG9zc2luZXNzICogZEdsb3NzaW5lc3M7XG4gICAgdmVjMyByZXQgPSBmMCArIChtYXgodmVjMyhnbG9zc1NxKSwgZjApIC0gZjApICogZnJlc25lbDtcbiAgICAjaWZkZWYgTElUX0lSSURFU0NFTkNFXG4gICAgICAgIHJldHVybiBtaXgocmV0LCBkSXJpZGVzY2VuY2VGcmVzbmVsLCB2ZWMzKGRJcmlkZXNjZW5jZSkpO1xuICAgICNlbHNlXG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgI2VuZGlmICAgIFxufVxuXG5mbG9hdCBnZXRGcmVzbmVsQ0MoZmxvYXQgY29zVGhldGEsIGZsb2F0IGdsb3NzaW5lc3MpIHtcbiAgICBmbG9hdCBmcmVzbmVsID0gcG93KDEuMCAtIGFicyhjb3NUaGV0YSksIDUuMCk7XG4gICAgZmxvYXQgZ2xvc3NTcSA9IGdsb3NzaW5lc3MgKiBnbG9zc2luZXNzO1xuICAgIGNvbnN0IGZsb2F0IGYwID0gMC4wNDtcbiAgICByZXR1cm4gZjAgKyAobWF4KGdsb3NzU3EsIGYwKSAtIGYwKSAqIGZyZXNuZWw7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FuQkE7Ozs7In0=
