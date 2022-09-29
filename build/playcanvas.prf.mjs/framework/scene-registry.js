/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../core/path.js';
import '../core/tracing.js';
import { ABSOLUTE_URL } from '../asset/constants.js';
import { SceneRegistryItem } from './scene-registry-item.js';

class SceneRegistry {
  constructor(app) {
    this._app = app;
    this._list = [];
    this._index = {};
    this._urlIndex = {};
  }

  destroy() {
    this._app = null;
  }

  list() {
    return this._list;
  }

  add(name, url) {
    if (this._index.hasOwnProperty(name)) {
      return false;
    }

    const item = new SceneRegistryItem(name, url);

    const i = this._list.push(item);

    this._index[item.name] = i - 1;
    this._urlIndex[item.url] = i - 1;
    return true;
  }

  find(name) {
    if (this._index.hasOwnProperty(name)) {
      return this._list[this._index[name]];
    }

    return null;
  }

  findByUrl(url) {
    if (this._urlIndex.hasOwnProperty(url)) {
      return this._list[this._urlIndex[url]];
    }

    return null;
  }

  remove(name) {
    if (this._index.hasOwnProperty(name)) {
      const idx = this._index[name];
      let item = this._list[idx];
      delete this._urlIndex[item.url];
      delete this._index[name];

      this._list.splice(idx, 1);

      for (let i = 0; i < this._list.length; i++) {
        item = this._list[i];
        this._index[item.name] = i;
        this._urlIndex[item.url] = i;
      }
    }
  }

  _loadSceneData(sceneItem, storeInCache, callback) {
    const app = this._app;
    let url = sceneItem;

    if (typeof sceneItem === 'string') {
      sceneItem = this.findByUrl(url) || this.find(url) || new SceneRegistryItem('Untitled', url);
    }

    url = sceneItem.url;

    if (!url) {
      callback("Cannot find scene to load");
      return;
    }

    if (sceneItem.loaded) {
      callback(null, sceneItem);
      return;
    }

    if (app.assets && app.assets.prefix && !ABSOLUTE_URL.test(url)) {
      url = path.join(app.assets.prefix, url);
    }

    sceneItem._onLoadedCallbacks.push(callback);

    if (!sceneItem._loading) {
      const handler = app.loader.getHandler("hierarchy");
      handler.load(url, (err, data) => {
        sceneItem.data = data;
        sceneItem._loading = false;

        for (let i = 0; i < sceneItem._onLoadedCallbacks.length; i++) {
          sceneItem._onLoadedCallbacks[i](err, sceneItem);
        }

        if (!storeInCache) {
          sceneItem.data = null;
        }

        sceneItem._onLoadedCallbacks.length = 0;
      });
    }

    sceneItem._loading = true;
  }

  loadSceneData(sceneItem, callback) {
    this._loadSceneData(sceneItem, true, callback);
  }

  unloadSceneData(sceneItem) {
    if (typeof sceneItem === 'string') {
      sceneItem = this.findByUrl(sceneItem);
    }

    if (sceneItem) {
      sceneItem.data = null;
    }
  }

  _loadSceneHierarchy(sceneItem, onBeforeAddHierarchy, callback) {
    this._loadSceneData(sceneItem, false, (err, sceneItem) => {
      if (err) {
        if (callback) {
          callback(err);
        }

        return;
      }

      if (onBeforeAddHierarchy) {
        onBeforeAddHierarchy(sceneItem);
      }

      const app = this._app;

      const _loaded = () => {
        const handler = app.loader.getHandler("hierarchy");
        app.systems.script.preloading = true;
        const entity = handler.open(sceneItem.url, sceneItem.data);
        app.systems.script.preloading = false;
        app.loader.clearCache(sceneItem.url, "hierarchy");
        app.root.addChild(entity);
        app.systems.fire('initialize', entity);
        app.systems.fire('postInitialize', entity);
        app.systems.fire('postPostInitialize', entity);
        if (callback) callback(null, entity);
      };

      app._preloadScripts(sceneItem.data, _loaded);
    });
  }

  loadSceneHierarchy(sceneItem, callback) {
    this._loadSceneHierarchy(sceneItem, null, callback);
  }

  loadSceneSettings(sceneItem, callback) {
    this._loadSceneData(sceneItem, false, (err, sceneItem) => {
      if (!err) {
        this._app.applySceneSettings(sceneItem.data.settings);

        if (callback) {
          callback(null);
        }
      } else {
        if (callback) {
          callback(err);
        }
      }
    });
  }

  changeScene(sceneItem, callback) {
    const app = this._app;

    const onBeforeAddHierarchy = sceneItem => {
      const rootChildren = app.root.children;

      while (rootChildren.length > 0) {
        const child = rootChildren[0];
        child.reparent(null);
        child.destroy == null ? void 0 : child.destroy();
      }

      app.applySceneSettings(sceneItem.data.settings);
    };

    this._loadSceneHierarchy(sceneItem, onBeforeAddHierarchy, callback);
  }

  loadScene(url, callback) {
    const app = this._app;
    const handler = app.loader.getHandler("scene");

    if (app.assets && app.assets.prefix && !ABSOLUTE_URL.test(url)) {
      url = path.join(app.assets.prefix, url);
    }

    handler.load(url, (err, data) => {
      if (!err) {
        const _loaded = () => {
          app.systems.script.preloading = true;
          const scene = handler.open(url, data);
          const sceneItem = this.findByUrl(url);

          if (sceneItem && !sceneItem.loaded) {
            sceneItem.data = data;
          }

          app.systems.script.preloading = false;
          app.loader.clearCache(url, "scene");
          app.loader.patch({
            resource: scene,
            type: "scene"
          }, app.assets);
          app.root.addChild(scene.root);

          if (app.systems.rigidbody && typeof Ammo !== 'undefined') {
            app.systems.rigidbody.gravity.set(scene._gravity.x, scene._gravity.y, scene._gravity.z);
          }

          if (callback) {
            callback(null, scene);
          }
        };

        app._preloadScripts(data, _loaded);
      } else {
        if (callback) {
          callback(err);
        }
      }
    });
  }

}

export { SceneRegistry };
