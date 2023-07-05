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
