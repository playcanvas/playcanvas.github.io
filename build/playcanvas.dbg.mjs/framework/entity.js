import { Debug } from '../core/debug.js';
import { guid } from '../core/guid.js';
import { GraphNode } from '../scene/graph-node.js';
import { getApplication } from './globals.js';

/**
 * @type {GraphNode[]}
 * @ignore
 */
const _enableList = [];

/**
 * The Entity is the core primitive of a PlayCanvas game. Generally speaking an object in your game
 * will consist of an {@link Entity}, and a set of {@link Component}s which are managed by their
 * respective {@link ComponentSystem}s. One of those components maybe a {@link ScriptComponent}
 * which allows you to write custom code to attach to your Entity.
 *
 * The Entity uniquely identifies the object and also provides a transform for position and
 * orientation which it inherits from {@link GraphNode} so can be added into the scene graph. The
 * Component and ComponentSystem provide the logic to give an Entity a specific type of behavior.
 * e.g. the ability to render a model or play a sound. Components are specific to an instance of an
 * Entity and are attached (e.g. `this.entity.model`) ComponentSystems allow access to all Entities
 * and Components and are attached to the {@link AppBase}.
 *
 * @augments GraphNode
 */
class Entity extends GraphNode {
  /**
   * Gets the {@link AnimComponent} attached to this entity.
   *
   * @type {import('./components/anim/component.js').AnimComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link AnimationComponent} attached to this entity.
   *
   * @type {import('./components/animation/component.js').AnimationComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link AudioListenerComponent} attached to this entity.
   *
   * @type {import('./components/audio-listener/component.js').AudioListenerComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ButtonComponent} attached to this entity.
   *
   * @type {import('./components/button/component.js').ButtonComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link CameraComponent} attached to this entity.
   *
   * @type {import('./components/camera/component.js').CameraComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link CollisionComponent} attached to this entity.
   *
   * @type {import('./components/collision/component.js').CollisionComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ElementComponent} attached to this entity.
   *
   * @type {import('./components/element/component.js').ElementComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link LayoutChildComponent} attached to this entity.
   *
   * @type {import('./components/layout-child/component.js').LayoutChildComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link LayoutGroupComponent} attached to this entity.
   *
   * @type {import('./components/layout-group/component.js').LayoutGroupComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link LightComponent} attached to this entity.
   *
   * @type {import('./components/light/component.js').LightComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ModelComponent} attached to this entity.
   *
   * @type {import('./components/model/component.js').ModelComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ParticleSystemComponent} attached to this entity.
   *
   * @type {import('./components/particle-system/component.js').ParticleSystemComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link RenderComponent} attached to this entity.
   *
   * @type {import('./components/render/component.js').RenderComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link RigidBodyComponent} attached to this entity.
   *
   * @type {import('./components/rigid-body/component.js').RigidBodyComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScreenComponent} attached to this entity.
   *
   * @type {import('./components/screen/component.js').ScreenComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScriptComponent} attached to this entity.
   *
   * @type {import('./components/script/component.js').ScriptComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScrollbarComponent} attached to this entity.
   *
   * @type {import('./components/scrollbar/component.js').ScrollbarComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link ScrollViewComponent} attached to this entity.
   *
   * @type {import('./components/scroll-view/component.js').ScrollViewComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link SoundComponent} attached to this entity.
   *
   * @type {import('./components/sound/component.js').SoundComponent|undefined}
   * @readonly
   */

  /**
   * Gets the {@link SpriteComponent} attached to this entity.
   *
   * @type {import('./components/sprite/component.js').SpriteComponent|undefined}
   * @readonly
   */

  /**
   * Component storage.
   *
   * @type {Object<string, import('./components/component.js').Component>}
   * @ignore
   */

  /**
   * @type {import('./app-base.js').AppBase}
   * @private
   */

  /**
   * Used by component systems to speed up destruction.
   *
   * @type {boolean}
   * @ignore
   */

  /**
   * @type {string|null}
   * @private
   */

  /**
   * Used to differentiate between the entities of a template root instance, which have it set to
   * true, and the cloned instance entities (set to false).
   *
   * @type {boolean}
   * @ignore
   */

  /**
   * Create a new Entity.
   *
   * @param {string} [name] - The non-unique name of the entity, default is "Untitled".
   * @param {import('./app-base.js').AppBase} [app] - The application the entity belongs to,
   * default is the current application.
   * @example
   * const entity = new pc.Entity();
   *
   * // Add a Component to the Entity
   * entity.addComponent("camera", {
   *     fov: 45,
   *     nearClip: 1,
   *     farClip: 10000
   * });
   *
   * // Add the Entity into the scene graph
   * app.root.addChild(entity);
   *
   * // Move the entity
   * entity.translate(10, 0, 0);
   *
   * // Or translate it by setting its position directly
   * const p = entity.getPosition();
   * entity.setPosition(p.x + 10, p.y, p.z);
   *
   * // Change the entity's rotation in local space
   * const e = entity.getLocalEulerAngles();
   * entity.setLocalEulerAngles(e.x, e.y + 90, e.z);
   *
   * // Or use rotateLocal
   * entity.rotateLocal(0, 90, 0);
   */
  constructor(name, app = getApplication()) {
    super(name);
    this.anim = void 0;
    this.animation = void 0;
    this.audiolistener = void 0;
    this.button = void 0;
    this.camera = void 0;
    this.collision = void 0;
    this.element = void 0;
    this.layoutchild = void 0;
    this.layoutgroup = void 0;
    this.light = void 0;
    this.model = void 0;
    this.particlesystem = void 0;
    this.render = void 0;
    this.rigidbody = void 0;
    this.screen = void 0;
    this.script = void 0;
    this.scrollbar = void 0;
    this.scrollview = void 0;
    this.sound = void 0;
    this.sprite = void 0;
    this.c = {};
    this._app = void 0;
    this._destroying = false;
    this._guid = null;
    this._template = false;
    Debug.assert(app, 'Could not find current application');
    this._app = app;
  }

  /**
   * Create a new component and add it to the entity. Use this to add functionality to the entity
   * like rendering a model, playing sounds and so on.
   *
   * @param {string} type - The name of the component to add. Valid strings are:
   *
   * - "anim" - see {@link AnimComponent}
   * - "animation" - see {@link AnimationComponent}
   * - "audiolistener" - see {@link AudioListenerComponent}
   * - "button" - see {@link ButtonComponent}
   * - "camera" - see {@link CameraComponent}
   * - "collision" - see {@link CollisionComponent}
   * - "element" - see {@link ElementComponent}
   * - "layoutchild" - see {@link LayoutChildComponent}
   * - "layoutgroup" - see {@link LayoutGroupComponent}
   * - "light" - see {@link LightComponent}
   * - "model" - see {@link ModelComponent}
   * - "particlesystem" - see {@link ParticleSystemComponent}
   * - "render" - see {@link RenderComponent}
   * - "rigidbody" - see {@link RigidBodyComponent}
   * - "screen" - see {@link ScreenComponent}
   * - "script" - see {@link ScriptComponent}
   * - "scrollbar" - see {@link ScrollbarComponent}
   * - "scrollview" - see {@link ScrollViewComponent}
   * - "sound" - see {@link SoundComponent}
   * - "sprite" - see {@link SpriteComponent}
   *
   * @param {object} [data] - The initialization data for the specific component type. Refer to
   * each specific component's API reference page for details on valid values for this parameter.
   * @returns {import('./components/component.js').Component|null} The new Component that was
   * attached to the entity or null if there was an error.
   * @example
   * const entity = new pc.Entity();
   *
   * // Add a light component with default properties
   * entity.addComponent("light");
   *
   * // Add a camera component with some specified properties
   * entity.addComponent("camera", {
   *     fov: 45,
   *     clearColor: new pc.Color(1, 0, 0)
   * });
   */
  addComponent(type, data) {
    const system = this._app.systems[type];
    if (!system) {
      Debug.error(`addComponent: System '${type}' doesn't exist`);
      return null;
    }
    if (this.c[type]) {
      Debug.warn(`addComponent: Entity already has '${type}' component`);
      return null;
    }
    return system.addComponent(this, data);
  }

