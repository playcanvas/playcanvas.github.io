/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { extend } from '../../../core/core.js';
import { events } from '../../../core/events.js';
import { Debug } from '../../../core/debug.js';
import { Color } from '../../../math/color.js';
import { Curve } from '../../../math/curve.js';
import { CurveSet } from '../../../math/curve-set.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';
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
    this.preloading = false;
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
    const src = this.store[entity.getGuid()];
    const data = {
      runInTools: src.data.runInTools,
      scripts: [],
      enabled: src.data.enabled
    };
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
    if (component.enabled) {
      this._disableScriptComponent(component);
    }

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

          if (entity.script[instanceName]) {
            throw Error(`Script with name '${instanceName}' is already attached to Script Component`);
          } else {
            entity.script[instanceName] = instance;
          }
        }

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
            for (const key in attributes) {
              if (attributes.hasOwnProperty(key)) {
                this._createAccessor(attributes[key], instance);
              }
            }
          }

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
      attribute.value.type = attribute.value.type;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0LWxlZ2FjeS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb3JlLmpzJztcbmltcG9ydCB7IGV2ZW50cyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZXZlbnRzLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBDdXJ2ZSB9IGZyb20gJy4uLy4uLy4uL21hdGgvY3VydmUuanMnO1xuaW1wb3J0IHsgQ3VydmVTZXQgfSBmcm9tICcuLi8uLi8uLi9tYXRoL2N1cnZlLXNldC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uLy4uL2VudGl0eS5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBTY3JpcHRMZWdhY3lDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBTY3JpcHRMZWdhY3lDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCcsXG4gICAgJ3NjcmlwdHMnLFxuICAgICdpbnN0YW5jZXMnLFxuICAgICdydW5JblRvb2xzJ1xuXTtcblxuY29uc3QgSU5JVElBTElaRSA9ICdpbml0aWFsaXplJztcbmNvbnN0IFBPU1RfSU5JVElBTElaRSA9ICdwb3N0SW5pdGlhbGl6ZSc7XG5jb25zdCBVUERBVEUgPSAndXBkYXRlJztcbmNvbnN0IFBPU1RfVVBEQVRFID0gJ3Bvc3RVcGRhdGUnO1xuY29uc3QgRklYRURfVVBEQVRFID0gJ2ZpeGVkVXBkYXRlJztcbmNvbnN0IFRPT0xTX1VQREFURSA9ICd0b29sc1VwZGF0ZSc7XG5jb25zdCBPTl9FTkFCTEUgPSAnb25FbmFibGUnO1xuY29uc3QgT05fRElTQUJMRSA9ICdvbkRpc2FibGUnO1xuXG5jbGFzcyBTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnc2NyaXB0JztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBTY3JpcHRMZWdhY3lDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBTY3JpcHRMZWdhY3lDb21wb25lbnREYXRhO1xuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgLy8gdXNlZCBieSBhcHBsaWNhdGlvbiBkdXJpbmcgcHJlbG9hZGluZyBwaGFzZSB0byBlbnN1cmUgc2NyaXB0cyBhcmVuJ3RcbiAgICAgICAgLy8gaW5pdGlhbGl6ZWQgdW50aWwgZXZlcnl0aGluZyBpcyBsb2FkZWRcbiAgICAgICAgdGhpcy5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYXJyYXlzIHRvIGNhY2hlIHNjcmlwdCBpbnN0YW5jZXMgZm9yIGZhc3QgaXRlcmF0aW9uXG4gICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZSA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhQb3N0VXBkYXRlID0gW107XG4gICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlID0gW107XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub24oSU5JVElBTElaRSwgdGhpcy5vbkluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKFBPU1RfSU5JVElBTElaRSwgdGhpcy5vblBvc3RJbml0aWFsaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbihVUERBVEUsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKEZJWEVEX1VQREFURSwgdGhpcy5vbkZpeGVkVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbihQT1NUX1VQREFURSwgdGhpcy5vblBvc3RVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKFRPT0xTX1VQREFURSwgdGhpcy5vblRvb2xzVXBkYXRlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgcHJvcGVydGllcyA9IFsncnVuSW5Ub29scycsICdlbmFibGVkJywgJ3NjcmlwdHMnXTtcblxuICAgICAgICAvLyBjb252ZXJ0IGF0dHJpYnV0ZXMgYXJyYXkgdG8gZGljdGlvbmFyeVxuICAgICAgICBpZiAoZGF0YS5zY3JpcHRzICYmIGRhdGEuc2NyaXB0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGRhdGEuc2NyaXB0cy5mb3JFYWNoKGZ1bmN0aW9uIChzY3JpcHQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LmF0dHJpYnV0ZXMgJiYgQXJyYXkuaXNBcnJheShzY3JpcHQuYXR0cmlidXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGljdCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjcmlwdC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaWN0W3NjcmlwdC5hdHRyaWJ1dGVzW2ldLm5hbWVdID0gc2NyaXB0LmF0dHJpYnV0ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBzY3JpcHQuYXR0cmlidXRlcyA9IGRpY3Q7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gb3ZlcnJpZGRlbiB0byBtYWtlIHN1cmUgdXJscyBsaXN0IGlzIGR1cGxpY2F0ZWRcbiAgICAgICAgY29uc3Qgc3JjID0gdGhpcy5zdG9yZVtlbnRpdHkuZ2V0R3VpZCgpXTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIHJ1bkluVG9vbHM6IHNyYy5kYXRhLnJ1bkluVG9vbHMsXG4gICAgICAgICAgICBzY3JpcHRzOiBbXSxcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNyYy5kYXRhLmVuYWJsZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBtYW51YWxseSBjbG9uZSBzY3JpcHRzIHNvIHRoYXQgd2UgZG9uJ3QgY2xvbmUgYXR0cmlidXRlcyB3aXRoIHBjLmV4dGVuZFxuICAgICAgICAvLyB3aGljaCB3aWxsIHJlc3VsdCBpbiBhIHN0YWNrIG92ZXJmbG93IHdoZW4gZXh0ZW5kaW5nICdlbnRpdHknIHNjcmlwdCBhdHRyaWJ1dGVzXG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSBzcmMuZGF0YS5zY3JpcHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IHNjcmlwdHNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHNjcmlwdHNbaV0uYXR0cmlidXRlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGF0YS5zY3JpcHRzLnB1c2goZXh0ZW5kKHt9LCBzY3JpcHRzW2ldKSk7XG5cbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5zY3JpcHRzW2ldLmF0dHJpYnV0ZXMgPSB0aGlzLl9jbG9uZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XG4gICAgICAgICAgICAgICAgc2NyaXB0c1tpXS5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNjcmlwdCBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAvLyBjYWxsIG9uRGlzYWJsZSBvbiBhbGwgaXRzIGluc3RhbmNlcyBmaXJzdFxuICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVTY3JpcHRDb21wb25lbnQoY29tcG9uZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoZW4gY2FsbCBkZXN0cm95IG9uIGFsbCB0aGUgc2NyaXB0IGluc3RhbmNlc1xuICAgICAgICB0aGlzLl9kZXN0cm95U2NyaXB0Q29tcG9uZW50KGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgb25Jbml0aWFsaXplKHJvb3QpIHtcbiAgICAgICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZXMocm9vdCk7XG5cbiAgICAgICAgaWYgKHJvb3QuZW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKHJvb3Quc2NyaXB0ICYmIHJvb3Quc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHJvb3Quc2NyaXB0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSByb290Ll9jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbltpXSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uSW5pdGlhbGl6ZShjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25Qb3N0SW5pdGlhbGl6ZShyb290KSB7XG4gICAgICAgIGlmIChyb290LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChyb290LnNjcmlwdCAmJiByb290LnNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zdEluaXRpYWxpemVTY3JpcHRDb21wb25lbnQocm9vdC5zY3JpcHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHJvb3QuX2NoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25Qb3N0SW5pdGlhbGl6ZShjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NhbGxJbnN0YW5jZXNNZXRob2Qoc2NyaXB0LCBtZXRob2QpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gc2NyaXB0LmRhdGEuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gaW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBpbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlW21ldGhvZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VbbWV0aG9kXSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9pbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICB0aGlzLl9jYWxsSW5zdGFuY2VzTWV0aG9kKHNjcmlwdCwgSU5JVElBTElaRSk7XG4gICAgICAgIHNjcmlwdC5kYXRhLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBjaGVjayBhZ2FpbiBpZiB0aGUgc2NyaXB0IGFuZCB0aGUgZW50aXR5IGFyZSBlbmFibGVkXG4gICAgICAgIC8vIGluIGNhc2UgdGhleSBnb3QgZGlzYWJsZWQgZHVyaW5nIGluaXRpYWxpemVcbiAgICAgICAgaWYgKHNjcmlwdC5lbmFibGVkICYmIHNjcmlwdC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlU2NyaXB0Q29tcG9uZW50KHNjcmlwdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZW5hYmxlU2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICB0aGlzLl9jYWxsSW5zdGFuY2VzTWV0aG9kKHNjcmlwdCwgT05fRU5BQkxFKTtcbiAgICB9XG5cbiAgICBfZGlzYWJsZVNjcmlwdENvbXBvbmVudChzY3JpcHQpIHtcbiAgICAgICAgdGhpcy5fY2FsbEluc3RhbmNlc01ldGhvZChzY3JpcHQsIE9OX0RJU0FCTEUpO1xuICAgIH1cblxuICAgIF9kZXN0cm95U2NyaXB0Q29tcG9uZW50KHNjcmlwdCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBzY3JpcHQuZGF0YS5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBpbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IGluc3RhbmNlc1tuYW1lXS5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UuZGVzdHJveSkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5pbmRleE9mKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLmZpeGVkVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5pbnN0YW5jZXNXaXRoRml4ZWRVcGRhdGUuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmluc3RhbmNlc1dpdGhQb3N0VXBkYXRlLmluZGV4T2YoaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoUG9zdFVwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnRvb2xzVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5pbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluc3RhbmNlc1dpdGhUb29sc1VwZGF0ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5pbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2UgPT09IHNjcmlwdFtuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2NyaXB0W25hbWVdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWxldGUgc2NyaXB0Lmluc3RhbmNlc1tuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9wb3N0SW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudChzY3JpcHQpIHtcbiAgICAgICAgdGhpcy5fY2FsbEluc3RhbmNlc01ldGhvZChzY3JpcHQsIFBPU1RfSU5JVElBTElaRSk7XG4gICAgICAgIHNjcmlwdC5kYXRhLnBvc3RJbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUluc3RhbmNlcyhtZXRob2QsIHVwZGF0ZUxpc3QsIGR0KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB1cGRhdGVMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpdGVtID0gdXBkYXRlTGlzdFtpXTtcbiAgICAgICAgICAgIGlmIChpdGVtICYmIGl0ZW0uZW50aXR5ICYmIGl0ZW0uZW50aXR5LmVuYWJsZWQgJiYgaXRlbS5lbnRpdHkuc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBpdGVtW21ldGhvZF0oZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25VcGRhdGUoZHQpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlSW5zdGFuY2VzKFVQREFURSwgdGhpcy5pbnN0YW5jZXNXaXRoVXBkYXRlLCBkdCk7XG4gICAgfVxuXG4gICAgb25GaXhlZFVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLl91cGRhdGVJbnN0YW5jZXMoRklYRURfVVBEQVRFLCB0aGlzLmluc3RhbmNlc1dpdGhGaXhlZFVwZGF0ZSwgZHQpO1xuICAgIH1cblxuICAgIG9uUG9zdFVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLl91cGRhdGVJbnN0YW5jZXMoUE9TVF9VUERBVEUsIHRoaXMuaW5zdGFuY2VzV2l0aFBvc3RVcGRhdGUsIGR0KTtcbiAgICB9XG5cbiAgICBvblRvb2xzVXBkYXRlKGR0KSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUluc3RhbmNlcyhUT09MU19VUERBVEUsIHRoaXMuaW5zdGFuY2VzV2l0aFRvb2xzVXBkYXRlLCBkdCk7XG4gICAgfVxuXG4gICAgYnJvYWRjYXN0KG5hbWUsIGZ1bmN0aW9uTmFtZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0uYnJvYWRjYXN0KCkgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIHNvb24uIFBsZWFzZSB1c2U6IGh0dHA6Ly9kZXZlbG9wZXIucGxheWNhbnZhcy5jb20vdXNlci1tYW51YWwvc2NyaXB0aW5nL2NvbW11bmljYXRpb24vJyk7XG5cbiAgICAgICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cbiAgICAgICAgY29uc3QgZGF0YVN0b3JlID0gdGhpcy5zdG9yZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGRhdGFTdG9yZSkge1xuICAgICAgICAgICAgaWYgKGRhdGFTdG9yZS5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gZGF0YVN0b3JlW2lkXS5kYXRhO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLmluc3RhbmNlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmbiA9IGRhdGEuaW5zdGFuY2VzW25hbWVdLmluc3RhbmNlW2Z1bmN0aW9uTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm4uYXBwbHkoZGF0YS5pbnN0YW5jZXNbbmFtZV0uaW5zdGFuY2UsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3ByZVJlZ2lzdGVySW5zdGFuY2UoZW50aXR5LCB1cmwsIG5hbWUsIGluc3RhbmNlKSB7XG4gICAgICAgIGlmIChlbnRpdHkuc2NyaXB0KSB7XG4gICAgICAgICAgICBlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlcyA9IGVudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzIHx8IHt9O1xuICAgICAgICAgICAgaWYgKGVudGl0eS5zY3JpcHQuZGF0YS5faW5zdGFuY2VzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFNjcmlwdCBuYW1lIGNvbGxpc2lvbiAnJHtuYW1lfScuIFNjcmlwdHMgZnJvbSAnJHt1cmx9JyBhbmQgJyR7ZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXNbbmFtZV0udXJsfScgeyR7ZW50aXR5LmdldEd1aWQoKX19YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlc1tuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgIGluc3RhbmNlOiBpbnN0YW5jZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWdpc3Rlckluc3RhbmNlcyhlbnRpdHkpIHtcbiAgICAgICAgaWYgKGVudGl0eS5zY3JpcHQpIHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuc2NyaXB0LmRhdGEuX2luc3RhbmNlcykge1xuICAgICAgICAgICAgICAgIGVudGl0eS5zY3JpcHQuaW5zdGFuY2VzID0gZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXM7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGluc3RhbmNlTmFtZSBpbiBlbnRpdHkuc2NyaXB0Lmluc3RhbmNlcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVSZWdpc3RlcmVkID0gZW50aXR5LnNjcmlwdC5pbnN0YW5jZXNbaW5zdGFuY2VOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBwcmVSZWdpc3RlcmVkLmluc3RhbmNlO1xuXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50cy5hdHRhY2goaW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzV2l0aFVwZGF0ZS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5maXhlZFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoRml4ZWRVcGRhdGUucHVzaChpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoUG9zdFVwZGF0ZS5wdXNoKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS50b29sc1VwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUucHVzaChpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnNjcmlwdC5zY3JpcHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVBY2Nlc3NvcnMoZW50aXR5LCBwcmVSZWdpc3RlcmVkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ha2UgaW5zdGFuY2UgYWNjZXNzaWJsZSBmcm9tIHRoZSBzY3JpcHQgY29tcG9uZW50IG9mIHRoZSBFbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS5zY3JpcHRbaW5zdGFuY2VOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgRXJyb3IoYFNjcmlwdCB3aXRoIG5hbWUgJyR7aW5zdGFuY2VOYW1lfScgaXMgYWxyZWFkeSBhdHRhY2hlZCB0byBTY3JpcHQgQ29tcG9uZW50YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc2NyaXB0W2luc3RhbmNlTmFtZV0gPSBpbnN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0ZW1wIHN0b3JhZ2VcbiAgICAgICAgICAgICAgICBkZWxldGUgZW50aXR5LnNjcmlwdC5kYXRhLl9pbnN0YW5jZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IGVudGl0eS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVnaXN0ZXJJbnN0YW5jZXMoY2hpbGRyZW5baV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lQXR0cmlidXRlcyhhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgIGlmICghYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlc1trZXldLnR5cGUgIT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBleHRlbmQoe30sIGF0dHJpYnV0ZXNba2V5XSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IHBjLmV4dGVuZCBhbiBlbnRpdHlcbiAgICAgICAgICAgICAgICBjb25zdCB2YWwgPSBhdHRyaWJ1dGVzW2tleV0udmFsdWU7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGF0dHJpYnV0ZXNba2V5XS52YWx1ZTtcblxuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gZXh0ZW5kKHt9LCBhdHRyaWJ1dGVzW2tleV0pO1xuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldLnZhbHVlID0gdmFsO1xuXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlc1trZXldLnZhbHVlID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlQWNjZXNzb3JzKGVudGl0eSwgaW5zdGFuY2UpIHtcbiAgICAgICAgY29uc3QgbGVuID0gZW50aXR5LnNjcmlwdC5zY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgdXJsID0gaW5zdGFuY2UudXJsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGVudGl0eS5zY3JpcHQuc2NyaXB0c1tpXTtcbiAgICAgICAgICAgIGlmIChzY3JpcHQudXJsID09PSB1cmwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gc2NyaXB0LmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5uYW1lICYmIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUFjY2Vzc29yKGF0dHJpYnV0ZXNba2V5XSwgaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNjcmlwdC5kYXRhLmF0dHJpYnV0ZXNbc2NyaXB0Lm5hbWVdID0gdGhpcy5fY2xvbmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jcmVhdGVBY2Nlc3NvcihhdHRyaWJ1dGUsIGluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBjb3B5IG9mIGF0dHJpYnV0ZSBkYXRhXG4gICAgICAgIC8vIHRvIGF2b2lkIG92ZXJ3cml0aW5nIHRoZSBzYW1lIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgICAgLy8gdGhhdCBhcmUgdXNlZCBieSB0aGUgRWRpdG9yXG4gICAgICAgIGF0dHJpYnV0ZSA9IHtcbiAgICAgICAgICAgIG5hbWU6IGF0dHJpYnV0ZS5uYW1lLFxuICAgICAgICAgICAgdmFsdWU6IGF0dHJpYnV0ZS52YWx1ZSxcbiAgICAgICAgICAgIHR5cGU6IGF0dHJpYnV0ZS50eXBlXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fY29udmVydEF0dHJpYnV0ZVZhbHVlKGF0dHJpYnV0ZSk7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLmluc3RhbmNlLCBhdHRyaWJ1dGUubmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF0dHJpYnV0ZS52YWx1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHNlbGYuX2NvbnZlcnRBdHRyaWJ1dGVWYWx1ZShhdHRyaWJ1dGUpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLmluc3RhbmNlLmZpcmUoJ3NldCcsIGF0dHJpYnV0ZS5uYW1lLCBvbGRWYWx1ZSwgYXR0cmlidXRlLnZhbHVlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUFjY2Vzc29ycyhlbnRpdHksIGluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IGVudGl0eS5zY3JpcHQuc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHVybCA9IGluc3RhbmNlLnVybDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRDb21wb25lbnQgPSBlbnRpdHkuc2NyaXB0O1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gc2NyaXB0Q29tcG9uZW50LnNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoc2NyaXB0LnVybCA9PT0gdXJsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IHNjcmlwdC5uYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBzY3JpcHQuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIC8gdXBkYXRlIGF0dHJpYnV0ZSBhY2Nlc3NvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUFjY2Vzc29yKGF0dHJpYnV0ZXNba2V5XSwgaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSBhY2Nlc3NvcnMgZm9yIGF0dHJpYnV0ZXMgdGhhdCBubyBsb25nZXIgZXhpc3RcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGZpcmUgb25BdHRyaWJ1dGVDaGFuZ2Ugd2hlbiBhbiBhdHRyaWJ1dGUgdmFsdWUgY2hhbmdlZFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmV2aW91c0F0dHJpYnV0ZXMgPSBzY3JpcHRDb21wb25lbnQuZGF0YS5hdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJldmlvdXNBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBwcmV2aW91c0F0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRBdHRyaWJ1dGUgPSBwcmV2aW91c0F0dHJpYnV0ZXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShrZXkgaW4gYXR0cmlidXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGluc3RhbmNlLmluc3RhbmNlW29sZEF0dHJpYnV0ZS5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlc1trZXldLnZhbHVlICE9PSBvbGRBdHRyaWJ1dGUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5pbnN0YW5jZS5vbkF0dHJpYnV0ZUNoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbnN0YW5jZS5vbkF0dHJpYnV0ZUNoYW5nZWQob2xkQXR0cmlidXRlLm5hbWUsIG9sZEF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlc1trZXldLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRDb21wb25lbnQuZGF0YS5hdHRyaWJ1dGVzW25hbWVdID0gdGhpcy5fY2xvbmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHNjcmlwdENvbXBvbmVudC5kYXRhLmF0dHJpYnV0ZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jb252ZXJ0QXR0cmlidXRlVmFsdWUoYXR0cmlidXRlKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ3JnYicgfHwgYXR0cmlidXRlLnR5cGUgPT09ICdyZ2JhJykge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZS5sZW5ndGggPT09IDMgP1xuICAgICAgICAgICAgICAgICAgICBuZXcgQ29sb3IoYXR0cmlidXRlLnZhbHVlWzBdLCBhdHRyaWJ1dGUudmFsdWVbMV0sIGF0dHJpYnV0ZS52YWx1ZVsyXSkgOlxuICAgICAgICAgICAgICAgICAgICBuZXcgQ29sb3IoYXR0cmlidXRlLnZhbHVlWzBdLCBhdHRyaWJ1dGUudmFsdWVbMV0sIGF0dHJpYnV0ZS52YWx1ZVsyXSwgYXR0cmlidXRlLnZhbHVlWzNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ3ZlYzInKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhdHRyaWJ1dGUudmFsdWUpKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IG5ldyBWZWMyKGF0dHJpYnV0ZS52YWx1ZVswXSwgYXR0cmlidXRlLnZhbHVlWzFdKTtcblxuICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZS50eXBlID09PSAndmVjMycgfHwgYXR0cmlidXRlLnR5cGUgPT09ICd2ZWN0b3InKSB7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhdHRyaWJ1dGUudmFsdWUpKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IG5ldyBWZWMzKGF0dHJpYnV0ZS52YWx1ZVswXSwgYXR0cmlidXRlLnZhbHVlWzFdLCBhdHRyaWJ1dGUudmFsdWVbMl0pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICd2ZWM0Jykge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnZhbHVlKSlcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBuZXcgVmVjNChhdHRyaWJ1dGUudmFsdWVbMF0sIGF0dHJpYnV0ZS52YWx1ZVsxXSwgYXR0cmlidXRlLnZhbHVlWzJdLCBhdHRyaWJ1dGUudmFsdWVbM10pO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlLnZhbHVlICE9PSBudWxsICYmIHR5cGVvZiBhdHRyaWJ1dGUudmFsdWUgPT09ICdzdHJpbmcnKVxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZSA9IHRoaXMuYXBwLnJvb3QuZmluZEJ5R3VpZChhdHRyaWJ1dGUudmFsdWUpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdjdXJ2ZScgfHwgYXR0cmlidXRlLnR5cGUgPT09ICdjb2xvcmN1cnZlJykge1xuICAgICAgICAgICAgY29uc3QgY3VydmVUeXBlID0gYXR0cmlidXRlLnZhbHVlLmtleXNbMF0gaW5zdGFuY2VvZiBBcnJheSA/IEN1cnZlU2V0IDogQ3VydmU7XG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWUgPSBuZXcgY3VydmVUeXBlKGF0dHJpYnV0ZS52YWx1ZS5rZXlzKTtcblxuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZS50eXBlID0gYXR0cmlidXRlLnZhbHVlLnR5cGU7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoSU5JVElBTElaRSwgdGhpcy5vbkluaXRpYWxpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZihQT1NUX0lOSVRJQUxJWkUsIHRoaXMub25Qb3N0SW5pdGlhbGl6ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKFVQREFURSwgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKEZJWEVEX1VQREFURSwgdGhpcy5vbkZpeGVkVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoUE9TVF9VUERBVEUsIHRoaXMub25Qb3N0VXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoVE9PTFNfVVBEQVRFLCB0aGlzLm9uVG9vbHNVcGRhdGUsIHRoaXMpO1xuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhTY3JpcHRMZWdhY3lDb21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgU2NyaXB0TGVnYWN5Q29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiX3NjaGVtYSIsIklOSVRJQUxJWkUiLCJQT1NUX0lOSVRJQUxJWkUiLCJVUERBVEUiLCJQT1NUX1VQREFURSIsIkZJWEVEX1VQREFURSIsIlRPT0xTX1VQREFURSIsIk9OX0VOQUJMRSIsIk9OX0RJU0FCTEUiLCJTY3JpcHRMZWdhY3lDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIlNjcmlwdExlZ2FjeUNvbXBvbmVudCIsIkRhdGFUeXBlIiwiU2NyaXB0TGVnYWN5Q29tcG9uZW50RGF0YSIsInNjaGVtYSIsInByZWxvYWRpbmciLCJpbnN0YW5jZXNXaXRoVXBkYXRlIiwiaW5zdGFuY2VzV2l0aEZpeGVkVXBkYXRlIiwiaW5zdGFuY2VzV2l0aFBvc3RVcGRhdGUiLCJpbnN0YW5jZXNXaXRoVG9vbHNVcGRhdGUiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwic3lzdGVtcyIsIm9uSW5pdGlhbGl6ZSIsIm9uUG9zdEluaXRpYWxpemUiLCJvblVwZGF0ZSIsIm9uRml4ZWRVcGRhdGUiLCJvblBvc3RVcGRhdGUiLCJvblRvb2xzVXBkYXRlIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsInNjcmlwdHMiLCJsZW5ndGgiLCJmb3JFYWNoIiwic2NyaXB0IiwiYXR0cmlidXRlcyIsIkFycmF5IiwiaXNBcnJheSIsImRpY3QiLCJpIiwibmFtZSIsImNsb25lQ29tcG9uZW50IiwiZW50aXR5IiwiY2xvbmUiLCJzcmMiLCJzdG9yZSIsImdldEd1aWQiLCJydW5JblRvb2xzIiwiZW5hYmxlZCIsImxlbiIsInB1c2giLCJleHRlbmQiLCJfY2xvbmVBdHRyaWJ1dGVzIiwiYWRkQ29tcG9uZW50IiwiX2Rpc2FibGVTY3JpcHRDb21wb25lbnQiLCJfZGVzdHJveVNjcmlwdENvbXBvbmVudCIsInJvb3QiLCJfcmVnaXN0ZXJJbnN0YW5jZXMiLCJfaW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudCIsImNoaWxkcmVuIiwiX2NoaWxkcmVuIiwiRW50aXR5IiwiX3Bvc3RJbml0aWFsaXplU2NyaXB0Q29tcG9uZW50IiwiX2NhbGxJbnN0YW5jZXNNZXRob2QiLCJtZXRob2QiLCJpbnN0YW5jZXMiLCJoYXNPd25Qcm9wZXJ0eSIsImluc3RhbmNlIiwiaW5pdGlhbGl6ZWQiLCJfZW5hYmxlU2NyaXB0Q29tcG9uZW50IiwiZGVzdHJveSIsInVwZGF0ZSIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsImZpeGVkVXBkYXRlIiwicG9zdFVwZGF0ZSIsInRvb2xzVXBkYXRlIiwicG9zdEluaXRpYWxpemVkIiwiX3VwZGF0ZUluc3RhbmNlcyIsInVwZGF0ZUxpc3QiLCJkdCIsIml0ZW0iLCJicm9hZGNhc3QiLCJmdW5jdGlvbk5hbWUiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJhcmdzIiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwiYXJndW1lbnRzIiwiZGF0YVN0b3JlIiwiZm4iLCJhcHBseSIsIl9wcmVSZWdpc3Rlckluc3RhbmNlIiwidXJsIiwiX2luc3RhbmNlcyIsIkVycm9yIiwiaW5zdGFuY2VOYW1lIiwicHJlUmVnaXN0ZXJlZCIsImV2ZW50cyIsImF0dGFjaCIsIl9jcmVhdGVBY2Nlc3NvcnMiLCJyZXN1bHQiLCJrZXkiLCJ0eXBlIiwidmFsIiwidmFsdWUiLCJfY3JlYXRlQWNjZXNzb3IiLCJhdHRyaWJ1dGUiLCJzZWxmIiwiX2NvbnZlcnRBdHRyaWJ1dGVWYWx1ZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0Iiwic2V0Iiwib2xkVmFsdWUiLCJmaXJlIiwiY29uZmlndXJhYmxlIiwiX3VwZGF0ZUFjY2Vzc29ycyIsInNjcmlwdENvbXBvbmVudCIsInByZXZpb3VzQXR0cmlidXRlcyIsIm9sZEF0dHJpYnV0ZSIsIm9uQXR0cmlidXRlQ2hhbmdlZCIsIkNvbG9yIiwiVmVjMiIsIlZlYzMiLCJWZWM0IiwiZmluZEJ5R3VpZCIsImN1cnZlVHlwZSIsImtleXMiLCJDdXJ2ZVNldCIsIkN1cnZlIiwib2ZmIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1CQSxNQUFNQSxPQUFPLEdBQUcsQ0FDWixTQURZLEVBRVosU0FGWSxFQUdaLFdBSFksRUFJWixZQUpZLENBQWhCLENBQUE7QUFPQSxNQUFNQyxVQUFVLEdBQUcsWUFBbkIsQ0FBQTtBQUNBLE1BQU1DLGVBQWUsR0FBRyxnQkFBeEIsQ0FBQTtBQUNBLE1BQU1DLE1BQU0sR0FBRyxRQUFmLENBQUE7QUFDQSxNQUFNQyxXQUFXLEdBQUcsWUFBcEIsQ0FBQTtBQUNBLE1BQU1DLFlBQVksR0FBRyxhQUFyQixDQUFBO0FBQ0EsTUFBTUMsWUFBWSxHQUFHLGFBQXJCLENBQUE7QUFDQSxNQUFNQyxTQUFTLEdBQUcsVUFBbEIsQ0FBQTtBQUNBLE1BQU1DLFVBQVUsR0FBRyxXQUFuQixDQUFBOztBQUVBLE1BQU1DLDJCQUFOLFNBQTBDQyxlQUExQyxDQUEwRDtFQUN0REMsV0FBVyxDQUFDQyxHQUFELEVBQU07QUFDYixJQUFBLEtBQUEsQ0FBTUEsR0FBTixDQUFBLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxFQUFMLEdBQVUsUUFBVixDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsYUFBTCxHQUFxQkMscUJBQXJCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxRQUFMLEdBQWdCQyx5QkFBaEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLE1BQUwsR0FBY2xCLE9BQWQsQ0FBQTtJQUlBLElBQUttQixDQUFBQSxVQUFMLEdBQWtCLEtBQWxCLENBQUE7SUFHQSxJQUFLQyxDQUFBQSxtQkFBTCxHQUEyQixFQUEzQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsd0JBQUwsR0FBZ0MsRUFBaEMsQ0FBQTtJQUNBLElBQUtDLENBQUFBLHVCQUFMLEdBQStCLEVBQS9CLENBQUE7SUFDQSxJQUFLQyxDQUFBQSx3QkFBTCxHQUFnQyxFQUFoQyxDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUtDLEVBQUwsQ0FBUSxjQUFSLEVBQXdCLElBQUtDLENBQUFBLGNBQTdCLEVBQTZDLElBQTdDLENBQUEsQ0FBQTtJQUNBLElBQUtiLENBQUFBLEdBQUwsQ0FBU2MsT0FBVCxDQUFpQkYsRUFBakIsQ0FBb0J2QixVQUFwQixFQUFnQyxJQUFBLENBQUswQixZQUFyQyxFQUFtRCxJQUFuRCxDQUFBLENBQUE7SUFDQSxJQUFLZixDQUFBQSxHQUFMLENBQVNjLE9BQVQsQ0FBaUJGLEVBQWpCLENBQW9CdEIsZUFBcEIsRUFBcUMsSUFBQSxDQUFLMEIsZ0JBQTFDLEVBQTRELElBQTVELENBQUEsQ0FBQTtJQUNBLElBQUtoQixDQUFBQSxHQUFMLENBQVNjLE9BQVQsQ0FBaUJGLEVBQWpCLENBQW9CckIsTUFBcEIsRUFBNEIsSUFBQSxDQUFLMEIsUUFBakMsRUFBMkMsSUFBM0MsQ0FBQSxDQUFBO0lBQ0EsSUFBS2pCLENBQUFBLEdBQUwsQ0FBU2MsT0FBVCxDQUFpQkYsRUFBakIsQ0FBb0JuQixZQUFwQixFQUFrQyxJQUFBLENBQUt5QixhQUF2QyxFQUFzRCxJQUF0RCxDQUFBLENBQUE7SUFDQSxJQUFLbEIsQ0FBQUEsR0FBTCxDQUFTYyxPQUFULENBQWlCRixFQUFqQixDQUFvQnBCLFdBQXBCLEVBQWlDLElBQUEsQ0FBSzJCLFlBQXRDLEVBQW9ELElBQXBELENBQUEsQ0FBQTtJQUNBLElBQUtuQixDQUFBQSxHQUFMLENBQVNjLE9BQVQsQ0FBaUJGLEVBQWpCLENBQW9CbEIsWUFBcEIsRUFBa0MsSUFBQSxDQUFLMEIsYUFBdkMsRUFBc0QsSUFBdEQsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7QUFFREMsRUFBQUEsdUJBQXVCLENBQUNDLFNBQUQsRUFBWUMsSUFBWixFQUFrQkMsVUFBbEIsRUFBOEI7QUFDakRBLElBQUFBLFVBQVUsR0FBRyxDQUFDLFlBQUQsRUFBZSxTQUFmLEVBQTBCLFNBQTFCLENBQWIsQ0FBQTs7SUFHQSxJQUFJRCxJQUFJLENBQUNFLE9BQUwsSUFBZ0JGLElBQUksQ0FBQ0UsT0FBTCxDQUFhQyxNQUFqQyxFQUF5QztBQUNyQ0gsTUFBQUEsSUFBSSxDQUFDRSxPQUFMLENBQWFFLE9BQWIsQ0FBcUIsVUFBVUMsTUFBVixFQUFrQjtBQUNuQyxRQUFBLElBQUlBLE1BQU0sQ0FBQ0MsVUFBUCxJQUFxQkMsS0FBSyxDQUFDQyxPQUFOLENBQWNILE1BQU0sQ0FBQ0MsVUFBckIsQ0FBekIsRUFBMkQ7VUFDdkQsTUFBTUcsSUFBSSxHQUFHLEVBQWIsQ0FBQTs7QUFDQSxVQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR0wsTUFBTSxDQUFDQyxVQUFQLENBQWtCSCxNQUF0QyxFQUE4Q08sQ0FBQyxFQUEvQyxFQUFtRDtBQUMvQ0QsWUFBQUEsSUFBSSxDQUFDSixNQUFNLENBQUNDLFVBQVAsQ0FBa0JJLENBQWxCLENBQUEsQ0FBcUJDLElBQXRCLENBQUosR0FBa0NOLE1BQU0sQ0FBQ0MsVUFBUCxDQUFrQkksQ0FBbEIsQ0FBbEMsQ0FBQTtBQUNILFdBQUE7O1VBRURMLE1BQU0sQ0FBQ0MsVUFBUCxHQUFvQkcsSUFBcEIsQ0FBQTtBQUNILFNBQUE7T0FSTCxDQUFBLENBQUE7QUFVSCxLQUFBOztBQUVELElBQUEsS0FBQSxDQUFNWCx1QkFBTixDQUE4QkMsU0FBOUIsRUFBeUNDLElBQXpDLEVBQStDQyxVQUEvQyxDQUFBLENBQUE7QUFDSCxHQUFBOztBQUVEVyxFQUFBQSxjQUFjLENBQUNDLE1BQUQsRUFBU0MsS0FBVCxFQUFnQjtJQUUxQixNQUFNQyxHQUFHLEdBQUcsSUFBS0MsQ0FBQUEsS0FBTCxDQUFXSCxNQUFNLENBQUNJLE9BQVAsRUFBWCxDQUFaLENBQUE7QUFDQSxJQUFBLE1BQU1qQixJQUFJLEdBQUc7QUFDVGtCLE1BQUFBLFVBQVUsRUFBRUgsR0FBRyxDQUFDZixJQUFKLENBQVNrQixVQURaO0FBRVRoQixNQUFBQSxPQUFPLEVBQUUsRUFGQTtBQUdUaUIsTUFBQUEsT0FBTyxFQUFFSixHQUFHLENBQUNmLElBQUosQ0FBU21CLE9BQUFBO0tBSHRCLENBQUE7QUFRQSxJQUFBLE1BQU1qQixPQUFPLEdBQUdhLEdBQUcsQ0FBQ2YsSUFBSixDQUFTRSxPQUF6QixDQUFBOztBQUNBLElBQUEsS0FBSyxJQUFJUSxDQUFDLEdBQUcsQ0FBUixFQUFXVSxHQUFHLEdBQUdsQixPQUFPLENBQUNDLE1BQTlCLEVBQXNDTyxDQUFDLEdBQUdVLEdBQTFDLEVBQStDVixDQUFDLEVBQWhELEVBQW9EO0FBQ2hELE1BQUEsTUFBTUosVUFBVSxHQUFHSixPQUFPLENBQUNRLENBQUQsQ0FBUCxDQUFXSixVQUE5QixDQUFBOztBQUNBLE1BQUEsSUFBSUEsVUFBSixFQUFnQjtBQUNaLFFBQUEsT0FBT0osT0FBTyxDQUFDUSxDQUFELENBQVAsQ0FBV0osVUFBbEIsQ0FBQTtBQUNILE9BQUE7O0FBRUROLE1BQUFBLElBQUksQ0FBQ0UsT0FBTCxDQUFhbUIsSUFBYixDQUFrQkMsTUFBTSxDQUFDLEVBQUQsRUFBS3BCLE9BQU8sQ0FBQ1EsQ0FBRCxDQUFaLENBQXhCLENBQUEsQ0FBQTs7QUFFQSxNQUFBLElBQUlKLFVBQUosRUFBZ0I7UUFDWk4sSUFBSSxDQUFDRSxPQUFMLENBQWFRLENBQWIsQ0FBQSxDQUFnQkosVUFBaEIsR0FBNkIsSUFBS2lCLENBQUFBLGdCQUFMLENBQXNCakIsVUFBdEIsQ0FBN0IsQ0FBQTtBQUNBSixRQUFBQSxPQUFPLENBQUNRLENBQUQsQ0FBUCxDQUFXSixVQUFYLEdBQXdCQSxVQUF4QixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxPQUFPLEtBQUtrQixZQUFMLENBQWtCVixLQUFsQixFQUF5QmQsSUFBekIsQ0FBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFRFYsRUFBQUEsY0FBYyxDQUFDdUIsTUFBRCxFQUFTZCxTQUFULEVBQW9CO0lBRzlCLElBQUlBLFNBQVMsQ0FBQ29CLE9BQWQsRUFBdUI7TUFDbkIsSUFBS00sQ0FBQUEsdUJBQUwsQ0FBNkIxQixTQUE3QixDQUFBLENBQUE7QUFDSCxLQUFBOztJQUdELElBQUsyQixDQUFBQSx1QkFBTCxDQUE2QjNCLFNBQTdCLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRURQLFlBQVksQ0FBQ21DLElBQUQsRUFBTztJQUNmLElBQUtDLENBQUFBLGtCQUFMLENBQXdCRCxJQUF4QixDQUFBLENBQUE7O0lBRUEsSUFBSUEsSUFBSSxDQUFDUixPQUFULEVBQWtCO01BQ2QsSUFBSVEsSUFBSSxDQUFDdEIsTUFBTCxJQUFlc0IsSUFBSSxDQUFDdEIsTUFBTCxDQUFZYyxPQUEvQixFQUF3QztBQUNwQyxRQUFBLElBQUEsQ0FBS1UsMEJBQUwsQ0FBZ0NGLElBQUksQ0FBQ3RCLE1BQXJDLENBQUEsQ0FBQTtBQUNILE9BQUE7O0FBRUQsTUFBQSxNQUFNeUIsUUFBUSxHQUFHSCxJQUFJLENBQUNJLFNBQXRCLENBQUE7O0FBQ0EsTUFBQSxLQUFLLElBQUlyQixDQUFDLEdBQUcsQ0FBUixFQUFXVSxHQUFHLEdBQUdVLFFBQVEsQ0FBQzNCLE1BQS9CLEVBQXVDTyxDQUFDLEdBQUdVLEdBQTNDLEVBQWdEVixDQUFDLEVBQWpELEVBQXFEO0FBQ2pELFFBQUEsSUFBSW9CLFFBQVEsQ0FBQ3BCLENBQUQsQ0FBUixZQUF1QnNCLE1BQTNCLEVBQW1DO0FBQy9CLFVBQUEsSUFBQSxDQUFLeEMsWUFBTCxDQUFrQnNDLFFBQVEsQ0FBQ3BCLENBQUQsQ0FBMUIsQ0FBQSxDQUFBO0FBQ0gsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFFRGpCLGdCQUFnQixDQUFDa0MsSUFBRCxFQUFPO0lBQ25CLElBQUlBLElBQUksQ0FBQ1IsT0FBVCxFQUFrQjtNQUNkLElBQUlRLElBQUksQ0FBQ3RCLE1BQUwsSUFBZXNCLElBQUksQ0FBQ3RCLE1BQUwsQ0FBWWMsT0FBL0IsRUFBd0M7QUFDcEMsUUFBQSxJQUFBLENBQUtjLDhCQUFMLENBQW9DTixJQUFJLENBQUN0QixNQUF6QyxDQUFBLENBQUE7QUFDSCxPQUFBOztBQUVELE1BQUEsTUFBTXlCLFFBQVEsR0FBR0gsSUFBSSxDQUFDSSxTQUF0QixDQUFBOztBQUNBLE1BQUEsS0FBSyxJQUFJckIsQ0FBQyxHQUFHLENBQVIsRUFBV1UsR0FBRyxHQUFHVSxRQUFRLENBQUMzQixNQUEvQixFQUF1Q08sQ0FBQyxHQUFHVSxHQUEzQyxFQUFnRFYsQ0FBQyxFQUFqRCxFQUFxRDtBQUNqRCxRQUFBLElBQUlvQixRQUFRLENBQUNwQixDQUFELENBQVIsWUFBdUJzQixNQUEzQixFQUFtQztBQUMvQixVQUFBLElBQUEsQ0FBS3ZDLGdCQUFMLENBQXNCcUMsUUFBUSxDQUFDcEIsQ0FBRCxDQUE5QixDQUFBLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVEd0IsRUFBQUEsb0JBQW9CLENBQUM3QixNQUFELEVBQVM4QixNQUFULEVBQWlCO0FBQ2pDLElBQUEsTUFBTUMsU0FBUyxHQUFHL0IsTUFBTSxDQUFDTCxJQUFQLENBQVlvQyxTQUE5QixDQUFBOztBQUNBLElBQUEsS0FBSyxNQUFNekIsSUFBWCxJQUFtQnlCLFNBQW5CLEVBQThCO0FBQzFCLE1BQUEsSUFBSUEsU0FBUyxDQUFDQyxjQUFWLENBQXlCMUIsSUFBekIsQ0FBSixFQUFvQztBQUNoQyxRQUFBLE1BQU0yQixRQUFRLEdBQUdGLFNBQVMsQ0FBQ3pCLElBQUQsQ0FBVCxDQUFnQjJCLFFBQWpDLENBQUE7O0FBQ0EsUUFBQSxJQUFJQSxRQUFRLENBQUNILE1BQUQsQ0FBWixFQUFzQjtVQUNsQkcsUUFBUSxDQUFDSCxNQUFELENBQVIsRUFBQSxDQUFBO0FBQ0gsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFFRE4sMEJBQTBCLENBQUN4QixNQUFELEVBQVM7QUFDL0IsSUFBQSxJQUFBLENBQUs2QixvQkFBTCxDQUEwQjdCLE1BQTFCLEVBQWtDdkMsVUFBbEMsQ0FBQSxDQUFBOztBQUNBdUMsSUFBQUEsTUFBTSxDQUFDTCxJQUFQLENBQVl1QyxXQUFaLEdBQTBCLElBQTFCLENBQUE7O0lBSUEsSUFBSWxDLE1BQU0sQ0FBQ2MsT0FBUCxJQUFrQmQsTUFBTSxDQUFDUSxNQUFQLENBQWNNLE9BQXBDLEVBQTZDO01BQ3pDLElBQUtxQixDQUFBQSxzQkFBTCxDQUE0Qm5DLE1BQTVCLENBQUEsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztFQUVEbUMsc0JBQXNCLENBQUNuQyxNQUFELEVBQVM7QUFDM0IsSUFBQSxJQUFBLENBQUs2QixvQkFBTCxDQUEwQjdCLE1BQTFCLEVBQWtDakMsU0FBbEMsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7RUFFRHFELHVCQUF1QixDQUFDcEIsTUFBRCxFQUFTO0FBQzVCLElBQUEsSUFBQSxDQUFLNkIsb0JBQUwsQ0FBMEI3QixNQUExQixFQUFrQ2hDLFVBQWxDLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRURxRCx1QkFBdUIsQ0FBQ3JCLE1BQUQsRUFBUztBQUM1QixJQUFBLE1BQU0rQixTQUFTLEdBQUcvQixNQUFNLENBQUNMLElBQVAsQ0FBWW9DLFNBQTlCLENBQUE7O0FBQ0EsSUFBQSxLQUFLLE1BQU16QixJQUFYLElBQW1CeUIsU0FBbkIsRUFBOEI7QUFDMUIsTUFBQSxJQUFJQSxTQUFTLENBQUNDLGNBQVYsQ0FBeUIxQixJQUF6QixDQUFKLEVBQW9DO0FBQ2hDLFFBQUEsTUFBTTJCLFFBQVEsR0FBR0YsU0FBUyxDQUFDekIsSUFBRCxDQUFULENBQWdCMkIsUUFBakMsQ0FBQTs7UUFDQSxJQUFJQSxRQUFRLENBQUNHLE9BQWIsRUFBc0I7QUFDbEJILFVBQUFBLFFBQVEsQ0FBQ0csT0FBVCxFQUFBLENBQUE7QUFDSCxTQUFBOztRQUVELElBQUlILFFBQVEsQ0FBQ0ksTUFBYixFQUFxQjtVQUNqQixNQUFNQyxLQUFLLEdBQUcsSUFBSzFELENBQUFBLG1CQUFMLENBQXlCMkQsT0FBekIsQ0FBaUNOLFFBQWpDLENBQWQsQ0FBQTs7VUFDQSxJQUFJSyxLQUFLLElBQUksQ0FBYixFQUFnQjtBQUNaLFlBQUEsSUFBQSxDQUFLMUQsbUJBQUwsQ0FBeUI0RCxNQUF6QixDQUFnQ0YsS0FBaEMsRUFBdUMsQ0FBdkMsQ0FBQSxDQUFBO0FBQ0gsV0FBQTtBQUNKLFNBQUE7O1FBRUQsSUFBSUwsUUFBUSxDQUFDUSxXQUFiLEVBQTBCO1VBQ3RCLE1BQU1ILEtBQUssR0FBRyxJQUFLekQsQ0FBQUEsd0JBQUwsQ0FBOEIwRCxPQUE5QixDQUFzQ04sUUFBdEMsQ0FBZCxDQUFBOztVQUNBLElBQUlLLEtBQUssSUFBSSxDQUFiLEVBQWdCO0FBQ1osWUFBQSxJQUFBLENBQUt6RCx3QkFBTCxDQUE4QjJELE1BQTlCLENBQXFDRixLQUFyQyxFQUE0QyxDQUE1QyxDQUFBLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTs7UUFFRCxJQUFJTCxRQUFRLENBQUNTLFVBQWIsRUFBeUI7VUFDckIsTUFBTUosS0FBSyxHQUFHLElBQUt4RCxDQUFBQSx1QkFBTCxDQUE2QnlELE9BQTdCLENBQXFDTixRQUFyQyxDQUFkLENBQUE7O1VBQ0EsSUFBSUssS0FBSyxJQUFJLENBQWIsRUFBZ0I7QUFDWixZQUFBLElBQUEsQ0FBS3hELHVCQUFMLENBQTZCMEQsTUFBN0IsQ0FBb0NGLEtBQXBDLEVBQTJDLENBQTNDLENBQUEsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBOztRQUVELElBQUlMLFFBQVEsQ0FBQ1UsV0FBYixFQUEwQjtVQUN0QixNQUFNTCxLQUFLLEdBQUcsSUFBS3ZELENBQUFBLHdCQUFMLENBQThCd0QsT0FBOUIsQ0FBc0NOLFFBQXRDLENBQWQsQ0FBQTs7VUFDQSxJQUFJSyxLQUFLLElBQUksQ0FBYixFQUFnQjtBQUNaLFlBQUEsSUFBQSxDQUFLdkQsd0JBQUwsQ0FBOEJ5RCxNQUE5QixDQUFxQ0YsS0FBckMsRUFBNEMsQ0FBNUMsQ0FBQSxDQUFBO0FBQ0gsV0FBQTtBQUNKLFNBQUE7O0FBRUQsUUFBQSxJQUFJdEMsTUFBTSxDQUFDK0IsU0FBUCxDQUFpQnpCLElBQWpCLENBQUEsQ0FBdUIyQixRQUF2QixLQUFvQ2pDLE1BQU0sQ0FBQ00sSUFBRCxDQUE5QyxFQUFzRDtVQUNsRCxPQUFPTixNQUFNLENBQUNNLElBQUQsQ0FBYixDQUFBO0FBQ0gsU0FBQTs7QUFDRCxRQUFBLE9BQU9OLE1BQU0sQ0FBQytCLFNBQVAsQ0FBaUJ6QixJQUFqQixDQUFQLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0VBRURzQiw4QkFBOEIsQ0FBQzVCLE1BQUQsRUFBUztBQUNuQyxJQUFBLElBQUEsQ0FBSzZCLG9CQUFMLENBQTBCN0IsTUFBMUIsRUFBa0N0QyxlQUFsQyxDQUFBLENBQUE7O0FBQ0FzQyxJQUFBQSxNQUFNLENBQUNMLElBQVAsQ0FBWWlELGVBQVosR0FBOEIsSUFBOUIsQ0FBQTtBQUNILEdBQUE7O0FBRURDLEVBQUFBLGdCQUFnQixDQUFDZixNQUFELEVBQVNnQixVQUFULEVBQXFCQyxFQUFyQixFQUF5QjtBQUNyQyxJQUFBLEtBQUssSUFBSTFDLENBQUMsR0FBRyxDQUFSLEVBQVdVLEdBQUcsR0FBRytCLFVBQVUsQ0FBQ2hELE1BQWpDLEVBQXlDTyxDQUFDLEdBQUdVLEdBQTdDLEVBQWtEVixDQUFDLEVBQW5ELEVBQXVEO0FBQ25ELE1BQUEsTUFBTTJDLElBQUksR0FBR0YsVUFBVSxDQUFDekMsQ0FBRCxDQUF2QixDQUFBOztBQUNBLE1BQUEsSUFBSTJDLElBQUksSUFBSUEsSUFBSSxDQUFDeEMsTUFBYixJQUF1QndDLElBQUksQ0FBQ3hDLE1BQUwsQ0FBWU0sT0FBbkMsSUFBOENrQyxJQUFJLENBQUN4QyxNQUFMLENBQVlSLE1BQVosQ0FBbUJjLE9BQXJFLEVBQThFO0FBQzFFa0MsUUFBQUEsSUFBSSxDQUFDbEIsTUFBRCxDQUFKLENBQWFpQixFQUFiLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFFRDFELFFBQVEsQ0FBQzBELEVBQUQsRUFBSztBQUNULElBQUEsSUFBQSxDQUFLRixnQkFBTCxDQUFzQmxGLE1BQXRCLEVBQThCLElBQUtpQixDQUFBQSxtQkFBbkMsRUFBd0RtRSxFQUF4RCxDQUFBLENBQUE7QUFDSCxHQUFBOztFQUVEekQsYUFBYSxDQUFDeUQsRUFBRCxFQUFLO0FBQ2QsSUFBQSxJQUFBLENBQUtGLGdCQUFMLENBQXNCaEYsWUFBdEIsRUFBb0MsSUFBS2dCLENBQUFBLHdCQUF6QyxFQUFtRWtFLEVBQW5FLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRUR4RCxZQUFZLENBQUN3RCxFQUFELEVBQUs7QUFDYixJQUFBLElBQUEsQ0FBS0YsZ0JBQUwsQ0FBc0JqRixXQUF0QixFQUFtQyxJQUFLa0IsQ0FBQUEsdUJBQXhDLEVBQWlFaUUsRUFBakUsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7RUFFRHZELGFBQWEsQ0FBQ3VELEVBQUQsRUFBSztBQUNkLElBQUEsSUFBQSxDQUFLRixnQkFBTCxDQUFzQi9FLFlBQXRCLEVBQW9DLElBQUtpQixDQUFBQSx3QkFBekMsRUFBbUVnRSxFQUFuRSxDQUFBLENBQUE7QUFDSCxHQUFBOztBQUVERSxFQUFBQSxTQUFTLENBQUMzQyxJQUFELEVBQU80QyxZQUFQLEVBQXFCO0lBQzFCQyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsa0tBQWpCLENBQUEsQ0FBQTtBQUVBLElBQUEsTUFBTUMsSUFBSSxHQUFHbkQsS0FBSyxDQUFDb0QsU0FBTixDQUFnQkMsS0FBaEIsQ0FBc0JDLElBQXRCLENBQTJCQyxTQUEzQixFQUFzQyxDQUF0QyxDQUFiLENBQUE7SUFFQSxNQUFNQyxTQUFTLEdBQUcsSUFBQSxDQUFLL0MsS0FBdkIsQ0FBQTs7QUFFQSxJQUFBLEtBQUssTUFBTXRDLEVBQVgsSUFBaUJxRixTQUFqQixFQUE0QjtBQUN4QixNQUFBLElBQUlBLFNBQVMsQ0FBQzFCLGNBQVYsQ0FBeUIzRCxFQUF6QixDQUFKLEVBQWtDO0FBQzlCLFFBQUEsTUFBTXNCLElBQUksR0FBRytELFNBQVMsQ0FBQ3JGLEVBQUQsQ0FBVCxDQUFjc0IsSUFBM0IsQ0FBQTs7QUFDQSxRQUFBLElBQUlBLElBQUksQ0FBQ29DLFNBQUwsQ0FBZXpCLElBQWYsQ0FBSixFQUEwQjtVQUN0QixNQUFNcUQsRUFBRSxHQUFHaEUsSUFBSSxDQUFDb0MsU0FBTCxDQUFlekIsSUFBZixDQUFxQjJCLENBQUFBLFFBQXJCLENBQThCaUIsWUFBOUIsQ0FBWCxDQUFBOztBQUNBLFVBQUEsSUFBSVMsRUFBSixFQUFRO1lBQ0pBLEVBQUUsQ0FBQ0MsS0FBSCxDQUFTakUsSUFBSSxDQUFDb0MsU0FBTCxDQUFlekIsSUFBZixDQUFBLENBQXFCMkIsUUFBOUIsRUFBd0NvQixJQUF4QyxDQUFBLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFFRFEsb0JBQW9CLENBQUNyRCxNQUFELEVBQVNzRCxHQUFULEVBQWN4RCxJQUFkLEVBQW9CMkIsUUFBcEIsRUFBOEI7SUFDOUMsSUFBSXpCLE1BQU0sQ0FBQ1IsTUFBWCxFQUFtQjtBQUNmUSxNQUFBQSxNQUFNLENBQUNSLE1BQVAsQ0FBY0wsSUFBZCxDQUFtQm9FLFVBQW5CLEdBQWdDdkQsTUFBTSxDQUFDUixNQUFQLENBQWNMLElBQWQsQ0FBbUJvRSxVQUFuQixJQUFpQyxFQUFqRSxDQUFBOztNQUNBLElBQUl2RCxNQUFNLENBQUNSLE1BQVAsQ0FBY0wsSUFBZCxDQUFtQm9FLFVBQW5CLENBQThCekQsSUFBOUIsQ0FBSixFQUF5QztRQUNyQyxNQUFNMEQsS0FBSyxDQUFFLENBQUEsdUJBQUEsRUFBeUIxRCxJQUFLLENBQUEsaUJBQUEsRUFBbUJ3RCxHQUFJLENBQVN0RCxPQUFBQSxFQUFBQSxNQUFNLENBQUNSLE1BQVAsQ0FBY0wsSUFBZCxDQUFtQm9FLFVBQW5CLENBQThCekQsSUFBOUIsQ0FBQSxDQUFvQ3dELEdBQUksQ0FBQSxHQUFBLEVBQUt0RCxNQUFNLENBQUNJLE9BQVAsRUFBaUIsQ0FBQSxDQUFBLENBQTlILENBQVgsQ0FBQTtBQUNILE9BQUE7O01BQ0RKLE1BQU0sQ0FBQ1IsTUFBUCxDQUFjTCxJQUFkLENBQW1Cb0UsVUFBbkIsQ0FBOEJ6RCxJQUE5QixDQUFzQyxHQUFBO0FBQ2xDd0QsUUFBQUEsR0FBRyxFQUFFQSxHQUQ2QjtBQUVsQ3hELFFBQUFBLElBQUksRUFBRUEsSUFGNEI7QUFHbEMyQixRQUFBQSxRQUFRLEVBQUVBLFFBQUFBO09BSGQsQ0FBQTtBQUtILEtBQUE7QUFDSixHQUFBOztFQUVEVixrQkFBa0IsQ0FBQ2YsTUFBRCxFQUFTO0lBQ3ZCLElBQUlBLE1BQU0sQ0FBQ1IsTUFBWCxFQUFtQjtBQUNmLE1BQUEsSUFBSVEsTUFBTSxDQUFDUixNQUFQLENBQWNMLElBQWQsQ0FBbUJvRSxVQUF2QixFQUFtQztRQUMvQnZELE1BQU0sQ0FBQ1IsTUFBUCxDQUFjK0IsU0FBZCxHQUEwQnZCLE1BQU0sQ0FBQ1IsTUFBUCxDQUFjTCxJQUFkLENBQW1Cb0UsVUFBN0MsQ0FBQTs7UUFFQSxLQUFLLE1BQU1FLFlBQVgsSUFBMkJ6RCxNQUFNLENBQUNSLE1BQVAsQ0FBYytCLFNBQXpDLEVBQW9EO1VBQ2hELE1BQU1tQyxhQUFhLEdBQUcxRCxNQUFNLENBQUNSLE1BQVAsQ0FBYytCLFNBQWQsQ0FBd0JrQyxZQUF4QixDQUF0QixDQUFBO0FBQ0EsVUFBQSxNQUFNaEMsUUFBUSxHQUFHaUMsYUFBYSxDQUFDakMsUUFBL0IsQ0FBQTtVQUVBa0MsTUFBTSxDQUFDQyxNQUFQLENBQWNuQyxRQUFkLENBQUEsQ0FBQTs7VUFFQSxJQUFJQSxRQUFRLENBQUNJLE1BQWIsRUFBcUI7QUFDakIsWUFBQSxJQUFBLENBQUt6RCxtQkFBTCxDQUF5Qm9DLElBQXpCLENBQThCaUIsUUFBOUIsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7VUFFRCxJQUFJQSxRQUFRLENBQUNRLFdBQWIsRUFBMEI7QUFDdEIsWUFBQSxJQUFBLENBQUs1RCx3QkFBTCxDQUE4Qm1DLElBQTlCLENBQW1DaUIsUUFBbkMsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7VUFFRCxJQUFJQSxRQUFRLENBQUNTLFVBQWIsRUFBeUI7QUFDckIsWUFBQSxJQUFBLENBQUs1RCx1QkFBTCxDQUE2QmtDLElBQTdCLENBQWtDaUIsUUFBbEMsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7VUFFRCxJQUFJQSxRQUFRLENBQUNVLFdBQWIsRUFBMEI7QUFDdEIsWUFBQSxJQUFBLENBQUs1RCx3QkFBTCxDQUE4QmlDLElBQTlCLENBQW1DaUIsUUFBbkMsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7QUFFRCxVQUFBLElBQUl6QixNQUFNLENBQUNSLE1BQVAsQ0FBY0gsT0FBbEIsRUFBMkI7QUFDdkIsWUFBQSxJQUFBLENBQUt3RSxnQkFBTCxDQUFzQjdELE1BQXRCLEVBQThCMEQsYUFBOUIsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7QUFHRCxVQUFBLElBQUkxRCxNQUFNLENBQUNSLE1BQVAsQ0FBY2lFLFlBQWQsQ0FBSixFQUFpQztBQUM3QixZQUFBLE1BQU1ELEtBQUssQ0FBRSxDQUFvQkMsa0JBQUFBLEVBQUFBLFlBQWEsMkNBQW5DLENBQVgsQ0FBQTtBQUNILFdBRkQsTUFFTztBQUNIekQsWUFBQUEsTUFBTSxDQUFDUixNQUFQLENBQWNpRSxZQUFkLElBQThCaEMsUUFBOUIsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBOztBQUdELFFBQUEsT0FBT3pCLE1BQU0sQ0FBQ1IsTUFBUCxDQUFjTCxJQUFkLENBQW1Cb0UsVUFBMUIsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsTUFBTXRDLFFBQVEsR0FBR2pCLE1BQU0sQ0FBQ2tCLFNBQXhCLENBQUE7O0FBQ0EsSUFBQSxLQUFLLElBQUlyQixDQUFDLEdBQUcsQ0FBUixFQUFXVSxHQUFHLEdBQUdVLFFBQVEsQ0FBQzNCLE1BQS9CLEVBQXVDTyxDQUFDLEdBQUdVLEdBQTNDLEVBQWdEVixDQUFDLEVBQWpELEVBQXFEO0FBQ2pELE1BQUEsSUFBSW9CLFFBQVEsQ0FBQ3BCLENBQUQsQ0FBUixZQUF1QnNCLE1BQTNCLEVBQW1DO0FBQy9CLFFBQUEsSUFBQSxDQUFLSixrQkFBTCxDQUF3QkUsUUFBUSxDQUFDcEIsQ0FBRCxDQUFoQyxDQUFBLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0VBRURhLGdCQUFnQixDQUFDakIsVUFBRCxFQUFhO0lBQ3pCLE1BQU1xRSxNQUFNLEdBQUcsRUFBZixDQUFBOztBQUVBLElBQUEsS0FBSyxNQUFNQyxHQUFYLElBQWtCdEUsVUFBbEIsRUFBOEI7QUFDMUIsTUFBQSxJQUFJLENBQUNBLFVBQVUsQ0FBQytCLGNBQVgsQ0FBMEJ1QyxHQUExQixDQUFMLEVBQ0ksU0FBQTs7TUFFSixJQUFJdEUsVUFBVSxDQUFDc0UsR0FBRCxDQUFWLENBQWdCQyxJQUFoQixLQUF5QixRQUE3QixFQUF1QztBQUNuQ0YsUUFBQUEsTUFBTSxDQUFDQyxHQUFELENBQU4sR0FBY3RELE1BQU0sQ0FBQyxFQUFELEVBQUtoQixVQUFVLENBQUNzRSxHQUFELENBQWYsQ0FBcEIsQ0FBQTtBQUNILE9BRkQsTUFFTztBQUVILFFBQUEsTUFBTUUsR0FBRyxHQUFHeEUsVUFBVSxDQUFDc0UsR0FBRCxDQUFWLENBQWdCRyxLQUE1QixDQUFBO0FBQ0EsUUFBQSxPQUFPekUsVUFBVSxDQUFDc0UsR0FBRCxDQUFWLENBQWdCRyxLQUF2QixDQUFBO0FBRUFKLFFBQUFBLE1BQU0sQ0FBQ0MsR0FBRCxDQUFOLEdBQWN0RCxNQUFNLENBQUMsRUFBRCxFQUFLaEIsVUFBVSxDQUFDc0UsR0FBRCxDQUFmLENBQXBCLENBQUE7QUFDQUQsUUFBQUEsTUFBTSxDQUFDQyxHQUFELENBQU4sQ0FBWUcsS0FBWixHQUFvQkQsR0FBcEIsQ0FBQTtBQUVBeEUsUUFBQUEsVUFBVSxDQUFDc0UsR0FBRCxDQUFWLENBQWdCRyxLQUFoQixHQUF3QkQsR0FBeEIsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsT0FBT0gsTUFBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFREQsRUFBQUEsZ0JBQWdCLENBQUM3RCxNQUFELEVBQVN5QixRQUFULEVBQW1CO0lBQy9CLE1BQU1sQixHQUFHLEdBQUdQLE1BQU0sQ0FBQ1IsTUFBUCxDQUFjSCxPQUFkLENBQXNCQyxNQUFsQyxDQUFBO0FBQ0EsSUFBQSxNQUFNZ0UsR0FBRyxHQUFHN0IsUUFBUSxDQUFDNkIsR0FBckIsQ0FBQTs7SUFFQSxLQUFLLElBQUl6RCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHVSxHQUFwQixFQUF5QlYsQ0FBQyxFQUExQixFQUE4QjtNQUMxQixNQUFNTCxNQUFNLEdBQUdRLE1BQU0sQ0FBQ1IsTUFBUCxDQUFjSCxPQUFkLENBQXNCUSxDQUF0QixDQUFmLENBQUE7O0FBQ0EsTUFBQSxJQUFJTCxNQUFNLENBQUM4RCxHQUFQLEtBQWVBLEdBQW5CLEVBQXdCO0FBQ3BCLFFBQUEsTUFBTTdELFVBQVUsR0FBR0QsTUFBTSxDQUFDQyxVQUExQixDQUFBOztBQUNBLFFBQUEsSUFBSUQsTUFBTSxDQUFDTSxJQUFQLElBQWVMLFVBQW5CLEVBQStCO0FBQzNCLFVBQUEsS0FBSyxNQUFNc0UsR0FBWCxJQUFrQnRFLFVBQWxCLEVBQThCO0FBQzFCLFlBQUEsSUFBSUEsVUFBVSxDQUFDK0IsY0FBWCxDQUEwQnVDLEdBQTFCLENBQUosRUFBb0M7QUFDaEMsY0FBQSxJQUFBLENBQUtJLGVBQUwsQ0FBcUIxRSxVQUFVLENBQUNzRSxHQUFELENBQS9CLEVBQXNDdEMsUUFBdEMsQ0FBQSxDQUFBO0FBQ0gsYUFBQTtBQUNKLFdBQUE7O0FBRUR6QixVQUFBQSxNQUFNLENBQUNSLE1BQVAsQ0FBY0wsSUFBZCxDQUFtQk0sVUFBbkIsQ0FBOEJELE1BQU0sQ0FBQ00sSUFBckMsQ0FBNkMsR0FBQSxJQUFBLENBQUtZLGdCQUFMLENBQXNCakIsVUFBdEIsQ0FBN0MsQ0FBQTtBQUNILFNBQUE7O0FBQ0QsUUFBQSxNQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVEMEUsRUFBQUEsZUFBZSxDQUFDQyxTQUFELEVBQVkzQyxRQUFaLEVBQXNCO0lBQ2pDLE1BQU00QyxJQUFJLEdBQUcsSUFBYixDQUFBO0FBS0FELElBQUFBLFNBQVMsR0FBRztNQUNSdEUsSUFBSSxFQUFFc0UsU0FBUyxDQUFDdEUsSUFEUjtNQUVSb0UsS0FBSyxFQUFFRSxTQUFTLENBQUNGLEtBRlQ7TUFHUkYsSUFBSSxFQUFFSSxTQUFTLENBQUNKLElBQUFBO0tBSHBCLENBQUE7O0lBTUEsSUFBS00sQ0FBQUEsc0JBQUwsQ0FBNEJGLFNBQTVCLENBQUEsQ0FBQTs7SUFFQUcsTUFBTSxDQUFDQyxjQUFQLENBQXNCL0MsUUFBUSxDQUFDQSxRQUEvQixFQUF5QzJDLFNBQVMsQ0FBQ3RFLElBQW5ELEVBQXlEO0FBQ3JEMkUsTUFBQUEsR0FBRyxFQUFFLFlBQVk7UUFDYixPQUFPTCxTQUFTLENBQUNGLEtBQWpCLENBQUE7T0FGaUQ7TUFJckRRLEdBQUcsRUFBRSxVQUFVUixLQUFWLEVBQWlCO0FBQ2xCLFFBQUEsTUFBTVMsUUFBUSxHQUFHUCxTQUFTLENBQUNGLEtBQTNCLENBQUE7UUFDQUUsU0FBUyxDQUFDRixLQUFWLEdBQWtCQSxLQUFsQixDQUFBOztRQUNBRyxJQUFJLENBQUNDLHNCQUFMLENBQTRCRixTQUE1QixDQUFBLENBQUE7O0FBQ0EzQyxRQUFBQSxRQUFRLENBQUNBLFFBQVQsQ0FBa0JtRCxJQUFsQixDQUF1QixLQUF2QixFQUE4QlIsU0FBUyxDQUFDdEUsSUFBeEMsRUFBOEM2RSxRQUE5QyxFQUF3RFAsU0FBUyxDQUFDRixLQUFsRSxDQUFBLENBQUE7T0FSaUQ7QUFVckRXLE1BQUFBLFlBQVksRUFBRSxJQUFBO0tBVmxCLENBQUEsQ0FBQTtBQVlILEdBQUE7O0FBRURDLEVBQUFBLGdCQUFnQixDQUFDOUUsTUFBRCxFQUFTeUIsUUFBVCxFQUFtQjtJQUMvQixNQUFNbEIsR0FBRyxHQUFHUCxNQUFNLENBQUNSLE1BQVAsQ0FBY0gsT0FBZCxDQUFzQkMsTUFBbEMsQ0FBQTtBQUNBLElBQUEsTUFBTWdFLEdBQUcsR0FBRzdCLFFBQVEsQ0FBQzZCLEdBQXJCLENBQUE7O0lBRUEsS0FBSyxJQUFJekQsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1UsR0FBcEIsRUFBeUJWLENBQUMsRUFBMUIsRUFBOEI7QUFDMUIsTUFBQSxNQUFNa0YsZUFBZSxHQUFHL0UsTUFBTSxDQUFDUixNQUEvQixDQUFBO0FBQ0EsTUFBQSxNQUFNQSxNQUFNLEdBQUd1RixlQUFlLENBQUMxRixPQUFoQixDQUF3QlEsQ0FBeEIsQ0FBZixDQUFBOztBQUNBLE1BQUEsSUFBSUwsTUFBTSxDQUFDOEQsR0FBUCxLQUFlQSxHQUFuQixFQUF3QjtBQUNwQixRQUFBLE1BQU14RCxJQUFJLEdBQUdOLE1BQU0sQ0FBQ00sSUFBcEIsQ0FBQTtBQUNBLFFBQUEsTUFBTUwsVUFBVSxHQUFHRCxNQUFNLENBQUNDLFVBQTFCLENBQUE7O0FBQ0EsUUFBQSxJQUFJSyxJQUFKLEVBQVU7QUFDTixVQUFBLElBQUlMLFVBQUosRUFBZ0I7QUFFWixZQUFBLEtBQUssTUFBTXNFLEdBQVgsSUFBa0J0RSxVQUFsQixFQUE4QjtBQUMxQixjQUFBLElBQUlBLFVBQVUsQ0FBQytCLGNBQVgsQ0FBMEJ1QyxHQUExQixDQUFKLEVBQW9DO0FBQ2hDLGdCQUFBLElBQUEsQ0FBS0ksZUFBTCxDQUFxQjFFLFVBQVUsQ0FBQ3NFLEdBQUQsQ0FBL0IsRUFBc0N0QyxRQUF0QyxDQUFBLENBQUE7QUFDSCxlQUFBO0FBQ0osYUFBQTtBQUNKLFdBQUE7O1VBSUQsTUFBTXVELGtCQUFrQixHQUFHRCxlQUFlLENBQUM1RixJQUFoQixDQUFxQk0sVUFBckIsQ0FBZ0NLLElBQWhDLENBQTNCLENBQUE7O0FBQ0EsVUFBQSxJQUFJa0Ysa0JBQUosRUFBd0I7QUFDcEIsWUFBQSxLQUFLLE1BQU1qQixHQUFYLElBQWtCaUIsa0JBQWxCLEVBQXNDO0FBQ2xDLGNBQUEsTUFBTUMsWUFBWSxHQUFHRCxrQkFBa0IsQ0FBQ2pCLEdBQUQsQ0FBdkMsQ0FBQTs7QUFDQSxjQUFBLElBQUksRUFBRUEsR0FBRyxJQUFJdEUsVUFBVCxDQUFKLEVBQTBCO0FBQ3RCLGdCQUFBLE9BQU9nQyxRQUFRLENBQUNBLFFBQVQsQ0FBa0J3RCxZQUFZLENBQUNuRixJQUEvQixDQUFQLENBQUE7QUFDSCxlQUZELE1BRU87Z0JBQ0gsSUFBSUwsVUFBVSxDQUFDc0UsR0FBRCxDQUFWLENBQWdCRyxLQUFoQixLQUEwQmUsWUFBWSxDQUFDZixLQUEzQyxFQUFrRDtBQUM5QyxrQkFBQSxJQUFJekMsUUFBUSxDQUFDQSxRQUFULENBQWtCeUQsa0JBQXRCLEVBQTBDO0FBQ3RDekQsb0JBQUFBLFFBQVEsQ0FBQ0EsUUFBVCxDQUFrQnlELGtCQUFsQixDQUFxQ0QsWUFBWSxDQUFDbkYsSUFBbEQsRUFBd0RtRixZQUFZLENBQUNmLEtBQXJFLEVBQTRFekUsVUFBVSxDQUFDc0UsR0FBRCxDQUFWLENBQWdCRyxLQUE1RixDQUFBLENBQUE7QUFDSCxtQkFBQTtBQUNKLGlCQUFBO0FBQ0osZUFBQTtBQUNKLGFBQUE7QUFDSixXQUFBOztBQUVELFVBQUEsSUFBSXpFLFVBQUosRUFBZ0I7WUFDWnNGLGVBQWUsQ0FBQzVGLElBQWhCLENBQXFCTSxVQUFyQixDQUFnQ0ssSUFBaEMsQ0FBQSxHQUF3QyxJQUFLWSxDQUFBQSxnQkFBTCxDQUFzQmpCLFVBQXRCLENBQXhDLENBQUE7QUFDSCxXQUZELE1BRU87QUFDSCxZQUFBLE9BQU9zRixlQUFlLENBQUM1RixJQUFoQixDQUFxQk0sVUFBckIsQ0FBZ0NLLElBQWhDLENBQVAsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBOztBQUVELFFBQUEsTUFBQTtBQUNILE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFFRHdFLHNCQUFzQixDQUFDRixTQUFELEVBQVk7SUFDOUIsSUFBSUEsU0FBUyxDQUFDSixJQUFWLEtBQW1CLEtBQW5CLElBQTRCSSxTQUFTLENBQUNKLElBQVYsS0FBbUIsTUFBbkQsRUFBMkQ7TUFDdkQsSUFBSXRFLEtBQUssQ0FBQ0MsT0FBTixDQUFjeUUsU0FBUyxDQUFDRixLQUF4QixDQUFKLEVBQW9DO0FBQ2hDRSxRQUFBQSxTQUFTLENBQUNGLEtBQVYsR0FBa0JFLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQjVFLE1BQWhCLEtBQTJCLENBQTNCLEdBQ2QsSUFBSTZGLEtBQUosQ0FBVWYsU0FBUyxDQUFDRixLQUFWLENBQWdCLENBQWhCLENBQVYsRUFBOEJFLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUE5QixFQUFrREUsU0FBUyxDQUFDRixLQUFWLENBQWdCLENBQWhCLENBQWxELENBRGMsR0FFZCxJQUFJaUIsS0FBSixDQUFVZixTQUFTLENBQUNGLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBVixFQUE4QkUsU0FBUyxDQUFDRixLQUFWLENBQWdCLENBQWhCLENBQTlCLEVBQWtERSxTQUFTLENBQUNGLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBbEQsRUFBc0VFLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUF0RSxDQUZKLENBQUE7QUFHSCxPQUFBO0FBQ0osS0FORCxNQU1PLElBQUlFLFNBQVMsQ0FBQ0osSUFBVixLQUFtQixNQUF2QixFQUErQjtBQUNsQyxNQUFBLElBQUl0RSxLQUFLLENBQUNDLE9BQU4sQ0FBY3lFLFNBQVMsQ0FBQ0YsS0FBeEIsQ0FBSixFQUNJRSxTQUFTLENBQUNGLEtBQVYsR0FBa0IsSUFBSWtCLElBQUosQ0FBU2hCLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUFULEVBQTZCRSxTQUFTLENBQUNGLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBN0IsQ0FBbEIsQ0FBQTtBQUVQLEtBSk0sTUFJQSxJQUFJRSxTQUFTLENBQUNKLElBQVYsS0FBbUIsTUFBbkIsSUFBNkJJLFNBQVMsQ0FBQ0osSUFBVixLQUFtQixRQUFwRCxFQUE4RDtBQUNqRSxNQUFBLElBQUl0RSxLQUFLLENBQUNDLE9BQU4sQ0FBY3lFLFNBQVMsQ0FBQ0YsS0FBeEIsQ0FBSixFQUNJRSxTQUFTLENBQUNGLEtBQVYsR0FBa0IsSUFBSW1CLElBQUosQ0FBU2pCLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUFULEVBQTZCRSxTQUFTLENBQUNGLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBN0IsRUFBaURFLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUFqRCxDQUFsQixDQUFBO0FBRVAsS0FKTSxNQUlBLElBQUlFLFNBQVMsQ0FBQ0osSUFBVixLQUFtQixNQUF2QixFQUErQjtBQUNsQyxNQUFBLElBQUl0RSxLQUFLLENBQUNDLE9BQU4sQ0FBY3lFLFNBQVMsQ0FBQ0YsS0FBeEIsQ0FBSixFQUNJRSxTQUFTLENBQUNGLEtBQVYsR0FBa0IsSUFBSW9CLElBQUosQ0FBU2xCLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUFULEVBQTZCRSxTQUFTLENBQUNGLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBN0IsRUFBaURFLFNBQVMsQ0FBQ0YsS0FBVixDQUFnQixDQUFoQixDQUFqRCxFQUFxRUUsU0FBUyxDQUFDRixLQUFWLENBQWdCLENBQWhCLENBQXJFLENBQWxCLENBQUE7QUFFUCxLQUpNLE1BSUEsSUFBSUUsU0FBUyxDQUFDSixJQUFWLEtBQW1CLFFBQXZCLEVBQWlDO01BQ3BDLElBQUlJLFNBQVMsQ0FBQ0YsS0FBVixLQUFvQixJQUFwQixJQUE0QixPQUFPRSxTQUFTLENBQUNGLEtBQWpCLEtBQTJCLFFBQTNELEVBQ0lFLFNBQVMsQ0FBQ0YsS0FBVixHQUFrQixJQUFLdEcsQ0FBQUEsR0FBTCxDQUFTa0QsSUFBVCxDQUFjeUUsVUFBZCxDQUF5Qm5CLFNBQVMsQ0FBQ0YsS0FBbkMsQ0FBbEIsQ0FBQTtBQUVQLEtBSk0sTUFJQSxJQUFJRSxTQUFTLENBQUNKLElBQVYsS0FBbUIsT0FBbkIsSUFBOEJJLFNBQVMsQ0FBQ0osSUFBVixLQUFtQixZQUFyRCxFQUFtRTtBQUN0RSxNQUFBLE1BQU13QixTQUFTLEdBQUdwQixTQUFTLENBQUNGLEtBQVYsQ0FBZ0J1QixJQUFoQixDQUFxQixDQUFyQixDQUFtQy9GLFlBQUFBLEtBQW5DLEdBQTJDZ0csUUFBM0MsR0FBc0RDLEtBQXhFLENBQUE7TUFDQXZCLFNBQVMsQ0FBQ0YsS0FBVixHQUFrQixJQUFJc0IsU0FBSixDQUFjcEIsU0FBUyxDQUFDRixLQUFWLENBQWdCdUIsSUFBOUIsQ0FBbEIsQ0FBQTtNQUdBckIsU0FBUyxDQUFDRixLQUFWLENBQWdCRixJQUFoQixHQUF1QkksU0FBUyxDQUFDRixLQUFWLENBQWdCRixJQUF2QyxDQUFBO0FBRUgsS0FBQTtBQUNKLEdBQUE7O0FBRURwQyxFQUFBQSxPQUFPLEdBQUc7QUFDTixJQUFBLEtBQUEsQ0FBTUEsT0FBTixFQUFBLENBQUE7SUFFQSxJQUFLaEUsQ0FBQUEsR0FBTCxDQUFTYyxPQUFULENBQWlCa0gsR0FBakIsQ0FBcUIzSSxVQUFyQixFQUFpQyxJQUFBLENBQUswQixZQUF0QyxFQUFvRCxJQUFwRCxDQUFBLENBQUE7SUFDQSxJQUFLZixDQUFBQSxHQUFMLENBQVNjLE9BQVQsQ0FBaUJrSCxHQUFqQixDQUFxQjFJLGVBQXJCLEVBQXNDLElBQUEsQ0FBSzBCLGdCQUEzQyxFQUE2RCxJQUE3RCxDQUFBLENBQUE7SUFDQSxJQUFLaEIsQ0FBQUEsR0FBTCxDQUFTYyxPQUFULENBQWlCa0gsR0FBakIsQ0FBcUJ6SSxNQUFyQixFQUE2QixJQUFBLENBQUswQixRQUFsQyxFQUE0QyxJQUE1QyxDQUFBLENBQUE7SUFDQSxJQUFLakIsQ0FBQUEsR0FBTCxDQUFTYyxPQUFULENBQWlCa0gsR0FBakIsQ0FBcUJ2SSxZQUFyQixFQUFtQyxJQUFBLENBQUt5QixhQUF4QyxFQUF1RCxJQUF2RCxDQUFBLENBQUE7SUFDQSxJQUFLbEIsQ0FBQUEsR0FBTCxDQUFTYyxPQUFULENBQWlCa0gsR0FBakIsQ0FBcUJ4SSxXQUFyQixFQUFrQyxJQUFBLENBQUsyQixZQUF2QyxFQUFxRCxJQUFyRCxDQUFBLENBQUE7SUFDQSxJQUFLbkIsQ0FBQUEsR0FBTCxDQUFTYyxPQUFULENBQWlCa0gsR0FBakIsQ0FBcUJ0SSxZQUFyQixFQUFtQyxJQUFBLENBQUswQixhQUF4QyxFQUF1RCxJQUF2RCxDQUFBLENBQUE7QUFDSCxHQUFBOztBQS9kcUQsQ0FBQTs7QUFrZTFENkcsU0FBUyxDQUFDQyxlQUFWLENBQTBCL0gscUJBQXFCLENBQUMrRSxTQUFoRCxFQUEyRDlGLE9BQTNELENBQUE7Ozs7In0=
