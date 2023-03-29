/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * An object that manages the case where an object holds a reference to an asset and needs to be
 * notified when changes occur in the asset. e.g. notifications include load, add and remove
 * events.
 */
class AssetReference {
  /**
   * Create a new AssetReference instance.
   *
   * @param {string} propertyName - The name of the property that the asset is stored under,
   * passed into callbacks to enable updating.
   * @param {import('./asset.js').Asset|object} parent - The parent object that contains the
   * asset reference, passed into callbacks to enable updating. Currently an asset, but could be
   * component or other.
   * @param {import('./asset-registry.js').AssetRegistry} registry - The asset registry that
   * stores all assets.
   * @param {object} callbacks - A set of functions called when the asset state changes: load,
   * add, remove.
   * @param {object} [callbacks.load] - The function called when the asset loads
   * load(propertyName, parent, asset).
   * @param {object} [callbacks.add] - The function called when the asset is added to the
   * registry add(propertyName, parent, asset).
   * @param {object} [callbacks.remove] - The function called when the asset is remove from the
   * registry remove(propertyName, parent, asset).
   * @param {object} [callbacks.unload] - The function called when the asset is unloaded
   * unload(propertyName, parent, asset).
   * @param {object} [scope] - The scope to call the callbacks in.
   * @example
   * var reference = new pc.AssetReference('textureAsset', this, this.app.assets, {
   *     load: this.onTextureAssetLoad,
   *     add: this.onTextureAssetAdd,
   *     remove: this.onTextureAssetRemove
   * }, this);
   * reference.id = this.textureAsset.id;
   */
  constructor(propertyName, parent, registry, callbacks, scope) {
    this.propertyName = propertyName;
    this.parent = parent;
    this._scope = scope;
    this._registry = registry;
    this.id = null;
    this.url = null;
    this.asset = null;
    this._onAssetLoad = callbacks.load;
    this._onAssetAdd = callbacks.add;
    this._onAssetRemove = callbacks.remove;
    this._onAssetUnload = callbacks.unload;
  }

  /**
   * Get or set the asset id which this references. One of either id or url must be set to
   * initialize an asset reference.
   *
   * @type {number}
   */
  set id(value) {
    if (this.url) throw Error('Can\'t set id and url');
    this._unbind();
    this._id = value;
    this.asset = this._registry.get(this._id);
    this._bind();
  }
  get id() {
    return this._id;
  }

  /**
   * Get or set the asset url which this references. One of either id or url must be called to
   * initialize an asset reference.
   *
   * @type {string}
   */
  set url(value) {
    if (this.id) throw Error('Can\'t set id and url');
    this._unbind();
    this._url = value;
    this.asset = this._registry.getByUrl(this._url);
    this._bind();
  }
  get url() {
    return this._url;
  }
  _bind() {
    if (this.id) {
      if (this._onAssetLoad) this._registry.on('load:' + this.id, this._onLoad, this);
      if (this._onAssetAdd) this._registry.once('add:' + this.id, this._onAdd, this);
      if (this._onAssetRemove) this._registry.on('remove:' + this.id, this._onRemove, this);
      if (this._onAssetUnload) this._registry.on('unload:' + this.id, this._onUnload, this);
    }
    if (this.url) {
      if (this._onAssetLoad) this._registry.on('load:url:' + this.url, this._onLoad, this);
      if (this._onAssetAdd) this._registry.once('add:url:' + this.url, this._onAdd, this);
      if (this._onAssetRemove) this._registry.on('remove:url:' + this.url, this._onRemove, this);
    }
  }
  _unbind() {
    if (this.id) {
      if (this._onAssetLoad) this._registry.off('load:' + this.id, this._onLoad, this);
      if (this._onAssetAdd) this._registry.off('add:' + this.id, this._onAdd, this);
      if (this._onAssetRemove) this._registry.off('remove:' + this.id, this._onRemove, this);
      if (this._onAssetUnload) this._registry.off('unload:' + this.id, this._onUnload, this);
    }
    if (this.url) {
      if (this._onAssetLoad) this._registry.off('load:' + this.url, this._onLoad, this);
      if (this._onAssetAdd) this._registry.off('add:' + this.url, this._onAdd, this);
      if (this._onAssetRemove) this._registry.off('remove:' + this.url, this._onRemove, this);
    }
  }
  _onLoad(asset) {
    this._onAssetLoad.call(this._scope, this.propertyName, this.parent, asset);
  }
  _onAdd(asset) {
    this.asset = asset;
    this._onAssetAdd.call(this._scope, this.propertyName, this.parent, asset);
  }
  _onRemove(asset) {
    this._onAssetRemove.call(this._scope, this.propertyName, this.parent, asset);
    this.asset = null;
  }
  _onUnload(asset) {
    this._onAssetUnload.call(this._scope, this.propertyName, this.parent, asset);
  }
}

