import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';
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
function createTest(attr, value) {
  if (attr instanceof Function) {
    return attr;
  }
  return node => {
    let x = node[attr];
    if (x instanceof Function) {
      x = x();
    }
    return x === value;
  };
}
function findNode(node, test) {
  if (test(node)) return node;
  const children = node._children;
  const len = children.length;
  for (let i = 0; i < len; ++i) {
    const result = findNode(children[i], test);
    if (result) return result;
  }
  return null;
}
class GraphNode extends EventHandler {
  constructor(name = 'Untitled') {
    super();
    this.name = void 0;
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
    this._worldScaleSign = 0;
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
    this.name = name;
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
      normalMat.invertMat4(this.getWorldTransform()).transpose();
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
  destroy() {
    this.remove();
    const children = this._children;
    while (children.length) {
      const child = children.pop();
      child._parent = null;
      child.destroy();
    }
    this.fire('destroy', this);
    this.off();
  }
  find(attr, value) {
    const results = [];
    const test = createTest(attr, value);
    this.forEach(node => {
      if (test(node)) results.push(node);
    });
    return results;
  }
  findOne(attr, value) {
    const test = createTest(attr, value);
    return findNode(this, test);
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
    return this.findOne('name', name);
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
    const len = children.length;
    for (let i = 0; i < len; ++i) {
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
  get worldScaleSign() {
    if (this._worldScaleSign === 0) {
      this._worldScaleSign = this.getWorldTransform().scaleSign;
    }
    return this._worldScaleSign;
  }
  remove() {
    var _this$_parent2;
    (_this$_parent2 = this._parent) == null || _this$_parent2.removeChild(this);
  }
  reparent(parent, index) {
    this.remove();
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
    this._worldScaleSign = 0;
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
    node.remove();
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
