/**
 * Callback used by {@link ResourceHandler#load} when a resource is loaded (or an error occurs).
 *
 * @callback ResourceHandlerCallback
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {*} [response] - The raw data that has been successfully loaded.
 */

/**
 * @interface
 * @name ResourceHandler
 * @description Interface for ResourceHandlers used by {@link ResourceLoader}.
 */
class ResourceHandler {
  /**
   * @function
   * @name ResourceHandler#load
   * @description Load a resource from a remote URL. When loaded (or failed),
   * use the callback to return an the raw resource data (or error).
   * @param {string|object} url - Either the URL of the resource to load or a structure
   * containing the load and original URL.
   * @param {string} [url.load] - The URL to be used for loading the resource.
   * @param {string} [url.original] - The original URL to be used for identifying the resource
   * format. This is necessary when loading, for example from blob.
   * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
   * an error occurs.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   */
  load(url, callback, asset) {
    throw new Error('not implemented');
  }

  /* eslint-disable jsdoc/require-returns-check */
  /**
   * @function
   * @name ResourceHandler#open
   * @description Convert raw resource data into a resource instance. E.g. Take 3D model format
   * JSON and return a {@link Model}.
   * @param {string} url - The URL of the resource to open.
   * @param {*} data - The raw resource data passed by callback from {@link ResourceHandler#load}.
   * @param {import('../asset/asset.js').Asset} [asset] - Optional asset that is passed by
   * ResourceLoader.
   * @returns {*} The parsed resource data.
   */
  open(url, data, asset) {
    throw new Error('not implemented');
  }
  /* eslint-enable jsdoc/require-returns-check */

  /**
   * @function
   * @name ResourceHandler#[patch]
   * @description Optional function to perform any operations on a resource, that requires a
   * dependency on its asset data or any other asset data.
   * @param {import('../asset/asset.js').Asset} asset - The asset to patch.
   * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
   */
  patch(asset, assets) {
    // optional function
  }
}

export { ResourceHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9oYW5kbGVycy9oYW5kbGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgUmVzb3VyY2VIYW5kbGVyI2xvYWR9IHdoZW4gYSByZXNvdXJjZSBpcyBsb2FkZWQgKG9yIGFuIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIFJlc291cmNlSGFuZGxlckNhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZCBmYWlscy5cbiAqIEBwYXJhbSB7Kn0gW3Jlc3BvbnNlXSAtIFRoZSByYXcgZGF0YSB0aGF0IGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBsb2FkZWQuXG4gKi9cblxuLyoqXG4gKiBAaW50ZXJmYWNlXG4gKiBAbmFtZSBSZXNvdXJjZUhhbmRsZXJcbiAqIEBkZXNjcmlwdGlvbiBJbnRlcmZhY2UgZm9yIFJlc291cmNlSGFuZGxlcnMgdXNlZCBieSB7QGxpbmsgUmVzb3VyY2VMb2FkZXJ9LlxuICovXG5jbGFzcyBSZXNvdXJjZUhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIFJlc291cmNlSGFuZGxlciNsb2FkXG4gICAgICogQGRlc2NyaXB0aW9uIExvYWQgYSByZXNvdXJjZSBmcm9tIGEgcmVtb3RlIFVSTC4gV2hlbiBsb2FkZWQgKG9yIGZhaWxlZCksXG4gICAgICogdXNlIHRoZSBjYWxsYmFjayB0byByZXR1cm4gYW4gdGhlIHJhdyByZXNvdXJjZSBkYXRhIChvciBlcnJvcikuXG4gICAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSB1cmwgLSBFaXRoZXIgdGhlIFVSTCBvZiB0aGUgcmVzb3VyY2UgdG8gbG9hZCBvciBhIHN0cnVjdHVyZVxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGxvYWQgYW5kIG9yaWdpbmFsIFVSTC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3VybC5sb2FkXSAtIFRoZSBVUkwgdG8gYmUgdXNlZCBmb3IgbG9hZGluZyB0aGUgcmVzb3VyY2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFt1cmwub3JpZ2luYWxdIC0gVGhlIG9yaWdpbmFsIFVSTCB0byBiZSB1c2VkIGZvciBpZGVudGlmeWluZyB0aGUgcmVzb3VyY2VcbiAgICAgKiBmb3JtYXQuIFRoaXMgaXMgbmVjZXNzYXJ5IHdoZW4gbG9hZGluZywgZm9yIGV4YW1wbGUgZnJvbSBibG9iLlxuICAgICAqIEBwYXJhbSB7UmVzb3VyY2VIYW5kbGVyQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIHVzZWQgd2hlbiB0aGUgcmVzb3VyY2UgaXMgbG9hZGVkIG9yXG4gICAgICogYW4gZXJyb3Igb2NjdXJzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBbYXNzZXRdIC0gT3B0aW9uYWwgYXNzZXQgdGhhdCBpcyBwYXNzZWQgYnlcbiAgICAgKiBSZXNvdXJjZUxvYWRlci5cbiAgICAgKi9cbiAgICBsb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7XG4gICAgfVxuXG4gICAgLyogZXNsaW50LWRpc2FibGUganNkb2MvcmVxdWlyZS1yZXR1cm5zLWNoZWNrICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgUmVzb3VyY2VIYW5kbGVyI29wZW5cbiAgICAgKiBAZGVzY3JpcHRpb24gQ29udmVydCByYXcgcmVzb3VyY2UgZGF0YSBpbnRvIGEgcmVzb3VyY2UgaW5zdGFuY2UuIEUuZy4gVGFrZSAzRCBtb2RlbCBmb3JtYXRcbiAgICAgKiBKU09OIGFuZCByZXR1cm4gYSB7QGxpbmsgTW9kZWx9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSByZXNvdXJjZSB0byBvcGVuLlxuICAgICAqIEBwYXJhbSB7Kn0gZGF0YSAtIFRoZSByYXcgcmVzb3VyY2UgZGF0YSBwYXNzZWQgYnkgY2FsbGJhY2sgZnJvbSB7QGxpbmsgUmVzb3VyY2VIYW5kbGVyI2xvYWR9LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBbYXNzZXRdIC0gT3B0aW9uYWwgYXNzZXQgdGhhdCBpcyBwYXNzZWQgYnlcbiAgICAgKiBSZXNvdXJjZUxvYWRlci5cbiAgICAgKiBAcmV0dXJucyB7Kn0gVGhlIHBhcnNlZCByZXNvdXJjZSBkYXRhLlxuICAgICAqL1xuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuICAgIH1cbiAgICAvKiBlc2xpbnQtZW5hYmxlIGpzZG9jL3JlcXVpcmUtcmV0dXJucy1jaGVjayAqL1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgUmVzb3VyY2VIYW5kbGVyI1twYXRjaF1cbiAgICAgKiBAZGVzY3JpcHRpb24gT3B0aW9uYWwgZnVuY3Rpb24gdG8gcGVyZm9ybSBhbnkgb3BlcmF0aW9ucyBvbiBhIHJlc291cmNlLCB0aGF0IHJlcXVpcmVzIGFcbiAgICAgKiBkZXBlbmRlbmN5IG9uIGl0cyBhc3NldCBkYXRhIG9yIGFueSBvdGhlciBhc3NldCBkYXRhLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0byBwYXRjaC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fSBhc3NldHMgLSBUaGUgYXNzZXQgcmVnaXN0cnkuXG4gICAgICovXG4gICAgcGF0Y2goYXNzZXQsIGFzc2V0cykge1xuICAgICAgICAvLyBvcHRpb25hbCBmdW5jdGlvblxuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVzb3VyY2VIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiUmVzb3VyY2VIYW5kbGVyIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJFcnJvciIsIm9wZW4iLCJkYXRhIiwicGF0Y2giLCJhc3NldHMiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLENBQUM7QUFDbEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLElBQUlBLENBQUNDLEdBQUcsRUFBRUMsUUFBUSxFQUFFQyxLQUFLLEVBQUU7QUFDdkIsSUFBQSxNQUFNLElBQUlDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7O0FBRUE7QUFDQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLElBQUlBLENBQUNKLEdBQUcsRUFBRUssSUFBSSxFQUFFSCxLQUFLLEVBQUU7QUFDbkIsSUFBQSxNQUFNLElBQUlDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7QUFDQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lHLEVBQUFBLEtBQUtBLENBQUNKLEtBQUssRUFBRUssTUFBTSxFQUFFO0FBQ2pCO0FBQUEsR0FBQTtBQUVSOzs7OyJ9
