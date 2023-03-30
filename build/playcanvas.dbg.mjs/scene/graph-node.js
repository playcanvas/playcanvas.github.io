/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
    this._worldScaleSign = 0;

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
  get worldScaleSign() {
    if (this._worldScaleSign === 0) {
      this._worldScaleSign = this.getWorldTransform().scaleSign;
    }
    return this._worldScaleSign;
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
    this._worldScaleSign = 0; // world matrix is dirty, mark this flag dirty too
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuY29uc3Qgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvcyA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBNYXQ0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRtcFF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbmNvbnN0IGludlBhcmVudFJvdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuY29uc3QgdGFyZ2V0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHVwID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZmluZH0gYW5kIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0gdG8gc2VhcmNoIHRocm91Z2ggYSBncmFwaFxuICogbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmluZE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybmluZyBgdHJ1ZWAgd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAqIHtAbGluayBHcmFwaE5vZGUjZmluZH0gb3Ige0BsaW5rIEdyYXBoTm9kZSNmaW5kT25lfS5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEdyYXBoTm9kZSNmb3JFYWNofSB0byBpdGVyYXRlIHRocm91Z2ggYSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzXG4gKiBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRm9yRWFjaE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICovXG5cbi8qKlxuICogQSBoaWVyYXJjaGljYWwgc2NlbmUgbm9kZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoTm9kZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEdyYXBoTm9kZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBUaGUgbm9uLXVuaXF1ZSBuYW1lIG9mIGEgZ3JhcGggbm9kZS4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lID0gJ1VudGl0bGVkJykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9uLXVuaXF1ZSBuYW1lIG9mIGEgZ3JhcGggbm9kZS4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEludGVyZmFjZSBmb3IgdGFnZ2luZyBncmFwaCBub2Rlcy4gVGFnIGJhc2VkIHNlYXJjaGVzIGNhbiBiZSBwZXJmb3JtZWQgdXNpbmcgdGhlXG4gICAgICAgICAqIHtAbGluayBHcmFwaE5vZGUjZmluZEJ5VGFnfSBmdW5jdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RhZ3N9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fbGFiZWxzID0ge307XG5cbiAgICAgICAgLy8gTG9jYWwtc3BhY2UgcHJvcGVydGllcyBvZiB0cmFuc2Zvcm0gKG9ubHkgZmlyc3QgMyBhcmUgc2V0dGFibGUgYnkgdGhlIHVzZXIpXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsU2NhbGUgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsRXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpOyAvLyBPbmx5IGNhbGN1bGF0ZWQgb24gcmVxdWVzdFxuXG4gICAgICAgIC8vIFdvcmxkLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NhbGUgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl93YXNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYWFiYlZlciA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1hcmtzIHRoZSBub2RlIHRvIGlnbm9yZSBoaWVyYXJjaHkgc3luYyBlbnRpcmVseSAoaW5jbHVkaW5nIGNoaWxkcmVuIG5vZGVzKS4gVGhlIGVuZ2luZVxuICAgICAgICAgKiBjb2RlIGF1dG9tYXRpY2FsbHkgZnJlZXplcyBhbmQgdW5mcmVlemVzIG9iamVjdHMgd2hlbmV2ZXIgcmVxdWlyZWQuIFNlZ3JlZ2F0aW5nIGR5bmFtaWNcbiAgICAgICAgICogYW5kIHN0YXRpb25hcnkgbm9kZXMgaW50byBzdWJoaWVyYXJjaGllcyBhbGxvd3MgdG8gcmVkdWNlIHN5bmMgdGltZSBzaWduaWZpY2FudGx5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2Zyb3plbiA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FjaGVkIHZhbHVlIHJlcHJlc2VudGluZyB0aGUgbmVnYXRpdmVseSBzY2FsZWQgd29ybGQgdHJhbnNmb3JtLiBJZiB0aGUgdmFsdWUgaXMgMCxcbiAgICAgICAgICogdGhpcyBtYXJrcyB0aGlzIHZhbHVlIGFzIGRpcnR5IGFuZCBpdCBuZWVkcyB0byBiZSByZWNhbGN1bGF0ZWQuIElmIHRoZSB2YWx1ZSBpcyAxLCB0aGVcbiAgICAgICAgICogd29ybGQgdHJhbnNmb3JtIGlzIG5vdCBuZWdhdGl2ZWx5IHNjYWxlZC4gSWYgdGhlIHZhbHVlIGlzIC0xLCB0aGUgd29ybGQgdHJhbnNmb3JtIGlzXG4gICAgICAgICAqIG5lZ2F0aXZlbHkgc2NhbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fd29ybGRTY2FsZVNpZ24gPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWF0M31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX25vcm1hbE1hdHJpeCA9IG5ldyBNYXQzKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZGlydHlOb3JtYWwgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmlnaHQgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdXAgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZm9yd2FyZCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3BhcmVudCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHcmFwaE5vZGVbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9ncmFwaERlcHRoID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVwcmVzZW50cyBlbmFibGVkIHN0YXRlIG9mIHRoZSBlbnRpdHkuIElmIHRoZSBlbnRpdHkgaXMgZGlzYWJsZWQsIHRoZSBlbnRpdHkgaW5jbHVkaW5nXG4gICAgICAgICAqIGFsbCBjaGlsZHJlbiBhcmUgZXhjbHVkZWQgZnJvbSB1cGRhdGVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXByZXNlbnRzIGVuYWJsZWQgc3RhdGUgb2YgdGhlIGVudGl0eSBpbiB0aGUgaGllcmFyY2h5LiBJdCdzIHRydWUgb25seSBpZiB0aGlzIGVudGl0eVxuICAgICAgICAgKiBhbmQgYWxsIHBhcmVudCBlbnRpdGllcyBhbGwgdGhlIHdheSB0byB0aGUgc2NlbmUncyByb290IGFyZSBlbmFibGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY2FsZUNvbXBlbnNhdGlvbiA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBub3JtYWxpemVkIGxvY2FsIHNwYWNlIFgtYXhpcyB2ZWN0b3Igb2YgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBnZXQgcmlnaHQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3JpZ2h0ID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFgodGhpcy5fcmlnaHQpLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBub3JtYWxpemVkIGxvY2FsIHNwYWNlIFktYXhpcyB2ZWN0b3Igb2YgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBnZXQgdXAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fdXApIHtcbiAgICAgICAgICAgIHRoaXMuX3VwID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFkodGhpcy5fdXApLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBub3JtYWxpemVkIGxvY2FsIHNwYWNlIG5lZ2F0aXZlIFotYXhpcyB2ZWN0b3Igb2YgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQgc3BhY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBnZXQgZm9yd2FyZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9mb3J3YXJkKSB7XG4gICAgICAgICAgICB0aGlzLl9mb3J3YXJkID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFoodGhpcy5fZm9yd2FyZCkubm9ybWFsaXplKCkubXVsU2NhbGFyKC0xKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIG1hdHJpeCB1c2VkIHRvIHRyYW5zZm9ybSB0aGUgbm9ybWFsLlxuICAgICAqXG4gICAgICogQHR5cGUgIHtNYXQzfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgbm9ybWFsTWF0cml4KCkge1xuXG4gICAgICAgIGNvbnN0IG5vcm1hbE1hdCA9IHRoaXMuX25vcm1hbE1hdHJpeDtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5Tm9ybWFsKSB7XG4gICAgICAgICAgICB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuaW52ZXJ0VG8zeDMobm9ybWFsTWF0KTtcbiAgICAgICAgICAgIG5vcm1hbE1hdC50cmFuc3Bvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9ybWFsTWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSBvciBkaXNhYmxlIGEgR3JhcGhOb2RlLiBJZiBvbmUgb2YgdGhlIEdyYXBoTm9kZSdzIHBhcmVudHMgaXMgZGlzYWJsZWQgdGhlcmUgd2lsbCBiZVxuICAgICAqIG5vIG90aGVyIHNpZGUgZWZmZWN0cy4gSWYgYWxsIHRoZSBwYXJlbnRzIGFyZSBlbmFibGVkIHRoZW4gdGhlIG5ldyB2YWx1ZSB3aWxsIGFjdGl2YXRlIG9yXG4gICAgICogZGVhY3RpdmF0ZSBhbGwgdGhlIGVuYWJsZWQgY2hpbGRyZW4gb2YgdGhlIEdyYXBoTm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKGVuYWJsZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IGVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXG4gICAgICAgICAgICAvLyBpZiBlbmFibGluZyBlbnRpdHksIG1ha2UgYWxsIGNoaWxkcmVuIGVuYWJsZWQgaW4gaGllcmFyY2h5IG9ubHkgd2hlbiB0aGUgcGFyZW50IGlzIGFzIHdlbGxcbiAgICAgICAgICAgIC8vIGlmIGRpc2FibGluZyBlbnRpdHksIG1ha2UgYWxsIGNoaWxkcmVuIGRpc2FibGVkIGluIGhpZXJhcmNoeSBpbiBhbGwgY2FzZXNcbiAgICAgICAgICAgIGlmIChlbmFibGVkICYmIHRoaXMuX3BhcmVudD8uZW5hYmxlZCB8fCAhZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCh0aGlzLCBlbmFibGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICAvLyBtYWtlIHN1cmUgdG8gY2hlY2sgdGhpcy5fZW5hYmxlZCB0b28gYmVjYXVzZSBpZiB0aGF0XG4gICAgICAgIC8vIHdhcyBmYWxzZSB3aGVuIGEgcGFyZW50IHdhcyB1cGRhdGVkIHRoZSBfZW5hYmxlZEluSGllcmFyY2h5XG4gICAgICAgIC8vIGZsYWcgbWF5IG5vdCBoYXZlIGJlZW4gdXBkYXRlZCBmb3Igb3B0aW1pemF0aW9uIHB1cnBvc2VzXG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkICYmIHRoaXMuX2VuYWJsZWRJbkhpZXJhcmNoeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgYSBwYXJlbnQgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgcGFyZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgcGF0aCBvZiB0aGUgZ3JhcGggbm9kZSByZWxhdGl2ZSB0byB0aGUgcm9vdCBvZiB0aGUgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgICAgbGV0IG5vZGUgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMubmFtZTtcbiAgICAgICAgd2hpbGUgKG5vZGUgJiYgbm9kZS5fcGFyZW50KSB7XG4gICAgICAgICAgICByZXN1bHQgPSBgJHtub2RlLm5hbWV9LyR7cmVzdWx0fWA7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IGhpZ2hlc3QgZ3JhcGggbm9kZSBmcm9tIGN1cnJlbnQgbm9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV9XG4gICAgICovXG4gICAgZ2V0IHJvb3QoKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzO1xuICAgICAgICB3aGlsZSAocmVzdWx0Ll9wYXJlbnQpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBjaGlsZHJlbiBvZiB0aGlzIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlW119XG4gICAgICovXG4gICAgZ2V0IGNoaWxkcmVuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2hpbGRyZW47XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IHRoZSBkZXB0aCBvZiB0aGlzIGNoaWxkIHdpdGhpbiB0aGUgZ3JhcGguIE5vdGUgdGhhdCBmb3JcbiAgICAgKiBwZXJmb3JtYW5jZSByZWFzb25zIHRoaXMgaXMgb25seSByZWNhbGN1bGF0ZWQgd2hlbiBhIG5vZGUgaXMgYWRkZWQgdG8gYSBuZXcgcGFyZW50LCBpLmUuIEl0XG4gICAgICogaXMgbm90IHJlY2FsY3VsYXRlZCB3aGVuIGEgbm9kZSBpcyBzaW1wbHkgcmVtb3ZlZCBmcm9tIHRoZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGdyYXBoRGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncmFwaERlcHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gR3JhcGggbm9kZSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gVHJ1ZSBpZiBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHksIGZhbHNlIGlmIGRpc2FibGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkKSB7XG4gICAgICAgIG5vZGUuX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkKGVuYWJsZWQpO1xuXG4gICAgICAgIGNvbnN0IGMgPSBub2RlLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjW2ldLl9lbmFibGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjW2ldLCBlbmFibGVkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBlbmFibGVkIGZsYWcgb2YgdGhlIGVudGl0eSBvciBvbmUgb2YgaXRzIHBhcmVudHMgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5LCBmYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKSB7XG4gICAgICAgIC8vIE92ZXJyaWRlIGluIGRlcml2ZWQgY2xhc3Nlc1xuICAgICAgICB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBlbmFibGVkO1xuICAgICAgICBpZiAoZW5hYmxlZCAmJiAhdGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgdGhpcy5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3RoaXN9IGNsb25lIC0gVGhlIGNsb25lZCBncmFwaCBub2RlIHRvIGNvcHkgaW50by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbG9uZUludGVybmFsKGNsb25lKSB7XG4gICAgICAgIGNsb25lLm5hbWUgPSB0aGlzLm5hbWU7XG5cbiAgICAgICAgY29uc3QgdGFncyA9IHRoaXMudGFncy5fbGlzdDtcbiAgICAgICAgY2xvbmUudGFncy5jbGVhcigpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhZ3MubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBjbG9uZS50YWdzLmFkZCh0YWdzW2ldKTtcblxuICAgICAgICBjbG9uZS5fbGFiZWxzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fbGFiZWxzKTtcblxuICAgICAgICBjbG9uZS5sb2NhbFBvc2l0aW9uLmNvcHkodGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgY2xvbmUubG9jYWxSb3RhdGlvbi5jb3B5KHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIGNsb25lLmxvY2FsU2NhbGUuY29weSh0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICBjbG9uZS5sb2NhbEV1bGVyQW5nbGVzLmNvcHkodGhpcy5sb2NhbEV1bGVyQW5nbGVzKTtcblxuICAgICAgICBjbG9uZS5wb3NpdGlvbi5jb3B5KHRoaXMucG9zaXRpb24pO1xuICAgICAgICBjbG9uZS5yb3RhdGlvbi5jb3B5KHRoaXMucm90YXRpb24pO1xuICAgICAgICBjbG9uZS5ldWxlckFuZ2xlcy5jb3B5KHRoaXMuZXVsZXJBbmdsZXMpO1xuXG4gICAgICAgIGNsb25lLmxvY2FsVHJhbnNmb3JtLmNvcHkodGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgIGNsb25lLl9kaXJ0eUxvY2FsID0gdGhpcy5fZGlydHlMb2NhbDtcblxuICAgICAgICBjbG9uZS53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMud29ybGRUcmFuc2Zvcm0pO1xuICAgICAgICBjbG9uZS5fZGlydHlXb3JsZCA9IHRoaXMuX2RpcnR5V29ybGQ7XG4gICAgICAgIGNsb25lLl9kaXJ0eU5vcm1hbCA9IHRoaXMuX2RpcnR5Tm9ybWFsO1xuICAgICAgICBjbG9uZS5fYWFiYlZlciA9IHRoaXMuX2FhYmJWZXIgKyAxO1xuXG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICBjbG9uZS5zY2FsZUNvbXBlbnNhdGlvbiA9IHRoaXMuc2NhbGVDb21wZW5zYXRpb247XG5cbiAgICAgICAgLy8gZmFsc2UgYXMgdGhpcyBub2RlIGlzIG5vdCBpbiB0aGUgaGllcmFyY2h5IHlldFxuICAgICAgICBjbG9uZS5fZW5hYmxlZEluSGllcmFyY2h5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgYSBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgY2xvbmUgb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBjbG9uZSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgIHRoaXMuX2Nsb25lSW50ZXJuYWwoY2xvbmUpO1xuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29weSBhIGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gc291cmNlIC0gVGhlIGdyYXBoIG5vZGUgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfSBUaGUgZGVzdGluYXRpb24gZ3JhcGggbm9kZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgc291cmNlLl9jbG9uZUludGVybmFsKHRoaXMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBub2RlcyB0aGF0IHNhdGlzZnkgc29tZSBzZWFyY2hcbiAgICAgKiBjcml0ZXJpYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmluZE5vZGVDYWxsYmFja3xzdHJpbmd9IGF0dHIgLSBUaGlzIGNhbiBlaXRoZXIgYmUgYSBmdW5jdGlvbiBvciBhIHN0cmluZy4gSWYgaXQncyBhXG4gICAgICogZnVuY3Rpb24sIGl0IGlzIGV4ZWN1dGVkIGZvciBlYWNoIGRlc2NlbmRhbnQgbm9kZSB0byB0ZXN0IGlmIG5vZGUgc2F0aXNmaWVzIHRoZSBzZWFyY2hcbiAgICAgKiBsb2dpYy4gUmV0dXJuaW5nIHRydWUgZnJvbSB0aGUgZnVuY3Rpb24gd2lsbCBpbmNsdWRlIHRoZSBub2RlIGludG8gdGhlIHJlc3VsdHMuIElmIGl0J3MgYVxuICAgICAqIHN0cmluZyB0aGVuIGl0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBmaWVsZCBvciBhIG1ldGhvZCBvZiB0aGUgbm9kZS4gSWYgdGhpcyBpcyB0aGUgbmFtZVxuICAgICAqIG9mIGEgZmllbGQgdGhlbiB0aGUgdmFsdWUgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgd2lsbCBiZSBjaGVja2VkIGZvciBlcXVhbGl0eS4gSWZcbiAgICAgKiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gdGhlbiB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlIGNoZWNrZWQgZm9yXG4gICAgICogZXF1YWxpdHkgYWdhaW5zdCB0aGUgdmFsdWVkIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHRvIHRoaXMgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFt2YWx1ZV0gLSBJZiB0aGUgZmlyc3QgYXJndW1lbnQgKGF0dHIpIGlzIGEgcHJvcGVydHkgbmFtZSB0aGVuIHRoaXMgdmFsdWVcbiAgICAgKiB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGVbXX0gVGhlIGFycmF5IG9mIGdyYXBoIG5vZGVzIHRoYXQgbWF0Y2ggdGhlIHNlYXJjaCBjcml0ZXJpYS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIGFsbCBub2RlcyB0aGF0IGhhdmUgYSBtb2RlbCBjb21wb25lbnQgYW5kIGhhdmUgJ2Rvb3InIGluIHRoZWlyIGxvd2VyLWNhc2VkIG5hbWVcbiAgICAgKiB2YXIgZG9vcnMgPSBob3VzZS5maW5kKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Rvb3InKSAhPT0gLTE7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kcyBhbGwgbm9kZXMgdGhhdCBoYXZlIHRoZSBuYW1lIHByb3BlcnR5IHNldCB0byAnVGVzdCdcbiAgICAgKiB2YXIgZW50aXRpZXMgPSBwYXJlbnQuZmluZCgnbmFtZScsICdUZXN0Jyk7XG4gICAgICovXG4gICAgZmluZChhdHRyLCB2YWx1ZSkge1xuICAgICAgICBsZXQgcmVzdWx0LCByZXN1bHRzID0gW107XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmbiA9IGF0dHI7XG5cbiAgICAgICAgICAgIHJlc3VsdCA9IGZuKHRoaXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2godGhpcyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXNjZW5kYW50cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmQoZm4pO1xuICAgICAgICAgICAgICAgIGlmIChkZXNjZW5kYW50cy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChkZXNjZW5kYW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgdGVzdFZhbHVlO1xuXG4gICAgICAgICAgICBpZiAodGhpc1thdHRyXSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0ZXN0VmFsdWUgPT09IHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2godGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXNjZW5kYW50cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmQoYXR0ciwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChkZXNjZW5kYW50cy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChkZXNjZW5kYW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBmaXJzdCBub2RlIHRoYXQgc2F0aXNmaWVzIHNvbWVcbiAgICAgKiBzZWFyY2ggY3JpdGVyaWEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbmROb2RlQ2FsbGJhY2t8c3RyaW5nfSBhdHRyIC0gVGhpcyBjYW4gZWl0aGVyIGJlIGEgZnVuY3Rpb24gb3IgYSBzdHJpbmcuIElmIGl0J3MgYVxuICAgICAqIGZ1bmN0aW9uLCBpdCBpcyBleGVjdXRlZCBmb3IgZWFjaCBkZXNjZW5kYW50IG5vZGUgdG8gdGVzdCBpZiBub2RlIHNhdGlzZmllcyB0aGUgc2VhcmNoXG4gICAgICogbG9naWMuIFJldHVybmluZyB0cnVlIGZyb20gdGhlIGZ1bmN0aW9uIHdpbGwgcmVzdWx0IGluIHRoYXQgbm9kZSBiZWluZyByZXR1cm5lZCBmcm9tXG4gICAgICogZmluZE9uZS4gSWYgaXQncyBhIHN0cmluZyB0aGVuIGl0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBmaWVsZCBvciBhIG1ldGhvZCBvZiB0aGUgbm9kZS4gSWZcbiAgICAgKiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZmllbGQgdGhlbiB0aGUgdmFsdWUgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgd2lsbCBiZSBjaGVja2VkIGZvclxuICAgICAqIGVxdWFsaXR5LiBJZiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gdGhlbiB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlXG4gICAgICogY2hlY2tlZCBmb3IgZXF1YWxpdHkgYWdhaW5zdCB0aGUgdmFsdWVkIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHRvIHRoaXMgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFt2YWx1ZV0gLSBJZiB0aGUgZmlyc3QgYXJndW1lbnQgKGF0dHIpIGlzIGEgcHJvcGVydHkgbmFtZSB0aGVuIHRoaXMgdmFsdWVcbiAgICAgKiB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV8bnVsbH0gQSBncmFwaCBub2RlIHRoYXQgbWF0Y2ggdGhlIHNlYXJjaCBjcml0ZXJpYS4gUmV0dXJucyBudWxsIGlmIG5vXG4gICAgICogbm9kZSBpcyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmQgdGhlIGZpcnN0IG5vZGUgdGhhdCBpcyBjYWxsZWQgJ2hlYWQnIGFuZCBoYXMgYSBtb2RlbCBjb21wb25lbnRcbiAgICAgKiB2YXIgaGVhZCA9IHBsYXllci5maW5kT25lKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZSA9PT0gJ2hlYWQnO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgdGhlIGZpcnN0IG5vZGUgdGhhdCBoYXMgdGhlIG5hbWUgcHJvcGVydHkgc2V0IHRvICdUZXN0J1xuICAgICAqIHZhciBub2RlID0gcGFyZW50LmZpbmRPbmUoJ25hbWUnLCAnVGVzdCcpO1xuICAgICAqL1xuICAgIGZpbmRPbmUoYXR0ciwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmbiA9IGF0dHI7XG5cbiAgICAgICAgICAgIHJlc3VsdCA9IGZuKHRoaXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRPbmUoZm4pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgdGVzdFZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1thdHRyXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGVzdFZhbHVlID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kT25lKGF0dHIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHNhdGlzZnkgdGhlIHNlYXJjaCBxdWVyeS4gUXVlcnkgY2FuIGJlIHNpbXBseSBhIHN0cmluZywgb3IgY29tbWFcbiAgICAgKiBzZXBhcmF0ZWQgc3RyaW5ncywgdG8gaGF2ZSBpbmNsdXNpdmUgcmVzdWx0cyBvZiBhc3NldHMgdGhhdCBtYXRjaCBhdCBsZWFzdCBvbmUgcXVlcnkuIEFcbiAgICAgKiBxdWVyeSB0aGF0IGNvbnNpc3RzIG9mIGFuIGFycmF5IG9mIHRhZ3MgY2FuIGJlIHVzZWQgdG8gbWF0Y2ggZ3JhcGggbm9kZXMgdGhhdCBoYXZlIGVhY2ggdGFnXG4gICAgICogb2YgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLip9IHF1ZXJ5IC0gTmFtZSBvZiBhIHRhZyBvciBhcnJheSBvZiB0YWdzLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGVbXX0gQSBsaXN0IG9mIGFsbCBncmFwaCBub2RlcyB0aGF0IG1hdGNoIHRoZSBxdWVyeS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCB0YWdnZWQgYnkgYGFuaW1hbGBcbiAgICAgKiB2YXIgYW5pbWFscyA9IG5vZGUuZmluZEJ5VGFnKFwiYW5pbWFsXCIpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHRhZ2dlZCBieSBgYmlyZGAgT1IgYG1hbW1hbGBcbiAgICAgKiB2YXIgYmlyZHNBbmRNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoXCJiaXJkXCIsIFwibWFtbWFsXCIpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgXG4gICAgICogdmFyIG1lYXRFYXRpbmdNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoW1wiY2Fybml2b3JlXCIsIFwibWFtbWFsXCJdKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IChgY2Fybml2b3JlYCBBTkQgYG1hbW1hbGApIE9SIChgY2Fybml2b3JlYCBBTkQgYHJlcHRpbGVgKVxuICAgICAqIHZhciBtZWF0RWF0aW5nTWFtbWFsc0FuZFJlcHRpbGVzID0gbm9kZS5maW5kQnlUYWcoW1wiY2Fybml2b3JlXCIsIFwibWFtbWFsXCJdLCBbXCJjYXJuaXZvcmVcIiwgXCJyZXB0aWxlXCJdKTtcbiAgICAgKi9cbiAgICBmaW5kQnlUYWcoKSB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gYXJndW1lbnRzO1xuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgY29uc3QgcXVlcnlOb2RlID0gKG5vZGUsIGNoZWNrTm9kZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGNoZWNrTm9kZSAmJiBub2RlLnRhZ3MuaGFzKC4uLnF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChub2RlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHF1ZXJ5Tm9kZShub2RlLl9jaGlsZHJlbltpXSwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcXVlcnlOb2RlKHRoaXMsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGZpcnN0IG5vZGUgZm91bmQgaW4gdGhlIGdyYXBoIHdpdGggdGhlIG5hbWUuIFRoZSBzZWFyY2ggaXMgZGVwdGggZmlyc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBncmFwaC5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IFRoZSBmaXJzdCBub2RlIHRvIGJlIGZvdW5kIG1hdGNoaW5nIHRoZSBzdXBwbGllZCBuYW1lLiBSZXR1cm5zXG4gICAgICogbnVsbCBpZiBubyBub2RlIGlzIGZvdW5kLlxuICAgICAqL1xuICAgIGZpbmRCeU5hbWUobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5uYW1lID09PSBuYW1lKSByZXR1cm4gdGhpcztcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRCeU5hbWUobmFtZSk7XG4gICAgICAgICAgICBpZiAoZm91bmQgIT09IG51bGwpIHJldHVybiBmb3VuZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGZpcnN0IG5vZGUgZm91bmQgaW4gdGhlIGdyYXBoIGJ5IGl0cyBmdWxsIHBhdGggaW4gdGhlIGdyYXBoLiBUaGUgZnVsbCBwYXRoIGhhcyB0aGlzXG4gICAgICogZm9ybSAncGFyZW50L2NoaWxkL3N1Yi1jaGlsZCcuIFRoZSBzZWFyY2ggaXMgZGVwdGggZmlyc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gcGF0aCAtIFRoZSBmdWxsIHBhdGggb2YgdGhlIHtAbGluayBHcmFwaE5vZGV9IGFzIGVpdGhlciBhIHN0cmluZyBvclxuICAgICAqIGFycmF5IG9mIHtAbGluayBHcmFwaE5vZGV9IG5hbWVzLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV8bnVsbH0gVGhlIGZpcnN0IG5vZGUgdG8gYmUgZm91bmQgbWF0Y2hpbmcgdGhlIHN1cHBsaWVkIHBhdGguIFJldHVybnNcbiAgICAgKiBudWxsIGlmIG5vIG5vZGUgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTdHJpbmcgZm9ybVxuICAgICAqIHZhciBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aCgnY2hpbGQvZ3JhbmRjaGlsZCcpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXJyYXkgZm9ybVxuICAgICAqIHZhciBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aChbJ2NoaWxkJywgJ2dyYW5kY2hpbGQnXSk7XG4gICAgICovXG4gICAgZmluZEJ5UGF0aChwYXRoKSB7XG4gICAgICAgIC8vIGFjY2VwdCBlaXRoZXIgc3RyaW5nIHBhdGggd2l0aCAnLycgc2VwYXJhdG9ycyBvciBhcnJheSBvZiBwYXJ0cy5cbiAgICAgICAgY29uc3QgcGFydHMgPSBBcnJheS5pc0FycmF5KHBhdGgpID8gcGF0aCA6IHBhdGguc3BsaXQoJy8nKTtcblxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGltYXggPSBwYXJ0cy5sZW5ndGg7IGkgPCBpbWF4OyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jaGlsZHJlbi5maW5kKGMgPT4gYy5uYW1lID09PSBwYXJ0c1tpXSk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlcyBhIHByb3ZpZGVkIGZ1bmN0aW9uIG9uY2Ugb24gdGhpcyBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGb3JFYWNoTm9kZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIG9uIHRoZSBncmFwaCBub2RlIGFuZCBlYWNoXG4gICAgICogZGVzY2VuZGFudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3RoaXNBcmddIC0gT3B0aW9uYWwgdmFsdWUgdG8gdXNlIGFzIHRoaXMgd2hlbiBleGVjdXRpbmcgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb2cgdGhlIHBhdGggYW5kIG5hbWUgb2YgZWFjaCBub2RlIGluIGRlc2NlbmRhbnQgdHJlZSBzdGFydGluZyB3aXRoIFwicGFyZW50XCJcbiAgICAgKiBwYXJlbnQuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhub2RlLnBhdGggKyBcIi9cIiArIG5vZGUubmFtZSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuW2ldLmZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgbm9kZSBpcyBkZXNjZW5kYW50IG9mIGFub3RoZXIgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gUG90ZW50aWFsIGFuY2VzdG9yIG9mIG5vZGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIG5vZGUgaXMgZGVzY2VuZGFudCBvZiBhbm90aGVyIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAocm9vZi5pc0Rlc2NlbmRhbnRPZihob3VzZSkpIHtcbiAgICAgKiAgICAgLy8gcm9vZiBpcyBkZXNjZW5kYW50IG9mIGhvdXNlIGVudGl0eVxuICAgICAqIH1cbiAgICAgKi9cbiAgICBpc0Rlc2NlbmRhbnRPZihub2RlKSB7XG4gICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGlmIChwYXJlbnQgPT09IG5vZGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBub2RlIGlzIGFuY2VzdG9yIGZvciBhbm90aGVyIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFBvdGVudGlhbCBkZXNjZW5kYW50IG9mIG5vZGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIG5vZGUgaXMgYW5jZXN0b3IgZm9yIGFub3RoZXIgbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChib2R5LmlzQW5jZXN0b3JPZihmb290KSkge1xuICAgICAqICAgICAvLyBmb290IGlzIHdpdGhpbiBib2R5J3MgaGllcmFyY2h5XG4gICAgICogfVxuICAgICAqL1xuICAgIGlzQW5jZXN0b3JPZihub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlLmlzRGVzY2VuZGFudE9mKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlIGluIEV1bGVyIGFuZ2xlIGZvcm0uIFRoZSByb3RhdGlvblxuICAgICAqIGlzIHJldHVybmVkIGFzIGV1bGVyIGFuZ2xlcyBpbiBhIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlXG4gICAgICogY29uc2lkZXJlZCByZWFkLW9ubHkuIEluIG9yZGVyIHRvIHNldCB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZVxuICAgICAqIHtAbGluayBHcmFwaE5vZGUjc2V0RXVsZXJBbmdsZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBpbiBFdWxlciBhbmdsZSBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFuZ2xlcyA9IHRoaXMuZW50aXR5LmdldEV1bGVyQW5nbGVzKCk7XG4gICAgICogYW5nbGVzLnkgPSAxODA7IC8vIHJvdGF0ZSB0aGUgZW50aXR5IGFyb3VuZCBZIGJ5IDE4MCBkZWdyZWVzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcygpIHtcbiAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldEV1bGVyQW5nbGVzKHRoaXMuZXVsZXJBbmdsZXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5ldWxlckFuZ2xlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzXG4gICAgICogZXVsZXIgYW5nbGVzIGluIGEge0BsaW5rIFZlYzN9LiBUaGUgcmV0dXJuZWQgdmVjdG9yIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG9cbiAgICAgKiB1cGRhdGUgdGhlIGxvY2FsIHJvdGF0aW9uLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbEV1bGVyQW5nbGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgbG9jYWwgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgZXVsZXIgYW5nbGVzIGluIFhZWiBvcmRlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogYW5nbGVzLnkgPSAxODA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIGdldExvY2FsRXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5nZXRFdWxlckFuZ2xlcyh0aGlzLmxvY2FsRXVsZXJBbmdsZXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbEV1bGVyQW5nbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcG9zaXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiBwb3NpdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHBvc2l0aW9uID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAqIHBvc2l0aW9uLnggKz0gMTsgLy8gbW92ZSB0aGUgZW50aXR5IDEgdW5pdCBhbG9uZyB4LlxuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqL1xuICAgIGdldExvY2FsUG9zaXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsUG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSByb3RhdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFF1YXR9LiBUaGUgcmV0dXJuZWQgcXVhdGVybmlvbiBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiByb3RhdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxSb3RhdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIGxvY2FsIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGEgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciByb3RhdGlvbiA9IHRoaXMuZW50aXR5LmdldExvY2FsUm90YXRpb24oKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFJvdGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFJvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgc2NhbGUgaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgc2NhbGUgaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWwgc2NhbGUsXG4gICAgICogdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxTY2FsZX0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHNjYWxlIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpO1xuICAgICAqIHNjYWxlLnggPSAxMDA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZShzY2FsZSk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxTY2FsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxTY2FsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGxvY2FsIHRyYW5zZm9ybSBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS4gVGhpcyBtYXRyaXggaXMgdGhlIHRyYW5zZm9ybSByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBub2RlJ3MgcGFyZW50J3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3MgbG9jYWwgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHRyYW5zZm9ybSA9IHRoaXMuZW50aXR5LmdldExvY2FsVHJhbnNmb3JtKCk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxUcmFuc2Zvcm0oKSB7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHBvc2l0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXJcbiAgICAgKiB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHBvc2l0aW9uID0gdGhpcy5lbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiBwb3NpdGlvbi54ID0gMTA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqL1xuICAgIGdldFBvc2l0aW9uKCkge1xuICAgICAgICB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0VHJhbnNsYXRpb24odGhpcy5wb3NpdGlvbik7XG4gICAgICAgIHJldHVybiB0aGlzLnBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcm90YXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBRdWF0fS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBJbiBvcmRlclxuICAgICAqIHRvIHNldCB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldFJvdGF0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgYSBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHJvdGF0aW9uID0gdGhpcy5lbnRpdHkuZ2V0Um90YXRpb24oKTtcbiAgICAgKi9cbiAgICBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgdGhpcy5yb3RhdGlvbi5zZXRGcm9tTWF0NCh0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gdGhpcy5yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJldHVybmVkIHZhbHVlIHdpbGwgb25seSBiZVxuICAgICAqIGNvcnJlY3QgZm9yIGdyYXBoIG5vZGVzIHRoYXQgaGF2ZSBhIG5vbi1za2V3ZWQgd29ybGQgdHJhbnNmb3JtIChhIHNrZXcgY2FuIGJlIGludHJvZHVjZWQgYnlcbiAgICAgKiB0aGUgY29tcG91bmRpbmcgb2Ygcm90YXRpb25zIGFuZCBzY2FsZXMgaGlnaGVyIGluIHRoZSBncmFwaCBub2RlIGhpZXJhcmNoeSkuIFRoZSBzY2FsZSBpc1xuICAgICAqIHJldHVybmVkIGFzIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZFxuICAgICAqIHJlYWQtb25seS4gTm90ZSB0aGF0IGl0IGlzIG5vdCBwb3NzaWJsZSB0byBzZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIG9mIGEgZ3JhcGggbm9kZVxuICAgICAqIGRpcmVjdGx5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzY2FsZSA9IHRoaXMuZW50aXR5LmdldFNjYWxlKCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFNjYWxlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NjYWxlKSB7XG4gICAgICAgICAgICB0aGlzLl9zY2FsZSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRTY2FsZSh0aGlzLl9zY2FsZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBUaGUgbm9kZSdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB0cmFuc2Zvcm0gPSB0aGlzLmVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAqL1xuICAgIGdldFdvcmxkVHJhbnNmb3JtKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwgJiYgIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50KVxuICAgICAgICAgICAgdGhpcy5fcGFyZW50LmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgdGhpcy5fc3luYygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLndvcmxkVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgY2FjaGVkIHZhbHVlIG9mIG5lZ2F0aXZlIHNjYWxlIG9mIHRoZSB3b3JsZCB0cmFuc2Zvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtMSBpZiB3b3JsZCB0cmFuc2Zvcm0gaGFzIG5lZ2F0aXZlIHNjYWxlLCAxIG90aGVyd2lzZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHdvcmxkU2NhbGVTaWduKCkge1xuXG4gICAgICAgIGlmICh0aGlzLl93b3JsZFNjYWxlU2lnbiA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fd29ybGRTY2FsZVNpZ24gPSB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuc2NhbGVTaWduO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX3dvcmxkU2NhbGVTaWduO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBncmFwaCBub2RlIGZyb20gY3VycmVudCBwYXJlbnQgYW5kIGFkZCBhcyBjaGlsZCB0byBuZXcgcGFyZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHBhcmVudCAtIE5ldyBwYXJlbnQgdG8gYXR0YWNoIGdyYXBoIG5vZGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbmRleF0gLSBUaGUgY2hpbGQgaW5kZXggd2hlcmUgdGhlIGNoaWxkIG5vZGUgc2hvdWxkIGJlIHBsYWNlZC5cbiAgICAgKi9cbiAgICByZXBhcmVudChwYXJlbnQsIGluZGV4KSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9wYXJlbnQ7XG5cbiAgICAgICAgaWYgKGN1cnJlbnQpXG4gICAgICAgICAgICBjdXJyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xuXG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50Lmluc2VydENoaWxkKHRoaXMsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlIHVzaW5nIGV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZVxuICAgICAqIGludGVycHJldGVkIGluIFhZWiBvcmRlci4gRXVsZXJzIG11c3QgYmUgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIGV1bGVyXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBldWxlcnMgb3Igcm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlXG4gICAgICogeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHktYXhpcyB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcygwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgeS1heGlzIHZpYSBhIHZlY3RvclxuICAgICAqIHZhciBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldExvY2FsRXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBwb3MgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3MpO1xuICAgICAqL1xuICAgIHNldExvY2FsUG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxSb3RhdGlvbigwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgcXVhdGVybmlvblxuICAgICAqIHZhciBxID0gcGMuUXVhdCgpO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUm90YXRpb24ocSk7XG4gICAgICovXG4gICAgc2V0TG9jYWxSb3RhdGlvbih4LCB5LCB6LCB3KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0KHgsIHksIHosIHcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugc2NhbGUgZmFjdG9yIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSBzY2FsZSBvciB4LWNvb3JkaW5hdGVcbiAgICAgKiBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIHZhciBzY2FsZSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIHNldExvY2FsU2NhbGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTY2FsZS5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFNjYWxlLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5TG9jYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl93YXNEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZClcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91bmZyZWV6ZVBhcmVudFRvUm9vdCgpIHtcbiAgICAgICAgbGV0IHAgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIHdoaWxlIChwKSB7XG4gICAgICAgICAgICBwLl9mcm96ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHAgPSBwLl9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeVdvcmxkKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICB0aGlzLl91bmZyZWV6ZVBhcmVudFRvUm9vdCgpO1xuICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICB0aGlzLl9mcm96ZW4gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2hpbGRyZW5baV0uX2RpcnR5V29ybGQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl9kaXJ0aWZ5V29ybGRJbnRlcm5hbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RpcnR5Tm9ybWFsID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fd29ybGRTY2FsZVNpZ24gPSAwOyAgIC8vIHdvcmxkIG1hdHJpeCBpcyBkaXJ0eSwgbWFyayB0aGlzIGZsYWcgZGlydHkgdG9vXG4gICAgICAgIHRoaXMuX2FhYmJWZXIrKztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlXG4gICAgICogcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB3b3JsZC1zcGFjZSBwb3NpdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKDAsIDEwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgdmVjdG9yXG4gICAgICogdmFyIHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBzZXRQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpKS5pbnZlcnQoKTtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0Um90YXRpb24oMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHF1YXRlcm5pb25cbiAgICAgKiB2YXIgcSA9IHBjLlF1YXQoKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbihxKTtcbiAgICAgKi9cbiAgICBzZXRSb3RhdGlvbih4LCB5LCB6LCB3KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgcm90YXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJvdGF0aW9uLnNldCh4LCB5LCB6LCB3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KHJvdGF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KGludlBhcmVudFJvdCkubXVsKHJvdGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZSB1c2luZyBldWxlciBhbmdsZXMuIEV1bGVycyBhcmVcbiAgICAgKiBpbnRlcnByZXRlZCBpbiBYWVogb3JkZXIuIEV1bGVycyBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZSBldWxlclxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgZXVsZXJzIG9yIHJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZVxuICAgICAqIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgdmlhIGEgdmVjdG9yXG4gICAgICogdmFyIGFuZ2xlcyA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldEV1bGVyQW5nbGVzKHgsIHksIHopIHtcbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRSb3QgPSB0aGlzLl9wYXJlbnQuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIGludlBhcmVudFJvdC5jb3B5KHBhcmVudFJvdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihpbnZQYXJlbnRSb3QsIHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBuZXcgY2hpbGQgdG8gdGhlIGNoaWxkIGxpc3QgYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mIHRoZSBjaGlsZCBub2RlLlxuICAgICAqIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBuZXcgY2hpbGQgdG8gYWRkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGQoZSk7XG4gICAgICovXG4gICAgYWRkQ2hpbGQobm9kZSkge1xuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgY2hpbGQgdG8gdGhpcyBub2RlLCBtYWludGFpbmluZyB0aGUgY2hpbGQncyB0cmFuc2Zvcm0gaW4gd29ybGQgc3BhY2UuXG4gICAgICogSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5LmFkZENoaWxkQW5kU2F2ZVRyYW5zZm9ybShlKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtKG5vZGUpIHtcblxuICAgICAgICBjb25zdCB3UG9zID0gbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3Um90ID0gbm9kZS5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgIHRoaXMuX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKTtcblxuICAgICAgICBub2RlLnNldFBvc2l0aW9uKHRtcE1hdDQuY29weSh0aGlzLndvcmxkVHJhbnNmb3JtKS5pbnZlcnQoKS50cmFuc2Zvcm1Qb2ludCh3UG9zKSk7XG4gICAgICAgIG5vZGUuc2V0Um90YXRpb24odG1wUXVhdC5jb3B5KHRoaXMuZ2V0Um90YXRpb24oKSkuaW52ZXJ0KCkubXVsKHdSb3QpKTtcblxuICAgICAgICB0aGlzLl9jaGlsZHJlbi5wdXNoKG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBhIG5ldyBjaGlsZCB0byB0aGUgY2hpbGQgbGlzdCBhdCB0aGUgc3BlY2lmaWVkIGluZGV4IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZlxuICAgICAqIHRoZSBjaGlsZCBub2RlLiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbmV3IGNoaWxkIHRvIGluc2VydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggaW4gdGhlIGNoaWxkIGxpc3Qgb2YgdGhlIHBhcmVudCB3aGVyZSB0aGUgbmV3IG5vZGUgd2lsbCBiZVxuICAgICAqIGluc2VydGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuaW5zZXJ0Q2hpbGQoZSwgMSk7XG4gICAgICovXG4gICAgaW5zZXJ0Q2hpbGQobm9kZSwgaW5kZXgpIHtcblxuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMCwgbm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJlcGFyZXMgbm9kZSBmb3IgYmVpbmcgaW5zZXJ0ZWQgdG8gYSBwYXJlbnQgbm9kZSwgYW5kIHJlbW92ZXMgaXQgZnJvbSB0aGUgcHJldmlvdXMgcGFyZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbm9kZSBiZWluZyBpbnNlcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSkge1xuXG4gICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIHRoZSBleGlzdGluZyBwYXJlbnRcbiAgICAgICAgaWYgKG5vZGUuX3BhcmVudCkge1xuICAgICAgICAgICAgbm9kZS5fcGFyZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KG5vZGUgIT09IHRoaXMsIGBHcmFwaE5vZGUgJHtub2RlPy5uYW1lfSBjYW5ub3QgYmUgYSBjaGlsZCBvZiBpdHNlbGZgKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmlzRGVzY2VuZGFudE9mKG5vZGUpLCBgR3JhcGhOb2RlICR7bm9kZT8ubmFtZX0gY2Fubm90IGFkZCBhbiBhbmNlc3RvciBhcyBhIGNoaWxkYCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZXMgYW4gZXZlbnQgb24gYWxsIGNoaWxkcmVuIG9mIHRoZSBub2RlLiBUaGUgZXZlbnQgYG5hbWVgIGlzIGZpcmVkIG9uIHRoZSBmaXJzdCAocm9vdClcbiAgICAgKiBub2RlIG9ubHkuIFRoZSBldmVudCBgbmFtZUhpZXJhcmNoeWAgaXMgZmlyZWQgZm9yIGFsbCBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIGZpcmUgb24gdGhlIHJvb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWVIaWVyYXJjaHkgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gZmlyZSBmb3IgYWxsIGRlc2NlbmRhbnRzLlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBwYXJlbnQgLSBUaGUgcGFyZW50IG9mIHRoZSBub2RlIGJlaW5nIGFkZGVkL3JlbW92ZWQgZnJvbSB0aGUgaGllcmFyY2h5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ZpcmVPbkhpZXJhcmNoeShuYW1lLCBuYW1lSGllcmFyY2h5LCBwYXJlbnQpIHtcbiAgICAgICAgdGhpcy5maXJlKG5hbWUsIHBhcmVudCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl9maXJlT25IaWVyYXJjaHkobmFtZUhpZXJhcmNoeSwgbmFtZUhpZXJhcmNoeSwgcGFyZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIGEgbm9kZSBpcyBpbnNlcnRlZCBpbnRvIGEgbm9kZSdzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBub2RlIHRoYXQgd2FzIGluc2VydGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uSW5zZXJ0Q2hpbGQobm9kZSkge1xuICAgICAgICBub2RlLl9wYXJlbnQgPSB0aGlzO1xuXG4gICAgICAgIC8vIHRoZSBjaGlsZCBub2RlIHNob3VsZCBiZSBlbmFibGVkIGluIHRoZSBoaWVyYXJjaHkgb25seSBpZiBpdHNlbGYgaXMgZW5hYmxlZCBhbmQgaWZcbiAgICAgICAgLy8gdGhpcyBwYXJlbnQgaXMgZW5hYmxlZFxuICAgICAgICBjb25zdCBlbmFibGVkSW5IaWVyYXJjaHkgPSAobm9kZS5fZW5hYmxlZCAmJiB0aGlzLmVuYWJsZWQpO1xuICAgICAgICBpZiAobm9kZS5fZW5hYmxlZEluSGllcmFyY2h5ICE9PSBlbmFibGVkSW5IaWVyYXJjaHkpIHtcbiAgICAgICAgICAgIG5vZGUuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGVuYWJsZWRJbkhpZXJhcmNoeTtcblxuICAgICAgICAgICAgLy8gcHJvcGFnYXRlIHRoZSBjaGFuZ2UgdG8gdGhlIGNoaWxkcmVuIC0gbmVjZXNzYXJ5IGlmIHdlIHJlcGFyZW50IGEgbm9kZVxuICAgICAgICAgICAgLy8gdW5kZXIgYSBwYXJlbnQgd2l0aCBhIGRpZmZlcmVudCBlbmFibGVkIHN0YXRlIChpZiB3ZSByZXBhcmVudCBhIG5vZGUgdGhhdCBpc1xuICAgICAgICAgICAgLy8gbm90IGFjdGl2ZSBpbiB0aGUgaGllcmFyY2h5IHVuZGVyIGEgcGFyZW50IHdobyBpcyBhY3RpdmUgaW4gdGhlIGhpZXJhcmNoeSB0aGVuXG4gICAgICAgICAgICAvLyB3ZSB3YW50IG91ciBub2RlIHRvIGJlIGFjdGl2YXRlZClcbiAgICAgICAgICAgIG5vZGUuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkSW5IaWVyYXJjaHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGdyYXBoIGRlcHRoIG9mIHRoZSBjaGlsZCBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyB3aWxsIG5vdyBjaGFuZ2VcbiAgICAgICAgbm9kZS5fdXBkYXRlR3JhcGhEZXB0aCgpO1xuXG4gICAgICAgIC8vIFRoZSBjaGlsZCAocGx1cyBzdWJoaWVyYXJjaHkpIHdpbGwgbmVlZCB3b3JsZCB0cmFuc2Zvcm1zIHRvIGJlIHJlY2FsY3VsYXRlZFxuICAgICAgICBub2RlLl9kaXJ0aWZ5V29ybGQoKTtcbiAgICAgICAgLy8gbm9kZSBtaWdodCBiZSBhbHJlYWR5IG1hcmtlZCBhcyBkaXJ0eSwgaW4gdGhhdCBjYXNlIHRoZSB3aG9sZSBjaGFpbiBzdGF5cyBmcm96ZW4sIHNvIGxldCdzIGVuZm9yY2UgdW5mcmVlemVcbiAgICAgICAgaWYgKHRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIG5vZGUuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG5cbiAgICAgICAgLy8gYWxlcnQgYW4gZW50aXR5IGhpZXJhcmNoeSB0aGF0IGl0IGhhcyBiZWVuIGluc2VydGVkXG4gICAgICAgIG5vZGUuX2ZpcmVPbkhpZXJhcmNoeSgnaW5zZXJ0JywgJ2luc2VydGhpZXJhcmNoeScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGFsZXJ0IHRoZSBwYXJlbnQgdGhhdCBpdCBoYXMgaGFkIGEgY2hpbGQgaW5zZXJ0ZWRcbiAgICAgICAgaWYgKHRoaXMuZmlyZSkgdGhpcy5maXJlKCdjaGlsZGluc2VydCcsIG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY3Vyc2UgdGhlIGhpZXJhcmNoeSBhbmQgdXBkYXRlIHRoZSBncmFwaCBkZXB0aCBhdCBlYWNoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVHcmFwaERlcHRoKCkge1xuICAgICAgICB0aGlzLl9ncmFwaERlcHRoID0gdGhpcy5fcGFyZW50ID8gdGhpcy5fcGFyZW50Ll9ncmFwaERlcHRoICsgMSA6IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fdXBkYXRlR3JhcGhEZXB0aCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBub2RlIGZyb20gdGhlIGNoaWxkIGxpc3QgYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mIHRoZSBjaGlsZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBjaGlsZCAtIFRoZSBub2RlIHRvIHJlbW92ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBjaGlsZCA9IHRoaXMuZW50aXR5LmNoaWxkcmVuWzBdO1xuICAgICAqIHRoaXMuZW50aXR5LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgKi9cbiAgICByZW1vdmVDaGlsZChjaGlsZCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2NoaWxkcmVuLmluZGV4T2YoY2hpbGQpO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgZnJvbSBjaGlsZCBsaXN0XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgICAgLy8gQ2xlYXIgcGFyZW50XG4gICAgICAgIGNoaWxkLl9wYXJlbnQgPSBudWxsO1xuXG4gICAgICAgIC8vIE5PVEU6IHNlZSBQUiAjNDA0NyAtIHRoaXMgZml4IGlzIHJlbW92ZWQgZm9yIG5vdyBhcyBpdCBicmVha3Mgb3RoZXIgdGhpbmdzXG4gICAgICAgIC8vIG5vdGlmeSB0aGUgY2hpbGQgaGllcmFyY2h5IGl0IGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50LFxuICAgICAgICAvLyB3aGljaCBtYXJrcyB0aGVtIGFzIG5vdCBlbmFibGVkIGluIGhpZXJhcmNoeVxuICAgICAgICAvLyBpZiAoY2hpbGQuX2VuYWJsZWRJbkhpZXJhcmNoeSkge1xuICAgICAgICAvLyAgICAgY2hpbGQuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjaGlsZCwgZmFsc2UpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gYWxlcnQgY2hpbGRyZW4gdGhhdCB0aGV5IGhhcyBiZWVuIHJlbW92ZWRcbiAgICAgICAgY2hpbGQuX2ZpcmVPbkhpZXJhcmNoeSgncmVtb3ZlJywgJ3JlbW92ZWhpZXJhcmNoeScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGFsZXJ0IHRoZSBwYXJlbnQgdGhhdCBpdCBoYXMgaGFkIGEgY2hpbGQgcmVtb3ZlZFxuICAgICAgICB0aGlzLmZpcmUoJ2NoaWxkcmVtb3ZlJywgY2hpbGQpO1xuICAgIH1cblxuICAgIF9zeW5jKCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFRyYW5zZm9ybS5zZXRUUlModGhpcy5sb2NhbFBvc2l0aW9uLCB0aGlzLmxvY2FsUm90YXRpb24sIHRoaXMubG9jYWxTY2FsZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50V29ybGRTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgYSBwYXJlbnQgb2YgdGhlIGZpcnN0IHVuY29tcGVuc2F0ZWQgbm9kZSB1cCBpbiB0aGUgaGllcmFyY2h5IGFuZCB1c2UgaXRzIHNjYWxlICogbG9jYWxTY2FsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgc2NhbGUgPSB0aGlzLmxvY2FsU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudDsgLy8gY3VycmVudCBwYXJlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAocGFyZW50VG9Vc2VTY2FsZUZyb20gJiYgcGFyZW50VG9Vc2VTY2FsZUZyb20uc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLl9wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b3Btb3N0IG5vZGUgd2l0aCBzY2FsZSBjb21wZW5zYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50VG9Vc2VTY2FsZUZyb20uX3BhcmVudDsgLy8gbm9kZSB3aXRob3V0IHNjYWxlIGNvbXBlbnNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRXb3JsZFNjYWxlID0gcGFyZW50VG9Vc2VTY2FsZUZyb20ud29ybGRUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGUubXVsMihwYXJlbnRXb3JsZFNjYWxlLCB0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZSA9IHNjYWxlQ29tcGVuc2F0ZVNjYWxlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJvdGF0aW9uIGlzIGFzIHVzdWFsXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdDIuc2V0RnJvbU1hdDQocGFyZW50LndvcmxkVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90Lm11bDIoc2NhbGVDb21wZW5zYXRlUm90MiwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIG1hdHJpeCB0byB0cmFuc2Zvcm0gcG9zaXRpb25cbiAgICAgICAgICAgICAgICAgICAgbGV0IHRtYXRyaXggPSBwYXJlbnQud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnQuc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50Lm11bDIocGFyZW50V29ybGRTY2FsZSwgcGFyZW50LmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm0uc2V0VFJTKHBhcmVudC53b3JsZFRyYW5zZm9ybS5nZXRUcmFuc2xhdGlvbihzY2FsZUNvbXBlbnNhdGVQb3MpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bWF0cml4ID0gc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRtYXRyaXgudHJhbnNmb3JtUG9pbnQodGhpcy5sb2NhbFBvc2l0aW9uLCBzY2FsZUNvbXBlbnNhdGVQb3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0uc2V0VFJTKHNjYWxlQ29tcGVuc2F0ZVBvcywgc2NhbGVDb21wZW5zYXRlUm90LCBzY2FsZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLm11bEFmZmluZTIodGhpcy5fcGFyZW50LndvcmxkVHJhbnNmb3JtLCB0aGlzLmxvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpY2VzIGF0IHRoaXMgbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzeW5jSGllcmFyY2h5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fZnJvemVuID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCB8fCB0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICB0aGlzLl9zeW5jKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuW2ldLnN5bmNIaWVyYXJjaHkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlb3JpZW50cyB0aGUgZ3JhcGggbm9kZSBzbyB0aGF0IHRoZSBuZWdhdGl2ZSB6LWF4aXMgcG9pbnRzIHRvd2FyZHMgdGhlIHRhcmdldC4gVGhpc1xuICAgICAqIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gRWl0aGVyIHBhc3MgM0QgdmVjdG9ycyBmb3IgdGhlIGxvb2sgYXQgY29vcmRpbmF0ZSBhbmQgdXBcbiAgICAgKiB2ZWN0b3IsIG9yIHBhc3MgbnVtYmVycyB0byByZXByZXNlbnQgdGhlIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gSWYgcGFzc2luZyBhIDNEIHZlY3RvciwgdGhpcyBpcyB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIE90aGVyd2lzZSwgaXQgaXMgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gSWYgcGFzc2luZyBhIDNEIHZlY3RvciwgdGhpcyBpcyB0aGUgd29ybGQtc3BhY2UgdXAgdmVjdG9yIGZvciBsb29rIGF0XG4gICAgICogdHJhbnNmb3JtLiBPdGhlcndpc2UsIGl0IGlzIHRoZSB5LWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXg9MF0gLSBYLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1eT0xXSAtIFktY29tcG9uZW50IG9mIHRoZSB1cCB2ZWN0b3IgZm9yIHRoZSBsb29rIGF0IHRyYW5zZm9ybS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3V6PTBdIC0gWi1jb21wb25lbnQgb2YgdGhlIHVwIHZlY3RvciBmb3IgdGhlIGxvb2sgYXQgdHJhbnNmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCBhbm90aGVyIGVudGl0eSwgdXNpbmcgdGhlIChkZWZhdWx0KSBwb3NpdGl2ZSB5LWF4aXMgZm9yIHVwXG4gICAgICogdmFyIHBvc2l0aW9uID0gb3RoZXJFbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQocG9zaXRpb24pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCBhbm90aGVyIGVudGl0eSwgdXNpbmcgdGhlIG5lZ2F0aXZlIHdvcmxkIHktYXhpcyBmb3IgdXBcbiAgICAgKiB2YXIgcG9zaXRpb24gPSBvdGhlckVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdChwb3NpdGlvbiwgcGMuVmVjMy5ET1dOKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgdGhlIHdvcmxkIHNwYWNlIG9yaWdpbiwgdXNpbmcgdGhlIChkZWZhdWx0KSBwb3NpdGl2ZSB5LWF4aXMgZm9yIHVwXG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KDAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxMCwgMTAsIDEwXSwgdXNpbmcgdGhlIG5lZ2F0aXZlIHdvcmxkIHktYXhpcyBmb3IgdXBcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQoMTAsIDEwLCAxMCwgMCwgLTEsIDApO1xuICAgICAqL1xuICAgIGxvb2tBdCh4LCB5LCB6LCB1eCA9IDAsIHV5ID0gMSwgdXogPSAwKSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGFyZ2V0LmNvcHkoeCk7XG5cbiAgICAgICAgICAgIGlmICh5IGluc3RhbmNlb2YgVmVjMykgeyAvLyB2ZWMzLCB2ZWMzXG4gICAgICAgICAgICAgICAgdXAuY29weSh5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIHZlYzNcbiAgICAgICAgICAgICAgICB1cC5jb3B5KFZlYzMuVVApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHogPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0LnNldCh4LCB5LCB6KTtcbiAgICAgICAgICAgIHVwLnNldCh1eCwgdXksIHV6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdHJpeC5zZXRMb29rQXQodGhpcy5nZXRQb3NpdGlvbigpLCB0YXJnZXQsIHVwKTtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbU1hdDQobWF0cml4KTtcbiAgICAgICAgdGhpcy5zZXRSb3RhdGlvbihyb3RhdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNsYXRlcyB0aGUgZ3JhcGggbm9kZSBpbiB3b3JsZC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIHRyYW5zbGF0aW9uIHZlY3Rvci4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGVcbiAgICAgKiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlKDEwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHQgPSBuZXcgcGMuVmVjMygxMCwgMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlKHQpO1xuICAgICAqL1xuICAgIHRyYW5zbGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvc2l0aW9uLmFkZCh0aGlzLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2xhdGVzIHRoZSBncmFwaCBub2RlIGluIGxvY2FsLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgdHJhbnNsYXRpb24gdmVjdG9yLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGVMb2NhbCgxMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIHZlY3RvclxuICAgICAqIHZhciB0ID0gbmV3IHBjLlZlYzMoMTAsIDAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZUxvY2FsKHQpO1xuICAgICAqL1xuICAgIHRyYW5zbGF0ZUxvY2FsKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnRyYW5zZm9ybVZlY3Rvcihwb3NpdGlvbiwgcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uYWRkKHBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSb3RhdGVzIHRoZSBncmFwaCBub2RlIGluIHdvcmxkLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgRXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlIHNwZWNpZmllZCBpblxuICAgICAqIGRlZ3JlZXMgaW4gWFlaIG9yZGVyLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEXG4gICAgICogdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yXG4gICAgICogcm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlKHIpO1xuICAgICAqL1xuICAgIHJvdGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihyb3RhdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IHRoaXMuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgcm90YXRpb24ubXVsMihpbnZQYXJlbnRSb3QsIHJvdGF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKHJvdGF0aW9uLCByb3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyB0aGUgZ3JhcGggbm9kZSBpbiBsb2NhbC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIEV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZSBzcGVjaWZpZWQgaW5cbiAgICAgKiBkZWdyZWVzIGluIFhZWiBvcmRlci4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRFxuICAgICAqIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSByb3RhdGlvbiBvclxuICAgICAqIHJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZUxvY2FsKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlTG9jYWwocik7XG4gICAgICovXG4gICAgcm90YXRlTG9jYWwoeCwgeSwgeikge1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bChyb3RhdGlvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHcmFwaE5vZGUgfTtcbiJdLCJuYW1lcyI6WyJzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm0iLCJNYXQ0Iiwic2NhbGVDb21wZW5zYXRlUG9zIiwiVmVjMyIsInNjYWxlQ29tcGVuc2F0ZVJvdCIsIlF1YXQiLCJzY2FsZUNvbXBlbnNhdGVSb3QyIiwic2NhbGVDb21wZW5zYXRlU2NhbGUiLCJzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCIsInRtcE1hdDQiLCJ0bXBRdWF0IiwicG9zaXRpb24iLCJpbnZQYXJlbnRXdG0iLCJyb3RhdGlvbiIsImludlBhcmVudFJvdCIsIm1hdHJpeCIsInRhcmdldCIsInVwIiwiR3JhcGhOb2RlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwidGFncyIsIlRhZ3MiLCJfbGFiZWxzIiwibG9jYWxQb3NpdGlvbiIsImxvY2FsUm90YXRpb24iLCJsb2NhbFNjYWxlIiwibG9jYWxFdWxlckFuZ2xlcyIsImV1bGVyQW5nbGVzIiwiX3NjYWxlIiwibG9jYWxUcmFuc2Zvcm0iLCJfZGlydHlMb2NhbCIsIl93YXNEaXJ0eSIsIl9hYWJiVmVyIiwiX2Zyb3plbiIsIndvcmxkVHJhbnNmb3JtIiwiX2RpcnR5V29ybGQiLCJfd29ybGRTY2FsZVNpZ24iLCJfbm9ybWFsTWF0cml4IiwiTWF0MyIsIl9kaXJ0eU5vcm1hbCIsIl9yaWdodCIsIl91cCIsIl9mb3J3YXJkIiwiX3BhcmVudCIsIl9jaGlsZHJlbiIsIl9ncmFwaERlcHRoIiwiX2VuYWJsZWQiLCJfZW5hYmxlZEluSGllcmFyY2h5Iiwic2NhbGVDb21wZW5zYXRpb24iLCJyaWdodCIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0WCIsIm5vcm1hbGl6ZSIsImdldFkiLCJmb3J3YXJkIiwiZ2V0WiIsIm11bFNjYWxhciIsIm5vcm1hbE1hdHJpeCIsIm5vcm1hbE1hdCIsImludmVydFRvM3gzIiwidHJhbnNwb3NlIiwiZW5hYmxlZCIsIl90aGlzJF9wYXJlbnQiLCJfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwicGFyZW50IiwicGF0aCIsIm5vZGUiLCJyZXN1bHQiLCJyb290IiwiY2hpbGRyZW4iLCJncmFwaERlcHRoIiwiX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwiYyIsImkiLCJsZW4iLCJsZW5ndGgiLCJfdW5mcmVlemVQYXJlbnRUb1Jvb3QiLCJfY2xvbmVJbnRlcm5hbCIsImNsb25lIiwiX2xpc3QiLCJjbGVhciIsImFkZCIsIk9iamVjdCIsImFzc2lnbiIsImNvcHkiLCJzb3VyY2UiLCJmaW5kIiwiYXR0ciIsInZhbHVlIiwicmVzdWx0cyIsIkZ1bmN0aW9uIiwiZm4iLCJwdXNoIiwiZGVzY2VuZGFudHMiLCJjb25jYXQiLCJ0ZXN0VmFsdWUiLCJmaW5kT25lIiwiZmluZEJ5VGFnIiwicXVlcnkiLCJhcmd1bWVudHMiLCJxdWVyeU5vZGUiLCJjaGVja05vZGUiLCJoYXMiLCJmaW5kQnlOYW1lIiwiZm91bmQiLCJmaW5kQnlQYXRoIiwicGFydHMiLCJBcnJheSIsImlzQXJyYXkiLCJzcGxpdCIsImltYXgiLCJmb3JFYWNoIiwiY2FsbGJhY2siLCJ0aGlzQXJnIiwiY2FsbCIsImlzRGVzY2VuZGFudE9mIiwiaXNBbmNlc3Rvck9mIiwiZ2V0RXVsZXJBbmdsZXMiLCJnZXRMb2NhbEV1bGVyQW5nbGVzIiwiZ2V0TG9jYWxQb3NpdGlvbiIsImdldExvY2FsUm90YXRpb24iLCJnZXRMb2NhbFNjYWxlIiwiZ2V0TG9jYWxUcmFuc2Zvcm0iLCJzZXRUUlMiLCJnZXRQb3NpdGlvbiIsImdldFRyYW5zbGF0aW9uIiwiZ2V0Um90YXRpb24iLCJzZXRGcm9tTWF0NCIsImdldFNjYWxlIiwiX3N5bmMiLCJ3b3JsZFNjYWxlU2lnbiIsInNjYWxlU2lnbiIsInJlcGFyZW50IiwiaW5kZXgiLCJjdXJyZW50IiwicmVtb3ZlQ2hpbGQiLCJpbnNlcnRDaGlsZCIsImFkZENoaWxkIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsIngiLCJ5IiwieiIsInNldEZyb21FdWxlckFuZ2xlcyIsIl9kaXJ0aWZ5TG9jYWwiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0Iiwic2V0TG9jYWxSb3RhdGlvbiIsInciLCJzZXRMb2NhbFNjYWxlIiwiX2RpcnRpZnlXb3JsZCIsInAiLCJfZGlydGlmeVdvcmxkSW50ZXJuYWwiLCJzZXRQb3NpdGlvbiIsImludmVydCIsInRyYW5zZm9ybVBvaW50Iiwic2V0Um90YXRpb24iLCJwYXJlbnRSb3QiLCJtdWwiLCJzZXRFdWxlckFuZ2xlcyIsIm11bDIiLCJfcHJlcGFyZUluc2VydENoaWxkIiwiX29uSW5zZXJ0Q2hpbGQiLCJhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0iLCJ3UG9zIiwid1JvdCIsInNwbGljZSIsIkRlYnVnIiwiYXNzZXJ0IiwiX2ZpcmVPbkhpZXJhcmNoeSIsIm5hbWVIaWVyYXJjaHkiLCJmaXJlIiwiZW5hYmxlZEluSGllcmFyY2h5IiwiX3VwZGF0ZUdyYXBoRGVwdGgiLCJjaGlsZCIsImluZGV4T2YiLCJwYXJlbnRXb3JsZFNjYWxlIiwic2NhbGUiLCJwYXJlbnRUb1VzZVNjYWxlRnJvbSIsInRtYXRyaXgiLCJtdWxBZmZpbmUyIiwic3luY0hpZXJhcmNoeSIsImxvb2tBdCIsInV4IiwidXkiLCJ1eiIsIlVQIiwidW5kZWZpbmVkIiwic2V0TG9va0F0IiwidHJhbnNsYXRlIiwidHJhbnNsYXRlTG9jYWwiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyb3RhdGUiLCJyb3QiLCJyb3RhdGVMb2NhbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQVNBLE1BQU1BLDJCQUEyQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzlDLE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3JDLE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3JDLE1BQU1DLG1CQUFtQixHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBQ3RDLE1BQU1FLG9CQUFvQixHQUFHLElBQUlKLElBQUksRUFBRSxDQUFBO0FBQ3ZDLE1BQU1LLDZCQUE2QixHQUFHLElBQUlMLElBQUksRUFBRSxDQUFBO0FBQ2hELE1BQU1NLE9BQU8sR0FBRyxJQUFJUixJQUFJLEVBQUUsQ0FBQTtBQUMxQixNQUFNUyxPQUFPLEdBQUcsSUFBSUwsSUFBSSxFQUFFLENBQUE7QUFDMUIsTUFBTU0sUUFBUSxHQUFHLElBQUlSLElBQUksRUFBRSxDQUFBO0FBQzNCLE1BQU1TLFlBQVksR0FBRyxJQUFJWCxJQUFJLEVBQUUsQ0FBQTtBQUMvQixNQUFNWSxRQUFRLEdBQUcsSUFBSVIsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTVMsWUFBWSxHQUFHLElBQUlULElBQUksRUFBRSxDQUFBO0FBQy9CLE1BQU1VLE1BQU0sR0FBRyxJQUFJZCxJQUFJLEVBQUUsQ0FBQTtBQUN6QixNQUFNZSxNQUFNLEdBQUcsSUFBSWIsSUFBSSxFQUFFLENBQUE7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
