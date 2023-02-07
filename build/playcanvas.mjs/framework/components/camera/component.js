import { LAYERID_UI, LAYERID_DEPTH, ASPECT_AUTO } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';
import '../../../core/tracing.js';

const properties = [{
	name: 'aspectRatio',
	readonly: false
}, {
	name: 'aspectRatioMode',
	readonly: false
}, {
	name: 'calculateProjection',
	readonly: false
}, {
	name: 'calculateTransform',
	readonly: false
}, {
	name: 'clearColor',
	readonly: false
}, {
	name: 'cullFaces',
	readonly: false
}, {
	name: 'farClip',
	readonly: false
}, {
	name: 'flipFaces',
	readonly: false
}, {
	name: 'fov',
	readonly: false
}, {
	name: 'frustumCulling',
	readonly: false
}, {
	name: 'horizontalFov',
	readonly: false
}, {
	name: 'nearClip',
	readonly: false
}, {
	name: 'orthoHeight',
	readonly: false
}, {
	name: 'projection',
	readonly: false
}, {
	name: 'scissorRect',
	readonly: false
}, {
	name: 'aperture',
	readonly: false
}, {
	name: 'shutter',
	readonly: false
}, {
	name: 'sensitivity',
	readonly: false
}];
class CameraComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this.onPostprocessing = null;
		this.onPreRender = null;
		this.onPostRender = null;
		this._renderSceneDepthMap = 0;
		this._renderSceneColorMap = 0;
		this._camera = new Camera();
		this._camera.node = entity;
		this._priority = 0;
		this._disablePostEffectsLayer = LAYERID_UI;
		this._postEffects = new PostEffectQueue(system.app, this);
		this._sceneDepthMapRequested = false;
		this._sceneColorMapRequested = false;
	}
	get camera() {
		return this._camera;
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
	set disablePostEffectsLayer(layer) {
		this._disablePostEffectsLayer = layer;
		this.dirtyLayerCompositionCameras();
	}
	get disablePostEffectsLayer() {
		return this._disablePostEffectsLayer;
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
	requestSceneDepthMap(enabled) {
		this._renderSceneDepthMap += enabled ? 1 : -1;
		this._enableDepthLayer(enabled);
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
	get frustum() {
		return this._camera.frustum;
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
	get postEffectsEnabled() {
		return this._postEffects.enabled;
	}
	get postEffects() {
		return this._postEffects;
	}
	set priority(newValue) {
		this._priority = newValue;
		this.dirtyLayerCompositionCameras();
	}
	get priority() {
		return this._priority;
	}
	get projectionMatrix() {
		return this._camera.projectionMatrix;
	}
	set aperture(newValue) {
		this._camera.aperture = newValue;
	}
	get aperture() {
		return this._camera.aperture;
	}
	set sensitivity(newValue) {
		this._camera.sensitivity = newValue;
	}
	get sensitivity() {
		return this._camera.sensitivity;
	}
	set shutter(newValue) {
		this._camera.shutter = newValue;
	}
	get shutter() {
		return this._camera.shutter;
	}
	set rect(value) {
		this._camera.rect = value;
		this.fire('set:rect', this._camera.rect);
	}
	get rect() {
		return this._camera.rect;
	}
	set renderTarget(value) {
		this._camera.renderTarget = value;
		this.dirtyLayerCompositionCameras();
	}
	get renderTarget() {
		return this._camera.renderTarget;
	}
	get viewMatrix() {
		return this._camera.viewMatrix;
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
		properties.forEach(property => {
			if (!property.readonly) {
				const name = property.name;
				this[name] = source[name];
			}
		});
		this.clearColorBuffer = source.clearColorBuffer;
		this.clearDepthBuffer = source.clearDepthBuffer;
		this.clearStencilBuffer = source.clearStencilBuffer;
		this.disablePostEffectsLayer = source.disablePostEffectsLayer;
		this.layers = source.layers;
		this.priority = source.priority;
		this.renderTarget = source.renderTarget;
		this.rect = source.rect;
		this.aperture = source.aperture;
		this.sensitivity = source.sensitivity;
		this.shutter = source.shutter;
	}
}
properties.forEach(function (property) {
	const name = property.name;
	const options = {};
	options.get = function () {
		return this._camera[name];
	};
	if (!property.readonly) {
		options.set = function (newValue) {
			this._camera[name] = newValue;
		};
	}
	Object.defineProperty(CameraComponent.prototype, name, options);
});

export { CameraComponent };
