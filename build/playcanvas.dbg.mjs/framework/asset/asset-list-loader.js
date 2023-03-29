/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { Asset } from './asset.js';

/**
 * Used to load a group of assets and fires a callback when all assets are loaded.
 *
 * ```javascript
 * const assets = [
 *     new Asset('model', 'container', { url: `http://example.com/asset.glb` }),
 *     new Asset('styling', 'css', { url: `http://example.com/asset.css` })
 * ];
 * const assetListLoader = new AssetListLoader(assets, app.assets);
 * assetListLoader.load((err, failed) => {
 *     if (err) {
 *         console.error(`${failed.length} assets failed to load`);
 *     } else {
 *         console.log(`${assets.length} assets loaded`);
 *    }
 * });
 * ```
 *
 * @augments EventHandler
 */
class AssetListLoader extends EventHandler {
  /**
   * Create a new AssetListLoader using a list of assets to load and the asset registry used to load and manage them.
   *
   * @param {Asset[]|number[]} assetList - An array of {@link Asset} objects to load or an array of Asset IDs to load.
   * @param {import('./asset-registry.js').AssetRegistry} assetRegistry - The application's asset registry.
   * @example
   * const assetListLoader = new pc.AssetListLoader([
   *     new pc.Asset("texture1", "texture", { url: 'http://example.com/my/assets/here/texture1.png') }),
   *     new pc.Asset("texture2", "texture", { url: 'http://example.com/my/assets/here/texture2.png') })
   * ], pc.app.assets);
   */
  constructor(assetList, assetRegistry) {
    super();
    this._assets = new Set();
    this._loadingAssets = new Set();
    this._waitingAssets = new Set();
    this._registry = assetRegistry;
    this._loading = false;
    this._loaded = false;
    this._failed = []; // list of assets that failed to load

    assetList.forEach(a => {
      if (a instanceof Asset) {
        if (!a.registry) {
          a.registry = assetRegistry;
        }
        this._assets.add(a);
      } else {
        const asset = assetRegistry.get(a);
        if (asset) {
          this._assets.add(asset);
        } else {
          this._waitForAsset(a);
        }
      }
    });
  }

  /**
   * Removes all references to this asset list loader.
   */
  destroy() {
    // remove any outstanding listeners
    const self = this;
    this._registry.off("load", this._onLoad);
    this._registry.off("error", this._onError);
    this._waitingAssets.forEach(function (id) {
      self._registry.off("add:" + id, this._onAddAsset);
    });
    this.off("progress");
    this.off("load");
  }
  _assetHasDependencies(asset) {
    var _asset$file;
    return asset.type === 'model' && ((_asset$file = asset.file) == null ? void 0 : _asset$file.url) && asset.file.url && asset.file.url.match(/.json$/g);
  }

  /**
   * Start loading asset list, call done() when all assets have loaded or failed to load.
   *
   * @param {Function} done - Callback called when all assets in the list are loaded. Passed (err, failed) where err is the undefined if no errors are encountered and failed contains a list of assets that failed to load.
   * @param {object} [scope] - Scope to use when calling callback.
   */
  load(done, scope) {
    if (this._loading) {
      console.debug("AssetListLoader: Load function called multiple times.");
      return;
    }
    this._loading = true;
    this._callback = done;
    this._scope = scope;
    this._registry.on("load", this._onLoad, this);
    this._registry.on("error", this._onError, this);
    let loadingAssets = false;
    this._assets.forEach(asset => {
      // Track assets that are not loaded or are currently loading
      // as some assets may be loading by this call
      if (!asset.loaded) {
        loadingAssets = true;
        // json based models should be loaded with the loadFromUrl function so that their dependencies can be loaded too.
        if (this._assetHasDependencies(asset)) {
          this._registry.loadFromUrl(asset.file.url, asset.type, (err, loadedAsset) => {
            if (err) {
              this._onError(err, asset);
              return;
            }
            this._onLoad(asset);
          });
        }
        this._loadingAssets.add(asset);
        this._registry.add(asset);
      }
    });
    this._loadingAssets.forEach(asset => {
      if (!this._assetHasDependencies(asset)) {
        this._registry.load(asset);
      }
    });
    if (!loadingAssets && this._waitingAssets.size === 0) {
      this._loadingComplete();
    }
  }

