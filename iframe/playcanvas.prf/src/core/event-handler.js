import { EventHandle } from './event-handle.js';

class EventHandler {
  constructor() {
    this._callbacks = new Map();
    this._callbackActive = new Map();
  }
  initEventHandler() {
    this._callbacks = new Map();
    this._callbackActive = new Map();
  }
  _addCallback(name, callback, scope, once) {
    if (!this._callbacks.has(name)) this._callbacks.set(name, []);
    if (this._callbackActive.has(name)) {
      const callbackActive = this._callbackActive.get(name);
      if (callbackActive && callbackActive === this._callbacks.get(name)) {
        this._callbackActive.set(name, callbackActive.slice());
      }
    }
    const evt = new EventHandle(this, name, callback, scope, once);
    this._callbacks.get(name).push(evt);
    return evt;
  }
  on(name, callback, scope = this) {
    return this._addCallback(name, callback, scope, false);
  }
  once(name, callback, scope = this) {
    return this._addCallback(name, callback, scope, true);
  }
  off(name, callback, scope) {
    if (name) {
      if (this._callbackActive.has(name) && this._callbackActive.get(name) === this._callbacks.get(name)) this._callbackActive.set(name, this._callbackActive.get(name).slice());
    } else {
      for (const [key, callbacks] of this._callbackActive) {
        if (!this._callbacks.has(key)) continue;
        if (this._callbacks.get(key) !== callbacks) continue;
        this._callbackActive.set(key, callbacks.slice());
      }
    }
    if (!name) {
      for (const callbacks of this._callbacks.values()) {
        for (let i = 0; i < callbacks.length; i++) {
          callbacks[i].removed = true;
        }
      }
      this._callbacks.clear();
    } else if (!callback) {
      const callbacks = this._callbacks.get(name);
      if (callbacks) {
        for (let i = 0; i < callbacks.length; i++) {
          callbacks[i].removed = true;
        }
        this._callbacks.delete(name);
      }
    } else {
      const callbacks = this._callbacks.get(name);
      if (!callbacks) return this;
      for (let i = 0; i < callbacks.length; i++) {
        if (callbacks[i].callback !== callback) continue;
        if (scope && callbacks[i].scope !== scope) continue;
        callbacks[i].removed = true;
        callbacks.splice(i, 1);
        i--;
      }
      if (callbacks.length === 0) this._callbacks.delete(name);
    }
    return this;
  }
  fire(name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    if (!name) return this;
    const callbacksInitial = this._callbacks.get(name);
    if (!callbacksInitial) return this;
    let callbacks;
    if (!this._callbackActive.has(name)) {
      this._callbackActive.set(name, callbacksInitial);
    } else if (this._callbackActive.get(name) !== callbacksInitial) {
      callbacks = callbacksInitial.slice();
    }
    for (let i = 0; (callbacks || this._callbackActive.get(name)) && i < (callbacks || this._callbackActive.get(name)).length; i++) {
      const evt = (callbacks || this._callbackActive.get(name))[i];
      if (!evt.callback) continue;
      evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
      if (evt._once) {
        const existingCallback = this._callbacks.get(name);
        const ind = existingCallback ? existingCallback.indexOf(evt) : -1;
        if (ind !== -1) {
          if (this._callbackActive.get(name) === existingCallback) this._callbackActive.set(name, this._callbackActive.get(name).slice());
          const _callbacks = this._callbacks.get(name);
          if (!_callbacks) continue;
          _callbacks[ind].removed = true;
          _callbacks.splice(ind, 1);
          if (_callbacks.length === 0) this._callbacks.delete(name);
        }
      }
    }
    if (!callbacks) this._callbackActive.delete(name);
    return this;
  }
  hasEvent(name) {
    var _this$_callbacks$get;
    return !!((_this$_callbacks$get = this._callbacks.get(name)) != null && _this$_callbacks$get.length);
  }
}

export { EventHandler };
