/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2FvU3BlY09jYy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHk7XG5cbnZvaWQgb2NjbHVkZVNwZWN1bGFyKCkge1xuICAgIC8vIGFwcHJveGltYXRlZCBzcGVjdWxhciBvY2NsdXNpb24gZnJvbSBBT1xuICAgIGZsb2F0IHNwZWNQb3cgPSBleHAyKGRHbG9zc2luZXNzICogMTEuMCk7XG4gICAgLy8gaHR0cDovL3Jlc2VhcmNoLnRyaS1hY2UuY29tL0RhdGEvY2VkZWMyMDExX1JlYWx0aW1lUEJSX0ltcGxlbWVudGF0aW9uX2UucHB0eFxuICAgIGZsb2F0IHNwZWNPY2MgPSBzYXR1cmF0ZShwb3coZG90KGROb3JtYWxXLCBkVmlld0RpclcpICsgZEFvLCAwLjAxKnNwZWNQb3cpIC0gMS4wICsgZEFvKTtcbiAgICBzcGVjT2NjID0gbWl4KDEuMCwgc3BlY09jYywgbWF0ZXJpYWxfb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5KTtcblxuICAgIGRTcGVjdWxhckxpZ2h0ICo9IHNwZWNPY2M7XG4gICAgZFJlZmxlY3Rpb24gKj0gc3BlY09jYztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQWJBOzs7OyJ9
