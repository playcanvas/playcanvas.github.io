/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../core/path.js';
import { Debug } from '../core/debug.js';
import { ABSOLUTE_URL } from './asset/constants.js';
import { SceneRegistryItem } from './scene-registry-item.js';

/**
 * Callback used by {@link SceneRegistry#loadSceneHierarchy}.
 *
 * @callback LoadHierarchyCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {import('./entity.js').Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * Callback used by {@link SceneRegistry#loadSceneSettings}.
 *
 * @callback LoadSettingsCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * Callback used by {@link SceneRegistry#changeScene}.
 *
 * @callback ChangeSceneCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {import('./entity.js').Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * Callback used by {@link SceneRegistry#loadScene}.
 *
 * @callback LoadSceneCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {import('./entity.js').Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * Callback used by {@link SceneRegistry#loadSceneData}.
 *
 * @callback LoadSceneDataCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {SceneRegistryItem} [sceneItem] - The scene registry item if no errors were encountered.
 */

/**
 * Container for storing and loading of scenes. An instance of the registry is created on the
 * {@link AppBase} object as {@link AppBase#scenes}.
 */
class SceneRegistry {
  /**
   * Create a new SceneRegistry instance.
   *
   * @param {import('./app-base.js').AppBase} app - The application.
   */
  constructor(app) {
    this._app = app;
    this._list = [];
    this._index = {};
    this._urlIndex = {};
  }
  destroy() {
    this._app = null;
  }

  /**
   * Return the list of scene.
   *
   * @returns {SceneRegistryItem[]} All items in the registry.
   */
  list() {
    return this._list;
  }

  /**
   * Add a new item to the scene registry.
   *
   * @param {string} name - The name of the scene.
   * @param {string} url -  The url of the scene file.
   * @returns {boolean} Returns true if the scene was successfully added to the registry, false otherwise.
   */
  add(name, url) {
    if (this._index.hasOwnProperty(name)) {
      Debug.warn('pc.SceneRegistry: trying to add more than one scene called: ' + name);
      return false;
    }
    const item = new SceneRegistryItem(name, url);
    const i = this._list.push(item);
    this._index[item.name] = i - 1;
    this._urlIndex[item.url] = i - 1;
    return true;
  }

  /**
   * Find a Scene by name and return the {@link SceneRegistryItem}.
   *
   * @param {string} name - The name of the scene.
   * @returns {SceneRegistryItem|null} The stored data about a scene or null if no scene with
   * that name exists.
   */
  find(name) {
    if (this._index.hasOwnProperty(name)) {
      return this._list[this._index[name]];
    }
    return null;
  }

  /**
   * Find a scene by the URL and return the {@link SceneRegistryItem}.
   *
   * @param {string} url - The URL to search by.
   * @returns {SceneRegistryItem|null} The stored data about a scene or null if no scene with
   * that URL exists.
   */
  findByUrl(url) {
    if (this._urlIndex.hasOwnProperty(url)) {
      return this._list[this._urlIndex[url]];
    }
    return null;
  }

  /**
   * Remove an item from the scene registry.
   *
   * @param {string} name - The name of the scene.
   */
  remove(name) {
    if (this._index.hasOwnProperty(name)) {
      const idx = this._index[name];
      let item = this._list[idx];
      delete this._urlIndex[item.url];
      // remove from index
      delete this._index[name];

      // remove from list
      this._list.splice(idx, 1);

      // refresh index
      for (let i = 0; i < this._list.length; i++) {
        item = this._list[i];
        this._index[item.name] = i;
        this._urlIndex[item.url] = i;
      }
    }
  }

  // Private function to load scene data with the option to cache
  // This allows us to retain expected behavior of loadSceneSettings and loadSceneHierarchy where they
  // don't store loaded data which may be undesired behavior with projects that have many scenes.
  _loadSceneData(sceneItem, storeInCache, callback) {
    const app = this._app;
    // If it's a sceneItem, we want to be able to cache the data
    // that is loaded so we don't do a subsequent http requests
    // on the same scene later

    // If it's just a URL or scene name then attempt to find
    // the scene item in the registry else create a temp
    // SceneRegistryItem to use for this function as the scene
    // may not have been added to the registry
    let url = sceneItem;
    if (typeof sceneItem === 'string') {
      sceneItem = this.findByUrl(url) || this.find(url) || new SceneRegistryItem('Untitled', url);
    }
    url = sceneItem.url;
    if (!url) {
      callback("Cannot find scene to load");
      return;
    }

    // If we have the data already loaded, no need to do another HTTP request
    if (sceneItem.loaded) {
      callback(null, sceneItem);
      return;
    }

    // include asset prefix if present
    if (app.assets && app.assets.prefix && !ABSOLUTE_URL.test(url)) {
      url = path.join(app.assets.prefix, url);
    }
    sceneItem._onLoadedCallbacks.push(callback);
    if (!sceneItem._loading) {
      // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
      // Split loading into load and open
      const handler = app.loader.getHandler("hierarchy");
      handler.load(url, (err, data) => {
        sceneItem.data = data;
        sceneItem._loading = false;
        for (let i = 0; i < sceneItem._onLoadedCallbacks.length; i++) {
          sceneItem._onLoadedCallbacks[i](err, sceneItem);
        }

        // Remove the data if it's not been requested to store in cache
        if (!storeInCache) {
          sceneItem.data = null;
        }
        sceneItem._onLoadedCallbacks.length = 0;
      });
    }
    sceneItem._loading = true;
  }

