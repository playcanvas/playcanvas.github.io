/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccSimplePS = `
uniform float material_occludeSpecularIntensity;

void occludeSpecular() {
    float specOcc = mix(1.0, dAo, material_occludeSpecularIntensity);
    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
`;

export { aoSpecOccSimplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjU2ltcGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW9TcGVjT2NjU2ltcGxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eTtcblxudm9pZCBvY2NsdWRlU3BlY3VsYXIoKSB7XG4gICAgZmxvYXQgc3BlY09jYyA9IG1peCgxLjAsIGRBbywgbWF0ZXJpYWxfb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5KTtcbiAgICBkU3BlY3VsYXJMaWdodCAqPSBzcGVjT2NjO1xuICAgIGRSZWZsZWN0aW9uICo9IHNwZWNPY2M7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
