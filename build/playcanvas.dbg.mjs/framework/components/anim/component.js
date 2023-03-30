/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
import { AnimTrack } from '../../anim/evaluator/anim-track.js';

/**
 * The Anim Component allows an Entity to playback animations on models and entity properties.
 *
 * @augments Component
 */
class AnimComponent extends Component {
  /**
   * Create a new AnimComponent instance.
   *
   * @param {import('./system.js').AnimComponentSystem} system - The {@link ComponentSystem} that
   * created this Component.
   * @param {Entity} entity - The Entity that this Component is attached to.
   */
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
    // a collection of animated property targets
    this._targets = {};
    this._consumedTriggers = new Set();
    this._normalizeWeights = false;
  }
  set stateGraphAsset(value) {
    if (value === null) {
      this.removeStateGraph();
      return;
    }

    // remove event from previous asset
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

  /**
   * If true the animation component will normalize the weights of its layers by their sum total.
   *
   * @type {boolean}
   */
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

  /**
   * Speed multiplier for animation play back speed. 1.0 is playback at normal speed, 0.0 pauses
   * the animation.
   *
   * @type {number}
   */
  set speed(value) {
    this._speed = value;
  }
  get speed() {
    return this._speed;
  }

  /**
   * If true the first animation will begin playing when the scene is loaded.
   *
   * @type {boolean}
   */
  set activate(value) {
    this._activate = value;
  }
  get activate() {
    return this._activate;
  }

  /**
   * Plays or pauses all animations in the component.
   *
   * @type {boolean}
   */
  set playing(value) {
    this._playing = value;
  }
  get playing() {
    return this._playing;
  }

  /**
   * The entity that this anim component should use as the root of the animation hierarchy.
   *
   * @type {Entity}
   */
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

  /**
   * Returns the animation layers available in this anim component.
   *
   * @type {AnimComponentLayer[]}
   */
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

  /**
   * Returns whether all component layers are currently playable.
   *
   * @type {boolean}
   */
  get playable() {
    for (let i = 0; i < this._layers.length; i++) {
      if (!this._layers[i].playable) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns the base layer of the state graph.
   *
   * @type {AnimComponentLayer|null}
   */
  get baseLayer() {
    if (this._layers.length > 0) {
      return this._layers[0];
    }
    return null;
  }
  _onStateGraphAssetChangeEvent(asset) {
    // both animationAssets and layer masks should be maintained when switching AnimStateGraph assets
    const prevAnimationAssets = this.animationAssets;
    const prevMasks = this.layers.map(layer => layer.mask);
    // clear the previous state graph
    this.removeStateGraph();
    // load the new state graph
    this._stateGraph = new AnimStateGraph(asset._data);
    this.loadStateGraph(this._stateGraph);
    // assign the previous animation assets
    this.animationAssets = prevAnimationAssets;
    this.loadAnimationAssets();
    // assign the previous layer masks then rebind all anim targets
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

  /**
   * Adds a new anim component layer to the anim component.
   *
   * @param {string} name - The name of the layer to create.
   * @param {number} [weight] - The blending weight of the layer. Defaults to 1.
   * @param {object[]} [mask] - A list of paths to bones in the model which should be animated in
   * this layer. If omitted the full model is used. Defaults to null.
   * @param {string} [blendType] - Defines how properties animated by this layer blend with
   * animations of those properties in previous layers. Defaults to pc.ANIM_LAYER_OVERWRITE.
   * @returns {AnimComponentLayer} The created anim component layer.
   */
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

  /**
   * Initializes component animation controllers using the provided state graph.
   *
   * @param {object} stateGraph - The state graph asset to load into the component. Contains the
   * states, transitions and parameters used to define a complete animation controller.
   * @example
   * entity.anim.loadStateGraph({
   *     "layers": [
   *         {
   *             "name": layerName,
   *             "states": [
   *                 {
   *                     "name": "START",
   *                     "speed": 1
   *                 },
   *                 {
   *                     "name": "Initial State",
   *                     "speed": speed,
   *                     "loop": loop,
   *                     "defaultState": true
   *                 }
   *             ],
   *             "transitions": [
   *                 {
   *                     "from": "START",
   *                     "to": "Initial State"
   *                 }
   *             ]
   *         }
   *     ],
   *     "parameters": {}
   * });
   */
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
    let containsBlendTree = false;
    for (let i = 0; i < stateGraph.layers.length; i++) {
      const layer = stateGraph.layers[i];
      this._addLayer.bind(this)(_extends({}, layer));
      if (layer.states.some(state => state.blendTree)) {
        containsBlendTree = true;
      }
    }
    // blend trees do not support the automatic assignment of animation assets
    if (!containsBlendTree) {
      this.setupAnimationAssets();
    }
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
          this.findAnimationLayer(layer.name).assignAnimation(stateName, AnimTrack.EMPTY);
          continue;
        }
        const assetId = animationAsset.asset;
        const asset = this.system.app.assets.get(assetId);
        // check whether assigned animation asset still exists
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

  /**
   * Removes all layers from the anim component.
   */
  removeStateGraph() {
    this._stateGraph = null;
    this._stateGraphAsset = null;
    this._animationAssets = {};
    this._layers = [];
    this._layerIndices = {};
    this._parameters = {};
    this._playing = false;
    this.unbind();
    // clear all targets from previous binding
    this._targets = {};
  }

  /**
   * Reset all of the components layers and parameters to their initial states. If a layer was
   * playing before it will continue playing.
   */
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

  /**
   * Rebind all of the components layers.
   */
  rebind() {
    // clear all targets from previous binding
    this._targets = {};
    // rebind all layers
    for (let i = 0; i < this._layers.length; i++) {
      this._layers[i].rebind();
    }
  }

  /**
   * Finds a {@link AnimComponentLayer} in this component.
   *
   * @param {string} name - The name of the anim component layer to find.
   * @returns {AnimComponentLayer} Layer.
   */
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

  /**
   * Associates an animation with a state or blend tree node in the loaded state graph. If all
   * states are linked and the {@link AnimComponent#activate} value was set to true then the
   * component will begin playing. If no state graph is loaded, a default state graph will be
   * created with a single state based on the provided nodePath parameter.
   *
   * @param {string} nodePath - Either the state name or the path to a blend tree node that this
   * animation should be associated with. Each section of a blend tree path is split using a
   * period (`.`) therefore state names should not include this character (e.g "MyStateName" or
   * "MyStateName.BlendTreeNode").
   * @param {object} animTrack - The animation track that will be assigned to this state and
   * played whenever this state is active.
   * @param {string} [layerName] - The name of the anim component layer to update. If omitted the
   * default layer is used. If no state graph has been previously loaded this parameter is
   * ignored.
   * @param {number} [speed] - Update the speed of the state you are assigning an animation to.
   * Defaults to 1.
   * @param {boolean} [loop] - Update the loop property of the state you are assigning an
   * animation to. Defaults to true.
   */
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

  /**
   * Removes animations from a node in the loaded state graph.
   *
   * @param {string} nodeName - The name of the node that should have its animation tracks removed.
   * @param {string} [layerName] - The name of the anim component layer to update. If omitted the
   * default layer is used.
   */
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

  /**
   * Returns a float parameter value by name.
   *
   * @param {string} name - The name of the float to return the value of.
   * @returns {number} A float.
   */
  getFloat(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_FLOAT);
  }

  /**
   * Sets the value of a float parameter that was defined in the animation components state graph.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {number} value - The new float value to set this parameter to.
   */
  setFloat(name, value) {
    this.setParameterValue(name, ANIM_PARAMETER_FLOAT, value);
  }

  /**
   * Returns an integer parameter value by name.
   *
   * @param {string} name - The name of the integer to return the value of.
   * @returns {number} An integer.
   */
  getInteger(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_INTEGER);
  }

  /**
   * Sets the value of an integer parameter that was defined in the animation components state
   * graph.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {number} value - The new integer value to set this parameter to.
   */
  setInteger(name, value) {
    if (typeof value === 'number' && value % 1 === 0) {
      this.setParameterValue(name, ANIM_PARAMETER_INTEGER, value);
    } else {
      Debug.error('Attempting to assign non integer value to integer parameter', name, value);
    }
  }

  /**
   * Returns a boolean parameter value by name.
   *
   * @param {string} name - The name of the boolean to return the value of.
   * @returns {boolean} A boolean.
   */
  getBoolean(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_BOOLEAN);
  }

  /**
   * Sets the value of a boolean parameter that was defined in the animation components state
   * graph.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {boolean} value - The new boolean value to set this parameter to.
   */
  setBoolean(name, value) {
    this.setParameterValue(name, ANIM_PARAMETER_BOOLEAN, !!value);
  }

  /**
   * Returns a trigger parameter value by name.
   *
   * @param {string} name - The name of the trigger to return the value of.
   * @returns {boolean} A boolean.
   */
  getTrigger(name) {
    return this.getParameterValue(name, ANIM_PARAMETER_TRIGGER);
  }

  /**
   * Sets the value of a trigger parameter that was defined in the animation components state
   * graph to true.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {boolean} [singleFrame] - If true, this trigger will be set back to false at the end
   * of the animation update. Defaults to false.
   */
  setTrigger(name, singleFrame = false) {
    this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, true);
    if (singleFrame) {
      this._consumedTriggers.add(name);
    }
  }

  /**
   * Resets the value of a trigger parameter that was defined in the animation components state
   * graph to false.
   *
   * @param {string} name - The name of the parameter to set.
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvYW5pbS1jb250cm9sbGVyLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHtcbiAgICBBTklNX1BBUkFNRVRFUl9CT09MRUFOLCBBTklNX1BBUkFNRVRFUl9GTE9BVCwgQU5JTV9QQVJBTUVURVJfSU5URUdFUiwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEFuaW1Db21wb25lbnRCaW5kZXIgfSBmcm9tICcuL2NvbXBvbmVudC1iaW5kZXIuanMnO1xuaW1wb3J0IHsgQW5pbUNvbXBvbmVudExheWVyIH0gZnJvbSAnLi9jb21wb25lbnQtbGF5ZXIuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlR3JhcGggfSBmcm9tICcuLi8uLi9hbmltL3N0YXRlLWdyYXBoL2FuaW0tc3RhdGUtZ3JhcGguanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcbmltcG9ydCB7IEFuaW1UcmFjayB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tdHJhY2suanMnO1xuXG4vKipcbiAqIFRoZSBBbmltIENvbXBvbmVudCBhbGxvd3MgYW4gRW50aXR5IHRvIHBsYXliYWNrIGFuaW1hdGlvbnMgb24gbW9kZWxzIGFuZCBlbnRpdHkgcHJvcGVydGllcy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIEFuaW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQW5pbUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIHtAbGluayBDb21wb25lbnRTeXN0ZW19IHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGhBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbkFzc2V0cyA9IHt9O1xuICAgICAgICB0aGlzLl9zcGVlZCA9IDEuMDtcbiAgICAgICAgdGhpcy5fYWN0aXZhdGUgPSB0cnVlO1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3Jvb3RCb25lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtdO1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHt9O1xuICAgICAgICAvLyBhIGNvbGxlY3Rpb24gb2YgYW5pbWF0ZWQgcHJvcGVydHkgdGFyZ2V0c1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX25vcm1hbGl6ZVdlaWdodHMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBzZXQgc3RhdGVHcmFwaEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVTdGF0ZUdyYXBoKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZXZlbnQgZnJvbSBwcmV2aW91cyBhc3NldFxuICAgICAgICBpZiAodGhpcy5fc3RhdGVHcmFwaEFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0ZUdyYXBoQXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zdGF0ZUdyYXBoQXNzZXQpO1xuICAgICAgICAgICAgc3RhdGVHcmFwaEFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgX2lkO1xuICAgICAgICBsZXQgX2Fzc2V0O1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgIF9hc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KF9pZCk7XG4gICAgICAgICAgICBpZiAoIV9hc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuYWRkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBfYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChfaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX2lkID0gdmFsdWU7XG4gICAgICAgICAgICBfYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChfaWQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghX2Fzc2V0IHx8IHRoaXMuX3N0YXRlR3JhcGhBc3NldCA9PT0gX2lkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2Fzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gX2Fzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaCh0aGlzLl9zdGF0ZUdyYXBoKTtcbiAgICAgICAgICAgIF9hc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudCwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfYXNzZXQub25jZSgnbG9hZCcsIChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKHRoaXMuX3N0YXRlR3JhcGgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKF9hc3NldCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaEFzc2V0ID0gX2lkO1xuICAgIH1cblxuICAgIGdldCBzdGF0ZUdyYXBoQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZUdyYXBoQXNzZXQ7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBhbmltYXRpb24gY29tcG9uZW50IHdpbGwgbm9ybWFsaXplIHRoZSB3ZWlnaHRzIG9mIGl0cyBsYXllcnMgYnkgdGhlaXIgc3VtIHRvdGFsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IG5vcm1hbGl6ZVdlaWdodHModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbm9ybWFsaXplV2VpZ2h0cyA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVuYmluZCgpO1xuICAgIH1cblxuICAgIGdldCBub3JtYWxpemVXZWlnaHRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbm9ybWFsaXplV2VpZ2h0cztcbiAgICB9XG5cbiAgICBzZXQgYW5pbWF0aW9uQXNzZXRzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbkFzc2V0cyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICB9XG5cbiAgICBnZXQgYW5pbWF0aW9uQXNzZXRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbWF0aW9uQXNzZXRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwZWVkIG11bHRpcGxpZXIgZm9yIGFuaW1hdGlvbiBwbGF5IGJhY2sgc3BlZWQuIDEuMCBpcyBwbGF5YmFjayBhdCBub3JtYWwgc3BlZWQsIDAuMCBwYXVzZXNcbiAgICAgKiB0aGUgYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3BlZWQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3BlZWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc3BlZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcGVlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBmaXJzdCBhbmltYXRpb24gd2lsbCBiZWdpbiBwbGF5aW5nIHdoZW4gdGhlIHNjZW5lIGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBhY3RpdmF0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hY3RpdmF0ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhY3RpdmF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2YXRlO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogUGxheXMgb3IgcGF1c2VzIGFsbCBhbmltYXRpb25zIGluIHRoZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgcGxheWluZyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHBsYXlpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wbGF5aW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBlbnRpdHkgdGhhdCB0aGlzIGFuaW0gY29tcG9uZW50IHNob3VsZCB1c2UgYXMgdGhlIHJvb3Qgb2YgdGhlIGFuaW1hdGlvbiBoaWVyYXJjaHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RW50aXR5fVxuICAgICAqL1xuICAgIHNldCByb290Qm9uZSh2YWx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5lbnRpdHkucm9vdC5maW5kQnlHdWlkKHZhbHVlKTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChlbnRpdHksIGByb290Qm9uZSBlbnRpdHkgZm9yIHN1cHBsaWVkIGd1aWQ6JHt2YWx1ZX0gY2Fubm90IGJlIGZvdW5kIGluIHRoZSBzY2VuZWApO1xuICAgICAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBlbnRpdHk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBFbnRpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3Jvb3RCb25lID0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yb290Qm9uZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWJpbmQoKTtcbiAgICB9XG5cbiAgICBnZXQgcm9vdEJvbmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb290Qm9uZTtcbiAgICB9XG5cbiAgICBzZXQgc3RhdGVHcmFwaCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXRlR3JhcGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZUdyYXBoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGFuaW1hdGlvbiBsYXllcnMgYXZhaWxhYmxlIGluIHRoaXMgYW5pbSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QW5pbUNvbXBvbmVudExheWVyW119XG4gICAgICovXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICBzZXQgbGF5ZXJJbmRpY2VzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xheWVySW5kaWNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsYXllckluZGljZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllckluZGljZXM7XG4gICAgfVxuXG4gICAgc2V0IHBhcmFtZXRlcnModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyYW1ldGVycztcbiAgICB9XG5cbiAgICBzZXQgdGFyZ2V0cyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl90YXJnZXRzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHRhcmdldHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90YXJnZXRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgd2hldGhlciBhbGwgY29tcG9uZW50IGxheWVycyBhcmUgY3VycmVudGx5IHBsYXlhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHBsYXlhYmxlKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9sYXllcnNbaV0ucGxheWFibGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgYmFzZSBsYXllciBvZiB0aGUgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QW5pbUNvbXBvbmVudExheWVyfG51bGx9XG4gICAgICovXG4gICAgZ2V0IGJhc2VMYXllcigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xheWVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzWzBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIF9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50KGFzc2V0KSB7XG4gICAgICAgIC8vIGJvdGggYW5pbWF0aW9uQXNzZXRzIGFuZCBsYXllciBtYXNrcyBzaG91bGQgYmUgbWFpbnRhaW5lZCB3aGVuIHN3aXRjaGluZyBBbmltU3RhdGVHcmFwaCBhc3NldHNcbiAgICAgICAgY29uc3QgcHJldkFuaW1hdGlvbkFzc2V0cyA9IHRoaXMuYW5pbWF0aW9uQXNzZXRzO1xuICAgICAgICBjb25zdCBwcmV2TWFza3MgPSB0aGlzLmxheWVycy5tYXAobGF5ZXIgPT4gbGF5ZXIubWFzayk7XG4gICAgICAgIC8vIGNsZWFyIHRoZSBwcmV2aW91cyBzdGF0ZSBncmFwaFxuICAgICAgICB0aGlzLnJlbW92ZVN0YXRlR3JhcGgoKTtcbiAgICAgICAgLy8gbG9hZCB0aGUgbmV3IHN0YXRlIGdyYXBoXG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBuZXcgQW5pbVN0YXRlR3JhcGgoYXNzZXQuX2RhdGEpO1xuICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKHRoaXMuX3N0YXRlR3JhcGgpO1xuICAgICAgICAvLyBhc3NpZ24gdGhlIHByZXZpb3VzIGFuaW1hdGlvbiBhc3NldHNcbiAgICAgICAgdGhpcy5hbmltYXRpb25Bc3NldHMgPSBwcmV2QW5pbWF0aW9uQXNzZXRzO1xuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICAgICAgLy8gYXNzaWduIHRoZSBwcmV2aW91cyBsYXllciBtYXNrcyB0aGVuIHJlYmluZCBhbGwgYW5pbSB0YXJnZXRzXG4gICAgICAgIHRoaXMubGF5ZXJzLmZvckVhY2goKGxheWVyLCBpKSA9PiB7XG4gICAgICAgICAgICBsYXllci5tYXNrID0gcHJldk1hc2tzW2ldO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZWJpbmQoKTtcbiAgICB9XG5cbiAgICBkaXJ0aWZ5VGFyZ2V0cygpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IE9iamVjdC52YWx1ZXModGhpcy5fdGFyZ2V0cyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGFyZ2V0c1tpXS5kaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYWRkTGF5ZXIoeyBuYW1lLCBzdGF0ZXMsIHRyYW5zaXRpb25zLCB3ZWlnaHQsIG1hc2ssIGJsZW5kVHlwZSB9KSB7XG4gICAgICAgIGxldCBncmFwaDtcbiAgICAgICAgaWYgKHRoaXMucm9vdEJvbmUpIHtcbiAgICAgICAgICAgIGdyYXBoID0gdGhpcy5yb290Qm9uZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdyYXBoID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHRoaXMuX2xheWVycy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGFuaW1CaW5kZXIgPSBuZXcgQW5pbUNvbXBvbmVudEJpbmRlcih0aGlzLCBncmFwaCwgbmFtZSwgbWFzaywgbGF5ZXJJbmRleCk7XG4gICAgICAgIGNvbnN0IGFuaW1FdmFsdWF0b3IgPSBuZXcgQW5pbUV2YWx1YXRvcihhbmltQmluZGVyKTtcbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBbmltQ29udHJvbGxlcihcbiAgICAgICAgICAgIGFuaW1FdmFsdWF0b3IsXG4gICAgICAgICAgICBzdGF0ZXMsXG4gICAgICAgICAgICB0cmFuc2l0aW9ucyxcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlcnMsXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmF0ZSxcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuX2xheWVycy5wdXNoKG5ldyBBbmltQ29tcG9uZW50TGF5ZXIobmFtZSwgY29udHJvbGxlciwgdGhpcywgd2VpZ2h0LCBibGVuZFR5cGUpKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJJbmRpY2VzW25hbWVdID0gbGF5ZXJJbmRleDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyc1tsYXllckluZGV4XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbmV3IGFuaW0gY29tcG9uZW50IGxheWVyIHRvIHRoZSBhbmltIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGxheWVyIHRvIGNyZWF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dlaWdodF0gLSBUaGUgYmxlbmRpbmcgd2VpZ2h0IG9mIHRoZSBsYXllci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSBbbWFza10gLSBBIGxpc3Qgb2YgcGF0aHMgdG8gYm9uZXMgaW4gdGhlIG1vZGVsIHdoaWNoIHNob3VsZCBiZSBhbmltYXRlZCBpblxuICAgICAqIHRoaXMgbGF5ZXIuIElmIG9taXR0ZWQgdGhlIGZ1bGwgbW9kZWwgaXMgdXNlZC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2JsZW5kVHlwZV0gLSBEZWZpbmVzIGhvdyBwcm9wZXJ0aWVzIGFuaW1hdGVkIGJ5IHRoaXMgbGF5ZXIgYmxlbmQgd2l0aFxuICAgICAqIGFuaW1hdGlvbnMgb2YgdGhvc2UgcHJvcGVydGllcyBpbiBwcmV2aW91cyBsYXllcnMuIERlZmF1bHRzIHRvIHBjLkFOSU1fTEFZRVJfT1ZFUldSSVRFLlxuICAgICAqIEByZXR1cm5zIHtBbmltQ29tcG9uZW50TGF5ZXJ9IFRoZSBjcmVhdGVkIGFuaW0gY29tcG9uZW50IGxheWVyLlxuICAgICAqL1xuICAgIGFkZExheWVyKG5hbWUsIHdlaWdodCwgbWFzaywgYmxlbmRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5maW5kQW5pbWF0aW9uTGF5ZXIobmFtZSk7XG4gICAgICAgIGlmIChsYXllcikgcmV0dXJuIGxheWVyO1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJ25hbWUnOiAnU1RBUlQnLFxuICAgICAgICAgICAgICAgICdzcGVlZCc6IDFcbiAgICAgICAgICAgIH1cbiAgICAgICAgXTtcbiAgICAgICAgY29uc3QgdHJhbnNpdGlvbnMgPSBbXTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZExheWVyKHsgbmFtZSwgc3RhdGVzLCB0cmFuc2l0aW9ucywgd2VpZ2h0LCBtYXNrLCBibGVuZFR5cGUgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgY29tcG9uZW50IGFuaW1hdGlvbiBjb250cm9sbGVycyB1c2luZyB0aGUgcHJvdmlkZWQgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc3RhdGVHcmFwaCAtIFRoZSBzdGF0ZSBncmFwaCBhc3NldCB0byBsb2FkIGludG8gdGhlIGNvbXBvbmVudC4gQ29udGFpbnMgdGhlXG4gICAgICogc3RhdGVzLCB0cmFuc2l0aW9ucyBhbmQgcGFyYW1ldGVycyB1c2VkIHRvIGRlZmluZSBhIGNvbXBsZXRlIGFuaW1hdGlvbiBjb250cm9sbGVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LmFuaW0ubG9hZFN0YXRlR3JhcGgoe1xuICAgICAqICAgICBcImxheWVyc1wiOiBbXG4gICAgICogICAgICAgICB7XG4gICAgICogICAgICAgICAgICAgXCJuYW1lXCI6IGxheWVyTmFtZSxcbiAgICAgKiAgICAgICAgICAgICBcInN0YXRlc1wiOiBbXG4gICAgICogICAgICAgICAgICAgICAgIHtcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNUQVJUXCIsXG4gICAgICogICAgICAgICAgICAgICAgICAgICBcInNwZWVkXCI6IDFcbiAgICAgKiAgICAgICAgICAgICAgICAgfSxcbiAgICAgKiAgICAgICAgICAgICAgICAge1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSW5pdGlhbCBTdGF0ZVwiLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJzcGVlZFwiOiBzcGVlZCxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwibG9vcFwiOiBsb29wLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJkZWZhdWx0U3RhdGVcIjogdHJ1ZVxuICAgICAqICAgICAgICAgICAgICAgICB9XG4gICAgICogICAgICAgICAgICAgXSxcbiAgICAgKiAgICAgICAgICAgICBcInRyYW5zaXRpb25zXCI6IFtcbiAgICAgKiAgICAgICAgICAgICAgICAge1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJmcm9tXCI6IFwiU1RBUlRcIixcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogXCJJbml0aWFsIFN0YXRlXCJcbiAgICAgKiAgICAgICAgICAgICAgICAgfVxuICAgICAqICAgICAgICAgICAgIF1cbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgXSxcbiAgICAgKiAgICAgXCJwYXJhbWV0ZXJzXCI6IHt9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZFN0YXRlR3JhcGgoc3RhdGVHcmFwaCkge1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gc3RhdGVHcmFwaDtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHt9O1xuICAgICAgICBjb25zdCBwYXJhbUtleXMgPSBPYmplY3Qua2V5cyhzdGF0ZUdyYXBoLnBhcmFtZXRlcnMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcmFtS2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1LZXkgPSBwYXJhbUtleXNbaV07XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJzW3BhcmFtS2V5XSA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBzdGF0ZUdyYXBoLnBhcmFtZXRlcnNbcGFyYW1LZXldLnR5cGUsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHN0YXRlR3JhcGgucGFyYW1ldGVyc1twYXJhbUtleV0udmFsdWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW107XG5cbiAgICAgICAgbGV0IGNvbnRhaW5zQmxlbmRUcmVlID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVHcmFwaC5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc3RhdGVHcmFwaC5sYXllcnNbaV07XG4gICAgICAgICAgICB0aGlzLl9hZGRMYXllci5iaW5kKHRoaXMpKHsgLi4ubGF5ZXIgfSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIuc3RhdGVzLnNvbWUoc3RhdGUgPT4gc3RhdGUuYmxlbmRUcmVlKSkge1xuICAgICAgICAgICAgICAgIGNvbnRhaW5zQmxlbmRUcmVlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBibGVuZCB0cmVlcyBkbyBub3Qgc3VwcG9ydCB0aGUgYXV0b21hdGljIGFzc2lnbm1lbnQgb2YgYW5pbWF0aW9uIGFzc2V0c1xuICAgICAgICBpZiAoIWNvbnRhaW5zQmxlbmRUcmVlKSB7XG4gICAgICAgICAgICB0aGlzLnNldHVwQW5pbWF0aW9uQXNzZXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cEFuaW1hdGlvbkFzc2V0cygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5fbGF5ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJOYW1lID0gbGF5ZXIubmFtZTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuc3RhdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVOYW1lID0gbGF5ZXIuc3RhdGVzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yoc3RhdGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVLZXkgPSBsYXllck5hbWUgKyAnOicgKyBzdGF0ZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fYW5pbWF0aW9uQXNzZXRzW3N0YXRlS2V5XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzW3N0YXRlS2V5XSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldDogbnVsbFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICB9XG5cbiAgICBsb2FkQW5pbWF0aW9uQXNzZXRzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLl9sYXllcnNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxheWVyLnN0YXRlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlTmFtZSA9IGxheWVyLnN0YXRlc1tqXTtcbiAgICAgICAgICAgICAgICBpZiAoQU5JTV9DT05UUk9MX1NUQVRFUy5pbmRleE9mKHN0YXRlTmFtZSkgIT09IC0xKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhbmltYXRpb25Bc3NldCA9IHRoaXMuX2FuaW1hdGlvbkFzc2V0c1tsYXllci5uYW1lICsgJzonICsgc3RhdGVOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIWFuaW1hdGlvbkFzc2V0IHx8ICFhbmltYXRpb25Bc3NldC5hc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllci5uYW1lKS5hc3NpZ25BbmltYXRpb24oc3RhdGVOYW1lLCBBbmltVHJhY2suRU1QVFkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJZCA9IGFuaW1hdGlvbkFzc2V0LmFzc2V0O1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoYXNzZXRJZCk7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgd2hldGhlciBhc3NpZ25lZCBhbmltYXRpb24gYXNzZXQgc3RpbGwgZXhpc3RzXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkFuaW1hdGlvbkFzc2V0TG9hZGVkKGxheWVyLm5hbWUsIHN0YXRlTmFtZSwgYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQub25jZSgnbG9hZCcsIGZ1bmN0aW9uIChsYXllck5hbWUsIHN0YXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkFuaW1hdGlvbkFzc2V0TG9hZGVkKGxheWVyTmFtZSwgc3RhdGVOYW1lLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKGxheWVyLm5hbWUsIHN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uQW5pbWF0aW9uQXNzZXRMb2FkZWQobGF5ZXJOYW1lLCBzdGF0ZU5hbWUsIGFzc2V0KSB7XG4gICAgICAgIHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKGxheWVyTmFtZSkuYXNzaWduQW5pbWF0aW9uKHN0YXRlTmFtZSwgYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGxheWVycyBmcm9tIHRoZSBhbmltIGNvbXBvbmVudC5cbiAgICAgKi9cbiAgICByZW1vdmVTdGF0ZUdyYXBoKCkge1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzID0ge307XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtdO1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHt9O1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMudW5iaW5kKCk7XG4gICAgICAgIC8vIGNsZWFyIGFsbCB0YXJnZXRzIGZyb20gcHJldmlvdXMgYmluZGluZ1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzZXQgYWxsIG9mIHRoZSBjb21wb25lbnRzIGxheWVycyBhbmQgcGFyYW1ldGVycyB0byB0aGVpciBpbml0aWFsIHN0YXRlcy4gSWYgYSBsYXllciB3YXNcbiAgICAgKiBwbGF5aW5nIGJlZm9yZSBpdCB3aWxsIGNvbnRpbnVlIHBsYXlpbmcuXG4gICAgICovXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9zdGF0ZUdyYXBoLnBhcmFtZXRlcnMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJQbGF5aW5nID0gdGhpcy5fbGF5ZXJzW2ldLnBsYXlpbmc7XG4gICAgICAgICAgICB0aGlzLl9sYXllcnNbaV0ucmVzZXQoKTtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXS5wbGF5aW5nID0gbGF5ZXJQbGF5aW5nO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdW5iaW5kKCkge1xuICAgICAgICBpZiAoIXRoaXMuX25vcm1hbGl6ZVdlaWdodHMpIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMuX3RhcmdldHMpLmZvckVhY2goKHRhcmdldEtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldHNbdGFyZ2V0S2V5XS51bmJpbmQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmViaW5kIGFsbCBvZiB0aGUgY29tcG9uZW50cyBsYXllcnMuXG4gICAgICovXG4gICAgcmViaW5kKCkge1xuICAgICAgICAvLyBjbGVhciBhbGwgdGFyZ2V0cyBmcm9tIHByZXZpb3VzIGJpbmRpbmdcbiAgICAgICAgdGhpcy5fdGFyZ2V0cyA9IHt9O1xuICAgICAgICAvLyByZWJpbmQgYWxsIGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldLnJlYmluZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSB7QGxpbmsgQW5pbUNvbXBvbmVudExheWVyfSBpbiB0aGlzIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW0gY29tcG9uZW50IGxheWVyIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge0FuaW1Db21wb25lbnRMYXllcn0gTGF5ZXIuXG4gICAgICovXG4gICAgZmluZEFuaW1hdGlvbkxheWVyKG5hbWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHRoaXMuX2xheWVySW5kaWNlc1tuYW1lXTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyc1tsYXllckluZGV4XSB8fCBudWxsO1xuICAgIH1cblxuICAgIGFkZEFuaW1hdGlvblN0YXRlKG5vZGVOYW1lLCBhbmltVHJhY2ssIHNwZWVkID0gMSwgbG9vcCA9IHRydWUsIGxheWVyTmFtZSA9ICdCYXNlJykge1xuICAgICAgICBpZiAoIXRoaXMuX3N0YXRlR3JhcGgpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZFN0YXRlR3JhcGgobmV3IEFuaW1TdGF0ZUdyYXBoKHtcbiAgICAgICAgICAgICAgICAnbGF5ZXJzJzogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6IGxheWVyTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdGF0ZXMnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzcGVlZCc6IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiBub2RlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NwZWVkJzogc3BlZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsb29wJzogbG9vcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2RlZmF1bHRTdGF0ZSc6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RyYW5zaXRpb25zJzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zyb20nOiAnU1RBUlQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndG8nOiBub2RlTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgJ3BhcmFtZXRlcnMnOiB7fVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5maW5kQW5pbWF0aW9uTGF5ZXIobGF5ZXJOYW1lKTtcbiAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICBsYXllci5hc3NpZ25BbmltYXRpb24obm9kZU5hbWUsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hZGRMYXllcihsYXllck5hbWUpPy5hc3NpZ25BbmltYXRpb24obm9kZU5hbWUsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzb2NpYXRlcyBhbiBhbmltYXRpb24gd2l0aCBhIHN0YXRlIG9yIGJsZW5kIHRyZWUgbm9kZSBpbiB0aGUgbG9hZGVkIHN0YXRlIGdyYXBoLiBJZiBhbGxcbiAgICAgKiBzdGF0ZXMgYXJlIGxpbmtlZCBhbmQgdGhlIHtAbGluayBBbmltQ29tcG9uZW50I2FjdGl2YXRlfSB2YWx1ZSB3YXMgc2V0IHRvIHRydWUgdGhlbiB0aGVcbiAgICAgKiBjb21wb25lbnQgd2lsbCBiZWdpbiBwbGF5aW5nLiBJZiBubyBzdGF0ZSBncmFwaCBpcyBsb2FkZWQsIGEgZGVmYXVsdCBzdGF0ZSBncmFwaCB3aWxsIGJlXG4gICAgICogY3JlYXRlZCB3aXRoIGEgc2luZ2xlIHN0YXRlIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBub2RlUGF0aCBwYXJhbWV0ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbm9kZVBhdGggLSBFaXRoZXIgdGhlIHN0YXRlIG5hbWUgb3IgdGhlIHBhdGggdG8gYSBibGVuZCB0cmVlIG5vZGUgdGhhdCB0aGlzXG4gICAgICogYW5pbWF0aW9uIHNob3VsZCBiZSBhc3NvY2lhdGVkIHdpdGguIEVhY2ggc2VjdGlvbiBvZiBhIGJsZW5kIHRyZWUgcGF0aCBpcyBzcGxpdCB1c2luZyBhXG4gICAgICogcGVyaW9kIChgLmApIHRoZXJlZm9yZSBzdGF0ZSBuYW1lcyBzaG91bGQgbm90IGluY2x1ZGUgdGhpcyBjaGFyYWN0ZXIgKGUuZyBcIk15U3RhdGVOYW1lXCIgb3JcbiAgICAgKiBcIk15U3RhdGVOYW1lLkJsZW5kVHJlZU5vZGVcIikuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGFuaW1UcmFjayAtIFRoZSBhbmltYXRpb24gdHJhY2sgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoaXMgc3RhdGUgYW5kXG4gICAgICogcGxheWVkIHdoZW5ldmVyIHRoaXMgc3RhdGUgaXMgYWN0aXZlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbGF5ZXJOYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltIGNvbXBvbmVudCBsYXllciB0byB1cGRhdGUuIElmIG9taXR0ZWQgdGhlXG4gICAgICogZGVmYXVsdCBsYXllciBpcyB1c2VkLiBJZiBubyBzdGF0ZSBncmFwaCBoYXMgYmVlbiBwcmV2aW91c2x5IGxvYWRlZCB0aGlzIHBhcmFtZXRlciBpc1xuICAgICAqIGlnbm9yZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzcGVlZF0gLSBVcGRhdGUgdGhlIHNwZWVkIG9mIHRoZSBzdGF0ZSB5b3UgYXJlIGFzc2lnbmluZyBhbiBhbmltYXRpb24gdG8uXG4gICAgICogRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtsb29wXSAtIFVwZGF0ZSB0aGUgbG9vcCBwcm9wZXJ0eSBvZiB0aGUgc3RhdGUgeW91IGFyZSBhc3NpZ25pbmcgYW5cbiAgICAgKiBhbmltYXRpb24gdG8uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgYXNzaWduQW5pbWF0aW9uKG5vZGVQYXRoLCBhbmltVHJhY2ssIGxheWVyTmFtZSwgc3BlZWQgPSAxLCBsb29wID0gdHJ1ZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3N0YXRlR3JhcGggJiYgbm9kZVBhdGguaW5kZXhPZignLicpID09PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaChuZXcgQW5pbVN0YXRlR3JhcGgoe1xuICAgICAgICAgICAgICAgICdsYXllcnMnOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogJ0Jhc2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0YXRlcyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NwZWVkJzogMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6IG5vZGVQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3BlZWQnOiBzcGVlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xvb3AnOiBsb29wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZGVmYXVsdFN0YXRlJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAndHJhbnNpdGlvbnMnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZnJvbSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0byc6IG5vZGVQYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAncGFyYW1ldGVycyc6IHt9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB0aGlzLmJhc2VMYXllci5hc3NpZ25BbmltYXRpb24obm9kZVBhdGgsIGFuaW1UcmFjayk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllck5hbWUgPyB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllck5hbWUpIDogdGhpcy5iYXNlTGF5ZXI7XG4gICAgICAgIGlmICghbGF5ZXIpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdhc3NpZ25BbmltYXRpb246IFRyeWluZyB0byBhc3NpZ24gYW4gYW5pbSB0cmFjayB0byBhIGxheWVyIHRoYXQgZG9lc25cXCd0IGV4aXN0Jyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbGF5ZXIuYXNzaWduQW5pbWF0aW9uKG5vZGVQYXRoLCBhbmltVHJhY2ssIHNwZWVkLCBsb29wKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFuaW1hdGlvbnMgZnJvbSBhIG5vZGUgaW4gdGhlIGxvYWRlZCBzdGF0ZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBub2RlTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBub2RlIHRoYXQgc2hvdWxkIGhhdmUgaXRzIGFuaW1hdGlvbiB0cmFja3MgcmVtb3ZlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2xheWVyTmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgYW5pbSBjb21wb25lbnQgbGF5ZXIgdG8gdXBkYXRlLiBJZiBvbWl0dGVkIHRoZVxuICAgICAqIGRlZmF1bHQgbGF5ZXIgaXMgdXNlZC5cbiAgICAgKi9cbiAgICByZW1vdmVOb2RlQW5pbWF0aW9ucyhub2RlTmFtZSwgbGF5ZXJOYW1lKSB7XG4gICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJOYW1lID8gdGhpcy5maW5kQW5pbWF0aW9uTGF5ZXIobGF5ZXJOYW1lKSA6IHRoaXMuYmFzZUxheWVyO1xuICAgICAgICBpZiAoIWxheWVyKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcigncmVtb3ZlU3RhdGVBbmltYXRpb25zOiBUcnlpbmcgdG8gcmVtb3ZlIGFuaW1hdGlvbiB0cmFja3MgZnJvbSBhIHN0YXRlIGJlZm9yZSB0aGUgc3RhdGUgZ3JhcGggaGFzIGJlZW4gbG9hZGVkLiBIYXZlIHlvdSBjYWxsZWQgbG9hZFN0YXRlR3JhcGg/Jyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbGF5ZXIucmVtb3ZlTm9kZUFuaW1hdGlvbnMobm9kZU5hbWUpO1xuICAgIH1cblxuICAgIGdldFBhcmFtZXRlclZhbHVlKG5hbWUsIHR5cGUpIHtcbiAgICAgICAgY29uc3QgcGFyYW0gPSB0aGlzLl9wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICBpZiAocGFyYW0gJiYgcGFyYW0udHlwZSA9PT0gdHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHBhcmFtLnZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIERlYnVnLmxvZyhgQ2Fubm90IGdldCBwYXJhbWV0ZXIgdmFsdWUuIE5vIHBhcmFtZXRlciBmb3VuZCBpbiBhbmltIGNvbnRyb2xsZXIgbmFtZWQgXCIke25hbWV9XCIgb2YgdHlwZSBcIiR7dHlwZX1cImApO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHNldFBhcmFtZXRlclZhbHVlKG5hbWUsIHR5cGUsIHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtID0gdGhpcy5fcGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgaWYgKHBhcmFtICYmIHBhcmFtLnR5cGUgPT09IHR5cGUpIHtcbiAgICAgICAgICAgIHBhcmFtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgRGVidWcubG9nKGBDYW5ub3Qgc2V0IHBhcmFtZXRlciB2YWx1ZS4gTm8gcGFyYW1ldGVyIGZvdW5kIGluIGFuaW0gY29udHJvbGxlciBuYW1lZCBcIiR7bmFtZX1cIiBvZiB0eXBlIFwiJHt0eXBlfVwiYCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGZsb2F0IHBhcmFtZXRlciB2YWx1ZSBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZmxvYXQgdG8gcmV0dXJuIHRoZSB2YWx1ZSBvZi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBIGZsb2F0LlxuICAgICAqL1xuICAgIGdldEZsb2F0KG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfRkxPQVQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGEgZmxvYXQgcGFyYW1ldGVyIHRoYXQgd2FzIGRlZmluZWQgaW4gdGhlIGFuaW1hdGlvbiBjb21wb25lbnRzIHN0YXRlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgbmV3IGZsb2F0IHZhbHVlIHRvIHNldCB0aGlzIHBhcmFtZXRlciB0by5cbiAgICAgKi9cbiAgICBzZXRGbG9hdChuYW1lLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0ZMT0FULCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpbnRlZ2VyIHBhcmFtZXRlciB2YWx1ZSBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgaW50ZWdlciB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEFuIGludGVnZXIuXG4gICAgICovXG4gICAgZ2V0SW50ZWdlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX0lOVEVHRVIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGFuIGludGVnZXIgcGFyYW1ldGVyIHRoYXQgd2FzIGRlZmluZWQgaW4gdGhlIGFuaW1hdGlvbiBjb21wb25lbnRzIHN0YXRlXG4gICAgICogZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBuZXcgaW50ZWdlciB2YWx1ZSB0byBzZXQgdGhpcyBwYXJhbWV0ZXIgdG8uXG4gICAgICovXG4gICAgc2V0SW50ZWdlcihuYW1lLCB2YWx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiB2YWx1ZSAlIDEgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfSU5URUdFUiwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0F0dGVtcHRpbmcgdG8gYXNzaWduIG5vbiBpbnRlZ2VyIHZhbHVlIHRvIGludGVnZXIgcGFyYW1ldGVyJywgbmFtZSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGJvb2xlYW4gcGFyYW1ldGVyIHZhbHVlIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBib29sZWFuIHRvIHJldHVybiB0aGUgdmFsdWUgb2YuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IEEgYm9vbGVhbi5cbiAgICAgKi9cbiAgICBnZXRCb29sZWFuKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfQk9PTEVBTik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYSBib29sZWFuIHBhcmFtZXRlciB0aGF0IHdhcyBkZWZpbmVkIGluIHRoZSBhbmltYXRpb24gY29tcG9uZW50cyBzdGF0ZVxuICAgICAqIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHZhbHVlIC0gVGhlIG5ldyBib29sZWFuIHZhbHVlIHRvIHNldCB0aGlzIHBhcmFtZXRlciB0by5cbiAgICAgKi9cbiAgICBzZXRCb29sZWFuKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfQk9PTEVBTiwgISF2YWx1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHRyaWdnZXIgcGFyYW1ldGVyIHZhbHVlIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB0cmlnZ2VyIHRvIHJldHVybiB0aGUgdmFsdWUgb2YuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IEEgYm9vbGVhbi5cbiAgICAgKi9cbiAgICBnZXRUcmlnZ2VyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYSB0cmlnZ2VyIHBhcmFtZXRlciB0aGF0IHdhcyBkZWZpbmVkIGluIHRoZSBhbmltYXRpb24gY29tcG9uZW50cyBzdGF0ZVxuICAgICAqIGdyYXBoIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3NpbmdsZUZyYW1lXSAtIElmIHRydWUsIHRoaXMgdHJpZ2dlciB3aWxsIGJlIHNldCBiYWNrIHRvIGZhbHNlIGF0IHRoZSBlbmRcbiAgICAgKiBvZiB0aGUgYW5pbWF0aW9uIHVwZGF0ZS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICovXG4gICAgc2V0VHJpZ2dlcihuYW1lLCBzaW5nbGVGcmFtZSA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgdHJ1ZSk7XG4gICAgICAgIGlmIChzaW5nbGVGcmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2Vycy5hZGQobmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNldHMgdGhlIHZhbHVlIG9mIGEgdHJpZ2dlciBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaCB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICovXG4gICAgcmVzZXRUcmlnZ2VyKG5hbWUpIHtcbiAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9UUklHR0VSLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIGlmIChOdW1iZXIuaXNGaW5pdGUodGhpcy5fc3RhdGVHcmFwaEFzc2V0KSkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGVHcmFwaEFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fc3RhdGVHcmFwaEFzc2V0KTtcbiAgICAgICAgICAgIHN0YXRlR3JhcGhBc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzW2ldLnVwZGF0ZShkdCAqIHRoaXMuc3BlZWQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuZm9yRWFjaCgodHJpZ2dlcikgPT4ge1xuICAgICAgICAgICAgdGhpcy5wYXJhbWV0ZXJzW3RyaWdnZXJdLnZhbHVlID0gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKG9sZEFuaW0sIGR1cGxpY2F0ZWRJZHNNYXApIHtcbiAgICAgICAgaWYgKG9sZEFuaW0ucm9vdEJvbmUgJiYgZHVwbGljYXRlZElkc01hcFtvbGRBbmltLnJvb3RCb25lLmdldEd1aWQoKV0pIHtcbiAgICAgICAgICAgIHRoaXMucm9vdEJvbmUgPSBkdXBsaWNhdGVkSWRzTWFwW29sZEFuaW0ucm9vdEJvbmUuZ2V0R3VpZCgpXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmViaW5kKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1Db21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJBbmltQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfc3RhdGVHcmFwaEFzc2V0IiwiX2FuaW1hdGlvbkFzc2V0cyIsIl9zcGVlZCIsIl9hY3RpdmF0ZSIsIl9wbGF5aW5nIiwiX3Jvb3RCb25lIiwiX3N0YXRlR3JhcGgiLCJfbGF5ZXJzIiwiX2xheWVySW5kaWNlcyIsIl9wYXJhbWV0ZXJzIiwiX3RhcmdldHMiLCJfY29uc3VtZWRUcmlnZ2VycyIsIlNldCIsIl9ub3JtYWxpemVXZWlnaHRzIiwic3RhdGVHcmFwaEFzc2V0IiwidmFsdWUiLCJyZW1vdmVTdGF0ZUdyYXBoIiwiYXBwIiwiYXNzZXRzIiwiZ2V0Iiwib2ZmIiwiX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQiLCJfaWQiLCJfYXNzZXQiLCJBc3NldCIsImlkIiwiYWRkIiwicmVzb3VyY2UiLCJsb2FkU3RhdGVHcmFwaCIsIm9uIiwib25jZSIsImFzc2V0IiwibG9hZCIsIm5vcm1hbGl6ZVdlaWdodHMiLCJ1bmJpbmQiLCJhbmltYXRpb25Bc3NldHMiLCJsb2FkQW5pbWF0aW9uQXNzZXRzIiwic3BlZWQiLCJhY3RpdmF0ZSIsInBsYXlpbmciLCJyb290Qm9uZSIsInJvb3QiLCJmaW5kQnlHdWlkIiwiRGVidWciLCJhc3NlcnQiLCJFbnRpdHkiLCJyZWJpbmQiLCJzdGF0ZUdyYXBoIiwibGF5ZXJzIiwibGF5ZXJJbmRpY2VzIiwicGFyYW1ldGVycyIsInRhcmdldHMiLCJwbGF5YWJsZSIsImkiLCJsZW5ndGgiLCJiYXNlTGF5ZXIiLCJwcmV2QW5pbWF0aW9uQXNzZXRzIiwicHJldk1hc2tzIiwibWFwIiwibGF5ZXIiLCJtYXNrIiwiQW5pbVN0YXRlR3JhcGgiLCJfZGF0YSIsImZvckVhY2giLCJkaXJ0aWZ5VGFyZ2V0cyIsIk9iamVjdCIsInZhbHVlcyIsImRpcnR5IiwiX2FkZExheWVyIiwibmFtZSIsInN0YXRlcyIsInRyYW5zaXRpb25zIiwid2VpZ2h0IiwiYmxlbmRUeXBlIiwiZ3JhcGgiLCJsYXllckluZGV4IiwiYW5pbUJpbmRlciIsIkFuaW1Db21wb25lbnRCaW5kZXIiLCJhbmltRXZhbHVhdG9yIiwiQW5pbUV2YWx1YXRvciIsImNvbnRyb2xsZXIiLCJBbmltQ29udHJvbGxlciIsInB1c2giLCJBbmltQ29tcG9uZW50TGF5ZXIiLCJhZGRMYXllciIsImZpbmRBbmltYXRpb25MYXllciIsInBhcmFtS2V5cyIsImtleXMiLCJwYXJhbUtleSIsInR5cGUiLCJjb250YWluc0JsZW5kVHJlZSIsImJpbmQiLCJfZXh0ZW5kcyIsInNvbWUiLCJzdGF0ZSIsImJsZW5kVHJlZSIsInNldHVwQW5pbWF0aW9uQXNzZXRzIiwibGF5ZXJOYW1lIiwiaiIsInN0YXRlTmFtZSIsIkFOSU1fQ09OVFJPTF9TVEFURVMiLCJpbmRleE9mIiwic3RhdGVLZXkiLCJhbmltYXRpb25Bc3NldCIsImFzc2lnbkFuaW1hdGlvbiIsIkFuaW1UcmFjayIsIkVNUFRZIiwiYXNzZXRJZCIsIm9uQW5pbWF0aW9uQXNzZXRMb2FkZWQiLCJyZXNldCIsImFzc2lnbiIsImxheWVyUGxheWluZyIsInRhcmdldEtleSIsImFkZEFuaW1hdGlvblN0YXRlIiwibm9kZU5hbWUiLCJhbmltVHJhY2siLCJsb29wIiwiX3RoaXMkYWRkTGF5ZXIiLCJub2RlUGF0aCIsImVycm9yIiwicmVtb3ZlTm9kZUFuaW1hdGlvbnMiLCJnZXRQYXJhbWV0ZXJWYWx1ZSIsInBhcmFtIiwibG9nIiwidW5kZWZpbmVkIiwic2V0UGFyYW1ldGVyVmFsdWUiLCJnZXRGbG9hdCIsIkFOSU1fUEFSQU1FVEVSX0ZMT0FUIiwic2V0RmxvYXQiLCJnZXRJbnRlZ2VyIiwiQU5JTV9QQVJBTUVURVJfSU5URUdFUiIsInNldEludGVnZXIiLCJnZXRCb29sZWFuIiwiQU5JTV9QQVJBTUVURVJfQk9PTEVBTiIsInNldEJvb2xlYW4iLCJnZXRUcmlnZ2VyIiwiQU5JTV9QQVJBTUVURVJfVFJJR0dFUiIsInNldFRyaWdnZXIiLCJzaW5nbGVGcmFtZSIsInJlc2V0VHJpZ2dlciIsIm9uQmVmb3JlUmVtb3ZlIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJ1cGRhdGUiLCJkdCIsInRyaWdnZXIiLCJjbGVhciIsInJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyIsIm9sZEFuaW0iLCJkdXBsaWNhdGVkSWRzTWFwIiwiZ2V0R3VpZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxhQUFhLFNBQVNDLFNBQVMsQ0FBQztBQUNsQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUVyQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsTUFBTSxHQUFHLEdBQUcsQ0FBQTtJQUNqQixJQUFJLENBQUNDLFNBQVMsR0FBRyxJQUFJLENBQUE7SUFDckIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsS0FBSyxDQUFBO0lBQ3JCLElBQUksQ0FBQ0MsU0FBUyxHQUFHLElBQUksQ0FBQTtJQUNyQixJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ2pCLElBQUEsSUFBSSxDQUFDQyxhQUFhLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLElBQUEsSUFBSSxDQUFDQyxXQUFXLEdBQUcsRUFBRSxDQUFBO0FBQ3JCO0FBQ0EsSUFBQSxJQUFJLENB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
