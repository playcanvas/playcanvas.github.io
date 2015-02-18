/*
 PlayCanvas Engine v0.165.0-dev
 revision 0ad5b13

 http://playcanvas.com
 Copyright 2011-2014 PlayCanvas Ltd. All rights reserved.
 Do not distribute.
 Contains: https://github.com/tildeio/rsvp.js - see page for license information
*/
var pc = {config:{}, common:{}, apps:{}, data:{}, unpack:function() {
  console.warn("pc.unpack has been deprecated and will be removed shortly. Please update your code.")
}, makeArray:function(arr) {
  var i, ret = [], length = arr.length;
  for(i = 0;i < length;++i) {
    ret.push(arr[i])
  }
  return ret
}, type:function(obj) {
  if(obj === null) {
    return"null"
  }
  var type = typeof obj;
  if(type == "undefined" || type == "number" || type == "string" || type == "boolean") {
    return type
  }
  return _typeLookup[Object.prototype.toString.call(obj)]
}, extend:function(target, ex) {
  var prop, copy;
  for(prop in ex) {
    copy = ex[prop];
    if(pc.type(copy) == "object") {
      target[prop] = pc.extend({}, copy)
    }else {
      if(pc.type(copy) == "array") {
        target[prop] = pc.extend([], copy)
      }else {
        target[prop] = copy
      }
    }
  }
  return target
}, isDefined:function(o) {
  var a;
  return o !== a
}};
var _typeLookup = function() {
  var result = {}, index, names = ["Array", "Object", "Function", "Date", "RegExp", "Float32Array"];
  for(index = 0;index < names.length;++index) {
    result["[object " + names[index] + "]"] = names[index].toLowerCase()
  }
  return result
}();
if(typeof exports !== "undefined") {
  exports.pc = pc
}
;(function() {
  if(typeof document === "undefined") {
    return
  }
  var fullscreenchange = function() {
    var e = document.createEvent("CustomEvent");
    e.initCustomEvent("fullscreenchange", true, false, null);
    document.dispatchEvent(e)
  };
  var fullscreenerror = function() {
    var e = document.createEvent("CustomEvent");
    e.initCustomEvent("fullscreenerror", true, false, null);
    document.dispatchEvent(e)
  };
  document.addEventListener("webkitfullscreenchange", fullscreenchange, false);
  document.addEventListener("mozfullscreenchange", fullscreenchange, false);
  document.addEventListener("MSFullscreenChange", fullscreenchange, false);
  document.addEventListener("webkitfullscreenerror", fullscreenerror, false);
  document.addEventListener("mozfullscreenerror", fullscreenerror, false);
  document.addEventListener("MSFullscreenError", fullscreenerror, false);
  if(Element.prototype.mozRequestFullScreen) {
    Element.prototype.requestFullscreen = function() {
      this.mozRequestFullScreen()
    }
  }else {
    Element.prototype.requestFullscreen = Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen || Element.prototype.msRequestFullscreen || function() {
    }
  }
  document.exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if(!document.fullscreenElement) {
    Object.defineProperty(document, "fullscreenElement", {enumerable:true, configurable:false, get:function() {
      return document.webkitCurrentFullScreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement
    }})
  }
  if(!document.fullscreenEnabled) {
    Object.defineProperty(document, "fullscreenEnabled", {enumerable:true, configurable:false, get:function() {
      return document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled
    }})
  }
})();
pc.extend(pc, function() {
  var Color = function() {
    this.data = new Float32Array(4);
    if(arguments.length >= 3) {
      this.data[0] = arguments[0];
      this.data[1] = arguments[1];
      this.data[2] = arguments[2];
      this.data[3] = arguments.length >= 4 ? arguments[3] : 1
    }else {
      this.data[0] = 0;
      this.data[1] = 0;
      this.data[2] = 0;
      this.data[3] = 1
    }
  };
  Color.prototype = {clone:function() {
    return new pc.Color(this.r, this.g, this.b, this.a)
  }, copy:function(rhs) {
    var a = this.data;
    var b = rhs.data;
    a[0] = b[0];
    a[1] = b[1];
    a[2] = b[2];
    a[3] = b[3];
    return this
  }, set:function(r, g, b, a) {
    var c = this.data;
    c[0] = r;
    c[1] = g;
    c[2] = b;
    c[3] = a === undefined ? 1 : a;
    return this
  }, fromString:function(hex) {
    var i = parseInt(hex.replace("#", "0x"));
    var bytes;
    if(hex.length > 7) {
      bytes = pc.math.intToBytes32(i)
    }else {
      bytes = pc.math.intToBytes24(i);
      bytes[3] = 255
    }
    this.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255);
    return this
  }, toString:function(alpha) {
    var s = "#" + ((1 << 24) + (parseInt(this.r * 255) << 16) + (parseInt(this.g * 255) << 8) + parseInt(this.b * 255)).toString(16).slice(1);
    if(alpha === true) {
      var a = parseInt(this.a * 255).toString(16);
      if(this.a < 16 / 255) {
        s += "0" + a
      }else {
        s += a
      }
    }
    return s
  }};
  Object.defineProperty(Color.prototype, "r", {get:function() {
    return this.data[0]
  }, set:function(value) {
    this.data[0] = value
  }});
  Object.defineProperty(Color.prototype, "g", {get:function() {
    return this.data[1]
  }, set:function(value) {
    this.data[1] = value
  }});
  Object.defineProperty(Color.prototype, "b", {get:function() {
    return this.data[2]
  }, set:function(value) {
    this.data[2] = value
  }});
  Object.defineProperty(Color.prototype, "a", {get:function() {
    return this.data[3]
  }, set:function(value) {
    this.data[3] = value
  }});
  return{Color:Color}
}());
pc.guid = function() {
  return{create:function() {
    return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
      return v.toString(16)
    })
  }}
}();
pc.extend(pc, function() {
  var Timer = function Timer() {
    this._isRunning = false;
    this._a = 0;
    this._b = 0
  };
  Timer.prototype = {start:function() {
    this._isRunning = true;
    this._a = (new Date).getTime()
  }, stop:function() {
    this._isRunning = false;
    this._b = (new Date).getTime()
  }, getMilliseconds:function() {
    return this._b - this._a
  }};
  return{Timer:Timer, now:function() {
    return(new Date).getTime()
  }}
}());
pc.extend(pc, function() {
  return{createURI:function(options) {
    var s = "";
    if((options.authority || options.scheme) && (options.host || options.hostpath)) {
      throw new Error("Can't have 'scheme' or 'authority' and 'host' or 'hostpath' option");
    }
    if(options.host && options.hostpath) {
      throw new Error("Can't have 'host' and 'hostpath' option");
    }
    if(options.path && options.hostpath) {
      throw new Error("Can't have 'path' and 'hostpath' option");
    }
    if(options.scheme) {
      s += options.scheme + ":"
    }
    if(options.authority) {
      s += "//" + options.authority
    }
    if(options.host) {
      s += options.host
    }
    if(options.path) {
      s += options.path
    }
    if(options.hostpath) {
      s += options.hostpath
    }
    if(options.query) {
      s += "?" + options.query
    }
    if(options.fragment) {
      s += "#" + options.fragment
    }
    return s
  }, URI:function(uri) {
    var re = /^(([^:\/?\#]+):)?(\/\/([^\/?\#]*))?([^?\#]*)(\?([^\#]*))?(\#(.*))?/, result = uri.match(re);
    this.scheme = result[2];
    this.authority = result[4];
    this.path = result[5];
    this.query = result[7];
    this.fragment = result[9];
    this.toString = function() {
      var s = "";
      if(this.scheme) {
        s += this.scheme + ":"
      }
      if(this.authority) {
        s += "//" + this.authority
      }
      s += this.path;
      if(this.query) {
        s += "?" + this.query
      }
      if(this.fragment) {
        s += "#" + this.fragment
      }
      return s
    };
    this.getQuery = function() {
      var vars;
      var pair;
      var result = {};
      if(this.query) {
        vars = decodeURIComponent(this.query).split("&");
        vars.forEach(function(item, index, arr) {
          pair = item.split("=");
          result[pair[0]] = pair[1]
        }, this)
      }
      return result
    };
    this.setQuery = function(params) {
      q = "";
      for(var key in params) {
        if(params.hasOwnProperty(key)) {
          if(q !== "") {
            q += "&"
          }
          q += encodeURIComponent(key) + "=" + encodeURIComponent(params[key])
        }
      }
      this.query = q
    }
  }}
}());
pc.extend(pc, function() {
  var log = {write:function(text) {
    console.log(text)
  }, open:function(text) {
    pc.log.write(Date())
  }, info:function(text) {
    console.info("INFO:    " + text)
  }, debug:function(text) {
    console.debug("DEBUG:   " + text)
  }, error:function(text) {
    console.error("ERROR:   " + text)
  }, warning:function(text) {
    console.warn("WARNING: " + text)
  }, alert:function(text) {
    pc.log.write("ALERT:   " + text);
    alert(text)
  }, assert:function(condition, text) {
    if(condition === false) {
      pc.log.write("ASSERT:  " + text);
      alert("ASSERT failed: " + text)
    }
  }};
  return{log:log}
}());
var logINFO = pc.log.info;
var logDEBUG = pc.log.debug;
var logWARNING = pc.log.warning;
var logERROR = pc.log.error;
var logALERT = pc.log.alert;
var logASSERT = pc.log.assert;
Function.prototype.extendsFrom = function(Super) {
  var Self;
  var Func;
  var Temp = function() {
  };
  Self = this;
  Func = function() {
    Super.apply(this, arguments);
    Self.apply(this, arguments);
    this.constructor = Self
  };
  Func._super = Super.prototype;
  Temp.prototype = Super.prototype;
  Func.prototype = new Temp;
  return Func
};
pc.extend(pc, function() {
  return{inherits:function(Self, Super) {
    var Temp = function() {
    };
    var Func = function() {
      Super.apply(this, arguments);
      Self.apply(this, arguments)
    };
    Func._super = Super.prototype;
    Temp.prototype = Super.prototype;
    Func.prototype = new Temp;
    return Func
  }}
}());
if(!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if(typeof this !== "function") {
      throw new TypeError("Function.prototype.bind - what is trying to be fBound is not callable");
    }
    var aArgs = Array.prototype.slice.call(arguments, 1), fToBind = this, fNOP = function() {
    }, fBound = function() {
      return fToBind.apply(this instanceof fNOP ? this : oThis || window, aArgs.concat(Array.prototype.slice.call(arguments)))
    };
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP;
    return fBound
  }
}
;pc.path = function() {
  return{delimiter:"/", join:function() {
    var index;
    var num = arguments.length;
    var result = arguments[0];
    for(index = 0;index < num - 1;++index) {
      var one = arguments[index];
      var two = arguments[index + 1];
      if(!pc.isDefined(one) || !pc.isDefined(two)) {
        throw new Error("undefined argument to pc.path.join");
      }
      if(two[0] === pc.path.delimiter) {
        result = two;
        continue
      }
      if(one && two && one[one.length - 1] !== pc.path.delimiter && two[0] !== pc.path.delimiter) {
        result += pc.path.delimiter + two
      }else {
        result += two
      }
    }
    return result
  }, split:function(path) {
    var parts = path.split(pc.path.delimiter);
    var tail = parts.slice(parts.length - 1)[0];
    var head = parts.slice(0, parts.length - 1).join(pc.path.delimiter);
    return[head, tail]
  }, getBasename:function(path) {
    return pc.path.split(path)[1]
  }, getDirectory:function(path) {
    var parts = path.split(pc.path.delimiter);
    return parts.slice(0, parts.length - 1).join(pc.path.delimiter)
  }, getExtension:function(path) {
    var ext = path.split(".").pop();
    if(ext !== path) {
      return"." + ext
    }else {
      return""
    }
  }, isRelativePath:function(s) {
    return s.charAt(0) !== "/" && s.match(/:\/\//) === null
  }, extractPath:function(s) {
    var path = ".", parts = s.split("/"), i = 0;
    if(parts.length > 1) {
      if(pc.path.isRelativePath(s) === false) {
        path = ""
      }
      for(i = 0;i < parts.length - 1;++i) {
        path += "/" + parts[i]
      }
    }
    return path
  }}
}();
pc.string = function() {
  return{ASCII_LOWERCASE:"abcdefghijklmnopqrstuvwxyz", ASCII_UPPERCASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZ", ASCII_LETTERS:this.ASCII_LOWERCASE + this.ASCII_UPPERCASE, format:function(s) {
    var i = 0, regexp, args = pc.makeArray(arguments);
    args.shift();
    for(i = 0;i < args.length;i++) {
      regexp = new RegExp("\\{" + i + "\\}", "gi");
      s = s.replace(regexp, args[i])
    }
    return s
  }, startsWith:function(s, subs) {
    return s.indexOf(subs) === 0
  }, endsWith:function(s, subs) {
    return s.lastIndexOf(subs, s.length - subs.length) !== -1
  }, toBool:function(s, strict) {
    if(s === "true") {
      return true
    }
    if(strict) {
      if(s === "false") {
        return false
      }
      throw new Error("Not a boolean string");
    }
    return false
  }}
}();
pc.extend(pc, function() {
  var json = {parse:function(value, reviver) {
    return JSON.parse(value, reviver)
  }, stringify:function(value, replacer, space) {
    return JSON.stringify(value, function(key, value) {
      if(this[key] instanceof Float32Array) {
        value = pc.makeArray(this[key])
      }
      return replacer ? replacer(key, value) : value
    }, space)
  }};
  return{json:json}
}());
pc.cookie = function() {
  return{set:function(name, value, options) {
    options = options || {};
    var cookie = name + "=" + value;
    if(options.path) {
      cookie += ";path=" + options.path
    }
    if(options.domain) {
      cookie += ";domain=" + options.domain
    }
    if(options.path) {
      cookie += ";path=" + options.path
    }
    if(options.secure) {
      cookie += ";secure"
    }
    if(options.lifetime) {
      cookie += ";max-age=" + options.lifetime * 24 * 60 * 60
    }else {
      cookie += ";max-age=" + 1 * 24 * 60 * 60
    }
    document.cookie = cookie
  }, get:function(name) {
    var cookie, cookies = document.cookie.split(";");
    var i, len = cookies.length;
    for(i = 0;i < len;i++) {
      cookie = cookies[i].trim();
      if(pc.string.startsWith(cookie, name)) {
        return cookie.split("=")[1]
      }
    }
  }, remove:function(name, options) {
    options.lifetime = 0;
    pc.cookie.set(name, "", options)
  }}
}();
pc.debug = function() {
  var table = null;
  var row = null;
  var title = null;
  var field = null;
  return{display:function(data) {
    function init() {
      table = document.createElement("table");
      row = document.createElement("tr");
      title = document.createElement("td");
      field = document.createElement("td");
      table.style.cssText = "position:absolute;font-family:sans-serif;font-size:12px;color:#cccccc";
      table.style.top = "0px";
      table.style.left = "0px";
      table.style.border = "thin solid #cccccc";
      document.body.appendChild(table)
    }
    if(!table) {
      init()
    }
    table.innerHTML = "";
    for(var key in data) {
      var r = row.cloneNode();
      var t = title.cloneNode();
      var f = field.cloneNode();
      t.textContent = key;
      f.textContent = data[key];
      r.appendChild(t);
      r.appendChild(f);
      table.appendChild(r)
    }
  }}
}();
pc.extend(pc, function() {
  var ObjectPool = function(constructor, options) {
    this.objects = [];
    this.ctor = constructor;
    this.name = options.name;
    this.useNew = options.useNew === undefined || options.useNew;
    this.metrics = options.metrics;
    if(options.metrics) {
      this.total = 0;
      this.used = 0
    }
  };
  ObjectPool.prototype = {_construct:function(constructor, args) {
    function F() {
      return constructor.apply(this, args)
    }
    F.prototype = constructor.prototype;
    return new F
  }, allocate:function() {
    var object;
    if(this.objects.length) {
      object = this.objects.pop();
      this.ctor.apply(object, arguments);
      if(this.metrics) {
        this.used++
      }
    }else {
      if(this.useNew) {
        object = this._construct(this.ctor, arguments)
      }else {
        object = this.ctor.apply(this, arguments)
      }
      if(this.metrics) {
        this.total++;
        this.used++
      }
    }
    return object
  }, free:function(object) {
    this.objects.push(object);
    if(this.metrics) {
      this.used--
    }
    if(object.onFree) {
      object.onFree()
    }
  }, usage:function() {
    return pc.string.format("{0} - total: {1}, used: {2}", this.name, this.total, this.used)
  }};
  var AllocatePool = function(constructor, size) {
    this._constructor = constructor;
    this._pool = [];
    this._count = 0;
    this._resize(size)
  };
  AllocatePool.prototype = {_resize:function(size) {
    if(size > this._pool.length) {
      for(var i = this._pool.length;i < size;i++) {
        this._pool[i] = new this._constructor
      }
    }
  }, allocate:function() {
    if(this._count >= this._pool.length) {
      this._resize(this._pool.length * 2)
    }
    return this._pool[this._count++]
  }, freeAll:function() {
    this._count = 0
  }};
  return{AllocatePool:AllocatePool, ObjectPool:ObjectPool}
}());
pc.events = function() {
  var Events = {attach:function(target) {
    var ev = pc.events;
    target.on = ev.on;
    target.off = ev.off;
    target.fire = ev.fire;
    target.hasEvent = ev.hasEvent;
    target.bind = ev.on;
    target.unbind = ev.off;
    return target
  }, on:function(name, callback, scope) {
    if(pc.type(name) != "string") {
      throw new TypeError("Event name must be a string");
    }
    var callbacks = this._callbacks || (this._callbacks = {});
    var events = callbacks[name] || (callbacks[name] = []);
    events.push({callback:callback, scope:scope || this});
    return this
  }, off:function(name, callback, scope) {
    var callbacks = this._callbacks;
    var events;
    var index;
    if(!callbacks) {
      return
    }
    if(!callback) {
      callbacks[name] = []
    }else {
      events = callbacks[name];
      if(!events) {
        return this
      }
      for(index = 0;index < events.length;index++) {
        if(events[index].callback === callback) {
          if(!scope || scope === events[index].scope) {
            events.splice(index, 1);
            index--
          }
        }
      }
    }
    return this
  }, fire:function(name) {
    var index;
    var length;
    var args;
    var callbacks;
    if(this._callbacks && this._callbacks[name]) {
      length = this._callbacks[name].length;
      if(length) {
        args = pc.makeArray(arguments);
        args.shift();
        callbacks = this._callbacks[name].slice();
        for(index = 0;index < length;++index) {
          var scope = callbacks[index].scope;
          callbacks[index].callback.apply(scope, args)
        }
      }
    }
    return this
  }, hasEvent:function(name) {
    return this._callbacks !== undefined && this._callbacks[name] !== undefined && this._callbacks[name].length > 0
  }};
  Events.bind = Events.on;
  Events.unbind = Events.off;
  return Events
}();
pc.dom = function() {
  return{getWidth:function(element) {
    return element.offsetWidth
  }, getHeight:function(element) {
    return element.offsetHeight
  }, setText:function(element, text) {
    if(element.textContent) {
      element.textContent = text
    }else {
      if(element.innerText) {
        element.innerText = text
      }
    }
  }, getText:function(element) {
    return element.textContent || element.innerText
  }}
}();
pc.math = {DEG_TO_RAD:Math.PI / 180, RAD_TO_DEG:180 / Math.PI, INV_LOG2:1 / Math.log(2), clamp:function(value, min, max) {
  if(value >= max) {
    return max
  }
  if(value <= min) {
    return min
  }
  return value
}, intToBytes24:function(i) {
  var r, g, b;
  r = i >> 16 & 255;
  g = i >> 8 & 255;
  b = i & 255;
  return[r, g, b]
}, intToBytes32:function(i) {
  var r, g, b, a;
  r = i >> 24 & 255;
  g = i >> 16 & 255;
  b = i >> 8 & 255;
  a = i & 255;
  return[r, g, b, a]
}, bytesToInt24:function(r, g, b) {
  if(r.length) {
    b = r[2];
    g = r[1];
    r = r[0]
  }
  return r << 16 | g << 8 | b
}, bytesToInt32:function(r, g, b, a) {
  if(r.length) {
    a = r[3];
    b = r[2];
    g = r[1];
    r = r[0]
  }
  return(r << 24 | g << 16 | b << 8 | a) >>> 32
}, lerp:function(a, b, alpha) {
  return a + (b - a) * pc.math.clamp(alpha, 0, 1)
}, lerpAngle:function(a, b, alpha) {
  if(b - a > 180) {
    b -= 360
  }
  if(b - a < -180) {
    b += 360
  }
  return pc.math.lerp(a, b, pc.math.clamp(alpha, 0, 1))
}, powerOfTwo:function(x) {
  return x !== 0 && !(x & x - 1)
}, nextPowerOfTwo:function(val) {
  val--;
  val = val >> 1 | val;
  val = val >> 2 | val;
  val = val >> 4 | val;
  val = val >> 8 | val;
  val = val >> 16 | val;
  val++;
  return val
}, random:function(min, max) {
  var diff = max - min;
  return Math.random() * diff + min
}, smoothstep:function(min, max, x) {
  if(x <= min) {
    return 0
  }
  if(x >= max) {
    return 1
  }
  x = (x - min) / (max - min);
  return x * x * (3 - 2 * x)
}, smootherstep:function(min, max, x) {
  if(x <= min) {
    return 0
  }
  if(x >= max) {
    return 1
  }
  x = (x - min) / (max - min);
  return x * x * x * (x * (x * 6 - 15) + 10)
}};
pc.math.intToBytes = pc.math.intToBytes32;
pc.math.bytesToInt = pc.math.bytesToInt32;
if(!Math.log2) {
  Math.log2 = function(x) {
    return Math.log(x) * this.INV_LOG2
  }
}
;pc.extend(pc, function() {
  var Vec2 = function() {
    this.data = new Float32Array(2);
    if(arguments.length === 2) {
      this.data.set(arguments)
    }else {
      this.data[0] = 0;
      this.data[1] = 0
    }
  };
  Vec2.prototype = {add:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] += b[0];
    a[1] += b[1];
    return this
  }, add2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + b[0];
    r[1] = a[1] + b[1];
    return this
  }, clone:function() {
    return(new Vec2).copy(this)
  }, copy:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] = b[0];
    a[1] = b[1];
    return this
  }, dot:function(rhs) {
    var a = this.data, b = rhs.data;
    return a[0] * b[0] + a[1] * b[1]
  }, equals:function(rhs) {
    var a = this.data, b = rhs.data;
    return a[0] === b[0] && a[1] === b[1]
  }, length:function() {
    var v = this.data;
    return Math.sqrt(v[0] * v[0] + v[1] * v[1])
  }, lengthSq:function() {
    var v = this.data;
    return v[0] * v[0] + v[1] * v[1]
  }, lerp:function(lhs, rhs, alpha) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + alpha * (b[0] - a[0]);
    r[1] = a[1] + alpha * (b[1] - a[1]);
    return this
  }, mul:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] *= b[0];
    a[1] *= b[1];
    return this
  }, mul2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] * b[0];
    r[1] = a[1] * b[1];
    return this
  }, normalize:function() {
    return this.scale(1 / this.length())
  }, scale:function(scalar) {
    var v = this.data;
    v[0] *= scalar;
    v[1] *= scalar;
    return this
  }, set:function(x, y) {
    var v = this.data;
    v[0] = x;
    v[1] = y;
    return this
  }, sub:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] -= b[0];
    a[1] -= b[1];
    return this
  }, sub2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] - b[0];
    r[1] = a[1] - b[1];
    return this
  }, toString:function() {
    return"[" + this.data[0] + ", " + this.data[1] + "]"
  }};
  Object.defineProperty(Vec2.prototype, "x", {get:function() {
    return this.data[0]
  }, set:function(value) {
    this.data[0] = value
  }});
  Object.defineProperty(Vec2.prototype, "y", {get:function() {
    return this.data[1]
  }, set:function(value) {
    this.data[1] = value
  }});
  Object.defineProperty(Vec2, "ONE", {get:function() {
    var one = new Vec2(1, 1);
    return function() {
      return one
    }
  }()});
  Object.defineProperty(Vec2, "RIGHT", {get:function() {
    var right = new Vec2(1, 0);
    return function() {
      return right
    }
  }()});
  Object.defineProperty(Vec2, "UP", {get:function() {
    var down = new Vec2(0, 1);
    return function() {
      return down
    }
  }()});
  Object.defineProperty(Vec2, "ZERO", {get:function() {
    var zero = new Vec2(0, 0);
    return function() {
      return zero
    }
  }()});
  return{Vec2:Vec2}
}());
pc.extend(pc, function() {
  var Vec3 = function() {
    this.data = new Float32Array(3);
    if(arguments.length === 3) {
      this.data.set(arguments)
    }else {
      this.data[0] = 0;
      this.data[1] = 0;
      this.data[2] = 0
    }
  };
  Vec3.prototype = {add:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] += b[0];
    a[1] += b[1];
    a[2] += b[2];
    return this
  }, add2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + b[0];
    r[1] = a[1] + b[1];
    r[2] = a[2] + b[2];
    return this
  }, clone:function() {
    return(new Vec3).copy(this)
  }, copy:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] = b[0];
    a[1] = b[1];
    a[2] = b[2];
    return this
  }, cross:function(lhs, rhs) {
    var a, b, r, ax, ay, az, bx, by, bz;
    a = lhs.data;
    b = rhs.data;
    r = this.data;
    ax = a[0];
    ay = a[1];
    az = a[2];
    bx = b[0];
    by = b[1];
    bz = b[2];
    r[0] = ay * bz - by * az;
    r[1] = az * bx - bz * ax;
    r[2] = ax * by - bx * ay;
    return this
  }, dot:function(rhs) {
    var a = this.data, b = rhs.data;
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  }, equals:function(rhs) {
    var a = this.data, b = rhs.data;
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
  }, length:function() {
    var v = this.data;
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  }, lengthSq:function() {
    var v = this.data;
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  }, lerp:function(lhs, rhs, alpha) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + alpha * (b[0] - a[0]);
    r[1] = a[1] + alpha * (b[1] - a[1]);
    r[2] = a[2] + alpha * (b[2] - a[2]);
    return this
  }, mul:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] *= b[0];
    a[1] *= b[1];
    a[2] *= b[2];
    return this
  }, mul2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] * b[0];
    r[1] = a[1] * b[1];
    r[2] = a[2] * b[2];
    return this
  }, normalize:function() {
    return this.scale(1 / this.length())
  }, project:function(rhs) {
    var a = this.data;
    var b = rhs.data;
    var a_dot_b = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    var b_dot_b = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    var s = a_dot_b / b_dot_b;
    a[0] = b[0] * s;
    a[1] = b[1] * s;
    a[2] = b[2] * s;
    return this
  }, scale:function(scalar) {
    var v = this.data;
    v[0] *= scalar;
    v[1] *= scalar;
    v[2] *= scalar;
    return this
  }, set:function(x, y, z) {
    var v = this.data;
    v[0] = x;
    v[1] = y;
    v[2] = z;
    return this
  }, sub:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] -= b[0];
    a[1] -= b[1];
    a[2] -= b[2];
    return this
  }, sub2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] - b[0];
    r[1] = a[1] - b[1];
    r[2] = a[2] - b[2];
    return this
  }, toString:function() {
    return"[" + this.data[0] + ", " + this.data[1] + ", " + this.data[2] + "]"
  }};
  Object.defineProperty(Vec3.prototype, "x", {get:function() {
    return this.data[0]
  }, set:function(value) {
    this.data[0] = value
  }});
  Object.defineProperty(Vec3.prototype, "y", {get:function() {
    return this.data[1]
  }, set:function(value) {
    this.data[1] = value
  }});
  Object.defineProperty(Vec3.prototype, "z", {get:function() {
    return this.data[2]
  }, set:function(value) {
    this.data[2] = value
  }});
  Object.defineProperty(Vec3, "BACK", {get:function() {
    var back = new Vec3(0, 0, 1);
    return function() {
      return back
    }
  }()});
  Object.defineProperty(Vec3, "DOWN", {get:function() {
    var down = new Vec3(0, -1, 0);
    return function() {
      return down
    }
  }()});
  Object.defineProperty(Vec3, "FORWARD", {get:function() {
    var forward = new Vec3(0, 0, -1);
    return function() {
      return forward
    }
  }()});
  Object.defineProperty(Vec3, "LEFT", {get:function() {
    var left = new Vec3(-1, 0, 0);
    return function() {
      return left
    }
  }()});
  Object.defineProperty(Vec3, "ONE", {get:function() {
    var one = new Vec3(1, 1, 1);
    return function() {
      return one
    }
  }()});
  Object.defineProperty(Vec3, "RIGHT", {get:function() {
    var right = new Vec3(1, 0, 0);
    return function() {
      return right
    }
  }()});
  Object.defineProperty(Vec3, "UP", {get:function() {
    var down = new Vec3(0, 1, 0);
    return function() {
      return down
    }
  }()});
  Object.defineProperty(Vec3, "ZERO", {get:function() {
    var zero = new Vec3(0, 0, 0);
    return function() {
      return zero
    }
  }()});
  return{Vec3:Vec3}
}());
pc.extend(pc, function() {
  var Vec4 = function() {
    this.data = new Float32Array(4);
    if(arguments.length === 4) {
      this.data.set(arguments)
    }else {
      this.data[0] = 0;
      this.data[1] = 0;
      this.data[2] = 0;
      this.data[3] = 0
    }
  };
  Vec4.prototype = {add:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] += b[0];
    a[1] += b[1];
    a[2] += b[2];
    a[3] += b[3];
    return this
  }, add2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + b[0];
    r[1] = a[1] + b[1];
    r[2] = a[2] + b[2];
    r[3] = a[3] + b[3];
    return this
  }, clone:function() {
    return(new Vec4).copy(this)
  }, copy:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] = b[0];
    a[1] = b[1];
    a[2] = b[2];
    a[3] = b[3];
    return this
  }, dot:function(rhs) {
    var a = this.data, b = rhs.data;
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  }, equals:function(rhs) {
    var a = this.data, b = rhs.data;
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
  }, length:function() {
    var v = this.data;
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3])
  }, lengthSq:function() {
    var v = this.data;
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]
  }, lerp:function(lhs, rhs, alpha) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + alpha * (b[0] - a[0]);
    r[1] = a[1] + alpha * (b[1] - a[1]);
    r[2] = a[2] + alpha * (b[2] - a[2]);
    r[3] = a[3] + alpha * (b[3] - a[3]);
    return this
  }, mul:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] *= b[0];
    a[1] *= b[1];
    a[2] *= b[2];
    a[3] *= b[3];
    return this
  }, mul2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] * b[0];
    r[1] = a[1] * b[1];
    r[2] = a[2] * b[2];
    r[3] = a[3] * b[3];
    return this
  }, normalize:function() {
    return this.scale(1 / this.length())
  }, scale:function(scalar) {
    var v = this.data;
    v[0] *= scalar;
    v[1] *= scalar;
    v[2] *= scalar;
    v[3] *= scalar;
    return this
  }, set:function(x, y, z, w) {
    var v = this.data;
    v[0] = x;
    v[1] = y;
    v[2] = z;
    v[3] = w;
    return this
  }, sub:function(rhs) {
    var a = this.data, b = rhs.data;
    a[0] -= b[0];
    a[1] -= b[1];
    a[2] -= b[2];
    a[3] -= b[3];
    return this
  }, sub2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] - b[0];
    r[1] = a[1] - b[1];
    r[2] = a[2] - b[2];
    r[3] = a[3] - b[3];
    return this
  }, toString:function() {
    return"[" + this.data[0] + ", " + this.data[1] + ", " + this.data[2] + ", " + this.data[3] + "]"
  }};
  Object.defineProperty(Vec4.prototype, "x", {get:function() {
    return this.data[0]
  }, set:function(value) {
    this.data[0] = value
  }});
  Object.defineProperty(Vec4.prototype, "y", {get:function() {
    return this.data[1]
  }, set:function(value) {
    this.data[1] = value
  }});
  Object.defineProperty(Vec4.prototype, "z", {get:function() {
    return this.data[2]
  }, set:function(value) {
    this.data[2] = value
  }});
  Object.defineProperty(Vec4.prototype, "w", {get:function() {
    return this.data[3]
  }, set:function(value) {
    this.data[3] = value
  }});
  Object.defineProperty(Vec4, "ONE", {get:function() {
    var one = new Vec4(1, 1, 1, 1);
    return function() {
      return one
    }
  }()});
  Object.defineProperty(Vec4, "ZERO", {get:function() {
    var zero = new Vec4(0, 0, 0, 0);
    return function() {
      return zero
    }
  }()});
  return{Vec4:Vec4}
}());
pc.extend(pc, function() {
  var Mat3 = function() {
    this.data = new Float32Array(9);
    if(arguments.length === 9) {
      this.data.set(arguments)
    }else {
      this.setIdentity()
    }
  };
  Mat3.prototype = {clone:function() {
    return(new pc.Mat3).copy(this)
  }, copy:function(rhs) {
    var src = rhs.data;
    var dst = this.data;
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    dst[4] = src[4];
    dst[5] = src[5];
    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];
    return this
  }, equals:function(rhs) {
    var l = this.data;
    var r = rhs.data;
    return l[0] === r[0] && l[1] === r[1] && l[2] === r[2] && l[3] === r[3] && l[4] === r[4] && l[5] === r[5] && l[6] === r[6] && l[7] === r[7] && l[8] === r[8]
  }, isIdentity:function() {
    var m = this.data;
    return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 1 && m[5] === 0 && m[6] === 0 && m[7] === 0 && m[8] === 1
  }, setIdentity:function() {
    var m = this.data;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this
  }, toString:function() {
    var t = "[";
    for(var i = 0;i < 9;i++) {
      t += this.data[i];
      t += i !== 9 ? ", " : ""
    }
    t += "]";
    return t
  }, transpose:function() {
    var m = this.data;
    var tmp;
    tmp = m[1];
    m[1] = m[3];
    m[3] = tmp;
    tmp = m[2];
    m[2] = m[6];
    m[6] = tmp;
    tmp = m[5];
    m[5] = m[7];
    m[7] = tmp;
    return this
  }};
  Object.defineProperty(Mat3, "IDENTITY", {get:function() {
    var identity = new Mat3;
    return function() {
      return identity
    }
  }()});
  Object.defineProperty(Mat3, "ZERO", {get:function() {
    var zero = new Mat3(0, 0, 0, 0, 0, 0, 0, 0, 0);
    return function() {
      return zero
    }
  }()});
  return{Mat3:Mat3}
}());
pc.extend(pc, function() {
  var Mat4 = function() {
    this.data = new Float32Array(16);
    if(arguments.length === 16) {
      this.data.set(arguments)
    }else {
      this.setIdentity()
    }
  };
  Mat4.prototype = {add2:function(lhs, rhs) {
    var a = lhs.data, b = rhs.data, r = this.data;
    r[0] = a[0] + b[0];
    r[1] = a[1] + b[1];
    r[2] = a[2] + b[2];
    r[3] = a[3] + b[3];
    r[4] = a[4] + b[4];
    r[5] = a[5] + b[5];
    r[6] = a[6] + b[6];
    r[7] = a[7] + b[7];
    r[8] = a[8] + b[8];
    r[9] = a[9] + b[9];
    r[10] = a[10] + b[10];
    r[11] = a[11] + b[11];
    r[12] = a[12] + b[12];
    r[13] = a[13] + b[13];
    r[14] = a[14] + b[14];
    r[15] = a[15] + b[15];
    return this
  }, add:function(rhs) {
    return this.add2(this, rhs)
  }, clone:function() {
    return(new pc.Mat4).copy(this)
  }, copy:function(rhs) {
    var src = rhs.data, dst = this.data;
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    dst[4] = src[4];
    dst[5] = src[5];
    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];
    dst[9] = src[9];
    dst[10] = src[10];
    dst[11] = src[11];
    dst[12] = src[12];
    dst[13] = src[13];
    dst[14] = src[14];
    dst[15] = src[15];
    return this
  }, equals:function(rhs) {
    var l = this.data, r = rhs.data;
    return l[0] === r[0] && l[1] === r[1] && l[2] === r[2] && l[3] === r[3] && l[4] === r[4] && l[5] === r[5] && l[6] === r[6] && l[7] === r[7] && l[8] === r[8] && l[9] === r[9] && l[10] === r[10] && l[11] === r[11] && l[12] === r[12] && l[13] === r[13] && l[14] === r[14] && l[15] === r[15]
  }, isIdentity:function() {
    var m = this.data;
    return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 0 && m[5] === 1 && m[6] === 0 && m[7] === 0 && m[8] === 0 && m[9] === 0 && m[10] === 1 && m[11] === 0 && m[12] === 0 && m[13] === 0 && m[14] === 0 && m[15] === 1
  }, mul2:function(lhs, rhs) {
    var a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33, b0, b1, b2, b3, a = lhs.data, b = rhs.data, r = this.data;
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    a30 = a[12];
    a31 = a[13];
    a32 = a[14];
    a33 = a[15];
    b0 = b[0];
    b1 = b[1];
    b2 = b[2];
    b3 = b[3];
    r[0] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    r[4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[5] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[6] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[7] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    r[8] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[9] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[10] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[11] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[15] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    return this
  }, mul:function(rhs) {
    return this.mul2(this, rhs)
  }, transformPoint:function(vec, res) {
    var x, y, z, m = this.data, v = vec.data;
    res = res === undefined ? new pc.Vec3 : res;
    x = v[0] * m[0] + v[1] * m[4] + v[2] * m[8] + m[12];
    y = v[0] * m[1] + v[1] * m[5] + v[2] * m[9] + m[13];
    z = v[0] * m[2] + v[1] * m[6] + v[2] * m[10] + m[14];
    return res.set(x, y, z)
  }, transformVector:function(vec, res) {
    var x, y, z, m = this.data, v = vec.data;
    res = res === undefined ? new pc.Vec3 : res;
    x = v[0] * m[0] + v[1] * m[4] + v[2] * m[8];
    y = v[0] * m[1] + v[1] * m[5] + v[2] * m[9];
    z = v[0] * m[2] + v[1] * m[6] + v[2] * m[10];
    return res.set(x, y, z)
  }, setLookAt:function() {
    var x, y, z;
    x = new pc.Vec3;
    y = new pc.Vec3;
    z = new pc.Vec3;
    return function(position, target, up) {
      z.sub2(position, target).normalize();
      y.copy(up).normalize();
      x.cross(y, z).normalize();
      y.cross(z, x);
      var r = this.data;
      r[0] = x.x;
      r[1] = x.y;
      r[2] = x.z;
      r[3] = 0;
      r[4] = y.x;
      r[5] = y.y;
      r[6] = y.z;
      r[7] = 0;
      r[8] = z.x;
      r[9] = z.y;
      r[10] = z.z;
      r[11] = 0;
      r[12] = position.x;
      r[13] = position.y;
      r[14] = position.z;
      r[15] = 1;
      return this
    }
  }(), setFrustum:function(left, right, bottom, top, znear, zfar) {
    var temp1, temp2, temp3, temp4, r;
    temp1 = 2 * znear;
    temp2 = right - left;
    temp3 = top - bottom;
    temp4 = zfar - znear;
    r = this.data;
    r[0] = temp1 / temp2;
    r[1] = 0;
    r[2] = 0;
    r[3] = 0;
    r[4] = 0;
    r[5] = temp1 / temp3;
    r[6] = 0;
    r[7] = 0;
    r[8] = (right + left) / temp2;
    r[9] = (top + bottom) / temp3;
    r[10] = (-zfar - znear) / temp4;
    r[11] = -1;
    r[12] = 0;
    r[13] = 0;
    r[14] = -temp1 * zfar / temp4;
    r[15] = 0;
    return this
  }, setPerspective:function(fovy, aspect, znear, zfar) {
    var xmax, ymax;
    ymax = znear * Math.tan(fovy * Math.PI / 360);
    xmax = ymax * aspect;
    return this.setFrustum(-xmax, xmax, -ymax, ymax, znear, zfar)
  }, setOrtho:function(left, right, bottom, top, near, far) {
    var r = this.data;
    r[0] = 2 / (right - left);
    r[1] = 0;
    r[2] = 0;
    r[3] = 0;
    r[4] = 0;
    r[5] = 2 / (top - bottom);
    r[6] = 0;
    r[7] = 0;
    r[8] = 0;
    r[9] = 0;
    r[10] = -2 / (far - near);
    r[11] = 0;
    r[12] = -(right + left) / (right - left);
    r[13] = -(top + bottom) / (top - bottom);
    r[14] = -(far + near) / (far - near);
    r[15] = 1;
    return this
  }, setFromAxisAngle:function(axis, angle) {
    var x, y, z, c, s, t, tx, ty, m;
    angle *= pc.math.DEG_TO_RAD;
    x = axis.x;
    y = axis.y;
    z = axis.z;
    c = Math.cos(angle);
    s = Math.sin(angle);
    t = 1 - c;
    tx = t * x;
    ty = t * y;
    m = this.data;
    m[0] = tx * x + c;
    m[1] = tx * y + s * z;
    m[2] = tx * z - s * y;
    m[3] = 0;
    m[4] = tx * y - s * z;
    m[5] = ty * y + c;
    m[6] = ty * z + s * x;
    m[7] = 0;
    m[8] = tx * z + s * y;
    m[9] = ty * z - x * s;
    m[10] = t * z * z + c;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this
  }, setTranslate:function(tx, ty, tz) {
    var m = this.data;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = 0;
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    m[15] = 1;
    return this
  }, setScale:function(sx, sy, sz) {
    var m = this.data;
    m[0] = sx;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = sy;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = sz;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this
  }, invert:function() {
    var a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33, b00, b01, b02, b03, b04, b05, b06, b07, b08, b09, b10, b11, invDet, m;
    m = this.data;
    a00 = m[0];
    a01 = m[1];
    a02 = m[2];
    a03 = m[3];
    a10 = m[4];
    a11 = m[5];
    a12 = m[6];
    a13 = m[7];
    a20 = m[8];
    a21 = m[9];
    a22 = m[10];
    a23 = m[11];
    a30 = m[12];
    a31 = m[13];
    a32 = m[14];
    a33 = m[15];
    b00 = a00 * a11 - a01 * a10;
    b01 = a00 * a12 - a02 * a10;
    b02 = a00 * a13 - a03 * a10;
    b03 = a01 * a12 - a02 * a11;
    b04 = a01 * a13 - a03 * a11;
    b05 = a02 * a13 - a03 * a12;
    b06 = a20 * a31 - a21 * a30;
    b07 = a20 * a32 - a22 * a30;
    b08 = a20 * a33 - a23 * a30;
    b09 = a21 * a32 - a22 * a31;
    b10 = a21 * a33 - a23 * a31;
    b11 = a22 * a33 - a23 * a32;
    invDet = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    m[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
    m[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
    m[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
    m[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
    m[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
    m[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
    m[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
    m[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
    m[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
    m[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
    m[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
    m[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
    m[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
    m[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
    m[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
    m[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
    return this
  }, setIdentity:function() {
    var m = this.data;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this
  }, setTRS:function(t, r, s) {
    var tx, ty, tz, qx, qy, qz, qw, sx, sy, sz, x2, y2, z2, xx, xy, xz, yy, yz, zz, wx, wy, wz, m;
    tx = t.x;
    ty = t.y;
    tz = t.z;
    qx = r.x;
    qy = r.y;
    qz = r.z;
    qw = r.w;
    sx = s.x;
    sy = s.y;
    sz = s.z;
    x2 = qx + qx;
    y2 = qy + qy;
    z2 = qz + qz;
    xx = qx * x2;
    xy = qx * y2;
    xz = qx * z2;
    yy = qy * y2;
    yz = qy * z2;
    zz = qz * z2;
    wx = qw * x2;
    wy = qw * y2;
    wz = qw * z2;
    m = this.data;
    m[0] = (1 - (yy + zz)) * sx;
    m[1] = (xy + wz) * sx;
    m[2] = (xz - wy) * sx;
    m[3] = 0;
    m[4] = (xy - wz) * sy;
    m[5] = (1 - (xx + zz)) * sy;
    m[6] = (yz + wx) * sy;
    m[7] = 0;
    m[8] = (xz + wy) * sz;
    m[9] = (yz - wx) * sz;
    m[10] = (1 - (xx + yy)) * sz;
    m[11] = 0;
    m[12] = tx;
    m[13] = ty;
    m[14] = tz;
    m[15] = 1;
    return this
  }, transpose:function() {
    var tmp, m = this.data;
    tmp = m[1];
    m[1] = m[4];
    m[4] = tmp;
    tmp = m[2];
    m[2] = m[8];
    m[8] = tmp;
    tmp = m[3];
    m[3] = m[12];
    m[12] = tmp;
    tmp = m[6];
    m[6] = m[9];
    m[9] = tmp;
    tmp = m[7];
    m[7] = m[13];
    m[13] = tmp;
    tmp = m[11];
    m[11] = m[14];
    m[14] = tmp;
    return this
  }, invertTo3x3:function(res) {
    var a11, a21, a31, a12, a22, a32, a13, a23, a33, m, r, det, idet;
    m = this.data;
    r = res.data;
    a11 = m[10] * m[5] - m[6] * m[9];
    a21 = -m[10] * m[1] + m[2] * m[9];
    a31 = m[6] * m[1] - m[2] * m[5];
    a12 = -m[10] * m[4] + m[6] * m[8];
    a22 = m[10] * m[0] - m[2] * m[8];
    a32 = -m[6] * m[0] + m[2] * m[4];
    a13 = m[9] * m[4] - m[5] * m[8];
    a23 = -m[9] * m[0] + m[1] * m[8];
    a33 = m[5] * m[0] - m[1] * m[4];
    det = m[0] * a11 + m[1] * a12 + m[2] * a13;
    if(det === 0) {
      console.warn("pc.Mat4#invertTo3x3: Matrix not invertible");
      return this
    }
    idet = 1 / det;
    r[0] = idet * a11;
    r[1] = idet * a21;
    r[2] = idet * a31;
    r[3] = idet * a12;
    r[4] = idet * a22;
    r[5] = idet * a32;
    r[6] = idet * a13;
    r[7] = idet * a23;
    r[8] = idet * a33;
    return this
  }, getTranslation:function(t) {
    t = t === undefined ? new pc.Vec3 : t;
    return t.set(this.data[12], this.data[13], this.data[14])
  }, getX:function(x) {
    x = x === undefined ? new pc.Vec3 : x;
    return x.set(this.data[0], this.data[1], this.data[2])
  }, getY:function(y) {
    y = y === undefined ? new pc.Vec3 : y;
    return y.set(this.data[4], this.data[5], this.data[6])
  }, getZ:function(z) {
    z = z === undefined ? new pc.Vec3 : z;
    return z.set(this.data[8], this.data[9], this.data[10])
  }, getScale:function() {
    var x, y, z;
    x = new pc.Vec3;
    y = new pc.Vec3;
    z = new pc.Vec3;
    return function(scale) {
      scale = scale === undefined ? new pc.Vec3 : scale;
      this.getX(x);
      this.getY(y);
      this.getZ(z);
      scale.set(x.length(), y.length(), z.length());
      return scale
    }
  }(), setFromEulerAngles:function(ex, ey, ez) {
    var s1, c1, s2, c2, s3, c3, m;
    ex *= pc.math.DEG_TO_RAD;
    ey *= pc.math.DEG_TO_RAD;
    ez *= pc.math.DEG_TO_RAD;
    s1 = Math.sin(-ex);
    c1 = Math.cos(-ex);
    s2 = Math.sin(-ey);
    c2 = Math.cos(-ey);
    s3 = Math.sin(-ez);
    c3 = Math.cos(-ez);
    m = this.data;
    m[0] = c2 * c3;
    m[1] = -c2 * s3;
    m[2] = s2;
    m[3] = 0;
    m[4] = c1 * s3 + c3 * s1 * s2;
    m[5] = c1 * c3 - s1 * s2 * s3;
    m[6] = -c2 * s1;
    m[7] = 0;
    m[8] = s1 * s3 - c1 * c3 * s2;
    m[9] = c3 * s1 + c1 * s2 * s3;
    m[10] = c1 * c2;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this
  }, getEulerAngles:function() {
    var scale = new pc.Vec3;
    return function(eulers) {
      var x, y, z, sx, sy, sz, m, halfPi;
      eulers = eulers === undefined ? new pc.Vec3 : eulers;
      this.getScale(scale);
      sx = scale.x;
      sy = scale.y;
      sz = scale.z;
      m = this.data;
      y = Math.asin(-m[2] / sx);
      halfPi = Math.PI * 0.5;
      if(y < halfPi) {
        if(y > -halfPi) {
          x = Math.atan2(m[6] / sy, m[10] / sz);
          z = Math.atan2(m[1] / sx, m[0] / sx)
        }else {
          z = 0;
          x = -Math.atan2(m[4] / sy, m[5] / sy)
        }
      }else {
        z = 0;
        x = Math.atan2(m[4] / sy, m[5] / sy)
      }
      return eulers.set(x, y, z).scale(pc.math.RAD_TO_DEG)
    }
  }(), toString:function() {
    var i, t;
    t = "[";
    for(i = 0;i < 16;i += 1) {
      t += this.data[i];
      t += i !== 15 ? ", " : ""
    }
    t += "]";
    return t
  }};
  Object.defineProperty(Mat4, "IDENTITY", {get:function() {
    var identity = new Mat4;
    return function() {
      return identity
    }
  }()});
  Object.defineProperty(Mat4, "ZERO", {get:function() {
    var zero = new Mat4(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    return function() {
      return zero
    }
  }()});
  return{Mat4:Mat4}
}());
pc.extend(pc, function() {
  var Quat = function(x, y, z, w) {
    this.x = x === undefined ? 0 : x;
    this.y = y === undefined ? 0 : y;
    this.z = z === undefined ? 0 : z;
    this.w = w === undefined ? 1 : w
  };
  Quat.prototype = {clone:function() {
    return new pc.Quat(this.x, this.y, this.z, this.w)
  }, conjugate:function() {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this
  }, copy:function(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    this.w = rhs.w;
    return this
  }, equals:function(that) {
    return this.x === that.x && this.y === that.y && this.z === that.z && this.w === that.w
  }, getEulerAngles:function(eulers) {
    var x, y, z, qx, qy, qz, qw, a2;
    eulers = eulers === undefined ? new pc.Vec3 : eulers;
    qx = this.x;
    qy = this.y;
    qz = this.z;
    qw = this.w;
    a2 = 2 * (qw * qy - qx * qz);
    if(a2 <= -0.99999) {
      x = 2 * Math.atan2(qx, qw);
      y = -Math.PI / 2;
      z = 0
    }else {
      if(a2 >= 0.99999) {
        x = 2 * Math.atan2(qx, qw);
        y = Math.PI / 2;
        z = 0
      }else {
        x = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
        y = Math.asin(a2);
        z = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
      }
    }
    return eulers.set(x, y, z).scale(pc.math.RAD_TO_DEG)
  }, invert:function() {
    return this.conjugate().normalize()
  }, length:function() {
    var x, y, z, w;
    x = this.x;
    y = this.y;
    z = this.z;
    w = this.w;
    return Math.sqrt(x * x + y * y + z * z + w * w)
  }, lengthSq:function() {
    var v = this.data;
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  }, mul:function(rhs) {
    var q1x, q1y, q1z, q1w, q2x, q2y, q2z, q2w;
    q1x = this.x;
    q1y = this.y;
    q1z = this.z;
    q1w = this.w;
    q2x = rhs.x;
    q2y = rhs.y;
    q2z = rhs.z;
    q2w = rhs.w;
    this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
    this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
    this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
    this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
    return this
  }, mul2:function(lhs, rhs) {
    var q1x, q1y, q1z, q1w, q2x, q2y, q2z, q2w;
    q1x = lhs.x;
    q1y = lhs.y;
    q1z = lhs.z;
    q1w = lhs.w;
    q2x = rhs.x;
    q2y = rhs.y;
    q2z = rhs.z;
    q2w = rhs.w;
    this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
    this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
    this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
    this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
    return this
  }, normalize:function() {
    var len = this.length();
    if(len === 0) {
      this.x = this.y = this.z = 0;
      this.w = 1
    }else {
      len = 1 / len;
      this.x *= len;
      this.y *= len;
      this.z *= len;
      this.w *= len
    }
    return this
  }, set:function(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this
  }, setFromAxisAngle:function(axis, angle) {
    var sa, ca;
    angle *= 0.5 * pc.math.DEG_TO_RAD;
    sa = Math.sin(angle);
    ca = Math.cos(angle);
    this.x = sa * axis.x;
    this.y = sa * axis.y;
    this.z = sa * axis.z;
    this.w = ca;
    return this
  }, setFromEulerAngles:function(ex, ey, ez) {
    var sx, cx, sy, cy, sz, cz, halfToRad;
    halfToRad = 0.5 * pc.math.DEG_TO_RAD;
    ex *= halfToRad;
    ey *= halfToRad;
    ez *= halfToRad;
    sx = Math.sin(ex);
    cx = Math.cos(ex);
    sy = Math.sin(ey);
    cy = Math.cos(ey);
    sz = Math.sin(ez);
    cz = Math.cos(ez);
    this.x = sx * cy * cz - cx * sy * sz;
    this.y = cx * sy * cz + sx * cy * sz;
    this.z = cx * cy * sz - sx * sy * cz;
    this.w = cx * cy * cz + sx * sy * sz;
    return this
  }, setFromMat4:function(m) {
    var m00, m01, m02, m10, m11, m12, m20, m21, m22, tr, s, rs, lx, ly, lz;
    m = m.data;
    m00 = m[0];
    m01 = m[1];
    m02 = m[2];
    m10 = m[4];
    m11 = m[5];
    m12 = m[6];
    m20 = m[8];
    m21 = m[9];
    m22 = m[10];
    lx = 1 / Math.sqrt(m00 * m00 + m01 * m01 + m02 * m02);
    ly = 1 / Math.sqrt(m10 * m10 + m11 * m11 + m12 * m12);
    lz = 1 / Math.sqrt(m20 * m20 + m21 * m21 + m22 * m22);
    m00 *= lx;
    m01 *= lx;
    m02 *= lx;
    m10 *= ly;
    m11 *= ly;
    m12 *= ly;
    m20 *= lz;
    m21 *= lz;
    m22 *= lz;
    tr = m00 + m11 + m22;
    if(tr >= 0) {
      s = Math.sqrt(tr + 1);
      this.w = s * 0.5;
      s = 0.5 / s;
      this.x = (m12 - m21) * s;
      this.y = (m20 - m02) * s;
      this.z = (m01 - m10) * s
    }else {
      if(m00 > m11) {
        if(m00 > m22) {
          rs = m00 - (m11 + m22) + 1;
          rs = Math.sqrt(rs);
          this.x = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m12 - m21) * rs;
          this.y = (m01 + m10) * rs;
          this.z = (m02 + m20) * rs
        }else {
          rs = m22 - (m00 + m11) + 1;
          rs = Math.sqrt(rs);
          this.z = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m01 - m10) * rs;
          this.x = (m20 + m02) * rs;
          this.y = (m21 + m12) * rs
        }
      }else {
        if(m11 > m22) {
          rs = m11 - (m22 + m00) + 1;
          rs = Math.sqrt(rs);
          this.y = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m20 - m02) * rs;
          this.z = (m12 + m21) * rs;
          this.x = (m10 + m01) * rs
        }else {
          rs = m22 - (m00 + m11) + 1;
          rs = Math.sqrt(rs);
          this.z = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m01 - m10) * rs;
          this.x = (m20 + m02) * rs;
          this.y = (m21 + m12) * rs
        }
      }
    }
    return this
  }, slerp:function(lhs, rhs, alpha) {
    var lx, ly, lz, lw, rx, ry, rz, rw;
    lx = lhs.x;
    ly = lhs.y;
    lz = lhs.z;
    lw = lhs.w;
    rx = rhs.x;
    ry = rhs.y;
    rz = rhs.z;
    rw = rhs.w;
    var cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;
    if(cosHalfTheta < 0) {
      rw = -rw;
      rx = -rx;
      ry = -ry;
      rz = -rz;
      cosHalfTheta = -cosHalfTheta
    }
    if(Math.abs(cosHalfTheta) >= 1) {
      this.w = lw;
      this.x = lx;
      this.y = ly;
      this.z = lz;
      return this
    }
    var halfTheta = Math.acos(cosHalfTheta);
    var sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
    if(Math.abs(sinHalfTheta) < 0.001) {
      this.w = lw * 0.5 + rw * 0.5;
      this.x = lx * 0.5 + rx * 0.5;
      this.y = ly * 0.5 + ry * 0.5;
      this.z = lz * 0.5 + rz * 0.5;
      return this
    }
    var ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
    var ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;
    this.w = lw * ratioA + rw * ratioB;
    this.x = lx * ratioA + rx * ratioB;
    this.y = ly * ratioA + ry * ratioB;
    this.z = lz * ratioA + rz * ratioB;
    return this
  }, transformVector:function(vec, res) {
    if(res === undefined) {
      res = new pc.Vec3
    }
    var x = vec.x, y = vec.y, z = vec.z;
    var qx = this.x, qy = this.y, qz = this.z, qw = this.w;
    var ix = qw * x + qy * z - qz * y;
    var iy = qw * y + qz * x - qx * z;
    var iz = qw * z + qx * y - qy * x;
    var iw = -qx * x - qy * y - qz * z;
    res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return res
  }, toString:function() {
    return"[" + this.x + ", " + this.y + ", " + this.z + ", " + this.w + "]"
  }};
  Object.defineProperty(Quat, "IDENTITY", {get:function() {
    var identity = new Quat;
    return function() {
      return identity
    }
  }()});
  Object.defineProperty(Quat, "ZERO", {get:function() {
    var zero = new Quat(0, 0, 0, 0);
    return function() {
      return zero
    }
  }()});
  return{Quat:Quat}
}());
pc.extend(pc, function() {
  var CURVE_LINEAR = 0;
  var CURVE_SMOOTHSTEP = 1;
  var CURVE_CATMULL = 2;
  var CURVE_CARDINAL = 3;
  var Curve = function(data) {
    this.keys = [];
    this.type = CURVE_SMOOTHSTEP;
    this.tension = 0.5;
    if(data) {
      for(var i = 0;i < data.length - 1;i += 2) {
        this.keys.push([data[i], data[i + 1]])
      }
    }
    this.sort()
  };
  Curve.prototype = {add:function(time, value) {
    var keys = this.keys;
    var len = keys.length;
    var i = 0;
    for(;i < len;i++) {
      if(keys[i][0] > time) {
        break
      }
    }
    var key = [time, value];
    this.keys.splice(i, 0, key);
    return key
  }, get:function(index) {
    return this.keys[index]
  }, sort:function() {
    this.keys.sort(function(a, b) {
      return a[0] - b[0]
    })
  }, value:function(time) {
    var keys = this.keys;
    if(!keys.length) {
      return 0
    }
    if(time < keys[0][0]) {
      return keys[0][1]
    }else {
      if(time > keys[keys.length - 1][0]) {
        return keys[keys.length - 1][1]
      }
    }
    var leftTime = 0;
    var leftValue = keys.length ? keys[0][1] : 0;
    var rightTime = 1;
    var rightValue = 0;
    for(var i = 0, len = keys.length;i < len;i++) {
      if(keys[i][0] === time) {
        return keys[i][1]
      }
      rightValue = keys[i][1];
      if(time < keys[i][0]) {
        rightTime = keys[i][0];
        break
      }
      leftTime = keys[i][0];
      leftValue = keys[i][1]
    }
    var div = rightTime - leftTime;
    var interpolation = div === 0 ? 0 : (time - leftTime) / div;
    if(this.type === CURVE_SMOOTHSTEP) {
      interpolation *= interpolation * (3 - 2 * interpolation)
    }else {
      if(this.type === CURVE_CATMULL || this.type === CURVE_CARDINAL) {
        var p1 = leftValue;
        var p2 = rightValue;
        var p0 = p1 + (p1 - p2);
        var p3 = p2 + (p2 - p1);
        var dt1 = rightTime - leftTime;
        var dt0 = dt1;
        var dt2 = dt1;
        if(i > 0) {
          i = i - 1
        }
        if(i > 0) {
          p0 = keys[i - 1][1];
          dt0 = keys[i][0] - keys[i - 1][0]
        }
        if(keys.length > i + 1) {
          dt1 = keys[i + 1][0] - keys[i][0]
        }
        if(keys.length > i + 2) {
          dt2 = keys[i + 2][0] - keys[i + 1][0];
          p3 = keys[i + 2][1]
        }
        p0 = p1 + (p0 - p1) * dt1 / dt0;
        p3 = p2 + (p3 - p2) * dt1 / dt2;
        if(this.type === CURVE_CATMULL) {
          return this._interpolateCatmullRom(p0, p1, p2, p3, interpolation)
        }else {
          return this._interpolateCardinal(p0, p1, p2, p3, interpolation, this.tension)
        }
      }
    }
    return pc.math.lerp(leftValue, rightValue, interpolation)
  }, _interpolateHermite:function(p0, p1, t0, t1, s) {
    var s2 = s * s;
    var s3 = s * s * s;
    var h0 = 2 * s3 - 3 * s2 + 1;
    var h1 = -2 * s3 + 3 * s2;
    var h2 = s3 - 2 * s2 + s;
    var h3 = s3 - s2;
    return p0 * h0 + p1 * h1 + t0 * h2 + t1 * h3
  }, _interpolateCardinal:function(p0, p1, p2, p3, s, t) {
    var t0 = t * (p2 - p0);
    var t1 = t * (p3 - p1);
    return this._interpolateHermite(p1, p2, t0, t1, s)
  }, _interpolateCatmullRom:function(p0, p1, p2, p3, s) {
    return this._interpolateCardinal(p0, p1, p2, p3, s, 0.5)
  }, closest:function(time) {
    var keys = this.keys;
    var length = keys.length;
    var min = 2;
    var result = null;
    for(var i = 0;i < length;i++) {
      var diff = Math.abs(time - keys[i][0]);
      if(min >= diff) {
        min = diff;
        result = keys[i]
      }else {
        break
      }
    }
    return result
  }, clone:function() {
    var result = new pc.Curve;
    result.keys = pc.extend(result.keys, this.keys);
    result.type = this.type;
    return result
  }, quantize:function(precision) {
    precision = Math.max(precision, 2);
    var values = new Float32Array(precision);
    var step = 1 / (precision - 1);
    for(var i = 0;i < precision;i++) {
      var value = this.value(step * i);
      values[i] = value
    }
    return values
  }};
  Object.defineProperty(Curve.prototype, "length", {get:function() {
    return this.keys.length
  }});
  return{Curve:Curve, CURVE_LINEAR:CURVE_LINEAR, CURVE_SMOOTHSTEP:CURVE_SMOOTHSTEP, CURVE_CATMULL:CURVE_CATMULL, CURVE_CARDINAL:CURVE_CARDINAL}
}());
pc.extend(pc, function() {
  var CurveSet = function() {
    var i;
    this.curves = [];
    this._type = pc.CURVE_SMOOTHSTEP;
    if(arguments.length > 1) {
      for(i = 0;i < arguments.length;i++) {
        this.curves.push(new pc.Curve(arguments[i]))
      }
    }else {
      if(arguments.length === 0) {
        this.curves.push(new pc.Curve)
      }else {
        var arg = arguments[0];
        if(pc.type(arg) === "number") {
          for(i = 0;i < arg;i++) {
            this.curves.push(new pc.Curve)
          }
        }else {
          for(i = 0;i < arg.length;i++) {
            this.curves.push(new pc.Curve(arg[i]))
          }
        }
      }
    }
  };
  CurveSet.prototype = {get:function(index) {
    return this.curves[index]
  }, value:function(time, result) {
    var length = this.curves.length;
    result = result || [];
    result.length = length;
    for(var i = 0;i < length;i++) {
      result[i] = this.curves[i].value(time)
    }
    return result
  }, clone:function() {
    var result = new pc.CurveSet;
    result.curves = [];
    for(var i = 0;i < this.curves.length;i++) {
      result.curves.push(this.curves[i].clone())
    }
    result._type = this._type;
    return result
  }, quantize:function(precision) {
    precision = Math.max(precision, 2);
    var numCurves = this.curves.length;
    var values = new Float32Array(precision * numCurves);
    var step = 1 / (precision - 1);
    var temp = [];
    for(var i = 0;i < precision;i++) {
      var value = this.value(step * i, temp);
      if(numCurves == 1) {
        values[i] = value[0]
      }else {
        for(var j = 0;j < numCurves;j++) {
          values[i * numCurves + j] = value[j]
        }
      }
    }
    return values
  }};
  Object.defineProperty(CurveSet.prototype, "length", {get:function() {
    return this.curves.length
  }});
  Object.defineProperty(CurveSet.prototype, "type", {get:function() {
    return this._type
  }, set:function(value) {
    this._type = value;
    for(var i = 0;i < this.curves.length;i++) {
      this.curves[i].type = value
    }
  }});
  return{CurveSet:CurveSet}
}());
pc.shape = function() {
  var Shape = function Shape() {
  };
  Shape.prototype = {containsPoint:function(point) {
    throw new Error("Shape hasn't implemented containsPoint");
  }};
  return{Shape:Shape, Type:{CAPSULE:"Capsule", CONE:"Cone", CYLINDER:"Cylinder", CIRCLE:"Circle", RECT:"Rect"}}
}();
pc.shape.intersection = function() {
  return{aabbAabb:function(a, b) {
    var aMax = a.getMax();
    var aMin = a.getMin();
    var bMax = b.getMax();
    var bMin = b.getMin();
    return aMin[0] <= bMax[0] && aMax[0] >= bMin[0] && aMin[1] <= bMax[1] && aMax[1] >= bMin[1] && aMin[2] <= bMax[2] && aMax[2] >= bMin[2]
  }, rayAabb:function(rayOrigin, rayDir, aabb) {
    var diff = new pc.Vec3, absDiff, absDir, cross = new pc.Vec3, prod = new pc.Vec3, i;
    diff.sub2(rayOrigin, aabb.center);
    absDiff = new pc.Vec3(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
    prod.mul2(diff, rayDir);
    if(absDiff.x > aabb.halfExtents.x && prod.x >= 0) {
      return false
    }
    if(absDiff.y > aabb.halfExtents.y && prod.y >= 0) {
      return false
    }
    if(absDiff.z > aabb.halfExtents.z && prod.z >= 0) {
      return false
    }
    absDir = new pc.Vec3(Math.abs(rayDir.x), Math.abs(rayDir.y), Math.abs(rayDir.z));
    cross.cross(rayDir, diff);
    cross.set(Math.abs(cross.x), Math.abs(cross.y), Math.abs(cross.z));
    if(cross.x > aabb.halfExtents.y * absDir.z + aabb.halfExtents.z * absDir.y) {
      return false
    }
    if(cross.y > aabb.halfExtents.x * absDir.z + aabb.halfExtents.z * absDir.x) {
      return false
    }
    if(cross.z > aabb.halfExtents.x * absDir.y + aabb.halfExtents.y * absDir.x) {
      return false
    }
    return true
  }, raySphere:function(rayOrigin, rayDir, sphere, result) {
    var diff = new pc.Vec3;
    var a = 0;
    var b = 0;
    var c = 0;
    var discr = 0;
    result = result || {};
    diff.sub2(rayOrigin, sphere.center);
    if(diff.dot(diff) < sphere.radius * sphere.radius) {
      result.success = true;
      result.t = 0;
      return true
    }
    a = rayDir.dot(rayDir);
    b = 2 * rayDir.dot(diff);
    c = sphere.center.dot(sphere.center);
    c += rayOrigin.dot(rayOrigin);
    c -= 2 * sphere.center.dot(rayOrigin);
    c -= sphere.radius * sphere.radius;
    discr = b * b - 4 * a * c;
    if(discr < 0) {
      result.success = false;
      result.t = 0;
      return false
    }
    result.success = true;
    result.t = (-b - Math.sqrt(discr)) / (2 * a);
    return true
  }, rayTriangle:function(rayOrigin, rayDir, t, intersection) {
    var w0 = rayOrigin.clone().sub(t.v0);
    var a = -t.n.dot(w0);
    var b = t.n.dot(rayDir);
    if(Math.fabs(b) < 1E-8) {
      if(a === 0) {
        return 2
      }else {
        return 0
      }
    }
    var r = a / b;
    if(r < 0) {
      return 0
    }
    var fromOrigin = rayDir.clone().scale(r);
    intersection.add2(rayOrigin, fromOrigin);
    var w = (new pc.Vec3).sub2(intersection, t.v0);
    var wu = w.dot(t.u);
    var wv = w.dot(t.v);
    var s = (t.uv * wv - t.vv * wu) / t.d;
    if(s < 0 || s > 1) {
      return 0
    }
    var t = (t.uv * wu - t.uu * wv) / t.d;
    if(t < 0 || s + t > 1) {
      return 0
    }
    return 1
  }}
}();
pc.extend(pc.shape, function() {
  pc.shape.Type.AABB = "Aabb";
  var Aabb = function Aabb(center, halfExtents) {
    this.center = center || new pc.Vec3(0, 0, 0);
    this.halfExtents = halfExtents || new pc.Vec3(0.5, 0.5, 0.5);
    this.type = pc.shape.Type.AABB
  };
  Aabb = pc.inherits(Aabb, pc.shape.Shape);
  Aabb.prototype.add = function(other) {
    var tc = this.center;
    var th = this.halfExtents;
    var tminx = tc.x - th.x;
    var tmaxx = tc.x + th.x;
    var tminy = tc.y - th.y;
    var tmaxy = tc.y + th.y;
    var tminz = tc.z - th.z;
    var tmaxz = tc.z + th.z;
    var oc = other.center;
    var oh = other.halfExtents;
    var ominx = oc.x - oh.x;
    var omaxx = oc.x + oh.x;
    var ominy = oc.y - oh.y;
    var omaxy = oc.y + oh.y;
    var ominz = oc.z - oh.z;
    var omaxz = oc.z + oh.z;
    if(ominx < tminx) {
      tminx = ominx
    }
    if(omaxx > tmaxx) {
      tmaxx = omaxx
    }
    if(ominy < tminy) {
      tminy = ominy
    }
    if(omaxy > tmaxy) {
      tmaxy = omaxy
    }
    if(ominz < tminz) {
      tminz = ominz
    }
    if(omaxz > tmaxz) {
      tmaxz = omaxz
    }
    tc.set(tminx + tmaxx, tminy + tmaxy, tminz + tmaxz).scale(0.5);
    th.set(tmaxx - tminx, tmaxy - tminy, tmaxz - tminz).scale(0.5)
  };
  Aabb.prototype.copy = function(src) {
    this.center.copy(src.center);
    this.halfExtents.copy(src.halfExtents);
    this.type = src.type
  };
  Aabb.prototype.setMinMax = function(min, max) {
    this.center.add2(max, min).scale(0.5);
    this.halfExtents.sub2(max, min).scale(0.5)
  };
  Aabb.prototype.getMin = function() {
    return this.center.clone().sub(this.halfExtents)
  };
  Aabb.prototype.getMax = function() {
    return this.center.clone().add(this.halfExtents)
  };
  Aabb.prototype.containsPoint = function(point) {
    var min = this.getMin(), max = this.getMax(), i;
    for(i = 0;i < 3;++i) {
      if(point.data[i] < min.data[i] || point.data[i] > max.data[i]) {
        return false
      }
    }
    return true
  };
  Aabb.prototype.setFromTransformedAabb = function(aabb, m) {
    var bc = this.center;
    var br = this.halfExtents;
    var ac = aabb.center.data;
    var ar = aabb.halfExtents.data;
    m = m.data;
    var mx0 = m[0];
    var mx1 = m[4];
    var mx2 = m[8];
    var my0 = m[1];
    var my1 = m[5];
    var my2 = m[9];
    var mz0 = m[2];
    var mz1 = m[6];
    var mz2 = m[10];
    var mx0a = Math.abs(mx0);
    var mx1a = Math.abs(mx1);
    var mx2a = Math.abs(mx2);
    var my0a = Math.abs(my0);
    var my1a = Math.abs(my1);
    var my2a = Math.abs(my2);
    var mz0a = Math.abs(mz0);
    var mz1a = Math.abs(mz1);
    var mz2a = Math.abs(mz2);
    bc.set(m[12] + mx0 * ac[0] + mx1 * ac[1] + mx2 * ac[2], m[13] + my0 * ac[0] + my1 * ac[1] + my2 * ac[2], m[14] + mz0 * ac[0] + mz1 * ac[1] + mz2 * ac[2]);
    br.set(mx0a * ar[0] + mx1a * ar[1] + mx2a * ar[2], my0a * ar[0] + my1a * ar[1] + my2a * ar[2], mz0a * ar[0] + mz1a * ar[1] + mz2a * ar[2])
  };
  Aabb.prototype.compute = function(vertices) {
    var min = new pc.Vec3(vertices[0], vertices[1], vertices[2]);
    var max = new pc.Vec3(vertices[0], vertices[1], vertices[2]);
    var numVerts = vertices.length / 3;
    for(var i = 1;i < numVerts;i++) {
      var x = vertices[i * 3 + 0];
      var y = vertices[i * 3 + 1];
      var z = vertices[i * 3 + 2];
      if(x < min.x) {
        min.x = x
      }
      if(y < min.y) {
        min.y = y
      }
      if(z < min.z) {
        min.z = z
      }
      if(x > max.x) {
        max.x = x
      }
      if(y > max.y) {
        max.y = y
      }
      if(z > max.z) {
        max.z = z
      }
    }
    this.setMinMax(min, max)
  };
  return{Aabb:Aabb}
}());
pc.extend(pc.shape, function() {
  pc.shape.Type.BOX = "Box";
  var center = new pc.Vec3;
  var p = new pc.Vec3;
  var t = new pc.Mat4;
  var scale = new pc.Mat4;
  function Box(transform, halfExtents) {
    this.transform = transform === undefined ? new pc.Mat4 : transform;
    this.halfExtents = halfExtents === undefined ? new pc.Vec3(0.5, 0.5, 0.5) : halfExtents;
    this.type = pc.shape.Type.BOX
  }
  Box = pc.inherits(Box, pc.shape.Shape);
  Box.prototype.containsPoint = function(point) {
    this.transform.getTranslation(center);
    var extents = this.getHalfExtents();
    t.copy(this.transform);
    p.copy(extents).scale(2);
    scale.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, p);
    t.mul(scale).invert();
    t.transformPoint(point, p);
    var min = -0.5;
    var max = 0.5;
    if(p.x < min || p.x > max) {
      return false
    }else {
      if(p.y < min || p.y > max) {
        return false
      }else {
        if(p.z < min || p.z > max) {
          return false
        }
      }
    }
    return true
  };
  Box.prototype.getHalfExtents = function() {
    return this.halfExtents
  };
  return{Box:Box}
}());
pc.extend(pc, function() {
  var viewProj = new pc.Mat4;
  var Frustum = function Frustum(projectionMatrix, viewMatrix) {
    projectionMatrix = projectionMatrix || (new pc.Mat4).setPerspective(90, 16 / 9, 0.1, 1E3);
    viewMatrix = viewMatrix || new pc.Mat4;
    this.planes = [];
    for(var i = 0;i < 6;i++) {
      this.planes[i] = []
    }
    this.update(projectionMatrix, viewMatrix)
  };
  Frustum.prototype = {update:function(projectionMatrix, viewMatrix) {
    viewProj.mul2(projectionMatrix, viewMatrix);
    var vpm = viewProj.data;
    this.planes[0][0] = vpm[3] - vpm[0];
    this.planes[0][1] = vpm[7] - vpm[4];
    this.planes[0][2] = vpm[11] - vpm[8];
    this.planes[0][3] = vpm[15] - vpm[12];
    t = Math.sqrt(this.planes[0][0] * this.planes[0][0] + this.planes[0][1] * this.planes[0][1] + this.planes[0][2] * this.planes[0][2]);
    this.planes[0][0] /= t;
    this.planes[0][1] /= t;
    this.planes[0][2] /= t;
    this.planes[0][3] /= t;
    this.planes[1][0] = vpm[3] + vpm[0];
    this.planes[1][1] = vpm[7] + vpm[4];
    this.planes[1][2] = vpm[11] + vpm[8];
    this.planes[1][3] = vpm[15] + vpm[12];
    t = Math.sqrt(this.planes[1][0] * this.planes[1][0] + this.planes[1][1] * this.planes[1][1] + this.planes[1][2] * this.planes[1][2]);
    this.planes[1][0] /= t;
    this.planes[1][1] /= t;
    this.planes[1][2] /= t;
    this.planes[1][3] /= t;
    this.planes[2][0] = vpm[3] + vpm[1];
    this.planes[2][1] = vpm[7] + vpm[5];
    this.planes[2][2] = vpm[11] + vpm[9];
    this.planes[2][3] = vpm[15] + vpm[13];
    t = Math.sqrt(this.planes[2][0] * this.planes[2][0] + this.planes[2][1] * this.planes[2][1] + this.planes[2][2] * this.planes[2][2]);
    this.planes[2][0] /= t;
    this.planes[2][1] /= t;
    this.planes[2][2] /= t;
    this.planes[2][3] /= t;
    this.planes[3][0] = vpm[3] - vpm[1];
    this.planes[3][1] = vpm[7] - vpm[5];
    this.planes[3][2] = vpm[11] - vpm[9];
    this.planes[3][3] = vpm[15] - vpm[13];
    t = Math.sqrt(this.planes[3][0] * this.planes[3][0] + this.planes[3][1] * this.planes[3][1] + this.planes[3][2] * this.planes[3][2]);
    this.planes[3][0] /= t;
    this.planes[3][1] /= t;
    this.planes[3][2] /= t;
    this.planes[3][3] /= t;
    this.planes[4][0] = vpm[3] - vpm[2];
    this.planes[4][1] = vpm[7] - vpm[6];
    this.planes[4][2] = vpm[11] - vpm[10];
    this.planes[4][3] = vpm[15] - vpm[14];
    t = Math.sqrt(this.planes[4][0] * this.planes[4][0] + this.planes[4][1] * this.planes[4][1] + this.planes[4][2] * this.planes[4][2]);
    this.planes[4][0] /= t;
    this.planes[4][1] /= t;
    this.planes[4][2] /= t;
    this.planes[4][3] /= t;
    this.planes[5][0] = vpm[3] + vpm[2];
    this.planes[5][1] = vpm[7] + vpm[6];
    this.planes[5][2] = vpm[11] + vpm[10];
    this.planes[5][3] = vpm[15] + vpm[14];
    t = Math.sqrt(this.planes[5][0] * this.planes[5][0] + this.planes[5][1] * this.planes[5][1] + this.planes[5][2] * this.planes[5][2]);
    this.planes[5][0] /= t;
    this.planes[5][1] /= t;
    this.planes[5][2] /= t;
    this.planes[5][3] /= t
  }, containsPoint:function(point) {
    for(var p = 0;p < 6;p++) {
      if(this.planes[p][0] * point.x + this.planes[p][1] * point.y + this.planes[p][2] * point.z + this.planes[p][3] <= 0) {
        return false
      }
    }
    return true
  }, containsSphere:function(sphere) {
    var c = 0;
    var d;
    for(p = 0;p < 6;p++) {
      d = this.planes[p][0] * sphere.center.x + this.planes[p][1] * sphere.center.y + this.planes[p][2] * sphere.center.z + this.planes[p][3];
      if(d <= -sphere.radius) {
        return 0
      }
      if(d > sphere.radius) {
        c++
      }
    }
    return c === 6 ? 2 : 1
  }};
  return{Frustum:Frustum}
}());
pc.extend(pc.shape, function() {
  pc.shape.Type.PLANE = "Plane";
  var Plane = function Plane(point, normal) {
    this.normal = normal || new pc.Vec3(0, 0, 1);
    this.point = point || new pc.Vec3(0, 0, 0);
    this.d = -this.normal.dot(this.point);
    this.type = pc.shape.Type.PLANE
  };
  Plane = pc.inherits(Plane, pc.shape.Shape);
  Plane.prototype.containsPoint = function(point) {
    return false
  };
  Plane.prototype.distance = function(pos) {
    return this.normal.dot(pos) + this.d
  };
  Plane.prototype.intersect = function(p0, p1) {
    var d0 = this.distance(p0);
    var d1 = this.distance(p1);
    return d0 / (d0 - d1)
  };
  Plane.prototype.intersectPosition = function(p0, p1) {
    var t = this.intersect(p0, p1);
    var r = new pc.Vec3;
    r.lerp(p0, p1, t);
    return r
  };
  return{Plane:Plane}
}());
pc.extend(pc.shape, function() {
  pc.shape.Type.SPHERE = "Sphere";
  function Sphere(center, radius) {
    this.center = center === undefined ? new pc.Vec3(0, 0, 0) : center;
    this.radius = radius === undefined ? 1 : radius;
    this.type = pc.shape.Type.SPHERE
  }
  Sphere = pc.inherits(Sphere, pc.shape.Shape);
  Sphere.prototype.containsPoint = function() {
    var centerToPoint = new pc.Vec3;
    return function(point) {
      var lenSq = centerToPoint.sub2(point, this.center).lengthSq();
      var r = this.radius;
      return lenSq < r * r
    }
  }();
  Sphere.prototype.compute = function(vertices) {
    var i;
    var numVerts = vertices.length / 3;
    var vertex = new pc.Vec3(0, 0, 0);
    var avgVertex = new pc.Vec3(0, 0, 0);
    var sum = new pc.Vec3(0, 0, 0);
    for(i = 0;i < numVerts;i++) {
      vertex.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
      sum.addSelf(vertex);
      if(i % 100 === 0) {
        sum.scale(1 / numVerts);
        avgVertex.add(sum);
        sum.set(0, 0, 0)
      }
    }
    sum.scale(1 / numVerts);
    avgVertex.add(sum);
    this.center.copy(avgVertex);
    var maxDistSq = 0;
    var centerToVert = new pc.Vec3(0, 0, 0);
    for(i = 0;i < numVerts;i++) {
      vertex.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
      centerToVert.sub2(vertex, this.center);
      maxDistSq = Math.max(centerToVert.lengthSq(), maxDistSq)
    }
    this.radius = Math.sqrt(maxDistSq)
  };
  Sphere.prototype.intersectRay = function(start, direction) {
    var m = start.clone().sub(this.center);
    var b = m.dot(direction);
    var c = m.dot(m) - this.radius * this.radius;
    if(c > 0 && b > 0) {
      return null
    }
    var discr = b * b - c;
    if(discr < 0) {
      return null
    }
    t = Math.abs(-b - Math.sqrt(discr));
    return direction.clone().scale(t).add(start)
  };
  return{Sphere:Sphere}
}());
pc.extend(pc.shape, function() {
  pc.shape.Type.TORUS = "Torus";
  var Torus = function Torus(transform, iradius, oradius) {
    this.transform = transform;
    this.iradius = iradius;
    this.oradius = oradius;
    this.type = pc.shape.Type.TORUS
  };
  Torus = pc.inherits(Torus, pc.shape.Shape);
  Torus.prototype.containsPoint = function(point) {
    throw new Error("Not implemented yet");
  };
  return{Torus:Torus}
}());
(function() {
  var enums = {ADDRESS_REPEAT:0, ADDRESS_CLAMP_TO_EDGE:1, ADDRESS_MIRRORED_REPEAT:2, BLENDMODE_ZERO:0, BLENDMODE_ONE:1, BLENDMODE_SRC_COLOR:2, BLENDMODE_ONE_MINUS_SRC_COLOR:3, BLENDMODE_DST_COLOR:4, BLENDMODE_ONE_MINUS_DST_COLOR:5, BLENDMODE_SRC_ALPHA:6, BLENDMODE_SRC_ALPHA_SATURATE:7, BLENDMODE_ONE_MINUS_SRC_ALPHA:8, BLENDMODE_DST_ALPHA:9, BLENDMODE_ONE_MINUS_DST_ALPHA:10, BLENDEQUATION_ADD:0, BLENDEQUATION_SUBTRACT:1, BLENDEQUATION_REVERSE_SUBTRACT:2, BUFFER_STATIC:0, BUFFER_DYNAMIC:1, BUFFER_STREAM:2, 
  CLEARFLAG_COLOR:1, CLEARFLAG_DEPTH:2, CLEARFLAG_STENCIL:4, CULLFACE_NONE:0, CULLFACE_BACK:1, CULLFACE_FRONT:2, CULLFACE_FRONTANDBACK:3, ELEMENTTYPE_INT8:0, ELEMENTTYPE_UINT8:1, ELEMENTTYPE_INT16:2, ELEMENTTYPE_UINT16:3, ELEMENTTYPE_INT32:4, ELEMENTTYPE_UINT32:5, ELEMENTTYPE_FLOAT32:6, FILTER_NEAREST:0, FILTER_LINEAR:1, FILTER_NEAREST_MIPMAP_NEAREST:2, FILTER_NEAREST_MIPMAP_LINEAR:3, FILTER_LINEAR_MIPMAP_NEAREST:4, FILTER_LINEAR_MIPMAP_LINEAR:5, INDEXFORMAT_UINT8:0, INDEXFORMAT_UINT16:1, INDEXFORMAT_UINT32:2, 
  PIXELFORMAT_A8:0, PIXELFORMAT_L8:1, PIXELFORMAT_L8_A8:2, PIXELFORMAT_R5_G6_B5:3, PIXELFORMAT_R5_G5_B5_A1:4, PIXELFORMAT_R4_G4_B4_A4:5, PIXELFORMAT_R8_G8_B8:6, PIXELFORMAT_R8_G8_B8_A8:7, PIXELFORMAT_DXT1:8, PIXELFORMAT_DXT3:9, PIXELFORMAT_DXT5:10, PIXELFORMAT_RGB16F:11, PIXELFORMAT_RGBA16F:12, PIXELFORMAT_RGB32F:13, PIXELFORMAT_RGBA32F:14, PRIMITIVE_POINTS:0, PRIMITIVE_LINES:1, PRIMITIVE_LINELOOP:2, PRIMITIVE_LINESTRIP:3, PRIMITIVE_TRIANGLES:4, PRIMITIVE_TRISTRIP:5, PRIMITIVE_TRIFAN:6, SEMANTIC_POSITION:"POSITION", 
  SEMANTIC_NORMAL:"NORMAL", SEMANTIC_TANGENT:"TANGENT", SEMANTIC_BLENDWEIGHT:"BLENDWEIGHT", SEMANTIC_BLENDINDICES:"BLENDINDICES", SEMANTIC_COLOR:"COLOR", SEMANTIC_TEXCOORD0:"TEXCOORD0", SEMANTIC_TEXCOORD1:"TEXCOORD1", SEMANTIC_TEXCOORD2:"TEXCOORD2", SEMANTIC_TEXCOORD3:"TEXCOORD3", SEMANTIC_TEXCOORD4:"TEXCOORD4", SEMANTIC_TEXCOORD5:"TEXCOORD5", SEMANTIC_TEXCOORD6:"TEXCOORD6", SEMANTIC_TEXCOORD7:"TEXCOORD7", SEMANTIC_ATTR0:"ATTR0", SEMANTIC_ATTR1:"ATTR1", SEMANTIC_ATTR2:"ATTR2", SEMANTIC_ATTR3:"ATTR3", 
  SEMANTIC_ATTR4:"ATTR4", SEMANTIC_ATTR5:"ATTR5", SEMANTIC_ATTR6:"ATTR6", SEMANTIC_ATTR7:"ATTR7", SEMANTIC_ATTR8:"ATTR8", SEMANTIC_ATTR9:"ATTR9", SEMANTIC_ATTR10:"ATTR10", SEMANTIC_ATTR11:"ATTR11", SEMANTIC_ATTR12:"ATTR12", SEMANTIC_ATTR13:"ATTR13", SEMANTIC_ATTR14:"ATTR14", SEMANTIC_ATTR15:"ATTR15", TEXTURELOCK_READ:1, TEXTURELOCK_WRITE:2, UNIFORMTYPE_BOOL:0, UNIFORMTYPE_INT:1, UNIFORMTYPE_FLOAT:2, UNIFORMTYPE_VEC2:3, UNIFORMTYPE_VEC3:4, UNIFORMTYPE_VEC4:5, UNIFORMTYPE_IVEC2:6, UNIFORMTYPE_IVEC3:7, 
  UNIFORMTYPE_IVEC4:8, UNIFORMTYPE_BVEC2:9, UNIFORMTYPE_BVEC3:10, UNIFORMTYPE_BVEC4:11, UNIFORMTYPE_MAT2:12, UNIFORMTYPE_MAT3:13, UNIFORMTYPE_MAT4:14, UNIFORMTYPE_TEXTURE2D:15, UNIFORMTYPE_TEXTURECUBE:16};
  pc.extend(pc, enums);
  pc.gfx = {};
  pc.extend(pc.gfx, enums)
})();
pc.extend(pc, function() {
  var ScopeId = function(name) {
    this.name = name;
    this.value = null;
    this.versionObject = new pc.VersionedObject
  };
  ScopeId.prototype = {setValue:function(value) {
    this.value = value;
    this.versionObject.increment()
  }, getValue:function(value) {
    return this.value
  }};
  return{ScopeId:ScopeId}
}());
pc.extend(pc, function() {
  var ScopeSpace = function(name) {
    this.name = name;
    this.variables = {};
    this.namespaces = {}
  };
  ScopeSpace.prototype = {resolve:function(name) {
    if(this.variables.hasOwnProperty(name) === false) {
      this.variables[name] = new pc.ScopeId(name)
    }
    return this.variables[name]
  }, getSubSpace:function(name) {
    if(this.namespaces.hasOwnProperty(name) === false) {
      this.namespaces[name] = new pc.ScopeSpace(name);
      logDEBUG("Added ScopeSpace: " + name)
    }
    return this.namespaces[name]
  }};
  return{ScopeSpace:ScopeSpace}
}());
pc.extend(pc, function() {
  var Version = function() {
    this.globalId = 0;
    this.revision = 0
  };
  Version.prototype = {equals:function(other) {
    return this.globalId === other.globalId && this.revision === other.revision
  }, notequals:function(other) {
    return this.globalId !== other.globalId || this.revision !== other.revision
  }, copy:function(other) {
    this.globalId = other.globalId;
    this.revision = other.revision
  }, reset:function() {
    this.globalId = 0;
    this.revision = 0
  }};
  return{Version:Version}
}());
pc.extend(pc, function() {
  var idCounter = 0;
  var VersionedObject = function() {
    idCounter++;
    this.version = new pc.Version;
    this.version.globalId = idCounter
  };
  VersionedObject.prototype = {increment:function() {
    this.version.revision++
  }};
  return{VersionedObject:VersionedObject}
}());
pc.extend(pc, function() {
  function VertexIteratorSetter(buffer, vertexElement) {
    this.index = 0;
    switch(vertexElement.dataType) {
      case pc.ELEMENTTYPE_INT8:
        this.array = new Int8Array(buffer, vertexElement.offset);
        break;
      case pc.ELEMENTTYPE_UINT8:
        this.array = new Uint8Array(buffer, vertexElement.offset);
        break;
      case pc.ELEMENTTYPE_INT16:
        this.array = new Int16Array(buffer, vertexElement.offset);
        break;
      case pc.ELEMENTTYPE_UINT16:
        this.array = new Uint16Array(buffer, vertexElement.offset);
        break;
      case pc.ELEMENTTYPE_INT32:
        this.array = new Int32Array(buffer, vertexElement.offset);
        break;
      case pc.ELEMENTTYPE_UINT32:
        this.array = new Uint32Array(buffer, vertexElement.offset);
        break;
      case pc.ELEMENTTYPE_FLOAT32:
        this.array = new Float32Array(buffer, vertexElement.offset);
        break
    }
    switch(vertexElement.numComponents) {
      case 1:
        this.set = VertexIteratorSetter_set1;
        break;
      case 2:
        this.set = VertexIteratorSetter_set2;
        break;
      case 3:
        this.set = VertexIteratorSetter_set3;
        break;
      case 4:
        this.set = VertexIteratorSetter_set4;
        break
    }
  }
  function VertexIteratorSetter_set1(a) {
    this.array[this.index] = a
  }
  function VertexIteratorSetter_set2(a, b) {
    this.array[this.index] = a;
    this.array[this.index + 1] = b
  }
  function VertexIteratorSetter_set3(a, b, c) {
    this.array[this.index] = a;
    this.array[this.index + 1] = b;
    this.array[this.index + 2] = c
  }
  function VertexIteratorSetter_set4(a, b, c, d) {
    this.array[this.index] = a;
    this.array[this.index + 1] = b;
    this.array[this.index + 2] = c;
    this.array[this.index + 3] = d
  }
  function VertexIterator(vertexBuffer) {
    this.vertexBuffer = vertexBuffer;
    this.buffer = this.vertexBuffer.lock();
    this.setters = [];
    this.element = {};
    var vertexFormat = this.vertexBuffer.getFormat();
    for(var i = 0;i < vertexFormat.elements.length;i++) {
      var vertexElement = vertexFormat.elements[i];
      this.setters[i] = new VertexIteratorSetter(this.buffer, vertexElement);
      this.element[vertexElement.name] = this.setters[i]
    }
  }
  VertexIterator.prototype = {next:function() {
    var i = 0;
    var setters = this.setters;
    var numSetters = this.setters.length;
    var vertexFormat = this.vertexBuffer.getFormat();
    while(i < numSetters) {
      var setter = setters[i++];
      setter.index += vertexFormat.size / setter.array.constructor.BYTES_PER_ELEMENT
    }
  }, end:function() {
    this.vertexBuffer.unlock()
  }};
  return{VertexIterator:VertexIterator}
}());
pc.extend(pc, function() {
  var _typeSize = [];
  _typeSize[pc.ELEMENTTYPE_INT8] = 1;
  _typeSize[pc.ELEMENTTYPE_UINT8] = 1;
  _typeSize[pc.ELEMENTTYPE_INT16] = 2;
  _typeSize[pc.ELEMENTTYPE_UINT16] = 2;
  _typeSize[pc.ELEMENTTYPE_INT32] = 4;
  _typeSize[pc.ELEMENTTYPE_UINT32] = 4;
  _typeSize[pc.ELEMENTTYPE_FLOAT32] = 4;
  var VertexFormat = function(graphicsDevice, description) {
    var i;
    this.elements = [];
    this.size = 0;
    for(var i = 0, len = description.length;i < len;i++) {
      var elementDesc = description[i];
      var element = {name:elementDesc.semantic, offset:0, stride:0, stream:-1, scopeId:graphicsDevice.scope.resolve(elementDesc.semantic), dataType:elementDesc.type, numComponents:elementDesc.components, normalize:elementDesc.normalize === undefined ? false : elementDesc.normalize, size:elementDesc.components * _typeSize[elementDesc.type]};
      this.elements.push(element);
      this.size += element.size
    }
    var offset = 0;
    for(var i = 0, len = this.elements.length;i < len;i++) {
      var element = this.elements[i];
      element.offset = offset;
      element.stride = this.size;
      offset += element.size
    }
  };
  return{VertexFormat:VertexFormat}
}());
pc.extend(pc, function() {
  var VertexBuffer = function(graphicsDevice, format, numVertices, usage) {
    this.usage = usage || pc.BUFFER_STATIC;
    this.format = format;
    this.numVertices = numVertices;
    this.numBytes = format.size * numVertices;
    this.device = graphicsDevice;
    var gl = this.device.gl;
    this.bufferId = gl.createBuffer();
    this.storage = new ArrayBuffer(this.numBytes)
  };
  VertexBuffer.prototype = {destroy:function() {
    var gl = this.device.gl;
    gl.deleteBuffer(this.bufferId)
  }, getFormat:function() {
    return this.format
  }, getUsage:function() {
    return this.usage
  }, getNumVertices:function() {
    return this.numVertices
  }, lock:function() {
    return this.storage
  }, unlock:function() {
    var gl = this.device.gl;
    var glUsage;
    switch(this.usage) {
      case pc.BUFFER_STATIC:
        glUsage = gl.STATIC_DRAW;
        break;
      case pc.BUFFER_DYNAMIC:
        glUsage = gl.DYNAMIC_DRAW;
        break;
      case pc.BUFFER_STREAM:
        glUsage = gl.STREAM_DRAW;
        break
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.storage, glUsage)
  }};
  return{VertexBuffer:VertexBuffer}
}());
pc.extend(pc, function() {
  var IndexBuffer = function(graphicsDevice, format, numIndices, usage) {
    this.usage = usage || pc.BUFFER_STATIC;
    this.format = format;
    this.numIndices = numIndices;
    this.device = graphicsDevice;
    var gl = this.device.gl;
    this.bufferId = gl.createBuffer();
    var bytesPerIndex;
    if(format === pc.INDEXFORMAT_UINT8) {
      bytesPerIndex = 1;
      this.glFormat = gl.UNSIGNED_BYTE
    }else {
      if(format === pc.INDEXFORMAT_UINT16) {
        bytesPerIndex = 2;
        this.glFormat = gl.UNSIGNED_SHORT
      }else {
        if(format === pc.INDEXFORMAT_UINT32) {
          bytesPerIndex = 4;
          this.glFormat = gl.UNSIGNED_INT
        }
      }
    }
    var numBytes = this.numIndices * bytesPerIndex;
    this.storage = new ArrayBuffer(numBytes)
  };
  IndexBuffer.prototype = {destroy:function() {
    var gl = this.device.gl;
    gl.deleteBuffer(this.bufferId)
  }, getFormat:function() {
    return this.format
  }, getNumIndices:function() {
    return this.numIndices
  }, lock:function() {
    return this.storage
  }, unlock:function() {
    var gl = this.device.gl;
    var glUsage;
    switch(this.usage) {
      case pc.BUFFER_STATIC:
        glUsage = gl.STATIC_DRAW;
        break;
      case pc.BUFFER_DYNAMIC:
        glUsage = gl.DYNAMIC_DRAW;
        break;
      case pc.BUFFER_STREAM:
        glUsage = gl.STREAM_DRAW;
        break
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferId);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.storage, glUsage)
  }};
  return{IndexBuffer:IndexBuffer}
}());
pc.extend(pc, function() {
  var Texture = function(graphicsDevice, options) {
    this.device = graphicsDevice;
    var width = 4;
    var height = 4;
    var format = pc.PIXELFORMAT_R8_G8_B8_A8;
    var cubemap = false;
    var autoMipmap = true;
    var rgbm = false;
    var fixCubemapSeams = false;
    var hdr = false;
    if(options !== undefined) {
      width = options.width !== undefined ? options.width : width;
      height = options.height !== undefined ? options.height : height;
      format = options.format !== undefined ? options.format : format;
      cubemap = options.cubemap !== undefined ? options.cubemap : cubemap;
      autoMipmap = options.autoMipmap !== undefined ? options.autoMipmap : autoMipmap;
      rgbm = options.rgbm !== undefined ? options.rgbm : rgbm;
      hdr = options.hdr !== undefined ? options.hdr : hdr;
      fixCubemapSeams = options.fixCubemapSeams !== undefined ? options.fixCubemapSeams : fixCubemapSeams
    }
    this.name = null;
    this.autoMipmap = autoMipmap;
    this.rgbm = rgbm;
    this.fixCubemapSeams = fixCubemapSeams;
    this.hdr = hdr;
    this._cubemap = cubemap;
    this._format = format;
    this._compressed = format === pc.PIXELFORMAT_DXT1 || format === pc.PIXELFORMAT_DXT3 || format === pc.PIXELFORMAT_DXT5;
    this._width = width || 4;
    this._height = height || 4;
    this._addressU = pc.ADDRESS_REPEAT;
    this._addressV = pc.ADDRESS_REPEAT;
    if(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height)) {
      this._minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR
    }else {
      this._minFilter = pc.FILTER_LINEAR
    }
    this._magFilter = pc.FILTER_LINEAR;
    this._anisotropy = 1;
    this._levels = cubemap ? [[null, null, null, null, null, null]] : [null];
    this._lockedLevel = -1;
    this._needsUpload = true
  };
  Object.defineProperty(Texture.prototype, "minFilter", {get:function() {
    return this._minFilter
  }, set:function(filter) {
    if(!(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height))) {
      if(!(filter === pc.FILTER_NEAREST || filter === pc.FILTER_LINEAR)) {
        logWARNING("Invalid minification filter mode set on non power of two texture. Forcing linear addressing.");
        filter = pc.FILTER_LINEAR
      }
    }
    this._minFilter = filter
  }});
  Object.defineProperty(Texture.prototype, "magFilter", {get:function() {
    return this._magFilter
  }, set:function(magFilter) {
    if(!(magFilter === pc.FILTER_NEAREST || magFilter === pc.FILTER_LINEAR)) {
      logWARNING("Invalid magnification filter mode. Must be set to FILTER_NEAREST or FILTER_LINEAR.")
    }
    this._magFilter = magFilter
  }});
  Object.defineProperty(Texture.prototype, "addressU", {get:function() {
    return this._addressU
  }, set:function(addressU) {
    if(!(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height))) {
      if(addressU !== pc.ADDRESS_CLAMP_TO_EDGE) {
        logWARNING("Invalid address mode in U set on non power of two texture. Forcing clamp to edge addressing.");
        addressU = pc.ADDRESS_CLAMP_TO_EDGE
      }
    }
    this._addressU = addressU
  }});
  Object.defineProperty(Texture.prototype, "addressV", {get:function() {
    return this._addressV
  }, set:function(addressV) {
    if(!(pc.math.powerOfTwo(this._width) && pc.math.powerOfTwo(this._height))) {
      if(addressV !== pc.ADDRESS_CLAMP_TO_EDGE) {
        logWARNING("Invalid address mode in V set on non power of two texture. Forcing clamp to edge addressing.");
        addressV = pc.ADDRESS_CLAMP_TO_EDGE
      }
    }
    this._addressV = addressV
  }});
  Object.defineProperty(Texture.prototype, "anisotropy", {get:function() {
    return this._anisotropy
  }, set:function(anisotropy) {
    this._anisotropy = anisotropy
  }});
  Object.defineProperty(Texture.prototype, "width", {get:function() {
    return this._width
  }});
  Object.defineProperty(Texture.prototype, "height", {get:function() {
    return this._height
  }});
  Object.defineProperty(Texture.prototype, "format", {get:function() {
    return this._format
  }});
  Object.defineProperty(Texture.prototype, "cubemap", {get:function() {
    return this._cubemap
  }});
  pc.extend(Texture.prototype, {bind:function() {
  }, destroy:function() {
    if(this._glTextureId) {
      var gl = this.device.gl;
      gl.deleteTexture(this._glTextureId)
    }
  }, lock:function(options) {
    options = options || {level:0, face:0, mode:pc.TEXTURELOCK_WRITE};
    if(options.level === undefined) {
      options.level = 0
    }
    if(options.face === undefined) {
      options.face = 0
    }
    if(options.mode === undefined) {
      options.mode = pc.TEXTURELOCK_WRITE
    }
    this._lockedLevel = options.level;
    if(this._levels[options.level] === null) {
      switch(this._format) {
        case pc.PIXELFORMAT_A8:
        ;
        case pc.PIXELFORMAT_L8:
          this._levels[options.level] = new Uint8Array(this._width * this._height);
          break;
        case pc.PIXELFORMAT_L8_A8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * 2);
          break;
        case pc.PIXELFORMAT_R5_G6_B5:
        ;
        case pc.PIXELFORMAT_R5_G5_B5_A1:
        ;
        case pc.PIXELFORMAT_R4_G4_B4_A4:
          this._levels[options.level] = new Uint16Array(this._width * this._height);
          break;
        case pc.PIXELFORMAT_R8_G8_B8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * 3);
          break;
        case pc.PIXELFORMAT_R8_G8_B8_A8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * 4);
          break;
        case pc.PIXELFORMAT_DXT1:
          this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 8);
          break;
        case pc.PIXELFORMAT_DXT3:
        ;
        case pc.PIXELFORMAT_DXT5:
          this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 16);
          break;
        case pc.PIXELFORMAT_RGB16F:
        ;
        case pc.PIXELFORMAT_RGB32F:
          this._levels[options.level] = new Float32Array(this._width * this._height * 3);
          break;
        case pc.PIXELFORMAT_RGBA16F:
        ;
        case pc.PIXELFORMAT_RGBA32F:
          this._levels[options.level] = new Float32Array(this._width * this._height * 4);
          break
      }
    }
    return this._levels[options.level]
  }, recover:function() {
  }, load:function(src, loader, requestBatch) {
    if(this._cubemap) {
      var options = {batch:requestBatch};
      var requests = src.map(function(url) {
        return new pc.resources.ImageRequest(url)
      });
      loader.request(requests).then(function(resources) {
        this.setSource(resources)
      }.bind(this))
    }else {
      var request = new pc.resources.ImageRequest(src);
      loader.request(request).then(function(resources) {
        this.setSource(resources[0])
      }.bind(this))
    }
  }, setSource:function(source) {
    if(this._cubemap) {
      logASSERT(Object.prototype.toString.apply(source) === "[object Array]", "pc.Texture: setSource: supplied source is not an array");
      logASSERT(source.length === 6, "pc.Texture: setSource: supplied source does not have 6 entries.");
      var validTypes = 0;
      var validDimensions = true;
      var width = source[0].width;
      var height = source[0].height;
      for(var i = 0;i < 6;i++) {
        if(source[i] instanceof HTMLCanvasElement || source[i] instanceof HTMLImageElement || source[i] instanceof HTMLVideoElement) {
          validTypes++
        }
        if(source[i].width !== width) {
          validDimensions = false
        }
        if(source[i].height !== height) {
          validDimensions = false
        }
      }
      logASSERT(validTypes === 6, "pc.Texture: setSource: Not all supplied source elements are of required type (canvas, image or video).");
      logASSERT(validDimensions, "pc.Texture: setSource: Not all supplied source elements share the same dimensions.");
      this._width = source[0].width;
      this._height = source[0].height;
      this._levels[0] = source
    }else {
      logASSERT(source instanceof HTMLCanvasElement || source instanceof HTMLImageElement || source instanceof HTMLVideoElement, "pc.Texture: setSource: supplied source is not an instance of HTMLCanvasElement, HTMLImageElement or HTMLVideoElement.");
      this._width = source.width;
      this._height = source.height;
      this._levels[0] = source
    }
    this.upload();
    this.minFilter = this._minFilter;
    this.magFilter = this._magFilter;
    this.addressu = this._addressu;
    this.addressv = this._addressv
  }, getSource:function() {
    return this._levels[0]
  }, unlock:function() {
    logASSERT(this._lockedLevel !== -1, "Attempting to unlock a texture that is not locked");
    this.upload();
    this._lockedLevel = -1
  }, upload:function() {
    this._needsUpload = true
  }, getDDS:function() {
    if(this.format != pc.PIXELFORMAT_R8_G8_B8_A8) {
      console.error("This format is not implemented yet")
    }
    var fsize = 128;
    var i = 0;
    var j;
    var face;
    while(this._levels[i]) {
      if(!this.cubemap) {
        var mipSize = this._levels[i].length;
        if(!mipSize) {
          console.error("No byte array for mip " + i);
          return
        }
        fsize += mipSize
      }else {
        for(face = 0;face < 6;face++) {
          var mipSize = this._levels[i][face].length;
          if(!mipSize) {
            console.error("No byte array for mip " + i + ", face " + face);
            return
          }
          fsize += mipSize
        }
      }
      var mipSize;
      fsize += this._levels[i].length;
      i++
    }
    var buff = new ArrayBuffer(fsize);
    var header = new Uint32Array(buff, 0, 128 / 4);
    var DDS_MAGIC = 542327876;
    var DDS_HEADER_SIZE = 124;
    var DDS_FLAGS_REQUIRED = 1 | 2 | 4 | 4096 | 524288;
    var DDS_FLAGS_MIPMAP = 131072;
    var DDS_PIXELFORMAT_SIZE = 32;
    var DDS_PIXELFLAGS_RGBA8 = 1 | 64;
    var DDS_CAPS_REQUIRED = 4096;
    var DDS_CAPS_MIPMAP = 4194304;
    var DDS_CAPS_COMPLEX = 8;
    var DDS_CAPS2_CUBEMAP = 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32768;
    var flags = DDS_FLAGS_REQUIRED;
    if(this._levels.length > 1) {
      flags |= DDS_FLAGS_MIPMAP
    }
    var caps = DDS_CAPS_REQUIRED;
    if(this._levels.length > 1) {
      caps |= DDS_CAPS_MIPMAP
    }
    if(this._levels.length > 1 || this.cubemap) {
      caps |= DDS_CAPS_COMPLEX
    }
    var caps2 = this.cubemap ? DDS_CAPS2_CUBEMAP : 0;
    header[0] = DDS_MAGIC;
    header[1] = DDS_HEADER_SIZE;
    header[2] = flags;
    header[3] = this.height;
    header[4] = this.width;
    header[5] = this.width * this.height * 4;
    header[6] = 0;
    header[7] = this._levels.length;
    for(i = 0;i < 11;i++) {
      header[8 + i] = 0
    }
    header[19] = DDS_PIXELFORMAT_SIZE;
    header[20] = DDS_PIXELFLAGS_RGBA8;
    header[21] = 0;
    header[22] = 32;
    header[23] = 16711680;
    header[24] = 65280;
    header[25] = 255;
    header[26] = 4278190080;
    header[27] = caps;
    header[28] = caps2;
    header[29] = 0;
    header[30] = 0;
    header[31] = 0;
    var offset = 128;
    if(!this.cubemap) {
      for(i = 0;i < this._levels.length;i++) {
        var level = this._levels[i];
        var mip = new Uint8Array(buff, offset, level.length);
        for(j = 0;j < level.length;j++) {
          mip[j] = level[j]
        }
        offset += level.length
      }
    }else {
      for(face = 0;face < 6;face++) {
        for(i = 0;i < this._levels.length;i++) {
          var level = this._levels[i][face];
          var mip = new Uint8Array(buff, offset, level.length);
          for(j = 0;j < level.length;j++) {
            mip[j] = level[j]
          }
          offset += level.length
        }
      }
    }
    return buff
  }});
  return{Texture:Texture}
}());
pc.extend(pc, function() {
  var defaultOptions = {depth:true, face:0};
  var RenderTarget = function(graphicsDevice, colorBuffer, options) {
    this._device = graphicsDevice;
    this._colorBuffer = colorBuffer;
    options = options !== undefined ? options : defaultOptions;
    this._face = options.face !== undefined ? options.face : 0;
    this._depth = options.depth !== undefined ? options.depth : true
  };
  RenderTarget.prototype = {bind:function() {
  }, destroy:function() {
    var gl = this._device.gl;
    gl.deleteFramebuffer(this._frameBuffer);
    if(this._depthBuffer) {
      gl.deleteRenderbuffer(this._depthBuffer)
    }
  }, unbind:function() {
  }};
  Object.defineProperty(RenderTarget.prototype, "colorBuffer", {get:function() {
    return this._colorBuffer
  }});
  Object.defineProperty(RenderTarget.prototype, "face", {get:function() {
    return this._face
  }});
  Object.defineProperty(RenderTarget.prototype, "width", {get:function() {
    return this._colorBuffer.width
  }});
  Object.defineProperty(RenderTarget.prototype, "height", {get:function() {
    return this._colorBuffer.height
  }});
  return{RenderTarget:RenderTarget}
}());
pc.extend(pc, function() {
  var ShaderInput = function(graphicsDevice, name, type, locationId) {
    this.locationId = locationId;
    this.scopeId = graphicsDevice.scope.resolve(name);
    this.version = new pc.Version;
    this.dataType = type;
    this.array = []
  };
  return{ShaderInput:ShaderInput}
}());
pc.extend(pc, function() {
  function addLineNumbers(src) {
    var chunks = src.split("\n");
    for(var i = 0, len = chunks.length;i < len;i++) {
      chunks[i] = i + 1 + ":\t" + chunks[i]
    }
    return chunks.join("\n")
  }
  function createShader(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    var ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if(!ok) {
      var error = gl.getShaderInfoLog(shader);
      var typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      logERROR("Failed to compile " + typeName + " shader:\n\n" + addLineNumbers(src) + "\n\n" + error)
    }
    return shader
  }
  function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var ok = gl.getProgramParameter(program, gl.LINK_STATUS);
    if(!ok) {
      var error = gl.getProgramInfoLog(program);
      logERROR("Failed to link shader program. Error: " + error)
    }
    return program
  }
  var Shader = function(graphicsDevice, definition) {
    this.device = graphicsDevice;
    this.definition = definition;
    var gl = this.device.gl;
    var vertexShader = createShader(gl, gl.VERTEX_SHADER, definition.vshader);
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, definition.fshader);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    this.attributes = [];
    this.uniforms = [];
    this.samplers = [];
    var i = 0;
    var info, location;
    var _typeToPc = {};
    _typeToPc[gl.BOOL] = pc.UNIFORMTYPE_BOOL;
    _typeToPc[gl.INT] = pc.UNIFORMTYPE_INT;
    _typeToPc[gl.FLOAT] = pc.UNIFORMTYPE_FLOAT;
    _typeToPc[gl.FLOAT_VEC2] = pc.UNIFORMTYPE_VEC2;
    _typeToPc[gl.FLOAT_VEC3] = pc.UNIFORMTYPE_VEC3;
    _typeToPc[gl.FLOAT_VEC4] = pc.UNIFORMTYPE_VEC4;
    _typeToPc[gl.INT_VEC2] = pc.UNIFORMTYPE_IVEC2;
    _typeToPc[gl.INT_VEC3] = pc.UNIFORMTYPE_IVEC3;
    _typeToPc[gl.INT_VEC4] = pc.UNIFORMTYPE_IVEC4;
    _typeToPc[gl.BOOL_VEC2] = pc.UNIFORMTYPE_BVEC2;
    _typeToPc[gl.BOOL_VEC3] = pc.UNIFORMTYPE_BVEC3;
    _typeToPc[gl.BOOL_VEC4] = pc.UNIFORMTYPE_BVEC4;
    _typeToPc[gl.FLOAT_MAT2] = pc.UNIFORMTYPE_MAT2;
    _typeToPc[gl.FLOAT_MAT3] = pc.UNIFORMTYPE_MAT3;
    _typeToPc[gl.FLOAT_MAT4] = pc.UNIFORMTYPE_MAT4;
    _typeToPc[gl.SAMPLER_2D] = pc.UNIFORMTYPE_TEXTURE2D;
    _typeToPc[gl.SAMPLER_CUBE] = pc.UNIFORMTYPE_TEXTURECUBE;
    var numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    while(i < numAttributes) {
      info = gl.getActiveAttrib(this.program, i++);
      location = gl.getAttribLocation(this.program, info.name);
      if(definition.attributes[info.name] === undefined) {
        console.error('Vertex shader attribute "' + info.name + '" is not mapped to a semantic in shader definition.')
      }
      var attr = new pc.ShaderInput(graphicsDevice, definition.attributes[info.name], _typeToPc[info.type], location);
      this.attributes.push(attr)
    }
    i = 0;
    var numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    while(i < numUniforms) {
      info = gl.getActiveUniform(this.program, i++);
      location = gl.getUniformLocation(this.program, info.name);
      if(info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_CUBE) {
        this.samplers.push(new pc.ShaderInput(graphicsDevice, info.name, _typeToPc[info.type], location))
      }else {
        this.uniforms.push(new pc.ShaderInput(graphicsDevice, info.name, _typeToPc[info.type], location))
      }
    }
  };
  Shader.prototype = {destroy:function() {
    var gl = this.device.gl;
    gl.deleteProgram(this.program)
  }};
  return{Shader:Shader}
}());
pc.extend(pc, function() {
  var ProgramLibrary = function(device) {
    this._device = device;
    this._cache = {};
    this._generators = {}
  };
  ProgramLibrary.prototype.register = function(name, generator) {
    if(!this.isRegistered(name)) {
      this._generators[name] = generator
    }
  };
  ProgramLibrary.prototype.unregister = function(name) {
    if(this.isRegistered(name)) {
      delete this._generators[name]
    }
  };
  ProgramLibrary.prototype.isRegistered = function(name) {
    var generator = this._generators[name];
    return generator !== undefined
  };
  ProgramLibrary.prototype.getProgram = function(name, options) {
    var generator = this._generators[name];
    if(generator === undefined) {
      logERROR("No program library functions registered for: " + name);
      return null
    }
    var key = generator.generateKey(gd, options);
    var shader = this._cache[key];
    if(!shader) {
      var gd = this._device;
      var shaderDefinition = generator.createShaderDefinition(gd, options);
      shader = this._cache[key] = new pc.Shader(gd, shaderDefinition)
    }
    return shader
  };
  return{ProgramLibrary:ProgramLibrary}
}());
pc.extend(pc, function() {
  var EVENT_RESIZE = "resizecanvas";
  function UnsupportedBrowserError(message) {
    this.name = "UnsupportedBrowserError";
    this.message = message || ""
  }
  UnsupportedBrowserError.prototype = Error.prototype;
  function ContextCreationError(message) {
    this.name = "ContextCreationError";
    this.message = message || ""
  }
  ContextCreationError.prototype = Error.prototype;
  var _contextLostHandler = function() {
    logWARNING("Context lost.")
  };
  var _contextRestoredHandler = function() {
    logINFO("Context restored.")
  };
  var _createContext = function(canvas, options) {
    var names = ["webgl", "experimental-webgl"];
    var context = null;
    for(var i = 0;i < names.length;i++) {
      try {
        context = canvas.getContext(names[i], options)
      }catch(e) {
      }
      if(context) {
        break
      }
    }
    return context
  };
  var _downsampleImage = function(image, size) {
    var srcW = image.width;
    var srcH = image.height;
    if(srcW > size || srcH > size) {
      var scale = size / Math.max(srcW, srcH);
      var dstW = Math.floor(srcW * scale);
      var dstH = Math.floor(srcH * scale);
      console.warn("Image dimensions larger than max supported texture size of " + size + ". " + "Resizing from " + srcW + ", " + srcH + " to " + dstW + ", " + dstH + ".");
      var canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      var context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
      return canvas
    }
    return image
  };
  function _isIE() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf("MSIE ");
    var trident = navigator.userAgent.match(/Trident.*rv\:11\./);
    return msie > 0 || !!trident
  }
  var GraphicsDevice = function(canvas) {
    this.gl = undefined;
    this.canvas = canvas;
    this.shader = null;
    this.indexBuffer = null;
    this.vertexBuffers = [];
    this.precision = "highp";
    this.attributesInvalidated = true;
    this.boundBuffer = null;
    this.enabledAttributes = {};
    this.textureUnits = [];
    this.commitFunction = {};
    if(!window.WebGLRenderingContext) {
      throw new pc.UnsupportedBrowserError;
    }
    this.gl = _createContext(canvas);
    var gl = this.gl;
    if(!this.gl) {
      throw new pc.ContextCreationError;
    }
    (function() {
      canvas.addEventListener("webglcontextlost", _contextLostHandler, false);
      canvas.addEventListener("webglcontextrestored", _contextRestoredHandler, false);
      this.canvas = canvas;
      this.shader = null;
      this.indexBuffer = null;
      this.vertexBuffers = [];
      this.precision = "highp";
      this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
      var vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      var vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);
      var vertexShaderPrecisionLowpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.LOW_FLOAT);
      var fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      var fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
      var fragmentShaderPrecisionLowpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_FLOAT);
      var vertexShaderPrecisionHighpInt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_INT);
      var vertexShaderPrecisionMediumpInt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_INT);
      var vertexShaderPrecisionLowpInt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.LOW_INT);
      var fragmentShaderPrecisionHighpInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_INT);
      var fragmentShaderPrecisionMediumpInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_INT);
      var fragmentShaderPrecisionLowpInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_INT);
      var highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
      var mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;
      if(!highpAvailable) {
        if(mediumpAvailable) {
          this.precision = "mediump";
          console.warn("WARNING: highp not supported, using mediump")
        }else {
          this.precision = "lowp";
          console.warn("WARNING: highp and mediump not supported, using lowp")
        }
      }
      this.defaultClearOptions = {color:[0, 0, 0, 1], depth:1, flags:pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH};
      this.glAddress = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
      this.glBlendEquation = [gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT];
      this.glBlendFunction = [gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA];
      this.glClearFlag = [0, gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT];
      this.glFilter = [gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR];
      this.glPrimitive = [gl.POINTS, gl.LINES, gl.LINE_LOOP, gl.LINE_STRIP, gl.TRIANGLES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN];
      this.glType = [gl.BYTE, gl.UNSIGNED_BYTE, gl.SHORT, gl.UNSIGNED_SHORT, gl.INT, gl.UNSIGNED_INT, gl.FLOAT];
      this.extTextureFloat = gl.getExtension("OES_texture_float");
      this.extTextureFloatLinear = gl.getExtension("OES_texture_float_linear");
      this.extTextureHalfFloat = gl.getExtension("OES_texture_half_float");
      this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
      this.supportsBoneTextures = this.extTextureFloat && this.maxVertexTextures > 0;
      this.extTextureFloatRenderable = !!this.extTextureFloat;
      if(this.extTextureFloat) {
        var __texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, __texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var __width = 2;
        var __height = 2;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, __width, __height, 0, gl.RGBA, gl.FLOAT, null);
        var __fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, __fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, __texture, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
          this.extTextureFloatRenderable = false
        }
      }
      this.extTextureLod = gl.getExtension("EXT_shader_texture_lod");
      this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
      this.samplerCount = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
      this.extDepthTexture = null;
      this.extStandardDerivatives = gl.getExtension("OES_standard_derivatives");
      if(this.extStandardDerivatives) {
        gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST)
      }
      this.extTextureFilterAnisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
      if(!this.extTextureFilterAnisotropic) {
        this.extTextureFilterAnisotropic = gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic")
      }
      this.extCompressedTextureS3TC = gl.getExtension("WEBGL_compressed_texture_s3tc");
      if(!this.extCompressedTextureS3TC) {
        this.extCompressedTextureS3TC = gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc")
      }
      if(this.extCompressedTextureS3TC) {
        if(_isIE()) {
          this.extCompressedTextureS3TC = false
        }
      }
      if(this.extCompressedTextureS3TC) {
        var formats = gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS);
        for(var i = 0;i < formats.length;i++) {
          switch(formats[i]) {
            case this.extCompressedTextureS3TC.COMPRESSED_RGB_S3TC_DXT1_EXT:
              break;
            case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT1_EXT:
              break;
            case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT3_EXT:
              break;
            case this.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT5_EXT:
              break;
            default:
              break
          }
        }
      }
      this.extDrawBuffers = gl.getExtension("EXT_draw_buffers");
      this.maxDrawBuffers = this.extDrawBuffers ? gl.getParameter(this.extDrawBuffers.MAX_DRAW_BUFFERS_EXT) : 1;
      this.maxColorAttachments = this.extDrawBuffers ? gl.getParameter(this.extDrawBuffers.MAX_COLOR_ATTACHMENTS_EXT) : 1;
      this.renderTarget = null;
      this.scope = new pc.ScopeSpace("Device");
      this.commitFunction = {};
      this.commitFunction[pc.UNIFORMTYPE_BOOL] = function(locationId, value) {
        gl.uniform1i(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_INT] = function(locationId, value) {
        gl.uniform1i(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_FLOAT] = function(locationId, value) {
        if(typeof value == "number") {
          gl.uniform1f(locationId, value)
        }else {
          gl.uniform1fv(locationId, value)
        }
      };
      this.commitFunction[pc.UNIFORMTYPE_VEC2] = function(locationId, value) {
        gl.uniform2fv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_VEC3] = function(locationId, value) {
        gl.uniform3fv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_VEC4] = function(locationId, value) {
        gl.uniform4fv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_IVEC2] = function(locationId, value) {
        gl.uniform2iv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_BVEC2] = function(locationId, value) {
        gl.uniform2iv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_IVEC3] = function(locationId, value) {
        gl.uniform3iv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_BVEC3] = function(locationId, value) {
        gl.uniform3iv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_IVEC4] = function(locationId, value) {
        gl.uniform4iv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_BVEC4] = function(locationId, value) {
        gl.uniform4iv(locationId, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_MAT2] = function(locationId, value) {
        gl.uniformMatrix2fv(locationId, false, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_MAT3] = function(locationId, value) {
        gl.uniformMatrix3fv(locationId, false, value)
      };
      this.commitFunction[pc.UNIFORMTYPE_MAT4] = function(locationId, value) {
        gl.uniformMatrix4fv(locationId, false, value)
      };
      this.setBlending(false);
      this.setBlendFunction(pc.BLENDMODE_ONE, pc.BLENDMODE_ZERO);
      this.setBlendEquation(pc.BLENDEQUATION_ADD);
      this.setColorWrite(true, true, true, true);
      this.setCullMode(pc.CULLFACE_BACK);
      this.setDepthTest(true);
      this.setDepthWrite(true);
      this.setClearDepth(1);
      this.setClearColor(0, 0, 0, 0);
      gl.enable(gl.SCISSOR_TEST);
      this.programLib = new pc.ProgramLibrary(this);
      for(var generator in pc.programlib) {
        this.programLib.register(generator, pc.programlib[generator])
      }
      var numUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
      numUniforms -= 4 * 4;
      numUniforms -= 8;
      numUniforms -= 1;
      numUniforms -= 4 * 4;
      this.boneLimit = Math.floor(numUniforms / 4);
      if(this.boneLimit > 110) {
        this.boneLimit = 110
      }
      pc.events.attach(this);
      this.boundBuffer = null;
      this.textureUnits = [];
      this.attributesInvalidated = true;
      this.enabledAttributes = {};
      var bufferId = gl.createBuffer();
      var storage = new ArrayBuffer(16);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
      gl.bufferData(gl.ARRAY_BUFFER, storage, gl.STATIC_DRAW);
      gl.getError();
      gl.vertexAttribPointer(0, 4, gl.UNSIGNED_BYTE, false, 4, 0);
      this.supportsUnsignedByte = gl.getError() === 0;
      gl.deleteBuffer(bufferId)
    }).call(this)
  };
  GraphicsDevice.prototype = {setViewport:function(x, y, width, height) {
    var gl = this.gl;
    gl.viewport(x, y, width, height)
  }, setScissor:function(x, y, width, height) {
    var gl = this.gl;
    gl.scissor(x, y, width, height)
  }, getProgramLibrary:function() {
    return this.programLib
  }, setProgramLibrary:function(programLib) {
    this.programLib = programLib
  }, updateBegin:function() {
    var gl = this.gl;
    this.boundBuffer = null;
    this.indexBuffer = null;
    var target = this.renderTarget;
    if(target) {
      if(!target._glFrameBuffer) {
        target._glFrameBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, target._glFrameBuffer);
        if(!target._colorBuffer._glTextureId) {
          this.setTexture(target._colorBuffer, 0)
        }
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, target._colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, target._colorBuffer._glTextureId, 0);
        if(target._depth) {
          if(!target._glDepthBuffer) {
            target._glDepthBuffer = gl.createRenderbuffer()
          }
          gl.bindRenderbuffer(gl.RENDERBUFFER, target._glDepthBuffer);
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, target.width, target.height);
          gl.bindRenderbuffer(gl.RENDERBUFFER, null);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target._glDepthBuffer)
        }
        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        switch(status) {
          case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
            console.error("ERROR: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
            break;
          case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
            console.error("ERROR: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
            break;
          case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
            console.error("ERROR: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
            break;
          case gl.FRAMEBUFFER_UNSUPPORTED:
            console.error("ERROR: FRAMEBUFFER_UNSUPPORTED");
            break;
          case gl.FRAMEBUFFER_COMPLETE:
            break;
          default:
            break
        }
      }else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target._glFrameBuffer)
      }
    }else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    for(var i = 0;i < 16;i++) {
      this.textureUnits[i] = null
    }
  }, updateEnd:function() {
    var gl = this.gl;
    var target = this.renderTarget;
    if(target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
  }, initializeTexture:function(texture) {
    var gl = this.gl;
    texture._glTextureId = gl.createTexture();
    texture._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D;
    switch(texture._format) {
      case pc.PIXELFORMAT_A8:
        texture._glFormat = gl.ALPHA;
        texture._glInternalFormat = gl.ALPHA;
        texture._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case pc.PIXELFORMAT_L8:
        texture._glFormat = gl.LUMINANCE;
        texture._glInternalFormat = gl.LUMINANCE;
        texture._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case pc.PIXELFORMAT_L8_A8:
        texture._glFormat = gl.LUMINANCE_ALPHA;
        texture._glInternalFormat = gl.LUMINANCE_ALPHA;
        texture._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case pc.PIXELFORMAT_R5_G6_B5:
        texture._glFormat = gl.RGB;
        texture._glInternalFormat = gl.RGB;
        texture._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
        break;
      case pc.PIXELFORMAT_R5_G5_B5_A1:
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = gl.RGBA;
        texture._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
        break;
      case pc.PIXELFORMAT_R4_G4_B4_A4:
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = gl.RGBA;
        texture._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
        break;
      case pc.PIXELFORMAT_R8_G8_B8:
        texture._glFormat = gl.RGB;
        texture._glInternalFormat = gl.RGB;
        texture._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case pc.PIXELFORMAT_R8_G8_B8_A8:
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = gl.RGBA;
        texture._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case pc.PIXELFORMAT_DXT1:
        ext = this.extCompressedTextureS3TC;
        texture._glFormat = gl.RGB;
        texture._glInternalFormat = ext.COMPRESSED_RGB_S3TC_DXT1_EXT;
        break;
      case pc.PIXELFORMAT_DXT3:
        ext = this.extCompressedTextureS3TC;
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        break;
      case pc.PIXELFORMAT_DXT5:
        ext = this.extCompressedTextureS3TC;
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = ext.COMPRESSED_RGBA_S3TC_DXT5_EXT;
        break;
      case pc.PIXELFORMAT_RGB16F:
        ext = this.extTextureHalfFloat;
        texture._glFormat = gl.RGB;
        texture._glInternalFormat = gl.RGB;
        texture._glPixelType = ext.HALF_FLOAT_OES;
        break;
      case pc.PIXELFORMAT_RGBA16F:
        ext = this.extTextureHalfFloat;
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = gl.RGBA;
        texture._glPixelType = ext.HALF_FLOAT_OES;
        break;
      case pc.PIXELFORMAT_RGB32F:
        texture._glFormat = gl.RGB;
        texture._glInternalFormat = gl.RGB;
        texture._glPixelType = gl.FLOAT;
        break;
      case pc.PIXELFORMAT_RGBA32F:
        texture._glFormat = gl.RGBA;
        texture._glInternalFormat = gl.RGBA;
        texture._glPixelType = gl.FLOAT;
        break
    }
  }, uploadTexture:function(texture) {
    var gl = this.gl;
    var mipLevel = 0;
    var mipObject;
    while(texture._levels[mipLevel] || mipLevel == 0) {
      mipObject = texture._levels[mipLevel];
      if(mipLevel == 1 && !texture._compressed) {
        gl.generateMipmap(texture._glTarget)
      }
      if(texture._cubemap) {
        var face;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if(mipObject[0] instanceof HTMLCanvasElement || mipObject[0] instanceof HTMLImageElement || mipObject[0] instanceof HTMLVideoElement) {
          for(face = 0;face < 6;face++) {
            var src = mipObject[face];
            if(src instanceof HTMLImageElement) {
              if(src.width > this.maxCubeMapSize || src.height > this.maxCubeMapSize) {
                src = _downsampleImage(src, this.maxCubeMapSize)
              }
            }
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, texture._glInternalFormat, texture._glFormat, texture._glPixelType, src)
          }
        }else {
          var resMult = 1 / Math.pow(2, mipLevel);
          for(face = 0;face < 6;face++) {
            if(texture._compressed) {
              if(this.extCompressedTextureS3TC) {
                gl.compressedTexImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, texture._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, mipObject[face])
              }
            }else {
              gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, texture._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, texture._glFormat, texture._glPixelType, mipObject[face])
            }
          }
        }
      }else {
        if(mipObject instanceof HTMLCanvasElement || mipObject instanceof HTMLImageElement || mipObject instanceof HTMLVideoElement) {
          if(mipObject instanceof HTMLImageElement) {
            if(mipObject.width > this.maxTextureSize || mipObject.height > this.maxTextureSize) {
              mipObject = _downsampleImage(mipObject, this.maxTextureSize)
            }
          }
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, mipLevel, texture._glInternalFormat, texture._glFormat, texture._glPixelType, mipObject)
        }else {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          var resMult = 1 / Math.pow(2, mipLevel);
          if(texture._compressed) {
            if(this.extCompressedTextureS3TC) {
              gl.compressedTexImage2D(gl.TEXTURE_2D, mipLevel, texture._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, mipObject)
            }
          }else {
            gl.texImage2D(gl.TEXTURE_2D, mipLevel, texture._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, texture._glFormat, texture._glPixelType, mipObject)
          }
        }
      }
      mipLevel++
    }
    if(texture.autoMipmap && pc.math.powerOfTwo(texture._width) && pc.math.powerOfTwo(texture._height) && texture._levels.length === 1 && !texture._compressed) {
      gl.generateMipmap(texture._glTarget)
    }
  }, setTexture:function(texture, textureUnit) {
    var gl = this.gl;
    if(!texture._glTextureId) {
      this.initializeTexture(texture)
    }
    gl.activeTexture(gl.TEXTURE0 + textureUnit);
    if(this.textureUnits[textureUnit] !== texture) {
      gl.bindTexture(texture._glTarget, texture._glTextureId);
      this.textureUnits[textureUnit] = texture
    }
    gl.texParameteri(texture._glTarget, gl.TEXTURE_MIN_FILTER, this.glFilter[texture._minFilter]);
    gl.texParameteri(texture._glTarget, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
    gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
    gl.texParameteri(texture._glTarget, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
    var ext = this.extTextureFilterAnisotropic;
    if(ext) {
      var maxAnisotropy = this.maxAnisotropy;
      var anisotropy = texture.anisotropy;
      anisotropy = Math.min(anisotropy, maxAnisotropy);
      gl.texParameterf(texture._glTarget, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy)
    }
    if(texture._needsUpload) {
      this.uploadTexture(texture);
      texture._needsUpload = false
    }
  }, draw:function(primitive) {
    var gl = this.gl;
    var i, j, len, sampler, samplerValue, texture, numTextures, uniform, scopeId, uniformVersion, programVersion;
    var shader = this.shader;
    var samplers = shader.samplers;
    var uniforms = shader.uniforms;
    if(this.attributesInvalidated) {
      var attribute, element, vertexBuffer;
      var attributes = shader.attributes;
      for(i = 0, len = attributes.length;i < len;i++) {
        attribute = attributes[i];
        element = attribute.scopeId.value;
        if(element !== null) {
          vertexBuffer = this.vertexBuffers[element.stream];
          if(this.boundBuffer !== vertexBuffer.bufferId) {
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.bufferId);
            this.boundBuffer = vertexBuffer.bufferId
          }
          if(!this.enabledAttributes[attribute.locationId]) {
            gl.enableVertexAttribArray(attribute.locationId);
            this.enabledAttributes[attribute.locationId] = true
          }
          gl.vertexAttribPointer(attribute.locationId, element.numComponents, this.glType[element.dataType], element.normalize, element.stride, element.offset)
        }
      }
      this.attributesInvalidated = false
    }
    textureUnit = 0;
    for(i = 0, len = samplers.length;i < len;i++) {
      sampler = samplers[i];
      samplerValue = sampler.scopeId.value;
      if(samplerValue instanceof pc.Texture) {
        texture = samplerValue;
        this.setTexture(texture, textureUnit);
        if(sampler.slot !== textureUnit) {
          gl.uniform1i(sampler.locationId, textureUnit);
          sampler.slot = textureUnit
        }
        textureUnit++
      }else {
        sampler.array.length = 0;
        numTexures = samplerValue.length;
        for(j = 0;j < numTexures;j++) {
          texture = samplerValue[j];
          this.setTexture(texture, textureUnit);
          sampler.array[j] = textureUnit;
          textureUnit++
        }
        gl.uniform1iv(sampler.locationId, sampler.array)
      }
    }
    for(i = 0, len = uniforms.length;i < len;i++) {
      uniform = uniforms[i];
      scopeId = uniform.scopeId;
      uniformVersion = uniform.version;
      programVersion = scopeId.versionObject.version;
      if(uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
        uniformVersion.globalId = programVersion.globalId;
        uniformVersion.revision = programVersion.revision;
        if(scopeId.value !== null) {
          this.commitFunction[uniform.dataType](uniform.locationId, scopeId.value)
        }
      }
    }
    if(primitive.indexed) {
      gl.drawElements(this.glPrimitive[primitive.type], primitive.count, this.indexBuffer.glFormat, primitive.base * 2)
    }else {
      gl.drawArrays(this.glPrimitive[primitive.type], primitive.base, primitive.count)
    }
  }, clear:function(options) {
    var defaultOptions = this.defaultClearOptions;
    options = options || defaultOptions;
    var flags = options.flags === undefined ? defaultOptions.flags : options.flags;
    if(flags !== 0) {
      var gl = this.gl;
      if(flags & pc.CLEARFLAG_COLOR) {
        var color = options.color === undefined ? defaultOptions.color : options.color;
        this.setClearColor(color[0], color[1], color[2], color[3])
      }
      if(flags & pc.CLEARFLAG_DEPTH) {
        var depth = options.depth === undefined ? defaultOptions.depth : options.depth;
        this.setClearDepth(depth);
        if(!this.depthWrite) {
          gl.depthMask(true)
        }
      }
      gl.clear(this.glClearFlag[flags]);
      if(flags & pc.CLEARFLAG_DEPTH) {
        if(!this.depthWrite) {
          gl.depthMask(false)
        }
      }
    }
  }, readPixels:function(x, y, w, h, pixels) {
    var gl = this.gl;
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  }, setClearDepth:function(depth) {
    if(depth !== this.clearDepth) {
      this.gl.clearDepth(depth);
      this.clearDepth = depth
    }
  }, setClearColor:function(r, g, b, a) {
    if(r !== this.clearRed || g !== this.clearGreen || b !== this.clearBlue || a !== this.clearAlpha) {
      this.gl.clearColor(r, g, b, a);
      this.clearRed = r;
      this.clearGreen = g;
      this.clearBlue = b;
      this.clearAlpha = a
    }
  }, setRenderTarget:function(renderTarget) {
    this.renderTarget = renderTarget
  }, getRenderTarget:function() {
    return this.renderTarget
  }, getDepthTest:function() {
    return this.depthTest
  }, setDepthTest:function(depthTest) {
    if(this.depthTest !== depthTest) {
      var gl = this.gl;
      if(depthTest) {
        gl.enable(gl.DEPTH_TEST)
      }else {
        gl.disable(gl.DEPTH_TEST)
      }
      this.depthTest = depthTest
    }
  }, getDepthWrite:function() {
    return this.depthWrite
  }, setDepthWrite:function(writeDepth) {
    if(this.depthWrite !== writeDepth) {
      this.gl.depthMask(writeDepth);
      this.depthWrite = writeDepth
    }
  }, setColorWrite:function(writeRed, writeGreen, writeBlue, writeAlpha) {
    if(this.writeRed !== writeRed || this.writeGreen !== writeGreen || this.writeBlue !== writeBlue || this.writeAlpha !== writeAlpha) {
      this.gl.colorMask(writeRed, writeGreen, writeBlue, writeAlpha);
      this.writeRed = writeRed;
      this.writeGreen = writeGreen;
      this.writeBlue = writeBlue;
      this.writeAlpha = writeAlpha
    }
  }, getBlending:function() {
    return this.blending
  }, setBlending:function(blending) {
    if(this.blending !== blending) {
      var gl = this.gl;
      if(blending) {
        gl.enable(gl.BLEND)
      }else {
        gl.disable(gl.BLEND)
      }
      this.blending = blending
    }
  }, setBlendFunction:function(blendSrc, blendDst) {
    if(this.blendSrc !== blendSrc || this.blendDst !== blendDst) {
      this.gl.blendFunc(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst]);
      this.blendSrc = blendSrc;
      this.blendDst = blendDst
    }
  }, setBlendEquation:function(blendEquation) {
    if(this.blendEquation !== blendEquation) {
      var gl = this.gl;
      gl.blendEquation(this.glBlendEquation[blendEquation]);
      this.blendEquation = blendEquation
    }
  }, setCullMode:function(cullMode) {
    if(this.cullMode !== cullMode) {
      var gl = this.gl;
      switch(cullMode) {
        case pc.CULLFACE_NONE:
          gl.disable(gl.CULL_FACE);
          break;
        case pc.CULLFACE_FRONT:
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.FRONT);
          break;
        case pc.CULLFACE_BACK:
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.BACK);
          break;
        case pc.CULLFACE_FRONTANDBACK:
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.FRONT_AND_BACK);
          break
      }
      this.cullMode = cullMode
    }
  }, setIndexBuffer:function(indexBuffer) {
    if(this.indexBuffer !== indexBuffer) {
      this.indexBuffer = indexBuffer;
      var gl = this.gl;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer ? indexBuffer.bufferId : null)
    }
  }, setVertexBuffer:function(vertexBuffer, stream) {
    if(this.vertexBuffers[stream] !== vertexBuffer) {
      this.vertexBuffers[stream] = vertexBuffer;
      var vertexFormat = vertexBuffer.getFormat();
      var i = 0;
      var elements = vertexFormat.elements;
      var numElements = elements.length;
      while(i < numElements) {
        var vertexElement = elements[i++];
        vertexElement.stream = stream;
        vertexElement.scopeId.setValue(vertexElement)
      }
      this.attributesInvalidated = true
    }
  }, setShader:function(shader) {
    if(shader !== this.shader) {
      this.shader = shader;
      var gl = this.gl;
      gl.useProgram(shader.program);
      this.attributesInvalidated = true
    }
  }, getBoneLimit:function() {
    return this.boneLimit
  }, setBoneLimit:function(maxBones) {
    this.boneLimit = maxBones
  }, enableValidation:function(enable) {
    console.warn("enableValidation: This function is deprecated and will be removed shortly.")
  }, validate:function() {
    console.warn("validate: This function is deprecated and will be removed shortly.")
  }, resizeCanvas:function(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.fire(EVENT_RESIZE, width, height)
  }};
  Object.defineProperty(GraphicsDevice.prototype, "width", {get:function() {
    return this.gl.drawingBufferWidth || this.canvas.width
  }});
  Object.defineProperty(GraphicsDevice.prototype, "height", {get:function() {
    return this.gl.drawingBufferHeight || this.canvas.height
  }});
  Object.defineProperty(GraphicsDevice.prototype, "fullscreen", {get:function() {
    return!!document.fullscreenElement
  }, set:function(fullscreen) {
    if(fullscreen) {
      var canvas = this.gl.canvas;
      canvas.requestFullscreen()
    }else {
      document.exitFullscreen()
    }
  }});
  Object.defineProperty(GraphicsDevice.prototype, "maxAnisotropy", {get:function() {
    var maxAniso;
    return function() {
      if(maxAniso === undefined) {
        maxAniso = 1;
        var gl = this.gl;
        var glExt = this.extTextureFilterAnisotropic;
        if(glExt) {
          maxAniso = gl.getParameter(glExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
        }
      }
      return maxAniso
    }
  }()});
  return{UnsupportedBrowserError:UnsupportedBrowserError, ContextCreationError:ContextCreationError, GraphicsDevice:GraphicsDevice, precalculatedTangents:true}
}());
pc.extend(pc, function() {
  var shaderChunks = {};
  var shaderCache = {};
  shaderChunks.collectAttribs = function(vsCode) {
    var attribs = {};
    var attrs = 0;
    var found = vsCode.indexOf("attribute");
    while(found >= 0) {
      var endOfLine = vsCode.indexOf(";", found);
      var startOfAttribName = vsCode.lastIndexOf(" ", endOfLine);
      var attribName = vsCode.substr(startOfAttribName + 1, endOfLine - (startOfAttribName + 1));
      if(attribName == "aPosition") {
        attribs.aPosition = pc.SEMANTIC_POSITION
      }else {
        attribs[attribName] = "ATTR" + attrs;
        attrs++
      }
      found = vsCode.indexOf("attribute", found + 1)
    }
    return attribs
  };
  shaderChunks.createShader = function(device, vsName, psName) {
    var vsCode = shaderChunks[vsName];
    var psCode = pc.programlib.getSnippet(device, "fs_precision") + "\n" + shaderChunks[psName];
    attribs = this.collectAttribs(vsCode);
    return new pc.Shader(device, {attributes:attribs, vshader:vsCode, fshader:psCode})
  };
  shaderChunks.createShaderFromCode = function(device, vsCode, psCode, uName) {
    var cached = shaderCache[uName];
    if(cached != undefined) {
      return cached
    }
    psCode = pc.programlib.getSnippet(device, "fs_precision") + "\n" + psCode;
    attribs = this.collectAttribs(vsCode);
    shaderCache[uName] = new pc.Shader(device, {attributes:attribs, vshader:vsCode, fshader:psCode});
    return shaderCache[uName]
  };
  return{shaderChunks:shaderChunks}
}());
pc.extend(pc, function() {
  var _postEffectQuadVB = null;
  function drawQuadWithShader(device, target, shader) {
    if(_postEffectQuadVB == null) {
      var vertexFormat = new pc.VertexFormat(device, [{semantic:pc.SEMANTIC_POSITION, components:2, type:pc.ELEMENTTYPE_FLOAT32}]);
      _postEffectQuadVB = new pc.VertexBuffer(device, vertexFormat, 4);
      var iterator = new pc.VertexIterator(_postEffectQuadVB);
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1);
      iterator.end()
    }
    device.setRenderTarget(target);
    device.updateBegin();
    var w = target !== null ? target.width : device.width;
    var h = target !== null ? target.height : device.height;
    var x = 0;
    var y = 0;
    device.setViewport(x, y, w, h);
    device.setScissor(x, y, w, h);
    var oldDepthTest = device.getDepthTest();
    var oldDepthWrite = device.getDepthWrite();
    device.setDepthTest(false);
    device.setDepthWrite(false);
    device.setVertexBuffer(_postEffectQuadVB, 0);
    device.setShader(shader);
    device.draw({type:pc.PRIMITIVE_TRISTRIP, base:0, count:4, indexed:false});
    device.setDepthTest(oldDepthTest);
    device.setDepthWrite(oldDepthWrite);
    device.updateEnd()
  }
  return{drawQuadWithShader:drawQuadWithShader}
}());
pc.extend(pc, function() {
  function fixChrome() {
    var endTime = Date.now() + 10;
    while(Date.now() < endTime) {
    }
  }
  function syncToCpu(device, targ, face) {
    var tex = targ._colorBuffer;
    if(tex.format != pc.PIXELFORMAT_R8_G8_B8_A8) {
      return
    }
    var pixels = new Uint8Array(tex.width * tex.height * 4);
    var gl = device.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targ._glFrameBuffer);
    gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    if(!tex._levels) {
      tex._levels = []
    }
    if(!tex._levels[0]) {
      tex._levels[0] = []
    }
    tex._levels[0][face] = pixels
  }
  function prefilterCubemap(options) {
    var device = options.device;
    var sourceCubemap = options.sourceCubemap;
    var method = options.method;
    var samples = options.samples;
    var cpuSync = options.cpuSync;
    var chromeFix = options.chromeFix;
    var chunks = pc.shaderChunks;
    var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.rgbmPS + chunks.prefilterCubemapPS.replace(/\$METHOD/g, method === 0 ? "cos" : "phong").replace(/\$NUMSAMPLES/g, samples), "prefilter" + method + "" + samples);
    var shader2 = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.outputCubemapPS);
    var constantTexSource = device.scope.resolve("source");
    var constantParams = device.scope.resolve("params");
    var params = new pc.Vec4;
    var size = sourceCubemap.width;
    var rgbmSource = sourceCubemap.rgbm;
    var format = sourceCubemap.format;
    var cmapsList = [[], options.filteredFixed, options.filteredRGBM, options.filteredFixedRGBM];
    var gloss = method === 0 ? [0.9, 0.85, 0.7, 0.4, 0.25] : [512, 128, 32, 8, 2];
    var mipSize = [64, 32, 16, 8, 4];
    var mips = 5;
    var targ;
    var i, face, pass;
    var rgbFormat = format === pc.PIXELFORMAT_R8_G8_B8;
    if(rgbFormat && cpuSync) {
      format = pc.PIXELFORMAT_R8_G8_B8_A8;
      var nextCubemap = new pc.gfx.Texture(device, {cubemap:true, rgbm:rgbmSource, format:format, width:size, height:size, autoMipmap:false});
      nextCubemap.minFilter = pc.FILTER_LINEAR;
      nextCubemap.magFilter = pc.FILTER_LINEAR;
      nextCubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
      nextCubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
      for(face = 0;face < 6;face++) {
        targ = new pc.RenderTarget(device, nextCubemap, {face:face, depth:false});
        params.x = face;
        constantTexSource.setValue(sourceCubemap);
        constantParams.setValue(params.data);
        if(chromeFix) {
          fixChrome()
        }
        pc.drawQuadWithShader(device, targ, shader2);
        syncToCpu(device, targ, face)
      }
      sourceCubemap = nextCubemap
    }
    if(size > 128) {
      var log128 = Math.round(Math.log2(128));
      var logSize = Math.round(Math.log2(size));
      var steps = logSize - log128;
      var nextCubemap;
      for(i = 0;i < steps;i++) {
        size = sourceCubemap.width * 0.5;
        var sampleGloss = method === 0 ? 1 : Math.pow(2, Math.round(Math.log2(gloss[0]) + (steps - i) * 2));
        nextCubemap = new pc.gfx.Texture(device, {cubemap:true, rgbm:rgbmSource, format:format, width:size, height:size, autoMipmap:false});
        nextCubemap.minFilter = pc.FILTER_LINEAR;
        nextCubemap.magFilter = pc.FILTER_LINEAR;
        nextCubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        nextCubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        for(face = 0;face < 6;face++) {
          targ = new pc.RenderTarget(device, nextCubemap, {face:face, depth:false});
          params.x = face;
          params.y = sampleGloss;
          params.z = size;
          params.w = 0;
          constantTexSource.setValue(sourceCubemap);
          constantParams.setValue(params.data);
          if(chromeFix) {
            fixChrome()
          }
          pc.drawQuadWithShader(device, targ, shader2);
          if(i === steps - 1 && cpuSync) {
            syncToCpu(device, targ, face)
          }
        }
        sourceCubemap = nextCubemap
      }
    }
    options.sourceCubemap = sourceCubemap;
    var unblurredGloss = method === 0 ? 1 : 2048;
    var startPass = method === 0 ? 0 : -1;
    cmapsList[startPass] = [];
    for(i = 0;i < mips;i++) {
      for(pass = startPass;pass < cmapsList.length;pass++) {
        if(cmapsList[pass] != null) {
          cmapsList[pass][i] = new pc.gfx.Texture(device, {cubemap:true, rgbm:pass < 2 ? rgbmSource : true, format:pass < 2 ? format : pc.PIXELFORMAT_R8_G8_B8_A8, fixCubemapSeams:pass === 1 || pass === 3, width:mipSize[i], height:mipSize[i], autoMipmap:false});
          cmapsList[pass][i].minFilter = pc.FILTER_LINEAR;
          cmapsList[pass][i].magFilter = pc.FILTER_LINEAR;
          cmapsList[pass][i].addressU = pc.ADDRESS_CLAMP_TO_EDGE;
          cmapsList[pass][i].addressV = pc.ADDRESS_CLAMP_TO_EDGE
        }
      }
    }
    for(pass = startPass;pass < cmapsList.length;pass++) {
      if(cmapsList[pass] != null) {
        if(pass > 1 && rgbmSource) {
          cmapsList[pass] = cmapsList[pass - 2];
          continue
        }
        for(i = 0;i < mips;i++) {
          for(face = 0;face < 6;face++) {
            targ = new pc.RenderTarget(device, cmapsList[pass][i], {face:face, depth:false});
            params.x = face;
            params.y = pass < 0 ? unblurredGloss : gloss[i];
            params.z = mipSize[i];
            params.w = pass;
            constantTexSource.setValue(i === 0 ? sourceCubemap : method === 0 ? cmapsList[0][i - 1] : cmapsList[-1][i - 1]);
            constantParams.setValue(params.data);
            if(chromeFix) {
              fixChrome()
            }
            pc.drawQuadWithShader(device, targ, shader);
            if(cpuSync) {
              syncToCpu(device, targ, face)
            }
          }
        }
      }
    }
    options.filtered = cmapsList[0];
    if(cpuSync && options.singleFilteredFixed) {
      var mips = [sourceCubemap, options.filteredFixed[0], options.filteredFixed[1], options.filteredFixed[2], options.filteredFixed[3], options.filteredFixed[4]];
      var cubemap = new pc.gfx.Texture(device, {cubemap:true, rgbm:rgbmSource, fixCubemapSeams:true, format:format, width:128, height:128, autoMipmap:false});
      for(i = 0;i < 6;i++) {
        cubemap._levels[i] = mips[i]._levels[0]
      }
      cubemap.upload();
      cubemap.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
      cubemap.magFilter = pc.FILTER_LINEAR;
      cubemap._prefilteredMips = true;
      options.singleFilteredFixed = cubemap
    }
  }
  return{prefilterCubemap:prefilterCubemap}
}());
pc.shaderChunks.ambientConstantPS = "\nvoid addAmbient(inout psInternalData data) {\n    data.diffuseLight = light_globalAmbient;\n}\n";
pc.shaderChunks.ambientPrefilteredCubePS = "void addAmbient(inout psInternalData data) {\n    vec3 fixedReflDir = fixSeamsStatic(data.normalW, 1.0 - 1.0 / 4.0);\n    data.diffuseLight = $DECODE(textureCube(texture_prefilteredCubeMap4, fixedReflDir)).rgb;\n}\n\n";
pc.shaderChunks.ambientPrefilteredCubeLodPS = "void addAmbient(inout psInternalData data) {\n    vec3 fixedReflDir = fixSeamsStatic(data.normalW, 1.0 - 1.0 / 4.0);\n    data.diffuseLight = $DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, 5.0) ).rgb;\n}\n\n";
pc.shaderChunks.aoBakedPS = "uniform sampler2D texture_aoMap;\nvoid applyAO(inout psInternalData data) {\n    data.ao = texture2D(texture_aoMap, $UV).$CH;\n    data.diffuseLight *= data.ao;\n}\n\nvoid occludeSpecular(inout psInternalData data) {\n    // fake specular occlusion from AO\n    float specPow = exp2(data.glossiness * 4.0); // 0 - 128\n    specPow = max(specPow, 0.0001);\n    float specOcc = saturate(pow(data.ao * (data.glossiness + 1.0), specPow));\n\n    data.specularLight *= specOcc;\n    data.reflection *= specOcc;\n}\n\n";
pc.shaderChunks.basePS = "\n// Compiler should remove unneeded stuff\nuniform vec3 view_position;\n\nuniform vec3 light_globalAmbient;\n\nvarying vec3 vPositionW;\nvarying vec3 vNormalW;\nvarying vec3 vTangentW;\nvarying vec3 vBinormalW;\nvarying vec2 vUv0;\nvarying vec2 vUv1;\nvarying vec4 vVertexColor;\nvarying vec3 vNormalV;\n\nstruct psInternalData {\n    vec3 albedo;\n    vec3 specularity;\n    float glossiness;\n    vec3 emission;\n    vec3 normalW;\n    mat3 TBN;\n    vec3 viewDirW;\n    vec3 reflDirW;\n    vec3 diffuseLight;\n    vec3 specularLight;\n    vec4 reflection;\n    float alpha;\n    vec3 lightDirNormW;\n    vec3 lightDirW;\n    vec3 lightPosW;\n    float atten;\n    vec3 shadowCoord;\n    vec2 uvOffset;\n    vec3 normalMap;\n    float ao;\n};\n\nvoid getViewDir(inout psInternalData data) {\n    data.viewDirW = normalize(view_position - vPositionW);\n}\n\nvoid getReflDir(inout psInternalData data) {\n    data.reflDirW = normalize(-reflect(data.viewDirW, data.normalW));\n}\n\nvoid getLightDirPoint(inout psInternalData data, vec3 lightPosW) {\n    data.lightDirW = vPositionW - lightPosW;\n    data.lightDirNormW = normalize(data.lightDirW);\n    data.lightPosW = lightPosW;\n}\n\nfloat getFalloffLinear(inout psInternalData data, float lightRadius) {\n    float d = length(data.lightDirW);\n    return max(((lightRadius - d) / lightRadius), 0.0);\n}\n\nfloat square(float x) {\n    return x*x;\n}\n\nfloat saturate(float x) {\n    return clamp(x, 0.0, 1.0);\n}\n\nfloat getFalloffInvSquared(inout psInternalData data, float lightRadius) {\n    float sqrDist = dot(data.lightDirW, data.lightDirW);\n    float falloff = 1.0 / (sqrDist + 1.0);\n    float invRadius = 1.0 / lightRadius;\n\n    falloff *= 16.0;\n    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );\n\n    return falloff;\n}\n\nfloat getSpotEffect(inout psInternalData data, vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle) {\n    float cosAngle = dot(data.lightDirNormW, lightSpotDirW);\n    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);\n}\n\n";
pc.shaderChunks.baseVS = "\n// Compiler should remove unneeded stuff\nattribute vec3 vertex_position;\nattribute vec3 vertex_normal;\nattribute vec4 vertex_tangent;\nattribute vec2 vertex_texCoord0;\nattribute vec2 vertex_texCoord1;\nattribute vec4 vertex_color;\n\nuniform mat4 matrix_viewProjection;\nuniform mat4 matrix_model;\nuniform mat3 matrix_normal;\n\nvarying vec3 vPositionW;\nvarying vec3 vNormalW;\nvarying vec3 vTangentW;\nvarying vec3 vBinormalW;\nvarying vec2 vUv0;\nvarying vec2 vUv1;\nvarying vec4 vVertexColor;\nvarying vec3 vNormalV;\n\nstruct vsInternalData {\n    vec3 positionW;\n    mat4 modelMatrix;\n    mat3 normalMatrix;\n};\n\n";
pc.shaderChunks.combineDiffusePS = "vec3 combineColor(inout psInternalData data) {\n    return data.albedo * data.diffuseLight;\n}\n\n";
pc.shaderChunks.combineDiffuseSpecularPS = "vec3 combineColor(inout psInternalData data) {\n    return mix(data.albedo * data.diffuseLight, data.specularLight + data.reflection.rgb * data.reflection.a, data.specularity);\n}\n\n";
pc.shaderChunks.combineDiffuseSpecularNoConservePS = "vec3 combineColor(inout psInternalData data) {\n    return data.albedo * data.diffuseLight + (data.specularLight + data.reflection.rgb * data.reflection.a) * data.specularity;\n}\n\n";
pc.shaderChunks.combineDiffuseSpecularNoReflPS = "vec3 combineColor(inout psInternalData data) {\n    return data.albedo * data.diffuseLight + data.specularLight * data.specularity;\n}\n\n";
pc.shaderChunks.combineDiffuseSpecularNoReflSeparateAmbientPS = "uniform vec3 material_ambient;\nvec3 combineColor(inout psInternalData data) {\n    return (data.diffuseLight - light_globalAmbient) * data.albedo + data.specularLight * data.specularity + material_ambient * light_globalAmbient;\n}\n\n";
pc.shaderChunks.combineDiffuseSpecularOldPS = "vec3 combineColor(inout psInternalData data) {\n    return mix(data.albedo * data.diffuseLight + data.specularLight * data.specularity, data.reflection.rgb, data.reflection.a);\n}\n\n";
pc.shaderChunks.diffuseConstPS = "uniform vec3 material_diffuse;\nvoid getAlbedo(inout psInternalData data) {\n    data.albedo = material_diffuse.rgb;\n}\n\n";
pc.shaderChunks.diffuseTexPS = "uniform sampler2D texture_diffuseMap;\nvoid getAlbedo(inout psInternalData data) {\n    data.albedo = texture2DSRGB(texture_diffuseMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.diffuseTexConstPS = "uniform sampler2D texture_diffuseMap;\nuniform vec3 material_diffuse;\nvoid getAlbedo(inout psInternalData data) {\n    data.albedo = texture2DSRGB(texture_diffuseMap, $UV).$CH * material_diffuse;\n}\n\n";
pc.shaderChunks.emissiveConstPS = "uniform vec3 material_emissive;\nvec3 getEmission(inout psInternalData data) {\n    return material_emissive;\n}\n\n";
pc.shaderChunks.emissiveTexPS = "uniform sampler2D texture_emissiveMap;\nvec3 getEmission(inout psInternalData data) {\n    return texture2D(texture_emissiveMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.emissiveTexConstPS = "uniform sampler2D texture_emissiveMap;\nuniform vec3 material_emissive;\nvec3 getEmission(inout psInternalData data) {\n    return texture2D(texture_emissiveMap, $UV).$CH * material_emissive;\n}\n\n";
pc.shaderChunks.endPS = "   gl_FragColor.rgb = combineColor(data);\n   gl_FragColor.rgb += getEmission(data);\n   gl_FragColor.rgb = addFog(data, gl_FragColor.rgb);\n   gl_FragColor.rgb = toneMap(gl_FragColor.rgb);\n   gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);\n   gl_FragColor.a = data.alpha;\n";
pc.shaderChunks.fixCubemapSeamsNonePS = "vec3 fixSeams(vec3 vec, float mipmapIndex) {\n    return vec;\n}\n\nvec3 fixSeams(vec3 vec) {\n    return vec;\n}\n\nvec3 fixSeamsStatic(vec3 vec, float invRecMipSize) {\n    return vec;\n}\n";
pc.shaderChunks.fixCubemapSeamsStretchPS = "uniform float material_cubemapSize;\nvec3 fixSeams(vec3 vec, float mipmapIndex) {\n    float scale = 1.0 - exp2(mipmapIndex) / material_cubemapSize;\n    float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));\n    if (abs(vec.x) != M) vec.x *= scale;\n    if (abs(vec.y) != M) vec.y *= scale;\n    if (abs(vec.z) != M) vec.z *= scale;\n    return vec;\n}\n\nvec3 fixSeams(vec3 vec) {\n    float scale = 1.0 - 1.0 / material_cubemapSize;\n    float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));\n    if (abs(vec.x) != M) vec.x *= scale;\n    if (abs(vec.y) != M) vec.y *= scale;\n    if (abs(vec.z) != M) vec.z *= scale;\n    return vec;\n}\n\nvec3 fixSeamsStatic(vec3 vec, float invRecMipSize) {\n    float scale = invRecMipSize;\n    float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));\n    if (abs(vec.x) != M) vec.x *= scale;\n    if (abs(vec.y) != M) vec.y *= scale;\n    if (abs(vec.z) != M) vec.z *= scale;\n    return vec;\n}\n\n";
pc.shaderChunks.fogExpPS = "uniform vec3 fog_color;\nuniform float fog_density;\nvec3 addFog(inout psInternalData data, vec3 color) {\n    float depth = gl_FragCoord.z / gl_FragCoord.w;\n    float fogFactor = exp(-depth * fog_density);\n    fogFactor = clamp(fogFactor, 0.0, 1.0);\n    return mix(fog_color, color, fogFactor);\n}\n";
pc.shaderChunks.fogExp2PS = "uniform vec3 fog_color;\nuniform float fog_density;\nvec3 addFog(inout psInternalData data, vec3 color) {\n    float depth = gl_FragCoord.z / gl_FragCoord.w;\n    float fogFactor = exp(-depth * depth * fog_density * fog_density);\n    fogFactor = clamp(fogFactor, 0.0, 1.0);\n    return mix(fog_color, color, fogFactor);\n}\n";
pc.shaderChunks.fogLinearPS = "uniform vec3 fog_color;\nuniform float fog_start;\nuniform float fog_end;\nvec3 addFog(inout psInternalData data, vec3 color) {\n    float depth = gl_FragCoord.z / gl_FragCoord.w;\n    float fogFactor = (fog_end - depth) / (fog_end - fog_start);\n    fogFactor = clamp(fogFactor, 0.0, 1.0);\n    fogFactor = gammaCorrectInput(fogFactor);\n    return mix(fog_color, color, fogFactor);\n}\n";
pc.shaderChunks.fogNonePS = "vec3 addFog(inout psInternalData data, vec3 color) {\n    return color;\n}\n\n\n";
pc.shaderChunks.fresnelComplexPS = "// More physically-based Fresnel\nuniform float material_fresnelFactor; // should be IOR\nvoid getFresnel(inout psInternalData data) {\n    float cosThetaI = max(dot(data.normalW, data.viewDirW), 0.0);\n    float n = material_fresnelFactor;\n\n    float cosThetaT = sqrt(max(0.0, 1.0 - (1.0 - cosThetaI * cosThetaI) / (n * n)));\n    float nCosThetaT = n * cosThetaT;\n    float nCosThetaI = n * cosThetaI;\n\n    float rS = abs((cosThetaI - nCosThetaT) / (cosThetaI + nCosThetaT));\n    float rP = abs((cosThetaT - nCosThetaI) / (cosThetaT + nCosThetaI));\n    rS *= rS;\n    rP *= rP;\n\n    data.specularity *= (rS + rP) / 2.0;\n}\n\n";
pc.shaderChunks.fresnelSchlickPS = "// Schlick's approximation\nuniform float material_fresnelFactor; // unused\nvoid getFresnel(inout psInternalData data) {\n    float fresnel = 1.0 - max(dot(data.normalW, data.viewDirW), 0.0);\n    float fresnel2 = fresnel * fresnel;\n    fresnel *= fresnel2 * fresnel2;\n    fresnel *= data.glossiness * data.glossiness;\n    data.specularity = data.specularity + (1.0 - data.specularity) * fresnel;\n}\n\n";
pc.shaderChunks.fresnelSimplePS = "// Easily tweakable but not very correct Fresnel\nuniform float material_fresnelFactor;\nvoid getFresnel(inout psInternalData data) {\n    float fresnel = 1.0 - max(dot(data.normalW, data.viewDirW), 0.0);\n    data.specularity *= pow(fresnel, material_fresnelFactor);\n}\n\n";
pc.shaderChunks.fullscreenQuadVS = "attribute vec2 aPosition;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    gl_Position = vec4(aPosition, 0.5, 1.0);\n    vUv0 = aPosition.xy*0.5+0.5;\n}\n\n";
pc.shaderChunks.gamma1_0PS = "vec4 texture2DSRGB(sampler2D tex, vec2 uv) {\n    return texture2D(tex, uv);\n}\n\nvec4 textureCubeSRGB(samplerCube tex, vec3 uvw) {\n    return textureCube(tex, uvw);\n}\n\nvec3 gammaCorrectOutput(vec3 color) {\n    return color;\n}\n\nvec3 gammaCorrectInput(vec3 color) {\n    return color;\n}\n\nfloat gammaCorrectInput(float color) {\n    return color;\n}\n\nvec4 gammaCorrectInput(vec4 color) {\n    return color;\n}\n\n";
pc.shaderChunks.gamma2_2PS = "vec3 gammaCorrectInput(vec3 color) {\n    return pow(color, vec3(2.2));\n}\n\nfloat gammaCorrectInput(float color) {\n    return pow(color, 2.2);\n}\n\nvec4 gammaCorrectInput(vec4 color) {\n    return vec4(pow(color.rgb, vec3(2.2)), color.a);\n}\n\nvec4 texture2DSRGB(sampler2D tex, vec2 uv) {\n    vec4 rgba = texture2D(tex, uv);\n    rgba.rgb = gammaCorrectInput(rgba.rgb);\n    return rgba;\n}\n\nvec4 textureCubeSRGB(samplerCube tex, vec3 uvw) {\n    vec4 rgba = textureCube(tex, uvw);\n    rgba.rgb = gammaCorrectInput(rgba.rgb);\n    return rgba;\n}\n\nvec3 gammaCorrectOutput(vec3 color) {\n    return pow(color, vec3(0.45));\n}\n\n";
pc.shaderChunks.glossConstPS = "uniform float material_shininess;\nvoid getGlossiness(inout psInternalData data) {\n    data.glossiness = material_shininess;\n}\n\n";
pc.shaderChunks.glossTexPS = "uniform sampler2D texture_glossMap;\nvoid getGlossiness(inout psInternalData data) {\n    data.glossiness = texture2D(texture_glossMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.glossTexConstPS = "uniform sampler2D texture_glossMap;\nuniform float material_shininess;\nvoid getGlossiness(inout psInternalData data) {\n    data.glossiness = material_shininess * texture2D(texture_glossMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.lightDiffuseLambertPS = "float getLightDiffuse(inout psInternalData data) {\n    return max(dot(data.normalW, -data.lightDirNormW), 0.0);\n}\n\n";
pc.shaderChunks.lightmapSinglePS = "uniform sampler2D texture_lightMap;\nvoid addAmbient(inout psInternalData data) {\n    data.diffuseLight = texture2D(texture_lightMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.lightSpecularBlinnPS = "// Energy-conserving (hopefully) Blinn-Phong\nfloat getLightSpecular(inout psInternalData data) {\n    vec3 h = normalize( -data.lightDirNormW + data.viewDirW );\n    float nh = max( dot( h, data.normalW ), 0.0 );\n\n    float specPow = exp2(data.glossiness * 11.0); // glossiness is linear, power is not; 0 - 2048\n    specPow = antiAliasGlossiness(data, specPow);\n\n    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little\n    specPow = max(specPow, 0.0001);\n\n    return pow(nh, specPow) * (specPow + 2.0) / 8.0;\n}\n\n";
pc.shaderChunks.lightSpecularPhongPS = "float getLightSpecular(inout psInternalData data) {\n    float specPow = data.glossiness;\n\n    specPow = antiAliasGlossiness(data, specPow);\n\n    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little\n    return pow(max(dot(data.reflDirW, -data.lightDirNormW), 0.0), specPow + 0.0001);\n}\n\n";
pc.shaderChunks.normalVS = "vec3 getNormal(inout vsInternalData data) {\n    data.normalMatrix = matrix_normal;\n    return normalize(data.normalMatrix * vertex_normal);\n}\n\n";
pc.shaderChunks.normalMapPS = "uniform sampler2D texture_normalMap;\nuniform float material_bumpMapFactor;\nvoid getNormal(inout psInternalData data) {\n    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));\n    data.normalMap = normalMap;\n    data.normalW = data.TBN * normalMap;\n}\n\n";
pc.shaderChunks.normalMapFloatPS = "uniform sampler2D texture_normalMap;\nuniform float material_bumpMapFactor;\nvoid getNormal(inout psInternalData data) {\n    vec3 normalMap = unpackNormal(texture2D(texture_normalMap, $UV));\n    data.normalMap = normalMap;\n    normalMap = normalize(mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpMapFactor));\n    data.normalW = data.TBN * normalMap;\n}\n\n";
pc.shaderChunks.normalSkinnedVS = "vec3 getNormal(inout vsInternalData data) {\n    data.normalMatrix = mat3(data.modelMatrix[0].xyz, data.modelMatrix[1].xyz, data.modelMatrix[2].xyz);\n    return normalize(data.normalMatrix * vertex_normal);\n}\n\n";
pc.shaderChunks.normalVertexPS = "void getNormal(inout psInternalData data) {\n    data.normalW = normalize(vNormalW);\n}\n\n";
pc.shaderChunks.normalXYPS = "vec3 unpackNormal(vec4 nmap) {\n    vec3 normal;\n    normal.xy = nmap.wy * 2.0 - 1.0;\n    normal.z = sqrt(1.0 - saturate(dot(normal.xy, normal.xy)));\n    return normal;\n}\n\n";
pc.shaderChunks.normalXYZPS = "vec3 unpackNormal(vec4 nmap) {\n    return nmap.xyz * 2.0 - 1.0;\n}\n\n";
pc.shaderChunks.opacityConstPS = "uniform float material_opacity;\nvoid getOpacity(inout psInternalData data) {\n    data.alpha = material_opacity;\n}\n\n";
pc.shaderChunks.opacityTexPS = "uniform sampler2D texture_opacityMap;\nvoid getOpacity(inout psInternalData data) {\n    data.alpha = texture2D(texture_opacityMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.opacityTexConstPS = "uniform sampler2D texture_opacityMap;\nuniform float material_opacity;\nvoid getOpacity(inout psInternalData data) {\n    data.alpha = texture2D(texture_opacityMap, $UV).$CH * material_opacity;\n}\n\n";
pc.shaderChunks.outputCubemapPS = "varying vec2 vUv0;\n\nuniform samplerCube source;\nuniform vec4 params;\n\nvoid main(void) {\n\n    vec2 st = vUv0 * 2.0 - 1.0;\n    float face = params.x;\n\n    vec3 vec;\n    if (face==0.0) {\n        vec = vec3(1, -st.y, -st.x);\n    } else if (face==1.0) {\n        vec = vec3(-1, -st.y, st.x);\n    } else if (face==2.0) {\n        vec = vec3(st.x, 1, st.y);\n    } else if (face==3.0) {\n        vec = vec3(st.x, -1, -st.y);\n    } else if (face==4.0) {\n        vec = vec3(st.x, -st.y, 1);\n    } else {\n        vec = vec3(-st.x, -st.y, -1);\n    }\n\n    gl_FragColor = textureCube(source, vec);\n}\n\n";
pc.shaderChunks.parallaxPS = "uniform sampler2D texture_heightMap;\nuniform float material_heightMapFactor;\nvoid getParallax(inout psInternalData data) {\n    float parallaxScale = material_heightMapFactor;\n    const float parallaxBias = 0.01;\n\n    float height = texture2D(texture_heightMap, $UV).r * parallaxScale - parallaxBias;\n    vec3 viewDirT = data.viewDirW * data.TBN;\n\n    data.uvOffset = min(height * viewDirT.xy, vec2(parallaxBias));\n}\n\n";
pc.shaderChunks.particlePS = "varying vec4 texCoordsAlphaLife;\n\nuniform sampler2D colorMap;\nuniform sampler2D internalTex3;\nuniform float graphSampleSize;\nuniform float graphNumSamples;\nuniform vec4 screenSize;\nuniform float camera_far;\nuniform float softening;\nuniform float colorMult;\n\nfloat saturate(float x) {\n    return clamp(x, 0.0, 1.0);\n}\n\nfloat unpackFloat(vec4 rgbaDepth) {\n    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);\n    float depth = dot(rgbaDepth, bitShift);\n    return depth;\n}\n\nvoid main(void) {\n    psInternalData data;\n    vec4 tex         = texture2DSRGB(colorMap, texCoordsAlphaLife.xy);\n    vec4 ramp     = texture2DSRGB(internalTex3, vec2(texCoordsAlphaLife.w, 0.0));\n    ramp.rgb *= colorMult;\n\n    ramp.a += texCoordsAlphaLife.z;\n\n    vec3 rgb =     tex.rgb * ramp.rgb;\n    float a =         tex.a * ramp.a;\n\n";
pc.shaderChunks.particleVS = "attribute vec4 particle_vertexData; // XYZ = particle position, W = particle ID + random factor\n\nuniform mat4 matrix_viewProjection;\nuniform mat4 matrix_model;\nuniform mat3 matrix_normal;\nuniform mat4 matrix_viewInverse;\nuniform mat4 matrix_view;\n\nuniform float numParticles, numParticlesPot;\nuniform float graphSampleSize;\nuniform float graphNumSamples;\nuniform float stretch;\nuniform vec3 wrapBounds;\nuniform vec3 emitterScale;\nuniform float rate, rateDiv, lifetime, deltaRandomnessStatic, scaleDivMult, alphaDivMult, seed;\nuniform sampler2D particleTexOUT, particleTexIN;\nuniform sampler2D internalTex0;\nuniform sampler2D internalTex1;\nuniform sampler2D internalTex2;\n\nvarying vec4 texCoordsAlphaLife;\n\nvec3 unpack3NFloats(float src) {\n    float r = fract(src);\n    float g = fract(src * 256.0);\n    float b = fract(src * 65536.0);\n    return vec3(r, g, b);\n}\n\nfloat saturate(float x) {\n    return clamp(x, 0.0, 1.0);\n}\n\nvec4 tex1Dlod_lerp(sampler2D tex, vec2 tc) {\n    return mix( texture2D(tex,tc), texture2D(tex,tc + graphSampleSize), fract(tc.x*graphNumSamples) );\n}\n\nvec4 tex1Dlod_lerp(sampler2D tex, vec2 tc, out vec3 w) {\n    vec4 a = texture2D(tex,tc);\n    vec4 b = texture2D(tex,tc + graphSampleSize);\n    float c = fract(tc.x*graphNumSamples);\n\n    vec3 unpackedA = unpack3NFloats(a.w);\n    vec3 unpackedB = unpack3NFloats(b.w);\n    w = mix(unpackedA, unpackedB, c);\n\n    return mix(a, b, c);\n}\n\n\nvec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix) {\n    float c = cos(pRotation);\n    float s = sin(pRotation);\n\n    mat2 m = mat2(c, -s, s, c);\n    rotMatrix = m;\n\n    return m * quadXY;\n}\n\nvec3 billboard(vec3 InstanceCoords, vec2 quadXY, out mat3 localMat) {\n    vec3 viewUp = matrix_viewInverse[1].xyz;\n    vec3 posCam = matrix_viewInverse[3].xyz;\n\n    mat3 billMat;\n    billMat[2] = normalize(InstanceCoords - posCam);\n    billMat[0] = normalize(cross(viewUp, billMat[2]));\n    billMat[1] = -viewUp;\n    vec3 pos = billMat * vec3(quadXY, 0);\n\n    localMat = billMat;\n\n    return pos;\n}\n\nvoid main(void) {\n    vec3 meshLocalPos = particle_vertexData.xyz;\n    float id = floor(particle_vertexData.w);\n\n    float rndFactor = fract(sin(id + 1.0 + seed));\n    vec3 rndFactor3 = vec3(rndFactor, fract(rndFactor*10.0), fract(rndFactor*100.0));\n\n    vec4 particleTex = texture2D(particleTexOUT, vec2(id / numParticlesPot, 0.125));\n    vec3 pos = particleTex.xyz;\n    float angle = particleTex.w;\n\n    vec4 particleTex2 = texture2D(particleTexOUT, vec2(id / numParticlesPot, 0.375));\n    vec3 particleVelocity = particleTex2.xyz;\n    vec2 velocityV = normalize((mat3(matrix_view) * particleVelocity).xy); // should be removed by compiler if align/stretch is not used\n    float life = particleTex2.w;\n\n    float particleLifetime = lifetime;\n\n    if (life <= 0.0 || life > particleLifetime) meshLocalPos = vec3(0.0);\n    vec2 quadXY = meshLocalPos.xy;\n    float nlife = clamp(life / particleLifetime, 0.0, 1.0);\n\n    vec3 paramDiv;\n    vec4 params = tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);\n    float scale = params.y;\n    float scaleDiv = paramDiv.x;\n    float alphaDiv = paramDiv.z;\n\n    scale += (scaleDiv * 2.0 - 1.0) * scaleDivMult * fract(rndFactor*10000.0);\n\n    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5,    (alphaDiv * 2.0 - 1.0) * alphaDivMult * fract(rndFactor*1000.0),    nlife);\n\n    vec3 particlePos = pos;\n    vec3 particlePosMoved = vec3(0.0);\n\n    mat2 rotMatrix;\n    mat3 localMat;\n\n\n";
pc.shaderChunks.particle_billboardVS = "\n    quadXY = rotate(quadXY, angle, rotMatrix);\n    vec3 localPos = billboard(particlePos, quadXY, localMat);\n\n";
pc.shaderChunks.particle_blendAddPS = "\n    rgb *= gammaCorrectInput(a);\n    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;\n\n";
pc.shaderChunks.particle_blendMultiplyPS = "\n    rgb = mix(vec3(1.0), rgb, vec3(a));\n    if (rgb.r + rgb.g + rgb.b > 2.99) discard;\n\n";
pc.shaderChunks.particle_blendNormalPS = "\n    if (a < 0.01) discard;\n";
pc.shaderChunks.particle_cpuVS = "attribute vec4 particle_vertexData;     // XYZ = world pos, W = life\nattribute vec4 particle_vertexData2;     // X = angle, Y = scale, Z = alpha, W = velocity.x\nattribute vec4 particle_vertexData3;     // XYZ = particle local pos, W = velocity.y\nattribute vec2 particle_vertexData4;     // X = velocity.z, W = particle ID\n\nuniform mat4 matrix_viewProjection;\nuniform mat4 matrix_model;\nuniform mat4 matrix_view;\nuniform mat3 matrix_normal;\nuniform mat4 matrix_viewInverse;\n\nuniform float numParticles;\nuniform float lifetime;\nuniform float stretch;\n//uniform float graphSampleSize;\n//uniform float graphNumSamples;\nuniform vec3 wrapBounds, emitterScale;\nuniform sampler2D texLifeAndSourcePosOUT;\nuniform sampler2D internalTex0;\nuniform sampler2D internalTex1;\nuniform sampler2D internalTex2;\n\nvarying vec4 texCoordsAlphaLife;\n\n\nvec2 rotate(vec2 quadXY, float pRotation, out mat2 rotMatrix)\n{\n    float c = cos(pRotation);\n    float s = sin(pRotation);\n    //vec4 rotationMatrix = vec4(c, -s, s, c);\n\n    mat2 m = mat2(c, -s, s, c);\n    rotMatrix = m;\n\n    return m * quadXY;\n}\n\nvec3 billboard(vec3 InstanceCoords, vec2 quadXY, out mat3 localMat)\n{\n    vec3 viewUp = matrix_viewInverse[1].xyz;\n    vec3 posCam = matrix_viewInverse[3].xyz;\n\n    mat3 billMat;\n    billMat[2] = normalize(InstanceCoords - posCam);\n    billMat[0] = normalize(cross(viewUp, billMat[2]));\n    billMat[1] = -viewUp;\n    vec3 pos = billMat * vec3(quadXY, 0);\n\n    localMat = billMat;\n\n    return pos;\n}\n\n\nvoid main(void)\n{\n    vec3 particlePos = particle_vertexData.xyz;\n    vec3 pos = particlePos;\n    vec3 vertPos = particle_vertexData3.xyz;\n    vec3 particleVelocity = vec3(particle_vertexData2.w, particle_vertexData3.w, particle_vertexData4.x);\n    vec2 velocityV = normalize((mat3(matrix_view) * particleVelocity).xy); // should be removed by compiler if align/stretch is not used\n\n    vec2 quadXY = vertPos.xy;\n    texCoordsAlphaLife = vec4(quadXY * -0.5 + 0.5, particle_vertexData2.z, particle_vertexData.w);\n\n    mat2 rotMatrix;\n    mat3 localMat;\n\n    float angle = particle_vertexData2.x;\n    vec3 particlePosMoved = vec3(0.0);\n    vec3 meshLocalPos = particle_vertexData3.xyz;\n\n";
pc.shaderChunks.particle_cpu_endVS = "\n    localPos *= particle_vertexData2.y * emitterScale;\n    localPos += particlePos;\n\n    gl_Position = matrix_viewProjection * vec4(localPos, 1.0);\n}\n\n";
pc.shaderChunks.particle_endPS = "    rgb = addFog(data, rgb);\n    rgb = toneMap(rgb);\n    rgb = gammaCorrectOutput(rgb);\n    gl_FragColor = vec4(rgb, a);\n}\n";
pc.shaderChunks.particle_endVS = "\n    localPos *= scale * emitterScale;\n    localPos += particlePos;\n\n    gl_Position = matrix_viewProjection * vec4(localPos.xyz, 1.0);\n}\n";
pc.shaderChunks.particle_halflambertPS = "\n    vec3 negNormal = normal*0.5+0.5;\n    vec3 posNormal = -normal*0.5+0.5;\n    negNormal *= negNormal;\n    posNormal *= posNormal;\n\n\n";
pc.shaderChunks.particle_lambertPS = "\n    vec3 negNormal = max(normal, vec3(0.0));\n    vec3 posNormal = max(-normal, vec3(0.0));\n\n\n";
pc.shaderChunks.particle_lightingPS = "\n    vec3 light = negNormal.x*lightCube[0] + posNormal.x*lightCube[1] +\n                        negNormal.y*lightCube[2] + posNormal.y*lightCube[3] +\n                        negNormal.z*lightCube[4] + posNormal.z*lightCube[5];\n\n\n    rgb *= light;\n\n\n";
pc.shaderChunks.particle_meshVS = "\n    vec3 localPos = meshLocalPos;\n    localPos.xy = rotate(localPos.xy, angle, rotMatrix);\n    localPos.yz = rotate(localPos.yz, angle, rotMatrix);\n\n    billboard(particlePos, quadXY, localMat);\n\n\n";
pc.shaderChunks.particle_normalVS = "\n    Normal = normalize(localPos - localMat[2]);\n\n\n";
pc.shaderChunks.particle_normalMapPS = "\n    vec3 normalMap         = normalize( texture2D(normalMap, texCoordsAlphaLife.xy).xyz * 2.0 - 1.0 );\n    vec3 normal = ParticleMat * normalMap;\n\n\n\n\n";
pc.shaderChunks.particle_pointAlongVS = "    angle = atan(velocityV.x, velocityV.y); // not the fastest way, but easier to plug in; TODO: create rot matrix right from vectors\n\n";
pc.shaderChunks.particle_softPS = "\n    vec2 screenTC = gl_FragCoord.xy / screenSize.xy;\n    float depth = unpackFloat( texture2D(uDepthMap, screenTC) ) * camera_far;\n    float particleDepth = gl_FragCoord.z / gl_FragCoord.w;\n    float depthDiff = saturate(abs(particleDepth - depth) * softening);\n    a *= depthDiff;\n\n";
pc.shaderChunks.particle_stretchVS = "    vec3 moveDir = particleVelocity * stretch;\n    vec3 posPrev = pos - moveDir;\n    posPrev += particlePosMoved;\n\n    vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);\n\n    float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;\n\n    particlePos = mix(particlePos, posPrev, interpolation);\n\n";
pc.shaderChunks.particle_TBNVS = "\n    mat3 rot3 = mat3(rotMatrix[0][0], rotMatrix[0][1], 0.0,        rotMatrix[1][0], rotMatrix[1][1], 0.0,        0.0, 0.0, 1.0);\n    localMat[2] *= -1.0;\n    ParticleMat = localMat * rot3;\n\n\n\n\n";
pc.shaderChunks.particle_wrapVS = "\n    vec3 origParticlePos = particlePos;\n    particlePos -= matrix_model[3].xyz;\n    particlePos = mod(particlePos, wrapBounds) - wrapBounds * 0.5;\n    particlePos += matrix_model[3].xyz;\n    particlePosMoved = particlePos - origParticlePos;\n\n\n";
pc.shaderChunks.particleUpdaterAABBPS = "uniform mat3 spawnBounds;\nvec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {\n    return emitterPos + spawnBounds * (inBounds - vec3(0.5));\n}\n\nvoid addInitialVelocity(out vec3 localVelocity, vec3 inBounds) {\n    localVelocity -= vec3(0, 0, initialVelocity);\n}\n\n";
pc.shaderChunks.particleUpdaterEndPS = "\n    tex = vec4(outPosition, outRotation) * outMask0 +\n          vec4(outVelocity, life) * outMask1 +\n          texR * outMask2;\n\n    gl_FragColor = tex;\n}\n\n";
pc.shaderChunks.particleUpdaterInitPS = "varying vec2 vUv0;\n\nuniform sampler2D particleTexIN;\nuniform sampler2D internalTex0;\nuniform sampler2D internalTex1;\nuniform sampler2D internalTex2;\n\nuniform mat3 emitterMatrix;\nuniform vec3 emitterScale;\n\nuniform vec3 emitterPos, frameRandom, localVelocityDivMult, velocityDivMult;\nuniform float delta, rate, rateDiv, lifetime, numParticles, rotSpeedDivMult, seed;\nuniform float startAngle, startAngle2;\nuniform float initialVelocity;\n\nuniform float graphSampleSize;\nuniform float graphNumSamples;\n\n";
pc.shaderChunks.particleUpdaterOnStopPS = "    life = life < 0.0? particleLifetime + 1.0 : life;\n\n";
pc.shaderChunks.particleUpdaterRespawnPS = "    life = life > particleLifetime? -particleRate * gl_FragCoord.x : life;\n\n";
pc.shaderChunks.particleUpdaterSpherePS = "uniform float spawnBounds;\nvec3 calcSpawnPosition(vec3 inBounds, float rndFactor) {\n    float rnd4 = fract(rndFactor * 1000.0);\n    return emitterPos + normalize(inBounds.xyz - vec3(0.5)) * rnd4 * spawnBounds;\n}\n\nvoid addInitialVelocity(out vec3 localVelocity, vec3 inBounds) {\n    localVelocity += normalize(inBounds - vec3(0.5)) * initialVelocity;\n}\n\n";
pc.shaderChunks.particleUpdaterStartPS = "float saturate(float x) {\n    return clamp(x, 0.0, 1.0);\n}\n\nvec3 unpack3NFloats(float src) {\n    float r = fract(src);\n    float g = fract(src * 256.0);\n    float b = fract(src * 65536.0);\n    return vec3(r, g, b);\n}\n\nvec3 tex1Dlod_lerp(sampler2D tex, vec2 tc, out vec3 w) {\n    vec4 a = texture2D(tex, tc);\n    vec4 b = texture2D(tex, tc + graphSampleSize);\n    float c = fract(tc.x * graphNumSamples);\n\n    vec3 unpackedA = unpack3NFloats(a.w);\n    vec3 unpackedB = unpack3NFloats(b.w);\n    w = mix(unpackedA, unpackedB, c);\n\n    return mix(a.xyz, b.xyz, c);\n}\n\nvoid main(void)\n{\n    if (gl_FragCoord.x > numParticles) discard;\n    float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;\n    float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;\n    float outMask2 = (gl_FragCoord.y < 3.0 && gl_FragCoord.y >= 2.0)? 1.0 : 0.0;\n\n    vec4 tex = texture2D(particleTexIN, vec2(vUv0.x, 0.125));\n    vec4 tex2 = texture2D(particleTexIN, vec2(vUv0.x, 0.375));\n    vec4 texR = texture2D(particleTexIN, vec2(vUv0.x, 0.625));\n\n    vec4 rndFactor = texR;\n    float particleLifetime = lifetime;\n    float life = tex2.w + delta;\n    float particleRate = rate + rateDiv * rndFactor.x;\n\n        float nlife = clamp(life / particleLifetime, 0.0, 1.0);\n        vec3 localVelocityDiv;\n        vec3 velocityDiv;\n        vec3 paramDiv;\n        vec3 localVelocity = tex1Dlod_lerp(internalTex0, vec2(nlife, 0), localVelocityDiv);\n        vec3 velocity =      tex1Dlod_lerp(internalTex1, vec2(nlife, 0), velocityDiv);\n        vec3 params =        tex1Dlod_lerp(internalTex2, vec2(nlife, 0), paramDiv);\n        float rotSpeed = params.x;\n        float rotSpeedDiv = paramDiv.y;\n\n        localVelocity +=    (localVelocityDiv * vec3(2.0) - vec3(1.0)) * localVelocityDivMult * rndFactor.xyz;\n        velocity +=         (velocityDiv * vec3(2.0) - vec3(1.0)) * velocityDivMult * rndFactor.zxy;\n        rotSpeed +=         (rotSpeedDiv * 2.0 - 1.0) * rotSpeedDivMult * rndFactor.y;\n\n        addInitialVelocity(localVelocity, rndFactor.xyz);\n\n        vec3 outVelocity = emitterMatrix * localVelocity.xyz + velocity.xyz * emitterScale;\n        vec3 outPosition = tex.xyz + outVelocity * delta;\n        float outRotation = tex.w + rotSpeed * delta;\n\n        bool respawn = life <= 0.0 || life > particleLifetime;\n        outPosition = respawn? calcSpawnPosition(rndFactor.xyz, rndFactor.x) : outPosition;\n        outRotation = respawn? mix(startAngle, startAngle2, rndFactor.x) : outRotation;\n        outVelocity = respawn? vec3(0.0) : outVelocity;\n\n";
pc.shaderChunks.prefilterCubemapPS = "varying vec2 vUv0;\n\nuniform samplerCube source;\nuniform vec4 params;\n\nfloat saturate(float x) {\n    return clamp(x, 0.0, 1.0);\n}\n\nfloat rnd(vec2 uv) {\n    return fract(sin(dot(uv, vec2(12.9898, 78.233) * 2.0)) * 43758.5453);\n}\n\nconst float PI = 3.14159265358979;\nvec3 hemisphereSample_cos(vec2 uv, mat3 vecSpace, vec3 cubeDir, float gloss) { // cos + lerped cone size (better than just lerped)\n    float phi = uv.y * 2.0 * PI;\n    float cosTheta = sqrt(1.0 - uv.x);\n    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);\n    vec3 sampleDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);\n    return normalize(mix(vecSpace * sampleDir, cubeDir, params.y));\n}\n\nvec3 hemisphereSample_phong(vec2 uv, mat3 vecSpace, vec3 cubeDir, float specPow) {\n    float phi = uv.y * 2.0 * PI;\n    float cosTheta = pow(1.0 - uv.x, 1.0 / (specPow + 1.0));\n    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);\n    vec3 sampleDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);\n    return vecSpace * sampleDir;\n}\n\nmat3 matrixFromVector(vec3 n) { // frisvad\n    float a = 1.0 / (1.0 + n.z);\n    float b = -n.x * n.y * a;\n    vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);\n    vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);\n    return mat3(b1, b2, n);\n}\n\nvec4 encodeRGBM(vec4 color) { // modified RGBM\n    color.rgb = pow(color.rgb, vec3(0.5));\n    color.rgb *= 1.0 / 8.0;\n\n    color.a = saturate( max( max( color.r, color.g ), max( color.b, 1.0 / 255.0 ) ) );\n    color.a = ceil(color.a * 255.0) / 255.0;\n\n    color.rgb /= color.a;\n    return color;\n}\n\nvoid main(void) {\n\n    vec2 st = vUv0 * 2.0 - 1.0;\n\n    if (params.w==1.0 || params.w==3.0) {\n        st = 2.0 * floor(gl_FragCoord.xy) / (params.z - 1.0) - 1.0;\n    }\n\n    float face = params.x;\n\n    vec3 vec;\n    if (face==0.0) {\n        vec = vec3(1, -st.y, -st.x);\n    } else if (face==1.0) {\n        vec = vec3(-1, -st.y, st.x);\n    } else if (face==2.0) {\n        vec = vec3(st.x, 1, st.y);\n    } else if (face==3.0) {\n        vec = vec3(st.x, -1, -st.y);\n    } else if (face==4.0) {\n        vec = vec3(st.x, -st.y, 1);\n    } else {\n        vec = vec3(-st.x, -st.y, -1);\n    }\n\n    mat3 vecSpace = matrixFromVector(normalize(vec));\n\n    vec4 color = vec4(0.0);\n    const int samples = $NUMSAMPLES;\n    vec3 vect;\n    for(int i=0; i<samples; i++) {\n        float sini = sin(float(i));\n        float cosi = cos(float(i));\n        float rand = rnd(vec2(sini, cosi));\n\n        vect = hemisphereSample_$METHOD(vec2(float(i) / float(samples), rand), vecSpace, vec, params.y);\n\n        color += textureCube(source, vect);\n    }\n    color /= float(samples);\n\n    gl_FragColor = params.w < 2.0? color : encodeRGBM(color);\n}\n";
pc.shaderChunks.reflectionCubePS = "uniform samplerCube texture_cubeMap;\nuniform float material_reflectionFactor;\nvoid addCubemapReflection(inout psInternalData data) {\n    data.reflection += vec4($textureCubeSAMPLE(texture_cubeMap, fixSeams(data.reflDirW)).rgb, material_reflectionFactor);\n}\n\n";
pc.shaderChunks.reflectionPrefilteredCubePS = "uniform samplerCube texture_prefilteredCubeMap128;\nuniform samplerCube texture_prefilteredCubeMap64;\nuniform samplerCube texture_prefilteredCubeMap32;\nuniform samplerCube texture_prefilteredCubeMap16;\nuniform samplerCube texture_prefilteredCubeMap8;\nuniform samplerCube texture_prefilteredCubeMap4;\nuniform float material_reflectionFactor;\n\nvoid addCubemapReflection(inout psInternalData data) {\n\n    // Unfortunately, WebGL doesn't allow us using textureCubeLod. Therefore bunch of nasty workarounds is required.\n    // We fix mip0 to 128x128, so code is rather static.\n    // Mips smaller than 4x4 aren't great even for diffuse. Don't forget that we don't have bilinear filtering between different faces.\n\n    float bias = saturate(1.0 - data.glossiness) * 5.0; // multiply by max mip level\n    int index1 = int(bias);\n    int index2 = int(min(bias + 1.0, 7.0));\n\n    vec3 fixedReflDir = fixSeams(data.reflDirW, bias);\n\n    vec4 cubes[6];\n    cubes[0] = textureCube(texture_prefilteredCubeMap128, fixedReflDir);\n    cubes[1] = textureCube(texture_prefilteredCubeMap64, fixedReflDir);\n    cubes[2] = textureCube(texture_prefilteredCubeMap32, fixedReflDir);\n    cubes[3] = textureCube(texture_prefilteredCubeMap16, fixedReflDir);\n    cubes[4] = textureCube(texture_prefilteredCubeMap8, fixedReflDir);\n    cubes[5] = textureCube(texture_prefilteredCubeMap4, fixedReflDir);\n\n    // Also we don't have dynamic indexing in PS, so...\n    vec4 cube[2];\n    for(int i = 0; i < 6; i++) {\n        if (i == index1) {\n            cube[0] = cubes[i];\n        }\n        if (i == index2) {\n            cube[1] = cubes[i];\n        }\n    }\n\n    // another variant\n    /*if (index1==0){ cube[0]=cubes[0];\n    }else if (index1==1){ cube[0]=cubes[1];\n    }else if (index1==2){ cube[0]=cubes[2];\n    }else if (index1==3){ cube[0]=cubes[3];\n    }else if (index1==4){ cube[0]=cubes[4];\n    }else if (index1==5){ cube[0]=cubes[5];}\n\n    if (index2==0){ cube[1]=cubes[0];\n    }else if (index2==1){ cube[1]=cubes[1];\n    }else if (index2==2){ cube[1]=cubes[2];\n    }else if (index2==3){ cube[1]=cubes[3];\n    }else if (index2==4){ cube[1]=cubes[4];\n    }else if (index2==5){ cube[1]=cubes[5];}*/\n\n    vec4 cubeFinal = mix(cube[0], cube[1], fract(bias));\n    vec3 refl = $DECODE(cubeFinal).rgb;\n\n    data.reflection += vec4(refl, material_reflectionFactor);\n}\n\n";
pc.shaderChunks.reflectionPrefilteredCubeLodPS = "#extension GL_EXT_shader_texture_lod : enable\n\nuniform samplerCube texture_prefilteredCubeMap128;\nuniform float material_reflectionFactor;\n\nvoid addCubemapReflection(inout psInternalData data) {\n\n    float bias = saturate(1.0 - data.glossiness) * 5.0; // multiply by max mip level\n    vec3 fixedReflDir = fixSeams(data.reflDirW, bias);\n\n    vec3 refl = $DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, bias) ).rgb;\n\n    data.reflection += vec4(refl, material_reflectionFactor);\n}\n\n";
pc.shaderChunks.reflectionSpherePS = "uniform mat4 matrix_view;\nuniform sampler2D texture_sphereMap;\nuniform float material_reflectionFactor;\nvoid addSpheremapReflection(inout psInternalData data) {\n\n    vec3 reflDirV = (mat3(matrix_view) * data.reflDirW).xyz;\n\n    float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );\n    vec2 sphereMapUv = reflDirV.xy / m + 0.5;\n\n    data.reflection += vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, material_reflectionFactor);\n}\n\n\n";
pc.shaderChunks.reflectionSphereLowPS = "uniform sampler2D texture_sphereMap;\nuniform float material_reflectionFactor;\nvoid addSpheremapReflection(inout psInternalData data) {\n\n    vec3 reflDirV = vNormalV;\n\n    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;\n    data.reflection += vec4($texture2DSAMPLE(texture_sphereMap, sphereMapUv).rgb, material_reflectionFactor);\n}\n\n";
pc.shaderChunks.rgbmPS = "vec3 decodeRGBM(vec4 rgbm) {\n    vec3 color = (8.0 * rgbm.a) * rgbm.rgb;\n    return color * color;\n}\n\nvec3 texture2DRGBM(sampler2D tex, vec2 uv) {\n    return decodeRGBM(texture2D(tex, uv));\n}\n\nvec3 textureCubeRGBM(samplerCube tex, vec3 uvw) {\n    return decodeRGBM(textureCube(tex, uvw));\n}\n\n";
pc.shaderChunks.shadowPS = "float unpackFloat(vec4 rgbaDepth) {\n    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);\n    return dot(rgbaDepth, bitShift);\n}\n\nvoid _getShadowCoordOrtho(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {\n    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);\n    projPos.z += shadowParams.z;\n    data.shadowCoord = projPos.xyz;\n}\n\nvoid _getShadowCoordPersp(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {\n    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);\n    projPos.xyz /= projPos.w;\n    projPos.z += shadowParams.z;\n    data.shadowCoord = projPos.xyz;\n}\n\nvoid getShadowCoordOrtho(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {\n    _getShadowCoordOrtho(data, shadowMatrix, shadowParams, vPositionW);\n}\n\nvoid getShadowCoordPersp(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {\n    _getShadowCoordPersp(data, shadowMatrix, shadowParams, vPositionW);\n}\n\nvoid getShadowCoordPerspNormalOffset(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {\n    float distScale = abs(dot(vPositionW - data.lightPosW, data.lightDirNormW)); // fov?\n    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -data.lightDirNormW), 0.0, 1.0) * distScale;\n\n    _getShadowCoordPersp(data, shadowMatrix, shadowParams, wPos);\n}\n\nvoid getShadowCoordOrthoNormalOffset(inout psInternalData data, mat4 shadowMatrix, vec3 shadowParams) {\n    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -data.lightDirNormW), 0.0, 1.0); //0.08\n\n    _getShadowCoordOrtho(data, shadowMatrix, shadowParams, wPos);\n}\n\nbool shadowContained(psInternalData data) {\n    bvec4 containedVec = bvec4(data.shadowCoord.x >= 0.0, data.shadowCoord.x <= 1.0, data.shadowCoord.y >= 0.0, data.shadowCoord.y <= 1.0);\n    return all(bvec2(all(containedVec), data.shadowCoord.z <= 1.0));\n}\n\nfloat getShadow(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {\n    if (shadowContained(data)) {\n        float depth = unpackFloat(texture2D(shadowMap, data.shadowCoord.xy));\n        return (depth < data.shadowCoord.z) ? 0.0 : 1.0;\n    }\n    return 1.0;\n}\n\nvec3 lessThan2(vec3 a, vec3 b) {\n    return clamp((b - a)*1000.0, 0.0, 1.0); // softer version\n}\n\nvec3 greaterThan2(vec3 a, vec3 b) {\n    return clamp((a - b)*1000.0, 0.0, 1.0); // softer version\n}\n\nfloat getShadowPCF3x3(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {\n    if (shadowContained(data)) {\n        float shadowAccum = 0.0;\n        vec3 shadowCoord = data.shadowCoord;\n\n        float xoffset = 1.0 / shadowParams.x; // 1/shadow map width\n        float dx0 = -xoffset;\n        float dx1 = xoffset;\n\n        mat3 shadowKernel;\n        mat3 depthKernel;\n\n        depthKernel[0][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx0)));\n        depthKernel[0][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, 0.0)));\n        depthKernel[0][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx0, dx1)));\n        depthKernel[1][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx0)));\n        depthKernel[1][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy));\n        depthKernel[1][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(0.0, dx1)));\n        depthKernel[2][0] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx0)));\n        depthKernel[2][1] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, 0.0)));\n        depthKernel[2][2] = unpackFloat(texture2D(shadowMap, shadowCoord.xy + vec2(dx1, dx1)));\n\n        vec3 shadowZ = vec3(shadowCoord.z);\n        shadowKernel[0] = vec3(greaterThan(depthKernel[0], shadowZ));\n        shadowKernel[1] = vec3(greaterThan(depthKernel[1], shadowZ));\n        shadowKernel[2] = vec3(greaterThan(depthKernel[2], shadowZ));\n\n        vec2 fractionalCoord = fract( shadowCoord.xy * shadowParams.x );\n\n        shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);\n        shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);\n\n        vec4 shadowValues;\n        shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);\n        shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);\n        shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);\n        shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);\n\n        shadowAccum = dot( shadowValues, vec4( 1.0 ) ) * 0.25;\n\n        return shadowAccum;\n    }\n    return 1.0;\n}\n\n/*float getShadowPoint(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams) {\n    return float(unpackFloat(textureCube(shadowMap, data.lightDirNormW)) > (length(data.lightDirW)/shadowParams.w + shadowParams.z));\n}*/\n\nfloat _getShadowPoint(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams, vec3 dir) {\n\n    vec3 tc = normalize(dir);\n    vec3 tcAbs = abs(tc);\n\n    vec4 dirX = vec4(1,0,0, tc.x);\n    vec4 dirY = vec4(0,1,0, tc.y);\n    float majorAxisLength = tc.z;\n    if ((tcAbs.x > tcAbs.y) && (tcAbs.x > tcAbs.z)) {\n        dirX = vec4(0,0,1, tc.z);\n        dirY = vec4(0,1,0, tc.y);\n        majorAxisLength = tc.x;\n    } else if ((tcAbs.y > tcAbs.x) && (tcAbs.y > tcAbs.z)) {\n        dirX = vec4(1,0,0, tc.x);\n        dirY = vec4(0,0,1, tc.z);\n        majorAxisLength = tc.y;\n    }\n\n    float shadowParamsInFaceSpace = ((1.0/shadowParams.x) * 2.0) * abs(majorAxisLength);\n\n    vec3 xoffset = (dirX.xyz * shadowParamsInFaceSpace);\n    vec3 yoffset = (dirY.xyz * shadowParamsInFaceSpace);\n    vec3 dx0 = -xoffset;\n    vec3 dy0 = -yoffset;\n    vec3 dx1 = xoffset;\n    vec3 dy1 = yoffset;\n\n    mat3 shadowKernel;\n    mat3 depthKernel;\n\n    depthKernel[0][0] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy0));\n    depthKernel[0][1] = unpackFloat(textureCube(shadowMap, tc + dx0));\n    depthKernel[0][2] = unpackFloat(textureCube(shadowMap, tc + dx0 + dy1));\n    depthKernel[1][0] = unpackFloat(textureCube(shadowMap, tc + dy0));\n    depthKernel[1][1] = unpackFloat(textureCube(shadowMap, tc));\n    depthKernel[1][2] = unpackFloat(textureCube(shadowMap, tc + dy1));\n    depthKernel[2][0] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy0));\n    depthKernel[2][1] = unpackFloat(textureCube(shadowMap, tc + dx1));\n    depthKernel[2][2] = unpackFloat(textureCube(shadowMap, tc + dx1 + dy1));\n\n    vec3 shadowZ = vec3(length(dir) / shadowParams.w + shadowParams.z);\n\n    shadowKernel[0] = vec3(lessThan2(depthKernel[0], shadowZ));\n    shadowKernel[1] = vec3(lessThan2(depthKernel[1], shadowZ));\n    shadowKernel[2] = vec3(lessThan2(depthKernel[2], shadowZ));\n\n    vec2 uv = (vec2(dirX.w, dirY.w) / abs(majorAxisLength)) * 0.5;\n\n    vec2 fractionalCoord = fract( uv * shadowParams.x );\n\n    shadowKernel[0] = mix(shadowKernel[0], shadowKernel[1], fractionalCoord.x);\n    shadowKernel[1] = mix(shadowKernel[1], shadowKernel[2], fractionalCoord.x);\n\n    vec4 shadowValues;\n    shadowValues.x = mix(shadowKernel[0][0], shadowKernel[0][1], fractionalCoord.y);\n    shadowValues.y = mix(shadowKernel[0][1], shadowKernel[0][2], fractionalCoord.y);\n    shadowValues.z = mix(shadowKernel[1][0], shadowKernel[1][1], fractionalCoord.y);\n    shadowValues.w = mix(shadowKernel[1][1], shadowKernel[1][2], fractionalCoord.y);\n\n    return 1.0 - dot( shadowValues, vec4( 1.0 ) ) * 0.25;\n}\n\nfloat getShadowPoint(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams) {\n    return _getShadowPoint(data, shadowMap, shadowParams, data.lightDirW);\n}\n\nfloat getShadowPointNormalOffset(inout psInternalData data, samplerCube shadowMap, vec4 shadowParams) {\n    float distScale = length(data.lightDirW);\n    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -data.lightDirNormW), 0.0, 1.0) * distScale; //0.02\n    vec3 dir = wPos - data.lightPosW;\n\n    return _getShadowPoint(data, shadowMap, shadowParams, dir);\n}\n\n";
pc.shaderChunks.skyboxPS = "varying vec3 vViewDir;\nuniform samplerCube texture_cubeMap;\n\nvoid main(void) {\n    gl_FragColor = textureCube(texture_cubeMap, fixSeams(vViewDir));\n}\n\n";
pc.shaderChunks.skyboxHDRPS = "varying vec3 vViewDir;\nuniform samplerCube texture_cubeMap;\n\nvoid main(void) {\n    vec3 color = $textureCubeSAMPLE(texture_cubeMap, fixSeams(vViewDir)).rgb;\n    color = toneMap(color);\n    color = gammaCorrectOutput(color);\n    gl_FragColor = vec4(color, 1.0);\n}\n\n";
pc.shaderChunks.skyboxPrefilteredCubePS = "varying vec3 vViewDir;\nuniform samplerCube texture_cubeMap;\n\nvec3 fixSeamsStretch(vec3 vec, float mipmapIndex, float cubemapSize) {\n    float scale = 1.0 - exp2(mipmapIndex) / cubemapSize;\n    float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));\n    if (abs(vec.x) != M) vec.x *= scale;\n    if (abs(vec.y) != M) vec.y *= scale;\n    if (abs(vec.z) != M) vec.z *= scale;\n    return vec;\n}\n\nvoid main(void) {\n    vec3 color = textureCubeRGBM(texture_cubeMap, fixSeamsStretch(vViewDir, 0.0, 128.0));\n    color = toneMap(color);\n    color = gammaCorrectOutput(color);\n    gl_FragColor = vec4(color, 1.0);\n}\n\n";
pc.shaderChunks.specularAaNonePS = "float antiAliasGlossiness(inout psInternalData data, float power) {\n    return power;\n}\n\n";
pc.shaderChunks.specularAaToksvigPS = "float antiAliasGlossiness(inout psInternalData data, float power) {\n    float rlen = 1.0 / saturate(length(data.normalMap));\n    float toksvig = 1.0 / (1.0 + power * (rlen - 1.0));\n    return power * toksvig;\n}\n\n";
pc.shaderChunks.specularConstPS = "uniform vec3 material_specular;\nvoid getSpecularity(inout psInternalData data) {\n    data.specularity = material_specular;\n}\n\n";
pc.shaderChunks.specularTexPS = "uniform sampler2D texture_specularMap;\nvoid getSpecularity(inout psInternalData data) {\n    data.specularity = texture2D(texture_specularMap, $UV).$CH;\n}\n\n";
pc.shaderChunks.specularTexConstPS = "uniform sampler2D texture_specularMap;\nuniform vec3 material_specular;\nvoid getSpecularity(inout psInternalData data) {\n    data.specularity = texture2D(texture_specularMap, $UV).$CH * material_specular;\n}\n\n";
pc.shaderChunks.startPS = "\nvoid main(void) {\n    psInternalData data;\n\tdata.diffuseLight = vec3(0);\n\tdata.specularLight = vec3(0);\n    data.reflection = vec4(0);\n\n\n";
pc.shaderChunks.startVS = "\nvoid main(void) {\n    vsInternalData data;\n\n    gl_Position = getPosition(data);\n";
pc.shaderChunks.tangentBinormalVS = "\nvec3 getTangent(inout vsInternalData data) {\n    return normalize(data.normalMatrix * vertex_tangent.xyz);\n}\n\nvec3 getBinormal(inout vsInternalData data) {\n    return cross(vNormalW, vTangentW) * vertex_tangent.w;\n}\n\n";
pc.shaderChunks.TBNPS = "void getTBN(inout psInternalData data) {\n    data.TBN = mat3(normalize(vTangentW), normalize(vBinormalW), normalize(vNormalW));\n}\n\n";
pc.shaderChunks.tonemappingFilmicPS = "const float A =  0.15;\nconst float B =  0.50;\nconst float C =  0.10;\nconst float D =  0.20;\nconst float E =  0.02;\nconst float F =  0.30;\nconst float W =  11.2;\n\nuniform float exposure;\n\nvec3 uncharted2Tonemap(vec3 x) {\n   return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;\n}\n\nvec3 toneMap(vec3 color) {\n    color = uncharted2Tonemap(color * exposure);\n    vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W,W,W));\n    color = color * whiteScale;\n\n    return color;\n}\n\n";
pc.shaderChunks.tonemappingLinearPS = "uniform float exposure;\nvec3 toneMap(vec3 color) {\n    return color * exposure;\n}\n\n";
pc.shaderChunks.tonemappingNonePS = "vec3 toneMap(vec3 color) {\n    return color;\n}\n\n";
pc.shaderChunks.transformVS = "mat4 getModelMatrix(inout vsInternalData data) {\n    return matrix_model;\n}\n\nvec4 getPosition(inout vsInternalData data) {\n    data.modelMatrix = getModelMatrix(data);\n    vec4 posW = data.modelMatrix * vec4(vertex_position, 1.0);\n    data.positionW = posW.xyz;\n    return matrix_viewProjection * posW;\n}\n\nvec3 getWorldPosition(inout vsInternalData data) {\n    return data.positionW;\n}\n\n";
pc.shaderChunks.transformSkinnedVS = "mat4 getModelMatrix(inout vsInternalData data) {\n    return             vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n}\n\nvec4 getPosition(inout vsInternalData data) {\n    data.modelMatrix = getModelMatrix(data);\n    vec4 posW = data.modelMatrix * vec4(vertex_position, 1.0);\n    data.positionW = posW.xyz / posW.w;\n    return matrix_viewProjection * posW;\n}\n\nvec3 getWorldPosition(inout vsInternalData data) {\n    return data.positionW;\n}\n\n";
pc.shaderChunks.uv0VS = "\nvec2 getUv0(inout vsInternalData data) {\n    return vertex_texCoord0;\n}\n";
pc.shaderChunks.uv1VS = "\nvec2 getUv1(inout vsInternalData data) {\n    return vertex_texCoord1;\n}\n";
pc.shaderChunks.viewNormalVS = "\nuniform mat4 matrix_view;\nvec3 getViewNormal(inout vsInternalData data) {\n    return mat3(matrix_view) * vNormalW;\n}\n";
pc.extend(pc.shaderChunks, function() {
  return{defaultGamma:pc.shaderChunks.gamma1_0PS, defaultTonemapping:pc.shaderChunks.tonemappingLinearPS}
}());
pc.programlib = {getSnippet:function(device, id) {
  var code = "";
  switch(id) {
    case "common_main_begin":
      code += "void main(void)\n{\n";
      break;
    case "common_main_end":
      code += "}\n";
      break;
    case "fs_alpha_test_decl":
      code += "uniform float alpha_ref;\n";
      break;
    case "fs_alpha_test":
      code += "    if (gl_FragColor.a < alpha_ref) discard;\n\n";
      break;
    case "fs_clamp":
      code += "    gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);\n";
      break;
    case "fs_flat_color_decl":
      code += "uniform vec4 uColor;\n";
      break;
    case "fs_flat_color":
      code += "    gl_FragColor = uColor;\n";
      break;
    case "fs_fog_linear_decl":
    ;
    case "fs_fog_exp_decl":
    ;
    case "fs_fog_exp2_decl":
      code += "uniform vec3 fog_color;\n";
      if(id === "fs_fog_linear_decl") {
        code += "uniform float fog_start;\n";
        code += "uniform float fog_end;\n\n"
      }else {
        code += "uniform float fog_density;\n\n"
      }
      break;
    case "fs_fog_linear":
    ;
    case "fs_fog_exp":
    ;
    case "fs_fog_exp2":
      code += "    float depth = gl_FragCoord.z / gl_FragCoord.w;\n";
      if(id === "fs_fog_linear") {
        code += "    float fogFactor = (fog_end - depth) / (fog_end - fog_start);\n"
      }else {
        if(id === "fs_fog_exp") {
          code += "    float fogFactor = exp(-depth * fog_density);\n"
        }else {
          code += "    float fogFactor = exp(-depth * depth * fog_density * fog_density);\n"
        }
      }
      code += "    fogFactor = clamp(fogFactor, 0.0, 1.0);\n";
      code += "    gl_FragColor.rgb = mix(fog_color, gl_FragColor.rgb, fogFactor);\n";
      break;
    case "fs_precision":
      code += "precision " + device.precision + " float;\n\n";
      break;
    case "fs_height_map_funcs":
      code += "vec3 perturb_normal( vec3 N, vec3 p, vec2 uv )\n";
      code += "{\n";
      code += "    vec3 dp1 = dFdx( p );\n";
      code += "    vec3 dp2 = dFdy( p );\n";
      code += "    vec2 duv1 = dFdx( uv );\n";
      code += "    vec2 duv2 = dFdy( uv );\n\n";
      code += "    vec3 dp2perp = cross( dp2, N );\n";
      code += "    vec3 dp1perp = cross( N, dp1 );\n\n";
      code += "    const float bumpScale = 0.125;\n";
      code += "    float Hll = bumpScale * texture2D( texture_heightMap, uv ).x;\n";
      code += "    float dBx = bumpScale * texture2D( texture_heightMap, uv + duv1 ).x - Hll;\n";
      code += "    float dBy = bumpScale * texture2D( texture_heightMap, uv + duv2 ).x - Hll;\n\n";
      code += "    float fDet = dot( dp1, dp2perp );\n";
      code += "    vec3 vGrad = sign( fDet ) * ( dBx * dp2perp + dBy * dp1perp );\n";
      code += "    return normalize( abs( fDet ) * N - vGrad );\n";
      code += "}\n\n";
      break;
    case "fs_normal_map_funcs":
      if(!pc.precalculatedTangents) {
        code += "mat3 cotangent_frame( vec3 N, vec3 p, vec2 uv )\n";
        code += "{\n";
        code += "    vec3 dp1 = dFdx( p );\n";
        code += "    vec3 dp2 = dFdy( p );\n";
        code += "    vec2 duv1 = dFdx( uv );\n";
        code += "    vec2 duv2 = dFdy( uv );\n\n";
        code += "    vec3 dp2perp = cross( dp2, N );\n";
        code += "    vec3 dp1perp = cross( N, dp1 );\n";
        code += "    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;\n";
        code += "    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;\n\n";
        code += "    float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );\n";
        code += "    return mat3( T * invmax, B * invmax, N );\n";
        code += "}\n\n";
        code += "vec3 perturb_normal( vec3 N, vec3 V, vec2 uv )\n";
        code += "{\n";
        code += "    vec3 map = texture2D( texture_normalMap, uv ).xyz;\n";
        code += "    map = map * 255./127. - 128./127.;\n";
        code += "    map.xy = map.xy * material_bumpMapFactor;\n";
        code += "    mat3 TBN = cotangent_frame( N, -V, uv );\n";
        code += "    return normalize( TBN * map );\n";
        code += "}\n\n"
      }
      break;
    case "vs_skin_decl":
      if(device.supportsBoneTextures) {
        code += ["attribute vec4 vertex_boneWeights;", "attribute vec4 vertex_boneIndices;", "", "uniform sampler2D texture_poseMap;", "uniform vec2 texture_poseMapSize;", "", "mat4 getBoneMatrix(const in float i)", "{", "    float j = i * 4.0;", "    float x = mod(j, float(texture_poseMapSize.x));", "    float y = floor(j / float(texture_poseMapSize.x));", "", "    float dx = 1.0 / float(texture_poseMapSize.x);", "    float dy = 1.0 / float(texture_poseMapSize.y);", "", "    y = dy * (y + 0.5);", 
        "", "    vec4 v1 = texture2D(texture_poseMap, vec2(dx * (x + 0.5), y));", "    vec4 v2 = texture2D(texture_poseMap, vec2(dx * (x + 1.5), y));", "    vec4 v3 = texture2D(texture_poseMap, vec2(dx * (x + 2.5), y));", "    vec4 v4 = texture2D(texture_poseMap, vec2(dx * (x + 3.5), y));", "", "    mat4 bone = mat4(v1, v2, v3, v4);", "", "    return bone;", "}"].join("\n")
      }else {
        code += ["attribute vec4 vertex_boneWeights;", "attribute vec4 vertex_boneIndices;", "", "uniform mat4 matrix_pose[" + device.getBoneLimit() + "];", "", "mat4 getBoneMatrix(const in float i)", "{", "    mat4 bone = matrix_pose[int(i)];", "", "    return bone;", "}"].join("\n")
      }
      code += "\n\n";
      break;
    case "vs_transform_decl":
      code += "attribute vec3 vertex_position;\n";
      code += "uniform mat4 matrix_model;\n";
      code += "uniform mat4 matrix_viewProjection;\n\n";
      break
  }
  return code
}};
pc.programlib.basic = {generateKey:function(device, options) {
  var key = "basic";
  if(options.fog) {
    key += "_fog"
  }
  if(options.alphaTest) {
    key += "_atst"
  }
  if(options.vertexColors) {
    key += "_vcol"
  }
  if(options.diffuseMap) {
    key += "_diff"
  }
  return key
}, createShaderDefinition:function(device, options) {
  var attributes = {vertex_position:pc.SEMANTIC_POSITION};
  if(options.skin) {
    attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
    attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES
  }
  if(options.vertexColors) {
    attributes.vertex_color = pc.SEMANTIC_COLOR
  }
  if(options.diffuseMap) {
    attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0
  }
  var getSnippet = pc.programlib.getSnippet;
  var code = "";
  code += getSnippet(device, "vs_transform_decl");
  if(options.skin) {
    code += getSnippet(device, "vs_skin_decl")
  }
  if(options.vertexColors) {
    code += "attribute vec4 vertex_color;\n";
    code += "varying vec4 vColor;\n"
  }
  if(options.diffuseMap) {
    code += "attribute vec2 vertex_texCoord0;\n";
    code += "varying vec2 vUv0;\n"
  }
  code += getSnippet(device, "common_main_begin");
  if(options.skin) {
    code += "    mat4 modelMatrix = vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n";
    code += "                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n";
    code += "                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n";
    code += "                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n"
  }else {
    code += "    mat4 modelMatrix = matrix_model;\n"
  }
  code += "\n";
  code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
  code += "    gl_Position = matrix_viewProjection * positionW;\n\n";
  if(options.vertexColors) {
    code += "    vColor = vertex_color;\n"
  }
  if(options.diffuseMap) {
    code += "    vUv0 = vertex_texCoord0;\n"
  }
  code += getSnippet(device, "common_main_end");
  var vshader = code;
  code = getSnippet(device, "fs_precision");
  if(options.vertexColors) {
    code += "varying vec4 vColor;\n"
  }else {
    code += "uniform vec4 uColor;\n"
  }
  if(options.diffuseMap) {
    code += "varying vec2 vUv0;\n";
    code += "uniform sampler2D texture_diffuseMap;\n"
  }
  if(options.fog) {
    code += getSnippet(device, "fs_fog_decl")
  }
  if(options.alphatest) {
    code += getSnippet(device, "fs_alpha_test_decl")
  }
  code += getSnippet(device, "common_main_begin");
  if(options.vertexColors) {
    code += "    gl_FragColor = vColor;\n"
  }else {
    code += "    gl_FragColor = uColor;\n"
  }
  if(options.diffuseMap) {
    code += "    gl_FragColor *= texture2D(texture_diffuseMap, vUv0);\n"
  }
  if(options.alphatest) {
    code += getSnippet(device, "fs_alpha_test")
  }
  code += getSnippet(device, "fs_clamp");
  if(options.fog) {
    code += getSnippet(device, "fs_fog")
  }
  code += getSnippet(device, "common_main_end");
  var fshader = code;
  return{attributes:attributes, vshader:vshader, fshader:fshader}
}};
pc.programlib.depth = {generateKey:function(device, options) {
  var key = "depth";
  if(options.skin) {
    key += "_skin"
  }
  if(options.opacityMap) {
    key += "_opam"
  }
  return key
}, createShaderDefinition:function(device, options) {
  var attributes = {vertex_position:pc.SEMANTIC_POSITION};
  if(options.skin) {
    attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
    attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES
  }
  if(options.opacityMap) {
    attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0
  }
  var getSnippet = pc.programlib.getSnippet;
  var code = "";
  code += getSnippet(device, "vs_transform_decl");
  if(options.skin) {
    code += getSnippet(device, "vs_skin_decl")
  }
  if(options.opacityMap) {
    code += "attribute vec2 vertex_texCoord0;\n\n";
    code += "varying vec2 vUv0;\n\n"
  }
  code += getSnippet(device, "common_main_begin");
  if(options.skin) {
    code += "    mat4 modelMatrix = vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n";
    code += "                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n";
    code += "                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n";
    code += "                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n"
  }else {
    code += "    mat4 modelMatrix = matrix_model;\n"
  }
  code += "\n";
  code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
  code += "    gl_Position = matrix_viewProjection * positionW;\n\n";
  if(options.opacityMap) {
    code += "    vUv0 = vertex_texCoord0;\n"
  }
  code += getSnippet(device, "common_main_end");
  var vshader = code;
  code = getSnippet(device, "fs_precision");
  code += "uniform float camera_near;\n";
  code += "uniform float camera_far;\n";
  code += "vec4 packFloat(float depth)\n";
  code += "{\n";
  code += "    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);\n";
  code += "    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);\n";
  code += "    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);\n";
  code += "    res -= res.xxyz * bit_mask;\n";
  code += "    return res;\n";
  code += "}\n\n";
  code += getSnippet(device, "common_main_begin");
  code += "float depth = gl_FragCoord.z / gl_FragCoord.w;\n";
  code += "gl_FragColor = packFloat(depth / camera_far);\n";
  code += getSnippet(device, "common_main_end");
  var fshader = code;
  return{attributes:attributes, vshader:vshader, fshader:fshader}
}};
pc.programlib.depthrgba = {generateKey:function(device, options) {
  var key = "depthrgba";
  if(options.skin) {
    key += "_skin"
  }
  if(options.opacityMap) {
    key += "_opam"
  }
  if(options.point) {
    key += "_pnt"
  }
  return key
}, createShaderDefinition:function(device, options) {
  var attributes = {vertex_position:pc.SEMANTIC_POSITION};
  if(options.skin) {
    attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
    attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES
  }
  if(options.opacityMap) {
    attributes.vertex_texCoord0 = pc.SEMANTIC_TEXCOORD0
  }
  var getSnippet = pc.programlib.getSnippet;
  var code = "";
  code += getSnippet(device, "vs_transform_decl");
  if(options.skin) {
    code += getSnippet(device, "vs_skin_decl")
  }
  if(options.opacityMap) {
    code += "attribute vec2 vertex_texCoord0;\n\n";
    code += "varying vec2 vUv0;\n\n"
  }
  if(options.point) {
    code += "varying vec3 worldPos;\n\n"
  }
  code += getSnippet(device, "common_main_begin");
  if(options.skin) {
    code += "    mat4 modelMatrix = vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n";
    code += "                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n";
    code += "                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n";
    code += "                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n"
  }else {
    code += "    mat4 modelMatrix = matrix_model;\n"
  }
  code += "\n";
  code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
  code += "    gl_Position = matrix_viewProjection * positionW;\n\n";
  if(options.opacityMap) {
    code += "    vUv0 = vertex_texCoord0;\n"
  }
  if(options.point) {
    code += "    worldPos = positionW.xyz;\n"
  }
  code += getSnippet(device, "common_main_end");
  var vshader = code;
  code = getSnippet(device, "fs_precision");
  if(options.opacityMap) {
    code += "varying vec2 vUv0;\n\n";
    code += "uniform sampler2D texture_opacityMap;\n\n"
  }
  if(options.point) {
    code += "varying vec3 worldPos;\n\n";
    code += "uniform vec3 view_position;\n\n";
    code += "uniform float light_radius;\n\n"
  }
  code += "vec4 packFloat(float depth)\n";
  code += "{\n";
  code += "    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);\n";
  code += "    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);\n";
  code += "    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);\n";
  code += "    res -= res.xxyz * bit_mask;\n";
  code += "    return res;\n";
  code += "}\n\n";
  code += getSnippet(device, "common_main_begin");
  if(options.opacityMap) {
    code += "    if (texture2D(texture_opacityMap, vUv0).r < 0.25) discard;\n\n"
  }
  if(options.point) {
    code += "   gl_FragData[0] = packFloat(distance(view_position, worldPos) / light_radius);\n"
  }else {
    code += "    gl_FragData[0] = packFloat(gl_FragCoord.z);\n"
  }
  code += getSnippet(device, "common_main_end");
  var fshader = code;
  return{attributes:attributes, vshader:vshader, fshader:fshader}
}};
pc.programlib.particle = {generateKey:function(device, options) {
  var key = "particle";
  for(prop in options) {
    if(options.hasOwnProperty(prop)) {
      key += options[prop]
    }
  }
  return key
}, createShaderDefinition:function(device, options) {
  var getSnippet = pc.programlib.getSnippet;
  var chunk = pc.shaderChunks;
  var vshader = "";
  var fshader = getSnippet(device, "fs_precision") + "\n";
  if(!options.useCpu) {
    if(options.normal == 1) {
      vshader += "\nvarying vec3 Normal;\n"
    }
    if(options.normal == 2) {
      vshader += "\nvarying mat3 ParticleMat;\n"
    }
    vshader += chunk.particleVS;
    if(options.wrap) {
      vshader += chunk.particle_wrapVS
    }
    if(options.alignToMotion) {
      vshader += chunk.particle_pointAlongVS
    }
    vshader += options.mesh ? chunk.particle_meshVS : chunk.particle_billboardVS;
    if(options.normal == 1) {
      vshader += chunk.particle_normalVS
    }
    if(options.normal == 2) {
      vshader += chunk.particle_TBNVS
    }
    if(options.stretch > 0) {
      vshader += chunk.particle_stretchVS
    }
    vshader += chunk.particle_endVS
  }else {
    if(options.normal == 1) {
      vshader += "\nvarying vec3 Normal;\n"
    }
    if(options.normal == 2) {
      vshader += "\nvarying mat3 ParticleMat;\n"
    }
    vshader += chunk.particle_cpuVS;
    if(options.alignToMotion) {
      vshader += chunk.particle_pointAlongVS
    }
    vshader += options.mesh ? chunk.particle_meshVS : chunk.particle_billboardVS;
    if(options.normal == 1) {
      vshader += chunk.particle_normalVS
    }
    if(options.normal == 2) {
      vshader += chunk.particle_TBNVS
    }
    if(options.stretch > 0) {
      vshader += chunk.particle_stretchVS
    }
    vshader += chunk.particle_cpu_endVS
  }
  if(options.normal > 0) {
    if(options.normal == 1) {
      fshader += "\nvarying vec3 Normal;\n"
    }else {
      if(options.normal == 2) {
        fshader += "\nvarying mat3 ParticleMat;\n"
      }
    }
    fshader += "\nuniform vec3 lightCube[6];\n"
  }
  if(options.normal == 0 && options.fog == "none") {
    options.srgb = false
  }
  fshader += options.srgb ? chunk.gamma2_2PS : chunk.gamma1_0PS;
  fshader += "struct psInternalData {float dummy;};\n";
  fshader += chunk.defaultTonemapping;
  if(options.fog === "linear") {
    fshader += chunk.fogLinearPS
  }else {
    if(options.fog === "exp") {
      fshader += chunk.fogExpPS
    }else {
      if(options.fog === "exp2") {
        fshader += chunk.fogExp2PS
      }else {
        fshader += chunk.fogNonePS
      }
    }
  }
  if(options.normal == 2) {
    fshader += "\nuniform sampler2D normalMap;\n"
  }
  if(options.soft > 0) {
    fshader += "\nuniform sampler2D uDepthMap;\n"
  }
  fshader += chunk.particlePS;
  if(options.soft > 0) {
    fshader += chunk.particle_softPS
  }
  if(options.normal == 1) {
    fshader += "\nvec3 normal = Normal;\n"
  }
  if(options.normal == 2) {
    fshader += chunk.particle_normalMapPS
  }
  if(options.normal > 0) {
    fshader += options.halflambert ? chunk.particle_halflambertPS : chunk.particle_lambertPS
  }
  if(options.normal > 0) {
    fshader += chunk.particle_lightingPS
  }
  if(options.blend == pc.BLEND_NORMAL) {
    fshader += chunk.particle_blendNormalPS
  }else {
    if(options.blend == pc.BLEND_ADDITIVE) {
      fshader += chunk.particle_blendAddPS
    }else {
      if(options.blend == pc.BLEND_MULTIPLICATIVE) {
        fshader += chunk.particle_blendMultiplyPS
      }
    }
  }
  fshader += chunk.particle_endPS;
  var attributes = pc.shaderChunks.collectAttribs(vshader);
  return{attributes:attributes, vshader:vshader, fshader:fshader}
}};
pc.programlib.phong = {generateKey:function(device, options) {
  var props = [];
  var key = "phong";
  for(prop in options) {
    if(prop === "lights") {
      for(var i = 0;i < options.lights.length;i++) {
        props.push(options.lights[i].getType() + "_" + (options.lights[i].getCastShadows() ? 1 : 0) + "_" + options.lights[i].getFalloffMode() + "_" + !!options.lights[i].getNormalOffsetBias())
      }
    }else {
      if(options[prop]) {
        props.push(prop)
      }
    }
  }
  props.sort();
  for(prop in props) {
    key += "_" + props[prop] + ":" + options[props[prop]]
  }
  return key
}, _setMapTransform:function(codes, name, id, uv) {
  codes[0] += "uniform vec4 texture_" + name + "MapTransform;\n";
  var checkId = id + uv * 100;
  if(!codes[3][checkId]) {
    codes[1] += "varying vec2 vUv" + uv + "_" + id + ";\n";
    codes[2] += "   vUv" + uv + "_" + id + " = uv" + uv + " * texture_" + name + "MapTransform.xy + texture_" + name + "MapTransform.zw;\n";
    codes[3][checkId] = true
  }
  return codes
}, _uvSource:function(id, uv) {
  return id == 0 ? "vUv" + uv : "vUv" + uv + "_" + id
}, _addMap:function(p, options, chunks, uvOffset, subCode) {
  var mname = p + "Map";
  if(options[mname]) {
    var tname = mname + "Transform";
    var cname = mname + "Channel";
    var uname = mname + "Uv";
    var uv = this._uvSource(options[tname], options[uname]) + uvOffset;
    if(!subCode) {
      if(options[p + "Tint"]) {
        subCode = chunks[p + "TexConstPS"]
      }else {
        subCode = chunks[p + "TexPS"]
      }
    }
    return subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[cname])
  }else {
    return chunks[p + "ConstPS"]
  }
}, createShaderDefinition:function(device, options) {
  var i;
  var lighting = options.lights.length > 0;
  var cubemapReflection = options.cubeMap || options.prefilteredCubemap;
  var reflections = options.sphereMap || cubemapReflection;
  var useTangents = pc.precalculatedTangents;
  var useTexCubeLod = options.useTexCubeLod;
  if(options.cubeMap || options.prefilteredCubemap) {
    options.sphereMap = null
  }
  if(!options.useSpecular) {
    options.specularMap = options.glossMap = null
  }
  if(options.shadingModel === pc.SPECULAR_PHONG) {
    options.fresnelModel = 0;
    options.specularAA = false
  }else {
    options.fresnelModel = options.fresnelModel === 0 ? pc.FRESNEL_SCHLICK : options.fresnelModel
  }
  this.options = options;
  var getSnippet = pc.programlib.getSnippet;
  var code = "";
  var codeBody = "";
  var varyings = "";
  var chunks = pc.shaderChunks;
  code += chunks.baseVS;
  var attributes = {vertex_position:pc.SEMANTIC_POSITION};
  codeBody += "   vPositionW    = getWorldPosition(data);\n";
  if(lighting || reflections) {
    attributes.vertex_normal = pc.SEMANTIC_NORMAL;
    codeBody += "   vNormalW    = getNormal(data);\n";
    if(options.sphereMap && device.fragmentUniformsCount <= 16) {
      code += chunks.viewNormalVS;
      codeBody += "   vNormalV    = getViewNormal(data);\n"
    }
    if(options.normalMap && useTangents) {
      attributes.vertex_tangent = pc.SEMANTIC_TANGENT;
      code += chunks.tangentBinormalVS;
      codeBody += "   vTangentW   = getTangent(data);\n";
      codeBody += "   vBinormalW  = getBinormal(data);\n"
    }
  }
  var useUv = [];
  var useUnmodifiedUv = [];
  var maxUvSets = 2;
  for(var p in pc._matTex2D) {
    var mname = p + "Map";
    if(options[mname]) {
      var tname = mname + "Transform";
      var uname = mname + "Uv";
      var cname = mname + "Channel";
      options[uname] = Math.min(options[uname], maxUvSets - 1);
      if(pc._matTex2D[p] > 0) {
        if(pc._matTex2D[p] < options[cname].length) {
          options[cname] = options[cname].substring(0, pc._matTex2D[p])
        }else {
          if(pc._matTex2D[p] > options[cname].length) {
            var str = options[cname];
            var chr = str.charAt(str.length - 1);
            var addLen = pc._matTex2D[p] - str.length;
            for(i = 0;i < addLen;i++) {
              str += chr
            }
            options[cname] = str
          }
        }
      }
      var uvSet = options[uname];
      useUv[uvSet] = true;
      useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || options[mname] && !options[tname]
    }
  }
  for(i = 0;i < maxUvSets;i++) {
    if(useUv[i]) {
      attributes["vertex_texCoord" + i] = pc["SEMANTIC_TEXCOORD" + i];
      code += chunks["uv" + i + "VS"];
      codeBody += "   vec2 uv" + i + " = getUv" + i + "(data);\n"
    }
    if(useUnmodifiedUv[i]) {
      codeBody += "   vUv" + i + " = uv" + i + ";\n"
    }
  }
  var codes = [code, varyings, codeBody, []];
  for(var p in pc._matTex2D) {
    var mname = p + "Map";
    if(options[mname]) {
      var tname = mname + "Transform";
      if(options[tname]) {
        var uname = mname + "Uv";
        this._setMapTransform(codes, p, options[tname], options[uname])
      }
    }
  }
  code = codes[0] + codes[1];
  varyings = codes[1];
  codeBody = codes[2];
  if(options.vertexColors) {
    attributes.vertex_color = pc.SEMANTIC_COLOR
  }
  if(options.skin) {
    attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
    attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES;
    code += getSnippet(device, "vs_skin_decl");
    code += chunks.transformSkinnedVS;
    if(lighting || reflections) {
      code += chunks.normalSkinnedVS
    }
  }else {
    code += chunks.transformVS;
    if(lighting || reflections) {
      code += chunks.normalVS
    }
  }
  code += "\n";
  code += chunks.startVS;
  code += codeBody;
  code += "}";
  var vshader = code;
  code = getSnippet(device, "fs_precision");
  code += chunks.basePS;
  code += varyings;
  var numShadowLights = 0;
  for(i = 0;i < options.lights.length;i++) {
    var lightType = options.lights[i].getType();
    code += "uniform vec3 light" + i + "_color;\n";
    if(lightType == pc.LIGHTTYPE_DIRECTIONAL) {
      code += "uniform vec3 light" + i + "_direction;\n"
    }else {
      code += "uniform vec3 light" + i + "_position;\n";
      code += "uniform float light" + i + "_radius;\n";
      if(lightType == pc.LIGHTTYPE_SPOT) {
        code += "uniform vec3 light" + i + "_spotDirection;\n";
        code += "uniform float light" + i + "_innerConeAngle;\n";
        code += "uniform float light" + i + "_outerConeAngle;\n"
      }
    }
    if(options.lights[i].getCastShadows()) {
      code += "uniform mat4 light" + i + "_shadowMatrix;\n";
      if(lightType == pc.LIGHTTYPE_POINT) {
        code += "uniform vec4 light" + i + "_shadowParams;\n"
      }else {
        code += "uniform vec3 light" + i + "_shadowParams;\n"
      }
      if(lightType == pc.LIGHTTYPE_POINT) {
        code += "uniform samplerCube light" + i + "_shadowMap;\n"
      }else {
        code += "uniform sampler2D light" + i + "_shadowMap;\n"
      }
      numShadowLights++
    }
  }
  if(options.alphaTest) {
    code += getSnippet(device, "fs_alpha_test_decl")
  }
  code += "\n";
  var uvOffset = options.heightMap ? " + data.uvOffset" : "";
  if(options.normalMap && useTangents) {
    code += options.packedNormal ? chunks.normalXYPS : chunks.normalXYZPS;
    var uv = this._uvSource(options.normalMapTransform, options.normalMapUv) + uvOffset;
    code += chunks.normalMapFloatPS.replace(/\$UV/g, uv);
    code += chunks.TBNPS
  }else {
    code += chunks.normalVertexPS
  }
  code += chunks.defaultGamma;
  code += chunks.defaultTonemapping;
  if(options.fog === "linear") {
    code += chunks.fogLinearPS
  }else {
    if(options.fog === "exp") {
      code += chunks.fogExpPS
    }else {
      if(options.fog === "exp2") {
        code += chunks.fogExp2PS
      }else {
        code += chunks.fogNonePS
      }
    }
  }
  if(options.rgbmReflection) {
    code += chunks.rgbmPS
  }
  if(cubemapReflection) {
    code += options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS
  }
  code += this._addMap("diffuse", options, chunks, uvOffset);
  code += this._addMap("opacity", options, chunks, uvOffset);
  code += this._addMap("emissive", options, chunks, uvOffset);
  if(options.useSpecular) {
    if(options.specularAA && options.normalMap) {
      code += chunks.specularAaToksvigPS
    }else {
      code += chunks.specularAaNonePS
    }
    code += this._addMap("specular", options, chunks, uvOffset);
    code += this._addMap("gloss", options, chunks, uvOffset);
    if(options.fresnelModel > 0) {
      if(options.fresnelModel === pc.FRESNEL_SIMPLE) {
        code += chunks.fresnelSimplePS
      }else {
        if(options.fresnelModel === pc.FRESNEL_SCHLICK) {
          code += chunks.fresnelSchlickPS
        }else {
          if(options.fresnelModel === pc.FRESNEL_COMPLEX) {
            code += chunks.fresnelComplexPS
          }
        }
      }
    }
  }
  if(options.heightMap) {
    if(!options.normalMap) {
      code += chunks.TBNPS
    }
    code += this._addMap("height", options, chunks, "", chunks.parallaxPS)
  }
  if(options.aoMap) {
    code += this._addMap("ao", options, chunks, uvOffset, chunks.aoBakedPS)
  }
  var reflectionDecode = options.rgbmReflection ? "decodeRGBM" : options.hdrReflection ? "" : "gammaCorrectInput";
  if(options.cubeMap) {
    if(options.prefilteredCubemap) {
      if(useTexCubeLod) {
        code += chunks.reflectionPrefilteredCubeLodPS.replace(/\$DECODE/g, reflectionDecode)
      }else {
        code += chunks.reflectionPrefilteredCubePS.replace(/\$DECODE/g, reflectionDecode)
      }
    }else {
      code += chunks.reflectionCubePS.replace(/\$textureCubeSAMPLE/g, options.rgbmReflection ? "textureCubeRGBM" : options.hdrReflection ? "textureCube" : "textureCubeSRGB")
    }
  }
  if(options.sphereMap) {
    var scode = device.fragmentUniformsCount > 16 ? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
    scode = scode.replace(/\$texture2DSAMPLE/g, options.rgbmReflection ? "texture2DRGBM" : options.hdrReflection ? "texture2D" : "texture2DSRGB");
    code += scode
  }
  if(options.lightMap) {
    code += this._addMap("light", options, chunks, uvOffset, chunks.lightmapSinglePS)
  }else {
    if(options.prefilteredCubemap) {
      if(useTexCubeLod) {
        code += chunks.ambientPrefilteredCubeLodPS.replace(/\$DECODE/g, reflectionDecode)
      }else {
        code += chunks.ambientPrefilteredCubePS.replace(/\$DECODE/g, reflectionDecode)
      }
    }else {
      code += chunks.ambientConstantPS
    }
  }
  if(options.modulateAmbient) {
    code += "uniform vec3 material_ambient;\n"
  }
  if(numShadowLights > 0) {
    code += chunks.shadowPS
  }
  code += chunks.lightDiffuseLambertPS;
  if(options.useSpecular) {
    code += options.shadingModel === pc.SPECULAR_PHONG ? chunks.lightSpecularPhongPS : chunks.lightSpecularBlinnPS;
    if(options.sphereMap || options.cubeMap || options.fresnelModel > 0) {
      if(options.fresnelModel > 0) {
        if(options.conserveEnergy) {
          code += chunks.combineDiffuseSpecularPS
        }else {
          code += chunks.combineDiffuseSpecularNoConservePS
        }
      }else {
        code += chunks.combineDiffuseSpecularOldPS
      }
    }else {
      if(options.diffuseMap) {
        code += chunks.combineDiffuseSpecularNoReflPS
      }else {
        code += chunks.combineDiffuseSpecularNoReflSeparateAmbientPS
      }
    }
  }else {
    code += chunks.combineDiffusePS
  }
  code += chunks.startPS;
  if(lighting || reflections) {
    code += "   getViewDir(data);\n";
    if(options.heightMap || options.normalMap) {
      code += "   getTBN(data);\n"
    }
    if(options.heightMap) {
      code += "   getParallax(data);\n"
    }
    code += "   getNormal(data);\n";
    if(options.useSpecular) {
      code += "   getReflDir(data);\n"
    }
  }
  code += "   getAlbedo(data);\n";
  if(lighting && options.useSpecular || reflections) {
    code += "   getSpecularity(data);\n";
    code += "   getGlossiness(data);\n";
    if(options.fresnelModel > 0) {
      code += "   getFresnel(data);\n"
    }
  }
  code += "   getOpacity(data);\n";
  if(options.alphaTest) {
    code += "   if (data.alpha < alpha_ref) discard;"
  }
  code += "   addAmbient(data);\n";
  if(options.modulateAmbient) {
    code += "   data.diffuseLight *= material_ambient;\n"
  }
  if(options.aoMap) {
    code += "    applyAO(data);\n"
  }
  if(lighting || reflections) {
    if(options.cubeMap) {
      code += "   addCubemapReflection(data);\n"
    }else {
      if(options.sphereMap) {
        code += "   addSpheremapReflection(data);\n"
      }
    }
    for(i = 0;i < options.lights.length;i++) {
      var lightType = options.lights[i].getType();
      if(lightType == pc.LIGHTTYPE_DIRECTIONAL) {
        code += "   data.lightDirNormW = light" + i + "_direction;\n";
        code += "   data.atten = 1.0;\n"
      }else {
        code += "   getLightDirPoint(data, light" + i + "_position);\n";
        if(options.lights[i].getFalloffMode() == pc.LIGHTFALLOFF_LINEAR) {
          code += "   data.atten = getFalloffLinear(data, light" + i + "_radius);\n"
        }else {
          code += "   data.atten = getFalloffInvSquared(data, light" + i + "_radius);\n"
        }
        if(lightType == pc.LIGHTTYPE_SPOT) {
          code += "   data.atten *= getSpotEffect(data, light" + i + "_spotDirection, light" + i + "_innerConeAngle, light" + i + "_outerConeAngle);\n"
        }
      }
      code += "   data.atten *= getLightDiffuse(data);\n";
      if(options.lights[i].getCastShadows()) {
        if(lightType == pc.LIGHTTYPE_POINT) {
          var shadowCoordArgs = "(data, light" + i + "_shadowMap, light" + i + "_shadowParams);\n";
          if(!options.lights[i].getNormalOffsetBias()) {
            code += "   data.atten *= getShadowPoint" + shadowCoordArgs
          }else {
            code += "   data.atten *= getShadowPointNormalOffset" + shadowCoordArgs
          }
        }else {
          var shadowCoordArgs = "(data, light" + i + "_shadowMatrix, light" + i + "_shadowParams);\n";
          if(!options.lights[i].getNormalOffsetBias()) {
            if(lightType == pc.LIGHTTYPE_SPOT) {
              code += "   getShadowCoordPersp" + shadowCoordArgs
            }else {
              code += "   getShadowCoordOrtho" + shadowCoordArgs
            }
          }else {
            if(lightType == pc.LIGHTTYPE_SPOT) {
              code += "   getShadowCoordPerspNormalOffset" + shadowCoordArgs
            }else {
              code += "   getShadowCoordOrthoNormalOffset" + shadowCoordArgs
            }
          }
          code += "   data.atten *= getShadowPCF3x3(data, light" + i + "_shadowMap, light" + i + "_shadowParams);\n"
        }
      }
      code += "   data.diffuseLight += data.atten * light" + i + "_color;\n";
      if(options.useSpecular) {
        code += "   data.atten *= getLightSpecular(data);\n";
        code += "   data.specularLight += data.atten * light" + i + "_color;\n"
      }
      code += "\n"
    }
  }
  code += "\n";
  if(options.aoMap && options.occludeSpecular) {
    code += "    occludeSpecular(data);\n"
  }
  code += chunks.endPS;
  code += getSnippet(device, "fs_clamp");
  code += getSnippet(device, "common_main_end");
  var fshader = code;
  return{attributes:attributes, vshader:vshader, fshader:fshader}
}};
pc.programlib.pick = {generateKey:function(device, options) {
  var key = "pick";
  if(options.skin) {
    key += "_skin"
  }
  return key
}, createShaderDefinition:function(device, options) {
  var attributes = {vertex_position:pc.SEMANTIC_POSITION};
  if(options.skin) {
    attributes.vertex_boneWeights = pc.SEMANTIC_BLENDWEIGHT;
    attributes.vertex_boneIndices = pc.SEMANTIC_BLENDINDICES
  }
  var getSnippet = pc.programlib.getSnippet;
  var code = "";
  code += getSnippet(device, "vs_transform_decl");
  if(options.skin) {
    code += getSnippet(device, "vs_skin_decl")
  }
  code += getSnippet(device, "common_main_begin");
  if(options.skin) {
    code += "    mat4 modelMatrix = vertex_boneWeights.x * getBoneMatrix(vertex_boneIndices.x) +\n";
    code += "                       vertex_boneWeights.y * getBoneMatrix(vertex_boneIndices.y) +\n";
    code += "                       vertex_boneWeights.z * getBoneMatrix(vertex_boneIndices.z) +\n";
    code += "                       vertex_boneWeights.w * getBoneMatrix(vertex_boneIndices.w);\n"
  }else {
    code += "    mat4 modelMatrix = matrix_model;\n"
  }
  code += "\n";
  code += "    vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n";
  code += "    gl_Position = matrix_viewProjection * positionW;\n\n";
  code += getSnippet(device, "common_main_end");
  var vshader = code;
  code = getSnippet(device, "fs_precision");
  code += getSnippet(device, "fs_flat_color_decl");
  code += getSnippet(device, "common_main_begin");
  code += getSnippet(device, "fs_flat_color");
  code += getSnippet(device, "common_main_end");
  var fshader = code;
  return{attributes:attributes, vshader:vshader, fshader:fshader}
}};
pc.programlib.skybox = {generateKey:function(device, options) {
  var key = "skybox" + options.rgbm + " " + options.hdr + " " + options.fixSeams + "" + options.toneMapping + "" + options.gamma;
  return key
}, createShaderDefinition:function(device, options) {
  var getSnippet = pc.programlib.getSnippet;
  var chunks = pc.shaderChunks;
  return{attributes:{aPosition:pc.SEMANTIC_POSITION}, vshader:["attribute vec3 aPosition;", "", "uniform mat4 matrix_view;", "uniform mat4 matrix_projection;", "", "varying vec3 vViewDir;", "", "void main(void)", "{", "    mat4 view = matrix_view;", "    view[3][0] = view[3][1] = view[3][2] = 0.0;", "    gl_Position = matrix_projection * view * vec4(aPosition, 1.0);", "    gl_Position.z = gl_Position.w - 0.00001;", "    vViewDir = aPosition;", "}"].join("\n"), fshader:getSnippet(device, "fs_precision") + 
  (options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS) + (options.hdr ? chunks.defaultGamma + chunks.defaultTonemapping + chunks.rgbmPS + chunks.skyboxHDRPS.replace(/\$textureCubeSAMPLE/g, options.rgbm ? "textureCubeRGBM" : options.hdr ? "textureCube" : "textureCubeSRGB") : chunks.skyboxPS)}
}};
pc.extend(pc, function() {
  var PostEffect = function(graphicsDevice) {
    this.device = graphicsDevice;
    this.shader = null;
    this.depthMap = null;
    this.vertexBuffer = pc.createFullscreenQuad(graphicsDevice);
    this.needsDepthBuffer = false
  };
  PostEffect.prototype = {render:function(inputTarget, outputTarget, rect) {
  }};
  function createFullscreenQuad(device) {
    var vertexFormat = new pc.VertexFormat(device, [{semantic:pc.SEMANTIC_POSITION, components:2, type:pc.ELEMENTTYPE_FLOAT32}]);
    var vertexBuffer = new pc.VertexBuffer(device, vertexFormat, 4);
    var iterator = new pc.VertexIterator(vertexBuffer);
    iterator.element[pc.SEMANTIC_POSITION].set(-1, -1);
    iterator.next();
    iterator.element[pc.SEMANTIC_POSITION].set(1, -1);
    iterator.next();
    iterator.element[pc.SEMANTIC_POSITION].set(-1, 1);
    iterator.next();
    iterator.element[pc.SEMANTIC_POSITION].set(1, 1);
    iterator.end();
    return vertexBuffer
  }
  function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
    device.setRenderTarget(target);
    device.updateBegin();
    var w = target !== null ? target.width : device.width;
    var h = target !== null ? target.height : device.height;
    var x = 0;
    var y = 0;
    if(rect) {
      x = rect.x * w;
      y = rect.y * h;
      w *= rect.z;
      h *= rect.w
    }
    device.setViewport(x, y, w, h);
    device.setScissor(x, y, w, h);
    var oldBlending = device.getBlending();
    var oldDepthTest = device.getDepthTest();
    var oldDepthWrite = device.getDepthWrite();
    device.setBlending(false);
    device.setDepthTest(false);
    device.setDepthWrite(false);
    device.setVertexBuffer(vertexBuffer, 0);
    device.setShader(shader);
    device.draw({type:pc.PRIMITIVE_TRISTRIP, base:0, count:4, indexed:false});
    device.setBlending(oldBlending);
    device.setDepthTest(oldDepthTest);
    device.setDepthWrite(oldDepthWrite);
    device.updateEnd()
  }
  return{PostEffect:PostEffect, createFullscreenQuad:createFullscreenQuad, drawFullscreenQuad:drawFullscreenQuad}
}());
pc.extend(pc, function() {
  function PostEffectQueue(app, camera) {
    this.app = app;
    this.camera = camera;
    this.effects = [];
    this.enabled = false;
    this.depthTarget = null;
    this.renderTargetScale = 1;
    this.resizeTimeout = null;
    camera.on("set_rect", this.onCameraRectChanged, this)
  }
  PostEffectQueue.prototype = {_createOffscreenTarget:function(useDepth) {
    var rect = this.camera.rect;
    var width = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
    var height = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);
    var colorBuffer = new pc.Texture(this.app.graphicsDevice, {format:pc.PIXELFORMAT_R8_G8_B8_A8, width:width, height:height});
    colorBuffer.minFilter = pc.FILTER_NEAREST;
    colorBuffer.magFilter = pc.FILTER_NEAREST;
    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    return new pc.RenderTarget(this.app.graphicsDevice, colorBuffer, {depth:useDepth})
  }, _setDepthTarget:function(depthTarget) {
    if(this.depthTarget !== depthTarget) {
      if(this.depthTarget) {
        this.depthTarget.destroy()
      }
      this.depthTarget = depthTarget
    }
    this.camera.camera._depthTarget = depthTarget
  }, setRenderTargetScale:function(scale) {
    this.renderTargetScale = scale;
    this.resizeRenderTargets()
  }, addEffect:function(effect) {
    var isFirstEffect = this.effects.length === 0;
    var effects = this.effects;
    var newEntry = {effect:effect, inputTarget:this._createOffscreenTarget(isFirstEffect), outputTarget:null};
    if(effect.needsDepthBuffer) {
      if(!this.depthTarget) {
        this._setDepthTarget(this._createOffscreenTarget(true))
      }
      effect.depthMap = this.depthTarget.colorBuffer
    }
    if(isFirstEffect) {
      this.camera.renderTarget = newEntry.inputTarget
    }
    effects.push(newEntry);
    var len = effects.length;
    if(len > 1) {
      effects[len - 2].outputTarget = newEntry.inputTarget
    }
    this.enable()
  }, removeEffect:function(effect) {
    var index = -1;
    for(var i = 0, len = this.effects.length;i < len;i++) {
      if(this.effects[i].effect === effect) {
        index = i;
        break
      }
    }
    if(index >= 0) {
      if(index > 0) {
        this.effects[index - 1].outputTarget = index + 1 < this.effects.length ? this.effects[index + 1].inputTarget : null
      }else {
        if(this.effects.length > 1) {
          if(!this.effects[1].inputTarget._depth) {
            this.effects[1].inputTarget.destroy();
            this.effects[1].inputTarget = this._createOffscreenTarget(true)
          }
          this.camera.renderTarget = this.effects[1].inputTarget
        }
      }
      this.effects[index].inputTarget.destroy();
      this.effects.splice(index, 1)
    }
    if(this.depthTarget) {
      var isDepthTargetNeeded = false;
      for(var i = 0, len = this.effects.length;i < len;i++) {
        if(this.effects[i].effect.needsDepthBuffer) {
          isDepthTargetNeeded = true;
          break
        }
      }
      if(!isDepthTargetNeeded) {
        this._setDepthTarget(null)
      }
    }
    if(this.effects.length === 0) {
      this.disable()
    }
  }, destroy:function() {
    if(this.depthTarget) {
      this.depthTarget.destroy();
      this.depthTarget = null
    }
    for(var i = 0, len = this.effects.length;i < len;i++) {
      this.effects[i].inputTarget.destroy()
    }
    this.effects.length = 0;
    this.disable()
  }, enable:function() {
    if(!this.enabled && this.effects.length) {
      this.enabled = true;
      var effects = this.effects;
      var camera = this.camera;
      this.app.graphicsDevice.on("resizecanvas", this._onCanvasResized, this);
      camera.camera.setRect(0, 0, 1, 1);
      this.command = new pc.Command(pc.LAYER_FX, pc.BLEND_NONE, function() {
        if(this.enabled && camera.data.isRendering) {
          var rect = null;
          var len = effects.length;
          if(len) {
            camera.renderTarget = effects[0].inputTarget;
            this._setDepthTarget(this.depthTarget);
            for(var i = 0;i < len;i++) {
              var fx = effects[i];
              if(i === len - 1) {
                rect = camera.rect
              }
              fx.effect.render(fx.inputTarget, fx.outputTarget, rect)
            }
          }
        }
      }.bind(this));
      this.app.scene.drawCalls.push(this.command)
    }
  }, disable:function() {
    if(this.enabled) {
      this.enabled = false;
      this.app.graphicsDevice.off("resizecanvas", this._onCanvasResized, this);
      this.camera.renderTarget = null;
      this.camera.camera._depthTarget = null;
      var rect = this.camera.rect;
      this.camera.camera.setRect(rect.x, rect.y, rect.z, rect.w);
      var i = this.app.scene.drawCalls.indexOf(this.command);
      if(i >= 0) {
        this.app.scene.drawCalls.splice(i, 1)
      }
    }
  }, _onCanvasResized:function(width, height) {
    if(this.resizeTimeout) {
      clearTimeout(this.resizeTimeout)
    }
    this.resizeTimeout = setTimeout(this.resizeRenderTargets.bind(this), 500)
  }, resizeRenderTargets:function() {
    var rect = this.camera.rect;
    var desiredWidth = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
    var desiredHeight = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);
    var effects = this.effects;
    if(this.depthTarget && this.depthTarget.width !== desiredWidth && this.depthTarget.height !== desiredHeight) {
      this._setDepthTarget(this._createOffscreenTarget(true))
    }
    for(var i = 0, len = effects.length;i < len;i++) {
      var fx = effects[i];
      if(fx.inputTarget.width !== desiredWidth || fx.inputTarget.height !== desiredHeight) {
        fx.inputTarget.destroy();
        fx.inputTarget = this._createOffscreenTarget(fx.effect.needsDepthBuffer || i === 0);
        if(fx.effect.needsDepthBuffer) {
          fx.depthMap = this.depthTarget
        }
        if(i > 0) {
          effects[i - 1].outputTarget = fx.inputTarget
        }else {
          this.camera.renderTarget = fx.inputTarget
        }
      }
    }
  }, onCameraRectChanged:function(name, oldValue, newValue) {
    if(this.enabled) {
      this.camera.camera.setRect(0, 0, 1, 1);
      this.resizeRenderTargets()
    }
  }};
  return{PostEffectQueue:PostEffectQueue}
}());
(function() {
  var enums = {BLEND_SUBTRACTIVE:0, BLEND_ADDITIVE:1, BLEND_NORMAL:2, BLEND_NONE:3, BLEND_PREMULTIPLIED:4, BLEND_MULTIPLICATIVE:5, FOG_NONE:"none", FOG_LINEAR:"linear", FOG_EXP:"exp", FOG_EXP2:"exp2", FRESNEL_NONE:0, FRESNEL_SIMPLE:1, FRESNEL_SCHLICK:2, FRESNEL_COMPLEX:3, LAYER_HUD:0, LAYER_GIZMO:1, LAYER_FX:2, LAYER_WORLD:3, LIGHTTYPE_DIRECTIONAL:0, LIGHTTYPE_POINT:1, LIGHTTYPE_SPOT:2, LIGHTFALLOFF_LINEAR:0, LIGHTFALLOFF_INVERSESQUARED:1, PARTICLESORT_NONE:0, PARTICLESORT_DISTANCE:1, PARTICLESORT_NEWER_FIRST:2, 
  PARTICLESORT_OLDER_FIRST:3, PARTICLEMODE_GPU:0, PARTICLEMODE_CPU:1, EMITTERSHAPE_BOX:0, EMITTERSHAPE_SPHERE:1, PROJECTION_PERSPECTIVE:0, PROJECTION_ORTHOGRAPHIC:1, RENDERSTYLE_SOLID:0, RENDERSTYLE_WIREFRAME:1, RENDERSTYLE_POINTS:2, SPECULAR_PHONG:0, SPECULAR_BLINN:1, TONEMAP_LINEAR:0, TONEMAP_FILMIC:1};
  pc.extend(pc, enums);
  pc.scene = {};
  pc.extend(pc.scene, enums)
})();
pc.extend(pc, function() {
  var Scene = function Scene() {
    this.drawCalls = [];
    this.shadowCasters = [];
    this.fog = pc.FOG_NONE;
    this.fogColor = new pc.Color(0, 0, 0);
    this.fogStart = 1;
    this.fogEnd = 1E3;
    this.fogDensity = 0;
    this.ambientLight = new pc.Color(0, 0, 0);
    this._gammaCorrection = false;
    this._toneMapping = 0;
    this.exposure = 1;
    this._prefilteredCubeMap128 = null;
    this._prefilteredCubeMap64 = null;
    this._prefilteredCubeMap32 = null;
    this._prefilteredCubeMap16 = null;
    this._prefilteredCubeMap8 = null;
    this._prefilteredCubeMap4 = null;
    this._skyboxCubeMap = null;
    this._skyboxModel = null;
    this._models = [];
    this._lights = [];
    this._globalLights = [];
    this._localLights = [[], []];
    this.updateShaders = true
  };
  Object.defineProperty(Scene.prototype, "fog", {get:function() {
    return this._fog
  }, set:function(type) {
    if(type !== this._fog) {
      this._fog = type;
      this.updateShaders = true
    }
  }});
  Object.defineProperty(Scene.prototype, "gammaCorrection", {get:function() {
    return this._gammaCorrection
  }, set:function(value) {
    if(value !== this._gammaCorrection) {
      this._gammaCorrection = value;
      pc.shaderChunks.defaultGamma = value ? pc.shaderChunks.gamma2_2PS : pc.shaderChunks.gamma1_0PS;
      this.updateShaders = true
    }
  }});
  Object.defineProperty(Scene.prototype, "toneMapping", {get:function() {
    return this._toneMapping
  }, set:function(value) {
    if(value !== this._toneMapping) {
      this._toneMapping = value;
      pc.shaderChunks.defaultTonemapping = value ? pc.shaderChunks.tonemappingFilmicPS : pc.shaderChunks.tonemappingLinearPS;
      this.updateShaders = true
    }
  }});
  Object.defineProperty(Scene.prototype, "skybox", {get:function() {
    return this._skyboxCubeMap
  }, set:function(value) {
    if(value !== this._skyboxCubeMap) {
      this._skyboxCubeMap = value;
      if(this._skyboxModel) {
        if(this.containsModel(this._skyboxModel)) {
          this.removeModel(this._skyboxModel)
        }
      }
      this._skyboxModel = null;
      this.updateShaders = true
    }
  }});
  Scene.prototype._updateShaders = function(device) {
    var i;
    if(this._skyboxCubeMap && !this._skyboxModel) {
      var material = new pc.Material;
      var scene = this;
      material.updateShader = function() {
        var library = device.getProgramLibrary();
        var shader = library.getProgram("skybox", {rgbm:scene._skyboxCubeMap.rgbm, hdr:scene._skyboxCubeMap.rgbm || scene._skyboxCubeMap.format === pc.PIXELFORMAT_RGBA32F, fixSeams:scene._skyboxCubeMap.fixCubemapSeams, gamma:scene.gammaCorrection, toneMapping:scene.toneMapping});
        this.setShader(shader)
      };
      material.updateShader();
      material.setParameter("texture_cubeMap", this._skyboxCubeMap);
      material.setParameter("material_cubemapSize", this._skyboxCubeMap.width);
      material.cull = pc.CULLFACE_NONE;
      var node = new pc.GraphNode;
      var mesh = pc.createBox(device);
      var meshInstance = new pc.MeshInstance(node, mesh, material);
      var model = new pc.Model;
      model.graph = node;
      model.meshInstances = [meshInstance];
      this._skyboxModel = model;
      this.addModel(model)
    }
    var materials = [];
    var drawCalls = this.drawCalls;
    for(i = 0;i < drawCalls.length;i++) {
      var drawCall = drawCalls[i];
      if(drawCall.material !== undefined) {
        if(materials.indexOf(drawCall.material) === -1) {
          materials.push(drawCall.material)
        }
      }
    }
    for(i = 0;i < materials.length;i++) {
      materials[i].updateShader(device, this)
    }
  };
  Scene.prototype.getModels = function() {
    return this._models
  };
  Scene.prototype.addModel = function(model) {
    var i;
    var index = this._models.indexOf(model);
    if(index === -1) {
      this._models.push(model);
      var materials = model.getMaterials();
      for(i = 0;i < materials.length;i++) {
        materials[i].scene = this
      }
      var meshInstance;
      var numMeshInstances = model.meshInstances.length;
      for(i = 0;i < numMeshInstances;i++) {
        meshInstance = model.meshInstances[i];
        if(this.drawCalls.indexOf(meshInstance) === -1) {
          this.drawCalls.push(meshInstance)
        }
        if(meshInstance.castShadow) {
          if(this.shadowCasters.indexOf(meshInstance) === -1) {
            this.shadowCasters.push(meshInstance)
          }
        }
      }
      var lights = model.getLights();
      for(i = 0, len = lights.length;i < len;i++) {
        this.addLight(lights[i])
      }
    }
  };
  Scene.prototype.removeModel = function(model) {
    var i;
    var index = this._models.indexOf(model);
    if(index !== -1) {
      this._models.splice(index, 1);
      var materials = model.getMaterials();
      for(i = 0;i < materials.length;i++) {
        materials[i].scene = null
      }
      var meshInstance;
      var numMeshInstances = model.meshInstances.length;
      for(i = 0;i < numMeshInstances;i++) {
        meshInstance = model.meshInstances[i];
        index = this.drawCalls.indexOf(meshInstance);
        if(index !== -1) {
          this.drawCalls.splice(index, 1)
        }
        if(meshInstance.castShadow) {
          index = this.shadowCasters.indexOf(meshInstance);
          if(index !== -1) {
            this.shadowCasters.splice(index, 1)
          }
        }
      }
      var lights = model.getLights();
      for(i = 0, len = lights.length;i < len;i++) {
        this.removeLight(lights[i])
      }
    }
  };
  Scene.prototype.containsModel = function(model) {
    return this._models.indexOf(model) >= 0
  };
  Scene.prototype.addLight = function(light) {
    var index = this._lights.indexOf(light);
    if(index !== -1) {
      console.warn("pc.Scene#addLight: light is already in the scene")
    }else {
      this._lights.push(light);
      light._scene = this;
      this.updateShaders = true
    }
  };
  Scene.prototype.removeLight = function(light) {
    var index = this._lights.indexOf(light);
    if(index === -1) {
      console.warn("pc.Scene#removeLight: light is not in the scene")
    }else {
      this._lights.splice(index, 1);
      light._scene = null;
      this.updateShaders = true
    }
  };
  Scene.prototype.update = function() {
    for(var i = 0, len = this._models.length;i < len;i++) {
      this._models[i].getGraph().syncHierarchy()
    }
  };
  return{Scene:Scene}
}());
pc.extend(pc, function() {
  function sortDrawCalls(drawCallA, drawCallB) {
    if(drawCallA.distSqr && drawCallB.distSqr) {
      return drawCallB.distSqr - drawCallA.distSqr
    }else {
      return drawCallB.key - drawCallA.key
    }
  }
  var scale = (new pc.Mat4).setScale(0.5, 0.5, 0.5);
  var shift = (new pc.Mat4).setTranslate(0.5, 0.5, 0.5);
  var scaleShift = (new pc.Mat4).mul2(shift, scale);
  var camToLight = (new pc.Mat4).setFromAxisAngle(pc.Vec3.RIGHT, -90);
  var shadowCamWtm = new pc.Mat4;
  var shadowCamView = new pc.Mat4;
  var shadowCamViewProj = new pc.Mat4;
  var viewInvMat = new pc.Mat4;
  var viewMat = new pc.Mat4;
  var viewMat3 = new pc.Mat3;
  var viewProjMat = new pc.Mat4;
  var c2sc = new pc.Mat4;
  var frustumPoints = [];
  for(i = 0;i < 8;i++) {
    frustumPoints.push(new pc.Vec3)
  }
  function _calculateSceneAabb(scene) {
    var meshInstances = scene.meshInstances;
    if(meshInstances.length > 0) {
      scene._sceneAabb.copy(meshInstances[0].aabb);
      for(var i = 1;i < meshInstances.length;i++) {
        scene._sceneAabb.add(meshInstances[i].aabb)
      }
    }
  }
  function _getFrustumCentroid(scene, camera, farClip, centroid) {
    centroid.set(0, 0, -(farClip + camera._nearClip) * 0.5);
    camera._node.getWorldTransform().transformPoint(centroid, centroid)
  }
  function _getFrustumPoints(scene, camera, farClip, points) {
    var cam = camera;
    var nearClip = cam.getNearClip();
    var fov = cam.getFov() * Math.PI / 180;
    var aspect = cam.getAspectRatio();
    var projection = cam.getProjection();
    var x, y;
    if(projection === pc.PROJECTION_PERSPECTIVE) {
      y = Math.tan(fov / 2) * nearClip
    }else {
      y = camera._orthoHeight
    }
    x = y * aspect;
    points[0].x = x;
    points[0].y = -y;
    points[0].z = -nearClip;
    points[1].x = x;
    points[1].y = y;
    points[1].z = -nearClip;
    points[2].x = -x;
    points[2].y = y;
    points[2].z = -nearClip;
    points[3].x = -x;
    points[3].y = -y;
    points[3].z = -nearClip;
    if(projection === pc.PROJECTION_PERSPECTIVE) {
      y = Math.tan(fov / 2) * farClip;
      x = y * aspect
    }
    points[4].x = x;
    points[4].y = -y;
    points[4].z = -farClip;
    points[5].x = x;
    points[5].y = y;
    points[5].z = -farClip;
    points[6].x = -x;
    points[6].y = y;
    points[6].z = -farClip;
    points[7].x = -x;
    points[7].y = -y;
    points[7].z = -farClip;
    return points
  }
  function createShadowMap(device, width, height) {
    var shadowMap = new pc.Texture(device, {format:pc.PIXELFORMAT_R8_G8_B8_A8, width:width, height:height, autoMipmap:false});
    shadowMap.minFilter = pc.FILTER_NEAREST;
    shadowMap.magFilter = pc.FILTER_NEAREST;
    shadowMap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    shadowMap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    return new pc.RenderTarget(device, shadowMap, true)
  }
  function createShadowCubeMap(device, size) {
    var cubemap = new pc.Texture(device, {format:pc.PIXELFORMAT_R8_G8_B8_A8, width:size, height:size, cubemap:true, autoMipmap:false});
    cubemap.minFilter = pc.FILTER_NEAREST;
    cubemap.magFilter = pc.FILTER_NEAREST;
    cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    var targets = [];
    for(var i = 0;i < 6;i++) {
      var target = new pc.RenderTarget(device, cubemap, {face:i, depth:true});
      targets.push(target)
    }
    return targets
  }
  function createShadowCamera(device) {
    var flags = pc.CLEARFLAG_DEPTH;
    if(!device.extDepthTexture) {
      flags |= pc.CLEARFLAG_COLOR
    }
    var shadowCam = new pc.Camera;
    shadowCam.setClearOptions({color:[1, 1, 1, 1], depth:1, flags:flags});
    shadowCam._node = new pc.GraphNode;
    return shadowCam
  }
  function createShadowBuffer(device, light) {
    var shadowBuffer;
    if(light.getType() === pc.LIGHTTYPE_POINT) {
      shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
      light._shadowCamera.setRenderTarget(shadowBuffer[0]);
      light._shadowCubeMap = shadowBuffer
    }else {
      shadowBuffer = createShadowMap(device, light._shadowResolution, light._shadowResolution);
      light._shadowCamera.setRenderTarget(shadowBuffer)
    }
  }
  function getShadowCamera(device, light) {
    var shadowCam = light._shadowCamera;
    var shadowBuffer;
    if(shadowCam === null) {
      shadowCam = light._shadowCamera = createShadowCamera(device);
      createShadowBuffer(device, light)
    }else {
      shadowBuffer = shadowCam.getRenderTarget();
      if(shadowBuffer.width !== light._shadowResolution || shadowBuffer.height !== light._shadowResolution) {
        createShadowBuffer(device, light)
      }
    }
    return shadowCam
  }
  function ForwardRenderer(graphicsDevice) {
    this.device = graphicsDevice;
    var library = this.device.getProgramLibrary();
    this._depthProgStatic = library.getProgram("depthrgba", {skin:false, opacityMap:false});
    this._depthProgSkin = library.getProgram("depthrgba", {skin:true, opacityMap:false});
    this._depthProgStaticOp = library.getProgram("depthrgba", {skin:false, opacityMap:true});
    this._depthProgSkinOp = library.getProgram("depthrgba", {skin:true, opacityMap:true});
    this._depthShaderStatic = library.getProgram("depth", {skin:false});
    this._depthShaderSkin = library.getProgram("depth", {skin:true});
    this._depthProgStaticPoint = library.getProgram("depthrgba", {skin:false, opacityMap:false, point:true});
    this._depthProgSkinPoint = library.getProgram("depthrgba", {skin:true, opacityMap:false, point:true});
    this._depthProgStaticOpPoint = library.getProgram("depthrgba", {skin:false, opacityMap:true, point:true});
    this._depthProgSkinOpPoint = library.getProgram("depthrgba", {skin:true, opacityMap:true, point:true});
    var scope = this.device.scope;
    this.projId = scope.resolve("matrix_projection");
    this.viewId = scope.resolve("matrix_view");
    this.viewId3 = scope.resolve("matrix_view3");
    this.viewInvId = scope.resolve("matrix_viewInverse");
    this.viewProjId = scope.resolve("matrix_viewProjection");
    this.viewPosId = scope.resolve("view_position");
    this.nearClipId = scope.resolve("camera_near");
    this.farClipId = scope.resolve("camera_far");
    this.lightRadiusId = scope.resolve("light_radius");
    this.fogColorId = scope.resolve("fog_color");
    this.fogStartId = scope.resolve("fog_start");
    this.fogEndId = scope.resolve("fog_end");
    this.fogDensityId = scope.resolve("fog_density");
    this.modelMatrixId = scope.resolve("matrix_model");
    this.normalMatrixId = scope.resolve("matrix_normal");
    this.poseMatrixId = scope.resolve("matrix_pose[0]");
    this.boneTextureId = scope.resolve("texture_poseMap");
    this.boneTextureSizeId = scope.resolve("texture_poseMapSize");
    this.alphaTestId = scope.resolve("alpha_ref");
    this.shadowEnableId = scope.resolve("shadow_enable");
    this._shadowAabb = new pc.shape.Aabb;
    this._sceneAabb = new pc.shape.Aabb;
    this._shadowState = {blend:false};
    this.centroid = new pc.Vec3;
    this.fogColor = new Float32Array(3);
    this.ambientColor = new Float32Array(3)
  }
  pc.extend(ForwardRenderer.prototype, {setCamera:function(camera) {
    var projMat = camera.getProjectionMatrix();
    this.projId.setValue(projMat.data);
    var pos = camera._node.getPosition();
    var rot = camera._node.getRotation();
    viewInvMat.setTRS(pos, rot, pc.Vec3.ONE);
    this.viewInvId.setValue(viewInvMat.data);
    viewMat.copy(viewInvMat).invert();
    this.viewId.setValue(viewMat.data);
    viewMat3.data[0] = viewMat.data[0];
    viewMat3.data[1] = viewMat.data[1];
    viewMat3.data[2] = viewMat.data[2];
    viewMat3.data[3] = viewMat.data[4];
    viewMat3.data[4] = viewMat.data[5];
    viewMat3.data[5] = viewMat.data[6];
    viewMat3.data[6] = viewMat.data[8];
    viewMat3.data[7] = viewMat.data[9];
    viewMat3.data[8] = viewMat.data[10];
    this.viewId3.setValue(viewMat3.data);
    viewProjMat.mul2(projMat, viewMat);
    this.viewProjId.setValue(viewProjMat.data);
    this.viewPosId.setValue(camera._node.getPosition().data);
    this.nearClipId.setValue(camera.getNearClip());
    this.farClipId.setValue(camera.getFarClip());
    camera._frustum.update(projMat, viewMat);
    var device = this.device;
    var target = camera.getRenderTarget();
    device.setRenderTarget(target);
    device.updateBegin();
    var rect = camera.getRect();
    var pixelWidth = target ? target.width : device.width;
    var pixelHeight = target ? target.height : device.height;
    var x = Math.floor(rect.x * pixelWidth);
    var y = Math.floor(rect.y * pixelHeight);
    var w = Math.floor(rect.width * pixelWidth);
    var h = Math.floor(rect.height * pixelHeight);
    device.setViewport(x, y, w, h);
    device.setScissor(x, y, w, h);
    device.clear(camera.getClearOptions())
  }, dispatchGlobalLights:function(scene) {
    var dirs = scene._globalLights;
    var numDirs = dirs.length;
    var i;
    var scope = this.device.scope;
    this.ambientColor[0] = scene.ambientLight.r;
    this.ambientColor[1] = scene.ambientLight.g;
    this.ambientColor[2] = scene.ambientLight.b;
    if(scene.gammaCorrection) {
      for(i = 0;i < 3;i++) {
        this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2)
      }
    }
    scope.resolve("light_globalAmbient").setValue(this.ambientColor);
    scope.resolve("exposure").setValue(scene.exposure);
    for(i = 0;i < numDirs;i++) {
      var directional = dirs[i];
      var wtm = directional._node.getWorldTransform();
      var light = "light" + i;
      scope.resolve(light + "_color").setValue(scene.gammaCorrection ? directional._linearFinalColor.data : directional._finalColor.data);
      wtm.getY(directional._direction).scale(-1);
      scope.resolve(light + "_direction").setValue(directional._direction.normalize().data);
      if(directional.getCastShadows()) {
        var shadowMap = this.device.extDepthTexture ? directional._shadowCamera._renderTarget._depthTexture : directional._shadowCamera._renderTarget.colorBuffer;
        scope.resolve(light + "_shadowMap").setValue(shadowMap);
        scope.resolve(light + "_shadowMatrix").setValue(directional._shadowMatrix.data);
        scope.resolve(light + "_shadowParams").setValue([directional._shadowResolution, directional._normalOffsetBias, directional._shadowBias])
      }
    }
  }, dispatchLocalLights:function(scene) {
    var i, wtm;
    var point, spot;
    var light;
    var localLights = scene._localLights;
    var pnts = localLights[pc.LIGHTTYPE_POINT - 1];
    var spts = localLights[pc.LIGHTTYPE_SPOT - 1];
    var numDirs = scene._globalLights.length;
    var numPnts = pnts.length;
    var numSpts = spts.length;
    var scope = this.device.scope;
    for(i = 0;i < numPnts;i++) {
      point = pnts[i];
      wtm = point._node.getWorldTransform();
      light = "light" + (numDirs + i);
      scope.resolve(light + "_radius").setValue(point._attenuationEnd);
      scope.resolve(light + "_color").setValue(scene.gammaCorrection ? point._linearFinalColor.data : point._finalColor.data);
      wtm.getTranslation(point._position);
      scope.resolve(light + "_position").setValue(point._position.data);
      if(point.getCastShadows()) {
        var shadowMap = this.device.extDepthTexture ? point._shadowCamera._renderTarget._depthTexture : point._shadowCamera._renderTarget.colorBuffer;
        scope.resolve(light + "_shadowMap").setValue(shadowMap);
        scope.resolve(light + "_shadowMatrix").setValue(point._shadowMatrix.data);
        scope.resolve(light + "_shadowParams").setValue([point._shadowResolution, point._normalOffsetBias, point._shadowBias, point.getAttenuationEnd()])
      }
    }
    for(i = 0;i < numSpts;i++) {
      spot = spts[i];
      wtm = spot._node.getWorldTransform();
      light = "light" + (numDirs + numPnts + i);
      scope.resolve(light + "_innerConeAngle").setValue(spot._innerConeAngleCos);
      scope.resolve(light + "_outerConeAngle").setValue(spot._outerConeAngleCos);
      scope.resolve(light + "_radius").setValue(spot._attenuationEnd);
      scope.resolve(light + "_color").setValue(scene.gammaCorrection ? spot._linearFinalColor.data : spot._finalColor.data);
      wtm.getTranslation(spot._position);
      scope.resolve(light + "_position").setValue(spot._position.data);
      wtm.getY(spot._direction).scale(-1);
      scope.resolve(light + "_spotDirection").setValue(spot._direction.data);
      if(spot.getCastShadows()) {
        var shadowMap = this.device.extDepthTexture ? spot._shadowCamera._renderTarget._depthTexture : spot._shadowCamera._renderTarget.colorBuffer;
        scope.resolve(light + "_shadowMap").setValue(shadowMap);
        scope.resolve(light + "_shadowMatrix").setValue(spot._shadowMatrix.data);
        scope.resolve(light + "_shadowParams").setValue([spot._shadowResolution, spot._normalOffsetBias, spot._shadowBias])
      }
    }
  }, render:function(scene, camera) {
    var device = this.device;
    var scope = device.scope;
    scene._activeCamera = camera;
    if(scene.updateShaders) {
      scene._updateShaders(device);
      scene.updateShaders = false
    }
    var lights = scene._lights;
    var models = scene._models;
    var drawCalls = scene.drawCalls;
    var shadowCasters = scene.shadowCasters;
    var i, j, numInstances;
    var drawCall, meshInstance, prevMeshInstance = null, mesh, material, prevMaterial = null, style;
    for(i = 0, numDrawCalls = scene.drawCalls.length;i < numDrawCalls;i++) {
      drawCall = scene.drawCalls[i];
      if(drawCall.skinInstance) {
        drawCall.skinInstance.updateMatrixPalette()
      }
    }
    scene._globalLights.length = 0;
    scene._localLights[0].length = 0;
    scene._localLights[1].length = 0;
    for(i = 0;i < lights.length;i++) {
      var light = lights[i];
      if(light.getEnabled()) {
        if(light.getType() === pc.LIGHTTYPE_DIRECTIONAL) {
          scene._globalLights.push(light)
        }else {
          scene._localLights[light.getType() === pc.LIGHTTYPE_POINT ? 0 : 1].push(light)
        }
      }
    }
    var camPos = camera._node.getPosition();
    for(i = 0, numDrawCalls = drawCalls.length;i < numDrawCalls;i++) {
      drawCall = drawCalls[i];
      if(!drawCall.command) {
        meshInstance = drawCall;
        if(meshInstance.layer === pc.LAYER_WORLD) {
          if(meshInstance.material.blendType === pc.BLEND_NORMAL || meshInstance.material.blendType === pc.BLEND_PREMULTIPLIED) {
            meshInstance.syncAabb();
            var meshPos = meshInstance.aabb.center;
            var tempx = meshPos.x - camPos.x;
            var tempy = meshPos.y - camPos.y;
            var tempz = meshPos.z - camPos.z;
            meshInstance.distSqr = tempx * tempx + tempy * tempy + tempz * tempz
          }else {
            if(meshInstance.distSqr !== undefined) {
              delete meshInstance.distSqr
            }
          }
        }
      }
    }
    drawCalls.sort(sortDrawCalls);
    if(camera._depthTarget) {
      var oldTarget = camera.getRenderTarget();
      camera.setRenderTarget(camera._depthTarget);
      this.setCamera(camera);
      var oldBlending = device.getBlending();
      device.setBlending(false);
      for(i = 0, numDrawCalls = drawCalls.length;i < numDrawCalls;i++) {
        drawCall = drawCalls[i];
        if(!drawCall.command && drawCall.drawToDepth) {
          meshInstance = drawCall;
          mesh = meshInstance.mesh;
          this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
          if(meshInstance.skinInstance) {
            if(device.supportsBoneTextures) {
              this.boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
              var w = meshInstance.skinInstance.boneTexture.width;
              var h = meshInstance.skinInstance.boneTexture.height;
              this.boneTextureSizeId.setValue([w, h])
            }else {
              this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette)
            }
            device.setShader(this._depthShaderSkin)
          }else {
            device.setShader(this._depthShaderStatic)
          }
          style = meshInstance.renderStyle;
          device.setVertexBuffer(mesh.vertexBuffer, 0);
          device.setIndexBuffer(mesh.indexBuffer[style]);
          device.draw(mesh.primitive[style])
        }
        camera.setRenderTarget(oldTarget)
      }
      device.setBlending(oldBlending)
    }
    for(i = 0;i < lights.length;i++) {
      var light = lights[i];
      var type = light.getType();
      if(light.getCastShadows() && light.getEnabled()) {
        var shadowCam = getShadowCamera(device, light);
        var passes = 1;
        var pass;
        if(type === pc.LIGHTTYPE_DIRECTIONAL) {
          var shadowDistance = light.getShadowDistance();
          _getFrustumCentroid(scene, camera, shadowDistance, this.centroid);
          shadowCam._node.setPosition(this.centroid);
          shadowCam._node.setRotation(light._node.getRotation());
          shadowCam._node.rotateLocal(-90, 0, 0);
          _getFrustumPoints(scene, camera, shadowDistance, frustumPoints);
          shadowCamWtm.copy(shadowCam._node.getWorldTransform());
          var worldToShadowCam = shadowCamWtm.invert();
          var camToWorld = camera._node.worldTransform;
          c2sc.mul2(worldToShadowCam, camToWorld);
          for(j = 0;j < 8;j++) {
            c2sc.transformPoint(frustumPoints[j], frustumPoints[j])
          }
          var minx, miny, minz, maxx, maxy, maxz;
          minx = miny = minz = 1E6;
          maxx = maxy = maxz = -1E6;
          for(j = 0;j < 8;j++) {
            var p = frustumPoints[j];
            if(p.x < minx) {
              minx = p.x
            }
            if(p.x > maxx) {
              maxx = p.x
            }
            if(p.y < miny) {
              miny = p.y
            }
            if(p.y > maxy) {
              maxy = p.y
            }
            if(p.z < minz) {
              minz = p.z
            }
            if(p.z > maxz) {
              maxz = p.z
            }
          }
          shadowCam._node.translateLocal(-(maxx + minx) * 0.5, (maxy + miny) * 0.5, maxz + (maxz - minz) * 0.25);
          shadowCamWtm.copy(shadowCam._node.getWorldTransform());
          shadowCam.setProjection(pc.PROJECTION_ORTHOGRAPHIC);
          shadowCam.setNearClip(0);
          shadowCam.setFarClip((maxz - minz) * 1.5);
          shadowCam.setAspectRatio((maxx - minx) / (maxy - miny));
          shadowCam.setOrthoHeight((maxy - miny) * 0.5)
        }else {
          if(type === pc.LIGHTTYPE_SPOT) {
            shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
            shadowCam.setNearClip(light.getAttenuationEnd() / 1E3);
            shadowCam.setFarClip(light.getAttenuationEnd());
            shadowCam.setAspectRatio(1);
            shadowCam.setFov(light.getOuterConeAngle() * 2);
            var lightWtm = light._node.worldTransform;
            shadowCamWtm.mul2(lightWtm, camToLight)
          }else {
            if(type === pc.LIGHTTYPE_POINT) {
              shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
              shadowCam.setNearClip(light.getAttenuationEnd() / 1E3);
              shadowCam.setFarClip(light.getAttenuationEnd());
              shadowCam.setAspectRatio(1);
              shadowCam.setFov(90);
              passes = 6;
              this.viewPosId.setValue(shadowCam._node.getPosition().data);
              this.lightRadiusId.setValue(light.getAttenuationEnd())
            }
          }
        }
        if(type != pc.LIGHTTYPE_POINT) {
          shadowCamView.copy(shadowCamWtm).invert();
          shadowCamViewProj.mul2(shadowCam.getProjectionMatrix(), shadowCamView);
          light._shadowMatrix.mul2(scaleShift, shadowCamViewProj);
          shadowCam._node.worldTransform.copy(shadowCamWtm)
        }
        for(pass = 0;pass < passes;pass++) {
          if(type === pc.LIGHTTYPE_POINT) {
            if(pass === 0) {
              shadowCam._node.setEulerAngles(0, 90, 180)
            }else {
              if(pass === 1) {
                shadowCam._node.setEulerAngles(0, -90, 180)
              }else {
                if(pass === 2) {
                  shadowCam._node.setEulerAngles(90, 0, 0)
                }else {
                  if(pass === 3) {
                    shadowCam._node.setEulerAngles(-90, 0, 0)
                  }else {
                    if(pass === 4) {
                      shadowCam._node.setEulerAngles(0, 180, 180)
                    }else {
                      if(pass === 5) {
                        shadowCam._node.setEulerAngles(0, 0, 180)
                      }
                    }
                  }
                }
              }
            }
            shadowCam._node.setPosition(light._node.getPosition());
            shadowCam.setRenderTarget(light._shadowCubeMap[pass])
          }
          this.setCamera(shadowCam);
          device.setBlending(false);
          device.setColorWrite(true, true, true, true);
          device.setDepthWrite(true);
          device.setDepthTest(true);
          if(device.extDepthTexture) {
            device.setColorWrite(false, false, false, false)
          }
          for(j = 0, numInstances = shadowCasters.length;j < numInstances;j++) {
            meshInstance = shadowCasters[j];
            mesh = meshInstance.mesh;
            material = meshInstance.material;
            device.setCullMode(material.cull);
            this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
            if(material.opacityMap) {
              scope.resolve("texture_opacityMap").setValue(material.opacityMap)
            }
            if(meshInstance.skinInstance) {
              if(device.supportsBoneTextures) {
                this.boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
                var w = meshInstance.skinInstance.boneTexture.width;
                var h = meshInstance.skinInstance.boneTexture.height;
                this.boneTextureSizeId.setValue([w, h])
              }else {
                this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette)
              }
              if(type === pc.LIGHTTYPE_POINT) {
                device.setShader(material.opacityMap ? this._depthProgSkinOpPoint : this._depthProgSkinPoint)
              }else {
                device.setShader(material.opacityMap ? this._depthProgSkinOp : this._depthProgSkin)
              }
            }else {
              if(type === pc.LIGHTTYPE_POINT) {
                device.setShader(material.opacityMap ? this._depthProgStaticOpPoint : this._depthProgStaticPoint)
              }else {
                device.setShader(material.opacityMap ? this._depthProgStaticOp : this._depthProgStatic)
              }
            }
            style = meshInstance.renderStyle;
            device.setVertexBuffer(mesh.vertexBuffer, 0);
            device.setIndexBuffer(mesh.indexBuffer[style]);
            device.draw(mesh.primitive[style])
          }
        }
      }
    }
    this.setCamera(camera);
    this.dispatchGlobalLights(scene);
    this.dispatchLocalLights(scene);
    if(scene.fog !== pc.FOG_NONE) {
      this.fogColor[0] = scene.fogColor.r;
      this.fogColor[1] = scene.fogColor.g;
      this.fogColor[2] = scene.fogColor.b;
      if(scene.gammaCorrection) {
        for(i = 0;i < 3;i++) {
          this.fogColor[i] = Math.pow(this.fogColor[i], 2.2)
        }
      }
      this.fogColorId.setValue(this.fogColor);
      if(scene.fog === pc.FOG_LINEAR) {
        this.fogStartId.setValue(scene.fogStart);
        this.fogEndId.setValue(scene.fogEnd)
      }else {
        this.fogDensityId.setValue(scene.fogDensity)
      }
    }
    for(i = 0, numDrawCalls = drawCalls.length;i < numDrawCalls;i++) {
      drawCall = drawCalls[i];
      if(drawCall.command) {
        drawCall.command()
      }else {
        meshInstance = drawCall;
        mesh = meshInstance.mesh;
        material = meshInstance.material;
        var modelMatrix = meshInstance.node.worldTransform;
        var normalMatrix = meshInstance.normalMatrix;
        modelMatrix.invertTo3x3(normalMatrix);
        normalMatrix.transpose();
        this.modelMatrixId.setValue(modelMatrix.data);
        this.normalMatrixId.setValue(normalMatrix.data);
        if(meshInstance.skinInstance) {
          if(device.supportsBoneTextures) {
            this.boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
            var w = meshInstance.skinInstance.boneTexture.width;
            var h = meshInstance.skinInstance.boneTexture.height;
            this.boneTextureSizeId.setValue([w, h])
          }else {
            this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette)
          }
        }
        this.shadowEnableId.setValue(meshInstance.receiveShadow);
        if(material !== prevMaterial) {
          if(!material.shader) {
            material.updateShader(device, scene)
          }
          device.setShader(material.shader);
          var parameters = material.parameters;
          for(var paramName in parameters) {
            var parameter = parameters[paramName];
            if(!parameter.scopeId) {
              parameter.scopeId = device.scope.resolve(paramName)
            }
            parameter.scopeId.setValue(parameter.data)
          }
          this.alphaTestId.setValue(material.alphaTest);
          device.setBlending(material.blend);
          device.setBlendFunction(material.blendSrc, material.blendDst);
          device.setBlendEquation(material.blendEquation);
          device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
          device.setCullMode(material.cull);
          device.setDepthWrite(material.depthWrite);
          device.setDepthTest(material.depthTest)
        }
        device.setVertexBuffer(mesh.vertexBuffer, 0);
        style = meshInstance.renderStyle;
        device.setIndexBuffer(mesh.indexBuffer[style]);
        device.draw(mesh.primitive[style]);
        prevMaterial = material;
        prevMeshInstance = meshInstance
      }
    }
  }});
  return{ForwardRenderer:ForwardRenderer}
}());
pc.extend(pc, function() {
  var GraphNode = function GraphNode() {
    this.name = "Untitled";
    this._labels = {};
    this.localPosition = new pc.Vec3(0, 0, 0);
    this.localRotation = new pc.Quat(0, 0, 0, 1);
    this.localScale = new pc.Vec3(1, 1, 1);
    this.localEulerAngles = new pc.Vec3(0, 0, 0);
    this.position = new pc.Vec3(0, 0, 0);
    this.rotation = new pc.Quat(0, 0, 0, 1);
    this.eulerAngles = new pc.Vec3(0, 0, 0);
    this.localTransform = new pc.Mat4;
    this.dirtyLocal = false;
    this.worldTransform = new pc.Mat4;
    this.dirtyWorld = false;
    this._right = new pc.Vec3;
    this._up = new pc.Vec3;
    this._forward = new pc.Vec3;
    this._parent = null;
    this._children = [];
    this._enabled = true;
    this._enabledInHierarchy = true
  };
  Object.defineProperty(GraphNode.prototype, "right", {get:function() {
    return this.getWorldTransform().getX(this._right).normalize()
  }});
  Object.defineProperty(GraphNode.prototype, "up", {get:function() {
    return this.getWorldTransform().getY(this._up).normalize()
  }});
  Object.defineProperty(GraphNode.prototype, "forward", {get:function() {
    return this.getWorldTransform().getZ(this._forward).normalize().scale(-1)
  }});
  Object.defineProperty(GraphNode.prototype, "forwards", {get:function() {
    console.log("pc.GraphNode#forwards is DEPRECATED. Use pc.GraphNode#forward instead.");
    return this.forward
  }});
  Object.defineProperty(GraphNode.prototype, "enabled", {get:function() {
    return this._enabled && this._enabledInHierarchy
  }, set:function(enabled) {
    if(this._enabled !== enabled) {
      this._enabled = enabled;
      if(!this._parent || this._parent.enabled) {
        this._notifyHierarchyStateChanged(this, enabled)
      }
    }
  }});
  pc.extend(GraphNode.prototype, {_notifyHierarchyStateChanged:function(node, enabled) {
    node._onHierarchyStateChanged(enabled);
    var c = node._children;
    for(var i = 0, len = c.length;i < len;i++) {
      if(c[i]._enabled) {
        this._notifyHierarchyStateChanged(c[i], enabled)
      }
    }
  }, _onHierarchyStateChanged:function(enabled) {
    this._enabledInHierarchy = enabled
  }, _cloneInternal:function(clone) {
    clone.name = this.name;
    clone._labels = pc.extend(this._labels, {});
    clone.localPosition.copy(this.localPosition);
    clone.localRotation.copy(this.localRotation);
    clone.localScale.copy(this.localScale);
    clone.localEulerAngles.copy(this.localEulerAngles);
    clone.position.copy(this.position);
    clone.rotation.copy(this.rotation);
    clone.eulerAngles.copy(this.eulerAngles);
    clone.localTransform.copy(this.localTransform);
    clone.dirtyLocal = this.dirtyLocal;
    clone.worldTransform.copy(this.worldTransform);
    clone.dirtyWorld = this.dirtyWorld;
    clone._enabled = this._enabled;
    clone._enabledInHierarchy = this._enabledInHierarchy
  }, clone:function() {
    var clone = new pc.GraphNode;
    this._cloneInternal(clone);
    return clone
  }, find:function(attr, value) {
    var i;
    var children = this.getChildren();
    var length = children.length;
    var results = [];
    var testValue;
    if(this[attr]) {
      if(this[attr] instanceof Function) {
        testValue = this[attr]()
      }else {
        testValue = this[attr]
      }
      if(testValue === value) {
        results.push(this)
      }
    }
    for(i = 0;i < length;++i) {
      results = results.concat(children[i].find(attr, value))
    }
    return results
  }, findOne:function(attr, value) {
    var i;
    var children = this.getChildren();
    var length = children.length;
    var result = null;
    var testValue;
    if(this[attr]) {
      if(this[attr] instanceof Function) {
        testValue = this[attr]()
      }else {
        testValue = this[attr]
      }
      if(testValue === value) {
        return this
      }
    }
    for(i = 0;i < length;++i) {
      result = children[i].findOne(attr, value);
      if(result !== null) {
        return result
      }
    }
    return null
  }, findByName:function(name) {
    if(this.name === name) {
      return this
    }
    for(var i = 0;i < this._children.length;i++) {
      var found = this._children[i].findByName(name);
      if(found !== null) {
        return found
      }
    }
    return null
  }, findByPath:function(path) {
    var parts = path.split("/");
    var currentParent = this;
    var result = null;
    for(var i = 0, imax = parts.length;i < imax && currentParent;i++) {
      var part = parts[i];
      result = null;
      var children = currentParent._children;
      for(var j = 0, jmax = children.length;j < jmax;j++) {
        if(children[j].name == part) {
          result = children[j];
          break
        }
      }
      currentParent = result
    }
    return result
  }, getPath:function() {
    var parent = this._parent;
    if(parent) {
      var path = this.name;
      var format = "{0}/{1}";
      while(parent && parent._parent) {
        path = pc.string.format(format, parent.name, path);
        parent = parent._parent
      }
      return path
    }else {
      return""
    }
  }, getRoot:function() {
    var parent = this.getParent();
    if(!parent) {
      return this
    }
    while(parent.getParent()) {
      parent = parent.getParent()
    }
    return parent
  }, getParent:function() {
    return this._parent
  }, getChildren:function() {
    return this._children
  }, getEulerAngles:function() {
    this.getWorldTransform().getEulerAngles(this.eulerAngles);
    return this.eulerAngles
  }, getLocalEulerAngles:function() {
    this.localRotation.getEulerAngles(this.localEulerAngles);
    return this.localEulerAngles
  }, getLocalPosition:function() {
    return this.localPosition
  }, getLocalRotation:function() {
    return this.localRotation
  }, getLocalScale:function() {
    return this.localScale
  }, getLocalTransform:function() {
    if(this.dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this.dirtyLocal = false;
      this.dirtyWorld = true
    }
    return this.localTransform
  }, getName:function() {
    return this.name
  }, getPosition:function() {
    this.getWorldTransform().getTranslation(this.position);
    return this.position
  }, getRotation:function() {
    this.rotation.setFromMat4(this.getWorldTransform());
    return this.rotation
  }, getWorldTransform:function() {
    var syncList = [];
    return function() {
      var current = this;
      syncList.length = 0;
      while(current !== null) {
        syncList.push(current);
        current = current._parent
      }
      for(var i = syncList.length - 1;i >= 0;i--) {
        syncList[i].sync()
      }
      return this.worldTransform
    }
  }(), reparent:function(parent, index) {
    var current = this.getParent();
    if(current) {
      current.removeChild(this)
    }
    if(parent) {
      if(index >= 0) {
        parent.insertChild(this, index)
      }else {
        parent.addChild(this)
      }
    }
  }, setLocalEulerAngles:function() {
    var ex, ey, ez;
    switch(arguments.length) {
      case 1:
        ex = arguments[0].x;
        ey = arguments[0].y;
        ez = arguments[0].z;
        break;
      case 3:
        ex = arguments[0];
        ey = arguments[1];
        ez = arguments[2];
        break
    }
    this.localRotation.setFromEulerAngles(ex, ey, ez);
    this.dirtyLocal = true
  }, setLocalPosition:function() {
    if(arguments.length === 1) {
      this.localPosition.copy(arguments[0])
    }else {
      this.localPosition.set(arguments[0], arguments[1], arguments[2])
    }
    this.dirtyLocal = true
  }, setLocalRotation:function(q) {
    if(arguments.length === 1) {
      this.localRotation.copy(arguments[0])
    }else {
      this.localRotation.set(arguments[0], arguments[1], arguments[2], arguments[3])
    }
    this.dirtyLocal = true
  }, setLocalScale:function() {
    if(arguments.length === 1) {
      this.localScale.copy(arguments[0])
    }else {
      this.localScale.set(arguments[0], arguments[1], arguments[2])
    }
    this.dirtyLocal = true
  }, setName:function(name) {
    this.name = name
  }, setPosition:function() {
    var position = new pc.Vec3;
    var invParentWtm = new pc.Mat4;
    return function() {
      if(arguments.length === 1) {
        position.copy(arguments[0])
      }else {
        position.set(arguments[0], arguments[1], arguments[2])
      }
      if(this._parent === null) {
        this.localPosition.copy(position)
      }else {
        invParentWtm.copy(this._parent.getWorldTransform()).invert();
        invParentWtm.transformPoint(position, this.localPosition)
      }
      this.dirtyLocal = true
    }
  }(), setRotation:function() {
    var rotation = new pc.Quat;
    var invParentRot = new pc.Quat;
    return function() {
      if(arguments.length === 1) {
        rotation.copy(arguments[0])
      }else {
        rotation.set(arguments[0], arguments[1], arguments[2], arguments[3])
      }
      if(this._parent === null) {
        this.localRotation.copy(rotation)
      }else {
        var parentRot = this._parent.getRotation();
        invParentRot.copy(parentRot).invert();
        this.localRotation.copy(invParentRot).mul(rotation)
      }
      this.dirtyLocal = true
    }
  }(), setEulerAngles:function() {
    var invParentRot = new pc.Quat;
    return function() {
      var ex, ey, ez;
      switch(arguments.length) {
        case 1:
          ex = arguments[0].x;
          ey = arguments[0].y;
          ez = arguments[0].z;
          break;
        case 3:
          ex = arguments[0];
          ey = arguments[1];
          ez = arguments[2];
          break
      }
      this.localRotation.setFromEulerAngles(ex, ey, ez);
      if(this._parent !== null) {
        var parentRot = this._parent.getRotation();
        invParentRot.copy(parentRot).invert();
        this.localRotation.mul2(invParentRot, this.localRotation)
      }
      this.dirtyLocal = true
    }
  }(), addChild:function(node) {
    if(node.getParent() !== null) {
      throw new Error("GraphNode is already parented");
    }
    this._children.push(node);
    this._onInsertChild(node)
  }, addChildAndSaveTransform:function(node) {
    var wPos = node.getPosition();
    var wRot = node.getRotation();
    var current = node.getParent();
    if(current) {
      current.removeChild(node)
    }
    if(this.tmpMat4 == undefined) {
      this.tmpMat4 = new pc.Mat4;
      this.tmpQuat = new pc.Quat
    }
    node.setPosition(this.tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
    node.setRotation(this.tmpQuat.copy(this.getRotation()).invert().mul(wRot));
    this._children.push(node);
    this._onInsertChild(node)
  }, insertChild:function(node, index) {
    if(node.getParent() !== null) {
      throw new Error("GraphNode is already parented");
    }
    this._children.splice(index, 0, node);
    this._onInsertChild(node)
  }, _onInsertChild:function(node) {
    node._parent = this;
    var enabledInHierarchy = node._enabled && this.enabled;
    if(node._enabledInHierarchy !== enabledInHierarchy) {
      node._enabledInHierarchy = enabledInHierarchy;
      node._notifyHierarchyStateChanged(node, enabledInHierarchy)
    }
    node.dirtyWorld = true
  }, removeChild:function(child) {
    var i;
    var length = this._children.length;
    child._parent = null;
    for(i = 0;i < length;++i) {
      if(this._children[i] === child) {
        this._children.splice(i, 1);
        return
      }
    }
  }, addLabel:function(label) {
    this._labels[label] = true
  }, getLabels:function() {
    return Object.keys(this._labels)
  }, hasLabel:function(label) {
    return!!this._labels[label]
  }, removeLabel:function(label) {
    delete this._labels[label]
  }, findByLabel:function(label, results) {
    var i, length = this._children.length;
    results = results || [];
    if(this.hasLabel(label)) {
      results.push(this)
    }
    for(i = 0;i < length;++i) {
      results = this._children[i].findByLabel(label, results)
    }
    return results
  }, sync:function() {
    if(this.dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
      this.dirtyLocal = false;
      this.dirtyWorld = true
    }
    if(this.dirtyWorld) {
      if(this._parent === null) {
        this.worldTransform.copy(this.localTransform)
      }else {
        this.worldTransform.mul2(this._parent.worldTransform, this.localTransform)
      }
      this.dirtyWorld = false;
      for(var i = 0, len = this._children.length;i < len;i++) {
        this._children[i].dirtyWorld = true
      }
    }
  }, syncHierarchy:function() {
    var F = function() {
      if(!this._enabled) {
        return
      }
      this.sync();
      var c = this._children;
      for(var i = 0, len = c.length;i < len;i++) {
        F.call(c[i])
      }
    };
    return F
  }(), lookAt:function() {
    var matrix = new pc.Mat4;
    var target = new pc.Vec3;
    var up = new pc.Vec3;
    var rotation = new pc.Quat;
    return function() {
      switch(arguments.length) {
        case 1:
          target.copy(arguments[0]);
          up.copy(pc.Vec3.UP);
          break;
        case 2:
          target.copy(arguments[0]);
          up.copy(arguments[1]);
          break;
        case 3:
          target.set(arguments[0], arguments[1], arguments[2]);
          up.copy(pc.Vec3.UP);
          break;
        case 6:
          target.set(arguments[0], arguments[1], arguments[2]);
          up.set(arguments[3], arguments[4], arguments[5]);
          break
      }
      matrix.setLookAt(this.getPosition(), target, up);
      rotation.setFromMat4(matrix);
      this.setRotation(rotation)
    }
  }(), translate:function() {
    var translation = new pc.Vec3;
    return function() {
      switch(arguments.length) {
        case 1:
          translation.copy(arguments[0]);
          break;
        case 3:
          translation.set(arguments[0], arguments[1], arguments[2]);
          break
      }
      translation.add(this.getPosition());
      this.setPosition(translation)
    }
  }(), translateLocal:function() {
    var translation = new pc.Vec3;
    return function() {
      switch(arguments.length) {
        case 1:
          translation.copy(arguments[0]);
          break;
        case 3:
          translation.set(arguments[0], arguments[1], arguments[2]);
          break
      }
      this.localRotation.transformVector(translation, translation);
      this.localPosition.add(translation);
      this.dirtyLocal = true
    }
  }(), rotate:function() {
    var quaternion = new pc.Quat;
    var invParentRot = new pc.Quat;
    return function() {
      var ex, ey, ez;
      switch(arguments.length) {
        case 1:
          ex = arguments[0].x;
          ey = arguments[0].y;
          ez = arguments[0].z;
          break;
        case 3:
          ex = arguments[0];
          ey = arguments[1];
          ez = arguments[2];
          break
      }
      quaternion.setFromEulerAngles(ex, ey, ez);
      if(this._parent === null) {
        this.localRotation.mul2(quaternion, this.localRotation)
      }else {
        var rot = this.getRotation();
        var parentRot = this._parent.getRotation();
        invParentRot.copy(parentRot).invert();
        quaternion.mul2(invParentRot, quaternion);
        this.localRotation.mul2(quaternion, rot)
      }
      this.dirtyLocal = true
    }
  }(), rotateLocal:function() {
    var quaternion = new pc.Quat;
    return function() {
      var ex, ey, ez;
      switch(arguments.length) {
        case 1:
          ex = arguments[0].x;
          ey = arguments[0].y;
          ez = arguments[0].z;
          break;
        case 3:
          ex = arguments[0];
          ey = arguments[1];
          ez = arguments[2];
          break
      }
      quaternion.setFromEulerAngles(ex, ey, ez);
      this.localRotation.mul(quaternion);
      this.dirtyLocal = true
    }
  }()});
  return{GraphNode:GraphNode}
}());
pc.extend(pc, function() {
  var Camera = function() {
    this._projection = pc.PROJECTION_PERSPECTIVE;
    this._nearClip = 0.1;
    this._farClip = 1E4;
    this._fov = 45;
    this._orthoHeight = 10;
    this._aspect = 16 / 9;
    this._projMatDirty = true;
    this._projMat = new pc.Mat4;
    this._viewMat = new pc.Mat4;
    this._viewProjMat = new pc.Mat4;
    this._rect = {x:0, y:0, width:1, height:1};
    this._frustum = new pc.Frustum(this._projMat, this._viewMat);
    this._renderTarget = null;
    this._clearOptions = {color:[186 / 255, 186 / 255, 177 / 255, 1], depth:1, flags:pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH};
    this._node = null
  };
  Camera.prototype = {clone:function() {
    var clone = new pc.Camera;
    clone.setProjection(this.getProjection());
    clone.setNearClip(this.getNearClip());
    clone.setFarClip(this.getFarClip());
    clone.setFov(this.getFov());
    clone.setAspectRatio(this.getAspectRatio());
    clone.setRenderTarget(this.getRenderTarget());
    clone.setClearOptions(this.getClearOptions());
    return clone
  }, worldToScreen:function(worldCoord, cw, ch, screenCoord) {
    if(screenCoord === undefined) {
      screenCoord = new pc.Vec3
    }
    var projMat = this.getProjectionMatrix();
    var wtm = this._node.getWorldTransform();
    this._viewMat.copy(wtm).invert();
    this._viewProjMat.mul2(projMat, this._viewMat);
    this._viewProjMat.transformPoint(worldCoord, screenCoord);
    var wp = worldCoord.data;
    var vpm = this._viewProjMat.data;
    var w = wp[0] * vpm[3] + wp[1] * vpm[7] + wp[2] * vpm[11] + 1 * vpm[15];
    screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
    screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;
    return screenCoord
  }, screenToWorld:function(x, y, z, cw, ch, worldCoord) {
    if(worldCoord === undefined) {
      worldCoord = new pc.Vec3
    }
    var projMat = this.getProjectionMatrix();
    var wtm = this._node.getWorldTransform();
    this._viewMat.copy(wtm).invert();
    this._viewProjMat.mul2(projMat, this._viewMat);
    var invViewProjMat = this._viewProjMat.clone().invert();
    if(this._projection === pc.PROJECTION_PERSPECTIVE) {
      var far = new pc.Vec3(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, 1);
      var farW = invViewProjMat.transformPoint(far);
      var w = far.x * invViewProjMat.data[3] + far.y * invViewProjMat.data[7] + far.z * invViewProjMat.data[11] + invViewProjMat.data[15];
      farW.scale(1 / w);
      var alpha = z / this._farClip;
      worldCoord.lerp(this._node.getPosition(), farW, alpha)
    }else {
      var range = this._farClip - this._nearClip;
      var deviceCoord = new pc.Vec3(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, (this._farClip - z) / range * 2 - 1);
      invViewProjMat.transformPoint(deviceCoord, worldCoord)
    }
    return worldCoord
  }, getAspectRatio:function() {
    return this._aspect
  }, getClearOptions:function() {
    return this._clearOptions
  }, getFarClip:function() {
    return this._farClip
  }, getFov:function() {
    return this._fov
  }, getFrustum:function() {
    return this._frustum
  }, getNearClip:function() {
    return this._nearClip
  }, getOrthoHeight:function() {
    return this._orthoHeight
  }, getProjection:function() {
    return this._projection
  }, getProjectionMatrix:function() {
    if(this._projMatDirty) {
      if(this._projection === pc.PROJECTION_PERSPECTIVE) {
        this._projMat.setPerspective(this._fov, this._aspect, this._nearClip, this._farClip)
      }else {
        var y = this._orthoHeight;
        var x = y * this._aspect;
        this._projMat.setOrtho(-x, x, -y, y, this._nearClip, this._farClip)
      }
      this._projMatDirty = false
    }
    return this._projMat
  }, getRect:function() {
    return this._rect
  }, getRenderTarget:function() {
    return this._renderTarget
  }, setAspectRatio:function(aspect) {
    this._aspect = aspect;
    this._projMatDirty = true
  }, setClearOptions:function(options) {
    this._clearOptions = options
  }, setFarClip:function(far) {
    this._farClip = far;
    this._projMatDirty = true
  }, setFov:function(fov) {
    this._fov = fov;
    this._projMatDirty = true
  }, setNearClip:function(near) {
    this._nearClip = near;
    this._projMatDirty = true
  }, setOrthoHeight:function(height) {
    this._orthoHeight = height;
    this._projMatDirty = true
  }, setProjection:function(type) {
    this._projection = type;
    this._projMatDirty = true
  }, setRect:function(x, y, width, height) {
    this._rect.x = x;
    this._rect.y = y;
    this._rect.width = width;
    this._rect.height = height
  }, setRenderTarget:function(target) {
    this._renderTarget = target
  }};
  return{Camera:Camera}
}());
pc.extend(pc, function() {
  var Light = function Light() {
    this._type = pc.LIGHTTYPE_DIRECTIONAL;
    this._color = new pc.Color(0.8, 0.8, 0.8);
    this._intensity = 1;
    this._castShadows = false;
    this._enabled = false;
    this._attenuationStart = 10;
    this._attenuationEnd = 10;
    this._falloffMode = 0;
    this._innerConeAngle = 40;
    this._outerConeAngle = 45;
    this._finalColor = new pc.Vec3(0.8, 0.8, 0.8);
    this._linearFinalColor = new pc.Vec3;
    this._position = new pc.Vec3(0, 0, 0);
    this._direction = new pc.Vec3(0, 0, 0);
    this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
    this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);
    this._shadowCamera = null;
    this._shadowMatrix = new pc.Mat4;
    this._shadowDistance = 40;
    this._shadowResolution = 1024;
    this._shadowBias = -5E-4;
    this._normalOffsetBias = 0;
    this._scene = null;
    this._node = null
  };
  Light.prototype = {clone:function() {
    var clone = new pc.Light;
    clone.setType(this.getType());
    clone.setColor(this.getColor());
    clone.setIntensity(this.getIntensity());
    clone.setCastShadows(this.getCastShadows());
    clone.setEnabled(this.getEnabled());
    clone.setAttenuationStart(this.getAttenuationStart());
    clone.setAttenuationEnd(this.getAttenuationEnd());
    clone.setFalloffMode(this.getFalloffMode());
    clone.setInnerConeAngle(this.getInnerConeAngle());
    clone.setOuterConeAngle(this.getOuterConeAngle());
    clone.setShadowBias(this.getShadowBias());
    clone.setNormalOffsetBias(this.getNormalOffsetBias());
    clone.setShadowResolution(this.getShadowResolution());
    clone.setShadowDistance(this.getShadowDistance());
    return clone
  }, getAttenuationEnd:function() {
    return this._attenuationEnd
  }, getAttenuationStart:function() {
    return this._attenuationStart
  }, getFalloffMode:function() {
    return this._falloffMode
  }, getCastShadows:function() {
    return this._castShadows
  }, getColor:function() {
    return this._color
  }, getEnabled:function() {
    return this._enabled
  }, getInnerConeAngle:function() {
    return this._innerConeAngle
  }, getIntensity:function() {
    return this._intensity
  }, getOuterConeAngle:function() {
    return this._outerConeAngle
  }, getShadowBias:function() {
    return this._shadowBias
  }, getNormalOffsetBias:function() {
    return this._normalOffsetBias
  }, getShadowDistance:function() {
    return this._shadowDistance
  }, getShadowResolution:function() {
    return this._shadowResolution
  }, getType:function() {
    return this._type
  }, setAttenuationEnd:function(radius) {
    this._attenuationEnd = radius
  }, setAttenuationStart:function(radius) {
    this._attenuationStart = radius
  }, setFalloffMode:function(mode) {
    this._falloffMode = mode;
    if(this._scene !== null) {
      this._scene.updateShaders = true
    }
  }, setCastShadows:function(castShadows) {
    this._castShadows = castShadows;
    if(this._scene !== null) {
      this._scene.updateShaders = true
    }
  }, setColor:function() {
    var r, g, b;
    if(arguments.length === 1) {
      r = arguments[0].r;
      g = arguments[0].g;
      b = arguments[0].b
    }else {
      if(arguments.length === 3) {
        r = arguments[0];
        g = arguments[1];
        b = arguments[2]
      }
    }
    this._color.set(r, g, b);
    var i = this._intensity;
    this._finalColor.set(r * i, g * i, b * i);
    for(var c = 0;c < 3;c++) {
      if(i >= 1) {
        this._linearFinalColor.data[c] = Math.pow(this._finalColor.data[c] / i, 2.2) * i
      }else {
        this._linearFinalColor.data[c] = Math.pow(this._finalColor.data[c], 2.2)
      }
    }
  }, setEnabled:function(enable) {
    if(this._enabled !== enable) {
      this._enabled = enable;
      if(this._scene !== null) {
        this._scene.updateShaders = true
      }
    }
  }, setInnerConeAngle:function(angle) {
    this._innerConeAngle = angle;
    this._innerConeAngleCos = Math.cos(angle * Math.PI / 180)
  }, setIntensity:function(intensity) {
    this._intensity = intensity;
    var c = this._color;
    var r = c.r;
    var g = c.g;
    var b = c.b;
    var i = this._intensity;
    this._finalColor.set(r * i, g * i, b * i);
    for(var j = 0;j < 3;j++) {
      if(i >= 1) {
        this._linearFinalColor.data[j] = Math.pow(this._finalColor.data[j] / i, 2.2) * i
      }else {
        this._linearFinalColor.data[j] = Math.pow(this._finalColor.data[j], 2.2)
      }
    }
  }, setOuterConeAngle:function(angle) {
    this._outerConeAngle = angle;
    this._outerConeAngleCos = Math.cos(angle * Math.PI / 180)
  }, setShadowBias:function(bias) {
    this._shadowBias = bias
  }, setNormalOffsetBias:function(bias) {
    if(!this._normalOffsetBias && bias || this._normalOffsetBias && !bias) {
      this._scene.updateShaders = true
    }
    this._normalOffsetBias = bias
  }, setShadowDistance:function(distance) {
    this._shadowDistance = distance
  }, setShadowResolution:function(resolution) {
    this._shadowResolution = resolution
  }, setType:function(type) {
    this._type = type
  }};
  return{Light:Light}
}());
pc.extend(pc, function() {
  var id = 0;
  var Material = function Material() {
    this.name = "Untitled";
    this.id = id++;
    this.shader = null;
    this.parameters = {};
    this.alphaTest = 0;
    this.blend = false;
    this.blendSrc = pc.BLENDMODE_ONE;
    this.blendDst = pc.BLENDMODE_ZERO;
    this.blendEquation = pc.BLENDEQUATION_ADD;
    this.cull = pc.CULLFACE_BACK;
    this.depthTest = true;
    this.depthWrite = true;
    this.redWrite = true;
    this.greenWrite = true;
    this.blueWrite = true;
    this.alphaWrite = true;
    this.meshInstances = []
  };
  Object.defineProperty(Material.prototype, "blendType", {get:function() {
    if(!this.blend && this.blendSrc === pc.BLENDMODE_ONE && this.blendDst === pc.BLENDMODE_ZERO && this.blendEquation === pc.BLENDEQUATION_ADD) {
      return pc.BLEND_NONE
    }else {
      if(this.blend && this.blendSrc === pc.BLENDMODE_SRC_ALPHA && this.blendDst === pc.BLENDMODE_ONE_MINUS_SRC_ALPHA && this.blendEquation === pc.BLENDEQUATION_ADD) {
        return pc.BLEND_NORMAL
      }else {
        if(this.blend && this.blendSrc === pc.BLENDMODE_ONE && this.blendDst === pc.BLENDMODE_ONE && this.blendEquation === pc.BLENDEQUATION_ADD) {
          return pc.BLEND_ADDITIVE
        }else {
          if(this.blend && this.blendSrc === pc.BLENDMODE_DST_COLOR && this.blendDst === pc.BLENDMODE_ZERO && this.blendEquation === pc.BLENDEQUATION_ADD) {
            return pc.BLEND_MULTIPLICATIVE
          }else {
            if(this.blend && this.blendSrc === pc.BLENDMODE_ONE && this.blendDst === pc.BLENDMODE_ONE_MINUS_SRC_ALPHA && this.blendEquation === pc.BLENDEQUATION_ADD) {
              return pc.BLEND_PREMULTIPLIED
            }else {
              return pc.BLEND_NORMAL
            }
          }
        }
      }
    }
  }, set:function(type) {
    switch(type) {
      case pc.BLEND_NONE:
        this.blend = false;
        this.blendSrc = pc.BLENDMODE_ONE;
        this.blendDst = pc.BLENDMODE_ZERO;
        this.blendEquation = pc.BLENDEQUATION_ADD;
        break;
      case pc.BLEND_NORMAL:
        this.blend = true;
        this.blendSrc = pc.BLENDMODE_SRC_ALPHA;
        this.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
        this.blendEquation = pc.BLENDEQUATION_ADD;
        break;
      case pc.BLEND_PREMULTIPLIED:
        this.blend = true;
        this.blendSrc = pc.BLENDMODE_ONE;
        this.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
        this.blendEquation = pc.BLENDEQUATION_ADD;
        break;
      case pc.BLEND_ADDITIVE:
        this.blend = true;
        this.blendSrc = pc.BLENDMODE_ONE;
        this.blendDst = pc.BLENDMODE_ONE;
        this.blendEquation = pc.BLENDEQUATION_ADD;
        break;
      case pc.BLEND_MULTIPLICATIVE:
        this.blend = true;
        this.blendSrc = pc.BLENDMODE_DST_COLOR;
        this.blendDst = pc.BLENDMODE_ZERO;
        this.blendEquation = pc.BLENDEQUATION_ADD;
        break
    }
    this._updateMeshInstanceKeys()
  }});
  Material.prototype._cloneInternal = function(clone) {
    clone.name = this.name;
    clone.id = id++;
    clone.shader = null;
    clone.parameters = {};
    clone.alphaTest = this.alphaTest;
    clone.blend = this.blend;
    clone.blendSrc = this.blendSrc;
    clone.blendDst = this.blendDst;
    clone.blendEquation = this.blendEquation;
    clone.cull = this.cull;
    clone.depthTest = this.depthTest;
    clone.depthWrite = this.depthWrite;
    clone.redWrite = this.redWrite;
    clone.greenWrite = this.greenWrite;
    clone.blueWrite = this.blueWrite;
    clone.alphaWrite = this.alphaWrite;
    clone.meshInstances = []
  }, Material.prototype.clone = function() {
    var clone = new pc.Material;
    this._cloneInternal(clone);
    return clone
  }, Material.prototype._updateMeshInstanceKeys = function() {
    var i, meshInstances = this.meshInstances;
    for(var i = 0;i < meshInstances.length;i++) {
      meshInstances[i].updateKey()
    }
  };
  Material.prototype.updateShader = function(device, scene) {
  };
  Material.prototype.getName = function() {
    return this.name
  };
  Material.prototype.setName = function(name) {
    this.name = name
  };
  Material.prototype.clearParameters = function() {
    this.parameters = {}
  };
  Material.prototype.getParameters = function() {
    return this.parameters
  };
  Material.prototype.getParameter = function(name) {
    return this.parameters[name]
  };
  Material.prototype.setParameter = function(name, data) {
    var param = this.parameters[name];
    if(param) {
      param.data = data
    }else {
      this.parameters[name] = {scopeId:null, data:data}
    }
  };
  Material.prototype.deleteParameter = function(name) {
    if(this.parameters[name]) {
      delete this.parameters[name]
    }
  };
  Material.prototype.setParameters = function() {
    for(var paramName in this.parameters) {
      var parameter = this.parameters[paramName];
      if(!parameter.scopeId) {
        parameter.scopeId = device.scope.resolve(paramName)
      }
      parameter.scopeId.setValue(parameter.data)
    }
  };
  Material.prototype.getShader = function() {
    return this.shader
  };
  Material.prototype.setShader = function(shader) {
    this.shader = shader
  };
  Material.prototype.update = function() {
    throw Error("Not Implemented in base class");
  };
  Material.prototype.init = function(data) {
    throw Error("Not Implemented in base class");
  };
  return{Material:Material}
}());
pc.extend(pc, function() {
  var BasicMaterial = function() {
    this.color = new pc.Color(1, 1, 1, 1);
    this.colorMap = null;
    this.update()
  };
  BasicMaterial = pc.inherits(BasicMaterial, pc.Material);
  pc.extend(BasicMaterial.prototype, {clone:function() {
    var clone = new pc.BasicMaterial;
    Material.prototype._cloneInternal.call(this, clone);
    clone.color.copy(this.color);
    clone.colorMap = this.colorMap;
    clone.update();
    return clone
  }, update:function() {
    this.clearParameters();
    this.setParameter("uColor", this.color.data);
    if(this.colorMap) {
      this.setParameter("texture_diffuseMap", this.colorMap)
    }
  }, updateShader:function(device) {
    var options = {skin:!!this.meshInstances[0].skinInstance};
    var library = device.getProgramLibrary();
    this.shader = library.getProgram("basic", options)
  }});
  return{BasicMaterial:BasicMaterial}
}());
pc.extend(pc, function() {
  var DepthMaterial = function() {
  };
  DepthMaterial = pc.inherits(DepthMaterial, pc.Material);
  pc.extend(DepthMaterial.prototype, {clone:function() {
    var clone = new pc.DepthMaterial;
    Material.prototype._cloneInternal.call(this, clone);
    clone.update();
    return clone
  }, update:function() {
  }, updateShader:function(device) {
    var options = {skin:!!this.meshInstances[0].skinInstance};
    var library = device.getProgramLibrary();
    this.shader = library.getProgram("depth", options)
  }});
  return{DepthMaterial:DepthMaterial}
}());
pc.extend(pc, function() {
  var _tempTiling = new pc.Vec3;
  var _tempOffset = new pc.Vec3;
  var PhongMaterial = function() {
    this.reset();
    this.update()
  };
  var _createTexture = function(param) {
    if(param.data) {
      if(param.data instanceof pc.Texture) {
        return param.data
      }else {
        throw Error("PhongMaterial.init() expects textures to already be created");
      }
    }else {
      return null
    }
  };
  var _createVec2 = function(param) {
    return new pc.Vec2(param.data[0], param.data[1])
  };
  var _createVec3 = function(param) {
    return new pc.Vec3(param.data[0], param.data[1], param.data[2])
  };
  var _createRgb = function(param) {
    return new pc.Color(param.data[0], param.data[1], param.data[2])
  };
  var _beginProperties = function(obj) {
    if(!pc._matSerialProps) {
      obj._tempProps = [];
      for(var p in obj) {
        if(obj.hasOwnProperty(p)) {
          obj._tempProps[p] = true
        }
      }
    }
  };
  var _endProperties = function(obj) {
    if(!pc._matSerialProps) {
      pc._matSerialProps = [];
      for(var p in obj) {
        if(obj.hasOwnProperty(p) && !obj._tempProps[p]) {
          pc._matSerialProps.push(p)
        }
      }
    }
  };
  var _defineTex2D = function(obj, name, uv, channels) {
    obj[name + "Map"] = null;
    obj[name + "MapTiling"] = new pc.Vec2(1, 1);
    obj[name + "MapOffset"] = new pc.Vec2(0, 0);
    obj[name + "MapTransform"] = null;
    obj[name + "MapUv"] = uv;
    if(channels > 0) {
      obj[name + "MapChannel"] = channels > 1 ? "rgb" : "g"
    }
    if(!pc._matTex2D) {
      pc._matTex2D = []
    }
    pc._matTex2D[name] = channels
  };
  PhongMaterial = pc.inherits(PhongMaterial, pc.Material);
  pc.extend(PhongMaterial.prototype, {reset:function() {
    _beginProperties(this);
    this.ambient = new pc.Color(0.7, 0.7, 0.7);
    this.diffuse = new pc.Color(1, 1, 1);
    this.specular = new pc.Color(0, 0, 0);
    this.shininess = 25;
    this.emissive = new pc.Color(0, 0, 0);
    this.opacity = 1;
    this.blendType = pc.BLEND_NONE;
    this.bumpiness = 1;
    this.heightMapFactor = 1;
    _defineTex2D(this, "diffuse", 0, 3);
    _defineTex2D(this, "specular", 0, 3);
    _defineTex2D(this, "emissive", 0, 3);
    _defineTex2D(this, "normal", 0, -1);
    _defineTex2D(this, "gloss", 0, 1);
    _defineTex2D(this, "opacity", 0, 1);
    _defineTex2D(this, "height", 0, 1);
    _defineTex2D(this, "ao", 0, 1);
    _defineTex2D(this, "light", 1, 3);
    this.cubeMap = null;
    this.prefilteredCubeMap128 = null;
    this.prefilteredCubeMap64 = null;
    this.prefilteredCubeMap32 = null;
    this.prefilteredCubeMap16 = null;
    this.prefilteredCubeMap8 = null;
    this.prefilteredCubeMap4 = null;
    this.sphereMap = null;
    this.reflectivity = 1;
    this.aoUvSet = 0;
    this.blendMapsWithColors = true;
    this.specularAntialias = false;
    this.conserveEnergy = true;
    this.occludeSpecular = true;
    this.shadingModel = pc.SPECULAR_PHONG;
    this.fresnelModel = pc.FRESNEL_NONE;
    this.fresnelFactor = 0;
    this.ambientTint = false;
    this.diffuseMapTint = false;
    this.specularMapTint = false;
    this.emissiveMapTint = false;
    this.emissiveIntensity = 1;
    _endProperties(this);
    this.ambientUniform = new Float32Array(3);
    this.diffuseUniform = new Float32Array(3);
    this.specularUniform = new Float32Array(3);
    this.emissiveUniform = new Float32Array(3)
  }, clone:function() {
    var clone = new pc.PhongMaterial;
    pc.Material.prototype._cloneInternal.call(this, clone);
    var pname;
    for(var i = 0;i < pc._matSerialProps.length;i++) {
      pname = pc._matSerialProps[i];
      if(this[pname] !== undefined) {
        if(this[pname] && this[pname].copy) {
          clone[pname].copy(this[pname])
        }else {
          clone[pname] = this[pname]
        }
      }
    }
    clone.update();
    return clone
  }, init:function(data) {
    this.reset();
    this.name = data.name;
    for(var i = 0;i < data.parameters.length;i++) {
      var param = data.parameters[i];
      if(param.type === "vec3") {
        this[param.name] = _createRgb(param)
      }else {
        if(param.type === "vec2") {
          this[param.name] = _createVec2(param)
        }else {
          if(param.type === "texture") {
            this[param.name] = _createTexture(param)
          }else {
            if(param.name === "bumpMapFactor") {
              this.bumpiness = param.data
            }else {
              this[param.name] = param.data
            }
          }
        }
      }
    }
    this.update()
  }, _updateMapTransform:function(transform, tiling, offset) {
    transform = transform || new pc.Vec4;
    transform.set(tiling.x, tiling.y, offset.x, offset.y);
    if(transform.x == 1 && transform.y == 1 && transform.z == 0 && transform.w == 0) {
      return null
    }
    return transform
  }, _collectLights:function(lType, lights, lightsSorted) {
    for(var i = 0;i < lights.length;i++) {
      if(lights[i].getEnabled()) {
        if(lights[i].getType() == lType) {
          lightsSorted.push(lights[i])
        }
      }
    }
  }, _updateMap:function(p) {
    var mname = p + "Map";
    if(this[mname]) {
      this.setParameter("texture_" + mname, this[mname]);
      var tname = mname + "Transform";
      this[tname] = this._updateMapTransform(this[tname], this[mname + "Tiling"], this[mname + "Offset"]);
      if(this[tname]) {
        this.setParameter("texture_" + tname, this[tname].data)
      }
    }
  }, update:function() {
    this.clearParameters();
    this.ambientUniform[0] = this.ambient.r;
    this.ambientUniform[1] = this.ambient.g;
    this.ambientUniform[2] = this.ambient.b;
    this.setParameter("material_ambient", this.ambientUniform);
    if(!this.diffuseMap || this.diffuseMapTint) {
      this.diffuseUniform[0] = this.diffuse.r;
      this.diffuseUniform[1] = this.diffuse.g;
      this.diffuseUniform[2] = this.diffuse.b;
      this.setParameter("material_diffuse", this.diffuseUniform)
    }
    if(!this.specularMap || this.specularMapTint) {
      this.specularUniform[0] = this.specular.r;
      this.specularUniform[1] = this.specular.g;
      this.specularUniform[2] = this.specular.b;
      this.setParameter("material_specular", this.specularUniform)
    }
    if(this.shadingModel === pc.SPECULAR_PHONG) {
      this.setParameter("material_shininess", Math.pow(2, this.shininess * 0.01 * 11))
    }else {
      this.setParameter("material_shininess", this.shininess * 0.01)
    }
    if(!this.emissiveMap || this.emissiveMapTint) {
      this.emissiveUniform[0] = this.emissive.r * this.emissiveIntensity;
      this.emissiveUniform[1] = this.emissive.g * this.emissiveIntensity;
      this.emissiveUniform[2] = this.emissive.b * this.emissiveIntensity;
      this.setParameter("material_emissive", this.emissiveUniform)
    }
    this.setParameter("material_opacity", this.opacity);
    var i = 0;
    this._updateMap("diffuse");
    this._updateMap("specular");
    this._updateMap("gloss");
    this._updateMap("emissive");
    this._updateMap("opacity");
    this._updateMap("normal");
    this._updateMap("height");
    this._updateMap("light");
    this._updateMap("ao");
    if(this.normalMap) {
      this.setParameter("material_bumpMapFactor", this.bumpiness)
    }
    if(this.heightMap) {
      this.setParameter("material_heightMapFactor", this.heightMapFactor * 0.025)
    }
    if(this.cubeMap) {
      this.setParameter("texture_cubeMap", this.cubeMap);
      this.setParameter("material_cubemapSize", this.cubeMap.width)
    }
    if(this.prefilteredCubeMap128) {
      this.setParameter("texture_prefilteredCubeMap128", this.prefilteredCubeMap128);
      this.setParameter("material_cubemapSize", this.prefilteredCubeMap128.width)
    }
    if(this.prefilteredCubeMap64) {
      this.setParameter("texture_prefilteredCubeMap64", this.prefilteredCubeMap64)
    }
    if(this.prefilteredCubeMap32) {
      this.setParameter("texture_prefilteredCubeMap32", this.prefilteredCubeMap32)
    }
    if(this.prefilteredCubeMap16) {
      this.setParameter("texture_prefilteredCubeMap16", this.prefilteredCubeMap16)
    }
    if(this.prefilteredCubeMap8) {
      this.setParameter("texture_prefilteredCubeMap8", this.prefilteredCubeMap8)
    }
    if(this.prefilteredCubeMap4) {
      this.setParameter("texture_prefilteredCubeMap4", this.prefilteredCubeMap4)
    }
    if(this.sphereMap) {
      this.setParameter("texture_sphereMap", this.sphereMap)
    }
    this.setParameter("material_reflectionFactor", this.reflectivity);
    if(this.fresnelFactor > 0) {
      this.setParameter("material_fresnelFactor", this.fresnelFactor)
    }
    this.shader = null
  }, _getMapTransformID:function(xform, uv) {
    if(!xform) {
      return 0
    }
    if(!this._mapXForms[uv]) {
      this._mapXForms[uv] = []
    }
    var i, j, same;
    for(i = 0;i < this._mapXForms[uv].length;i++) {
      same = true;
      for(j = 0;j < xform.data.length;j++) {
        if(this._mapXForms[uv][i][j] != xform.data[j]) {
          same = false;
          break
        }
      }
      if(same) {
        return i + 1
      }
    }
    var newID = this._mapXForms[uv].length;
    this._mapXForms[uv][newID] = [];
    for(j = 0;j < xform.data.length;j++) {
      this._mapXForms[uv][newID][j] = xform.data[j]
    }
    return newID + 1
  }, updateShader:function(device, scene) {
    var i;
    var lights = scene._lights;
    this._mapXForms = [];
    var prefilteredCubeMap128 = this.prefilteredCubeMap128 ? this.prefilteredCubeMap128 : scene._prefilteredCubeMap128;
    var prefilteredCubeMap64 = this.prefilteredCubeMap64 ? this.prefilteredCubeMap64 : scene._prefilteredCubeMap64;
    var prefilteredCubeMap32 = this.prefilteredCubeMap32 ? this.prefilteredCubeMap32 : scene._prefilteredCubeMap32;
    var prefilteredCubeMap16 = this.prefilteredCubeMap16 ? this.prefilteredCubeMap16 : scene._prefilteredCubeMap16;
    var prefilteredCubeMap8 = this.prefilteredCubeMap8 ? this.prefilteredCubeMap8 : scene._prefilteredCubeMap8;
    var prefilteredCubeMap4 = this.prefilteredCubeMap4 ? this.prefilteredCubeMap4 : scene._prefilteredCubeMap4;
    var prefilteredCubeMap = prefilteredCubeMap128 && prefilteredCubeMap64 && prefilteredCubeMap32 && prefilteredCubeMap16 && prefilteredCubeMap8 && prefilteredCubeMap4;
    var useTexCubeLod = device.extTextureLod && device.samplerCount < 16;
    var mips = [prefilteredCubeMap128, prefilteredCubeMap64, prefilteredCubeMap32, prefilteredCubeMap16, prefilteredCubeMap8, prefilteredCubeMap4];
    if(prefilteredCubeMap && useTexCubeLod) {
      if(!prefilteredCubeMap128._prefilteredMips) {
        prefilteredCubeMap128.autoMipmap = false;
        var mip, face;
        for(mip = 1;mip < 6;mip++) {
          prefilteredCubeMap128._levels[mip] = mips[mip]._levels[0]
        }
        prefilteredCubeMap128.upload();
        prefilteredCubeMap128.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
        prefilteredCubeMap128.magFilter = pc.FILTER_LINEAR;
        prefilteredCubeMap128._prefilteredMips = true
      }
    }
    if(prefilteredCubeMap128) {
      if(prefilteredCubeMap128 === scene._prefilteredCubeMap128) {
        this.setParameter("texture_prefilteredCubeMap128", scene._prefilteredCubeMap128);
        this.setParameter("texture_prefilteredCubeMap64", scene._prefilteredCubeMap64);
        this.setParameter("texture_prefilteredCubeMap32", scene._prefilteredCubeMap32);
        this.setParameter("texture_prefilteredCubeMap16", scene._prefilteredCubeMap16);
        this.setParameter("texture_prefilteredCubeMap8", scene._prefilteredCubeMap8);
        this.setParameter("texture_prefilteredCubeMap4", scene._prefilteredCubeMap4);
        this.setParameter("material_cubemapSize", scene._prefilteredCubeMap128.width)
      }
    }
    if(prefilteredCubeMap) {
      for(i = 0;i < mips.length;i++) {
        if(mips[i].hdr) {
          mips[i].rgbm = mips[i].fixCubemapSeams = true
        }
      }
    }
    var options = {fog:scene.fog, gamma:scene.gammaCorrection, toneMap:scene.toneMapping, blendMapsWithColors:this.blendMapsWithColors, skin:!!this.meshInstances[0].skinInstance, modulateAmbient:this.ambientTint, diffuseTint:(this.diffuse.r != 1 || this.diffuse.g != 1 || this.diffuse.b != 1) && this.diffuseMapTint, specularTint:(this.specular.r != 1 || this.specular.g != 1 || this.specular.b != 1) && this.specularMapTint, glossTint:true, emissiveTint:(this.emissive.r != 1 || this.emissive.g != 1 || 
    this.emissive.b != 1 || this.emissiveIntensity != 1) && this.emissiveMapTint, opacityTint:this.opacity != 1, needsNormalFloat:true, sphereMap:!!this.sphereMap, cubeMap:!!this.cubeMap || prefilteredCubeMap, useSpecular:!!this.specularMap || !(this.specular.r === 0 && this.specular.g === 0 && this.specular.b === 0) || !!this.sphereMap || !!this.cubeMap || prefilteredCubeMap, rgbmReflection:prefilteredCubeMap ? prefilteredCubeMap128.rgbm : this.cubeMap ? this.cubeMap.rgbm : this.sphereMap ? this.sphereMap.rgbm : 
    false, hdrReflection:prefilteredCubeMap ? prefilteredCubeMap128.rgbm || prefilteredCubeMap128.format === pc.PIXELFORMAT_RGBA32F : this.cubeMap ? this.cubeMap.rgbm || this.cubeMap.format === pc.PIXELFORMAT_RGBA32F : this.sphereMap ? this.sphereMap.rgbm || this.sphereMap.format === pc.PIXELFORMAT_RGBA32F : false, fixSeams:prefilteredCubeMap ? prefilteredCubeMap128.fixCubemapSeams : this.cubeMap ? this.cubeMap.fixCubemapSeams : false, prefilteredCubemap:prefilteredCubeMap, specularAA:this.specularAntialias, 
    conserveEnergy:this.conserveEnergy, occludeSpecular:this.occludeSpecular, shadingModel:this.shadingModel, fresnelModel:this.fresnelModel, packedNormal:this.normalMap ? this.normalMap._compressed : false, useTexCubeLod:useTexCubeLod};
    for(var p in pc._matTex2D) {
      var mname = p + "Map";
      options[mname] = !!this[mname];
      if(options[mname]) {
        var tname = mname + "Transform";
        var cname = mname + "Channel";
        var uname = mname + "Uv";
        options[tname] = this._getMapTransformID(this[tname], this[uname]);
        if(this[uname] > 0) {
          console.log(options[tname])
        }
        options[cname] = this[cname];
        options[uname] = this[uname]
      }
    }
    options.aoMapUv = options.aoMapUv || this.aoUvSet;
    this._mapXForms = null;
    var lightsSorted = [];
    this._collectLights(pc.LIGHTTYPE_DIRECTIONAL, lights, lightsSorted);
    this._collectLights(pc.LIGHTTYPE_POINT, lights, lightsSorted);
    this._collectLights(pc.LIGHTTYPE_SPOT, lights, lightsSorted);
    options.lights = lightsSorted;
    if(scene.gammaCorrection) {
      for(i = 0;i < 3;i++) {
        this.ambientUniform[i] = Math.pow(this.ambient.data[i], 2.2);
        this.diffuseUniform[i] = Math.pow(this.diffuse.data[i], 2.2);
        this.specularUniform[i] = Math.pow(this.specular.data[i], 2.2);
        this.emissiveUniform[i] = Math.pow(this.emissive.data[i], 2.2) * this.emissiveIntensity
      }
    }
    var library = device.getProgramLibrary();
    this.shader = library.getProgram("phong", options)
  }});
  return{PhongMaterial:PhongMaterial}
}());
pc.extend(pc, function() {
  var PickMaterial = function() {
    this.color = new pc.Color(1, 1, 1, 1);
    this.colorMap = null;
    this.update()
  };
  PickMaterial = pc.inherits(PickMaterial, pc.Material);
  pc.extend(PickMaterial.prototype, {clone:function() {
    var clone = new pc.PickMaterial;
    Material.prototype._cloneInternal.call(this, clone);
    clone.color.copy(this.color);
    clone.update();
    return clone
  }, update:function() {
    this.clearParameters();
    this.setParameter("uColor", this.color.data)
  }, updateShader:function(device) {
    var options = {skin:!!this.meshInstances[0].skinInstance};
    var library = device.getProgramLibrary();
    this.shader = library.getProgram("pick", options)
  }});
  return{PickMaterial:PickMaterial}
}());
pc.extend(pc, function() {
  function getKey(layer, blendType, isCommand, materialId) {
    return(layer & 7) << 28 | (blendType & 3) << 26 | (isCommand ? 1 : 0) << 25 | (materialId & 33554431) << 0
  }
  var Mesh = function() {
    this.vertexBuffer = null;
    this.indexBuffer = [null];
    this.primitive = [{type:0, base:0, count:0}];
    this.skin = null;
    this.aabb = new pc.shape.Aabb
  };
  var MeshInstance = function MeshInstance(node, mesh, material) {
    this.node = node;
    this.mesh = mesh;
    this.material = material;
    this.layer = pc.LAYER_WORLD;
    this.renderStyle = pc.RENDERSTYLE_SOLID;
    this.castShadow = false;
    this.receiveShadow = true;
    this.drawToDepth = true;
    this.key = 0;
    this.updateKey();
    this.skinInstance = null;
    this.aabb = new pc.shape.Aabb;
    this.normalMatrix = new pc.Mat3
  };
  Object.defineProperty(MeshInstance.prototype, "aabb", {get:function() {
    this._aabb.setFromTransformedAabb(this.mesh.aabb, this.node.worldTransform);
    return this._aabb
  }, set:function(aabb) {
    this._aabb = aabb
  }});
  Object.defineProperty(MeshInstance.prototype, "material", {get:function() {
    return this._material
  }, set:function(material) {
    if(this._material) {
      var meshInstances = this._material.meshInstances;
      var index = meshInstances.indexOf(this);
      if(index !== -1) {
        meshInstances.splice(index, 1)
      }
    }
    this._material = material;
    this._material.meshInstances.push(this);
    this.updateKey()
  }});
  Object.defineProperty(MeshInstance.prototype, "layer", {get:function() {
    return this._layer
  }, set:function(layer) {
    this._layer = layer;
    this.updateKey()
  }});
  pc.extend(MeshInstance.prototype, {syncAabb:function() {
  }, updateKey:function() {
    var material = this.material;
    this.key = getKey(this.layer, material.blendType, false, material.id)
  }});
  var Command = function(layer, blendType, command) {
    this.key = getKey(layer, blendType, true, 0);
    this.command = command
  };
  return{Command:Command, Mesh:Mesh, MeshInstance:MeshInstance}
}());
pc.extend(pc, function() {
  var Skin = function(graphicsDevice, ibp, boneNames) {
    this.device = graphicsDevice;
    this.inverseBindPose = ibp;
    this.boneNames = boneNames
  };
  var SkinInstance = function(skin) {
    this.skin = skin;
    this.bones = [];
    var numBones = skin.inverseBindPose.length;
    var device = skin.device;
    if(device.supportsBoneTextures) {
      var size;
      if(numBones > 256) {
        size = 64
      }else {
        if(numBones > 64) {
          size = 32
        }else {
          if(numBones > 16) {
            size = 16
          }else {
            size = 8
          }
        }
      }
      this.matrixPalette = new Float32Array(size * size * 4);
      this.boneTexture = new pc.Texture(device, {width:size, height:size, format:pc.PIXELFORMAT_RGBA32F, autoMipmap:false});
      this.boneTexture.minFilter = pc.FILTER_NEAREST;
      this.boneTexture.magFilter = pc.FILTER_NEAREST;
      this.matrixPalette = this.boneTexture.lock()
    }else {
      this.matrixPalette = new Float32Array(numBones * 16)
    }
  };
  SkinInstance.prototype = {updateMatrixPalette:function() {
    var paletteEntry = new pc.Mat4;
    return function() {
      var pe = paletteEntry.data;
      var mp = this.matrixPalette;
      var base;
      for(var i = this.bones.length - 1;i >= 0;i--) {
        paletteEntry.mul2(this.bones[i].worldTransform, this.skin.inverseBindPose[i]);
        base = i * 16;
        mp[base] = pe[0];
        mp[base + 1] = pe[1];
        mp[base + 2] = pe[2];
        mp[base + 3] = pe[3];
        mp[base + 4] = pe[4];
        mp[base + 5] = pe[5];
        mp[base + 6] = pe[6];
        mp[base + 7] = pe[7];
        mp[base + 8] = pe[8];
        mp[base + 9] = pe[9];
        mp[base + 10] = pe[10];
        mp[base + 11] = pe[11];
        mp[base + 12] = pe[12];
        mp[base + 13] = pe[13];
        mp[base + 14] = pe[14];
        mp[base + 15] = pe[15]
      }
      if(this.skin.device.supportsBoneTextures) {
        this.boneTexture.lock();
        this.boneTexture.unlock()
      }
    }
  }()};
  return{Skin:Skin, SkinInstance:SkinInstance}
}());
pc.extend(pc, function() {
  function PartitionedVertex() {
    this.index = 0;
    this.boneIndices = [0, 0, 0, 0]
  }
  function SkinPartition() {
    this.partition = 0;
    this.vertexStart = 0;
    this.vertexCount = 0;
    this.indexStart = 0;
    this.indexCount = 0;
    this.boneIndices = [];
    this.vertices = [];
    this.indices = [];
    this.indexMap = {}
  }
  SkinPartition.prototype = {addVertex:function(vertex, idx, vertexArray) {
    var remappedIndex = -1;
    if(this.indexMap[idx] !== undefined) {
      remappedIndex = this.indexMap[idx];
      this.indices.push(remappedIndex)
    }else {
      for(var influence = 0;influence < 4;influence++) {
        if(vertexArray.blendWeight.data[idx * 4 + influence] === 0) {
          continue
        }
        var originalBoneIndex = vertexArray.blendIndices.data[vertex.index * 4 + influence];
        vertex.boneIndices[influence] = this.getBoneRemap(originalBoneIndex)
      }
      remappedIndex = this.vertices.length;
      this.indices.push(remappedIndex);
      this.vertices.push(vertex);
      this.indexMap[idx] = remappedIndex
    }
  }, addPrimitive:function(vertices, vertexIndices, vertexArray, boneLimit) {
    var i, j;
    var bonesToAdd = [];
    var bonesToAddCount = 0;
    var vertexCount = vertices.length;
    for(i = 0;i < vertexCount;i++) {
      var vertex = vertices[i];
      var idx = vertex.index;
      for(var influence = 0;influence < 4;influence++) {
        if(vertexArray.blendWeight.data[idx * 4 + influence] > 0) {
          var boneIndex = vertexArray.blendIndices.data[idx * 4 + influence];
          var needToAdd = true;
          for(j = 0;j < bonesToAddCount;j++) {
            if(bonesToAdd[j] == boneIndex) {
              needToAdd = false;
              break
            }
          }
          if(needToAdd) {
            bonesToAdd[bonesToAddCount] = boneIndex;
            var boneRemap = this.getBoneRemap(boneIndex);
            bonesToAddCount += boneRemap === -1 ? 1 : 0
          }
        }
      }
    }
    if(this.boneIndices.length + bonesToAddCount > boneLimit) {
      return false
    }
    for(i = 0;i < bonesToAddCount;i++) {
      this.boneIndices.push(bonesToAdd[i])
    }
    for(i = 0;i < vertexCount;i++) {
      this.addVertex(vertices[i], vertexIndices[i], vertexArray)
    }
    return true
  }, getBoneRemap:function(boneIndex) {
    for(var i = 0;i < this.boneIndices.length;i++) {
      if(this.boneIndices[i] === boneIndex) {
        return i
      }
    }
    return-1
  }};
  function indicesToReferences(model) {
    var i;
    var vertices = model.vertices;
    var skins = model.skins;
    var meshes = model.meshes;
    var meshInstances = model.meshInstances;
    for(i = 0;i < meshes.length;i++) {
      meshes[i].vertices = vertices[meshes[i].vertices];
      if(meshes[i].skin !== undefined) {
        meshes[i].skin = skins[meshes[i].skin]
      }
    }
    for(i = 0;i < meshInstances.length;i++) {
      meshInstances[i].mesh = meshes[meshInstances[i].mesh]
    }
  }
  function referencesToIndices(model) {
    var i;
    var vertices = model.vertices;
    var skins = model.skins;
    var meshes = model.meshes;
    var meshInstances = model.meshInstances;
    for(i = 0;i < meshes.length;i++) {
      meshes[i].vertices = vertices.indexOf(meshes[i].vertices);
      if(meshes[i].skin !== undefined) {
        meshes[i].skin = skins.indexOf(meshes[i].skin)
      }
    }
    for(i = 0;i < meshInstances.length;i++) {
      meshInstances[i].mesh = meshes.indexOf(meshInstances[i].mesh)
    }
  }
  function partitionSkin(model, materialMappings, boneLimit) {
    var i, j, k;
    indicesToReferences(model);
    var vertexArrays = model.vertices;
    var skins = model.skins;
    var meshes = model.meshes;
    var meshInstances = model.meshInstances;
    for(i = skins.length - 1;i >= 0;i--) {
      if(skins[i].boneNames.length > boneLimit) {
        var skin = skins.splice(i, 1)[0];
        var meshesToSplit = [];
        for(j = 0;j < meshes.length;j++) {
          if(meshes[j].skin === skin) {
            meshesToSplit.push(meshes[j])
          }
        }
        for(j = 0;j < meshesToSplit.length;j++) {
          var index = meshes.indexOf(meshesToSplit[j]);
          if(index !== -1) {
            meshes.splice(index, 1)
          }
        }
        if(meshesToSplit.length === 0) {
          throw new Error("partitionSkin: There should be at least one mesh that references a skin");
        }
        var vertexArray = meshesToSplit[0].vertices;
        for(j = 1;j < meshesToSplit.length;j++) {
          if(meshesToSplit[j].vertices !== vertexArray) {
            throw new Error("partitionSkin: All meshes that share a skin should also share the same vertex buffer");
          }
        }
        var partition;
        var partitions = [];
        var getVertex = function(idx) {
          var vert = new PartitionedVertex;
          vert.index = idx;
          return vert
        };
        var primitiveVertices = [];
        var primitiveIndices = [];
        var basePartition = 0;
        for(j = 0;j < meshesToSplit.length;j++) {
          var mesh = meshesToSplit[j];
          var indices = mesh.indices;
          for(var iIndex = mesh.base;iIndex < mesh.base + mesh.count;) {
            var index;
            index = indices[iIndex++];
            primitiveVertices[0] = getVertex(index);
            primitiveIndices[0] = index;
            index = indices[iIndex++];
            primitiveVertices[1] = getVertex(index);
            primitiveIndices[1] = index;
            index = indices[iIndex++];
            primitiveVertices[2] = getVertex(index);
            primitiveIndices[2] = index;
            var added = false;
            for(var iBonePartition = basePartition;iBonePartition < partitions.length;iBonePartition++) {
              partition = partitions[iBonePartition];
              if(partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit)) {
                added = true;
                break
              }
            }
            if(!added) {
              partition = new SkinPartition;
              partition.originalMesh = mesh;
              partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit);
              partitions.push(partition)
            }
          }
          basePartition = partitions.length
        }
        var partitionedVertices = [];
        var partitionedIndices = [];
        for(j = 0;j < partitions.length;j++) {
          partition = partitions[j];
          if(partition.vertices.length && partition.indices.length) {
            var vertexStart = partitionedVertices.length;
            var vertexCount = partition.vertices.length;
            var indexStart = partitionedIndices.length;
            var indexCount = partition.indices.length;
            partition.partition = j;
            partition.vertexStart = vertexStart;
            partition.vertexCount = vertexCount;
            partition.indexStart = indexStart;
            partition.indexCount = indexCount;
            var iSour;
            var iDest;
            iSour = 0;
            iDest = vertexStart;
            while(iSour < vertexCount) {
              partitionedVertices[iDest++] = partition.vertices[iSour++]
            }
            iSour = 0;
            iDest = indexStart;
            while(iSour < indexCount) {
              partitionedIndices[iDest++] = partition.indices[iSour++] + vertexStart
            }
          }
        }
        var splitSkins = [];
        for(j = 0;j < partitions.length;j++) {
          partition = partitions[j];
          var ibp = [];
          var boneNames = [];
          for(k = 0;k < partition.boneIndices.length;k++) {
            ibp.push(skin.inverseBindMatrices[partition.boneIndices[k]]);
            boneNames.push(skin.boneNames[partition.boneIndices[k]])
          }
          var splitSkin = {inverseBindMatrices:ibp, boneNames:boneNames};
          splitSkins.push(splitSkin);
          skins.push(splitSkin)
        }
        var attrib, attribName;
        var splitVertexArray = {};
        for(attribName in vertexArray) {
          splitVertexArray[attribName] = {components:vertexArray[attribName].components, data:[], type:vertexArray[attribName].type}
        }
        for(attribName in vertexArray) {
          if(attribName === "blendIndices") {
            var dstBoneIndices = splitVertexArray[attribName].data;
            for(j = 0;j < partitionedVertices.length;j++) {
              var srcBoneIndices = partitionedVertices[j].boneIndices;
              dstBoneIndices.push(srcBoneIndices[0], srcBoneIndices[1], srcBoneIndices[2], srcBoneIndices[3])
            }
          }else {
            attrib = vertexArray[attribName];
            data = attrib.data;
            components = attrib.components;
            for(j = 0;j < partitionedVertices.length;j++) {
              var index = partitionedVertices[j].index;
              for(k = 0;k < components;k++) {
                splitVertexArray[attribName].data.push(data[index * components + k])
              }
            }
          }
        }
        vertexArrays[vertexArrays.indexOf(vertexArray)] = splitVertexArray;
        var base = 0;
        for(j = 0;j < partitions.length;j++) {
          partition = partitions[j];
          var mesh = {aabb:{min:[0, 0, 0], max:[0, 0, 0]}, vertices:splitVertexArray, skin:splitSkins[j], indices:partitionedIndices.splice(0, partition.indexCount), type:"triangles", base:0, count:partition.indexCount};
          meshes.push(mesh);
          for(k = meshInstances.length - 1;k >= 0;k--) {
            if(meshInstances[k].mesh === partition.originalMesh) {
              meshInstances.push({mesh:mesh, node:meshInstances[k].node});
              if(materialMappings) {
                materialMappings.push({material:materialMappings[k].material, path:materialMappings[k].path})
              }
            }
          }
          base += partition.indexCount
        }
        for(j = 0;j < partitions.length;j++) {
          partition = partitions[j];
          for(k = meshInstances.length - 1;k >= 0;k--) {
            if(meshInstances[k].mesh === partition.originalMesh) {
              meshInstances.splice(k, 1);
              if(materialMappings) {
                materialMappings.splice(k, 1)
              }
            }
          }
        }
      }
    }
    referencesToIndices(model)
  }
  return{partitionSkin:partitionSkin}
}());
pc.extend(pc, function() {
  var Model = function Model() {
    this.graph = null;
    this.meshInstances = [];
    this.skinInstances = [];
    this.cameras = [];
    this.lights = []
  };
  Model.prototype = {getGraph:function() {
    return this.graph
  }, setGraph:function(graph) {
    this.graph = graph
  }, getCameras:function() {
    return this.cameras
  }, setCameras:function(cameras) {
    this.cameras = cameras
  }, getLights:function() {
    return this.lights
  }, setLights:function(lights) {
    this.lights = lights
  }, getMaterials:function() {
    var i;
    var materials = [];
    for(i = 0;i < this.meshInstances.length;i++) {
      var meshInstance = this.meshInstances[i];
      if(materials.indexOf(meshInstance.material) === -1) {
        materials.push(meshInstance.material)
      }
    }
    return materials
  }, clone:function() {
    var i;
    var srcNodes = [];
    var cloneNodes = [];
    var _duplicate = function(node) {
      var newNode = node.clone();
      srcNodes.push(node);
      cloneNodes.push(newNode);
      var children = node.getChildren();
      for(var i = 0;i < children.length;i++) {
        newNode.addChild(_duplicate(children[i]))
      }
      return newNode
    };
    var cloneGraph = _duplicate(this.graph);
    var cloneMeshInstances = [];
    var cloneSkinInstances = [];
    for(i = 0;i < this.skinInstances.length;i++) {
      var skin = this.skinInstances[i].skin;
      var cloneSkinInstance = new pc.SkinInstance(skin);
      var bones = [];
      for(j = 0;j < skin.boneNames.length;j++) {
        var boneName = skin.boneNames[j];
        var bone = cloneGraph.findByName(boneName);
        bones.push(bone)
      }
      cloneSkinInstance.bones = bones;
      cloneSkinInstances.push(cloneSkinInstance)
    }
    for(i = 0;i < this.meshInstances.length;i++) {
      var meshInstance = this.meshInstances[i];
      var nodeIndex = srcNodes.indexOf(meshInstance.node);
      var cloneMeshInstance = new pc.MeshInstance(cloneNodes[nodeIndex], meshInstance.mesh, meshInstance.material);
      if(meshInstance.skinInstance) {
        var skinInstanceIndex = this.skinInstances.indexOf(meshInstance.skinInstance);
        cloneMeshInstance.skinInstance = cloneSkinInstances[skinInstanceIndex]
      }
      cloneMeshInstances.push(cloneMeshInstance)
    }
    var clone = new pc.Model;
    clone.graph = cloneGraph;
    clone.meshInstances = cloneMeshInstances;
    clone.skinInstances = cloneSkinInstances;
    clone.getGraph().syncHierarchy();
    return clone
  }, generateWireframe:function() {
    var i, j, k;
    var i1, i2;
    var mesh, base, count, indexBuffer, wireBuffer;
    var srcIndices, dstIndices;
    var meshes = [];
    for(i = 0;i < this.meshInstances.length;i++) {
      mesh = this.meshInstances[i].mesh;
      if(meshes.indexOf(mesh) === -1) {
        meshes.push(mesh)
      }
    }
    var offsets = [[0, 1], [1, 2], [2, 0]];
    for(i = 0;i < meshes.length;i++) {
      mesh = meshes[i];
      base = mesh.primitive[pc.RENDERSTYLE_SOLID].base;
      count = mesh.primitive[pc.RENDERSTYLE_SOLID].count;
      indexBuffer = mesh.indexBuffer[pc.RENDERSTYLE_SOLID];
      srcIndices = new Uint16Array(indexBuffer.lock());
      var uniqueLineIndices = {};
      var lines = [];
      for(j = base;j < base + count;j += 3) {
        for(k = 0;k < 3;k++) {
          i1 = srcIndices[j + offsets[k][0]];
          i2 = srcIndices[j + offsets[k][1]];
          var line = i1 > i2 ? i2 << 16 | i1 : i1 << 16 | i2;
          if(uniqueLineIndices[line] === undefined) {
            uniqueLineIndices[line] = 0;
            lines.push(i1, i2)
          }
        }
      }
      indexBuffer.unlock();
      wireBuffer = new pc.IndexBuffer(indexBuffer.device, pc.INDEXFORMAT_UINT16, lines.length);
      dstIndices = new Uint16Array(wireBuffer.lock());
      dstIndices.set(lines);
      wireBuffer.unlock();
      mesh.primitive[pc.RENDERSTYLE_WIREFRAME] = {type:pc.PRIMITIVE_LINES, base:0, count:lines.length, indexed:true};
      mesh.indexBuffer[pc.RENDERSTYLE_WIREFRAME] = wireBuffer
    }
  }};
  return{Model:Model}
}());
pc.extend(pc, function() {
  var particleVerts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  var _createTexture = function(device, width, height, pixelData, format, mult8Bit) {
    if(!format) {
      format = pc.PIXELFORMAT_RGBA32F
    }
    var texture = new pc.Texture(device, {width:width, height:height, format:format, cubemap:false, autoMipmap:false});
    texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.minFilter = pc.FILTER_NEAREST;
    texture.magFilter = pc.FILTER_NEAREST;
    var pixels = texture.lock();
    if(format == pc.PIXELFORMAT_R8_G8_B8_A8) {
      texture.minFilter = pc.FILTER_LINEAR;
      texture.magFilter = pc.FILTER_LINEAR;
      var temp = new Uint8Array(pixelData.length);
      for(var i = 0;i < pixelData.length;i++) {
        temp[i] = pixelData[i] * mult8Bit * 255
      }
      pixelData = temp
    }
    pixels.set(pixelData);
    texture.unlock();
    return texture
  };
  function saturate(x) {
    return Math.max(Math.min(x, 1), 0)
  }
  function glMod(x, y) {
    return x - y * Math.floor(x / y)
  }
  function tex1D(arr, u, chans, outArr, test) {
    var a, b, c;
    if(chans === undefined || chans < 2) {
      u *= arr.length - 1;
      a = arr[Math.floor(u)];
      b = arr[Math.ceil(u)];
      c = u % 1;
      return pc.math.lerp(a, b, c)
    }
    u *= arr.length / chans - 1;
    if(!outArr) {
      outArr = []
    }
    for(var i = 0;i < chans;i++) {
      a = arr[Math.floor(u) * chans + i];
      b = arr[Math.ceil(u) * chans + i];
      c = u % 1;
      outArr[i] = pc.math.lerp(a, b, c)
    }
    return outArr
  }
  var default0Curve = new pc.Curve([0, 0, 1, 0]);
  var default1Curve = new pc.Curve([0, 1, 1, 1]);
  var default0Curve3 = new pc.CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
  var default1Curve3 = new pc.CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);
  var defaultParamTex = null;
  var velocityVec = new pc.Vec3;
  var localVelocityVec = new pc.Vec3;
  var velocityVec2 = new pc.Vec3;
  var localVelocityVec2 = new pc.Vec3;
  var rndFactor3Vec = new pc.Vec3;
  var particlePosPrev = new pc.Vec3;
  var particlePos = new pc.Vec3;
  var particleFinalPos = new pc.Vec3;
  var moveDirVec = new pc.Vec3;
  var rotMat = new pc.Mat4;
  var spawnMatrix3 = new pc.Mat3;
  var emitterMatrix3 = new pc.Mat3;
  var uniformScale = 1;
  var nonUniformScale;
  var spawnMatrix = new pc.Mat4;
  var randomPos = new pc.Vec3;
  var randomPosTformed = new pc.Vec3;
  var tmpVec3 = new pc.Vec3;
  var velocityV = new pc.Vec3;
  var setPropertyTarget;
  var setPropertyOptions;
  function setProperty(pName, defaultVal) {
    if(setPropertyOptions[pName] !== undefined && setPropertyOptions[pName] !== null) {
      setPropertyTarget[pName] = setPropertyOptions[pName]
    }else {
      setPropertyTarget[pName] = defaultVal
    }
  }
  function pack3NFloats(a, b, c) {
    var packed = a * 255 << 16 | b * 255 << 8 | c * 255;
    return packed / (1 << 24)
  }
  function packTextureXYZ_NXYZ(qXYZ, qXYZ2) {
    var num = qXYZ.length / 3;
    var colors = new Array(num * 4);
    for(var i = 0;i < num;i++) {
      colors[i * 4] = qXYZ[i * 3];
      colors[i * 4 + 1] = qXYZ[i * 3 + 1];
      colors[i * 4 + 2] = qXYZ[i * 3 + 2];
      colors[i * 4 + 3] = pack3NFloats(qXYZ2[i * 3], qXYZ2[i * 3 + 1], qXYZ2[i * 3 + 2])
    }
    return colors
  }
  function packTextureRGBA(qRGB, qA) {
    var colors = new Array(qA.length * 4);
    for(var i = 0;i < qA.length;i++) {
      colors[i * 4] = qRGB[i * 3];
      colors[i * 4 + 1] = qRGB[i * 3 + 1];
      colors[i * 4 + 2] = qRGB[i * 3 + 2];
      colors[i * 4 + 3] = qA[i]
    }
    return colors
  }
  function packTexture5Floats(qA, qB, qC, qD, qE) {
    var colors = new Array(qA.length * 4);
    for(var i = 0;i < qA.length;i++) {
      colors[i * 4] = qA[i];
      colors[i * 4 + 1] = qB[i];
      colors[i * 4 + 2] = 0;
      colors[i * 4 + 3] = pack3NFloats(qC[i], qD[i], qE[i])
    }
    return colors
  }
  function createOffscreenTarget(gd, camera) {
    var rect = camera._rect;
    var width = Math.floor(rect.width * gd.width);
    var height = Math.floor(rect.height * gd.height);
    var colorBuffer = new pc.Texture(gd, {format:pc.PIXELFORMAT_R8_G8_B8_A8, width:width, height:height});
    colorBuffer.minFilter = pc.FILTER_NEAREST;
    colorBuffer.magFilter = pc.FILTER_NEAREST;
    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    return new pc.RenderTarget(gd, colorBuffer, {depth:true})
  }
  var ParticleEmitter = function(graphicsDevice, options) {
    this.graphicsDevice = graphicsDevice;
    var gd = graphicsDevice;
    var precision = 32;
    this.precision = precision;
    if(!defaultParamTex) {
      var resolution = 16;
      var centerPoint = resolution * 0.5 + 0.5;
      var dtex = new Float32Array(resolution * resolution * 4);
      var x, y, xgrad, ygrad, p, c;
      for(y = 0;y < resolution;y++) {
        for(x = 0;x < resolution;x++) {
          xgrad = x + 1 - centerPoint;
          ygrad = y + 1 - centerPoint;
          c = saturate(1 - saturate(Math.sqrt(xgrad * xgrad + ygrad * ygrad) / resolution) - 0.5);
          p = y * resolution + x;
          dtex[p * 4] = 1;
          dtex[p * 4 + 1] = 1;
          dtex[p * 4 + 2] = 1;
          dtex[p * 4 + 3] = c
        }
      }
      defaultParamTex = _createTexture(gd, resolution, resolution, dtex, pc.PIXELFORMAT_R8_G8_B8_A8, 1);
      defaultParamTex.minFilter = pc.FILTER_LINEAR;
      defaultParamTex.magFilter = pc.FILTER_LINEAR
    }
    setPropertyTarget = this;
    setPropertyOptions = options;
    setProperty("numParticles", 1);
    setProperty("rate", 1);
    setProperty("rate2", this.rate);
    setProperty("lifetime", 50);
    setProperty("emitterExtents", new pc.Vec3(0, 0, 0));
    setProperty("emitterRadius", 0);
    setProperty("emitterShape", pc.EMITTERSHAPE_BOX);
    setProperty("initialVelocity", 1);
    setProperty("wrap", false);
    setProperty("wrapBounds", null);
    setProperty("colorMap", defaultParamTex);
    setProperty("normalMap", null);
    setProperty("loop", true);
    setProperty("preWarm", false);
    setProperty("sort", pc.PARTICLESORT_NONE);
    setProperty("mode", pc.PARTICLEMODE_GPU);
    setProperty("scene", null);
    setProperty("lighting", false);
    setProperty("halfLambert", false);
    setProperty("intensity", 1);
    setProperty("stretch", 0);
    setProperty("alignToMotion", false);
    setProperty("depthSoftening", 0);
    setProperty("mesh", null);
    setProperty("depthWrite", false);
    setProperty("blendType", pc.BLEND_NORMAL);
    setProperty("node", null);
    setProperty("startAngle", 0);
    setProperty("startAngle2", this.startAngle);
    this.frameRandom = new pc.Vec3(0, 0, 0);
    setProperty("colorGraph", default1Curve3);
    setProperty("colorGraph2", this.colorGraph);
    setProperty("scaleGraph", default1Curve);
    setProperty("scaleGraph2", this.scaleGraph);
    setProperty("alphaGraph", default1Curve);
    setProperty("alphaGraph2", this.alphaGraph);
    setProperty("localVelocityGraph", default0Curve3);
    setProperty("localVelocityGraph2", this.localVelocityGraph);
    setProperty("velocityGraph", default0Curve3);
    setProperty("velocityGraph2", this.velocityGraph);
    setProperty("rotationSpeedGraph", default0Curve);
    setProperty("rotationSpeedGraph2", this.rotationSpeedGraph);
    this.constantParticleTexIN = gd.scope.resolve("particleTexIN");
    this.constantParticleTexOUT = gd.scope.resolve("particleTexOUT");
    this.constantEmitterPos = gd.scope.resolve("emitterPos");
    this.constantEmitterScale = gd.scope.resolve("emitterScale");
    this.constantSpawnBounds = gd.scope.resolve("spawnBounds");
    this.constantInitialVelocity = gd.scope.resolve("initialVelocity");
    this.constantFrameRandom = gd.scope.resolve("frameRandom");
    this.constantDelta = gd.scope.resolve("delta");
    this.constantRate = gd.scope.resolve("rate");
    this.constantRateDiv = gd.scope.resolve("rateDiv");
    this.constantLifetime = gd.scope.resolve("lifetime");
    this.constantLightCube = gd.scope.resolve("lightCube[0]");
    this.constantGraphSampleSize = gd.scope.resolve("graphSampleSize");
    this.constantGraphNumSamples = gd.scope.resolve("graphNumSamples");
    this.constantInternalTex0 = gd.scope.resolve("internalTex0");
    this.constantInternalTex1 = gd.scope.resolve("internalTex1");
    this.constantInternalTex2 = gd.scope.resolve("internalTex2");
    this.constantEmitterMatrix = gd.scope.resolve("emitterMatrix");
    this.constantNumParticles = gd.scope.resolve("numParticles");
    this.constantNumParticlesPot = gd.scope.resolve("numParticlesPot");
    this.constantLocalVelocityDivMult = gd.scope.resolve("localVelocityDivMult");
    this.constantVelocityDivMult = gd.scope.resolve("velocityDivMult");
    this.constantRotSpeedDivMult = gd.scope.resolve("rotSpeedDivMult");
    this.constantSeed = gd.scope.resolve("seed");
    this.constantStartAngle = gd.scope.resolve("startAngle");
    this.constantStartAngle2 = gd.scope.resolve("startAngle2");
    this.lightCube = new Float32Array(6 * 3);
    this.lightCubeDir = new Array(6);
    this.lightCubeDir[0] = new pc.Vec3(-1, 0, 0);
    this.lightCubeDir[1] = new pc.Vec3(1, 0, 0);
    this.lightCubeDir[2] = new pc.Vec3(0, -1, 0);
    this.lightCubeDir[3] = new pc.Vec3(0, 1, 0);
    this.lightCubeDir[4] = new pc.Vec3(0, 0, -1);
    this.lightCubeDir[5] = new pc.Vec3(0, 0, 1);
    this.internalTex0 = null;
    this.internalTex1 = null;
    this.internalTex2 = null;
    this.internalTex3 = null;
    this.vbToSort = null;
    this.vbOld = null;
    this.particleDistance = null;
    this.camera = null;
    this.swapTex = false;
    this.useMesh = true;
    this.useCpu = false;
    this.shaderParticleUpdateRespawn = null;
    this.shaderParticleUpdateNoRespawn = null;
    this.shaderParticleUpdateOnStop = null;
    this.numParticleVerts = 0;
    this.numParticleIndices = 0;
    this.material = null;
    this.meshInstance = null;
    this.seed = 0;
    this.rebuild()
  };
  function calcEndTime(emitter) {
    var interval = Math.max(emitter.rate, emitter.rate2) * emitter.numParticles + emitter.lifetime;
    return Date.now() + interval * 1E3
  }
  function subGraph(A, B) {
    var r = new Float32Array(A.length);
    for(var i = 0;i < A.length;i++) {
      r[i] = A[i] - B[i]
    }
    return r
  }
  function maxUnsignedGraphValue(A, outUMax) {
    var i, j;
    var chans = outUMax.length;
    var values = A.length / chans;
    for(i = 0;i < values;i++) {
      for(j = 0;j < chans;j++) {
        var a = Math.abs(A[i * chans + j]);
        outUMax[j] = Math.max(outUMax[j], a)
      }
    }
  }
  function normalizeGraph(A, uMax) {
    var chans = uMax.length;
    var i, j;
    var values = A.length / chans;
    for(i = 0;i < values;i++) {
      for(j = 0;j < chans;j++) {
        A[i * chans + j] /= uMax[j];
        A[i * chans + j] *= 0.5;
        A[i * chans + j] += 0.5
      }
    }
  }
  function divGraphFrom2Curves(curve1, curve2, outUMax) {
    var sub = subGraph(curve2, curve1);
    maxUnsignedGraphValue(sub, outUMax);
    normalizeGraph(sub, outUMax);
    return sub
  }
  function mat4ToMat3(mat4, mat3) {
    mat3.data[0] = mat4.data[0];
    mat3.data[1] = mat4.data[1];
    mat3.data[2] = mat4.data[2];
    mat3.data[3] = mat4.data[4];
    mat3.data[4] = mat4.data[5];
    mat3.data[5] = mat4.data[6];
    mat3.data[6] = mat4.data[8];
    mat3.data[7] = mat4.data[9];
    mat3.data[8] = mat4.data[10]
  }
  ParticleEmitter.prototype = {onChangeCamera:function() {
    if(this.depthSoftening > 0) {
      if(this.camera) {
        if(!this.camera._depthTarget) {
          this.camera._depthTarget = createOffscreenTarget(this.graphicsDevice, this.camera);
          this._depthTarget = this.camera._depthTarget
        }
      }
    }
    this.regenShader();
    this.resetMaterial()
  }, rebuild:function() {
    var i, len;
    var precision = this.precision;
    var gd = this.graphicsDevice;
    this.spawnBounds = this.emitterShape === pc.EMITTERSHAPE_BOX ? this.emitterExtents : this.emitterRadius;
    this.useCpu = true;
    this.useCpu = this.useCpu || this.sort > pc.PARTICLESORT_NONE || !(gd.extTextureFloat && gd.maxVertexTextures >= 1 && gd.extTextureFloatRenderable) || gd.fragmentUniformsCount < 100;
    this.vertexBuffer = undefined;
    this.useMesh = false;
    if(this.mesh) {
      var totalVertCount = this.numParticles * this.mesh.vertexBuffer.numVertices;
      if(totalVertCount > 65535) {
        console.warn("WARNING: particle system can't render mesh particles because numParticles * numVertices is more than 65k. Reverting to quad particles.")
      }else {
        this.useMesh = true
      }
    }
    this.numParticlesPot = pc.math.nextPowerOfTwo(this.numParticles);
    this.rebuildGraphs();
    this.vbToSort = new Array(this.numParticles);
    this.particleDistance = new Float32Array(this.numParticles);
    this.frameRandom.x = Math.random();
    this.frameRandom.y = Math.random();
    this.frameRandom.z = Math.random();
    this.particleTex = new Float32Array(this.numParticlesPot * 4 * 4);
    var emitterPos = this.node === null ? pc.Vec3.ZERO : this.node.getPosition();
    if(this.emitterShape === pc.EMITTERSHAPE_BOX) {
      if(this.node === null) {
        spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.spawnBounds)
      }else {
        spawnMatrix.setTRS(pc.Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.getLocalScale()))
      }
    }
    for(i = 0;i < this.numParticles;i++) {
      this.calcSpawnPosition(emitterPos, i)
    }
    this.particleTexStart = new Float32Array(this.numParticlesPot * 4 * 4);
    for(i = 0;i < this.particleTexStart.length;i++) {
      this.particleTexStart[i] = this.particleTex[i]
    }
    if(!this.useCpu) {
      this.particleTexIN = _createTexture(gd, this.numParticlesPot, 4, this.particleTex);
      this.particleTexOUT = _createTexture(gd, this.numParticlesPot, 4, this.particleTex);
      this.particleTexStart = _createTexture(gd, this.numParticlesPot, 4, this.particleTexStart);
      this.rtParticleTexIN = new pc.RenderTarget(gd, this.particleTexIN, {depth:false});
      this.rtParticleTexOUT = new pc.RenderTarget(gd, this.particleTexOUT, {depth:false});
      this.swapTex = false
    }
    var chunks = pc.shaderChunks;
    var shaderCodeStart = chunks.particleUpdaterInitPS + (this.emitterShape === pc.EMITTERSHAPE_BOX ? chunks.particleUpdaterAABBPS : chunks.particleUpdaterSpherePS) + chunks.particleUpdaterStartPS;
    var shaderCodeRespawn = shaderCodeStart + chunks.particleUpdaterRespawnPS + chunks.particleUpdaterEndPS;
    var shaderCodeNoRespawn = shaderCodeStart + chunks.particleUpdaterEndPS;
    var shaderCodeOnStop = shaderCodeStart + chunks.particleUpdaterOnStopPS + chunks.particleUpdaterEndPS;
    this.shaderParticleUpdateRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeRespawn, "fsQuad0");
    this.shaderParticleUpdateNoRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeNoRespawn, "fsQuad1");
    this.shaderParticleUpdateOnStop = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeOnStop, "fsQuad2");
    this.numParticleVerts = this.useMesh ? this.mesh.vertexBuffer.numVertices : 4;
    this.numParticleIndices = this.useMesh ? this.mesh.indexBuffer[0].numIndices : 6;
    this._allocate(this.numParticles);
    var mesh = new pc.Mesh;
    mesh.vertexBuffer = this.vertexBuffer;
    mesh.indexBuffer[0] = this.indexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = this.numParticles * this.numParticleIndices;
    mesh.primitive[0].indexed = true;
    this.material = new pc.Material;
    this.material.cullMode = pc.CULLFACE_NONE;
    this.material.blend = true;
    this.material.blendType = this.blendType;
    this.material.depthWrite = this.depthWrite;
    this.material.emitter = this;
    this.regenShader();
    this.resetMaterial();
    this.meshInstance = new pc.MeshInstance(this.node, mesh, this.material);
    this.meshInstance.updateKey();
    this.meshInstance.drawToDepth = false;
    this._initializeTextures();
    this.addTime(0);
    if(this.preWarm) {
      this.prewarm(this.lifetime)
    }
    this.resetTime()
  }, calcSpawnPosition:function(emitterPos, i) {
    this.particleTex[i * 4 + 0 + this.numParticlesPot * 2 * 4] = Math.random();
    this.particleTex[i * 4 + 1 + this.numParticlesPot * 2 * 4] = Math.random();
    this.particleTex[i * 4 + 2 + this.numParticlesPot * 2 * 4] = Math.random();
    this.particleTex[i * 4 + 3 + this.numParticlesPot * 2 * 4] = Math.random();
    var rX = this.particleTex[i * 4 + 0 + this.numParticlesPot * 2 * 4];
    var rY = this.particleTex[i * 4 + 1 + this.numParticlesPot * 2 * 4];
    var rZ = this.particleTex[i * 4 + 2 + this.numParticlesPot * 2 * 4];
    var rW = this.particleTex[i * 4 + 3 + this.numParticlesPot * 2 * 4];
    randomPos.data[0] = rX - 0.5;
    randomPos.data[1] = rY - 0.5;
    randomPos.data[2] = rZ - 0.5;
    if(this.emitterShape === pc.EMITTERSHAPE_BOX) {
      randomPosTformed.copy(emitterPos).add(spawnMatrix.transformPoint(randomPos))
    }else {
      randomPos.normalize();
      randomPosTformed.copy(emitterPos).add(randomPos.scale(rW * this.spawnBounds))
    }
    this.particleTex[i * 4] = randomPosTformed.data[0];
    this.particleTex[i * 4 + 1] = randomPosTformed.data[1];
    this.particleTex[i * 4 + 2] = randomPosTformed.data[2];
    this.particleTex[i * 4 + 3] = pc.math.lerp(this.startAngle * pc.math.DEG_TO_RAD, this.startAngle2 * pc.math.DEG_TO_RAD, rX);
    var particleRate = pc.math.lerp(this.rate, this.rate2, rX);
    var startSpawnTime = -particleRate * i;
    this.particleTex[i * 4 + 3 + this.numParticlesPot * 4] = startSpawnTime
  }, rebuildGraphs:function() {
    var precision = this.precision;
    var gd = this.graphicsDevice;
    var i;
    this.qLocalVelocity = this.localVelocityGraph.quantize(precision);
    this.qVelocity = this.velocityGraph.quantize(precision);
    this.qColor = this.colorGraph.quantize(precision);
    this.qRotSpeed = this.rotationSpeedGraph.quantize(precision);
    this.qScale = this.scaleGraph.quantize(precision);
    this.qAlpha = this.alphaGraph.quantize(precision);
    this.qLocalVelocity2 = this.localVelocityGraph2.quantize(precision);
    this.qVelocity2 = this.velocityGraph2.quantize(precision);
    this.qColor2 = this.colorGraph2.quantize(precision);
    this.qRotSpeed2 = this.rotationSpeedGraph2.quantize(precision);
    this.qScale2 = this.scaleGraph2.quantize(precision);
    this.qAlpha2 = this.alphaGraph2.quantize(precision);
    for(i = 0;i < precision;i++) {
      this.qRotSpeed[i] *= pc.math.DEG_TO_RAD;
      this.qRotSpeed2[i] *= pc.math.DEG_TO_RAD
    }
    this.localVelocityUMax = new pc.Vec3(0, 0, 0);
    this.velocityUMax = new pc.Vec3(0, 0, 0);
    this.colorUMax = new pc.Vec3(0, 0, 0);
    this.rotSpeedUMax = [0];
    this.scaleUMax = [0];
    this.alphaUMax = [0];
    this.qLocalVelocityDiv = divGraphFrom2Curves(this.qLocalVelocity, this.qLocalVelocity2, this.localVelocityUMax.data);
    this.qVelocityDiv = divGraphFrom2Curves(this.qVelocity, this.qVelocity2, this.velocityUMax.data);
    this.qColorDiv = divGraphFrom2Curves(this.qColor, this.qColor2, this.colorUMax.data);
    this.qRotSpeedDiv = divGraphFrom2Curves(this.qRotSpeed, this.qRotSpeed2, this.rotSpeedUMax);
    this.qScaleDiv = divGraphFrom2Curves(this.qScale, this.qScale2, this.scaleUMax);
    this.qAlphaDiv = divGraphFrom2Curves(this.qAlpha, this.qAlpha2, this.alphaUMax);
    if(!this.useCpu) {
      this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qLocalVelocity, this.qLocalVelocityDiv));
      this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qVelocity, this.qVelocityDiv));
      this.internalTex2 = _createTexture(gd, precision, 1, packTexture5Floats(this.qRotSpeed, this.qScale, this.qScaleDiv, this.qRotSpeedDiv, this.qAlphaDiv))
    }
    this.internalTex3 = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), pc.PIXELFORMAT_R8_G8_B8_A8, 1)
  }, _initializeTextures:function() {
    if(this.colorMap) {
      this.material.setParameter("colorMap", this.colorMap);
      if(this.lighting && this.normalMap) {
        this.material.setParameter("normalMap", this.normalMap)
      }
    }
  }, _hasDepthTarget:function() {
    if(this.camera) {
      return!!this.camera._depthTarget
    }
    return false
  }, regenShader:function() {
    var programLib = this.graphicsDevice.getProgramLibrary();
    var hasNormal = this.normalMap != null;
    this.normalOption = 0;
    if(this.lighting) {
      this.normalOption = hasNormal ? 2 : 1
    }
    this.material.updateShader = function() {
      var shader = programLib.getProgram("particle", {useCpu:this.emitter.useCpu, normal:this.emitter.normalOption, halflambert:this.emitter.halfLambert, stretch:this.emitter.stretch, alignToMotion:this.emitter.alignToMotion, soft:this.emitter.depthSoftening && this.emitter._hasDepthTarget(), mesh:this.emitter.useMesh, srgb:this.emitter.scene ? this.emitter.scene.gammaCorrection : false, toneMap:this.emitter.scene ? this.emitter.scene.toneMapping : 0, fog:this.emitter.scene ? this.emitter.scene.fog : 
      "none", wrap:this.emitter.wrap && this.emitter.wrapBounds, blend:this.blendType});
      this.setShader(shader)
    };
    this.material.updateShader()
  }, resetMaterial:function() {
    var material = this.material;
    var gd = this.graphicsDevice;
    material.setParameter("stretch", this.stretch);
    material.setParameter("colorMult", this.intensity);
    if(!this.useCpu) {
      material.setParameter("internalTex0", this.internalTex0);
      material.setParameter("internalTex1", this.internalTex1);
      material.setParameter("internalTex2", this.internalTex2)
    }
    material.setParameter("internalTex3", this.internalTex3);
    material.setParameter("numParticles", this.numParticles);
    material.setParameter("numParticlesPot", this.numParticlesPot);
    material.setParameter("lifetime", this.lifetime);
    material.setParameter("rate", this.rate);
    material.setParameter("rateDiv", this.rate2 - this.rate);
    material.setParameter("seed", this.seed);
    material.setParameter("scaleDivMult", this.scaleUMax[0]);
    material.setParameter("alphaDivMult", this.alphaUMax[0]);
    material.setParameter("graphNumSamples", this.precision);
    material.setParameter("graphSampleSize", 1 / this.precision);
    material.setParameter("emitterScale", pc.Vec3.ONE.data);
    if(this.wrap && this.wrapBounds) {
      material.setParameter("wrapBounds", this.wrapBounds.data)
    }
    if(this.colorMap) {
      material.setParameter("colorMap", this.colorMap)
    }
    if(this.lighting) {
      if(this.normalMap) {
        material.setParameter("normalMap", this.normalMap)
      }
    }
    if(this.depthSoftening > 0 && this._hasDepthTarget()) {
      material.setParameter("uDepthMap", this.camera._depthTarget.colorBuffer);
      material.setParameter("screenSize", (new pc.Vec4(gd.width, gd.height, 1 / gd.width, 1 / gd.height)).data);
      material.setParameter("softening", 1 / (this.depthSoftening * this.depthSoftening * 100))
    }
    if(this.stretch > 0) {
      material.cull = pc.CULLFACE_NONE
    }
  }, _allocate:function(numParticles) {
    var psysVertCount = numParticles * this.numParticleVerts;
    var psysIndexCount = numParticles * this.numParticleIndices;
    var elements, particleFormat;
    var i;
    if(this.vertexBuffer === undefined || this.vertexBuffer.getNumVertices() !== psysVertCount) {
      if(!this.useCpu) {
        elements = [{semantic:pc.SEMANTIC_ATTR0, components:4, type:pc.ELEMENTTYPE_FLOAT32}];
        particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);
        this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
        this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount)
      }else {
        elements = [{semantic:pc.SEMANTIC_ATTR0, components:4, type:pc.ELEMENTTYPE_FLOAT32}, {semantic:pc.SEMANTIC_ATTR1, components:4, type:pc.ELEMENTTYPE_FLOAT32}, {semantic:pc.SEMANTIC_ATTR2, components:4, type:pc.ELEMENTTYPE_FLOAT32}, {semantic:pc.SEMANTIC_ATTR3, components:2, type:pc.ELEMENTTYPE_FLOAT32}];
        particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);
        this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
        this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount)
      }
      var data = new Float32Array(this.vertexBuffer.lock());
      var meshData, stride;
      if(this.useMesh) {
        meshData = new Float32Array(this.mesh.vertexBuffer.lock());
        stride = meshData.length / this.mesh.vertexBuffer.numVertices
      }
      var rnd;
      for(i = 0;i < psysVertCount;i++) {
        id = Math.floor(i / this.numParticleVerts);
        if(i % this.numParticleVerts === 0) {
          rnd = this.particleTex[i * 4 + 0 + this.numParticlesPot * 2 * 4]
        }
        if(!this.useMesh) {
          var vertID = i % 4;
          data[i * 4] = particleVerts[vertID][0];
          data[i * 4 + 1] = particleVerts[vertID][1];
          data[i * 4 + 2] = 0
        }else {
          var vert = i % this.numParticleVerts;
          data[i * 4] = meshData[vert * stride];
          data[i * 4 + 1] = meshData[vert * stride + 1];
          data[i * 4 + 2] = meshData[vert * stride + 2]
        }
        data[i * 4 + 3] = id
      }
      if(this.useCpu) {
        this.vbCPU = new Float32Array(data);
        this.vbOld = new Float32Array(this.vbCPU.length)
      }
      this.vertexBuffer.unlock();
      if(this.useMesh) {
        this.mesh.vertexBuffer.unlock()
      }
      var dst = 0;
      indices = new Uint16Array(this.indexBuffer.lock());
      if(this.useMesh) {
        meshData = new Uint16Array(this.mesh.indexBuffer[0].lock())
      }
      for(i = 0;i < numParticles;i++) {
        if(!this.useMesh) {
          var baseIndex = i * 4;
          indices[dst++] = baseIndex;
          indices[dst++] = baseIndex + 1;
          indices[dst++] = baseIndex + 2;
          indices[dst++] = baseIndex;
          indices[dst++] = baseIndex + 2;
          indices[dst++] = baseIndex + 3
        }else {
          for(var j = 0;j < this.numParticleIndices;j++) {
            indices[i * this.numParticleIndices + j] = meshData[j] + i * this.numParticleVerts
          }
        }
      }
      this.indexBuffer.unlock();
      if(this.useMesh) {
        this.mesh.indexBuffer[0].unlock()
      }
    }
  }, reset:function() {
    this.seed = Math.random();
    this.material.setParameter("seed", this.seed);
    if(this.useCpu) {
      for(var i = 0;i < this.particleTexStart.length;i++) {
        this.particleTex[i] = this.particleTexStart[i]
      }
    }else {
      this._initializeTextures()
    }
    this.resetTime();
    var origLoop = this.loop;
    this.loop = true;
    this.addTime(0);
    this.loop = origLoop;
    if(this.preWarm) {
      this.prewarm(this.lifetime)
    }
  }, prewarm:function(time) {
    var lifetimeFraction = time / this.lifetime;
    var iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
    var stepDelta = time / iterations;
    for(var i = 0;i < iterations;i++) {
      this.addTime(stepDelta)
    }
  }, resetTime:function() {
    this.endTime = calcEndTime(this)
  }, addTime:function(delta, isOnStop) {
    var i, j;
    var device = this.graphicsDevice;
    device.setBlending(false);
    device.setColorWrite(true, true, true, true);
    device.setCullMode(pc.CULLFACE_NONE);
    device.setDepthTest(false);
    device.setDepthWrite(false);
    if(this.lighting) {
      if(!this.scene) {
        console.error("There is no scene defined for lighting particles");
        return
      }
      for(i = 0;i < 6;i++) {
        this.lightCube[i * 3] = this.scene.ambientLight.r;
        this.lightCube[i * 3 + 1] = this.scene.ambientLight.g;
        this.lightCube[i * 3 + 2] = this.scene.ambientLight.b
      }
      var dirs = this.scene._globalLights;
      for(i = 0;i < dirs.length;i++) {
        for(var c = 0;c < 6;c++) {
          var weight = Math.max(this.lightCubeDir[c].dot(dirs[i]._direction), 0) * dirs[i]._intensity;
          this.lightCube[c * 3] += dirs[i]._color.r * weight;
          this.lightCube[c * 3 + 1] += dirs[i]._color.g * weight;
          this.lightCube[c * 3 + 2] += dirs[i]._color.b * weight
        }
      }
      this.constantLightCube.setValue(this.lightCube)
    }
    if(this.scene) {
      if(this.camera != this.scene._activeCamera) {
        this.camera = this.scene._activeCamera;
        this.onChangeCamera()
      }
    }
    if(this.emitterShape === pc.EMITTERSHAPE_BOX) {
      if(this.meshInstance.node === null) {
        spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.spawnBounds)
      }else {
        spawnMatrix.setTRS(pc.Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.meshInstance.node.getLocalScale()))
      }
    }
    var emitterScale = this.meshInstance.node === null ? pc.Vec3.ONE.data : this.meshInstance.node.getLocalScale().data;
    this.material.setParameter("emitterScale", emitterScale);
    if(!this.useCpu) {
      this.frameRandom.x = Math.random();
      this.frameRandom.y = Math.random();
      this.frameRandom.z = Math.random();
      this.constantGraphSampleSize.setValue(1 / this.precision);
      this.constantGraphNumSamples.setValue(this.precision);
      this.constantNumParticles.setValue(this.numParticles);
      this.constantNumParticlesPot.setValue(this.numParticlesPot);
      this.constantInternalTex0.setValue(this.internalTex0);
      this.constantInternalTex1.setValue(this.internalTex1);
      this.constantInternalTex2.setValue(this.internalTex2);
      var emitterPos = this.meshInstance.node === null ? pc.Vec3.ZERO.data : this.meshInstance.node.getPosition().data;
      var emitterMatrix = this.meshInstance.node === null ? pc.Mat4.IDENTITY : this.meshInstance.node.getWorldTransform();
      if(this.emitterShape === pc.EMITTERSHAPE_BOX) {
        mat4ToMat3(spawnMatrix, spawnMatrix3);
        this.constantSpawnBounds.setValue(spawnMatrix3.data)
      }else {
        this.constantSpawnBounds.setValue(this.spawnBounds)
      }
      this.constantInitialVelocity.setValue(this.initialVelocity);
      mat4ToMat3(emitterMatrix, emitterMatrix3);
      this.constantEmitterPos.setValue(emitterPos);
      this.constantFrameRandom.setValue(this.frameRandom.data);
      this.constantDelta.setValue(delta);
      this.constantRate.setValue(this.rate);
      this.constantRateDiv.setValue(this.rate2 - this.rate);
      this.constantStartAngle.setValue(this.startAngle * pc.math.DEG_TO_RAD);
      this.constantStartAngle2.setValue(this.startAngle2 * pc.math.DEG_TO_RAD);
      this.constantSeed.setValue(this.seed);
      this.constantLifetime.setValue(this.lifetime);
      this.constantEmitterScale.setValue(emitterScale);
      this.constantEmitterMatrix.setValue(emitterMatrix3.data);
      this.constantLocalVelocityDivMult.setValue(this.localVelocityUMax.data);
      this.constantVelocityDivMult.setValue(this.velocityUMax.data);
      this.constantRotSpeedDivMult.setValue(this.rotSpeedUMax[0]);
      var texIN = this.swapTex ? this.particleTexOUT : this.particleTexIN;
      var texOUT = this.swapTex ? this.particleTexIN : this.particleTexOUT;
      this.constantParticleTexIN.setValue(texIN);
      if(!isOnStop) {
        pc.drawQuadWithShader(device, this.swapTex ? this.rtParticleTexIN : this.rtParticleTexOUT, this.loop ? this.shaderParticleUpdateRespawn : this.shaderParticleUpdateNoRespawn)
      }else {
        pc.drawQuadWithShader(device, this.swapTex ? this.rtParticleTexIN : this.rtParticleTexOUT, this.shaderParticleUpdateOnStop)
      }
      this.constantParticleTexOUT.setValue(texOUT);
      this.material.setParameter("particleTexOUT", texOUT);
      this.material.setParameter("particleTexIN", texIN);
      this.swapTex = !this.swapTex
    }else {
      var data = new Float32Array(this.vertexBuffer.lock());
      if(this.meshInstance.node) {
        var fullMat = this.meshInstance.node.worldTransform;
        for(j = 0;j < 12;j++) {
          rotMat.data[j] = fullMat.data[j]
        }
        nonUniformScale = this.meshInstance.node.getLocalScale();
        uniformScale = Math.max(Math.max(nonUniformScale.x, nonUniformScale.y), nonUniformScale.z)
      }
      var emitterPos = this.meshInstance.node === null ? pc.Vec3.ZERO : this.meshInstance.node.getPosition();
      var posCam = this.camera ? this.camera._node.getPosition() : pc.Vec3.ZERO;
      var vertSize = 14;
      for(i = 0;i < this.numParticles;i++) {
        var id = Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3]);
        var rndFactor = this.particleTex[i * 4 + 0 + this.numParticlesPot * 2 * 4];
        rndFactor3Vec.x = rndFactor;
        rndFactor3Vec.y = this.particleTex[i * 4 + 1 + this.numParticlesPot * 2 * 4];
        rndFactor3Vec.z = this.particleTex[i * 4 + 2 + this.numParticlesPot * 2 * 4];
        var particleRate = pc.math.lerp(this.rate, this.rate2, rndFactor);
        var particleLifetime = this.lifetime;
        var startSpawnTime = -particleRate * id;
        var life = this.particleTex[id * 4 + 3 + this.numParticlesPot * 4] + delta;
        var nlife = saturate(life / particleLifetime);
        var scale = 0;
        var alphaDiv = 0;
        var angle = 0;
        var len;
        var interpolation;
        var particleEnabled = life > 0 && life < particleLifetime;
        if(particleEnabled) {
          localVelocityVec.data = tex1D(this.qLocalVelocity, nlife, 3, localVelocityVec.data);
          localVelocityVec2.data = tex1D(this.qLocalVelocity2, nlife, 3, localVelocityVec2.data);
          velocityVec.data = tex1D(this.qVelocity, nlife, 3, velocityVec.data);
          velocityVec2.data = tex1D(this.qVelocity2, nlife, 3, velocityVec2.data);
          var rotSpeed = tex1D(this.qRotSpeed, nlife);
          var rotSpeed2 = tex1D(this.qRotSpeed2, nlife);
          scale = tex1D(this.qScale, nlife);
          var scale2 = tex1D(this.qScale2, nlife);
          var alpha = tex1D(this.qAlpha, nlife);
          var alpha2 = tex1D(this.qAlpha2, nlife);
          localVelocityVec.x = pc.math.lerp(localVelocityVec.x, localVelocityVec2.x, rndFactor3Vec.x);
          localVelocityVec.y = pc.math.lerp(localVelocityVec.y, localVelocityVec2.y, rndFactor3Vec.y);
          localVelocityVec.z = pc.math.lerp(localVelocityVec.z, localVelocityVec2.z, rndFactor3Vec.z);
          if(this.initialVelocity > 0) {
            if(this.emitterShape === pc.EMITTERSHAPE_SPHERE) {
              randomPos.copy(rndFactor3Vec).scale(2).sub(pc.Vec3.ONE).normalize();
              localVelocityVec.add(randomPos.scale(this.initialVelocity))
            }else {
              localVelocityVec.add(pc.Vec3.FORWARD.scale(this.initialVelocity))
            }
          }
          velocityVec.x = pc.math.lerp(velocityVec.x, velocityVec2.x, rndFactor3Vec.x);
          velocityVec.y = pc.math.lerp(velocityVec.y, velocityVec2.y, rndFactor3Vec.y);
          velocityVec.z = pc.math.lerp(velocityVec.z, velocityVec2.z, rndFactor3Vec.z);
          rotSpeed = pc.math.lerp(rotSpeed, rotSpeed2, rndFactor3Vec.y);
          scale = pc.math.lerp(scale, scale2, rndFactor * 1E4 % 1) * uniformScale;
          alphaDiv = (alpha2 - alpha) * (rndFactor * 1E3 % 1);
          if(this.meshInstance.node) {
            rotMat.transformPoint(localVelocityVec, localVelocityVec)
          }
          localVelocityVec.add(velocityVec.mul(nonUniformScale));
          moveDirVec.copy(localVelocityVec);
          particlePosPrev.x = this.particleTex[id * 4];
          particlePosPrev.y = this.particleTex[id * 4 + 1];
          particlePosPrev.z = this.particleTex[id * 4 + 2];
          particlePos.copy(particlePosPrev).add(localVelocityVec.scale(delta));
          particleFinalPos.copy(particlePos);
          this.particleTex[id * 4] = particleFinalPos.x;
          this.particleTex[id * 4 + 1] = particleFinalPos.y;
          this.particleTex[id * 4 + 2] = particleFinalPos.z;
          this.particleTex[id * 4 + 3] += rotSpeed * delta;
          if(this.wrap && this.wrapBounds) {
            particleFinalPos.sub(emitterPos);
            particleFinalPos.x = glMod(particleFinalPos.x, this.wrapBounds.x) - this.wrapBounds.x * 0.5;
            particleFinalPos.y = glMod(particleFinalPos.y, this.wrapBounds.y) - this.wrapBounds.y * 0.5;
            particleFinalPos.z = glMod(particleFinalPos.z, this.wrapBounds.z) - this.wrapBounds.z * 0.5;
            particleFinalPos.add(emitterPos)
          }
          if(this.sort > 0) {
            if(this.sort === 1) {
              tmpVec3.copy(particleFinalPos).sub(posCam);
              this.particleDistance[id] = -(tmpVec3.x * tmpVec3.x + tmpVec3.y * tmpVec3.y + tmpVec3.z * tmpVec3.z)
            }else {
              if(this.sort === 2) {
                this.particleDistance[id] = life
              }else {
                if(this.sort === 3) {
                  this.particleDistance[id] = -life
                }
              }
            }
          }
        }else {
          this.calcSpawnPosition(emitterPos, id)
        }
        if(life > particleLifetime && this.loop) {
          life = -particleRate * id
        }
        if(life <= 0 && isOnStop) {
          life = particleLifetime + 1
        }
        this.particleTex[id * 4 + 3 + this.numParticlesPot * 4] = life;
        for(var v = 0;v < this.numParticleVerts;v++) {
          var quadX = this.vbCPU[i * this.numParticleVerts * 4 + v * 4];
          var quadY = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 1];
          var quadZ = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 2];
          if(!particleEnabled) {
            quadX = quadY = quadZ = 0
          }
          var w = i * this.numParticleVerts * vertSize + v * vertSize;
          data[w] = particleFinalPos.x;
          data[w + 1] = particleFinalPos.y;
          data[w + 2] = particleFinalPos.z;
          data[w + 3] = nlife;
          data[w + 4] = this.alignToMotion ? angle : this.particleTex[id * 4 + 3];
          data[w + 5] = scale;
          data[w + 6] = alphaDiv;
          data[w + 7] = moveDirVec.x;
          data[w + 8] = quadX;
          data[w + 9] = quadY;
          data[w + 10] = quadZ;
          data[w + 11] = moveDirVec.y;
          data[w + 12] = moveDirVec.z
        }
      }
      if(this.sort > pc.PARTICLESORT_NONE && this.camera) {
        for(i = 0;i < this.numParticles;i++) {
          this.vbToSort[i] = [i, Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3])]
        }
        for(i = 0;i < this.vbCPU.length;i++) {
          this.vbOld[i] = this.vbCPU[i]
        }
        var particleDistance = this.particleDistance;
        this.vbToSort.sort(function(a, b) {
          return particleDistance[a[1]] - particleDistance[b[1]]
        });
        for(i = 0;i < this.numParticles;i++) {
          var start = this.vbToSort[i][0];
          for(var corner = 0;corner < this.numParticleVerts;corner++) {
            for(j = 0;j < 4;j++) {
              this.vbCPU[i * this.numParticleVerts * 4 + corner * 4 + j] = this.vbOld[start * this.numParticleVerts * 4 + corner * 4 + j]
            }
          }
        }
      }
      this.vertexBuffer.unlock()
    }
    if(!this.loop) {
      if(this.onFinished) {
        if(Date.now() > this.endTime) {
          this.onFinished()
        }
      }
    }
    device.setDepthTest(true);
    device.setDepthWrite(true)
  }};
  return{ParticleEmitter:ParticleEmitter}
}());
pc.extend(pc, function() {
  var Picker = function(device, width, height) {
    this.device = device;
    var library = device.getProgramLibrary();
    this.pickProgStatic = library.getProgram("pick", {skin:false});
    this.pickProgSkin = library.getProgram("pick", {skin:true});
    this.pickColor = new Float32Array(4);
    this.scene = null;
    this.clearOptions = {color:[1, 1, 1, 1], depth:1, flags:pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH};
    this.resize(width, height)
  };
  Picker.prototype.getSelection = function(rect) {
    var device = this.device;
    rect.width = rect.width || 1;
    rect.height = rect.height || 1;
    var prevRenderTarget = device.getRenderTarget();
    device.setRenderTarget(this._pickBufferTarget);
    device.updateBegin();
    var pixels = new Uint8Array(4 * rect.width * rect.height);
    device.readPixels(rect.x, rect.y, rect.width, rect.height, pixels);
    device.updateEnd();
    device.setRenderTarget(prevRenderTarget);
    var selection = [];
    for(var i = 0;i < rect.width * rect.height;i++) {
      var r = pixels[4 * i + 0];
      var g = pixels[4 * i + 1];
      var b = pixels[4 * i + 2];
      var index = r << 16 | g << 8 | b;
      if(index !== 16777215) {
        var selectedMeshInstance = this.scene.drawCalls[index];
        if(selection.indexOf(selectedMeshInstance) === -1) {
          selection.push(selectedMeshInstance)
        }
      }
    }
    return selection
  };
  Picker.prototype.prepare = function(camera, scene) {
    var device = this.device;
    this.scene = scene;
    var prevRenderTarget = device.getRenderTarget();
    device.setRenderTarget(this._pickBufferTarget);
    device.updateBegin();
    device.setViewport(0, 0, this._pickBufferTarget.width, this._pickBufferTarget.height);
    device.setScissor(0, 0, this._pickBufferTarget.width, this._pickBufferTarget.height);
    device.clear(this.clearOptions);
    var i;
    var mesh, meshInstance, material;
    var type;
    var drawCalls = scene.drawCalls;
    var numDrawCalls = drawCalls.length;
    var device = this.device;
    var scope = device.scope;
    var modelMatrixId = scope.resolve("matrix_model");
    var boneTextureId = scope.resolve("texture_poseMap");
    var boneTextureSizeId = scope.resolve("texture_poseMapSize");
    var poseMatrixId = scope.resolve("matrix_pose[0]");
    var pickColorId = scope.resolve("uColor");
    var projId = scope.resolve("matrix_projection");
    var viewProjId = scope.resolve("matrix_viewProjection");
    var wtm = camera._node.getWorldTransform();
    var projMat = camera.getProjectionMatrix();
    var viewMat = wtm.clone().invert();
    var viewProjMat = new pc.Mat4;
    viewProjMat.mul2(projMat, viewMat);
    projId.setValue(projMat.data);
    viewProjId.setValue(viewProjMat.data);
    for(i = 0;i < numDrawCalls;i++) {
      if(!drawCalls[i].command) {
        meshInstance = drawCalls[i];
        mesh = meshInstance.mesh;
        material = meshInstance.material;
        type = mesh.primitive[pc.RENDERSTYLE_SOLID].type;
        var isSolid = type === pc.PRIMITIVE_TRIANGLES || type === pc.PRIMITIVE_TRISTRIP || type === pc.PRIMITIVE_TRIFAN;
        var isPickable = material instanceof pc.PhongMaterial || material instanceof pc.BasicMaterial;
        if(isSolid && isPickable) {
          device.setBlending(false);
          device.setCullMode(material.cull);
          device.setDepthWrite(material.depthWrite);
          device.setDepthTest(material.depthTest);
          modelMatrixId.setValue(meshInstance.node.worldTransform.data);
          if(meshInstance.skinInstance) {
            if(device.supportsBoneTextures) {
              boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
              var w = meshInstance.skinInstance.boneTexture.width;
              var h = meshInstance.skinInstance.boneTexture.height;
              boneTextureSizeId.setValue([w, h])
            }else {
              poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette)
            }
          }
          this.pickColor[0] = (i >> 16 & 255) / 255;
          this.pickColor[1] = (i >> 8 & 255) / 255;
          this.pickColor[2] = (i & 255) / 255;
          this.pickColor[3] = 1;
          pickColorId.setValue(this.pickColor);
          device.setShader(mesh.skin ? this.pickProgSkin : this.pickProgStatic);
          device.setVertexBuffer(mesh.vertexBuffer, 0);
          device.setIndexBuffer(mesh.indexBuffer[pc.RENDERSTYLE_SOLID]);
          device.draw(mesh.primitive[pc.RENDERSTYLE_SOLID])
        }
      }
    }
    device.setViewport(0, 0, device.width, device.height);
    device.setScissor(0, 0, device.width, device.height);
    device.updateEnd();
    device.setRenderTarget(prevRenderTarget)
  };
  Picker.prototype.resize = function(width, height) {
    var colorBuffer = new pc.Texture(this.device, {format:pc.PIXELFORMAT_R8_G8_B8_A8, width:width, height:height, autoMipmap:false});
    colorBuffer.minFilter = pc.FILTER_NEAREST;
    colorBuffer.magFilter = pc.FILTER_NEAREST;
    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    this._pickBufferTarget = new pc.RenderTarget(this.device, colorBuffer, {depth:true})
  };
  Object.defineProperty(Picker.prototype, "renderTarget", {get:function() {
    return this._pickBufferTarget
  }});
  Object.defineProperty(Picker.prototype, "width", {get:function() {
    return this._pickBufferTarget.width
  }});
  Object.defineProperty(Picker.prototype, "height", {get:function() {
    return this._pickBufferTarget.height
  }});
  return{Picker:Picker}
}());
pc.calculateTangents = function(vertices, normals, uvs, indices) {
  var triangleCount = indices.length / 3;
  var vertexCount = vertices.length / 3;
  var i1, i2, i3;
  var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
  var sdir = new pc.Vec3;
  var tdir = new pc.Vec3;
  var v1 = new pc.Vec3;
  var v2 = new pc.Vec3;
  var v3 = new pc.Vec3;
  var w1 = new pc.Vec2;
  var w2 = new pc.Vec2;
  var w3 = new pc.Vec2;
  var i;
  var tan1 = new Float32Array(vertexCount * 3);
  var tan2 = new Float32Array(vertexCount * 3);
  var tangents = [];
  for(i = 0;i < triangleCount;i++) {
    i1 = indices[i * 3];
    i2 = indices[i * 3 + 1];
    i3 = indices[i * 3 + 2];
    v1.set(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
    v2.set(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);
    v3.set(vertices[i3 * 3], vertices[i3 * 3 + 1], vertices[i3 * 3 + 2]);
    w1.set(uvs[i1 * 2], uvs[i1 * 2 + 1]);
    w2.set(uvs[i2 * 2], uvs[i2 * 2 + 1]);
    w3.set(uvs[i3 * 2], uvs[i3 * 2 + 1]);
    x1 = v2.x - v1.x;
    x2 = v3.x - v1.x;
    y1 = v2.y - v1.y;
    y2 = v3.y - v1.y;
    z1 = v2.z - v1.z;
    z2 = v3.z - v1.z;
    s1 = w2.x - w1.x;
    s2 = w3.x - w1.x;
    t1 = w2.y - w1.y;
    t2 = w3.y - w1.y;
    r = 1 / (s1 * t2 - s2 * t1);
    sdir.set((t2 * x1 - t1 * x2) * r, (t2 * y1 - t1 * y2) * r, (t2 * z1 - t1 * z2) * r);
    tdir.set((s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r);
    tan1[i1 * 3 + 0] += sdir.x;
    tan1[i1 * 3 + 1] += sdir.y;
    tan1[i1 * 3 + 2] += sdir.z;
    tan1[i2 * 3 + 0] += sdir.x;
    tan1[i2 * 3 + 1] += sdir.y;
    tan1[i2 * 3 + 2] += sdir.z;
    tan1[i3 * 3 + 0] += sdir.x;
    tan1[i3 * 3 + 1] += sdir.y;
    tan1[i3 * 3 + 2] += sdir.z;
    tan2[i1 * 3 + 0] += tdir.x;
    tan2[i1 * 3 + 1] += tdir.y;
    tan2[i1 * 3 + 2] += tdir.z;
    tan2[i2 * 3 + 0] += tdir.x;
    tan2[i2 * 3 + 1] += tdir.y;
    tan2[i2 * 3 + 2] += tdir.z;
    tan2[i3 * 3 + 0] += tdir.x;
    tan2[i3 * 3 + 1] += tdir.y;
    tan2[i3 * 3 + 2] += tdir.z
  }
  t1 = new pc.Vec3;
  t2 = new pc.Vec3;
  var n = new pc.Vec3;
  var temp = new pc.Vec3;
  for(i = 0;i < vertexCount;i++) {
    n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    t1.set(tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
    t2.set(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);
    var ndott = n.dot(t1);
    temp.copy(n).scale(ndott);
    temp.sub2(t1, temp).normalize();
    tangents[i * 4] = temp.x;
    tangents[i * 4 + 1] = temp.y;
    tangents[i * 4 + 2] = temp.z;
    temp.cross(n, t1);
    tangents[i * 4 + 3] = temp.dot(t2) < 0 ? -1 : 1
  }
  return tangents
};
pc.createMesh = function(device, positions, opts) {
  var normals = opts && opts.normals !== undefined ? opts.normals : null;
  var tangents = opts && opts.tangents !== undefined ? opts.tangents : null;
  var uvs = opts && opts.uvs !== undefined ? opts.uvs : null;
  var indices = opts && opts.indices !== undefined ? opts.indices : null;
  var vertexDesc = [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}];
  if(normals !== null) {
    vertexDesc.push({semantic:pc.SEMANTIC_NORMAL, components:3, type:pc.ELEMENTTYPE_FLOAT32})
  }
  if(tangents !== null) {
    vertexDesc.push({semantic:pc.SEMANTIC_TANGENT, components:4, type:pc.ELEMENTTYPE_FLOAT32})
  }
  if(uvs !== null) {
    vertexDesc.push({semantic:pc.SEMANTIC_TEXCOORD0, components:2, type:pc.ELEMENTTYPE_FLOAT32})
  }
  var vertexFormat = new pc.VertexFormat(device, vertexDesc);
  var numVertices = positions.length / 3;
  var vertexBuffer = new pc.VertexBuffer(device, vertexFormat, numVertices);
  var iterator = new pc.VertexIterator(vertexBuffer);
  for(var i = 0;i < numVertices;i++) {
    iterator.element[pc.SEMANTIC_POSITION].set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    if(normals !== null) {
      iterator.element[pc.SEMANTIC_NORMAL].set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
    }
    if(tangents !== null) {
      iterator.element[pc.SEMANTIC_TANGENT].set(tangents[i * 4], tangents[i * 4 + 1], tangents[i * 4 + 2], tangents[i * 4 + 3])
    }
    if(uvs !== null) {
      iterator.element[pc.SEMANTIC_TEXCOORD0].set(uvs[i * 2], uvs[i * 2 + 1])
    }
    iterator.next()
  }
  iterator.end();
  var indexBuffer = null;
  var indexed = indices !== null;
  if(indexed) {
    indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    var dst = new Uint16Array(indexBuffer.lock());
    dst.set(indices);
    indexBuffer.unlock()
  }
  var aabb = new pc.shape.Aabb;
  aabb.compute(positions);
  var mesh = new pc.Mesh;
  mesh.vertexBuffer = vertexBuffer;
  mesh.indexBuffer[0] = indexBuffer;
  mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
  mesh.primitive[0].base = 0;
  mesh.primitive[0].count = indexed ? indices.length : numVertices;
  mesh.primitive[0].indexed = indexed;
  mesh.aabb = aabb;
  return mesh
};
pc.createTorus = function(device, opts) {
  var rc = opts && opts.tubeRadius !== undefined ? opts.tubeRadius : 0.2;
  var rt = opts && opts.ringRadius !== undefined ? opts.ringRadius : 0.3;
  var segments = opts && opts.segments !== undefined ? opts.segments : 30;
  var sides = opts && opts.sides !== undefined ? opts.sides : 20;
  var i, j;
  var x, y, z, nx, ny, nz, u, v;
  var positions = [];
  var normals = [];
  var uvs = [];
  var indices = [];
  for(i = 0;i <= sides;i++) {
    for(j = 0;j <= segments;j++) {
      x = Math.cos(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
      y = Math.sin(2 * Math.PI * i / sides) * rc;
      z = Math.sin(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
      nx = Math.cos(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
      ny = Math.sin(2 * Math.PI * i / sides);
      nz = Math.sin(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
      u = i / sides;
      v = 1 - j / segments;
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
      if(i < sides && j < segments) {
        var first, second, third, fourth;
        first = i * (segments + 1) + j;
        second = (i + 1) * (segments + 1) + j;
        third = i * (segments + 1) + (j + 1);
        fourth = (i + 1) * (segments + 1) + (j + 1);
        indices.push(first, second, third);
        indices.push(second, fourth, third)
      }
    }
  }
  var options = {normals:normals, uvs:uvs, indices:indices};
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(positions, normals, uvs, indices)
  }
  return pc.createMesh(device, positions, options)
};
pc._createConeData = function(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
  var i, j;
  var x, y, z, u, v;
  var pos = new pc.Vec3;
  var bottomToTop = new pc.Vec3;
  var norm = new pc.Vec3;
  var top, bottom, tangent;
  var positions = [];
  var normals = [];
  var uvs = [];
  var indices = [];
  var cosTheta, sinTheta;
  var sinPhi, cosPhi;
  var first, second, third, fourth;
  var offset;
  if(height > 0) {
    for(i = 0;i <= heightSegments;i++) {
      for(j = 0;j <= capSegments;j++) {
        theta = j / capSegments * 2 * Math.PI - Math.PI;
        sinTheta = Math.sin(theta);
        cosTheta = Math.cos(theta);
        bottom = new pc.Vec3(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
        top = new pc.Vec3(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
        pos.lerp(bottom, top, i / heightSegments);
        bottomToTop.sub2(top, bottom).normalize();
        tangent = new pc.Vec3(cosTheta, 0, -sinTheta);
        norm.cross(tangent, bottomToTop).normalize();
        positions.push(pos.x, pos.y, pos.z);
        normals.push(norm.x, norm.y, norm.z);
        uvs.push(j / capSegments, i / heightSegments);
        if(i < heightSegments && j < capSegments) {
          first = i * (capSegments + 1) + j;
          second = i * (capSegments + 1) + (j + 1);
          third = (i + 1) * (capSegments + 1) + j;
          fourth = (i + 1) * (capSegments + 1) + (j + 1);
          indices.push(first, second, third);
          indices.push(second, fourth, third)
        }
      }
    }
  }
  if(roundedCaps) {
    var lat, lon;
    var latitudeBands = Math.floor(capSegments / 2);
    var longitudeBands = capSegments;
    var capOffset = height / 2;
    for(lat = 0;lat <= latitudeBands;lat++) {
      theta = lat * Math.PI * 0.5 / latitudeBands;
      sinTheta = Math.sin(theta);
      cosTheta = Math.cos(theta);
      for(lon = 0;lon <= longitudeBands;lon++) {
        phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        sinPhi = Math.sin(phi);
        cosPhi = Math.cos(phi);
        x = cosPhi * sinTheta;
        y = cosTheta;
        z = sinPhi * sinTheta;
        u = 1 - lon / longitudeBands;
        v = 1 - lat / latitudeBands;
        positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
        normals.push(x, y, z);
        uvs.push(u, v)
      }
    }
    offset = (heightSegments + 1) * (capSegments + 1);
    for(lat = 0;lat < latitudeBands;++lat) {
      for(lon = 0;lon < longitudeBands;++lon) {
        first = lat * (longitudeBands + 1) + lon;
        second = first + longitudeBands + 1;
        indices.push(offset + first + 1, offset + second, offset + first);
        indices.push(offset + first + 1, offset + second + 1, offset + second)
      }
    }
    for(lat = 0;lat <= latitudeBands;lat++) {
      theta = Math.PI * 0.5 + lat * Math.PI * 0.5 / latitudeBands;
      sinTheta = Math.sin(theta);
      cosTheta = Math.cos(theta);
      for(lon = 0;lon <= longitudeBands;lon++) {
        phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        sinPhi = Math.sin(phi);
        cosPhi = Math.cos(phi);
        x = cosPhi * sinTheta;
        y = cosTheta;
        z = sinPhi * sinTheta;
        u = 1 - lon / longitudeBands;
        v = 1 - lat / latitudeBands;
        positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
        normals.push(x, y, z);
        uvs.push(u, v)
      }
    }
    offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
    for(lat = 0;lat < latitudeBands;++lat) {
      for(lon = 0;lon < longitudeBands;++lon) {
        first = lat * (longitudeBands + 1) + lon;
        second = first + longitudeBands + 1;
        indices.push(offset + first + 1, offset + second, offset + first);
        indices.push(offset + first + 1, offset + second + 1, offset + second)
      }
    }
  }else {
    offset = (heightSegments + 1) * (capSegments + 1);
    if(baseRadius > 0) {
      for(i = 0;i < capSegments;i++) {
        theta = i / capSegments * 2 * Math.PI;
        x = Math.sin(theta);
        y = -height / 2;
        z = Math.cos(theta);
        u = 1 - (x + 1) / 2;
        v = (z + 1) / 2;
        positions.push(x * baseRadius, y, z * baseRadius);
        normals.push(0, -1, 0);
        uvs.push(u, v);
        if(i > 1) {
          indices.push(offset, offset + i, offset + i - 1)
        }
      }
    }
    offset += capSegments;
    if(peakRadius > 0) {
      for(i = 0;i < capSegments;i++) {
        theta = i / capSegments * 2 * Math.PI;
        x = Math.sin(theta);
        y = height / 2;
        z = Math.cos(theta);
        u = 1 - (x + 1) / 2;
        v = (z + 1) / 2;
        positions.push(x * peakRadius, y, z * peakRadius);
        normals.push(0, 1, 0);
        uvs.push(u, v);
        if(i > 1) {
          indices.push(offset, offset + i - 1, offset + i)
        }
      }
    }
  }
  return{positions:positions, normals:normals, uvs:uvs, indices:indices}
};
pc.createCylinder = function(device, opts) {
  var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
  var height = opts && opts.height !== undefined ? opts.height : 1;
  var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
  var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 20;
  var options = pc._createConeData(baseRadius, baseRadius, height, heightSegments, capSegments, false);
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(options.positions, options.normals, options.uvs, options.indices)
  }
  return pc.createMesh(device, options.positions, options)
};
pc.createCapsule = function(device, opts) {
  var radius = opts && opts.radius !== undefined ? opts.radius : 0.3;
  var height = opts && opts.height !== undefined ? opts.height : 1;
  var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
  var sides = opts && opts.sides !== undefined ? opts.sides : 20;
  var options = pc._createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(options.positions, options.normals, options.uvs, options.indices)
  }
  return pc.createMesh(device, options.positions, options)
};
pc.createCone = function(device, opts) {
  var baseRadius = opts && opts.baseRadius !== undefined ? opts.baseRadius : 0.5;
  var peakRadius = opts && opts.peakRadius !== undefined ? opts.peakRadius : 0;
  var height = opts && opts.height !== undefined ? opts.height : 1;
  var heightSegments = opts && opts.heightSegments !== undefined ? opts.heightSegments : 5;
  var capSegments = opts && opts.capSegments !== undefined ? opts.capSegments : 18;
  var options = pc._createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(options.positions, options.normals, options.uvs, options.indices)
  }
  return pc.createMesh(device, options.positions, options)
};
pc.createSphere = function(device, opts) {
  var radius = opts && opts.radius !== undefined ? opts.radius : 0.5;
  var latitudeBands = opts && opts.latitudeBands !== undefined ? opts.latitudeBands : 16;
  var longitudeBands = opts && opts.longitudeBands !== undefined ? opts.longitudeBands : 16;
  var lon, lat;
  var theta, sinTheta, cosTheta, phi, sinPhi, cosPhi;
  var first, second;
  var x, y, z, u, v;
  var positions = [];
  var normals = [];
  var uvs = [];
  var indices = [];
  for(lat = 0;lat <= latitudeBands;lat++) {
    theta = lat * Math.PI / latitudeBands;
    sinTheta = Math.sin(theta);
    cosTheta = Math.cos(theta);
    for(lon = 0;lon <= longitudeBands;lon++) {
      phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
      sinPhi = Math.sin(phi);
      cosPhi = Math.cos(phi);
      x = cosPhi * sinTheta;
      y = cosTheta;
      z = sinPhi * sinTheta;
      u = 1 - lon / longitudeBands;
      v = 1 - lat / latitudeBands;
      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
      uvs.push(u, v)
    }
  }
  for(lat = 0;lat < latitudeBands;++lat) {
    for(lon = 0;lon < longitudeBands;++lon) {
      first = lat * (longitudeBands + 1) + lon;
      second = first + longitudeBands + 1;
      indices.push(first + 1, second, first);
      indices.push(first + 1, second + 1, second)
    }
  }
  var options = {normals:normals, uvs:uvs, indices:indices};
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(positions, normals, uvs, indices)
  }
  return pc.createMesh(device, positions, options)
};
pc.createPlane = function(device, opts) {
  var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new pc.Vec2(0.5, 0.5);
  var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 5;
  var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 5;
  var i, j;
  var x, y, z, u, v;
  var positions = [];
  var normals = [];
  var uvs = [];
  var indices = [];
  for(i = 0;i <= ws;i++) {
    for(j = 0;j <= ls;j++) {
      x = -he.x + 2 * he.x * i / ws;
      y = 0;
      z = -(-he.y + 2 * he.y * j / ls);
      u = i / ws;
      v = j / ls;
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(u, v);
      if(i < ws && j < ls) {
        indices.push(j + i * (ws + 1), j + (i + 1) * (ws + 1), j + i * (ws + 1) + 1);
        indices.push(j + (i + 1) * (ws + 1), j + (i + 1) * (ws + 1) + 1, j + i * (ws + 1) + 1)
      }
    }
  }
  var options = {normals:normals, uvs:uvs, indices:indices};
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(positions, normals, uvs, indices)
  }
  return pc.createMesh(device, positions, options)
};
pc.createBox = function(device, opts) {
  var he = opts && opts.halfExtents !== undefined ? opts.halfExtents : new pc.Vec3(0.5, 0.5, 0.5);
  var ws = opts && opts.widthSegments !== undefined ? opts.widthSegments : 1;
  var ls = opts && opts.lengthSegments !== undefined ? opts.lengthSegments : 1;
  var hs = opts && opts.heightSegments !== undefined ? opts.heightSegments : 1;
  var corners = [new pc.Vec3(-he.x, -he.y, he.z), new pc.Vec3(he.x, -he.y, he.z), new pc.Vec3(he.x, he.y, he.z), new pc.Vec3(-he.x, he.y, he.z), new pc.Vec3(he.x, -he.y, -he.z), new pc.Vec3(-he.x, -he.y, -he.z), new pc.Vec3(-he.x, he.y, -he.z), new pc.Vec3(he.x, he.y, -he.z)];
  var faceAxes = [[0, 1, 3], [4, 5, 7], [3, 2, 6], [1, 0, 4], [1, 4, 2], [5, 0, 6]];
  var faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  var sides = {FRONT:0, BACK:1, TOP:2, BOTTOM:3, RIGHT:4, LEFT:5};
  var side, i, j;
  var positions = [];
  var normals = [];
  var uvs = [];
  var indices = [];
  var generateFace = function(side, uSegments, vSegments) {
    var x, y, z, u, v;
    var i, j;
    var offset = positions.length / 3;
    for(i = 0;i <= uSegments;i++) {
      for(j = 0;j <= vSegments;j++) {
        var temp1 = new pc.Vec3;
        var temp2 = new pc.Vec3;
        var temp3 = new pc.Vec3;
        var r = new pc.Vec3;
        temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
        temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
        temp3.sub2(temp2, corners[faceAxes[side][0]]);
        r.add2(temp1, temp3);
        u = i / uSegments;
        v = j / vSegments;
        positions.push(r.x, r.y, r.z);
        normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
        uvs.push(u, v);
        if(i < uSegments && j < vSegments) {
          indices.push(offset + j + i * (uSegments + 1), offset + j + (i + 1) * (uSegments + 1), offset + j + i * (uSegments + 1) + 1);
          indices.push(offset + j + (i + 1) * (uSegments + 1), offset + j + (i + 1) * (uSegments + 1) + 1, offset + j + i * (uSegments + 1) + 1)
        }
      }
    }
  };
  generateFace(sides.FRONT, ws, hs);
  generateFace(sides.BACK, ws, hs);
  generateFace(sides.TOP, ws, ls);
  generateFace(sides.BOTTOM, ws, ls);
  generateFace(sides.RIGHT, ls, hs);
  generateFace(sides.LEFT, ls, hs);
  var options = {normals:normals, uvs:uvs, indices:indices};
  if(pc.precalculatedTangents) {
    options.tangents = pc.calculateTangents(positions, normals, uvs, indices)
  }
  return pc.createMesh(device, positions, options)
};
pc.extend(pc, function() {
  var Key = function Key(time, position, rotation, scale) {
    this.time = time;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale
  };
  var Node = function Node() {
    this._name = "";
    this._keys = []
  };
  var Animation = function Animation() {
    this._name = "";
    this._duration = 0;
    this._nodes = [];
    this._nodeDict = {}
  };
  Animation.prototype.getDuration = function() {
    return this._duration
  };
  Animation.prototype.getName = function() {
    return this._name
  };
  Animation.prototype.getNode = function(name) {
    return this._nodeDict[name]
  };
  Animation.prototype.getNodes = function() {
    return this._nodes
  };
  Animation.prototype.setDuration = function(duration) {
    this._duration = duration
  };
  Animation.prototype.setName = function(name) {
    this._name = name
  };
  Animation.prototype.addNode = function(node) {
    this._nodes.push(node);
    this._nodeDict[node._name] = node
  };
  return{Animation:Animation, Key:Key, Node:Node}
}());
pc.extend(pc, function() {
  function InterpolatedKey() {
    this._written = false;
    this._name = "";
    this._keyFrames = [];
    this._quat = new pc.Quat;
    this._pos = new pc.Vec3;
    this._scale = new pc.Vec3;
    this._targetNode = null
  }
  InterpolatedKey.prototype = {getTarget:function() {
    return this._targetNode
  }, setTarget:function(node) {
    this._targetNode = node
  }};
  var Skeleton = function Skeleton(graph) {
    this._animation = null;
    this._time = 0;
    this.looping = true;
    this._interpolatedKeys = [];
    this._interpolatedKeyDict = {};
    this._currKeyIndices = {};
    this.graph = null;
    var self = this;
    function addInterpolatedKeys(node) {
      var name = node.getName();
      var interpKey = new InterpolatedKey;
      interpKey._name = name;
      self._interpolatedKeys.push(interpKey);
      self._interpolatedKeyDict[name] = interpKey;
      self._currKeyIndices[name] = 0;
      var children = node.getChildren();
      for(var i = 0;i < children.length;i++) {
        addInterpolatedKeys(children[i])
      }
    }
    addInterpolatedKeys(graph)
  };
  Skeleton.prototype.addTime = function(delta) {
    if(this._animation !== null) {
      if(this._time === duration && !this.looping) {
        return
      }
      var i;
      var node, nodeName;
      var keys, interpKey;
      var k1, k2, alpha;
      var nodes = this._animation.getNodes();
      this._time += delta;
      var duration = this._animation.getDuration();
      if(this._time > duration) {
        this._time = this.looping ? 0 : duration;
        for(i = 0;i < nodes.length;i++) {
          node = nodes[i];
          nodeName = node._name;
          this._currKeyIndices[nodeName] = 0
        }
      }else {
        if(this._time < 0) {
          this._time = this.looping ? duration : 0;
          for(i = 0;i < nodes.length;i++) {
            node = nodes[i];
            nodeName = node._name;
            this._currKeyIndices[nodeName] = node._keys.length - 2
          }
        }
      }
      var offset = delta > 0 ? 1 : -1;
      for(i = 0;i < nodes.length;i++) {
        node = nodes[i];
        nodeName = node._name;
        keys = node._keys;
        interpKey = this._interpolatedKeyDict[nodeName];
        if(keys.length === 1) {
          interpKey._pos.copy(keys[0].position);
          interpKey._quat.copy(keys[0].rotation);
          interpKey._scale(keys[0].scale)
        }else {
          for(var currKeyIndex = this._currKeyIndices[nodeName];currKeyIndex < keys.length - 1 && currKeyIndex >= 0;currKeyIndex += offset) {
            k1 = keys[currKeyIndex];
            k2 = keys[currKeyIndex + 1];
            if(k1.time <= this._time && k2.time >= this._time) {
              alpha = (this._time - k1.time) / (k2.time - k1.time);
              interpKey._pos.lerp(k1.position, k2.position, alpha);
              interpKey._quat.slerp(k1.rotation, k2.rotation, alpha);
              interpKey._scale.lerp(k1.scale, k2.scale, alpha);
              interpKey._written = true;
              this._currKeyIndices[nodeName] = currKeyIndex;
              break
            }
          }
        }
      }
    }
  };
  Skeleton.prototype.blend = function(skel1, skel2, alpha) {
    var numNodes = this._interpolatedKeys.length;
    for(var i = 0;i < numNodes;i++) {
      var key1 = skel1._interpolatedKeys[i];
      var key2 = skel2._interpolatedKeys[i];
      var dstKey = this._interpolatedKeys[i];
      if(key1._written && key2._written) {
        dstKey._quat.slerp(key1._quat, skel2._interpolatedKeys[i]._quat, alpha);
        dstKey._pos.lerp(key1._pos, skel2._interpolatedKeys[i]._pos, alpha);
        dstKey._scale.lerp(key1._scale, key2._scale, alpha);
        dstKey._written = true
      }else {
        if(key1._written) {
          dstKey._quat.copy(key1._quat);
          dstKey._pos.copy(key1._pos);
          dstKey._scale.copy(key1._scale);
          dstKey._written = true
        }else {
          if(key2._written) {
            dstKey._quat.copy(key2._quat);
            dstKey._pos.copy(key2._pos);
            dstKey._scale.copy(key2._scale);
            dstKey._written = true
          }
        }
      }
    }
  };
  Skeleton.prototype.getAnimation = function() {
    return this._animation
  };
  Skeleton.prototype.getCurrentTime = function() {
    return this._time
  };
  Skeleton.prototype.setCurrentTime = function(time) {
    this._time = time;
    var numNodes = this._interpolatedKeys.length;
    for(var i = 0;i < numNodes;i++) {
      var node = this._interpolatedKeys[i];
      var nodeName = node._name;
      this._currKeyIndices[nodeName] = 0
    }
    this.addTime(0);
    this.updateGraph()
  };
  Skeleton.prototype.getNumNodes = function() {
    return this._interpolatedKeys.length
  };
  Skeleton.prototype.setAnimation = function(animation) {
    this._animation = animation;
    this.setCurrentTime(0)
  };
  Skeleton.prototype.setGraph = function(graph) {
    var i;
    this.graph = graph;
    if(graph) {
      for(i = 0;i < this._interpolatedKeys.length;i++) {
        var interpKey = this._interpolatedKeys[i];
        var graphNode = graph.findByName(interpKey._name);
        this._interpolatedKeys[i].setTarget(graphNode)
      }
    }else {
      for(i = 0;i < this._interpolatedKeys.length;i++) {
        this._interpolatedKeys[i].setTarget(null)
      }
    }
  };
  Skeleton.prototype.updateGraph = function() {
    if(this.graph) {
      for(var i = 0;i < this._interpolatedKeys.length;i++) {
        var interpKey = this._interpolatedKeys[i];
        if(interpKey._written) {
          var transform = interpKey.getTarget();
          transform.localPosition.copy(interpKey._pos);
          transform.localRotation.copy(interpKey._quat);
          transform.localScale.copy(interpKey._scale);
          transform.dirtyLocal = true;
          interpKey._written = false
        }
      }
    }
  };
  Skeleton.prototype.setLooping = function(looping) {
    this.looping = looping
  };
  Skeleton.prototype.getLooping = function() {
    return this.looping
  };
  return{Skeleton:Skeleton}
}());
pc.extend(pc, function() {
  function hasAudio() {
    return typeof Audio !== "undefined"
  }
  function hasAudioContext() {
    return!!(typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined")
  }
  function isSupported(url, audio) {
    var toMIME = {".ogg":"audio/ogg", ".mp3":"audio/mpeg", ".wav":"audio/x-wav"};
    var ext = pc.path.getExtension(url);
    if(toMIME[ext]) {
      if(!audio) {
        audio = new Audio
      }
      return audio.canPlayType(toMIME[ext]) !== ""
    }else {
      return false
    }
  }
  var AudioManager = function() {
    if(hasAudioContext()) {
      if(typeof AudioContext !== "undefined") {
        this.context = new AudioContext
      }else {
        if(typeof webkitAudioContext !== "undefined") {
          this.context = new webkitAudioContext
        }
      }
    }
    this.listener = new pc.Listener(this);
    this.volume = 1;
    this.suspended = false;
    pc.events.attach(this)
  };
  AudioManager.hasAudio = hasAudio;
  AudioManager.hasAudioContext = hasAudioContext;
  AudioManager.isSupported = isSupported;
  AudioManager.prototype = {createSound:function(url, success, error) {
    var sound = null;
    if(pc.Sound) {
      sound = new pc.Sound(this, url, success, error)
    }else {
      error()
    }
    return sound
  }, playSound:function(sound, options) {
    options = options || {};
    var channel = null;
    if(pc.Channel) {
      channel = new pc.Channel(this, sound, options);
      channel.play()
    }
    return channel
  }, playSound3d:function(sound, position, options) {
    options = options || {};
    var channel = null;
    if(pc.Channel3d) {
      channel = new pc.Channel3d(this, sound, options);
      channel.setPosition(position);
      if(options.volume) {
        channel.setVolume(options.volume)
      }
      if(options.loop) {
        channel.setLoop(options.loop)
      }
      if(options.maxDistance) {
        channel.setMaxDistance(options.maxDistance)
      }
      if(options.minDistance) {
        channel.setMinDistance(options.minDistance)
      }
      if(options.rollOffFactor) {
        channel.setRollOffFactor(options.rollOffFactor)
      }
      channel.play()
    }
    return channel
  }, getListener:function() {
    return this.listener
  }, getVolume:function() {
    return this.volume
  }, setVolume:function(volume) {
    this.volume = volume;
    this.fire("volumechange", volume)
  }, suspend:function() {
    this.suspended = true;
    this.fire("suspend")
  }, resume:function() {
    this.suspended = false;
    this.fire("resume")
  }};
  return{AudioManager:AudioManager}
}());
pc.extend(pc, function() {
  var Sound;
  if(pc.AudioManager.hasAudioContext()) {
    Sound = function(manager, url, success, error) {
      this.buffer = null;
      this.isLoaded = false;
      if(!pc.AudioManager.isSupported(url, this.audio)) {
        setTimeout(function() {
          error(pc.string.format("Audio format for {0} not supported", url))
        }, 0)
      }else {
        if(manager.context) {
          pc.net.http.get(url, function(response) {
            manager.context.decodeAudioData(response, function(buffer) {
              this.buffer = buffer;
              this.isLoaded = true;
              success(this)
            }.bind(this), error)
          }.bind(this), {error:error})
        }
      }
    }
  }else {
    if(pc.AudioManager.hasAudio()) {
      Sound = function(manager, url, success, error) {
        this.isLoaded = false;
        this.audio = new Audio;
        this.audio.oncanplaythrough = function() {
          if(!this.isLoaded) {
            this.isLoaded = true;
            success(this)
          }
        }.bind(this);
        this.audio.src = url
      }
    }
  }
  return{Sound:Sound}
}());
pc.extend(pc, function() {
  var Listener = function(manager) {
    this.position = new pc.Vec3;
    this.velocity = new pc.Vec3;
    this.orientation = new pc.Mat4;
    if(pc.AudioManager.hasAudioContext()) {
      this.listener = manager.context.listener
    }
  };
  Listener.prototype = {getPosition:function() {
    return this.position
  }, setPosition:function(position) {
    this.position.copy(position);
    if(this.listener) {
      this.listener.setPosition(position.x, position.y, position.z)
    }
  }, getVelocity:function() {
    return this.velocity
  }, setVelocity:function(velocity) {
    this.velocity.copy(velocity);
    if(this.listener) {
      this.listener.setPosition(velocity.x, velocity.y, velocity.z)
    }
  }, setOrientation:function(orientation) {
    this.orientation.copy(orientation);
    if(this.listener) {
      this.listener.setOrientation(-orientation.data[8], -orientation.data[9], -orientation.data[10], orientation.data[4], orientation.data[5], orientation.data[6])
    }
  }, getOrientation:function() {
    return this.orientation
  }};
  return{Listener:Listener}
}());
pc.extend(pc, function() {
  var Channel;
  if(pc.AudioManager.hasAudioContext()) {
    Channel = function(manager, sound, options) {
      options = options || {};
      this.volume = options.volume === undefined ? 1 : options.volume;
      this.loop = options.loop === undefined ? false : options.loop;
      this.pitch = options.pitch === undefined ? 1 : options.pitch;
      this.sound = sound;
      this.paused = false;
      this.suspended = false;
      this.startTime = 0;
      this.startOffset = 0;
      this.manager = manager;
      this.source = null;
      var context = manager.context;
      this.gain = context.createGain()
    };
    Channel.prototype = {play:function() {
      if(this.source) {
        throw new Error("Call stop() before calling play()");
      }
      this._createSource();
      this.setVolume(this.volume);
      this.setLoop(this.loop);
      this.setPitch(this.pitch);
      this.startTime = this.manager.context.currentTime;
      this.source.start(0, this.startOffset % this.source.buffer.duration);
      this.manager.on("volumechange", this.onManagerVolumeChange, this);
      this.manager.on("suspend", this.onManagerSuspend, this);
      this.manager.on("resume", this.onManagerResume, this)
    }, pause:function() {
      if(this.source) {
        this.paused = true;
        this.startOffset += this.manager.context.currentTime - this.startTime;
        this.source.stop(0);
        this.source = null
      }
    }, unpause:function() {
      if(this.source || !this.paused) {
        throw new Error("Call pause() before unpausing.");
      }
      this._createSource();
      this.setVolume(this.volume);
      this.setLoop(this.loop);
      this.setPitch(this.pitch);
      this.startTime = this.manager.context.currentTime;
      this.source.start(0, this.startOffset % this.source.buffer.duration);
      this.paused = false
    }, stop:function() {
      if(this.source) {
        this.source.stop(0);
        this.source = null
      }
      this.manager.off("volumechange", this.onManagerVolumeChange, this);
      this.manager.off("suspend", this.onManagerSuspend, this);
      this.manager.off("resume", this.onManagerResume, this)
    }, setLoop:function(loop) {
      this.loop = loop;
      if(this.source) {
        this.source.loop = loop
      }
    }, setVolume:function(volume) {
      this.volume = volume;
      if(this.gain) {
        this.gain.gain.value = volume * this.manager.getVolume()
      }
    }, setPitch:function(pitch) {
      this.pitch = pitch;
      if(this.source) {
        this.source.playbackRate.value = pitch
      }
    }, isPlaying:function() {
      return!this.paused && this.source.playbackState === this.source.PLAYING_STATE
    }, getDuration:function() {
      if(this.source) {
        return this.source.buffer.duration
      }else {
        return 0
      }
    }, _createSource:function() {
      var context = this.manager.context;
      this.source = context.createBufferSource();
      this.source.buffer = this.sound.buffer;
      this.source.connect(this.gain);
      this.gain.connect(context.destination)
    }}
  }else {
    if(pc.AudioManager.hasAudio()) {
      Channel = function(manager, sound, options) {
        this.volume = options.volume || 1;
        this.loop = options.loop || false;
        this.sound = sound;
        this.pitch = options.pitch !== undefined ? options.pitch : 1;
        this.paused = false;
        this.suspended = false;
        this.manager = manager;
        this.source = sound.audio.cloneNode(false);
        this.source.pause()
      };
      Channel.prototype = {play:function() {
        if(this.source) {
          this.paused = false;
          this.setVolume(this.volume);
          this.setLoop(this.loop);
          this.setPitch(this.pitch);
          this.source.play()
        }
        this.manager.on("volumechange", this.onManagerVolumeChange, this);
        this.manager.on("suspend", this.onManagerSuspend, this);
        this.manager.on("resume", this.onManagerResume, this)
      }, pause:function() {
        if(this.source) {
          this.paused = true;
          this.source.pause()
        }
      }, unpause:function() {
        if(this.source) {
          this.paused = false;
          this.source.play()
        }
      }, stop:function() {
        if(this.source) {
          this.source.pause()
        }
        this.manager.off("volumechange", this.onManagerVolumeChange, this);
        this.manager.off("suspend", this.onManagerSuspend, this);
        this.manager.off("resume", this.onManagerResume, this)
      }, setVolume:function(volume) {
        this.volume = volume;
        if(this.source) {
          this.source.volume = volume * this.manager.getVolume()
        }
      }, setLoop:function(loop) {
        this.loop = loop;
        if(this.source) {
          this.source.loop = loop
        }
      }, setPitch:function(pitch) {
        this.pitch = pitch;
        if(this.source) {
          this.source.playbackRate = pitch
        }
      }, getDuration:function() {
        if(this.source) {
          var d = this.source.duration;
          if(d === d) {
            return d
          }
        }
        return 0
      }, isPlaying:function() {
        return!this.source.paused
      }}
    }else {
      console.warn("No support for 2D audio found");
      Channel = function() {
      }
    }
  }
  pc.extend(Channel.prototype, {getVolume:function() {
    return this.volume
  }, getLoop:function() {
    return this.loop
  }, getPitch:function() {
    return this.pitch
  }, onManagerVolumeChange:function() {
    this.setVolume(this.getVolume())
  }, onManagerSuspend:function() {
    if(this.isPlaying() && !this.suspended) {
      this.suspended = true;
      this.pause()
    }
  }, onManagerResume:function() {
    if(this.suspended) {
      this.suspended = false;
      this.unpause()
    }
  }});
  return{Channel:Channel}
}());
pc.extend(pc, function() {
  var MAX_DISTANCE = 1E4;
  var Channel3d;
  if(pc.AudioManager.hasAudioContext()) {
    Channel3d = function(manager, sound, options) {
      this.position = new pc.Vec3;
      this.velocity = new pc.Vec3;
      var context = manager.context;
      this.panner = context.createPanner()
    };
    Channel3d = pc.inherits(Channel3d, pc.Channel);
    Channel3d.prototype = pc.extend(Channel3d.prototype, {getPosition:function() {
      return this.position
    }, setPosition:function(position) {
      this.position.copy(position);
      this.panner.setPosition(position.x, position.y, position.z)
    }, getVelocity:function() {
      return this.velocity
    }, setVelocity:function(velocity) {
      this.velocity.copy(velocity);
      this.panner.setVelocity(velocity.x, velocity.y, velocity.z)
    }, getMaxDistance:function() {
      return this.panner.maxDistance
    }, setMaxDistance:function(max) {
      this.panner.maxDistance = max
    }, getMinDistance:function() {
      return this.panner.refDistance
    }, setMinDistance:function(min) {
      this.panner.refDistance = min
    }, getRollOffFactor:function() {
      return this.panner.rolloffFactor
    }, setRollOffFactor:function(factor) {
      this.panner.rolloffFactor = factor
    }, _createSource:function() {
      var context = this.manager.context;
      this.source = context.createBufferSource();
      this.source.buffer = this.sound.buffer;
      this.source.connect(this.panner);
      this.panner.connect(this.gain);
      this.gain.connect(context.destination)
    }})
  }else {
    if(pc.AudioManager.hasAudio()) {
      var offset = new pc.Vec3;
      var distance;
      var fallOff = function(posOne, posTwo, refDistance, maxDistance, rolloffFactor) {
        var min = 0;
        offset = offset.sub2(posOne, posTwo);
        distance = offset.length();
        if(distance < refDistance) {
          return 1
        }else {
          if(distance > maxDistance) {
            return 0
          }else {
            var numerator = refDistance + rolloffFactor * (distance - refDistance);
            if(numerator !== 0) {
              return refDistance / numerator
            }else {
              return 1
            }
          }
        }
      };
      Channel3d = function(manager, sound) {
        this.position = new pc.Vec3;
        this.velocity = new pc.Vec3;
        this.maxDistance = MAX_DISTANCE;
        this.minDistance = 1;
        this.rollOffFactor = 1
      };
      Channel3d = pc.inherits(Channel3d, pc.Channel);
      Channel3d.prototype = pc.extend(Channel3d.prototype, {getPosition:function() {
        return this.position
      }, setPosition:function(position) {
        this.position.copy(position);
        if(this.source) {
          var listener = this.manager.getListener();
          var lpos = listener.getPosition();
          var factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor);
          var v = this.getVolume();
          this.source.volume = v * factor
        }
      }, getVelocity:function() {
        return this.velocity
      }, setVelocity:function(velocity) {
        this.velocity.copy(velocity)
      }, getMaxDistance:function() {
        return this.maxDistance
      }, setMaxDistance:function(max) {
        this.maxDistance = max
      }, getMinDistance:function() {
        return this.minDistance
      }, setMinDistance:function(min) {
        this.minDistance = min
      }, getRollOffFactor:function() {
        return this.rolloffFactor
      }, setRollOffFactor:function(factor) {
        this.rolloffFactor = factor
      }})
    }else {
      console.warn("No support for 3D audio found");
      Channel3d = function() {
      }
    }
  }
  return{Channel3d:Channel3d}
}());
(function() {
  var enums = {ACTION_MOUSE:"mouse", ACTION_KEYBOARD:"keyboard", ACTION_GAMEPAD:"gamepad", AXIS_MOUSE_X:"mousex", AXIS_MOUSE_Y:"mousey", AXIS_PAD_L_X:"padlx", AXIS_PAD_L_Y:"padly", AXIS_PAD_R_X:"padrx", AXIS_PAD_R_Y:"padry", AXIS_KEY:"key", EVENT_KEYDOWN:"keydown", EVENT_KEYUP:"keyup", EVENT_MOUSEDOWN:"mousedown", EVENT_MOUSEMOVE:"mousemove", EVENT_MOUSEUP:"mouseup", EVENT_MOUSEWHEEL:"mousewheel", EVENT_TOUCHSTART:"touchstart", EVENT_TOUCHEND:"touchend", EVENT_TOUCHMOVE:"touchmove", EVENT_TOUCHCANCEL:"touchcancel", 
  KEY_BACKSPACE:8, KEY_TAB:9, KEY_RETURN:13, KEY_ENTER:14, KEY_SHIFT:16, KEY_CONTROL:17, KEY_ALT:18, KEY_PAUSE:19, KEY_CAPS_LOCK:20, KEY_ESCAPE:27, KEY_SPACE:32, KEY_PAGE_UP:33, KEY_PAGE_DOWN:34, KEY_END:35, KEY_HOME:36, KEY_LEFT:37, KEY_UP:38, KEY_RIGHT:39, KEY_DOWN:40, KEY_PRINT_SCREEN:44, KEY_INSERT:45, KEY_DELETE:46, KEY_0:48, KEY_1:49, KEY_2:50, KEY_3:51, KEY_4:52, KEY_5:53, KEY_6:54, KEY_7:55, KEY_8:56, KEY_9:57, KEY_SEMICOLON:59, KEY_EQUAL:61, KEY_A:65, KEY_B:66, KEY_C:67, KEY_D:68, KEY_E:69, 
  KEY_F:70, KEY_G:71, KEY_H:72, KEY_I:73, KEY_J:74, KEY_K:75, KEY_L:76, KEY_M:77, KEY_N:78, KEY_O:79, KEY_P:80, KEY_Q:81, KEY_R:82, KEY_S:83, KEY_T:84, KEY_U:85, KEY_V:86, KEY_W:87, KEY_X:88, KEY_Y:89, KEY_Z:90, KEY_WINDOWS:91, KEY_CONTEXT_MENU:93, KEY_NUMPAD_0:96, KEY_NUMPAD_1:97, KEY_NUMPAD_2:98, KEY_NUMPAD_3:99, KEY_NUMPAD_4:100, KEY_NUMPAD_5:101, KEY_NUMPAD_6:102, KEY_NUMPAD_7:103, KEY_NUMPAD_8:104, KEY_NUMPAD_9:105, KEY_MULTIPLY:106, KEY_ADD:107, KEY_SEPARATOR:108, KEY_SUBTRACT:109, KEY_DECIMAL:110, 
  KEY_DIVIDE:111, KEY_F1:112, KEY_F2:113, KEY_F3:114, KEY_F4:115, KEY_F5:116, KEY_F6:117, KEY_F7:118, KEY_F8:119, KEY_F9:120, KEY_F10:121, KEY_F11:122, KEY_F12:123, KEY_COMMA:188, KEY_PERIOD:190, KEY_SLASH:191, KEY_OPEN_BRACKET:219, KEY_BACK_SLASH:220, KEY_CLOSE_BRACKET:221, KEY_META:224, MOUSEBUTTON_NONE:-1, MOUSEBUTTON_LEFT:0, MOUSEBUTTON_MIDDLE:1, MOUSEBUTTON_RIGHT:2, PAD_1:0, PAD_2:1, PAD_3:2, PAD_4:3, PAD_FACE_1:0, PAD_FACE_2:1, PAD_FACE_3:2, PAD_FACE_4:3, PAD_L_SHOULDER_1:4, PAD_R_SHOULDER_1:5, 
  PAD_L_SHOULDER_2:6, PAD_R_SHOULDER_2:7, PAD_SELECT:8, PAD_START:9, PAD_L_STICK_BUTTON:10, PAD_R_STICK_BUTTON:11, PAD_UP:12, PAD_DOWN:13, PAD_LEFT:14, PAD_RIGHT:15, PAD_VENDOR:16, PAD_L_STICK_X:0, PAD_L_STICK_Y:1, PAD_R_STICK_X:2, PAD_R_STICK_Y:3};
  pc.extend(pc, enums);
  pc.input = {};
  pc.extend(pc.input, enums)
})();
pc.extend(pc, function() {
  var MouseEvent = function(mouse, event) {
    var coords = {x:0, y:0};
    if(event) {
      if(event instanceof MouseEvent) {
        throw Error("Expected MouseEvent");
      }
      coords = mouse._getTargetCoords(event)
    }else {
      event = {}
    }
    if(coords) {
      this.x = coords.x;
      this.y = coords.y
    }else {
      if(pc.Mouse.isPointerLocked()) {
        this.x = 0;
        this.y = 0
      }else {
        return
      }
    }
    if(event.detail) {
      this.wheel = -1 * event.detail
    }else {
      if(event.wheelDelta) {
        this.wheel = event.wheelDelta / 120
      }else {
        this.wheel = 0
      }
    }
    if(pc.Mouse.isPointerLocked()) {
      this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
      this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0
    }else {
      this.dx = this.x - mouse._lastX;
      this.dy = this.y - mouse._lastY
    }
    if(event.type === "mousedown" || event.type === "mouseup") {
      this.button = event.button
    }else {
      this.button = pc.MOUSEBUTTON_NONE
    }
    this.buttons = mouse._buttons.slice(0);
    this.element = event.target;
    this.ctrlKey = event.ctrlKey || false;
    this.altKey = event.altKey || false;
    this.shiftKey = event.shiftKey || false;
    this.metaKey = event.metaKey || false;
    this.event = event
  };
  var Mouse = function(element) {
    this._lastX = 0;
    this._lastY = 0;
    this._buttons = [false, false, false];
    this._lastbuttons = [false, false, false];
    this._upHandler = this._handleUp.bind(this);
    this._downHandler = this._handleDown.bind(this);
    this._moveHandler = this._handleMove.bind(this);
    this._wheelHandler = this._handleWheel.bind(this);
    this._contextMenuHandler = function(event) {
      event.preventDefault()
    };
    this._target = null;
    this._attached = false;
    this.attach(element);
    pc.events.attach(this)
  };
  Mouse.isPointerLocked = function() {
    return!!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement)
  };
  Mouse.prototype = {attach:function(element) {
    this._target = element;
    if(this._attached) {
      return
    }
    this._attached = true;
    window.addEventListener("mouseup", this._upHandler, false);
    window.addEventListener("mousedown", this._downHandler, false);
    window.addEventListener("mousemove", this._moveHandler, false);
    window.addEventListener("mousewheel", this._wheelHandler, false);
    window.addEventListener("DOMMouseScroll", this._wheelHandler, false)
  }, detach:function() {
    if(!this._attached) {
      return
    }
    this._attached = false;
    window.removeEventListener("mouseup", this._upHandler);
    window.removeEventListener("mousedown", this._downHandler);
    window.removeEventListener("mousemove", this._moveHandler);
    window.removeEventListener("mousewheel", this._wheelHandler);
    window.removeEventListener("DOMMouseScroll", this._wheelHandler)
  }, disableContextMenu:function() {
    if(!this._target) {
      return
    }
    this._target.addEventListener("contextmenu", this._contextMenuHandler)
  }, enableContextMenu:function() {
    if(!this._target) {
      return
    }
    this._target.removeEventListener("contextmenu", this._contextMenuHandler)
  }, enablePointerLock:function(success, error) {
    var s = function() {
      success();
      document.removeEventListener("pointerlockchange", s)
    };
    var e = function() {
      error();
      document.removeEventListener("pointerlockerror", e)
    };
    if(success) {
      document.addEventListener("pointerlockchange", s, false)
    }
    if(error) {
      document.addEventListener("pointerlockerror", e, false)
    }
    document.body.requestPointerLock()
  }, disablePointerLock:function(success) {
    var s = function() {
      success();
      document.removeEventListener("pointerlockchange", s)
    };
    if(success) {
      document.addEventListener("pointerlockchange", s, false)
    }
    document.exitPointerLock()
  }, update:function(dt) {
    this._lastbuttons[0] = this._buttons[0];
    this._lastbuttons[1] = this._buttons[1];
    this._lastbuttons[2] = this._buttons[2]
  }, isPressed:function(button) {
    return this._buttons[button]
  }, wasPressed:function(button) {
    return this._buttons[button] && !this._lastbuttons[button]
  }, wasReleased:function(button) {
    return!this._buttons[button] && this._lastbuttons[button]
  }, _handleUp:function(event) {
    this._buttons[event.button] = false;
    var e = new MouseEvent(this, event);
    if(!e.event) {
      return
    }
    this.fire(pc.EVENT_MOUSEUP, e)
  }, _handleDown:function(event) {
    this._buttons[event.button] = true;
    var e = new MouseEvent(this, event);
    if(!e.event) {
      return
    }
    this.fire(pc.EVENT_MOUSEDOWN, e)
  }, _handleMove:function(event) {
    var e = new MouseEvent(this, event);
    if(!e.event) {
      return
    }
    this.fire(pc.EVENT_MOUSEMOVE, e);
    this._lastX = e.x;
    this._lastY = e.y
  }, _handleWheel:function(event) {
    var e = new MouseEvent(this, event);
    if(!e.event) {
      return
    }
    this.fire(pc.EVENT_MOUSEWHEEL, e)
  }, _getTargetCoords:function(event) {
    var rect = this._target.getBoundingClientRect();
    var left = Math.floor(rect.left);
    var top = Math.floor(rect.top);
    if(event.clientX < left || event.clientX >= left + this._target.clientWidth || event.clientY < top || event.clientY >= top + this._target.clientHeight) {
      return null
    }
    return{x:event.clientX - left, y:event.clientY - top}
  }};
  (function() {
    if(typeof navigator === "undefined" || typeof document === "undefined") {
      return
    }
    navigator.pointer = navigator.pointer || navigator.webkitPointer || navigator.mozPointer;
    var pointerlockchange = function() {
      var e = document.createEvent("CustomEvent");
      e.initCustomEvent("pointerlockchange", true, false, null);
      document.dispatchEvent(e)
    };
    var pointerlockerror = function() {
      var e = document.createEvent("CustomEvent");
      e.initCustomEvent("pointerlockerror", true, false, null);
      document.dispatchEvent(e)
    };
    document.addEventListener("webkitpointerlockchange", pointerlockchange, false);
    document.addEventListener("webkitpointerlocklost", pointerlockchange, false);
    document.addEventListener("mozpointerlockchange", pointerlockchange, false);
    document.addEventListener("mozpointerlocklost", pointerlockchange, false);
    document.addEventListener("webkitpointerlockerror", pointerlockerror, false);
    document.addEventListener("mozpointerlockerror", pointerlockerror, false);
    if(Element.prototype.mozRequestPointerLock) {
      Element.prototype.requestPointerLock = function() {
        this.mozRequestPointerLock()
      }
    }else {
      Element.prototype.requestPointerLock = Element.prototype.requestPointerLock || Element.prototype.webkitRequestPointerLock || Element.prototype.mozRequestPointerLock
    }
    if(!Element.prototype.requestPointerLock && navigator.pointer) {
      Element.prototype.requestPointerLock = function() {
        var el = this;
        document.pointerLockElement = el;
        navigator.pointer.lock(el, pointerlockchange, pointerlockerror)
      }
    }
    document.exitPointerLock = document.exitPointerLock || document.webkitExitPointerLock || document.mozExitPointerLock;
    if(!document.exitPointerLock) {
      document.exitPointerLock = function() {
        if(navigator.pointer) {
          document.pointerLockElement = null;
          navigator.pointer.unlock()
        }
      }
    }
  })();
  return{Mouse:Mouse, MouseEvent:MouseEvent}
}());
pc.extend(pc, function() {
  var KeyboardEvent = function(keyboard, event) {
    this.key = event.keyCode;
    this.element = event.target;
    this.event = event
  };
  function toKeyCode(s) {
    if(typeof s == "string") {
      return s.toUpperCase().charCodeAt(0)
    }else {
      return s
    }
  }
  var _keyCodeToKeyIdentifier = {9:"Tab", 13:"Enter", 16:"Shift", 17:"Control", 18:"Alt", 27:"Escape", 37:"Left", 38:"Up", 39:"Right", 40:"Down", 46:"Delete", 91:"Win"};
  var Keyboard = function(element, options) {
    options = options || {};
    this._element = null;
    this._keyDownHandler = this._handleKeyDown.bind(this);
    this._keyUpHandler = this._handleKeyUp.bind(this);
    this._keyPressHandler = this._handleKeyPress.bind(this);
    pc.events.attach(this);
    this._keymap = {};
    this._lastmap = {};
    if(element) {
      this.attach(element)
    }
    this.preventDefault = options.preventDefault || false;
    this.stopPropagation = options.stopPropagation || false
  };
  Keyboard.prototype.attach = function(element) {
    if(this._element) {
      this.detach()
    }
    this._element = element;
    this._element.addEventListener("keydown", this._keyDownHandler, false);
    this._element.addEventListener("keypress", this._keyPressHandler, false);
    this._element.addEventListener("keyup", this._keyUpHandler, false)
  };
  Keyboard.prototype.detach = function() {
    this._element.removeEventListener("keydown", this._keyDownHandler);
    this._element.removeEventListener("keypress", this._keyPressHandler);
    this._element.removeEventListener("keyup", this._keyUpHandler);
    this._element = null
  };
  Keyboard.prototype.toKeyIdentifier = function(keyCode) {
    keyCode = toKeyCode(keyCode);
    var count;
    var hex;
    var length;
    var id = _keyCodeToKeyIdentifier[keyCode.toString()];
    if(id) {
      return id
    }
    hex = keyCode.toString(16).toUpperCase();
    length = hex.length;
    for(count = 0;count < 4 - length;count++) {
      hex = "0" + hex
    }
    return"U+" + hex
  };
  Keyboard.prototype._handleKeyDown = function(event) {
    var code = event.keyCode || event.charCode;
    var id = event.keyIdentifier || this.toKeyIdentifier(code);
    this._keymap[id] = true;
    this.fire("keydown", new KeyboardEvent(this, event));
    if(this.preventDefault) {
      event.preventDefault()
    }
    if(this.stopPropagation) {
      event.stopPropagation()
    }
  };
  Keyboard.prototype._handleKeyUp = function(event) {
    var code = event.keyCode || event.charCode;
    var id = event.keyIdentifier || this.toKeyIdentifier(code);
    delete this._keymap[id];
    this.fire("keyup", new KeyboardEvent(this, event));
    if(this.preventDefault) {
      event.preventDefault()
    }
    if(this.stopPropagation) {
      event.stopPropagation()
    }
  };
  Keyboard.prototype._handleKeyPress = function(event) {
    var code = event.keyCode || event.charCode;
    var id = event.keyIdentifier || this.toKeyIdentifier(code);
    this.fire("keypress", new KeyboardEvent(this, event));
    if(this.preventDefault) {
      event.preventDefault()
    }
    if(this.stopPropagation) {
      event.stopPropagation()
    }
  };
  Keyboard.prototype.update = function(dt) {
    var prop;
    this._lastmap = {};
    for(prop in this._keymap) {
      if(this._keymap.hasOwnProperty(prop)) {
        this._lastmap[prop] = this._keymap[prop]
      }
    }
  };
  Keyboard.prototype.isPressed = function(key) {
    var keyCode = toKeyCode(key);
    var id = this.toKeyIdentifier(keyCode);
    return!!this._keymap[id]
  };
  Keyboard.prototype.wasPressed = function(key) {
    var keyCode = toKeyCode(key);
    var id = this.toKeyIdentifier(keyCode);
    return!!this._keymap[id] && !!!this._lastmap[id]
  };
  Keyboard.prototype.wasReleased = function(key) {
    var keyCode = toKeyCode(key);
    var id = this.toKeyIdentifier(keyCode);
    return!!!this._keymap[id] && !!this._lastmap[id]
  };
  return{Keyboard:Keyboard}
}());
pc.extend(pc, function() {
  var GamePads = function() {
    this.gamepadsSupported = !!navigator.getGamepads || !!navigator.webkitGetGamepads;
    this.current = [];
    this.previous = [];
    this.deadZone = 0.25
  };
  var MAPS = {DEFAULT:{buttons:["PAD_FACE_1", "PAD_FACE_2", "PAD_FACE_3", "PAD_FACE_4", "PAD_L_SHOULDER_1", "PAD_R_SHOULDER_1", "PAD_L_SHOULDER_2", "PAD_R_SHOULDER_2", "PAD_SELECT", "PAD_START", "PAD_L_STICK_BUTTON", "PAD_R_STICK_BUTTON", "PAD_UP", "PAD_DOWN", "PAD_LEFT", "PAD_RIGHT", "PAD_VENDOR"], axes:["PAD_L_STICK_X", "PAD_L_STICK_Y", "PAD_R_STICK_X", "PAD_R_STICK_Y"]}, PS3:{buttons:["PAD_FACE_1", "PAD_FACE_2", "PAD_FACE_4", "PAD_FACE_3", "PAD_L_SHOULDER_1", "PAD_R_SHOULDER_1", "PAD_L_SHOULDER_2", 
  "PAD_R_SHOULDER_2", "PAD_SELECT", "PAD_START", "PAD_L_STICK_BUTTON", "PAD_R_STICK_BUTTON", "PAD_UP", "PAD_DOWN", "PAD_LEFT", "PAD_RIGHT", "PAD_VENDOR"], axes:["PAD_L_STICK_X", "PAD_L_STICK_Y", "PAD_R_STICK_X", "PAD_R_STICK_Y"]}};
  var PRODUCT_CODES = {"Product: 0268":"PS3"};
  GamePads.prototype = {update:function(dt) {
    var pads = this.poll();
    var i, len = pads.length;
    for(i = 0;i < len;i++) {
      this.previous[i] = this.current[i];
      this.current[i] = pads[i]
    }
  }, poll:function() {
    var pads = [];
    if(this.gamepadsSupported) {
      var padDevices = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads();
      var i, len = padDevices.length;
      for(i = 0;i < len;i++) {
        if(padDevices[i]) {
          pads.push({map:this.getMap(padDevices[i]), pad:padDevices[i]})
        }
      }
    }
    return pads
  }, getMap:function(pad) {
    for(var code in PRODUCT_CODES) {
      if(pad.id.indexOf(code) >= 0) {
        return MAPS[PRODUCT_CODES[code]]
      }
    }
    return MAPS.DEFAULT
  }, isPressed:function(index, button) {
    if(!this.current[index]) {
      return false
    }
    var key = this.current[index].map.buttons[button];
    return this.current[index].pad.buttons[pc[key]].pressed
  }, wasPressed:function(index, button) {
    if(!this.current[index]) {
      return false
    }
    var key = this.current[index].map.buttons[button];
    var i = pc[key];
    return this.current[index].pad.buttons[i].pressed && !this.previous[index].pad.buttons[i].pressed
  }, getAxis:function(index, axes) {
    if(!this.current[index]) {
      return false
    }
    var key = this.current[index].map.axes[axes];
    var value = this.current[index].pad.axes[pc[key]];
    if(Math.abs(value) < this.deadZone) {
      value = 0
    }
    return value
  }};
  return{GamePads:GamePads}
}());
pc.extend(pc, function() {
  var TouchEvent = function(device, event) {
    this.element = event.target;
    this.event = event;
    this.touches = [];
    this.changedTouches = [];
    if(event) {
      var i, l = event.touches.length;
      for(i = 0;i < l;i++) {
        this.touches.push(new Touch(event.touches[i]))
      }
      l = event.changedTouches.length;
      for(i = 0;i < l;i++) {
        this.changedTouches.push(new Touch(event.changedTouches[i]))
      }
    }
  };
  TouchEvent.prototype = {getTouchById:function(id, list) {
    var i, l = list.length;
    for(i = 0;i < l;i++) {
      if(list[i].id === id) {
        return list[i]
      }
    }
    return null
  }};
  var Touch = function(touch) {
    var coords = pc.getTouchTargetCoords(touch);
    this.id = touch.identifier;
    this.x = coords.x;
    this.y = coords.y;
    this.target = touch.target;
    this.touch = touch
  };
  var TouchDevice = function(element) {
    this._startHandler = this._handleTouchStart.bind(this);
    this._endHandler = this._handleTouchEnd.bind(this);
    this._moveHandler = this._handleTouchMove.bind(this);
    this._cancelHandler = this._handleTouchCancel.bind(this);
    this.attach(element);
    pc.events.attach(this)
  };
  TouchDevice.prototype = {attach:function(element) {
    if(this._element) {
      this.detach()
    }
    this._element = element;
    this._element.addEventListener("touchstart", this._startHandler, false);
    this._element.addEventListener("touchend", this._endHandler, false);
    this._element.addEventListener("touchmove", this._moveHandler, false);
    this._element.addEventListener("touchcancel", this._cancelHandler, false)
  }, detach:function() {
    if(this._element) {
      this._element.removeEventListener("touchstart", this._startHandler, false);
      this._element.removeEventListener("touchend", this._endHandler, false);
      this._element.removeEventListener("touchmove", this._moveHandler, false);
      this._element.removeEventListener("touchcancel", this._cancelHandler, false)
    }
    this._element = null
  }, _handleTouchStart:function(e) {
    this.fire("touchstart", new TouchEvent(this, e))
  }, _handleTouchEnd:function(e) {
    this.fire("touchend", new TouchEvent(this, e))
  }, _handleTouchMove:function(e) {
    e.preventDefault();
    this.fire("touchmove", new TouchEvent(this, e))
  }, _handleTouchCancel:function(e) {
    this.fire("touchcancel", new TouchEvent(this, e))
  }};
  return{getTouchTargetCoords:function(touch) {
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var target = touch.target;
    while(!(target instanceof HTMLElement)) {
      target = target.parentNode
    }
    var currentElement = target;
    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
      currentElement = currentElement.offsetParent
    }while(currentElement);
    return{x:touch.pageX - totalOffsetX, y:touch.pageY - totalOffsetY}
  }, TouchDevice:TouchDevice}
}());
pc.extend(pc, function() {
  var Controller = function(element, options) {
    options = options || {};
    this._keyboard = options.keyboard || null;
    this._mouse = options.mouse || null;
    this._gamepads = options.gamepads || null;
    this._element = null;
    this._actions = {};
    this._axes = {};
    this._axesValues = {};
    if(element) {
      this.attach(element)
    }
  };
  Controller.prototype.attach = function(element) {
    this._element = element;
    if(this._keyboard) {
      this._keyboard.attach(element)
    }
    if(this._mouse) {
      this._mouse.attach(element)
    }
  };
  Controller.prototype.detach = function() {
    if(this._keyboard) {
      this._keyboard.detach()
    }
    if(this._mouse) {
      this._mouse.detach()
    }
    this._element = null
  };
  Controller.prototype.disableContextMenu = function() {
    if(!this._mouse) {
      this._enableMouse()
    }
    this._mouse.disableContextMenu()
  };
  Controller.prototype.enableContextMenu = function() {
    if(!this._mouse) {
      this._enableMouse()
    }
    this._mouse.enableContextMenu()
  };
  Controller.prototype.update = function(dt) {
    if(this._keyboard) {
      this._keyboard.update(dt)
    }
    if(this._mouse) {
      this._mouse.update(dt)
    }
    if(this._gamepads) {
      this._gamepads.update(dt)
    }
    this._axesValues = {};
    for(var key in this._axes) {
      this._axesValues[key] = []
    }
  };
  Controller.prototype.registerKeys = function(action, keys) {
    if(!this._keyboard) {
      this._enableKeyboard()
    }
    if(this._actions[action]) {
      throw new Error(pc.string.format("Action: {0} already registered", action));
    }
    if(keys === undefined) {
      throw new Error("Invalid button");
    }
    if(!keys.length) {
      keys = [keys]
    }
    if(this._actions[action]) {
      this._actions[action].push({type:pc.ACTION_KEYBOARD, keys:keys})
    }else {
      this._actions[action] = [{type:pc.ACTION_KEYBOARD, keys:keys}]
    }
  };
  Controller.prototype.registerMouse = function(action, button) {
    if(!this._mouse) {
      this._enableMouse()
    }
    if(button === undefined) {
      throw new Error("Invalid button");
    }
    if(this._actions[action]) {
      this._actions[action].push({type:pc.ACTION_MOUSE, button:button})
    }else {
      this._actions[action] = [{type:pc.ACTION_MOUSE, button:-button}]
    }
  };
  Controller.prototype.registerPadButton = function(action, pad, button) {
    if(button === undefined) {
      throw new Error("Invalid button");
    }
    if(this._actions[action]) {
      this._actions[action].push({type:pc.ACTION_GAMEPAD, button:button, pad:pad})
    }else {
      this._actions[action] = [{type:pc.ACTION_GAMEPAD, button:button, pad:pad}]
    }
  };
  Controller.prototype.registerAxis = function(options) {
    var name = options.name;
    if(!this._axes[name]) {
      this._axes[name] = []
    }
    var i = this._axes[name].push(name);
    options = options || {};
    options.pad = options.pad || pc.PAD_1;
    var bind = function(controller, source, value, key) {
      switch(source) {
        case "mousex":
          controller._mouse.on(pc.EVENT_MOUSEMOVE, function(e) {
            controller._axesValues[name][i] = e.dx / 10
          });
          break;
        case "mousey":
          controller._mouse.on(pc.EVENT_MOUSEMOVE, function(e) {
            controller._axesValues[name][i] = e.dy / 10
          });
          break;
        case "key":
          controller._axes[name].push(function() {
            return controller._keyboard.isPressed(key) ? value : 0
          });
          break;
        case "padrx":
          controller._axes[name].push(function() {
            return controller._gamepads.getAxis(options.pad, pc.PAD_R_STICK_X)
          });
          break;
        case "padry":
          controller._axes[name].push(function() {
            return controller._gamepads.getAxis(options.pad, pc.PAD_R_STICK_Y)
          });
          break;
        case "padlx":
          controller._axes[name].push(function() {
            return controller._gamepads.getAxis(options.pad, pc.PAD_L_STICK_X)
          });
          break;
        case "padly":
          controller._axes[name].push(function() {
            return controller._gamepads.getAxis(options.pad, pc.PAD_L_STICK_Y)
          });
          break;
        default:
          throw new Error("Unknown axis");
      }
    };
    bind(this, options.positive, 1, options.positiveKey);
    if(options.negativeKey || options.negative !== options.positive) {
      bind(this, options.negative, -1, options.negativeKey)
    }
  };
  Controller.prototype.isPressed = function(actionName) {
    if(!this._actions[actionName]) {
      return false
    }
    var action;
    var index = 0;
    var length = this._actions[actionName].length;
    for(index = 0;index < length;++index) {
      action = this._actions[actionName][index];
      switch(action.type) {
        case pc.ACTION_KEYBOARD:
          if(this._keyboard) {
            var i, len = action.keys.length;
            for(i = 0;i < len;i++) {
              if(this._keyboard.isPressed(action.keys[i])) {
                return true
              }
            }
          }
          break;
        case pc.ACTION_MOUSE:
          if(this._mouse && this._mouse.isPressed(action.button)) {
            return true
          }
          break;
        case pc.ACTION_GAMEPAD:
          if(this._gamepads && this._gamepads.isPressed(action.pad, action.button)) {
            return true
          }
          break
      }
    }
    return false
  };
  Controller.prototype.wasPressed = function(actionName) {
    if(!this._actions[actionName]) {
      return false
    }
    var index = 0;
    var length = this._actions[actionName].length;
    for(index = 0;index < length;++index) {
      var action = this._actions[actionName][index];
      switch(action.type) {
        case pc.ACTION_KEYBOARD:
          if(this._keyboard) {
            var i, len = action.keys.length;
            for(i = 0;i < len;i++) {
              if(this._keyboard.wasPressed(action.keys[i])) {
                return true
              }
            }
          }
          break;
        case pc.ACTION_MOUSE:
          if(this._mouse && this._mouse.wasPressed(action.button)) {
            return true
          }
          break;
        case pc.ACTION_GAMEPAD:
          if(this._gamepads && this._gamepads.wasPressed(action.pad, action.button)) {
            return true
          }
          break
      }
    }
    return false
  };
  Controller.prototype.getAxis = function(name) {
    var value = 0;
    if(this._axes[name]) {
      var i, len = this._axes[name].length;
      for(i = 0;i < len;i++) {
        if(pc.type(this._axes[name][i]) === "function") {
          var v = this._axes[name][i]();
          if(Math.abs(v) > Math.abs(value)) {
            value = v
          }
        }else {
          if(this._axesValues[name]) {
            if(Math.abs(this._axesValues[name][i]) > Math.abs(value)) {
              value = this._axesValues[name][i]
            }
          }
        }
      }
    }
    return value
  };
  Controller.prototype._enableMouse = function() {
    this._mouse = new pc.Mouse;
    if(!this._element) {
      throw new Error("Controller must be attached to a DOMElement");
    }
    this._mouse.attach(this._element)
  };
  Controller.prototype._enableKeyboard = function() {
    this._keyboard = new pc.Keyboard;
    if(!this._element) {
      throw new Error("Controller must be attached to a DOMElement");
    }
    this._keyboard.attach(this._element)
  };
  return{Controller:Controller}
}());
pc.net = function() {
  return{}
}();
pc.extend(pc.net, function() {
  var Http = function Http() {
  };
  Http.ContentType = {FORM_URLENCODED:"application/x-www-form-urlencoded", GIF:"image/gif", JPEG:"image/jpeg", JSON:"application/json", PNG:"image/png", TEXT:"text/plain", XML:"application/xml", WAV:"audio/x-wav", OGG:"audio/ogg", MP3:"audio/mpeg", BIN:"application/octet-stream"};
  Http.ResponseType = {TEXT:"text", ARRAY_BUFFER:"arraybuffer", BLOB:"blob", DOCUMENT:"document"};
  Http.binaryExtensions = [".model", ".wav", ".ogg", ".mp3"];
  Http.prototype = {ContentType:Http.ContentType, ResponseType:Http.ResponseType, binaryExtensions:Http.binaryExtensions, get:function(url, success, options, xhr) {
    options = options || {};
    options.success = success;
    return this.request("GET", url, options, xhr)
  }, post:function(url, success, data, options, xhr) {
    options = options || {};
    options.success = success;
    options.postdata = data;
    return this.request("POST", url, options, xhr)
  }, put:function(url, success, data, options, xhr) {
    options = options || {};
    options.success = success;
    options.postdata = data;
    return this.request("PUT", url, options, xhr)
  }, del:function(url, success, options, xhr) {
    options = options || {};
    options.success = success;
    return this.request("DELETE", url, options, xhr)
  }, request:function(method, url, options, xhr) {
    var uri, query, timestamp, postdata;
    var errored = false;
    options = options || {};
    if(options.success == null) {
      options.success = function() {
      }
    }
    if(options.error == null) {
      options.error = function() {
      }
    }
    if(options.async == null) {
      options.async = true
    }
    if(options.headers == null) {
      options.headers = {}
    }
    if(options.postdata != null) {
      if(options.postdata instanceof Document) {
        postdata = options.postdata
      }else {
        if(options.postdata instanceof FormData) {
          postdata = options.postdata
        }else {
          if(options.postdata instanceof Object) {
            var contentType = options.headers["Content-Type"];
            if(!pc.isDefined(contentType)) {
              options.headers["Content-Type"] = Http.ContentType.FORM_URLENCODED;
              contentType = options.headers["Content-Type"]
            }
            switch(contentType) {
              case Http.ContentType.FORM_URLENCODED:
                postdata = "";
                var bFirstItem = true;
                for(var key in options.postdata) {
                  if(options.postdata.hasOwnProperty(key)) {
                    if(bFirstItem) {
                      bFirstItem = false
                    }else {
                      postdata += "&"
                    }
                    postdata += escape(key) + "=" + escape(options.postdata[key])
                  }
                }
                break;
              case Http.ContentType.JSON:
              ;
              default:
                if(contentType == null) {
                  options.headers["Content-Type"] = Http.ContentType.JSON
                }
                postdata = JSON.stringify(options.postdata);
                break
            }
          }else {
            postdata = options.postdata
          }
        }
      }
    }
    if(!xhr) {
      xhr = new XMLHttpRequest
    }
    if(options.cache === false) {
      timestamp = pc.time.now();
      uri = new pc.URI(url);
      if(!uri.query) {
        uri.query = "ts=" + timestamp
      }else {
        uri.query = uri.query + "&ts=" + timestamp
      }
      url = uri.toString()
    }
    if(options.query) {
      uri = new pc.URI(url);
      query = pc.extend(uri.getQuery(), options.query);
      uri.setQuery(query);
      url = uri.toString()
    }
    xhr.open(method, url, options.async);
    xhr.withCredentials = true;
    xhr.responseType = options.responseType || this.guessResponseType(url);
    for(var header in options.headers) {
      if(options.headers.hasOwnProperty(header)) {
        xhr.setRequestHeader(header, options.headers[header])
      }
    }
    xhr.onreadystatechange = function() {
      this.onReadyStateChange(method, url, options, xhr)
    }.bind(this);
    xhr.onerror = function() {
      this.onError(method, url, options, xhr);
      errored = true
    }.bind(this);
    try {
      xhr.send(postdata)
    }catch(e) {
      if(!errored) {
        options.error(xhr.status, xhr, e)
      }
    }
    return xhr
  }, guessResponseType:function(url) {
    var uri = new pc.URI(url);
    var ext = pc.path.getExtension(uri.path);
    if(Http.binaryExtensions.indexOf(ext) >= 0) {
      return Http.ResponseType.ARRAY_BUFFER
    }
    return Http.ResponseType.TEXT
  }, isBinaryContentType:function(contentType) {
    var binTypes = [Http.ContentType.WAV, Http.ContentType.OGG, Http.ContentType.MP3, Http.ContentType.BIN];
    if(binTypes.indexOf(contentType) >= 0) {
      return true
    }
    return false
  }, onReadyStateChange:function(method, url, options, xhr) {
    if(xhr.readyState === 4) {
      switch(xhr.status) {
        case 0:
          if(url[0] != "/") {
            this.onSuccess(method, url, options, xhr)
          }
          break;
        case 200:
        ;
        case 201:
        ;
        case 206:
        ;
        case 304:
          this.onSuccess(method, url, options, xhr);
          break;
        default:
          this.onError(method, url, options, xhr);
          break
      }
    }
  }, onSuccess:function(method, url, options, xhr) {
    var response;
    var header;
    var contentType;
    var parameter;
    var parts;
    header = xhr.getResponseHeader("Content-Type");
    if(header) {
      parts = header.split(";");
      contentType = parts[0].trim();
      if(parts[1]) {
        parameter = parts[1].trim()
      }
    }
    if(contentType === this.ContentType.JSON || pc.string.endsWith(url, ".json")) {
      response = JSON.parse(xhr.responseText)
    }else {
      if(this.isBinaryContentType(contentType)) {
        response = xhr.response
      }else {
        if(xhr.responseType === Http.ResponseType.ARRAY_BUFFER) {
          logWARNING(pc.string.format("responseType: {0} being served with Content-Type: {1}", Http.ResponseType.ARRAY_BUFFER, contentType));
          response = xhr.response
        }else {
          if(xhr.responseType === Http.ResponseType.DOCUMENT || contentType === this.ContentType.XML) {
            response = xhr.responseXML
          }else {
            response = xhr.responseText
          }
        }
      }
    }
    options.success(response, xhr.status, xhr)
  }, onError:function(method, url, options, xhr) {
    options.error(xhr.status, xhr, null)
  }};
  Http.prototype.delete_ = Http.prototype.del;
  return{Http:Http, http:new Http}
}());
pc.extend(pc.net, function() {
  var refreshCounter = 0;
  var OAuth = function OAuth(endpoint, redirectUrl, origin, clientId, scope) {
    this.clientId = clientId;
    this.endpoint = endpoint;
    this.redirectUrl = redirectUrl;
    this.origin = origin;
    this.scope = scope;
    this.responseType = "token";
    this.accessToken = null;
    this.OAUTH_IFRAME_ID_BASE = "pc-oauth-access-token-"
  };
  OAuth = pc.inherits(OAuth, pc.net.Http);
  OAuth.prototype.refreshAccessToken = function(success) {
    var id = this.OAUTH_IFRAME_ID_BASE + refreshCounter++;
    var handleMessage = function handleMessage(msg) {
      if(msg.origin !== this.origin) {
        return
      }
      if(msg.data.access_token) {
        var iframe = document.getElementById(id);
        if(iframe) {
          iframe.parentNode.removeChild(iframe)
        }
        this.accessToken = msg.data.access_token;
        success(msg.data.access_token)
      }else {
        if(msg.data.error) {
          logERROR(msg.data.error)
        }else {
          logWARNING("Invalid message posted to Corazon API")
        }
      }
      clearEvent()
    }.bind(this);
    window.addEventListener("message", handleMessage, false);
    var clearEvent = function() {
      window.removeEventListener("message", handleMessage)
    };
    var params = {client_id:this.clientId, redirect_url:this.redirectUrl, scope:this.scope, response_type:this.responseType};
    var url = new pc.URI(this.endpoint);
    url.setQuery(params);
    var iframe = document.getElementById(id);
    if(iframe) {
      throw new Error("accessToken request already in progress");
    }
    iframe = document.createElement("iframe");
    iframe.src = url.toString();
    iframe.id = id;
    iframe.style.display = "none";
    document.body.appendChild(iframe)
  };
  OAuth.prototype.request = function(method, url, options, xhr) {
    options.query = options.query || {};
    options.query = pc.extend(options.query, {"access_token":this.accessToken});
    return pc.net.OAuth._super.request.call(this, method, url, options, xhr)
  };
  OAuth.prototype.onError = function(method, url, options, xhr) {
    if(xhr.status == 401) {
      this.refreshAccessToken(function(accessToken) {
        options.query.access_token = accessToken;
        this.request(method, url, options, xhr)
      }.bind(this))
    }else {
      options.error(xhr.status, xhr, null)
    }
  };
  return{OAuth:OAuth, oauth:new OAuth}
}());
pc.extend(pc.net, function() {
  var Socket = function(url) {
    this._ws = new WebSocket(url);
    this._ws.onopen = this._handleOpen.bind(this);
    this._ws.onerror = this._handleError.bind(this);
    this._ws.onmessage = this._handleMessage.bind(this);
    this._ws.onclose = this._handleClose.bind(this)
  };
  Socket.prototype = {onopen:null, onerror:null, onmessage:null, get binaryType() {
    return this._ws.binaryType
  }, set binaryType(type) {
    this._ws.binaryType = type
  }, get readyState() {
    return this._ws.readyState
  }, get bufferedAmount() {
    return this._ws.bufferedAmount
  }, get extensions() {
    return this._ws.extensions
  }, get protocol() {
    return this._ws.protocol
  }, _handleOpen:function() {
    if(this.onopen) {
      this.onopen()
    }
  }, _handleError:function(error) {
    if(this.onerror) {
      this.onerror(error)
    }
  }, _handleMessage:function(msg) {
    if(this.onmessage) {
      this.onmessage(msg)
    }
  }, _handleClose:function() {
    if(this.onclose) {
      this.onclose()
    }
  }, send:function(msg) {
    this._ws.send(msg)
  }};
  return{Socket:Socket}
}());
pc.script = function() {
  var _main = null;
  var _loader = null;
  var script = {main:function(callback) {
    if(_main) {
      throw new Error("'main' Object already registered");
    }
    _main = callback
  }, setLoader:function(loader) {
    if(loader && _loader) {
      throw new Error("pc.script already has loader object.");
    }
    _loader = loader
  }, create:function(name, callback) {
    if(callback === undefined) {
      callback = attributes
    }
    this.fire("created", name, callback)
  }, attribute:function(name, type, defaultValue, options) {
  }, start:function() {
    _main()
  }};
  pc.events.attach(script);
  return script
}();
var editor = editor || {};
pc.extend(editor, function() {
  var LinkInterface = function() {
    this.exposed = {};
    this.added = {};
    this.scripts = {};
    this.systems = []
  };
  LinkInterface.prototype = {addComponentType:function() {
  }, expose:function() {
  }, add:function() {
  }, scriptexpose:function() {
  }};
  return{LinkInterface:LinkInterface, link:new LinkInterface}
}());
pc.extend(editor, function() {
  var LinkInterface = function() {
    this.exposed = {};
    this.added = {};
    this.scripts = {};
    this.systems = []
  };
  LinkInterface.prototype.addComponentType = function(componentSystem) {
    var name = componentSystem.id;
    var i;
    var systems = this.systems;
    var length = systems.length;
    var exists = false;
    for(i = 0;i < length;i++) {
      if(systems[i].name === name) {
        exists = true;
        break
      }
    }
    if(!exists) {
      this.systems.push({"name":name, "description":componentSystem.description})
    }
    if(!this.exposed[name]) {
      this.exposed[name] = {}
    }
  };
  LinkInterface.prototype.expose = function(system, details) {
    if(!details.name) {
      throw new Error("Missing option 'name'");
    }
    details.options = details.options || {};
    if(details.type === "vector") {
      details.array = true;
      if(details.defaultValue) {
        switch(details.defaultValue.length) {
          case 2:
            details.RuntimeType = pc.Vec2;
            break;
          case 3:
            details.RuntimeType = pc.Vec3;
            break;
          case 4:
            details.RuntimeType = pc.Vec4;
            break
        }
      }else {
        details.RuntimeType = pc.Vec3
      }
    }else {
      if(details.type === "rgb" || details.type === "rgba") {
        details.array = true;
        details.RuntimeType = pc.Color
      }else {
        if(details.type === "curve") {
          details.object = true;
          details.RuntimeType = pc.Curve
        }else {
          if(details.type === "curveset") {
            details.object = true;
            details.RuntimeType = pc.CurveSet
          }
        }
      }
    }
    if(!this.exposed[system][details.name]) {
      this.exposed[system][details.name] = {}
    }
    this.exposed[system][details.name] = details
  };
  LinkInterface.prototype.add = function(details) {
    logASSERT(details.system, "Missing option: 'system'");
    logASSERT(details.variable, "Missing option: 'variable'");
    if(!this.added[details.system]) {
      this.added[details.system] = {}
    }
    if(!this.added[details.system][details.variable]) {
      this.added[details.system][details.variable] = {}
    }
    this.added[details.system][details.variable] = details
  };
  LinkInterface.prototype.scriptexpose = function(details) {
    this.scripts[details.script] = details
  };
  return{LinkInterface:LinkInterface, link:new LinkInterface}
}());
pc.extend(pc, function() {
  var ContentFile = function(data) {
    this.packs = data.packs || {};
    this.appProperties = data.application_properties || {};
    this.toc = data.toc || {}
  };
  return{ContentFile:ContentFile}
}());
pc.extend(pc, function() {
  var Pack = function(data) {
    this.hierarchy = data.hierarchy;
    this.settings = data.settings
  };
  return{Pack:Pack}
}());
pc.extend(pc, function() {
  var Application = function(canvas, options) {
    options = options || {};
    pc.log.open();
    pc.events.attach(this);
    this._time = 0;
    this._librariesLoaded = false;
    this._fillMode = pc.FILLMODE_KEEP_ASPECT;
    this._resolutionMode = pc.RESOLUTION_FIXED;
    this.context = this;
    this.graphicsDevice = new pc.GraphicsDevice(canvas);
    this.systems = new pc.ComponentSystemRegistry;
    this._audioManager = new pc.AudioManager;
    this.loader = new pc.resources.ResourceLoader;
    this.scene = new pc.Scene;
    this.root = new pc.fw.Entity(this);
    this.assets = new pc.asset.AssetRegistry(this.loader);
    this.renderer = new pc.ForwardRenderer(this.graphicsDevice);
    this.keyboard = options.keyboard || null;
    this.mouse = options.mouse || null;
    this.touch = options.touch || null;
    this.gamepads = options.gamepads || null;
    this.content = null;
    this._inTools = false;
    this._link = new pc.LiveLink("application");
    this._link.addDestinationWindow(window);
    this._link.listen(this._handleMessage.bind(this));
    if(options.cache === false) {
      this.loader.cache = false
    }
    if(options.displayLoader) {
      var loaderdisplay = new pc.resources.ResourceLoaderDisplay(document.body, this.loader)
    }
    if(options.content) {
      this.content = options.content;
      Object.keys(this.content.toc).forEach(function(key) {
        this.assets.addGroup(key, this.content.toc[key])
      }.bind(this))
    }
    var textureCache = new pc.resources.TextureCache(this.loader);
    this.loader.registerHandler(pc.resources.JsonRequest, new pc.resources.JsonResourceHandler);
    this.loader.registerHandler(pc.resources.TextRequest, new pc.resources.TextResourceHandler);
    this.loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler);
    this.loader.registerHandler(pc.resources.MaterialRequest, new pc.resources.MaterialResourceHandler(this.graphicsDevice, this.assets));
    this.loader.registerHandler(pc.resources.TextureRequest, new pc.resources.TextureResourceHandler(this.graphicsDevice, this.assets));
    this.loader.registerHandler(pc.resources.CubemapRequest, new pc.resources.CubemapResourceHandler(this.graphicsDevice, this.assets));
    this.loader.registerHandler(pc.resources.ModelRequest, new pc.resources.ModelResourceHandler(this.graphicsDevice, this.assets));
    this.loader.registerHandler(pc.resources.AnimationRequest, new pc.resources.AnimationResourceHandler);
    this.loader.registerHandler(pc.resources.PackRequest, new pc.resources.PackResourceHandler(this, options.depot));
    this.loader.registerHandler(pc.resources.AudioRequest, new pc.resources.AudioResourceHandler(this._audioManager));
    this.loader.registerHandler(pc.resources.ScriptRequest, new pc.resources.ScriptResourceHandler(this, options.scriptPrefix));
    var rigidbodysys = new pc.RigidBodyComponentSystem(this);
    var collisionsys = new pc.CollisionComponentSystem(this);
    var ballsocketjointsys = new pc.BallSocketJointComponentSystem(this);
    var animationsys = new pc.AnimationComponentSystem(this);
    var modelsys = new pc.ModelComponentSystem(this);
    var camerasys = new pc.CameraComponentSystem(this);
    var lightsys = new pc.LightComponentSystem(this);
    var packsys = new pc.PackComponentSystem(this);
    var skyboxsys = new pc.SkyboxComponentSystem(this);
    var scriptsys = new pc.ScriptComponentSystem(this);
    var picksys = new pc.PickComponentSystem(this);
    var audiosourcesys = new pc.AudioSourceComponentSystem(this, this._audioManager);
    var audiolistenersys = new pc.AudioListenerComponentSystem(this, this._audioManager);
    var particlesystemsys = new pc.ParticleSystemComponentSystem(this);
    var designersys = new pc.DesignerComponentSystem(this);
    this.on("librariesloaded", this.onLibrariesLoaded, this);
    if(options.libraries && options.libraries.length) {
      var requests = options.libraries.map(function(url) {
        return new pc.resources.ScriptRequest(url)
      });
      this.loader.request(requests).then(function(resources) {
        this.fire("librariesloaded", this);
        this._librariesLoaded = true
      }.bind(this))
    }else {
      this.fire("librariesloaded", this);
      this._librariesLoaded = true
    }
    if(document.hidden !== undefined) {
      this._hiddenAttr = "hidden";
      document.addEventListener("visibilitychange", this.onVisibilityChange.bind(this), false)
    }else {
      if(document.mozHidden !== undefined) {
        this._hiddenAttr = "mozHidden";
        document.addEventListener("mozvisibilitychange", this.onVisibilityChange.bind(this), false)
      }else {
        if(document.msHidden !== undefined) {
          this._hiddenAttr = "msHidden";
          document.addEventListener("msvisibilitychange", this.onVisibilityChange.bind(this), false)
        }else {
          if(document.webkitHidden !== undefined) {
            this._hiddenAttr = "webkitHidden";
            document.addEventListener("webkitvisibilitychange", this.onVisibilityChange.bind(this), false)
          }
        }
      }
    }
    Application._applications[this.graphicsDevice.canvas.id] = this;
    Application._currentApplication = this
  };
  Application._currentApplication = null;
  Application._applications = {};
  Application.getApplication = function(id) {
    if(id) {
      return Application._applications[id]
    }else {
      return Application._currentApplication
    }
  };
  Application.prototype = {loadFromToc:function(name, success, error, progress) {
    if(!this.content) {
      error("No content")
    }
    var toc = this.content.toc[name];
    success = success || function() {
    };
    error = error || function() {
    };
    progress = progress || function() {
    };
    var requests = [];
    var guid = toc.packs[0];
    var onLoaded = function(resources) {
      this.loader.request(new pc.resources.PackRequest(guid)).then(function(resources) {
        var pack = resources[0];
        this.root.addChild(pack.hierarchy);
        pc.ComponentSystem.initialize(pack.hierarchy);
        pc.ComponentSystem.postInitialize(pack.hierarchy);
        if(this.systems.rigidbody && typeof Ammo !== "undefined") {
          var gravity = pack.settings.physics.gravity;
          this.systems.rigidbody.setGravity(gravity[0], gravity[1], gravity[2])
        }
        var ambientLight = pack.settings.render.global_ambient;
        this.scene.ambientLight = new pc.Color(ambientLight[0], ambientLight[1], ambientLight[2]);
        this.scene.fog = pack.settings.render.fog;
        var fogColor = pack.settings.render.fog_color;
        this.scene.fogColor = new pc.Color(fogColor[0], fogColor[1], fogColor[2]);
        this.scene.fogStart = pack.settings.render.fog_start;
        this.scene.fogEnd = pack.settings.render.fog_end;
        this.scene.fogDensity = pack.settings.render.fog_density;
        this.scene.gammaCorrection = pack.settings.render.gamma_correction;
        this.scene.toneMapping = pack.settings.render.tonemapping;
        this.scene.exposure = pack.settings.render.exposure;
        if(pack.settings.render.skybox) {
          var skybox = this.assets.getAssetById(pack.settings.render.skybox);
          this.scene.skybox = skybox ? skybox.resource : null
        }
        success(pack);
        this.loader.off("progress", progress)
      }.bind(this), function(msg) {
        error(msg)
      }).then(null, function(error) {
        setTimeout(function() {
          throw error;
        }, 0)
      })
    }.bind(this);
    var load = function() {
      var assets = this.assets.list(guid);
      this.loader.on("progress", progress);
      if(assets.length) {
        this.assets.load(assets).then(function(resources) {
          onLoaded(resources)
        })
      }else {
        setTimeout(function() {
          onLoaded([])
        }, 0)
      }
    }.bind(this);
    if(!this._librariesLoaded) {
      this.on("librariesloaded", function() {
        load()
      })
    }else {
      load()
    }
  }, start:function() {
    if(!this._librariesLoaded) {
      this.on("librariesloaded", function() {
        this.tick()
      }, this)
    }else {
      this.tick()
    }
  }, update:function(dt) {
    pc.ComponentSystem.fixedUpdate(1 / 60, this._inTools);
    pc.ComponentSystem.update(dt, this._inTools);
    pc.ComponentSystem.postUpdate(dt, this._inTools);
    this.fire("update", dt);
    if(this.controller) {
      this.controller.update(dt)
    }
    if(this.mouse) {
      this.mouse.update(dt)
    }
    if(this.keyboard) {
      this.keyboard.update(dt)
    }
    if(this.gamepads) {
      this.gamepads.update(dt)
    }
  }, render:function() {
    var cameras = this.systems.camera.cameras;
    var camera = null;
    var renderer = this.renderer;
    this.root.syncHierarchy();
    for(var i = 0, len = cameras.length;i < len;i++) {
      camera = cameras[i];
      camera.frameBegin();
      renderer.render(this.scene, camera.camera);
      camera.frameEnd()
    }
  }, tick:function() {
    Application._currentApplication = this;
    window.requestAnimationFrame(this.tick.bind(this));
    var now = window.performance && window.performance.now ? performance.now() : Date.now();
    var dt = (now - (this._time || now)) / 1E3;
    this._time = now;
    dt = pc.math.clamp(dt, 0, 0.1);
    this.update(dt);
    this.render()
  }, setCanvasFillMode:function(mode, width, height) {
    this._fillMode = mode;
    this.resizeCanvas(width, height)
  }, setCanvasResolution:function(mode, width, height) {
    this._resolutionMode = mode;
    if(mode === pc.RESOLUTION_AUTO && width === undefined) {
      width = this.graphicsDevice.canvas.clientWidth;
      height = this.graphicsDevice.canvas.clientHeight
    }
    this.graphicsDevice.resizeCanvas(width, height)
  }, isFullscreen:function() {
    return!!document.fullscreenElement
  }, enableFullscreen:function(element, success, error) {
    element = element || this.graphicsDevice.canvas;
    var s = function() {
      success();
      document.removeEventListener("fullscreenchange", s)
    };
    var e = function() {
      error();
      document.removeEventListener("fullscreenerror", e)
    };
    if(success) {
      document.addEventListener("fullscreenchange", s, false)
    }
    if(error) {
      document.addEventListener("fullscreenerror", e, false)
    }
    element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
  }, disableFullscreen:function(success) {
    var s = function() {
      success();
      document.removeEventListener("fullscreenchange", s)
    };
    if(success) {
      document.addEventListener("fullscreenchange", s, false)
    }
    document.exitFullscreen()
  }, isHidden:function() {
    return document[this._hiddenAttr]
  }, onVisibilityChange:function(e) {
    if(this.isHidden()) {
      this._audioManager.suspend()
    }else {
      this._audioManager.resume()
    }
  }, resizeCanvas:function(width, height) {
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    if(navigator.isCocoonJS) {
      width = windowWidth;
      height = windowHeight;
      var ratio = window.devicePixelRatio;
      this.graphicsDevice.resizeCanvas(width * ratio, height * ratio)
    }else {
      if(this._fillMode === pc.FILLMODE_KEEP_ASPECT) {
        var r = this.graphicsDevice.canvas.width / this.graphicsDevice.canvas.height;
        var winR = windowWidth / windowHeight;
        if(r > winR) {
          width = windowWidth;
          height = width / r
        }else {
          height = windowHeight;
          width = height * r
        }
      }else {
        if(this._fillMode === pc.FILLMODE_FILL_WINDOW) {
          width = windowWidth;
          height = windowHeight
        }else {
        }
      }
      this.graphicsDevice.canvas.style.width = width + "px";
      this.graphicsDevice.canvas.style.height = height + "px";
      if(this._resolutionMode === pc.RESOLUTION_AUTO) {
        this.setCanvasResolution(pc.RESOLUTION_AUTO)
      }
    }
    return{width:width, height:height}
  }, onLibrariesLoaded:function() {
    this.systems.rigidbody.onLibraryLoaded();
    this.systems.collision.onLibraryLoaded()
  }, _handleMessage:function(msg) {
    var entity;
    switch(msg.type) {
      case pc.LiveLinkMessageType.UPDATE_COMPONENT:
        this._linkUpdateComponent(msg.content.id, msg.content.component, msg.content.attribute, msg.content.value);
        break;
      case pc.LiveLinkMessageType.UPDATE_ENTITY:
        this._linkUpdateEntity(msg.content.id, msg.content.components);
        break;
      case pc.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM:
        this._linkUpdateEntityTransform(msg.content.id, msg.content.position, msg.content.rotation, msg.content.scale);
        break;
      case pc.LiveLinkMessageType.UPDATE_ENTITY_NAME:
        entity = this.root.findOne("getGuid", msg.content.id);
        entity.setName(msg.content.name);
        break;
      case pc.LiveLinkMessageType.UPDATE_ENTITY_ENABLED:
        entity = this.root.findOne("getGuid", msg.content.id);
        entity.enabled = msg.content.enabled;
        break;
      case pc.LiveLinkMessageType.REPARENT_ENTITY:
        this._linkReparentEntity(msg.content.id, msg.content.newParentId, msg.content.index);
        break;
      case pc.LiveLinkMessageType.CLOSE_ENTITY:
        entity = this.root.findOne("getGuid", msg.content.id);
        if(entity) {
          logDEBUG(pc.string.format("RT: Removed '{0}' from parent {1}", msg.content.id, entity.getParent().getGuid()));
          entity.destroy()
        }
        break;
      case pc.LiveLinkMessageType.OPEN_PACK:
        var pack = this.loader.open(pc.resources.PackRequest, msg.content.pack);
        var entity = pack.hierarchy;
        if(entity.__parent) {
          parent = this.root.findByGuid(entity.__parent);
          parent.addChild(entity)
        }else {
          this.root.addChild(entity)
        }
        break;
      case pc.LiveLinkMessageType.OPEN_ENTITY:
        var parent;
        var entities = {};
        var guid = null;
        if(msg.content.entity) {
          var pack = {application_data:{}, hierarchy:msg.content.entity};
          pack = this.loader.open(pc.resources.PackRequest, pack);
          entity = pack.hierarchy;
          if(entity.__parent) {
            parent = this.root.findByGuid(entity.__parent);
            parent.addChild(entity)
          }else {
            this.root.addChild(entity)
          }
        }
        break;
      case pc.LiveLinkMessageType.UPDATE_ASSET:
        this._linkUpdateAsset(msg.content.id, msg.content.attribute, msg.content.value);
        break;
      case pc.LiveLinkMessageType.UPDATE_ASSETCACHE:
        var id;
        var asset;
        for(id in msg.content.assets) {
          asset = this.assets.getAssetById(id);
          if(!asset) {
            this.assets.createAndAddAsset(id, msg.content.assets[id])
          }else {
            var data = msg.content.assets[id];
            for(var key in data) {
              if(data.hasOwnProperty(key)) {
                asset[key] = data[key]
              }
            }
          }
        }
        for(id in msg.content.deleted) {
          asset = this.assets.getAssetById(id);
          if(asset) {
            this.assets.removeAsset(asset)
          }
        }
        break;
      case pc.LiveLinkMessageType.UPDATE_PACK_SETTINGS:
        this._linkUpdatePackSettings(msg.content.settings);
        break
    }
  }, _linkUpdateComponent:function(guid, componentName, attributeName, value) {
    var entity = this.root.findOne("getGuid", guid);
    var attribute;
    if(entity) {
      if(componentName) {
        if(entity[componentName]) {
          attribute = editor.link.exposed[componentName][attributeName];
          if(editor && attribute) {
            if(attribute.RuntimeType) {
              if(attribute.RuntimeType === pc.Vec3) {
                entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2])
              }else {
                if(attribute.RuntimeType === pc.Vec4) {
                  entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2], value[3])
                }else {
                  if(attribute.RuntimeType === pc.Vec2) {
                    entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1])
                  }else {
                    if(attribute.RuntimeType === pc.Color) {
                      if(value.length === 3) {
                        entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2])
                      }else {
                        entity[componentName][attributeName] = new attribute.RuntimeType(value[0], value[1], value[2], value[3])
                      }
                    }else {
                      if(attribute.RuntimeType === pc.Curve || attribute.RuntimeType === pc.CurveSet) {
                        entity[componentName][attributeName] = new attribute.RuntimeType(value.keys);
                        entity[componentName][attributeName].type = value.type
                      }else {
                        entity[componentName][attributeName] = new attribute.RuntimeType(value)
                      }
                    }
                  }
                }
              }
            }else {
              entity[componentName][attributeName] = value
            }
          }else {
            entity[componentName][attributeName] = value
          }
        }else {
          logWARNING(pc.string.format("No component system called '{0}' exists", componentName))
        }
      }else {
        entity[attributeName] = value
      }
    }
  }, _linkUpdateEntityTransform:function(guid, position, rotation, scale) {
    var entity = this.root.findByGuid(guid);
    if(entity) {
      entity.setLocalPosition(position[0], position[1], position[2]);
      entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
      entity.setLocalScale(scale[0], scale[1], scale[2]);
      entity.fire("livelink:updatetransform", position, rotation, scale)
    }
  }, _linkReparentEntity:function(guid, parentId, index) {
    var entity = this.root.findByGuid(guid);
    var parent = this.root.findByGuid(parentId);
    entity.reparent(parent, index)
  }, _linkUpdateEntity:function(guid, components) {
    var type;
    var entity = this.root.findOne("getGuid", guid);
    if(entity) {
      var order = this.systems.getComponentSystemOrder();
      var i, len = order.length;
      for(i = 0;i < len;i++) {
        type = order[i];
        if(components.hasOwnProperty(type) && this.systems.hasOwnProperty(type)) {
          if(!entity[type]) {
            this.systems[type].addComponent(entity, {})
          }
        }
      }
      for(type in this.systems) {
        if(type === "gizmo" || type === "pick") {
          continue
        }
        if(this.systems.hasOwnProperty(type)) {
          if(!components.hasOwnProperty(type) && entity[type]) {
            this.systems[type].removeComponent(entity)
          }
        }
      }
    }
  }, _linkUpdateAsset:function(id, attribute, value) {
    var asset = this.assets.getAssetById(id);
    if(asset) {
      asset[attribute] = value
    }
  }, _linkUpdatePackSettings:function(settings) {
    var ambient = settings.render.global_ambient;
    this.scene.ambientLight.set(ambient[0], ambient[1], ambient[2]);
    if(this.systems.rigidbody && typeof Ammo !== "undefined") {
      var gravity = settings.physics.gravity;
      this.systems.rigidbody.setGravity(gravity[0], gravity[1], gravity[2])
    }
    this.scene.fog = settings.render.fog;
    this.scene.fogStart = settings.render.fog_start;
    this.scene.fogEnd = settings.render.fog_end;
    var fog = settings.render.fog_color;
    this.scene.fogColor = new pc.Color(fog[0], fog[1], fog[2]);
    this.scene.fogDensity = settings.render.fog_density;
    this.scene.gammaCorrection = settings.render.gamma_correction;
    this.scene.toneMapping = settings.render.tonemapping;
    this.scene.exposure = settings.render.exposure;
    if(settings.render.skybox) {
      var skybox = this.assets.getAssetById(settings.render.skybox);
      if(!skybox) {
        pc.log.error("Could not initialize scene skybox. Missing cubemap asset " + settings.render.skybox)
      }else {
        if(!skybox.resource) {
          this.assets.load([skybox]).then(function(resources) {
            this.scene.skybox = resources[0]
          }.bind(this), function(error) {
            pc.log.error("Could not initialize scene skybox. Missing cubemap asset " + settings.render.skybox)
          })
        }else {
          this.scene.skybox = skybox.resource
        }
      }
    }else {
      this.scene.skybox = null
    }
  }};
  return{FILLMODE_NONE:"NONE", FILLMODE_FILL_WINDOW:"FILL_WINDOW", FILLMODE_KEEP_ASPECT:"KEEP_ASPECT", RESOLUTION_AUTO:"AUTO", RESOLUTION_FIXED:"FIXED", Application:Application}
}());
pc.extend(pc, function() {
  var ComponentSystemRegistry = function() {
  };
  ComponentSystemRegistry.prototype = {add:function(name, system) {
    if(!this[name]) {
      this[name] = system;
      system.name = name
    }else {
      throw new Error(pc.string.format("ComponentSystem name '{0}' already registered or not allowed", name));
    }
  }, remove:function(name) {
    if(!this[name]) {
      throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", name));
    }
    delete this[name]
  }, list:function() {
    var list = Object.keys(this);
    var defaultPriority = 1;
    var priorities = {"collisionrect":0.5, "collisioncircle":0.5};
    list.sort(function(a, b) {
      var pa = priorities[a] || defaultPriority;
      var pb = priorities[b] || defaultPriority;
      if(pa < pb) {
        return-1
      }else {
        if(pa > pb) {
          return 1
        }
      }
      return 0
    });
    return list.map(function(key) {
      return this[key]
    }, this)
  }, getComponentSystemOrder:function() {
    var index;
    var names = Object.keys(this);
    index = names.indexOf("collisionrect");
    names.splice(index, 1);
    names.unshift("collisionrect");
    index = names.indexOf("collisioncircle");
    names.splice(index, 1);
    names.unshift("collisioncircle");
    return names
  }};
  return{ComponentSystemRegistry:ComponentSystemRegistry}
}());
pc.extend(pc, function() {
  var ComponentSystem = function(app) {
    this.app = app;
    this.dataStore = {};
    this.schema = [];
    pc.events.attach(this)
  };
  pc.extend(ComponentSystem, {initialize:function(root) {
    ComponentSystem.fire("initialize", root)
  }, postInitialize:function(root) {
    ComponentSystem.fire("postInitialize", root)
  }, update:function(dt, inTools) {
    if(inTools) {
      ComponentSystem.fire("toolsUpdate", dt)
    }else {
      ComponentSystem.fire("update", dt)
    }
  }, fixedUpdate:function(dt, inTools) {
    ComponentSystem.fire("fixedUpdate", dt)
  }, postUpdate:function(dt, inTools) {
    ComponentSystem.fire("postUpdate", dt)
  }});
  ComponentSystem.prototype = {get store() {
    return this.dataStore
  }, addComponent:function(entity, data) {
    var component = new this.ComponentType(this, entity);
    var componentData = new this.DataType;
    data = data || {};
    this.dataStore[entity.getGuid()] = {entity:entity, data:componentData};
    entity[this.id] = component;
    entity.c[this.id] = component;
    this.initializeComponentData(component, data, []);
    this.fire("add", entity, component);
    return component
  }, removeComponent:function(entity) {
    var record = this.dataStore[entity.getGuid()];
    var component = entity.c[this.id];
    this.fire("beforeremove", entity, component);
    delete this.dataStore[entity.getGuid()];
    delete entity[this.id];
    delete entity.c[this.id];
    this.fire("remove", entity, record.data)
  }, cloneComponent:function(entity, clone) {
    var src = this.dataStore[entity.getGuid()];
    return this.addComponent(clone, src.data)
  }, initializeComponentData:function(component, data, properties) {
    data = data || {};
    properties.forEach(function(value) {
      if(data[value] !== undefined) {
        component[value] = data[value]
      }else {
        component[value] = component.data[value]
      }
    }, this);
    if(component.enabled && component.entity.enabled) {
      component.onEnable()
    }
  }, exposeProperties:function() {
    editor.link.addComponentType(this);
    this.schema.forEach(function(prop) {
      if(prop.exposed !== false) {
        editor.link.expose(this.id, prop)
      }
    }.bind(this))
  }};
  pc.events.attach(ComponentSystem);
  return{ComponentSystem:ComponentSystem}
}());
pc.extend(pc, function() {
  var Component = function(system, entity) {
    this.system = system;
    this.entity = entity;
    pc.events.attach(this);
    this.buildAccessors(this.system.schema);
    this.on("set", function(name, oldValue, newValue) {
      this.fire("set_" + name, name, oldValue, newValue)
    });
    this.on("set_enabled", this.onSetEnabled, this)
  };
  Component.prototype = {get data() {
    var record = this.system.store[this.entity.getGuid()];
    if(record) {
      return record.data
    }else {
      return null
    }
  }, buildAccessors:function(schema) {
    schema.forEach(function(prop) {
      var set;
      if(prop.readOnly) {
        Object.defineProperty(this, prop.name, {get:function() {
          return this.data[prop.name]
        }, configurable:true})
      }else {
        Object.defineProperty(this, prop.name, {get:function() {
          return this.data[prop.name]
        }, set:function(value) {
          var data = this.data;
          var oldValue = data[prop.name];
          data[prop.name] = value;
          this.fire("set", prop.name, oldValue, value)
        }, configurable:true})
      }
    }.bind(this))
  }, onSetEnabled:function(name, oldValue, newValue) {
    if(oldValue !== newValue) {
      if(this.entity.enabled) {
        if(newValue) {
          this.onEnable()
        }else {
          this.onDisable()
        }
      }
    }
  }, onEnable:function() {
  }, onDisable:function() {
  }};
  return{Component:Component}
}());
pc.extend(pc, function() {
  var ComponentData = function() {
  };
  return{ComponentData:ComponentData}
}());
pc.extend(pc, function() {
  var AnimationComponent = function(system, entity) {
    this.on("set_animations", this.onSetAnimations, this);
    this.on("set_assets", this.onSetAssets, this);
    this.on("set_loop", this.onSetLoop, this)
  };
  AnimationComponent = pc.inherits(AnimationComponent, pc.Component);
  pc.extend(AnimationComponent.prototype, {play:function(name, blendTime) {
    if(!this.data.animations[name]) {
      console.error(pc.string.format("Trying to play animation '{0}' which doesn't exist", name));
      return
    }
    if(!this.enabled || !this.entity.enabled) {
      return
    }
    blendTime = blendTime || 0;
    var data = this.data;
    data.prevAnim = data.currAnim;
    data.currAnim = name;
    if(data.model) {
      data.blending = blendTime > 0;
      if(data.blending) {
        data.blendTime = blendTime;
        data.blendTimeRemaining = blendTime;
        data.fromSkel.setAnimation(data.animations[data.prevAnim]);
        data.fromSkel.addTime(data.skeleton.getCurrentTime());
        data.toSkel.setAnimation(data.animations[data.currAnim])
      }else {
        data.skeleton.setAnimation(data.animations[data.currAnim])
      }
    }
    data.playing = true
  }, getAnimation:function(name) {
    return this.data.animations[name]
  }, setModel:function(model) {
    var data = this.data;
    if(model) {
      var graph = model.getGraph();
      data.fromSkel = new pc.Skeleton(graph);
      data.toSkel = new pc.Skeleton(graph);
      data.skeleton = new pc.Skeleton(graph);
      data.skeleton.setLooping(data.loop);
      data.skeleton.setGraph(graph)
    }
    data.model = model;
    if(data.animations && data.currAnim && data.animations[data.currAnim]) {
      this.play(data.currAnim)
    }
  }, loadAnimationAssets:function(ids) {
    if(!ids || !ids.length) {
      return
    }
    var options = {parent:this.entity.getRequest()};
    var assets = ids.map(function(id) {
      return this.system.app.assets.getAssetById(id)
    }, this);
    var animations = {};
    var names = [];
    var requests = [];
    for(var i = 0, len = assets.length;i < len;i++) {
      var asset = assets[i];
      if(!asset) {
        logERROR(pc.string.format("Trying to load animation component before assets {0} are loaded", ids))
      }else {
        asset.off("change", this.onAssetChanged, this);
        asset.on("change", this.onAssetChanged, this);
        if(asset.resource) {
          animations[asset.name] = asset.resource
        }else {
          names.push(asset.name);
          requests.push(new pc.resources.AnimationRequest(asset.getFileUrl()))
        }
      }
    }
    if(requests.length) {
      this.system.app.loader.request(requests, options).then(function(animResources) {
        for(var i = 0;i < requests.length;i++) {
          animations[names[i]] = animResources[i]
        }
        this.animations = animations
      }.bind(this))
    }else {
      this.animations = animations
    }
  }, onAssetChanged:function(asset, attribute, newValue, oldValue) {
    if(attribute === "resource") {
      if(newValue) {
        this.animations[asset.name] = newValue;
        if(this.data.currAnim === asset.name) {
          if(this.data.playing && this.data.enabled && this.entity.enabled) {
            this.play(asset.name, 0)
          }
        }
      }else {
        delete this.animations[asset.name]
      }
    }
  }, onSetAnimations:function(name, oldValue, newValue) {
    var data = this.data;
    var modelComponent = this.entity.model;
    if(modelComponent) {
      var m = modelComponent.model;
      if(m) {
        this.entity.animation.setModel(m)
      }
    }
    for(var animName in data.animations) {
      if(data.activate && data.enabled && this.entity.enabled) {
        this.play(animName, 0)
      }
      break
    }
  }, onSetAssets:function(name, oldValue, newValue) {
    if(oldValue && oldValue.length) {
      for(var i = 0;i < oldValue.length;i++) {
        if(oldValue[i]) {
          var asset = this.system.app.assets.getAssetById(oldValue[i]);
          if(asset) {
            asset.off("change", this.onAssetChanged, this)
          }
        }
      }
    }
    this.loadAnimationAssets(newValue)
  }, onSetLoop:function(name, oldValue, newValue) {
    if(this.data.skeleton) {
      this.data.skeleton.setLooping(this.data.loop)
    }
  }, onSetCurrentTime:function(name, oldValue, newValue) {
    this.data.skeleton.setCurrentTime(newValue);
    this.data.skeleton.addTime(0);
    this.data.skeleton.updateGraph()
  }, onEnable:function() {
    AnimationComponent._super.onEnable.call(this);
    if(this.data.activate && !this.data.currAnim) {
      for(var animName in this.data.animations) {
        this.play(animName, 0);
        break
      }
    }
  }});
  Object.defineProperties(AnimationComponent.prototype, {currentTime:{get:function() {
    return this.data.skeleton.getCurrentTime()
  }, set:function(currentTime) {
    this.data.skeleton.setCurrentTime(currentTime);
    this.data.skeleton.addTime(0);
    this.data.skeleton.updateGraph()
  }}, duration:{get:function() {
    return this.data.animations[this.data.currAnim].getDuration()
  }}});
  return{AnimationComponent:AnimationComponent}
}());
pc.extend(pc, function() {
  var AnimationComponentSystem = function AnimationComponentSystem(app) {
    this.id = "animation";
    this.description = "Specifies the animation assets that can run on the model specified by the Entity's model Component.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.AnimationComponent;
    this.DataType = pc.AnimationComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enable or disable the component", type:"boolean", defaultValue:true}, {name:"assets", displayName:"Asset", description:"Animation Asset", type:"asset", options:{max:100, type:"animation"}, defaultValue:[]}, {name:"speed", displayName:"Speed Factor", description:"Scale the animation playback speed", type:"number", options:{step:0.1}, defaultValue:1}, {name:"loop", displayName:"Loop", description:"Loop the animation back to the start on completion", 
    type:"boolean", defaultValue:true}, {name:"activate", displayName:"Activate", description:"Play the configured animation on load", type:"boolean", defaultValue:true}, {name:"animations", exposed:false}, {name:"skeleton", exposed:false, readOnly:true}, {name:"model", exposed:false, readOnly:true}, {name:"prevAnim", exposed:false, readOnly:true}, {name:"currAnim", exposed:false, readOnly:true}, {name:"fromSkel", exposed:false, readOnly:true}, {name:"toSkel", exposed:false, readOnly:true}, {name:"blending", 
    exposed:false, readOnly:true}, {name:"blendTime", exposed:false, readOnly:true}, {name:"blendTimeRemaining", exposed:false, readOnly:true}, {name:"playing", exposed:false, readOnly:true}];
    this.exposeProperties();
    this.on("remove", this.onRemove, this);
    this.on("update", this.onUpdate, this);
    pc.ComponentSystem.on("update", this.onUpdate, this)
  };
  AnimationComponentSystem = pc.inherits(AnimationComponentSystem, pc.ComponentSystem);
  pc.extend(AnimationComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    properties = ["activate", "loop", "speed", "assets", "enabled"];
    AnimationComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, cloneComponent:function(entity, clone) {
    var component = this.addComponent(clone, {});
    clone.animation.data.assets = pc.extend([], entity.animation.assets);
    clone.animation.data.speed = entity.animation.speed;
    clone.animation.data.loop = entity.animation.loop;
    clone.animation.data.activate = entity.animation.activate;
    clone.animation.data.enabled = entity.animation.enabled;
    clone.animation.animations = pc.extend({}, entity.animation.animations)
  }, onRemove:function(entity, data) {
    delete data.animation;
    delete data.skeleton;
    delete data.fromSkel;
    delete data.toSkel
  }, onUpdate:function(dt) {
    var components = this.store;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var component = components[id];
        var componentData = component.data;
        if(componentData.enabled && componentData.playing && component.entity.enabled) {
          var skeleton = componentData.skeleton;
          if(skeleton !== null && componentData.model !== null) {
            if(componentData.blending) {
              componentData.blendTimeRemaining -= dt;
              if(componentData.blendTimeRemaining < 0) {
                componentData.blendTimeRemaining = 0
              }
              var alpha = 1 - componentData.blendTimeRemaining / componentData.blendTime;
              skeleton.blend(componentData.fromSkel, componentData.toSkel, alpha)
            }else {
              var delta = dt * componentData.speed;
              skeleton.addTime(delta);
              if(skeleton.getCurrentTime() === skeleton.getAnimation().getDuration() && !componentData.loop) {
                componentData.playing = false
              }
            }
            if(componentData.blending && componentData.blendTimeRemaining === 0) {
              componentData.blending = false;
              skeleton.setAnimation(componentData.toSkel.getAnimation())
            }
            skeleton.updateGraph()
          }
        }
      }
    }
  }});
  return{AnimationComponentSystem:AnimationComponentSystem}
}());
pc.extend(pc, function() {
  var AnimationComponentData = function() {
    this.assets = [];
    this.speed = 1;
    this.loop = true;
    this.activate = true;
    this.enabled = true;
    this.animations = null;
    this.skeleton = null;
    this.model = null;
    this.prevAnim = null;
    this.currAnim = null;
    this.fromSkel = null;
    this.toSkel = null;
    this.blending = false;
    this.blendTime = 0;
    this.blendTimeRemaining = 0;
    this.playing = false
  };
  AnimationComponentData = pc.inherits(AnimationComponentData, pc.ComponentData);
  return{AnimationComponentData:AnimationComponentData}
}());
pc.extend(pc, function() {
  var ModelComponentSystem = function ModelComponentSystem(app) {
    this.id = "model";
    this.description = "Renders a 3D model at the location of the Entity.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.ModelComponent;
    this.DataType = pc.ModelComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enable or disable rendering of the Model", type:"boolean", defaultValue:true}, {name:"type", displayName:"Type", description:"Type of model", type:"enumeration", options:{enumerations:[{name:"Asset", value:"asset"}, {name:"Box", value:"box"}, {name:"Capsule", value:"capsule"}, {name:"Sphere", value:"sphere"}, {name:"Cylinder", value:"cylinder"}, {name:"Cone", value:"cone"}, {name:"Plane", value:"plane"}]}, defaultValue:"asset"}, 
    {name:"asset", displayName:"Asset", description:"Model Asset to render", type:"asset", options:{max:1, type:"model"}, defaultValue:null, filter:{type:"asset"}}, {name:"materialAsset", displayName:"Material", description:"The material of the model", type:"asset", options:{max:1, type:"material"}, defaultValue:null, filter:{type:function(value) {
      return false
    }}}, {name:"castShadows", displayName:"Cast shadows", description:"Occlude light", type:"boolean", defaultValue:false}, {name:"receiveShadows", displayName:"Receive shadows", description:"Receive shadows cast from occluders", type:"boolean", defaultValue:true}, {name:"material", exposed:false}, {name:"model", exposed:false}];
    this.exposeProperties();
    var gd = app.graphicsDevice;
    this.box = pc.createBox(gd, {halfExtents:new pc.Vec3(0.5, 0.5, 0.5)});
    this.capsule = pc.createCapsule(gd, {radius:0.5, height:2});
    this.sphere = pc.createSphere(gd, {radius:0.5});
    this.cone = pc.createCone(gd, {baseRadius:0.5, peakRadius:0, height:1});
    this.cylinder = pc.createCylinder(gd, {radius:0.5, height:1});
    this.plane = pc.createPlane(gd, {halfExtents:new pc.Vec2(0.5, 0.5), widthSegments:1, lengthSegments:1});
    this.defaultMaterial = new pc.PhongMaterial
  };
  ModelComponentSystem = pc.inherits(ModelComponentSystem, pc.ComponentSystem);
  pc.extend(ModelComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    data.material = this.defaultMaterial;
    properties = ["material", "materialAsset", "asset", "castShadows", "receiveShadows", "type", "enabled"];
    ModelComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, removeComponent:function(entity) {
    var data = entity.model.data;
    entity.model.asset = null;
    if(data.type !== "asset" && data.model) {
      this.app.scene.removeModel(data.model);
      entity.removeChild(data.model.getGraph());
      data.model = null
    }
    ModelComponentSystem._super.removeComponent.call(this, entity)
  }, cloneComponent:function(entity, clone) {
    var component = this.addComponent(clone, {});
    clone.model.data.type = entity.model.type;
    clone.model.data.materialAsset = entity.model.materialAsset;
    clone.model.data.asset = entity.model.asset;
    clone.model.data.castShadows = entity.model.castShadows;
    clone.model.data.receiveShadows = entity.model.receiveShadows;
    clone.model.data.material = entity.model.material;
    clone.model.data.enabled = entity.model.enabled;
    if(entity.model.model) {
      clone.model.model = entity.model.model.clone()
    }
  }});
  return{ModelComponentSystem:ModelComponentSystem}
}());
pc.extend(pc, function() {
  var ModelComponent = function ModelComponent(system, entity) {
    this.on("set_type", this.onSetType, this);
    this.on("set_asset", this.onSetAsset, this);
    this.on("set_castShadows", this.onSetCastShadows, this);
    this.on("set_model", this.onSetModel, this);
    this.on("set_receiveShadows", this.onSetReceiveShadows, this);
    this.on("set_material", this.onSetMaterial, this);
    Object.defineProperty(this, "materialAsset", {set:this.setMaterialAsset.bind(this), get:this.getMaterialAsset.bind(this)})
  };
  ModelComponent = pc.inherits(ModelComponent, pc.Component);
  pc.extend(ModelComponent.prototype, {setVisible:function(visible) {
    console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
    this.enabled = visible
  }, loadModelAsset:function(id) {
    var options = {parent:this.entity.getRequest()};
    var asset = this.system.app.assets.getAssetById(id);
    if(!asset) {
      logERROR(pc.string.format("Trying to load model before asset {0} is loaded.", id));
      return
    }
    asset.off("change", this.onAssetChange, this);
    asset.on("change", this.onAssetChange, this);
    if(asset.resource) {
      var model = asset.resource.clone();
      this._onModelLoaded(model)
    }else {
      this.system.app.assets.load(asset, [], options).then(function(resources) {
        this._onModelLoaded(resources[0])
      }.bind(this))
    }
  }, _onModelLoaded:function(model) {
    if(this.system.app.designer) {
      model.generateWireframe()
    }
    if(this.data.type === "asset") {
      this.model = model
    }
  }, onSetType:function(name, oldValue, newValue) {
    var data = this.data;
    if(newValue) {
      var mesh = null;
      if(newValue === "asset") {
        if(this.data.asset !== null) {
          this.loadModelAsset(this.data.asset)
        }else {
          this.model = null
        }
      }else {
        switch(newValue) {
          case "box":
            mesh = this.system.box;
            break;
          case "capsule":
            mesh = this.system.capsule;
            break;
          case "sphere":
            mesh = this.system.sphere;
            break;
          case "cone":
            mesh = this.system.cone;
            break;
          case "cylinder":
            mesh = this.system.cylinder;
            break;
          case "plane":
            mesh = this.system.plane;
            break;
          default:
            throw new Error("Invalid model type: " + newValue);
        }
        var node = new pc.GraphNode;
        var model = new pc.Model;
        model.graph = node;
        model.meshInstances = [new pc.MeshInstance(node, mesh, data.material)];
        if(this.system.app.designer) {
          model.generateWireframe()
        }
        this.model = model;
        this.asset = null
      }
    }
  }, onSetAsset:function(name, oldValue, newValue) {
    if(oldValue) {
      var asset = this.system.app.assets.getAssetById(oldValue);
      if(asset) {
        asset.off("change", this.onAssetChange, this)
      }
    }
    if(this.data.type === "asset") {
      if(newValue) {
        if(newValue instanceof pc.asset.Asset) {
          this.data.asset = newValue.id;
          this.loadModelAsset(newValue.id)
        }else {
          this.loadModelAsset(newValue)
        }
      }else {
        this.model = null
      }
    }
  }, onSetCastShadows:function(name, oldValue, newValue) {
    var model = this.data.model;
    if(model) {
      var scene = this.system.app.scene;
      var inScene = scene.containsModel(model);
      if(inScene) {
        scene.removeModel(model)
      }
      var meshInstances = model.meshInstances;
      for(var i = 0;i < meshInstances.length;i++) {
        meshInstances[i].castShadow = newValue
      }
      if(inScene) {
        scene.addModel(model)
      }
    }
  }, onSetModel:function(name, oldValue, newValue) {
    if(oldValue) {
      this.system.app.scene.removeModel(oldValue);
      this.entity.removeChild(oldValue.getGraph());
      delete oldValue._entity
    }
    if(newValue) {
      var componentData = this.data;
      var meshInstances = newValue.meshInstances;
      for(var i = 0;i < meshInstances.length;i++) {
        meshInstances[i].castShadow = componentData.castShadows;
        meshInstances[i].receiveShadow = componentData.receiveShadows
      }
      this.entity.addChild(newValue.graph);
      if(this.enabled && this.entity.enabled) {
        this.system.app.scene.addModel(newValue)
      }
      newValue._entity = this.entity;
      if(this.entity.animation) {
        this.entity.animation.setModel(newValue)
      }
    }
  }, setMaterialAsset:function(newValue) {
    var id = typeof newValue === "number" || !newValue ? newValue : newValue.id;
    var material;
    if(id !== undefined && id !== null) {
      var asset = this.system.app.assets.getAssetById(id);
      if(asset) {
        if(asset.resource) {
          material = asset.resource;
          this.material = material
        }else {
          this.system.app.assets.load(asset).then(function(materials) {
            this.material = materials[0]
          }.bind(this))
        }
      }else {
        console.error(pc.string.format("Entity '{0}' is trying to load Material Asset {1} which no longer exists. Maybe this model was once a primitive shape?", this.entity.getPath(), id))
      }
    }
    if(!material) {
      material = this.system.defaultMaterial
    }
    this.material = material;
    var oldValue = this.data.materialAsset;
    this.data.materialAsset = id;
    this.fire("set", "materialAsset", oldValue, id)
  }, getMaterialAsset:function() {
    return this.system.app.assets.getAssetById(this.data.materialAsset)
  }, onSetMaterial:function(name, oldValue, newValue) {
    if(newValue !== oldValue) {
      this.data.material = newValue;
      if(this.data.model && this.data.type !== "asset") {
        var meshInstances = this.data.model.meshInstances;
        for(var i = 0;i < meshInstances.length;i++) {
          meshInstances[i].material = newValue
        }
      }
    }
  }, onSetReceiveShadows:function(name, oldValue, newValue) {
    if(newValue !== undefined) {
      var componentData = this.data;
      if(componentData.model) {
        var meshInstances = componentData.model.meshInstances;
        for(var i = 0;i < meshInstances.length;i++) {
          meshInstances[i].receiveShadow = newValue
        }
      }
    }
  }, onEnable:function() {
    ModelComponent._super.onEnable.call(this);
    var model = this.data.model;
    if(model) {
      var inScene = this.system.app.scene.containsModel(model);
      if(!inScene) {
        this.system.app.scene.addModel(model)
      }
    }
  }, onDisable:function() {
    ModelComponent._super.onDisable.call(this);
    var model = this.data.model;
    if(model) {
      var inScene = this.system.app.scene.containsModel(model);
      if(inScene) {
        this.system.app.scene.removeModel(model)
      }
    }
  }, onAssetChange:function(asset, attribute, newValue, oldValue) {
    if(attribute === "resource") {
      if(newValue) {
        this._onModelLoaded(newValue)
      }
    }else {
      if(attribute === "data") {
        var isMappingDifferent = false;
        var mapping = newValue.mapping;
        var oldMapping = oldValue.mapping;
        if(mapping && !oldMapping || oldMapping && !mapping) {
          isMappingDifferent = true
        }else {
          if(mapping) {
            if(mapping && mapping.length !== oldMapping.length) {
              isMappingDifferent = true
            }else {
              for(var i = 0;i < mapping.length;i++) {
                if(mapping[i].material !== oldMapping[i].material) {
                  isMappingDifferent = true;
                  break
                }
              }
            }
          }
        }
        if(isMappingDifferent) {
          asset.resource = null;
          this.system.app.loader.removeFromCache(asset.getFileUrl());
          this.loadModelAsset(asset.id)
        }
      }
    }
  }});
  return{ModelComponent:ModelComponent}
}());
pc.extend(pc, function() {
  var ModelComponentData = function() {
    this.enabled = true;
    this.type = "asset";
    this.asset = null;
    this.castShadows = false;
    this.receiveShadows = true;
    this.materialAsset = null;
    this.material = null;
    this.model = null
  };
  ModelComponentData = pc.inherits(ModelComponentData, pc.ComponentData);
  return{ModelComponentData:ModelComponentData}
}());
pc.extend(pc, function() {
  var SkyboxComponentSystem = function SkyboxComponentSystem(app) {
    this.id = "skybox";
    this.description = "Renders a skybox in the scene.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.SkyboxComponent;
    this.DataType = pc.SkyboxComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enables or disables the component", type:"boolean", defaultValue:true}, {name:"posx", displayName:"POSX", description:"URL of the positive X face of skybox cubemap", type:"asset", options:{max:1, type:"texture"}, defaultValue:null}, {name:"negx", displayName:"NEGX", description:"URL of the negative X face of skybox cubemap", type:"asset", options:{max:1, type:"texture"}, defaultValue:null}, {name:"posy", displayName:"POSY", description:"URL of the positive Y face of skybox cubemap", 
    type:"asset", options:{max:1, type:"texture"}, defaultValue:null}, {name:"negy", displayName:"NEGY", description:"URL of the negative Y face of skybox cubemap", type:"asset", options:{max:1, type:"texture"}, defaultValue:null}, {name:"posz", displayName:"POSZ", description:"URL of the positive Z face of skybox cubemap", type:"asset", options:{max:1, type:"texture"}, defaultValue:null}, {name:"negz", displayName:"NEGZ", description:"URL of the negative Z face of skybox cubemap", type:"asset", 
    options:{max:1, type:"texture"}, defaultValue:null}, {name:"model", exposed:false, readOnly:true}, {name:"assets", exposed:false, readOnly:true}, {name:"cubemap", exposed:false}];
    this.exposeProperties();
    this.on("remove", this.onRemove, this)
  };
  SkyboxComponentSystem = pc.inherits(SkyboxComponentSystem, pc.ComponentSystem);
  pc.extend(SkyboxComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    var properties = ["enabled", "posx", "negx", "posy", "negy", "posz", "negz", "cubemap"];
    SkyboxComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, onRemove:function(entity, data) {
    if(data.model) {
      this.app.scene.removeModel(data.model);
      entity.removeChild(data.model.getGraph());
      data.model = null
    }
  }});
  return{SkyboxComponentSystem:SkyboxComponentSystem}
}());
pc.extend(pc, function() {
  var SkyboxComponent = function SkyboxComponent(system, entity) {
    this.on("set", this.onSet, this)
  };
  SkyboxComponent = pc.inherits(SkyboxComponent, pc.Component);
  pc.extend(SkyboxComponent.prototype, {onSet:function(name, oldValue, newValue) {
    if(name == "cubemap" && newValue) {
      this.data.model = _createSkyboxFromCubemap(this.entity, this.system.app, newValue);
      if(this.enabled && this.entity.enabled) {
        this.system.app.scene.addModel(this.data.model);
        this.entity.addChild(this.data.model.graph)
      }
      return
    }
    function _loadTextureAsset(name, id) {
      if(id === undefined || id === null) {
        return
      }
      var index = CUBE_MAP_NAMES.indexOf(name);
      var assets = this.entity.skybox.assets;
      this.data.model = null;
      assets[index] = this.system.app.assets.getAssetById(id);
      if(!assets[index]) {
        logERROR(pc.string.format("Trying to load skybox component before asset {0} has loaded", id));
        return
      }
      this.data.assets = assets;
      if(assets[0] && assets[1] && assets[2] && assets[3] && assets[4] && assets[5]) {
        this.data.model = _createSkybox(this.entity, this.system.app, assets);
        if(this.enabled && this.entity.enabled) {
          this.system.app.scene.addModel(this.data.model);
          this.entity.addChild(this.data.model.graph)
        }
      }
    }
    var functions = {"posx":function(entity, name, oldValue, newValue) {
      _loadTextureAsset.call(this, name, newValue)
    }, "negx":function(entity, name, oldValue, newValue) {
      _loadTextureAsset.call(this, name, newValue)
    }, "posy":function(entity, name, oldValue, newValue) {
      _loadTextureAsset.call(this, name, newValue)
    }, "negy":function(entity, name, oldValue, newValue) {
      _loadTextureAsset.call(this, name, newValue)
    }, "posz":function(entity, name, oldValue, newValue) {
      _loadTextureAsset.call(this, name, newValue)
    }, "negz":function(entity, name, oldValue, newValue) {
      _loadTextureAsset.call(this, name, newValue)
    }};
    if(functions[name]) {
      functions[name].call(this, this.entity, name, oldValue, newValue)
    }
  }, onEnable:function() {
    SkyboxComponent._super.onEnable.call(this);
    if(this.data.model) {
      if(!this.system.app.scene.containsModel(this.data.model)) {
        this.system.app.scene.addModel(this.data.model);
        this.entity.addChild(this.data.model.graph)
      }
    }
  }, onDisable:function() {
    SkyboxComponent._super.onDisable.call(this);
    if(this.data.model) {
      if(this.system.app.scene.containsModel(this.data.model)) {
        this.entity.removeChild(this.data.model.graph);
        this.system.app.scene.removeModel(this.data.model)
      }
    }
  }});
  var _createSkybox = function(entity, app, assets) {
    var gd = app.graphicsDevice;
    var sources = [];
    var requests = [];
    var indexes = [];
    var image;
    for(var i = 0;i < assets.length;i++) {
      var asset = assets[i];
      if(!asset) {
        logERROR(pc.string.format("Trying to load skybox component before assets are loaded"));
        return
      }else {
        if(asset.resource) {
          image = asset.resource.getSource();
          if(!image) {
            logERROR(pc.string.format("Trying to load skybox component with invalid texture types"));
            return
          }
          sources.push(image)
        }else {
          indexes.push(i);
          requests.push(new pc.resources.TextureRequest(asset.getFileUrl()))
        }
      }
    }
    var texture = new pc.Texture(gd, {format:pc.PIXELFORMAT_R8_G8_B8, cubemap:true});
    texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
    texture.magFilter = pc.FILTER_LINEAR;
    texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
    texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    if(requests.length) {
      var options = {parent:entity.getRequest()};
      app.loader.request(requests, options).then(function(resources) {
        for(var i = 0;i < resources.length;i++) {
          sources[indexes[i]] = resources[i].getSource()
        }
        texture.setSource(sources)
      })
    }else {
      texture.setSource(sources)
    }
    var material = new pc.Material;
    material.updateShader = function() {
      var library = gd.getProgramLibrary();
      var shader = library.getProgram("skybox", {hdr:false, gamma:app.scene.gammaCorrection, toneMapping:app.scene.toneMapping});
      this.setShader(shader)
    };
    material.updateShader();
    material.setParameter("texture_cubeMap", texture);
    material.cull = pc.CULLFACE_NONE;
    var node = new pc.GraphNode;
    var mesh = pc.createBox(gd);
    var meshInstance = new pc.MeshInstance(node, mesh, material);
    var model = new pc.Model;
    model.graph = node;
    model.meshInstances = [meshInstance];
    return model
  };
  var _createSkyboxFromCubemap = function(entity, app, cubemap) {
    var gd = app.graphicsDevice;
    var material = new pc.Material;
    material.updateShader = function() {
      var library = gd.getProgramLibrary();
      var shader = library.getProgram("skybox", {hdr:cubemap.hdr, prefiltered:true, gamma:app.scene.gammaCorrection, toneMapping:app.scene.toneMapping});
      this.setShader(shader)
    };
    material.updateShader();
    material.setParameter("texture_cubeMap", cubemap);
    material.cull = pc.CULLFACE_NONE;
    var node = new pc.GraphNode;
    var mesh = pc.createBox(gd);
    var meshInstance = new pc.MeshInstance(node, mesh, material);
    var model = new pc.Model;
    model.graph = node;
    model.meshInstances = [meshInstance];
    return model
  };
  var CUBE_MAP_NAMES = ["posx", "negx", "posy", "negy", "posz", "negz"];
  return{SkyboxComponent:SkyboxComponent}
}());
pc.extend(pc, function() {
  var SkyboxComponentData = function() {
    this.enabled = true;
    this.posx = null;
    this.negx = null;
    this.posy = null;
    this.negy = null;
    this.posz = null;
    this.negz = null;
    this.assets = [];
    this.model = null
  };
  SkyboxComponentData = pc.inherits(SkyboxComponentData, pc.ComponentData);
  return{SkyboxComponentData:SkyboxComponentData}
}());
pc.extend(pc, function() {
  var REMOTE_CAMERA_NEAR_CLIP = 0.5;
  var REMOTE_CAMERA_FAR_CLIP = 2;
  var CameraComponentSystem = function(app) {
    this.id = "camera";
    this.description = "Renders the scene from the location of the Entity.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.CameraComponent;
    this.DataType = pc.CameraComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enable or disable the component", type:"boolean", defaultValue:true}, {name:"clearColorBuffer", displayName:"Clear Color Buffer", description:"Clear color buffer", type:"boolean", defaultValue:true}, {name:"clearColor", displayName:"Clear Color", description:"Clear Color", type:"rgba", defaultValue:[0.7294117647058823, 0.7294117647058823, 0.6941176470588235, 1], filter:{clearColorBuffer:true}}, {name:"clearDepthBuffer", displayName:"Clear Depth Buffer", 
    description:"Clear depth buffer", type:"boolean", defaultValue:true}, {name:"projection", displayName:"Projection", description:"Projection type of camera", type:"enumeration", options:{enumerations:[{name:"Perspective", value:0}, {name:"Orthographic", value:1}]}, defaultValue:0}, {name:"fov", displayName:"Field of View", description:"Field of view in Y axis", type:"number", defaultValue:45, options:{min:0, max:90}, filter:{projection:0}}, {name:"orthoHeight", displayName:"Ortho Height", description:"View window half extent of camera in Y axis", 
    type:"number", defaultValue:100, filter:{projection:1}}, {name:"nearClip", displayName:"Near Clip", description:"Near clipping distance", type:"number", defaultValue:0.3, options:{min:1E-4, decimalPrecision:5}}, {name:"farClip", displayName:"Far Clip", description:"Far clipping distance", type:"number", defaultValue:1E3, options:{min:1E-4, decimalPrecision:5}}, {name:"priority", displayName:"Priority", description:"Controls which camera will be rendered first. Smaller numbers are rendered first.", 
    type:"number", defaultValue:0}, {name:"rect", displayName:"Viewport", description:"Controls where on the screen the camera will be rendered in normalized coordinates.", type:"vector", defaultValue:[0, 0, 1, 1]}, {name:"camera", exposed:false}, {name:"aspectRatio", exposed:false}, {name:"model", exposed:false}, {name:"renderTarget", exposed:false}];
    this.exposeProperties();
    this.cameras = [];
    this.on("remove", this.onRemove, this);
    pc.ComponentSystem.on("toolsUpdate", this.toolsUpdate, this)
  };
  CameraComponentSystem = pc.inherits(CameraComponentSystem, pc.ComponentSystem);
  pc.extend(CameraComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    data = data || {};
    if(data.clearColor && pc.type(data.clearColor) === "array") {
      var c = data.clearColor;
      data.clearColor = new pc.Color(c[0], c[1], c[2], c[3])
    }
    if(data.rect && pc.type(data.rect) === "array") {
      var rect = data.rect;
      data.rect = new pc.Vec4(rect[0], rect[1], rect[2], rect[3])
    }
    if(data.activate) {
      console.warn("WARNING: activate: Property is deprecated. Set enabled property instead.");
      data.enabled = data.activate
    }
    data.camera = new pc.Camera;
    data._node = component.entity;
    data.postEffects = new pc.PostEffectQueue(this.app, component);
    if(this.app.designer && this.displayInTools(component.entity)) {
      var material = new pc.BasicMaterial;
      material.color = new pc.Color(1, 1, 0, 1);
      material.update();
      var indexBuffer = new pc.IndexBuffer(this.app.graphicsDevice, pc.INDEXFORMAT_UINT8, 24);
      var indices = new Uint8Array(indexBuffer.lock());
      indices.set([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
      indexBuffer.unlock();
      var format = new pc.VertexFormat(this.app.graphicsDevice, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
      var vertexBuffer = new pc.VertexBuffer(this.app.graphicsDevice, format, 8, pc.BUFFER_DYNAMIC);
      var mesh = new pc.Mesh;
      mesh.vertexBuffer = vertexBuffer;
      mesh.indexBuffer[0] = indexBuffer;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = indexBuffer.getNumIndices();
      mesh.primitive[0].indexed = true;
      var model = new pc.Model;
      model.graph = component.entity;
      model.meshInstances = [new pc.MeshInstance(model.graph, mesh, material)];
      this.app.scene.addModel(model);
      data.model = model
    }
    properties = ["postEffects", "enabled", "model", "camera", "aspectRatio", "renderTarget", "clearColor", "fov", "orthoHeight", "nearClip", "farClip", "projection", "priority", "clearColorBuffer", "clearDepthBuffer", "rect"];
    CameraComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, onRemove:function(entity, data) {
    if(this.app.designer && this.displayInTools(entity)) {
      if(this.app.scene.containsModel(data.model)) {
        this.app.scene.removeModel(data.model)
      }
    }
    data.camera = null
  }, toolsUpdate:function(fn) {
    var components = this.store;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var entity = components[id].entity;
        var data = components[id].data;
        if(this.displayInTools(entity)) {
          this._updateGfx(entity.camera)
        }
      }
    }
  }, _updateGfx:function(component) {
    if(component.model && component.model.meshInstances.length) {
      var vertexBuffer = component.model.meshInstances[0].mesh.vertexBuffer;
      var aspectRatio = component.camera.getAspectRatio();
      var nearClip = this.isToolsCamera(component.entity) ? REMOTE_CAMERA_NEAR_CLIP : component.nearClip;
      var farClip = this.isToolsCamera(component.entity) ? REMOTE_CAMERA_FAR_CLIP : component.farClip;
      var fov = component.fov * Math.PI / 180;
      var projection = component.projection;
      var x, y;
      if(projection === pc.PROJECTION_PERSPECTIVE) {
        y = Math.tan(fov / 2) * nearClip
      }else {
        y = component.camera.getOrthoHeight()
      }
      x = y * aspectRatio;
      var positions = new Float32Array(vertexBuffer.lock());
      positions[0] = x;
      positions[1] = -y;
      positions[2] = -nearClip;
      positions[3] = x;
      positions[4] = y;
      positions[5] = -nearClip;
      positions[6] = -x;
      positions[7] = y;
      positions[8] = -nearClip;
      positions[9] = -x;
      positions[10] = -y;
      positions[11] = -nearClip;
      if(projection === pc.PROJECTION_PERSPECTIVE) {
        y = Math.tan(fov / 2) * farClip;
        x = y * aspectRatio
      }
      positions[12] = x;
      positions[13] = -y;
      positions[14] = -farClip;
      positions[15] = x;
      positions[16] = y;
      positions[17] = -farClip;
      positions[18] = -x;
      positions[19] = y;
      positions[20] = -farClip;
      positions[21] = -x;
      positions[22] = -y;
      positions[23] = -farClip;
      vertexBuffer.unlock()
    }
  }, addCamera:function(camera) {
    this.cameras.push(camera);
    this.sortCamerasByPriority();
    if(this.app.designer) {
      var model = camera.data.model;
      if(model) {
        var scene = this.app.scene;
        if(!scene.containsModel(model)) {
          scene.addModel(model)
        }
      }
    }
  }, removeCamera:function(camera) {
    var index = this.cameras.indexOf(camera);
    if(index >= 0) {
      this.cameras.splice(index, 1);
      this.sortCamerasByPriority();
      if(this.app.designer) {
        var model = camera.data.model;
        if(model) {
          this.app.scene.removeModel(model)
        }
      }
    }
  }, sortCamerasByPriority:function() {
    this.cameras.sort(function(a, b) {
      return a.priority - b.priority
    })
  }, isToolsCamera:function(entity) {
    return entity.hasLabel("pc:designer")
  }, displayInTools:function(entity) {
    return!this.isToolsCamera(entity) || entity.getName() === "Perspective"
  }});
  return{CameraComponentSystem:CameraComponentSystem}
}());
pc.extend(pc, function() {
  var CameraComponent = function CameraComponent(system, entity) {
    this.on("set_aspectRatio", this.onSetAspectRatio, this);
    this.on("set_camera", this.onSetCamera, this);
    this.on("set_clearColor", this.onSetClearColor, this);
    this.on("set_fov", this.onSetFov, this);
    this.on("set_orthoHeight", this.onSetOrthoHeight, this);
    this.on("set_nearClip", this.onSetNearClip, this);
    this.on("set_farClip", this.onSetFarClip, this);
    this.on("set_projection", this.onSetProjection, this);
    this.on("set_priority", this.onSetPriority, this);
    this.on("set_clearColorBuffer", this.updateClearFlags, this);
    this.on("set_clearDepthBuffer", this.updateClearFlags, this);
    this.on("set_renderTarget", this.onSetRenderTarget, this);
    this.on("set_rect", this.onSetRect, this)
  };
  CameraComponent = pc.inherits(CameraComponent, pc.Component);
  Object.defineProperty(CameraComponent.prototype, "activate", {get:function() {
    console.warn("WARNING: activate: Property is deprecated. Query enabled property instead.");
    return this.enabled
  }, set:function(value) {
    console.warn("WARNING: activate: Property is deprecated. Set enabled property instead.");
    this.enabled = value
  }});
  Object.defineProperty(CameraComponent.prototype, "projectionMatrix", {get:function() {
    return this.data.camera.getProjectionMatrix()
  }});
  Object.defineProperty(CameraComponent.prototype, "viewMatrix", {get:function() {
    var wtm = this.data.camera.getWorldTransform();
    return wtm.clone().invert()
  }});
  Object.defineProperty(CameraComponent.prototype, "frustum", {get:function() {
    return this.data.camera.getFrustum()
  }});
  pc.extend(CameraComponent.prototype, {screenToWorld:function(screenx, screeny, cameraz, worldCoord) {
    var device = this.system.app.graphicsDevice;
    var width = parseInt(device.canvas.clientWidth);
    var height = parseInt(device.canvas.clientHeight);
    return this.data.camera.screenToWorld(screenx, screeny, cameraz, width, height, worldCoord)
  }, worldToScreen:function(worldCoord, screenCoord) {
    var device = this.system.app.graphicsDevice;
    var width = parseInt(device.canvas.clientWidth);
    var height = parseInt(device.canvas.clientHeight);
    return this.data.camera.worldToScreen(worldCoord, width, height, screenCoord)
  }, onSetAspectRatio:function(name, oldValue, newValue) {
    this.data.camera.setAspectRatio(newValue)
  }, onSetCamera:function(name, oldValue, newValue) {
    if(oldValue) {
      oldValue._node = null
    }
    newValue._node = this.entity
  }, onSetClearColor:function(name, oldValue, newValue) {
    var clearOptions = this.data.camera.getClearOptions();
    clearOptions.color[0] = newValue.r;
    clearOptions.color[1] = newValue.g;
    clearOptions.color[2] = newValue.b;
    clearOptions.color[3] = newValue.a
  }, onSetFov:function(name, oldValue, newValue) {
    this.data.camera.setFov(newValue)
  }, onSetOrthoHeight:function(name, oldValue, newValue) {
    this.data.camera.setOrthoHeight(newValue)
  }, onSetNearClip:function(name, oldValue, newValue) {
    this.data.camera.setNearClip(newValue)
  }, onSetFarClip:function(name, oldValue, newValue) {
    this.data.camera.setFarClip(newValue)
  }, onSetProjection:function(name, oldValue, newValue) {
    this.data.camera.setProjection(newValue)
  }, onSetPriority:function(name, oldValue, newValue) {
    this.system.sortCamerasByPriority()
  }, updateClearFlags:function() {
    var clearOptions = this.data.camera.getClearOptions();
    var flags = 0;
    if(this.clearColorBuffer) {
      flags = flags | pc.CLEARFLAG_COLOR
    }
    if(this.clearDepthBuffer) {
      flags = flags | pc.CLEARFLAG_DEPTH
    }
    clearOptions.flags = flags
  }, onSetRenderTarget:function(name, oldValue, newValue) {
    this.data.camera.setRenderTarget(newValue)
  }, onSetRect:function(name, oldValue, newValue) {
    this.data.camera.setRect(newValue.data[0], newValue.data[1], newValue.data[2], newValue.data[3]);
    this._resetAspectRatio()
  }, onEnable:function() {
    CameraComponent._super.onEnable.call(this);
    this.system.addCamera(this);
    this.postEffects.enable()
  }, onDisable:function() {
    CameraComponent._super.onDisable.call(this);
    this.postEffects.disable();
    this.system.removeCamera(this)
  }, _resetAspectRatio:function() {
    var camera = this.camera;
    if(camera) {
      var device = this.system.app.graphicsDevice;
      var rect = this.rect;
      var aspect = device.width * rect.z / (device.height * rect.w);
      if(aspect !== camera.getAspectRatio()) {
        camera.setAspectRatio(aspect)
      }
    }
  }, frameBegin:function() {
    this._resetAspectRatio();
    this.data.isRendering = true
  }, frameEnd:function() {
    this.data.isRendering = false
  }});
  return{CameraComponent:CameraComponent}
}());
pc.extend(pc, function() {
  CameraComponentData = function() {
    this.clearColor = new pc.Color(0.729411780834198, 0.729411780834198, 0.6941176652908325, 1);
    this.clearColorBuffer = true;
    this.clearDepthBuffer = true;
    this.nearClip = 0.1;
    this.farClip = 1E3;
    this.fov = 45;
    this.orthoHeight = 100;
    this.projection = pc.PROJECTION_PERSPECTIVE;
    this.priority = 0;
    this.rect = new pc.Vec4(0, 0, 1, 1);
    this.enabled = true;
    this.camera = null;
    this.aspectRatio = 16 / 9;
    this.renderTarget = null;
    this.postEffects = null;
    this.isRendering = false
  };
  CameraComponentData = pc.inherits(CameraComponentData, pc.ComponentData);
  return{CameraComponentData:CameraComponentData}
}());
pc.extend(pc, function() {
  var LightComponentSystem = function(app) {
    this.id = "light";
    this.description = "Enables the Entity to emit light.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.LightComponent;
    this.DataType = pc.LightComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enable or disable the light", type:"boolean", defaultValue:true}, {name:"type", displayName:"Type", description:"The type of the light", type:"enumeration", options:{enumerations:[{name:"Directional", value:"directional"}, {name:"Point", value:"point"}, {name:"Spot", value:"spot"}]}, defaultValue:"directional"}, {name:"color", displayName:"Color", description:"Light Color", type:"rgb", defaultValue:[1, 1, 1]}, {name:"intensity", 
    displayName:"Intensity", description:"The intensity of the light", type:"number", defaultValue:1, options:{min:0, max:10, step:0.05}}, {name:"castShadows", displayName:"Cast Shadows", description:"Cast shadows from this light", type:"boolean", defaultValue:false}, {name:"shadowDistance", displayName:"Shadow Distance", description:"Camera distance at which shadows are no longer rendered", type:"number", options:{min:0, decimalPrecision:5}, defaultValue:40, filter:{castShadows:true, type:"directional"}}, 
    {name:"shadowResolution", displayName:"Shadow Resolution", description:"Resolution of shadowmap generated by this light", type:"enumeration", options:{enumerations:[{name:"128", value:128}, {name:"256", value:256}, {name:"512", value:512}, {name:"1024", value:1024}, {name:"2048", value:2048}]}, defaultValue:1024, filter:{castShadows:true}}, {name:"shadowBias", displayName:"Shadow Bias", description:"Tunes the shadows to reduce rendering artifacts", type:"number", options:{min:0, max:1, decimalPrecision:5, 
    step:0.01}, defaultValue:0.05, filter:{castShadows:true}}, {name:"normalOffsetBias", displayName:"Normal Offset Shadow Bias", description:"Tunes the shadows to reduce rendering artifacts", type:"number", options:{min:0, max:1, decimalPrecision:5, step:0.01}, defaultValue:0, filter:{castShadows:true}}, {name:"range", displayName:"Range", description:"The distance from the light where its contribution falls to zero", type:"number", defaultValue:10, options:{min:0}, filter:{type:["point", "spot"]}}, 
    {name:"falloffMode", displayName:"Falloff mode", description:"Controls the rate at which a light attentuates from its position", type:"enumeration", options:{enumerations:[{name:"Linear", value:pc.LIGHTFALLOFF_LINEAR}, {name:"Inverse squared", value:pc.LIGHTFALLOFF_INVERSESQUARED}]}, defaultValue:0, filter:{type:["point", "spot"]}}, {name:"innerConeAngle", displayName:"Inner Cone Angle", description:"Spotlight inner cone angle", type:"number", defaultValue:40, options:{min:0, max:90}, filter:{type:"spot"}}, 
    {name:"outerConeAngle", displayName:"Outer Cone Angle", description:"Spotlight outer cone angle", type:"number", defaultValue:45, options:{min:0, max:90}, filter:{type:"spot"}}, {name:"light", exposed:false}, {name:"model", exposed:false}];
    this.exposeProperties();
    this.implementations = {};
    this.on("remove", this.onRemove, this);
    pc.ComponentSystem.on("toolsUpdate", this.toolsUpdate, this)
  };
  LightComponentSystem = pc.inherits(LightComponentSystem, pc.ComponentSystem);
  pc.extend(LightComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    if(!data.type) {
      data.type = component.data.type
    }
    component.data.type = data.type;
    if(data.color && pc.type(data.color) === "array") {
      data.color = new pc.Color(data.color[0], data.color[1], data.color[2])
    }
    if(data.enable) {
      console.warn("WARNING: enable: Property is deprecated. Set enabled property instead.");
      data.enabled = data.enable
    }
    var implementation = this._createImplementation(data.type);
    implementation.initialize(component, data);
    properties = ["type", "light", "model", "enabled", "color", "intensity", "range", "falloffMode", "innerConeAngle", "outerConeAngle", "castShadows", "shadowDistance", "shadowResolution", "shadowBias", "normalOffsetBias"];
    LightComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, _createImplementation:function(type) {
    var implementation = this.implementations[type];
    if(!implementation) {
      switch(type) {
        case "directional":
          implementation = new DirectionalLightImplementation(this);
          break;
        case "point":
          implementation = new PointLightImplementation(this);
          break;
        case "spot":
          implementation = new SpotLightImplementation(this);
          break;
        default:
          throw new Error("Invalid light type: " + type);
      }
      this.implementations[type] = implementation
    }
    return implementation
  }, onRemove:function(entity, data) {
    this.implementations[data.type].remove(entity, data)
  }, cloneComponent:function(entity, clone) {
    var light = entity.light;
    var data = {type:light.type, enabled:light.enabled, color:[light.color.r, light.color.g, light.color.b], intensity:light.intensity, range:light.range, innerConeAngle:light.innerConeAngle, outerConeAngle:light.outerConeAngle, castShadows:light.castShadows, shadowDistance:light.shadowDistance, shadowResolution:light.shadowResolution, falloffMode:light.falloffMode, shadowBias:light.shadowBias, normalOffsetBias:light.normalOffsetBias};
    this.addComponent(clone, data)
  }, toolsUpdate:function(fn) {
    var components = this.store;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var entity = components[id].entity;
        var componentData = components[id].data;
        var implementation = this.implementations[componentData.type];
        if(implementation) {
          implementation.toolsUpdate(componentData)
        }
      }
    }
  }, changeType:function(component, oldType, newType) {
    this.implementations[oldType].remove(component.entity, component.data);
    this._createImplementation(newType).initialize(component, component.data)
  }});
  LightComponentImplementation = function(system) {
    this.system = system
  };
  LightComponentImplementation.prototype = {initialize:function(component, data) {
    var light = new pc.Light;
    light.setType(this._getLightType());
    light._node = component.entity;
    var app = this.system.app;
    app.scene.addLight(light);
    this._createDebugShape(component, data, light)
  }, _getLightType:function() {
    return undefined
  }, _createDebugShape:function(component, data, light) {
    var app = this.system.app;
    data = data || {};
    data.light = light;
    if(app.designer) {
      this.mesh = this._createDebugMesh();
      if(!this.material) {
        this.material = this._createDebugMaterial()
      }
      var model = new pc.Model;
      model.graph = component.entity;
      model.meshInstances = [new pc.MeshInstance(component.entity, this.mesh, this.material)];
      app.scene.addModel(model);
      data.model = model
    }
  }, _createDebugMesh:function() {
    return undefined
  }, _createDebugMaterial:function() {
    return undefined
  }, remove:function(entity, data) {
    var app = this.system.app;
    app.scene.removeModel(data.model);
    delete data.model;
    app.scene.removeLight(data.light);
    if(app.designer) {
      app.scene.removeModel(data.model);
      delete data.model
    }
  }, toolsUpdate:function(data) {
  }};
  DirectionalLightImplementation = function(system) {
  };
  DirectionalLightImplementation = pc.inherits(DirectionalLightImplementation, LightComponentImplementation);
  DirectionalLightImplementation.prototype = pc.extend(DirectionalLightImplementation.prototype, {_getLightType:function() {
    return pc.LIGHTTYPE_DIRECTIONAL
  }, _createDebugMesh:function() {
    if(this.mesh) {
      return this.mesh
    }
    var app = this.system.app;
    var format = new pc.VertexFormat(app.graphicsDevice, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
    vertexData = [0, 0, 0, 0, -8, 0, -0.5, -8, 0, 0.5, -8, 0, 0.5, -8, 0, 0, -10, 0, 0, -10, 0, -0.5, -8, 0, 0, 0, -2, 0, -8, -2, -0.25, -8, -2, 0.25, -8, -2, 0.25, -8, -2, 0, -10, -2, 0, -10, -2, -0.25, -8, -2, 0, 0, 2, 0, -8, 2, -0.25, -8, 2, 0.25, -8, 2, 0.25, -8, 2, 0, -10, 2, 0, -10, 2, -0.25, -8, 2];
    var rot = (new pc.Mat4).setFromAxisAngle(pc.Vec3.UP, 120);
    var i;
    for(i = 0;i < 24;i++) {
      var pos = new pc.Vec3(vertexData[(i + 8) * 3], vertexData[(i + 8) * 3 + 1], vertexData[(i + 8) * 3 + 2]);
      var posRot = rot.transformPoint(pos, pos);
      vertexData[(i + 24) * 3] = posRot[0];
      vertexData[(i + 24) * 3 + 1] = posRot[1];
      vertexData[(i + 24) * 3 + 2] = posRot[2]
    }
    var vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, 32);
    var positions = new Float32Array(vertexBuffer.lock());
    for(i = 0;i < vertexData.length;i++) {
      positions[i] = vertexData[i]
    }
    vertexBuffer.unlock();
    var mesh = new pc.Mesh;
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = null;
    mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = vertexBuffer.getNumVertices();
    mesh.primitive[0].indexed = false;
    return mesh
  }, _createDebugMaterial:function() {
    var material = new pc.BasicMaterial;
    material.color = new pc.Color(1, 1, 0, 1);
    material.update();
    return material
  }});
  PointLightImplementation = function(system) {
  };
  PointLightImplementation = pc.inherits(PointLightImplementation, LightComponentImplementation);
  PointLightImplementation.prototype = pc.extend(PointLightImplementation.prototype, {_getLightType:function() {
    return pc.LIGHTTYPE_POINT
  }, _createDebugMesh:function() {
    if(this.mesh) {
      return this.mesh
    }
    var app = this.system.app;
    return pc.createSphere(app.graphicsDevice, {radius:0.1})
  }, _createDebugMaterial:function() {
    var material = new pc.BasicMaterial;
    material.color = new pc.Color(1, 1, 0, 1);
    material.update();
    return material
  }});
  SpotLightImplementation = function(system) {
  };
  SpotLightImplementation = pc.inherits(SpotLightImplementation, LightComponentImplementation);
  SpotLightImplementation.prototype = pc.extend(SpotLightImplementation.prototype, {_getLightType:function() {
    return pc.LIGHTTYPE_SPOT
  }, _createDebugMesh:function() {
    var app = this.system.app;
    var indexBuffer = this.indexBuffer;
    if(!indexBuffer) {
      var indexBuffer = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT8, 88);
      var inds = new Uint8Array(indexBuffer.lock());
      inds[0] = 0;
      inds[1] = 1;
      inds[2] = 0;
      inds[3] = 11;
      inds[4] = 0;
      inds[5] = 21;
      inds[6] = 0;
      inds[7] = 31;
      for(var i = 0;i < 40;i++) {
        inds[8 + i * 2 + 0] = i + 1;
        inds[8 + i * 2 + 1] = i + 2
      }
      indexBuffer.unlock();
      this.indexBuffer = indexBuffer
    }
    var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
    var vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, 42, pc.BUFFER_DYNAMIC);
    var mesh = new pc.Mesh;
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = indexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = indexBuffer.getNumIndices();
    mesh.primitive[0].indexed = true;
    return mesh
  }, _createDebugMaterial:function() {
    return new pc.BasicMaterial
  }, toolsUpdate:function(data) {
    var model = data.model;
    var meshInstance = model.meshInstances[0];
    var vertexBuffer = meshInstance.mesh.vertexBuffer;
    var oca = Math.PI * data.outerConeAngle / 180;
    var ae = data.range;
    var y = -ae * Math.cos(oca);
    var r = ae * Math.sin(oca);
    var positions = new Float32Array(vertexBuffer.lock());
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;
    var numVerts = vertexBuffer.getNumVertices();
    for(var i = 0;i < numVerts - 1;i++) {
      var theta = 2 * Math.PI * (i / (numVerts - 2));
      var x = r * Math.cos(theta);
      var z = r * Math.sin(theta);
      positions[(i + 1) * 3 + 0] = x;
      positions[(i + 1) * 3 + 1] = y;
      positions[(i + 1) * 3 + 2] = z
    }
    vertexBuffer.unlock()
  }});
  return{LightComponentSystem:LightComponentSystem}
}());
pc.extend(pc, function() {
  var LightComponent = function LightComponent(system, entity) {
    this.on("set_type", this.onSetType, this);
    this.on("set_color", this.onSetColor, this);
    this.on("set_intensity", this.onSetIntensity, this);
    this.on("set_castShadows", this.onSetCastShadows, this);
    this.on("set_shadowDistance", this.onSetShadowDistance, this);
    this.on("set_shadowResolution", this.onSetShadowResolution, this);
    this.on("set_shadowBias", this.onSetShadowBias, this);
    this.on("set_normalOffsetBias", this.onSetNormalOffsetBias, this);
    this.on("set_range", this.onSetRange, this);
    this.on("set_innerConeAngle", this.onSetInnerConeAngle, this);
    this.on("set_outerConeAngle", this.onSetOuterConeAngle, this);
    this.on("set_falloffMode", this.onSetFalloffMode, this)
  };
  LightComponent = pc.inherits(LightComponent, pc.Component);
  Object.defineProperty(LightComponent.prototype, "enable", {get:function() {
    console.warn("WARNING: enable: Property is deprecated. Query enabled property instead.");
    return this.enabled
  }, set:function(value) {
    console.warn("WARNING: enable: Property is deprecated. Set enabled property instead.");
    this.enabled = value
  }});
  pc.extend(LightComponent.prototype, {onSetType:function(name, oldValue, newValue) {
    if(oldValue !== newValue) {
      this.system.changeType(this, oldValue, newValue);
      this.refreshProperties()
    }
  }, refreshProperties:function() {
    this.onSetCastShadows("castShadows", this.castShadows, this.castShadows);
    this.onSetColor("color", this.color, this.color);
    this.onSetIntensity("intensity", this.intensity, this.intensity);
    this.onSetShadowDistance("shadowDistance", this.shadowDistance, this.shadowDistance);
    this.onSetShadowResolution("shadowResolution", this.shadowResolution, this.shadowResolution);
    this.onSetShadowBias("shadowBias", this.shadowBias, this.shadowBias);
    this.onSetNormalOffsetBias("normalOffsetBias", this.normalOffsetBias, this.normalOffsetBias);
    this.onSetRange("range", this.range, this.range);
    this.onSetInnerConeAngle("innerConeAngle", this.innerConeAngle, this.innerConeAngle);
    this.onSetOuterConeAngle("outerConeAngle", this.outerConeAngle, this.outerConeAngle);
    this.onSetFalloffMode("falloffMode", this.falloffMode, this.falloffMode);
    if(this.enabled && this.entity.enabled) {
      this.onEnable()
    }
  }, onSetCastShadows:function(name, oldValue, newValue) {
    this.light.setCastShadows(newValue)
  }, onSetColor:function(name, oldValue, newValue) {
    this.light.setColor(newValue)
  }, onSetIntensity:function(name, oldValue, newValue) {
    this.light.setIntensity(newValue)
  }, onSetShadowDistance:function(name, oldValue, newValue) {
    if(this.data.type === "directional") {
      this.light.setShadowDistance(newValue)
    }
  }, onSetShadowResolution:function(name, oldValue, newValue) {
    this.light.setShadowResolution(newValue)
  }, onSetShadowBias:function(name, oldValue, newValue) {
    this.light.setShadowBias(-0.01 * newValue)
  }, onSetNormalOffsetBias:function(name, oldValue, newValue) {
    this.light.setNormalOffsetBias(newValue)
  }, onSetRange:function(name, oldValue, newValue) {
    if(this.data.type === "point" || this.data.type === "spot") {
      this.light.setAttenuationEnd(newValue)
    }
  }, onSetInnerConeAngle:function(name, oldValue, newValue) {
    if(this.data.type === "spot") {
      this.light.setInnerConeAngle(newValue)
    }
  }, onSetOuterConeAngle:function(name, oldValue, newValue) {
    if(this.data.type === "spot") {
      this.light.setOuterConeAngle(newValue)
    }
  }, onSetFalloffMode:function(name, oldValue, newValue) {
    if(this.data.type === "point" || this.data.type === "spot") {
      this.light.setFalloffMode(newValue)
    }
  }, onEnable:function() {
    LightComponent._super.onEnable.call(this);
    this.light.setEnabled(true);
    var model = this.data.model;
    if(model) {
      var scene = this.system.app.scene;
      if(!scene.containsModel(model)) {
        scene.addModel(model)
      }
    }
  }, onDisable:function() {
    LightComponent._super.onDisable.call(this);
    this.light.setEnabled(false);
    var model = this.data.model;
    if(model) {
      var scene = this.system.app.scene;
      scene.removeModel(model)
    }
  }});
  return{LightComponent:LightComponent}
}());
pc.extend(pc, function() {
  var LightComponentData = function() {
    this.type = "directional";
    this.enabled = true;
    this.color = new pc.Color(1, 1, 1);
    this.intensity = 1;
    this.castShadows = false;
    this.shadowDistance = 40;
    this.shadowResolution = 1024;
    this.shadowBias = 0.05;
    this.normalOffsetBias = 0;
    this.range = 10;
    this.innerConeAngle = 40;
    this.outerConeAngle = 45;
    this.falloffMode = pc.LIGHTFALLOFF_LINEAR;
    this.light = null;
    this.model = null
  };
  LightComponentData = pc.inherits(LightComponentData, pc.ComponentData);
  return{LightComponentData:LightComponentData}
}());
pc.extend(pc, function() {
  var INITIALIZE = "initialize";
  var POST_INITIALIZE = "postInitialize";
  var UPDATE = "update";
  var POST_UPDATE = "postUpdate";
  var FIXED_UPDATE = "fixedUpdate";
  var TOOLS_UPDATE = "toolsUpdate";
  var ON_ENABLE = "onEnable";
  var ON_DISABLE = "onDisable";
  var ScriptComponentSystem = function ScriptComponentSystem(app) {
    this.id = "script";
    this.description = "Allows the Entity to run JavaScript fragments to implement custom behavior.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.ScriptComponent;
    this.DataType = pc.ScriptComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Disabled components are not updated", type:"boolean", defaultValue:true}, {name:"scripts", displayName:"URLs", description:"Attach scripts to this Entity", type:"script", defaultValue:[]}, {name:"instances", exposed:false}, {name:"runInTools", description:"Allows scripts to be loaded and executed while in the tools", defaultValue:false, exposed:false}];
    this.exposeProperties();
    this.instancesWithUpdate = [];
    this.instancesWithFixedUpdate = [];
    this.instancesWithPostUpdate = [];
    this.instancesWithToolsUpdate = [];
    this.on("beforeremove", this.onBeforeRemove, this);
    pc.ComponentSystem.on(INITIALIZE, this.onInitialize, this);
    pc.ComponentSystem.on(POST_INITIALIZE, this.onPostInitialize, this);
    pc.ComponentSystem.on(UPDATE, this.onUpdate, this);
    pc.ComponentSystem.on(FIXED_UPDATE, this.onFixedUpdate, this);
    pc.ComponentSystem.on(POST_UPDATE, this.onPostUpdate, this);
    pc.ComponentSystem.on(TOOLS_UPDATE, this.onToolsUpdate, this)
  };
  ScriptComponentSystem = pc.inherits(ScriptComponentSystem, pc.ComponentSystem);
  pc.extend(ScriptComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    properties = ["runInTools", "enabled", "scripts"];
    if(data.scripts && data.scripts.length) {
      data.scripts.forEach(function(script) {
        if(script.attributes && pc.type(script.attributes) === "array") {
          var dict = {};
          for(var i = 0;i < script.attributes.length;i++) {
            dict[script.attributes[i].name] = script.attributes[i]
          }
          script.attributes = dict
        }
      })
    }
    ScriptComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, cloneComponent:function(entity, clone) {
    var src = this.dataStore[entity.getGuid()];
    var data = {runInTools:src.data.runInTools, scripts:pc.extend([], src.data.scripts), enabled:src.data.enabled};
    return this.addComponent(clone, data)
  }, onBeforeRemove:function(entity, component) {
    if(component.enabled) {
      this._disableScriptComponent(component)
    }
    this._destroyScriptComponent(component)
  }, onInitialize:function(root) {
    this._registerInstances(root);
    if(root.enabled) {
      if(root.script && root.script.enabled) {
        this._initializeScriptComponent(root.script)
      }
      var children = root.getChildren();
      var i, len = children.length;
      for(i = 0;i < len;i++) {
        if(children[i] instanceof pc.Entity) {
          this.onInitialize(children[i])
        }
      }
    }
  }, onPostInitialize:function(root) {
    if(root.enabled) {
      if(root.script && root.script.enabled) {
        this._postInitializeScriptComponent(root.script)
      }
      var children = root.getChildren();
      var i, len = children.length;
      for(i = 0;i < len;i++) {
        if(children[i] instanceof pc.Entity) {
          this.onPostInitialize(children[i])
        }
      }
    }
  }, _callInstancesMethod:function(script, method) {
    var instances = script.data.instances;
    for(var name in instances) {
      if(instances.hasOwnProperty(name)) {
        var instance = instances[name].instance;
        if(instance[method]) {
          instance[method].call(instance)
        }
      }
    }
  }, _initializeScriptComponent:function(script) {
    this._callInstancesMethod(script, INITIALIZE);
    script.data.initialized = true;
    if(script.enabled && script.entity.enabled) {
      this._enableScriptComponent(script)
    }
  }, _enableScriptComponent:function(script) {
    this._callInstancesMethod(script, ON_ENABLE)
  }, _disableScriptComponent:function(script) {
    this._callInstancesMethod(script, ON_DISABLE)
  }, _destroyScriptComponent:function(script) {
    var index;
    var instances = script.data.instances;
    for(var name in instances) {
      if(instances.hasOwnProperty(name)) {
        var instance = instances[name].instance;
        if(instance.destroy) {
          instance.destroy()
        }
        if(instance.update) {
          index = this.instancesWithUpdate.indexOf(instance);
          if(index >= 0) {
            this.instancesWithUpdate.splice(index, 1)
          }
        }
        if(instance.fixedUpdate) {
          index = this.instancesWithFixedUpdate.indexOf(instance);
          if(index >= 0) {
            this.instancesWithFixedUpdate.splice(index, 1)
          }
        }
        if(instance.postUpdate) {
          index = this.instancesWithPostUpdate.indexOf(instance);
          if(index >= 0) {
            this.instancesWithPostUpdate.splice(index, 1)
          }
        }
        if(instance.toolsUpdate) {
          index = this.instancesWithToolsUpdate.indexOf(instance);
          if(index >= 0) {
            this.instancesWithToolsUpdate.splice(index, 1)
          }
        }
        if(script.instances[name].instance === script[name]) {
          delete script[name]
        }
        delete script.instances[name]
      }
    }
  }, _postInitializeScriptComponent:function(script) {
    this._callInstancesMethod(script, POST_INITIALIZE);
    script.data.postInitialized = true
  }, _updateInstances:function(method, updateList, dt) {
    var item;
    for(var i = 0, len = updateList.length;i < len;i++) {
      item = updateList[i];
      if(item && item.entity.script.enabled && item.entity.enabled) {
        item[method].call(item, dt)
      }
    }
  }, onUpdate:function(dt) {
    this._updateInstances(UPDATE, this.instancesWithUpdate, dt)
  }, onFixedUpdate:function(dt) {
    this._updateInstances(FIXED_UPDATE, this.instancesWithFixedUpdate, dt)
  }, onPostUpdate:function(dt) {
    this._updateInstances(POST_UPDATE, this.instancesWithPostUpdate, dt)
  }, onToolsUpdate:function(dt) {
    this._updateInstances(TOOLS_UPDATE, this.instancesWithToolsUpdate, dt)
  }, broadcast:function(name, functionName) {
    console.warn("DEPRECATED: ScriptComponentSystem.broadcast() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/");
    var args = pc.makeArray(arguments).slice(2);
    var id, data, fn;
    var dataStore = this.store;
    for(id in dataStore) {
      if(dataStore.hasOwnProperty(id)) {
        data = dataStore[id].data;
        if(data.instances[name]) {
          fn = data.instances[name].instance[functionName];
          if(fn) {
            fn.apply(data.instances[name].instance, args)
          }
        }
      }
    }
  }, _preRegisterInstance:function(entity, url, name, instance) {
    if(entity.script) {
      entity.script.data._instances = entity.script.data._instances || {};
      if(entity.script.data._instances[name]) {
        throw Error(pc.string.format("Script name collision '{0}'. Scripts from '{1}' and '{2}' {{3}}", name, url, entity.script.data._instances[name].url, entity.getGuid()));
      }
      entity.script.data._instances[name] = {url:url, name:name, instance:instance}
    }
  }, _registerInstances:function(entity) {
    var preRegistered, instance, instanceName;
    if(entity.script) {
      if(entity.script.data._instances) {
        entity.script.instances = entity.script.data._instances;
        for(instanceName in entity.script.instances) {
          preRegistered = entity.script.instances[instanceName];
          instance = preRegistered.instance;
          pc.events.attach(instance);
          if(instance.update) {
            this.instancesWithUpdate.push(instance)
          }
          if(instance.fixedUpdate) {
            this.instancesWithFixedUpdate.push(instance)
          }
          if(instance.postUpdate) {
            this.instancesWithPostUpdate.push(instance)
          }
          if(instance.toolsUpdate) {
            this.instancesWithToolsUpdate.push(instance)
          }
          if(entity.script.scripts) {
            this._createAccessors(entity, preRegistered)
          }
          if(entity.script[instanceName]) {
            throw Error(pc.string.format("Script with name '{0}' is already attached to Script Component", instanceName));
          }else {
            entity.script[instanceName] = instance
          }
        }
        delete entity.script.data._instances
      }
    }
    var children = entity.getChildren();
    var i, len = children.length;
    for(i = 0;i < len;i++) {
      if(children[i] instanceof pc.Entity) {
        this._registerInstances(children[i])
      }
    }
  }, _createAccessors:function(entity, instance) {
    var self = this;
    var i;
    var len = entity.script.scripts.length;
    var url = instance.url;
    for(i = 0;i < len;i++) {
      var script = entity.script.scripts[i];
      if(script.url === url) {
        var attributes = script.attributes;
        if(script.name && attributes) {
          for(var key in attributes) {
            if(attributes.hasOwnProperty(key)) {
              self._createAccessor(attributes[key], instance)
            }
          }
          entity.script.data.attributes[script.name] = pc.extend({}, attributes)
        }
        break
      }
    }
  }, _createAccessor:function(attribute, instance) {
    var self = this;
    self._convertAttributeValue(attribute);
    Object.defineProperty(instance.instance, attribute.name, {get:function() {
      return attribute.value
    }, set:function(value) {
      var oldValue = attribute.value;
      attribute.value = value;
      self._convertAttributeValue(attribute);
      instance.instance.fire("set", attribute.name, oldValue, attribute.value)
    }, configurable:true})
  }, _updateAccessors:function(entity, instance) {
    var self = this;
    var i;
    var len = entity.script.scripts.length;
    var key;
    var url = instance.url;
    var scriptComponent, script, name, attributes;
    var previousAttributes;
    var oldAttribute;
    for(i = 0;i < len;i++) {
      scriptComponent = entity.script;
      script = scriptComponent.scripts[i];
      if(script.url === url) {
        name = script.name;
        attributes = script.attributes;
        if(name) {
          if(attributes) {
            for(key in attributes) {
              if(attributes.hasOwnProperty(key)) {
                self._createAccessor(attributes[key], instance)
              }
            }
          }
          previousAttributes = scriptComponent.data.attributes[name];
          if(previousAttributes) {
            for(key in previousAttributes) {
              oldAttribute = previousAttributes[key];
              if(!(key in attributes)) {
                delete instance.instance[oldAttribute.name]
              }else {
                if(attributes[key].value !== oldAttribute.value) {
                  if(instance.instance.onAttributeChanged) {
                    instance.instance.onAttributeChanged(oldAttribute.name, oldAttribute.value, attributes[key].value)
                  }
                }
              }
            }
          }
          if(attributes) {
            scriptComponent.data.attributes[name] = pc.extend([], attributes)
          }else {
            delete scriptComponent.data.attributes[name]
          }
        }
        break
      }
    }
  }, _convertAttributeValue:function(attribute) {
    if(attribute.type === "rgb" || attribute.type === "rgba") {
      if(pc.type(attribute.value) === "array") {
        attribute.value = attribute.value.length === 3 ? new pc.Color(attribute.value[0], attribute.value[1], attribute.value[2]) : new pc.Color(attribute.value[0], attribute.value[1], attribute.value[2], attribute.value[3])
      }
    }else {
      if(attribute.type === "vector") {
        if(pc.type(attribute.value) === "array") {
          attribute.value = new pc.Vec3(attribute.value[0], attribute.value[1], attribute.value[2])
        }
      }
    }
  }});
  return{ScriptComponentSystem:ScriptComponentSystem}
}());
pc.extend(pc, function() {
  var ScriptComponent = function ScriptComponent(system, entity) {
    this.on("set_scripts", this.onSetScripts, this)
  };
  ScriptComponent = pc.inherits(ScriptComponent, pc.Component);
  pc.extend(ScriptComponent.prototype, {send:function(name, functionName) {
    console.warn("DEPRECATED: ScriptComponent.send() is deprecated and will be removed soon. Please use: http://developer.playcanvas.com/user-manual/scripting/communication/");
    var args = pc.makeArray(arguments).slice(2);
    var instances = this.entity.script.instances;
    var fn;
    if(instances && instances[name]) {
      fn = instances[name].instance[functionName];
      if(fn) {
        return fn.apply(instances[name].instance, args)
      }
    }
  }, onEnable:function() {
    ScriptComponent._super.onEnable.call(this);
    if(this.data.areScriptsLoaded) {
      if(!this.data.initialized) {
        this.system._initializeScriptComponent(this)
      }else {
        this.system._enableScriptComponent(this)
      }
      if(!this.data.postInitialized) {
        this.system._postInitializeScriptComponent(this)
      }
    }
  }, onDisable:function() {
    ScriptComponent._super.onDisable.call(this);
    this.system._disableScriptComponent(this)
  }, onSetScripts:function(name, oldValue, newValue) {
    if(!this.system._inTools || this.runInTools) {
      if(this._updateScriptAttributes(oldValue, newValue)) {
        return
      }
      if(this.enabled) {
        this.system._disableScriptComponent(this)
      }
      this.system._destroyScriptComponent(this);
      this.data.areScriptsLoaded = false;
      var scripts = newValue;
      var urls = scripts.map(function(s) {
        return s.url
      });
      if(this._loadFromCache(urls)) {
        return
      }
      this._loadScripts(urls)
    }
  }, _updateScriptAttributes:function(oldValue, newValue) {
    var onlyUpdateAttributes = true;
    if(oldValue.length !== newValue.length) {
      onlyUpdateAttributes = false
    }else {
      var i;
      len = newValue.length;
      for(i = 0;i < len;i++) {
        if(oldValue[i].url !== newValue[i].url) {
          onlyUpdateAttributes = false;
          break
        }
      }
    }
    if(onlyUpdateAttributes) {
      for(var key in this.instances) {
        if(this.instances.hasOwnProperty(key)) {
          this.system._updateAccessors(this.entity, this.instances[key])
        }
      }
    }
    return onlyUpdateAttributes
  }, _loadFromCache:function(urls) {
    var cached = [];
    for(var i = 0, len = urls.length;i < len;i++) {
      var type = this.system.app.loader.getFromCache(urls[i]);
      if(!type) {
        return false
      }else {
        cached.push(type)
      }
    }
    for(var i = 0, len = cached.length;i < len;i++) {
      var ScriptType = cached[i];
      if(ScriptType == true) {
        continue
      }
      if(ScriptType && this.entity.script) {
        if(!this.entity.script.instances[ScriptType._pcScriptName]) {
          var instance = new ScriptType(this.entity);
          this.system._preRegisterInstance(this.entity, urls[i], ScriptType._pcScriptName, instance)
        }
      }
    }
    if(this.data) {
      this.data.areScriptsLoaded = true
    }
    this.system.onInitialize(this.entity);
    this.system.onPostInitialize(this.entity);
    return true
  }, _loadScripts:function(urls) {
    var requests = urls.map(function(url) {
      return new pc.resources.ScriptRequest(url)
    });
    var options = {parent:this.entity.getRequest()};
    var promise = this.system.app.loader.request(requests, options);
    promise.then(function(resources) {
      resources.forEach(function(ScriptType, index) {
        if(ScriptType && this.entity.script) {
          if(!this.entity.script.instances[ScriptType._pcScriptName]) {
            var instance = new ScriptType(this.entity);
            this.system._preRegisterInstance(this.entity, urls[index], ScriptType._pcScriptName, instance)
          }
        }
      }, this);
      if(this.data) {
        this.data.areScriptsLoaded = true
      }
      if(!options.parent) {
        this.system.onInitialize(this.entity);
        this.system.onPostInitialize(this.entity)
      }
    }.bind(this)).then(null, function(error) {
      setTimeout(function() {
        throw error;
      })
    })
  }});
  return{ScriptComponent:ScriptComponent}
}());
pc.extend(pc, function() {
  var ScriptComponentData = function() {
    this.scripts = [];
    this.enabled = true;
    this.instances = {};
    this._instances = {};
    this.runInTools = false;
    this.attributes = {};
    this.initialized = false;
    this.postInitialized = false;
    this.areScriptsLoaded = false
  };
  ScriptComponentData = pc.inherits(ScriptComponentData, pc.ComponentData);
  return{ScriptComponentData:ScriptComponentData}
}());
pc.extend(pc, function() {
  var PackComponentSystem = function PackComponentSystem(app) {
    this.id = "pack";
    app.systems.add(this.id, this);
    this.ComponentType = pc.PackComponent;
    this.DataType = pc.PackComponentData;
    this.schema = []
  };
  PackComponentSystem = pc.inherits(PackComponentSystem, pc.ComponentSystem);
  return{PackComponentSystem:PackComponentSystem}
}());
pc.extend(pc, function() {
  var PackComponent = function PackComponent(system, entity) {
  };
  PackComponent = pc.inherits(PackComponent, pc.Component);
  return{PackComponent:PackComponent}
}());
pc.extend(pc, function() {
  var PackComponentData = function() {
  };
  PackComponentData = pc.inherits(PackComponentData, pc.ComponentData);
  return{PackComponentData:PackComponentData}
}());
pc.extend(pc, function() {
  var PickComponentSystem = function PickComponentSystem(app) {
    this.id = "pick";
    app.systems.add(this.id, this);
    this.ComponentType = pc.PickComponent;
    this.DataType = pc.PickComponentData;
    this.schema = [{name:"layer", exposed:false}, {name:"shapes", exposed:false}, {name:"material", exposed:false}];
    this.layers = {"default":[]};
    this.display = false;
    this.on("remove", this.onRemove, this)
  };
  PickComponentSystem = pc.inherits(PickComponentSystem, pc.ComponentSystem);
  pc.extend(PickComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    data.material = new pc.PhongMaterial;
    properties = ["material"];
    PickComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, onRemove:function(entity, data) {
    this.deleteShapes(data.layer, data.shapes)
  }, addShape:function(layer, shape) {
    if(this.layers[layer] === undefined) {
      this.layers[layer] = []
    }
    this.layers[layer].push(shape.model);
    if(this.display) {
      this.app.scene.addModel(shape.model)
    }
  }, deleteShapes:function(layer, shapes) {
    var layerModels = this.layers[layer];
    for(var i = 0;i < shapes.length;i++) {
      var model = shapes[i].model;
      var index = layerModels.indexOf(model);
      if(index !== -1) {
        layerModels.splice(index, 1)
      }
      if(this.display) {
        this.app.scene.removeModel(model)
      }
    }
  }, getLayerModels:function(layerName) {
    return this.layers[layerName]
  }});
  return{PickComponentSystem:PickComponentSystem}
}());
pc.extend(pc, function() {
  var PickComponent = function PickComponent(system, entity) {
  };
  PickComponent = pc.inherits(PickComponent, pc.Component);
  pc.extend(PickComponent.prototype, {addShape:function(shape, shapeName) {
    var material = this.data.material;
    var mesh = null;
    switch(shape.type) {
      case pc.shape.Type.BOX:
        mesh = pc.createBox(this.system.app.graphicsDevice, {halfExtents:shape.halfExtents});
        break;
      case pc.shape.Type.SPHERE:
        mesh = pc.createSphere(this.system.app.graphicsDevice, {radius:shape.radius});
        break;
      case pc.shape.Type.TORUS:
        mesh = pc.createTorus(this.system.app.graphicsDevice, {tubeRadius:shape.iradius, ringRadius:shape.oradius});
        break
    }
    var node = new pc.GraphNode;
    var meshInstance = new pc.MeshInstance(node, mesh, material);
    meshInstance._entity = this.entity;
    var model = new pc.Model;
    model.graph = node;
    model.meshInstances = [meshInstance];
    var shape = {shape:shape, shapeName:shapeName, model:model};
    this.data.shapes.push(shape);
    this.system.addShape(this.data.layer, shape)
  }, deleteShapes:function() {
    this.system.deleteShapes(this.data.layer, this.data.shapes);
    this.data.shapes = []
  }});
  return{PickComponent:PickComponent}
}());
pc.extend(pc, function() {
  function PickComponentData() {
    this.layer = "default";
    this.shapes = [];
    this.material = null
  }
  PickComponentData = pc.inherits(PickComponentData, pc.ComponentData);
  return{PickComponentData:PickComponentData}
}());
pc.extend(pc, function() {
  var AudioSourceComponentSystem = function(app, manager) {
    this.id = "audiosource";
    this.description = "Specifies audio assets that can be played at the position of the Entity.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.AudioSourceComponent;
    this.DataType = pc.AudioSourceComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Disabled audiosource components do not play any sounds", type:"boolean", defaultValue:true}, {name:"assets", displayName:"Assets", description:"Audio assets", type:"asset", options:{max:100, type:"audio"}, defaultValue:[]}, {name:"volume", displayName:"Volume", description:"The sound volume", type:"number", options:{max:1, min:0, step:0.1}, defaultValue:1}, {name:"pitch", displayName:"Pitch", description:"The sound pitch", type:"number", 
    defaultValue:1, options:{min:0.01, step:0.01}}, {name:"loop", displayName:"Loop", description:"Set whether sound loops or not", type:"boolean", defaultValue:false}, {name:"activate", displayName:"Activate", description:"Play first audio sample when scene loads", type:"boolean", defaultValue:true}, {name:"3d", displayName:"3d", description:"3d sounds are positioned in space, and their sound is dependent on listener position/orientation. Non-3d sounds are uniform across space", type:"boolean", 
    defaultValue:true}, {name:"minDistance", displayName:"Min Distance", description:"Distance from listener under which the sound is at full volume", type:"number", defaultValue:1, options:{min:0}}, {name:"maxDistance", displayName:"Max Distance", description:"Distance from listener over which the sound cannot be heard", type:"number", defaultValue:1E4, options:{min:0}}, {name:"rollOffFactor", displayName:"Roll-off factor", description:"Strength of the roll off", type:"number", defaultValue:1, options:{min:0}}, 
    {name:"sources", exposed:false, readOnly:true}, {name:"currentSource", exposed:false, readOnly:true}, {name:"channel", exposed:false, readOnly:true}];
    this.exposeProperties();
    this.manager = manager;
    this.initialized = false;
    pc.ComponentSystem.on("initialize", this.onInitialize, this);
    pc.ComponentSystem.on("update", this.onUpdate, this)
  };
  AudioSourceComponentSystem = pc.inherits(AudioSourceComponentSystem, pc.ComponentSystem);
  pc.extend(AudioSourceComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    properties = ["activate", "volume", "pitch", "loop", "3d", "minDistance", "maxDistance", "rollOffFactor", "enabled", "assets"];
    AudioSourceComponentSystem._super.initializeComponentData.call(this, component, data, properties);
    component.paused = !(component.enabled && component.activate)
  }, onInitialize:function(root) {
    if(root.audiosource && root.enabled && root.audiosource.enabled && root.audiosource.activate) {
      root.audiosource.play(root.audiosource.currentSource)
    }
    var children = root.getChildren();
    var i, len = children.length;
    for(i = 0;i < len;i++) {
      if(children[i] instanceof pc.Entity) {
        this.onInitialize(children[i])
      }
    }
    this.initialized = true
  }, onUpdate:function(dt) {
    var components = this.store;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var component = components[id];
        var entity = component.entity;
        var componentData = component.data;
        if(componentData.enabled && entity.enabled && componentData.channel instanceof pc.Channel3d) {
          var pos = entity.getPosition();
          componentData.channel.setPosition(pos)
        }
      }
    }
  }, setVolume:function(volume) {
    this.manager.setVolume(volume)
  }});
  return{AudioSourceComponentSystem:AudioSourceComponentSystem}
}());
pc.extend(pc, function() {
  var AudioSourceComponent = function(system, entity) {
    this.on("set_assets", this.onSetAssets, this);
    this.on("set_loop", this.onSetLoop, this);
    this.on("set_volume", this.onSetVolume, this);
    this.on("set_pitch", this.onSetPitch, this);
    this.on("set_minDistance", this.onSetMinDistance, this);
    this.on("set_maxDistance", this.onSetMaxDistance, this);
    this.on("set_rollOffFactor", this.onSetRollOffFactor, this)
  };
  AudioSourceComponent = pc.inherits(AudioSourceComponent, pc.Component);
  pc.extend(AudioSourceComponent.prototype, {play:function(name) {
    if(!this.enabled || !this.entity.enabled) {
      return
    }
    if(this.channel) {
      this.stop()
    }
    var channel;
    var componentData = this.data;
    if(componentData.sources[name]) {
      if(!componentData.sources[name].isLoaded) {
        logWARNING(pc.string.format("Audio asset '{0}' is not loaded (probably an unsupported format) and will not be played", name));
        return
      }
      if(!componentData["3d"]) {
        channel = this.system.manager.playSound(componentData.sources[name], componentData);
        componentData.currentSource = name;
        componentData.channel = channel
      }else {
        var pos = this.entity.getPosition();
        channel = this.system.manager.playSound3d(componentData.sources[name], pos, componentData);
        componentData.currentSource = name;
        componentData.channel = channel
      }
    }
  }, pause:function() {
    if(this.channel) {
      this.channel.pause()
    }
  }, unpause:function() {
    if(this.channel && this.channel.paused) {
      this.channel.unpause()
    }
  }, stop:function() {
    if(this.channel) {
      this.channel.stop();
      this.channel = null
    }
  }, onSetAssets:function(name, oldValue, newValue) {
    var componentData = this.data;
    var newAssets = [];
    var i, len = newValue.length;
    if(oldValue && oldValue.length) {
      for(var i = 0;i < oldValue.length;i++) {
        if(oldValue[i]) {
          var asset = this.system.app.assets.getAssetById(oldValue[i]);
          if(asset) {
            asset.off("change", this.onAssetChanged, this)
          }
        }
      }
    }
    if(len) {
      for(i = 0;i < len;i++) {
        if(oldValue.indexOf(newValue[i]) < 0) {
          newAssets.push(newValue[i])
        }
      }
    }
    if(!this.system._inTools && newAssets.length) {
      this.loadAudioSourceAssets(newAssets)
    }
  }, onAssetChanged:function(asset, attribute, newValue, oldValue) {
    if(attribute === "resource") {
      var sources = this.data.sources;
      if(sources) {
        this.data.sources[asset.name] = newValue;
        if(this.data.currentSource === asset.name) {
          if(this.channel) {
            if(this.channel.paused) {
              this.play(asset.name);
              this.pause()
            }else {
              this.play(asset.name)
            }
          }
        }
      }
    }
  }, onSetLoop:function(name, oldValue, newValue) {
    if(oldValue != newValue) {
      if(this.channel) {
        this.channel.setLoop(newValue)
      }
    }
  }, onSetVolume:function(name, oldValue, newValue) {
    if(oldValue != newValue) {
      if(this.channel) {
        this.channel.setVolume(newValue)
      }
    }
  }, onSetPitch:function(name, oldValue, newValue) {
    if(oldValue != newValue) {
      if(this.channel) {
        this.channel.setPitch(newValue)
      }
    }
  }, onSetMaxDistance:function(name, oldValue, newValue) {
    if(oldValue != newValue) {
      if(this.channel instanceof pc.Channel3d) {
        this.channel.setMaxDistance(newValue)
      }
    }
  }, onSetMinDistance:function(name, oldValue, newValue) {
    if(oldValue != newValue) {
      if(this.channel instanceof pc.Channel3d) {
        this.channel.setMinDistance(newValue)
      }
    }
  }, onSetRollOffFactor:function(name, oldValue, newValue) {
    if(oldValue != newValue) {
      if(this.channel instanceof pc.Channel3d) {
        this.channel.setRollOffFactor(newValue)
      }
    }
  }, onEnable:function() {
    AudioSourceComponent._super.onEnable.call(this);
    if(this.system.initialized) {
      if(this.data.activate && !this.channel) {
        this.play(this.currentSource)
      }else {
        this.unpause()
      }
    }
  }, onDisable:function() {
    AudioSourceComponent._super.onDisable.call(this);
    this.pause()
  }, loadAudioSourceAssets:function(ids) {
    var options = {parent:this.entity.getRequest()};
    var assets = ids.map(function(id) {
      return this.system.app.assets.getAssetById(id)
    }, this);
    var requests = [];
    var names = [];
    var sources = {};
    var currentSource = null;
    assets.forEach(function(asset) {
      if(!asset) {
        logERROR(pc.string.format("Trying to load audiosource component before assets {0} are loaded", ids))
      }else {
        currentSource = currentSource || asset.name;
        asset.off("change", this.onAssetChanged, this);
        asset.on("change", this.onAssetChanged, this);
        if(asset.resource) {
          sources[asset.name] = asset.resource
        }else {
          requests.push(new pc.resources.AudioRequest(asset.getFileUrl()));
          names.push(asset.name)
        }
      }
    }.bind(this));
    if(requests.length) {
      this.system.app.loader.request(requests, options).then(function(audioResources) {
        for(var i = 0;i < requests.length;i++) {
          sources[names[i]] = audioResources[i]
        }
        this.data.sources = sources;
        this.data.currentSource = currentSource;
        if(!options.parent && this.enabled && this.activate && currentSource) {
          this.onEnable()
        }
      }.bind(this))
    }else {
      this.data.sources = sources;
      this.data.currentSource = currentSource;
      if(this.enabled && this.activate && currentSource) {
        this.onEnable()
      }
    }
  }});
  return{AudioSourceComponent:AudioSourceComponent}
}());
pc.AudioSourceComponentData = function AudioSourceComponentData() {
  this.enabled = true;
  this.assets = [];
  this.activate = true;
  this.volume = 1;
  this.pitch = 1;
  this.loop = false;
  this["3d"] = true;
  this.minDistance = 1;
  this.maxDistance = 1E4;
  this.rollOffFactor = 1;
  this.paused = true;
  this.sources = {};
  this.currentSource = null;
  this.channel = null
};
pc.extend(pc, function() {
  var AudioListenerComponentSystem = function(app, manager) {
    this.id = "audiolistener";
    this.description = "Specifies the location of the listener for 3D audio playback.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.AudioListenerComponent;
    this.DataType = pc.AudioListenerComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Disabled audio listener components do not affect audiosources", type:"boolean", defaultValue:true}];
    this.exposeProperties();
    this.manager = manager;
    this.current = null;
    pc.ComponentSystem.on("update", this.onUpdate, this)
  };
  AudioListenerComponentSystem = pc.inherits(AudioListenerComponentSystem, pc.ComponentSystem);
  pc.extend(AudioListenerComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    properties = ["enabled"];
    AudioListenerComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, onUpdate:function(dt) {
    if(this.current) {
      var position = this.current.getPosition();
      this.manager.listener.setPosition(position);
      var wtm = this.current.getWorldTransform();
      this.manager.listener.setOrientation(wtm)
    }
  }});
  return{AudioListenerComponentSystem:AudioListenerComponentSystem}
}());
pc.extend(pc, function() {
  var AudioListenerComponent = function(system, entity) {
  };
  AudioListenerComponent = pc.inherits(AudioListenerComponent, pc.Component);
  pc.extend(AudioListenerComponent.prototype, {setCurrentListener:function() {
    if(this.enabled && this.entity.audiolistener && this.entity.enabled) {
      this.system.current = this.entity;
      var position = this.system.current.getPosition();
      this.system.manager.listener.setPosition(position)
    }
  }, onEnable:function() {
    AudioListenerComponent._super.onEnable.call(this);
    this.setCurrentListener()
  }, onDisable:function() {
    AudioListenerComponent._super.onDisable.call(this);
    if(this.system.current === this.entity) {
      this.system.current = null
    }
  }});
  return{AudioListenerComponent:AudioListenerComponent}
}());
pc.extend(pc, function() {
  var AudioListenerComponentData = function() {
    this.enabled = true
  };
  AudioListenerComponentData = pc.inherits(AudioListenerComponentData, pc.ComponentData);
  return{AudioListenerComponentData:AudioListenerComponentData}
}());
pc.extend(pc, function() {
  var DesignerComponentSystem = function(app) {
    app.systems.add("designer", this)
  };
  DesignerComponentSystem = pc.inherits(DesignerComponentSystem, pc.ComponentSystem);
  DesignerComponentSystem.prototype.createComponent = function(entity, data) {
    var componentData = new pc.DesignerComponentData;
    this.initializeComponent(entity, componentData, data, ["fillWindow", "width", "height"]);
    return componentData
  };
  return{DesignerComponentSystem:DesignerComponentSystem}
}());
pc.extend(pc, function() {
  DesignerComponentData = function() {
    this.fillWindow = true;
    this.width = 800;
    this.height = 450
  };
  DesignerComponentData = pc.inherits(DesignerComponentData, pc.ComponentData);
  return{DesignerComponentData:DesignerComponentData}
}());
pc.extend(pc, {BODYTYPE_STATIC:"static", BODYTYPE_DYNAMIC:"dynamic", BODYTYPE_KINEMATIC:"kinematic", BODYFLAG_STATIC_OBJECT:1, BODYFLAG_KINEMATIC_OBJECT:2, BODYFLAG_NORESPONSE_OBJECT:4, BODYSTATE_ACTIVE_TAG:1, BODYSTATE_ISLAND_SLEEPING:2, BODYSTATE_WANTS_DEACTIVATION:3, BODYSTATE_DISABLE_DEACTIVATION:4, BODYSTATE_DISABLE_SIMULATION:5, BODYGROUP_NONE:0, BODYGROUP_DEFAULT:1, BODYGROUP_DYNAMIC:1, BODYGROUP_STATIC:2, BODYGROUP_KINEMATIC:4, BODYGROUP_ENGINE_1:8, BODYGROUP_TRIGGER:16, BODYGROUP_ENGINE_2:32, 
BODYGROUP_ENGINE_3:64, BODYGROUP_USER_1:128, BODYGROUP_USER_2:256, BODYGROUP_USER_3:512, BODYGROUP_USER_4:1024, BODYGROUP_USER_5:2048, BODYGROUP_USER_6:4096, BODYGROUP_USER_7:8192, BODYGROUP_USER_8:16384, BODYMASK_NONE:0, BODYMASK_ALL:65535, BODYMASK_STATIC:2, BODYMASK_NOT_STATIC:65535 ^ 2, BODYMASK_NOT_STATIC_KINEMATIC:65535 ^ (2 | 4)});
pc.extend(pc, function() {
  var transform = new pc.Mat4;
  var newWtm = new pc.Mat4;
  var position = new pc.Vec3;
  var rotation = new pc.Vec3;
  var scale = new pc.Vec3;
  var ammoRayStart, ammoRayEnd;
  var collisions = {};
  var frameCollisions = {};
  var RaycastResult = function RaycastResult(entity, point, normal) {
    this.entity = entity;
    this.point = point;
    this.normal = normal
  };
  var SingleContactResult = function SingleContactResult(a, b, contactPoint) {
    if(arguments.length === 0) {
      this.a = null;
      this.b = null;
      this.localPointA = new pc.Vec3;
      this.localPointB = new pc.Vec3;
      this.pointA = new pc.Vec3;
      this.pointB = new pc.Vec3;
      this.normal = new pc.Vec3
    }else {
      this.a = a;
      this.b = b;
      this.localPointA = contactPoint.localPoint;
      this.localPointB = contactPoint.localPointOther;
      this.pointA = contactPoint.point;
      this.pointB = contactPoint.pointOther;
      this.normal = contactPoint.normal
    }
  };
  var ContactPoint = function ContactPoint(localPoint, localPointOther, point, pointOther, normal) {
    if(arguments.length === 0) {
      this.localPoint = new pc.Vec3;
      this.localPointOther = new pc.Vec3;
      this.point = new pc.Vec3;
      this.pointOther = new pc.Vec3;
      this.normal = new pc.Vec3
    }else {
      this.localPoint = localPoint;
      this.localPointOther = localPointOther;
      this.point = point;
      this.pointOther = pointOther;
      this.normal = normal
    }
  };
  var ContactResult = function ContactResult(other, contacts) {
    this.other = other;
    this.contacts = contacts
  };
  var RigidBodyComponentSystem = function RigidBodyComponentSystem(app) {
    this.id = "rigidbody";
    this.description = "Adds the entity to the scene's physical simulation.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.RigidBodyComponent;
    this.DataType = pc.RigidBodyComponentData;
    this.contactPointPool = new pc.AllocatePool(ContactPoint, 1);
    this.contactResultPool = new pc.AllocatePool(ContactResult, 1);
    this.singleContactResultPool = new pc.AllocatePool(SingleContactResult, 1);
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enables or disables the rigid body", type:"boolean", defaultValue:true}, {name:"type", displayName:"Type", description:"The type of body determines how it moves and collides with other bodies. Dynamic is a normal body. Static will never move. Kinematic can be moved in code, but will not respond to collisions.", type:"enumeration", options:{enumerations:[{name:"Static", value:pc.BODYTYPE_STATIC}, {name:"Dynamic", value:pc.BODYTYPE_DYNAMIC}, 
    {name:"Kinematic", value:pc.BODYTYPE_KINEMATIC}]}, defaultValue:pc.BODYTYPE_STATIC}, {name:"mass", displayName:"Mass", description:"The mass of the body", type:"number", options:{min:0, step:1}, defaultValue:1, filter:{"type":[pc.BODYTYPE_DYNAMIC, pc.BODYTYPE_KINEMATIC]}}, {name:"linearDamping", displayName:"Linear Damping", description:"The linear damping applied to the body", type:"number", options:{min:0, step:1}, defaultValue:0, filter:{"type":[pc.BODYTYPE_DYNAMIC, pc.BODYTYPE_KINEMATIC]}}, 
    {name:"angularDamping", displayName:"Angular Damping", description:"The angular damping applied to the body", type:"number", options:{min:0, step:1}, defaultValue:0, filter:{"type":[pc.BODYTYPE_DYNAMIC, pc.BODYTYPE_KINEMATIC]}}, {name:"linearFactor", displayName:"Linear Factor", description:"The linear factor applied to the linear motion of the body, used to contrain linear movement in each axis", type:"vector", options:{min:0, step:0.1}, defaultValue:[1, 1, 1], filter:{"type":[pc.BODYTYPE_DYNAMIC, 
    pc.BODYTYPE_KINEMATIC]}}, {name:"angularFactor", displayName:"Angular Factor", description:"The angular factor applied to the angular motion of the body, used to contrain angular movement in each axis", type:"vector", options:{min:0, step:0.1}, defaultValue:[1, 1, 1], filter:{"type":[pc.BODYTYPE_DYNAMIC, pc.BODYTYPE_KINEMATIC]}}, {name:"friction", displayName:"Friction", description:"The friction when the body slides along another body", type:"number", options:{min:0, step:0.01}, defaultValue:0.5}, 
    {name:"restitution", displayName:"Restitution", description:"The restitution determines the elasticity of collisions. 0 means an object does not bounce at all, a value of 1 will be a perfect reflection", type:"number", options:{min:0, step:0.01}, defaultValue:0}, {name:"group", displayName:"Group", description:"The collision group this rigidbody belongs to", type:"number", defaultValue:pc.BODYGROUP_STATIC, exposed:false}, {name:"mask", displayName:"Mask", description:"The collision mask this rigidbody uses to collide", 
    type:"number", defaultValue:pc.BODYMASK_NOT_STATIC, exposed:false}, {name:"body", exposed:false}];
    this.exposeProperties();
    this.maxSubSteps = 10;
    this.fixedTimeStep = 1 / 60;
    this.on("remove", this.onRemove, this);
    pc.ComponentSystem.on("update", this.onUpdate, this)
  };
  RigidBodyComponentSystem = pc.inherits(RigidBodyComponentSystem, pc.ComponentSystem);
  pc.extend(RigidBodyComponentSystem.prototype, {onLibraryLoaded:function() {
    if(typeof Ammo !== "undefined") {
      var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration;
      var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
      var overlappingPairCache = new Ammo.btDbvtBroadphase;
      var solver = new Ammo.btSequentialImpulseConstraintSolver;
      this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
      this._ammoGravity = new Ammo.btVector3(0, -9.82, 0);
      this.dynamicsWorld.setGravity(this._ammoGravity);
      ammoRayStart = new Ammo.btVector3;
      ammoRayEnd = new Ammo.btVector3
    }else {
      pc.ComponentSystem.off("update", this.onUpdate, this)
    }
  }, initializeComponentData:function(component, data, properties) {
    if(data.bodyType) {
      data.type = data.bodyType;
      console.warn("WARNING: rigidbody.bodyType: Property is deprecated. Use type instead.")
    }
    if(data.linearFactor && pc.type(data.linearFactor) === "array") {
      data.linearFactor = new pc.Vec3(data.linearFactor[0], data.linearFactor[1], data.linearFactor[2])
    }
    if(data.angularFactor && pc.type(data.angularFactor) === "array") {
      data.angularFactor = new pc.Vec3(data.angularFactor[0], data.angularFactor[1], data.angularFactor[2])
    }
    properties = ["enabled", "mass", "linearDamping", "angularDamping", "linearFactor", "angularFactor", "friction", "restitution", "type", "group", "mask"];
    RigidBodyComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, cloneComponent:function(entity, clone) {
    var data = {enabled:entity.rigidbody.enabled, mass:entity.rigidbody.mass, linearDamping:entity.rigidbody.linearDamping, angularDamping:entity.rigidbody.angularDamping, linearFactor:[entity.rigidbody.linearFactor.x, entity.rigidbody.linearFactor.y, entity.rigidbody.linearFactor.z], angularFactor:[entity.rigidbody.angularFactor.x, entity.rigidbody.angularFactor.y, entity.rigidbody.angularFactor.z], friction:entity.rigidbody.friction, restitution:entity.rigidbody.restitution, type:entity.rigidbody.type, 
    group:entity.rigidbody.group, mask:entity.rigidbody.mask};
    this.addComponent(clone, data)
  }, onRemove:function(entity, data) {
    if(data.body) {
      this.removeBody(data.body);
      Ammo.destroy(data.body)
    }
    data.body = null
  }, addBody:function(body, group, mask) {
    if(group !== undefined && mask !== undefined) {
      this.dynamicsWorld.addRigidBody(body, group, mask)
    }else {
      this.dynamicsWorld.addRigidBody(body)
    }
    return body
  }, removeBody:function(body) {
    this.dynamicsWorld.removeRigidBody(body)
  }, addConstraint:function(constraint) {
    this.dynamicsWorld.addConstraint(constraint);
    return constraint
  }, removeConstraint:function(constraint) {
    this.dynamicsWorld.removeConstraint(constraint)
  }, setGravity:function() {
    var x, y, z;
    if(arguments.length === 1) {
      x = arguments[0].x;
      y = arguments[0].y;
      z = arguments[0].z
    }else {
      x = arguments[0];
      y = arguments[1];
      z = arguments[2]
    }
    this._ammoGravity.setValue(x, y, z);
    this.dynamicsWorld.setGravity(this._ammoGravity)
  }, raycastFirst:function(start, end, callback) {
    ammoRayStart.setValue(start.x, start.y, start.z);
    ammoRayEnd.setValue(end.x, end.y, end.z);
    var rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);
    this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
    if(rayCallback.hasHit()) {
      var collisionObj = rayCallback.get_m_collisionObject();
      var body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
      var point = rayCallback.get_m_hitPointWorld();
      var normal = rayCallback.get_m_hitNormalWorld();
      if(body) {
        callback(new RaycastResult(body.entity, new pc.Vec3(point.x(), point.y(), point.z()), new pc.Vec3(normal.x(), normal.y(), normal.z())))
      }
    }
    Ammo.destroy(rayCallback)
  }, _storeCollision:function(entity, other) {
    var isNewCollision = false;
    var guid = entity.getGuid();
    collisions[guid] = collisions[guid] || {others:[], entity:entity};
    if(collisions[guid].others.indexOf(other) < 0) {
      collisions[guid].others.push(other);
      isNewCollision = true
    }
    frameCollisions[guid] = frameCollisions[guid] || {others:[], entity:entity};
    frameCollisions[guid].others.push(other);
    return isNewCollision
  }, _createContactPointFromAmmo:function(contactPoint) {
    var contact = this.contactPointPool.allocate();
    contact.localPoint.set(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
    contact.localPointOther.set(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
    contact.point.set(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
    contact.pointOther.set(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
    contact.normal.set(contactPoint.get_m_normalWorldOnB().x(), contactPoint.get_m_normalWorldOnB().y(), contactPoint.get_m_normalWorldOnB().z());
    return contact
  }, _createReverseContactPointFromAmmo:function(contactPoint) {
    var contact = this.contactPointPool.allocate();
    contact.localPointOther.set(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
    contact.localPoint.set(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
    contact.pointOther.set(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
    contact.point.set(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
    contact.normal.set(contactPoint.get_m_normalWorldOnB().x(), contactPoint.get_m_normalWorldOnB().y(), contactPoint.get_m_normalWorldOnB().z());
    return contact
  }, _createSingleContactResult:function(a, b, contactPoint) {
    var result = this.singleContactResultPool.allocate();
    result.a = a;
    result.b = b;
    result.localPointA = contactPoint.localPoint;
    result.localPointB = contactPoint.localPointOther;
    result.pointA = contactPoint.point;
    result.pointB = contactPoint.pointOther;
    result.normal = contactPoint.normal;
    return result
  }, _createContactResult:function(other, contacts) {
    var result = this.contactResultPool.allocate();
    result.other = other;
    result.contacts = contacts;
    return result
  }, _cleanOldCollisions:function() {
    for(var guid in collisions) {
      if(collisions.hasOwnProperty(guid)) {
        var entity = collisions[guid].entity;
        var entityCollision = entity.collision;
        var others = collisions[guid].others;
        var length = others.length;
        var i = length;
        while(i--) {
          var other = others[i];
          if(!frameCollisions[guid] || frameCollisions[guid].others.indexOf(other) < 0) {
            others.splice(i, 1);
            if(entityCollision && other.collision) {
              if(entity.rigidbody && other.rigidbody) {
                entityCollision.fire("collisionend", other)
              }else {
                if(entity.trigger) {
                  entityCollision.fire("triggerleave", other)
                }
              }
            }
          }
        }
        if(others.length === 0) {
          delete collisions[guid]
        }
      }
    }
  }, onUpdate:function(dt) {
    frameContacts = 0;
    this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);
    var components = this.store;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var entity = components[id].entity;
        var componentData = components[id].data;
        if(componentData.body && componentData.body.isActive() && componentData.enabled && entity.enabled) {
          if(componentData.type === pc.BODYTYPE_DYNAMIC) {
            entity.rigidbody.syncBodyToEntity()
          }else {
            if(componentData.type === pc.BODYTYPE_KINEMATIC) {
              entity.rigidbody._updateKinematic(dt)
            }
          }
        }
      }
    }
    var dispatcher = this.dynamicsWorld.getDispatcher();
    var numManifolds = dispatcher.getNumManifolds();
    var i, j;
    frameCollisions = {};
    for(i = 0;i < numManifolds;i++) {
      var manifold = dispatcher.getManifoldByIndexInternal(i);
      var body0 = manifold.getBody0();
      var body1 = manifold.getBody1();
      var wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
      var wb1 = Ammo.castObject(body1, Ammo.btRigidBody);
      var e0 = wb0.entity;
      var e1 = wb1.entity;
      if(!e0 || !e1) {
        continue
      }
      var flags0 = body0.getCollisionFlags();
      var flags1 = body1.getCollisionFlags();
      var numContacts = manifold.getNumContacts();
      var forwardContacts = [];
      var reverseContacts = [];
      if(numContacts > 0) {
        if(flags0 & pc.BODYFLAG_NORESPONSE_OBJECT || flags1 & pc.BODYFLAG_NORESPONSE_OBJECT) {
          var e0Events = e0.collision.hasEvent("triggerenter") || e0.collision.hasEvent("triggerleave");
          var e1Events = e1.collision.hasEvent("triggerenter") || e1.collision.hasEvent("triggerleave");
          if(e0Events) {
            var newCollision = this._storeCollision(e0, e1);
            if(newCollision) {
              if(e0.collision && !(flags1 & pc.BODYFLAG_NORESPONSE_OBJECT)) {
                e0.collision.fire("triggerenter", e1)
              }
            }
          }
          if(e1Events) {
            var newCollision = this._storeCollision(e1, e0);
            if(newCollision) {
              if(e1.collision && !(flags0 & pc.BODYFLAG_NORESPONSE_OBJECT)) {
                e1.collision.fire("triggerenter", e0)
              }
            }
          }
        }else {
          var e0Events = e0.collision.hasEvent("collisionstart") || e0.collision.hasEvent("collisionend") || e0.collision.hasEvent("contact");
          var e1Events = e1.collision.hasEvent("collisionstart") || e1.collision.hasEvent("collisionend") || e1.collision.hasEvent("contact");
          var globalEvents = this.hasEvent("contact");
          if(globalEvents || e0Events || e1Events) {
            for(j = 0;j < numContacts;j++) {
              var btContactPoint = manifold.getContactPoint(j);
              var contactPoint = this._createContactPointFromAmmo(btContactPoint);
              var reverseContactPoint = null;
              if(e0Events || e1Events) {
                reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
                forwardContacts.push(contactPoint);
                reverseContacts.push(reverseContactPoint)
              }
              if(globalEvents) {
                var result = this._createSingleContactResult(e0, e1, contactPoint);
                this.fire("contact", result)
              }
            }
            if(e0Events) {
              var forwardResult = this._createContactResult(e1, forwardContacts);
              if(e0.collision) {
                e0.collision.fire("contact", forwardResult)
              }
              var newCollision = this._storeCollision(e0, e1);
              if(newCollision && e0.collision) {
                e0.collision.fire("collisionstart", forwardResult)
              }
            }
            if(e1Events) {
              var reverseResult = this._createContactResult(e0, reverseContacts);
              if(e1.collision) {
                e1.collision.fire("contact", reverseResult)
              }
              var newCollision = this._storeCollision(e1, e0);
              if(newCollision && e1.collision) {
                e1.collision.fire("collisionstart", reverseResult)
              }
            }
          }
        }
      }
    }
    this._cleanOldCollisions();
    this.contactPointPool.freeAll();
    this.contactResultPool.freeAll();
    this.singleContactResultPool.freeAll()
  }});
  return{RIGIDBODY_TYPE_STATIC:"static", RIGIDBODY_TYPE_DYNAMIC:"dynamic", RIGIDBODY_TYPE_KINEMATIC:"kinematic", RIGIDBODY_CF_STATIC_OBJECT:1, RIGIDBODY_CF_KINEMATIC_OBJECT:2, RIGIDBODY_CF_NORESPONSE_OBJECT:4, RIGIDBODY_ACTIVE_TAG:1, RIGIDBODY_ISLAND_SLEEPING:2, RIGIDBODY_WANTS_DEACTIVATION:3, RIGIDBODY_DISABLE_DEACTIVATION:4, RIGIDBODY_DISABLE_SIMULATION:5, RigidBodyComponentSystem:RigidBodyComponentSystem}
}());
pc.extend(pc, function() {
  var ammoTransform;
  var ammoVec1, ammoVec2, ammoQuat, ammoOrigin;
  var RigidBodyComponent = function RigidBodyComponent(system, entity) {
    if(typeof Ammo !== "undefined" && !ammoTransform) {
      ammoTransform = new Ammo.btTransform;
      ammoVec1 = new Ammo.btVector3;
      ammoVec2 = new Ammo.btVector3;
      ammoQuat = new Ammo.btQuaternion;
      ammoOrigin = new Ammo.btVector3(0, 0, 0)
    }
    this.on("set_mass", this.onSetMass, this);
    this.on("set_linearDamping", this.onSetLinearDamping, this);
    this.on("set_angularDamping", this.onSetAngularDamping, this);
    this.on("set_linearFactor", this.onSetLinearFactor, this);
    this.on("set_angularFactor", this.onSetAngularFactor, this);
    this.on("set_friction", this.onSetFriction, this);
    this.on("set_restitution", this.onSetRestitution, this);
    this.on("set_type", this.onSetType, this);
    this.on("set_group", this.onSetGroupOrMask, this);
    this.on("set_mask", this.onSetGroupOrMask, this);
    this.on("set_body", this.onSetBody, this);
    entity.on("livelink:updatetransform", this.onLiveLinkUpdateTransform, this);
    this.system.on("beforeremove", this.onBeforeRemove, this);
    this._displacement = new pc.Vec3(0, 0, 0);
    this._linearVelocity = new pc.Vec3(0, 0, 0);
    this._angularVelocity = new pc.Vec3(0, 0, 0)
  };
  RigidBodyComponent = pc.inherits(RigidBodyComponent, pc.Component);
  Object.defineProperty(RigidBodyComponent.prototype, "bodyType", {get:function() {
    console.warn("WARNING: bodyType: Function is deprecated. Query type property instead.");
    return this.type
  }, set:function(type) {
    console.warn("WARNING: bodyType: Function is deprecated. Set type property instead.");
    this.type = type
  }});
  Object.defineProperty(RigidBodyComponent.prototype, "linearVelocity", {get:function() {
    if(!this.isKinematic()) {
      if(this.body) {
        var vel = this.body.getLinearVelocity();
        this._linearVelocity.set(vel.x(), vel.y(), vel.z());
        return this._linearVelocity
      }
    }else {
      return this._linearVelocity
    }
  }, set:function(lv) {
    this.activate();
    if(!this.isKinematic()) {
      var body = this.body;
      if(body) {
        ammoVec1.setValue(lv.x, lv.y, lv.z);
        body.setLinearVelocity(ammoVec1)
      }
    }else {
      this._linearVelocity.copy(lv)
    }
  }});
  Object.defineProperty(RigidBodyComponent.prototype, "angularVelocity", {get:function() {
    if(!this.isKinematic()) {
      if(this.body) {
        var vel = this.body.getAngularVelocity();
        this._angularVelocity.set(vel.x(), vel.y(), vel.z());
        return this._angularVelocity
      }
    }else {
      return this._angularVelocity
    }
  }, set:function(av) {
    this.activate();
    if(!this.isKinematic()) {
      var body = this.body;
      if(body) {
        ammoVec1.setValue(av.x, av.y, av.z);
        body.setAngularVelocity(ammoVec1)
      }
    }else {
      this._angularVelocity.copy(av)
    }
  }});
  pc.extend(RigidBodyComponent.prototype, {createBody:function() {
    var entity = this.entity;
    var shape;
    if(entity.collision) {
      shape = entity.collision.shape;
      if(entity.trigger) {
        entity.trigger.destroy();
        delete entity.trigger
      }
    }
    if(shape) {
      if(this.body) {
        this.system.removeBody(this.body);
        Ammo.destroy(this.body)
      }
      var isStaticOrKinematic = this.isStaticOrKinematic();
      var mass = isStaticOrKinematic ? 0 : this.mass;
      var localInertia = new Ammo.btVector3(0, 0, 0);
      if(!isStaticOrKinematic) {
        shape.calculateLocalInertia(mass, localInertia)
      }
      var pos = entity.getPosition();
      var rot = entity.getRotation();
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
      var startTransform = new Ammo.btTransform;
      startTransform.setIdentity();
      startTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
      startTransform.setRotation(ammoQuat);
      var motionState = new Ammo.btDefaultMotionState(startTransform);
      var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
      var body = new Ammo.btRigidBody(bodyInfo);
      body.setRestitution(this.restitution);
      body.setFriction(this.friction);
      body.setDamping(this.linearDamping, this.angularDamping);
      var v;
      v = this.linearFactor;
      ammoVec1.setValue(v.x, v.y, v.z);
      body.setLinearFactor(ammoVec1);
      v = this.angularFactor;
      ammoVec1.setValue(v.x, v.y, v.z);
      body.setAngularFactor(ammoVec1);
      body.entity = entity;
      if(this.isKinematic()) {
        body.setCollisionFlags(body.getCollisionFlags() | pc.BODYFLAG_KINEMATIC_OBJECT);
        body.setActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION)
      }
      entity.rigidbody.body = body;
      if(this.enabled && this.entity.enabled) {
        this.enableSimulation()
      }
    }
  }, isActive:function() {
    if(this.body) {
      return this.body.isActive()
    }
    return false
  }, activate:function() {
    if(this.body) {
      this.body.activate()
    }
  }, enableSimulation:function() {
    if(this.entity.collision && this.entity.collision.enabled && !this.data.simulationEnabled) {
      var body = this.body;
      if(body) {
        this.system.addBody(body, this.group, this.mask);
        if(this.isKinematic()) {
          body.forceActivationState(pc.BODYSTATE_DISABLE_DEACTIVATION);
          body.activate()
        }else {
          body.forceActivationState(pc.BODYFLAG_ACTIVE_TAG);
          this.syncEntityToBody()
        }
        this.data.simulationEnabled = true
      }
    }
  }, disableSimulation:function() {
    var body = this.body;
    if(body && this.data.simulationEnabled) {
      this.system.removeBody(body);
      body.forceActivationState(pc.BODYSTATE_DISABLE_SIMULATION);
      this.data.simulationEnabled = false
    }
  }, applyForce:function() {
    var x, y, z;
    var px, py, pz;
    switch(arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;
      case 2:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        px = arguments[1].x;
        py = arguments[1].y;
        pz = arguments[1].z;
        break;
      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;
      case 6:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        px = arguments[3];
        py = arguments[4];
        pz = arguments[5];
        break
    }
    var body = this.body;
    if(body) {
      body.activate();
      ammoVec1.setValue(x, y, z);
      if(px !== undefined) {
        ammoVec2.setValue(px, py, pz);
        body.applyForce(ammoVec1, ammoVec2)
      }else {
        body.applyForce(ammoVec1, ammoOrigin)
      }
    }
  }, applyTorque:function() {
    var x, y, z;
    switch(arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;
      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;
      default:
        console.error("ERROR: applyTorque: function takes 1 or 3 arguments");
        return
    }
    var body = this.body;
    if(body) {
      body.activate();
      ammoVec1.setValue(x, y, z);
      body.applyTorque(ammoVec1)
    }
  }, applyImpulse:function() {
    var x, y, z;
    var px, py, pz;
    switch(arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;
      case 2:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        px = arguments[1].x;
        py = arguments[1].y;
        pz = arguments[1].z;
        break;
      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;
      case 6:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        px = arguments[0];
        py = arguments[1];
        pz = arguments[2];
        break
    }
    var body = this.body;
    if(body) {
      body.activate();
      ammoVec1.setValue(x, y, z);
      if(px !== undefined) {
        ammoVec2.setValue(px, py, pz);
        body.applyImpulse(ammoVec1, ammoVec2)
      }else {
        body.applyImpulse(ammoVec1, ammoOrigin)
      }
    }
  }, applyTorqueImpulse:function() {
    var x, y, z;
    switch(arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;
      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;
      default:
        console.error("ERROR: applyTorqueImpulse: function takes 1 or 3 arguments");
        return
    }
    var body = this.body;
    if(body) {
      body.activate();
      ammoVec1.setValue(x, y, z);
      body.applyTorqueImpulse(ammoVec1)
    }
  }, isStatic:function() {
    return this.type === pc.BODYTYPE_STATIC
  }, isStaticOrKinematic:function() {
    return this.type === pc.BODYTYPE_STATIC || this.type === pc.BODYTYPE_KINEMATIC
  }, isKinematic:function() {
    return this.type === pc.BODYTYPE_KINEMATIC
  }, syncEntityToBody:function() {
    var body = this.body;
    if(body) {
      var pos = this.entity.getPosition();
      var rot = this.entity.getRotation();
      var transform = body.getWorldTransform();
      transform.getOrigin().setValue(pos.x, pos.y, pos.z);
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
      transform.setRotation(ammoQuat);
      body.activate()
    }
  }, syncBodyToEntity:function() {
    var body = this.body;
    if(body.isActive()) {
      var motionState = body.getMotionState();
      if(motionState) {
        motionState.getWorldTransform(ammoTransform);
        var p = ammoTransform.getOrigin();
        var q = ammoTransform.getRotation();
        this.entity.setPosition(p.x(), p.y(), p.z());
        this.entity.setRotation(q.x(), q.y(), q.z(), q.w())
      }
    }
  }, teleport:function() {
    if(arguments.length < 3) {
      if(arguments[0]) {
        this.entity.setPosition(arguments[0])
      }
      if(arguments[1]) {
        if(arguments[1] instanceof pc.Quat) {
          this.entity.setRotation(arguments[1])
        }else {
          this.entity.setEulerAngles(arguments[1])
        }
      }
    }else {
      if(arguments.length === 6) {
        this.entity.setEulerAngles(arguments[3], arguments[4], arguments[5])
      }
      this.entity.setPosition(arguments[0], arguments[1], arguments[2])
    }
    this.syncEntityToBody()
  }, _updateKinematic:function(dt) {
    this._displacement.copy(this._linearVelocity).scale(dt);
    this.entity.translate(this._displacement);
    this._displacement.copy(this._angularVelocity).scale(dt);
    this.entity.rotate(this._displacement.x, this._displacement.y, this._displacement.z);
    if(this.body.getMotionState()) {
      var pos = this.entity.getPosition();
      var rot = this.entity.getRotation();
      ammoTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
      ammoTransform.setRotation(ammoQuat);
      this.body.getMotionState().setWorldTransform(ammoTransform)
    }
  }, onEnable:function() {
    RigidBodyComponent._super.onEnable.call(this);
    if(!this.body) {
      this.createBody()
    }
    this.enableSimulation()
  }, onDisable:function() {
    RigidBodyComponent._super.onDisable.call(this);
    this.disableSimulation()
  }, onSetMass:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      var isEnabled = this.enabled && this.entity.enabled;
      if(isEnabled) {
        this.disableSimulation()
      }
      var mass = newValue;
      var localInertia = new Ammo.btVector3(0, 0, 0);
      body.getCollisionShape().calculateLocalInertia(mass, localInertia);
      body.setMassProps(mass, localInertia);
      body.updateInertiaTensor();
      if(isEnabled) {
        this.enableSimulation()
      }
    }
  }, onSetLinearDamping:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      body.setDamping(newValue, this.data.angularDamping)
    }
  }, onSetAngularDamping:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      body.setDamping(this.data.linearDamping, newValue)
    }
  }, onSetLinearFactor:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      ammoVec1.setValue(newValue.x, newValue.y, newValue.z);
      body.setLinearFactor(ammoVec1)
    }
  }, onSetAngularFactor:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      ammoVec1.setValue(newValue.x, newValue.y, newValue.z);
      body.setAngularFactor(ammoVec1)
    }
  }, onSetFriction:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      body.setFriction(newValue)
    }
  }, onSetRestitution:function(name, oldValue, newValue) {
    var body = this.data.body;
    if(body) {
      body.setRestitution(newValue)
    }
  }, onSetType:function(name, oldValue, newValue) {
    if(newValue !== oldValue) {
      this.disableSimulation();
      if(newValue === pc.BODYTYPE_DYNAMIC) {
        this.data.group = pc.BODYGROUP_DYNAMIC;
        this.data.mask = pc.BODYMASK_ALL
      }else {
        if(newValue === pc.BODYTYPE_KINEMATIC) {
          this.data.group = pc.BODYGROUP_KINEMATIC;
          this.data.mask = pc.BODYMASK_ALL
        }else {
          this.data.group = pc.BODYGROUP_STATIC;
          this.data.mask = pc.BODYMASK_NOT_STATIC
        }
      }
      this.createBody()
    }
  }, onSetGroupOrMask:function(name, oldValue, newValue) {
    if(newValue !== oldValue) {
      var isEnabled = this.enabled && this.entity.enabled;
      if(isEnabled) {
        this.disableSimulation();
        this.enableSimulation()
      }
    }
  }, onSetBody:function(name, oldValue, newValue) {
    if(this.body && this.data.simulationEnabled) {
      this.body.activate()
    }
  }, onLiveLinkUpdateTransform:function(position, rotation, scale) {
    this.syncEntityToBody();
    this.linearVelocity = pc.Vec3.ZERO;
    this.angularVelocity = pc.Vec3.ZERO
  }, onBeforeRemove:function(entity, component) {
    if(this === component) {
      entity.off("livelink:updatetransform", this.onLiveLinkUpdateTransform, this);
      this.system.off("beforeremove", this.onBeforeRemove, this)
    }
  }});
  return{RigidBodyComponent:RigidBodyComponent}
}());
pc.extend(pc, function() {
  var RigidBodyComponentData = function() {
    this.enabled = true;
    this.mass = 1;
    this.linearDamping = 0;
    this.angularDamping = 0;
    this.linearFactor = new pc.Vec3(1, 1, 1);
    this.angularFactor = new pc.Vec3(1, 1, 1);
    this.friction = 0.5;
    this.restitution = 0;
    this.type = pc.BODYTYPE_STATIC;
    this.group = pc.BODYGROUP_STATIC;
    this.mask = pc.BODYMASK_NOT_STATIC;
    this.body = null;
    this.simulationEnabled = false
  };
  RigidBodyComponentData = pc.inherits(RigidBodyComponentData, pc.ComponentData);
  return{RigidBodyComponentData:RigidBodyComponentData}
}());
pc.extend(pc, function() {
  var ammoVec1, ammoQuat;
  var Trigger = function Trigger(app, component, data) {
    this.entity = component.entity;
    this.component = component;
    this.app = app;
    if(typeof Ammo !== "undefined") {
      ammoVec1 = new Ammo.btVector3;
      ammoQuat = new Ammo.btQuaternion
    }
    this.initialize(data)
  };
  Trigger.prototype = {initialize:function(data) {
    var entity = this.entity;
    var shape = data.shape;
    if(shape && typeof Ammo !== "undefined") {
      if(entity.trigger) {
        entity.trigger.destroy()
      }
      var mass = 1;
      var localInertia = new Ammo.btVector3(0, 0, 0);
      shape.calculateLocalInertia(mass, localInertia);
      var pos = entity.getPosition();
      var rot = entity.getRotation();
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
      var startTransform = new Ammo.btTransform;
      startTransform.setIdentity();
      startTransform.getOrigin().setValue(pos.x, pos.y, pos.z);
      startTransform.setRotation(ammoQuat);
      var motionState = new Ammo.btDefaultMotionState(startTransform);
      var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
      var body = new Ammo.btRigidBody(bodyInfo);
      this.body = body;
      body.setRestitution(0);
      body.setFriction(0);
      body.setDamping(0, 0);
      ammoVec1.setValue(0, 0, 0);
      body.setLinearFactor(ammoVec1);
      body.setAngularFactor(ammoVec1);
      body.setCollisionFlags(body.getCollisionFlags() | pc.BODYFLAG_NORESPONSE_OBJECT);
      body.entity = entity;
      if(this.component.enabled && entity.enabled) {
        this.enable()
      }
    }
  }, destroy:function() {
    if(this.body) {
      this.app.systems.rigidbody.removeBody(this.body)
    }
  }, syncEntityToBody:function() {
    var body = this.body;
    if(body) {
      var position = this.entity.getPosition();
      var rotation = this.entity.getRotation();
      var transform = body.getWorldTransform();
      transform.getOrigin().setValue(position.x, position.y, position.z);
      ammoQuat.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
      transform.setRotation(ammoQuat);
      body.activate()
    }
  }, enable:function() {
    var body = this.body;
    this.app.systems.rigidbody.addBody(body, pc.BODYGROUP_TRIGGER, pc.BODYMASK_NOT_STATIC ^ pc.BODYGROUP_TRIGGER);
    body.forceActivationState(pc.BODYSTATE_ACTIVE_TAG);
    body.activate()
  }, disable:function() {
    var body = this.body;
    this.app.systems.rigidbody.removeBody(body);
    body.forceActivationState(pc.BODYSTATE_DISABLE_SIMULATION)
  }};
  return{Trigger:Trigger}
}());
pc.extend(pc, function() {
  var CollisionComponentSystem = function CollisionComponentSystem(app) {
    this.id = "collision";
    this.description = "Specifies a collision volume.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.CollisionComponent;
    this.DataType = pc.CollisionComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enables or disables the collision", type:"boolean", defaultValue:true}, {name:"type", displayName:"Type", description:"The type of the collision volume", type:"enumeration", options:{enumerations:[{name:"Box", value:"box"}, {name:"Sphere", value:"sphere"}, {name:"Capsule", value:"capsule"}, {name:"Cylinder", value:"cylinder"}, {name:"Mesh", value:"mesh"}]}, defaultValue:"box"}, {name:"halfExtents", displayName:"Half Extents", 
    description:"The half-extents of the box", type:"vector", options:{min:0, step:0.1}, defaultValue:[0.5, 0.5, 0.5], filter:{type:"box"}}, {name:"radius", displayName:"Radius", description:"The radius of the collision volume", type:"number", options:{min:0, step:0.1}, defaultValue:0.5, filter:{type:["sphere", "capsule", "cylinder"]}}, {name:"axis", displayName:"Axis", description:"Major axis of the volume", type:"enumeration", options:{enumerations:[{name:"X", value:0}, {name:"Y", value:1}, {name:"Z", 
    value:2}]}, defaultValue:1, filter:{type:["capsule", "cylinder"]}}, {name:"height", displayName:"Height", description:"Height of the volume", type:"number", options:{min:0, step:0.1}, defaultValue:2, filter:{type:["capsule", "cylinder"]}}, {name:"asset", displayName:"Asset", description:"Collision mesh asset", type:"asset", options:{max:1, type:"model"}, defaultValue:null, filter:{type:"mesh"}}, {name:"shape", exposed:false}, {name:"model", exposed:false}];
    this.exposeProperties();
    this.implementations = {};
    this.debugRender = false;
    this.on("remove", this.onRemove, this);
    pc.ComponentSystem.on("update", this.onUpdate, this);
    pc.ComponentSystem.on("toolsUpdate", this.onToolsUpdate, this)
  };
  CollisionComponentSystem = pc.inherits(CollisionComponentSystem, pc.ComponentSystem);
  CollisionComponentSystem.prototype = pc.extend(CollisionComponentSystem.prototype, {onLibraryLoaded:function() {
    if(typeof Ammo !== "undefined") {
    }else {
      pc.ComponentSystem.off("update", this.onUpdate, this)
    }
  }, initializeComponentData:function(component, data, properties) {
    if(!data.type) {
      data.type = component.data.type
    }
    component.data.type = data.type;
    if(data.halfExtents && pc.type(data.halfExtents) === "array") {
      data.halfExtents = new pc.Vec3(data.halfExtents[0], data.halfExtents[1], data.halfExtents[2])
    }
    var impl = this._createImplementation(data.type);
    impl.beforeInitialize(component, data);
    properties = ["type", "halfExtents", "radius", "axis", "height", "shape", "model", "asset", "enabled"];
    CollisionComponentSystem._super.initializeComponentData.call(this.system, component, data, properties);
    impl.afterInitialize(component, data)
  }, _createImplementation:function(type) {
    if(this.implementations[type] === undefined) {
      var impl;
      switch(type) {
        case "box":
          impl = new CollisionBoxSystemImpl(this);
          break;
        case "sphere":
          impl = new CollisionSphereSystemImpl(this);
          break;
        case "capsule":
          impl = new CollisionCapsuleSystemImpl(this);
          break;
        case "cylinder":
          impl = new CollisionCylinderSystemImpl(this);
          break;
        case "mesh":
          impl = new CollisionMeshSystemImpl(this);
          break;
        default:
          throw"Invalid collision system type: " + type;break
      }
      this.implementations[type] = impl
    }
    return this.implementations[type]
  }, _getImplementation:function(entity) {
    return this.implementations[entity.collision.data.type]
  }, cloneComponent:function(entity, clone) {
    return this._getImplementation(entity).clone(entity, clone)
  }, onRemove:function(entity, data) {
    this.implementations[data.type].remove(entity, data)
  }, onUpdate:function(dt) {
    var id, entity, data;
    var components = this.store;
    for(id in components) {
      entity = components[id].entity;
      data = components[id].data;
      if(data.enabled && entity.enabled) {
        if(!entity.rigidbody) {
          entity.trigger.syncEntityToBody()
        }
      }
      if(this.debugRender) {
        this.updateDebugShape(entity, data, this._getImplementation(entity))
      }
    }
  }, updateDebugShape:function(entity, data, impl) {
    var app = this.app;
    if(impl !== undefined) {
      if(impl.hasDebugShape) {
        if(data.model) {
          if(!app.scene.containsModel(data.model)) {
            if(entity.enabled && data.enabled) {
              app.scene.addModel(data.model);
              app.root.addChild(data.model.graph)
            }
          }else {
            if(!data.enabled || !entity.enabled) {
              app.root.removeChild(data.model.graph);
              app.scene.removeModel(data.model)
            }
          }
        }
        if(data.enabled && entity.enabled) {
          impl.updateDebugShape(entity, data)
        }
      }
    }
  }, onTransformChanged:function(component, position, rotation, scale) {
    this.implementations[component.data.type].updateTransform(component, position, rotation, scale)
  }, onToolsUpdate:function(dt) {
    var id, entity;
    var components = this.store;
    for(id in components) {
      entity = components[id].entity;
      this.updateDebugShape(entity, components[id].data, this._getImplementation(entity))
    }
  }, setDebugRender:function(value) {
    this.debugRender = value
  }, changeType:function(component, previousType, newType) {
    this.implementations[previousType].remove(component.entity, component.data);
    this._createImplementation(newType).reset(component, component.data)
  }, recreatePhysicalShapes:function(component) {
    this.implementations[component.data.type].recreatePhysicalShapes(component)
  }});
  CollisionSystemImpl = function(system) {
    this.system = system;
    this.hasDebugShape = true
  };
  CollisionSystemImpl.prototype = {beforeInitialize:function(component, data) {
    data.shape = this.createPhysicalShape(component.entity, data);
    data.model = new pc.Model;
    data.model.graph = new pc.GraphNode;
    data.model.meshInstances = [this.createDebugMesh(data)]
  }, afterInitialize:function(component, data) {
    this.recreatePhysicalShapes(component);
    component.data.initialized = true
  }, reset:function(component, data) {
    this.beforeInitialize(component, data);
    this.afterInitialize(component, data)
  }, recreatePhysicalShapes:function(component) {
    var entity = component.entity;
    var data = component.data;
    if(typeof Ammo !== "undefined") {
      data.shape = this.createPhysicalShape(component.entity, data);
      if(entity.rigidbody) {
        entity.rigidbody.disableSimulation();
        entity.rigidbody.createBody()
      }else {
        if(!entity.trigger) {
          entity.trigger = new pc.Trigger(this.system.app, component, data)
        }else {
          entity.trigger.initialize(data)
        }
      }
    }
  }, createDebugMesh:function(data) {
    return undefined
  }, createPhysicalShape:function(entity, data) {
    return undefined
  }, updateDebugShape:function(entity, data) {
  }, updateTransform:function(component, position, rotation, scale) {
    if(component.entity.trigger) {
      component.entity.trigger.syncEntityToBody()
    }
  }, remove:function(entity, data) {
    var app = this.system.app;
    if(entity.rigidbody && entity.rigidbody.body) {
      app.systems.rigidbody.removeBody(entity.rigidbody.body)
    }
    if(entity.trigger) {
      entity.trigger.destroy();
      delete entity.trigger
    }
    if(app.scene.containsModel(data.model)) {
      app.root.removeChild(data.model.graph);
      app.scene.removeModel(data.model)
    }
  }, clone:function(entity, clone) {
    var src = this.system.dataStore[entity.getGuid()];
    var data = {enabled:src.data.enabled, type:src.data.type, halfExtents:[src.data.halfExtents.x, src.data.halfExtents.y, src.data.halfExtents.z], radius:src.data.radius, axis:src.data.axis, height:src.data.height, asset:src.data.asset, model:src.data.model};
    return this.system.addComponent(clone, data)
  }};
  CollisionBoxSystemImpl = function(system) {
  };
  CollisionBoxSystemImpl = pc.inherits(CollisionBoxSystemImpl, CollisionSystemImpl);
  CollisionBoxSystemImpl.prototype = pc.extend(CollisionBoxSystemImpl.prototype, {createDebugMesh:function(data) {
    if(!this.mesh) {
      var gd = this.system.app.graphicsDevice;
      var format = new pc.VertexFormat(gd, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
      var vertexBuffer = new pc.VertexBuffer(gd, format, 8);
      var positions = new Float32Array(vertexBuffer.lock());
      positions.set([-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5]);
      vertexBuffer.unlock();
      var indexBuffer = new pc.IndexBuffer(gd, pc.INDEXFORMAT_UINT8, 24);
      var indices = new Uint8Array(indexBuffer.lock());
      indices.set([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
      indexBuffer.unlock();
      var mesh = new pc.Mesh;
      mesh.vertexBuffer = vertexBuffer;
      mesh.indexBuffer[0] = indexBuffer;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = indexBuffer.getNumIndices();
      mesh.primitive[0].indexed = true;
      this.mesh = mesh
    }
    if(!this.material) {
      var material = new pc.BasicMaterial;
      material.color = new pc.Color(0, 0, 1, 1);
      material.update();
      this.material = material
    }
    return new pc.MeshInstance(data.model.graph, this.mesh, this.material)
  }, createPhysicalShape:function(entity, data) {
    if(typeof Ammo !== "undefined") {
      var he = data.halfExtents;
      var ammoHe = new Ammo.btVector3(he.x, he.y, he.z);
      return new Ammo.btBoxShape(ammoHe)
    }else {
      return undefined
    }
  }, updateDebugShape:function(entity, data) {
    var he = data.halfExtents;
    var x = he.x;
    var y = he.y;
    var z = he.z;
    var root = data.model.graph;
    root.setPosition(entity.getPosition());
    root.setRotation(entity.getRotation());
    root.setLocalScale(x * 2, y * 2, z * 2)
  }});
  CollisionSphereSystemImpl = function(system) {
  };
  CollisionSphereSystemImpl = pc.inherits(CollisionSphereSystemImpl, CollisionSystemImpl);
  CollisionSphereSystemImpl.prototype = pc.extend(CollisionSphereSystemImpl.prototype, {createDebugMesh:function(data) {
    if(!this.mesh) {
      var app = this.system.app;
      var gd = app.graphicsDevice;
      var format = new pc.VertexFormat(gd, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
      var vertexBuffer = new pc.VertexBuffer(gd, format, 240);
      var positions = new Float32Array(vertexBuffer.lock());
      var i, x = 0;
      var theta;
      for(var ring = 0;ring < 3;ring++) {
        var xo = 0;
        var yo = 1;
        var zo = 2;
        if(ring === 1) {
          xo = 1;
          yo = 0;
          zo = 2
        }else {
          if(ring === 2) {
            xo = 0;
            yo = 2;
            zo = 1
          }
        }
        for(i = 0;i < 40;i++) {
          theta = 2 * Math.PI * (i / 40);
          positions[x + xo] = 0.5 * Math.cos(theta);
          positions[x + yo] = 0;
          positions[x + zo] = 0.5 * Math.sin(theta);
          x += 3;
          theta = 2 * Math.PI * ((i + 1) / 40);
          positions[x + xo] = 0.5 * Math.cos(theta);
          positions[x + yo] = 0;
          positions[x + zo] = 0.5 * Math.sin(theta);
          x += 3
        }
      }
      vertexBuffer.unlock();
      var mesh = new pc.Mesh;
      mesh.vertexBuffer = vertexBuffer;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = vertexBuffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      this.mesh = mesh
    }
    if(!this.material) {
      var material = new pc.BasicMaterial;
      material.color = new pc.Color(0, 0, 1, 1);
      material.update();
      this.material = material
    }
    return new pc.MeshInstance(data.model.graph, this.mesh, this.material)
  }, createPhysicalShape:function(entity, data) {
    if(typeof Ammo !== "undefined") {
      return new Ammo.btSphereShape(data.radius)
    }else {
      return undefined
    }
  }, updateDebugShape:function(entity, data) {
    var root = data.model.graph;
    root.setPosition(entity.getPosition());
    root.setRotation(entity.getRotation());
    var s = data.radius * 2;
    root.setLocalScale(s, s, s)
  }});
  CollisionCapsuleSystemImpl = function(system) {
  };
  CollisionCapsuleSystemImpl = pc.inherits(CollisionCapsuleSystemImpl, CollisionSystemImpl);
  CollisionCapsuleSystemImpl.prototype = pc.extend(CollisionCapsuleSystemImpl.prototype, {createDebugMesh:function(data) {
    if(data.model && data.model.meshInstances && data.model.meshInstances.length) {
      return data.model.meshInstances[0]
    }else {
      var gd = this.system.app.graphicsDevice;
      var format = new pc.VertexFormat(gd, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
      var vertexBuffer = new pc.VertexBuffer(gd, format, 328, pc.BUFFER_DYNAMIC);
      this.updateCapsuleShape(data, vertexBuffer);
      var mesh = new pc.Mesh;
      mesh.vertexBuffer = vertexBuffer;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = vertexBuffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      this.mesh = mesh
    }
    if(!this.material) {
      var material = new pc.BasicMaterial;
      material.color = new pc.Color(0, 0, 1, 1);
      material.update();
      this.material = material
    }
    return new pc.MeshInstance(data.model.graph, mesh, this.material)
  }, updateCapsuleShape:function(data, vertexBuffer) {
    var axis = data.axis !== undefined ? data.axis : 1;
    var radius = data.radius || 0.5;
    var height = Math.max((data.height || 2) - 2 * radius, 0);
    var positions = new Float32Array(vertexBuffer.lock());
    var xo = 0;
    var yo = 1;
    var zo = 2;
    if(axis === 0) {
      xo = 1;
      yo = 0;
      zo = 2
    }else {
      if(axis === 2) {
        xo = 0;
        yo = 2;
        zo = 1
      }
    }
    var i, x = 0;
    var theta;
    for(cap = -1;cap < 2;cap += 2) {
      for(i = 0;i < 40;i++) {
        theta = 2 * Math.PI * (i / 40);
        positions[x + xo] = radius * Math.cos(theta);
        positions[x + yo] = cap * height * 0.5;
        positions[x + zo] = radius * Math.sin(theta);
        x += 3;
        theta = 2 * Math.PI * ((i + 1) / 40);
        positions[x + xo] = radius * Math.cos(theta);
        positions[x + yo] = cap * height * 0.5;
        positions[x + zo] = radius * Math.sin(theta);
        x += 3
      }
      for(i = 0;i < 20;i++) {
        theta = Math.PI * (i / 20) + Math.PI * 1.5;
        positions[x + xo] = 0;
        positions[x + yo] = cap * (height * 0.5 + radius * Math.cos(theta));
        positions[x + zo] = cap * radius * Math.sin(theta);
        x += 3;
        theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
        positions[x + xo] = 0;
        positions[x + yo] = cap * (height * 0.5 + radius * Math.cos(theta));
        positions[x + zo] = cap * radius * Math.sin(theta);
        x += 3
      }
      for(i = 0;i < 20;i++) {
        theta = Math.PI * (i / 20) + Math.PI * 1.5;
        positions[x + xo] = cap * radius * Math.sin(theta);
        positions[x + yo] = cap * (height * 0.5 + radius * Math.cos(theta));
        positions[x + zo] = 0;
        x += 3;
        theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
        positions[x + xo] = cap * radius * Math.sin(theta);
        positions[x + yo] = cap * (height * 0.5 + radius * Math.cos(theta));
        positions[x + zo] = 0;
        x += 3
      }
    }
    for(i = 0;i < 4;i++) {
      theta = 2 * Math.PI * (i / 4);
      positions[x + xo] = radius * Math.cos(theta);
      positions[x + yo] = height * 0.5;
      positions[x + zo] = radius * Math.sin(theta);
      x += 3;
      theta = 2 * Math.PI * (i / 4);
      positions[x + xo] = radius * Math.cos(theta);
      positions[x + yo] = -height * 0.5;
      positions[x + zo] = radius * Math.sin(theta);
      x += 3
    }
    vertexBuffer.unlock()
  }, createPhysicalShape:function(entity, data) {
    var shape = null;
    var axis = data.axis !== undefined ? data.axis : 1;
    var radius = data.radius || 0.5;
    var height = Math.max((data.height || 2) - 2 * radius, 0);
    if(typeof Ammo !== "undefined") {
      switch(axis) {
        case 0:
          shape = new Ammo.btCapsuleShapeX(radius, height);
          break;
        case 1:
          shape = new Ammo.btCapsuleShape(radius, height);
          break;
        case 2:
          shape = new Ammo.btCapsuleShapeZ(radius, height);
          break
      }
    }
    return shape
  }, updateDebugShape:function(entity, data) {
    var root = data.model.graph;
    root.setPosition(entity.getPosition());
    root.setRotation(entity.getRotation());
    root.setLocalScale(1, 1, 1)
  }, recreatePhysicalShapes:function(component) {
    var model = component.data.model;
    if(model) {
      var vertexBuffer = this.createDebugMesh(component.data).mesh.vertexBuffer;
      this.updateCapsuleShape(component.data, vertexBuffer);
      CollisionCapsuleSystemImpl._super.recreatePhysicalShapes.call(this, component)
    }
  }});
  CollisionCylinderSystemImpl = function(system) {
  };
  CollisionCylinderSystemImpl = pc.inherits(CollisionCylinderSystemImpl, CollisionSystemImpl);
  CollisionCylinderSystemImpl.prototype = pc.extend(CollisionCylinderSystemImpl.prototype, {createDebugMesh:function(data) {
    if(data.model && data.model.meshInstances && data.model.meshInstances.length) {
      return data.model.meshInstances[0]
    }else {
      var gd = this.system.app.graphicsDevice;
      var format = new pc.VertexFormat(gd, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
      var vertexBuffer = new pc.VertexBuffer(gd, format, 168, pc.BUFFER_DYNAMIC);
      this.updateCylinderShape(data, vertexBuffer);
      var mesh = new pc.Mesh;
      mesh.vertexBuffer = vertexBuffer;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = vertexBuffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      if(!this.material) {
        var material = new pc.BasicMaterial;
        material.color = new pc.Color(0, 0, 1, 1);
        material.update();
        this.material = material
      }
      return new pc.MeshInstance(data.model.graph, mesh, this.material)
    }
  }, updateCylinderShape:function(data, vertexBuffer) {
    var axis = data.axis !== undefined ? data.axis : 1;
    var radius = data.radius !== undefined ? data.radius : 0.5;
    var height = data.height !== undefined ? data.height : 1;
    var positions = new Float32Array(vertexBuffer.lock());
    var xo = 0;
    var yo = 1;
    var zo = 2;
    if(axis === 0) {
      xo = 1;
      yo = 0;
      zo = 2
    }else {
      if(axis === 2) {
        xo = 0;
        yo = 2;
        zo = 1
      }
    }
    var i, x = 0;
    var theta;
    for(cap = -1;cap < 2;cap += 2) {
      for(i = 0;i < 40;i++) {
        theta = 2 * Math.PI * (i / 40);
        positions[x + xo] = radius * Math.cos(theta);
        positions[x + yo] = cap * height * 0.5;
        positions[x + zo] = radius * Math.sin(theta);
        x += 3;
        theta = 2 * Math.PI * ((i + 1) / 40);
        positions[x + xo] = radius * Math.cos(theta);
        positions[x + yo] = cap * height * 0.5;
        positions[x + zo] = radius * Math.sin(theta);
        x += 3
      }
    }
    for(i = 0;i < 4;i++) {
      theta = 2 * Math.PI * (i / 4);
      positions[x + xo] = radius * Math.cos(theta);
      positions[x + yo] = height * 0.5;
      positions[x + zo] = radius * Math.sin(theta);
      x += 3;
      theta = 2 * Math.PI * (i / 4);
      positions[x + xo] = radius * Math.cos(theta);
      positions[x + yo] = -height * 0.5;
      positions[x + zo] = radius * Math.sin(theta);
      x += 3
    }
    vertexBuffer.unlock()
  }, createPhysicalShape:function(entity, data) {
    var halfExtents = null;
    var shape = null;
    var axis = data.axis !== undefined ? data.axis : 1;
    var radius = data.radius !== undefined ? data.radius : 0.5;
    var height = data.height !== undefined ? data.height : 1;
    if(typeof Ammo !== "undefined") {
      switch(axis) {
        case 0:
          halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
          shape = new Ammo.btCylinderShapeX(halfExtents);
          break;
        case 1:
          halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
          shape = new Ammo.btCylinderShape(halfExtents);
          break;
        case 2:
          halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
          shape = new Ammo.btCylinderShapeZ(halfExtents);
          break
      }
    }
    return shape
  }, updateDebugShape:function(entity, data) {
    var root = data.model.graph;
    root.setPosition(entity.getPosition());
    root.setRotation(entity.getRotation());
    root.setLocalScale(1, 1, 1)
  }, recreatePhysicalShapes:function(component) {
    var model = component.data.model;
    if(model) {
      var vertexBuffer = this.createDebugMesh(component.data).mesh.vertexBuffer;
      this.updateCylinderShape(component.data, vertexBuffer);
      CollisionCylinderSystemImpl._super.recreatePhysicalShapes.call(this, component)
    }
  }});
  CollisionMeshSystemImpl = function(system) {
    this.hasDebugShape = false
  };
  CollisionMeshSystemImpl = pc.inherits(CollisionMeshSystemImpl, CollisionSystemImpl);
  CollisionMeshSystemImpl.prototype = pc.extend(CollisionMeshSystemImpl.prototype, {beforeInitialize:function(component, data) {
  }, createPhysicalShape:function(entity, data) {
    if(typeof Ammo !== "undefined" && data.model) {
      var model = data.model;
      var shape = new Ammo.btCompoundShape;
      var i, j;
      for(i = 0;i < model.meshInstances.length;i++) {
        var meshInstance = model.meshInstances[i];
        var mesh = meshInstance.mesh;
        var ib = mesh.indexBuffer[pc.RENDERSTYLE_SOLID];
        var vb = mesh.vertexBuffer;
        var format = vb.getFormat();
        var stride = format.size / 4;
        var positions;
        for(j = 0;j < format.elements.length;j++) {
          var element = format.elements[j];
          if(element.name === pc.SEMANTIC_POSITION) {
            positions = new Float32Array(vb.lock(), element.offset)
          }
        }
        var indices = new Uint16Array(ib.lock());
        var numTriangles = mesh.primitive[0].count / 3;
        var v1 = new Ammo.btVector3;
        var v2 = new Ammo.btVector3;
        var v3 = new Ammo.btVector3;
        var i1, i2, i3;
        var base = mesh.primitive[0].base;
        var triMesh = new Ammo.btTriangleMesh;
        for(j = 0;j < numTriangles;j++) {
          i1 = indices[base + j * 3] * stride;
          i2 = indices[base + j * 3 + 1] * stride;
          i3 = indices[base + j * 3 + 2] * stride;
          v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
          v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
          v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
          triMesh.addTriangle(v1, v2, v3, true)
        }
        var useQuantizedAabbCompression = true;
        var triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);
        var wtm = meshInstance.node.getWorldTransform();
        var scl = wtm.getScale();
        triMeshShape.setLocalScaling(new Ammo.btVector3(scl.x, scl.y, scl.z));
        var pos = meshInstance.node.getPosition();
        var rot = meshInstance.node.getRotation();
        var transform = new Ammo.btTransform;
        transform.setIdentity();
        transform.getOrigin().setValue(pos.x, pos.y, pos.z);
        var ammoQuat = new Ammo.btQuaternion;
        ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
        transform.setRotation(ammoQuat);
        shape.addChildShape(transform, triMeshShape)
      }
      var entityTransform = entity.getWorldTransform();
      var scale = entityTransform.getScale();
      var vec = new Ammo.btVector3;
      vec.setValue(scale.x, scale.y, scale.z);
      shape.setLocalScaling(vec);
      return shape
    }else {
      return undefined
    }
  }, recreatePhysicalShapes:function(component) {
    var data = component.data;
    if(data.asset !== null) {
      this.loadModelAsset(component)
    }else {
      data.model = null;
      this.doRecreatePhysicalShape(component)
    }
  }, loadModelAsset:function(component) {
    var id = component.data.asset;
    var entity = component.entity;
    var data = component.data;
    var options = {parent:entity.getRequest()};
    var asset = this.system.app.assets.getAssetById(id);
    if(!asset) {
      logERROR(pc.string.format("Trying to load model before asset {0} is loaded.", id));
      return
    }
    if(asset.resource) {
      data.model = asset.resource;
      this.doRecreatePhysicalShape(component)
    }else {
      this.system.app.assets.load(asset, [], options).then(function(resources) {
        var model = resources[0];
        data.model = model;
        this.doRecreatePhysicalShape(component)
      }.bind(this))
    }
  }, doRecreatePhysicalShape:function(component) {
    var entity = component.entity;
    var data = component.data;
    if(data.model) {
      if(data.shape) {
        Ammo.destroy(data.shape)
      }
      data.shape = this.createPhysicalShape(entity, data);
      if(entity.rigidbody) {
        entity.rigidbody.createBody()
      }else {
        if(!entity.trigger) {
          entity.trigger = new pc.Trigger(this.system.app, component, data)
        }else {
          entity.trigger.initialize(data)
        }
      }
    }else {
      this.remove(entity, data)
    }
  }, updateTransform:function(component, position, rotation, scale) {
    if(component.shape) {
      var entityTransform = component.entity.getWorldTransform();
      var worldScale = entityTransform.getScale();
      var previousScale = component.shape.getLocalScaling();
      if(worldScale.x !== previousScale.x() || worldScale.y !== previousScale.y() || worldScale.z !== previousScale.z()) {
        this.doRecreatePhysicalShape(component)
      }
    }
    CollisionMeshSystemImpl._super.updateTransform.call(this, component, position, rotation, scale)
  }});
  return{CollisionComponentSystem:CollisionComponentSystem}
}());
pc.extend(pc, function() {
  var CollisionComponent = function CollisionComponent(system, entity) {
    this.on("set_type", this.onSetType, this);
    this.on("set_halfExtents", this.onSetHalfExtents, this);
    this.on("set_radius", this.onSetRadius, this);
    this.on("set_height", this.onSetHeight, this);
    this.on("set_axis", this.onSetAxis, this);
    this.on("set_asset", this.onSetAsset, this);
    entity.on("livelink:updatetransform", this.onLiveLinkUpdateTransform, this);
    system.on("beforeremove", this.onBeforeRemove, this)
  };
  CollisionComponent = pc.inherits(CollisionComponent, pc.Component);
  pc.extend(CollisionComponent.prototype, {onSetType:function(name, oldValue, newValue) {
    if(oldValue !== newValue) {
      this.system.changeType(this, oldValue, newValue)
    }
  }, onSetHalfExtents:function(name, oldValue, newValue) {
    if(this.data.initialized && this.data.type === "box") {
      this.system.recreatePhysicalShapes(this)
    }
  }, onSetRadius:function(name, oldValue, newValue) {
    if(this.data.initialized && (this.data.type === "sphere" || this.data.type === "capsule" || this.data.type === "cylinder")) {
      this.system.recreatePhysicalShapes(this)
    }
  }, onSetHeight:function(name, oldValue, newValue) {
    if(this.data.initialized && (this.data.type === "capsule" || this.data.type === "cylinder")) {
      this.system.recreatePhysicalShapes(this)
    }
  }, onSetAxis:function(name, oldValue, newValue) {
    if(this.data.initialized && (this.data.type === "capsule" || this.data.type === "cylinder")) {
      this.system.recreatePhysicalShapes(this)
    }
  }, onSetAsset:function(name, oldValue, newValue) {
    if(this.data.initialized && this.data.type === "mesh") {
      this.system.recreatePhysicalShapes(this)
    }
  }, onEnable:function() {
    CollisionComponent._super.onEnable.call(this);
    if(this.entity.trigger) {
      this.entity.trigger.enable()
    }else {
      if(this.entity.rigidbody) {
        if(this.entity.rigidbody.enabled) {
          this.entity.rigidbody.enableSimulation()
        }
      }
    }
  }, onDisable:function() {
    CollisionComponent._super.onDisable.call(this);
    if(this.entity.trigger) {
      this.entity.trigger.disable()
    }else {
      if(this.entity.rigidbody) {
        this.entity.rigidbody.disableSimulation()
      }
    }
  }, onLiveLinkUpdateTransform:function(position, rotation, scale) {
    if(this.enabled && this.entity.enabled) {
      this.system.onTransformChanged(this, position, rotation, scale)
    }
  }, onBeforeRemove:function(entity, component) {
    if(this === component) {
      entity.off("livelink:updatetransform", this.onLiveLinkUpdateTransform, this);
      this.system.off("beforeremove", this.onBeforeRemove, this)
    }
  }});
  return{CollisionComponent:CollisionComponent}
}());
pc.extend(pc, function() {
  var CollisionComponentData = function() {
    this.enabled = true;
    this.type = "box";
    this.halfExtents = new pc.Vec3(0.5, 0.5, 0.5);
    this.radius = 0.5;
    this.axis = 1;
    this.height = 2;
    this.asset = null;
    this.shape = null;
    this.model = null;
    this.initialized = false
  };
  CollisionComponentData = pc.inherits(CollisionComponentData, pc.ComponentData);
  return{CollisionComponentData:CollisionComponentData}
}());
pc.extend(pc, function() {
  var BallSocketJointComponentSystem = function BallSocketJointComponentSystem(app) {
    this.id = "ballsocketjoint";
    app.systems.add(this.id, this);
    this.ComponentType = pc.BallSocketJointComponent;
    this.DataType = pc.BallSocketJointComponentData;
    this.schema = [{name:"pivot", displayName:"Pivot", description:"Local space pivot", type:"vector", options:{min:0, step:0.1}, defaultValue:[0, 0, 0]}, {name:"position", displayName:"Position", description:"World space joint position", type:"vector", options:{min:0, step:0.1}, defaultValue:[0, 0, 0]}, {name:"tau", displayName:"Tau", description:"TBD", type:"number", defaultValue:0.001, options:{min:0, max:1}}, {name:"damping", displayName:"Damping", description:"Damping", type:"number", defaultValue:1, 
    options:{min:0, max:1}}, {name:"impulseClamp", displayName:"Impulse Clamp", description:"Impulse Clamp", type:"number", defaultValue:0, options:{min:0, max:100}}, {name:"constraint", exposed:false}];
    this.debugRender = false;
    this.on("remove", this.onRemove, this);
    pc.ComponentSystem.on("update", this.onUpdate, this);
    pc.ComponentSystem.on("toolsUpdate", this.onToolsUpdate, this)
  };
  BallSocketJointComponentSystem = pc.inherits(BallSocketJointComponentSystem, pc.ComponentSystem);
  BallSocketJointComponentSystem.prototype = pc.extend(BallSocketJointComponentSystem.prototype, {onLibraryLoaded:function() {
    if(typeof Ammo !== "undefined") {
    }else {
      pc.ComponentSystem.off("update", this.onUpdate, this)
    }
  }, initializeComponentData:function(component, data, properties) {
    if(typeof Ammo !== "undefined") {
      if(component.entity.rigidbody) {
        if(data.pivot && pc.type(data.pivot) === "array") {
          data.pivot = new pc.Vec3(data.pivot[0], data.pivot[1], data.pivot[2])
        }
        if(data.position && pc.type(data.position) === "array") {
          data.position = new pc.Vec3(data.position[0], data.position[1], data.position[2])
        }
        var pivotA = new Ammo.btVector3(data.pivot.x, data.pivot.y, data.pivot.z);
        var body = component.entity.rigidbody.body;
        data.constraint = new Ammo.btPoint2PointConstraint(body, pivotA);
        var pivotB = data.constraint.getPivotInB();
        data.position = [pivotB.x(), pivotB.y(), pivotB.z()];
        var app = this.app;
        app.systems.rigidbody.addConstraint(data.constraint)
      }
    }
    properties = ["constraint", "pivot", "position", "tau", "damping", "impulseClamp"];
    BallSocketJointComponentSystem._super.initializeComponentData.call(this, component, data, properties)
  }, cloneComponent:function(entity, clone) {
    var data = {pivot:[entity.ballsocketjoint.pivot.x, entity.ballsocketjoint.pivot.y, entity.ballsocketjoint.pivot.z], position:[entity.ballsocketjoint.position.x, entity.ballsocketjoint.position.y, entity.ballsocketjoint.position.z], tau:entity.ballsocketjoint.tau, damping:entity.ballsocketjoint.damping, impulseClamp:entity.ballsocketjoint.impulseClamp};
    return this.addComponent(clone, data)
  }, onRemove:function(entity, data) {
    if(data.constraint) {
      this.app.systems.rigidbody.removeConstraint(data.constraint)
    }
  }, setDebugRender:function(value) {
    this.debugRender = value
  }, onUpdate:function(dt) {
    if(this.debugRender) {
      this.updateDebugShapes()
    }
  }, onToolsUpdate:function(dt) {
    this.updateDebugShapes()
  }, updateDebugShapes:function() {
    var components = this.store;
    for(var id in components) {
      var entity = components[id].entity;
      var data = components[id].data
    }
  }});
  return{BallSocketJointComponentSystem:BallSocketJointComponentSystem}
}());
pc.extend(pc, function() {
  var BallSocketJointComponent = function BallSocketJointComponent(system, entity) {
    this.on("set_pivot", this.onSetPivot, this);
    this.on("set_position", this.onSetPosition, this);
    this.on("set_tau", this.onSetTau, this);
    this.on("set_damping", this.onSetDamping, this);
    this.on("set_impulseClamp", this.onSetImpulseClamp, this)
  };
  BallSocketJointComponent = pc.inherits(BallSocketJointComponent, pc.Component);
  pc.extend(BallSocketJointComponent.prototype, {onSetPivot:function(name, oldValue, newValue) {
    if(typeof Ammo !== "undefined") {
      if(this.data.constraint) {
        var pivotA = new Ammo.btVector3(newValue.x, newValue.y, newValue.z);
        this.data.constraint.setPivotA(pivotA)
      }
    }
  }, onSetPosition:function(name, oldValue, newValue) {
    if(typeof Ammo !== "undefined") {
      if(this.data.constraint) {
        var pivotB = new Ammo.btVector3(newValue.x, newValue.y, newValue.z);
        this.data.constraint.setPivotB(pivotB)
      }
    }
  }, onSetTau:function(name, oldValue, newValue) {
    if(typeof Ammo !== "undefined") {
      if(this.data.constraint) {
        this.data.constraint.get_m_setting().set_m_tau(newValue)
      }
    }
  }, onSetDamping:function(name, oldValue, newValue) {
    if(typeof Ammo !== "undefined") {
      if(this.data.constraint) {
        this.data.constraint.get_m_setting().set_m_damping(newValue)
      }
    }
  }, onSetImpulseClamp:function(name, oldValue, newValue) {
    if(typeof Ammo !== "undefined") {
      if(this.data.constraint) {
        this.data.constraint.get_m_setting().set_m_impulseClamp(newValue)
      }
    }
  }});
  return{BallSocketJointComponent:BallSocketJointComponent}
}());
pc.extend(pc, function() {
  var BallSocketJointComponentData = function() {
    this.pivot = new pc.Vec3(0, 0, 0);
    this.position = new pc.Vec3(0, 0, 0);
    this.tau = 0.3;
    this.damping = 1;
    this.impulseClamp = 0;
    this.constraint = null
  };
  BallSocketJointComponentData = pc.inherits(BallSocketJointComponentData, pc.ComponentData);
  return{BallSocketJointComponentData:BallSocketJointComponentData}
}());
pc.extend(pc, function() {
  var ParticleSystemComponentSystem = function ParticleSystemComponentSystem(app) {
    this.id = "particlesystem";
    this.description = "Updates and renders particle system in the scene.";
    app.systems.add(this.id, this);
    this.ComponentType = pc.ParticleSystemComponent;
    this.DataType = pc.ParticleSystemComponentData;
    this.schema = [{name:"enabled", displayName:"Enabled", description:"Enable or disable the component", type:"boolean", defaultValue:true}, {name:"autoPlay", displayName:"Auto Play", description:"Play automatically on start", type:"boolean", defaultValue:true}, {name:"numParticles", displayName:"Particle Count", description:"Total number of particles allocated", type:"number", defaultValue:30, options:{min:1, max:4096, step:1}}, {name:"lifetime", displayName:"Lifetime", description:"The lifetime of each particle in seconds", 
    type:"number", defaultValue:5, options:{min:0, step:0.01}}, {name:"rate", displayName:"Emission Rate", description:"Delay between emission of each particle in seconds", type:"number", defaultValue:0.1, options:{min:0, step:0.01}}, {name:"rate2", displayName:"Emission Rate 2", description:"Defines the random range of Emission Rate", type:"number", defaultValue:0.1, options:{min:0, step:0.01}}, {name:"startAngle", displayName:"Start Angle", description:"The starting angle of each particle in degrees", 
    type:"number", defaultValue:0, options:{min:0, step:0.01}}, {name:"startAngle2", displayName:"Start Angle 2", description:"Defines the random range of Start Angle", type:"number", defaultValue:0, options:{min:0, step:0.01}}, {name:"loop", displayName:"Loop", description:"Enables looping", type:"boolean", defaultValue:true}, {name:"preWarm", displayName:"Pre Warm", description:"Starts particles in the middle of simulation", type:"boolean", defaultValue:false, filter:{loop:true}}, {name:"lighting", 
    displayName:"Lighting", description:"Enables particle lighting; Only ambient and directional lights are used", type:"boolean", defaultValue:false}, {name:"halfLambert", displayName:"Half-Lambert", description:"Uses Half-Lambert shading instead of Lambert, for softer lighting.", type:"boolean", defaultValue:false, filter:{lighting:true}}, {name:"intensity", displayName:"Color Intensity", description:"Controls the intensity of the colors for each particle", type:"number", defaultValue:1, options:{min:0, 
    max:10, step:0.1}}, {name:"depthWrite", displayName:"Depth Write", description:"Enables writing to depth buffer, therefore giving accurate occlusion between particles. Do not use it for semi-transparent particles", type:"boolean", defaultValue:false}, {name:"depthSoftening", displayName:"Depth Softening", description:"Softens particle intersections with scene geometry", type:"number", defaultValue:0, options:{min:0, max:1, step:0.01}}, {name:"sort", displayName:"Sorting Mode", description:"How to sort particles; Any value other than None will force CPU mode", 
    type:"enumeration", options:{enumerations:[{name:"None", value:pc.PARTICLESORT_NONE}, {name:"Camera Distance", value:pc.PARTICLESORT_DISTANCE}, {name:"Newer First", value:pc.PARTICLESORT_NEWER_FIRST}, {name:"Older First", value:pc.PARTICLESORT_OLDER_FIRST}]}, defaultValue:0}, {name:"blendType", displayName:"Blending Mode", description:"How to blend particles", type:"enumeration", options:{enumerations:[{name:"Alpha", value:pc.BLEND_NORMAL}, {name:"Add", value:pc.BLEND_ADDITIVE}, {name:"Multiply", 
    value:pc.BLEND_MULTIPLICATIVE}]}, defaultValue:pc.BLEND_NORMAL}, {name:"stretch", displayName:"Stretch", description:"Stretch particles in the direction of motion", type:"number", defaultValue:0, options:{min:0, step:0.01}}, {name:"alignToMotion", displayName:"Align To Motion", description:"Rotates particles along the direction of motion", type:"boolean", defaultValue:false}, {name:"emitterShape", displayName:"Emitter Shape", description:"Defines a shape in which particles are allowed to spawn", 
    type:"enumeration", options:{enumerations:[{name:"Box", value:pc.EMITTERSHAPE_BOX}, {name:"Sphere", value:pc.EMITTERSHAPE_SPHERE}]}, defaultValue:pc.EMITTERSHAPE_BOX}, {name:"emitterExtents", displayName:"Emitter Extents", description:"Defines a local box in which particles are allowed to spawn", type:"vector", filter:{emitterShape:pc.EMITTERSHAPE_BOX}, defaultValue:[0, 0, 0]}, {name:"emitterRadius", displayName:"Emitter Radius", description:"Defines radius in which particles are allowed to spawn", 
    type:"number", filter:{emitterShape:pc.EMITTERSHAPE_SPHERE}, defaultValue:0}, {name:"initialVelocity", displayName:"Initial velocity", description:"Adds initial local velocity with defined length and direction based on spawn shape", type:"number", defaultValue:0, options:{min:0, step:0.1}}, {name:"wrap", displayName:"Wrap", description:"Set to true to wrap particles around the camera. Used for infinite atmospheric effect like rain or mist.", type:"boolean", defaultValue:false}, {name:"wrapBounds", 
    displayName:"Wrap Bounds", description:"AABB around to camera to wrap particles. Used for infinite atmospheric effect like rain or mist.", type:"vector", filter:{wrap:true}, defaultValue:[0, 0, 0]}, {name:"colorMapAsset", displayName:"Color Map", description:"Color map used for each particle, with alpha channel", type:"asset", options:{max:1, type:"texture"}, defaultValue:null}, {name:"normalMapAsset", displayName:"Normal Map", description:"Normal map used for each particle", type:"asset", options:{max:1, 
    type:"texture"}, defaultValue:null}, {name:"mesh", displayName:"Particle Mesh", description:"Mesh to use as particle; Will be quad, if not set", type:"asset", options:{max:1, type:"model"}, defaultValue:null}, {name:"localVelocityGraph", displayName:"Local Velocity", description:"Curves that define the local velocity of particles over time.", type:"curveset", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[[0, 0], [0, 0], [0, 0]], betweenCurves:false}, options:{curveNames:["X", "Y", "Z"], secondCurve:"localVelocityGraph2"}}, 
    {name:"localVelocityGraph2", displayName:"Local Velocity 2", description:"Curves that define the range of the Local Velocity", type:"curveset", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[[0, 0], [0, 0], [0, 0]]}, filter:{always:false}}, {name:"velocityGraph", displayName:"Velocity", description:"Curves that define the world velocity of particles over time.", type:"curveset", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[[0, -1], [0, -1], [0, -1]], betweenCurves:true}, options:{curveNames:["X", 
    "Y", "Z"], secondCurve:"velocityGraph2"}}, {name:"velocityGraph2", displayName:"Velocity 2", description:"Curves that define the range of the Velocity", type:"curveset", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[[0, 1], [0, 1], [0, 1]]}, options:{curveNames:["X", "Y", "Z"]}, filter:{always:false}}, {name:"rotationSpeedGraph", displayName:"Rotation Speed", description:"Curve that defines how fast particles rotate over time.", type:"curve", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[0, 0], 
    betweenCurves:false}, options:{curveNames:["Angle"], secondCurve:"rotationSpeedGraph2", verticalAxisValue:360}, filter:{alignToMotion:false}}, {name:"rotationSpeedGraph2", displayName:"Rotation Speed 2", description:"Curve that defines the range of Rotation Speed", type:"curve", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[0, 0]}, options:{curveNames:["Angle"], verticalAxisValue:360}, filter:{always:false}}, {name:"scaleGraph", displayName:"Scale", description:"Curve that defines the scale of particles over time", 
    type:"curve", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[0, 0.1], betweenCurves:false}, options:{curveNames:["Scale"], verticalAxisValue:1, secondCurve:"scaleGraph2", min:0}}, {name:"scaleGraph2", displayName:"Scale 2", description:"Curve that defines the range of Scale", type:"curve", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[0, 0.1]}, options:{curveNames:["Scale"], verticalAxisValue:1, min:0}, filter:{always:false}}, {name:"colorGraph", displayName:"Color", description:"Curves that define the color of particles over time", 
    type:"curveset", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[[0, 1], [0, 1], [0, 1]], betweenCurves:false}, options:{curveNames:["R", "G", "B"], max:1, min:0}}, {name:"colorGraph2", displayName:"Color 2", description:"Curves that define the range of Color", exposed:false, type:"curveset", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[[0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]]}, options:{curveNames:["R", "G", "B"], max:1, min:0}}, {name:"alphaGraph", displayName:"Opacity", description:"Curve that defines the opacity of particles over time", 
    type:"curve", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[0, 1], betweenCurves:false}, options:{curveNames:["Opacity"], max:1, min:0, secondCurve:"alphaGraph2"}}, {name:"alphaGraph2", displayName:"Opacity 2", description:"Curve that defines the range of Opacity", type:"curve", defaultValue:{type:pc.CURVE_SMOOTHSTEP, keys:[0, 1]}, options:{curveNames:["Opacity"], max:1, min:0}, filter:{always:false}}, {name:"colorMap", exposed:false}, {name:"normalMap", exposed:false}];
    this.exposeProperties();
    this.propertyTypes = {};
    for(var i = 0;i < this.schema.length;i++) {
      var s = this.schema[i];
      this.propertyTypes[s.name] = s.type
    }
    this.on("remove", this.onRemove, this);
    pc.ComponentSystem.on("update", this.onUpdate, this);
    pc.ComponentSystem.on("toolsUpdate", this.onToolsUpdate, this);
    var gd = app.graphicsDevice;
    this.debugMesh = this._createDebugMesh();
    this.debugMaterial = new pc.BasicMaterial;
    this.debugMaterial.color = new pc.Color(1, 0.5, 0, 1);
    this.debugMaterial.update()
  };
  ParticleSystemComponentSystem = pc.inherits(ParticleSystemComponentSystem, pc.ComponentSystem);
  pc.extend(ParticleSystemComponentSystem.prototype, {initializeComponentData:function(component, data, properties) {
    properties = [];
    var types = this.propertyTypes;
    var type;
    for(var prop in data) {
      if(data.hasOwnProperty(prop)) {
        properties.push(prop)
      }
      if(types[prop] === "vector") {
        if(pc.type(data[prop]) === "array") {
          data[prop] = new pc.Vec3(data[prop][0], data[prop][1], data[prop][2])
        }
      }else {
        if(types[prop] === "curve") {
          if(!(data[prop] instanceof pc.Curve)) {
            type = data[prop].type;
            data[prop] = new pc.Curve(data[prop].keys);
            data[prop].type = type
          }
        }else {
          if(types[prop] === "curveset") {
            if(!(data[prop] instanceof pc.CurveSet)) {
              type = data[prop].type;
              data[prop] = new pc.CurveSet(data[prop].keys);
              data[prop].type = type
            }
          }
        }
      }
    }
    ParticleSystemComponentSystem._super.initializeComponentData.call(this, component, data, properties);
    if(this._inTools) {
      this._createDebugShape(component)
    }
  }, cloneComponent:function(entity, clone) {
    var source = entity.particlesystem.data;
    var schema = this.schema;
    var data = {};
    for(var i = 0, len = schema.length;i < len;i++) {
      var prop = schema[i];
      var sourceProp = source[prop.name];
      if(sourceProp instanceof pc.Vec3 || sourceProp instanceof pc.Curve || sourceProp instanceof pc.CurveSet) {
        sourceProp = sourceProp.clone();
        data[prop.name] = sourceProp
      }else {
        if(sourceProp !== null && sourceProp !== undefined) {
          data[prop.name] = sourceProp
        }
      }
    }
    return this.addComponent(clone, data)
  }, onUpdate:function(dt) {
    var components = this.store;
    var currentCamera;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var c = components[id];
        var entity = c.entity;
        var data = c.data;
        if(data.enabled && entity.enabled) {
          var emitter = data.model.emitter;
          if(!data.paused) {
            emitter.addTime(dt)
          }
        }
      }
    }
  }, onToolsUpdate:function(dt) {
    var components = this.store;
    for(var id in components) {
      if(components.hasOwnProperty(id)) {
        var c = components[id];
        if(c.data.enabled && c.entity.enabled) {
          this._updateDebugShape(c)
        }
      }
    }
  }, onRemove:function(entity, data) {
    if(data.model) {
      this.app.scene.removeModel(data.model);
      entity.removeChild(data.model.getGraph());
      data.model = null
    }
  }, _createDebugMesh:function() {
    var gd = this.app.graphicsDevice;
    var format = new pc.VertexFormat(gd, [{semantic:pc.SEMANTIC_POSITION, components:3, type:pc.ELEMENTTYPE_FLOAT32}]);
    var vertexBuffer = new pc.VertexBuffer(gd, format, 8);
    var positions = new Float32Array(vertexBuffer.lock());
    positions.set([-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5]);
    vertexBuffer.unlock();
    var indexBuffer = new pc.IndexBuffer(gd, pc.INDEXFORMAT_UINT8, 24);
    var indices = new Uint8Array(indexBuffer.lock());
    indices.set([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
    indexBuffer.unlock();
    var mesh = new pc.Mesh;
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = indexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = indexBuffer.getNumIndices();
    mesh.primitive[0].indexed = true;
    return mesh
  }, _createDebugShape:function(component) {
    var node = new pc.GraphNode;
    var model = new pc.Model;
    model.graph = node;
    model.meshInstances = [new pc.MeshInstance(node, this.debugMesh, this.debugMaterial)];
    component.data.debugShape = model;
    if(component.data.enabled && component.entity.enabled) {
      this.app.root.addChild(node);
      this.app.scene.addModel(model)
    }
    return model
  }, _updateDebugShape:function(component) {
    var he = component.data.emitterExtents;
    var x = he.x;
    var y = he.y;
    var z = he.z;
    var entity = component.entity;
    var root = component.data.debugShape.graph;
    root.setPosition(entity.getPosition());
    root.setRotation(entity.getRotation());
    x = x || 5E-4;
    y = y || 5E-4;
    z = z || 5E-4;
    root.setLocalScale(x * 2, y * 2, z * 2)
  }});
  return{ParticleSystemComponentSystem:ParticleSystemComponentSystem}
}());
pc.extend(pc, function() {
  var SIMPLE_PROPERTIES = ["emitterExtents", "emitterRadius", "colorMap", "normalMap", "loop", "initialVelocity"];
  var COMPLEX_PROPERTIES = ["numParticles", "lifetime", "rate", "rate2", "startAngle", "startAngle2", "lighting", "halfLambert", "intensity", "wrap", "wrapBounds", "depthWrite", "depthSoftening", "sort", "stretch", "alignToMotion", "preWarm", "emitterShape"];
  var GRAPH_PROPERTIES = ["scaleGraph", "scaleGraph2", "colorGraph", "colorGraph2", "alphaGraph", "alphaGraph2", "velocityGraph", "velocityGraph2", "localVelocityGraph", "localVelocityGraph2", "rotationSpeedGraph", "rotationSpeedGraph2"];
  var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
    this.on("set_colorMapAsset", this.onSetColorMapAsset, this);
    this.on("set_normalMapAsset", this.onSetNormalMapAsset, this);
    this.on("set_mesh", this.onSetMesh, this);
    this.on("set_loop", this.onSetLoop, this);
    this.on("set_blendType", this.onSetBlendType, this);
    SIMPLE_PROPERTIES.forEach(function(prop) {
      this.on("set_" + prop, this.onSetSimpleProperty, this)
    }.bind(this));
    COMPLEX_PROPERTIES.forEach(function(prop) {
      this.on("set_" + prop, this.onSetComplexProperty, this)
    }.bind(this));
    GRAPH_PROPERTIES.forEach(function(prop) {
      this.on("set_" + prop, this.onSetGraphProperty, this)
    }.bind(this))
  };
  ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.Component);
  pc.extend(ParticleSystemComponent.prototype, {onSetColorMapAsset:function(name, oldValue, newValue) {
    if(newValue) {
      this._loadAsset(newValue, function(resource) {
        this.colorMap = resource
      }.bind(this))
    }else {
      this.colorMap = null
    }
  }, onSetNormalMapAsset:function(name, oldValue, newValue) {
    if(newValue) {
      this._loadAsset(newValue, function(resource) {
        this.normalMap = resource
      }.bind(this))
    }else {
      this.normalMap = null
    }
  }, _loadAsset:function(assetId, callback) {
    var asset = assetId instanceof pc.asset.Asset ? assetId : this.system.app.assets.getAssetById(assetId);
    if(!asset) {
      logERROR(pc.string.format("Trying to load particle system before asset {0} is loaded.", assetId));
      return
    }
    var resource;
    if(asset.resource) {
      callback(asset.resource)
    }else {
      var options = {parent:this.entity.getRequest()};
      this.system.app.assets.load(asset, [], options).then(function(resources) {
        callback(resources[0])
      })
    }
  }, onSetMesh:function(name, oldValue, newValue) {
    if(newValue) {
      if(newValue instanceof pc.asset.Asset || pc.type(newValue) === "number") {
        this._loadAsset(newValue, function(model) {
          this._onMeshChanged(model)
        }.bind(this))
      }else {
        this._onMeshChanged(newValue)
      }
    }else {
      this._onMeshChanged(null)
    }
  }, _onMeshChanged:function(mesh) {
    if(mesh) {
      if(mesh.meshInstances[0]) {
        mesh = mesh.meshInstances[0].mesh
      }else {
        mesh = null
      }
    }
    this.data.mesh = mesh;
    if(this.emitter) {
      this.emitter.mesh = mesh;
      this.emitter.resetMaterial();
      this.rebuild()
    }
  }, onSetLoop:function(name, oldValue, newValue) {
    if(this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetTime()
    }
  }, onSetBlendType:function(name, oldValue, newValue) {
    if(this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.material.blendType = newValue;
      this.emitter.resetMaterial();
      this.rebuild()
    }
  }, onSetSimpleProperty:function(name, oldValue, newValue) {
    if(this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetMaterial()
    }
  }, onSetComplexProperty:function(name, oldValue, newValue) {
    if(this.emitter) {
      this.emitter[name] = newValue;
      this.reset();
      this.emitter.resetMaterial();
      this.rebuild()
    }
  }, onSetGraphProperty:function(name, oldValue, newValue) {
    if(this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.rebuildGraphs();
      this.emitter.resetMaterial()
    }
  }, onEnable:function() {
    if(!this.emitter && !this.system._inTools) {
      this.emitter = new pc.ParticleEmitter(this.system.app.graphicsDevice, {numParticles:this.data.numParticles, emitterExtents:this.data.emitterExtents, emitterRadius:this.data.emitterRadius, emitterShape:this.data.emitterShape, initialVelocity:this.data.initialVelocity, wrap:this.data.wrap, wrapBounds:this.data.wrapBounds, lifetime:this.data.lifetime, rate:this.data.rate, rate2:this.data.rate2, startAngle:this.data.startAngle, startAngle2:this.data.startAngle2, scaleGraph:this.data.scaleGraph, 
      scaleGraph2:this.data.scaleGraph2, colorGraph:this.data.colorGraph, colorGraph2:this.data.colorGraph2, alphaGraph:this.data.alphaGraph, alphaGraph2:this.data.alphaGraph2, localVelocityGraph:this.data.localVelocityGraph, localVelocityGraph2:this.data.localVelocityGraph2, velocityGraph:this.data.velocityGraph, velocityGraph2:this.data.velocityGraph2, rotationSpeedGraph:this.data.rotationSpeedGraph, rotationSpeedGraph2:this.data.rotationSpeedGraph2, colorMap:this.data.colorMap, normalMap:this.data.normalMap, 
      loop:this.data.loop, preWarm:this.data.preWarm, sort:this.data.sort, stretch:this.data.stretch, alignToMotion:this.data.alignToMotion, lighting:this.data.lighting, halfLambert:this.data.halfLambert, intensity:this.data.intensity, depthSoftening:this.data.depthSoftening, scene:this.system.app.scene, mesh:this.data.mesh, depthWrite:this.data.depthWrite, node:this.entity, blendType:this.data.blendType});
      this.emitter.meshInstance.node = this.entity;
      this.psys = new pc.Model;
      this.psys.graph = this.entity;
      this.psys.emitter = this.emitter;
      this.psys.meshInstances = [this.emitter.meshInstance];
      this.data.model = this.psys;
      this.emitter.psys = this.psys;
      if(!this.data.loop && !this.data.autoPlay) {
        this.pause()
      }
    }
    if(this.data.model) {
      if(!this.system.app.scene.containsModel(this.data.model)) {
        if(this.emitter.colorMap) {
          this.system.app.scene.addModel(this.data.model)
        }
      }
    }
    if(this.data.debugShape) {
      if(!this.system.app.scene.containsModel(this.data.debugShape)) {
        this.system.app.scene.addModel(this.data.debugShape);
        this.system.app.root.addChild(this.data.debugShape.graph)
      }
    }
    ParticleSystemComponent._super.onEnable.call(this)
  }, onDisable:function() {
    ParticleSystemComponent._super.onDisable.call(this);
    if(this.data.model) {
      if(this.system.app.scene.containsModel(this.data.model)) {
        this.system.app.scene.removeModel(this.data.model)
      }
    }
    if(this.data.debugShape) {
      this.system.app.root.removeChild(this.data.debugShape.graph);
      this.system.app.scene.removeModel(this.data.debugShape)
    }
  }, reset:function() {
    this.stop();
    if(this.emitter) {
      this.emitter.addTime(1E3);
      this.emitter.loop = this.data.loop;
      this.emitter.reset()
    }
  }, stop:function() {
    if(this.emitter) {
      this.emitter.loop = false;
      this.emitter.resetTime();
      this.emitter.addTime(0, true)
    }
  }, pause:function() {
    this.data.paused = true
  }, unpause:function() {
    this.data.paused = false
  }, play:function() {
    this.data.paused = false;
    if(this.emitter) {
      this.emitter.loop = this.data.loop;
      this.emitter.resetTime()
    }
  }, isPlaying:function() {
    if(this.data.paused) {
      return false
    }else {
      if(this.emitter && this.emitter.loop) {
        return true
      }else {
        return Date.now() <= this.emitter.endTime
      }
    }
  }, rebuild:function() {
    var enabled = this.enabled;
    this.enabled = false;
    if(this.emitter) {
      this.emitter.rebuild();
      this.emitter.meshInstance.node = this.entity;
      this.data.model.meshInstances = [this.emitter.meshInstance]
    }
    this.enabled = enabled
  }});
  return{ParticleSystemComponent:ParticleSystemComponent}
}());
pc.extend(pc, function() {
  var ParticleSystemComponentData = function() {
    this.numParticles = 1;
    this.rate = 1;
    this.rate2 = null;
    this.startAngle = 0;
    this.startAngle2 = null;
    this.lifetime = 50;
    this.emitterExtents = new pc.Vec3;
    this.emitterRadius = 0;
    this.emitterShape = pc.EMITTERSHAPE_BOX;
    this.initialVelocity = 0;
    this.wrapBounds = new pc.Vec3;
    this.colorMap = null;
    this.colorMapAsset = null;
    this.normalMap = null;
    this.normalMapAsset = null;
    this.loop = true;
    this.preWarm = false;
    this.sort = 0;
    this.mode = pc.PARTICLEMODE_GPU;
    this.scene = null;
    this.lighting = false;
    this.halfLambert = false;
    this.intensity = 1;
    this.stretch = 0;
    this.alignToMotion = false;
    this.depthSoftening = 0;
    this.mesh = null;
    this.depthWrite = false;
    this.scaleGraph = null;
    this.scaleGraph2 = null;
    this.colorGraph = null;
    this.colorGraph2 = null;
    this.alphaGraph = null;
    this.alphaGraph2 = null;
    this.localVelocityGraph = null;
    this.localVelocityGraph2 = null;
    this.velocityGraph = null;
    this.velocityGraph2 = null;
    this.rotationSpeedGraph = null;
    this.rotationSpeedGraph2 = null;
    this.blendType = pc.BLEND_NORMAL;
    this.model = null;
    this.enabled = true;
    this.paused = false;
    this.debugShape = null
  };
  ParticleSystemComponentData = pc.inherits(ParticleSystemComponentData, pc.ComponentData);
  return{ParticleSystemComponentData:ParticleSystemComponentData}
}());
pc.extend(pc, function() {
  var LiveLink = function(senderIdPrefix) {
    senderIdPrefix = senderIdPrefix || "";
    this._destinations = [];
    this._callbacks = {};
    this._linkid = senderIdPrefix + "-" + pc.guid.create();
    this._listener = null;
    this._handler = this._handleMessage.bind(this);
    window.addEventListener("message", this._handler, false);
    if(!pc.livelinks) {
      pc.livelinks = []
    }
    pc.livelinks.push(this)
  };
  LiveLink.prototype.detach = function() {
    this._listener = null;
    window.removeEventListener("message", this._handler, false)
  };
  LiveLink.prototype.addDestinationWindow = function(_window) {
    this._destinations.push(_window)
  };
  LiveLink.prototype.removeDestinationWindow = function(window) {
    var i;
    for(i = 0;i < this._destinations.length;++i) {
      if(this._destinations[i] == window) {
        this._destinations.splice(i, 1);
        break
      }
    }
  };
  LiveLink.prototype.send = function(msg, success, destinations) {
    success = success || function() {
    };
    destinations = destinations || this._destinations;
    var i, length = destinations.length;
    var closed = [];
    for(i = 0;i < length;i++) {
      var w = destinations[i];
      if(!w.closed) {
        var origin = w.location.protocol + "//" + w.location.host;
        this._send(msg, success, w, origin)
      }else {
        closed.push(w)
      }
    }
    length = closed.length;
    for(i = 0;i < length;i++) {
      this.removeDestinationWindow(closed[i])
    }
  };
  LiveLink.prototype._send = function(msg, success, _window, origin) {
    msg.senderid = this._linkid;
    if(this._callbacks[msg.id]) {
      this._callbacks[msg.id].count++
    }else {
      this._callbacks[msg.id] = {count:1, callback:success ? success.bind(this) : function() {
      }}
    }
    var data = pc.LiveLinkMessage.serialize(msg);
    if(_window === window) {
      pc.livelinks.forEach(function(link) {
        link._handleMessage({source:window, data:data})
      })
    }else {
      _window.postMessage(data, origin)
    }
  };
  LiveLink.prototype.listen = function(callback, _window) {
    if(this._listener) {
      throw new Error("LiveLink already listening");
    }
    this._listener = callback
  };
  LiveLink.prototype._handleMessage = function(event) {
    var msg, newmsg;
    var data = pc.LiveLinkMessage.deserialize(event.data);
    if(!data) {
      return
    }
    msg = new pc.LiveLinkMessage(data, event.source);
    if(this._linkid === msg.senderid) {
      return
    }
    if(msg.type == pc.LiveLinkMessageType.RECEIVED) {
      if(msg.content.received_from == this._linkid) {
        this._callbacks[msg.content.id].count--;
        if(this._callbacks[msg.content.id].count === 0) {
          this._callbacks[msg.content.id].callback();
          delete this._callbacks[msg.content.id]
        }
      }
    }else {
      if(this._listener) {
        this._listener(msg);
        newmsg = new pc.LiveLinkMessage;
        newmsg.type = pc.LiveLinkMessageType.RECEIVED;
        newmsg.content = {id:msg.id, received_from:msg.senderid};
        this._send(newmsg, null, event.source, event.origin)
      }else {
      }
    }
  };
  return{LiveLink:LiveLink}
}());
pc.extend(pc, function() {
  var LiveLinkMessage = function(data, source) {
    data = data || {};
    this.type = data.type || pc.LiveLinkMessageType.NO_TYPE;
    this.content = data.content || {};
    this.id = data.id || pc.guid.create();
    this.senderid = data.senderid || null;
    this.source = source || null
  };
  LiveLinkMessage.register = function(type) {
    pc.LiveLinkMessageType[type] = type
  };
  LiveLinkMessage.serialize = function(msg) {
    var o = {type:msg.type, content:msg.content, id:msg.id, senderid:msg.senderid};
    return JSON.stringify(o, function(key, value) {
      if(this[key] instanceof Float32Array) {
        return pc.makeArray(this[key])
      }else {
        return this[key]
      }
    })
  };
  LiveLinkMessage.deserialize = function(data) {
    try {
      var o = JSON.parse(data);
      return o
    }catch(e) {
      return null
    }
  };
  return{LiveLinkMessage:LiveLinkMessage, LiveLinkMessageRegister:{}, LiveLinkMessageType:{NO_TYPE:"NO_TYPE", RECEIVED:"RECEIVED"}}
}());
pc.extend(pc, function() {
  var LiveLinkUpdateComponentMessage = function(id, component, attribute, value) {
    this.type = pc.LiveLinkMessageType.UPDATE_COMPONENT;
    this.content = {id:id, component:component, attribute:attribute, value:value}
  };
  LiveLinkUpdateComponentMessage = pc.inherits(LiveLinkUpdateComponentMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_COMPONENT");
  return{LiveLinkUpdateComponentMessage:LiveLinkUpdateComponentMessage}
}());
pc.extend(pc, function() {
  var LiveLinkUpdateEntityMessage = function(id, components) {
    this.type = pc.LiveLinkMessageType.UPDATE_ENTITY;
    this.content = {id:id, components:components}
  };
  LiveLinkUpdateEntityMessage = pc.inherits(LiveLinkUpdateEntityMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_ENTITY");
  var LiveLinkUpdateEntityTransformMessage = function(id, position, rotation, scale) {
    this.type = pc.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM;
    this.content = {id:id, position:position, rotation:rotation, scale:scale}
  };
  LiveLinkUpdateEntityTransformMessage = pc.inherits(LiveLinkUpdateEntityTransformMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_ENTITY_TRANSFORM");
  var LiveLinkUpdateEntityNameMessage = function(id, name) {
    this.type = pc.LiveLinkMessageType.UPDATE_ENTITY_NAME;
    this.content = {id:id, name:name}
  };
  LiveLinkUpdateEntityNameMessage = pc.inherits(LiveLinkUpdateEntityNameMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_ENTITY_NAME");
  var LiveLinkUpdateEntityEnabledMessage = function(id, enabled) {
    this.type = pc.LiveLinkMessageType.UPDATE_ENTITY_ENABLED;
    this.content = {id:id, enabled:enabled}
  };
  LiveLinkUpdateEntityEnabledMessage = pc.inherits(LiveLinkUpdateEntityEnabledMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_ENTITY_ENABLED");
  var LiveLinkReparentEntityMessage = function(id, oldParentId, newParentId, index) {
    this.type = pc.LiveLinkMessageType.REPARENT_ENTITY;
    this.content = {id:id, oldParentId:oldParentId, newParentId:newParentId, index:index}
  };
  LiveLinkReparentEntityMessage = pc.inherits(LiveLinkReparentEntityMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("REPARENT_ENTITY");
  return{LiveLinkUpdateEntityMessage:LiveLinkUpdateEntityMessage, LiveLinkUpdateEntityNameMessage:LiveLinkUpdateEntityNameMessage, LiveLinkUpdateEntityEnabledMessage:LiveLinkUpdateEntityEnabledMessage, LiveLinkUpdateEntityTransformMessage:LiveLinkUpdateEntityTransformMessage, LiveLinkReparentEntityMessage:LiveLinkReparentEntityMessage}
}());
pc.extend(pc, function() {
  var LiveLinkCloseEntityMessage = function(id) {
    this.type = pc.LiveLinkMessageType.CLOSE_ENTITY;
    this.content = {id:id}
  };
  LiveLinkCloseEntityMessage = pc.inherits(LiveLinkCloseEntityMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("CLOSE_ENTITY");
  return{LiveLinkCloseEntityMessage:LiveLinkCloseEntityMessage}
}());
pc.extend(pc, function() {
  var LiveLinkOpenEntityMessage = function(entity) {
    this.type = pc.LiveLinkMessageType.OPEN_ENTITY;
    this.content = {entity:entity}
  };
  LiveLinkOpenEntityMessage = pc.inherits(LiveLinkOpenEntityMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("OPEN_ENTITY");
  var LiveLinkOpenPackMessage = function(hierarchy, pack) {
    this.type = pc.LiveLinkMessageType.OPEN_PACK;
    this.content = {pack:pc.extend({}, pack.getData())};
    this.content.pack.hierarchy = PCD.model.Entity.toData(hierarchy)
  };
  LiveLinkOpenPackMessage = pc.inherits(LiveLinkOpenPackMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("OPEN_PACK");
  return{LiveLinkOpenEntityMessage:LiveLinkOpenEntityMessage, LiveLinkOpenPackMessage:LiveLinkOpenPackMessage}
}());
pc.extend(pc, function() {
  var LiveLinkUpdateAssetMessage = function(id, attribute, value) {
    this.type = pc.LiveLinkMessageType.UPDATE_ASSET;
    this.content = {id:id, attribute:attribute, value:value}
  };
  LiveLinkUpdateAssetMessage = pc.inherits(LiveLinkUpdateAssetMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_ASSET");
  return{LiveLinkUpdateAssetMessage:LiveLinkUpdateAssetMessage}
}());
pc.extend(pc, function() {
  var LiveLinkUpdatePackSettings = function(settings) {
    this.type = pc.LiveLinkMessageType.UPDATE_PACK_SETTINGS;
    this.content = {settings:settings}
  };
  LiveLinkUpdatePackSettings = pc.inherits(LiveLinkUpdatePackSettings, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_PACK_SETTINGS");
  return{LiveLinkUpdatePackSettings:LiveLinkUpdatePackSettings}
}());
pc.extend(pc, function() {
  var LiveLinkUpdateAssetCacheMessage = function(assets, deletedAssets) {
    this.type = pc.LiveLinkMessageType.UPDATE_ASSETCACHE;
    this.content = {assets:assets, deleted:deletedAssets}
  };
  LiveLinkUpdateAssetCacheMessage = pc.inherits(LiveLinkUpdateAssetCacheMessage, pc.LiveLinkMessage);
  pc.LiveLinkMessage.register("UPDATE_ASSETCACHE");
  return{LiveLinkUpdateAssetCacheMessage:LiveLinkUpdateAssetCacheMessage}
}());
pc.extend(pc, function() {
  var Entity = function(app) {
    this._guid = pc.guid.create();
    this._batchHandle = null;
    this.c = {};
    this._app = app;
    if(!app) {
      this._app = pc.Application.getApplication();
      if(!this._app) {
        console.error("Couldn't find current application")
      }
    }
    pc.events.attach(this)
  };
  Entity = pc.inherits(Entity, pc.GraphNode);
  Entity.prototype.addComponent = function(type, data) {
    var system = this._app.systems[type];
    if(system) {
      if(!this.c[type]) {
        return system.addComponent(this, data)
      }else {
        logERROR(pc.string.format("Entity already has {0} Component", type))
      }
    }else {
      logERROR(pc.string.format("System: '{0}' doesn't exist", type));
      return null
    }
  };
  Entity.prototype.removeComponent = function(type) {
    var system = this._app.systems[type];
    if(system) {
      if(this.c[type]) {
        system.removeComponent(this)
      }else {
        logERROR(pc.string.format("Entity doesn't have {0} Component", type))
      }
    }else {
      logERROR(pc.string.format("System: '{0}' doesn't exist", type))
    }
  };
  Entity.prototype.getGuid = function() {
    return this._guid
  };
  Entity.prototype.setGuid = function(guid) {
    this._guid = guid
  };
  Entity.prototype._onHierarchyStateChanged = function(enabled) {
    pc.Entity._super._onHierarchyStateChanged.call(this, enabled);
    var component;
    var components = this.c;
    for(type in components) {
      if(components.hasOwnProperty(type)) {
        component = components[type];
        if(component.enabled) {
          if(enabled) {
            component.onEnable()
          }else {
            component.onDisable()
          }
        }
      }
    }
  };
  Entity.prototype.setRequest = function(request) {
    this._request = request
  };
  Entity.prototype.getRequest = function() {
    return this._request
  };
  Entity.prototype.addChild = function(child) {
    if(child instanceof pc.Entity) {
      var _debug = true;
      if(_debug) {
        var root = this.getRoot();
        var dupe = root.findOne("getGuid", child.getGuid());
        if(dupe) {
          throw new Error("GUID already exists in graph");
        }
      }
    }
    pc.GraphNode.prototype.addChild.call(this, child)
  };
  Entity.prototype.findByGuid = function(guid) {
    if(this._guid === guid) {
      return this
    }
    for(var i = 0;i < this._children.length;i++) {
      if(this._children[i].findByGuid) {
        var found = this._children[i].findByGuid(guid);
        if(found !== null) {
          return found
        }
      }
    }
    return null
  };
  Entity.prototype.destroy = function() {
    var parent = this.getParent();
    var childGuids;
    for(var name in this.c) {
      this.c[name].enabled = false
    }
    for(var name in this.c) {
      this.c[name].system.removeComponent(this)
    }
    if(parent) {
      parent.removeChild(this)
    }
    var children = this.getChildren();
    var length = children.length;
    var child = children.shift();
    while(child) {
      if(child instanceof pc.Entity) {
        child.destroy()
      }
      child = children.shift()
    }
  };
  Entity.prototype.clone = function() {
    var type;
    var c = new pc.Entity(this._app);
    pc.Entity._super._cloneInternal.call(this, c);
    for(type in this.c) {
      var component = this.c[type];
      component.system.cloneComponent(this, c)
    }
    var i;
    for(i = 0;i < this.getChildren().length;i++) {
      var child = this.getChildren()[i];
      if(child instanceof pc.Entity) {
        c.addChild(child.clone())
      }
    }
    return c
  };
  Entity.deserialize = function(data) {
    var template = pc.json.parse(data.template);
    var parent = pc.json.parse(data.parent);
    var children = pc.json.parse(data.children);
    var transform = pc.json.parse(data.transform);
    var components = pc.json.parse(data.components);
    var labels = pc.json.parse(data.labels);
    var model = {_id:data._id, resource_id:data.resource_id, _rev:data._rev, name:data.name, enabled:data.enabled, labels:labels, template:template, parent:parent, children:children, transform:transform, components:components};
    return model
  };
  Entity.serialize = function(model) {
    var data = {_id:model._id, resource_id:model.resource_id, name:model.name, enabled:model.enabled, labels:pc.json.stringify(model.labels), template:pc.json.stringify(model.template), parent:pc.json.stringify(model.parent), children:pc.json.stringify(model.children), transform:pc.json.stringify(model.transform), components:pc.json.stringify(model.components)};
    if(model._rev) {
      data._rev = model._rev
    }
    return data
  };
  return{Entity:Entity}
}());
pc.resources = {};
pc.extend(pc.resources, function() {
  var ResourceLoader = function() {
    if(window.RSVP === undefined) {
      logERROR("Missing RSVP library")
    }
    this._types = {};
    this._handlers = {};
    this._requests = {};
    this._cache = {};
    this._hashes = {};
    this._canonicals = {};
    this._requested = 0;
    this._loaded = 0;
    this._sequence = 0;
    this.cache = true;
    pc.events.attach(this)
  };
  ResourceLoader.prototype = {createFileRequest:function(identifier, type) {
    return new this._types[type](identifier)
  }, registerHandler:function(RequestType, handler) {
    var request = new RequestType;
    if(request.type === "") {
      throw Error("ResourceRequests must have a type");
    }
    this._types[request.type] = RequestType;
    this._handlers[request.type] = handler;
    handler.setLoader(this)
  }, request:function(requests, options) {
    options = options || {};
    var self = this;
    var parent = options.parent;
    options.cache = self.cache;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var i, n;
      var p;
      if(requests.length === undefined) {
        requests = [requests]
      }
      var requested = [];
      var promises = [];
      for(i = 0, n = requests.length;i < n;i++) {
        var request = self._findExistingRequest(requests[i]);
        if(request !== requests[i]) {
          request.data = requests[i].data
        }
        self._makeCanonical(request);
        promises.push(self._request(request, options));
        requested.push(request);
        if(parent) {
          parent.children.push(request)
        }
      }
      var check = function(resources, requests, promises) {
        var i, n;
        var childPromises = [];
        var childRequests = [];
        requests.forEach(function(r) {
          r.children.forEach(function(c) {
            childRequests.push(c);
            childPromises.push.apply(childPromises, c.promises)
          })
        });
        if(childPromises.length) {
          pc.promise.all(childPromises).then(function(childResources) {
            check(resources, childRequests, childPromises)
          }, function(error) {
            reject(error)
          })
        }else {
          self.fire("complete", resources);
          resolve(resources)
        }
      };
      pc.promise.all(promises).then(function(resources) {
        check(resources, requested, promises)
      }, function(error) {
        reject(error)
      })
    });
    return promise
  }, open:function(RequestType, data, options) {
    var request = new RequestType;
    return this._handlers[request.type].open(data, request, options)
  }, registerHash:function(hash, identifier) {
    if(!this._hashes[identifier]) {
      this._hashes[identifier] = hash
    }
    if(!this._canonicals[hash]) {
      this._canonicals[hash] = identifier
    }
  }, unregisterHash:function(identifier) {
    var hash = this.getHash(identifier);
    if(hash) {
      delete this._canonicals[hash];
      delete this._hashes[identifier]
    }
  }, getHash:function(identifier) {
    return this._hashes[identifier]
  }, addToCache:function(identifier, resource) {
    var hash = this.getHash(identifier);
    if(hash) {
      this._cache[hash] = resource
    }else {
    }
  }, getFromCache:function(identifier) {
    var hash = this.getHash(identifier);
    if(hash) {
      return this._cache[hash]
    }else {
      return null
    }
  }, removeFromCache:function(identifier) {
    var hash = this.getHash(identifier);
    if(hash) {
      delete this._cache[hash]
    }else {
      return null
    }
  }, resetProgress:function() {
    this._requested = 0;
    this._loaded = 0
  }, _request:function(request, _options) {
    var self = this;
    var promise = null;
    var options = {};
    for(key in _options) {
      options[key] = _options[key]
    }
    if(request.id === null) {
      request.id = this._sequence++
    }
    this.fire("request", request);
    if(request.promises.length) {
      request.promises.push(new pc.promise.Promise(function(resolve, reject) {
        request.promises[0].then(function(resource) {
          var resource = self._postOpen(resource, request);
          resolve(resource)
        })
      }))
    }else {
      request.promises[0] = new pc.promise.Promise(function(resolve, reject) {
        var handler = self._handlers[request.type];
        if(!handler) {
          var msg = "Missing handler for type: " + request.type;
          self.fire("error", request, msg);
          reject(msg);
          return
        }
        var resource = self.getFromCache(request.canonical);
        if(resource && (request.Type === undefined || resource instanceof request.Type)) {
          resource = self._postOpen(resource, request);
          resolve(resource)
        }else {
          var promise = handler.load(request, options);
          promise.then(function(data) {
            try {
              var resource = self._open(data, request, options);
              if(resource) {
                resource = self._postOpen(resource, request)
              }
              resolve(resource)
            }catch(e) {
              reject(e)
            }
          }, function(error) {
            self.fire("error", request, error);
            reject(error)
          })
        }
      })
    }
    self._requests[request.canonical] = request;
    this._requested++;
    return request.promises[request.promises.length - 1]
  }, _open:function(data, request, options) {
    return this._handlers[request.type].open(data, request, options)
  }, _postOpen:function(resource, request) {
    this.addToCache(request.canonical, resource);
    resource = this._handlers[request.type].clone(resource, request);
    delete this._requests[request.canonical];
    this._loaded++;
    this.fire("progress", this._loaded / this._requested);
    this.fire("load", request, resource);
    return resource
  }, _makeCanonical:function(request) {
    var hash = this.getHash(request.identifier);
    if(hash && this._canonicals[hash]) {
      request.canonical = this._canonicals[hash]
    }else {
      request.canonical = request.identifier
    }
  }, _findExistingRequest:function(request) {
    var existing = this._requests[request.canonical];
    if(existing) {
      if(existing.type !== request.type || existing.result || request.result) {
        return request
      }else {
        return existing
      }
    }else {
      return request
    }
  }};
  var ResourceRequest = function ResourceRequest(identifier, data, result) {
    this.id = null;
    this.canonical = identifier;
    this.alternatives = [];
    this.promises = [];
    this.children = [];
    this.data = data;
    this.result = result;
    this.identifier = identifier
  };
  var ResourceHandler = function() {
  };
  ResourceHandler.prototype = {setLoader:function(loader) {
    this._loader = loader
  }, load:function(request, options) {
    throw Error("Not implemented");
  }, open:function(data, options) {
    throw Error("Not implemented");
  }, clone:function(resource) {
    return resource
  }};
  return{ResourceLoader:ResourceLoader, ResourceHandler:ResourceHandler, ResourceRequest:ResourceRequest}
}());
pc.extend(pc.resources, function() {
  var count = 0;
  var ResourceLoaderDisplay = function(element, loader) {
    loader.on("request", this.handleRequest, this);
    loader.on("load", this.handleLoad, this);
    loader.on("error", this.handleError, this);
    loader.on("progress", this.handleProgress, this);
    this.addCss();
    this._element = element;
    this._domCreate()
  };
  ResourceLoaderDisplay.prototype = {addCss:function() {
    var styles = [".pc-resourceloaderdisplay-root {", "   font-family: sans-serif;", "   font-size: 0.7em;", "   color: #aaa;", "   border-collapse: collapse;", "   position: absolute;", "   top: 10px;", "   left: 10px;", "   background-color: black;", "   opacity: 0.6;", "}", ".pc-resourceloaderdisplay-root td {", "   border: 1px solid #aaa;", "}", ".pc-resourceloaderdisplay-subtable {", "   border-collapse: collapse;", "}"].join("\n");
    var style = document.createElement("style");
    document.getElementsByTagName("head")[0].appendChild(style);
    if(style.styleSheet) {
      style.styleSheet.cssText = styles
    }else {
      var cssText = document.createTextNode(styles);
      style.appendChild(cssText)
    }
  }, handleRequest:function(request) {
    console.warn("request: " + request.id);
    this._domAddRequest(request)
  }, handleLoad:function(request, resource) {
    console.warn("load: " + request.id);
    var id = "pc-resourcesloaderdisplay-progress-" + request.id;
    var el = document.getElementsByClassName(id);
    if(el) {
      for(var i = 0;i < el.length;i++) {
        el[i].textContent = "100%"
      }
    }
  }, handleError:function(request, error) {
    var id = "pc-resourcesloaderdisplay-progress-" + request.id;
    var el = document.getElementsByClassName(id);
    if(el) {
      for(var i = 0;i < el.length;i++) {
        el[i].textContent = error
      }
    }
  }, handleProgress:function(value) {
  }, _domCreate:function() {
    this._rootTable = document.createElement("table");
    this._rootTable.setAttribute("class", "pc-resourceloaderdisplay-root");
    this._element.appendChild(this._rootTable)
  }, _domAddRequest:function(request) {
    var id = "pc-resourcesloaderdisplay-progress-" + request.id;
    var row = document.createElement("tr");
    var titleEl = document.createElement("td");
    titleEl.textContent = request.identifier;
    var progressEl = document.createElement("td");
    progressEl.className = id;
    progressEl.textContent = "0%";
    row.appendChild(titleEl);
    row.appendChild(progressEl);
    this._rootTable.appendChild(row)
  }, _sanitizeId:function(id) {
    return id.replace(/\//, "").replace(/\./, "")
  }};
  return{ResourceLoaderDisplay:ResourceLoaderDisplay}
}());
pc.extend(pc.resources, function() {
  var TextureCache = function(loader) {
    this.cache = {};
    this.loader = loader
  };
  TextureCache.prototype = {getTexture:function(url) {
    var hash = this.loader.getHash(url);
    if(hash && this.cache[hash]) {
      return this.cache[hash]
    }
    return null
  }, addTexture:function(url, texture) {
    var hash = this.loader.getHash(url);
    if(hash) {
      this.cache[hash] = texture
    }
  }};
  return{TextureCache:TextureCache}
}());
pc.extend(pc.resources, function() {
  var JsonResourceHandler = function() {
  };
  JsonResourceHandler = pc.inherits(JsonResourceHandler, pc.resources.ResourceHandler);
  JsonResourceHandler.prototype.load = function(request, options) {
    var self = this;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      pc.net.http.get(request.canonical, function(response) {
        resolve(response)
      }, {error:function() {
        reject()
      }})
    });
    return promise
  };
  JsonResourceHandler.prototype.open = function(data, request, options) {
    return data
  };
  var JsonRequest = function JsonRequest(identifier) {
  };
  JsonRequest = pc.inherits(JsonRequest, pc.resources.ResourceRequest);
  JsonRequest.prototype.type = "json";
  JsonRequest.prototype.Type = Object;
  return{JsonResourceHandler:JsonResourceHandler, JsonRequest:JsonRequest}
}());
pc.extend(pc.resources, function() {
  var TextResourceHandler = function() {
  };
  TextResourceHandler = pc.inherits(TextResourceHandler, pc.resources.ResourceHandler);
  TextResourceHandler.prototype.load = function(request, options) {
    var self = this;
    var promise = new RSVP.Promise(function(resolve, reject) {
      pc.net.http.get(request.canonical, function(response) {
        resolve(response)
      }, {error:function() {
        reject()
      }})
    });
    return promise
  };
  TextResourceHandler.prototype.open = function(data, request, options) {
    return data
  };
  var TextRequest = function TextRequest(identifier) {
  };
  TextRequest = pc.inherits(TextRequest, pc.resources.ResourceRequest);
  TextRequest.prototype.type = "text";
  TextRequest.prototype.Type = Object;
  return{TextResourceHandler:TextResourceHandler, TextRequest:TextRequest}
}());
pc.extend(pc.resources, function() {
  var ImageResourceHandler = function() {
  };
  ImageResourceHandler = pc.inherits(ImageResourceHandler, pc.resources.ResourceHandler);
  ImageResourceHandler.prototype.load = function(request, options) {
    var self = this;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var image = new Image;
      image.onload = function() {
        resolve(image)
      };
      image.onerror = function(event) {
        var element = event.srcElement;
        reject(pc.string.format("Error loading Image from: '{0}'", element.src))
      };
      image.src = request.canonical
    });
    return promise
  };
  ImageResourceHandler.prototype.open = function(data, request, options) {
    return data
  };
  var ImageRequest = function ImageRequest(identifier) {
  };
  ImageRequest = pc.inherits(ImageRequest, pc.resources.ResourceRequest);
  ImageRequest.prototype.type = "image";
  ImageRequest.prototype.Type = Image;
  return{ImageResourceHandler:ImageResourceHandler, ImageRequest:ImageRequest}
}());
pc.extend(pc.resources, function() {
  var jsonToAddressMode = {"repeat":pc.ADDRESS_REPEAT, "clamp":pc.ADDRESS_CLAMP_TO_EDGE, "mirror":pc.ADDRESS_MIRRORED_REPEAT};
  var jsonToFilterMode = {"nearest":pc.FILTER_NEAREST, "linear":pc.FILTER_LINEAR, "nearest_mip_nearest":pc.FILTER_NEAREST_MIPMAP_NEAREST, "linear_mip_nearest":pc.FILTER_LINEAR_MIPMAP_NEAREST, "nearest_mip_linear":pc.FILTER_NEAREST_MIPMAP_LINEAR, "linear_mip_linear":pc.FILTER_LINEAR_MIPMAP_LINEAR};
  function arrayBufferCopy(src, dst, dstByteOffset, numBytes) {
    dst32Offset = dstByteOffset / 4;
    var tail = numBytes % 4;
    var src32 = new Uint32Array(src.buffer, 0, (numBytes - tail) / 4);
    var dst32 = new Uint32Array(dst.buffer);
    for(var i = 0;i < src32.length;i++) {
      dst32[dst32Offset + i] = src32[i]
    }
    for(var i = numBytes - tail;i < numBytes;i++) {
      dst[dstByteOffset + i] = src[i]
    }
  }
  var TextureResourceHandler = function(device, assets) {
    this._device = device;
    this._assets = assets;
    this.crossOrigin = undefined
  };
  TextureResourceHandler = pc.inherits(TextureResourceHandler, pc.resources.ResourceHandler);
  TextureResourceHandler.prototype.load = function(request, options) {
    var identifier = request.canonical;
    var self = this;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var ext = pc.path.getExtension(identifier).toLowerCase();
      if(ext === ".dds" || ext === ".crn") {
        options = options || {};
        options.binary = true;
        options.directory = pc.path.getDirectory(identifier);
        options.crn = ext === ".crn";
        pc.net.http.get(identifier, function(response) {
          resolve(response)
        }, {cache:true, responseType:"arraybuffer"})
      }else {
        if(ext === ".jpg" || ext === ".jpeg" || ext === ".gif" || ext === ".png") {
          var image = new Image;
          if(self.crossOrigin !== undefined) {
            image.crossOrigin = self.crossOrigin
          }
          image.onload = function() {
            resolve(image)
          };
          image.onerror = function(event) {
            var element = event.srcElement;
            reject(pc.string.format("Error loading Texture from: '{0}'", element.src))
          };
          var asset = self._assets.getAssetByUrl(request.canonical);
          if(asset && asset.file) {
            identifier += "?t=" + asset.file.hash
          }
          image.src = identifier
        }
      }
    });
    return promise
  };
  TextureResourceHandler.prototype.open = function(data, request, options) {
    var self = this;
    var texture;
    if(data instanceof Image || data instanceof HTMLImageElement) {
      var img = data;
      if(request.result) {
        texture = request.result
      }else {
        format = pc.string.endsWith(img.src.toLowerCase(), ".jpg") ? pc.PIXELFORMAT_R8_G8_B8 : pc.PIXELFORMAT_R8_G8_B8_A8;
        texture = new pc.Texture(this._device, {width:img.width, height:img.height, format:format});
        var asset = self._assets.getAssetByUrl(request.canonical);
        if(asset && asset.data) {
          var updateTexture = function(data) {
            if(data.name !== undefined) {
              texture.name = data.name
            }
            if(data.addressu !== undefined) {
              texture.addressU = jsonToAddressMode[data.addressu]
            }
            if(data.addressV !== undefined) {
              texture.addressV = jsonToAddressMode[data.addressV]
            }
            if(data.magfilter !== undefined) {
              texture.magFilter = jsonToFilterMode[data.magfilter]
            }
            if(data.minfilter !== undefined) {
              texture.minfilter = jsonToFilterMode[data.minfilter]
            }
            if(data.anisotropy !== undefined) {
              texture.anisotropy = data.anisotropy
            }
          };
          updateTexture(asset.data);
          asset.on("change", function(asset, attribute, value) {
            if(attribute === "data") {
              updateTexture(value)
            }
          }, this)
        }
      }
      texture.setSource(img)
    }else {
      if(data instanceof ArrayBuffer) {
        if(options.crn) {
          var srcSize = data.byteLength;
          var bytes = new Uint8Array(data);
          var src = Module._malloc(srcSize);
          arrayBufferCopy(bytes, Module.HEAPU8, src, srcSize);
          var dst = Module._crn_decompress_get_data(src, srcSize);
          var dstSize = Module._crn_decompress_get_size(src, srcSize);
          data = Module.HEAPU8.buffer.slice(dst, dst + dstSize)
        }
        var header = new Uint32Array(data, 0, 128 / 4);
        var width = header[4];
        var height = header[3];
        var mips = Math.max(header[7], 1);
        var isFourCc = header[20] === 4;
        var fcc = header[21];
        var bpp = header[22];
        var isCubemap = header[28] === 65024;
        var FCC_DXT1 = 827611204;
        var FCC_DXT5 = 894720068;
        var FCC_FP32 = 116;
        var format = null;
        var compressed = false;
        var floating = false;
        if(isFourCc) {
          if(fcc === FCC_DXT1) {
            format = pc.PIXELFORMAT_DXT1;
            compressed = true
          }else {
            if(fcc === FCC_DXT5) {
              format = pc.PIXELFORMAT_DXT5;
              compressed = true
            }else {
              if(fcc === FCC_FP32) {
                format = pc.PIXELFORMAT_RGBA32F;
                floating = true
              }
            }
          }
        }else {
          if(bpp === 32) {
            format = pc.PIXELFORMAT_R8_G8_B8_A8
          }
        }
        var requiredMips = Math.round(Math.log2(Math.max(width, height)) + 1);
        var cantLoad = !format || mips !== requiredMips && compressed;
        if(cantLoad) {
          var errEnd = ". Empty texture will be created instead.";
          if(!format) {
            console.error("This DDS pixel format is currently unsupported" + errEnd)
          }else {
            console.error("DDS has " + mips + " mips, but engine requires " + requiredMips + " for DXT format. " + errEnd)
          }
          texture = new pc.Texture(this._device, {width:4, height:4, format:pc.PIXELFORMAT_R8_G8_B8});
          return texture
        }
        var texOptions = {width:width, height:height, format:format, cubemap:isCubemap};
        texture = new pc.Texture(this._device, texOptions);
        var offset = 128;
        var faces = isCubemap ? 6 : 1;
        var mipSize;
        var DXT_BLOCK_WIDTH = 4;
        var DXT_BLOCK_HEIGHT = 4;
        var blockSize = fcc === FCC_DXT1 ? 8 : 16;
        var numBlocksAcross, numBlocksDown;
        for(var face = 0;face < faces;face++) {
          var mipWidth = width;
          var mipHeight = height;
          for(var i = 0;i < mips;i++) {
            if(compressed) {
              numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
              numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
              numBlocks = numBlocksAcross * numBlocksDown;
              mipSize = numBlocks * blockSize
            }else {
              mipSize = mipWidth * mipHeight * 4
            }
            var mipBuff = floating ? new Float32Array(data, offset, mipSize) : new Uint8Array(data, offset, mipSize);
            if(!isCubemap) {
              texture._levels[i] = mipBuff
            }else {
              if(!texture._levels[i]) {
                texture._levels[i] = []
              }
              texture._levels[i][face] = mipBuff
            }
            offset += floating ? mipSize * 4 : mipSize;
            mipWidth = Math.max(mipWidth * 0.5, 1);
            mipHeight = Math.max(mipHeight * 0.5, 1)
          }
        }
        texture.upload()
      }
    }
    return texture
  };
  var TextureRequest = function TextureRequest(identifier) {
  };
  TextureRequest = pc.inherits(TextureRequest, pc.resources.ResourceRequest);
  TextureRequest.prototype.type = "texture";
  TextureRequest.prototype.Type = pc.Texture;
  return{TextureResourceHandler:TextureResourceHandler, TextureRequest:TextureRequest}
}());
pc.extend(pc.resources, function() {
  function onTextureAssetChanged(asset, attribute, newValue, oldValue) {
    if(attribute !== "resource") {
      return
    }
    var cubemap = this;
    var sources = cubemap.getSource();
    var dirty = false;
    if(oldValue) {
      var oldImage = oldValue.getSource();
      for(var i = 0;i < sources.length;i++) {
        if(sources[i] === oldImage) {
          sources[i] = newValue.getSource();
          dirty = true
        }
      }
    }
    if(dirty) {
      cubemap.setSource(sources)
    }else {
      asset.off("change", onTextureAssetChanged, cubemap)
    }
  }
  var CubemapResourceHandler = function(device, assets, loader) {
    this._device = device;
    this._assets = assets
  };
  CubemapResourceHandler = pc.inherits(CubemapResourceHandler, pc.resources.ResourceHandler);
  CubemapResourceHandler.prototype.load = function(request, options) {
    var promise = null;
    if(pc.string.startsWith(request.canonical, "asset://")) {
      promise = new pc.promise.Promise(function(resolve, reject) {
        var asset = this._getAssetFromRequest(request);
        if(!asset) {
          reject(pc.string.format("Can't load cubemap, asset {0} not found", request.canonical))
        }
        this._loadCubemapImages(null, asset.data).then(function(images) {
          var data = pc.extend({}, asset.data);
          data.images = images;
          resolve(data)
        }, function(error) {
          reject(error)
        })
      }.bind(this))
    }else {
      promise = new pc.promise.Promise(function(resolve, reject) {
        pc.net.http.get(request.canonical, function(response) {
          var data = pc.extend({}, response);
          var textures = response.textures;
          if(textures.length) {
            var assets = [];
            textures.forEach(function(path) {
              var filename = pc.path.getBasename(path);
              var url = pc.path.join(pc.path.split(request.canonical)[0], path);
              assets.push(new pc.asset.Asset(filename, "texture", {url:url}))
            });
            this._assets.load(assets).then(function(responses) {
              data.images = responses.map(function(texture) {
                return texture.getSource()
              });
              resolve(data)
            }, function(error) {
              reject(error)
            })
          }else {
            resolve(data)
          }
        }.bind(this), {error:function() {
          reject()
        }})
      }.bind(this))
    }
    return promise
  };
  CubemapResourceHandler.prototype.open = function(data, request, options) {
    var cubemap = null;
    if(request.result) {
      cubemap = request.result
    }else {
      cubemap = new pc.Texture(this._device, {format:pc.PIXELFORMAT_R8_G8_B8, cubemap:true})
    }
    var images = data.images;
    delete data.images;
    this._updateCubemapData(cubemap, data, images);
    var asset = this._getAssetFromRequest(request);
    asset.on("change", function(asset, attribute, value) {
      if(attribute === "data") {
        this._loadCubemapImages(cubemap, value).then(function(images) {
          this._updateCubemapData(cubemap, value, images)
        }.bind(this))
      }
    }, this);
    return cubemap
  };
  CubemapResourceHandler.prototype._areValidImages = function(images) {
    var result = images && images.length === 6;
    var error;
    if(result) {
      var width = images[0] ? images[0].width : null;
      var height = images[0] ? images[0].height : null;
      for(var i = 0;i < 6;i++) {
        if(!images[i]) {
          result = false;
          break
        }
        if(!images[i] instanceof HTMLCanvasElement || !images[i] instanceof HTMLImageElement || !images[i] instanceof HTMLVideoElement) {
          error = "Cubemap source is not an instance of HTMLCanvasElement, HTMLImageElement or HTMLVideoElement.";
          result = false;
          break
        }
        if(images[i].width !== width || images[i].height !== height) {
          error = "Cubemap sources do not all share the same dimensions.";
          result = false;
          break
        }
      }
    }
    if(error) {
      alert(error)
    }
    return result
  };
  CubemapResourceHandler.prototype._loadCubemapImages = function(cubemap, data) {
    var self = this;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      if(data.textures) {
        var assets = [];
        for(var i = 0;i < 6;i++) {
          if(data.textures[i]) {
            var asset = self._assets.getAssetById(data.textures[i]);
            if(asset) {
              assets.push(asset)
            }else {
              reject(pc.string.format("Could not load cubemap - Texture {0} not found", data.textures[i]));
              return
            }
          }else {
            resolve(null);
            return
          }
        }
        self._assets.load(assets).then(function(textures) {
          resolve(textures.map(function(texture) {
            return texture.getSource()
          }))
        }, function(error) {
          reject(error)
        })
      }else {
        resolve(null)
      }
    });
    return promise
  };
  CubemapResourceHandler.prototype._updateCubemapData = function(cubemap, data, images) {
    if(cubemap.name !== data.name) {
      cubemap.name = data.name
    }
    if(cubemap.minFilter !== data.minFilter) {
      cubemap.minFilter = data.minFilter
    }
    if(cubemap.magFilter !== data.magFilter) {
      cubemap.magFilter = data.magFilter
    }
    if(cubemap.addressU !== pc.ADDRESS_CLAMP_TO_EDGE) {
      cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE
    }
    if(cubemap.addressV !== pc.ADDRESS_CLAMP_TO_EDGE) {
      cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE
    }
    if(cubemap.anisotropy !== data.anisotropy) {
      cubemap.anisotropy = data.anisotropy
    }
    if(this._areValidImages(images)) {
      cubemap.setSource(images)
    }
    var textures = {};
    if(data.textures) {
      for(var i = 0;i < 6;i++) {
        if(data.textures[i]) {
          var asset = this._assets.getAssetById(data.textures[i]);
          if(asset) {
            textures[asset.id] = asset
          }
        }
      }
    }
    for(var id in textures) {
      textures[id].off("change", onTextureAssetChanged, cubemap);
      textures[id].on("change", onTextureAssetChanged, cubemap)
    }
  };
  CubemapResourceHandler.prototype._getAssetFromRequest = function(request) {
    if(pc.string.startsWith(request.canonical, "asset://")) {
      return this._assets.getAssetById(parseInt(request.canonical.slice(8)))
    }else {
      return this._assets.getAssetByUrl(request.canonical)
    }
  };
  var CubemapRequest = function(identifier) {
  };
  CubemapRequest = pc.inherits(CubemapRequest, pc.resources.ResourceRequest);
  CubemapRequest.prototype.type = "cubemap";
  CubemapRequest.prototype.Type = pc.Texture;
  return{CubemapResourceHandler:CubemapResourceHandler, CubemapRequest:CubemapRequest}
}());
pc.extend(pc.resources, function() {
  var jsonToPrimitiveType = {"points":pc.PRIMITIVE_POINTS, "lines":pc.PRIMITIVE_LINES, "lineloop":pc.PRIMITIVE_LINELOOP, "linestrip":pc.PRIMITIVE_LINESTRIP, "triangles":pc.PRIMITIVE_TRIANGLES, "trianglestrip":pc.PRIMITIVE_TRISTRIP, "trianglefan":pc.PRIMITIVE_TRIFAN};
  var jsonToVertexElementType = {"int8":pc.ELEMENTTYPE_INT8, "uint8":pc.ELEMENTTYPE_UINT8, "int16":pc.ELEMENTTYPE_INT16, "uint16":pc.ELEMENTTYPE_UINT16, "int32":pc.ELEMENTTYPE_INT32, "uint32":pc.ELEMENTTYPE_UINT32, "float32":pc.ELEMENTTYPE_FLOAT32};
  var jsonToLightType = {"directional":pc.LIGHTTYPE_DIRECTIONAL, "point":pc.LIGHTTYPE_POINT, "spot":pc.LIGHTTYPE_SPOT};
  var jsonToProjectionType = {"perspective":pc.PROJECTION_PERSPECTIVE, "orthographic":pc.PROJECTION_ORTHOGRAPHIC};
  var ModelResourceHandler = function(device, assetRegistry) {
    this._device = device;
    this._assets = assetRegistry
  };
  ModelResourceHandler = pc.inherits(ModelResourceHandler, pc.resources.ResourceHandler);
  ModelResourceHandler.prototype.load = function(request, options) {
    var self = this;
    if(request.data) {
      var asset;
      var materials = [];
      var mapping = request.data;
      for(var i = 0;i < mapping.length;i++) {
        if(mapping[i].material) {
          asset = this._assets.getAssetById(mapping[i].material);
          if(asset) {
            materials.push(asset)
          }
        }
      }
    }
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var url = request.canonical;
      options = options || {};
      options.directory = pc.path.getDirectory(url);
      pc.net.http.get(url, function(response) {
        if(materials.length) {
          self._assets.load(materials).then(function() {
            resolve(response)
          })
        }else {
          resolve(response)
        }
      }, {cache:options.cache, error:function(status, xhr, e) {
        reject(pc.string.format("Error loading model: {0} [{1}]", url, status))
      }})
    });
    return promise
  };
  ModelResourceHandler.prototype.open = function(data, request, options) {
    options = options || {};
    options.directory = options.directory || "";
    options.parent = request;
    var model = null;
    if(data.model.version <= 1) {
      logERROR(pc.string.format("Asset: {0}, is an old model format. Upload source assets to re-import.", request.canonical))
    }else {
      if(data.model.version >= 2) {
        model = this._loadModelJson(data, request.data, options)
      }
    }
    return model
  };
  ModelResourceHandler.prototype.clone = function(model) {
    return model.clone()
  };
  ModelResourceHandler.prototype._loadModelJson = function(data, mapping, options) {
    var modelData = data.model;
    var i, j;
    var nodes = [];
    for(i = 0;i < modelData.nodes.length;i++) {
      var nodeData = modelData.nodes[i];
      var node = new pc.GraphNode;
      node.setName(nodeData.name);
      node.setLocalPosition(nodeData.position[0], nodeData.position[1], nodeData.position[2]);
      node.setLocalEulerAngles(nodeData.rotation[0], nodeData.rotation[1], nodeData.rotation[2]);
      node.setLocalScale(nodeData.scale[0], nodeData.scale[1], nodeData.scale[2]);
      nodes.push(node)
    }
    for(i = 1;i < modelData.parents.length;i++) {
      nodes[modelData.parents[i]].addChild(nodes[i])
    }
    if(!this._device.supportsBoneTextures && modelData.skins.length > 0) {
      var boneLimit = this._device.getBoneLimit();
      pc.partitionSkin(modelData, mapping, boneLimit)
    }
    var skins = [];
    var skinInstances = [];
    for(i = 0;i < modelData.skins.length;i++) {
      var skinData = modelData.skins[i];
      var inverseBindMatrices = [];
      for(j = 0;j < skinData.inverseBindMatrices.length;j++) {
        var ibm = skinData.inverseBindMatrices[j];
        inverseBindMatrices[j] = new pc.Mat4(ibm[0], ibm[1], ibm[2], ibm[3], ibm[4], ibm[5], ibm[6], ibm[7], ibm[8], ibm[9], ibm[10], ibm[11], ibm[12], ibm[13], ibm[14], ibm[15])
      }
      var skin = new pc.Skin(this._device, inverseBindMatrices, skinData.boneNames);
      skins.push(skin);
      var skinInstance = new pc.SkinInstance(skin);
      var bones = [];
      for(j = 0;j < skin.boneNames.length;j++) {
        var boneName = skin.boneNames[j];
        var bone = nodes[0].findByName(boneName);
        bones.push(bone)
      }
      skinInstance.bones = bones;
      skinInstances.push(skinInstance)
    }
    var vertexBuffers = [];
    var attribute, attributeName;
    var attributeMap = {position:pc.SEMANTIC_POSITION, normal:pc.SEMANTIC_NORMAL, tangent:pc.SEMANTIC_TANGENT, blendWeight:pc.SEMANTIC_BLENDWEIGHT, blendIndices:pc.SEMANTIC_BLENDINDICES, color:pc.SEMANTIC_COLOR, texCoord0:pc.SEMANTIC_TEXCOORD0, texCoord1:pc.SEMANTIC_TEXCOORD1, texCoord2:pc.SEMANTIC_TEXCOORD2, texCoord3:pc.SEMANTIC_TEXCOORD3, texCoord4:pc.SEMANTIC_TEXCOORD4, texCoord5:pc.SEMANTIC_TEXCOORD5, texCoord6:pc.SEMANTIC_TEXCOORD6, texCoord7:pc.SEMANTIC_TEXCOORD7};
    for(i = 0;i < modelData.vertices.length;i++) {
      var vertexData = modelData.vertices[i];
      if(vertexData.position && vertexData.normal && vertexData.texCoord0) {
        var indices = [];
        for(j = 0;j < modelData.meshes.length;j++) {
          if(modelData.meshes[j].vertices === i) {
            indices = indices.concat(modelData.meshes[j].indices)
          }
        }
        tangents = pc.calculateTangents(vertexData.position.data, vertexData.normal.data, vertexData.texCoord0.data, indices);
        vertexData.tangent = {type:"float32", components:4, data:tangents}
      }
      var formatDesc = [];
      for(attributeName in vertexData) {
        attribute = vertexData[attributeName];
        var attribType = attribute.type;
        if(!this._device.supportsUnsignedByte) {
          if(attribType === "uint8") {
            attribType = "float32"
          }
          if(attribType === "int8") {
            attribType = "float32"
          }
        }
        formatDesc.push({semantic:attributeMap[attributeName], components:attribute.components, type:jsonToVertexElementType[attribType], normalize:false})
      }
      var vertexFormat = new pc.VertexFormat(this._device, formatDesc);
      var numVertices = vertexData.position.data.length / vertexData.position.components;
      var vertexBuffer = new pc.VertexBuffer(this._device, vertexFormat, numVertices);
      var iterator = new pc.VertexIterator(vertexBuffer);
      for(j = 0;j < numVertices;j++) {
        for(attributeName in vertexData) {
          attribute = vertexData[attributeName];
          switch(attribute.components) {
            case 1:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j]);
              break;
            case 2:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j * 2], attribute.data[j * 2 + 1]);
              break;
            case 3:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j * 3], attribute.data[j * 3 + 1], attribute.data[j * 3 + 2]);
              break;
            case 4:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j * 4], attribute.data[j * 4 + 1], attribute.data[j * 4 + 2], attribute.data[j * 4 + 3]);
              break
          }
        }
        iterator.next()
      }
      iterator.end();
      vertexBuffers.push(vertexBuffer)
    }
    var numIndices = 0;
    for(i = 0;i < modelData.meshes.length;i++) {
      var meshData = modelData.meshes[i];
      if(meshData.indices !== undefined) {
        numIndices += meshData.indices.length
      }
    }
    var indexBuffer = null;
    var indexData = null;
    var indexBase = 0;
    if(numIndices > 0) {
      indexBuffer = new pc.IndexBuffer(this._device, pc.INDEXFORMAT_UINT16, numIndices);
      indexData = new Uint16Array(indexBuffer.lock())
    }
    var meshes = [];
    for(i = 0;i < modelData.meshes.length;i++) {
      var meshData = modelData.meshes[i];
      var min = meshData.aabb.min;
      var max = meshData.aabb.max;
      var aabb = new pc.shape.Aabb(new pc.Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5), new pc.Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5));
      var indexed = meshData.indices !== undefined;
      var mesh = new pc.Mesh;
      mesh.vertexBuffer = vertexBuffers[meshData.vertices];
      mesh.indexBuffer[0] = indexed ? indexBuffer : null;
      mesh.primitive[0].type = jsonToPrimitiveType[meshData.type];
      mesh.primitive[0].base = indexed ? meshData.base + indexBase : meshData.base;
      mesh.primitive[0].count = meshData.count;
      mesh.primitive[0].indexed = indexed;
      mesh.skin = meshData.skin !== undefined ? skins[meshData.skin] : null;
      mesh.aabb = aabb;
      if(indexed) {
        indexData.set(meshData.indices, indexBase);
        indexBase += meshData.indices.length
      }
      meshes.push(mesh)
    }
    if(numIndices > 0) {
      indexBuffer.unlock()
    }
    var meshInstances = [];
    var defaultMaterial = new pc.PhongMaterial;
    for(i = 0;i < modelData.meshInstances.length;i++) {
      var meshInstanceData = modelData.meshInstances[i];
      var node = nodes[meshInstanceData.node];
      var mesh = meshes[meshInstanceData.mesh];
      var material = this._getMaterial(i, mapping, options);
      if(!material) {
        material = defaultMaterial
      }
      var meshInstance = new pc.MeshInstance(node, mesh, material);
      if(mesh.skin) {
        var skinIndex = skins.indexOf(mesh.skin);
        if(skinIndex === -1) {
          throw new Error("Mesh's skin does not appear in skin array.");
        }
        meshInstance.skinInstance = skinInstances[skinIndex]
      }
      meshInstances.push(meshInstance)
    }
    var model = new pc.Model;
    model.graph = nodes[0];
    model.meshInstances = meshInstances;
    model.skinInstances = skinInstances;
    model.getGraph().syncHierarchy();
    return model
  };
  ModelResourceHandler.prototype._getMaterial = function(meshInstanceIndex, mapping, options) {
    var material;
    if(mapping && mapping.length > meshInstanceIndex) {
      if(mapping[meshInstanceIndex].material) {
        var asset = this._assets.getAssetById(mapping[meshInstanceIndex].material);
        if(!asset) {
          console.error("Reference to material not in asset list. Try reloading.");
          return null
        }else {
          if(!asset.resource) {
            console.error(pc.string.format("Material asset '{0}' is not loaded.", asset.name));
            return null
          }
        }
        material = asset.resource
      }else {
        if(mapping[meshInstanceIndex].path) {
          var path = pc.path.split(options.parent.canonical)[0];
          path = pc.path.join(path, mapping[meshInstanceIndex].path);
          var asset = this._assets.getAssetByUrl(path);
          if(asset) {
            material = asset.resource
          }
        }
      }
    }
    return material
  };
  var ModelRequest = function ModelRequest(identifier) {
  };
  ModelRequest = pc.inherits(ModelRequest, pc.resources.ResourceRequest);
  ModelRequest.prototype.type = "model";
  ModelRequest.prototype.Type = pc.Model;
  return{ModelResourceHandler:ModelResourceHandler, ModelRequest:ModelRequest}
}());
pc.extend(pc.resources, function() {
  function onTextureAssetChanged(asset, attribute, newValue, oldValue) {
    if(attribute !== "resource") {
      return
    }
    var material = this;
    var dirty = false;
    if(oldValue) {
      for(var key in material) {
        if(material.hasOwnProperty(key)) {
          if(material[key] === oldValue) {
            material[key] = newValue;
            dirty = true
          }
        }
      }
    }
    if(dirty) {
      material.update()
    }else {
      asset.off("change", onTextureAssetChanged, material)
    }
  }
  var MaterialResourceHandler = function(device, assets) {
    this._assets = assets;
    this._device = device
  };
  MaterialResourceHandler = pc.inherits(MaterialResourceHandler, pc.resources.ResourceHandler);
  MaterialResourceHandler.prototype.load = function(request, options) {
    var promise = null;
    if(pc.string.startsWith(request.canonical, "asset://")) {
      promise = new pc.promise.Promise(function(resolve, reject) {
        var asset = this._getAssetFromRequest(request);
        if(!asset) {
          reject(pc.string("Can't load material, asset %s not found", request.canonical))
        }
        resolve(asset.data)
      }.bind(this))
    }else {
      promise = new pc.promise.Promise(function(resolve, reject) {
        pc.net.http.get(request.canonical, function(response) {
          if(response.mapping_format === "path") {
            var referencedAssets = this._listReferencedAssets(response);
            var assets = [];
            if(referencedAssets.length) {
              referencedAssets.forEach(function(referencedAsset) {
                var path = referencedAsset.data;
                var filename = pc.path.getBasename(path);
                var url = pc.path.join(pc.path.split(request.canonical)[0], path);
                assets.push(new pc.asset.Asset(filename, referencedAsset.type, {url:url}))
              });
              this._assets.load(assets).then(function(responses) {
                resolve(response)
              })
            }else {
              resolve(response)
            }
          }else {
            resolve(response)
          }
        }.bind(this), {error:function() {
          reject()
        }})
      }.bind(this))
    }
    return promise
  };
  MaterialResourceHandler.prototype.open = function(data, request, options) {
    var material = new pc.PhongMaterial;
    this._updatePhongMaterial(material, data, request);
    var asset = this._getAssetFromRequest(request);
    asset.on("change", function(asset, attribute, value) {
      if(attribute === "data") {
        this._updatePhongMaterial(material, value, request)
      }
    }, this);
    return material
  };
  MaterialResourceHandler.prototype._listReferencedAssets = function(data) {
    var param;
    return data.parameters.filter(function(param) {
      return(param.type === "texture" || param.type === "cubemap") && param.data
    })
  };
  MaterialResourceHandler.prototype._updatePhongMaterial = function(material, data, request) {
    var requests = [];
    data.parameters.push({name:"shadingModel", type:"float", data:data.shader === "blinn" ? pc.SPECULAR_BLINN : pc.SPECULAR_PHONG});
    var textures = {};
    for(var i = 0;i < data.parameters.length;i++) {
      var param = data.parameters[i];
      if(param.type === "texture" && param.data && !(param.data instanceof pc.Texture)) {
        var textureAsset = this._getTextureAssetFromRegistry(param.data, request);
        if(textureAsset) {
          textures[textureAsset.id] = textureAsset
        }
        this._loadTextureParamFromCache(param, textureAsset);
        if(!(param.data instanceof pc.Texture) && textureAsset) {
          requests.push(this._loadTextureParamPromise(param, textureAsset))
        }
      }else {
        if(param.type === "cubemap" && param.data && !(param.data instanceof pc.Texture)) {
          var cubemapAsset = this._getTextureAssetFromRegistry(param.data, request);
          this._loadCubemapParamFromCache(param, cubemapAsset);
          if(!(param.data instanceof pc.Texture) && cubemapAsset) {
            requests.push(this._loadCubemapParamPromise(param, cubemapAsset))
          }
        }
      }
    }
    for(var id in textures) {
      textures[id].off("change", onTextureAssetChanged, material);
      textures[id].on("change", onTextureAssetChanged, material)
    }
    if(requests.length) {
      pc.promise.all(requests).then(function() {
        material.init(data)
      }, function(error) {
        pc.log.error(error);
        material.init(data)
      })
    }else {
      material.init(data)
    }
  };
  MaterialResourceHandler.prototype._getTextureAssetFromRegistry = function(textureId, request) {
    var asset = this._assets.getAssetById(textureId);
    if(!asset && request) {
      url = pc.path.join(pc.path.split(request.canonical)[0], textureId);
      asset = this._assets.getAssetByUrl(url)
    }
    return asset
  };
  MaterialResourceHandler.prototype._loadTextureParamFromCache = function(param, textureAsset) {
    if(textureAsset) {
      if(textureAsset.resource) {
        param.data = textureAsset.resource
      }
    }else {
      pc.log.error(pc.string.format("Could not load texture. Asset {0} not found", param.data));
      param.data = null
    }
  };
  MaterialResourceHandler.prototype._loadTextureParamPromise = function(param, textureAsset) {
    return this._assets.load(textureAsset).then(function(resources) {
      param.data = resources[0]
    }, function(error) {
      param.data = null
    })
  };
  MaterialResourceHandler.prototype._loadCubemapParamFromCache = function(param, cubemapAsset) {
    if(cubemapAsset) {
      if(cubemapAsset.resource) {
        param.data = cubemapAsset.resource
      }
    }else {
      pc.log.error(pc.string.format("Could not load cubemap. Asset {0} not found", param.data));
      param.data = null
    }
  };
  MaterialResourceHandler.prototype._loadCubemapParamPromise = function(param, cubemapAsset) {
    return this._assets.load(cubemapAsset).then(function(resources) {
      param.data = resources[0]
    }, function(error) {
      param.data = null
    })
  };
  MaterialResourceHandler.prototype._getAssetFromRequest = function(request) {
    if(pc.string.startsWith(request.canonical, "asset://")) {
      return this._assets.getAssetById(parseInt(request.canonical.slice(8)))
    }else {
      return this._assets.getAssetByUrl(request.canonical)
    }
  };
  var MaterialRequest = function MaterialRequest(identifier) {
  };
  MaterialRequest = pc.inherits(MaterialRequest, pc.resources.ResourceRequest);
  MaterialRequest.prototype.type = "material";
  MaterialRequest.prototype.Type = pc.Material;
  return{MaterialRequest:MaterialRequest, MaterialResourceHandler:MaterialResourceHandler}
}());
pc.extend(pc.resources, function() {
  var ScriptResourceHandler = function(app, prefix) {
    this._app = app;
    this._prefix = prefix || "";
    this._queue = [];
    this._pending = [];
    this._loaded = {};
    this._loading = null;
    pc.script.on("created", this._onScriptCreated, this)
  };
  ScriptResourceHandler = pc.inherits(ScriptResourceHandler, pc.resources.ResourceHandler);
  ScriptResourceHandler.prototype.load = function(request, options) {
    options = options || {};
    options.timeout = options.timeout || 6E4;
    options.cache = true;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var url = request.canonical;
      var processedUrl = url;
      if(!options.cache) {
        processedUrl = this._appendTimestampToUrl(processedUrl)
      }
      var processedUrl = new pc.URI(processedUrl);
      processedUrl.path = pc.path.join(this._prefix, processedUrl.path);
      processedUrl = processedUrl.toString();
      if(this._loaded[url]) {
        if(this._loaded[url] !== true) {
          resolve(this._loaded[url])
        }else {
          resolve(null)
        }
      }else {
        if(this._loading) {
          this._queue.push({url:processedUrl, canonicalUrl:url, success:resolve, error:reject})
        }else {
          this._addScriptTag(processedUrl, url, resolve, reject)
        }
      }
      if(options.timeout) {
        (function() {
          setTimeout(function() {
            if(!this._loaded[url]) {
              reject(pc.string.format("Loading script {0} timed out after {1}s", url, options.timeout / 1E3))
            }
          }.bind(this), options.timeout)
        }).call(this)
      }
    }.bind(this));
    return promise
  };
  ScriptResourceHandler.prototype.open = function(data, request, options) {
    return data
  };
  ScriptResourceHandler.prototype._appendTimestampToUrl = function(url) {
    timestamp = Date.now();
    uri = new pc.URI(url);
    if(!uri.query) {
      uri.query = "ts=" + timestamp
    }else {
      uri.query = uri.query + "&ts=" + timestamp
    }
    url = uri.toString();
    return url
  };
  ScriptResourceHandler.prototype._onScriptCreated = function(name, callback) {
    this._pending.push({name:name, callback:callback})
  };
  ScriptResourceHandler.prototype._addScriptTag = function(url, canonicalUrl, success, error) {
    var self = this;
    var head = document.getElementsByTagName("head")[0];
    var element = document.createElement("script");
    this._loading = element;
    element.addEventListener("error", function(e) {
      error(pc.string.format("Error loading script from '{0}'", e.target.src))
    });
    var done = false;
    element.onload = element.onreadystatechange = function() {
      if(!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
        done = true;
        var script = self._pending.shift();
        if(script) {
          var ScriptType = script.callback(self._app);
          if(ScriptType._pcScriptName) {
            throw Error("Attribute _pcScriptName is reserved on ScriptTypes for ResourceLoader use");
          }
          ScriptType._pcScriptName = script.name;
          self._loaded[canonicalUrl] = ScriptType;
          self._loader.registerHash(canonicalUrl, canonicalUrl);
          self._loader.addToCache(canonicalUrl, ScriptType);
          success(ScriptType)
        }else {
          self._loaded[canonicalUrl] = true;
          self._loader.registerHash(canonicalUrl, canonicalUrl);
          self._loader.addToCache(canonicalUrl, true);
          success(null)
        }
        self._loading = null;
        if(self._queue.length) {
          var loadable = self._queue.shift();
          self._addScriptTag(loadable.url, loadable.canonicalUrl, loadable.success, loadable.error)
        }
      }
    };
    element.src = url;
    head.appendChild(element)
  };
  var ScriptRequest = function ScriptRequest() {
  };
  ScriptRequest = pc.inherits(ScriptRequest, pc.resources.ResourceRequest);
  ScriptRequest.prototype.type = "script";
  return{ScriptResourceHandler:ScriptResourceHandler, ScriptRequest:ScriptRequest}
}());
pc.extend(pc.resources, function() {
  var AnimationResourceHandler = function() {
  };
  AnimationResourceHandler = pc.inherits(AnimationResourceHandler, pc.resources.ResourceHandler);
  AnimationResourceHandler.prototype.load = function(request, options) {
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var url = request.canonical;
      var dir = pc.path.getDirectory(url);
      pc.net.http.get(url, function(response) {
        try {
          resolve(response)
        }catch(e) {
          reject(pc.string.format("An error occured while loading animation from: '{0}'", url))
        }
      }.bind(this), {cache:options.cache, error:function(errors) {
        reject(errors)
      }})
    });
    return promise
  };
  AnimationResourceHandler.prototype.open = function(data, request, options) {
    return this["_loadAnimationV" + data.animation.version](data)
  };
  AnimationResourceHandler.prototype._loadAnimationV3 = function(data) {
    var animData = data.animation;
    var anim = new pc.Animation;
    anim.setName(animData.name);
    anim.setDuration(animData.duration);
    for(var i = 0;i < animData.nodes.length;i++) {
      var node = new pc.Node;
      var n = animData.nodes[i];
      node._name = n.name;
      for(var j = 0;j < n.keys.length;j++) {
        var k = n.keys[j];
        var t = k.time;
        var p = k.pos;
        var r = k.rot;
        var s = k.scale;
        var pos = new pc.Vec3(p[0], p[1], p[2]);
        var rot = (new pc.Quat).setFromEulerAngles(r[0], r[1], r[2]);
        var scl = new pc.Vec3(s[0], s[1], s[2]);
        var key = new pc.Key(t, pos, rot, scl);
        node._keys.push(key)
      }
      anim.addNode(node)
    }
    return anim
  };
  AnimationResourceHandler.prototype._loadAnimationV4 = function(data) {
    var animData = data.animation;
    var anim = new pc.Animation;
    anim.setName(animData.name);
    anim.setDuration(animData.duration);
    for(var i = 0;i < animData.nodes.length;i++) {
      var node = new pc.Node;
      var n = animData.nodes[i];
      node._name = n.name;
      var defPos = n.defaults.p;
      var defRot = n.defaults.r;
      var defScl = n.defaults.s;
      for(var j = 0;j < n.keys.length;j++) {
        var k = n.keys[j];
        var t = k.t;
        var p = defPos ? defPos : k.p;
        var r = defRot ? defRot : k.r;
        var s = defScl ? defScl : k.s;
        var pos = new pc.Vec3(p[0], p[1], p[2]);
        var rot = (new pc.Quat).setFromEulerAngles(r[0], r[1], r[2]);
        var scl = new pc.Vec3(s[0], s[1], s[2]);
        var key = new pc.Key(t, pos, rot, scl);
        node._keys.push(key)
      }
      anim.addNode(node)
    }
    return anim
  };
  var AnimationRequest = function AnimationRequest(identifier) {
  };
  AnimationRequest = pc.inherits(AnimationRequest, pc.resources.ResourceRequest);
  AnimationRequest.prototype.type = "animation";
  AnimationRequest.prototype.Type = pc.Animation;
  return{AnimationResourceHandler:AnimationResourceHandler, AnimationRequest:AnimationRequest}
}());
pc.extend(pc.resources, function() {
  var AudioResourceHandler = function(manager) {
    this.manager = manager
  };
  AudioResourceHandler = pc.inherits(AudioResourceHandler, pc.resources.ResourceHandler);
  AudioResourceHandler.prototype.load = function(request, options) {
    var self = this;
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var sound = self.manager.createSound(request.canonical, function(sound) {
        resolve(sound)
      }, function(error) {
        logERROR(error);
        resolve(sound)
      })
    });
    return promise
  };
  AudioResourceHandler.prototype.open = function(data, request, options) {
    return data
  };
  var AudioRequest = function(identifier) {
  };
  AudioRequest = pc.inherits(AudioRequest, pc.resources.ResourceRequest);
  AudioRequest.prototype.type = "audio";
  AudioRequest.prototype.Type = pc.Sound;
  return{AudioResourceHandler:AudioResourceHandler, AudioRequest:AudioRequest}
}());
pc.extend(pc.resources, function() {
  var PackResourceHandler = function(app, depot) {
    this._app = app;
    this._depot = depot
  };
  PackResourceHandler = pc.inherits(PackResourceHandler, pc.resources.ResourceHandler);
  PackResourceHandler.prototype.load = function(request, options) {
    options = options || {};
    var promise = new pc.promise.Promise(function(resolve, reject) {
      var guid = request.canonical;
      if(guid in pc.content.packs) {
        setTimeout(function() {
          resolve(pc.content.packs[guid])
        }, 0)
      }else {
        this._depot.packs.getOne(guid, function(pack) {
          resolve(pack)
        }.bind(this), function(errors) {
          reject(errors)
        })
      }
    }.bind(this));
    return promise
  };
  PackResourceHandler.prototype.open = function(data, request, options) {
    var pack = this.openPack(data, request);
    return pack
  };
  PackResourceHandler.prototype.openPack = function(data, request) {
    var d = pc.extend({}, data);
    d.hierarchy = this.openEntity(d.hierarchy, request);
    return new pc.Pack(d)
  };
  PackResourceHandler.prototype.openEntity = function(data, request) {
    var hierarchy;
    hierarchy = this.openEntityHierarchy(data, request);
    hierarchy.syncHierarchy();
    hierarchy = this.openComponentData(hierarchy, data, request);
    return hierarchy
  };
  PackResourceHandler.prototype.openEntityHierarchy = function(data, request) {
    var entity = new pc.Entity(this._app);
    var p = data.position;
    var r = data.rotation;
    var s = data.scale;
    entity.setName(data.name);
    entity.setGuid(data.resource_id);
    entity.setLocalPosition(p[0], p[1], p[2]);
    entity.setLocalEulerAngles(r[0], r[1], r[2]);
    entity.setLocalScale(s[0], s[1], s[2]);
    entity._enabled = data.enabled !== undefined ? data.enabled : true;
    entity._enabledInHierarchy = entity._enabled;
    if(data.labels) {
      data.labels.forEach(function(label) {
        entity.addLabel(label)
      })
    }
    entity.__parent = data.parent;
    entity.__children = data.children;
    entity.name = data.name;
    entity.template = data.template;
    var i, child, length = data.children.length;
    for(i = 0;i < length;i++) {
      child = this.openEntityHierarchy(data.children[i], request);
      entity.addChild(child)
    }
    return entity
  };
  PackResourceHandler.prototype.openComponentData = function(entity, data, request) {
    entity.setRequest(request);
    var systems = this._app.systems.list();
    var i, len = systems.length;
    for(i = 0;i < len;i++) {
      var componentData = data.components[systems[i].id];
      if(componentData) {
        this._app.systems[systems[i].id].addComponent(entity, componentData)
      }
    }
    entity.setRequest(null);
    var child, length = data.children.length;
    var children = entity.getChildren();
    for(i = 0;i < length;i++) {
      children[i] = this.openComponentData(children[i], data.children[i], request)
    }
    return entity
  };
  var PackRequest = function PackRequest(identifier) {
  };
  PackRequest = pc.inherits(PackRequest, pc.resources.ResourceRequest);
  PackRequest.prototype.type = "pack";
  PackRequest.prototype.Type = pc.Pack;
  return{PackResourceHandler:PackResourceHandler, PackRequest:PackRequest}
}());
pc.asset = {};
pc.extend(pc.asset, function() {
  var assetIdCounter = -1;
  var Asset = function(name, type, file, data) {
    var file, data;
    this._id = ++assetIdCounter;
    this.name = arguments[0];
    this.type = arguments[1];
    this._file = arguments[2] ? {filename:file.filename, size:file.size, hash:file.hash, url:file.url} : null;
    this._data = arguments[3] || {};
    this.resource = null;
    pc.events.attach(this)
  };
  Asset.prototype = {getFileUrl:function() {
    if(!this.file) {
      return null
    }
    return this.file.url
  }};
  Object.defineProperty(Asset.prototype, "id", {get:function() {
    return this._id
  }, set:function(value) {
    this._id = value;
    if(value > assetIdCounter) {
      assetIdCounter = value
    }
  }});
  Object.defineProperty(Asset.prototype, "file", {get:function() {
    return this._file
  }, set:function(value) {
    var old = this._file;
    this._file = value;
    if(value && !old || !value && old || value && old && value.hash !== old.hash) {
      this.fire("change", this, "file", value, old)
    }
  }});
  Object.defineProperty(Asset.prototype, "data", {get:function() {
    return this._data
  }, set:function(value) {
    var old = this._data;
    this._data = value;
    if(value !== old) {
      this.fire("change", this, "data", value, old)
    }
  }});
  return{Asset:Asset, ASSET_ANIMATION:"animation", ASSET_AUDIO:"audio", ASSET_IMAGE:"image", ASSET_JSON:"json", ASSET_MODEL:"model", ASSET_MATERIAL:"material", ASSET_TEXT:"text", ASSET_TEXTURE:"texture", ASSET_CUBEMAP:"cubemap"}
}());
pc.extend(pc.asset, function() {
  var AssetRegistry = function(loader) {
    if(!loader) {
      throw new Error("Must provide a ResourceLoader instance for AssetRegistry");
    }
    this.loader = loader;
    this._cache = {};
    this._names = {};
    this._urls = {};
    this._groups = {}
  };
  AssetRegistry.prototype = {addGroup:function(name, toc) {
    if(!this._groups[name]) {
      this._groups[name] = []
    }
    for(var id in toc.assets) {
      var asset = this.getAssetById(id);
      if(!asset) {
        var assetData = toc.assets[id];
        asset = this.createAndAddAsset(id, assetData)
      }else {
        pc.extend(asset, toc.assets[id])
      }
      this._groups[name].push(asset.id)
    }
  }, createAndAddAsset:function(id, assetData) {
    var asset = new pc.asset.Asset(assetData.name, assetData.type, assetData.file, assetData.data);
    asset.id = id;
    this.addAsset(asset);
    if(asset.file) {
      this.loader.registerHash(asset.file.hash, asset.getFileUrl())
    }
    return asset
  }, all:function() {
    return Object.keys(this._cache).map(function(id) {
      return this.getAssetById(id)
    }, this)
  }, list:function(groupName) {
    if(groupName) {
      if(this._groups[groupName]) {
        return this._groups[groupName].map(function(id) {
          return this.getAssetById(id)
        }, this)
      }
    }else {
      return Object.keys(this._cache).map(function(id) {
        return this.getAssetById(id)
      }, this)
    }
  }, addAsset:function(asset) {
    this._cache[asset.id] = asset;
    if(!this._names[asset.name]) {
      this._names[asset.name] = []
    }
    this._names[asset.name].push(asset.id);
    if(asset.file) {
      this._urls[asset.getFileUrl()] = asset.id;
      asset.on("change", this._onAssetChanged, this)
    }
  }, removeAsset:function(asset) {
    delete this._cache[asset.id];
    delete this._names[asset.name];
    if(asset.file) {
      asset.off("change", this._onAssetChanged, this);
      delete this._urls[asset.file.url]
    }
  }, _onAssetChanged:function(asset, attribute, newValue, oldValue) {
    var url;
    if(attribute === "file") {
      if(oldValue) {
        url = oldValue.url;
        delete this._urls[url];
        this.loader.removeFromCache(url);
        this.loader.unregisterHash(url)
      }
      if(newValue) {
        url = asset.getFileUrl();
        this._urls[url] = asset.id;
        this.loader.registerHash(newValue.hash, url);
        var oldResource = asset.resource;
        this.load([asset]).then(function(resources) {
          asset.fire("change", asset, "resource", resources[0], oldResource)
        })
      }
    }
  }, findAll:function(name, type) {
    var self = this;
    var ids = this._names[name];
    var assets;
    if(ids) {
      assets = ids.map(function(id) {
        return self._cache[id]
      });
      if(type) {
        return assets.filter(function(asset) {
          return asset.type === type
        })
      }else {
        return assets
      }
    }else {
      return[]
    }
  }, find:function(name, type) {
    var asset = this.findAll(name, type);
    return asset ? asset[0] : null
  }, getAssetByResourceId:function(id) {
    console.warn("WARNING: getAssetByResourceId: Function is deprecated. Use getAssetById() instead.");
    return this._cache[id]
  }, getAssetById:function(id) {
    return this._cache[id]
  }, getAssetByUrl:function(url) {
    var id = this._urls[url];
    return this._cache[id]
  }, getAssetByName:function(name) {
    console.warn("WARNING: getAssetByName: Function is deprecated. Use find() or findAll() instead.");
    return this.find(name)
  }, load:function(assets, results, options) {
    if(assets && pc.type(assets) !== "array") {
      assets = [assets]
    }
    if(options === undefined) {
      options = results;
      results = []
    }
    var requests = [];
    assets.forEach(function(asset, index) {
      var existing = this.getAssetById(asset.id);
      if(!existing) {
        this.addAsset(asset)
      }
      switch(asset.type) {
        case pc.asset.ASSET_MODEL:
          requests.push(this._createModelRequest(asset));
          break;
        case pc.asset.ASSET_TEXTURE:
          requests.push(this._createTextureRequest(asset, results[index]));
          break;
        case pc.asset.ASSET_CUBEMAP:
          requests.push(this._createCubemapRequest(asset, results[index]));
          break;
        case pc.asset.ASSET_MATERIAL:
          requests.push(this._createMaterialRequest(asset));
          break;
        default:
          requests.push(this._createAssetRequest(asset));
          break
      }
    }, this);
    return this.loader.request(requests.filter(function(r) {
      return r !== null
    }), options).then(function(resources) {
      var promise = new pc.promise.Promise(function(resolve, reject) {
        var index = 0;
        requests.forEach(function(r, i) {
          if(r) {
            assets[i].resource = resources[index++]
          }
        });
        resolve(resources)
      });
      return promise
    }, function(error) {
      setTimeout(function() {
        throw error;
      }, 0)
    })
  }, loadFromUrl:function(url, type) {
    if(!type) {
      throw Error("type required");
    }
    if(type === "model") {
      return this._loadModel(url)
    }
    var dir = pc.path.getDirectory(url);
    var basename = pc.path.getBasename(url);
    var name = basename.replace(".json", "");
    var asset = new pc.asset.Asset(name, type, {url:url});
    var promise = new pc.promise.Promise(function(resolve, reject) {
      this.load(asset).then(function(resource) {
        resolve({resource:resource, asset:asset})
      })
    }.bind(this));
    return promise
  }, _loadModel:function(url) {
    var self = this;
    var dir = pc.path.getDirectory(url);
    var basename = pc.path.getBasename(url);
    var name = basename.replace(".json", "");
    var mappingUrl = pc.path.join(dir, basename.replace(".json", ".mapping.json"));
    var modelAsset = new pc.asset.Asset(name, "model", {url:url});
    var mappingAsset = new pc.asset.Asset(name + ".mapping", "json", {url:mappingUrl});
    var promise = new pc.promise.Promise(function(resolve, reject) {
      self.load([modelAsset, mappingAsset]).then(function(resources) {
        var model = resources[0];
        var mapping = resources[1];
        modelAsset.data = mapping;
        var materialAssets = [];
        mapping.mapping.forEach(function(map) {
          materialAssets.push(new pc.asset.Asset(pc.path.getBasename(map.path), "material", {url:pc.path.join(dir, map.path)}))
        });
        if(materialAssets.length) {
          var promise = self.load(materialAssets);
          promise.then(function(materials) {
            for(var i = 0, n = model.meshInstances.length;i < n;i++) {
              model.meshInstances[i].material = materials[i]
            }
            resolve({resource:model, asset:modelAsset})
          });
          return promise
        }else {
          resolve({resource:model, asset:modelAsset})
        }
      })
    });
    return promise
  }, _createAssetRequest:function(asset, result) {
    var url = asset.getFileUrl();
    if(url) {
      return this.loader.createFileRequest(url, asset.type)
    }else {
      return null
    }
  }, _createModelRequest:function(asset) {
    var url = asset.getFileUrl();
    var mapping = asset.data && asset.data.mapping ? asset.data.mapping : [];
    return new pc.resources.ModelRequest(url, mapping)
  }, _createTextureRequest:function(asset, texture) {
    return new pc.resources.TextureRequest(asset.getFileUrl(), null, texture)
  }, _createCubemapRequest:function(asset, texture) {
    var url = asset.getFileUrl();
    if(url) {
      return new pc.resources.CubemapRequest(url, null, texture)
    }else {
      return new pc.resources.CubemapRequest("asset://" + asset.id, null, texture)
    }
  }, _createMaterialRequest:function(asset) {
    var url = asset.getFileUrl();
    if(url) {
      return new pc.resources.MaterialRequest(url)
    }else {
      return new pc.resources.MaterialRequest("asset://" + asset.id)
    }
  }};
  return{AssetRegistry:AssetRegistry}
}());
!function(a) {
  var b, c;
  !function() {
    var a = {}, d = {};
    b = function(b, c, d) {
      a[b] = {deps:c, callback:d}
    }, c = function(b) {
      function e(a) {
        if("." !== a.charAt(0)) {
          return a
        }
        for(var c = a.split("/"), d = b.split("/").slice(0, -1), e = 0, f = c.length;f > e;e++) {
          var g = c[e];
          if(".." === g) {
            d.pop()
          }else {
            if("." === g) {
              continue
            }
            d.push(g)
          }
        }
        return d.join("/")
      }
      if(d[b]) {
        return d[b]
      }
      if(d[b] = {}, !a[b]) {
        throw new Error("Could not find module " + b);
      }
      for(var f, g = a[b], h = g.deps, i = g.callback, j = [], k = 0, l = h.length;l > k;k++) {
        j.push("exports" === h[k] ? f = {} : c(e(h[k])))
      }
      var m = i.apply(this, j);
      return d[b] = f || m
    }, c.entries = a
  }(), b("rsvp/all-settled", ["./promise", "./utils", "exports"], function(a, b, c) {
    function d(a) {
      return{state:"fulfilled", value:a}
    }
    function e(a) {
      return{state:"rejected", reason:a}
    }
    var f = a["default"], g = b.isArray, h = b.isNonThenable;
    c["default"] = function(a, b) {
      return new f(function(b) {
        function c(a) {
          return function(b) {
            j(a, d(b))
          }
        }
        function i(a) {
          return function(b) {
            j(a, e(b))
          }
        }
        function j(a, c) {
          m[a] = c, 0 === --l && b(m)
        }
        if(!g(a)) {
          throw new TypeError("You must pass an array to allSettled.");
        }
        var k, l = a.length;
        if(0 === l) {
          return void b([])
        }
        for(var m = new Array(l), n = 0;n < a.length;n++) {
          k = a[n], h(k) ? j(n, d(k)) : f.resolve(k).then(c(n), i(n))
        }
      }, b)
    }
  }), b("rsvp/all", ["./promise", "exports"], function(a, b) {
    var c = a["default"];
    b["default"] = function(a, b) {
      return c.all(a, b)
    }
  }), b("rsvp/asap", ["exports"], function(a) {
    function b() {
      return function() {
        process.nextTick(e)
      }
    }
    function c() {
      var a = 0, b = new h(e), c = document.createTextNode("");
      return b.observe(c, {characterData:!0}), function() {
        c.data = a = ++a % 2
      }
    }
    function d() {
      return function() {
        setTimeout(e, 1)
      }
    }
    function e() {
      for(var a = 0;a < i.length;a++) {
        var b = i[a], c = b[0], d = b[1];
        c(d)
      }
      i.length = 0
    }
    a["default"] = function(a, b) {
      var c = i.push([a, b]);
      1 === c && f()
    };
    var f, g = "undefined" != typeof window ? window : {}, h = g.MutationObserver || g.WebKitMutationObserver, i = [];
    f = "undefined" != typeof process && "[object process]" === {}.toString.call(process) ? b() : h ? c() : d()
  }), b("rsvp/config", ["./events", "exports"], function(a, b) {
    function c(a, b) {
      return"onerror" === a ? void e.on("error", b) : 2 !== arguments.length ? e[a] : void(e[a] = b)
    }
    var d = a["default"], e = {instrument:!1};
    d.mixin(e), b.config = e, b.configure = c
  }), b("rsvp/defer", ["./promise", "exports"], function(a, b) {
    var c = a["default"];
    b["default"] = function(a) {
      var b = {};
      return b.promise = new c(function(a, c) {
        b.resolve = a, b.reject = c
      }, a), b
    }
  }), b("rsvp/events", ["exports"], function(a) {
    function b(a, b) {
      for(var c = 0, d = a.length;d > c;c++) {
        if(a[c] === b) {
          return c
        }
      }
      return-1
    }
    function c(a) {
      var b = a._promiseCallbacks;
      return b || (b = a._promiseCallbacks = {}), b
    }
    a["default"] = {mixin:function(a) {
      return a.on = this.on, a.off = this.off, a.trigger = this.trigger, a._promiseCallbacks = void 0, a
    }, on:function(a, d) {
      var e, f = c(this);
      e = f[a], e || (e = f[a] = []), -1 === b(e, d) && e.push(d)
    }, off:function(a, d) {
      var e, f, g = c(this);
      return d ? (e = g[a], f = b(e, d), void(-1 !== f && e.splice(f, 1))) : void(g[a] = [])
    }, trigger:function(a, b) {
      var d, e, f = c(this);
      if(d = f[a]) {
        for(var g = 0;g < d.length;g++) {
          (e = d[g])(b)
        }
      }
    }}
  }), b("rsvp/filter", ["./promise", "./utils", "exports"], function(a, b, c) {
    var d = a["default"], e = b.isFunction;
    c["default"] = function(a, b, c) {
      return d.all(a, c).then(function(a) {
        if(!e(b)) {
          throw new TypeError("You must pass a function as filter's second argument.");
        }
        for(var f = a.length, g = new Array(f), h = 0;f > h;h++) {
          g[h] = b(a[h])
        }
        return d.all(g, c).then(function(b) {
          for(var c = new Array(f), d = 0, e = 0;f > e;e++) {
            b[e] === !0 && (c[d] = a[e], d++)
          }
          return c.length = d, c
        })
      })
    }
  }), b("rsvp/hash-settled", ["./promise", "./utils", "exports"], function(a, b, c) {
    function d(a) {
      return{state:"fulfilled", value:a}
    }
    function e(a) {
      return{state:"rejected", reason:a}
    }
    var f = a["default"], g = b.isNonThenable, h = b.keysOf;
    c["default"] = function(a) {
      return new f(function(b) {
        function c(a) {
          return function(b) {
            j(a, d(b))
          }
        }
        function i(a) {
          return function(b) {
            j(a, e(b))
          }
        }
        function j(a, c) {
          m[a] = c, 0 === --o && b(m)
        }
        var k, l, m = {}, n = h(a), o = n.length;
        if(0 === o) {
          return void b(m)
        }
        for(var p = 0;p < n.length;p++) {
          l = n[p], k = a[l], g(k) ? j(l, d(k)) : f.resolve(k).then(c(l), i(l))
        }
      })
    }
  }), b("rsvp/hash", ["./promise", "./utils", "exports"], function(a, b, c) {
    var d = a["default"], e = b.isNonThenable, f = b.keysOf;
    c["default"] = function(a) {
      return new d(function(b, c) {
        function g(a) {
          return function(c) {
            k[a] = c, 0 === --m && b(k)
          }
        }
        function h(a) {
          m = 0, c(a)
        }
        var i, j, k = {}, l = f(a), m = l.length;
        if(0 === m) {
          return void b(k)
        }
        for(var n = 0;n < l.length;n++) {
          j = l[n], i = a[j], e(i) ? (k[j] = i, 0 === --m && b(k)) : d.resolve(i).then(g(j), h)
        }
      })
    }
  }), b("rsvp/instrument", ["./config", "./utils", "exports"], function(a, b, c) {
    var d = a.config, e = b.now;
    c["default"] = function(a, b, c) {
      try {
        d.trigger(a, {guid:b._guidKey + b._id, eventName:a, detail:b._detail, childGuid:c && b._guidKey + c._id, label:b._label, timeStamp:e(), stack:(new Error(b._label)).stack})
      }catch(f) {
        setTimeout(function() {
          throw f;
        }, 0)
      }
    }
  }), b("rsvp/map", ["./promise", "./utils", "exports"], function(a, b, c) {
    var d = a["default"], e = (b.isArray, b.isFunction);
    c["default"] = function(a, b, c) {
      return d.all(a, c).then(function(a) {
        if(!e(b)) {
          throw new TypeError("You must pass a function as map's second argument.");
        }
        for(var f = a.length, g = new Array(f), h = 0;f > h;h++) {
          g[h] = b(a[h])
        }
        return d.all(g, c)
      })
    }
  }), b("rsvp/node", ["./promise", "./utils", "exports"], function(a, b, c) {
    var d = a["default"], e = b.isArray;
    c["default"] = function(a, b) {
      function c() {
        for(var c = arguments.length, e = new Array(c), h = 0;c > h;h++) {
          e[h] = arguments[h]
        }
        var i;
        return f || g || !b ? i = this : (console.warn('Deprecation: RSVP.denodeify() doesn\'t allow setting the "this" binding anymore. Use yourFunction.bind(yourThis) instead.'), i = b), d.all(e).then(function(c) {
          function e(d, e) {
            function h() {
              for(var a = arguments.length, c = new Array(a), h = 0;a > h;h++) {
                c[h] = arguments[h]
              }
              var i = c[0], j = c[1];
              if(i) {
                e(i)
              }else {
                if(f) {
                  d(c.slice(1))
                }else {
                  if(g) {
                    var k, l, m = {}, n = c.slice(1);
                    for(l = 0;l < b.length;l++) {
                      k = b[l], m[k] = n[l]
                    }
                    d(m)
                  }else {
                    d(j)
                  }
                }
              }
            }
            c.push(h), a.apply(i, c)
          }
          return new d(e)
        })
      }
      var f = b === !0, g = e(b);
      return c.__proto__ = a, c
    }
  }), b("rsvp/promise", ["./config", "./events", "./instrument", "./utils", "./promise/cast", "./promise/all", "./promise/race", "./promise/resolve", "./promise/reject", "exports"], function(a, b, c, d, e, f, g, h, i, j) {
    function k() {
    }
    function l(a, b) {
      if(!z(a)) {
        throw new TypeError("You must pass a resolver function as the first argument to the promise constructor");
      }
      if(!(this instanceof l)) {
        throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
      }
      this._id = H++, this._label = b, this._subscribers = [], w.instrument && x("created", this), k !== a && m(a, this)
    }
    function m(a, b) {
      function c(a) {
        r(b, a)
      }
      function d(a) {
        t(b, a)
      }
      try {
        a(c, d)
      }catch(e) {
        d(e)
      }
    }
    function n(a, b, c, d) {
      var e = a._subscribers, f = e.length;
      e[f] = b, e[f + K] = c, e[f + L] = d
    }
    function o(a, b) {
      var c, d, e = a._subscribers, f = a._detail;
      w.instrument && x(b === K ? "fulfilled" : "rejected", a);
      for(var g = 0;g < e.length;g += 3) {
        c = e[g], d = e[g + b], p(b, c, d, f)
      }
      a._subscribers = null
    }
    function p(a, b, c, d) {
      var e, f, g, h, i = z(c);
      if(i) {
        try {
          e = c(d), g = !0
        }catch(j) {
          h = !0, f = j
        }
      }else {
        e = d, g = !0
      }
      q(b, e) || (i && g ? r(b, e) : h ? t(b, f) : a === K ? r(b, e) : a === L && t(b, e))
    }
    function q(a, b) {
      var c, d = null;
      try {
        if(a === b) {
          throw new TypeError("A promises callback cannot return that same promise.");
        }
        if(y(b) && (d = b.then, z(d))) {
          return d.call(b, function(d) {
            return c ? !0 : (c = !0, void(b !== d ? r(a, d) : s(a, d)))
          }, function(b) {
            return c ? !0 : (c = !0, void t(a, b))
          }, "Settle: " + (a._label || " unknown promise")), !0
        }
      }catch(e) {
        return c ? !0 : (t(a, e), !0)
      }
      return!1
    }
    function r(a, b) {
      a === b ? s(a, b) : q(a, b) || s(a, b)
    }
    function s(a, b) {
      a._state === I && (a._state = J, a._detail = b, w.async(u, a))
    }
    function t(a, b) {
      a._state === I && (a._state = J, a._detail = b, w.async(v, a))
    }
    function u(a) {
      o(a, a._state = K)
    }
    function v(a) {
      a._onerror && a._onerror(a._detail), o(a, a._state = L)
    }
    var w = a.config, x = (b["default"], c["default"]), y = d.objectOrFunction, z = d.isFunction, A = d.now, B = e["default"], C = f["default"], D = g["default"], E = h["default"], F = i["default"], G = "rsvp_" + A() + "-", H = 0;
    j["default"] = l, l.cast = B, l.all = C, l.race = D, l.resolve = E, l.reject = F;
    var I = void 0, J = 0, K = 1, L = 2;
    l.prototype = {constructor:l, _id:void 0, _guidKey:G, _label:void 0, _state:void 0, _detail:void 0, _subscribers:void 0, _onerror:function(a) {
      w.trigger("error", a)
    }, then:function(a, b, c) {
      var d = this;
      this._onerror = null;
      var e = new this.constructor(k, c);
      if(this._state) {
        var f = arguments;
        w.async(function() {
          p(d._state, e, f[d._state - 1], d._detail)
        })
      }else {
        n(this, e, a, b)
      }
      return w.instrument && x("chained", d, e), e
    }, "catch":function(a, b) {
      return this.then(null, a, b)
    }, "finally":function(a, b) {
      var c = this.constructor;
      return this.then(function(b) {
        return c.resolve(a()).then(function() {
          return b
        })
      }, function(b) {
        return c.resolve(a()).then(function() {
          throw b;
        })
      }, b)
    }}
  }), b("rsvp/promise/all", ["../utils", "exports"], function(a, b) {
    var c = a.isArray, d = a.isNonThenable;
    b["default"] = function(a, b) {
      var e = this;
      return new e(function(b, f) {
        function g(a) {
          return function(c) {
            k[a] = c, 0 === --j && b(k)
          }
        }
        function h(a) {
          j = 0, f(a)
        }
        if(!c(a)) {
          throw new TypeError("You must pass an array to all.");
        }
        var i, j = a.length, k = new Array(j);
        if(0 === j) {
          return void b(k)
        }
        for(var l = 0;l < a.length;l++) {
          i = a[l], d(i) ? (k[l] = i, 0 === --j && b(k)) : e.resolve(i).then(g(l), h)
        }
      }, b)
    }
  }), b("rsvp/promise/cast", ["exports"], function(a) {
    a["default"] = function(a, b) {
      var c = this;
      return a && "object" == typeof a && a.constructor === c ? a : new c(function(b) {
        b(a)
      }, b)
    }
  }), b("rsvp/promise/race", ["../utils", "exports"], function(a, b) {
    var c = a.isArray, d = (a.isFunction, a.isNonThenable);
    b["default"] = function(a, b) {
      var e, f = this;
      return new f(function(b, g) {
        function h(a) {
          j && (j = !1, b(a))
        }
        function i(a) {
          j && (j = !1, g(a))
        }
        if(!c(a)) {
          throw new TypeError("You must pass an array to race.");
        }
        for(var j = !0, k = 0;k < a.length;k++) {
          if(e = a[k], d(e)) {
            return j = !1, void b(e)
          }
          f.resolve(e).then(h, i)
        }
      }, b)
    }
  }), b("rsvp/promise/reject", ["exports"], function(a) {
    a["default"] = function(a, b) {
      var c = this;
      return new c(function(b, c) {
        c(a)
      }, b)
    }
  }), b("rsvp/promise/resolve", ["exports"], function(a) {
    a["default"] = function(a, b) {
      var c = this;
      return a && "object" == typeof a && a.constructor === c ? a : new c(function(b) {
        b(a)
      }, b)
    }
  }), b("rsvp/race", ["./promise", "exports"], function(a, b) {
    var c = a["default"];
    b["default"] = function(a, b) {
      return c.race(a, b)
    }
  }), b("rsvp/reject", ["./promise", "exports"], function(a, b) {
    var c = a["default"];
    b["default"] = function(a, b) {
      return c.reject(a, b)
    }
  }), b("rsvp/resolve", ["./promise", "exports"], function(a, b) {
    var c = a["default"];
    b["default"] = function(a, b) {
      return c.resolve(a, b)
    }
  }), b("rsvp/rethrow", ["exports"], function(a) {
    a["default"] = function(a) {
      throw setTimeout(function() {
        throw a;
      }), a;
    }
  }), b("rsvp/utils", ["exports"], function(a) {
    function b(a) {
      return"function" == typeof a || "object" == typeof a && null !== a
    }
    function c(a) {
      return"function" == typeof a
    }
    function d(a) {
      return!b(a)
    }
    a.objectOrFunction = b, a.isFunction = c, a.isNonThenable = d;
    var e;
    e = Array.isArray ? Array.isArray : function(a) {
      return"[object Array]" === Object.prototype.toString.call(a)
    };
    var f = e;
    a.isArray = f;
    var g = Date.now || function() {
      return(new Date).getTime()
    };
    a.now = g;
    var h = Object.keys || function(a) {
      var b = [];
      for(var c in a) {
        b.push(c)
      }
      return b
    };
    a.keysOf = h
  }), b("rsvp", ["./rsvp/promise", "./rsvp/events", "./rsvp/node", "./rsvp/all", "./rsvp/all-settled", "./rsvp/race", "./rsvp/hash", "./rsvp/hash-settled", "./rsvp/rethrow", "./rsvp/defer", "./rsvp/config", "./rsvp/map", "./rsvp/resolve", "./rsvp/reject", "./rsvp/filter", "./rsvp/asap", "exports"], function(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q) {
    function r(a, b) {
      E.async(a, b)
    }
    function s() {
      E.on.apply(E, arguments)
    }
    function t() {
      E.off.apply(E, arguments)
    }
    var u = a["default"], v = b["default"], w = c["default"], x = d["default"], y = e["default"], z = f["default"], A = g["default"], B = h["default"], C = i["default"], D = j["default"], E = k.config, F = k.configure, G = l["default"], H = m["default"], I = n["default"], J = o["default"], K = p["default"];
    if(E.async = K, "undefined" != typeof window && "object" == typeof window.__PROMISE_INSTRUMENTATION__) {
      var L = window.__PROMISE_INSTRUMENTATION__;
      F("instrument", !0);
      for(var M in L) {
        L.hasOwnProperty(M) && s(M, L[M])
      }
    }
    q.Promise = u, q.EventTarget = v, q.all = x, q.allSettled = y, q.race = z, q.hash = A, q.hashSettled = B, q.rethrow = C, q.defer = D, q.denodeify = w, q.configure = F, q.on = s, q.off = t, q.resolve = H, q.reject = I, q.async = r, q.map = G, q.filter = J
  }), a.RSVP = c("rsvp")
}(window);
pc.promise = {Promise:window.RSVP.Promise, all:window.RSVP.all};
pc.anim = {Animation:pc.Animation, Key:pc.Key, Node:pc.Node, Skeleton:pc.Skeleton};
pc.audio = {AudioManager:pc.AudioManager, Channel:pc.Channel, Channel3d:pc.Channel3d, Listener:pc.Listener, Sound:pc.Sound};
pc.fw = {Application:pc.Application, Component:pc.Component, ComponentData:pc.ComponentData, ComponentSystem:pc.ComponentSystem, ContentFile:pc.ContentFile, Entity:pc.Entity, FillMode:{NONE:pc.FILLMODE_NONE, FILL_WINDOW:pc.FILLMODE_FILL_WINDOW, KEEP_ASPECT:pc.FILLMODE_KEEP_ASPECT}, LiveLink:pc.LiveLink, LiveLinkCloseEntityMessage:pc.LiveLinkCloseEntityMessage, LiveLinkMessage:pc.LiveLinkMessage, LiveLinkMessageRegister:pc.LiveLinkMessageRegister, LiveLinkMessageType:{CLOSE_ENTITY:"CLOSE_ENTITY", 
NO_TYPE:"NO_TYPE", OPEN_ENTITY:"OPEN_ENTITY", OPEN_PACK:"OPEN_PACK", RECEIVED:"RECEIVED", REPARENT_ENTITY:"REPARENT_ENTITY", SELECTION_UPDATED:"SELECTION_UPDATED", UPDATE_ASSET:"UPDATE_ASSET", UPDATE_ASSETCACHE:"UPDATE_ASSETCACHE", UPDATE_COMPONENT:"UPDATE_COMPONENT", UPDATE_ENTITY:"UPDATE_ENTITY", UPDATE_ENTITY_ENABLED:"UPDATE_ENTITY_ENABLED", UPDATE_ENTITY_NAME:"UPDATE_ENTITY_NAME", UPDATE_ENTITY_TRANSFORM:"UPDATE_ENTITY_TRANSFORM", UPDATE_PACK_SETTINGS:"UPDATE_PACK_SETTINGS"}, LiveLinkOpenEntityMessage:pc.LiveLinkOpenEntityMessage, 
LiveLinkOpenPackMessage:pc.LiveLinkOpenPackMessage, LiveLinkReparentEntityMessage:pc.LiveLinkReparentEntityMessage, LiveLinkUpdateAssetCacheMessage:pc.LiveLinkUpdateAssetCacheMessage, LiveLinkUpdateAssetMessage:pc.LiveLinkUpdateAssetMessage, LiveLinkUpdateComponentMessage:pc.LiveLinkUpdateComponentMessage, LiveLinkUpdateEntityEnabledMessage:pc.LiveLinkUpdateEntityEnabledMessage, LiveLinkUpdateEntityMessage:pc.LiveLinkUpdateEntityMessage, LiveLinkUpdateEntityNameMessage:pc.LiveLinkUpdateEntityNameMessage, 
LiveLinkUpdateEntityTransformMessage:pc.LiveLinkUpdateEntityTransformMessage, LiveLinkUpdatePackSettings:pc.LiveLinkUpdatePackSettings, Pack:pc.Pack, ResolutionMode:{AUTO:pc.RESOLUTION_AUTO, FIXED:pc.RESOLUTION_FIXED}};
pc.extend(pc.gfx, {defaultGamma:pc.defaultGamma, defaultTonemapping:pc.defaultTonemapping, drawQuadWithShader:pc.drawQuadWithShader, precalculatedTangents:pc.precalculatedTangents, programlib:pc.programlib, shaderChunks:pc.shaderChunks, ContextCreationError:pc.ContextCreationError, Device:pc.GraphicsDevice, IndexBuffer:pc.IndexBuffer, ProgramLibrary:pc.ProgramLibrary, RenderTarget:pc.RenderTarget, ScopeId:pc.ScopeId, Shader:pc.Shader, ShaderInput:pc.ShaderInput, Texture:pc.Texture, UnsupportedBrowserError:pc.UnsupportedBrowserError, 
VertexBuffer:pc.VertexBuffer, VertexFormat:pc.VertexFormat, VertexIterator:pc.VertexIterator});
pc.extend(pc.input, {getTouchTargetCoords:pc.getTouchTargetCoords, Controller:pc.Controller, GamePads:pc.GamePads, Keyboard:pc.Keyboard, KeyboardEvent:pc.KeyboardEvent, Mouse:pc.Mouse, MouseEvent:pc.MouseEvent, Touch:pc.Touch, TouchDevice:pc.TouchDevice, TouchEvent:pc.TouchEvent});
pc.posteffect = {createFullscreenQuad:pc.createFullscreenQuad, drawFullscreenQuad:pc.drawFullscreenQuad, PostEffect:pc.PostEffect, PostEffectQueue:pc.PostEffectQueue};
pc.extend(pc.scene, {partitionSkin:pc.partitionSkin, BasicMaterial:pc.BasicMaterial, DepthMaterial:pc.DepthMaterial, ForwardRenderer:pc.ForwardRenderer, GraphNode:pc.GraphNode, Material:pc.Material, Command:pc.Command, Mesh:pc.Mesh, MeshInstance:pc.MeshInstance, Model:pc.Model, ParticleEmitter:pc.ParticleEmitter, PhongMaterial:pc.PhongMaterial, Picker:pc.Picker, PickMaterial:pc.PickMaterial, Scene:pc.Scene, Skin:pc.Skin, SkinInstance:pc.SkinInstance});
pc.scene.procedural = {calculateTangents:pc.calculateTangents, createMesh:pc.createMesh, createTorus:pc.createTorus, createCylinder:pc.createCylinder, createCapsule:pc.createCapsule, createCone:pc.createCone, createSphere:pc.createSphere, createPlane:pc.createPlane, createBox:pc.createBox};
pc.scene.Projection = {ORTHOGRAPHIC:pc.PROJECTION_ORTHOGRAPHIC, PERSPECTIVE:pc.PROJECTION_PERSPECTIVE};
pc.time = {now:pc.now, Timer:pc.Timer};

