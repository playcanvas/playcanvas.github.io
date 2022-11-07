/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const cachedResult = func => {
  const uninitToken = {};
  let result = uninitToken;
  return () => {
    if (result === uninitToken) {
      result = func();
    }
    return result;
  };
};
class Impl {

  static loadScript(url, callback) {
    const s = document.createElement('script');
    s.setAttribute('src', url);
    s.onload = () => {
      callback(null);
    };
    s.onerror = () => {
      callback(`Failed to load script='${url}'`);
    };
    document.body.appendChild(s);
  }

  static loadWasm(moduleName, config, callback) {
    const loadUrl = Impl.wasmSupported() && config.glueUrl && config.wasmUrl ? config.glueUrl : config.fallbackUrl;
    if (loadUrl) {
      Impl.loadScript(loadUrl, err => {
        if (err) {
          callback(err, null);
        } else {
          const module = window[moduleName];

          window[moduleName] = undefined;

          module({
            locateFile: () => config.wasmUrl,
            onAbort: () => {
              callback('wasm module aborted.');
            }
          }).then(instance => {
            callback(null, instance);
          });
        }
      });
    } else {
      callback('No supported wasm modules found.', null);
    }
  }

  static getModule(name) {
    if (!Impl.modules.hasOwnProperty(name)) {
      Impl.modules[name] = {
        config: null,
        initializing: false,
        instance: null,
        callbacks: []
      };
    }
    return Impl.modules[name];
  }
  static initialize(moduleName, module) {
    if (module.initializing) {
      return;
    }
    const config = module.config;
    if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
      module.initializing = true;
      Impl.loadWasm(moduleName, config, (err, instance) => {
        if (err) {
          if (config.errorHandler) {
            config.errorHandler(err);
          } else {
            console.error(`failed to initialize module=${moduleName} error=${err}`);
          }
        } else {
          module.instance = instance;
          module.callbacks.forEach(callback => {
            callback(instance);
          });
        }
      });
    }
  }
}

Impl.modules = {};
Impl.wasmSupported = cachedResult(() => {
  try {
    if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
      const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      if (module instanceof WebAssembly.Module) return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
    }
  } catch (e) {}
  return false;
});

class WasmModule {
  static setConfig(moduleName, config) {
    const module = Impl.getModule(moduleName);
    module.config = config;
    if (module.callbacks.length > 0) {
      Impl.initialize(moduleName, module);
    }
  }

  static getInstance(moduleName, callback) {
    const module = Impl.getModule(moduleName);
    if (module.instance) {
      callback(module.instance);
    } else {
      module.callbacks.push(callback);
      if (module.config) {
        Impl.initialize(moduleName, module);
      }
    }
  }
}

