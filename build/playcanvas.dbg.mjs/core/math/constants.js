/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A linear interpolation scheme.
 *
 * @type {number}
 */
const CURVE_LINEAR = 0;

/**
 * A smooth step interpolation scheme.
 *
 * @type {number}
 */
const CURVE_SMOOTHSTEP = 1;

/**
 * A Catmull-Rom spline interpolation scheme. This interpolation scheme is deprecated. Use
 * CURVE_SPLINE instead.
 *
 * @type {number}
 * @deprecated
 * @ignore
 */
const CURVE_CATMULL = 2;

/**
 * A cardinal spline interpolation scheme. This interpolation scheme is deprecated. Use
 * CURVE_SPLINE instead.
 *
 * @type {number}
 * @deprecated
 * @ignore
 */
const CURVE_CARDINAL = 3;

/**
 * Cardinal spline interpolation scheme. For Catmull-Rom, specify curve tension 0.5.
 *
 * @type {number}
 */
const CURVE_SPLINE = 4;

/**
 * A stepped interpolator, free from the shackles of blending.
 *
 * @type {number}
 */
const CURVE_STEP = 5;

export { CURVE_CARDINAL, CURVE_CATMULL, CURVE_LINEAR, CURVE_SMOOTHSTEP, CURVE_SPLINE, CURVE_STEP };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29yZS9tYXRoL2NvbnN0YW50cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEEgbGluZWFyIGludGVycG9sYXRpb24gc2NoZW1lLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVVJWRV9MSU5FQVIgPSAwO1xuXG4vKipcbiAqIEEgc21vb3RoIHN0ZXAgaW50ZXJwb2xhdGlvbiBzY2hlbWUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IENVUlZFX1NNT09USFNURVAgPSAxO1xuXG4vKipcbiAqIEEgQ2F0bXVsbC1Sb20gc3BsaW5lIGludGVycG9sYXRpb24gc2NoZW1lLiBUaGlzIGludGVycG9sYXRpb24gc2NoZW1lIGlzIGRlcHJlY2F0ZWQuIFVzZVxuICogQ1VSVkVfU1BMSU5FIGluc3RlYWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBkZXByZWNhdGVkXG4gKiBAaWdub3JlXG4gKi9cbmV4cG9ydCBjb25zdCBDVVJWRV9DQVRNVUxMID0gMjtcblxuLyoqXG4gKiBBIGNhcmRpbmFsIHNwbGluZSBpbnRlcnBvbGF0aW9uIHNjaGVtZS4gVGhpcyBpbnRlcnBvbGF0aW9uIHNjaGVtZSBpcyBkZXByZWNhdGVkLiBVc2VcbiAqIENVUlZFX1NQTElORSBpbnN0ZWFkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAZGVwcmVjYXRlZFxuICogQGlnbm9yZVxuICovXG5leHBvcnQgY29uc3QgQ1VSVkVfQ0FSRElOQUwgPSAzO1xuXG4vKipcbiAqIENhcmRpbmFsIHNwbGluZSBpbnRlcnBvbGF0aW9uIHNjaGVtZS4gRm9yIENhdG11bGwtUm9tLCBzcGVjaWZ5IGN1cnZlIHRlbnNpb24gMC41LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVVJWRV9TUExJTkUgPSA0O1xuXG4vKipcbiAqIEEgc3RlcHBlZCBpbnRlcnBvbGF0b3IsIGZyZWUgZnJvbSB0aGUgc2hhY2tsZXMgb2YgYmxlbmRpbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IENVUlZFX1NURVAgPSA1O1xuIl0sIm5hbWVzIjpbIkNVUlZFX0xJTkVBUiIsIkNVUlZFX1NNT09USFNURVAiLCJDVVJWRV9DQVRNVUxMIiwiQ1VSVkVfQ0FSRElOQUwiLCJDVVJWRV9TUExJTkUiLCJDVVJWRV9TVEVQIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQSxZQUFZLEdBQUcsRUFBQzs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxFQUFDOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEVBQUM7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUc7Ozs7In0=
