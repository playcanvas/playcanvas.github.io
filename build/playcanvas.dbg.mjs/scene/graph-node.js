/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';
import { Debug } from '../core/debug.js';
import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

const scaleCompensatePosTransform = new Mat4();
const scaleCompensatePos = new Vec3();
const scaleCompensateRot = new Quat();
const scaleCompensateRot2 = new Quat();
const scaleCompensateScale = new Vec3();
const scaleCompensateScaleForParent = new Vec3();
const tmpMat4 = new Mat4();
const tmpQuat = new Quat();
const position = new Vec3();
const invParentWtm = new Mat4();
const rotation = new Quat();
const invParentRot = new Quat();
const matrix = new Mat4();
const target = new Vec3();
const up = new Vec3();

class GraphNode extends EventHandler {
  constructor(name = 'Untitled') {
    super();
    this.name = name;
    this.tags = new Tags(this);
    this._labels = {};
    this.localPosition = new Vec3();
    this.localRotation = new Quat();
    this.localScale = new Vec3(1, 1, 1);
    this.localEulerAngles = new Vec3();
    this.position = new Vec3();
    this.rotation = new Quat();
    this.eulerAngles = new Vec3();
    this._scale = null;
    this.localTransform = new Mat4();
    this._dirtyLocal = false;
    this._aabbVer = 0;
    this._frozen = false;
    this.worldTransform = new Mat4();
    this._dirtyWorld = false;
    this._normalMatrix = new Mat3();
    this._dirtyNormal = true;
    this._right = null;
    this._up = null;
    this._forward = null;
    this._parent = null;
    this._children = [];
    this._graphDepth = 0;
    this._enabled = true;
    this._enabledInHierarchy = false;
    this.scaleCompensation = false;
  }

  get right() {
    if (!this._right) {
      this._right = new Vec3();
    }

    return this.getWorldTransform().getX(this._right).normalize();
  }

  get up() {
    if (!this._up) {
      this._up = new Vec3();
    }

    return this.getWorldTransform().getY(this._up).normalize();
  }

  get forward() {
    if (!this._forward) {
      this._forward = new Vec3();
    }

    return this.getWorldTransform().getZ(this._forward).normalize().mulScalar(-1);
  }

  get normalMatrix() {
    const normalMat = this._normalMatrix;

    if (this._dirtyNormal) {
      this.getWorldTransform().invertTo3x3(normalMat);
      normalMat.transpose();
      this._dirtyNormal = false;
    }

    return normalMat;
  }

  set enabled(enabled) {
    if (this._enabled !== enabled) {
      var _this$_parent;

      this._enabled = enabled;

      if (enabled && (_this$_parent = this._parent) != null && _this$_parent.enabled || !enabled) {
        this._notifyHierarchyStateChanged(this, enabled);
      }
    }
  }

  get enabled() {
    return this._enabled && this._enabledInHierarchy;
  }

  get parent() {
    return this._parent;
  }

  get path() {
    let node = this._parent;

    if (!node) {
      return '';
    }

    let result = this.name;

    while (node && node._parent) {
      result = `${node.name}/${result}`;
      node = node._parent;
    }

    return result;
  }

  get root() {
    let result = this;

    while (result._parent) {
      result = result._parent;
    }

    return result;
  }

  get children() {
    return this._children;
  }

  get graphDepth() {
    return this._graphDepth;
  }

  _notifyHierarchyStateChanged(node, enabled) {
    node._onHierarchyStateChanged(enabled);

    const c = node._children;

    for (let i = 0, len = c.length; i < len; i++) {
      if (c[i]._enabled) this._notifyHierarchyStateChanged(c[i], enabled);
    }
  }

  _onHierarchyStateChanged(enabled) {
    this._enabledInHierarchy = enabled;
    if (enabled && !this._frozen) this._unfreezeParentToRoot();
  }

  _cloneInternal(clone) {
    clone.name = this.name;
    const tags = this.tags._list;
    clone.tags.clear();

    for (let i = 0; i < tags.length; i++) clone.tags.add(tags[i]);

    clone._labels = Object.assign({}, this._labels);
    clone.localPosition.copy(this.localPosition);
    clone.localRotation.copy(this.localRotation);
    clone.localScale.copy(this.localScale);
    clone.localEulerAngles.copy(this.localEulerAngles);
    clone.position.copy(this.position);
    clone.rotation.copy(this.rotation);
    clone.eulerAngles.copy(this.eulerAngles);
    clone.localTransform.copy(this.localTransform);
    clone._dirtyLocal = this._dirtyLocal;
    clone.worldTransform.copy(this.worldTransform);
    clone._dirtyWorld = this._dirtyWorld;
    clone._dirtyNormal = this._dirtyNormal;
    clone._aabbVer = this._aabbVer + 1;
    clone._enabled = this._enabled;
    clone.scaleCompensation = this.scaleCompensation;
    clone._enabledInHierarchy = false;
  }

  clone() {
    const clone = new this.constructor();

    this._cloneInternal(clone);

    return clone;
  }

  copy(source) {
    source._cloneInternal(this);

    return this;
  }

  find(attr, value) {
    let result,
        results = [];
    const len = this._children.length;

    if (attr instanceof Function) {
      const fn = attr;
      result = fn(this);
      if (result) results.push(this);

      for (let i = 0; i < len; i++) {
        const descendants = this._children[i].find(fn);

        if (descendants.length) results = results.concat(descendants);
      }
    } else {
      let testValue;

      if (this[attr]) {
        if (this[attr] instanceof Function) {
          testValue = this[attr]();
        } else {
          testValue = this[attr];
        }

        if (testValue === value) results.push(this);
      }

      for (let i = 0; i < len; ++i) {
        const descendants = this._children[i].find(attr, value);

        if (descendants.length) results = results.concat(descendants);
      }
    }

    return results;
  }

  findOne(attr, value) {
    const len = this._children.length;
    let result = null;

    if (attr instanceof Function) {
      const fn = attr;
      result = fn(this);
      if (result) return this;

      for (let i = 0; i < len; i++) {
        result = this._children[i].findOne(fn);
        if (result) return result;
      }
    } else {
      let testValue;

      if (this[attr]) {
        if (this[attr] instanceof Function) {
          testValue = this[attr]();
        } else {
          testValue = this[attr];
        }

        if (testValue === value) {
          return this;
        }
      }

      for (let i = 0; i < len; i++) {
        result = this._children[i].findOne(attr, value);
        if (result !== null) return result;
      }
    }

    return null;
  }

  findByTag() {
    const query = arguments;
    const results = [];

    const queryNode = (node, checkNode) => {
      if (checkNode && node.tags.has(...query)) {
        results.push(node);
      }

      for (let i = 0; i < node._children.length; i++) {
        queryNode(node._children[i], true);
      }
    };

    queryNode(this, false);
    return results;
  }

  findByName(name) {
    if (this.name === name) return this;

    for (let i = 0; i < this._children.length; i++) {
      const found = this._children[i].findByName(name);

      if (found !== null) return found;
    }

    return null;
  }

  findByPath(path) {
    const parts = Array.isArray(path) ? path : path.split('/');
    let result = this;

    for (let i = 0, imax = parts.length; i < imax; ++i) {
      result = result.children.find(c => c.name === parts[i]);

      if (!result) {
        return null;
      }
    }

    return result;
  }

  forEach(callback, thisArg) {
    callback.call(thisArg, this);
    const children = this._children;

    for (let i = 0; i < children.length; i++) {
      children[i].forEach(callback, thisArg);
    }
  }

  isDescendantOf(node) {
    let parent = this._parent;

    while (parent) {
      if (parent === node) return true;
      parent = parent._parent;
    }

    return false;
  }

  isAncestorOf(node) {
    return node.isDescendantOf(this);
  }

  getEulerAngles() {
    this.getWorldTransform().getEulerAngles(this.eulerAngles);
    return this.eulerAngles;
  }

  getLocalEulerAngles() {
    this.localRotation.getEulerAngles(this.localEulerAngles);
    return this.localEulerAngles;
  }

  getLocalPosition() {
    return this.localPosition;
  }

  getLocalRotation() {
    return this.localRotation;
  }

  getLocalScale() {
    return this.localScale;
  }

  getLocalTransform() {
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this._dirtyLocal = false;
    }

