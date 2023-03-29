/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

class InterpolatedKey {
  constructor() {
    this._written = false;
    this._name = '';
    this._keyFrames = [];

    // Result of interpolation
    this._quat = new Quat();
    this._pos = new Vec3();
    this._scale = new Vec3();

    // Optional destination for interpolated keyframe
    this._targetNode = null;
  }
  getTarget() {
    return this._targetNode;
  }
  setTarget(node) {
    this._targetNode = node;
  }
}

/**
 * Represents a skeleton used to play animations.
 */
class Skeleton {
  /**
   * Determines whether skeleton is looping its animation.
   *
   * @type {boolean}
   */

  /**
   * Create a new Skeleton instance.
   *
   * @param {import('../graph-node.js').GraphNode} graph - The root {@link GraphNode} of the
   * skeleton.
   */
  constructor(graph) {
    this.looping = true;
    /**
     * @type {import('./animation.js').Animation}
     * @private
     */
    this._animation = null;
    this._time = 0;
    this._interpolatedKeys = [];
    this._interpolatedKeyDict = {};
    this._currKeyIndices = {};
    this.graph = null;
    const addInterpolatedKeys = node => {
      const interpKey = new InterpolatedKey();
      interpKey._name = node.name;
      this._interpolatedKeys.push(interpKey);
      this._interpolatedKeyDict[node.name] = interpKey;
      this._currKeyIndices[node.name] = 0;
      for (let i = 0; i < node._children.length; i++) addInterpolatedKeys(node._children[i]);
    };
    addInterpolatedKeys(graph);
  }

  /**
   * Animation currently assigned to skeleton.
   *
   * @type {import('./animation.js').Animation}
   */
  set animation(value) {
    this._animation = value;
    this.currentTime = 0;
  }
  get animation() {
    return this._animation;
  }

  /**
   * Current time of currently active animation in seconds. This value is between zero and the
   * duration of the animation.
   *
   * @type {number}
   */
  set currentTime(value) {
    this._time = value;
    const numNodes = this._interpolatedKeys.length;
    for (let i = 0; i < numNodes; i++) {
      const node = this._interpolatedKeys[i];
      const nodeName = node._name;
      this._currKeyIndices[nodeName] = 0;
    }
    this.addTime(0);
    this.updateGraph();
  }
  get currentTime() {
    return this._time;
  }

  /**
   * Read-only property that returns number of nodes of a skeleton.
   *
   * @type {number}
   */
  get numNodes() {
    return this._interpolatedKeys.length;
  }

  /**
   * Progresses the animation assigned to the specified skeleton by the supplied time delta. If
   * the delta takes the animation passed its end point, if the skeleton is set to loop, the
   * animation will continue from the beginning. Otherwise, the animation's current time will
   * remain at its duration (i.e. the end).
   *
   * @param {number} delta - The time in seconds to progress the skeleton's animation.
   */
  addTime(delta) {
    if (this._animation !== null) {
      const nodes = this._animation._nodes;
      const duration = this._animation.duration;

      // Check if we can early out
      if (this._time === duration && !this.looping) {
        return;
      }

      // Step the current time and work out if we need to jump ahead, clamp or wrap around
      this._time += delta;
      if (this._time > duration) {
        this._time = this.looping ? 0.0 : duration;
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const nodeName = node._name;
          this._currKeyIndices[nodeName] = 0;
        }
      } else if (this._time < 0) {
        this._time = this.looping ? duration : 0.0;
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const nodeName = node._name;
          this._currKeyIndices[nodeName] = node._keys.length - 2;
        }
      }

      // For each animated node...

      // keys index offset
      const offset = delta >= 0 ? 1 : -1;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const nodeName = node._name;
        const keys = node._keys;

