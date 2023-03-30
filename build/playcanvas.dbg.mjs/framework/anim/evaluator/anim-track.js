/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { AnimEvents } from './anim-events.js';

/**
 * An AnimTrack stores the curve data necessary to animate a set of target nodes. It can be linked
 * to the nodes it should animate using the {@link AnimComponent#assignAnimation} method.
 */
class AnimTrack {
  /**
   * This AnimTrack can be used as a placeholder track when creating a state graph before having all associated animation data available.
   *
   * @type {AnimTrack}
   */

  /**
   * Create a new AnimTrack instance.
   *
   * @param {string} name - The track name.
   * @param {number} duration - The duration of the track in seconds.
   * @param {import('./anim-data.js').AnimData[]} inputs - List of curve key data.
   * @param {import('./anim-data.js').AnimData[]} outputs - List of curve value data.
   * @param {import('./anim-curve.js').AnimCurve[]} curves - The list of curves.
   * @param {AnimEvents} animEvents - A sequence of animation events.
   * @hideconstructor
   */
  constructor(name, duration, inputs, outputs, curves, animEvents = new AnimEvents([])) {
    this._name = name;
    this._duration = duration;
    this._inputs = inputs;
    this._outputs = outputs;
    this._curves = curves;
    this._animEvents = animEvents;
  }

  /**
   * Gets the name of the AnimTrack.
   *
   * @type {string}
   */
  get name() {
    return this._name;
  }

  /**
   * Gets the duration of the AnimTrack.
   *
   * @type {number}
   */
  get duration() {
    return this._duration;
  }

  /**
   * Gets the list of curve key data contained in the AnimTrack.
   *
   * @type {import('./anim-data.js').AnimData[]}
   */
  get inputs() {
    return this._inputs;
  }

  /**
   * Gets the list of curve values contained in the AnimTrack.
   *
   * @type {import('./anim-data.js').AnimData[]}
   */
  get outputs() {
    return this._outputs;
  }

  /**
   * Gets the list of curves contained in the AnimTrack.
   *
   * @type {import('./anim-curve.js').AnimCurve[]}
   */
  get curves() {
    return this._curves;
  }

  /**
   * The animation events that will fire during the playback of this anim track.
   *
   * @type {AnimEvents}
   */
  set events(animEvents) {
    this._animEvents = animEvents;
  }
  get events() {
    return this._animEvents.events;
  }

  // evaluate all track curves at the specified time and store results
  // in the provided snapshot.
  eval(time, snapshot) {
    snapshot._time = time;
    const inputs = this._inputs;
    const outputs = this._outputs;
    const curves = this._curves;
    const cache = snapshot._cache;
    const results = snapshot._results;

    // evaluate inputs
    for (let i = 0; i < inputs.length; ++i) {
      cache[i].update(time, inputs[i]._data);
    }

    // evaluate outputs
    for (let i = 0; i < curves.length; ++i) {
      const curve = curves[i];
      const output = outputs[curve._output];
      const result = results[i];
      cache[curve._input].eval(result, curve._interpolation, output);
    }
  }
}
AnimTrack.EMPTY = Object.freeze(new AnimTrack('empty', Number.MAX_VALUE, [], [], []));

