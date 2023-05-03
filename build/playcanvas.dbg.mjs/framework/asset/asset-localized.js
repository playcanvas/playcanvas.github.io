import { EventHandler } from '../../core/event-handler.js';
import { Asset } from './asset.js';

class LocalizedAsset extends EventHandler {
  constructor(app) {
    super();
    this._app = app;
    app.i18n.on('set:locale', this._onSetLocale, this);
    this._autoLoad = false;
    this._disableLocalization = false;
    this._defaultAsset = null;
    this._localizedAsset = null;
  }
  set defaultAsset(value) {
    const id = value instanceof Asset ? value.id : value;
    if (this._defaultAsset === id) return;
    if (this._defaultAsset) {
      this._unbindDefaultAsset();
    }
    this._defaultAsset = id;
    if (this._defaultAsset) {
      this._bindDefaultAsset();
    }

    // reset localized asset
    this._onSetLocale(this._app.i18n.locale);
  }
  get defaultAsset() {
    return this._defaultAsset;
  }
  set localizedAsset(value) {
    const id = value instanceof Asset ? value.id : value;
    if (this._localizedAsset === id) {
      return;
    }
    if (this._localizedAsset) {
      this._app.assets.off('add:' + this._localizedAsset, this._onLocalizedAssetAdd, this);
      this._unbindLocalizedAsset();
      this._localizedAsset = null;
    }
    this._localizedAsset = id;
    if (this._localizedAsset) {
      const asset = this._app.assets.get(this._localizedAsset);
      if (!asset) {
        this._app.assets.once('add:' + this._localizedAsset, this._onLocalizedAssetAdd, this);
      } else {
        this._bindLocalizedAsset();
      }
    }
  }
  get localizedAsset() {
    return this._localizedAsset;
  }
  set autoLoad(value) {
    if (this._autoLoad === value) return;
    this._autoLoad = value;
    if (this._autoLoad && this._localizedAsset) {
      this._unbindLocalizedAsset();
      this._bindLocalizedAsset();
    }
  }
  get autoLoad() {
    return this._autoLoad;
  }
  set disableLocalization(value) {
    if (this._disableLocalization === value) return;
    this._disableLocalization = value;

    // reset localized asset
    this._onSetLocale(this._app.i18n.locale);
  }
  get disableLocalization() {
    return this._disableLocalization;
  }
  _bindDefaultAsset() {
    const asset = this._app.assets.get(this._defaultAsset);
    if (!asset) {
      this._app.assets.once('add:' + this._defaultAsset, this._onDefaultAssetAdd, this);
    } else {
      this._onDefaultAssetAdd(asset);
    }
  }
  _unbindDefaultAsset() {
    if (!this._defaultAsset) return;
    this._app.assets.off('add:' + this._defaultAsset, this._onDefaultAssetAdd, this);
    const asset = this._app.assets.get(this._defaultAsset);
    if (!asset) return;
    asset.off('add:localized', this._onLocaleAdd, this);
    asset.off('remove:localized', this._onLocaleRemove, this);
    asset.off('remove', this._onDefaultAssetRemove, this);
  }
  _onDefaultAssetAdd(asset) {
    if (this._defaultAsset !== asset.id) return;
    asset.on('add:localized', this._onLocaleAdd, this);
    asset.on('remove:localized', this._onLocaleRemove, this);
    asset.once('remove', this._onDefaultAssetRemove, this);
  }
  _onDefaultAssetRemove(asset) {
    if (this._defaultAsset !== asset.id) return;
    asset.off('add:localized', this._onLocaleAdd, this);
    asset.off('remove:localized', this._onLocaleAdd, this);
    this._app.assets.once('add:' + this._defaultAsset, this._onDefaultAssetAdd, this);
  }
  _bindLocalizedAsset() {
    if (!this._autoLoad) return;
    const asset = this._app.assets.get(this._localizedAsset);
    if (!asset) return;
    asset.on('load', this._onLocalizedAssetLoad, this);
    asset.on('change', this._onLocalizedAssetChange, this);
    asset.on('remove', this._onLocalizedAssetRemove, this);
    if (asset.resource) {
      this._onLocalizedAssetLoad(asset);
    } else {
      this._app.assets.load(asset);
    }
  }
  _unbindLocalizedAsset() {
    const asset = this._app.assets.get(this._localizedAsset);
    if (!asset) return;
    asset.off('load', this._onLocalizedAssetLoad, this);
    asset.off('change', this._onLocalizedAssetChange, this);
    asset.off('remove', this._onLocalizedAssetRemove, this);
  }
  _onLocalizedAssetAdd(asset) {
    if (this._localizedAsset !== asset.id) return;
    this._bindLocalizedAsset();
  }
  _onLocalizedAssetLoad(asset) {
    this.fire('load', asset);
  }
  _onLocalizedAssetChange(asset, name, newValue, oldValue) {
    this.fire('change', asset, name, newValue, oldValue);
  }
  _onLocalizedAssetRemove(asset) {
    if (this._localizedAsset === asset.id) {
      this.localizedAsset = this._defaultAsset;
    }
    this.fire('remove', asset);
  }
  _onLocaleAdd(locale, assetId) {
    if (this._app.i18n.locale !== locale) return;

    // reset localized asset
    this._onSetLocale(locale);
  }
  _onLocaleRemove(locale, assetId) {
    if (this._app.i18n.locale !== locale) return;

    // reset localized asset
    this._onSetLocale(locale);
  }
  _onSetLocale(locale) {
    if (!this._defaultAsset) {
      this.localizedAsset = null;
      return;
    }
    const asset = this._app.assets.get(this._defaultAsset);
    if (!asset || this._disableLocalization) {
      this.localizedAsset = this._defaultAsset;
      return;
    }
    const localizedAssetId = asset.getLocalizedAssetId(locale);
    if (!localizedAssetId) {
      this.localizedAsset = this._defaultAsset;
      return;
    }
    this.localizedAsset = localizedAssetId;
  }
  destroy() {
    this.defaultAsset = null;
    this._app.i18n.off('set:locale', this._onSetLocale, this);
    this.off();
  }
}

