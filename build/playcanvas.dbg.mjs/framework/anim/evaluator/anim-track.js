/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { AnimEvents } from './anim-events.js';

/**
 * An AnimTrack stores the curve data necessary to animate a set of target nodes. It can be linked
 * to the nodes it should animate using the {@link AnimComponent#assignAnimation} method.
 */
class AnimTrack {
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

export { AnimTrack };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS10cmFjay5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFuaW1FdmVudHMgfSBmcm9tICcuL2FuaW0tZXZlbnRzLmpzJztcblxuLyoqXG4gKiBBbiBBbmltVHJhY2sgc3RvcmVzIHRoZSBjdXJ2ZSBkYXRhIG5lY2Vzc2FyeSB0byBhbmltYXRlIGEgc2V0IG9mIHRhcmdldCBub2Rlcy4gSXQgY2FuIGJlIGxpbmtlZFxuICogdG8gdGhlIG5vZGVzIGl0IHNob3VsZCBhbmltYXRlIHVzaW5nIHRoZSB7QGxpbmsgQW5pbUNvbXBvbmVudCNhc3NpZ25BbmltYXRpb259IG1ldGhvZC5cbiAqL1xuY2xhc3MgQW5pbVRyYWNrIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQW5pbVRyYWNrIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgdHJhY2sgbmFtZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gLSBUaGUgZHVyYXRpb24gb2YgdGhlIHRyYWNrIGluIHNlY29uZHMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYW5pbS1kYXRhLmpzJykuQW5pbURhdGFbXX0gaW5wdXRzIC0gTGlzdCBvZiBjdXJ2ZSBrZXkgZGF0YS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hbmltLWRhdGEuanMnKS5BbmltRGF0YVtdfSBvdXRwdXRzIC0gTGlzdCBvZiBjdXJ2ZSB2YWx1ZSBkYXRhLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2FuaW0tY3VydmUuanMnKS5BbmltQ3VydmVbXX0gY3VydmVzIC0gVGhlIGxpc3Qgb2YgY3VydmVzLlxuICAgICAqIEBwYXJhbSB7QW5pbUV2ZW50c30gYW5pbUV2ZW50cyAtIEEgc2VxdWVuY2Ugb2YgYW5pbWF0aW9uIGV2ZW50cy5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSwgZHVyYXRpb24sIGlucHV0cywgb3V0cHV0cywgY3VydmVzLCBhbmltRXZlbnRzID0gbmV3IEFuaW1FdmVudHMoW10pKSB7XG4gICAgICAgIHRoaXMuX25hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLl9pbnB1dHMgPSBpbnB1dHM7XG4gICAgICAgIHRoaXMuX291dHB1dHMgPSBvdXRwdXRzO1xuICAgICAgICB0aGlzLl9jdXJ2ZXMgPSBjdXJ2ZXM7XG4gICAgICAgIHRoaXMuX2FuaW1FdmVudHMgPSBhbmltRXZlbnRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIG5hbWUgb2YgdGhlIEFuaW1UcmFjay5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IG5hbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGR1cmF0aW9uIG9mIHRoZSBBbmltVHJhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBkdXJhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2R1cmF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGxpc3Qgb2YgY3VydmUga2V5IGRhdGEgY29udGFpbmVkIGluIHRoZSBBbmltVHJhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2FuaW0tZGF0YS5qcycpLkFuaW1EYXRhW119XG4gICAgICovXG4gICAgZ2V0IGlucHV0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lucHV0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBsaXN0IG9mIGN1cnZlIHZhbHVlcyBjb250YWluZWQgaW4gdGhlIEFuaW1UcmFjay5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYW5pbS1kYXRhLmpzJykuQW5pbURhdGFbXX1cbiAgICAgKi9cbiAgICBnZXQgb3V0cHV0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX291dHB1dHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgbGlzdCBvZiBjdXJ2ZXMgY29udGFpbmVkIGluIHRoZSBBbmltVHJhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2FuaW0tY3VydmUuanMnKS5BbmltQ3VydmVbXX1cbiAgICAgKi9cbiAgICBnZXQgY3VydmVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VydmVzO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGhlIGFuaW1hdGlvbiBldmVudHMgdGhhdCB3aWxsIGZpcmUgZHVyaW5nIHRoZSBwbGF5YmFjayBvZiB0aGlzIGFuaW0gdHJhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QW5pbUV2ZW50c31cbiAgICAgKi9cbiAgICBzZXQgZXZlbnRzKGFuaW1FdmVudHMpIHtcbiAgICAgICAgdGhpcy5fYW5pbUV2ZW50cyA9IGFuaW1FdmVudHM7XG4gICAgfVxuXG4gICAgZ2V0IGV2ZW50cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1FdmVudHMuZXZlbnRzO1xuICAgIH1cblxuICAgIC8vIGV2YWx1YXRlIGFsbCB0cmFjayBjdXJ2ZXMgYXQgdGhlIHNwZWNpZmllZCB0aW1lIGFuZCBzdG9yZSByZXN1bHRzXG4gICAgLy8gaW4gdGhlIHByb3ZpZGVkIHNuYXBzaG90LlxuICAgIGV2YWwodGltZSwgc25hcHNob3QpIHtcbiAgICAgICAgc25hcHNob3QuX3RpbWUgPSB0aW1lO1xuXG4gICAgICAgIGNvbnN0IGlucHV0cyA9IHRoaXMuX2lucHV0cztcbiAgICAgICAgY29uc3Qgb3V0cHV0cyA9IHRoaXMuX291dHB1dHM7XG4gICAgICAgIGNvbnN0IGN1cnZlcyA9IHRoaXMuX2N1cnZlcztcbiAgICAgICAgY29uc3QgY2FjaGUgPSBzbmFwc2hvdC5fY2FjaGU7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBzbmFwc2hvdC5fcmVzdWx0cztcblxuICAgICAgICAvLyBldmFsdWF0ZSBpbnB1dHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNhY2hlW2ldLnVwZGF0ZSh0aW1lLCBpbnB1dHNbaV0uX2RhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXZhbHVhdGUgb3V0cHV0c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnZlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZXNbaV07XG4gICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBvdXRwdXRzW2N1cnZlLl9vdXRwdXRdO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gcmVzdWx0c1tpXTtcbiAgICAgICAgICAgIGNhY2hlW2N1cnZlLl9pbnB1dF0uZXZhbChyZXN1bHQsIGN1cnZlLl9pbnRlcnBvbGF0aW9uLCBvdXRwdXQpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltVHJhY2sgfTtcbiJdLCJuYW1lcyI6WyJBbmltVHJhY2siLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJkdXJhdGlvbiIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJhbmltRXZlbnRzIiwiQW5pbUV2ZW50cyIsIl9uYW1lIiwiX2R1cmF0aW9uIiwiX2lucHV0cyIsIl9vdXRwdXRzIiwiX2N1cnZlcyIsIl9hbmltRXZlbnRzIiwiZXZlbnRzIiwiZXZhbCIsInRpbWUiLCJzbmFwc2hvdCIsIl90aW1lIiwiY2FjaGUiLCJfY2FjaGUiLCJyZXN1bHRzIiwiX3Jlc3VsdHMiLCJpIiwibGVuZ3RoIiwidXBkYXRlIiwiX2RhdGEiLCJjdXJ2ZSIsIm91dHB1dCIsIl9vdXRw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
