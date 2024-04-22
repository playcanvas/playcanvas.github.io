/**
 * Disable all fitting logic.
 *
 * @type {number}
 * @category User Interface
 */
const FITTING_NONE = 0;

/**
 * Stretch child elements to fit the parent container.
 *
 * @type {number}
 * @category User Interface
 */
const FITTING_STRETCH = 1;

/**
 * Shrink child elements to fit the parent container.
 *
 * @type {number}
 * @category User Interface
 */
const FITTING_SHRINK = 2;

/**
 * Apply both STRETCH and SHRINK fitting logic where applicable.
 *
 * @type {number}
 * @category User Interface
 */
const FITTING_BOTH = 3;

export { FITTING_BOTH, FITTING_NONE, FITTING_SHRINK, FITTING_STRETCH };
