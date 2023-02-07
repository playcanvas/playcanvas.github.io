/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Basically a very large random number (128-bit) which means the probability of creating two that
 * clash is vanishingly small. GUIDs are used as the unique identifiers for Entities.
 *
 * @namespace
 */
const guid = {
  /**
   * Create an RFC4122 version 4 compliant GUID.
   *
   * @returns {string} A new GUID.
   */
  create: function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : r & 0x3 | 0x8;
      return v.toString(16);
    });
  }
};

export { guid };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3VpZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvZ3VpZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEJhc2ljYWxseSBhIHZlcnkgbGFyZ2UgcmFuZG9tIG51bWJlciAoMTI4LWJpdCkgd2hpY2ggbWVhbnMgdGhlIHByb2JhYmlsaXR5IG9mIGNyZWF0aW5nIHR3byB0aGF0XG4gKiBjbGFzaCBpcyB2YW5pc2hpbmdseSBzbWFsbC4gR1VJRHMgYXJlIHVzZWQgYXMgdGhlIHVuaXF1ZSBpZGVudGlmaWVycyBmb3IgRW50aXRpZXMuXG4gKlxuICogQG5hbWVzcGFjZVxuICovXG5jb25zdCBndWlkID0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBSRkM0MTIyIHZlcnNpb24gNCBjb21wbGlhbnQgR1VJRC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IEEgbmV3IEdVSUQuXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICBjb25zdCByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMDtcbiAgICAgICAgICAgIGNvbnN0IHYgPSAoYyA9PT0gJ3gnKSA/IHIgOiAociAmIDB4MyB8IDB4OCk7XG4gICAgICAgICAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmV4cG9ydCB7IGd1aWQgfTtcbiJdLCJuYW1lcyI6WyJndWlkIiwiY3JlYXRlIiwicmVwbGFjZSIsImMiLCJyIiwiTWF0aCIsInJhbmRvbSIsInYiLCJ0b1N0cmluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLEdBQUc7QUFDVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLE1BQU0sRUFBRSxZQUFZO0lBQ2hCLE9BQU8sc0NBQXNDLENBQUNDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsVUFBVUMsQ0FBQyxFQUFFO01BQ3hFLE1BQU1DLENBQUMsR0FBR0MsSUFBSSxDQUFDQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2hDLE1BQUEsTUFBTUMsQ0FBQyxHQUFJSixDQUFDLEtBQUssR0FBRyxHQUFJQyxDQUFDLEdBQUlBLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBSSxDQUFBO0FBQzNDLE1BQUEsT0FBT0csQ0FBQyxDQUFDQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDekIsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBO0FBQ0o7Ozs7In0=