  /**
   * Remove a component from the Entity.
   *
   * @param {string} type - The name of the Component type.
   * @example
   * const entity = new pc.Entity();
   * entity.addComponent("light"); // add new light component
   *
   * entity.removeComponent("light"); // remove light component
   */
  removeComponent(type) {
    const system = this._app.systems[type];
    if (!system) {
      Debug.error(`addComponent: System '${type}' doesn't exist`);
      return;
    }
    if (!this.c[type]) {
      Debug.warn(`removeComponent: Entity doesn't have '${type}' component`);
      return;
    }
    system.removeComponent(this);
  }

  /**
   * Search the entity and all of its descendants for the first component of specified type.
   *
   * @param {string} type - The name of the component type to retrieve.
   * @returns {import('./components/component.js').Component} A component of specified type, if
   * the entity or any of its descendants has one. Returns undefined otherwise.
   * @example
   * // Get the first found light component in the hierarchy tree that starts with this entity
   * const light = entity.findComponent("light");
   */
  findComponent(type) {
    const entity = this.findOne(function (node) {
      return node.c && node.c[type];
    });
    return entity && entity.c[type];
  }

  /**
   * Search the entity and all of its descendants for all components of specified type.
   *
   * @param {string} type - The name of the component type to retrieve.
   * @returns {import('./components/component.js').Component[]} All components of specified type
   * in the entity or any of its descendants. Returns empty array if none found.
   * @example
   * // Get all light components in the hierarchy tree that starts with this entity
   * const lights = entity.findComponents("light");
   */
  findComponents(type) {
    const entities = this.find(function (node) {
      return node.c && node.c[type];
    });
    return entities.map(function (entity) {
      return entity.c[type];
    });
  }

  /**
   * Get the GUID value for this Entity.
   *
   * @returns {string} The GUID of the Entity.
   * @ignore
   */
  getGuid() {
    // if the guid hasn't been set yet then set it now before returning it
    if (!this._guid) {
      this.setGuid(guid.create());
    }
    return this._guid;
  }

  /**
   * Set the GUID value for this Entity. Note that it is unlikely that you should need to change
   * the GUID value of an Entity at run-time. Doing so will corrupt the graph this Entity is in.
   *
   * @param {string} guid - The GUID to assign to the Entity.
   * @ignore
   */
  setGuid(guid) {
    // remove current guid from entityIndex
    const index = this._app._entityIndex;
    if (this._guid) {
      delete index[this._guid];
    }

    // add new guid to entityIndex
    this._guid = guid;
    index[this._guid] = this;
  }

  /**
   * @param {GraphNode} node - The node to update.
   * @param {boolean} enabled - Enable or disable the node.
   * @private
   */
  _notifyHierarchyStateChanged(node, enabled) {
    let enableFirst = false;
    if (node === this && _enableList.length === 0) enableFirst = true;
    node._beingEnabled = true;
    node._onHierarchyStateChanged(enabled);
    if (node._onHierarchyStatePostChanged) _enableList.push(node);
    const c = node._children;
    for (let i = 0, len = c.length; i < len; i++) {
      if (c[i]._enabled) this._notifyHierarchyStateChanged(c[i], enabled);
    }
    node._beingEnabled = false;
    if (enableFirst) {
      // do not cache the length here, as enableList may be added to during loop
      for (let i = 0; i < _enableList.length; i++) {
        _enableList[i]._onHierarchyStatePostChanged();
      }
      _enableList.length = 0;
    }
  }

  /**
   * @param {boolean} enabled - Enable or disable the node.
   * @private
   */
  _onHierarchyStateChanged(enabled) {
    super._onHierarchyStateChanged(enabled);

    // enable / disable all the components
    const components = this.c;
    for (const type in components) {
      if (components.hasOwnProperty(type)) {
        const component = components[type];
        if (component.enabled) {
          if (enabled) {
            component.onEnable();
          } else {
            component.onDisable();
          }
        }
      }
    }
  }

  /** @private */
  _onHierarchyStatePostChanged() {
    // post enable all the components
    const components = this.c;
    for (const type in components) {
      if (components.hasOwnProperty(type)) components[type].onPostStateChange();
    }
  }

  /**
   * Find a descendant of this entity with the GUID.
   *
   * @param {string} guid - The GUID to search for.
   * @returns {Entity|null} The entity with the matching GUID or null if no entity is found.
   */
  findByGuid(guid) {
    if (this._guid === guid) return this;
    const e = this._app._entityIndex[guid];
    if (e && (e === this || e.isDescendantOf(this))) {
      return e;
    }
    return null;
  }

  /**
   * Remove all components from the Entity and detach it from the Entity hierarchy. Then
   * recursively destroy all ancestor Entities.
   *
   * @example
   * const firstChild = this.entity.children[0];
   * firstChild.destroy(); // delete child, all components and remove from hierarchy
   */
  destroy() {
    this._destroying = true;

    // Disable all enabled components first
    for (const name in this.c) {
      this.c[name].enabled = false;
    }

    // Remove all components
    for (const name in this.c) {
      this.c[name].system.removeComponent(this);
    }

    // Detach from parent
    if (this._parent) this._parent.removeChild(this);

    // recursively destroy all children
    const children = this._children;
    while (children.length) {
      // remove a child from the array and disconnect it from the parent
      const child = children.pop();
      child._parent = null;
      if (child instanceof Entity) {
        child.destroy();
      }
    }

    // fire destroy event
    this.fire('destroy', this);

    // clear all events
    this.off();

    // remove from entity index
    if (this._guid) {
      delete this._app._entityIndex[this._guid];
    }
    this._destroying = false;
  }

  /**
   * Create a deep copy of the Entity. Duplicate the full Entity hierarchy, with all Components
   * and all descendants. Note, this Entity is not in the hierarchy and must be added manually.
   *
   * @returns {this} A new Entity which is a deep copy of the original.
   * @example
   * const e = this.entity.clone();
   *
   * // Add clone as a sibling to the original
   * this.entity.parent.addChild(e);
   */
  clone() {
    const duplicatedIdsMap = {};
    const clone = this._cloneRecursively(duplicatedIdsMap);
    duplicatedIdsMap[this.getGuid()] = clone;
    resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);
    return clone;
  }

  /**
   * @param {Object<string, Entity>} duplicatedIdsMap - A map of original entity GUIDs to cloned
   * entities.
   * @returns {this} A new Entity which is a deep copy of the original.
   * @private
   */
  _cloneRecursively(duplicatedIdsMap) {
    /** @type {this} */
    const clone = new this.constructor(undefined, this._app);
    super._cloneInternal(clone);
    for (const type in this.c) {
      const component = this.c[type];
      component.system.cloneComponent(this, clone);
    }
    for (let i = 0; i < this._children.length; i++) {
      const oldChild = this._children[i];
      if (oldChild instanceof Entity) {
        const newChild = oldChild._cloneRecursively(duplicatedIdsMap);
        clone.addChild(newChild);
        duplicatedIdsMap[oldChild.getGuid()] = newChild;
      }
    }
    return clone;
  }
}

