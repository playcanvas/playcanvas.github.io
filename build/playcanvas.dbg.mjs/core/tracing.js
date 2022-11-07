/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Tracing {

  static set(channel, enabled = true) {
    if (enabled) {
      Tracing._traceChannels.add(channel);
    } else {
      Tracing._traceChannels.delete(channel);
    }
  }

  static get(channel) {
    return Tracing._traceChannels.has(channel);
  }
}
Tracing._traceChannels = new Set();
Tracing.stack = false;

export { Tracing };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2luZy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvdHJhY2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExvZyB0cmFjaW5nIGZ1bmN0aW9uYWxpdHksIGFsbG93aW5nIGZvciB0cmFjaW5nIG9mIHRoZSBpbnRlcm5hbCBmdW5jdGlvbmFsaXR5IG9mIHRoZSBlbmdpbmUuXG4gKiBOb3RlIHRoYXQgdGhlIHRyYWNlIGxvZ2dpbmcgb25seSB0YWtlcyBwbGFjZSBpbiB0aGUgZGVidWcgYnVpbGQgb2YgdGhlIGVuZ2luZSBhbmQgaXMgc3RyaXBwZWRcbiAqIG91dCBpbiBvdGhlciBidWlsZHMuXG4gKi9cbmNsYXNzIFRyYWNpbmcge1xuICAgIC8qKlxuICAgICAqIFNldCBzdG9yaW5nIHRoZSBuYW1lcyBvZiBlbmFibGVkIHRyYWNlIGNoYW5uZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge1NldDxzdHJpbmc+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3RhdGljIF90cmFjZUNoYW5uZWxzID0gbmV3IFNldCgpO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIGNhbGwgc3RhY2sgbG9nZ2luZyBmb3IgdHJhY2UgY2FsbHMuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3RhdGljIHN0YWNrID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgb3IgZGlzYWJsZSBhIHRyYWNlIGNoYW5uZWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhbm5lbCAtIE5hbWUgb2YgdGhlIHRyYWNlIGNoYW5uZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfUkVOREVSX0ZSQU1FfVxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfUkVOREVSX1BBU1N9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9SRU5ERVJfUEFTU19ERVRBSUx9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9SRU5ERVJfQUNUSU9OfVxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfUkVOREVSX1RBUkdFVF9BTExPQ31cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1RFWFRVUkVfQUxMT0N9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9TSEFERVJfQUxMT0N9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9TSEFERVJfQ09NUElMRX1cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1ZSQU1fVEVYVFVSRX1cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1ZSQU1fVkJ9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9WUkFNX0lCfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gTmV3IGVuYWJsZWQgc3RhdGUgZm9yIHRoZSBjaGFubmVsLlxuICAgICAqL1xuICAgIHN0YXRpYyBzZXQoY2hhbm5lbCwgZW5hYmxlZCA9IHRydWUpIHtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICBUcmFjaW5nLl90cmFjZUNoYW5uZWxzLmFkZChjaGFubmVsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIFRyYWNpbmcuX3RyYWNlQ2hhbm5lbHMuZGVsZXRlKGNoYW5uZWwpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgdGhlIHRyYWNlIGNoYW5uZWwgaXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFubmVsIC0gTmFtZSBvZiB0aGUgdHJhY2UgY2hhbm5lbC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUcnVlIGlmIHRoZSB0cmFjZSBjaGFubmVsIGlzIGVuYWJsZWQuXG4gICAgICovXG4gICAgc3RhdGljIGdldChjaGFubmVsKSB7XG4gICAgICAgIHJldHVybiBUcmFjaW5nLl90cmFjZUNoYW5uZWxzLmhhcyhjaGFubmVsKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRyYWNpbmcgfTtcbiJdLCJuYW1lcyI6WyJUcmFjaW5nIiwic2V0IiwiY2hhbm5lbCIsImVuYWJsZWQiLCJfdHJhY2VDaGFubmVscyIsImFkZCIsImRlbGV0ZSIsImdldCIsImhhcyIsIlNldCIsInN0YWNrIl0sIm1hcHBpbmdzIjoiOzs7OztBQUtBLE1BQU1BLE9BQU8sQ0FBQzs7QUFtQ1YsRUFBQSxPQUFPQyxHQUFHLENBQUNDLE9BQU8sRUFBRUMsT0FBTyxHQUFHLElBQUksRUFBRTtBQUdoQyxJQUFBLElBQUlBLE9BQU8sRUFBRTtBQUNUSCxNQUFBQSxPQUFPLENBQUNJLGNBQWMsQ0FBQ0MsR0FBRyxDQUFDSCxPQUFPLENBQUMsQ0FBQTtBQUN2QyxLQUFDLE1BQU07QUFDSEYsTUFBQUEsT0FBTyxDQUFDSSxjQUFjLENBQUNFLE1BQU0sQ0FBQ0osT0FBTyxDQUFDLENBQUE7QUFDMUMsS0FBQTtBQUVKLEdBQUE7O0VBUUEsT0FBT0ssR0FBRyxDQUFDTCxPQUFPLEVBQUU7QUFDaEIsSUFBQSxPQUFPRixPQUFPLENBQUNJLGNBQWMsQ0FBQ0ksR0FBRyxDQUFDTixPQUFPLENBQUMsQ0FBQTtBQUM5QyxHQUFBO0FBQ0osQ0FBQTtBQXZETUYsT0FBTyxDQU9GSSxjQUFjLEdBQUcsSUFBSUssR0FBRyxFQUFFLENBQUE7QUFQL0JULE9BQU8sQ0FjRlUsS0FBSyxHQUFHLEtBQUs7Ozs7In0=