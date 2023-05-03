import { SceneParser } from '../parsers/scene.js';
import { SceneUtils } from './scene-utils.js';

class HierarchyHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  constructor(app) {
    this.handlerType = "hierarchy";
    this._app = app;
    this.maxRetries = 0;
  }
  load(url, callback) {
    SceneUtils.load(url, this.maxRetries, callback);
  }
  open(url, data) {
    // prevent script initialization until entire scene is open
    this._app.systems.script.preloading = true;
    const parser = new SceneParser(this._app, false);
    const parent = parser.parse(data);

    // re-enable script initialization
    this._app.systems.script.preloading = false;
    return parent;
  }
}

export { HierarchyHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGllcmFyY2h5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2hpZXJhcmNoeS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTY2VuZVBhcnNlciB9IGZyb20gJy4uL3BhcnNlcnMvc2NlbmUuanMnO1xuaW1wb3J0IHsgU2NlbmVVdGlscyB9IGZyb20gJy4vc2NlbmUtdXRpbHMuanMnO1xuXG5jbGFzcyBIaWVyYXJjaHlIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9IFwiaGllcmFyY2h5XCI7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSAwO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBTY2VuZVV0aWxzLmxvYWQodXJsLCB0aGlzLm1heFJldHJpZXMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBvcGVuKHVybCwgZGF0YSkge1xuICAgICAgICAvLyBwcmV2ZW50IHNjcmlwdCBpbml0aWFsaXphdGlvbiB1bnRpbCBlbnRpcmUgc2NlbmUgaXMgb3BlblxuICAgICAgICB0aGlzLl9hcHAuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgcGFyc2VyID0gbmV3IFNjZW5lUGFyc2VyKHRoaXMuX2FwcCwgZmFsc2UpO1xuICAgICAgICBjb25zdCBwYXJlbnQgPSBwYXJzZXIucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgLy8gcmUtZW5hYmxlIHNjcmlwdCBpbml0aWFsaXphdGlvblxuICAgICAgICB0aGlzLl9hcHAuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBwYXJlbnQ7XG4gICAgfVxufVxuXG5leHBvcnQgeyBIaWVyYXJjaHlIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiSGllcmFyY2h5SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaGFuZGxlclR5cGUiLCJfYXBwIiwibWF4UmV0cmllcyIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsIlNjZW5lVXRpbHMiLCJvcGVuIiwiZGF0YSIsInN5c3RlbXMiLCJzY3JpcHQiLCJwcmVsb2FkaW5nIiwicGFyc2VyIiwiU2NlbmVQYXJzZXIiLCJwYXJlbnQiLCJwYXJzZSJdLCJtYXBwaW5ncyI6Ijs7O0FBR0EsTUFBTUEsZ0JBQWdCLENBQUM7QUFDbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7RUFHSUMsV0FBV0EsQ0FBQ0MsR0FBRyxFQUFFO0lBQUEsSUFGakJDLENBQUFBLFdBQVcsR0FBRyxXQUFXLENBQUE7SUFHckIsSUFBSSxDQUFDQyxJQUFJLEdBQUdGLEdBQUcsQ0FBQTtJQUNmLElBQUksQ0FBQ0csVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUN2QixHQUFBO0FBRUFDLEVBQUFBLElBQUlBLENBQUNDLEdBQUcsRUFBRUMsUUFBUSxFQUFFO0lBQ2hCQyxVQUFVLENBQUNILElBQUksQ0FBQ0MsR0FBRyxFQUFFLElBQUksQ0FBQ0YsVUFBVSxFQUFFRyxRQUFRLENBQUMsQ0FBQTtBQUNuRCxHQUFBO0FBRUFFLEVBQUFBLElBQUlBLENBQUNILEdBQUcsRUFBRUksSUFBSSxFQUFFO0FBQ1o7SUFDQSxJQUFJLENBQUNQLElBQUksQ0FBQ1EsT0FBTyxDQUFDQyxNQUFNLENBQUNDLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFFMUMsTUFBTUMsTUFBTSxHQUFHLElBQUlDLFdBQVcsQ0FBQyxJQUFJLENBQUNaLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUNoRCxJQUFBLE1BQU1hLE1BQU0sR0FBR0YsTUFBTSxDQUFDRyxLQUFLLENBQUNQLElBQUksQ0FBQyxDQUFBOztBQUVqQztJQUNBLElBQUksQ0FBQ1AsSUFBSSxDQUFDUSxPQUFPLENBQUNDLE1BQU0sQ0FBQ0MsVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUUzQyxJQUFBLE9BQU9HLE1BQU0sQ0FBQTtBQUNqQixHQUFBO0FBQ0o7Ozs7In0=
