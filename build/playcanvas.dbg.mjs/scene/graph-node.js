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
   * The non-unique name of a graph node. Defaults to 'Untitled'.
   *
   * @type {string}
   */

  /**
   * Interface for tagging graph nodes. Tag based searches can be performed using the
   * {@link GraphNode#findByTag} function.
   *
   * @type {Tags}
   */

  /** @private */

  // Local-space properties of transform (only first 3 are settable by the user)
  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Quat}
   * @private
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Vec3}
   * @private
   */
  // Only calculated on request

  // World-space properties of transform
  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Quat}
   * @private
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Vec3|null}
   * @private
   */

  /**
   * @type {Mat4}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * Marks the node to ignore hierarchy sync entirely (including children nodes). The engine code
   * automatically freezes and unfreezes objects whenever required. Segregating dynamic and
   * stationary nodes into subhierarchies allows to reduce sync time significantly.
   *
   * @type {boolean}
   * @private
   */

  /**
   * @type {Mat4}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * Cached value representing the negatively scaled world transform. If the value is 0, this
   * marks this value as dirty and it needs to be recalculated. If the value is 1, the world
   * transform is not negatively scaled. If the value is -1, the world transform is negatively
   * scaled.
   *
   * @type {number}
   * @private
   */

  /**
   * @type {Mat3}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {Vec3|null}
   * @private
   */

  /**
   * @type {Vec3|null}
   * @private
   */

  /**
   * @type {Vec3|null}
   * @private
   */

  /**
   * @type {GraphNode|null}
   * @private
   */

  /**
   * @type {GraphNode[]}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * Represents enabled state of the entity. If the entity is disabled, the entity including all
   * children are excluded from updates.
   *
   * @type {boolean}
   * @private
   */

  /**
   * Represents enabled state of the entity in the hierarchy. It's true only if this entity and
   * all parent entities all the way to the scene's root are enabled.
   *
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @ignore
   */

  /**
   * Create a new GraphNode instance.
   *
   * @param {string} [name] - The non-unique name of a graph node. Defaults to 'Untitled'.
   */
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
   * const doors = house.find(function (node) {
   *     return node.model && node.name.toLowerCase().indexOf('door') !== -1;
   * });
   * @example
   * // Finds all nodes that have the name property set to 'Test'
   * const entities = parent.find('name', 'Test');
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
   * const head = player.findOne(function (node) {
   *     return node.model && node.name === 'head';
   * });
   * @example
   * // Finds the first node that has the name property set to 'Test'
   * const node = parent.findOne('name', 'Test');
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
   * const animals = node.findByTag("animal");
   * @example
   * // Return all graph nodes that tagged by `bird` OR `mammal`
   * const birdsAndMammals = node.findByTag("bird", "mammal");
   * @example
   * // Return all assets that tagged by `carnivore` AND `mammal`
   * const meatEatingMammals = node.findByTag(["carnivore", "mammal"]);
   * @example
   * // Return all assets that tagged by (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
   * const meatEatingMammalsAndReptiles = node.findByTag(["carnivore", "mammal"], ["carnivore", "reptile"]);
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
   * const grandchild = this.entity.findByPath('child/grandchild');
   * @example
   * // Array form
   * const grandchild = this.entity.findByPath(['child', 'grandchild']);
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
   * const angles = this.entity.getEulerAngles();
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
   * const angles = this.entity.getLocalEulerAngles();
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
   * const position = this.entity.getLocalPosition();
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
   * const rotation = this.entity.getLocalRotation();
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
   * const scale = this.entity.getLocalScale();
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
   * const transform = this.entity.getLocalTransform();
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
   * const position = this.entity.getPosition();
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
   * const rotation = this.entity.getRotation();
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
   * const scale = this.entity.getScale();
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
   * const transform = this.entity.getWorldTransform();
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
   * const angles = new pc.Vec3(0, 90, 0);
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
   * const pos = new pc.Vec3(0, 10, 0);
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
   * const q = pc.Quat();
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
   * const scale = new pc.Vec3(10, 10, 10);
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
   * const position = new pc.Vec3(0, 10, 0);
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
   * const q = pc.Quat();
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
   * const angles = new pc.Vec3(0, 90, 0);
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
   * const e = new pc.Entity(app);
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
   * const e = new pc.Entity(app);
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
   * const e = new pc.Entity(app);
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
   * const child = this.entity.children[0];
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
   * const position = otherEntity.getPosition();
   * this.entity.lookAt(position);
   * @example
   * // Look at another entity, using the negative world y-axis for up
   * const position = otherEntity.getPosition();
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
   * const t = new pc.Vec3(10, 0, 0);
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
   * const t = new pc.Vec3(10, 0, 0);
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
   * const r = new pc.Vec3(0, 90, 0);
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
   * const r = new pc.Vec3(0, 90, 0);
   * this.entity.rotateLocal(r);
   */
  rotateLocal(x, y, z) {
    rotation.setFromEulerAngles(x, y, z);
    this.localRotation.mul(rotation);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }
}

