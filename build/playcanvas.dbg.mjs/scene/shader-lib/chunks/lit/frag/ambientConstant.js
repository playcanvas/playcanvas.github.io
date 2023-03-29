/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientConstantPS = /* glsl */`
void addAmbient(vec3 worldNormal) {
    dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1iaWVudENvbnN0YW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW1iaWVudENvbnN0YW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIGFkZEFtYmllbnQodmVjMyB3b3JsZE5vcm1hbCkge1xuICAgIGREaWZmdXNlTGlnaHQgKz0gbGlnaHRfZ2xvYmFsQW1iaWVudDtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
