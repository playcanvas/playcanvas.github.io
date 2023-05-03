import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, SHADOWUPDATE_REALTIME, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, LAYERID_WORLD } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

const _lightProps = [];
const _lightPropsDefault = [];
class LightComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._cookieAsset = null;
		this._cookieAssetId = null;
		this._cookieAssetAdd = false;
		this._cookieMatrix = null;
	}
	addLightToLayers() {
		for (let i = 0; i < this.layers.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
			if (layer) {
				layer.addLight(this);
			}
		}
	}
	removeLightFromLayers() {
		for (let i = 0; i < this.layers.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
			if (layer) {
				layer.removeLight(this);
			}
		}
	}
	onLayersChanged(oldComp, newComp) {
		if (this.enabled && this.entity.enabled) {
			this.addLightToLayers();
		}
		oldComp.off('add', this.onLayerAdded, this);
		oldComp.off('remove', this.onLayerRemoved, this);
		newComp.on('add', this.onLayerAdded, this);
		newComp.on('remove', this.onLayerRemoved, this);
	}
	onLayerAdded(layer) {
		const index = this.layers.indexOf(layer.id);
		if (index >= 0 && this.enabled && this.entity.enabled) {
			layer.addLight(this);
		}
	}
	onLayerRemoved(layer) {
		const index = this.layers.indexOf(layer.id);
		if (index >= 0) {
			layer.removeLight(this);
		}
	}
	refreshProperties() {
		for (let i = 0; i < _lightProps.length; i++) {
			const name = _lightProps[i];
			this[name] = this[name];
		}
		if (this.enabled && this.entity.enabled) this.onEnable();
	}
	onCookieAssetSet() {
		let forceLoad = false;
		if (this._cookieAsset.type === 'cubemap' && !this._cookieAsset.loadFaces) {
			this._cookieAsset.loadFaces = true;
			forceLoad = true;
		}
		if (!this._cookieAsset.resource || forceLoad) this.system.app.assets.load(this._cookieAsset);
		if (this._cookieAsset.resource) this.onCookieAssetLoad();
	}
	onCookieAssetAdd(asset) {
		if (this._cookieAssetId !== asset.id) return;
		this._cookieAsset = asset;
		if (this.light.enabled) this.onCookieAssetSet();
		this._cookieAsset.on('load', this.onCookieAssetLoad, this);
		this._cookieAsset.on('remove', this.onCookieAssetRemove, this);
	}
	onCookieAssetLoad() {
		if (!this._cookieAsset || !this._cookieAsset.resource) return;
		this.cookie = this._cookieAsset.resource;
	}
	onCookieAssetRemove() {
		if (!this._cookieAssetId) return;
		if (this._cookieAssetAdd) {
			this.system.app.assets.off('add:' + this._cookieAssetId, this.onCookieAssetAdd, this);
			this._cookieAssetAdd = false;
		}
		if (this._cookieAsset) {
			this._cookieAsset.off('load', this.onCookieAssetLoad, this);
			this._cookieAsset.off('remove', this.onCookieAssetRemove, this);
			this._cookieAsset = null;
		}
		this.cookie = null;
	}
	onEnable() {
		this.light.enabled = true;
		this.system.app.scene.on('set:layers', this.onLayersChanged, this);
		if (this.system.app.scene.layers) {
			this.system.app.scene.layers.on('add', this.onLayerAdded, this);
			this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
		}
		if (this.enabled && this.entity.enabled) {
			this.addLightToLayers();
		}
		if (this._cookieAsset && !this.cookie) this.onCookieAssetSet();
	}
	onDisable() {
		this.light.enabled = false;
		this.system.app.scene.off('set:layers', this.onLayersChanged, this);
		if (this.system.app.scene.layers) {
			this.system.app.scene.layers.off('add', this.onLayerAdded, this);
			this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
		}
		this.removeLightFromLayers();
	}
	onRemove() {
		this.onDisable();
		this.light.destroy();
		this.cookieAsset = null;
	}
	set shadowUpdateOverrides(values) {
		this.light.shadowUpdateOverrides = values;
	}
	get shadowUpdateOverrides() {
		return this.light.shadowUpdateOverrides;
	}
}
function _defineProperty(name, defaultValue, setFunc, skipEqualsCheck) {
	const c = LightComponent.prototype;
	_lightProps.push(name);
	_lightPropsDefault.push(defaultValue);
	Object.defineProperty(c, name, {
		get: function () {
			return this.data[name];
		},
		set: function (value) {
			const data = this.data;
			const oldValue = data[name];
			if (!skipEqualsCheck && oldValue === value) return;
			data[name] = value;
			if (setFunc) setFunc.call(this, value, oldValue);
		},
		configurable: true
	});
}
function _defineProps() {
	_defineProperty('enabled', true, function (newValue, oldValue) {
		this.onSetEnabled(null, oldValue, newValue);
	});
	_defineProperty('light', null);
	_defineProperty('type', 'directional', function (newValue, oldValue) {
		this.system.changeType(this, oldValue, newValue);
		this.refreshProperties();
	});
	_defineProperty('color', new Color(1, 1, 1), function (newValue, oldValue) {
		this.light.setColor(newValue);
	}, true);
	_defineProperty('intensity', 1, function (newValue, oldValue) {
		this.light.intensity = newValue;
	});
	_defineProperty('luminance', 0, function (newValue, oldValue) {
		this.light.luminance = newValue;
	});
	_defineProperty('shape', LIGHTSHAPE_PUNCTUAL, function (newValue, oldValue) {
		this.light.shape = newValue;
	});
	_defineProperty('castShadows', false, function (newValue, oldValue) {
		this.light.castShadows = newValue;
	});
	_defineProperty('shadowDistance', 40, function (newValue, oldValue) {
		this.light.shadowDistance = newValue;
	});
	_defineProperty('shadowIntensity', 1, function (newValue, oldValue) {
		this.light.shadowIntensity = newValue;
	});
	_defineProperty('shadowResolution', 1024, function (newValue, oldValue) {
		this.light.shadowResolution = newValue;
	});
	_defineProperty('shadowBias', 0.05, function (newValue, oldValue) {
		this.light.shadowBias = -0.01 * math.clamp(newValue, 0, 1);
	});
	_defineProperty('numCascades', 1, function (newValue, oldValue) {
		this.light.numCascades = math.clamp(Math.floor(newValue), 1, 4);
	});
	_defineProperty('bakeNumSamples', 1, function (newValue, oldValue) {
		this.light.bakeNumSamples = math.clamp(Math.floor(newValue), 1, 255);
	});
	_defineProperty('bakeArea', 0, function (newValue, oldValue) {
		this.light.bakeArea = math.clamp(newValue, 0, 180);
	});
	_defineProperty('cascadeDistribution', 0.5, function (newValue, oldValue) {
		this.light.cascadeDistribution = math.clamp(newValue, 0, 1);
	});
	_defineProperty('normalOffsetBias', 0, function (newValue, oldValue) {
		this.light.normalOffsetBias = math.clamp(newValue, 0, 1);
	});
	_defineProperty('range', 10, function (newValue, oldValue) {
		this.light.attenuationEnd = newValue;
	});
	_defineProperty('innerConeAngle', 40, function (newValue, oldValue) {
		this.light.innerConeAngle = newValue;
	});
	_defineProperty('outerConeAngle', 45, function (newValue, oldValue) {
		this.light.outerConeAngle = newValue;
	});
	_defineProperty('falloffMode', LIGHTFALLOFF_LINEAR, function (newValue, oldValue) {
		this.light.falloffMode = newValue;
	});
	_defineProperty('shadowType', SHADOW_PCF3, function (newValue, oldValue) {
		this.light.shadowType = newValue;
	});
	_defineProperty('vsmBlurSize', 11, function (newValue, oldValue) {
		this.light.vsmBlurSize = newValue;
	});
	_defineProperty('vsmBlurMode', BLUR_GAUSSIAN, function (newValue, oldValue) {
		this.light.vsmBlurMode = newValue;
	});
	_defineProperty('vsmBias', 0.01 * 0.25, function (newValue, oldValue) {
		this.light.vsmBias = math.clamp(newValue, 0, 1);
	});
	_defineProperty('cookieAsset', null, function (newValue, oldValue) {
		if (this._cookieAssetId && (newValue instanceof Asset && newValue.id === this._cookieAssetId || newValue === this._cookieAssetId)) return;
		this.onCookieAssetRemove();
		this._cookieAssetId = null;
		if (newValue instanceof Asset) {
			this.data.cookieAsset = newValue.id;
			this._cookieAssetId = newValue.id;
			this.onCookieAssetAdd(newValue);
		} else if (typeof newValue === 'number') {
			this._cookieAssetId = newValue;
			const asset = this.system.app.assets.get(newValue);
			if (asset) {
				this.onCookieAssetAdd(asset);
			} else {
				this._cookieAssetAdd = true;
				this.system.app.assets.on('add:' + this._cookieAssetId, this.onCookieAssetAdd, this);
			}
		}
	});
	_defineProperty('cookie', null, function (newValue, oldValue) {
		this.light.cookie = newValue;
	});
	_defineProperty('cookieIntensity', 1, function (newValue, oldValue) {
		this.light.cookieIntensity = math.clamp(newValue, 0, 1);
	});
	_defineProperty('cookieFalloff', true, function (newValue, oldValue) {
		this.light.cookieFalloff = newValue;
	});
	_defineProperty('cookieChannel', 'rgb', function (newValue, oldValue) {
		this.light.cookieChannel = newValue;
	});
	_defineProperty('cookieAngle', 0, function (newValue, oldValue) {
		if (newValue !== 0 || this.cookieScale !== null) {
			if (!this._cookieMatrix) this._cookieMatrix = new Vec4();
			let scx = 1;
			let scy = 1;
			if (this.cookieScale) {
				scx = this.cookieScale.x;
				scy = this.cookieScale.y;
			}
			const c = Math.cos(newValue * math.DEG_TO_RAD);
			const s = Math.sin(newValue * math.DEG_TO_RAD);
			this._cookieMatrix.set(c / scx, -s / scx, s / scy, c / scy);
			this.light.cookieTransform = this._cookieMatrix;
		} else {
			this.light.cookieTransform = null;
		}
	});
	_defineProperty('cookieScale', null, function (newValue, oldValue) {
		if (newValue !== null || this.cookieAngle !== 0) {
			if (!this._cookieMatrix) this._cookieMatrix = new Vec4();
			const scx = newValue.x;
			const scy = newValue.y;
			const c = Math.cos(this.cookieAngle * math.DEG_TO_RAD);
			const s = Math.sin(this.cookieAngle * math.DEG_TO_RAD);
			this._cookieMatrix.set(c / scx, -s / scx, s / scy, c / scy);
			this.light.cookieTransform = this._cookieMatrix;
		} else {
			this.light.cookieTransform = null;
		}
	}, true);
	_defineProperty('cookieOffset', null, function (newValue, oldValue) {
		this.light.cookieOffset = newValue;
	}, true);
	_defineProperty('shadowUpdateMode', SHADOWUPDATE_REALTIME, function (newValue, oldValue) {
		this.light.shadowUpdateMode = newValue;
	}, true);
	_defineProperty('mask', 1, function (newValue, oldValue) {
		this.light.mask = newValue;
	});
	_defineProperty('affectDynamic', true, function (newValue, oldValue) {
		if (newValue) {
			this.light.mask |= MASK_AFFECT_DYNAMIC;
		} else {
			this.light.mask &= ~MASK_AFFECT_DYNAMIC;
		}
		this.light.layersDirty();
	});
	_defineProperty('affectLightmapped', false, function (newValue, oldValue) {
		if (newValue) {
			this.light.mask |= MASK_AFFECT_LIGHTMAPPED;
			if (this.bake) this.light.mask &= ~MASK_BAKE;
		} else {
			this.light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
			if (this.bake) this.light.mask |= MASK_BAKE;
		}
	});
	_defineProperty('bake', false, function (newValue, oldValue) {
		if (newValue) {
			this.light.mask |= MASK_BAKE;
			if (this.affectLightmapped) this.light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
		} else {
			this.light.mask &= ~MASK_BAKE;
			if (this.affectLightmapped) this.light.mask |= MASK_AFFECT_LIGHTMAPPED;
		}
		this.light.layersDirty();
	});
	_defineProperty('bakeDir', true, function (newValue, oldValue) {
		this.light.bakeDir = newValue;
	});
	_defineProperty('isStatic', false, function (newValue, oldValue) {
		this.light.isStatic = newValue;
	});
	_defineProperty('layers', [LAYERID_WORLD], function (newValue, oldValue) {
		for (let i = 0; i < oldValue.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
			if (!layer) continue;
			layer.removeLight(this);
		}
		for (let i = 0; i < newValue.length; i++) {
			const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
			if (!layer) continue;
			if (this.enabled && this.entity.enabled) {
				layer.addLight(this);
			}
		}
	});
}
_defineProps();

export { LightComponent, _lightProps, _lightPropsDefault };
