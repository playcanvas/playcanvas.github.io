import '../../../core/debug.js';
import { LAYERID_UI, LAYERID_DEPTH, ASPECT_AUTO } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { ShaderPass } from '../../../scene/shader-pass.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';

class CameraComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this.onPostprocessing = null;
		this.onPreRender = null;
		this.onPostRender = null;
		this._renderSceneDepthMap = 0;
		this._renderSceneColorMap = 0;
		this._sceneDepthMapRequested = false;
		this._sceneColorMapRequested = false;
		this._priority = 0;
		this._disablePostEffectsLayer = LAYERID_UI;
		this._camera = new Camera();
		this._camera.node = entity;
		this._postEffects = new PostEffectQueue(system.app, this);
	}
	setShaderPass(name) {
		const shaderPass = ShaderPass.get(this.system.app.graphicsDevice);
		const shaderPassInfo = name ? shaderPass.allocate(name, {
			isForward: true
		}) : null;
		this._camera.shaderPassInfo = shaderPassInfo;
		return shaderPassInfo.index;
	}
	getShaderPass() {
		var _this$_camera$shaderP;
		return (_this$_camera$shaderP = this._camera.shaderPassInfo) == null ? void 0 : _this$_camera$shaderP.name;
	}
	set aperture(value) {
		this._camera.aperture = value;
	}
	get aperture() {
		return this._camera.aperture;
	}
	set aspectRatio(value) {
		this._camera.aspectRatio = value;
	}
	get aspectRatio() {
		return this._camera.aspectRatio;
	}
	set aspectRatioMode(value) {
		this._camera.aspectRatioMode = value;
	}
	get aspectRatioMode() {
		return this._camera.aspectRatioMode;
	}
	set calculateProjection(value) {
		this._camera.calculateProjection = value;
	}
	get calculateProjection() {
		return this._camera.calculateProjection;
	}
	set calculateTransform(value) {
		this._camera.calculateTransform = value;
	}
	get calculateTransform() {
		return this._camera.calculateTransform;
	}
	get camera() {
		return this._camera;
	}
	set clearColor(value) {
		this._camera.clearColor = value;
	}
	get clearColor() {
		return this._camera.clearColor;
	}
	set clearColorBuffer(value) {
		this._camera.clearColorBuffer = value;
		this.dirtyLayerCompositionCameras();
	}
	get clearColorBuffer() {
		return this._camera.clearColorBuffer;
	}
	set clearDepthBuffer(value) {
		this._camera.clearDepthBuffer = value;
		this.dirtyLayerCompositionCameras();
	}
	get clearDepthBuffer() {
		return this._camera.clearDepthBuffer;
	}
	set clearStencilBuffer(value) {
		this._camera.clearStencilBuffer = value;
		this.dirtyLayerCompositionCameras();
	}
	get clearStencilBuffer() {
		return this._camera.clearStencilBuffer;
	}
	set cullFaces(value) {
		this._camera.cullFaces = value;
	}
	get cullFaces() {
		return this._camera.cullFaces;
	}
	set disablePostEffectsLayer(layer) {
		this._disablePostEffectsLayer = layer;
		this.dirtyLayerCompositionCameras();
	}
	get disablePostEffectsLayer() {
		return this._disablePostEffectsLayer;
	}
	set farClip(value) {
		this._camera.farClip = value;
	}
	get farClip() {
		return this._camera.farClip;
	}
	set flipFaces(value) {
		this._camera.flipFaces = value;
	}
	get flipFaces() {
		return this._camera.flipFaces;
	}
	set fov(value) {
		this._camera.fov = value;
	}
	get fov() {
		return this._camera.fov;
	}
	get frustum() {
		return this._camera.frustum;
	}
	set frustumCulling(value) {
		this._camera.frustumCulling = value;
	}
	get frustumCulling() {
		return this._camera.frustumCulling;
	}
	set horizontalFov(value) {
		this._camera.horizontalFov = value;
	}
	get horizontalFov() {
		return this._camera.horizontalFov;
	}
	set layers(newValue) {
		const layers = this._camera.layers;
		for (let i = 0; i < layers.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(layers[i]);
			if (!layer) continue;
			layer.removeCamera(this);
		}
		this._camera.layers = newValue;
		if (!this.enabled || !this.entity.enabled) return;
		for (let i = 0; i < newValue.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
			if (!layer) continue;
			layer.addCamera(this);
		}
	}
	get layers() {
		return this._camera.layers;
	}
	get layersSet() {
		return this._camera.layersSet;
	}
	set nearClip(value) {
		this._camera.nearClip = value;
	}
	get nearClip() {
		return this._camera.nearClip;
	}
	set orthoHeight(value) {
		this._camera.orthoHeight = value;
	}
	get orthoHeight() {
		return this._camera.orthoHeight;
	}
	get postEffects() {
		return this._postEffects;
	}
	get postEffectsEnabled() {
		return this._postEffects.enabled;
	}
	set priority(newValue) {
		this._priority = newValue;
		this.dirtyLayerCompositionCameras();
	}
	get priority() {
		return this._priority;
	}
	set projection(value) {
		this._camera.projection = value;
	}
	get projection() {
		return this._camera.projection;
	}
	get projectionMatrix() {
		return this._camera.projectionMatrix;
	}
	set rect(value) {
		this._camera.rect = value;
		this.fire('set:rect', this._camera.rect);
	}
	get rect() {
		return this._camera.rect;
	}
	set renderSceneColorMap(value) {
		if (value && !this._sceneColorMapRequested) {
			this.requestSceneColorMap(true);
			this._sceneColorMapRequested = true;
		} else if (this._sceneColorMapRequested) {
			this.requestSceneColorMap(false);
			this._sceneColorMapRequested = false;
		}
	}
	get renderSceneColorMap() {
		return this._renderSceneColorMap > 0;
	}
	set renderSceneDepthMap(value) {
		if (value && !this._sceneDepthMapRequested) {
			this.requestSceneDepthMap(true);
			this._sceneDepthMapRequested = true;
		} else if (this._sceneDepthMapRequested) {
			this.requestSceneDepthMap(false);
			this._sceneDepthMapRequested = false;
		}
	}
	get renderSceneDepthMap() {
		return this._renderSceneDepthMap > 0;
	}
	set renderTarget(value) {
		this._camera.renderTarget = value;
		this.dirtyLayerCompositionCameras();
	}
	get renderTarget() {
		return this._camera.renderTarget;
	}
	set scissorRect(value) {
		this._camera.scissorRect = value;
	}
	get scissorRect() {
		return this._camera.scissorRect;
	}
	set sensitivity(value) {
		this._camera.sensitivity = value;
	}
	get sensitivity() {
		return this._camera.sensitivity;
	}
	set shutter(value) {
		this._camera.shutter = value;
	}
	get shutter() {
		return this._camera.shutter;
	}
	get viewMatrix() {
		return this._camera.viewMatrix;
	}
	_enableDepthLayer(value) {
		const hasDepthLayer = this.layers.find(layerId => layerId === LAYERID_DEPTH);
		if (hasDepthLayer) {
			const depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
			if (value) {
				depthLayer == null ? void 0 : depthLayer.incrementCounter();
			} else {
				depthLayer == null ? void 0 : depthLayer.decrementCounter();
			}
		} else if (value) {
			return false;
		}
		return true;
	}
	requestSceneColorMap(enabled) {
		this._renderSceneColorMap += enabled ? 1 : -1;
		this._enableDepthLayer(enabled);
	}
	requestSceneDepthMap(enabled) {
		this._renderSceneDepthMap += enabled ? 1 : -1;
		this._enableDepthLayer(enabled);
	}
	dirtyLayerCompositionCameras() {
		const layerComp = this.system.app.scene.layers;
		layerComp._dirtyCameras = true;
	}
	screenToWorld(screenx, screeny, cameraz, worldCoord) {
		const device = this.system.app.graphicsDevice;
		const w = device.clientRect.width;
		const h = device.clientRect.height;
		return this._camera.screenToWorld(screenx, screeny, cameraz, w, h, worldCoord);
	}
	worldToScreen(worldCoord, screenCoord) {
		const device = this.system.app.graphicsDevice;
		const w = device.clientRect.width;
		const h = device.clientRect.height;
		return this._camera.worldToScreen(worldCoord, w, h, screenCoord);
	}
	onAppPrerender() {
		this._camera._viewMatDirty = true;
		this._camera._viewProjMatDirty = true;
	}
	addCameraToLayers() {
		const layers = this.layers;
		for (let i = 0; i < layers.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(layers[i]);
			if (layer) {
				layer.addCamera(this);
			}
		}
	}
	removeCameraFromLayers() {
		const layers = this.layers;
		for (let i = 0; i < layers.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(layers[i]);
			if (layer) {
				layer.removeCamera(this);
			}
		}
	}
	onLayersChanged(oldComp, newComp) {
		this.addCameraToLayers();
		oldComp.off('add', this.onLayerAdded, this);
		oldComp.off('remove', this.onLayerRemoved, this);
		newComp.on('add', this.onLayerAdded, this);
		newComp.on('remove', this.onLayerRemoved, this);
	}
	onLayerAdded(layer) {
		const index = this.layers.indexOf(layer.id);
		if (index < 0) return;
		layer.addCamera(this);
	}
	onLayerRemoved(layer) {
		const index = this.layers.indexOf(layer.id);
		if (index < 0) return;
		layer.removeCamera(this);
	}
	onEnable() {
		const system = this.system;
		const scene = system.app.scene;
		const layers = scene.layers;
		system.addCamera(this);
		scene.on('set:layers', this.onLayersChanged, this);
		if (layers) {
			layers.on('add', this.onLayerAdded, this);
			layers.on('remove', this.onLayerRemoved, this);
		}
		if (this.enabled && this.entity.enabled) {
			this.addCameraToLayers();
		}
		this.postEffects.enable();
	}
	onDisable() {
		const system = this.system;
		const scene = system.app.scene;
		const layers = scene.layers;
		this.postEffects.disable();
		this.removeCameraFromLayers();
		scene.off('set:layers', this.onLayersChanged, this);
		if (layers) {
			layers.off('add', this.onLayerAdded, this);
			layers.off('remove', this.onLayerRemoved, this);
		}
		system.removeCamera(this);
	}
	onRemove() {
		this.onDisable();
		this.off();
	}
	calculateAspectRatio(rt) {
		const device = this.system.app.graphicsDevice;
		const width = rt ? rt.width : device.width;
		const height = rt ? rt.height : device.height;
		return width * this.rect.z / (height * this.rect.w);
	}
	frameUpdate(rt) {
		if (this.aspectRatioMode === ASPECT_AUTO) {
			this.aspectRatio = this.calculateAspectRatio(rt);
		}
	}
	startXr(type, spaceType, options) {
		this.system.app.xr.start(this, type, spaceType, options);
	}
	endXr(callback) {
		if (!this._camera.xr) {
			if (callback) callback(new Error('Camera is not in XR'));
			return;
		}
		this._camera.xr.end(callback);
	}
	copy(source) {
		this.aperture = source.aperture;
		this.aspectRatio = source.aspectRatio;
		this.aspectRatioMode = source.aspectRatioMode;
		this.calculateProjection = source.calculateProjection;
		this.calculateTransform = source.calculateTransform;
		this.clearColor = source.clearColor;
		this.clearColorBuffer = source.clearColorBuffer;
		this.clearDepthBuffer = source.clearDepthBuffer;
		this.clearStencilBuffer = source.clearStencilBuffer;
		this.cullFaces = source.cullFaces;
		this.disablePostEffectsLayer = source.disablePostEffectsLayer;
		this.farClip = source.farClip;
		this.flipFaces = source.flipFaces;
		this.fov = source.fov;
		this.frustumCulling = source.frustumCulling;
		this.horizontalFov = source.horizontalFov;
		this.layers = source.layers;
		this.nearClip = source.nearClip;
		this.orthoHeight = source.orthoHeight;
		this.priority = source.priority;
		this.projection = source.projection;
		this.rect = source.rect;
		this.renderTarget = source.renderTarget;
		this.scissorRect = source.scissorRect;
		this.sensitivity = source.sensitivity;
		this.shutter = source.shutter;
	}
}

export { CameraComponent };
