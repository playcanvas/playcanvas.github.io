/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * When resizing the window the size of the canvas will not change.
 *
 * @type {string}
 */
const FILLMODE_NONE = 'NONE';

/**
 * When resizing the window the size of the canvas will change to fill the window exactly.
 *
 * @type {string}
 */
const FILLMODE_FILL_WINDOW = 'FILL_WINDOW';

/**
 * When resizing the window the size of the canvas will change to fill the window as best it can,
 * while maintaining the same aspect ratio.
 *
 * @type {string}
 */
const FILLMODE_KEEP_ASPECT = 'KEEP_ASPECT';

/**
 * When the canvas is resized the resolution of the canvas will change to match the size of the
 * canvas.
 *
 * @type {string}
 */
const RESOLUTION_AUTO = 'AUTO';

/**
 * When the canvas is resized the resolution of the canvas will remain at the same value and the
 * output will just be scaled to fit the canvas.
 *
 * @type {string}
 */
const RESOLUTION_FIXED = 'FIXED';

export { FILLMODE_FILL_WINDOW, FILLMODE_KEEP_ASPECT, FILLMODE_NONE, RESOLUTION_AUTO, RESOLUTION_FIXED };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbnN0YW50cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdoZW4gcmVzaXppbmcgdGhlIHdpbmRvdyB0aGUgc2l6ZSBvZiB0aGUgY2FudmFzIHdpbGwgbm90IGNoYW5nZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgRklMTE1PREVfTk9ORSA9ICdOT05FJztcblxuLyoqXG4gKiBXaGVuIHJlc2l6aW5nIHRoZSB3aW5kb3cgdGhlIHNpemUgb2YgdGhlIGNhbnZhcyB3aWxsIGNoYW5nZSB0byBmaWxsIHRoZSB3aW5kb3cgZXhhY3RseS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgRklMTE1PREVfRklMTF9XSU5ET1cgPSAnRklMTF9XSU5ET1cnO1xuXG4vKipcbiAqIFdoZW4gcmVzaXppbmcgdGhlIHdpbmRvdyB0aGUgc2l6ZSBvZiB0aGUgY2FudmFzIHdpbGwgY2hhbmdlIHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbixcbiAqIHdoaWxlIG1haW50YWluaW5nIHRoZSBzYW1lIGFzcGVjdCByYXRpby5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgRklMTE1PREVfS0VFUF9BU1BFQ1QgPSAnS0VFUF9BU1BFQ1QnO1xuXG4vKipcbiAqIFdoZW4gdGhlIGNhbnZhcyBpcyByZXNpemVkIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBjYW52YXMgd2lsbCBjaGFuZ2UgdG8gbWF0Y2ggdGhlIHNpemUgb2YgdGhlXG4gKiBjYW52YXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFJFU09MVVRJT05fQVVUTyA9ICdBVVRPJztcblxuLyoqXG4gKiBXaGVuIHRoZSBjYW52YXMgaXMgcmVzaXplZCB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgY2FudmFzIHdpbGwgcmVtYWluIGF0IHRoZSBzYW1lIHZhbHVlIGFuZCB0aGVcbiAqIG91dHB1dCB3aWxsIGp1c3QgYmUgc2NhbGVkIHRvIGZpdCB0aGUgY2FudmFzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBSRVNPTFVUSU9OX0ZJWEVEID0gJ0ZJWEVEJztcbiJdLCJuYW1lcyI6WyJGSUxMTU9ERV9OT05FIiwiRklMTE1PREVfRklMTF9XSU5ET1ciLCJGSUxMTU9ERV9LRUVQX0FTUEVDVCIsIlJFU09MVVRJT05fQVVUTyIsIlJFU09MVVRJT05fRklYRUQiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1BLGFBQWEsR0FBRyxPQUFNOztBQUVuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsb0JBQW9CLEdBQUcsY0FBYTs7QUFFakQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsb0JBQW9CLEdBQUcsY0FBYTs7QUFFakQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZUFBZSxHQUFHLE9BQU07O0FBRXJDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHOzs7OyJ9