export { AssetReference };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcmVmZXJlbmNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2Fzc2V0L2Fzc2V0LXJlZmVyZW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFuIG9iamVjdCB0aGF0IG1hbmFnZXMgdGhlIGNhc2Ugd2hlcmUgYW4gb2JqZWN0IGhvbGRzIGEgcmVmZXJlbmNlIHRvIGFuIGFzc2V0IGFuZCBuZWVkcyB0byBiZVxuICogbm90aWZpZWQgd2hlbiBjaGFuZ2VzIG9jY3VyIGluIHRoZSBhc3NldC4gZS5nLiBub3RpZmljYXRpb25zIGluY2x1ZGUgbG9hZCwgYWRkIGFuZCByZW1vdmVcbiAqIGV2ZW50cy5cbiAqL1xuY2xhc3MgQXNzZXRSZWZlcmVuY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBc3NldFJlZmVyZW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eU5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCB0aGUgYXNzZXQgaXMgc3RvcmVkIHVuZGVyLFxuICAgICAqIHBhc3NlZCBpbnRvIGNhbGxiYWNrcyB0byBlbmFibGUgdXBkYXRpbmcuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXNzZXQuanMnKS5Bc3NldHxvYmplY3R9IHBhcmVudCAtIFRoZSBwYXJlbnQgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlXG4gICAgICogYXNzZXQgcmVmZXJlbmNlLCBwYXNzZWQgaW50byBjYWxsYmFja3MgdG8gZW5hYmxlIHVwZGF0aW5nLiBDdXJyZW50bHkgYW4gYXNzZXQsIGJ1dCBjb3VsZCBiZVxuICAgICAqIGNvbXBvbmVudCBvciBvdGhlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hc3NldC1yZWdpc3RyeS5qcycpLkFzc2V0UmVnaXN0cnl9IHJlZ2lzdHJ5IC0gVGhlIGFzc2V0IHJlZ2lzdHJ5IHRoYXRcbiAgICAgKiBzdG9yZXMgYWxsIGFzc2V0cy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY2FsbGJhY2tzIC0gQSBzZXQgb2YgZnVuY3Rpb25zIGNhbGxlZCB3aGVuIHRoZSBhc3NldCBzdGF0ZSBjaGFuZ2VzOiBsb2FkLFxuICAgICAqIGFkZCwgcmVtb3ZlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY2FsbGJhY2tzLmxvYWRdIC0gVGhlIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBhc3NldCBsb2Fkc1xuICAgICAqIGxvYWQocHJvcGVydHlOYW1lLCBwYXJlbnQsIGFzc2V0KS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2NhbGxiYWNrcy5hZGRdIC0gVGhlIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBhc3NldCBpcyBhZGRlZCB0byB0aGVcbiAgICAgKiByZWdpc3RyeSBhZGQocHJvcGVydHlOYW1lLCBwYXJlbnQsIGFzc2V0KS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2NhbGxiYWNrcy5yZW1vdmVdIC0gVGhlIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBhc3NldCBpcyByZW1vdmUgZnJvbSB0aGVcbiAgICAgKiByZWdpc3RyeSByZW1vdmUocHJvcGVydHlOYW1lLCBwYXJlbnQsIGFzc2V0KS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2NhbGxiYWNrcy51bmxvYWRdIC0gVGhlIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBhc3NldCBpcyB1bmxvYWRlZFxuICAgICAqIHVubG9hZChwcm9wZXJ0eU5hbWUsIHBhcmVudCwgYXNzZXQpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gVGhlIHNjb3BlIHRvIGNhbGwgdGhlIGNhbGxiYWNrcyBpbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciByZWZlcmVuY2UgPSBuZXcgcGMuQXNzZXRSZWZlcmVuY2UoJ3RleHR1cmVBc3NldCcsIHRoaXMsIHRoaXMuYXBwLmFzc2V0cywge1xuICAgICAqICAgICBsb2FkOiB0aGlzLm9uVGV4dHVyZUFzc2V0TG9hZCxcbiAgICAgKiAgICAgYWRkOiB0aGlzLm9uVGV4dHVyZUFzc2V0QWRkLFxuICAgICAqICAgICByZW1vdmU6IHRoaXMub25UZXh0dXJlQXNzZXRSZW1vdmVcbiAgICAgKiB9LCB0aGlzKTtcbiAgICAgKiByZWZlcmVuY2UuaWQgPSB0aGlzLnRleHR1cmVBc3NldC5pZDtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihwcm9wZXJ0eU5hbWUsIHBhcmVudCwgcmVnaXN0cnksIGNhbGxiYWNrcywgc2NvcGUpIHtcbiAgICAgICAgdGhpcy5wcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWU7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuXG4gICAgICAgIHRoaXMuX3Njb3BlID0gc2NvcGU7XG4gICAgICAgIHRoaXMuX3JlZ2lzdHJ5ID0gcmVnaXN0cnk7XG5cbiAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fb25Bc3NldExvYWQgPSBjYWxsYmFja3MubG9hZDtcbiAgICAgICAgdGhpcy5fb25Bc3NldEFkZCA9IGNhbGxiYWNrcy5hZGQ7XG4gICAgICAgIHRoaXMuX29uQXNzZXRSZW1vdmUgPSBjYWxsYmFja3MucmVtb3ZlO1xuICAgICAgICB0aGlzLl9vbkFzc2V0VW5sb2FkID0gY2FsbGJhY2tzLnVubG9hZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgb3Igc2V0IHRoZSBhc3NldCBpZCB3aGljaCB0aGlzIHJlZmVyZW5jZXMuIE9uZSBvZiBlaXRoZXIgaWQgb3IgdXJsIG11c3QgYmUgc2V0IHRvXG4gICAgICogaW5pdGlhbGl6ZSBhbiBhc3NldCByZWZlcmVuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBpZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy51cmwpIHRocm93IEVycm9yKCdDYW5cXCd0IHNldCBpZCBhbmQgdXJsJyk7XG5cbiAgICAgICAgdGhpcy5fdW5iaW5kKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5hc3NldCA9IHRoaXMuX3JlZ2lzdHJ5LmdldCh0aGlzLl9pZCk7XG5cbiAgICAgICAgdGhpcy5fYmluZCgpO1xuICAgIH1cblxuICAgIGdldCBpZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBvciBzZXQgdGhlIGFzc2V0IHVybCB3aGljaCB0aGlzIHJlZmVyZW5jZXMuIE9uZSBvZiBlaXRoZXIgaWQgb3IgdXJsIG11c3QgYmUgY2FsbGVkIHRvXG4gICAgICogaW5pdGlhbGl6ZSBhbiBhc3NldCByZWZlcmVuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB1cmwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuaWQpIHRocm93IEVycm9yKCdDYW5cXCd0IHNldCBpZCBhbmQgdXJsJyk7XG5cbiAgICAgICAgdGhpcy5fdW5iaW5kKCk7XG5cbiAgICAgICAgdGhpcy5fdXJsID0gdmFsdWU7XG4gICAgICAgIHRoaXMuYXNzZXQgPSB0aGlzLl9yZWdpc3RyeS5nZXRCeVVybCh0aGlzLl91cmwpO1xuXG4gICAgICAgIHRoaXMuX2JpbmQoKTtcbiAgICB9XG5cbiAgICBnZXQgdXJsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXJsO1xuICAgIH1cblxuICAgIF9iaW5kKCkge1xuICAgICAgICBpZiAodGhpcy5pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX29uQXNzZXRMb2FkKSB0aGlzLl9yZWdpc3RyeS5vbignbG9hZDonICsgdGhpcy5pZCwgdGhpcy5fb25Mb2FkLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0QWRkKSB0aGlzLl9yZWdpc3RyeS5vbmNlKCdhZGQ6JyArIHRoaXMuaWQsIHRoaXMuX29uQWRkLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0UmVtb3ZlKSB0aGlzLl9yZWdpc3RyeS5vbigncmVtb3ZlOicgKyB0aGlzLmlkLCB0aGlzLl9vblJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICBpZiAodGhpcy5fb25Bc3NldFVubG9hZCkgdGhpcy5fcmVnaXN0cnkub24oJ3VubG9hZDonICsgdGhpcy5pZCwgdGhpcy5fb25VbmxvYWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudXJsKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb25Bc3NldExvYWQpIHRoaXMuX3JlZ2lzdHJ5Lm9uKCdsb2FkOnVybDonICsgdGhpcy51cmwsIHRoaXMuX29uTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICBpZiAodGhpcy5fb25Bc3NldEFkZCkgdGhpcy5fcmVnaXN0cnkub25jZSgnYWRkOnVybDonICsgdGhpcy51cmwsIHRoaXMuX29uQWRkLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0UmVtb3ZlKSB0aGlzLl9yZWdpc3RyeS5vbigncmVtb3ZlOnVybDonICsgdGhpcy51cmwsIHRoaXMuX29uUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmQoKSB7XG4gICAgICAgIGlmICh0aGlzLmlkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fb25Bc3NldExvYWQpIHRoaXMuX3JlZ2lzdHJ5Lm9mZignbG9hZDonICsgdGhpcy5pZCwgdGhpcy5fb25Mb2FkLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0QWRkKSB0aGlzLl9yZWdpc3RyeS5vZmYoJ2FkZDonICsgdGhpcy5pZCwgdGhpcy5fb25BZGQsIHRoaXMpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX29uQXNzZXRSZW1vdmUpIHRoaXMuX3JlZ2lzdHJ5Lm9mZigncmVtb3ZlOicgKyB0aGlzLmlkLCB0aGlzLl9vblJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICBpZiAodGhpcy5fb25Bc3NldFVubG9hZCkgdGhpcy5fcmVnaXN0cnkub2ZmKCd1bmxvYWQ6JyArIHRoaXMuaWQsIHRoaXMuX29uVW5sb2FkLCB0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy51cmwpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0TG9hZCkgdGhpcy5fcmVnaXN0cnkub2ZmKCdsb2FkOicgKyB0aGlzLnVybCwgdGhpcy5fb25Mb2FkLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0QWRkKSB0aGlzLl9yZWdpc3RyeS5vZmYoJ2FkZDonICsgdGhpcy51cmwsIHRoaXMuX29uQWRkLCB0aGlzKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9vbkFzc2V0UmVtb3ZlKSB0aGlzLl9yZWdpc3RyeS5vZmYoJ3JlbW92ZTonICsgdGhpcy51cmwsIHRoaXMuX29uUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25Bc3NldExvYWQuY2FsbCh0aGlzLl9zY29wZSwgdGhpcy5wcm9wZXJ0eU5hbWUsIHRoaXMucGFyZW50LCBhc3NldCk7XG4gICAgfVxuXG4gICAgX29uQWRkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuYXNzZXQgPSBhc3NldDtcbiAgICAgICAgdGhpcy5fb25Bc3NldEFkZC5jYWxsKHRoaXMuX3Njb3BlLCB0aGlzLnByb3BlcnR5TmFtZSwgdGhpcy5wYXJlbnQsIGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25SZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25Bc3NldFJlbW92ZS5jYWxsKHRoaXMuX3Njb3BlLCB0aGlzLnByb3BlcnR5TmFtZSwgdGhpcy5wYXJlbnQsIGFzc2V0KTtcbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uVW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uQXNzZXRVbmxvYWQuY2FsbCh0aGlzLl9zY29wZSwgdGhpcy5wcm9wZXJ0eU5hbWUsIHRoaXMucGFyZW50LCBhc3NldCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBc3NldFJlZmVyZW5jZSB9O1xuIl0sIm5hbWVzIjpbIkFzc2V0UmVmZXJlbmNlIiwiY29uc3RydWN0b3IiLCJwcm9wZXJ0eU5hbWUiLCJwYXJlbnQiLCJyZWdpc3RyeSIsImNhbGxiYWNrcyIsInNjb3BlIiwiX3Njb3BlIiwiX3JlZ2lzdHJ5IiwiaWQiLCJ1cmwiLCJhc3NldCIsIl9vbkFzc2V0TG9hZCIsImxvYWQiLCJfb25Bc3NldEFkZCIsImFkZCIsIl9vbkFzc2V0UmVtb3ZlIiwicmVtb3ZlIiwiX29uQXNzZXRVbmxvYWQiLCJ1bmxvYWQiLCJ2YWx1ZSIsIkVycm9yIiwiX3VuYmluZCIsIl9pZCIsImdldCIsIl9iaW5kIiwiX3VybCIsImdldEJ5VXJsIiwib24iLCJfb25Mb2FkIiwib25jZSIsIl9vbkFkZCIsIl9vblJlbW92ZSIsIl9vblVubG9hZCIsIm9mZiIsImNhbGwiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGNBQWMsQ0FBQztBQUNqQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVcsQ0FBQ0MsWUFBWSxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsRUFBRUMsU0FBUyxFQUFFQyxLQUFLLEVBQUU7SUFDMUQsSUFBSSxDQUFDSixZQUFZLEdBQUdBLFlBQVksQ0FBQTtJQUNoQyxJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBRXBCLElBQUksQ0FBQ0ksTUFBTSxHQUFHRCxLQUFLLENBQUE7SUFDbkIsSUFBSSxDQUFDRSxTQUFTLEdBQUdK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
