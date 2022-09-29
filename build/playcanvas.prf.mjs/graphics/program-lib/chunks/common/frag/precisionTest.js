/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var precisionTestPS = `
void main(void) {
    gl_FragColor = vec4(2147483648.0);
}
`;

export { precisionTestPS as default };
