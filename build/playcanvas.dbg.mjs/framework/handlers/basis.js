import { Debug } from '../../core/debug.js';
import { PIXELFORMAT_RGB565, PIXELFORMAT_RGBA4 } from '../../platform/graphics/constants.js';
import { BasisWorker } from './basis-worker.js';
import { http } from '../../platform/net/http.js';

// get the list of the device's supported compression formats
const getCompressionFormats = device => {
  return {
    astc: !!device.extCompressedTextureASTC,
    atc: !!device.extCompressedTextureATC,
    dxt: !!device.extCompressedTextureS3TC,
    etc1: !!device.extCompressedTextureETC1,
    etc2: !!device.extCompressedTextureETC,
    pvr: !!device.extCompressedTexturePVRTC
  };
};

// download basis code and compile the wasm module for use in workers
const prepareWorkerModules = (config, callback) => {
  const getWorkerBlob = basisCode => {
    const code = ['/* basis */', basisCode, "", '(' + BasisWorker.toString() + ')()\n\n'].join('\n');
    return new Blob([code], {
      type: 'application/javascript'
    });
  };
  const wasmSupported = () => {
    try {
      if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
        const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
        if (module instanceof WebAssembly.Module) return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
      }
    } catch (e) {}
    return false;
  };
  const sendResponse = (basisCode, module) => {
    callback(null, {
      workerUrl: URL.createObjectURL(getWorkerBlob(basisCode)),
      module: module,
      rgbPriority: config.rgbPriority,
      rgbaPriority: config.rgbaPriority
    });
  };
  const options = {
    cache: true,
    responseType: 'text',
    retry: config.maxRetries > 0,
    maxRetries: config.maxRetries
  };
  if (config.glueUrl && config.wasmUrl && wasmSupported()) {
    let basisCode = null;
    let module = null;

    // download glue script
    http.get(config.glueUrl, options, (err, response) => {
      if (err) {
        callback(err);
      } else {
        if (module) {
          sendResponse(response, module);
        } else {
          basisCode = response;
        }
      }
    });
    const fetchPromise = fetch(config.wasmUrl);
    const compileManual = () => {
      fetchPromise.then(result => result.arrayBuffer()).then(buffer => WebAssembly.compile(buffer)).then(module_ => {
        if (basisCode) {
          sendResponse(basisCode, module_);
        } else {
          module = module_;
        }
      }).catch(err => {
        callback(err, null);
      });
    };

    // download and compile wasm module
    if (WebAssembly.compileStreaming) {
      WebAssembly.compileStreaming(fetchPromise).then(module_ => {
        if (basisCode) {
          sendResponse(basisCode, module_);
        } else {
          module = module_;
        }
      }).catch(err => {
        Debug.warn(`compileStreaming() failed for ${config.wasmUrl} (${err}), falling back to arraybuffer download.`);
        compileManual();
      });
    } else {
      compileManual();
    }
  } else {
    http.get(config.fallbackUrl, options, (err, response) => {
      if (err) {
        callback(err, null);
      } else {
        sendResponse(response, null);
      }
    });
  }
};

// queue of transcode jobs and clients ready to run them
class BasisQueue {
  constructor() {
    this.callbacks = {};
    this.queue = [];
    this.clients = [];
  }
  enqueueJob(url, data, callback, options) {
    if (this.callbacks.hasOwnProperty(url)) {
      // duplicate URL request
      this.callbacks[url].push(callback);
    } else {
      // new URL request
      this.callbacks[url] = [callback];
      const job = {
        url: url,
        data: data,
        options: options
      };
      if (this.clients.length > 0) {
        this.clients.shift().run(job);
      } else {
        this.queue.push(job);
      }
    }
  }
  enqueueClient(client) {
    if (this.queue.length > 0) {
      client.run(this.queue.shift());
    } else {
      this.clients.push(client);
    }
  }
  handleResponse(url, err, data) {
    const callback = this.callbacks[url];
    if (err) {
      for (let i = 0; i < callback.length; ++i) {
        callback[i](err);
      }
    } else {
      // (re)create typed array from the returned array buffers
      if (data.format === PIXELFORMAT_RGB565 || data.format === PIXELFORMAT_RGBA4) {
        // handle 16 bit formats
        data.levels = data.levels.map(function (v) {
          return new Uint16Array(v);
        });
      } else {
        // all other
        data.levels = data.levels.map(function (v) {
          return new Uint8Array(v);
        });
      }
      for (let i = 0; i < callback.length; ++i) {
        callback[i](null, data);
      }
    }
    delete this.callbacks[url];
  }
}

// client interface to a basis transcoder instance running on a web worker
class BasisClient {
  constructor(queue, config, eager) {
    this.queue = queue;
    this.worker = new Worker(config.workerUrl);
    this.worker.addEventListener('message', message => {
      const data = message.data;
      this.queue.handleResponse(data.url, data.err, data.data);
      if (!this.eager) {
        this.queue.enqueueClient(this);
      }
    });
    this.worker.postMessage({
      type: 'init',
      config: config
    });

    // an eager client will enqueue itself while a job is running. a
    // non-eager client will only enqueue itself once the current job
    // has finished running.
    this.eager = eager;
  }
  run(job) {
    const transfer = [];
    if (job.data instanceof ArrayBuffer) {
      transfer.push(job.data);
    }
    this.worker.postMessage({
      type: 'transcode',
      url: job.url,
      format: job.format,
      data: job.data,
      options: job.options
    }, transfer);
    if (this.eager) {
      this.queue.enqueueClient(this);
    }
  }
}