  /**
   * Sets a callback which will be called when all assets in the list have been loaded.
   *
   * @param {Function} done - Callback called when all assets in the list are loaded.
   * @param {object} [scope] - Scope to use when calling callback.
   */
  ready(done, scope = this) {
    if (this._loaded) {
      done.call(scope, Array.from(this._assets));
    } else {
      this.once("load", function (assets) {
        done.call(scope, assets);
      });
    }
  }

  // called when all assets are loaded
  _loadingComplete() {
    if (this._loaded) return;
    this._loaded = true;
    this._registry.off("load", this._onLoad, this);
    this._registry.off("error", this._onError, this);
    if (this._failed.length) {
      if (this._callback) {
        this._callback.call(this._scope, "Failed to load some assets", this._failed);
      }
      this.fire("error", this._failed);
    } else {
      if (this._callback) {
        this._callback.call(this._scope);
      }
      this.fire("load", Array.from(this._assets));
    }
  }

  // called when an (any) asset is loaded
  _onLoad(asset) {
    // check this is an asset we care about
    if (this._loadingAssets.has(asset)) {
      this.fire("progress", asset);
      this._loadingAssets.delete(asset);
    }
    if (this._loadingAssets.size === 0) {
      // call next tick because we want
      // this to be fired after any other
      // asset load events
      setTimeout(() => {
        this._loadingComplete(this._failed);
      }, 0);
    }
  }

  // called when an asset fails to load
  _onError(err, asset) {
    // check this is an asset we care about
    if (this._loadingAssets.has(asset)) {
      this._failed.push(asset);
      this._loadingAssets.delete(asset);
    }
    if (this._loadingAssets.size === 0) {
      // call next tick because we want
      // this to be fired after any other
      // asset load events
      setTimeout(() => {
        this._loadingComplete(this._failed);
      }, 0);
    }
  }

  // called when a expected asset is added to the asset registry
  _onAddAsset(asset) {
    // remove from waiting list
    this._waitingAssets.delete(asset);
    this._assets.add(asset);
    if (!asset.loaded) {
      this._loadingAssets.add(asset);
      this._registry.load(asset);
    }
  }
  _waitForAsset(assetId) {
    this._waitingAssets.add(assetId);
    this._registry.once('add:' + assetId, this._onAddAsset, this);
  }
}

