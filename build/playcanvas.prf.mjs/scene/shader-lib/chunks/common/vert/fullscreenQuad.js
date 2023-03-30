/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fullscreenQuadVS = `
attribute vec2 vertex_position;

varying vec2 vUv0;

void main(void)
{
		gl_Position = vec4(vertex_position, 0.5, 1.0);
		vUv0 = vertex_position.xy*0.5+0.5;
}
`;

export { fullscreenQuadVS as default };
