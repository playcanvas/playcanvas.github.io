/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A {@link ElementComponent} that contains child {@link ElementComponent}s.
 *
 * @type {string}
 */
const ELEMENTTYPE_GROUP = 'group';

/**
 * A {@link ElementComponent} that displays an image.
 *
 * @type {string}
 */
const ELEMENTTYPE_IMAGE = 'image';

/**
 * A {@link ElementComponent} that displays text.
 *
 * @type {string}
 */
const ELEMENTTYPE_TEXT = 'text';

/**
 * Fit the content exactly to Element's bounding box.
 *
 * @type {string}
 */
const FITMODE_STRETCH = 'stretch';

/**
 * Fit the content within the Element's bounding box while preserving its Aspect Ratio.
 *
 * @type {string}
 */
const FITMODE_CONTAIN = 'contain';

/**
 * Fit the content to cover the entire Element's bounding box while preserving its Aspect Ratio.
 *
 * @type {string}
 */
const FITMODE_COVER = 'cover';

export { ELEMENTTYPE_GROUP, ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT, FITMODE_CONTAIN, FITMODE_COVER, FITMODE_STRETCH };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9jb25zdGFudHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIHtAbGluayBFbGVtZW50Q29tcG9uZW50fSB0aGF0IGNvbnRhaW5zIGNoaWxkIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0dST1VQID0gJ2dyb3VwJztcblxuLyoqXG4gKiBBIHtAbGluayBFbGVtZW50Q29tcG9uZW50fSB0aGF0IGRpc3BsYXlzIGFuIGltYWdlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTUFHRSA9ICdpbWFnZSc7XG5cbi8qKlxuICogQSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0gdGhhdCBkaXNwbGF5cyB0ZXh0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9URVhUID0gJ3RleHQnO1xuXG4vKipcbiAqIEZpdCB0aGUgY29udGVudCBleGFjdGx5IHRvIEVsZW1lbnQncyBib3VuZGluZyBib3guXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IEZJVE1PREVfU1RSRVRDSCA9ICdzdHJldGNoJztcblxuLyoqXG4gKiBGaXQgdGhlIGNvbnRlbnQgd2l0aGluIHRoZSBFbGVtZW50J3MgYm91bmRpbmcgYm94IHdoaWxlIHByZXNlcnZpbmcgaXRzIEFzcGVjdCBSYXRpby5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgRklUTU9ERV9DT05UQUlOID0gJ2NvbnRhaW4nO1xuXG4vKipcbiAqIEZpdCB0aGUgY29udGVudCB0byBjb3ZlciB0aGUgZW50aXJlIEVsZW1lbnQncyBib3VuZGluZyBib3ggd2hpbGUgcHJlc2VydmluZyBpdHMgQXNwZWN0IFJhdGlvLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBGSVRNT0RFX0NPVkVSID0gJ2NvdmVyJztcbiJdLCJuYW1lcyI6WyJFTEVNRU5UVFlQRV9HUk9VUCIsIkVMRU1FTlRUWVBFX0lNQUdFIiwiRUxFTUVOVFRZUEVfVEVYVCIsIkZJVE1PREVfU1RSRVRDSCIsIkZJVE1PREVfQ09OVEFJTiIsIkZJVE1PREVfQ09WRVIiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1BLGlCQUFpQixHQUFHLFFBQU87O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxRQUFPOztBQUV4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZ0JBQWdCLEdBQUcsT0FBTTs7QUFFdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGVBQWUsR0FBRyxVQUFTOztBQUV4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZUFBZSxHQUFHLFVBQVM7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUc7Ozs7In0=