  /**
   * Loads and stores the scene data to reduce the number of the network requests when the same
   * scenes are loaded multiple times. Can also be used to load data before calling
   * {@link SceneRegistry#loadSceneHierarchy} and {@link SceneRegistry#loadSceneSettings} to make
   * scene loading quicker for the user.
   *
   * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
   * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
   * @param {LoadSceneDataCallback} callback - The function to call after loading,
   * passed (err, sceneItem) where err is null if no errors occurred.
   * @example
   * var sceneItem = app.scenes.find("Scene Name");
   * app.scenes.loadSceneData(sceneItem, function (err, sceneItem) {
   *     if (err) {
   *         // error
   *     }
   * });
   */
  loadSceneData(sceneItem, callback) {
    this._loadSceneData(sceneItem, true, callback);
  }

  /**
   * Unloads scene data that has been loaded previously using {@link SceneRegistry#loadSceneData}.
   *
   * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
   * {@link SceneRegistry#find} or URL of the scene file. Usually this will be "scene_id.json".
   * @example
   * var sceneItem = app.scenes.find("Scene Name");
   * app.scenes.unloadSceneData(sceneItem);
   */
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

      // called after scripts are preloaded
      const _loaded = () => {
        // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
        // Split loading into load and open
        const handler = app.loader.getHandler("hierarchy");
        app.systems.script.preloading = true;
        const entity = handler.open(sceneItem.url, sceneItem.data);
        app.systems.script.preloading = false;

        // clear from cache because this data is modified by entity operations (e.g. destroy)
        app.loader.clearCache(sceneItem.url, "hierarchy");

        // add to hierarchy
        app.root.addChild(entity);

        // initialize components
        app.systems.fire('initialize', entity);
        app.systems.fire('postInitialize', entity);
        app.systems.fire('postPostInitialize', entity);
        if (callback) callback(null, entity);
      };

