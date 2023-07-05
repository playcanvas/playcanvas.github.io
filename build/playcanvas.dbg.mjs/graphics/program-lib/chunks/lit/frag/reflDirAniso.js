/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflDirAnisoPS = `
void getReflDir() {
    float roughness = sqrt(1.0 - min(dGlossiness, 1.0));
    float anisotropy = material_anisotropy * roughness;
    vec3 anisotropicDirection = anisotropy >= 0.0 ? dTBN[1] : dTBN[0];
    vec3 anisotropicTangent = cross(anisotropicDirection, dViewDirW);
    vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    vec3 bentNormal = normalize(mix(normalize(dNormalW), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-dViewDirW, bentNormal);
}
`;

export { reflDirAnisoPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbERpckFuaXNvLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxEaXJBbmlzby5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBnZXRSZWZsRGlyKCkge1xuICAgIGZsb2F0IHJvdWdobmVzcyA9IHNxcnQoMS4wIC0gbWluKGRHbG9zc2luZXNzLCAxLjApKTtcbiAgICBmbG9hdCBhbmlzb3Ryb3B5ID0gbWF0ZXJpYWxfYW5pc290cm9weSAqIHJvdWdobmVzcztcbiAgICB2ZWMzIGFuaXNvdHJvcGljRGlyZWN0aW9uID0gYW5pc290cm9weSA+PSAwLjAgPyBkVEJOWzFdIDogZFRCTlswXTtcbiAgICB2ZWMzIGFuaXNvdHJvcGljVGFuZ2VudCA9IGNyb3NzKGFuaXNvdHJvcGljRGlyZWN0aW9uLCBkVmlld0RpclcpO1xuICAgIHZlYzMgYW5pc290cm9waWNOb3JtYWwgPSBjcm9zcyhhbmlzb3Ryb3BpY1RhbmdlbnQsIGFuaXNvdHJvcGljRGlyZWN0aW9uKTtcbiAgICB2ZWMzIGJlbnROb3JtYWwgPSBub3JtYWxpemUobWl4KG5vcm1hbGl6ZShkTm9ybWFsVyksIG5vcm1hbGl6ZShhbmlzb3Ryb3BpY05vcm1hbCksIGFuaXNvdHJvcHkpKTtcbiAgICBkUmVmbERpclcgPSByZWZsZWN0KC1kVmlld0RpclcsIGJlbnROb3JtYWwpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHFCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBVkE7Ozs7In0=
