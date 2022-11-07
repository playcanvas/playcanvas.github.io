/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0L2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgU29ydGVkTG9vcEFycmF5IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9zb3J0ZWQtbG9vcC1hcnJheS5qcyc7XG5cbmltcG9ydCB7IFNjcmlwdEF0dHJpYnV0ZXMgfSBmcm9tICcuLi8uLi9zY3JpcHQvc2NyaXB0LWF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHtcbiAgICBTQ1JJUFRfSU5JVElBTElaRSwgU0NSSVBUX1BPU1RfSU5JVElBTElaRSwgU0NSSVBUX1VQREFURSxcbiAgICBTQ1JJUFRfUE9TVF9VUERBVEUsIFNDUklQVF9TV0FQXG59IGZyb20gJy4uLy4uL3NjcmlwdC9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU2NyaXB0Q29tcG9uZW50U3lzdGVtfSBTY3JpcHRDb21wb25lbnRTeXN0ZW0gKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9zY3JpcHQvc2NyaXB0LXR5cGUuanMnKS5TY3JpcHRUeXBlfSBTY3JpcHRUeXBlICovXG5cbi8qKlxuICogVGhlIFNjcmlwdENvbXBvbmVudCBhbGxvd3MgeW91IHRvIGV4dGVuZCB0aGUgZnVuY3Rpb25hbGl0eSBvZiBhbiBFbnRpdHkgYnkgYXR0YWNoaW5nIHlvdXIgb3duXG4gKiBTY3JpcHQgVHlwZXMgZGVmaW5lZCBpbiBKYXZhU2NyaXB0IGZpbGVzIHRvIGJlIGV4ZWN1dGVkIHdpdGggYWNjZXNzIHRvIHRoZSBFbnRpdHkuIEZvciBtb3JlXG4gKiBkZXRhaWxzIG9uIHNjcmlwdGluZyBzZWUgW1NjcmlwdGluZ10oaHR0cHM6Ly9kZXZlbG9wZXIucGxheWNhbnZhcy5jb20vdXNlci1tYW51YWwvc2NyaXB0aW5nLykuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBTY3JpcHRDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTY3JpcHRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjcmlwdENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhvbGRzIGFsbCBzY3JpcHQgaW5zdGFuY2VzIGZvciB0aGlzIGNvbXBvbmVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NjcmlwdFR5cGVbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NjcmlwdHMgPSBbXTtcbiAgICAgICAgLy8gaG9sZHMgYWxsIHNjcmlwdCBpbnN0YW5jZXMgd2l0aCBhbiB1cGRhdGUgbWV0aG9kXG4gICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QgPSBuZXcgU29ydGVkTG9vcEFycmF5KHsgc29ydEJ5OiAnX19leGVjdXRpb25PcmRlcicgfSk7XG4gICAgICAgIC8vIGhvbGRzIGFsbCBzY3JpcHQgaW5zdGFuY2VzIHdpdGggYSBwb3N0VXBkYXRlIG1ldGhvZFxuICAgICAgICB0aGlzLl9wb3N0VXBkYXRlTGlzdCA9IG5ldyBTb3J0ZWRMb29wQXJyYXkoeyBzb3J0Qnk6ICdfX2V4ZWN1dGlvbk9yZGVyJyB9KTtcblxuICAgICAgICB0aGlzLl9zY3JpcHRzSW5kZXggPSB7fTtcbiAgICAgICAgdGhpcy5fZGVzdHJveWVkU2NyaXB0cyA9IFtdO1xuICAgICAgICB0aGlzLl9kZXN0cm95ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc2NyaXB0c0RhdGEgPSBudWxsO1xuICAgICAgICB0aGlzLl9vbGRTdGF0ZSA9IHRydWU7XG5cbiAgICAgICAgLy8gb3ZlcnJpZGUgZGVmYXVsdCAnZW5hYmxlZCcgcHJvcGVydHkgb2YgYmFzZSBwYy5Db21wb25lbnRcbiAgICAgICAgLy8gYmVjYXVzZSB0aGlzIGlzIGZhc3RlclxuICAgICAgICB0aGlzLl9lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgICAvLyB3aGV0aGVyIHRoaXMgY29tcG9uZW50IGlzIGN1cnJlbnRseSBiZWluZyBlbmFibGVkXG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAvLyBpZiB0cnVlIHRoZW4gd2UgYXJlIGN1cnJlbnRseSBsb29waW5nIHRocm91Z2hcbiAgICAgICAgLy8gc2NyaXB0IGluc3RhbmNlcy4gVGhpcyBpcyB1c2VkIHRvIHByZXZlbnQgYSBzY3JpcHRzIGFycmF5XG4gICAgICAgIC8vIGZyb20gYmVpbmcgbW9kaWZpZWQgd2hpbGUgYSBsb29wIGlzIGJlaW5nIGV4ZWN1dGVkXG4gICAgICAgIHRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdGhlIG9yZGVyIHRoYXQgdGhpcyBjb21wb25lbnQgd2lsbCBiZSB1cGRhdGVkXG4gICAgICAgIC8vIGJ5IHRoZSBzY3JpcHQgc3lzdGVtLiBUaGlzIGlzIHNldCBieSB0aGUgc3lzdGVtIGl0c2VsZi5cbiAgICAgICAgdGhpcy5fZXhlY3V0aW9uT3JkZXIgPSAtMTtcblxuICAgICAgICB0aGlzLm9uKCdzZXRfZW5hYmxlZCcsIHRoaXMuX29uU2V0RW5hYmxlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBDb21wb25lbnQgYmVjb21lcyBlbmFibGVkLiBOb3RlOiB0aGlzIGV2ZW50IGRvZXMgbm90IHRha2UgaW4gYWNjb3VudCBlbnRpdHkgb3JcbiAgICAgKiBhbnkgb2YgaXRzIHBhcmVudCBlbmFibGVkIHN0YXRlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNlbmFibGVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2VuYWJsZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gQ29tcG9uZW50IGJlY29tZXMgZGlzYWJsZWQuIE5vdGU6IHRoaXMgZXZlbnQgZG9lcyBub3QgdGFrZSBpbiBhY2NvdW50IGVudGl0eSBvclxuICAgICAqIGFueSBvZiBpdHMgcGFyZW50IGVuYWJsZWQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I2Rpc2FibGVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2Rpc2FibGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIGNvbXBvbmVudCBpcyBkaXNhYmxlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBDb21wb25lbnQgY2hhbmdlcyBzdGF0ZSB0byBlbmFibGVkIG9yIGRpc2FibGVkLiBOb3RlOiB0aGlzIGV2ZW50IGRvZXMgbm90IHRha2UgaW5cbiAgICAgKiBhY2NvdW50IGVudGl0eSBvciBhbnkgb2YgaXRzIHBhcmVudCBlbmFibGVkIHN0YXRlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNzdGF0ZVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgbm93IGVuYWJsZWQsIEZhbHNlIGlmIGRpc2FibGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignc3RhdGUnLCBmdW5jdGlvbiAoZW5hYmxlZCkge1xuICAgICAqICAgICAvLyBjb21wb25lbnQgY2hhbmdlZCBzdGF0ZVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBDb21wb25lbnQgaXMgcmVtb3ZlZCBmcm9tIGVudGl0eS5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjcmVtb3ZlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdyZW1vdmUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIGVudGl0eSBoYXMgbm8gbW9yZSBzY3JpcHQgY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGNyZWF0ZWQgYW5kIGF0dGFjaGVkIHRvIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjY3JlYXRlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgU2NyaXB0IFR5cGUuXG4gICAgICogQHBhcmFtIHtTY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IHRoYXQgaGFzIGJlZW4gY3JlYXRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2NyZWF0ZScsIGZ1bmN0aW9uIChuYW1lLCBzY3JpcHRJbnN0YW5jZSkge1xuICAgICAqICAgICAvLyBuZXcgc2NyaXB0IGluc3RhbmNlIGFkZGVkIHRvIGNvbXBvbmVudFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBpcyBjcmVhdGVkIGFuZCBhdHRhY2hlZCB0byBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I2NyZWF0ZTpbbmFtZV1cbiAgICAgKiBAcGFyYW0ge1NjcmlwdFR5cGV9IHNjcmlwdEluc3RhbmNlIC0gVGhlIGluc3RhbmNlIG9mIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCBoYXMgYmVlbiBjcmVhdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignY3JlYXRlOnBsYXllckNvbnRyb2xsZXInLCBmdW5jdGlvbiAoc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgKiAgICAgLy8gbmV3IHNjcmlwdCBpbnN0YW5jZSAncGxheWVyQ29udHJvbGxlcicgaXMgYWRkZWQgdG8gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIGRlc3Ryb3llZCBhbmQgcmVtb3ZlZCBmcm9tIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjZGVzdHJveVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIFNjcmlwdCBUeXBlLlxuICAgICAqIEBwYXJhbSB7U2NyaXB0VHlwZX0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgaW5zdGFuY2Ugb2YgdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IGhhcyBiZWVuIGRlc3Ryb3llZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ2Rlc3Ryb3knLCBmdW5jdGlvbiAobmFtZSwgc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgKiAgICAgLy8gc2NyaXB0IGluc3RhbmNlIGhhcyBiZWVuIGRlc3Ryb3llZCBhbmQgcmVtb3ZlZCBmcm9tIGNvbXBvbmVudFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBpcyBkZXN0cm95ZWQgYW5kIHJlbW92ZWQgZnJvbSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0Q29tcG9uZW50I2Rlc3Ryb3k6W25hbWVdXG4gICAgICogQHBhcmFtIHtTY3JpcHRUeXBlfSBzY3JpcHRJbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSBvZiB0aGUge0BsaW5rIFNjcmlwdFR5cGV9IHRoYXQgaGFzIGJlZW4gZGVzdHJveWVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5vbignZGVzdHJveTpwbGF5ZXJDb250cm9sbGVyJywgZnVuY3Rpb24gKHNjcmlwdEluc3RhbmNlKSB7XG4gICAgICogICAgIC8vIHNjcmlwdCBpbnN0YW5jZSAncGxheWVyQ29udHJvbGxlcicgaGFzIGJlZW4gZGVzdHJveWVkIGFuZCByZW1vdmVkIGZyb20gY29tcG9uZW50XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGlzIG1vdmVkIGluIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjbW92ZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIFNjcmlwdCBUeXBlLlxuICAgICAqIEBwYXJhbSB7U2NyaXB0VHlwZX0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgaW5zdGFuY2Ugb2YgdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IGhhcyBiZWVuIG1vdmVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmQgLSBOZXcgcG9zaXRpb24gaW5kZXguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZE9sZCAtIE9sZCBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ21vdmUnLCBmdW5jdGlvbiAobmFtZSwgc2NyaXB0SW5zdGFuY2UsIGluZCwgaW5kT2xkKSB7XG4gICAgICogICAgIC8vIHNjcmlwdCBpbnN0YW5jZSBoYXMgYmVlbiBtb3ZlZCBpbiBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaXMgbW92ZWQgaW4gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdENvbXBvbmVudCNtb3ZlOltuYW1lXVxuICAgICAqIEBwYXJhbSB7U2NyaXB0VHlwZX0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgaW5zdGFuY2Ugb2YgdGhlIHtAbGluayBTY3JpcHRUeXBlfSB0aGF0IGhhcyBiZWVuIG1vdmVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmQgLSBOZXcgcG9zaXRpb24gaW5kZXguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZE9sZCAtIE9sZCBwb3NpdGlvbiBpbmRleC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQub24oJ21vdmU6cGxheWVyQ29udHJvbGxlcicsIGZ1bmN0aW9uIChzY3JpcHRJbnN0YW5jZSwgaW5kLCBpbmRPbGQpIHtcbiAgICAgKiAgICAgLy8gc2NyaXB0IGluc3RhbmNlICdwbGF5ZXJDb250cm9sbGVyJyBoYXMgYmVlbiBtb3ZlZCBpbiBjb21wb25lbnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzY3JpcHQgaW5zdGFuY2UgaGFkIGFuIGV4Y2VwdGlvbi5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRDb21wb25lbnQjZXJyb3JcbiAgICAgKiBAcGFyYW0ge1NjcmlwdFR5cGV9IHNjcmlwdEluc3RhbmNlIC0gVGhlIGluc3RhbmNlIG9mIHRoZSB7QGxpbmsgU2NyaXB0VHlwZX0gdGhhdCByYWlzZWQgdGhlIGV4Y2VwdGlvbi5cbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnIgLSBOYXRpdmUgSlMgRXJyb3Igb2JqZWN0IHdpdGggZGV0YWlscyBvZiBhbiBlcnJvci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kIC0gVGhlIG1ldGhvZCBvZiB0aGUgc2NyaXB0IGluc3RhbmNlIHRoYXQgdGhlIGV4Y2VwdGlvbiBvcmlnaW5hdGVkIGZyb20uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlbnRpdHkuc2NyaXB0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uIChzY3JpcHRJbnN0YW5jZSwgZXJyLCBtZXRob2QpIHtcbiAgICAgKiAgICAgLy8gc2NyaXB0IGluc3RhbmNlIGNhdWdodCBhbiBleGNlcHRpb25cbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGFsbCBzY3JpcHQgaW5zdGFuY2VzIGF0dGFjaGVkIHRvIGFuIGVudGl0eS4gVGhpcyBhcnJheSBpcyByZWFkLW9ubHkgYW5kIHNob3VsZFxuICAgICAqIG5vdCBiZSBtb2RpZmllZCBieSBkZXZlbG9wZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2NyaXB0VHlwZVtdfVxuICAgICAqL1xuICAgIHNldCBzY3JpcHRzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNEYXRhID0gdmFsdWU7XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICghdmFsdWUuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5fc2NyaXB0c0luZGV4W2tleV07XG4gICAgICAgICAgICBpZiAoc2NyaXB0KSB7XG4gICAgICAgICAgICAgICAgLy8gZXhpc3Rpbmcgc2NyaXB0XG5cbiAgICAgICAgICAgICAgICAvLyBlbmFibGVkXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZVtrZXldLmVuYWJsZWQgPT09ICdib29sZWFuJylcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0LmVuYWJsZWQgPSAhIXZhbHVlW2tleV0uZW5hYmxlZDtcblxuICAgICAgICAgICAgICAgIC8vIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlW2tleV0uYXR0cmlidXRlcyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBhdHRyIGluIHZhbHVlW2tleV0uYXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFNjcmlwdEF0dHJpYnV0ZXMucmVzZXJ2ZWROYW1lcy5oYXMoYXR0cikpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2NyaXB0Ll9fYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5ldyBhdHRyaWJ1dGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KGtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdFR5cGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdFR5cGUuYXR0cmlidXRlcy5hZGQoYXR0ciwgeyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0W2F0dHJdID0gdmFsdWVba2V5XS5hdHRyaWJ1dGVzW2F0dHJdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIHNjcmlwdHMyXG4gICAgICAgICAgICAgICAgLy8gbmV3IHNjcmlwdFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMub3JkZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNjcmlwdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zY3JpcHRzO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fZW5hYmxlZDtcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldCcsICdlbmFibGVkJywgb2xkVmFsdWUsIHZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NoZWNrU3RhdGUoKTtcblxuICAgICAgICBpZiAoIXRoaXMuZW50aXR5Ll9iZWluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMub25Qb3N0U3RhdGVDaGFuZ2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY2hlY2tTdGF0ZSgpO1xuICAgIH1cblxuICAgIG9uUG9zdFN0YXRlQ2hhbmdlKCkge1xuICAgICAgICBjb25zdCB3YXNMb29waW5nID0gdGhpcy5fYmVnaW5Mb29waW5nKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5zY3JpcHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAoc2NyaXB0Ll9pbml0aWFsaXplZCAmJiAhc2NyaXB0Ll9wb3N0SW5pdGlhbGl6ZWQgJiYgc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBzY3JpcHQuX3Bvc3RJbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LnBvc3RJbml0aWFsaXplKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0LCBTQ1JJUFRfUE9TVF9JTklUSUFMSVpFKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgLy8gU2V0cyBpc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyB0byBmYWxzZSBhbmQgcmV0dXJuc1xuICAgIC8vIGl0cyBwcmV2aW91cyB2YWx1ZVxuICAgIF9iZWdpbkxvb3BpbmcoKSB7XG4gICAgICAgIGNvbnN0IGxvb3BpbmcgPSB0aGlzLl9pc0xvb3BpbmdUaHJvdWdoU2NyaXB0cztcbiAgICAgICAgdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHMgPSB0cnVlO1xuICAgICAgICByZXR1cm4gbG9vcGluZztcbiAgICB9XG5cbiAgICAvLyBSZXN0b3JlcyBpc0xvb3BpbmdUaHJvdWdoU2NyaXB0cyB0byB0aGUgc3BlY2lmaWVkIHBhcmFtZXRlclxuICAgIC8vIElmIGFsbCBsb29wcyBhcmUgb3ZlciB0aGVuIHJlbW92ZSBkZXN0cm95ZWQgc2NyaXB0cyBmb3JtIHRoZSBfc2NyaXB0cyBhcnJheVxuICAgIF9lbmRMb29waW5nKHdhc0xvb3BpbmdCZWZvcmUpIHtcbiAgICAgICAgdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHMgPSB3YXNMb29waW5nQmVmb3JlO1xuICAgICAgICBpZiAoIXRoaXMuX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVEZXN0cm95ZWRTY3JpcHRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXZSBhbHNvIG5lZWQgdGhpcyBoYW5kbGVyIGJlY2F1c2UgaXQgaXMgZmlyZWRcbiAgICAvLyB3aGVuIHZhbHVlID09PSBvbGQgaW5zdGVhZCBvZiBvbkVuYWJsZSBhbmQgb25EaXNhYmxlXG4gICAgLy8gd2hpY2ggYXJlIG9ubHkgZmlyZWQgd2hlbiB2YWx1ZSAhPT0gb2xkXG4gICAgX29uU2V0RW5hYmxlZChwcm9wLCBvbGQsIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2JlaW5nRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NoZWNrU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fYmVpbmdFbmFibGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgX2NoZWNrU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQ7XG4gICAgICAgIGlmIChzdGF0ZSA9PT0gdGhpcy5fb2xkU3RhdGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fb2xkU3RhdGUgPSBzdGF0ZTtcblxuICAgICAgICB0aGlzLmZpcmUoc3RhdGUgPyAnZW5hYmxlJyA6ICdkaXNhYmxlJyk7XG4gICAgICAgIHRoaXMuZmlyZSgnc3RhdGUnLCBzdGF0ZSk7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5fYWRkQ29tcG9uZW50VG9FbmFibGVkKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3JlbW92ZUNvbXBvbmVudEZyb21FbmFibGVkKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2FzTG9vcGluZyA9IHRoaXMuX2JlZ2luTG9vcGluZygpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLnNjcmlwdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuc2NyaXB0c1tpXTtcbiAgICAgICAgICAgIHNjcmlwdC5lbmFibGVkID0gc2NyaXB0Ll9lbmFibGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICBfb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG5cbiAgICAgICAgY29uc3Qgd2FzTG9vcGluZyA9IHRoaXMuX2JlZ2luTG9vcGluZygpO1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgYWxsIHNjcmlwdHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuc2NyaXB0c1tpXTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0KSBjb250aW51ZTtcblxuICAgICAgICAgICAgdGhpcy5kZXN0cm95KHNjcmlwdC5fX3NjcmlwdFR5cGUuX19uYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VuZExvb3Bpbmcod2FzTG9vcGluZyk7XG4gICAgfVxuXG4gICAgX3JlbW92ZURlc3Ryb3llZFNjcmlwdHMoKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMubGVuZ3RoO1xuICAgICAgICBpZiAoIWxlbikgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHNbaV07XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVTY3JpcHRJbnN0YW5jZShzY3JpcHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVzdHJveWVkU2NyaXB0cy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBleGVjdXRpb24gb3JkZXIgZm9yIHNjcmlwdHNcbiAgICAgICAgdGhpcy5fcmVzZXRFeGVjdXRpb25PcmRlcigwLCB0aGlzLl9zY3JpcHRzLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgX29uSW5pdGlhbGl6ZUF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLnNjcmlwdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgICB0aGlzLnNjcmlwdHNbaV0uX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuICAgIH1cblxuICAgIF9zY3JpcHRNZXRob2Qoc2NyaXB0LCBtZXRob2QsIGFyZykge1xuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIHRyeSB7XG4gICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgc2NyaXB0W21ldGhvZF0oYXJnKTtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgLy8gZGlzYWJsZSBzY3JpcHQgaWYgaXQgZmFpbHMgdG8gY2FsbCBtZXRob2RcbiAgICAgICAgICAgIHNjcmlwdC5lbmFibGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICghc2NyaXB0Ll9jYWxsYmFja3MgfHwgIXNjcmlwdC5fY2FsbGJhY2tzLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGB1bmhhbmRsZWQgZXhjZXB0aW9uIHdoaWxlIGNhbGxpbmcgXCIke21ldGhvZH1cIiBmb3IgXCIke3NjcmlwdC5fX3NjcmlwdFR5cGUuX19uYW1lfVwiIHNjcmlwdDogYCwgZXgpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzY3JpcHQuZmlyZSgnZXJyb3InLCBleCwgbWV0aG9kKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBzY3JpcHQsIGV4LCBtZXRob2QpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIF9vbkluaXRpYWxpemUoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSB0aGlzLl9zY3JpcHRzO1xuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc2NyaXB0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gc2NyaXB0c1tpXTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0Ll9pbml0aWFsaXplZCAmJiBzY3JpcHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHNjcmlwdC5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChzY3JpcHQuaW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0TWV0aG9kKHNjcmlwdCwgU0NSSVBUX0lOSVRJQUxJWkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICBfb25Qb3N0SW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgdGhpcy5vblBvc3RTdGF0ZUNoYW5nZSgpO1xuICAgIH1cblxuICAgIF9vblVwZGF0ZShkdCkge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5fdXBkYXRlTGlzdDtcbiAgICAgICAgaWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHdhc0xvb3BpbmcgPSB0aGlzLl9iZWdpbkxvb3BpbmcoKTtcblxuICAgICAgICBmb3IgKGxpc3QubG9vcEluZGV4ID0gMDsgbGlzdC5sb29wSW5kZXggPCBsaXN0Lmxlbmd0aDsgbGlzdC5sb29wSW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gbGlzdC5pdGVtc1tsaXN0Lmxvb3BJbmRleF07XG4gICAgICAgICAgICBpZiAoc2NyaXB0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0LCBTQ1JJUFRfVVBEQVRFLCBkdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbmRMb29waW5nKHdhc0xvb3BpbmcpO1xuICAgIH1cblxuICAgIF9vblBvc3RVcGRhdGUoZHQpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMuX3Bvc3RVcGRhdGVMaXN0O1xuICAgICAgICBpZiAoIWxpc3QubGVuZ3RoKSByZXR1cm47XG5cbiAgICAgICAgY29uc3Qgd2FzTG9vcGluZyA9IHRoaXMuX2JlZ2luTG9vcGluZygpO1xuXG4gICAgICAgIGZvciAobGlzdC5sb29wSW5kZXggPSAwOyBsaXN0Lmxvb3BJbmRleCA8IGxpc3QubGVuZ3RoOyBsaXN0Lmxvb3BJbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBsaXN0Lml0ZW1zW2xpc3QubG9vcEluZGV4XTtcbiAgICAgICAgICAgIGlmIChzY3JpcHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHQsIFNDUklQVF9QT1NUX1VQREFURSwgZHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW5kTG9vcGluZyh3YXNMb29waW5nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIHNjcmlwdCBpbnN0YW5jZSBpbnRvIHRoZSBzY3JpcHRzIGFycmF5IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXguIEFsc28gaW5zZXJ0cyB0aGVcbiAgICAgKiBzY3JpcHQgaW50byB0aGUgdXBkYXRlIGxpc3QgaWYgaXQgaGFzIGFuIHVwZGF0ZSBtZXRob2QgYW5kIHRoZSBwb3N0IHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhXG4gICAgICogcG9zdFVwZGF0ZSBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2NyaXB0SW5zdGFuY2UgLSBUaGUgc2NyaXB0IGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIHNjcmlwdCBhdC4gSWYgLTEsIGFwcGVuZCBpdCBhdCB0aGUgZW5kLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY3JpcHRzTGVuZ3RoIC0gVGhlIGxlbmd0aCBvZiB0aGUgc2NyaXB0cyBhcnJheS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbnNlcnRTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSwgaW5kZXgsIHNjcmlwdHNMZW5ndGgpIHtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgLy8gYXBwZW5kIHNjcmlwdCBhdCB0aGUgZW5kIGFuZCBzZXQgZXhlY3V0aW9uIG9yZGVyXG4gICAgICAgICAgICB0aGlzLl9zY3JpcHRzLnB1c2goc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19leGVjdXRpb25PcmRlciA9IHNjcmlwdHNMZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIGFwcGVuZCBzY3JpcHQgdG8gdGhlIHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhbiB1cGRhdGUgbWV0aG9kXG4gICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UudXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGlzdC5hcHBlbmQoc2NyaXB0SW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhZGQgc2NyaXB0IHRvIHRoZSBwb3N0VXBkYXRlIGxpc3QgaWYgaXQgaGFzIGEgcG9zdFVwZGF0ZSBtZXRob2RcbiAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS5wb3N0VXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuYXBwZW5kKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGluc2VydCBzY3JpcHQgYXQgaW5kZXggYW5kIHNldCBleGVjdXRpb24gb3JkZXJcbiAgICAgICAgICAgIHRoaXMuX3NjcmlwdHMuc3BsaWNlKGluZGV4LCAwLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fX2V4ZWN1dGlvbk9yZGVyID0gaW5kZXg7XG5cbiAgICAgICAgICAgIC8vIG5vdyB3ZSBhbHNvIG5lZWQgdG8gdXBkYXRlIHRoZSBleGVjdXRpb24gb3JkZXIgb2YgYWxsXG4gICAgICAgICAgICAvLyB0aGUgc2NyaXB0IGluc3RhbmNlcyB0aGF0IGNvbWUgYWZ0ZXIgdGhpcyBzY3JpcHRcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoaW5kZXggKyAxLCBzY3JpcHRzTGVuZ3RoICsgMSk7XG5cbiAgICAgICAgICAgIC8vIGluc2VydCBzY3JpcHQgdG8gdGhlIHVwZGF0ZSBsaXN0IGlmIGl0IGhhcyBhbiB1cGRhdGUgbWV0aG9kXG4gICAgICAgICAgICAvLyBpbiB0aGUgcmlnaHQgb3JkZXJcbiAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVMaXN0Lmluc2VydChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluc2VydCBzY3JpcHQgdG8gdGhlIHBvc3RVcGRhdGUgbGlzdCBpZiBpdCBoYXMgYSBwb3N0VXBkYXRlIG1ldGhvZFxuICAgICAgICAgICAgLy8gaW4gdGhlIHJpZ2h0IG9yZGVyXG4gICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Bvc3RVcGRhdGVMaXN0Lmluc2VydChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlU2NyaXB0SW5zdGFuY2Uoc2NyaXB0SW5zdGFuY2UpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fc2NyaXB0cy5pbmRleE9mKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybiBpZHg7XG5cbiAgICAgICAgdGhpcy5fc2NyaXB0cy5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UudXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaXN0LnJlbW92ZShzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpZHg7XG4gICAgfVxuXG4gICAgX3Jlc2V0RXhlY3V0aW9uT3JkZXIoc3RhcnRJbmRleCwgc2NyaXB0c0xlbmd0aCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8IHNjcmlwdHNMZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fc2NyaXB0c1tpXS5fX2V4ZWN1dGlvbk9yZGVyID0gaTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZXNvbHZlRW50aXR5U2NyaXB0QXR0cmlidXRlKGF0dHJpYnV0ZSwgYXR0cmlidXRlTmFtZSwgb2xkVmFsdWUsIHVzZUd1aWQsIG5ld0F0dHJpYnV0ZXMsIGR1cGxpY2F0ZWRJZHNNYXApIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZS5hcnJheSkge1xuICAgICAgICAgICAgLy8gaGFuZGxlIGVudGl0eSBhcnJheSBhdHRyaWJ1dGVcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IG9sZFZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgIGlmICghbGVuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBuZXdHdWlkQXJyYXkgPSBvbGRWYWx1ZS5zbGljZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGd1aWQgPSBuZXdHdWlkQXJyYXlbaV0gaW5zdGFuY2VvZiBFbnRpdHkgPyBuZXdHdWlkQXJyYXlbaV0uZ2V0R3VpZCgpIDogbmV3R3VpZEFycmF5W2ldO1xuICAgICAgICAgICAgICAgIGlmIChkdXBsaWNhdGVkSWRzTWFwW2d1aWRdKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0d1aWRBcnJheVtpXSA9IHVzZUd1aWQgPyBkdXBsaWNhdGVkSWRzTWFwW2d1aWRdLmdldEd1aWQoKSA6IGR1cGxpY2F0ZWRJZHNNYXBbZ3VpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXdBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gbmV3R3VpZEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaGFuZGxlIHJlZ3VsYXIgZW50aXR5IGF0dHJpYnV0ZVxuICAgICAgICAgICAgaWYgKG9sZFZhbHVlIGluc3RhbmNlb2YgRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgb2xkVmFsdWUgPSBvbGRWYWx1ZS5nZXRHdWlkKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvbGRWYWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkdXBsaWNhdGVkSWRzTWFwW29sZFZhbHVlXSkge1xuICAgICAgICAgICAgICAgIG5ld0F0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV0gPSBkdXBsaWNhdGVkSWRzTWFwW29sZFZhbHVlXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVjdCBpZiBzY3JpcHQgaXMgYXR0YWNoZWQgdG8gYW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8U2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGUgbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgc2NyaXB0IGlzIGF0dGFjaGVkIHRvIGFuIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChlbnRpdHkuc2NyaXB0LmhhcygncGxheWVyQ29udHJvbGxlcicpKSB7XG4gICAgICogICAgIC8vIGVudGl0eSBoYXMgc2NyaXB0XG4gICAgICogfVxuICAgICAqL1xuICAgIGhhcyhuYW1lT3JUeXBlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZU9yVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiAhIXRoaXMuX3NjcmlwdHNJbmRleFtuYW1lT3JUeXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbmFtZU9yVHlwZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdFR5cGUuX19uYW1lO1xuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEgJiYgc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgcmV0dXJuIHNjcmlwdEluc3RhbmNlIGluc3RhbmNlb2Ygc2NyaXB0VHlwZTsgLy8gd2lsbCByZXR1cm4gZmFsc2UgaWYgc2NyaXB0SW5zdGFuY2UgdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgc2NyaXB0IGluc3RhbmNlIChpZiBhdHRhY2hlZCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEByZXR1cm5zIHtTY3JpcHRUeXBlfG51bGx9IElmIHNjcmlwdCBpcyBhdHRhY2hlZCwgdGhlIGluc3RhbmNlIGlzIHJldHVybmVkLiBPdGhlcndpc2UgbnVsbFxuICAgICAqIGlzIHJldHVybmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGNvbnRyb2xsZXIgPSBlbnRpdHkuc2NyaXB0LmdldCgncGxheWVyQ29udHJvbGxlcicpO1xuICAgICAqL1xuICAgIGdldChuYW1lT3JUeXBlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbmFtZU9yVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9zY3JpcHRzSW5kZXhbbmFtZU9yVHlwZV07XG4gICAgICAgICAgICByZXR1cm4gZGF0YSA/IGRhdGEuaW5zdGFuY2UgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFuYW1lT3JUeXBlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3Qgc2NyaXB0VHlwZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGNvbnN0IHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgY29uc3Qgc2NyaXB0RGF0YSA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgY29uc3Qgc2NyaXB0SW5zdGFuY2UgPSBzY3JpcHREYXRhICYmIHNjcmlwdERhdGEuaW5zdGFuY2U7XG4gICAgICAgIHJldHVybiBzY3JpcHRJbnN0YW5jZSBpbnN0YW5jZW9mIHNjcmlwdFR5cGUgPyBzY3JpcHRJbnN0YW5jZSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgc2NyaXB0IGluc3RhbmNlIGFuZCBhdHRhY2ggdG8gYW4gZW50aXR5IHNjcmlwdCBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJnc10gLSBPYmplY3Qgd2l0aCBhcmd1bWVudHMgZm9yIGEgc2NyaXB0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2FyZ3MuZW5hYmxlZF0gLSBJZiBzY3JpcHQgaW5zdGFuY2UgaXMgZW5hYmxlZCBhZnRlciBjcmVhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB0cnVlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbYXJncy5hdHRyaWJ1dGVzXSAtIE9iamVjdCB3aXRoIHZhbHVlcyBmb3IgYXR0cmlidXRlcyAoaWYgYW55KSwgd2hlcmUga2V5IGlzXG4gICAgICogbmFtZSBvZiBhbiBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbYXJncy5wcmVsb2FkaW5nXSAtIElmIHNjcmlwdCBpbnN0YW5jZSBpcyBjcmVhdGVkIGR1cmluZyBwcmVsb2FkLiBJZiB0cnVlLFxuICAgICAqIHNjcmlwdCBhbmQgYXR0cmlidXRlcyBtdXN0IGJlIGluaXRpYWxpemVkIG1hbnVhbGx5LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyZ3MuaW5kXSAtIFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIHNjcmlwdCBpbnN0YW5jZSBhdC4gRGVmYXVsdHMgdG9cbiAgICAgKiAtMSwgd2hpY2ggbWVhbnMgYXBwZW5kIGl0IGF0IHRoZSBlbmQuXG4gICAgICogQHJldHVybnMge1NjcmlwdFR5cGV8bnVsbH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBhIHtAbGluayBTY3JpcHRUeXBlfSBpZiBzdWNjZXNzZnVsbHkgYXR0YWNoZWRcbiAgICAgKiB0byBhbiBlbnRpdHksIG9yIG51bGwgaWYgaXQgZmFpbGVkIGJlY2F1c2UgYSBzY3JpcHQgd2l0aCBhIHNhbWUgbmFtZSBoYXMgYWxyZWFkeSBiZWVuIGFkZGVkXG4gICAgICogb3IgaWYgdGhlIHtAbGluayBTY3JpcHRUeXBlfSBjYW5ub3QgYmUgZm91bmQgYnkgbmFtZSBpbiB0aGUge0BsaW5rIFNjcmlwdFJlZ2lzdHJ5fS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQuY3JlYXRlKCdwbGF5ZXJDb250cm9sbGVyJywge1xuICAgICAqICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICogICAgICAgICBzcGVlZDogNFxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgY3JlYXRlKG5hbWVPclR5cGUsIGFyZ3MgPSB7fSkge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBsZXQgc2NyaXB0VHlwZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcblxuICAgICAgICAvLyBzaG9ydGhhbmQgdXNpbmcgc2NyaXB0IG5hbWVcbiAgICAgICAgaWYgKHR5cGVvZiBzY3JpcHRUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHRUeXBlKTtcbiAgICAgICAgfSBlbHNlIGlmIChzY3JpcHRUeXBlKSB7XG4gICAgICAgICAgICBzY3JpcHROYW1lID0gc2NyaXB0VHlwZS5fX25hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0gfHwgIXRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5pbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBzY3JpcHQgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IG5ldyBzY3JpcHRUeXBlKHtcbiAgICAgICAgICAgICAgICAgICAgYXBwOiB0aGlzLnN5c3RlbS5hcHAsXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eTogdGhpcy5lbnRpdHksXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGFyZ3MuaGFzT3duUHJvcGVydHkoJ2VuYWJsZWQnKSA/IGFyZ3MuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGFyZ3MuYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGluZCA9IC0xO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJncy5pbmQgPT09ICdudW1iZXInICYmIGFyZ3MuaW5kICE9PSAtMSAmJiBsZW4gPiBhcmdzLmluZClcbiAgICAgICAgICAgICAgICAgICAgaW5kID0gYXJncy5pbmQ7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbnNlcnRTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSwgaW5kLCBsZW4pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZTogc2NyaXB0SW5zdGFuY2UsXG4gICAgICAgICAgICAgICAgICAgIG9uU3dhcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zd2FwKHNjcmlwdE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHRoaXNbc2NyaXB0TmFtZV0gPSBzY3JpcHRJbnN0YW5jZTtcblxuICAgICAgICAgICAgICAgIGlmICghYXJncy5wcmVsb2FkaW5nKVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fX2luaXRpYWxpemVBdHRyaWJ1dGVzKCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NyZWF0ZScsIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NyZWF0ZTonICsgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMub24oJ3N3YXA6JyArIHNjcmlwdE5hbWUsIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5vblN3YXApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFhcmdzLnByZWxvYWRpbmcpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UuZW5hYmxlZCAmJiAhc2NyaXB0SW5zdGFuY2UuX2luaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UuaW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0SW5zdGFuY2UsIFNDUklQVF9JTklUSUFMSVpFKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS5lbmFibGVkICYmICFzY3JpcHRJbnN0YW5jZS5fcG9zdEluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5fcG9zdEluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS5wb3N0SW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JpcHRNZXRob2Qoc2NyaXB0SW5zdGFuY2UsIFNDUklQVF9QT1NUX0lOSVRJQUxJWkUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2NyaXB0SW5zdGFuY2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIERlYnVnLndhcm4oYHNjcmlwdCAnJHtzY3JpcHROYW1lfScgaXMgYWxyZWFkeSBhZGRlZCB0byBlbnRpdHkgJyR7dGhpcy5lbnRpdHkubmFtZX0nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgYXdhaXRpbmc6IHRydWUsXG4gICAgICAgICAgICAgICAgaW5kOiB0aGlzLl9zY3JpcHRzLmxlbmd0aFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgRGVidWcud2Fybihgc2NyaXB0ICcke3NjcmlwdE5hbWV9JyBpcyBub3QgZm91bmQsIGF3YWl0aW5nIGl0IHRvIGJlIGFkZGVkIHRvIHJlZ2lzdHJ5YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IHRoZSBzY3JpcHQgaW5zdGFuY2UgdGhhdCBpcyBhdHRhY2hlZCB0byBhbiBlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xDbGFzczxTY3JpcHRUeXBlPn0gbmFtZU9yVHlwZSAtIFRoZSBuYW1lIG9yIHR5cGUgb2Yge0BsaW5rIFNjcmlwdFR5cGV9LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBJZiBpdCB3YXMgc3VjY2Vzc2Z1bGx5IGRlc3Ryb3llZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5zY3JpcHQuZGVzdHJveSgncGxheWVyQ29udHJvbGxlcicpO1xuICAgICAqL1xuICAgIGRlc3Ryb3kobmFtZU9yVHlwZSkge1xuICAgICAgICBsZXQgc2NyaXB0TmFtZSA9IG5hbWVPclR5cGU7XG4gICAgICAgIGxldCBzY3JpcHRUeXBlID0gbmFtZU9yVHlwZTtcblxuICAgICAgICAvLyBzaG9ydGhhbmQgdXNpbmcgc2NyaXB0IG5hbWVcbiAgICAgICAgaWYgKHR5cGVvZiBzY3JpcHRUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHRUeXBlKTtcbiAgICAgICAgfSBlbHNlIGlmIChzY3JpcHRUeXBlKSB7XG4gICAgICAgICAgICBzY3JpcHROYW1lID0gc2NyaXB0VHlwZS5fX25hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBkZWxldGUgdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBpZiAoIXNjcmlwdERhdGEpIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBzY3JpcHRJbnN0YW5jZSA9IHNjcmlwdERhdGEuaW5zdGFuY2U7XG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZSAmJiAhc2NyaXB0SW5zdGFuY2UuX2Rlc3Ryb3llZCkge1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgc2NyaXB0SW5zdGFuY2UuX2Rlc3Ryb3llZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGFyZSBub3QgY3VycmVudGx5IGxvb3BpbmcgdGhyb3VnaCBvdXIgc2NyaXB0c1xuICAgICAgICAgICAgLy8gdGhlbiBpdCdzIHNhZmUgdG8gcmVtb3ZlIHRoZSBzY3JpcHRcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNMb29waW5nVGhyb3VnaFNjcmlwdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9yZW1vdmVTY3JpcHRJbnN0YW5jZShzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgaWYgKGluZCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoaW5kLCB0aGlzLl9zY3JpcHRzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgcHVzaCB0aGUgc2NyaXB0IGluIF9kZXN0cm95ZWRTY3JpcHRzIGFuZFxuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIF9zY3JpcHRzIHdoZW4gdGhlIGxvb3AgaXMgb3ZlclxuICAgICAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3llZFNjcmlwdHMucHVzaChzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgc3dhcCBldmVudFxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NyaXB0cy5vZmYoJ3N3YXA6JyArIHNjcmlwdE5hbWUsIHNjcmlwdERhdGEub25Td2FwKTtcblxuICAgICAgICBkZWxldGUgdGhpc1tzY3JpcHROYW1lXTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSB8fCBudWxsKTtcbiAgICAgICAgdGhpcy5maXJlKCdkZXN0cm95OicgKyBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSB8fCBudWxsKTtcblxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UpXG4gICAgICAgICAgICBzY3JpcHRJbnN0YW5jZS5maXJlKCdkZXN0cm95Jyk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3dhcCB0aGUgc2NyaXB0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8U2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGUgbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gSWYgaXQgd2FzIHN1Y2Nlc3NmdWxseSBzd2FwcGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3dhcChuYW1lT3JUeXBlKSB7XG4gICAgICAgIGxldCBzY3JpcHROYW1lID0gbmFtZU9yVHlwZTtcbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuXG4gICAgICAgIC8vIHNob3J0aGFuZCB1c2luZyBzY3JpcHQgbmFtZVxuICAgICAgICBpZiAodHlwZW9mIHNjcmlwdFR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY3JpcHRUeXBlID0gdGhpcy5zeXN0ZW0uYXBwLnNjcmlwdHMuZ2V0KHNjcmlwdFR5cGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHNjcmlwdFR5cGUpIHtcbiAgICAgICAgICAgIHNjcmlwdE5hbWUgPSBzY3JpcHRUeXBlLl9fbmFtZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXTtcbiAgICAgICAgaWYgKCFvbGQgfHwgIW9sZC5pbnN0YW5jZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlT2xkID0gb2xkLmluc3RhbmNlO1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9zY3JpcHRzLmluZGV4T2Yoc2NyaXB0SW5zdGFuY2VPbGQpO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gbmV3IHNjcmlwdFR5cGUoe1xuICAgICAgICAgICAgYXBwOiB0aGlzLnN5c3RlbS5hcHAsXG4gICAgICAgICAgICBlbnRpdHk6IHRoaXMuZW50aXR5LFxuICAgICAgICAgICAgZW5hYmxlZDogc2NyaXB0SW5zdGFuY2VPbGQuZW5hYmxlZCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHNjcmlwdEluc3RhbmNlT2xkLl9fYXR0cmlidXRlc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXNjcmlwdEluc3RhbmNlLnN3YXApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgc2NyaXB0SW5zdGFuY2UuX19pbml0aWFsaXplQXR0cmlidXRlcygpO1xuXG4gICAgICAgIC8vIGFkZCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fc2NyaXB0c1tpbmRdID0gc2NyaXB0SW5zdGFuY2U7XG4gICAgICAgIHRoaXMuX3NjcmlwdHNJbmRleFtzY3JpcHROYW1lXS5pbnN0YW5jZSA9IHNjcmlwdEluc3RhbmNlO1xuICAgICAgICB0aGlzW3NjcmlwdE5hbWVdID0gc2NyaXB0SW5zdGFuY2U7XG5cbiAgICAgICAgLy8gc2V0IGV4ZWN1dGlvbiBvcmRlciBhbmQgbWFrZSBzdXJlIHdlIHVwZGF0ZVxuICAgICAgICAvLyBvdXIgdXBkYXRlIGFuZCBwb3N0VXBkYXRlIGxpc3RzXG4gICAgICAgIHNjcmlwdEluc3RhbmNlLl9fZXhlY3V0aW9uT3JkZXIgPSBpbmQ7XG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZU9sZC51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2VPbGQucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QucmVtb3ZlKHNjcmlwdEluc3RhbmNlT2xkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JpcHRJbnN0YW5jZS51cGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0SW5zdGFuY2UucG9zdFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zdFVwZGF0ZUxpc3QuaW5zZXJ0KHNjcmlwdEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NjcmlwdE1ldGhvZChzY3JpcHRJbnN0YW5jZSwgU0NSSVBUX1NXQVAsIHNjcmlwdEluc3RhbmNlT2xkKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3N3YXAnLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnc3dhcDonICsgc2NyaXB0TmFtZSwgc2NyaXB0SW5zdGFuY2UpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZW4gYW4gZW50aXR5IGlzIGNsb25lZCBhbmQgaXQgaGFzIGVudGl0eSBzY3JpcHQgYXR0cmlidXRlcyB0aGF0IHBvaW50IHRvIG90aGVyIGVudGl0aWVzIGluXG4gICAgICogdGhlIHNhbWUgc3VidHJlZSB0aGF0IGlzIGNsb25lZCwgdGhlbiB3ZSB3YW50IHRoZSBuZXcgc2NyaXB0IGF0dHJpYnV0ZXMgdG8gcG9pbnQgYXQgdGhlXG4gICAgICogY2xvbmVkIGVudGl0aWVzLiBUaGlzIG1ldGhvZCByZW1hcHMgdGhlIHNjcmlwdCBhdHRyaWJ1dGVzIGZvciB0aGlzIGVudGl0eSBhbmQgaXQgYXNzdW1lc1xuICAgICAqIHRoYXQgdGhpcyBlbnRpdHkgaXMgdGhlIHJlc3VsdCBvZiB0aGUgY2xvbmUgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY3JpcHRDb21wb25lbnR9IG9sZFNjcmlwdENvbXBvbmVudCAtIFRoZSBzb3VyY2Ugc2NyaXB0IGNvbXBvbmVudCB0aGF0IGJlbG9uZ3MgdG9cbiAgICAgKiB0aGUgZW50aXR5IHRoYXQgd2FzIGJlaW5nIGNsb25lZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZHVwbGljYXRlZElkc01hcCAtIEEgZGljdGlvbmFyeSB3aXRoIGd1aWQtZW50aXR5IHZhbHVlcyB0aGF0IGNvbnRhaW5zIHRoZVxuICAgICAqIGVudGl0aWVzIHRoYXQgd2VyZSBjbG9uZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkU2NyaXB0Q29tcG9uZW50LCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGNvbnN0IG5ld1NjcmlwdENvbXBvbmVudCA9IHRoaXMuZW50aXR5LnNjcmlwdDtcblxuICAgICAgICAvLyBmb3IgZWFjaCBzY3JpcHQgaW4gdGhlIG9sZCBjb21wb25lbnRcbiAgICAgICAgZm9yIChjb25zdCBzY3JpcHROYW1lIGluIG9sZFNjcmlwdENvbXBvbmVudC5fc2NyaXB0c0luZGV4KSB7XG4gICAgICAgICAgICAvLyBnZXQgdGhlIHNjcmlwdCB0eXBlIGZyb20gdGhlIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0VHlwZSA9IHRoaXMuc3lzdGVtLmFwcC5zY3JpcHRzLmdldChzY3JpcHROYW1lKTtcbiAgICAgICAgICAgIGlmICghc2NyaXB0VHlwZSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIHNjcmlwdCBmcm9tIHRoZSBjb21wb25lbnQncyBpbmRleFxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gb2xkU2NyaXB0Q29tcG9uZW50Ll9zY3JpcHRzSW5kZXhbc2NyaXB0TmFtZV07XG4gICAgICAgICAgICBpZiAoIXNjcmlwdCB8fCAhc2NyaXB0Lmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIF9fYXR0cmlidXRlc1JhdyBleGlzdHMgdGhlbiBpdCBtZWFucyB0aGF0IHRoZSBuZXcgZW50aXR5XG4gICAgICAgICAgICAvLyBoYXMgbm90IHlldCBpbml0aWFsaXplZCBpdHMgYXR0cmlidXRlcyBzbyBwdXQgdGhlIG5ldyBndWlkIGluIHRoZXJlLFxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGl0IG1lYW5zIHRoYXQgdGhlIGF0dHJpYnV0ZXMgaGF2ZSBhbHJlYWR5IGJlZW4gaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgIC8vIHNvIGNvbnZlcnQgdGhlIG5ldyBndWlkIHRvIGFuIGVudGl0eVxuICAgICAgICAgICAgLy8gYW5kIHB1dCBpdCBpbiB0aGUgbmV3IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIGNvbnN0IG5ld0F0dHJpYnV0ZXNSYXcgPSBuZXdTY3JpcHRDb21wb25lbnRbc2NyaXB0TmFtZV0uX19hdHRyaWJ1dGVzUmF3O1xuICAgICAgICAgICAgY29uc3QgbmV3QXR0cmlidXRlcyA9IG5ld1NjcmlwdENvbXBvbmVudFtzY3JpcHROYW1lXS5fX2F0dHJpYnV0ZXM7XG4gICAgICAgICAgICBpZiAoIW5ld0F0dHJpYnV0ZXNSYXcgJiYgIW5ld0F0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIHVzaW5nIGF0dHJpYnV0ZXNSYXcgdGhlbiB1c2UgdGhlIGd1aWQgb3RoZXJ3aXNlIHVzZSB0aGUgZW50aXR5XG4gICAgICAgICAgICBjb25zdCB1c2VHdWlkID0gISFuZXdBdHRyaWJ1dGVzUmF3O1xuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIG9sZCBzY3JpcHQgYXR0cmlidXRlcyBmcm9tIHRoZSBpbnN0YW5jZVxuICAgICAgICAgICAgY29uc3Qgb2xkQXR0cmlidXRlcyA9IHNjcmlwdC5pbnN0YW5jZS5fX2F0dHJpYnV0ZXM7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZU5hbWUgaW4gb2xkQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgIGlmICghb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBnZXQgdGhlIGF0dHJpYnV0ZSBkZWZpbml0aW9uIGZyb20gdGhlIHNjcmlwdCB0eXBlXG4gICAgICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlID0gc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmdldChhdHRyaWJ1dGVOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlLnR5cGUgPT09ICdlbnRpdHknKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVudGl0eSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZUd1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdBdHRyaWJ1dGVzUmF3IHx8IG5ld0F0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHRyaWJ1dGUudHlwZSA9PT0gJ2pzb24nICYmIEFycmF5LmlzQXJyYXkoYXR0cmlidXRlLnNjaGVtYSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8ganNvbiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gb2xkQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3SnNvblZhbHVlID0gKG5ld0F0dHJpYnV0ZXNSYXcgPyBuZXdBdHRyaWJ1dGVzUmF3W2F0dHJpYnV0ZU5hbWVdIDogbmV3QXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRyaWJ1dGUuc2NoZW1hLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWVsZCA9IGF0dHJpYnV0ZS5zY2hlbWFbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGQudHlwZSAhPT0gJ2VudGl0eScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS5hcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgb2xkVmFsdWUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUVudGl0eVNjcmlwdEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmllbGQubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlW2pdW2ZpZWxkLm5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0pzb25WYWx1ZVtqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRJZHNNYXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVFbnRpdHlTY3JpcHRBdHRyaWJ1dGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZVtmaWVsZC5uYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlR3VpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3SnNvblZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkSWRzTWFwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1vdmUgc2NyaXB0IGluc3RhbmNlIHRvIGRpZmZlcmVudCBwb3NpdGlvbiB0byBhbHRlciB1cGRhdGUgb3JkZXIgb2Ygc2NyaXB0cyB3aXRoaW4gZW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Q2xhc3M8U2NyaXB0VHlwZT59IG5hbWVPclR5cGUgLSBUaGUgbmFtZSBvciB0eXBlIG9mIHtAbGluayBTY3JpcHRUeXBlfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kIC0gTmV3IHBvc2l0aW9uIGluZGV4LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBJZiBpdCB3YXMgc3VjY2Vzc2Z1bGx5IG1vdmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LnNjcmlwdC5tb3ZlKCdwbGF5ZXJDb250cm9sbGVyJywgMCk7XG4gICAgICovXG4gICAgbW92ZShuYW1lT3JUeXBlLCBpbmQpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgIGlmIChpbmQgPj0gbGVuIHx8IGluZCA8IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgbGV0IHNjcmlwdFR5cGUgPSBuYW1lT3JUeXBlO1xuICAgICAgICBsZXQgc2NyaXB0TmFtZSA9IG5hbWVPclR5cGU7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBzY3JpcHROYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgc2NyaXB0TmFtZSA9IG5hbWVPclR5cGUuX19uYW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0VHlwZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY3JpcHREYXRhID0gdGhpcy5fc2NyaXB0c0luZGV4W3NjcmlwdE5hbWVdO1xuICAgICAgICBpZiAoIXNjcmlwdERhdGEgfHwgIXNjcmlwdERhdGEuaW5zdGFuY2UpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gaWYgc2NyaXB0IHR5cGUgc3BlY2lmaWVkLCBtYWtlIHN1cmUgaW5zdGFuY2Ugb2Ygc2FpZCB0eXBlXG4gICAgICAgIGNvbnN0IHNjcmlwdEluc3RhbmNlID0gc2NyaXB0RGF0YS5pbnN0YW5jZTtcbiAgICAgICAgaWYgKHNjcmlwdFR5cGUgJiYgIShzY3JpcHRJbnN0YW5jZSBpbnN0YW5jZW9mIHNjcmlwdFR5cGUpKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGluZE9sZCA9IHRoaXMuX3NjcmlwdHMuaW5kZXhPZihzY3JpcHRJbnN0YW5jZSk7XG4gICAgICAgIGlmIChpbmRPbGQgPT09IC0xIHx8IGluZE9sZCA9PT0gaW5kKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIG1vdmUgc2NyaXB0IHRvIGFub3RoZXIgcG9zaXRpb25cbiAgICAgICAgdGhpcy5fc2NyaXB0cy5zcGxpY2UoaW5kLCAwLCB0aGlzLl9zY3JpcHRzLnNwbGljZShpbmRPbGQsIDEpWzBdKTtcblxuICAgICAgICAvLyByZXNldCBleGVjdXRpb24gb3JkZXIgZm9yIHNjcmlwdHMgYW5kIHJlLXNvcnQgdXBkYXRlIGFuZCBwb3N0VXBkYXRlIGxpc3RzXG4gICAgICAgIHRoaXMuX3Jlc2V0RXhlY3V0aW9uT3JkZXIoMCwgbGVuKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTGlzdC5zb3J0KCk7XG4gICAgICAgIHRoaXMuX3Bvc3RVcGRhdGVMaXN0LnNvcnQoKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ21vdmUnLCBzY3JpcHROYW1lLCBzY3JpcHRJbnN0YW5jZSwgaW5kLCBpbmRPbGQpO1xuICAgICAgICB0aGlzLmZpcmUoJ21vdmU6JyArIHNjcmlwdE5hbWUsIHNjcmlwdEluc3RhbmNlLCBpbmQsIGluZE9sZCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY3JpcHRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJTY3JpcHRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9zY3JpcHRzIiwiX3VwZGF0ZUxpc3QiLCJTb3J0ZWRMb29wQXJyYXkiLCJzb3J0QnkiLCJfcG9zdFVwZGF0ZUxpc3QiLCJfc2NyaXB0c0luZGV4IiwiX2Rlc3Ryb3llZFNjcmlwdHMiLCJfZGVzdHJveWVkIiwiX3NjcmlwdHNEYXRhIiwiX29sZFN0YXRlIiwiX2VuYWJsZWQiLCJfYmVpbmdFbmFibGVkIiwiX2lzTG9vcGluZ1Rocm91Z2hTY3JpcHRzIiwiX2V4ZWN1dGlvbk9yZGVyIiwib24iLCJfb25TZXRFbmFibGVkIiwic2NyaXB0cyIsInZhbHVlIiwia2V5IiwiaGFzT3duUHJvcGVydHkiLCJzY3JpcHQiLCJlbmFibGVkIiwiYXR0cmlidXRlcyIsImF0dHIiLCJTY3JpcHRBdHRyaWJ1dGVzIiwicmVzZXJ2ZWROYW1lcyIsImhhcyIsIl9fYXR0cmlidXRlcyIsInNjcmlwdFR5cGUiLCJhcHAiLCJnZXQiLCJhZGQiLCJjb25zb2xlIiwibG9nIiwib3JkZXIiLCJvbGRWYWx1ZSIsImZpcmUiLCJvbkVuYWJsZSIsIl9jaGVja1N0YXRlIiwib25Qb3N0U3RhdGVDaGFuZ2UiLCJvbkRpc2FibGUiLCJ3YXNMb29waW5nIiwiX2JlZ2luTG9vcGluZyIsImkiLCJsZW4iLCJsZW5ndGgiLCJfaW5pdGlhbGl6ZWQiLCJfcG9zdEluaXRpYWxpemVkIiwicG9zdEluaXRpYWxpemUiLCJfc2NyaXB0TWV0aG9kIiwiU0NSSVBUX1BPU1RfSU5JVElBTElaRSIsIl9lbmRMb29waW5nIiwibG9vcGluZyIsIndhc0xvb3BpbmdCZWZvcmUiLCJfcmVtb3ZlRGVzdHJveWVkU2NyaXB0cyIsInByb3AiLCJvbGQiLCJzdGF0ZSIsIl9hZGRDb21wb25lbnRUb0VuYWJsZWQiLCJfcmVtb3ZlQ29tcG9uZW50RnJvbUVuYWJsZWQiLCJfb25CZWZvcmVSZW1vdmUiLCJkZXN0cm95IiwiX19zY3JpcHRUeXBlIiwiX19uYW1lIiwiX3JlbW92ZVNjcmlwdEluc3RhbmNlIiwiX3Jlc2V0RXhlY3V0aW9uT3JkZXIiLCJfb25Jbml0aWFsaXplQXR0cmlidXRlcyIsIl9faW5pdGlhbGl6ZUF0dHJpYnV0ZXMiLCJtZXRob2QiLCJhcmciLCJleCIsIl9jYWxsYmFja3MiLCJlcnJvciIsIndhcm4iLCJfb25Jbml0aWFsaXplIiwiaW5pdGlhbGl6ZSIsIlNDUklQVF9JTklUSUFMSVpFIiwiX29uUG9zdEluaXRpYWxpemUiLCJfb25VcGRhdGUiLCJkdCIsImxpc3QiLCJsb29wSW5kZXgiLCJpdGVtcyIsIlNDUklQVF9VUERBVEUiLCJfb25Qb3N0VXBkYXRlIiwiU0NSSVBUX1BPU1RfVVBEQVRFIiwiX2luc2VydFNjcmlwdEluc3RhbmNlIiwic2NyaXB0SW5zdGFuY2UiLCJpbmRleCIsInNjcmlwdHNMZW5ndGgiLCJwdXNoIiwiX19leGVjdXRpb25PcmRlciIsInVwZGF0ZSIsImFwcGVuZCIsInBvc3RVcGRhdGUiLCJzcGxpY2UiLCJpbnNlcnQiLCJpZHgiLCJpbmRleE9mIiwicmVtb3ZlIiwic3RhcnRJbmRleCIsIl9yZXNvbHZlRW50aXR5U2NyaXB0QXR0cmlidXRlIiwiYXR0cmlidXRlIiwiYXR0cmlidXRlTmFtZSIsInVzZUd1aWQiLCJuZXdBdHRyaWJ1dGVzIiwiZHVwbGljYXRlZElkc01hcCIsImFycmF5IiwibmV3R3VpZEFycmF5Iiwic2xpY2UiLCJndWlkIiwiRW50aXR5IiwiZ2V0R3VpZCIsIm5hbWVPclR5cGUiLCJzY3JpcHROYW1lIiwic2NyaXB0RGF0YSIsImluc3RhbmNlIiwiZGF0YSIsImNyZWF0ZSIsImFyZ3MiLCJzZWxmIiwiaW5kIiwib25Td2FwIiwic3dhcCIsInByZWxvYWRpbmciLCJEZWJ1ZyIsIm5hbWUiLCJhd2FpdGluZyIsIm9mZiIsInNjcmlwdEluc3RhbmNlT2xkIiwiU0NSSVBUX1NXQVAiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJvbGRTY3JpcHRDb21wb25lbnQiLCJuZXdTY3JpcHRDb21wb25lbnQiLCJuZXdBdHRyaWJ1dGVzUmF3IiwiX19hdHRyaWJ1dGVzUmF3Iiwib2xkQXR0cmlidXRlcyIsInR5cGUiLCJBcnJheSIsImlzQXJyYXkiLCJzY2hlbWEiLCJuZXdKc29uVmFsdWUiLCJmaWVsZCIsImoiLCJtb3ZlIiwiaW5kT2xkIiwic29ydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBc0JBLE1BQU1BLGVBQWUsU0FBU0MsU0FBUyxDQUFDO0FBT3BDQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQ3hCLElBQUEsS0FBSyxDQUFDRCxNQUFNLEVBQUVDLE1BQU0sQ0FBQyxDQUFBOztJQVFyQixJQUFJLENBQUNDLFFBQVEsR0FBRyxFQUFFLENBQUE7QUFFbEIsSUFBQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJQyxlQUFlLENBQUM7QUFBRUMsTUFBQUEsTUFBTSxFQUFFLGtCQUFBO0FBQW1CLEtBQUMsQ0FBQyxDQUFBO0FBRXRFLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUcsSUFBSUYsZUFBZSxDQUFDO0FBQUVDLE1BQUFBLE1BQU0sRUFBRSxrQkFBQTtBQUFtQixLQUFDLENBQUMsQ0FBQTtBQUUxRSxJQUFBLElBQUksQ0FBQ0UsYUFBYSxHQUFHLEVBQUUsQ0FBQTtJQUN2QixJQUFJLENBQUNDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQTtJQUMzQixJQUFJLENBQUNDLFVBQVUsR0FBRyxLQUFLLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsSUFBSSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsU0FBUyxHQUFHLElBQUksQ0FBQTs7SUFJckIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBOztJQUdwQixJQUFJLENBQUNDLGFBQWEsR0FBRyxLQUFLLENBQUE7SUFJMUIsSUFBSSxDQUFDQyx3QkFBd0IsR0FBRyxLQUFLLENBQUE7O0FBSXJDLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFFekIsSUFBSSxDQUFDQyxFQUFFLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQ0MsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3BELEdBQUE7O0VBMElBLElBQUlDLE9BQU8sQ0FBQ0MsS0FBSyxFQUFFO0lBQ2YsSUFBSSxDQUFDVCxZQUFZLEdBQUdTLEtBQUssQ0FBQTtBQUV6QixJQUFBLEtBQUssTUFBTUMsR0FBRyxJQUFJRCxLQUFLLEVBQUU7QUFDckIsTUFBQSxJQUFJLENBQUNBLEtBQUssQ0FBQ0UsY0FBYyxDQUFDRCxHQUFHLENBQUMsRUFDMUIsU0FBQTtBQUVKLE1BQUEsTUFBTUUsTUFBTSxHQUFHLElBQUksQ0FBQ2YsYUFBYSxDQUFDYSxHQUFHLENBQUMsQ0FBQTtBQUN0QyxNQUFBLElBQUlFLE1BQU0sRUFBRTs7UUFJUixJQUFJLE9BQU9ILEtBQUssQ0FBQ0MsR0FBRyxDQUFDLENBQUNHLE9BQU8sS0FBSyxTQUFTLEVBQ3ZDRCxNQUFNLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUNKLEtBQUssQ0FBQ0MsR0FBRyxDQUFDLENBQUNHLE9BQU8sQ0FBQTs7UUFHekMsSUFBSSxPQUFPSixLQUFLLENBQUNDLEdBQUcsQ0FBQyxDQUFDSSxVQUFVLEtBQUssUUFBUSxFQUFFO1VBQzNDLEtBQUssTUFBTUMsSUFBSSxJQUFJTixLQUFLLENBQUNDLEdBQUcsQ0FBQyxDQUFDSSxVQUFVLEVBQUU7WUFDdEMsSUFBSUUsZ0JBQWdCLENBQUNDLGFBQWEsQ0FBQ0MsR0FBRyxDQUFDSCxJQUFJLENBQUMsRUFDeEMsU0FBQTtZQUVKLElBQUksQ0FBQ0gsTUFBTSxDQUFDTyxZQUFZLENBQUNSLGNBQWMsQ0FBQ0ksSUFBSSxDQUFDLEVBQUU7QUFFM0MsY0FBQSxNQUFNSyxVQUFVLEdBQUcsSUFBSSxDQUFDOUIsTUFBTSxDQUFDK0IsR0FBRyxDQUFDYixPQUFPLENBQUNjLEdBQUcsQ0FBQ1osR0FBRyxDQUFDLENBQUE7QUFDbkQsY0FBQSxJQUFJVSxVQUFVLEVBQ1ZBLFVBQVUsQ0FBQ04sVUFBVSxDQUFDUyxHQUFHLENBQUNSLElBQUksRUFBRSxFQUFHLENBQUMsQ0FBQTtBQUM1QyxhQUFBOztBQUdBSCxZQUFBQSxNQUFNLENBQUNHLElBQUksQ0FBQyxHQUFHTixLQUFLLENBQUNDLEdBQUcsQ0FBQyxDQUFDSSxVQUFVLENBQUNDLElBQUksQ0FBQyxDQUFBO0FBQzlDLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQyxNQUFNO0FBR0hTLFFBQUFBLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ0MsS0FBSyxDQUFDLENBQUE7QUFDM0IsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJbEIsT0FBTyxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUNoQixRQUFRLENBQUE7QUFDeEIsR0FBQTtFQUVBLElBQUlxQixPQUFPLENBQUNKLEtBQUssRUFBRTtBQUNmLElBQUEsTUFBTWtCLFFBQVEsR0FBRyxJQUFJLENBQUN6QixRQUFRLENBQUE7SUFDOUIsSUFBSSxDQUFDQSxRQUFRLEdBQUdPLEtBQUssQ0FBQTtJQUNyQixJQUFJLENBQUNtQixJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRUQsUUFBUSxFQUFFbEIsS0FBSyxDQUFDLENBQUE7QUFDaEQsR0FBQTtBQUVBLEVBQUEsSUFBSUksT0FBTyxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUNYLFFBQVEsQ0FBQTtBQUN4QixHQUFBO0FBRUEyQixFQUFBQSxRQUFRLEdBQUc7SUFDUCxJQUFJLENBQUMxQixhQUFhLEdBQUcsSUFBSSxDQUFBO0lBQ3pCLElBQUksQ0FBQzJCLFdBQVcsRUFBRSxDQUFBO0FBRWxCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3ZDLE1BQU0sQ0FBQ1ksYUFBYSxFQUFFO01BQzVCLElBQUksQ0FBQzRCLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsS0FBQTtJQUVBLElBQUksQ0FBQzVCLGFBQWEsR0FBRyxLQUFLLENBQUE7QUFDOUIsR0FBQTtBQUVBNkIsRUFBQUEsU0FBUyxHQUFHO0lBQ1IsSUFBSSxDQUFDRixXQUFXLEVBQUUsQ0FBQTtBQUN0QixHQUFBO0FBRUFDLEVBQUFBLGlCQUFpQixHQUFHO0FBQ2hCLElBQUEsTUFBTUUsVUFBVSxHQUFHLElBQUksQ0FBQ0MsYUFBYSxFQUFFLENBQUE7QUFFdkMsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVDLEdBQUcsR0FBRyxJQUFJLENBQUM1QixPQUFPLENBQUM2QixNQUFNLEVBQUVGLENBQUMsR0FBR0MsR0FBRyxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNyRCxNQUFBLE1BQU12QixNQUFNLEdBQUcsSUFBSSxDQUFDSixPQUFPLENBQUMyQixDQUFDLENBQUMsQ0FBQTtBQUU5QixNQUFBLElBQUl2QixNQUFNLENBQUMwQixZQUFZLElBQUksQ0FBQzFCLE1BQU0sQ0FBQzJCLGdCQUFnQixJQUFJM0IsTUFBTSxDQUFDQyxPQUFPLEVBQUU7UUFDbkVELE1BQU0sQ0FBQzJCLGdCQUFnQixHQUFHLElBQUksQ0FBQTtRQUU5QixJQUFJM0IsTUFBTSxDQUFDNEIsY0FBYyxFQUNyQixJQUFJLENBQUNDLGFBQWEsQ0FBQzdCLE1BQU0sRUFBRThCLHNCQUFzQixDQUFDLENBQUE7QUFDMUQsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ0MsV0FBVyxDQUFDVixVQUFVLENBQUMsQ0FBQTtBQUNoQyxHQUFBOztBQUlBQyxFQUFBQSxhQUFhLEdBQUc7QUFDWixJQUFBLE1BQU1VLE9BQU8sR0FBRyxJQUFJLENBQUN4Qyx3QkFBd0IsQ0FBQTtJQUM3QyxJQUFJLENBQUNBLHdCQUF3QixHQUFHLElBQUksQ0FBQTtBQUNwQyxJQUFBLE9BQU93QyxPQUFPLENBQUE7QUFDbEIsR0FBQTs7RUFJQUQsV0FBVyxDQUFDRSxnQkFBZ0IsRUFBRTtJQUMxQixJQUFJLENBQUN6Qyx3QkFBd0IsR0FBR3lDLGdCQUFnQixDQUFBO0FBQ2hELElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3pDLHdCQUF3QixFQUFFO01BQ2hDLElBQUksQ0FBQzBDLHVCQUF1QixFQUFFLENBQUE7QUFDbEMsS0FBQTtBQUNKLEdBQUE7O0FBS0F2QyxFQUFBQSxhQUFhLENBQUN3QyxJQUFJLEVBQUVDLEdBQUcsRUFBRXZDLEtBQUssRUFBRTtJQUM1QixJQUFJLENBQUNOLGFBQWEsR0FBRyxJQUFJLENBQUE7SUFDekIsSUFBSSxDQUFDMkIsV0FBVyxFQUFFLENBQUE7SUFDbEIsSUFBSSxDQUFDM0IsYUFBYSxHQUFHLEtBQUssQ0FBQTtBQUM5QixHQUFBO0FBRUEyQixFQUFBQSxXQUFXLEdBQUc7SUFDVixNQUFNbUIsS0FBSyxHQUFHLElBQUksQ0FBQ3BDLE9BQU8sSUFBSSxJQUFJLENBQUN0QixNQUFNLENBQUNzQixPQUFPLENBQUE7QUFDakQsSUFBQSxJQUFJb0MsS0FBSyxLQUFLLElBQUksQ0FBQ2hELFNBQVMsRUFDeEIsT0FBQTtJQUVKLElBQUksQ0FBQ0EsU0FBUyxHQUFHZ0QsS0FBSyxDQUFBO0lBRXRCLElBQUksQ0FBQ3JCLElBQUksQ0FBQ3FCLEtBQUssR0FBRyxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUE7QUFDdkMsSUFBQSxJQUFJLENBQUNyQixJQUFJLENBQUMsT0FBTyxFQUFFcUIsS0FBSyxDQUFDLENBQUE7QUFFekIsSUFBQSxJQUFJQSxLQUFLLEVBQUU7QUFDUCxNQUFBLElBQUksQ0FBQzNELE1BQU0sQ0FBQzRELHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFBO0FBQzVDLEtBQUMsTUFBTTtBQUNILE1BQUEsSUFBSSxDQUFDNUQsTUFBTSxDQUFDNkQsMkJBQTJCLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDakQsS0FBQTtBQUVBLElBQUEsTUFBTWxCLFVBQVUsR0FBRyxJQUFJLENBQUNDLGFBQWEsRUFBRSxDQUFBO0FBRXZDLElBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxHQUFHLEdBQUcsSUFBSSxDQUFDNUIsT0FBTyxDQUFDNkIsTUFBTSxFQUFFRixDQUFDLEdBQUdDLEdBQUcsRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDckQsTUFBQSxNQUFNdkIsTUFBTSxHQUFHLElBQUksQ0FBQ0osT0FBTyxDQUFDMkIsQ0FBQyxDQUFDLENBQUE7QUFDOUJ2QixNQUFBQSxNQUFNLENBQUNDLE9BQU8sR0FBR0QsTUFBTSxDQUFDVixRQUFRLENBQUE7QUFDcEMsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDeUMsV0FBVyxDQUFDVixVQUFVLENBQUMsQ0FBQTtBQUNoQyxHQUFBO0FBRUFtQixFQUFBQSxlQUFlLEdBQUc7QUFDZCxJQUFBLElBQUksQ0FBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUVuQixJQUFBLE1BQU1LLFVBQVUsR0FBRyxJQUFJLENBQUNDLGFBQWEsRUFBRSxDQUFBOztBQUd2QyxJQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzNCLE9BQU8sQ0FBQzZCLE1BQU0sRUFBRUYsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsTUFBQSxNQUFNdkIsTUFBTSxHQUFHLElBQUksQ0FBQ0osT0FBTyxDQUFDMkIsQ0FBQyxDQUFDLENBQUE7TUFDOUIsSUFBSSxDQUFDdkIsTUFBTSxFQUFFLFNBQUE7TUFFYixJQUFJLENBQUN5QyxPQUFPLENBQUN6QyxNQUFNLENBQUMwQyxZQUFZLENBQUNDLE1BQU0sQ0FBQyxDQUFBO0FBQzVDLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ1osV0FBVyxDQUFDVixVQUFVLENBQUMsQ0FBQTtBQUNoQyxHQUFBO0FBRUFhLEVBQUFBLHVCQUF1QixHQUFHO0FBQ3RCLElBQUEsTUFBTVYsR0FBRyxHQUFHLElBQUksQ0FBQ3RDLGlCQUFpQixDQUFDdUMsTUFBTSxDQUFBO0lBQ3pDLElBQUksQ0FBQ0QsR0FBRyxFQUFFLE9BQUE7SUFFVixLQUFLLElBQUlELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0MsR0FBRyxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMxQixNQUFBLE1BQU12QixNQUFNLEdBQUcsSUFBSSxDQUFDZCxpQkFBaUIsQ0FBQ3FDLENBQUMsQ0FBQyxDQUFBO0FBQ3hDLE1BQUEsSUFBSSxDQUFDcUIscUJBQXFCLENBQUM1QyxNQUFNLENBQUMsQ0FBQTtBQUN0QyxLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUNkLGlCQUFpQixDQUFDdUMsTUFBTSxHQUFHLENBQUMsQ0FBQTs7SUFHakMsSUFBSSxDQUFDb0Isb0JBQW9CLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQ2pFLFFBQVEsQ0FBQzZDLE1BQU0sQ0FBQyxDQUFBO0FBQ3RELEdBQUE7QUFFQXFCLEVBQUFBLHVCQUF1QixHQUFHO0FBQ3RCLElBQUEsS0FBSyxJQUFJdkIsQ0FBQyxHQUFHLENBQUMsRUFBRUMsR0FBRyxHQUFHLElBQUksQ0FBQzVCLE9BQU8sQ0FBQzZCLE1BQU0sRUFBRUYsQ0FBQyxHQUFHQyxHQUFHLEVBQUVELENBQUMsRUFBRSxFQUNuRCxJQUFJLENBQUMzQixPQUFPLENBQUMyQixDQUFDLENBQUMsQ0FBQ3dCLHNCQUFzQixFQUFFLENBQUE7QUFDaEQsR0FBQTtBQUVBbEIsRUFBQUEsYUFBYSxDQUFDN0IsTUFBTSxFQUFFZ0QsTUFBTSxFQUFFQyxHQUFHLEVBQUU7SUFFL0IsSUFBSTtBQUVBakQsTUFBQUEsTUFBTSxDQUFDZ0QsTUFBTSxDQUFDLENBQUNDLEdBQUcsQ0FBQyxDQUFBO0tBRXRCLENBQUMsT0FBT0MsRUFBRSxFQUFFO01BRVRsRCxNQUFNLENBQUNDLE9BQU8sR0FBRyxLQUFLLENBQUE7TUFFdEIsSUFBSSxDQUFDRCxNQUFNLENBQUNtRCxVQUFVLElBQUksQ0FBQ25ELE1BQU0sQ0FBQ21ELFVBQVUsQ0FBQ0MsS0FBSyxFQUFFO0FBQ2hEeEMsUUFBQUEsT0FBTyxDQUFDeUMsSUFBSSxDQUFFLENBQUEsbUNBQUEsRUFBcUNMLE1BQU8sQ0FBU2hELE9BQUFBLEVBQUFBLE1BQU0sQ0FBQzBDLFlBQVksQ0FBQ0MsTUFBTyxDQUFXLFVBQUEsQ0FBQSxFQUFFTyxFQUFFLENBQUMsQ0FBQTtBQUM5R3RDLFFBQUFBLE9BQU8sQ0FBQ3dDLEtBQUssQ0FBQ0YsRUFBRSxDQUFDLENBQUE7QUFDckIsT0FBQTtNQUVBbEQsTUFBTSxDQUFDZ0IsSUFBSSxDQUFDLE9BQU8sRUFBRWtDLEVBQUUsRUFBRUYsTUFBTSxDQUFDLENBQUE7TUFDaEMsSUFBSSxDQUFDaEMsSUFBSSxDQUFDLE9BQU8sRUFBRWhCLE1BQU0sRUFBRWtELEVBQUUsRUFBRUYsTUFBTSxDQUFDLENBQUE7QUFDMUMsS0FBQTtBQUVKLEdBQUE7QUFFQU0sRUFBQUEsYUFBYSxHQUFHO0FBQ1osSUFBQSxNQUFNMUQsT0FBTyxHQUFHLElBQUksQ0FBQ2hCLFFBQVEsQ0FBQTtBQUU3QixJQUFBLE1BQU15QyxVQUFVLEdBQUcsSUFBSSxDQUFDQyxhQUFhLEVBQUUsQ0FBQTtBQUV2QyxJQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsR0FBRyxHQUFHNUIsT0FBTyxDQUFDNkIsTUFBTSxFQUFFRixDQUFDLEdBQUdDLEdBQUcsRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDaEQsTUFBQSxNQUFNdkIsTUFBTSxHQUFHSixPQUFPLENBQUMyQixDQUFDLENBQUMsQ0FBQTtNQUN6QixJQUFJLENBQUN2QixNQUFNLENBQUMwQixZQUFZLElBQUkxQixNQUFNLENBQUNDLE9BQU8sRUFBRTtRQUN4Q0QsTUFBTSxDQUFDMEIsWUFBWSxHQUFHLElBQUksQ0FBQTtRQUMxQixJQUFJMUIsTUFBTSxDQUFDdUQsVUFBVSxFQUNqQixJQUFJLENBQUMxQixhQUFhLENBQUM3QixNQUFNLEVBQUV3RCxpQkFBaUIsQ0FBQyxDQUFBO0FBQ3JELE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUN6QixXQUFXLENBQUNWLFVBQVUsQ0FBQyxDQUFBO0FBQ2hDLEdBQUE7QUFFQW9DLEVBQUFBLGlCQUFpQixHQUFHO0lBQ2hCLElBQUksQ0FBQ3RDLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsR0FBQTtFQUVBdUMsU0FBUyxDQUFDQyxFQUFFLEVBQUU7QUFDVixJQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJLENBQUMvRSxXQUFXLENBQUE7QUFDN0IsSUFBQSxJQUFJLENBQUMrRSxJQUFJLENBQUNuQyxNQUFNLEVBQUUsT0FBQTtBQUVsQixJQUFBLE1BQU1KLFVBQVUsR0FBRyxJQUFJLENBQUNDLGFBQWEsRUFBRSxDQUFBO0FBRXZDLElBQUEsS0FBS3NDLElBQUksQ0FBQ0MsU0FBUyxHQUFHLENBQUMsRUFBRUQsSUFBSSxDQUFDQyxTQUFTLEdBQUdELElBQUksQ0FBQ25DLE1BQU0sRUFBRW1DLElBQUksQ0FBQ0MsU0FBUyxFQUFFLEVBQUU7TUFDckUsTUFBTTdELE1BQU0sR0FBRzRELElBQUksQ0FBQ0UsS0FBSyxDQUFDRixJQUFJLENBQUNDLFNBQVMsQ0FBQyxDQUFBO01BQ3pDLElBQUk3RCxNQUFNLENBQUNDLE9BQU8sRUFBRTtRQUNoQixJQUFJLENBQUM0QixhQUFhLENBQUM3QixNQUFNLEVBQUUrRCxhQUFhLEVBQUVKLEVBQUUsQ0FBQyxDQUFBO0FBQ2pELE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUM1QixXQUFXLENBQUNWLFVBQVUsQ0FBQyxDQUFBO0FBQ2hDLEdBQUE7RUFFQTJDLGFBQWEsQ0FBQ0wsRUFBRSxFQUFFO0FBQ2QsSUFBQSxNQUFNQyxJQUFJLEdBQUcsSUFBSSxDQUFDNUUsZUFBZSxDQUFBO0FBQ2pDLElBQUEsSUFBSSxDQUFDNEUsSUFBSSxDQUFDbkMsTUFBTSxFQUFFLE9BQUE7QUFFbEIsSUFBQSxNQUFNSixVQUFVLEdBQUcsSUFBSSxDQUFDQyxhQUFhLEVBQUUsQ0FBQTtBQUV2QyxJQUFBLEtBQUtzQyxJQUFJLENBQUNDLFNBQVMsR0FBRyxDQUFDLEVBQUVELElBQUksQ0FBQ0MsU0FBUyxHQUFHRCxJQUFJLENBQUNuQyxNQUFNLEVBQUVtQyxJQUFJLENBQUNDLFNBQVMsRUFBRSxFQUFFO01BQ3JFLE1BQU03RCxNQUFNLEdBQUc0RCxJQUFJLENBQUNFLEtBQUssQ0FBQ0YsSUFBSSxDQUFDQyxTQUFTLENBQUMsQ0FBQTtNQUN6QyxJQUFJN0QsTUFBTSxDQUFDQyxPQUFPLEVBQUU7UUFDaEIsSUFBSSxDQUFDNEIsYUFBYSxDQUFDN0IsTUFBTSxFQUFFaUUsa0JBQWtCLEVBQUVOLEVBQUUsQ0FBQyxDQUFBO0FBQ3RELE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUM1QixXQUFXLENBQUNWLFVBQVUsQ0FBQyxDQUFBO0FBQ2hDLEdBQUE7O0FBWUE2QyxFQUFBQSxxQkFBcUIsQ0FBQ0MsY0FBYyxFQUFFQyxLQUFLLEVBQUVDLGFBQWEsRUFBRTtBQUN4RCxJQUFBLElBQUlELEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRTtBQUVkLE1BQUEsSUFBSSxDQUFDeEYsUUFBUSxDQUFDMEYsSUFBSSxDQUFDSCxjQUFjLENBQUMsQ0FBQTtNQUNsQ0EsY0FBYyxDQUFDSSxnQkFBZ0IsR0FBR0YsYUFBYSxDQUFBOztNQUcvQyxJQUFJRixjQUFjLENBQUNLLE1BQU0sRUFBRTtBQUN2QixRQUFBLElBQUksQ0FBQzNGLFdBQVcsQ0FBQzRGLE1BQU0sQ0FBQ04sY0FBYyxDQUFDLENBQUE7QUFDM0MsT0FBQTs7TUFHQSxJQUFJQSxjQUFjLENBQUNPLFVBQVUsRUFBRTtBQUMzQixRQUFBLElBQUksQ0FBQzFGLGVBQWUsQ0FBQ3lGLE1BQU0sQ0FBQ04sY0FBYyxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUMsTUFBTTtNQUVILElBQUksQ0FBQ3ZGLFFBQVEsQ0FBQytGLE1BQU0sQ0FBQ1AsS0FBSyxFQUFFLENBQUMsRUFBRUQsY0FBYyxDQUFDLENBQUE7TUFDOUNBLGNBQWMsQ0FBQ0ksZ0JBQWdCLEdBQUdILEtBQUssQ0FBQTs7TUFJdkMsSUFBSSxDQUFDdkIsb0JBQW9CLENBQUN1QixLQUFLLEdBQUcsQ0FBQyxFQUFFQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUE7O01BSXZELElBQUlGLGNBQWMsQ0FBQ0ssTUFBTSxFQUFFO0FBQ3ZCLFFBQUEsSUFBSSxDQUFDM0YsV0FBVyxDQUFDK0YsTUFBTSxDQUFDVCxjQUFjLENBQUMsQ0FBQTtBQUMzQyxPQUFBOztNQUlBLElBQUlBLGNBQWMsQ0FBQ08sVUFBVSxFQUFFO0FBQzNCLFFBQUEsSUFBSSxDQUFDMUYsZUFBZSxDQUFDNEYsTUFBTSxDQUFDVCxjQUFjLENBQUMsQ0FBQTtBQUMvQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQXZCLHFCQUFxQixDQUFDdUIsY0FBYyxFQUFFO0lBQ2xDLE1BQU1VLEdBQUcsR0FBRyxJQUFJLENBQUNqRyxRQUFRLENBQUNrRyxPQUFPLENBQUNYLGNBQWMsQ0FBQyxDQUFBO0FBQ2pELElBQUEsSUFBSVUsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLE9BQU9BLEdBQUcsQ0FBQTtJQUUxQixJQUFJLENBQUNqRyxRQUFRLENBQUMrRixNQUFNLENBQUNFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUU1QixJQUFJVixjQUFjLENBQUNLLE1BQU0sRUFBRTtBQUN2QixNQUFBLElBQUksQ0FBQzNGLFdBQVcsQ0FBQ2tHLE1BQU0sQ0FBQ1osY0FBYyxDQUFDLENBQUE7QUFDM0MsS0FBQTtJQUVBLElBQUlBLGNBQWMsQ0FBQ08sVUFBVSxFQUFFO0FBQzNCLE1BQUEsSUFBSSxDQUFDMUYsZUFBZSxDQUFDK0YsTUFBTSxDQUFDWixjQUFjLENBQUMsQ0FBQTtBQUMvQyxLQUFBO0FBRUEsSUFBQSxPQUFPVSxHQUFHLENBQUE7QUFDZCxHQUFBO0FBRUFoQyxFQUFBQSxvQkFBb0IsQ0FBQ21DLFVBQVUsRUFBRVgsYUFBYSxFQUFFO0lBQzVDLEtBQUssSUFBSTlDLENBQUMsR0FBR3lELFVBQVUsRUFBRXpELENBQUMsR0FBRzhDLGFBQWEsRUFBRTlDLENBQUMsRUFBRSxFQUFFO01BQzdDLElBQUksQ0FBQzNDLFFBQVEsQ0FBQzJDLENBQUMsQ0FBQyxDQUFDZ0QsZ0JBQWdCLEdBQUdoRCxDQUFDLENBQUE7QUFDekMsS0FBQTtBQUNKLEdBQUE7QUFFQTBELEVBQUFBLDZCQUE2QixDQUFDQyxTQUFTLEVBQUVDLGFBQWEsRUFBRXBFLFFBQVEsRUFBRXFFLE9BQU8sRUFBRUMsYUFBYSxFQUFFQyxnQkFBZ0IsRUFBRTtJQUN4RyxJQUFJSixTQUFTLENBQUNLLEtBQUssRUFBRTtBQUVqQixNQUFBLE1BQU0vRCxHQUFHLEdBQUdULFFBQVEsQ0FBQ1UsTUFBTSxDQUFBO01BQzNCLElBQUksQ0FBQ0QsR0FBRyxFQUFFO0FBQ04sUUFBQSxPQUFBO0FBQ0osT0FBQTtBQUVBLE1BQUEsTUFBTWdFLFlBQVksR0FBR3pFLFFBQVEsQ0FBQzBFLEtBQUssRUFBRSxDQUFBO01BQ3JDLEtBQUssSUFBSWxFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0MsR0FBRyxFQUFFRCxDQUFDLEVBQUUsRUFBRTtRQUMxQixNQUFNbUUsSUFBSSxHQUFHRixZQUFZLENBQUNqRSxDQUFDLENBQUMsWUFBWW9FLE1BQU0sR0FBR0gsWUFBWSxDQUFDakUsQ0FBQyxDQUFDLENBQUNxRSxPQUFPLEVBQUUsR0FBR0osWUFBWSxDQUFDakUsQ0FBQyxDQUFDLENBQUE7QUFDNUYsUUFBQSxJQUFJK0QsZ0JBQWdCLENBQUNJLElBQUksQ0FBQyxFQUFFO0FBQ3hCRixVQUFBQSxZQUFZLENBQUNqRSxDQUFDLENBQUMsR0FBRzZELE9BQU8sR0FBR0UsZ0JBQWdCLENBQUNJLElBQUksQ0FBQyxDQUFDRSxPQUFPLEVBQUUsR0FBR04sZ0JBQWdCLENBQUNJLElBQUksQ0FBQyxDQUFBO0FBQ3pGLFNBQUE7QUFDSixPQUFBO0FBRUFMLE1BQUFBLGFBQWEsQ0FBQ0YsYUFBYSxDQUFDLEdBQUdLLFlBQVksQ0FBQTtBQUMvQyxLQUFDLE1BQU07TUFFSCxJQUFJekUsUUFBUSxZQUFZNEUsTUFBTSxFQUFFO0FBQzVCNUUsUUFBQUEsUUFBUSxHQUFHQSxRQUFRLENBQUM2RSxPQUFPLEVBQUUsQ0FBQTtBQUNqQyxPQUFDLE1BQU0sSUFBSSxPQUFPN0UsUUFBUSxLQUFLLFFBQVEsRUFBRTtBQUNyQyxRQUFBLE9BQUE7QUFDSixPQUFBO0FBRUEsTUFBQSxJQUFJdUUsZ0JBQWdCLENBQUN2RSxRQUFRLENBQUMsRUFBRTtBQUM1QnNFLFFBQUFBLGFBQWEsQ0FBQ0YsYUFBYSxDQUFDLEdBQUdHLGdCQUFnQixDQUFDdkUsUUFBUSxDQUFDLENBQUE7QUFDN0QsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztFQVlBVCxHQUFHLENBQUN1RixVQUFVLEVBQUU7QUFDWixJQUFBLElBQUksT0FBT0EsVUFBVSxLQUFLLFFBQVEsRUFBRTtBQUNoQyxNQUFBLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQzVHLGFBQWEsQ0FBQzRHLFVBQVUsQ0FBQyxDQUFBO0FBQzNDLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ0EsVUFBVSxFQUFFLE9BQU8sS0FBSyxDQUFBO0lBQzdCLE1BQU1yRixVQUFVLEdBQUdxRixVQUFVLENBQUE7QUFDN0IsSUFBQSxNQUFNQyxVQUFVLEdBQUd0RixVQUFVLENBQUNtQyxNQUFNLENBQUE7QUFDcEMsSUFBQSxNQUFNb0QsVUFBVSxHQUFHLElBQUksQ0FBQzlHLGFBQWEsQ0FBQzZHLFVBQVUsQ0FBQyxDQUFBO0FBQ2pELElBQUEsTUFBTTNCLGNBQWMsR0FBRzRCLFVBQVUsSUFBSUEsVUFBVSxDQUFDQyxRQUFRLENBQUE7SUFDeEQsT0FBTzdCLGNBQWMsWUFBWTNELFVBQVUsQ0FBQTtBQUMvQyxHQUFBOztFQVdBRSxHQUFHLENBQUNtRixVQUFVLEVBQUU7QUFDWixJQUFBLElBQUksT0FBT0EsVUFBVSxLQUFLLFFBQVEsRUFBRTtBQUNoQyxNQUFBLE1BQU1JLElBQUksR0FBRyxJQUFJLENBQUNoSCxhQUFhLENBQUM0RyxVQUFVLENBQUMsQ0FBQTtBQUMzQyxNQUFBLE9BQU9JLElBQUksR0FBR0EsSUFBSSxDQUFDRCxRQUFRLEdBQUcsSUFBSSxDQUFBO0FBQ3RDLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ0gsVUFBVSxFQUFFLE9BQU8sSUFBSSxDQUFBO0lBQzVCLE1BQU1yRixVQUFVLEdBQUdxRixVQUFVLENBQUE7QUFDN0IsSUFBQSxNQUFNQyxVQUFVLEdBQUd0RixVQUFVLENBQUNtQyxNQUFNLENBQUE7QUFDcEMsSUFBQSxNQUFNb0QsVUFBVSxHQUFHLElBQUksQ0FBQzlHLGFBQWEsQ0FBQzZHLFVBQVUsQ0FBQyxDQUFBO0FBQ2pELElBQUEsTUFBTTNCLGNBQWMsR0FBRzRCLFVBQVUsSUFBSUEsVUFBVSxDQUFDQyxRQUFRLENBQUE7QUFDeEQsSUFBQSxPQUFPN0IsY0FBYyxZQUFZM0QsVUFBVSxHQUFHMkQsY0FBYyxHQUFHLElBQUksQ0FBQTtBQUN2RSxHQUFBOztBQXlCQStCLEVBQUFBLE1BQU0sQ0FBQ0wsVUFBVSxFQUFFTSxJQUFJLEdBQUcsRUFBRSxFQUFFO0lBQzFCLE1BQU1DLElBQUksR0FBRyxJQUFJLENBQUE7SUFFakIsSUFBSTVGLFVBQVUsR0FBR3FGLFVBQVUsQ0FBQTtJQUMzQixJQUFJQyxVQUFVLEdBQUdELFVBQVUsQ0FBQTs7QUFHM0IsSUFBQSxJQUFJLE9BQU9yRixVQUFVLEtBQUssUUFBUSxFQUFFO0FBQ2hDQSxNQUFBQSxVQUFVLEdBQUcsSUFBSSxDQUFDOUIsTUFBTSxDQUFDK0IsR0FBRyxDQUFDYixPQUFPLENBQUNjLEdBQUcsQ0FBQ0YsVUFBVSxDQUFDLENBQUE7S0FDdkQsTUFBTSxJQUFJQSxVQUFVLEVBQUU7TUFDbkJzRixVQUFVLEdBQUd0RixVQUFVLENBQUNtQyxNQUFNLENBQUE7QUFDbEMsS0FBQTtBQUVBLElBQUEsSUFBSW5DLFVBQVUsRUFBRTtBQUNaLE1BQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3ZCLGFBQWEsQ0FBQzZHLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDN0csYUFBYSxDQUFDNkcsVUFBVSxDQUFDLENBQUNFLFFBQVEsRUFBRTtBQUU3RSxRQUFBLE1BQU03QixjQUFjLEdBQUcsSUFBSTNELFVBQVUsQ0FBQztBQUNsQ0MsVUFBQUEsR0FBRyxFQUFFLElBQUksQ0FBQy9CLE1BQU0sQ0FBQytCLEdBQUc7VUFDcEI5QixNQUFNLEVBQUUsSUFBSSxDQUFDQSxNQUFNO0FBQ25Cc0IsVUFBQUEsT0FBTyxFQUFFa0csSUFBSSxDQUFDcEcsY0FBYyxDQUFDLFNBQVMsQ0FBQyxHQUFHb0csSUFBSSxDQUFDbEcsT0FBTyxHQUFHLElBQUk7VUFDN0RDLFVBQVUsRUFBRWlHLElBQUksQ0FBQ2pHLFVBQUFBO0FBQ3JCLFNBQUMsQ0FBQyxDQUFBO0FBRUYsUUFBQSxNQUFNc0IsR0FBRyxHQUFHLElBQUksQ0FBQzVDLFFBQVEsQ0FBQzZDLE1BQU0sQ0FBQTtRQUNoQyxJQUFJNEUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBQ1osSUFBSSxPQUFPRixJQUFJLENBQUNFLEdBQUcsS0FBSyxRQUFRLElBQUlGLElBQUksQ0FBQ0UsR0FBRyxLQUFLLENBQUMsQ0FBQyxJQUFJN0UsR0FBRyxHQUFHMkUsSUFBSSxDQUFDRSxHQUFHLEVBQ2pFQSxHQUFHLEdBQUdGLElBQUksQ0FBQ0UsR0FBRyxDQUFBO1FBRWxCLElBQUksQ0FBQ25DLHFCQUFxQixDQUFDQyxjQUFjLEVBQUVrQyxHQUFHLEVBQUU3RSxHQUFHLENBQUMsQ0FBQTtBQUVwRCxRQUFBLElBQUksQ0FBQ3ZDLGFBQWEsQ0FBQzZHLFVBQVUsQ0FBQyxHQUFHO0FBQzdCRSxVQUFBQSxRQUFRLEVBQUU3QixjQUFjO0FBQ3hCbUMsVUFBQUEsTUFBTSxFQUFFLFlBQVk7QUFDaEJGLFlBQUFBLElBQUksQ0FBQ0csSUFBSSxDQUFDVCxVQUFVLENBQUMsQ0FBQTtBQUN6QixXQUFBO1NBQ0gsQ0FBQTtBQUVELFFBQUEsSUFBSSxDQUFDQSxVQUFVLENBQUMsR0FBRzNCLGNBQWMsQ0FBQTtRQUVqQyxJQUFJLENBQUNnQyxJQUFJLENBQUNLLFVBQVUsRUFDaEJyQyxjQUFjLENBQUNwQixzQkFBc0IsRUFBRSxDQUFBO1FBRTNDLElBQUksQ0FBQy9CLElBQUksQ0FBQyxRQUFRLEVBQUU4RSxVQUFVLEVBQUUzQixjQUFjLENBQUMsQ0FBQTtRQUMvQyxJQUFJLENBQUNuRCxJQUFJLENBQUMsU0FBUyxHQUFHOEUsVUFBVSxFQUFFM0IsY0FBYyxDQUFDLENBQUE7UUFFakQsSUFBSSxDQUFDekYsTUFBTSxDQUFDK0IsR0FBRyxDQUFDYixPQUFPLENBQUNGLEVBQUUsQ0FBQyxPQUFPLEdBQUdvRyxVQUFVLEVBQUUsSUFBSSxDQUFDN0csYUFBYSxDQUFDNkcsVUFBVSxDQUFDLENBQUNRLE1BQU0sQ0FBQyxDQUFBO0FBRXZGLFFBQUEsSUFBSSxDQUFDSCxJQUFJLENBQUNLLFVBQVUsRUFBRTtVQUVsQixJQUFJckMsY0FBYyxDQUFDbEUsT0FBTyxJQUFJLENBQUNrRSxjQUFjLENBQUN6QyxZQUFZLEVBQUU7WUFDeER5QyxjQUFjLENBQUN6QyxZQUFZLEdBQUcsSUFBSSxDQUFBO1lBRWxDLElBQUl5QyxjQUFjLENBQUNaLFVBQVUsRUFDekIsSUFBSSxDQUFDMUIsYUFBYSxDQUFDc0MsY0FBYyxFQUFFWCxpQkFBaUIsQ0FBQyxDQUFBO0FBQzdELFdBQUE7VUFFQSxJQUFJVyxjQUFjLENBQUNsRSxPQUFPLElBQUksQ0FBQ2tFLGNBQWMsQ0FBQ3hDLGdCQUFnQixFQUFFO1lBQzVEd0MsY0FBYyxDQUFDeEMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO1lBQ3RDLElBQUl3QyxjQUFjLENBQUN2QyxjQUFjLEVBQzdCLElBQUksQ0FBQ0MsYUFBYSxDQUFDc0MsY0FBYyxFQUFFckMsc0JBQXNCLENBQUMsQ0FBQTtBQUNsRSxXQUFBO0FBQ0osU0FBQTtBQUdBLFFBQUEsT0FBT3FDLGNBQWMsQ0FBQTtBQUN6QixPQUFBO0FBRUFzQyxNQUFBQSxLQUFLLENBQUNwRCxJQUFJLENBQUUsQ0FBQSxRQUFBLEVBQVV5QyxVQUFXLENBQUEsOEJBQUEsRUFBZ0MsSUFBSSxDQUFDbkgsTUFBTSxDQUFDK0gsSUFBSyxDQUFBLENBQUEsQ0FBRSxDQUFDLENBQUE7QUFDekYsS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJLENBQUN6SCxhQUFhLENBQUM2RyxVQUFVLENBQUMsR0FBRztBQUM3QmEsUUFBQUEsUUFBUSxFQUFFLElBQUk7QUFDZE4sUUFBQUEsR0FBRyxFQUFFLElBQUksQ0FBQ3pILFFBQVEsQ0FBQzZDLE1BQUFBO09BQ3RCLENBQUE7QUFFRGdGLE1BQUFBLEtBQUssQ0FBQ3BELElBQUksQ0FBRSxDQUFVeUMsUUFBQUEsRUFBQUEsVUFBVyxxREFBb0QsQ0FBQyxDQUFBO0FBQzFGLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7RUFVQXJELE9BQU8sQ0FBQ29ELFVBQVUsRUFBRTtJQUNoQixJQUFJQyxVQUFVLEdBQUdELFVBQVUsQ0FBQTtJQUMzQixJQUFJckYsVUFBVSxHQUFHcUYsVUFBVSxDQUFBOztBQUczQixJQUFBLElBQUksT0FBT3JGLFVBQVUsS0FBSyxRQUFRLEVBQUU7QUFDaENBLE1BQUFBLFVBQVUsR0FBRyxJQUFJLENBQUM5QixNQUFNLENBQUMrQixHQUFHLENBQUNiLE9BQU8sQ0FBQ2MsR0FBRyxDQUFDRixVQUFVLENBQUMsQ0FBQTtLQUN2RCxNQUFNLElBQUlBLFVBQVUsRUFBRTtNQUNuQnNGLFVBQVUsR0FBR3RGLFVBQVUsQ0FBQ21DLE1BQU0sQ0FBQTtBQUNsQyxLQUFBO0FBRUEsSUFBQSxNQUFNb0QsVUFBVSxHQUFHLElBQUksQ0FBQzlHLGFBQWEsQ0FBQzZHLFVBQVUsQ0FBQyxDQUFBO0FBQ2pELElBQUEsT0FBTyxJQUFJLENBQUM3RyxhQUFhLENBQUM2RyxVQUFVLENBQUMsQ0FBQTtBQUNyQyxJQUFBLElBQUksQ0FBQ0MsVUFBVSxFQUFFLE9BQU8sS0FBSyxDQUFBO0FBRTdCLElBQUEsTUFBTTVCLGNBQWMsR0FBRzRCLFVBQVUsQ0FBQ0MsUUFBUSxDQUFBO0FBQzFDLElBQUEsSUFBSTdCLGNBQWMsSUFBSSxDQUFDQSxjQUFjLENBQUNoRixVQUFVLEVBQUU7TUFDOUNnRixjQUFjLENBQUNsRSxPQUFPLEdBQUcsS0FBSyxDQUFBO01BQzlCa0UsY0FBYyxDQUFDaEYsVUFBVSxHQUFHLElBQUksQ0FBQTs7QUFJaEMsTUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDSyx3QkFBd0IsRUFBRTtBQUNoQyxRQUFBLE1BQU02RyxHQUFHLEdBQUcsSUFBSSxDQUFDekQscUJBQXFCLENBQUN1QixjQUFjLENBQUMsQ0FBQTtRQUN0RCxJQUFJa0MsR0FBRyxJQUFJLENBQUMsRUFBRTtVQUNWLElBQUksQ0FBQ3hELG9CQUFvQixDQUFDd0QsR0FBRyxFQUFFLElBQUksQ0FBQ3pILFFBQVEsQ0FBQzZDLE1BQU0sQ0FBQyxDQUFBO0FBQ3hELFNBQUE7QUFDSixPQUFDLE1BQU07QUFHSCxRQUFBLElBQUksQ0FBQ3ZDLGlCQUFpQixDQUFDb0YsSUFBSSxDQUFDSCxjQUFjLENBQUMsQ0FBQTtBQUMvQyxPQUFBO0FBQ0osS0FBQTs7QUFHQSxJQUFBLElBQUksQ0FBQ3pGLE1BQU0sQ0FBQytCLEdBQUcsQ0FBQ2IsT0FBTyxDQUFDZ0gsR0FBRyxDQUFDLE9BQU8sR0FBR2QsVUFBVSxFQUFFQyxVQUFVLENBQUNPLE1BQU0sQ0FBQyxDQUFBO0lBRXBFLE9BQU8sSUFBSSxDQUFDUixVQUFVLENBQUMsQ0FBQTtJQUV2QixJQUFJLENBQUM5RSxJQUFJLENBQUMsU0FBUyxFQUFFOEUsVUFBVSxFQUFFM0IsY0FBYyxJQUFJLElBQUksQ0FBQyxDQUFBO0lBQ3hELElBQUksQ0FBQ25ELElBQUksQ0FBQyxVQUFVLEdBQUc4RSxVQUFVLEVBQUUzQixjQUFjLElBQUksSUFBSSxDQUFDLENBQUE7QUFFMUQsSUFBQSxJQUFJQSxjQUFjLEVBQ2RBLGNBQWMsQ0FBQ25ELElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQTtBQUVsQyxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7RUFTQXVGLElBQUksQ0FBQ1YsVUFBVSxFQUFFO0lBQ2IsSUFBSUMsVUFBVSxHQUFHRCxVQUFVLENBQUE7SUFDM0IsSUFBSXJGLFVBQVUsR0FBR3FGLFVBQVUsQ0FBQTs7QUFHM0IsSUFBQSxJQUFJLE9BQU9yRixVQUFVLEtBQUssUUFBUSxFQUFFO0FBQ2hDQSxNQUFBQSxVQUFVLEdBQUcsSUFBSSxDQUFDOUIsTUFBTSxDQUFDK0IsR0FBRyxDQUFDYixPQUFPLENBQUNjLEdBQUcsQ0FBQ0YsVUFBVSxDQUFDLENBQUE7S0FDdkQsTUFBTSxJQUFJQSxVQUFVLEVBQUU7TUFDbkJzRixVQUFVLEdBQUd0RixVQUFVLENBQUNtQyxNQUFNLENBQUE7QUFDbEMsS0FBQTtBQUVBLElBQUEsTUFBTVAsR0FBRyxHQUFHLElBQUksQ0FBQ25ELGFBQWEsQ0FBQzZHLFVBQVUsQ0FBQyxDQUFBO0lBQzFDLElBQUksQ0FBQzFELEdBQUcsSUFBSSxDQUFDQSxHQUFHLENBQUM0RCxRQUFRLEVBQUUsT0FBTyxLQUFLLENBQUE7QUFFdkMsSUFBQSxNQUFNYSxpQkFBaUIsR0FBR3pFLEdBQUcsQ0FBQzRELFFBQVEsQ0FBQTtJQUN0QyxNQUFNSyxHQUFHLEdBQUcsSUFBSSxDQUFDekgsUUFBUSxDQUFDa0csT0FBTyxDQUFDK0IsaUJBQWlCLENBQUMsQ0FBQTtBQUVwRCxJQUFBLE1BQU0xQyxjQUFjLEdBQUcsSUFBSTNELFVBQVUsQ0FBQztBQUNsQ0MsTUFBQUEsR0FBRyxFQUFFLElBQUksQ0FBQy9CLE1BQU0sQ0FBQytCLEdBQUc7TUFDcEI5QixNQUFNLEVBQUUsSUFBSSxDQUFDQSxNQUFNO01BQ25Cc0IsT0FBTyxFQUFFNEcsaUJBQWlCLENBQUM1RyxPQUFPO01BQ2xDQyxVQUFVLEVBQUUyRyxpQkFBaUIsQ0FBQ3RHLFlBQUFBO0FBQ2xDLEtBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBQSxJQUFJLENBQUM0RCxjQUFjLENBQUNvQyxJQUFJLEVBQ3BCLE9BQU8sS0FBSyxDQUFBO0lBRWhCcEMsY0FBYyxDQUFDcEIsc0JBQXNCLEVBQUUsQ0FBQTs7QUFHdkMsSUFBQSxJQUFJLENBQUNuRSxRQUFRLENBQUN5SCxHQUFHLENBQUMsR0FBR2xDLGNBQWMsQ0FBQTtJQUNuQyxJQUFJLENBQUNsRixhQUFhLENBQUM2RyxVQUFVLENBQUMsQ0FBQ0UsUUFBUSxHQUFHN0IsY0FBYyxDQUFBO0FBQ3hELElBQUEsSUFBSSxDQUFDMkIsVUFBVSxDQUFDLEdBQUczQixjQUFjLENBQUE7O0lBSWpDQSxjQUFjLENBQUNJLGdCQUFnQixHQUFHOEIsR0FBRyxDQUFBO0lBQ3JDLElBQUlRLGlCQUFpQixDQUFDckMsTUFBTSxFQUFFO0FBQzFCLE1BQUEsSUFBSSxDQUFDM0YsV0FBVyxDQUFDa0csTUFBTSxDQUFDOEIsaUJBQWlCLENBQUMsQ0FBQTtBQUM5QyxLQUFBO0lBQ0EsSUFBSUEsaUJBQWlCLENBQUNuQyxVQUFVLEVBQUU7QUFDOUIsTUFBQSxJQUFJLENBQUMxRixlQUFlLENBQUMrRixNQUFNLENBQUM4QixpQkFBaUIsQ0FBQyxDQUFBO0FBQ2xELEtBQUE7SUFFQSxJQUFJMUMsY0FBYyxDQUFDSyxNQUFNLEVBQUU7QUFDdkIsTUFBQSxJQUFJLENBQUMzRixXQUFXLENBQUMrRixNQUFNLENBQUNULGNBQWMsQ0FBQyxDQUFBO0FBQzNDLEtBQUE7SUFDQSxJQUFJQSxjQUFjLENBQUNPLFVBQVUsRUFBRTtBQUMzQixNQUFBLElBQUksQ0FBQzFGLGVBQWUsQ0FBQzRGLE1BQU0sQ0FBQ1QsY0FBYyxDQUFDLENBQUE7QUFDL0MsS0FBQTtJQUVBLElBQUksQ0FBQ3RDLGFBQWEsQ0FBQ3NDLGNBQWMsRUFBRTJDLFdBQVcsRUFBRUQsaUJBQWlCLENBQUMsQ0FBQTtJQUVsRSxJQUFJLENBQUM3RixJQUFJLENBQUMsTUFBTSxFQUFFOEUsVUFBVSxFQUFFM0IsY0FBYyxDQUFDLENBQUE7SUFDN0MsSUFBSSxDQUFDbkQsSUFBSSxDQUFDLE9BQU8sR0FBRzhFLFVBQVUsRUFBRTNCLGNBQWMsQ0FBQyxDQUFBO0FBRS9DLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQWNBNEMsRUFBQUEsMENBQTBDLENBQUNDLGtCQUFrQixFQUFFMUIsZ0JBQWdCLEVBQUU7QUFDN0UsSUFBQSxNQUFNMkIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDdEksTUFBTSxDQUFDcUIsTUFBTSxDQUFBOztBQUc3QyxJQUFBLEtBQUssTUFBTThGLFVBQVUsSUFBSWtCLGtCQUFrQixDQUFDL0gsYUFBYSxFQUFFO0FBRXZELE1BQUEsTUFBTXVCLFVBQVUsR0FBRyxJQUFJLENBQUM5QixNQUFNLENBQUMrQixHQUFHLENBQUNiLE9BQU8sQ0FBQ2MsR0FBRyxDQUFDb0YsVUFBVSxDQUFDLENBQUE7TUFDMUQsSUFBSSxDQUFDdEYsVUFBVSxFQUFFO0FBQ2IsUUFBQSxTQUFBO0FBQ0osT0FBQTs7QUFHQSxNQUFBLE1BQU1SLE1BQU0sR0FBR2dILGtCQUFrQixDQUFDL0gsYUFBYSxDQUFDNkcsVUFBVSxDQUFDLENBQUE7QUFDM0QsTUFBQSxJQUFJLENBQUM5RixNQUFNLElBQUksQ0FBQ0EsTUFBTSxDQUFDZ0csUUFBUSxFQUFFO0FBQzdCLFFBQUEsU0FBQTtBQUNKLE9BQUE7O0FBT0EsTUFBQSxNQUFNa0IsZ0JBQWdCLEdBQUdELGtCQUFrQixDQUFDbkIsVUFBVSxDQUFDLENBQUNxQixlQUFlLENBQUE7QUFDdkUsTUFBQSxNQUFNOUIsYUFBYSxHQUFHNEIsa0JBQWtCLENBQUNuQixVQUFVLENBQUMsQ0FBQ3ZGLFlBQVksQ0FBQTtBQUNqRSxNQUFBLElBQUksQ0FBQzJHLGdCQUFnQixJQUFJLENBQUM3QixhQUFhLEVBQUU7QUFDckMsUUFBQSxTQUFBO0FBQ0osT0FBQTs7QUFHQSxNQUFBLE1BQU1ELE9BQU8sR0FBRyxDQUFDLENBQUM4QixnQkFBZ0IsQ0FBQTs7QUFHbEMsTUFBQSxNQUFNRSxhQUFhLEdBQUdwSCxNQUFNLENBQUNnRyxRQUFRLENBQUN6RixZQUFZLENBQUE7QUFDbEQsTUFBQSxLQUFLLE1BQU00RSxhQUFhLElBQUlpQyxhQUFhLEVBQUU7QUFDdkMsUUFBQSxJQUFJLENBQUNBLGFBQWEsQ0FBQ2pDLGFBQWEsQ0FBQyxFQUFFO0FBQy9CLFVBQUEsU0FBQTtBQUNKLFNBQUE7O1FBR0EsTUFBTUQsU0FBUyxHQUFHMUUsVUFBVSxDQUFDTixVQUFVLENBQUNRLEdBQUcsQ0FBQ3lFLGFBQWEsQ0FBQyxDQUFBO1FBQzFELElBQUksQ0FBQ0QsU0FBUyxFQUFFO0FBQ1osVUFBQSxTQUFBO0FBQ0osU0FBQTtBQUVBLFFBQUEsSUFBSUEsU0FBUyxDQUFDbUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUU3QixVQUFBLElBQUksQ0FBQ3BDLDZCQUE2QixDQUM5QkMsU0FBUyxFQUNUQyxhQUFhLEVBQ2JpQyxhQUFhLENBQUNqQyxhQUFhLENBQUMsRUFDNUJDLE9BQU8sRUFDUDhCLGdCQUFnQixJQUFJN0IsYUFBYSxFQUNqQ0MsZ0JBQWdCLENBQ25CLENBQUE7QUFDTCxTQUFDLE1BQU0sSUFBSUosU0FBUyxDQUFDbUMsSUFBSSxLQUFLLE1BQU0sSUFBSUMsS0FBSyxDQUFDQyxPQUFPLENBQUNyQyxTQUFTLENBQUNzQyxNQUFNLENBQUMsRUFBRTtBQUVyRSxVQUFBLE1BQU16RyxRQUFRLEdBQUdxRyxhQUFhLENBQUNqQyxhQUFhLENBQUMsQ0FBQTtBQUM3QyxVQUFBLE1BQU1zQyxZQUFZLEdBQUlQLGdCQUFnQixHQUFHQSxnQkFBZ0IsQ0FBQy9CLGFBQWEsQ0FBQyxHQUFHRSxhQUFhLENBQUNGLGFBQWEsQ0FBRSxDQUFBO0FBRXhHLFVBQUEsS0FBSyxJQUFJNUQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMkQsU0FBUyxDQUFDc0MsTUFBTSxDQUFDL0YsTUFBTSxFQUFFRixDQUFDLEVBQUUsRUFBRTtBQUM5QyxZQUFBLE1BQU1tRyxLQUFLLEdBQUd4QyxTQUFTLENBQUNzQyxNQUFNLENBQUNqRyxDQUFDLENBQUMsQ0FBQTtBQUNqQyxZQUFBLElBQUltRyxLQUFLLENBQUNMLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDekIsY0FBQSxTQUFBO0FBQ0osYUFBQTtZQUVBLElBQUluQyxTQUFTLENBQUNLLEtBQUssRUFBRTtBQUNqQixjQUFBLEtBQUssSUFBSW9DLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzVHLFFBQVEsQ0FBQ1UsTUFBTSxFQUFFa0csQ0FBQyxFQUFFLEVBQUU7Z0JBQ3RDLElBQUksQ0FBQzFDLDZCQUE2QixDQUM5QnlDLEtBQUssRUFDTEEsS0FBSyxDQUFDaEIsSUFBSSxFQUNWM0YsUUFBUSxDQUFDNEcsQ0FBQyxDQUFDLENBQUNELEtBQUssQ0FBQ2hCLElBQUksQ0FBQyxFQUN2QnRCLE9BQU8sRUFDUHFDLFlBQVksQ0FBQ0UsQ0FBQyxDQUFDLEVBQ2ZyQyxnQkFBZ0IsQ0FDbkIsQ0FBQTtBQUNMLGVBQUE7QUFDSixhQUFDLE1BQU07Y0FDSCxJQUFJLENBQUNMLDZCQUE2QixDQUM5QnlDLEtBQUssRUFDTEEsS0FBSyxDQUFDaEIsSUFBSSxFQUNWM0YsUUFBUSxDQUFDMkcsS0FBSyxDQUFDaEIsSUFBSSxDQUFDLEVBQ3BCdEIsT0FBTyxFQUNQcUMsWUFBWSxFQUNabkMsZ0JBQWdCLENBQ25CLENBQUE7QUFDTCxhQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBV0FzQyxFQUFBQSxJQUFJLENBQUMvQixVQUFVLEVBQUVRLEdBQUcsRUFBRTtBQUNsQixJQUFBLE1BQU03RSxHQUFHLEdBQUcsSUFBSSxDQUFDNUMsUUFBUSxDQUFDNkMsTUFBTSxDQUFBO0lBQ2hDLElBQUk0RSxHQUFHLElBQUk3RSxHQUFHLElBQUk2RSxHQUFHLEdBQUcsQ0FBQyxFQUNyQixPQUFPLEtBQUssQ0FBQTtJQUVoQixJQUFJN0YsVUFBVSxHQUFHcUYsVUFBVSxDQUFBO0lBQzNCLElBQUlDLFVBQVUsR0FBR0QsVUFBVSxDQUFBO0FBRTNCLElBQUEsSUFBSSxPQUFPQyxVQUFVLEtBQUssUUFBUSxFQUFFO01BQ2hDQSxVQUFVLEdBQUdELFVBQVUsQ0FBQ2xELE1BQU0sQ0FBQTtBQUNsQyxLQUFDLE1BQU07QUFDSG5DLE1BQUFBLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFDckIsS0FBQTtBQUVBLElBQUEsTUFBTXVGLFVBQVUsR0FBRyxJQUFJLENBQUM5RyxhQUFhLENBQUM2RyxVQUFVLENBQUMsQ0FBQTtJQUNqRCxJQUFJLENBQUNDLFVBQVUsSUFBSSxDQUFDQSxVQUFVLENBQUNDLFFBQVEsRUFDbkMsT0FBTyxLQUFLLENBQUE7O0FBR2hCLElBQUEsTUFBTTdCLGNBQWMsR0FBRzRCLFVBQVUsQ0FBQ0MsUUFBUSxDQUFBO0lBQzFDLElBQUl4RixVQUFVLElBQUksRUFBRTJELGNBQWMsWUFBWTNELFVBQVUsQ0FBQyxFQUNyRCxPQUFPLEtBQUssQ0FBQTtJQUVoQixNQUFNcUgsTUFBTSxHQUFHLElBQUksQ0FBQ2pKLFFBQVEsQ0FBQ2tHLE9BQU8sQ0FBQ1gsY0FBYyxDQUFDLENBQUE7SUFDcEQsSUFBSTBELE1BQU0sS0FBSyxDQUFDLENBQUMsSUFBSUEsTUFBTSxLQUFLeEIsR0FBRyxFQUMvQixPQUFPLEtBQUssQ0FBQTs7SUFHaEIsSUFBSSxDQUFDekgsUUFBUSxDQUFDK0YsTUFBTSxDQUFDMEIsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUN6SCxRQUFRLENBQUMrRixNQUFNLENBQUNrRCxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs7QUFHaEUsSUFBQSxJQUFJLENBQUNoRixvQkFBb0IsQ0FBQyxDQUFDLEVBQUVyQixHQUFHLENBQUMsQ0FBQTtBQUNqQyxJQUFBLElBQUksQ0FBQzNDLFdBQVcsQ0FBQ2lKLElBQUksRUFBRSxDQUFBO0FBQ3ZCLElBQUEsSUFBSSxDQUFDOUksZUFBZSxDQUFDOEksSUFBSSxFQUFFLENBQUE7QUFFM0IsSUFBQSxJQUFJLENBQUM5RyxJQUFJLENBQUMsTUFBTSxFQUFFOEUsVUFBVSxFQUFFM0IsY0FBYyxFQUFFa0MsR0FBRyxFQUFFd0IsTUFBTSxDQUFDLENBQUE7QUFDMUQsSUFBQSxJQUFJLENBQUM3RyxJQUFJLENBQUMsT0FBTyxHQUFHOEUsVUFBVSxFQUFFM0IsY0FBYyxFQUFFa0MsR0FBRyxFQUFFd0IsTUFBTSxDQUFDLENBQUE7QUFFNUQsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7QUFDSjs7OzsifQ==
