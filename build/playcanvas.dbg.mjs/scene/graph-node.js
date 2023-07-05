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
    this.name = void 0;
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
    this.localEulerAngles = new Vec3();
    // Only calculated on request
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
     * @type {number}
     * @private
     */
    this._aabbVer = 0;
    /**
     * Marks the node to ignore hierarchy sync entirely (including children nodes). The engine code
     * automatically freezes and unfreezes objects whenever required. Segregating dynamic and
     * stationary nodes into subhierarchies allows to reduce sync time significantly.
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
     * Cached value representing the negatively scaled world transform. If the value is 0, this
     * marks this value as dirty and it needs to be recalculated. If the value is 1, the world
     * transform is not negatively scaled. If the value is -1, the world transform is negatively
     * scaled.
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
     * Represents enabled state of the entity. If the entity is disabled, the entity including all
     * children are excluded from updates.
     *
     * @type {boolean}
     * @private
     */
    this._enabled = true;
    /**
     * Represents enabled state of the entity in the hierarchy. It's true only if this entity and
     * all parent entities all the way to the scene's root are enabled.
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
   * Detach a GraphNode from the hierarchy and recursively destroy all children.
   *
   * @example
   * const firstChild = this.entity.children[0];
   * firstChild.destroy(); // delete child, all components and remove from hierarchy
   */
  destroy() {
    var _this$_parent2;
    // Detach from parent
    (_this$_parent2 = this._parent) == null ? void 0 : _this$_parent2.removeChild(this);

    // Recursively destroy all children
    const children = this._children;
    while (children.length) {
      // Remove last child from the array
      const child = children.pop();
      // Disconnect it from the parent: this is only an optimization step, to prevent calling
      // GraphNode#removeChild which would try to refind it via this._children.indexOf (which
      // will fail, because we just removed it).
      child._parent = null;
      child.destroy();
    }

    // fire destroy event
    this.fire('destroy', this);

    // clear all events
    this.off();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtbm9kZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3MgfSBmcm9tICcuLi9jb3JlL3RhZ3MuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuY29uc3Qgc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNjYWxlQ29tcGVuc2F0ZVBvcyA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVSb3QgPSBuZXcgUXVhdCgpO1xuY29uc3Qgc2NhbGVDb21wZW5zYXRlUm90MiA9IG5ldyBRdWF0KCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBNYXQ0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRtcFF1YXQgPSBuZXcgUXVhdCgpO1xuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcbmNvbnN0IHJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbmNvbnN0IGludlBhcmVudFJvdCA9IG5ldyBRdWF0KCk7XG5jb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuY29uc3QgdGFyZ2V0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHVwID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBHcmFwaE5vZGUjZmluZH0gYW5kIHtAbGluayBHcmFwaE5vZGUjZmluZE9uZX0gdG8gc2VhcmNoIHRocm91Z2ggYSBncmFwaFxuICogbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmluZE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybmluZyBgdHJ1ZWAgd2lsbCByZXN1bHQgaW4gdGhhdCBub2RlIGJlaW5nIHJldHVybmVkIGZyb21cbiAqIHtAbGluayBHcmFwaE5vZGUjZmluZH0gb3Ige0BsaW5rIEdyYXBoTm9kZSNmaW5kT25lfS5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEdyYXBoTm9kZSNmb3JFYWNofSB0byBpdGVyYXRlIHRocm91Z2ggYSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzXG4gKiBkZXNjZW5kYW50cy5cbiAqXG4gKiBAY2FsbGJhY2sgRm9yRWFjaE5vZGVDYWxsYmFja1xuICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgY3VycmVudCBncmFwaCBub2RlLlxuICovXG5cbi8qKlxuICogQSBoaWVyYXJjaGljYWwgc2NlbmUgbm9kZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoTm9kZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIG5vbi11bmlxdWUgbmFtZSBvZiBhIGdyYXBoIG5vZGUuIERlZmF1bHRzIHRvICdVbnRpdGxlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcmZhY2UgZm9yIHRhZ2dpbmcgZ3JhcGggbm9kZXMuIFRhZyBiYXNlZCBzZWFyY2hlcyBjYW4gYmUgcGVyZm9ybWVkIHVzaW5nIHRoZVxuICAgICAqIHtAbGluayBHcmFwaE5vZGUjZmluZEJ5VGFnfSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtUYWdzfVxuICAgICAqL1xuICAgIHRhZ3MgPSBuZXcgVGFncyh0aGlzKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sYWJlbHMgPSB7fTtcblxuICAgIC8vIExvY2FsLXNwYWNlIHByb3BlcnRpZXMgb2YgdHJhbnNmb3JtIChvbmx5IGZpcnN0IDMgYXJlIHNldHRhYmxlIGJ5IHRoZSB1c2VyKVxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsb2NhbFNjYWxlID0gbmV3IFZlYzMoMSwgMSwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvY2FsRXVsZXJBbmdsZXMgPSBuZXcgVmVjMygpOyAvLyBPbmx5IGNhbGN1bGF0ZWQgb24gcmVxdWVzdFxuXG4gICAgLy8gV29ybGQtc3BhY2UgcHJvcGVydGllcyBvZiB0cmFuc2Zvcm1cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBldWxlckFuZ2xlcyA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NjYWxlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlydHlMb2NhbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hYWJiVmVyID0gMDtcblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBub2RlIHRvIGlnbm9yZSBoaWVyYXJjaHkgc3luYyBlbnRpcmVseSAoaW5jbHVkaW5nIGNoaWxkcmVuIG5vZGVzKS4gVGhlIGVuZ2luZSBjb2RlXG4gICAgICogYXV0b21hdGljYWxseSBmcmVlemVzIGFuZCB1bmZyZWV6ZXMgb2JqZWN0cyB3aGVuZXZlciByZXF1aXJlZC4gU2VncmVnYXRpbmcgZHluYW1pYyBhbmRcbiAgICAgKiBzdGF0aW9uYXJ5IG5vZGVzIGludG8gc3ViaGllcmFyY2hpZXMgYWxsb3dzIHRvIHJlZHVjZSBzeW5jIHRpbWUgc2lnbmlmaWNhbnRseS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Zyb3plbiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB3b3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eVdvcmxkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDYWNoZWQgdmFsdWUgcmVwcmVzZW50aW5nIHRoZSBuZWdhdGl2ZWx5IHNjYWxlZCB3b3JsZCB0cmFuc2Zvcm0uIElmIHRoZSB2YWx1ZSBpcyAwLCB0aGlzXG4gICAgICogbWFya3MgdGhpcyB2YWx1ZSBhcyBkaXJ0eSBhbmQgaXQgbmVlZHMgdG8gYmUgcmVjYWxjdWxhdGVkLiBJZiB0aGUgdmFsdWUgaXMgMSwgdGhlIHdvcmxkXG4gICAgICogdHJhbnNmb3JtIGlzIG5vdCBuZWdhdGl2ZWx5IHNjYWxlZC4gSWYgdGhlIHZhbHVlIGlzIC0xLCB0aGUgd29ybGQgdHJhbnNmb3JtIGlzIG5lZ2F0aXZlbHlcbiAgICAgKiBzY2FsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dvcmxkU2NhbGVTaWduID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vcm1hbE1hdHJpeCA9IG5ldyBNYXQzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eU5vcm1hbCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JpZ2h0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXAgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9mb3J3YXJkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHcmFwaE5vZGV8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJlbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NoaWxkcmVuID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dyYXBoRGVwdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogUmVwcmVzZW50cyBlbmFibGVkIHN0YXRlIG9mIHRoZSBlbnRpdHkuIElmIHRoZSBlbnRpdHkgaXMgZGlzYWJsZWQsIHRoZSBlbnRpdHkgaW5jbHVkaW5nIGFsbFxuICAgICAqIGNoaWxkcmVuIGFyZSBleGNsdWRlZCBmcm9tIHVwZGF0ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFJlcHJlc2VudHMgZW5hYmxlZCBzdGF0ZSBvZiB0aGUgZW50aXR5IGluIHRoZSBoaWVyYXJjaHkuIEl0J3MgdHJ1ZSBvbmx5IGlmIHRoaXMgZW50aXR5IGFuZFxuICAgICAqIGFsbCBwYXJlbnQgZW50aXRpZXMgYWxsIHRoZSB3YXkgdG8gdGhlIHNjZW5lJ3Mgcm9vdCBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNjYWxlQ29tcGVuc2F0aW9uID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR3JhcGhOb2RlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBub24tdW5pcXVlIG5hbWUgb2YgYSBncmFwaCBub2RlLiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUgPSAnVW50aXRsZWQnKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBYLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHJpZ2h0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9yaWdodCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRYKHRoaXMuX3JpZ2h0KS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBZLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IHVwKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3VwKSB7XG4gICAgICAgICAgICB0aGlzLl91cCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRZKHRoaXMuX3VwKS5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsaXplZCBsb2NhbCBzcGFjZSBuZWdhdGl2ZSBaLWF4aXMgdmVjdG9yIG9mIHRoZSBncmFwaCBub2RlIGluIHdvcmxkIHNwYWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ2V0IGZvcndhcmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZm9yd2FyZCkge1xuICAgICAgICAgICAgdGhpcy5fZm9yd2FyZCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRaKHRoaXMuX2ZvcndhcmQpLm5vcm1hbGl6ZSgpLm11bFNjYWxhcigtMSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBtYXRyaXggdXNlZCB0byB0cmFuc2Zvcm0gdGhlIG5vcm1hbC5cbiAgICAgKlxuICAgICAqIEB0eXBlICB7TWF0M31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IG5vcm1hbE1hdHJpeCgpIHtcblxuICAgICAgICBjb25zdCBub3JtYWxNYXQgPSB0aGlzLl9ub3JtYWxNYXRyaXg7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eU5vcm1hbCkge1xuICAgICAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmludmVydFRvM3gzKG5vcm1hbE1hdCk7XG4gICAgICAgICAgICBub3JtYWxNYXQudHJhbnNwb3NlKCk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vcm1hbE1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgb3IgZGlzYWJsZSBhIEdyYXBoTm9kZS4gSWYgb25lIG9mIHRoZSBHcmFwaE5vZGUncyBwYXJlbnRzIGlzIGRpc2FibGVkIHRoZXJlIHdpbGwgYmVcbiAgICAgKiBubyBvdGhlciBzaWRlIGVmZmVjdHMuIElmIGFsbCB0aGUgcGFyZW50cyBhcmUgZW5hYmxlZCB0aGVuIHRoZSBuZXcgdmFsdWUgd2lsbCBhY3RpdmF0ZSBvclxuICAgICAqIGRlYWN0aXZhdGUgYWxsIHRoZSBlbmFibGVkIGNoaWxkcmVuIG9mIHRoZSBHcmFwaE5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZW5hYmxlZChlbmFibGVkKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICE9PSBlbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gZW5hYmxlZDtcblxuICAgICAgICAgICAgLy8gaWYgZW5hYmxpbmcgZW50aXR5LCBtYWtlIGFsbCBjaGlsZHJlbiBlbmFibGVkIGluIGhpZXJhcmNoeSBvbmx5IHdoZW4gdGhlIHBhcmVudCBpcyBhcyB3ZWxsXG4gICAgICAgICAgICAvLyBpZiBkaXNhYmxpbmcgZW50aXR5LCBtYWtlIGFsbCBjaGlsZHJlbiBkaXNhYmxlZCBpbiBoaWVyYXJjaHkgaW4gYWxsIGNhc2VzXG4gICAgICAgICAgICBpZiAoZW5hYmxlZCAmJiB0aGlzLl9wYXJlbnQ/LmVuYWJsZWQgfHwgIWVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQodGhpcywgZW5hYmxlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgLy8gbWFrZSBzdXJlIHRvIGNoZWNrIHRoaXMuX2VuYWJsZWQgdG9vIGJlY2F1c2UgaWYgdGhhdFxuICAgICAgICAvLyB3YXMgZmFsc2Ugd2hlbiBhIHBhcmVudCB3YXMgdXBkYXRlZCB0aGUgX2VuYWJsZWRJbkhpZXJhcmNoeVxuICAgICAgICAvLyBmbGFnIG1heSBub3QgaGF2ZSBiZWVuIHVwZGF0ZWQgZm9yIG9wdGltaXphdGlvbiBwdXJwb3Nlc1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZCAmJiB0aGlzLl9lbmFibGVkSW5IaWVyYXJjaHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWFkLW9ubHkgcHJvcGVydHkgdG8gZ2V0IGEgcGFyZW50IGdyYXBoIG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHBhcmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgdGhlIHBhdGggb2YgdGhlIGdyYXBoIG5vZGUgcmVsYXRpdmUgdG8gdGhlIHJvb3Qgb2YgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICAgIGxldCBub2RlID0gdGhpcy5fcGFyZW50O1xuICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzLm5hbWU7XG4gICAgICAgIHdoaWxlIChub2RlICYmIG5vZGUuX3BhcmVudCkge1xuICAgICAgICAgICAgcmVzdWx0ID0gYCR7bm9kZS5uYW1lfS8ke3Jlc3VsdH1gO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCBoaWdoZXN0IGdyYXBoIG5vZGUgZnJvbSBjdXJyZW50IG5vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfVxuICAgICAqL1xuICAgIGdldCByb290KCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcztcbiAgICAgICAgd2hpbGUgKHJlc3VsdC5fcGFyZW50KSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQuX3BhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgY2hpbGRyZW4gb2YgdGhpcyBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICAgICAqL1xuICAgIGdldCBjaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NoaWxkcmVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRvIGdldCB0aGUgZGVwdGggb2YgdGhpcyBjaGlsZCB3aXRoaW4gdGhlIGdyYXBoLiBOb3RlIHRoYXQgZm9yXG4gICAgICogcGVyZm9ybWFuY2UgcmVhc29ucyB0aGlzIGlzIG9ubHkgcmVjYWxjdWxhdGVkIHdoZW4gYSBub2RlIGlzIGFkZGVkIHRvIGEgbmV3IHBhcmVudCwgaS5lLiBJdFxuICAgICAqIGlzIG5vdCByZWNhbGN1bGF0ZWQgd2hlbiBhIG5vZGUgaXMgc2ltcGx5IHJlbW92ZWQgZnJvbSB0aGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBncmFwaERlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ3JhcGhEZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIEdyYXBoIG5vZGUgdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5LCBmYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQobm9kZSwgZW5hYmxlZCkge1xuICAgICAgICBub2RlLl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKTtcblxuICAgICAgICBjb25zdCBjID0gbm9kZS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY1tpXS5fZW5hYmxlZClcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQoY1tpXSwgZW5hYmxlZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgZW5hYmxlZCBmbGFnIG9mIHRoZSBlbnRpdHkgb3Igb25lIG9mIGl0cyBwYXJlbnRzIGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIGlmIGVuYWJsZWQgaW4gdGhlIGhpZXJhcmNoeSwgZmFsc2UgaWYgZGlzYWJsZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQoZW5hYmxlZCkge1xuICAgICAgICAvLyBPdmVycmlkZSBpbiBkZXJpdmVkIGNsYXNzZXNcbiAgICAgICAgdGhpcy5fZW5hYmxlZEluSGllcmFyY2h5ID0gZW5hYmxlZDtcbiAgICAgICAgaWYgKGVuYWJsZWQgJiYgIXRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIHRoaXMuX3VuZnJlZXplUGFyZW50VG9Sb290KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHt0aGlzfSBjbG9uZSAtIFRoZSBjbG9uZWQgZ3JhcGggbm9kZSB0byBjb3B5IGludG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xvbmVJbnRlcm5hbChjbG9uZSkge1xuICAgICAgICBjbG9uZS5uYW1lID0gdGhpcy5uYW1lO1xuXG4gICAgICAgIGNvbnN0IHRhZ3MgPSB0aGlzLnRhZ3MuX2xpc3Q7XG4gICAgICAgIGNsb25lLnRhZ3MuY2xlYXIoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YWdzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgY2xvbmUudGFncy5hZGQodGFnc1tpXSk7XG5cbiAgICAgICAgY2xvbmUuX2xhYmVscyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX2xhYmVscyk7XG5cbiAgICAgICAgY2xvbmUubG9jYWxQb3NpdGlvbi5jb3B5KHRoaXMubG9jYWxQb3NpdGlvbik7XG4gICAgICAgIGNsb25lLmxvY2FsUm90YXRpb24uY29weSh0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICBjbG9uZS5sb2NhbFNjYWxlLmNvcHkodGhpcy5sb2NhbFNjYWxlKTtcbiAgICAgICAgY2xvbmUubG9jYWxFdWxlckFuZ2xlcy5jb3B5KHRoaXMubG9jYWxFdWxlckFuZ2xlcyk7XG5cbiAgICAgICAgY2xvbmUucG9zaXRpb24uY29weSh0aGlzLnBvc2l0aW9uKTtcbiAgICAgICAgY2xvbmUucm90YXRpb24uY29weSh0aGlzLnJvdGF0aW9uKTtcbiAgICAgICAgY2xvbmUuZXVsZXJBbmdsZXMuY29weSh0aGlzLmV1bGVyQW5nbGVzKTtcblxuICAgICAgICBjbG9uZS5sb2NhbFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICBjbG9uZS5fZGlydHlMb2NhbCA9IHRoaXMuX2RpcnR5TG9jYWw7XG5cbiAgICAgICAgY2xvbmUud29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLndvcmxkVHJhbnNmb3JtKTtcbiAgICAgICAgY2xvbmUuX2RpcnR5V29ybGQgPSB0aGlzLl9kaXJ0eVdvcmxkO1xuICAgICAgICBjbG9uZS5fZGlydHlOb3JtYWwgPSB0aGlzLl9kaXJ0eU5vcm1hbDtcbiAgICAgICAgY2xvbmUuX2FhYmJWZXIgPSB0aGlzLl9hYWJiVmVyICsgMTtcblxuICAgICAgICBjbG9uZS5fZW5hYmxlZCA9IHRoaXMuX2VuYWJsZWQ7XG5cbiAgICAgICAgY2xvbmUuc2NhbGVDb21wZW5zYXRpb24gPSB0aGlzLnNjYWxlQ29tcGVuc2F0aW9uO1xuXG4gICAgICAgIC8vIGZhbHNlIGFzIHRoaXMgbm9kZSBpcyBub3QgaW4gdGhlIGhpZXJhcmNoeSB5ZXRcbiAgICAgICAgY2xvbmUuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGEgZ3JhcGggbm9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIGNsb25lIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICAgICAgICB0aGlzLl9jbG9uZUludGVybmFsKGNsb25lKTtcbiAgICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcHkgYSBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IHNvdXJjZSAtIFRoZSBncmFwaCBub2RlIHRvIGNvcHkuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZX0gVGhlIGRlc3RpbmF0aW9uIGdyYXBoIG5vZGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNvcHkoc291cmNlKSB7XG4gICAgICAgIHNvdXJjZS5fY2xvbmVJbnRlcm5hbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBEZXRhY2ggYSBHcmFwaE5vZGUgZnJvbSB0aGUgaGllcmFyY2h5IGFuZCByZWN1cnNpdmVseSBkZXN0cm95IGFsbCBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZmlyc3RDaGlsZCA9IHRoaXMuZW50aXR5LmNoaWxkcmVuWzBdO1xuICAgICAqIGZpcnN0Q2hpbGQuZGVzdHJveSgpOyAvLyBkZWxldGUgY2hpbGQsIGFsbCBjb21wb25lbnRzIGFuZCByZW1vdmUgZnJvbSBoaWVyYXJjaHlcbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBEZXRhY2ggZnJvbSBwYXJlbnRcbiAgICAgICAgdGhpcy5fcGFyZW50Py5yZW1vdmVDaGlsZCh0aGlzKTtcblxuICAgICAgICAvLyBSZWN1cnNpdmVseSBkZXN0cm95IGFsbCBjaGlsZHJlblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuICAgICAgICB3aGlsZSAoY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbGFzdCBjaGlsZCBmcm9tIHRoZSBhcnJheVxuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZHJlbi5wb3AoKTtcbiAgICAgICAgICAgIC8vIERpc2Nvbm5lY3QgaXQgZnJvbSB0aGUgcGFyZW50OiB0aGlzIGlzIG9ubHkgYW4gb3B0aW1pemF0aW9uIHN0ZXAsIHRvIHByZXZlbnQgY2FsbGluZ1xuICAgICAgICAgICAgLy8gR3JhcGhOb2RlI3JlbW92ZUNoaWxkIHdoaWNoIHdvdWxkIHRyeSB0byByZWZpbmQgaXQgdmlhIHRoaXMuX2NoaWxkcmVuLmluZGV4T2YgKHdoaWNoXG4gICAgICAgICAgICAvLyB3aWxsIGZhaWwsIGJlY2F1c2Ugd2UganVzdCByZW1vdmVkIGl0KS5cbiAgICAgICAgICAgIGNoaWxkLl9wYXJlbnQgPSBudWxsO1xuICAgICAgICAgICAgY2hpbGQuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmlyZSBkZXN0cm95IGV2ZW50XG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGNsZWFyIGFsbCBldmVudHNcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBub2RlcyB0aGF0IHNhdGlzZnkgc29tZSBzZWFyY2hcbiAgICAgKiBjcml0ZXJpYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmluZE5vZGVDYWxsYmFja3xzdHJpbmd9IGF0dHIgLSBUaGlzIGNhbiBlaXRoZXIgYmUgYSBmdW5jdGlvbiBvciBhIHN0cmluZy4gSWYgaXQncyBhXG4gICAgICogZnVuY3Rpb24sIGl0IGlzIGV4ZWN1dGVkIGZvciBlYWNoIGRlc2NlbmRhbnQgbm9kZSB0byB0ZXN0IGlmIG5vZGUgc2F0aXNmaWVzIHRoZSBzZWFyY2hcbiAgICAgKiBsb2dpYy4gUmV0dXJuaW5nIHRydWUgZnJvbSB0aGUgZnVuY3Rpb24gd2lsbCBpbmNsdWRlIHRoZSBub2RlIGludG8gdGhlIHJlc3VsdHMuIElmIGl0J3MgYVxuICAgICAqIHN0cmluZyB0aGVuIGl0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBmaWVsZCBvciBhIG1ldGhvZCBvZiB0aGUgbm9kZS4gSWYgdGhpcyBpcyB0aGUgbmFtZVxuICAgICAqIG9mIGEgZmllbGQgdGhlbiB0aGUgdmFsdWUgcGFzc2VkIGFzIHRoZSBzZWNvbmQgYXJndW1lbnQgd2lsbCBiZSBjaGVja2VkIGZvciBlcXVhbGl0eS4gSWZcbiAgICAgKiB0aGlzIGlzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gdGhlbiB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlIGNoZWNrZWQgZm9yXG4gICAgICogZXF1YWxpdHkgYWdhaW5zdCB0aGUgdmFsdWVkIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHRvIHRoaXMgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFt2YWx1ZV0gLSBJZiB0aGUgZmlyc3QgYXJndW1lbnQgKGF0dHIpIGlzIGEgcHJvcGVydHkgbmFtZSB0aGVuIHRoaXMgdmFsdWVcbiAgICAgKiB3aWxsIGJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtHcmFwaE5vZGVbXX0gVGhlIGFycmF5IG9mIGdyYXBoIG5vZGVzIHRoYXQgbWF0Y2ggdGhlIHNlYXJjaCBjcml0ZXJpYS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIGFsbCBub2RlcyB0aGF0IGhhdmUgYSBtb2RlbCBjb21wb25lbnQgYW5kIGhhdmUgJ2Rvb3InIGluIHRoZWlyIGxvd2VyLWNhc2VkIG5hbWVcbiAgICAgKiBjb25zdCBkb29ycyA9IGhvdXNlLmZpbmQoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgKiAgICAgcmV0dXJuIG5vZGUubW9kZWwgJiYgbm9kZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZG9vcicpICE9PSAtMTtcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEZpbmRzIGFsbCBub2RlcyB0aGF0IGhhdmUgdGhlIG5hbWUgcHJvcGVydHkgc2V0IHRvICdUZXN0J1xuICAgICAqIGNvbnN0IGVudGl0aWVzID0gcGFyZW50LmZpbmQoJ25hbWUnLCAnVGVzdCcpO1xuICAgICAqL1xuICAgIGZpbmQoYXR0ciwgdmFsdWUpIHtcbiAgICAgICAgbGV0IHJlc3VsdCwgcmVzdWx0cyA9IFtdO1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgY29uc3QgZm4gPSBhdHRyO1xuXG4gICAgICAgICAgICByZXN1bHQgPSBmbih0aGlzKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzY2VuZGFudHMgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kKGZuKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVzY2VuZGFudHMubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQoZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHRlc3RWYWx1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXNbYXR0cl0pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1thdHRyXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0VmFsdWUgPSB0aGlzW2F0dHJdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGVzdFZhbHVlID09PSB2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzY2VuZGFudHMgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kKGF0dHIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVzY2VuZGFudHMubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQoZGVzY2VuZGFudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBncmFwaCBub2RlIGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciB0aGUgZmlyc3Qgbm9kZSB0aGF0IHNhdGlzZmllcyBzb21lXG4gICAgICogc2VhcmNoIGNyaXRlcmlhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaW5kTm9kZUNhbGxiYWNrfHN0cmluZ30gYXR0ciAtIFRoaXMgY2FuIGVpdGhlciBiZSBhIGZ1bmN0aW9uIG9yIGEgc3RyaW5nLiBJZiBpdCdzIGFcbiAgICAgKiBmdW5jdGlvbiwgaXQgaXMgZXhlY3V0ZWQgZm9yIGVhY2ggZGVzY2VuZGFudCBub2RlIHRvIHRlc3QgaWYgbm9kZSBzYXRpc2ZpZXMgdGhlIHNlYXJjaFxuICAgICAqIGxvZ2ljLiBSZXR1cm5pbmcgdHJ1ZSBmcm9tIHRoZSBmdW5jdGlvbiB3aWxsIHJlc3VsdCBpbiB0aGF0IG5vZGUgYmVpbmcgcmV0dXJuZWQgZnJvbVxuICAgICAqIGZpbmRPbmUuIElmIGl0J3MgYSBzdHJpbmcgdGhlbiBpdCByZXByZXNlbnRzIHRoZSBuYW1lIG9mIGEgZmllbGQgb3IgYSBtZXRob2Qgb2YgdGhlIG5vZGUuIElmXG4gICAgICogdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZpZWxkIHRoZW4gdGhlIHZhbHVlIHBhc3NlZCBhcyB0aGUgc2Vjb25kIGFyZ3VtZW50IHdpbGwgYmUgY2hlY2tlZCBmb3JcbiAgICAgKiBlcXVhbGl0eS4gSWYgdGhpcyBpcyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIHRoZW4gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZVxuICAgICAqIGNoZWNrZWQgZm9yIGVxdWFsaXR5IGFnYWluc3QgdGhlIHZhbHVlZCBwYXNzZWQgYXMgdGhlIHNlY29uZCBhcmd1bWVudCB0byB0aGlzIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdmFsdWVdIC0gSWYgdGhlIGZpcnN0IGFyZ3VtZW50IChhdHRyKSBpcyBhIHByb3BlcnR5IG5hbWUgdGhlbiB0aGlzIHZhbHVlXG4gICAgICogd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IEEgZ3JhcGggbm9kZSB0aGF0IG1hdGNoIHRoZSBzZWFyY2ggY3JpdGVyaWEuIFJldHVybnMgbnVsbCBpZiBub1xuICAgICAqIG5vZGUgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBGaW5kIHRoZSBmaXJzdCBub2RlIHRoYXQgaXMgY2FsbGVkICdoZWFkJyBhbmQgaGFzIGEgbW9kZWwgY29tcG9uZW50XG4gICAgICogY29uc3QgaGVhZCA9IHBsYXllci5maW5kT25lKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIHJldHVybiBub2RlLm1vZGVsICYmIG5vZGUubmFtZSA9PT0gJ2hlYWQnO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRmluZHMgdGhlIGZpcnN0IG5vZGUgdGhhdCBoYXMgdGhlIG5hbWUgcHJvcGVydHkgc2V0IHRvICdUZXN0J1xuICAgICAqIGNvbnN0IG5vZGUgPSBwYXJlbnQuZmluZE9uZSgnbmFtZScsICdUZXN0Jyk7XG4gICAgICovXG4gICAgZmluZE9uZShhdHRyLCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIGlmIChhdHRyIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGZuID0gYXR0cjtcblxuICAgICAgICAgICAgcmVzdWx0ID0gZm4odGhpcyk7XG4gICAgICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZE9uZShmbik7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB0ZXN0VmFsdWU7XG4gICAgICAgICAgICBpZiAodGhpc1thdHRyXSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2F0dHJdIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdFZhbHVlID0gdGhpc1thdHRyXSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3RWYWx1ZSA9IHRoaXNbYXR0cl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0ZXN0VmFsdWUgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRPbmUoYXR0ciwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIGdyYXBoIG5vZGVzIHRoYXQgc2F0aXNmeSB0aGUgc2VhcmNoIHF1ZXJ5LiBRdWVyeSBjYW4gYmUgc2ltcGx5IGEgc3RyaW5nLCBvciBjb21tYVxuICAgICAqIHNlcGFyYXRlZCBzdHJpbmdzLCB0byBoYXZlIGluY2x1c2l2ZSByZXN1bHRzIG9mIGFzc2V0cyB0aGF0IG1hdGNoIGF0IGxlYXN0IG9uZSBxdWVyeS4gQVxuICAgICAqIHF1ZXJ5IHRoYXQgY29uc2lzdHMgb2YgYW4gYXJyYXkgb2YgdGFncyBjYW4gYmUgdXNlZCB0byBtYXRjaCBncmFwaCBub2RlcyB0aGF0IGhhdmUgZWFjaCB0YWdcbiAgICAgKiBvZiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Li4uKn0gcXVlcnkgLSBOYW1lIG9mIGEgdGFnIG9yIGFycmF5IG9mIHRhZ3MuXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZVtdfSBBIGxpc3Qgb2YgYWxsIGdyYXBoIG5vZGVzIHRoYXQgbWF0Y2ggdGhlIHF1ZXJ5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBncmFwaCBub2RlcyB0aGF0IHRhZ2dlZCBieSBgYW5pbWFsYFxuICAgICAqIGNvbnN0IGFuaW1hbHMgPSBub2RlLmZpbmRCeVRhZyhcImFuaW1hbFwiKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgZ3JhcGggbm9kZXMgdGhhdCB0YWdnZWQgYnkgYGJpcmRgIE9SIGBtYW1tYWxgXG4gICAgICogY29uc3QgYmlyZHNBbmRNYW1tYWxzID0gbm9kZS5maW5kQnlUYWcoXCJiaXJkXCIsIFwibWFtbWFsXCIpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgXG4gICAgICogY29uc3QgbWVhdEVhdGluZ01hbW1hbHMgPSBub2RlLmZpbmRCeVRhZyhbXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIl0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgKGBjYXJuaXZvcmVgIEFORCBgbWFtbWFsYCkgT1IgKGBjYXJuaXZvcmVgIEFORCBgcmVwdGlsZWApXG4gICAgICogY29uc3QgbWVhdEVhdGluZ01hbW1hbHNBbmRSZXB0aWxlcyA9IG5vZGUuZmluZEJ5VGFnKFtcImNhcm5pdm9yZVwiLCBcIm1hbW1hbFwiXSwgW1wiY2Fybml2b3JlXCIsIFwicmVwdGlsZVwiXSk7XG4gICAgICovXG4gICAgZmluZEJ5VGFnKCkge1xuICAgICAgICBjb25zdCBxdWVyeSA9IGFyZ3VtZW50cztcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGNvbnN0IHF1ZXJ5Tm9kZSA9IChub2RlLCBjaGVja05vZGUpID0+IHtcbiAgICAgICAgICAgIGlmIChjaGVja05vZGUgJiYgbm9kZS50YWdzLmhhcyguLi5xdWVyeSkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBxdWVyeU5vZGUobm9kZS5fY2hpbGRyZW5baV0sIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHF1ZXJ5Tm9kZSh0aGlzLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBmaXJzdCBub2RlIGZvdW5kIGluIHRoZSBncmFwaCB3aXRoIHRoZSBuYW1lLiBUaGUgc2VhcmNoIGlzIGRlcHRoIGZpcnN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZ3JhcGguXG4gICAgICogQHJldHVybnMge0dyYXBoTm9kZXxudWxsfSBUaGUgZmlyc3Qgbm9kZSB0byBiZSBmb3VuZCBtYXRjaGluZyB0aGUgc3VwcGxpZWQgbmFtZS4gUmV0dXJuc1xuICAgICAqIG51bGwgaWYgbm8gbm9kZSBpcyBmb3VuZC5cbiAgICAgKi9cbiAgICBmaW5kQnlOYW1lKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMubmFtZSA9PT0gbmFtZSkgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kQnlOYW1lKG5hbWUpO1xuICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBmaXJzdCBub2RlIGZvdW5kIGluIHRoZSBncmFwaCBieSBpdHMgZnVsbCBwYXRoIGluIHRoZSBncmFwaC4gVGhlIGZ1bGwgcGF0aCBoYXMgdGhpc1xuICAgICAqIGZvcm0gJ3BhcmVudC9jaGlsZC9zdWItY2hpbGQnLiBUaGUgc2VhcmNoIGlzIGRlcHRoIGZpcnN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IHBhdGggLSBUaGUgZnVsbCBwYXRoIG9mIHRoZSB7QGxpbmsgR3JhcGhOb2RlfSBhcyBlaXRoZXIgYSBzdHJpbmcgb3JcbiAgICAgKiBhcnJheSBvZiB7QGxpbmsgR3JhcGhOb2RlfSBuYW1lcy5cbiAgICAgKiBAcmV0dXJucyB7R3JhcGhOb2RlfG51bGx9IFRoZSBmaXJzdCBub2RlIHRvIGJlIGZvdW5kIG1hdGNoaW5nIHRoZSBzdXBwbGllZCBwYXRoLiBSZXR1cm5zXG4gICAgICogbnVsbCBpZiBubyBub2RlIGlzIGZvdW5kLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU3RyaW5nIGZvcm1cbiAgICAgKiBjb25zdCBncmFuZGNoaWxkID0gdGhpcy5lbnRpdHkuZmluZEJ5UGF0aCgnY2hpbGQvZ3JhbmRjaGlsZCcpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXJyYXkgZm9ybVxuICAgICAqIGNvbnN0IGdyYW5kY2hpbGQgPSB0aGlzLmVudGl0eS5maW5kQnlQYXRoKFsnY2hpbGQnLCAnZ3JhbmRjaGlsZCddKTtcbiAgICAgKi9cbiAgICBmaW5kQnlQYXRoKHBhdGgpIHtcbiAgICAgICAgLy8gYWNjZXB0IGVpdGhlciBzdHJpbmcgcGF0aCB3aXRoICcvJyBzZXBhcmF0b3JzIG9yIGFycmF5IG9mIHBhcnRzLlxuICAgICAgICBjb25zdCBwYXJ0cyA9IEFycmF5LmlzQXJyYXkocGF0aCkgPyBwYXRoIDogcGF0aC5zcGxpdCgnLycpO1xuXG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgaW1heCA9IHBhcnRzLmxlbmd0aDsgaSA8IGltYXg7ICsraSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LmNoaWxkcmVuLmZpbmQoYyA9PiBjLm5hbWUgPT09IHBhcnRzW2ldKTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGVzIGEgcHJvdmlkZWQgZnVuY3Rpb24gb25jZSBvbiB0aGlzIGdyYXBoIG5vZGUgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZvckVhY2hOb2RlQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGZ1bmN0aW9uIHRvIGV4ZWN1dGUgb24gdGhlIGdyYXBoIG5vZGUgYW5kIGVhY2hcbiAgICAgKiBkZXNjZW5kYW50LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbdGhpc0FyZ10gLSBPcHRpb25hbCB2YWx1ZSB0byB1c2UgYXMgdGhpcyB3aGVuIGV4ZWN1dGluZyBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvZyB0aGUgcGF0aCBhbmQgbmFtZSBvZiBlYWNoIG5vZGUgaW4gZGVzY2VuZGFudCB0cmVlIHN0YXJ0aW5nIHdpdGggXCJwYXJlbnRcIlxuICAgICAqIHBhcmVudC5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKG5vZGUucGF0aCArIFwiL1wiICsgbm9kZS5uYW1lKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBmb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdGhpcyk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2hpbGRyZW5baV0uZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBub2RlIGlzIGRlc2NlbmRhbnQgb2YgYW5vdGhlciBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBQb3RlbnRpYWwgYW5jZXN0b3Igb2Ygbm9kZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgbm9kZSBpcyBkZXNjZW5kYW50IG9mIGFub3RoZXIgbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChyb29mLmlzRGVzY2VuZGFudE9mKGhvdXNlKSkge1xuICAgICAqICAgICAvLyByb29mIGlzIGRlc2NlbmRhbnQgb2YgaG91c2UgZW50aXR5XG4gICAgICogfVxuICAgICAqL1xuICAgIGlzRGVzY2VuZGFudE9mKG5vZGUpIHtcbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHBhcmVudCA9PT0gbm9kZSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50Ll9wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIG5vZGUgaXMgYW5jZXN0b3IgZm9yIGFub3RoZXIgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gUG90ZW50aWFsIGRlc2NlbmRhbnQgb2Ygbm9kZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgbm9kZSBpcyBhbmNlc3RvciBmb3IgYW5vdGhlciBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGJvZHkuaXNBbmNlc3Rvck9mKGZvb3QpKSB7XG4gICAgICogICAgIC8vIGZvb3QgaXMgd2l0aGluIGJvZHkncyBoaWVyYXJjaHlcbiAgICAgKiB9XG4gICAgICovXG4gICAgaXNBbmNlc3Rvck9mKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUuaXNEZXNjZW5kYW50T2YodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUgaW4gRXVsZXIgYW5nbGUgZm9ybS4gVGhlIHJvdGF0aW9uXG4gICAgICogaXMgcmV0dXJuZWQgYXMgZXVsZXIgYW5nbGVzIGluIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmVcbiAgICAgKiBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXIgdG8gc2V0IHRoZSB3b3JsZC1zcGFjZSByb3RhdGlvbiBvZiB0aGUgZ3JhcGggbm9kZSwgdXNlXG4gICAgICoge0BsaW5rIEdyYXBoTm9kZSNzZXRFdWxlckFuZ2xlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGluIEV1bGVyIGFuZ2xlIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRFdWxlckFuZ2xlcygpO1xuICAgICAqIGFuZ2xlcy55ID0gMTgwOyAvLyByb3RhdGUgdGhlIGVudGl0eSBhcm91bmQgWSBieSAxODAgZGVncmVlc1xuICAgICAqIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFuZ2xlcyk7XG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKS5nZXRFdWxlckFuZ2xlcyh0aGlzLmV1bGVyQW5nbGVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXVsZXJBbmdsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSByb3RhdGlvbiBpbiBsb2NhbCBzcGFjZSBmb3IgdGhlIHNwZWNpZmllZCBHcmFwaE5vZGUuIFRoZSByb3RhdGlvbiBpcyByZXR1cm5lZCBhc1xuICAgICAqIGV1bGVyIGFuZ2xlcyBpbiBhIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvXG4gICAgICogdXBkYXRlIHRoZSBsb2NhbCByb3RhdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxFdWxlckFuZ2xlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGV1bGVyIGFuZ2xlcyBpbiBYWVogb3JkZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhbmdsZXMgPSB0aGlzLmVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogYW5nbGVzLnkgPSAxODA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIGdldExvY2FsRXVsZXJBbmdsZXMoKSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5nZXRFdWxlckFuZ2xlcyh0aGlzLmxvY2FsRXVsZXJBbmdsZXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbEV1bGVyQW5nbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcG9zaXRpb24gaW4gbG9jYWwgc3BhY2UgZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHJldHVybmVkIHZlY3RvciBzaG91bGQgYmUgY29uc2lkZXJlZCByZWFkLW9ubHkuIFRvIHVwZGF0ZSB0aGUgbG9jYWxcbiAgICAgKiBwb3NpdGlvbiwgdXNlIHtAbGluayBHcmFwaE5vZGUjc2V0TG9jYWxQb3NpdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGxvY2FsIHNwYWNlIHBvc2l0aW9uIG9mIHRoZSBncmFwaCBub2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcG9zaXRpb24gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICogcG9zaXRpb24ueCArPSAxOyAvLyBtb3ZlIHRoZSBlbnRpdHkgMSB1bml0IGFsb25nIHguXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICovXG4gICAgZ2V0TG9jYWxQb3NpdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgUXVhdH0uIFRoZSByZXR1cm5lZCBxdWF0ZXJuaW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gVG8gdXBkYXRlIHRoZSBsb2NhbFxuICAgICAqIHJvdGF0aW9uLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRMb2NhbFJvdGF0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgbG9jYWwgc3BhY2Ugcm90YXRpb24gb2YgdGhlIGdyYXBoIG5vZGUgYXMgYSBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgcm90YXRpb24gPSB0aGlzLmVudGl0eS5nZXRMb2NhbFJvdGF0aW9uKCk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxSb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHNjYWxlIGluIGxvY2FsIHNwYWNlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHNjYWxlIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgVmVjM30uIFRoZSByZXR1cm5lZCB2ZWN0b3Igc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBUbyB1cGRhdGUgdGhlIGxvY2FsIHNjYWxlLFxuICAgICAqIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldExvY2FsU2NhbGV9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBsb2NhbCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpO1xuICAgICAqIHNjYWxlLnggPSAxMDA7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxTY2FsZShzY2FsZSk7XG4gICAgICovXG4gICAgZ2V0TG9jYWxTY2FsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9jYWxTY2FsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGxvY2FsIHRyYW5zZm9ybSBtYXRyaXggZm9yIHRoaXMgZ3JhcGggbm9kZS4gVGhpcyBtYXRyaXggaXMgdGhlIHRyYW5zZm9ybSByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBub2RlJ3MgcGFyZW50J3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3MgbG9jYWwgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdHJhbnNmb3JtID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxUcmFuc2Zvcm0oKTtcbiAgICAgKi9cbiAgICBnZXRMb2NhbFRyYW5zZm9ybSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMubG9jYWxQb3NpdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uLCB0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgcG9zaXRpb24gZm9yIHRoZSBzcGVjaWZpZWQgR3JhcGhOb2RlLiBUaGUgcG9zaXRpb24gaXMgcmV0dXJuZWQgYXMgYVxuICAgICAqIHtAbGluayBWZWMzfS4gVGhlIHZhbHVlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNvbnNpZGVyZWQgcmVhZC1vbmx5LiBJbiBvcmRlclxuICAgICAqIHRvIHNldCB0aGUgd29ybGQtc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUsIHVzZSB7QGxpbmsgR3JhcGhOb2RlI3NldFBvc2l0aW9ufS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgdGhlIGdyYXBoIG5vZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBwb3NpdGlvbiA9IHRoaXMuZW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogcG9zaXRpb24ueCA9IDEwO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBnZXRQb3NpdGlvbigpIHtcbiAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFRyYW5zbGF0aW9uKHRoaXMucG9zaXRpb24pO1xuICAgICAgICByZXR1cm4gdGhpcy5wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJvdGF0aW9uIGlzIHJldHVybmVkIGFzIGFcbiAgICAgKiB7QGxpbmsgUXVhdH0uIFRoZSB2YWx1ZSByZXR1cm5lZCBieSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjb25zaWRlcmVkIHJlYWQtb25seS4gSW4gb3JkZXJcbiAgICAgKiB0byBzZXQgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlLCB1c2Uge0BsaW5rIEdyYXBoTm9kZSNzZXRSb3RhdGlvbn0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIHRoZSBncmFwaCBub2RlIGFzIGEgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvdGF0aW9uID0gdGhpcy5lbnRpdHkuZ2V0Um90YXRpb24oKTtcbiAgICAgKi9cbiAgICBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgdGhpcy5yb3RhdGlvbi5zZXRGcm9tTWF0NCh0aGlzLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gdGhpcy5yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIGZvciB0aGUgc3BlY2lmaWVkIEdyYXBoTm9kZS4gVGhlIHJldHVybmVkIHZhbHVlIHdpbGwgb25seSBiZVxuICAgICAqIGNvcnJlY3QgZm9yIGdyYXBoIG5vZGVzIHRoYXQgaGF2ZSBhIG5vbi1za2V3ZWQgd29ybGQgdHJhbnNmb3JtIChhIHNrZXcgY2FuIGJlIGludHJvZHVjZWQgYnlcbiAgICAgKiB0aGUgY29tcG91bmRpbmcgb2Ygcm90YXRpb25zIGFuZCBzY2FsZXMgaGlnaGVyIGluIHRoZSBncmFwaCBub2RlIGhpZXJhcmNoeSkuIFRoZSBzY2FsZSBpc1xuICAgICAqIHJldHVybmVkIGFzIGEge0BsaW5rIFZlYzN9LiBUaGUgdmFsdWUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY29uc2lkZXJlZFxuICAgICAqIHJlYWQtb25seS4gTm90ZSB0aGF0IGl0IGlzIG5vdCBwb3NzaWJsZSB0byBzZXQgdGhlIHdvcmxkIHNwYWNlIHNjYWxlIG9mIGEgZ3JhcGggbm9kZVxuICAgICAqIGRpcmVjdGx5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBzY2FsZSBvZiB0aGUgZ3JhcGggbm9kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjYWxlID0gdGhpcy5lbnRpdHkuZ2V0U2NhbGUoKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0U2NhbGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2NhbGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NjYWxlID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLmdldFNjYWxlKHRoaXMuX3NjYWxlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBmb3IgdGhpcyBncmFwaCBub2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFRoZSBub2RlJ3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdHJhbnNmb3JtID0gdGhpcy5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgKi9cbiAgICBnZXRXb3JsZFRyYW5zZm9ybSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsICYmICF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMud29ybGRUcmFuc2Zvcm07XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudClcbiAgICAgICAgICAgIHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIHRoaXMuX3N5bmMoKTtcblxuICAgICAgICByZXR1cm4gdGhpcy53b3JsZFRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGNhY2hlZCB2YWx1ZSBvZiBuZWdhdGl2ZSBzY2FsZSBvZiB0aGUgd29ybGQgdHJhbnNmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gLTEgaWYgd29ybGQgdHJhbnNmb3JtIGhhcyBuZWdhdGl2ZSBzY2FsZSwgMSBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB3b3JsZFNjYWxlU2lnbigpIHtcblxuICAgICAgICBpZiAodGhpcy5fd29ybGRTY2FsZVNpZ24gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3dvcmxkU2NhbGVTaWduID0gdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpLnNjYWxlU2lnbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl93b3JsZFNjYWxlU2lnbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZ3JhcGggbm9kZSBmcm9tIGN1cnJlbnQgcGFyZW50IGFuZCBhZGQgYXMgY2hpbGQgdG8gbmV3IHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBwYXJlbnQgLSBOZXcgcGFyZW50IHRvIGF0dGFjaCBncmFwaCBub2RlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaW5kZXhdIC0gVGhlIGNoaWxkIGluZGV4IHdoZXJlIHRoZSBjaGlsZCBub2RlIHNob3VsZCBiZSBwbGFjZWQuXG4gICAgICovXG4gICAgcmVwYXJlbnQocGFyZW50LCBpbmRleCkge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fcGFyZW50O1xuXG4gICAgICAgIGlmIChjdXJyZW50KVxuICAgICAgICAgICAgY3VycmVudC5yZW1vdmVDaGlsZCh0aGlzKTtcblxuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5pbnNlcnRDaGlsZCh0aGlzLCBpbmRleCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhcmVudC5hZGRDaGlsZCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZSB1c2luZyBldWxlciBhbmdsZXMuIEV1bGVycyBhcmVcbiAgICAgKiBpbnRlcnByZXRlZCBpbiBYWVogb3JkZXIuIEV1bGVycyBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSBsb2NhbC1zcGFjZSBldWxlclxuICAgICAqIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgZXVsZXJzIG9yIHJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZVxuICAgICAqIHgtYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBSb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2UgeS1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB6LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByb3RhdGlvbiBvZiA5MCBkZWdyZWVzIGFyb3VuZCB5LWF4aXMgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHktYXhpcyB2aWEgYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyhhbmdsZXMpO1xuICAgICAqL1xuICAgIHNldExvY2FsRXVsZXJBbmdsZXMoeCwgeSwgeikge1xuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24uc2V0RnJvbUV1bGVyQW5nbGVzKHgsIHksIHopO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIDNEIHZlY3RvciBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIGxvY2FsLXNwYWNlIHBvc2l0aW9uIG9yXG4gICAgICogeC1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFotY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHBvcyA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHBvcyk7XG4gICAgICovXG4gICAgc2V0TG9jYWxQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbG9jYWwtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgcXVhdGVybmlvbiBvciAzIG51bWJlcnMgdG8gc3BlY2lmeSB0aGUgbG9jYWwtc3BhY2VcbiAgICAgKiByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdHxudW1iZXJ9IHggLSBRdWF0ZXJuaW9uIGhvbGRpbmcgbG9jYWwtc3BhY2Ugcm90YXRpb24gb3IgeC1jb21wb25lbnQgb2ZcbiAgICAgKiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBZLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd10gLSBXLWNvbXBvbmVudCBvZiBsb2NhbC1zcGFjZSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSA0IG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFJvdGF0aW9uKDAsIDAsIDAsIDEpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSBxdWF0ZXJuaW9uXG4gICAgICogY29uc3QgcSA9IHBjLlF1YXQoKTtcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFJvdGF0aW9uKHEpO1xuICAgICAqL1xuICAgIHNldExvY2FsUm90YXRpb24oeCwgeSwgeiwgdykge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFF1YXQpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLnNldCh4LCB5LCB6LCB3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGxvY2FsLXNwYWNlIHNjYWxlIGZhY3RvciBvZiB0aGUgc3BlY2lmaWVkIGdyYXBoIG5vZGUuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2Ugc2NhbGUgb3IgeC1jb29yZGluYXRlXG4gICAgICogb2YgbG9jYWwtc3BhY2Ugc2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHNjYWxlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRMb2NhbFNjYWxlKDEwLCAxMCwgMTApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBzY2FsZSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldExvY2FsU2NhbGUoc2NhbGUpO1xuICAgICAqL1xuICAgIHNldExvY2FsU2NhbGUoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTY2FsZS5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFNjYWxlLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kaXJ0aWZ5TG9jYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IHRydWU7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2RpcnR5V29ybGQpXG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdW5mcmVlemVQYXJlbnRUb1Jvb3QoKSB7XG4gICAgICAgIGxldCBwID0gdGhpcy5fcGFyZW50O1xuICAgICAgICB3aGlsZSAocCkge1xuICAgICAgICAgICAgcC5fZnJvemVuID0gZmFsc2U7XG4gICAgICAgICAgICBwID0gcC5fcGFyZW50O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RpcnRpZnlXb3JsZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgdGhpcy5fdW5mcmVlemVQYXJlbnRUb1Jvb3QoKTtcbiAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkSW50ZXJuYWwoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZGlydGlmeVdvcmxkSW50ZXJuYWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgdGhpcy5fZnJvemVuID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVdvcmxkID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NoaWxkcmVuW2ldLl9kaXJ0eVdvcmxkKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fZGlydGlmeVdvcmxkSW50ZXJuYWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kaXJ0eU5vcm1hbCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkU2NhbGVTaWduID0gMDsgICAvLyB3b3JsZCBtYXRyaXggaXMgZGlydHksIG1hcmsgdGhpcyBmbGFnIGRpcnR5IHRvb1xuICAgICAgICB0aGlzLl9hYWJiVmVyKys7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZSB3b3JsZC1zcGFjZVxuICAgICAqIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2UgcG9zaXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSBwb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHBvc2l0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbigwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKi9cbiAgICBzZXRQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuX3BhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpKS5pbnZlcnQoKTtcbiAgICAgICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgZ3JhcGggbm9kZS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlczogeW91IGNhbiBlaXRoZXIgcGFzcyBhIHF1YXRlcm5pb24gb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR8bnVtYmVyfSB4IC0gUXVhdGVybmlvbiBob2xkaW5nIHdvcmxkLXNwYWNlIHJvdGF0aW9uIG9yIHgtY29tcG9uZW50IG9mXG4gICAgICogd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVy1jb21wb25lbnQgb2Ygd29ybGQtc3BhY2UgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCB2aWEgNCBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0Um90YXRpb24oMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgdmlhIHF1YXRlcm5pb25cbiAgICAgKiBjb25zdCBxID0gcGMuUXVhdCgpO1xuICAgICAqIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKHEpO1xuICAgICAqL1xuICAgIHNldFJvdGF0aW9uKHgsIHksIHosIHcpIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICByb3RhdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm90YXRpb24uc2V0KHgsIHksIHosIHcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkocm90YXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLmNvcHkoaW52UGFyZW50Um90KS5tdWwocm90YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd29ybGQtc3BhY2Ugcm90YXRpb24gb2YgdGhlIHNwZWNpZmllZCBncmFwaCBub2RlIHVzaW5nIGV1bGVyIGFuZ2xlcy4gRXVsZXJzIGFyZVxuICAgICAqIGludGVycHJldGVkIGluIFhZWiBvcmRlci4gRXVsZXJzIG11c3QgYmUgc3BlY2lmaWVkIGluIGRlZ3JlZXMuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlIGV1bGVyXG4gICAgICogcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyBldWxlcnMgb3Igcm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlXG4gICAgICogeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyB2aWEgMyBudW1iZXJzXG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJvdGF0aW9uIG9mIDkwIGRlZ3JlZXMgYXJvdW5kIHdvcmxkLXNwYWNlIHktYXhpcyB2aWEgYSB2ZWN0b3JcbiAgICAgKiBjb25zdCBhbmdsZXMgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYW5nbGVzKTtcbiAgICAgKi9cbiAgICBzZXRFdWxlckFuZ2xlcyh4LCB5LCB6KSB7XG4gICAgICAgIHRoaXMubG9jYWxSb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50Um90ID0gdGhpcy5fcGFyZW50LmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBpbnZQYXJlbnRSb3QuY29weShwYXJlbnRSb3QpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIoaW52UGFyZW50Um90LCB0aGlzLmxvY2FsUm90YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgbmV3IGNoaWxkIHRvIHRoZSBjaGlsZCBsaXN0IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZiB0aGUgY2hpbGQgbm9kZS5cbiAgICAgKiBJZiB0aGUgbm9kZSBhbHJlYWR5IGhhZCBhIHBhcmVudCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGl0cyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbmV3IGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGQoZSk7XG4gICAgICovXG4gICAgYWRkQ2hpbGQobm9kZSkge1xuICAgICAgICB0aGlzLl9wcmVwYXJlSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgY2hpbGQgdG8gdGhpcyBub2RlLCBtYWludGFpbmluZyB0aGUgY2hpbGQncyB0cmFuc2Zvcm0gaW4gd29ybGQgc3BhY2UuXG4gICAgICogSWYgdGhlIG5vZGUgYWxyZWFkeSBoYWQgYSBwYXJlbnQsIGl0IGlzIHJlbW92ZWQgZnJvbSBpdHMgY2hpbGQgbGlzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIGNoaWxkIHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGUgPSBuZXcgcGMuRW50aXR5KGFwcCk7XG4gICAgICogdGhpcy5lbnRpdHkuYWRkQ2hpbGRBbmRTYXZlVHJhbnNmb3JtKGUpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0obm9kZSkge1xuXG4gICAgICAgIGNvbnN0IHdQb3MgPSBub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgIGNvbnN0IHdSb3QgPSBub2RlLmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuXG4gICAgICAgIG5vZGUuc2V0UG9zaXRpb24odG1wTWF0NC5jb3B5KHRoaXMud29ybGRUcmFuc2Zvcm0pLmludmVydCgpLnRyYW5zZm9ybVBvaW50KHdQb3MpKTtcbiAgICAgICAgbm9kZS5zZXRSb3RhdGlvbih0bXBRdWF0LmNvcHkodGhpcy5nZXRSb3RhdGlvbigpKS5pbnZlcnQoKS5tdWwod1JvdCkpO1xuXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX29uSW5zZXJ0Q2hpbGQobm9kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGEgbmV3IGNoaWxkIHRvIHRoZSBjaGlsZCBsaXN0IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggYW5kIHVwZGF0ZSB0aGUgcGFyZW50IHZhbHVlIG9mXG4gICAgICogdGhlIGNoaWxkIG5vZGUuIElmIHRoZSBub2RlIGFscmVhZHkgaGFkIGEgcGFyZW50LCBpdCBpcyByZW1vdmVkIGZyb20gaXRzIGNoaWxkIGxpc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gbm9kZSAtIFRoZSBuZXcgY2hpbGQgdG8gaW5zZXJ0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBpbiB0aGUgY2hpbGQgbGlzdCBvZiB0aGUgcGFyZW50IHdoZXJlIHRoZSBuZXcgbm9kZSB3aWxsIGJlXG4gICAgICogaW5zZXJ0ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBlID0gbmV3IHBjLkVudGl0eShhcHApO1xuICAgICAqIHRoaXMuZW50aXR5Lmluc2VydENoaWxkKGUsIDEpO1xuICAgICAqL1xuICAgIGluc2VydENoaWxkKG5vZGUsIGluZGV4KSB7XG5cbiAgICAgICAgdGhpcy5fcHJlcGFyZUluc2VydENoaWxkKG5vZGUpO1xuICAgICAgICB0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDAsIG5vZGUpO1xuICAgICAgICB0aGlzLl9vbkluc2VydENoaWxkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByZXBhcmVzIG5vZGUgZm9yIGJlaW5nIGluc2VydGVkIHRvIGEgcGFyZW50IG5vZGUsIGFuZCByZW1vdmVzIGl0IGZyb20gdGhlIHByZXZpb3VzIHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5vZGUgYmVpbmcgaW5zZXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcHJlcGFyZUluc2VydENoaWxkKG5vZGUpIHtcblxuICAgICAgICAvLyByZW1vdmUgaXQgZnJvbSB0aGUgZXhpc3RpbmcgcGFyZW50XG4gICAgICAgIGlmIChub2RlLl9wYXJlbnQpIHtcbiAgICAgICAgICAgIG5vZGUuX3BhcmVudC5yZW1vdmVDaGlsZChub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLmFzc2VydChub2RlICE9PSB0aGlzLCBgR3JhcGhOb2RlICR7bm9kZT8ubmFtZX0gY2Fubm90IGJlIGEgY2hpbGQgb2YgaXRzZWxmYCk7XG4gICAgICAgIERlYnVnLmFzc2VydCghdGhpcy5pc0Rlc2NlbmRhbnRPZihub2RlKSwgYEdyYXBoTm9kZSAke25vZGU/Lm5hbWV9IGNhbm5vdCBhZGQgYW4gYW5jZXN0b3IgYXMgYSBjaGlsZGApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVzIGFuIGV2ZW50IG9uIGFsbCBjaGlsZHJlbiBvZiB0aGUgbm9kZS4gVGhlIGV2ZW50IGBuYW1lYCBpcyBmaXJlZCBvbiB0aGUgZmlyc3QgKHJvb3QpXG4gICAgICogbm9kZSBvbmx5LiBUaGUgZXZlbnQgYG5hbWVIaWVyYXJjaHlgIGlzIGZpcmVkIGZvciBhbGwgY2hpbGRyZW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0byBmaXJlIG9uIHRoZSByb290LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lSGllcmFyY2h5IC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIGZpcmUgZm9yIGFsbCBkZXNjZW5kYW50cy5cbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gcGFyZW50IC0gVGhlIHBhcmVudCBvZiB0aGUgbm9kZSBiZWluZyBhZGRlZC9yZW1vdmVkIGZyb20gdGhlIGhpZXJhcmNoeS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9maXJlT25IaWVyYXJjaHkobmFtZSwgbmFtZUhpZXJhcmNoeSwgcGFyZW50KSB7XG4gICAgICAgIHRoaXMuZmlyZShuYW1lLCBwYXJlbnQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jaGlsZHJlbltpXS5fZmlyZU9uSGllcmFyY2h5KG5hbWVIaWVyYXJjaHksIG5hbWVIaWVyYXJjaHksIHBhcmVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiBhIG5vZGUgaXMgaW5zZXJ0ZWQgaW50byBhIG5vZGUncyBjaGlsZCBsaXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbm9kZSB0aGF0IHdhcyBpbnNlcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkluc2VydENoaWxkKG5vZGUpIHtcbiAgICAgICAgbm9kZS5fcGFyZW50ID0gdGhpcztcblxuICAgICAgICAvLyB0aGUgY2hpbGQgbm9kZSBzaG91bGQgYmUgZW5hYmxlZCBpbiB0aGUgaGllcmFyY2h5IG9ubHkgaWYgaXRzZWxmIGlzIGVuYWJsZWQgYW5kIGlmXG4gICAgICAgIC8vIHRoaXMgcGFyZW50IGlzIGVuYWJsZWRcbiAgICAgICAgY29uc3QgZW5hYmxlZEluSGllcmFyY2h5ID0gKG5vZGUuX2VuYWJsZWQgJiYgdGhpcy5lbmFibGVkKTtcbiAgICAgICAgaWYgKG5vZGUuX2VuYWJsZWRJbkhpZXJhcmNoeSAhPT0gZW5hYmxlZEluSGllcmFyY2h5KSB7XG4gICAgICAgICAgICBub2RlLl9lbmFibGVkSW5IaWVyYXJjaHkgPSBlbmFibGVkSW5IaWVyYXJjaHk7XG5cbiAgICAgICAgICAgIC8vIHByb3BhZ2F0ZSB0aGUgY2hhbmdlIHRvIHRoZSBjaGlsZHJlbiAtIG5lY2Vzc2FyeSBpZiB3ZSByZXBhcmVudCBhIG5vZGVcbiAgICAgICAgICAgIC8vIHVuZGVyIGEgcGFyZW50IHdpdGggYSBkaWZmZXJlbnQgZW5hYmxlZCBzdGF0ZSAoaWYgd2UgcmVwYXJlbnQgYSBub2RlIHRoYXQgaXNcbiAgICAgICAgICAgIC8vIG5vdCBhY3RpdmUgaW4gdGhlIGhpZXJhcmNoeSB1bmRlciBhIHBhcmVudCB3aG8gaXMgYWN0aXZlIGluIHRoZSBoaWVyYXJjaHkgdGhlblxuICAgICAgICAgICAgLy8gd2Ugd2FudCBvdXIgbm9kZSB0byBiZSBhY3RpdmF0ZWQpXG4gICAgICAgICAgICBub2RlLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQobm9kZSwgZW5hYmxlZEluSGllcmFyY2h5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBncmFwaCBkZXB0aCBvZiB0aGUgY2hpbGQgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgd2lsbCBub3cgY2hhbmdlXG4gICAgICAgIG5vZGUuX3VwZGF0ZUdyYXBoRGVwdGgoKTtcblxuICAgICAgICAvLyBUaGUgY2hpbGQgKHBsdXMgc3ViaGllcmFyY2h5KSB3aWxsIG5lZWQgd29ybGQgdHJhbnNmb3JtcyB0byBiZSByZWNhbGN1bGF0ZWRcbiAgICAgICAgbm9kZS5fZGlydGlmeVdvcmxkKCk7XG4gICAgICAgIC8vIG5vZGUgbWlnaHQgYmUgYWxyZWFkeSBtYXJrZWQgYXMgZGlydHksIGluIHRoYXQgY2FzZSB0aGUgd2hvbGUgY2hhaW4gc3RheXMgZnJvemVuLCBzbyBsZXQncyBlbmZvcmNlIHVuZnJlZXplXG4gICAgICAgIGlmICh0aGlzLl9mcm96ZW4pXG4gICAgICAgICAgICBub2RlLl91bmZyZWV6ZVBhcmVudFRvUm9vdCgpO1xuXG4gICAgICAgIC8vIGFsZXJ0IGFuIGVudGl0eSBoaWVyYXJjaHkgdGhhdCBpdCBoYXMgYmVlbiBpbnNlcnRlZFxuICAgICAgICBub2RlLl9maXJlT25IaWVyYXJjaHkoJ2luc2VydCcsICdpbnNlcnRoaWVyYXJjaHknLCB0aGlzKTtcblxuICAgICAgICAvLyBhbGVydCB0aGUgcGFyZW50IHRoYXQgaXQgaGFzIGhhZCBhIGNoaWxkIGluc2VydGVkXG4gICAgICAgIGlmICh0aGlzLmZpcmUpIHRoaXMuZmlyZSgnY2hpbGRpbnNlcnQnLCBub2RlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWN1cnNlIHRoZSBoaWVyYXJjaHkgYW5kIHVwZGF0ZSB0aGUgZ3JhcGggZGVwdGggYXQgZWFjaCBub2RlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlR3JhcGhEZXB0aCgpIHtcbiAgICAgICAgdGhpcy5fZ3JhcGhEZXB0aCA9IHRoaXMuX3BhcmVudCA/IHRoaXMuX3BhcmVudC5fZ3JhcGhEZXB0aCArIDEgOiAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2hpbGRyZW5baV0uX3VwZGF0ZUdyYXBoRGVwdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSB0aGUgbm9kZSBmcm9tIHRoZSBjaGlsZCBsaXN0IGFuZCB1cGRhdGUgdGhlIHBhcmVudCB2YWx1ZSBvZiB0aGUgY2hpbGQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gY2hpbGQgLSBUaGUgbm9kZSB0byByZW1vdmUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBjaGlsZCA9IHRoaXMuZW50aXR5LmNoaWxkcmVuWzBdO1xuICAgICAqIHRoaXMuZW50aXR5LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgKi9cbiAgICByZW1vdmVDaGlsZChjaGlsZCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2NoaWxkcmVuLmluZGV4T2YoY2hpbGQpO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgZnJvbSBjaGlsZCBsaXN0XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgICAgLy8gQ2xlYXIgcGFyZW50XG4gICAgICAgIGNoaWxkLl9wYXJlbnQgPSBudWxsO1xuXG4gICAgICAgIC8vIE5PVEU6IHNlZSBQUiAjNDA0NyAtIHRoaXMgZml4IGlzIHJlbW92ZWQgZm9yIG5vdyBhcyBpdCBicmVha3Mgb3RoZXIgdGhpbmdzXG4gICAgICAgIC8vIG5vdGlmeSB0aGUgY2hpbGQgaGllcmFyY2h5IGl0IGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50LFxuICAgICAgICAvLyB3aGljaCBtYXJrcyB0aGVtIGFzIG5vdCBlbmFibGVkIGluIGhpZXJhcmNoeVxuICAgICAgICAvLyBpZiAoY2hpbGQuX2VuYWJsZWRJbkhpZXJhcmNoeSkge1xuICAgICAgICAvLyAgICAgY2hpbGQuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjaGlsZCwgZmFsc2UpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gYWxlcnQgY2hpbGRyZW4gdGhhdCB0aGV5IGhhcyBiZWVuIHJlbW92ZWRcbiAgICAgICAgY2hpbGQuX2ZpcmVPbkhpZXJhcmNoeSgncmVtb3ZlJywgJ3JlbW92ZWhpZXJhcmNoeScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGFsZXJ0IHRoZSBwYXJlbnQgdGhhdCBpdCBoYXMgaGFkIGEgY2hpbGQgcmVtb3ZlZFxuICAgICAgICB0aGlzLmZpcmUoJ2NoaWxkcmVtb3ZlJywgY2hpbGQpO1xuICAgIH1cblxuICAgIF9zeW5jKCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFRyYW5zZm9ybS5zZXRUUlModGhpcy5sb2NhbFBvc2l0aW9uLCB0aGlzLmxvY2FsUm90YXRpb24sIHRoaXMubG9jYWxTY2FsZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2FsZUNvbXBlbnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50V29ybGRTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgYSBwYXJlbnQgb2YgdGhlIGZpcnN0IHVuY29tcGVuc2F0ZWQgbm9kZSB1cCBpbiB0aGUgaGllcmFyY2h5IGFuZCB1c2UgaXRzIHNjYWxlICogbG9jYWxTY2FsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgc2NhbGUgPSB0aGlzLmxvY2FsU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudDsgLy8gY3VycmVudCBwYXJlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudFRvVXNlU2NhbGVGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAocGFyZW50VG9Vc2VTY2FsZUZyb20gJiYgcGFyZW50VG9Vc2VTY2FsZUZyb20uc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRUb1VzZVNjYWxlRnJvbSA9IHBhcmVudFRvVXNlU2NhbGVGcm9tLl9wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b3Btb3N0IG5vZGUgd2l0aCBzY2FsZSBjb21wZW5zYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFRvVXNlU2NhbGVGcm9tID0gcGFyZW50VG9Vc2VTY2FsZUZyb20uX3BhcmVudDsgLy8gbm9kZSB3aXRob3V0IHNjYWxlIGNvbXBlbnNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRUb1VzZVNjYWxlRnJvbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRXb3JsZFNjYWxlID0gcGFyZW50VG9Vc2VTY2FsZUZyb20ud29ybGRUcmFuc2Zvcm0uZ2V0U2NhbGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlU2NhbGUubXVsMihwYXJlbnRXb3JsZFNjYWxlLCB0aGlzLmxvY2FsU2NhbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZSA9IHNjYWxlQ29tcGVuc2F0ZVNjYWxlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJvdGF0aW9uIGlzIGFzIHVzdWFsXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVJvdDIuc2V0RnJvbU1hdDQocGFyZW50LndvcmxkVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVDb21wZW5zYXRlUm90Lm11bDIoc2NhbGVDb21wZW5zYXRlUm90MiwgdGhpcy5sb2NhbFJvdGF0aW9uKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIG1hdHJpeCB0byB0cmFuc2Zvcm0gcG9zaXRpb25cbiAgICAgICAgICAgICAgICAgICAgbGV0IHRtYXRyaXggPSBwYXJlbnQud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnQuc2NhbGVDb21wZW5zYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlQ29tcGVuc2F0ZVNjYWxlRm9yUGFyZW50Lm11bDIocGFyZW50V29ybGRTY2FsZSwgcGFyZW50LmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm0uc2V0VFJTKHBhcmVudC53b3JsZFRyYW5zZm9ybS5nZXRUcmFuc2xhdGlvbihzY2FsZUNvbXBlbnNhdGVQb3MpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVSb3QyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bWF0cml4ID0gc2NhbGVDb21wZW5zYXRlUG9zVHJhbnNmb3JtO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRtYXRyaXgudHJhbnNmb3JtUG9pbnQodGhpcy5sb2NhbFBvc2l0aW9uLCBzY2FsZUNvbXBlbnNhdGVQb3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRUcmFuc2Zvcm0uc2V0VFJTKHNjYWxlQ29tcGVuc2F0ZVBvcywgc2NhbGVDb21wZW5zYXRlUm90LCBzY2FsZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLm11bEFmZmluZTIodGhpcy5fcGFyZW50LndvcmxkVHJhbnNmb3JtLCB0aGlzLmxvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpY2VzIGF0IHRoaXMgbm9kZSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzeW5jSGllcmFyY2h5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2Zyb3plbilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fZnJvemVuID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCB8fCB0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICB0aGlzLl9zeW5jKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNoaWxkcmVuW2ldLnN5bmNIaWVyYXJjaHkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlb3JpZW50cyB0aGUgZ3JhcGggbm9kZSBzbyB0aGF0IHRoZSBuZWdhdGl2ZSB6LWF4aXMgcG9pbnRzIHRvd2FyZHMgdGhlIHRhcmdldC4gVGhpc1xuICAgICAqIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gRWl0aGVyIHBhc3MgM0QgdmVjdG9ycyBmb3IgdGhlIGxvb2sgYXQgY29vcmRpbmF0ZSBhbmQgdXBcbiAgICAgKiB2ZWN0b3IsIG9yIHBhc3MgbnVtYmVycyB0byByZXByZXNlbnQgdGhlIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gSWYgcGFzc2luZyBhIDNEIHZlY3RvciwgdGhpcyBpcyB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIE90aGVyd2lzZSwgaXQgaXMgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB3b3JsZC1zcGFjZSBjb29yZGluYXRlIHRvIGxvb2sgYXQuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gSWYgcGFzc2luZyBhIDNEIHZlY3RvciwgdGhpcyBpcyB0aGUgd29ybGQtc3BhY2UgdXAgdmVjdG9yIGZvciBsb29rIGF0XG4gICAgICogdHJhbnNmb3JtLiBPdGhlcndpc2UsIGl0IGlzIHRoZSB5LWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvbXBvbmVudCBvZiB0aGUgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSB0byBsb29rIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXg9MF0gLSBYLWNvbXBvbmVudCBvZiB0aGUgdXAgdmVjdG9yIGZvciB0aGUgbG9vayBhdCB0cmFuc2Zvcm0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt1eT0xXSAtIFktY29tcG9uZW50IG9mIHRoZSB1cCB2ZWN0b3IgZm9yIHRoZSBsb29rIGF0IHRyYW5zZm9ybS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3V6PTBdIC0gWi1jb21wb25lbnQgb2YgdGhlIHVwIHZlY3RvciBmb3IgdGhlIGxvb2sgYXQgdHJhbnNmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gTG9vayBhdCBhbm90aGVyIGVudGl0eSwgdXNpbmcgdGhlIChkZWZhdWx0KSBwb3NpdGl2ZSB5LWF4aXMgZm9yIHVwXG4gICAgICogY29uc3QgcG9zaXRpb24gPSBvdGhlckVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdChwb3NpdGlvbik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IGFub3RoZXIgZW50aXR5LCB1c2luZyB0aGUgbmVnYXRpdmUgd29ybGQgeS1heGlzIGZvciB1cFxuICAgICAqIGNvbnN0IHBvc2l0aW9uID0gb3RoZXJFbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiB0aGlzLmVudGl0eS5sb29rQXQocG9zaXRpb24sIHBjLlZlYzMuRE9XTik7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBMb29rIGF0IHRoZSB3b3JsZCBzcGFjZSBvcmlnaW4sIHVzaW5nIHRoZSAoZGVmYXVsdCkgcG9zaXRpdmUgeS1heGlzIGZvciB1cFxuICAgICAqIHRoaXMuZW50aXR5Lmxvb2tBdCgwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIExvb2sgYXQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBbMTAsIDEwLCAxMF0sIHVzaW5nIHRoZSBuZWdhdGl2ZSB3b3JsZCB5LWF4aXMgZm9yIHVwXG4gICAgICogdGhpcy5lbnRpdHkubG9va0F0KDEwLCAxMCwgMTAsIDAsIC0xLCAwKTtcbiAgICAgKi9cbiAgICBsb29rQXQoeCwgeSwgeiwgdXggPSAwLCB1eSA9IDEsIHV6ID0gMCkge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRhcmdldC5jb3B5KHgpO1xuXG4gICAgICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHsgLy8gdmVjMywgdmVjM1xuICAgICAgICAgICAgICAgIHVwLmNvcHkoeSk7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyB2ZWMzXG4gICAgICAgICAgICAgICAgdXAuY29weShWZWMzLlVQKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh6ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhcmdldC5zZXQoeCwgeSwgeik7XG4gICAgICAgICAgICB1cC5zZXQodXgsIHV5LCB1eik7XG4gICAgICAgIH1cblxuICAgICAgICBtYXRyaXguc2V0TG9va0F0KHRoaXMuZ2V0UG9zaXRpb24oKSwgdGFyZ2V0LCB1cCk7XG4gICAgICAgIHJvdGF0aW9uLnNldEZyb21NYXQ0KG1hdHJpeCk7XG4gICAgICAgIHRoaXMuc2V0Um90YXRpb24ocm90YXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCB0cmFuc2xhdGlvbiB2ZWN0b3IuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXM6IHlvdSBjYW4gZWl0aGVyIHBhc3MgYSAzRCB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlXG4gICAgICogd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gMy1kaW1lbnNpb25hbCB2ZWN0b3IgaG9sZGluZyB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbiBvclxuICAgICAqIHgtY29vcmRpbmF0ZSBvZiB3b3JsZC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gWS1jb29yZGluYXRlIG9mIHdvcmxkLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBaLWNvb3JkaW5hdGUgb2Ygd29ybGQtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIDMgbnVtYmVyc1xuICAgICAqIHRoaXMuZW50aXR5LnRyYW5zbGF0ZSgxMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHQgPSBuZXcgcGMuVmVjMygxMCwgMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlKHQpO1xuICAgICAqL1xuICAgIHRyYW5zbGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvc2l0aW9uLmFkZCh0aGlzLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2xhdGVzIHRoZSBncmFwaCBub2RlIGluIGxvY2FsLXNwYWNlIGJ5IHRoZSBzcGVjaWZpZWQgdHJhbnNsYXRpb24gdmVjdG9yLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0QgdmVjdG9yIG9yIDMgbnVtYmVycyB0byBzcGVjaWZ5IHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24gb3JcbiAgICAgKiB4LWNvb3JkaW5hdGUgb2YgbG9jYWwtc3BhY2UgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFktY29vcmRpbmF0ZSBvZiBsb2NhbC1zcGFjZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gWi1jb29yZGluYXRlIG9mIGxvY2FsLXNwYWNlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVHJhbnNsYXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS50cmFuc2xhdGVMb2NhbCgxMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUcmFuc2xhdGUgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHQgPSBuZXcgcGMuVmVjMygxMCwgMCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkudHJhbnNsYXRlTG9jYWwodCk7XG4gICAgICovXG4gICAgdHJhbnNsYXRlTG9jYWwoeCwgeSwgeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24udHJhbnNmb3JtVmVjdG9yKHBvc2l0aW9uLCBwb3NpdGlvbik7XG4gICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5hZGQocG9zaXRpb24pO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJvdGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gd29ybGQtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCBFdWxlciBhbmdsZXMuIEV1bGVycyBhcmUgc3BlY2lmaWVkIGluXG4gICAgICogZGVncmVlcyBpbiBYWVogb3JkZXIuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0RcbiAgICAgKiB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIHdvcmxkLXNwYWNlIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgd29ybGQtc3BhY2Ugcm90YXRpb24gb3JcbiAgICAgKiByb3RhdGlvbiBhcm91bmQgd29ybGQtc3BhY2UgeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCB3b3JsZC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIHdvcmxkLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGUoMCwgOTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSB2ZWN0b3JcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoMCwgOTAsIDApO1xuICAgICAqIHRoaXMuZW50aXR5LnJvdGF0ZShyKTtcbiAgICAgKi9cbiAgICByb3RhdGUoeCwgeSwgeikge1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgaWYgKHRoaXMuX3BhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bDIocm90YXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByb3QgPSB0aGlzLmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRSb3QgPSB0aGlzLl9wYXJlbnQuZ2V0Um90YXRpb24oKTtcblxuICAgICAgICAgICAgaW52UGFyZW50Um90LmNvcHkocGFyZW50Um90KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHJvdGF0aW9uLm11bDIoaW52UGFyZW50Um90LCByb3RhdGlvbik7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUm90YXRpb24ubXVsMihyb3RhdGlvbiwgcm90KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJvdGF0ZXMgdGhlIGdyYXBoIG5vZGUgaW4gbG9jYWwtc3BhY2UgYnkgdGhlIHNwZWNpZmllZCBFdWxlciBhbmdsZXMuIEV1bGVycyBhcmUgc3BlY2lmaWVkIGluXG4gICAgICogZGVncmVlcyBpbiBYWVogb3JkZXIuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzOiB5b3UgY2FuIGVpdGhlciBwYXNzIGEgM0RcbiAgICAgKiB2ZWN0b3Igb3IgMyBudW1iZXJzIHRvIHNwZWNpZnkgdGhlIGxvY2FsLXNwYWNlIHJvdGF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgbG9jYWwtc3BhY2Ugcm90YXRpb24gb3JcbiAgICAgKiByb3RhdGlvbiBhcm91bmQgbG9jYWwtc3BhY2UgeC1heGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFJvdGF0aW9uIGFyb3VuZCBsb2NhbC1zcGFjZSB5LWF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gUm90YXRpb24gYXJvdW5kIGxvY2FsLXNwYWNlIHotYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUm90YXRlIHZpYSAzIG51bWJlcnNcbiAgICAgKiB0aGlzLmVudGl0eS5yb3RhdGVMb2NhbCgwLCA5MCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSb3RhdGUgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjMygwLCA5MCwgMCk7XG4gICAgICogdGhpcy5lbnRpdHkucm90YXRlTG9jYWwocik7XG4gICAgICovXG4gICAgcm90YXRlTG9jYWwoeCwgeSwgeikge1xuICAgICAgICByb3RhdGlvbi5zZXRGcm9tRXVsZXJBbmdsZXMoeCwgeSwgeik7XG5cbiAgICAgICAgdGhpcy5sb2NhbFJvdGF0aW9uLm11bChyb3RhdGlvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHcmFwaE5vZGUgfTtcbiJdLCJuYW1lcyI6WyJzY2FsZUNvbXBlbnNhdGVQb3NUcmFuc2Zvcm0iLCJNYXQ0Iiwic2NhbGVDb21wZW5zYXRlUG9zIiwiVmVjMyIsInNjYWxlQ29tcGVuc2F0ZVJvdCIsIlF1YXQiLCJzY2FsZUNvbXBlbnNhdGVSb3QyIiwic2NhbGVDb21wZW5zYXRlU2NhbGUiLCJzY2FsZUNvbXBlbnNhdGVTY2FsZUZvclBhcmVudCIsInRtcE1hdDQiLCJ0bXBRdWF0IiwicG9zaXRpb24iLCJpbnZQYXJlbnRXdG0iLCJyb3RhdGlvbiIsImludlBhcmVudFJvdCIsIm1hdHJpeCIsInRhcmdldCIsInVwIiwiR3JhcGhOb2RlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwidGFncyIsIlRhZ3MiLCJfbGFiZWxzIiwibG9jYWxQb3NpdGlvbiIsImxvY2FsUm90YXRpb24iLCJsb2NhbFNjYWxlIiwibG9jYWxFdWxlckFuZ2xlcyIsImV1bGVyQW5nbGVzIiwiX3NjYWxlIiwibG9jYWxUcmFuc2Zvcm0iLCJfZGlydHlMb2NhbCIsIl9hYWJiVmVyIiwiX2Zyb3plbiIsIndvcmxkVHJhbnNmb3JtIiwiX2RpcnR5V29ybGQiLCJfd29ybGRTY2FsZVNpZ24iLCJfbm9ybWFsTWF0cml4IiwiTWF0MyIsIl9kaXJ0eU5vcm1hbCIsIl9yaWdodCIsIl91cCIsIl9mb3J3YXJkIiwiX3BhcmVudCIsIl9jaGlsZHJlbiIsIl9ncmFwaERlcHRoIiwiX2VuYWJsZWQiLCJfZW5hYmxlZEluSGllcmFyY2h5Iiwic2NhbGVDb21wZW5zYXRpb24iLCJyaWdodCIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0WCIsIm5vcm1hbGl6ZSIsImdldFkiLCJmb3J3YXJkIiwiZ2V0WiIsIm11bFNjYWxhciIsIm5vcm1hbE1hdHJpeCIsIm5vcm1hbE1hdCIsImludmVydFRvM3gzIiwidHJhbnNwb3NlIiwiZW5hYmxlZCIsIl90aGlzJF9wYXJlbnQiLCJfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwicGFyZW50IiwicGF0aCIsIm5vZGUiLCJyZXN1bHQiLCJyb290IiwiY2hpbGRyZW4iLCJncmFwaERlcHRoIiwiX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkIiwiYyIsImkiLCJsZW4iLCJsZW5ndGgiLCJfdW5mcmVlemVQYXJlbnRUb1Jvb3QiLCJfY2xvbmVJbnRlcm5hbCIsImNsb25lIiwiX2xpc3QiLCJjbGVhciIsImFkZCIsIk9iamVjdCIsImFzc2lnbiIsImNvcHkiLCJzb3VyY2UiLCJkZXN0cm95IiwiX3RoaXMkX3BhcmVudDIiLCJyZW1vdmVDaGlsZCIsImNoaWxkIiwicG9wIiwiZmlyZSIsIm9mZiIsImZpbmQiLCJhdHRyIiwidmFsdWUiLCJyZXN1bHRzIiwiRnVuY3Rpb24iLCJmbiIsInB1c2giLCJkZXNjZW5kYW50cyIsImNvbmNhdCIsInRlc3RWYWx1ZSIsImZpbmRPbmUiLCJmaW5kQnlUYWciLCJxdWVyeSIsImFyZ3VtZW50cyIsInF1ZXJ5Tm9kZSIsImNoZWNrTm9kZSIsImhhcyIsImZpbmRCeU5hbWUiLCJmb3VuZCIsImZpbmRCeVBhdGgiLCJwYXJ0cyIsIkFycmF5IiwiaXNBcnJheSIsInNwbGl0IiwiaW1heCIsImZvckVhY2giLCJjYWxsYmFjayIsInRoaXNBcmciLCJjYWxsIiwiaXNEZXNjZW5kYW50T2YiLCJpc0FuY2VzdG9yT2YiLCJnZXRFdWxlckFuZ2xlcyIsImdldExvY2FsRXVsZXJBbmdsZXMiLCJnZXRMb2NhbFBvc2l0aW9uIiwiZ2V0TG9jYWxSb3RhdGlvbiIsImdldExvY2FsU2NhbGUiLCJnZXRMb2NhbFRyYW5zZm9ybSIsInNldFRSUyIsImdldFBvc2l0aW9uIiwiZ2V0VHJhbnNsYXRpb24iLCJnZXRSb3RhdGlvbiIsInNldEZyb21NYXQ0IiwiZ2V0U2NhbGUiLCJfc3luYyIsIndvcmxkU2NhbGVTaWduIiwic2NhbGVTaWduIiwicmVwYXJlbnQiLCJpbmRleCIsImN1cnJlbnQiLCJpbnNlcnRDaGlsZCIsImFkZENoaWxkIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsIngiLCJ5IiwieiIsInNldEZyb21FdWxlckFuZ2xlcyIsIl9kaXJ0aWZ5TG9jYWwiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0Iiwic2V0TG9jYWxSb3RhdGlvbiIsInciLCJzZXRMb2NhbFNjYWxlIiwiX2RpcnRpZnlXb3JsZCIsInAiLCJfZGlydGlmeVdvcmxkSW50ZXJuYWwiLCJzZXRQb3NpdGlvbiIsImludmVydCIsInRyYW5zZm9ybVBvaW50Iiwic2V0Um90YXRpb24iLCJwYXJlbnRSb3QiLCJtdWwiLCJzZXRFdWxlckFuZ2xlcyIsIm11bDIiLCJfcHJlcGFyZUluc2VydENoaWxkIiwiX29uSW5zZXJ0Q2hpbGQiLCJhZGRDaGlsZEFuZFNhdmVUcmFuc2Zvcm0iLCJ3UG9zIiwid1JvdCIsInNwbGljZSIsIkRlYnVnIiwiYXNzZXJ0IiwiX2ZpcmVPbkhpZXJhcmNoeSIsIm5hbWVIaWVyYXJjaHkiLCJlbmFibGVkSW5IaWVyYXJjaHkiLCJfdXBkYXRlR3JhcGhEZXB0aCIsImluZGV4T2YiLCJwYXJlbnRXb3JsZFNjYWxlIiwic2NhbGUiLCJwYXJlbnRUb1VzZVNjYWxlRnJvbSIsInRtYXRyaXgiLCJtdWxBZmZpbmUyIiwic3luY0hpZXJhcmNoeSIsImxvb2tBdCIsInV4IiwidXkiLCJ1eiIsIlVQIiwidW5kZWZpbmVkIiwic2V0TG9va0F0IiwidHJhbnNsYXRlIiwidHJhbnNsYXRlTG9jYWwiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyb3RhdGUiLCJyb3QiLCJyb3RhdGVMb2NhbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFTQSxNQUFNQSwyQkFBMkIsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUM5QyxNQUFNQyxrQkFBa0IsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUNyQyxNQUFNQyxrQkFBa0IsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUNyQyxNQUFNQyxtQkFBbUIsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUN0QyxNQUFNRSxvQkFBb0IsR0FBRyxJQUFJSixJQUFJLEVBQUUsQ0FBQTtBQUN2QyxNQUFNSyw2QkFBNkIsR0FBRyxJQUFJTCxJQUFJLEVBQUUsQ0FBQTtBQUNoRCxNQUFNTSxPQUFPLEdBQUcsSUFBSVIsSUFBSSxFQUFFLENBQUE7QUFDMUIsTUFBTVMsT0FBTyxHQUFHLElBQUlMLElBQUksRUFBRSxDQUFBO0FBQzFCLE1BQU1NLFFBQVEsR0FBRyxJQUFJUixJQUFJLEVBQUUsQ0FB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
