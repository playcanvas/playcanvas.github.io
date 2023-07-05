import { platform } from '../../core/platform.js';

/**
 * DOM Overlay provides the ability to use DOM elements as an overlay in a WebXR AR session. It
 * requires that the root DOM element is provided for session start. That way, input source select
 * events are first tested against DOM Elements and then propagated down to the XR Session. If this
 * propagation is not desirable, use the `beforexrselect` event on a DOM element and the
 * `preventDefault` function to stop propagation.
 *
 * ```javascript
 * app.xr.domOverlay.root = element;
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
 * ```
 *
 * ```javascript
 * // Disable input source firing `select` event when some descendant element of DOM overlay root
 * // is touched/clicked. This is useful when the user interacts with UI elements and there should
 * // not be `select` events behind UI.
 * someElement.addEventListener('beforexrselect', function (evt) {
 *     evt.preventDefault();
 * });
 * ```
 */
class XrDomOverlay {
  /**
   * DOM Overlay provides the ability to use DOM elements as an overlay in a WebXR AR session. It
   * requires that the root DOM element is provided for session start. That way, input source
   * select events are first tested against DOM Elements and then propagated down to the XR
   * Session. If this propagation is not desirable, use the `beforexrselect` event on a DOM
   * element and the `preventDefault` function to stop propagation.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!window.XRDOMOverlayState;
    /**
     * @type {Element|null}
     * @private
     */
    this._root = null;
    this._manager = manager;
  }

  /**
   * True if DOM Overlay is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if DOM Overlay is available. It can only be available if it is supported, during a
   * valid WebXR session and if a valid root element is provided.
   *
   * @type {boolean}
   */
  get available() {
    return this._supported && this._manager.active && this._manager._session.domOverlayState !== null;
  }

  /**
   * State of the DOM Overlay, which defines how the root DOM element is rendered. Possible
   * options:
   *
   * - screen: Screen - indicates that the DOM element is covering whole physical screen,
   * matching XR viewports.
   * - floating: Floating - indicates that the underlying platform renders the DOM element as
   * floating in space, which can move during the WebXR session or allow the application to move
   * the element.
   * - head-locked: Head Locked - indicates that the DOM element follows the user's head movement
   * consistently, appearing similar to a helmet heads-up display.
   *
   * @type {string|null}
   */
  get state() {
    if (!this._supported || !this._manager.active || !this._manager._session.domOverlayState) return null;
    return this._manager._session.domOverlayState.type;
  }

  /**
   * The DOM element to be used as the root for DOM Overlay. Can be changed only outside of an
   * active WebXR session.
   *
   * @type {Element|null}
   * @example
   * app.xr.domOverlay.root = element;
   * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
   */
  set root(value) {
    if (!this._supported || this._manager.active) return;
    this._root = value;
  }
  get root() {
    return this._root;
  }
}

