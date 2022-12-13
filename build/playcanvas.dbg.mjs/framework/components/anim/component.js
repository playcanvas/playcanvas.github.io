/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
      Debug.error('Attempting to assign non integer value to integer parameter', name, value);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvYW5pbS1jb250cm9sbGVyLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHtcbiAgICBBTklNX1BBUkFNRVRFUl9CT09MRUFOLCBBTklNX1BBUkFNRVRFUl9GTE9BVCwgQU5JTV9QQVJBTUVURVJfSU5URUdFUiwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEFuaW1Db21wb25lbnRCaW5kZXIgfSBmcm9tICcuL2NvbXBvbmVudC1iaW5kZXIuanMnO1xuaW1wb3J0IHsgQW5pbUNvbXBvbmVudExheWVyIH0gZnJvbSAnLi9jb21wb25lbnQtbGF5ZXIuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlR3JhcGggfSBmcm9tICcuLi8uLi9hbmltL3N0YXRlLWdyYXBoL2FuaW0tc3RhdGUtZ3JhcGguanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuLyoqXG4gKiBUaGUgQW5pbSBDb21wb25lbnQgYWxsb3dzIGFuIEVudGl0eSB0byBwbGF5YmFjayBhbmltYXRpb25zIG9uIG1vZGVscyBhbmQgZW50aXR5IHByb3BlcnRpZXMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBBbmltQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQW5pbUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLkFuaW1Db21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSB7QGxpbmsgQ29tcG9uZW50U3lzdGVtfSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9hbmltYXRpb25Bc3NldHMgPSB7fTtcbiAgICAgICAgdGhpcy5fc3BlZWQgPSAxLjA7XG4gICAgICAgIHRoaXMuX2FjdGl2YXRlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9yb290Qm9uZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBbXTtcbiAgICAgICAgdGhpcy5fbGF5ZXJJbmRpY2VzID0ge307XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSB7fTtcbiAgICAgICAgLy8gYSBjb2xsZWN0aW9uIG9mIGFuaW1hdGVkIHByb3BlcnR5IHRhcmdldHNcbiAgICAgICAgdGhpcy5fdGFyZ2V0cyA9IHt9O1xuICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9ub3JtYWxpemVXZWlnaHRzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgc2V0IHN0YXRlR3JhcGhBc3NldCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlU3RhdGVHcmFwaCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV2ZW50IGZyb20gcHJldmlvdXMgYXNzZXRcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlR3JhcGhBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGVHcmFwaEFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fc3RhdGVHcmFwaEFzc2V0KTtcbiAgICAgICAgICAgIHN0YXRlR3JhcGhBc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IF9pZDtcbiAgICAgICAgbGV0IF9hc3NldDtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgICAgICBfYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChfaWQpO1xuICAgICAgICAgICAgaWYgKCFfYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmFkZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgX2Fzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoX2lkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlO1xuICAgICAgICAgICAgX2Fzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoX2lkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIV9hc3NldCB8fCB0aGlzLl9zdGF0ZUdyYXBoQXNzZXQgPT09IF9pZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IF9hc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIHRoaXMubG9hZFN0YXRlR3JhcGgodGhpcy5fc3RhdGVHcmFwaCk7XG4gICAgICAgICAgICBfYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQsIHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX2Fzc2V0Lm9uY2UoJ2xvYWQnLCAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaCh0aGlzLl9zdGF0ZUdyYXBoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX2Fzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChfYXNzZXQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGhBc3NldCA9IF9pZDtcbiAgICB9XG5cbiAgICBnZXQgc3RhdGVHcmFwaEFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGVHcmFwaEFzc2V0O1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudCB3aWxsIG5vcm1hbGl6ZSB0aGUgd2VpZ2h0cyBvZiBpdHMgbGF5ZXJzIGJ5IHRoZWlyIHN1bSB0b3RhbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBub3JtYWxpemVXZWlnaHRzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX25vcm1hbGl6ZVdlaWdodHMgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51bmJpbmQoKTtcbiAgICB9XG5cbiAgICBnZXQgbm9ybWFsaXplV2VpZ2h0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25vcm1hbGl6ZVdlaWdodHM7XG4gICAgfVxuXG4gICAgc2V0IGFuaW1hdGlvbkFzc2V0cyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hbmltYXRpb25Bc3NldHMgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5sb2FkQW5pbWF0aW9uQXNzZXRzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGFuaW1hdGlvbkFzc2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1hdGlvbkFzc2V0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVlZCBtdWx0aXBsaWVyIGZvciBhbmltYXRpb24gcGxheSBiYWNrIHNwZWVkLiAxLjAgaXMgcGxheWJhY2sgYXQgbm9ybWFsIHNwZWVkLCAwLjAgcGF1c2VzXG4gICAgICogdGhlIGFuaW1hdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNwZWVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwZWVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3BlZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgZmlyc3QgYW5pbWF0aW9uIHdpbGwgYmVnaW4gcGxheWluZyB3aGVuIHRoZSBzY2VuZSBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgYWN0aXZhdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYWN0aXZhdGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmF0ZTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFBsYXlzIG9yIHBhdXNlcyBhbGwgYW5pbWF0aW9ucyBpbiB0aGUgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHBsYXlpbmcodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxheWluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZW50aXR5IHRoYXQgdGhpcyBhbmltIGNvbXBvbmVudCBzaG91bGQgdXNlIGFzIHRoZSByb290IG9mIHRoZSBhbmltYXRpb24gaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgKi9cbiAgICBzZXQgcm9vdEJvbmUodmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5LnJvb3QuZmluZEJ5R3VpZCh2YWx1ZSk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoZW50aXR5LCBgcm9vdEJvbmUgZW50aXR5IGZvciBzdXBwbGllZCBndWlkOiR7dmFsdWV9IGNhbm5vdCBiZSBmb3VuZCBpbiB0aGUgc2NlbmVgKTtcbiAgICAgICAgICAgIHRoaXMuX3Jvb3RCb25lID0gZW50aXR5O1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl9yb290Qm9uZSA9IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmViaW5kKCk7XG4gICAgfVxuXG4gICAgZ2V0IHJvb3RCb25lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm9vdEJvbmU7XG4gICAgfVxuXG4gICAgc2V0IHN0YXRlR3JhcGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzdGF0ZUdyYXBoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGVHcmFwaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBhbmltYXRpb24gbGF5ZXJzIGF2YWlsYWJsZSBpbiB0aGlzIGFuaW0gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge0FuaW1Db21wb25lbnRMYXllcltdfVxuICAgICAqL1xuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgc2V0IGxheWVySW5kaWNlcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJJbmRpY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJJbmRpY2VzO1xuICAgIH1cblxuICAgIHNldCBwYXJhbWV0ZXJzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcGFyYW1ldGVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmFtZXRlcnM7XG4gICAgfVxuXG4gICAgc2V0IHRhcmdldHModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdGFyZ2V0cyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCB0YXJnZXRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGFyZ2V0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHdoZXRoZXIgYWxsIGNvbXBvbmVudCBsYXllcnMgYXJlIGN1cnJlbnRseSBwbGF5YWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBwbGF5YWJsZSgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fbGF5ZXJzW2ldLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGJhc2UgbGF5ZXIgb2YgdGhlIHN0YXRlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHR5cGUge0FuaW1Db21wb25lbnRMYXllcnxudWxsfVxuICAgICAqL1xuICAgIGdldCBiYXNlTGF5ZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9sYXllcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyc1swXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBfb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudChhc3NldCkge1xuICAgICAgICAvLyBib3RoIGFuaW1hdGlvbkFzc2V0cyBhbmQgbGF5ZXIgbWFza3Mgc2hvdWxkIGJlIG1haW50YWluZWQgd2hlbiBzd2l0Y2hpbmcgQW5pbVN0YXRlR3JhcGggYXNzZXRzXG4gICAgICAgIGNvbnN0IHByZXZBbmltYXRpb25Bc3NldHMgPSB0aGlzLmFuaW1hdGlvbkFzc2V0cztcbiAgICAgICAgY29uc3QgcHJldk1hc2tzID0gdGhpcy5sYXllcnMubWFwKGxheWVyID0+IGxheWVyLm1hc2spO1xuICAgICAgICAvLyBjbGVhciB0aGUgcHJldmlvdXMgc3RhdGUgZ3JhcGhcbiAgICAgICAgdGhpcy5yZW1vdmVTdGF0ZUdyYXBoKCk7XG4gICAgICAgIC8vIGxvYWQgdGhlIG5ldyBzdGF0ZSBncmFwaFxuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gbmV3IEFuaW1TdGF0ZUdyYXBoKGFzc2V0Ll9kYXRhKTtcbiAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaCh0aGlzLl9zdGF0ZUdyYXBoKTtcbiAgICAgICAgLy8gYXNzaWduIHRoZSBwcmV2aW91cyBhbmltYXRpb24gYXNzZXRzXG4gICAgICAgIHRoaXMuYW5pbWF0aW9uQXNzZXRzID0gcHJldkFuaW1hdGlvbkFzc2V0cztcbiAgICAgICAgdGhpcy5sb2FkQW5pbWF0aW9uQXNzZXRzKCk7XG4gICAgICAgIC8vIGFzc2lnbiB0aGUgcHJldmlvdXMgbGF5ZXIgbWFza3MgdGhlbiByZWJpbmQgYWxsIGFuaW0gdGFyZ2V0c1xuICAgICAgICB0aGlzLmxheWVycy5mb3JFYWNoKChsYXllciwgaSkgPT4ge1xuICAgICAgICAgICAgbGF5ZXIubWFzayA9IHByZXZNYXNrc1tpXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmViaW5kKCk7XG4gICAgfVxuXG4gICAgZGlydGlmeVRhcmdldHMoKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBPYmplY3QudmFsdWVzKHRoaXMuX3RhcmdldHMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRhcmdldHNbaV0uZGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2FkZExheWVyKHsgbmFtZSwgc3RhdGVzLCB0cmFuc2l0aW9ucywgd2VpZ2h0LCBtYXNrLCBibGVuZFR5cGUgfSkge1xuICAgICAgICBsZXQgZ3JhcGg7XG4gICAgICAgIGlmICh0aGlzLnJvb3RCb25lKSB7XG4gICAgICAgICAgICBncmFwaCA9IHRoaXMucm9vdEJvbmU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBncmFwaCA9IHRoaXMuZW50aXR5O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGxheWVySW5kZXggPSB0aGlzLl9sYXllcnMubGVuZ3RoO1xuICAgICAgICBjb25zdCBhbmltQmluZGVyID0gbmV3IEFuaW1Db21wb25lbnRCaW5kZXIodGhpcywgZ3JhcGgsIG5hbWUsIG1hc2ssIGxheWVySW5kZXgpO1xuICAgICAgICBjb25zdCBhbmltRXZhbHVhdG9yID0gbmV3IEFuaW1FdmFsdWF0b3IoYW5pbUJpbmRlcik7XG4gICAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQW5pbUNvbnRyb2xsZXIoXG4gICAgICAgICAgICBhbmltRXZhbHVhdG9yLFxuICAgICAgICAgICAgc3RhdGVzLFxuICAgICAgICAgICAgdHJhbnNpdGlvbnMsXG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzLFxuICAgICAgICAgICAgdGhpcy5fYWN0aXZhdGUsXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2Vyc1xuICAgICAgICApO1xuICAgICAgICB0aGlzLl9sYXllcnMucHVzaChuZXcgQW5pbUNvbXBvbmVudExheWVyKG5hbWUsIGNvbnRyb2xsZXIsIHRoaXMsIHdlaWdodCwgYmxlbmRUeXBlKSk7XG4gICAgICAgIHRoaXMuX2xheWVySW5kaWNlc1tuYW1lXSA9IGxheWVySW5kZXg7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnNbbGF5ZXJJbmRleF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIG5ldyBhbmltIGNvbXBvbmVudCBsYXllciB0byB0aGUgYW5pbSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBsYXllciB0byBjcmVhdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3ZWlnaHRdIC0gVGhlIGJsZW5kaW5nIHdlaWdodCBvZiB0aGUgbGF5ZXIuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gW21hc2tdIC0gQSBsaXN0IG9mIHBhdGhzIHRvIGJvbmVzIGluIHRoZSBtb2RlbCB3aGljaCBzaG91bGQgYmUgYW5pbWF0ZWQgaW5cbiAgICAgKiB0aGlzIGxheWVyLiBJZiBvbWl0dGVkIHRoZSBmdWxsIG1vZGVsIGlzIHVzZWQuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtibGVuZFR5cGVdIC0gRGVmaW5lcyBob3cgcHJvcGVydGllcyBhbmltYXRlZCBieSB0aGlzIGxheWVyIGJsZW5kIHdpdGhcbiAgICAgKiBhbmltYXRpb25zIG9mIHRob3NlIHByb3BlcnRpZXMgaW4gcHJldmlvdXMgbGF5ZXJzLiBEZWZhdWx0cyB0byBwYy5BTklNX0xBWUVSX09WRVJXUklURS5cbiAgICAgKiBAcmV0dXJucyB7QW5pbUNvbXBvbmVudExheWVyfSBUaGUgY3JlYXRlZCBhbmltIGNvbXBvbmVudCBsYXllci5cbiAgICAgKi9cbiAgICBhZGRMYXllcihuYW1lLCB3ZWlnaHQsIG1hc2ssIGJsZW5kVHlwZSkge1xuICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKG5hbWUpO1xuICAgICAgICBpZiAobGF5ZXIpIHJldHVybiBsYXllcjtcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICduYW1lJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAnc3BlZWQnOiAxXG4gICAgICAgICAgICB9XG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IHRyYW5zaXRpb25zID0gW107XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRMYXllcih7IG5hbWUsIHN0YXRlcywgdHJhbnNpdGlvbnMsIHdlaWdodCwgbWFzaywgYmxlbmRUeXBlIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIGNvbXBvbmVudCBhbmltYXRpb24gY29udHJvbGxlcnMgdXNpbmcgdGhlIHByb3ZpZGVkIHN0YXRlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHN0YXRlR3JhcGggLSBUaGUgc3RhdGUgZ3JhcGggYXNzZXQgdG8gbG9hZCBpbnRvIHRoZSBjb21wb25lbnQuIENvbnRhaW5zIHRoZVxuICAgICAqIHN0YXRlcywgdHJhbnNpdGlvbnMgYW5kIHBhcmFtZXRlcnMgdXNlZCB0byBkZWZpbmUgYSBjb21wbGV0ZSBhbmltYXRpb24gY29udHJvbGxlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5hbmltLmxvYWRTdGF0ZUdyYXBoKHtcbiAgICAgKiAgICAgXCJsYXllcnNcIjogW1xuICAgICAqICAgICAgICAge1xuICAgICAqICAgICAgICAgICAgIFwibmFtZVwiOiBsYXllck5hbWUsXG4gICAgICogICAgICAgICAgICAgXCJzdGF0ZXNcIjogW1xuICAgICAqICAgICAgICAgICAgICAgICB7XG4gICAgICogICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJTVEFSVFwiLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJzcGVlZFwiOiAxXG4gICAgICogICAgICAgICAgICAgICAgIH0sXG4gICAgICogICAgICAgICAgICAgICAgIHtcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkluaXRpYWwgU3RhdGVcIixcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwic3BlZWRcIjogc3BlZWQsXG4gICAgICogICAgICAgICAgICAgICAgICAgICBcImxvb3BcIjogbG9vcCxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwiZGVmYXVsdFN0YXRlXCI6IHRydWVcbiAgICAgKiAgICAgICAgICAgICAgICAgfVxuICAgICAqICAgICAgICAgICAgIF0sXG4gICAgICogICAgICAgICAgICAgXCJ0cmFuc2l0aW9uc1wiOiBbXG4gICAgICogICAgICAgICAgICAgICAgIHtcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwiZnJvbVwiOiBcIlNUQVJUXCIsXG4gICAgICogICAgICAgICAgICAgICAgICAgICBcInRvXCI6IFwiSW5pdGlhbCBTdGF0ZVwiXG4gICAgICogICAgICAgICAgICAgICAgIH1cbiAgICAgKiAgICAgICAgICAgICBdXG4gICAgICogICAgICAgICB9XG4gICAgICogICAgIF0sXG4gICAgICogICAgIFwicGFyYW1ldGVyc1wiOiB7fVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWRTdGF0ZUdyYXBoKHN0YXRlR3JhcGgpIHtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IHN0YXRlR3JhcGg7XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSB7fTtcbiAgICAgICAgY29uc3QgcGFyYW1LZXlzID0gT2JqZWN0LmtleXMoc3RhdGVHcmFwaC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbUtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtS2V5ID0gcGFyYW1LZXlzW2ldO1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyc1twYXJhbUtleV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogc3RhdGVHcmFwaC5wYXJhbWV0ZXJzW3BhcmFtS2V5XS50eXBlLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBzdGF0ZUdyYXBoLnBhcmFtZXRlcnNbcGFyYW1LZXldLnZhbHVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVHcmFwaC5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc3RhdGVHcmFwaC5sYXllcnNbaV07XG4gICAgICAgICAgICB0aGlzLl9hZGRMYXllci5iaW5kKHRoaXMpKHsgLi4ubGF5ZXIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXR1cEFuaW1hdGlvbkFzc2V0cygpO1xuICAgIH1cblxuICAgIHNldHVwQW5pbWF0aW9uQXNzZXRzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLl9sYXllcnNbaV07XG4gICAgICAgICAgICBjb25zdCBsYXllck5hbWUgPSBsYXllci5uYW1lO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsYXllci5zdGF0ZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZU5hbWUgPSBsYXllci5zdGF0ZXNbal07XG4gICAgICAgICAgICAgICAgaWYgKEFOSU1fQ09OVFJPTF9TVEFURVMuaW5kZXhPZihzdGF0ZU5hbWUpID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZUtleSA9IGxheWVyTmFtZSArICc6JyArIHN0YXRlTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9hbmltYXRpb25Bc3NldHNbc3RhdGVLZXldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9hbmltYXRpb25Bc3NldHNbc3RhdGVLZXldID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0OiBudWxsXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZEFuaW1hdGlvbkFzc2V0cygpO1xuICAgIH1cblxuICAgIGxvYWRBbmltYXRpb25Bc3NldHMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuX2xheWVyc1tpXTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuc3RhdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVOYW1lID0gbGF5ZXIuc3RhdGVzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yoc3RhdGVOYW1lKSAhPT0gLTEpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFuaW1hdGlvbkFzc2V0ID0gdGhpcy5fYW5pbWF0aW9uQXNzZXRzW2xheWVyLm5hbWUgKyAnOicgKyBzdGF0ZU5hbWVdO1xuICAgICAgICAgICAgICAgIGlmICghYW5pbWF0aW9uQXNzZXQgfHwgIWFuaW1hdGlvbkFzc2V0LmFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlTm9kZUFuaW1hdGlvbnMoc3RhdGVOYW1lLCBsYXllci5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SWQgPSBhbmltYXRpb25Bc3NldC5hc3NldDtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KGFzc2V0SWQpO1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIHdoZXRoZXIgYXNzaWduZWQgYW5pbWF0aW9uIGFzc2V0IHN0aWxsIGV4aXN0c1xuICAgICAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25BbmltYXRpb25Bc3NldExvYWRlZChsYXllci5uYW1lLCBzdGF0ZU5hbWUsIGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2xvYWQnLCBmdW5jdGlvbiAobGF5ZXJOYW1lLCBzdGF0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25BbmltYXRpb25Bc3NldExvYWRlZChsYXllck5hbWUsIHN0YXRlTmFtZSwgYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZCh0aGlzKShsYXllci5uYW1lLCBzdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkFuaW1hdGlvbkFzc2V0TG9hZGVkKGxheWVyTmFtZSwgc3RhdGVOYW1lLCBhc3NldCkge1xuICAgICAgICB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllck5hbWUpLmFzc2lnbkFuaW1hdGlvbihzdGF0ZU5hbWUsIGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBsYXllcnMgZnJvbSB0aGUgYW5pbSBjb21wb25lbnQuXG4gICAgICovXG4gICAgcmVtb3ZlU3RhdGVHcmFwaCgpIHtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGhBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbkFzc2V0cyA9IHt9O1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBbXTtcbiAgICAgICAgdGhpcy5fbGF5ZXJJbmRpY2VzID0ge307XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSB7fTtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnVuYmluZCgpO1xuICAgICAgICAvLyBjbGVhciBhbGwgdGFyZ2V0cyBmcm9tIHByZXZpb3VzIGJpbmRpbmdcbiAgICAgICAgdGhpcy5fdGFyZ2V0cyA9IHt9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0IGFsbCBvZiB0aGUgY29tcG9uZW50cyBsYXllcnMgYW5kIHBhcmFtZXRlcnMgdG8gdGhlaXIgaW5pdGlhbCBzdGF0ZXMuIElmIGEgbGF5ZXIgd2FzXG4gICAgICogcGxheWluZyBiZWZvcmUgaXQgd2lsbCBjb250aW51ZSBwbGF5aW5nLlxuICAgICAqL1xuICAgIHJlc2V0KCkge1xuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fc3RhdGVHcmFwaC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyUGxheWluZyA9IHRoaXMuX2xheWVyc1tpXS5wbGF5aW5nO1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldLnJlc2V0KCk7XG4gICAgICAgICAgICB0aGlzLl9sYXllcnNbaV0ucGxheWluZyA9IGxheWVyUGxheWluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVuYmluZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ub3JtYWxpemVXZWlnaHRzKSB7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl90YXJnZXRzKS5mb3JFYWNoKCh0YXJnZXRLZXkpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl90YXJnZXRzW3RhcmdldEtleV0udW5iaW5kKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYmluZCBhbGwgb2YgdGhlIGNvbXBvbmVudHMgbGF5ZXJzLlxuICAgICAqL1xuICAgIHJlYmluZCgpIHtcbiAgICAgICAgLy8gY2xlYXIgYWxsIHRhcmdldHMgZnJvbSBwcmV2aW91cyBiaW5kaW5nXG4gICAgICAgIHRoaXMuX3RhcmdldHMgPSB7fTtcbiAgICAgICAgLy8gcmViaW5kIGFsbCBsYXllcnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXS5yZWJpbmQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmRzIGEge0BsaW5rIEFuaW1Db21wb25lbnRMYXllcn0gaW4gdGhpcyBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltIGNvbXBvbmVudCBsYXllciB0byBmaW5kLlxuICAgICAqIEByZXR1cm5zIHtBbmltQ29tcG9uZW50TGF5ZXJ9IExheWVyLlxuICAgICAqL1xuICAgIGZpbmRBbmltYXRpb25MYXllcihuYW1lKSB7XG4gICAgICAgIGNvbnN0IGxheWVySW5kZXggPSB0aGlzLl9sYXllckluZGljZXNbbmFtZV07XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnNbbGF5ZXJJbmRleF0gfHwgbnVsbDtcbiAgICB9XG5cbiAgICBhZGRBbmltYXRpb25TdGF0ZShub2RlTmFtZSwgYW5pbVRyYWNrLCBzcGVlZCA9IDEsIGxvb3AgPSB0cnVlLCBsYXllck5hbWUgPSAnQmFzZScpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdGF0ZUdyYXBoKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKG5ldyBBbmltU3RhdGVHcmFwaCh7XG4gICAgICAgICAgICAgICAgJ2xheWVycyc6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiBsYXllck5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3RhdGVzJzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiAnU1RBUlQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3BlZWQnOiAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogbm9kZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzcGVlZCc6IHNwZWVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbG9vcCc6IGxvb3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkZWZhdWx0U3RhdGUnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICd0cmFuc2l0aW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdmcm9tJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RvJzogbm9kZU5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICdwYXJhbWV0ZXJzJzoge31cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKGxheWVyTmFtZSk7XG4gICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgbGF5ZXIuYXNzaWduQW5pbWF0aW9uKG5vZGVOYW1lLCBhbmltVHJhY2ssIHNwZWVkLCBsb29wKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGF5ZXIobGF5ZXJOYW1lKT8uYXNzaWduQW5pbWF0aW9uKG5vZGVOYW1lLCBhbmltVHJhY2ssIHNwZWVkLCBsb29wKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc29jaWF0ZXMgYW4gYW5pbWF0aW9uIHdpdGggYSBzdGF0ZSBvciBibGVuZCB0cmVlIG5vZGUgaW4gdGhlIGxvYWRlZCBzdGF0ZSBncmFwaC4gSWYgYWxsXG4gICAgICogc3RhdGVzIGFyZSBsaW5rZWQgYW5kIHRoZSB7QGxpbmsgQW5pbUNvbXBvbmVudCNhY3RpdmF0ZX0gdmFsdWUgd2FzIHNldCB0byB0cnVlIHRoZW4gdGhlXG4gICAgICogY29tcG9uZW50IHdpbGwgYmVnaW4gcGxheWluZy4gSWYgbm8gc3RhdGUgZ3JhcGggaXMgbG9hZGVkLCBhIGRlZmF1bHQgc3RhdGUgZ3JhcGggd2lsbCBiZVxuICAgICAqIGNyZWF0ZWQgd2l0aCBhIHNpbmdsZSBzdGF0ZSBiYXNlZCBvbiB0aGUgcHJvdmlkZWQgbm9kZVBhdGggcGFyYW1ldGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5vZGVQYXRoIC0gRWl0aGVyIHRoZSBzdGF0ZSBuYW1lIG9yIHRoZSBwYXRoIHRvIGEgYmxlbmQgdHJlZSBub2RlIHRoYXQgdGhpc1xuICAgICAqIGFuaW1hdGlvbiBzaG91bGQgYmUgYXNzb2NpYXRlZCB3aXRoLiBFYWNoIHNlY3Rpb24gb2YgYSBibGVuZCB0cmVlIHBhdGggaXMgc3BsaXQgdXNpbmcgYVxuICAgICAqIHBlcmlvZCAoYC5gKSB0aGVyZWZvcmUgc3RhdGUgbmFtZXMgc2hvdWxkIG5vdCBpbmNsdWRlIHRoaXMgY2hhcmFjdGVyIChlLmcgXCJNeVN0YXRlTmFtZVwiIG9yXG4gICAgICogXCJNeVN0YXRlTmFtZS5CbGVuZFRyZWVOb2RlXCIpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBhbmltVHJhY2sgLSBUaGUgYW5pbWF0aW9uIHRyYWNrIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0byB0aGlzIHN0YXRlIGFuZFxuICAgICAqIHBsYXllZCB3aGVuZXZlciB0aGlzIHN0YXRlIGlzIGFjdGl2ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2xheWVyTmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgYW5pbSBjb21wb25lbnQgbGF5ZXIgdG8gdXBkYXRlLiBJZiBvbWl0dGVkIHRoZVxuICAgICAqIGRlZmF1bHQgbGF5ZXIgaXMgdXNlZC4gSWYgbm8gc3RhdGUgZ3JhcGggaGFzIGJlZW4gcHJldmlvdXNseSBsb2FkZWQgdGhpcyBwYXJhbWV0ZXIgaXNcbiAgICAgKiBpZ25vcmVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc3BlZWRdIC0gVXBkYXRlIHRoZSBzcGVlZCBvZiB0aGUgc3RhdGUgeW91IGFyZSBhc3NpZ25pbmcgYW4gYW5pbWF0aW9uIHRvLlxuICAgICAqIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbG9vcF0gLSBVcGRhdGUgdGhlIGxvb3AgcHJvcGVydHkgb2YgdGhlIHN0YXRlIHlvdSBhcmUgYXNzaWduaW5nIGFuXG4gICAgICogYW5pbWF0aW9uIHRvLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqL1xuICAgIGFzc2lnbkFuaW1hdGlvbihub2RlUGF0aCwgYW5pbVRyYWNrLCBsYXllck5hbWUsIHNwZWVkID0gMSwgbG9vcCA9IHRydWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdGF0ZUdyYXBoICYmIG5vZGVQYXRoLmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZFN0YXRlR3JhcGgobmV3IEFuaW1TdGF0ZUdyYXBoKHtcbiAgICAgICAgICAgICAgICAnbGF5ZXJzJzogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6ICdCYXNlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdGF0ZXMnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzcGVlZCc6IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiBub2RlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NwZWVkJzogc3BlZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsb29wJzogbG9vcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2RlZmF1bHRTdGF0ZSc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RyYW5zaXRpb25zJzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zyb20nOiAnU1RBUlQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndG8nOiBub2RlUGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgJ3BhcmFtZXRlcnMnOiB7fVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgdGhpcy5iYXNlTGF5ZXIuYXNzaWduQW5pbWF0aW9uKG5vZGVQYXRoLCBhbmltVHJhY2spO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJOYW1lID8gdGhpcy5maW5kQW5pbWF0aW9uTGF5ZXIobGF5ZXJOYW1lKSA6IHRoaXMuYmFzZUxheWVyO1xuICAgICAgICBpZiAoIWxheWVyKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcignYXNzaWduQW5pbWF0aW9uOiBUcnlpbmcgdG8gYXNzaWduIGFuIGFuaW0gdHJhY2sgdG8gYSBsYXllciB0aGF0IGRvZXNuXFwndCBleGlzdCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxheWVyLmFzc2lnbkFuaW1hdGlvbihub2RlUGF0aCwgYW5pbVRyYWNrLCBzcGVlZCwgbG9vcCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbmltYXRpb25zIGZyb20gYSBub2RlIGluIHRoZSBsb2FkZWQgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbm9kZU5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgbm9kZSB0aGF0IHNob3VsZCBoYXZlIGl0cyBhbmltYXRpb24gdHJhY2tzIHJlbW92ZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtsYXllck5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW0gY29tcG9uZW50IGxheWVyIHRvIHVwZGF0ZS4gSWYgb21pdHRlZCB0aGVcbiAgICAgKiBkZWZhdWx0IGxheWVyIGlzIHVzZWQuXG4gICAgICovXG4gICAgcmVtb3ZlTm9kZUFuaW1hdGlvbnMobm9kZU5hbWUsIGxheWVyTmFtZSkge1xuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyTmFtZSA/IHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKGxheWVyTmFtZSkgOiB0aGlzLmJhc2VMYXllcjtcbiAgICAgICAgaWYgKCFsYXllcikge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ3JlbW92ZVN0YXRlQW5pbWF0aW9uczogVHJ5aW5nIHRvIHJlbW92ZSBhbmltYXRpb24gdHJhY2tzIGZyb20gYSBzdGF0ZSBiZWZvcmUgdGhlIHN0YXRlIGdyYXBoIGhhcyBiZWVuIGxvYWRlZC4gSGF2ZSB5b3UgY2FsbGVkIGxvYWRTdGF0ZUdyYXBoPycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxheWVyLnJlbW92ZU5vZGVBbmltYXRpb25zKG5vZGVOYW1lKTtcbiAgICB9XG5cbiAgICBnZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCB0eXBlKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtID0gdGhpcy5fcGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgaWYgKHBhcmFtICYmIHBhcmFtLnR5cGUgPT09IHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJhbS52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBEZWJ1Zy5sb2coYENhbm5vdCBnZXQgcGFyYW1ldGVyIHZhbHVlLiBObyBwYXJhbWV0ZXIgZm91bmQgaW4gYW5pbSBjb250cm9sbGVyIG5hbWVkIFwiJHtuYW1lfVwiIG9mIHR5cGUgXCIke3R5cGV9XCJgKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBzZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCB0eXBlLCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBwYXJhbSA9IHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIGlmIChwYXJhbSAmJiBwYXJhbS50eXBlID09PSB0eXBlKSB7XG4gICAgICAgICAgICBwYXJhbS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIERlYnVnLmxvZyhgQ2Fubm90IHNldCBwYXJhbWV0ZXIgdmFsdWUuIE5vIHBhcmFtZXRlciBmb3VuZCBpbiBhbmltIGNvbnRyb2xsZXIgbmFtZWQgXCIke25hbWV9XCIgb2YgdHlwZSBcIiR7dHlwZX1cImApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBmbG9hdCBwYXJhbWV0ZXIgdmFsdWUgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGZsb2F0IHRvIHJldHVybiB0aGUgdmFsdWUgb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQSBmbG9hdC5cbiAgICAgKi9cbiAgICBnZXRGbG9hdChuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0ZMT0FUKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiBhIGZsb2F0IHBhcmFtZXRlciB0aGF0IHdhcyBkZWZpbmVkIGluIHRoZSBhbmltYXRpb24gY29tcG9uZW50cyBzdGF0ZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIG5ldyBmbG9hdCB2YWx1ZSB0byBzZXQgdGhpcyBwYXJhbWV0ZXIgdG8uXG4gICAgICovXG4gICAgc2V0RmxvYXQobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9GTE9BVCwgdmFsdWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaW50ZWdlciBwYXJhbWV0ZXIgdmFsdWUgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGludGVnZXIgdG8gcmV0dXJuIHRoZSB2YWx1ZSBvZi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbiBpbnRlZ2VyLlxuICAgICAqL1xuICAgIGdldEludGVnZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9JTlRFR0VSKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiBhbiBpbnRlZ2VyIHBhcmFtZXRlciB0aGF0IHdhcyBkZWZpbmVkIGluIHRoZSBhbmltYXRpb24gY29tcG9uZW50cyBzdGF0ZVxuICAgICAqIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgbmV3IGludGVnZXIgdmFsdWUgdG8gc2V0IHRoaXMgcGFyYW1ldGVyIHRvLlxuICAgICAqL1xuICAgIHNldEludGVnZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgdmFsdWUgJSAxID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0lOVEVHRVIsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdBdHRlbXB0aW5nIHRvIGFzc2lnbiBub24gaW50ZWdlciB2YWx1ZSB0byBpbnRlZ2VyIHBhcmFtZXRlcicsIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBib29sZWFuIHBhcmFtZXRlciB2YWx1ZSBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYm9vbGVhbiB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBBIGJvb2xlYW4uXG4gICAgICovXG4gICAgZ2V0Qm9vbGVhbihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0JPT0xFQU4pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGEgYm9vbGVhbiBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB2YWx1ZSAtIFRoZSBuZXcgYm9vbGVhbiB2YWx1ZSB0byBzZXQgdGhpcyBwYXJhbWV0ZXIgdG8uXG4gICAgICovXG4gICAgc2V0Qm9vbGVhbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0JPT0xFQU4sICEhdmFsdWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSB0cmlnZ2VyIHBhcmFtZXRlciB2YWx1ZSBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgdHJpZ2dlciB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBBIGJvb2xlYW4uXG4gICAgICovXG4gICAgZ2V0VHJpZ2dlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGEgdHJpZ2dlciBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaCB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtzaW5nbGVGcmFtZV0gLSBJZiB0cnVlLCB0aGlzIHRyaWdnZXIgd2lsbCBiZSBzZXQgYmFjayB0byBmYWxzZSBhdCB0aGUgZW5kXG4gICAgICogb2YgdGhlIGFuaW1hdGlvbiB1cGRhdGUuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqL1xuICAgIHNldFRyaWdnZXIobmFtZSwgc2luZ2xlRnJhbWUgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIsIHRydWUpO1xuICAgICAgICBpZiAoc2luZ2xlRnJhbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuYWRkKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzZXRzIHRoZSB2YWx1ZSBvZiBhIHRyaWdnZXIgcGFyYW1ldGVyIHRoYXQgd2FzIGRlZmluZWQgaW4gdGhlIGFuaW1hdGlvbiBjb21wb25lbnRzIHN0YXRlXG4gICAgICogZ3JhcGggdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqL1xuICAgIHJlc2V0VHJpZ2dlcihuYW1lKSB7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgZmFsc2UpO1xuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICBpZiAoTnVtYmVyLmlzRmluaXRlKHRoaXMuX3N0YXRlR3JhcGhBc3NldCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRlR3JhcGhBc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3N0YXRlR3JhcGhBc3NldCk7XG4gICAgICAgICAgICBzdGF0ZUdyYXBoQXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmxheWVyc1tpXS51cGRhdGUoZHQgKiB0aGlzLnNwZWVkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzLmZvckVhY2goKHRyaWdnZXIpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGFyYW1ldGVyc1t0cmlnZ2VyXS52YWx1ZSA9IGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2Vycy5jbGVhcigpO1xuICAgIH1cblxuICAgIHJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhvbGRBbmltLCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGlmIChvbGRBbmltLnJvb3RCb25lICYmIGR1cGxpY2F0ZWRJZHNNYXBbb2xkQW5pbS5yb290Qm9uZS5nZXRHdWlkKCldKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3RCb25lID0gZHVwbGljYXRlZElkc01hcFtvbGRBbmltLnJvb3RCb25lLmdldEd1aWQoKV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlYmluZCgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiQW5pbUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3N0YXRlR3JhcGhBc3NldCIsIl9hbmltYXRpb25Bc3NldHMiLCJfc3BlZWQiLCJfYWN0aXZhdGUiLCJfcGxheWluZyIsIl9yb290Qm9uZSIsIl9zdGF0ZUdyYXBoIiwiX2xheWVycyIsIl9sYXllckluZGljZXMiLCJfcGFyYW1ldGVycyIsIl90YXJnZXRzIiwiX2NvbnN1bWVkVHJpZ2dlcnMiLCJTZXQiLCJfbm9ybWFsaXplV2VpZ2h0cyIsInN0YXRlR3JhcGhBc3NldCIsInZhbHVlIiwicmVtb3ZlU3RhdGVHcmFwaCIsImFwcCIsImFzc2V0cyIsImdldCIsIm9mZiIsIl9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50IiwiX2lkIiwiX2Fzc2V0IiwiQXNzZXQiLCJpZCIsImFkZCIsInJlc291cmNlIiwibG9hZFN0YXRlR3JhcGgiLCJvbiIsIm9uY2UiLCJhc3NldCIsImxvYWQiLCJub3JtYWxpemVXZWlnaHRzIiwidW5iaW5kIiwiYW5pbWF0aW9uQXNzZXRzIiwibG9hZEFuaW1hdGlvbkFzc2V0cyIsInNwZWVkIiwiYWN0aXZhdGUiLCJwbGF5aW5nIiwicm9vdEJvbmUiLCJyb290IiwiZmluZEJ5R3VpZCIsIkRlYnVnIiwiYXNzZXJ0IiwiRW50aXR5IiwicmViaW5kIiwic3RhdGVHcmFwaCIsImxheWVycyIsImxheWVySW5kaWNlcyIsInBhcmFtZXRlcnMiLCJ0YXJnZXRzIiwicGxheWFibGUiLCJpIiwibGVuZ3RoIiwiYmFzZUxheWVyIiwicHJldkFuaW1hdGlvbkFzc2V0cyIsInByZXZNYXNrcyIsIm1hcCIsImxheWVyIiwibWFzayIsIkFuaW1TdGF0ZUdyYXBoIiwiX2RhdGEiLCJmb3JFYWNoIiwiZGlydGlmeVRhcmdldHMiLCJPYmplY3QiLCJ2YWx1ZXMiLCJkaXJ0eSIsIl9hZGRMYXllciIsIm5hbWUiLCJzdGF0ZXMiLCJ0cmFuc2l0aW9ucyIsIndlaWdodCIsImJsZW5kVHlwZSIsImdyYXBoIiwibGF5ZXJJbmRleCIsImFuaW1CaW5kZXIiLCJBbmltQ29tcG9uZW50QmluZGVyIiwiYW5pbUV2YWx1YXRvciIsIkFuaW1FdmFsdWF0b3IiLCJjb250cm9sbGVyIiwiQW5pbUNvbnRyb2xsZXIiLCJwdXNoIiwiQW5pbUNvbXBvbmVudExheWVyIiwiYWRkTGF5ZXIiLCJmaW5kQW5pbWF0aW9uTGF5ZXIiLCJwYXJhbUtleXMiLCJrZXlzIiwicGFyYW1LZXkiLCJ0eXBlIiwiYmluZCIsInNldHVwQW5pbWF0aW9uQXNzZXRzIiwibGF5ZXJOYW1lIiwiaiIsInN0YXRlTmFtZSIsIkFOSU1fQ09OVFJPTF9TVEFURVMiLCJpbmRleE9mIiwic3RhdGVLZXkiLCJhbmltYXRpb25Bc3NldCIsInJlbW92ZU5vZGVBbmltYXRpb25zIiwiYXNzZXRJZCIsIm9uQW5pbWF0aW9uQXNzZXRMb2FkZWQiLCJhc3NpZ25BbmltYXRpb24iLCJyZXNldCIsImFzc2lnbiIsImxheWVyUGxheWluZyIsInRhcmdldEtleSIsImFkZEFuaW1hdGlvblN0YXRlIiwibm9kZU5hbWUiLCJhbmltVHJhY2siLCJsb29wIiwibm9kZVBhdGgiLCJlcnJvciIsImdldFBhcmFtZXRlclZhbHVlIiwicGFyYW0iLCJsb2ciLCJ1bmRlZmluZWQiLCJzZXRQYXJhbWV0ZXJWYWx1ZSIsImdldEZsb2F0IiwiQU5JTV9QQVJBTUVURVJfRkxPQVQiLCJzZXRGbG9hdCIsImdldEludGVnZXIiLCJBTklNX1BBUkFNRVRFUl9JTlRFR0VSIiwic2V0SW50ZWdlciIsImdldEJvb2xlYW4iLCJBTklNX1BBUkFNRVRFUl9CT09MRUFOIiwic2V0Qm9vbGVhbiIsImdldFRyaWdnZXIiLCJBTklNX1BBUkFNRVRFUl9UUklHR0VSIiwic2V0VHJpZ2dlciIsInNpbmdsZUZyYW1lIiwicmVzZXRUcmlnZ2VyIiwib25CZWZvcmVSZW1vdmUiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsInVwZGF0ZSIsImR0IiwidHJpZ2dlciIsImNsZWFyIiwicmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzIiwib2xkQW5pbSIsImR1cGxpY2F0ZWRJZHNNYXAiLCJnZXRHdWlkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxhQUFhLFNBQVNDLFNBQVMsQ0FBQztBQVFsQ0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUVyQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ0Ms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
