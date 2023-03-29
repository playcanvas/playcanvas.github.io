/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightDiffuseLambertPS = /* glsl */`
float getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
    return max(dot(worldNormal, -lightDirNorm), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHREaWZmdXNlTGFtYmVydC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2xpZ2h0RGlmZnVzZUxhbWJlcnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldExpZ2h0RGlmZnVzZSh2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIsIHZlYzMgbGlnaHREaXIsIHZlYzMgbGlnaHREaXJOb3JtKSB7XG4gICAgcmV0dXJuIG1heChkb3Qod29ybGROb3JtYWwsIC1saWdodERpck5vcm0pLCAwLjApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDRCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
