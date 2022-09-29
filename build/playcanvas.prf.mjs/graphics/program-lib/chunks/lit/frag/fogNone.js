/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fogNonePS = `
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    return color;
}
`;

export { fogNonePS as default };
