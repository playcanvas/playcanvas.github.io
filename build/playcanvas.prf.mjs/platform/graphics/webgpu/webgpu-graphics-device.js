/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, CULLFACE_BACK } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuRenderState } from './webgpu-render-state.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
	constructor(canvas, options = {}) {
		super(canvas);
		this.frameBuffer = void 0;
		this.renderState = new WebgpuRenderState();
		this.renderPipeline = new WebgpuRenderPipeline(this);
		this.clearRenderer = new WebgpuClearRenderer();
		this.pipeline = void 0;
		this.bindGroupFormats = [];
		this.commandEncoder = void 0;
		this.deviceType = DEVICETYPE_WEBGPU;
		this.writeRed = true;
		this.writeGreen = true;
		this.writeBlue = true;
		this.writeAlpha = true;
		this.initDeviceCaps();
	}
	destroy() {
		super.destroy();
	}
	initDeviceCaps() {
		this.precision = 'highp';
		this.maxPrecision = 'highp';
		this.maxSamples = 4;
		this.maxTextures = 16;
		this.maxTextureSize = 4096;
		this.maxCubeMapSize = 4096;
		this.maxVolumeSize = 2048;
		this.maxPixelRatio = 1;
		this.supportsInstancing = true;
		this.supportsUniformBuffers = true;
		this.supportsBoneTextures = true;
		this.supportsMorphTargetTexturesCore = true;
		this.supportsAreaLights = true;
		this.supportsDepthShadow = true;
		this.extUintElement = true;
		this.extTextureFloat = true;
		this.textureFloatRenderable = true;
		this.extTextureHalfFloat = true;
		this.textureHalfFloatRenderable = true;
		this.textureHalfFloatUpdatable = true;
		this.boneLimit = 1024;
		this.supportsImageBitmap = true;
		this.extStandardDerivatives = true;
		this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
		this.supportsTextureFetch = true;
	}
	async initWebGpu(glslangUrl, twgslUrl) {
		if (!window.navigator.gpu) {
			throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
		}
		const loadScript = url => {
			return new Promise(function (resolve, reject) {
				const script = document.createElement('script');
				script.src = url;
				script.async = false;
				script.onload = function () {
					resolve(url);
				};
				script.onerror = function () {
					reject(new Error(`Failed to download script ${url}`));
				};
				document.body.appendChild(script);
			});
		};
		await loadScript(glslangUrl);
		await loadScript(twgslUrl);
		this.glslang = await glslang();
		const wasmPath = twgslUrl.replace('.js', '.wasm');
		this.twgsl = await twgsl(wasmPath);
		this.gpuAdapter = await window.navigator.gpu.requestAdapter();
		this.wgpu = await this.gpuAdapter.requestDevice();
		this.setResolution(window.innerWidth, window.innerHeight);
		this.gpuContext = this.canvas.getContext('webgpu');
		const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
		this.framebufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;
		this.canvasConfig = {
			device: this.wgpu,
			colorSpace: 'srgb',
			alphaMode: 'opaque',
			format: preferredCanvasFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
			viewFormats: []
		};
		this.gpuContext.configure(this.canvasConfig);
		this.createFramebuffer();
		this.postInit();
		return this;
	}
	createFramebuffer() {
		this.frameBuffer = new RenderTarget({
			name: 'WebgpuFramebuffer',
			graphicsDevice: this,
			depth: true,
			samples: 4
		});
	}
	createUniformBufferImpl(uniformBuffer) {
		return new WebgpuUniformBuffer(uniformBuffer);
	}
	createVertexBufferImpl(vertexBuffer, format) {
		return new WebgpuVertexBuffer(vertexBuffer, format);
	}
	createIndexBufferImpl(indexBuffer) {
		return new WebgpuIndexBuffer(indexBuffer);
	}
	createShaderImpl(shader) {
		return new WebgpuShader(shader);
	}
	createTextureImpl(texture) {
		return new WebgpuTexture(texture);
	}
	createRenderTargetImpl(renderTarget) {
		return new WebgpuRenderTarget(renderTarget);
	}
	createBindGroupFormatImpl(bindGroupFormat) {
		return new WebgpuBindGroupFormat(bindGroupFormat);
	}
	createBindGroupImpl(bindGroup) {
		return new WebgpuBindGroup();
	}
	setBindGroup(index, bindGroup) {
		if (this.passEncoder) {
			this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup);
			this.bindGroupFormats[index] = bindGroup.format.impl;
		}
	}
	submitVertexBuffer(vertexBuffer, slot) {
		const format = vertexBuffer.format;
		const elementCount = format.elements.length;
		const vbBuffer = vertexBuffer.impl.buffer;
		for (let i = 0; i < elementCount; i++) {
			const element = format.elements[i];
			this.passEncoder.setVertexBuffer(slot + i, vbBuffer, element.offset);
		}
		return elementCount;
	}
	draw(primitive, numInstances = 1, keepBuffers) {
		if (this.shader.ready) {
			const passEncoder = this.passEncoder;
			const vb0 = this.vertexBuffers[0];
			const vbSlot = this.submitVertexBuffer(vb0, 0);
			const vb1 = this.vertexBuffers[1];
			if (vb1) {
				this.submitVertexBuffer(vb1, vbSlot);
			}
			this.vertexBuffers.length = 0;
			const pipeline = this.renderPipeline.get(primitive, vb0.format, vb1 == null ? void 0 : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.renderState);
			if (this.pipeline !== pipeline) {
				this.pipeline = pipeline;
				passEncoder.setPipeline(pipeline);
			}
			const ib = this.indexBuffer;
			if (ib) {
				this.indexBuffer = null;
				passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
				passEncoder.drawIndexed(ib.numIndices, numInstances, 0, 0, 0);
			} else {
				passEncoder.draw(vb0.numVertices, numInstances, 0, 0);
			}
		}
	}
	setShader(shader) {
		this.shader = shader;
		this._shaderSwitchesPerFrame++;
		return true;
	}
	setBlending(blending) {
		this.renderState.setBlending(blending);
	}
	setBlendFunction(blendSrc, blendDst) {
		this.renderState.setBlendFunction(blendSrc, blendDst);
	}
	setBlendEquation(blendEquation) {
		this.renderState.setBlendEquation(blendEquation);
	}
	setDepthFunc(func) {}
	setDepthTest(depthTest) {}
	getDepthTest() {
		return true;
	}
	setCullMode(cullMode) {}
	getCullMode() {
		return CULLFACE_BACK;
	}
	setAlphaToCoverage(state) {}
	setColorWrite(writeRed, writeGreen, writeBlue, writeAlpha) {}
	setDepthWrite(writeDepth) {}
	getDepthWrite() {
		return true;
	}
	initializeContextCaches() {
		super.initializeContextCaches();
	}
	startPass(renderPass) {
		const rt = renderPass.renderTarget || this.frameBuffer;
		this.renderTarget = rt;
		const wrt = rt.impl;
		let outColorBuffer;
		if (rt === this.frameBuffer) {
			outColorBuffer = this.gpuContext.getCurrentTexture();
			wrt.colorFormat = outColorBuffer.format;
		}
		this.initRenderTarget(rt);
		if (outColorBuffer) {
			wrt.assignColorTexture(outColorBuffer);
		}
		wrt.setupForRenderPass(renderPass);
		this.commandEncoder = this.wgpu.createCommandEncoder();
		this.pipeline = null;
		this.passEncoder = this.commandEncoder.beginRenderPass(wrt.renderPassDescriptor);
		const {
			width,
			height
		} = rt;
		this.setViewport(0, 0, width, height);
		this.setScissor(0, 0, width, height);
		this.insideRenderPass = true;
	}
	endPass(renderPass) {
		this.passEncoder.end();
		this.passEncoder = null;
		this.wgpu.queue.submit([this.commandEncoder.finish()]);
		this.commandEncoder = null;
		this.bindGroupFormats.length = 0;
		this.insideRenderPass = false;
	}
	clear(options) {
		if (options.flags) {
			this.clearRenderer.clear(this, this.renderTarget, options);
		}
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	setDepthBias(on) {}
	setDepthBiasValues(constBias, slopeBias) {}
	setStencilTest(enable) {}
	setViewport(x, y, w, h) {
		if (this.passEncoder) {
			this.vx = x;
			this.vy = y;
			this.vw = w;
			this.vh = h;
			this.passEncoder.setViewport(x, this.renderTarget.height - y - h, w, h, 0, 1);
		}
	}
	setScissor(x, y, w, h) {
		if (this.passEncoder) {
			this.sx = x;
			this.sy = y;
			this.sw = w;
			this.sh = h;
			this.passEncoder.setScissorRect(x, this.renderTarget.height - y - h, w, h);
		}
	}
	copyRenderTarget(source, dest, color, depth) {
		var _this$commandEncoder;
		const copySize = {
			width: source ? source.width : dest.width,
			height: source ? source.height : dest.height,
			depthOrArrayLayers: 1
		};
		const commandEncoder = (_this$commandEncoder = this.commandEncoder) != null ? _this$commandEncoder : this.wgpu.createCommandEncoder();
		if (color) {
			const copySrc = {
				texture: source ? source.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
				mipLevel: 0
			};
			const copyDst = {
				texture: dest ? dest.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
				mipLevel: 0
			};
			commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
		}
		if (depth) {
			const sourceRT = source ? source : this.renderTarget;
			const copySrc = {
				texture: sourceRT.impl.depthTexture,
				mipLevel: 0
			};
			const copyDst = {
				texture: dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthTexture,
				mipLevel: 0
			};
			commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
		}
		if (!this.commandEncoder) {
			this.wgpu.queue.submit([commandEncoder.finish()]);
		}
		return true;
	}
}

export { WebgpuGraphicsDevice };