export { WasmModule };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FzbS1tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL3dhc20tbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHdyYXBwZXIgZnVuY3Rpb24gdGhhdCBjYWNoZXMgdGhlIGZ1bmMgcmVzdWx0IG9uIGZpcnN0IGludm9jYXRpb24gYW5kXG4vLyB0aGVuIHN1YnNlcXVlbnRseSByZXR1cm5zIHRoZSBjYWNoZWQgdmFsdWVcbmNvbnN0IGNhY2hlZFJlc3VsdCA9IChmdW5jKSA9PiB7XG4gICAgY29uc3QgdW5pbml0VG9rZW4gPSB7fTtcbiAgICBsZXQgcmVzdWx0ID0gdW5pbml0VG9rZW47XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5pbml0VG9rZW4pIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG59O1xuXG5jbGFzcyBJbXBsIHtcbiAgICBzdGF0aWMgbW9kdWxlcyA9IHt9O1xuXG4gICAgLy8gcmV0dXJucyB0cnVlIGlmIHRoZSBydW5uaW5nIGhvc3Qgc3VwcG9ydHMgd2FzbSBtb2R1bGVzIChhbGwgYnJvd3NlcnMgZXhjZXB0IElFKVxuICAgIHN0YXRpYyB3YXNtU3VwcG9ydGVkID0gY2FjaGVkUmVzdWx0KCgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgV2ViQXNzZW1ibHkgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb2R1bGUgPSBuZXcgV2ViQXNzZW1ibHkuTW9kdWxlKFVpbnQ4QXJyYXkub2YoMHgwLCAweDYxLCAweDczLCAweDZkLCAweDAxLCAweDAwLCAweDAwLCAweDAwKSk7XG4gICAgICAgICAgICAgICAgaWYgKG1vZHVsZSBpbnN0YW5jZW9mIFdlYkFzc2VtYmx5Lk1vZHVsZSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBXZWJBc3NlbWJseS5JbnN0YW5jZShtb2R1bGUpIGluc3RhbmNlb2YgV2ViQXNzZW1ibHkuSW5zdGFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICAvLyBsb2FkIGEgc2NyaXB0XG4gICAgc3RhdGljIGxvYWRTY3JpcHQodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgIHMuc2V0QXR0cmlidXRlKCdzcmMnLCB1cmwpO1xuICAgICAgICBzLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICB9O1xuICAgICAgICBzLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICBjYWxsYmFjayhgRmFpbGVkIHRvIGxvYWQgc2NyaXB0PScke3VybH0nYCk7XG4gICAgICAgIH07XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocyk7XG4gICAgfVxuXG4gICAgLy8gbG9hZCBhIHdhc20gbW9kdWxlXG4gICAgc3RhdGljIGxvYWRXYXNtKG1vZHVsZU5hbWUsIGNvbmZpZywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbG9hZFVybCA9IChJbXBsLndhc21TdXBwb3J0ZWQoKSAmJiBjb25maWcuZ2x1ZVVybCAmJiBjb25maWcud2FzbVVybCkgPyBjb25maWcuZ2x1ZVVybCA6IGNvbmZpZy5mYWxsYmFja1VybDtcbiAgICAgICAgaWYgKGxvYWRVcmwpIHtcbiAgICAgICAgICAgIEltcGwubG9hZFNjcmlwdChsb2FkVXJsLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vZHVsZSA9IHdpbmRvd1ttb2R1bGVOYW1lXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciB0aGUgbW9kdWxlIGZyb20gdGhlIGdsb2JhbCB3aW5kb3cgc2luY2Ugd2UgdXNlZCB0byBzdG9yZSBnbG9iYWwgaW5zdGFuY2UgaGVyZVxuICAgICAgICAgICAgICAgICAgICB3aW5kb3dbbW9kdWxlTmFtZV0gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zdGFudGlhdGUgdGhlIG1vZHVsZVxuICAgICAgICAgICAgICAgICAgICBtb2R1bGUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYXRlRmlsZTogKCkgPT4gY29uZmlnLndhc21VcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkFib3J0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soJ3dhc20gbW9kdWxlIGFib3J0ZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKGluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soJ05vIHN1cHBvcnRlZCB3YXNtIG1vZHVsZXMgZm91bmQuJywgbnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBnZXQgc3RhdGUgb2JqZWN0IGZvciB0aGUgbmFtZWQgbW9kdWxlXG4gICAgc3RhdGljIGdldE1vZHVsZShuYW1lKSB7XG4gICAgICAgIGlmICghSW1wbC5tb2R1bGVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICBJbXBsLm1vZHVsZXNbbmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgY29uZmlnOiBudWxsLFxuICAgICAgICAgICAgICAgIGluaXRpYWxpemluZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgaW5zdGFuY2U6IG51bGwsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSW1wbC5tb2R1bGVzW25hbWVdO1xuICAgIH1cblxuICAgIHN0YXRpYyBpbml0aWFsaXplKG1vZHVsZU5hbWUsIG1vZHVsZSkge1xuICAgICAgICBpZiAobW9kdWxlLmluaXRpYWxpemluZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29uZmlnID0gbW9kdWxlLmNvbmZpZztcblxuICAgICAgICBpZiAoY29uZmlnLmdsdWVVcmwgfHwgY29uZmlnLndhc21VcmwgfHwgY29uZmlnLmZhbGxiYWNrVXJsKSB7XG4gICAgICAgICAgICBtb2R1bGUuaW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIEltcGwubG9hZFdhc20obW9kdWxlTmFtZSwgY29uZmlnLCAoZXJyLCBpbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5lcnJvckhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5lcnJvckhhbmRsZXIoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGZhaWxlZCB0byBpbml0aWFsaXplIG1vZHVsZT0ke21vZHVsZU5hbWV9IGVycm9yPSR7ZXJyfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kdWxlLmluc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIG1vZHVsZS5jYWxsYmFja3MuZm9yRWFjaCgoY2FsbGJhY2spID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTW9kdWxlI3NldENvbmZpZ30uXG4gKlxuICogQGNhbGxiYWNrIE1vZHVsZUVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfSBlcnJvciAtIElmIHRoZSBpbnN0YW5jZSBmYWlscyB0byBsb2FkIHRoaXMgd2lsbCBjb250YWluIGEgZGVzY3JpcHRpb24gb2YgdGhlIGVycm9yLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTW9kdWxlI2dldEluc3RhbmNlfS5cbiAqXG4gKiBAY2FsbGJhY2sgTW9kdWxlSW5zdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHthbnl9IG1vZHVsZUluc3RhbmNlIC0gVGhlIG1vZHVsZSBpbnN0YW5jZS5cbiAqL1xuXG4vKipcbiAqIEEgcHVyZSBzdGF0aWMgdXRpbGl0eSBjbGFzcyB3aGljaCBzdXBwb3J0cyBpbW1lZGlhdGUgYW5kIGxhenkgbG9hZGluZyBvZiB3YXNtIG1vZHVsZXMuXG4gKi9cbmNsYXNzIFdhc21Nb2R1bGUge1xuICAgIC8qKlxuICAgICAqIFNldCBhIHdhc20gbW9kdWxlJ3MgY29uZmlndXJhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2R1bGVOYW1lIC0gTmFtZSBvZiB0aGUgbW9kdWxlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29uZmlnXSAtIFRoZSBjb25maWd1cmF0aW9uIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2NvbmZpZy5nbHVlVXJsXSAtIFVSTCBvZiBnbHVlIHNjcmlwdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2NvbmZpZy53YXNtVXJsXSAtIFVSTCBvZiB0aGUgd2FzbSBzY3JpcHQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtjb25maWcuZmFsbGJhY2tVcmxdIC0gVVJMIG9mIHRoZSBmYWxsYmFjayBzY3JpcHQgdG8gdXNlIHdoZW4gd2FzbSBtb2R1bGVzXG4gICAgICogYXJlbid0IHN1cHBvcnRlZC5cbiAgICAgKiBAcGFyYW0ge01vZHVsZUVycm9yQ2FsbGJhY2t9IFtjb25maWcuZXJyb3JIYW5kbGVyXSAtIEZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBpZiB0aGUgbW9kdWxlIGZhaWxzXG4gICAgICogdG8gZG93bmxvYWQuXG4gICAgICovXG4gICAgc3RhdGljIHNldENvbmZpZyhtb2R1bGVOYW1lLCBjb25maWcpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlID0gSW1wbC5nZXRNb2R1bGUobW9kdWxlTmFtZSk7XG4gICAgICAgIG1vZHVsZS5jb25maWcgPSBjb25maWc7XG4gICAgICAgIGlmIChtb2R1bGUuY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIHN0YXJ0IG1vZHVsZSBpbml0aWFsaXplIGltbWVkaWF0ZWx5IHNpbmNlIHRoZXJlIGFyZSBwZW5kaW5nIGdldEluc3RhbmNlIHJlcXVlc3RzXG4gICAgICAgICAgICBJbXBsLmluaXRpYWxpemUobW9kdWxlTmFtZSwgbW9kdWxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIHdhc20gbW9kdWxlIGluc3RhbmNlLiBUaGUgaW5zdGFuY2Ugd2lsbCBiZSBjcmVhdGVkIGlmIG5lY2Vzc2FyeSBhbmQgcmV0dXJuZWRcbiAgICAgKiBpbiB0aGUgc2Vjb25kIHBhcmFtZXRlciB0byBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2R1bGVOYW1lIC0gTmFtZSBvZiB0aGUgbW9kdWxlLlxuICAgICAqIEBwYXJhbSB7TW9kdWxlSW5zdGFuY2VDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGluc3RhbmNlIGlzXG4gICAgICogYXZhaWxhYmxlLlxuICAgICAqL1xuICAgIHN0YXRpYyBnZXRJbnN0YW5jZShtb2R1bGVOYW1lLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBtb2R1bGUgPSBJbXBsLmdldE1vZHVsZShtb2R1bGVOYW1lKTtcblxuICAgICAgICBpZiAobW9kdWxlLmluc3RhbmNlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhtb2R1bGUuaW5zdGFuY2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbW9kdWxlLmNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChtb2R1bGUuY29uZmlnKSB7XG4gICAgICAgICAgICAgICAgLy8gY29uZmlnIGhhcyBiZWVuIHByb3ZpZGVkLCBraWNrIG9mZiBtb2R1bGUgaW5pdGlhbGl6ZVxuICAgICAgICAgICAgICAgIEltcGwuaW5pdGlhbGl6ZShtb2R1bGVOYW1lLCBtb2R1bGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQge1xuICAgIFdhc21Nb2R1bGVcbn07XG4iXSwibmFtZXMiOlsiY2FjaGVkUmVzdWx0IiwiZnVuYyIsInVuaW5pdFRva2VuIiwicmVzdWx0IiwiSW1wbCIsImxvYWRTY3JpcHQiLCJ1cmwiLCJjYWxsYmFjayIsInMiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJzZXRBdHRyaWJ1dGUiLCJvbmxvYWQiLCJvbmVycm9yIiwiYm9keSIsImFwcGVuZENoaWxkIiwibG9hZFdhc20iLCJtb2R1bGVOYW1lIiwiY29uZmlnIiwibG9hZFVybCIsIndhc21TdXBwb3J0ZWQiLCJnbHVlVXJsIiwid2FzbVVybCIsImZhbGxiYWNrVXJsIiwiZXJyIiwibW9kdWxlIiwid2luZG93IiwidW5kZWZpbmVkIiwibG9jYXRlRmlsZSIsIm9uQWJvcnQiLCJ0aGVuIiwiaW5zdGFuY2UiLCJnZXRNb2R1bGUiLCJuYW1lIiwibW9kdWxlcyIsImhhc093blByb3BlcnR5IiwiaW5pdGlhbGl6aW5nIiwiY2FsbGJhY2tzIiwiaW5pdGlhbGl6ZSIsImVycm9ySGFuZGxlciIsImNvbnNvbGUiLCJlcnJvciIsImZvckVhY2giLCJXZWJBc3NlbWJseSIsImluc3RhbnRpYXRlIiwiTW9kdWxlIiwiVWludDhBcnJheSIsIm9mIiwiSW5zdGFuY2UiLCJlIiwiV2FzbU1vZHVsZSIsInNldENvbmZpZyIsImxlbmd0aCIsImdldEluc3RhbmNlIiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFFQSxNQUFNQSxZQUFZLEdBQUlDLElBQUksSUFBSztFQUMzQixNQUFNQyxXQUFXLEdBQUcsRUFBRSxDQUFBO0VBQ3RCLElBQUlDLE1BQU0sR0FBR0QsV0FBVyxDQUFBO0FBQ3hCLEVBQUEsT0FBTyxNQUFNO0lBQ1QsSUFBSUMsTUFBTSxLQUFLRCxXQUFXLEVBQUU7TUFDeEJDLE1BQU0sR0FBR0YsSUFBSSxFQUFFLENBQUE7QUFDbkIsS0FBQTtBQUNBLElBQUEsT0FBT0UsTUFBTSxDQUFBO0dBQ2hCLENBQUE7QUFDTCxDQUFDLENBQUE7QUFFRCxNQUFNQyxJQUFJLENBQUM7O0FBZ0JQLEVBQUEsT0FBT0MsVUFBVSxDQUFDQyxHQUFHLEVBQUVDLFFBQVEsRUFBRTtBQUM3QixJQUFBLE1BQU1DLENBQUMsR0FBR0MsUUFBUSxDQUFDQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDMUNGLElBQUFBLENBQUMsQ0FBQ0csWUFBWSxDQUFDLEtBQUssRUFBRUwsR0FBRyxDQUFDLENBQUE7SUFDMUJFLENBQUMsQ0FBQ0ksTUFBTSxHQUFHLE1BQU07TUFDYkwsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFBO0tBQ2pCLENBQUE7SUFDREMsQ0FBQyxDQUFDSyxPQUFPLEdBQUcsTUFBTTtBQUNkTixNQUFBQSxR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