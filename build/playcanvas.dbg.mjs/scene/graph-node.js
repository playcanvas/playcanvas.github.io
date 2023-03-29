/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
const _worldMatX = new Vec3();
const _worldMatY = new Vec3();
const _worldMatZ = new Vec3();

/**
 * Callback used by {@link GraphNode#find} and {@link GraphNode#findOne} to search through a graph
 * node and all of its descendants.
 *
 * @callback FindNodeCallback
 * @param {GraphNode} node - The current graph node.
 * @returns {boolean} Returning `true` will result in that node being returned from
 * {@link GraphNode#find} or {@link GraphNode#findOne}.
 */

/**
 * Callback used by {@link GraphNode#forEach} to iterate through a graph node and all of its
 * descendants.
 *
 * @callback ForEachNodeCallback
 * @param {GraphNode} node - The current graph node.
 */

/**
 * A hierarchical scene node.
 *
 * @augments EventHandler
 */
class GraphNode extends EventHandler {
  /**
   * Create a new GraphNode instance.
   *
   * @param {string} [name] - The non-unique name of a graph node. Defaults to 'Untitled'.
   */
  constructor(name = 'Untitled') {
    super();

    /**
     * The non-unique name of a graph node. Defaults to 'Untitled'.
     *
     * @type {string}
     */
    this.name = name;

    /**
     * Interface for tagging graph nodes. Tag based searches can be performed using the
     * {@link GraphNode#findByTag} function.
     *
     * @type {Tags}
     */
    this.tags = new Tags(this);

    /** @private */
    this._labels = {};

    // Local-space properties of transform (only first 3 are settable by the user)
    /**
     * @type {Vec3}
     * @private
     */
    this.localPosition = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    this.localRotation = new Quat();

    /**
     * @type {Vec3}
     * @private
     */
    this.localScale = new Vec3(1, 1, 1);

    /**
     * @type {Vec3}
     * @private
     */
    this.localEulerAngles = new Vec3(); // Only calculated on request

    // World-space properties of transform
    /**
     * @type {Vec3}
     * @private
     */
    this.position = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    this.rotation = new Quat();

    /**
     * @type {Vec3}
     * @private
     */
    this.eulerAngles = new Vec3();

    /**
     * @type {Vec3|null}
     * @private
     */
    this._scale = null;

    /**
     * @type {Mat4}
     * @private
     */
    this.localTransform = new Mat4();

    /**
     * @type {boolean}
     * @private
     */
    this._dirtyLocal = false;

    /**
     * @type {boolean}
     * @private
     */
    this._wasDirty = false;

    /**
     * @type {number}
     * @private
     */
    this._aabbVer = 0;

    /**
     * Marks the node to ignore hierarchy sync entirely (including children nodes). The engine
     * code automatically freezes and unfreezes objects whenever required. Segregating dynamic
     * and stationary nodes into subhierarchies allows to reduce sync time significantly.
     *
     * @type {boolean}
     * @private
     */
    this._frozen = false;

    /**
     * @type {Mat4}
     * @private
     */
    this.worldTransform = new Mat4();

    /**
     * @type {boolean}
     * @private
     */
    this._dirtyWorld = false;

    /**
     * Cached value representing the negatively scaled world transform. If the value is 0,
     * this marks this value as dirty and it needs to be recalculated. If the value is 1, the
     * world transform is not negatively scaled. If the value is -1, the world transform is
     * negatively scaled.
     *
     * @type {number}
     * @private
     */
    this._negativeScaleWorld = 0;

    /**
     * @type {Mat3}
     * @private
     */
    this._normalMatrix = new Mat3();

    /**
     * @type {boolean}
     * @private
     */
    this._dirtyNormal = true;

    /**
     * @type {Vec3|null}
     * @private
     */
    this._right = null;

    /**
     * @type {Vec3|null}
     * @private
     */
    this._up = null;

    /**
     * @type {Vec3|null}
     * @private
     */
    this._forward = null;

    /**
     * @type {GraphNode|null}
     * @private
     */
    this._parent = null;

    /**
     * @type {GraphNode[]}
     * @private
     */
    this._children = [];

    /**
     * @type {number}
     * @private
     */
    this._graphDepth = 0;

    /**
     * Represents enabled state of the entity. If the entity is disabled, the entity including
     * all children are excluded from updates.
     *
     * @type {boolean}
     * @private
     */
    this._enabled = true;

    /**
     * Represents enabled state of the entity in the hierarchy. It's true only if this entity
     * and all parent entities all the way to the scene's root are enabled.
     *
     * @type {boolean}
     * @private
     */
    this._enabledInHierarchy = false;

    /**
     * @type {boolean}
     * @ignore
     */
    this.scaleCompensation = false;
  }

  /**
   * The normalized local space X-axis vector of the graph node in world space.
   *
   * @type {Vec3}
   */
  get right() {
    if (!this._right) {
      this._right = new Vec3();
    }
    return this.getWorldTransform().getX(this._right).normalize();
  }

  /**
   * The normalized local space Y-axis vector of the graph node in world space.
   *
   * @type {Vec3}
   */
  get up() {
    if (!this._up) {
      this._up = new Vec3();
    }
    return this.getWorldTransform().getY(this._up).normalize();
  }

  /**
   * The normalized local space negative Z-axis vector of the graph node in world space.
   *
   * @type {Vec3}
   */
  get forward() {
    if (!this._forward) {
      this._forward = new Vec3();
    }
    return this.getWorldTransform().getZ(this._forward).normalize().mulScalar(-1);
  }

  /**
   * A matrix used to transform the normal.
   *
   * @type  {Mat3}
   * @ignore
   */
  get normalMatrix() {
    const normalMat = this._normalMatrix;
    if (this._dirtyNormal) {
      this.getWorldTransform().invertTo3x3(normalMat);
      normalMat.transpose();
      this._dirtyNormal = false;
    }
    return normalMat;
  }

  /**
   * Enable or disable a GraphNode. If one of the GraphNode's parents is disabled there will be
   * no other side effects. If all the parents are enabled then the new value will activate or
   * deactivate all the enabled children of the GraphNode.
   *
   * @type {boolean}
   */
  set enabled(enabled) {
    if (this._enabled !== enabled) {
      var _this$_parent;
      this._enabled = enabled;

      // if enabling entity, make all children enabled in hierarchy only when the parent is as well
      // if disabling entity, make all children disabled in hierarchy in all cases
      if (enabled && (_this$_parent = this._parent) != null && _this$_parent.enabled || !enabled) {
        this._notifyHierarchyStateChanged(this, enabled);
      }
    }
  }
  get enabled() {
    // make sure to check this._enabled too because if that
    // was false when a parent was updated the _enabledInHierarchy
    // flag may not have been updated for optimization purposes
    return this._enabled && this._enabledInHierarchy;
  }

  /**
   * A read-only property to get a parent graph node.
   *
   * @type {GraphNode|null}
   */
  get parent() {
    return this._parent;
  }

  /**
   * A read-only property to get the path of the graph node relative to the root of the hierarchy.
   *
   * @type {string}
   */
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

  /**
   * A read-only property to get highest graph node from current node.
   *
   * @type {GraphNode}
   */
  get root() {
    let result = this;
    while (result._parent) {
      result = result._parent;
    }
    return result;
  }

  /**
   * A read-only property to get the children of this graph node.
   *
   * @type {GraphNode[]}
   */
  get children() {
    return this._children;
  }

  /**
   * A read-only property to get the depth of this child within the graph. Note that for
   * performance reasons this is only recalculated when a node is added to a new parent, i.e. It
   * is not recalculated when a node is simply removed from the graph.
   *
   * @type {number}
   */
  get graphDepth() {
    return this._graphDepth;
  }

  /**
   * @param {GraphNode} node - Graph node to update.
   * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
   * @private
   */
  _notifyHierarchyStateChanged(node, enabled) {
    node._onHierarchyStateChanged(enabled);
    const c = node._children;
    for (let i = 0, len = c.length; i < len; i++) {
      if (c[i]._enabled) this._notifyHierarchyStateChanged(c[i], enabled);
    }
  }

  /**
   * Called when the enabled flag of the entity or one of its parents changes.
   *
   * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
   * @private
   */
  _onHierarchyStateChanged(enabled) {
    // Override in derived classes
    this._enabledInHierarchy = enabled;
    if (enabled && !this._frozen) this._unfreezeParentToRoot();
  }

  /**
   * @param {this} clone - The cloned graph node to copy into.
   * @private
   */
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

