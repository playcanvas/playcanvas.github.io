(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.observer = {}));
})(this, (function (exports) { 'use strict';

  function _regeneratorRuntime() {
    _regeneratorRuntime = function () {
      return exports;
    };
    var exports = {},
      Op = Object.prototype,
      hasOwn = Op.hasOwnProperty,
      defineProperty = Object.defineProperty || function (obj, key, desc) {
        obj[key] = desc.value;
      },
      $Symbol = "function" == typeof Symbol ? Symbol : {},
      iteratorSymbol = $Symbol.iterator || "@@iterator",
      asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator",
      toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
    function define(obj, key, value) {
      return Object.defineProperty(obj, key, {
        value: value,
        enumerable: !0,
        configurable: !0,
        writable: !0
      }), obj[key];
    }
    try {
      define({}, "");
    } catch (err) {
      define = function (obj, key, value) {
        return obj[key] = value;
      };
    }
    function wrap(innerFn, outerFn, self, tryLocsList) {
      var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator,
        generator = Object.create(protoGenerator.prototype),
        context = new Context(tryLocsList || []);
      return defineProperty(generator, "_invoke", {
        value: makeInvokeMethod(innerFn, self, context)
      }), generator;
    }
    function tryCatch(fn, obj, arg) {
      try {
        return {
          type: "normal",
          arg: fn.call(obj, arg)
        };
      } catch (err) {
        return {
          type: "throw",
          arg: err
        };
      }
    }
    exports.wrap = wrap;
    var ContinueSentinel = {};
    function Generator() {}
    function GeneratorFunction() {}
    function GeneratorFunctionPrototype() {}
    var IteratorPrototype = {};
    define(IteratorPrototype, iteratorSymbol, function () {
      return this;
    });
    var getProto = Object.getPrototypeOf,
      NativeIteratorPrototype = getProto && getProto(getProto(values([])));
    NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol) && (IteratorPrototype = NativeIteratorPrototype);
    var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
    function defineIteratorMethods(prototype) {
      ["next", "throw", "return"].forEach(function (method) {
        define(prototype, method, function (arg) {
          return this._invoke(method, arg);
        });
      });
    }
    function AsyncIterator(generator, PromiseImpl) {
      function invoke(method, arg, resolve, reject) {
        var record = tryCatch(generator[method], generator, arg);
        if ("throw" !== record.type) {
          var result = record.arg,
            value = result.value;
          return value && "object" == typeof value && hasOwn.call(value, "__await") ? PromiseImpl.resolve(value.__await).then(function (value) {
            invoke("next", value, resolve, reject);
          }, function (err) {
            invoke("throw", err, resolve, reject);
          }) : PromiseImpl.resolve(value).then(function (unwrapped) {
            result.value = unwrapped, resolve(result);
          }, function (error) {
            return invoke("throw", error, resolve, reject);
          });
        }
        reject(record.arg);
      }
      var previousPromise;
      defineProperty(this, "_invoke", {
        value: function (method, arg) {
          function callInvokeWithMethodAndArg() {
            return new PromiseImpl(function (resolve, reject) {
              invoke(method, arg, resolve, reject);
            });
          }
          return previousPromise = previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
        }
      });
    }
    function makeInvokeMethod(innerFn, self, context) {
      var state = "suspendedStart";
      return function (method, arg) {
        if ("executing" === state) throw new Error("Generator is already running");
        if ("completed" === state) {
          if ("throw" === method) throw arg;
          return doneResult();
        }
        for (context.method = method, context.arg = arg;;) {
          var delegate = context.delegate;
          if (delegate) {
            var delegateResult = maybeInvokeDelegate(delegate, context);
            if (delegateResult) {
              if (delegateResult === ContinueSentinel) continue;
              return delegateResult;
            }
          }
          if ("next" === context.method) context.sent = context._sent = context.arg;else if ("throw" === context.method) {
            if ("suspendedStart" === state) throw state = "completed", context.arg;
            context.dispatchException(context.arg);
          } else "return" === context.method && context.abrupt("return", context.arg);
          state = "executing";
          var record = tryCatch(innerFn, self, context);
          if ("normal" === record.type) {
            if (state = context.done ? "completed" : "suspendedYield", record.arg === ContinueSentinel) continue;
            return {
              value: record.arg,
              done: context.done
            };
          }
          "throw" === record.type && (state = "completed", context.method = "throw", context.arg = record.arg);
        }
      };
    }
    function maybeInvokeDelegate(delegate, context) {
      var methodName = context.method,
        method = delegate.iterator[methodName];
      if (undefined === method) return context.delegate = null, "throw" === methodName && delegate.iterator.return && (context.method = "return", context.arg = undefined, maybeInvokeDelegate(delegate, context), "throw" === context.method) || "return" !== methodName && (context.method = "throw", context.arg = new TypeError("The iterator does not provide a '" + methodName + "' method")), ContinueSentinel;
      var record = tryCatch(method, delegate.iterator, context.arg);
      if ("throw" === record.type) return context.method = "throw", context.arg = record.arg, context.delegate = null, ContinueSentinel;
      var info = record.arg;
      return info ? info.done ? (context[delegate.resultName] = info.value, context.next = delegate.nextLoc, "return" !== context.method && (context.method = "next", context.arg = undefined), context.delegate = null, ContinueSentinel) : info : (context.method = "throw", context.arg = new TypeError("iterator result is not an object"), context.delegate = null, ContinueSentinel);
    }
    function pushTryEntry(locs) {
      var entry = {
        tryLoc: locs[0]
      };
      1 in locs && (entry.catchLoc = locs[1]), 2 in locs && (entry.finallyLoc = locs[2], entry.afterLoc = locs[3]), this.tryEntries.push(entry);
    }
    function resetTryEntry(entry) {
      var record = entry.completion || {};
      record.type = "normal", delete record.arg, entry.completion = record;
    }
    function Context(tryLocsList) {
      this.tryEntries = [{
        tryLoc: "root"
      }], tryLocsList.forEach(pushTryEntry, this), this.reset(!0);
    }
    function values(iterable) {
      if (iterable) {
        var iteratorMethod = iterable[iteratorSymbol];
        if (iteratorMethod) return iteratorMethod.call(iterable);
        if ("function" == typeof iterable.next) return iterable;
        if (!isNaN(iterable.length)) {
          var i = -1,
            next = function next() {
              for (; ++i < iterable.length;) if (hasOwn.call(iterable, i)) return next.value = iterable[i], next.done = !1, next;
              return next.value = undefined, next.done = !0, next;
            };
          return next.next = next;
        }
      }
      return {
        next: doneResult
      };
    }
    function doneResult() {
      return {
        value: undefined,
        done: !0
      };
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, defineProperty(Gp, "constructor", {
      value: GeneratorFunctionPrototype,
      configurable: !0
    }), defineProperty(GeneratorFunctionPrototype, "constructor", {
      value: GeneratorFunction,
      configurable: !0
    }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction"), exports.isGeneratorFunction = function (genFun) {
      var ctor = "function" == typeof genFun && genFun.constructor;
      return !!ctor && (ctor === GeneratorFunction || "GeneratorFunction" === (ctor.displayName || ctor.name));
    }, exports.mark = function (genFun) {
      return Object.setPrototypeOf ? Object.setPrototypeOf(genFun, GeneratorFunctionPrototype) : (genFun.__proto__ = GeneratorFunctionPrototype, define(genFun, toStringTagSymbol, "GeneratorFunction")), genFun.prototype = Object.create(Gp), genFun;
    }, exports.awrap = function (arg) {
      return {
        __await: arg
      };
    }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
      return this;
    }), exports.AsyncIterator = AsyncIterator, exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
      void 0 === PromiseImpl && (PromiseImpl = Promise);
      var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
      return exports.isGeneratorFunction(outerFn) ? iter : iter.next().then(function (result) {
        return result.done ? result.value : iter.next();
      });
    }, defineIteratorMethods(Gp), define(Gp, toStringTagSymbol, "Generator"), define(Gp, iteratorSymbol, function () {
      return this;
    }), define(Gp, "toString", function () {
      return "[object Generator]";
    }), exports.keys = function (val) {
      var object = Object(val),
        keys = [];
      for (var key in object) keys.push(key);
      return keys.reverse(), function next() {
        for (; keys.length;) {
          var key = keys.pop();
          if (key in object) return next.value = key, next.done = !1, next;
        }
        return next.done = !0, next;
      };
    }, exports.values = values, Context.prototype = {
      constructor: Context,
      reset: function (skipTempReset) {
        if (this.prev = 0, this.next = 0, this.sent = this._sent = undefined, this.done = !1, this.delegate = null, this.method = "next", this.arg = undefined, this.tryEntries.forEach(resetTryEntry), !skipTempReset) for (var name in this) "t" === name.charAt(0) && hasOwn.call(this, name) && !isNaN(+name.slice(1)) && (this[name] = undefined);
      },
      stop: function () {
        this.done = !0;
        var rootRecord = this.tryEntries[0].completion;
        if ("throw" === rootRecord.type) throw rootRecord.arg;
        return this.rval;
      },
      dispatchException: function (exception) {
        if (this.done) throw exception;
        var context = this;
        function handle(loc, caught) {
          return record.type = "throw", record.arg = exception, context.next = loc, caught && (context.method = "next", context.arg = undefined), !!caught;
        }
        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
          var entry = this.tryEntries[i],
            record = entry.completion;
          if ("root" === entry.tryLoc) return handle("end");
          if (entry.tryLoc <= this.prev) {
            var hasCatch = hasOwn.call(entry, "catchLoc"),
              hasFinally = hasOwn.call(entry, "finallyLoc");
            if (hasCatch && hasFinally) {
              if (this.prev < entry.catchLoc) return handle(entry.catchLoc, !0);
              if (this.prev < entry.finallyLoc) return handle(entry.finallyLoc);
            } else if (hasCatch) {
              if (this.prev < entry.catchLoc) return handle(entry.catchLoc, !0);
            } else {
              if (!hasFinally) throw new Error("try statement without catch or finally");
              if (this.prev < entry.finallyLoc) return handle(entry.finallyLoc);
            }
          }
        }
      },
      abrupt: function (type, arg) {
        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
          var entry = this.tryEntries[i];
          if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
            var finallyEntry = entry;
            break;
          }
        }
        finallyEntry && ("break" === type || "continue" === type) && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc && (finallyEntry = null);
        var record = finallyEntry ? finallyEntry.completion : {};
        return record.type = type, record.arg = arg, finallyEntry ? (this.method = "next", this.next = finallyEntry.finallyLoc, ContinueSentinel) : this.complete(record);
      },
      complete: function (record, afterLoc) {
        if ("throw" === record.type) throw record.arg;
        return "break" === record.type || "continue" === record.type ? this.next = record.arg : "return" === record.type ? (this.rval = this.arg = record.arg, this.method = "return", this.next = "end") : "normal" === record.type && afterLoc && (this.next = afterLoc), ContinueSentinel;
      },
      finish: function (finallyLoc) {
        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
          var entry = this.tryEntries[i];
          if (entry.finallyLoc === finallyLoc) return this.complete(entry.completion, entry.afterLoc), resetTryEntry(entry), ContinueSentinel;
        }
      },
      catch: function (tryLoc) {
        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
          var entry = this.tryEntries[i];
          if (entry.tryLoc === tryLoc) {
            var record = entry.completion;
            if ("throw" === record.type) {
              var thrown = record.arg;
              resetTryEntry(entry);
            }
            return thrown;
          }
        }
        throw new Error("illegal catch attempt");
      },
      delegateYield: function (iterable, resultName, nextLoc) {
        return this.delegate = {
          iterator: values(iterable),
          resultName: resultName,
          nextLoc: nextLoc
        }, "next" === this.method && (this.arg = undefined), ContinueSentinel;
      }
    }, exports;
  }
  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }
    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }
  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
        args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);
        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }
        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }
        _next(undefined);
      });
    };
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", {
      writable: false
    });
    return Constructor;
  }
  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;
    _setPrototypeOf(subClass, superClass);
  }
  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };
    return _setPrototypeOf(o, p);
  }
  function _toPrimitive(input, hint) {
    if (typeof input !== "object" || input === null) return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
      var res = prim.call(input, hint || "default");
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }
  function _toPropertyKey(arg) {
    var key = _toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
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
      if (this._suspendEvents) return this;
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

  var arrayEquals = function arrayEquals(a, b) {
    if (!a || !b) {
      return false;
    }
    var l = a.length;
    if (l !== b.length) {
      return false;
    }
    for (var i = 0; i < l; i++) {
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
      } else if (a instanceof Array && b instanceof Array && arrayEquals(a, b)) {
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
          return false;
        }
      }
      if (!node._data || !node._data.hasOwnProperty(key) || !(node._data[key] instanceof Array)) return false;
      var arr = node._data[key];
      if (arr.length < ind) return false;
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
      _this._executing = 0;
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
        var length = this._actions.push(action);
        this._currentActionIndex = length - 1;
      }
      this.emit('add', action.name);
      this.canUndo = true;
      this.canRedo = false;
      return true;
    };
    _proto.addAndExecute = function () {
      var _addAndExecute = _asyncToGenerator(_regeneratorRuntime().mark(function _callee(action) {
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              if (!this.add(action)) {
                _context.next = 8;
                break;
              }
              _context.prev = 1;
              this.executing++;
              _context.next = 5;
              return action.redo();
            case 5:
              _context.prev = 5;
              this.executing--;
              return _context.finish(5);
            case 8:
            case "end":
              return _context.stop();
          }
        }, _callee, this, [[1,, 5, 8]]);
      }));
      function addAndExecute(_x) {
        return _addAndExecute.apply(this, arguments);
      }
      return addAndExecute;
    }();
    _proto.undo = function () {
      var _undo = _asyncToGenerator(_regeneratorRuntime().mark(function _callee2() {
        var name, undo;
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              if (this.canUndo) {
                _context2.next = 2;
                break;
              }
              return _context2.abrupt("return");
            case 2:
              name = this.currentAction.name;
              undo = this.currentAction.undo;
              this._currentActionIndex--;
              this.emit('undo', name);
              if (this._currentActionIndex < 0) {
                this.canUndo = false;
              }
              this.canRedo = true;
              _context2.prev = 8;
              this.executing++;
              _context2.next = 12;
              return undo();
            case 12:
              _context2.next = 18;
              break;
            case 14:
              _context2.prev = 14;
              _context2.t0 = _context2["catch"](8);
              console.info('%c(pcui.History#undo)', 'color: #f00');
              console.log(_context2.t0.stack);
            case 18:
              _context2.prev = 18;
              this.executing--;
              return _context2.finish(18);
            case 21:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this, [[8, 14, 18, 21]]);
      }));
      function undo() {
        return _undo.apply(this, arguments);
      }
      return undo;
    }();
    _proto.redo = function () {
      var _redo = _asyncToGenerator(_regeneratorRuntime().mark(function _callee3() {
        var redo;
        return _regeneratorRuntime().wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              if (this.canRedo) {
                _context3.next = 2;
                break;
              }
              return _context3.abrupt("return");
            case 2:
              this._currentActionIndex++;
              redo = this.currentAction.redo;
              this.emit('redo', this.currentAction.name);
              this.canUndo = true;
              if (this._currentActionIndex === this._actions.length - 1) {
                this.canRedo = false;
              }
              _context3.prev = 7;
              this.executing++;
              _context3.next = 11;
              return redo();
            case 11:
              _context3.next = 17;
              break;
            case 13:
              _context3.prev = 13;
              _context3.t0 = _context3["catch"](7);
              console.info('%c(pcui.History#redo)', 'color: #f00');
              console.log(_context3.t0.stack);
            case 17:
              _context3.prev = 17;
              this.executing--;
              return _context3.finish(17);
            case 20:
            case "end":
              return _context3.stop();
          }
        }, _callee3, this, [[7, 13, 17, 20]]);
      }));
      function redo() {
        return _redo.apply(this, arguments);
      }
      return redo;
    }();
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
        return this._canUndo && !this.executing;
      },
      set: function set(value) {
        if (this._canUndo === value) return;
        this._canUndo = value;
        if (!this.executing) {
          this.emit('canUndo', value);
        }
      }
    }, {
      key: "canRedo",
      get: function get() {
        return this._canRedo && !this.executing;
      },
      set: function set(value) {
        if (this._canRedo === value) return;
        this._canRedo = value;
        if (!this.executing) {
          this.emit('canRedo', value);
        }
      }
    }, {
      key: "executing",
      get: function get() {
        return this._executing;
      },
      set: function set(value) {
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

}));
