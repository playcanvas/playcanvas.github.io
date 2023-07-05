import '../core/debug.js';
import { hashCode } from '../core/hash.js';
import { SORTMODE_MATERIALMESH, SORTMODE_BACK2FRONT, SHADER_FORWARD, BLEND_NONE, LIGHTTYPE_DIRECTIONAL, LAYER_FX, SORTMODE_NONE, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTKEY_FORWARD } from './constants.js';
import { Material } from './materials/material.js';

let keyA, keyB, sortPos, sortDir;
function sortManual(drawCallA, drawCallB) {
	return drawCallA.drawOrder - drawCallB.drawOrder;
}
function sortMaterialMesh(drawCallA, drawCallB) {
	keyA = drawCallA._key[SORTKEY_FORWARD];
	keyB = drawCallB._key[SORTKEY_FORWARD];
	if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
		return drawCallB.mesh.id - drawCallA.mesh.id;
	}
	return keyB - keyA;
}
function sortBackToFront(drawCallA, drawCallB) {
	return drawCallB.zdist - drawCallA.zdist;
}
function sortFrontToBack(drawCallA, drawCallB) {
	return drawCallA.zdist - drawCallB.zdist;
}
const sortCallbacks = [null, sortManual, sortMaterialMesh, sortBackToFront, sortFrontToBack];
function sortLights(lightA, lightB) {
	return lightB.key - lightA.key;
}
let layerCounter = 0;
class VisibleInstanceList {
	constructor() {
		this.list = [];
		this.length = 0;
		this.done = false;
	}
}
class InstanceList {
	constructor() {
		this.opaqueMeshInstances = [];
		this.transparentMeshInstances = [];
		this.shadowCasters = [];
		this.visibleOpaque = [];
		this.visibleTransparent = [];
	}
	prepare(index) {
		if (!this.visibleOpaque[index]) {
			this.visibleOpaque[index] = new VisibleInstanceList();
		}
		if (!this.visibleTransparent[index]) {
			this.visibleTransparent[index] = new VisibleInstanceList();
		}
		this.visibleOpaque[index].done = false;
		this.visibleTransparent[index].done = false;
	}
	delete(index) {
		if (index < this.visibleOpaque.length) {
			this.visibleOpaque.splice(index, 1);
		}
		if (index < this.visibleTransparent.length) {
			this.visibleTransparent.splice(index, 1);
		}
	}
}
class Layer {
	constructor(options = {}) {
		var _options$enabled, _options$opaqueSortMo, _options$transparentS, _options$shaderPass, _options$passThrough;
		if (options.id !== undefined) {
			this.id = options.id;
			layerCounter = Math.max(this.id + 1, layerCounter);
		} else {
			this.id = layerCounter++;
		}
		this.name = options.name;
		this._enabled = (_options$enabled = options.enabled) != null ? _options$enabled : true;
		this._refCounter = this._enabled ? 1 : 0;
		this.opaqueSortMode = (_options$opaqueSortMo = options.opaqueSortMode) != null ? _options$opaqueSortMo : SORTMODE_MATERIALMESH;
		this.transparentSortMode = (_options$transparentS = options.transparentSortMode) != null ? _options$transparentS : SORTMODE_BACK2FRONT;
		if (options.renderTarget) {
			this.renderTarget = options.renderTarget;
		}
		this.shaderPass = (_options$shaderPass = options.shaderPass) != null ? _options$shaderPass : SHADER_FORWARD;
		this.passThrough = (_options$passThrough = options.passThrough) != null ? _options$passThrough : false;
		this._clearColorBuffer = !!options.clearColorBuffer;
		this._clearDepthBuffer = !!options.clearDepthBuffer;
		this._clearStencilBuffer = !!options.clearStencilBuffer;
		this.onPreCull = options.onPreCull;
		this.onPreRender = options.onPreRender;
		this.onPreRenderOpaque = options.onPreRenderOpaque;
		this.onPreRenderTransparent = options.onPreRenderTransparent;
		this.onPostCull = options.onPostCull;
		this.onPostRender = options.onPostRender;
		this.onPostRenderOpaque = options.onPostRenderOpaque;
		this.onPostRenderTransparent = options.onPostRenderTransparent;
		this.onDrawCall = options.onDrawCall;
		this.onEnable = options.onEnable;
		this.onDisable = options.onDisable;
		if (this._enabled && this.onEnable) {
			this.onEnable();
		}
		this.layerReference = options.layerReference;
		this.instances = options.layerReference ? options.layerReference.instances : new InstanceList();
		this.cullingMask = options.cullingMask ? options.cullingMask : 0xFFFFFFFF;
		this.opaqueMeshInstances = this.instances.opaqueMeshInstances;
		this.transparentMeshInstances = this.instances.transparentMeshInstances;
		this.shadowCasters = this.instances.shadowCasters;
		this.customSortCallback = null;
		this.customCalculateSortValues = null;
		this._lights = [];
		this._lightsSet = new Set();
		this._clusteredLightsSet = new Set();
		this._splitLights = [[], [], []];
		this.cameras = [];
		this._dirty = false;
		this._dirtyLights = false;
		this._dirtyCameras = false;
		this._lightHash = 0;
		this._staticLightHash = 0;
		this._needsStaticPrepare = true;
		this._staticPrepareDone = false;
		this._shaderVersion = -1;
		this._lightCube = null;
	}
	get hasClusteredLights() {
		return this._clusteredLightsSet.size > 0;
	}
	set enabled(val) {
		if (val !== this._enabled) {
			this._enabled = val;
			if (val) {
				this.incrementCounter();
				if (this.onEnable) this.onEnable();
			} else {
				this.decrementCounter();
				if (this.onDisable) this.onDisable();
			}
		}
	}
	get enabled() {
		return this._enabled;
	}
	set clearColorBuffer(val) {
		this._clearColorBuffer = val;
		this._dirtyCameras = true;
	}
	get clearColorBuffer() {
		return this._clearColorBuffer;
	}
	set clearDepthBuffer(val) {
		this._clearDepthBuffer = val;
		this._dirtyCameras = true;
	}
	get clearDepthBuffer() {
		return this._clearDepthBuffer;
	}
	set clearStencilBuffer(val) {
		this._clearStencilBuffer = val;
		this._dirtyCameras = true;
	}
	get clearStencilBuffer() {
		return this._clearStencilBuffer;
	}
	get clusteredLightsSet() {
		return this._clusteredLightsSet;
	}
	incrementCounter() {
		if (this._refCounter === 0) {
			this._enabled = true;
			if (this.onEnable) this.onEnable();
		}
		this._refCounter++;
	}
	decrementCounter() {
		if (this._refCounter === 1) {
			this._enabled = false;
			if (this.onDisable) this.onDisable();
		} else if (this._refCounter === 0) {
			return;
		}
		this._refCounter--;
	}
	addMeshInstances(meshInstances, skipShadowCasters) {
		const sceneShaderVer = this._shaderVersion;
		const casters = this.shadowCasters;
		for (let i = 0; i < meshInstances.length; i++) {
			const m = meshInstances[i];
			const mat = m.material;
			const arr = mat.blendType === BLEND_NONE ? this.opaqueMeshInstances : this.transparentMeshInstances;
			if (this.opaqueMeshInstances.indexOf(m) < 0 && this.transparentMeshInstances.indexOf(m) < 0) {
				arr.push(m);
			}
			if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);
			if (!this.passThrough && sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {
				if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
					mat.clearVariants();
				}
				mat._shaderVersion = sceneShaderVer;
			}
		}
		if (!this.passThrough) this._dirty = true;
	}
	removeMeshInstanceFromArray(m, arr) {
		let spliceOffset = -1;
		let spliceCount = 0;
		const len = arr.length;
		for (let j = 0; j < len; j++) {
			const drawCall = arr[j];
			if (drawCall === m) {
				spliceOffset = j;
				spliceCount = 1;
				break;
			}
			if (drawCall._staticSource === m) {
				if (spliceOffset < 0) spliceOffset = j;
				spliceCount++;
			} else if (spliceOffset >= 0) {
				break;
			}
		}
		if (spliceOffset >= 0) {
			arr.splice(spliceOffset, spliceCount);
		}
	}
	removeMeshInstances(meshInstances, skipShadowCasters) {
		const opaque = this.opaqueMeshInstances;
		const transparent = this.transparentMeshInstances;
		const casters = this.shadowCasters;
		for (let i = 0; i < meshInstances.length; i++) {
			const m = meshInstances[i];
			this.removeMeshInstanceFromArray(m, opaque);
			this.removeMeshInstanceFromArray(m, transparent);
			if (!skipShadowCasters) {
				const j = casters.indexOf(m);
				if (j >= 0) casters.splice(j, 1);
			}
		}
		this._dirty = true;
	}
	clearMeshInstances(skipShadowCasters) {
		if (this.opaqueMeshInstances.length === 0 && this.transparentMeshInstances.length === 0) {
			if (skipShadowCasters || this.shadowCasters.length === 0) return;
		}
		this.opaqueMeshInstances.length = 0;
		this.transparentMeshInstances.length = 0;
		if (!skipShadowCasters) this.shadowCasters.length = 0;
		if (!this.passThrough) this._dirty = true;
	}
	addLight(light) {
		const l = light.light;
		if (!this._lightsSet.has(l)) {
			this._lightsSet.add(l);
			this._lights.push(l);
			this._dirtyLights = true;
			this._generateLightHash();
		}
		if (l.type !== LIGHTTYPE_DIRECTIONAL) {
			this._clusteredLightsSet.add(l);
		}
	}
	removeLight(light) {
		const l = light.light;
		if (this._lightsSet.has(l)) {
			this._lightsSet.delete(l);
			this._lights.splice(this._lights.indexOf(l), 1);
			this._dirtyLights = true;
			this._generateLightHash();
		}
		if (l.type !== LIGHTTYPE_DIRECTIONAL) {
			this._clusteredLightsSet.delete(l);
		}
	}
	clearLights() {
		this._lightsSet.clear();
		this._clusteredLightsSet.clear();
		this._lights.length = 0;
		this._dirtyLights = true;
	}
	addShadowCasters(meshInstances) {
		const arr = this.shadowCasters;
		for (let i = 0; i < meshInstances.length; i++) {
			const m = meshInstances[i];
			if (!m.castShadow) continue;
			if (arr.indexOf(m) < 0) arr.push(m);
		}
		this._dirtyLights = true;
	}
	removeShadowCasters(meshInstances) {
		const arr = this.shadowCasters;
		for (let i = 0; i < meshInstances.length; i++) {
			const id = arr.indexOf(meshInstances[i]);
			if (id >= 0) arr.splice(id, 1);
		}
		this._dirtyLights = true;
	}
	_generateLightHash() {
		if (this._lights.length > 0) {
			this._lights.sort(sortLights);
			let str = '';
			let strStatic = '';
			for (let i = 0; i < this._lights.length; i++) {
				if (this._lights[i].isStatic) {
					strStatic += this._lights[i].key;
				} else {
					str += this._lights[i].key;
				}
			}
			if (str.length === 0) {
				this._lightHash = 0;
			} else {
				this._lightHash = hashCode(str);
			}
			if (strStatic.length === 0) {
				this._staticLightHash = 0;
			} else {
				this._staticLightHash = hashCode(strStatic);
			}
		} else {
			this._lightHash = 0;
			this._staticLightHash = 0;
		}
	}
	addCamera(camera) {
		if (this.cameras.indexOf(camera) >= 0) return;
		this.cameras.push(camera);
		this._dirtyCameras = true;
	}
	removeCamera(camera) {
		const index = this.cameras.indexOf(camera);
		if (index >= 0) {
			this.cameras.splice(index, 1);
			this._dirtyCameras = true;
			this.instances.delete(index);
		}
	}
	clearCameras() {
		this.cameras.length = 0;
		this._dirtyCameras = true;
	}
	_calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
		for (let i = 0; i < drawCallsCount; i++) {
			const drawCall = drawCalls[i];
			if (drawCall.command) continue;
			if (drawCall.layer <= LAYER_FX) continue;
			if (drawCall.calculateSortDistance) {
				drawCall.zdist = drawCall.calculateSortDistance(drawCall, camPos, camFwd);
				continue;
			}
			const meshPos = drawCall.aabb.center;
			const tempx = meshPos.x - camPos.x;
			const tempy = meshPos.y - camPos.y;
			const tempz = meshPos.z - camPos.z;
			drawCall.zdist = tempx * camFwd.x + tempy * camFwd.y + tempz * camFwd.z;
		}
	}
	_sortVisible(transparent, cameraNode, cameraPass) {
		const objects = this.instances;
		const sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
		if (sortMode === SORTMODE_NONE) return;
		const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];
		if (sortMode === SORTMODE_CUSTOM) {
			sortPos = cameraNode.getPosition();
			sortDir = cameraNode.forward;
			if (this.customCalculateSortValues) {
				this.customCalculateSortValues(visible.list, visible.length, sortPos, sortDir);
			}
			if (visible.list.length !== visible.length) {
				visible.list.length = visible.length;
			}
			if (this.customSortCallback) {
				visible.list.sort(this.customSortCallback);
			}
		} else {
			if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
				sortPos = cameraNode.getPosition();
				sortDir = cameraNode.forward;
				this._calculateSortDistances(visible.list, visible.length, sortPos, sortDir);
			}
			if (visible.list.length !== visible.length) {
				visible.list.length = visible.length;
			}
			visible.list.sort(sortCallbacks[sortMode]);
		}
	}
}

export { Layer };