    // false as this node is not in the hierarchy yet
    clone._enabledInHierarchy = false;
  }

  /**
   * Clone a graph node.
   *
   * @returns {this} A clone of the specified graph node.
   */
  clone() {
    const clone = new this.constructor();
    this._cloneInternal(clone);
    return clone;
  }

  /**
   * Copy a graph node.
   *
   * @param {GraphNode} source - The graph node to copy.
   * @returns {GraphNode} The destination graph node.
   * @ignore
   */
  copy(source) {
    source._cloneInternal(this);
    return this;
  }

  /**
   * Search the graph node and all of its descendants for the nodes that satisfy some search
   * criteria.
   *
   * @param {FindNodeCallback|string} attr - This can either be a function or a string. If it's a
   * function, it is executed for each descendant node to test if node satisfies the search
   * logic. Returning true from the function will include the node into the results. If it's a
   * string then it represents the name of a field or a method of the node. If this is the name
   * of a field then the value passed as the second argument will be checked for equality. If
   * this is the name of a function then the return value of the function will be checked for
   * equality against the valued passed as the second argument to this function.
   * @param {object} [value] - If the first argument (attr) is a property name then this value
   * will be checked against the value of the property.
   * @returns {GraphNode[]} The array of graph nodes that match the search criteria.
   * @example
   * // Finds all nodes that have a model component and have 'door' in their lower-cased name
   * var doors = house.find(function (node) {
   *     return node.model && node.name.toLowerCase().indexOf('door') !== -1;
   * });
   * @example
   * // Finds all nodes that have the name property set to 'Test'
   * var entities = parent.find('name', 'Test');
   */
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

  /**
   * Search the graph node and all of its descendants for the first node that satisfies some
   * search criteria.
   *
   * @param {FindNodeCallback|string} attr - This can either be a function or a string. If it's a
   * function, it is executed for each descendant node to test if node satisfies the search
   * logic. Returning true from the function will result in that node being returned from
   * findOne. If it's a string then it represents the name of a field or a method of the node. If
   * this is the name of a field then the value passed as the second argument will be checked for
   * equality. If this is the name of a function then the return value of the function will be
   * checked for equality against the valued passed as the second argument to this function.
   * @param {object} [value] - If the first argument (attr) is a property name then this value
   * will be checked against the value of the property.
   * @returns {GraphNode|null} A graph node that match the search criteria. Returns null if no
   * node is found.
   * @example
   * // Find the first node that is called 'head' and has a model component
   * var head = player.findOne(function (node) {
   *     return node.model && node.name === 'head';
   * });
   * @example
   * // Finds the first node that has the name property set to 'Test'
   * var node = parent.findOne('name', 'Test');
   */
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

  /**
   * Return all graph nodes that satisfy the search query. Query can be simply a string, or comma
   * separated strings, to have inclusive results of assets that match at least one query. A
   * query that consists of an array of tags can be used to match graph nodes that have each tag
   * of array.
   *
   * @param {...*} query - Name of a tag or array of tags.
   * @returns {GraphNode[]} A list of all graph nodes that match the query.
   * @example
   * // Return all graph nodes that tagged by `animal`
   * var animals = node.findByTag("animal");
   * @example
   * // Return all graph nodes that tagged by `bird` OR `mammal`
   * var birdsAndMammals = node.findByTag("bird", "mammal");
   * @example
   * // Return all assets that tagged by `carnivore` AND `mammal`
   * var meatEatingMammals = node.findByTag(["carnivore", "mammal"]);
   * @example
   * // Return all assets that tagged by (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
   * var meatEatingMammalsAndReptiles = node.findByTag(["carnivore", "mammal"], ["carnivore", "reptile"]);
   */
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

  /**
   * Get the first node found in the graph with the name. The search is depth first.
   *
   * @param {string} name - The name of the graph.
   * @returns {GraphNode|null} The first node to be found matching the supplied name. Returns
   * null if no node is found.
   */
  findByName(name) {
    if (this.name === name) return this;
    for (let i = 0; i < this._children.length; i++) {
      const found = this._children[i].findByName(name);
      if (found !== null) return found;
    }
    return null;
  }

  /**
   * Get the first node found in the graph by its full path in the graph. The full path has this
   * form 'parent/child/sub-child'. The search is depth first.
   *
   * @param {string|string[]} path - The full path of the {@link GraphNode} as either a string or
   * array of {@link GraphNode} names.
   * @returns {GraphNode|null} The first node to be found matching the supplied path. Returns
   * null if no node is found.
   * @example
   * // String form
   * var grandchild = this.entity.findByPath('child/grandchild');
   * @example
   * // Array form
   * var grandchild = this.entity.findByPath(['child', 'grandchild']);
   */
  findByPath(path) {
    // accept either string path with '/' separators or array of parts.
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

  /**
   * Executes a provided function once on this graph node and all of its descendants.
   *
   * @param {ForEachNodeCallback} callback - The function to execute on the graph node and each
   * descendant.
   * @param {object} [thisArg] - Optional value to use as this when executing callback function.
   * @example
   * // Log the path and name of each node in descendant tree starting with "parent"
   * parent.forEach(function (node) {
   *     console.log(node.path + "/" + node.name);
   * });
   */
  forEach(callback, thisArg) {
    callback.call(thisArg, this);
    const children = this._children;
    for (let i = 0; i < children.length; i++) {
      children[i].forEach(callback, thisArg);
    }
  }

  /**
   * Check if node is descendant of another node.
   *
   * @param {GraphNode} node - Potential ancestor of node.
   * @returns {boolean} If node is descendant of another node.
   * @example
   * if (roof.isDescendantOf(house)) {
   *     // roof is descendant of house entity
   * }
   */
  isDescendantOf(node) {
    let parent = this._parent;
    while (parent) {
      if (parent === node) return true;
      parent = parent._parent;
    }
    return false;
  }

  /**
   * Check if node is ancestor for another node.
   *
   * @param {GraphNode} node - Potential descendant of node.
   * @returns {boolean} If node is ancestor for another node.
   * @example
   * if (body.isAncestorOf(foot)) {
   *     // foot is within body's hierarchy
   * }
   */
  isAncestorOf(node) {
    return node.isDescendantOf(this);
  }

  /**
   * Get the world space rotation for the specified GraphNode in Euler angle form. The rotation
   * is returned as euler angles in a {@link Vec3}. The value returned by this function should be
   * considered read-only. In order to set the world-space rotation of the graph node, use
   * {@link GraphNode#setEulerAngles}.
   *
   * @returns {Vec3} The world space rotation of the graph node in Euler angle form.
   * @example
   * var angles = this.entity.getEulerAngles();
   * angles.y = 180; // rotate the entity around Y by 180 degrees
   * this.entity.setEulerAngles(angles);
   */
  getEulerAngles() {
    this.getWorldTransform().getEulerAngles(this.eulerAngles);
    return this.eulerAngles;
  }

  /**
   * Get the rotation in local space for the specified GraphNode. The rotation is returned as
   * euler angles in a {@link Vec3}. The returned vector should be considered read-only. To
   * update the local rotation, use {@link GraphNode#setLocalEulerAngles}.
   *
   * @returns {Vec3} The local space rotation of the graph node as euler angles in XYZ order.
   * @example
   * var angles = this.entity.getLocalEulerAngles();
   * angles.y = 180;
   * this.entity.setLocalEulerAngles(angles);
   */
  getLocalEulerAngles() {
    this.localRotation.getEulerAngles(this.localEulerAngles);
    return this.localEulerAngles;
  }

  /**
   * Get the position in local space for the specified GraphNode. The position is returned as a
   * {@link Vec3}. The returned vector should be considered read-only. To update the local
   * position, use {@link GraphNode#setLocalPosition}.
   *
   * @returns {Vec3} The local space position of the graph node.
   * @example
   * var position = this.entity.getLocalPosition();
   * position.x += 1; // move the entity 1 unit along x.
   * this.entity.setLocalPosition(position);
   */
  getLocalPosition() {
    return this.localPosition;
  }

  /**
   * Get the rotation in local space for the specified GraphNode. The rotation is returned as a
   * {@link Quat}. The returned quaternion should be considered read-only. To update the local
   * rotation, use {@link GraphNode#setLocalRotation}.
   *
   * @returns {Quat} The local space rotation of the graph node as a quaternion.
   * @example
   * var rotation = this.entity.getLocalRotation();
   */
  getLocalRotation() {
    return this.localRotation;
  }

  /**
   * Get the scale in local space for the specified GraphNode. The scale is returned as a
   * {@link Vec3}. The returned vector should be considered read-only. To update the local scale,
   * use {@link GraphNode#setLocalScale}.
   *
   * @returns {Vec3} The local space scale of the graph node.
   * @example
   * var scale = this.entity.getLocalScale();
   * scale.x = 100;
   * this.entity.setLocalScale(scale);
   */
  getLocalScale() {
    return this.localScale;
  }

  /**
   * Get the local transform matrix for this graph node. This matrix is the transform relative to
   * the node's parent's world transformation matrix.
   *
   * @returns {Mat4} The node's local transformation matrix.
   * @example
   * var transform = this.entity.getLocalTransform();
   */
  getLocalTransform() {
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this._dirtyLocal = false;
    }
    return this.localTransform;
  }

  /**
   * Get the world space position for the specified GraphNode. The position is returned as a
   * {@link Vec3}. The value returned by this function should be considered read-only. In order
   * to set the world-space position of the graph node, use {@link GraphNode#setPosition}.
   *
   * @returns {Vec3} The world space position of the graph node.
   * @example
   * var position = this.entity.getPosition();
   * position.x = 10;
   * this.entity.setPosition(position);
   */
  getPosition() {
    this.getWorldTransform().getTranslation(this.position);
    return this.position;
  }

  /**
   * Get the world space rotation for the specified GraphNode. The rotation is returned as a
   * {@link Quat}. The value returned by this function should be considered read-only. In order
   * to set the world-space rotation of the graph node, use {@link GraphNode#setRotation}.
   *
   * @returns {Quat} The world space rotation of the graph node as a quaternion.
   * @example
   * var rotation = this.entity.getRotation();
   */
  getRotation() {
    this.rotation.setFromMat4(this.getWorldTransform());
    return this.rotation;
  }

  /**
   * Get the world space scale for the specified GraphNode. The returned value will only be
   * correct for graph nodes that have a non-skewed world transform (a skew can be introduced by
   * the compounding of rotations and scales higher in the graph node hierarchy). The scale is
   * returned as a {@link Vec3}. The value returned by this function should be considered
   * read-only. Note that it is not possible to set the world space scale of a graph node
   * directly.
   *
   * @returns {Vec3} The world space scale of the graph node.
   * @example
   * var scale = this.entity.getScale();
   * @ignore
   */
  getScale() {
    if (!this._scale) {
      this._scale = new Vec3();
    }
    return this.getWorldTransform().getScale(this._scale);
  }

  /**
   * Get the world transformation matrix for this graph node.
   *
   * @returns {Mat4} The node's world transformation matrix.
   * @example
   * var transform = this.entity.getWorldTransform();
   */
  getWorldTransform() {
    if (!this._dirtyLocal && !this._dirtyWorld) return this.worldTransform;
    if (this._parent) this._parent.getWorldTransform();
    this._sync();
    return this.worldTransform;
  }

  /**
   * Returns cached value of negative scale of the world transform.
   *
   * @returns {number} -1 if world transform has negative scale, 1 otherwise.
   * @ignore
   */
  get negativeScaleWorld() {
    if (this._negativeScaleWorld === 0) {
      const wt = this.getWorldTransform();
      wt.getX(_worldMatX);
      wt.getY(_worldMatY);
      wt.getZ(_worldMatZ);
      _worldMatX.cross(_worldMatX, _worldMatY);
      this._negativeScaleWorld = _worldMatX.dot(_worldMatZ) < 0 ? -1 : 1;
    }
    return this._negativeScaleWorld;
  }

  /**
   * Remove graph node from current parent and add as child to new parent.
   *
   * @param {GraphNode} parent - New parent to attach graph node to.
   * @param {number} [index] - The child index where the child node should be placed.
   */
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

  /**
   * Sets the local-space rotation of the specified graph node using euler angles. Eulers are
   * interpreted in XYZ order. Eulers must be specified in degrees. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the local-space euler
   * rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around local-space
   * x-axis in degrees.
   * @param {number} [y] - Rotation around local-space y-axis in degrees.
   * @param {number} [z] - Rotation around local-space z-axis in degrees.
   * @example
   * // Set rotation of 90 degrees around y-axis via 3 numbers
   * this.entity.setLocalEulerAngles(0, 90, 0);
   * @example
   * // Set rotation of 90 degrees around y-axis via a vector
   * var angles = new pc.Vec3(0, 90, 0);
   * this.entity.setLocalEulerAngles(angles);
   */
  setLocalEulerAngles(x, y, z) {
    this.localRotation.setFromEulerAngles(x, y, z);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the local-space position of the specified graph node. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the local-space
   * position.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space position or
   * x-coordinate of local-space position.
   * @param {number} [y] - Y-coordinate of local-space position.
   * @param {number} [z] - Z-coordinate of local-space position.
   * @example
   * // Set via 3 numbers
   * this.entity.setLocalPosition(0, 10, 0);
   * @example
   * // Set via vector
   * var pos = new pc.Vec3(0, 10, 0);
   * this.entity.setLocalPosition(pos);
   */
  setLocalPosition(x, y, z) {
    if (x instanceof Vec3) {
      this.localPosition.copy(x);
    } else {
      this.localPosition.set(x, y, z);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the local-space rotation of the specified graph node. This function has two valid
   * signatures: you can either pass a quaternion or 3 numbers to specify the local-space
   * rotation.
   *
   * @param {Quat|number} x - Quaternion holding local-space rotation or x-component of
   * local-space quaternion rotation.
   * @param {number} [y] - Y-component of local-space quaternion rotation.
   * @param {number} [z] - Z-component of local-space quaternion rotation.
   * @param {number} [w] - W-component of local-space quaternion rotation.
   * @example
   * // Set via 4 numbers
   * this.entity.setLocalRotation(0, 0, 0, 1);
   * @example
   * // Set via quaternion
   * var q = pc.Quat();
   * this.entity.setLocalRotation(q);
   */
  setLocalRotation(x, y, z, w) {
    if (x instanceof Quat) {
      this.localRotation.copy(x);
    } else {
      this.localRotation.set(x, y, z, w);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Sets the local-space scale factor of the specified graph node. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the local-space scale.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space scale or x-coordinate
   * of local-space scale.
   * @param {number} [y] - Y-coordinate of local-space scale.
   * @param {number} [z] - Z-coordinate of local-space scale.
   * @example
   * // Set via 3 numbers
   * this.entity.setLocalScale(10, 10, 10);
   * @example
   * // Set via vector
   * var scale = new pc.Vec3(10, 10, 10);
   * this.entity.setLocalScale(scale);
   */
  setLocalScale(x, y, z) {
    if (x instanceof Vec3) {
      this.localScale.copy(x);
    } else {
      this.localScale.set(x, y, z);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /** @private */
  _dirtifyLocal() {
    if (!this._dirtyLocal) {
      this._dirtyLocal = true;
      this._wasDirty = true;
      if (!this._dirtyWorld) this._dirtifyWorld();
    }
  }

  /** @private */
  _unfreezeParentToRoot() {
    let p = this._parent;
    while (p) {
      p._frozen = false;
      p = p._parent;
    }
  }

  /** @private */
  _dirtifyWorld() {
    if (!this._dirtyWorld) this._unfreezeParentToRoot();
    this._dirtifyWorldInternal();
  }

  /** @private */
  _dirtifyWorldInternal() {
    if (!this._dirtyWorld) {
      this._frozen = false;
      this._dirtyWorld = true;
      for (let i = 0; i < this._children.length; i++) {
        if (!this._children[i]._dirtyWorld) this._children[i]._dirtifyWorldInternal();
      }
    }
    this._dirtyNormal = true;
    this._negativeScaleWorld = 0; // world matrix is dirty, mark this flag dirty too
    this._aabbVer++;
  }

  /**
   * Sets the world-space position of the specified graph node. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the world-space
   * position.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding world-space position or
   * x-coordinate of world-space position.
   * @param {number} [y] - Y-coordinate of world-space position.
   * @param {number} [z] - Z-coordinate of world-space position.
   * @example
   * // Set via 3 numbers
   * this.entity.setPosition(0, 10, 0);
   * @example
   * // Set via vector
   * var position = new pc.Vec3(0, 10, 0);
   * this.entity.setPosition(position);
   */
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

  /**
   * Sets the world-space rotation of the specified graph node. This function has two valid
   * signatures: you can either pass a quaternion or 3 numbers to specify the world-space
   * rotation.
   *
   * @param {Quat|number} x - Quaternion holding world-space rotation or x-component of
   * world-space quaternion rotation.
   * @param {number} [y] - Y-component of world-space quaternion rotation.
   * @param {number} [z] - Z-component of world-space quaternion rotation.
   * @param {number} [w] - W-component of world-space quaternion rotation.
   * @example
   * // Set via 4 numbers
   * this.entity.setRotation(0, 0, 0, 1);
   * @example
   * // Set via quaternion
   * var q = pc.Quat();
   * this.entity.setRotation(q);
   */
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

  /**
   * Sets the world-space rotation of the specified graph node using euler angles. Eulers are
   * interpreted in XYZ order. Eulers must be specified in degrees. This function has two valid
   * signatures: you can either pass a 3D vector or 3 numbers to specify the world-space euler
   * rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around world-space
   * x-axis in degrees.
   * @param {number} [y] - Rotation around world-space y-axis in degrees.
   * @param {number} [z] - Rotation around world-space z-axis in degrees.
   * @example
   * // Set rotation of 90 degrees around world-space y-axis via 3 numbers
   * this.entity.setEulerAngles(0, 90, 0);
   * @example
   * // Set rotation of 90 degrees around world-space y-axis via a vector
   * var angles = new pc.Vec3(0, 90, 0);
   * this.entity.setEulerAngles(angles);
   */
  setEulerAngles(x, y, z) {
    this.localRotation.setFromEulerAngles(x, y, z);
    if (this._parent !== null) {
      const parentRot = this._parent.getRotation();
      invParentRot.copy(parentRot).invert();
      this.localRotation.mul2(invParentRot, this.localRotation);
    }
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Add a new child to the child list and update the parent value of the child node.
   * If the node already had a parent, it is removed from its child list.
   *
   * @param {GraphNode} node - The new child to add.
   * @example
   * var e = new pc.Entity(app);
   * this.entity.addChild(e);
   */
  addChild(node) {
    this._prepareInsertChild(node);
    this._children.push(node);
    this._onInsertChild(node);
  }

  /**
   * Add a child to this node, maintaining the child's transform in world space.
   * If the node already had a parent, it is removed from its child list.
   *
   * @param {GraphNode} node - The child to add.
   * @example
   * var e = new pc.Entity(app);
   * this.entity.addChildAndSaveTransform(e);
   * @ignore
   */
  addChildAndSaveTransform(node) {
    const wPos = node.getPosition();
    const wRot = node.getRotation();
    this._prepareInsertChild(node);
    node.setPosition(tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
    node.setRotation(tmpQuat.copy(this.getRotation()).invert().mul(wRot));
    this._children.push(node);
    this._onInsertChild(node);
  }

  /**
   * Insert a new child to the child list at the specified index and update the parent value of
   * the child node. If the node already had a parent, it is removed from its child list.
   *
   * @param {GraphNode} node - The new child to insert.
   * @param {number} index - The index in the child list of the parent where the new node will be
   * inserted.
   * @example
   * var e = new pc.Entity(app);
   * this.entity.insertChild(e, 1);
   */
  insertChild(node, index) {
    this._prepareInsertChild(node);
    this._children.splice(index, 0, node);
    this._onInsertChild(node);
  }

  /**
   * Prepares node for being inserted to a parent node, and removes it from the previous parent.
   *
   * @param {GraphNode} node - The node being inserted.
   * @private
   */
  _prepareInsertChild(node) {
    // remove it from the existing parent
    if (node._parent) {
      node._parent.removeChild(node);
    }
    Debug.assert(node !== this, `GraphNode ${node == null ? void 0 : node.name} cannot be a child of itself`);
    Debug.assert(!this.isDescendantOf(node), `GraphNode ${node == null ? void 0 : node.name} cannot add an ancestor as a child`);
  }

  /**
   * Fires an event on all children of the node. The event `name` is fired on the first (root)
   * node only. The event `nameHierarchy` is fired for all children.
   *
   * @param {string} name - The name of the event to fire on the root.
   * @param {string} nameHierarchy - The name of the event to fire for all descendants.
   * @param {GraphNode} parent - The parent of the node being added/removed from the hierarchy.
   * @private
   */
  _fireOnHierarchy(name, nameHierarchy, parent) {
    this.fire(name, parent);
    for (let i = 0; i < this._children.length; i++) {
      this._children[i]._fireOnHierarchy(nameHierarchy, nameHierarchy, parent);
    }
  }

  /**
   * Called when a node is inserted into a node's child list.
   *
   * @param {GraphNode} node - The node that was inserted.
   * @private
   */
  _onInsertChild(node) {
    node._parent = this;

    // the child node should be enabled in the hierarchy only if itself is enabled and if
    // this parent is enabled
    const enabledInHierarchy = node._enabled && this.enabled;
    if (node._enabledInHierarchy !== enabledInHierarchy) {
      node._enabledInHierarchy = enabledInHierarchy;

      // propagate the change to the children - necessary if we reparent a node
      // under a parent with a different enabled state (if we reparent a node that is
      // not active in the hierarchy under a parent who is active in the hierarchy then
      // we want our node to be activated)
      node._notifyHierarchyStateChanged(node, enabledInHierarchy);
    }

    // The graph depth of the child and all of its descendants will now change
    node._updateGraphDepth();

    // The child (plus subhierarchy) will need world transforms to be recalculated
    node._dirtifyWorld();
    // node might be already marked as dirty, in that case the whole chain stays frozen, so let's enforce unfreeze
    if (this._frozen) node._unfreezeParentToRoot();

    // alert an entity hierarchy that it has been inserted
    node._fireOnHierarchy('insert', 'inserthierarchy', this);

    // alert the parent that it has had a child inserted
    if (this.fire) this.fire('childinsert', node);
  }

  /**
   * Recurse the hierarchy and update the graph depth at each node.
   *
   * @private
   */
  _updateGraphDepth() {
    this._graphDepth = this._parent ? this._parent._graphDepth + 1 : 0;
    for (let i = 0, len = this._children.length; i < len; i++) {
      this._children[i]._updateGraphDepth();
    }
  }

  /**
   * Remove the node from the child list and update the parent value of the child.
   *
   * @param {GraphNode} child - The node to remove.
   * @example
   * var child = this.entity.children[0];
   * this.entity.removeChild(child);
   */
  removeChild(child) {
    const index = this._children.indexOf(child);
    if (index === -1) {
      return;
    }

    // Remove from child list
    this._children.splice(index, 1);

    // Clear parent
    child._parent = null;

    // NOTE: see PR #4047 - this fix is removed for now as it breaks other things
    // notify the child hierarchy it has been removed from the parent,
    // which marks them as not enabled in hierarchy
    // if (child._enabledInHierarchy) {
    //     child._notifyHierarchyStateChanged(child, false);
    // }

    // alert children that they has been removed
    child._fireOnHierarchy('remove', 'removehierarchy', this);

    // alert the parent that it has had a child removed
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

          // Find a parent of the first uncompensated node up in the hierarchy and use its scale * localScale
          let scale = this.localScale;
          let parentToUseScaleFrom = parent; // current parent
          if (parentToUseScaleFrom) {
            while (parentToUseScaleFrom && parentToUseScaleFrom.scaleCompensation) {
              parentToUseScaleFrom = parentToUseScaleFrom._parent;
            }
            // topmost node with scale compensation
            if (parentToUseScaleFrom) {
              parentToUseScaleFrom = parentToUseScaleFrom._parent; // node without scale compensation
              if (parentToUseScaleFrom) {
                parentWorldScale = parentToUseScaleFrom.worldTransform.getScale();
                scaleCompensateScale.mul2(parentWorldScale, this.localScale);
                scale = scaleCompensateScale;
              }
            }
          }

          // Rotation is as usual
          scaleCompensateRot2.setFromMat4(parent.worldTransform);
          scaleCompensateRot.mul2(scaleCompensateRot2, this.localRotation);

          // Find matrix to transform position
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

  /**
   * Updates the world transformation matrices at this node and all of its descendants.
   *
   * @ignore
   */
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

  /**
   * Reorients the graph node so that the negative z-axis points towards the target. This
   * function has two valid signatures. Either pass 3D vectors for the look at coordinate and up
   * vector, or pass numbers to represent the vectors.
   *
   * @param {Vec3|number} x - If passing a 3D vector, this is the world-space coordinate to look at.
   * Otherwise, it is the x-component of the world-space coordinate to look at.
   * @param {Vec3|number} [y] - If passing a 3D vector, this is the world-space up vector for look at
   * transform. Otherwise, it is the y-component of the world-space coordinate to look at.
   * @param {number} [z] - Z-component of the world-space coordinate to look at.
   * @param {number} [ux=0] - X-component of the up vector for the look at transform.
   * @param {number} [uy=1] - Y-component of the up vector for the look at transform.
   * @param {number} [uz=0] - Z-component of the up vector for the look at transform.
   * @example
   * // Look at another entity, using the (default) positive y-axis for up
   * var position = otherEntity.getPosition();
   * this.entity.lookAt(position);
   * @example
   * // Look at another entity, using the negative world y-axis for up
   * var position = otherEntity.getPosition();
   * this.entity.lookAt(position, pc.Vec3.DOWN);
   * @example
   * // Look at the world space origin, using the (default) positive y-axis for up
   * this.entity.lookAt(0, 0, 0);
   * @example
   * // Look at world-space coordinate [10, 10, 10], using the negative world y-axis for up
   * this.entity.lookAt(10, 10, 10, 0, -1, 0);
   */
  lookAt(x, y, z, ux = 0, uy = 1, uz = 0) {
    if (x instanceof Vec3) {
      target.copy(x);
      if (y instanceof Vec3) {
        // vec3, vec3
        up.copy(y);
      } else {
        // vec3
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

  /**
   * Translates the graph node in world-space by the specified translation vector. This function
   * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
   * world-space translation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding world-space translation or
   * x-coordinate of world-space translation.
   * @param {number} [y] - Y-coordinate of world-space translation.
   * @param {number} [z] - Z-coordinate of world-space translation.
   * @example
   * // Translate via 3 numbers
   * this.entity.translate(10, 0, 0);
   * @example
   * // Translate via vector
   * var t = new pc.Vec3(10, 0, 0);
   * this.entity.translate(t);
   */
  translate(x, y, z) {
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }
    position.add(this.getPosition());
    this.setPosition(position);
  }

  /**
   * Translates the graph node in local-space by the specified translation vector. This function
   * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
   * local-space translation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space translation or
   * x-coordinate of local-space translation.
   * @param {number} [y] - Y-coordinate of local-space translation.
   * @param {number} [z] - Z-coordinate of local-space translation.
   * @example
   * // Translate via 3 numbers
   * this.entity.translateLocal(10, 0, 0);
   * @example
   * // Translate via vector
   * var t = new pc.Vec3(10, 0, 0);
   * this.entity.translateLocal(t);
   */
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

  /**
   * Rotates the graph node in world-space by the specified Euler angles. Eulers are specified in
   * degrees in XYZ order. This function has two valid signatures: you can either pass a 3D
   * vector or 3 numbers to specify the world-space rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding world-space rotation or
   * rotation around world-space x-axis in degrees.
   * @param {number} [y] - Rotation around world-space y-axis in degrees.
   * @param {number} [z] - Rotation around world-space z-axis in degrees.
   * @example
   * // Rotate via 3 numbers
   * this.entity.rotate(0, 90, 0);
   * @example
   * // Rotate via vector
   * var r = new pc.Vec3(0, 90, 0);
   * this.entity.rotate(r);
   */
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

  /**
   * Rotates the graph node in local-space by the specified Euler angles. Eulers are specified in
   * degrees in XYZ order. This function has two valid signatures: you can either pass a 3D
   * vector or 3 numbers to specify the local-space rotation.
   *
   * @param {Vec3|number} x - 3-dimensional vector holding local-space rotation or
   * rotation around local-space x-axis in degrees.
   * @param {number} [y] - Rotation around local-space y-axis in degrees.
   * @param {number} [z] - Rotation around local-space z-axis in degrees.
   * @example
   * // Rotate via 3 numbers
   * this.entity.rotateLocal(0, 90, 0);
   * @example
   * // Rotate via vector
   * var r = new pc.Vec3(0, 90, 0);
   * this.entity.rotateLocal(r);
   */
  rotateLocal(x, y, z) {
    rotation.setFromEulerAngles(x, y, z);
    this.localRotation.mul(rotation);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }
}

export { GraphNode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuY29uc3Qgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvcyA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBNYXQ0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRtcFF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbmNvbnN0IGludlBhcmVudFJvdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuY29uc3QgdGFyZ2V0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHVwID0gbmV3IFZlYzMoKTtcbmNvbnN0IF93b3JsZE1hdFggPSBuZXcgVmVjMygpO1xuY29uc3QgX3dvcmxkTWF0WSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfd29ybGRNYXRaID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZmluZH0gYW5kIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0gdG8gc2VhcmNoIHRocm91Z2ggYSBncmFwaFxuICogbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmluZE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybmluZyBgdHJ1ZWAgd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAqIHtAbGluayBHcmFwaE5vZGUjZmluZH0gb3Ige0BsaW5rIEdyYXBoTm9kZSNmaW5kT25lfS5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEdyYXBoTm9kZSNmb3JFYWNofSB0byBpdGVyYXRlIHRocm91Z2ggYSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzXG4gKiBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRm9yRWFjaE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICovXG5cbi8qKlxuICogQSBoaWVyYXJjaGljYWwgc2NlbmUgbm9kZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoTm9kZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEdyYXBoTm9kZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBUaGUgbm9uLXVuaXF1ZSBuYW1lIG9mIGEgZ3JhcGggbm9kZS4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lID0gJ1VudGl0bGVkJykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9uLXVuaXF1ZSBuYW1lIG9mIGEgZ3JhcGggbm9kZS4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEludGVyZmFjZSBmb3IgdGFnZ2luZyBncmFwaCBub2Rlcy4gVGFnIGJhc2VkIHNlYXJjaGVzIGNhbiBiZSBwZXJmb3JtZWQgdXNpbmcgdGhlXG4gICAgICAgICAqIHtAbGluayBHcmFwaE5vZGUjZmluZEJ5VGFnfSBmdW5jdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RhZ3N9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fbGFiZWxzID0ge307XG5cbiAgICAgICAgLy8gTG9jYWwtc3BhY2UgcHJvcGVydGllcyBvZiB0cmFuc2Zvcm0gKG9ubHkgZmlyc3QgMyBhcmUgc2V0dGFibGUgYnkgdGhlIHVzZXIpXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsU2NhbGUgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsRXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpOyAvLyBPbmx5IGNhbGN1bGF0ZWQgb24gcmVxdWVzdFxuXG4gICAgICAgIC8vIFdvcmxkLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NhbGUgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl93YXNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYWFiYlZlciA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1hcmtzIHRoZSBub2RlIHRvIGlnbm9yZSBoaWVyYXJjaHkgc3luYyBlbnRpcmVseSAoaW5jbHVkaW5nIGNoaWxkcmVuIG5vZGVzKS4gVGhlIGVuZ2luZVxuICAgICAgICAgKiBjb2RlIGF1dG9tYXRpY2FsbHkgZnJlZXplcyBhbmQgdW5mcmVlemVzIG9iamVjdHMgd2hlbmV2ZXIgcmVxdWlyZWQuIFNlZ3JlZ2F0aW5nIGR5bmFtaWNcbiAgICAgICAgICogYW5kIHN0YXRpb25hcnkgbm9kZXMgaW50byBzdWJoaWVyYXJjaGllcyBhbGxvd3MgdG8gcmVkdWNlIHN5bmMgdGltZSBzaWduaWZpY2FudGx5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2Zyb3plbiA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FjaGVkIHZhbHVlIHJlcHJlc2VudGluZyB0aGUgbmVnYXRpdmVseSBzY2FsZWQgd29ybGQgdHJhbnNmb3JtLiBJZiB0aGUgdmFsdWUgaXMgMCxcbiAgICAgICAgICogdGhpcyBtYXJrcyB0aGlzIHZhbHVlIGFzIGRpcnR5IGFuZCBpdCBuZWVkcyB0byBiZSByZWNhbGN1bGF0ZWQuIElmIHRoZSB2YWx1ZSBpcyAxLCB0aGVcbiAgICAgICAgICogd29ybGQgdHJhbnNmb3JtIGlzIG5vdCBuZWdhdGl2ZWx5IHNjYWxlZC4gSWYgdGhlIHZhbHVlIGlzIC0xLCB0aGUgd29ybGQgdHJhbnNmb3JtIGlzXG4gICAgICAgICAqIG5lZ2F0aXZlbHkgc2NhbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbmVnYXRpdmVTY2FsZVdvcmxkID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge01hdDN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9ub3JtYWxNYXRyaXggPSBuZXcgTWF0MygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3JpZ2h0ID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3VwID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2ZvcndhcmQgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wYXJlbnQgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhOb2RlW119XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jaGlsZHJlbiA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZ3JhcGhEZXB0aCA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlcHJlc2VudHMgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5LiBJZiB0aGUgZW50aXR5IGlzIGRpc2FibGVkLCB0aGUgZW50aXR5IGluY2x1ZGluZ1xuICAgICAgICAgKiBhbGwgY2hpbGRyZW4gYXJlIGV4Y2x1ZGVkIGZyb20gdXBkYXRlcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVwcmVzZW50cyBlbmFibGVkIHN0YXRlIG9mIHRoZSBlbnRpdHkgaW4gdGhlIGhpZXJhcmNoeS4gSXQncyB0cnVlIG9ubHkgaWYgdGhpcyBlbnRpdHlcbiAgICAgICAgICogYW5kIGFsbCBwYXJlbnQgZW50aXRpZXMgYWxsIHRoZSB3YXkgdG8gdGhlIHNjZW5lJ3Mgcm9vdCBhcmUgZW5hYmxlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NhbGVDb21wZW5zYXRpb24gPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBYLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHJpZ2h0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9yaWdodCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRYKHRoaXMuX3JpZ2h0KS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBZLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHVwKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3VwKSB7XG4gICAgICAgICAgICB0aGlzLl91cCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRZKHRoaXMuX3VwKS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBuZWdhdGl2ZSBaLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IGZvcndhcmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZm9yd2FyZCkge1xuICAgICAgICAgICAgdGhpcy5fZm9yd2FyZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRaKHRoaXMuX2ZvcndhcmQpLm5vcm1hbGl6ZSgpLm11bFNjYWxhcigtMSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBtYXRyaXggdXNlZCB0byB0cmFuc2Zvcm0gdGhlIG5vcm1hbC5cbiAgICAgKlxuICAgICAqIEB0eXBlICB7TWF0M31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IG5vcm1hbE1hdHJpeCgpIHtcblxuICAgICAgICBjb25zdCBub3JtYWxNYXQgPSB0aGlzLl9ub3JtYWxNYXRyaXg7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eU5vcm1hbCkge1xuICAgICAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmludmVydFRvM3gzKG5vcm1hbE1hdCk7XG4gICAgICAgICAgICBub3JtYWxNYXQudHJhbnNwb3NlKCk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vcm1hbE1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgb3IgZGlzYWJsZSBhIEdyYXBoTm9kZS4gSWYgb25lIG9mIHRoZSBHcmFwaE5vZGUncyBwYXJlbnRzIGlzIGRpc2FibGVkIHRoZXJlIHdpbGwgYmVcbiAgICAgKiBubyBvdGhlciBzaWRlIGVmZmVjdHMuIElmIGFsbCB0aGUgcGFyZW50cyBhcmUgZW5hYmxlZCB0aGVuIHRoZSBuZXcgdmFsdWUgd2lsbCBhY3RpdmF0ZSBvclxuICAgICAqIGRlYWN0aXZhdGUgYWxsIHRoZSBlbmFibGVkIGNoaWxkcmVuIG9mIHRoZSBHcmFwaE5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZW5hYmxlZChlbmFibGVkKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICE9PSBlbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gZW5hYmxlZDtcblxuICAgICAgICAgICAgLy8gaWYgZW5hYmxpbmcgZW50aXR5LCBtYWtlIGFsbCBjaGlsZHJlbiBlbmFibGVkIGluIGhpZXJhcmNoeSBvbmx5IHdoZW4gdGhlIHBhcmVudCBpcyBhcyB3ZWxsXG4gICAgICAgICAgICAvLyBpZiBkaXNhYmxpbmcgZW50aXR5LCBtYWtlIGFsbCBjaGlsZHJlbiBkaXNhYmxlZCBpbiBoaWVyYXJjaHkgaW4gYWxsIGNhc2VzXG4gICAgICAgICAgICBpZiAoZW5hYmxlZCAmJiB0aGlzLl9wYXJlbnQ/LmVuYWJsZWQgfHwgIWVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQodGhpcywgZW5hYmxlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgLy8gbWFrZSBzdXJlIHRvIGNoZWNrIHRoaXMuX2VuYWJsZWQgdG9vIGJlY2F1c2UgaWYgdGhhdFxuICAgICAgICAvLyB3YXMgZmFsc2Ugd2hlbiBhIHBhcmVudCB3YXMgdXBkYXRlZCB0aGUgX2VuYWJsZWRJbkhpZXJhcmNoeVxuICAgICAgICAvLyBmbGFnIG1heSBub3QgaGF2ZSBiZWVuIHVwZGF0ZWQgZm9yIG9wdGltaXphdGlvbiBwdXJwb3Nlc1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZCAmJiB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IGEgcGFyZW50IGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHBhcmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgdGhlIHBhdGggb2YgdGhlIGdyYXBoIG5vZGUgcmVsYXRpdmUgdG8gdGhlIHJvb3Qgb2YgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICAgIGxldCBub2RlID0gdGhpcy5fcGFyZW50O1xuICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzLm5hbWU7XG4gICAgICAgIHdoaWxlIChub2RlICYmIG5vZGUuX3BhcmVudCkge1xuICAgICAgICAgICAgcmVzdWx0ID0gYCR7bm9kZS5uYW1lfS8ke3Jlc3VsdH1gO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCBoaWdoZXN0IGdyYXBoIG5vZGUgZnJvbSBjdXJyZW50IG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfVxuICAgICAqL1xuICAgIGdldCByb290KCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgd2hpbGUgKHJlc3VsdC5fcGFyZW50KSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgY2hpbGRyZW4gb2YgdGhpcyBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAqL1xuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NoaWxkcmVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgZGVwdGggb2YgdGhpcyBjaGlsZCB3aXRoaW4gdGhlIGdyYXBoLiBOb3RlIHRoYXQgZm9yXG4gICAgICogcGVyZm9ybWFuY2UgcmVhc29ucyB0aGlzIGlzIG9ubHkgcmVjYWxjdWxhdGVkIHdoZW4gYSBub2RlIGlzIGFkZGVkIHRvIGEgbmV3IHBhcmVudCwgaS5lLiBJdFxuICAgICAqIGlzIG5vdCByZWNhbGN1bGF0ZWQgd2hlbiBhIG5vZGUgaXMgc2ltcGx5IHJlbW92ZWQgZnJvbSB0aGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBncmFwaERlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ3JhcGhEZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIEdyYXBoIG5vZGUgdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5LCBmYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQobm9kZSwgZW5hYmxlZCkge1xuICAgICAgICBub2RlLl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKTtcblxuICAgICAgICBjb25zdCBjID0gbm9kZS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY1tpXS5fZW5hYmxlZClcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQoY1tpXSwgZW5hYmxlZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgZW5hYmxlZCBmbGFnIG9mIHRoZSBlbnRpdHkgb3Igb25lIG9mIGl0cyBwYXJlbnRzIGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIGlmIGVuYWJsZWQgaW4gdGhlIGhpZXJhcmNoeSwgZmFsc2UgaWYgZGlzYWJsZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQoZW5hYmxlZCkge1xuICAgICAgICAvLyBPdmVycmlkZSBpbiBkZXJpdmVkIGNsYXNzZXNcbiAgICAgICAgdGhpcy5fZW5hYmxlZEluSGllcmFyY2h5ID0gZW5hYmxlZDtcbiAgICAgICAgaWYgKGVuYWJsZWQgJiYgIXRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIHRoaXMuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHt0aGlzfSBjbG9uZSAtIFRoZSBjbG9uZWQgZ3JhcGggbm9kZSB0byBjb3B5IGludG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xvbmVJbnRlcm5hbChjbG9uZSkge1xuICAgICAgICBjbG9uZS5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgIGNvbnN0IHRhZ3MgPSB0aGlzLnRhZ3MuX2xpc3Q7XG4gICAgICAgIGNsb25lLnRhZ3MuY2xlYXIoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YWdzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgY2xvbmUudGFncy5hZGQodGFnc1tpXSk7XG5cbiAgICAgICAgY2xvbmUuX2xhYmVscyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX2xhYmVscyk7XG5cbiAgICAgICAgY2xvbmUubG9jYWxQb3NpdGlvbi5jb3B5KHRoaXMubG9jYWxQb3NpdGlvbik7XG4gICAgICAgIGNsb25lLmxvY2FsUm90YXRpb24uY29weSh0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICBjbG9uZS5sb2NhbFNjYWxlLmNvcHkodGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgY2xvbmUubG9jYWxFdWxlckFuZ2xlcy5jb3B5KHRoaXMubG9jYWxFdWxlckFuZ2xlcyk7XG5cbiAgICAgICAgY2xvbmUucG9zaXRpb24uY29weSh0aGlzLnBvc2l0aW9uKTtcbiAgICAgICAgY2xvbmUucm90YXRpb24uY29weSh0aGlzLnJvdGF0aW9uKTtcbiAgICAgICAgY2xvbmUuZXVsZXJBbmdsZXMuY29weSh0aGlzLmV1bGVyQW5nbGVzKTtcblxuICAgICAgICBjbG9uZS5sb2NhbFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICBjbG9uZS5fZGlydHlMb2NhbCA9IHRoaXMuX2RpcnR5TG9jYWw7XG5cbiAgICAgICAgY2xvbmUud29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLndvcmxkVHJhbnNmb3JtKTtcbiAgICAgICAgY2xvbmUuX2RpcnR5V29ybGQgPSB0aGlzLl9kaXJ0eVdvcmxkO1xuICAgICAgICBjbG9uZS5fZGlydHlOb3JtYWwgPSB0aGlzLl9kaXJ0eU5vcm1hbDtcbiAgICAgICAgY2xvbmUuX2FhYmJWZXIgPSB0aGlzLl9hYWJiVmVyICsgMTtcblxuICAgICAgICBjbG9uZS5fZW5hYmxlZCA9IHRoaXMuX2VuYWJsZWQ7XG5cbiAgICAgICAgY2xvbmUuc2NhbGVDb21wZW5zYXRpb24gPSB0aGlzLnNjYWxlQ29tcGVuc2F0aW9uO1xuXG4gICAgICAgIC8vIGZhbHNlIGFzIHRoaXMgbm9kZSBpcyBub3QgaW4gdGhlIGhpZXJhcmNoeSB5ZXRcbiAgICAgICAgY2xvbmUuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGEgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIGNsb25lIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICAgICAgICB0aGlzLl9jbG9uZUludGVybmFsKGNsb25lKTtcbiAgICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcHkgYSBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHNvdXJjZSAtIFRoZSBncmFwaCBub2RlIHRvIGNvcHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZX0gVGhlIGRlc3RpbmF0aW9uIGdyYXBoIG5vZGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNvcHkoc291cmNlKSB7XG4gICAgICAgIHNvdXJjZS5fY2xvbmVJbnRlcm5hbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciB0aGUgbm9kZXMgdGhhdCBzYXRpc2Z5IHNvbWUgc2VhcmNoXG4gICAgICogY3JpdGVyaWEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbmROb2RlQ2FsbGJhY2t8c3RyaW5nfSBhdHRyIC0gVGhpcyBjYW4gZWl0aGVyIGJlIGEgZnVuY3Rpb24gb3IgYSBzdHJpbmcuIElmIGl0J3MgYVxuICAgICAqIGZ1bmN0aW9uLCBpdCBpcyBleGVjdXRlZCBmb3IgZWFjaCBkZXNjZW5kYW50IG5vZGUgdG8gdGVzdCBpZiBub2RlIHNhdGlzZmllcyB0aGUgc2VhcmNoXG4gICAgICogbG9naWMuIFJldHVybmluZyB0cnVlIGZyb20gdGhlIGZ1bmN0aW9uIHdpbGwgaW5jbHVkZSB0aGUgbm9kZSBpbnRvIHRoZSByZXN1bHRzLiBJZiBpdCdzIGFcbiAgICAgKiBzdHJpbmcgdGhlbiBpdCByZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgZmllbGQgb3IgYSBtZXRob2Qgb2YgdGhlIG5vZGUuIElmIHRoaXMgaXMgdGhlIG5hbWVcbiAgICAgKiBvZiBhIGZpZWxkIHRoZW4gdGhlIHZhbHVlIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHdpbGwgYmUgY2hlY2tlZCBmb3IgZXF1YWxpdHkuIElmXG4gICAgICogdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIHRoZW4gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZSBjaGVja2VkIGZvclxuICAgICAqIGVxdWFsaXR5IGFnYWluc3QgdGhlIHZhbHVlZCBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB0byB0aGlzIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdmFsdWVdIC0gSWYgdGhlIGZpcnN0IGFyZ3VtZW50IChhdHRyKSBpcyBhIHByb3BlcnR5IG5hbWUgdGhlbiB0aGlzIHZhbHVlXG4gICAgICogd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlW119IFRoZSBhcnJheSBvZiBncmFwaCBub2RlcyB0aGF0IG1hdGNoIHRoZSBzZWFyY2ggY3JpdGVyaWEuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kcyBhbGwgbm9kZXMgdGhhdCBoYXZlIGEgbW9kZWwgY29tcG9uZW50IGFuZCBoYXZlICdkb29yJyBpbiB0aGVpciBsb3dlci1jYXNlZCBuYW1lXG4gICAgICogdmFyIGRvb3JzID0gaG91c2UuZmluZChmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICByZXR1cm4gbm9kZS5tb2RlbCAmJiBub2RlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdkb29yJykgIT09IC0xO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgYWxsIG5vZGVzIHRoYXQgaGF2ZSB0aGUgbmFtZSBwcm9wZXJ0eSBzZXQgdG8gJ1Rlc3QnXG4gICAgICogdmFyIGVudGl0aWVzID0gcGFyZW50LmZpbmQoJ25hbWUnLCAnVGVzdCcpO1xuICAgICAqL1xuICAgIGZpbmQoYXR0ciwgdmFsdWUpIHtcbiAgICAgICAgbGV0IHJlc3VsdCwgcmVzdWx0cyA9IFtdO1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgY29uc3QgZm4gPSBhdHRyO1xuXG4gICAgICAgICAgICByZXN1bHQgPSBmbih0aGlzKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzY2VuZGFudHMgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kKGZuKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVzY2VuZGFudHMubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQoZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHRlc3RWYWx1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1thdHRyXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGVzdFZhbHVlID09PSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzY2VuZGFudHMgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kKGF0dHIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVzY2VuZGFudHMubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQoZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciB0aGUgZmlyc3Qgbm9kZSB0aGF0IHNhdGlzZmllcyBzb21lXG4gICAgICogc2VhcmNoIGNyaXRlcmlhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaW5kTm9kZUNhbGxiYWNrfHN0cmluZ30gYXR0ciAtIFRoaXMgY2FuIGVpdGhlciBiZSBhIGZ1bmN0aW9uIG9yIGEgc3RyaW5nLiBJZiBpdCdzIGFcbiAgICAgKiBmdW5jdGlvbiwgaXQgaXMgZXhlY3V0ZWQgZm9yIGVhY2ggZGVzY2VuZGFudCBub2RlIHRvIHRlc3QgaWYgbm9kZSBzYXRpc2ZpZXMgdGhlIHNlYXJjaFxuICAgICAqIGxvZ2ljLiBSZXR1cm5pbmcgdHJ1ZSBmcm9tIHRoZSBmdW5jdGlvbiB3aWxsIHJlc3VsdCBpbiB0aGF0IG5vZGUgYmVpbmcgcmV0dXJuZWQgZnJvbVxuICAgICAqIGZpbmRPbmUuIElmIGl0J3MgYSBzdHJpbmcgdGhlbiBpdCByZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgZmllbGQgb3IgYSBtZXRob2Qgb2YgdGhlIG5vZGUuIElmXG4gICAgICogdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZpZWxkIHRoZW4gdGhlIHZhbHVlIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHdpbGwgYmUgY2hlY2tlZCBmb3JcbiAgICAgKiBlcXVhbGl0eS4gSWYgdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIHRoZW4gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZVxuICAgICAqIGNoZWNrZWQgZm9yIGVxdWFsaXR5IGFnYWluc3QgdGhlIHZhbHVlZCBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB0byB0aGlzIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdmFsdWVdIC0gSWYgdGhlIGZpcnN0IGFyZ3VtZW50IChhdHRyKSBpcyBhIHByb3BlcnR5IG5hbWUgdGhlbiB0aGlzIHZhbHVlXG4gICAgICogd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IEEgZ3JhcGggbm9kZSB0aGF0IG1hdGNoIHRoZSBzZWFyY2ggY3JpdGVyaWEuIFJldHVybnMgbnVsbCBpZiBub1xuICAgICAqIG5vZGUgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kIHRoZSBmaXJzdCBub2RlIHRoYXQgaXMgY2FsbGVkICdoZWFkJyBhbmQgaGFzIGEgbW9kZWwgY29tcG9uZW50XG4gICAgICogdmFyIGhlYWQgPSBwbGF5ZXIuZmluZE9uZShmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICByZXR1cm4gbm9kZS5tb2RlbCAmJiBub2RlLm5hbWUgPT09ICdoZWFkJztcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIHRoZSBmaXJzdCBub2RlIHRoYXQgaGFzIHRoZSBuYW1lIHByb3BlcnR5IHNldCB0byAnVGVzdCdcbiAgICAgKiB2YXIgbm9kZSA9IHBhcmVudC5maW5kT25lKCduYW1lJywgJ1Rlc3QnKTtcbiAgICAgKi9cbiAgICBmaW5kT25lKGF0dHIsIHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgY29uc3QgZm4gPSBhdHRyO1xuXG4gICAgICAgICAgICByZXN1bHQgPSBmbih0aGlzKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kT25lKGZuKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHRlc3RWYWx1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRlc3RWYWx1ZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZE9uZShhdHRyLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCBzYXRpc2Z5IHRoZSBzZWFyY2ggcXVlcnkuIFF1ZXJ5IGNhbiBiZSBzaW1wbHkgYSBzdHJpbmcsIG9yIGNvbW1hXG4gICAgICogc2VwYXJhdGVkIHN0cmluZ3MsIHRvIGhhdmUgaW5jbHVzaXZlIHJlc3VsdHMgb2YgYXNzZXRzIHRoYXQgbWF0Y2ggYXQgbGVhc3Qgb25lIHF1ZXJ5LiBBXG4gICAgICogcXVlcnkgdGhhdCBjb25zaXN0cyBvZiBhbiBhcnJheSBvZiB0YWdzIGNhbiBiZSB1c2VkIHRvIG1hdGNoIGdyYXBoIG5vZGVzIHRoYXQgaGF2ZSBlYWNoIHRhZ1xuICAgICAqIG9mIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsuLi4qfSBxdWVyeSAtIE5hbWUgb2YgYSB0YWcgb3IgYXJyYXkgb2YgdGFncy5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlW119IEEgbGlzdCBvZiBhbGwgZ3JhcGggbm9kZXMgdGhhdCBtYXRjaCB0aGUgcXVlcnkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIGdyYXBoIG5vZGVzIHRoYXQgdGFnZ2VkIGJ5IGBhbmltYWxgXG4gICAgICogdmFyIGFuaW1hbHMgPSBub2RlLmZpbmRCeVRhZyhcImFuaW1hbFwiKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCB0YWdnZWQgYnkgYGJpcmRgIE9SIGBtYW1tYWxgXG4gICAgICogdmFyIGJpcmRzQW5kTWFtbWFscyA9IG5vZGUuZmluZEJ5VGFnKFwiYmlyZFwiLCBcIm1hbW1hbFwiKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBjYXJuaXZvcmVgIEFORCBgbWFtbWFsYFxuICAgICAqIHZhciBtZWF0RWF0aW5nTWFtbWFscyA9IG5vZGUuZmluZEJ5VGFnKFtcImNhcm5pdm9yZVwiLCBcIm1hbW1hbFwiXSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIGFzc2V0cyB0aGF0IHRhZ2dlZCBieSAoYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgKSBPUiAoYGNhcm5pdm9yZWAgQU5EIGByZXB0aWxlYClcbiAgICAgKiB2YXIgbWVhdEVhdGluZ01hbW1hbHNBbmRSZXB0aWxlcyA9IG5vZGUuZmluZEJ5VGFnKFtcImNhcm5pdm9yZVwiLCBcIm1hbW1hbFwiXSwgW1wiY2Fybml2b3JlXCIsIFwicmVwdGlsZVwiXSk7XG4gICAgICovXG4gICAgZmluZEJ5VGFnKCkge1xuICAgICAgICBjb25zdCBxdWVyeSA9IGFyZ3VtZW50cztcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGNvbnN0IHF1ZXJ5Tm9kZSA9IChub2RlLCBjaGVja05vZGUpID0+IHtcbiAgICAgICAgICAgIGlmIChjaGVja05vZGUgJiYgbm9kZS50YWdzLmhhcyguLi5xdWVyeSkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBxdWVyeU5vZGUobm9kZS5fY2hpbGRyZW5baV0sIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHF1ZXJ5Tm9kZSh0aGlzLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBmaXJzdCBub2RlIGZvdW5kIGluIHRoZSBncmFwaCB3aXRoIHRoZSBuYW1lLiBUaGUgc2VhcmNoIGlzIGRlcHRoIGZpcnN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZ3JhcGguXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBUaGUgZmlyc3Qgbm9kZSB0byBiZSBmb3VuZCBtYXRjaGluZyB0aGUgc3VwcGxpZWQgbmFtZS4gUmV0dXJuc1xuICAgICAqIG51bGwgaWYgbm8gbm9kZSBpcyBmb3VuZC5cbiAgICAgKi9cbiAgICBmaW5kQnlOYW1lKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMubmFtZSA9PT0gbmFtZSkgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kQnlOYW1lKG5hbWUpO1xuICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBmaXJzdCBub2RlIGZvdW5kIGluIHRoZSBncmFwaCBieSBpdHMgZnVsbCBwYXRoIGluIHRoZSBncmFwaC4gVGhlIGZ1bGwgcGF0aCBoYXMgdGhpc1xuICAgICAqIGZvcm0gJ3BhcmVudC9jaGlsZC9zdWItY2hpbGQnLiBUaGUgc2VhcmNoIGlzIGRlcHRoIGZpcnN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IHBhdGggLSBUaGUgZnVsbCBwYXRoIG9mIHRoZSB7QGxpbmsgR3JhcGhOb2RlfSBhcyBlaXRoZXIgYSBzdHJpbmcgb3JcbiAgICAgKiBhcnJheSBvZiB7QGxpbmsgR3JhcGhOb2RlfSBuYW1lcy5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IFRoZSBmaXJzdCBub2RlIHRvIGJlIGZvdW5kIG1hdGNoaW5nIHRoZSBzdXBwbGllZCBwYXRoLiBSZXR1cm5zXG4gICAgICogbnVsbCBpZiBubyBub2RlIGlzIGZvdW5kLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU3RyaW5nIGZvcm1cbiAgICAgKiB2YXIgZ3JhbmRjaGlsZCA9IHRoaXMuZW50aXR5LmZpbmRCeVBhdGgoJ2NoaWxkL2dyYW5kY2hpbGQnKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFycmF5IGZvcm1cbiAgICAgKiB2YXIgZ3JhbmRjaGlsZCA9IHRoaXMuZW50aXR5LmZpbmRCeVBhdGgoWydjaGlsZCcsICdncmFuZGNoaWxkJ10pO1xuICAgICAqL1xuICAgIGZpbmRCeVBhdGgocGF0aCkge1xuICAgICAgICAvLyBhY2NlcHQgZWl0aGVyIHN0cmluZyBwYXRoIHdpdGggJy8nIHNlcGFyYXRvcnMgb3IgYXJyYXkgb2YgcGFydHMuXG4gICAgICAgIGNvbnN0IHBhcnRzID0gQXJyYXkuaXNBcnJheShwYXRoKSA/IHBhdGggOiBwYXRoLnNwbGl0KCcvJyk7XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBpbWF4ID0gcGFydHMubGVuZ3RoOyBpIDwgaW1heDsgKytpKSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQuY2hpbGRyZW4uZmluZChjID0+IGMubmFtZSA9PT0gcGFydHNbaV0pO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgYSBwcm92aWRlZCBmdW5jdGlvbiBvbmNlIG9uIHRoaXMgZ3JhcGggbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Rm9yRWFjaE5vZGVDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gZXhlY3V0ZSBvbiB0aGUgZ3JhcGggbm9kZSBhbmQgZWFjaFxuICAgICAqIGRlc2NlbmRhbnQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFt0aGlzQXJnXSAtIE9wdGlvbmFsIHZhbHVlIHRvIHVzZSBhcyB0aGlzIHdoZW4gZXhlY3V0aW5nIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9nIHRoZSBwYXRoIGFuZCBuYW1lIG9mIGVhY2ggbm9kZSBpbiBkZXNjZW5kYW50IHRyZWUgc3RhcnRpbmcgd2l0aCBcInBhcmVudFwiXG4gICAgICogcGFyZW50LmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2cobm9kZS5wYXRoICsgXCIvXCIgKyBub2RlLm5hbWUpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB0aGlzKTtcblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjaGlsZHJlbltpXS5mb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIG5vZGUgaXMgZGVzY2VuZGFudCBvZiBhbm90aGVyIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFBvdGVudGlhbCBhbmNlc3RvciBvZiBub2RlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBJZiBub2RlIGlzIGRlc2NlbmRhbnQgb2YgYW5vdGhlciBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKHJvb2YuaXNEZXNjZW5kYW50T2YoaG91c2UpKSB7XG4gICAgICogICAgIC8vIHJvb2YgaXMgZGVzY2VuZGFudCBvZiBob3VzZSBlbnRpdHlcbiAgICAgKiB9XG4gICAgICovXG4gICAgaXNEZXNjZW5kYW50T2Yobm9kZSkge1xuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuICAgICAgICB3aGlsZSAocGFyZW50KSB7XG4gICAgICAgICAgICBpZiAocGFyZW50ID09PSBub2RlKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgbm9kZSBpcyBhbmNlc3RvciBmb3IgYW5vdGhlciBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBQb3RlbnRpYWwgZGVzY2VuZGFudCBvZiBub2RlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBJZiBub2RlIGlzIGFuY2VzdG9yIGZvciBhbm90aGVyIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAoYm9keS5pc0FuY2VzdG9yT2YoZm9vdCkpIHtcbiAgICAgKiAgICAgLy8gZm9vdCBpcyB3aXRoaW4gYm9keSdzIGhpZXJhcmNoeVxuICAgICAqIH1cbiAgICAgKi9cbiAgICBpc0FuY2VzdG9yT2Yobm9kZSkge1xuICAgICAgICByZXR1cm4gbm9kZS5pc0Rlc2NlbmRhbnRPZih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZSBpbiBFdWxlciBhbmdsZSBmb3JtLiBUaGUgcm90YXRpb25cbiAgICAgKiBpcyByZXR1cm5lZCBhcyBldWxlciBhbmdsZXMgaW4gYSB7QGxpbmsgVmVjM30uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZVxuICAgICAqIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBJbiBvcmRlciB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2VcbiAgICAgKiB7QGxpbmsgR3JhcGhOb2RlI3NldEV1bGVyQW5nbGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgaW4gRXVsZXIgYW5nbGUgZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRFdWxlckFuZ2xlcygpO1xuICAgICAqIGFuZ2xlcy55ID0gMTgwOyAvLyByb3RhdGUgdGhlIGVudGl0eSBhcm91bmQgWSBieSAxODAgZGVncmVlc1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRFdWxlckFuZ2xlcyh0aGlzLmV1bGVyQW5nbGVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXVsZXJBbmdsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSByb3RhdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhc1xuICAgICAqIGV1bGVyIGFuZ2xlcyBpbiBhIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvXG4gICAgICogdXBkYXRlIHRoZSBsb2NhbCByb3RhdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxFdWxlckFuZ2xlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGV1bGVyIGFuZ2xlcyBpbiBYWVogb3JkZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYW5nbGVzID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxFdWxlckFuZ2xlcygpO1xuICAgICAqIGFuZ2xlcy55ID0gMTgwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbEV1bGVyQW5nbGVzKCkge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uZ2V0RXVsZXJBbmdsZXModGhpcy5sb2NhbEV1bGVyQW5nbGVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxFdWxlckFuZ2xlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBvc2l0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHBvc2l0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUbyB1cGRhdGUgdGhlIGxvY2FsXG4gICAgICogcG9zaXRpb24sIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsUG9zaXRpb259LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSBwb3NpdGlvbiBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBwb3NpdGlvbiA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgKiBwb3NpdGlvbi54ICs9IDE7IC8vIG1vdmUgdGhlIGVudGl0eSAxIHVuaXQgYWxvbmcgeC5cbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFBvc2l0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcm90YXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcm90YXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBRdWF0fS4gVGhlIHJldHVybmVkIHF1YXRlcm5pb24gc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUbyB1cGRhdGUgdGhlIGxvY2FsXG4gICAgICogcm90YXRpb24sIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsUm90YXRpb259LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSBsb2NhbCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBhcyBhIHF1YXRlcm5pb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcm90YXRpb24gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFJvdGF0aW9uKCk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxSb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHNjYWxlIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHNjYWxlIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUbyB1cGRhdGUgdGhlIGxvY2FsIHNjYWxlLFxuICAgICAqIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsU2NhbGV9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzY2FsZSA9IHRoaXMuZW50aXR5LmdldExvY2FsU2NhbGUoKTtcbiAgICAgKiBzY2FsZS54ID0gMTAwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIGdldExvY2FsU2NhbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsU2NhbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsb2NhbCB0cmFuc2Zvcm0gbWF0cml4IGZvciB0aGlzIGdyYXBoIG5vZGUuIFRoaXMgbWF0cml4IGlzIHRoZSB0cmFuc2Zvcm0gcmVsYXRpdmUgdG9cbiAgICAgKiB0aGUgbm9kZSdzIHBhcmVudCdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBUaGUgbm9kZSdzIGxvY2FsIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB0cmFuc2Zvcm0gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFRyYW5zZm9ybSgpO1xuICAgICAqL1xuICAgIGdldExvY2FsVHJhbnNmb3JtKCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFRyYW5zZm9ybS5zZXRUUlModGhpcy5sb2NhbFBvc2l0aW9uLCB0aGlzLmxvY2FsUm90YXRpb24sIHRoaXMubG9jYWxTY2FsZSk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUxvY2FsID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSBwb3NpdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIEluIG9yZGVyXG4gICAgICogdG8gc2V0IHRoZSB3b3JsZC1zcGFjZSBwb3NpdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0UG9zaXRpb259LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBwb3NpdGlvbiA9IHRoaXMuZW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogcG9zaXRpb24ueCA9IDEwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBnZXRQb3NpdGlvbigpIHtcbiAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFRyYW5zbGF0aW9uKHRoaXMucG9zaXRpb24pO1xuICAgICAgICByZXR1cm4gdGhpcy5wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgUXVhdH0uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXJcbiAgICAgKiB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRSb3RhdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGEgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciByb3RhdGlvbiA9IHRoaXMuZW50aXR5LmdldFJvdGF0aW9uKCk7XG4gICAgICovXG4gICAgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgIHRoaXMucm90YXRpb24uc2V0RnJvbU1hdDQodGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBzY2FsZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByZXR1cm5lZCB2YWx1ZSB3aWxsIG9ubHkgYmVcbiAgICAgKiBjb3JyZWN0IGZvciBncmFwaCBub2RlcyB0aGF0IGhhdmUgYSBub24tc2tld2VkIHdvcmxkIHRyYW5zZm9ybSAoYSBza2V3IGNhbiBiZSBpbnRyb2R1Y2VkIGJ5XG4gICAgICogdGhlIGNvbXBvdW5kaW5nIG9mIHJvdGF0aW9ucyBhbmQgc2NhbGVzIGhpZ2hlciBpbiB0aGUgZ3JhcGggbm9kZSBoaWVyYXJjaHkpLiBUaGUgc2NhbGUgaXNcbiAgICAgKiByZXR1cm5lZCBhcyBhIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWRcbiAgICAgKiByZWFkLW9ubHkuIE5vdGUgdGhhdCBpdCBpcyBub3QgcG9zc2libGUgdG8gc2V0IHRoZSB3b3JsZCBzcGFjZSBzY2FsZSBvZiBhIGdyYXBoIG5vZGVcbiAgICAgKiBkaXJlY3RseS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2Ugc2NhbGUgb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc2NhbGUgPSB0aGlzLmVudGl0eS5nZXRTY2FsZSgpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRTY2FsZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zY2FsZSkge1xuICAgICAgICAgICAgdGhpcy5fc2NhbGUgPSBuZXcgVmVjMygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0U2NhbGUodGhpcy5fc2NhbGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4IGZvciB0aGlzIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gVGhlIG5vZGUncyB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdHJhbnNmb3JtID0gdGhpcy5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgKi9cbiAgICBnZXRXb3JsZFRyYW5zZm9ybSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsICYmICF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMud29ybGRUcmFuc2Zvcm07XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudClcbiAgICAgICAgICAgIHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIHRoaXMuX3N5bmMoKTtcblxuICAgICAgICByZXR1cm4gdGhpcy53b3JsZFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGNhY2hlZCB2YWx1ZSBvZiBuZWdhdGl2ZSBzY2FsZSBvZiB0aGUgd29ybGQgdHJhbnNmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gLTEgaWYgd29ybGQgdHJhbnNmb3JtIGhhcyBuZWdhdGl2ZSBzY2FsZSwgMSBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBuZWdhdGl2ZVNjYWxlV29ybGQoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX25lZ2F0aXZlU2NhbGVXb3JsZCA9PT0gMCkge1xuXG4gICAgICAgICAgICBjb25zdCB3dCA9IHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIHd0LmdldFgoX3dvcmxkTWF0WCk7XG4gICAgICAgICAgICB3dC5nZXRZKF93b3JsZE1hdFkpO1xuICAgICAgICAgICAgd3QuZ2V0Wihfd29ybGRNYXRaKTtcbiAgICAgICAgICAgIF93b3JsZE1hdFguY3Jvc3MoX3dvcmxkTWF0WCwgX3dvcmxkTWF0WSk7XG4gICAgICAgICAgICB0aGlzLl9uZWdhdGl2ZVNjYWxlV29ybGQgPSBfd29ybGRNYXRYLmRvdChfd29ybGRNYXRaKSA8IDAgPyAtMSA6IDE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fbmVnYXRpdmVTY2FsZVdvcmxkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBncmFwaCBub2RlIGZyb20gY3VycmVudCBwYXJlbnQgYW5kIGFkZCBhcyBjaGlsZCB0byBuZXcgcGFyZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHBhcmVudCAtIE5ldyBwYXJlbnQgdG8gYXR0YWNoIGdyYXBoIG5vZGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbmRleF0gLSBUaGUgY2hpbGQgaW5kZXggd2hlcmUgdGhlIGNoaWxkIG5vZGUgc2hvdWxkIGJlIHBsYWNlZC5cbiAgICAgKi9cbiAgICByZXBhcmVudChwYXJlbnQsIGluZGV4KSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9wYXJlbnQ7XG5cbiAgICAgICAgaWYgKGN1cnJlbnQpXG4gICAgICAgICAgICBjdXJyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xuXG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50Lmluc2VydENoaWxkKHRoaXMsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlIHVzaW5nIGV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZVxuICAgICAqIGludGVycHJldGVkIGluIFhZWiBvcmRlci4gRXVsZXJzIG11c3QgYmUgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIGV1bGVyXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBldWxlcnMgb3Igcm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlXG4gICAgICogeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHktYXhpcyB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcygwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgeS1heGlzIHZpYSBhIHZlY3RvclxuICAgICAqIHZhciBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldExvY2FsRXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBwb3MgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3MpO1xuICAgICAqL1xuICAgIHNldExvY2FsUG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxSb3RhdGlvbigwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgcXVhdGVybmlvblxuICAgICAqIHZhciBxID0gcGMuUXVhdCgpO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUm90YXRpb24ocSk7XG4gICAgICovXG4gICAgc2V0TG9jYWxSb3RhdGlvbih4LCB5LCB6LCB3KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0KHgsIHksIHosIHcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugc2NhbGUgZmFjdG9yIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSBzY2FsZSBvciB4LWNvb3JkaW5hdGVcbiAgICAgKiBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBzY2FsZSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIHNldExvY2FsU2NhbGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTY2FsZS5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFNjYWxlLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5TG9jYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl93YXNEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZClcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91bmZyZWV6ZVBhcmVudFRvUm9vdCgpIHtcbiAgICAgICAgbGV0IHAgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIHdoaWxlIChwKSB7XG4gICAgICAgICAgICBwLl9mcm96ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHAgPSBwLl9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeVdvcmxkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICB0aGlzLl91bmZyZWV6ZVBhcmVudFRvUm9vdCgpO1xuICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICB0aGlzLl9mcm96ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2hpbGRyZW5baV0uX2RpcnR5V29ybGQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVnYXRpdmVTY2FsZVdvcmxkID0gMDsgICAvLyB3b3JsZCBtYXRyaXggaXMgZGlydHksIG1hcmsgdGhpcyBmbGFnIGRpcnR5IHRvb1xuICAgICAgICB0aGlzLl9hYWJiVmVyKys7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZVxuICAgICAqIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2UgcG9zaXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBwb3NpdGlvbiA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgc2V0UG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uY29weShwb3NpdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnZQYXJlbnRXdG0uY29weSh0aGlzLl9wYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKSkuaW52ZXJ0KCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRXdG0udHJhbnNmb3JtUG9pbnQocG9zaXRpb24sIHRoaXMubG9jYWxQb3NpdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSBxdWF0ZXJuaW9uIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZVxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fG51bWJlcn0geCAtIFF1YXRlcm5pb24gaG9sZGluZyB3b3JsZC1zcGFjZSByb3RhdGlvbiBvciB4LWNvbXBvbmVudCBvZlxuICAgICAqIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29tcG9uZW50IG9mIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29tcG9uZW50IG9mIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFctY29tcG9uZW50IG9mIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDQgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKDAsIDAsIDAsIDEpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSBxdWF0ZXJuaW9uXG4gICAgICogdmFyIHEgPSBwYy5RdWF0KCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0Um90YXRpb24ocSk7XG4gICAgICovXG4gICAgc2V0Um90YXRpb24oeCwgeSwgeiwgdykge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFF1YXQpIHtcbiAgICAgICAgICAgIHJvdGF0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByb3RhdGlvbi5zZXQoeCwgeSwgeiwgdyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uY29weShyb3RhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRSb3QgPSB0aGlzLl9wYXJlbnQuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIGludlBhcmVudFJvdC5jb3B5KHBhcmVudFJvdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uY29weShpbnZQYXJlbnRSb3QpLm11bChyb3RhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUgdXNpbmcgZXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlXG4gICAgICogaW50ZXJwcmV0ZWQgaW4gWFlaIG9yZGVyLiBFdWxlcnMgbXVzdCBiZSBzcGVjaWZpZWQgaW4gZGVncmVlcy4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgd29ybGQtc3BhY2UgZXVsZXJcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGV1bGVycyBvciByb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2VcbiAgICAgKiB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcygwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIHZpYSBhIHZlY3RvclxuICAgICAqIHZhciBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBzZXRFdWxlckFuZ2xlcyh4LCB5LCB6KSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIoaW52UGFyZW50Um90LCB0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgbmV3IGNoaWxkIHRvIHRoZSBjaGlsZCBsaXN0IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZiB0aGUgY2hpbGQgbm9kZS5cbiAgICAgKiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbmV3IGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5LmFkZENoaWxkKGUpO1xuICAgICAqL1xuICAgIGFkZENoaWxkKG5vZGUpIHtcbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuICAgICAgICB0aGlzLl9jaGlsZHJlbi5wdXNoKG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGNoaWxkIHRvIHRoaXMgbm9kZSwgbWFpbnRhaW5pbmcgdGhlIGNoaWxkJ3MgdHJhbnNmb3JtIGluIHdvcmxkIHNwYWNlLlxuICAgICAqIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBjaGlsZCB0byBhZGQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZSA9IG5ldyBwYy5FbnRpdHkoYXBwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5hZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0oZSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkZENoaWxkQW5kU2F2ZVRyYW5zZm9ybShub2RlKSB7XG5cbiAgICAgICAgY29uc3Qgd1BvcyA9IG5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd1JvdCA9IG5vZGUuZ2V0Um90YXRpb24oKTtcblxuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG5cbiAgICAgICAgbm9kZS5zZXRQb3NpdGlvbih0bXBNYXQ0LmNvcHkodGhpcy53b3JsZFRyYW5zZm9ybSkuaW52ZXJ0KCkudHJhbnNmb3JtUG9pbnQod1BvcykpO1xuICAgICAgICBub2RlLnNldFJvdGF0aW9uKHRtcFF1YXQuY29weSh0aGlzLmdldFJvdGF0aW9uKCkpLmludmVydCgpLm11bCh3Um90KSk7XG5cbiAgICAgICAgdGhpcy5fY2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICAgICAgdGhpcy5fb25JbnNlcnRDaGlsZChub2RlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgYSBuZXcgY2hpbGQgdG8gdGhlIGNoaWxkIGxpc3QgYXQgdGhlIHNwZWNpZmllZCBpbmRleCBhbmQgdXBkYXRlIHRoZSBwYXJlbnQgdmFsdWUgb2ZcbiAgICAgKiB0aGUgY2hpbGQgbm9kZS4gSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5ldyBjaGlsZCB0byBpbnNlcnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gVGhlIGluZGV4IGluIHRoZSBjaGlsZCBsaXN0IG9mIHRoZSBwYXJlbnQgd2hlcmUgdGhlIG5ldyBub2RlIHdpbGwgYmVcbiAgICAgKiBpbnNlcnRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5Lmluc2VydENoaWxkKGUsIDEpO1xuICAgICAqL1xuICAgIGluc2VydENoaWxkKG5vZGUsIGluZGV4KSB7XG5cbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuICAgICAgICB0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDAsIG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByZXBhcmVzIG5vZGUgZm9yIGJlaW5nIGluc2VydGVkIHRvIGEgcGFyZW50IG5vZGUsIGFuZCByZW1vdmVzIGl0IGZyb20gdGhlIHByZXZpb3VzIHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5vZGUgYmVpbmcgaW5zZXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJlcGFyZUluc2VydENoaWxkKG5vZGUpIHtcblxuICAgICAgICAvLyByZW1vdmUgaXQgZnJvbSB0aGUgZXhpc3RpbmcgcGFyZW50XG4gICAgICAgIGlmIChub2RlLl9wYXJlbnQpIHtcbiAgICAgICAgICAgIG5vZGUuX3BhcmVudC5yZW1vdmVDaGlsZChub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLmFzc2VydChub2RlICE9PSB0aGlzLCBgR3JhcGhOb2RlICR7bm9kZT8ubmFtZX0gY2Fubm90IGJlIGEgY2hpbGQgb2YgaXRzZWxmYCk7XG4gICAgICAgIERlYnVnLmFzc2VydCghdGhpcy5pc0Rlc2NlbmRhbnRPZihub2RlKSwgYEdyYXBoTm9kZSAke25vZGU/Lm5hbWV9IGNhbm5vdCBhZGQgYW4gYW5jZXN0b3IgYXMgYSBjaGlsZGApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVzIGFuIGV2ZW50IG9uIGFsbCBjaGlsZHJlbiBvZiB0aGUgbm9kZS4gVGhlIGV2ZW50IGBuYW1lYCBpcyBmaXJlZCBvbiB0aGUgZmlyc3QgKHJvb3QpXG4gICAgICogbm9kZSBvbmx5LiBUaGUgZXZlbnQgYG5hbWVIaWVyYXJjaHlgIGlzIGZpcmVkIGZvciBhbGwgY2hpbGRyZW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0byBmaXJlIG9uIHRoZSByb290LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lSGllcmFyY2h5IC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIGZpcmUgZm9yIGFsbCBkZXNjZW5kYW50cy5cbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gcGFyZW50IC0gVGhlIHBhcmVudCBvZiB0aGUgbm9kZSBiZWluZyBhZGRlZC9yZW1vdmVkIGZyb20gdGhlIGhpZXJhcmNoeS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9maXJlT25IaWVyYXJjaHkobmFtZSwgbmFtZUhpZXJhcmNoeSwgcGFyZW50KSB7XG4gICAgICAgIHRoaXMuZmlyZShuYW1lLCBwYXJlbnQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fZmlyZU9uSGllcmFyY2h5KG5hbWVIaWVyYXJjaHksIG5hbWVIaWVyYXJjaHksIHBhcmVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiBhIG5vZGUgaXMgaW5zZXJ0ZWQgaW50byBhIG5vZGUncyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbm9kZSB0aGF0IHdhcyBpbnNlcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkluc2VydENoaWxkKG5vZGUpIHtcbiAgICAgICAgbm9kZS5fcGFyZW50ID0gdGhpcztcblxuICAgICAgICAvLyB0aGUgY2hpbGQgbm9kZSBzaG91bGQgYmUgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5IG9ubHkgaWYgaXRzZWxmIGlzIGVuYWJsZWQgYW5kIGlmXG4gICAgICAgIC8vIHRoaXMgcGFyZW50IGlzIGVuYWJsZWRcbiAgICAgICAgY29uc3QgZW5hYmxlZEluSGllcmFyY2h5ID0gKG5vZGUuX2VuYWJsZWQgJiYgdGhpcy5lbmFibGVkKTtcbiAgICAgICAgaWYgKG5vZGUuX2VuYWJsZWRJbkhpZXJhcmNoeSAhPT0gZW5hYmxlZEluSGllcmFyY2h5KSB7XG4gICAgICAgICAgICBub2RlLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBlbmFibGVkSW5IaWVyYXJjaHk7XG5cbiAgICAgICAgICAgIC8vIHByb3BhZ2F0ZSB0aGUgY2hhbmdlIHRvIHRoZSBjaGlsZHJlbiAtIG5lY2Vzc2FyeSBpZiB3ZSByZXBhcmVudCBhIG5vZGVcbiAgICAgICAgICAgIC8vIHVuZGVyIGEgcGFyZW50IHdpdGggYSBkaWZmZXJlbnQgZW5hYmxlZCBzdGF0ZSAoaWYgd2UgcmVwYXJlbnQgYSBub2RlIHRoYXQgaXNcbiAgICAgICAgICAgIC8vIG5vdCBhY3RpdmUgaW4gdGhlIGhpZXJhcmNoeSB1bmRlciBhIHBhcmVudCB3aG8gaXMgYWN0aXZlIGluIHRoZSBoaWVyYXJjaHkgdGhlblxuICAgICAgICAgICAgLy8gd2Ugd2FudCBvdXIgbm9kZSB0byBiZSBhY3RpdmF0ZWQpXG4gICAgICAgICAgICBub2RlLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQobm9kZSwgZW5hYmxlZEluSGllcmFyY2h5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBncmFwaCBkZXB0aCBvZiB0aGUgY2hpbGQgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgd2lsbCBub3cgY2hhbmdlXG4gICAgICAgIG5vZGUuX3VwZGF0ZUdyYXBoRGVwdGgoKTtcblxuICAgICAgICAvLyBUaGUgY2hpbGQgKHBsdXMgc3ViaGllcmFyY2h5KSB3aWxsIG5lZWQgd29ybGQgdHJhbnNmb3JtcyB0byBiZSByZWNhbGN1bGF0ZWRcbiAgICAgICAgbm9kZS5fZGlydGlmeVdvcmxkKCk7XG4gICAgICAgIC8vIG5vZGUgbWlnaHQgYmUgYWxyZWFkeSBtYXJrZWQgYXMgZGlydHksIGluIHRoYXQgY2FzZSB0aGUgd2hvbGUgY2hhaW4gc3RheXMgZnJvemVuLCBzbyBsZXQncyBlbmZvcmNlIHVuZnJlZXplXG4gICAgICAgIGlmICh0aGlzLl9mcm96ZW4pXG4gICAgICAgICAgICBub2RlLl91bmZyZWV6ZVBhcmVudFRvUm9vdCgpO1xuXG4gICAgICAgIC8vIGFsZXJ0IGFuIGVudGl0eSBoaWVyYXJjaHkgdGhhdCBpdCBoYXMgYmVlbiBpbnNlcnRlZFxuICAgICAgICBub2RlLl9maXJlT25IaWVyYXJjaHkoJ2luc2VydCcsICdpbnNlcnRoaWVyYXJjaHknLCB0aGlzKTtcblxuICAgICAgICAvLyBhbGVydCB0aGUgcGFyZW50IHRoYXQgaXQgaGFzIGhhZCBhIGNoaWxkIGluc2VydGVkXG4gICAgICAgIGlmICh0aGlzLmZpcmUpIHRoaXMuZmlyZSgnY2hpbGRpbnNlcnQnLCBub2RlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWN1cnNlIHRoZSBoaWVyYXJjaHkgYW5kIHVwZGF0ZSB0aGUgZ3JhcGggZGVwdGggYXQgZWFjaCBub2RlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlR3JhcGhEZXB0aCgpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGhEZXB0aCA9IHRoaXMuX3BhcmVudCA/IHRoaXMuX3BhcmVudC5fZ3JhcGhEZXB0aCArIDEgOiAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2hpbGRyZW5baV0uX3VwZGF0ZUdyYXBoRGVwdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSB0aGUgbm9kZSBmcm9tIHRoZSBjaGlsZCBsaXN0IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZiB0aGUgY2hpbGQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gY2hpbGQgLSBUaGUgbm9kZSB0byByZW1vdmUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgY2hpbGQgPSB0aGlzLmVudGl0eS5jaGlsZHJlblswXTtcbiAgICAgKiB0aGlzLmVudGl0eS5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICovXG4gICAgcmVtb3ZlQ2hpbGQoY2hpbGQpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9jaGlsZHJlbi5pbmRleE9mKGNoaWxkKTtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIGZyb20gY2hpbGQgbGlzdFxuICAgICAgICB0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgIC8vIENsZWFyIHBhcmVudFxuICAgICAgICBjaGlsZC5fcGFyZW50ID0gbnVsbDtcblxuICAgICAgICAvLyBOT1RFOiBzZWUgUFIgIzQwNDcgLSB0aGlzIGZpeCBpcyByZW1vdmVkIGZvciBub3cgYXMgaXQgYnJlYWtzIG90aGVyIHRoaW5nc1xuICAgICAgICAvLyBub3RpZnkgdGhlIGNoaWxkIGhpZXJhcmNoeSBpdCBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIHBhcmVudCxcbiAgICAgICAgLy8gd2hpY2ggbWFya3MgdGhlbSBhcyBub3QgZW5hYmxlZCBpbiBoaWVyYXJjaHlcbiAgICAgICAgLy8gaWYgKGNoaWxkLl9lbmFibGVkSW5IaWVyYXJjaHkpIHtcbiAgICAgICAgLy8gICAgIGNoaWxkLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQoY2hpbGQsIGZhbHNlKTtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIC8vIGFsZXJ0IGNoaWxkcmVuIHRoYXQgdGhleSBoYXMgYmVlbiByZW1vdmVkXG4gICAgICAgIGNoaWxkLl9maXJlT25IaWVyYXJjaHkoJ3JlbW92ZScsICdyZW1vdmVoaWVyYXJjaHknLCB0aGlzKTtcblxuICAgICAgICAvLyBhbGVydCB0aGUgcGFyZW50IHRoYXQgaXQgaGFzIGhhZCBhIGNoaWxkIHJlbW92ZWRcbiAgICAgICAgdGhpcy5maXJlKCdjaGlsZHJlbW92ZScsIGNoaWxkKTtcbiAgICB9XG5cbiAgICBfc3luYygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMubG9jYWxQb3NpdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uLCB0aGlzLmxvY2FsU2NhbGUpO1xuXG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUxvY2FsID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLmxvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBhcmVudFdvcmxkU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGEgcGFyZW50IG9mIHRoZSBmaXJzdCB1bmNvbXBlbnNhdGVkIG5vZGUgdXAgaW4gdGhlIGhpZXJhcmNoeSBhbmQgdXNlIGl0cyBzY2FsZSAqIGxvY2FsU2NhbGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNjYWxlID0gdGhpcy5sb2NhbFNjYWxlO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50VG9Vc2VTY2FsZUZyb20gPSBwYXJlbnQ7IC8vIGN1cnJlbnQgcGFyZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHBhcmVudFRvVXNlU2NhbGVGcm9tICYmIHBhcmVudFRvVXNlU2NhbGVGcm9tLnNjYWxlQ29tcGVuc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VG9Vc2VTY2FsZUZyb20gPSBwYXJlbnRUb1VzZVNjYWxlRnJvbS5fcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9wbW9zdCBub2RlIHdpdGggc2NhbGUgY29tcGVuc2F0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50VG9Vc2VTY2FsZUZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLl9wYXJlbnQ7IC8vIG5vZGUgd2l0aG91dCBzY2FsZSBjb21wZW5zYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50VG9Vc2VTY2FsZUZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50V29ybGRTY2FsZSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLndvcmxkVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlLm11bDIocGFyZW50V29ybGRTY2FsZSwgdGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGUgPSBzY2FsZUNvbXBlbnNhdGVTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBSb3RhdGlvbiBpcyBhcyB1c3VhbFxuICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QyLnNldEZyb21NYXQ0KHBhcmVudC53b3JsZFRyYW5zZm9ybSk7XG4gICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdC5tdWwyKHNjYWxlQ29tcGVuc2F0ZVJvdDIsIHRoaXMubG9jYWxSb3RhdGlvbik7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBtYXRyaXggdG8gdHJhbnNmb3JtIHBvc2l0aW9uXG4gICAgICAgICAgICAgICAgICAgIGxldCB0bWF0cml4ID0gcGFyZW50LndvcmxkVHJhbnNmb3JtO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50LnNjYWxlQ29tcGVuc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudC5tdWwyKHBhcmVudFdvcmxkU2NhbGUsIHBhcmVudC5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtLnNldFRSUyhwYXJlbnQud29ybGRUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24oc2NhbGVDb21wZW5zYXRlUG9zKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90MixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdG1hdHJpeCA9IHNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0bWF0cml4LnRyYW5zZm9ybVBvaW50KHRoaXMubG9jYWxQb3NpdGlvbiwgc2NhbGVDb21wZW5zYXRlUG9zKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLnNldFRSUyhzY2FsZUNvbXBlbnNhdGVQb3MsIHNjYWxlQ29tcGVuc2F0ZVJvdCwgc2NhbGUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5tdWxBZmZpbmUyKHRoaXMuX3BhcmVudC53b3JsZFRyYW5zZm9ybSwgdGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVdvcmxkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaWNlcyBhdCB0aGlzIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3luY0hpZXJhcmNoeSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9mcm96ZW4pXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2Zyb3plbiA9IHRydWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwgfHwgdGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgdGhpcy5fc3luYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjaGlsZHJlbltpXS5zeW5jSGllcmFyY2h5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW9yaWVudHMgdGhlIGdyYXBoIG5vZGUgc28gdGhhdCB0aGUgbmVnYXRpdmUgei1heGlzIHBvaW50cyB0b3dhcmRzIHRoZSB0YXJnZXQuIFRoaXNcbiAgICAgKiBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIEVpdGhlciBwYXNzIDNEIHZlY3RvcnMgZm9yIHRoZSBsb29rIGF0IGNvb3JkaW5hdGUgYW5kIHVwXG4gICAgICogdmVjdG9yLCBvciBwYXNzIG51bWJlcnMgdG8gcmVwcmVzZW50IHRoZSB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIElmIHBhc3NpbmcgYSAzRCB2ZWN0b3IsIHRoaXMgaXMgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBPdGhlcndpc2UsIGl0IGlzIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IFt5XSAtIElmIHBhc3NpbmcgYSAzRCB2ZWN0b3IsIHRoaXMgaXMgdGhlIHdvcmxkLXNwYWNlIHVwIHZlY3RvciBmb3IgbG9vayBhdFxuICAgICAqIHRyYW5zZm9ybS4gT3RoZXJ3aXNlLCBpdCBpcyB0aGUgeS1jb21wb25lbnQgb2YgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2YgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3V4PTBdIC0gWC1jb21wb25lbnQgb2YgdGhlIHVwIHZlY3RvciBmb3IgdGhlIGxvb2sgYXQgdHJhbnNmb3JtLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXk9MV0gLSBZLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1ej0wXSAtIFotY29tcG9uZW50IG9mIHRoZSB1cCB2ZWN0b3IgZm9yIHRoZSBsb29rIGF0IHRyYW5zZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgYW5vdGhlciBlbnRpdHksIHVzaW5nIHRoZSAoZGVmYXVsdCkgcG9zaXRpdmUgeS1heGlzIGZvciB1cFxuICAgICAqIHZhciBwb3NpdGlvbiA9IG90aGVyRW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KHBvc2l0aW9uKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgYW5vdGhlciBlbnRpdHksIHVzaW5nIHRoZSBuZWdhdGl2ZSB3b3JsZCB5LWF4aXMgZm9yIHVwXG4gICAgICogdmFyIHBvc2l0aW9uID0gb3RoZXJFbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQocG9zaXRpb24sIHBjLlZlYzMuRE9XTik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IHRoZSB3b3JsZCBzcGFjZSBvcmlnaW4sIHVzaW5nIHRoZSAoZGVmYXVsdCkgcG9zaXRpdmUgeS1heGlzIGZvciB1cFxuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdCgwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBbMTAsIDEwLCAxMF0sIHVzaW5nIHRoZSBuZWdhdGl2ZSB3b3JsZCB5LWF4aXMgZm9yIHVwXG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KDEwLCAxMCwgMTAsIDAsIC0xLCAwKTtcbiAgICAgKi9cbiAgICBsb29rQXQoeCwgeSwgeiwgdXggPSAwLCB1eSA9IDEsIHV6ID0gMCkge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRhcmdldC5jb3B5KHgpO1xuXG4gICAgICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHsgLy8gdmVjMywgdmVjM1xuICAgICAgICAgICAgICAgIHVwLmNvcHkoeSk7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyB2ZWMzXG4gICAgICAgICAgICAgICAgdXAuY29weShWZWMzLlVQKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh6ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhcmdldC5zZXQoeCwgeSwgeik7XG4gICAgICAgICAgICB1cC5zZXQodXgsIHV5LCB1eik7XG4gICAgICAgIH1cblxuICAgICAgICBtYXRyaXguc2V0TG9va0F0KHRoaXMuZ2V0UG9zaXRpb24oKSwgdGFyZ2V0LCB1cCk7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21NYXQ0KG1hdHJpeCk7XG4gICAgICAgIHRoaXMuc2V0Um90YXRpb24ocm90YXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCB0cmFuc2xhdGlvbiB2ZWN0b3IuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlXG4gICAgICogd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZSgxMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIHZlY3RvclxuICAgICAqIHZhciB0ID0gbmV3IHBjLlZlYzMoMTAsIDAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZSh0KTtcbiAgICAgKi9cbiAgICB0cmFuc2xhdGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICBwb3NpdGlvbi5hZGQodGhpcy5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNsYXRlcyB0aGUgZ3JhcGggbm9kZSBpbiBsb2NhbC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIHRyYW5zbGF0aW9uIHZlY3Rvci4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGVcbiAgICAgKiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlTG9jYWwoMTAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdCA9IG5ldyBwYy5WZWMzKDEwLCAwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGVMb2NhbCh0KTtcbiAgICAgKi9cbiAgICB0cmFuc2xhdGVMb2NhbCh4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi50cmFuc2Zvcm1WZWN0b3IocG9zaXRpb24sIHBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmFkZChwb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIEV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZSBzcGVjaWZpZWQgaW5cbiAgICAgKiBkZWdyZWVzIGluIFhZWiBvcmRlci4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRFxuICAgICAqIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB3b3JsZC1zcGFjZSByb3RhdGlvbiBvclxuICAgICAqIHJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZSgwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIHZlY3RvclxuICAgICAqIHZhciByID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZShyKTtcbiAgICAgKi9cbiAgICByb3RhdGUoeCwgeSwgeikge1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIocm90YXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByb3QgPSB0aGlzLmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRSb3QgPSB0aGlzLl9wYXJlbnQuZ2V0Um90YXRpb24oKTtcblxuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHJvdGF0aW9uLm11bDIoaW52UGFyZW50Um90LCByb3RhdGlvbik7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihyb3RhdGlvbiwgcm90KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJvdGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gbG9jYWwtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCBFdWxlciBhbmdsZXMuIEV1bGVycyBhcmUgc3BlY2lmaWVkIGluXG4gICAgICogZGVncmVlcyBpbiBYWVogb3JkZXIuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0RcbiAgICAgKiB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2Ugcm90YXRpb24gb3JcbiAgICAgKiByb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2UgeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGVMb2NhbCgwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIHZlY3RvclxuICAgICAqIHZhciByID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZUxvY2FsKHIpO1xuICAgICAqL1xuICAgIHJvdGF0ZUxvY2FsKHgsIHksIHopIHtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwocm90YXRpb24pO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgR3JhcGhOb2RlIH07XG4iXSwibmFtZXMiOlsic2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtIiwiTWF0NCIsInNjYWxlQ29tcGVuc2F0ZVBvcyIsIlZlYzMiLCJzY2FsZUNvbXBlbnNhdGVSb3QiLCJRdWF0Iiwic2NhbGVDb21wZW5zYXRlUm90MiIsInNjYWxlQ29tcGVuc2F0ZVNjYWxlIiwic2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQiLCJ0bXBNYXQ0IiwidG1wUXVhdCIsInBvc2l0aW9uIiwiaW52UGFyZW50V3RtIiwicm90YXRpb24iLCJpbnZQYXJlbnRSb3QiLCJtYXRyaXgiLCJ0YXJnZXQiLCJ1cCIsIl93b3JsZE1hdFgiLCJfd29ybGRNYXRZIiwiX3dvcmxkTWF0WiIsIkdyYXBoTm9kZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibmFtZSIsInRhZ3MiLCJUYWdzIiwiX2xhYmVscyIsImxvY2FsUG9zaXRpb24iLCJsb2NhbFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsImxvY2FsRXVsZXJBbmdsZXMiLCJldWxlckFuZ2xlcyIsIl9zY2FsZSIsImxvY2FsVHJhbnNmb3JtIiwiX2RpcnR5TG9jYWwiLCJfd2FzRGlydHkiLCJfYWFiYlZlciIsIl9mcm96ZW4iLCJ3b3JsZFRyYW5zZm9ybSIsIl9kaXJ0eVdvcmxkIiwiX25lZ2F0aXZlU2NhbGVXb3JsZCIsIl9ub3JtYWxNYXRyaXgiLCJNYXQzIiwiX2RpcnR5Tm9ybWFsIiwiX3JpZ2h0IiwiX3VwIiwiX2ZvcndhcmQiLCJfcGFyZW50IiwiX2NoaWxkcmVuIiwiX2dyYXBoRGVwdGgiLCJfZW5hYmxlZCIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJzY2FsZUNvbXBlbnNhdGlvbiIsInJpZ2h0IiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJnZXRYIiwibm9ybWFsaXplIiwiZ2V0WSIsImZvcndhcmQiLCJnZXRaIiwibXVsU2NhbGFyIiwibm9ybWFsTWF0cml4Iiwibm9ybWFsTWF0IiwiaW52ZXJ0VG8zeDMiLCJ0cmFuc3Bvc2UiLCJlbmFibGVkIiwiX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsInBhcmVudCIsInBhdGgiLCJub2RlIiwicmVzdWx0Iiwicm9vdCIsImNoaWxkcmVuIiwiZ3JhcGhEZXB0aCIsIl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsImMiLCJpIiwibGVuIiwibGVuZ3RoIiwiX3VuZnJlZXplUGFyZW50VG9Sb290IiwiX2Nsb25lSW50ZXJuYWwiLCJjbG9uZSIsIl9saXN0IiwiY2xlYXIiLCJhZGQiLCJPYmplY3QiLCJhc3NpZ24iLCJjb3B5Iiwic291cmNlIiwiZmluZCIsImF0dHIiLCJ2YWx1ZSIsInJlc3VsdHMiLCJGdW5jdGlvbiIsImZuIiwicHVzaCIsImRlc2NlbmRhbnRzIiwiY29uY2F0IiwidGVzdFZhbHVlIiwiZmluZE9uZSIsImZpbmRCeVRhZyIsInF1ZXJ5IiwiYXJndW1lbnRzIiwicXVlcnlOb2RlIiwiY2hlY2tOb2RlIiwiaGFzIiwiZmluZEJ5TmFtZSIsImZvdW5kIiwiZmluZEJ5UGF0aCIsInBhcnRzIiwiQXJyYXkiLCJpc0FycmF5Iiwic3BsaXQiLCJpbWF4IiwiZm9yRWFjaCIsImNhbGxiYWNrIiwidGhpc0FyZyIsImNhbGwiLCJpc0Rlc2NlbmRhbnRPZiIsImlzQW5jZXN0b3JPZiIsImdldEV1bGVyQW5nbGVzIiwiZ2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldExvY2FsUG9zaXRpb24iLCJnZXRMb2NhbFJvdGF0aW9uIiwiZ2V0TG9jYWxTY2FsZSIsImdldExvY2FsVHJhbnNmb3JtIiwic2V0VFJTIiwiZ2V0UG9zaXRpb24iLCJnZXRUcmFuc2xhdGlvbiIsImdldFJvdGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRTY2FsZSIsIl9zeW5jIiwibmVnYXRpdmVTY2FsZVdvcmxkIiwid3QiLCJjcm9zcyIsImRvdCIsInJlcGFyZW50IiwiaW5kZXgiLCJjdXJyZW50IiwicmVtb3ZlQ2hpbGQiLCJpbnNlcnRDaGlsZCIsImFkZENoaWxkIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsIngiLCJ5IiwieiIsInNldEZyb21FdWxlckFuZ2xlcyIsIl9kaXJ0aWZ5TG9jYWwiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0Iiwic2V0TG9jYWxSb3RhdGlvbiIsInciLCJzZXRMb2NhbFNjYWxlIiwiX2RpcnRpZnlXb3JsZCIsInAiLCJfZGlydGlmeVdvcmxkSW50ZXJuYWwiLCJzZXRQb3NpdGlvbiIsImludmVydCIsInRyYW5zZm9ybVBvaW50Iiwic2V0Um90YXRpb24iLCJwYXJlbnRSb3QiLCJtdWwiLCJzZXRFdWxlckFuZ2xlcyIsIm11bDIiLCJfcHJlcGFyZUluc2VydENoaWxkIiwiX29uSW5zZXJ0Q2hpbGQiLCJhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0iLCJ3UG9zIiwid1JvdCIsInNwbGljZSIsIkRlYnVnIiwiYXNzZXJ0IiwiX2ZpcmVPbkhpZXJhcmNoeSIsIm5hbWVIaWVyYXJjaHkiLCJmaXJlIiwiZW5hYmxlZEluSGllcmFyY2h5IiwiX3VwZGF0ZUdyYXBoRGVwdGgiLCJjaGlsZCIsImluZGV4T2YiLCJwYXJlbnRXb3JsZFNjYWxlIiwic2NhbGUiLCJwYXJlbnRUb1VzZVNjYWxlRnJvbSIsInRtYXRyaXgiLCJtdWxBZmZpbmUyIiwic3luY0hpZXJhcmNoeSIsImxvb2tBdCIsInV4IiwidXkiLCJ1eiIsIlVQIiwidW5kZWZpbmVkIiwic2V0TG9va0F0IiwidHJhbnNsYXRlIiwidHJhbnNsYXRlTG9jYWwiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyb3RhdGUiLCJyb3QiLCJyb3RhdGVMb2NhbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU1BLDJCQUEyQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzlDLE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3JDLE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3JDLE1BQU1DLG1CQUFtQixHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBQ3RDLE1BQU1FLG9CQUFvQixHQUFHLElBQUlKLElBQUksRUFBRSxDQUFBO0FBQ3ZDLE1BQU1LLDZCQUE2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
