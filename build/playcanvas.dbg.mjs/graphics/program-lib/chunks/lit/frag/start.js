/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var startPS = `
void main(void) {
    dReflection = vec4(0);

    #ifdef LIT_CLEARCOAT
    ccSpecularLight = vec3(0);
    ccReflection = vec3(0);
    #endif
`;

export { startPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc3RhcnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZFJlZmxlY3Rpb24gPSB2ZWM0KDApO1xuXG4gICAgI2lmZGVmIExJVF9DTEVBUkNPQVRcbiAgICBjY1NwZWN1bGFyTGlnaHQgPSB2ZWMzKDApO1xuICAgIGNjUmVmbGVjdGlvbiA9IHZlYzMoMCk7XG4gICAgI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsY0FBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBUkE7Ozs7In0=
