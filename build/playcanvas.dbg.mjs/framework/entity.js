/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
   * var entity = new pc.Entity();
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
   * var p = entity.getPosition();
   * entity.setPosition(p.x + 10, p.y, p.z);
   *
   * // Change the entity's rotation in local space
   * var e = entity.getLocalEulerAngles();
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
   * var entity = new pc.Entity();
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
   * var entity = new pc.Entity();
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
   * var light = entity.findComponent("light");
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
   * var lights = entity.findComponents("light");
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
   * var firstChild = this.entity.children[0];
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
   * var e = this.entity.clone();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50aXR5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2VudGl0eS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgZ3VpZCB9IGZyb20gJy4uL2NvcmUvZ3VpZC5qcyc7XG5cbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuXG5pbXBvcnQgeyBnZXRBcHBsaWNhdGlvbiB9IGZyb20gJy4vZ2xvYmFscy5qcyc7XG5cbi8qKlxuICogQHR5cGUge0dyYXBoTm9kZVtdfVxuICogQGlnbm9yZVxuICovXG5jb25zdCBfZW5hYmxlTGlzdCA9IFtdO1xuXG4vKipcbiAqIFRoZSBFbnRpdHkgaXMgdGhlIGNvcmUgcHJpbWl0aXZlIG9mIGEgUGxheUNhbnZhcyBnYW1lLiBHZW5lcmFsbHkgc3BlYWtpbmcgYW4gb2JqZWN0IGluIHlvdXIgZ2FtZVxuICogd2lsbCBjb25zaXN0IG9mIGFuIHtAbGluayBFbnRpdHl9LCBhbmQgYSBzZXQgb2Yge0BsaW5rIENvbXBvbmVudH1zIHdoaWNoIGFyZSBtYW5hZ2VkIGJ5IHRoZWlyXG4gKiByZXNwZWN0aXZlIHtAbGluayBDb21wb25lbnRTeXN0ZW19cy4gT25lIG9mIHRob3NlIGNvbXBvbmVudHMgbWF5YmUgYSB7QGxpbmsgU2NyaXB0Q29tcG9uZW50fVxuICogd2hpY2ggYWxsb3dzIHlvdSB0byB3cml0ZSBjdXN0b20gY29kZSB0byBhdHRhY2ggdG8geW91ciBFbnRpdHkuXG4gKlxuICogVGhlIEVudGl0eSB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSBvYmplY3QgYW5kIGFsc28gcHJvdmlkZXMgYSB0cmFuc2Zvcm0gZm9yIHBvc2l0aW9uIGFuZFxuICogb3JpZW50YXRpb24gd2hpY2ggaXQgaW5oZXJpdHMgZnJvbSB7QGxpbmsgR3JhcGhOb2RlfSBzbyBjYW4gYmUgYWRkZWQgaW50byB0aGUgc2NlbmUgZ3JhcGguIFRoZVxuICogQ29tcG9uZW50IGFuZCBDb21wb25lbnRTeXN0ZW0gcHJvdmlkZSB0aGUgbG9naWMgdG8gZ2l2ZSBhbiBFbnRpdHkgYSBzcGVjaWZpYyB0eXBlIG9mIGJlaGF2aW9yLlxuICogZS5nLiB0aGUgYWJpbGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBwbGF5IGEgc291bmQuIENvbXBvbmVudHMgYXJlIHNwZWNpZmljIHRvIGFuIGluc3RhbmNlIG9mIGFuXG4gKiBFbnRpdHkgYW5kIGFyZSBhdHRhY2hlZCAoZS5nLiBgdGhpcy5lbnRpdHkubW9kZWxgKSBDb21wb25lbnRTeXN0ZW1zIGFsbG93IGFjY2VzcyB0byBhbGwgRW50aXRpZXNcbiAqIGFuZCBDb21wb25lbnRzIGFuZCBhcmUgYXR0YWNoZWQgdG8gdGhlIHtAbGluayBBcHBCYXNlfS5cbiAqXG4gKiBAYXVnbWVudHMgR3JhcGhOb2RlXG4gKi9cbmNsYXNzIEVudGl0eSBleHRlbmRzIEdyYXBoTm9kZSB7XG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEFuaW1Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2FuaW0vY29tcG9uZW50LmpzJykuQW5pbUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYW5pbTtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBbmltYXRpb25Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2FuaW1hdGlvbi9jb21wb25lbnQuanMnKS5BbmltYXRpb25Db21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGFuaW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9hdWRpby1saXN0ZW5lci9jb21wb25lbnQuanMnKS5BdWRpb0xpc3RlbmVyQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBhdWRpb2xpc3RlbmVyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvYnV0dG9uL2NvbXBvbmVudC5qcycpLkJ1dHRvbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgYnV0dG9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY2FtZXJhO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvY29sbGlzaW9uL2NvbXBvbmVudC5qcycpLkNvbGxpc2lvbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgY29sbGlzaW9uO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgZWxlbWVudDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGF5b3V0LWNoaWxkL2NvbXBvbmVudC5qcycpLkxheW91dENoaWxkQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRjaGlsZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGF5b3V0LWdyb3VwL2NvbXBvbmVudC5qcycpLkxheW91dEdyb3VwQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBsYXlvdXRncm91cDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBMaWdodENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJykuTGlnaHRDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGxpZ2h0O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIE1vZGVsQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9tb2RlbC9jb21wb25lbnQuanMnKS5Nb2RlbENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbW9kZWw7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3BhcnRpY2xlLXN5c3RlbS9jb21wb25lbnQuanMnKS5QYXJ0aWNsZVN5c3RlbUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcGFydGljbGVzeXN0ZW07XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUmVuZGVyQ29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJykuUmVuZGVyQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICByZW5kZXI7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50fSBhdHRhY2hlZCB0byB0aGlzIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcycpLlJpZ2lkQm9keUNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgcmlnaWRib2R5O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmVlbkNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2NyZWVuL2NvbXBvbmVudC5qcycpLlNjcmVlbkNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2NyZWVuO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcmlwdENvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcycpLlNjcmlwdENvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2NyaXB0O1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbGJhckNvbXBvbmVudH0gYXR0YWNoZWQgdG8gdGhpcyBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvbmVudHMvc2Nyb2xsYmFyL2NvbXBvbmVudC5qcycpLlNjcm9sbGJhckNvbXBvbmVudHx1bmRlZmluZWR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc2Nyb2xsYmFyO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUge0BsaW5rIFNjcm9sbFZpZXdDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3Njcm9sbC12aWV3L2NvbXBvbmVudC5qcycpLlNjcm9sbFZpZXdDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNjcm9sbHZpZXc7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB7QGxpbmsgU291bmRDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3NvdW5kL2NvbXBvbmVudC5qcycpLlNvdW5kQ29tcG9uZW50fHVuZGVmaW5lZH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzb3VuZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHtAbGluayBTcHJpdGVDb21wb25lbnR9IGF0dGFjaGVkIHRvIHRoaXMgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3Nwcml0ZS9jb21wb25lbnQuanMnKS5TcHJpdGVDb21wb25lbnR8dW5kZWZpbmVkfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNwcml0ZTtcblxuICAgIC8qKlxuICAgICAqIENvbXBvbmVudCBzdG9yYWdlLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIGltcG9ydCgnLi9jb21wb25lbnRzL2NvbXBvbmVudC5qcycpLkNvbXBvbmVudD59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FwcDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkgY29tcG9uZW50IHN5c3RlbXMgdG8gc3BlZWQgdXAgZGVzdHJ1Y3Rpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2Rlc3Ryb3lpbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ndWlkID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIHRoZSBlbnRpdGllcyBvZiBhIHRlbXBsYXRlIHJvb3QgaW5zdGFuY2UsIHdoaWNoIGhhdmUgaXQgc2V0IHRvXG4gICAgICogdHJ1ZSwgYW5kIHRoZSBjbG9uZWQgaW5zdGFuY2UgZW50aXRpZXMgKHNldCB0byBmYWxzZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3RlbXBsYXRlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBub24tdW5pcXVlIG5hbWUgb2YgdGhlIGVudGl0eSwgZGVmYXVsdCBpcyBcIlVudGl0bGVkXCIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBbYXBwXSAtIFRoZSBhcHBsaWNhdGlvbiB0aGUgZW50aXR5IGJlbG9uZ3MgdG8sXG4gICAgICogZGVmYXVsdCBpcyB0aGUgY3VycmVudCBhcHBsaWNhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgYSBDb21wb25lbnQgdG8gdGhlIEVudGl0eVxuICAgICAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjYW1lcmFcIiwge1xuICAgICAqICAgICBmb3Y6IDQ1LFxuICAgICAqICAgICBuZWFyQ2xpcDogMSxcbiAgICAgKiAgICAgZmFyQ2xpcDogMTAwMDBcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCB0aGUgRW50aXR5IGludG8gdGhlIHNjZW5lIGdyYXBoXG4gICAgICogYXBwLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKlxuICAgICAqIC8vIE1vdmUgdGhlIGVudGl0eVxuICAgICAqIGVudGl0eS50cmFuc2xhdGUoMTAsIDAsIDApO1xuICAgICAqXG4gICAgICogLy8gT3IgdHJhbnNsYXRlIGl0IGJ5IHNldHRpbmcgaXRzIHBvc2l0aW9uIGRpcmVjdGx5XG4gICAgICogdmFyIHAgPSBlbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgKiBlbnRpdHkuc2V0UG9zaXRpb24ocC54ICsgMTAsIHAueSwgcC56KTtcbiAgICAgKlxuICAgICAqIC8vIENoYW5nZSB0aGUgZW50aXR5J3Mgcm90YXRpb24gaW4gbG9jYWwgc3BhY2VcbiAgICAgKiB2YXIgZSA9IGVudGl0eS5nZXRMb2NhbEV1bGVyQW5nbGVzKCk7XG4gICAgICogZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoZS54LCBlLnkgKyA5MCwgZS56KTtcbiAgICAgKlxuICAgICAqIC8vIE9yIHVzZSByb3RhdGVMb2NhbFxuICAgICAqIGVudGl0eS5yb3RhdGVMb2NhbCgwLCA5MCwgMCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSwgYXBwID0gZ2V0QXBwbGljYXRpb24oKSkge1xuICAgICAgICBzdXBlcihuYW1lKTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoYXBwLCAnQ291bGQgbm90IGZpbmQgY3VycmVudCBhcHBsaWNhdGlvbicpO1xuICAgICAgICB0aGlzLl9hcHAgPSBhcHA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGNvbXBvbmVudCBhbmQgYWRkIGl0IHRvIHRoZSBlbnRpdHkuIFVzZSB0aGlzIHRvIGFkZCBmdW5jdGlvbmFsaXR5IHRvIHRoZSBlbnRpdHlcbiAgICAgKiBsaWtlIHJlbmRlcmluZyBhIG1vZGVsLCBwbGF5aW5nIHNvdW5kcyBhbmQgc28gb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBuYW1lIG9mIHRoZSBjb21wb25lbnQgdG8gYWRkLiBWYWxpZCBzdHJpbmdzIGFyZTpcbiAgICAgKlxuICAgICAqIC0gXCJhbmltXCIgLSBzZWUge0BsaW5rIEFuaW1Db21wb25lbnR9XG4gICAgICogLSBcImFuaW1hdGlvblwiIC0gc2VlIHtAbGluayBBbmltYXRpb25Db21wb25lbnR9XG4gICAgICogLSBcImF1ZGlvbGlzdGVuZXJcIiAtIHNlZSB7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudH1cbiAgICAgKiAtIFwiYnV0dG9uXCIgLSBzZWUge0BsaW5rIEJ1dHRvbkNvbXBvbmVudH1cbiAgICAgKiAtIFwiY2FtZXJhXCIgLSBzZWUge0BsaW5rIENhbWVyYUNvbXBvbmVudH1cbiAgICAgKiAtIFwiY29sbGlzaW9uXCIgLSBzZWUge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH1cbiAgICAgKiAtIFwiZWxlbWVudFwiIC0gc2VlIHtAbGluayBFbGVtZW50Q29tcG9uZW50fVxuICAgICAqIC0gXCJsYXlvdXRjaGlsZFwiIC0gc2VlIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH1cbiAgICAgKiAtIFwibGF5b3V0Z3JvdXBcIiAtIHNlZSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9XG4gICAgICogLSBcImxpZ2h0XCIgLSBzZWUge0BsaW5rIExpZ2h0Q29tcG9uZW50fVxuICAgICAqIC0gXCJtb2RlbFwiIC0gc2VlIHtAbGluayBNb2RlbENvbXBvbmVudH1cbiAgICAgKiAtIFwicGFydGljbGVzeXN0ZW1cIiAtIHNlZSB7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnR9XG4gICAgICogLSBcInJlbmRlclwiIC0gc2VlIHtAbGluayBSZW5kZXJDb21wb25lbnR9XG4gICAgICogLSBcInJpZ2lkYm9keVwiIC0gc2VlIHtAbGluayBSaWdpZEJvZHlDb21wb25lbnR9XG4gICAgICogLSBcInNjcmVlblwiIC0gc2VlIHtAbGluayBTY3JlZW5Db21wb25lbnR9XG4gICAgICogLSBcInNjcmlwdFwiIC0gc2VlIHtAbGluayBTY3JpcHRDb21wb25lbnR9XG4gICAgICogLSBcInNjcm9sbGJhclwiIC0gc2VlIHtAbGluayBTY3JvbGxiYXJDb21wb25lbnR9XG4gICAgICogLSBcInNjcm9sbHZpZXdcIiAtIHNlZSB7QGxpbmsgU2Nyb2xsVmlld0NvbXBvbmVudH1cbiAgICAgKiAtIFwic291bmRcIiAtIHNlZSB7QGxpbmsgU291bmRDb21wb25lbnR9XG4gICAgICogLSBcInNwcml0ZVwiIC0gc2VlIHtAbGluayBTcHJpdGVDb21wb25lbnR9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2RhdGFdIC0gVGhlIGluaXRpYWxpemF0aW9uIGRhdGEgZm9yIHRoZSBzcGVjaWZpYyBjb21wb25lbnQgdHlwZS4gUmVmZXIgdG9cbiAgICAgKiBlYWNoIHNwZWNpZmljIGNvbXBvbmVudCdzIEFQSSByZWZlcmVuY2UgcGFnZSBmb3IgZGV0YWlscyBvbiB2YWxpZCB2YWx1ZXMgZm9yIHRoaXMgcGFyYW1ldGVyLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnR8bnVsbH0gVGhlIG5ldyBDb21wb25lbnQgdGhhdCB3YXNcbiAgICAgKiBhdHRhY2hlZCB0byB0aGUgZW50aXR5IG9yIG51bGwgaWYgdGhlcmUgd2FzIGFuIGVycm9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBhIGxpZ2h0IGNvbXBvbmVudCB3aXRoIGRlZmF1bHQgcHJvcGVydGllc1xuICAgICAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJsaWdodFwiKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBhIGNhbWVyYSBjb21wb25lbnQgd2l0aCBzb21lIHNwZWNpZmllZCBwcm9wZXJ0aWVzXG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudChcImNhbWVyYVwiLCB7XG4gICAgICogICAgIGZvdjogNDUsXG4gICAgICogICAgIGNsZWFyQ29sb3I6IG5ldyBwYy5Db2xvcigxLCAwLCAwKVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGFkZENvbXBvbmVudCh0eXBlLCBkYXRhKSB7XG4gICAgICAgIGNvbnN0IHN5c3RlbSA9IHRoaXMuX2FwcC5zeXN0ZW1zW3R5cGVdO1xuICAgICAgICBpZiAoIXN5c3RlbSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYGFkZENvbXBvbmVudDogU3lzdGVtICcke3R5cGV9JyBkb2Vzbid0IGV4aXN0YCk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5jW3R5cGVdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBhZGRDb21wb25lbnQ6IEVudGl0eSBhbHJlYWR5IGhhcyAnJHt0eXBlfScgY29tcG9uZW50YCk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3lzdGVtLmFkZENvbXBvbmVudCh0aGlzLCBkYXRhKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSB0aGUgRW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgbmFtZSBvZiB0aGUgQ29tcG9uZW50IHR5cGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZW50aXR5ID0gbmV3IHBjLkVudGl0eSgpO1xuICAgICAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJsaWdodFwiKTsgLy8gYWRkIG5ldyBsaWdodCBjb21wb25lbnRcbiAgICAgKlxuICAgICAqIGVudGl0eS5yZW1vdmVDb21wb25lbnQoXCJsaWdodFwiKTsgLy8gcmVtb3ZlIGxpZ2h0IGNvbXBvbmVudFxuICAgICAqL1xuICAgIHJlbW92ZUNvbXBvbmVudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IHN5c3RlbSA9IHRoaXMuX2FwcC5zeXN0ZW1zW3R5cGVdO1xuICAgICAgICBpZiAoIXN5c3RlbSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYGFkZENvbXBvbmVudDogU3lzdGVtICcke3R5cGV9JyBkb2Vzbid0IGV4aXN0YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmNbdHlwZV0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYHJlbW92ZUNvbXBvbmVudDogRW50aXR5IGRvZXNuJ3QgaGF2ZSAnJHt0eXBlfScgY29tcG9uZW50YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc3lzdGVtLnJlbW92ZUNvbXBvbmVudCh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWFyY2ggdGhlIGVudGl0eSBhbmQgYWxsIG9mIGl0cyBkZXNjZW5kYW50cyBmb3IgdGhlIGZpcnN0IGNvbXBvbmVudCBvZiBzcGVjaWZpZWQgdHlwZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIG5hbWUgb2YgdGhlIGNvbXBvbmVudCB0eXBlIHRvIHJldHJpZXZlLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnR9IEEgY29tcG9uZW50IG9mIHNwZWNpZmllZCB0eXBlLCBpZlxuICAgICAqIHRoZSBlbnRpdHkgb3IgYW55IG9mIGl0cyBkZXNjZW5kYW50cyBoYXMgb25lLiBSZXR1cm5zIHVuZGVmaW5lZCBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBHZXQgdGhlIGZpcnN0IGZvdW5kIGxpZ2h0IGNvbXBvbmVudCBpbiB0aGUgaGllcmFyY2h5IHRyZWUgdGhhdCBzdGFydHMgd2l0aCB0aGlzIGVudGl0eVxuICAgICAqIHZhciBsaWdodCA9IGVudGl0eS5maW5kQ29tcG9uZW50KFwibGlnaHRcIik7XG4gICAgICovXG4gICAgZmluZENvbXBvbmVudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZmluZE9uZShmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGUuYyAmJiBub2RlLmNbdHlwZV07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW50aXR5ICYmIGVudGl0eS5jW3R5cGVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaCB0aGUgZW50aXR5IGFuZCBhbGwgb2YgaXRzIGRlc2NlbmRhbnRzIGZvciBhbGwgY29tcG9uZW50cyBvZiBzcGVjaWZpZWQgdHlwZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIG5hbWUgb2YgdGhlIGNvbXBvbmVudCB0eXBlIHRvIHJldHJpZXZlLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vY29tcG9uZW50cy9jb21wb25lbnQuanMnKS5Db21wb25lbnRbXX0gQWxsIGNvbXBvbmVudHMgb2Ygc3BlY2lmaWVkIHR5cGVcbiAgICAgKiBpbiB0aGUgZW50aXR5IG9yIGFueSBvZiBpdHMgZGVzY2VuZGFudHMuIFJldHVybnMgZW1wdHkgYXJyYXkgaWYgbm9uZSBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCBhbGwgbGlnaHQgY29tcG9uZW50cyBpbiB0aGUgaGllcmFyY2h5IHRyZWUgdGhhdCBzdGFydHMgd2l0aCB0aGlzIGVudGl0eVxuICAgICAqIHZhciBsaWdodHMgPSBlbnRpdHkuZmluZENvbXBvbmVudHMoXCJsaWdodFwiKTtcbiAgICAgKi9cbiAgICBmaW5kQ29tcG9uZW50cyh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gdGhpcy5maW5kKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gbm9kZS5jICYmIG5vZGUuY1t0eXBlXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbnRpdGllcy5tYXAoZnVuY3Rpb24gKGVudGl0eSkge1xuICAgICAgICAgICAgcmV0dXJuIGVudGl0eS5jW3R5cGVdO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIEdVSUQgdmFsdWUgZm9yIHRoaXMgRW50aXR5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIEdVSUQgb2YgdGhlIEVudGl0eS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0R3VpZCgpIHtcbiAgICAgICAgLy8gaWYgdGhlIGd1aWQgaGFzbid0IGJlZW4gc2V0IHlldCB0aGVuIHNldCBpdCBub3cgYmVmb3JlIHJldHVybmluZyBpdFxuICAgICAgICBpZiAoIXRoaXMuX2d1aWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0R3VpZChndWlkLmNyZWF0ZSgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9ndWlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgR1VJRCB2YWx1ZSBmb3IgdGhpcyBFbnRpdHkuIE5vdGUgdGhhdCBpdCBpcyB1bmxpa2VseSB0aGF0IHlvdSBzaG91bGQgbmVlZCB0byBjaGFuZ2VcbiAgICAgKiB0aGUgR1VJRCB2YWx1ZSBvZiBhbiBFbnRpdHkgYXQgcnVuLXRpbWUuIERvaW5nIHNvIHdpbGwgY29ycnVwdCB0aGUgZ3JhcGggdGhpcyBFbnRpdHkgaXMgaW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZCAtIFRoZSBHVUlEIHRvIGFzc2lnbiB0byB0aGUgRW50aXR5LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRHdWlkKGd1aWQpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGN1cnJlbnQgZ3VpZCBmcm9tIGVudGl0eUluZGV4XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fYXBwLl9lbnRpdHlJbmRleDtcbiAgICAgICAgaWYgKHRoaXMuX2d1aWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBpbmRleFt0aGlzLl9ndWlkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCBuZXcgZ3VpZCB0byBlbnRpdHlJbmRleFxuICAgICAgICB0aGlzLl9ndWlkID0gZ3VpZDtcbiAgICAgICAgaW5kZXhbdGhpcy5fZ3VpZF0gPSB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBub2RlIC0gVGhlIG5vZGUgdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIEVuYWJsZSBvciBkaXNhYmxlIHRoZSBub2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZChub2RlLCBlbmFibGVkKSB7XG4gICAgICAgIGxldCBlbmFibGVGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAobm9kZSA9PT0gdGhpcyAmJiBfZW5hYmxlTGlzdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICBlbmFibGVGaXJzdCA9IHRydWU7XG5cbiAgICAgICAgbm9kZS5fYmVpbmdFbmFibGVkID0gdHJ1ZTtcblxuICAgICAgICBub2RlLl9vbkhpZXJhcmNoeVN0YXRlQ2hhbmdlZChlbmFibGVkKTtcblxuICAgICAgICBpZiAobm9kZS5fb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkKVxuICAgICAgICAgICAgX2VuYWJsZUxpc3QucHVzaChub2RlKTtcblxuICAgICAgICBjb25zdCBjID0gbm9kZS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY1tpXS5fZW5hYmxlZClcbiAgICAgICAgICAgICAgICB0aGlzLl9ub3RpZnlIaWVyYXJjaHlTdGF0ZUNoYW5nZWQoY1tpXSwgZW5hYmxlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBub2RlLl9iZWluZ0VuYWJsZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAoZW5hYmxlRmlyc3QpIHtcbiAgICAgICAgICAgIC8vIGRvIG5vdCBjYWNoZSB0aGUgbGVuZ3RoIGhlcmUsIGFzIGVuYWJsZUxpc3QgbWF5IGJlIGFkZGVkIHRvIGR1cmluZyBsb29wXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IF9lbmFibGVMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgX2VuYWJsZUxpc3RbaV0uX29uSGllcmFyY2h5U3RhdGVQb3N0Q2hhbmdlZCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfZW5hYmxlTGlzdC5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gRW5hYmxlIG9yIGRpc2FibGUgdGhlIG5vZGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQoZW5hYmxlZCkge1xuICAgICAgICBzdXBlci5fb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQoZW5hYmxlZCk7XG5cbiAgICAgICAgLy8gZW5hYmxlIC8gZGlzYWJsZSBhbGwgdGhlIGNvbXBvbmVudHNcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IHRoaXMuYztcbiAgICAgICAgZm9yIChjb25zdCB0eXBlIGluIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gY29tcG9uZW50c1t0eXBlXTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5vbkVuYWJsZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm9uRGlzYWJsZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uSGllcmFyY2h5U3RhdGVQb3N0Q2hhbmdlZCgpIHtcbiAgICAgICAgLy8gcG9zdCBlbmFibGUgYWxsIHRoZSBjb21wb25lbnRzXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0aGlzLmM7XG4gICAgICAgIGZvciAoY29uc3QgdHlwZSBpbiBjb21wb25lbnRzKSB7XG4gICAgICAgICAgICBpZiAoY29tcG9uZW50cy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSlcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzW3R5cGVdLm9uUG9zdFN0YXRlQ2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIGEgZGVzY2VuZGFudCBvZiB0aGlzIGVudGl0eSB3aXRoIHRoZSBHVUlELlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtFbnRpdHl8bnVsbH0gVGhlIGVudGl0eSB3aXRoIHRoZSBtYXRjaGluZyBHVUlEIG9yIG51bGwgaWYgbm8gZW50aXR5IGlzIGZvdW5kLlxuICAgICAqL1xuICAgIGZpbmRCeUd1aWQoZ3VpZCkge1xuICAgICAgICBpZiAodGhpcy5fZ3VpZCA9PT0gZ3VpZCkgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgY29uc3QgZSA9IHRoaXMuX2FwcC5fZW50aXR5SW5kZXhbZ3VpZF07XG4gICAgICAgIGlmIChlICYmIChlID09PSB0aGlzIHx8IGUuaXNEZXNjZW5kYW50T2YodGhpcykpKSB7XG4gICAgICAgICAgICByZXR1cm4gZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhbGwgY29tcG9uZW50cyBmcm9tIHRoZSBFbnRpdHkgYW5kIGRldGFjaCBpdCBmcm9tIHRoZSBFbnRpdHkgaGllcmFyY2h5LiBUaGVuXG4gICAgICogcmVjdXJzaXZlbHkgZGVzdHJveSBhbGwgYW5jZXN0b3IgRW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBmaXJzdENoaWxkID0gdGhpcy5lbnRpdHkuY2hpbGRyZW5bMF07XG4gICAgICogZmlyc3RDaGlsZC5kZXN0cm95KCk7IC8vIGRlbGV0ZSBjaGlsZCwgYWxsIGNvbXBvbmVudHMgYW5kIHJlbW92ZSBmcm9tIGhpZXJhcmNoeVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lpbmcgPSB0cnVlO1xuXG4gICAgICAgIC8vIERpc2FibGUgYWxsIGVuYWJsZWQgY29tcG9uZW50cyBmaXJzdFxuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5jKSB7XG4gICAgICAgICAgICB0aGlzLmNbbmFtZV0uZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIGFsbCBjb21wb25lbnRzXG4gICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiB0aGlzLmMpIHtcbiAgICAgICAgICAgIHRoaXMuY1tuYW1lXS5zeXN0ZW0ucmVtb3ZlQ29tcG9uZW50KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGV0YWNoIGZyb20gcGFyZW50XG4gICAgICAgIGlmICh0aGlzLl9wYXJlbnQpXG4gICAgICAgICAgICB0aGlzLl9wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcyk7XG5cbiAgICAgICAgLy8gcmVjdXJzaXZlbHkgZGVzdHJveSBhbGwgY2hpbGRyZW5cbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcbiAgICAgICAgd2hpbGUgKGNoaWxkcmVuLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgYSBjaGlsZCBmcm9tIHRoZSBhcnJheSBhbmQgZGlzY29ubmVjdCBpdCBmcm9tIHRoZSBwYXJlbnRcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gY2hpbGRyZW4ucG9wKCk7XG4gICAgICAgICAgICBjaGlsZC5fcGFyZW50ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgY2hpbGQuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmlyZSBkZXN0cm95IGV2ZW50XG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveScsIHRoaXMpO1xuXG4gICAgICAgIC8vIGNsZWFyIGFsbCBldmVudHNcbiAgICAgICAgdGhpcy5vZmYoKTtcblxuICAgICAgICAvLyByZW1vdmUgZnJvbSBlbnRpdHkgaW5kZXhcbiAgICAgICAgaWYgKHRoaXMuX2d1aWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9hcHAuX2VudGl0eUluZGV4W3RoaXMuX2d1aWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVzdHJveWluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIGRlZXAgY29weSBvZiB0aGUgRW50aXR5LiBEdXBsaWNhdGUgdGhlIGZ1bGwgRW50aXR5IGhpZXJhcmNoeSwgd2l0aCBhbGwgQ29tcG9uZW50c1xuICAgICAqIGFuZCBhbGwgZGVzY2VuZGFudHMuIE5vdGUsIHRoaXMgRW50aXR5IGlzIG5vdCBpbiB0aGUgaGllcmFyY2h5IGFuZCBtdXN0IGJlIGFkZGVkIG1hbnVhbGx5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgbmV3IEVudGl0eSB3aGljaCBpcyBhIGRlZXAgY29weSBvZiB0aGUgb3JpZ2luYWwuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZSA9IHRoaXMuZW50aXR5LmNsb25lKCk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgY2xvbmUgYXMgYSBzaWJsaW5nIHRvIHRoZSBvcmlnaW5hbFxuICAgICAqIHRoaXMuZW50aXR5LnBhcmVudC5hZGRDaGlsZChlKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgZHVwbGljYXRlZElkc01hcCA9IHt9O1xuICAgICAgICBjb25zdCBjbG9uZSA9IHRoaXMuX2Nsb25lUmVjdXJzaXZlbHkoZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBbdGhpcy5nZXRHdWlkKCldID0gY2xvbmU7XG5cbiAgICAgICAgcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKHRoaXMsIHRoaXMsIGNsb25lLCBkdXBsaWNhdGVkSWRzTWFwKTtcblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtPYmplY3Q8c3RyaW5nLCBFbnRpdHk+fSBkdXBsaWNhdGVkSWRzTWFwIC0gQSBtYXAgb2Ygb3JpZ2luYWwgZW50aXR5IEdVSURzIHRvIGNsb25lZFxuICAgICAqIGVudGl0aWVzLlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIG5ldyBFbnRpdHkgd2hpY2ggaXMgYSBkZWVwIGNvcHkgb2YgdGhlIG9yaWdpbmFsLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lUmVjdXJzaXZlbHkoZHVwbGljYXRlZElkc01hcCkge1xuICAgICAgICAvKiogQHR5cGUge3RoaXN9ICovXG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IodW5kZWZpbmVkLCB0aGlzLl9hcHApO1xuICAgICAgICBzdXBlci5fY2xvbmVJbnRlcm5hbChjbG9uZSk7XG5cbiAgICAgICAgZm9yIChjb25zdCB0eXBlIGluIHRoaXMuYykge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gdGhpcy5jW3R5cGVdO1xuICAgICAgICAgICAgY29tcG9uZW50LnN5c3RlbS5jbG9uZUNvbXBvbmVudCh0aGlzLCBjbG9uZSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvbGRDaGlsZCA9IHRoaXMuX2NoaWxkcmVuW2ldO1xuICAgICAgICAgICAgaWYgKG9sZENoaWxkIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q2hpbGQgPSBvbGRDaGlsZC5fY2xvbmVSZWN1cnNpdmVseShkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgICAgICAgICBjbG9uZS5hZGRDaGlsZChuZXdDaGlsZCk7XG4gICAgICAgICAgICAgICAgZHVwbGljYXRlZElkc01hcFtvbGRDaGlsZC5nZXRHdWlkKCldID0gbmV3Q2hpbGQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxufVxuXG4vLyBXaGVuIGFuIGVudGl0eSB0aGF0IGhhcyBwcm9wZXJ0aWVzIHRoYXQgY29udGFpbiByZWZlcmVuY2VzIHRvIG90aGVyXG4vLyBlbnRpdGllcyB3aXRoaW4gaXRzIHN1YnRyZWUgaXMgZHVwbGljYXRlZCwgdGhlIGV4cGVjdGF0aW9uIG9mIHRoZVxuLy8gdXNlciBpcyBsaWtlbHkgdGhhdCB0aG9zZSBwcm9wZXJ0aWVzIHdpbGwgYmUgdXBkYXRlZCB0byBwb2ludCB0b1xuLy8gdGhlIGNvcnJlc3BvbmRpbmcgZW50aXRpZXMgd2l0aGluIHRoZSBuZXdseS1jcmVhdGVkIGR1cGxpY2F0ZSBzdWJ0cmVlLlxuLy9cbi8vIFRvIGhhbmRsZSB0aGlzLCB3ZSBuZWVkIHRvIHNlYXJjaCBmb3IgcHJvcGVydGllcyB0aGF0IHJlZmVyIHRvIGVudGl0aWVzXG4vLyB3aXRoaW4gdGhlIG9sZCBkdXBsaWNhdGVkIHN0cnVjdHVyZSwgZmluZCB0aGVpciBuZXdseS1jbG9uZWQgcGFydG5lcnNcbi8vIHdpdGhpbiB0aGUgbmV3IHN0cnVjdHVyZSwgYW5kIHVwZGF0ZSB0aGUgcmVmZXJlbmNlcyBhY2NvcmRpbmdseS4gVGhpc1xuLy8gZnVuY3Rpb24gaW1wbGVtZW50cyB0aGF0IHJlcXVpcmVtZW50LlxuZnVuY3Rpb24gcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKG9sZFN1YnRyZWVSb290LCBvbGRFbnRpdHksIG5ld0VudGl0eSwgZHVwbGljYXRlZElkc01hcCkge1xuICAgIGlmIChvbGRFbnRpdHkgaW5zdGFuY2VvZiBFbnRpdHkpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG9sZEVudGl0eS5jO1xuXG4gICAgICAgIC8vIEhhbmRsZSBjb21wb25lbnQgcHJvcGVydGllc1xuICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudE5hbWUgaW4gY29tcG9uZW50cykge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eVByb3BlcnRpZXMgPSBjb21wb25lbnQuc3lzdGVtLmdldFByb3BlcnRpZXNPZlR5cGUoJ2VudGl0eScpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZW50aXR5UHJvcGVydGllcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5RGVzY3JpcHRvciA9IGVudGl0eVByb3BlcnRpZXNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcGVydHlOYW1lID0gcHJvcGVydHlEZXNjcmlwdG9yLm5hbWU7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkRW50aXR5UmVmZXJlbmNlSWQgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlJc1dpdGhpbk9sZFN1YnRyZWUgPSAhIW9sZFN1YnRyZWVSb290LmZpbmRCeUd1aWQob2xkRW50aXR5UmVmZXJlbmNlSWQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eUlzV2l0aGluT2xkU3VidHJlZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdFbnRpdHlSZWZlcmVuY2VJZCA9IGR1cGxpY2F0ZWRJZHNNYXBbb2xkRW50aXR5UmVmZXJlbmNlSWRdLmdldEd1aWQoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobmV3RW50aXR5UmVmZXJlbmNlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0VudGl0eS5jW2NvbXBvbmVudE5hbWVdW3Byb3BlcnR5TmFtZV0gPSBuZXdFbnRpdHlSZWZlcmVuY2VJZDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0NvdWxkIG5vdCBmaW5kIGNvcnJlc3BvbmRpbmcgZW50aXR5IGlkIHdoZW4gcmVzb2x2aW5nIGR1cGxpY2F0ZWQgZW50aXR5IHJlZmVyZW5jZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSBlbnRpdHkgc2NyaXB0IGF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGNvbXBvbmVudHMuc2NyaXB0ICYmICFuZXdFbnRpdHkuX2FwcC51c2VMZWdhY3lTY3JpcHRBdHRyaWJ1dGVDbG9uaW5nKSB7XG4gICAgICAgICAgICBuZXdFbnRpdHkuc2NyaXB0LnJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhjb21wb25lbnRzLnNjcmlwdCwgZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgZW50aXR5IHJlbmRlciBhdHRyaWJ1dGVzXG4gICAgICAgIGlmIChjb21wb25lbnRzLnJlbmRlcikge1xuICAgICAgICAgICAgbmV3RW50aXR5LnJlbmRlci5yZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMoY29tcG9uZW50cy5yZW5kZXIsIGR1cGxpY2F0ZWRJZHNNYXApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGFuZGxlIGVudGl0eSBhbmltIGF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGNvbXBvbmVudHMuYW5pbSkge1xuICAgICAgICAgICAgbmV3RW50aXR5LmFuaW0ucmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKGNvbXBvbmVudHMuYW5pbSwgZHVwbGljYXRlZElkc01hcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWN1cnNlIGludG8gY2hpbGRyZW4uIE5vdGUgdGhhdCB3ZSBjb250aW51ZSB0byBwYXNzIGluIHRoZSBzYW1lIGBvbGRTdWJ0cmVlUm9vdGAsXG4gICAgICAgIC8vIGluIG9yZGVyIHRvIGNvcnJlY3RseSBoYW5kbGUgY2FzZXMgd2hlcmUgYSBjaGlsZCBoYXMgYW4gZW50aXR5IHJlZmVyZW5jZVxuICAgICAgICAvLyBmaWVsZCB0aGF0IHBvaW50cyB0byBhIHBhcmVudCBvciBvdGhlciBhbmNlc3RvciB0aGF0IGlzIHN0aWxsIHdpdGhpbiB0aGVcbiAgICAgICAgLy8gZHVwbGljYXRlZCBzdWJ0cmVlLlxuICAgICAgICBjb25zdCBfb2xkID0gb2xkRW50aXR5LmNoaWxkcmVuLmZpbHRlcihmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIChlIGluc3RhbmNlb2YgRW50aXR5KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IF9uZXcgPSBuZXdFbnRpdHkuY2hpbGRyZW4uZmlsdGVyKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gKGUgaW5zdGFuY2VvZiBFbnRpdHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gX29sZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgcmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzKG9sZFN1YnRyZWVSb290LCBfb2xkW2ldLCBfbmV3W2ldLCBkdXBsaWNhdGVkSWRzTWFwKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBGaXJlZCBhZnRlciB0aGUgZW50aXR5IGlzIGRlc3Ryb3llZC5cbiAqXG4gKiBAZXZlbnQgRW50aXR5I2Rlc3Ryb3lcbiAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoYXQgd2FzIGRlc3Ryb3llZC5cbiAqIEBleGFtcGxlXG4gKiBlbnRpdHkub24oXCJkZXN0cm95XCIsIGZ1bmN0aW9uIChlKSB7XG4gKiAgICAgY29uc29sZS5sb2coJ2VudGl0eSAnICsgZS5uYW1lICsgJyBoYXMgYmVlbiBkZXN0cm95ZWQnKTtcbiAqIH0pO1xuICovXG5cbmV4cG9ydCB7IEVudGl0eSB9O1xuIl0sIm5hbWVzIjpbIl9lbmFibGVMaXN0IiwiRW50aXR5IiwiR3JhcGhOb2RlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiYXBwIiwiZ2V0QXBwbGljYXRpb24iLCJhbmltIiwiYW5pbWF0aW9uIiwiYXVkaW9saXN0ZW5lciIsImJ1dHRvbiIsImNhbWVyYSIsImNvbGxpc2lvbiIsImVsZW1lbnQiLCJsYXlvdXRjaGlsZCIsImxheW91dGdyb3VwIiwibGlnaHQiLCJtb2RlbCIsInBhcnRpY2xlc3lzdGVtIiwicmVuZGVyIiwicmlnaWRib2R5Iiwic2NyZWVuIiwic2NyaXB0Iiwic2Nyb2xsYmFyIiwic2Nyb2xsdmlldyIsInNvdW5kIiwic3ByaXRlIiwiYyIsIl9hcHAiLCJfZGVzdHJveWluZyIsIl9ndWlkIiwiX3RlbXBsYXRlIiwiRGVidWciLCJhc3NlcnQiLCJhZGRDb21wb25lbnQiLCJ0eXBlIiwiZGF0YSIsInN5c3RlbSIsInN5c3RlbXMiLCJlcnJvciIsIndhcm4iLCJyZW1vdmVDb21wb25lbnQiLCJmaW5kQ29tcG9uZW50IiwiZW50aXR5IiwiZmluZE9uZSIsIm5vZGUiLCJmaW5kQ29tcG9uZW50cyIsImVudGl0aWVzIiwiZmluZCIsIm1hcCIsImdldEd1aWQiLCJzZXRHdWlkIiwiZ3VpZCIsImNyZWF0ZSIsImluZGV4IiwiX2VudGl0eUluZGV4IiwiX25vdGlmeUhpZXJhcmNoeVN0YXRlQ2hhbmdlZCIsImVuYWJsZWQiLCJlbmFibGVGaXJzdCIsImxlbmd0aCIsIl9iZWluZ0VuYWJsZWQiLCJfb25IaWVyYXJjaHlTdGF0ZUNoYW5nZWQiLCJfb25IaWVyYXJjaHlTdGF0ZVBvc3RDaGFuZ2VkIiwicHVzaCIsIl9jaGlsZHJlbiIsImkiLCJsZW4iLCJfZW5hYmxlZCIsImNvbXBvbmVudHMiLCJoYXNPd25Qcm9wZXJ0eSIsImNvbXBvbmVudCIsIm9uRW5hYmxlIiwib25EaXNhYmxlIiwib25Qb3N0U3RhdGVDaGFuZ2UiLCJmaW5kQnlHdWlkIiwiZSIsImlzRGVzY2VuZGFudE9mIiwiZGVzdHJveSIsIl9wYXJlbnQiLCJyZW1vdmVDaGlsZCIsImNoaWxkcmVuIiwiY2hpbGQiLCJwb3AiLCJmaXJlIiwib2ZmIiwiY2xvbmUiLCJkdXBsaWNhdGVkSWRzTWFwIiwiX2Nsb25lUmVjdXJzaXZlbHkiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJ1bmRlZmluZWQiLCJfY2xvbmVJbnRlcm5hbCIsImNsb25lQ29tcG9uZW50Iiwib2xkQ2hpbGQiLCJuZXdDaGlsZCIsImFkZENoaWxkIiwib2xkU3VidHJlZVJvb3QiLCJvbGRFbnRpdHkiLCJuZXdFbnRpdHkiLCJjb21wb25lbnROYW1lIiwiZW50aXR5UHJvcGVydGllcyIsImdldFByb3BlcnRpZXNPZlR5cGUiLCJwcm9wZXJ0eURlc2NyaXB0b3IiLCJwcm9wZXJ0eU5hbWUiLCJvbGRFbnRpdHlSZWZlcmVuY2VJZCIsImVudGl0eUlzV2l0aGluT2xkU3VidHJlZSIsIm5ld0VudGl0eVJlZmVyZW5jZUlkIiwidXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyIsIl9vbGQiLCJmaWx0ZXIiLCJfbmV3Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxXQUFXLEdBQUcsRUFBRSxDQUFBOztBQUV0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxNQUFNLFNBQVNDLFNBQVMsQ0FBQztBQUMzQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsSUFBSSxFQUFFQyxHQUFHLEdBQUdDLGNBQWMsRUFBRSxFQUFFO0lBQ3RDLEtBQUssQ0FBQ0YsSUFBSSxDQUFDLENBQUE7QUFBQyxJQUFBLElBQUEsQ0FqT2hCRyxJQUFJLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRSkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVRDLGFBQWEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFiQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUU5DLFNBQVMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFUQyxPQUFPLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRUEMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVhDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFYQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTEMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUUxDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFkQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVRDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFOQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFB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
