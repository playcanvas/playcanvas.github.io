class EventHandle {
  constructor(owner, name, fn) {
    this.owner = owner;
    this.name = name;
    this.fn = fn;
  }
  unbind() {
    if (!this.owner) return;
    this.owner.unbind(this.name, this.fn);
    this.owner = null;
    this.name = null;
    this.fn = null;
  }
  call() {
    if (!this.fn) return;
    this.fn.call(this.owner, arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6], arguments[7]);
  }
  on(name, fn) {
    return this.owner.on(name, fn);
  }
}

class Events {
  constructor() {
    Object.defineProperty(this, '_events', {
      enumerable: false,
      configurable: false,
      writable: true,
      value: {}
    });
    this._suspendEvents = false;
    this._additionalEmitters = [];
  }
  set suspendEvents(value) {
    this._suspendEvents = !!value;
  }
  get suspendEvents() {
    return this._suspendEvents;
  }
  on(name, fn) {
    const events = this._events[name];
    if (events === undefined) {
      this._events[name] = [fn];
    } else {
      if (events.indexOf(fn) === -1) events.push(fn);
    }
    return new EventHandle(this, name, fn);
  }
  once(name, fn) {
    const evt = this.on(name, (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) => {
      fn.call(this, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7);
      evt.unbind();
    });
    return evt;
  }
  emit(name, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
    if (this._suspendEvents) return this;
    let events = this._events[name];
    if (events && events.length) {
      events = events.slice(0);
      for (let i = 0; i < events.length; i++) {
        if (!events[i]) continue;
        try {
          events[i].call(this, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7);
        } catch (ex) {
          console.info('%c%s %c(event error)', 'color: #06f', name, 'color: #f00');
          console.log(ex.stack);
        }
      }
    }
    if (this._additionalEmitters.length) {
      const emitters = this._additionalEmitters.slice();
      emitters.forEach(emitter => {
        emitter.emit(name, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7);
      });
    }
    return this;
  }
  unbind(name, fn) {
    if (name) {
      const events = this._events[name];
      if (!events) return this;
      if (fn) {
        const i = events.indexOf(fn);
        if (i !== -1) {
          if (events.length === 1) {
            delete this._events[name];
          } else {
            events.splice(i, 1);
          }
        }
      } else {
        delete this._events[name];
      }
    } else {
      this._events = {};
    }
    return this;
  }
  addEmitter(emitter) {
    if (!this._additionalEmitters.includes(emitter)) {
      this._additionalEmitters.push(emitter);
    }
  }
  removeEmitter(emitter) {
    const idx = this._additionalEmitters.indexOf(emitter);
    if (idx !== -1) {
      this._additionalEmitters.splice(idx, 1);
    }
  }
}

