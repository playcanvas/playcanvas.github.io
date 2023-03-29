/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
let desktop = false;
let mobile = false;
let windows = false;
let xbox = false;
let android = false;
let ios = false;
let touch = false;
let gamepads = false;
let workers = false;
let passiveEvents = false;
if (typeof navigator !== 'undefined') {
  const ua = navigator.userAgent;
  if (/(windows|mac os|linux|cros)/i.test(ua)) desktop = true;
  if (/xbox/i.test(ua)) xbox = true;
  if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
    desktop = false;
    mobile = true;
    windows = true;
  } else if (/android/i.test(ua)) {
    desktop = false;
    mobile = true;
    android = true;
  } else if (/ip([ao]d|hone)/i.test(ua)) {
    desktop = false;
    mobile = true;
    ios = true;
  }
  if (typeof window !== 'undefined') {
    touch = 'ontouchstart' in window || 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
  }
  gamepads = !!navigator.getGamepads || !!navigator.webkitGetGamepads;
  workers = typeof Worker !== 'undefined';
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function () {
        passiveEvents = true;
        return false;
      }
    });
    window.addEventListener('testpassive', null, opts);
    window.removeEventListener('testpassive', null, opts);
  } catch (e) {}
}

// detect browser/node environment
const environment = typeof window !== 'undefined' ? 'browser' : 'node';

/**
 * Global namespace that stores flags regarding platform environment and features support.
 *
 * @namespace
 * @example
 * if (pc.platform.touch) {
 *     // touch is supported
 * }
 */
const platform = {
  /**
   * String identifying the current runtime environment. Either 'browser' or 'node'.
   *
   * @type {string}
   */
  environment: environment,
  /**
   * The global object. This will be the window object when running in a browser and the global
   * object when running in nodejs.
   *
   * @type {object}
   */
  global: environment === 'browser' ? window : global,
  /**
   * Convenience boolean indicating whether we're running in the browser.
   *
   * @type {boolean}
   */
  browser: environment === 'browser',
  /**
   * Is it a desktop or laptop device.
   *
   * @type {boolean}
   */
  desktop: desktop,
  /**
   * Is it a mobile or tablet device.
   *
   * @type {boolean}
   */
  mobile: mobile,
  /**
   * If it is iOS.
   *
   * @type {boolean}
   */
  ios: ios,
  /**
   * If it is Android.
   *
   * @type {boolean}
   */
  android: android,
  /**
   * If it is Windows.
   *
   * @type {boolean}
   */
  windows: windows,
  /**
   * If it is Xbox.
   *
   * @type {boolean}
   */
  xbox: xbox,
  /**
   * If platform supports gamepads.
   *
   * @type {boolean}
   */
  gamepads: gamepads,
  /**
   * If platform supports touch input.
   *
   * @type {boolean}
   */
  touch: touch,
  /**
   * If the platform supports Web Workers.
   *
   * @type {boolean}
   */
  workers: workers,
  /**
   * If the platform supports an options object as the third parameter to
   * `EventTarget.addEventListener()` and the passive property is supported.
   *
   * @type {boolean}
   * @ignore
   */
  passiveEvents: passiveEvents
};

