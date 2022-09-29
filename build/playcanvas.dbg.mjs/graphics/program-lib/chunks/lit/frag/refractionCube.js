/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmcmFjdGlvbkN1YmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmcmFjdGlvbkN1YmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4O1xuXG52ZWMzIHJlZnJhY3QyKHZlYzMgdmlld1ZlYywgdmVjMyBOb3JtYWwsIGZsb2F0IElPUikge1xuICAgIGZsb2F0IHZuID0gZG90KHZpZXdWZWMsIE5vcm1hbCk7XG4gICAgZmxvYXQgayA9IDEuMCAtIElPUiAqIElPUiAqICgxLjAgLSB2biAqIHZuKTtcbiAgICB2ZWMzIHJlZnJWZWMgPSBJT1IgKiB2aWV3VmVjIC0gKElPUiAqIHZuICsgc3FydChrKSkgKiBOb3JtYWw7XG4gICAgcmV0dXJuIHJlZnJWZWM7XG59XG5cbnZvaWQgYWRkUmVmcmFjdGlvbigpIHtcbiAgICAvLyB1c2Ugc2FtZSByZWZsZWN0aW9uIGNvZGUgd2l0aCByZWZyYWN0aW9uIHZlY3RvclxuICAgIHZlYzMgdG1wRGlyID0gZFJlZmxEaXJXO1xuICAgIHZlYzQgdG1wUmVmbCA9IGRSZWZsZWN0aW9uO1xuICAgIGRSZWZsRGlyVyA9IHJlZnJhY3QyKC1kVmlld0RpclcsIGROb3JtYWxXLCBtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgpO1xuICAgIGRSZWZsZWN0aW9uID0gdmVjNCgwKTtcbiAgICBhZGRSZWZsZWN0aW9uKCk7XG4gICAgZERpZmZ1c2VMaWdodCA9IG1peChkRGlmZnVzZUxpZ2h0LCBkUmVmbGVjdGlvbi5yZ2IgKiBkQWxiZWRvLCBkVHJhbnNtaXNzaW9uKTtcbiAgICBkUmVmbGVjdGlvbiA9IHRtcFJlZmw7XG4gICAgZFJlZmxEaXJXID0gdG1wRGlyO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXJCQTs7OzsifQ==