const arrayEquals = (a, b) => {
  if (!a || !b) {
    return false;
  }
  const l = a.length;
  if (l !== b.length) {
    return false;
  }
  for (let i = 0; i < l; i++) {
    if (a[i] instanceof Array && b[i] instanceof Array) {
      if (!arrayEquals(a[i], b[i])) {
        return false;
      }
    } else if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
class Observer extends Events {
  constructor(data, options = {}) {
    super();
    this._destroyed = false;
    this._path = '';
    this._keys = [];
    this._data = {};
    this._pathsWithDuplicates = null;
    if (options.pathsWithDuplicates) {
      this._pathsWithDuplicates = {};
      for (let i = 0; i < options.pathsWithDuplicates.length; i++) {
        this._pathsWithDuplicates[options.pathsWithDuplicates[i]] = true;
      }
    }
    this.patch(data);
    this._parent = options.parent || null;
    this._parentPath = options.parentPath || '';
    this._parentField = options.parentField || null;
    this._parentKey = options.parentKey || null;
    this._latestFn = options.latestFn || null;
    this._silent = false;
    const propagate = function propagate(evt) {
      return function (path, arg1, arg2, arg3) {
        if (!this._parent) return;
        let key = this._parentKey;
        if (!key && this._parentField instanceof Array) {
          key = this._parentField.indexOf(this);
          if (key === -1) return;
        }
        path = this._parentPath + '.' + key + '.' + path;
        let state;
        if (this._silent) state = this._parent.silence();
        this._parent.emit(path + ':' + evt, arg1, arg2, arg3);
        this._parent.emit('*:' + evt, path, arg1, arg2, arg3);
        if (this._silent) this._parent.silenceRestore(state);
      };
    };
    this.on('*:set', propagate('set'));
    this.on('*:unset', propagate('unset'));
    this.on('*:insert', propagate('insert'));
    this.on('*:remove', propagate('remove'));
    this.on('*:move', propagate('move'));
  }
  static _splitPath(path) {
    const cache = Observer._splitPathsCache;
    let result = cache[path];
    if (!result) {
      result = path.split('.');
      cache[path] = result;
    } else {
      result = result.slice();
    }
    return result;
  }
  silence() {
    this._silent = true;
    const historyState = this.history && this.history.enabled;
    if (historyState) this.history.enabled = false;
    const syncState = this.sync && this.sync.enabled;
    if (syncState) this.sync.enabled = false;
    return [historyState, syncState];
  }
  silenceRestore(state) {
    this._silent = false;
    if (state[0]) this.history.enabled = true;
    if (state[1]) this.sync.enabled = true;
  }
  _prepare(target, key, value, silent, remote) {
    let i;
    let state;
    const path = (target._path ? target._path + '.' : '') + key;
    const type = typeof value;
    target._keys.push(key);
    if (type === 'object' && value instanceof Array) {
      target._data[key] = value.slice(0);
      for (i = 0; i < target._data[key].length; i++) {
        if (typeof target._data[key][i] === 'object' && target._data[key][i] !== null) {
          if (target._data[key][i] instanceof Array) {
            target._data[key][i].slice(0);
          } else {
            target._data[key][i] = new Observer(target._data[key][i], {
              parent: this,
              parentPath: path,
              parentField: target._data[key],
              parentKey: null
            });
          }
        } else {
          state = this.silence();
          this.emit(path + '.' + i + ':set', target._data[key][i], null, remote);
          this.emit('*:set', path + '.' + i, target._data[key][i], null, remote);
          this.silenceRestore(state);
        }
      }
      if (silent) state = this.silence();
      this.emit(path + ':set', target._data[key], null, remote);
      this.emit('*:set', path, target._data[key], null, remote);
      if (silent) this.silenceRestore(state);
    } else if (type === 'object' && value instanceof Object) {
      if (typeof target._data[key] !== 'object') {
        target._data[key] = {
          _path: path,
          _keys: [],
          _data: {}
        };
      }
      for (i in value) {
        if (typeof value[i] === 'object') {
          this._prepare(target._data[key], i, value[i], true, remote);
        } else {
          state = this.silence();
          target._data[key]._data[i] = value[i];
          target._data[key]._keys.push(i);
          this.emit(path + '.' + i + ':set', value[i], null, remote);
          this.emit('*:set', path + '.' + i, value[i], null, remote);
          this.silenceRestore(state);
        }
      }
      if (silent) state = this.silence();
      this.emit(path + ':set', value, undefined, remote);
      this.emit('*:set', path, value, undefined, remote);
      if (silent) this.silenceRestore(state);
    } else {
      if (silent) state = this.silence();
      target._data[key] = value;
      this.emit(path + ':set', value, undefined, remote);
      this.emit('*:set', path, value, undefined, remote);
      if (silent) this.silenceRestore(state);
    }
    return true;
  }
  set(path, value, silent, remote, force) {
    let i;
    let valueOld;
    let keys = Observer._splitPath(path);
    const length = keys.length;
    const key = keys[length - 1];
    let node = this;
    let nodePath = '';
    let obj = this;
    let state;
    for (i = 0; i < length - 1; i++) {
      if (node instanceof Array) {
        node = node[keys[i]];
        if (node instanceof Observer) {
          path = keys.slice(i + 1).join('.');
          obj = node;
        }
      } else {
        if (i < length && typeof node._data[keys[i]] !== 'object') {
          if (node._data[keys[i]]) obj.unset((node.__path ? node.__path + '.' : '') + keys[i]);
          node._data[keys[i]] = {
            _path: path,
            _keys: [],
            _data: {}
          };
          node._keys.push(keys[i]);
        }
        if (i === length - 1 && node.__path) nodePath = node.__path + '.' + keys[i];
        node = node._data[keys[i]];
      }
    }
    if (node instanceof Array) {
      const ind = parseInt(key, 10);
      if (node[ind] === value && !force) return false;
      valueOld = node[ind];
      if (valueOld instanceof Observer) {
        valueOld = valueOld.json();
      } else {
        valueOld = obj.json(valueOld);
      }
      node[ind] = value;
      if (value instanceof Observer) {
        value._parent = obj;
        value._parentPath = nodePath;
        value._parentField = node;
        value._parentKey = null;
      }
      if (silent) state = obj.silence();
      obj.emit(path + ':set', value, valueOld, remote);
      obj.emit('*:set', path, value, valueOld, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    } else if (node._data && !node._data.hasOwnProperty(key)) {
      if (typeof value === 'object') {
        return obj._prepare(node, key, value, false, remote);
      }
      node._data[key] = value;
      node._keys.push(key);
      if (silent) state = obj.silence();
      obj.emit(path + ':set', value, null, remote);
      obj.emit('*:set', path, value, null, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    }
    if (typeof value === 'object' && value instanceof Array) {
      if (arrayEquals(value, node._data[key]) && !force) return false;
      valueOld = node._data[key];
      if (!(valueOld instanceof Observer)) valueOld = obj.json(valueOld);
      if (node._data[key] && node._data[key].length === value.length) {
        state = obj.silence();
        if (value.length === 0) {
          node._data[key] = value;
        }
        for (i = 0; i < node._data[key].length; i++) {
          if (node._data[key][i] instanceof Observer) {
            node._data[key][i].patch(value[i], true);
          } else if (node._data[key][i] !== value[i]) {
            node._data[key][i] = value[i];
            obj.emit(path + '.' + i + ':set', node._data[key][i], valueOld && valueOld[i] || null, remote);
            obj.emit('*:set', path + '.' + i, node._data[key][i], valueOld && valueOld[i] || null, remote);
          }
        }
        obj.silenceRestore(state);
      } else {
        node._data[key] = [];
        value.forEach(val => {
          this._doInsert(node, key, val, undefined, true);
        });
        state = obj.silence();
        for (i = 0; i < node._data[key].length; i++) {
          obj.emit(path + '.' + i + ':set', node._data[key][i], valueOld && valueOld[i] || null, remote);
          obj.emit('*:set', path + '.' + i, node._data[key][i], valueOld && valueOld[i] || null, remote);
        }
        obj.silenceRestore(state);
      }
      if (silent) state = obj.silence();
      obj.emit(path + ':set', value, valueOld, remote);
      obj.emit('*:set', path, value, valueOld, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    } else if (typeof value === 'object' && value instanceof Object) {
      let changed = false;
      valueOld = node._data[key];
      if (!(valueOld instanceof Observer)) valueOld = obj.json(valueOld);
      keys = Object.keys(value);
      if (!node._data[key] || !node._data[key]._data) {
        if (node._data[key]) {
          obj.unset((node.__path ? node.__path + '.' : '') + key);
        } else {
          changed = true;
        }
        node._data[key] = {
          _path: path,
          _keys: [],
          _data: {}
        };
      }
      let c;
      for (const n in node._data[key]._data) {
        if (!value.hasOwnProperty(n)) {
          c = obj.unset(path + '.' + n, true);
          if (c) changed = true;
        } else if (node._data[key]._data.hasOwnProperty(n)) {
          if (!obj._equals(node._data[key]._data[n], value[n])) {
            c = obj.set(path + '.' + n, value[n], true);
            if (c) changed = true;
          }
        } else {
          c = obj._prepare(node._data[key], n, value[n], true, remote);
          if (c) changed = true;
        }
      }
      for (i = 0; i < keys.length; i++) {
        if (value[keys[i]] === undefined && node._data[key]._data.hasOwnProperty(keys[i])) {
          c = obj.unset(path + '.' + keys[i], true);
          if (c) changed = true;
        } else if (typeof value[keys[i]] === 'object') {
          if (node._data[key]._data.hasOwnProperty(keys[i])) {
            c = obj.set(path + '.' + keys[i], value[keys[i]], true);
            if (c) changed = true;
          } else {
            c = obj._prepare(node._data[key], keys[i], value[keys[i]], true, remote);
            if (c) changed = true;
          }
        } else if (!obj._equals(node._data[key]._data[keys[i]], value[keys[i]])) {
          if (typeof value[keys[i]] === 'object') {
            c = obj.set(node._data[key]._path + '.' + keys[i], value[keys[i]], true);
            if (c) changed = true;
          } else if (node._data[key]._data[keys[i]] !== value[keys[i]]) {
            changed = true;
            if (node._data[key]._keys.indexOf(keys[i]) === -1) node._data[key]._keys.push(keys[i]);
            node._data[key]._data[keys[i]] = value[keys[i]];
            state = obj.silence();
            obj.emit(node._data[key]._path + '.' + keys[i] + ':set', node._data[key]._data[keys[i]], null, remote);
            obj.emit('*:set', node._data[key]._path + '.' + keys[i], node._data[key]._data[keys[i]], null, remote);
            obj.silenceRestore(state);
          }
        }
      }
      if (changed) {
        if (silent) state = obj.silence();
        const val = obj.json(node._data[key]);
        obj.emit(node._data[key]._path + ':set', val, valueOld, remote);
        obj.emit('*:set', node._data[key]._path, val, valueOld, remote);
        if (silent) obj.silenceRestore(state);
        return true;
      }
      return false;
    }
    let data;
    if (!node.hasOwnProperty('_data') && node.hasOwnProperty(key)) {
      data = node;
    } else {
      data = node._data;
    }
    if (data[key] === value && !force) return false;
    if (silent) state = obj.silence();
    valueOld = data[key];
    if (!(valueOld instanceof Observer)) valueOld = obj.json(valueOld);
    data[key] = value;
    obj.emit(path + ':set', value, valueOld, remote);
    obj.emit('*:set', path, value, valueOld, remote);
    if (silent) obj.silenceRestore(state);
    return true;
  }
  has(path) {
    const keys = Observer._splitPath(path);
    let node = this;
    for (let i = 0, len = keys.length; i < len; i++) {
      if (node == undefined) return undefined;
      if (node._data) {
        node = node._data[keys[i]];
      } else {
        node = node[keys[i]];
      }
    }
    return node !== undefined;
  }
  get(path, raw) {
    const keys = Observer._splitPath(path);
    let node = this;
    for (let i = 0; i < keys.length; i++) {
      if (node == undefined) return undefined;
      if (node._data) {
        node = node._data[keys[i]];
      } else {
        node = node[keys[i]];
      }
    }
    if (raw) return node;
    if (node == null) {
      return null;
    }
    return this.json(node);
  }
  getRaw(path) {
    return this.get(path, true);
  }
  _equals(a, b) {
    if (a === b) {
      return true;
    } else if (a instanceof Array && b instanceof Array && arrayEquals(a, b)) {
      return true;
    }
    return false;
  }
  unset(path, silent, remote) {
    let i;
    const keys = Observer._splitPath(path);
    const key = keys[keys.length - 1];
    let node = this;
    let obj = this;
    for (i = 0; i < keys.length - 1; i++) {
      if (node instanceof Array) {
        node = node[keys[i]];
        if (node instanceof Observer) {
          path = keys.slice(i + 1).join('.');
          obj = node;
        }
      } else {
        node = node._data[keys[i]];
      }
    }
    if (!node._data || !node._data.hasOwnProperty(key)) return false;
    let valueOld = node._data[key];
    if (!(valueOld instanceof Observer)) valueOld = obj.json(valueOld);
    if (node._data[key] && node._data[key]._data) {
      for (i = node._data[key]._keys.length - 1; i >= 0; i--) {
        obj.unset(path + '.' + node._data[key]._keys[i], true);
      }
    }
    node._keys.splice(node._keys.indexOf(key), 1);
    delete node._data[key];
    let state;
    if (silent) state = obj.silence();
    obj.emit(path + ':unset', valueOld, remote);
    obj.emit('*:unset', path, valueOld, remote);
    if (silent) obj.silenceRestore(state);
    return true;
  }
  remove(path, ind, silent, remote) {
    const keys = Observer._splitPath(path);
    const key = keys[keys.length - 1];
    let node = this;
    let obj = this;
    for (let i = 0; i < keys.length - 1; i++) {
      if (node instanceof Array) {
        node = node[parseInt(keys[i], 10)];
        if (node instanceof Observer) {
          path = keys.slice(i + 1).join('.');
          obj = node;
        }
      } else if (node._data && node._data.hasOwnProperty(keys[i])) {
        node = node._data[keys[i]];
      } else {
        return false;
      }
    }
    if (!node._data || !node._data.hasOwnProperty(key) || !(node._data[key] instanceof Array)) return false;
    const arr = node._data[key];
    if (arr.length < ind) return false;
    let value = arr[ind];
    if (value instanceof Observer) {
      value._parent = null;
    } else {
      value = obj.json(value);
    }
    arr.splice(ind, 1);
    let state;
    if (silent) state = obj.silence();
    obj.emit(path + ':remove', value, ind, remote);
    obj.emit('*:remove', path, value, ind, remote);
    if (silent) obj.silenceRestore(state);
    return true;
  }
  removeValue(path, value, silent, remote) {
    const keys = Observer._splitPath(path);
    const key = keys[keys.length - 1];
    let node = this;
    let obj = this;
    for (let i = 0; i < keys.length - 1; i++) {
      if (node instanceof Array) {
        node = node[parseInt(keys[i], 10)];
        if (node instanceof Observer) {
          path = keys.slice(i + 1).join('.');
          obj = node;
        }
      } else if (node._data && node._data.hasOwnProperty(keys[i])) {
        node = node._data[keys[i]];
      } else {
        return;
      }
    }
    if (!node._data || !node._data.hasOwnProperty(key) || !(node._data[key] instanceof Array)) return;
    const arr = node._data[key];
    const ind = arr.indexOf(value);
    if (ind === -1) {
      return;
    }
    if (arr.length < ind) return;
    value = arr[ind];
    if (value instanceof Observer) {
      value._parent = null;
    } else {
      value = obj.json(value);
    }
    arr.splice(ind, 1);
    let state;
    if (silent) state = obj.silence();
    obj.emit(path + ':remove', value, ind, remote);
    obj.emit('*:remove', path, value, ind, remote);
    if (silent) obj.silenceRestore(state);
    return true;
  }
  insert(path, value, ind, silent, remote) {
    const keys = Observer._splitPath(path);
    const key = keys[keys.length - 1];
    let node = this;
    let obj = this;
    for (let i = 0; i < keys.length - 1; i++) {
      if (node instanceof Array) {
        node = node[parseInt(keys[i], 10)];
        if (node instanceof Observer) {
          path = keys.slice(i + 1).join('.');
          obj = node;
        }
      } else if (node._data && node._data.hasOwnProperty(keys[i])) {
        node = node._data[keys[i]];
      } else {
        return;
      }
    }
    if (!node._data || !node._data.hasOwnProperty(key) || !(node._data[key] instanceof Array)) return;
    const arr = node._data[key];
    value = obj._doInsert(node, key, value, ind);
    if (ind === undefined) {
      ind = arr.length - 1;
    }
    let state;
    if (silent) state = obj.silence();
    obj.emit(path + ':insert', value, ind, remote);
    obj.emit('*:insert', path, value, ind, remote);
    if (silent) obj.silenceRestore(state);
    return true;
  }
  _doInsert(node, key, value, ind, allowDuplicates) {
    const arr = node._data[key];
    if (typeof value === 'object' && !(value instanceof Observer) && value !== null) {
      if (value instanceof Array) {
        value = value.slice(0);
      } else {
        value = new Observer(value);
      }
    }
    const path = node._path ? `${node._path}.${key}` : key;
    if (value !== null && !allowDuplicates && (!this._pathsWithDuplicates || !this._pathsWithDuplicates[path])) {
      if (arr.indexOf(value) !== -1) {
        return;
      }
    }
    if (ind === undefined) {
      arr.push(value);
    } else {
      arr.splice(ind, 0, value);
    }
    if (value instanceof Observer) {
      value._parent = this;
      value._parentPath = path;
      value._parentField = arr;
      value._parentKey = null;
    } else {
      value = this.json(value);
    }
    return value;
  }
  move(path, indOld, indNew, silent, remote) {
    const keys = Observer._splitPath(path);
    const key = keys[keys.length - 1];
    let node = this;
    let obj = this;
    for (let i = 0; i < keys.length - 1; i++) {
      if (node instanceof Array) {
        node = node[parseInt(keys[i], 10)];
        if (node instanceof Observer) {
          path = keys.slice(i + 1).join('.');
          obj = node;
        }
      } else if (node._data && node._data.hasOwnProperty(keys[i])) {
        node = node._data[keys[i]];
      } else {
        return;
      }
    }
    if (!node._data || !node._data.hasOwnProperty(key) || !(node._data[key] instanceof Array)) return;
    const arr = node._data[key];
    if (arr.length < indOld || arr.length < indNew || indOld === indNew) return;
    let value = arr[indOld];
    arr.splice(indOld, 1);
    if (indNew === -1) indNew = arr.length;
    arr.splice(indNew, 0, value);
    if (!(value instanceof Observer)) value = obj.json(value);
    let state;
    if (silent) state = obj.silence();
    obj.emit(path + ':move', value, indNew, indOld, remote);
    obj.emit('*:move', path, value, indNew, indOld, remote);
    if (silent) obj.silenceRestore(state);
    return true;
  }
  patch(data, removeMissingKeys) {
    if (typeof data !== 'object') return;
    for (const key in data) {
      if (typeof data[key] === 'object' && !this._data.hasOwnProperty(key)) {
        this._prepare(this, key, data[key]);
      } else if (this._data[key] !== data[key]) {
        this.set(key, data[key]);
      }
    }
    if (removeMissingKeys) {
      for (const key in this._data) {
        if (!data.hasOwnProperty(key)) {
          this.unset(key);
        }
      }
    }
  }
  json(target) {
    let key, n;
    let obj = {};
    const node = target === undefined ? this : target;
    let len, nlen;
    if (node instanceof Object && node._keys) {
      len = node._keys.length;
      for (let i = 0; i < len; i++) {
        key = node._keys[i];
        const value = node._data[key];
        const type = typeof value;
        if (type === 'object' && value instanceof Array) {
          obj[key] = value.slice(0);
          nlen = obj[key].length;
          for (n = 0; n < nlen; n++) {
            if (typeof obj[key][n] === 'object') obj[key][n] = this.json(obj[key][n]);
          }
        } else if (type === 'object' && value instanceof Object) {
          obj[key] = this.json(value);
        } else {
          obj[key] = value;
        }
      }
    } else {
      if (node === null) {
        return null;
      } else if (typeof node === 'object' && node instanceof Array) {
        obj = node.slice(0);
        len = obj.length;
        for (n = 0; n < len; n++) {
          obj[n] = this.json(obj[n]);
        }
      } else if (typeof node === 'object') {
        for (key in node) {
          if (node.hasOwnProperty(key)) obj[key] = node[key];
        }
      } else {
        obj = node;
      }
    }
    return obj;
  }
  forEach(fn, target, path = '') {
    const node = target || this;
    for (let i = 0; i < node._keys.length; i++) {
      const key = node._keys[i];
      const value = node._data[key];
      const type = this.schema && this.schema.has(path + key) && this.schema.get(path + key).type.name.toLowerCase() || typeof value;
      if (type === 'object' && value instanceof Array) {
        fn(path + key, 'array', value, key);
      } else if (type === 'object' && value instanceof Object) {
        fn(path + key, 'object', value, key);
        this.forEach(fn, value, path + key + '.');
      } else {
        fn(path + key, type, value, key);
      }
    }
  }
  latest() {
    return this._latestFn ? this._latestFn() : this;
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.emit('destroy');
    this.unbind();
  }
  set latestFn(value) {
    this._latestFn = value;
  }
  get latestFn() {
    return this._latestFn;
  }
}
Observer._splitPathsCache = {};

class ObserverList extends Events {
  constructor(options = {}) {
    super();
    this.data = [];
    this._indexed = {};
    this.sorted = options.sorted || null;
    this.index = options.index || null;
  }
  get length() {
    return this.data.length;
  }
  get(index) {
    if (this.index) {
      return this._indexed[index] || null;
    }
    return this.data[index] || null;
  }
  set(index, value) {
    if (this.index) {
      this._indexed[index] = value;
    } else {
      this.data[index] = value;
    }
  }
  indexOf(item) {
    if (this.index) {
      const index = item instanceof Observer && item.get(this.index) || item[this.index];
      return this._indexed[index] && index || null;
    }
    const ind = this.data.indexOf(item);
    return ind !== -1 ? ind : null;
  }
  position(b, fn) {
    const l = this.data;
    let min = 0;
    let max = l.length - 1;
    let cur;
    let a, i;
    fn = fn || this.sorted;
    while (min <= max) {
      cur = Math.floor((min + max) / 2);
      a = l[cur];
      i = fn(a, b);
      if (i === 1) {
        max = cur - 1;
      } else if (i === -1) {
        min = cur + 1;
      } else {
        return cur;
      }
    }
    return -1;
  }
  positionNextClosest(b, fn) {
    const l = this.data;
    let min = 0;
    let max = l.length - 1;
    let cur;
    let a, i;
    fn = fn || this.sorted;
    if (l.length === 0) return -1;
    if (fn(l[0], b) === 0) return 0;
    while (min <= max) {
      cur = Math.floor((min + max) / 2);
      a = l[cur];
      i = fn(a, b);
      if (i === 1) {
        max = cur - 1;
      } else if (i === -1) {
        min = cur + 1;
      } else {
        return cur;
      }
    }
    if (fn(a, b) === 1) return cur;
    if (cur + 1 === l.length) return -1;
    return cur + 1;
  }
  has(item) {
    if (this.index) {
      const index = item instanceof Observer && item.get(this.index) || item[this.index];
      return !!this._indexed[index];
    }
    return this.data.indexOf(item) !== -1;
  }
  add(item) {
    if (this.has(item)) return null;
    let index = this.data.length;
    if (this.index) {
      index = item instanceof Observer && item.get(this.index) || item[this.index];
      this._indexed[index] = item;
    }
    let pos = 0;
    if (this.sorted) {
      pos = this.positionNextClosest(item);
      if (pos !== -1) {
        this.data.splice(pos, 0, item);
      } else {
        this.data.push(item);
      }
    } else {
      this.data.push(item);
      pos = this.data.length - 1;
    }
    this.emit('add', item, index, pos);
    if (this.index) {
      const id = item.get(this.index);
      if (id) {
        this.emit(`add[${id}]`, item, index, pos);
      }
    }
    return pos;
  }
  move(item, pos) {
    const ind = this.data.indexOf(item);
    this.data.splice(ind, 1);
    if (pos === -1) {
      this.data.push(item);
    } else {
      this.data.splice(pos, 0, item);
    }
    this.emit('move', item, pos);
  }
  remove(item) {
    if (!this.has(item)) return;
    const ind = this.data.indexOf(item);
    let index = ind;
    if (this.index) {
      index = item instanceof Observer && item.get(this.index) || item[this.index];
      delete this._indexed[index];
    }
    this.data.splice(ind, 1);
    this.emit('remove', item, index);
  }
  removeByKey(index) {
    let item;
    if (this.index) {
      item = this._indexed[index];
      if (!item) return;
      const ind = this.data.indexOf(item);
      this.data.splice(ind, 1);
      delete this._indexed[index];
      this.emit('remove', item, ind);
    } else {
      if (this.data.length < index) return;
      item = this.data[index];
      this.data.splice(index, 1);
      this.emit('remove', item, index);
    }
  }
  removeBy(fn) {
    let i = this.data.length;
    while (i--) {
      if (!fn(this.data[i])) continue;
      if (this.index) {
        delete this._indexed[this.data[i][this.index]];
      }
      this.data.splice(i, 1);
      this.emit('remove', this.data[i], i);
    }
  }
  clear() {
    const items = this.data.slice(0);
    this.data = [];
    this._indexed = {};
    let i = items.length;
    while (i--) {
      this.emit('remove', items[i], i);
    }
  }
  forEach(fn) {
    for (let i = 0; i < this.data.length; i++) {
      fn(this.data[i], this.index && this.data[i][this.index] || i);
    }
  }
  find(fn) {
    const items = [];
    for (let i = 0; i < this.data.length; i++) {
      if (!fn(this.data[i])) continue;
      let index = i;
      if (this.index) index = this.data[i][this.index];
      items.push([index, this.data[i]]);
    }
    return items;
  }
  findOne(fn) {
    for (let i = 0; i < this.data.length; i++) {
      if (!fn(this.data[i])) continue;
      let index = i;
      if (this.index) index = this.data[i][this.index];
      return [index, this.data[i]];
    }
    return null;
  }
  map(fn) {
    return this.data.map(fn);
  }
  sort(fn) {
    this.data.sort(fn);
  }
  array() {
    return this.data.slice(0);
  }
  json() {
    const items = this.array();
    for (let i = 0; i < items.length; i++) {
      if (items[i] instanceof Observer) {
        items[i] = items[i].json();
      }
    }
    return items;
  }
}

class History extends Events {
  constructor() {
    super();
    this._executing = 0;
    this._actions = [];
    this._currentActionIndex = -1;
    this._canUndo = false;
    this._canRedo = false;
  }
  add(action) {
    if (!action.name) {
      console.error('Trying to add history action without name');
      return false;
    }
    if (!action.undo) {
      console.error('Trying to add history action without undo method', action.name);
      return false;
    }
    if (!action.redo) {
      console.error('Trying to add history action without redo method', action.name);
      return false;
    }
    if (this._currentActionIndex !== this._actions.length - 1) {
      this._actions = this._actions.slice(0, this._currentActionIndex + 1);
    }
    if (action.combine && this.currentAction && this.currentAction.name === action.name) {
      this.currentAction.redo = action.redo;
    } else {
      const length = this._actions.push(action);
      this._currentActionIndex = length - 1;
    }
    this.emit('add', action.name);
    this.canUndo = true;
    this.canRedo = false;
    return true;
  }
  async addAndExecute(action) {
    if (this.add(action)) {
      try {
        this.executing++;
        await action.redo();
      } finally {
        this.executing--;
      }
    }
  }
  async undo() {
    if (!this.canUndo) return;
    const name = this.currentAction.name;
    const undo = this.currentAction.undo;
    this._currentActionIndex--;
    this.emit('undo', name);
    if (this._currentActionIndex < 0) {
      this.canUndo = false;
    }
    this.canRedo = true;
    try {
      this.executing++;
      await undo();
    } catch (ex) {
      console.info('%c(pcui.History#undo)', 'color: #f00');
      console.log(ex.stack);
    } finally {
      this.executing--;
    }
  }
  async redo() {
    if (!this.canRedo) return;
    this._currentActionIndex++;
    const redo = this.currentAction.redo;
    this.emit('redo', this.currentAction.name);
    this.canUndo = true;
    if (this._currentActionIndex === this._actions.length - 1) {
      this.canRedo = false;
    }
    try {
      this.executing++;
      await redo();
    } catch (ex) {
      console.info('%c(pcui.History#redo)', 'color: #f00');
      console.log(ex.stack);
    } finally {
      this.executing--;
    }
  }
  clear() {
    if (!this._actions.length) return;
    this._actions.length = 0;
    this._currentActionIndex = -1;
    this.canUndo = false;
    this.canRedo = false;
  }
  get currentAction() {
    return this._actions[this._currentActionIndex] || null;
  }
  get lastAction() {
    return this._actions[this._actions.length - 1] || null;
  }
  set canUndo(value) {
    if (this._canUndo === value) return;
    this._canUndo = value;
    if (!this.executing) {
      this.emit('canUndo', value);
    }
  }
  get canUndo() {
    return this._canUndo && !this.executing;
  }
  set canRedo(value) {
    if (this._canRedo === value) return;
    this._canRedo = value;
    if (!this.executing) {
      this.emit('canRedo', value);
    }
  }
  get canRedo() {
    return this._canRedo && !this.executing;
  }
  set executing(value) {
    if (this._executing === value) return;
    this._executing = value;
    if (this._executing) {
      this.emit('canUndo', false);
      this.emit('canRedo', false);
    } else {
      this.emit('canUndo', this._canUndo);
      this.emit('canRedo', this._canRedo);
    }
  }
  get executing() {
    return this._executing;
  }
}

class ObserverHistory extends Events {
  constructor(args = {}) {
    super();
    this.item = args.item;
    this._history = args.history;
    this._enabled = args.enabled || true;
    this._prefix = args.prefix || '';
    this._combine = args.combine || false;
    this._events = [];
    this._initialize();
  }
  _initialize() {
    this._events.push(this.item.on('*:set', (path, value, valueOld) => {
      if (!this._enabled || !this._history) return;
      if (value instanceof Observer) value = value.json();
      const action = {
        name: this._prefix + path,
        combine: this._combine,
        undo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          if (valueOld === undefined) {
            item.unset(path);
          } else {
            item.set(path, valueOld);
          }
          item.history.enabled = true;
        },
        redo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          if (value === undefined) {
            item.unset(path);
          } else {
            item.set(path, value);
          }
          item.history.enabled = true;
        }
      };
      this._history.add(action);
    }));
    this._events.push(this.item.on('*:unset', (path, valueOld) => {
      if (!this._enabled || !this._history) return;
      const action = {
        name: this._prefix + path,
        combine: this._combine,
        undo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.set(path, valueOld);
          item.history.enabled = true;
        },
        redo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.unset(path);
          item.history.enabled = true;
        }
      };
      this._history.add(action);
    }));
    this._events.push(this.item.on('*:insert', (path, value, ind) => {
      if (!this._enabled || !this._history) return;
      const action = {
        name: this._prefix + path,
        combine: this._combine,
        undo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.removeValue(path, value);
          item.history.enabled = true;
        },
        redo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.insert(path, value, ind);
          item.history.enabled = true;
        }
      };
      this._history.add(action);
    }));
    this._events.push(this.item.on('*:remove', (path, value, ind) => {
      if (!this._enabled || !this._history) return;
      const action = {
        name: this._prefix + path,
        combine: this._combine,
        undo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.insert(path, value, ind);
          item.history.enabled = true;
        },
        redo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.removeValue(path, value);
          item.history.enabled = true;
        }
      };
      this._history.add(action);
    }));
    this._events.push(this.item.on('*:move', (path, value, ind, indOld) => {
      if (!this._enabled || !this._history) return;
      const action = {
        name: this._prefix + path,
        combine: this._combine,
        undo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.move(path, ind, indOld);
          item.history.enabled = true;
        },
        redo: () => {
          const item = this.item.latest();
          if (!item) return;
          item.history.enabled = false;
          item.move(path, indOld, ind);
          item.history.enabled = true;
        }
      };
      this._history.add(action);
    }));
  }
  destroy() {
    this._events.forEach(evt => {
      evt.unbind();
    });
    this._events.length = 0;
    this.item = null;
  }
  set enabled(value) {
    this._enabled = !!value;
  }
  get enabled() {
    return this._enabled;
  }
  set prefix(value) {
    this._prefix = value || '';
  }
  get prefix() {
    return this._prefix;
  }
  set combine(value) {
    this._combine = !!value;
  }
  get combine() {
    return this._combine;
  }
}

export { Events, History, Observer, ObserverHistory, ObserverList };
