/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../../core/debug.js';
import { Asset } from '../../asset/asset.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimController } from '../../anim/controller/anim-controller.js';
import { Component } from '../component.js';
import { ANIM_CONTROL_STATES, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_INTEGER, ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_TRIGGER } from '../../anim/controller/constants.js';
import { AnimComponentBinder } from './component-binder.js';
import { AnimComponentLayer } from './component-layer.js';
import { AnimStateGraph } from '../../anim/state-graph/anim-state-graph.js';
import { Entity } from '../../entity.js';

class AnimComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._stateGraphAsset = null;
    this._animationAssets = {};
    this._speed = 1.0;
    this._activate = true;
    this._playing = false;
    this._rootBone = null;
    this._stateGraph = null;
    this._layers = [];
    this._layerIndices = {};
    this._parameters = {};
    this._targets = {};
    this._consumedTriggers = new Set();
    this._normalizeWeights = false;
  }
  set stateGraphAsset(value) {
    if (value === null) {
      this.removeStateGraph();
      return;
    }

    if (this._stateGraphAsset) {
      const stateGraphAsset = this.system.app.assets.get(this._stateGraphAsset);
      stateGraphAsset.off('change', this._onStateGraphAssetChangeEvent, this);
    }
    let _id;
    let _asset;
    if (value instanceof Asset) {
      _id = value.id;
      _asset = this.system.app.assets.get(_id);
      if (!_asset) {
        this.system.app.assets.add(value);
        _asset = this.system.app.assets.get(_id);
      }
    } else {
      _id = value;
      _asset = this.system.app.assets.get(_id);
    }
    if (!_asset || this._stateGraphAsset === _id) {
      return;
    }
    if (_asset.resource) {
      this._stateGraph = _asset.resource;
      this.loadStateGraph(this._stateGraph);
      _asset.on('change', this._onStateGraphAssetChangeEvent, this);
    } else {
      _asset.once('load', asset => {
        this._stateGraph = asset.resource;
        this.loadStateGraph(this._stateGraph);
      });
      _asset.on('change', this._onStateGraphAssetChangeEvent, this);
      this.system.app.assets.load(_asset);
    }
    this._stateGraphAsset = _id;
  }
  get stateGraphAsset() {
    return this._stateGraphAsset;
  }

  set normalizeWeights(value) {
    this._normalizeWeights = value;
    this.unbind();
  }
  get normalizeWeights() {
    return this._normalizeWeights;
  }
  set animationAssets(value) {
    this._animationAssets = value;
    this.loadAnimationAssets();
  }
  get animationAssets() {
    return this._animationAssets;
  }

  set speed(value) {
    this._speed = value;
  }
  get speed() {
    return this._speed;
  }

  set activate(value) {
    this._activate = value;
  }
  get activate() {
    return this._activate;
  }

  set playing(value) {
    this._playing = value;
  }
  get playing() {
    return this._playing;
  }

  set rootBone(value) {
    if (typeof value === 'string') {
      const entity = this.entity.root.findByGuid(value);
      Debug.assert(entity, `rootBone entity for supplied guid:${value} cannot be found in the scene`);
      this._rootBone = entity;
    } else if (value instanceof Entity) {
      this._rootBone = value;
    } else {
      this._rootBone = null;
    }
    this.rebind();
  }
  get rootBone() {
    return this._rootBone;
  }
  set stateGraph(value) {
    this._stateGraph = value;
  }
  get stateGraph() {
    return this._stateGraph;
  }

  get layers() {
    return this._layers;
  }
  set layerIndices(value) {
    this._layerIndices = value;
  }
  get layerIndices() {
    return this._layerIndices;
  }
  set parameters(value) {
    this._parameters = value;
  }
  get parameters() {
    return this._parameters;
  }
  set targets(value) {
    this._targets = value;
  }
  get targets() {
    return this._targets;
  }

  get playable() {
    for (let i = 0; i < this._layers.length; i++) {
      if (!this._layers[i].playable) {
        return false;
      }
    }
    return true;
  }

  get baseLayer() {
    if (this._layers.length > 0) {
      return this._layers[0];
    }
    return null;
  }
  _onStateGraphAssetChangeEvent(asset) {
    const prevAnimationAssets = this.animationAssets;
    const prevMasks = this.layers.map(layer => layer.mask);
    this.removeStateGraph();
    this._stateGraph = new AnimStateGraph(asset._data);
    this.loadStateGraph(this._stateGraph);
    this.animationAssets = prevAnimationAssets;
    this.loadAnimationAssets();
    this.layers.forEach((layer, i) => {
      layer.mask = prevMasks[i];
    });
    this.rebind();
  }
  dirtifyTargets() {
    const targets = Object.values(this._targets);
    for (let i = 0; i < targets.length; i++) {
      targets[i].dirty = true;
    }
  }
  _addLayer({
    name,
    states,
    transitions,
    weight,
    mask,
    blendType
  }) {
    let graph;
    if (this.rootBone) {
      graph = this.rootBone;
    } else {
      graph = this.entity;
    }
    const layerIndex = this._layers.length;
    const animBinder = new AnimComponentBinder(this, graph, name, mask, layerIndex);
    const animEvaluator = new AnimEvaluator(animBinder);
    const controller = new AnimController(animEvaluator, states, transitions, this._parameters, this._activate, this, this._consumedTriggers);
    this._layers.push(new AnimComponentLayer(name, controller, this, weight, blendType));
    this._layerIndices[name] = layerIndex;
    return this._layers[layerIndex];
  }

  addLayer(name, weight, mask, blendType) {
    const layer = this.findAnimationLayer(name);
    if (layer) return layer;
    const states = [{
      'name': 'START',
      'speed': 1
    }];
    const transitions = [];
    return this._addLayer({
      name,
      states,
      transitions,
      weight,
      mask,
      blendType
    });
  }

  loadStateGraph(stateGraph) {
    this._stateGraph = stateGraph;
    this._parameters = {};
    const paramKeys = Object.keys(stateGraph.parameters);
    for (let i = 0; i < paramKeys.length; i++) {
      const paramKey = paramKeys[i];
      this._parameters[paramKey] = {
        type: stateGraph.parameters[paramKey].type,
        value: stateGraph.parameters[paramKey].value
      };
    }
    this._layers = [];
    for (let i = 0; i < stateGraph.layers.length; i++) {
      const layer = stateGraph.layers[i];
      this._addLayer.bind(this)(_extends({}, layer));
    }
    this.setupAnimationAssets();
  }
  setupAnimationAssets() {
    for (let i = 0; i < this._layers.length; i++) {
      const layer = this._layers[i];
      const layerName = layer.name;
      for (let j = 0; j < layer.states.length; j++) {
        const stateName = layer.states[j];
        if (ANIM_CONTROL_STATES.indexOf(stateName) === -1) {
          const stateKey = layerName + ':' + stateName;
          if (!this._animationAssets[stateKey]) {
            this._animationAssets[stateKey] = {
              asset: null
            };
          }
        }
      }
    }
    this.loadAnimationAssets();
  }
  loadAnimationAssets() {
    for (let i = 0; i < this._layers.length; i++) {
      const layer = this._layers[i];
      for (let j = 0; j < layer.states.length; j++) {
        const stateName = layer.states[j];
        if (ANIM_CONTROL_STATES.indexOf(stateName) !== -1) continue;
        const animationAsset = this._animationAssets[layer.name + ':' + stateName];
        if (!animationAsset || !animationAsset.asset) {
          this.removeNodeAnimations(stateName, layer.name);
          continue;
        }
        const assetId = animationAsset.asset;
        const asset = this.system.app.assets.get(assetId);
        if (asset) {
          if (asset.resource) {
            this.onAnimationAssetLoaded(layer.name, stateName, asset);
          } else {
            asset.once('load', function (layerName, stateName) {
              return function (asset) {
                this.onAnimationAssetLoaded(layerName, stateName, asset);
              }.bind(this);
            }.bind(this)(layer.name, stateName));
            this.system.app.assets.load(asset);
          }
        }
      }
    }
  }
  onAnimationAssetLoaded(layerName, stateName, asset) {
    this.findAnimationLayer(layerName).assignAnimation(stateName, asset.resource);
  }

  removeStateGraph() {
    this._stateGraph = null;
    this._stateGraphAsset = null;
    this._animationAssets = {};
    this._layers = [];
    this._layerIndices = {};
    this._parameters = {};
    this._playing = false;
    this.unbind();
    this._targets = {};
  }

  reset() {
    this._parameters = Object.assign({}, this._stateGraph.parameters);
    for (let i = 0; i < this._layers.length; i++) {
      const layerPlaying = this._layers[i].playing;
      this._layers[i].reset();
      this._layers[i].playing = layerPlaying;
    }
  }
  unbind() {
    if (!this._normalizeWeights) {
      Object.keys(this._targets).forEach(targetKey => {
        this._targets[targetKey].unbind();
      });
    }
  }

  rebind() {
    this._targets = {};
    for (let i = 0; i < this._layers.length; i++) {
      this._layers[i].rebind();
    }
  }

  findAnimationLayer(name) {
    const layerIndex = this._layerIndices[name];
    return this._layers[layerIndex] || null;
  }
  addAnimationState(nodeName, animTrack, speed = 1, loop = true, layerName = 'Base') {
    if (!this._stateGraph) {
      this.loadStateGraph(new AnimStateGraph({
        'layers': [{
          'name': layerName,
          'states': [{
            'name': 'START',
            'speed': 1
          }, {
            'name': nodeName,
            'speed': speed,
            'loop': loop,
            'defaultState': true
          }],
          'transitions': [{
            'from': 'START',
            'to': nodeName
          }]
        }],
        'parameters': {}
      }));
    }
    const layer = this.findAnimationLayer(layerName);
    if (layer) {
      layer.assignAnimation(nodeName, animTrack, speed, loop);
    } else {
      var _this$addLayer;
      (_this$addLayer = this.addLayer(layerName)) == null ? void 0 : _this$addLayer.assignAnimation(nodeName, animTrack, speed, loop);
    }
  }

  assignAnimation(nodePath, animTrack, layerName, speed = 1, loop = true) {
    if (!this._stateGraph && nodePath.indexOf('.') === -1) {
      this.loadStateGraph(new AnimStateGraph({
        'layers': [{
          'name': 'Base',
          'states': [{
            'name': 'START',
            'speed': 1
          }, {
            'name': nodePath,
            'speed': speed,
            'loop': loop,
            'defaultState': true
          }],
          'transitions': [{
            'from': 'START',
            'to': nodePath
          }]
        }],
        'parameters': {}
      }));
      this.baseLayer.assignAnimation(nodePath, animTrack);
      return;
    }
    const layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
    if (!layer) {
      Debug.error('assignAnimation: Trying to assign an anim track to a layer that doesn\'t exist');
      return;
    }
    layer.assignAnimation(nodePath, animTrack, speed, loop);
  }

  removeNodeAnimations(nodeName, layerName) {
    const layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
    if (!layer) {
      Debug.error('removeStateAnimations: Trying to remove animation tracks from a state before the state graph has been loaded. Have you called loadStateGraph?');
      return;
    }
    layer.removeNodeAnimations(nodeName);
  }
  getParameterValue(name, type) {
    const param = this._parameters[name];
    if (param && param.type === type) {
      return param.value;
    }
    Debug.log(`Cannot get parameter value. No parameter found in anim controller named "${name}" of type "${type}"`);
    return undefined;
  }
  setParameterValue(name, type, value) {
    const param = this._parameters[name];
    if (param && param.type === type) {
      param.value = value;
      return;
    }
    Debug.log(`Cannot set parameter value. No parameter found in anim controller named "${name}" of type "${type}"`);
  }

  getFloat(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_FLOAT);
  }

  setFloat(name, value) {
    this.setParameterValue(name, ANIM_PARAMETER_FLOAT, value);
  }

  getInteger(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_INTEGER);
  }

  setInteger(name, value) {
    if (typeof value === 'number' && value % 1 === 0) {
      this.setParameterValue(name, ANIM_PARAMETER_INTEGER, value);
    } else {
      Debug.error('Attempting to assign non integer value to integer parameter');
    }
  }

  getBoolean(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_BOOLEAN);
  }

  setBoolean(name, value) {
    this.setParameterValue(name, ANIM_PARAMETER_BOOLEAN, !!value);
  }

  getTrigger(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_TRIGGER);
  }

  setTrigger(name, singleFrame = false) {
    this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, true);
    if (singleFrame) {
      this._consumedTriggers.add(name);
    }
  }

  resetTrigger(name) {
    this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, false);
  }
  onBeforeRemove() {
    if (Number.isFinite(this._stateGraphAsset)) {
      const stateGraphAsset = this.system.app.assets.get(this._stateGraphAsset);
      stateGraphAsset.off('change', this._onStateGraphAssetChangeEvent, this);
    }
  }
  update(dt) {
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].update(dt * this.speed);
    }
    this._consumedTriggers.forEach(trigger => {
      this.parameters[trigger].value = false;
    });
    this._consumedTriggers.clear();
  }
  resolveDuplicatedEntityReferenceProperties(oldAnim, duplicatedIdsMap) {
    if (oldAnim.rootBone && duplicatedIdsMap[oldAnim.rootBone.getGuid()]) {
      this.rootBone = duplicatedIdsMap[oldAnim.rootBone.getGuid()];
    } else {
      this.rebind();
    }
  }
}

export { AnimComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvYW5pbS1jb250cm9sbGVyLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHtcbiAgICBBTklNX1BBUkFNRVRFUl9CT09MRUFOLCBBTklNX1BBUkFNRVRFUl9GTE9BVCwgQU5JTV9QQVJBTUVURVJfSU5URUdFUiwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEFuaW1Db21wb25lbnRCaW5kZXIgfSBmcm9tICcuL2NvbXBvbmVudC1iaW5kZXIuanMnO1xuaW1wb3J0IHsgQW5pbUNvbXBvbmVudExheWVyIH0gZnJvbSAnLi9jb21wb25lbnQtbGF5ZXIuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlR3JhcGggfSBmcm9tICcuLi8uLi9hbmltL3N0YXRlLWdyYXBoL2FuaW0tc3RhdGUtZ3JhcGguanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQW5pbUNvbXBvbmVudFN5c3RlbX0gQW5pbUNvbXBvbmVudFN5c3RlbSAqL1xuXG4vKipcbiAqIFRoZSBBbmltIENvbXBvbmVudCBhbGxvd3MgYW4gRW50aXR5IHRvIHBsYXliYWNrIGFuaW1hdGlvbnMgb24gbW9kZWxzIGFuZCBlbnRpdHkgcHJvcGVydGllcy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIEFuaW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBbmltQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUge0BsaW5rIENvbXBvbmVudFN5c3RlbX0gdGhhdCBjcmVhdGVkIHRoaXNcbiAgICAgKiBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzID0ge307XG4gICAgICAgIHRoaXMuX3NwZWVkID0gMS4wO1xuICAgICAgICB0aGlzLl9hY3RpdmF0ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW107XG4gICAgICAgIHRoaXMuX2xheWVySW5kaWNlcyA9IHt9O1xuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzID0ge307XG4gICAgICAgIC8vIGEgY29sbGVjdGlvbiBvZiBhbmltYXRlZCBwcm9wZXJ0eSB0YXJnZXRzXG4gICAgICAgIHRoaXMuX3RhcmdldHMgPSB7fTtcbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2VycyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fbm9ybWFsaXplV2VpZ2h0cyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHNldCBzdGF0ZUdyYXBoQXNzZXQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZVN0YXRlR3JhcGgoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBldmVudCBmcm9tIHByZXZpb3VzIGFzc2V0XG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZUdyYXBoQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlR3JhcGhBc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3N0YXRlR3JhcGhBc3NldCk7XG4gICAgICAgICAgICBzdGF0ZUdyYXBoQXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50LCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBfaWQ7XG4gICAgICAgIGxldCBfYXNzZXQ7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICAgICAgX2Fzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoX2lkKTtcbiAgICAgICAgICAgIGlmICghX2Fzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5hZGQodmFsdWUpO1xuICAgICAgICAgICAgICAgIF9hc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KF9pZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZTtcbiAgICAgICAgICAgIF9hc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KF9pZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFfYXNzZXQgfHwgdGhpcy5fc3RhdGVHcmFwaEFzc2V0ID09PSBfaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBfYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKHRoaXMuX3N0YXRlR3JhcGgpO1xuICAgICAgICAgICAgX2Fzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50LCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9hc3NldC5vbmNlKCdsb2FkJywgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IGFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZFN0YXRlR3JhcGgodGhpcy5fc3RhdGVHcmFwaCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIF9hc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoX2Fzc2V0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoQXNzZXQgPSBfaWQ7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXRlR3JhcGhBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlR3JhcGhBc3NldDtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGFuaW1hdGlvbiBjb21wb25lbnQgd2lsbCBub3JtYWxpemUgdGhlIHdlaWdodHMgb2YgaXRzIGxheWVycyBieSB0aGVpciBzdW0gdG90YWwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbm9ybWFsaXplV2VpZ2h0cyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9ub3JtYWxpemVXZWlnaHRzID0gdmFsdWU7XG4gICAgICAgIHRoaXMudW5iaW5kKCk7XG4gICAgfVxuXG4gICAgZ2V0IG5vcm1hbGl6ZVdlaWdodHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ub3JtYWxpemVXZWlnaHRzO1xuICAgIH1cblxuICAgIHNldCBhbmltYXRpb25Bc3NldHModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzID0gdmFsdWU7XG4gICAgICAgIHRoaXMubG9hZEFuaW1hdGlvbkFzc2V0cygpO1xuICAgIH1cblxuICAgIGdldCBhbmltYXRpb25Bc3NldHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmltYXRpb25Bc3NldHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlZWQgbXVsdGlwbGllciBmb3IgYW5pbWF0aW9uIHBsYXkgYmFjayBzcGVlZC4gMS4wIGlzIHBsYXliYWNrIGF0IG5vcm1hbCBzcGVlZCwgMC4wIHBhdXNlc1xuICAgICAqIHRoZSBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzcGVlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zcGVlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwZWVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGZpcnN0IGFuaW1hdGlvbiB3aWxsIGJlZ2luIHBsYXlpbmcgd2hlbiB0aGUgc2NlbmUgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGFjdGl2YXRlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FjdGl2YXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZhdGU7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBQbGF5cyBvciBwYXVzZXMgYWxsIGFuaW1hdGlvbnMgaW4gdGhlIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBwbGF5aW5nKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcGxheWluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BsYXlpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGVudGl0eSB0aGF0IHRoaXMgYW5pbSBjb21wb25lbnQgc2hvdWxkIHVzZSBhcyB0aGUgcm9vdCBvZiB0aGUgYW5pbWF0aW9uIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICovXG4gICAgc2V0IHJvb3RCb25lKHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eS5yb290LmZpbmRCeUd1aWQodmFsdWUpO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGVudGl0eSwgYHJvb3RCb25lIGVudGl0eSBmb3Igc3VwcGxpZWQgZ3VpZDoke3ZhbHVlfSBjYW5ub3QgYmUgZm91bmQgaW4gdGhlIHNjZW5lYCk7XG4gICAgICAgICAgICB0aGlzLl9yb290Qm9uZSA9IGVudGl0eTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSB2YWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Jvb3RCb25lID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlYmluZCgpO1xuICAgIH1cblxuICAgIGdldCByb290Qm9uZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jvb3RCb25lO1xuICAgIH1cblxuICAgIHNldCBzdGF0ZUdyYXBoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc3RhdGVHcmFwaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlR3JhcGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgYW5pbWF0aW9uIGxheWVycyBhdmFpbGFibGUgaW4gdGhpcyBhbmltIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBbmltQ29tcG9uZW50TGF5ZXJbXX1cbiAgICAgKi9cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIHNldCBsYXllckluZGljZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXJJbmRpY2VzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVySW5kaWNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVySW5kaWNlcztcbiAgICB9XG5cbiAgICBzZXQgcGFyYW1ldGVycyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHBhcmFtZXRlcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIHNldCB0YXJnZXRzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3RhcmdldHMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgdGFyZ2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RhcmdldHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB3aGV0aGVyIGFsbCBjb21wb25lbnQgbGF5ZXJzIGFyZSBjdXJyZW50bHkgcGxheWFibGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgcGxheWFibGUoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2xheWVyc1tpXS5wbGF5YWJsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBiYXNlIGxheWVyIG9mIHRoZSBzdGF0ZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBbmltQ29tcG9uZW50TGF5ZXJ8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgYmFzZUxheWVyKCkge1xuICAgICAgICBpZiAodGhpcy5fbGF5ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9sYXllcnNbMF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQoYXNzZXQpIHtcbiAgICAgICAgLy8gYm90aCBhbmltYXRpb25Bc3NldHMgYW5kIGxheWVyIG1hc2tzIHNob3VsZCBiZSBtYWludGFpbmVkIHdoZW4gc3dpdGNoaW5nIEFuaW1TdGF0ZUdyYXBoIGFzc2V0c1xuICAgICAgICBjb25zdCBwcmV2QW5pbWF0aW9uQXNzZXRzID0gdGhpcy5hbmltYXRpb25Bc3NldHM7XG4gICAgICAgIGNvbnN0IHByZXZNYXNrcyA9IHRoaXMubGF5ZXJzLm1hcChsYXllciA9PiBsYXllci5tYXNrKTtcbiAgICAgICAgLy8gY2xlYXIgdGhlIHByZXZpb3VzIHN0YXRlIGdyYXBoXG4gICAgICAgIHRoaXMucmVtb3ZlU3RhdGVHcmFwaCgpO1xuICAgICAgICAvLyBsb2FkIHRoZSBuZXcgc3RhdGUgZ3JhcGhcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IG5ldyBBbmltU3RhdGVHcmFwaChhc3NldC5fZGF0YSk7XG4gICAgICAgIHRoaXMubG9hZFN0YXRlR3JhcGgodGhpcy5fc3RhdGVHcmFwaCk7XG4gICAgICAgIC8vIGFzc2lnbiB0aGUgcHJldmlvdXMgYW5pbWF0aW9uIGFzc2V0c1xuICAgICAgICB0aGlzLmFuaW1hdGlvbkFzc2V0cyA9IHByZXZBbmltYXRpb25Bc3NldHM7XG4gICAgICAgIHRoaXMubG9hZEFuaW1hdGlvbkFzc2V0cygpO1xuICAgICAgICAvLyBhc3NpZ24gdGhlIHByZXZpb3VzIGxheWVyIG1hc2tzIHRoZW4gcmViaW5kIGFsbCBhbmltIHRhcmdldHNcbiAgICAgICAgdGhpcy5sYXllcnMuZm9yRWFjaCgobGF5ZXIsIGkpID0+IHtcbiAgICAgICAgICAgIGxheWVyLm1hc2sgPSBwcmV2TWFza3NbaV07XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlYmluZCgpO1xuICAgIH1cblxuICAgIGRpcnRpZnlUYXJnZXRzKCkge1xuICAgICAgICBjb25zdCB0YXJnZXRzID0gT2JqZWN0LnZhbHVlcyh0aGlzLl90YXJnZXRzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YXJnZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0YXJnZXRzW2ldLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9hZGRMYXllcih7IG5hbWUsIHN0YXRlcywgdHJhbnNpdGlvbnMsIHdlaWdodCwgbWFzaywgYmxlbmRUeXBlIH0pIHtcbiAgICAgICAgbGV0IGdyYXBoO1xuICAgICAgICBpZiAodGhpcy5yb290Qm9uZSkge1xuICAgICAgICAgICAgZ3JhcGggPSB0aGlzLnJvb3RCb25lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZ3JhcGggPSB0aGlzLmVudGl0eTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsYXllckluZGV4ID0gdGhpcy5fbGF5ZXJzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgYW5pbUJpbmRlciA9IG5ldyBBbmltQ29tcG9uZW50QmluZGVyKHRoaXMsIGdyYXBoLCBuYW1lLCBtYXNrLCBsYXllckluZGV4KTtcbiAgICAgICAgY29uc3QgYW5pbUV2YWx1YXRvciA9IG5ldyBBbmltRXZhbHVhdG9yKGFuaW1CaW5kZXIpO1xuICAgICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFuaW1Db250cm9sbGVyKFxuICAgICAgICAgICAgYW5pbUV2YWx1YXRvcixcbiAgICAgICAgICAgIHN0YXRlcyxcbiAgICAgICAgICAgIHRyYW5zaXRpb25zLFxuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVycyxcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlLFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnNcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzLnB1c2gobmV3IEFuaW1Db21wb25lbnRMYXllcihuYW1lLCBjb250cm9sbGVyLCB0aGlzLCB3ZWlnaHQsIGJsZW5kVHlwZSkpO1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXNbbmFtZV0gPSBsYXllckluZGV4O1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzW2xheWVySW5kZXhdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBuZXcgYW5pbSBjb21wb25lbnQgbGF5ZXIgdG8gdGhlIGFuaW0gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgbGF5ZXIgdG8gY3JlYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2VpZ2h0XSAtIFRoZSBibGVuZGluZyB3ZWlnaHQgb2YgdGhlIGxheWVyLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IFttYXNrXSAtIEEgbGlzdCBvZiBwYXRocyB0byBib25lcyBpbiB0aGUgbW9kZWwgd2hpY2ggc2hvdWxkIGJlIGFuaW1hdGVkIGluXG4gICAgICogdGhpcyBsYXllci4gSWYgb21pdHRlZCB0aGUgZnVsbCBtb2RlbCBpcyB1c2VkLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbYmxlbmRUeXBlXSAtIERlZmluZXMgaG93IHByb3BlcnRpZXMgYW5pbWF0ZWQgYnkgdGhpcyBsYXllciBibGVuZCB3aXRoXG4gICAgICogYW5pbWF0aW9ucyBvZiB0aG9zZSBwcm9wZXJ0aWVzIGluIHByZXZpb3VzIGxheWVycy4gRGVmYXVsdHMgdG8gcGMuQU5JTV9MQVlFUl9PVkVSV1JJVEUuXG4gICAgICogQHJldHVybnMge0FuaW1Db21wb25lbnRMYXllcn0gVGhlIGNyZWF0ZWQgYW5pbSBjb21wb25lbnQgbGF5ZXIuXG4gICAgICovXG4gICAgYWRkTGF5ZXIobmFtZSwgd2VpZ2h0LCBtYXNrLCBibGVuZFR5cGUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmZpbmRBbmltYXRpb25MYXllcihuYW1lKTtcbiAgICAgICAgaWYgKGxheWVyKSByZXR1cm4gbGF5ZXI7XG4gICAgICAgIGNvbnN0IHN0YXRlcyA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnbmFtZSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgJ3NwZWVkJzogMVxuICAgICAgICAgICAgfVxuICAgICAgICBdO1xuICAgICAgICBjb25zdCB0cmFuc2l0aW9ucyA9IFtdO1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkTGF5ZXIoeyBuYW1lLCBzdGF0ZXMsIHRyYW5zaXRpb25zLCB3ZWlnaHQsIG1hc2ssIGJsZW5kVHlwZSB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyBjb21wb25lbnQgYW5pbWF0aW9uIGNvbnRyb2xsZXJzIHVzaW5nIHRoZSBwcm92aWRlZCBzdGF0ZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzdGF0ZUdyYXBoIC0gVGhlIHN0YXRlIGdyYXBoIGFzc2V0IHRvIGxvYWQgaW50byB0aGUgY29tcG9uZW50LiBDb250YWlucyB0aGVcbiAgICAgKiBzdGF0ZXMsIHRyYW5zaXRpb25zIGFuZCBwYXJhbWV0ZXJzIHVzZWQgdG8gZGVmaW5lIGEgY29tcGxldGUgYW5pbWF0aW9uIGNvbnRyb2xsZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuYW5pbS5sb2FkU3RhdGVHcmFwaCh7XG4gICAgICogICAgIFwibGF5ZXJzXCI6IFtcbiAgICAgKiAgICAgICAgIHtcbiAgICAgKiAgICAgICAgICAgICBcIm5hbWVcIjogbGF5ZXJOYW1lLFxuICAgICAqICAgICAgICAgICAgIFwic3RhdGVzXCI6IFtcbiAgICAgKiAgICAgICAgICAgICAgICAge1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiU1RBUlRcIixcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwic3BlZWRcIjogMVxuICAgICAqICAgICAgICAgICAgICAgICB9LFxuICAgICAqICAgICAgICAgICAgICAgICB7XG4gICAgICogICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJJbml0aWFsIFN0YXRlXCIsXG4gICAgICogICAgICAgICAgICAgICAgICAgICBcInNwZWVkXCI6IHNwZWVkLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJsb29wXCI6IGxvb3AsXG4gICAgICogICAgICAgICAgICAgICAgICAgICBcImRlZmF1bHRTdGF0ZVwiOiB0cnVlXG4gICAgICogICAgICAgICAgICAgICAgIH1cbiAgICAgKiAgICAgICAgICAgICBdLFxuICAgICAqICAgICAgICAgICAgIFwidHJhbnNpdGlvbnNcIjogW1xuICAgICAqICAgICAgICAgICAgICAgICB7XG4gICAgICogICAgICAgICAgICAgICAgICAgICBcImZyb21cIjogXCJTVEFSVFwiLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiBcIkluaXRpYWwgU3RhdGVcIlxuICAgICAqICAgICAgICAgICAgICAgICB9XG4gICAgICogICAgICAgICAgICAgXVxuICAgICAqICAgICAgICAgfVxuICAgICAqICAgICBdLFxuICAgICAqICAgICBcInBhcmFtZXRlcnNcIjoge31cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkU3RhdGVHcmFwaChzdGF0ZUdyYXBoKSB7XG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBzdGF0ZUdyYXBoO1xuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzID0ge307XG4gICAgICAgIGNvbnN0IHBhcmFtS2V5cyA9IE9iamVjdC5rZXlzKHN0YXRlR3JhcGgucGFyYW1ldGVycyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYW1LZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJhbUtleSA9IHBhcmFtS2V5c1tpXTtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlcnNbcGFyYW1LZXldID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IHN0YXRlR3JhcGgucGFyYW1ldGVyc1twYXJhbUtleV0udHlwZSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogc3RhdGVHcmFwaC5wYXJhbWV0ZXJzW3BhcmFtS2V5XS52YWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9sYXllcnMgPSBbXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlR3JhcGgubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHN0YXRlR3JhcGgubGF5ZXJzW2ldO1xuICAgICAgICAgICAgdGhpcy5fYWRkTGF5ZXIuYmluZCh0aGlzKSh7IC4uLmxheWVyIH0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0dXBBbmltYXRpb25Bc3NldHMoKTtcbiAgICB9XG5cbiAgICBzZXR1cEFuaW1hdGlvbkFzc2V0cygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5fbGF5ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJOYW1lID0gbGF5ZXIubmFtZTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuc3RhdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVOYW1lID0gbGF5ZXIuc3RhdGVzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yoc3RhdGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVLZXkgPSBsYXllck5hbWUgKyAnOicgKyBzdGF0ZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fYW5pbWF0aW9uQXNzZXRzW3N0YXRlS2V5XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzW3N0YXRlS2V5XSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldDogbnVsbFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICB9XG5cbiAgICBsb2FkQW5pbWF0aW9uQXNzZXRzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLl9sYXllcnNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxheWVyLnN0YXRlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlTmFtZSA9IGxheWVyLnN0YXRlc1tqXTtcbiAgICAgICAgICAgICAgICBpZiAoQU5JTV9DT05UUk9MX1NUQVRFUy5pbmRleE9mKHN0YXRlTmFtZSkgIT09IC0xKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhbmltYXRpb25Bc3NldCA9IHRoaXMuX2FuaW1hdGlvbkFzc2V0c1tsYXllci5uYW1lICsgJzonICsgc3RhdGVOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIWFuaW1hdGlvbkFzc2V0IHx8ICFhbmltYXRpb25Bc3NldC5hc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZU5vZGVBbmltYXRpb25zKHN0YXRlTmFtZSwgbGF5ZXIubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldElkID0gYW5pbWF0aW9uQXNzZXQuYXNzZXQ7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldElkKTtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayB3aGV0aGVyIGFzc2lnbmVkIGFuaW1hdGlvbiBhc3NldCBzdGlsbCBleGlzdHNcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9uQW5pbWF0aW9uQXNzZXRMb2FkZWQobGF5ZXIubmFtZSwgc3RhdGVOYW1lLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgZnVuY3Rpb24gKGxheWVyTmFtZSwgc3RhdGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9uQW5pbWF0aW9uQXNzZXRMb2FkZWQobGF5ZXJOYW1lLCBzdGF0ZU5hbWUsIGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykobGF5ZXIubmFtZSwgc3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25BbmltYXRpb25Bc3NldExvYWRlZChsYXllck5hbWUsIHN0YXRlTmFtZSwgYXNzZXQpIHtcbiAgICAgICAgdGhpcy5maW5kQW5pbWF0aW9uTGF5ZXIobGF5ZXJOYW1lKS5hc3NpZ25BbmltYXRpb24oc3RhdGVOYW1lLCBhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgbGF5ZXJzIGZyb20gdGhlIGFuaW0gY29tcG9uZW50LlxuICAgICAqL1xuICAgIHJlbW92ZVN0YXRlR3JhcGgoKSB7XG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBudWxsO1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9hbmltYXRpb25Bc3NldHMgPSB7fTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW107XG4gICAgICAgIHRoaXMuX2xheWVySW5kaWNlcyA9IHt9O1xuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzID0ge307XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy51bmJpbmQoKTtcbiAgICAgICAgLy8gY2xlYXIgYWxsIHRhcmdldHMgZnJvbSBwcmV2aW91cyBiaW5kaW5nXG4gICAgICAgIHRoaXMuX3RhcmdldHMgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNldCBhbGwgb2YgdGhlIGNvbXBvbmVudHMgbGF5ZXJzIGFuZCBwYXJhbWV0ZXJzIHRvIHRoZWlyIGluaXRpYWwgc3RhdGVzLiBJZiBhIGxheWVyIHdhc1xuICAgICAqIHBsYXlpbmcgYmVmb3JlIGl0IHdpbGwgY29udGludWUgcGxheWluZy5cbiAgICAgKi9cbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX3N0YXRlR3JhcGgucGFyYW1ldGVycyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllclBsYXlpbmcgPSB0aGlzLl9sYXllcnNbaV0ucGxheWluZztcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXS5yZXNldCgpO1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldLnBsYXlpbmcgPSBsYXllclBsYXlpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1bmJpbmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbm9ybWFsaXplV2VpZ2h0cykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXModGhpcy5fdGFyZ2V0cykuZm9yRWFjaCgodGFyZ2V0S2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0c1t0YXJnZXRLZXldLnVuYmluZCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWJpbmQgYWxsIG9mIHRoZSBjb21wb25lbnRzIGxheWVycy5cbiAgICAgKi9cbiAgICByZWJpbmQoKSB7XG4gICAgICAgIC8vIGNsZWFyIGFsbCB0YXJnZXRzIGZyb20gcHJldmlvdXMgYmluZGluZ1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgICAgIC8vIHJlYmluZCBhbGwgbGF5ZXJzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXllcnNbaV0ucmViaW5kKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kcyBhIHtAbGluayBBbmltQ29tcG9uZW50TGF5ZXJ9IGluIHRoaXMgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYW5pbSBjb21wb25lbnQgbGF5ZXIgdG8gZmluZC5cbiAgICAgKiBAcmV0dXJucyB7QW5pbUNvbXBvbmVudExheWVyfSBMYXllci5cbiAgICAgKi9cbiAgICBmaW5kQW5pbWF0aW9uTGF5ZXIobmFtZSkge1xuICAgICAgICBjb25zdCBsYXllckluZGV4ID0gdGhpcy5fbGF5ZXJJbmRpY2VzW25hbWVdO1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzW2xheWVySW5kZXhdIHx8IG51bGw7XG4gICAgfVxuXG4gICAgYWRkQW5pbWF0aW9uU3RhdGUobm9kZU5hbWUsIGFuaW1UcmFjaywgc3BlZWQgPSAxLCBsb29wID0gdHJ1ZSwgbGF5ZXJOYW1lID0gJ0Jhc2UnKSB7XG4gICAgICAgIGlmICghdGhpcy5fc3RhdGVHcmFwaCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaChuZXcgQW5pbVN0YXRlR3JhcGgoe1xuICAgICAgICAgICAgICAgICdsYXllcnMnOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogbGF5ZXJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0YXRlcyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NwZWVkJzogMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6IG5vZGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3BlZWQnOiBzcGVlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xvb3AnOiBsb29wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZGVmYXVsdFN0YXRlJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAndHJhbnNpdGlvbnMnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZnJvbSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0byc6IG5vZGVOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAncGFyYW1ldGVycyc6IHt9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllck5hbWUpO1xuICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgIGxheWVyLmFzc2lnbkFuaW1hdGlvbihub2RlTmFtZSwgYW5pbVRyYWNrLCBzcGVlZCwgbG9vcCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmFkZExheWVyKGxheWVyTmFtZSk/LmFzc2lnbkFuaW1hdGlvbihub2RlTmFtZSwgYW5pbVRyYWNrLCBzcGVlZCwgbG9vcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NvY2lhdGVzIGFuIGFuaW1hdGlvbiB3aXRoIGEgc3RhdGUgb3IgYmxlbmQgdHJlZSBub2RlIGluIHRoZSBsb2FkZWQgc3RhdGUgZ3JhcGguIElmIGFsbFxuICAgICAqIHN0YXRlcyBhcmUgbGlua2VkIGFuZCB0aGUge0BsaW5rIEFuaW1Db21wb25lbnQjYWN0aXZhdGV9IHZhbHVlIHdhcyBzZXQgdG8gdHJ1ZSB0aGVuIHRoZVxuICAgICAqIGNvbXBvbmVudCB3aWxsIGJlZ2luIHBsYXlpbmcuIElmIG5vIHN0YXRlIGdyYXBoIGlzIGxvYWRlZCwgYSBkZWZhdWx0IHN0YXRlIGdyYXBoIHdpbGwgYmVcbiAgICAgKiBjcmVhdGVkIHdpdGggYSBzaW5nbGUgc3RhdGUgYmFzZWQgb24gdGhlIHByb3ZpZGVkIG5vZGVQYXRoIHBhcmFtZXRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBub2RlUGF0aCAtIEVpdGhlciB0aGUgc3RhdGUgbmFtZSBvciB0aGUgcGF0aCB0byBhIGJsZW5kIHRyZWUgbm9kZSB0aGF0IHRoaXNcbiAgICAgKiBhbmltYXRpb24gc2hvdWxkIGJlIGFzc29jaWF0ZWQgd2l0aC4gRWFjaCBzZWN0aW9uIG9mIGEgYmxlbmQgdHJlZSBwYXRoIGlzIHNwbGl0IHVzaW5nIGFcbiAgICAgKiBwZXJpb2QgKGAuYCkgdGhlcmVmb3JlIHN0YXRlIG5hbWVzIHNob3VsZCBub3QgaW5jbHVkZSB0aGlzIGNoYXJhY3RlciAoZS5nIFwiTXlTdGF0ZU5hbWVcIiBvclxuICAgICAqIFwiTXlTdGF0ZU5hbWUuQmxlbmRUcmVlTm9kZVwiKS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gYW5pbVRyYWNrIC0gVGhlIGFuaW1hdGlvbiB0cmFjayB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdG8gdGhpcyBzdGF0ZSBhbmRcbiAgICAgKiBwbGF5ZWQgd2hlbmV2ZXIgdGhpcyBzdGF0ZSBpcyBhY3RpdmUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtsYXllck5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW0gY29tcG9uZW50IGxheWVyIHRvIHVwZGF0ZS4gSWYgb21pdHRlZCB0aGVcbiAgICAgKiBkZWZhdWx0IGxheWVyIGlzIHVzZWQuIElmIG5vIHN0YXRlIGdyYXBoIGhhcyBiZWVuIHByZXZpb3VzbHkgbG9hZGVkIHRoaXMgcGFyYW1ldGVyIGlzXG4gICAgICogaWdub3JlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3NwZWVkXSAtIFVwZGF0ZSB0aGUgc3BlZWQgb2YgdGhlIHN0YXRlIHlvdSBhcmUgYXNzaWduaW5nIGFuIGFuaW1hdGlvbiB0by5cbiAgICAgKiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2xvb3BdIC0gVXBkYXRlIHRoZSBsb29wIHByb3BlcnR5IG9mIHRoZSBzdGF0ZSB5b3UgYXJlIGFzc2lnbmluZyBhblxuICAgICAqIGFuaW1hdGlvbiB0by4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBhc3NpZ25BbmltYXRpb24obm9kZVBhdGgsIGFuaW1UcmFjaywgbGF5ZXJOYW1lLCBzcGVlZCA9IDEsIGxvb3AgPSB0cnVlKSB7XG4gICAgICAgIGlmICghdGhpcy5fc3RhdGVHcmFwaCAmJiBub2RlUGF0aC5pbmRleE9mKCcuJykgPT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKG5ldyBBbmltU3RhdGVHcmFwaCh7XG4gICAgICAgICAgICAgICAgJ2xheWVycyc6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiAnQmFzZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3RhdGVzJzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiAnU1RBUlQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3BlZWQnOiAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogbm9kZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzcGVlZCc6IHNwZWVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbG9vcCc6IGxvb3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkZWZhdWx0U3RhdGUnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICd0cmFuc2l0aW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdmcm9tJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RvJzogbm9kZVBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICdwYXJhbWV0ZXJzJzoge31cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHRoaXMuYmFzZUxheWVyLmFzc2lnbkFuaW1hdGlvbihub2RlUGF0aCwgYW5pbVRyYWNrKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyTmFtZSA/IHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKGxheWVyTmFtZSkgOiB0aGlzLmJhc2VMYXllcjtcbiAgICAgICAgaWYgKCFsYXllcikge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ2Fzc2lnbkFuaW1hdGlvbjogVHJ5aW5nIHRvIGFzc2lnbiBhbiBhbmltIHRyYWNrIHRvIGEgbGF5ZXIgdGhhdCBkb2VzblxcJ3QgZXhpc3QnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5hc3NpZ25BbmltYXRpb24obm9kZVBhdGgsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYW5pbWF0aW9ucyBmcm9tIGEgbm9kZSBpbiB0aGUgbG9hZGVkIHN0YXRlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5vZGVOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIG5vZGUgdGhhdCBzaG91bGQgaGF2ZSBpdHMgYW5pbWF0aW9uIHRyYWNrcyByZW1vdmVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbGF5ZXJOYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltIGNvbXBvbmVudCBsYXllciB0byB1cGRhdGUuIElmIG9taXR0ZWQgdGhlXG4gICAgICogZGVmYXVsdCBsYXllciBpcyB1c2VkLlxuICAgICAqL1xuICAgIHJlbW92ZU5vZGVBbmltYXRpb25zKG5vZGVOYW1lLCBsYXllck5hbWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllck5hbWUgPyB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllck5hbWUpIDogdGhpcy5iYXNlTGF5ZXI7XG4gICAgICAgIGlmICghbGF5ZXIpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdyZW1vdmVTdGF0ZUFuaW1hdGlvbnM6IFRyeWluZyB0byByZW1vdmUgYW5pbWF0aW9uIHRyYWNrcyBmcm9tIGEgc3RhdGUgYmVmb3JlIHRoZSBzdGF0ZSBncmFwaCBoYXMgYmVlbiBsb2FkZWQuIEhhdmUgeW91IGNhbGxlZCBsb2FkU3RhdGVHcmFwaD8nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5yZW1vdmVOb2RlQW5pbWF0aW9ucyhub2RlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgdHlwZSkge1xuICAgICAgICBjb25zdCBwYXJhbSA9IHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIGlmIChwYXJhbSAmJiBwYXJhbS50eXBlID09PSB0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyYW0udmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgRGVidWcubG9nKGBDYW5ub3QgZ2V0IHBhcmFtZXRlciB2YWx1ZS4gTm8gcGFyYW1ldGVyIGZvdW5kIGluIGFuaW0gY29udHJvbGxlciBuYW1lZCBcIiR7bmFtZX1cIiBvZiB0eXBlIFwiJHt0eXBlfVwiYCk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgdHlwZSwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgcGFyYW0gPSB0aGlzLl9wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICBpZiAocGFyYW0gJiYgcGFyYW0udHlwZSA9PT0gdHlwZSkge1xuICAgICAgICAgICAgcGFyYW0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBEZWJ1Zy5sb2coYENhbm5vdCBzZXQgcGFyYW1ldGVyIHZhbHVlLiBObyBwYXJhbWV0ZXIgZm91bmQgaW4gYW5pbSBjb250cm9sbGVyIG5hbWVkIFwiJHtuYW1lfVwiIG9mIHR5cGUgXCIke3R5cGV9XCJgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgZmxvYXQgcGFyYW1ldGVyIHZhbHVlIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmbG9hdCB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEEgZmxvYXQuXG4gICAgICovXG4gICAgZ2V0RmxvYXQobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9GTE9BVCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYSBmbG9hdCBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBuZXcgZmxvYXQgdmFsdWUgdG8gc2V0IHRoaXMgcGFyYW1ldGVyIHRvLlxuICAgICAqL1xuICAgIHNldEZsb2F0KG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfRkxPQVQsIHZhbHVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGludGVnZXIgcGFyYW1ldGVyIHZhbHVlIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBpbnRlZ2VyIHRvIHJldHVybiB0aGUgdmFsdWUgb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQW4gaW50ZWdlci5cbiAgICAgKi9cbiAgICBnZXRJbnRlZ2VyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfSU5URUdFUik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYW4gaW50ZWdlciBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIG5ldyBpbnRlZ2VyIHZhbHVlIHRvIHNldCB0aGlzIHBhcmFtZXRlciB0by5cbiAgICAgKi9cbiAgICBzZXRJbnRlZ2VyKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICUgMSA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9JTlRFR0VSLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcignQXR0ZW1wdGluZyB0byBhc3NpZ24gbm9uIGludGVnZXIgdmFsdWUgdG8gaW50ZWdlciBwYXJhbWV0ZXInKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBib29sZWFuIHBhcmFtZXRlciB2YWx1ZSBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYm9vbGVhbiB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBBIGJvb2xlYW4uXG4gICAgICovXG4gICAgZ2V0Qm9vbGVhbihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0JPT0xFQU4pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGEgYm9vbGVhbiBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB2YWx1ZSAtIFRoZSBuZXcgYm9vbGVhbiB2YWx1ZSB0byBzZXQgdGhpcyBwYXJhbWV0ZXIgdG8uXG4gICAgICovXG4gICAgc2V0Qm9vbGVhbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0JPT0xFQU4sICEhdmFsdWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSB0cmlnZ2VyIHBhcmFtZXRlciB2YWx1ZSBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgdHJpZ2dlciB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBBIGJvb2xlYW4uXG4gICAgICovXG4gICAgZ2V0VHJpZ2dlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGEgdHJpZ2dlciBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaCB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtzaW5nbGVGcmFtZV0gLSBJZiB0cnVlLCB0aGlzIHRyaWdnZXIgd2lsbCBiZSBzZXQgYmFjayB0byBmYWxzZSBhdCB0aGUgZW5kXG4gICAgICogb2YgdGhlIGFuaW1hdGlvbiB1cGRhdGUuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqL1xuICAgIHNldFRyaWdnZXIobmFtZSwgc2luZ2xlRnJhbWUgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIsIHRydWUpO1xuICAgICAgICBpZiAoc2luZ2xlRnJhbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuYWRkKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzZXRzIHRoZSB2YWx1ZSBvZiBhIHRyaWdnZXIgcGFyYW1ldGVyIHRoYXQgd2FzIGRlZmluZWQgaW4gdGhlIGFuaW1hdGlvbiBjb21wb25lbnRzIHN0YXRlXG4gICAgICogZ3JhcGggdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqL1xuICAgIHJlc2V0VHJpZ2dlcihuYW1lKSB7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgZmFsc2UpO1xuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICBpZiAoTnVtYmVyLmlzRmluaXRlKHRoaXMuX3N0YXRlR3JhcGhBc3NldCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlR3JhcGhBc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3N0YXRlR3JhcGhBc3NldCk7XG4gICAgICAgICAgICBzdGF0ZUdyYXBoQXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmxheWVyc1tpXS51cGRhdGUoZHQgKiB0aGlzLnNwZWVkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzLmZvckVhY2goKHRyaWdnZXIpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGFyYW1ldGVyc1t0cmlnZ2VyXS52YWx1ZSA9IGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2Vycy5jbGVhcigpO1xuICAgIH1cblxuICAgIHJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhvbGRBbmltLCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGlmIChvbGRBbmltLnJvb3RCb25lICYmIGR1cGxpY2F0ZWRJZHNNYXBbb2xkQW5pbS5yb290Qm9uZS5nZXRHdWlkKCldKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3RCb25lID0gZHVwbGljYXRlZElkc01hcFtvbGRBbmltLnJvb3RCb25lLmdldEd1aWQoKV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlYmluZCgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiQW5pbUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3N0YXRlR3JhcGhBc3NldCIsIl9hbmltYXRpb25Bc3NldHMiLCJfc3BlZWQiLCJfYWN0aXZhdGUiLCJfcGxheWluZyIsIl9yb290Qm9uZSIsIl9zdGF0ZUdyYXBoIiwiX2xheWVycyIsIl9sYXllckluZGljZXMiLCJfcGFyYW1ldGVycyIsIl90YXJnZXRzIiwiX2NvbnN1bWVkVHJpZ2dlcnMiLCJTZXQiLCJfbm9ybWFsaXplV2VpZ2h0cyIsInN0YXRlR3JhcGhBc3NldCIsInZhbHVlIiwicmVtb3ZlU3RhdGVHcmFwaCIsImFwcCIsImFzc2V0cyIsImdldCIsIm9mZiIsIl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50IiwiX2lkIiwiX2Fzc2V0IiwiQXNzZXQiLCJpZCIsImFkZCIsInJlc291cmNlIiwibG9hZFN0YXRlR3JhcGgiLCJvbiIsIm9uY2UiLCJhc3NldCIsImxvYWQiLCJub3JtYWxpemVXZWlnaHRzIiwidW5iaW5kIiwiYW5pbWF0aW9uQXNzZXRzIiwibG9hZEFuaW1hdGlvbkFzc2V0cyIsInNwZWVkIiwiYWN0aXZhdGUiLCJwbGF5aW5nIiwicm9vdEJvbmUiLCJyb290IiwiZmluZEJ5R3VpZCIsIkRlYnVnIiwiYXNzZXJ0IiwiRW50aXR5IiwicmViaW5kIiwic3RhdGVHcmFwaCIsImxheWVycyIsImxheWVySW5kaWNlcyIsInBhcmFtZXRlcnMiLCJ0YXJnZXRzIiwicGxheWFibGUiLCJpIiwibGVuZ3RoIiwiYmFzZUxheWVyIiwicHJldkFuaW1hdGlvbkFzc2V0cyIsInByZXZNYXNrcyIsIm1hcCIsImxheWVyIiwibWFzayIsIkFuaW1TdGF0ZUdyYXBoIiwiX2RhdGEiLCJmb3JFYWNoIiwiZGlydGlmeVRhcmdldHMiLCJPYmplY3QiLCJ2YWx1ZXMiLCJkaXJ0eSIsIl9hZGRMYXllciIsIm5hbWUiLCJzdGF0ZXMiLCJ0cmFuc2l0aW9ucyIsIndlaWdodCIsImJsZW5kVHlwZSIsImdyYXBoIiwibGF5ZXJJbmRleCIsImFuaW1CaW5kZXIiLCJBbmltQ29tcG9uZW50QmluZGVyIiwiYW5pbUV2YWx1YXRvciIsIkFuaW1FdmFsdWF0b3IiLCJjb250cm9sbGVyIiwiQW5pbUNvbnRyb2xsZXIiLCJwdXNoIiwiQW5pbUNvbXBvbmVudExheWVyIiwiYWRkTGF5ZXIiLCJmaW5kQW5pbWF0aW9uTGF5ZXIiLCJwYXJhbUtleXMiLCJrZXlzIiwicGFyYW1LZXkiLCJ0eXBlIiwiYmluZCIsInNldHVwQW5pbWF0aW9uQXNzZXRzIiwibGF5ZXJOYW1lIiwiaiIsInN0YXRlTmFtZSIsIkFOSU1fQ09OVFJPTF9TVEFURVMiLCJpbmRleE9mIiwic3RhdGVLZXkiLCJhbmltYXRpb25Bc3NldCIsInJlbW92ZU5vZGVBbmltYXRpb25zIiwiYXNzZXRJZCIsIm9uQW5pbWF0aW9uQXNzZXRMb2FkZWQiLCJhc3NpZ25BbmltYXRpb24iLCJyZXNldCIsImFzc2lnbiIsImxheWVyUGxheWluZyIsInRhcmdldEtleSIsImFkZEFuaW1hdGlvblN0YXRlIiwibm9kZU5hbWUiLCJhbmltVHJhY2siLCJsb29wIiwibm9kZVBhdGgiLCJlcnJvciIsImdldFBhcmFtZXRlclZhbHVlIiwicGFyYW0iLCJsb2ciLCJ1bmRlZmluZWQiLCJzZXRQYXJhbWV0ZXJWYWx1ZSIsImdldEZsb2F0IiwiQU5JTV9QQVJBTUVURVJfRkxPQVQiLCJzZXRGbG9hdCIsImdldEludGVnZXIiLCJBTklNX1BBUkFNRVRFUl9JTlRFR0VSIiwic2V0SW50ZWdlciIsImdldEJvb2xlYW4iLCJBTklNX1BBUkFNRVRFUl9CT09MRUFOIiwic2V0Qm9vbGVhbiIsImdldFRyaWdnZXIiLCJBTklNX1BBUkFNRVRFUl9UUklHR0VSIiwic2V0VHJpZ2dlciIsInNpbmdsZUZyYW1lIiwicmVzZXRUcmlnZ2VyIiwib25CZWZvcmVSZW1vdmUiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsInVwZGF0ZSIsImR0IiwidHJpZ2dlciIsImNsZWFyIiwicmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzIiwib2xkQW5pbSIsImR1cGxpY2F0ZWRJZHNNYXAiLCJnZXRHdWlkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQXVCQSxNQUFNQSxhQUFhLFNBQVNDLFNBQVMsQ0FBQztBQVFsQ0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUVyQixJQUFJLENB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
