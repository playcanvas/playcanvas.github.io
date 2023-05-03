import { Debug } from '../../../core/debug.js';
import { path } from '../../../core/path.js';
import { Component } from '../component.js';

class ScriptLegacyComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this.on('set_scripts', this.onSetScripts, this);
  }
  send(name, functionName) {
    Debug.deprecated('ScriptLegacyComponent.send() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/');
    const args = Array.prototype.slice.call(arguments, 2);
    const instances = this.entity.script.instances;
    let fn;
    if (instances && instances[name]) {
      fn = instances[name].instance[functionName];
      if (fn) {
        return fn.apply(instances[name].instance, args);
      }
    }
    return undefined;
  }
  onEnable() {
    // if the scripts of the component have been loaded
    // then call the appropriate methods on the component
    if (this.data.areScriptsLoaded && !this.system.preloading) {
      if (!this.data.initialized) {
        this.system._initializeScriptComponent(this);
      } else {
        this.system._enableScriptComponent(this);
      }
      if (!this.data.postInitialized) {
        this.system._postInitializeScriptComponent(this);
      }
    }
  }
  onDisable() {
    this.system._disableScriptComponent(this);
  }
  onSetScripts(name, oldValue, newValue) {
    if (!this.system._inTools || this.runInTools) {
      // if we only need to update script attributes then update them and return
      if (this._updateScriptAttributes(oldValue, newValue)) {
        return;
      }

      // disable the script first
      if (this.enabled) {
        this.system._disableScriptComponent(this);
      }
      this.system._destroyScriptComponent(this);
      this.data.areScriptsLoaded = false;

      // get the urls
      const scripts = newValue;
      const urls = scripts.map(function (s) {
        return s.url;
      });

      // try to load the scripts synchronously first
      if (this._loadFromCache(urls)) {
        return;
      }

      // not all scripts are in the cache so load them asynchronously
      this._loadScripts(urls);
    }
  }

  // Check if only script attributes need updating in which
  // case just update the attributes and return otherwise return false
  _updateScriptAttributes(oldValue, newValue) {
    let onlyUpdateAttributes = true;
    if (oldValue.length !== newValue.length) {
      onlyUpdateAttributes = false;
    } else {
      for (let i = 0, len = newValue.length; i < len; i++) {
        if (oldValue[i].url !== newValue[i].url) {
          onlyUpdateAttributes = false;
          break;
        }
      }
    }
    if (onlyUpdateAttributes) {
      for (const key in this.instances) {
        if (this.instances.hasOwnProperty(key)) {
          this.system._updateAccessors(this.entity, this.instances[key]);
        }
      }
    }
    return onlyUpdateAttributes;
  }

  // Load each url from the cache synchronously. If one of the urls is not in the cache
  // then stop and return false.
  _loadFromCache(urls) {
    const cached = [];
    const prefix = this.system.app._scriptPrefix || '';
    const regex = /^http(s)?:\/\//i;
    for (let i = 0, len = urls.length; i < len; i++) {
      let url = urls[i];
      if (!regex.test(url)) {
        url = path.join(prefix, url);
      }
      const type = this.system.app.loader.getFromCache(url, 'script');

      // if we cannot find the script in the cache then return and load
      // all scripts with the resource loader
      if (!type) {
        return false;
      }
      cached.push(type);
    }
    for (let i = 0, len = cached.length; i < len; i++) {
      const ScriptType = cached[i];

      // check if this is a regular JS file
      if (ScriptType === true) {
        continue;
      }

      // ScriptType may be null if the script component is loading an ordinary JavaScript lib rather than a PlayCanvas script
      // Make sure that script component hasn't been removed since we started loading
      if (ScriptType && this.entity.script) {
        // Make sure that we haven't already instantiated another identical script while loading
        // e.g. if you do addComponent, removeComponent, addComponent, in quick succession
        if (!this.entity.script.instances[ScriptType._pcScriptName]) {
          const instance = new ScriptType(this.entity);
          this.system._preRegisterInstance(this.entity, urls[i], ScriptType._pcScriptName, instance);
        }
      }
    }
    if (this.data) {
      this.data.areScriptsLoaded = true;
    }

    // We only need to initialize after preloading is complete
    // During preloading all scripts are initialized after everything is loaded
    if (!this.system.preloading) {
      this.system.onInitialize(this.entity);
      this.system.onPostInitialize(this.entity);
    }
    return true;
  }
  _loadScripts(urls) {
    let count = urls.length;
    const prefix = this.system.app._scriptPrefix || '';
    urls.forEach(url => {
      let _url = null;
      let _unprefixed = null;
      // support absolute URLs (for now)
      if (url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://')) {
        _unprefixed = url;
        _url = url;
      } else {
        _unprefixed = url;
        _url = path.join(prefix, url);
      }
      this.system.app.loader.load(_url, 'script', (err, ScriptType) => {
        count--;
        if (!err) {
          // ScriptType is null if the script is not a PlayCanvas script
          if (ScriptType && this.entity.script) {
            if (!this.entity.script.instances[ScriptType._pcScriptName]) {
              const instance = new ScriptType(this.entity);
              this.system._preRegisterInstance(this.entity, _unprefixed, ScriptType._pcScriptName, instance);
            }
          }
        } else {
          console.error(err);
        }
        if (count === 0) {
          this.data.areScriptsLoaded = true;

          // We only need to initialize after preloading is complete
          // During preloading all scripts are initialized after everything is loaded
          if (!this.system.preloading) {
            this.system.onInitialize(this.entity);
            this.system.onPostInitialize(this.entity);
          }
        }
      });
    });
  }
}

export { ScriptLegacyComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2NyaXB0LWxlZ2FjeS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BhdGguanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5jbGFzcyBTY3JpcHRMZWdhY3lDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcbiAgICAgICAgdGhpcy5vbignc2V0X3NjcmlwdHMnLCB0aGlzLm9uU2V0U2NyaXB0cywgdGhpcyk7XG4gICAgfVxuXG4gICAgc2VuZChuYW1lLCBmdW5jdGlvbk5hbWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgnU2NyaXB0TGVnYWN5Q29tcG9uZW50LnNlbmQoKSBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgc29vbi4gUGxlYXNlIHVzZTogaHR0cDovL2RldmVsb3Blci5wbGF5Y2FudmFzLmNvbS91c2VyLW1hbnVhbC9zY3JpcHRpbmcvY29tbXVuaWNhdGlvbi8nKTtcblxuICAgICAgICBjb25zdCBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5lbnRpdHkuc2NyaXB0Lmluc3RhbmNlcztcbiAgICAgICAgbGV0IGZuO1xuXG4gICAgICAgIGlmIChpbnN0YW5jZXMgJiYgaW5zdGFuY2VzW25hbWVdKSB7XG4gICAgICAgICAgICBmbiA9IGluc3RhbmNlc1tuYW1lXS5pbnN0YW5jZVtmdW5jdGlvbk5hbWVdO1xuICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KGluc3RhbmNlc1tuYW1lXS5pbnN0YW5jZSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNjcmlwdHMgb2YgdGhlIGNvbXBvbmVudCBoYXZlIGJlZW4gbG9hZGVkXG4gICAgICAgIC8vIHRoZW4gY2FsbCB0aGUgYXBwcm9wcmlhdGUgbWV0aG9kcyBvbiB0aGUgY29tcG9uZW50XG4gICAgICAgIGlmICh0aGlzLmRhdGEuYXJlU2NyaXB0c0xvYWRlZCAmJiAhdGhpcy5zeXN0ZW0ucHJlbG9hZGluZykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmRhdGEuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5faW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2VuYWJsZVNjcmlwdENvbXBvbmVudCh0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF0aGlzLmRhdGEucG9zdEluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3Bvc3RJbml0aWFsaXplU2NyaXB0Q29tcG9uZW50KHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLnN5c3RlbS5fZGlzYWJsZVNjcmlwdENvbXBvbmVudCh0aGlzKTtcbiAgICB9XG5cbiAgICBvblNldFNjcmlwdHMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5zeXN0ZW0uX2luVG9vbHMgfHwgdGhpcy5ydW5JblRvb2xzKSB7XG4gICAgICAgICAgICAvLyBpZiB3ZSBvbmx5IG5lZWQgdG8gdXBkYXRlIHNjcmlwdCBhdHRyaWJ1dGVzIHRoZW4gdXBkYXRlIHRoZW0gYW5kIHJldHVyblxuICAgICAgICAgICAgaWYgKHRoaXMuX3VwZGF0ZVNjcmlwdEF0dHJpYnV0ZXMob2xkVmFsdWUsIG5ld1ZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGlzYWJsZSB0aGUgc2NyaXB0IGZpcnN0XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2Rpc2FibGVTY3JpcHRDb21wb25lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9kZXN0cm95U2NyaXB0Q29tcG9uZW50KHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLmRhdGEuYXJlU2NyaXB0c0xvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyBnZXQgdGhlIHVybHNcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IHVybHMgPSBzY3JpcHRzLm1hcChmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgICAgIHJldHVybiBzLnVybDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyB0cnkgdG8gbG9hZCB0aGUgc2NyaXB0cyBzeW5jaHJvbm91c2x5IGZpcnN0XG4gICAgICAgICAgICBpZiAodGhpcy5fbG9hZEZyb21DYWNoZSh1cmxzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbm90IGFsbCBzY3JpcHRzIGFyZSBpbiB0aGUgY2FjaGUgc28gbG9hZCB0aGVtIGFzeW5jaHJvbm91c2x5XG4gICAgICAgICAgICB0aGlzLl9sb2FkU2NyaXB0cyh1cmxzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIG9ubHkgc2NyaXB0IGF0dHJpYnV0ZXMgbmVlZCB1cGRhdGluZyBpbiB3aGljaFxuICAgIC8vIGNhc2UganVzdCB1cGRhdGUgdGhlIGF0dHJpYnV0ZXMgYW5kIHJldHVybiBvdGhlcndpc2UgcmV0dXJuIGZhbHNlXG4gICAgX3VwZGF0ZVNjcmlwdEF0dHJpYnV0ZXMob2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGxldCBvbmx5VXBkYXRlQXR0cmlidXRlcyA9IHRydWU7XG5cbiAgICAgICAgaWYgKG9sZFZhbHVlLmxlbmd0aCAhPT0gbmV3VmFsdWUubGVuZ3RoKSB7XG4gICAgICAgICAgICBvbmx5VXBkYXRlQXR0cmlidXRlcyA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG5ld1ZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9sZFZhbHVlW2ldLnVybCAhPT0gbmV3VmFsdWVbaV0udXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ubHlVcGRhdGVBdHRyaWJ1dGVzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvbmx5VXBkYXRlQXR0cmlidXRlcykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5pbnN0YW5jZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pbnN0YW5jZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fdXBkYXRlQWNjZXNzb3JzKHRoaXMuZW50aXR5LCB0aGlzLmluc3RhbmNlc1trZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb25seVVwZGF0ZUF0dHJpYnV0ZXM7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBlYWNoIHVybCBmcm9tIHRoZSBjYWNoZSBzeW5jaHJvbm91c2x5LiBJZiBvbmUgb2YgdGhlIHVybHMgaXMgbm90IGluIHRoZSBjYWNoZVxuICAgIC8vIHRoZW4gc3RvcCBhbmQgcmV0dXJuIGZhbHNlLlxuICAgIF9sb2FkRnJvbUNhY2hlKHVybHMpIHtcbiAgICAgICAgY29uc3QgY2FjaGVkID0gW107XG5cbiAgICAgICAgY29uc3QgcHJlZml4ID0gdGhpcy5zeXN0ZW0uYXBwLl9zY3JpcHRQcmVmaXggfHwgJyc7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vaTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdXJscy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgbGV0IHVybCA9IHVybHNbaV07XG4gICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3QodXJsKSkge1xuICAgICAgICAgICAgICAgIHVybCA9IHBhdGguam9pbihwcmVmaXgsIHVybCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSB0aGlzLnN5c3RlbS5hcHAubG9hZGVyLmdldEZyb21DYWNoZSh1cmwsICdzY3JpcHQnKTtcblxuICAgICAgICAgICAgLy8gaWYgd2UgY2Fubm90IGZpbmQgdGhlIHNjcmlwdCBpbiB0aGUgY2FjaGUgdGhlbiByZXR1cm4gYW5kIGxvYWRcbiAgICAgICAgICAgIC8vIGFsbCBzY3JpcHRzIHdpdGggdGhlIHJlc291cmNlIGxvYWRlclxuICAgICAgICAgICAgaWYgKCF0eXBlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYWNoZWQucHVzaCh0eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjYWNoZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IFNjcmlwdFR5cGUgPSBjYWNoZWRbaV07XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRoaXMgaXMgYSByZWd1bGFyIEpTIGZpbGVcbiAgICAgICAgICAgIGlmIChTY3JpcHRUeXBlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNjcmlwdFR5cGUgbWF5IGJlIG51bGwgaWYgdGhlIHNjcmlwdCBjb21wb25lbnQgaXMgbG9hZGluZyBhbiBvcmRpbmFyeSBKYXZhU2NyaXB0IGxpYiByYXRoZXIgdGhhbiBhIFBsYXlDYW52YXMgc2NyaXB0XG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCBzY3JpcHQgY29tcG9uZW50IGhhc24ndCBiZWVuIHJlbW92ZWQgc2luY2Ugd2Ugc3RhcnRlZCBsb2FkaW5nXG4gICAgICAgICAgICBpZiAoU2NyaXB0VHlwZSAmJiB0aGlzLmVudGl0eS5zY3JpcHQpIHtcbiAgICAgICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB3ZSBoYXZlbid0IGFscmVhZHkgaW5zdGFudGlhdGVkIGFub3RoZXIgaWRlbnRpY2FsIHNjcmlwdCB3aGlsZSBsb2FkaW5nXG4gICAgICAgICAgICAgICAgLy8gZS5nLiBpZiB5b3UgZG8gYWRkQ29tcG9uZW50LCByZW1vdmVDb21wb25lbnQsIGFkZENvbXBvbmVudCwgaW4gcXVpY2sgc3VjY2Vzc2lvblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5lbnRpdHkuc2NyaXB0Lmluc3RhbmNlc1tTY3JpcHRUeXBlLl9wY1NjcmlwdE5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlID0gbmV3IFNjcmlwdFR5cGUodGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlUmVnaXN0ZXJJbnN0YW5jZSh0aGlzLmVudGl0eSwgdXJsc1tpXSwgU2NyaXB0VHlwZS5fcGNTY3JpcHROYW1lLCBpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5kYXRhLmFyZVNjcmlwdHNMb2FkZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2Ugb25seSBuZWVkIHRvIGluaXRpYWxpemUgYWZ0ZXIgcHJlbG9hZGluZyBpcyBjb21wbGV0ZVxuICAgICAgICAvLyBEdXJpbmcgcHJlbG9hZGluZyBhbGwgc2NyaXB0cyBhcmUgaW5pdGlhbGl6ZWQgYWZ0ZXIgZXZlcnl0aGluZyBpcyBsb2FkZWRcbiAgICAgICAgaWYgKCF0aGlzLnN5c3RlbS5wcmVsb2FkaW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5vbkluaXRpYWxpemUodGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0ub25Qb3N0SW5pdGlhbGl6ZSh0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBfbG9hZFNjcmlwdHModXJscykge1xuICAgICAgICBsZXQgY291bnQgPSB1cmxzLmxlbmd0aDtcblxuICAgICAgICBjb25zdCBwcmVmaXggPSB0aGlzLnN5c3RlbS5hcHAuX3NjcmlwdFByZWZpeCB8fCAnJztcblxuICAgICAgICB1cmxzLmZvckVhY2goKHVybCkgPT4ge1xuICAgICAgICAgICAgbGV0IF91cmwgPSBudWxsO1xuICAgICAgICAgICAgbGV0IF91bnByZWZpeGVkID0gbnVsbDtcbiAgICAgICAgICAgIC8vIHN1cHBvcnQgYWJzb2x1dGUgVVJMcyAoZm9yIG5vdylcbiAgICAgICAgICAgIGlmICh1cmwudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgdXJsLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkge1xuICAgICAgICAgICAgICAgIF91bnByZWZpeGVkID0gdXJsO1xuICAgICAgICAgICAgICAgIF91cmwgPSB1cmw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF91bnByZWZpeGVkID0gdXJsO1xuICAgICAgICAgICAgICAgIF91cmwgPSBwYXRoLmpvaW4ocHJlZml4LCB1cmwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmxvYWRlci5sb2FkKF91cmwsICdzY3JpcHQnLCAoZXJyLCBTY3JpcHRUeXBlKSA9PiB7XG4gICAgICAgICAgICAgICAgY291bnQtLTtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBTY3JpcHRUeXBlIGlzIG51bGwgaWYgdGhlIHNjcmlwdCBpcyBub3QgYSBQbGF5Q2FudmFzIHNjcmlwdFxuICAgICAgICAgICAgICAgICAgICBpZiAoU2NyaXB0VHlwZSAmJiB0aGlzLmVudGl0eS5zY3JpcHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5lbnRpdHkuc2NyaXB0Lmluc3RhbmNlc1tTY3JpcHRUeXBlLl9wY1NjcmlwdE5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2UgPSBuZXcgU2NyaXB0VHlwZSh0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3ByZVJlZ2lzdGVySW5zdGFuY2UodGhpcy5lbnRpdHksIF91bnByZWZpeGVkLCBTY3JpcHRUeXBlLl9wY1NjcmlwdE5hbWUsIGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5hcmVTY3JpcHRzTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBXZSBvbmx5IG5lZWQgdG8gaW5pdGlhbGl6ZSBhZnRlciBwcmVsb2FkaW5nIGlzIGNvbXBsZXRlXG4gICAgICAgICAgICAgICAgICAgIC8vIER1cmluZyBwcmVsb2FkaW5nIGFsbCBzY3JpcHRzIGFyZSBpbml0aWFsaXplZCBhZnRlciBldmVyeXRoaW5nIGlzIGxvYWRlZFxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc3lzdGVtLnByZWxvYWRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLm9uSW5pdGlhbGl6ZSh0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5vblBvc3RJbml0aWFsaXplKHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNjcmlwdExlZ2FjeUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlNjcmlwdExlZ2FjeUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5Iiwib24iLCJvblNldFNjcmlwdHMiLCJzZW5kIiwibmFtZSIsImZ1bmN0aW9uTmFtZSIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsImFyZ3MiLCJBcnJheSIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsImFyZ3VtZW50cyIsImluc3RhbmNlcyIsInNjcmlwdCIsImZuIiwiaW5zdGFuY2UiLCJhcHBseSIsInVuZGVmaW5lZCIsIm9uRW5hYmxlIiwiZGF0YSIsImFyZVNjcmlwdHNMb2FkZWQiLCJwcmVsb2FkaW5nIiwiaW5pdGlhbGl6ZWQiLCJfaW5pdGlhbGl6ZVNjcmlwdENvbXBvbmVudCIsIl9lbmFibGVTY3JpcHRDb21wb25lbnQiLCJwb3N0SW5pdGlhbGl6ZWQiLCJfcG9zdEluaXRpYWxpemVTY3JpcHRDb21wb25lbnQiLCJvbkRpc2FibGUiLCJfZGlzYWJsZVNjcmlwdENvbXBvbmVudCIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJfaW5Ub29scyIsInJ1bkluVG9vbHMiLCJfdXBkYXRlU2NyaXB0QXR0cmlidXRlcyIsImVuYWJsZWQiLCJfZGVzdHJveVNjcmlwdENvbXBvbmVudCIsInNjcmlwdHMiLCJ1cmxzIiwibWFwIiwicyIsInVybCIsIl9sb2FkRnJvbUNhY2hlIiwiX2xvYWRTY3JpcHRzIiwib25seVVwZGF0ZUF0dHJpYnV0ZXMiLCJsZW5ndGgiLCJpIiwibGVuIiwia2V5IiwiaGFzT3duUHJvcGVydHkiLCJfdXBkYXRlQWNjZXNzb3JzIiwiY2FjaGVkIiwicHJlZml4IiwiYXBwIiwiX3NjcmlwdFByZWZpeCIsInJlZ2V4IiwidGVzdCIsInBhdGgiLCJqb2luIiwidHlwZSIsImxvYWRlciIsImdldEZyb21DYWNoZSIsInB1c2giLCJTY3JpcHRUeXBlIiwiX3BjU2NyaXB0TmFtZSIsIl9wcmVSZWdpc3Rlckluc3RhbmNlIiwib25Jbml0aWFsaXplIiwib25Qb3N0SW5pdGlhbGl6ZSIsImNvdW50IiwiZm9yRWFjaCIsIl91cmwiLCJfdW5wcmVmaXhlZCIsInRvTG93ZXJDYXNlIiwic3RhcnRzV2l0aCIsImxvYWQiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7QUFLQSxNQUFNQSxxQkFBcUIsU0FBU0MsU0FBUyxDQUFDO0FBQzFDQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUNyQixJQUFJLENBQUNDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDQyxZQUFZLEVBQUUsSUFB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
