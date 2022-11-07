/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
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
  updateShadow() {
    this.light.updateShadow();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIExJR0hURkFMTE9GRl9MSU5FQVIsXG4gICAgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQsIE1BU0tfQUZGRUNUX0RZTkFNSUMsIE1BU0tfQkFLRSxcbiAgICBTSEFET1dfUENGMyxcbiAgICBTSEFET1dVUERBVEVfUkVBTFRJTUVcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcycpLlZlYzJ9IFZlYzIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuTGlnaHRDb21wb25lbnRTeXN0ZW19IExpZ2h0Q29tcG9uZW50U3lzdGVtICovXG5cbmNvbnN0IF9saWdodFByb3BzID0gW107XG5jb25zdCBfbGlnaHRQcm9wc0RlZmF1bHQgPSBbXTtcblxuLyoqXG4gKiBUaGUgTGlnaHQgQ29tcG9uZW50IGVuYWJsZXMgdGhlIEVudGl0eSB0byBsaWdodCB0aGUgc2NlbmUuIFRoZXJlIGFyZSB0aHJlZSB0eXBlcyBvZiBsaWdodDpcbiAqIGRpcmVjdGlvbmFsLCBvbW5pIGFuZCBzcG90LiBEaXJlY3Rpb25hbCBsaWdodHMgYXJlIGdsb2JhbCBpbiB0aGF0IHRoZXkgYXJlIGNvbnNpZGVyZWQgdG8gYmVcbiAqIGluZmluaXRlbHkgZmFyIGF3YXkgYW5kIGxpZ2h0IHRoZSBlbnRpcmUgc2NlbmUuIE9tbmkgYW5kIHNwb3QgbGlnaHRzIGFyZSBsb2NhbCBpbiB0aGF0IHRoZXkgaGF2ZVxuICogYSBwb3NpdGlvbiBhbmQgYSByYW5nZS4gQSBzcG90IGxpZ2h0IGlzIGEgc3BlY2lhbGl6YXRpb24gb2YgYW4gb21uaSBsaWdodCB3aGVyZSBsaWdodCBpcyBlbWl0dGVkXG4gKiBpbiBhIGNvbmUgcmF0aGVyIHRoYW4gaW4gYWxsIGRpcmVjdGlvbnMuIExpZ2h0cyBhbHNvIGhhdmUgdGhlIGFiaWxpdHkgdG8gY2FzdCBzaGFkb3dzIHRvIGFkZFxuICogcmVhbGlzbSB0byB5b3VyIHNjZW5lcy5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBBZGQgYSBwYy5MaWdodENvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdsaWdodCcsIHtcbiAqICAgICB0eXBlOiBcIm9tbmlcIixcbiAqICAgICBjb2xvcjogbmV3IHBjLkNvbG9yKDEsIDAsIDApLFxuICogICAgIHJhbmdlOiAxMFxuICogfSk7XG4gKlxuICogLy8gR2V0IHRoZSBwYy5MaWdodENvbXBvbmVudCBvbiBhbiBlbnRpdHlcbiAqIHZhciBsaWdodENvbXBvbmVudCA9IGVudGl0eS5saWdodDtcbiAqXG4gKiAvLyBVcGRhdGUgYSBwcm9wZXJ0eSBvbiBhIGxpZ2h0IGNvbXBvbmVudFxuICogZW50aXR5LmxpZ2h0LnJhbmdlID0gMjA7XG4gKiBgYGBcbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdHlwZSBUaGUgdHlwZSBvZiBsaWdodC4gQ2FuIGJlOlxuICpcbiAqIC0gXCJkaXJlY3Rpb25hbFwiOiBBIGxpZ2h0IHRoYXQgaXMgaW5maW5pdGVseSBmYXIgYXdheSBhbmQgbGlnaHRzIHRoZSBlbnRpcmUgc2NlbmUgZnJvbSBvbmVcbiAqIGRpcmVjdGlvbi5cbiAqIC0gXCJvbW5pXCI6IEFuIG9tbmktZGlyZWN0aW9uYWwgbGlnaHQgdGhhdCBpbGx1bWluYXRlcyBpbiBhbGwgZGlyZWN0aW9ucyBmcm9tIHRoZSBsaWdodCBzb3VyY2UuXG4gKiAtIFwic3BvdFwiOiBBbiBvbW5pLWRpcmVjdGlvbmFsIGxpZ2h0IGJ1dCBpcyBib3VuZGVkIGJ5IGEgY29uZS5cbiAqXG4gKiBEZWZhdWx0cyB0byBcImRpcmVjdGlvbmFsXCIuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBjb2xvciBUaGUgQ29sb3Igb2YgdGhlIGxpZ2h0LiBUaGUgYWxwaGEgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpcyBpZ25vcmVkLlxuICogRGVmYXVsdHMgdG8gd2hpdGUgKDEsIDEsIDEpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGludGVuc2l0eSBUaGUgYnJpZ2h0bmVzcyBvZiB0aGUgbGlnaHQuIERlZmF1bHRzIHRvIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbHVtaW5hbmNlIFRoZSBwaHlzaWNhbGx5IGJhc2VkIGx1bWluYW5jZS4gT25seSB1c2VkIGlmIHNjZW5lLnBoeXNpY2FsVW5pdHMgaXMgdHJ1ZS4gRGVmYXVsdHMgdG8gMC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFwZSBUaGUgbGlnaHQgc291cmNlIHNoYXBlLiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgcGMuTElHSFRTSEFQRV9QVU5DVFVBTH06IEluZmluaXRlc2ltYWxseSBzbWFsbCBwb2ludC5cbiAqIC0ge0BsaW5rIHBjLkxJR0hUU0hBUEVfUkVDVH06IFJlY3RhbmdsZSBzaGFwZS5cbiAqIC0ge0BsaW5rIHBjLkxJR0hUU0hBUEVfRElTS306IERpc2sgc2hhcGUuXG4gKiAtIHtAbGluayBwYy5MSUdIVFNIQVBFX1NQSEVSRX06IFNwaGVyZSBzaGFwZS5cbiAqXG4gKiBEZWZhdWx0cyB0byBwYy5MSUdIVFNIQVBFX1BVTkNUVUFMLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjYXN0U2hhZG93cyBJZiBlbmFibGVkIHRoZSBsaWdodCB3aWxsIGNhc3Qgc2hhZG93cy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93RGlzdGFuY2UgVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCBiZXlvbmQgd2hpY2ggc2hhZG93cyBhcmUgbm9cbiAqIGxvbmdlciByZW5kZXJlZC4gQWZmZWN0cyBkaXJlY3Rpb25hbCBsaWdodHMgb25seS4gRGVmYXVsdHMgdG8gNDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93SW50ZW5zaXR5IFRoZSBpbnRlbnNpdHkgb2YgdGhlIHNoYWRvdyBkYXJrZW5pbmcsIDEgYmVpbmcgc2hhZG93cyBhcmUgZW50aXJlbHkgYmxhY2suXG4gKiBEZWZhdWx0cyB0byAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRvd1Jlc29sdXRpb24gVGhlIHNpemUgb2YgdGhlIHRleHR1cmUgdXNlZCBmb3IgdGhlIHNoYWRvdyBtYXAuIFZhbGlkIHNpemVzXG4gKiBhcmUgNjQsIDEyOCwgMjU2LCA1MTIsIDEwMjQsIDIwNDguIERlZmF1bHRzIHRvIDEwMjQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93QmlhcyBUaGUgZGVwdGggYmlhcyBmb3IgdHVuaW5nIHRoZSBhcHBlYXJhbmNlIG9mIHRoZSBzaGFkb3cgbWFwcGluZ1xuICogZ2VuZXJhdGVkIGJ5IHRoaXMgbGlnaHQuIFZhbGlkIHJhbmdlIGlzIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC4wNS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBudW1DYXNjYWRlcyBOdW1iZXIgb2Ygc2hhZG93IGNhc2NhZGVzLiBDYW4gYmUgMSwgMiwgMyBvciA0LiBEZWZhdWx0cyB0byAxLFxuICogcmVwcmVzZW50aW5nIG5vIGNhc2NhZGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNhc2NhZGVEaXN0cmlidXRpb24gVGhlIGRpc3RyaWJ1dGlvbiBvZiBzdWJkaXZpc2lvbiBvZiB0aGUgY2FtZXJhIGZydXN0dW0gZm9yXG4gKiBpbmRpdmlkdWFsIHNoYWRvdyBjYXNjYWRlcy4gT25seSB1c2VkIGlmIHtAbGluayBMaWdodENvbXBvbmVudCNudW1DYXNjYWRlc30gaXMgbGFyZ2VyIHRoYW4gMS5cbiAqIENhbiBiZSBhIHZhbHVlIGluIHJhbmdlIG9mIDAgYW5kIDEuIFZhbHVlIG9mIDAgcmVwcmVzZW50cyBhIGxpbmVhciBkaXN0cmlidXRpb24sIHZhbHVlIG9mIDFcbiAqIHJlcHJlc2VudHMgYSBsb2dhcml0aG1pYyBkaXN0cmlidXRpb24uIERlZmF1bHRzIHRvIDAuNS4gTGFyZ2VyIHZhbHVlIGluY3JlYXNlcyB0aGUgcmVzb2x1dGlvbiBvZlxuICogdGhlIHNoYWRvd3MgaW4gdGhlIG5lYXIgZGlzdGFuY2UuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbm9ybWFsT2Zmc2V0QmlhcyBOb3JtYWwgb2Zmc2V0IGRlcHRoIGJpYXMuIFZhbGlkIHJhbmdlIGlzIDAgdG8gMS4gRGVmYXVsdHMgdG9cbiAqIDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmFuZ2UgVGhlIHJhbmdlIG9mIHRoZSBsaWdodC4gQWZmZWN0cyBvbW5pIGFuZCBzcG90IGxpZ2h0cyBvbmx5LiBEZWZhdWx0cyB0b1xuICogMTAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gaW5uZXJDb25lQW5nbGUgVGhlIGFuZ2xlIGF0IHdoaWNoIHRoZSBzcG90bGlnaHQgY29uZSBzdGFydHMgdG8gZmFkZSBvZmYuIFRoZVxuICogYW5nbGUgaXMgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIEFmZmVjdHMgc3BvdCBsaWdodHMgb25seS4gRGVmYXVsdHMgdG8gNDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3V0ZXJDb25lQW5nbGUgVGhlIGFuZ2xlIGF0IHdoaWNoIHRoZSBzcG90bGlnaHQgY29uZSBoYXMgZmFkZWQgdG8gbm90aGluZy5cbiAqIFRoZSBhbmdsZSBpcyBzcGVjaWZpZWQgaW4gZGVncmVlcy4gQWZmZWN0cyBzcG90IGxpZ2h0cyBvbmx5LiBEZWZhdWx0cyB0byA0NS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmYWxsb2ZmTW9kZSBDb250cm9scyB0aGUgcmF0ZSBhdCB3aGljaCBhIGxpZ2h0IGF0dGVudWF0ZXMgZnJvbSBpdHMgcG9zaXRpb24uXG4gKiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgTElHSFRGQUxMT0ZGX0xJTkVBUn06IExpbmVhci5cbiAqIC0ge0BsaW5rIExJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRH06IEludmVyc2Ugc3F1YXJlZC5cbiAqXG4gKiBBZmZlY3RzIG9tbmkgYW5kIHNwb3QgbGlnaHRzIG9ubHkuIERlZmF1bHRzIHRvIHtAbGluayBMSUdIVEZBTExPRkZfTElORUFSfS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXNrIERlZmluZXMgYSBtYXNrIHRvIGRldGVybWluZSB3aGljaCB7QGxpbmsgTWVzaEluc3RhbmNlfXMgYXJlIGxpdCBieSB0aGlzXG4gKiBsaWdodC4gRGVmYXVsdHMgdG8gMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYWZmZWN0RHluYW1pYyBJZiBlbmFibGVkIHRoZSBsaWdodCB3aWxsIGFmZmVjdCBub24tbGlnaHRtYXBwZWQgb2JqZWN0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYWZmZWN0TGlnaHRtYXBwZWQgSWYgZW5hYmxlZCB0aGUgbGlnaHQgd2lsbCBhZmZlY3QgbGlnaHRtYXBwZWQgb2JqZWN0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYmFrZSBJZiBlbmFibGVkIHRoZSBsaWdodCB3aWxsIGJlIHJlbmRlcmVkIGludG8gbGlnaHRtYXBzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJha2VOdW1TYW1wbGVzIElmIGJha2UgaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBzYW1wbGVzIHVzZWQgdG9cbiAqIGJha2UgdGhpcyBsaWdodCBpbnRvIHRoZSBsaWdodG1hcC4gRGVmYXVsdHMgdG8gMS4gTWF4aW11bSB2YWx1ZSBpcyAyNTUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYmFrZUFyZWEgSWYgYmFrZSBpcyB0cnVlIGFuZCB0aGUgbGlnaHQgdHlwZSBpcyB7QGxpbmsgTElHSFRUWVBFX0RJUkVDVElPTkFMfSxcbiAqIHRoaXMgc3BlY2lmaWVzIHRoZSBwZW51bWJyYSBhbmdsZSBpbiBkZWdyZWVzLCBhbGxvd2luZyBhIHNvZnQgc2hhZG93IGJvdW5kYXJ5LiBEZWZhdWx0cyB0byAwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBiYWtlRGlyIElmIGVuYWJsZWQgYW5kIGJha2U9dHJ1ZSwgdGhlIGxpZ2h0J3MgZGlyZWN0aW9uIHdpbGwgY29udHJpYnV0ZSB0b1xuICogZGlyZWN0aW9uYWwgbGlnaHRtYXBzLiBCZSBhd2FyZSwgdGhhdCBkaXJlY3Rpb25hbCBsaWdodG1hcCBpcyBhbiBhcHByb3hpbWF0aW9uIGFuZCBjYW4gb25seSBob2xkXG4gKiBzaW5nbGUgZGlyZWN0aW9uIHBlciBwaXhlbC4gSW50ZXJzZWN0aW5nIG11bHRpcGxlIGxpZ2h0cyB3aXRoIGJha2VEaXI9dHJ1ZSBtYXkgbGVhZCB0byBpbmNvcnJlY3RcbiAqIGxvb2sgb2Ygc3BlY3VsYXIvYnVtcC1tYXBwaW5nIGluIHRoZSBhcmVhIG9mIGludGVyc2VjdGlvbi4gVGhlIGVycm9yIGlzIG5vdCBhbHdheXMgdmlzaWJsZVxuICogdGhvdWdoLCBhbmQgaGlnaGx5IHNjZW5lLWRlcGVuZGVudC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFkb3dVcGRhdGVNb2RlIFRlbGxzIHRoZSByZW5kZXJlciBob3cgb2Z0ZW4gc2hhZG93cyBtdXN0IGJlIHVwZGF0ZWQgZm9yXG4gKiB0aGlzIGxpZ2h0LiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgU0hBRE9XVVBEQVRFX05PTkV9OiBEb24ndCByZW5kZXIgc2hhZG93cy5cbiAqIC0ge0BsaW5rIFNIQURPV1VQREFURV9USElTRlJBTUV9OiBSZW5kZXIgc2hhZG93cyBvbmx5IG9uY2UgKHRoZW4gYXV0b21hdGljYWxseSBzd2l0Y2hlcyB0b1xuICoge0BsaW5rIFNIQURPV1VQREFURV9OT05FfS5cbiAqIC0ge0BsaW5rIFNIQURPV1VQREFURV9SRUFMVElNRX06IFJlbmRlciBzaGFkb3dzIGV2ZXJ5IGZyYW1lIChkZWZhdWx0KS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFkb3dUeXBlIFR5cGUgb2Ygc2hhZG93cyBiZWluZyByZW5kZXJlZCBieSB0aGlzIGxpZ2h0LiBPcHRpb25zOlxuICpcbiAqIC0ge0BsaW5rIFNIQURPV19QQ0YzfTogUmVuZGVyIGRlcHRoIChjb2xvci1wYWNrZWQgb24gV2ViR0wgMS4wKSwgY2FuIGJlIHVzZWQgZm9yIFBDRiAzeDNcbiAqIHNhbXBsaW5nLlxuICogLSB7QGxpbmsgU0hBRE9XX1ZTTTh9OiBSZW5kZXIgcGFja2VkIHZhcmlhbmNlIHNoYWRvdyBtYXAuIEFsbCBzaGFkb3cgcmVjZWl2ZXJzIG11c3QgYWxzbyBjYXN0XG4gKiBzaGFkb3dzIGZvciB0aGlzIG1vZGUgdG8gd29yayBjb3JyZWN0bHkuXG4gKiAtIHtAbGluayBTSEFET1dfVlNNMTZ9OiBSZW5kZXIgMTYtYml0IGV4cG9uZW50aWFsIHZhcmlhbmNlIHNoYWRvdyBtYXAuIFJlcXVpcmVzXG4gKiBPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0IGV4dGVuc2lvbi4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1ZTTTh9LCBpZiBub3Qgc3VwcG9ydGVkLlxuICogLSB7QGxpbmsgU0hBRE9XX1ZTTTMyfTogUmVuZGVyIDMyLWJpdCBleHBvbmVudGlhbCB2YXJpYW5jZSBzaGFkb3cgbWFwLiBSZXF1aXJlc1xuICogT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfVlNNMTZ9LCBpZiBub3Qgc3VwcG9ydGVkLlxuICogLSB7QGxpbmsgU0hBRE9XX1BDRjV9OiBSZW5kZXIgZGVwdGggYnVmZmVyIG9ubHksIGNhbiBiZSB1c2VkIGZvciBoYXJkd2FyZS1hY2NlbGVyYXRlZCBQQ0YgNXg1XG4gKiBzYW1wbGluZy4gUmVxdWlyZXMgV2ViR0wyLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfUENGM30gb24gV2ViR0wgMS4wLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHZzbUJsdXJNb2RlIEJsdXJyaW5nIG1vZGUgZm9yIHZhcmlhbmNlIHNoYWRvdyBtYXBzLiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgQkxVUl9CT1h9OiBCb3ggZmlsdGVyLlxuICogLSB7QGxpbmsgQkxVUl9HQVVTU0lBTn06IEdhdXNzaWFuIGZpbHRlci4gTWF5IGxvb2sgc21vb3RoZXIgdGhhbiBib3gsIGJ1dCByZXF1aXJlcyBtb3JlIHNhbXBsZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdnNtQmx1clNpemUgTnVtYmVyIG9mIHNhbXBsZXMgdXNlZCBmb3IgYmx1cnJpbmcgYSB2YXJpYW5jZSBzaGFkb3cgbWFwLiBPbmx5XG4gKiB1bmV2ZW4gbnVtYmVycyB3b3JrLCBldmVuIGFyZSBpbmNyZW1lbnRlZC4gTWluaW11bSB2YWx1ZSBpcyAxLCBtYXhpbXVtIGlzIDI1LiBEZWZhdWx0cyB0byAxMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb29raWVBc3NldCBBc3NldCB0aGF0IGhhcyB0ZXh0dXJlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0byBjb29raWUgaW50ZXJuYWxseVxuICogb25jZSBhc3NldCByZXNvdXJjZSBpcyBhdmFpbGFibGUuXG4gKiBAcHJvcGVydHkge1RleHR1cmV9IGNvb2tpZSBQcm9qZWN0aW9uIHRleHR1cmUuIE11c3QgYmUgMkQgZm9yIHNwb3QgYW5kIGN1YmVtYXAgZm9yIG9tbmkgbGlnaHRcbiAqIChpZ25vcmVkIGlmIGluY29ycmVjdCB0eXBlIGlzIHVzZWQpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNvb2tpZUludGVuc2l0eSBQcm9qZWN0aW9uIHRleHR1cmUgaW50ZW5zaXR5IChkZWZhdWx0IGlzIDEpLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjb29raWVGYWxsb2ZmIFRvZ2dsZSBub3JtYWwgc3BvdGxpZ2h0IGZhbGxvZmYgd2hlbiBwcm9qZWN0aW9uIHRleHR1cmUgaXNcbiAqIHVzZWQuIFdoZW4gc2V0IHRvIGZhbHNlLCBzcG90bGlnaHQgd2lsbCB3b3JrIGxpa2UgYSBwdXJlIHRleHR1cmUgcHJvamVjdG9yIChvbmx5IGZhZGluZyB3aXRoXG4gKiBkaXN0YW5jZSkuIERlZmF1bHQgaXMgZmFsc2UuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY29va2llQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgcHJvamVjdGlvbiB0ZXh0dXJlIHRvIHVzZS4gQ2FuIGJlIFwiclwiLFxuICogXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb29raWVBbmdsZSBBbmdsZSBmb3Igc3BvdGxpZ2h0IGNvb2tpZSByb3RhdGlvbi5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY29va2llU2NhbGUgU3BvdGxpZ2h0IGNvb2tpZSBzY2FsZS5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY29va2llT2Zmc2V0IFNwb3RsaWdodCBjb29raWUgcG9zaXRpb24gb2Zmc2V0LlxuICogQHByb3BlcnR5IHtib29sZWFufSBpc1N0YXRpYyBNYXJrIGxpZ2h0IGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICogQHByb3BlcnR5IHtudW1iZXJbXX0gbGF5ZXJzIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBsaWdodCBzaG91bGRcbiAqIGJlbG9uZy4gRG9uJ3QgcHVzaC9wb3Avc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXQgYSBuZXcgb25lXG4gKiBpbnN0ZWFkLlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBMaWdodENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBMaWdodENvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGlnaHRDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdCBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY29va2llQXNzZXRJZCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0QWRkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeCA9IG51bGw7XG4gICAgfVxuXG4gICAgYWRkTGlnaHRUb0xheWVycygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRMaWdodCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUxpZ2h0RnJvbUxheWVycygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVMaWdodCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodFRvTGF5ZXJzKCk7XG4gICAgICAgIH1cbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgbGF5ZXIuYWRkTGlnaHQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTGlnaHQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWZyZXNoUHJvcGVydGllcygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBfbGlnaHRQcm9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbmFtZSA9IF9saWdodFByb3BzW2ldO1xuXG4gICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHRoaXNbbmFtZV07XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5vbkVuYWJsZSgpO1xuICAgIH1cblxuICAgIHVwZGF0ZVNoYWRvdygpIHtcbiAgICAgICAgdGhpcy5saWdodC51cGRhdGVTaGFkb3coKTtcbiAgICB9XG5cbiAgICBvbkNvb2tpZUFzc2V0U2V0KCkge1xuICAgICAgICBsZXQgZm9yY2VMb2FkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZUFzc2V0LnR5cGUgPT09ICdjdWJlbWFwJyAmJiAhdGhpcy5fY29va2llQXNzZXQubG9hZEZhY2VzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldC5sb2FkRmFjZXMgPSB0cnVlO1xuICAgICAgICAgICAgZm9yY2VMb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fY29va2llQXNzZXQucmVzb3VyY2UgfHwgZm9yY2VMb2FkKVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKHRoaXMuX2Nvb2tpZUFzc2V0KTtcblxuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXQucmVzb3VyY2UpXG4gICAgICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRMb2FkKCk7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldEFkZChhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXRJZCAhPT0gYXNzZXQuaWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llQXNzZXQgPSBhc3NldDtcblxuICAgICAgICBpZiAodGhpcy5saWdodC5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0U2V0KCk7XG5cbiAgICAgICAgdGhpcy5fY29va2llQXNzZXQub24oJ2xvYWQnLCB0aGlzLm9uQ29va2llQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fY29va2llQXNzZXQub24oJ3JlbW92ZScsIHRoaXMub25Db29raWVBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldExvYWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llQXNzZXQgfHwgIXRoaXMuX2Nvb2tpZUFzc2V0LnJlc291cmNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuY29va2llID0gdGhpcy5fY29va2llQXNzZXQucmVzb3VyY2U7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldFJlbW92ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb29raWVBc3NldElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldEFkZCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fY29va2llQXNzZXRJZCwgdGhpcy5vbkNvb2tpZUFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0QWRkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0Lm9mZignbG9hZCcsIHRoaXMub25Db29raWVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQ29va2llQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb29raWUgPSBudWxsO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICB0aGlzLmxpZ2h0LmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmFkZExpZ2h0VG9MYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldCAmJiAhdGhpcy5jb29raWUpXG4gICAgICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRTZXQoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMubGlnaHQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVMaWdodEZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGF5ZXJzXG4gICAgICAgIHRoaXMub25EaXNhYmxlKCk7XG5cbiAgICAgICAgLy8gZGVzdHJveSBsaWdodCBub2RlXG4gICAgICAgIHRoaXMubGlnaHQuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIHJlbW92ZSBjb29raWUgYXNzZXQgZXZlbnRzXG4gICAgICAgIHRoaXMuY29va2llQXNzZXQgPSBudWxsO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BlcnR5KG5hbWUsIGRlZmF1bHRWYWx1ZSwgc2V0RnVuYywgc2tpcEVxdWFsc0NoZWNrKSB7XG4gICAgY29uc3QgYyA9IExpZ2h0Q29tcG9uZW50LnByb3RvdHlwZTtcbiAgICBfbGlnaHRQcm9wcy5wdXNoKG5hbWUpO1xuICAgIF9saWdodFByb3BzRGVmYXVsdC5wdXNoKGRlZmF1bHRWYWx1ZSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYywgbmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRhdGFbbmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSBkYXRhW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFza2lwRXF1YWxzQ2hlY2sgJiYgb2xkVmFsdWUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgICAgICBkYXRhW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICBpZiAoc2V0RnVuYykgc2V0RnVuYy5jYWxsKHRoaXMsIHZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lUHJvcHMoKSB7XG4gICAgX2RlZmluZVByb3BlcnR5KCdlbmFibGVkJywgdHJ1ZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLm9uU2V0RW5hYmxlZChudWxsLCBvbGRWYWx1ZSwgbmV3VmFsdWUpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnbGlnaHQnLCBudWxsKTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3R5cGUnLCAnZGlyZWN0aW9uYWwnLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmNoYW5nZVR5cGUodGhpcywgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcbiAgICAgICAgLy8gcmVmcmVzaCBsaWdodCBwcm9wZXJ0aWVzIGJlY2F1c2UgY2hhbmdpbmcgdGhlIHR5cGUgZG9lcyBub3QgcmVzZXQgdGhlXG4gICAgICAgIC8vIGxpZ2h0IHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5yZWZyZXNoUHJvcGVydGllcygpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29sb3InLCBuZXcgQ29sb3IoMSwgMSwgMSksIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zZXRDb2xvcihuZXdWYWx1ZSk7XG4gICAgfSwgdHJ1ZSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdpbnRlbnNpdHknLCAxLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuaW50ZW5zaXR5ID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdsdW1pbmFuY2UnLCAwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQubHVtaW5hbmNlID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdzaGFwZScsIExJR0hUU0hBUEVfUFVOQ1RVQUwsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFwZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY2FzdFNoYWRvd3MnLCBmYWxzZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNhc3RTaGFkb3dzID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdzaGFkb3dEaXN0YW5jZScsIDQwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93RGlzdGFuY2UgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd0ludGVuc2l0eScsIDEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFkb3dJbnRlbnNpdHkgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd1Jlc29sdXRpb24nLCAxMDI0LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93UmVzb2x1dGlvbiA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93QmlhcycsIDAuMDUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFkb3dCaWFzID0gLTAuMDEgKiBtYXRoLmNsYW1wKG5ld1ZhbHVlLCAwLCAxKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ251bUNhc2NhZGVzJywgMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0Lm51bUNhc2NhZGVzID0gbWF0aC5jbGFtcChNYXRoLmZsb29yKG5ld1ZhbHVlKSwgMSwgNCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdiYWtlTnVtU2FtcGxlcycsIDEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5iYWtlTnVtU2FtcGxlcyA9IG1hdGguY2xhbXAoTWF0aC5mbG9vcihuZXdWYWx1ZSksIDEsIDI1NSk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdiYWtlQXJlYScsIDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5iYWtlQXJlYSA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDE4MCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdjYXNjYWRlRGlzdHJpYnV0aW9uJywgMC41LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnbm9ybWFsT2Zmc2V0QmlhcycsIDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5ub3JtYWxPZmZzZXRCaWFzID0gbWF0aC5jbGFtcChuZXdWYWx1ZSwgMCwgMSk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdyYW5nZScsIDEwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuYXR0ZW51YXRpb25FbmQgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJywgNDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5pbm5lckNvbmVBbmdsZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnLCA0NSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0Lm91dGVyQ29uZUFuZ2xlID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdmYWxsb2ZmTW9kZScsIExJR0hURkFMTE9GRl9MSU5FQVIsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5mYWxsb2ZmTW9kZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93VHlwZScsIFNIQURPV19QQ0YzLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93VHlwZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgndnNtQmx1clNpemUnLCAxMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnZzbUJsdXJTaXplID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCd2c21CbHVyTW9kZScsIEJMVVJfR0FVU1NJQU4sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC52c21CbHVyTW9kZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgndnNtQmlhcycsIDAuMDEgKiAwLjI1LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQudnNtQmlhcyA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llQXNzZXQnLCBudWxsLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldElkICYmICgobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCAmJiBuZXdWYWx1ZS5pZCA9PT0gdGhpcy5fY29va2llQXNzZXRJZCkgfHwgbmV3VmFsdWUgPT09IHRoaXMuX2Nvb2tpZUFzc2V0SWQpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMub25Db29raWVBc3NldFJlbW92ZSgpO1xuICAgICAgICB0aGlzLl9jb29raWVBc3NldElkID0gbnVsbDtcblxuICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5kYXRhLmNvb2tpZUFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldElkID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRBZGQobmV3VmFsdWUpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuZXdWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0SWQgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0QWRkKGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXRBZGQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub24oJ2FkZDonICsgdGhpcy5fY29va2llQXNzZXRJZCwgdGhpcy5vbkNvb2tpZUFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llJywgbnVsbCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llSW50ZW5zaXR5JywgMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZUludGVuc2l0eSA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llRmFsbG9mZicsIHRydWUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWVGYWxsb2ZmID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdjb29raWVDaGFubmVsJywgJ3JnYicsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWVDaGFubmVsID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdjb29raWVBbmdsZScsIDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSAwIHx8IHRoaXMuY29va2llU2NhbGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fY29va2llTWF0cml4KSB0aGlzLl9jb29raWVNYXRyaXggPSBuZXcgVmVjNCgpO1xuICAgICAgICAgICAgbGV0IHNjeCA9IDE7XG4gICAgICAgICAgICBsZXQgc2N5ID0gMTtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvb2tpZVNjYWxlKSB7XG4gICAgICAgICAgICAgICAgc2N4ID0gdGhpcy5jb29raWVTY2FsZS54O1xuICAgICAgICAgICAgICAgIHNjeSA9IHRoaXMuY29va2llU2NhbGUueTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGMgPSBNYXRoLmNvcyhuZXdWYWx1ZSAqIG1hdGguREVHX1RPX1JBRCk7XG4gICAgICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4obmV3VmFsdWUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llTWF0cml4LnNldChjIC8gc2N4LCAtcyAvIHNjeCwgcyAvIHNjeSwgYyAvIHNjeSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZVRyYW5zZm9ybSA9IHRoaXMuX2Nvb2tpZU1hdHJpeDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQuY29va2llVHJhbnNmb3JtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llU2NhbGUnLCBudWxsLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gbnVsbCB8fCB0aGlzLmNvb2tpZUFuZ2xlICE9PSAwKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2Nvb2tpZU1hdHJpeCkgdGhpcy5fY29va2llTWF0cml4ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgICAgIGNvbnN0IHNjeCA9IG5ld1ZhbHVlLng7XG4gICAgICAgICAgICBjb25zdCBzY3kgPSBuZXdWYWx1ZS55O1xuICAgICAgICAgICAgY29uc3QgYyA9IE1hdGguY29zKHRoaXMuY29va2llQW5nbGUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgY29uc3QgcyA9IE1hdGguc2luKHRoaXMuY29va2llQW5nbGUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llTWF0cml4LnNldChjIC8gc2N4LCAtcyAvIHNjeCwgcyAvIHNjeSwgYyAvIHNjeSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZVRyYW5zZm9ybSA9IHRoaXMuX2Nvb2tpZU1hdHJpeDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQuY29va2llVHJhbnNmb3JtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sIHRydWUpO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llT2Zmc2V0JywgbnVsbCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZU9mZnNldCA9IG5ld1ZhbHVlO1xuICAgIH0sIHRydWUpO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93VXBkYXRlTW9kZScsIFNIQURPV1VQREFURV9SRUFMVElNRSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBuZXdWYWx1ZTtcbiAgICB9LCB0cnVlKTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ21hc2snLCAxLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQubWFzayA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYWZmZWN0RHluYW1pYycsIHRydWUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Lm1hc2sgfD0gTUFTS19BRkZFQ1RfRFlOQU1JQztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQubWFzayAmPSB+TUFTS19BRkZFQ1RfRFlOQU1JQztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpZ2h0LmxheWVyc0RpcnR5KCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdhZmZlY3RMaWdodG1hcHBlZCcsIGZhbHNlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmFrZSkgdGhpcy5saWdodC5tYXNrICY9IH5NQVNLX0JBS0U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Lm1hc2sgJj0gfk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmFrZSkgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQkFLRTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYmFrZScsIGZhbHNlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQkFLRTtcbiAgICAgICAgICAgIGlmICh0aGlzLmFmZmVjdExpZ2h0bWFwcGVkKSB0aGlzLmxpZ2h0Lm1hc2sgJj0gfk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrICY9IH5NQVNLX0JBS0U7XG4gICAgICAgICAgICBpZiAodGhpcy5hZmZlY3RMaWdodG1hcHBlZCkgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubGlnaHQubGF5ZXJzRGlydHkoKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Jha2VEaXInLCB0cnVlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuYmFrZURpciA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnaXNTdGF0aWMnLCBmYWxzZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmlzU3RhdGljID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdsYXllcnMnLCBbTEFZRVJJRF9XT1JMRF0sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChvbGRWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZUxpZ2h0KHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3VmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobmV3VmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRMaWdodCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5fZGVmaW5lUHJvcHMoKTtcblxuZXhwb3J0IHsgX2xpZ2h0UHJvcHMsIF9saWdodFByb3BzRGVmYXVsdCwgTGlnaHRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJfbGlnaHRQcm9wcyIsIl9saWdodFByb3BzRGVmYXVsdCIsIkxpZ2h0Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfY29va2llQXNzZXQiLCJfY29va2llQXNzZXRJZCIsIl9jb29raWVBc3NldEFkZCIsIl9jb29raWVNYXRyaXgiLCJhZGRMaWdodFRvTGF5ZXJzIiwiaSIsImxheWVycyIsImxlbmd0aCIsImxheWVyIiwiYXBwIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJhZGRMaWdodCIsInJlbW92ZUxpZ2h0RnJvbUxheWVycyIsInJlbW92ZUxpZ2h0Iiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJlbmFibGVkIiwib2ZmIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJvbiIsImluZGV4IiwiaW5kZXhPZiIsImlkIiwicmVmcmVzaFByb3BlcnRpZXMiLCJuYW1lIiwib25FbmFibGUiLCJ1cGRhdGVTaGFkb3ciLCJsaWdodCIsIm9uQ29va2llQXNzZXRTZXQiLCJmb3JjZUxvYWQiLCJ0eXBlIiwibG9hZEZhY2VzIiwicmVzb3VyY2UiLCJhc3NldHMiLCJsb2FkIiwib25Db29raWVBc3NldExvYWQiLCJvbkNvb2tpZUFzc2V0QWRkIiwiYXNzZXQiLCJvbkNvb2tpZUFzc2V0UmVtb3ZlIiwiY29va2llIiwib25EaXNhYmxlIiwib25SZW1vdmUiLCJkZXN0cm95IiwiY29va2llQXNzZXQiLCJfZGVmaW5lUHJvcGVydHkiLCJkZWZhdWx0VmFsdWUiLCJzZXRGdW5jIiwic2tpcEVxdWFsc0NoZWNrIiwiYyIsInByb3RvdHlwZSIsInB1c2giLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsImRhdGEiLCJzZXQiLCJ2YWx1ZSIsIm9sZFZhbHVlIiwiY2FsbCIsImNvbmZpZ3VyYWJsZSIsIl9kZWZpbmVQcm9wcyIsIm5ld1ZhbHVlIiwib25TZXRFbmFibGVkIiwiY2hhbmdlVHlwZSIsIkNvbG9yIiwic2V0Q29sb3IiLCJpbnRlbnNpdHkiLCJsdW1pbmFuY2UiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwic2hhcGUiLCJjYXN0U2hhZG93cyIsInNoYWRvd0Rpc3RhbmNlIiwic2hhZG93SW50ZW5zaXR5Iiwic2hhZG93UmVzb2x1dGlvbiIsInNoYWRvd0JpYXMiLCJtYXRoIiwiY2xhbXAiLCJudW1DYXNjYWRlcyIsIk1hdGgiLCJmbG9vciIsImJha2VOdW1TYW1wbGVzIiwiYmFrZUFyZWEiLCJjYXNjYWRlRGlzdHJpYnV0aW9uIiwibm9ybWFsT2Zmc2V0QmlhcyIsImF0dGVudWF0aW9uRW5kIiwiaW5uZXJDb25lQW5nbGUiLCJvdXRlckNvbmVBbmdsZSIsIkxJR0hURkFMTE9GRl9MSU5FQVIiLCJmYWxsb2ZmTW9kZSIsIlNIQURPV19QQ0YzIiwic2hhZG93VHlwZSIsInZzbUJsdXJTaXplIiwiQkxVUl9HQVVTU0lBTiIsInZzbUJsdXJNb2RlIiwidnNtQmlhcyIsIkFzc2V0IiwiY29va2llSW50ZW5zaXR5IiwiY29va2llRmFsbG9mZiIsImNvb2tpZUNoYW5uZWwiLCJjb29raWVTY2FsZSIsIlZlYzQiLCJzY3giLCJzY3kiLCJ4IiwieSIsImNvcyIsIkRFR19UT19SQUQiLCJzIiwic2luIiwiY29va2llVHJhbnNmb3JtIiwiY29va2llQW5nbGUiLCJjb29raWVPZmZzZXQiLCJTSEFET1dVUERBVEVfUkVBTFRJTUUiLCJzaGFkb3dVcGRhdGVNb2RlIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJsYXllcnNEaXJ0eSIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiYmFrZSIsIk1BU0tfQkFLRSIsImFmZmVjdExpZ2h0bWFwcGVkIiwiYmFrZURpciIsImlzU3RhdGljIiwiTEFZRVJJRF9XT1JMRCJdLCJtYXBwaW5ncyI6Ijs7Ozs7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
