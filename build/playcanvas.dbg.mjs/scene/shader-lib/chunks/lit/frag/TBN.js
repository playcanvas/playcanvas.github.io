/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var TBNPS = /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    dTBN = mat3(normalize(tangent), normalize(binormal), normalize(normal));
}
`;

export { TBNPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVEJOLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvVEJOLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIGdldFRCTih2ZWMzIHRhbmdlbnQsIHZlYzMgYmlub3JtYWwsIHZlYzMgbm9ybWFsKSB7XG4gICAgZFRCTiA9IG1hdDMobm9ybWFsaXplKHRhbmdlbnQpLCBub3JtYWxpemUoYmlub3JtYWwpLCBub3JtYWxpemUobm9ybWFsKSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsWUFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
