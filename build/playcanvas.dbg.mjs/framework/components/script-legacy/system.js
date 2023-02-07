/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { extend } from '../../../core/core.js';
import { events } from '../../../core/events.js';
import { Debug } from '../../../core/debug.js';
import { Color } from '../../../core/math/color.js';
import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { Entity } from '../../entity.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScriptLegacyComponent } from './component.js';
import { ScriptLegacyComponentData } from './data.js';

const _schema = ['enabled', 'scripts', 'instances', 'runInTools'];
const INITIALIZE = 'initialize';
const POST_INITIALIZE = 'postInitialize';
const UPDATE = 'update';
const POST_UPDATE = 'postUpdate';
const FIXED_UPDATE = 'fixedUpdate';
const TOOLS_UPDATE = 'toolsUpdate';
const ON_ENABLE = 'onEnable';
const ON_DISABLE = 'onDisable';
class ScriptLegacyComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'script';
    this.ComponentType = ScriptLegacyComponent;
    this.DataType = ScriptLegacyComponentData;
    this.schema = _schema;

    // used by application during preloading phase to ensure scripts aren't
    // initialized until everything is loaded
    this.preloading = false;

    // arrays to cache script instances for fast iteration
    this.instancesWithUpdate = [];
    this.instancesWithFixedUpdate = [];
    this.instancesWithPostUpdate = [];
    this.instancesWithToolsUpdate = [];
    this.on('beforeremove', this.onBeforeRemove, this);
    this.app.systems.on(INITIALIZE, this.onInitialize, this);
    this.app.systems.on(POST_INITIALIZE, this.onPostInitialize, this);
    this.app.systems.on(UPDATE, this.onUpdate, this);
    this.app.systems.on(FIXED_UPDATE, this.onFixedUpdate, this);
    this.app.systems.on(POST_UPDATE, this.onPostUpdate, this);
    this.app.systems.on(TOOLS_UPDATE, this.onToolsUpdate, this);
  }
  initializeComponentData(component, data, properties) {
    properties = ['runInTools', 'enabled', 'scripts'];

    // convert attributes array to dictionary
    if (data.scripts && data.scripts.length) {
      data.scripts.forEach(function (script) {
        if (script.attributes && Array.isArray(script.attributes)) {
          const dict = {};
          for (let i = 0; i < script.attributes.length; i++) {
            dict[script.attributes[i].name] = script.attributes[i];
          }
          script.attributes = dict;
        }
      });
    }
    super.initializeComponentData(component, data, properties);
  }
  cloneComponent(entity, clone) {
    // overridden to make sure urls list is duplicated
    const src = this.store[entity.getGuid()];
    const data = {
      runInTools: src.data.runInTools,
      scripts: [],
      enabled: src.data.enabled
    };

    // manually clone scripts so that we don't clone attributes with pc.extend
    // which will result in a stack overflow when extending 'entity' script attributes
    const scripts = src.data.scripts;
    for (let i = 0, len = scripts.length; i < len; i++) {
      const attributes = scripts[i].attributes;
      if (attributes) {
        delete scripts[i].attributes;
      }
      data.scripts.push(extend({}, scripts[i]));
      if (attributes) {
        data.scripts[i].attributes = this._cloneAttributes(attributes);
        scripts[i].attributes = attributes;
      }
    }
    return this.addComponent(clone, data);
  }
  onBeforeRemove(entity, component) {
    // if the script component is enabled
    // call onDisable on all its instances first
    if (component.enabled) {
      this._disableScriptComponent(component);
    }

    // then call destroy on all the script instances
    this._destroyScriptComponent(component);
  }
  onInitialize(root) {
    this._registerInstances(root);
    if (root.enabled) {
      if (root.script && root.script.enabled) {
        this._initializeScriptComponent(root.script);
      }
      const children = root._children;
      for (let i = 0, len = children.length; i < len; i++) {
        if (children[i] instanceof Entity) {
          this.onInitialize(children[i]);
        }
      }
    }
  }
  onPostInitialize(root) {
    if (root.enabled) {
      if (root.script && root.script.enabled) {
        this._postInitializeScriptComponent(root.script);
      }
      const children = root._children;
      for (let i = 0, len = children.length; i < len; i++) {
        if (children[i] instanceof Entity) {
          this.onPostInitialize(children[i]);
        }
      }
    }
  }
  _callInstancesMethod(script, method) {
    const instances = script.data.instances;
    for (const name in instances) {
      if (instances.hasOwnProperty(name)) {
        const instance = instances[name].instance;
        if (instance[method]) {
          instance[method]();
        }
      }
    }
  }
  _initializeScriptComponent(script) {
    this._callInstancesMethod(script, INITIALIZE);
    script.data.initialized = true;

    // check again if the script and the entity are enabled
    // in case they got disabled during initialize
    if (script.enabled && script.entity.enabled) {
      this._enableScriptComponent(script);
    }
  }
  _enableScriptComponent(script) {
    this._callInstancesMethod(script, ON_ENABLE);
  }
  _disableScriptComponent(script) {
    this._callInstancesMethod(script, ON_DISABLE);
  }
  _destroyScriptComponent(script) {
    const instances = script.data.instances;
    for (const name in instances) {
      if (instances.hasOwnProperty(name)) {
        const instance = instances[name].instance;
        if (instance.destroy) {
          instance.destroy();
        }
        if (instance.update) {
          const index = this.instancesWithUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithUpdate.splice(index, 1);
          }
        }
        if (instance.fixedUpdate) {
          const index = this.instancesWithFixedUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithFixedUpdate.splice(index, 1);
          }
        }
        if (instance.postUpdate) {
          const index = this.instancesWithPostUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithPostUpdate.splice(index, 1);
          }
        }
        if (instance.toolsUpdate) {
          const index = this.instancesWithToolsUpdate.indexOf(instance);
          if (index >= 0) {
            this.instancesWithToolsUpdate.splice(index, 1);
          }
        }
        if (script.instances[name].instance === script[name]) {
          delete script[name];
        }
        delete script.instances[name];
      }
    }
  }
  _postInitializeScriptComponent(script) {
    this._callInstancesMethod(script, POST_INITIALIZE);
    script.data.postInitialized = true;
  }
  _updateInstances(method, updateList, dt) {
    for (let i = 0, len = updateList.length; i < len; i++) {
      const item = updateList[i];
      if (item && item.entity && item.entity.enabled && item.entity.script.enabled) {
        item[method](dt);
      }
    }
  }
  onUpdate(dt) {
    this._updateInstances(UPDATE, this.instancesWithUpdate, dt);
  }
  onFixedUpdate(dt) {
    this._updateInstances(FIXED_UPDATE, this.instancesWithFixedUpdate, dt);
  }
  onPostUpdate(dt) {
    this._updateInstances(POST_UPDATE, this.instancesWithPostUpdate, dt);
  }
  onToolsUpdate(dt) {
    this._updateInstances(TOOLS_UPDATE, this.instancesWithToolsUpdate, dt);
  }
  broadcast(name, functionName) {
    Debug.deprecated('ScriptLegacyComponentSystem.broadcast() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/');
    const args = Array.prototype.slice.call(arguments, 2);
    const dataStore = this.store;
    for (const id in dataStore) {
      if (dataStore.hasOwnProperty(id)) {
        const data = dataStore[id].data;
        if (data.instances[name]) {
          const fn = data.instances[name].instance[functionName];
          if (fn) {
            fn.apply(data.instances[name].instance, args);
          }
        }
      }
    }
  }
  _preRegisterInstance(entity, url, name, instance) {
    if (entity.script) {
      entity.script.data._instances = entity.script.data._instances || {};
      if (entity.script.data._instances[name]) {
        throw Error(`Script name collision '${name}'. Scripts from '${url}' and '${entity.script.data._instances[name].url}' {${entity.getGuid()}}`);
      }
      entity.script.data._instances[name] = {
        url: url,
        name: name,
        instance: instance
      };
    }
  }
  _registerInstances(entity) {
    if (entity.script) {
      if (entity.script.data._instances) {
        entity.script.instances = entity.script.data._instances;
        for (const instanceName in entity.script.instances) {
          const preRegistered = entity.script.instances[instanceName];
          const instance = preRegistered.instance;
          events.attach(instance);
          if (instance.update) {
            this.instancesWithUpdate.push(instance);
          }
          if (instance.fixedUpdate) {
            this.instancesWithFixedUpdate.push(instance);
          }
          if (instance.postUpdate) {
            this.instancesWithPostUpdate.push(instance);
          }
          if (instance.toolsUpdate) {
            this.instancesWithToolsUpdate.push(instance);
          }
          if (entity.script.scripts) {
            this._createAccessors(entity, preRegistered);
          }

          // Make instance accessible from the script component of the Entity
          if (entity.script[instanceName]) {
            throw Error(`Script with name '${instanceName}' is already attached to Script Component`);
          } else {
            entity.script[instanceName] = instance;
          }
        }

        // Remove temp storage
        delete entity.script.data._instances;
      }
    }
    const children = entity._children;
    for (let i = 0, len = children.length; i < len; i++) {
      if (children[i] instanceof Entity) {
        this._registerInstances(children[i]);
      }
    }
  }
  _cloneAttributes(attributes) {
    const result = {};
    for (const key in attributes) {
      if (!attributes.hasOwnProperty(key)) continue;
      if (attributes[key].type !== 'entity') {
        result[key] = extend({}, attributes[key]);
      } else {
        // don't pc.extend an entity
        const val = attributes[key].value;
        delete attributes[key].value;
        result[key] = extend({}, attributes[key]);
        result[key].value = val;
        attributes[key].value = val;
      }
    }
    return result;
  }
  _createAccessors(entity, instance) {
    const len = entity.script.scripts.length;
    const url = instance.url;
    for (let i = 0; i < len; i++) {
      const script = entity.script.scripts[i];
      if (script.url === url) {
        const attributes = script.attributes;
        if (script.name && attributes) {
          for (const key in attributes) {
            if (attributes.hasOwnProperty(key)) {
              this._createAccessor(attributes[key], instance);
            }
          }
          entity.script.data.attributes[script.name] = this._cloneAttributes(attributes);
        }
        break;
      }
    }
  }
  _createAccessor(attribute, instance) {
    const self = this;

    // create copy of attribute data
    // to avoid overwriting the same attribute values
    // that are used by the Editor
    attribute = {
      name: attribute.name,
      value: attribute.value,
      type: attribute.type
    };
    this._convertAttributeValue(attribute);
    Object.defineProperty(instance.instance, attribute.name, {
      get: function () {
        return attribute.value;
      },
      set: function (value) {
        const oldValue = attribute.value;
        attribute.value = value;
        self._convertAttributeValue(attribute);
        instance.instance.fire('set', attribute.name, oldValue, attribute.value);
      },
      configurable: true
    });
  }
  _updateAccessors(entity, instance) {
    const len = entity.script.scripts.length;
    const url = instance.url;
    for (let i = 0; i < len; i++) {
      const scriptComponent = entity.script;
      const script = scriptComponent.scripts[i];
      if (script.url === url) {
        const name = script.name;
        const attributes = script.attributes;
        if (name) {
          if (attributes) {
            // create / update attribute accessors
            for (const key in attributes) {
              if (attributes.hasOwnProperty(key)) {
                this._createAccessor(attributes[key], instance);
              }
            }
          }

          // delete accessors for attributes that no longer exist
          // and fire onAttributeChange when an attribute value changed
          const previousAttributes = scriptComponent.data.attributes[name];
          if (previousAttributes) {
            for (const key in previousAttributes) {
              const oldAttribute = previousAttributes[key];
              if (!(key in attributes)) {
                delete instance.instance[oldAttribute.name];
              } else {
                if (attributes[key].value !== oldAttribute.value) {
                  if (instance.instance.onAttributeChanged) {
                    instance.instance.onAttributeChanged(oldAttribute.name, oldAttribute.value, attributes[key].value);
                  }
                }
              }
            }
          }
          if (attributes) {
            scriptComponent.data.attributes[name] = this._cloneAttributes(attributes);
          } else {
            delete scriptComponent.data.attributes[name];
          }
        }
        break;
      }
    }
  }
  _convertAttributeValue(attribute) {
    if (attribute.type === 'rgb' || attribute.type === 'rgba') {
      if (Array.isArray(attribute.value)) {
        attribute.value = attribute.value.length === 3 ? new Color(attribute.value[0], attribute.value[1], attribute.value[2]) : new Color(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
      }
    } else if (attribute.type === 'vec2') {
      if (Array.isArray(attribute.value)) attribute.value = new Vec2(attribute.value[0], attribute.value[1]);
    } else if (attribute.type === 'vec3' || attribute.type === 'vector') {
      if (Array.isArray(attribute.value)) attribute.value = new Vec3(attribute.value[0], attribute.value[1], attribute.value[2]);
    } else if (attribute.type === 'vec4') {
      if (Array.isArray(attribute.value)) attribute.value = new Vec4(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3]);
    } else if (attribute.type === 'entity') {
      if (attribute.value !== null && typeof attribute.value === 'string') attribute.value = this.app.root.findByGuid(attribute.value);
    } else if (attribute.type === 'curve' || attribute.type === 'colorcurve') {
      const curveType = attribute.value.keys[0] instanceof Array ? CurveSet : Curve;
      attribute.value = new curveType(attribute.value.keys);

      /* eslint-disable no-self-assign */
      attribute.value.type = attribute.value.type;
      /* eslint-enable no-self-assign */
    }
  }

  destroy() {
    super.destroy();
    this.app.systems.off(INITIALIZE, this.onInitialize, this);
    this.app.systems.off(POST_INITIALIZE, this.onPostInitialize, this);
    this.app.systems.off(UPDATE, this.onUpdate, this);
    this.app.systems.off(FIXED_UPDATE, this.onFixedUpdate, this);
    this.app.systems.off(POST_UPDATE, this.onPostUpdate, this);
    this.app.systems.off(TOOLS_UPDATE, this.onToolsUpdate, this);
  }
}
Component._buildAccessors(ScriptLegacyComponent.prototype, _schema);

export { ScriptLegacyComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0LWxlZ2FjeS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb3JlLmpzJztcbmltcG9ydCB7IGV2ZW50cyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZXZlbnRzLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IEN1cnZlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLmpzJztcbmltcG9ydCB7IEN1cnZlU2V0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2N1cnZlLXNldC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uLy4uL2VudGl0eS5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBTY3JpcHRMZWdhY3lDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBTY3JpcHRMZWdhY3lDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCcsXG4gICAgJ3NjcmlwdHMnLFxuICAgICdpbnN0YW5jZXMnLFxuICAgICdydW5JblRvb2xzJ1xuXTtcblxuY29uc3QgSU5JVElBTElaRSA9ICdpbml0aWFsaXplJztcbmNvbnN0IFBPU1RfSU5JVElBTElaRSA9ICdwb3N0SW5pdGlhbGl6ZSc7XG5jb25zdCBVUERBVEUgPSAndXBkYXRlJztcbmNvbnN0IFBPU1RfVVBEQVRFID0gJ3Bvc3RVcGRhdGUnO1xuY29uc3QgRklYRURfVVBEQVRFID0gJ2ZpeGVkVXBkYXRlJztcbmNvbnN0IFRPT0xTX1VQREFURSA9ICd0b29sc1VwZGF0ZSc7XG5jb25zdCBPTl9FTkFCTEUgPSAnb25FbmFibGUnO1xuY29uc3QgT05fRElTQUJMRSA9ICdvbkRpc2FibGUnO1xuXG5jbGFzcyBTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnc2NyaXB0JztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBTY3JpcHRMZWdhY3lDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBTY3JpcHRMZWdhY3lDb21wb25lbnREYXRhO1xuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgLy8gdXNlZCBieSBhcHBsaWNhdGlvbiBkdXJpbmcgcHJlbG9hZGluZyBwaGFzZSB0byBlbnN1cmUgc2NyaXB0cyBhcmVuJ3RcbiAgICAgICAgLy8gaW5pdGlhbGl6ZWQgdW50aWwgZXZlcnl0aGluZyBpcyBsb2FkZWRcbiAgICAgICAgdGhpcy5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYXJyYXlzIHRvIGNhY2hlIHNjcmlwdCBpbnN0YW5jZXMgZm9yIGZhc3QgaXRlcmF0aW9uXG4gICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZSA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhQb3N0VXBkYXRlID0gW107XG4gICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlID0gW107XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub24oSU5JVElBTElaRSwgdGhpcy5vbkluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKFBPU1RfSU5JVElBTElaRSwgdGhpcy5vblBvc3RJbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbihVUERBVEUsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKEZJWEVEX1VQREFURSwgdGhpcy5vbkZpeGVkVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbihQT1NUX1VQREFURSwgdGhpcy5vblBvc3RVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKFRPT0xTX1VQREFURSwgdGhpcy5vblRvb2xzVXBkYXRlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgcHJvcGVydGllcyA9IFsncnVuSW5Ub29scycsICdlbmFibGVkJywgJ3NjcmlwdHMnXTtcblxuICAgICAgICAvLyBjb252ZXJ0IGF0dHJpYnV0ZXMgYXJyYXkgdG8gZGljdGlvbmFyeVxuICAgICAgICBpZiAoZGF0YS5zY3JpcHRzICYmIGRhdGEuc2NyaXB0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGRhdGEuc2NyaXB0cy5mb3JFYWNoKGZ1bmN0aW9uIChzY3JpcHQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LmF0dHJpYnV0ZXMgJiYgQXJyYXkuaXNBcnJheShzY3JpcHQuYXR0cmlidXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGljdCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjcmlwdC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWN0W3NjcmlwdC5hdHRyaWJ1dGVzW2ldLm5hbWVdID0gc2NyaXB0LmF0dHJpYnV0ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBzY3JpcHQuYXR0cmlidXRlcyA9IGRpY3Q7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gb3ZlcnJpZGRlbiB0byBtYWtlIHN1cmUgdXJscyBsaXN0IGlzIGR1cGxpY2F0ZWRcbiAgICAgICAgY29uc3Qgc3JjID0gdGhpcy5zdG9yZVtlbnRpdHkuZ2V0R3VpZCgpXTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIHJ1bkluVG9vbHM6IHNyYy5kYXRhLnJ1bkluVG9vbHMsXG4gICAgICAgICAgICBzY3JpcHRzOiBbXSxcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNyYy5kYXRhLmVuYWJsZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBtYW51YWxseSBjbG9uZSBzY3JpcHRzIHNvIHRoYXQgd2UgZG9uJ3QgY2xvbmUgYXR0cmlidXRlcyB3aXRoIHBjLmV4dGVuZFxuICAgICAgICAvLyB3aGljaCB3aWxsIHJlc3VsdCBpbiBhIHN0YWNrIG92ZXJmbG93IHdoZW4gZXh0ZW5kaW5nICdlbnRpdHknIHNjcmlwdCBhdHRyaWJ1dGVzXG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSBzcmMuZGF0YS5zY3JpcHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IHNjcmlwdHNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHNjcmlwdHNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGF0YS5zY3JpcHRzLnB1c2goZXh0ZW5kKHt9LCBzY3JpcHRzW2ldKSk7XG5cbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5zY3JpcHRzW2ldLmF0dHJpYnV0ZXMgPSB0aGlzLl9jbG9uZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICAgICAgICAgICAgc2NyaXB0c1tpXS5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNjcmlwdCBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAvLyBjYWxsIG9uRGlzYWJsZSBvbiBhbGwgaXRzIGluc3RhbmNlcyBmaXJzdFxuICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVTY3JpcHRDb21wb25lbnQoY29tcG9uZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoZW4gY2FsbCBkZXN0cm95IG9uIGFsbCB0aGUgc2NyaXB0IGluc3RhbmNlc1xuICAgICAgICB0aGlzLl9kZXN0cm95U2NyaXB0Q29tcG9uZW50KGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgb25Jbml0aWFsaXplKHJvb3QpIHtcbiAgICAgICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZXMocm9vdCk7XG5cbiAgICAgICAgaWYgKHJvb3QuZW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKHJvb3Quc2NyaXB0ICYmIHJvb3Quc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHJvb3Quc2NyaXB0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSByb290Ll9jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbltpXSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uSW5pdGlhbGl6ZShjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25Qb3N0SW5pdGlhbGl6ZShyb290KSB7XG4gICAgICAgIGlmIChyb290LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChyb290LnNjcmlwdCAmJiByb290LnNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zdEluaXRpYWxpemVTY3JpcHRDb21wb25lbnQocm9vdC5zY3JpcHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHJvb3QuX2NoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25Qb3N0SW5pdGlhbGl6ZShjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NhbGxJbnN0YW5jZXNNZXRob2Qoc2NyaXB0LCBtZXRob2QpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gc2NyaXB0LmRhdGEuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBpbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlW21ldGhvZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VbbWV0aG9kXSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9pbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICB0aGlzLl9jYWxsSW5zdGFuY2VzTWV0aG9kKHNjcmlwdCwgSU5JVElBTElaRSk7XG4gICAgICAgIHNjcmlwdC5kYXRhLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBjaGVjayBhZ2FpbiBpZiB0aGUgc2NyaXB0IGFuZCB0aGUgZW50aXR5IGFyZSBlbmFibGVkXG4gICAgICAgIC8vIGluIGNhc2UgdGhleSBnb3QgZGlzYWJsZWQgZHVyaW5nIGluaXRpYWxpemVcbiAgICAgICAgaWYgKHNjcmlwdC5lbmFibGVkICYmIHNjcmlwdC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlU2NyaXB0Q29tcG9uZW50KHNjcmlwdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZW5hYmxlU2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICB0aGlzLl9jYWxsSW5zdGFuY2VzTWV0aG9kKHNjcmlwdCwgT05fRU5BQkxFKTtcbiAgICB9XG5cbiAgICBfZGlzYWJsZVNjcmlwdENvbXBvbmVudChzY3JpcHQpIHtcbiAgICAgICAgdGhpcy5fY2FsbEluc3RhbmNlc01ldGhvZChzY3JpcHQsIE9OX0RJU0FCTEUpO1xuICAgIH1cblxuICAgIF9kZXN0cm95U2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBzY3JpcHQuZGF0YS5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IGluc3RhbmNlc1tuYW1lXS5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UuZGVzdHJveSkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5pbmRleE9mKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLmZpeGVkVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5pbnN0YW5jZXNXaXRoRml4ZWRVcGRhdGUuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmluc3RhbmNlc1dpdGhQb3N0VXBkYXRlLmluZGV4T2YoaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoUG9zdFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnRvb2xzVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5pbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhUb29sc1VwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5pbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2UgPT09IHNjcmlwdFtuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2NyaXB0W25hbWVdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWxldGUgc2NyaXB0Lmluc3RhbmNlc1tuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9wb3N0SW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudChzY3JpcHQpIHtcbiAgICAgICAgdGhpcy5fY2FsbEluc3RhbmNlc01ldGhvZChzY3JpcHQsIFBPU1RfSU5JVElBTElaRSk7XG4gICAgICAgIHNjcmlwdC5kYXRhLnBvc3RJbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUluc3RhbmNlcyhtZXRob2QsIHVwZGF0ZUxpc3QsIGR0KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB1cGRhdGVMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gdXBkYXRlTGlzdFtpXTtcbiAgICAgICAgICAgIGlmIChpdGVtICYmIGl0ZW0uZW50aXR5ICYmIGl0ZW0uZW50aXR5LmVuYWJsZWQgJiYgaXRlbS5lbnRpdHkuc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBpdGVtW21ldGhvZF0oZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25VcGRhdGUoZHQpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlSW5zdGFuY2VzKFVQREFURSwgdGhpcy5pbnN0YW5jZXNXaXRoVXBkYXRlLCBkdCk7XG4gICAgfVxuXG4gICAgb25GaXhlZFVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLl91cGRhdGVJbnN0YW5jZXMoRklYRURfVVBEQVRFLCB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSwgZHQpO1xuICAgIH1cblxuICAgIG9uUG9zdFVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLl91cGRhdGVJbnN0YW5jZXMoUE9TVF9VUERBVEUsIHRoaXMuaW5zdGFuY2VzV2l0aFBvc3RVcGRhdGUsIGR0KTtcbiAgICB9XG5cbiAgICBvblRvb2xzVXBkYXRlKGR0KSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUluc3RhbmNlcyhUT09MU19VUERBVEUsIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlLCBkdCk7XG4gICAgfVxuXG4gICAgYnJvYWRjYXN0KG5hbWUsIGZ1bmN0aW9uTmFtZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0uYnJvYWRjYXN0KCkgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIHNvb24uIFBsZWFzZSB1c2U6IGh0dHA6Ly9kZXZlbG9wZXIucGxheWNhbnZhcy5jb20vdXNlci1tYW51YWwvc2NyaXB0aW5nL2NvbW11bmljYXRpb24vJyk7XG5cbiAgICAgICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cbiAgICAgICAgY29uc3QgZGF0YVN0b3JlID0gdGhpcy5zdG9yZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGRhdGFTdG9yZSkge1xuICAgICAgICAgICAgaWYgKGRhdGFTdG9yZS5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gZGF0YVN0b3JlW2lkXS5kYXRhO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLmluc3RhbmNlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmbiA9IGRhdGEuaW5zdGFuY2VzW25hbWVdLmluc3RhbmNlW2Z1bmN0aW9uTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm4uYXBwbHkoZGF0YS5pbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2UsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3ByZVJlZ2lzdGVySW5zdGFuY2UoZW50aXR5LCB1cmwsIG5hbWUsIGluc3RhbmNlKSB7XG4gICAgICAgIGlmIChlbnRpdHkuc2NyaXB0KSB7XG4gICAgICAgICAgICBlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlcyA9IGVudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzIHx8IHt9O1xuICAgICAgICAgICAgaWYgKGVudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFNjcmlwdCBuYW1lIGNvbGxpc2lvbiAnJHtuYW1lfScuIFNjcmlwdHMgZnJvbSAnJHt1cmx9JyBhbmQgJyR7ZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXNbbmFtZV0udXJsfScgeyR7ZW50aXR5LmdldEd1aWQoKX19YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlc1tuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgIGluc3RhbmNlOiBpbnN0YW5jZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWdpc3Rlckluc3RhbmNlcyhlbnRpdHkpIHtcbiAgICAgICAgaWYgKGVudGl0eS5zY3JpcHQpIHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlcykge1xuICAgICAgICAgICAgICAgIGVudGl0eS5zY3JpcHQuaW5zdGFuY2VzID0gZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXM7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGluc3RhbmNlTmFtZSBpbiBlbnRpdHkuc2NyaXB0Lmluc3RhbmNlcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVSZWdpc3RlcmVkID0gZW50aXR5LnNjcmlwdC5pbnN0YW5jZXNbaW5zdGFuY2VOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBwcmVSZWdpc3RlcmVkLmluc3RhbmNlO1xuXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cy5hdHRhY2goaW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5maXhlZFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoRml4ZWRVcGRhdGUucHVzaChpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoUG9zdFVwZGF0ZS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS50b29sc1VwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUucHVzaChpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnNjcmlwdC5zY3JpcHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVBY2Nlc3NvcnMoZW50aXR5LCBwcmVSZWdpc3RlcmVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ha2UgaW5zdGFuY2UgYWNjZXNzaWJsZSBmcm9tIHRoZSBzY3JpcHQgY29tcG9uZW50IG9mIHRoZSBFbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS5zY3JpcHRbaW5zdGFuY2VOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFNjcmlwdCB3aXRoIG5hbWUgJyR7aW5zdGFuY2VOYW1lfScgaXMgYWxyZWFkeSBhdHRhY2hlZCB0byBTY3JpcHQgQ29tcG9uZW50YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc2NyaXB0W2luc3RhbmNlTmFtZV0gPSBpbnN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0ZW1wIHN0b3JhZ2VcbiAgICAgICAgICAgICAgICBkZWxldGUgZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IGVudGl0eS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZXMoY2hpbGRyZW5baV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lQXR0cmlidXRlcyhhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgIGlmICghYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlc1trZXldLnR5cGUgIT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBleHRlbmQoe30sIGF0dHJpYnV0ZXNba2V5XSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IHBjLmV4dGVuZCBhbiBlbnRpdHlcbiAgICAgICAgICAgICAgICBjb25zdCB2YWwgPSBhdHRyaWJ1dGVzW2tleV0udmFsdWU7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGF0dHJpYnV0ZXNba2V5XS52YWx1ZTtcblxuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gZXh0ZW5kKHt9LCBhdHRyaWJ1dGVzW2tleV0pO1xuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldLnZhbHVlID0gdmFsO1xuXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlc1trZXldLnZhbHVlID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlQWNjZXNzb3JzKGVudGl0eSwgaW5zdGFuY2UpIHtcbiAgICAgICAgY29uc3QgbGVuID0gZW50aXR5LnNjcmlwdC5zY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgdXJsID0gaW5zdGFuY2UudXJsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGVudGl0eS5zY3JpcHQuc2NyaXB0c1tpXTtcbiAgICAgICAgICAgIGlmIChzY3JpcHQudXJsID09PSB1cmwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gc2NyaXB0LmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5uYW1lICYmIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUFjY2Vzc29yKGF0dHJpYnV0ZXNba2V5XSwgaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNjcmlwdC5kYXRhLmF0dHJpYnV0ZXNbc2NyaXB0Lm5hbWVdID0gdGhpcy5fY2xvbmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jcmVhdGVBY2Nlc3NvcihhdHRyaWJ1dGUsIGluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBjb3B5IG9mIGF0dHJpYnV0ZSBkYXRhXG4gICAgICAgIC8vIHRvIGF2b2lkIG92ZXJ3cml0aW5nIHRoZSBzYW1lIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgICAgLy8gdGhhdCBhcmUgdXNlZCBieSB0aGUgRWRpdG9yXG4gICAgICAgIGF0dHJpYnV0ZSA9IHtcbiAgICAgICAgICAgIG5hbWU6IGF0dHJpYnV0ZS5uYW1lLFxuICAgICAgICAgICAgdmFsdWU6IGF0dHJpYnV0ZS52YWx1ZSxcbiAgICAgICAgICAgIHR5cGU6IGF0dHJpYnV0ZS50eXBlXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fY29udmVydEF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZSk7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLmluc3RhbmNlLCBhdHRyaWJ1dGUubmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHNlbGYuX2NvbnZlcnRBdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGUpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLmluc3RhbmNlLmZpcmUoJ3NldCcsIGF0dHJpYnV0ZS5uYW1lLCBvbGRWYWx1ZSwgYXR0cmlidXRlLnZhbHVlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUFjY2Vzc29ycyhlbnRpdHksIGluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IGVudGl0eS5zY3JpcHQuc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHVybCA9IGluc3RhbmNlLnVybDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRDb21wb25lbnQgPSBlbnRpdHkuc2NyaXB0O1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gc2NyaXB0Q29tcG9uZW50LnNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoc2NyaXB0LnVybCA9PT0gdXJsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IHNjcmlwdC5uYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBzY3JpcHQuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIC8gdXBkYXRlIGF0dHJpYnV0ZSBhY2Nlc3NvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUFjY2Vzc29yKGF0dHJpYnV0ZXNba2V5XSwgaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSBhY2Nlc3NvcnMgZm9yIGF0dHJpYnV0ZXMgdGhhdCBubyBsb25nZXIgZXhpc3RcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGZpcmUgb25BdHRyaWJ1dGVDaGFuZ2Ugd2hlbiBhbiBhdHRyaWJ1dGUgdmFsdWUgY2hhbmdlZFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmV2aW91c0F0dHJpYnV0ZXMgPSBzY3JpcHRDb21wb25lbnQuZGF0YS5hdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBwcmV2aW91c0F0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRBdHRyaWJ1dGUgPSBwcmV2aW91c0F0dHJpYnV0ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShrZXkgaW4gYXR0cmlidXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGluc3RhbmNlLmluc3RhbmNlW29sZEF0dHJpYnV0ZS5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlc1trZXldLnZhbHVlICE9PSBvbGRBdHRyaWJ1dGUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5pbnN0YW5jZS5vbkF0dHJpYnV0ZUNoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbnN0YW5jZS5vbkF0dHJpYnV0ZUNoYW5nZWQob2xkQXR0cmlidXRlLm5hbWUsIG9sZEF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlc1trZXldLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRDb21wb25lbnQuZGF0YS5hdHRyaWJ1dGVzW25hbWVdID0gdGhpcy5fY2xvbmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHNjcmlwdENvbXBvbmVudC5kYXRhLmF0dHJpYnV0ZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jb252ZXJ0QXR0cmlidXRlVmFsdWUoYXR0cmlidXRlKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ3JnYicgfHwgYXR0cmlidXRlLnR5cGUgPT09ICdyZ2JhJykge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZS5sZW5ndGggPT09IDMgP1xuICAgICAgICAgICAgICAgICAgICBuZXcgQ29sb3IoYXR0cmlidXRlLnZhbHVlWzBdLCBhdHRyaWJ1dGUudmFsdWVbMV0sIGF0dHJpYnV0ZS52YWx1ZVsyXSkgOlxuICAgICAgICAgICAgICAgICAgICBuZXcgQ29sb3IoYXR0cmlidXRlLnZhbHVlWzBdLCBhdHRyaWJ1dGUudmFsdWVbMV0sIGF0dHJpYnV0ZS52YWx1ZVsyXSwgYXR0cmlidXRlLnZhbHVlWzNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ3ZlYzInKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhdHRyaWJ1dGUudmFsdWUpKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IG5ldyBWZWMyKGF0dHJpYnV0ZS52YWx1ZVswXSwgYXR0cmlidXRlLnZhbHVlWzFdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZS50eXBlID09PSAndmVjMycgfHwgYXR0cmlidXRlLnR5cGUgPT09ICd2ZWN0b3InKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhdHRyaWJ1dGUudmFsdWUpKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IG5ldyBWZWMzKGF0dHJpYnV0ZS52YWx1ZVswXSwgYXR0cmlidXRlLnZhbHVlWzFdLCBhdHRyaWJ1dGUudmFsdWVbMl0pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICd2ZWM0Jykge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnZhbHVlKSlcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBuZXcgVmVjNChhdHRyaWJ1dGUudmFsdWVbMF0sIGF0dHJpYnV0ZS52YWx1ZVsxXSwgYXR0cmlidXRlLnZhbHVlWzJdLCBhdHRyaWJ1dGUudmFsdWVbM10pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlLnZhbHVlICE9PSBudWxsICYmIHR5cGVvZiBhdHRyaWJ1dGUudmFsdWUgPT09ICdzdHJpbmcnKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IHRoaXMuYXBwLnJvb3QuZmluZEJ5R3VpZChhdHRyaWJ1dGUudmFsdWUpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdjdXJ2ZScgfHwgYXR0cmlidXRlLnR5cGUgPT09ICdjb2xvcmN1cnZlJykge1xuICAgICAgICAgICAgY29uc3QgY3VydmVUeXBlID0gYXR0cmlidXRlLnZhbHVlLmtleXNbMF0gaW5zdGFuY2VvZiBBcnJheSA/IEN1cnZlU2V0IDogQ3VydmU7XG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBuZXcgY3VydmVUeXBlKGF0dHJpYnV0ZS52YWx1ZS5rZXlzKTtcblxuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZS50eXBlID0gYXR0cmlidXRlLnZhbHVlLnR5cGU7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoSU5JVElBTElaRSwgdGhpcy5vbkluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZihQT1NUX0lOSVRJQUxJWkUsIHRoaXMub25Qb3N0SW5pdGlhbGl6ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKFVQREFURSwgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKEZJWEVEX1VQREFURSwgdGhpcy5vbkZpeGVkVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoUE9TVF9VUERBVEUsIHRoaXMub25Qb3N0VXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoVE9PTFNfVVBEQVRFLCB0aGlzLm9uVG9vbHNVcGRhdGUsIHRoaXMpO1xuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhTY3JpcHRMZWdhY3lDb21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgU2NyaXB0TGVnYWN5Q29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiX3NjaGVtYSIsIklOSVRJQUxJWkUiLCJQT1NUX0lOSVRJQUxJWkUiLCJVUERBVEUiLCJQT1NUX1VQREFURSIsIkZJWEVEX1VQREFURSIsIlRPT0xTX1VQREFURSIsIk9OX0VOQUJMRSIsIk9OX0RJU0FCTEUiLCJTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIlNjcmlwdExlZ2FjeUNvbXBvbmVudCIsIkRhdGFUeXBlIiwiU2NyaXB0TGVnYWN5Q29tcG9uZW50RGF0YSIsInNjaGVtYSIsInByZWxvYWRpbmciLCJpbnN0YW5jZXNXaXRoVXBkYXRlIiwiaW5zdGFuY2VzV2l0aEZpeGVkVXBkYXRlIiwiaW5zdGFuY2VzV2l0aFBvc3RVcGRhdGUiLCJpbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwic3lzdGVtcyIsIm9uSW5pdGlhbGl6ZSIsIm9uUG9zdEluaXRpYWxpemUiLCJvblVwZGF0ZSIsIm9uRml4ZWRVcGRhdGUiLCJvblBvc3RVcGRhdGUiLCJvblRvb2xzVXBkYXRlIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsInNjcmlwdHMiLCJsZW5ndGgiLCJmb3JFYWNoIiwic2NyaXB0IiwiYXR0cmlidXRlcyIsIkFycmF5IiwiaXNBcnJheSIsImRpY3QiLCJpIiwibmFtZSIsImNsb25lQ29tcG9uZW50IiwiZW50aXR5IiwiY2xvbmUiLCJzcmMiLCJzdG9yZSIsImdldEd1aWQiLCJydW5JblRvb2xzIiwiZW5hYmxlZCIsImxlbiIsInB1c2giLCJleHRlbmQiLCJfY2xvbmVBdHRyaWJ1dGVzIiwiYWRkQ29tcG9uZW50IiwiX2Rpc2FibGVTY3JpcHRDb21wb25lbnQiLCJfZGVzdHJveVNjcmlwdENvbXBvbmVudCIsInJvb3QiLCJfcmVnaXN0ZXJJbnN0YW5jZXMiLCJfaW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudCIsImNoaWxkcmVuIiwiX2NoaWxkcmVuIiwiRW50aXR5IiwiX3Bvc3RJbml0aWFsaXplU2NyaXB0Q29tcG9uZW50IiwiX2NhbGxJbnN0YW5jZXNNZXRob2QiLCJtZXRob2QiLCJpbnN0YW5jZXMiLCJoYXNPd25Qcm9wZXJ0eSIsImluc3RhbmNlIiwiaW5pdGlhbGl6ZWQiLCJfZW5hYmxlU2NyaXB0Q29tcG9uZW50IiwiZGVzdHJveSIsInVwZGF0ZSIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsImZpeGVkVXBkYXRlIiwicG9zdFVwZGF0ZSIsInRvb2xzVXBkYXRlIiwicG9zdEluaXRpYWxpemVkIiwiX3VwZGF0ZUluc3RhbmNlcyIsInVwZGF0ZUxpc3QiLCJkdCIsIml0ZW0iLCJicm9hZGNhc3QiLCJmdW5jdGlvbk5hbWUiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJhcmdzIiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwiYXJndW1lbnRzIiwiZGF0YVN0b3JlIiwiZm4iLCJhcHBseSIsIl9wcmVSZWdpc3Rlckluc3RhbmNlIiwidXJsIiwiX2luc3RhbmNlcyIsIkVycm9yIiwiaW5zdGFuY2VOYW1lIiwicHJlUmVnaXN0ZXJlZCIsImV2ZW50cyIsImF0dGFjaCIsIl9jcmVhdGVBY2Nlc3NvcnMiLCJyZXN1bHQiLCJrZXkiLCJ0eXBlIiwidmFsIiwidmFsdWUiLCJfY3JlYXRlQWNjZXNzb3IiLCJhdHRyaWJ1dGUiLCJzZWxmIiwiX2NvbnZlcnRBdHRyaWJ1dGVWYWx1ZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0Iiwic2V0Iiwib2xkVmFsdWUiLCJmaXJlIiwiY29uZmlndXJhYmxlIiwiX3VwZGF0ZUFjY2Vzc29ycyIsInNjcmlwdENvbXBvbmVudCIsInByZXZpb3VzQXR0cmlidXRlcyIsIm9sZEF0dHJpYnV0ZSIsIm9uQXR0cmlidXRlQ2hhbmdlZCIsIkNvbG9yIiwiVmVjMiIsIlZlYzMiLCJWZWM0IiwiZmluZEJ5R3VpZCIsImN1cnZlVHlwZSIsImtleXMiLCJDdXJ2ZVNldCIsIkN1cnZlIiwib2ZmIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1CQSxNQUFNQSxPQUFPLEdBQUcsQ0FDWixTQUFTLEVBQ1QsU0FBUyxFQUNULFdBQVcsRUFDWCxZQUFZLENBQ2YsQ0FBQTtBQUVELE1BQU1DLFVBQVUsR0FBRyxZQUFZLENBQUE7QUFDL0IsTUFBTUMsZUFBZSxHQUFHLGdCQUFnQixDQUFBO0FBQ3hDLE1BQU1DLE1BQU0sR0FBRyxRQUFRLENBQUE7QUFDdkIsTUFBTUMsV0FBVyxHQUFHLFlBQVksQ0FBQTtBQUNoQyxNQUFNQyxZQUFZLEdBQUcsYUFBYSxDQUFBO0FBQ2xDLE1BQU1DLFlBQVksR0FBRyxhQUFhLENBQUE7QUFDbEMsTUFBTUMsU0FBUyxHQUFHLFVBQVUsQ0FBQTtBQUM1QixNQUFNQyxVQUFVLEdBQUcsV0FBVyxDQUFBO0FBRTlCLE1BQU1DLDJC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
