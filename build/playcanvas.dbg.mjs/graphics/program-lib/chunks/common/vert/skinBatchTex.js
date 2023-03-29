/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skinBatchTexVS = `
attribute float vertex_boneIndices;

uniform highp sampler2D texture_poseMap;
uniform vec4 texture_poseMapSize;

mat4 getBoneMatrix(const in float i) {
    float j = i * 3.0;
    float dx = texture_poseMapSize.z;
    float dy = texture_poseMapSize.w;

    float y = floor(j * dx);
    float x = j - (y * texture_poseMapSize.x);
    y = dy * (y + 0.5);

    // read elements of 4x3 matrix
    vec4 v1 = texture2D(texture_poseMap, vec2(dx * (x + 0.5), y));
    vec4 v2 = texture2D(texture_poseMap, vec2(dx * (x + 1.5), y));
    vec4 v3 = texture2D(texture_poseMap, vec2(dx * (x + 2.5), y));

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, 1
    );
}
`;

export { skinBatchTexVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbkJhdGNoVGV4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi92ZXJ0L3NraW5CYXRjaFRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuYXR0cmlidXRlIGZsb2F0IHZlcnRleF9ib25lSW5kaWNlcztcblxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgdGV4dHVyZV9wb3NlTWFwO1xudW5pZm9ybSB2ZWM0IHRleHR1cmVfcG9zZU1hcFNpemU7XG5cbm1hdDQgZ2V0Qm9uZU1hdHJpeChjb25zdCBpbiBmbG9hdCBpKSB7XG4gICAgZmxvYXQgaiA9IGkgKiAzLjA7XG4gICAgZmxvYXQgZHggPSB0ZXh0dXJlX3Bvc2VNYXBTaXplLno7XG4gICAgZmxvYXQgZHkgPSB0ZXh0dXJlX3Bvc2VNYXBTaXplLnc7XG5cbiAgICBmbG9hdCB5ID0gZmxvb3IoaiAqIGR4KTtcbiAgICBmbG9hdCB4ID0gaiAtICh5ICogdGV4dHVyZV9wb3NlTWFwU2l6ZS54KTtcbiAgICB5ID0gZHkgKiAoeSArIDAuNSk7XG5cbiAgICAvLyByZWFkIGVsZW1lbnRzIG9mIDR4MyBtYXRyaXhcbiAgICB2ZWM0IHYxID0gdGV4dHVyZTJEKHRleHR1cmVfcG9zZU1hcCwgdmVjMihkeCAqICh4ICsgMC41KSwgeSkpO1xuICAgIHZlYzQgdjIgPSB0ZXh0dXJlMkQodGV4dHVyZV9wb3NlTWFwLCB2ZWMyKGR4ICogKHggKyAxLjUpLCB5KSk7XG4gICAgdmVjNCB2MyA9IHRleHR1cmUyRCh0ZXh0dXJlX3Bvc2VNYXAsIHZlYzIoZHggKiAoeCArIDIuNSksIHkpKTtcblxuICAgIC8vIHRyYW5zcG9zZSB0byA0eDQgbWF0cml4XG4gICAgcmV0dXJuIG1hdDQoXG4gICAgICAgIHYxLngsIHYyLngsIHYzLngsIDAsXG4gICAgICAgIHYxLnksIHYyLnksIHYzLnksIDAsXG4gICAgICAgIHYxLnosIHYyLnosIHYzLnosIDAsXG4gICAgICAgIHYxLncsIHYyLncsIHYzLncsIDFcbiAgICApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHFCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBNUJBOzs7OyJ9