// defaults
const defaultNumWorkers = 1;
const defaultRgbPriority = ['etc1', 'etc2', 'astc', 'dxt', 'pvr', 'atc'];
const defaultRgbaPriority = ['astc', 'dxt', 'etc2', 'pvr', 'atc'];
const defaultMaxRetries = 5;

// global state
const queue = new BasisQueue();
let lazyConfig = null;
let initializing = false;

/**
 * Initialize the Basis transcode worker.
 *
 * @param {object} [config] - The Basis configuration.
 * @param {string} [config.glueUrl] - URL of glue script.
 * @param {string} [config.wasmUrl] - URL of the wasm module.
 * @param {string} [config.fallbackUrl] - URL of the fallback script to use when wasm modules
 * aren't supported.
 * @param {boolean} [config.lazyInit] - Wait for first transcode request before initializing Basis
 * (default is false). Otherwise initialize Basis immediately.
 * @param {number} [config.numWorkers] - Number of workers to use for transcoding (default is 1).
 * While it is possible to improve transcode performance using multiple workers, this will likely
 * depend on the runtime platform. For example, desktop will likely benefit from more workers
 * compared to mobile. Also keep in mind that it takes time to initialize workers and increasing
 * this value could impact application startup time. Make sure to test your application performance
 * on all target platforms when changing this parameter.
 * @param {boolean} [config.eagerWorkers] - Use eager workers (default is true). When enabled, jobs
 * are assigned to workers immediately, independent of their work load. This can result in
 * unbalanced workloads, however there is no delay between jobs. If disabled, new jobs are assigned
 * to workers only when their previous job has completed. This will result in balanced workloads
 * across workers, however workers can be idle for a short time between jobs.
 * @param {string[]} [config.rgbPriority] - Array of texture compression formats in priority order
 * for textures without alpha. The supported compressed formats are: 'astc', 'atc', 'dxt', 'etc1',
 * 'etc2', 'pvr'.
 * @param {string[]} [config.rgbaPriority] - Array of texture compression formats in priority order
 * for textures with alpha. The supported compressed formats are: 'astc', 'atc', 'dxt', 'etc1',
 * 'etc2', 'pvr'.
 * @param {number} [config.maxRetries] - Number of http load retry attempts. Defaults to 5.
 */
function basisInitialize(config) {
  if (initializing) {
    // already initializing
    return;
  }
  if (!config) {
    config = lazyConfig || {};
  } else if (config.lazyInit) {
    lazyConfig = config;
    return;
  }

  // if any URLs are not specified in the config, take them from the global PC config structure
  if (!config.glueUrl || !config.wasmUrl || !config.fallbackUrl) {
    const modules = (window.config ? window.config.wasmModules : window.PRELOAD_MODULES) || [];
    const wasmModule = modules.find(function (m) {
      return m.moduleName === 'BASIS';
    });
    if (wasmModule) {
      const urlBase = window.ASSET_PREFIX || '';
      if (!config.glueUrl) {
        config.glueUrl = urlBase + wasmModule.glueUrl;
      }
      if (!config.wasmUrl) {
        config.wasmUrl = urlBase + wasmModule.wasmUrl;
      }
      if (!config.fallbackUrl) {
        config.fallbackUrl = urlBase + wasmModule.fallbackUrl;
      }
    }
  }
  if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
    initializing = true;
    const numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));
    const eagerWorkers = config.numWorkers === 1 || (config.hasOwnProperty('eagerWorkers') ? config.eagerWorkers : true);
    config.rgbPriority = config.rgbPriority || defaultRgbPriority;
    config.rgbaPriority = config.rgbaPriority || defaultRgbaPriority;
    config.maxRetries = config.hasOwnProperty('maxRetries') ? config.maxRetries : defaultMaxRetries;
    prepareWorkerModules(config, (err, clientConfig) => {
      if (err) {
        console.error(`failed to initialize basis worker: ${err}`);
      } else {
        for (let i = 0; i < numWorkers; ++i) {
          queue.enqueueClient(new BasisClient(queue, clientConfig, eagerWorkers));
        }
      }
    });
  }
}
let deviceDetails = null;

/**
 * Enqueue a blob of basis data for transcoding.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} url - URL of the basis file.
 * @param {object} data - The file data to transcode.
 * @param {Function} callback - Callback function to receive transcode result.
 * @param {object} [options] - Options structure
 * @param {boolean} [options.isGGGR] - Indicates this is a GGGR swizzled texture. Under some
 * circumstances the texture will be unswizzled during transcoding.
 * @param {boolean} [options.isKTX2] - Indicates the image is KTX2 format. Otherwise
 * basis format is assumed.
 * @returns {boolean} True if the basis worker was initialized and false otherwise.
 * @ignore
 */
function basisTranscode(device, url, data, callback, options) {
  basisInitialize();
  if (!deviceDetails) {
    deviceDetails = {
      webgl2: device.webgl2,
      formats: getCompressionFormats(device)
    };
  }
  queue.enqueueJob(url, data, callback, {
    deviceDetails: deviceDetails,
    isGGGR: !!(options != null && options.isGGGR),
    isKTX2: !!(options != null && options.isKTX2)
  });
  return initializing;
}

