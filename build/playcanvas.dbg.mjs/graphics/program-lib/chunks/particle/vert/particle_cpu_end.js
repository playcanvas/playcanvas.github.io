/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_cpu_endVS = `
    localPos *= particle_vertexData2.y * emitterScale;
    localPos += particlePos;

    gl_Position = matrix_viewProjection * vec4(localPos, 1.0);
`;

export { particle_cpu_endVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfY3B1X2VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlX2NwdV9lbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBsb2NhbFBvcyAqPSBwYXJ0aWNsZV92ZXJ0ZXhEYXRhMi55ICogZW1pdHRlclNjYWxlO1xuICAgIGxvY2FsUG9zICs9IHBhcnRpY2xlUG9zO1xuXG4gICAgZ2xfUG9zaXRpb24gPSBtYXRyaXhfdmlld1Byb2plY3Rpb24gKiB2ZWM0KGxvY2FsUG9zLCAxLjApO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FMQTs7OzsifQ==
