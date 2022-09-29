/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
(function () {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return;
  }

  navigator.pointer = navigator.pointer || navigator.webkitPointer || navigator.mozPointer;

  var pointerlockchange = function pointerlockchange() {
    var e = document.createEvent('CustomEvent');
    e.initCustomEvent('pointerlockchange', true, false, null);
    document.dispatchEvent(e);
  };

  var pointerlockerror = function pointerlockerror() {
    var e = document.createEvent('CustomEvent');
    e.initCustomEvent('pointerlockerror', true, false, null);
    document.dispatchEvent(e);
  };

  document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
  document.addEventListener('webkitpointerlocklost', pointerlockchange, false);
  document.addEventListener('mozpointerlockchange', pointerlockchange, false);
  document.addEventListener('mozpointerlocklost', pointerlockchange, false);
  document.addEventListener('webkitpointerlockerror', pointerlockerror, false);
  document.addEventListener('mozpointerlockerror', pointerlockerror, false);

  if (Element.prototype.mozRequestPointerLock) {
    Element.prototype.requestPointerLock = function () {
      this.mozRequestPointerLock();
    };
  } else {
    Element.prototype.requestPointerLock = Element.prototype.requestPointerLock || Element.prototype.webkitRequestPointerLock || Element.prototype.mozRequestPointerLock;
  }

  if (!Element.prototype.requestPointerLock && navigator.pointer) {
    Element.prototype.requestPointerLock = function () {
      var el = this;
      document.pointerLockElement = el;
      navigator.pointer.lock(el, pointerlockchange, pointerlockerror);
    };
  }

  document.exitPointerLock = document.exitPointerLock || document.webkitExitPointerLock || document.mozExitPointerLock;

  if (!document.exitPointerLock) {
    document.exitPointerLock = function () {
      if (navigator.pointer) {
        document.pointerLockElement = null;
        navigator.pointer.unlock();
      }
    };
  }
})();