export { GraphNode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuY29uc3Qgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvcyA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBNYXQ0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRtcFF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbmNvbnN0IGludlBhcmVudFJvdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuY29uc3QgdGFyZ2V0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHVwID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZmluZH0gYW5kIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0gdG8gc2VhcmNoIHRocm91Z2ggYSBncmFwaFxuICogbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmluZE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybmluZyBgdHJ1ZWAgd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAqIHtAbGluayBHcmFwaE5vZGUjZmluZH0gb3Ige0BsaW5rIEdyYXBoTm9kZSNmaW5kT25lfS5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEdyYXBoTm9kZSNmb3JFYWNofSB0byBpdGVyYXRlIHRocm91Z2ggYSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzXG4gKiBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRm9yRWFjaE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICovXG5cbi8qKlxuICogQSBoaWVyYXJjaGljYWwgc2NlbmUgbm9kZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoTm9kZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIG5vbi11bmlxdWUgbmFtZSBvZiBhIGdyYXBoIG5vZGUuIERlZmF1bHRzIHRvICdVbnRpdGxlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcmZhY2UgZm9yIHRhZ2dpbmcgZ3JhcGggbm9kZXMuIFRhZyBiYXNlZCBzZWFyY2hlcyBjYW4gYmUgcGVyZm9ybWVkIHVzaW5nIHRoZVxuICAgICAqIHtAbGluayBHcmFwaE5vZGUjZmluZEJ5VGFnfSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtUYWdzfVxuICAgICAqL1xuICAgIHRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sYWJlbHMgPSB7fTtcblxuICAgIC8vIExvY2FsLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtIChvbmx5IGZpcnN0IDMgYXJlIHNldHRhYmxlIGJ5IHRoZSB1c2VyKVxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsb2NhbFNjYWxlID0gbmV3IFZlYzMoMSwgMSwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvY2FsRXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpOyAvLyBPbmx5IGNhbGN1bGF0ZWQgb24gcmVxdWVzdFxuXG4gICAgLy8gV29ybGQtc3BhY2UgcHJvcGVydGllcyBvZiB0cmFuc2Zvcm1cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBldWxlckFuZ2xlcyA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NjYWxlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlydHlMb2NhbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hYWJiVmVyID0gMDtcblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBub2RlIHRvIGlnbm9yZSBoaWVyYXJjaHkgc3luYyBlbnRpcmVseSAoaW5jbHVkaW5nIGNoaWxkcmVuIG5vZGVzKS4gVGhlIGVuZ2luZSBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBmcmVlemVzIGFuZCB1bmZyZWV6ZXMgb2JqZWN0cyB3aGVuZXZlciByZXF1aXJlZC4gU2VncmVnYXRpbmcgZHluYW1pYyBhbmRcbiAgICAgKiBzdGF0aW9uYXJ5IG5vZGVzIGludG8gc3ViaGllcmFyY2hpZXMgYWxsb3dzIHRvIHJlZHVjZSBzeW5jIHRpbWUgc2lnbmlmaWNhbnRseS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Zyb3plbiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB3b3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eVdvcmxkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDYWNoZWQgdmFsdWUgcmVwcmVzZW50aW5nIHRoZSBuZWdhdGl2ZWx5IHNjYWxlZCB3b3JsZCB0cmFuc2Zvcm0uIElmIHRoZSB2YWx1ZSBpcyAwLCB0aGlzXG4gICAgICogbWFya3MgdGhpcyB2YWx1ZSBhcyBkaXJ0eSBhbmQgaXQgbmVlZHMgdG8gYmUgcmVjYWxjdWxhdGVkLiBJZiB0aGUgdmFsdWUgaXMgMSwgdGhlIHdvcmxkXG4gICAgICogdHJhbnNmb3JtIGlzIG5vdCBuZWdhdGl2ZWx5IHNjYWxlZC4gSWYgdGhlIHZhbHVlIGlzIC0xLCB0aGUgd29ybGQgdHJhbnNmb3JtIGlzIG5lZ2F0aXZlbHlcbiAgICAgKiBzY2FsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dvcmxkU2NhbGVTaWduID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vcm1hbE1hdHJpeCA9IG5ldyBNYXQzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eU5vcm1hbCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JpZ2h0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXAgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9mb3J3YXJkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJlbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NoaWxkcmVuID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dyYXBoRGVwdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogUmVwcmVzZW50cyBlbmFibGVkIHN0YXRlIG9mIHRoZSBlbnRpdHkuIElmIHRoZSBlbnRpdHkgaXMgZGlzYWJsZWQsIHRoZSBlbnRpdHkgaW5jbHVkaW5nIGFsbFxuICAgICAqIGNoaWxkcmVuIGFyZSBleGNsdWRlZCBmcm9tIHVwZGF0ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFJlcHJlc2VudHMgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IGluIHRoZSBoaWVyYXJjaHkuIEl0J3MgdHJ1ZSBvbmx5IGlmIHRoaXMgZW50aXR5IGFuZFxuICAgICAqIGFsbCBwYXJlbnQgZW50aXRpZXMgYWxsIHRoZSB3YXkgdG8gdGhlIHNjZW5lJ3Mgcm9vdCBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNjYWxlQ29tcGVuc2F0aW9uID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR3JhcGhOb2RlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBub24tdW5pcXVlIG5hbWUgb2YgYSBncmFwaCBub2RlLiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUgPSAnVW50aXRsZWQnKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBYLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHJpZ2h0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9yaWdodCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRYKHRoaXMuX3JpZ2h0KS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBZLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHVwKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3VwKSB7XG4gICAgICAgICAgICB0aGlzLl91cCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRZKHRoaXMuX3VwKS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBuZWdhdGl2ZSBaLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IGZvcndhcmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZm9yd2FyZCkge1xuICAgICAgICAgICAgdGhpcy5fZm9yd2FyZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRaKHRoaXMuX2ZvcndhcmQpLm5vcm1hbGl6ZSgpLm11bFNjYWxhcigtMSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBtYXRyaXggdXNlZCB0byB0cmFuc2Zvcm0gdGhlIG5vcm1hbC5cbiAgICAgKlxuICAgICAqIEB0eXBlICB7TWF0M31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IG5vcm1hbE1hdHJpeCgpIHtcblxuICAgICAgICBjb25zdCBub3JtYWxNYXQgPSB0aGlzLl9ub3JtYWxNYXRyaXg7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eU5vcm1hbCkge1xuICAgICAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmludmVydFRvM3gzKG5vcm1hbE1hdCk7XG4gICAgICAgICAgICBub3JtYWxNYXQudHJhbnNwb3NlKCk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vcm1hbE1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgb3IgZGlzYWJsZSBhIEdyYXBoTm9kZS4gSWYgb25lIG9mIHRoZSBHcmFwaE5vZGUncyBwYXJlbnRzIGlzIGRpc2FibGVkIHRoZXJlIHdpbGwgYmVcbiAgICAgKiBubyBvdGhlciBzaWRlIGVmZmVjdHMuIElmIGFsbCB0aGUgcGFyZW50cyBhcmUgZW5hYmxlZCB0aGVuIHRoZSBuZXcgdmFsdWUgd2lsbCBhY3RpdmF0ZSBvclxuICAgICAqIGRlYWN0aXZhdGUgYWxsIHRoZSBlbmFibGVkIGNoaWxkcmVuIG9mIHRoZSBHcmFwaE5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZW5hYmxlZChlbmFibGVkKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICE9PSBlbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gZW5hYmxlZDtcblxuICAgICAgICAgICAgLy8gaWYgZW5hYmxpbmcgZW50aXR5LCBtYWtlIGFsbCBjaGlsZHJlbiBlbmFibGVkIGluIGhpZXJhcmNoeSBvbmx5IHdoZW4gdGhlIHBhcmVudCBpcyBhcyB3ZWxsXG4gICAgICAgICAgICAvLyBpZiBkaXNhYmxpbmcgZW50aXR5LCBtYWtlIGFsbCBjaGlsZHJlbiBkaXNhYmxlZCBpbiBoaWVyYXJjaHkgaW4gYWxsIGNhc2VzXG4gICAgICAgICAgICBpZiAoZW5hYmxlZCAmJiB0aGlzLl9wYXJlbnQ/LmVuYWJsZWQgfHwgIWVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQodGhpcywgZW5hYmxlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgLy8gbWFrZSBzdXJlIHRvIGNoZWNrIHRoaXMuX2VuYWJsZWQgdG9vIGJlY2F1c2UgaWYgdGhhdFxuICAgICAgICAvLyB3YXMgZmFsc2Ugd2hlbiBhIHBhcmVudCB3YXMgdXBkYXRlZCB0aGUgX2VuYWJsZWRJbkhpZXJhcmNoeVxuICAgICAgICAvLyBmbGFnIG1heSBub3QgaGF2ZSBiZWVuIHVwZGF0ZWQgZm9yIG9wdGltaXphdGlvbiBwdXJwb3Nlc1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZCAmJiB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IGEgcGFyZW50IGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHBhcmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgdGhlIHBhdGggb2YgdGhlIGdyYXBoIG5vZGUgcmVsYXRpdmUgdG8gdGhlIHJvb3Qgb2YgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICAgIGxldCBub2RlID0gdGhpcy5fcGFyZW50O1xuICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzLm5hbWU7XG4gICAgICAgIHdoaWxlIChub2RlICYmIG5vZGUuX3BhcmVudCkge1xuICAgICAgICAgICAgcmVzdWx0ID0gYCR7bm9kZS5uYW1lfS8ke3Jlc3VsdH1gO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCBoaWdoZXN0IGdyYXBoIG5vZGUgZnJvbSBjdXJyZW50IG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfVxuICAgICAqL1xuICAgIGdldCByb290KCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgd2hpbGUgKHJlc3VsdC5fcGFyZW50KSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgY2hpbGRyZW4gb2YgdGhpcyBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAqL1xuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NoaWxkcmVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgZGVwdGggb2YgdGhpcyBjaGlsZCB3aXRoaW4gdGhlIGdyYXBoLiBOb3RlIHRoYXQgZm9yXG4gICAgICogcGVyZm9ybWFuY2UgcmVhc29ucyB0aGlzIGlzIG9ubHkgcmVjYWxjdWxhdGVkIHdoZW4gYSBub2RlIGlzIGFkZGVkIHRvIGEgbmV3IHBhcmVudCwgaS5lLiBJdFxuICAgICAqIGlzIG5vdCByZWNhbGN1bGF0ZWQgd2hlbiBhIG5vZGUgaXMgc2ltcGx5IHJlbW92ZWQgZnJvbSB0aGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBncmFwaERlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ3JhcGhEZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIEdyYXBoIG5vZGUgdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5LCBmYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQobm9kZSwgZW5hYmxlZCkge1xuICAgICAgICBub2RlLl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKTtcblxuICAgICAgICBjb25zdCBjID0gbm9kZS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY1tpXS5fZW5hYmxlZClcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQoY1tpXSwgZW5hYmxlZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgZW5hYmxlZCBmbGFnIG9mIHRoZSBlbnRpdHkgb3Igb25lIG9mIGl0cyBwYXJlbnRzIGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIGlmIGVuYWJsZWQgaW4gdGhlIGhpZXJhcmNoeSwgZmFsc2UgaWYgZGlzYWJsZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQoZW5hYmxlZCkge1xuICAgICAgICAvLyBPdmVycmlkZSBpbiBkZXJpdmVkIGNsYXNzZXNcbiAgICAgICAgdGhpcy5fZW5hYmxlZEluSGllcmFyY2h5ID0gZW5hYmxlZDtcbiAgICAgICAgaWYgKGVuYWJsZWQgJiYgIXRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIHRoaXMuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHt0aGlzfSBjbG9uZSAtIFRoZSBjbG9uZWQgZ3JhcGggbm9kZSB0byBjb3B5IGludG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xvbmVJbnRlcm5hbChjbG9uZSkge1xuICAgICAgICBjbG9uZS5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgIGNvbnN0IHRhZ3MgPSB0aGlzLnRhZ3MuX2xpc3Q7XG4gICAgICAgIGNsb25lLnRhZ3MuY2xlYXIoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YWdzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgY2xvbmUudGFncy5hZGQodGFnc1tpXSk7XG5cbiAgICAgICAgY2xvbmUuX2xhYmVscyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX2xhYmVscyk7XG5cbiAgICAgICAgY2xvbmUubG9jYWxQb3NpdGlvbi5jb3B5KHRoaXMubG9jYWxQb3NpdGlvbik7XG4gICAgICAgIGNsb25lLmxvY2FsUm90YXRpb24uY29weSh0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICBjbG9uZS5sb2NhbFNjYWxlLmNvcHkodGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgY2xvbmUubG9jYWxFdWxlckFuZ2xlcy5jb3B5KHRoaXMubG9jYWxFdWxlckFuZ2xlcyk7XG5cbiAgICAgICAgY2xvbmUucG9zaXRpb24uY29weSh0aGlzLnBvc2l0aW9uKTtcbiAgICAgICAgY2xvbmUucm90YXRpb24uY29weSh0aGlzLnJvdGF0aW9uKTtcbiAgICAgICAgY2xvbmUuZXVsZXJBbmdsZXMuY29weSh0aGlzLmV1bGVyQW5nbGVzKTtcblxuICAgICAgICBjbG9uZS5sb2NhbFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICBjbG9uZS5fZGlydHlMb2NhbCA9IHRoaXMuX2RpcnR5TG9jYWw7XG5cbiAgICAgICAgY2xvbmUud29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLndvcmxkVHJhbnNmb3JtKTtcbiAgICAgICAgY2xvbmUuX2RpcnR5V29ybGQgPSB0aGlzLl9kaXJ0eVdvcmxkO1xuICAgICAgICBjbG9uZS5fZGlydHlOb3JtYWwgPSB0aGlzLl9kaXJ0eU5vcm1hbDtcbiAgICAgICAgY2xvbmUuX2FhYmJWZXIgPSB0aGlzLl9hYWJiVmVyICsgMTtcblxuICAgICAgICBjbG9uZS5fZW5hYmxlZCA9IHRoaXMuX2VuYWJsZWQ7XG5cbiAgICAgICAgY2xvbmUuc2NhbGVDb21wZW5zYXRpb24gPSB0aGlzLnNjYWxlQ29tcGVuc2F0aW9uO1xuXG4gICAgICAgIC8vIGZhbHNlIGFzIHRoaXMgbm9kZSBpcyBub3QgaW4gdGhlIGhpZXJhcmNoeSB5ZXRcbiAgICAgICAgY2xvbmUuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGEgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIGNsb25lIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICAgICAgICB0aGlzLl9jbG9uZUludGVybmFsKGNsb25lKTtcbiAgICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcHkgYSBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHNvdXJjZSAtIFRoZSBncmFwaCBub2RlIHRvIGNvcHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZX0gVGhlIGRlc3RpbmF0aW9uIGdyYXBoIG5vZGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNvcHkoc291cmNlKSB7XG4gICAgICAgIHNvdXJjZS5fY2xvbmVJbnRlcm5hbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciB0aGUgbm9kZXMgdGhhdCBzYXRpc2Z5IHNvbWUgc2VhcmNoXG4gICAgICogY3JpdGVyaWEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbmROb2RlQ2FsbGJhY2t8c3RyaW5nfSBhdHRyIC0gVGhpcyBjYW4gZWl0aGVyIGJlIGEgZnVuY3Rpb24gb3IgYSBzdHJpbmcuIElmIGl0J3MgYVxuICAgICAqIGZ1bmN0aW9uLCBpdCBpcyBleGVjdXRlZCBmb3IgZWFjaCBkZXNjZW5kYW50IG5vZGUgdG8gdGVzdCBpZiBub2RlIHNhdGlzZmllcyB0aGUgc2VhcmNoXG4gICAgICogbG9naWMuIFJldHVybmluZyB0cnVlIGZyb20gdGhlIGZ1bmN0aW9uIHdpbGwgaW5jbHVkZSB0aGUgbm9kZSBpbnRvIHRoZSByZXN1bHRzLiBJZiBpdCdzIGFcbiAgICAgKiBzdHJpbmcgdGhlbiBpdCByZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgZmllbGQgb3IgYSBtZXRob2Qgb2YgdGhlIG5vZGUuIElmIHRoaXMgaXMgdGhlIG5hbWVcbiAgICAgKiBvZiBhIGZpZWxkIHRoZW4gdGhlIHZhbHVlIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHdpbGwgYmUgY2hlY2tlZCBmb3IgZXF1YWxpdHkuIElmXG4gICAgICogdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIHRoZW4gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZSBjaGVja2VkIGZvclxuICAgICAqIGVxdWFsaXR5IGFnYWluc3QgdGhlIHZhbHVlZCBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB0byB0aGlzIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdmFsdWVdIC0gSWYgdGhlIGZpcnN0IGFyZ3VtZW50IChhdHRyKSBpcyBhIHByb3BlcnR5IG5hbWUgdGhlbiB0aGlzIHZhbHVlXG4gICAgICogd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlW119IFRoZSBhcnJheSBvZiBncmFwaCBub2RlcyB0aGF0IG1hdGNoIHRoZSBzZWFyY2ggY3JpdGVyaWEuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kcyBhbGwgbm9kZXMgdGhhdCBoYXZlIGEgbW9kZWwgY29tcG9uZW50IGFuZCBoYXZlICdkb29yJyBpbiB0aGVpciBsb3dlci1jYXNlZCBuYW1lXG4gICAgICogY29uc3QgZG9vcnMgPSBob3VzZS5maW5kKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Rvb3InKSAhPT0gLTE7XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kcyBhbGwgbm9kZXMgdGhhdCBoYXZlIHRoZSBuYW1lIHByb3BlcnR5IHNldCB0byAnVGVzdCdcbiAgICAgKiBjb25zdCBlbnRpdGllcyA9IHBhcmVudC5maW5kKCduYW1lJywgJ1Rlc3QnKTtcbiAgICAgKi9cbiAgICBmaW5kKGF0dHIsIHZhbHVlKSB7XG4gICAgICAgIGxldCByZXN1bHQsIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGZuID0gYXR0cjtcblxuICAgICAgICAgICAgcmVzdWx0ID0gZm4odGhpcyk7XG4gICAgICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh0aGlzKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc2NlbmRhbnRzID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZChmbik7XG4gICAgICAgICAgICAgICAgaWYgKGRlc2NlbmRhbnRzLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuY29uY2F0KGRlc2NlbmRhbnRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB0ZXN0VmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRlc3RWYWx1ZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc2NlbmRhbnRzID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZChhdHRyLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGRlc2NlbmRhbnRzLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyA9IHJlc3VsdHMuY29uY2F0KGRlc2NlbmRhbnRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZ3JhcGggbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyBmb3IgdGhlIGZpcnN0IG5vZGUgdGhhdCBzYXRpc2ZpZXMgc29tZVxuICAgICAqIHNlYXJjaCBjcml0ZXJpYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmluZE5vZGVDYWxsYmFja3xzdHJpbmd9IGF0dHIgLSBUaGlzIGNhbiBlaXRoZXIgYmUgYSBmdW5jdGlvbiBvciBhIHN0cmluZy4gSWYgaXQncyBhXG4gICAgICogZnVuY3Rpb24sIGl0IGlzIGV4ZWN1dGVkIGZvciBlYWNoIGRlc2NlbmRhbnQgbm9kZSB0byB0ZXN0IGlmIG5vZGUgc2F0aXNmaWVzIHRoZSBzZWFyY2hcbiAgICAgKiBsb2dpYy4gUmV0dXJuaW5nIHRydWUgZnJvbSB0aGUgZnVuY3Rpb24gd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAgICAgKiBmaW5kT25lLiBJZiBpdCdzIGEgc3RyaW5nIHRoZW4gaXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiBhIGZpZWxkIG9yIGEgbWV0aG9kIG9mIHRoZSBub2RlLiBJZlxuICAgICAqIHRoaXMgaXMgdGhlIG5hbWUgb2YgYSBmaWVsZCB0aGVuIHRoZSB2YWx1ZSBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB3aWxsIGJlIGNoZWNrZWQgZm9yXG4gICAgICogZXF1YWxpdHkuIElmIHRoaXMgaXMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiB0aGVuIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHdpbGwgYmVcbiAgICAgKiBjaGVja2VkIGZvciBlcXVhbGl0eSBhZ2FpbnN0IHRoZSB2YWx1ZWQgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgdG8gdGhpcyBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3ZhbHVlXSAtIElmIHRoZSBmaXJzdCBhcmd1bWVudCAoYXR0cikgaXMgYSBwcm9wZXJ0eSBuYW1lIHRoZW4gdGhpcyB2YWx1ZVxuICAgICAqIHdpbGwgYmUgY2hlY2tlZCBhZ2FpbnN0IHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBBIGdyYXBoIG5vZGUgdGhhdCBtYXRjaCB0aGUgc2VhcmNoIGNyaXRlcmlhLiBSZXR1cm5zIG51bGwgaWYgbm9cbiAgICAgKiBub2RlIGlzIGZvdW5kLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZCB0aGUgZmlyc3Qgbm9kZSB0aGF0IGlzIGNhbGxlZCAnaGVhZCcgYW5kIGhhcyBhIG1vZGVsIGNvbXBvbmVudFxuICAgICAqIGNvbnN0IGhlYWQgPSBwbGF5ZXIuZmluZE9uZShmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICByZXR1cm4gbm9kZS5tb2RlbCAmJiBub2RlLm5hbWUgPT09ICdoZWFkJztcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIHRoZSBmaXJzdCBub2RlIHRoYXQgaGFzIHRoZSBuYW1lIHByb3BlcnR5IHNldCB0byAnVGVzdCdcbiAgICAgKiBjb25zdCBub2RlID0gcGFyZW50LmZpbmRPbmUoJ25hbWUnLCAnVGVzdCcpO1xuICAgICAqL1xuICAgIGZpbmRPbmUoYXR0ciwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBmbiA9IGF0dHI7XG5cbiAgICAgICAgICAgIHJlc3VsdCA9IGZuKHRoaXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRPbmUoZm4pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgdGVzdFZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1thdHRyXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGVzdFZhbHVlID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kT25lKGF0dHIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHNhdGlzZnkgdGhlIHNlYXJjaCBxdWVyeS4gUXVlcnkgY2FuIGJlIHNpbXBseSBhIHN0cmluZywgb3IgY29tbWFcbiAgICAgKiBzZXBhcmF0ZWQgc3RyaW5ncywgdG8gaGF2ZSBpbmNsdXNpdmUgcmVzdWx0cyBvZiBhc3NldHMgdGhhdCBtYXRjaCBhdCBsZWFzdCBvbmUgcXVlcnkuIEFcbiAgICAgKiBxdWVyeSB0aGF0IGNvbnNpc3RzIG9mIGFuIGFycmF5IG9mIHRhZ3MgY2FuIGJlIHVzZWQgdG8gbWF0Y2ggZ3JhcGggbm9kZXMgdGhhdCBoYXZlIGVhY2ggdGFnXG4gICAgICogb2YgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLip9IHF1ZXJ5IC0gTmFtZSBvZiBhIHRhZyBvciBhcnJheSBvZiB0YWdzLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGVbXX0gQSBsaXN0IG9mIGFsbCBncmFwaCBub2RlcyB0aGF0IG1hdGNoIHRoZSBxdWVyeS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCB0YWdnZWQgYnkgYGFuaW1hbGBcbiAgICAgKiBjb25zdCBhbmltYWxzID0gbm9kZS5maW5kQnlUYWcoXCJhbmltYWxcIik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIGdyYXBoIG5vZGVzIHRoYXQgdGFnZ2VkIGJ5IGBiaXJkYCBPUiBgbWFtbWFsYFxuICAgICAqIGNvbnN0IGJpcmRzQW5kTWFtbWFscyA9IG5vZGUuZmluZEJ5VGFnKFwiYmlyZFwiLCBcIm1hbW1hbFwiKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBjYXJuaXZvcmVgIEFORCBgbWFtbWFsYFxuICAgICAqIGNvbnN0IG1lYXRFYXRpbmdNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoW1wiY2Fybml2b3JlXCIsIFwibWFtbWFsXCJdKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IChgY2Fybml2b3JlYCBBTkQgYG1hbW1hbGApIE9SIChgY2Fybml2b3JlYCBBTkQgYHJlcHRpbGVgKVxuICAgICAqIGNvbnN0IG1lYXRFYXRpbmdNYW1tYWxzQW5kUmVwdGlsZXMgPSBub2RlLmZpbmRCeVRhZyhbXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIl0sIFtcImNhcm5pdm9yZVwiLCBcInJlcHRpbGVcIl0pO1xuICAgICAqL1xuICAgIGZpbmRCeVRhZygpIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSBhcmd1bWVudHM7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICBjb25zdCBxdWVyeU5vZGUgPSAobm9kZSwgY2hlY2tOb2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hlY2tOb2RlICYmIG5vZGUudGFncy5oYXMoLi4ucXVlcnkpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcXVlcnlOb2RlKG5vZGUuX2NoaWxkcmVuW2ldLCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBxdWVyeU5vZGUodGhpcywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZmlyc3Qgbm9kZSBmb3VuZCBpbiB0aGUgZ3JhcGggd2l0aCB0aGUgbmFtZS4gVGhlIHNlYXJjaCBpcyBkZXB0aCBmaXJzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGdyYXBoLlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGV8bnVsbH0gVGhlIGZpcnN0IG5vZGUgdG8gYmUgZm91bmQgbWF0Y2hpbmcgdGhlIHN1cHBsaWVkIG5hbWUuIFJldHVybnNcbiAgICAgKiBudWxsIGlmIG5vIG5vZGUgaXMgZm91bmQuXG4gICAgICovXG4gICAgZmluZEJ5TmFtZShuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLm5hbWUgPT09IG5hbWUpIHJldHVybiB0aGlzO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZEJ5TmFtZShuYW1lKTtcbiAgICAgICAgICAgIGlmIChmb3VuZCAhPT0gbnVsbCkgcmV0dXJuIGZvdW5kO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZmlyc3Qgbm9kZSBmb3VuZCBpbiB0aGUgZ3JhcGggYnkgaXRzIGZ1bGwgcGF0aCBpbiB0aGUgZ3JhcGguIFRoZSBmdWxsIHBhdGggaGFzIHRoaXNcbiAgICAgKiBmb3JtICdwYXJlbnQvY2hpbGQvc3ViLWNoaWxkJy4gVGhlIHNlYXJjaCBpcyBkZXB0aCBmaXJzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBwYXRoIC0gVGhlIGZ1bGwgcGF0aCBvZiB0aGUge0BsaW5rIEdyYXBoTm9kZX0gYXMgZWl0aGVyIGEgc3RyaW5nIG9yXG4gICAgICogYXJyYXkgb2Yge0BsaW5rIEdyYXBoTm9kZX0gbmFtZXMuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBUaGUgZmlyc3Qgbm9kZSB0byBiZSBmb3VuZCBtYXRjaGluZyB0aGUgc3VwcGxpZWQgcGF0aC4gUmV0dXJuc1xuICAgICAqIG51bGwgaWYgbm8gbm9kZSBpcyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFN0cmluZyBmb3JtXG4gICAgICogY29uc3QgZ3JhbmRjaGlsZCA9IHRoaXMuZW50aXR5LmZpbmRCeVBhdGgoJ2NoaWxkL2dyYW5kY2hpbGQnKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFycmF5IGZvcm1cbiAgICAgKiBjb25zdCBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aChbJ2NoaWxkJywgJ2dyYW5kY2hpbGQnXSk7XG4gICAgICovXG4gICAgZmluZEJ5UGF0aChwYXRoKSB7XG4gICAgICAgIC8vIGFjY2VwdCBlaXRoZXIgc3RyaW5nIHBhdGggd2l0aCAnLycgc2VwYXJhdG9ycyBvciBhcnJheSBvZiBwYXJ0cy5cbiAgICAgICAgY29uc3QgcGFydHMgPSBBcnJheS5pc0FycmF5KHBhdGgpID8gcGF0aCA6IHBhdGguc3BsaXQoJy8nKTtcblxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGltYXggPSBwYXJ0cy5sZW5ndGg7IGkgPCBpbWF4OyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jaGlsZHJlbi5maW5kKGMgPT4gYy5uYW1lID09PSBwYXJ0c1tpXSk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlcyBhIHByb3ZpZGVkIGZ1bmN0aW9uIG9uY2Ugb24gdGhpcyBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGb3JFYWNoTm9kZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiB0byBleGVjdXRlIG9uIHRoZSBncmFwaCBub2RlIGFuZCBlYWNoXG4gICAgICogZGVzY2VuZGFudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3RoaXNBcmddIC0gT3B0aW9uYWwgdmFsdWUgdG8gdXNlIGFzIHRoaXMgd2hlbiBleGVjdXRpbmcgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb2cgdGhlIHBhdGggYW5kIG5hbWUgb2YgZWFjaCBub2RlIGluIGRlc2NlbmRhbnQgdHJlZSBzdGFydGluZyB3aXRoIFwicGFyZW50XCJcbiAgICAgKiBwYXJlbnQuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhub2RlLnBhdGggKyBcIi9cIiArIG5vZGUubmFtZSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuW2ldLmZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgbm9kZSBpcyBkZXNjZW5kYW50IG9mIGFub3RoZXIgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gUG90ZW50aWFsIGFuY2VzdG9yIG9mIG5vZGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIG5vZGUgaXMgZGVzY2VuZGFudCBvZiBhbm90aGVyIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAocm9vZi5pc0Rlc2NlbmRhbnRPZihob3VzZSkpIHtcbiAgICAgKiAgICAgLy8gcm9vZiBpcyBkZXNjZW5kYW50IG9mIGhvdXNlIGVudGl0eVxuICAgICAqIH1cbiAgICAgKi9cbiAgICBpc0Rlc2NlbmRhbnRPZihub2RlKSB7XG4gICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGlmIChwYXJlbnQgPT09IG5vZGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBub2RlIGlzIGFuY2VzdG9yIGZvciBhbm90aGVyIG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFBvdGVudGlhbCBkZXNjZW5kYW50IG9mIG5vZGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIG5vZGUgaXMgYW5jZXN0b3IgZm9yIGFub3RoZXIgbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChib2R5LmlzQW5jZXN0b3JPZihmb290KSkge1xuICAgICAqICAgICAvLyBmb290IGlzIHdpdGhpbiBib2R5J3MgaGllcmFyY2h5XG4gICAgICogfVxuICAgICAqL1xuICAgIGlzQW5jZXN0b3JPZihub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlLmlzRGVzY2VuZGFudE9mKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlIGluIEV1bGVyIGFuZ2xlIGZvcm0uIFRoZSByb3RhdGlvblxuICAgICAqIGlzIHJldHVybmVkIGFzIGV1bGVyIGFuZ2xlcyBpbiBhIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlXG4gICAgICogY29uc2lkZXJlZCByZWFkLW9ubHkuIEluIG9yZGVyIHRvIHNldCB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZVxuICAgICAqIHtAbGluayBHcmFwaE5vZGUjc2V0RXVsZXJBbmdsZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBpbiBFdWxlciBhbmdsZSBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYW5nbGVzID0gdGhpcy5lbnRpdHkuZ2V0RXVsZXJBbmdsZXMoKTtcbiAgICAgKiBhbmdsZXMueSA9IDE4MDsgLy8gcm90YXRlIHRoZSBlbnRpdHkgYXJvdW5kIFkgYnkgMTgwIGRlZ3JlZXNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIGdldEV1bGVyQW5nbGVzKCkge1xuICAgICAgICB0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkuZ2V0RXVsZXJBbmdsZXModGhpcy5ldWxlckFuZ2xlcyk7XG4gICAgICAgIHJldHVybiB0aGlzLmV1bGVyQW5nbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcm90YXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcm90YXRpb24gaXMgcmV0dXJuZWQgYXNcbiAgICAgKiBldWxlciBhbmdsZXMgaW4gYSB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUb1xuICAgICAqIHVwZGF0ZSB0aGUgbG9jYWwgcm90YXRpb24sIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsRXVsZXJBbmdsZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBhcyBldWxlciBhbmdsZXMgaW4gWFlaIG9yZGVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYW5nbGVzID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxFdWxlckFuZ2xlcygpO1xuICAgICAqIGFuZ2xlcy55ID0gMTgwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbEV1bGVyQW5nbGVzKCkge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uZ2V0RXVsZXJBbmdsZXModGhpcy5sb2NhbEV1bGVyQW5nbGVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxFdWxlckFuZ2xlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBvc2l0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHBvc2l0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUbyB1cGRhdGUgdGhlIGxvY2FsXG4gICAgICogcG9zaXRpb24sIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsUG9zaXRpb259LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSBwb3NpdGlvbiBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHBvc2l0aW9uID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAqIHBvc2l0aW9uLnggKz0gMTsgLy8gbW92ZSB0aGUgZW50aXR5IDEgdW5pdCBhbG9uZyB4LlxuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqL1xuICAgIGdldExvY2FsUG9zaXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsUG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSByb3RhdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFF1YXR9LiBUaGUgcmV0dXJuZWQgcXVhdGVybmlvbiBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiByb3RhdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxSb3RhdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIGxvY2FsIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGEgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvdGF0aW9uID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxSb3RhdGlvbigpO1xuICAgICAqL1xuICAgIGdldExvY2FsUm90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsUm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBzY2FsZSBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSBzY2FsZSBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFZlYzN9LiBUaGUgcmV0dXJuZWQgdmVjdG9yIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG8gdXBkYXRlIHRoZSBsb2NhbCBzY2FsZSxcbiAgICAgKiB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbFNjYWxlfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgbG9jYWwgc3BhY2Ugc2NhbGUgb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzY2FsZSA9IHRoaXMuZW50aXR5LmdldExvY2FsU2NhbGUoKTtcbiAgICAgKiBzY2FsZS54ID0gMTAwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIGdldExvY2FsU2NhbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsU2NhbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsb2NhbCB0cmFuc2Zvcm0gbWF0cml4IGZvciB0aGlzIGdyYXBoIG5vZGUuIFRoaXMgbWF0cml4IGlzIHRoZSB0cmFuc2Zvcm0gcmVsYXRpdmUgdG9cbiAgICAgKiB0aGUgbm9kZSdzIHBhcmVudCdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBUaGUgbm9kZSdzIGxvY2FsIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHRyYW5zZm9ybSA9IHRoaXMuZW50aXR5LmdldExvY2FsVHJhbnNmb3JtKCk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxUcmFuc2Zvcm0oKSB7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHBvc2l0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXJcbiAgICAgKiB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcG9zaXRpb24gPSB0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHBvc2l0aW9uLnggPSAxMDtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRUcmFuc2xhdGlvbih0aGlzLnBvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhcyBhXG4gICAgICoge0BsaW5rIFF1YXR9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIEluIG9yZGVyXG4gICAgICogdG8gc2V0IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0Um90YXRpb259LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSBhcyBhIHF1YXRlcm5pb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCByb3RhdGlvbiA9IHRoaXMuZW50aXR5LmdldFJvdGF0aW9uKCk7XG4gICAgICovXG4gICAgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgIHRoaXMucm90YXRpb24uc2V0RnJvbU1hdDQodGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBzY2FsZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByZXR1cm5lZCB2YWx1ZSB3aWxsIG9ubHkgYmVcbiAgICAgKiBjb3JyZWN0IGZvciBncmFwaCBub2RlcyB0aGF0IGhhdmUgYSBub24tc2tld2VkIHdvcmxkIHRyYW5zZm9ybSAoYSBza2V3IGNhbiBiZSBpbnRyb2R1Y2VkIGJ5XG4gICAgICogdGhlIGNvbXBvdW5kaW5nIG9mIHJvdGF0aW9ucyBhbmQgc2NhbGVzIGhpZ2hlciBpbiB0aGUgZ3JhcGggbm9kZSBoaWVyYXJjaHkpLiBUaGUgc2NhbGUgaXNcbiAgICAgKiByZXR1cm5lZCBhcyBhIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWRcbiAgICAgKiByZWFkLW9ubHkuIE5vdGUgdGhhdCBpdCBpcyBub3QgcG9zc2libGUgdG8gc2V0IHRoZSB3b3JsZCBzcGFjZSBzY2FsZSBvZiBhIGdyYXBoIG5vZGVcbiAgICAgKiBkaXJlY3RseS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2Ugc2NhbGUgb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzY2FsZSA9IHRoaXMuZW50aXR5LmdldFNjYWxlKCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFNjYWxlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NjYWxlKSB7XG4gICAgICAgICAgICB0aGlzLl9zY2FsZSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRTY2FsZSh0aGlzLl9zY2FsZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBUaGUgbm9kZSdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHRyYW5zZm9ybSA9IHRoaXMuZW50aXR5LmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICovXG4gICAgZ2V0V29ybGRUcmFuc2Zvcm0oKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCAmJiAhdGhpcy5fZGlydHlXb3JsZClcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndvcmxkVHJhbnNmb3JtO1xuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQpXG4gICAgICAgICAgICB0aGlzLl9wYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICB0aGlzLl9zeW5jKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMud29ybGRUcmFuc2Zvcm07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBjYWNoZWQgdmFsdWUgb2YgbmVnYXRpdmUgc2NhbGUgb2YgdGhlIHdvcmxkIHRyYW5zZm9ybS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IC0xIGlmIHdvcmxkIHRyYW5zZm9ybSBoYXMgbmVnYXRpdmUgc2NhbGUsIDEgb3RoZXJ3aXNlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgd29ybGRTY2FsZVNpZ24oKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3dvcmxkU2NhbGVTaWduID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl93b3JsZFNjYWxlU2lnbiA9IHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5zY2FsZVNpZ247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fd29ybGRTY2FsZVNpZ247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGdyYXBoIG5vZGUgZnJvbSBjdXJyZW50IHBhcmVudCBhbmQgYWRkIGFzIGNoaWxkIHRvIG5ldyBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gcGFyZW50IC0gTmV3IHBhcmVudCB0byBhdHRhY2ggZ3JhcGggbm9kZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2luZGV4XSAtIFRoZSBjaGlsZCBpbmRleCB3aGVyZSB0aGUgY2hpbGQgbm9kZSBzaG91bGQgYmUgcGxhY2VkLlxuICAgICAqL1xuICAgIHJlcGFyZW50KHBhcmVudCwgaW5kZXgpIHtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX3BhcmVudDtcblxuICAgICAgICBpZiAoY3VycmVudClcbiAgICAgICAgICAgIGN1cnJlbnQucmVtb3ZlQ2hpbGQodGhpcyk7XG5cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0Q2hpbGQodGhpcywgaW5kZXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuYWRkQ2hpbGQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBsb2NhbC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUgdXNpbmcgZXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlXG4gICAgICogaW50ZXJwcmV0ZWQgaW4gWFlaIG9yZGVyLiBFdWxlcnMgbXVzdCBiZSBzcGVjaWZpZWQgaW4gZGVncmVlcy4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2UgZXVsZXJcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGV1bGVycyBvciByb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2VcbiAgICAgKiB4LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHktYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2Ugei1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgcm90YXRpb24gb2YgOTAgZGVncmVlcyBhcm91bmQgeS1heGlzIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB5LWF4aXMgdmlhIGEgdmVjdG9yXG4gICAgICogY29uc3QgYW5nbGVzID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBzZXRMb2NhbEV1bGVyQW5nbGVzKHgsIHksIHopIHtcbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnNldEZyb21FdWxlckFuZ2xlcyh4LCB5LCB6KTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBsb2NhbC1zcGFjZSBwb3NpdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlXG4gICAgICogcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBsb2NhbC1zcGFjZSBwb3NpdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24oMCwgMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBwb3MgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3MpO1xuICAgICAqL1xuICAgIHNldExvY2FsUG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2YgbG9jYWwtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxSb3RhdGlvbigwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgcXVhdGVybmlvblxuICAgICAqIGNvbnN0IHEgPSBwYy5RdWF0KCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihxKTtcbiAgICAgKi9cbiAgICBzZXRMb2NhbFJvdGF0aW9uKHgsIHksIHosIHcpIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5zZXQoeCwgeSwgeiwgdyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBsb2NhbC1zcGFjZSBzY2FsZSBmYWN0b3Igb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHNjYWxlIG9yIHgtY29vcmRpbmF0ZVxuICAgICAqIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZSgxMCwgMTAsIDEwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgdmVjdG9yXG4gICAgICogY29uc3Qgc2NhbGUgPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFNjYWxlKHNjYWxlKTtcbiAgICAgKi9cbiAgICBzZXRMb2NhbFNjYWxlKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsU2NhbGUuY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTY2FsZS5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeUxvY2FsKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlXb3JsZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3VuZnJlZXplUGFyZW50VG9Sb290KCkge1xuICAgICAgICBsZXQgcCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgd2hpbGUgKHApIHtcbiAgICAgICAgICAgIHAuX2Zyb3plbiA9IGZhbHNlO1xuICAgICAgICAgICAgcCA9IHAuX3BhcmVudDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5V29ybGQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZClcbiAgICAgICAgICAgIHRoaXMuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG4gICAgICAgIHRoaXMuX2RpcnRpZnlXb3JsZEludGVybmFsKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RpcnRpZnlXb3JsZEludGVybmFsKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Zyb3plbiA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlXb3JsZCA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jaGlsZHJlbltpXS5fZGlydHlXb3JsZClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2hpbGRyZW5baV0uX2RpcnRpZnlXb3JsZEludGVybmFsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGlydHlOb3JtYWwgPSB0cnVlO1xuICAgICAgICB0aGlzLl93b3JsZFNjYWxlU2lnbiA9IDA7ICAgLy8gd29ybGQgbWF0cml4IGlzIGRpcnR5LCBtYXJrIHRoaXMgZmxhZyBkaXJ0eSB0b29cbiAgICAgICAgdGhpcy5fYWFiYlZlcisrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgd29ybGQtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24oMCwgMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBwb3NpdGlvbiA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgc2V0UG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uY29weShwb3NpdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnZQYXJlbnRXdG0uY29weSh0aGlzLl9wYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKSkuaW52ZXJ0KCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRXdG0udHJhbnNmb3JtUG9pbnQocG9zaXRpb24sIHRoaXMubG9jYWxQb3NpdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSBxdWF0ZXJuaW9uIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZVxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fG51bWJlcn0geCAtIFF1YXRlcm5pb24gaG9sZGluZyB3b3JsZC1zcGFjZSByb3RhdGlvbiBvciB4LWNvbXBvbmVudCBvZlxuICAgICAqIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29tcG9uZW50IG9mIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29tcG9uZW50IG9mIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFctY29tcG9uZW50IG9mIHdvcmxkLXNwYWNlIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIDQgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKDAsIDAsIDAsIDEpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSBxdWF0ZXJuaW9uXG4gICAgICogY29uc3QgcSA9IHBjLlF1YXQoKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbihxKTtcbiAgICAgKi9cbiAgICBzZXRSb3RhdGlvbih4LCB5LCB6LCB3KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgcm90YXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJvdGF0aW9uLnNldCh4LCB5LCB6LCB3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KHJvdGF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KGludlBhcmVudFJvdCkubXVsKHJvdGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZSB1c2luZyBldWxlciBhbmdsZXMuIEV1bGVycyBhcmVcbiAgICAgKiBpbnRlcnByZXRlZCBpbiBYWVogb3JkZXIuIEV1bGVycyBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZSBldWxlclxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgZXVsZXJzIG9yIHJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZVxuICAgICAqIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgdmlhIGEgdmVjdG9yXG4gICAgICogY29uc3QgYW5nbGVzID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgc2V0RXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFJvdCA9IHRoaXMuX3BhcmVudC5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKGludlBhcmVudFJvdCwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIG5ldyBjaGlsZCB0byB0aGUgY2hpbGQgbGlzdCBhbmQgdXBkYXRlIHRoZSBwYXJlbnQgdmFsdWUgb2YgdGhlIGNoaWxkIG5vZGUuXG4gICAgICogSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5ldyBjaGlsZCB0byBhZGQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5LmFkZENoaWxkKGUpO1xuICAgICAqL1xuICAgIGFkZENoaWxkKG5vZGUpIHtcbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuICAgICAgICB0aGlzLl9jaGlsZHJlbi5wdXNoKG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGNoaWxkIHRvIHRoaXMgbm9kZSwgbWFpbnRhaW5pbmcgdGhlIGNoaWxkJ3MgdHJhbnNmb3JtIGluIHdvcmxkIHNwYWNlLlxuICAgICAqIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBjaGlsZCB0byBhZGQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5LmFkZENoaWxkQW5kU2F2ZVRyYW5zZm9ybShlKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtKG5vZGUpIHtcblxuICAgICAgICBjb25zdCB3UG9zID0gbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3Um90ID0gbm9kZS5nZXRSb3RhdGlvbigpO1xuXG4gICAgICAgIHRoaXMuX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKTtcblxuICAgICAgICBub2RlLnNldFBvc2l0aW9uKHRtcE1hdDQuY29weSh0aGlzLndvcmxkVHJhbnNmb3JtKS5pbnZlcnQoKS50cmFuc2Zvcm1Qb2ludCh3UG9zKSk7XG4gICAgICAgIG5vZGUuc2V0Um90YXRpb24odG1wUXVhdC5jb3B5KHRoaXMuZ2V0Um90YXRpb24oKSkuaW52ZXJ0KCkubXVsKHdSb3QpKTtcblxuICAgICAgICB0aGlzLl9jaGlsZHJlbi5wdXNoKG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBhIG5ldyBjaGlsZCB0byB0aGUgY2hpbGQgbGlzdCBhdCB0aGUgc3BlY2lmaWVkIGluZGV4IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZlxuICAgICAqIHRoZSBjaGlsZCBub2RlLiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbmV3IGNoaWxkIHRvIGluc2VydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggaW4gdGhlIGNoaWxkIGxpc3Qgb2YgdGhlIHBhcmVudCB3aGVyZSB0aGUgbmV3IG5vZGUgd2lsbCBiZVxuICAgICAqIGluc2VydGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZSA9IG5ldyBwYy5FbnRpdHkoYXBwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5pbnNlcnRDaGlsZChlLCAxKTtcbiAgICAgKi9cbiAgICBpbnNlcnRDaGlsZChub2RlLCBpbmRleCkge1xuXG4gICAgICAgIHRoaXMuX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKTtcbiAgICAgICAgdGhpcy5fY2hpbGRyZW4uc3BsaWNlKGluZGV4LCAwLCBub2RlKTtcbiAgICAgICAgdGhpcy5fb25JbnNlcnRDaGlsZChub2RlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcmVwYXJlcyBub2RlIGZvciBiZWluZyBpbnNlcnRlZCB0byBhIHBhcmVudCBub2RlLCBhbmQgcmVtb3ZlcyBpdCBmcm9tIHRoZSBwcmV2aW91cyBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBub2RlIGJlaW5nIGluc2VydGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3ByZXBhcmVJbnNlcnRDaGlsZChub2RlKSB7XG5cbiAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gdGhlIGV4aXN0aW5nIHBhcmVudFxuICAgICAgICBpZiAobm9kZS5fcGFyZW50KSB7XG4gICAgICAgICAgICBub2RlLl9wYXJlbnQucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5hc3NlcnQobm9kZSAhPT0gdGhpcywgYEdyYXBoTm9kZSAke25vZGU/Lm5hbWV9IGNhbm5vdCBiZSBhIGNoaWxkIG9mIGl0c2VsZmApO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuaXNEZXNjZW5kYW50T2Yobm9kZSksIGBHcmFwaE5vZGUgJHtub2RlPy5uYW1lfSBjYW5ub3QgYWRkIGFuIGFuY2VzdG9yIGFzIGEgY2hpbGRgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlcyBhbiBldmVudCBvbiBhbGwgY2hpbGRyZW4gb2YgdGhlIG5vZGUuIFRoZSBldmVudCBgbmFtZWAgaXMgZmlyZWQgb24gdGhlIGZpcnN0IChyb290KVxuICAgICAqIG5vZGUgb25seS4gVGhlIGV2ZW50IGBuYW1lSGllcmFyY2h5YCBpcyBmaXJlZCBmb3IgYWxsIGNoaWxkcmVuLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gZmlyZSBvbiB0aGUgcm9vdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZUhpZXJhcmNoeSAtIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0byBmaXJlIGZvciBhbGwgZGVzY2VuZGFudHMuXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHBhcmVudCAtIFRoZSBwYXJlbnQgb2YgdGhlIG5vZGUgYmVpbmcgYWRkZWQvcmVtb3ZlZCBmcm9tIHRoZSBoaWVyYXJjaHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlyZU9uSGllcmFyY2h5KG5hbWUsIG5hbWVIaWVyYXJjaHksIHBhcmVudCkge1xuICAgICAgICB0aGlzLmZpcmUobmFtZSwgcGFyZW50KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2hpbGRyZW5baV0uX2ZpcmVPbkhpZXJhcmNoeShuYW1lSGllcmFyY2h5LCBuYW1lSGllcmFyY2h5LCBwYXJlbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gYSBub2RlIGlzIGluc2VydGVkIGludG8gYSBub2RlJ3MgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5vZGUgdGhhdCB3YXMgaW5zZXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25JbnNlcnRDaGlsZChub2RlKSB7XG4gICAgICAgIG5vZGUuX3BhcmVudCA9IHRoaXM7XG5cbiAgICAgICAgLy8gdGhlIGNoaWxkIG5vZGUgc2hvdWxkIGJlIGVuYWJsZWQgaW4gdGhlIGhpZXJhcmNoeSBvbmx5IGlmIGl0c2VsZiBpcyBlbmFibGVkIGFuZCBpZlxuICAgICAgICAvLyB0aGlzIHBhcmVudCBpcyBlbmFibGVkXG4gICAgICAgIGNvbnN0IGVuYWJsZWRJbkhpZXJhcmNoeSA9IChub2RlLl9lbmFibGVkICYmIHRoaXMuZW5hYmxlZCk7XG4gICAgICAgIGlmIChub2RlLl9lbmFibGVkSW5IaWVyYXJjaHkgIT09IGVuYWJsZWRJbkhpZXJhcmNoeSkge1xuICAgICAgICAgICAgbm9kZS5fZW5hYmxlZEluSGllcmFyY2h5ID0gZW5hYmxlZEluSGllcmFyY2h5O1xuXG4gICAgICAgICAgICAvLyBwcm9wYWdhdGUgdGhlIGNoYW5nZSB0byB0aGUgY2hpbGRyZW4gLSBuZWNlc3NhcnkgaWYgd2UgcmVwYXJlbnQgYSBub2RlXG4gICAgICAgICAgICAvLyB1bmRlciBhIHBhcmVudCB3aXRoIGEgZGlmZmVyZW50IGVuYWJsZWQgc3RhdGUgKGlmIHdlIHJlcGFyZW50IGEgbm9kZSB0aGF0IGlzXG4gICAgICAgICAgICAvLyBub3QgYWN0aXZlIGluIHRoZSBoaWVyYXJjaHkgdW5kZXIgYSBwYXJlbnQgd2hvIGlzIGFjdGl2ZSBpbiB0aGUgaGllcmFyY2h5IHRoZW5cbiAgICAgICAgICAgIC8vIHdlIHdhbnQgb3VyIG5vZGUgdG8gYmUgYWN0aXZhdGVkKVxuICAgICAgICAgICAgbm9kZS5fbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKG5vZGUsIGVuYWJsZWRJbkhpZXJhcmNoeSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgZ3JhcGggZGVwdGggb2YgdGhlIGNoaWxkIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIHdpbGwgbm93IGNoYW5nZVxuICAgICAgICBub2RlLl91cGRhdGVHcmFwaERlcHRoKCk7XG5cbiAgICAgICAgLy8gVGhlIGNoaWxkIChwbHVzIHN1YmhpZXJhcmNoeSkgd2lsbCBuZWVkIHdvcmxkIHRyYW5zZm9ybXMgdG8gYmUgcmVjYWxjdWxhdGVkXG4gICAgICAgIG5vZGUuX2RpcnRpZnlXb3JsZCgpO1xuICAgICAgICAvLyBub2RlIG1pZ2h0IGJlIGFscmVhZHkgbWFya2VkIGFzIGRpcnR5LCBpbiB0aGF0IGNhc2UgdGhlIHdob2xlIGNoYWluIHN0YXlzIGZyb3plbiwgc28gbGV0J3MgZW5mb3JjZSB1bmZyZWV6ZVxuICAgICAgICBpZiAodGhpcy5fZnJvemVuKVxuICAgICAgICAgICAgbm9kZS5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcblxuICAgICAgICAvLyBhbGVydCBhbiBlbnRpdHkgaGllcmFyY2h5IHRoYXQgaXQgaGFzIGJlZW4gaW5zZXJ0ZWRcbiAgICAgICAgbm9kZS5fZmlyZU9uSGllcmFyY2h5KCdpbnNlcnQnLCAnaW5zZXJ0aGllcmFyY2h5JywgdGhpcyk7XG5cbiAgICAgICAgLy8gYWxlcnQgdGhlIHBhcmVudCB0aGF0IGl0IGhhcyBoYWQgYSBjaGlsZCBpbnNlcnRlZFxuICAgICAgICBpZiAodGhpcy5maXJlKSB0aGlzLmZpcmUoJ2NoaWxkaW5zZXJ0Jywgbm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVjdXJzZSB0aGUgaGllcmFyY2h5IGFuZCB1cGRhdGUgdGhlIGdyYXBoIGRlcHRoIGF0IGVhY2ggbm9kZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUdyYXBoRGVwdGgoKSB7XG4gICAgICAgIHRoaXMuX2dyYXBoRGVwdGggPSB0aGlzLl9wYXJlbnQgPyB0aGlzLl9wYXJlbnQuX2dyYXBoRGVwdGggKyAxIDogMDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2NoaWxkcmVuW2ldLl91cGRhdGVHcmFwaERlcHRoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhlIG5vZGUgZnJvbSB0aGUgY2hpbGQgbGlzdCBhbmQgdXBkYXRlIHRoZSBwYXJlbnQgdmFsdWUgb2YgdGhlIGNoaWxkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IGNoaWxkIC0gVGhlIG5vZGUgdG8gcmVtb3ZlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgY2hpbGQgPSB0aGlzLmVudGl0eS5jaGlsZHJlblswXTtcbiAgICAgKiB0aGlzLmVudGl0eS5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICovXG4gICAgcmVtb3ZlQ2hpbGQoY2hpbGQpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9jaGlsZHJlbi5pbmRleE9mKGNoaWxkKTtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIGZyb20gY2hpbGQgbGlzdFxuICAgICAgICB0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgIC8vIENsZWFyIHBhcmVudFxuICAgICAgICBjaGlsZC5fcGFyZW50ID0gbnVsbDtcblxuICAgICAgICAvLyBOT1RFOiBzZWUgUFIgIzQwNDcgLSB0aGlzIGZpeCBpcyByZW1vdmVkIGZvciBub3cgYXMgaXQgYnJlYWtzIG90aGVyIHRoaW5nc1xuICAgICAgICAvLyBub3RpZnkgdGhlIGNoaWxkIGhpZXJhcmNoeSBpdCBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIHBhcmVudCxcbiAgICAgICAgLy8gd2hpY2ggbWFya3MgdGhlbSBhcyBub3QgZW5hYmxlZCBpbiBoaWVyYXJjaHlcbiAgICAgICAgLy8gaWYgKGNoaWxkLl9lbmFibGVkSW5IaWVyYXJjaHkpIHtcbiAgICAgICAgLy8gICAgIGNoaWxkLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQoY2hpbGQsIGZhbHNlKTtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIC8vIGFsZXJ0IGNoaWxkcmVuIHRoYXQgdGhleSBoYXMgYmVlbiByZW1vdmVkXG4gICAgICAgIGNoaWxkLl9maXJlT25IaWVyYXJjaHkoJ3JlbW92ZScsICdyZW1vdmVoaWVyYXJjaHknLCB0aGlzKTtcblxuICAgICAgICAvLyBhbGVydCB0aGUgcGFyZW50IHRoYXQgaXQgaGFzIGhhZCBhIGNoaWxkIHJlbW92ZWRcbiAgICAgICAgdGhpcy5maXJlKCdjaGlsZHJlbW92ZScsIGNoaWxkKTtcbiAgICB9XG5cbiAgICBfc3luYygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMubG9jYWxQb3NpdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uLCB0aGlzLmxvY2FsU2NhbGUpO1xuXG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUxvY2FsID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLmxvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBhcmVudFdvcmxkU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGEgcGFyZW50IG9mIHRoZSBmaXJzdCB1bmNvbXBlbnNhdGVkIG5vZGUgdXAgaW4gdGhlIGhpZXJhcmNoeSBhbmQgdXNlIGl0cyBzY2FsZSAqIGxvY2FsU2NhbGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IHNjYWxlID0gdGhpcy5sb2NhbFNjYWxlO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50VG9Vc2VTY2FsZUZyb20gPSBwYXJlbnQ7IC8vIGN1cnJlbnQgcGFyZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHBhcmVudFRvVXNlU2NhbGVGcm9tICYmIHBhcmVudFRvVXNlU2NhbGVGcm9tLnNjYWxlQ29tcGVuc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VG9Vc2VTY2FsZUZyb20gPSBwYXJlbnRUb1VzZVNjYWxlRnJvbS5fcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9wbW9zdCBub2RlIHdpdGggc2NhbGUgY29tcGVuc2F0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50VG9Vc2VTY2FsZUZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLl9wYXJlbnQ7IC8vIG5vZGUgd2l0aG91dCBzY2FsZSBjb21wZW5zYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50VG9Vc2VTY2FsZUZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50V29ybGRTY2FsZSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLndvcmxkVHJhbnNmb3JtLmdldFNjYWxlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlLm11bDIocGFyZW50V29ybGRTY2FsZSwgdGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGUgPSBzY2FsZUNvbXBlbnNhdGVTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBSb3RhdGlvbiBpcyBhcyB1c3VhbFxuICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QyLnNldEZyb21NYXQ0KHBhcmVudC53b3JsZFRyYW5zZm9ybSk7XG4gICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdC5tdWwyKHNjYWxlQ29tcGVuc2F0ZVJvdDIsIHRoaXMubG9jYWxSb3RhdGlvbik7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBtYXRyaXggdG8gdHJhbnNmb3JtIHBvc2l0aW9uXG4gICAgICAgICAgICAgICAgICAgIGxldCB0bWF0cml4ID0gcGFyZW50LndvcmxkVHJhbnNmb3JtO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50LnNjYWxlQ29tcGVuc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudC5tdWwyKHBhcmVudFdvcmxkU2NhbGUsIHBhcmVudC5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtLnNldFRSUyhwYXJlbnQud29ybGRUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24oc2NhbGVDb21wZW5zYXRlUG9zKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90MixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdG1hdHJpeCA9IHNjYWxlQ29tcGVuc2F0ZVBvc1RyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0bWF0cml4LnRyYW5zZm9ybVBvaW50KHRoaXMubG9jYWxQb3NpdGlvbiwgc2NhbGVDb21wZW5zYXRlUG9zKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLnNldFRSUyhzY2FsZUNvbXBlbnNhdGVQb3MsIHNjYWxlQ29tcGVuc2F0ZVJvdCwgc2NhbGUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5tdWxBZmZpbmUyKHRoaXMuX3BhcmVudC53b3JsZFRyYW5zZm9ybSwgdGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVdvcmxkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaWNlcyBhdCB0aGlzIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3luY0hpZXJhcmNoeSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9mcm96ZW4pXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2Zyb3plbiA9IHRydWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwgfHwgdGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgdGhpcy5fc3luYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjaGlsZHJlbltpXS5zeW5jSGllcmFyY2h5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW9yaWVudHMgdGhlIGdyYXBoIG5vZGUgc28gdGhhdCB0aGUgbmVnYXRpdmUgei1heGlzIHBvaW50cyB0b3dhcmRzIHRoZSB0YXJnZXQuIFRoaXNcbiAgICAgKiBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIEVpdGhlciBwYXNzIDNEIHZlY3RvcnMgZm9yIHRoZSBsb29rIGF0IGNvb3JkaW5hdGUgYW5kIHVwXG4gICAgICogdmVjdG9yLCBvciBwYXNzIG51bWJlcnMgdG8gcmVwcmVzZW50IHRoZSB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIElmIHBhc3NpbmcgYSAzRCB2ZWN0b3IsIHRoaXMgaXMgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBPdGhlcndpc2UsIGl0IGlzIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IFt5XSAtIElmIHBhc3NpbmcgYSAzRCB2ZWN0b3IsIHRoaXMgaXMgdGhlIHdvcmxkLXNwYWNlIHVwIHZlY3RvciBmb3IgbG9vayBhdFxuICAgICAqIHRyYW5zZm9ybS4gT3RoZXJ3aXNlLCBpdCBpcyB0aGUgeS1jb21wb25lbnQgb2YgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2YgdGhlIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3V4PTBdIC0gWC1jb21wb25lbnQgb2YgdGhlIHVwIHZlY3RvciBmb3IgdGhlIGxvb2sgYXQgdHJhbnNmb3JtLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXk9MV0gLSBZLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1ej0wXSAtIFotY29tcG9uZW50IG9mIHRoZSB1cCB2ZWN0b3IgZm9yIHRoZSBsb29rIGF0IHRyYW5zZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgYW5vdGhlciBlbnRpdHksIHVzaW5nIHRoZSAoZGVmYXVsdCkgcG9zaXRpdmUgeS1heGlzIGZvciB1cFxuICAgICAqIGNvbnN0IHBvc2l0aW9uID0gb3RoZXJFbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQocG9zaXRpb24pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCBhbm90aGVyIGVudGl0eSwgdXNpbmcgdGhlIG5lZ2F0aXZlIHdvcmxkIHktYXhpcyBmb3IgdXBcbiAgICAgKiBjb25zdCBwb3NpdGlvbiA9IG90aGVyRW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KHBvc2l0aW9uLCBwYy5WZWMzLkRPV04pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCB0aGUgd29ybGQgc3BhY2Ugb3JpZ2luLCB1c2luZyB0aGUgKGRlZmF1bHQpIHBvc2l0aXZlIHktYXhpcyBmb3IgdXBcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQoMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgWzEwLCAxMCwgMTBdLCB1c2luZyB0aGUgbmVnYXRpdmUgd29ybGQgeS1heGlzIGZvciB1cFxuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdCgxMCwgMTAsIDEwLCAwLCAtMSwgMCk7XG4gICAgICovXG4gICAgbG9va0F0KHgsIHksIHosIHV4ID0gMCwgdXkgPSAxLCB1eiA9IDApIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0YXJnZXQuY29weSh4KTtcblxuICAgICAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBWZWMzKSB7IC8vIHZlYzMsIHZlYzNcbiAgICAgICAgICAgICAgICB1cC5jb3B5KHkpO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gdmVjM1xuICAgICAgICAgICAgICAgIHVwLmNvcHkoVmVjMy5VUCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoeiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXQuc2V0KHgsIHksIHopO1xuICAgICAgICAgICAgdXAuc2V0KHV4LCB1eSwgdXopO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0cml4LnNldExvb2tBdCh0aGlzLmdldFBvc2l0aW9uKCksIHRhcmdldCwgdXApO1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tTWF0NChtYXRyaXgpO1xuICAgICAgICB0aGlzLnNldFJvdGF0aW9uKHJvdGF0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2xhdGVzIHRoZSBncmFwaCBub2RlIGluIHdvcmxkLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgdHJhbnNsYXRpb24gdmVjdG9yLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZVxuICAgICAqIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2UgdHJhbnNsYXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGUoMTAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCB0ID0gbmV3IHBjLlZlYzMoMTAsIDAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZSh0KTtcbiAgICAgKi9cbiAgICB0cmFuc2xhdGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICBwb3NpdGlvbi5hZGQodGhpcy5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNsYXRlcyB0aGUgZ3JhcGggbm9kZSBpbiBsb2NhbC1zcGFjZSBieSB0aGUgc3BlY2lmaWVkIHRyYW5zbGF0aW9uIHZlY3Rvci4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGVcbiAgICAgKiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRyYW5zbGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlTG9jYWwoMTAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCB0ID0gbmV3IHBjLlZlYzMoMTAsIDAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZUxvY2FsKHQpO1xuICAgICAqL1xuICAgIHRyYW5zbGF0ZUxvY2FsKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnRyYW5zZm9ybVZlY3Rvcihwb3NpdGlvbiwgcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uYWRkKHBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSb3RhdGVzIHRoZSBncmFwaCBub2RlIGluIHdvcmxkLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgRXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlIHNwZWNpZmllZCBpblxuICAgICAqIGRlZ3JlZXMgaW4gWFlaIG9yZGVyLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEXG4gICAgICogdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yXG4gICAgICogcm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlKDAsIDkwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgdmVjdG9yXG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWMzKDAsIDkwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGUocik7XG4gICAgICovXG4gICAgcm90YXRlKHgsIHksIHopIHtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwyKHJvdGF0aW9uLCB0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgcm90ID0gdGhpcy5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgICAgIGludlBhcmVudFJvdC5jb3B5KHBhcmVudFJvdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICByb3RhdGlvbi5tdWwyKGludlBhcmVudFJvdCwgcm90YXRpb24pO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIocm90YXRpb24sIHJvdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSb3RhdGVzIHRoZSBncmFwaCBub2RlIGluIGxvY2FsLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgRXVsZXIgYW5nbGVzLiBFdWxlcnMgYXJlIHNwZWNpZmllZCBpblxuICAgICAqIGRlZ3JlZXMgaW4gWFlaIG9yZGVyLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEXG4gICAgICogdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZSByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9yXG4gICAgICogcm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJvdGF0ZSB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlTG9jYWwoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZUxvY2FsKHIpO1xuICAgICAqL1xuICAgIHJvdGF0ZUxvY2FsKHgsIHksIHopIHtcbiAgICAgICAgcm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5tdWwocm90YXRpb24pO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgR3JhcGhOb2RlIH07XG4iXSwibmFtZXMiOlsic2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtIiwiTWF0NCIsInNjYWxlQ29tcGVuc2F0ZVBvcyIsIlZlYzMiLCJzY2FsZUNvbXBlbnNhdGVSb3QiLCJRdWF0Iiwic2NhbGVDb21wZW5zYXRlUm90MiIsInNjYWxlQ29tcGVuc2F0ZVNjYWxlIiwic2NhbGVDb21wZW5zYXRlU2NhbGVGb3JQYXJlbnQiLCJ0bXBNYXQ0IiwidG1wUXVhdCIsInBvc2l0aW9uIiwiaW52UGFyZW50V3RtIiwicm90YXRpb24iLCJpbnZQYXJlbnRSb3QiLCJtYXRyaXgiLCJ0YXJnZXQiLCJ1cCIsIkdyYXBoTm9kZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibmFtZSIsInRhZ3MiLCJUYWdzIiwiX2xhYmVscyIsImxvY2FsUG9zaXRpb24iLCJsb2NhbFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsImxvY2FsRXVsZXJBbmdsZXMiLCJldWxlckFuZ2xlcyIsIl9zY2FsZSIsImxvY2FsVHJhbnNmb3JtIiwiX2RpcnR5TG9jYWwiLCJfYWFiYlZlciIsIl9mcm96ZW4iLCJ3b3JsZFRyYW5zZm9ybSIsIl9kaXJ0eVdvcmxkIiwiX3dvcmxkU2NhbGVTaWduIiwiX25vcm1hbE1hdHJpeCIsIk1hdDMiLCJfZGlydHlOb3JtYWwiLCJfcmlnaHQiLCJfdXAiLCJfZm9yd2FyZCIsIl9wYXJlbnQiLCJfY2hpbGRyZW4iLCJfZ3JhcGhEZXB0aCIsIl9lbmFibGVkIiwiX2VuYWJsZWRJbkhpZXJhcmNoeSIsInNjYWxlQ29tcGVuc2F0aW9uIiwicmlnaHQiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImdldFgiLCJub3JtYWxpemUiLCJnZXRZIiwiZm9yd2FyZCIsImdldFoiLCJtdWxTY2FsYXIiLCJub3JtYWxNYXRyaXgiLCJub3JtYWxNYXQiLCJpbnZlcnRUbzN4MyIsInRyYW5zcG9zZSIsImVuYWJsZWQiLCJfdGhpcyRfcGFyZW50IiwiX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsInBhcmVudCIsInBhdGgiLCJub2RlIiwicmVzdWx0Iiwicm9vdCIsImNoaWxkcmVuIiwiZ3JhcGhEZXB0aCIsIl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsImMiLCJpIiwibGVuIiwibGVuZ3RoIiwiX3VuZnJlZXplUGFyZW50VG9Sb290IiwiX2Nsb25lSW50ZXJuYWwiLCJjbG9uZSIsIl9saXN0IiwiY2xlYXIiLCJhZGQiLCJPYmplY3QiLCJhc3NpZ24iLCJjb3B5Iiwic291cmNlIiwiZmluZCIsImF0dHIiLCJ2YWx1ZSIsInJlc3VsdHMiLCJGdW5jdGlvbiIsImZuIiwicHVzaCIsImRlc2NlbmRhbnRzIiwiY29uY2F0IiwidGVzdFZhbHVlIiwiZmluZE9uZSIsImZpbmRCeVRhZyIsInF1ZXJ5IiwiYXJndW1lbnRzIiwicXVlcnlOb2RlIiwiY2hlY2tOb2RlIiwiaGFzIiwiZmluZEJ5TmFtZSIsImZvdW5kIiwiZmluZEJ5UGF0aCIsInBhcnRzIiwiQXJyYXkiLCJpc0FycmF5Iiwic3BsaXQiLCJpbWF4IiwiZm9yRWFjaCIsImNhbGxiYWNrIiwidGhpc0FyZyIsImNhbGwiLCJpc0Rlc2NlbmRhbnRPZiIsImlzQW5jZXN0b3JPZiIsImdldEV1bGVyQW5nbGVzIiwiZ2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldExvY2FsUG9zaXRpb24iLCJnZXRMb2NhbFJvdGF0aW9uIiwiZ2V0TG9jYWxTY2FsZSIsImdldExvY2FsVHJhbnNmb3JtIiwic2V0VFJTIiwiZ2V0UG9zaXRpb24iLCJnZXRUcmFuc2xhdGlvbiIsImdldFJvdGF0aW9uIiwic2V0RnJvbU1hdDQiLCJnZXRTY2FsZSIsIl9zeW5jIiwid29ybGRTY2FsZVNpZ24iLCJzY2FsZVNpZ24iLCJyZXBhcmVudCIsImluZGV4IiwiY3VycmVudCIsInJlbW92ZUNoaWxkIiwiaW5zZXJ0Q2hpbGQiLCJhZGRDaGlsZCIsInNldExvY2FsRXVsZXJBbmdsZXMiLCJ4IiwieSIsInoiLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJfZGlydGlmeUxvY2FsIiwic2V0TG9jYWxQb3NpdGlvbiIsInNldCIsInNldExvY2FsUm90YXRpb24iLCJ3Iiwic2V0TG9jYWxTY2FsZSIsIl9kaXJ0aWZ5V29ybGQiLCJwIiwiX2RpcnRpZnlXb3JsZEludGVybmFsIiwic2V0UG9zaXRpb24iLCJpbnZlcnQiLCJ0cmFuc2Zvcm1Qb2ludCIsInNldFJvdGF0aW9uIiwicGFyZW50Um90IiwibXVsIiwic2V0RXVsZXJBbmdsZXMiLCJtdWwyIiwiX3ByZXBhcmVJbnNlcnRDaGlsZCIsIl9vbkluc2VydENoaWxkIiwiYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtIiwid1BvcyIsIndSb3QiLCJzcGxpY2UiLCJEZWJ1ZyIsImFzc2VydCIsIl9maXJlT25IaWVyYXJjaHkiLCJuYW1lSGllcmFyY2h5IiwiZmlyZSIsImVuYWJsZWRJbkhpZXJhcmNoeSIsIl91cGRhdGVHcmFwaERlcHRoIiwiY2hpbGQiLCJpbmRleE9mIiwicGFyZW50V29ybGRTY2FsZSIsInNjYWxlIiwicGFyZW50VG9Vc2VTY2FsZUZyb20iLCJ0bWF0cml4IiwibXVsQWZmaW5lMiIsInN5bmNIaWVyYXJjaHkiLCJsb29rQXQiLCJ1eCIsInV5IiwidXoiLCJVUCIsInVuZGVmaW5lZCIsInNldExvb2tBdCIsInRyYW5zbGF0ZSIsInRyYW5zbGF0ZUxvY2FsIiwidHJhbnNmb3JtVmVjdG9yIiwicm90YXRlIiwicm90Iiwicm90YXRlTG9jYWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBU0EsTUFBTUEsMkJBQTJCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDOUMsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDckMsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDckMsTUFBTUMsbUJBQW1CLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDdEMsTUFBTUUsb0JBQW9CLEdBQUcsSUFBSUosSUFBSSxFQUFFLENBQUE7QUFDdkMsTUFBTUssNkJBQTZCLEdBQUcsSUFBSUwsSUFBSSxFQUFFLENBQUE7QUFDaEQsTUFBTU0sT0FBTyxHQUFHLElBQUlSLElBQUksRUFBRSxDQUFBO0FBQzFCLE1BQU1TLE9BQU8sR0FBRyxJQUFJTCxJQUFJLEVBQUUsQ0FBQTtBQUMxQixNQUFNTSxRQUFRLEdBQUcsSUFBSVIsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTVMsWUFBWSxHQUFHLElBQUlYLElBQUksRUFBRSxDQUFBO0FBQy9CLE1BQU1ZLFFBQVEsR0FBRyxJQUFJUixJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNUyxZQUFZLEdBQUcsSUFBSVQsSUFBSSxFQUFFLENBQUE7QUFDL0IsTUFBTVUsTUFBTSxHQUFHLElBQUlkLElBQUksRUFBRSxDQUFBO0FBQ3pC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