// When an entity that has properties that contain references to other
// entities within its subtree is duplicated, the expectation of the
// user is likely that those properties will be updated to point to
// the corresponding entities within the newly-created duplicate subtree.
//
// To handle this, we need to search for properties that refer to entities
// within the old duplicated structure, find their newly-cloned partners
// within the new structure, and update the references accordingly. This
// function implements that requirement.
function resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, oldEntity, newEntity, duplicatedIdsMap) {
  if (oldEntity instanceof Entity) {
    const components = oldEntity.c;

    // Handle component properties
    for (const componentName in components) {
      const component = components[componentName];
      const entityProperties = component.system.getPropertiesOfType('entity');
      for (let i = 0, len = entityProperties.length; i < len; i++) {
        const propertyDescriptor = entityProperties[i];
        const propertyName = propertyDescriptor.name;
        const oldEntityReferenceId = component[propertyName];
        const entityIsWithinOldSubtree = !!oldSubtreeRoot.findByGuid(oldEntityReferenceId);
        if (entityIsWithinOldSubtree) {
          const newEntityReferenceId = duplicatedIdsMap[oldEntityReferenceId].getGuid();
          if (newEntityReferenceId) {
            newEntity.c[componentName][propertyName] = newEntityReferenceId;
          } else {
            Debug.warn('Could not find corresponding entity id when resolving duplicated entity references');
          }
        }
      }
    }

    // Handle entity script attributes
    if (components.script && !newEntity._app.useLegacyScriptAttributeCloning) {
      newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
    }

    // Handle entity render attributes
    if (components.render) {
      newEntity.render.resolveDuplicatedEntityReferenceProperties(components.render, duplicatedIdsMap);
    }

    // Handle entity anim attributes
    if (components.anim) {
      newEntity.anim.resolveDuplicatedEntityReferenceProperties(components.anim, duplicatedIdsMap);
    }

    // Recurse into children. Note that we continue to pass in the same `oldSubtreeRoot`,
    // in order to correctly handle cases where a child has an entity reference
    // field that points to a parent or other ancestor that is still within the
    // duplicated subtree.
    const _old = oldEntity.children.filter(function (e) {
      return e instanceof Entity;
    });
    const _new = newEntity.children.filter(function (e) {
      return e instanceof Entity;
    });
    for (let i = 0, len = _old.length; i < len; i++) {
      resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, _old[i], _new[i], duplicatedIdsMap);
    }
  }
}

