/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var precisionTestPS = `
void main(void) {
    gl_FragColor = vec4(2147483648.0);
}
`;

export { precisionTestPS as default };
