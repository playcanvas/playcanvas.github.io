/**
 * AnimEvents stores a sorted array of animation events which should fire sequentially during the
 * playback of an pc.AnimTrack.
 */
class AnimEvents {
  /**
   * Create a new AnimEvents instance.
   *
   * @param {object[]} events - An array of animation events.
   * @example
   * const events = new pc.AnimEvents([
   *     {
   *         name: 'my_event',
   *         time: 1.3, // given in seconds
   *         // any additional properties added are optional and will be available in the EventHandler callback's event object
   *         myProperty: 'test',
   *         myOtherProperty: true
   *     }
   * ]);
   * animTrack.events = events;
   */
  constructor(events) {
    this._events = [...events];
    this._events.sort((a, b) => a.time - b.time);
  }
  get events() {
    return this._events;
  }
}

export { AnimEvents };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1ldmVudHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmVudHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbmltRXZlbnRzIHN0b3JlcyBhIHNvcnRlZCBhcnJheSBvZiBhbmltYXRpb24gZXZlbnRzIHdoaWNoIHNob3VsZCBmaXJlIHNlcXVlbnRpYWxseSBkdXJpbmcgdGhlXG4gKiBwbGF5YmFjayBvZiBhbiBwYy5BbmltVHJhY2suXG4gKi9cbmNsYXNzIEFuaW1FdmVudHMge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltRXZlbnRzIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gZXZlbnRzIC0gQW4gYXJyYXkgb2YgYW5pbWF0aW9uIGV2ZW50cy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGV2ZW50cyA9IG5ldyBwYy5BbmltRXZlbnRzKFtcbiAgICAgKiAgICAge1xuICAgICAqICAgICAgICAgbmFtZTogJ215X2V2ZW50JyxcbiAgICAgKiAgICAgICAgIHRpbWU6IDEuMywgLy8gZ2l2ZW4gaW4gc2Vjb25kc1xuICAgICAqICAgICAgICAgLy8gYW55IGFkZGl0aW9uYWwgcHJvcGVydGllcyBhZGRlZCBhcmUgb3B0aW9uYWwgYW5kIHdpbGwgYmUgYXZhaWxhYmxlIGluIHRoZSBFdmVudEhhbmRsZXIgY2FsbGJhY2sncyBldmVudCBvYmplY3RcbiAgICAgKiAgICAgICAgIG15UHJvcGVydHk6ICd0ZXN0JyxcbiAgICAgKiAgICAgICAgIG15T3RoZXJQcm9wZXJ0eTogdHJ1ZVxuICAgICAqICAgICB9XG4gICAgICogXSk7XG4gICAgICogYW5pbVRyYWNrLmV2ZW50cyA9IGV2ZW50cztcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudHMpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRzID0gWy4uLmV2ZW50c107XG4gICAgICAgIHRoaXMuX2V2ZW50cy5zb3J0KChhLCBiKSA9PiBhLnRpbWUgLSBiLnRpbWUpO1xuICAgIH1cblxuICAgIGdldCBldmVudHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ldmVudHM7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltRXZlbnRzIH07XG4iXSwibmFtZXMiOlsiQW5pbUV2ZW50cyIsImNvbnN0cnVjdG9yIiwiZXZlbnRzIiwiX2V2ZW50cyIsInNvcnQiLCJhIiwiYiIsInRpbWUiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsVUFBVSxDQUFDO0FBQ2I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFO0FBQ2hCLElBQUEsSUFBSSxDQUFDQyxPQUFPLEdBQUcsQ0FBQyxHQUFHRCxNQUFNLENBQUMsQ0FBQTtBQUMxQixJQUFBLElBQUksQ0FBQ0MsT0FBTyxDQUFDQyxJQUFJLENBQUMsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEtBQUtELENBQUMsQ0FBQ0UsSUFBSSxHQUFHRCxDQUFDLENBQUNDLElBQUksQ0FBQyxDQUFBO0FBQ2hELEdBQUE7RUFFQSxJQUFJTCxNQUFNQSxHQUFHO0lBQ1QsT0FBTyxJQUFJLENBQUNDLE9BQU8sQ0FBQTtBQUN2QixHQUFBO0FBQ0o7Ozs7In0=
