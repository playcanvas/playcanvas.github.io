/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var refractionCubePS = `
uniform float material_refractionIndex;

vec3 refract2(vec3 viewVec, vec3 Normal, float IOR) {
    float vn = dot(viewVec, Normal);
    float k = 1.0 - IOR * IOR * (1.0 - vn * vn);
    vec3 refrVec = IOR * viewVec - (IOR * vn + sqrt(k)) * Normal;
    return refrVec;
}

void addRefraction() {
    // use same reflection code with refraction vector
    vec3 tmpDir = dReflDirW;
    vec4 tmpRefl = dReflection;
    dReflDirW = refract2(-dViewDirW, dNormalW, material_refractionIndex);
    dReflection = vec4(0);
    addReflection();
    dDiffuseLight = mix(dDiffuseLight, dReflection.rgb * dAlbedo, dTransmission);
    dReflection = tmpRefl;
    dReflDirW = tmpDir;
}
`;

export { refractionCubePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkN1YmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZyYWN0aW9uQ3ViZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXg7XG5cbnZlYzMgcmVmcmFjdDIodmVjMyB2aWV3VmVjLCB2ZWMzIE5vcm1hbCwgZmxvYXQgSU9SKSB7XG4gICAgZmxvYXQgdm4gPSBkb3Qodmlld1ZlYywgTm9ybWFsKTtcbiAgICBmbG9hdCBrID0gMS4wIC0gSU9SICogSU9SICogKDEuMCAtIHZuICogdm4pO1xuICAgIHZlYzMgcmVmclZlYyA9IElPUiAqIHZpZXdWZWMgLSAoSU9SICogdm4gKyBzcXJ0KGspKSAqIE5vcm1hbDtcbiAgICByZXR1cm4gcmVmclZlYztcbn1cblxudm9pZCBhZGRSZWZyYWN0aW9uKCkge1xuICAgIC8vIHVzZSBzYW1lIHJlZmxlY3Rpb24gY29kZSB3aXRoIHJlZnJhY3Rpb24gdmVjdG9yXG4gICAgdmVjMyB0bXBEaXIgPSBkUmVmbERpclc7XG4gICAgdmVjNCB0bXBSZWZsID0gZFJlZmxlY3Rpb247XG4gICAgZFJlZmxEaXJXID0gcmVmcmFjdDIoLWRWaWV3RGlyVywgZE5vcm1hbFcsIG1hdGVyaWFsX3JlZnJhY3Rpb25JbmRleCk7XG4gICAgZFJlZmxlY3Rpb24gPSB2ZWM0KDApO1xuICAgIGFkZFJlZmxlY3Rpb24oKTtcbiAgICBkRGlmZnVzZUxpZ2h0ID0gbWl4KGREaWZmdXNlTGlnaHQsIGRSZWZsZWN0aW9uLnJnYiAqIGRBbGJlZG8sIGRUcmFuc21pc3Npb24pO1xuICAgIGRSZWZsZWN0aW9uID0gdG1wUmVmbDtcbiAgICBkUmVmbERpclcgPSB0bXBEaXI7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
