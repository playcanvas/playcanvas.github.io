/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleOutputFloatPS = `
void writeOutput() {
    if (gl_FragCoord.y<1.0) {
        gl_FragColor = vec4(outPos, (outAngle + 1000.0) * visMode);
    } else {
        gl_FragColor = vec4(outVel, outLife);
    }
}
`;

export { particleOutputFloatPS as default };
