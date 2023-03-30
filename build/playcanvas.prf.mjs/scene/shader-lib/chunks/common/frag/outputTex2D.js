/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var outputTex2DPS = `
varying vec2 vUv0;

uniform sampler2D source;

void main(void) {
		gl_FragColor = texture2D(source, vUv0);
}
`;

export { outputTex2DPS as default };
