/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccSimplePS = /* glsl */`
uniform float material_occludeSpecularIntensity;

void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
    float specOcc = mix(1.0, ao, material_occludeSpecularIntensity);
    dSpecularLight *= specOcc;
    dReflection *= specOcc;

#ifdef LIT_SHEEN
    sSpecularLight *= specOcc;
    sReflection *= specOcc;
#endif
}
`;

export { aoSpecOccSimplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjU2ltcGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW9TcGVjT2NjU2ltcGxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eTtcblxudm9pZCBvY2NsdWRlU3BlY3VsYXIoZmxvYXQgZ2xvc3MsIGZsb2F0IGFvLCB2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIpIHtcbiAgICBmbG9hdCBzcGVjT2NjID0gbWl4KDEuMCwgYW8sIG1hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eSk7XG4gICAgZFNwZWN1bGFyTGlnaHQgKj0gc3BlY09jYztcbiAgICBkUmVmbGVjdGlvbiAqPSBzcGVjT2NjO1xuXG4jaWZkZWYgTElUX1NIRUVOXG4gICAgc1NwZWN1bGFyTGlnaHQgKj0gc3BlY09jYztcbiAgICBzUmVmbGVjdGlvbiAqPSBzcGVjT2NjO1xuI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
