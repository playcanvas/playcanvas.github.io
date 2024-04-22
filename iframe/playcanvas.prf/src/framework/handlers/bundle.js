import { Bundle } from '../bundle/bundle.js';
import { Untar } from './untar.js';
import { ResourceHandler } from './handler.js';

class BundleHandler extends ResourceHandler {
  constructor(app) {
    super(app, 'bundle');
    this._assets = app.assets;
  }
  _fetchRetries(url, options, retries = 0) {
    return new Promise((resolve, reject) => {
      const tryFetch = () => {
        fetch(url, options).then(resolve).catch(err => {
          retries++;
          if (retries < this.maxRetries) {
            tryFetch();
          } else {
            reject(err);
          }
        });
      };
      tryFetch();
    });
  }
  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    this._fetchRetries(url.load, {
      mode: 'cors',
      credentials: 'include'
    }, this.maxRetries).then(res => {
      const bundle = new Bundle();
      callback(null, bundle);
      const untar = new Untar(res, this._assets.prefix);
      untar.on('file', file => {
        bundle.addFile(file.name, file.data);
      });
      untar.on('done', () => {
        bundle.loaded = true;
      });
      untar.on('error', err => {
        callback(err);
      });
    }).catch(err => {
      callback(err);
    });
  }
  open(url, bundle) {
    return bundle;
  }
}

export { BundleHandler };
