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
    /**
     * Returns the parameter object for the specified parameter name. This function is anonymous so that it can be passed to the AnimController
     * while still being called in the scope of the AnimComponent.
     *
     * @param {string} name - The name of the parameter to return the value of.
     * @returns {object} The parameter object.
     * @private
     */
    this.findParameter = name => {
      return this._parameters[name];
    };
    /**
     * Sets a trigger parameter as having been used by a transition. This function is anonymous so that it can be passed to the AnimController
     * while still being called in the scope of the AnimComponent.
     *
     * @param {string} name - The name of the trigger to set as consumed.
     * @private
     */
    this.consumeTrigger = name => {
      this._consumedTriggers.add(name);
    };
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
    const controller = new AnimController(animEvaluator, states, transitions, this._activate, this, this.findParameter, this.consumeTrigger);
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
  _assignParameters(stateGraph) {
    this._parameters = {};
    const paramKeys = Object.keys(stateGraph.parameters);
    for (let i = 0; i < paramKeys.length; i++) {
      const paramKey = paramKeys[i];
      this._parameters[paramKey] = {
        type: stateGraph.parameters[paramKey].type,
        value: stateGraph.parameters[paramKey].value
      };
    }
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
    this._assignParameters(stateGraph);
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
    this._assignParameters(this._stateGraph);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvYW5pbS1jb250cm9sbGVyLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHtcbiAgICBBTklNX1BBUkFNRVRFUl9CT09MRUFOLCBBTklNX1BBUkFNRVRFUl9GTE9BVCwgQU5JTV9QQVJBTUVURVJfSU5URUdFUiwgQU5JTV9QQVJBTUVURVJfVFJJR0dFUiwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEFuaW1Db21wb25lbnRCaW5kZXIgfSBmcm9tICcuL2NvbXBvbmVudC1iaW5kZXIuanMnO1xuaW1wb3J0IHsgQW5pbUNvbXBvbmVudExheWVyIH0gZnJvbSAnLi9jb21wb25lbnQtbGF5ZXIuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlR3JhcGggfSBmcm9tICcuLi8uLi9hbmltL3N0YXRlLWdyYXBoL2FuaW0tc3RhdGUtZ3JhcGguanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcbmltcG9ydCB7IEFuaW1UcmFjayB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tdHJhY2suanMnO1xuXG4vKipcbiAqIFRoZSBBbmltIENvbXBvbmVudCBhbGxvd3MgYW4gRW50aXR5IHRvIHBsYXliYWNrIGFuaW1hdGlvbnMgb24gbW9kZWxzIGFuZCBlbnRpdHkgcHJvcGVydGllcy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIEFuaW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQW5pbUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIHtAbGluayBDb21wb25lbnRTeXN0ZW19IHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGhBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbkFzc2V0cyA9IHt9O1xuICAgICAgICB0aGlzLl9zcGVlZCA9IDEuMDtcbiAgICAgICAgdGhpcy5fYWN0aXZhdGUgPSB0cnVlO1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3Jvb3RCb25lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtdO1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHt9O1xuICAgICAgICAvLyBhIGNvbGxlY3Rpb24gb2YgYW5pbWF0ZWQgcHJvcGVydHkgdGFyZ2V0c1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX25vcm1hbGl6ZVdlaWdodHMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBzZXQgc3RhdGVHcmFwaEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVTdGF0ZUdyYXBoKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZXZlbnQgZnJvbSBwcmV2aW91cyBhc3NldFxuICAgICAgICBpZiAodGhpcy5fc3RhdGVHcmFwaEFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0ZUdyYXBoQXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zdGF0ZUdyYXBoQXNzZXQpO1xuICAgICAgICAgICAgc3RhdGVHcmFwaEFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgX2lkO1xuICAgICAgICBsZXQgX2Fzc2V0O1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgIF9hc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KF9pZCk7XG4gICAgICAgICAgICBpZiAoIV9hc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuYWRkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBfYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChfaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX2lkID0gdmFsdWU7XG4gICAgICAgICAgICBfYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChfaWQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghX2Fzc2V0IHx8IHRoaXMuX3N0YXRlR3JhcGhBc3NldCA9PT0gX2lkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX2Fzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gX2Fzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaCh0aGlzLl9zdGF0ZUdyYXBoKTtcbiAgICAgICAgICAgIF9hc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudCwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfYXNzZXQub25jZSgnbG9hZCcsIChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKHRoaXMuX3N0YXRlR3JhcGgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKF9hc3NldCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaEFzc2V0ID0gX2lkO1xuICAgIH1cblxuICAgIGdldCBzdGF0ZUdyYXBoQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZUdyYXBoQXNzZXQ7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBhbmltYXRpb24gY29tcG9uZW50IHdpbGwgbm9ybWFsaXplIHRoZSB3ZWlnaHRzIG9mIGl0cyBsYXllcnMgYnkgdGhlaXIgc3VtIHRvdGFsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IG5vcm1hbGl6ZVdlaWdodHModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbm9ybWFsaXplV2VpZ2h0cyA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVuYmluZCgpO1xuICAgIH1cblxuICAgIGdldCBub3JtYWxpemVXZWlnaHRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbm9ybWFsaXplV2VpZ2h0cztcbiAgICB9XG5cbiAgICBzZXQgYW5pbWF0aW9uQXNzZXRzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbkFzc2V0cyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICB9XG5cbiAgICBnZXQgYW5pbWF0aW9uQXNzZXRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbWF0aW9uQXNzZXRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwZWVkIG11bHRpcGxpZXIgZm9yIGFuaW1hdGlvbiBwbGF5IGJhY2sgc3BlZWQuIDEuMCBpcyBwbGF5YmFjayBhdCBub3JtYWwgc3BlZWQsIDAuMCBwYXVzZXNcbiAgICAgKiB0aGUgYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3BlZWQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3BlZWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc3BlZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcGVlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBmaXJzdCBhbmltYXRpb24gd2lsbCBiZWdpbiBwbGF5aW5nIHdoZW4gdGhlIHNjZW5lIGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBhY3RpdmF0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hY3RpdmF0ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhY3RpdmF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2YXRlO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogUGxheXMgb3IgcGF1c2VzIGFsbCBhbmltYXRpb25zIGluIHRoZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgcGxheWluZyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHBsYXlpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wbGF5aW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBlbnRpdHkgdGhhdCB0aGlzIGFuaW0gY29tcG9uZW50IHNob3VsZCB1c2UgYXMgdGhlIHJvb3Qgb2YgdGhlIGFuaW1hdGlvbiBoaWVyYXJjaHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RW50aXR5fVxuICAgICAqL1xuICAgIHNldCByb290Qm9uZSh2YWx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5lbnRpdHkucm9vdC5maW5kQnlHdWlkKHZhbHVlKTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChlbnRpdHksIGByb290Qm9uZSBlbnRpdHkgZm9yIHN1cHBsaWVkIGd1aWQ6JHt2YWx1ZX0gY2Fubm90IGJlIGZvdW5kIGluIHRoZSBzY2VuZWApO1xuICAgICAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBlbnRpdHk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBFbnRpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3Jvb3RCb25lID0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yb290Qm9uZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWJpbmQoKTtcbiAgICB9XG5cbiAgICBnZXQgcm9vdEJvbmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb290Qm9uZTtcbiAgICB9XG5cbiAgICBzZXQgc3RhdGVHcmFwaCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXRlR3JhcGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZUdyYXBoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGFuaW1hdGlvbiBsYXllcnMgYXZhaWxhYmxlIGluIHRoaXMgYW5pbSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QW5pbUNvbXBvbmVudExheWVyW119XG4gICAgICovXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICBzZXQgbGF5ZXJJbmRpY2VzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xheWVySW5kaWNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsYXllckluZGljZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllckluZGljZXM7XG4gICAgfVxuXG4gICAgc2V0IHBhcmFtZXRlcnModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyYW1ldGVycztcbiAgICB9XG5cbiAgICBzZXQgdGFyZ2V0cyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl90YXJnZXRzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHRhcmdldHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90YXJnZXRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgd2hldGhlciBhbGwgY29tcG9uZW50IGxheWVycyBhcmUgY3VycmVudGx5IHBsYXlhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHBsYXlhYmxlKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9sYXllcnNbaV0ucGxheWFibGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgYmFzZSBsYXllciBvZiB0aGUgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QW5pbUNvbXBvbmVudExheWVyfG51bGx9XG4gICAgICovXG4gICAgZ2V0IGJhc2VMYXllcigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xheWVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzWzBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIF9vblN0YXRlR3JhcGhBc3NldENoYW5nZUV2ZW50KGFzc2V0KSB7XG4gICAgICAgIC8vIGJvdGggYW5pbWF0aW9uQXNzZXRzIGFuZCBsYXllciBtYXNrcyBzaG91bGQgYmUgbWFpbnRhaW5lZCB3aGVuIHN3aXRjaGluZyBBbmltU3RhdGVHcmFwaCBhc3NldHNcbiAgICAgICAgY29uc3QgcHJldkFuaW1hdGlvbkFzc2V0cyA9IHRoaXMuYW5pbWF0aW9uQXNzZXRzO1xuICAgICAgICBjb25zdCBwcmV2TWFza3MgPSB0aGlzLmxheWVycy5tYXAobGF5ZXIgPT4gbGF5ZXIubWFzayk7XG4gICAgICAgIC8vIGNsZWFyIHRoZSBwcmV2aW91cyBzdGF0ZSBncmFwaFxuICAgICAgICB0aGlzLnJlbW92ZVN0YXRlR3JhcGgoKTtcbiAgICAgICAgLy8gbG9hZCB0aGUgbmV3IHN0YXRlIGdyYXBoXG4gICAgICAgIHRoaXMuX3N0YXRlR3JhcGggPSBuZXcgQW5pbVN0YXRlR3JhcGgoYXNzZXQuX2RhdGEpO1xuICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKHRoaXMuX3N0YXRlR3JhcGgpO1xuICAgICAgICAvLyBhc3NpZ24gdGhlIHByZXZpb3VzIGFuaW1hdGlvbiBhc3NldHNcbiAgICAgICAgdGhpcy5hbmltYXRpb25Bc3NldHMgPSBwcmV2QW5pbWF0aW9uQXNzZXRzO1xuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICAgICAgLy8gYXNzaWduIHRoZSBwcmV2aW91cyBsYXllciBtYXNrcyB0aGVuIHJlYmluZCBhbGwgYW5pbSB0YXJnZXRzXG4gICAgICAgIHRoaXMubGF5ZXJzLmZvckVhY2goKGxheWVyLCBpKSA9PiB7XG4gICAgICAgICAgICBsYXllci5tYXNrID0gcHJldk1hc2tzW2ldO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZWJpbmQoKTtcbiAgICB9XG5cbiAgICBkaXJ0aWZ5VGFyZ2V0cygpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IE9iamVjdC52YWx1ZXModGhpcy5fdGFyZ2V0cyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGFyZ2V0c1tpXS5kaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYWRkTGF5ZXIoeyBuYW1lLCBzdGF0ZXMsIHRyYW5zaXRpb25zLCB3ZWlnaHQsIG1hc2ssIGJsZW5kVHlwZSB9KSB7XG4gICAgICAgIGxldCBncmFwaDtcbiAgICAgICAgaWYgKHRoaXMucm9vdEJvbmUpIHtcbiAgICAgICAgICAgIGdyYXBoID0gdGhpcy5yb290Qm9uZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdyYXBoID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHRoaXMuX2xheWVycy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGFuaW1CaW5kZXIgPSBuZXcgQW5pbUNvbXBvbmVudEJpbmRlcih0aGlzLCBncmFwaCwgbmFtZSwgbWFzaywgbGF5ZXJJbmRleCk7XG4gICAgICAgIGNvbnN0IGFuaW1FdmFsdWF0b3IgPSBuZXcgQW5pbUV2YWx1YXRvcihhbmltQmluZGVyKTtcbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBbmltQ29udHJvbGxlcihcbiAgICAgICAgICAgIGFuaW1FdmFsdWF0b3IsXG4gICAgICAgICAgICBzdGF0ZXMsXG4gICAgICAgICAgICB0cmFuc2l0aW9ucyxcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlLFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHRoaXMuZmluZFBhcmFtZXRlcixcbiAgICAgICAgICAgIHRoaXMuY29uc3VtZVRyaWdnZXJcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzLnB1c2gobmV3IEFuaW1Db21wb25lbnRMYXllcihuYW1lLCBjb250cm9sbGVyLCB0aGlzLCB3ZWlnaHQsIGJsZW5kVHlwZSkpO1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXNbbmFtZV0gPSBsYXllckluZGV4O1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzW2xheWVySW5kZXhdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBuZXcgYW5pbSBjb21wb25lbnQgbGF5ZXIgdG8gdGhlIGFuaW0gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgbGF5ZXIgdG8gY3JlYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2VpZ2h0XSAtIFRoZSBibGVuZGluZyB3ZWlnaHQgb2YgdGhlIGxheWVyLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IFttYXNrXSAtIEEgbGlzdCBvZiBwYXRocyB0byBib25lcyBpbiB0aGUgbW9kZWwgd2hpY2ggc2hvdWxkIGJlIGFuaW1hdGVkIGluXG4gICAgICogdGhpcyBsYXllci4gSWYgb21pdHRlZCB0aGUgZnVsbCBtb2RlbCBpcyB1c2VkLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbYmxlbmRUeXBlXSAtIERlZmluZXMgaG93IHByb3BlcnRpZXMgYW5pbWF0ZWQgYnkgdGhpcyBsYXllciBibGVuZCB3aXRoXG4gICAgICogYW5pbWF0aW9ucyBvZiB0aG9zZSBwcm9wZXJ0aWVzIGluIHByZXZpb3VzIGxheWVycy4gRGVmYXVsdHMgdG8gcGMuQU5JTV9MQVlFUl9PVkVSV1JJVEUuXG4gICAgICogQHJldHVybnMge0FuaW1Db21wb25lbnRMYXllcn0gVGhlIGNyZWF0ZWQgYW5pbSBjb21wb25lbnQgbGF5ZXIuXG4gICAgICovXG4gICAgYWRkTGF5ZXIobmFtZSwgd2VpZ2h0LCBtYXNrLCBibGVuZFR5cGUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmZpbmRBbmltYXRpb25MYXllcihuYW1lKTtcbiAgICAgICAgaWYgKGxheWVyKSByZXR1cm4gbGF5ZXI7XG4gICAgICAgIGNvbnN0IHN0YXRlcyA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnbmFtZSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgJ3NwZWVkJzogMVxuICAgICAgICAgICAgfVxuICAgICAgICBdO1xuICAgICAgICBjb25zdCB0cmFuc2l0aW9ucyA9IFtdO1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkTGF5ZXIoeyBuYW1lLCBzdGF0ZXMsIHRyYW5zaXRpb25zLCB3ZWlnaHQsIG1hc2ssIGJsZW5kVHlwZSB9KTtcbiAgICB9XG5cbiAgICBfYXNzaWduUGFyYW1ldGVycyhzdGF0ZUdyYXBoKSB7XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSB7fTtcbiAgICAgICAgY29uc3QgcGFyYW1LZXlzID0gT2JqZWN0LmtleXMoc3RhdGVHcmFwaC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbUtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtS2V5ID0gcGFyYW1LZXlzW2ldO1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyc1twYXJhbUtleV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogc3RhdGVHcmFwaC5wYXJhbWV0ZXJzW3BhcmFtS2V5XS50eXBlLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBzdGF0ZUdyYXBoLnBhcmFtZXRlcnNbcGFyYW1LZXldLnZhbHVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgY29tcG9uZW50IGFuaW1hdGlvbiBjb250cm9sbGVycyB1c2luZyB0aGUgcHJvdmlkZWQgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc3RhdGVHcmFwaCAtIFRoZSBzdGF0ZSBncmFwaCBhc3NldCB0byBsb2FkIGludG8gdGhlIGNvbXBvbmVudC4gQ29udGFpbnMgdGhlXG4gICAgICogc3RhdGVzLCB0cmFuc2l0aW9ucyBhbmQgcGFyYW1ldGVycyB1c2VkIHRvIGRlZmluZSBhIGNvbXBsZXRlIGFuaW1hdGlvbiBjb250cm9sbGVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LmFuaW0ubG9hZFN0YXRlR3JhcGgoe1xuICAgICAqICAgICBcImxheWVyc1wiOiBbXG4gICAgICogICAgICAgICB7XG4gICAgICogICAgICAgICAgICAgXCJuYW1lXCI6IGxheWVyTmFtZSxcbiAgICAgKiAgICAgICAgICAgICBcInN0YXRlc1wiOiBbXG4gICAgICogICAgICAgICAgICAgICAgIHtcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIlNUQVJUXCIsXG4gICAgICogICAgICAgICAgICAgICAgICAgICBcInNwZWVkXCI6IDFcbiAgICAgKiAgICAgICAgICAgICAgICAgfSxcbiAgICAgKiAgICAgICAgICAgICAgICAge1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiSW5pdGlhbCBTdGF0ZVwiLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJzcGVlZFwiOiBzcGVlZCxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwibG9vcFwiOiBsb29wLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJkZWZhdWx0U3RhdGVcIjogdHJ1ZVxuICAgICAqICAgICAgICAgICAgICAgICB9XG4gICAgICogICAgICAgICAgICAgXSxcbiAgICAgKiAgICAgICAgICAgICBcInRyYW5zaXRpb25zXCI6IFtcbiAgICAgKiAgICAgICAgICAgICAgICAge1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgXCJmcm9tXCI6IFwiU1RBUlRcIixcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogXCJJbml0aWFsIFN0YXRlXCJcbiAgICAgKiAgICAgICAgICAgICAgICAgfVxuICAgICAqICAgICAgICAgICAgIF1cbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgXSxcbiAgICAgKiAgICAgXCJwYXJhbWV0ZXJzXCI6IHt9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZFN0YXRlR3JhcGgoc3RhdGVHcmFwaCkge1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gc3RhdGVHcmFwaDtcbiAgICAgICAgdGhpcy5fYXNzaWduUGFyYW1ldGVycyhzdGF0ZUdyYXBoKTtcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW107XG5cbiAgICAgICAgbGV0IGNvbnRhaW5zQmxlbmRUcmVlID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVHcmFwaC5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc3RhdGVHcmFwaC5sYXllcnNbaV07XG4gICAgICAgICAgICB0aGlzLl9hZGRMYXllci5iaW5kKHRoaXMpKHsgLi4ubGF5ZXIgfSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIuc3RhdGVzLnNvbWUoc3RhdGUgPT4gc3RhdGUuYmxlbmRUcmVlKSkge1xuICAgICAgICAgICAgICAgIGNvbnRhaW5zQmxlbmRUcmVlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBibGVuZCB0cmVlcyBkbyBub3Qgc3VwcG9ydCB0aGUgYXV0b21hdGljIGFzc2lnbm1lbnQgb2YgYW5pbWF0aW9uIGFzc2V0c1xuICAgICAgICBpZiAoIWNvbnRhaW5zQmxlbmRUcmVlKSB7XG4gICAgICAgICAgICB0aGlzLnNldHVwQW5pbWF0aW9uQXNzZXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cEFuaW1hdGlvbkFzc2V0cygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5fbGF5ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJOYW1lID0gbGF5ZXIubmFtZTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuc3RhdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVOYW1lID0gbGF5ZXIuc3RhdGVzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yoc3RhdGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVLZXkgPSBsYXllck5hbWUgKyAnOicgKyBzdGF0ZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fYW5pbWF0aW9uQXNzZXRzW3N0YXRlS2V5XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzW3N0YXRlS2V5XSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldDogbnVsbFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoKTtcbiAgICB9XG5cbiAgICBsb2FkQW5pbWF0aW9uQXNzZXRzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLl9sYXllcnNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxheWVyLnN0YXRlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlTmFtZSA9IGxheWVyLnN0YXRlc1tqXTtcbiAgICAgICAgICAgICAgICBpZiAoQU5JTV9DT05UUk9MX1NUQVRFUy5pbmRleE9mKHN0YXRlTmFtZSkgIT09IC0xKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhbmltYXRpb25Bc3NldCA9IHRoaXMuX2FuaW1hdGlvbkFzc2V0c1tsYXllci5uYW1lICsgJzonICsgc3RhdGVOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIWFuaW1hdGlvbkFzc2V0IHx8ICFhbmltYXRpb25Bc3NldC5hc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllci5uYW1lKS5hc3NpZ25BbmltYXRpb24oc3RhdGVOYW1lLCBBbmltVHJhY2suRU1QVFkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJZCA9IGFuaW1hdGlvbkFzc2V0LmFzc2V0O1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoYXNzZXRJZCk7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgd2hldGhlciBhc3NpZ25lZCBhbmltYXRpb24gYXNzZXQgc3RpbGwgZXhpc3RzXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkFuaW1hdGlvbkFzc2V0TG9hZGVkKGxheWVyLm5hbWUsIHN0YXRlTmFtZSwgYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQub25jZSgnbG9hZCcsIGZ1bmN0aW9uIChsYXllck5hbWUsIHN0YXRlTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkFuaW1hdGlvbkFzc2V0TG9hZGVkKGxheWVyTmFtZSwgc3RhdGVOYW1lLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKHRoaXMpKGxheWVyLm5hbWUsIHN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uQW5pbWF0aW9uQXNzZXRMb2FkZWQobGF5ZXJOYW1lLCBzdGF0ZU5hbWUsIGFzc2V0KSB7XG4gICAgICAgIHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKGxheWVyTmFtZSkuYXNzaWduQW5pbWF0aW9uKHN0YXRlTmFtZSwgYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGxheWVycyBmcm9tIHRoZSBhbmltIGNvbXBvbmVudC5cbiAgICAgKi9cbiAgICByZW1vdmVTdGF0ZUdyYXBoKCkge1xuICAgICAgICB0aGlzLl9zdGF0ZUdyYXBoID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3RhdGVHcmFwaEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYW5pbWF0aW9uQXNzZXRzID0ge307XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtdO1xuICAgICAgICB0aGlzLl9sYXllckluZGljZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHt9O1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMudW5iaW5kKCk7XG4gICAgICAgIC8vIGNsZWFyIGFsbCB0YXJnZXRzIGZyb20gcHJldmlvdXMgYmluZGluZ1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzZXQgYWxsIG9mIHRoZSBjb21wb25lbnRzIGxheWVycyBhbmQgcGFyYW1ldGVycyB0byB0aGVpciBpbml0aWFsIHN0YXRlcy4gSWYgYSBsYXllciB3YXNcbiAgICAgKiBwbGF5aW5nIGJlZm9yZSBpdCB3aWxsIGNvbnRpbnVlIHBsYXlpbmcuXG4gICAgICovXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIHRoaXMuX2Fzc2lnblBhcmFtZXRlcnModGhpcy5fc3RhdGVHcmFwaCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllclBsYXlpbmcgPSB0aGlzLl9sYXllcnNbaV0ucGxheWluZztcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXS5yZXNldCgpO1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldLnBsYXlpbmcgPSBsYXllclBsYXlpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1bmJpbmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbm9ybWFsaXplV2VpZ2h0cykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXModGhpcy5fdGFyZ2V0cykuZm9yRWFjaCgodGFyZ2V0S2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0c1t0YXJnZXRLZXldLnVuYmluZCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWJpbmQgYWxsIG9mIHRoZSBjb21wb25lbnRzIGxheWVycy5cbiAgICAgKi9cbiAgICByZWJpbmQoKSB7XG4gICAgICAgIC8vIGNsZWFyIGFsbCB0YXJnZXRzIGZyb20gcHJldmlvdXMgYmluZGluZ1xuICAgICAgICB0aGlzLl90YXJnZXRzID0ge307XG4gICAgICAgIC8vIHJlYmluZCBhbGwgbGF5ZXJzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXllcnNbaV0ucmViaW5kKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kcyBhIHtAbGluayBBbmltQ29tcG9uZW50TGF5ZXJ9IGluIHRoaXMgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYW5pbSBjb21wb25lbnQgbGF5ZXIgdG8gZmluZC5cbiAgICAgKiBAcmV0dXJucyB7QW5pbUNvbXBvbmVudExheWVyfSBMYXllci5cbiAgICAgKi9cbiAgICBmaW5kQW5pbWF0aW9uTGF5ZXIobmFtZSkge1xuICAgICAgICBjb25zdCBsYXllckluZGV4ID0gdGhpcy5fbGF5ZXJJbmRpY2VzW25hbWVdO1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzW2xheWVySW5kZXhdIHx8IG51bGw7XG4gICAgfVxuXG4gICAgYWRkQW5pbWF0aW9uU3RhdGUobm9kZU5hbWUsIGFuaW1UcmFjaywgc3BlZWQgPSAxLCBsb29wID0gdHJ1ZSwgbGF5ZXJOYW1lID0gJ0Jhc2UnKSB7XG4gICAgICAgIGlmICghdGhpcy5fc3RhdGVHcmFwaCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkU3RhdGVHcmFwaChuZXcgQW5pbVN0YXRlR3JhcGgoe1xuICAgICAgICAgICAgICAgICdsYXllcnMnOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogbGF5ZXJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0YXRlcyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NwZWVkJzogMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbmFtZSc6IG5vZGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3BlZWQnOiBzcGVlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xvb3AnOiBsb29wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZGVmYXVsdFN0YXRlJzogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAndHJhbnNpdGlvbnMnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZnJvbSc6ICdTVEFSVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0byc6IG5vZGVOYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAncGFyYW1ldGVycyc6IHt9XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllck5hbWUpO1xuICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgIGxheWVyLmFzc2lnbkFuaW1hdGlvbihub2RlTmFtZSwgYW5pbVRyYWNrLCBzcGVlZCwgbG9vcCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmFkZExheWVyKGxheWVyTmFtZSk/LmFzc2lnbkFuaW1hdGlvbihub2RlTmFtZSwgYW5pbVRyYWNrLCBzcGVlZCwgbG9vcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NvY2lhdGVzIGFuIGFuaW1hdGlvbiB3aXRoIGEgc3RhdGUgb3IgYmxlbmQgdHJlZSBub2RlIGluIHRoZSBsb2FkZWQgc3RhdGUgZ3JhcGguIElmIGFsbFxuICAgICAqIHN0YXRlcyBhcmUgbGlua2VkIGFuZCB0aGUge0BsaW5rIEFuaW1Db21wb25lbnQjYWN0aXZhdGV9IHZhbHVlIHdhcyBzZXQgdG8gdHJ1ZSB0aGVuIHRoZVxuICAgICAqIGNvbXBvbmVudCB3aWxsIGJlZ2luIHBsYXlpbmcuIElmIG5vIHN0YXRlIGdyYXBoIGlzIGxvYWRlZCwgYSBkZWZhdWx0IHN0YXRlIGdyYXBoIHdpbGwgYmVcbiAgICAgKiBjcmVhdGVkIHdpdGggYSBzaW5nbGUgc3RhdGUgYmFzZWQgb24gdGhlIHByb3ZpZGVkIG5vZGVQYXRoIHBhcmFtZXRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBub2RlUGF0aCAtIEVpdGhlciB0aGUgc3RhdGUgbmFtZSBvciB0aGUgcGF0aCB0byBhIGJsZW5kIHRyZWUgbm9kZSB0aGF0IHRoaXNcbiAgICAgKiBhbmltYXRpb24gc2hvdWxkIGJlIGFzc29jaWF0ZWQgd2l0aC4gRWFjaCBzZWN0aW9uIG9mIGEgYmxlbmQgdHJlZSBwYXRoIGlzIHNwbGl0IHVzaW5nIGFcbiAgICAgKiBwZXJpb2QgKGAuYCkgdGhlcmVmb3JlIHN0YXRlIG5hbWVzIHNob3VsZCBub3QgaW5jbHVkZSB0aGlzIGNoYXJhY3RlciAoZS5nIFwiTXlTdGF0ZU5hbWVcIiBvclxuICAgICAqIFwiTXlTdGF0ZU5hbWUuQmxlbmRUcmVlTm9kZVwiKS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gYW5pbVRyYWNrIC0gVGhlIGFuaW1hdGlvbiB0cmFjayB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdG8gdGhpcyBzdGF0ZSBhbmRcbiAgICAgKiBwbGF5ZWQgd2hlbmV2ZXIgdGhpcyBzdGF0ZSBpcyBhY3RpdmUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtsYXllck5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW0gY29tcG9uZW50IGxheWVyIHRvIHVwZGF0ZS4gSWYgb21pdHRlZCB0aGVcbiAgICAgKiBkZWZhdWx0IGxheWVyIGlzIHVzZWQuIElmIG5vIHN0YXRlIGdyYXBoIGhhcyBiZWVuIHByZXZpb3VzbHkgbG9hZGVkIHRoaXMgcGFyYW1ldGVyIGlzXG4gICAgICogaWdub3JlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3NwZWVkXSAtIFVwZGF0ZSB0aGUgc3BlZWQgb2YgdGhlIHN0YXRlIHlvdSBhcmUgYXNzaWduaW5nIGFuIGFuaW1hdGlvbiB0by5cbiAgICAgKiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2xvb3BdIC0gVXBkYXRlIHRoZSBsb29wIHByb3BlcnR5IG9mIHRoZSBzdGF0ZSB5b3UgYXJlIGFzc2lnbmluZyBhblxuICAgICAqIGFuaW1hdGlvbiB0by4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBhc3NpZ25BbmltYXRpb24obm9kZVBhdGgsIGFuaW1UcmFjaywgbGF5ZXJOYW1lLCBzcGVlZCA9IDEsIGxvb3AgPSB0cnVlKSB7XG4gICAgICAgIGlmICghdGhpcy5fc3RhdGVHcmFwaCAmJiBub2RlUGF0aC5pbmRleE9mKCcuJykgPT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRTdGF0ZUdyYXBoKG5ldyBBbmltU3RhdGVHcmFwaCh7XG4gICAgICAgICAgICAgICAgJ2xheWVycyc6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiAnQmFzZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3RhdGVzJzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ25hbWUnOiAnU1RBUlQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3BlZWQnOiAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICduYW1lJzogbm9kZVBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzcGVlZCc6IHNwZWVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbG9vcCc6IGxvb3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkZWZhdWx0U3RhdGUnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICd0cmFuc2l0aW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdmcm9tJzogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RvJzogbm9kZVBhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICdwYXJhbWV0ZXJzJzoge31cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHRoaXMuYmFzZUxheWVyLmFzc2lnbkFuaW1hdGlvbihub2RlUGF0aCwgYW5pbVRyYWNrKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyTmFtZSA/IHRoaXMuZmluZEFuaW1hdGlvbkxheWVyKGxheWVyTmFtZSkgOiB0aGlzLmJhc2VMYXllcjtcbiAgICAgICAgaWYgKCFsYXllcikge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ2Fzc2lnbkFuaW1hdGlvbjogVHJ5aW5nIHRvIGFzc2lnbiBhbiBhbmltIHRyYWNrIHRvIGEgbGF5ZXIgdGhhdCBkb2VzblxcJ3QgZXhpc3QnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5hc3NpZ25BbmltYXRpb24obm9kZVBhdGgsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYW5pbWF0aW9ucyBmcm9tIGEgbm9kZSBpbiB0aGUgbG9hZGVkIHN0YXRlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5vZGVOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIG5vZGUgdGhhdCBzaG91bGQgaGF2ZSBpdHMgYW5pbWF0aW9uIHRyYWNrcyByZW1vdmVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbGF5ZXJOYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltIGNvbXBvbmVudCBsYXllciB0byB1cGRhdGUuIElmIG9taXR0ZWQgdGhlXG4gICAgICogZGVmYXVsdCBsYXllciBpcyB1c2VkLlxuICAgICAqL1xuICAgIHJlbW92ZU5vZGVBbmltYXRpb25zKG5vZGVOYW1lLCBsYXllck5hbWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllck5hbWUgPyB0aGlzLmZpbmRBbmltYXRpb25MYXllcihsYXllck5hbWUpIDogdGhpcy5iYXNlTGF5ZXI7XG4gICAgICAgIGlmICghbGF5ZXIpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdyZW1vdmVTdGF0ZUFuaW1hdGlvbnM6IFRyeWluZyB0byByZW1vdmUgYW5pbWF0aW9uIHRyYWNrcyBmcm9tIGEgc3RhdGUgYmVmb3JlIHRoZSBzdGF0ZSBncmFwaCBoYXMgYmVlbiBsb2FkZWQuIEhhdmUgeW91IGNhbGxlZCBsb2FkU3RhdGVHcmFwaD8nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5yZW1vdmVOb2RlQW5pbWF0aW9ucyhub2RlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgdHlwZSkge1xuICAgICAgICBjb25zdCBwYXJhbSA9IHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIGlmIChwYXJhbSAmJiBwYXJhbS50eXBlID09PSB0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyYW0udmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgRGVidWcubG9nKGBDYW5ub3QgZ2V0IHBhcmFtZXRlciB2YWx1ZS4gTm8gcGFyYW1ldGVyIGZvdW5kIGluIGFuaW0gY29udHJvbGxlciBuYW1lZCBcIiR7bmFtZX1cIiBvZiB0eXBlIFwiJHt0eXBlfVwiYCk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgdHlwZSwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgcGFyYW0gPSB0aGlzLl9wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICBpZiAocGFyYW0gJiYgcGFyYW0udHlwZSA9PT0gdHlwZSkge1xuICAgICAgICAgICAgcGFyYW0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBEZWJ1Zy5sb2coYENhbm5vdCBzZXQgcGFyYW1ldGVyIHZhbHVlLiBObyBwYXJhbWV0ZXIgZm91bmQgaW4gYW5pbSBjb250cm9sbGVyIG5hbWVkIFwiJHtuYW1lfVwiIG9mIHR5cGUgXCIke3R5cGV9XCJgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBwYXJhbWV0ZXIgb2JqZWN0IGZvciB0aGUgc3BlY2lmaWVkIHBhcmFtZXRlciBuYW1lLiBUaGlzIGZ1bmN0aW9uIGlzIGFub255bW91cyBzbyB0aGF0IGl0IGNhbiBiZSBwYXNzZWQgdG8gdGhlIEFuaW1Db250cm9sbGVyXG4gICAgICogd2hpbGUgc3RpbGwgYmVpbmcgY2FsbGVkIGluIHRoZSBzY29wZSBvZiB0aGUgQW5pbUNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBwYXJhbWV0ZXIgb2JqZWN0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZmluZFBhcmFtZXRlciA9IChuYW1lKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJhbWV0ZXJzW25hbWVdO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgdHJpZ2dlciBwYXJhbWV0ZXIgYXMgaGF2aW5nIGJlZW4gdXNlZCBieSBhIHRyYW5zaXRpb24uIFRoaXMgZnVuY3Rpb24gaXMgYW5vbnltb3VzIHNvIHRoYXQgaXQgY2FuIGJlIHBhc3NlZCB0byB0aGUgQW5pbUNvbnRyb2xsZXJcbiAgICAgKiB3aGlsZSBzdGlsbCBiZWluZyBjYWxsZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBBbmltQ29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgdHJpZ2dlciB0byBzZXQgYXMgY29uc3VtZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjb25zdW1lVHJpZ2dlciA9IChuYW1lKSA9PiB7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuYWRkKG5hbWUpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgZmxvYXQgcGFyYW1ldGVyIHZhbHVlIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBmbG9hdCB0byByZXR1cm4gdGhlIHZhbHVlIG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEEgZmxvYXQuXG4gICAgICovXG4gICAgZ2V0RmxvYXQobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9GTE9BVCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYSBmbG9hdCBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBuZXcgZmxvYXQgdmFsdWUgdG8gc2V0IHRoaXMgcGFyYW1ldGVyIHRvLlxuICAgICAqL1xuICAgIHNldEZsb2F0KG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfRkxPQVQsIHZhbHVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGludGVnZXIgcGFyYW1ldGVyIHZhbHVlIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBpbnRlZ2VyIHRvIHJldHVybiB0aGUgdmFsdWUgb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQW4gaW50ZWdlci5cbiAgICAgKi9cbiAgICBnZXRJbnRlZ2VyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UGFyYW1ldGVyVmFsdWUobmFtZSwgQU5JTV9QQVJBTUVURVJfSU5URUdFUik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYW4gaW50ZWdlciBwYXJhbWV0ZXIgdGhhdCB3YXMgZGVmaW5lZCBpbiB0aGUgYW5pbWF0aW9uIGNvbXBvbmVudHMgc3RhdGVcbiAgICAgKiBncmFwaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIG5ldyBpbnRlZ2VyIHZhbHVlIHRvIHNldCB0aGlzIHBhcmFtZXRlciB0by5cbiAgICAgKi9cbiAgICBzZXRJbnRlZ2VyKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICUgMSA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9JTlRFR0VSLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcignQXR0ZW1wdGluZyB0byBhc3NpZ24gbm9uIGludGVnZXIgdmFsdWUgdG8gaW50ZWdlciBwYXJhbWV0ZXInLCBuYW1lLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgYm9vbGVhbiBwYXJhbWV0ZXIgdmFsdWUgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGJvb2xlYW4gdG8gcmV0dXJuIHRoZSB2YWx1ZSBvZi5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gQSBib29sZWFuLlxuICAgICAqL1xuICAgIGdldEJvb2xlYW4obmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9CT09MRUFOKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiBhIGJvb2xlYW4gcGFyYW1ldGVyIHRoYXQgd2FzIGRlZmluZWQgaW4gdGhlIGFuaW1hdGlvbiBjb21wb25lbnRzIHN0YXRlXG4gICAgICogZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdmFsdWUgLSBUaGUgbmV3IGJvb2xlYW4gdmFsdWUgdG8gc2V0IHRoaXMgcGFyYW1ldGVyIHRvLlxuICAgICAqL1xuICAgIHNldEJvb2xlYW4obmFtZSwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9CT09MRUFOLCAhIXZhbHVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgdHJpZ2dlciBwYXJhbWV0ZXIgdmFsdWUgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHRyaWdnZXIgdG8gcmV0dXJuIHRoZSB2YWx1ZSBvZi5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gQSBib29sZWFuLlxuICAgICAqL1xuICAgIGdldFRyaWdnZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9UUklHR0VSKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiBhIHRyaWdnZXIgcGFyYW1ldGVyIHRoYXQgd2FzIGRlZmluZWQgaW4gdGhlIGFuaW1hdGlvbiBjb21wb25lbnRzIHN0YXRlXG4gICAgICogZ3JhcGggdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2luZ2xlRnJhbWVdIC0gSWYgdHJ1ZSwgdGhpcyB0cmlnZ2VyIHdpbGwgYmUgc2V0IGJhY2sgdG8gZmFsc2UgYXQgdGhlIGVuZFxuICAgICAqIG9mIHRoZSBhbmltYXRpb24gdXBkYXRlLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKi9cbiAgICBzZXRUcmlnZ2VyKG5hbWUsIHNpbmdsZUZyYW1lID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZShuYW1lLCBBTklNX1BBUkFNRVRFUl9UUklHR0VSLCB0cnVlKTtcbiAgICAgICAgaWYgKHNpbmdsZUZyYW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzLmFkZChuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyB0aGUgdmFsdWUgb2YgYSB0cmlnZ2VyIHBhcmFtZXRlciB0aGF0IHdhcyBkZWZpbmVkIGluIHRoZSBhbmltYXRpb24gY29tcG9uZW50cyBzdGF0ZVxuICAgICAqIGdyYXBoIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKi9cbiAgICByZXNldFRyaWdnZXIobmFtZSkge1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlclZhbHVlKG5hbWUsIEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBvbkJlZm9yZVJlbW92ZSgpIHtcbiAgICAgICAgaWYgKE51bWJlci5pc0Zpbml0ZSh0aGlzLl9zdGF0ZUdyYXBoQXNzZXQpKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0ZUdyYXBoQXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zdGF0ZUdyYXBoQXNzZXQpO1xuICAgICAgICAgICAgc3RhdGVHcmFwaEFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25TdGF0ZUdyYXBoQXNzZXRDaGFuZ2VFdmVudCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5sYXllcnNbaV0udXBkYXRlKGR0ICogdGhpcy5zcGVlZCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2Vycy5mb3JFYWNoKCh0cmlnZ2VyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBhcmFtZXRlcnNbdHJpZ2dlcl0udmFsdWUgPSBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkQW5pbSwgZHVwbGljYXRlZElkc01hcCkge1xuICAgICAgICBpZiAob2xkQW5pbS5yb290Qm9uZSAmJiBkdXBsaWNhdGVkSWRzTWFwW29sZEFuaW0ucm9vdEJvbmUuZ2V0R3VpZCgpXSkge1xuICAgICAgICAgICAgdGhpcy5yb290Qm9uZSA9IGR1cGxpY2F0ZWRJZHNNYXBbb2xkQW5pbS5yb290Qm9uZS5nZXRHdWlkKCldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yZWJpbmQoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgQW5pbUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Db21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsImZpbmRQYXJhbWV0ZXIiLCJuYW1lIiwiX3BhcmFtZXRlcnMiLCJjb25zdW1lVHJpZ2dlciIsIl9jb25zdW1lZFRyaWdnZXJzIiwiYWRkIiwiX3N0YXRlR3JhcGhBc3NldCIsIl9hbmltYXRpb25Bc3NldHMiLCJfc3BlZWQiLCJfYWN0aXZhdGUiLCJfcGxheWluZyIsIl9yb290Qm9uZSIsIl9zdGF0ZUdyYXBoIiwiX2xheWVycyIsIl9sYXllckluZGljZXMiLCJfdGFyZ2V0cyIsIlNldCIsIl9ub3JtYWxpemVXZWlnaHRzIiwic3RhdGVHcmFwaEFzc2V0IiwidmFsdWUiLCJyZW1vdmVTdGF0ZUdyYXBoIiwiYXBwIiwiYXNzZXRzIiwiZ2V0Iiwib2ZmIiwiX29uU3RhdGVHcmFwaEFzc2V0Q2hhbmdlRXZlbnQiLCJfaWQiLCJfYXNzZXQiLCJBc3NldCIsImlkIiwicmVzb3VyY2UiLCJsb2FkU3RhdGVHcmFwaCIsIm9uIiwib25jZSIsImFzc2V0IiwibG9hZCIsIm5vcm1hbGl6ZVdlaWdodHMiLCJ1bmJpbmQiLCJhbmltYXRpb25Bc3NldHMiLCJsb2FkQW5pbWF0aW9uQXNzZXRzIiwic3BlZWQiLCJhY3RpdmF0ZSIsInBsYXlpbmciLCJyb290Qm9uZSIsInJvb3QiLCJmaW5kQnlHdWlkIiwiRGVidWciLCJhc3NlcnQiLCJFbnRpdHkiLCJyZWJpbmQiLCJzdGF0ZUdyYXBoIiwibGF5ZXJzIiwibGF5ZXJJbmRpY2VzIiwicGFyYW1ldGVycyIsInRhcmdldHMiLCJwbGF5YWJsZSIsImkiLCJsZW5ndGgiLCJiYXNlTGF5ZXIiLCJwcmV2QW5pbWF0aW9uQXNzZXRzIiwicHJldk1hc2tzIiwibWFwIiwibGF5ZXIiLCJtYXNrIiwiQW5pbVN0YXRlR3JhcGgiLCJfZGF0YSIsImZvckVhY2giLCJkaXJ0aWZ5VGFyZ2V0cyIsIk9iamVjdCIsInZhbHVlcyIsImRpcnR5IiwiX2FkZExheWVyIiwic3RhdGVzIiwidHJhbnNpdGlvbnMiLCJ3ZWlnaHQiLCJibGVuZFR5cGUiLCJncmFwaCIsImxheWVySW5kZXgiLCJhbmltQmluZGVyIiwiQW5pbUNvbXBvbmVudEJpbmRlciIsImFuaW1FdmFsdWF0b3IiLCJBbmltRXZhbHVhdG9yIiwiY29udHJvbGxlciIsIkFuaW1Db250cm9sbGVyIiwicHVzaCIsIkFuaW1Db21wb25lbnRMYXllciIsImFkZExheWVyIiwiZmluZEFuaW1hdGlvbkxheWVyIiwiX2Fzc2lnblBhcmFtZXRlcnMiLCJwYXJhbUtleXMiLCJrZXlzIiwicGFyYW1LZXkiLCJ0eXBlIiwiY29udGFpbnNCbGVuZFRyZWUiLCJiaW5kIiwiX2V4dGVuZHMiLCJzb21lIiwic3RhdGUiLCJibGVuZFRyZWUiLCJzZXR1cEFuaW1hdGlvbkFzc2V0cyIsImxheWVyTmFtZSIsImoiLCJzdGF0ZU5hbWUiLCJBTklNX0NPTlRST0xfU1RBVEVTIiwiaW5kZXhPZiIsInN0YXRlS2V5IiwiYW5pbWF0aW9uQXNzZXQiLCJhc3NpZ25BbmltYXRpb24iLCJBbmltVHJhY2siLCJFTVBUWSIsImFzc2V0SWQiLCJvbkFuaW1hdGlvbkFzc2V0TG9hZGVkIiwicmVzZXQiLCJsYXllclBsYXlpbmciLCJ0YXJnZXRLZXkiLCJhZGRBbmltYXRpb25TdGF0ZSIsIm5vZGVOYW1lIiwiYW5pbVRyYWNrIiwibG9vcCIsIl90aGlzJGFkZExheWVyIiwibm9kZVBhdGgiLCJlcnJvciIsInJlbW92ZU5vZGVBbmltYXRpb25zIiwiZ2V0UGFyYW1ldGVyVmFsdWUiLCJwYXJhbSIsImxvZyIsInVuZGVmaW5lZCIsInNldFBhcmFtZXRlclZhbHVlIiwiZ2V0RmxvYXQiLCJBTklNX1BBUkFNRVRFUl9GTE9BVCIsInNldEZsb2F0IiwiZ2V0SW50ZWdlciIsIkFOSU1fUEFSQU1FVEVSX0lOVEVHRVIiLCJzZXRJbnRlZ2VyIiwiZ2V0Qm9vbGVhbiIsIkFOSU1fUEFSQU1FVEVSX0JPT0xFQU4iLCJzZXRCb29sZWFuIiwiZ2V0VHJpZ2dlciIsIkFOSU1fUEFSQU1FVEVSX1RSSUdHRVIiLCJzZXRUcmlnZ2VyIiwic2luZ2xlRnJhbWUiLCJyZXNldFRyaWdnZXIiLCJvbkJlZm9yZVJlbW92ZSIsIk51bWJlciIsImlzRmluaXRlIiwidXBkYXRlIiwiZHQiLCJ0cmlnZ2VyIiwiY2xlYXIiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJvbGRBbmltIiwiZHVwbGljYXRlZElkc01hcCIsImdldEd1aWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGFBQWEsU0FBU0MsU0FBUyxDQUFDO0FBQ2xDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQ3hCLElBQUEsS0FBSyxDQUFDRCxNQUFNLEVBQUVDLE1BQU0sQ0FBQyxDQUFBO0FBMGxCekI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQVBJLElBUUFDLENBQUFBLGFBQWEsR0FBSUMsSUFBSSxJQUFLO0FBQ3RCLE1BQUEsT0FBTyxJQUFJLENBQUNDLFdBQVcsQ0FBQ0QsSUFBSSxDQUFDLENBQUE7S0FDaEMsQ0FBQTtBQUVEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTkksSUFPQUUsQ0FBQUEsY0FBYyxHQUFJRixJQUFJLElBQUs7QUFDdkIsTUFBQSxJQUFJLENBQUNHLGlCQUFpQixDQUFDQyxHQUFHLENBQUNKLElBQUksQ0FBQyxDQUFBO0tBQ25DLENBQUE7SUE3bUJHLElBQUksQ0FBQ0ssZ0JBQWdCLEdBQUcsSUFB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
