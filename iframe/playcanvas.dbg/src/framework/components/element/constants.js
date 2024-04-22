/**
 * A {@link ElementComponent} that contains child {@link ElementComponent}s.
 *
 * @type {string}
 * @category User Interface
 */
const ELEMENTTYPE_GROUP = 'group';

/**
 * A {@link ElementComponent} that displays an image.
 *
 * @type {string}
 * @category User Interface
 */
const ELEMENTTYPE_IMAGE = 'image';

/**
 * A {@link ElementComponent} that displays text.
 *
 * @type {string}
 * @category User Interface
 */
const ELEMENTTYPE_TEXT = 'text';

/**
 * Fit the content exactly to Element's bounding box.
 *
 * @type {string}
 * @category User Interface
 */
const FITMODE_STRETCH = 'stretch';

/**
 * Fit the content within the Element's bounding box while preserving its Aspect Ratio.
 *
 * @type {string}
 * @category User Interface
 */
const FITMODE_CONTAIN = 'contain';

/**
 * Fit the content to cover the entire Element's bounding box while preserving its Aspect Ratio.
 *
 * @type {string}
 * @category User Interface
 */
const FITMODE_COVER = 'cover';

export { ELEMENTTYPE_GROUP, ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT, FITMODE_CONTAIN, FITMODE_COVER, FITMODE_STRETCH };
