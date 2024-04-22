import { math } from '../../../core/math/math.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';
import { properties } from './data.js';

class LightComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._cookieAsset = null;
    this._cookieAssetId = null;
    this._cookieAssetAdd = false;
    this._cookieMatrix = null;
  }
  get data() {
    const record = this.system.store[this.entity.getGuid()];
    return record ? record.data : null;
  }
  set enabled(arg) {
    this._setValue('enabled', arg, function (newValue, oldValue) {
      this.onSetEnabled(null, oldValue, newValue);
    });
  }
  get enabled() {
    return this.data.enabled;
  }
  set light(arg) {
    this._setValue('light', arg);
  }
  get light() {
    return this.data.light;
  }
  set type(arg) {
    this._setValue('type', arg, function (newValue, oldValue) {
      this.system.changeType(this, oldValue, newValue);
      this.refreshProperties();
    });
  }
  get type() {
    return this.data.type;
  }
  set color(arg) {
    this._setValue('color', arg, function (newValue, oldValue) {
      this.light.setColor(newValue);
    }, true);
  }
  get color() {
    return this.data.color;
  }
  set intensity(arg) {
    this._setValue('intensity', arg, function (newValue, oldValue) {
      this.light.intensity = newValue;
    });
  }
  get intensity() {
    return this.data.intensity;
  }
  set luminance(arg) {
    this._setValue('luminance', arg, function (newValue, oldValue) {
      this.light.luminance = newValue;
    });
  }
  get luminance() {
    return this.data.luminance;
  }
  set shape(arg) {
    this._setValue('shape', arg, function (newValue, oldValue) {
      this.light.shape = newValue;
    });
  }
  get shape() {
    return this.data.shape;
  }
  set affectSpecularity(arg) {
    this._setValue('affectSpecularity', arg, function (newValue, oldValue) {
      this.light.affectSpecularity = newValue;
    });
  }
  get affectSpecularity() {
    return this.data.affectSpecularity;
  }
  set castShadows(arg) {
    this._setValue('castShadows', arg, function (newValue, oldValue) {
      this.light.castShadows = newValue;
    });
  }
  get castShadows() {
    return this.data.castShadows;
  }
  set shadowDistance(arg) {
    this._setValue('shadowDistance', arg, function (newValue, oldValue) {
      this.light.shadowDistance = newValue;
    });
  }
  get shadowDistance() {
    return this.data.shadowDistance;
  }
  set shadowIntensity(arg) {
    this._setValue('shadowIntensity', arg, function (newValue, oldValue) {
      this.light.shadowIntensity = newValue;
    });
  }
  get shadowIntensity() {
    return this.data.shadowIntensity;
  }
  set shadowResolution(arg) {
    this._setValue('shadowResolution', arg, function (newValue, oldValue) {
      this.light.shadowResolution = newValue;
    });
  }
  get shadowResolution() {
    return this.data.shadowResolution;
  }
  set shadowBias(arg) {
    this._setValue('shadowBias', arg, function (newValue, oldValue) {
      this.light.shadowBias = -0.01 * math.clamp(newValue, 0, 1);
    });
  }
  get shadowBias() {
    return this.data.shadowBias;
  }
  set numCascades(arg) {
    this._setValue('numCascades', arg, function (newValue, oldValue) {
      this.light.numCascades = math.clamp(Math.floor(newValue), 1, 4);
    });
  }
  get numCascades() {
    return this.data.numCascades;
  }
  set bakeNumSamples(arg) {
    this._setValue('bakeNumSamples', arg, function (newValue, oldValue) {
      this.light.bakeNumSamples = math.clamp(Math.floor(newValue), 1, 255);
    });
  }
  get bakeNumSamples() {
    return this.data.bakeNumSamples;
  }
  set bakeArea(arg) {
    this._setValue('bakeArea', arg, function (newValue, oldValue) {
      this.light.bakeArea = math.clamp(newValue, 0, 180);
    });
  }
  get bakeArea() {
    return this.data.bakeArea;
  }
  set cascadeDistribution(arg) {
    this._setValue('cascadeDistribution', arg, function (newValue, oldValue) {
      this.light.cascadeDistribution = math.clamp(newValue, 0, 1);
    });
  }
  get cascadeDistribution() {
    return this.data.cascadeDistribution;
  }
  set normalOffsetBias(arg) {
    this._setValue('normalOffsetBias', arg, function (newValue, oldValue) {
      this.light.normalOffsetBias = math.clamp(newValue, 0, 1);
    });
  }
  get normalOffsetBias() {
    return this.data.normalOffsetBias;
  }
  set range(arg) {
    this._setValue('range', arg, function (newValue, oldValue) {
      this.light.attenuationEnd = newValue;
    });
  }
  get range() {
    return this.data.range;
  }
  set innerConeAngle(arg) {
    this._setValue('innerConeAngle', arg, function (newValue, oldValue) {
      this.light.innerConeAngle = newValue;
    });
  }
  get innerConeAngle() {
    return this.data.innerConeAngle;
  }
  set outerConeAngle(arg) {
    this._setValue('outerConeAngle', arg, function (newValue, oldValue) {
      this.light.outerConeAngle = newValue;
    });
  }
  get outerConeAngle() {
    return this.data.outerConeAngle;
  }
  set falloffMode(arg) {
    this._setValue('falloffMode', arg, function (newValue, oldValue) {
      this.light.falloffMode = newValue;
    });
  }
  get falloffMode() {
    return this.data.falloffMode;
  }
  set shadowType(arg) {
    this._setValue('shadowType', arg, function (newValue, oldValue) {
      this.light.shadowType = newValue;
    });
  }
  get shadowType() {
    return this.data.shadowType;
  }
  set vsmBlurSize(arg) {
    this._setValue('vsmBlurSize', arg, function (newValue, oldValue) {
      this.light.vsmBlurSize = newValue;
    });
  }
  get vsmBlurSize() {
    return this.data.vsmBlurSize;
  }
  set vsmBlurMode(arg) {
    this._setValue('vsmBlurMode', arg, function (newValue, oldValue) {
      this.light.vsmBlurMode = newValue;
    });
  }
  get vsmBlurMode() {
    return this.data.vsmBlurMode;
  }
  set vsmBias(arg) {
    this._setValue('vsmBias', arg, function (newValue, oldValue) {
      this.light.vsmBias = math.clamp(newValue, 0, 1);
    });
  }
  get vsmBias() {
    return this.data.vsmBias;
  }
  set cookieAsset(arg) {
    this._setValue('cookieAsset', arg, function (newValue, oldValue) {
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
  }
  get cookieAsset() {
    return this.data.cookieAsset;
  }
  set cookie(arg) {
    this._setValue('cookie', arg, function (newValue, oldValue) {
      this.light.cookie = newValue;
    });
  }
  get cookie() {
    return this.data.cookie;
  }
  set cookieIntensity(arg) {
    this._setValue('cookieIntensity', arg, function (newValue, oldValue) {
      this.light.cookieIntensity = math.clamp(newValue, 0, 1);
    });
  }
  get cookieIntensity() {
    return this.data.cookieIntensity;
  }
  set cookieFalloff(arg) {
    this._setValue('cookieFalloff', arg, function (newValue, oldValue) {
      this.light.cookieFalloff = newValue;
    });
  }
  get cookieFalloff() {
    return this.data.cookieFalloff;
  }
  set cookieChannel(arg) {
    this._setValue('cookieChannel', arg, function (newValue, oldValue) {
      this.light.cookieChannel = newValue;
    });
  }
  get cookieChannel() {
    return this.data.cookieChannel;
  }
  set cookieAngle(arg) {
    this._setValue('cookieAngle', arg, function (newValue, oldValue) {
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
  }
  get cookieAngle() {
    return this.data.cookieAngle;
  }
  set cookieScale(arg) {
    this._setValue('cookieScale', arg, function (newValue, oldValue) {
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
  }
  get cookieScale() {
    return this.data.cookieScale;
  }
  set cookieOffset(arg) {
    this._setValue('cookieOffset', arg, function (newValue, oldValue) {
      this.light.cookieOffset = newValue;
    }, true);
  }
  get cookieOffset() {
    return this.data.cookieOffset;
  }
  set shadowUpdateMode(arg) {
    this._setValue('shadowUpdateMode', arg, function (newValue, oldValue) {
      this.light.shadowUpdateMode = newValue;
    }, true);
  }
  get shadowUpdateMode() {
    return this.data.shadowUpdateMode;
  }
  set mask(arg) {
    this._setValue('mask', arg, function (newValue, oldValue) {
      this.light.mask = newValue;
    });
  }
  get mask() {
    return this.data.mask;
  }
  set affectDynamic(arg) {
    this._setValue('affectDynamic', arg, function (newValue, oldValue) {
      if (newValue) {
        this.light.mask |= MASK_AFFECT_DYNAMIC;
      } else {
        this.light.mask &= ~MASK_AFFECT_DYNAMIC;
      }
      this.light.layersDirty();
    });
  }
  get affectDynamic() {
    return this.data.affectDynamic;
  }
  set affectLightmapped(arg) {
    this._setValue('affectLightmapped', arg, function (newValue, oldValue) {
      if (newValue) {
        this.light.mask |= MASK_AFFECT_LIGHTMAPPED;
        if (this.bake) this.light.mask &= ~MASK_BAKE;
      } else {
        this.light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
        if (this.bake) this.light.mask |= MASK_BAKE;
      }
    });
  }
  get affectLightmapped() {
    return this.data.affectLightmapped;
  }
  set bake(arg) {
    this._setValue('bake', arg, function (newValue, oldValue) {
      if (newValue) {
        this.light.mask |= MASK_BAKE;
        if (this.affectLightmapped) this.light.mask &= ~MASK_AFFECT_LIGHTMAPPED;
      } else {
        this.light.mask &= ~MASK_BAKE;
        if (this.affectLightmapped) this.light.mask |= MASK_AFFECT_LIGHTMAPPED;
      }
      this.light.layersDirty();
    });
  }
  get bake() {
    return this.data.bake;
  }
  set bakeDir(arg) {
    this._setValue('bakeDir', arg, function (newValue, oldValue) {
      this.light.bakeDir = newValue;
    });
  }
  get bakeDir() {
    return this.data.bakeDir;
  }
  set isStatic(arg) {
    this._setValue('isStatic', arg, function (newValue, oldValue) {
      this.light.isStatic = newValue;
    });
  }
  get isStatic() {
    return this.data.isStatic;
  }
  set layers(arg) {
    this._setValue('layers', arg, function (newValue, oldValue) {
      for (let i = 0; i < oldValue.length; i++) {
        const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
        if (!layer) continue;
        layer.removeLight(this);
        this.light.removeLayer(layer);
      }
      for (let i = 0; i < newValue.length; i++) {
        const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
        if (!layer) continue;
        if (this.enabled && this.entity.enabled) {
          layer.addLight(this);
          this.light.addLayer(layer);
        }
      }
    });
  }
  get layers() {
    return this.data.layers;
  }
  set shadowUpdateOverrides(values) {
    this.light.shadowUpdateOverrides = values;
  }
  get shadowUpdateOverrides() {
    return this.light.shadowUpdateOverrides;
  }
  set penumbraSize(value) {
    this.light.penumbraSize = value;
  }
  get penumbraSize() {
    return this.light.penumbraSize;
  }
  _setValue(name, value, setFunc, skipEqualsCheck) {
    const data = this.data;
    const oldValue = data[name];
    if (!skipEqualsCheck && oldValue === value) return;
    data[name] = value;
    if (setFunc) setFunc.call(this, value, oldValue);
  }
  addLightToLayers() {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (layer) {
        layer.addLight(this);
        this.light.addLayer(layer);
      }
    }
  }
  removeLightFromLayers() {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (layer) {
        layer.removeLight(this);
        this.light.removeLayer(layer);
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
      this.light.addLayer(layer);
    }
  }
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index >= 0) {
      layer.removeLight(this);
      this.light.removeLayer(layer);
    }
  }
  refreshProperties() {
    for (let i = 0; i < properties.length; i++) {
      const name = properties[i];
      this[name] = this[name];
    }
    if (this.enabled && this.entity.enabled) {
      this.onEnable();
    }
  }
  onCookieAssetSet() {
    let forceLoad = false;
    if (this._cookieAsset.type === 'cubemap' && !this._cookieAsset.loadFaces) {
      this._cookieAsset.loadFaces = true;
      forceLoad = true;
    }
    if (!this._cookieAsset.resource || forceLoad) this.system.app.assets.load(this._cookieAsset);
    if (this._cookieAsset.resource) {
      this.onCookieAssetLoad();
    }
  }
  onCookieAssetAdd(asset) {
    if (this._cookieAssetId !== asset.id) return;
    this._cookieAsset = asset;
    if (this.light.enabled) {
      this.onCookieAssetSet();
    }
    this._cookieAsset.on('load', this.onCookieAssetLoad, this);
    this._cookieAsset.on('remove', this.onCookieAssetRemove, this);
  }
  onCookieAssetLoad() {
    if (!this._cookieAsset || !this._cookieAsset.resource) {
      return;
    }
    this.cookie = this._cookieAsset.resource;
  }
  onCookieAssetRemove() {
    if (!this._cookieAssetId) {
      return;
    }
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
    if (this._cookieAsset && !this.cookie) {
      this.onCookieAssetSet();
    }
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
}

export { LightComponent };
