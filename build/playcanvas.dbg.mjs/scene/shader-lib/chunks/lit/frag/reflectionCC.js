/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCCPS = `
#ifdef LIT_CLEARCOAT
void addReflectionCC() {
    ccReflection += calcReflection(ccReflDirW, ccGlossiness);
}
#endif
`;

export { reflectionCCPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkNDLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvbkNDLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTElUX0NMRUFSQ09BVFxudm9pZCBhZGRSZWZsZWN0aW9uQ0MoKSB7XG4gICAgY2NSZWZsZWN0aW9uICs9IGNhbGNSZWZsZWN0aW9uKGNjUmVmbERpclcsIGNjR2xvc3NpbmVzcyk7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
