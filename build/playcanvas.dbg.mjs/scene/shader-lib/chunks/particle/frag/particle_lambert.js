/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_lambertPS = /* glsl */`
    vec3 negNormal = max(normal, vec3(0.0));
    vec3 posNormal = max(-normal, vec3(0.0));
`;

export { particle_lambertPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfbGFtYmVydC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVfbGFtYmVydC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHZlYzMgbmVnTm9ybWFsID0gbWF4KG5vcm1hbCwgdmVjMygwLjApKTtcbiAgICB2ZWMzIHBvc05vcm1hbCA9IG1heCgtbm9ybWFsLCB2ZWMzKDAuMCkpO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
