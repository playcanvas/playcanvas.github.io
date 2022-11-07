/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
function defineProtoFunc(cls, name, func) {
  if (!cls.prototype[name]) {
    Object.defineProperty(cls.prototype, name, {
      value: func,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
}

export { defineProtoFunc };
