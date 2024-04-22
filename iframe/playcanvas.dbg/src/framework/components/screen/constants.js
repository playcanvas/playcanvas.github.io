/**
 * Always use the application's resolution as the resolution for the {@link ScreenComponent}.
 *
 * @type {string}
 * @category User Interface
 */
const SCALEMODE_NONE = 'none';

/**
 * Scale the {@link ScreenComponent} when the application's resolution is different than the
 * ScreenComponent's referenceResolution.
 *
 * @type {string}
 * @category User Interface
 */
const SCALEMODE_BLEND = 'blend';

export { SCALEMODE_BLEND, SCALEMODE_NONE };