export { AssetListLoader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtbGlzdC1sb2FkZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtbGlzdC1sb2FkZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuL2Fzc2V0LmpzJztcblxuLyoqXG4gKiBVc2VkIHRvIGxvYWQgYSBncm91cCBvZiBhc3NldHMgYW5kIGZpcmVzIGEgY2FsbGJhY2sgd2hlbiBhbGwgYXNzZXRzIGFyZSBsb2FkZWQuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3QgYXNzZXRzID0gW1xuICogICAgIG5ldyBBc3NldCgnbW9kZWwnLCAnY29udGFpbmVyJywgeyB1cmw6IGBodHRwOi8vZXhhbXBsZS5jb20vYXNzZXQuZ2xiYCB9KSxcbiAqICAgICBuZXcgQXNzZXQoJ3N0eWxpbmcnLCAnY3NzJywgeyB1cmw6IGBodHRwOi8vZXhhbXBsZS5jb20vYXNzZXQuY3NzYCB9KVxuICogXTtcbiAqIGNvbnN0IGFzc2V0TGlzdExvYWRlciA9IG5ldyBBc3NldExpc3RMb2FkZXIoYXNzZXRzLCBhcHAuYXNzZXRzKTtcbiAqIGFzc2V0TGlzdExvYWRlci5sb2FkKChlcnIsIGZhaWxlZCkgPT4ge1xuICogICAgIGlmIChlcnIpIHtcbiAqICAgICAgICAgY29uc29sZS5lcnJvcihgJHtmYWlsZWQubGVuZ3RofSBhc3NldHMgZmFpbGVkIHRvIGxvYWRgKTtcbiAqICAgICB9IGVsc2Uge1xuICogICAgICAgICBjb25zb2xlLmxvZyhgJHthc3NldHMubGVuZ3RofSBhc3NldHMgbG9hZGVkYCk7XG4gKiAgICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgQXNzZXRMaXN0TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQXNzZXRMaXN0TG9hZGVyIHVzaW5nIGEgbGlzdCBvZiBhc3NldHMgdG8gbG9hZCBhbmQgdGhlIGFzc2V0IHJlZ2lzdHJ5IHVzZWQgdG8gbG9hZCBhbmQgbWFuYWdlIHRoZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0W118bnVtYmVyW119IGFzc2V0TGlzdCAtIEFuIGFycmF5IG9mIHtAbGluayBBc3NldH0gb2JqZWN0cyB0byBsb2FkIG9yIGFuIGFycmF5IG9mIEFzc2V0IElEcyB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2Fzc2V0LXJlZ2lzdHJ5LmpzJykuQXNzZXRSZWdpc3RyeX0gYXNzZXRSZWdpc3RyeSAtIFRoZSBhcHBsaWNhdGlvbidzIGFzc2V0IHJlZ2lzdHJ5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXRMaXN0TG9hZGVyID0gbmV3IHBjLkFzc2V0TGlzdExvYWRlcihbXG4gICAgICogICAgIG5ldyBwYy5Bc3NldChcInRleHR1cmUxXCIsIFwidGV4dHVyZVwiLCB7IHVybDogJ2h0dHA6Ly9leGFtcGxlLmNvbS9teS9hc3NldHMvaGVyZS90ZXh0dXJlMS5wbmcnKSB9KSxcbiAgICAgKiAgICAgbmV3IHBjLkFzc2V0KFwidGV4dHVyZTJcIiwgXCJ0ZXh0dXJlXCIsIHsgdXJsOiAnaHR0cDovL2V4YW1wbGUuY29tL215L2Fzc2V0cy9oZXJlL3RleHR1cmUyLnBuZycpIH0pXG4gICAgICogXSwgcGMuYXBwLmFzc2V0cyk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXNzZXRMaXN0LCBhc3NldFJlZ2lzdHJ5KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fbG9hZGluZ0Fzc2V0cyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fd2FpdGluZ0Fzc2V0cyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fcmVnaXN0cnkgPSBhc3NldFJlZ2lzdHJ5O1xuICAgICAgICB0aGlzLl9sb2FkaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xvYWRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9mYWlsZWQgPSBbXTsgLy8gbGlzdCBvZiBhc3NldHMgdGhhdCBmYWlsZWQgdG8gbG9hZFxuXG4gICAgICAgIGFzc2V0TGlzdC5mb3JFYWNoKChhKSA9PiB7XG4gICAgICAgICAgICBpZiAoYSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFhLnJlZ2lzdHJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIGEucmVnaXN0cnkgPSBhc3NldFJlZ2lzdHJ5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl9hc3NldHMuYWRkKGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0UmVnaXN0cnkuZ2V0KGEpO1xuICAgICAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl93YWl0Rm9yQXNzZXQoYSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCByZWZlcmVuY2VzIHRvIHRoaXMgYXNzZXQgbGlzdCBsb2FkZXIuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFueSBvdXRzdGFuZGluZyBsaXN0ZW5lcnNcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5fcmVnaXN0cnkub2ZmKFwibG9hZFwiLCB0aGlzLl9vbkxvYWQpO1xuICAgICAgICB0aGlzLl9yZWdpc3RyeS5vZmYoXCJlcnJvclwiLCB0aGlzLl9vbkVycm9yKTtcblxuICAgICAgICB0aGlzLl93YWl0aW5nQXNzZXRzLmZvckVhY2goZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICBzZWxmLl9yZWdpc3RyeS5vZmYoXCJhZGQ6XCIgKyBpZCwgdGhpcy5fb25BZGRBc3NldCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMub2ZmKFwicHJvZ3Jlc3NcIik7XG4gICAgICAgIHRoaXMub2ZmKFwibG9hZFwiKTtcbiAgICB9XG5cbiAgICBfYXNzZXRIYXNEZXBlbmRlbmNpZXMoYXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIChhc3NldC50eXBlID09PSAnbW9kZWwnICYmIGFzc2V0LmZpbGU/LnVybCAmJiBhc3NldC5maWxlLnVybCAmJiBhc3NldC5maWxlLnVybC5tYXRjaCgvLmpzb24kL2cpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBsb2FkaW5nIGFzc2V0IGxpc3QsIGNhbGwgZG9uZSgpIHdoZW4gYWxsIGFzc2V0cyBoYXZlIGxvYWRlZCBvciBmYWlsZWQgdG8gbG9hZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGRvbmUgLSBDYWxsYmFjayBjYWxsZWQgd2hlbiBhbGwgYXNzZXRzIGluIHRoZSBsaXN0IGFyZSBsb2FkZWQuIFBhc3NlZCAoZXJyLCBmYWlsZWQpIHdoZXJlIGVyciBpcyB0aGUgdW5kZWZpbmVkIGlmIG5vIGVycm9ycyBhcmUgZW5jb3VudGVyZWQgYW5kIGZhaWxlZCBjb250YWlucyBhIGxpc3Qgb2YgYXNzZXRzIHRoYXQgZmFpbGVkIHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtzY29wZV0gLSBTY29wZSB0byB1c2Ugd2hlbiBjYWxsaW5nIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIGxvYWQoZG9uZSwgc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvYWRpbmcpIHtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoXCJBc3NldExpc3RMb2FkZXI6IExvYWQgZnVuY3Rpb24gY2FsbGVkIG11bHRpcGxlIHRpbWVzLlwiKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2xvYWRpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jYWxsYmFjayA9IGRvbmU7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gc2NvcGU7XG5cbiAgICAgICAgdGhpcy5fcmVnaXN0cnkub24oXCJsb2FkXCIsIHRoaXMuX29uTG9hZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdHJ5Lm9uKFwiZXJyb3JcIiwgdGhpcy5fb25FcnJvciwgdGhpcyk7XG5cbiAgICAgICAgbGV0IGxvYWRpbmdBc3NldHMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXNzZXRzLmZvckVhY2goKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAvLyBUcmFjayBhc3NldHMgdGhhdCBhcmUgbm90IGxvYWRlZCBvciBhcmUgY3VycmVudGx5IGxvYWRpbmdcbiAgICAgICAgICAgIC8vIGFzIHNvbWUgYXNzZXRzIG1heSBiZSBsb2FkaW5nIGJ5IHRoaXMgY2FsbFxuICAgICAgICAgICAgaWYgKCFhc3NldC5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICBsb2FkaW5nQXNzZXRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBqc29uIGJhc2VkIG1vZGVscyBzaG91bGQgYmUgbG9hZGVkIHdpdGggdGhlIGxvYWRGcm9tVXJsIGZ1bmN0aW9uIHNvIHRoYXQgdGhlaXIgZGVwZW5kZW5jaWVzIGNhbiBiZSBsb2FkZWQgdG9vLlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldEhhc0RlcGVuZGVuY2llcyhhc3NldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVnaXN0cnkubG9hZEZyb21VcmwoYXNzZXQuZmlsZS51cmwsIGFzc2V0LnR5cGUsIChlcnIsIGxvYWRlZEFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25FcnJvcihlcnIsIGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZGluZ0Fzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9sb2FkaW5nQXNzZXRzLmZvckVhY2goKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2Fzc2V0SGFzRGVwZW5kZW5jaWVzKGFzc2V0KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlZ2lzdHJ5LmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFsb2FkaW5nQXNzZXRzICYmIHRoaXMuX3dhaXRpbmdBc3NldHMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fbG9hZGluZ0NvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgY2FsbGJhY2sgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiBhbGwgYXNzZXRzIGluIHRoZSBsaXN0IGhhdmUgYmVlbiBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBkb25lIC0gQ2FsbGJhY2sgY2FsbGVkIHdoZW4gYWxsIGFzc2V0cyBpbiB0aGUgbGlzdCBhcmUgbG9hZGVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gU2NvcGUgdG8gdXNlIHdoZW4gY2FsbGluZyBjYWxsYmFjay5cbiAgICAgKi9cbiAgICByZWFkeShkb25lLCBzY29wZSA9IHRoaXMpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvYWRlZCkge1xuICAgICAgICAgICAgZG9uZS5jYWxsKHNjb3BlLCBBcnJheS5mcm9tKHRoaXMuX2Fzc2V0cykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5vbmNlKFwibG9hZFwiLCBmdW5jdGlvbiAoYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgZG9uZS5jYWxsKHNjb3BlLCBhc3NldHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxsZWQgd2hlbiBhbGwgYXNzZXRzIGFyZSBsb2FkZWRcbiAgICBfbG9hZGluZ0NvbXBsZXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fbG9hZGVkKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2xvYWRlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3JlZ2lzdHJ5Lm9mZihcImxvYWRcIiwgdGhpcy5fb25Mb2FkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fcmVnaXN0cnkub2ZmKFwiZXJyb3JcIiwgdGhpcy5fb25FcnJvciwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZhaWxlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrLmNhbGwodGhpcy5fc2NvcGUsIFwiRmFpbGVkIHRvIGxvYWQgc29tZSBhc3NldHNcIiwgdGhpcy5fZmFpbGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZmlyZShcImVycm9yXCIsIHRoaXMuX2ZhaWxlZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFjay5jYWxsKHRoaXMuX3Njb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZmlyZShcImxvYWRcIiwgQXJyYXkuZnJvbSh0aGlzLl9hc3NldHMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNhbGxlZCB3aGVuIGFuIChhbnkpIGFzc2V0IGlzIGxvYWRlZFxuICAgIF9vbkxvYWQoYXNzZXQpIHtcbiAgICAgICAgLy8gY2hlY2sgdGhpcyBpcyBhbiBhc3NldCB3ZSBjYXJlIGFib3V0XG4gICAgICAgIGlmICh0aGlzLl9sb2FkaW5nQXNzZXRzLmhhcyhhc3NldCkpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZShcInByb2dyZXNzXCIsIGFzc2V0KTtcbiAgICAgICAgICAgIHRoaXMuX2xvYWRpbmdBc3NldHMuZGVsZXRlKGFzc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9sb2FkaW5nQXNzZXRzLnNpemUgPT09IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGwgbmV4dCB0aWNrIGJlY2F1c2Ugd2Ugd2FudFxuICAgICAgICAgICAgLy8gdGhpcyB0byBiZSBmaXJlZCBhZnRlciBhbnkgb3RoZXJcbiAgICAgICAgICAgIC8vIGFzc2V0IGxvYWQgZXZlbnRzXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkaW5nQ29tcGxldGUodGhpcy5fZmFpbGVkKTtcbiAgICAgICAgICAgIH0sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2FsbGVkIHdoZW4gYW4gYXNzZXQgZmFpbHMgdG8gbG9hZFxuICAgIF9vbkVycm9yKGVyciwgYXNzZXQpIHtcbiAgICAgICAgLy8gY2hlY2sgdGhpcyBpcyBhbiBhc3NldCB3ZSBjYXJlIGFib3V0XG4gICAgICAgIGlmICh0aGlzLl9sb2FkaW5nQXNzZXRzLmhhcyhhc3NldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZhaWxlZC5wdXNoKGFzc2V0KTtcbiAgICAgICAgICAgIHRoaXMuX2xvYWRpbmdBc3NldHMuZGVsZXRlKGFzc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9sb2FkaW5nQXNzZXRzLnNpemUgPT09IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGwgbmV4dCB0aWNrIGJlY2F1c2Ugd2Ugd2FudFxuICAgICAgICAgICAgLy8gdGhpcyB0byBiZSBmaXJlZCBhZnRlciBhbnkgb3RoZXJcbiAgICAgICAgICAgIC8vIGFzc2V0IGxvYWQgZXZlbnRzXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkaW5nQ29tcGxldGUodGhpcy5fZmFpbGVkKTtcbiAgICAgICAgICAgIH0sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2FsbGVkIHdoZW4gYSBleHBlY3RlZCBhc3NldCBpcyBhZGRlZCB0byB0aGUgYXNzZXQgcmVnaXN0cnlcbiAgICBfb25BZGRBc3NldChhc3NldCkge1xuICAgICAgICAvLyByZW1vdmUgZnJvbSB3YWl0aW5nIGxpc3RcbiAgICAgICAgdGhpcy5fd2FpdGluZ0Fzc2V0cy5kZWxldGUoYXNzZXQpO1xuXG4gICAgICAgIHRoaXMuX2Fzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAgICBpZiAoIWFzc2V0LmxvYWRlZCkge1xuICAgICAgICAgICAgdGhpcy5fbG9hZGluZ0Fzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAgICAgICAgdGhpcy5fcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfd2FpdEZvckFzc2V0KGFzc2V0SWQpIHtcbiAgICAgICAgdGhpcy5fd2FpdGluZ0Fzc2V0cy5hZGQoYXNzZXRJZCk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdHJ5Lm9uY2UoJ2FkZDonICsgYXNzZXRJZCwgdGhpcy5fb25BZGRBc3NldCwgdGhpcyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBc3NldExpc3RMb2FkZXIgfTtcbiJdLCJuYW1lcyI6WyJBc3NldExpc3RMb2FkZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFzc2V0TGlzdCIsImFzc2V0UmVnaXN0cnkiLCJfYXNzZXRzIiwiU2V0IiwiX2xvYWRpbmdBc3NldHMiLCJfd2FpdGluZ0Fzc2V0cyIsIl9yZWdpc3RyeSIsIl9sb2FkaW5nIiwiX2xvYWRlZCIsIl9mYWlsZWQiLCJmb3JFYWNoIiwiYSIsIkFzc2V0IiwicmVnaXN0cnkiLCJhZGQiLCJhc3NldCIsImdldCIsIl93YWl0Rm9yQXNzZXQiLCJkZXN0cm95Iiwic2VsZiIsIm9mZiIsIl9vbkxvYWQiLCJfb25FcnJvciIsImlkIiwiX29uQWRkQXNzZXQiLCJfYXNzZXRIYXNEZXBlbmRlbmNpZXMiLCJ0eXBlIiwiZmlsZSIsInVybCIsIm1hdGNoIiwibG9hZCIsImRvbmUiLCJzY29wZSIsImNvbnNvbGUiLCJkZWJ1ZyIsIl9jYWxsYmFjayIsIl9zY29wZSIsIm9uIiwibG9hZGluZ0Fzc2V0cyIsImxvYWRlZCIsImxvYWRGcm9tVXJsIiwiZXJyIiwibG9hZGVkQXNzZXQiLCJzaXplIiwiX2xvYWRpbmdDb21wbGV0ZSIsInJlYWR5IiwiY2FsbCIsIkFycmF5IiwiZnJvbSIsIm9uY2UiLCJhc3NldHMiLCJsZW5ndGgiLCJmaXJlIiwiaGFzIiwiZGVsZXRlIiwic2V0VGltZW91dCIsInB1c2giLCJhc3NldElkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFlBQVksQ0FBQztBQUN2QztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsU0FBUyxFQUFFQyxhQUFhLEVBQUU7QUFDbEMsSUFBQSxLQUFL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
