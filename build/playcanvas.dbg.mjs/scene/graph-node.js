/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';
import { Debug } from '../core/debug.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuY29uc3Qgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvcyA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBNYXQ0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRtcFF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbmNvbnN0IGludlBhcmVudFJvdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuY29uc3QgdGFyZ2V0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHVwID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZmluZH0gYW5kIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0gdG8gc2VhcmNoIHRocm91Z2ggYSBncmFwaFxuICogbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmluZE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybmluZyBgdHJ1ZWAgd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAqIHtAbGluayBHcmFwaE5vZGUjZmluZH0gb3Ige0BsaW5rIEdyYXBoTm9kZSNmaW5kT25lfS5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEdyYXBoTm9kZSNmb3JFYWNofSB0byBpdGVyYXRlIHRocm91Z2ggYSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzXG4gKiBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRm9yRWFjaE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICovXG5cbi8qKlxuICogQSBoaWVyYXJjaGljYWwgc2NlbmUgbm9kZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoTm9kZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEdyYXBoTm9kZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBUaGUgbm9uLXVuaXF1ZSBuYW1lIG9mIGEgZ3JhcGggbm9kZS4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lID0gJ1VudGl0bGVkJykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9uLXVuaXF1ZSBuYW1lIG9mIGEgZ3JhcGggbm9kZS4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEludGVyZmFjZSBmb3IgdGFnZ2luZyBncmFwaCBub2Rlcy4gVGFnIGJhc2VkIHNlYXJjaGVzIGNhbiBiZSBwZXJmb3JtZWQgdXNpbmcgdGhlXG4gICAgICAgICAqIHtAbGluayBHcmFwaE5vZGUjZmluZEJ5VGFnfSBmdW5jdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RhZ3N9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fbGFiZWxzID0ge307XG5cbiAgICAgICAgLy8gTG9jYWwtc3BhY2UgcHJvcGVydGllcyBvZiB0cmFuc2Zvcm0gKG9ubHkgZmlyc3QgMyBhcmUgc2V0dGFibGUgYnkgdGhlIHVzZXIpXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsU2NhbGUgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsRXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpOyAvLyBPbmx5IGNhbGN1bGF0ZWQgb24gcmVxdWVzdFxuXG4gICAgICAgIC8vIFdvcmxkLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NhbGUgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2FhYmJWZXIgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYXJrcyB0aGUgbm9kZSB0byBpZ25vcmUgaGllcmFyY2h5IHN5bmMgZW50aXJlbHkgKGluY2x1ZGluZyBjaGlsZHJlbiBub2RlcykuIFRoZSBlbmdpbmVcbiAgICAgICAgICogY29kZSBhdXRvbWF0aWNhbGx5IGZyZWV6ZXMgYW5kIHVuZnJlZXplcyBvYmplY3RzIHdoZW5ldmVyIHJlcXVpcmVkLiBTZWdyZWdhdGluZyBkeW5hbWljXG4gICAgICAgICAqIGFuZCBzdGF0aW9uYXJ5IG5vZGVzIGludG8gc3ViaGllcmFyY2hpZXMgYWxsb3dzIHRvIHJlZHVjZSBzeW5jIHRpbWUgc2lnbmlmaWNhbnRseS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9mcm96ZW4gPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge01hdDR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZGlydHlXb3JsZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0M31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX25vcm1hbE1hdHJpeCA9IG5ldyBNYXQzKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3JpZ2h0ID0gbnVsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl91cCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9mb3J3YXJkID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0dyYXBoTm9kZXxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2hpbGRyZW4gPSBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2dyYXBoRGVwdGggPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXByZXNlbnRzIGVuYWJsZWQgc3RhdGUgb2YgdGhlIGVudGl0eS4gSWYgdGhlIGVudGl0eSBpcyBkaXNhYmxlZCwgdGhlIGVudGl0eSBpbmNsdWRpbmdcbiAgICAgICAgICogYWxsIGNoaWxkcmVuIGFyZSBleGNsdWRlZCBmcm9tIHVwZGF0ZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlcHJlc2VudHMgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IGluIHRoZSBoaWVyYXJjaHkuIEl0J3MgdHJ1ZSBvbmx5IGlmIHRoaXMgZW50aXR5XG4gICAgICAgICAqIGFuZCBhbGwgcGFyZW50IGVudGl0aWVzIGFsbCB0aGUgd2F5IHRvIHRoZSBzY2VuZSdzIHJvb3QgYXJlIGVuYWJsZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW5hYmxlZEluSGllcmFyY2h5ID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjYWxlQ29tcGVuc2F0aW9uID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5vcm1hbGl6ZWQgbG9jYWwgc3BhY2UgWC1heGlzIHZlY3RvciBvZiB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGdldCByaWdodCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9yaWdodCkge1xuICAgICAgICAgICAgdGhpcy5fcmlnaHQgPSBuZXcgVmVjMygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0WCh0aGlzLl9yaWdodCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5vcm1hbGl6ZWQgbG9jYWwgc3BhY2UgWS1heGlzIHZlY3RvciBvZiB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGdldCB1cCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl91cCkge1xuICAgICAgICAgICAgdGhpcy5fdXAgPSBuZXcgVmVjMygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0WSh0aGlzLl91cCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5vcm1hbGl6ZWQgbG9jYWwgc3BhY2UgbmVnYXRpdmUgWi1heGlzIHZlY3RvciBvZiB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGdldCBmb3J3YXJkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2ZvcndhcmQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZvcndhcmQgPSBuZXcgVmVjMygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0Wih0aGlzLl9mb3J3YXJkKS5ub3JtYWxpemUoKS5tdWxTY2FsYXIoLTEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgbWF0cml4IHVzZWQgdG8gdHJhbnNmb3JtIHRoZSBub3JtYWwuXG4gICAgICpcbiAgICAgKiBAdHlwZSAge01hdDN9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBub3JtYWxNYXRyaXgoKSB7XG5cbiAgICAgICAgY29uc3Qgbm9ybWFsTWF0ID0gdGhpcy5fbm9ybWFsTWF0cml4O1xuICAgICAgICBpZiAodGhpcy5fZGlydHlOb3JtYWwpIHtcbiAgICAgICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5pbnZlcnRUbzN4Myhub3JtYWxNYXQpO1xuICAgICAgICAgICAgbm9ybWFsTWF0LnRyYW5zcG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlOb3JtYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub3JtYWxNYXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIG9yIGRpc2FibGUgYSBHcmFwaE5vZGUuIElmIG9uZSBvZiB0aGUgR3JhcGhOb2RlJ3MgcGFyZW50cyBpcyBkaXNhYmxlZCB0aGVyZSB3aWxsIGJlXG4gICAgICogbm8gb3RoZXIgc2lkZSBlZmZlY3RzLiBJZiBhbGwgdGhlIHBhcmVudHMgYXJlIGVuYWJsZWQgdGhlbiB0aGUgbmV3IHZhbHVlIHdpbGwgYWN0aXZhdGUgb3JcbiAgICAgKiBkZWFjdGl2YXRlIGFsbCB0aGUgZW5hYmxlZCBjaGlsZHJlbiBvZiB0aGUgR3JhcGhOb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGVuYWJsZWQoZW5hYmxlZCkge1xuICAgICAgICBpZiAodGhpcy5fZW5hYmxlZCAhPT0gZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IGVuYWJsZWQ7XG5cbiAgICAgICAgICAgIC8vIGlmIGVuYWJsaW5nIGVudGl0eSwgbWFrZSBhbGwgY2hpbGRyZW4gZW5hYmxlZCBpbiBoaWVyYXJjaHkgb25seSB3aGVuIHRoZSBwYXJlbnQgaXMgYXMgd2VsbFxuICAgICAgICAgICAgLy8gaWYgZGlzYWJsaW5nIGVudGl0eSwgbWFrZSBhbGwgY2hpbGRyZW4gZGlzYWJsZWQgaW4gaGllcmFyY2h5IGluIGFsbCBjYXNlc1xuICAgICAgICAgICAgaWYgKGVuYWJsZWQgJiYgdGhpcy5fcGFyZW50Py5lbmFibGVkIHx8ICFlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKHRoaXMsIGVuYWJsZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIC8vIG1ha2Ugc3VyZSB0byBjaGVjayB0aGlzLl9lbmFibGVkIHRvbyBiZWNhdXNlIGlmIHRoYXRcbiAgICAgICAgLy8gd2FzIGZhbHNlIHdoZW4gYSBwYXJlbnQgd2FzIHVwZGF0ZWQgdGhlIF9lbmFibGVkSW5IaWVyYXJjaHlcbiAgICAgICAgLy8gZmxhZyBtYXkgbm90IGhhdmUgYmVlbiB1cGRhdGVkIGZvciBvcHRpbWl6YXRpb24gcHVycG9zZXNcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQgJiYgdGhpcy5fZW5hYmxlZEluSGllcmFyY2h5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCBhIHBhcmVudCBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZXxudWxsfVxuICAgICAqL1xuICAgIGdldCBwYXJlbnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJlbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBwYXRoIG9mIHRoZSBncmFwaCBub2RlIHJlbGF0aXZlIHRvIHRoZSByb290IG9mIHRoZSBoaWVyYXJjaHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBwYXRoKCkge1xuICAgICAgICBsZXQgbm9kZSA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcy5uYW1lO1xuICAgICAgICB3aGlsZSAobm9kZSAmJiBub2RlLl9wYXJlbnQpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGAke25vZGUubmFtZX0vJHtyZXN1bHR9YDtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLl9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgaGlnaGVzdCBncmFwaCBub2RlIGZyb20gY3VycmVudCBub2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZX1cbiAgICAgKi9cbiAgICBnZXQgcm9vdCgpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXM7XG4gICAgICAgIHdoaWxlIChyZXN1bHQuX3BhcmVudCkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0Ll9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgdGhlIGNoaWxkcmVuIG9mIHRoaXMgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGVbXX1cbiAgICAgKi9cbiAgICBnZXQgY2hpbGRyZW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jaGlsZHJlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgdGhlIGRlcHRoIG9mIHRoaXMgY2hpbGQgd2l0aGluIHRoZSBncmFwaC4gTm90ZSB0aGF0IGZvclxuICAgICAqIHBlcmZvcm1hbmNlIHJlYXNvbnMgdGhpcyBpcyBvbmx5IHJlY2FsY3VsYXRlZCB3aGVuIGEgbm9kZSBpcyBhZGRlZCB0byBhIG5ldyBwYXJlbnQsIGkuZS4gSXRcbiAgICAgKiBpcyBub3QgcmVjYWxjdWxhdGVkIHdoZW4gYSBub2RlIGlzIHNpbXBseSByZW1vdmVkIGZyb20gdGhlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZ3JhcGhEZXB0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dyYXBoRGVwdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBHcmFwaCBub2RlIHRvIHVwZGF0ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIGlmIGVuYWJsZWQgaW4gdGhlIGhpZXJhcmNoeSwgZmFsc2UgaWYgZGlzYWJsZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKG5vZGUsIGVuYWJsZWQpIHtcbiAgICAgICAgbm9kZS5fb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQoZW5hYmxlZCk7XG5cbiAgICAgICAgY29uc3QgYyA9IG5vZGUuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGNbaV0uX2VuYWJsZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5fbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKGNbaV0sIGVuYWJsZWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIGVuYWJsZWQgZmxhZyBvZiB0aGUgZW50aXR5IG9yIG9uZSBvZiBpdHMgcGFyZW50cyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gVHJ1ZSBpZiBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHksIGZhbHNlIGlmIGRpc2FibGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkKGVuYWJsZWQpIHtcbiAgICAgICAgLy8gT3ZlcnJpZGUgaW4gZGVyaXZlZCBjbGFzc2VzXG4gICAgICAgIHRoaXMuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGVuYWJsZWQ7XG4gICAgICAgIGlmIChlbmFibGVkICYmICF0aGlzLl9mcm96ZW4pXG4gICAgICAgICAgICB0aGlzLl91bmZyZWV6ZVBhcmVudFRvUm9vdCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7dGhpc30gY2xvbmUgLSBUaGUgY2xvbmVkIGdyYXBoIG5vZGUgdG8gY29weSBpbnRvLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lSW50ZXJuYWwoY2xvbmUpIHtcbiAgICAgICAgY2xvbmUubmFtZSA9IHRoaXMubmFtZTtcblxuICAgICAgICBjb25zdCB0YWdzID0gdGhpcy50YWdzLl9saXN0O1xuICAgICAgICBjbG9uZS50YWdzLmNsZWFyKCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFncy5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIGNsb25lLnRhZ3MuYWRkKHRhZ3NbaV0pO1xuXG4gICAgICAgIGNsb25lLl9sYWJlbHMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9sYWJlbHMpO1xuXG4gICAgICAgIGNsb25lLmxvY2FsUG9zaXRpb24uY29weSh0aGlzLmxvY2FsUG9zaXRpb24pO1xuICAgICAgICBjbG9uZS5sb2NhbFJvdGF0aW9uLmNvcHkodGhpcy5sb2NhbFJvdGF0aW9uKTtcbiAgICAgICAgY2xvbmUubG9jYWxTY2FsZS5jb3B5KHRoaXMubG9jYWxTY2FsZSk7XG4gICAgICAgIGNsb25lLmxvY2FsRXVsZXJBbmdsZXMuY29weSh0aGlzLmxvY2FsRXVsZXJBbmdsZXMpO1xuXG4gICAgICAgIGNsb25lLnBvc2l0aW9uLmNvcHkodGhpcy5wb3NpdGlvbik7XG4gICAgICAgIGNsb25lLnJvdGF0aW9uLmNvcHkodGhpcy5yb3RhdGlvbik7XG4gICAgICAgIGNsb25lLmV1bGVyQW5nbGVzLmNvcHkodGhpcy5ldWxlckFuZ2xlcyk7XG5cbiAgICAgICAgY2xvbmUubG9jYWxUcmFuc2Zvcm0uY29weSh0aGlzLmxvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgY2xvbmUuX2RpcnR5TG9jYWwgPSB0aGlzLl9kaXJ0eUxvY2FsO1xuXG4gICAgICAgIGNsb25lLndvcmxkVHJhbnNmb3JtLmNvcHkodGhpcy53b3JsZFRyYW5zZm9ybSk7XG4gICAgICAgIGNsb25lLl9kaXJ0eVdvcmxkID0gdGhpcy5fZGlydHlXb3JsZDtcbiAgICAgICAgY2xvbmUuX2RpcnR5Tm9ybWFsID0gdGhpcy5fZGlydHlOb3JtYWw7XG4gICAgICAgIGNsb25lLl9hYWJiVmVyID0gdGhpcy5fYWFiYlZlciArIDE7XG5cbiAgICAgICAgY2xvbmUuX2VuYWJsZWQgPSB0aGlzLl9lbmFibGVkO1xuXG4gICAgICAgIGNsb25lLnNjYWxlQ29tcGVuc2F0aW9uID0gdGhpcy5zY2FsZUNvbXBlbnNhdGlvbjtcblxuICAgICAgICAvLyBmYWxzZSBhcyB0aGlzIG5vZGUgaXMgbm90IGluIHRoZSBoaWVyYXJjaHkgeWV0XG4gICAgICAgIGNsb25lLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZSBhIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBjbG9uZSBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgdGhpcy5fY2xvbmVJbnRlcm5hbChjbG9uZSk7XG4gICAgICAgIHJldHVybiBjbG9uZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3B5IGEgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBzb3VyY2UgLSBUaGUgZ3JhcGggbm9kZSB0byBjb3B5LlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV9IFRoZSBkZXN0aW5hdGlvbiBncmFwaCBub2RlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjb3B5KHNvdXJjZSkge1xuICAgICAgICBzb3VyY2UuX2Nsb25lSW50ZXJuYWwodGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZ3JhcGggbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyBmb3IgdGhlIG5vZGVzIHRoYXQgc2F0aXNmeSBzb21lIHNlYXJjaFxuICAgICAqIGNyaXRlcmlhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaW5kTm9kZUNhbGxiYWNrfHN0cmluZ30gYXR0ciAtIFRoaXMgY2FuIGVpdGhlciBiZSBhIGZ1bmN0aW9uIG9yIGEgc3RyaW5nLiBJZiBpdCdzIGFcbiAgICAgKiBmdW5jdGlvbiwgaXQgaXMgZXhlY3V0ZWQgZm9yIGVhY2ggZGVzY2VuZGFudCBub2RlIHRvIHRlc3QgaWYgbm9kZSBzYXRpc2ZpZXMgdGhlIHNlYXJjaFxuICAgICAqIGxvZ2ljLiBSZXR1cm5pbmcgdHJ1ZSBmcm9tIHRoZSBmdW5jdGlvbiB3aWxsIGluY2x1ZGUgdGhlIG5vZGUgaW50byB0aGUgcmVzdWx0cy4gSWYgaXQncyBhXG4gICAgICogc3RyaW5nIHRoZW4gaXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiBhIGZpZWxkIG9yIGEgbWV0aG9kIG9mIHRoZSBub2RlLiBJZiB0aGlzIGlzIHRoZSBuYW1lXG4gICAgICogb2YgYSBmaWVsZCB0aGVuIHRoZSB2YWx1ZSBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB3aWxsIGJlIGNoZWNrZWQgZm9yIGVxdWFsaXR5LiBJZlxuICAgICAqIHRoaXMgaXMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiB0aGVuIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2hlY2tlZCBmb3JcbiAgICAgKiBlcXVhbGl0eSBhZ2FpbnN0IHRoZSB2YWx1ZWQgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgdG8gdGhpcyBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3ZhbHVlXSAtIElmIHRoZSBmaXJzdCBhcmd1bWVudCAoYXR0cikgaXMgYSBwcm9wZXJ0eSBuYW1lIHRoZW4gdGhpcyB2YWx1ZVxuICAgICAqIHdpbGwgYmUgY2hlY2tlZCBhZ2FpbnN0IHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZVtdfSBUaGUgYXJyYXkgb2YgZ3JhcGggbm9kZXMgdGhhdCBtYXRjaCB0aGUgc2VhcmNoIGNyaXRlcmlhLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgYWxsIG5vZGVzIHRoYXQgaGF2ZSBhIG1vZGVsIGNvbXBvbmVudCBhbmQgaGF2ZSBgZG9vcmAgaW4gdGhlaXIgbG93ZXItY2FzZWQgbmFtZVxuICAgICAqIHZhciBkb29ycyA9IGhvdXNlLmZpbmQoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgKiAgICAgcmV0dXJuIG5vZGUubW9kZWwgJiYgbm9kZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZG9vcicpICE9PSAtMTtcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIGFsbCBub2RlcyB0aGF0IGhhdmUgdGhlIG5hbWUgcHJvcGVydHkgc2V0IHRvICdUZXN0J1xuICAgICAqIHZhciBlbnRpdGllcyA9IHBhcmVudC5maW5kKCduYW1lJywgJ1Rlc3QnKTtcbiAgICAgKi9cbiAgICBmaW5kKGF0dHIsIHZhbHVlKSB7XG4gICAgICAgIGxldCByZXN1bHQsIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGZuID0gYXR0cjtcblxuICAgICAgICAgICAgcmVzdWx0ID0gZm4odGhpcyk7XG4gICAgICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh0aGlzKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc2NlbmRhbnRzID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZChmbik7XG4gICAgICAgICAgICAgICAgaWYgKGRlc2NlbmRhbnRzLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuY29uY2F0KGRlc2NlbmRhbnRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB0ZXN0VmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRlc3RWYWx1ZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc2NlbmRhbnRzID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZChhdHRyLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGRlc2NlbmRhbnRzLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuY29uY2F0KGRlc2NlbmRhbnRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZ3JhcGggbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyBmb3IgdGhlIGZpcnN0IG5vZGUgdGhhdCBzYXRpc2ZpZXMgc29tZVxuICAgICAqIHNlYXJjaCBjcml0ZXJpYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmluZE5vZGVDYWxsYmFja3xzdHJpbmd9IGF0dHIgLSBUaGlzIGNhbiBlaXRoZXIgYmUgYSBmdW5jdGlvbiBvciBhIHN0cmluZy4gSWYgaXQncyBhXG4gICAgICogZnVuY3Rpb24sIGl0IGlzIGV4ZWN1dGVkIGZvciBlYWNoIGRlc2NlbmRhbnQgbm9kZSB0byB0ZXN0IGlmIG5vZGUgc2F0aXNmaWVzIHRoZSBzZWFyY2hcbiAgICAgKiBsb2dpYy4gUmV0dXJuaW5nIHRydWUgZnJvbSB0aGUgZnVuY3Rpb24gd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAgICAgKiBmaW5kT25lLiBJZiBpdCdzIGEgc3RyaW5nIHRoZW4gaXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiBhIGZpZWxkIG9yIGEgbWV0aG9kIG9mIHRoZSBub2RlLiBJZlxuICAgICAqIHRoaXMgaXMgdGhlIG5hbWUgb2YgYSBmaWVsZCB0aGVuIHRoZSB2YWx1ZSBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB3aWxsIGJlIGNoZWNrZWQgZm9yXG4gICAgICogZXF1YWxpdHkuIElmIHRoaXMgaXMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiB0aGVuIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHdpbGwgYmVcbiAgICAgKiBjaGVja2VkIGZvciBlcXVhbGl0eSBhZ2FpbnN0IHRoZSB2YWx1ZWQgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgdG8gdGhpcyBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3ZhbHVlXSAtIElmIHRoZSBmaXJzdCBhcmd1bWVudCAoYXR0cikgaXMgYSBwcm9wZXJ0eSBuYW1lIHRoZW4gdGhpcyB2YWx1ZVxuICAgICAqIHdpbGwgYmUgY2hlY2tlZCBhZ2FpbnN0IHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBBIGdyYXBoIG5vZGUgdGhhdCBtYXRjaCB0aGUgc2VhcmNoIGNyaXRlcmlhLiBSZXR1cm5zIG51bGwgaWYgbm9cbiAgICAgKiBub2RlIGlzIGZvdW5kLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZCB0aGUgZmlyc3Qgbm9kZSB0aGF0IGlzIGNhbGxlZCBgaGVhZGAgYW5kIGhhcyBhIG1vZGVsIGNvbXBvbmVudFxuICAgICAqIHZhciBoZWFkID0gcGxheWVyLmZpbmRPbmUoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgKiAgICAgcmV0dXJuIG5vZGUubW9kZWwgJiYgbm9kZS5uYW1lID09PSAnaGVhZCc7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kcyB0aGUgZmlyc3Qgbm9kZSB0aGF0IGhhcyB0aGUgbmFtZSBwcm9wZXJ0eSBzZXQgdG8gJ1Rlc3QnXG4gICAgICogdmFyIG5vZGUgPSBwYXJlbnQuZmluZE9uZSgnbmFtZScsICdUZXN0Jyk7XG4gICAgICovXG4gICAgZmluZE9uZShhdHRyLCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGZuID0gYXR0cjtcblxuICAgICAgICAgICAgcmVzdWx0ID0gZm4odGhpcyk7XG4gICAgICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZE9uZShmbik7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB0ZXN0VmFsdWU7XG4gICAgICAgICAgICBpZiAodGhpc1thdHRyXSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0ZXN0VmFsdWUgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRPbmUoYXR0ciwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIGdyYXBoIG5vZGVzIHRoYXQgc2F0aXNmeSB0aGUgc2VhcmNoIHF1ZXJ5LiBRdWVyeSBjYW4gYmUgc2ltcGx5IGEgc3RyaW5nLCBvciBjb21tYVxuICAgICAqIHNlcGFyYXRlZCBzdHJpbmdzLCB0byBoYXZlIGluY2x1c2l2ZSByZXN1bHRzIG9mIGFzc2V0cyB0aGF0IG1hdGNoIGF0IGxlYXN0IG9uZSBxdWVyeS4gQVxuICAgICAqIHF1ZXJ5IHRoYXQgY29uc2lzdHMgb2YgYW4gYXJyYXkgb2YgdGFncyBjYW4gYmUgdXNlZCB0byBtYXRjaCBncmFwaCBub2RlcyB0aGF0IGhhdmUgZWFjaCB0YWdcbiAgICAgKiBvZiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Li4uKn0gcXVlcnkgLSBOYW1lIG9mIGEgdGFnIG9yIGFycmF5IG9mIHRhZ3MuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZVtdfSBBIGxpc3Qgb2YgYWxsIGdyYXBoIG5vZGVzIHRoYXQgbWF0Y2ggdGhlIHF1ZXJ5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHRhZ2dlZCBieSBgYW5pbWFsYFxuICAgICAqIHZhciBhbmltYWxzID0gbm9kZS5maW5kQnlUYWcoXCJhbmltYWxcIik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIGdyYXBoIG5vZGVzIHRoYXQgdGFnZ2VkIGJ5IGBiaXJkYCBPUiBgbWFtbWFsYFxuICAgICAqIHZhciBiaXJkc0FuZE1hbW1hbHMgPSBub2RlLmZpbmRCeVRhZyhcImJpcmRcIiwgXCJtYW1tYWxcIik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIGFzc2V0cyB0aGF0IHRhZ2dlZCBieSBgY2Fybml2b3JlYCBBTkQgYG1hbW1hbGBcbiAgICAgKiB2YXIgbWVhdEVhdGluZ01hbW1hbHMgPSBub2RlLmZpbmRCeVRhZyhbXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIl0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgKGBjYXJuaXZvcmVgIEFORCBgbWFtbWFsYCkgT1IgKGBjYXJuaXZvcmVgIEFORCBgcmVwdGlsZWApXG4gICAgICogdmFyIG1lYXRFYXRpbmdNYW1tYWxzQW5kUmVwdGlsZXMgPSBub2RlLmZpbmRCeVRhZyhbXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIl0sIFtcImNhcm5pdm9yZVwiLCBcInJlcHRpbGVcIl0pO1xuICAgICAqL1xuICAgIGZpbmRCeVRhZygpIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSBhcmd1bWVudHM7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICBjb25zdCBxdWVyeU5vZGUgPSAobm9kZSwgY2hlY2tOb2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hlY2tOb2RlICYmIG5vZGUudGFncy5oYXMoLi4ucXVlcnkpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcXVlcnlOb2RlKG5vZGUuX2NoaWxkcmVuW2ldLCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBxdWVyeU5vZGUodGhpcywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZmlyc3Qgbm9kZSBmb3VuZCBpbiB0aGUgZ3JhcGggd2l0aCB0aGUgbmFtZS4gVGhlIHNlYXJjaCBpcyBkZXB0aCBmaXJzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGdyYXBoLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV8bnVsbH0gVGhlIGZpcnN0IG5vZGUgdG8gYmUgZm91bmQgbWF0Y2hpbmcgdGhlIHN1cHBsaWVkIG5hbWUuIFJldHVybnNcbiAgICAgKiBudWxsIGlmIG5vIG5vZGUgaXMgZm91bmQuXG4gICAgICovXG4gICAgZmluZEJ5TmFtZShuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLm5hbWUgPT09IG5hbWUpIHJldHVybiB0aGlzO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZEJ5TmFtZShuYW1lKTtcbiAgICAgICAgICAgIGlmIChmb3VuZCAhPT0gbnVsbCkgcmV0dXJuIGZvdW5kO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZmlyc3Qgbm9kZSBmb3VuZCBpbiB0aGUgZ3JhcGggYnkgaXRzIGZ1bGwgcGF0aCBpbiB0aGUgZ3JhcGguIFRoZSBmdWxsIHBhdGggaGFzIHRoaXNcbiAgICAgKiBmb3JtICdwYXJlbnQvY2hpbGQvc3ViLWNoaWxkJy4gVGhlIHNlYXJjaCBpcyBkZXB0aCBmaXJzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBwYXRoIC0gVGhlIGZ1bGwgcGF0aCBvZiB0aGUge0BsaW5rIEdyYXBoTm9kZX0gYXMgZWl0aGVyIGEgc3RyaW5nIG9yXG4gICAgICogYXJyYXkgb2Yge0BsaW5rIEdyYXBoTm9kZX0gbmFtZXMuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBUaGUgZmlyc3Qgbm9kZSB0byBiZSBmb3VuZCBtYXRjaGluZyB0aGUgc3VwcGxpZWQgcGF0aC4gUmV0dXJuc1xuICAgICAqIG51bGwgaWYgbm8gbm9kZSBpcyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFN0cmluZyBmb3JtXG4gICAgICogdmFyIGdyYW5kY2hpbGQgPSB0aGlzLmVudGl0eS5maW5kQnlQYXRoKCdjaGlsZC9ncmFuZGNoaWxkJyk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcnJheSBmb3JtXG4gICAgICogdmFyIGdyYW5kY2hpbGQgPSB0aGlzLmVudGl0eS5maW5kQnlQYXRoKFsnY2hpbGQnLCAnZ3JhbmRjaGlsZCddKTtcbiAgICAgKi9cbiAgICBmaW5kQnlQYXRoKHBhdGgpIHtcbiAgICAgICAgLy8gYWNjZXB0IGVpdGhlciBzdHJpbmcgcGF0aCB3aXRoICcvJyBzZXBhcmF0b3JzIG9yIGFycmF5IG9mIHBhcnRzLlxuICAgICAgICBjb25zdCBwYXJ0cyA9IEFycmF5LmlzQXJyYXkocGF0aCkgPyBwYXRoIDogcGF0aC5zcGxpdCgnLycpO1xuXG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgaW1heCA9IHBhcnRzLmxlbmd0aDsgaSA8IGltYXg7ICsraSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LmNoaWxkcmVuLmZpbmQoYyA9PiBjLm5hbWUgPT09IHBhcnRzW2ldKTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGVzIGEgcHJvdmlkZWQgZnVuY3Rpb24gb25jZSBvbiB0aGlzIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZvckVhY2hOb2RlQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGZ1bmN0aW9uIHRvIGV4ZWN1dGUgb24gdGhlIGdyYXBoIG5vZGUgYW5kIGVhY2hcbiAgICAgKiBkZXNjZW5kYW50LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdGhpc0FyZ10gLSBPcHRpb25hbCB2YWx1ZSB0byB1c2UgYXMgdGhpcyB3aGVuIGV4ZWN1dGluZyBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvZyB0aGUgcGF0aCBhbmQgbmFtZSBvZiBlYWNoIG5vZGUgaW4gZGVzY2VuZGFudCB0cmVlIHN0YXJ0aW5nIHdpdGggXCJwYXJlbnRcIlxuICAgICAqIHBhcmVudC5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKG5vZGUucGF0aCArIFwiL1wiICsgbm9kZS5uYW1lKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBmb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdGhpcyk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2hpbGRyZW5baV0uZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBub2RlIGlzIGRlc2NlbmRhbnQgb2YgYW5vdGhlciBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBQb3RlbnRpYWwgYW5jZXN0b3Igb2Ygbm9kZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgbm9kZSBpcyBkZXNjZW5kYW50IG9mIGFub3RoZXIgbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChyb29mLmlzRGVzY2VuZGFudE9mKGhvdXNlKSkge1xuICAgICAqICAgICAvLyByb29mIGlzIGRlc2NlbmRhbnQgb2YgaG91c2UgZW50aXR5XG4gICAgICogfVxuICAgICAqL1xuICAgIGlzRGVzY2VuZGFudE9mKG5vZGUpIHtcbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHBhcmVudCA9PT0gbm9kZSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50Ll9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIG5vZGUgaXMgYW5jZXN0b3IgZm9yIGFub3RoZXIgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gUG90ZW50aWFsIGRlc2NlbmRhbnQgb2Ygbm9kZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgbm9kZSBpcyBhbmNlc3RvciBmb3IgYW5vdGhlciBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGJvZHkuaXNBbmNlc3Rvck9mKGZvb3QpKSB7XG4gICAgICogICAgIC8vIGZvb3QgaXMgd2l0aGluIGJvZHkncyBoaWVyYXJjaHlcbiAgICAgKiB9XG4gICAgICovXG4gICAgaXNBbmNlc3Rvck9mKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUuaXNEZXNjZW5kYW50T2YodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUgaW4gRXVsZXIgYW5nbGUgZm9ybS4gVGhlIHJvdGF0aW9uXG4gICAgICogaXMgcmV0dXJuZWQgYXMgZXVsZXIgYW5nbGVzIGluIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmVcbiAgICAgKiBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXIgdG8gc2V0IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSwgdXNlXG4gICAgICoge0BsaW5rIEdyYXBoTm9kZSNzZXRFdWxlckFuZ2xlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGluIEV1bGVyIGFuZ2xlIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYW5nbGVzID0gdGhpcy5lbnRpdHkuZ2V0RXVsZXJBbmdsZXMoKTtcbiAgICAgKiBhbmdsZXMueSA9IDE4MDsgLy8gcm90YXRlIHRoZSBlbnRpdHkgYXJvdW5kIFkgYnkgMTgwIGRlZ3JlZXNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIGdldEV1bGVyQW5nbGVzKCkge1xuICAgICAgICB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0RXVsZXJBbmdsZXModGhpcy5ldWxlckFuZ2xlcyk7XG4gICAgICAgIHJldHVybiB0aGlzLmV1bGVyQW5nbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcm90YXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcm90YXRpb24gaXMgcmV0dXJuZWQgYXNcbiAgICAgKiBldWxlciBhbmdsZXMgaW4gYSB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUb1xuICAgICAqIHVwZGF0ZSB0aGUgbG9jYWwgcm90YXRpb24sIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsRXVsZXJBbmdsZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBhcyBldWxlciBhbmdsZXMgaW4gWFlaIG9yZGVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFuZ2xlcyA9IHRoaXMuZW50aXR5LmdldExvY2FsRXVsZXJBbmdsZXMoKTtcbiAgICAgKiBhbmdsZXMueSA9IDE4MDtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxFdWxlckFuZ2xlcygpIHtcbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmdldEV1bGVyQW5nbGVzKHRoaXMubG9jYWxFdWxlckFuZ2xlcyk7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsRXVsZXJBbmdsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwb3NpdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSBwb3NpdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFZlYzN9LiBUaGUgcmV0dXJuZWQgdmVjdG9yIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG8gdXBkYXRlIHRoZSBsb2NhbFxuICAgICAqIHBvc2l0aW9uLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbFBvc2l0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgbG9jYWwgc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcG9zaXRpb24gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICogcG9zaXRpb24ueCArPSAxOyAvLyBtb3ZlIHRoZSBlbnRpdHkgMSB1bml0IGFsb25nIHguXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgZ2V0TG9jYWxQb3NpdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgUXVhdH0uIFRoZSByZXR1cm5lZCBxdWF0ZXJuaW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG8gdXBkYXRlIHRoZSBsb2NhbFxuICAgICAqIHJvdGF0aW9uLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbFJvdGF0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgbG9jYWwgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgYSBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHJvdGF0aW9uID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxSb3RhdGlvbigpO1xuICAgICAqL1xuICAgIGdldExvY2FsUm90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsUm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBzY2FsZSBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSBzY2FsZSBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFZlYzN9LiBUaGUgcmV0dXJuZWQgdmVjdG9yIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG8gdXBkYXRlIHRoZSBsb2NhbCBzY2FsZSxcbiAgICAgKiB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbFNjYWxlfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgbG9jYWwgc3BhY2Ugc2NhbGUgb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc2NhbGUgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFNjYWxlKCk7XG4gICAgICogc2NhbGUueCA9IDEwMDtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFNjYWxlKHNjYWxlKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFNjYWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFNjYWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgbG9jYWwgdHJhbnNmb3JtIG1hdHJpeCBmb3IgdGhpcyBncmFwaCBub2RlLiBUaGlzIG1hdHJpeCBpcyB0aGUgdHJhbnNmb3JtIHJlbGF0aXZlIHRvXG4gICAgICogdGhlIG5vZGUncyBwYXJlbnQncyB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gVGhlIG5vZGUncyBsb2NhbCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdHJhbnNmb3JtID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxUcmFuc2Zvcm0oKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFRyYW5zZm9ybSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMubG9jYWxQb3NpdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uLCB0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgcG9zaXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBJbiBvcmRlclxuICAgICAqIHRvIHNldCB0aGUgd29ybGQtc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldFBvc2l0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcG9zaXRpb24gPSB0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHBvc2l0aW9uLnggPSAxMDtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRUcmFuc2xhdGlvbih0aGlzLnBvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFF1YXR9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIEluIG9yZGVyXG4gICAgICogdG8gc2V0IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0Um90YXRpb259LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBhcyBhIHF1YXRlcm5pb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcm90YXRpb24gPSB0aGlzLmVudGl0eS5nZXRSb3RhdGlvbigpO1xuICAgICAqL1xuICAgIGdldFJvdGF0aW9uKCkge1xuICAgICAgICB0aGlzLnJvdGF0aW9uLnNldEZyb21NYXQ0KHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgIHJldHVybiB0aGlzLnJvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugc2NhbGUgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcmV0dXJuZWQgdmFsdWUgd2lsbCBvbmx5IGJlXG4gICAgICogY29ycmVjdCBmb3IgZ3JhcGggbm9kZXMgdGhhdCBoYXZlIGEgbm9uLXNrZXdlZCB3b3JsZCB0cmFuc2Zvcm0gKGEgc2tldyBjYW4gYmUgaW50cm9kdWNlZCBieVxuICAgICAqIHRoZSBjb21wb3VuZGluZyBvZiByb3RhdGlvbnMgYW5kIHNjYWxlcyBoaWdoZXIgaW4gdGhlIGdyYXBoIG5vZGUgaGllcmFyY2h5KS4gVGhlIHNjYWxlIGlzXG4gICAgICogcmV0dXJuZWQgYXMgYSB7QGxpbmsgVmVjM30uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkXG4gICAgICogcmVhZC1vbmx5LiBOb3RlIHRoYXQgaXQgaXMgbm90IHBvc3NpYmxlIHRvIHNldCB0aGUgd29ybGQgc3BhY2Ugc2NhbGUgb2YgYSBncmFwaCBub2RlXG4gICAgICogZGlyZWN0bHkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHNjYWxlIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0U2NhbGUoKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0U2NhbGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2NhbGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NjYWxlID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFNjYWxlKHRoaXMuX3NjYWxlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBmb3IgdGhpcyBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHRyYW5zZm9ybSA9IHRoaXMuZW50aXR5LmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICovXG4gICAgZ2V0V29ybGRUcmFuc2Zvcm0oKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCAmJiAhdGhpcy5fZGlydHlXb3JsZClcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndvcmxkVHJhbnNmb3JtO1xuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQpXG4gICAgICAgICAgICB0aGlzLl9wYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICB0aGlzLl9zeW5jKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMud29ybGRUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGdyYXBoIG5vZGUgZnJvbSBjdXJyZW50IHBhcmVudCBhbmQgYWRkIGFzIGNoaWxkIHRvIG5ldyBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gcGFyZW50IC0gTmV3IHBhcmVudCB0byBhdHRhY2ggZ3JhcGggbm9kZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2luZGV4XSAtIFRoZSBjaGlsZCBpbmRleCB3aGVyZSB0aGUgY2hpbGQgbm9kZSBzaG91bGQgYmUgcGxhY2VkLlxuICAgICAqL1xuICAgIHJlcGFyZW50KHBhcmVudCwgaW5kZXgpIHtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX3BhcmVudDtcblxuICAgICAgICBpZiAoY3VycmVudClcbiAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlQ2hpbGQodGhpcyk7XG5cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0Q2hpbGQodGhpcywgaW5kZXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuYWRkQ2hpbGQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBsb2NhbC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUgdXNpbmcgZXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlXG4gICAgICogaW50ZXJwcmV0ZWQgaW4gWFlaIG9yZGVyLiBFdWxlcnMgbXVzdCBiZSBzcGVjaWZpZWQgaW4gZGVncmVlcy4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2UgZXVsZXJcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGV1bGVycyBvciByb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2VcbiAgICAgKiB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgeS1heGlzIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB5LWF4aXMgdmlhIGEgdmVjdG9yXG4gICAgICogdmFyIGFuZ2xlcyA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgc2V0TG9jYWxFdWxlckFuZ2xlcyh4LCB5LCB6KSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2UgcG9zaXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZVxuICAgICAqIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2UgcG9zaXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKDAsIDEwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgdmVjdG9yXG4gICAgICogdmFyIHBvcyA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHBvcyk7XG4gICAgICovXG4gICAgc2V0TG9jYWxQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgcXVhdGVybmlvbiBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdHxudW1iZXJ9IHggLSBRdWF0ZXJuaW9uIGhvbGRpbmcgbG9jYWwtc3BhY2Ugcm90YXRpb24gb3IgeC1jb21wb25lbnQgb2ZcbiAgICAgKiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd10gLSBXLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSA0IG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFJvdGF0aW9uKDAsIDAsIDAsIDEpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSBxdWF0ZXJuaW9uXG4gICAgICogdmFyIHEgPSBwYy5RdWF0KCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihxKTtcbiAgICAgKi9cbiAgICBzZXRMb2NhbFJvdGF0aW9uKHgsIHksIHosIHcpIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5zZXQoeCwgeSwgeiwgdyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBsb2NhbC1zcGFjZSBzY2FsZSBmYWN0b3Igb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHNjYWxlIG9yIHgtY29vcmRpbmF0ZVxuICAgICAqIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZSgxMCwgMTAsIDEwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgdmVjdG9yXG4gICAgICogdmFyIHNjYWxlID0gbmV3IHBjLlZlYzMoMTAsIDEwLCAxMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZShzY2FsZSk7XG4gICAgICovXG4gICAgc2V0TG9jYWxTY2FsZSh4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFNjYWxlLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsU2NhbGUuc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RpcnRpZnlMb2NhbCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUxvY2FsID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZClcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91bmZyZWV6ZVBhcmVudFRvUm9vdCgpIHtcbiAgICAgICAgbGV0IHAgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIHdoaWxlIChwKSB7XG4gICAgICAgICAgICBwLl9mcm96ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHAgPSBwLl9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeVdvcmxkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICB0aGlzLl91bmZyZWV6ZVBhcmVudFRvUm9vdCgpO1xuICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICB0aGlzLl9mcm96ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2hpbGRyZW5baV0uX2RpcnR5V29ybGQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fYWFiYlZlcisrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgd29ybGQtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24oMCwgMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqL1xuICAgIHNldFBvc2l0aW9uKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkocG9zaXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW52UGFyZW50V3RtLmNvcHkodGhpcy5fcGFyZW50LmdldFdvcmxkVHJhbnNmb3JtKCkpLmludmVydCgpO1xuICAgICAgICAgICAgaW52UGFyZW50V3RtLnRyYW5zZm9ybVBvaW50KHBvc2l0aW9uLCB0aGlzLmxvY2FsUG9zaXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgcXVhdGVybmlvbiBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgd29ybGQtc3BhY2VcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdHxudW1iZXJ9IHggLSBRdWF0ZXJuaW9uIGhvbGRpbmcgd29ybGQtc3BhY2Ugcm90YXRpb24gb3IgeC1jb21wb25lbnQgb2ZcbiAgICAgKiB3b3JsZC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvbXBvbmVudCBvZiB3b3JsZC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiB3b3JsZC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd10gLSBXLWNvbXBvbmVudCBvZiB3b3JsZC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSA0IG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbigwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgcXVhdGVybmlvblxuICAgICAqIHZhciBxID0gcGMuUXVhdCgpO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKHEpO1xuICAgICAqL1xuICAgIHNldFJvdGF0aW9uKHgsIHksIHosIHcpIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICByb3RhdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm90YXRpb24uc2V0KHgsIHksIHosIHcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkocm90YXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkoaW52UGFyZW50Um90KS5tdWwocm90YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlIHVzaW5nIGV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZVxuICAgICAqIGludGVycHJldGVkIGluIFhZWiBvcmRlci4gRXVsZXJzIG11c3QgYmUgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlIGV1bGVyXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBldWxlcnMgb3Igcm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlXG4gICAgICogeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyB2aWEgYSB2ZWN0b3JcbiAgICAgKiB2YXIgYW5nbGVzID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgc2V0RXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKGludlBhcmVudFJvdCwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIG5ldyBjaGlsZCB0byB0aGUgY2hpbGQgbGlzdCBhbmQgdXBkYXRlIHRoZSBwYXJlbnQgdmFsdWUgb2YgdGhlIGNoaWxkIG5vZGUuXG4gICAgICogSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5ldyBjaGlsZCB0byBhZGQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZSA9IG5ldyBwYy5FbnRpdHkoYXBwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5hZGRDaGlsZChlKTtcbiAgICAgKi9cbiAgICBhZGRDaGlsZChub2RlKSB7XG4gICAgICAgIHRoaXMuX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKTtcbiAgICAgICAgdGhpcy5fY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICAgICAgdGhpcy5fb25JbnNlcnRDaGlsZChub2RlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBjaGlsZCB0byB0aGlzIG5vZGUsIG1haW50YWluaW5nIHRoZSBjaGlsZCdzIHRyYW5zZm9ybSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY2hpbGQgdG8gYWRkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtKGUpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0obm9kZSkge1xuXG4gICAgICAgIGNvbnN0IHdQb3MgPSBub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIGNvbnN0IHdSb3QgPSBub2RlLmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuXG4gICAgICAgIG5vZGUuc2V0UG9zaXRpb24odG1wTWF0NC5jb3B5KHRoaXMud29ybGRUcmFuc2Zvcm0pLmludmVydCgpLnRyYW5zZm9ybVBvaW50KHdQb3MpKTtcbiAgICAgICAgbm9kZS5zZXRSb3RhdGlvbih0bXBRdWF0LmNvcHkodGhpcy5nZXRSb3RhdGlvbigpKS5pbnZlcnQoKS5tdWwod1JvdCkpO1xuXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGEgbmV3IGNoaWxkIHRvIHRoZSBjaGlsZCBsaXN0IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mXG4gICAgICogdGhlIGNoaWxkIG5vZGUuIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBuZXcgY2hpbGQgdG8gaW5zZXJ0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBpbiB0aGUgY2hpbGQgbGlzdCBvZiB0aGUgcGFyZW50IHdoZXJlIHRoZSBuZXcgbm9kZSB3aWxsIGJlXG4gICAgICogaW5zZXJ0ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZSA9IG5ldyBwYy5FbnRpdHkoYXBwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5pbnNlcnRDaGlsZChlLCAxKTtcbiAgICAgKi9cbiAgICBpbnNlcnRDaGlsZChub2RlLCBpbmRleCkge1xuXG4gICAgICAgIHRoaXMuX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKTtcbiAgICAgICAgdGhpcy5fY2hpbGRyZW4uc3BsaWNlKGluZGV4LCAwLCBub2RlKTtcbiAgICAgICAgdGhpcy5fb25JbnNlcnRDaGlsZChub2RlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcmVwYXJlcyBub2RlIGZvciBiZWluZyBpbnNlcnRlZCB0byBhIHBhcmVudCBub2RlLCBhbmQgcmVtb3ZlcyBpdCBmcm9tIHRoZSBwcmV2aW91cyBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBub2RlIGJlaW5nIGluc2VydGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKSB7XG5cbiAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gdGhlIGV4aXN0aW5nIHBhcmVudFxuICAgICAgICBpZiAobm9kZS5fcGFyZW50KSB7XG4gICAgICAgICAgICBub2RlLl9wYXJlbnQucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5hc3NlcnQobm9kZSAhPT0gdGhpcywgYEdyYXBoTm9kZSAke25vZGU/Lm5hbWV9IGNhbm5vdCBiZSBhIGNoaWxkIG9mIGl0c2VsZmApO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuaXNEZXNjZW5kYW50T2Yobm9kZSksIGBHcmFwaE5vZGUgJHtub2RlPy5uYW1lfSBjYW5ub3QgYWRkIGFuIGFuY2VzdG9yIGFzIGEgY2hpbGRgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlcyBhbiBldmVudCBvbiBhbGwgY2hpbGRyZW4gb2YgdGhlIG5vZGUuIFRoZSBldmVudCBgbmFtZWAgaXMgZmlyZWQgb24gdGhlIGZpcnN0IChyb290KVxuICAgICAqIG5vZGUgb25seS4gVGhlIGV2ZW50IGBuYW1lSGllcmFyY2h5YCBpcyBmaXJlZCBmb3IgYWxsIGNoaWxkcmVuLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gZmlyZSBvbiB0aGUgcm9vdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZUhpZXJhcmNoeSAtIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0byBmaXJlIGZvciBhbGwgZGVzY2VuZGFudHMuXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHBhcmVudCAtIFRoZSBwYXJlbnQgb2YgdGhlIG5vZGUgYmVpbmcgYWRkZWQvcmVtb3ZlZCBmcm9tIHRoZSBoaWVyYXJjaHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlyZU9uSGllcmFyY2h5KG5hbWUsIG5hbWVIaWVyYXJjaHksIHBhcmVudCkge1xuICAgICAgICB0aGlzLmZpcmUobmFtZSwgcGFyZW50KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2hpbGRyZW5baV0uX2ZpcmVPbkhpZXJhcmNoeShuYW1lSGllcmFyY2h5LCBuYW1lSGllcmFyY2h5LCBwYXJlbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gYSBub2RlIGlzIGluc2VydGVkIGludG8gYSBub2RlJ3MgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5vZGUgdGhhdCB3YXMgaW5zZXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25JbnNlcnRDaGlsZChub2RlKSB7XG4gICAgICAgIG5vZGUuX3BhcmVudCA9IHRoaXM7XG5cbiAgICAgICAgLy8gdGhlIGNoaWxkIG5vZGUgc2hvdWxkIGJlIGVuYWJsZWQgaW4gdGhlIGhpZXJhcmNoeSBvbmx5IGlmIGl0c2VsZiBpcyBlbmFibGVkIGFuZCBpZlxuICAgICAgICAvLyB0aGlzIHBhcmVudCBpcyBlbmFibGVkXG4gICAgICAgIGNvbnN0IGVuYWJsZWRJbkhpZXJhcmNoeSA9IChub2RlLl9lbmFibGVkICYmIHRoaXMuZW5hYmxlZCk7XG4gICAgICAgIGlmIChub2RlLl9lbmFibGVkSW5IaWVyYXJjaHkgIT09IGVuYWJsZWRJbkhpZXJhcmNoeSkge1xuICAgICAgICAgICAgbm9kZS5fZW5hYmxlZEluSGllcmFyY2h5ID0gZW5hYmxlZEluSGllcmFyY2h5O1xuXG4gICAgICAgICAgICAvLyBwcm9wYWdhdGUgdGhlIGNoYW5nZSB0byB0aGUgY2hpbGRyZW4gLSBuZWNlc3NhcnkgaWYgd2UgcmVwYXJlbnQgYSBub2RlXG4gICAgICAgICAgICAvLyB1bmRlciBhIHBhcmVudCB3aXRoIGEgZGlmZmVyZW50IGVuYWJsZWQgc3RhdGUgKGlmIHdlIHJlcGFyZW50IGEgbm9kZSB0aGF0IGlzXG4gICAgICAgICAgICAvLyBub3QgYWN0aXZlIGluIHRoZSBoaWVyYXJjaHkgdW5kZXIgYSBwYXJlbnQgd2hvIGlzIGFjdGl2ZSBpbiB0aGUgaGllcmFyY2h5IHRoZW5cbiAgICAgICAgICAgIC8vIHdlIHdhbnQgb3VyIG5vZGUgdG8gYmUgYWN0aXZhdGVkKVxuICAgICAgICAgICAgbm9kZS5fbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKG5vZGUsIGVuYWJsZWRJbkhpZXJhcmNoeSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgZ3JhcGggZGVwdGggb2YgdGhlIGNoaWxkIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIHdpbGwgbm93IGNoYW5nZVxuICAgICAgICBub2RlLl91cGRhdGVHcmFwaERlcHRoKCk7XG5cbiAgICAgICAgLy8gVGhlIGNoaWxkIChwbHVzIHN1YmhpZXJhcmNoeSkgd2lsbCBuZWVkIHdvcmxkIHRyYW5zZm9ybXMgdG8gYmUgcmVjYWxjdWxhdGVkXG4gICAgICAgIG5vZGUuX2RpcnRpZnlXb3JsZCgpO1xuICAgICAgICAvLyBub2RlIG1pZ2h0IGJlIGFscmVhZHkgbWFya2VkIGFzIGRpcnR5LCBpbiB0aGF0IGNhc2UgdGhlIHdob2xlIGNoYWluIHN0YXlzIGZyb3plbiwgc28gbGV0J3MgZW5mb3JjZSB1bmZyZWV6ZVxuICAgICAgICBpZiAodGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgbm9kZS5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcblxuICAgICAgICAvLyBhbGVydCBhbiBlbnRpdHkgaGllcmFyY2h5IHRoYXQgaXQgaGFzIGJlZW4gaW5zZXJ0ZWRcbiAgICAgICAgbm9kZS5fZmlyZU9uSGllcmFyY2h5KCdpbnNlcnQnLCAnaW5zZXJ0aGllcmFyY2h5JywgdGhpcyk7XG5cbiAgICAgICAgLy8gYWxlcnQgdGhlIHBhcmVudCB0aGF0IGl0IGhhcyBoYWQgYSBjaGlsZCBpbnNlcnRlZFxuICAgICAgICBpZiAodGhpcy5maXJlKSB0aGlzLmZpcmUoJ2NoaWxkaW5zZXJ0Jywgbm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVjdXJzZSB0aGUgaGllcmFyY2h5IGFuZCB1cGRhdGUgdGhlIGdyYXBoIGRlcHRoIGF0IGVhY2ggbm9kZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUdyYXBoRGVwdGgoKSB7XG4gICAgICAgIHRoaXMuX2dyYXBoRGVwdGggPSB0aGlzLl9wYXJlbnQgPyB0aGlzLl9wYXJlbnQuX2dyYXBoRGVwdGggKyAxIDogMDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl91cGRhdGVHcmFwaERlcHRoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhlIG5vZGUgZnJvbSB0aGUgY2hpbGQgbGlzdCBhbmQgdXBkYXRlIHRoZSBwYXJlbnQgdmFsdWUgb2YgdGhlIGNoaWxkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IGNoaWxkIC0gVGhlIG5vZGUgdG8gcmVtb3ZlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGNoaWxkID0gdGhpcy5lbnRpdHkuY2hpbGRyZW5bMF07XG4gICAgICogdGhpcy5lbnRpdHkucmVtb3ZlQ2hpbGQoY2hpbGQpO1xuICAgICAqL1xuICAgIHJlbW92ZUNoaWxkKGNoaWxkKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fY2hpbGRyZW4uaW5kZXhPZihjaGlsZCk7XG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBmcm9tIGNoaWxkIGxpc3RcbiAgICAgICAgdGhpcy5fY2hpbGRyZW4uc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgICAvLyBDbGVhciBwYXJlbnRcbiAgICAgICAgY2hpbGQuX3BhcmVudCA9IG51bGw7XG5cbiAgICAgICAgLy8gTk9URTogc2VlIFBSICM0MDQ3IC0gdGhpcyBmaXggaXMgcmVtb3ZlZCBmb3Igbm93IGFzIGl0IGJyZWFrcyBvdGhlciB0aGluZ3NcbiAgICAgICAgLy8gbm90aWZ5IHRoZSBjaGlsZCBoaWVyYXJjaHkgaXQgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBwYXJlbnQsXG4gICAgICAgIC8vIHdoaWNoIG1hcmtzIHRoZW0gYXMgbm90IGVuYWJsZWQgaW4gaGllcmFyY2h5XG4gICAgICAgIC8vIGlmIChjaGlsZC5fZW5hYmxlZEluSGllcmFyY2h5KSB7XG4gICAgICAgIC8vICAgICBjaGlsZC5fbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKGNoaWxkLCBmYWxzZSk7XG4gICAgICAgIC8vIH1cblxuICAgICAgICAvLyBhbGVydCBjaGlsZHJlbiB0aGF0IHRoZXkgaGFzIGJlZW4gcmVtb3ZlZFxuICAgICAgICBjaGlsZC5fZmlyZU9uSGllcmFyY2h5KCdyZW1vdmUnLCAncmVtb3ZlaGllcmFyY2h5JywgdGhpcyk7XG5cbiAgICAgICAgLy8gYWxlcnQgdGhlIHBhcmVudCB0aGF0IGl0IGhhcyBoYWQgYSBjaGlsZCByZW1vdmVkXG4gICAgICAgIHRoaXMuZmlyZSgnY2hpbGRyZW1vdmUnLCBjaGlsZCk7XG4gICAgfVxuXG4gICAgX3N5bmMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcblxuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5V29ybGQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLmNvcHkodGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjYWxlQ29tcGVuc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRXb3JsZFNjYWxlO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9wYXJlbnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBhIHBhcmVudCBvZiB0aGUgZmlyc3QgdW5jb21wZW5zYXRlZCBub2RlIHVwIGluIHRoZSBoaWVyYXJjaHkgYW5kIHVzZSBpdHMgc2NhbGUgKiBsb2NhbFNjYWxlXG4gICAgICAgICAgICAgICAgICAgIGxldCBzY2FsZSA9IHRoaXMubG9jYWxTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50OyAvLyBjdXJyZW50IHBhcmVudFxuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50VG9Vc2VTY2FsZUZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChwYXJlbnRUb1VzZVNjYWxlRnJvbSAmJiBwYXJlbnRUb1VzZVNjYWxlRnJvbS5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50VG9Vc2VTY2FsZUZyb20uX3BhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvcG1vc3Qgbm9kZSB3aXRoIHNjYWxlIGNvbXBlbnNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VG9Vc2VTY2FsZUZyb20gPSBwYXJlbnRUb1VzZVNjYWxlRnJvbS5fcGFyZW50OyAvLyBub2RlIHdpdGhvdXQgc2NhbGUgY29tcGVuc2F0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkU2NhbGUgPSBwYXJlbnRUb1VzZVNjYWxlRnJvbS53b3JsZFRyYW5zZm9ybS5nZXRTY2FsZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZS5tdWwyKHBhcmVudFdvcmxkU2NhbGUsIHRoaXMubG9jYWxTY2FsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlID0gc2NhbGVDb21wZW5zYXRlU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUm90YXRpb24gaXMgYXMgdXN1YWxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90Mi5zZXRGcm9tTWF0NChwYXJlbnQud29ybGRUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QubXVsMihzY2FsZUNvbXBlbnNhdGVSb3QyLCB0aGlzLmxvY2FsUm90YXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgbWF0cml4IHRvIHRyYW5zZm9ybSBwb3NpdGlvblxuICAgICAgICAgICAgICAgICAgICBsZXQgdG1hdHJpeCA9IHBhcmVudC53b3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudC5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQubXVsMihwYXJlbnRXb3JsZFNjYWxlLCBwYXJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybS5zZXRUUlMocGFyZW50LndvcmxkVHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKHNjYWxlQ29tcGVuc2F0ZVBvcyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdDIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRtYXRyaXggPSBzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdG1hdHJpeC50cmFuc2Zvcm1Qb2ludCh0aGlzLmxvY2FsUG9zaXRpb24sIHNjYWxlQ29tcGVuc2F0ZVBvcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5zZXRUUlMoc2NhbGVDb21wZW5zYXRlUG9zLCBzY2FsZUNvbXBlbnNhdGVSb3QsIHNjYWxlKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0ubXVsQWZmaW5lMih0aGlzLl9wYXJlbnQud29ybGRUcmFuc2Zvcm0sIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fZGlydHlXb3JsZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cmljZXMgYXQgdGhpcyBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN5bmNIaWVyYXJjaHkoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9mcm96ZW4gPSB0cnVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsIHx8IHRoaXMuX2RpcnR5V29ybGQpIHtcbiAgICAgICAgICAgIHRoaXMuX3N5bmMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY2hpbGRyZW5baV0uc3luY0hpZXJhcmNoeSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVvcmllbnRzIHRoZSBncmFwaCBub2RlIHNvIHRoYXQgdGhlIG5lZ2F0aXZlIHotYXhpcyBwb2ludHMgdG93YXJkcyB0aGUgdGFyZ2V0LiBUaGlzXG4gICAgICogZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzLiBFaXRoZXIgcGFzcyAzRCB2ZWN0b3JzIGZvciB0aGUgbG9vayBhdCBjb29yZGluYXRlIGFuZCB1cFxuICAgICAqIHZlY3Rvciwgb3IgcGFzcyBudW1iZXJzIHRvIHJlcHJlc2VudCB0aGUgdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBJZiBwYXNzaW5nIGEgM0QgdmVjdG9yLCB0aGlzIGlzIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogT3RoZXJ3aXNlLCBpdCBpcyB0aGUgeC1jb21wb25lbnQgb2YgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBJZiBwYXNzaW5nIGEgM0QgdmVjdG9yLCB0aGlzIGlzIHRoZSB3b3JsZC1zcGFjZSB1cCB2ZWN0b3IgZm9yIGxvb2sgYXRcbiAgICAgKiB0cmFuc2Zvcm0uIE90aGVyd2lzZSwgaXQgaXMgdGhlIHktY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1eD0wXSAtIFgtY29tcG9uZW50IG9mIHRoZSB1cCB2ZWN0b3IgZm9yIHRoZSBsb29rIGF0IHRyYW5zZm9ybS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3V5PTFdIC0gWS1jb21wb25lbnQgb2YgdGhlIHVwIHZlY3RvciBmb3IgdGhlIGxvb2sgYXQgdHJhbnNmb3JtLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXo9MF0gLSBaLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IGFub3RoZXIgZW50aXR5LCB1c2luZyB0aGUgKGRlZmF1bHQpIHBvc2l0aXZlIHktYXhpcyBmb3IgdXBcbiAgICAgKiB2YXIgcG9zaXRpb24gPSBvdGhlckVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdChwb3NpdGlvbik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IGFub3RoZXIgZW50aXR5LCB1c2luZyB0aGUgbmVnYXRpdmUgd29ybGQgeS1heGlzIGZvciB1cFxuICAgICAqIHZhciBwb3NpdGlvbiA9IG90aGVyRW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KHBvc2l0aW9uLCBwYy5WZWMzLkRPV04pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCB0aGUgd29ybGQgc3BhY2Ugb3JpZ2luLCB1c2luZyB0aGUgKGRlZmF1bHQpIHBvc2l0aXZlIHktYXhpcyBmb3IgdXBcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQoMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgWzEwLCAxMCwgMTBdLCB1c2luZyB0aGUgbmVnYXRpdmUgd29ybGQgeS1heGlzIGZvciB1cFxuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdCgxMCwgMTAsIDEwLCAwLCAtMSwgMCk7XG4gICAgICovXG4gICAgbG9va0F0KHgsIHksIHosIHV4ID0gMCwgdXkgPSAxLCB1eiA9IDApIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0YXJnZXQuY29weSh4KTtcblxuICAgICAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBWZWMzKSB7IC8vIHZlYzMsIHZlYzNcbiAgICAgICAgICAgICAgICB1cC5jb3B5KHkpO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gdmVjM1xuICAgICAgICAgICAgICAgIHVwLmNvcHkoVmVjMy5VUCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoeiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXQuc2V0KHgsIHksIHopO1xuICAgICAgICAgICAgdXAuc2V0KHV4LCB1eSwgdXopO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0cml4LnNldExvb2tBdCh0aGlzLmdldFBvc2l0aW9uKCksIHRhcmdldCwgdXApO1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tTWF0NChtYXRyaXgpO1xuICAgICAgICB0aGlzLnNldFJvdGF0aW9uKHJvdGF0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2xhdGVzIHRoZSBncmFwaCBub2RlIGluIHdvcmxkLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgdHJhbnNsYXRpb24gdmVjdG9yLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZVxuICAgICAqIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2UgdHJhbnNsYXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGUoMTAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdCA9IG5ldyBwYy5WZWMzKDEwLCAwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGUodCk7XG4gICAgICovXG4gICAgdHJhbnNsYXRlKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgcG9zaXRpb24uYWRkKHRoaXMuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gbG9jYWwtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCB0cmFuc2xhdGlvbiB2ZWN0b3IuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlXG4gICAgICogbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZUxvY2FsKDEwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHQgPSBuZXcgcGMuVmVjMygxMCwgMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlTG9jYWwodCk7XG4gICAgICovXG4gICAgdHJhbnNsYXRlTG9jYWwoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24udHJhbnNmb3JtVmVjdG9yKHBvc2l0aW9uLCBwb3NpdGlvbik7XG4gICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5hZGQocG9zaXRpb24pO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJvdGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCBFdWxlciBhbmdsZXMuIEV1bGVycyBhcmUgc3BlY2lmaWVkIGluXG4gICAgICogZGVncmVlcyBpbiBYWVogb3JkZXIuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0RcbiAgICAgKiB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2Ugcm90YXRpb24gb3JcbiAgICAgKiByb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGUoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGUocik7XG4gICAgICovXG4gICAgcm90YXRlKHgsIHksIHopIHtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKHJvdGF0aW9uLCB0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgcm90ID0gdGhpcy5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgICAgIGludlBhcmVudFJvdC5jb3B5KHBhcmVudFJvdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICByb3RhdGlvbi5tdWwyKGludlBhcmVudFJvdCwgcm90YXRpb24pO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIocm90YXRpb24sIHJvdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSb3RhdGVzIHRoZSBncmFwaCBub2RlIGluIGxvY2FsLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgRXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlIHNwZWNpZmllZCBpblxuICAgICAqIGRlZ3JlZXMgaW4gWFlaIG9yZGVyLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEXG4gICAgICogdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZSByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9yXG4gICAgICogcm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlTG9jYWwoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGVMb2NhbChyKTtcbiAgICAgKi9cbiAgICByb3RhdGVMb2NhbCh4LCB5LCB6KSB7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsKHJvdGF0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdyYXBoTm9kZSB9O1xuIl0sIm5hbWVzIjpbInNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybSIsIk1hdDQiLCJzY2FsZUNvbXBlbnNhdGVQb3MiLCJWZWMzIiwic2NhbGVDb21wZW5zYXRlUm90IiwiUXVhdCIsInNjYWxlQ29tcGVuc2F0ZVJvdDIiLCJzY2FsZUNvbXBlbnNhdGVTY2FsZSIsInNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50IiwidG1wTWF0NCIsInRtcFF1YXQiLCJwb3NpdGlvbiIsImludlBhcmVudFd0bSIsInJvdGF0aW9uIiwiaW52UGFyZW50Um90IiwibWF0cml4IiwidGFyZ2V0IiwidXAiLCJHcmFwaE5vZGUiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJ0YWdzIiwiVGFncyIsIl9sYWJlbHMiLCJsb2NhbFBvc2l0aW9uIiwibG9jYWxSb3RhdGlvbiIsImxvY2FsU2NhbGUiLCJsb2NhbEV1bGVyQW5nbGVzIiwiZXVsZXJBbmdsZXMiLCJfc2NhbGUiLCJsb2NhbFRyYW5zZm9ybSIsIl9kaXJ0eUxvY2FsIiwiX2FhYmJWZXIiLCJfZnJvemVuIiwid29ybGRUcmFuc2Zvcm0iLCJfZGlydHlXb3JsZCIsIl9ub3JtYWxNYXRyaXgiLCJNYXQzIiwiX2RpcnR5Tm9ybWFsIiwiX3JpZ2h0IiwiX3VwIiwiX2ZvcndhcmQiLCJfcGFyZW50IiwiX2NoaWxkcmVuIiwiX2dyYXBoRGVwdGgiLCJfZW5hYmxlZCIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJzY2FsZUNvbXBlbnNhdGlvbiIsInJpZ2h0IiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJnZXRYIiwibm9ybWFsaXplIiwiZ2V0WSIsImZvcndhcmQiLCJnZXRaIiwibXVsU2NhbGFyIiwibm9ybWFsTWF0cml4Iiwibm9ybWFsTWF0IiwiaW52ZXJ0VG8zeDMiLCJ0cmFuc3Bvc2UiLCJlbmFibGVkIiwiX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsInBhcmVudCIsInBhdGgiLCJub2RlIiwicmVzdWx0Iiwicm9vdCIsImNoaWxkcmVuIiwiZ3JhcGhEZXB0aCIsIl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsImMiLCJpIiwibGVuIiwibGVuZ3RoIiwiX3VuZnJlZXplUGFyZW50VG9Sb290IiwiX2Nsb25lSW50ZXJuYWwiLCJjbG9uZSIsIl9saXN0IiwiY2xlYXIiLCJhZGQiLCJPYmplY3QiLCJhc3NpZ24iLCJjb3B5Iiwic291cmNlIiwiZmluZCIsImF0dHIiLCJ2YWx1ZSIsInJlc3VsdHMiLCJGdW5jdGlvbiIsImZuIiwicHVzaCIsImRlc2NlbmRhbnRzIiwiY29uY2F0IiwidGVzdFZhbHVlIiwiZmluZE9uZSIsImZpbmRCeVRhZyIsInF1ZXJ5IiwiYXJndW1lbnRzIiwicXVlcnlOb2RlIiwiY2hlY2tOb2RlIiwiaGFzIiwiZmluZEJ5TmFtZSIsImZvdW5kIiwiZmluZEJ5UGF0aCIsInBhcnRzIiwiQXJyYXkiLCJpc0FycmF5Iiwic3BsaXQiLCJpbWF4IiwiZm9yRWFjaCIsImNhbGxiYWNrIiwidGhpc0FyZyIsImNhbGwiLCJpc0Rlc2NlbmRhbnRPZiIsImlzQW5jZXN0b3JPZiIsImdldEV1bGVyQW5nbGVzIiwiZ2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldExvY2FsUG9zaXRpb24iLCJnZXRMb2NhbFJvdGF0aW9uIiwiZ2V0TG9jYWxTY2FsZSIsImdldExvY2FsVHJhbnNmb3JtIiwic2V0VFJTIiwiZ2V0UG9zaXRpb24iLCJnZXRUcmFuc2xhdGlvbiIsImdldFJvdGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRTY2FsZSIsIl9zeW5jIiwicmVwYXJlbnQiLCJpbmRleCIsImN1cnJlbnQiLCJyZW1vdmVDaGlsZCIsImluc2VydENoaWxkIiwiYWRkQ2hpbGQiLCJzZXRMb2NhbEV1bGVyQW5nbGVzIiwieCIsInkiLCJ6Iiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiX2RpcnRpZnlMb2NhbCIsInNldExvY2FsUG9zaXRpb24iLCJzZXQiLCJzZXRMb2NhbFJvdGF0aW9uIiwidyIsInNldExvY2FsU2NhbGUiLCJfZGlydGlmeVdvcmxkIiwicCIsIl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCIsInNldFBvc2l0aW9uIiwiaW52ZXJ0IiwidHJhbnNmb3JtUG9pbnQiLCJzZXRSb3RhdGlvbiIsInBhcmVudFJvdCIsIm11bCIsInNldEV1bGVyQW5nbGVzIiwibXVsMiIsIl9wcmVwYXJlSW5zZXJ0Q2hpbGQiLCJfb25JbnNlcnRDaGlsZCIsImFkZENoaWxkQW5kU2F2ZVRyYW5zZm9ybSIsIndQb3MiLCJ3Um90Iiwic3BsaWNlIiwiRGVidWciLCJhc3NlcnQiLCJfZmlyZU9uSGllcmFyY2h5IiwibmFtZUhpZXJhcmNoeSIsImZpcmUiLCJlbmFibGVkSW5IaWVyYXJjaHkiLCJfdXBkYXRlR3JhcGhEZXB0aCIsImNoaWxkIiwiaW5kZXhPZiIsInBhcmVudFdvcmxkU2NhbGUiLCJzY2FsZSIsInBhcmVudFRvVXNlU2NhbGVGcm9tIiwidG1hdHJpeCIsIm11bEFmZmluZTIiLCJzeW5jSGllcmFyY2h5IiwibG9va0F0IiwidXgiLCJ1eSIsInV6IiwiVVAiLCJ1bmRlZmluZWQiLCJzZXRMb29rQXQiLCJ0cmFuc2xhdGUiLCJ0cmFuc2xhdGVMb2NhbCIsInRyYW5zZm9ybVZlY3RvciIsInJvdGF0ZSIsInJvdCIsInJvdGF0ZUxvY2FsIl0s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
