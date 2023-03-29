/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCCPS = /* glsl */`
#ifdef LIT_CLEARCOAT
void addReflectionCC(vec3 reflDir, float gloss) {
    ccReflection += calcReflection(reflDir, gloss);
}
#endif
`;

export { reflectionCCPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkNDLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvbkNDLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTElUX0NMRUFSQ09BVFxudm9pZCBhZGRSZWZsZWN0aW9uQ0ModmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykge1xuICAgIGNjUmVmbGVjdGlvbiArPSBjYWxjUmVmbGVjdGlvbihyZWZsRGlyLCBnbG9zcyk7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
