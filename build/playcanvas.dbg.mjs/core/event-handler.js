/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class EventHandler {
  constructor() {
    this._callbacks = {};
    this._callbackActive = {};
  }

  initEventHandler() {
    this._callbacks = {};
    this._callbackActive = {};
  }

  _addCallback(name, callback, scope, once = false) {
    if (!name || typeof name !== 'string' || !callback) return;
    if (!this._callbacks[name]) this._callbacks[name] = [];
    if (this._callbackActive[name] && this._callbackActive[name] === this._callbacks[name]) this._callbackActive[name] = this._callbackActive[name].slice();
    this._callbacks[name].push({
      callback: callback,
      scope: scope || this,
      once: once
    });
  }

  on(name, callback, scope) {
    this._addCallback(name, callback, scope, false);
    return this;
  }

  off(name, callback, scope) {
    if (name) {
      if (this._callbackActive[name] && this._callbackActive[name] === this._callbacks[name]) this._callbackActive[name] = this._callbackActive[name].slice();
    } else {
      for (const key in this._callbackActive) {
        if (!this._callbacks[key]) continue;
        if (this._callbacks[key] !== this._callbackActive[key]) continue;
        this._callbackActive[key] = this._callbackActive[key].slice();
      }
    }
    if (!name) {
      this._callbacks = {};
    } else if (!callback) {
      if (this._callbacks[name]) this._callbacks[name] = [];
    } else {
      const events = this._callbacks[name];
      if (!events) return this;
      let count = events.length;
      for (let i = 0; i < count; i++) {
        if (events[i].callback !== callback) continue;
        if (scope && events[i].scope !== scope) continue;
        events[i--] = events[--count];
      }
      events.length = count;
    }
    return this;
  }

  fire(name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    if (!name || !this._callbacks[name]) return this;
    let callbacks;
    if (!this._callbackActive[name]) {
      this._callbackActive[name] = this._callbacks[name];
    } else {
      if (this._callbackActive[name] === this._callbacks[name]) this._callbackActive[name] = this._callbackActive[name].slice();
      callbacks = this._callbacks[name].slice();
    }

    for (let i = 0; (callbacks || this._callbackActive[name]) && i < (callbacks || this._callbackActive[name]).length; i++) {
      const evt = (callbacks || this._callbackActive[name])[i];
      evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
      if (evt.once) {
        const existingCallback = this._callbacks[name];
        const ind = existingCallback ? existingCallback.indexOf(evt) : -1;
        if (ind !== -1) {
          if (this._callbackActive[name] === existingCallback) this._callbackActive[name] = this._callbackActive[name].slice();
          this._callbacks[name].splice(ind, 1);
        }
      }
    }
    if (!callbacks) this._callbackActive[name] = null;
    return this;
  }

  once(name, callback, scope) {
    this._addCallback(name, callback, scope, true);
    return this;
  }

  hasEvent(name) {
    return this._callbacks[name] && this._callbacks[name].length !== 0 || false;
  }
}

export { EventHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtaGFuZGxlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvZXZlbnQtaGFuZGxlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEV2ZW50SGFuZGxlcn0gZnVuY3Rpb25zLiBOb3RlIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICpcbiAqIEBjYWxsYmFjayBIYW5kbGVFdmVudENhbGxiYWNrXG4gKiBAcGFyYW0geyp9IFthcmcxXSAtIEZpcnN0IGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnMl0gLSBTZWNvbmQgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgZnJvbSBjYWxsZXIuXG4gKiBAcGFyYW0geyp9IFthcmczXSAtIFRoaXJkIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnNF0gLSBGb3VydGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgZnJvbSBjYWxsZXIuXG4gKiBAcGFyYW0geyp9IFthcmc1XSAtIEZpZnRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnNl0gLSBTaXh0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCBmcm9tIGNhbGxlci5cbiAqIEBwYXJhbSB7Kn0gW2FyZzddIC0gU2V2ZW50aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCBmcm9tIGNhbGxlci5cbiAqIEBwYXJhbSB7Kn0gW2FyZzhdIC0gRWlnaHRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICovXG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyB0aGF0IGltcGxlbWVudHMgZnVuY3Rpb25hbGl0eSBmb3IgZXZlbnQgaGFuZGxpbmcuXG4gKi9cbmNsYXNzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEV2ZW50SGFuZGxlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG9iaiA9IG5ldyBFdmVudEhhbmRsZXJTdWJjbGFzcygpO1xuICAgICAqXG4gICAgICogLy8gc3Vic2NyaWJlIHRvIGFuIGV2ZW50XG4gICAgICogb2JqLm9uKCdoZWxsbycsIGZ1bmN0aW9uIChzdHIpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ2V2ZW50IGhlbGxvIGlzIGZpcmVkJywgc3RyKTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIGZpcmUgZXZlbnRcbiAgICAgKiBvYmouZmlyZSgnaGVsbG8nLCAnd29ybGQnKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSB7IH07XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmUgPSB7IH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVpbml0aWFsaXplIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbml0RXZlbnRIYW5kbGVyKCkge1xuICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSB7IH07XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlID0geyB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIG5ldyBldmVudCBoYW5kbGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBiaW5kIHRoZSBjYWxsYmFjayB0by5cbiAgICAgKiBAcGFyYW0ge0hhbmRsZUV2ZW50Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBldmVudCBpcyBmaXJlZC4gTm90ZVxuICAgICAqIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gT2JqZWN0IHRvIHVzZSBhcyAndGhpcycgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQsIGRlZmF1bHRzIHRvXG4gICAgICogY3VycmVudCB0aGlzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29uY2U9ZmFsc2VdIC0gSWYgdHJ1ZSwgdGhlIGNhbGxiYWNrIHdpbGwgYmUgdW5ib3VuZCBhZnRlciBiZWluZyBmaXJlZCBvbmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZENhbGxiYWNrKG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgb25jZSA9IGZhbHNlKSB7XG4gICAgICAgIGlmICghbmFtZSB8fCB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgIWNhbGxiYWNrKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICghdGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzW25hbWVdID0gW107XG5cbiAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdICYmIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID09PSB0aGlzLl9jYWxsYmFja3NbbmFtZV0pXG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdLnNsaWNlKCk7XG5cbiAgICAgICAgdGhpcy5fY2FsbGJhY2tzW25hbWVdLnB1c2goe1xuICAgICAgICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgICAgICAgc2NvcGU6IHNjb3BlIHx8IHRoaXMsXG4gICAgICAgICAgICBvbmNlOiBvbmNlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyIHRvIGFuIGV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBiaW5kIHRoZSBjYWxsYmFjayB0by5cbiAgICAgKiBAcGFyYW0ge0hhbmRsZUV2ZW50Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBldmVudCBpcyBmaXJlZC4gTm90ZVxuICAgICAqIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gT2JqZWN0IHRvIHVzZSBhcyAndGhpcycgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQsIGRlZmF1bHRzIHRvXG4gICAgICogY3VycmVudCB0aGlzLlxuICAgICAqIEByZXR1cm5zIHtFdmVudEhhbmRsZXJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogb2JqLm9uKCd0ZXN0JywgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYSArIGIpO1xuICAgICAqIH0pO1xuICAgICAqIG9iai5maXJlKCd0ZXN0JywgMSwgMik7IC8vIHByaW50cyAzIHRvIHRoZSBjb25zb2xlXG4gICAgICovXG4gICAgb24obmFtZSwgY2FsbGJhY2ssIHNjb3BlKSB7XG4gICAgICAgIHRoaXMuX2FkZENhbGxiYWNrKG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGFjaCBhbiBldmVudCBoYW5kbGVyIGZyb20gYW4gZXZlbnQuIElmIGNhbGxiYWNrIGlzIG5vdCBwcm92aWRlZCB0aGVuIGFsbCBjYWxsYmFja3MgYXJlXG4gICAgICogdW5ib3VuZCBmcm9tIHRoZSBldmVudCwgaWYgc2NvcGUgaXMgbm90IHByb3ZpZGVkIHRoZW4gYWxsIGV2ZW50cyB3aXRoIHRoZSBjYWxsYmFjayB3aWxsIGJlXG4gICAgICogdW5ib3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBOYW1lIG9mIHRoZSBldmVudCB0byB1bmJpbmQuXG4gICAgICogQHBhcmFtIHtIYW5kbGVFdmVudENhbGxiYWNrfSBbY2FsbGJhY2tdIC0gRnVuY3Rpb24gdG8gYmUgdW5ib3VuZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3Njb3BlXSAtIFNjb3BlIHRoYXQgd2FzIHVzZWQgYXMgdGhlIHRoaXMgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQuXG4gICAgICogQHJldHVybnMge0V2ZW50SGFuZGxlcn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgKiB9O1xuICAgICAqIG9iai5vbigndGVzdCcsIGhhbmRsZXIpO1xuICAgICAqXG4gICAgICogb2JqLm9mZigpOyAvLyBSZW1vdmVzIGFsbCBldmVudHNcbiAgICAgKiBvYmoub2ZmKCd0ZXN0Jyk7IC8vIFJlbW92ZXMgYWxsIGV2ZW50cyBjYWxsZWQgJ3Rlc3QnXG4gICAgICogb2JqLm9mZigndGVzdCcsIGhhbmRsZXIpOyAvLyBSZW1vdmVzIGFsbCBoYW5kbGVyIGZ1bmN0aW9ucywgY2FsbGVkICd0ZXN0J1xuICAgICAqIG9iai5vZmYoJ3Rlc3QnLCBoYW5kbGVyLCB0aGlzKTsgLy8gUmVtb3ZlcyBhbGwgaGFuZGxlciBmdW5jdGlvbnMsIGNhbGxlZCAndGVzdCcgd2l0aCBzY29wZSB0aGlzXG4gICAgICovXG4gICAgb2ZmKG5hbWUsIGNhbGxiYWNrLCBzY29wZSkge1xuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdICYmIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID09PSB0aGlzLl9jYWxsYmFja3NbbmFtZV0pXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPSB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fY2FsbGJhY2tBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NhbGxiYWNrc1trZXldKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFja3Nba2V5XSAhPT0gdGhpcy5fY2FsbGJhY2tBY3RpdmVba2V5XSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtrZXldID0gdGhpcy5fY2FsbGJhY2tBY3RpdmVba2V5XS5zbGljZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSB7IH07XG4gICAgICAgIH0gZWxzZSBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrc1tuYW1lXSA9IFtdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gdGhpcy5fY2FsbGJhY2tzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFldmVudHMpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgICAgIGxldCBjb3VudCA9IGV2ZW50cy5sZW5ndGg7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChldmVudHNbaV0uY2FsbGJhY2sgIT09IGNhbGxiYWNrKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChzY29wZSAmJiBldmVudHNbaV0uc2NvcGUgIT09IHNjb3BlKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGV2ZW50c1tpLS1dID0gZXZlbnRzWy0tY291bnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnRzLmxlbmd0aCA9IGNvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZSBhbiBldmVudCwgYWxsIGFkZGl0aW9uYWwgYXJndW1lbnRzIGFyZSBwYXNzZWQgb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIGV2ZW50IHRvIGZpcmUuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnMV0gLSBGaXJzdCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmcyXSAtIFNlY29uZCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmczXSAtIFRoaXJkIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzRdIC0gRm91cnRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzVdIC0gRmlmdGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnNl0gLSBTaXh0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmc3XSAtIFNldmVudGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnOF0gLSBFaWdodGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHJldHVybnMge0V2ZW50SGFuZGxlcn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBvYmouZmlyZSgndGVzdCcsICdUaGlzIGlzIHRoZSBtZXNzYWdlJyk7XG4gICAgICovXG4gICAgZmlyZShuYW1lLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIGlmICghbmFtZSB8fCAhdGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgbGV0IGNhbGxiYWNrcztcblxuICAgICAgICBpZiAoIXRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IHRoaXMuX2NhbGxiYWNrc1tuYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9PT0gdGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID0gdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0uc2xpY2UoKTtcblxuICAgICAgICAgICAgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzW25hbWVdLnNsaWNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPOiBXaGF0IGRvZXMgY2FsbGJhY2tzIGRvIGhlcmU/XG4gICAgICAgIC8vIEluIHBhcnRpY3VsYXIgdGhpcyBjb25kaXRpb24gY2hlY2sgbG9va3Mgd3Jvbmc6IChpIDwgKGNhbGxiYWNrcyB8fCB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSkubGVuZ3RoKVxuICAgICAgICAvLyBCZWNhdXNlIGNhbGxiYWNrcyBpcyBub3QgYW4gaW50ZWdlclxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW5tb2RpZmllZC1sb29wLWNvbmRpdGlvblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgKGNhbGxiYWNrcyB8fCB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSkgJiYgKGkgPCAoY2FsbGJhY2tzIHx8IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdKS5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGV2dCA9IChjYWxsYmFja3MgfHwgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0pW2ldO1xuICAgICAgICAgICAgZXZ0LmNhbGxiYWNrLmNhbGwoZXZ0LnNjb3BlLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcblxuICAgICAgICAgICAgaWYgKGV2dC5vbmNlKSB7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBjYWxsYmFjayBzdGlsbCBleGlzdHMgYmVjYXVzZSB1c2VyIG1heSBoYXZlIHVuc3Vic2NyaWJlZFxuICAgICAgICAgICAgICAgIC8vIGluIHRoZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDYWxsYmFjayA9IHRoaXMuX2NhbGxiYWNrc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmQgPSBleGlzdGluZ0NhbGxiYWNrID8gZXhpc3RpbmdDYWxsYmFjay5pbmRleE9mKGV2dCkgOiAtMTtcblxuICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9PT0gZXhpc3RpbmdDYWxsYmFjaylcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID0gdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0uc2xpY2UoKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFja3NbbmFtZV0uc3BsaWNlKGluZCwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjYWxsYmFja3MpXG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXIgdG8gYW4gZXZlbnQuIFRoaXMgaGFuZGxlciB3aWxsIGJlIHJlbW92ZWQgYWZ0ZXIgYmVpbmcgZmlyZWQgb25jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gYmluZCB0aGUgY2FsbGJhY2sgdG8uXG4gICAgICogQHBhcmFtIHtIYW5kbGVFdmVudENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gZXZlbnQgaXMgZmlyZWQuIE5vdGVcbiAgICAgKiB0aGUgY2FsbGJhY2sgaXMgbGltaXRlZCB0byA4IGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3Njb3BlXSAtIE9iamVjdCB0byB1c2UgYXMgJ3RoaXMnIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkLCBkZWZhdWx0cyB0b1xuICAgICAqIGN1cnJlbnQgdGhpcy5cbiAgICAgKiBAcmV0dXJucyB7RXZlbnRIYW5kbGVyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG9iai5vbmNlKCd0ZXN0JywgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYSArIGIpO1xuICAgICAqIH0pO1xuICAgICAqIG9iai5maXJlKCd0ZXN0JywgMSwgMik7IC8vIHByaW50cyAzIHRvIHRoZSBjb25zb2xlXG4gICAgICogb2JqLmZpcmUoJ3Rlc3QnLCAxLCAyKTsgLy8gbm90IGdvaW5nIHRvIGdldCBoYW5kbGVkXG4gICAgICovXG4gICAgb25jZShuYW1lLCBjYWxsYmFjaywgc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fYWRkQ2FsbGJhY2sobmFtZSwgY2FsbGJhY2ssIHNjb3BlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGVzdCBpZiB0aGVyZSBhcmUgYW55IGhhbmRsZXJzIGJvdW5kIHRvIGFuIGV2ZW50IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0byB0ZXN0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBvYmplY3QgaGFzIGhhbmRsZXJzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgZXZlbnQgbmFtZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG9iai5vbigndGVzdCcsIGZ1bmN0aW9uICgpIHsgfSk7IC8vIGJpbmQgYW4gZXZlbnQgdG8gJ3Rlc3QnXG4gICAgICogb2JqLmhhc0V2ZW50KCd0ZXN0Jyk7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIG9iai5oYXNFdmVudCgnaGVsbG8nKTsgLy8gcmV0dXJucyBmYWxzZVxuICAgICAqL1xuICAgIGhhc0V2ZW50KG5hbWUpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLl9jYWxsYmFja3NbbmFtZV0gJiYgdGhpcy5fY2FsbGJhY2tzW25hbWVdLmxlbmd0aCAhPT0gMCkgfHwgZmFsc2U7XG4gICAgfVxufVxuXG5leHBvcnQgeyBFdmVudEhhbmRsZXIgfTtcbiJdLCJuYW1lcyI6WyJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIl9jYWxsYmFja3MiLCJfY2FsbGJhY2tBY3RpdmUiLCJpbml0RXZlbnRIYW5kbGVyIiwiX2FkZENhbGxiYWNrIiwibmFtZSIsImNhbGxiYWNrIiwic2NvcGUiLCJvbmNlIiwic2xpY2UiLCJwdXNoIiwib24iLCJvZmYiLCJrZXkiLCJldmVudHMiLCJjb3VudCIsImxlbmd0aCIsImkiLCJmaXJlIiwiYXJnMSIsImFyZzIiLCJhcmczIiwiYXJnNCIsImFyZzUiLCJhcmc2IiwiYXJnNyIsImFyZzgiLCJjYWxsYmFja3MiLCJldnQiLCJjYWxsIiwiZXhpc3RpbmdDYWxsYmFjayIsImluZCIsImluZGV4T2YiLCJzcGxpY2UiLCJoYXNFdmVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFpQkEsTUFBTUEsWUFBWSxDQUFDO0FBZWZDLEVBQUFBLFdBQVcsR0FBRztBQUtWLElBQUEsSUFBSSxDQUFDQyxVQUFVLEdBQUcsRUFBRyxDQUFBO0FBS3JCLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUcsRUFBRyxDQUFBO0FBQzlCLEdBQUE7O0FBT0FDLEVBQUFBLGdCQUFnQixHQUFHO0FBQ2YsSUFBQSxJQUFJLENBQUNGLFVBQVUsR0FBRyxFQUFHLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNDLGVBQWUsR0FBRyxFQUFHLENBQUE7QUFDOUIsR0FBQTs7RUFhQUUsWUFBWSxDQUFDQyxJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEdBQUcsS0FBSyxFQUFFO0lBQzlDLElBQUksQ0FBQ0gsSUFBSSxJQUFJLE9BQU9BLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQ0MsUUFBUSxFQUM5QyxPQUFBO0FBRUosSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDTCxVQUFVLENBQUNJLElBQUksQ0FBQyxFQUN0QixJQUFJLENBQUNKLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBRTlCLElBQUEsSUFBSSxJQUFJLENBQUNILGVBQWUsQ0FBQ0cs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