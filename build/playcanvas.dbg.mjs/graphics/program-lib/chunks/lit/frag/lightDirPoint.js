/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightDirPointPS = `
void getLightDirPoint(vec3 lightPosW) {
    dLightDirW = vPositionW - lightPosW;
    dLightDirNormW = normalize(dLightDirW);
    dLightPosW = lightPosW;
}
`;

export { lightDirPointPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHREaXJQb2ludC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9saWdodERpclBvaW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52b2lkIGdldExpZ2h0RGlyUG9pbnQodmVjMyBsaWdodFBvc1cpIHtcbiAgICBkTGlnaHREaXJXID0gdlBvc2l0aW9uVyAtIGxpZ2h0UG9zVztcbiAgICBkTGlnaHREaXJOb3JtVyA9IG5vcm1hbGl6ZShkTGlnaHREaXJXKTtcbiAgICBkTGlnaHRQb3NXID0gbGlnaHRQb3NXO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQU5BOzs7OyJ9