export { basisInitialize, basisTranscode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvaGFuZGxlcnMvYmFzaXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmFzaXNXb3JrZXIgfSBmcm9tICcuL2Jhc2lzLXdvcmtlci5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG4vLyBnZXQgdGhlIGxpc3Qgb2YgdGhlIGRldmljZSdzIHN1cHBvcnRlZCBjb21wcmVzc2lvbiBmb3JtYXRzXG5jb25zdCBnZXRDb21wcmVzc2lvbkZvcm1hdHMgPSAoZGV2aWNlKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgYXN0YzogISFkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDLFxuICAgICAgICBhdGM6ICEhZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVRDLFxuICAgICAgICBkeHQ6ICEhZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyxcbiAgICAgICAgZXRjMTogISFkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxLFxuICAgICAgICBldGMyOiAhIWRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQyxcbiAgICAgICAgcHZyOiAhIWRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDXG4gICAgfTtcbn07XG5cbi8vIGRvd25sb2FkIGJhc2lzIGNvZGUgYW5kIGNvbXBpbGUgdGhlIHdhc20gbW9kdWxlIGZvciB1c2UgaW4gd29ya2Vyc1xuY29uc3QgcHJlcGFyZVdvcmtlck1vZHVsZXMgPSAoY29uZmlnLCBjYWxsYmFjaykgPT4ge1xuICAgIGNvbnN0IGdldFdvcmtlckJsb2IgPSAoYmFzaXNDb2RlKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBbXG4gICAgICAgICAgICAnLyogYmFzaXMgKi8nLFxuICAgICAgICAgICAgYmFzaXNDb2RlLFxuICAgICAgICAgICAgXCJcIixcbiAgICAgICAgICAgICcoJyArIEJhc2lzV29ya2VyLnRvU3RyaW5nKCkgKyAnKSgpXFxuXFxuJ1xuICAgICAgICBdLmpvaW4oJ1xcbicpO1xuICAgICAgICByZXR1cm4gbmV3IEJsb2IoW2NvZGVdLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyB9KTtcbiAgICB9O1xuXG4gICAgY29uc3Qgd2FzbVN1cHBvcnRlZCA9ICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgV2ViQXNzZW1ibHkgPT09ICdvYmplY3QnICYmIHR5cGVvZiBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vZHVsZSA9IG5ldyBXZWJBc3NlbWJseS5Nb2R1bGUoVWludDhBcnJheS5vZigweDAsIDB4NjEsIDB4NzMsIDB4NmQsIDB4MDEsIDB4MDAsIDB4MDAsIDB4MDApKTtcbiAgICAgICAgICAgICAgICBpZiAobW9kdWxlIGluc3RhbmNlb2YgV2ViQXNzZW1ibHkuTW9kdWxlKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFdlYkFzc2VtYmx5Lkluc3RhbmNlKG1vZHVsZSkgaW5zdGFuY2VvZiBXZWJBc3NlbWJseS5JbnN0YW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkgeyB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2VuZFJlc3BvbnNlID0gKGJhc2lzQ29kZSwgbW9kdWxlKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIHdvcmtlclVybDogVVJMLmNyZWF0ZU9iamVjdFVSTChnZXRXb3JrZXJCbG9iKGJhc2lzQ29kZSkpLFxuICAgICAgICAgICAgbW9kdWxlOiBtb2R1bGUsXG4gICAgICAgICAgICByZ2JQcmlvcml0eTogY29uZmlnLnJnYlByaW9yaXR5LFxuICAgICAgICAgICAgcmdiYVByaW9yaXR5OiBjb25maWcucmdiYVByaW9yaXR5XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgcmVzcG9uc2VUeXBlOiAndGV4dCcsXG4gICAgICAgIHJldHJ5OiBjb25maWcubWF4UmV0cmllcyA+IDAsXG4gICAgICAgIG1heFJldHJpZXM6IGNvbmZpZy5tYXhSZXRyaWVzXG4gICAgfTtcblxuICAgIGlmIChjb25maWcuZ2x1ZVVybCAmJiBjb25maWcud2FzbVVybCAmJiB3YXNtU3VwcG9ydGVkKCkpIHtcbiAgICAgICAgbGV0IGJhc2lzQ29kZSA9IG51bGw7XG4gICAgICAgIGxldCBtb2R1bGUgPSBudWxsO1xuXG4gICAgICAgIC8vIGRvd25sb2FkIGdsdWUgc2NyaXB0XG4gICAgICAgIGh0dHAuZ2V0KGNvbmZpZy5nbHVlVXJsLCBvcHRpb25zLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChtb2R1bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHJlc3BvbnNlLCBtb2R1bGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGJhc2lzQ29kZSA9IHJlc3BvbnNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZmV0Y2hQcm9taXNlID0gZmV0Y2goY29uZmlnLndhc21VcmwpO1xuXG4gICAgICAgIGNvbnN0IGNvbXBpbGVNYW51YWwgPSAoKSA9PiB7XG4gICAgICAgICAgICBmZXRjaFByb21pc2VcbiAgICAgICAgICAgICAgICAudGhlbihyZXN1bHQgPT4gcmVzdWx0LmFycmF5QnVmZmVyKCkpXG4gICAgICAgICAgICAgICAgLnRoZW4oYnVmZmVyID0+IFdlYkFzc2VtYmx5LmNvbXBpbGUoYnVmZmVyKSlcbiAgICAgICAgICAgICAgICAudGhlbigobW9kdWxlXykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYmFzaXNDb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoYmFzaXNDb2RlLCBtb2R1bGVfKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZHVsZSA9IG1vZHVsZV87XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gZG93bmxvYWQgYW5kIGNvbXBpbGUgd2FzbSBtb2R1bGVcbiAgICAgICAgaWYgKFdlYkFzc2VtYmx5LmNvbXBpbGVTdHJlYW1pbmcpIHtcbiAgICAgICAgICAgIFdlYkFzc2VtYmx5LmNvbXBpbGVTdHJlYW1pbmcoZmV0Y2hQcm9taXNlKVxuICAgICAgICAgICAgICAgIC50aGVuKChtb2R1bGVfKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiYXNpc0NvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZShiYXNpc0NvZGUsIG1vZHVsZV8pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbW9kdWxlID0gbW9kdWxlXztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybihgY29tcGlsZVN0cmVhbWluZygpIGZhaWxlZCBmb3IgJHtjb25maWcud2FzbVVybH0gKCR7ZXJyfSksIGZhbGxpbmcgYmFjayB0byBhcnJheWJ1ZmZlciBkb3dubG9hZC5gKTtcbiAgICAgICAgICAgICAgICAgICAgY29tcGlsZU1hbnVhbCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGlsZU1hbnVhbCgpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaHR0cC5nZXQoY29uZmlnLmZhbGxiYWNrVXJsLCBvcHRpb25zLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZShyZXNwb25zZSwgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIHF1ZXVlIG9mIHRyYW5zY29kZSBqb2JzIGFuZCBjbGllbnRzIHJlYWR5IHRvIHJ1biB0aGVtXG5jbGFzcyBCYXNpc1F1ZXVlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MgPSB7fTtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IFtdO1xuICAgICAgICB0aGlzLmNsaWVudHMgPSBbXTtcbiAgICB9XG5cbiAgICBlbnF1ZXVlSm9iKHVybCwgZGF0YSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2tzLmhhc093blByb3BlcnR5KHVybCkpIHtcbiAgICAgICAgICAgIC8vIGR1cGxpY2F0ZSBVUkwgcmVxdWVzdFxuICAgICAgICAgICAgdGhpcy5jYWxsYmFja3NbdXJsXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5ldyBVUkwgcmVxdWVzdFxuICAgICAgICAgICAgdGhpcy5jYWxsYmFja3NbdXJsXSA9IFtjYWxsYmFja107XG5cbiAgICAgICAgICAgIGNvbnN0IGpvYiA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNsaWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50cy5zaGlmdCgpLnJ1bihqb2IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXVlLnB1c2goam9iKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVucXVldWVDbGllbnQoY2xpZW50KSB7XG4gICAgICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNsaWVudC5ydW4odGhpcy5xdWV1ZS5zaGlmdCgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50cy5wdXNoKGNsaWVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBoYW5kbGVSZXNwb25zZSh1cmwsIGVyciwgZGF0YSkge1xuICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuY2FsbGJhY2tzW3VybF07XG5cbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYWxsYmFjay5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIChjYWxsYmFja1tpXSkoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIChyZSljcmVhdGUgdHlwZWQgYXJyYXkgZnJvbSB0aGUgcmV0dXJuZWQgYXJyYXkgYnVmZmVyc1xuICAgICAgICAgICAgaWYgKGRhdGEuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0I1NjUgfHwgZGF0YS5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkE0KSB7XG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIDE2IGJpdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgZGF0YS5sZXZlbHMgPSBkYXRhLmxldmVscy5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBVaW50MTZBcnJheSh2KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYWxsIG90aGVyXG4gICAgICAgICAgICAgICAgZGF0YS5sZXZlbHMgPSBkYXRhLmxldmVscy5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHYpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhbGxiYWNrLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgKGNhbGxiYWNrW2ldKShudWxsLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgdGhpcy5jYWxsYmFja3NbdXJsXTtcbiAgICB9XG59XG5cbi8vIGNsaWVudCBpbnRlcmZhY2UgdG8gYSBiYXNpcyB0cmFuc2NvZGVyIGluc3RhbmNlIHJ1bm5pbmcgb24gYSB3ZWIgd29ya2VyXG5jbGFzcyBCYXNpc0NsaWVudCB7XG4gICAgY29uc3RydWN0b3IocXVldWUsIGNvbmZpZywgZWFnZXIpIHtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IHF1ZXVlO1xuICAgICAgICB0aGlzLndvcmtlciA9IG5ldyBXb3JrZXIoY29uZmlnLndvcmtlclVybCk7XG4gICAgICAgIHRoaXMud29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG1lc3NhZ2UuZGF0YTtcbiAgICAgICAgICAgIHRoaXMucXVldWUuaGFuZGxlUmVzcG9uc2UoZGF0YS51cmwsIGRhdGEuZXJyLCBkYXRhLmRhdGEpO1xuICAgICAgICAgICAgaWYgKCF0aGlzLmVhZ2VyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5xdWV1ZS5lbnF1ZXVlQ2xpZW50KHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy53b3JrZXIucG9zdE1lc3NhZ2UoeyB0eXBlOiAnaW5pdCcsIGNvbmZpZzogY29uZmlnIH0pO1xuXG4gICAgICAgIC8vIGFuIGVhZ2VyIGNsaWVudCB3aWxsIGVucXVldWUgaXRzZWxmIHdoaWxlIGEgam9iIGlzIHJ1bm5pbmcuIGFcbiAgICAgICAgLy8gbm9uLWVhZ2VyIGNsaWVudCB3aWxsIG9ubHkgZW5xdWV1ZSBpdHNlbGYgb25jZSB0aGUgY3VycmVudCBqb2JcbiAgICAgICAgLy8gaGFzIGZpbmlzaGVkIHJ1bm5pbmcuXG4gICAgICAgIHRoaXMuZWFnZXIgPSBlYWdlcjtcbiAgICB9XG5cbiAgICBydW4oam9iKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZmVyID0gW107XG4gICAgICAgIGlmIChqb2IuZGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICB0cmFuc2Zlci5wdXNoKGpvYi5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLndvcmtlci5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAndHJhbnNjb2RlJyxcbiAgICAgICAgICAgIHVybDogam9iLnVybCxcbiAgICAgICAgICAgIGZvcm1hdDogam9iLmZvcm1hdCxcbiAgICAgICAgICAgIGRhdGE6IGpvYi5kYXRhLFxuICAgICAgICAgICAgb3B0aW9uczogam9iLm9wdGlvbnNcbiAgICAgICAgfSwgdHJhbnNmZXIpO1xuICAgICAgICBpZiAodGhpcy5lYWdlcikge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZS5lbnF1ZXVlQ2xpZW50KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBkZWZhdWx0c1xuY29uc3QgZGVmYXVsdE51bVdvcmtlcnMgPSAxO1xuY29uc3QgZGVmYXVsdFJnYlByaW9yaXR5ID0gWydldGMxJywgJ2V0YzInLCAnYXN0YycsICdkeHQnLCAncHZyJywgJ2F0YyddO1xuY29uc3QgZGVmYXVsdFJnYmFQcmlvcml0eSA9IFsnYXN0YycsICdkeHQnLCAnZXRjMicsICdwdnInLCAnYXRjJ107XG5jb25zdCBkZWZhdWx0TWF4UmV0cmllcyA9IDU7XG5cbi8vIGdsb2JhbCBzdGF0ZVxuY29uc3QgcXVldWUgPSBuZXcgQmFzaXNRdWV1ZSgpO1xubGV0IGxhenlDb25maWcgPSBudWxsO1xubGV0IGluaXRpYWxpemluZyA9IGZhbHNlO1xuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIEJhc2lzIHRyYW5zY29kZSB3b3JrZXIuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IFtjb25maWddIC0gVGhlIEJhc2lzIGNvbmZpZ3VyYXRpb24uXG4gKiBAcGFyYW0ge3N0cmluZ30gW2NvbmZpZy5nbHVlVXJsXSAtIFVSTCBvZiBnbHVlIHNjcmlwdC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29uZmlnLndhc21VcmxdIC0gVVJMIG9mIHRoZSB3YXNtIG1vZHVsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29uZmlnLmZhbGxiYWNrVXJsXSAtIFVSTCBvZiB0aGUgZmFsbGJhY2sgc2NyaXB0IHRvIHVzZSB3aGVuIHdhc20gbW9kdWxlc1xuICogYXJlbid0IHN1cHBvcnRlZC5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NvbmZpZy5sYXp5SW5pdF0gLSBXYWl0IGZvciBmaXJzdCB0cmFuc2NvZGUgcmVxdWVzdCBiZWZvcmUgaW5pdGlhbGl6aW5nIEJhc2lzXG4gKiAoZGVmYXVsdCBpcyBmYWxzZSkuIE90aGVyd2lzZSBpbml0aWFsaXplIEJhc2lzIGltbWVkaWF0ZWx5LlxuICogQHBhcmFtIHtudW1iZXJ9IFtjb25maWcubnVtV29ya2Vyc10gLSBOdW1iZXIgb2Ygd29ya2VycyB0byB1c2UgZm9yIHRyYW5zY29kaW5nIChkZWZhdWx0IGlzIDEpLlxuICogV2hpbGUgaXQgaXMgcG9zc2libGUgdG8gaW1wcm92ZSB0cmFuc2NvZGUgcGVyZm9ybWFuY2UgdXNpbmcgbXVsdGlwbGUgd29ya2VycywgdGhpcyB3aWxsIGxpa2VseVxuICogZGVwZW5kIG9uIHRoZSBydW50aW1lIHBsYXRmb3JtLiBGb3IgZXhhbXBsZSwgZGVza3RvcCB3aWxsIGxpa2VseSBiZW5lZml0IGZyb20gbW9yZSB3b3JrZXJzXG4gKiBjb21wYXJlZCB0byBtb2JpbGUuIEFsc28ga2VlcCBpbiBtaW5kIHRoYXQgaXQgdGFrZXMgdGltZSB0byBpbml0aWFsaXplIHdvcmtlcnMgYW5kIGluY3JlYXNpbmdcbiAqIHRoaXMgdmFsdWUgY291bGQgaW1wYWN0IGFwcGxpY2F0aW9uIHN0YXJ0dXAgdGltZS4gTWFrZSBzdXJlIHRvIHRlc3QgeW91ciBhcHBsaWNhdGlvbiBwZXJmb3JtYW5jZVxuICogb24gYWxsIHRhcmdldCBwbGF0Zm9ybXMgd2hlbiBjaGFuZ2luZyB0aGlzIHBhcmFtZXRlci5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NvbmZpZy5lYWdlcldvcmtlcnNdIC0gVXNlIGVhZ2VyIHdvcmtlcnMgKGRlZmF1bHQgaXMgdHJ1ZSkuIFdoZW4gZW5hYmxlZCwgam9ic1xuICogYXJlIGFzc2lnbmVkIHRvIHdvcmtlcnMgaW1tZWRpYXRlbHksIGluZGVwZW5kZW50IG9mIHRoZWlyIHdvcmsgbG9hZC4gVGhpcyBjYW4gcmVzdWx0IGluXG4gKiB1bmJhbGFuY2VkIHdvcmtsb2FkcywgaG93ZXZlciB0aGVyZSBpcyBubyBkZWxheSBiZXR3ZWVuIGpvYnMuIElmIGRpc2FibGVkLCBuZXcgam9icyBhcmUgYXNzaWduZWRcbiAqIHRvIHdvcmtlcnMgb25seSB3aGVuIHRoZWlyIHByZXZpb3VzIGpvYiBoYXMgY29tcGxldGVkLiBUaGlzIHdpbGwgcmVzdWx0IGluIGJhbGFuY2VkIHdvcmtsb2Fkc1xuICogYWNyb3NzIHdvcmtlcnMsIGhvd2V2ZXIgd29ya2VycyBjYW4gYmUgaWRsZSBmb3IgYSBzaG9ydCB0aW1lIGJldHdlZW4gam9icy5cbiAqIEBwYXJhbSB7c3RyaW5nW119IFtjb25maWcucmdiUHJpb3JpdHldIC0gQXJyYXkgb2YgdGV4dHVyZSBjb21wcmVzc2lvbiBmb3JtYXRzIGluIHByaW9yaXR5IG9yZGVyXG4gKiBmb3IgdGV4dHVyZXMgd2l0aG91dCBhbHBoYS4gVGhlIHN1cHBvcnRlZCBjb21wcmVzc2VkIGZvcm1hdHMgYXJlOiAnYXN0YycsICdhdGMnLCAnZHh0JywgJ2V0YzEnLFxuICogJ2V0YzInLCAncHZyJy5cbiAqIEBwYXJhbSB7c3RyaW5nW119IFtjb25maWcucmdiYVByaW9yaXR5XSAtIEFycmF5IG9mIHRleHR1cmUgY29tcHJlc3Npb24gZm9ybWF0cyBpbiBwcmlvcml0eSBvcmRlclxuICogZm9yIHRleHR1cmVzIHdpdGggYWxwaGEuIFRoZSBzdXBwb3J0ZWQgY29tcHJlc3NlZCBmb3JtYXRzIGFyZTogJ2FzdGMnLCAnYXRjJywgJ2R4dCcsICdldGMxJyxcbiAqICdldGMyJywgJ3B2cicuXG4gKiBAcGFyYW0ge251bWJlcn0gW2NvbmZpZy5tYXhSZXRyaWVzXSAtIE51bWJlciBvZiBodHRwIGxvYWQgcmV0cnkgYXR0ZW1wdHMuIERlZmF1bHRzIHRvIDUuXG4gKi9cbmZ1bmN0aW9uIGJhc2lzSW5pdGlhbGl6ZShjb25maWcpIHtcbiAgICBpZiAoaW5pdGlhbGl6aW5nKSB7XG4gICAgICAgIC8vIGFscmVhZHkgaW5pdGlhbGl6aW5nXG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbmZpZykge1xuICAgICAgICBjb25maWcgPSBsYXp5Q29uZmlnIHx8IHt9O1xuICAgIH0gZWxzZSBpZiAoY29uZmlnLmxhenlJbml0KSB7XG4gICAgICAgIGxhenlDb25maWcgPSBjb25maWc7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBpZiBhbnkgVVJMcyBhcmUgbm90IHNwZWNpZmllZCBpbiB0aGUgY29uZmlnLCB0YWtlIHRoZW0gZnJvbSB0aGUgZ2xvYmFsIFBDIGNvbmZpZyBzdHJ1Y3R1cmVcbiAgICBpZiAoIWNvbmZpZy5nbHVlVXJsIHx8ICFjb25maWcud2FzbVVybCB8fCAhY29uZmlnLmZhbGxiYWNrVXJsKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZXMgPSAod2luZG93LmNvbmZpZyA/IHdpbmRvdy5jb25maWcud2FzbU1vZHVsZXMgOiB3aW5kb3cuUFJFTE9BRF9NT0RVTEVTKSB8fCBbXTtcbiAgICAgICAgY29uc3Qgd2FzbU1vZHVsZSA9IG1vZHVsZXMuZmluZChmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgcmV0dXJuIG0ubW9kdWxlTmFtZSA9PT0gJ0JBU0lTJztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh3YXNtTW9kdWxlKSB7XG4gICAgICAgICAgICBjb25zdCB1cmxCYXNlID0gd2luZG93LkFTU0VUX1BSRUZJWCB8fCAnJztcbiAgICAgICAgICAgIGlmICghY29uZmlnLmdsdWVVcmwpIHtcbiAgICAgICAgICAgICAgICBjb25maWcuZ2x1ZVVybCA9IHVybEJhc2UgKyB3YXNtTW9kdWxlLmdsdWVVcmw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWNvbmZpZy53YXNtVXJsKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnLndhc21VcmwgPSB1cmxCYXNlICsgd2FzbU1vZHVsZS53YXNtVXJsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFjb25maWcuZmFsbGJhY2tVcmwpIHtcbiAgICAgICAgICAgICAgICBjb25maWcuZmFsbGJhY2tVcmwgPSB1cmxCYXNlICsgd2FzbU1vZHVsZS5mYWxsYmFja1VybDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb25maWcuZ2x1ZVVybCB8fCBjb25maWcud2FzbVVybCB8fCBjb25maWcuZmFsbGJhY2tVcmwpIHtcbiAgICAgICAgaW5pdGlhbGl6aW5nID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBudW1Xb3JrZXJzID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oMTYsIGNvbmZpZy5udW1Xb3JrZXJzIHx8IGRlZmF1bHROdW1Xb3JrZXJzKSk7XG4gICAgICAgIGNvbnN0IGVhZ2VyV29ya2VycyA9IChjb25maWcubnVtV29ya2VycyA9PT0gMSkgfHwgKGNvbmZpZy5oYXNPd25Qcm9wZXJ0eSgnZWFnZXJXb3JrZXJzJykgPyBjb25maWcuZWFnZXJXb3JrZXJzIDogdHJ1ZSk7XG5cbiAgICAgICAgY29uZmlnLnJnYlByaW9yaXR5ID0gY29uZmlnLnJnYlByaW9yaXR5IHx8IGRlZmF1bHRSZ2JQcmlvcml0eTtcbiAgICAgICAgY29uZmlnLnJnYmFQcmlvcml0eSA9IGNvbmZpZy5yZ2JhUHJpb3JpdHkgfHwgZGVmYXVsdFJnYmFQcmlvcml0eTtcbiAgICAgICAgY29uZmlnLm1heFJldHJpZXMgPSBjb25maWcuaGFzT3duUHJvcGVydHkoJ21heFJldHJpZXMnKSA/IGNvbmZpZy5tYXhSZXRyaWVzIDogZGVmYXVsdE1heFJldHJpZXM7XG5cbiAgICAgICAgcHJlcGFyZVdvcmtlck1vZHVsZXMoY29uZmlnLCAoZXJyLCBjbGllbnRDb25maWcpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBmYWlsZWQgdG8gaW5pdGlhbGl6ZSBiYXNpcyB3b3JrZXI6ICR7ZXJyfWApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVdvcmtlcnM7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBxdWV1ZS5lbnF1ZXVlQ2xpZW50KG5ldyBCYXNpc0NsaWVudChxdWV1ZSwgY2xpZW50Q29uZmlnLCBlYWdlcldvcmtlcnMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxubGV0IGRldmljZURldGFpbHMgPSBudWxsO1xuXG4vKipcbiAqIEVucXVldWUgYSBibG9iIG9mIGJhc2lzIGRhdGEgZm9yIHRyYW5zY29kaW5nLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gKiBncmFwaGljcyBkZXZpY2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVVJMIG9mIHRoZSBiYXNpcyBmaWxlLlxuICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBUaGUgZmlsZSBkYXRhIHRvIHRyYW5zY29kZS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgZnVuY3Rpb24gdG8gcmVjZWl2ZSB0cmFuc2NvZGUgcmVzdWx0LlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgc3RydWN0dXJlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmlzR0dHUl0gLSBJbmRpY2F0ZXMgdGhpcyBpcyBhIEdHR1Igc3dpenpsZWQgdGV4dHVyZS4gVW5kZXIgc29tZVxuICogY2lyY3Vtc3RhbmNlcyB0aGUgdGV4dHVyZSB3aWxsIGJlIHVuc3dpenpsZWQgZHVyaW5nIHRyYW5zY29kaW5nLlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pc0tUWDJdIC0gSW5kaWNhdGVzIHRoZSBpbWFnZSBpcyBLVFgyIGZvcm1hdC4gT3RoZXJ3aXNlXG4gKiBiYXNpcyBmb3JtYXQgaXMgYXNzdW1lZC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBiYXNpcyB3b3JrZXIgd2FzIGluaXRpYWxpemVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gKiBAaWdub3JlXG4gKi9cbmZ1bmN0aW9uIGJhc2lzVHJhbnNjb2RlKGRldmljZSwgdXJsLCBkYXRhLCBjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGJhc2lzSW5pdGlhbGl6ZSgpO1xuXG4gICAgaWYgKCFkZXZpY2VEZXRhaWxzKSB7XG4gICAgICAgIGRldmljZURldGFpbHMgPSB7XG4gICAgICAgICAgICB3ZWJnbDI6IGRldmljZS53ZWJnbDIsXG4gICAgICAgICAgICBmb3JtYXRzOiBnZXRDb21wcmVzc2lvbkZvcm1hdHMoZGV2aWNlKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHF1ZXVlLmVucXVldWVKb2IodXJsLCBkYXRhLCBjYWxsYmFjaywge1xuICAgICAgICBkZXZpY2VEZXRhaWxzOiBkZXZpY2VEZXRhaWxzLFxuICAgICAgICBpc0dHR1I6ICEhb3B0aW9ucz8uaXNHR0dSLFxuICAgICAgICBpc0tUWDI6ICEhb3B0aW9ucz8uaXNLVFgyXG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW5pdGlhbGl6aW5nO1xufVxuXG5leHBvcnQge1xuICAgIGJhc2lzSW5pdGlhbGl6ZSxcbiAgICBiYXNpc1RyYW5zY29kZVxufTtcbiJdLCJuYW1lcyI6WyJnZXRDb21wcmVzc2lvbkZvcm1hdHMiLCJkZXZpY2UiLCJhc3RjIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDIiwiYXRjIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMiLCJkeHQiLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJldGMxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxIiwiZXRjMiIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDIiwicHZyIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQyIsInByZXBhcmVXb3JrZXJNb2R1bGVzIiwiY29uZmlnIiwiY2FsbGJhY2siLCJnZXRXb3JrZXJCbG9iIiwiYmFzaXNDb2RlIiwiY29kZSIsIkJhc2lzV29ya2VyIiwidG9TdHJpbmciLCJqb2luIiwiQmxvYiIsInR5cGUiLCJ3YXNtU3VwcG9ydGVkIiwiV2ViQXNzZW1ibHkiLCJpbnN0YW50aWF0ZSIsIm1vZHVsZSIsIk1vZHVsZSIsIlVpbnQ4QXJyYXkiLCJvZiIsIkluc3RhbmNlIiwiZSIsInNlbmRSZXNwb25zZSIsIndvcmtlclVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsInJnYlByaW9yaXR5IiwicmdiYVByaW9yaXR5Iiwib3B0aW9ucyIsImNhY2hlIiwicmVzcG9uc2VUeXBlIiwicmV0cnkiLCJtYXhSZXRyaWVzIiwiZ2x1ZVVybCIsIndhc21VcmwiLCJodHRwIiwiZ2V0IiwiZXJyIiwicmVzcG9uc2UiLCJmZXRjaFByb21pc2UiLCJmZXRjaCIsImNvbXBpbGVNYW51YWwiLCJ0aGVuIiwicmVzdWx0IiwiYXJyYXlCdWZmZXIiLCJidWZmZXIiLCJjb21waWxlIiwibW9kdWxlXyIsImNhdGNoIiwiY29tcGlsZVN0cmVhbWluZyIsIkRlYnVnIiwid2FybiIsImZhbGxiYWNrVXJsIiwiQmFzaXNRdWV1ZSIsImNvbnN0cnVjdG9yIiwiY2FsbGJhY2tzIiwicXVldWUiLCJjbGllbnRzIiwiZW5xdWV1ZUpvYiIsInVybCIsImRhdGEiLCJoYXNPd25Qcm9wZXJ0eSIsInB1c2giLCJqb2IiLCJsZW5ndGgiLCJzaGlmdCIsInJ1biIsImVucXVldWVDbGllbnQiLCJjbGllbnQiLCJoYW5kbGVSZXNwb25zZSIsImkiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0I1NjUiLCJQSVhFTEZPUk1BVF9SR0JBNCIsImxldmVscyIsIm1hcCIsInYiLCJVaW50MTZBcnJheSIsIkJhc2lzQ2xpZW50IiwiZWFnZXIiLCJ3b3JrZXIiLCJXb3JrZXIiLCJhZGRFdmVudExpc3RlbmVyIiwibWVzc2FnZSIsInBvc3RNZXNzYWdlIiwidHJhbnNmZXIiLCJBcnJheUJ1ZmZlciIsImRlZmF1bHROdW1Xb3JrZXJzIiwiZGVmYXVsdFJnYlByaW9yaXR5IiwiZGVmYXVsdFJnYmFQcmlvcml0eSIsImRlZmF1bHRNYXhSZXRyaWVzIiwibGF6eUNvbmZpZyIsImluaXRpYWxpemluZyIsImJhc2lzSW5pdGlhbGl6ZSIsImxhenlJbml0IiwibW9kdWxlcyIsIndpbmRvdyIsIndhc21Nb2R1bGVzIiwiUFJFTE9BRF9NT0RVTEVTIiwid2FzbU1vZHVsZSIsImZpbmQiLCJtIiwibW9kdWxlTmFtZSIsInVybEJhc2UiLCJBU1NFVF9QUkVGSVgiLCJudW1Xb3JrZXJzIiwiTWF0aCIsIm1heCIsIm1pbiIsImVhZ2VyV29ya2VycyIsImNsaWVudENvbmZpZyIsImNvbnNvbGUiLCJlcnJvciIsImRldmljZURldGFpbHMiLCJiYXNpc1RyYW5zY29kZSIsIndlYmdsMiIsImZvcm1hdHMiLCJpc0dHR1IiLCJpc0tUWDIiXSwibWFwcGluZ3MiOiI7Ozs7O0FBS0E7QUFDQSxNQUFNQSxxQkFBcUIsR0FBSUMsTUFBTSxJQUFLO0VBQ3RDLE9BQU87QUFDSEMsSUFBQUEsSUFBSSxFQUFFLENBQUMsQ0FBQ0QsTUFBTSxDQUFDRSx3QkFBd0I7QUFDdkNDLElBQUFBLEdBQUcsRUFBRSxDQUFDLENBQUNILE1BQU0sQ0FBQ0ksdUJBQXVCO0FBQ3JDQyxJQUFBQSxHQUFHLEVBQUUsQ0FBQyxDQUFDTCxNQUFNLENBQUNNLHdCQUF3QjtBQUN0Q0MsSUFBQUEsSUFBSSxFQUFFLENBQUMsQ0FBQ1AsTUFBTSxDQUFDUSx3QkFBd0I7QUFDdkNDLElBQUFBLElBQUksRUFBRSxDQUFDLENBQUNULE1BQU0sQ0FBQ1UsdUJBQXVCO0FBQ3RDQyxJQUFBQSxHQUFHLEVBQUUsQ0FBQyxDQUFDWCxNQUFNLENBQUNZLHlCQUFBQTtHQUNqQixDQUFBO0FBQ0wsQ0FBQyxDQUFBOztBQUVEO0FBQ0EsTUFBTUMsb0JBQW9CLEdBQUdBLENBQUNDLE1BQU0sRUFBRUMsUUFBUSxLQUFLO0VBQy9DLE1BQU1DLGFBQWEsR0FBSUMsU0FBUyxJQUFLO0lBQ2pDLE1BQU1DLElBQUksR0FBRyxDQUNULGFBQWEsRUFDYkQsU0FBUyxFQUNULEVB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
