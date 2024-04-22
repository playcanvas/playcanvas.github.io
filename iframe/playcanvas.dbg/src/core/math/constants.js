/**
 * A linear interpolation scheme.
 *
 * @type {number}
 * @category Math
 */
const CURVE_LINEAR = 0;

/**
 * A smooth step interpolation scheme.
 *
 * @type {number}
 * @category Math
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
 * @category Math
 */
const CURVE_SPLINE = 4;

/**
 * A stepped interpolator, free from the shackles of blending.
 *
 * @type {number}
 * @category Math
 */
const CURVE_STEP = 5;

export { CURVE_CARDINAL, CURVE_CATMULL, CURVE_LINEAR, CURVE_SMOOTHSTEP, CURVE_SPLINE, CURVE_STEP };
