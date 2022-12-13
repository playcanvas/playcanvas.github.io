/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fogNonePS = `
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    return color;
}
`;

export { fogNonePS as default };
