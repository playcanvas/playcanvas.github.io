/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflDirPS = /* glsl */`
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
    dReflDirW = normalize(-reflect(viewDir, worldNormal));
}
`;

export { reflDirPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbERpci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxEaXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgZ2V0UmVmbERpcih2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIsIGZsb2F0IGdsb3NzLCBtYXQzIHRibikge1xuICAgIGRSZWZsRGlyVyA9IG5vcm1hbGl6ZSgtcmVmbGVjdCh2aWV3RGlyLCB3b3JsZE5vcm1hbCkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
