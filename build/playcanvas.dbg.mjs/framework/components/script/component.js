/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { ScriptAttributes } from '../../script/script-attributes.js';
import { SCRIPT_POST_INITIALIZE, SCRIPT_INITIALIZE, SCRIPT_UPDATE, SCRIPT_POST_UPDATE, SCRIPT_SWAP } from '../../script/constants.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';

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
        if (script.postInitialize) this._scriptMethod(script, SCRIPT_POST_INITIALIZE);
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
        if (script.initialize) this._scriptMethod(script, SCRIPT_INITIALIZE);
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
        this._scriptMethod(script, SCRIPT_UPDATE, dt);
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
        this._scriptMethod(script, SCRIPT_POST_UPDATE, dt);
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
            if (scriptInstance.initialize) this._scriptMethod(scriptInstance, SCRIPT_INITIALIZE);
          }
          if (scriptInstance.enabled && !scriptInstance._postInitialized) {
            scriptInstance._postInitialized = true;
            if (scriptInstance.postInitialize) this._scriptMethod(scriptInstance, SCRIPT_POST_INITIALIZE);
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
    this._scriptMethod(scriptInstance, SCRIPT_SWAP, scriptInstanceOld);
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

export { ScriptComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgU29ydGVkTG9vcEFycmF5IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9zb3J0ZWQtbG9vcC1hcnJheS5qcyc7XG5cbmltcG9ydCB7IFNjcmlwdEF0dHJpYnV0ZXMgfSBmcm9tICcuLi8uLi9zY3JpcHQvc2NyaXB0LWF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHtcbiAgICBTQ1JJUFRfSU5JVElBTElaRSwgU0NSSVBUX1BPU1RfSU5JVElBTElaRSwgU0NSSVBUX1VQREFURSxcbiAgICBTQ1JJUFRfUE9TVF9VUERBVEUsIFNDUklQVF9TV0FQXG59IGZyb20gJy4uLy4uL3NjcmlwdC9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuLyoqXG4gKiBUaGUgU2NyaXB0Q29tcG9uZW50IGFsbG93cyB5b3UgdG8gZXh0ZW5kIHRoZSBmdW5jdGlvbmFsaXR5IG9mIGFuIEVudGl0eSBieSBhdHRhY2hpbmcgeW91ciBvd25cbiAqIFNjcmlwdCBUeXBlcyBkZWZpbmVkIGluIEphdmFTY3JpcHQgZmlsZXMgdG8gYmUgZXhlY3V0ZWQgd2l0aCBhY2Nlc3MgdG8gdGhlIEVudGl0eS4gRm9yIG1vcmVcbiAqIGRldGFpbHMgb24gc2NyaXB0aW5nIHNlZSBbU2NyaXB0aW5nXShodHRwczovL2RldmVsb3Blci5wbGF5Y2FudmFzLmNvbS91c2VyLW1hbnVhbC9zY3JpcHRpbmcvKS5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFNjcmlwdENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjcmlwdENvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlNjcmlwdENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9sZHMgYWxsIHNjcmlwdCBpbnN0YW5jZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlW119XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zY3JpcHRzID0gW107XG4gICAgICAgIC8vIGhvbGRzIGFsbCBzY3JpcHQgaW5zdGFuY2VzIHdpdGggYW4gdXBkYXRlIG1ldGhvZFxuICAgICAgICB0aGlzLl91cGRhdGVMaXN0ID0gbmV3IFNvcnRlZExvb3BBcnJheSh7IHNvcnRCeTogJ19fZXhlY3V0aW9uT3JkZXInIH0pO1xuICAgICAgICAvLyBob2xkcyBhbGwgc2NyaXB0IGluc3RhbmNlcyB3aXRoIGEgcG9zdFVwZGF0ZSBtZXRob2RcbiAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QgPSBuZXcgU29ydGVkTG9vcEFycmF5KHsgc29ydEJ5OiAnX19leGVjdXRpb25PcmRlcicgfSk7XG5cbiAgICAgICAgdGhpcy5fc2NyaXB0c0luZGV4ID0ge307XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMgPSBbXTtcbiAgICAgICAgdGhpcy5fZGVzdHJveWVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNEYXRhID0gbnVsbDtcbiAgICAgICAgdGhpcy5fb2xkU3RhdGUgPSB0cnVlO1xuXG4gICAgICAgIC8vIG92ZXJyaWRlIGRlZmF1bHQgJ2VuYWJsZWQnIHByb3BlcnR5IG9mIGJhc2UgcGMuQ29tcG9uZW50XG4gICAgICAgIC8vIGJlY2F1c2UgdGhpcyBpcyBmYXN0ZXJcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gd2hldGhlciB0aGlzIGNvbXBvbmVudCBpcyBjdXJyZW50bHkgYmVpbmcgZW5hYmxlZFxuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgLy8gaWYgdHJ1ZSB0aGVuIHdlIGFyZSBjdXJyZW50bHkgbG9vcGluZyB0aHJvdWdoXG4gICAgICAgIC8vIHNjcmlwdCBpbnN0YW5jZXMuIFRoaXMgaXMgdXNlZCB0byBwcmV2ZW50IGEgc2NyaXB0cyBhcnJheVxuICAgICAgICAvLyBmcm9tIGJlaW5nIG1vZGlmaWVkIHdoaWxlIGEgbG9vcCBpcyBiZWluZyBleGVjdXRlZFxuICAgICAgICB0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHRoZSBvcmRlciB0aGF0IHRoaXMgY29tcG9uZW50IHdpbGwgYmUgdXBkYXRlZFxuICAgICAgICAvLyBieSB0aGUgc2NyaXB0IHN5c3RlbS4gVGhpcyBpcyBzZXQgYnkgdGhlIHN5c3RlbSBpdHNlbGYuXG4gICAgICAgIHRoaXMuX2V4ZWN1dGlvbk9yZGVyID0gLTE7XG5cbiAgICAgICAgdGhpcy5vbignc2V0X2VuYWJsZWQnLCB0aGlzLl9vblNldEVuYWJsZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gQ29tcG9uZW50IGJlY29tZXMgZW5hYmxlZC4gTm90ZTogdGhpcyBldmVudCBkb2VzIG5vdCB0YWtlIGluIGFjY291bnQgZW50aXR5IG9yXG4gICAgICogYW55IG9mIGl0cyBwYXJlbnQgZW5hYmxlZCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjZW5hYmxlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdlbmFibGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIENvbXBvbmVudCBiZWNvbWVzIGRpc2FibGVkLiBOb3RlOiB0aGlzIGV2ZW50IGRvZXMgbm90IHRha2UgaW4gYWNjb3VudCBlbnRpdHkgb3JcbiAgICAgKiBhbnkgb2YgaXRzIHBhcmVudCBlbmFibGVkIHN0YXRlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNkaXNhYmxlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdkaXNhYmxlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBjb21wb25lbnQgaXMgZGlzYWJsZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gQ29tcG9uZW50IGNoYW5nZXMgc3RhdGUgdG8gZW5hYmxlZCBvciBkaXNhYmxlZC4gTm90ZTogdGhpcyBldmVudCBkb2VzIG5vdCB0YWtlIGluXG4gICAgICogYWNjb3VudCBlbnRpdHkgb3IgYW55IG9mIGl0cyBwYXJlbnQgZW5hYmxlZCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjc3RhdGVcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWQgLSBUcnVlIGlmIG5vdyBlbmFibGVkLCBGYWxzZSBpZiBkaXNhYmxlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ3N0YXRlJywgZnVuY3Rpb24gKGVuYWJsZWQpIHtcbiAgICAgKiAgICAgLy8gY29tcG9uZW50IGNoYW5nZWQgc3RhdGVcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gQ29tcG9uZW50IGlzIHJlbW92ZWQgZnJvbSBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I3JlbW92ZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbigncmVtb3ZlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBlbnRpdHkgaGFzIG5vIG1vcmUgc2NyaXB0IGNvbXBvbmVudFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBpcyBjcmVhdGVkIGFuZCBhdHRhY2hlZCB0byBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I2NyZWF0ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIFNjcmlwdCBUeXBlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZlxuICAgICAqIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBjcmVhdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignY3JlYXRlJywgZnVuY3Rpb24gKG5hbWUsIHNjcmlwdEluc3RhbmNlKSB7XG4gICAgICogICAgIC8vIG5ldyBzY3JpcHQgaW5zdGFuY2UgYWRkZWQgdG8gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGNyZWF0ZWQgYW5kIGF0dGFjaGVkIHRvIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjY3JlYXRlOltuYW1lXVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZlxuICAgICAqIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBjcmVhdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignY3JlYXRlOnBsYXllckNvbnRyb2xsZXInLCBmdW5jdGlvbiAoc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgKiAgICAgLy8gbmV3IHNjcmlwdCBpbnN0YW5jZSAncGxheWVyQ29udHJvbGxlcicgaXMgYWRkZWQgdG8gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGRlc3Ryb3llZCBhbmQgcmVtb3ZlZCBmcm9tIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjZGVzdHJveVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIFNjcmlwdCBUeXBlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZlxuICAgICAqIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBkZXN0cm95ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdkZXN0cm95JywgZnVuY3Rpb24gKG5hbWUsIHNjcmlwdEluc3RhbmNlKSB7XG4gICAgICogICAgIC8vIHNjcmlwdCBpbnN0YW5jZSBoYXMgYmVlbiBkZXN0cm95ZWQgYW5kIHJlbW92ZWQgZnJvbSBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgZGVzdHJveWVkIGFuZCByZW1vdmVkIGZyb20gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNkZXN0cm95OltuYW1lXVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZlxuICAgICAqIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBkZXN0cm95ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdkZXN0cm95OnBsYXllckNvbnRyb2xsZXInLCBmdW5jdGlvbiAoc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgKiAgICAgLy8gc2NyaXB0IGluc3RhbmNlICdwbGF5ZXJDb250cm9sbGVyJyBoYXMgYmVlbiBkZXN0cm95ZWQgYW5kIHJlbW92ZWQgZnJvbSBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgbW92ZWQgaW4gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNtb3ZlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgU2NyaXB0IFR5cGUuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGV9IHNjcmlwdEluc3RhbmNlIC0gVGhlIGluc3RhbmNlIG9mXG4gICAgICogdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IGhhcyBiZWVuIG1vdmVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmQgLSBOZXcgcG9zaXRpb24gaW5kZXguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZE9sZCAtIE9sZCBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ21vdmUnLCBmdW5jdGlvbiAobmFtZSwgc2NyaXB0SW5zdGFuY2UsIGluZCwgaW5kT2xkKSB7XG4gICAgICogICAgIC8vIHNjcmlwdCBpbnN0YW5jZSBoYXMgYmVlbiBtb3ZlZCBpbiBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgbW92ZWQgaW4gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNtb3ZlOltuYW1lXVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZlxuICAgICAqIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBtb3ZlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kIC0gTmV3IHBvc2l0aW9uIGluZGV4LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRPbGQgLSBPbGQgcG9zaXRpb24gaW5kZXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdtb3ZlOnBsYXllckNvbnRyb2xsZXInLCBmdW5jdGlvbiAoc2NyaXB0SW5zdGFuY2UsIGluZCwgaW5kT2xkKSB7XG4gICAgICogICAgIC8vIHNjcmlwdCBpbnN0YW5jZSAncGxheWVyQ29udHJvbGxlcicgaGFzIGJlZW4gbW92ZWQgaW4gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGhhZCBhbiBleGNlcHRpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I2Vycm9yXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGV9IHNjcmlwdEluc3RhbmNlIC0gVGhlIGluc3RhbmNlIG9mXG4gICAgICogdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IHJhaXNlZCB0aGUgZXhjZXB0aW9uLlxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVyciAtIE5hdGl2ZSBKUyBFcnJvciBvYmplY3Qgd2l0aCBkZXRhaWxzIG9mIGFuIGVycm9yLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgLSBUaGUgbWV0aG9kIG9mIHRoZSBzY3JpcHQgaW5zdGFuY2UgdGhhdCB0aGUgZXhjZXB0aW9uIG9yaWdpbmF0ZWQgZnJvbS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2Vycm9yJywgZnVuY3Rpb24gKHNjcmlwdEluc3RhbmNlLCBlcnIsIG1ldGhvZCkge1xuICAgICAqICAgICAvLyBzY3JpcHQgaW5zdGFuY2UgY2F1Z2h0IGFuIGV4Y2VwdGlvblxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgYWxsIHNjcmlwdCBpbnN0YW5jZXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LiBUaGlzIGFycmF5IGlzIHJlYWQtb25seSBhbmQgc2hvdWxkXG4gICAgICogbm90IGJlIG1vZGlmaWVkIGJ5IGRldmVsb3Blci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGVbXX1cbiAgICAgKi9cbiAgICBzZXQgc2NyaXB0cyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zY3JpcHRzRGF0YSA9IHZhbHVlO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoIXZhbHVlLmhhc093blByb3BlcnR5KGtleSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuX3NjcmlwdHNJbmRleFtrZXldO1xuICAgICAgICAgICAgaWYgKHNjcmlwdCkge1xuICAgICAgICAgICAgICAgIC8vIGV4aXN0aW5nIHNjcmlwdFxuXG4gICAgICAgICAgICAgICAgLy8gZW5hYmxlZFxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWVba2V5XS5lbmFibGVkID09PSAnYm9vbGVhbicpXG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdC5lbmFibGVkID0gISF2YWx1ZVtrZXldLmVuYWJsZWQ7XG5cbiAgICAgICAgICAgICAgICAvLyBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZVtrZXldLmF0dHJpYnV0ZXMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYXR0ciBpbiB2YWx1ZVtrZXldLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChTY3JpcHRBdHRyaWJ1dGVzLnJlc2VydmVkTmFtZXMuaGFzKGF0dHIpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNjcmlwdC5fX2F0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXcgYXR0cmlidXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChrZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzY3JpcHRUeXBlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRUeXBlLmF0dHJpYnV0ZXMuYWRkKGF0dHIsIHsgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBhdHRyaWJ1dGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdFthdHRyXSA9IHZhbHVlW2tleV0uYXR0cmlidXRlc1thdHRyXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyBzY3JpcHRzMlxuICAgICAgICAgICAgICAgIC8vIG5ldyBzY3JpcHRcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLm9yZGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzY3JpcHRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2NyaXB0cztcbiAgICB9XG5cbiAgICBzZXQgZW5hYmxlZCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX2VuYWJsZWQ7XG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQnLCAnZW5hYmxlZCcsIG9sZFZhbHVlLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jaGVja1N0YXRlKCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVudGl0eS5fYmVpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLm9uUG9zdFN0YXRlQ2hhbmdlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX2NoZWNrU3RhdGUoKTtcbiAgICB9XG5cbiAgICBvblBvc3RTdGF0ZUNoYW5nZSgpIHtcbiAgICAgICAgY29uc3Qgd2FzTG9vcGluZyA9IHRoaXMuX2JlZ2luTG9vcGluZygpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLnNjcmlwdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuc2NyaXB0c1tpXTtcblxuICAgICAgICAgICAgaWYgKHNjcmlwdC5faW5pdGlhbGl6ZWQgJiYgIXNjcmlwdC5fcG9zdEluaXRpYWxpemVkICYmIHNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgc2NyaXB0Ll9wb3N0SW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdC5wb3N0SW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdCwgU0NSSVBUX1BPU1RfSU5JVElBTElaRSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIC8vIFNldHMgaXNMb29waW5nVGhyb3VnaFNjcmlwdHMgdG8gZmFsc2UgYW5kIHJldHVybnNcbiAgICAvLyBpdHMgcHJldmlvdXMgdmFsdWVcbiAgICBfYmVnaW5Mb29waW5nKCkge1xuICAgICAgICBjb25zdCBsb29waW5nID0gdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHM7XG4gICAgICAgIHRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGxvb3Bpbmc7XG4gICAgfVxuXG4gICAgLy8gUmVzdG9yZXMgaXNMb29waW5nVGhyb3VnaFNjcmlwdHMgdG8gdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXJcbiAgICAvLyBJZiBhbGwgbG9vcHMgYXJlIG92ZXIgdGhlbiByZW1vdmUgZGVzdHJveWVkIHNjcmlwdHMgZm9ybSB0aGUgX3NjcmlwdHMgYXJyYXlcbiAgICBfZW5kTG9vcGluZyh3YXNMb29waW5nQmVmb3JlKSB7XG4gICAgICAgIHRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzID0gd2FzTG9vcGluZ0JlZm9yZTtcbiAgICAgICAgaWYgKCF0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cykge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlRGVzdHJveWVkU2NyaXB0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2UgYWxzbyBuZWVkIHRoaXMgaGFuZGxlciBiZWNhdXNlIGl0IGlzIGZpcmVkXG4gICAgLy8gd2hlbiB2YWx1ZSA9PT0gb2xkIGluc3RlYWQgb2Ygb25FbmFibGUgYW5kIG9uRGlzYWJsZVxuICAgIC8vIHdoaWNoIGFyZSBvbmx5IGZpcmVkIHdoZW4gdmFsdWUgIT09IG9sZFxuICAgIF9vblNldEVuYWJsZWQocHJvcCwgb2xkLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLl9iZWluZ0VuYWJsZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jaGVja1N0YXRlKCk7XG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIF9jaGVja1N0YXRlKCkge1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgICAgICBpZiAoc3RhdGUgPT09IHRoaXMuX29sZFN0YXRlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX29sZFN0YXRlID0gc3RhdGU7XG5cbiAgICAgICAgdGhpcy5maXJlKHN0YXRlID8gJ2VuYWJsZScgOiAnZGlzYWJsZScpO1xuICAgICAgICB0aGlzLmZpcmUoJ3N0YXRlJywgc3RhdGUpO1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2FkZENvbXBvbmVudFRvRW5hYmxlZCh0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9yZW1vdmVDb21wb25lbnRGcm9tRW5hYmxlZCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLnNjcmlwdHNbaV07XG4gICAgICAgICAgICBzY3JpcHQuZW5hYmxlZCA9IHNjcmlwdC5fZW5hYmxlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgX29uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScpO1xuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICAvLyBkZXN0cm95IGFsbCBzY3JpcHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLnNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdCkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveShzY3JpcHQuX19zY3JpcHRUeXBlLl9fbmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIF9yZW1vdmVEZXN0cm95ZWRTY3JpcHRzKCkge1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9kZXN0cm95ZWRTY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgaWYgKCFsZW4pIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSB0aGlzLl9kZXN0cm95ZWRTY3JpcHRzW2ldO1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlU2NyaXB0SW5zdGFuY2Uoc2NyaXB0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyB1cGRhdGUgZXhlY3V0aW9uIG9yZGVyIGZvciBzY3JpcHRzXG4gICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoMCwgdGhpcy5fc2NyaXB0cy5sZW5ndGgpO1xuICAgIH1cblxuICAgIF9vbkluaXRpYWxpemVBdHRyaWJ1dGVzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5zY3JpcHRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgICAgdGhpcy5zY3JpcHRzW2ldLl9faW5pdGlhbGl6ZUF0dHJpYnV0ZXMoKTtcbiAgICB9XG5cbiAgICBfc2NyaXB0TWV0aG9kKHNjcmlwdCwgbWV0aG9kLCBhcmcpIHtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICB0cnkge1xuICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgIHNjcmlwdFttZXRob2RdKGFyZyk7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIC8vIGRpc2FibGUgc2NyaXB0IGlmIGl0IGZhaWxzIHRvIGNhbGwgbWV0aG9kXG4gICAgICAgICAgICBzY3JpcHQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoIXNjcmlwdC5fY2FsbGJhY2tzIHx8ICFzY3JpcHQuX2NhbGxiYWNrcy5lcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgdW5oYW5kbGVkIGV4Y2VwdGlvbiB3aGlsZSBjYWxsaW5nIFwiJHttZXRob2R9XCIgZm9yIFwiJHtzY3JpcHQuX19zY3JpcHRUeXBlLl9fbmFtZX1cIiBzY3JpcHQ6IGAsIGV4KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGV4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NyaXB0LmZpcmUoJ2Vycm9yJywgZXgsIG1ldGhvZCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgc2NyaXB0LCBleCwgbWV0aG9kKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBfb25Jbml0aWFsaXplKCkge1xuICAgICAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5fc2NyaXB0cztcblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHNjcmlwdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHNjcmlwdHNbaV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdC5faW5pdGlhbGl6ZWQgJiYgc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBzY3JpcHQuX2luaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LmluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHQsIFNDUklQVF9JTklUSUFMSVpFKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgX29uUG9zdEluaXRpYWxpemUoKSB7XG4gICAgICAgIHRoaXMub25Qb3N0U3RhdGVDaGFuZ2UoKTtcbiAgICB9XG5cbiAgICBfb25VcGRhdGUoZHQpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMuX3VwZGF0ZUxpc3Q7XG4gICAgICAgIGlmICghbGlzdC5sZW5ndGgpIHJldHVybjtcblxuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsaXN0Lmxvb3BJbmRleCA9IDA7IGxpc3QubG9vcEluZGV4IDwgbGlzdC5sZW5ndGg7IGxpc3QubG9vcEluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGxpc3QuaXRlbXNbbGlzdC5sb29wSW5kZXhdO1xuICAgICAgICAgICAgaWYgKHNjcmlwdC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdCwgU0NSSVBUX1VQREFURSwgZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICBfb25Qb3N0VXBkYXRlKGR0KSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLl9wb3N0VXBkYXRlTGlzdDtcbiAgICAgICAgaWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxpc3QubG9vcEluZGV4ID0gMDsgbGlzdC5sb29wSW5kZXggPCBsaXN0Lmxlbmd0aDsgbGlzdC5sb29wSW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gbGlzdC5pdGVtc1tsaXN0Lmxvb3BJbmRleF07XG4gICAgICAgICAgICBpZiAoc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0LCBTQ1JJUFRfUE9TVF9VUERBVEUsIGR0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBzY3JpcHQgaW5zdGFuY2UgaW50byB0aGUgc2NyaXB0cyBhcnJheSBhdCB0aGUgc3BlY2lmaWVkIGluZGV4LiBBbHNvIGluc2VydHMgdGhlXG4gICAgICogc2NyaXB0IGludG8gdGhlIHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhbiB1cGRhdGUgbWV0aG9kIGFuZCB0aGUgcG9zdCB1cGRhdGUgbGlzdCBpZiBpdCBoYXMgYVxuICAgICAqIHBvc3RVcGRhdGUgbWV0aG9kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNjcmlwdEluc3RhbmNlIC0gVGhlIHNjcmlwdCBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggd2hlcmUgdG8gaW5zZXJ0IHRoZSBzY3JpcHQgYXQuIElmIC0xLCBhcHBlbmQgaXQgYXQgdGhlIGVuZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NyaXB0c0xlbmd0aCAtIFRoZSBsZW5ndGggb2YgdGhlIHNjcmlwdHMgYXJyYXkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW5zZXJ0U2NyaXB0SW5zdGFuY2Uoc2NyaXB0SW5zdGFuY2UsIGluZGV4LCBzY3JpcHRzTGVuZ3RoKSB7XG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIC8vIGFwcGVuZCBzY3JpcHQgYXQgdGhlIGVuZCBhbmQgc2V0IGV4ZWN1dGlvbiBvcmRlclxuICAgICAgICAgICAgdGhpcy5fc2NyaXB0cy5wdXNoKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIHNjcmlwdEluc3RhbmNlLl9fZXhlY3V0aW9uT3JkZXIgPSBzY3JpcHRzTGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBhcHBlbmQgc2NyaXB0IHRvIHRoZSB1cGRhdGUgbGlzdCBpZiBpdCBoYXMgYW4gdXBkYXRlIG1ldGhvZFxuICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnVwZGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QuYXBwZW5kKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYWRkIHNjcmlwdCB0byB0aGUgcG9zdFVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhIHBvc3RVcGRhdGUgbWV0aG9kXG4gICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc3RVcGRhdGVMaXN0LmFwcGVuZChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBpbnNlcnQgc2NyaXB0IGF0IGluZGV4IGFuZCBzZXQgZXhlY3V0aW9uIG9yZGVyXG4gICAgICAgICAgICB0aGlzLl9zY3JpcHRzLnNwbGljZShpbmRleCwgMCwgc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19leGVjdXRpb25PcmRlciA9IGluZGV4O1xuXG4gICAgICAgICAgICAvLyBub3cgd2UgYWxzbyBuZWVkIHRvIHVwZGF0ZSB0aGUgZXhlY3V0aW9uIG9yZGVyIG9mIGFsbFxuICAgICAgICAgICAgLy8gdGhlIHNjcmlwdCBpbnN0YW5jZXMgdGhhdCBjb21lIGFmdGVyIHRoaXMgc2NyaXB0XG4gICAgICAgICAgICB0aGlzLl9yZXNldEV4ZWN1dGlvbk9yZGVyKGluZGV4ICsgMSwgc2NyaXB0c0xlbmd0aCArIDEpO1xuXG4gICAgICAgICAgICAvLyBpbnNlcnQgc2NyaXB0IHRvIHRoZSB1cGRhdGUgbGlzdCBpZiBpdCBoYXMgYW4gdXBkYXRlIG1ldGhvZFxuICAgICAgICAgICAgLy8gaW4gdGhlIHJpZ2h0IG9yZGVyXG4gICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UudXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGlzdC5pbnNlcnQoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpbnNlcnQgc2NyaXB0IHRvIHRoZSBwb3N0VXBkYXRlIGxpc3QgaWYgaXQgaGFzIGEgcG9zdFVwZGF0ZSBtZXRob2RcbiAgICAgICAgICAgIC8vIGluIHRoZSByaWdodCBvcmRlclxuICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb3N0VXBkYXRlTGlzdC5pbnNlcnQoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbW92ZVNjcmlwdEluc3RhbmNlKHNjcmlwdEluc3RhbmNlKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX3NjcmlwdHMuaW5kZXhPZihzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIGlmIChpZHggPT09IC0xKSByZXR1cm4gaWR4O1xuXG4gICAgICAgIHRoaXMuX3NjcmlwdHMuc3BsaWNlKGlkeCwgMSk7XG5cbiAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGlzdC5yZW1vdmUoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLnBvc3RVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Bvc3RVcGRhdGVMaXN0LnJlbW92ZShzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaWR4O1xuICAgIH1cblxuICAgIF9yZXNldEV4ZWN1dGlvbk9yZGVyKHN0YXJ0SW5kZXgsIHNjcmlwdHNMZW5ndGgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCBzY3JpcHRzTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3NjcmlwdHNbaV0uX19leGVjdXRpb25PcmRlciA9IGk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZShhdHRyaWJ1dGUsIGF0dHJpYnV0ZU5hbWUsIG9sZFZhbHVlLCB1c2VHdWlkLCBuZXdBdHRyaWJ1dGVzLCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGUuYXJyYXkpIHtcbiAgICAgICAgICAgIC8vIGhhbmRsZSBlbnRpdHkgYXJyYXkgYXR0cmlidXRlXG4gICAgICAgICAgICBjb25zdCBsZW4gPSBvbGRWYWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICBpZiAoIWxlbikge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3R3VpZEFycmF5ID0gb2xkVmFsdWUuc2xpY2UoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBndWlkID0gbmV3R3VpZEFycmF5W2ldIGluc3RhbmNlb2YgRW50aXR5ID8gbmV3R3VpZEFycmF5W2ldLmdldEd1aWQoKSA6IG5ld0d1aWRBcnJheVtpXTtcbiAgICAgICAgICAgICAgICBpZiAoZHVwbGljYXRlZElkc01hcFtndWlkXSkge1xuICAgICAgICAgICAgICAgICAgICBuZXdHdWlkQXJyYXlbaV0gPSB1c2VHdWlkID8gZHVwbGljYXRlZElkc01hcFtndWlkXS5nZXRHdWlkKCkgOiBkdXBsaWNhdGVkSWRzTWFwW2d1aWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3QXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IG5ld0d1aWRBcnJheTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGhhbmRsZSByZWd1bGFyIGVudGl0eSBhdHRyaWJ1dGVcbiAgICAgICAgICAgIGlmIChvbGRWYWx1ZSBpbnN0YW5jZW9mIEVudGl0eSkge1xuICAgICAgICAgICAgICAgIG9sZFZhbHVlID0gb2xkVmFsdWUuZ2V0R3VpZCgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb2xkVmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZHVwbGljYXRlZElkc01hcFtvbGRWYWx1ZV0pIHtcbiAgICAgICAgICAgICAgICBuZXdBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gZHVwbGljYXRlZElkc01hcFtvbGRWYWx1ZV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlY3QgaWYgc2NyaXB0IGlzIGF0dGFjaGVkIHRvIGFuIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfENsYXNzPGltcG9ydCgnLi4vLi4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGVcbiAgICAgKiBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBJZiBzY3JpcHQgaXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGVudGl0eS5zY3JpcHQuaGFzKCdwbGF5ZXJDb250cm9sbGVyJykpIHtcbiAgICAgKiAgICAgLy8gZW50aXR5IGhhcyBzY3JpcHRcbiAgICAgKiB9XG4gICAgICovXG4gICAgaGFzKG5hbWVPclR5cGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lT3JUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcmV0dXJuICEhdGhpcy5fc2NyaXB0c0luZGV4W25hbWVPclR5cGVdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFuYW1lT3JUeXBlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuICAgICAgICBjb25zdCBzY3JpcHROYW1lID0gc2NyaXB0VHlwZS5fX25hbWU7XG4gICAgICAgIGNvbnN0IHNjcmlwdERhdGEgPSB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gc2NyaXB0RGF0YSAmJiBzY3JpcHREYXRhLmluc3RhbmNlO1xuICAgICAgICByZXR1cm4gc2NyaXB0SW5zdGFuY2UgaW5zdGFuY2VvZiBzY3JpcHRUeXBlOyAvLyB3aWxsIHJldHVybiBmYWxzZSBpZiBzY3JpcHRJbnN0YW5jZSB1bmRlZmluZWRcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzY3JpcHQgaW5zdGFuY2UgKGlmIGF0dGFjaGVkKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfENsYXNzPGltcG9ydCgnLi4vLi4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGVcbiAgICAgKiBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGV8bnVsbH0gSWYgc2NyaXB0IGlzIGF0dGFjaGVkLCB0aGVcbiAgICAgKiBpbnN0YW5jZSBpcyByZXR1cm5lZC4gT3RoZXJ3aXNlIG51bGwgaXMgcmV0dXJuZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgY29udHJvbGxlciA9IGVudGl0eS5zY3JpcHQuZ2V0KCdwbGF5ZXJDb250cm9sbGVyJyk7XG4gICAgICovXG4gICAgZ2V0KG5hbWVPclR5cGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lT3JUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuX3NjcmlwdHNJbmRleFtuYW1lT3JUeXBlXTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhID8gZGF0YS5pbnN0YW5jZSA6IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW5hbWVPclR5cGUpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEgJiYgc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlIGluc3RhbmNlb2Ygc2NyaXB0VHlwZSA/IHNjcmlwdEluc3RhbmNlIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBzY3JpcHQgaW5zdGFuY2UgYW5kIGF0dGFjaCB0byBhbiBlbnRpdHkgc2NyaXB0IGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfENsYXNzPGltcG9ydCgnLi4vLi4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGVcbiAgICAgKiBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJnc10gLSBPYmplY3Qgd2l0aCBhcmd1bWVudHMgZm9yIGEgc2NyaXB0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FyZ3MuZW5hYmxlZF0gLSBJZiBzY3JpcHQgaW5zdGFuY2UgaXMgZW5hYmxlZCBhZnRlciBjcmVhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB0cnVlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJncy5hdHRyaWJ1dGVzXSAtIE9iamVjdCB3aXRoIHZhbHVlcyBmb3IgYXR0cmlidXRlcyAoaWYgYW55KSwgd2hlcmUga2V5IGlzXG4gICAgICogbmFtZSBvZiBhbiBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYXJncy5wcmVsb2FkaW5nXSAtIElmIHNjcmlwdCBpbnN0YW5jZSBpcyBjcmVhdGVkIGR1cmluZyBwcmVsb2FkLiBJZiB0cnVlLFxuICAgICAqIHNjcmlwdCBhbmQgYXR0cmlidXRlcyBtdXN0IGJlIGluaXRpYWxpemVkIG1hbnVhbGx5LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3MuaW5kXSAtIFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIHNjcmlwdCBpbnN0YW5jZSBhdC4gRGVmYXVsdHMgdG9cbiAgICAgKiAtMSwgd2hpY2ggbWVhbnMgYXBwZW5kIGl0IGF0IHRoZSBlbmQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vLi4vc2NyaXB0L3NjcmlwdC10eXBlLmpzJykuU2NyaXB0VHlwZXxudWxsfSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIGFcbiAgICAgKiB7QGxpbmsgU2NyaXB0VHlwZX0gaWYgc3VjY2Vzc2Z1bGx5IGF0dGFjaGVkIHRvIGFuIGVudGl0eSwgb3IgbnVsbCBpZiBpdCBmYWlsZWQgYmVjYXVzZSBhXG4gICAgICogc2NyaXB0IHdpdGggYSBzYW1lIG5hbWUgaGFzIGFscmVhZHkgYmVlbiBhZGRlZCBvciBpZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IGNhbm5vdCBiZSBmb3VuZFxuICAgICAqIGJ5IG5hbWUgaW4gdGhlIHtAbGluayBTY3JpcHRSZWdpc3RyeX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0LmNyZWF0ZSgncGxheWVyQ29udHJvbGxlcicsIHtcbiAgICAgKiAgICAgYXR0cmlidXRlczoge1xuICAgICAqICAgICAgICAgc3BlZWQ6IDRcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNyZWF0ZShuYW1lT3JUeXBlLCBhcmdzID0ge30pIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuICAgICAgICBsZXQgc2NyaXB0TmFtZSA9IG5hbWVPclR5cGU7XG5cbiAgICAgICAgLy8gc2hvcnRoYW5kIHVzaW5nIHNjcmlwdCBuYW1lXG4gICAgICAgIGlmICh0eXBlb2Ygc2NyaXB0VHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHNjcmlwdFR5cGUgPSB0aGlzLnN5c3RlbS5hcHAuc2NyaXB0cy5nZXQoc2NyaXB0VHlwZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdIHx8ICF0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0uaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgc2NyaXB0IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0SW5zdGFuY2UgPSBuZXcgc2NyaXB0VHlwZSh7XG4gICAgICAgICAgICAgICAgICAgIGFwcDogdGhpcy5zeXN0ZW0uYXBwLFxuICAgICAgICAgICAgICAgICAgICBlbnRpdHk6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBhcmdzLmhhc093blByb3BlcnR5KCdlbmFibGVkJykgPyBhcmdzLmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBhcmdzLmF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX3NjcmlwdHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGxldCBpbmQgPSAtMTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3MuaW5kID09PSAnbnVtYmVyJyAmJiBhcmdzLmluZCAhPT0gLTEgJiYgbGVuID4gYXJncy5pbmQpXG4gICAgICAgICAgICAgICAgICAgIGluZCA9IGFyZ3MuaW5kO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5faW5zZXJ0U2NyaXB0SW5zdGFuY2Uoc2NyaXB0SW5zdGFuY2UsIGluZCwgbGVuKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2U6IHNjcmlwdEluc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBvblN3YXA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc3dhcChzY3JpcHROYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB0aGlzW3NjcmlwdE5hbWVdID0gc2NyaXB0SW5zdGFuY2U7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MucHJlbG9hZGluZylcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdjcmVhdGUnLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdjcmVhdGU6JyArIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLm9uKCdzd2FwOicgKyBzY3JpcHROYW1lLCB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0ub25Td2FwKTtcblxuICAgICAgICAgICAgICAgIGlmICghYXJncy5wcmVsb2FkaW5nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLmVuYWJsZWQgJiYgIXNjcmlwdEluc3RhbmNlLl9pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX2luaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlLmluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdEluc3RhbmNlLCBTQ1JJUFRfSU5JVElBTElaRSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UuZW5hYmxlZCAmJiAhc2NyaXB0SW5zdGFuY2UuX3Bvc3RJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX3Bvc3RJbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdEluaXRpYWxpemUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdEluc3RhbmNlLCBTQ1JJUFRfUE9TVF9JTklUSUFMSVpFKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBzY3JpcHQgJyR7c2NyaXB0TmFtZX0nIGlzIGFscmVhZHkgYWRkZWQgdG8gZW50aXR5ICcke3RoaXMuZW50aXR5Lm5hbWV9J2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIGF3YWl0aW5nOiB0cnVlLFxuICAgICAgICAgICAgICAgIGluZDogdGhpcy5fc2NyaXB0cy5sZW5ndGhcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIERlYnVnLndhcm4oYHNjcmlwdCAnJHtzY3JpcHROYW1lfScgaXMgbm90IGZvdW5kLCBhd2FpdGluZyBpdCB0byBiZSBhZGRlZCB0byByZWdpc3RyeWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgc2NyaXB0IGluc3RhbmNlIHRoYXQgaXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZVxuICAgICAqIG5hbWUgb3IgdHlwZSBvZiB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IElmIGl0IHdhcyBzdWNjZXNzZnVsbHkgZGVzdHJveWVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5kZXN0cm95KCdwbGF5ZXJDb250cm9sbGVyJyk7XG4gICAgICovXG4gICAgZGVzdHJveShuYW1lT3JUeXBlKSB7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIC8vIHNob3J0aGFuZCB1c2luZyBzY3JpcHQgbmFtZVxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdFR5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjcmlwdERhdGEgPSB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgIGlmICghc2NyaXB0RGF0YSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgaWYgKHNjcmlwdEluc3RhbmNlICYmICFzY3JpcHRJbnN0YW5jZS5fZGVzdHJveWVkKSB7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fZGVzdHJveWVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIG5vdCBjdXJyZW50bHkgbG9vcGluZyB0aHJvdWdoIG91ciBzY3JpcHRzXG4gICAgICAgICAgICAvLyB0aGVuIGl0J3Mgc2FmZSB0byByZW1vdmUgdGhlIHNjcmlwdFxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZCA9IHRoaXMuX3JlbW92ZVNjcmlwdEluc3RhbmNlKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzZXRFeGVjdXRpb25PcmRlcihpbmQsIHRoaXMuX3NjcmlwdHMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBwdXNoIHRoZSBzY3JpcHQgaW4gX2Rlc3Ryb3llZFNjcmlwdHMgYW5kXG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gX3NjcmlwdHMgd2hlbiB0aGUgbG9vcCBpcyBvdmVyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVzdHJveWVkU2NyaXB0cy5wdXNoKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBzd2FwIGV2ZW50XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLm9mZignc3dhcDonICsgc2NyaXB0TmFtZSwgc2NyaXB0RGF0YS5vblN3YXApO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzW3NjcmlwdE5hbWVdO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveScsIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlIHx8IG51bGwpO1xuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3k6JyArIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlIHx8IG51bGwpO1xuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZSlcbiAgICAgICAgICAgIHNjcmlwdEluc3RhbmNlLmZpcmUoJ2Rlc3Ryb3knKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTd2FwIHRoZSBzY3JpcHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxpbXBvcnQoJy4uLy4uL3NjcmlwdC9zY3JpcHQtdHlwZS5qcycpLlNjcmlwdFR5cGU+fSBuYW1lT3JUeXBlIC0gVGhlXG4gICAgICogbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgaXQgd2FzIHN1Y2Nlc3NmdWxseSBzd2FwcGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3dhcChuYW1lT3JUeXBlKSB7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIC8vIHNob3J0aGFuZCB1c2luZyBzY3JpcHQgbmFtZVxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdFR5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgaWYgKCFvbGQgfHwgIW9sZC5pbnN0YW5jZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlT2xkID0gb2xkLmluc3RhbmNlO1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2VPbGQpO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gbmV3IHNjcmlwdFR5cGUoe1xuICAgICAgICAgICAgYXBwOiB0aGlzLnN5c3RlbS5hcHAsXG4gICAgICAgICAgICBlbnRpdHk6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgZW5hYmxlZDogc2NyaXB0SW5zdGFuY2VPbGQuZW5hYmxlZCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHNjcmlwdEluc3RhbmNlT2xkLl9fYXR0cmlidXRlc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXNjcmlwdEluc3RhbmNlLnN3YXApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuXG4gICAgICAgIC8vIGFkZCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fc2NyaXB0c1tpbmRdID0gc2NyaXB0SW5zdGFuY2U7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5pbnN0YW5jZSA9IHNjcmlwdEluc3RhbmNlO1xuICAgICAgICB0aGlzW3NjcmlwdE5hbWVdID0gc2NyaXB0SW5zdGFuY2U7XG5cbiAgICAgICAgLy8gc2V0IGV4ZWN1dGlvbiBvcmRlciBhbmQgbWFrZSBzdXJlIHdlIHVwZGF0ZVxuICAgICAgICAvLyBvdXIgdXBkYXRlIGFuZCBwb3N0VXBkYXRlIGxpc3RzXG4gICAgICAgIHNjcmlwdEluc3RhbmNlLl9fZXhlY3V0aW9uT3JkZXIgPSBpbmQ7XG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZU9sZC51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2VPbGQucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHRJbnN0YW5jZSwgU0NSSVBUX1NXQVAsIHNjcmlwdEluc3RhbmNlT2xkKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3N3YXAnLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnc3dhcDonICsgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZW4gYW4gZW50aXR5IGlzIGNsb25lZCBhbmQgaXQgaGFzIGVudGl0eSBzY3JpcHQgYXR0cmlidXRlcyB0aGF0IHBvaW50IHRvIG90aGVyIGVudGl0aWVzIGluXG4gICAgICogdGhlIHNhbWUgc3VidHJlZSB0aGF0IGlzIGNsb25lZCwgdGhlbiB3ZSB3YW50IHRoZSBuZXcgc2NyaXB0IGF0dHJpYnV0ZXMgdG8gcG9pbnQgYXQgdGhlXG4gICAgICogY2xvbmVkIGVudGl0aWVzLiBUaGlzIG1ldGhvZCByZW1hcHMgdGhlIHNjcmlwdCBhdHRyaWJ1dGVzIGZvciB0aGlzIGVudGl0eSBhbmQgaXQgYXNzdW1lc1xuICAgICAqIHRoYXQgdGhpcyBlbnRpdHkgaXMgdGhlIHJlc3VsdCBvZiB0aGUgY2xvbmUgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY3JpcHRDb21wb25lbnR9IG9sZFNjcmlwdENvbXBvbmVudCAtIFRoZSBzb3VyY2Ugc2NyaXB0IGNvbXBvbmVudCB0aGF0IGJlbG9uZ3MgdG9cbiAgICAgKiB0aGUgZW50aXR5IHRoYXQgd2FzIGJlaW5nIGNsb25lZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZHVwbGljYXRlZElkc01hcCAtIEEgZGljdGlvbmFyeSB3aXRoIGd1aWQtZW50aXR5IHZhbHVlcyB0aGF0IGNvbnRhaW5zIHRoZVxuICAgICAqIGVudGl0aWVzIHRoYXQgd2VyZSBjbG9uZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkU2NyaXB0Q29tcG9uZW50LCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGNvbnN0IG5ld1NjcmlwdENvbXBvbmVudCA9IHRoaXMuZW50aXR5LnNjcmlwdDtcblxuICAgICAgICAvLyBmb3IgZWFjaCBzY3JpcHQgaW4gdGhlIG9sZCBjb21wb25lbnRcbiAgICAgICAgZm9yIChjb25zdCBzY3JpcHROYW1lIGluIG9sZFNjcmlwdENvbXBvbmVudC5fc2NyaXB0c0luZGV4KSB7XG4gICAgICAgICAgICAvLyBnZXQgdGhlIHNjcmlwdCB0eXBlIGZyb20gdGhlIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHROYW1lKTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIHNjcmlwdCBmcm9tIHRoZSBjb21wb25lbnQncyBpbmRleFxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gb2xkU2NyaXB0Q29tcG9uZW50Ll9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdCB8fCAhc2NyaXB0Lmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIF9fYXR0cmlidXRlc1JhdyBleGlzdHMgdGhlbiBpdCBtZWFucyB0aGF0IHRoZSBuZXcgZW50aXR5XG4gICAgICAgICAgICAvLyBoYXMgbm90IHlldCBpbml0aWFsaXplZCBpdHMgYXR0cmlidXRlcyBzbyBwdXQgdGhlIG5ldyBndWlkIGluIHRoZXJlLFxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGl0IG1lYW5zIHRoYXQgdGhlIGF0dHJpYnV0ZXMgaGF2ZSBhbHJlYWR5IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgIC8vIHNvIGNvbnZlcnQgdGhlIG5ldyBndWlkIHRvIGFuIGVudGl0eVxuICAgICAgICAgICAgLy8gYW5kIHB1dCBpdCBpbiB0aGUgbmV3IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIGNvbnN0IG5ld0F0dHJpYnV0ZXNSYXcgPSBuZXdTY3JpcHRDb21wb25lbnRbc2NyaXB0TmFtZV0uX19hdHRyaWJ1dGVzUmF3O1xuICAgICAgICAgICAgY29uc3QgbmV3QXR0cmlidXRlcyA9IG5ld1NjcmlwdENvbXBvbmVudFtzY3JpcHROYW1lXS5fX2F0dHJpYnV0ZXM7XG4gICAgICAgICAgICBpZiAoIW5ld0F0dHJpYnV0ZXNSYXcgJiYgIW5ld0F0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIHVzaW5nIGF0dHJpYnV0ZXNSYXcgdGhlbiB1c2UgdGhlIGd1aWQgb3RoZXJ3aXNlIHVzZSB0aGUgZW50aXR5XG4gICAgICAgICAgICBjb25zdCB1c2VHdWlkID0gISFuZXdBdHRyaWJ1dGVzUmF3O1xuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIG9sZCBzY3JpcHQgYXR0cmlidXRlcyBmcm9tIHRoZSBpbnN0YW5jZVxuICAgICAgICAgICAgY29uc3Qgb2xkQXR0cmlidXRlcyA9IHNjcmlwdC5pbnN0YW5jZS5fX2F0dHJpYnV0ZXM7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZU5hbWUgaW4gb2xkQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIGlmICghb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBnZXQgdGhlIGF0dHJpYnV0ZSBkZWZpbml0aW9uIGZyb20gdGhlIHNjcmlwdCB0eXBlXG4gICAgICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlID0gc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmdldChhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVudGl0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZUd1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdBdHRyaWJ1dGVzUmF3IHx8IG5ld0F0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ2pzb24nICYmIEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnNjaGVtYSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8ganNvbiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3SnNvblZhbHVlID0gKG5ld0F0dHJpYnV0ZXNSYXcgPyBuZXdBdHRyaWJ1dGVzUmF3W2F0dHJpYnV0ZU5hbWVdIDogbmV3QXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRyaWJ1dGUuc2NoZW1hLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWVsZCA9IGF0dHJpYnV0ZS5zY2hlbWFbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGQudHlwZSAhPT0gJ2VudGl0eScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS5hcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgb2xkVmFsdWUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlW2pdW2ZpZWxkLm5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0pzb25WYWx1ZVtqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZVtmaWVsZC5uYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3SnNvblZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1vdmUgc2NyaXB0IGluc3RhbmNlIHRvIGRpZmZlcmVudCBwb3NpdGlvbiB0byBhbHRlciB1cGRhdGUgb3JkZXIgb2Ygc2NyaXB0cyB3aXRoaW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZVxuICAgICAqIG5hbWUgb3IgdHlwZSBvZiB7QGxpbmsgU2NyaXB0VHlwZX0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZCAtIE5ldyBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgaXQgd2FzIHN1Y2Nlc3NmdWxseSBtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQubW92ZSgncGxheWVyQ29udHJvbGxlcicsIDApO1xuICAgICAqL1xuICAgIG1vdmUobmFtZU9yVHlwZSwgaW5kKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX3NjcmlwdHMubGVuZ3RoO1xuICAgICAgICBpZiAoaW5kID49IGxlbiB8fCBpbmQgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGxldCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdE5hbWUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2NyaXB0TmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBuYW1lT3JUeXBlLl9fbmFtZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdFR5cGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0RGF0YSA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgaWYgKCFzY3JpcHREYXRhIHx8ICFzY3JpcHREYXRhLmluc3RhbmNlKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIGlmIHNjcmlwdCB0eXBlIHNwZWNpZmllZCwgbWFrZSBzdXJlIGluc3RhbmNlIG9mIHNhaWQgdHlwZVxuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEuaW5zdGFuY2U7XG4gICAgICAgIGlmIChzY3JpcHRUeXBlICYmICEoc2NyaXB0SW5zdGFuY2UgaW5zdGFuY2VvZiBzY3JpcHRUeXBlKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbmRPbGQgPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICBpZiAoaW5kT2xkID09PSAtMSB8fCBpbmRPbGQgPT09IGluZClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBtb3ZlIHNjcmlwdCB0byBhbm90aGVyIHBvc2l0aW9uXG4gICAgICAgIHRoaXMuX3NjcmlwdHMuc3BsaWNlKGluZCwgMCwgdGhpcy5fc2NyaXB0cy5zcGxpY2UoaW5kT2xkLCAxKVswXSk7XG5cbiAgICAgICAgLy8gcmVzZXQgZXhlY3V0aW9uIG9yZGVyIGZvciBzY3JpcHRzIGFuZCByZS1zb3J0IHVwZGF0ZSBhbmQgcG9zdFVwZGF0ZSBsaXN0c1xuICAgICAgICB0aGlzLl9yZXNldEV4ZWN1dGlvbk9yZGVyKDAsIGxlbik7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUxpc3Quc29ydCgpO1xuICAgICAgICB0aGlzLl9wb3N0VXBkYXRlTGlzdC5zb3J0KCk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdtb3ZlJywgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UsIGluZCwgaW5kT2xkKTtcbiAgICAgICAgdGhpcy5maXJlKCdtb3ZlOicgKyBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSwgaW5kLCBpbmRPbGQpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NyaXB0Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiU2NyaXB0Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfc2NyaXB0cyIsIl91cGRhdGVMaXN0IiwiU29ydGVkTG9vcEFycmF5Iiwic29ydEJ5IiwiX3Bvc3RVcGRhdGVMaXN0IiwiX3NjcmlwdHNJbmRleCIsIl9kZXN0cm95ZWRTY3JpcHRzIiwiX2Rlc3Ryb3llZCIsIl9zY3JpcHRzRGF0YSIsIl9vbGRTdGF0ZSIsIl9lbmFibGVkIiwiX2JlaW5nRW5hYmxlZCIsIl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyIsIl9leGVjdXRpb25PcmRlciIsIm9uIiwiX29uU2V0RW5hYmxlZCIsInNjcmlwdHMiLCJ2YWx1ZSIsImtleSIsImhhc093blByb3BlcnR5Iiwic2NyaXB0IiwiZW5hYmxlZCIsImF0dHJpYnV0ZXMiLCJhdHRyIiwiU2NyaXB0QXR0cmlidXRlcyIsInJlc2VydmVkTmFtZXMiLCJoYXMiLCJfX2F0dHJpYnV0ZXMiLCJzY3JpcHRUeXBlIiwiYXBwIiwiZ2V0IiwiYWRkIiwiY29uc29sZSIsImxvZyIsIm9yZGVyIiwib2xkVmFsdWUiLCJmaXJlIiwib25FbmFibGUiLCJfY2hlY2tTdGF0ZSIsIm9uUG9zdFN0YXRlQ2hhbmdlIiwib25EaXNhYmxlIiwid2FzTG9vcGluZyIsIl9iZWdpbkxvb3BpbmciLCJpIiwibGVuIiwibGVuZ3RoIiwiX2luaXRpYWxpemVkIiwiX3Bvc3RJbml0aWFsaXplZCIsInBvc3RJbml0aWFsaXplIiwiX3NjcmlwdE1ldGhvZCIsIlNDUklQVF9QT1NUX0lOSVRJQUxJWkUiLCJfZW5kTG9vcGluZyIsImxvb3BpbmciLCJ3YXNMb29waW5nQmVmb3JlIiwiX3JlbW92ZURlc3Ryb3llZFNjcmlwdHMiLCJwcm9wIiwib2xkIiwic3RhdGUiLCJfYWRkQ29tcG9uZW50VG9FbmFibGVkIiwiX3JlbW92ZUNvbXBvbmVudEZyb21FbmFibGVkIiwiX29uQmVmb3JlUmVtb3ZlIiwiZGVzdHJveSIsIl9fc2NyaXB0VHlwZSIsIl9fbmFtZSIsIl9yZW1vdmVTY3JpcHRJbnN0YW5jZSIsIl9yZXNldEV4ZWN1dGlvbk9yZGVyIiwiX29uSW5pdGlhbGl6ZUF0dHJpYnV0ZXMiLCJfX2luaXRpYWxpemVBdHRyaWJ1dGVzIiwibWV0aG9kIiwiYXJnIiwiZXgiLCJfY2FsbGJhY2tzIiwiZXJyb3IiLCJ3YXJuIiwiX29uSW5pdGlhbGl6ZSIsImluaXRpYWxpemUiLCJTQ1JJUFRfSU5JVElBTElaRSIsIl9vblBvc3RJbml0aWFsaXplIiwiX29uVXBkYXRlIiwiZHQiLCJsaXN0IiwibG9vcEluZGV4IiwiaXRlbXMiLCJTQ1JJUFRfVVBEQVRFIiwiX29uUG9zdFVwZGF0ZSIsIlNDUklQVF9QT1NUX1VQREFURSIsIl9pbnNlcnRTY3JpcHRJbnN0YW5jZSIsInNjcmlwdEluc3RhbmNlIiwiaW5kZXgiLCJzY3JpcHRzTGVuZ3RoIiwicHVzaCIsIl9fZXhlY3V0aW9uT3JkZXIiLCJ1cGRhdGUiLCJhcHBlbmQiLCJwb3N0VXBkYXRlIiwic3BsaWNlIiwiaW5zZXJ0IiwiaWR4IiwiaW5kZXhPZiIsInJlbW92ZSIsInN0YXJ0SW5kZXgiLCJfcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsImF0dHJpYnV0ZU5hbWUiLCJ1c2VHdWlkIiwibmV3QXR0cmlidXRlcyIsImR1cGxpY2F0ZWRJZHNNYXAiLCJhcnJheSIsIm5ld0d1aWRBcnJheSIsInNsaWNlIiwiZ3VpZCIsIkVudGl0eSIsImdldEd1aWQiLCJuYW1lT3JUeXBlIiwic2NyaXB0TmFtZSIsInNjcmlwdERhdGEiLCJpbnN0YW5jZSIsImRhdGEiLCJjcmVhdGUiLCJhcmdzIiwic2VsZiIsImluZCIsIm9uU3dhcCIsInN3YXAiLCJwcmVsb2FkaW5nIiwiRGVidWciLCJuYW1lIiwiYXdhaXRpbmciLCJvZmYiLCJzY3JpcHRJbnN0YW5jZU9sZCIsIlNDUklQVF9TV0FQIiwicmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzIiwib2xkU2NyaXB0Q29tcG9uZW50IiwibmV3U2NyaXB0Q29tcG9uZW50IiwibmV3QXR0cmlidXRlc1JhdyIsIl9fYXR0cmlidXRlc1JhdyIsIm9sZEF0dHJpYnV0ZXMiLCJ0eXBlIiwiQXJyYXkiLCJpc0FycmF5Iiwic2NoZW1hIiwibmV3SnNvblZhbHVlIiwiZmllbGQiLCJqIiwibW92ZSIsImluZE9sZCIsInNvcnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQW1CQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQVFwQ0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTs7SUFRckIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0FBRWxCLElBQUEsSUFBSSxDQUFDQyxXQUFXLEdBQUcsSUFBSUMsZUFBZSxDQUFDO0FBQUVDLE1BQUFBLE1BQU0sRUFBRSxrQkFBQTtBQUFtQixLQUFDLENBQUMsQ0FBQTtBQUV0RSxJQUFBLElBQUksQ0FBQ0MsZUFBZSxHQUFHLElBQUlGLGVBQWUsQ0FBQztBQUFFQyxNQUFBQSxNQUFNLEVBQUUsa0JBQUE7QUFBbUIsS0FBQyxDQUFDLENBQUE7QUFFMUUsSUFBQSxJQUFJLENBQUNFLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxp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
