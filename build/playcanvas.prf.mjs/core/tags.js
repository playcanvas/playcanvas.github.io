import { EventHandler } from './event-handler.js';

class Tags extends EventHandler {
	constructor(parent) {
		super();
		this._index = {};
		this._list = [];
		this._parent = parent;
	}
	add() {
		let changed = false;
		const tags = this._processArguments(arguments, true);
		if (!tags.length) return changed;
		for (let i = 0; i < tags.length; i++) {
			if (this._index[tags[i]]) continue;
			changed = true;
			this._index[tags[i]] = true;
			this._list.push(tags[i]);
			this.fire('add', tags[i], this._parent);
		}
		if (changed) this.fire('change', this._parent);
		return changed;
	}
	remove() {
		let changed = false;
		if (!this._list.length) return changed;
		const tags = this._processArguments(arguments, true);
		if (!tags.length) return changed;
		for (let i = 0; i < tags.length; i++) {
			if (!this._index[tags[i]]) continue;
			changed = true;
			delete this._index[tags[i]];
			this._list.splice(this._list.indexOf(tags[i]), 1);
			this.fire('remove', tags[i], this._parent);
		}
		if (changed) this.fire('change', this._parent);
		return changed;
	}
	clear() {
		if (!this._list.length) return;
		const tags = this._list.slice(0);
		this._list = [];
		this._index = {};
		for (let i = 0; i < tags.length; i++) this.fire('remove', tags[i], this._parent);
		this.fire('change', this._parent);
	}
	has() {
		if (!this._list.length) return false;
		return this._has(this._processArguments(arguments));
	}
	_has(tags) {
		if (!this._list.length || !tags.length) return false;
		for (let i = 0; i < tags.length; i++) {
			if (tags[i].length === 1) {
				if (this._index[tags[i][0]]) return true;
			} else {
				let multiple = true;
				for (let t = 0; t < tags[i].length; t++) {
					if (this._index[tags[i][t]]) continue;
					multiple = false;
					break;
				}
				if (multiple) return true;
			}
		}
		return false;
	}
	list() {
		return this._list.slice(0);
	}
	_processArguments(args, flat) {
		const tags = [];
		let tmp = [];
		if (!args || !args.length) return tags;
		for (let i = 0; i < args.length; i++) {
			if (args[i] instanceof Array) {
				if (!flat) tmp = [];
				for (let t = 0; t < args[i].length; t++) {
					if (typeof args[i][t] !== 'string') continue;
					if (flat) {
						tags.push(args[i][t]);
					} else {
						tmp.push(args[i][t]);
					}
				}
				if (!flat && tmp.length) tags.push(tmp);
			} else if (typeof args[i] === 'string') {
				if (flat) {
					tags.push(args[i]);
				} else {
					tags.push([args[i]]);
				}
			}
		}
		return tags;
	}
	get size() {
		return this._list.length;
	}
}

export { Tags };