        // Determine the interpolated keyframe for this animated node
        const interpKey = this._interpolatedKeyDict[nodeName];
        if (interpKey === undefined) {
          Debug.warn(`Unknown skeleton node name: ${nodeName}`);
          continue;
        }
        // If there's only a single key, just copy the key to the interpolated key...
        let foundKey = false;
        if (keys.length !== 1) {
          // Otherwise, find the keyframe pair for this node
          for (let currKeyIndex = this._currKeyIndices[nodeName]; currKeyIndex < keys.length - 1 && currKeyIndex >= 0; currKeyIndex += offset) {
            const k1 = keys[currKeyIndex];
            const k2 = keys[currKeyIndex + 1];
            if (k1.time <= this._time && k2.time >= this._time) {
              const alpha = (this._time - k1.time) / (k2.time - k1.time);
              interpKey._pos.lerp(k1.position, k2.position, alpha);
              interpKey._quat.slerp(k1.rotation, k2.rotation, alpha);
              interpKey._scale.lerp(k1.scale, k2.scale, alpha);
              interpKey._written = true;
              this._currKeyIndices[nodeName] = currKeyIndex;
              foundKey = true;
              break;
            }
          }
        }
        if (keys.length === 1 || !foundKey && this._time === 0.0 && this.looping) {
          interpKey._pos.copy(keys[0].position);
          interpKey._quat.copy(keys[0].rotation);
          interpKey._scale.copy(keys[0].scale);
          interpKey._written = true;
        }
      }
    }
  }

  /**
   * Blends two skeletons together.
   *
   * @param {Skeleton} skel1 - Skeleton holding the first pose to be blended.
   * @param {Skeleton} skel2 - Skeleton holding the second pose to be blended.
   * @param {number} alpha - The value controlling the interpolation in relation to the two input
   * skeletons. The value is in the range 0 to 1, 0 generating skel1, 1 generating skel2 and
   * anything in between generating a spherical interpolation between the two.
   */
  blend(skel1, skel2, alpha) {
    const numNodes = this._interpolatedKeys.length;
    for (let i = 0; i < numNodes; i++) {
      const key1 = skel1._interpolatedKeys[i];
      const key2 = skel2._interpolatedKeys[i];
      const dstKey = this._interpolatedKeys[i];
      if (key1._written && key2._written) {
        dstKey._quat.slerp(key1._quat, skel2._interpolatedKeys[i]._quat, alpha);
        dstKey._pos.lerp(key1._pos, skel2._interpolatedKeys[i]._pos, alpha);
        dstKey._scale.lerp(key1._scale, key2._scale, alpha);
        dstKey._written = true;
      } else if (key1._written) {
        dstKey._quat.copy(key1._quat);
        dstKey._pos.copy(key1._pos);
        dstKey._scale.copy(key1._scale);
        dstKey._written = true;
      } else if (key2._written) {
        dstKey._quat.copy(key2._quat);
        dstKey._pos.copy(key2._pos);
        dstKey._scale.copy(key2._scale);
        dstKey._written = true;
      }
    }
  }

  /**
   * Links a skeleton to a node hierarchy. The nodes animated skeleton are then subsequently used
   * to drive the local transformation matrices of the node hierarchy.
   *
   * @param {import('../graph-node.js').GraphNode} graph - The root node of the graph that the
   * skeleton is to drive.
   */
  setGraph(graph) {
    this.graph = graph;
    if (graph) {
      for (let i = 0; i < this._interpolatedKeys.length; i++) {
        const interpKey = this._interpolatedKeys[i];
        const graphNode = graph.findByName(interpKey._name);
        this._interpolatedKeys[i].setTarget(graphNode);
      }
    } else {
      for (let i = 0; i < this._interpolatedKeys.length; i++) {
        this._interpolatedKeys[i].setTarget(null);
      }
    }
  }

  /**
   * Synchronizes the currently linked node hierarchy with the current state of the skeleton.
   * Internally, this function converts the interpolated keyframe at each node in the skeleton
   * into the local transformation matrix at each corresponding node in the linked node
   * hierarchy.
   */
  updateGraph() {
    if (this.graph) {
      for (let i = 0; i < this._interpolatedKeys.length; i++) {
        const interpKey = this._interpolatedKeys[i];
        if (interpKey._written) {
          const transform = interpKey.getTarget();
          transform.localPosition.copy(interpKey._pos);
          transform.localRotation.copy(interpKey._quat);
          transform.localScale.copy(interpKey._scale);
          if (!transform._dirtyLocal) transform._dirtifyLocal();
          interpKey._written = false;
        }
      }
    }
  }
}

