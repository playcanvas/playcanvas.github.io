/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
import { AnimBlendTree1D } from './anim-blend-tree-1d.js';
import { AnimBlendTreeCartesian2D } from './anim-blend-tree-2d-cartesian.js';
import { AnimBlendTreeDirectional2D } from './anim-blend-tree-2d-directional.js';
import { AnimBlendTreeDirect } from './anim-blend-tree-direct.js';
import { AnimNode } from './anim-node.js';
import { ANIM_BLEND_DIRECT, ANIM_BLEND_2D_DIRECTIONAL, ANIM_BLEND_2D_CARTESIAN, ANIM_BLEND_1D, ANIM_CONTROL_STATES } from './constants.js';

class AnimState {
  constructor(controller, name, speed, loop, blendTree) {
    this._controller = controller;
    this._name = name;
    this._animations = {};
    this._animationList = [];
    this._speed = speed || 1.0;
    this._loop = loop === undefined ? true : loop;
    const findParameter = this._controller.findParameter.bind(this._controller);
    if (blendTree) {
      this._blendTree = this._createTree(blendTree.type, this, null, name, 1.0, blendTree.parameter ? [blendTree.parameter] : blendTree.parameters, blendTree.children, blendTree.syncAnimations, this._createTree, findParameter);
    } else {
      this._blendTree = new AnimNode(this, null, name, 1.0, speed);
    }
  }
  _createTree(type, state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter) {
    switch (type) {
      case ANIM_BLEND_1D:
        return new AnimBlendTree1D(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
      case ANIM_BLEND_2D_CARTESIAN:
        return new AnimBlendTreeCartesian2D(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
      case ANIM_BLEND_2D_DIRECTIONAL:
        return new AnimBlendTreeDirectional2D(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
      case ANIM_BLEND_DIRECT:
        return new AnimBlendTreeDirect(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter);
    }
    return undefined;
  }
  _getNodeFromPath(path) {
    let currNode = this._blendTree;
    for (let i = 1; i < path.length; i++) {
      currNode = currNode.getChild(path[i]);
    }
    return currNode;
  }
  addAnimation(path, animTrack) {
    const pathString = path.join('.');
    const indexOfAnimation = this._animationList.findIndex(function (animation) {
      return animation.path === pathString;
    });
    if (indexOfAnimation >= 0) {
      this._animationList[indexOfAnimation].animTrack = animTrack;
    } else {
      const node = this._getNodeFromPath(path);
      node.animTrack = animTrack;
      this._animationList.push(node);
    }
  }
  get name() {
    return this._name;
  }
  set animations(value) {
    this._animationList = value;
  }
  get animations() {
    return this._animationList;
  }
  set speed(value) {
    this._speed = value;
  }
  get speed() {
    return this._speed;
  }
  set loop(value) {
    this._loop = value;
  }
  get loop() {
    return this._loop;
  }
  get nodeCount() {
    if (!this._blendTree || this._blendTree.constructor === AnimNode) return 1;
    return this._blendTree.getNodeCount();
  }
  get playable() {
    return ANIM_CONTROL_STATES.indexOf(this.name) !== -1 || this.animations.length === this.nodeCount;
  }
  get looping() {
    if (this.animations.length > 0) {
      const trackClipName = this.name + '.' + this.animations[0].animTrack.name;
      const trackClip = this._controller.animEvaluator.findClip(trackClipName);
      if (trackClip) {
        return trackClip.loop;
      }
    }
    return false;
  }
  get totalWeight() {
    let sum = 0;
    for (let i = 0; i < this.animations.length; i++) {
      sum += this.animations[i].weight;
    }
    return sum;
  }
  get timelineDuration() {
    let duration = 0;
    for (let i = 0; i < this.animations.length; i++) {
      const animation = this.animations[i];
      if (animation.animTrack.duration > duration) {
        duration = animation.animTrack.duration;
      }
    }
    return duration;
  }
}

export { AnimState };
