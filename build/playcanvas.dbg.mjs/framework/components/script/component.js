/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { ScriptAttributes } from '../../../script/script-attributes.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';
import '../../../script/script-type.js';
import { Debug } from '../../../core/debug.js';

class ScriptComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._scripts = [];
    this._updateList = new SortedLoopArray({
      sortBy: '__executionOrder'
    });
    this._postUpdateList = new SortedLoopArray({
      sortBy: '__executionOrder'
    });
    this._scriptsIndex = {};
    this._destroyedScripts = [];
    this._destroyed = false;
    this._scriptsData = null;
    this._oldState = true;
    this._enabled = true;
    this._beingEnabled = false;
    this._isLoopingThroughScripts = false;
    this._executionOrder = -1;
    this.on('set_enabled', this._onSetEnabled, this);
  }

  set scripts(value) {
    this._scriptsData = value;

    for (const key in value) {
      if (!value.hasOwnProperty(key)) continue;
      const script = this._scriptsIndex[key];

      if (script) {
        if (typeof value[key].enabled === 'boolean') script.enabled = !!value[key].enabled;

        if (typeof value[key].attributes === 'object') {
          for (const attr in value[key].attributes) {
            if (ScriptAttributes.reservedNames.has(attr)) continue;

            if (!script.__attributes.hasOwnProperty(attr)) {
              const scriptType = this.system.app.scripts.get(key);
              if (scriptType) scriptType.attributes.add(attr, {});
            }

            script[attr] = value[key].attributes[attr];
          }
        }
      } else {
        console.log(this.order);
      }
    }
  }

  get scripts() {
    return this._scripts;
  }

  set enabled(value) {
    const oldValue = this._enabled;
    this._enabled = value;
    this.fire('set', 'enabled', oldValue, value);
  }

  get enabled() {
    return this._enabled;
  }

  onEnable() {
    this._beingEnabled = true;

    this._checkState();

    if (!this.entity._beingEnabled) {
      this.onPostStateChange();
    }

    this._beingEnabled = false;
  }

  onDisable() {
    this._checkState();
  }

  onPostStateChange() {
    const wasLooping = this._beginLooping();

    for (let i = 0, len = this.scripts.length; i < len; i++) {
      const script = this.scripts[i];

      if (script._initialized && !script._postInitialized && script.enabled) {
        script._postInitialized = true;
        if (script.postInitialize) this._scriptMethod(script, ScriptComponent.scriptMethods.postInitialize);
      }
    }

    this._endLooping(wasLooping);
  }

  _beginLooping() {
    const looping = this._isLoopingThroughScripts;
    this._isLoopingThroughScripts = true;
    return looping;
  }

  _endLooping(wasLoopingBefore) {
    this._isLoopingThroughScripts = wasLoopingBefore;

    if (!this._isLoopingThroughScripts) {
      this._removeDestroyedScripts();
    }
  }

  _onSetEnabled(prop, old, value) {
    this._beingEnabled = true;

    this._checkState();

    this._beingEnabled = false;
  }

  _checkState() {
    const state = this.enabled && this.entity.enabled;
    if (state === this._oldState) return;
    this._oldState = state;
    this.fire(state ? 'enable' : 'disable');
    this.fire('state', state);

    if (state) {
      this.system._addComponentToEnabled(this);
    } else {
      this.system._removeComponentFromEnabled(this);
    }

    const wasLooping = this._beginLooping();

    for (let i = 0, len = this.scripts.length; i < len; i++) {
      const script = this.scripts[i];
      script.enabled = script._enabled;
    }

    this._endLooping(wasLooping);
  }

  _onBeforeRemove() {
    this.fire('remove');

    const wasLooping = this._beginLooping();

    for (let i = 0; i < this.scripts.length; i++) {
      const script = this.scripts[i];
      if (!script) continue;
      this.destroy(script.__scriptType.__name);
    }

    this._endLooping(wasLooping);
  }

  _removeDestroyedScripts() {
    const len = this._destroyedScripts.length;
    if (!len) return;

    for (let i = 0; i < len; i++) {
      const script = this._destroyedScripts[i];

      this._removeScriptInstance(script);
    }

    this._destroyedScripts.length = 0;

    this._resetExecutionOrder(0, this._scripts.length);
  }

  _onInitializeAttributes() {
    for (let i = 0, len = this.scripts.length; i < len; i++) this.scripts[i].__initializeAttributes();
  }

  _scriptMethod(script, method, arg) {
    try {
      script[method](arg);
    } catch (ex) {
      script.enabled = false;

      if (!script._callbacks || !script._callbacks.error) {
        console.warn(`unhandled exception while calling "${method}" for "${script.__scriptType.__name}" script: `, ex);
        console.error(ex);
      }

      script.fire('error', ex, method);
      this.fire('error', script, ex, method);
    }
  }

  _onInitialize() {
    const scripts = this._scripts;

    const wasLooping = this._beginLooping();

    for (let i = 0, len = scripts.length; i < len; i++) {
      const script = scripts[i];

      if (!script._initialized && script.enabled) {
        script._initialized = true;
        if (script.initialize) this._scriptMethod(script, ScriptComponent.scriptMethods.initialize);
      }
    }

    this._endLooping(wasLooping);
  }

  _onPostInitialize() {
    this.onPostStateChange();
  }

  _onUpdate(dt) {
    const list = this._updateList;
    if (!list.length) return;

    const wasLooping = this._beginLooping();

    for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
      const script = list.items[list.loopIndex];

      if (script.enabled) {
        this._scriptMethod(script, ScriptComponent.scriptMethods.update, dt);
      }
    }

    this._endLooping(wasLooping);
  }

  _onPostUpdate(dt) {
    const list = this._postUpdateList;
    if (!list.length) return;

    const wasLooping = this._beginLooping();

    for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
      const script = list.items[list.loopIndex];

      if (script.enabled) {
        this._scriptMethod(script, ScriptComponent.scriptMethods.postUpdate, dt);
      }
    }

    this._endLooping(wasLooping);
  }

  _insertScriptInstance(scriptInstance, index, scriptsLength) {
    if (index === -1) {
      this._scripts.push(scriptInstance);

      scriptInstance.__executionOrder = scriptsLength;

      if (scriptInstance.update) {
        this._updateList.append(scriptInstance);
      }

      if (scriptInstance.postUpdate) {
        this._postUpdateList.append(scriptInstance);
      }
    } else {
      this._scripts.splice(index, 0, scriptInstance);

      scriptInstance.__executionOrder = index;

      this._resetExecutionOrder(index + 1, scriptsLength + 1);

      if (scriptInstance.update) {
        this._updateList.insert(scriptInstance);
      }

      if (scriptInstance.postUpdate) {
        this._postUpdateList.insert(scriptInstance);
      }
    }
  }

  _removeScriptInstance(scriptInstance) {
    const idx = this._scripts.indexOf(scriptInstance);

    if (idx === -1) return idx;

    this._scripts.splice(idx, 1);

    if (scriptInstance.update) {
      this._updateList.remove(scriptInstance);
    }

    if (scriptInstance.postUpdate) {
      this._postUpdateList.remove(scriptInstance);
    }

    return idx;
  }

  _resetExecutionOrder(startIndex, scriptsLength) {
    for (let i = startIndex; i < scriptsLength; i++) {
      this._scripts[i].__executionOrder = i;
    }
  }

  _resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newAttributes, duplicatedIdsMap) {
    if (attribute.array) {
      const len = oldValue.length;

      if (!len) {
        return;
      }

      const newGuidArray = oldValue.slice();

      for (let i = 0; i < len; i++) {
        const guid = newGuidArray[i] instanceof Entity ? newGuidArray[i].getGuid() : newGuidArray[i];

        if (duplicatedIdsMap[guid]) {
          newGuidArray[i] = useGuid ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
        }
      }

      newAttributes[attributeName] = newGuidArray;
    } else {
      if (oldValue instanceof Entity) {
        oldValue = oldValue.getGuid();
      } else if (typeof oldValue !== 'string') {
        return;
      }

      if (duplicatedIdsMap[oldValue]) {
        newAttributes[attributeName] = duplicatedIdsMap[oldValue];
      }
    }
  }

  has(nameOrType) {
    if (typeof nameOrType === 'string') {
      return !!this._scriptsIndex[nameOrType];
    }

    if (!nameOrType) return false;
    const scriptType = nameOrType;
    const scriptName = scriptType.__name;
    const scriptData = this._scriptsIndex[scriptName];
    const scriptInstance = scriptData && scriptData.instance;
    return scriptInstance instanceof scriptType;
  }

  get(nameOrType) {
    if (typeof nameOrType === 'string') {
      const data = this._scriptsIndex[nameOrType];
      return data ? data.instance : null;
    }

    if (!nameOrType) return null;
    const scriptType = nameOrType;
    const scriptName = scriptType.__name;
    const scriptData = this._scriptsIndex[scriptName];
    const scriptInstance = scriptData && scriptData.instance;
    return scriptInstance instanceof scriptType ? scriptInstance : null;
  }

  create(nameOrType, args = {}) {
    const self = this;
    let scriptType = nameOrType;
    let scriptName = nameOrType;

    if (typeof scriptType === 'string') {
      scriptType = this.system.app.scripts.get(scriptType);
    } else if (scriptType) {
      scriptName = scriptType.__name;
    }

    if (scriptType) {
      if (!this._scriptsIndex[scriptName] || !this._scriptsIndex[scriptName].instance) {
        const scriptInstance = new scriptType({
          app: this.system.app,
          entity: this.entity,
          enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
          attributes: args.attributes
        });
        const len = this._scripts.length;
        let ind = -1;
        if (typeof args.ind === 'number' && args.ind !== -1 && len > args.ind) ind = args.ind;

        this._insertScriptInstance(scriptInstance, ind, len);

        this._scriptsIndex[scriptName] = {
          instance: scriptInstance,
          onSwap: function () {
            self.swap(scriptName);
          }
        };
        this[scriptName] = scriptInstance;
        if (!args.preloading) scriptInstance.__initializeAttributes();
        this.fire('create', scriptName, scriptInstance);
        this.fire('create:' + scriptName, scriptInstance);
        this.system.app.scripts.on('swap:' + scriptName, this._scriptsIndex[scriptName].onSwap);

        if (!args.preloading) {
          if (scriptInstance.enabled && !scriptInstance._initialized) {
            scriptInstance._initialized = true;
            if (scriptInstance.initialize) this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.initialize);
          }

          if (scriptInstance.enabled && !scriptInstance._postInitialized) {
            scriptInstance._postInitialized = true;
            if (scriptInstance.postInitialize) this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.postInitialize);
          }
        }

        return scriptInstance;
      }

      Debug.warn(`script '${scriptName}' is already added to entity '${this.entity.name}'`);
    } else {
      this._scriptsIndex[scriptName] = {
        awaiting: true,
        ind: this._scripts.length
      };
      Debug.warn(`script '${scriptName}' is not found, awaiting it to be added to registry`);
    }

    return null;
  }

  destroy(nameOrType) {
    let scriptName = nameOrType;
    let scriptType = nameOrType;

    if (typeof scriptType === 'string') {
      scriptType = this.system.app.scripts.get(scriptType);
    } else if (scriptType) {
      scriptName = scriptType.__name;
    }

    const scriptData = this._scriptsIndex[scriptName];
    delete this._scriptsIndex[scriptName];
    if (!scriptData) return false;
    const scriptInstance = scriptData.instance;

    if (scriptInstance && !scriptInstance._destroyed) {
      scriptInstance.enabled = false;
      scriptInstance._destroyed = true;

      if (!this._isLoopingThroughScripts) {
        const ind = this._removeScriptInstance(scriptInstance);

        if (ind >= 0) {
          this._resetExecutionOrder(ind, this._scripts.length);
        }
      } else {
        this._destroyedScripts.push(scriptInstance);
      }
    }

    this.system.app.scripts.off('swap:' + scriptName, scriptData.onSwap);
    delete this[scriptName];
    this.fire('destroy', scriptName, scriptInstance || null);
    this.fire('destroy:' + scriptName, scriptInstance || null);
    if (scriptInstance) scriptInstance.fire('destroy');
    return true;
  }

  swap(nameOrType) {
    let scriptName = nameOrType;
    let scriptType = nameOrType;

    if (typeof scriptType === 'string') {
      scriptType = this.system.app.scripts.get(scriptType);
    } else if (scriptType) {
      scriptName = scriptType.__name;
    }

    const old = this._scriptsIndex[scriptName];
    if (!old || !old.instance) return false;
    const scriptInstanceOld = old.instance;

    const ind = this._scripts.indexOf(scriptInstanceOld);

    const scriptInstance = new scriptType({
      app: this.system.app,
      entity: this.entity,
      enabled: scriptInstanceOld.enabled,
      attributes: scriptInstanceOld.__attributes
    });
    if (!scriptInstance.swap) return false;

    scriptInstance.__initializeAttributes();

    this._scripts[ind] = scriptInstance;
    this._scriptsIndex[scriptName].instance = scriptInstance;
    this[scriptName] = scriptInstance;
    scriptInstance.__executionOrder = ind;

    if (scriptInstanceOld.update) {
      this._updateList.remove(scriptInstanceOld);
    }

    if (scriptInstanceOld.postUpdate) {
      this._postUpdateList.remove(scriptInstanceOld);
    }

    if (scriptInstance.update) {
      this._updateList.insert(scriptInstance);
    }

    if (scriptInstance.postUpdate) {
      this._postUpdateList.insert(scriptInstance);
    }

    this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.swap, scriptInstanceOld);

    this.fire('swap', scriptName, scriptInstance);
    this.fire('swap:' + scriptName, scriptInstance);
    return true;
  }

  resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {
    const newScriptComponent = this.entity.script;

    for (const scriptName in oldScriptComponent._scriptsIndex) {
      const scriptType = this.system.app.scripts.get(scriptName);

      if (!scriptType) {
        continue;
      }

      const script = oldScriptComponent._scriptsIndex[scriptName];

      if (!script || !script.instance) {
        continue;
      }

      const newAttributesRaw = newScriptComponent[scriptName].__attributesRaw;
      const newAttributes = newScriptComponent[scriptName].__attributes;

      if (!newAttributesRaw && !newAttributes) {
        continue;
      }

      const useGuid = !!newAttributesRaw;
      const oldAttributes = script.instance.__attributes;

      for (const attributeName in oldAttributes) {
        if (!oldAttributes[attributeName]) {
          continue;
        }

        const attribute = scriptType.attributes.get(attributeName);

        if (!attribute) {
          continue;
        }

        if (attribute.type === 'entity') {
          this._resolveEntityScriptAttribute(attribute, attributeName, oldAttributes[attributeName], useGuid, newAttributesRaw || newAttributes, duplicatedIdsMap);
        } else if (attribute.type === 'json' && Array.isArray(attribute.schema)) {
          const oldValue = oldAttributes[attributeName];
          const newJsonValue = newAttributesRaw ? newAttributesRaw[attributeName] : newAttributes[attributeName];

          for (let i = 0; i < attribute.schema.length; i++) {
            const field = attribute.schema[i];

            if (field.type !== 'entity') {
              continue;
            }

            if (attribute.array) {
              for (let j = 0; j < oldValue.length; j++) {
                this._resolveEntityScriptAttribute(field, field.name, oldValue[j][field.name], useGuid, newJsonValue[j], duplicatedIdsMap);
              }
            } else {
              this._resolveEntityScriptAttribute(field, field.name, oldValue[field.name], useGuid, newJsonValue, duplicatedIdsMap);
            }
          }
        }
      }
    }
  }

  move(nameOrType, ind) {
    const len = this._scripts.length;
    if (ind >= len || ind < 0) return false;
    let scriptType = nameOrType;
    let scriptName = nameOrType;

    if (typeof scriptName !== 'string') {
      scriptName = nameOrType.__name;
    } else {
      scriptType = null;
    }

    const scriptData = this._scriptsIndex[scriptName];
    if (!scriptData || !scriptData.instance) return false;
    const scriptInstance = scriptData.instance;
    if (scriptType && !(scriptInstance instanceof scriptType)) return false;

    const indOld = this._scripts.indexOf(scriptInstance);

    if (indOld === -1 || indOld === ind) return false;

    this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);

    this._resetExecutionOrder(0, len);

    this._updateList.sort();

    this._postUpdateList.sort();

    this.fire('move', scriptName, scriptInstance, ind, indOld);
    this.fire('move:' + scriptName, scriptInstance, ind, indOld);
    return true;
  }

}