export { Entity };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50aXR5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2VudGl0eS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgZ3VpZCB9IGZyb20gJy4uL2NvcmUvZ3VpZC5qcyc7XG5cbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuXG5pbXBvcnQgeyBnZXRBcHBsaWNhdGlvbiB9IGZyb20gJy4vZ2xvYmFscy5qcyc7XG5cbi8qKlxuICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICogQGlnbm9yZVxuICovXG5jb25zdCBfZW5hYmxlTGlzdCA9IFtdO1xuXG4vKipcbiAqIFRoZSBFbnRpdHkgaXMgdGhlIGNvcmUgcHJpbWl0aXZlIG9mIGEgUGxheUNhbnZhcyBnYW1lLiBHZW5lcmFsbHkgc3BlYWtpbmcgYW4gb2JqZWN0IGluIHlvdXIgZ2FtZVxuICogd2lsbCBjb25zaXN0IG9mIGFuIHtAbGluayBFbnRpdHl9LCBhbmQgYSBzZXQgb2Yge0BsaW5rIENvbXBvbmVudH1zIHdoaWNoIGFyZSBtYW5hZ2VkIGJ5IHRoZWlyXG4gKiByZXNwZWN0aXZlIHtAbGluayBDb21wb25lbnRTeXN0ZW19cy4gT25lIG9mIHRob3NlIGNvbXBvbmVudHMgbWF5YmUgYSB7QGxpbmsgU2NyaXB0Q29tcG9uZW50fVxuICogd2hpY2ggYWxsb3dzIHlvdSB0byB3cml0ZSBjdXN0b20gY29kZSB0byBhdHRhY2ggdG8geW91ciBFbnRpdHkuXG4gKlxuICogVGhlIEVudGl0eSB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSBvYmplY3QgYW5kIGFsc28gcHJvdmlkZXMgYSB0cmFuc2Zvcm0gZm9yIHBvc2l0aW9uIGFuZFxuICogb3JpZW50YXRpb24gd2hpY2ggaXQgaW5oZXJpdHMgZnJvbSB7QGxpbmsgR3JhcGhOb2RlfSBzbyBjYW4gYmUgYWRkZWQgaW50byB0aGUgc2NlbmUgZ3JhcGguIFRoZVxuICogQ29tcG9uZW50IGFuZCBDb21wb25lbnRTeXN0ZW0gcHJvdmlkZSB0aGUgbG9naWMgdG8gZ2l2ZSBhbiBFbnRpdHkgYSBzcGVjaWZpYyB0eXBlIG9mIGJlaGF2aW9yLlxuICogZS5nLiB0aGUgYWJpbGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBwbGF5IGEgc291bmQuIENvbXBvbmVudHMgYXJlIHNwZWNpZmljIHRvIGFuIGluc3RhbmNlIG9mIGFuXG4gKiBFbnRpdHkgYW5kIGFyZSBhdHRhY2hlZCAoZS5nLiBgdGhpcy5lbnRpdHkubW9kZWxgKSBDb21wb25lbnRTeXN0ZW1zIGFsbG93IGFjY2VzcyB0byBhbGwgRW50aXRpZXNcbiAqIGFuZCBDb21wb25lbnRzIGFuZCBhcmUgYXR0YWNoZWQgdG8gdGhlIHtAbGluayBBcHBCYXNlfS5cbiAqXG4gKiBAYXVnbWVudHMgR3JhcGhOb2RlXG4gKi9cbmNsYXNzIEVudGl0eSBleHRlbmRzIEdyYXBoTm9kZSB7XG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEFuaW1Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2FuaW0vY29tcG9uZW50LmpzJykuQW5pbUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYW5pbTtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBbmltYXRpb25Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2FuaW1hdGlvbi9jb21wb25lbnQuanMnKS5BbmltYXRpb25Db21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGFuaW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9hdWRpby1saXN0ZW5lci9jb21wb25lbnQuanMnKS5BdWRpb0xpc3RlbmVyQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBhdWRpb2xpc3RlbmVyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvYnV0dG9uL2NvbXBvbmVudC5qcycpLkJ1dHRvbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYnV0dG9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY2FtZXJhO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY29sbGlzaW9uL2NvbXBvbmVudC5qcycpLkNvbGxpc2lvbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY29sbGlzaW9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgZWxlbWVudDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGF5b3V0LWNoaWxkL2NvbXBvbmVudC5qcycpLkxheW91dENoaWxkQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRjaGlsZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGF5b3V0LWdyb3VwL2NvbXBvbmVudC5qcycpLkxheW91dEdyb3VwQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRncm91cDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMaWdodENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJykuTGlnaHRDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGxpZ2h0O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIE1vZGVsQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9tb2RlbC9jb21wb25lbnQuanMnKS5Nb2RlbENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbW9kZWw7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3BhcnRpY2xlLXN5c3RlbS9jb21wb25lbnQuanMnKS5QYXJ0aWNsZVN5c3RlbUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcGFydGljbGVzeXN0ZW07XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUmVuZGVyQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJykuUmVuZGVyQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICByZW5kZXI7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcycpLlJpZ2lkQm9keUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcmlnaWRib2R5O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmVlbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2NyZWVuL2NvbXBvbmVudC5qcycpLlNjcmVlbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2NyZWVuO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmlwdENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcycpLlNjcmlwdENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2NyaXB0O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbGJhckNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2Nyb2xsYmFyL2NvbXBvbmVudC5qcycpLlNjcm9sbGJhckNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2Nyb2xsYmFyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbFZpZXdDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3Njcm9sbC12aWV3L2NvbXBvbmVudC5qcycpLlNjcm9sbFZpZXdDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNjcm9sbHZpZXc7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgU291bmRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3NvdW5kL2NvbXBvbmVudC5qcycpLlNvdW5kQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzb3VuZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBTcHJpdGVDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3Nwcml0ZS9jb21wb25lbnQuanMnKS5TcHJpdGVDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNwcml0ZTtcblxuICAgIC8qKlxuICAgICAqIENvbXBvbmVudCBzdG9yYWdlLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIGltcG9ydCgnLi9jb21wb25lbnRzL2NvbXBvbmVudC5qcycpLkNvbXBvbmVudD59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FwcDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkgY29tcG9uZW50IHN5c3RlbXMgdG8gc3BlZWQgdXAgZGVzdHJ1Y3Rpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2Rlc3Ryb3lpbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ndWlkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIHRoZSBlbnRpdGllcyBvZiBhIHRlbXBsYXRlIHJvb3QgaW5zdGFuY2UsIHdoaWNoIGhhdmUgaXQgc2V0IHRvXG4gICAgICogdHJ1ZSwgYW5kIHRoZSBjbG9uZWQgaW5zdGFuY2UgZW50aXRpZXMgKHNldCB0byBmYWxzZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3RlbXBsYXRlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBub24tdW5pcXVlIG5hbWUgb2YgdGhlIGVudGl0eSwgZGVmYXVsdCBpcyBcIlVudGl0bGVkXCIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBbYXBwXSAtIFRoZSBhcHBsaWNhdGlvbiB0aGUgZW50aXR5IGJlbG9uZ3MgdG8sXG4gICAgICogZGVmYXVsdCBpcyB0aGUgY3VycmVudCBhcHBsaWNhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBhIENvbXBvbmVudCB0byB0aGUgRW50aXR5XG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudChcImNhbWVyYVwiLCB7XG4gICAgICogICAgIGZvdjogNDUsXG4gICAgICogICAgIG5lYXJDbGlwOiAxLFxuICAgICAqICAgICBmYXJDbGlwOiAxMDAwMFxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQWRkIHRoZSBFbnRpdHkgaW50byB0aGUgc2NlbmUgZ3JhcGhcbiAgICAgKiBhcHAucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqXG4gICAgICogLy8gTW92ZSB0aGUgZW50aXR5XG4gICAgICogZW50aXR5LnRyYW5zbGF0ZSgxMCwgMCwgMCk7XG4gICAgICpcbiAgICAgKiAvLyBPciB0cmFuc2xhdGUgaXQgYnkgc2V0dGluZyBpdHMgcG9zaXRpb24gZGlyZWN0bHlcbiAgICAgKiBjb25zdCBwID0gZW50aXR5LmdldFBvc2l0aW9uKCk7XG4gICAgICogZW50aXR5LnNldFBvc2l0aW9uKHAueCArIDEwLCBwLnksIHAueik7XG4gICAgICpcbiAgICAgKiAvLyBDaGFuZ2UgdGhlIGVudGl0eSdzIHJvdGF0aW9uIGluIGxvY2FsIHNwYWNlXG4gICAgICogY29uc3QgZSA9IGVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoZS54LCBlLnkgKyA5MCwgZS56KTtcbiAgICAgKlxuICAgICAqIC8vIE9yIHVzZSByb3RhdGVMb2NhbFxuICAgICAqIGVudGl0eS5yb3RhdGVMb2NhbCgwLCA5MCwgMCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSwgYXBwID0gZ2V0QXBwbGljYXRpb24oKSkge1xuICAgICAgICBzdXBlcihuYW1lKTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoYXBwLCAnQ291bGQgbm90IGZpbmQgY3VycmVudCBhcHBsaWNhdGlvbicpO1xuICAgICAgICB0aGlzLl9hcHAgPSBhcHA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGNvbXBvbmVudCBhbmQgYWRkIGl0IHRvIHRoZSBlbnRpdHkuIFVzZSB0aGlzIHRvIGFkZCBmdW5jdGlvbmFsaXR5IHRvIHRoZSBlbnRpdHlcbiAgICAgKiBsaWtlIHJlbmRlcmluZyBhIG1vZGVsLCBwbGF5aW5nIHNvdW5kcyBhbmQgc28gb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBjb21wb25lbnQgdG8gYWRkLiBWYWxpZCBzdHJpbmdzIGFyZTpcbiAgICAgKlxuICAgICAqIC0gXCJhbmltXCIgLSBzZWUge0BsaW5rIEFuaW1Db21wb25lbnR9XG4gICAgICogLSBcImFuaW1hdGlvblwiIC0gc2VlIHtAbGluayBBbmltYXRpb25Db21wb25lbnR9XG4gICAgICogLSBcImF1ZGlvbGlzdGVuZXJcIiAtIHNlZSB7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudH1cbiAgICAgKiAtIFwiYnV0dG9uXCIgLSBzZWUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudH1cbiAgICAgKiAtIFwiY2FtZXJhXCIgLSBzZWUge0BsaW5rIENhbWVyYUNvbXBvbmVudH1cbiAgICAgKiAtIFwiY29sbGlzaW9uXCIgLSBzZWUge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH1cbiAgICAgKiAtIFwiZWxlbWVudFwiIC0gc2VlIHtAbGluayBFbGVtZW50Q29tcG9uZW50fVxuICAgICAqIC0gXCJsYXlvdXRjaGlsZFwiIC0gc2VlIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH1cbiAgICAgKiAtIFwibGF5b3V0Z3JvdXBcIiAtIHNlZSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9XG4gICAgICogLSBcImxpZ2h0XCIgLSBzZWUge0BsaW5rIExpZ2h0Q29tcG9uZW50fVxuICAgICAqIC0gXCJtb2RlbFwiIC0gc2VlIHtAbGluayBNb2RlbENvbXBvbmVudH1cbiAgICAgKiAtIFwicGFydGljbGVzeXN0ZW1cIiAtIHNlZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnR9XG4gICAgICogLSBcInJlbmRlclwiIC0gc2VlIHtAbGluayBSZW5kZXJDb21wb25lbnR9XG4gICAgICogLSBcInJpZ2lkYm9keVwiIC0gc2VlIHtAbGluayBSaWdpZEJvZHlDb21wb25lbnR9XG4gICAgICogLSBcInNjcmVlblwiIC0gc2VlIHtAbGluayBTY3JlZW5Db21wb25lbnR9XG4gICAgICogLSBcInNjcmlwdFwiIC0gc2VlIHtAbGluayBTY3JpcHRDb21wb25lbnR9XG4gICAgICogLSBcInNjcm9sbGJhclwiIC0gc2VlIHtAbGluayBTY3JvbGxiYXJDb21wb25lbnR9XG4gICAgICogLSBcInNjcm9sbHZpZXdcIiAtIHNlZSB7QGxpbmsgU2Nyb2xsVmlld0NvbXBvbmVudH1cbiAgICAgKiAtIFwic291bmRcIiAtIHNlZSB7QGxpbmsgU291bmRDb21wb25lbnR9XG4gICAgICogLSBcInNwcml0ZVwiIC0gc2VlIHtAbGluayBTcHJpdGVDb21wb25lbnR9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2RhdGFdIC0gVGhlIGluaXRpYWxpemF0aW9uIGRhdGEgZm9yIHRoZSBzcGVjaWZpYyBjb21wb25lbnQgdHlwZS4gUmVmZXIgdG9cbiAgICAgKiBlYWNoIHNwZWNpZmljIGNvbXBvbmVudCdzIEFQSSByZWZlcmVuY2UgcGFnZSBmb3IgZGV0YWlscyBvbiB2YWxpZCB2YWx1ZXMgZm9yIHRoaXMgcGFyYW1ldGVyLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnR8bnVsbH0gVGhlIG5ldyBDb21wb25lbnQgdGhhdCB3YXNcbiAgICAgKiBhdHRhY2hlZCB0byB0aGUgZW50aXR5IG9yIG51bGwgaWYgdGhlcmUgd2FzIGFuIGVycm9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZW50aXR5ID0gbmV3IHBjLkVudGl0eSgpO1xuICAgICAqXG4gICAgICogLy8gQWRkIGEgbGlnaHQgY29tcG9uZW50IHdpdGggZGVmYXVsdCBwcm9wZXJ0aWVzXG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudChcImxpZ2h0XCIpO1xuICAgICAqXG4gICAgICogLy8gQWRkIGEgY2FtZXJhIGNvbXBvbmVudCB3aXRoIHNvbWUgc3BlY2lmaWVkIHByb3BlcnRpZXNcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KFwiY2FtZXJhXCIsIHtcbiAgICAgKiAgICAgZm92OiA0NSxcbiAgICAgKiAgICAgY2xlYXJDb2xvcjogbmV3IHBjLkNvbG9yKDEsIDAsIDApXG4gICAgICogfSk7XG4gICAgICovXG4gICAgYWRkQ29tcG9uZW50KHR5cGUsIGRhdGEpIHtcbiAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5fYXBwLnN5c3RlbXNbdHlwZV07XG4gICAgICAgIGlmICghc3lzdGVtKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgYWRkQ29tcG9uZW50OiBTeXN0ZW0gJyR7dHlwZX0nIGRvZXNuJ3QgZXhpc3RgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNbdHlwZV0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGFkZENvbXBvbmVudDogRW50aXR5IGFscmVhZHkgaGFzICcke3R5cGV9JyBjb21wb25lbnRgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzeXN0ZW0uYWRkQ29tcG9uZW50KHRoaXMsIGRhdGEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIHRoZSBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBDb21wb25lbnQgdHlwZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KFwibGlnaHRcIik7IC8vIGFkZCBuZXcgbGlnaHQgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBlbnRpdHkucmVtb3ZlQ29tcG9uZW50KFwibGlnaHRcIik7IC8vIHJlbW92ZSBsaWdodCBjb21wb25lbnRcbiAgICAgKi9cbiAgICByZW1vdmVDb21wb25lbnQodHlwZSkge1xuICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLl9hcHAuc3lzdGVtc1t0eXBlXTtcbiAgICAgICAgaWYgKCFzeXN0ZW0pIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKGBhZGRDb21wb25lbnQ6IFN5c3RlbSAnJHt0eXBlfScgZG9lc24ndCBleGlzdGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5jW3R5cGVdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGByZW1vdmVDb21wb25lbnQ6IEVudGl0eSBkb2Vzbid0IGhhdmUgJyR7dHlwZX0nIGNvbXBvbmVudGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN5c3RlbS5yZW1vdmVDb21wb25lbnQodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBlbnRpdHkgYW5kIGFsbCBvZiBpdHMgZGVzY2VuZGFudHMgZm9yIHRoZSBmaXJzdCBjb21wb25lbnQgb2Ygc3BlY2lmaWVkIHR5cGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBjb21wb25lbnQgdHlwZSB0byByZXRyaWV2ZS5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY29tcG9uZW50LmpzJykuQ29tcG9uZW50fSBBIGNvbXBvbmVudCBvZiBzcGVjaWZpZWQgdHlwZSwgaWZcbiAgICAgKiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgZGVzY2VuZGFudHMgaGFzIG9uZS4gUmV0dXJucyB1bmRlZmluZWQgb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gR2V0IHRoZSBmaXJzdCBmb3VuZCBsaWdodCBjb21wb25lbnQgaW4gdGhlIGhpZXJhcmNoeSB0cmVlIHRoYXQgc3RhcnRzIHdpdGggdGhpcyBlbnRpdHlcbiAgICAgKiBjb25zdCBsaWdodCA9IGVudGl0eS5maW5kQ29tcG9uZW50KFwibGlnaHRcIik7XG4gICAgICovXG4gICAgZmluZENvbXBvbmVudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZmluZE9uZShmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGUuYyAmJiBub2RlLmNbdHlwZV07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW50aXR5ICYmIGVudGl0eS5jW3R5cGVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZW50aXR5IGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciBhbGwgY29tcG9uZW50cyBvZiBzcGVjaWZpZWQgdHlwZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIG5hbWUgb2YgdGhlIGNvbXBvbmVudCB0eXBlIHRvIHJldHJpZXZlLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnRbXX0gQWxsIGNvbXBvbmVudHMgb2Ygc3BlY2lmaWVkIHR5cGVcbiAgICAgKiBpbiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgZGVzY2VuZGFudHMuIFJldHVybnMgZW1wdHkgYXJyYXkgaWYgbm9uZSBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCBhbGwgbGlnaHQgY29tcG9uZW50cyBpbiB0aGUgaGllcmFyY2h5IHRyZWUgdGhhdCBzdGFydHMgd2l0aCB0aGlzIGVudGl0eVxuICAgICAqIGNvbnN0IGxpZ2h0cyA9IGVudGl0eS5maW5kQ29tcG9uZW50cyhcImxpZ2h0XCIpO1xuICAgICAqL1xuICAgIGZpbmRDb21wb25lbnRzKHR5cGUpIHtcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSB0aGlzLmZpbmQoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBub2RlLmMgJiYgbm9kZS5jW3R5cGVdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVudGl0aWVzLm1hcChmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gZW50aXR5LmNbdHlwZV07XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgR1VJRCB2YWx1ZSBmb3IgdGhpcyBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgR1VJRCBvZiB0aGUgRW50aXR5LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRHdWlkKCkge1xuICAgICAgICAvLyBpZiB0aGUgZ3VpZCBoYXNuJ3QgYmVlbiBzZXQgeWV0IHRoZW4gc2V0IGl0IG5vdyBiZWZvcmUgcmV0dXJuaW5nIGl0XG4gICAgICAgIGlmICghdGhpcy5fZ3VpZCkge1xuICAgICAgICAgICAgdGhpcy5zZXRHdWlkKGd1aWQuY3JlYXRlKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2d1aWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBHVUlEIHZhbHVlIGZvciB0aGlzIEVudGl0eS4gTm90ZSB0aGF0IGl0IGlzIHVubGlrZWx5IHRoYXQgeW91IHNob3VsZCBuZWVkIHRvIGNoYW5nZVxuICAgICAqIHRoZSBHVUlEIHZhbHVlIG9mIGFuIEVudGl0eSBhdCBydW4tdGltZS4gRG9pbmcgc28gd2lsbCBjb3JydXB0IHRoZSBncmFwaCB0aGlzIEVudGl0eSBpcyBpbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBndWlkIC0gVGhlIEdVSUQgdG8gYXNzaWduIHRvIHRoZSBFbnRpdHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEd1aWQoZ3VpZCkge1xuICAgICAgICAvLyByZW1vdmUgY3VycmVudCBndWlkIGZyb20gZW50aXR5SW5kZXhcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9hcHAuX2VudGl0eUluZGV4O1xuICAgICAgICBpZiAodGhpcy5fZ3VpZCkge1xuICAgICAgICAgICAgZGVsZXRlIGluZGV4W3RoaXMuX2d1aWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIG5ldyBndWlkIHRvIGVudGl0eUluZGV4XG4gICAgICAgIHRoaXMuX2d1aWQgPSBndWlkO1xuICAgICAgICBpbmRleFt0aGlzLl9ndWlkXSA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IG5vZGUgLSBUaGUgbm9kZSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gRW5hYmxlIG9yIGRpc2FibGUgdGhlIG5vZGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbm90aWZ5SGllcmFyY2h5U3RhdGVDaGFuZ2VkKG5vZGUsIGVuYWJsZWQpIHtcbiAgICAgICAgbGV0IGVuYWJsZUZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmIChub2RlID09PSB0aGlzICYmIF9lbmFibGVMaXN0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgIGVuYWJsZUZpcnN0ID0gdHJ1ZTtcblxuICAgICAgICBub2RlLl9iZWluZ0VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIG5vZGUuX29uSGllcmFyY2h5U3RhdGVDaGFuZ2VkKGVuYWJsZWQpO1xuXG4gICAgICAgIGlmIChub2RlLl9vbkhpZXJhcmNoeVN0YXRlUG9zdENoYW5nZWQpXG4gICAgICAgICAgICBfZW5hYmxlTGlzdC5wdXNoKG5vZGUpO1xuXG4gICAgICAgIGNvbnN0IGMgPSBub2RlLl9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjW2ldLl9lbmFibGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChjW2ldLCBlbmFibGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGUuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChlbmFibGVGaXJzdCkge1xuICAgICAgICAgICAgLy8gZG8gbm90IGNhY2hlIHRoZSBsZW5ndGggaGVyZSwgYXMgZW5hYmxlTGlzdCBtYXkgYmUgYWRkZWQgdG8gZHVyaW5nIGxvb3BcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX2VuYWJsZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBfZW5hYmxlTGlzdFtpXS5fb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9lbmFibGVMaXN0Lmxlbmd0aCA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBFbmFibGUgb3IgZGlzYWJsZSB0aGUgbm9kZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKSB7XG4gICAgICAgIHN1cGVyLl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKTtcblxuICAgICAgICAvLyBlbmFibGUgLyBkaXNhYmxlIGFsbCB0aGUgY29tcG9uZW50c1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gdGhpcy5jO1xuICAgICAgICBmb3IgKGNvbnN0IHR5cGUgaW4gY29tcG9uZW50cykge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBjb21wb25lbnRzW3R5cGVdO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm9uRW5hYmxlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQub25EaXNhYmxlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkKCkge1xuICAgICAgICAvLyBwb3N0IGVuYWJsZSBhbGwgdGhlIGNvbXBvbmVudHNcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IHRoaXMuYztcbiAgICAgICAgZm9yIChjb25zdCB0eXBlIGluIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzLmhhc093blByb3BlcnR5KHR5cGUpKVxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHNbdHlwZV0ub25Qb3N0U3RhdGVDaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBkZXNjZW5kYW50IG9mIHRoaXMgZW50aXR5IHdpdGggdGhlIEdVSUQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZCAtIFRoZSBHVUlEIHRvIHNlYXJjaCBmb3IuXG4gICAgICogQHJldHVybnMge0VudGl0eXxudWxsfSBUaGUgZW50aXR5IHdpdGggdGhlIG1hdGNoaW5nIEdVSUQgb3IgbnVsbCBpZiBubyBlbnRpdHkgaXMgZm91bmQuXG4gICAgICovXG4gICAgZmluZEJ5R3VpZChndWlkKSB7XG4gICAgICAgIGlmICh0aGlzLl9ndWlkID09PSBndWlkKSByZXR1cm4gdGhpcztcblxuICAgICAgICBjb25zdCBlID0gdGhpcy5fYXBwLl9lbnRpdHlJbmRleFtndWlkXTtcbiAgICAgICAgaWYgKGUgJiYgKGUgPT09IHRoaXMgfHwgZS5pc0Rlc2NlbmRhbnRPZih0aGlzKSkpIHtcbiAgICAgICAgICAgIHJldHVybiBlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGFsbCBjb21wb25lbnRzIGZyb20gdGhlIEVudGl0eSBhbmQgZGV0YWNoIGl0IGZyb20gdGhlIEVudGl0eSBoaWVyYXJjaHkuIFRoZW5cbiAgICAgKiByZWN1cnNpdmVseSBkZXN0cm95IGFsbCBhbmNlc3RvciBFbnRpdGllcy5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZmlyc3RDaGlsZCA9IHRoaXMuZW50aXR5LmNoaWxkcmVuWzBdO1xuICAgICAqIGZpcnN0Q2hpbGQuZGVzdHJveSgpOyAvLyBkZWxldGUgY2hpbGQsIGFsbCBjb21wb25lbnRzIGFuZCByZW1vdmUgZnJvbSBoaWVyYXJjaHlcbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9kZXN0cm95aW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBEaXNhYmxlIGFsbCBlbmFibGVkIGNvbXBvbmVudHMgZmlyc3RcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuYykge1xuICAgICAgICAgICAgdGhpcy5jW25hbWVdLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBhbGwgY29tcG9uZW50c1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5jKSB7XG4gICAgICAgICAgICB0aGlzLmNbbmFtZV0uc3lzdGVtLnJlbW92ZUNvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERldGFjaCBmcm9tIHBhcmVudFxuICAgICAgICBpZiAodGhpcy5fcGFyZW50KVxuICAgICAgICAgICAgdGhpcy5fcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMpO1xuXG4gICAgICAgIC8vIHJlY3Vyc2l2ZWx5IGRlc3Ryb3kgYWxsIGNoaWxkcmVuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG4gICAgICAgIHdoaWxlIChjaGlsZHJlbi5sZW5ndGgpIHtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGEgY2hpbGQgZnJvbSB0aGUgYXJyYXkgYW5kIGRpc2Nvbm5lY3QgaXQgZnJvbSB0aGUgcGFyZW50XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IGNoaWxkcmVuLnBvcCgpO1xuICAgICAgICAgICAgY2hpbGQuX3BhcmVudCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgICAgIGNoaWxkLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZpcmUgZGVzdHJveSBldmVudFxuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knLCB0aGlzKTtcblxuICAgICAgICAvLyBjbGVhciBhbGwgZXZlbnRzXG4gICAgICAgIHRoaXMub2ZmKCk7XG5cbiAgICAgICAgLy8gcmVtb3ZlIGZyb20gZW50aXR5IGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9ndWlkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fYXBwLl9lbnRpdHlJbmRleFt0aGlzLl9ndWlkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBkZWVwIGNvcHkgb2YgdGhlIEVudGl0eS4gRHVwbGljYXRlIHRoZSBmdWxsIEVudGl0eSBoaWVyYXJjaHksIHdpdGggYWxsIENvbXBvbmVudHNcbiAgICAgKiBhbmQgYWxsIGRlc2NlbmRhbnRzLiBOb3RlLCB0aGlzIEVudGl0eSBpcyBub3QgaW4gdGhlIGhpZXJhcmNoeSBhbmQgbXVzdCBiZSBhZGRlZCBtYW51YWxseS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIG5ldyBFbnRpdHkgd2hpY2ggaXMgYSBkZWVwIGNvcHkgb2YgdGhlIG9yaWdpbmFsLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZSA9IHRoaXMuZW50aXR5LmNsb25lKCk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgY2xvbmUgYXMgYSBzaWJsaW5nIHRvIHRoZSBvcmlnaW5hbFxuICAgICAqIHRoaXMuZW50aXR5LnBhcmVudC5hZGRDaGlsZChlKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgZHVwbGljYXRlZElkc01hcCA9IHt9O1xuICAgICAgICBjb25zdCBjbG9uZSA9IHRoaXMuX2Nsb25lUmVjdXJzaXZlbHkoZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBbdGhpcy5nZXRHdWlkKCldID0gY2xvbmU7XG5cbiAgICAgICAgcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKHRoaXMsIHRoaXMsIGNsb25lLCBkdXBsaWNhdGVkSWRzTWFwKTtcblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtPYmplY3Q8c3RyaW5nLCBFbnRpdHk+fSBkdXBsaWNhdGVkSWRzTWFwIC0gQSBtYXAgb2Ygb3JpZ2luYWwgZW50aXR5IEdVSURzIHRvIGNsb25lZFxuICAgICAqIGVudGl0aWVzLlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIG5ldyBFbnRpdHkgd2hpY2ggaXMgYSBkZWVwIGNvcHkgb2YgdGhlIG9yaWdpbmFsLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lUmVjdXJzaXZlbHkoZHVwbGljYXRlZElkc01hcCkge1xuICAgICAgICAvKiogQHR5cGUge3RoaXN9ICovXG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IodW5kZWZpbmVkLCB0aGlzLl9hcHApO1xuICAgICAgICBzdXBlci5fY2xvbmVJbnRlcm5hbChjbG9uZSk7XG5cbiAgICAgICAgZm9yIChjb25zdCB0eXBlIGluIHRoaXMuYykge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gdGhpcy5jW3R5cGVdO1xuICAgICAgICAgICAgY29tcG9uZW50LnN5c3RlbS5jbG9uZUNvbXBvbmVudCh0aGlzLCBjbG9uZSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvbGRDaGlsZCA9IHRoaXMuX2NoaWxkcmVuW2ldO1xuICAgICAgICAgICAgaWYgKG9sZENoaWxkIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q2hpbGQgPSBvbGRDaGlsZC5fY2xvbmVSZWN1cnNpdmVseShkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgICAgICAgICBjbG9uZS5hZGRDaGlsZChuZXdDaGlsZCk7XG4gICAgICAgICAgICAgICAgZHVwbGljYXRlZElkc01hcFtvbGRDaGlsZC5nZXRHdWlkKCldID0gbmV3Q2hpbGQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxufVxuXG4vLyBXaGVuIGFuIGVudGl0eSB0aGF0IGhhcyBwcm9wZXJ0aWVzIHRoYXQgY29udGFpbiByZWZlcmVuY2VzIHRvIG90aGVyXG4vLyBlbnRpdGllcyB3aXRoaW4gaXRzIHN1YnRyZWUgaXMgZHVwbGljYXRlZCwgdGhlIGV4cGVjdGF0aW9uIG9mIHRoZVxuLy8gdXNlciBpcyBsaWtlbHkgdGhhdCB0aG9zZSBwcm9wZXJ0aWVzIHdpbGwgYmUgdXBkYXRlZCB0byBwb2ludCB0b1xuLy8gdGhlIGNvcnJlc3BvbmRpbmcgZW50aXRpZXMgd2l0aGluIHRoZSBuZXdseS1jcmVhdGVkIGR1cGxpY2F0ZSBzdWJ0cmVlLlxuLy9cbi8vIFRvIGhhbmRsZSB0aGlzLCB3ZSBuZWVkIHRvIHNlYXJjaCBmb3IgcHJvcGVydGllcyB0aGF0IHJlZmVyIHRvIGVudGl0aWVzXG4vLyB3aXRoaW4gdGhlIG9sZCBkdXBsaWNhdGVkIHN0cnVjdHVyZSwgZmluZCB0aGVpciBuZXdseS1jbG9uZWQgcGFydG5lcnNcbi8vIHdpdGhpbiB0aGUgbmV3IHN0cnVjdHVyZSwgYW5kIHVwZGF0ZSB0aGUgcmVmZXJlbmNlcyBhY2NvcmRpbmdseS4gVGhpc1xuLy8gZnVuY3Rpb24gaW1wbGVtZW50cyB0aGF0IHJlcXVpcmVtZW50LlxuZnVuY3Rpb24gcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKG9sZFN1YnRyZWVSb290LCBvbGRFbnRpdHksIG5ld0VudGl0eSwgZHVwbGljYXRlZElkc01hcCkge1xuICAgIGlmIChvbGRFbnRpdHkgaW5zdGFuY2VvZiBFbnRpdHkpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG9sZEVudGl0eS5jO1xuXG4gICAgICAgIC8vIEhhbmRsZSBjb21wb25lbnQgcHJvcGVydGllc1xuICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudE5hbWUgaW4gY29tcG9uZW50cykge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVByb3BlcnRpZXMgPSBjb21wb25lbnQuc3lzdGVtLmdldFByb3BlcnRpZXNPZlR5cGUoJ2VudGl0eScpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZW50aXR5UHJvcGVydGllcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5RGVzY3JpcHRvciA9IGVudGl0eVByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcGVydHlOYW1lID0gcHJvcGVydHlEZXNjcmlwdG9yLm5hbWU7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkRW50aXR5UmVmZXJlbmNlSWQgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlJc1dpdGhpbk9sZFN1YnRyZWUgPSAhIW9sZFN1YnRyZWVSb290LmZpbmRCeUd1aWQob2xkRW50aXR5UmVmZXJlbmNlSWQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eUlzV2l0aGluT2xkU3VidHJlZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdFbnRpdHlSZWZlcmVuY2VJZCA9IGR1cGxpY2F0ZWRJZHNNYXBbb2xkRW50aXR5UmVmZXJlbmNlSWRdLmdldEd1aWQoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3RW50aXR5UmVmZXJlbmNlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0VudGl0eS5jW2NvbXBvbmVudE5hbWVdW3Byb3BlcnR5TmFtZV0gPSBuZXdFbnRpdHlSZWZlcmVuY2VJZDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0NvdWxkIG5vdCBmaW5kIGNvcnJlc3BvbmRpbmcgZW50aXR5IGlkIHdoZW4gcmVzb2x2aW5nIGR1cGxpY2F0ZWQgZW50aXR5IHJlZmVyZW5jZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSBlbnRpdHkgc2NyaXB0IGF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGNvbXBvbmVudHMuc2NyaXB0ICYmICFuZXdFbnRpdHkuX2FwcC51c2VMZWdhY3lTY3JpcHRBdHRyaWJ1dGVDbG9uaW5nKSB7XG4gICAgICAgICAgICBuZXdFbnRpdHkuc2NyaXB0LnJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhjb21wb25lbnRzLnNjcmlwdCwgZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgZW50aXR5IHJlbmRlciBhdHRyaWJ1dGVzXG4gICAgICAgIGlmIChjb21wb25lbnRzLnJlbmRlcikge1xuICAgICAgICAgICAgbmV3RW50aXR5LnJlbmRlci5yZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMoY29tcG9uZW50cy5yZW5kZXIsIGR1cGxpY2F0ZWRJZHNNYXApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGFuZGxlIGVudGl0eSBhbmltIGF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGNvbXBvbmVudHMuYW5pbSkge1xuICAgICAgICAgICAgbmV3RW50aXR5LmFuaW0ucmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKGNvbXBvbmVudHMuYW5pbSwgZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWN1cnNlIGludG8gY2hpbGRyZW4uIE5vdGUgdGhhdCB3ZSBjb250aW51ZSB0byBwYXNzIGluIHRoZSBzYW1lIGBvbGRTdWJ0cmVlUm9vdGAsXG4gICAgICAgIC8vIGluIG9yZGVyIHRvIGNvcnJlY3RseSBoYW5kbGUgY2FzZXMgd2hlcmUgYSBjaGlsZCBoYXMgYW4gZW50aXR5IHJlZmVyZW5jZVxuICAgICAgICAvLyBmaWVsZCB0aGF0IHBvaW50cyB0byBhIHBhcmVudCBvciBvdGhlciBhbmNlc3RvciB0aGF0IGlzIHN0aWxsIHdpdGhpbiB0aGVcbiAgICAgICAgLy8gZHVwbGljYXRlZCBzdWJ0cmVlLlxuICAgICAgICBjb25zdCBfb2xkID0gb2xkRW50aXR5LmNoaWxkcmVuLmZpbHRlcihmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIChlIGluc3RhbmNlb2YgRW50aXR5KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IF9uZXcgPSBuZXdFbnRpdHkuY2hpbGRyZW4uZmlsdGVyKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gKGUgaW5zdGFuY2VvZiBFbnRpdHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gX29sZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKG9sZFN1YnRyZWVSb290LCBfb2xkW2ldLCBfbmV3W2ldLCBkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBGaXJlZCBhZnRlciB0aGUgZW50aXR5IGlzIGRlc3Ryb3llZC5cbiAqXG4gKiBAZXZlbnQgRW50aXR5I2Rlc3Ryb3lcbiAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoYXQgd2FzIGRlc3Ryb3llZC5cbiAqIEBleGFtcGxlXG4gKiBlbnRpdHkub24oXCJkZXN0cm95XCIsIGZ1bmN0aW9uIChlKSB7XG4gKiAgICAgY29uc29sZS5sb2coJ2VudGl0eSAnICsgZS5uYW1lICsgJyBoYXMgYmVlbiBkZXN0cm95ZWQnKTtcbiAqIH0pO1xuICovXG5cbmV4cG9ydCB7IEVudGl0eSB9O1xuIl0sIm5hbWVzIjpbIl9lbmFibGVMaXN0IiwiRW50aXR5IiwiR3JhcGhOb2RlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiYXBwIiwiZ2V0QXBwbGljYXRpb24iLCJhbmltIiwiYW5pbWF0aW9uIiwiYXVkaW9saXN0ZW5lciIsImJ1dHRvbiIsImNhbWVyYSIsImNvbGxpc2lvbiIsImVsZW1lbnQiLCJsYXlvdXRjaGlsZCIsImxheW91dGdyb3VwIiwibGlnaHQiLCJtb2RlbCIsInBhcnRpY2xlc3lzdGVtIiwicmVuZGVyIiwicmlnaWRib2R5Iiwic2NyZWVuIiwic2NyaXB0Iiwic2Nyb2xsYmFyIiwic2Nyb2xsdmlldyIsInNvdW5kIiwic3ByaXRlIiwiYyIsIl9hcHAiLCJfZGVzdHJveWluZyIsIl9ndWlkIiwiX3RlbXBsYXRlIiwiRGVidWciLCJhc3NlcnQiLCJhZGRDb21wb25lbnQiLCJ0eXBlIiwiZGF0YSIsInN5c3RlbSIsInN5c3RlbXMiLCJlcnJvciIsIndhcm4iLCJyZW1vdmVDb21wb25lbnQiLCJmaW5kQ29tcG9uZW50IiwiZW50aXR5IiwiZmluZE9uZSIsIm5vZGUiLCJmaW5kQ29tcG9uZW50cyIsImVudGl0aWVzIiwiZmluZCIsIm1hcCIsImdldEd1aWQiLCJzZXRHdWlkIiwiZ3VpZCIsImNyZWF0ZSIsImluZGV4IiwiX2VudGl0eUluZGV4IiwiX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsImVuYWJsZWQiLCJlbmFibGVGaXJzdCIsImxlbmd0aCIsIl9iZWluZ0VuYWJsZWQiLCJfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQiLCJfb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkIiwicHVzaCIsIl9jaGlsZHJlbiIsImkiLCJsZW4iLCJfZW5hYmxlZCIsImNvbXBvbmVudHMiLCJoYXNPd25Qcm9wZXJ0eSIsImNvbXBvbmVudCIsIm9uRW5hYmxlIiwib25EaXNhYmxlIiwib25Qb3N0U3RhdGVDaGFuZ2UiLCJmaW5kQnlHdWlkIiwiZSIsImlzRGVzY2VuZGFudE9mIiwiZGVzdHJveSIsIl9wYXJlbnQiLCJyZW1vdmVDaGlsZCIsImNoaWxkcmVuIiwiY2hpbGQiLCJwb3AiLCJmaXJlIiwib2ZmIiwiY2xvbmUiLCJkdXBsaWNhdGVkSWRzTWFwIiwiX2Nsb25lUmVjdXJzaXZlbHkiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJ1bmRlZmluZWQiLCJfY2xvbmVJbnRlcm5hbCIsImNsb25lQ29tcG9uZW50Iiwib2xkQ2hpbGQiLCJuZXdDaGlsZCIsImFkZENoaWxkIiwib2xkU3VidHJlZVJvb3QiLCJvbGRFbnRpdHkiLCJuZXdFbnRpdHkiLCJjb21wb25lbnROYW1lIiwiZW50aXR5UHJvcGVydGllcyIsImdldFByb3BlcnRpZXNPZlR5cGUiLCJwcm9wZXJ0eURlc2NyaXB0b3IiLCJwcm9wZXJ0eU5hbWUiLCJvbGRFbnRpdHlSZWZlcmVuY2VJZCIsImVudGl0eUlzV2l0aGluT2xkU3VidHJlZSIsIm5ld0VudGl0eVJlZmVyZW5jZUlkIiwidXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyIsIl9vbGQiLCJmaWx0ZXIiLCJfbmV3Il0sIm1hcHBpbmdzIjoiOzs7OztBQU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsV0FBVyxHQUFHLEVBQUUsQ0FBQTs7QUFFdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsTUFBTSxTQUFTQyxTQUFTLENBQUM7QUFDM0I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxJQUFJLEVBQUVDLEdBQUcsR0FBR0MsY0FBYyxFQUFFLEVBQUU7SUFDdEMsS0FBSyxDQUFDRixJQUFJLENBQUMsQ0FBQTtBQUFDLElBQUEsSUFBQSxDQWpPaEJHLElBQUksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFKQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRVEMsYUFBYSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUWJDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFOQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVRDLE9BQU8sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFQQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRWEMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVhDLEtBQUssR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFMQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTEMsY0FBYyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUWRDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFOQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRVEMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUU5DLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFOQyxTQUFTLEdBQUEsS0FBQSxDQUFB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
