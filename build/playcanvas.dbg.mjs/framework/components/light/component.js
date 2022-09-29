/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { math } from '../../../math/math.js';
import { Color } from '../../../math/color.js';
import { Vec4 } from '../../../math/vec4.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, SHADOWUPDATE_REALTIME, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, LAYERID_WORLD } from '../../../scene/constants.js';
import { Asset } from '../../../asset/asset.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIExJR0hURkFMTE9GRl9MSU5FQVIsXG4gICAgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQsIE1BU0tfQUZGRUNUX0RZTkFNSUMsIE1BU0tfQkFLRSxcbiAgICBTSEFET1dfUENGMyxcbiAgICBTSEFET1dVUERBVEVfUkVBTFRJTUVcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9tYXRoL3ZlYzIuanMnKS5WZWMyfSBWZWMyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLkxpZ2h0Q29tcG9uZW50U3lzdGVtfSBMaWdodENvbXBvbmVudFN5c3RlbSAqL1xuXG5jb25zdCBfbGlnaHRQcm9wcyA9IFtdO1xuY29uc3QgX2xpZ2h0UHJvcHNEZWZhdWx0ID0gW107XG5cbi8qKlxuICogVGhlIExpZ2h0IENvbXBvbmVudCBlbmFibGVzIHRoZSBFbnRpdHkgdG8gbGlnaHQgdGhlIHNjZW5lLiBUaGVyZSBhcmUgdGhyZWUgdHlwZXMgb2YgbGlnaHQ6XG4gKiBkaXJlY3Rpb25hbCwgb21uaSBhbmQgc3BvdC4gRGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBnbG9iYWwgaW4gdGhhdCB0aGV5IGFyZSBjb25zaWRlcmVkIHRvIGJlXG4gKiBpbmZpbml0ZWx5IGZhciBhd2F5IGFuZCBsaWdodCB0aGUgZW50aXJlIHNjZW5lLiBPbW5pIGFuZCBzcG90IGxpZ2h0cyBhcmUgbG9jYWwgaW4gdGhhdCB0aGV5IGhhdmVcbiAqIGEgcG9zaXRpb24gYW5kIGEgcmFuZ2UuIEEgc3BvdCBsaWdodCBpcyBhIHNwZWNpYWxpemF0aW9uIG9mIGFuIG9tbmkgbGlnaHQgd2hlcmUgbGlnaHQgaXMgZW1pdHRlZFxuICogaW4gYSBjb25lIHJhdGhlciB0aGFuIGluIGFsbCBkaXJlY3Rpb25zLiBMaWdodHMgYWxzbyBoYXZlIHRoZSBhYmlsaXR5IHRvIGNhc3Qgc2hhZG93cyB0byBhZGRcbiAqIHJlYWxpc20gdG8geW91ciBzY2VuZXMuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gQWRkIGEgcGMuTGlnaHRDb21wb25lbnQgdG8gYW4gZW50aXR5XG4gKiB2YXIgZW50aXR5ID0gbmV3IHBjLkVudGl0eSgpO1xuICogZW50aXR5LmFkZENvbXBvbmVudCgnbGlnaHQnLCB7XG4gKiAgICAgdHlwZTogXCJvbW5pXCIsXG4gKiAgICAgY29sb3I6IG5ldyBwYy5Db2xvcigxLCAwLCAwKSxcbiAqICAgICByYW5nZTogMTBcbiAqIH0pO1xuICpcbiAqIC8vIEdldCB0aGUgcGMuTGlnaHRDb21wb25lbnQgb24gYW4gZW50aXR5XG4gKiB2YXIgbGlnaHRDb21wb25lbnQgPSBlbnRpdHkubGlnaHQ7XG4gKlxuICogLy8gVXBkYXRlIGEgcHJvcGVydHkgb24gYSBsaWdodCBjb21wb25lbnRcbiAqIGVudGl0eS5saWdodC5yYW5nZSA9IDIwO1xuICogYGBgXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHR5cGUgVGhlIHR5cGUgb2YgbGlnaHQuIENhbiBiZTpcbiAqXG4gKiAtIFwiZGlyZWN0aW9uYWxcIjogQSBsaWdodCB0aGF0IGlzIGluZmluaXRlbHkgZmFyIGF3YXkgYW5kIGxpZ2h0cyB0aGUgZW50aXJlIHNjZW5lIGZyb20gb25lXG4gKiBkaXJlY3Rpb24uXG4gKiAtIFwib21uaVwiOiBBbiBvbW5pLWRpcmVjdGlvbmFsIGxpZ2h0IHRoYXQgaWxsdW1pbmF0ZXMgaW4gYWxsIGRpcmVjdGlvbnMgZnJvbSB0aGUgbGlnaHQgc291cmNlLlxuICogLSBcInNwb3RcIjogQW4gb21uaS1kaXJlY3Rpb25hbCBsaWdodCBidXQgaXMgYm91bmRlZCBieSBhIGNvbmUuXG4gKlxuICogRGVmYXVsdHMgdG8gXCJkaXJlY3Rpb25hbFwiLlxuICogQHByb3BlcnR5IHtDb2xvcn0gY29sb3IgVGhlIENvbG9yIG9mIHRoZSBsaWdodC4gVGhlIGFscGhhIGNvbXBvbmVudCBvZiB0aGUgY29sb3IgaXMgaWdub3JlZC5cbiAqIERlZmF1bHRzIHRvIHdoaXRlICgxLCAxLCAxKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbnRlbnNpdHkgVGhlIGJyaWdodG5lc3Mgb2YgdGhlIGxpZ2h0LiBEZWZhdWx0cyB0byAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGx1bWluYW5jZSBUaGUgcGh5c2ljYWxseSBiYXNlZCBsdW1pbmFuY2UuIE9ubHkgdXNlZCBpZiBzY2VuZS5waHlzaWNhbFVuaXRzIGlzIHRydWUuIERlZmF1bHRzIHRvIDAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhcGUgVGhlIGxpZ2h0IHNvdXJjZSBzaGFwZS4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIHBjLkxJR0hUU0hBUEVfUFVOQ1RVQUx9OiBJbmZpbml0ZXNpbWFsbHkgc21hbGwgcG9pbnQuXG4gKiAtIHtAbGluayBwYy5MSUdIVFNIQVBFX1JFQ1R9OiBSZWN0YW5nbGUgc2hhcGUuXG4gKiAtIHtAbGluayBwYy5MSUdIVFNIQVBFX0RJU0t9OiBEaXNrIHNoYXBlLlxuICogLSB7QGxpbmsgcGMuTElHSFRTSEFQRV9TUEhFUkV9OiBTcGhlcmUgc2hhcGUuXG4gKlxuICogRGVmYXVsdHMgdG8gcGMuTElHSFRTSEFQRV9QVU5DVFVBTC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gY2FzdFNoYWRvd3MgSWYgZW5hYmxlZCB0aGUgbGlnaHQgd2lsbCBjYXN0IHNoYWRvd3MuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRvd0Rpc3RhbmNlIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgYmV5b25kIHdoaWNoIHNoYWRvd3MgYXJlIG5vXG4gKiBsb25nZXIgcmVuZGVyZWQuIEFmZmVjdHMgZGlyZWN0aW9uYWwgbGlnaHRzIG9ubHkuIERlZmF1bHRzIHRvIDQwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRvd0ludGVuc2l0eSBUaGUgaW50ZW5zaXR5IG9mIHRoZSBzaGFkb3cgZGFya2VuaW5nLCAxIGJlaW5nIHNoYWRvd3MgYXJlIGVudGlyZWx5IGJsYWNrLlxuICogRGVmYXVsdHMgdG8gMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGFkb3dSZXNvbHV0aW9uIFRoZSBzaXplIG9mIHRoZSB0ZXh0dXJlIHVzZWQgZm9yIHRoZSBzaGFkb3cgbWFwLiBWYWxpZCBzaXplc1xuICogYXJlIDY0LCAxMjgsIDI1NiwgNTEyLCAxMDI0LCAyMDQ4LiBEZWZhdWx0cyB0byAxMDI0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRvd0JpYXMgVGhlIGRlcHRoIGJpYXMgZm9yIHR1bmluZyB0aGUgYXBwZWFyYW5jZSBvZiB0aGUgc2hhZG93IG1hcHBpbmdcbiAqIGdlbmVyYXRlZCBieSB0aGlzIGxpZ2h0LiBWYWxpZCByYW5nZSBpcyAwIHRvIDEuIERlZmF1bHRzIHRvIDAuMDUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbnVtQ2FzY2FkZXMgTnVtYmVyIG9mIHNoYWRvdyBjYXNjYWRlcy4gQ2FuIGJlIDEsIDIsIDMgb3IgNC4gRGVmYXVsdHMgdG8gMSxcbiAqIHJlcHJlc2VudGluZyBubyBjYXNjYWRlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjYXNjYWRlRGlzdHJpYnV0aW9uIFRoZSBkaXN0cmlidXRpb24gb2Ygc3ViZGl2aXNpb24gb2YgdGhlIGNhbWVyYSBmcnVzdHVtIGZvclxuICogaW5kaXZpZHVhbCBzaGFkb3cgY2FzY2FkZXMuIE9ubHkgdXNlZCBpZiB7QGxpbmsgTGlnaHRDb21wb25lbnQjbnVtQ2FzY2FkZXN9IGlzIGxhcmdlciB0aGFuIDEuXG4gKiBDYW4gYmUgYSB2YWx1ZSBpbiByYW5nZSBvZiAwIGFuZCAxLiBWYWx1ZSBvZiAwIHJlcHJlc2VudHMgYSBsaW5lYXIgZGlzdHJpYnV0aW9uLCB2YWx1ZSBvZiAxXG4gKiByZXByZXNlbnRzIGEgbG9nYXJpdGhtaWMgZGlzdHJpYnV0aW9uLiBEZWZhdWx0cyB0byAwLjUuIExhcmdlciB2YWx1ZSBpbmNyZWFzZXMgdGhlIHJlc29sdXRpb24gb2ZcbiAqIHRoZSBzaGFkb3dzIGluIHRoZSBuZWFyIGRpc3RhbmNlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbE9mZnNldEJpYXMgTm9ybWFsIG9mZnNldCBkZXB0aCBiaWFzLiBWYWxpZCByYW5nZSBpcyAwIHRvIDEuIERlZmF1bHRzIHRvXG4gKiAwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmdlIFRoZSByYW5nZSBvZiB0aGUgbGlnaHQuIEFmZmVjdHMgb21uaSBhbmQgc3BvdCBsaWdodHMgb25seS4gRGVmYXVsdHMgdG9cbiAqIDEwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlubmVyQ29uZUFuZ2xlIFRoZSBhbmdsZSBhdCB3aGljaCB0aGUgc3BvdGxpZ2h0IGNvbmUgc3RhcnRzIHRvIGZhZGUgb2ZmLiBUaGVcbiAqIGFuZ2xlIGlzIHNwZWNpZmllZCBpbiBkZWdyZWVzLiBBZmZlY3RzIHNwb3QgbGlnaHRzIG9ubHkuIERlZmF1bHRzIHRvIDQwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG91dGVyQ29uZUFuZ2xlIFRoZSBhbmdsZSBhdCB3aGljaCB0aGUgc3BvdGxpZ2h0IGNvbmUgaGFzIGZhZGVkIHRvIG5vdGhpbmcuXG4gKiBUaGUgYW5nbGUgaXMgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIEFmZmVjdHMgc3BvdCBsaWdodHMgb25seS4gRGVmYXVsdHMgdG8gNDUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZmFsbG9mZk1vZGUgQ29udHJvbHMgdGhlIHJhdGUgYXQgd2hpY2ggYSBsaWdodCBhdHRlbnVhdGVzIGZyb20gaXRzIHBvc2l0aW9uLlxuICogQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIExJR0hURkFMTE9GRl9MSU5FQVJ9OiBMaW5lYXIuXG4gKiAtIHtAbGluayBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUR9OiBJbnZlcnNlIHNxdWFyZWQuXG4gKlxuICogQWZmZWN0cyBvbW5pIGFuZCBzcG90IGxpZ2h0cyBvbmx5LiBEZWZhdWx0cyB0byB7QGxpbmsgTElHSFRGQUxMT0ZGX0xJTkVBUn0uXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWFzayBEZWZpbmVzIGEgbWFzayB0byBkZXRlcm1pbmUgd2hpY2gge0BsaW5rIE1lc2hJbnN0YW5jZX1zIGFyZSBsaXQgYnkgdGhpc1xuICogbGlnaHQuIERlZmF1bHRzIHRvIDEuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFmZmVjdER5bmFtaWMgSWYgZW5hYmxlZCB0aGUgbGlnaHQgd2lsbCBhZmZlY3Qgbm9uLWxpZ2h0bWFwcGVkIG9iamVjdHMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFmZmVjdExpZ2h0bWFwcGVkIElmIGVuYWJsZWQgdGhlIGxpZ2h0IHdpbGwgYWZmZWN0IGxpZ2h0bWFwcGVkIG9iamVjdHMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGJha2UgSWYgZW5hYmxlZCB0aGUgbGlnaHQgd2lsbCBiZSByZW5kZXJlZCBpbnRvIGxpZ2h0bWFwcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBiYWtlTnVtU2FtcGxlcyBJZiBiYWtlIGlzIHRydWUsIHRoaXMgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyB1c2VkIHRvXG4gKiBiYWtlIHRoaXMgbGlnaHQgaW50byB0aGUgbGlnaHRtYXAuIERlZmF1bHRzIHRvIDEuIE1heGltdW0gdmFsdWUgaXMgMjU1LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJha2VBcmVhIElmIGJha2UgaXMgdHJ1ZSBhbmQgdGhlIGxpZ2h0IHR5cGUgaXMge0BsaW5rIExJR0hUVFlQRV9ESVJFQ1RJT05BTH0sXG4gKiB0aGlzIHNwZWNpZmllcyB0aGUgcGVudW1icmEgYW5nbGUgaW4gZGVncmVlcywgYWxsb3dpbmcgYSBzb2Z0IHNoYWRvdyBib3VuZGFyeS4gRGVmYXVsdHMgdG8gMC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYmFrZURpciBJZiBlbmFibGVkIGFuZCBiYWtlPXRydWUsIHRoZSBsaWdodCdzIGRpcmVjdGlvbiB3aWxsIGNvbnRyaWJ1dGUgdG9cbiAqIGRpcmVjdGlvbmFsIGxpZ2h0bWFwcy4gQmUgYXdhcmUsIHRoYXQgZGlyZWN0aW9uYWwgbGlnaHRtYXAgaXMgYW4gYXBwcm94aW1hdGlvbiBhbmQgY2FuIG9ubHkgaG9sZFxuICogc2luZ2xlIGRpcmVjdGlvbiBwZXIgcGl4ZWwuIEludGVyc2VjdGluZyBtdWx0aXBsZSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgbWF5IGxlYWQgdG8gaW5jb3JyZWN0XG4gKiBsb29rIG9mIHNwZWN1bGFyL2J1bXAtbWFwcGluZyBpbiB0aGUgYXJlYSBvZiBpbnRlcnNlY3Rpb24uIFRoZSBlcnJvciBpcyBub3QgYWx3YXlzIHZpc2libGVcbiAqIHRob3VnaCwgYW5kIGhpZ2hseSBzY2VuZS1kZXBlbmRlbnQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93VXBkYXRlTW9kZSBUZWxscyB0aGUgcmVuZGVyZXIgaG93IG9mdGVuIHNoYWRvd3MgbXVzdCBiZSB1cGRhdGVkIGZvclxuICogdGhpcyBsaWdodC4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIFNIQURPV1VQREFURV9OT05FfTogRG9uJ3QgcmVuZGVyIHNoYWRvd3MuXG4gKiAtIHtAbGluayBTSEFET1dVUERBVEVfVEhJU0ZSQU1FfTogUmVuZGVyIHNoYWRvd3Mgb25seSBvbmNlICh0aGVuIGF1dG9tYXRpY2FsbHkgc3dpdGNoZXMgdG9cbiAqIHtAbGluayBTSEFET1dVUERBVEVfTk9ORX0uXG4gKiAtIHtAbGluayBTSEFET1dVUERBVEVfUkVBTFRJTUV9OiBSZW5kZXIgc2hhZG93cyBldmVyeSBmcmFtZSAoZGVmYXVsdCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZG93VHlwZSBUeXBlIG9mIHNoYWRvd3MgYmVpbmcgcmVuZGVyZWQgYnkgdGhpcyBsaWdodC4gT3B0aW9uczpcbiAqXG4gKiAtIHtAbGluayBTSEFET1dfUENGM306IFJlbmRlciBkZXB0aCAoY29sb3ItcGFja2VkIG9uIFdlYkdMIDEuMCksIGNhbiBiZSB1c2VkIGZvciBQQ0YgM3gzXG4gKiBzYW1wbGluZy5cbiAqIC0ge0BsaW5rIFNIQURPV19WU004fTogUmVuZGVyIHBhY2tlZCB2YXJpYW5jZSBzaGFkb3cgbWFwLiBBbGwgc2hhZG93IHJlY2VpdmVycyBtdXN0IGFsc28gY2FzdFxuICogc2hhZG93cyBmb3IgdGhpcyBtb2RlIHRvIHdvcmsgY29ycmVjdGx5LlxuICogLSB7QGxpbmsgU0hBRE9XX1ZTTTE2fTogUmVuZGVyIDE2LWJpdCBleHBvbmVudGlhbCB2YXJpYW5jZSBzaGFkb3cgbWFwLiBSZXF1aXJlc1xuICogT0VTX3RleHR1cmVfaGFsZl9mbG9hdCBleHRlbnNpb24uIEZhbGxzIGJhY2sgdG8ge0BsaW5rIFNIQURPV19WU004fSwgaWYgbm90IHN1cHBvcnRlZC5cbiAqIC0ge0BsaW5rIFNIQURPV19WU00zMn06IFJlbmRlciAzMi1iaXQgZXhwb25lbnRpYWwgdmFyaWFuY2Ugc2hhZG93IG1hcC4gUmVxdWlyZXNcbiAqIE9FU190ZXh0dXJlX2Zsb2F0IGV4dGVuc2lvbi4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1ZTTTE2fSwgaWYgbm90IHN1cHBvcnRlZC5cbiAqIC0ge0BsaW5rIFNIQURPV19QQ0Y1fTogUmVuZGVyIGRlcHRoIGJ1ZmZlciBvbmx5LCBjYW4gYmUgdXNlZCBmb3IgaGFyZHdhcmUtYWNjZWxlcmF0ZWQgUENGIDV4NVxuICogc2FtcGxpbmcuIFJlcXVpcmVzIFdlYkdMMi4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1BDRjN9IG9uIFdlYkdMIDEuMC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSB2c21CbHVyTW9kZSBCbHVycmluZyBtb2RlIGZvciB2YXJpYW5jZSBzaGFkb3cgbWFwcy4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIEJMVVJfQk9YfTogQm94IGZpbHRlci5cbiAqIC0ge0BsaW5rIEJMVVJfR0FVU1NJQU59OiBHYXVzc2lhbiBmaWx0ZXIuIE1heSBsb29rIHNtb290aGVyIHRoYW4gYm94LCBidXQgcmVxdWlyZXMgbW9yZSBzYW1wbGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHZzbUJsdXJTaXplIE51bWJlciBvZiBzYW1wbGVzIHVzZWQgZm9yIGJsdXJyaW5nIGEgdmFyaWFuY2Ugc2hhZG93IG1hcC4gT25seVxuICogdW5ldmVuIG51bWJlcnMgd29yaywgZXZlbiBhcmUgaW5jcmVtZW50ZWQuIE1pbmltdW0gdmFsdWUgaXMgMSwgbWF4aW11bSBpcyAyNS4gRGVmYXVsdHMgdG8gMTEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29va2llQXNzZXQgQXNzZXQgdGhhdCBoYXMgdGV4dHVyZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdG8gY29va2llIGludGVybmFsbHlcbiAqIG9uY2UgYXNzZXQgcmVzb3VyY2UgaXMgYXZhaWxhYmxlLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfSBjb29raWUgUHJvamVjdGlvbiB0ZXh0dXJlLiBNdXN0IGJlIDJEIGZvciBzcG90IGFuZCBjdWJlbWFwIGZvciBvbW5pIGxpZ2h0XG4gKiAoaWdub3JlZCBpZiBpbmNvcnJlY3QgdHlwZSBpcyB1c2VkKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjb29raWVJbnRlbnNpdHkgUHJvamVjdGlvbiB0ZXh0dXJlIGludGVuc2l0eSAoZGVmYXVsdCBpcyAxKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gY29va2llRmFsbG9mZiBUb2dnbGUgbm9ybWFsIHNwb3RsaWdodCBmYWxsb2ZmIHdoZW4gcHJvamVjdGlvbiB0ZXh0dXJlIGlzXG4gKiB1c2VkLiBXaGVuIHNldCB0byBmYWxzZSwgc3BvdGxpZ2h0IHdpbGwgd29yayBsaWtlIGEgcHVyZSB0ZXh0dXJlIHByb2plY3RvciAob25seSBmYWRpbmcgd2l0aFxuICogZGlzdGFuY2UpLiBEZWZhdWx0IGlzIGZhbHNlLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGNvb2tpZUNoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHByb2plY3Rpb24gdGV4dHVyZSB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29va2llQW5nbGUgQW5nbGUgZm9yIHNwb3RsaWdodCBjb29raWUgcm90YXRpb24uXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNvb2tpZVNjYWxlIFNwb3RsaWdodCBjb29raWUgc2NhbGUuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNvb2tpZU9mZnNldCBTcG90bGlnaHQgY29va2llIHBvc2l0aW9uIG9mZnNldC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaXNTdGF0aWMgTWFyayBsaWdodCBhcyBub24tbW92YWJsZSAob3B0aW1pemF0aW9uKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyW119IGxheWVycyBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgbGlnaHQgc2hvdWxkXG4gKiBiZWxvbmcuIERvbid0IHB1c2gvcG9wL3NwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZVxuICogaW5zdGVhZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgTGlnaHRDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgTGlnaHRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xpZ2h0Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9jb29raWVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0SWQgPSBudWxsO1xuICAgICAgICB0aGlzLl9jb29raWVBc3NldEFkZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBudWxsO1xuICAgIH1cblxuICAgIGFkZExpZ2h0VG9MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTGlnaHQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVMaWdodEZyb21MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTGlnaHQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHRUb0xheWVycygpO1xuICAgICAgICB9XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZExpZ2h0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZUxpZ2h0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVmcmVzaFByb3BlcnRpZXMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX2xpZ2h0UHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBfbGlnaHRQcm9wc1tpXTtcblxuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgIHRoaXMub25FbmFibGUoKTtcbiAgICB9XG5cbiAgICB1cGRhdGVTaGFkb3coKSB7XG4gICAgICAgIHRoaXMubGlnaHQudXBkYXRlU2hhZG93KCk7XG4gICAgfVxuXG4gICAgb25Db29raWVBc3NldFNldCgpIHtcbiAgICAgICAgbGV0IGZvcmNlTG9hZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVBc3NldC50eXBlID09PSAnY3ViZW1hcCcgJiYgIXRoaXMuX2Nvb2tpZUFzc2V0LmxvYWRGYWNlcykge1xuICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXQubG9hZEZhY2VzID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvcmNlTG9hZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2Nvb2tpZUFzc2V0LnJlc291cmNlIHx8IGZvcmNlTG9hZClcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZCh0aGlzLl9jb29raWVBc3NldCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZUFzc2V0LnJlc291cmNlKVxuICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0TG9hZCgpO1xuICAgIH1cblxuICAgIG9uQ29va2llQXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZUFzc2V0SWQgIT09IGFzc2V0LmlkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0ID0gYXNzZXQ7XG5cbiAgICAgICAgaWYgKHRoaXMubGlnaHQuZW5hYmxlZClcbiAgICAgICAgICAgIHRoaXMub25Db29raWVBc3NldFNldCgpO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0Lm9uKCdsb2FkJywgdGhpcy5vbkNvb2tpZUFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLm9uQ29va2llQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uQ29va2llQXNzZXRMb2FkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2Nvb2tpZUFzc2V0IHx8ICF0aGlzLl9jb29raWVBc3NldC5yZXNvdXJjZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLmNvb2tpZSA9IHRoaXMuX2Nvb2tpZUFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIG9uQ29va2llQXNzZXRSZW1vdmUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llQXNzZXRJZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXRBZGQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX2Nvb2tpZUFzc2V0SWQsIHRoaXMub25Db29raWVBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldEFkZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZUFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldC5vZmYoJ2xvYWQnLCB0aGlzLm9uQ29va2llQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkNvb2tpZUFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29va2llID0gbnVsbDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5saWdodC5lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodFRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXQgJiYgIXRoaXMuY29va2llKVxuICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0U2V0KCk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLmxpZ2h0LmVuYWJsZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVtb3ZlTGlnaHRGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIC8vIHJlbW92ZSBmcm9tIGxheWVyc1xuICAgICAgICB0aGlzLm9uRGlzYWJsZSgpO1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgbGlnaHQgbm9kZVxuICAgICAgICB0aGlzLmxpZ2h0LmRlc3Ryb3koKTtcblxuICAgICAgICAvLyByZW1vdmUgY29va2llIGFzc2V0IGV2ZW50c1xuICAgICAgICB0aGlzLmNvb2tpZUFzc2V0ID0gbnVsbDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVQcm9wZXJ0eShuYW1lLCBkZWZhdWx0VmFsdWUsIHNldEZ1bmMsIHNraXBFcXVhbHNDaGVjaykge1xuICAgIGNvbnN0IGMgPSBMaWdodENvbXBvbmVudC5wcm90b3R5cGU7XG4gICAgX2xpZ2h0UHJvcHMucHVzaChuYW1lKTtcbiAgICBfbGlnaHRQcm9wc0RlZmF1bHQucHVzaChkZWZhdWx0VmFsdWUpO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGMsIG5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kYXRhW25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gZGF0YVtuYW1lXTtcbiAgICAgICAgICAgIGlmICghc2tpcEVxdWFsc0NoZWNrICYmIG9sZFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgICAgICAgICAgZGF0YVtuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgaWYgKHNldEZ1bmMpIHNldEZ1bmMuY2FsbCh0aGlzLCB2YWx1ZSwgb2xkVmFsdWUpO1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BzKCkge1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnZW5hYmxlZCcsIHRydWUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5vblNldEVuYWJsZWQobnVsbCwgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2xpZ2h0JywgbnVsbCk7XG4gICAgX2RlZmluZVByb3BlcnR5KCd0eXBlJywgJ2RpcmVjdGlvbmFsJywgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLnN5c3RlbS5jaGFuZ2VUeXBlKHRoaXMsIG9sZFZhbHVlLCBuZXdWYWx1ZSk7XG4gICAgICAgIC8vIHJlZnJlc2ggbGlnaHQgcHJvcGVydGllcyBiZWNhdXNlIGNoYW5naW5nIHRoZSB0eXBlIGRvZXMgbm90IHJlc2V0IHRoZVxuICAgICAgICAvLyBsaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMucmVmcmVzaFByb3BlcnRpZXMoKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2NvbG9yJywgbmV3IENvbG9yKDEsIDEsIDEpLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2V0Q29sb3IobmV3VmFsdWUpO1xuICAgIH0sIHRydWUpO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnaW50ZW5zaXR5JywgMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmludGVuc2l0eSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnbHVtaW5hbmNlJywgMCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0Lmx1bWluYW5jZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhcGUnLCBMSUdIVFNIQVBFX1BVTkNUVUFMLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhcGUgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nhc3RTaGFkb3dzJywgZmFsc2UsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jYXN0U2hhZG93cyA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnc2hhZG93RGlzdGFuY2UnLCA0MCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnNoYWRvd0Rpc3RhbmNlID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdzaGFkb3dJbnRlbnNpdHknLCAxLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93SW50ZW5zaXR5ID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdzaGFkb3dSZXNvbHV0aW9uJywgMTAyNCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnNoYWRvd1Jlc29sdXRpb24gPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd0JpYXMnLCAwLjA1LCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuc2hhZG93QmlhcyA9IC0wLjAxICogbWF0aC5jbGFtcChuZXdWYWx1ZSwgMCwgMSk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdudW1DYXNjYWRlcycsIDEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5udW1DYXNjYWRlcyA9IG1hdGguY2xhbXAoTWF0aC5mbG9vcihuZXdWYWx1ZSksIDEsIDQpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYmFrZU51bVNhbXBsZXMnLCAxLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuYmFrZU51bVNhbXBsZXMgPSBtYXRoLmNsYW1wKE1hdGguZmxvb3IobmV3VmFsdWUpLCAxLCAyNTUpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYmFrZUFyZWEnLCAwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuYmFrZUFyZWEgPSBtYXRoLmNsYW1wKG5ld1ZhbHVlLCAwLCAxODApO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY2FzY2FkZURpc3RyaWJ1dGlvbicsIDAuNSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmNhc2NhZGVEaXN0cmlidXRpb24gPSBtYXRoLmNsYW1wKG5ld1ZhbHVlLCAwLCAxKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ25vcm1hbE9mZnNldEJpYXMnLCAwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQubm9ybWFsT2Zmc2V0QmlhcyA9IG1hdGguY2xhbXAobmV3VmFsdWUsIDAsIDEpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgncmFuZ2UnLCAxMCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmF0dGVudWF0aW9uRW5kID0gbmV3VmFsdWU7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdpbm5lckNvbmVBbmdsZScsIDQwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuaW5uZXJDb25lQW5nbGUgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ291dGVyQ29uZUFuZ2xlJywgNDUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5vdXRlckNvbmVBbmdsZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnZmFsbG9mZk1vZGUnLCBMSUdIVEZBTExPRkZfTElORUFSLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuZmFsbG9mZk1vZGUgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd1R5cGUnLCBTSEFET1dfUENGMywgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnNoYWRvd1R5cGUgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3ZzbUJsdXJTaXplJywgMTEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC52c21CbHVyU2l6ZSA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgndnNtQmx1ck1vZGUnLCBCTFVSX0dBVVNTSUFOLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQudnNtQmx1ck1vZGUgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3ZzbUJpYXMnLCAwLjAxICogMC4yNSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LnZzbUJpYXMgPSBtYXRoLmNsYW1wKG5ld1ZhbHVlLCAwLCAxKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nvb2tpZUFzc2V0JywgbnVsbCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQXNzZXRJZCAmJiAoKG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQgJiYgbmV3VmFsdWUuaWQgPT09IHRoaXMuX2Nvb2tpZUFzc2V0SWQpIHx8IG5ld1ZhbHVlID09PSB0aGlzLl9jb29raWVBc3NldElkKSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLm9uQ29va2llQXNzZXRSZW1vdmUoKTtcbiAgICAgICAgdGhpcy5fY29va2llQXNzZXRJZCA9IG51bGw7XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5jb29raWVBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgdGhpcy5fY29va2llQXNzZXRJZCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgdGhpcy5vbkNvb2tpZUFzc2V0QWRkKG5ld1ZhbHVlKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmV3VmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVBc3NldElkID0gbmV3VmFsdWU7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMub25Db29raWVBc3NldEFkZChhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2Nvb2tpZUFzc2V0QWRkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX2Nvb2tpZUFzc2V0SWQsIHRoaXMub25Db29raWVBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nvb2tpZScsIG51bGwsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWUgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nvb2tpZUludGVuc2l0eScsIDEsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWVJbnRlbnNpdHkgPSBtYXRoLmNsYW1wKG5ld1ZhbHVlLCAwLCAxKTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nvb2tpZUZhbGxvZmYnLCB0cnVlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuY29va2llRmFsbG9mZiA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llQ2hhbm5lbCcsICdyZ2InLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMubGlnaHQuY29va2llQ2hhbm5lbCA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnY29va2llQW5nbGUnLCAwLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSAhPT0gMCB8fCB0aGlzLmNvb2tpZVNjYWxlICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2Nvb2tpZU1hdHJpeCkgdGhpcy5fY29va2llTWF0cml4ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgICAgIGxldCBzY3ggPSAxO1xuICAgICAgICAgICAgbGV0IHNjeSA9IDE7XG4gICAgICAgICAgICBpZiAodGhpcy5jb29raWVTY2FsZSkge1xuICAgICAgICAgICAgICAgIHNjeCA9IHRoaXMuY29va2llU2NhbGUueDtcbiAgICAgICAgICAgICAgICBzY3kgPSB0aGlzLmNvb2tpZVNjYWxlLnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjID0gTWF0aC5jb3MobmV3VmFsdWUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICAgICAgY29uc3QgcyA9IE1hdGguc2luKG5ld1ZhbHVlICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeC5zZXQoYyAvIHNjeCwgLXMgLyBzY3gsIHMgLyBzY3ksIGMgLyBzY3kpO1xuICAgICAgICAgICAgdGhpcy5saWdodC5jb29raWVUcmFuc2Zvcm0gPSB0aGlzLl9jb29raWVNYXRyaXg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZVRyYW5zZm9ybSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nvb2tpZVNjYWxlJywgbnVsbCwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICBpZiAobmV3VmFsdWUgIT09IG51bGwgfHwgdGhpcy5jb29raWVBbmdsZSAhPT0gMCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9jb29raWVNYXRyaXgpIHRoaXMuX2Nvb2tpZU1hdHJpeCA9IG5ldyBWZWM0KCk7XG4gICAgICAgICAgICBjb25zdCBzY3ggPSBuZXdWYWx1ZS54O1xuICAgICAgICAgICAgY29uc3Qgc2N5ID0gbmV3VmFsdWUueTtcbiAgICAgICAgICAgIGNvbnN0IGMgPSBNYXRoLmNvcyh0aGlzLmNvb2tpZUFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBNYXRoLnNpbih0aGlzLmNvb2tpZUFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeC5zZXQoYyAvIHNjeCwgLXMgLyBzY3gsIHMgLyBzY3ksIGMgLyBzY3kpO1xuICAgICAgICAgICAgdGhpcy5saWdodC5jb29raWVUcmFuc2Zvcm0gPSB0aGlzLl9jb29raWVNYXRyaXg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0LmNvb2tpZVRyYW5zZm9ybSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9LCB0cnVlKTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Nvb2tpZU9mZnNldCcsIG51bGwsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5jb29raWVPZmZzZXQgPSBuZXdWYWx1ZTtcbiAgICB9LCB0cnVlKTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ3NoYWRvd1VwZGF0ZU1vZGUnLCBTSEFET1dVUERBVEVfUkVBTFRJTUUsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5zaGFkb3dVcGRhdGVNb2RlID0gbmV3VmFsdWU7XG4gICAgfSwgdHJ1ZSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdtYXNrJywgMSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0Lm1hc2sgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2FmZmVjdER5bmFtaWMnLCB0cnVlLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrIHw9IE1BU0tfQUZGRUNUX0RZTkFNSUM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Lm1hc2sgJj0gfk1BU0tfQUZGRUNUX0RZTkFNSUM7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5saWdodC5sYXllcnNEaXJ0eSgpO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnYWZmZWN0TGlnaHRtYXBwZWQnLCBmYWxzZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQubWFzayB8PSBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRDtcbiAgICAgICAgICAgIGlmICh0aGlzLmJha2UpIHRoaXMubGlnaHQubWFzayAmPSB+TUFTS19CQUtFO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5saWdodC5tYXNrICY9IH5NQVNLX0FGRkVDVF9MSUdIVE1BUFBFRDtcbiAgICAgICAgICAgIGlmICh0aGlzLmJha2UpIHRoaXMubGlnaHQubWFzayB8PSBNQVNLX0JBS0U7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2Jha2UnLCBmYWxzZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQubWFzayB8PSBNQVNLX0JBS0U7XG4gICAgICAgICAgICBpZiAodGhpcy5hZmZlY3RMaWdodG1hcHBlZCkgdGhpcy5saWdodC5tYXNrICY9IH5NQVNLX0FGRkVDVF9MSUdIVE1BUFBFRDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHQubWFzayAmPSB+TUFTS19CQUtFO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWZmZWN0TGlnaHRtYXBwZWQpIHRoaXMubGlnaHQubWFzayB8PSBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpZ2h0LmxheWVyc0RpcnR5KCk7XG4gICAgfSk7XG4gICAgX2RlZmluZVByb3BlcnR5KCdiYWtlRGlyJywgdHJ1ZSwgZnVuY3Rpb24gKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICB0aGlzLmxpZ2h0LmJha2VEaXIgPSBuZXdWYWx1ZTtcbiAgICB9KTtcbiAgICBfZGVmaW5lUHJvcGVydHkoJ2lzU3RhdGljJywgZmFsc2UsIGZ1bmN0aW9uIChuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5saWdodC5pc1N0YXRpYyA9IG5ld1ZhbHVlO1xuICAgIH0pO1xuICAgIF9kZWZpbmVQcm9wZXJ0eSgnbGF5ZXJzJywgW0xBWUVSSURfV09STERdLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQob2xkVmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVMaWdodCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5ld1ZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKG5ld1ZhbHVlW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTGlnaHQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZVByb3BzKCk7XG5cbmV4cG9ydCB7IF9saWdodFByb3BzLCBfbGlnaHRQcm9wc0RlZmF1bHQsIExpZ2h0Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiX2xpZ2h0UHJvcHMiLCJfbGlnaHRQcm9wc0RlZmF1bHQiLCJMaWdodENvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX2Nvb2tpZUFzc2V0IiwiX2Nvb2tpZUFzc2V0SWQiLCJfY29va2llQXNzZXRBZGQiLCJfY29va2llTWF0cml4IiwiYWRkTGlnaHRUb0xheWVycyIsImkiLCJsYXllcnMiLCJsZW5ndGgiLCJsYXllciIsImFwcCIsInNjZW5lIiwiZ2V0TGF5ZXJCeUlkIiwiYWRkTGlnaHQiLCJyZW1vdmVMaWdodEZyb21MYXllcnMiLCJyZW1vdmVMaWdodCIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwiZW5hYmxlZCIsIm9mZiIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwib24iLCJpbmRleCIsImluZGV4T2YiLCJpZCIsInJlZnJlc2hQcm9wZXJ0aWVzIiwibmFtZSIsIm9uRW5hYmxlIiwidXBkYXRlU2hhZG93IiwibGlnaHQiLCJvbkNvb2tpZUFzc2V0U2V0IiwiZm9yY2VMb2FkIiwidHlwZSIsImxvYWRGYWNlcyIsInJlc291cmNlIiwiYXNzZXRzIiwibG9hZCIsIm9uQ29va2llQXNzZXRMb2FkIiwib25Db29raWVBc3NldEFkZCIsImFzc2V0Iiwib25Db29raWVBc3NldFJlbW92ZSIsImNvb2tpZSIsIm9uRGlzYWJsZSIsIm9uUmVtb3ZlIiwiZGVzdHJveSIsImNvb2tpZUFzc2V0IiwiX2RlZmluZVByb3BlcnR5IiwiZGVmYXVsdFZhbHVlIiwic2V0RnVuYyIsInNraXBFcXVhbHNDaGVjayIsImMiLCJwcm90b3R5cGUiLCJwdXNoIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXQiLCJkYXRhIiwic2V0IiwidmFsdWUiLCJvbGRWYWx1ZSIsImNhbGwiLCJjb25maWd1cmFibGUiLCJfZGVmaW5lUHJvcHMiLCJuZXdWYWx1ZSIsIm9uU2V0RW5hYmxlZCIsImNoYW5nZVR5cGUiLCJDb2xvciIsInNldENvbG9yIiwiaW50ZW5zaXR5IiwibHVtaW5hbmNlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsInNoYXBlIiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dEaXN0YW5jZSIsInNoYWRvd0ludGVuc2l0eSIsInNoYWRvd1Jlc29sdXRpb24iLCJzaGFkb3dCaWFzIiwibWF0aCIsImNsYW1wIiwibnVtQ2FzY2FkZXMiLCJNYXRoIiwiZmxvb3IiLCJiYWtlTnVtU2FtcGxlcyIsImJha2VBcmVhIiwiY2FzY2FkZURpc3RyaWJ1dGlvbiIsIm5vcm1hbE9mZnNldEJpYXMiLCJhdHRlbnVhdGlvbkVuZCIsImlubmVyQ29uZUFuZ2xlIiwib3V0ZXJDb25lQW5nbGUiLCJMSUdIVEZBTExPRkZfTElORUFSIiwiZmFsbG9mZk1vZGUiLCJTSEFET1dfUENGMyIsInNoYWRvd1R5cGUiLCJ2c21CbHVyU2l6ZSIsIkJMVVJfR0FVU1NJQU4iLCJ2c21CbHVyTW9kZSIsInZzbUJpYXMiLCJBc3NldCIsImNvb2tpZUludGVuc2l0eSIsImNvb2tpZUZhbGxvZmYiLCJjb29raWVDaGFubmVsIiwiY29va2llU2NhbGUiLCJWZWM0Iiwic2N4Iiwic2N5IiwieCIsInkiLCJjb3MiLCJERUdfVE9fUkFEIiwicyIsInNpbiIsImNvb2tpZVRyYW5zZm9ybSIsImNvb2tpZUFuZ2xlIiwiY29va2llT2Zmc2V0IiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwic2hhZG93VXBkYXRlTW9kZSIsIm1hc2siLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwibGF5ZXJzRGlydHkiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsImJha2UiLCJNQVNLX0JBS0UiLCJhZmZlY3RMaWdodG1hcHBlZCIsImJha2VEaXIiLCJpc1N0YXRpYyIsIkxBWUVSSURfV09STEQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQXNCTUEsTUFB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
