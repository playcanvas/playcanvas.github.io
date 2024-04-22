class EventHandle {
  constructor(handler, name, callback, scope, once = false) {
    this.handler = void 0;
    this.name = void 0;
    this.callback = void 0;
    this.scope = void 0;
    this._once = void 0;
    this._removed = false;
    this.handler = handler;
    this.name = name;
    this.callback = callback;
    this.scope = scope;
    this._once = once;
  }
  off() {
    if (this._removed) return;
    this.handler.off(this.name, this.callback, this.scope);
  }
  on(name, callback, scope = this) {
    return this.handler._addCallback(name, callback, scope, false);
  }
  once(name, callback, scope = this) {
    return this.handler._addCallback(name, callback, scope, true);
  }
  set removed(value) {
    if (!value) return;
    this._removed = true;
  }
  get removed() {
    return this._removed;
  }
}

export { EventHandle };
