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
      // Destroy all nodes on the app.root
      const {
        children
      } = app.root;
      while (children.length) {
        children[0].destroy();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtcmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NlbmUtcmVnaXN0cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBQlNPTFVURV9VUkwgfSBmcm9tICcuL2Fzc2V0L2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFNjZW5lUmVnaXN0cnlJdGVtIH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS1pdGVtLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBTY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZUhpZXJhcmNoeX0uXG4gKlxuICogQGNhbGxiYWNrIExvYWRIaWVyYXJjaHlDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuL2VudGl0eS5qcycpLkVudGl0eX0gW2VudGl0eV0gLSBUaGUgbG9hZGVkIHJvb3QgZW50aXR5IGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVTZXR0aW5nc30uXG4gKlxuICogQGNhbGxiYWNrIExvYWRTZXR0aW5nc0NhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgU2NlbmVSZWdpc3RyeSNjaGFuZ2VTY2VuZX0uXG4gKlxuICogQGNhbGxiYWNrIENoYW5nZVNjZW5lQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFtlbnRpdHldIC0gVGhlIGxvYWRlZCByb290IGVudGl0eSBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lfS5cbiAqXG4gKiBAY2FsbGJhY2sgTG9hZFNjZW5lQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFtlbnRpdHldIC0gVGhlIGxvYWRlZCByb290IGVudGl0eSBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lRGF0YX0uXG4gKlxuICogQGNhbGxiYWNrIExvYWRTY2VuZURhdGFDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW19IFtzY2VuZUl0ZW1dIC0gVGhlIHNjZW5lIHJlZ2lzdHJ5IGl0ZW0gaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gKi9cblxuLyoqXG4gKiBDb250YWluZXIgZm9yIHN0b3JpbmcgYW5kIGxvYWRpbmcgb2Ygc2NlbmVzLiBBbiBpbnN0YW5jZSBvZiB0aGUgcmVnaXN0cnkgaXMgY3JlYXRlZCBvbiB0aGVcbiAqIHtAbGluayBBcHBCYXNlfSBvYmplY3QgYXMge0BsaW5rIEFwcEJhc2Ujc2NlbmVzfS5cbiAqL1xuY2xhc3MgU2NlbmVSZWdpc3RyeSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjZW5lUmVnaXN0cnkgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xuICAgICAgICB0aGlzLl9saXN0ID0gW107XG4gICAgICAgIHRoaXMuX2luZGV4ID0ge307XG4gICAgICAgIHRoaXMuX3VybEluZGV4ID0ge307XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fYXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGxpc3Qgb2Ygc2NlbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2NlbmVSZWdpc3RyeUl0ZW1bXX0gQWxsIGl0ZW1zIGluIHRoZSByZWdpc3RyeS5cbiAgICAgKi9cbiAgICBsaXN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlzdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBuZXcgaXRlbSB0byB0aGUgc2NlbmUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gIFRoZSB1cmwgb2YgdGhlIHNjZW5lIGZpbGUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc2NlbmUgd2FzIHN1Y2Nlc3NmdWxseSBhZGRlZCB0byB0aGUgcmVnaXN0cnksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBhZGQobmFtZSwgdXJsKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbmRleC5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgRGVidWcud2FybigncGMuU2NlbmVSZWdpc3RyeTogdHJ5aW5nIHRvIGFkZCBtb3JlIHRoYW4gb25lIHNjZW5lIGNhbGxlZDogJyArIG5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXRlbSA9IG5ldyBTY2VuZVJlZ2lzdHJ5SXRlbShuYW1lLCB1cmwpO1xuXG4gICAgICAgIGNvbnN0IGkgPSB0aGlzLl9saXN0LnB1c2goaXRlbSk7XG4gICAgICAgIHRoaXMuX2luZGV4W2l0ZW0ubmFtZV0gPSBpIC0gMTtcbiAgICAgICAgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdID0gaSAtIDE7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZCBhIFNjZW5lIGJ5IG5hbWUgYW5kIHJldHVybiB0aGUge0BsaW5rIFNjZW5lUmVnaXN0cnlJdGVtfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtTY2VuZVJlZ2lzdHJ5SXRlbXxudWxsfSBUaGUgc3RvcmVkIGRhdGEgYWJvdXQgYSBzY2VuZSBvciBudWxsIGlmIG5vIHNjZW5lIHdpdGhcbiAgICAgKiB0aGF0IG5hbWUgZXhpc3RzLlxuICAgICAqL1xuICAgIGZpbmQobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5faW5kZXguaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0W3RoaXMuX2luZGV4W25hbWVdXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBzY2VuZSBieSB0aGUgVVJMIGFuZCByZXR1cm4gdGhlIHtAbGluayBTY2VuZVJlZ2lzdHJ5SXRlbX0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIFVSTCB0byBzZWFyY2ggYnkuXG4gICAgICogQHJldHVybnMge1NjZW5lUmVnaXN0cnlJdGVtfG51bGx9IFRoZSBzdG9yZWQgZGF0YSBhYm91dCBhIHNjZW5lIG9yIG51bGwgaWYgbm8gc2NlbmUgd2l0aFxuICAgICAqIHRoYXQgVVJMIGV4aXN0cy5cbiAgICAgKi9cbiAgICBmaW5kQnlVcmwodXJsKSB7XG4gICAgICAgIGlmICh0aGlzLl91cmxJbmRleC5oYXNPd25Qcm9wZXJ0eSh1cmwpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlzdFt0aGlzLl91cmxJbmRleFt1cmxdXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhbiBpdGVtIGZyb20gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2NlbmUuXG4gICAgICovXG4gICAgcmVtb3ZlKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luZGV4Lmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9pbmRleFtuYW1lXTtcbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fbGlzdFtpZHhdO1xuXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdO1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gaW5kZXhcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9pbmRleFtuYW1lXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGlzdFxuICAgICAgICAgICAgdGhpcy5fbGlzdC5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICAgICAgLy8gcmVmcmVzaCBpbmRleFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuX2xpc3RbaV07XG4gICAgICAgICAgICAgICAgdGhpcy5faW5kZXhbaXRlbS5uYW1lXSA9IGk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXJsSW5kZXhbaXRlbS51cmxdID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFByaXZhdGUgZnVuY3Rpb24gdG8gbG9hZCBzY2VuZSBkYXRhIHdpdGggdGhlIG9wdGlvbiB0byBjYWNoZVxuICAgIC8vIFRoaXMgYWxsb3dzIHVzIHRvIHJldGFpbiBleHBlY3RlZCBiZWhhdmlvciBvZiBsb2FkU2NlbmVTZXR0aW5ncyBhbmQgbG9hZFNjZW5lSGllcmFyY2h5IHdoZXJlIHRoZXlcbiAgICAvLyBkb24ndCBzdG9yZSBsb2FkZWQgZGF0YSB3aGljaCBtYXkgYmUgdW5kZXNpcmVkIGJlaGF2aW9yIHdpdGggcHJvamVjdHMgdGhhdCBoYXZlIG1hbnkgc2NlbmVzLlxuICAgIF9sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgc3RvcmVJbkNhY2hlLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLl9hcHA7XG4gICAgICAgIC8vIElmIGl0J3MgYSBzY2VuZUl0ZW0sIHdlIHdhbnQgdG8gYmUgYWJsZSB0byBjYWNoZSB0aGUgZGF0YVxuICAgICAgICAvLyB0aGF0IGlzIGxvYWRlZCBzbyB3ZSBkb24ndCBkbyBhIHN1YnNlcXVlbnQgaHR0cCByZXF1ZXN0c1xuICAgICAgICAvLyBvbiB0aGUgc2FtZSBzY2VuZSBsYXRlclxuXG4gICAgICAgIC8vIElmIGl0J3MganVzdCBhIFVSTCBvciBzY2VuZSBuYW1lIHRoZW4gYXR0ZW1wdCB0byBmaW5kXG4gICAgICAgIC8vIHRoZSBzY2VuZSBpdGVtIGluIHRoZSByZWdpc3RyeSBlbHNlIGNyZWF0ZSBhIHRlbXBcbiAgICAgICAgLy8gU2NlbmVSZWdpc3RyeUl0ZW0gdG8gdXNlIGZvciB0aGlzIGZ1bmN0aW9uIGFzIHRoZSBzY2VuZVxuICAgICAgICAvLyBtYXkgbm90IGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgcmVnaXN0cnlcbiAgICAgICAgbGV0IHVybCA9IHNjZW5lSXRlbTtcbiAgICAgICAgaWYgKHR5cGVvZiBzY2VuZUl0ZW0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBzY2VuZUl0ZW0gPSB0aGlzLmZpbmRCeVVybCh1cmwpIHx8IHRoaXMuZmluZCh1cmwpIHx8IG5ldyBTY2VuZVJlZ2lzdHJ5SXRlbSgnVW50aXRsZWQnLCB1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdXJsID0gc2NlbmVJdGVtLnVybDtcblxuICAgICAgICBpZiAoIXVybCkge1xuICAgICAgICAgICAgY2FsbGJhY2soXCJDYW5ub3QgZmluZCBzY2VuZSB0byBsb2FkXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UgaGF2ZSB0aGUgZGF0YSBhbHJlYWR5IGxvYWRlZCwgbm8gbmVlZCB0byBkbyBhbm90aGVyIEhUVFAgcmVxdWVzdFxuICAgICAgICBpZiAoc2NlbmVJdGVtLmxvYWRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2NlbmVJdGVtKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluY2x1ZGUgYXNzZXQgcHJlZml4IGlmIHByZXNlbnRcbiAgICAgICAgaWYgKGFwcC5hc3NldHMgJiYgYXBwLmFzc2V0cy5wcmVmaXggJiYgIUFCU09MVVRFX1VSTC50ZXN0KHVybCkpIHtcbiAgICAgICAgICAgIHVybCA9IHBhdGguam9pbihhcHAuYXNzZXRzLnByZWZpeCwgdXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lSXRlbS5fb25Mb2FkZWRDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cbiAgICAgICAgaWYgKCFzY2VuZUl0ZW0uX2xvYWRpbmcpIHtcbiAgICAgICAgICAgIC8vIEJlY2F1c2Ugd2UgbmVlZCB0byBsb2FkIHNjcmlwdHMgYmVmb3JlIHdlIGluc3RhbmNlIHRoZSBoaWVyYXJjaHkgKGkuZS4gYmVmb3JlIHdlIGNyZWF0ZSBzY3JpcHQgY29tcG9uZW50cylcbiAgICAgICAgICAgIC8vIFNwbGl0IGxvYWRpbmcgaW50byBsb2FkIGFuZCBvcGVuXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gYXBwLmxvYWRlci5nZXRIYW5kbGVyKFwiaGllcmFyY2h5XCIpO1xuXG4gICAgICAgICAgICBoYW5kbGVyLmxvYWQodXJsLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgc2NlbmVJdGVtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5fbG9hZGluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZUl0ZW0uX29uTG9hZGVkQ2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5fb25Mb2FkZWRDYWxsYmFja3NbaV0oZXJyLCBzY2VuZUl0ZW0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgZGF0YSBpZiBpdCdzIG5vdCBiZWVuIHJlcXVlc3RlZCB0byBzdG9yZSBpbiBjYWNoZVxuICAgICAgICAgICAgICAgIGlmICghc3RvcmVJbkNhY2hlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lSXRlbS5kYXRhID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzY2VuZUl0ZW0uX29uTG9hZGVkQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lSXRlbS5fbG9hZGluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZHMgYW5kIHN0b3JlcyB0aGUgc2NlbmUgZGF0YSB0byByZWR1Y2UgdGhlIG51bWJlciBvZiB0aGUgbmV0d29yayByZXF1ZXN0cyB3aGVuIHRoZSBzYW1lXG4gICAgICogc2NlbmVzIGFyZSBsb2FkZWQgbXVsdGlwbGUgdGltZXMuIENhbiBhbHNvIGJlIHVzZWQgdG8gbG9hZCBkYXRhIGJlZm9yZSBjYWxsaW5nXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lSGllcmFyY2h5fSBhbmQge0BsaW5rIFNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lU2V0dGluZ3N9IHRvIG1ha2VcbiAgICAgKiBzY2VuZSBsb2FkaW5nIHF1aWNrZXIgZm9yIHRoZSB1c2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0xvYWRTY2VuZURhdGFDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBzY2VuZUl0ZW0pIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy5sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgZnVuY3Rpb24gKGVyciwgc2NlbmVJdGVtKSB7XG4gICAgICogICAgIGlmIChlcnIpIHtcbiAgICAgKiAgICAgICAgIC8vIGVycm9yXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fbG9hZFNjZW5lRGF0YShzY2VuZUl0ZW0sIHRydWUsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmxvYWRzIHNjZW5lIGRhdGEgdGhhdCBoYXMgYmVlbiBsb2FkZWQgcHJldmlvdXNseSB1c2luZyB7QGxpbmsgU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVEYXRhfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW0gfCBzdHJpbmd9IHNjZW5lSXRlbSAtIFRoZSBzY2VuZSBpdGVtICh3aGljaCBjYW4gYmUgZm91bmQgd2l0aFxuICAgICAqIHtAbGluayBTY2VuZVJlZ2lzdHJ5I2ZpbmR9IG9yIFVSTCBvZiB0aGUgc2NlbmUgZmlsZS4gVXN1YWxseSB0aGlzIHdpbGwgYmUgXCJzY2VuZV9pZC5qc29uXCIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzY2VuZUl0ZW0gPSBhcHAuc2NlbmVzLmZpbmQoXCJTY2VuZSBOYW1lXCIpO1xuICAgICAqIGFwcC5zY2VuZXMudW5sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSk7XG4gICAgICovXG4gICAgdW5sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSkge1xuICAgICAgICBpZiAodHlwZW9mIHNjZW5lSXRlbSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHNjZW5lSXRlbSA9IHRoaXMuZmluZEJ5VXJsKHNjZW5lSXRlbSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2NlbmVJdGVtKSB7XG4gICAgICAgICAgICBzY2VuZUl0ZW0uZGF0YSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfbG9hZFNjZW5lSGllcmFyY2h5KHNjZW5lSXRlbSwgb25CZWZvcmVBZGRIaWVyYXJjaHksIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2xvYWRTY2VuZURhdGEoc2NlbmVJdGVtLCBmYWxzZSwgKGVyciwgc2NlbmVJdGVtKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9uQmVmb3JlQWRkSGllcmFyY2h5KSB7XG4gICAgICAgICAgICAgICAgb25CZWZvcmVBZGRIaWVyYXJjaHkoc2NlbmVJdGVtKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXBwID0gdGhpcy5fYXBwO1xuXG4gICAgICAgICAgICAvLyBjYWxsZWQgYWZ0ZXIgc2NyaXB0cyBhcmUgcHJlbG9hZGVkXG4gICAgICAgICAgICBjb25zdCBfbG9hZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEJlY2F1c2Ugd2UgbmVlZCB0byBsb2FkIHNjcmlwdHMgYmVmb3JlIHdlIGluc3RhbmNlIHRoZSBoaWVyYXJjaHkgKGkuZS4gYmVmb3JlIHdlIGNyZWF0ZSBzY3JpcHQgY29tcG9uZW50cylcbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBsb2FkaW5nIGludG8gbG9hZCBhbmQgb3BlblxuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBhcHAubG9hZGVyLmdldEhhbmRsZXIoXCJoaWVyYXJjaHlcIik7XG5cbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gaGFuZGxlci5vcGVuKHNjZW5lSXRlbS51cmwsIHNjZW5lSXRlbS5kYXRhKTtcblxuICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAvLyBjbGVhciBmcm9tIGNhY2hlIGJlY2F1c2UgdGhpcyBkYXRhIGlzIG1vZGlmaWVkIGJ5IGVudGl0eSBvcGVyYXRpb25zIChlLmcuIGRlc3Ryb3kpXG4gICAgICAgICAgICAgICAgYXBwLmxvYWRlci5jbGVhckNhY2hlKHNjZW5lSXRlbS51cmwsIFwiaGllcmFyY2h5XCIpO1xuXG4gICAgICAgICAgICAgICAgLy8gYWRkIHRvIGhpZXJhcmNoeVxuICAgICAgICAgICAgICAgIGFwcC5yb290LmFkZENoaWxkKGVudGl0eSk7XG5cbiAgICAgICAgICAgICAgICAvLyBpbml0aWFsaXplIGNvbXBvbmVudHNcbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5maXJlKCdpbml0aWFsaXplJywgZW50aXR5KTtcbiAgICAgICAgICAgICAgICBhcHAuc3lzdGVtcy5maXJlKCdwb3N0SW5pdGlhbGl6ZScsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgYXBwLnN5c3RlbXMuZmlyZSgncG9zdFBvc3RJbml0aWFsaXplJywgZW50aXR5KTtcblxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgZW50aXR5KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGxvYWQgcHJpb3JpdHkgYW5kIHJlZmVyZW5jZWQgc2NyaXB0cyBiZWZvcmUgb3BlbmluZyBzY2VuZVxuICAgICAgICAgICAgYXBwLl9wcmVsb2FkU2NyaXB0cyhzY2VuZUl0ZW0uZGF0YSwgX2xvYWRlZCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYSBzY2VuZSBmaWxlLCBjcmVhdGUgYW5kIGluaXRpYWxpemUgdGhlIEVudGl0eSBoaWVyYXJjaHkgYW5kIGFkZCB0aGUgaGllcmFyY2h5IHRvIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uIHJvb3QgRW50aXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0xvYWRIaWVyYXJjaHlDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBlbnRpdHkpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNjZW5lSXRlbSA9IGFwcC5zY2VuZXMuZmluZChcIlNjZW5lIE5hbWVcIik7XG4gICAgICogYXBwLnNjZW5lcy5sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBmdW5jdGlvbiAoZXJyLCBlbnRpdHkpIHtcbiAgICAgKiAgICAgaWYgKCFlcnIpIHtcbiAgICAgKiAgICAgICAgIGNvbnN0IGUgPSBhcHAucm9vdC5maW5kKFwiTXkgTmV3IEVudGl0eVwiKTtcbiAgICAgKiAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgIC8vIGVycm9yXG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBjYWxsYmFjaykge1xuICAgICAgICB0aGlzLl9sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBudWxsLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhIHNjZW5lIGZpbGUgYW5kIGFwcGx5IHRoZSBzY2VuZSBzZXR0aW5ncyB0byB0aGUgY3VycmVudCBzY2VuZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2NlbmVSZWdpc3RyeUl0ZW0gfCBzdHJpbmd9IHNjZW5lSXRlbSAtIFRoZSBzY2VuZSBpdGVtICh3aGljaCBjYW4gYmUgZm91bmQgd2l0aFxuICAgICAqIHtAbGluayBTY2VuZVJlZ2lzdHJ5I2ZpbmR9LCBVUkwgb2YgdGhlIHNjZW5lIGZpbGUgKGUuZy5cInNjZW5lX2lkLmpzb25cIikgb3IgbmFtZSBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtMb2FkU2V0dGluZ3NDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIGFmdGVyIHRoZSBzZXR0aW5nc1xuICAgICAqIGFyZSBhcHBsaWVkLiBQYXNzZWQgKGVycikgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3Igb2NjdXJyZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzY2VuZUl0ZW0gPSBhcHAuc2NlbmVzLmZpbmQoXCJTY2VuZSBOYW1lXCIpO1xuICAgICAqIGFwcC5zY2VuZXMubG9hZFNjZW5lU2V0dGluZ3Moc2NlbmVJdGVtLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICogICAgIGlmICghZXJyKSB7XG4gICAgICogICAgICAgICAvLyBzdWNjZXNzXG4gICAgICogICAgIH0gZWxzZSB7XG4gICAgICogICAgICAgICAvLyBlcnJvclxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZFNjZW5lU2V0dGluZ3Moc2NlbmVJdGVtLCBjYWxsYmFjaykge1xuICAgICAgICB0aGlzLl9sb2FkU2NlbmVEYXRhKHNjZW5lSXRlbSwgZmFsc2UsIChlcnIsIHNjZW5lSXRlbSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNjZW5lSXRlbS5kYXRhLnNldHRpbmdzKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoYW5nZSB0byBhIG5ldyBzY2VuZS4gQ2FsbGluZyB0aGlzIGZ1bmN0aW9uIHdpbGwgbG9hZCB0aGUgc2NlbmUgZGF0YSwgZGVsZXRlIGFsbFxuICAgICAqIGVudGl0aWVzIGFuZCBncmFwaCBub2RlcyB1bmRlciBgYXBwLnJvb3RgIGFuZCBsb2FkIHRoZSBzY2VuZSBzZXR0aW5ncyBhbmQgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTY2VuZVJlZ2lzdHJ5SXRlbSB8IHN0cmluZ30gc2NlbmVJdGVtIC0gVGhlIHNjZW5lIGl0ZW0gKHdoaWNoIGNhbiBiZSBmb3VuZCB3aXRoXG4gICAgICoge0BsaW5rIFNjZW5lUmVnaXN0cnkjZmluZH0sIFVSTCBvZiB0aGUgc2NlbmUgZmlsZSAoZS5nLlwic2NlbmVfaWQuanNvblwiKSBvciBuYW1lIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge0NoYW5nZVNjZW5lQ2FsbGJhY2t9IFtjYWxsYmFja10gLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCBhZnRlciBsb2FkaW5nLFxuICAgICAqIHBhc3NlZCAoZXJyLCBlbnRpdHkpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyBvY2N1cnJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zY2VuZXMuY2hhbmdlU2NlbmUoXCJTY2VuZSBOYW1lXCIsIGZ1bmN0aW9uIChlcnIsIGVudGl0eSkge1xuICAgICAqICAgICBpZiAoIWVycikge1xuICAgICAqICAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAqICAgICB9IGVsc2Uge1xuICAgICAqICAgICAgICAgLy8gZXJyb3JcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNoYW5nZVNjZW5lKHNjZW5lSXRlbSwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5fYXBwO1xuXG4gICAgICAgIGNvbnN0IG9uQmVmb3JlQWRkSGllcmFyY2h5ID0gKHNjZW5lSXRlbSkgPT4ge1xuICAgICAgICAgICAgLy8gRGVzdHJveSBhbGwgbm9kZXMgb24gdGhlIGFwcC5yb290XG4gICAgICAgICAgICBjb25zdCB7IGNoaWxkcmVuIH0gPSBhcHAucm9vdDtcbiAgICAgICAgICAgIHdoaWxlIChjaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjaGlsZHJlblswXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNjZW5lSXRlbS5kYXRhLnNldHRpbmdzKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9sb2FkU2NlbmVIaWVyYXJjaHkoc2NlbmVJdGVtLCBvbkJlZm9yZUFkZEhpZXJhcmNoeSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIHNjZW5lIGhpZXJhcmNoeSBhbmQgc2NlbmUgc2V0dGluZ3MuIFRoaXMgaXMgYW4gaW50ZXJuYWwgbWV0aG9kIHVzZWQgYnkgdGhlXG4gICAgICoge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIHNjZW5lIGZpbGUuXG4gICAgICogQHBhcmFtIHtMb2FkU2NlbmVDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIGFmdGVyIHRoZSBzZXR0aW5ncyBhcmVcbiAgICAgKiBhcHBsaWVkLiBQYXNzZWQgKGVyciwgc2NlbmUpIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9yIG9jY3VycmVkIGFuZCBzY2VuZSBpcyB0aGVcbiAgICAgKiB7QGxpbmsgU2NlbmV9LlxuICAgICAqL1xuICAgIGxvYWRTY2VuZSh1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuX2FwcDtcblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gYXBwLmxvYWRlci5nZXRIYW5kbGVyKFwic2NlbmVcIik7XG5cbiAgICAgICAgLy8gaW5jbHVkZSBhc3NldCBwcmVmaXggaWYgcHJlc2VudFxuICAgICAgICBpZiAoYXBwLmFzc2V0cyAmJiBhcHAuYXNzZXRzLnByZWZpeCAmJiAhQUJTT0xVVEVfVVJMLnRlc3QodXJsKSkge1xuICAgICAgICAgICAgdXJsID0gcGF0aC5qb2luKGFwcC5hc3NldHMucHJlZml4LCB1cmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFuZGxlci5sb2FkKHVybCwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBfbG9hZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwYXJzZSBhbmQgY3JlYXRlIHNjZW5lXG4gICAgICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBoYW5kbGVyLm9wZW4odXJsLCBkYXRhKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDYWNoZSB0aGUgZGF0YSBhcyB3ZSBhcmUgbG9hZGluZyB2aWEgVVJMIG9ubHlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NlbmVJdGVtID0gdGhpcy5maW5kQnlVcmwodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjZW5lSXRlbSAmJiAhc2NlbmVJdGVtLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmVJdGVtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXBwLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBzY2VuZSBmcm9tIGNhY2hlIGJlY2F1c2Ugd2UnbGwgZGVzdHJveSBpdCB3aGVuIHdlIGxvYWQgYW5vdGhlciBvbmVcbiAgICAgICAgICAgICAgICAgICAgLy8gc28gZGF0YSB3aWxsIGJlIGludmFsaWRcbiAgICAgICAgICAgICAgICAgICAgYXBwLmxvYWRlci5jbGVhckNhY2hlKHVybCwgXCJzY2VuZVwiKTtcblxuICAgICAgICAgICAgICAgICAgICBhcHAubG9hZGVyLnBhdGNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlOiBzY2VuZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic2NlbmVcIlxuICAgICAgICAgICAgICAgICAgICB9LCBhcHAuYXNzZXRzKTtcblxuICAgICAgICAgICAgICAgICAgICBhcHAucm9vdC5hZGRDaGlsZChzY2VuZS5yb290KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIHBhY2sgc2V0dGluZ3NcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFwcC5zeXN0ZW1zLnJpZ2lkYm9keSAmJiB0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldChzY2VuZS5fZ3Jhdml0eS54LCBzY2VuZS5fZ3Jhdml0eS55LCBzY2VuZS5fZ3Jhdml0eS56KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgc2NlbmUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIHByZWxvYWQgc2NyaXB0cyBiZWZvcmUgb3BlbmluZyBzY2VuZVxuICAgICAgICAgICAgICAgIGFwcC5fcHJlbG9hZFNjcmlwdHMoZGF0YSwgX2xvYWRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY2VuZVJlZ2lzdHJ5IH07XG4iXSwibmFtZXMiOlsiU2NlbmVSZWdpc3RyeSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiX2FwcCIsIl9saXN0IiwiX2luZGV4IiwiX3VybEluZGV4IiwiZGVzdHJveSIsImxpc3QiLCJhZGQiLCJuYW1lIiwidXJsIiwiaGFzT3duUHJvcGVydHkiLCJEZWJ1ZyIsIndhcm4iLCJpdGVtIiwiU2NlbmVSZWdpc3RyeUl0ZW0iLCJpIiwicHVzaCIsImZpbmQiLCJmaW5kQnlVcmwiLCJyZW1vdmUiLCJpZHgiLCJzcGxpY2UiLCJsZW5ndGgiLCJfbG9hZFNjZW5lRGF0YSIsInNjZW5lSXRlbSIsInN0b3JlSW5DYWNoZSIsImNhbGxiYWNrIiwibG9hZGVkIiwiYXNzZXRzIiwicHJlZml4IiwiQUJTT0xVVEVfVVJMIiwidGVzdCIsInBhdGgiLCJqb2luIiwiX29uTG9hZGVkQ2FsbGJhY2tzIiwiX2xvYWRpbmciLCJoYW5kbGVyIiwibG9hZGVyIiwiZ2V0SGFuZGxlciIsImxvYWQiLCJlcnIiLCJkYXRhIiwibG9hZFNjZW5lRGF0YSIsInVubG9hZFNjZW5lRGF0YSIsIl9sb2FkU2NlbmVIaWVyYXJjaHkiLCJvbkJlZm9yZUFkZEhpZXJhcmNoeSIsIl9sb2FkZWQiLCJzeXN0ZW1zIiwic2NyaXB0IiwicHJlbG9hZGluZyIsImVudGl0eSIsIm9wZW4iLCJjbGVhckNhY2hlIiwicm9vdCIsImFkZENoaWxkIiwiZmlyZSIsIl9wcmVsb2FkU2NyaXB0cyIsImxvYWRTY2VuZUhpZXJhcmNoeSIsImxvYWRTY2VuZVNldHRpbmdzIiwiYXBwbHlTY2VuZVNldHRpbmdzIiwic2V0dGluZ3MiLCJjaGFuZ2VTY2VuZSIsImNoaWxkcmVuIiwibG9hZFNjZW5lIiwic2NlbmUiLCJwYXRjaCIsInJlc291cmNlIiwidHlwZSIsInJpZ2lkYm9keSIsIkFtbW8iLCJncmF2aXR5Iiwic2V0IiwiX2dyYXZpdHkiLCJ4IiwieSIsInoiXSwibWFwcGluZ3MiOiI7Ozs7O0FBT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsYUFBYSxDQUFDO0FBQ2hCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsR0FBRyxFQUFFO0lBQ2IsSUFBSSxDQUFDQyxJQUFJLEdBQUdELEdBQUcsQ0FBQTtJQUNmLElBQUksQ0FBQ0UsS0FBSyxHQUFHLEVBQUUsQ0FBQTtBQUNmLElBQUEsSUFBSSxDQUFDQyxNQUFNLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLElBQUEsSUFBSSxDQUFDQyxTQUFTLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLEdBQUE7QUFFQUMsRUFBQUEsT0FBT0EsR0FBRztJQUNOLElBQUksQ0FBQ0osSUFBSSxHQUFHLElBQUksQ0FBQTtBQUNwQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUssRUFBQUEsSUFBSUEsR0FBRztJQUNILE9BQU8sSUFBSSxDQUFDSixLQUFLLENBQUE7QUFDckIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJSyxFQUFBQSxHQUFHQSxDQUFDQyxJQUFJLEVBQUVDLEdBQUcs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