export { XrDomOverlay };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItZG9tLW92ZXJsYXkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItZG9tLW92ZXJsYXkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcblxuLyoqXG4gKiBET00gT3ZlcmxheSBwcm92aWRlcyB0aGUgYWJpbGl0eSB0byB1c2UgRE9NIGVsZW1lbnRzIGFzIGFuIG92ZXJsYXkgaW4gYSBXZWJYUiBBUiBzZXNzaW9uLiBJdFxuICogcmVxdWlyZXMgdGhhdCB0aGUgcm9vdCBET00gZWxlbWVudCBpcyBwcm92aWRlZCBmb3Igc2Vzc2lvbiBzdGFydC4gVGhhdCB3YXksIGlucHV0IHNvdXJjZSBzZWxlY3RcbiAqIGV2ZW50cyBhcmUgZmlyc3QgdGVzdGVkIGFnYWluc3QgRE9NIEVsZW1lbnRzIGFuZCB0aGVuIHByb3BhZ2F0ZWQgZG93biB0byB0aGUgWFIgU2Vzc2lvbi4gSWYgdGhpc1xuICogcHJvcGFnYXRpb24gaXMgbm90IGRlc2lyYWJsZSwgdXNlIHRoZSBgYmVmb3JleHJzZWxlY3RgIGV2ZW50IG9uIGEgRE9NIGVsZW1lbnQgYW5kIHRoZVxuICogYHByZXZlbnREZWZhdWx0YCBmdW5jdGlvbiB0byBzdG9wIHByb3BhZ2F0aW9uLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGFwcC54ci5kb21PdmVybGF5LnJvb3QgPSBlbGVtZW50O1xuICogYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX0FSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IpO1xuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gRGlzYWJsZSBpbnB1dCBzb3VyY2UgZmlyaW5nIGBzZWxlY3RgIGV2ZW50IHdoZW4gc29tZSBkZXNjZW5kYW50IGVsZW1lbnQgb2YgRE9NIG92ZXJsYXkgcm9vdFxuICogLy8gaXMgdG91Y2hlZC9jbGlja2VkLiBUaGlzIGlzIHVzZWZ1bCB3aGVuIHRoZSB1c2VyIGludGVyYWN0cyB3aXRoIFVJIGVsZW1lbnRzIGFuZCB0aGVyZSBzaG91bGRcbiAqIC8vIG5vdCBiZSBgc2VsZWN0YCBldmVudHMgYmVoaW5kIFVJLlxuICogc29tZUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JleHJzZWxlY3QnLCBmdW5jdGlvbiAoZXZ0KSB7XG4gKiAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gKiB9KTtcbiAqIGBgYFxuICovXG5jbGFzcyBYckRvbU92ZXJsYXkge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5YUkRPTU92ZXJsYXlTdGF0ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm9vdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBET00gT3ZlcmxheSBwcm92aWRlcyB0aGUgYWJpbGl0eSB0byB1c2UgRE9NIGVsZW1lbnRzIGFzIGFuIG92ZXJsYXkgaW4gYSBXZWJYUiBBUiBzZXNzaW9uLiBJdFxuICAgICAqIHJlcXVpcmVzIHRoYXQgdGhlIHJvb3QgRE9NIGVsZW1lbnQgaXMgcHJvdmlkZWQgZm9yIHNlc3Npb24gc3RhcnQuIFRoYXQgd2F5LCBpbnB1dCBzb3VyY2VcbiAgICAgKiBzZWxlY3QgZXZlbnRzIGFyZSBmaXJzdCB0ZXN0ZWQgYWdhaW5zdCBET00gRWxlbWVudHMgYW5kIHRoZW4gcHJvcGFnYXRlZCBkb3duIHRvIHRoZSBYUlxuICAgICAqIFNlc3Npb24uIElmIHRoaXMgcHJvcGFnYXRpb24gaXMgbm90IGRlc2lyYWJsZSwgdXNlIHRoZSBgYmVmb3JleHJzZWxlY3RgIGV2ZW50IG9uIGEgRE9NXG4gICAgICogZWxlbWVudCBhbmQgdGhlIGBwcmV2ZW50RGVmYXVsdGAgZnVuY3Rpb24gdG8gc3RvcCBwcm9wYWdhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9IG1hbmFnZXIgLSBXZWJYUiBNYW5hZ2VyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgRE9NIE92ZXJsYXkgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIERPTSBPdmVybGF5IGlzIGF2YWlsYWJsZS4gSXQgY2FuIG9ubHkgYmUgYXZhaWxhYmxlIGlmIGl0IGlzIHN1cHBvcnRlZCwgZHVyaW5nIGFcbiAgICAgKiB2YWxpZCBXZWJYUiBzZXNzaW9uIGFuZCBpZiBhIHZhbGlkIHJvb3QgZWxlbWVudCBpcyBwcm92aWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBhdmFpbGFibGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdXBwb3J0ZWQgJiYgdGhpcy5fbWFuYWdlci5hY3RpdmUgJiYgdGhpcy5fbWFuYWdlci5fc2Vzc2lvbi5kb21PdmVybGF5U3RhdGUgIT09IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhdGUgb2YgdGhlIERPTSBPdmVybGF5LCB3aGljaCBkZWZpbmVzIGhvdyB0aGUgcm9vdCBET00gZWxlbWVudCBpcyByZW5kZXJlZC4gUG9zc2libGVcbiAgICAgKiBvcHRpb25zOlxuICAgICAqXG4gICAgICogLSBzY3JlZW46IFNjcmVlbiAtIGluZGljYXRlcyB0aGF0IHRoZSBET00gZWxlbWVudCBpcyBjb3ZlcmluZyB3aG9sZSBwaHlzaWNhbCBzY3JlZW4sXG4gICAgICogbWF0Y2hpbmcgWFIgdmlld3BvcnRzLlxuICAgICAqIC0gZmxvYXRpbmc6IEZsb2F0aW5nIC0gaW5kaWNhdGVzIHRoYXQgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0gcmVuZGVycyB0aGUgRE9NIGVsZW1lbnQgYXNcbiAgICAgKiBmbG9hdGluZyBpbiBzcGFjZSwgd2hpY2ggY2FuIG1vdmUgZHVyaW5nIHRoZSBXZWJYUiBzZXNzaW9uIG9yIGFsbG93IHRoZSBhcHBsaWNhdGlvbiB0byBtb3ZlXG4gICAgICogdGhlIGVsZW1lbnQuXG4gICAgICogLSBoZWFkLWxvY2tlZDogSGVhZCBMb2NrZWQgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgRE9NIGVsZW1lbnQgZm9sbG93cyB0aGUgdXNlcidzIGhlYWQgbW92ZW1lbnRcbiAgICAgKiBjb25zaXN0ZW50bHksIGFwcGVhcmluZyBzaW1pbGFyIHRvIGEgaGVsbWV0IGhlYWRzLXVwIGRpc3BsYXkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHN0YXRlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3N1cHBvcnRlZCB8fCAhdGhpcy5fbWFuYWdlci5hY3RpdmUgfHwgIXRoaXMuX21hbmFnZXIuX3Nlc3Npb24uZG9tT3ZlcmxheVN0YXRlKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX21hbmFnZXIuX3Nlc3Npb24uZG9tT3ZlcmxheVN0YXRlLnR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIERPTSBlbGVtZW50IHRvIGJlIHVzZWQgYXMgdGhlIHJvb3QgZm9yIERPTSBPdmVybGF5LiBDYW4gYmUgY2hhbmdlZCBvbmx5IG91dHNpZGUgb2YgYW5cbiAgICAgKiBhY3RpdmUgV2ViWFIgc2Vzc2lvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fG51bGx9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuZG9tT3ZlcmxheS5yb290ID0gZWxlbWVudDtcbiAgICAgKiBhcHAueHIuc3RhcnQoY2FtZXJhLCBwYy5YUlRZUEVfQVIsIHBjLlhSU1BBQ0VfTE9DQUxGTE9PUik7XG4gICAgICovXG4gICAgc2V0IHJvb3QodmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdXBwb3J0ZWQgfHwgdGhpcy5fbWFuYWdlci5hY3RpdmUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcm9vdCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCByb290KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm9vdDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyRG9tT3ZlcmxheSB9O1xuIl0sIm5hbWVzIjpbIlhyRG9tT3ZlcmxheSIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsIl9tYW5hZ2VyIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSRE9NT3ZlcmxheVN0YXRlIiwiX3Jvb3QiLCJzdXBwb3J0ZWQiLCJhdmFpbGFibGUiLCJhY3RpdmUiLCJfc2Vzc2lvbiIsImRvbU92ZXJsYXlTdGF0ZSIsInN0YXRlIiwidHlwZSIsInJvb3QiLCJ2YWx1ZSJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxZQUFZLENBQUM7QUFtQmY7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsT0FBTyxFQUFFO0FBNUJyQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFVBQVUsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBQyxDQUFDQyxNQUFNLENBQUNDLGlCQUFpQixDQUFBO0FBRTNEO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtJQWFSLElBQUksQ0FBQ04sUUFBUSxHQUFHRCxPQUFPLENBQUE7QUFDM0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSVEsU0FBU0EsR0FBRztJQUNaLE9BQU8sSUFBSSxDQUFDTixVQUFVLENBQUE7QUFDMUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJTyxTQUFTQSxHQUFHO0FBQ1osSUFBQSxPQUFPLElBQUksQ0FBQ1AsVUFBVSxJQUFJLElBQUksQ0FBQ0QsUUFBUSxDQUFDUyxNQUFNLElBQUksSUFBSSxDQUFDVCxRQUFRLENBQUNVLFFBQVEsQ0FBQ0MsZUFBZSxLQUFLLElBQUksQ0FBQTtBQUNyRyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJQyxLQUFLQSxHQUFHO0lBQ1IsSUFBSSxDQUFDLElBQUksQ0FBQ1gsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDRCxRQUFRLENBQUNTLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQ1QsUUFBUSxDQUFDVSxRQUFRLENBQUNDLGVBQWUsRUFDcEYsT0FBTyxJQUFJLENBQUE7SUFFZixPQUFPLElBQUksQ0FBQ1gsUUFBUSxDQUFDVSxRQUFRLENBQUNDLGVBQWUsQ0FBQ0UsSUFBSSxDQUFBO0FBQ3RELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsSUFBSUEsQ0FBQ0MsS0FBSyxFQUFFO0lBQ1osSUFBSSxDQUFDLElBQUksQ0FBQ2QsVUFBVSxJQUFJLElBQUksQ0FBQ0QsUUFBUSxDQUFDUyxNQUFNLEVBQ3hDLE9BQUE7SUFFSixJQUFJLENBQUNILEtBQUssR0FBR1MsS0FBSyxDQUFBO0FBQ3RCLEdBQUE7RUFFQSxJQUFJRCxJQUFJQSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUNSLEtBQUssQ0FBQTtBQUNyQixHQUFBO0FBQ0o7Ozs7In0=
