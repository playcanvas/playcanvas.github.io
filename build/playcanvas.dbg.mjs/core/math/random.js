/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { math } from './math.js';

// golden angle in radians: PI * (3 - sqrt(5))
const _goldenAngle = 2.399963229728653;

/**
 * Random API.
 *
 * @namespace
 * @ignore
 */
const random = {
  /**
   * Return a pseudo-random 2D point inside a unit circle with uniform distribution.
   *
   * @param {Vec2} point - The returned generated point.
   * @ignore
   */
  circlePoint: function (point) {
    const r = Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    point.x = r * Math.cos(theta);
    point.y = r * Math.sin(theta);
  },
  /**
   * Generates evenly distributed deterministic points inside a unit circle using Fermat's spiral
   * and Vogel's method.
   *
   * @param {Vec2} point - The returned generated point.
   * @param {number} index - Index of the point to generate, in the range from 0 to numPoints - 1.
   * @param {number} numPoints - The total number of points of the set.
   * @ignore
   */
  circlePointDeterministic: function (point, index, numPoints) {
    const theta = index * _goldenAngle;
    const r = Math.sqrt(index) / Math.sqrt(numPoints);
    point.x = r * Math.cos(theta);
    point.y = r * Math.sin(theta);
  },
  /**
   * Generates evenly distributed deterministic points on a unit sphere using Fibonacci sphere
   * algorithm. It also allows the points to cover only part of the sphere by specifying start
   * and end parameters, representing value from 0 (top of the sphere) and 1 (bottom of the
   * sphere). For example by specifying 0.4 and 0.6 and start and end, a band around the equator
   * would be generated.
   *
   * @param {Vec3} point - The returned generated point.
   * @param {number} index - Index of the point to generate, in the range from 0 to numPoints - 1.
   * @param {number} numPoints - The total number of points of the set.
   * @param {number} [start] - Part on the sphere along y axis to start the points, in the range
   * of 0 and 1. Defaults to 0.
   * @param {number} [end] - Part on the sphere along y axis to stop the points, in the range of
   * 0 and 1. Defaults to 1.
   * @ignore
   */
  spherePointDeterministic: function (point, index, numPoints, start = 0, end = 1) {
    // y coordinate needs to go from -1 (top) to 1 (bottom) for the full sphere
    // evaluate its value for this point and specified start and end
    start = 1 - 2 * start;
    end = 1 - 2 * end;
    const y = math.lerp(start, end, index / numPoints);

    // radius at y
    const radius = Math.sqrt(1 - y * y);

    // golden angle increment
    const theta = _goldenAngle * index;
    point.x = Math.cos(theta) * radius;
    point.y = y;
    point.z = Math.sin(theta) * radius;
  },
  /**
   * Generate a repeatable pseudo-random sequence using radical inverse. Based on
   * http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
   *
   * @param {number} i - The index in the sequence to return.
   * @returns {number} The pseudo-random value.
   * @ignore
   */
  radicalInverse: function (i) {
    let bits = (i << 16 | i >>> 16) >>> 0;
    bits = ((bits & 0x55555555) << 1 | (bits & 0xAAAAAAAA) >>> 1) >>> 0;
    bits = ((bits & 0x33333333) << 2 | (bits & 0xCCCCCCCC) >>> 2) >>> 0;
    bits = ((bits & 0x0F0F0F0F) << 4 | (bits & 0xF0F0F0F0) >>> 4) >>> 0;
    bits = ((bits & 0x00FF00FF) << 8 | (bits & 0xFF00FF00) >>> 8) >>> 0;
    return bits * 2.3283064365386963e-10;
  }
};

