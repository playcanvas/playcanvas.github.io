import { platform } from '../../core/platform.js';
import { script } from '../script.js';
import { Script } from '../script/script.js';
import { ScriptTypes } from '../script/script-types.js';
import { registerScript } from '../script/script-create.js';
import { ResourceLoader } from './loader.js';
import { ResourceHandler } from './handler.js';
import { ScriptAttributes } from '../script/script-attributes.js';

const toLowerCamelCase = str => str[0].toLowerCase() + str.substring(1);
class ScriptHandler extends ResourceHandler {
  constructor(app) {
    super(app, 'script');
    this._scripts = {};
    this._cache = {};
  }
  clearCache() {
    for (const key in this._cache) {
      const element = this._cache[key];
      const parent = element.parentNode;
      if (parent) parent.removeChild(element);
    }
    this._cache = {};
  }
  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    const self = this;
    script.app = this._app;
    const onScriptLoad = (url.load, (err, url, extra) => {
      if (!err) {
        if (script.legacy) {
          let Type = null;
          if (ScriptTypes._types.length) {
            Type = ScriptTypes._types.pop();
          }
          if (Type) {
            this._scripts[url] = Type;
          } else {
            Type = null;
          }
          callback(null, Type, extra);
        } else {
          const obj = {};
          for (let i = 0; i < ScriptTypes._types.length; i++) obj[ScriptTypes._types[i].name] = ScriptTypes._types[i];
          ScriptTypes._types.length = 0;
          callback(null, obj, extra);
          delete self._loader._cache[ResourceLoader.makeKey(url, 'script')];
        }
      } else {
        callback(err);
      }
    });
    const [basePath, search] = url.load.split('?');
    const isEsmScript = basePath.endsWith('.mjs');
    if (isEsmScript) {
      let path = url.load;
      if (path.startsWith(this._app.assets.prefix)) {
        path = path.replace(this._app.assets.prefix, '');
      }
      const hash = this._app.assets.getByUrl(path).file.hash;
      const searchParams = new URLSearchParams(search);
      searchParams.set('hash', hash);
      const urlWithHash = `${basePath}?${searchParams.toString()}`;
      this._loadModule(urlWithHash, onScriptLoad);
    } else {
      this._loadScript(url.load, onScriptLoad);
    }
  }
  open(url, data) {
    return data;
  }
  patch(asset, assets) {}
  _loadScript(url, callback) {
    const head = document.head;
    const element = document.createElement('script');
    this._cache[url] = element;
    element.async = false;
    element.addEventListener('error', function (e) {
      callback(`Script: ${e.target.src} failed to load`);
    }, false);
    let done = false;
    element.onload = element.onreadystatechange = function () {
      if (!done && (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete')) {
        done = true;
        callback(null, url, element);
      }
    };
    element.src = url;
    head.appendChild(element);
  }
  _loadModule(url, callback) {
    const baseUrl = platform.browser ? window.location.origin : import.meta.url;
    const importUrl = new URL(url, baseUrl);
    import(/* @vite-ignore */importUrl.toString()).then(module => {
      for (const key in module) {
        const scriptClass = module[key];
        const extendsScriptType = scriptClass.prototype instanceof Script;
        if (extendsScriptType) {
          if (scriptClass.hasOwnProperty('attributes')) {
            const attributes = new ScriptAttributes(scriptClass);
            for (const _key in scriptClass.attributes) {
              attributes.add(_key, scriptClass.attributes[_key]);
            }
            scriptClass.attributes = attributes;
          }
          registerScript(scriptClass, toLowerCamelCase(scriptClass.name));
        }
      }
      callback(null, url, null);
    }).catch(err => {
      callback(err);
    });
  }
}

export { ScriptHandler };
