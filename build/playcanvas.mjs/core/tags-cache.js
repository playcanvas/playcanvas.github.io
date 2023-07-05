class TagsCache {
	constructor(key = null) {
		this._index = {};
		this._key = void 0;
		this._key = key;
	}
	addItem(item) {
		const tags = item.tags._list;
		for (const tag of tags) this.add(tag, item);
	}
	removeItem(item) {
		const tags = item.tags._list;
		for (const tag of tags) this.remove(tag, item);
	}
	add(tag, item) {
		if (this._index[tag] && this._index[tag].list.indexOf(item) !== -1) return;
		if (!this._index[tag]) {
			this._index[tag] = {
				list: []
			};
			if (this._key) this._index[tag].keys = {};
		}
		this._index[tag].list.push(item);
		if (this._key) this._index[tag].keys[item[this._key]] = item;
	}
	remove(tag, item) {
		if (!this._index[tag]) return;
		if (this._key) {
			if (!this._index[tag].keys[item[this._key]]) return;
		}
		const ind = this._index[tag].list.indexOf(item);
		if (ind === -1) return;
		this._index[tag].list.splice(ind, 1);
		if (this._key) delete this._index[tag].keys[item[this._key]];
		if (this._index[tag].list.length === 0) delete this._index[tag];
	}
	find(args) {
		const index = {};
		const items = [];
		let item, tag, tags, tagsRest, missingIndex;
		const sort = (a, b) => {
			return this._index[a].list.length - this._index[b].list.length;
		};
		for (let i = 0; i < args.length; i++) {
			tag = args[i];
			if (tag instanceof Array) {
				if (tag.length === 0) continue;
				if (tag.length === 1) {
					tag = tag[0];
				} else {
					missingIndex = false;
					for (let t = 0; t < tag.length; t++) {
						if (!this._index[tag[t]]) {
							missingIndex = true;
							break;
						}
					}
					if (missingIndex) continue;
					tags = tag.slice(0).sort(sort);
					tagsRest = tags.slice(1);
					if (tagsRest.length === 1) tagsRest = tagsRest[0];
					for (let n = 0; n < this._index[tags[0]].list.length; n++) {
						item = this._index[tags[0]].list[n];
						if ((this._key ? !index[item[this._key]] : items.indexOf(item) === -1) && item.tags.has(tagsRest)) {
							if (this._key) index[item[this._key]] = true;
							items.push(item);
						}
					}
					continue;
				}
			}
			if (tag && typeof tag === 'string' && this._index[tag]) {
				for (let n = 0; n < this._index[tag].list.length; n++) {
					item = this._index[tag].list[n];
					if (this._key) {
						if (!index[item[this._key]]) {
							index[item[this._key]] = true;
							items.push(item);
						}
					} else if (items.indexOf(item) === -1) {
						items.push(item);
					}
				}
			}
		}
		return items;
	}
}

export { TagsCache };
