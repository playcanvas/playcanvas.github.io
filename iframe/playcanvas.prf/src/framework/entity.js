import { guid } from '../core/guid.js';
import { GraphNode } from '../scene/graph-node.js';
import { getApplication } from './globals.js';

const _enableList = [];
class Entity extends GraphNode {
  constructor(name, app = getApplication()) {
    super(name);
    this.anim = void 0;
    this.animation = void 0;
    this.audiolistener = void 0;
    this.button = void 0;
    this.camera = void 0;
    this.collision = void 0;
    this.element = void 0;
    this.gsplat = void 0;
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
    this._app = app;
  }
  addComponent(type, data) {
    const system = this._app.systems[type];
    if (!system) {
      return null;
    }
    if (this.c[type]) {
      return null;
    }
    return system.addComponent(this, data);
  }
  removeComponent(type) {
    const system = this._app.systems[type];
    if (!system) {
      return;
    }
    if (!this.c[type]) {
      return;
    }
    system.removeComponent(this);
  }
  findComponent(type) {
    const entity = this.findOne(function (node) {
      return node.c && node.c[type];
    });
    return entity && entity.c[type];
  }
  findComponents(type) {
    const entities = this.find(function (node) {
      return node.c && node.c[type];
    });
    return entities.map(function (entity) {
      return entity.c[type];
    });
  }
  findScript(nameOrType) {
    const entity = this.findOne(node => {
      var _node$c;
      return (_node$c = node.c) == null || (_node$c = _node$c.script) == null ? void 0 : _node$c.has(nameOrType);
    });
    return entity == null ? void 0 : entity.c.script.get(nameOrType);
  }
  findScripts(nameOrType) {
    const entities = this.find(node => {
      var _node$c2;
      return (_node$c2 = node.c) == null || (_node$c2 = _node$c2.script) == null ? void 0 : _node$c2.has(nameOrType);
    });
    return entities.map(entity => entity.c.script.get(nameOrType));
  }
  getGuid() {
    if (!this._guid) {
      this.setGuid(guid.create());
    }
    return this._guid;
  }
  setGuid(guid) {
    const index = this._app._entityIndex;
    if (this._guid) {
      delete index[this._guid];
    }
    this._guid = guid;
    index[this._guid] = this;
  }
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
      for (let i = 0; i < _enableList.length; i++) {
        _enableList[i]._onHierarchyStatePostChanged();
      }
      _enableList.length = 0;
    }
  }
  _onHierarchyStateChanged(enabled) {
    super._onHierarchyStateChanged(enabled);
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
  _onHierarchyStatePostChanged() {
    const components = this.c;
    for (const type in components) {
      if (components.hasOwnProperty(type)) components[type].onPostStateChange();
    }
  }
  findByGuid(guid) {
    if (this._guid === guid) return this;
    const e = this._app._entityIndex[guid];
    if (e && (e === this || e.isDescendantOf(this))) {
      return e;
    }
    return null;
  }
  destroy() {
    this._destroying = true;
    for (const name in this.c) {
      this.c[name].enabled = false;
    }
    for (const name in this.c) {
      this.c[name].system.removeComponent(this);
    }
    super.destroy();
    if (this._guid) {
      delete this._app._entityIndex[this._guid];
    }
    this._destroying = false;
  }
  clone() {
    const duplicatedIdsMap = {};
    const clone = this._cloneRecursively(duplicatedIdsMap);
    duplicatedIdsMap[this.getGuid()] = clone;
    resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);
    return clone;
  }
  _cloneRecursively(duplicatedIdsMap) {
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
Entity.EVENT_DESTROY = 'destroy';
function resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, oldEntity, newEntity, duplicatedIdsMap) {
  if (oldEntity instanceof Entity) {
    const components = oldEntity.c;
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
          }
        }
      }
    }
    if (components.script && !newEntity._app.useLegacyScriptAttributeCloning) {
      newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
    }
    if (components.render) {
      newEntity.render.resolveDuplicatedEntityReferenceProperties(components.render, duplicatedIdsMap);
    }
    if (components.anim) {
      newEntity.anim.resolveDuplicatedEntityReferenceProperties(components.anim, duplicatedIdsMap);
    }
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
