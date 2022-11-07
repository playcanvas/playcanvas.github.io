/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbERpckFuaXNvLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbERpckFuaXNvLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIGdldFJlZmxEaXIoKSB7XG4gICAgZmxvYXQgcm91Z2huZXNzID0gc3FydCgxLjAgLSBtaW4oZEdsb3NzaW5lc3MsIDEuMCkpO1xuICAgIGZsb2F0IGFuaXNvdHJvcHkgPSBtYXRlcmlhbF9hbmlzb3Ryb3B5ICogcm91Z2huZXNzO1xuICAgIHZlYzMgYW5pc290cm9waWNEaXJlY3Rpb24gPSBhbmlzb3Ryb3B5ID49IDAuMCA/IGRUQk5bMV0gOiBkVEJOWzBdO1xuICAgIHZlYzMgYW5pc290cm9waWNUYW5nZW50ID0gY3Jvc3MoYW5pc290cm9waWNEaXJlY3Rpb24sIGRWaWV3RGlyVyk7XG4gICAgdmVjMyBhbmlzb3Ryb3BpY05vcm1hbCA9IGNyb3NzKGFuaXNvdHJvcGljVGFuZ2VudCwgYW5pc290cm9waWNEaXJlY3Rpb24pO1xuICAgIHZlYzMgYmVudE5vcm1hbCA9IG5vcm1hbGl6ZShtaXgobm9ybWFsaXplKGROb3JtYWxXKSwgbm9ybWFsaXplKGFuaXNvdHJvcGljTm9ybWFsKSwgYW5pc290cm9weSkpO1xuICAgIGRSZWZsRGlyVyA9IHJlZmxlY3QoLWRWaWV3RGlyVywgYmVudE5vcm1hbCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEscUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
