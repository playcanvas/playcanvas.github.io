/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccPS = `
uniform float material_occludeSpecularIntensity;

void occludeSpecular() {
    // approximated specular occlusion from AO
    float specPow = exp2(dGlossiness * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(dNormalW, dViewDirW) + dAo, 0.01*specPow) - 1.0 + dAo);
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);

    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
`;

export { aoSpecOccPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW9TcGVjT2NjLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eTtcblxudm9pZCBvY2NsdWRlU3BlY3VsYXIoKSB7XG4gICAgLy8gYXBwcm94aW1hdGVkIHNwZWN1bGFyIG9jY2x1c2lvbiBmcm9tIEFPXG4gICAgZmxvYXQgc3BlY1BvdyA9IGV4cDIoZEdsb3NzaW5lc3MgKiAxMS4wKTtcbiAgICAvLyBodHRwOi8vcmVzZWFyY2gudHJpLWFjZS5jb20vRGF0YS9jZWRlYzIwMTFfUmVhbHRpbWVQQlJfSW1wbGVtZW50YXRpb25fZS5wcHR4XG4gICAgZmxvYXQgc3BlY09jYyA9IHNhdHVyYXRlKHBvdyhkb3QoZE5vcm1hbFcsIGRWaWV3RGlyVykgKyBkQW8sIDAuMDEqc3BlY1BvdykgLSAxLjAgKyBkQW8pO1xuICAgIHNwZWNPY2MgPSBtaXgoMS4wLCBzcGVjT2NjLCBtYXRlcmlhbF9vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkpO1xuXG4gICAgZFNwZWN1bGFyTGlnaHQgKj0gc3BlY09jYztcbiAgICBkUmVmbGVjdGlvbiAqPSBzcGVjT2NjO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
