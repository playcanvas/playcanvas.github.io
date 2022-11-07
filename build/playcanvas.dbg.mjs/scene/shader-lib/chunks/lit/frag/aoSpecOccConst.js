/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstPS = `
void occludeSpecular() {
    // approximated specular occlusion from AO
    float specPow = exp2(dGlossiness * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(dNormalW, dViewDirW) + dAo, 0.01*specPow) - 1.0 + dAo);

    dSpecularLight *= specOcc;
    dReflection *= specOcc;
}
`;

export { aoSpecOccConstPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjQ29uc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9hb1NwZWNPY2NDb25zdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBvY2NsdWRlU3BlY3VsYXIoKSB7XG4gICAgLy8gYXBwcm94aW1hdGVkIHNwZWN1bGFyIG9jY2x1c2lvbiBmcm9tIEFPXG4gICAgZmxvYXQgc3BlY1BvdyA9IGV4cDIoZEdsb3NzaW5lc3MgKiAxMS4wKTtcbiAgICAvLyBodHRwOi8vcmVzZWFyY2gudHJpLWFjZS5jb20vRGF0YS9jZWRlYzIwMTFfUmVhbHRpbWVQQlJfSW1wbGVtZW50YXRpb25fZS5wcHR4XG4gICAgZmxvYXQgc3BlY09jYyA9IHNhdHVyYXRlKHBvdyhkb3QoZE5vcm1hbFcsIGRWaWV3RGlyVykgKyBkQW8sIDAuMDEqc3BlY1BvdykgLSAxLjAgKyBkQW8pO1xuXG4gICAgZFNwZWN1bGFyTGlnaHQgKj0gc3BlY09jYztcbiAgICBkUmVmbGVjdGlvbiAqPSBzcGVjT2NjO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
