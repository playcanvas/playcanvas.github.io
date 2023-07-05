import '../../core/debug.js';
import '../../core/tracing.js';
import { EventHandler } from '../../core/event-handler.js';
import { set } from '../../core/set-utils.js';
import { sortPriority } from '../../core/sort.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, COMPUPDATED_LIGHTS, COMPUPDATED_CAMERAS, COMPUPDATED_INSTANCES, LAYERID_DEPTH, COMPUPDATED_BLEND } from '../constants.js';
import { RenderAction } from './render-action.js';
import { WorldClusters } from '../lighting/world-clusters.js';
import { LightCompositionData } from './light-composition-data.js';

const tempSet = new Set();
const tempClusterArray = [];
class LayerComposition extends EventHandler {
	constructor(name = 'Untitled') {
		super();
		this.name = name;
		this.layerList = [];
		this.subLayerList = [];
		this.subLayerEnabled = [];
		this._opaqueOrder = {};
		this._transparentOrder = {};
		this._dirty = false;
		this._dirtyBlend = false;
		this._dirtyLights = false;
		this._dirtyCameras = false;
		this._meshInstances = [];
		this._meshInstancesSet = new Set();
		this._lights = [];
		this._lightsMap = new Map();
		this._lightCompositionData = [];
		this._splitLights = [[], [], []];
		this.cameras = [];
		this._renderActions = [];
		this._worldClusters = [];
		this._emptyWorldClusters = null;
	}
	destroy() {
		if (this._emptyWorldClusters) {
			this._emptyWorldClusters.destroy();
			this._emptyWorldClusters = null;
		}
		this._worldClusters.forEach(cluster => {
			cluster.destroy();
		});
		this._worldClusters = null;
		this._renderActions.forEach(ra => ra.destroy());
		this._renderActions = null;
	}
	getEmptyWorldClusters(device) {
		if (!this._emptyWorldClusters) {
			this._emptyWorldClusters = new WorldClusters(device);
			this._emptyWorldClusters.name = 'ClusterEmpty';
			this._emptyWorldClusters.update([], false, null);
		}
		return this._emptyWorldClusters;
	}
	_splitLightsArray(target) {
		const lights = target._lights;
		target._splitLights[LIGHTTYPE_DIRECTIONAL].length = 0;
		target._splitLights[LIGHTTYPE_OMNI].length = 0;
		target._splitLights[LIGHTTYPE_SPOT].length = 0;
		for (let i = 0; i < lights.length; i++) {
			const light = lights[i];
			if (light.enabled) {
				target._splitLights[light._type].push(light);
			}
		}
	}
	_update(device, clusteredLightingEnabled = false) {
		const len = this.layerList.length;
		let result = 0;
		if (!this._dirty || !this._dirtyLights || !this._dirtyCameras) {
			for (let i = 0; i < len; i++) {
				const layer = this.layerList[i];
				if (layer._dirty) {
					this._dirty = true;
				}
				if (layer._dirtyLights) {
					this._dirtyLights = true;
				}
				if (layer._dirtyCameras) {
					this._dirtyCameras = true;
				}
			}
		}
		function addUniqueMeshInstance(destArray, destSet, srcArray) {
			let dirtyBlend = false;
			const srcLen = srcArray.length;
			for (let s = 0; s < srcLen; s++) {
				const meshInst = srcArray[s];
				if (!destSet.has(meshInst)) {
					destSet.add(meshInst);
					destArray.push(meshInst);
					const material = meshInst.material;
					if (material && material._dirtyBlend) {
						dirtyBlend = true;
						material._dirtyBlend = false;
					}
				}
			}
			return dirtyBlend;
		}
		if (this._dirty) {
			result |= COMPUPDATED_INSTANCES;
			this._meshInstances.length = 0;
			this._meshInstancesSet.clear();
			for (let i = 0; i < len; i++) {
				const layer = this.layerList[i];
				if (!layer.passThrough) {
					this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.opaqueMeshInstances) || this._dirtyBlend;
					this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.transparentMeshInstances) || this._dirtyBlend;
				}
				layer._dirty = false;
			}
			this._dirty = false;
		}
		function moveByBlendType(dest, src, moveTransparent) {
			for (let s = 0; s < src.length;) {
				var _src$s$material;
				if (((_src$s$material = src[s].material) == null ? void 0 : _src$s$material.transparent) === moveTransparent) {
					dest.push(src[s]);
					src[s] = src[src.length - 1];
					src.length--;
				} else {
					s++;
				}
			}
		}
		if (this._dirtyBlend) {
			result |= COMPUPDATED_BLEND;
			for (let i = 0; i < len; i++) {
				const layer = this.layerList[i];
				if (!layer.passThrough) {
					moveByBlendType(layer.opaqueMeshInstances, layer.transparentMeshInstances, false);
					moveByBlendType(layer.transparentMeshInstances, layer.opaqueMeshInstances, true);
				}
			}
			this._dirtyBlend = false;
		}
		if (this._dirtyLights) {
			result |= COMPUPDATED_LIGHTS;
			this._dirtyLights = false;
			this.updateLights();
		}
		if (result) {
			this.updateShadowCasters();
		}
		if (this._dirtyCameras || result & COMPUPDATED_LIGHTS) {
			this._dirtyCameras = false;
			result |= COMPUPDATED_CAMERAS;
			this.cameras.length = 0;
			for (let i = 0; i < len; i++) {
				const layer = this.layerList[i];
				layer._dirtyCameras = false;
				for (let j = 0; j < layer.cameras.length; j++) {
					const camera = layer.cameras[j];
					const index = this.cameras.indexOf(camera);
					if (index < 0) {
						this.cameras.push(camera);
					}
				}
			}
			if (this.cameras.length > 1) {
				sortPriority(this.cameras);
			}
			const cameraLayers = [];
			let renderActionCount = 0;
			for (let i = 0; i < this.cameras.length; i++) {
				const camera = this.cameras[i];
				cameraLayers.length = 0;
				let cameraFirstRenderAction = true;
				const cameraFirstRenderActionIndex = renderActionCount;
				let lastRenderAction = null;
				let postProcessMarked = false;
				for (let j = 0; j < len; j++) {
					const layer = this.layerList[j];
					const isLayerEnabled = this.subLayerEnabled[j];
					if (layer && isLayerEnabled) {
						if (layer.cameras.length > 0) {
							if (camera.layers.indexOf(layer.id) >= 0) {
								cameraLayers.push(layer);
								if (!postProcessMarked && layer.id === camera.disablePostEffectsLayer) {
									postProcessMarked = true;
									if (lastRenderAction) {
										lastRenderAction.triggerPostprocess = true;
									}
								}
								const cameraIndex = layer.cameras.indexOf(camera);
								if (cameraIndex >= 0) {
									lastRenderAction = this.addRenderAction(this._renderActions, renderActionCount, layer, j, cameraIndex, cameraFirstRenderAction, postProcessMarked);
									renderActionCount++;
									cameraFirstRenderAction = false;
								}
							}
						}
					}
				}
				if (cameraFirstRenderActionIndex < renderActionCount) {
					this._renderActions[cameraFirstRenderActionIndex].collectDirectionalLights(cameraLayers, this._splitLights[LIGHTTYPE_DIRECTIONAL], this._lights);
					lastRenderAction.lastCameraUse = true;
				}
				if (!postProcessMarked && lastRenderAction) {
					lastRenderAction.triggerPostprocess = true;
				}
				if (camera.renderTarget && camera.postEffectsEnabled) {
					this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera);
				}
			}
			for (let i = renderActionCount; i < this._renderActions.length; i++) {
				this._renderActions[i].destroy();
			}
			this._renderActions.length = renderActionCount;
		}
		if (result & (COMPUPDATED_CAMERAS | COMPUPDATED_LIGHTS | COMPUPDATED_INSTANCES)) {
			if (clusteredLightingEnabled) {
				this.allocateLightClusters(device);
			}
		}
		if (result & (COMPUPDATED_LIGHTS | COMPUPDATED_LIGHTS)) {
			this._logRenderActions();
		}
		return result;
	}
	updateShadowCasters() {
		const lightCount = this._lights.length;
		for (let i = 0; i < lightCount; i++) {
			this._lightCompositionData[i].clearShadowCasters();
		}
		const len = this.layerList.length;
		for (let i = 0; i < len; i++) {
			const layer = this.layerList[i];
			if (!tempSet.has(layer)) {
				tempSet.add(layer);
				const lights = layer._lights;
				for (let j = 0; j < lights.length; j++) {
					if (lights[j].castShadows) {
						const lightIndex = this._lightsMap.get(lights[j]);
						const lightCompData = this._lightCompositionData[lightIndex];
						lightCompData.addShadowCasters(layer.shadowCasters);
					}
				}
			}
		}
		tempSet.clear();
	}
	updateLights() {
		this._lights.length = 0;
		this._lightsMap.clear();
		const count = this.layerList.length;
		for (let i = 0; i < count; i++) {
			const layer = this.layerList[i];
			if (!tempSet.has(layer)) {
				tempSet.add(layer);
				const lights = layer._lights;
				for (let j = 0; j < lights.length; j++) {
					const light = lights[j];
					let lightIndex = this._lightsMap.get(light);
					if (lightIndex === undefined) {
						lightIndex = this._lights.length;
						this._lightsMap.set(light, lightIndex);
						this._lights.push(light);
						let lightCompData = this._lightCompositionData[lightIndex];
						if (!lightCompData) {
							lightCompData = new LightCompositionData();
							this._lightCompositionData[lightIndex] = lightCompData;
						}
					}
				}
			}
			this._splitLightsArray(layer);
			layer._dirtyLights = false;
		}
		tempSet.clear();
		this._splitLightsArray(this);
		const lightCount = this._lights.length;
		this._lightCompositionData.length = lightCount;
	}
	findCompatibleCluster(layer, renderActionCount, emptyWorldClusters) {
		for (let i = 0; i < renderActionCount; i++) {
			const ra = this._renderActions[i];
			const raLayer = this.layerList[ra.layerIndex];
			if (ra.lightClusters !== emptyWorldClusters) {
				if (layer === raLayer) {
					return ra.lightClusters;
				}
				if (ra.lightClusters) {
					if (set.equals(layer._clusteredLightsSet, raLayer._clusteredLightsSet)) {
						return ra.lightClusters;
					}
				}
			}
		}
		return null;
	}
	allocateLightClusters(device) {
		tempClusterArray.push(...this._worldClusters);
		const emptyWorldClusters = this.getEmptyWorldClusters(device);
		this._worldClusters.length = 0;
		const count = this._renderActions.length;
		for (let i = 0; i < count; i++) {
			const ra = this._renderActions[i];
			const layer = this.layerList[ra.layerIndex];
			ra.lightClusters = null;
			if (layer.hasClusteredLights) {
				const transparent = this.subLayerList[ra.layerIndex];
				const meshInstances = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;
				if (meshInstances.length) {
					let clusters = this.findCompatibleCluster(layer, i, emptyWorldClusters);
					if (!clusters) {
						if (tempClusterArray.length) {
							clusters = tempClusterArray.pop();
						}
						if (!clusters) {
							clusters = new WorldClusters(device);
						}
						clusters.name = 'Cluster-' + this._worldClusters.length;
						this._worldClusters.push(clusters);
					}
					ra.lightClusters = clusters;
				}
			}
			if (!ra.lightClusters) {
				ra.lightClusters = emptyWorldClusters;
			}
		}
		tempClusterArray.forEach(item => {
			item.destroy();
		});
		tempClusterArray.length = 0;
	}
	addRenderAction(renderActions, renderActionIndex, layer, layerIndex, cameraIndex, cameraFirstRenderAction, postProcessMarked) {
		let renderAction = renderActions[renderActionIndex];
		if (!renderAction) {
			renderAction = renderActions[renderActionIndex] = new RenderAction();
		}
		let rt = layer.renderTarget;
		const camera = layer.cameras[cameraIndex];
		if (camera && camera.renderTarget) {
			if (layer.id !== LAYERID_DEPTH) {
				rt = camera.renderTarget;
			}
		}
		let used = false;
		for (let i = renderActionIndex - 1; i >= 0; i--) {
			if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
				used = true;
				break;
			}
		}
		const needsClear = cameraFirstRenderAction || !used;
		let clearColor = needsClear ? camera.clearColorBuffer : false;
		let clearDepth = needsClear ? camera.clearDepthBuffer : false;
		let clearStencil = needsClear ? camera.clearStencilBuffer : false;
		clearColor || (clearColor = layer.clearColorBuffer);
		clearDepth || (clearDepth = layer.clearDepthBuffer);
		clearStencil || (clearStencil = layer.clearStencilBuffer);
		if (postProcessMarked && camera.postEffectsEnabled) {
			rt = null;
		}
		renderAction.reset();
		renderAction.triggerPostprocess = false;
		renderAction.layerIndex = layerIndex;
		renderAction.cameraIndex = cameraIndex;
		renderAction.camera = camera;
		renderAction.renderTarget = rt;
		renderAction.clearColor = clearColor;
		renderAction.clearDepth = clearDepth;
		renderAction.clearStencil = clearStencil;
		renderAction.firstCameraUse = cameraFirstRenderAction;
		renderAction.lastCameraUse = false;
		return renderAction;
	}
	propagateRenderTarget(startIndex, fromCamera) {
		for (let a = startIndex; a >= 0; a--) {
			const ra = this._renderActions[a];
			const layer = this.layerList[ra.layerIndex];
			if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
				break;
			}
			if (layer.id === LAYERID_DEPTH) {
				continue;
			}
			const thisCamera = ra == null ? void 0 : ra.camera.camera;
			if (thisCamera) {
				if (!fromCamera.camera.rect.equals(thisCamera.rect) || !fromCamera.camera.scissorRect.equals(thisCamera.scissorRect)) {
					break;
				}
			}
			ra.renderTarget = fromCamera.renderTarget;
		}
	}
	_logRenderActions() {}
	_isLayerAdded(layer) {
		if (this.layerList.indexOf(layer) >= 0) {
			return true;
		}
		return false;
	}
	_isSublayerAdded(layer, transparent) {
		for (let i = 0; i < this.layerList.length; i++) {
			if (this.layerList[i] === layer && this.subLayerList[i] === transparent) {
				return true;
			}
		}
		return false;
	}
	push(layer) {
		if (this._isLayerAdded(layer)) return;
		this.layerList.push(layer);
		this.layerList.push(layer);
		this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
		this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
		this.subLayerEnabled.push(true);
		this.subLayerEnabled.push(true);
		this._dirty = true;
		this._dirtyLights = true;
		this._dirtyCameras = true;
		this.fire('add', layer);
	}
	insert(layer, index) {
		if (this._isLayerAdded(layer)) return;
		this.layerList.splice(index, 0, layer, layer);
		this.subLayerList.splice(index, 0, false, true);
		const count = this.layerList.length;
		this._updateOpaqueOrder(index, count - 1);
		this._updateTransparentOrder(index, count - 1);
		this.subLayerEnabled.splice(index, 0, true, true);
		this._dirty = true;
		this._dirtyLights = true;
		this._dirtyCameras = true;
		this.fire('add', layer);
	}
	remove(layer) {
		let id = this.layerList.indexOf(layer);
		delete this._opaqueOrder[id];
		delete this._transparentOrder[id];
		while (id >= 0) {
			this.layerList.splice(id, 1);
			this.subLayerList.splice(id, 1);
			this.subLayerEnabled.splice(id, 1);
			id = this.layerList.indexOf(layer);
			this._dirty = true;
			this._dirtyLights = true;
			this._dirtyCameras = true;
			this.fire('remove', layer);
		}
		const count = this.layerList.length;
		this._updateOpaqueOrder(0, count - 1);
		this._updateTransparentOrder(0, count - 1);
	}
	pushOpaque(layer) {
		if (this._isSublayerAdded(layer, false)) return;
		this.layerList.push(layer);
		this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
		this.subLayerEnabled.push(true);
		this._dirty = true;
		this._dirtyLights = true;
		this._dirtyCameras = true;
		this.fire('add', layer);
	}
	insertOpaque(layer, index) {
		if (this._isSublayerAdded(layer, false)) return;
		this.layerList.splice(index, 0, layer);
		this.subLayerList.splice(index, 0, false);
		const count = this.subLayerList.length;
		this._updateOpaqueOrder(index, count - 1);
		this.subLayerEnabled.splice(index, 0, true);
		this._dirty = true;
		this._dirtyLights = true;
		this._dirtyCameras = true;
		this.fire('add', layer);
	}
	removeOpaque(layer) {
		for (let i = 0, len = this.layerList.length; i < len; i++) {
			if (this.layerList[i] === layer && !this.subLayerList[i]) {
				this.layerList.splice(i, 1);
				this.subLayerList.splice(i, 1);
				len--;
				this._updateOpaqueOrder(i, len - 1);
				this.subLayerEnabled.splice(i, 1);
				this._dirty = true;
				this._dirtyLights = true;
				this._dirtyCameras = true;
				if (this.layerList.indexOf(layer) < 0) {
					this.fire('remove', layer);
				}
				return;
			}
		}
	}
	pushTransparent(layer) {
		if (this._isSublayerAdded(layer, true)) return;
		this.layerList.push(layer);
		this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
		this.subLayerEnabled.push(true);
		this._dirty = true;
		this._dirtyLights = true;
		this._dirtyCameras = true;
		this.fire('add', layer);
	}
	insertTransparent(layer, index) {
		if (this._isSublayerAdded(layer, true)) return;
		this.layerList.splice(index, 0, layer);
		this.subLayerList.splice(index, 0, true);
		const count = this.subLayerList.length;
		this._updateTransparentOrder(index, count - 1);
		this.subLayerEnabled.splice(index, 0, true);
		this._dirty = true;
		this._dirtyLights = true;
		this._dirtyCameras = true;
		this.fire('add', layer);
	}
	removeTransparent(layer) {
		for (let i = 0, len = this.layerList.length; i < len; i++) {
			if (this.layerList[i] === layer && this.subLayerList[i]) {
				this.layerList.splice(i, 1);
				this.subLayerList.splice(i, 1);
				len--;
				this._updateTransparentOrder(i, len - 1);
				this.subLayerEnabled.splice(i, 1);
				this._dirty = true;
				this._dirtyLights = true;
				this._dirtyCameras = true;
				if (this.layerList.indexOf(layer) < 0) {
					this.fire('remove', layer);
				}
				return;
			}
		}
	}
	_getSublayerIndex(layer, transparent) {
		let id = this.layerList.indexOf(layer);
		if (id < 0) return -1;
		if (this.subLayerList[id] !== transparent) {
			id = this.layerList.indexOf(layer, id + 1);
			if (id < 0) return -1;
			if (this.subLayerList[id] !== transparent) {
				return -1;
			}
		}
		return id;
	}
	getOpaqueIndex(layer) {
		return this._getSublayerIndex(layer, false);
	}
	getTransparentIndex(layer) {
		return this._getSublayerIndex(layer, true);
	}
	getLayerById(id) {
		for (let i = 0; i < this.layerList.length; i++) {
			if (this.layerList[i].id === id) return this.layerList[i];
		}
		return null;
	}
	getLayerByName(name) {
		for (let i = 0; i < this.layerList.length; i++) {
			if (this.layerList[i].name === name) return this.layerList[i];
		}
		return null;
	}
	_updateOpaqueOrder(startIndex, endIndex) {
		for (let i = startIndex; i <= endIndex; i++) {
			if (this.subLayerList[i] === false) {
				this._opaqueOrder[this.layerList[i].id] = i;
			}
		}
	}
	_updateTransparentOrder(startIndex, endIndex) {
		for (let i = startIndex; i <= endIndex; i++) {
			if (this.subLayerList[i] === true) {
				this._transparentOrder[this.layerList[i].id] = i;
			}
		}
	}
	_sortLayersDescending(layersA, layersB, order) {
		let topLayerA = -1;
		let topLayerB = -1;
		for (let i = 0, len = layersA.length; i < len; i++) {
			const id = layersA[i];
			if (order.hasOwnProperty(id)) {
				topLayerA = Math.max(topLayerA, order[id]);
			}
		}
		for (let i = 0, len = layersB.length; i < len; i++) {
			const id = layersB[i];
			if (order.hasOwnProperty(id)) {
				topLayerB = Math.max(topLayerB, order[id]);
			}
		}
		if (topLayerA === -1 && topLayerB !== -1) {
			return 1;
		} else if (topLayerB === -1 && topLayerA !== -1) {
			return -1;
		}
		return topLayerB - topLayerA;
	}
	sortTransparentLayers(layersA, layersB) {
		return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
	}
	sortOpaqueLayers(layersA, layersB) {
		return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
	}
}

export { LayerComposition };
