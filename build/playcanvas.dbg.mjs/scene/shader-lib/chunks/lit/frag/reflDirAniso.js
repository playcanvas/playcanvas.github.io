/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflDirAnisoPS = /* glsl */`
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
    float roughness = sqrt(1.0 - min(gloss, 1.0));
    float anisotropy = material_anisotropy * roughness;
    vec3 anisotropicDirection = anisotropy >= 0.0 ? tbn[1] : tbn[0];
    vec3 anisotropicTangent = cross(anisotropicDirection, viewDir);
    vec3 anisotropicNormal = cross(anisotropicTangent, anisotropicDirection);
    vec3 bentNormal = normalize(mix(normalize(worldNormal), normalize(anisotropicNormal), anisotropy));
    dReflDirW = reflect(-viewDir, bentNormal);
}
`;

export { reflDirAnisoPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbERpckFuaXNvLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbERpckFuaXNvLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIGdldFJlZmxEaXIodmVjMyB3b3JsZE5vcm1hbCwgdmVjMyB2aWV3RGlyLCBmbG9hdCBnbG9zcywgbWF0MyB0Ym4pIHtcbiAgICBmbG9hdCByb3VnaG5lc3MgPSBzcXJ0KDEuMCAtIG1pbihnbG9zcywgMS4wKSk7XG4gICAgZmxvYXQgYW5pc290cm9weSA9IG1hdGVyaWFsX2FuaXNvdHJvcHkgKiByb3VnaG5lc3M7XG4gICAgdmVjMyBhbmlzb3Ryb3BpY0RpcmVjdGlvbiA9IGFuaXNvdHJvcHkgPj0gMC4wID8gdGJuWzFdIDogdGJuWzBdO1xuICAgIHZlYzMgYW5pc290cm9waWNUYW5nZW50ID0gY3Jvc3MoYW5pc290cm9waWNEaXJlY3Rpb24sIHZpZXdEaXIpO1xuICAgIHZlYzMgYW5pc290cm9waWNOb3JtYWwgPSBjcm9zcyhhbmlzb3Ryb3BpY1RhbmdlbnQsIGFuaXNvdHJvcGljRGlyZWN0aW9uKTtcbiAgICB2ZWMzIGJlbnROb3JtYWwgPSBub3JtYWxpemUobWl4KG5vcm1hbGl6ZSh3b3JsZE5vcm1hbCksIG5vcm1hbGl6ZShhbmlzb3Ryb3BpY05vcm1hbCksIGFuaXNvdHJvcHkpKTtcbiAgICBkUmVmbERpclcgPSByZWZsZWN0KC12aWV3RGlyLCBiZW50Tm9ybWFsKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
