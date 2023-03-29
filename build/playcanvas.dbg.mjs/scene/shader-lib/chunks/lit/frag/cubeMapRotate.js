/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapRotatePS = /* glsl */`
#ifdef CUBEMAP_ROTATION
uniform mat3 cubeMapRotationMatrix;
#endif

vec3 cubeMapRotate(vec3 refDir) {
#ifdef CUBEMAP_ROTATION
    return refDir * cubeMapRotationMatrix;
#else
    return refDir;
#endif
}
`;

export { cubeMapRotatePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3ViZU1hcFJvdGF0ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2N1YmVNYXBSb3RhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBDVUJFTUFQX1JPVEFUSU9OXG51bmlmb3JtIG1hdDMgY3ViZU1hcFJvdGF0aW9uTWF0cml4O1xuI2VuZGlmXG5cbnZlYzMgY3ViZU1hcFJvdGF0ZSh2ZWMzIHJlZkRpcikge1xuI2lmZGVmIENVQkVNQVBfUk9UQVRJT05cbiAgICByZXR1cm4gcmVmRGlyICogY3ViZU1hcFJvdGF0aW9uTWF0cml4O1xuI2Vsc2VcbiAgICByZXR1cm4gcmVmRGlyO1xuI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsc0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
