/**
 * @license
 * PlayCanvas Engine v1.67.0 revision ea736291a
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.VoxParser = {}));
})(this, (function (exports) { 'use strict';

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
	function _assertThisInitialized(self) {
	  if (self === void 0) {
	    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  }
	  return self;
	}
	function _unsupportedIterableToArray(o, minLen) {
	  if (!o) return;
	  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
	  var n = Object.prototype.toString.call(o).slice(8, -1);
	  if (n === "Object" && o.constructor) n = o.constructor.name;
	  if (n === "Map" || n === "Set") return Array.from(o);
	  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
	}
	function _arrayLikeToArray(arr, len) {
	  if (len == null || len > arr.length) len = arr.length;
	  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
	  return arr2;
	}
	function _createForOfIteratorHelperLoose(o, allowArrayLike) {
	  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
	  if (it) return (it = it.call(o)).next.bind(it);
	  if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
	    if (it) o = it;
	    var i = 0;
	    return function () {
	      if (i >= o.length) return {
	        done: true
	      };
	      return {
	        done: false,
	        value: o[i++]
	      };
	    };
	  }
	  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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

	var Tracing = function () {
		function Tracing() {}
		Tracing.set = function set(channel, enabled) {
			if (enabled === void 0) {
				enabled = true;
			}
			if (enabled) {
				Tracing._traceChannels.add(channel);
			} else {
				Tracing._traceChannels.delete(channel);
			}
		};
		Tracing.get = function get(channel) {
			return Tracing._traceChannels.has(channel);
		};
		return Tracing;
	}();
	Tracing._traceChannels = new Set();
	Tracing.stack = false;

	var Debug = function () {
		function Debug() {}
		Debug.deprecated = function deprecated(message) {
			if (!Debug._loggedMessages.has(message)) {
				Debug._loggedMessages.add(message);
				console.warn('DEPRECATED: ' + message);
			}
		};
		Debug.assertDeprecated = function assertDeprecated(assertion, message) {
			if (!assertion) {
				Debug.deprecated(message);
			}
		};
		Debug.assert = function assert(assertion) {
			if (!assertion) {
				var _console;
				for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
					args[_key - 1] = arguments[_key];
				}
				(_console = console).error.apply(_console, ['ASSERT FAILED: '].concat(args));
			}
		};
		Debug.assertDestroyed = function assertDestroyed(object) {
			if (object != null && object.__alreadyDestroyed) {
				var _object$constructor;
				var message = "[" + ((_object$constructor = object.constructor) == null ? void 0 : _object$constructor.name) + "] with name [" + object.name + "] has already been destroyed, and cannot be used.";
				if (!Debug._loggedMessages.has(message)) {
					Debug._loggedMessages.add(message);
					console.error('ASSERT FAILED: ', message, object);
				}
			}
		};
		Debug.call = function call(func) {
			func();
		};
		Debug.log = function log() {
			var _console2;
			(_console2 = console).log.apply(_console2, arguments);
		};
		Debug.logOnce = function logOnce(message) {
			if (!Debug._loggedMessages.has(message)) {
				var _console3;
				Debug._loggedMessages.add(message);
				for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
					args[_key2 - 1] = arguments[_key2];
				}
				(_console3 = console).log.apply(_console3, [message].concat(args));
			}
		};
		Debug.warn = function warn() {
			var _console4;
			(_console4 = console).warn.apply(_console4, arguments);
		};
		Debug.warnOnce = function warnOnce(message) {
			if (!Debug._loggedMessages.has(message)) {
				var _console5;
				Debug._loggedMessages.add(message);
				for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
					args[_key3 - 1] = arguments[_key3];
				}
				(_console5 = console).warn.apply(_console5, [message].concat(args));
			}
		};
		Debug.error = function error() {
			var _console6;
			(_console6 = console).error.apply(_console6, arguments);
		};
		Debug.errorOnce = function errorOnce(message) {
			if (!Debug._loggedMessages.has(message)) {
				var _console7;
				Debug._loggedMessages.add(message);
				for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
					args[_key4 - 1] = arguments[_key4];
				}
				(_console7 = console).error.apply(_console7, [message].concat(args));
			}
		};
		Debug.trace = function trace(channel) {
			if (Tracing.get(channel)) {
				var _console8;
				for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
					args[_key5 - 1] = arguments[_key5];
				}
				(_console8 = console).groupCollapsed.apply(_console8, [channel.padEnd(20, ' ') + "|"].concat(args));
				if (Tracing.stack) {
					console.trace();
				}
				console.groupEnd();
			}
		};
		return Debug;
	}();
	Debug._loggedMessages = new Set();

	var EventHandle = function () {
		function EventHandle(handler, name, callback, scope, once) {
			if (once === void 0) {
				once = false;
			}
			this.handler = void 0;
			this.name = void 0;
			this.callback = void 0;
			this.scope = void 0;
			this._once = void 0;
			this._removed = false;
			this.handler = handler;
			this.name = name;
			this.callback = callback;
			this.scope = scope;
			this._once = once;
		}
		var _proto = EventHandle.prototype;
		_proto.off = function off() {
			if (this._removed) return;
			this.handler.off(this.name, this.callback, this.scope);
		};
		_proto.on = function on(name, callback, scope) {
			if (scope === void 0) {
				scope = this;
			}
			Debug.deprecated('Using chaining with EventHandler.on is deprecated, subscribe to an event from EventHandler directly instead.');
			return this.handler._addCallback(name, callback, scope, false);
		};
		_proto.once = function once(name, callback, scope) {
			if (scope === void 0) {
				scope = this;
			}
			Debug.deprecated('Using chaning with EventHandler.once is deprecated, subscribe to an event from EventHandler directly instead.');
			return this.handler._addCallback(name, callback, scope, true);
		};
		_createClass(EventHandle, [{
			key: "removed",
			get: function get() {
				return this._removed;
			},
			set: function set(value) {
				if (!value) return;
				this._removed = true;
			}
		}]);
		return EventHandle;
	}();

	var EventHandler = function () {
		function EventHandler() {
			this._callbacks = new Map();
			this._callbackActive = new Map();
		}
		var _proto = EventHandler.prototype;
		_proto.initEventHandler = function initEventHandler() {
			this._callbacks = new Map();
			this._callbackActive = new Map();
		};
		_proto._addCallback = function _addCallback(name, callback, scope, once) {
			if (!name || typeof name !== 'string' || !callback) console.warn("EventHandler: subscribing to an event (" + name + ") with missing arguments", callback);
			if (!this._callbacks.has(name)) this._callbacks.set(name, []);
			if (this._callbackActive.has(name)) {
				var callbackActive = this._callbackActive.get(name);
				if (callbackActive && callbackActive === this._callbacks.get(name)) {
					this._callbackActive.set(name, callbackActive.slice());
				}
			}
			var evt = new EventHandle(this, name, callback, scope, once);
			this._callbacks.get(name).push(evt);
			return evt;
		};
		_proto.on = function on(name, callback, scope) {
			if (scope === void 0) {
				scope = this;
			}
			return this._addCallback(name, callback, scope, false);
		};
		_proto.once = function once(name, callback, scope) {
			if (scope === void 0) {
				scope = this;
			}
			return this._addCallback(name, callback, scope, true);
		};
		_proto.off = function off(name, callback, scope) {
			if (name) {
				if (this._callbackActive.has(name) && this._callbackActive.get(name) === this._callbacks.get(name)) this._callbackActive.set(name, this._callbackActive.get(name).slice());
			} else {
				for (var _iterator = _createForOfIteratorHelperLoose(this._callbackActive), _step; !(_step = _iterator()).done;) {
					var _step$value = _step.value,
						key = _step$value[0],
						callbacks = _step$value[1];
					if (!this._callbacks.has(key)) continue;
					if (this._callbacks.get(key) !== callbacks) continue;
					this._callbackActive.set(key, callbacks.slice());
				}
			}
			if (!name) {
				for (var _iterator2 = _createForOfIteratorHelperLoose(this._callbacks.values()), _step2; !(_step2 = _iterator2()).done;) {
					var _callbacks = _step2.value;
					for (var i = 0; i < _callbacks.length; i++) {
						_callbacks[i].removed = true;
					}
				}
				this._callbacks.clear();
			} else if (!callback) {
				var _callbacks2 = this._callbacks.get(name);
				if (_callbacks2) {
					for (var _i = 0; _i < _callbacks2.length; _i++) {
						_callbacks2[_i].removed = true;
					}
					this._callbacks.delete(name);
				}
			} else {
				var _callbacks3 = this._callbacks.get(name);
				if (!_callbacks3) return this;
				for (var _i2 = 0; _i2 < _callbacks3.length; _i2++) {
					if (_callbacks3[_i2].callback !== callback) continue;
					if (scope && _callbacks3[_i2].scope !== scope) continue;
					_callbacks3[_i2].removed = true;
					_callbacks3.splice(_i2, 1);
					_i2--;
				}
				if (_callbacks3.length === 0) this._callbacks.delete(name);
			}
			return this;
		};
		_proto.fire = function fire(name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
			if (!name) return this;
			var callbacksInitial = this._callbacks.get(name);
			if (!callbacksInitial) return this;
			var callbacks;
			if (!this._callbackActive.has(name)) {
				this._callbackActive.set(name, callbacksInitial);
			} else if (this._callbackActive.get(name) !== callbacksInitial) {
				callbacks = callbacksInitial.slice();
			}
			for (var i = 0; (callbacks || this._callbackActive.get(name)) && i < (callbacks || this._callbackActive.get(name)).length; i++) {
				var evt = (callbacks || this._callbackActive.get(name))[i];
				if (!evt.callback) continue;
				evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
				if (evt._once) {
					var existingCallback = this._callbacks.get(name);
					var ind = existingCallback ? existingCallback.indexOf(evt) : -1;
					if (ind !== -1) {
						if (this._callbackActive.get(name) === existingCallback) this._callbackActive.set(name, this._callbackActive.get(name).slice());
						var _callbacks4 = this._callbacks.get(name);
						if (!_callbacks4) continue;
						_callbacks4[ind].removed = true;
						_callbacks4.splice(ind, 1);
						if (_callbacks4.length === 0) this._callbacks.delete(name);
					}
				}
			}
			if (!callbacks) this._callbackActive.delete(name);
			return this;
		};
		_proto.hasEvent = function hasEvent(name) {
			var _this$_callbacks$get;
			return !!((_this$_callbacks$get = this._callbacks.get(name)) != null && _this$_callbacks$get.length);
		};
		return EventHandler;
	}();

	var Component = function (_EventHandler) {
		_inheritsLoose(Component, _EventHandler);
		function Component(system, entity) {
			var _this;
			_this = _EventHandler.call(this) || this;
			_this.system = void 0;
			_this.entity = void 0;
			_this.system = system;
			_this.entity = entity;
			if (_this.system.schema && !_this._accessorsBuilt) {
				_this.buildAccessors(_this.system.schema);
			}
			_this.on('set', function (name, oldValue, newValue) {
				this.fire('set_' + name, name, oldValue, newValue);
			});
			_this.on('set_enabled', _this.onSetEnabled, _assertThisInitialized(_this));
			return _this;
		}
		Component._buildAccessors = function _buildAccessors(obj, schema) {
			schema.forEach(function (descriptor) {
				var name = typeof descriptor === 'object' ? descriptor.name : descriptor;
				Object.defineProperty(obj, name, {
					get: function get() {
						return this.data[name];
					},
					set: function set(value) {
						var data = this.data;
						var oldValue = data[name];
						data[name] = value;
						this.fire('set', name, oldValue, value);
					},
					configurable: true
				});
			});
			obj._accessorsBuilt = true;
		};
		var _proto = Component.prototype;
		_proto.buildAccessors = function buildAccessors(schema) {
			Component._buildAccessors(this, schema);
		};
		_proto.onSetEnabled = function onSetEnabled(name, oldValue, newValue) {
			if (oldValue !== newValue) {
				if (this.entity.enabled) {
					if (newValue) {
						this.onEnable();
					} else {
						this.onDisable();
					}
				}
			}
		};
		_proto.onEnable = function onEnable() {};
		_proto.onDisable = function onDisable() {};
		_proto.onPostStateChange = function onPostStateChange() {};
		_createClass(Component, [{
			key: "data",
			get: function get() {
				var record = this.system.store[this.entity.getGuid()];
				return record ? record.data : null;
			}
		}]);
		return Component;
	}(EventHandler);

	var math = {
		DEG_TO_RAD: Math.PI / 180,
		RAD_TO_DEG: 180 / Math.PI,
		clamp: function clamp(value, min, max) {
			if (value >= max) return max;
			if (value <= min) return min;
			return value;
		},
		intToBytes24: function intToBytes24(i) {
			var r = i >> 16 & 0xff;
			var g = i >> 8 & 0xff;
			var b = i & 0xff;
			return [r, g, b];
		},
		intToBytes32: function intToBytes32(i) {
			var r = i >> 24 & 0xff;
			var g = i >> 16 & 0xff;
			var b = i >> 8 & 0xff;
			var a = i & 0xff;
			return [r, g, b, a];
		},
		bytesToInt24: function bytesToInt24(r, g, b) {
			if (r.length) {
				b = r[2];
				g = r[1];
				r = r[0];
			}
			return r << 16 | g << 8 | b;
		},
		bytesToInt32: function bytesToInt32(r, g, b, a) {
			if (r.length) {
				a = r[3];
				b = r[2];
				g = r[1];
				r = r[0];
			}
			return (r << 24 | g << 16 | b << 8 | a) >>> 0;
		},
		lerp: function lerp(a, b, alpha) {
			return a + (b - a) * math.clamp(alpha, 0, 1);
		},
		lerpAngle: function lerpAngle(a, b, alpha) {
			if (b - a > 180) {
				b -= 360;
			}
			if (b - a < -180) {
				b += 360;
			}
			return math.lerp(a, b, math.clamp(alpha, 0, 1));
		},
		powerOfTwo: function powerOfTwo(x) {
			return x !== 0 && !(x & x - 1);
		},
		nextPowerOfTwo: function nextPowerOfTwo(val) {
			val--;
			val |= val >> 1;
			val |= val >> 2;
			val |= val >> 4;
			val |= val >> 8;
			val |= val >> 16;
			val++;
			return val;
		},
		nearestPowerOfTwo: function nearestPowerOfTwo(val) {
			return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
		},
		random: function random(min, max) {
			var diff = max - min;
			return Math.random() * diff + min;
		},
		smoothstep: function smoothstep(min, max, x) {
			if (x <= min) return 0;
			if (x >= max) return 1;
			x = (x - min) / (max - min);
			return x * x * (3 - 2 * x);
		},
		smootherstep: function smootherstep(min, max, x) {
			if (x <= min) return 0;
			if (x >= max) return 1;
			x = (x - min) / (max - min);
			return x * x * x * (x * (x * 6 - 15) + 10);
		},
		roundUp: function roundUp(numToRound, multiple) {
			if (multiple === 0) return numToRound;
			return Math.ceil(numToRound / multiple) * multiple;
		},
		between: function between(num, a, b, inclusive) {
			var min = Math.min(a, b);
			var max = Math.max(a, b);
			return inclusive ? num >= min && num <= max : num > min && num < max;
		}
	};

	var _class$3;
	var Color = function () {
		function Color(r, g, b, a) {
			if (r === void 0) {
				r = 0;
			}
			if (g === void 0) {
				g = 0;
			}
			if (b === void 0) {
				b = 0;
			}
			if (a === void 0) {
				a = 1;
			}
			this.r = void 0;
			this.g = void 0;
			this.b = void 0;
			this.a = void 0;
			var length = r.length;
			if (length === 3 || length === 4) {
				this.r = r[0];
				this.g = r[1];
				this.b = r[2];
				this.a = r[3] !== undefined ? r[3] : 1;
			} else {
				this.r = r;
				this.g = g;
				this.b = b;
				this.a = a;
			}
		}
		var _proto = Color.prototype;
		_proto.clone = function clone() {
			var cstr = this.constructor;
			return new cstr(this.r, this.g, this.b, this.a);
		};
		_proto.copy = function copy(rhs) {
			this.r = rhs.r;
			this.g = rhs.g;
			this.b = rhs.b;
			this.a = rhs.a;
			return this;
		};
		_proto.equals = function equals(rhs) {
			return this.r === rhs.r && this.g === rhs.g && this.b === rhs.b && this.a === rhs.a;
		};
		_proto.set = function set(r, g, b, a) {
			if (a === void 0) {
				a = 1;
			}
			this.r = r;
			this.g = g;
			this.b = b;
			this.a = a;
			return this;
		};
		_proto.lerp = function lerp(lhs, rhs, alpha) {
			this.r = lhs.r + alpha * (rhs.r - lhs.r);
			this.g = lhs.g + alpha * (rhs.g - lhs.g);
			this.b = lhs.b + alpha * (rhs.b - lhs.b);
			this.a = lhs.a + alpha * (rhs.a - lhs.a);
			return this;
		};
		_proto.fromString = function fromString(hex) {
			var i = parseInt(hex.replace('#', '0x'), 16);
			var bytes;
			if (hex.length > 7) {
				bytes = math.intToBytes32(i);
			} else {
				bytes = math.intToBytes24(i);
				bytes[3] = 255;
			}
			this.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255);
			return this;
		};
		_proto.toString = function toString(alpha) {
			var s = '#' + ((1 << 24) + (Math.round(this.r * 255) << 16) + (Math.round(this.g * 255) << 8) + Math.round(this.b * 255)).toString(16).slice(1);
			if (alpha === true) {
				var a = Math.round(this.a * 255).toString(16);
				if (this.a < 16 / 255) {
					s += '0' + a;
				} else {
					s += a;
				}
			}
			return s;
		};
		return Color;
	}();
	_class$3 = Color;
	Color.BLACK = Object.freeze(new _class$3(0, 0, 0, 1));
	Color.BLUE = Object.freeze(new _class$3(0, 0, 1, 1));
	Color.CYAN = Object.freeze(new _class$3(0, 1, 1, 1));
	Color.GRAY = Object.freeze(new _class$3(0.5, 0.5, 0.5, 1));
	Color.GREEN = Object.freeze(new _class$3(0, 1, 0, 1));
	Color.MAGENTA = Object.freeze(new _class$3(1, 0, 1, 1));
	Color.RED = Object.freeze(new _class$3(1, 0, 0, 1));
	Color.WHITE = Object.freeze(new _class$3(1, 1, 1, 1));
	Color.YELLOW = Object.freeze(new _class$3(1, 1, 0, 1));

	var _class$2;
	var Vec2 = function () {
		function Vec2(x, y) {
			if (x === void 0) {
				x = 0;
			}
			if (y === void 0) {
				y = 0;
			}
			this.x = void 0;
			this.y = void 0;
			if (x.length === 2) {
				this.x = x[0];
				this.y = x[1];
			} else {
				this.x = x;
				this.y = y;
			}
		}
		var _proto = Vec2.prototype;
		_proto.add = function add(rhs) {
			this.x += rhs.x;
			this.y += rhs.y;
			return this;
		};
		_proto.add2 = function add2(lhs, rhs) {
			this.x = lhs.x + rhs.x;
			this.y = lhs.y + rhs.y;
			return this;
		};
		_proto.addScalar = function addScalar(scalar) {
			this.x += scalar;
			this.y += scalar;
			return this;
		};
		_proto.addScaled = function addScaled(rhs, scalar) {
			this.x += rhs.x * scalar;
			this.y += rhs.y * scalar;
			return this;
		};
		_proto.clone = function clone() {
			var cstr = this.constructor;
			return new cstr(this.x, this.y);
		};
		_proto.copy = function copy(rhs) {
			this.x = rhs.x;
			this.y = rhs.y;
			return this;
		};
		_proto.cross = function cross(rhs) {
			return this.x * rhs.y - this.y * rhs.x;
		};
		_proto.distance = function distance(rhs) {
			var x = this.x - rhs.x;
			var y = this.y - rhs.y;
			return Math.sqrt(x * x + y * y);
		};
		_proto.div = function div(rhs) {
			this.x /= rhs.x;
			this.y /= rhs.y;
			return this;
		};
		_proto.div2 = function div2(lhs, rhs) {
			this.x = lhs.x / rhs.x;
			this.y = lhs.y / rhs.y;
			return this;
		};
		_proto.divScalar = function divScalar(scalar) {
			this.x /= scalar;
			this.y /= scalar;
			return this;
		};
		_proto.dot = function dot(rhs) {
			return this.x * rhs.x + this.y * rhs.y;
		};
		_proto.equals = function equals(rhs) {
			return this.x === rhs.x && this.y === rhs.y;
		};
		_proto.equalsApprox = function equalsApprox(rhs, epsilon) {
			if (epsilon === void 0) {
				epsilon = 1e-6;
			}
			return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon;
		};
		_proto.length = function length() {
			return Math.sqrt(this.x * this.x + this.y * this.y);
		};
		_proto.lengthSq = function lengthSq() {
			return this.x * this.x + this.y * this.y;
		};
		_proto.lerp = function lerp(lhs, rhs, alpha) {
			this.x = lhs.x + alpha * (rhs.x - lhs.x);
			this.y = lhs.y + alpha * (rhs.y - lhs.y);
			return this;
		};
		_proto.mul = function mul(rhs) {
			this.x *= rhs.x;
			this.y *= rhs.y;
			return this;
		};
		_proto.mul2 = function mul2(lhs, rhs) {
			this.x = lhs.x * rhs.x;
			this.y = lhs.y * rhs.y;
			return this;
		};
		_proto.mulScalar = function mulScalar(scalar) {
			this.x *= scalar;
			this.y *= scalar;
			return this;
		};
		_proto.normalize = function normalize(src) {
			if (src === void 0) {
				src = this;
			}
			var lengthSq = src.x * src.x + src.y * src.y;
			if (lengthSq > 0) {
				var invLength = 1 / Math.sqrt(lengthSq);
				this.x = src.x * invLength;
				this.y = src.y * invLength;
			}
			return this;
		};
		_proto.rotate = function rotate(degrees) {
			var angle = Math.atan2(this.x, this.y) + degrees * math.DEG_TO_RAD;
			var len = Math.sqrt(this.x * this.x + this.y * this.y);
			this.x = Math.sin(angle) * len;
			this.y = Math.cos(angle) * len;
			return this;
		};
		_proto.angle = function angle() {
			return Math.atan2(this.x, this.y) * math.RAD_TO_DEG;
		};
		_proto.angleTo = function angleTo(rhs) {
			return Math.atan2(this.x * rhs.y + this.y * rhs.x, this.x * rhs.x + this.y * rhs.y) * math.RAD_TO_DEG;
		};
		_proto.floor = function floor(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.floor(src.x);
			this.y = Math.floor(src.y);
			return this;
		};
		_proto.ceil = function ceil(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.ceil(src.x);
			this.y = Math.ceil(src.y);
			return this;
		};
		_proto.round = function round(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.round(src.x);
			this.y = Math.round(src.y);
			return this;
		};
		_proto.min = function min(rhs) {
			if (rhs.x < this.x) this.x = rhs.x;
			if (rhs.y < this.y) this.y = rhs.y;
			return this;
		};
		_proto.max = function max(rhs) {
			if (rhs.x > this.x) this.x = rhs.x;
			if (rhs.y > this.y) this.y = rhs.y;
			return this;
		};
		_proto.set = function set(x, y) {
			this.x = x;
			this.y = y;
			return this;
		};
		_proto.sub = function sub(rhs) {
			this.x -= rhs.x;
			this.y -= rhs.y;
			return this;
		};
		_proto.sub2 = function sub2(lhs, rhs) {
			this.x = lhs.x - rhs.x;
			this.y = lhs.y - rhs.y;
			return this;
		};
		_proto.subScalar = function subScalar(scalar) {
			this.x -= scalar;
			this.y -= scalar;
			return this;
		};
		_proto.toString = function toString() {
			return "[" + this.x + ", " + this.y + "]";
		};
		Vec2.angleRad = function angleRad(lhs, rhs) {
			return Math.atan2(lhs.x * rhs.y - lhs.y * rhs.x, lhs.x * rhs.x + lhs.y * rhs.y);
		};
		return Vec2;
	}();
	_class$2 = Vec2;
	Vec2.ZERO = Object.freeze(new _class$2(0, 0));
	Vec2.ONE = Object.freeze(new _class$2(1, 1));
	Vec2.UP = Object.freeze(new _class$2(0, 1));
	Vec2.DOWN = Object.freeze(new _class$2(0, -1));
	Vec2.RIGHT = Object.freeze(new _class$2(1, 0));
	Vec2.LEFT = Object.freeze(new _class$2(-1, 0));

	var _class$1;
	var Vec3 = function () {
		function Vec3(x, y, z) {
			if (x === void 0) {
				x = 0;
			}
			if (y === void 0) {
				y = 0;
			}
			if (z === void 0) {
				z = 0;
			}
			this.x = void 0;
			this.y = void 0;
			this.z = void 0;
			if (x.length === 3) {
				this.x = x[0];
				this.y = x[1];
				this.z = x[2];
			} else {
				this.x = x;
				this.y = y;
				this.z = z;
			}
		}
		var _proto = Vec3.prototype;
		_proto.add = function add(rhs) {
			this.x += rhs.x;
			this.y += rhs.y;
			this.z += rhs.z;
			return this;
		};
		_proto.add2 = function add2(lhs, rhs) {
			this.x = lhs.x + rhs.x;
			this.y = lhs.y + rhs.y;
			this.z = lhs.z + rhs.z;
			return this;
		};
		_proto.addScalar = function addScalar(scalar) {
			this.x += scalar;
			this.y += scalar;
			this.z += scalar;
			return this;
		};
		_proto.addScaled = function addScaled(rhs, scalar) {
			this.x += rhs.x * scalar;
			this.y += rhs.y * scalar;
			this.z += rhs.z * scalar;
			return this;
		};
		_proto.clone = function clone() {
			var cstr = this.constructor;
			return new cstr(this.x, this.y, this.z);
		};
		_proto.copy = function copy(rhs) {
			this.x = rhs.x;
			this.y = rhs.y;
			this.z = rhs.z;
			return this;
		};
		_proto.cross = function cross(lhs, rhs) {
			var lx = lhs.x;
			var ly = lhs.y;
			var lz = lhs.z;
			var rx = rhs.x;
			var ry = rhs.y;
			var rz = rhs.z;
			this.x = ly * rz - ry * lz;
			this.y = lz * rx - rz * lx;
			this.z = lx * ry - rx * ly;
			return this;
		};
		_proto.distance = function distance(rhs) {
			var x = this.x - rhs.x;
			var y = this.y - rhs.y;
			var z = this.z - rhs.z;
			return Math.sqrt(x * x + y * y + z * z);
		};
		_proto.div = function div(rhs) {
			this.x /= rhs.x;
			this.y /= rhs.y;
			this.z /= rhs.z;
			return this;
		};
		_proto.div2 = function div2(lhs, rhs) {
			this.x = lhs.x / rhs.x;
			this.y = lhs.y / rhs.y;
			this.z = lhs.z / rhs.z;
			return this;
		};
		_proto.divScalar = function divScalar(scalar) {
			this.x /= scalar;
			this.y /= scalar;
			this.z /= scalar;
			return this;
		};
		_proto.dot = function dot(rhs) {
			return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
		};
		_proto.equals = function equals(rhs) {
			return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
		};
		_proto.equalsApprox = function equalsApprox(rhs, epsilon) {
			if (epsilon === void 0) {
				epsilon = 1e-6;
			}
			return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon;
		};
		_proto.length = function length() {
			return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
		};
		_proto.lengthSq = function lengthSq() {
			return this.x * this.x + this.y * this.y + this.z * this.z;
		};
		_proto.lerp = function lerp(lhs, rhs, alpha) {
			this.x = lhs.x + alpha * (rhs.x - lhs.x);
			this.y = lhs.y + alpha * (rhs.y - lhs.y);
			this.z = lhs.z + alpha * (rhs.z - lhs.z);
			return this;
		};
		_proto.mul = function mul(rhs) {
			this.x *= rhs.x;
			this.y *= rhs.y;
			this.z *= rhs.z;
			return this;
		};
		_proto.mul2 = function mul2(lhs, rhs) {
			this.x = lhs.x * rhs.x;
			this.y = lhs.y * rhs.y;
			this.z = lhs.z * rhs.z;
			return this;
		};
		_proto.mulScalar = function mulScalar(scalar) {
			this.x *= scalar;
			this.y *= scalar;
			this.z *= scalar;
			return this;
		};
		_proto.normalize = function normalize(src) {
			if (src === void 0) {
				src = this;
			}
			var lengthSq = src.x * src.x + src.y * src.y + src.z * src.z;
			if (lengthSq > 0) {
				var invLength = 1 / Math.sqrt(lengthSq);
				this.x = src.x * invLength;
				this.y = src.y * invLength;
				this.z = src.z * invLength;
			}
			return this;
		};
		_proto.floor = function floor(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.floor(src.x);
			this.y = Math.floor(src.y);
			this.z = Math.floor(src.z);
			return this;
		};
		_proto.ceil = function ceil(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.ceil(src.x);
			this.y = Math.ceil(src.y);
			this.z = Math.ceil(src.z);
			return this;
		};
		_proto.round = function round(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.round(src.x);
			this.y = Math.round(src.y);
			this.z = Math.round(src.z);
			return this;
		};
		_proto.min = function min(rhs) {
			if (rhs.x < this.x) this.x = rhs.x;
			if (rhs.y < this.y) this.y = rhs.y;
			if (rhs.z < this.z) this.z = rhs.z;
			return this;
		};
		_proto.max = function max(rhs) {
			if (rhs.x > this.x) this.x = rhs.x;
			if (rhs.y > this.y) this.y = rhs.y;
			if (rhs.z > this.z) this.z = rhs.z;
			return this;
		};
		_proto.project = function project(rhs) {
			var a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
			var b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
			var s = a_dot_b / b_dot_b;
			this.x = rhs.x * s;
			this.y = rhs.y * s;
			this.z = rhs.z * s;
			return this;
		};
		_proto.set = function set(x, y, z) {
			this.x = x;
			this.y = y;
			this.z = z;
			return this;
		};
		_proto.sub = function sub(rhs) {
			this.x -= rhs.x;
			this.y -= rhs.y;
			this.z -= rhs.z;
			return this;
		};
		_proto.sub2 = function sub2(lhs, rhs) {
			this.x = lhs.x - rhs.x;
			this.y = lhs.y - rhs.y;
			this.z = lhs.z - rhs.z;
			return this;
		};
		_proto.subScalar = function subScalar(scalar) {
			this.x -= scalar;
			this.y -= scalar;
			this.z -= scalar;
			return this;
		};
		_proto.toString = function toString() {
			return "[" + this.x + ", " + this.y + ", " + this.z + "]";
		};
		return Vec3;
	}();
	_class$1 = Vec3;
	Vec3.ZERO = Object.freeze(new _class$1(0, 0, 0));
	Vec3.ONE = Object.freeze(new _class$1(1, 1, 1));
	Vec3.UP = Object.freeze(new _class$1(0, 1, 0));
	Vec3.DOWN = Object.freeze(new _class$1(0, -1, 0));
	Vec3.RIGHT = Object.freeze(new _class$1(1, 0, 0));
	Vec3.LEFT = Object.freeze(new _class$1(-1, 0, 0));
	Vec3.FORWARD = Object.freeze(new _class$1(0, 0, -1));
	Vec3.BACK = Object.freeze(new _class$1(0, 0, 1));

	var _class;
	var Vec4 = function () {
		function Vec4(x, y, z, w) {
			if (x === void 0) {
				x = 0;
			}
			if (y === void 0) {
				y = 0;
			}
			if (z === void 0) {
				z = 0;
			}
			if (w === void 0) {
				w = 0;
			}
			this.x = void 0;
			this.y = void 0;
			this.z = void 0;
			this.w = void 0;
			if (x.length === 4) {
				this.x = x[0];
				this.y = x[1];
				this.z = x[2];
				this.w = x[3];
			} else {
				this.x = x;
				this.y = y;
				this.z = z;
				this.w = w;
			}
		}
		var _proto = Vec4.prototype;
		_proto.add = function add(rhs) {
			this.x += rhs.x;
			this.y += rhs.y;
			this.z += rhs.z;
			this.w += rhs.w;
			return this;
		};
		_proto.add2 = function add2(lhs, rhs) {
			this.x = lhs.x + rhs.x;
			this.y = lhs.y + rhs.y;
			this.z = lhs.z + rhs.z;
			this.w = lhs.w + rhs.w;
			return this;
		};
		_proto.addScalar = function addScalar(scalar) {
			this.x += scalar;
			this.y += scalar;
			this.z += scalar;
			this.w += scalar;
			return this;
		};
		_proto.addScaled = function addScaled(rhs, scalar) {
			this.x += rhs.x * scalar;
			this.y += rhs.y * scalar;
			this.z += rhs.z * scalar;
			this.w += rhs.w * scalar;
			return this;
		};
		_proto.clone = function clone() {
			var cstr = this.constructor;
			return new cstr(this.x, this.y, this.z, this.w);
		};
		_proto.copy = function copy(rhs) {
			this.x = rhs.x;
			this.y = rhs.y;
			this.z = rhs.z;
			this.w = rhs.w;
			return this;
		};
		_proto.div = function div(rhs) {
			this.x /= rhs.x;
			this.y /= rhs.y;
			this.z /= rhs.z;
			this.w /= rhs.w;
			return this;
		};
		_proto.div2 = function div2(lhs, rhs) {
			this.x = lhs.x / rhs.x;
			this.y = lhs.y / rhs.y;
			this.z = lhs.z / rhs.z;
			this.w = lhs.w / rhs.w;
			return this;
		};
		_proto.divScalar = function divScalar(scalar) {
			this.x /= scalar;
			this.y /= scalar;
			this.z /= scalar;
			this.w /= scalar;
			return this;
		};
		_proto.dot = function dot(rhs) {
			return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z + this.w * rhs.w;
		};
		_proto.equals = function equals(rhs) {
			return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
		};
		_proto.equalsApprox = function equalsApprox(rhs, epsilon) {
			if (epsilon === void 0) {
				epsilon = 1e-6;
			}
			return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon && Math.abs(this.w - rhs.w) < epsilon;
		};
		_proto.length = function length() {
			return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
		};
		_proto.lengthSq = function lengthSq() {
			return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
		};
		_proto.lerp = function lerp(lhs, rhs, alpha) {
			this.x = lhs.x + alpha * (rhs.x - lhs.x);
			this.y = lhs.y + alpha * (rhs.y - lhs.y);
			this.z = lhs.z + alpha * (rhs.z - lhs.z);
			this.w = lhs.w + alpha * (rhs.w - lhs.w);
			return this;
		};
		_proto.mul = function mul(rhs) {
			this.x *= rhs.x;
			this.y *= rhs.y;
			this.z *= rhs.z;
			this.w *= rhs.w;
			return this;
		};
		_proto.mul2 = function mul2(lhs, rhs) {
			this.x = lhs.x * rhs.x;
			this.y = lhs.y * rhs.y;
			this.z = lhs.z * rhs.z;
			this.w = lhs.w * rhs.w;
			return this;
		};
		_proto.mulScalar = function mulScalar(scalar) {
			this.x *= scalar;
			this.y *= scalar;
			this.z *= scalar;
			this.w *= scalar;
			return this;
		};
		_proto.normalize = function normalize(src) {
			if (src === void 0) {
				src = this;
			}
			var lengthSq = src.x * src.x + src.y * src.y + src.z * src.z + src.w * src.w;
			if (lengthSq > 0) {
				var invLength = 1 / Math.sqrt(lengthSq);
				this.x = src.x * invLength;
				this.y = src.y * invLength;
				this.z = src.z * invLength;
				this.w = src.w * invLength;
			}
			return this;
		};
		_proto.floor = function floor(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.floor(src.x);
			this.y = Math.floor(src.y);
			this.z = Math.floor(src.z);
			this.w = Math.floor(src.w);
			return this;
		};
		_proto.ceil = function ceil(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.ceil(src.x);
			this.y = Math.ceil(src.y);
			this.z = Math.ceil(src.z);
			this.w = Math.ceil(src.w);
			return this;
		};
		_proto.round = function round(src) {
			if (src === void 0) {
				src = this;
			}
			this.x = Math.round(src.x);
			this.y = Math.round(src.y);
			this.z = Math.round(src.z);
			this.w = Math.round(src.w);
			return this;
		};
		_proto.min = function min(rhs) {
			if (rhs.x < this.x) this.x = rhs.x;
			if (rhs.y < this.y) this.y = rhs.y;
			if (rhs.z < this.z) this.z = rhs.z;
			if (rhs.w < this.w) this.w = rhs.w;
			return this;
		};
		_proto.max = function max(rhs) {
			if (rhs.x > this.x) this.x = rhs.x;
			if (rhs.y > this.y) this.y = rhs.y;
			if (rhs.z > this.z) this.z = rhs.z;
			if (rhs.w > this.w) this.w = rhs.w;
			return this;
		};
		_proto.set = function set(x, y, z, w) {
			this.x = x;
			this.y = y;
			this.z = z;
			this.w = w;
			return this;
		};
		_proto.sub = function sub(rhs) {
			this.x -= rhs.x;
			this.y -= rhs.y;
			this.z -= rhs.z;
			this.w -= rhs.w;
			return this;
		};
		_proto.sub2 = function sub2(lhs, rhs) {
			this.x = lhs.x - rhs.x;
			this.y = lhs.y - rhs.y;
			this.z = lhs.z - rhs.z;
			this.w = lhs.w - rhs.w;
			return this;
		};
		_proto.subScalar = function subScalar(scalar) {
			this.x -= scalar;
			this.y -= scalar;
			this.z -= scalar;
			this.w -= scalar;
			return this;
		};
		_proto.toString = function toString() {
			return "[" + this.x + ", " + this.y + ", " + this.z + ", " + this.w + "]";
		};
		return Vec4;
	}();
	_class = Vec4;
	Vec4.ZERO = Object.freeze(new _class(0, 0, 0, 0));
	Vec4.ONE = Object.freeze(new _class(1, 1, 1, 1));

	var ComponentSystem = function (_EventHandler) {
		_inheritsLoose(ComponentSystem, _EventHandler);
		function ComponentSystem(app) {
			var _this;
			_this = _EventHandler.call(this) || this;
			_this.app = app;
			_this.store = {};
			_this.schema = [];
			return _this;
		}
		var _proto = ComponentSystem.prototype;
		_proto.addComponent = function addComponent(entity, data) {
			if (data === void 0) {
				data = {};
			}
			var component = new this.ComponentType(this, entity);
			var componentData = new this.DataType();
			this.store[entity.getGuid()] = {
				entity: entity,
				data: componentData
			};
			entity[this.id] = component;
			entity.c[this.id] = component;
			this.initializeComponentData(component, data, []);
			this.fire('add', entity, component);
			return component;
		};
		_proto.removeComponent = function removeComponent(entity) {
			var record = this.store[entity.getGuid()];
			var component = entity.c[this.id];
			this.fire('beforeremove', entity, component);
			delete this.store[entity.getGuid()];
			entity[this.id] = undefined;
			delete entity.c[this.id];
			this.fire('remove', entity, record.data);
		};
		_proto.cloneComponent = function cloneComponent(entity, clone) {
			var src = this.store[entity.getGuid()];
			return this.addComponent(clone, src.data);
		};
		_proto.initializeComponentData = function initializeComponentData(component, data, properties) {
			if (data === void 0) {
				data = {};
			}
			for (var i = 0, len = properties.length; i < len; i++) {
				var descriptor = properties[i];
				var name = void 0,
					type = void 0;
				if (typeof descriptor === 'object') {
					name = descriptor.name;
					type = descriptor.type;
				} else {
					name = descriptor;
					type = undefined;
				}
				var value = data[name];
				if (value !== undefined) {
					if (type !== undefined) {
						value = convertValue(value, type);
					}
					component[name] = value;
				} else {
					component[name] = component.data[name];
				}
			}
			if (component.enabled && component.entity.enabled) {
				component.onEnable();
			}
		};
		_proto.getPropertiesOfType = function getPropertiesOfType(type) {
			var matchingProperties = [];
			var schema = this.schema || [];
			schema.forEach(function (descriptor) {
				if (descriptor && typeof descriptor === 'object' && descriptor.type === type) {
					matchingProperties.push(descriptor);
				}
			});
			return matchingProperties;
		};
		_proto.destroy = function destroy() {
			this.off();
		};
		return ComponentSystem;
	}(EventHandler);
	function convertValue(value, type) {
		if (!value) {
			return value;
		}
		switch (type) {
			case 'rgb':
				if (value instanceof Color) {
					return value.clone();
				}
				return new Color(value[0], value[1], value[2]);
			case 'rgba':
				if (value instanceof Color) {
					return value.clone();
				}
				return new Color(value[0], value[1], value[2], value[3]);
			case 'vec2':
				if (value instanceof Vec2) {
					return value.clone();
				}
				return new Vec2(value[0], value[1]);
			case 'vec3':
				if (value instanceof Vec3) {
					return value.clone();
				}
				return new Vec3(value[0], value[1], value[2]);
			case 'vec4':
				if (value instanceof Vec4) {
					return value.clone();
				}
				return new Vec4(value[0], value[1], value[2], value[3]);
			case 'boolean':
			case 'number':
			case 'string':
				return value;
			case 'entity':
				return value;
			default:
				throw new Error('Could not convert unhandled type: ' + type);
		}
	}

	var defaultPalette = new Uint8Array(new Uint32Array([0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff, 0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff, 0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff, 0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff, 0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc, 0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc, 0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc, 0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc, 0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc, 0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99, 0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999, 0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699, 0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099, 0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66, 0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66, 0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666, 0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366, 0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066, 0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33, 0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933, 0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633, 0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033, 0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00, 0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00, 0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600, 0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300, 0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000, 0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044, 0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700, 0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000, 0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd, 0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111]).buffer);
	var VoxPalette = function () {
	  function VoxPalette(paletteData) {
	    this.data = paletteData;
	    this.tmp = [0, 0, 0, 0];
	  }
	  var _proto = VoxPalette.prototype;
	  _proto.clr = function clr(index) {
	    var tmp = this.tmp;
	    tmp[0] = this.data[index * 4 + 0];
	    tmp[1] = this.data[index * 4 + 1];
	    tmp[2] = this.data[index * 4 + 2];
	    tmp[3] = this.data[index * 4 + 3];
	    return tmp;
	  };
	  return VoxPalette;
	}();
	var _x = 0;
	var _y = 2;
	var _z = 1;
	var VoxFrame = function () {
	  function VoxFrame(voxelData) {
	    this._data = voxelData;
	    this._bound = null;
	    this._flattened = null;
	  }
	  _createClass(VoxFrame, [{
	    key: "data",
	    get: function get() {
	      return this._data;
	    }
	  }, {
	    key: "numVoxels",
	    get: function get() {
	      return this.data.length / 4;
	    }
	  }, {
	    key: "bound",
	    get: function get() {
	      if (!this._bound) {
	        var data = this.data;
	        var min = [data[_x], data[_y], data[_z]];
	        var max = [data[_x], data[_y], data[_z]];
	        var numVoxels = this.numVoxels;
	        for (var i = 1; i < numVoxels; ++i) {
	          var x = data[i * 4 + _x];
	          var y = data[i * 4 + _y];
	          var z = data[i * 4 + _z];
	          if (x < min[0]) min[0] = x;else if (x > max[0]) max[0] = x;
	          if (y < min[1]) min[1] = y;else if (y > max[1]) max[1] = y;
	          if (z < min[2]) min[2] = z;else if (z > max[2]) max[2] = z;
	        }
	        this._bound = {
	          min: min,
	          max: max,
	          extent: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1]
	        };
	      }
	      return this._bound;
	    }
	  }, {
	    key: "flattened",
	    get: function get() {
	      if (!this._flattened) {
	        var data = this.data;
	        var min = this.bound.min;
	        var extent = this.bound.extent;
	        var flattenedData = new Uint8Array(extent[0] * extent[1] * extent[2]);
	        var numVoxels = this.numVoxels;
	        for (var i = 0; i < numVoxels; ++i) {
	          var index = data[i * 4 + _x] - min[0] + (data[i * 4 + _y] - min[1]) * extent[0] + (data[i * 4 + _z] - min[2]) * extent[0] * extent[1];
	          flattenedData[index] = data[i * 4 + 3];
	        }
	        this._flattened = {
	          extent: extent,
	          data: flattenedData,
	          at: function at(x, y, z) {
	            if (x < 0 || y < 0 || z < 0 || x >= extent[0] || y >= extent[1] || z >= extent[2]) {
	              return 0;
	            }
	            var index = x + y * extent[0] + z * extent[0] * extent[1];
	            return flattenedData[index];
	          }
	        };
	      }
	      return this._flattened;
	    }
	  }]);
	  return VoxFrame;
	}();
	var VoxModel = function () {
	  function VoxModel() {
	    this.frames = [];
	    this.palette = null;
	  }
	  var _proto2 = VoxModel.prototype;
	  _proto2.addFrame = function addFrame(frame) {
	    this.frames.push(frame);
	  };
	  _proto2.setPalette = function setPalette(palette) {
	    this.palette = palette;
	  };
	  return VoxModel;
	}();
	var VoxLoader = function () {
	  function VoxLoader() {}
	  VoxLoader.load = function load(arrayBuffer) {
	    var rs = new pc.ReadStream(arrayBuffer);
	    var readChunkHeader = function readChunkHeader() {
	      return {
	        id: rs.readChars(4),
	        numBytes: rs.readU32(),
	        numChildBytes: rs.readU32()
	      };
	    };
	    var fileId = rs.readChars(4);
	    if (fileId !== 'VOX ') {
	      console.log('invalid vox header');
	      return null;
	    }
	    var version = rs.readU32();
	    if (version !== 150) {
	      console.log('invalid vox version');
	      return null;
	    }
	    var mainChunk = readChunkHeader();
	    if (mainChunk.id !== 'MAIN') {
	      console.log('invalid first chunk in vox');
	      return null;
	    }
	    var voxModel = new VoxModel();
	    while (rs.offset < mainChunk.numChildBytes) {
	      var chunk = readChunkHeader();
	      switch (chunk.id) {
	        case 'XYZI':
	          {
	            var numVoxels = rs.readU32();
	            voxModel.addFrame(new VoxFrame(new Uint8Array(arrayBuffer, rs.offset, numVoxels * 4)));
	            rs.skip(numVoxels * 4);
	            break;
	          }
	        case 'RGBA':
	          {
	            var tmp = new Uint8Array(arrayBuffer, rs.offset, 256 * 4);
	            var data = new Uint8Array(256 * 4);
	            for (var i = 0; i < 255; ++i) {
	              data[(i + 1) * 4 + 0] = tmp[i * 4 + 0];
	              data[(i + 1) * 4 + 1] = tmp[i * 4 + 1];
	              data[(i + 1) * 4 + 2] = tmp[i * 4 + 2];
	              data[(i + 1) * 4 + 3] = tmp[i * 4 + 3];
	            }
	            voxModel.setPalette(new VoxPalette(new Uint8Array(data.buffer)));
	            rs.skip(256 * 6);
	            break;
	          }
	        default:
	          rs.skip(chunk.numBytes + chunk.numChildBytes);
	          break;
	      }
	    }
	    if (!voxModel.palette) {
	      voxModel.setPalette(new VoxPalette(defaultPalette));
	    }
	    return voxModel;
	  };
	  return VoxLoader;
	}();
	var vset = function vset(v0, v1) {
	  v0[0] = v1[0];
	  v0[1] = v1[1];
	  v0[2] = v1[2];
	};
	var vadd = function vadd(v0, v1) {
	  v0[0] += v1[0];
	  v0[1] += v1[1];
	  v0[2] += v1[2];
	};
	var vsub = function vsub(v0, v1) {
	  v0[0] -= v1[0];
	  v0[1] -= v1[1];
	  v0[2] -= v1[2];
	};
	var VoxGen = function () {
	  function VoxGen() {}
	  VoxGen.mesh = function mesh(device, voxMesh, frame) {
	    var voxFrame = voxMesh.frames[frame];
	    if (!voxFrame) {
	      return null;
	    }
	    var flattened = voxFrame.flattened;
	    var positions = [];
	    var normals = [];
	    var colors = [];
	    var indices = [];
	    var pos = [0, 0, 0];
	    var tmp = [0, 0, 0];
	    var quad = function quad(axis1, axis2, normal, paletteIndex) {
	      var baseIndex = positions.length / 3;
	      indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
	      vset(tmp, pos);
	      positions.push(tmp[0], tmp[1], tmp[2]);
	      vadd(tmp, axis1);
	      positions.push(tmp[0], tmp[1], tmp[2]);
	      vadd(tmp, axis2);
	      positions.push(tmp[0], tmp[1], tmp[2]);
	      vsub(tmp, axis1);
	      positions.push(tmp[0], tmp[1], tmp[2]);
	      normals.push(normal[0], normal[1], normal[2]);
	      normals.push(normal[0], normal[1], normal[2]);
	      normals.push(normal[0], normal[1], normal[2]);
	      normals.push(normal[0], normal[1], normal[2]);
	      var clr = voxMesh.palette.clr(paletteIndex);
	      colors.push(clr[0], clr[1], clr[2], clr[3]);
	      colors.push(clr[0], clr[1], clr[2], clr[3]);
	      colors.push(clr[0], clr[1], clr[2], clr[3]);
	      colors.push(clr[0], clr[1], clr[2], clr[3]);
	    };
	    var posX = [1, 0, 0];
	    var posY = [0, 1, 0];
	    var posZ = [0, 0, 1];
	    var negX = [-1, 0, 0];
	    var negY = [0, -1, 0];
	    var negZ = [0, 0, -1];
	    for (var z = 0; z <= flattened.extent[2]; ++z) {
	      pos[2] = z;
	      for (var y = 0; y <= flattened.extent[1]; ++y) {
	        pos[1] = y;
	        for (var x = 0; x <= flattened.extent[0]; ++x) {
	          pos[0] = x;
	          var v = flattened.at(x, y, z);
	          var px = flattened.at(x - 1, y, z);
	          var py = flattened.at(x, y - 1, z);
	          var pz = flattened.at(x, y, z - 1);
	          if (v !== 0) {
	            if (px === 0) {
	              quad(posZ, posY, negX, v);
	            }
	            if (py === 0) {
	              quad(posX, posZ, negY, v);
	            }
	            if (pz === 0) {
	              quad(posY, posX, negZ, v);
	            }
	          } else {
	            if (px !== 0) {
	              quad(posY, posZ, posX, px);
	            }
	            if (py !== 0) {
	              quad(posZ, posX, posY, py);
	            }
	            if (pz !== 0) {
	              quad(posX, posY, posZ, pz);
	            }
	          }
	        }
	      }
	    }
	    var mesh = new pc.Mesh(device);
	    mesh.setPositions(positions);
	    mesh.setNormals(normals);
	    mesh.setColors32(colors);
	    mesh.setIndices(indices);
	    mesh.update();
	    return mesh;
	  };
	  return VoxGen;
	}();
	var VoxContainerResource = function () {
	  function VoxContainerResource(device, voxModel) {
	    this.device = device;
	    this.voxModel = voxModel;
	  }
	  var _proto3 = VoxContainerResource.prototype;
	  _proto3.instantiateModelEntity = function instantiateModelEntity(options) {
	    return null;
	  };
	  _proto3.instantiateRenderEntity = function instantiateRenderEntity(options) {
	    var _this = this;
	    var material = new pc.StandardMaterial();
	    material.diffuseVertexColor = true;
	    var meshInstances = this.voxModel.frames.map(function (f, i) {
	      var mesh = VoxGen.mesh(_this.device, _this.voxModel, i);
	      return new pc.MeshInstance(mesh, material);
	    });
	    var entity = new pc.Entity();
	    entity.addComponent('render', {
	      material: material,
	      meshInstances: meshInstances
	    });
	    entity.addComponent('voxanim', {});
	    this.renders = [];
	    return entity;
	  };
	  return VoxContainerResource;
	}();
	var VoxAnimComponentSchema = ['enabled'];
	var VoxAnimComponentData = function VoxAnimComponentData() {
	  this.enabled = true;
	};
	var VoxAnimComponent = function (_Component) {
	  _inheritsLoose(VoxAnimComponent, _Component);
	  function VoxAnimComponent(system, entity) {
	    var _this2;
	    _this2 = _Component.call(this, system, entity) || this;
	    _this2.playing = true;
	    _this2.timer = 0;
	    _this2.fps = 10;
	    return _this2;
	  }
	  var _proto4 = VoxAnimComponent.prototype;
	  _proto4.update = function update(dt) {
	    var _this$entity$render, _this$entity$model;
	    if (this.playing) {
	      this.timer += dt;
	    }
	    var meshInstances = ((_this$entity$render = this.entity.render) == null ? void 0 : _this$entity$render.meshInstances) || ((_this$entity$model = this.entity.model) == null ? void 0 : _this$entity$model.meshInstances);
	    if (meshInstances) {
	      var frame = Math.floor(this.timer * this.fps) % meshInstances.length;
	      for (var i = 0; i < meshInstances.length; ++i) {
	        meshInstances[i].visible = i === frame;
	      }
	    }
	  };
	  return VoxAnimComponent;
	}(Component);
	var VoxAnimSystem = function (_ComponentSystem) {
	  _inheritsLoose(VoxAnimSystem, _ComponentSystem);
	  function VoxAnimSystem(app) {
	    var _this3;
	    _this3 = _ComponentSystem.call(this, app) || this;
	    _this3.id = 'voxanim';
	    _this3.ComponentType = VoxAnimComponent;
	    _this3.DataType = VoxAnimComponentData;
	    _this3.schema = VoxAnimComponentSchema;
	    _this3.app.systems.on('update', _this3.onUpdate, _assertThisInitialized(_this3));
	    return _this3;
	  }
	  var _proto5 = VoxAnimSystem.prototype;
	  _proto5.initializeComponentData = function initializeComponentData(component, data, properties) {
	    properties = ['playing', 'timer', 'fps'];
	    for (var i = 0; i < properties.length; i++) {
	      if (data.hasOwnProperty(properties[i])) {
	        component[properties[i]] = data[properties[i]];
	      }
	    }
	    _ComponentSystem.prototype.initializeComponentData.call(this, component, data, VoxAnimComponentSchema);
	  };
	  _proto5.cloneComponent = function cloneComponent(entity, clone) {
	    var srcComponent = entity.voxanim;
	    var cloneData = {
	      playing: srcComponent.playing,
	      timer: srcComponent.timer,
	      fps: srcComponent.fps
	    };
	    return this.addComponent(clone, cloneData);
	  };
	  _proto5.onUpdate = function onUpdate(dt) {
	    var components = this.store;
	    for (var id in components) {
	      if (components.hasOwnProperty(id)) {
	        var entity = components[id].entity;
	        if (entity.enabled) {
	          var component = entity.voxanim;
	          if (component.enabled) {
	            component.update(dt);
	          }
	        }
	      }
	    }
	  };
	  _proto5.destroy = function destroy() {
	    _ComponentSystem.prototype.destroy.call(this);
	    this.app.systems.off('update', this.onUpdate, this);
	  };
	  return VoxAnimSystem;
	}(ComponentSystem);
	Component._buildAccessors(VoxAnimComponent.prototype, VoxAnimComponentSchema);
	var VoxParser = function () {
	  function VoxParser(device, assets, maxRetries) {
	    this._device = device;
	    this._assets = assets;
	    this._maxRetries = maxRetries;
	  }
	  var _proto6 = VoxParser.prototype;
	  _proto6.load = function load(url, callback, asset) {
	    var _this4 = this;
	    pc.Asset.fetchArrayBuffer(url.load, function (err, result) {
	      if (err) {
	        callback(err);
	      } else {
	        callback(null, new VoxContainerResource(_this4._device, VoxLoader.load(result)));
	      }
	    }, asset, this._maxRetries);
	  };
	  _proto6.open = function open(url, data, asset) {
	    return data;
	  };
	  return VoxParser;
	}();
	var registerVoxParser = function registerVoxParser(app) {
	  app.systems.add(new VoxAnimSystem(app));
	  app.loader.getHandler("container").parsers.vox = new VoxParser(app.graphicsDevice, app.assets);
	};

	exports.registerVoxParser = registerVoxParser;

}));
