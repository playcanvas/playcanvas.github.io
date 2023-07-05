import '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { QuadRender } from './quad-render.js';

const _tempRect = new Vec4();
function drawQuadWithShader(device, target, shader, rect, scissorRect) {
	device.setCullMode(CULLFACE_NONE);
	device.setDepthState(DepthState.NODEPTH);
	device.setStencilState(null, null);
	const quad = new QuadRender(shader);
	if (!rect) {
		rect = _tempRect;
		rect.x = 0;
		rect.y = 0;
		rect.z = target ? target.width : device.width;
		rect.w = target ? target.height : device.height;
	}
	const renderPass = new RenderPass(device, () => {
		quad.render(rect, scissorRect);
	});
	renderPass.init(target);
	renderPass.colorOps.clear = false;
	renderPass.depthStencilOps.clearDepth = false;
	if (device.isWebGPU && target === null) {
		var _target$samples;
		const samples = (_target$samples = target == null ? void 0 : target.samples) != null ? _target$samples : device.samples;
		if (samples > 1) renderPass.colorOps.store = true;
	}
	renderPass.render();
	quad.destroy();
}
function drawTexture(device, texture, target, shader, rect, scissorRect) {
	shader = shader || device.getCopyShader();
	device.constantTexSource.setValue(texture);
	drawQuadWithShader(device, target, shader, rect, scissorRect);
}

export { drawQuadWithShader, drawTexture };
