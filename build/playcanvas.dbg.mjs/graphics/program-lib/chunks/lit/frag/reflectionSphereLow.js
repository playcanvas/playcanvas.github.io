/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSphereLowPS = `
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    return $DECODE(texture2D(texture_sphereMap, sphereMapUv));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionSphereLowPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNwaGVyZUxvdy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9yZWZsZWN0aW9uU3BoZXJlTG93LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX3NwaGVyZU1hcDtcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5O1xuXG52ZWMzIGNhbGNSZWZsZWN0aW9uKHZlYzMgdFJlZmxEaXJXLCBmbG9hdCB0R2xvc3NpbmVzcykge1xuICAgIHZlYzMgcmVmbERpclYgPSB2Tm9ybWFsVjtcblxuICAgIHZlYzIgc3BoZXJlTWFwVXYgPSByZWZsRGlyVi54eSAqIDAuNSArIDAuNTtcbiAgICByZXR1cm4gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9zcGhlcmVNYXAsIHNwaGVyZU1hcFV2KSk7XG59XG5cbnZvaWQgYWRkUmVmbGVjdGlvbigpIHsgICBcbiAgICBkUmVmbGVjdGlvbiArPSB2ZWM0KGNhbGNSZWZsZWN0aW9uKGRSZWZsRGlyVywgZEdsb3NzaW5lc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDRCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FkQTs7OzsifQ==
