/**
 * Content does not scroll any further than its bounds.
 *
 * @type {number}
 * @category User Interface
 */
const SCROLL_MODE_CLAMP = 0;

/**
 * Content scrolls past its bounds and then gently bounces back.
 *
 * @type {number}
 * @category User Interface
 */
const SCROLL_MODE_BOUNCE = 1;

/**
 * Content can scroll forever.
 *
 * @type {number}
 * @category User Interface
 */
const SCROLL_MODE_INFINITE = 2;

/**
 * The scrollbar will be visible all the time.
 *
 * @type {number}
 * @category User Interface
 */
const SCROLLBAR_VISIBILITY_SHOW_ALWAYS = 0;

/**
 * The scrollbar will be visible only when content exceeds the size of the viewport.
 *
 * @type {number}
 * @category User Interface
 */
const SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED = 1;

export { SCROLLBAR_VISIBILITY_SHOW_ALWAYS, SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED, SCROLL_MODE_BOUNCE, SCROLL_MODE_CLAMP, SCROLL_MODE_INFINITE };
