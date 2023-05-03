import '../../core/tracing.js';
import { FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { LAYERID_DEPTH, SHADER_DEPTH, LAYERID_WORLD } from '../constants.js';
import { Layer } from '../layer.js';

const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];
const _colorUniformNames = ['uSceneColorMap', 'texture_grabPass'];
class SceneGrab {
	constructor(device, scene) {
		this.scene = scene;
		this.device = device;
		this.layer = null;
		if (this.device.webgl2 || this.device.isWebGPU) {
			this.initMainPath();
		} else {
			this.initFallbackPath();
		}
	}
	static requiresRenderPass(device, camera) {
		if (device.webgl2 || device.isWebGPU) {
			return false;
		}
		return camera.renderSceneDepthMap;
	}
	setupUniform(device, depth, buffer) {
		const names = depth ? _depthUniformNames : _colorUniformNames;
		names.forEach(name => device.scope.resolve(name).setValue(buffer));
	}
	allocateTexture(device, source, name, format, isDepth, mipmaps) {
		return new Texture(device, {
			name,
			format,
			width: source ? source.colorBuffer.width : device.width,
			height: source ? source.colorBuffer.height : device.height,
			mipmaps,
			minFilter: isDepth ? FILTER_NEAREST : mipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_LINEAR,
			magFilter: isDepth ? FILTER_NEAREST : FILTER_LINEAR,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE
		});
	}
	getSourceColorFormat(texture) {
		var _texture$format;
		return (_texture$format = texture == null ? void 0 : texture.format) != null ? _texture$format : this.device.framebufferFormat;
	}
	shouldReallocate(targetRT, sourceTexture, testFormat) {
		if (testFormat) {
			const targetFormat = targetRT == null ? void 0 : targetRT.colorBuffer.format;
			const sourceFormat = this.getSourceColorFormat(sourceTexture);
			if (targetFormat !== sourceFormat) return true;
		}
		const width = (sourceTexture == null ? void 0 : sourceTexture.width) || this.device.width;
		const height = (sourceTexture == null ? void 0 : sourceTexture.height) || this.device.height;
		return !targetRT || width !== targetRT.width || height !== targetRT.height;
	}
	allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth, mipmaps, isDepthUniforms) {
		const names = isDepthUniforms ? _depthUniformNames : _colorUniformNames;
		const buffer = this.allocateTexture(device, sourceRenderTarget, names[0], format, isDepth, mipmaps);
		if (renderTarget) {
			renderTarget.destroyFrameBuffers();
			if (isDepth) {
				renderTarget._depthBuffer = buffer;
			} else {
				renderTarget._colorBuffer = buffer;
			}
		} else {
			renderTarget = new RenderTarget({
				name: 'renderTargetSceneGrab',
				colorBuffer: isDepth ? null : buffer,
				depthBuffer: isDepth ? buffer : null,
				depth: !isDepth,
				stencil: device.supportsStencil,
				autoResolve: false
			});
		}
		return renderTarget;
	}
	releaseRenderTarget(rt) {
		if (rt) {
			rt.destroyTextureBuffers();
			rt.destroy();
		}
	}
	initMainPath() {
		const device = this.device;
		const self = this;
		this.layer = new Layer({
			enabled: false,
			name: "Depth",
			id: LAYERID_DEPTH,
			onDisable: function () {
				self.releaseRenderTarget(this.depthRenderTarget);
				this.depthRenderTarget = null;
				self.releaseRenderTarget(this.colorRenderTarget);
				this.colorRenderTarget = null;
			},
			onPreRenderOpaque: function (cameraPass) {
				const camera = this.cameras[cameraPass];
				if (camera.renderSceneColorMap) {
					var _camera$renderTarget;
					if (self.shouldReallocate(this.colorRenderTarget, (_camera$renderTarget = camera.renderTarget) == null ? void 0 : _camera$renderTarget.colorBuffer, true)) {
						var _camera$renderTarget2;
						self.releaseRenderTarget(this.colorRenderTarget);
						const format = self.getSourceColorFormat((_camera$renderTarget2 = camera.renderTarget) == null ? void 0 : _camera$renderTarget2.colorBuffer);
						this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, format, false, true, false);
					}
					const colorBuffer = this.colorRenderTarget.colorBuffer;
					if (device.isWebGPU) {
						device.copyRenderTarget(camera.renderTarget, this.colorRenderTarget, true, false);
						device.mipmapRenderer.generate(this.colorRenderTarget.colorBuffer.impl);
					} else {
						device.copyRenderTarget(device.renderTarget, this.colorRenderTarget, true, false);
						device.activeTexture(device.maxCombinedTextures - 1);
						device.bindTexture(colorBuffer);
						device.gl.generateMipmap(colorBuffer.impl._glTarget);
					}
					self.setupUniform(device, false, colorBuffer);
				}
				if (camera.renderSceneDepthMap) {
					var _camera$renderTarget3;
					if (self.shouldReallocate(this.depthRenderTarget, (_camera$renderTarget3 = camera.renderTarget) == null ? void 0 : _camera$renderTarget3.depthBuffer)) {
						self.releaseRenderTarget(this.depthRenderTarget);
						this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_DEPTHSTENCIL, true, false, true);
					}
					device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
					self.setupUniform(device, true, this.depthRenderTarget.depthBuffer);
				}
			},
			onPostRenderOpaque: function (cameraPass) {}
		});
	}
	initFallbackPath() {
		const self = this;
		const device = this.device;
		const scene = this.scene;
		this.layer = new Layer({
			enabled: false,
			name: "Depth",
			id: LAYERID_DEPTH,
			shaderPass: SHADER_DEPTH,
			onEnable: function () {
				this.depthRenderTarget = new RenderTarget({
					name: 'depthRenderTarget-webgl1',
					depth: true,
					stencil: device.supportsStencil,
					autoResolve: false,
					graphicsDevice: device
				});
				this.renderTarget = this.depthRenderTarget;
			},
			onDisable: function () {
				this.depthRenderTarget.destroyTextureBuffers();
				this.renderTarget = null;
				self.releaseRenderTarget(this.colorRenderTarget);
				this.colorRenderTarget = null;
			},
			onPostCull: function (cameraPass) {
				const camera = this.cameras[cameraPass];
				if (camera.renderSceneDepthMap) {
					var _camera$renderTarget4;
					if (!this.depthRenderTarget.depthBuffer || self.shouldReallocate(this.depthRenderTarget, (_camera$renderTarget4 = camera.renderTarget) == null ? void 0 : _camera$renderTarget4.depthBuffer)) {
						this.depthRenderTarget.destroyTextureBuffers();
						this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_RGBA8, false, false, true);
					}
					const visibleObjects = this.instances.visibleOpaque[cameraPass];
					const visibleList = visibleObjects.list;
					const layerComposition = scene.layers;
					const subLayerEnabled = layerComposition.subLayerEnabled;
					const isTransparent = layerComposition.subLayerList;
					const rt = layerComposition.getLayerById(LAYERID_WORLD).renderTarget;
					let visibleLength = 0;
					const layers = layerComposition.layerList;
					for (let i = 0; i < layers.length; i++) {
						const layer = layers[i];
						if (layer === this) break;
						if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;
						const layerCamId = layer.cameras.indexOf(camera);
						if (layerCamId < 0) continue;
						const transparent = isTransparent[i];
						let layerVisibleList = transparent ? layer.instances.visibleTransparent[layerCamId] : layer.instances.visibleOpaque[layerCamId];
						const layerVisibleListLength = layerVisibleList.length;
						layerVisibleList = layerVisibleList.list;
						for (let j = 0; j < layerVisibleListLength; j++) {
							const drawCall = layerVisibleList[j];
							if (drawCall.material && drawCall.material.depthWrite && !drawCall._noDepthDrawGl1) {
								visibleList[visibleLength] = drawCall;
								visibleLength++;
							}
						}
					}
					visibleObjects.length = visibleLength;
				}
			},
			onPreRenderOpaque: function (cameraPass) {
				const camera = this.cameras[cameraPass];
				if (camera.renderSceneColorMap) {
					var _camera$renderTarget5;
					if (self.shouldReallocate(this.colorRenderTarget, (_camera$renderTarget5 = camera.renderTarget) == null ? void 0 : _camera$renderTarget5.colorBuffer)) {
						var _camera$renderTarget6;
						self.releaseRenderTarget(this.colorRenderTarget);
						const format = self.getSourceColorFormat((_camera$renderTarget6 = camera.renderTarget) == null ? void 0 : _camera$renderTarget6.colorBuffer);
						this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, format, false, false, false);
					}
					const colorBuffer = this.colorRenderTarget._colorBuffer;
					if (!colorBuffer.impl._glTexture) {
						colorBuffer.impl.initialize(device, colorBuffer);
					}
					device.bindTexture(colorBuffer);
					const gl = device.gl;
					gl.copyTexImage2D(gl.TEXTURE_2D, 0, colorBuffer.impl._glFormat, 0, 0, colorBuffer.width, colorBuffer.height, 0);
					colorBuffer._needsUpload = false;
					colorBuffer._needsMipmapsUpload = false;
					self.setupUniform(device, false, colorBuffer);
				}
				if (camera.renderSceneDepthMap) {
					self.setupUniform(device, true, this.depthRenderTarget.colorBuffer);
				}
			},
			onDrawCall: function () {
				device.setBlendState(BlendState.DEFAULT);
			},
			onPostRenderOpaque: function (cameraPass) {
				const camera = this.cameras[cameraPass];
				if (camera.renderSceneDepthMap) {
					const visibleObjects = this.instances.visibleOpaque[cameraPass];
					visibleObjects.length = 0;
				}
			}
		});
	}
	patch(layer) {
		layer.onEnable = this.layer.onEnable;
		layer.onDisable = this.layer.onDisable;
		layer.onPreRenderOpaque = this.layer.onPreRenderOpaque;
		layer.onPostRenderOpaque = this.layer.onPostRenderOpaque;
		layer.shaderPass = this.layer.shaderPass;
		layer.onPostCull = this.layer.onPostCull;
		layer.onDrawCall = this.layer.onDrawCall;
	}
}

export { SceneGrab };
