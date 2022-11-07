/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class AppOptions {
  constructor() {
    this.elementInput = void 0;
    this.keyboard = void 0;
    this.mouse = void 0;
    this.touch = void 0;
    this.gamepads = void 0;
    this.scriptPrefix = void 0;
    this.assetPrefix = void 0;
    this.scriptsOrder = void 0;
    this.soundManager = void 0;
    this.graphicsDevice = void 0;
    this.lightmapper = void 0;
    this.batchManager = void 0;
    this.xr = void 0;
    this.componentSystems = [];
    this.resourceHandlers = [];
  }
}

export { AppOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLW9wdGlvbnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLW9wdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9oYW5kbGVycy9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyfSBSZXNvdXJjZUhhbmRsZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50SW5wdXR9IEVsZW1lbnRJbnB1dCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2dhbWUtcGFkcy5qcycpLkdhbWVQYWRzfSBHYW1lUGFkcyAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLmpzJykuS2V5Ym9hcmR9IEtleWJvYXJkICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnKS5Nb3VzZX0gTW91c2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnKS5Ub3VjaERldmljZX0gVG91Y2hEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfSBTb3VuZE1hbmFnZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2xpZ2h0bWFwcGVyL2xpZ2h0bWFwcGVyLmpzJykuTGlnaHRtYXBwZXJ9IExpZ2h0bWFwcGVyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtbWFuYWdlci5qcycpLkJhdGNoTWFuYWdlcn0gQmF0Y2hNYW5hZ2VyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9jb21wb25lbnRzL3N5c3RlbS5qcycpLkNvbXBvbmVudFN5c3RlbX0gQ29tcG9uZW50U3lzdGVtICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi94ci94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfSBYck1hbmFnZXIgKi9cblxuY2xhc3MgQXBwT3B0aW9ucyB7XG4gICAgLyoqXG4gICAgICogSW5wdXQgaGFuZGxlciBmb3Ige0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbGVtZW50SW5wdXR9XG4gICAgICovXG4gICAgZWxlbWVudElucHV0O1xuXG4gICAgLyoqXG4gICAgICogS2V5Ym9hcmQgaGFuZGxlciBmb3IgaW5wdXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7S2V5Ym9hcmR9XG4gICAgICovXG4gICAga2V5Ym9hcmQ7XG5cbiAgICAvKipcbiAgICAgKiBNb3VzZSBoYW5kbGVyIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNb3VzZX1cbiAgICAgKi9cbiAgICBtb3VzZTtcblxuICAgIC8qKlxuICAgICAqIFRvdWNoRGV2aWNlIGhhbmRsZXIgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHR5cGUge1RvdWNoRGV2aWNlfVxuICAgICAqL1xuICAgIHRvdWNoO1xuXG4gICAgLyoqXG4gICAgICogR2FtZXBhZCBoYW5kbGVyIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHYW1lUGFkc31cbiAgICAgKi9cbiAgICBnYW1lcGFkcztcblxuICAgIC8qKlxuICAgICAqIFByZWZpeCB0byBhcHBseSB0byBzY3JpcHQgdXJscyBiZWZvcmUgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2NyaXB0UHJlZml4O1xuXG4gICAgLyoqXG4gICAgICogUHJlZml4IHRvIGFwcGx5IHRvIGFzc2V0IHVybHMgYmVmb3JlIGxvYWRpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGFzc2V0UHJlZml4O1xuXG4gICAgLyoqXG4gICAgICogU2NyaXB0cyBpbiBvcmRlciBvZiBsb2FkaW5nIGZpcnN0LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ1tdfVxuICAgICAqL1xuICAgIHNjcmlwdHNPcmRlcjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzb3VuZCBtYW5hZ2VyXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U291bmRNYW5hZ2VyfVxuICAgICAqL1xuICAgIHNvdW5kTWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R3JhcGhpY3NEZXZpY2V9XG4gICAgICovXG4gICAgZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGlnaHRtYXBwZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TGlnaHRtYXBwZXJ9XG4gICAgICovXG4gICAgbGlnaHRtYXBwZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgQmF0Y2hNYW5hZ2VyLlxuICAgICAqXG4gICAgICogQHR5cGUge0JhdGNoTWFuYWdlcn1cbiAgICAgKi9cbiAgICBiYXRjaE1hbmFnZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgWHJNYW5hZ2VyLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTWFuYWdlcn1cbiAgICAgKi9cbiAgICB4cjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb21wb25lbnQgc3lzdGVtcyB0aGUgYXBwIHJlcXVpcmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbXBvbmVudFN5c3RlbVtdfVxuICAgICAqL1xuICAgIGNvbXBvbmVudFN5c3RlbXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXNvdXJjZSBoYW5kbGVycyB0aGUgYXBwIHJlcXVpcmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1Jlc291cmNlSGFuZGxlcltdfVxuICAgICAqL1xuICAgIHJlc291cmNlSGFuZGxlcnMgPSBbXTtcbn1cblxuZXhwb3J0IHsgQXBwT3B0aW9ucyB9O1xuIl0sIm5hbWVzIjpbIkFwcE9wdGlvbnMiLCJlbGVtZW50SW5wdXQiLCJrZXlib2FyZCIsIm1vdXNlIiwidG91Y2giLCJnYW1lcGFkcyIsInNjcmlwdFByZWZpeCIsImFzc2V0UHJlZml4Iiwic2NyaXB0c09yZGVyIiwic291bmRNYW5hZ2VyIiwiZ3JhcGhpY3NEZXZpY2UiLCJsaWdodG1hcHBlciIsImJhdGNoTWFuYWdlciIsInhyIiwiY29tcG9uZW50U3lzdGVtcyIsInJlc291cmNlSGFuZGxlcnMiXSwibWFwcGluZ3MiOiI7Ozs7O0FBYUEsTUFBTUEsVUFBVSxDQUFDO0FBQUEsRUFBQSxXQUFBLEdBQUE7QUFBQSxJQUFBLElBQUEsQ0FNYkMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT1pDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9SQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPTEMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT0xDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9SQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPWkMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT1hDLFlBQVksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9aQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPWkMsY0FBYyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT2RDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9YQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPWkMsRUFBRSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUFPRkMsQ0FBQUEsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0lBQUEsSUFPckJDLENBQUFBLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtBQUFBLEdBQUE7QUFDekI7Ozs7In0=