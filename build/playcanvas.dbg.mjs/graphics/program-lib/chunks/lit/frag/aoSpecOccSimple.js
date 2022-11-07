/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjU2ltcGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2FvU3BlY09jY1NpbXBsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHk7XG5cbnZvaWQgb2NjbHVkZVNwZWN1bGFyKCkge1xuICAgIGZsb2F0IHNwZWNPY2MgPSBtaXgoMS4wLCBkQW8sIG1hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eSk7XG4gICAgZFNwZWN1bGFyTGlnaHQgKj0gc3BlY09jYztcbiAgICBkUmVmbGVjdGlvbiAqPSBzcGVjT2NjO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FSQTs7OzsifQ==