    return this.localTransform;
  }

  getPosition() {
    this.getWorldTransform().getTranslation(this.position);
    return this.position;
  }

  getRotation() {
    this.rotation.setFromMat4(this.getWorldTransform());
    return this.rotation;
  }

  getScale() {
    if (!this._scale) {
      this._scale = new Vec3();
    }

    return this.getWorldTransform().getScale(this._scale);
  }

  getWorldTransform() {
    if (!this._dirtyLocal && !this._dirtyWorld) return this.worldTransform;
    if (this._parent) this._parent.getWorldTransform();

    this._sync();

    return this.worldTransform;
  }

  reparent(parent, index) {
    const current = this._parent;
    if (current) current.removeChild(this);

    if (parent) {
      if (index >= 0) {
        parent.insertChild(this, index);
      } else {
        parent.addChild(this);
      }
    }
  }

  setLocalEulerAngles(x, y, z) {
    this.localRotation.setFromEulerAngles(x, y, z);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  setLocalPosition(x, y, z) {
    if (x instanceof Vec3) {
      this.localPosition.copy(x);
    } else {
      this.localPosition.set(x, y, z);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  setLocalRotation(x, y, z, w) {
    if (x instanceof Quat) {
      this.localRotation.copy(x);
    } else {
      this.localRotation.set(x, y, z, w);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  setLocalScale(x, y, z) {
    if (x instanceof Vec3) {
      this.localScale.copy(x);
    } else {
      this.localScale.set(x, y, z);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  _dirtifyLocal() {
    if (!this._dirtyLocal) {
      this._dirtyLocal = true;
      if (!this._dirtyWorld) this._dirtifyWorld();
    }
  }

  _unfreezeParentToRoot() {
    let p = this._parent;

    while (p) {
      p._frozen = false;
      p = p._parent;
    }
  }

  _dirtifyWorld() {
    if (!this._dirtyWorld) this._unfreezeParentToRoot();

    this._dirtifyWorldInternal();
  }

  _dirtifyWorldInternal() {
    if (!this._dirtyWorld) {
      this._frozen = false;
      this._dirtyWorld = true;

      for (let i = 0; i < this._children.length; i++) {
        if (!this._children[i]._dirtyWorld) this._children[i]._dirtifyWorldInternal();
      }
    }

    this._dirtyNormal = true;
    this._aabbVer++;
  }

  setPosition(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }

    if (this._parent === null) {
      this.localPosition.copy(position);
    } else {
      invParentWtm.copy(this._parent.getWorldTransform()).invert();
      invParentWtm.transformPoint(position, this.localPosition);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  setRotation(x, y, z, w) {
    if (x instanceof Quat) {
      rotation.copy(x);
    } else {
      rotation.set(x, y, z, w);
    }

    if (this._parent === null) {
      this.localRotation.copy(rotation);
    } else {
      const parentRot = this._parent.getRotation();

      invParentRot.copy(parentRot).invert();
      this.localRotation.copy(invParentRot).mul(rotation);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  setEulerAngles(x, y, z) {
    this.localRotation.setFromEulerAngles(x, y, z);

    if (this._parent !== null) {
      const parentRot = this._parent.getRotation();

      invParentRot.copy(parentRot).invert();
      this.localRotation.mul2(invParentRot, this.localRotation);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  addChild(node) {
    this._prepareInsertChild(node);

    this._children.push(node);

    this._onInsertChild(node);
  }

  addChildAndSaveTransform(node) {
    const wPos = node.getPosition();
    const wRot = node.getRotation();

    this._prepareInsertChild(node);

    node.setPosition(tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
    node.setRotation(tmpQuat.copy(this.getRotation()).invert().mul(wRot));

    this._children.push(node);

    this._onInsertChild(node);
  }

  insertChild(node, index) {
    this._prepareInsertChild(node);

    this._children.splice(index, 0, node);

    this._onInsertChild(node);
  }

  _prepareInsertChild(node) {
    if (node._parent) {
      node._parent.removeChild(node);
    }

    Debug.assert(node !== this, `GraphNode ${node == null ? void 0 : node.name} cannot be a child of itself`);
    Debug.assert(!this.isDescendantOf(node), `GraphNode ${node == null ? void 0 : node.name} cannot add an ancestor as a child`);
  }

  _fireOnHierarchy(name, nameHierarchy, parent) {
    this.fire(name, parent);

    for (let i = 0; i < this._children.length; i++) {
      this._children[i]._fireOnHierarchy(nameHierarchy, nameHierarchy, parent);
    }
  }

  _onInsertChild(node) {
    node._parent = this;
    const enabledInHierarchy = node._enabled && this.enabled;

    if (node._enabledInHierarchy !== enabledInHierarchy) {
      node._enabledInHierarchy = enabledInHierarchy;

      node._notifyHierarchyStateChanged(node, enabledInHierarchy);
    }

    node._updateGraphDepth();

    node._dirtifyWorld();

    if (this._frozen) node._unfreezeParentToRoot();

    node._fireOnHierarchy('insert', 'inserthierarchy', this);

    if (this.fire) this.fire('childinsert', node);
  }

  _updateGraphDepth() {
    this._graphDepth = this._parent ? this._parent._graphDepth + 1 : 0;

    for (let i = 0, len = this._children.length; i < len; i++) {
      this._children[i]._updateGraphDepth();
    }
  }

  removeChild(child) {
    const index = this._children.indexOf(child);

    if (index === -1) {
      return;
    }

    this._children.splice(index, 1);

    child._parent = null;

    child._fireOnHierarchy('remove', 'removehierarchy', this);

    this.fire('childremove', child);
  }

  _sync() {
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this._dirtyLocal = false;
    }

    if (this._dirtyWorld) {
      if (this._parent === null) {
        this.worldTransform.copy(this.localTransform);
      } else {
        if (this.scaleCompensation) {
          let parentWorldScale;
          const parent = this._parent;
          let scale = this.localScale;
          let parentToUseScaleFrom = parent;

          if (parentToUseScaleFrom) {
            while (parentToUseScaleFrom && parentToUseScaleFrom.scaleCompensation) {
              parentToUseScaleFrom = parentToUseScaleFrom._parent;
            }

            if (parentToUseScaleFrom) {
              parentToUseScaleFrom = parentToUseScaleFrom._parent;

              if (parentToUseScaleFrom) {
                parentWorldScale = parentToUseScaleFrom.worldTransform.getScale();
                scaleCompensateScale.mul2(parentWorldScale, this.localScale);
                scale = scaleCompensateScale;
              }
            }
          }

          scaleCompensateRot2.setFromMat4(parent.worldTransform);
          scaleCompensateRot.mul2(scaleCompensateRot2, this.localRotation);
          let tmatrix = parent.worldTransform;

          if (parent.scaleCompensation) {
            scaleCompensateScaleForParent.mul2(parentWorldScale, parent.getLocalScale());
            scaleCompensatePosTransform.setTRS(parent.worldTransform.getTranslation(scaleCompensatePos), scaleCompensateRot2, scaleCompensateScaleForParent);
            tmatrix = scaleCompensatePosTransform;
          }

          tmatrix.transformPoint(this.localPosition, scaleCompensatePos);
          this.worldTransform.setTRS(scaleCompensatePos, scaleCompensateRot, scale);
        } else {
          this.worldTransform.mulAffine2(this._parent.worldTransform, this.localTransform);
        }
      }

      this._dirtyWorld = false;
    }
  }

  syncHierarchy() {
    if (!this._enabled) return;
    if (this._frozen) return;
    this._frozen = true;

    if (this._dirtyLocal || this._dirtyWorld) {
      this._sync();
    }

    const children = this._children;

    for (let i = 0, len = children.length; i < len; i++) {
      children[i].syncHierarchy();
    }
  }

  lookAt(x, y, z, ux = 0, uy = 1, uz = 0) {
    if (x instanceof Vec3) {
      target.copy(x);

      if (y instanceof Vec3) {
        up.copy(y);
      } else {
        up.copy(Vec3.UP);
      }
    } else if (z === undefined) {
      return;
    } else {
      target.set(x, y, z);
      up.set(ux, uy, uz);
    }

    matrix.setLookAt(this.getPosition(), target, up);
    rotation.setFromMat4(matrix);
    this.setRotation(rotation);
  }

  translate(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }

    position.add(this.getPosition());
    this.setPosition(position);
  }

  translateLocal(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }

    this.localRotation.transformVector(position, position);
    this.localPosition.add(position);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  rotate(x, y, z) {
    rotation.setFromEulerAngles(x, y, z);

    if (this._parent === null) {
      this.localRotation.mul2(rotation, this.localRotation);
    } else {
      const rot = this.getRotation();

      const parentRot = this._parent.getRotation();

      invParentRot.copy(parentRot).invert();
      rotation.mul2(invParentRot, rotation);
      this.localRotation.mul2(rotation, rot);
    }

    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  rotateLocal(x, y, z) {
    rotation.setFromEulerAngles(x, y, z);
    this.localRotation.mul(rotation);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

}

export { GraphNode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL21hdGgvbWF0My5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL21hdGgvdmVjMy5qcyc7XG5cbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVQb3MgPSBuZXcgVmVjMygpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90ID0gbmV3IFF1YXQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVJvdDIgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlU2NhbGUgPSBuZXcgVmVjMygpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQgPSBuZXcgVmVjMygpO1xuY29uc3QgdG1wTWF0NCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB0bXBRdWF0ID0gbmV3IFF1YXQoKTtcbmNvbnN0IHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbmNvbnN0IGludlBhcmVudFd0bSA9IG5ldyBNYXQ0KCk7XG5jb25zdCByb3RhdGlvbiA9IG5ldyBRdWF0KCk7XG5jb25zdCBpbnZQYXJlbnRSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3QgbWF0cml4ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRhcmdldCA9IG5ldyBWZWMzKCk7XG5jb25zdCB1cCA9IG5ldyBWZWMzKCk7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgR3JhcGhOb2RlI2ZpbmR9IGFuZCB7QGxpbmsgR3JhcGhOb2RlI2ZpbmRPbmV9IHRvIHNlYXJjaCB0aHJvdWdoIGEgZ3JhcGhcbiAqIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMuXG4gKlxuICogQGNhbGxiYWNrIEZpbmROb2RlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIGN1cnJlbnQgZ3JhcGggbm9kZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5pbmcgYHRydWVgIHdpbGwgcmVzdWx0IGluIHRoYXQgbm9kZSBiZWluZyByZXR1cm5lZCBmcm9tXG4gKiB7QGxpbmsgR3JhcGhOb2RlI2ZpbmR9IG9yIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0uXG4gKi9cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZm9yRWFjaH0gdG8gaXRlcmF0ZSB0aHJvdWdoIGEgZ3JhcGggbm9kZSBhbmQgYWxsIG9mIGl0c1xuICogZGVzY2VuZGFudHMuXG4gKlxuICogQGNhbGxiYWNrIEZvckVhY2hOb2RlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIGN1cnJlbnQgZ3JhcGggbm9kZS5cbiAqL1xuXG4vKipcbiAqIEEgaGllcmFyY2hpY2FsIHNjZW5lIG5vZGUuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBHcmFwaE5vZGUgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBHcmFwaE5vZGUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIC0gVGhlIG5vbi11bmlxdWUgbmFtZSBvZiBhIGdyYXBoIG5vZGUuIERlZmF1bHRzIHRvICdVbnRpdGxlZCcuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSA9ICdVbnRpdGxlZCcpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5vbi11bmlxdWUgbmFtZSBvZiBhIGdyYXBoIG5vZGUuIERlZmF1bHRzIHRvICdVbnRpdGxlZCcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbnRlcmZhY2UgZm9yIHRhZ2dpbmcgZ3JhcGggbm9kZXMuIFRhZyBiYXNlZCBzZWFyY2hlcyBjYW4gYmUgcGVyZm9ybWVkIHVzaW5nIHRoZVxuICAgICAgICAgKiB7QGxpbmsgR3JhcGhOb2RlI2ZpbmRCeVRhZ30gZnVuY3Rpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUYWdzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50YWdzID0gbmV3IFRhZ3ModGhpcyk7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX2xhYmVscyA9IHt9O1xuXG4gICAgICAgIC8vIExvY2FsLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtIChvbmx5IGZpcnN0IDMgYXJlIHNldHRhYmxlIGJ5IHRoZSB1c2VyKVxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbiA9IG5ldyBRdWF0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbFNjYWxlID0gbmV3IFZlYzMoMSwgMSwgMSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbEV1bGVyQW5nbGVzID0gbmV3IFZlYzMoKTsgLy8gT25seSBjYWxjdWxhdGVkIG9uIHJlcXVlc3RcblxuICAgICAgICAvLyBXb3JsZC1zcGFjZSBwcm9wZXJ0aWVzIG9mIHRyYW5zZm9ybVxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1F1YXR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmV1bGVyQW5nbGVzID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NjYWxlID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge01hdDR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9kaXJ0eUxvY2FsID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9hYWJiVmVyID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFya3MgdGhlIG5vZGUgdG8gaWdub3JlIGhpZXJhcmNoeSBzeW5jIGVudGlyZWx5IChpbmNsdWRpbmcgY2hpbGRyZW4gbm9kZXMpLiBUaGUgZW5naW5lXG4gICAgICAgICAqIGNvZGUgYXV0b21hdGljYWxseSBmcmVlemVzIGFuZCB1bmZyZWV6ZXMgb2JqZWN0cyB3aGVuZXZlciByZXF1aXJlZC4gU2VncmVnYXRpbmcgZHluYW1pY1xuICAgICAgICAgKiBhbmQgc3RhdGlvbmFyeSBub2RlcyBpbnRvIHN1YmhpZXJhcmNoaWVzIGFsbG93cyB0byByZWR1Y2Ugc3luYyB0aW1lIHNpZ25pZmljYW50bHkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZnJvemVuID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge01hdDN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9ub3JtYWxNYXRyaXggPSBuZXcgTWF0MygpO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9yaWdodCA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdXAgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZm9yd2FyZCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3BhcmVudCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHcmFwaE5vZGVbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9ncmFwaERlcHRoID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVwcmVzZW50cyBlbmFibGVkIHN0YXRlIG9mIHRoZSBlbnRpdHkuIElmIHRoZSBlbnRpdHkgaXMgZGlzYWJsZWQsIHRoZSBlbnRpdHkgaW5jbHVkaW5nXG4gICAgICAgICAqIGFsbCBjaGlsZHJlbiBhcmUgZXhjbHVkZWQgZnJvbSB1cGRhdGVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXByZXNlbnRzIGVuYWJsZWQgc3RhdGUgb2YgdGhlIGVudGl0eSBpbiB0aGUgaGllcmFyY2h5LiBJdCdzIHRydWUgb25seSBpZiB0aGlzIGVudGl0eVxuICAgICAgICAgKiBhbmQgYWxsIHBhcmVudCBlbnRpdGllcyBhbGwgdGhlIHdheSB0byB0aGUgc2NlbmUncyByb290IGFyZSBlbmFibGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY2FsZUNvbXBlbnNhdGlvbiA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBub3JtYWxpemVkIGxvY2FsIHNwYWNlIFgtYXhpcyB2ZWN0b3Igb2YgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBnZXQgcmlnaHQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3JpZ2h0ID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFgodGhpcy5fcmlnaHQpLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBub3JtYWxpemVkIGxvY2FsIHNwYWNlIFktYXhpcyB2ZWN0b3Igb2YgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBnZXQgdXAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fdXApIHtcbiAgICAgICAgICAgIHRoaXMuX3VwID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFkodGhpcy5fdXApLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBub3JtYWxpemVkIGxvY2FsIHNwYWNlIG5lZ2F0aXZlIFotYXhpcyB2ZWN0b3Igb2YgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBnZXQgZm9yd2FyZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9mb3J3YXJkKSB7XG4gICAgICAgICAgICB0aGlzLl9mb3J3YXJkID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFoodGhpcy5fZm9yd2FyZCkubm9ybWFsaXplKCkubXVsU2NhbGFyKC0xKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIG1hdHJpeCB1c2VkIHRvIHRyYW5zZm9ybSB0aGUgbm9ybWFsLlxuICAgICAqXG4gICAgICogQHR5cGUgIHtNYXQzfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgbm9ybWFsTWF0cml4KCkge1xuXG4gICAgICAgIGNvbnN0IG5vcm1hbE1hdCA9IHRoaXMuX25vcm1hbE1hdHJpeDtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5Tm9ybWFsKSB7XG4gICAgICAgICAgICB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuaW52ZXJ0VG8zeDMobm9ybWFsTWF0KTtcbiAgICAgICAgICAgIG5vcm1hbE1hdC50cmFuc3Bvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9ybWFsTWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSBvciBkaXNhYmxlIGEgR3JhcGhOb2RlLiBJZiBvbmUgb2YgdGhlIEdyYXBoTm9kZSdzIHBhcmVudHMgaXMgZGlzYWJsZWQgdGhlcmUgd2lsbCBiZVxuICAgICAqIG5vIG90aGVyIHNpZGUgZWZmZWN0cy4gSWYgYWxsIHRoZSBwYXJlbnRzIGFyZSBlbmFibGVkIHRoZW4gdGhlIG5ldyB2YWx1ZSB3aWxsIGFjdGl2YXRlIG9yXG4gICAgICogZGVhY3RpdmF0ZSBhbGwgdGhlIGVuYWJsZWQgY2hpbGRyZW4gb2YgdGhlIEdyYXBoTm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKGVuYWJsZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IGVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXG4gICAgICAgICAgICAvLyBpZiBlbmFibGluZyBlbnRpdHksIG1ha2UgYWxsIGNoaWxkcmVuIGVuYWJsZWQgaW4gaGllcmFyY2h5IG9ubHkgd2hlbiB0aGUgcGFyZW50IGlzIGFzIHdlbGxcbiAgICAgICAgICAgIC8vIGlmIGRpc2FibGluZyBlbnRpdHksIG1ha2UgYWxsIGNoaWxkcmVuIGRpc2FibGVkIGluIGhpZXJhcmNoeSBpbiBhbGwgY2FzZXNcbiAgICAgICAgICAgIGlmIChlbmFibGVkICYmIHRoaXMuX3BhcmVudD8uZW5hYmxlZCB8fCAhZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCh0aGlzLCBlbmFibGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICAvLyBtYWtlIHN1cmUgdG8gY2hlY2sgdGhpcy5fZW5hYmxlZCB0b28gYmVjYXVzZSBpZiB0aGF0XG4gICAgICAgIC8vIHdhcyBmYWxzZSB3aGVuIGEgcGFyZW50IHdhcyB1cGRhdGVkIHRoZSBfZW5hYmxlZEluSGllcmFyY2h5XG4gICAgICAgIC8vIGZsYWcgbWF5IG5vdCBoYXZlIGJlZW4gdXBkYXRlZCBmb3Igb3B0aW1pemF0aW9uIHB1cnBvc2VzXG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkICYmIHRoaXMuX2VuYWJsZWRJbkhpZXJhcmNoeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgYSBwYXJlbnQgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgcGFyZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgcGF0aCBvZiB0aGUgZ3JhcGggbm9kZSByZWxhdGl2ZSB0byB0aGUgcm9vdCBvZiB0aGUgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgICAgbGV0IG5vZGUgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMubmFtZTtcbiAgICAgICAgd2hpbGUgKG5vZGUgJiYgbm9kZS5fcGFyZW50KSB7XG4gICAgICAgICAgICByZXN1bHQgPSBgJHtub2RlLm5hbWV9LyR7cmVzdWx0fWA7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IGhpZ2hlc3QgZ3JhcGggbm9kZSBmcm9tIGN1cnJlbnQgbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV9XG4gICAgICovXG4gICAgZ2V0IHJvb3QoKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzO1xuICAgICAgICB3aGlsZSAocmVzdWx0Ll9wYXJlbnQpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBjaGlsZHJlbiBvZiB0aGlzIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlW119XG4gICAgICovXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2hpbGRyZW47XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBkZXB0aCBvZiB0aGlzIGNoaWxkIHdpdGhpbiB0aGUgZ3JhcGguIE5vdGUgdGhhdCBmb3JcbiAgICAgKiBwZXJmb3JtYW5jZSByZWFzb25zIHRoaXMgaXMgb25seSByZWNhbGN1bGF0ZWQgd2hlbiBhIG5vZGUgaXMgYWRkZWQgdG8gYSBuZXcgcGFyZW50LCBpLmUuIEl0XG4gICAgICogaXMgbm90IHJlY2FsY3VsYXRlZCB3aGVuIGEgbm9kZSBpcyBzaW1wbHkgcmVtb3ZlZCBmcm9tIHRoZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGdyYXBoRGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncmFwaERlcHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gR3JhcGggbm9kZSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gVHJ1ZSBpZiBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHksIGZhbHNlIGlmIGRpc2FibGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkKSB7XG4gICAgICAgIG5vZGUuX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkKGVuYWJsZWQpO1xuXG4gICAgICAgIGNvbnN0IGMgPSBub2RlLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjW2ldLl9lbmFibGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjW2ldLCBlbmFibGVkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBlbmFibGVkIGZsYWcgb2YgdGhlIGVudGl0eSBvciBvbmUgb2YgaXRzIHBhcmVudHMgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5LCBmYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKSB7XG4gICAgICAgIC8vIE92ZXJyaWRlIGluIGRlcml2ZWQgY2xhc3Nlc1xuICAgICAgICB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBlbmFibGVkO1xuICAgICAgICBpZiAoZW5hYmxlZCAmJiAhdGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgdGhpcy5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3RoaXN9IGNsb25lIC0gVGhlIGNsb25lZCBncmFwaCBub2RlIHRvIGNvcHkgaW50by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbG9uZUludGVybmFsKGNsb25lKSB7XG4gICAgICAgIGNsb25lLm5hbWUgPSB0aGlzLm5hbWU7XG5cbiAgICAgICAgY29uc3QgdGFncyA9IHRoaXMudGFncy5fbGlzdDtcbiAgICAgICAgY2xvbmUudGFncy5jbGVhcigpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhZ3MubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBjbG9uZS50YWdzLmFkZCh0YWdzW2ldKTtcblxuICAgICAgICBjbG9uZS5fbGFiZWxzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fbGFiZWxzKTtcblxuICAgICAgICBjbG9uZS5sb2NhbFBvc2l0aW9uLmNvcHkodGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgY2xvbmUubG9jYWxSb3RhdGlvbi5jb3B5KHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIGNsb25lLmxvY2FsU2NhbGUuY29weSh0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICBjbG9uZS5sb2NhbEV1bGVyQW5nbGVzLmNvcHkodGhpcy5sb2NhbEV1bGVyQW5nbGVzKTtcblxuICAgICAgICBjbG9uZS5wb3NpdGlvbi5jb3B5KHRoaXMucG9zaXRpb24pO1xuICAgICAgICBjbG9uZS5yb3RhdGlvbi5jb3B5KHRoaXMucm90YXRpb24pO1xuICAgICAgICBjbG9uZS5ldWxlckFuZ2xlcy5jb3B5KHRoaXMuZXVsZXJBbmdsZXMpO1xuXG4gICAgICAgIGNsb25lLmxvY2FsVHJhbnNmb3JtLmNvcHkodGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgIGNsb25lLl9kaXJ0eUxvY2FsID0gdGhpcy5fZGlydHlMb2NhbDtcblxuICAgICAgICBjbG9uZS53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMud29ybGRUcmFuc2Zvcm0pO1xuICAgICAgICBjbG9uZS5fZGlydHlXb3JsZCA9IHRoaXMuX2RpcnR5V29ybGQ7XG4gICAgICAgIGNsb25lLl9kaXJ0eU5vcm1hbCA9IHRoaXMuX2RpcnR5Tm9ybWFsO1xuICAgICAgICBjbG9uZS5fYWFiYlZlciA9IHRoaXMuX2FhYmJWZXIgKyAxO1xuXG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICBjbG9uZS5zY2FsZUNvbXBlbnNhdGlvbiA9IHRoaXMuc2NhbGVDb21wZW5zYXRpb247XG5cbiAgICAgICAgLy8gZmFsc2UgYXMgdGhpcyBub2RlIGlzIG5vdCBpbiB0aGUgaGllcmFyY2h5IHlldFxuICAgICAgICBjbG9uZS5fZW5hYmxlZEluSGllcmFyY2h5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgYSBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgY2xvbmUgb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBjbG9uZSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgIHRoaXMuX2Nsb25lSW50ZXJuYWwoY2xvbmUpO1xuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29weSBhIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gc291cmNlIC0gVGhlIGdyYXBoIG5vZGUgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfSBUaGUgZGVzdGluYXRpb24gZ3JhcGggbm9kZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgc291cmNlLl9jbG9uZUludGVybmFsKHRoaXMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBub2RlcyB0aGF0IHNhdGlzZnkgc29tZSBzZWFyY2hcbiAgICAgKiBjcml0ZXJpYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmluZE5vZGVDYWxsYmFja3xzdHJpbmd9IGF0dHIgLSBUaGlzIGNhbiBlaXRoZXIgYmUgYSBmdW5jdGlvbiBvciBhIHN0cmluZy4gSWYgaXQncyBhXG4gICAgICogZnVuY3Rpb24sIGl0IGlzIGV4ZWN1dGVkIGZvciBlYWNoIGRlc2NlbmRhbnQgbm9kZSB0byB0ZXN0IGlmIG5vZGUgc2F0aXNmaWVzIHRoZSBzZWFyY2hcbiAgICAgKiBsb2dpYy4gUmV0dXJuaW5nIHRydWUgZnJvbSB0aGUgZnVuY3Rpb24gd2lsbCBpbmNsdWRlIHRoZSBub2RlIGludG8gdGhlIHJlc3VsdHMuIElmIGl0J3MgYVxuICAgICAqIHN0cmluZyB0aGVuIGl0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBmaWVsZCBvciBhIG1ldGhvZCBvZiB0aGUgbm9kZS4gSWYgdGhpcyBpcyB0aGUgbmFtZVxuICAgICAqIG9mIGEgZmllbGQgdGhlbiB0aGUgdmFsdWUgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgd2lsbCBiZSBjaGVja2VkIGZvciBlcXVhbGl0eS4gSWZcbiAgICAgKiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gdGhlbiB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlIGNoZWNrZWQgZm9yXG4gICAgICogZXF1YWxpdHkgYWdhaW5zdCB0aGUgdmFsdWVkIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHRvIHRoaXMgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFt2YWx1ZV0gLSBJZiB0aGUgZmlyc3QgYXJndW1lbnQgKGF0dHIpIGlzIGEgcHJvcGVydHkgbmFtZSB0aGVuIHRoaXMgdmFsdWVcbiAgICAgKiB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGVbXX0gVGhlIGFycmF5IG9mIGdyYXBoIG5vZGVzIHRoYXQgbWF0Y2ggdGhlIHNlYXJjaCBjcml0ZXJpYS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIGFsbCBub2RlcyB0aGF0IGhhdmUgYSBtb2RlbCBjb21wb25lbnQgYW5kIGhhdmUgYGRvb3JgIGluIHRoZWlyIGxvd2VyLWNhc2VkIG5hbWVcbiAgICAgKiB2YXIgZG9vcnMgPSBob3VzZS5maW5kKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Rvb3InKSAhPT0gLTE7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kcyBhbGwgbm9kZXMgdGhhdCBoYXZlIHRoZSBuYW1lIHByb3BlcnR5IHNldCB0byAnVGVzdCdcbiAgICAgKiB2YXIgZW50aXRpZXMgPSBwYXJlbnQuZmluZCgnbmFtZScsICdUZXN0Jyk7XG4gICAgICovXG4gICAgZmluZChhdHRyLCB2YWx1ZSkge1xuICAgICAgICBsZXQgcmVzdWx0LCByZXN1bHRzID0gW107XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmbiA9IGF0dHI7XG5cbiAgICAgICAgICAgIHJlc3VsdCA9IGZuKHRoaXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2godGhpcyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXNjZW5kYW50cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmQoZm4pO1xuICAgICAgICAgICAgICAgIGlmIChkZXNjZW5kYW50cy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChkZXNjZW5kYW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgdGVzdFZhbHVlO1xuXG4gICAgICAgICAgICBpZiAodGhpc1thdHRyXSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0ZXN0VmFsdWUgPT09IHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2godGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXNjZW5kYW50cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmQoYXR0ciwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChkZXNjZW5kYW50cy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChkZXNjZW5kYW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBmaXJzdCBub2RlIHRoYXQgc2F0aXNmaWVzIHNvbWVcbiAgICAgKiBzZWFyY2ggY3JpdGVyaWEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbmROb2RlQ2FsbGJhY2t8c3RyaW5nfSBhdHRyIC0gVGhpcyBjYW4gZWl0aGVyIGJlIGEgZnVuY3Rpb24gb3IgYSBzdHJpbmcuIElmIGl0J3MgYVxuICAgICAqIGZ1bmN0aW9uLCBpdCBpcyBleGVjdXRlZCBmb3IgZWFjaCBkZXNjZW5kYW50IG5vZGUgdG8gdGVzdCBpZiBub2RlIHNhdGlzZmllcyB0aGUgc2VhcmNoXG4gICAgICogbG9naWMuIFJldHVybmluZyB0cnVlIGZyb20gdGhlIGZ1bmN0aW9uIHdpbGwgcmVzdWx0IGluIHRoYXQgbm9kZSBiZWluZyByZXR1cm5lZCBmcm9tXG4gICAgICogZmluZE9uZS4gSWYgaXQncyBhIHN0cmluZyB0aGVuIGl0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBmaWVsZCBvciBhIG1ldGhvZCBvZiB0aGUgbm9kZS4gSWZcbiAgICAgKiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZmllbGQgdGhlbiB0aGUgdmFsdWUgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgd2lsbCBiZSBjaGVja2VkIGZvclxuICAgICAqIGVxdWFsaXR5LiBJZiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gdGhlbiB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlXG4gICAgICogY2hlY2tlZCBmb3IgZXF1YWxpdHkgYWdhaW5zdCB0aGUgdmFsdWVkIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHRvIHRoaXMgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFt2YWx1ZV0gLSBJZiB0aGUgZmlyc3QgYXJndW1lbnQgKGF0dHIpIGlzIGEgcHJvcGVydHkgbmFtZSB0aGVuIHRoaXMgdmFsdWVcbiAgICAgKiB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV8bnVsbH0gQSBncmFwaCBub2RlIHRoYXQgbWF0Y2ggdGhlIHNlYXJjaCBjcml0ZXJpYS4gUmV0dXJucyBudWxsIGlmIG5vXG4gICAgICogbm9kZSBpcyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmQgdGhlIGZpcnN0IG5vZGUgdGhhdCBpcyBjYWxsZWQgYGhlYWRgIGFuZCBoYXMgYSBtb2RlbCBjb21wb25lbnRcbiAgICAgKiB2YXIgaGVhZCA9IHBsYXllci5maW5kT25lKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZSA9PT0gJ2hlYWQnO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgdGhlIGZpcnN0IG5vZGUgdGhhdCBoYXMgdGhlIG5hbWUgcHJvcGVydHkgc2V0IHRvICdUZXN0J1xuICAgICAqIHZhciBub2RlID0gcGFyZW50LmZpbmRPbmUoJ25hbWUnLCAnVGVzdCcpO1xuICAgICAqL1xuICAgIGZpbmRPbmUoYXR0ciwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmbiA9IGF0dHI7XG5cbiAgICAgICAgICAgIHJlc3VsdCA9IGZuKHRoaXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRPbmUoZm4pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgdGVzdFZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1thdHRyXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGVzdFZhbHVlID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kT25lKGF0dHIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHNhdGlzZnkgdGhlIHNlYXJjaCBxdWVyeS4gUXVlcnkgY2FuIGJlIHNpbXBseSBhIHN0cmluZywgb3IgY29tbWFcbiAgICAgKiBzZXBhcmF0ZWQgc3RyaW5ncywgdG8gaGF2ZSBpbmNsdXNpdmUgcmVzdWx0cyBvZiBhc3NldHMgdGhhdCBtYXRjaCBhdCBsZWFzdCBvbmUgcXVlcnkuIEFcbiAgICAgKiBxdWVyeSB0aGF0IGNvbnNpc3RzIG9mIGFuIGFycmF5IG9mIHRhZ3MgY2FuIGJlIHVzZWQgdG8gbWF0Y2ggZ3JhcGggbm9kZXMgdGhhdCBoYXZlIGVhY2ggdGFnXG4gICAgICogb2YgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLip9IHF1ZXJ5IC0gTmFtZSBvZiBhIHRhZyBvciBhcnJheSBvZiB0YWdzLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGVbXX0gQSBsaXN0IG9mIGFsbCBncmFwaCBub2RlcyB0aGF0IG1hdGNoIHRoZSBxdWVyeS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCB0YWdnZWQgYnkgYGFuaW1hbGBcbiAgICAgKiB2YXIgYW5pbWFscyA9IG5vZGUuZmluZEJ5VGFnKFwiYW5pbWFsXCIpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHRhZ2dlZCBieSBgYmlyZGAgT1IgYG1hbW1hbGBcbiAgICAgKiB2YXIgYmlyZHNBbmRNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoXCJiaXJkXCIsIFwibWFtbWFsXCIpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgXG4gICAgICogdmFyIG1lYXRFYXRpbmdNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoW1wiY2Fybml2b3JlXCIsIFwibWFtbWFsXCJdKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IChgY2Fybml2b3JlYCBBTkQgYG1hbW1hbGApIE9SIChgY2Fybml2b3JlYCBBTkQgYHJlcHRpbGVgKVxuICAgICAqIHZhciBtZWF0RWF0aW5nTWFtbWFsc0FuZFJlcHRpbGVzID0gbm9kZS5maW5kQnlUYWcoW1wiY2Fybml2b3JlXCIsIFwibWFtbWFsXCJdLCBbXCJjYXJuaXZvcmVcIiwgXCJyZXB0aWxlXCJdKTtcbiAgICAgKi9cbiAgICBmaW5kQnlUYWcoKSB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gYXJndW1lbnRzO1xuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgY29uc3QgcXVlcnlOb2RlID0gKG5vZGUsIGNoZWNrTm9kZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGNoZWNrTm9kZSAmJiBub2RlLnRhZ3MuaGFzKC4uLnF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChub2RlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHF1ZXJ5Tm9kZShub2RlLl9jaGlsZHJlbltpXSwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcXVlcnlOb2RlKHRoaXMsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGZpcnN0IG5vZGUgZm91bmQgaW4gdGhlIGdyYXBoIHdpdGggdGhlIG5hbWUuIFRoZSBzZWFyY2ggaXMgZGVwdGggZmlyc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBncmFwaC5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IFRoZSBmaXJzdCBub2RlIHRvIGJlIGZvdW5kIG1hdGNoaW5nIHRoZSBzdXBwbGllZCBuYW1lLiBSZXR1cm5zXG4gICAgICogbnVsbCBpZiBubyBub2RlIGlzIGZvdW5kLlxuICAgICAqL1xuICAgIGZpbmRCeU5hbWUobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5uYW1lID09PSBuYW1lKSByZXR1cm4gdGhpcztcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRCeU5hbWUobmFtZSk7XG4gICAgICAgICAgICBpZiAoZm91bmQgIT09IG51bGwpIHJldHVybiBmb3VuZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGZpcnN0IG5vZGUgZm91bmQgaW4gdGhlIGdyYXBoIGJ5IGl0cyBmdWxsIHBhdGggaW4gdGhlIGdyYXBoLiBUaGUgZnVsbCBwYXRoIGhhcyB0aGlzXG4gICAgICogZm9ybSAncGFyZW50L2NoaWxkL3N1Yi1jaGlsZCcuIFRoZSBzZWFyY2ggaXMgZGVwdGggZmlyc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gcGF0aCAtIFRoZSBmdWxsIHBhdGggb2YgdGhlIHtAbGluayBHcmFwaE5vZGV9IGFzIGVpdGhlciBhIHN0cmluZyBvclxuICAgICAqIGFycmF5IG9mIHtAbGluayBHcmFwaE5vZGV9IG5hbWVzLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV8bnVsbH0gVGhlIGZpcnN0IG5vZGUgdG8gYmUgZm91bmQgbWF0Y2hpbmcgdGhlIHN1cHBsaWVkIHBhdGguIFJldHVybnNcbiAgICAgKiBudWxsIGlmIG5vIG5vZGUgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTdHJpbmcgZm9ybVxuICAgICAqIHZhciBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aCgnY2hpbGQvZ3JhbmRjaGlsZCcpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXJyYXkgZm9ybVxuICAgICAqIHZhciBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aChbJ2NoaWxkJywgJ2dyYW5kY2hpbGQnXSk7XG4gICAgICovXG4gICAgZmluZEJ5UGF0aChwYXRoKSB7XG4gICAgICAgIC8vIGFjY2VwdCBlaXRoZXIgc3RyaW5nIHBhdGggd2l0aCAnLycgc2VwYXJhdG9ycyBvciBhcnJheSBvZiBwYXJ0cy5cbiAgICAgICAgY29uc3QgcGFydHMgPSBBcnJheS5pc0FycmF5KHBhdGgpID8gcGF0aCA6IHBhdGguc3BsaXQoJy8nKTtcblxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGltYXggPSBwYXJ0cy5sZW5ndGg7IGkgPCBpbWF4OyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jaGlsZHJlbi5maW5kKGMgPT4gYy5uYW1lID09PSBwYXJ0c1tpXSk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlcyBhIHByb3ZpZGVkIGZ1bmN0aW9uIG9uY2Ugb24gdGhpcyBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGb3JFYWNoTm9kZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIG9uIHRoZSBncmFwaCBub2RlIGFuZCBlYWNoXG4gICAgICogZGVzY2VuZGFudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3RoaXNBcmddIC0gT3B0aW9uYWwgdmFsdWUgdG8gdXNlIGFzIHRoaXMgd2hlbiBleGVjdXRpbmcgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb2cgdGhlIHBhdGggYW5kIG5hbWUgb2YgZWFjaCBub2RlIGluIGRlc2NlbmRhbnQgdHJlZSBzdGFydGluZyB3aXRoIFwicGFyZW50XCJcbiAgICAgKiBwYXJlbnQuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhub2RlLnBhdGggKyBcIi9cIiArIG5vZGUubmFtZSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuW2ldLmZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgbm9kZSBpcyBkZXNjZW5kYW50IG9mIGFub3RoZXIgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gUG90ZW50aWFsIGFuY2VzdG9yIG9mIG5vZGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIG5vZGUgaXMgZGVzY2VuZGFudCBvZiBhbm90aGVyIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAocm9vZi5pc0Rlc2NlbmRhbnRPZihob3VzZSkpIHtcbiAgICAgKiAgICAgLy8gcm9vZiBpcyBkZXNjZW5kYW50IG9mIGhvdXNlIGVudGl0eVxuICAgICAqIH1cbiAgICAgKi9cbiAgICBpc0Rlc2NlbmRhbnRPZihub2RlKSB7XG4gICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGlmIChwYXJlbnQgPT09IG5vZGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBub2RlIGlzIGFuY2VzdG9yIGZvciBhbm90aGVyIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFBvdGVudGlhbCBkZXNjZW5kYW50IG9mIG5vZGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIG5vZGUgaXMgYW5jZXN0b3IgZm9yIGFub3RoZXIgbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChib2R5LmlzQW5jZXN0b3JPZihmb290KSkge1xuICAgICAqICAgICAvLyBmb290IGlzIHdpdGhpbiBib2R5J3MgaGllcmFyY2h5XG4gICAgICogfVxuICAgICAqL1xuICAgIGlzQW5jZXN0b3JPZihub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlLmlzRGVzY2VuZGFudE9mKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlIGluIEV1bGVyIGFuZ2xlIGZvcm0uIFRoZSByb3RhdGlvblxuICAgICAqIGlzIHJldHVybmVkIGFzIGV1bGVyIGFuZ2xlcyBpbiBhIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlXG4gICAgICogY29uc2lkZXJlZCByZWFkLW9ubHkuIEluIG9yZGVyIHRvIHNldCB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZVxuICAgICAqIHtAbGluayBHcmFwaE5vZGUjc2V0RXVsZXJBbmdsZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBpbiBFdWxlciBhbmdsZSBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFuZ2xlcyA9IHRoaXMuZW50aXR5LmdldEV1bGVyQW5nbGVzKCk7XG4gICAgICogYW5nbGVzLnkgPSAxODA7IC8vIHJvdGF0ZSB0aGUgZW50aXR5IGFyb3VuZCBZIGJ5IDE4MCBkZWdyZWVzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcygpIHtcbiAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldEV1bGVyQW5nbGVzKHRoaXMuZXVsZXJBbmdsZXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5ldWxlckFuZ2xlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzXG4gICAgICogZXVsZXIgYW5nbGVzIGluIGEge0BsaW5rIFZlYzN9LiBUaGUgcmV0dXJuZWQgdmVjdG9yIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG9cbiAgICAgKiB1cGRhdGUgdGhlIGxvY2FsIHJvdGF0aW9uLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbEV1bGVyQW5nbGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgbG9jYWwgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgZXVsZXIgYW5nbGVzIGluIFhZWiBvcmRlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogYW5nbGVzLnkgPSAxODA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIGdldExvY2FsRXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5nZXRFdWxlckFuZ2xlcyh0aGlzLmxvY2FsRXVsZXJBbmdsZXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbEV1bGVyQW5nbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcG9zaXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiBwb3NpdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHBvc2l0aW9uID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAqIHBvc2l0aW9uLnggKz0gMTsgLy8gbW92ZSB0aGUgZW50aXR5IDEgdW5pdCBhbG9uZyB4LlxuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqL1xuICAgIGdldExvY2FsUG9zaXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsUG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSByb3RhdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFF1YXR9LiBUaGUgcmV0dXJuZWQgcXVhdGVybmlvbiBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiByb3RhdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxSb3RhdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIGxvY2FsIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGEgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciByb3RhdGlvbiA9IHRoaXMuZW50aXR5LmdldExvY2FsUm90YXRpb24oKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFJvdGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFJvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgc2NhbGUgaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgc2NhbGUgaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWwgc2NhbGUsXG4gICAgICogdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxTY2FsZX0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHNjYWxlIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpO1xuICAgICAqIHNjYWxlLnggPSAxMDA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZShzY2FsZSk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxTY2FsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxTY2FsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGxvY2FsIHRyYW5zZm9ybSBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS4gVGhpcyBtYXRyaXggaXMgdGhlIHRyYW5zZm9ybSByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBub2RlJ3MgcGFyZW50J3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3MgbG9jYWwgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHRyYW5zZm9ybSA9IHRoaXMuZW50aXR5LmdldExvY2FsVHJhbnNmb3JtKCk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxUcmFuc2Zvcm0oKSB7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHBvc2l0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXJcbiAgICAgKiB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHBvc2l0aW9uID0gdGhpcy5lbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiBwb3NpdGlvbi54ID0gMTA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqL1xuICAgIGdldFBvc2l0aW9uKCkge1xuICAgICAgICB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0VHJhbnNsYXRpb24odGhpcy5wb3NpdGlvbik7XG4gICAgICAgIHJldHVybiB0aGlzLnBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcm90YXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBRdWF0fS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBJbiBvcmRlclxuICAgICAqIHRvIHNldCB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldFJvdGF0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgYSBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHJvdGF0aW9uID0gdGhpcy5lbnRpdHkuZ2V0Um90YXRpb24oKTtcbiAgICAgKi9cbiAgICBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgdGhpcy5yb3RhdGlvbi5zZXRGcm9tTWF0NCh0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gdGhpcy5yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJldHVybmVkIHZhbHVlIHdpbGwgb25seSBiZVxuICAgICAqIGNvcnJlY3QgZm9yIGdyYXBoIG5vZGVzIHRoYXQgaGF2ZSBhIG5vbi1za2V3ZWQgd29ybGQgdHJhbnNmb3JtIChhIHNrZXcgY2FuIGJlIGludHJvZHVjZWQgYnlcbiAgICAgKiB0aGUgY29tcG91bmRpbmcgb2Ygcm90YXRpb25zIGFuZCBzY2FsZXMgaGlnaGVyIGluIHRoZSBncmFwaCBub2RlIGhpZXJhcmNoeSkuIFRoZSBzY2FsZSBpc1xuICAgICAqIHJldHVybmVkIGFzIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZFxuICAgICAqIHJlYWQtb25seS4gTm90ZSB0aGF0IGl0IGlzIG5vdCBwb3NzaWJsZSB0byBzZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIG9mIGEgZ3JhcGggbm9kZVxuICAgICAqIGRpcmVjdGx5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzY2FsZSA9IHRoaXMuZW50aXR5LmdldFNjYWxlKCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFNjYWxlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NjYWxlKSB7XG4gICAgICAgICAgICB0aGlzLl9zY2FsZSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRTY2FsZSh0aGlzLl9zY2FsZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBUaGUgbm9kZSdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB0cmFuc2Zvcm0gPSB0aGlzLmVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAqL1xuICAgIGdldFdvcmxkVHJhbnNmb3JtKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwgJiYgIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50KVxuICAgICAgICAgICAgdGhpcy5fcGFyZW50LmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgdGhpcy5fc3luYygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLndvcmxkVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBncmFwaCBub2RlIGZyb20gY3VycmVudCBwYXJlbnQgYW5kIGFkZCBhcyBjaGlsZCB0byBuZXcgcGFyZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHBhcmVudCAtIE5ldyBwYXJlbnQgdG8gYXR0YWNoIGdyYXBoIG5vZGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbmRleF0gLSBUaGUgY2hpbGQgaW5kZXggd2hlcmUgdGhlIGNoaWxkIG5vZGUgc2hvdWxkIGJlIHBsYWNlZC5cbiAgICAgKi9cbiAgICByZXBhcmVudChwYXJlbnQsIGluZGV4KSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9wYXJlbnQ7XG5cbiAgICAgICAgaWYgKGN1cnJlbnQpXG4gICAgICAgICAgICBjdXJyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xuXG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50Lmluc2VydENoaWxkKHRoaXMsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlIHVzaW5nIGV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZVxuICAgICAqIGludGVycHJldGVkIGluIFhZWiBvcmRlci4gRXVsZXJzIG11c3QgYmUgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIGV1bGVyXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBldWxlcnMgb3Igcm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlXG4gICAgICogeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHktYXhpcyB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcygwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgeS1heGlzIHZpYSBhIHZlY3RvclxuICAgICAqIHZhciBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldExvY2FsRXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBwb3MgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3MpO1xuICAgICAqL1xuICAgIHNldExvY2FsUG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxSb3RhdGlvbigwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgcXVhdGVybmlvblxuICAgICAqIHZhciBxID0gcGMuUXVhdCgpO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUm90YXRpb24ocSk7XG4gICAgICovXG4gICAgc2V0TG9jYWxSb3RhdGlvbih4LCB5LCB6LCB3KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0KHgsIHksIHosIHcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugc2NhbGUgZmFjdG9yIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSBzY2FsZSBvciB4LWNvb3JkaW5hdGVcbiAgICAgKiBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBzY2FsZSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIHNldExvY2FsU2NhbGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTY2FsZS5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFNjYWxlLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5TG9jYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IHRydWU7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdW5mcmVlemVQYXJlbnRUb1Jvb3QoKSB7XG4gICAgICAgIGxldCBwID0gdGhpcy5fcGFyZW50O1xuICAgICAgICB3aGlsZSAocCkge1xuICAgICAgICAgICAgcC5fZnJvemVuID0gZmFsc2U7XG4gICAgICAgICAgICBwID0gcC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RpcnRpZnlXb3JsZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgdGhpcy5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcbiAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkSW50ZXJuYWwoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeVdvcmxkSW50ZXJuYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgdGhpcy5fZnJvemVuID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVdvcmxkID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NoaWxkcmVuW2ldLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fZGlydGlmeVdvcmxkSW50ZXJuYWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2FhYmJWZXIrKztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlXG4gICAgICogcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB3b3JsZC1zcGFjZSBwb3NpdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKDAsIDEwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgdmVjdG9yXG4gICAgICogdmFyIHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBzZXRQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpKS5pbnZlcnQoKTtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0Um90YXRpb24oMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHF1YXRlcm5pb25cbiAgICAgKiB2YXIgcSA9IHBjLlF1YXQoKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbihxKTtcbiAgICAgKi9cbiAgICBzZXRSb3RhdGlvbih4LCB5LCB6LCB3KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgcm90YXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJvdGF0aW9uLnNldCh4LCB5LCB6LCB3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KHJvdGF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KGludlBhcmVudFJvdCkubXVsKHJvdGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZSB1c2luZyBldWxlciBhbmdsZXMuIEV1bGVycyBhcmVcbiAgICAgKiBpbnRlcnByZXRlZCBpbiBYWVogb3JkZXIuIEV1bGVycyBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZSBldWxlclxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgZXVsZXJzIG9yIHJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZVxuICAgICAqIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgdmlhIGEgdmVjdG9yXG4gICAgICogdmFyIGFuZ2xlcyA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldEV1bGVyQW5nbGVzKHgsIHksIHopIHtcbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRSb3QgPSB0aGlzLl9wYXJlbnQuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIGludlBhcmVudFJvdC5jb3B5KHBhcmVudFJvdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihpbnZQYXJlbnRSb3QsIHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBuZXcgY2hpbGQgdG8gdGhlIGNoaWxkIGxpc3QgYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mIHRoZSBjaGlsZCBub2RlLlxuICAgICAqIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBuZXcgY2hpbGQgdG8gYWRkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGQoZSk7XG4gICAgICovXG4gICAgYWRkQ2hpbGQobm9kZSkge1xuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgY2hpbGQgdG8gdGhpcyBub2RlLCBtYWludGFpbmluZyB0aGUgY2hpbGQncyB0cmFuc2Zvcm0gaW4gd29ybGQgc3BhY2UuXG4gICAgICogSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5LmFkZENoaWxkQW5kU2F2ZVRyYW5zZm9ybShlKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtKG5vZGUpIHtcblxuICAgICAgICBjb25zdCB3UG9zID0gbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3Um90ID0gbm9kZS5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgIHRoaXMuX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKTtcblxuICAgICAgICBub2RlLnNldFBvc2l0aW9uKHRtcE1hdDQuY29weSh0aGlzLndvcmxkVHJhbnNmb3JtKS5pbnZlcnQoKS50cmFuc2Zvcm1Qb2ludCh3UG9zKSk7XG4gICAgICAgIG5vZGUuc2V0Um90YXRpb24odG1wUXVhdC5jb3B5KHRoaXMuZ2V0Um90YXRpb24oKSkuaW52ZXJ0KCkubXVsKHdSb3QpKTtcblxuICAgICAgICB0aGlzLl9jaGlsZHJlbi5wdXNoKG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBhIG5ldyBjaGlsZCB0byB0aGUgY2hpbGQgbGlzdCBhdCB0aGUgc3BlY2lmaWVkIGluZGV4IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZlxuICAgICAqIHRoZSBjaGlsZCBub2RlLiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbmV3IGNoaWxkIHRvIGluc2VydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggaW4gdGhlIGNoaWxkIGxpc3Qgb2YgdGhlIHBhcmVudCB3aGVyZSB0aGUgbmV3IG5vZGUgd2lsbCBiZVxuICAgICAqIGluc2VydGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuaW5zZXJ0Q2hpbGQoZSwgMSk7XG4gICAgICovXG4gICAgaW5zZXJ0Q2hpbGQobm9kZSwgaW5kZXgpIHtcblxuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMCwgbm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJlcGFyZXMgbm9kZSBmb3IgYmVpbmcgaW5zZXJ0ZWQgdG8gYSBwYXJlbnQgbm9kZSwgYW5kIHJlbW92ZXMgaXQgZnJvbSB0aGUgcHJldmlvdXMgcGFyZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbm9kZSBiZWluZyBpbnNlcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSkge1xuXG4gICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIHRoZSBleGlzdGluZyBwYXJlbnRcbiAgICAgICAgaWYgKG5vZGUuX3BhcmVudCkge1xuICAgICAgICAgICAgbm9kZS5fcGFyZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KG5vZGUgIT09IHRoaXMsIGBHcmFwaE5vZGUgJHtub2RlPy5uYW1lfSBjYW5ub3QgYmUgYSBjaGlsZCBvZiBpdHNlbGZgKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmlzRGVzY2VuZGFudE9mKG5vZGUpLCBgR3JhcGhOb2RlICR7bm9kZT8ubmFtZX0gY2Fubm90IGFkZCBhbiBhbmNlc3RvciBhcyBhIGNoaWxkYCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZXMgYW4gZXZlbnQgb24gYWxsIGNoaWxkcmVuIG9mIHRoZSBub2RlLiBUaGUgZXZlbnQgYG5hbWVgIGlzIGZpcmVkIG9uIHRoZSBmaXJzdCAocm9vdClcbiAgICAgKiBub2RlIG9ubHkuIFRoZSBldmVudCBgbmFtZUhpZXJhcmNoeWAgaXMgZmlyZWQgZm9yIGFsbCBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIGZpcmUgb24gdGhlIHJvb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWVIaWVyYXJjaHkgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gZmlyZSBmb3IgYWxsIGRlc2NlbmRhbnRzLlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBwYXJlbnQgLSBUaGUgcGFyZW50IG9mIHRoZSBub2RlIGJlaW5nIGFkZGVkL3JlbW92ZWQgZnJvbSB0aGUgaGllcmFyY2h5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ZpcmVPbkhpZXJhcmNoeShuYW1lLCBuYW1lSGllcmFyY2h5LCBwYXJlbnQpIHtcbiAgICAgICAgdGhpcy5maXJlKG5hbWUsIHBhcmVudCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl9maXJlT25IaWVyYXJjaHkobmFtZUhpZXJhcmNoeSwgbmFtZUhpZXJhcmNoeSwgcGFyZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIGEgbm9kZSBpcyBpbnNlcnRlZCBpbnRvIGEgbm9kZSdzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBub2RlIHRoYXQgd2FzIGluc2VydGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uSW5zZXJ0Q2hpbGQobm9kZSkge1xuICAgICAgICBub2RlLl9wYXJlbnQgPSB0aGlzO1xuXG4gICAgICAgIC8vIHRoZSBjaGlsZCBub2RlIHNob3VsZCBiZSBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHkgb25seSBpZiBpdHNlbGYgaXMgZW5hYmxlZCBhbmQgaWZcbiAgICAgICAgLy8gdGhpcyBwYXJlbnQgaXMgZW5hYmxlZFxuICAgICAgICBjb25zdCBlbmFibGVkSW5IaWVyYXJjaHkgPSAobm9kZS5fZW5hYmxlZCAmJiB0aGlzLmVuYWJsZWQpO1xuICAgICAgICBpZiAobm9kZS5fZW5hYmxlZEluSGllcmFyY2h5ICE9PSBlbmFibGVkSW5IaWVyYXJjaHkpIHtcbiAgICAgICAgICAgIG5vZGUuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGVuYWJsZWRJbkhpZXJhcmNoeTtcblxuICAgICAgICAgICAgLy8gcHJvcGFnYXRlIHRoZSBjaGFuZ2UgdG8gdGhlIGNoaWxkcmVuIC0gbmVjZXNzYXJ5IGlmIHdlIHJlcGFyZW50IGEgbm9kZVxuICAgICAgICAgICAgLy8gdW5kZXIgYSBwYXJlbnQgd2l0aCBhIGRpZmZlcmVudCBlbmFibGVkIHN0YXRlIChpZiB3ZSByZXBhcmVudCBhIG5vZGUgdGhhdCBpc1xuICAgICAgICAgICAgLy8gbm90IGFjdGl2ZSBpbiB0aGUgaGllcmFyY2h5IHVuZGVyIGEgcGFyZW50IHdobyBpcyBhY3RpdmUgaW4gdGhlIGhpZXJhcmNoeSB0aGVuXG4gICAgICAgICAgICAvLyB3ZSB3YW50IG91ciBub2RlIHRvIGJlIGFjdGl2YXRlZClcbiAgICAgICAgICAgIG5vZGUuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkSW5IaWVyYXJjaHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGdyYXBoIGRlcHRoIG9mIHRoZSBjaGlsZCBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyB3aWxsIG5vdyBjaGFuZ2VcbiAgICAgICAgbm9kZS5fdXBkYXRlR3JhcGhEZXB0aCgpO1xuXG4gICAgICAgIC8vIFRoZSBjaGlsZCAocGx1cyBzdWJoaWVyYXJjaHkpIHdpbGwgbmVlZCB3b3JsZCB0cmFuc2Zvcm1zIHRvIGJlIHJlY2FsY3VsYXRlZFxuICAgICAgICBub2RlLl9kaXJ0aWZ5V29ybGQoKTtcbiAgICAgICAgLy8gbm9kZSBtaWdodCBiZSBhbHJlYWR5IG1hcmtlZCBhcyBkaXJ0eSwgaW4gdGhhdCBjYXNlIHRoZSB3aG9sZSBjaGFpbiBzdGF5cyBmcm96ZW4sIHNvIGxldCdzIGVuZm9yY2UgdW5mcmVlemVcbiAgICAgICAgaWYgKHRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIG5vZGUuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG5cbiAgICAgICAgLy8gYWxlcnQgYW4gZW50aXR5IGhpZXJhcmNoeSB0aGF0IGl0IGhhcyBiZWVuIGluc2VydGVkXG4gICAgICAgIG5vZGUuX2ZpcmVPbkhpZXJhcmNoeSgnaW5zZXJ0JywgJ2luc2VydGhpZXJhcmNoeScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGFsZXJ0IHRoZSBwYXJlbnQgdGhhdCBpdCBoYXMgaGFkIGEgY2hpbGQgaW5zZXJ0ZWRcbiAgICAgICAgaWYgKHRoaXMuZmlyZSkgdGhpcy5maXJlKCdjaGlsZGluc2VydCcsIG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY3Vyc2UgdGhlIGhpZXJhcmNoeSBhbmQgdXBkYXRlIHRoZSBncmFwaCBkZXB0aCBhdCBlYWNoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVHcmFwaERlcHRoKCkge1xuICAgICAgICB0aGlzLl9ncmFwaERlcHRoID0gdGhpcy5fcGFyZW50ID8gdGhpcy5fcGFyZW50Ll9ncmFwaERlcHRoICsgMSA6IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fdXBkYXRlR3JhcGhEZXB0aCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBub2RlIGZyb20gdGhlIGNoaWxkIGxpc3QgYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mIHRoZSBjaGlsZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBjaGlsZCAtIFRoZSBub2RlIHRvIHJlbW92ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBjaGlsZCA9IHRoaXMuZW50aXR5LmNoaWxkcmVuWzBdO1xuICAgICAqIHRoaXMuZW50aXR5LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgKi9cbiAgICByZW1vdmVDaGlsZChjaGlsZCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2NoaWxkcmVuLmluZGV4T2YoY2hpbGQpO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgZnJvbSBjaGlsZCBsaXN0XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgICAgLy8gQ2xlYXIgcGFyZW50XG4gICAgICAgIGNoaWxkLl9wYXJlbnQgPSBudWxsO1xuXG4gICAgICAgIC8vIE5PVEU6IHNlZSBQUiAjNDA0NyAtIHRoaXMgZml4IGlzIHJlbW92ZWQgZm9yIG5vdyBhcyBpdCBicmVha3Mgb3RoZXIgdGhpbmdzXG4gICAgICAgIC8vIG5vdGlmeSB0aGUgY2hpbGQgaGllcmFyY2h5IGl0IGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50LFxuICAgICAgICAvLyB3aGljaCBtYXJrcyB0aGVtIGFzIG5vdCBlbmFibGVkIGluIGhpZXJhcmNoeVxuICAgICAgICAvLyBpZiAoY2hpbGQuX2VuYWJsZWRJbkhpZXJhcmNoeSkge1xuICAgICAgICAvLyAgICAgY2hpbGQuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjaGlsZCwgZmFsc2UpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gYWxlcnQgY2hpbGRyZW4gdGhhdCB0aGV5IGhhcyBiZWVuIHJlbW92ZWRcbiAgICAgICAgY2hpbGQuX2ZpcmVPbkhpZXJhcmNoeSgncmVtb3ZlJywgJ3JlbW92ZWhpZXJhcmNoeScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGFsZXJ0IHRoZSBwYXJlbnQgdGhhdCBpdCBoYXMgaGFkIGEgY2hpbGQgcmVtb3ZlZFxuICAgICAgICB0aGlzLmZpcmUoJ2NoaWxkcmVtb3ZlJywgY2hpbGQpO1xuICAgIH1cblxuICAgIF9zeW5jKCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFRyYW5zZm9ybS5zZXRUUlModGhpcy5sb2NhbFBvc2l0aW9uLCB0aGlzLmxvY2FsUm90YXRpb24sIHRoaXMubG9jYWxTY2FsZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50V29ybGRTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgYSBwYXJlbnQgb2YgdGhlIGZpcnN0IHVuY29tcGVuc2F0ZWQgbm9kZSB1cCBpbiB0aGUgaGllcmFyY2h5IGFuZCB1c2UgaXRzIHNjYWxlICogbG9jYWxTY2FsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgc2NhbGUgPSB0aGlzLmxvY2FsU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudDsgLy8gY3VycmVudCBwYXJlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAocGFyZW50VG9Vc2VTY2FsZUZyb20gJiYgcGFyZW50VG9Vc2VTY2FsZUZyb20uc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLl9wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b3Btb3N0IG5vZGUgd2l0aCBzY2FsZSBjb21wZW5zYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50VG9Vc2VTY2FsZUZyb20uX3BhcmVudDsgLy8gbm9kZSB3aXRob3V0IHNjYWxlIGNvbXBlbnNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRXb3JsZFNjYWxlID0gcGFyZW50VG9Vc2VTY2FsZUZyb20ud29ybGRUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGUubXVsMihwYXJlbnRXb3JsZFNjYWxlLCB0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZSA9IHNjYWxlQ29tcGVuc2F0ZVNjYWxlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJvdGF0aW9uIGlzIGFzIHVzdWFsXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdDIuc2V0RnJvbU1hdDQocGFyZW50LndvcmxkVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90Lm11bDIoc2NhbGVDb21wZW5zYXRlUm90MiwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIG1hdHJpeCB0byB0cmFuc2Zvcm0gcG9zaXRpb25cbiAgICAgICAgICAgICAgICAgICAgbGV0IHRtYXRyaXggPSBwYXJlbnQud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnQuc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50Lm11bDIocGFyZW50V29ybGRTY2FsZSwgcGFyZW50LmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm0uc2V0VFJTKHBhcmVudC53b3JsZFRyYW5zZm9ybS5nZXRUcmFuc2xhdGlvbihzY2FsZUNvbXBlbnNhdGVQb3MpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bWF0cml4ID0gc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRtYXRyaXgudHJhbnNmb3JtUG9pbnQodGhpcy5sb2NhbFBvc2l0aW9uLCBzY2FsZUNvbXBlbnNhdGVQb3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0uc2V0VFJTKHNjYWxlQ29tcGVuc2F0ZVBvcywgc2NhbGVDb21wZW5zYXRlUm90LCBzY2FsZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLm11bEFmZmluZTIodGhpcy5fcGFyZW50LndvcmxkVHJhbnNmb3JtLCB0aGlzLmxvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpY2VzIGF0IHRoaXMgbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzeW5jSGllcmFyY2h5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fZnJvemVuID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCB8fCB0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICB0aGlzLl9zeW5jKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuW2ldLnN5bmNIaWVyYXJjaHkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlb3JpZW50cyB0aGUgZ3JhcGggbm9kZSBzbyB0aGF0IHRoZSBuZWdhdGl2ZSB6LWF4aXMgcG9pbnRzIHRvd2FyZHMgdGhlIHRhcmdldC4gVGhpc1xuICAgICAqIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gRWl0aGVyIHBhc3MgM0QgdmVjdG9ycyBmb3IgdGhlIGxvb2sgYXQgY29vcmRpbmF0ZSBhbmQgdXBcbiAgICAgKiB2ZWN0b3IsIG9yIHBhc3MgbnVtYmVycyB0byByZXByZXNlbnQgdGhlIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gSWYgcGFzc2luZyBhIDNEIHZlY3RvciwgdGhpcyBpcyB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIE90aGVyd2lzZSwgaXQgaXMgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gSWYgcGFzc2luZyBhIDNEIHZlY3RvciwgdGhpcyBpcyB0aGUgd29ybGQtc3BhY2UgdXAgdmVjdG9yIGZvciBsb29rIGF0XG4gICAgICogdHJhbnNmb3JtLiBPdGhlcndpc2UsIGl0IGlzIHRoZSB5LWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXg9MF0gLSBYLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1eT0xXSAtIFktY29tcG9uZW50IG9mIHRoZSB1cCB2ZWN0b3IgZm9yIHRoZSBsb29rIGF0IHRyYW5zZm9ybS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3V6PTBdIC0gWi1jb21wb25lbnQgb2YgdGhlIHVwIHZlY3RvciBmb3IgdGhlIGxvb2sgYXQgdHJhbnNmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCBhbm90aGVyIGVudGl0eSwgdXNpbmcgdGhlIChkZWZhdWx0KSBwb3NpdGl2ZSB5LWF4aXMgZm9yIHVwXG4gICAgICogdmFyIHBvc2l0aW9uID0gb3RoZXJFbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQocG9zaXRpb24pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCBhbm90aGVyIGVudGl0eSwgdXNpbmcgdGhlIG5lZ2F0aXZlIHdvcmxkIHktYXhpcyBmb3IgdXBcbiAgICAgKiB2YXIgcG9zaXRpb24gPSBvdGhlckVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdChwb3NpdGlvbiwgcGMuVmVjMy5ET1dOKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgdGhlIHdvcmxkIHNwYWNlIG9yaWdpbiwgdXNpbmcgdGhlIChkZWZhdWx0KSBwb3NpdGl2ZSB5LWF4aXMgZm9yIHVwXG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KDAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxMCwgMTAsIDEwXSwgdXNpbmcgdGhlIG5lZ2F0aXZlIHdvcmxkIHktYXhpcyBmb3IgdXBcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQoMTAsIDEwLCAxMCwgMCwgLTEsIDApO1xuICAgICAqL1xuICAgIGxvb2tBdCh4LCB5LCB6LCB1eCA9IDAsIHV5ID0gMSwgdXogPSAwKSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGFyZ2V0LmNvcHkoeCk7XG5cbiAgICAgICAgICAgIGlmICh5IGluc3RhbmNlb2YgVmVjMykgeyAvLyB2ZWMzLCB2ZWMzXG4gICAgICAgICAgICAgICAgdXAuY29weSh5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIHZlYzNcbiAgICAgICAgICAgICAgICB1cC5jb3B5KFZlYzMuVVApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHogPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0LnNldCh4LCB5LCB6KTtcbiAgICAgICAgICAgIHVwLnNldCh1eCwgdXksIHV6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdHJpeC5zZXRMb29rQXQodGhpcy5nZXRQb3NpdGlvbigpLCB0YXJnZXQsIHVwKTtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbU1hdDQobWF0cml4KTtcbiAgICAgICAgdGhpcy5zZXRSb3RhdGlvbihyb3RhdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNsYXRlcyB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIHRyYW5zbGF0aW9uIHZlY3Rvci4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGVcbiAgICAgKiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlKDEwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHQgPSBuZXcgcGMuVmVjMygxMCwgMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlKHQpO1xuICAgICAqL1xuICAgIHRyYW5zbGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvc2l0aW9uLmFkZCh0aGlzLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2xhdGVzIHRoZSBncmFwaCBub2RlIGluIGxvY2FsLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgdHJhbnNsYXRpb24gdmVjdG9yLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGVMb2NhbCgxMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIHZlY3RvclxuICAgICAqIHZhciB0ID0gbmV3IHBjLlZlYzMoMTAsIDAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZUxvY2FsKHQpO1xuICAgICAqL1xuICAgIHRyYW5zbGF0ZUxvY2FsKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnRyYW5zZm9ybVZlY3Rvcihwb3NpdGlvbiwgcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uYWRkKHBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSb3RhdGVzIHRoZSBncmFwaCBub2RlIGluIHdvcmxkLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgRXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlIHNwZWNpZmllZCBpblxuICAgICAqIGRlZ3JlZXMgaW4gWFlaIG9yZGVyLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEXG4gICAgICogdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yXG4gICAgICogcm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlKHIpO1xuICAgICAqL1xuICAgIHJvdGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihyb3RhdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IHRoaXMuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgcm90YXRpb24ubXVsMihpbnZQYXJlbnRSb3QsIHJvdGF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKHJvdGF0aW9uLCByb3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyB0aGUgZ3JhcGggbm9kZSBpbiBsb2NhbC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIEV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZSBzcGVjaWZpZWQgaW5cbiAgICAgKiBkZWdyZWVzIGluIFhZWiBvcmRlci4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRFxuICAgICAqIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSByb3RhdGlvbiBvclxuICAgICAqIHJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZUxvY2FsKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlTG9jYWwocik7XG4gICAgICovXG4gICAgcm90YXRlTG9jYWwoeCwgeSwgeikge1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bChyb3RhdGlvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHcmFwaE5vZGUgfTtcbiJdLCJuYW1lcyI6WyJzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm0iLCJNYXQ0Iiwic2NhbGVDb21wZW5zYXRlUG9zIiwiVmVjMyIsInNjYWxlQ29tcGVuc2F0ZVJvdCIsIlF1YXQiLCJzY2FsZUNvbXBlbnNhdGVSb3QyIiwic2NhbGVDb21wZW5zYXRlU2NhbGUiLCJzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCIsInRtcE1hdDQiLCJ0bXBRdWF0IiwicG9zaXRpb24iLCJpbnZQYXJlbnRXdG0iLCJyb3RhdGlvbiIsImludlBhcmVudFJvdCIsIm1hdHJpeCIsInRhcmdldCIsInVwIiwiR3JhcGhOb2RlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwidGFncyIsIlRhZ3MiLCJfbGFiZWxzIiwibG9jYWxQb3NpdGlvbiIsImxvY2FsUm90YXRpb24iLCJsb2NhbFNjYWxlIiwibG9jYWxFdWxlckFuZ2xlcyIsImV1bGVyQW5nbGVzIiwiX3NjYWxlIiwibG9jYWxUcmFuc2Zvcm0iLCJfZGlydHlMb2NhbCIsIl9hYWJiVmVyIiwiX2Zyb3plbiIsIndvcmxkVHJhbnNmb3JtIiwiX2RpcnR5V29ybGQiLCJfbm9ybWFsTWF0cml4IiwiTWF0MyIsIl9kaXJ0eU5vcm1hbCIsIl9yaWdodCIsIl91cCIsIl9mb3J3YXJkIiwiX3BhcmVudCIsIl9jaGlsZHJlbiIsIl9ncmFwaERlcHRoIiwiX2VuYWJsZWQiLCJfZW5hYmxlZEluSGllcmFyY2h5Iiwic2NhbGVDb21wZW5zYXRpb24iLCJyaWdodCIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0WCIsIm5vcm1hbGl6ZSIsImdldFkiLCJmb3J3YXJkIiwiZ2V0WiIsIm11bFNjYWxhciIsIm5vcm1hbE1hdHJpeCIsIm5vcm1hbE1hdCIsImludmVydFRvM3gzIiwidHJhbnNwb3NlIiwiZW5hYmxlZCIsIl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQiLCJwYXJlbnQiLCJwYXRoIiwibm9kZSIsInJlc3VsdCIsInJvb3QiLCJjaGlsZHJlbiIsImdyYXBoRGVwdGgiLCJfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQiLCJjIiwiaSIsImxlbiIsImxlbmd0aCIsIl91bmZyZWV6ZVBhcmVudFRvUm9vdCIsIl9jbG9uZUludGVybmFsIiwiY2xvbmUiLCJfbGlzdCIsImNsZWFyIiwiYWRkIiwiT2JqZWN0IiwiYXNzaWduIiwiY29weSIsInNvdXJjZSIsImZpbmQiLCJhdHRyIiwidmFsdWUiLCJyZXN1bHRzIiwiRnVuY3Rpb24iLCJmbiIsInB1c2giLCJkZXNjZW5kYW50cyIsImNvbmNhdCIsInRlc3RWYWx1ZSIsImZpbmRPbmUiLCJmaW5kQnlUYWciLCJxdWVyeSIsImFyZ3VtZW50cyIsInF1ZXJ5Tm9kZSIsImNoZWNrTm9kZSIsImhhcyIsImZpbmRCeU5hbWUiLCJmb3VuZCIsImZpbmRCeVBhdGgiLCJwYXJ0cyIsIkFycmF5IiwiaXNBcnJheSIsInNwbGl0IiwiaW1heCIsImZvckVhY2giLCJjYWxsYmFjayIsInRoaXNBcmciLCJjYWxsIiwiaXNEZXNjZW5kYW50T2YiLCJpc0FuY2VzdG9yT2YiLCJnZXRFdWxlckFuZ2xlcyIsImdldExvY2FsRXVsZXJBbmdsZXMiLCJnZXRMb2NhbFBvc2l0aW9uIiwiZ2V0TG9jYWxSb3RhdGlvbiIsImdldExvY2FsU2NhbGUiLCJnZXRMb2NhbFRyYW5zZm9ybSIsInNldFRSUyIsImdldFBvc2l0aW9uIiwiZ2V0VHJhbnNsYXRpb24iLCJnZXRSb3RhdGlvbiIsInNldEZyb21NYXQ0IiwiZ2V0U2NhbGUiLCJfc3luYyIsInJlcGFyZW50IiwiaW5kZXgiLCJjdXJyZW50IiwicmVtb3ZlQ2hpbGQiLCJpbnNlcnRDaGlsZCIsImFkZENoaWxkIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsIngiLCJ5IiwieiIsInNldEZyb21FdWxlckFuZ2xlcyIsIl9kaXJ0aWZ5TG9jYWwiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0Iiwic2V0TG9jYWxSb3RhdGlvbiIsInciLCJzZXRMb2NhbFNjYWxlIiwiX2RpcnRpZnlXb3JsZCIsInAiLCJfZGlydGlmeVdvcmxkSW50ZXJuYWwiLCJzZXRQb3NpdGlvbiIsImludmVydCIsInRyYW5zZm9ybVBvaW50Iiwic2V0Um90YXRpb24iLCJwYXJlbnRSb3QiLCJtdWwiLCJzZXRFdWxlckFuZ2xlcyIsIm11bDIiLCJfcHJlcGFyZUluc2VydENoaWxkIiwiX29uSW5zZXJ0Q2hpbGQiLCJhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0iLCJ3UG9zIiwid1JvdCIsInNwbGljZSIsIkRlYnVnIiwiYXNzZXJ0IiwiX2ZpcmVPbkhpZXJhcmNoeSIsIm5hbWVIaWVyYXJjaHkiLCJmaXJlIiwiZW5hYmxlZEluSGllcmFyY2h5IiwiX3VwZGF0ZUdyYXBoRGVwdGgiLCJjaGlsZCIsImluZGV4T2YiLCJwYXJlbnRXb3JsZFNjYWxlIiwic2NhbGUiLCJwYXJlbnRUb1VzZVNjYWxlRnJvbSIsInRtYXRyaXgiLCJtdWxBZmZpbmUyIiwic3luY0hpZXJhcmNoeSIsImxvb2tBdCIsInV4IiwidXkiLCJ1eiIsIlVQIiwidW5kZWZpbmVkIiwic2V0TG9va0F0IiwidHJhbnNsYXRlIiwidHJhbnNsYXRlTG9jYWwiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyb3RhdGUiLCJyb3QiLCJyb3RhdGVMb2NhbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7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