ScriptComponent.scriptMethods = {
  initialize: 'initialize',
  postInitialize: 'postInitialize',
  update: 'update',
  postUpdate: 'postUpdate',
  swap: 'swap'
};

export { ScriptComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTb3J0ZWRMb29wQXJyYXkgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3NvcnRlZC1sb29wLWFycmF5LmpzJztcblxuaW1wb3J0IHsgU2NyaXB0QXR0cmlidXRlcyB9IGZyb20gJy4uLy4uLy4uL3NjcmlwdC9zY3JpcHQtYXR0cmlidXRlcy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi8uLi9lbnRpdHkuanMnO1xuXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCB7IFNjcmlwdFR5cGUgfSBmcm9tICcuLi8uLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU2NyaXB0Q29tcG9uZW50U3lzdGVtfSBTY3JpcHRDb21wb25lbnRTeXN0ZW0gKi9cblxuLyoqXG4gKiBUaGUgU2NyaXB0Q29tcG9uZW50IGFsbG93cyB5b3UgdG8gZXh0ZW5kIHRoZSBmdW5jdGlvbmFsaXR5IG9mIGFuIEVudGl0eSBieSBhdHRhY2hpbmcgeW91ciBvd25cbiAqIFNjcmlwdCBUeXBlcyBkZWZpbmVkIGluIEphdmFTY3JpcHQgZmlsZXMgdG8gYmUgZXhlY3V0ZWQgd2l0aCBhY2Nlc3MgdG8gdGhlIEVudGl0eS4gRm9yIG1vcmVcbiAqIGRldGFpbHMgb24gc2NyaXB0aW5nIHNlZSBbU2NyaXB0aW5nXShodHRwczovL2RldmVsb3Blci5wbGF5Y2FudmFzLmNvbS91c2VyLW1hbnVhbC9zY3JpcHRpbmcvKS5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFNjcmlwdENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjcmlwdENvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2NyaXB0Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9sZHMgYWxsIHNjcmlwdCBpbnN0YW5jZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NyaXB0VHlwZVtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NyaXB0cyA9IFtdO1xuICAgICAgICAvLyBob2xkcyBhbGwgc2NyaXB0IGluc3RhbmNlcyB3aXRoIGFuIHVwZGF0ZSBtZXRob2RcbiAgICAgICAgdGhpcy5fdXBkYXRlTGlzdCA9IG5ldyBTb3J0ZWRMb29wQXJyYXkoeyBzb3J0Qnk6ICdfX2V4ZWN1dGlvbk9yZGVyJyB9KTtcbiAgICAgICAgLy8gaG9sZHMgYWxsIHNjcmlwdCBpbnN0YW5jZXMgd2l0aCBhIHBvc3RVcGRhdGUgbWV0aG9kXG4gICAgICAgIHRoaXMuX3Bvc3RVcGRhdGVMaXN0ID0gbmV3IFNvcnRlZExvb3BBcnJheSh7IHNvcnRCeTogJ19fZXhlY3V0aW9uT3JkZXInIH0pO1xuXG4gICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleCA9IHt9O1xuICAgICAgICB0aGlzLl9kZXN0cm95ZWRTY3JpcHRzID0gW107XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3llZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY3JpcHRzRGF0YSA9IG51bGw7XG4gICAgICAgIHRoaXMuX29sZFN0YXRlID0gdHJ1ZTtcblxuICAgICAgICAvLyBvdmVycmlkZSBkZWZhdWx0ICdlbmFibGVkJyBwcm9wZXJ0eSBvZiBiYXNlIHBjLkNvbXBvbmVudFxuICAgICAgICAvLyBiZWNhdXNlIHRoaXMgaXMgZmFzdGVyXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIHdoZXRoZXIgdGhpcyBjb21wb25lbnQgaXMgY3VycmVudGx5IGJlaW5nIGVuYWJsZWRcbiAgICAgICAgdGhpcy5fYmVpbmdFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIC8vIGlmIHRydWUgdGhlbiB3ZSBhcmUgY3VycmVudGx5IGxvb3BpbmcgdGhyb3VnaFxuICAgICAgICAvLyBzY3JpcHQgaW5zdGFuY2VzLiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhIHNjcmlwdHMgYXJyYXlcbiAgICAgICAgLy8gZnJvbSBiZWluZyBtb2RpZmllZCB3aGlsZSBhIGxvb3AgaXMgYmVpbmcgZXhlY3V0ZWRcbiAgICAgICAgdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHMgPSBmYWxzZTtcblxuICAgICAgICAvLyB0aGUgb3JkZXIgdGhhdCB0aGlzIGNvbXBvbmVudCB3aWxsIGJlIHVwZGF0ZWRcbiAgICAgICAgLy8gYnkgdGhlIHNjcmlwdCBzeXN0ZW0uIFRoaXMgaXMgc2V0IGJ5IHRoZSBzeXN0ZW0gaXRzZWxmLlxuICAgICAgICB0aGlzLl9leGVjdXRpb25PcmRlciA9IC0xO1xuXG4gICAgICAgIHRoaXMub24oJ3NldF9lbmFibGVkJywgdGhpcy5fb25TZXRFbmFibGVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIENvbXBvbmVudCBiZWNvbWVzIGVuYWJsZWQuIE5vdGU6IHRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbiBhY2NvdW50IGVudGl0eSBvclxuICAgICAqIGFueSBvZiBpdHMgcGFyZW50IGVuYWJsZWQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I2VuYWJsZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignZW5hYmxlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBDb21wb25lbnQgYmVjb21lcyBkaXNhYmxlZC4gTm90ZTogdGhpcyBldmVudCBkb2VzIG5vdCB0YWtlIGluIGFjY291bnQgZW50aXR5IG9yXG4gICAgICogYW55IG9mIGl0cyBwYXJlbnQgZW5hYmxlZCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjZGlzYWJsZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignZGlzYWJsZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gY29tcG9uZW50IGlzIGRpc2FibGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIENvbXBvbmVudCBjaGFuZ2VzIHN0YXRlIHRvIGVuYWJsZWQgb3IgZGlzYWJsZWQuIE5vdGU6IHRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpblxuICAgICAqIGFjY291bnQgZW50aXR5IG9yIGFueSBvZiBpdHMgcGFyZW50IGVuYWJsZWQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I3N0YXRlXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gVHJ1ZSBpZiBub3cgZW5hYmxlZCwgRmFsc2UgaWYgZGlzYWJsZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdzdGF0ZScsIGZ1bmN0aW9uIChlbmFibGVkKSB7XG4gICAgICogICAgIC8vIGNvbXBvbmVudCBjaGFuZ2VkIHN0YXRlXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIENvbXBvbmVudCBpcyByZW1vdmVkIGZyb20gZW50aXR5LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNyZW1vdmVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ3JlbW92ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gZW50aXR5IGhhcyBubyBtb3JlIHNjcmlwdCBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgY3JlYXRlZCBhbmQgYXR0YWNoZWQgdG8gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNjcmVhdGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBTY3JpcHQgVHlwZS5cbiAgICAgKiBAcGFyYW0ge1NjcmlwdFR5cGV9IHNjcmlwdEluc3RhbmNlIC0gVGhlIGluc3RhbmNlIG9mIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBjcmVhdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignY3JlYXRlJywgZnVuY3Rpb24gKG5hbWUsIHNjcmlwdEluc3RhbmNlKSB7XG4gICAgICogICAgIC8vIG5ldyBzY3JpcHQgaW5zdGFuY2UgYWRkZWQgdG8gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGNyZWF0ZWQgYW5kIGF0dGFjaGVkIHRvIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjY3JlYXRlOltuYW1lXVxuICAgICAqIEBwYXJhbSB7U2NyaXB0VHlwZX0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgaW5zdGFuY2Ugb2YgdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IGhhcyBiZWVuIGNyZWF0ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdjcmVhdGU6cGxheWVyQ29udHJvbGxlcicsIGZ1bmN0aW9uIChzY3JpcHRJbnN0YW5jZSkge1xuICAgICAqICAgICAvLyBuZXcgc2NyaXB0IGluc3RhbmNlICdwbGF5ZXJDb250cm9sbGVyJyBpcyBhZGRlZCB0byBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgZGVzdHJveWVkIGFuZCByZW1vdmVkIGZyb20gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNkZXN0cm95XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgU2NyaXB0IFR5cGUuXG4gICAgICogQHBhcmFtIHtTY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IHRoYXQgaGFzIGJlZW4gZGVzdHJveWVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignZGVzdHJveScsIGZ1bmN0aW9uIChuYW1lLCBzY3JpcHRJbnN0YW5jZSkge1xuICAgICAqICAgICAvLyBzY3JpcHQgaW5zdGFuY2UgaGFzIGJlZW4gZGVzdHJveWVkIGFuZCByZW1vdmVkIGZyb20gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGRlc3Ryb3llZCBhbmQgcmVtb3ZlZCBmcm9tIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjZGVzdHJveTpbbmFtZV1cbiAgICAgKiBAcGFyYW0ge1NjcmlwdFR5cGV9IHNjcmlwdEluc3RhbmNlIC0gVGhlIGluc3RhbmNlIG9mIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBkZXN0cm95ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdkZXN0cm95OnBsYXllckNvbnRyb2xsZXInLCBmdW5jdGlvbiAoc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgKiAgICAgLy8gc2NyaXB0IGluc3RhbmNlICdwbGF5ZXJDb250cm9sbGVyJyBoYXMgYmVlbiBkZXN0cm95ZWQgYW5kIHJlbW92ZWQgZnJvbSBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgbW92ZWQgaW4gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNtb3ZlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgU2NyaXB0IFR5cGUuXG4gICAgICogQHBhcmFtIHtTY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IHRoYXQgaGFzIGJlZW4gbW92ZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZCAtIE5ldyBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kT2xkIC0gT2xkIHBvc2l0aW9uIGluZGV4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignbW92ZScsIGZ1bmN0aW9uIChuYW1lLCBzY3JpcHRJbnN0YW5jZSwgaW5kLCBpbmRPbGQpIHtcbiAgICAgKiAgICAgLy8gc2NyaXB0IGluc3RhbmNlIGhhcyBiZWVuIG1vdmVkIGluIGNvbXBvbmVudFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBpcyBtb3ZlZCBpbiBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I21vdmU6W25hbWVdXG4gICAgICogQHBhcmFtIHtTY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IHRoYXQgaGFzIGJlZW4gbW92ZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZCAtIE5ldyBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kT2xkIC0gT2xkIHBvc2l0aW9uIGluZGV4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignbW92ZTpwbGF5ZXJDb250cm9sbGVyJywgZnVuY3Rpb24gKHNjcmlwdEluc3RhbmNlLCBpbmQsIGluZE9sZCkge1xuICAgICAqICAgICAvLyBzY3JpcHQgaW5zdGFuY2UgJ3BsYXllckNvbnRyb2xsZXInIGhhcyBiZWVuIG1vdmVkIGluIGNvbXBvbmVudFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBoYWQgYW4gZXhjZXB0aW9uLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNlcnJvclxuICAgICAqIEBwYXJhbSB7U2NyaXB0VHlwZX0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgaW5zdGFuY2Ugb2YgdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IHJhaXNlZCB0aGUgZXhjZXB0aW9uLlxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVyciAtIE5hdGl2ZSBKUyBFcnJvciBvYmplY3Qgd2l0aCBkZXRhaWxzIG9mIGFuIGVycm9yLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgLSBUaGUgbWV0aG9kIG9mIHRoZSBzY3JpcHQgaW5zdGFuY2UgdGhhdCB0aGUgZXhjZXB0aW9uIG9yaWdpbmF0ZWQgZnJvbS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2Vycm9yJywgZnVuY3Rpb24gKHNjcmlwdEluc3RhbmNlLCBlcnIsIG1ldGhvZCkge1xuICAgICAqICAgICAvLyBzY3JpcHQgaW5zdGFuY2UgY2F1Z2h0IGFuIGV4Y2VwdGlvblxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgYWxsIHNjcmlwdCBpbnN0YW5jZXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LiBUaGlzIGFycmF5IGlzIHJlYWQtb25seSBhbmQgc2hvdWxkXG4gICAgICogbm90IGJlIG1vZGlmaWVkIGJ5IGRldmVsb3Blci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTY3JpcHRUeXBlW119XG4gICAgICovXG4gICAgc2V0IHNjcmlwdHModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2NyaXB0c0RhdGEgPSB2YWx1ZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKCF2YWx1ZS5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLl9zY3JpcHRzSW5kZXhba2V5XTtcbiAgICAgICAgICAgIGlmIChzY3JpcHQpIHtcbiAgICAgICAgICAgICAgICAvLyBleGlzdGluZyBzY3JpcHRcblxuICAgICAgICAgICAgICAgIC8vIGVuYWJsZWRcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2tleV0uZW5hYmxlZCA9PT0gJ2Jvb2xlYW4nKVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHQuZW5hYmxlZCA9ICEhdmFsdWVba2V5XS5lbmFibGVkO1xuXG4gICAgICAgICAgICAgICAgLy8gYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWVba2V5XS5hdHRyaWJ1dGVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdmFsdWVba2V5XS5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoU2NyaXB0QXR0cmlidXRlcy5yZXNlcnZlZE5hbWVzLmhhcyhhdHRyKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzY3JpcHQuX19hdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbmV3IGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdFR5cGUgPSB0aGlzLnN5c3RlbS5hcHAuc2NyaXB0cy5nZXQoa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0VHlwZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmFkZChhdHRyLCB7IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1cGRhdGUgYXR0cmlidXRlXG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRbYXR0cl0gPSB2YWx1ZVtrZXldLmF0dHJpYnV0ZXNbYXR0cl07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFRPRE8gc2NyaXB0czJcbiAgICAgICAgICAgICAgICAvLyBuZXcgc2NyaXB0XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5vcmRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2NyaXB0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NjcmlwdHM7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzLl9lbmFibGVkO1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0JywgJ2VuYWJsZWQnLCBvbGRWYWx1ZSwgdmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZDtcbiAgICB9XG5cbiAgICBzdGF0aWMgc2NyaXB0TWV0aG9kcyA9IHtcbiAgICAgICAgaW5pdGlhbGl6ZTogJ2luaXRpYWxpemUnLFxuICAgICAgICBwb3N0SW5pdGlhbGl6ZTogJ3Bvc3RJbml0aWFsaXplJyxcbiAgICAgICAgdXBkYXRlOiAndXBkYXRlJyxcbiAgICAgICAgcG9zdFVwZGF0ZTogJ3Bvc3RVcGRhdGUnLFxuICAgICAgICBzd2FwOiAnc3dhcCdcbiAgICB9O1xuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NoZWNrU3RhdGUoKTtcblxuICAgICAgICBpZiAoIXRoaXMuZW50aXR5Ll9iZWluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMub25Qb3N0U3RhdGVDaGFuZ2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgIH1cblxuICAgIG9uUG9zdFN0YXRlQ2hhbmdlKCkge1xuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5zY3JpcHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAoc2NyaXB0Ll9pbml0aWFsaXplZCAmJiAhc2NyaXB0Ll9wb3N0SW5pdGlhbGl6ZWQgJiYgc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBzY3JpcHQuX3Bvc3RJbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LnBvc3RJbml0aWFsaXplKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0LCBTY3JpcHRDb21wb25lbnQuc2NyaXB0TWV0aG9kcy5wb3N0SW5pdGlhbGl6ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIC8vIFNldHMgaXNMb29waW5nVGhyb3VnaFNjcmlwdHMgdG8gZmFsc2UgYW5kIHJldHVybnNcbiAgICAvLyBpdHMgcHJldmlvdXMgdmFsdWVcbiAgICBfYmVnaW5Mb29waW5nKCkge1xuICAgICAgICBjb25zdCBsb29waW5nID0gdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHM7XG4gICAgICAgIHRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGxvb3Bpbmc7XG4gICAgfVxuXG4gICAgLy8gUmVzdG9yZXMgaXNMb29waW5nVGhyb3VnaFNjcmlwdHMgdG8gdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXJcbiAgICAvLyBJZiBhbGwgbG9vcHMgYXJlIG92ZXIgdGhlbiByZW1vdmUgZGVzdHJveWVkIHNjcmlwdHMgZm9ybSB0aGUgX3NjcmlwdHMgYXJyYXlcbiAgICBfZW5kTG9vcGluZyh3YXNMb29waW5nQmVmb3JlKSB7XG4gICAgICAgIHRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzID0gd2FzTG9vcGluZ0JlZm9yZTtcbiAgICAgICAgaWYgKCF0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cykge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlRGVzdHJveWVkU2NyaXB0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2UgYWxzbyBuZWVkIHRoaXMgaGFuZGxlciBiZWNhdXNlIGl0IGlzIGZpcmVkXG4gICAgLy8gd2hlbiB2YWx1ZSA9PT0gb2xkIGluc3RlYWQgb2Ygb25FbmFibGUgYW5kIG9uRGlzYWJsZVxuICAgIC8vIHdoaWNoIGFyZSBvbmx5IGZpcmVkIHdoZW4gdmFsdWUgIT09IG9sZFxuICAgIF9vblNldEVuYWJsZWQocHJvcCwgb2xkLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jaGVja1N0YXRlKCk7XG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIF9jaGVja1N0YXRlKCkge1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgICAgICBpZiAoc3RhdGUgPT09IHRoaXMuX29sZFN0YXRlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX29sZFN0YXRlID0gc3RhdGU7XG5cbiAgICAgICAgdGhpcy5maXJlKHN0YXRlID8gJ2VuYWJsZScgOiAnZGlzYWJsZScpO1xuICAgICAgICB0aGlzLmZpcmUoJ3N0YXRlJywgc3RhdGUpO1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2FkZENvbXBvbmVudFRvRW5hYmxlZCh0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9yZW1vdmVDb21wb25lbnRGcm9tRW5hYmxlZCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLnNjcmlwdHNbaV07XG4gICAgICAgICAgICBzY3JpcHQuZW5hYmxlZCA9IHNjcmlwdC5fZW5hYmxlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgX29uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScpO1xuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICAvLyBkZXN0cm95IGFsbCBzY3JpcHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLnNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdCkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveShzY3JpcHQuX19zY3JpcHRUeXBlLl9fbmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIF9yZW1vdmVEZXN0cm95ZWRTY3JpcHRzKCkge1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9kZXN0cm95ZWRTY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgaWYgKCFsZW4pIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLl9kZXN0cm95ZWRTY3JpcHRzW2ldO1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlU2NyaXB0SW5zdGFuY2Uoc2NyaXB0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyB1cGRhdGUgZXhlY3V0aW9uIG9yZGVyIGZvciBzY3JpcHRzXG4gICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoMCwgdGhpcy5fc2NyaXB0cy5sZW5ndGgpO1xuICAgIH1cblxuICAgIF9vbkluaXRpYWxpemVBdHRyaWJ1dGVzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgICAgdGhpcy5zY3JpcHRzW2ldLl9faW5pdGlhbGl6ZUF0dHJpYnV0ZXMoKTtcbiAgICB9XG5cbiAgICBfc2NyaXB0TWV0aG9kKHNjcmlwdCwgbWV0aG9kLCBhcmcpIHtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICB0cnkge1xuICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgIHNjcmlwdFttZXRob2RdKGFyZyk7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIC8vIGRpc2FibGUgc2NyaXB0IGlmIGl0IGZhaWxzIHRvIGNhbGwgbWV0aG9kXG4gICAgICAgICAgICBzY3JpcHQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoIXNjcmlwdC5fY2FsbGJhY2tzIHx8ICFzY3JpcHQuX2NhbGxiYWNrcy5lcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgdW5oYW5kbGVkIGV4Y2VwdGlvbiB3aGlsZSBjYWxsaW5nIFwiJHttZXRob2R9XCIgZm9yIFwiJHtzY3JpcHQuX19zY3JpcHRUeXBlLl9fbmFtZX1cIiBzY3JpcHQ6IGAsIGV4KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGV4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NyaXB0LmZpcmUoJ2Vycm9yJywgZXgsIG1ldGhvZCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgc2NyaXB0LCBleCwgbWV0aG9kKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBfb25Jbml0aWFsaXplKCkge1xuICAgICAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5fc2NyaXB0cztcblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHNjcmlwdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdC5faW5pdGlhbGl6ZWQgJiYgc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBzY3JpcHQuX2luaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LmluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHQsIFNjcmlwdENvbXBvbmVudC5zY3JpcHRNZXRob2RzLmluaXRpYWxpemUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICBfb25Qb3N0SW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgdGhpcy5vblBvc3RTdGF0ZUNoYW5nZSgpO1xuICAgIH1cblxuICAgIF9vblVwZGF0ZShkdCkge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5fdXBkYXRlTGlzdDtcbiAgICAgICAgaWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxpc3QubG9vcEluZGV4ID0gMDsgbGlzdC5sb29wSW5kZXggPCBsaXN0Lmxlbmd0aDsgbGlzdC5sb29wSW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gbGlzdC5pdGVtc1tsaXN0Lmxvb3BJbmRleF07XG4gICAgICAgICAgICBpZiAoc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0LCBTY3JpcHRDb21wb25lbnQuc2NyaXB0TWV0aG9kcy51cGRhdGUsIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgX29uUG9zdFVwZGF0ZShkdCkge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5fcG9zdFVwZGF0ZUxpc3Q7XG4gICAgICAgIGlmICghbGlzdC5sZW5ndGgpIHJldHVybjtcblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsaXN0Lmxvb3BJbmRleCA9IDA7IGxpc3QubG9vcEluZGV4IDwgbGlzdC5sZW5ndGg7IGxpc3QubG9vcEluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGxpc3QuaXRlbXNbbGlzdC5sb29wSW5kZXhdO1xuICAgICAgICAgICAgaWYgKHNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdCwgU2NyaXB0Q29tcG9uZW50LnNjcmlwdE1ldGhvZHMucG9zdFVwZGF0ZSwgZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIHNjcmlwdCBpbnN0YW5jZSBpbnRvIHRoZSBzY3JpcHRzIGFycmF5IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXguIEFsc28gaW5zZXJ0cyB0aGVcbiAgICAgKiBzY3JpcHQgaW50byB0aGUgdXBkYXRlIGxpc3QgaWYgaXQgaGFzIGFuIHVwZGF0ZSBtZXRob2QgYW5kIHRoZSBwb3N0IHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhXG4gICAgICogcG9zdFVwZGF0ZSBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgc2NyaXB0IGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIHNjcmlwdCBhdC4gSWYgLTEsIGFwcGVuZCBpdCBhdCB0aGUgZW5kLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY3JpcHRzTGVuZ3RoIC0gVGhlIGxlbmd0aCBvZiB0aGUgc2NyaXB0cyBhcnJheS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbnNlcnRTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSwgaW5kZXgsIHNjcmlwdHNMZW5ndGgpIHtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgLy8gYXBwZW5kIHNjcmlwdCBhdCB0aGUgZW5kIGFuZCBzZXQgZXhlY3V0aW9uIG9yZGVyXG4gICAgICAgICAgICB0aGlzLl9zY3JpcHRzLnB1c2goc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19leGVjdXRpb25PcmRlciA9IHNjcmlwdHNMZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIGFwcGVuZCBzY3JpcHQgdG8gdGhlIHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhbiB1cGRhdGUgbWV0aG9kXG4gICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UudXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGlzdC5hcHBlbmQoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhZGQgc2NyaXB0IHRvIHRoZSBwb3N0VXBkYXRlIGxpc3QgaWYgaXQgaGFzIGEgcG9zdFVwZGF0ZSBtZXRob2RcbiAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS5wb3N0VXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuYXBwZW5kKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGluc2VydCBzY3JpcHQgYXQgaW5kZXggYW5kIHNldCBleGVjdXRpb24gb3JkZXJcbiAgICAgICAgICAgIHRoaXMuX3NjcmlwdHMuc3BsaWNlKGluZGV4LCAwLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fX2V4ZWN1dGlvbk9yZGVyID0gaW5kZXg7XG5cbiAgICAgICAgICAgIC8vIG5vdyB3ZSBhbHNvIG5lZWQgdG8gdXBkYXRlIHRoZSBleGVjdXRpb24gb3JkZXIgb2YgYWxsXG4gICAgICAgICAgICAvLyB0aGUgc2NyaXB0IGluc3RhbmNlcyB0aGF0IGNvbWUgYWZ0ZXIgdGhpcyBzY3JpcHRcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoaW5kZXggKyAxLCBzY3JpcHRzTGVuZ3RoICsgMSk7XG5cbiAgICAgICAgICAgIC8vIGluc2VydCBzY3JpcHQgdG8gdGhlIHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhbiB1cGRhdGUgbWV0aG9kXG4gICAgICAgICAgICAvLyBpbiB0aGUgcmlnaHQgb3JkZXJcbiAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVMaXN0Lmluc2VydChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluc2VydCBzY3JpcHQgdG8gdGhlIHBvc3RVcGRhdGUgbGlzdCBpZiBpdCBoYXMgYSBwb3N0VXBkYXRlIG1ldGhvZFxuICAgICAgICAgICAgLy8gaW4gdGhlIHJpZ2h0IG9yZGVyXG4gICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc3RVcGRhdGVMaXN0Lmluc2VydChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlU2NyaXB0SW5zdGFuY2Uoc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fc2NyaXB0cy5pbmRleE9mKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybiBpZHg7XG5cbiAgICAgICAgdGhpcy5fc2NyaXB0cy5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UudXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaXN0LnJlbW92ZShzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpZHg7XG4gICAgfVxuXG4gICAgX3Jlc2V0RXhlY3V0aW9uT3JkZXIoc3RhcnRJbmRleCwgc2NyaXB0c0xlbmd0aCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8IHNjcmlwdHNMZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fc2NyaXB0c1tpXS5fX2V4ZWN1dGlvbk9yZGVyID0gaTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZXNvbHZlRW50aXR5U2NyaXB0QXR0cmlidXRlKGF0dHJpYnV0ZSwgYXR0cmlidXRlTmFtZSwgb2xkVmFsdWUsIHVzZUd1aWQsIG5ld0F0dHJpYnV0ZXMsIGR1cGxpY2F0ZWRJZHNNYXApIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZS5hcnJheSkge1xuICAgICAgICAgICAgLy8gaGFuZGxlIGVudGl0eSBhcnJheSBhdHRyaWJ1dGVcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IG9sZFZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgIGlmICghbGVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBuZXdHdWlkQXJyYXkgPSBvbGRWYWx1ZS5zbGljZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGd1aWQgPSBuZXdHdWlkQXJyYXlbaV0gaW5zdGFuY2VvZiBFbnRpdHkgPyBuZXdHdWlkQXJyYXlbaV0uZ2V0R3VpZCgpIDogbmV3R3VpZEFycmF5W2ldO1xuICAgICAgICAgICAgICAgIGlmIChkdXBsaWNhdGVkSWRzTWFwW2d1aWRdKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0d1aWRBcnJheVtpXSA9IHVzZUd1aWQgPyBkdXBsaWNhdGVkSWRzTWFwW2d1aWRdLmdldEd1aWQoKSA6IGR1cGxpY2F0ZWRJZHNNYXBbZ3VpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXdBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gbmV3R3VpZEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaGFuZGxlIHJlZ3VsYXIgZW50aXR5IGF0dHJpYnV0ZVxuICAgICAgICAgICAgaWYgKG9sZFZhbHVlIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgb2xkVmFsdWUgPSBvbGRWYWx1ZS5nZXRHdWlkKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvbGRWYWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkdXBsaWNhdGVkSWRzTWFwW29sZFZhbHVlXSkge1xuICAgICAgICAgICAgICAgIG5ld0F0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0gPSBkdXBsaWNhdGVkSWRzTWFwW29sZFZhbHVlXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVjdCBpZiBzY3JpcHQgaXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8U2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGUgbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgc2NyaXB0IGlzIGF0dGFjaGVkIHRvIGFuIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChlbnRpdHkuc2NyaXB0LmhhcygncGxheWVyQ29udHJvbGxlcicpKSB7XG4gICAgICogICAgIC8vIGVudGl0eSBoYXMgc2NyaXB0XG4gICAgICogfVxuICAgICAqL1xuICAgIGhhcyhuYW1lT3JUeXBlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZU9yVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiAhIXRoaXMuX3NjcmlwdHNJbmRleFtuYW1lT3JUeXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbmFtZU9yVHlwZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEgJiYgc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlIGluc3RhbmNlb2Ygc2NyaXB0VHlwZTsgLy8gd2lsbCByZXR1cm4gZmFsc2UgaWYgc2NyaXB0SW5zdGFuY2UgdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgc2NyaXB0IGluc3RhbmNlIChpZiBhdHRhY2hlZCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEByZXR1cm5zIHtTY3JpcHRUeXBlfG51bGx9IElmIHNjcmlwdCBpcyBhdHRhY2hlZCwgdGhlIGluc3RhbmNlIGlzIHJldHVybmVkLiBPdGhlcndpc2UgbnVsbFxuICAgICAqIGlzIHJldHVybmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGNvbnRyb2xsZXIgPSBlbnRpdHkuc2NyaXB0LmdldCgncGxheWVyQ29udHJvbGxlcicpO1xuICAgICAqL1xuICAgIGdldChuYW1lT3JUeXBlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZU9yVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9zY3JpcHRzSW5kZXhbbmFtZU9yVHlwZV07XG4gICAgICAgICAgICByZXR1cm4gZGF0YSA/IGRhdGEuaW5zdGFuY2UgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFuYW1lT3JUeXBlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3Qgc2NyaXB0VHlwZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGNvbnN0IHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0RGF0YSA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgY29uc3Qgc2NyaXB0SW5zdGFuY2UgPSBzY3JpcHREYXRhICYmIHNjcmlwdERhdGEuaW5zdGFuY2U7XG4gICAgICAgIHJldHVybiBzY3JpcHRJbnN0YW5jZSBpbnN0YW5jZW9mIHNjcmlwdFR5cGUgPyBzY3JpcHRJbnN0YW5jZSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgc2NyaXB0IGluc3RhbmNlIGFuZCBhdHRhY2ggdG8gYW4gZW50aXR5IHNjcmlwdCBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJnc10gLSBPYmplY3Qgd2l0aCBhcmd1bWVudHMgZm9yIGEgc2NyaXB0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FyZ3MuZW5hYmxlZF0gLSBJZiBzY3JpcHQgaW5zdGFuY2UgaXMgZW5hYmxlZCBhZnRlciBjcmVhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB0cnVlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJncy5hdHRyaWJ1dGVzXSAtIE9iamVjdCB3aXRoIHZhbHVlcyBmb3IgYXR0cmlidXRlcyAoaWYgYW55KSwgd2hlcmUga2V5IGlzXG4gICAgICogbmFtZSBvZiBhbiBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYXJncy5wcmVsb2FkaW5nXSAtIElmIHNjcmlwdCBpbnN0YW5jZSBpcyBjcmVhdGVkIGR1cmluZyBwcmVsb2FkLiBJZiB0cnVlLFxuICAgICAqIHNjcmlwdCBhbmQgYXR0cmlidXRlcyBtdXN0IGJlIGluaXRpYWxpemVkIG1hbnVhbGx5LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3MuaW5kXSAtIFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIHNjcmlwdCBpbnN0YW5jZSBhdC4gRGVmYXVsdHMgdG9cbiAgICAgKiAtMSwgd2hpY2ggbWVhbnMgYXBwZW5kIGl0IGF0IHRoZSBlbmQuXG4gICAgICogQHJldHVybnMge1NjcmlwdFR5cGV8bnVsbH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBhIHtAbGluayBTY3JpcHRUeXBlfSBpZiBzdWNjZXNzZnVsbHkgYXR0YWNoZWRcbiAgICAgKiB0byBhbiBlbnRpdHksIG9yIG51bGwgaWYgaXQgZmFpbGVkIGJlY2F1c2UgYSBzY3JpcHQgd2l0aCBhIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIGFkZGVkXG4gICAgICogb3IgaWYgdGhlIHtAbGluayBTY3JpcHRUeXBlfSBjYW5ub3QgYmUgZm91bmQgYnkgbmFtZSBpbiB0aGUge0BsaW5rIFNjcmlwdFJlZ2lzdHJ5fS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQuY3JlYXRlKCdwbGF5ZXJDb250cm9sbGVyJywge1xuICAgICAqICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICogICAgICAgICBzcGVlZDogNFxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgY3JlYXRlKG5hbWVPclR5cGUsIGFyZ3MgPSB7fSkge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBsZXQgc2NyaXB0VHlwZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcblxuICAgICAgICAvLyBzaG9ydGhhbmQgdXNpbmcgc2NyaXB0IG5hbWVcbiAgICAgICAgaWYgKHR5cGVvZiBzY3JpcHRUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHRUeXBlKTtcbiAgICAgICAgfSBlbHNlIGlmIChzY3JpcHRUeXBlKSB7XG4gICAgICAgICAgICBzY3JpcHROYW1lID0gc2NyaXB0VHlwZS5fX25hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0gfHwgIXRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5pbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBzY3JpcHQgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IG5ldyBzY3JpcHRUeXBlKHtcbiAgICAgICAgICAgICAgICAgICAgYXBwOiB0aGlzLnN5c3RlbS5hcHAsXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eTogdGhpcy5lbnRpdHksXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGFyZ3MuaGFzT3duUHJvcGVydHkoJ2VuYWJsZWQnKSA/IGFyZ3MuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGFyZ3MuYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGluZCA9IC0xO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncy5pbmQgPT09ICdudW1iZXInICYmIGFyZ3MuaW5kICE9PSAtMSAmJiBsZW4gPiBhcmdzLmluZClcbiAgICAgICAgICAgICAgICAgICAgaW5kID0gYXJncy5pbmQ7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbnNlcnRTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSwgaW5kLCBsZW4pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZTogc2NyaXB0SW5zdGFuY2UsXG4gICAgICAgICAgICAgICAgICAgIG9uU3dhcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zd2FwKHNjcmlwdE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHRoaXNbc2NyaXB0TmFtZV0gPSBzY3JpcHRJbnN0YW5jZTtcblxuICAgICAgICAgICAgICAgIGlmICghYXJncy5wcmVsb2FkaW5nKVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fX2luaXRpYWxpemVBdHRyaWJ1dGVzKCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NyZWF0ZScsIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NyZWF0ZTonICsgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMub24oJ3N3YXA6JyArIHNjcmlwdE5hbWUsIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5vblN3YXApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFhcmdzLnByZWxvYWRpbmcpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UuZW5hYmxlZCAmJiAhc2NyaXB0SW5zdGFuY2UuX2luaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UuaW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0SW5zdGFuY2UsIFNjcmlwdENvbXBvbmVudC5zY3JpcHRNZXRob2RzLmluaXRpYWxpemUpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLmVuYWJsZWQgJiYgIXNjcmlwdEluc3RhbmNlLl9wb3N0SW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdEluc3RhbmNlLl9wb3N0SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnBvc3RJbml0aWFsaXplKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHRJbnN0YW5jZSwgU2NyaXB0Q29tcG9uZW50LnNjcmlwdE1ldGhvZHMucG9zdEluaXRpYWxpemUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2NyaXB0SW5zdGFuY2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIERlYnVnLndhcm4oYHNjcmlwdCAnJHtzY3JpcHROYW1lfScgaXMgYWxyZWFkeSBhZGRlZCB0byBlbnRpdHkgJyR7dGhpcy5lbnRpdHkubmFtZX0nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgYXdhaXRpbmc6IHRydWUsXG4gICAgICAgICAgICAgICAgaW5kOiB0aGlzLl9zY3JpcHRzLmxlbmd0aFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgRGVidWcud2Fybihgc2NyaXB0ICcke3NjcmlwdE5hbWV9JyBpcyBub3QgZm91bmQsIGF3YWl0aW5nIGl0IHRvIGJlIGFkZGVkIHRvIHJlZ2lzdHJ5YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IHRoZSBzY3JpcHQgaW5zdGFuY2UgdGhhdCBpcyBhdHRhY2hlZCB0byBhbiBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBJZiBpdCB3YXMgc3VjY2Vzc2Z1bGx5IGRlc3Ryb3llZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQuZGVzdHJveSgncGxheWVyQ29udHJvbGxlcicpO1xuICAgICAqL1xuICAgIGRlc3Ryb3kobmFtZU9yVHlwZSkge1xuICAgICAgICBsZXQgc2NyaXB0TmFtZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGxldCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcblxuICAgICAgICAvLyBzaG9ydGhhbmQgdXNpbmcgc2NyaXB0IG5hbWVcbiAgICAgICAgaWYgKHR5cGVvZiBzY3JpcHRUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHRUeXBlKTtcbiAgICAgICAgfSBlbHNlIGlmIChzY3JpcHRUeXBlKSB7XG4gICAgICAgICAgICBzY3JpcHROYW1lID0gc2NyaXB0VHlwZS5fX25hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBkZWxldGUgdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBpZiAoIXNjcmlwdERhdGEpIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEuaW5zdGFuY2U7XG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZSAmJiAhc2NyaXB0SW5zdGFuY2UuX2Rlc3Ryb3llZCkge1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX2Rlc3Ryb3llZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGFyZSBub3QgY3VycmVudGx5IGxvb3BpbmcgdGhyb3VnaCBvdXIgc2NyaXB0c1xuICAgICAgICAgICAgLy8gdGhlbiBpdCdzIHNhZmUgdG8gcmVtb3ZlIHRoZSBzY3JpcHRcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9yZW1vdmVTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgaWYgKGluZCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoaW5kLCB0aGlzLl9zY3JpcHRzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgcHVzaCB0aGUgc2NyaXB0IGluIF9kZXN0cm95ZWRTY3JpcHRzIGFuZFxuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIF9zY3JpcHRzIHdoZW4gdGhlIGxvb3AgaXMgb3ZlclxuICAgICAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMucHVzaChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgc3dhcCBldmVudFxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NyaXB0cy5vZmYoJ3N3YXA6JyArIHNjcmlwdE5hbWUsIHNjcmlwdERhdGEub25Td2FwKTtcblxuICAgICAgICBkZWxldGUgdGhpc1tzY3JpcHROYW1lXTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSB8fCBudWxsKTtcbiAgICAgICAgdGhpcy5maXJlKCdkZXN0cm95OicgKyBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSB8fCBudWxsKTtcblxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UpXG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5maXJlKCdkZXN0cm95Jyk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3dhcCB0aGUgc2NyaXB0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8U2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGUgbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgaXQgd2FzIHN1Y2Nlc3NmdWxseSBzd2FwcGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3dhcChuYW1lT3JUeXBlKSB7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIC8vIHNob3J0aGFuZCB1c2luZyBzY3JpcHQgbmFtZVxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdFR5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgaWYgKCFvbGQgfHwgIW9sZC5pbnN0YW5jZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlT2xkID0gb2xkLmluc3RhbmNlO1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2VPbGQpO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gbmV3IHNjcmlwdFR5cGUoe1xuICAgICAgICAgICAgYXBwOiB0aGlzLnN5c3RlbS5hcHAsXG4gICAgICAgICAgICBlbnRpdHk6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgZW5hYmxlZDogc2NyaXB0SW5zdGFuY2VPbGQuZW5hYmxlZCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHNjcmlwdEluc3RhbmNlT2xkLl9fYXR0cmlidXRlc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXNjcmlwdEluc3RhbmNlLnN3YXApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuXG4gICAgICAgIC8vIGFkZCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fc2NyaXB0c1tpbmRdID0gc2NyaXB0SW5zdGFuY2U7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5pbnN0YW5jZSA9IHNjcmlwdEluc3RhbmNlO1xuICAgICAgICB0aGlzW3NjcmlwdE5hbWVdID0gc2NyaXB0SW5zdGFuY2U7XG5cbiAgICAgICAgLy8gc2V0IGV4ZWN1dGlvbiBvcmRlciBhbmQgbWFrZSBzdXJlIHdlIHVwZGF0ZVxuICAgICAgICAvLyBvdXIgdXBkYXRlIGFuZCBwb3N0VXBkYXRlIGxpc3RzXG4gICAgICAgIHNjcmlwdEluc3RhbmNlLl9fZXhlY3V0aW9uT3JkZXIgPSBpbmQ7XG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZU9sZC51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2VPbGQucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHRJbnN0YW5jZSwgU2NyaXB0Q29tcG9uZW50LnNjcmlwdE1ldGhvZHMuc3dhcCwgc2NyaXB0SW5zdGFuY2VPbGQpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc3dhcCcsIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgdGhpcy5maXJlKCdzd2FwOicgKyBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hlbiBhbiBlbnRpdHkgaXMgY2xvbmVkIGFuZCBpdCBoYXMgZW50aXR5IHNjcmlwdCBhdHRyaWJ1dGVzIHRoYXQgcG9pbnQgdG8gb3RoZXIgZW50aXRpZXMgaW5cbiAgICAgKiB0aGUgc2FtZSBzdWJ0cmVlIHRoYXQgaXMgY2xvbmVkLCB0aGVuIHdlIHdhbnQgdGhlIG5ldyBzY3JpcHQgYXR0cmlidXRlcyB0byBwb2ludCBhdCB0aGVcbiAgICAgKiBjbG9uZWQgZW50aXRpZXMuIFRoaXMgbWV0aG9kIHJlbWFwcyB0aGUgc2NyaXB0IGF0dHJpYnV0ZXMgZm9yIHRoaXMgZW50aXR5IGFuZCBpdCBhc3N1bWVzXG4gICAgICogdGhhdCB0aGlzIGVudGl0eSBpcyB0aGUgcmVzdWx0IG9mIHRoZSBjbG9uZSBvcGVyYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjcmlwdENvbXBvbmVudH0gb2xkU2NyaXB0Q29tcG9uZW50IC0gVGhlIHNvdXJjZSBzY3JpcHQgY29tcG9uZW50IHRoYXQgYmVsb25ncyB0b1xuICAgICAqIHRoZSBlbnRpdHkgdGhhdCB3YXMgYmVpbmcgY2xvbmVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkdXBsaWNhdGVkSWRzTWFwIC0gQSBkaWN0aW9uYXJ5IHdpdGggZ3VpZC1lbnRpdHkgdmFsdWVzIHRoYXQgY29udGFpbnMgdGhlXG4gICAgICogZW50aXRpZXMgdGhhdCB3ZXJlIGNsb25lZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhvbGRTY3JpcHRDb21wb25lbnQsIGR1cGxpY2F0ZWRJZHNNYXApIHtcbiAgICAgICAgY29uc3QgbmV3U2NyaXB0Q29tcG9uZW50ID0gdGhpcy5lbnRpdHkuc2NyaXB0O1xuXG4gICAgICAgIC8vIGZvciBlYWNoIHNjcmlwdCBpbiB0aGUgb2xkIGNvbXBvbmVudFxuICAgICAgICBmb3IgKGNvbnN0IHNjcmlwdE5hbWUgaW4gb2xkU2NyaXB0Q29tcG9uZW50Ll9zY3JpcHRzSW5kZXgpIHtcbiAgICAgICAgICAgIC8vIGdldCB0aGUgc2NyaXB0IHR5cGUgZnJvbSB0aGUgc2NyaXB0IHJlZ2lzdHJ5XG4gICAgICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdE5hbWUpO1xuICAgICAgICAgICAgaWYgKCFzY3JpcHRUeXBlKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdldCB0aGUgc2NyaXB0IGZyb20gdGhlIGNvbXBvbmVudCdzIGluZGV4XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBvbGRTY3JpcHRDb21wb25lbnQuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0IHx8ICFzY3JpcHQuaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgX19hdHRyaWJ1dGVzUmF3IGV4aXN0cyB0aGVuIGl0IG1lYW5zIHRoYXQgdGhlIG5ldyBlbnRpdHlcbiAgICAgICAgICAgIC8vIGhhcyBub3QgeWV0IGluaXRpYWxpemVkIGl0cyBhdHRyaWJ1dGVzIHNvIHB1dCB0aGUgbmV3IGd1aWQgaW4gdGhlcmUsXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgaXQgbWVhbnMgdGhhdCB0aGUgYXR0cmlidXRlcyBoYXZlIGFscmVhZHkgYmVlbiBpbml0aWFsaXplZFxuICAgICAgICAgICAgLy8gc28gY29udmVydCB0aGUgbmV3IGd1aWQgdG8gYW4gZW50aXR5XG4gICAgICAgICAgICAvLyBhbmQgcHV0IGl0IGluIHRoZSBuZXcgYXR0cmlidXRlc1xuICAgICAgICAgICAgY29uc3QgbmV3QXR0cmlidXRlc1JhdyA9IG5ld1NjcmlwdENvbXBvbmVudFtzY3JpcHROYW1lXS5fX2F0dHJpYnV0ZXNSYXc7XG4gICAgICAgICAgICBjb25zdCBuZXdBdHRyaWJ1dGVzID0gbmV3U2NyaXB0Q29tcG9uZW50W3NjcmlwdE5hbWVdLl9fYXR0cmlidXRlcztcbiAgICAgICAgICAgIGlmICghbmV3QXR0cmlidXRlc1JhdyAmJiAhbmV3QXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB3ZSBhcmUgdXNpbmcgYXR0cmlidXRlc1JhdyB0aGVuIHVzZSB0aGUgZ3VpZCBvdGhlcndpc2UgdXNlIHRoZSBlbnRpdHlcbiAgICAgICAgICAgIGNvbnN0IHVzZUd1aWQgPSAhIW5ld0F0dHJpYnV0ZXNSYXc7XG5cbiAgICAgICAgICAgIC8vIGdldCB0aGUgb2xkIHNjcmlwdCBhdHRyaWJ1dGVzIGZyb20gdGhlIGluc3RhbmNlXG4gICAgICAgICAgICBjb25zdCBvbGRBdHRyaWJ1dGVzID0gc2NyaXB0Lmluc3RhbmNlLl9fYXR0cmlidXRlcztcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXR0cmlidXRlTmFtZSBpbiBvbGRBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFvbGRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGdldCB0aGUgYXR0cmlidXRlIGRlZmluaXRpb24gZnJvbSB0aGUgc2NyaXB0IHR5cGVcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSBzY3JpcHRUeXBlLmF0dHJpYnV0ZXMuZ2V0KGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghYXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ2VudGl0eScpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZW50aXR5IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbGRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0F0dHJpYnV0ZXNSYXcgfHwgbmV3QXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGF0dHJpYnV0ZS50eXBlID09PSAnanNvbicgJiYgQXJyYXkuaXNBcnJheShhdHRyaWJ1dGUuc2NoZW1hKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBqc29uIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSBvbGRBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdKc29uVmFsdWUgPSAobmV3QXR0cmlidXRlc1JhdyA/IG5ld0F0dHJpYnV0ZXNSYXdbYXR0cmlidXRlTmFtZV0gOiBuZXdBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdKTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJpYnV0ZS5zY2hlbWEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpZWxkID0gYXR0cmlidXRlLnNjaGVtYVtpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZC50eXBlICE9PSAnZW50aXR5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlLmFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBvbGRWYWx1ZS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZXNvbHZlRW50aXR5U2NyaXB0QXR0cmlidXRlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWVbal1bZmllbGQubmFtZV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VHdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3SnNvblZhbHVlW2pdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVwbGljYXRlZElkc01hcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlW2ZpZWxkLm5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VHdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdKc29uVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTW92ZSBzY3JpcHQgaW5zdGFuY2UgdG8gZGlmZmVyZW50IHBvc2l0aW9uIHRvIGFsdGVyIHVwZGF0ZSBvcmRlciBvZiBzY3JpcHRzIHdpdGhpbiBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmQgLSBOZXcgcG9zaXRpb24gaW5kZXguXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIGl0IHdhcyBzdWNjZXNzZnVsbHkgbW92ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm1vdmUoJ3BsYXllckNvbnRyb2xsZXInLCAwKTtcbiAgICAgKi9cbiAgICBtb3ZlKG5hbWVPclR5cGUsIGluZCkge1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9zY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgaWYgKGluZCA+PSBsZW4gfHwgaW5kIDwgMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBsZXQgc2NyaXB0VHlwZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcblxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdE5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHROYW1lID0gbmFtZU9yVHlwZS5fX25hbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjcmlwdERhdGEgPSB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgIGlmICghc2NyaXB0RGF0YSB8fCAhc2NyaXB0RGF0YS5pbnN0YW5jZSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBpZiBzY3JpcHQgdHlwZSBzcGVjaWZpZWQsIG1ha2Ugc3VyZSBpbnN0YW5jZSBvZiBzYWlkIHR5cGVcbiAgICAgICAgY29uc3Qgc2NyaXB0SW5zdGFuY2UgPSBzY3JpcHREYXRhLmluc3RhbmNlO1xuICAgICAgICBpZiAoc2NyaXB0VHlwZSAmJiAhKHNjcmlwdEluc3RhbmNlIGluc3RhbmNlb2Ygc2NyaXB0VHlwZSkpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5kT2xkID0gdGhpcy5fc2NyaXB0cy5pbmRleE9mKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgaWYgKGluZE9sZCA9PT0gLTEgfHwgaW5kT2xkID09PSBpbmQpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gbW92ZSBzY3JpcHQgdG8gYW5vdGhlciBwb3NpdGlvblxuICAgICAgICB0aGlzLl9zY3JpcHRzLnNwbGljZShpbmQsIDAsIHRoaXMuX3NjcmlwdHMuc3BsaWNlKGluZE9sZCwgMSlbMF0pO1xuXG4gICAgICAgIC8vIHJlc2V0IGV4ZWN1dGlvbiBvcmRlciBmb3Igc2NyaXB0cyBhbmQgcmUtc29ydCB1cGRhdGUgYW5kIHBvc3RVcGRhdGUgbGlzdHNcbiAgICAgICAgdGhpcy5fcmVzZXRFeGVjdXRpb25PcmRlcigwLCBsZW4pO1xuICAgICAgICB0aGlzLl91cGRhdGVMaXN0LnNvcnQoKTtcbiAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3Quc29ydCgpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnbW92ZScsIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlLCBpbmQsIGluZE9sZCk7XG4gICAgICAgIHRoaXMuZmlyZSgnbW92ZTonICsgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UsIGluZCwgaW5kT2xkKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNjcmlwdENvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlNjcmlwdENvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3NjcmlwdHMiLCJfdXBkYXRlTGlzdCIsIlNvcnRlZExvb3BBcnJheSIsInNvcnRCeSIsIl9wb3N0VXBkYXRlTGlzdCIsIl9zY3JpcHRzSW5kZXgiLCJfZGVzdHJveWVkU2NyaXB0cyIsIl9kZXN0cm95ZWQiLCJfc2NyaXB0c0RhdGEiLCJfb2xkU3RhdGUiLCJfZW5hYmxlZCIsIl9iZWluZ0VuYWJsZWQiLCJfaXNMb29waW5nVGhyb3VnaFNjcmlwdHMiLCJfZXhlY3V0aW9uT3JkZXIiLCJvbiIsIl9vblNldEVuYWJsZWQiLCJzY3JpcHRzIiwidmFsdWUiLCJrZXkiLCJoYXNPd25Qcm9wZXJ0eSIsInNjcmlwdCIsImVuYWJsZWQiLCJhdHRyaWJ1dGVzIiwiYXR0ciIsIlNjcmlwdEF0dHJpYnV0ZXMiLCJyZXNlcnZlZE5hbWVzIiwiaGFzIiwiX19hdHRyaWJ1dGVzIiwic2NyaXB0VHlwZSIsImFwcCIsImdldCIsImFkZCIsImNvbnNvbGUiLCJsb2ciLCJvcmRlciIsIm9sZFZhbHVlIiwiZmlyZSIsIm9uRW5hYmxlIiwiX2NoZWNrU3RhdGUiLCJvblBvc3RTdGF0ZUNoYW5nZSIsIm9uRGlzYWJsZSIsIndhc0xvb3BpbmciLCJfYmVnaW5Mb29waW5nIiwiaSIsImxlbiIsImxlbmd0aCIsIl9pbml0aWFsaXplZCIsIl9wb3N0SW5pdGlhbGl6ZWQiLCJwb3N0SW5pdGlhbGl6ZSIsIl9zY3JpcHRNZXRob2QiLCJzY3JpcHRNZXRob2RzIiwiX2VuZExvb3BpbmciLCJsb29waW5nIiwid2FzTG9vcGluZ0JlZm9yZSIsIl9yZW1vdmVEZXN0cm95ZWRTY3JpcHRzIiwicHJvcCIsIm9sZCIsInN0YXRlIiwiX2FkZENvbXBvbmVudFRvRW5hYmxlZCIsIl9yZW1vdmVDb21wb25lbnRGcm9tRW5hYmxlZCIsIl9vbkJlZm9yZVJlbW92ZSIsImRlc3Ryb3kiLCJfX3NjcmlwdFR5cGUiLCJfX25hbWUiLCJfcmVtb3ZlU2NyaXB0SW5zdGFuY2UiLCJfcmVzZXRFeGVjdXRpb25PcmRlciIsIl9vbkluaXRpYWxpemVBdHRyaWJ1dGVzIiwiX19pbml0aWFsaXplQXR0cmlidXRlcyIsIm1ldGhvZCIsImFyZyIsImV4IiwiX2NhbGxiYWNrcyIsImVycm9yIiwid2FybiIsIl9vbkluaXRpYWxpemUiLCJpbml0aWFsaXplIiwiX29uUG9zdEluaXRpYWxpemUiLCJfb25VcGRhdGUiLCJkdCIsImxpc3QiLCJsb29wSW5kZXgiLCJpdGVtcyIsInVwZGF0ZSIsIl9vblBvc3RVcGRhdGUiLCJwb3N0VXBkYXRlIiwiX2luc2VydFNjcmlwdEluc3RhbmNlIiwic2NyaXB0SW5zdGFuY2UiLCJpbmRleCIsInNjcmlwdHNMZW5ndGgiLCJwdXNoIiwiX19leGVjdXRpb25PcmRlciIsImFwcGVuZCIsInNwbGljZSIsImluc2VydCIsImlkeCIsImluZGV4T2YiLCJyZW1vdmUiLCJzdGFydEluZGV4IiwiX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJhdHRyaWJ1dGVOYW1lIiwidXNlR3VpZCIsIm5ld0F0dHJpYnV0ZXMiLCJkdXBsaWNhdGVkSWRzTWFwIiwiYXJyYXkiLCJuZXdHdWlkQXJyYXkiLCJzbGljZSIsImd1aWQiLCJFbnRpdHkiLCJnZXRHdWlkIiwibmFtZU9yVHlwZSIsInNjcmlwdE5hbWUiLCJzY3JpcHREYXRhIiwiaW5zdGFuY2UiLCJkYXRhIiwiY3JlYXRlIiwiYXJncyIsInNlbGYiLCJpbmQiLCJvblN3YXAiLCJzd2FwIiwicHJlbG9hZGluZyIsIkRlYnVnIiwibmFtZSIsImF3YWl0aW5nIiwib2ZmIiwic2NyaXB0SW5zdGFuY2VPbGQiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJvbGRTY3JpcHRDb21wb25lbnQiLCJuZXdTY3JpcHRDb21wb25lbnQiLCJuZXdBdHRyaWJ1dGVzUmF3IiwiX19hdHRyaWJ1dGVzUmF3Iiwib2xkQXR0cmlidXRlcyIsInR5cGUiLCJBcnJheSIsImlzQXJyYXkiLCJzY2hlbWEiLCJuZXdKc29uVmFsdWUiLCJmaWVsZCIsImoiLCJtb3ZlIiwiaW5kT2xkIiwic29y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