export { Skeleton };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tlbGV0b24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9hbmltYXRpb24vc2tlbGV0b24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5jbGFzcyBJbnRlcnBvbGF0ZWRLZXkge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl93cml0dGVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX25hbWUgPSAnJztcbiAgICAgICAgdGhpcy5fa2V5RnJhbWVzID0gW107XG5cbiAgICAgICAgLy8gUmVzdWx0IG9mIGludGVycG9sYXRpb25cbiAgICAgICAgdGhpcy5fcXVhdCA9IG5ldyBRdWF0KCk7XG4gICAgICAgIHRoaXMuX3BvcyA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuX3NjYWxlID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAvLyBPcHRpb25hbCBkZXN0aW5hdGlvbiBmb3IgaW50ZXJwb2xhdGVkIGtleWZyYW1lXG4gICAgICAgIHRoaXMuX3RhcmdldE5vZGUgPSBudWxsO1xuICAgIH1cblxuICAgIGdldFRhcmdldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RhcmdldE5vZGU7XG4gICAgfVxuXG4gICAgc2V0VGFyZ2V0KG5vZGUpIHtcbiAgICAgICAgdGhpcy5fdGFyZ2V0Tm9kZSA9IG5vZGU7XG4gICAgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBza2VsZXRvbiB1c2VkIHRvIHBsYXkgYW5pbWF0aW9ucy5cbiAqL1xuY2xhc3MgU2tlbGV0b24ge1xuICAgIC8qKlxuICAgICAqIERldGVybWluZXMgd2hldGhlciBza2VsZXRvbiBpcyBsb29waW5nIGl0cyBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBsb29waW5nID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTa2VsZXRvbiBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9ncmFwaC1ub2RlLmpzJykuR3JhcGhOb2RlfSBncmFwaCAtIFRoZSByb290IHtAbGluayBHcmFwaE5vZGV9IG9mIHRoZVxuICAgICAqIHNrZWxldG9uLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2FuaW1hdGlvbi5qcycpLkFuaW1hdGlvbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RpbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuX2ludGVycG9sYXRlZEtleXMgPSBbXTtcbiAgICAgICAgdGhpcy5faW50ZXJwb2xhdGVkS2V5RGljdCA9IHt9O1xuICAgICAgICB0aGlzLl9jdXJyS2V5SW5kaWNlcyA9IHt9O1xuXG4gICAgICAgIHRoaXMuZ3JhcGggPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGFkZEludGVycG9sYXRlZEtleXMgPSAobm9kZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW50ZXJwS2V5ID0gbmV3IEludGVycG9sYXRlZEtleSgpO1xuICAgICAgICAgICAgaW50ZXJwS2V5Ll9uYW1lID0gbm9kZS5uYW1lO1xuICAgICAgICAgICAgdGhpcy5faW50ZXJwb2xhdGVkS2V5cy5wdXNoKGludGVycEtleSk7XG4gICAgICAgICAgICB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlEaWN0W25vZGUubmFtZV0gPSBpbnRlcnBLZXk7XG4gICAgICAgICAgICB0aGlzLl9jdXJyS2V5SW5kaWNlc1tub2RlLm5hbWVdID0gMDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLl9jaGlsZHJlbi5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgICAgICBhZGRJbnRlcnBvbGF0ZWRLZXlzKG5vZGUuX2NoaWxkcmVuW2ldKTtcbiAgICAgICAgfTtcblxuICAgICAgICBhZGRJbnRlcnBvbGF0ZWRLZXlzKGdyYXBoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbmltYXRpb24gY3VycmVudGx5IGFzc2lnbmVkIHRvIHNrZWxldG9uLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9hbmltYXRpb24uanMnKS5BbmltYXRpb259XG4gICAgICovXG4gICAgc2V0IGFuaW1hdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hbmltYXRpb24gPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5jdXJyZW50VGltZSA9IDA7XG4gICAgfVxuXG4gICAgZ2V0IGFuaW1hdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1hdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXJyZW50IHRpbWUgb2YgY3VycmVudGx5IGFjdGl2ZSBhbmltYXRpb24gaW4gc2Vjb25kcy4gVGhpcyB2YWx1ZSBpcyBiZXR3ZWVuIHplcm8gYW5kIHRoZVxuICAgICAqIGR1cmF0aW9uIG9mIHRoZSBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjdXJyZW50VGltZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl90aW1lID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG51bU5vZGVzID0gdGhpcy5faW50ZXJwb2xhdGVkS2V5cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtTm9kZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuX2ludGVycG9sYXRlZEtleXNbaV07XG4gICAgICAgICAgICBjb25zdCBub2RlTmFtZSA9IG5vZGUuX25hbWU7XG4gICAgICAgICAgICB0aGlzLl9jdXJyS2V5SW5kaWNlc1tub2RlTmFtZV0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZGRUaW1lKDApO1xuICAgICAgICB0aGlzLnVwZGF0ZUdyYXBoKCk7XG4gICAgfVxuXG4gICAgZ2V0IGN1cnJlbnRUaW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWFkLW9ubHkgcHJvcGVydHkgdGhhdCByZXR1cm5zIG51bWJlciBvZiBub2RlcyBvZiBhIHNrZWxldG9uLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgbnVtTm9kZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9ncmVzc2VzIHRoZSBhbmltYXRpb24gYXNzaWduZWQgdG8gdGhlIHNwZWNpZmllZCBza2VsZXRvbiBieSB0aGUgc3VwcGxpZWQgdGltZSBkZWx0YS4gSWZcbiAgICAgKiB0aGUgZGVsdGEgdGFrZXMgdGhlIGFuaW1hdGlvbiBwYXNzZWQgaXRzIGVuZCBwb2ludCwgaWYgdGhlIHNrZWxldG9uIGlzIHNldCB0byBsb29wLCB0aGVcbiAgICAgKiBhbmltYXRpb24gd2lsbCBjb250aW51ZSBmcm9tIHRoZSBiZWdpbm5pbmcuIE90aGVyd2lzZSwgdGhlIGFuaW1hdGlvbidzIGN1cnJlbnQgdGltZSB3aWxsXG4gICAgICogcmVtYWluIGF0IGl0cyBkdXJhdGlvbiAoaS5lLiB0aGUgZW5kKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWx0YSAtIFRoZSB0aW1lIGluIHNlY29uZHMgdG8gcHJvZ3Jlc3MgdGhlIHNrZWxldG9uJ3MgYW5pbWF0aW9uLlxuICAgICAqL1xuICAgIGFkZFRpbWUoZGVsdGEpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuaW1hdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSB0aGlzLl9hbmltYXRpb24uX25vZGVzO1xuICAgICAgICAgICAgY29uc3QgZHVyYXRpb24gPSB0aGlzLl9hbmltYXRpb24uZHVyYXRpb247XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHdlIGNhbiBlYXJseSBvdXRcbiAgICAgICAgICAgIGlmICgodGhpcy5fdGltZSA9PT0gZHVyYXRpb24pICYmICF0aGlzLmxvb3BpbmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFN0ZXAgdGhlIGN1cnJlbnQgdGltZSBhbmQgd29yayBvdXQgaWYgd2UgbmVlZCB0byBqdW1wIGFoZWFkLCBjbGFtcCBvciB3cmFwIGFyb3VuZFxuICAgICAgICAgICAgdGhpcy5fdGltZSArPSBkZWx0YTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3RpbWUgPiBkdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWUgPSB0aGlzLmxvb3BpbmcgPyAwLjAgOiBkdXJhdGlvbjtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZU5hbWUgPSBub2RlLl9uYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdXJyS2V5SW5kaWNlc1tub2RlTmFtZV0gPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdGltZSA8IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lID0gdGhpcy5sb29waW5nID8gZHVyYXRpb24gOiAwLjA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVOYW1lID0gbm9kZS5fbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3VycktleUluZGljZXNbbm9kZU5hbWVdID0gbm9kZS5fa2V5cy5sZW5ndGggLSAyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAvLyBGb3IgZWFjaCBhbmltYXRlZCBub2RlLi4uXG5cbiAgICAgICAgICAgIC8vIGtleXMgaW5kZXggb2Zmc2V0XG4gICAgICAgICAgICBjb25zdCBvZmZzZXQgPSAoZGVsdGEgPj0gMCA/IDEgOiAtMSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZU5hbWUgPSBub2RlLl9uYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleXMgPSBub2RlLl9rZXlzO1xuXG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBpbnRlcnBvbGF0ZWQga2V5ZnJhbWUgZm9yIHRoaXMgYW5pbWF0ZWQgbm9kZVxuICAgICAgICAgICAgICAgIGNvbnN0IGludGVycEtleSA9IHRoaXMuX2ludGVycG9sYXRlZEtleURpY3Rbbm9kZU5hbWVdO1xuICAgICAgICAgICAgICAgIGlmIChpbnRlcnBLZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKGBVbmtub3duIHNrZWxldG9uIG5vZGUgbmFtZTogJHtub2RlTmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgb25seSBhIHNpbmdsZSBrZXksIGp1c3QgY29weSB0aGUga2V5IHRvIHRoZSBpbnRlcnBvbGF0ZWQga2V5Li4uXG4gICAgICAgICAgICAgICAgbGV0IGZvdW5kS2V5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKGtleXMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgZmluZCB0aGUga2V5ZnJhbWUgcGFpciBmb3IgdGhpcyBub2RlXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGN1cnJLZXlJbmRleCA9IHRoaXMuX2N1cnJLZXlJbmRpY2VzW25vZGVOYW1lXTsgY3VycktleUluZGV4IDwga2V5cy5sZW5ndGggLSAxICYmIGN1cnJLZXlJbmRleCA+PSAwOyBjdXJyS2V5SW5kZXggKz0gb2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrMSA9IGtleXNbY3VycktleUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGsyID0ga2V5c1tjdXJyS2V5SW5kZXggKyAxXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChrMS50aW1lIDw9IHRoaXMuX3RpbWUpICYmIChrMi50aW1lID49IHRoaXMuX3RpbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxwaGEgPSAodGhpcy5fdGltZSAtIGsxLnRpbWUpIC8gKGsyLnRpbWUgLSBrMS50aW1lKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludGVycEtleS5fcG9zLmxlcnAoazEucG9zaXRpb24sIGsyLnBvc2l0aW9uLCBhbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJwS2V5Ll9xdWF0LnNsZXJwKGsxLnJvdGF0aW9uLCBrMi5yb3RhdGlvbiwgYWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludGVycEtleS5fc2NhbGUubGVycChrMS5zY2FsZSwgazIuc2NhbGUsIGFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlcnBLZXkuX3dyaXR0ZW4gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3VycktleUluZGljZXNbbm9kZU5hbWVdID0gY3VycktleUluZGV4O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kS2V5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPT09IDEgfHwgKCFmb3VuZEtleSAmJiB0aGlzLl90aW1lID09PSAwLjAgJiYgdGhpcy5sb29waW5nKSkge1xuICAgICAgICAgICAgICAgICAgICBpbnRlcnBLZXkuX3Bvcy5jb3B5KGtleXNbMF0ucG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICBpbnRlcnBLZXkuX3F1YXQuY29weShrZXlzWzBdLnJvdGF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgaW50ZXJwS2V5Ll9zY2FsZS5jb3B5KGtleXNbMF0uc2NhbGUpO1xuICAgICAgICAgICAgICAgICAgICBpbnRlcnBLZXkuX3dyaXR0ZW4gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJsZW5kcyB0d28gc2tlbGV0b25zIHRvZ2V0aGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTa2VsZXRvbn0gc2tlbDEgLSBTa2VsZXRvbiBob2xkaW5nIHRoZSBmaXJzdCBwb3NlIHRvIGJlIGJsZW5kZWQuXG4gICAgICogQHBhcmFtIHtTa2VsZXRvbn0gc2tlbDIgLSBTa2VsZXRvbiBob2xkaW5nIHRoZSBzZWNvbmQgcG9zZSB0byBiZSBibGVuZGVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgaW50ZXJwb2xhdGlvbiBpbiByZWxhdGlvbiB0byB0aGUgdHdvIGlucHV0XG4gICAgICogc2tlbGV0b25zLiBUaGUgdmFsdWUgaXMgaW4gdGhlIHJhbmdlIDAgdG8gMSwgMCBnZW5lcmF0aW5nIHNrZWwxLCAxIGdlbmVyYXRpbmcgc2tlbDIgYW5kXG4gICAgICogYW55dGhpbmcgaW4gYmV0d2VlbiBnZW5lcmF0aW5nIGEgc3BoZXJpY2FsIGludGVycG9sYXRpb24gYmV0d2VlbiB0aGUgdHdvLlxuICAgICAqL1xuICAgIGJsZW5kKHNrZWwxLCBza2VsMiwgYWxwaGEpIHtcbiAgICAgICAgY29uc3QgbnVtTm9kZXMgPSB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ob2RlczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBrZXkxID0gc2tlbDEuX2ludGVycG9sYXRlZEtleXNbaV07XG4gICAgICAgICAgICBjb25zdCBrZXkyID0gc2tlbDIuX2ludGVycG9sYXRlZEtleXNbaV07XG4gICAgICAgICAgICBjb25zdCBkc3RLZXkgPSB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzW2ldO1xuXG4gICAgICAgICAgICBpZiAoa2V5MS5fd3JpdHRlbiAmJiBrZXkyLl93cml0dGVuKSB7XG4gICAgICAgICAgICAgICAgZHN0S2V5Ll9xdWF0LnNsZXJwKGtleTEuX3F1YXQsIHNrZWwyLl9pbnRlcnBvbGF0ZWRLZXlzW2ldLl9xdWF0LCBhbHBoYSk7XG4gICAgICAgICAgICAgICAgZHN0S2V5Ll9wb3MubGVycChrZXkxLl9wb3MsIHNrZWwyLl9pbnRlcnBvbGF0ZWRLZXlzW2ldLl9wb3MsIGFscGhhKTtcbiAgICAgICAgICAgICAgICBkc3RLZXkuX3NjYWxlLmxlcnAoa2V5MS5fc2NhbGUsIGtleTIuX3NjYWxlLCBhbHBoYSk7XG4gICAgICAgICAgICAgICAgZHN0S2V5Ll93cml0dGVuID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5MS5fd3JpdHRlbikge1xuICAgICAgICAgICAgICAgIGRzdEtleS5fcXVhdC5jb3B5KGtleTEuX3F1YXQpO1xuICAgICAgICAgICAgICAgIGRzdEtleS5fcG9zLmNvcHkoa2V5MS5fcG9zKTtcbiAgICAgICAgICAgICAgICBkc3RLZXkuX3NjYWxlLmNvcHkoa2V5MS5fc2NhbGUpO1xuICAgICAgICAgICAgICAgIGRzdEtleS5fd3JpdHRlbiA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleTIuX3dyaXR0ZW4pIHtcbiAgICAgICAgICAgICAgICBkc3RLZXkuX3F1YXQuY29weShrZXkyLl9xdWF0KTtcbiAgICAgICAgICAgICAgICBkc3RLZXkuX3Bvcy5jb3B5KGtleTIuX3Bvcyk7XG4gICAgICAgICAgICAgICAgZHN0S2V5Ll9zY2FsZS5jb3B5KGtleTIuX3NjYWxlKTtcbiAgICAgICAgICAgICAgICBkc3RLZXkuX3dyaXR0ZW4gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlua3MgYSBza2VsZXRvbiB0byBhIG5vZGUgaGllcmFyY2h5LiBUaGUgbm9kZXMgYW5pbWF0ZWQgc2tlbGV0b24gYXJlIHRoZW4gc3Vic2VxdWVudGx5IHVzZWRcbiAgICAgKiB0byBkcml2ZSB0aGUgbG9jYWwgdHJhbnNmb3JtYXRpb24gbWF0cmljZXMgb2YgdGhlIG5vZGUgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2dyYXBoLW5vZGUuanMnKS5HcmFwaE5vZGV9IGdyYXBoIC0gVGhlIHJvb3Qgbm9kZSBvZiB0aGUgZ3JhcGggdGhhdCB0aGVcbiAgICAgKiBza2VsZXRvbiBpcyB0byBkcml2ZS5cbiAgICAgKi9cbiAgICBzZXRHcmFwaChncmFwaCkge1xuICAgICAgICB0aGlzLmdyYXBoID0gZ3JhcGg7XG5cbiAgICAgICAgaWYgKGdyYXBoKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2ludGVycG9sYXRlZEtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnRlcnBLZXkgPSB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGdyYXBoTm9kZSA9IGdyYXBoLmZpbmRCeU5hbWUoaW50ZXJwS2V5Ll9uYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzW2ldLnNldFRhcmdldChncmFwaE5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJwb2xhdGVkS2V5c1tpXS5zZXRUYXJnZXQobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTeW5jaHJvbml6ZXMgdGhlIGN1cnJlbnRseSBsaW5rZWQgbm9kZSBoaWVyYXJjaHkgd2l0aCB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgc2tlbGV0b24uXG4gICAgICogSW50ZXJuYWxseSwgdGhpcyBmdW5jdGlvbiBjb252ZXJ0cyB0aGUgaW50ZXJwb2xhdGVkIGtleWZyYW1lIGF0IGVhY2ggbm9kZSBpbiB0aGUgc2tlbGV0b25cbiAgICAgKiBpbnRvIHRoZSBsb2NhbCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggYXQgZWFjaCBjb3JyZXNwb25kaW5nIG5vZGUgaW4gdGhlIGxpbmtlZCBub2RlXG4gICAgICogaGllcmFyY2h5LlxuICAgICAqL1xuICAgIHVwZGF0ZUdyYXBoKCkge1xuICAgICAgICBpZiAodGhpcy5ncmFwaCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbnRlcnBvbGF0ZWRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW50ZXJwS2V5ID0gdGhpcy5faW50ZXJwb2xhdGVkS2V5c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJwS2V5Ll93cml0dGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybSA9IGludGVycEtleS5nZXRUYXJnZXQoKTtcblxuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm0ubG9jYWxQb3NpdGlvbi5jb3B5KGludGVycEtleS5fcG9zKTtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLmxvY2FsUm90YXRpb24uY29weShpbnRlcnBLZXkuX3F1YXQpO1xuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm0ubG9jYWxTY2FsZS5jb3B5KGludGVycEtleS5fc2NhbGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghdHJhbnNmb3JtLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLl9kaXJ0aWZ5TG9jYWwoKTtcblxuICAgICAgICAgICAgICAgICAgICBpbnRlcnBLZXkuX3dyaXR0ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IFNrZWxldG9uIH07XG4iXSwibmFtZXMiOlsiSW50ZXJwb2xhdGVkS2V5IiwiY29uc3RydWN0b3IiLCJfd3JpdHRlbiIsIl9uYW1lIiwiX2tleUZyYW1lcyIsIl9xdWF0IiwiUXVhdCIsIl9wb3MiLCJWZWMzIiwiX3NjYWxlIiwiX3RhcmdldE5vZGUiLCJnZXRUYXJnZXQiLCJzZXRUYXJnZXQiLCJub2RlIiwiU2tlbGV0b24iLCJncmFwaCIsImxvb3BpbmciLCJfYW5pbWF0aW9uIiwiX3RpbWUiLCJfaW50ZXJwb2xhdGVkS2V5cyIsIl9pbnRlcnBvbGF0ZWRLZXlEaWN0IiwiX2N1cnJLZXlJbmRpY2VzIiwiYWRkSW50ZXJwb2xhdGVkS2V5cyIsImludGVycEtleSIsIm5hbWUiLCJwdXNoIiwiaSIsIl9jaGlsZHJlbiIsImxlbmd0aCIsImFuaW1hdGlvbiIsInZhbHVlIiwiY3VycmVudFRpbWUiLCJudW1Ob2RlcyIsIm5vZGVOYW1lIiwiYWRkVGltZSIsInVwZGF0ZUdyYXBoIiwiZGVsdGEiLCJub2RlcyIsIl9ub2RlcyIsImR1cmF0aW9uIiwiX2tleXMiLCJvZmZzZXQiLCJrZXlzIiwidW5kZWZpbmVkIiwiRGVidWciLCJ3YXJuIiwiZm91bmRLZXkiLCJjdXJyS2V5SW5kZXgiLCJrMSIsImsyIiwidGltZSIsImFscGhhIiwibGVycCIsInBvc2l0aW9uIiwic2xlcnAiLCJyb3RhdGlvbiIsInNjYWxlIiwiY29weSIsImJsZW5kIiwic2tlbDEiLCJza2VsMiIsImtleTEiLCJrZXkyIiwiZHN0S2V5Iiwic2V0R3JhcGgiLCJncmFwaE5vZGUiLCJmaW5kQnlOYW1lIiwidHJhbnNmb3JtIiwibG9jYWxQb3NpdGlvbiIsImxvY2FsUm90YXRpb24iLCJsb2NhbFNjYWxlIiwiX2RpcnR5TG9jYWwiLCJfZGlydGlmeUxvY2FsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFJQSxNQUFNQSxlQUFlLENBQUM7QUFDbEJDLEVBQUFBLFdBQVcsR0FBRztJQUNWLElBQUksQ0FBQ0MsUUFBUSxHQUFHLEtBQUssQ0FBQTtJQUNyQixJQUFJLENBQUNDLEtBQUssR0FBRyxFQUFFLENBQUE7SUFDZixJQUFJLENBQUNDLFVBQVUsR0FBRyxFQUFFLENBQUE7O0FBRXBCO0FBQ0EsSUFBQSxJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN2QixJQUFBLElBQUksQ0FBQ0MsSUFBSSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3RCLElBQUEsSUFBSSxDQUFDQyxNQUFNLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7O0FBRXhCO0lBQ0EsSUFBSSxDQUFDRSxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQzNCLEdBQUE7QUFFQUMsRUFBQUEs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
