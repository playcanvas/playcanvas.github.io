/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = `
float getFalloffLinear(float lightRadius) {
    float d = length(dLightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFsbG9mZkxpbmVhci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9mYWxsb2ZmTGluZWFyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBnZXRGYWxsb2ZmTGluZWFyKGZsb2F0IGxpZ2h0UmFkaXVzKSB7XG4gICAgZmxvYXQgZCA9IGxlbmd0aChkTGlnaHREaXJXKTtcbiAgICByZXR1cm4gbWF4KCgobGlnaHRSYWRpdXMgLSBkKSAvIGxpZ2h0UmFkaXVzKSwgMC4wKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBTEE7Ozs7In0=
