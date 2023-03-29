/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var dilatePS = `

varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

void main(void) {
		vec4 c = texture2D(source, vUv0);
		c = c.a>0.0? c : texture2D(source, vUv0 - pixelOffset);
		c = c.a>0.0? c : texture2D(source, vUv0 + vec2(0, -pixelOffset.y));
		c = c.a>0.0? c : texture2D(source, vUv0 + vec2(pixelOffset.x, -pixelOffset.y));
		c = c.a>0.0? c : texture2D(source, vUv0 + vec2(-pixelOffset.x, 0));
		c = c.a>0.0? c : texture2D(source, vUv0 + vec2(pixelOffset.x, 0));
		c = c.a>0.0? c : texture2D(source, vUv0 + vec2(-pixelOffset.x, pixelOffset.y));
		c = c.a>0.0? c : texture2D(source, vUv0 + vec2(0, pixelOffset.y));
		c = c.a>0.0? c : texture2D(source, vUv0 + pixelOffset);
		gl_FragColor = c;
}
`;

export { dilatePS as default };
