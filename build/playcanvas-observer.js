(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.observer = {}));
})(this, (function (exports) { 'use strict';

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;

    _setPrototypeOf(subClass, superClass);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf(o, p);
  }

  var EventHandle = function () {
    function EventHandle(owner, name, fn) {
      this.owner = owner;
      this.name = name;
      this.fn = fn;
    }

    var _proto = EventHandle.prototype;

    _proto.unbind = function unbind() {
      if (!this.owner) return;
      this.owner.unbind(this.name, this.fn);
      this.owner = null;
      this.name = null;
      this.fn = null;
    };

    _proto.call = function call() {
      if (!this.fn) return;
      this.fn.call(this.owner, arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6], arguments[7]);
    };

    _proto.on = function on(name, fn) {
      return this.owner.on(name, fn);
    };

    return EventHandle;
  }();

  var Events = function () {
    function Events() {
      Object.defineProperty(this, '_events', {
        enumerable: false,
        configurable: false,
        writable: true,
        value: {}
      });
      this._suspendEvents = false;
      this._additionalEmitters = [];
    }

    var _proto = Events.prototype;

    _proto.on = function on(name, fn) {
      var events = this._events[name];

      if (events === undefined) {
        this._events[name] = [fn];
      } else {
        if (events.indexOf(fn) === -1) events.push(fn);
      }

      return new EventHandle(this, name, fn);
    };

    _proto.once = function once(name, fn) {
      var _this = this;

      var evt = this.on(name, function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
        fn.call(_this, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7);
        evt.unbind();
      });
      return evt;
    };

    _proto.emit = function emit(name, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
      if (this._suspendEvents) return;
      var events = this._events[name];

      if (events && events.length) {
        events = events.slice(0);

        for (var i = 0; i < events.length; i++) {
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
        var emitters = this._additionalEmitters.slice();

        emitters.forEach(function (emitter) {
          emitter.emit(name, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7);
        });
      }

      return this;
    };

    _proto.unbind = function unbind(name, fn) {
      if (name) {
        var events = this._events[name];
        if (!events) return this;

        if (fn) {
          var i = events.indexOf(fn);

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
    };

    _proto.addEmitter = function addEmitter(emitter) {
      if (!this._additionalEmitters.includes(emitter)) {
        this._additionalEmitters.push(emitter);
      }
    };

    _proto.removeEmitter = function removeEmitter(emitter) {
      var idx = this._additionalEmitters.indexOf(emitter);

      if (idx !== -1) {
        this._additionalEmitters.splice(idx, 1);
      }
    };

    _createClass(Events, [{
      key: "suspendEvents",
      get: function get() {
        return this._suspendEvents;
      },
      set: function set(value) {
        this._suspendEvents = !!value;
      }
    }]);

    return Events;
  }();

  var Observer = function (_Events) {
    _inheritsLoose(Observer, _Events);

    function Observer(data, options) {
      var _this;

      if (options === void 0) {
        options = {};
      }

      _this = _Events.call(this) || this;
      _this._destroyed = false;
      _this._path = '';
      _this._keys = [];
      _this._data = {};
      _this._pathsWithDuplicates = null;

      if (options.pathsWithDuplicates) {
        _this._pathsWithDuplicates = {};

        for (var i = 0; i < options.pathsWithDuplicates.length; i++) {
          _this._pathsWithDuplicates[options.pathsWithDuplicates[i]] = true;
        }
      }

      _this.patch(data);

      _this._parent = options.parent || null;
      _this._parentPath = options.parentPath || '';
      _this._parentField = options.parentField || null;
      _this._parentKey = options.parentKey || null;
      _this._latestFn = options.latestFn || null;
      _this._silent = false;

      var propagate = function propagate(evt) {
        return function (path, arg1, arg2, arg3) {
          if (!this._parent) return;
          var key = this._parentKey;

          if (!key && this._parentField instanceof Array) {
            key = this._parentField.indexOf(this);
            if (key === -1) return;
          }

          path = this._parentPath + '.' + key + '.' + path;
          var state;
          if (this._silent) state = this._parent.silence();

          this._parent.emit(path + ':' + evt, arg1, arg2, arg3);

          this._parent.emit('*:' + evt, path, arg1, arg2, arg3);

          if (this._silent) this._parent.silenceRestore(state);
        };
      };

      _this.on('*:set', propagate('set'));

      _this.on('*:unset', propagate('unset'));

      _this.on('*:insert', propagate('insert'));

      _this.on('*:remove', propagate('remove'));

      _this.on('*:move', propagate('move'));

      return _this;
    }

    Observer._splitPath = function _splitPath(path) {
      var cache = Observer._splitPathsCache;
      var result = cache[path];

      if (!result) {
        result = path.split('.');
        cache[path] = result;
      } else {
        result = result.slice();
      }

      return result;
    };

    var _proto = Observer.prototype;

    _proto.silence = function silence() {
      this._silent = true;
      var historyState = this.history && this.history.enabled;
      if (historyState) this.history.enabled = false;
      var syncState = this.sync && this.sync.enabled;
      if (syncState) this.sync.enabled = false;
      return [historyState, syncState];
    };

    _proto.silenceRestore = function silenceRestore(state) {
      this._silent = false;
      if (state[0]) this.history.enabled = true;
      if (state[1]) this.sync.enabled = true;
    };

    _proto._prepare = function _prepare(target, key, value, silent, remote) {
      var i;
      var state;
      var path = (target._path ? target._path + '.' : '') + key;
      var type = typeof value;

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
    };

    _proto.set = function set(path, value, silent, remote, force) {
      var _this2 = this;

      var i;
      var valueOld;

      var keys = Observer._splitPath(path);

      var length = keys.length;
      var key = keys[length - 1];
      var node = this;
      var nodePath = '';
      var obj = this;
      var state;

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
        var ind = parseInt(key, 10);
        if (node[ind] === value && !force) return;
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
        if (value.equals(node._data[key]) && !force) return false;
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
          value.forEach(function (val) {
            _this2._doInsert(node, key, val, undefined, true);
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
        var changed = false;
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

        var c;

        for (var n in node._data[key]._data) {
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
          var val = obj.json(node._data[key]);
          obj.emit(node._data[key]._path + ':set', val, valueOld, remote);
          obj.emit('*:set', node._data[key]._path, val, valueOld, remote);
          if (silent) obj.silenceRestore(state);
          return true;
        }

        return false;
      }

      var data;

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
    };

    _proto.has = function has(path) {
      var keys = Observer._splitPath(path);

      var node = this;

      for (var i = 0, len = keys.length; i < len; i++) {
        if (node == undefined) return undefined;

        if (node._data) {
          node = node._data[keys[i]];
        } else {
          node = node[keys[i]];
        }
      }

      return node !== undefined;
    };

    _proto.get = function get(path, raw) {
      var keys = Observer._splitPath(path);

      var node = this;

      for (var i = 0; i < keys.length; i++) {
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
    };

    _proto.getRaw = function getRaw(path) {
      return this.get(path, true);
    };

    _proto._equals = function _equals(a, b) {
      if (a === b) {
        return true;
      } else if (a instanceof Array && b instanceof Array && a.equals(b)) {
        return true;
      }

      return false;
    };

    _proto.unset = function unset(path, silent, remote) {
      var i;

      var keys = Observer._splitPath(path);

      var key = keys[keys.length - 1];
      var node = this;
      var obj = this;

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
      var valueOld = node._data[key];
      if (!(valueOld instanceof Observer)) valueOld = obj.json(valueOld);

      if (node._data[key] && node._data[key]._data) {
        for (i = node._data[key]._keys.length - 1; i >= 0; i--) {
          obj.unset(path + '.' + node._data[key]._keys[i], true);
        }
      }

      node._keys.splice(node._keys.indexOf(key), 1);

      delete node._data[key];
      var state;
      if (silent) state = obj.silence();
      obj.emit(path + ':unset', valueOld, remote);
      obj.emit('*:unset', path, valueOld, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    };

    _proto.remove = function remove(path, ind, silent, remote) {
      var keys = Observer._splitPath(path);

      var key = keys[keys.length - 1];
      var node = this;
      var obj = this;

      for (var i = 0; i < keys.length - 1; i++) {
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
      var arr = node._data[key];
      if (arr.length < ind) return;
      var value = arr[ind];

      if (value instanceof Observer) {
        value._parent = null;
      } else {
        value = obj.json(value);
      }

      arr.splice(ind, 1);
      var state;
      if (silent) state = obj.silence();
      obj.emit(path + ':remove', value, ind, remote);
      obj.emit('*:remove', path, value, ind, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    };

    _proto.removeValue = function removeValue(path, value, silent, remote) {
      var keys = Observer._splitPath(path);

      var key = keys[keys.length - 1];
      var node = this;
      var obj = this;

      for (var i = 0; i < keys.length - 1; i++) {
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
      var arr = node._data[key];
      var ind = arr.indexOf(value);

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
      var state;
      if (silent) state = obj.silence();
      obj.emit(path + ':remove', value, ind, remote);
      obj.emit('*:remove', path, value, ind, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    };

    _proto.insert = function insert(path, value, ind, silent, remote) {
      var keys = Observer._splitPath(path);

      var key = keys[keys.length - 1];
      var node = this;
      var obj = this;

      for (var i = 0; i < keys.length - 1; i++) {
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
      var arr = node._data[key];
      value = obj._doInsert(node, key, value, ind);

      if (ind === undefined) {
        ind = arr.length - 1;
      }

      var state;
      if (silent) state = obj.silence();
      obj.emit(path + ':insert', value, ind, remote);
      obj.emit('*:insert', path, value, ind, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    };

    _proto._doInsert = function _doInsert(node, key, value, ind, allowDuplicates) {
      var arr = node._data[key];

      if (typeof value === 'object' && !(value instanceof Observer) && value !== null) {
        if (value instanceof Array) {
          value = value.slice(0);
        } else {
          value = new Observer(value);
        }
      }

      var path = node._path ? node._path + "." + key : key;

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
    };

    _proto.move = function move(path, indOld, indNew, silent, remote) {
      var keys = Observer._splitPath(path);

      var key = keys[keys.length - 1];
      var node = this;
      var obj = this;

      for (var i = 0; i < keys.length - 1; i++) {
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
      var arr = node._data[key];
      if (arr.length < indOld || arr.length < indNew || indOld === indNew) return;
      var value = arr[indOld];
      arr.splice(indOld, 1);
      if (indNew === -1) indNew = arr.length;
      arr.splice(indNew, 0, value);
      if (!(value instanceof Observer)) value = obj.json(value);
      var state;
      if (silent) state = obj.silence();
      obj.emit(path + ':move', value, indNew, indOld, remote);
      obj.emit('*:move', path, value, indNew, indOld, remote);
      if (silent) obj.silenceRestore(state);
      return true;
    };

    _proto.patch = function patch(data, removeMissingKeys) {
      if (typeof data !== 'object') return;

      for (var key in data) {
        if (typeof data[key] === 'object' && !this._data.hasOwnProperty(key)) {
          this._prepare(this, key, data[key]);
        } else if (this._data[key] !== data[key]) {
          this.set(key, data[key]);
        }
      }

      if (removeMissingKeys) {
        for (var _key in this._data) {
          if (!data.hasOwnProperty(_key)) {
            this.unset(_key);
          }
        }
      }
    };

    _proto.json = function json(target) {
      var key, n;
      var obj = {};
      var node = target === undefined ? this : target;
      var len, nlen;

      if (node instanceof Object && node._keys) {
        len = node._keys.length;

        for (var i = 0; i < len; i++) {
          key = node._keys[i];
          var value = node._data[key];
          var type = typeof value;

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
    };

    _proto.forEach = function forEach(fn, target, path) {
      if (path === void 0) {
        path = '';
      }

      var node = target || this;

      for (var i = 0; i < node._keys.length; i++) {
        var key = node._keys[i];
        var value = node._data[key];
        var type = this.schema && this.schema.has(path + key) && this.schema.get(path + key).type.name.toLowerCase() || typeof value;

        if (type === 'object' && value instanceof Array) {
          fn(path + key, 'array', value, key);
        } else if (type === 'object' && value instanceof Object) {
          fn(path + key, 'object', value, key);
          this.forEach(fn, value, path + key + '.');
        } else {
          fn(path + key, type, value, key);
        }
      }
    };

    _proto.latest = function latest() {
      return this._latestFn ? this._latestFn() : this;
    };

    _proto.destroy = function destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      this.emit('destroy');
      this.unbind();
    };

    _createClass(Observer, [{
      key: "latestFn",
      get: function get() {
        return this._latestFn;
      },
      set: function set(value) {
        this._latestFn = value;
      }
    }]);

    return Observer;
  }(Events);

  Observer._splitPathsCache = {};

  var ObserverList = function (_Events) {
    _inheritsLoose(ObserverList, _Events);

    function ObserverList(options) {
      var _this;

      if (options === void 0) {
        options = {};
      }

      _this = _Events.call(this) || this;
      _this.data = [];
      _this._indexed = {};
      _this.sorted = options.sorted || null;
      _this.index = options.index || null;
      return _this;
    }

    var _proto = ObserverList.prototype;

    _proto.get = function get(index) {
      if (this.index) {
        return this._indexed[index] || null;
      }

      return this.data[index] || null;
    };

    _proto.set = function set(index, value) {
      if (this.index) {
        this._indexed[index] = value;
      } else {
        this.data[index] = value;
      }
    };

    _proto.indexOf = function indexOf(item) {
      if (this.index) {
        var index = item instanceof Observer && item.get(this.index) || item[this.index];
        return this._indexed[index] && index || null;
      }

      var ind = this.data.indexOf(item);
      return ind !== -1 ? ind : null;
    };

    _proto.position = function position(b, fn) {
      var l = this.data;
      var min = 0;
      var max = l.length - 1;
      var cur;
      var a, i;
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
    };

    _proto.positionNextClosest = function positionNextClosest(b, fn) {
      var l = this.data;
      var min = 0;
      var max = l.length - 1;
      var cur;
      var a, i;
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
    };

    _proto.has = function has(item) {
      if (this.index) {
        var index = item instanceof Observer && item.get(this.index) || item[this.index];
        return !!this._indexed[index];
      }

      return this.data.indexOf(item) !== -1;
    };

    _proto.add = function add(item) {
      if (this.has(item)) return null;
      var index = this.data.length;

      if (this.index) {
        index = item instanceof Observer && item.get(this.index) || item[this.index];
        this._indexed[index] = item;
      }

      var pos = 0;

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
        var id = item.get(this.index);

        if (id) {
          this.emit("add[" + id + "]", item, index, pos);
        }
      }

      return pos;
    };

    _proto.move = function move(item, pos) {
      var ind = this.data.indexOf(item);
      this.data.splice(ind, 1);

      if (pos === -1) {
        this.data.push(item);
      } else {
        this.data.splice(pos, 0, item);
      }

      this.emit('move', item, pos);
    };

    _proto.remove = function remove(item) {
      if (!this.has(item)) return;
      var ind = this.data.indexOf(item);
      var index = ind;

      if (this.index) {
        index = item instanceof Observer && item.get(this.index) || item[this.index];
        delete this._indexed[index];
      }

      this.data.splice(ind, 1);
      this.emit('remove', item, index);
    };

    _proto.removeByKey = function removeByKey(index) {
      var item;

      if (this.index) {
        item = this._indexed[index];
        if (!item) return;
        var ind = this.data.indexOf(item);
        this.data.splice(ind, 1);
        delete this._indexed[index];
        this.emit('remove', item, ind);
      } else {
        if (this.data.length < index) return;
        item = this.data[index];
        this.data.splice(index, 1);
        this.emit('remove', item, index);
      }
    };

    _proto.removeBy = function removeBy(fn) {
      var i = this.data.length;

      while (i--) {
        if (!fn(this.data[i])) continue;

        if (this.index) {
          delete this._indexed[this.data[i][this.index]];
        }

        this.data.splice(i, 1);
        this.emit('remove', this.data[i], i);
      }
    };

    _proto.clear = function clear() {
      var items = this.data.slice(0);
      this.data = [];
      this._indexed = {};
      var i = items.length;

      while (i--) {
        this.emit('remove', items[i], i);
      }
    };

    _proto.forEach = function forEach(fn) {
      for (var i = 0; i < this.data.length; i++) {
        fn(this.data[i], this.index && this.data[i][this.index] || i);
      }
    };

    _proto.find = function find(fn) {
      var items = [];

      for (var i = 0; i < this.data.length; i++) {
        if (!fn(this.data[i])) continue;
        var index = i;
        if (this.index) index = this.data[i][this.index];
        items.push([index, this.data[i]]);
      }

      return items;
    };

    _proto.findOne = function findOne(fn) {
      for (var i = 0; i < this.data.length; i++) {
        if (!fn(this.data[i])) continue;
        var index = i;
        if (this.index) index = this.data[i][this.index];
        return [index, this.data[i]];
      }

      return null;
    };

    _proto.map = function map(fn) {
      return this.data.map(fn);
    };

    _proto.sort = function sort(fn) {
      this.data.sort(fn);
    };

    _proto.array = function array() {
      return this.data.slice(0);
    };

    _proto.json = function json() {
      var items = this.array();

      for (var i = 0; i < items.length; i++) {
        if (items[i] instanceof Observer) {
          items[i] = items[i].json();
        }
      }

      return items;
    };

    _createClass(ObserverList, [{
      key: "length",
      get: function get() {
        return this.data.length;
      }
    }]);

    return ObserverList;
  }(Events);

  var History = function (_Events) {
    _inheritsLoose(History, _Events);

    function History() {
      var _this;

      _this = _Events.call(this) || this;
      _this._actions = [];
      _this._currentActionIndex = -1;
      _this._canUndo = false;
      _this._canRedo = false;
      return _this;
    }

    var _proto = History.prototype;

    _proto.add = function add(action) {
      if (!action.name) {
        console.error('Trying to add history action without name');
        return;
      }

      if (!action.undo) {
        console.error('Trying to add history action without undo method', action.name);
        return;
      }

      if (!action.redo) {
        console.error('Trying to add history action without redo method', action.name);
        return;
      }

      if (this._currentActionIndex !== this._actions.length - 1) {
        this._actions = this._actions.slice(0, this._currentActionIndex + 1);
      }

      if (action.combine && this.currentAction && this.currentAction.name === action.name) {
        this.currentAction.redo = action.redo;
      } else {
        var length = this._actions.push(action);

        this._currentActionIndex = length - 1;
      }

      this.emit('add', action.name);
      this.canUndo = true;
      this.canRedo = false;
    };

    _proto.undo = function undo() {
      if (!this.canUndo) return;
      var name = this.currentAction.name;

      try {
        this.currentAction.undo();
      } catch (ex) {
        console.info('%c(pcui.History#undo)', 'color: #f00');
        console.log(ex.stack);
        return;
      }

      this._currentActionIndex--;
      this.emit('undo', name);

      if (this._currentActionIndex < 0) {
        this.canUndo = false;
      }

      this.canRedo = true;
    };

    _proto.redo = function redo() {
      if (!this.canRedo) return;
      this._currentActionIndex++;

      try {
        this.currentAction.redo();
      } catch (ex) {
        console.info('%c(pcui.History#redo)', 'color: #f00');
        console.log(ex.stack);
        return;
      }

      this.emit('redo', this.currentAction.name);
      this.canUndo = true;

      if (this._currentActionIndex === this._actions.length - 1) {
        this.canRedo = false;
      }
    };

    _proto.clear = function clear() {
      if (!this._actions.length) return;
      this._actions.length = 0;
      this._currentActionIndex = -1;
      this.canUndo = false;
      this.canRedo = false;
    };

    _createClass(History, [{
      key: "currentAction",
      get: function get() {
        return this._actions[this._currentActionIndex] || null;
      }
    }, {
      key: "lastAction",
      get: function get() {
        return this._actions[this._actions.length - 1] || null;
      }
    }, {
      key: "canUndo",
      get: function get() {
        return this._canUndo;
      },
      set: function set(value) {
        if (this._canUndo === value) return;
        this._canUndo = value;
        this.emit('canUndo', value);
      }
    }, {
      key: "canRedo",
      get: function get() {
        return this._canRedo;
      },
      set: function set(value) {
        if (this._canRedo === value) return;
        this._canRedo = value;
        this.emit('canRedo', value);
      }
    }]);

    return History;
  }(Events);

  var ObserverHistory = function (_Events) {
    _inheritsLoose(ObserverHistory, _Events);

    function ObserverHistory(args) {
      var _this;

      if (args === void 0) {
        args = {};
      }

      _this = _Events.call(this) || this;
      _this.item = args.item;
      _this._history = args.history;
      _this._enabled = args.enabled || true;
      _this._prefix = args.prefix || '';
      _this._combine = args.combine || false;
      _this._events = [];

      _this._initialize();

      return _this;
    }

    var _proto = ObserverHistory.prototype;

    _proto._initialize = function _initialize() {
      var _this2 = this;

      this._events.push(this.item.on('*:set', function (path, value, valueOld) {
        if (!_this2._enabled || !_this2._history) return;
        if (value instanceof Observer) value = value.json();
        var action = {
          name: _this2._prefix + path,
          combine: _this2._combine,
          undo: function undo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;

            if (valueOld === undefined) {
              item.unset(path);
            } else {
              item.set(path, valueOld);
            }

            item.history.enabled = true;
          },
          redo: function redo() {
            var item = _this2.item.latest();

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

        _this2._history.add(action);
      }));

      this._events.push(this.item.on('*:unset', function (path, valueOld) {
        if (!_this2._enabled || !_this2._history) return;
        var action = {
          name: _this2._prefix + path,
          combine: _this2._combine,
          undo: function undo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.set(path, valueOld);
            item.history.enabled = true;
          },
          redo: function redo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.unset(path);
            item.history.enabled = true;
          }
        };

        _this2._history.add(action);
      }));

      this._events.push(this.item.on('*:insert', function (path, value, ind) {
        if (!_this2._enabled || !_this2._history) return;
        var action = {
          name: _this2._prefix + path,
          combine: _this2._combine,
          undo: function undo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.removeValue(path, value);
            item.history.enabled = true;
          },
          redo: function redo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.insert(path, value, ind);
            item.history.enabled = true;
          }
        };

        _this2._history.add(action);
      }));

      this._events.push(this.item.on('*:remove', function (path, value, ind) {
        if (!_this2._enabled || !_this2._history) return;
        var action = {
          name: _this2._prefix + path,
          combine: _this2._combine,
          undo: function undo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.insert(path, value, ind);
            item.history.enabled = true;
          },
          redo: function redo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.removeValue(path, value);
            item.history.enabled = true;
          }
        };

        _this2._history.add(action);
      }));

      this._events.push(this.item.on('*:move', function (path, value, ind, indOld) {
        if (!_this2._enabled || !_this2._history) return;
        var action = {
          name: _this2._prefix + path,
          combine: _this2._combine,
          undo: function undo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.move(path, ind, indOld);
            item.history.enabled = true;
          },
          redo: function redo() {
            var item = _this2.item.latest();

            if (!item) return;
            item.history.enabled = false;
            item.move(path, indOld, ind);
            item.history.enabled = true;
          }
        };

        _this2._history.add(action);
      }));
    };

    _proto.destroy = function destroy() {
      this._events.forEach(function (evt) {
        evt.unbind();
      });

      this._events.length = 0;
      this.item = null;
    };

    _createClass(ObserverHistory, [{
      key: "enabled",
      get: function get() {
        return this._enabled;
      },
      set: function set(value) {
        this._enabled = !!value;
      }
    }, {
      key: "prefix",
      get: function get() {
        return this._prefix;
      },
      set: function set(value) {
        this._prefix = value || '';
      }
    }, {
      key: "combine",
      get: function get() {
        return this._combine;
      },
      set: function set(value) {
        this._combine = !!value;
      }
    }]);

    return ObserverHistory;
  }(Events);

  exports.Events = Events;
  exports.History = History;
  exports.Observer = Observer;
  exports.ObserverHistory = ObserverHistory;
  exports.ObserverList = ObserverList;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
