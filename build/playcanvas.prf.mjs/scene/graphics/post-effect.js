/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec4 } from '../../core/math/vec4.js';
import { drawQuadWithShader } from './quad-render-utils.js';

const _viewport = new Vec4();
class PostEffect {
	constructor(graphicsDevice) {
		this.device = graphicsDevice;
		this.needsDepthBuffer = false;
	}
	render(inputTarget, outputTarget, rect) {}
	drawQuad(target, shader, rect) {
		let viewport;
		if (rect) {
			const w = target ? target.width : this.device.width;
			const h = target ? target.height : this.device.height;
			viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
		}
		drawQuadWithShader(this.device, target, shader, viewport);
	}
}
PostEffect.quadVertexShader = `
				attribute vec2 aPosition;
				varying vec2 vUv0;
				void main(void)
				{
						gl_Position = vec4(aPosition, 0.0, 1.0);
						vUv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
				}
		`;

export { PostEffect };
