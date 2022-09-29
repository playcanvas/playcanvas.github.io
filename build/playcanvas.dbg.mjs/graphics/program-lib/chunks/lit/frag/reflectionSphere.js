/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSpherePS = `
#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 reflDirV = (mat3(matrix_view) * tReflDirW).xyz;

    float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );
    vec2 sphereMapUv = reflDirV.xy / m + 0.5;

    return $DECODE(texture2D(texture_sphereMap, sphereMapUv));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionSpherePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNwaGVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9yZWZsZWN0aW9uU3BoZXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZuZGVmIFZJRVdNQVRSSVhcbiNkZWZpbmUgVklFV01BVFJJWFxudW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3O1xuI2VuZGlmXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX3NwaGVyZU1hcDtcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5O1xuXG52ZWMzIGNhbGNSZWZsZWN0aW9uKHZlYzMgdFJlZmxEaXJXLCBmbG9hdCB0R2xvc3NpbmVzcykge1xuICAgIHZlYzMgcmVmbERpclYgPSAobWF0MyhtYXRyaXhfdmlldykgKiB0UmVmbERpclcpLnh5ejtcblxuICAgIGZsb2F0IG0gPSAyLjAgKiBzcXJ0KCBkb3QocmVmbERpclYueHksIHJlZmxEaXJWLnh5KSArIChyZWZsRGlyVi56KzEuMCkqKHJlZmxEaXJWLnorMS4wKSApO1xuICAgIHZlYzIgc3BoZXJlTWFwVXYgPSByZWZsRGlyVi54eSAvIG0gKyAwLjU7XG5cbiAgICByZXR1cm4gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9zcGhlcmVNYXAsIHNwaGVyZU1hcFV2KSk7XG59XG5cbnZvaWQgYWRkUmVmbGVjdGlvbigpIHsgICBcbiAgICBkUmVmbGVjdGlvbiArPSB2ZWM0KGNhbGNSZWZsZWN0aW9uKGRSZWZsRGlyVywgZEdsb3NzaW5lc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FwQkE7Ozs7In0=
