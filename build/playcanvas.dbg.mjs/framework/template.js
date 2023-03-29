/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { SceneParser } from './parsers/scene.js';

/**
 * Create a Template resource from raw database data.
 */
class Template {
  /**
   * Create a new Template instance.
   *
   * @param {import('./app-base.js').AppBase} app - The application.
   * @param {object} data - Asset data from the database.
   */
  constructor(app, data) {
    this._app = app;
    this._data = data;
    this._templateRoot = null;
  }

  /**
   * Create an instance of this template.
   *
   * @returns {import('./entity.js').Entity} The root entity of the created instance.
   */
  instantiate() {
    if (!this._templateRoot) {
      // at first use, after scripts are loaded
      this._parseTemplate();
    }
    return this._templateRoot.clone();
  }
  _parseTemplate() {
    const parser = new SceneParser(this._app, true);
    this._templateRoot = parser.parse(this._data);
  }
}

export { Template };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvdGVtcGxhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU2NlbmVQYXJzZXIgfSBmcm9tICcuL3BhcnNlcnMvc2NlbmUuanMnO1xuXG4vKipcbiAqIENyZWF0ZSBhIFRlbXBsYXRlIHJlc291cmNlIGZyb20gcmF3IGRhdGFiYXNlIGRhdGEuXG4gKi9cbmNsYXNzIFRlbXBsYXRlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVGVtcGxhdGUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIEFzc2V0IGRhdGEgZnJvbSB0aGUgZGF0YWJhc2UuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwLCBkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FwcCA9IGFwcDtcblxuICAgICAgICB0aGlzLl9kYXRhID0gZGF0YTtcblxuICAgICAgICB0aGlzLl90ZW1wbGF0ZVJvb3QgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiB0aGlzIHRlbXBsYXRlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi9lbnRpdHkuanMnKS5FbnRpdHl9IFRoZSByb290IGVudGl0eSBvZiB0aGUgY3JlYXRlZCBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBpbnN0YW50aWF0ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl90ZW1wbGF0ZVJvb3QpIHsgLy8gYXQgZmlyc3QgdXNlLCBhZnRlciBzY3JpcHRzIGFyZSBsb2FkZWRcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGVtcGxhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl90ZW1wbGF0ZVJvb3QuY2xvbmUoKTtcbiAgICB9XG5cbiAgICBfcGFyc2VUZW1wbGF0ZSgpIHtcbiAgICAgICAgY29uc3QgcGFyc2VyID0gbmV3IFNjZW5lUGFyc2VyKHRoaXMuX2FwcCwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5fdGVtcGxhdGVSb290ID0gcGFyc2VyLnBhcnNlKHRoaXMuX2RhdGEpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgVGVtcGxhdGUgfTtcbiJdLCJuYW1lcyI6WyJUZW1wbGF0ZSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiZGF0YSIsIl9hcHAiLCJfZGF0YSIsIl90ZW1wbGF0ZVJvb3QiLCJpbnN0YW50aWF0ZSIsIl9wYXJzZVRlbXBsYXRlIiwiY2xvbmUiLCJwYXJzZXIiLCJTY2VuZVBhcnNlciIsInBhcnNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsUUFBUSxDQUFDO0FBQ1g7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsR0FBRyxFQUFFQyxJQUFJLEVBQUU7SUFDbkIsSUFBSSxDQUFDQyxJQUFJLEdBQUdGLEdBQUcsQ0FBQTtJQUVmLElBQUksQ0FBQ0csS0FBSyxHQUFHRixJQUFJLENBQUE7SUFFakIsSUFBSSxDQUFDRyxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXLEdBQUc7QUFDVixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNELGFBQWEsRUFBRTtBQUFFO01BQ3ZCLElBQUksQ0FBQ0UsY0FBYyxFQUFFLENBQUE7QUFDekIsS0FBQTtBQUVBLElBQUEsT0FBTyxJQUFJLENBQUNGLGFBQWEsQ0FBQ0csS0FBSyxFQUFFLENBQUE7QUFDckMsR0FBQTtBQUVBRCxFQUFBQSxjQUFjLEdBQUc7SUFDYixNQUFNRSxNQUFNLEdBQUcsSUFBSUMsV0FBVyxDQUFDLElBQUksQ0FBQ1AsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBRS9DLElBQUksQ0FBQ0UsYUFBYSxHQUFHSSxNQUFNLENBQUNFLEtBQUssQ0FBQyxJQUFJLENBQUNQLEtBQUssQ0FBQyxDQUFBO0FBQ2pELEdBQUE7QUFDSjs7OzsifQ==
