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
   * const sceneItem = app.scenes.find("Scene Name");
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
   * const sceneItem = app.scenes.find("Scene Name");
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
   * const sceneItem = app.scenes.find("Scene Name");
   * app.scenes.loadSceneHierarchy(sceneItem, function (err, entity) {
   *     if (!err) {
   *         const e = app.root.find("My New Entity");
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
   * const sceneItem = app.scenes.find("Scene Name");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtcmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NlbmUtcmVnaXN0cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBQlNPTFVURV9VUkwgfSBmcm9tICcuL2Fzc2V0L2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFNjZW5lUmVnaXN0cnlJdGVtIH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS1pdGVtLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBTY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZUhpZXJhcmNoeX0uXG4gKlxuICogQGNhbGxiYWNrIExvYWRIaWVyYXJjaHlDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuL2VudGl0eS5qcycpLkVudGl0eX0gW2VudGl0eV0gLSBUaGUgbG9hZGVkIHJvb3QgZW50aXR5IGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVTZXR0aW5nc30uXG4gKlxuICogQGNhbGxiYWNrIExvYWRTZXR0aW5nc0NhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgU2NlbmVSZWdpc3RyeSNjaGFuZ2VTY2VuZX0uXG4gKlxuICogQGNhbGxiYWNrIENoYW5nZVNjZW5lQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFtlbnRpdHldIC0gVGhlIGxvYWRlZCByb290IGVudGl0eSBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lfS5cbiAqXG4gKiBAY2FsbGJhY2sgTG9hZFNjZW5lQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFtlbnRpdHldIC0gVGhlIGxvYWRlZCByb290IGVudGl0eSBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lRGF0YX0uXG4gKlxuICogQGNhbGxiYWNrIExvYWRTY2VuZURhdGFDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW19IFtzY2VuZUl0ZW1dIC0gVGhlIHNjZW5lIHJlZ2lzdHJ5IGl0ZW0gaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gKi9cblxuLyoqXG4gKiBDb250YWluZXIgZm9yIHN0b3JpbmcgYW5kIGxvYWRpbmcgb2Ygc2NlbmVzLiBBbiBpbnN0YW5jZSBvZiB0aGUgcmVnaXN0cnkgaXMgY3JlYXRlZCBvbiB0aGVcbiAqIHtAbGluayBBcHBCYXNlfSBvYmplY3QgYXMge0BsaW5rIEFwcEJhc2Ujc2NlbmVzfS5cbiAqL1xuY2xhc3MgU2NlbmVSZWdpc3RyeSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjZW5lUmVnaXN0cnkgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xuICAgICAgICB0aGlzLl9saXN0ID0gW107XG4gICAgICAgIHRoaXMuX2luZGV4ID0ge307XG4gICAgICAgIHRoaXMuX3VybEluZGV4ID0ge307XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fYXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGxpc3Qgb2Ygc2NlbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2NlbmVSZWdpc3RyeUl0ZW1bXX0gQWxsIGl0ZW1zIGluIHRoZSByZWdpc3RyeS5cbiAgICAgKi9cbiAgICBsaXN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlzdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBuZXcgaXRlbSB0byB0aGUgc2NlbmUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gIFRoZSB1cmwgb2YgdGhlIHNjZW5lIGZpbGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc2NlbmUgd2FzIHN1Y2Nlc3NmdWxseSBhZGRlZCB0byB0aGUgcmVnaXN0cnksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBhZGQobmFtZSwgdXJsKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbmRleC5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgRGVidWcud2FybigncGMuU2NlbmVSZWdpc3RyeTogdHJ5aW5nIHRvIGFkZCBtb3JlIHRoYW4gb25lIHNjZW5lIGNhbGxlZDogJyArIG5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXRlbSA9IG5ldyBTY2VuZVJlZ2lzdHJ5SXRlbShuYW1lLCB1cmwpO1xuXG4gICAgICAgIGNvbnN0IGkgPSB0aGlzLl9saXN0LnB1c2goaXRlbSk7XG4gICAgICAgIHRoaXMuX2luZGV4W2l0ZW0ubmFtZV0gPSBpIC0gMTtcbiAgICAgICAgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdID0gaSAtIDE7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZCBhIFNjZW5lIGJ5IG5hbWUgYW5kIHJldHVybiB0aGUge0BsaW5rIFNjZW5lUmVnaXN0cnlJdGVtfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtTY2VuZVJlZ2lzdHJ5SXRlbXxudWxsfSBUaGUgc3RvcmVkIGRhdGEgYWJvdXQgYSBzY2VuZSBvciBudWxsIGlmIG5vIHNjZW5lIHdpdGhcbiAgICAgKiB0aGF0IG5hbWUgZXhpc3RzLlxuICAgICAqL1xuICAgIGZpbmQobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5faW5kZXguaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0W3RoaXMuX2luZGV4W25hbWVdXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBzY2VuZSBieSB0aGUgVVJMIGFuZCByZXR1cm4gdGhlIHtAbGluayBTY2VuZVJlZ2lzdHJ5SXRlbX0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIFVSTCB0byBzZWFyY2ggYnkuXG4gICAgICogQHJldHVybnMge1NjZW5lUmVnaXN0cnlJdGVtfG51bGx9IFRoZSBzdG9yZWQgZGF0YSBhYm91dCBhIHNjZW5lIG9yIG51bGwgaWYgbm8gc2NlbmUgd2l0aFxuICAgICAqIHRoYXQgVVJMIGV4aXN0cy5cbiAgICAgKi9cbiAgICBmaW5kQnlVcmwodXJsKSB7XG4gICAgICAgIGlmICh0aGlzLl91cmxJbmRleC5oYXNPd25Qcm9wZXJ0eSh1cmwpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlzdFt0aGlzLl91cmxJbmRleFt1cmxdXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhbiBpdGVtIGZyb20gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2NlbmUuXG4gICAgICovXG4gICAgcmVtb3ZlKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luZGV4Lmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9pbmRleFtuYW1lXTtcbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fbGlzdFtpZHhdO1xuXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdO1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gaW5kZXhcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9pbmRleFtuYW1lXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGlzdFxuICAgICAgICAgICAgdGhpcy5fbGlzdC5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICAgICAgLy8gcmVmcmVzaCBpbmRleFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2xpc3RbaV07XG4gICAgICAgICAgICAgICAgdGhpcy5faW5kZXhbaXRlbS5uYW1lXSA9IGk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFByaXZhdGUgZnVuY3Rpb24gdG8gbG9hZCBzY2VuZSBkYXRhIHdpdGggdGhlIG9wdGlvbiB0byBjYWNoZVxuICAgIC8vIFRoaXMgYWxsb3dzIHVzIHRvIHJldGFpbiBleHBlY3RlZCBiZWhhdmlvciBvZiBsb2FkU2NlbmVTZXR0aW5ncyBhbmQgbG9hZFNjZW5lSGllcmFyY2h5IHdoZXJlIHRoZXlcbiAgICAvLyBkb24ndCBzdG9yZSBsb2FkZWQgZGF0YSB3aGljaCBtYXkgYmUgdW5kZXNpcmVkIGJlaGF2aW9yIHdpdGggcHJvamVjdHMgdGhhdCBoYXZlIG1hbnkgc2NlbmVzLlxuICAgIF9sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgc3RvcmVJbkNhY2hlLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLl9hcHA7XG4gICAgICAgIC8vIElmIGl0J3MgYSBzY2VuZUl0ZW0sIHdlIHdhbnQgdG8gYmUgYWJsZSB0byBjYWNoZSB0aGUgZGF0YVxuICAgICAgICAvLyB0aGF0IGlzIGxvYWRlZCBzbyB3ZSBkb24ndCBkbyBhIHN1YnNlcXVlbnQgaHR0cCByZXF1ZXN0c1xuICAgICAgICAvLyBvbiB0aGUgc2FtZSBzY2VuZSBsYXRlclxuXG4gICAgICAgIC8vIElmIGl0J3MganVzdCBhIFVSTCBvciBzY2VuZSBuYW1lIHRoZW4gYXR0ZW1wdCB0byBmaW5kXG4gICAgICAgIC8vIHRoZSBzY2VuZSBpdGVtIGluIHRoZSByZWdpc3RyeSBlbHNlIGNyZWF0ZSBhIHRlbXBcbiAgICAgICAgLy8gU2NlbmVSZWdpc3RyeUl0ZW0gdG8gdXNlIGZvciB0aGlzIGZ1bmN0aW9uIGFzIHRoZSBzY2VuZVxuICAgICAgICAvLyBtYXkgbm90IGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgcmVnaXN0cnlcbiAgICAgICAgbGV0IHVybCA9IHNjZW5lSXRlbTtcbiAgICAgICAgaWYgKHR5cGVvZiBzY2VuZUl0ZW0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY2VuZUl0ZW0gPSB0aGlzLmZpbmRCeVVybCh1cmwpIHx8IHRoaXMuZmluZCh1cmwpIHx8IG5ldyBTY2VuZVJlZ2lzdHJ5SXRlbSgnVW50aXRsZWQnLCB1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdXJsID0gc2NlbmVJdGVtLnVybDtcblxuICAgICAgICBpZiAoIXVybCkge1xuICAgICAgICAgICAgY2FsbGJhY2soXCJDYW5ub3QgZmluZCBzY2VuZSB0byBsb2FkXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgZGF0YSBhbHJlYWR5IGxvYWRlZCwgbm8gbmVlZCB0byBkbyBhbm90aGVyIEhUVFAgcmVxdWVzdFxuICAgICAgICBpZiAoc2NlbmVJdGVtLmxvYWRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2NlbmVJdGVtKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluY2x1ZGUgYXNzZXQgcHJlZml4IGlmIHByZXNlbnRcbiAgICAgICAgaWYgKGFwcC5hc3NldHMgJiYgYXBwLmFzc2V0cy5wcmVmaXggJiYgIUFCU09MVVRFX1VSTC50ZXN0KHVybCkpIHtcbiAgICAgICAgICAgIHVybCA9IHBhdGguam9pbihhcHAuYXNzZXRzLnByZWZpeCwgdXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lSXRlbS5fb25Mb2FkZWRDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cbiAgICAgICAgaWYgKCFzY2VuZUl0ZW0uX2xvYWRpbmcpIHtcbiAgICAgICAgICAgIC8vIEJlY2F1c2Ugd2UgbmVlZCB0byBsb2FkIHNjcmlwdHMgYmVmb3JlIHdlIGluc3RhbmNlIHRoZSBoaWVyYXJjaHkgKGkuZS4gYmVmb3JlIHdlIGNyZWF0ZSBzY3JpcHQgY29tcG9uZW50cylcbiAgICAgICAgICAgIC8vIFNwbGl0IGxvYWRpbmcgaW50byBsb2FkIGFuZCBvcGVuXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gYXBwLmxvYWRlci5nZXRIYW5kbGVyKFwiaGllcmFyY2h5XCIpO1xuXG4gICAgICAgICAgICBoYW5kbGVyLmxvYWQodXJsLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgc2NlbmVJdGVtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5fbG9hZGluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZUl0ZW0uX29uTG9hZGVkQ2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5fb25Mb2FkZWRDYWxsYmFja3NbaV0oZXJyLCBzY2VuZUl0ZW0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgZGF0YSBpZiBpdCdzIG5vdCBiZWVuIHJlcXVlc3RlZCB0byBzdG9yZSBpbiBjYWNoZVxuICAgICAgICAgICAgICAgIGlmICghc3RvcmVJbkNhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5kYXRhID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzY2VuZUl0ZW0uX29uTG9hZGVkQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lSXRlbS5fbG9hZGluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZHMgYW5kIHN0b3JlcyB0aGUgc2NlbmUgZGF0YSB0byByZWR1Y2UgdGhlIG51bWJlciBvZiB0aGUgbmV0d29yayByZXF1ZXN0cyB3aGVuIHRoZSBzYW1lXG4gICAgICogc2NlbmVzIGFyZSBsb2FkZWQgbXVsdGlwbGUgdGltZXMuIENhbiBhbHNvIGJlIHVzZWQgdG8gbG9hZCBkYXRhIGJlZm9yZSBjYWxsaW5nXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lSGllcmFyY2h5fSBhbmQge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lU2V0dGluZ3N9IHRvIG1ha2VcbiAgICAgKiBzY2VuZSBsb2FkaW5nIHF1aWNrZXIgZm9yIHRoZSB1c2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0xvYWRTY2VuZURhdGFDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBzY2VuZUl0ZW0pIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy5sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgZnVuY3Rpb24gKGVyciwgc2NlbmVJdGVtKSB7XG4gICAgICogICAgIGlmIChlcnIpIHtcbiAgICAgKiAgICAgICAgIC8vIGVycm9yXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fbG9hZFNjZW5lRGF0YShzY2VuZUl0ZW0sIHRydWUsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmxvYWRzIHNjZW5lIGRhdGEgdGhhdCBoYXMgYmVlbiBsb2FkZWQgcHJldmlvdXNseSB1c2luZyB7QGxpbmsgU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVEYXRhfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW0gfCBzdHJpbmd9IHNjZW5lSXRlbSAtIFRoZSBzY2VuZSBpdGVtICh3aGljaCBjYW4gYmUgZm91bmQgd2l0aFxuICAgICAqIHtAbGluayBTY2VuZVJlZ2lzdHJ5I2ZpbmR9IG9yIFVSTCBvZiB0aGUgc2NlbmUgZmlsZS4gVXN1YWxseSB0aGlzIHdpbGwgYmUgXCJzY2VuZV9pZC5qc29uXCIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzY2VuZUl0ZW0gPSBhcHAuc2NlbmVzLmZpbmQoXCJTY2VuZSBOYW1lXCIpO1xuICAgICAqIGFwcC5zY2VuZXMudW5sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSk7XG4gICAgICovXG4gICAgdW5sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSkge1xuICAgICAgICBpZiAodHlwZW9mIHNjZW5lSXRlbSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHNjZW5lSXRlbSA9IHRoaXMuZmluZEJ5VXJsKHNjZW5lSXRlbSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2NlbmVJdGVtKSB7XG4gICAgICAgICAgICBzY2VuZUl0ZW0uZGF0YSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfbG9hZFNjZW5lSGllcmFyY2h5KHNjZW5lSXRlbSwgb25CZWZvcmVBZGRIaWVyYXJjaHksIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2xvYWRTY2VuZURhdGEoc2NlbmVJdGVtLCBmYWxzZSwgKGVyciwgc2NlbmVJdGVtKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9uQmVmb3JlQWRkSGllcmFyY2h5KSB7XG4gICAgICAgICAgICAgICAgb25CZWZvcmVBZGRIaWVyYXJjaHkoc2NlbmVJdGVtKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXBwID0gdGhpcy5fYXBwO1xuXG4gICAgICAgICAgICAvLyBjYWxsZWQgYWZ0ZXIgc2NyaXB0cyBhcmUgcHJlbG9hZGVkXG4gICAgICAgICAgICBjb25zdCBfbG9hZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEJlY2F1c2Ugd2UgbmVlZCB0byBsb2FkIHNjcmlwdHMgYmVmb3JlIHdlIGluc3RhbmNlIHRoZSBoaWVyYXJjaHkgKGkuZS4gYmVmb3JlIHdlIGNyZWF0ZSBzY3JpcHQgY29tcG9uZW50cylcbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBsb2FkaW5nIGludG8gbG9hZCBhbmQgb3BlblxuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBhcHAubG9hZGVyLmdldEhhbmRsZXIoXCJoaWVyYXJjaHlcIik7XG5cbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gaGFuZGxlci5vcGVuKHNjZW5lSXRlbS51cmwsIHNjZW5lSXRlbS5kYXRhKTtcblxuICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAvLyBjbGVhciBmcm9tIGNhY2hlIGJlY2F1c2UgdGhpcyBkYXRhIGlzIG1vZGlmaWVkIGJ5IGVudGl0eSBvcGVyYXRpb25zIChlLmcuIGRlc3Ryb3kpXG4gICAgICAgICAgICAgICAgYXBwLmxvYWRlci5jbGVhckNhY2hlKHNjZW5lSXRlbS51cmwsIFwiaGllcmFyY2h5XCIpO1xuXG4gICAgICAgICAgICAgICAgLy8gYWRkIHRvIGhpZXJhcmNoeVxuICAgICAgICAgICAgICAgIGFwcC5yb290LmFkZENoaWxkKGVudGl0eSk7XG5cbiAgICAgICAgICAgICAgICAvLyBpbml0aWFsaXplIGNvbXBvbmVudHNcbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5maXJlKCdpbml0aWFsaXplJywgZW50aXR5KTtcbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5maXJlKCdwb3N0SW5pdGlhbGl6ZScsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgYXBwLnN5c3RlbXMuZmlyZSgncG9zdFBvc3RJbml0aWFsaXplJywgZW50aXR5KTtcblxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgZW50aXR5KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGxvYWQgcHJpb3JpdHkgYW5kIHJlZmVyZW5jZWQgc2NyaXB0cyBiZWZvcmUgb3BlbmluZyBzY2VuZVxuICAgICAgICAgICAgYXBwLl9wcmVsb2FkU2NyaXB0cyhzY2VuZUl0ZW0uZGF0YSwgX2xvYWRlZCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYSBzY2VuZSBmaWxlLCBjcmVhdGUgYW5kIGluaXRpYWxpemUgdGhlIEVudGl0eSBoaWVyYXJjaHkgYW5kIGFkZCB0aGUgaGllcmFyY2h5IHRvIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uIHJvb3QgRW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0xvYWRIaWVyYXJjaHlDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBlbnRpdHkpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy5sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBmdW5jdGlvbiAoZXJyLCBlbnRpdHkpIHtcbiAgICAgKiAgICAgaWYgKCFlcnIpIHtcbiAgICAgKiAgICAgICAgIGNvbnN0IGUgPSBhcHAucm9vdC5maW5kKFwiTXkgTmV3IEVudGl0eVwiKTtcbiAgICAgKiAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgIC8vIGVycm9yXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBjYWxsYmFjaykge1xuICAgICAgICB0aGlzLl9sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBudWxsLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhIHNjZW5lIGZpbGUgYW5kIGFwcGx5IHRoZSBzY2VuZSBzZXR0aW5ncyB0byB0aGUgY3VycmVudCBzY2VuZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW0gfCBzdHJpbmd9IHNjZW5lSXRlbSAtIFRoZSBzY2VuZSBpdGVtICh3aGljaCBjYW4gYmUgZm91bmQgd2l0aFxuICAgICAqIHtAbGluayBTY2VuZVJlZ2lzdHJ5I2ZpbmR9LCBVUkwgb2YgdGhlIHNjZW5lIGZpbGUgKGUuZy5cInNjZW5lX2lkLmpzb25cIikgb3IgbmFtZSBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtMb2FkU2V0dGluZ3NDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIGFmdGVyIHRoZSBzZXR0aW5nc1xuICAgICAqIGFyZSBhcHBsaWVkLiBQYXNzZWQgKGVycikgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3Igb2NjdXJyZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzY2VuZUl0ZW0gPSBhcHAuc2NlbmVzLmZpbmQoXCJTY2VuZSBOYW1lXCIpO1xuICAgICAqIGFwcC5zY2VuZXMubG9hZFNjZW5lU2V0dGluZ3Moc2NlbmVJdGVtLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICogICAgIGlmICghZXJyKSB7XG4gICAgICogICAgICAgICAvLyBzdWNjZXNzXG4gICAgICogICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICAvLyBlcnJvclxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZFNjZW5lU2V0dGluZ3Moc2NlbmVJdGVtLCBjYWxsYmFjaykge1xuICAgICAgICB0aGlzLl9sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgZmFsc2UsIChlcnIsIHNjZW5lSXRlbSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNjZW5lSXRlbS5kYXRhLnNldHRpbmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoYW5nZSB0byBhIG5ldyBzY2VuZS4gQ2FsbGluZyB0aGlzIGZ1bmN0aW9uIHdpbGwgbG9hZCB0aGUgc2NlbmUgZGF0YSwgZGVsZXRlIGFsbFxuICAgICAqIGVudGl0aWVzIGFuZCBncmFwaCBub2RlcyB1bmRlciBgYXBwLnJvb3RgIGFuZCBsb2FkIHRoZSBzY2VuZSBzZXR0aW5ncyBhbmQgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0NoYW5nZVNjZW5lQ2FsbGJhY2t9IFtjYWxsYmFja10gLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBlbnRpdHkpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zY2VuZXMuY2hhbmdlU2NlbmUoXCJTY2VuZSBOYW1lXCIsIGZ1bmN0aW9uIChlcnIsIGVudGl0eSkge1xuICAgICAqICAgICBpZiAoIWVycikge1xuICAgICAqICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAqICAgICB9IGVsc2Uge1xuICAgICAqICAgICAgICAgLy8gZXJyb3JcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNoYW5nZVNjZW5lKHNjZW5lSXRlbSwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5fYXBwO1xuXG4gICAgICAgIGNvbnN0IG9uQmVmb3JlQWRkSGllcmFyY2h5ID0gKHNjZW5lSXRlbSkgPT4ge1xuICAgICAgICAgICAgLy8gRGVzdHJveS9SZW1vdmUgYWxsIG5vZGVzIG9uIHRoZSBhcHAucm9vdFxuICAgICAgICAgICAgY29uc3Qgcm9vdENoaWxkcmVuID0gYXBwLnJvb3QuY2hpbGRyZW47XG4gICAgICAgICAgICB3aGlsZSAocm9vdENoaWxkcmVuLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHJvb3RDaGlsZHJlblswXTtcbiAgICAgICAgICAgICAgICBjaGlsZC5yZXBhcmVudChudWxsKTtcbiAgICAgICAgICAgICAgICBjaGlsZC5kZXN0cm95Py4oKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXBwLmFwcGx5U2NlbmVTZXR0aW5ncyhzY2VuZUl0ZW0uZGF0YS5zZXR0aW5ncyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fbG9hZFNjZW5lSGllcmFyY2h5KHNjZW5lSXRlbSwgb25CZWZvcmVBZGRIaWVyYXJjaHksIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIHRoZSBzY2VuZSBoaWVyYXJjaHkgYW5kIHNjZW5lIHNldHRpbmdzLiBUaGlzIGlzIGFuIGludGVybmFsIG1ldGhvZCB1c2VkIGJ5IHRoZVxuICAgICAqIHtAbGluayBBcHBCYXNlfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSBzY2VuZSBmaWxlLlxuICAgICAqIEBwYXJhbSB7TG9hZFNjZW5lQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBhZnRlciB0aGUgc2V0dGluZ3MgYXJlXG4gICAgICogYXBwbGllZC4gUGFzc2VkIChlcnIsIHNjZW5lKSB3aGVyZSBlcnIgaXMgbnVsbCBpZiBubyBlcnJvciBvY2N1cnJlZCBhbmQgc2NlbmUgaXMgdGhlXG4gICAgICoge0BsaW5rIFNjZW5lfS5cbiAgICAgKi9cbiAgICBsb2FkU2NlbmUodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLl9hcHA7XG5cbiAgICAgICAgY29uc3QgaGFuZGxlciA9IGFwcC5sb2FkZXIuZ2V0SGFuZGxlcihcInNjZW5lXCIpO1xuXG4gICAgICAgIC8vIGluY2x1ZGUgYXNzZXQgcHJlZml4IGlmIHByZXNlbnRcbiAgICAgICAgaWYgKGFwcC5hc3NldHMgJiYgYXBwLmFzc2V0cy5wcmVmaXggJiYgIUFCU09MVVRFX1VSTC50ZXN0KHVybCkpIHtcbiAgICAgICAgICAgIHVybCA9IHBhdGguam9pbihhcHAuYXNzZXRzLnByZWZpeCwgdXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGhhbmRsZXIubG9hZCh1cmwsIChlcnIsIGRhdGEpID0+IHtcbiAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgX2xvYWRlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgYW5kIGNyZWF0ZSBzY2VuZVxuICAgICAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gaGFuZGxlci5vcGVuKHVybCwgZGF0YSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FjaGUgdGhlIGRhdGEgYXMgd2UgYXJlIGxvYWRpbmcgdmlhIFVSTCBvbmx5XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lSXRlbSA9IHRoaXMuZmluZEJ5VXJsKHVybCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzY2VuZUl0ZW0gJiYgIXNjZW5lSXRlbS5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2NlbmUgZnJvbSBjYWNoZSBiZWNhdXNlIHdlJ2xsIGRlc3Ryb3kgaXQgd2hlbiB3ZSBsb2FkIGFub3RoZXIgb25lXG4gICAgICAgICAgICAgICAgICAgIC8vIHNvIGRhdGEgd2lsbCBiZSBpbnZhbGlkXG4gICAgICAgICAgICAgICAgICAgIGFwcC5sb2FkZXIuY2xlYXJDYWNoZSh1cmwsIFwic2NlbmVcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgYXBwLmxvYWRlci5wYXRjaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvdXJjZTogc2NlbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInNjZW5lXCJcbiAgICAgICAgICAgICAgICAgICAgfSwgYXBwLmFzc2V0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgYXBwLnJvb3QuYWRkQ2hpbGQoc2NlbmUucm9vdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBwYWNrIHNldHRpbmdzXG4gICAgICAgICAgICAgICAgICAgIGlmIChhcHAuc3lzdGVtcy5yaWdpZGJvZHkgJiYgdHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5yaWdpZGJvZHkuZ3Jhdml0eS5zZXQoc2NlbmUuX2dyYXZpdHkueCwgc2NlbmUuX2dyYXZpdHkueSwgc2NlbmUuX2dyYXZpdHkueik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBwcmVsb2FkIHNjcmlwdHMgYmVmb3JlIG9wZW5pbmcgc2NlbmVcbiAgICAgICAgICAgICAgICBhcHAuX3ByZWxvYWRTY3JpcHRzKGRhdGEsIF9sb2FkZWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NlbmVSZWdpc3RyeSB9O1xuIl0sIm5hbWVzIjpbIlNjZW5lUmVnaXN0cnkiLCJjb25zdHJ1Y3RvciIsImFwcCIsIl9hcHAiLCJfbGlzdCIsIl9pbmRleCIsIl91cmxJbmRleCIsImRlc3Ryb3kiLCJsaXN0IiwiYWRkIiwibmFtZSIsInVybCIsImhhc093blByb3BlcnR5IiwiRGVidWciLCJ3YXJuIiwiaXRlbSIsIlNjZW5lUmVnaXN0cnlJdGVtIiwiaSIsInB1c2giLCJmaW5kIiwiZmluZEJ5VXJsIiwicmVtb3ZlIiwiaWR4Iiwic3BsaWNlIiwibGVuZ3RoIiwiX2xvYWRTY2VuZURhdGEiLCJzY2VuZUl0ZW0iLCJzdG9yZUluQ2FjaGUiLCJjYWxsYmFjayIsImxvYWRlZCIsImFzc2V0cyIsInByZWZpeCIsIkFCU09MVVRFX1VSTCIsInRlc3QiLCJwYXRoIiwiam9pbiIsIl9vbkxvYWRlZENhbGxiYWNrcyIsIl9sb2FkaW5nIiwiaGFuZGxlciIsImxvYWRlciIsImdldEhhbmRsZXIiLCJsb2FkIiwiZXJyIiwiZGF0YSIsImxvYWRTY2VuZURhdGEiLCJ1bmxvYWRTY2VuZURhdGEiLCJfbG9hZFNjZW5lSGllcmFyY2h5Iiwib25CZWZvcmVBZGRIaWVyYXJjaHkiLCJfbG9hZGVkIiwic3lzdGVtcyIsInNjcmlwdCIsInByZWxvYWRpbmciLCJlbnRpdHkiLCJvcGVuIiwiY2xlYXJDYWNoZSIsInJvb3QiLCJhZGRDaGlsZCIsImZpcmUiLCJfcHJlbG9hZFNjcmlwdHMiLCJsb2FkU2NlbmVIaWVyYXJjaHkiLCJsb2FkU2NlbmVTZXR0aW5ncyIsImFwcGx5U2NlbmVTZXR0aW5ncyIsInNldHRpbmdzIiwiY2hhbmdlU2NlbmUiLCJyb290Q2hpbGRyZW4iLCJjaGlsZHJlbiIsImNoaWxkIiwicmVwYXJlbnQiLCJsb2FkU2NlbmUiLCJzY2VuZSIsInBhdGNoIiwicmVzb3VyY2UiLCJ0eXBlIiwicmlnaWRib2R5IiwiQW1tbyIsImdyYXZpdHkiLCJzZXQiLCJfZ3Jhdml0eSIsIngiLCJ5IiwieiJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxhQUFhLENBQUM7QUFDaEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxHQUFHLEVBQUU7SUFDYixJQUFJLENBQUNDLElBQUksR0FBR0QsR0FBRyxDQUFBO0lBQ2YsSUFBSSxDQUFDRSxLQUFLLEdBQUcsRUFBRSxDQUFBO0FBQ2YsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFDaEIsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7QUFDdkIsR0FBQTtBQUVBQyxFQUFBQSxPQUFPQSxHQUFHO0lBQ04sSUFBSSxDQUFDSixJQUFJLEdBQUcsSUFBSSxDQUFBO0FBQ3BCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFD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
