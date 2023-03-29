/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjQ29uc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW9TcGVjT2NjQ29uc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgb2NjbHVkZVNwZWN1bGFyKCkge1xuICAgIC8vIGFwcHJveGltYXRlZCBzcGVjdWxhciBvY2NsdXNpb24gZnJvbSBBT1xuICAgIGZsb2F0IHNwZWNQb3cgPSBleHAyKGRHbG9zc2luZXNzICogMTEuMCk7XG4gICAgLy8gaHR0cDovL3Jlc2VhcmNoLnRyaS1hY2UuY29tL0RhdGEvY2VkZWMyMDExX1JlYWx0aW1lUEJSX0ltcGxlbWVudGF0aW9uX2UucHB0eFxuICAgIGZsb2F0IHNwZWNPY2MgPSBzYXR1cmF0ZShwb3coZG90KGROb3JtYWxXLCBkVmlld0RpclcpICsgZEFvLCAwLjAxKnNwZWNQb3cpIC0gMS4wICsgZEFvKTtcblxuICAgIGRTcGVjdWxhckxpZ2h0ICo9IHNwZWNPY2M7XG4gICAgZFJlZmxlY3Rpb24gKj0gc3BlY09jYztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVZBOzs7OyJ9