export { random };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZG9tLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29yZS9tYXRoL3JhbmRvbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi9tYXRoLmpzJztcblxuLy8gZ29sZGVuIGFuZ2xlIGluIHJhZGlhbnM6IFBJICogKDMgLSBzcXJ0KDUpKVxuY29uc3QgX2dvbGRlbkFuZ2xlID0gMi4zOTk5NjMyMjk3Mjg2NTM7XG5cbi8qKlxuICogUmFuZG9tIEFQSS5cbiAqXG4gKiBAbmFtZXNwYWNlXG4gKiBAaWdub3JlXG4gKi9cbmNvbnN0IHJhbmRvbSA9IHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBwc2V1ZG8tcmFuZG9tIDJEIHBvaW50IGluc2lkZSBhIHVuaXQgY2lyY2xlIHdpdGggdW5pZm9ybSBkaXN0cmlidXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHBvaW50IC0gVGhlIHJldHVybmVkIGdlbmVyYXRlZCBwb2ludC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY2lyY2xlUG9pbnQ6IGZ1bmN0aW9uIChwb2ludCkge1xuICAgICAgICBjb25zdCByID0gTWF0aC5zcXJ0KE1hdGgucmFuZG9tKCkpO1xuICAgICAgICBjb25zdCB0aGV0YSA9IE1hdGgucmFuZG9tKCkgKiAyICogTWF0aC5QSTtcbiAgICAgICAgcG9pbnQueCA9IHIgKiBNYXRoLmNvcyh0aGV0YSk7XG4gICAgICAgIHBvaW50LnkgPSByICogTWF0aC5zaW4odGhldGEpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgZXZlbmx5IGRpc3RyaWJ1dGVkIGRldGVybWluaXN0aWMgcG9pbnRzIGluc2lkZSBhIHVuaXQgY2lyY2xlIHVzaW5nIEZlcm1hdCdzIHNwaXJhbFxuICAgICAqIGFuZCBWb2dlbCdzIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcG9pbnQgLSBUaGUgcmV0dXJuZWQgZ2VuZXJhdGVkIHBvaW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIHRoZSBwb2ludCB0byBnZW5lcmF0ZSwgaW4gdGhlIHJhbmdlIGZyb20gMCB0byBudW1Qb2ludHMgLSAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1Qb2ludHMgLSBUaGUgdG90YWwgbnVtYmVyIG9mIHBvaW50cyBvZiB0aGUgc2V0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjaXJjbGVQb2ludERldGVybWluaXN0aWM6IGZ1bmN0aW9uIChwb2ludCwgaW5kZXgsIG51bVBvaW50cykge1xuICAgICAgICBjb25zdCB0aGV0YSA9IGluZGV4ICogX2dvbGRlbkFuZ2xlO1xuICAgICAgICBjb25zdCByID0gTWF0aC5zcXJ0KGluZGV4KSAvIE1hdGguc3FydChudW1Qb2ludHMpO1xuXG4gICAgICAgIHBvaW50LnggPSByICogTWF0aC5jb3ModGhldGEpO1xuICAgICAgICBwb2ludC55ID0gciAqIE1hdGguc2luKHRoZXRhKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGV2ZW5seSBkaXN0cmlidXRlZCBkZXRlcm1pbmlzdGljIHBvaW50cyBvbiBhIHVuaXQgc3BoZXJlIHVzaW5nIEZpYm9uYWNjaSBzcGhlcmVcbiAgICAgKiBhbGdvcml0aG0uIEl0IGFsc28gYWxsb3dzIHRoZSBwb2ludHMgdG8gY292ZXIgb25seSBwYXJ0IG9mIHRoZSBzcGhlcmUgYnkgc3BlY2lmeWluZyBzdGFydFxuICAgICAqIGFuZCBlbmQgcGFyYW1ldGVycywgcmVwcmVzZW50aW5nIHZhbHVlIGZyb20gMCAodG9wIG9mIHRoZSBzcGhlcmUpIGFuZCAxIChib3R0b20gb2YgdGhlXG4gICAgICogc3BoZXJlKS4gRm9yIGV4YW1wbGUgYnkgc3BlY2lmeWluZyAwLjQgYW5kIDAuNiBhbmQgc3RhcnQgYW5kIGVuZCwgYSBiYW5kIGFyb3VuZCB0aGUgZXF1YXRvclxuICAgICAqIHdvdWxkIGJlIGdlbmVyYXRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcmV0dXJuZWQgZ2VuZXJhdGVkIHBvaW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIHRoZSBwb2ludCB0byBnZW5lcmF0ZSwgaW4gdGhlIHJhbmdlIGZyb20gMCB0byBudW1Qb2ludHMgLSAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1Qb2ludHMgLSBUaGUgdG90YWwgbnVtYmVyIG9mIHBvaW50cyBvZiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnRdIC0gUGFydCBvbiB0aGUgc3BoZXJlIGFsb25nIHkgYXhpcyB0byBzdGFydCB0aGUgcG9pbnRzLCBpbiB0aGUgcmFuZ2VcbiAgICAgKiBvZiAwIGFuZCAxLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZW5kXSAtIFBhcnQgb24gdGhlIHNwaGVyZSBhbG9uZyB5IGF4aXMgdG8gc3RvcCB0aGUgcG9pbnRzLCBpbiB0aGUgcmFuZ2Ugb2ZcbiAgICAgKiAwIGFuZCAxLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzcGhlcmVQb2ludERldGVybWluaXN0aWM6IGZ1bmN0aW9uIChwb2ludCwgaW5kZXgsIG51bVBvaW50cywgc3RhcnQgPSAwLCBlbmQgPSAxKSB7XG5cbiAgICAgICAgLy8geSBjb29yZGluYXRlIG5lZWRzIHRvIGdvIGZyb20gLTEgKHRvcCkgdG8gMSAoYm90dG9tKSBmb3IgdGhlIGZ1bGwgc3BoZXJlXG4gICAgICAgIC8vIGV2YWx1YXRlIGl0cyB2YWx1ZSBmb3IgdGhpcyBwb2ludCBhbmQgc3BlY2lmaWVkIHN0YXJ0IGFuZCBlbmRcbiAgICAgICAgc3RhcnQgPSAxIC0gMiAqIHN0YXJ0O1xuICAgICAgICBlbmQgPSAxIC0gMiAqIGVuZDtcbiAgICAgICAgY29uc3QgeSA9IG1hdGgubGVycChzdGFydCwgZW5kLCBpbmRleCAvIG51bVBvaW50cyk7XG5cbiAgICAgICAgLy8gcmFkaXVzIGF0IHlcbiAgICAgICAgY29uc3QgcmFkaXVzID0gTWF0aC5zcXJ0KDEgLSB5ICogeSk7XG5cbiAgICAgICAgLy8gZ29sZGVuIGFuZ2xlIGluY3JlbWVudFxuICAgICAgICBjb25zdCB0aGV0YSA9IF9nb2xkZW5BbmdsZSAqIGluZGV4O1xuXG4gICAgICAgIHBvaW50LnggPSBNYXRoLmNvcyh0aGV0YSkgKiByYWRpdXM7XG4gICAgICAgIHBvaW50LnkgPSB5O1xuICAgICAgICBwb2ludC56ID0gTWF0aC5zaW4odGhldGEpICogcmFkaXVzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhIHJlcGVhdGFibGUgcHNldWRvLXJhbmRvbSBzZXF1ZW5jZSB1c2luZyByYWRpY2FsIGludmVyc2UuIEJhc2VkIG9uXG4gICAgICogaHR0cDovL2hvbGdlci5kYW1tZXJ0ei5vcmcvc3R1ZmYvbm90ZXNfSGFtbWVyc2xleU9uSGVtaXNwaGVyZS5odG1sXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaSAtIFRoZSBpbmRleCBpbiB0aGUgc2VxdWVuY2UgdG8gcmV0dXJuLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBwc2V1ZG8tcmFuZG9tIHZhbHVlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByYWRpY2FsSW52ZXJzZTogZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgbGV0IGJpdHMgPSAoKGkgPDwgMTYpIHwgKGkgPj4+IDE2KSkgPj4+IDA7XG4gICAgICAgIGJpdHMgPSAoKChiaXRzICYgMHg1NTU1NTU1NSkgPDwgMSkgfCAoKGJpdHMgJiAweEFBQUFBQUFBKSA+Pj4gMSkpID4+PiAwO1xuICAgICAgICBiaXRzID0gKCgoYml0cyAmIDB4MzMzMzMzMzMpIDw8IDIpIHwgKChiaXRzICYgMHhDQ0NDQ0NDQykgPj4+IDIpKSA+Pj4gMDtcbiAgICAgICAgYml0cyA9ICgoKGJpdHMgJiAweDBGMEYwRjBGKSA8PCA0KSB8ICgoYml0cyAmIDB4RjBGMEYwRjApID4+PiA0KSkgPj4+IDA7XG4gICAgICAgIGJpdHMgPSAoKChiaXRzICYgMHgwMEZGMDBGRikgPDwgOCkgfCAoKGJpdHMgJiAweEZGMDBGRjAwKSA+Pj4gOCkpID4+PiAwO1xuICAgICAgICByZXR1cm4gYml0cyAqIDIuMzI4MzA2NDM2NTM4Njk2M2UtMTA7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgcmFuZG9tIH07XG4iXSwibmFtZXMiOlsiX2dvbGRlbkFuZ2xlIiwicmFuZG9tIiwiY2lyY2xlUG9pbnQiLCJwb2ludCIsInIiLCJNYXRoIiwic3FydCIsInRoZXRhIiwiUEkiLCJ4IiwiY29zIiwieSIsInNpbiIsImNpcmNsZVBvaW50RGV0ZXJtaW5pc3RpYyIsImluZGV4IiwibnVtUG9pbnRzIiwic3BoZXJlUG9pbnREZXRlcm1pbmlzdGljIiwic3RhcnQiLCJlbmQiLCJtYXRoIiwibGVycCIsInJhZGl1cyIsInoiLCJyYWRpY2FsSW52ZXJzZSIsImkiLCJiaXRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7QUFDQSxNQUFNQSxZQUFZLEdBQUcsaUJBQWlCLENBQUE7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLE1BQU0sR0FBRztBQUNYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXLEVBQUUsVUFBVUMsS0FBSyxFQUFFO0lBQzFCLE1BQU1DLENBQUMsR0FBR0MsSUFBSSxDQUFDQyxJQUFJLENBQUNELElBQUksQ0FBQ0osTUFBTSxFQUFFLENBQUMsQ0FBQTtJQUNsQyxNQUFNTSxLQUFLLEdBQUdGLElBQUksQ0FBQ0osTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHSSxJQUFJLENBQUNHLEVBQUUsQ0FBQTtJQUN6Q0wsS0FBSyxDQUFDTSxDQUFDLEdBQUdMLENBQUMsR0FBR0MsSUFBSSxDQUFDSyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFBO0lBQzdCSixLQUFLLENBQUNRLENBQUMs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