export { platform };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhdGZvcm0uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL3BsYXRmb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImxldCBkZXNrdG9wID0gZmFsc2U7XG5sZXQgbW9iaWxlID0gZmFsc2U7XG5sZXQgd2luZG93cyA9IGZhbHNlO1xubGV0IHhib3ggPSBmYWxzZTtcbmxldCBhbmRyb2lkID0gZmFsc2U7XG5sZXQgaW9zID0gZmFsc2U7XG5sZXQgdG91Y2ggPSBmYWxzZTtcbmxldCBnYW1lcGFkcyA9IGZhbHNlO1xubGV0IHdvcmtlcnMgPSBmYWxzZTtcbmxldCBwYXNzaXZlRXZlbnRzID0gZmFsc2U7XG5cbmlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykge1xuICAgIGNvbnN0IHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudDtcblxuICAgIGlmICgvKHdpbmRvd3N8bWFjIG9zfGxpbnV4fGNyb3MpL2kudGVzdCh1YSkpXG4gICAgICAgIGRlc2t0b3AgPSB0cnVlO1xuXG4gICAgaWYgKC94Ym94L2kudGVzdCh1YSkpXG4gICAgICAgIHhib3ggPSB0cnVlO1xuXG4gICAgaWYgKC8od2luZG93cyBwaG9uZXxpZW1vYmlsZXx3cGRlc2t0b3ApL2kudGVzdCh1YSkpIHtcbiAgICAgICAgZGVza3RvcCA9IGZhbHNlO1xuICAgICAgICBtb2JpbGUgPSB0cnVlO1xuICAgICAgICB3aW5kb3dzID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKC9hbmRyb2lkL2kudGVzdCh1YSkpIHtcbiAgICAgICAgZGVza3RvcCA9IGZhbHNlO1xuICAgICAgICBtb2JpbGUgPSB0cnVlO1xuICAgICAgICBhbmRyb2lkID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKC9pcChbYW9dZHxob25lKS9pLnRlc3QodWEpKSB7XG4gICAgICAgIGRlc2t0b3AgPSBmYWxzZTtcbiAgICAgICAgbW9iaWxlID0gdHJ1ZTtcbiAgICAgICAgaW9zID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdG91Y2ggPSAnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cgfHwgKCdtYXhUb3VjaFBvaW50cycgaW4gbmF2aWdhdG9yICYmIG5hdmlnYXRvci5tYXhUb3VjaFBvaW50cyA+IDApO1xuICAgIH1cblxuICAgIGdhbWVwYWRzID0gISFuYXZpZ2F0b3IuZ2V0R2FtZXBhZHMgfHwgISFuYXZpZ2F0b3Iud2Via2l0R2V0R2FtZXBhZHM7XG5cbiAgICB3b3JrZXJzID0gKHR5cGVvZiBXb3JrZXIgIT09ICd1bmRlZmluZWQnKTtcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG9wdHMgPSBPYmplY3QuZGVmaW5lUHJvcGVydHkoe30sICdwYXNzaXZlJywge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcGFzc2l2ZUV2ZW50cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Rlc3RwYXNzaXZlJywgbnVsbCwgb3B0cyk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd0ZXN0cGFzc2l2ZScsIG51bGwsIG9wdHMpO1xuICAgIH0gY2F0Y2ggKGUpIHt9XG59XG5cbi8vIGRldGVjdCBicm93c2VyL25vZGUgZW52aXJvbm1lbnRcbmNvbnN0IGVudmlyb25tZW50ID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/ICdicm93c2VyJyA6ICdub2RlJztcblxuLyoqXG4gKiBHbG9iYWwgbmFtZXNwYWNlIHRoYXQgc3RvcmVzIGZsYWdzIHJlZ2FyZGluZyBwbGF0Zm9ybSBlbnZpcm9ubWVudCBhbmQgZmVhdHVyZXMgc3VwcG9ydC5cbiAqXG4gKiBAbmFtZXNwYWNlXG4gKiBAZXhhbXBsZVxuICogaWYgKHBjLnBsYXRmb3JtLnRvdWNoKSB7XG4gKiAgICAgLy8gdG91Y2ggaXMgc3VwcG9ydGVkXG4gKiB9XG4gKi9cbmNvbnN0IHBsYXRmb3JtID0ge1xuICAgIC8qKlxuICAgICAqIFN0cmluZyBpZGVudGlmeWluZyB0aGUgY3VycmVudCBydW50aW1lIGVudmlyb25tZW50LiBFaXRoZXIgJ2Jyb3dzZXInIG9yICdub2RlJy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuXG4gICAgLyoqXG4gICAgICogVGhlIGdsb2JhbCBvYmplY3QuIFRoaXMgd2lsbCBiZSB0aGUgd2luZG93IG9iamVjdCB3aGVuIHJ1bm5pbmcgaW4gYSBicm93c2VyIGFuZCB0aGUgZ2xvYmFsXG4gICAgICogb2JqZWN0IHdoZW4gcnVubmluZyBpbiBub2RlanMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqL1xuICAgIGdsb2JhbDogKGVudmlyb25tZW50ID09PSAnYnJvd3NlcicpID8gd2luZG93IDogZ2xvYmFsLFxuXG4gICAgLyoqXG4gICAgICogQ29udmVuaWVuY2UgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgd2UncmUgcnVubmluZyBpbiB0aGUgYnJvd3Nlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGJyb3dzZXI6IGVudmlyb25tZW50ID09PSAnYnJvd3NlcicsXG5cbiAgICAvKipcbiAgICAgKiBJcyBpdCBhIGRlc2t0b3Agb3IgbGFwdG9wIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGRlc2t0b3A6IGRlc2t0b3AsXG5cbiAgICAvKipcbiAgICAgKiBJcyBpdCBhIG1vYmlsZSBvciB0YWJsZXQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbW9iaWxlOiBtb2JpbGUsXG5cbiAgICAvKipcbiAgICAgKiBJZiBpdCBpcyBpT1MuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBpb3M6IGlvcyxcblxuICAgIC8qKlxuICAgICAqIElmIGl0IGlzIEFuZHJvaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBhbmRyb2lkOiBhbmRyb2lkLFxuXG4gICAgLyoqXG4gICAgICogSWYgaXQgaXMgV2luZG93cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHdpbmRvd3M6IHdpbmRvd3MsXG5cbiAgICAvKipcbiAgICAgKiBJZiBpdCBpcyBYYm94LlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgeGJveDogeGJveCxcblxuICAgIC8qKlxuICAgICAqIElmIHBsYXRmb3JtIHN1cHBvcnRzIGdhbWVwYWRzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2FtZXBhZHM6IGdhbWVwYWRzLFxuXG4gICAgLyoqXG4gICAgICogSWYgcGxhdGZvcm0gc3VwcG9ydHMgdG91Y2ggaW5wdXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0b3VjaDogdG91Y2gsXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgcGxhdGZvcm0gc3VwcG9ydHMgV2ViIFdvcmtlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB3b3JrZXJzOiB3b3JrZXJzLFxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHBsYXRmb3JtIHN1cHBvcnRzIGFuIG9wdGlvbnMgb2JqZWN0IGFzIHRoZSB0aGlyZCBwYXJhbWV0ZXIgdG9cbiAgICAgKiBgRXZlbnRUYXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigpYCBhbmQgdGhlIHBhc3NpdmUgcHJvcGVydHkgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHBhc3NpdmVFdmVudHM6IHBhc3NpdmVFdmVudHNcbn07XG5cbmV4cG9ydCB7IHBsYXRmb3JtIH07XG4iXSwibmFtZXMiOlsiZGVza3RvcCIsIm1vYmlsZSIsIndpbmRvd3MiLCJ4Ym94IiwiYW5kcm9pZCIsImlvcyIsInRvdWNoIiwiZ2FtZXBhZHMiLCJ3b3JrZXJzIiwicGFzc2l2ZUV2ZW50cyIsIm5hdmlnYXRvciIsInVhIiwidXNlckFnZW50IiwidGVzdCIsIndpbmRvdyIsIm1heFRvdWNoUG9pbnRzIiwiZ2V0R2FtZXBhZHMiLCJ3ZWJraXRHZXRHYW1lcGFkcyIsIldvcmtlciIsIm9wdHMiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZSIsImVudmlyb25tZW50IiwicGxhdGZvcm0iLCJnbG9iYWwiLCJicm93c2VyIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBLElBQUlBLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDbkIsSUFBSUMsTUFBTSxHQUFHLEtBQUssQ0FBQTtBQUNsQixJQUFJQyxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQ25CLElBQUlDLElBQUksR0FBRyxLQUFLLENBQUE7QUFDaEIsSUFBSUMsT0FBTyxHQUFHLEtBQUssQ0FBQTtBQUNuQixJQUFJQyxHQUFHLEdBQUcsS0FBSyxDQUFBO0FBQ2YsSUFBSUMsS0FBSyxHQUFHLEtBQUssQ0FBQTtBQUNqQixJQUFJQyxRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ3BCLElBQUlDLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDbkIsSUFBSUMsYUFBYSxHQUFHLEtBQUssQ0FBQTtBQUV6QixJQUFJLE9BQU9DLFNBQVMsS0FBSyxXQUFXLEVBQUU7QUFDbEMsRUFBQSxNQUFNQyxFQUFFLEdBQUdELFNBQVMsQ0FBQ0UsU0FBUyxDQUFBO0VBRTlCLElBQUksOEJBQThCLENBQUNDLElBQUks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