export { LocalizedAsset };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtbG9jYWxpemVkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2Fzc2V0L2Fzc2V0LWxvY2FsaXplZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4vYXNzZXQuanMnO1xuXG5jbGFzcyBMb2NhbGl6ZWRBc3NldCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xuICAgICAgICBhcHAuaTE4bi5vbignc2V0OmxvY2FsZScsIHRoaXMuX29uU2V0TG9jYWxlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLl9hdXRvTG9hZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXNhYmxlTG9jYWxpemF0aW9uID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbG9jYWxpemVkQXNzZXQgPSBudWxsO1xuICAgIH1cblxuICAgIHNldCBkZWZhdWx0QXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgaWQgPSB2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0ID8gdmFsdWUuaWQgOiB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fZGVmYXVsdEFzc2V0ID09PSBpZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9kZWZhdWx0QXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VuYmluZERlZmF1bHRBc3NldCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdEFzc2V0ID0gaWQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZERlZmF1bHRBc3NldCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgbG9jYWxpemVkIGFzc2V0XG4gICAgICAgIHRoaXMuX29uU2V0TG9jYWxlKHRoaXMuX2FwcC5pMThuLmxvY2FsZSk7XG4gICAgfVxuXG4gICAgZ2V0IGRlZmF1bHRBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRBc3NldDtcbiAgICB9XG5cbiAgICBzZXQgbG9jYWxpemVkQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgaWQgPSB2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0ID8gdmFsdWUuaWQgOiB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2xvY2FsaXplZEFzc2V0ID09PSBpZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2xvY2FsaXplZEFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9hcHAuYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9sb2NhbGl6ZWRBc3NldCwgdGhpcy5fb25Mb2NhbGl6ZWRBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRMb2NhbGl6ZWRBc3NldCgpO1xuICAgICAgICAgICAgdGhpcy5fbG9jYWxpemVkQXNzZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbG9jYWxpemVkQXNzZXQgPSBpZDtcblxuICAgICAgICBpZiAodGhpcy5fbG9jYWxpemVkQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXBwLmFzc2V0cy5nZXQodGhpcy5fbG9jYWxpemVkQXNzZXQpO1xuICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcC5hc3NldHMub25jZSgnYWRkOicgKyB0aGlzLl9sb2NhbGl6ZWRBc3NldCwgdGhpcy5fb25Mb2NhbGl6ZWRBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRMb2NhbGl6ZWRBc3NldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxvY2FsaXplZEFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxpemVkQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IGF1dG9Mb2FkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvTG9hZCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9hdXRvTG9hZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdXRvTG9hZCAmJiB0aGlzLl9sb2NhbGl6ZWRBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kTG9jYWxpemVkQXNzZXQoKTtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRMb2NhbGl6ZWRBc3NldCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9Mb2FkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0xvYWQ7XG4gICAgfVxuXG4gICAgc2V0IGRpc2FibGVMb2NhbGl6YXRpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Rpc2FibGVMb2NhbGl6YXRpb24gPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZGlzYWJsZUxvY2FsaXphdGlvbiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHJlc2V0IGxvY2FsaXplZCBhc3NldFxuICAgICAgICB0aGlzLl9vblNldExvY2FsZSh0aGlzLl9hcHAuaTE4bi5sb2NhbGUpO1xuICAgIH1cblxuICAgIGdldCBkaXNhYmxlTG9jYWxpemF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGlzYWJsZUxvY2FsaXphdGlvbjtcbiAgICB9XG5cbiAgICBfYmluZERlZmF1bHRBc3NldCgpIHtcbiAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hcHAuYXNzZXRzLmdldCh0aGlzLl9kZWZhdWx0QXNzZXQpO1xuICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9hcHAuYXNzZXRzLm9uY2UoJ2FkZDonICsgdGhpcy5fZGVmYXVsdEFzc2V0LCB0aGlzLl9vbkRlZmF1bHRBc3NldEFkZCwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vbkRlZmF1bHRBc3NldEFkZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kRGVmYXVsdEFzc2V0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RlZmF1bHRBc3NldCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2FwcC5hc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX2RlZmF1bHRBc3NldCwgdGhpcy5fb25EZWZhdWx0QXNzZXRBZGQsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXBwLmFzc2V0cy5nZXQodGhpcy5fZGVmYXVsdEFzc2V0KTtcbiAgICAgICAgaWYgKCFhc3NldCkgcmV0dXJuO1xuXG4gICAgICAgIGFzc2V0Lm9mZignYWRkOmxvY2FsaXplZCcsIHRoaXMuX29uTG9jYWxlQWRkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmU6bG9jYWxpemVkJywgdGhpcy5fb25Mb2NhbGVSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uRGVmYXVsdEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25EZWZhdWx0QXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRBc3NldCAhPT0gYXNzZXQuaWQpIHJldHVybjtcblxuICAgICAgICBhc3NldC5vbignYWRkOmxvY2FsaXplZCcsIHRoaXMuX29uTG9jYWxlQWRkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZTpsb2NhbGl6ZWQnLCB0aGlzLl9vbkxvY2FsZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uY2UoJ3JlbW92ZScsIHRoaXMuX29uRGVmYXVsdEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25EZWZhdWx0QXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRBc3NldCAhPT0gYXNzZXQuaWQpIHJldHVybjtcbiAgICAgICAgYXNzZXQub2ZmKCdhZGQ6bG9jYWxpemVkJywgdGhpcy5fb25Mb2NhbGVBZGQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZTpsb2NhbGl6ZWQnLCB0aGlzLl9vbkxvY2FsZUFkZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2FwcC5hc3NldHMub25jZSgnYWRkOicgKyB0aGlzLl9kZWZhdWx0QXNzZXQsIHRoaXMuX29uRGVmYXVsdEFzc2V0QWRkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfYmluZExvY2FsaXplZEFzc2V0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F1dG9Mb2FkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hcHAuYXNzZXRzLmdldCh0aGlzLl9sb2NhbGl6ZWRBc3NldCk7XG4gICAgICAgIGlmICghYXNzZXQpIHJldHVybjtcblxuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTG9jYWxpemVkQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTG9jYWxpemVkQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25Mb2NhbGl6ZWRBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbkxvY2FsaXplZEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZExvY2FsaXplZEFzc2V0KCkge1xuICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2FwcC5hc3NldHMuZ2V0KHRoaXMuX2xvY2FsaXplZEFzc2V0KTtcbiAgICAgICAgaWYgKCFhc3NldCkgcmV0dXJuO1xuXG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTG9jYWxpemVkQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbkxvY2FsaXplZEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkxvY2FsaXplZEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25Mb2NhbGl6ZWRBc3NldEFkZChhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbG9jYWxpemVkQXNzZXQgIT09IGFzc2V0LmlkKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fYmluZExvY2FsaXplZEFzc2V0KCk7XG4gICAgfVxuXG4gICAgX29uTG9jYWxpemVkQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuZmlyZSgnbG9hZCcsIGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25Mb2NhbGl6ZWRBc3NldENoYW5nZShhc3NldCwgbmFtZSwgbmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJywgYXNzZXQsIG5hbWUsIG5ld1ZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgfVxuXG4gICAgX29uTG9jYWxpemVkQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvY2FsaXplZEFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbGl6ZWRBc3NldCA9IHRoaXMuX2RlZmF1bHRBc3NldDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25Mb2NhbGVBZGQobG9jYWxlLCBhc3NldElkKSB7XG4gICAgICAgIGlmICh0aGlzLl9hcHAuaTE4bi5sb2NhbGUgIT09IGxvY2FsZSkgcmV0dXJuO1xuXG4gICAgICAgIC8vIHJlc2V0IGxvY2FsaXplZCBhc3NldFxuICAgICAgICB0aGlzLl9vblNldExvY2FsZShsb2NhbGUpO1xuICAgIH1cblxuICAgIF9vbkxvY2FsZVJlbW92ZShsb2NhbGUsIGFzc2V0SWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FwcC5pMThuLmxvY2FsZSAhPT0gbG9jYWxlKSByZXR1cm47XG5cbiAgICAgICAgLy8gcmVzZXQgbG9jYWxpemVkIGFzc2V0XG4gICAgICAgIHRoaXMuX29uU2V0TG9jYWxlKGxvY2FsZSk7XG4gICAgfVxuXG4gICAgX29uU2V0TG9jYWxlKGxvY2FsZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2RlZmF1bHRBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbGl6ZWRBc3NldCA9IG51bGw7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2FwcC5hc3NldHMuZ2V0KHRoaXMuX2RlZmF1bHRBc3NldCk7XG4gICAgICAgIGlmICghYXNzZXQgfHwgdGhpcy5fZGlzYWJsZUxvY2FsaXphdGlvbikge1xuICAgICAgICAgICAgdGhpcy5sb2NhbGl6ZWRBc3NldCA9IHRoaXMuX2RlZmF1bHRBc3NldDtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxvY2FsaXplZEFzc2V0SWQgPSBhc3NldC5nZXRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSk7XG4gICAgICAgIGlmICghbG9jYWxpemVkQXNzZXRJZCkge1xuICAgICAgICAgICAgdGhpcy5sb2NhbGl6ZWRBc3NldCA9IHRoaXMuX2RlZmF1bHRBc3NldDtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9jYWxpemVkQXNzZXQgPSBsb2NhbGl6ZWRBc3NldElkO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGVmYXVsdEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXBwLmkxOG4ub2ZmKCdzZXQ6bG9jYWxlJywgdGhpcy5fb25TZXRMb2NhbGUsIHRoaXMpO1xuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTG9jYWxpemVkQXNzZXQgfTtcbiJdLCJuYW1lcyI6WyJMb2NhbGl6ZWRBc3NldCIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiX2FwcCIsImkxOG4iLCJvbiIsIl9vblNldExvY2FsZSIsIl9hdXRvTG9hZCIsIl9kaXNhYmxlTG9jYWxpemF0aW9uIiwiX2RlZmF1bHRBc3NldCIsIl9sb2NhbGl6ZWRBc3NldCIsImRlZmF1bHRBc3NldCIsInZhbHVlIiwiaWQiLCJBc3NldCIsIl91bmJpbmREZWZhdWx0QXNzZXQiLCJfYmluZERlZmF1bHRBc3NldCIsImxvY2FsZSIsImxvY2FsaXplZEFzc2V0IiwiYXNzZXRzIiwib2ZmIiwiX29uTG9jYWxpemVkQXNzZXRBZGQiLCJfdW5iaW5kTG9jYWxpemVkQXNzZXQiLCJhc3NldCIsImdldCIsIm9uY2UiLCJfYmluZExvY2FsaXplZEFzc2V0IiwiYXV0b0xvYWQiLCJkaXNhYmxlTG9jYWxpemF0aW9uIiwiX29uRGVmYXVsdEFzc2V0QWRkIiwiX29uTG9jYWxlQWRkIiwiX29uTG9jYWxlUmVtb3ZlIiwiX29uRGVmYXVsdEFzc2V0UmVtb3ZlIiwiX29uTG9jYWxpemVkQXNzZXRMb2FkIiwiX29uTG9jYWxpemVkQXNzZXRDaGFuZ2UiLCJfb25Mb2NhbGl6ZWRBc3NldFJlbW92ZSIsInJlc291cmNlIiwibG9hZCIsImZpcmUiLCJuYW1lIiwibmV3VmFsdWUiLCJvbGRWYWx1ZSIsImFzc2V0SWQiLCJsb2NhbGl6ZWRBc3NldElkIiwiZ2V0TG9jYWxpemVkQXNzZXRJZCIsImRlc3Ryb3kiXSwibWFwcGluZ3MiOiI7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
