class AppOptions {
  constructor() {
    /**
     * Input handler for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.js').ElementInput}
     */
    this.elementInput = void 0;
    /**
     * Keyboard handler for input.
     *
     * @type {import('../platform/input/keyboard.js').Keyboard}
     */
    this.keyboard = void 0;
    /**
     * Mouse handler for input.
     *
     * @type {import('../platform/input/mouse.js').Mouse}
     */
    this.mouse = void 0;
    /**
     * TouchDevice handler for input.
     *
     * @type {import('../platform/input/touch-device.js').TouchDevice}
     */
    this.touch = void 0;
    /**
     * Gamepad handler for input.
     *
     * @type {import('../platform/input/game-pads.js').GamePads}
     */
    this.gamepads = void 0;
    /**
     * Prefix to apply to script urls before loading.
     *
     * @type {string}
     */
    this.scriptPrefix = void 0;
    /**
     * Prefix to apply to asset urls before loading.
     *
     * @type {string}
     */
    this.assetPrefix = void 0;
    /**
     * Scripts in order of loading first.
     *
     * @type {string[]}
     */
    this.scriptsOrder = void 0;
    /**
     * The sound manager
     *
     * @type {import('../platform/sound/manager.js').SoundManager}
     */
    this.soundManager = void 0;
    /**
     * The graphics device.
     *
     * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.graphicsDevice = void 0;
    /**
     * The lightmapper.
     *
     * @type {import('./lightmapper/lightmapper.js').Lightmapper}
     */
    this.lightmapper = void 0;
    /**
     * The BatchManager.
     *
     * @type {import('../scene/batching/batch-manager.js').BatchManager}
     */
    this.batchManager = void 0;
    /**
     * The XrManager.
     *
     * @type {import('./xr/xr-manager.js').XrManager}
     */
    this.xr = void 0;
    /**
     * The component systems the app requires.
     *
     * @type {import('./components/system.js').ComponentSystem[]}
     */
    this.componentSystems = [];
    /**
     * The resource handlers the app requires.
     *
     * @type {import('./handlers/handler.js').ResourceHandler[]}
     */
    this.resourceHandlers = [];
  }
}

export { AppOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLW9wdGlvbnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLW9wdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY2xhc3MgQXBwT3B0aW9ucyB7XG4gICAgLyoqXG4gICAgICogSW5wdXQgaGFuZGxlciBmb3Ige0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcycpLkVsZW1lbnRJbnB1dH1cbiAgICAgKi9cbiAgICBlbGVtZW50SW5wdXQ7XG5cbiAgICAvKipcbiAgICAgKiBLZXlib2FyZCBoYW5kbGVyIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLmpzJykuS2V5Ym9hcmR9XG4gICAgICovXG4gICAga2V5Ym9hcmQ7XG5cbiAgICAvKipcbiAgICAgKiBNb3VzZSBoYW5kbGVyIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L21vdXNlLmpzJykuTW91c2V9XG4gICAgICovXG4gICAgbW91c2U7XG5cbiAgICAvKipcbiAgICAgKiBUb3VjaERldmljZSBoYW5kbGVyIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L3RvdWNoLWRldmljZS5qcycpLlRvdWNoRGV2aWNlfVxuICAgICAqL1xuICAgIHRvdWNoO1xuXG4gICAgLyoqXG4gICAgICogR2FtZXBhZCBoYW5kbGVyIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2dhbWUtcGFkcy5qcycpLkdhbWVQYWRzfVxuICAgICAqL1xuICAgIGdhbWVwYWRzO1xuXG4gICAgLyoqXG4gICAgICogUHJlZml4IHRvIGFwcGx5IHRvIHNjcmlwdCB1cmxzIGJlZm9yZSBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzY3JpcHRQcmVmaXg7XG5cbiAgICAvKipcbiAgICAgKiBQcmVmaXggdG8gYXBwbHkgdG8gYXNzZXQgdXJscyBiZWZvcmUgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgYXNzZXRQcmVmaXg7XG5cbiAgICAvKipcbiAgICAgKiBTY3JpcHRzIGluIG9yZGVyIG9mIGxvYWRpbmcgZmlyc3QuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nW119XG4gICAgICovXG4gICAgc2NyaXB0c09yZGVyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNvdW5kIG1hbmFnZXJcbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL3NvdW5kL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9XG4gICAgICovXG4gICAgc291bmRNYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfVxuICAgICAqL1xuICAgIGdyYXBoaWNzRGV2aWNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGxpZ2h0bWFwcGVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodG1hcHBlci9saWdodG1hcHBlci5qcycpLkxpZ2h0bWFwcGVyfVxuICAgICAqL1xuICAgIGxpZ2h0bWFwcGVyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIEJhdGNoTWFuYWdlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMnKS5CYXRjaE1hbmFnZXJ9XG4gICAgICovXG4gICAgYmF0Y2hNYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIFhyTWFuYWdlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHIveHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgKi9cbiAgICB4cjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb21wb25lbnQgc3lzdGVtcyB0aGUgYXBwIHJlcXVpcmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb25lbnRzL3N5c3RlbS5qcycpLkNvbXBvbmVudFN5c3RlbVtdfVxuICAgICAqL1xuICAgIGNvbXBvbmVudFN5c3RlbXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNvdXJjZSBoYW5kbGVycyB0aGUgYXBwIHJlcXVpcmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9oYW5kbGVycy9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyW119XG4gICAgICovXG4gICAgcmVzb3VyY2VIYW5kbGVycyA9IFtdO1xufVxuXG5leHBvcnQgeyBBcHBPcHRpb25zIH07XG4iXSwibmFtZXMiOlsiQXBwT3B0aW9ucyIsImNvbnN0cnVjdG9yIiwiZWxlbWVudElucHV0Iiwia2V5Ym9hcmQiLCJtb3VzZSIsInRvdWNoIiwiZ2FtZXBhZHMiLCJzY3JpcHRQcmVmaXgiLCJhc3NldFByZWZpeCIsInNjcmlwdHNPcmRlciIsInNvdW5kTWFuYWdlciIsImdyYXBoaWNzRGV2aWNlIiwibGlnaHRtYXBwZXIiLCJiYXRjaE1hbmFnZXIiLCJ4ciIsImNvbXBvbmVudFN5c3RlbXMiLCJyZXNvdXJjZUhhbmRsZXJzIl0sIm1hcHBpbmdzIjoiQUFBQSxNQUFNQSxVQUFVLENBQUM7RUFBQUMsV0FBQSxHQUFBO0FBQ2I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVSO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUw7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVSO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFlBQVksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVaO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxjQUFjLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFZDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVo7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxFQUFFLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFRjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0FBRXJCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxnQkFBZ0IsR0FBRyxFQUFFLENBQUE7QUFBQSxHQUFBO0FBQ3pCOzs7OyJ9
