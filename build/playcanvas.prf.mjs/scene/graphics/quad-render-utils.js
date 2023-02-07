/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { Vec4 } from '../../core/math/vec4.js';
import { CULLFACE_NONE, DEVICETYPE_WEBGPU } from '../../platform/graphics/constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { QuadRender } from './quad-render.js';

const _tempRect = new Vec4();
function drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend = false) {
	const oldDepthTest = device.getDepthTest();
	const oldDepthWrite = device.getDepthWrite();
	const oldCullMode = device.getCullMode();
	const oldWR = device.writeRed;
	const oldWG = device.writeGreen;
	const oldWB = device.writeBlue;
	const oldWA = device.writeAlpha;
	device.setDepthTest(false);
	device.setDepthWrite(false);
	device.setCullMode(CULLFACE_NONE);
	device.setColorWrite(true, true, true, true);
	if (!useBlend) device.setBlending(false);
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
	if (device.deviceType === DEVICETYPE_WEBGPU) {
		renderPass.depthStencilOps.clearDepth = true;
	}
	renderPass.render();
	quad.destroy();
	device.setDepthTest(oldDepthTest);
	device.setDepthWrite(oldDepthWrite);
	device.setCullMode(oldCullMode);
	device.setColorWrite(oldWR, oldWG, oldWB, oldWA);
}
function drawTexture(device, texture, target, shader, rect, scissorRect, useBlend = false) {
	shader = shader || device.getCopyShader();
	device.constantTexSource.setValue(texture);
	drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend);
}

export { drawQuadWithShader, drawTexture };
