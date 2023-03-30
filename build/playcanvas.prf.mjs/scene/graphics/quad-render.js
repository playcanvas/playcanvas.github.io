/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { BINDGROUP_MESH, PRIMITIVE_TRISTRIP } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { processShader } from '../shader-lib/utils.js';

const _quadPrimitive = {
	type: PRIMITIVE_TRISTRIP,
	base: 0,
	count: 4,
	indexed: false
};
const _tempViewport = new Vec4();
const _tempScissor = new Vec4();
class QuadRender {
	constructor(shader) {
		this.uniformBuffer = void 0;
		this.bindGroup = void 0;
		const device = shader.device;
		this.shader = shader;
		if (device.supportsUniformBuffers) {
			const processingOptions = new ShaderProcessorOptions();
			this.shader = processShader(shader, processingOptions);
			const ubFormat = this.shader.meshUniformBufferFormat;
			if (ubFormat) {
				this.uniformBuffer = new UniformBuffer(device, ubFormat);
			}
			const bindGroupFormat = this.shader.meshBindGroupFormat;
			this.bindGroup = new BindGroup(device, bindGroupFormat, this.uniformBuffer);
		}
	}
	destroy() {
		var _this$uniformBuffer, _this$bindGroup;
		(_this$uniformBuffer = this.uniformBuffer) == null ? void 0 : _this$uniformBuffer.destroy();
		this.uniformBuffer = null;
		(_this$bindGroup = this.bindGroup) == null ? void 0 : _this$bindGroup.destroy();
		this.bindGroup = null;
	}
	render(viewport, scissor) {
		const device = this.shader.device;
		if (viewport) {
			var _scissor;
			_tempViewport.set(device.vx, device.vy, device.vw, device.vh);
			_tempScissor.set(device.sx, device.sy, device.sw, device.sh);
			scissor = (_scissor = scissor) != null ? _scissor : viewport;
			device.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
			device.setScissor(scissor.x, scissor.y, scissor.z, scissor.w);
		}
		device.setVertexBuffer(device.quadVertexBuffer, 0);
		const shader = this.shader;
		device.setShader(shader);
		if (device.supportsUniformBuffers) {
			const bindGroup = this.bindGroup;
			if (bindGroup.defaultUniformBuffer) {
				bindGroup.defaultUniformBuffer.update();
			}
			bindGroup.update();
			device.setBindGroup(BINDGROUP_MESH, bindGroup);
		}
		device.draw(_quadPrimitive);
		if (viewport) {
			device.setViewport(_tempViewport.x, _tempViewport.y, _tempViewport.z, _tempViewport.w);
			device.setScissor(_tempScissor.x, _tempScissor.y, _tempScissor.z, _tempScissor.w);
		}
	}
}

export { QuadRender };
