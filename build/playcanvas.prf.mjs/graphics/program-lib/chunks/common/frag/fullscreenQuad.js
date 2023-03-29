/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fullscreenQuadPS = `
varying vec2 vUv0;

uniform sampler2D source;

void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;

export { fullscreenQuadPS as default };
