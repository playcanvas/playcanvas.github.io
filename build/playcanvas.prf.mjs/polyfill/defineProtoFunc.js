/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
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
