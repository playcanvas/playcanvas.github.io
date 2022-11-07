/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class ResourceHandler {
  load(url, callback, asset) {
    throw new Error('not implemented');
  }

  open(url, data, asset) {
    throw new Error('not implemented');
  }

  patch(asset, assets) {}

}

export { ResourceHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3Jlc291cmNlcy9oYW5kbGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBBc3NldCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LXJlZ2lzdHJ5LmpzJykuQXNzZXRSZWdpc3RyeX0gQXNzZXRSZWdpc3RyeSAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFJlc291cmNlSGFuZGxlciNsb2FkfSB3aGVuIGEgcmVzb3VyY2UgaXMgbG9hZGVkIChvciBhbiBlcnJvciBvY2N1cnMpLlxuICpcbiAqIEBjYWxsYmFjayBSZXNvdXJjZUhhbmRsZXJDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWQgZmFpbHMuXG4gKiBAcGFyYW0geyp9IFtyZXNwb25zZV0gLSBUaGUgcmF3IGRhdGEgdGhhdCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgbG9hZGVkLlxuICovXG5cbi8qKlxuICogQGludGVyZmFjZVxuICogQG5hbWUgUmVzb3VyY2VIYW5kbGVyXG4gKiBAZGVzY3JpcHRpb24gSW50ZXJmYWNlIGZvciBSZXNvdXJjZUhhbmRsZXJzIHVzZWQgYnkge0BsaW5rIFJlc291cmNlTG9hZGVyfS5cbiAqL1xuY2xhc3MgUmVzb3VyY2VIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBSZXNvdXJjZUhhbmRsZXIjbG9hZFxuICAgICAqIEBkZXNjcmlwdGlvbiBMb2FkIGEgcmVzb3VyY2UgZnJvbSBhIHJlbW90ZSBVUkwuIFdoZW4gbG9hZGVkIChvciBmYWlsZWQpLFxuICAgICAqIHVzZSB0aGUgY2FsbGJhY2sgdG8gcmV0dXJuIGFuIHRoZSByYXcgcmVzb3VyY2UgZGF0YSAob3IgZXJyb3IpLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gdXJsIC0gRWl0aGVyIHRoZSBVUkwgb2YgdGhlIHJlc291cmNlIHRvIGxvYWQgb3IgYSBzdHJ1Y3R1cmUgY29udGFpbmluZyB0aGVcbiAgICAgKiBsb2FkIGFuZCBvcmlnaW5hbCBVUkwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFt1cmwubG9hZF0gLSBUaGUgVVJMIHRvIGJlIHVzZWQgZm9yIGxvYWRpbmcgdGhlIHJlc291cmNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbdXJsLm9yaWdpbmFsXSAtIFRoZSBvcmlnaW5hbCBVUkwgdG8gYmUgdXNlZCBmb3IgaWRlbnRpZnlpbmcgdGhlIHJlc291cmNlXG4gICAgICogZm9ybWF0LiBUaGlzIGlzIG5lY2Vzc2FyeSB3aGVuIGxvYWRpbmcsIGZvciBleGFtcGxlIGZyb20gYmxvYi5cbiAgICAgKiBAcGFyYW0ge1Jlc291cmNlSGFuZGxlckNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc291cmNlIGlzIGxvYWRlZCBvciBhbiBlcnJvciBvY2N1cnMuXG4gICAgICogQHBhcmFtIHtBc3NldH0gW2Fzc2V0XSAtIE9wdGlvbmFsIGFzc2V0IHRoYXQgaXMgcGFzc2VkIGJ5IFJlc291cmNlTG9hZGVyLlxuICAgICAqL1xuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcbiAgICB9XG5cbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBqc2RvYy9yZXF1aXJlLXJldHVybnMtY2hlY2sgKi9cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBSZXNvdXJjZUhhbmRsZXIjb3BlblxuICAgICAqIEBkZXNjcmlwdGlvbiBDb252ZXJ0IHJhdyByZXNvdXJjZSBkYXRhIGludG8gYSByZXNvdXJjZSBpbnN0YW5jZS4gRS5nLiBUYWtlIDNEIG1vZGVsIGZvcm1hdCBKU09OIGFuZCByZXR1cm4gYSB7QGxpbmsgTW9kZWx9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSByZXNvdXJjZSB0byBvcGVuLlxuICAgICAqIEBwYXJhbSB7Kn0gZGF0YSAtIFRoZSByYXcgcmVzb3VyY2UgZGF0YSBwYXNzZWQgYnkgY2FsbGJhY2sgZnJvbSB7QGxpbmsgUmVzb3VyY2VIYW5kbGVyI2xvYWR9LlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IFthc3NldF0gLSBPcHRpb25hbCBhc3NldCB0aGF0IGlzIHBhc3NlZCBieSBSZXNvdXJjZUxvYWRlci5cbiAgICAgKiBAcmV0dXJucyB7Kn0gVGhlIHBhcnNlZCByZXNvdXJjZSBkYXRhLlxuICAgICAqL1xuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xuICAgIH1cbiAgICAvKiBlc2xpbnQtZW5hYmxlIGpzZG9jL3JlcXVpcmUtcmV0dXJucy1jaGVjayAqL1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgUmVzb3VyY2VIYW5kbGVyI1twYXRjaF1cbiAgICAgKiBAZGVzY3JpcHRpb24gT3B0aW9uYWwgZnVuY3Rpb24gdG8gcGVyZm9ybSBhbnkgb3BlcmF0aW9ucyBvbiBhIHJlc291cmNlLCB0aGF0IHJlcXVpcmVzIGEgZGVwZW5kZW5jeSBvbiBpdHMgYXNzZXQgZGF0YVxuICAgICAqIG9yIGFueSBvdGhlciBhc3NldCBkYXRhLlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRvIHBhdGNoLlxuICAgICAqIEBwYXJhbSB7QXNzZXRSZWdpc3RyeX0gYXNzZXRzIC0gVGhlIGFzc2V0IHJlZ2lzdHJ5LlxuICAgICAqL1xuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcbiAgICAgICAgLy8gb3B0aW9uYWwgZnVuY3Rpb25cbiAgICB9XG59XG5cbmV4cG9ydCB7IFJlc291cmNlSGFuZGxlciB9O1xuIl0sIm5hbWVzIjpbIlJlc291cmNlSGFuZGxlciIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsImFzc2V0IiwiRXJyb3IiLCJvcGVuIiwiZGF0YSIsInBhdGNoIiwiYXNzZXRzIl0sIm1hcHBpbmdzIjoiOzs7OztBQWdCQSxNQUFNQSxlQUFOLENBQXNCO0FBY2xCQyxFQUFBQSxJQUFJLENBQUNDLEdBQUQsRUFBTUMsUUFBTixFQUFnQkMsS0FBaEIsRUFBdUI7QUFDdkIsSUFBQSxNQUFNLElBQUlDLEtBQUosQ0FBVSxpQkFBVixDQUFOLENBQUE7QUFDSCxHQUFBOztBQVlEQyxFQUFBQSxJQUFJLENBQUNKLEdBQUQsRUFBTUssSUFBTixFQUFZSCxLQUFaLEVBQW1CO0FBQ25CLElBQUEsTUFBTSxJQUFJQyxLQUFKLENBQVUsaUJBQVYsQ0FBTixDQUFBO0FBQ0gsR0FBQTs7QUFXREcsRUFBQUEsS0FBSyxDQUFDSixLQUFELEVBQVFLLE1BQVIsRUFBZ0IsRUFFcEI7O0FBM0NpQjs7OzsifQ==