export { AnimTrack };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS10cmFjay5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFuaW1FdmVudHMgfSBmcm9tICcuL2FuaW0tZXZlbnRzLmpzJztcblxuLyoqXG4gKiBBbiBBbmltVHJhY2sgc3RvcmVzIHRoZSBjdXJ2ZSBkYXRhIG5lY2Vzc2FyeSB0byBhbmltYXRlIGEgc2V0IG9mIHRhcmdldCBub2Rlcy4gSXQgY2FuIGJlIGxpbmtlZFxuICogdG8gdGhlIG5vZGVzIGl0IHNob3VsZCBhbmltYXRlIHVzaW5nIHRoZSB7QGxpbmsgQW5pbUNvbXBvbmVudCNhc3NpZ25BbmltYXRpb259IG1ldGhvZC5cbiAqL1xuY2xhc3MgQW5pbVRyYWNrIHtcbiAgICAvKipcbiAgICAgKiBUaGlzIEFuaW1UcmFjayBjYW4gYmUgdXNlZCBhcyBhIHBsYWNlaG9sZGVyIHRyYWNrIHdoZW4gY3JlYXRpbmcgYSBzdGF0ZSBncmFwaCBiZWZvcmUgaGF2aW5nIGFsbCBhc3NvY2lhdGVkIGFuaW1hdGlvbiBkYXRhIGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBbmltVHJhY2t9XG4gICAgICovXG4gICAgc3RhdGljIEVNUFRZID0gT2JqZWN0LmZyZWV6ZShuZXcgQW5pbVRyYWNrKCdlbXB0eScsIE51bWJlci5NQVhfVkFMVUUsIFtdLCBbXSwgW10pKTtcblxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFuaW1UcmFjayBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIHRyYWNrIG5hbWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uIC0gVGhlIGR1cmF0aW9uIG9mIHRoZSB0cmFjayBpbiBzZWNvbmRzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2FuaW0tZGF0YS5qcycpLkFuaW1EYXRhW119IGlucHV0cyAtIExpc3Qgb2YgY3VydmUga2V5IGRhdGEuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYW5pbS1kYXRhLmpzJykuQW5pbURhdGFbXX0gb3V0cHV0cyAtIExpc3Qgb2YgY3VydmUgdmFsdWUgZGF0YS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hbmltLWN1cnZlLmpzJykuQW5pbUN1cnZlW119IGN1cnZlcyAtIFRoZSBsaXN0IG9mIGN1cnZlcy5cbiAgICAgKiBAcGFyYW0ge0FuaW1FdmVudHN9IGFuaW1FdmVudHMgLSBBIHNlcXVlbmNlIG9mIGFuaW1hdGlvbiBldmVudHMuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUsIGR1cmF0aW9uLCBpbnB1dHMsIG91dHB1dHMsIGN1cnZlcywgYW5pbUV2ZW50cyA9IG5ldyBBbmltRXZlbnRzKFtdKSkge1xuICAgICAgICB0aGlzLl9uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgICAgdGhpcy5faW5wdXRzID0gaW5wdXRzO1xuICAgICAgICB0aGlzLl9vdXRwdXRzID0gb3V0cHV0cztcbiAgICAgICAgdGhpcy5fY3VydmVzID0gY3VydmVzO1xuICAgICAgICB0aGlzLl9hbmltRXZlbnRzID0gYW5pbUV2ZW50cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBuYW1lIG9mIHRoZSBBbmltVHJhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBuYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBkdXJhdGlvbiBvZiB0aGUgQW5pbVRyYWNrLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZHVyYXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBsaXN0IG9mIGN1cnZlIGtleSBkYXRhIGNvbnRhaW5lZCBpbiB0aGUgQW5pbVRyYWNrLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9hbmltLWRhdGEuanMnKS5BbmltRGF0YVtdfVxuICAgICAqL1xuICAgIGdldCBpbnB1dHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnB1dHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgbGlzdCBvZiBjdXJ2ZSB2YWx1ZXMgY29udGFpbmVkIGluIHRoZSBBbmltVHJhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2FuaW0tZGF0YS5qcycpLkFuaW1EYXRhW119XG4gICAgICovXG4gICAgZ2V0IG91dHB1dHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRwdXRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGxpc3Qgb2YgY3VydmVzIGNvbnRhaW5lZCBpbiB0aGUgQW5pbVRyYWNrLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9hbmltLWN1cnZlLmpzJykuQW5pbUN1cnZlW119XG4gICAgICovXG4gICAgZ2V0IGN1cnZlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnZlcztcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFRoZSBhbmltYXRpb24gZXZlbnRzIHRoYXQgd2lsbCBmaXJlIGR1cmluZyB0aGUgcGxheWJhY2sgb2YgdGhpcyBhbmltIHRyYWNrLlxuICAgICAqXG4gICAgICogQHR5cGUge0FuaW1FdmVudHN9XG4gICAgICovXG4gICAgc2V0IGV2ZW50cyhhbmltRXZlbnRzKSB7XG4gICAgICAgIHRoaXMuX2FuaW1FdmVudHMgPSBhbmltRXZlbnRzO1xuICAgIH1cblxuICAgIGdldCBldmVudHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmltRXZlbnRzLmV2ZW50cztcbiAgICB9XG5cbiAgICAvLyBldmFsdWF0ZSBhbGwgdHJhY2sgY3VydmVzIGF0IHRoZSBzcGVjaWZpZWQgdGltZSBhbmQgc3RvcmUgcmVzdWx0c1xuICAgIC8vIGluIHRoZSBwcm92aWRlZCBzbmFwc2hvdC5cbiAgICBldmFsKHRpbWUsIHNuYXBzaG90KSB7XG4gICAgICAgIHNuYXBzaG90Ll90aW1lID0gdGltZTtcblxuICAgICAgICBjb25zdCBpbnB1dHMgPSB0aGlzLl9pbnB1dHM7XG4gICAgICAgIGNvbnN0IG91dHB1dHMgPSB0aGlzLl9vdXRwdXRzO1xuICAgICAgICBjb25zdCBjdXJ2ZXMgPSB0aGlzLl9jdXJ2ZXM7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gc25hcHNob3QuX2NhY2hlO1xuICAgICAgICBjb25zdCByZXN1bHRzID0gc25hcHNob3QuX3Jlc3VsdHM7XG5cbiAgICAgICAgLy8gZXZhbHVhdGUgaW5wdXRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjYWNoZVtpXS51cGRhdGUodGltZSwgaW5wdXRzW2ldLl9kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV2YWx1YXRlIG91dHB1dHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJ2ZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnZlID0gY3VydmVzW2ldO1xuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gb3V0cHV0c1tjdXJ2ZS5fb3V0cHV0XTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHJlc3VsdHNbaV07XG4gICAgICAgICAgICBjYWNoZVtjdXJ2ZS5faW5wdXRdLmV2YWwocmVzdWx0LCBjdXJ2ZS5faW50ZXJwb2xhdGlvbiwgb3V0cHV0KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgQW5pbVRyYWNrIH07XG4iXSwibmFtZXMiOlsiQW5pbVRyYWNrIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiZHVyYXRpb24iLCJpbnB1dHMiLCJvdXRwdXRzIiwiY3VydmVzIiwiYW5pbUV2ZW50cyIsIkFuaW1FdmVudHMiLCJfbmFtZSIsIl9kdXJhdGlvbiIsIl9pbnB1dHMiLCJfb3V0cHV0cyIsIl9jdXJ2ZXMiLCJfYW5pbUV2ZW50cyIsImV2ZW50cyIsImV2YWwiLCJ0aW1lIiwic25hcHNob3QiLCJfdGltZSIsImNhY2hlIiwiX2NhY2hlIiwicmVzdWx0cyIsIl9yZXN1bHRzIiwiaSIsImxlbmd0aCIsInVwZGF0ZSIsIl9kYXRhIiwiY3VydmUiLCJvdXRwdXQiLCJfb3V0cHV0IiwicmVzdWx0IiwiX2lucHV0IiwiX2ludGVycG9sYXRpb24iLCJFTVBUWSIsIk9iamVjdCIsImZyZWV6ZSIsIk51bWJlciIsIk1BWF9WQUxVRSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxDQUFDO0FBQ1o7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFJSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLElBQUksRUFBRUMsUUFBUSxFQUFFQyxNQUFNLEVBQUVDLE9BQU8sRUFBRUMsTUFBTSxFQUFFQyxVQUFVLEdBQUcsSUFBSUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0lBQ2xGLElBQUksQ0FBQ0MsS0FBSyxHQUFHUCxJQUFJLENBQUE7SUFDakIsSUFBSSxDQUFDUSxTQUFTLEdBQUdQLFFBQVEsQ0FBQTtJQUN6QixJQUFJLENBQUNRLE9BQU8sR0FBR1AsTUFBTSxDQUFBO0lBQ3JCLElBQUksQ0FBQ1EsUUFBUSxHQUFHUCxPQUFPLENBQUE7SUFDdkIsSUFBSSxDQUFDUSxPQUFPLEdBQUdQLE1BQU0sQ0FBQTtJQUNyQixJQUFJLENBQUNRLFdBQVcsR0FBR1AsVUFBVSxDQUFBO0FBQ2pDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlMLElBQUlBLEdBQUc7SUFDUCxPQUFPLElBQUksQ0FBQ08sS0FBSyxDQUFBO0FBQ3JCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlOLFFBQVFBLEdBQUc7SUFDWCxPQUFPLElBQUksQ0FBQ08sU0FBUyxDQUFBO0FBQ3pCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlOLE1BQU1BLEdBQUc7SUFDVCxPQUFPLElBQUksQ0FBQ08sT0FBTyxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlOLE9BQU9BLEdBQUc7SUFDVixPQUFPLElBQUksQ0FBQ08sUUFBUSxDQUFBO0FBQ3hCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlOLE1BQU1BLEdBQUc7SUFDVCxPQUFPLElBQUksQ0FBQ08sT0FBTyxDQUFBO0FBQ3ZCLEdBQUE7O0FBR0E7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlFLE1BQU1BLENBQUNSLFVBQVUsRUFBRTtJQUNuQixJQUFJLENBQUNPLFdBQVcsR0FBR1AsVUFBVSxDQUFBO0FBQ2pDLEdBQUE7RUFFQSxJQUFJUSxNQUFNQSxHQUFHO0FBQ1QsSUFBQSxPQUFPLElBQUksQ0FBQ0QsV0FBVyxDQUFDQyxNQUFNLENBQUE7QUFDbEMsR0FBQTs7QUFFQTtBQUNBO0FBQ0FDLEVBQUFBLElBQUlBLENBQUNDLElBQUksRUFBRUMsUUFBUSxFQUFFO0lBQ2pCQSxRQUFRLENBQUNDLEtBQUssR0FBR0YsSUFBSSxDQUFBO0FBRXJCLElBQUEsTUFBTWIsTUFBTSxHQUFHLElBQUksQ0FBQ08sT0FBTyxDQUFBO0FBQzNCLElBQUEsTUFBTU4sT0FBTyxHQUFHLElBQUksQ0FBQ08sUUFBUSxDQUFBO0FBQzdCLElBQUEsTUFBTU4sTUFBTSxHQUFHLElBQUksQ0FBQ08sT0FBTyxDQUFBO0FBQzNCLElBQUEsTUFBTU8sS0FBSyxHQUFHRixRQUFRLENBQUNHLE1BQU0sQ0FBQTtBQUM3QixJQUFBLE1BQU1DLE9BQU8sR0FBR0osUUFBUSxDQUFDSyxRQUFRLENBQUE7O0FBRWpDO0FBQ0EsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3BCLE1BQU0sQ0FBQ3FCLE1BQU0sRUFBRSxFQUFFRCxDQUFDLEVBQUU7QUFDcENKLE1BQUFBLEtBQUssQ0FBQ0ksQ0FBQyxDQUFDLENBQUNFLE1BQU0sQ0FBQ1QsSUFBSSxFQUFFYixNQUFNLENBQUNvQixDQUFDLENBQUMsQ0FBQ0csS0FBSyxDQUFDLENBQUE7QUFDMUMsS0FBQTs7QUFFQTtBQUNBLElBQUEsS0FBSyxJQUFJSCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdsQixNQUFNLENBQUNtQixNQUFNLEVBQUUsRUFBRUQsQ0FBQyxFQUFFO0FBQ3BDLE1BQUEsTUFBTUksS0FBSyxHQUFHdEIsTUFBTSxDQUFDa0IsQ0FBQyxDQUFDLENBQUE7QUFDdkIsTUFBQSxNQUFNSyxNQUFNLEdBQUd4QixPQUFPLENBQUN1QixLQUFLLENBQUNFLE9BQU8sQ0FBQyxDQUFBO0FBQ3JDLE1BQUEsTUFBTUMsTUFBTSxHQUFHVCxPQUFPLENBQUNFLENBQUMsQ0FBQyxDQUFBO0FBQ3pCSixNQUFBQSxLQUFLLENBQUNRLEtBQUssQ0FBQ0ksTUFBTSxDQUFDLENBQUNoQixJQUFJLENBQUNlLE1BQU0sRUFBRUgsS0FBSyxDQUFDSyxjQUFjLEVBQUVKLE1BQU0sQ0FBQyxDQUFBO0FBQ2xFLEtBQUE7QUFDSixHQUFBO0FBQ0osQ0FBQTtBQWhITTdCLFNBQVMsQ0FNSmtDLEtBQUssR0FBR0MsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSXBDLFNBQVMsQ0FBQyxPQUFPLEVBQUVxQyxNQUFNLENBQUNDLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDOzs7OyJ9