      // load priority and referenced scripts before opening scene
      app._preloadScripts(sceneItem.data, _loaded);
    });
  }

  /**
   * Load a scene file, create and initialize the Entity hierarchy and add the hierarchy to the
   * application root Entity.
   *
   * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
   * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
   * @param {LoadHierarchyCallback} callback - The function to call after loading,
   * passed (err, entity) where err is null if no errors occurred.
   * @example
   * var sceneItem = app.scenes.find("Scene Name");
   * app.scenes.loadSceneHierarchy(sceneItem, function (err, entity) {
   *     if (!err) {
   *         var e = app.root.find("My New Entity");
   *     } else {
   *         // error
   *     }
   * });
   */
  loadSceneHierarchy(sceneItem, callback) {
    this._loadSceneHierarchy(sceneItem, null, callback);
  }

  /**
   * Load a scene file and apply the scene settings to the current scene.
   *
   * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
   * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
   * @param {LoadSettingsCallback} callback - The function called after the settings
   * are applied. Passed (err) where err is null if no error occurred.
   * @example
   * var sceneItem = app.scenes.find("Scene Name");
   * app.scenes.loadSceneSettings(sceneItem, function (err) {
   *     if (!err) {
   *         // success
   *     } else {
   *         // error
   *     }
   * });
   */
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

  /**
   * Change to a new scene. Calling this function will load the scene data, delete all
   * entities and graph nodes under `app.root` and load the scene settings and hierarchy.
   *
   * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
   * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
   * @param {ChangeSceneCallback} [callback] - The function to call after loading,
   * passed (err, entity) where err is null if no errors occurred.
   * @example
   * app.scenes.changeScene("Scene Name", function (err, entity) {
   *     if (!err) {
   *         // success
   *     } else {
   *         // error
   *     }
   * });
   */
  changeScene(sceneItem, callback) {
    const app = this._app;
    const onBeforeAddHierarchy = sceneItem => {
      // Destroy/Remove all nodes on the app.root
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

  /**
   * Load the scene hierarchy and scene settings. This is an internal method used by the
   * {@link AppBase}.
   *
   * @param {string} url - The URL of the scene file.
   * @param {LoadSceneCallback} callback - The function called after the settings are
   * applied. Passed (err, scene) where err is null if no error occurred and scene is the
   * {@link Scene}.
   */
  loadScene(url, callback) {
    const app = this._app;
    const handler = app.loader.getHandler("scene");

    // include asset prefix if present
    if (app.assets && app.assets.prefix && !ABSOLUTE_URL.test(url)) {
      url = path.join(app.assets.prefix, url);
    }
    handler.load(url, (err, data) => {
      if (!err) {
        const _loaded = () => {
          // parse and create scene
          app.systems.script.preloading = true;
          const scene = handler.open(url, data);

          // Cache the data as we are loading via URL only
          const sceneItem = this.findByUrl(url);
          if (sceneItem && !sceneItem.loaded) {
            sceneItem.data = data;
          }
          app.systems.script.preloading = false;

          // clear scene from cache because we'll destroy it when we load another one
          // so data will be invalid
          app.loader.clearCache(url, "scene");
          app.loader.patch({
            resource: scene,
            type: "scene"
          }, app.assets);
          app.root.addChild(scene.root);

          // Initialize pack settings
          if (app.systems.rigidbody && typeof Ammo !== 'undefined') {
            app.systems.rigidbody.gravity.set(scene._gravity.x, scene._gravity.y, scene._gravity.z);
          }
          if (callback) {
            callback(null, scene);
          }
        };

        // preload scripts before opening scene
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtcmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NlbmUtcmVnaXN0cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBQlNPTFVURV9VUkwgfSBmcm9tICcuL2Fzc2V0L2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFNjZW5lUmVnaXN0cnlJdGVtIH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS1pdGVtLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBTY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZUhpZXJhcmNoeX0uXG4gKlxuICogQGNhbGxiYWNrIExvYWRIaWVyYXJjaHlDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuL2VudGl0eS5qcycpLkVudGl0eX0gW2VudGl0eV0gLSBUaGUgbG9hZGVkIHJvb3QgZW50aXR5IGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVTZXR0aW5nc30uXG4gKlxuICogQGNhbGxiYWNrIExvYWRTZXR0aW5nc0NhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgU2NlbmVSZWdpc3RyeSNjaGFuZ2VTY2VuZX0uXG4gKlxuICogQGNhbGxiYWNrIENoYW5nZVNjZW5lQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFtlbnRpdHldIC0gVGhlIGxvYWRlZCByb290IGVudGl0eSBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lfS5cbiAqXG4gKiBAY2FsbGJhY2sgTG9hZFNjZW5lQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFtlbnRpdHldIC0gVGhlIGxvYWRlZCByb290IGVudGl0eSBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lRGF0YX0uXG4gKlxuICogQGNhbGxiYWNrIExvYWRTY2VuZURhdGFDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW19IFtzY2VuZUl0ZW1dIC0gVGhlIHNjZW5lIHJlZ2lzdHJ5IGl0ZW0gaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gKi9cblxuLyoqXG4gKiBDb250YWluZXIgZm9yIHN0b3JpbmcgYW5kIGxvYWRpbmcgb2Ygc2NlbmVzLiBBbiBpbnN0YW5jZSBvZiB0aGUgcmVnaXN0cnkgaXMgY3JlYXRlZCBvbiB0aGVcbiAqIHtAbGluayBBcHBCYXNlfSBvYmplY3QgYXMge0BsaW5rIEFwcEJhc2Ujc2NlbmVzfS5cbiAqL1xuY2xhc3MgU2NlbmVSZWdpc3RyeSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjZW5lUmVnaXN0cnkgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xuICAgICAgICB0aGlzLl9saXN0ID0gW107XG4gICAgICAgIHRoaXMuX2luZGV4ID0ge307XG4gICAgICAgIHRoaXMuX3VybEluZGV4ID0ge307XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fYXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGxpc3Qgb2Ygc2NlbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2NlbmVSZWdpc3RyeUl0ZW1bXX0gQWxsIGl0ZW1zIGluIHRoZSByZWdpc3RyeS5cbiAgICAgKi9cbiAgICBsaXN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlzdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBuZXcgaXRlbSB0byB0aGUgc2NlbmUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gIFRoZSB1cmwgb2YgdGhlIHNjZW5lIGZpbGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc2NlbmUgd2FzIHN1Y2Nlc3NmdWxseSBhZGRlZCB0byB0aGUgcmVnaXN0cnksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBhZGQobmFtZSwgdXJsKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbmRleC5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgRGVidWcud2FybigncGMuU2NlbmVSZWdpc3RyeTogdHJ5aW5nIHRvIGFkZCBtb3JlIHRoYW4gb25lIHNjZW5lIGNhbGxlZDogJyArIG5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXRlbSA9IG5ldyBTY2VuZVJlZ2lzdHJ5SXRlbShuYW1lLCB1cmwpO1xuXG4gICAgICAgIGNvbnN0IGkgPSB0aGlzLl9saXN0LnB1c2goaXRlbSk7XG4gICAgICAgIHRoaXMuX2luZGV4W2l0ZW0ubmFtZV0gPSBpIC0gMTtcbiAgICAgICAgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdID0gaSAtIDE7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZCBhIFNjZW5lIGJ5IG5hbWUgYW5kIHJldHVybiB0aGUge0BsaW5rIFNjZW5lUmVnaXN0cnlJdGVtfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtTY2VuZVJlZ2lzdHJ5SXRlbXxudWxsfSBUaGUgc3RvcmVkIGRhdGEgYWJvdXQgYSBzY2VuZSBvciBudWxsIGlmIG5vIHNjZW5lIHdpdGhcbiAgICAgKiB0aGF0IG5hbWUgZXhpc3RzLlxuICAgICAqL1xuICAgIGZpbmQobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5faW5kZXguaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0W3RoaXMuX2luZGV4W25hbWVdXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBzY2VuZSBieSB0aGUgVVJMIGFuZCByZXR1cm4gdGhlIHtAbGluayBTY2VuZVJlZ2lzdHJ5SXRlbX0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIFVSTCB0byBzZWFyY2ggYnkuXG4gICAgICogQHJldHVybnMge1NjZW5lUmVnaXN0cnlJdGVtfG51bGx9IFRoZSBzdG9yZWQgZGF0YSBhYm91dCBhIHNjZW5lIG9yIG51bGwgaWYgbm8gc2NlbmUgd2l0aFxuICAgICAqIHRoYXQgVVJMIGV4aXN0cy5cbiAgICAgKi9cbiAgICBmaW5kQnlVcmwodXJsKSB7XG4gICAgICAgIGlmICh0aGlzLl91cmxJbmRleC5oYXNPd25Qcm9wZXJ0eSh1cmwpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlzdFt0aGlzLl91cmxJbmRleFt1cmxdXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhbiBpdGVtIGZyb20gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2NlbmUuXG4gICAgICovXG4gICAgcmVtb3ZlKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luZGV4Lmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9pbmRleFtuYW1lXTtcbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fbGlzdFtpZHhdO1xuXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdO1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gaW5kZXhcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9pbmRleFtuYW1lXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGlzdFxuICAgICAgICAgICAgdGhpcy5fbGlzdC5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICAgICAgLy8gcmVmcmVzaCBpbmRleFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2xpc3RbaV07XG4gICAgICAgICAgICAgICAgdGhpcy5faW5kZXhbaXRlbS5uYW1lXSA9IGk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFByaXZhdGUgZnVuY3Rpb24gdG8gbG9hZCBzY2VuZSBkYXRhIHdpdGggdGhlIG9wdGlvbiB0byBjYWNoZVxuICAgIC8vIFRoaXMgYWxsb3dzIHVzIHRvIHJldGFpbiBleHBlY3RlZCBiZWhhdmlvciBvZiBsb2FkU2NlbmVTZXR0aW5ncyBhbmQgbG9hZFNjZW5lSGllcmFyY2h5IHdoZXJlIHRoZXlcbiAgICAvLyBkb24ndCBzdG9yZSBsb2FkZWQgZGF0YSB3aGljaCBtYXkgYmUgdW5kZXNpcmVkIGJlaGF2aW9yIHdpdGggcHJvamVjdHMgdGhhdCBoYXZlIG1hbnkgc2NlbmVzLlxuICAgIF9sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgc3RvcmVJbkNhY2hlLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLl9hcHA7XG4gICAgICAgIC8vIElmIGl0J3MgYSBzY2VuZUl0ZW0sIHdlIHdhbnQgdG8gYmUgYWJsZSB0byBjYWNoZSB0aGUgZGF0YVxuICAgICAgICAvLyB0aGF0IGlzIGxvYWRlZCBzbyB3ZSBkb24ndCBkbyBhIHN1YnNlcXVlbnQgaHR0cCByZXF1ZXN0c1xuICAgICAgICAvLyBvbiB0aGUgc2FtZSBzY2VuZSBsYXRlclxuXG4gICAgICAgIC8vIElmIGl0J3MganVzdCBhIFVSTCBvciBzY2VuZSBuYW1lIHRoZW4gYXR0ZW1wdCB0byBmaW5kXG4gICAgICAgIC8vIHRoZSBzY2VuZSBpdGVtIGluIHRoZSByZWdpc3RyeSBlbHNlIGNyZWF0ZSBhIHRlbXBcbiAgICAgICAgLy8gU2NlbmVSZWdpc3RyeUl0ZW0gdG8gdXNlIGZvciB0aGlzIGZ1bmN0aW9uIGFzIHRoZSBzY2VuZVxuICAgICAgICAvLyBtYXkgbm90IGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgcmVnaXN0cnlcbiAgICAgICAgbGV0IHVybCA9IHNjZW5lSXRlbTtcbiAgICAgICAgaWYgKHR5cGVvZiBzY2VuZUl0ZW0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY2VuZUl0ZW0gPSB0aGlzLmZpbmRCeVVybCh1cmwpIHx8IHRoaXMuZmluZCh1cmwpIHx8IG5ldyBTY2VuZVJlZ2lzdHJ5SXRlbSgnVW50aXRsZWQnLCB1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdXJsID0gc2NlbmVJdGVtLnVybDtcblxuICAgICAgICBpZiAoIXVybCkge1xuICAgICAgICAgICAgY2FsbGJhY2soXCJDYW5ub3QgZmluZCBzY2VuZSB0byBsb2FkXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgZGF0YSBhbHJlYWR5IGxvYWRlZCwgbm8gbmVlZCB0byBkbyBhbm90aGVyIEhUVFAgcmVxdWVzdFxuICAgICAgICBpZiAoc2NlbmVJdGVtLmxvYWRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2NlbmVJdGVtKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluY2x1ZGUgYXNzZXQgcHJlZml4IGlmIHByZXNlbnRcbiAgICAgICAgaWYgKGFwcC5hc3NldHMgJiYgYXBwLmFzc2V0cy5wcmVmaXggJiYgIUFCU09MVVRFX1VSTC50ZXN0KHVybCkpIHtcbiAgICAgICAgICAgIHVybCA9IHBhdGguam9pbihhcHAuYXNzZXRzLnByZWZpeCwgdXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lSXRlbS5fb25Mb2FkZWRDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cbiAgICAgICAgaWYgKCFzY2VuZUl0ZW0uX2xvYWRpbmcpIHtcbiAgICAgICAgICAgIC8vIEJlY2F1c2Ugd2UgbmVlZCB0byBsb2FkIHNjcmlwdHMgYmVmb3JlIHdlIGluc3RhbmNlIHRoZSBoaWVyYXJjaHkgKGkuZS4gYmVmb3JlIHdlIGNyZWF0ZSBzY3JpcHQgY29tcG9uZW50cylcbiAgICAgICAgICAgIC8vIFNwbGl0IGxvYWRpbmcgaW50byBsb2FkIGFuZCBvcGVuXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gYXBwLmxvYWRlci5nZXRIYW5kbGVyKFwiaGllcmFyY2h5XCIpO1xuXG4gICAgICAgICAgICBoYW5kbGVyLmxvYWQodXJsLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgc2NlbmVJdGVtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5fbG9hZGluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZUl0ZW0uX29uTG9hZGVkQ2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5fb25Mb2FkZWRDYWxsYmFja3NbaV0oZXJyLCBzY2VuZUl0ZW0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgZGF0YSBpZiBpdCdzIG5vdCBiZWVuIHJlcXVlc3RlZCB0byBzdG9yZSBpbiBjYWNoZVxuICAgICAgICAgICAgICAgIGlmICghc3RvcmVJbkNhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5kYXRhID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzY2VuZUl0ZW0uX29uTG9hZGVkQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lSXRlbS5fbG9hZGluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZHMgYW5kIHN0b3JlcyB0aGUgc2NlbmUgZGF0YSB0byByZWR1Y2UgdGhlIG51bWJlciBvZiB0aGUgbmV0d29yayByZXF1ZXN0cyB3aGVuIHRoZSBzYW1lXG4gICAgICogc2NlbmVzIGFyZSBsb2FkZWQgbXVsdGlwbGUgdGltZXMuIENhbiBhbHNvIGJlIHVzZWQgdG8gbG9hZCBkYXRhIGJlZm9yZSBjYWxsaW5nXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lSGllcmFyY2h5fSBhbmQge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lU2V0dGluZ3N9IHRvIG1ha2VcbiAgICAgKiBzY2VuZSBsb2FkaW5nIHF1aWNrZXIgZm9yIHRoZSB1c2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0xvYWRTY2VuZURhdGFDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBzY2VuZUl0ZW0pIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzY2VuZUl0ZW0gPSBhcHAuc2NlbmVzLmZpbmQoXCJTY2VuZSBOYW1lXCIpO1xuICAgICAqIGFwcC5zY2VuZXMubG9hZFNjZW5lRGF0YShzY2VuZUl0ZW0sIGZ1bmN0aW9uIChlcnIsIHNjZW5lSXRlbSkge1xuICAgICAqICAgICBpZiAoZXJyKSB7XG4gICAgICogICAgICAgICAvLyBlcnJvclxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZFNjZW5lRGF0YShzY2VuZUl0ZW0sIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2xvYWRTY2VuZURhdGEoc2NlbmVJdGVtLCB0cnVlLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVW5sb2FkcyBzY2VuZSBkYXRhIHRoYXQgaGFzIGJlZW4gbG9hZGVkIHByZXZpb3VzbHkgdXNpbmcge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lRGF0YX0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjZW5lUmVnaXN0cnlJdGVtIHwgc3RyaW5nfSBzY2VuZUl0ZW0gLSBUaGUgc2NlbmUgaXRlbSAod2hpY2ggY2FuIGJlIGZvdW5kIHdpdGhcbiAgICAgKiB7QGxpbmsgU2NlbmVSZWdpc3RyeSNmaW5kfSBvciBVUkwgb2YgdGhlIHNjZW5lIGZpbGUuIFVzdWFsbHkgdGhpcyB3aWxsIGJlIFwic2NlbmVfaWQuanNvblwiLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy51bmxvYWRTY2VuZURhdGEoc2NlbmVJdGVtKTtcbiAgICAgKi9cbiAgICB1bmxvYWRTY2VuZURhdGEoc2NlbmVJdGVtKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2NlbmVJdGVtID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgc2NlbmVJdGVtID0gdGhpcy5maW5kQnlVcmwoc2NlbmVJdGVtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY2VuZUl0ZW0pIHtcbiAgICAgICAgICAgIHNjZW5lSXRlbS5kYXRhID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBvbkJlZm9yZUFkZEhpZXJhcmNoeSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fbG9hZFNjZW5lRGF0YShzY2VuZUl0ZW0sIGZhbHNlLCAoZXJyLCBzY2VuZUl0ZW0pID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob25CZWZvcmVBZGRIaWVyYXJjaHkpIHtcbiAgICAgICAgICAgICAgICBvbkJlZm9yZUFkZEhpZXJhcmNoeShzY2VuZUl0ZW0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhcHAgPSB0aGlzLl9hcHA7XG5cbiAgICAgICAgICAgIC8vIGNhbGxlZCBhZnRlciBzY3JpcHRzIGFyZSBwcmVsb2FkZWRcbiAgICAgICAgICAgIGNvbnN0IF9sb2FkZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gQmVjYXVzZSB3ZSBuZWVkIHRvIGxvYWQgc2NyaXB0cyBiZWZvcmUgd2UgaW5zdGFuY2UgdGhlIGhpZXJhcmNoeSAoaS5lLiBiZWZvcmUgd2UgY3JlYXRlIHNjcmlwdCBjb21wb25lbnRzKVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGxvYWRpbmcgaW50byBsb2FkIGFuZCBvcGVuXG4gICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IGFwcC5sb2FkZXIuZ2V0SGFuZGxlcihcImhpZXJhcmNoeVwiKTtcblxuICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHkgPSBoYW5kbGVyLm9wZW4oc2NlbmVJdGVtLnVybCwgc2NlbmVJdGVtLmRhdGEpO1xuXG4gICAgICAgICAgICAgICAgYXBwLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIGNsZWFyIGZyb20gY2FjaGUgYmVjYXVzZSB0aGlzIGRhdGEgaXMgbW9kaWZpZWQgYnkgZW50aXR5IG9wZXJhdGlvbnMgKGUuZy4gZGVzdHJveSlcbiAgICAgICAgICAgICAgICBhcHAubG9hZGVyLmNsZWFyQ2FjaGUoc2NlbmVJdGVtLnVybCwgXCJoaWVyYXJjaHlcIik7XG5cbiAgICAgICAgICAgICAgICAvLyBhZGQgdG8gaGllcmFyY2h5XG4gICAgICAgICAgICAgICAgYXBwLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcblxuICAgICAgICAgICAgICAgIC8vIGluaXRpYWxpemUgY29tcG9uZW50c1xuICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLmZpcmUoJ2luaXRpYWxpemUnLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLmZpcmUoJ3Bvc3RJbml0aWFsaXplJywgZW50aXR5KTtcbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5maXJlKCdwb3N0UG9zdEluaXRpYWxpemUnLCBlbnRpdHkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBlbnRpdHkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gbG9hZCBwcmlvcml0eSBhbmQgcmVmZXJlbmNlZCBzY3JpcHRzIGJlZm9yZSBvcGVuaW5nIHNjZW5lXG4gICAgICAgICAgICBhcHAuX3ByZWxvYWRTY3JpcHRzKHNjZW5lSXRlbS5kYXRhLCBfbG9hZGVkKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhIHNjZW5lIGZpbGUsIGNyZWF0ZSBhbmQgaW5pdGlhbGl6ZSB0aGUgRW50aXR5IGhpZXJhcmNoeSBhbmQgYWRkIHRoZSBoaWVyYXJjaHkgdG8gdGhlXG4gICAgICogYXBwbGljYXRpb24gcm9vdCBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjZW5lUmVnaXN0cnlJdGVtIHwgc3RyaW5nfSBzY2VuZUl0ZW0gLSBUaGUgc2NlbmUgaXRlbSAod2hpY2ggY2FuIGJlIGZvdW5kIHdpdGhcbiAgICAgKiB7QGxpbmsgU2NlbmVSZWdpc3RyeSNmaW5kfSwgVVJMIG9mIHRoZSBzY2VuZSBmaWxlIChlLmcuXCJzY2VuZV9pZC5qc29uXCIpIG9yIG5hbWUgb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7TG9hZEhpZXJhcmNoeUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiB0byBjYWxsIGFmdGVyIGxvYWRpbmcsXG4gICAgICogcGFzc2VkIChlcnIsIGVudGl0eSkgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3JzIG9jY3VycmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy5sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBmdW5jdGlvbiAoZXJyLCBlbnRpdHkpIHtcbiAgICAgKiAgICAgaWYgKCFlcnIpIHtcbiAgICAgKiAgICAgICAgIHZhciBlID0gYXBwLnJvb3QuZmluZChcIk15IE5ldyBFbnRpdHlcIik7XG4gICAgICogICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICAvLyBlcnJvclxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZFNjZW5lSGllcmFyY2h5KHNjZW5lSXRlbSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fbG9hZFNjZW5lSGllcmFyY2h5KHNjZW5lSXRlbSwgbnVsbCwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYSBzY2VuZSBmaWxlIGFuZCBhcHBseSB0aGUgc2NlbmUgc2V0dGluZ3MgdG8gdGhlIGN1cnJlbnQgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjZW5lUmVnaXN0cnlJdGVtIHwgc3RyaW5nfSBzY2VuZUl0ZW0gLSBUaGUgc2NlbmUgaXRlbSAod2hpY2ggY2FuIGJlIGZvdW5kIHdpdGhcbiAgICAgKiB7QGxpbmsgU2NlbmVSZWdpc3RyeSNmaW5kfSwgVVJMIG9mIHRoZSBzY2VuZSBmaWxlIChlLmcuXCJzY2VuZV9pZC5qc29uXCIpIG9yIG5hbWUgb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7TG9hZFNldHRpbmdzQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBhZnRlciB0aGUgc2V0dGluZ3NcbiAgICAgKiBhcmUgYXBwbGllZC4gUGFzc2VkIChlcnIpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9yIG9jY3VycmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy5sb2FkU2NlbmVTZXR0aW5ncyhzY2VuZUl0ZW0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgKiAgICAgaWYgKCFlcnIpIHtcbiAgICAgKiAgICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgKiAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgIC8vIGVycm9yXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkU2NlbmVTZXR0aW5ncyhzY2VuZUl0ZW0sIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2xvYWRTY2VuZURhdGEoc2NlbmVJdGVtLCBmYWxzZSwgKGVyciwgc2NlbmVJdGVtKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcC5hcHBseVNjZW5lU2V0dGluZ3Moc2NlbmVJdGVtLmRhdGEuc2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlIHRvIGEgbmV3IHNjZW5lLiBDYWxsaW5nIHRoaXMgZnVuY3Rpb24gd2lsbCBsb2FkIHRoZSBzY2VuZSBkYXRhLCBkZWxldGUgYWxsXG4gICAgICogZW50aXRpZXMgYW5kIGdyYXBoIG5vZGVzIHVuZGVyIGBhcHAucm9vdGAgYW5kIGxvYWQgdGhlIHNjZW5lIHNldHRpbmdzIGFuZCBoaWVyYXJjaHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjZW5lUmVnaXN0cnlJdGVtIHwgc3RyaW5nfSBzY2VuZUl0ZW0gLSBUaGUgc2NlbmUgaXRlbSAod2hpY2ggY2FuIGJlIGZvdW5kIHdpdGhcbiAgICAgKiB7QGxpbmsgU2NlbmVSZWdpc3RyeSNmaW5kfSwgVVJMIG9mIHRoZSBzY2VuZSBmaWxlIChlLmcuXCJzY2VuZV9pZC5qc29uXCIpIG9yIG5hbWUgb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7Q2hhbmdlU2NlbmVDYWxsYmFja30gW2NhbGxiYWNrXSAtIFRoZSBmdW5jdGlvbiB0byBjYWxsIGFmdGVyIGxvYWRpbmcsXG4gICAgICogcGFzc2VkIChlcnIsIGVudGl0eSkgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3JzIG9jY3VycmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnNjZW5lcy5jaGFuZ2VTY2VuZShcIlNjZW5lIE5hbWVcIiwgZnVuY3Rpb24gKGVyciwgZW50aXR5KSB7XG4gICAgICogICAgIGlmICghZXJyKSB7XG4gICAgICogICAgICAgICAvLyBzdWNjZXNzXG4gICAgICogICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICAvLyBlcnJvclxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgY2hhbmdlU2NlbmUoc2NlbmVJdGVtLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLl9hcHA7XG5cbiAgICAgICAgY29uc3Qgb25CZWZvcmVBZGRIaWVyYXJjaHkgPSAoc2NlbmVJdGVtKSA9PiB7XG4gICAgICAgICAgICAvLyBEZXN0cm95L1JlbW92ZSBhbGwgbm9kZXMgb24gdGhlIGFwcC5yb290XG4gICAgICAgICAgICBjb25zdCByb290Q2hpbGRyZW4gPSBhcHAucm9vdC5jaGlsZHJlbjtcbiAgICAgICAgICAgIHdoaWxlIChyb290Q2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gcm9vdENoaWxkcmVuWzBdO1xuICAgICAgICAgICAgICAgIGNoaWxkLnJlcGFyZW50KG51bGwpO1xuICAgICAgICAgICAgICAgIGNoaWxkLmRlc3Ryb3k/LigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNjZW5lSXRlbS5kYXRhLnNldHRpbmdzKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBvbkJlZm9yZUFkZEhpZXJhcmNoeSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIHNjZW5lIGhpZXJhcmNoeSBhbmQgc2NlbmUgc2V0dGluZ3MuIFRoaXMgaXMgYW4gaW50ZXJuYWwgbWV0aG9kIHVzZWQgYnkgdGhlXG4gICAgICoge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIHNjZW5lIGZpbGUuXG4gICAgICogQHBhcmFtIHtMb2FkU2NlbmVDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIGFmdGVyIHRoZSBzZXR0aW5ncyBhcmVcbiAgICAgKiBhcHBsaWVkLiBQYXNzZWQgKGVyciwgc2NlbmUpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9yIG9jY3VycmVkIGFuZCBzY2VuZSBpcyB0aGVcbiAgICAgKiB7QGxpbmsgU2NlbmV9LlxuICAgICAqL1xuICAgIGxvYWRTY2VuZSh1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuX2FwcDtcblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gYXBwLmxvYWRlci5nZXRIYW5kbGVyKFwic2NlbmVcIik7XG5cbiAgICAgICAgLy8gaW5jbHVkZSBhc3NldCBwcmVmaXggaWYgcHJlc2VudFxuICAgICAgICBpZiAoYXBwLmFzc2V0cyAmJiBhcHAuYXNzZXRzLnByZWZpeCAmJiAhQUJTT0xVVEVfVVJMLnRlc3QodXJsKSkge1xuICAgICAgICAgICAgdXJsID0gcGF0aC5qb2luKGFwcC5hc3NldHMucHJlZml4LCB1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFuZGxlci5sb2FkKHVybCwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBfbG9hZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwYXJzZSBhbmQgY3JlYXRlIHNjZW5lXG4gICAgICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBoYW5kbGVyLm9wZW4odXJsLCBkYXRhKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDYWNoZSB0aGUgZGF0YSBhcyB3ZSBhcmUgbG9hZGluZyB2aWEgVVJMIG9ubHlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NlbmVJdGVtID0gdGhpcy5maW5kQnlVcmwodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjZW5lSXRlbSAmJiAhc2NlbmVJdGVtLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmVJdGVtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXBwLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBzY2VuZSBmcm9tIGNhY2hlIGJlY2F1c2Ugd2UnbGwgZGVzdHJveSBpdCB3aGVuIHdlIGxvYWQgYW5vdGhlciBvbmVcbiAgICAgICAgICAgICAgICAgICAgLy8gc28gZGF0YSB3aWxsIGJlIGludmFsaWRcbiAgICAgICAgICAgICAgICAgICAgYXBwLmxvYWRlci5jbGVhckNhY2hlKHVybCwgXCJzY2VuZVwiKTtcblxuICAgICAgICAgICAgICAgICAgICBhcHAubG9hZGVyLnBhdGNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlOiBzY2VuZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic2NlbmVcIlxuICAgICAgICAgICAgICAgICAgICB9LCBhcHAuYXNzZXRzKTtcblxuICAgICAgICAgICAgICAgICAgICBhcHAucm9vdC5hZGRDaGlsZChzY2VuZS5yb290KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIHBhY2sgc2V0dGluZ3NcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFwcC5zeXN0ZW1zLnJpZ2lkYm9keSAmJiB0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldChzY2VuZS5fZ3Jhdml0eS54LCBzY2VuZS5fZ3Jhdml0eS55LCBzY2VuZS5fZ3Jhdml0eS56KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2NlbmUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIHByZWxvYWQgc2NyaXB0cyBiZWZvcmUgb3BlbmluZyBzY2VuZVxuICAgICAgICAgICAgICAgIGFwcC5fcHJlbG9hZFNjcmlwdHMoZGF0YSwgX2xvYWRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY2VuZVJlZ2lzdHJ5IH07XG4iXSwibmFtZXMiOlsiU2NlbmVSZWdpc3RyeSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiX2FwcCIsIl9saXN0IiwiX2luZGV4IiwiX3VybEluZGV4IiwiZGVzdHJveSIsImxpc3QiLCJhZGQiLCJuYW1lIiwidXJsIiwiaGFzT3duUHJvcGVydHkiLCJEZWJ1ZyIsIndhcm4iLCJpdGVtIiwiU2NlbmVSZWdpc3RyeUl0ZW0iLCJpIiwicHVzaCIsImZpbmQiLCJmaW5kQnlVcmwiLCJyZW1vdmUiLCJpZHgiLCJzcGxpY2UiLCJsZW5ndGgiLCJfbG9hZFNjZW5lRGF0YSIsInNjZW5lSXRlbSIsInN0b3JlSW5DYWNoZSIsImNhbGxiYWNrIiwibG9hZGVkIiwiYXNzZXRzIiwicHJlZml4IiwiQUJTT0xVVEVfVVJMIiwidGVzdCIsInBhdGgiLCJqb2luIiwiX29uTG9hZGVkQ2FsbGJhY2tzIiwiX2xvYWRpbmciLCJoYW5kbGVyIiwibG9hZGVyIiwiZ2V0SGFuZGxlciIsImxvYWQiLCJlcnIiLCJkYXRhIiwibG9hZFNjZW5lRGF0YSIsInVubG9hZFNjZW5lRGF0YSIsIl9sb2FkU2NlbmVIaWVyYXJjaHkiLCJvbkJlZm9yZUFkZEhpZXJhcmNoeSIsIl9sb2FkZWQiLCJzeXN0ZW1zIiwic2NyaXB0IiwicHJlbG9hZGluZyIsImVudGl0eSIsIm9wZW4iLCJjbGVhckNhY2hlIiwicm9vdCIsImFkZENoaWxkIiwiZmlyZSIsIl9wcmVsb2FkU2NyaXB0cyIsImxvYWRTY2VuZUhpZXJhcmNoeSIsImxvYWRTY2VuZVNldHRpbmdzIiwiYXBwbHlTY2VuZVNldHRpbmdzIiwic2V0dGluZ3MiLCJjaGFuZ2VTY2VuZSIsInJvb3RDaGlsZHJlbiIsImNoaWxkcmVuIiwiY2hpbGQiLCJyZXBhcmVudCIsImxvYWRTY2VuZSIsInNjZW5lIiwicGF0Y2giLCJyZXNvdXJjZSIsInR5cGUiLCJyaWdpZGJvZHkiLCJBbW1vIiwiZ3Jhdml0eSIsInNldCIsIl9ncmF2aXR5IiwieCIsInkiLCJ6Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsYUFBYSxDQUFDO0FBQ2hCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxHQUFHLEVBQUU7SUFDYixJQUFJLENBQUNDLElBQUksR0FBR0QsR0FBRyxDQUFBO0lBQ2YsSUFBSSxDQUFDRSxLQUFLLEdBQUcsRUFBRSxDQUFBO0FBQ2YsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFDaEIsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7QUFDdkIsR0FBQTtBQUVBQyxFQUFBQSxPQUFPLEdBQUc7SUFDTixJQUFJLENBQUNKLElBQUksR0FBRyxJQUFJLENBQUE7QUFDcEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lL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
