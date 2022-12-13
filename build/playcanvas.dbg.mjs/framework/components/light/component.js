/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIExJR0hURkFMTE9GRl9MSU5FQVIsXG4gICAgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQsIE1BU0tfQUZGRUNUX0RZTkFNSUMsIE1BU0tfQkFLRSxcbiAgICBTSEFET1dfUENGMyxcbiAgICBTSEFET1dVUERBVEVfUkVBTFRJTUVcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmNvbnN0IF9saWdodFByb3BzID0gW107XG5jb25zdCBfbGlnaHRQcm9wc0RlZmF1bHQgPSBbXTtcblxuLyoqXG4gKiBUaGUgTGlnaHQgQ29tcG9uZW50IGVuYWJsZXMgdGhlIEVudGl0eSB0byBsaWdodCB0aGUgc2NlbmUuIFRoZXJlIGFyZSB0aHJlZSB0eXBlcyBvZiBsaWdodDpcbiAqIGRpcmVjdGlvbmFsLCBvbW5pIGFuZCBzcG90LiBEaXJlY3Rpb25hbCBsaWdodHMgYXJlIGdsb2JhbCBpbiB0aGF0IHRoZXkgYXJlIGNvbnNpZGVyZWQgdG8gYmVcbiAqIGluZmluaXRlbHkgZmFyIGF3YXkgYW5kIGxpZ2h0IHRoZSBlbnRpcmUgc2NlbmUuIE9tbmkgYW5kIHNwb3QgbGlnaHRzIGFyZSBsb2NhbCBpbiB0aGF0IHRoZXkgaGF2ZVxuICogYSBwb3NpdGlvbiBhbmQgYSByYW5nZS4gQSBzcG90IGxpZ2h0IGlzIGEgc3BlY2lhbGl6YXRpb24gb2YgYW4gb21uaSBsaWdodCB3aGVyZSBsaWdodCBpcyBlbWl0dGVkXG4gKiBpbiBhIGNvbmUgcmF0aGVyIHRoYW4gaW4gYWxsIGRpcmVjdGlvbnMuIExpZ2h0cyBhbHNvIGhhdmUgdGhlIGFiaWxpdHkgdG8gY2FzdCBzaGFkb3dzIHRvIGFkZFxuICogcmVhbGlzbSB0byB5b3VyIHNjZW5lcy5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBBZGQgYSBwYy5MaWdodENvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdsaWdodCcsIHtcbiAqICAgICB0eXBlOiBcIm9tbmlcIixcbiAqICAgICBjb2xvcjogbmV3IHBjLkNvbG9yKDEsIDAsIDApLFxuICogICAgIHJhbmdlOiAxMFxuICogfSk7XG4gKlxuICogLy8gR2V0IHRoZSBwYy5MaWdodENvbXBvbmVudCBvbiBhbiBlbnRpdHlcbiAqIHZhciBsaWdodENvbXBvbmVudCA9IGVudGl0eS5saWdodDtcbiAqXG4gKiAvLyBVcGRhdGUgYSBwcm9wZXJ0eSBvbiBhIGxpZ2h0IGNvbXBvbmVudFxuICogZW50aXR5LmxpZ2h0LnJhbmdlID0gMjA7XG4gKiBgYGBcbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdHlwZSBUaGUgdHlwZSBvZiBsaWdodC4gQ2FuIGJlOlxuICpcbiAqIC0gXCJkaXJlY3Rpb25hbFwiOiBBIGxpZ2h0IHRoYXQgaXMgaW5maW5pdGVseSBmYXIgYXdheSBhbmQgbGlnaHRzIHRoZSBlbnRpcmUgc2NlbmUgZnJvbSBvbmVcbiAqIGRpcmVjdGlvbi5cbiAqIC0gXCJvbW5pXCI6IEFuIG9tbmktZGlyZWN0aW9uYWwgbGlnaHQgdGhhdCBpbGx1bWluYXRlcyBpbiBhbGwgZGlyZWN0aW9ucyBmcm9tIHRoZSBsaWdodCBzb3VyY2UuXG4gKiAtIFwic3BvdFwiOiBBbiBvbW5pLWRpcmVjdGlvbmFsIGxpZ2h0IGJ1dCBpcyBib3VuZGVkIGJ5IGEgY29uZS5cbiAqXG4gKiBEZWZhdWx0cyB0byBcImRpcmVjdGlvbmFsXCIuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBjb2xvciBUaGUgQ29sb3Igb2YgdGhlIGxpZ2h0LiBUaGUgYWxwaGEgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpcyBpZ25vcmVkLlxuICogRGVmYXVsdHMgdG8gd2hpdGUgKDEsIDEsIDEpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGludGVuc2l0eSBUaGUgYnJpZ2h0bmVzcyBvZiB0aGUgbGlnaHQuIERlZmF1bHRzIHRvIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbHVtaW5hbmNlIFRoZSBwaHlzaWNhbGx5IGJhc2VkIGx1bWluYW5jZS4gT25seSB1c2VkIGlmIHNjZW5lLnBoeXNpY2FsVW5pdHMgaXMgdHJ1ZS4gRGVmYXVsdHMgdG8gMC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFwZSBUaGUgbGlnaHQgc291cmNlIHNoYXBlLiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgcGMuTElHSFRTSEFQRV9QVU5DVFVBTH06IEluZmluaXRlc2ltYWxseSBzbWFsbCBwb2ludC5cbiAqIC0ge0BsaW5rIHBjLkxJR0hUU0hBUEVfUkVDVH06IFJlY3RhbmdsZSBzaGFwZS5cbiAqIC0ge0BsaW5rIHBjLkxJR0hUU0hBUEVfRElTS306IERpc2sgc2hhcGUuXG4gKiAtIHtAbGluayBwYy5MSUdIVFNIQVBFX1NQSEVSRX06IFNwaGVyZSBzaGFwZS5cbiAqXG4gKiBEZWZhdWx0cyB0byBwYy5MSUdIVFNIQVBFX1BVTkNUVUFMLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjYXN0U2hhZG93cyBJZiBlbmFibGVkIHRoZSBsaWdodCB3aWxsIGNhc3Qgc2hhZG93cy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93RGlzdGFuY2UgVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCBiZXlvbmQgd2hpY2ggc2hhZG93cyBhcmUgbm9cbiAqIGxvbmdlciByZW5kZXJlZC4gQWZmZWN0cyBkaXJlY3Rpb25hbCBsaWdodHMgb25seS4gRGVmYXVsdHMgdG8gNDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93SW50ZW5zaXR5IFRoZSBpbnRlbnNpdHkgb2YgdGhlIHNoYWRvdyBkYXJrZW5pbmcsIDEgYmVpbmcgc2hhZG93cyBhcmUgZW50aXJlbHkgYmxhY2suXG4gKiBEZWZhdWx0cyB0byAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRvd1Jlc29sdXRpb24gVGhlIHNpemUgb2YgdGhlIHRleHR1cmUgdXNlZCBmb3IgdGhlIHNoYWRvdyBtYXAuIFZhbGlkIHNpemVzXG4gKiBhcmUgNjQsIDEyOCwgMjU2LCA1MTIsIDEwMjQsIDIwNDguIERlZmF1bHRzIHRvIDEwMjQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93QmlhcyBUaGUgZGVwdGggYmlhcyBmb3IgdHVuaW5nIHRoZSBhcHBlYXJhbmNlIG9mIHRoZSBzaGFkb3cgbWFwcGluZ1xuICogZ2VuZXJhdGVkIGJ5IHRoaXMgbGlnaHQuIFZhbGlkIHJhbmdlIGlzIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC4wNS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBudW1DYXNjYWRlcyBOdW1iZXIgb2Ygc2hhZG93IGNhc2NhZGVzLiBDYW4gYmUgMSwgMiwgMyBvciA0LiBEZWZhdWx0cyB0byAxLFxuICogcmVwcmVzZW50aW5nIG5vIGNhc2NhZGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNhc2NhZGVEaXN0cmlidXRpb24gVGhlIGRpc3RyaWJ1dGlvbiBvZiBzdWJkaXZpc2lvbiBvZiB0aGUgY2FtZXJhIGZydXN0dW0gZm9yXG4gKiBpbmRpdmlkdWFsIHNoYWRvdyBjYXNjYWRlcy4gT25seSB1c2VkIGlmIHtAbGluayBMaWdodENvbXBvbmVudCNudW1DYXNjYWRlc30gaXMgbGFyZ2VyIHRoYW4gMS5cbiAqIENhbiBiZSBhIHZhbHVlIGluIHJhbmdlIG9mIDAgYW5kIDEuIFZhbHVlIG9mIDAgcmVwcmVzZW50cyBhIGxpbmVhciBkaXN0cmlidXRpb24sIHZhbHVlIG9mIDFcbiAqIHJlcHJlc2VudHMgYSBsb2dhcml0aG1pYyBkaXN0cmlidXRpb24uIERlZmF1bHRzIHRvIDAuNS4gTGFyZ2VyIHZhbHVlIGluY3JlYXNlcyB0aGUgcmVzb2x1dGlvbiBvZlxuICogdGhlIHNoYWRvd3MgaW4gdGhlIG5lYXIgZGlzdGFuY2UuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbm9ybWFsT2Zmc2V0QmlhcyBOb3JtYWwgb2Zmc2V0IGRlcHRoIGJpYXMuIFZhbGlkIHJhbmdlIGlzIDAgdG8gMS4gRGVmYXVsdHMgdG9cbiAqIDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmFuZ2UgVGhlIHJhbmdlIG9mIHRoZSBsaWdodC4gQWZmZWN0cyBvbW5pIGFuZCBzcG90IGxpZ2h0cyBvbmx5LiBEZWZhdWx0cyB0b1xuICogMTAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gaW5uZXJDb25lQW5nbGUgVGhlIGFuZ2xlIGF0IHdoaWNoIHRoZSBzcG90bGlnaHQgY29uZSBzdGFydHMgdG8gZmFkZSBvZmYuIFRoZVxuICogYW5nbGUgaXMgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIEFmZmVjdHMgc3BvdCBsaWdodHMgb25seS4gRGVmYXVsdHMgdG8gNDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3V0ZXJDb25lQW5nbGUgVGhlIGFuZ2xlIGF0IHdoaWNoIHRoZSBzcG90bGlnaHQgY29uZSBoYXMgZmFkZWQgdG8gbm90aGluZy5cbiAqIFRoZSBhbmdsZSBpcyBzcGVjaWZpZWQgaW4gZGVncmVlcy4gQWZmZWN0cyBzcG90IGxpZ2h0cyBvbmx5LiBEZWZhdWx0cyB0byA0NS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmYWxsb2ZmTW9kZSBDb250cm9scyB0aGUgcmF0ZSBhdCB3aGljaCBhIGxpZ2h0IGF0dGVudWF0ZXMgZnJvbSBpdHMgcG9zaXRpb24uXG4gKiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgTElHSFRGQUxMT0ZGX0xJTkVBUn06IExpbmVhci5cbiAqIC0ge0BsaW5rIExJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRH06IEludmVyc2Ugc3F1YXJlZC5cbiAqXG4gKiBBZmZlY3RzIG9tbmkgYW5kIHNwb3QgbGlnaHRzIG9ubHkuIERlZmF1bHRzIHRvIHtAbGluayBMSUdIVEZBTExPRkZfTElORUFSfS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXNrIERlZmluZXMgYSBtYXNrIHRvIGRldGVybWluZSB3aGljaCB7QGxpbmsgTWVzaEluc3RhbmNlfXMgYXJlIGxpdCBieSB0aGlzXG4gKiBsaWdodC4gRGVmYXVsdHMgdG8gMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYWZmZWN0RHluYW1pYyBJZiBlbmFibGVkIHRoZSBsaWdodCB3aWxsIGFmZmVjdCBub24tbGlnaHRtYXBwZWQgb2JqZWN0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYWZmZWN0TGlnaHRtYXBwZWQgSWYgZW5hYmxlZCB0aGUgbGlnaHQgd2lsbCBhZmZlY3QgbGlnaHRtYXBwZWQgb2JqZWN0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYmFrZSBJZiBlbmFibGVkIHRoZSBsaWdodCB3aWxsIGJlIHJlbmRlcmVkIGludG8gbGlnaHRtYXBzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJha2VOdW1TYW1wbGVzIElmIGJha2UgaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBzYW1wbGVzIHVzZWQgdG9cbiAqIGJha2UgdGhpcyBsaWdodCBpbnRvIHRoZSBsaWdodG1hcC4gRGVmYXVsdHMgdG8gMS4gTWF4aW11bSB2YWx1ZSBpcyAyNTUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYmFrZUFyZWEgSWYgYmFrZSBpcyB0cnVlIGFuZCB0aGUgbGlnaHQgdHlwZSBpcyB7QGxpbmsgTElHSFRUWVBFX0RJUkVDVElPTkFMfSxcbiAqIHRoaXMgc3BlY2lmaWVzIHRoZSBwZW51bWJyYSBhbmdsZSBpbiBkZWdyZWVzLCBhbGxvd2luZyBhIHNvZnQgc2hhZG93IGJvdW5kYXJ5LiBEZWZhdWx0cyB0byAwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBiYWtlRGlyIElmIGVuYWJsZWQgYW5kIGJha2U9dHJ1ZSwgdGhlIGxpZ2h0J3MgZGlyZWN0aW9uIHdpbGwgY29udHJpYnV0ZSB0b1xuICogZGlyZWN0aW9uYWwgbGlnaHRtYXBzLiBCZSBhd2FyZSwgdGhhdCBkaXJlY3Rpb25hbCBsaWdodG1hcCBpcyBhbiBhcHByb3hpbWF0aW9uIGFuZCBjYW4gb25seSBob2xkXG4gKiBzaW5nbGUgZGlyZWN0aW9uIHBlciBwaXhlbC4gSW50ZXJzZWN0aW5nIG11bHRpcGxlIGxpZ2h0cyB3aXRoIGJha2VEaXI9dHJ1ZSBtYXkgbGVhZCB0byBpbmNvcnJlY3RcbiAqIGxvb2sgb2Ygc3BlY3VsYXIvYnVtcC1tYXBwaW5nIGluIHRoZSBhcmVhIG9mIGludGVyc2VjdGlvbi4gVGhlIGVycm9yIGlzIG5vdCBhbHdheXMgdmlzaWJsZVxuICogdGhvdWdoLCBhbmQgaGlnaGx5IHNjZW5lLWRlcGVuZGVudC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFkb3dVcGRhdGVNb2RlIFRlbGxzIHRoZSByZW5kZXJlciBob3cgb2Z0ZW4gc2hhZG93cyBtdXN0IGJlIHVwZGF0ZWQgZm9yXG4gKiB0aGlzIGxpZ2h0LiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgU0hBRE9XVVBEQVRFX05PTkV9OiBEb24ndCByZW5kZXIgc2hhZG93cy5cbiAqIC0ge0BsaW5rIFNIQURPV1VQREFURV9USElTRlJBTUV9OiBSZW5kZXIgc2hhZG93cyBvbmx5IG9uY2UgKHRoZW4gYXV0b21hdGljYWxseSBzd2l0Y2hlcyB0b1xuICoge0BsaW5rIFNIQURPV1VQREFURV9OT05FfS5cbiAqIC0ge0BsaW5rIFNIQURPV1VQREFURV9SRUFMVElNRX06IFJlbmRlciBzaGFkb3dzIGV2ZXJ5IGZyYW1lIChkZWZhdWx0KS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFkb3dUeXBlIFR5cGUgb2Ygc2hhZG93cyBiZWluZyByZW5kZXJlZCBieSB0aGlzIGxpZ2h0LiBPcHRpb25zOlxuICpcbiAqIC0ge0BsaW5rIFNIQURPV19QQ0YzfTogUmVuZGVyIGRlcHRoIChjb2xvci1wYWNrZWQgb24gV2ViR0wgMS4wKSwgY2FuIGJlIHVzZWQgZm9yIFBDRiAzeDNcbiAqIHNhbXBsaW5nLlxuICogLSB7QGxpbmsgU0hBRE9XX1ZTTTh9OiBSZW5kZXIgcGFja2VkIHZhcmlhbmNlIHNoYWRvdyBtYXAuIEFsbCBzaGFkb3cgcmVjZWl2ZXJzIG11c3QgYWxzbyBjYXN0XG4gKiBzaGFkb3dzIGZvciB0aGlzIG1vZGUgdG8gd29yayBjb3JyZWN0bHkuXG4gKiAtIHtAbGluayBTSEFET1dfVlNNMTZ9OiBSZW5kZXIgMTYtYml0IGV4cG9uZW50aWFsIHZhcmlhbmNlIHNoYWRvdyBtYXAuIFJlcXVpcmVzXG4gKiBPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0IGV4dGVuc2lvbi4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1ZTTTh9LCBpZiBub3Qgc3VwcG9ydGVkLlxuICogLSB7QGxpbmsgU0hBRE9XX1ZTTTMyfTogUmVuZGVyIDMyLWJpdCBleHBvbmVudGlhbCB2YXJpYW5jZSBzaGFkb3cgbWFwLiBSZXF1aXJlc1xuICogT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfVlNNMTZ9LCBpZiBub3Qgc3VwcG9ydGVkLlxuICogLSB7QGxpbmsgU0hBRE9XX1BDRjV9OiBSZW5kZXIgZGVwdGggYnVmZmVyIG9ubHksIGNhbiBiZSB1c2VkIGZvciBoYXJkd2FyZS1hY2NlbGVyYXRlZCBQQ0YgNXg1XG4gKiBzYW1wbGluZy4gUmVxdWlyZXMgV2ViR0wyLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfUENGM30gb24gV2ViR0wgMS4wLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHZzbUJsdXJNb2RlIEJsdXJyaW5nIG1vZGUgZm9yIHZhcmlhbmNlIHNoYWRvdyBtYXBzLiBDYW4gYmU6XG4gKlxuICogLSB7QGxpbmsgQkxVUl9CT1h9OiBCb3ggZmlsdGVyLlxuICogLSB7QGxpbmsgQkxVUl9HQVVTU0lBTn06IEdhdXNzaWFuIGZpbHRlci4gTWF5IGxvb2sgc21vb3RoZXIgdGhhbiBib3gsIGJ1dCByZXF1aXJlcyBtb3JlIHNhbXBsZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdnNtQmx1clNpemUgTnVtYmVyIG9mIHNhbXBsZXMgdXNlZCBmb3IgYmx1cnJpbmcgYSB2YXJpYW5jZSBzaGFkb3cgbWFwLiBPbmx5XG4gKiB1bmV2ZW4gbnVtYmVycyB3b3JrLCBldmVuIGFyZSBpbmNyZW1lbnRlZC4gTWluaW11bSB2YWx1ZSBpcyAxLCBtYXhpbXVtIGlzIDI1LiBEZWZhdWx0cyB0byAxMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb29raWVBc3NldCBBc3NldCB0aGF0IGhhcyB0ZXh0dXJlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0byBjb29raWUgaW50ZXJuYWxseVxuICogb25jZSBhc3NldCByZXNvdXJjZSBpcyBhdmFpbGFibGUuXG4gKiBAcHJvcGVydHkge1RleHR1cmV9IGNvb2tpZSBQcm9qZWN0aW9uIHRleHR1cmUuIE11c3QgYmUgMkQgZm9yIHNwb3QgYW5kIGN1YmVtYXAgZm9yIG9tbmkgbGlnaHRcbiAqIChpZ25vcmVkIGlmIGluY29ycmVjdCB0eXBlIGlzIHVzZWQpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNvb2tpZUludGVuc2l0eSBQcm9qZWN0aW9uIHRleHR1cmUgaW50ZW5zaXR5IChkZWZhdWx0IGlzIDEpLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjb29raWVGYWxsb2ZmIFRvZ2dsZSBub3JtYWwgc3BvdGxpZ2h0IGZhbGxvZmYgd2hlbiBwcm9qZWN0aW9uIHRleHR1cmUgaXNcbiAqIHVzZWQuIFdoZW4gc2V0IHRvIGZhbHNlLCBzcG90bGlnaHQgd2lsbCB3b3JrIGxpa2UgYSBwdXJlIHRleHR1cmUgcHJvamVjdG9yIChvbmx5IGZhZGluZyB3aXRoXG4gKiBkaXN0YW5jZSkuIERlZmF1bHQgaXMgZmFsc2UuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY29va2llQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgcHJvamVjdGlvbiB0ZXh0dXJlIHRvIHVzZS4gQ2FuIGJlIFwiclwiLFxuICogXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb29raWVBbmdsZSBBbmdsZSBmb3Igc3BvdGxpZ2h0IGNvb2tpZSByb3RhdGlvbi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcycpLlZlYzJ9IGNvb2tpZVNjYWxlIFNwb3RsaWdodCBjb29raWUgc2NhbGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnKS5WZWMyfSBjb29raWVPZmZzZXQgU3BvdGxpZ2h0IGNvb2tpZSBwb3NpdGlvblxuICogb2Zmc2V0LlxuICogQHByb3BlcnR5IHtib29sZWFufSBpc1N0YXRpYyBNYXJrIGxpZ2h0IGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICogQHByb3BlcnR5IHtudW1iZXJbXX0gbGF5ZXJzIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBsaWdodCBzaG91bGRcbiAqIGJlbG9uZy4gRG9uJ3QgcHVzaC9wb3Avc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXQgYSBuZXcgb25lXG4gKiBpbnN0ZWFkLlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBMaWdodENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBMaWdodENvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLkxpZ2h0Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9jb29raWVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0SWQgPSBudWxsO1xuICAgICAgICB0aGlzLl9jb29raWVBc3NldEFkZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBudWxsO1xuICAgIH1cblxuICAgIGFkZExpZ2h0VG9MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTGlnaHQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVMaWdodEZyb21MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTGlnaHQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHRUb0xheWVycygpO1xuICAgICAgICB9XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZExpZ2h0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZUxpZ2h0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVmcmVzaFByb3BlcnRpZXMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX2xpZ2h0UHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBfbGlnaHRQcm9wc1tpXTtcblxuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgIHRoaXMub25FbmFibGUoKTtcbiAgICB9XG5cbiAgICBvbkNvb2tpZUFzc2V0U2V0KCkge1xuICAgICAgICBsZXQgZm9yY2VMb2FkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZUFzc2V0LnR5cGUgPT09ICdjdWJlbWFwJyAmJiAhdGhpcy5fY29va2llQXNzZXQubG9hZEZhY2VzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldC5sb2FkRmFjZXMgPSB0cnVlO1xuICAgICAgICAgICAgZm9yY2VMb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fY29va2llQXNzZXQucmVzb3VyY2UgfHwgZm9yY2VMb2FkKVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKHRoaXMuX2Nvb2tpZUFzc2V0KTtcblxuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXQucmVzb3VyY2UpXG4gICAgICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRMb2FkKCk7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldEFkZChhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXRJZCAhPT0gYXNzZXQuaWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llQXNzZXQgPSBhc3NldDtcblxuICAgICAgICBpZiAodGhpcy5saWdodC5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0U2V0KCk7XG5cbiAgICAgICAgdGhpcy5fY29va2llQXNzZXQub24oJ2xvYWQnLCB0aGlzLm9uQ29va2llQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fY29va2llQXNzZXQub24oJ3JlbW92ZScsIHRoaXMub25Db29raWVBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldExvYWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llQXNzZXQgfHwgIXRoaXMuX2Nvb2tpZUFzc2V0LnJlc291cmNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuY29va2llID0gdGhpcy5fY29va2llQXNzZXQucmVzb3VyY2U7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldFJlbW92ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb29raWVBc3NldElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldEFkZCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fY29va2llQXNzZXRJZCwgdGhpcy5vbkNvb2tpZUFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0QWRkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0Lm9mZignbG9hZCcsIHRoaXMub25Db29raWVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQ29va2llQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb29raWUgPSBudWxsO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICB0aGlzLmxpZ2h0LmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmFkZExpZ2h0VG9MYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldCAmJiAhdGhpcy5jb29raWUpXG4gICAgICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRTZXQoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMubGlnaHQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVMaWdodEZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGF5ZXJzXG4gICAgICAgIHRoaXMub25EaXNhYmxlKCk7XG5cbiAgICAgICAgLy8gZGVzdHJveSBsaWdodCBub2RlXG4gICAgICAgIHRoaXMubGlnaHQuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIHJlbW92ZSBjb29raWUgYXNzZXQgZXZlbnRzXG4gICAgICAgIHRoaXMuY29va2llQXNzZXQgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gYXJyYXkgb2YgU0hBRE9XVVBEQVRFXyBzZXR0aW5ncyBwZXIgc2hhZG93IGNhc2NhZGUsIG9yIHVuZGVmaW5lZCBpZiBub3QgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXSB8IG51bGx9XG4gICAgICovXG4gICAgc2V0IHNoYWRvd1VwZGF0ZU92ZXJyaWRlcyh2YWx1ZXMpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFkb3dVcGRhdGVPdmVycmlkZXMgPSB2YWx1ZXM7XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd1VwZGF0ZU92ZXJyaWRlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGlnaHQuc2hhZG93VXBkYXRlT3ZlcnJpZGVzO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BlcnR5KG5hbWUsIGRlZmF1bHRWYWx1ZSwgc2V0RnVuYywgc2tpcEVxdWFsc0NoZWNrKSB7XG4gICAgY29uc3QgYyA9IExpZ2h0Q29tcG9uZW50LnByb3RvdHlwZTtcbiAgICBfbGlnaHRQcm9wcy5wdXNoKG5hbWUpO1xuICAgIF9saWdodFByb3BzRGVmYXVsdC5wdXNoKGRlZmF1bHRWYWx1ZSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYywgbmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRhdGFbbmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSBkYXRhW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFza2lwRXF1YWxzQ2hlY2sgJiYgb2xkVmFsdWUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgICAgICBkYXRhW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICBpZiAoc2V0RnVuYykgc2V0RnVuYy5jYWxsKHRoaXMsIHZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lUHJvcHMoKSB7XG4gICAgX2RlZmluZVByb3BlcnR5KCdlbmFibGVkJywgdHJ1ZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLm9uU2V0RW5hYmxlZChudWxsLCBvbGRWYWx1ZSwgbmV3VmFsdWUpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnbGlnaHQnLCBudWxsKTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3R5cGUnLCAnZGlyZWN0aW9uYWwnLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmNoYW5nZVR5cGUodGhpcywgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcbiAgICAgICAgLy8gcmVmcmVzaCBsaWdodCBwcm9wZXJ0aWVzIGJlY2F1c2UgY2hhbmdpbmcgdGhlIHR5cGUgZG9lcyBub3QgcmVzZXQgdGhlXG4gICAgICAgIC8vIGxpZ2h0IHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5yZWZyZXNoUHJvcGVydGllcygpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29sb3InLCBuZXcgQ29sb3IoMSwgMSwgMSksIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zZXRDb2xvcihuZXdWYWx1ZSk7XG4gICAgfSwgdHJ1ZSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdpbnRlbnNpdHknLCAxLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuaW50ZW5zaXR5ID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdsdW1pbmFuY2UnLCAwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQubHVtaW5hbmNlID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdzaGFwZScsIExJR0hUU0hBUEVfUFVOQ1RVQUwsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFwZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY2FzdFNoYWRvd3MnLCBmYWxzZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNhc3RTaGFkb3dzID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdzaGFkb3dEaXN0YW5jZScsIDQwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93RGlzdGFuY2UgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd0ludGVuc2l0eScsIDEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFkb3dJbnRlbnNpdHkgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd1Jlc29sdXRpb24nLCAxMDI0LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93UmVzb2x1dGlvbiA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93QmlhcycsIDAuMDUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFkb3dCaWFzID0gLTAuMDEgKiBtYXRoLmNsYW1wKG5ld1ZhbHVlLCAwLCAxKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ251bUNhc2NhZGVzJywgMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0Lm51bUNhc2NhZGVzID0gbWF0aC5jbGFtcChNYXRoLmZsb29yKG5ld1ZhbHVlKSwgMSwgNCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdiYWtlTnVtU2FtcGxlcycsIDEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5iYWtlTnVtU2FtcGxlcyA9IG1hdGguY2xhbXAoTWF0aC5mbG9vcihuZXdWYWx1ZSksIDEsIDI1NSk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdiYWtlQXJlYScsIDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5iYWtlQXJlYSA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDE4MCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdjYXNjYWRlRGlzdHJpYnV0aW9uJywgMC41LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnbm9ybWFsT2Zmc2V0QmlhcycsIDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5ub3JtYWxPZmZzZXRCaWFzID0gbWF0aC5jbGFtcChuZXdWYWx1ZSwgMCwgMSk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdyYW5nZScsIDEwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuYXR0ZW51YXRpb25FbmQgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJywgNDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5pbm5lckNvbmVBbmdsZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnLCA0NSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0Lm91dGVyQ29uZUFuZ2xlID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdmYWxsb2ZmTW9kZScsIExJR0hURkFMTE9GRl9MSU5FQVIsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5mYWxsb2ZmTW9kZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93VHlwZScsIFNIQURPV19QQ0YzLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93VHlwZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgndnNtQmx1clNpemUnLCAxMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnZzbUJsdXJTaXplID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCd2c21CbHVyTW9kZScsIEJMVVJfR0FVU1NJQU4sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC52c21CbHVyTW9kZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgndnNtQmlhcycsIDAuMDEgKiAwLjI1LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQudnNtQmlhcyA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llQXNzZXQnLCBudWxsLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldElkICYmICgobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCAmJiBuZXdWYWx1ZS5pZCA9PT0gdGhpcy5fY29va2llQXNzZXRJZCkgfHwgbmV3VmFsdWUgPT09IHRoaXMuX2Nvb2tpZUFzc2V0SWQpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMub25Db29raWVBc3NldFJlbW92ZSgpO1xuICAgICAgICB0aGlzLl9jb29raWVBc3NldElkID0gbnVsbDtcblxuICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5kYXRhLmNvb2tpZUFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldElkID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRBZGQobmV3VmFsdWUpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuZXdWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0SWQgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0QWRkKGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXRBZGQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub24oJ2FkZDonICsgdGhpcy5fY29va2llQXNzZXRJZCwgdGhpcy5vbkNvb2tpZUFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llJywgbnVsbCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llSW50ZW5zaXR5JywgMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZUludGVuc2l0eSA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llRmFsbG9mZicsIHRydWUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWVGYWxsb2ZmID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdjb29raWVDaGFubmVsJywgJ3JnYicsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWVDaGFubmVsID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdjb29raWVBbmdsZScsIDAsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSAwIHx8IHRoaXMuY29va2llU2NhbGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fY29va2llTWF0cml4KSB0aGlzLl9jb29raWVNYXRyaXggPSBuZXcgVmVjNCgpO1xuICAgICAgICAgICAgbGV0IHNjeCA9IDE7XG4gICAgICAgICAgICBsZXQgc2N5ID0gMTtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvb2tpZVNjYWxlKSB7XG4gICAgICAgICAgICAgICAgc2N4ID0gdGhpcy5jb29raWVTY2FsZS54O1xuICAgICAgICAgICAgICAgIHNjeSA9IHRoaXMuY29va2llU2NhbGUueTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGMgPSBNYXRoLmNvcyhuZXdWYWx1ZSAqIG1hdGguREVHX1RPX1JBRCk7XG4gICAgICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4obmV3VmFsdWUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llTWF0cml4LnNldChjIC8gc2N4LCAtcyAvIHNjeCwgcyAvIHNjeSwgYyAvIHNjeSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZVRyYW5zZm9ybSA9IHRoaXMuX2Nvb2tpZU1hdHJpeDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQuY29va2llVHJhbnNmb3JtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llU2NhbGUnLCBudWxsLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gbnVsbCB8fCB0aGlzLmNvb2tpZUFuZ2xlICE9PSAwKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2Nvb2tpZU1hdHJpeCkgdGhpcy5fY29va2llTWF0cml4ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgICAgIGNvbnN0IHNjeCA9IG5ld1ZhbHVlLng7XG4gICAgICAgICAgICBjb25zdCBzY3kgPSBuZXdWYWx1ZS55O1xuICAgICAgICAgICAgY29uc3QgYyA9IE1hdGguY29zKHRoaXMuY29va2llQW5nbGUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgY29uc3QgcyA9IE1hdGguc2luKHRoaXMuY29va2llQW5nbGUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgdGhpcy5fY29va2llTWF0cml4LnNldChjIC8gc2N4LCAtcyAvIHNjeCwgcyAvIHNjeSwgYyAvIHNjeSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZVRyYW5zZm9ybSA9IHRoaXMuX2Nvb2tpZU1hdHJpeDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQuY29va2llVHJhbnNmb3JtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sIHRydWUpO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llT2Zmc2V0JywgbnVsbCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZU9mZnNldCA9IG5ld1ZhbHVlO1xuICAgIH0sIHRydWUpO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93VXBkYXRlTW9kZScsIFNIQURPV1VQREFURV9SRUFMVElNRSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBuZXdWYWx1ZTtcbiAgICB9LCB0cnVlKTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ21hc2snLCAxLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQubWFzayA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYWZmZWN0RHluYW1pYycsIHRydWUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Lm1hc2sgfD0gTUFTS19BRkZFQ1RfRFlOQU1JQztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQubWFzayAmPSB+TUFTS19BRkZFQ1RfRFlOQU1JQztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpZ2h0LmxheWVyc0RpcnR5KCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdhZmZlY3RMaWdodG1hcHBlZCcsIGZhbHNlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmFrZSkgdGhpcy5saWdodC5tYXNrICY9IH5NQVNLX0JBS0U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Lm1hc2sgJj0gfk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmFrZSkgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQkFLRTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYmFrZScsIGZhbHNlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQkFLRTtcbiAgICAgICAgICAgIGlmICh0aGlzLmFmZmVjdExpZ2h0bWFwcGVkKSB0aGlzLmxpZ2h0Lm1hc2sgJj0gfk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrICY9IH5NQVNLX0JBS0U7XG4gICAgICAgICAgICBpZiAodGhpcy5hZmZlY3RMaWdodG1hcHBlZCkgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubGlnaHQubGF5ZXJzRGlydHkoKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Jha2VEaXInLCB0cnVlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuYmFrZURpciA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnaXNTdGF0aWMnLCBmYWxzZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmlzU3RhdGljID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdsYXllcnMnLCBbTEFZRVJJRF9XT1JMRF0sIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChvbGRWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZUxpZ2h0KHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3VmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobmV3VmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRMaWdodCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5fZGVmaW5lUHJvcHMoKTtcblxuZXhwb3J0IHsgX2xpZ2h0UHJvcHMsIF9saWdodFByb3BzRGVmYXVsdCwgTGlnaHRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJfbGlnaHRQcm9wcyIsIl9saWdodFByb3BzRGVmYXVsdCIsIkxpZ2h0Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfY29va2llQXNzZXQiLCJfY29va2llQXNzZXRJZCIsIl9jb29raWVBc3NldEFkZCIsIl9jb29raWVNYXRyaXgiLCJhZGRMaWdodFRvTGF5ZXJzIiwiaSIsImxheWVycyIsImxlbmd0aCIsImxheWVyIiwiYXBwIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJhZGRMaWdodCIsInJlbW92ZUxpZ2h0RnJvbUxheWVycyIsInJlbW92ZUxpZ2h0Iiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJlbmFibGVkIiwib2ZmIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJvbiIsImluZGV4IiwiaW5kZXhPZiIsImlkIiwicmVmcmVzaFByb3BlcnRpZXMiLCJuYW1lIiwib25FbmFibGUiLCJvbkNvb2tpZUFzc2V0U2V0IiwiZm9yY2VMb2FkIiwidHlwZSIsImxvYWRGYWNlcyIsInJlc291cmNlIiwiYXNzZXRzIiwibG9hZCIsIm9uQ29va2llQXNzZXRMb2FkIiwib25Db29raWVBc3NldEFkZCIsImFzc2V0IiwibGlnaHQiLCJvbkNvb2tpZUFzc2V0UmVtb3ZlIiwiY29va2llIiwib25EaXNhYmxlIiwib25SZW1vdmUiLCJkZXN0cm95IiwiY29va2llQXNzZXQiLCJzaGFkb3dVcGRhdGVPdmVycmlkZXMiLCJ2YWx1ZXMiLCJfZGVmaW5lUHJvcGVydHkiLCJkZWZhdWx0VmFsdWUiLCJzZXRGdW5jIiwic2tpcEVxdWFsc0NoZWNrIiwiYyIsInByb3RvdHlwZSIsInB1c2giLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsImRhdGEiLCJzZXQiLCJ2YWx1ZSIsIm9sZFZhbHVlIiwiY2FsbCIsImNvbmZpZ3VyYWJsZSIsIl9kZWZpbmVQcm9wcyIsIm5ld1ZhbHVlIiwib25TZXRFbmFibGVkIiwiY2hhbmdlVHlwZSIsIkNvbG9yIiwic2V0Q29sb3IiLCJpbnRlbnNpdHkiLCJsdW1pbmFuY2UiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwic2hhcGUiLCJjYXN0U2hhZG93cyIsInNoYWRvd0Rpc3RhbmNlIiwic2hhZG93SW50ZW5zaXR5Iiwic2hhZG93UmVzb2x1dGlvbiIsInNoYWRvd0JpYXMiLCJtYXRoIiwiY2xhbXAiLCJudW1DYXNjYWRlcyIsIk1hdGgiLCJmbG9vciIsImJha2VOdW1TYW1wbGVzIiwiYmFrZUFyZWEiLCJjYXNjYWRlRGlzdHJpYnV0aW9uIiwibm9ybWFsT2Zmc2V0QmlhcyIsImF0dGVudWF0aW9uRW5kIiwiaW5uZXJDb25lQW5nbGUiLCJvdXRlckNvbmVBbmdsZSIsIkxJR0hURkFMTE9GRl9MSU5FQVIiLCJmYWxsb2ZmTW9kZSIsIlNIQURPV19QQ0YzIiwic2hhZG93VHlwZSIsInZzbUJsdXJTaXplIiwiQkxVUl9HQVVTU0lBTiIsInZzbUJsdXJNb2RlIiwidnNtQmlhcyIsIkFzc2V0IiwiY29va2llSW50ZW5zaXR5IiwiY29va2llRmFsbG9mZiIsImNvb2tpZUNoYW5uZWwiLCJjb29raWVTY2FsZSIsIlZlYzQiLCJzY3giLCJzY3kiLCJ4IiwieSIsImNvcyIsIkRFR19UT19SQUQiLCJzIiwic2luIiwiY29va2llVHJhbnNmb3JtIiwiY29va2llQW5nbGUiLCJjb29raWVPZmZzZXQiLCJTSEFET1dVUERBVEVfUkVBTFRJTUUiLCJzaGFkb3dVcGRhdGVNb2RlIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJsYXllcnNEaXJ0eSIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiYmFrZSIsIk1BU0tfQkFLRSIsImFmZmVjdExpZ2h0bWFwcGVkIiwiYmFrZURpciIsImlzU3RhdGljIiwiTEFZRVJJRF9XT1JMRCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBa0JNQSxNQUFBQSxXQUFXLEdBQUcsR0FBRTtBQUNoQkMsTUFBQUEsa0JBQWtCLEdBQUcsR0FBRTs7QUF3STdCLE1BQU1DLGNBQWMsU0FBU0MsU0FBUyxDQUFDO0FBU25DQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQ3hCLElBQUEsS0FBSyxDQUFDRCxNQUFNLEVBQUVDLE1BQU0sQ0FBQyxDQUFBO0lBRXJCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUN4QixJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxlQUFlLEdBQUcsS0FBSyxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUM3QixHQUFBO0FBRUFDLEVBQUFBLGdCQUFnQixHQUFHO0FBQ2YsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNDLE1BQU0sQ0FBQ0MsTUFBTSxFQUFFRixDQUFDLEVBQUUsRUFBRTtNQUN6QyxNQUFNRyxLQUFLLEdBQUcsSUFBSSxDQUFDVixNQUFNLENBQUNXLEdBQUcsQ0FBQ0MsS0FBSyxDQUFDSixNQUFNLENBQUNLLFlBQVksQ0FBQyxJQUFJLENBQUNMLE1BQU0sQ0FBQ0QsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN2RSxNQUFBLElBQUlHLEtBQUssRUFBRTtBQUNQQSxRQUFBQSxLQUFLLENBQUNJLFFBQVEsQ0FBQyxJ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
