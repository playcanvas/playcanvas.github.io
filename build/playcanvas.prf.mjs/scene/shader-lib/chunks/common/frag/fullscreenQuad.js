/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fullscreenQuadPS = `
varying vec2 vUv0;

uniform sampler2D source;

void main(void) {
		gl_FragColor = texture2D(source, vUv0);
}
`;

export { fullscreenQuadPS as default };
