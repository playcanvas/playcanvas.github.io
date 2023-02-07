/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Represents the resource of a Bundle Asset, which contains an index that maps URLs to blob URLs.
 *
 * @ignore
 */
class Bundle {
  /**
   * Create a new Bundle instance.
   *
   * @param {object[]} files - An array of objects that have a name field and contain a
   * getBlobUrl() function.
   */
  constructor(files) {
    this._blobUrls = {};
    for (let i = 0, len = files.length; i < len; i++) {
      if (files[i].url) {
        this._blobUrls[files[i].name] = files[i].url;
      }
    }
  }

  /**
   * Returns true if the specified URL exists in the loaded bundle.
   *
   * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
   * the URL first.
   * @returns {boolean} True of false.
   */
  hasBlobUrl(url) {
    return !!this._blobUrls[url];
  }

  /**
   * Returns a blob URL for the specified URL.
   *
   * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
   * the URL first.
   * @returns {string} A blob URL.
   */
  getBlobUrl(url) {
    return this._blobUrls[url];
  }

  /**
   * Destroys the bundle and frees up blob URLs.
   */
  destroy() {
    for (const key in this._blobUrls) {
      URL.revokeObjectURL(this._blobUrls[key]);
    }
    this._blobUrls = null;
  }
}

export { Bundle };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2J1bmRsZS9idW5kbGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXByZXNlbnRzIHRoZSByZXNvdXJjZSBvZiBhIEJ1bmRsZSBBc3NldCwgd2hpY2ggY29udGFpbnMgYW4gaW5kZXggdGhhdCBtYXBzIFVSTHMgdG8gYmxvYiBVUkxzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQnVuZGxlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQnVuZGxlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gZmlsZXMgLSBBbiBhcnJheSBvZiBvYmplY3RzIHRoYXQgaGF2ZSBhIG5hbWUgZmllbGQgYW5kIGNvbnRhaW4gYVxuICAgICAqIGdldEJsb2JVcmwoKSBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihmaWxlcykge1xuICAgICAgICB0aGlzLl9ibG9iVXJscyA9IHt9O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBmaWxlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGZpbGVzW2ldLnVybCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2Jsb2JVcmxzW2ZpbGVzW2ldLm5hbWVdID0gZmlsZXNbaV0udXJsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgVVJMIGV4aXN0cyBpbiB0aGUgbG9hZGVkIGJ1bmRsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgb3JpZ2luYWwgZmlsZSBVUkwuIE1ha2Ugc3VyZSB5b3UgaGF2ZSBjYWxsZWQgZGVjb2RlVVJJQ29tcG9uZW50IG9uXG4gICAgICogdGhlIFVSTCBmaXJzdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBvZiBmYWxzZS5cbiAgICAgKi9cbiAgICBoYXNCbG9iVXJsKHVybCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9ibG9iVXJsc1t1cmxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBibG9iIFVSTCBmb3IgdGhlIHNwZWNpZmllZCBVUkwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIG9yaWdpbmFsIGZpbGUgVVJMLiBNYWtlIHN1cmUgeW91IGhhdmUgY2FsbGVkIGRlY29kZVVSSUNvbXBvbmVudCBvblxuICAgICAqIHRoZSBVUkwgZmlyc3QuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gQSBibG9iIFVSTC5cbiAgICAgKi9cbiAgICBnZXRCbG9iVXJsKHVybCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmxvYlVybHNbdXJsXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgYnVuZGxlIGFuZCBmcmVlcyB1cCBibG9iIFVSTHMuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fYmxvYlVybHMpIHtcbiAgICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodGhpcy5fYmxvYlVybHNba2V5XSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYmxvYlVybHMgPSBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQnVuZGxlIH07XG4iXSwibmFtZXMiOlsiQnVuZGxlIiwiY29uc3RydWN0b3IiLCJmaWxlcyIsIl9ibG9iVXJscyIsImkiLCJsZW4iLCJsZW5ndGgiLCJ1cmwiLCJuYW1lIiwiaGFzQmxvYlVybCIsImdldEJsb2JVcmwiLCJkZXN0cm95Iiwia2V5IiwiVVJMIiwicmV2b2tlT2JqZWN0VVJMIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxNQUFNLENBQUM7QUFDVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxLQUFLLEVBQUU7QUFDZixJQUFBLElBQUksQ0FBQ0MsU0FBUyxHQUFHLEVBQUUsQ0FBQTtBQUVuQixJQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsR0FBRyxHQUFHSCxLQUFLLENBQUNJLE1BQU0sRUFBRUYsQ0FBQyxHQUFHQyxHQUFHLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQzlDLE1BQUEsSUFBSUYsS0FBSyxDQUFDRSxDQUFDLENBQUMsQ0FBQ0csR0FBRyxFQUFFO0FBQ2QsUUFBQSxJQUFJLENBQUNKLFNBQVMsQ0FBQ0QsS0FBSyxDQUFDRSxDQUFDLENBQUMsQ0FBQ0ksSUFBSSxDQUFDLEdBQUdOLEtBQUssQ0FBQ0UsQ0FBQyxDQUFDLENBQUNHLEdBQUcsQ0FBQTtBQUNoRCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUUsVUFBVSxDQUFDRixHQUFHLEVBQUU7QUFDWixJQUFBLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQ0osU0FBUyxDQUFDSSxHQUFHLENBQUMsQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lHLFVBQVUsQ0FBQ0gsR0FBRyxFQUFFO0FBQ1osSUFBQSxPQUFPLElBQUksQ0FBQ0osU0FBUyxDQUFDSSxHQUFHLENBQUMsQ0FBQTtBQUM5QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNJSSxFQUFBQSxPQUFPLEdBQUc7QUFDTixJQUFBLEtBQUssTUFBTUMsR0FBRyxJQUFJLElBQUksQ0FBQ1QsU0FBUyxFQUFFO01BQzlCVSxHQUFHLENBQUNDLGVBQWUsQ0FBQyxJQUFJLENBQUNYLFNBQVMsQ0FBQ1MsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM1QyxLQUFBO0lBQ0EsSUFBSSxDQUFDVCxTQUFTLEdBQUcsSUFBSSxDQUFBO0FBQ3pCLEdBQUE7QUFDSjs7OzsifQ==
