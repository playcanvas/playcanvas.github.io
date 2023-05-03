/**
 * Log tracing functionality, allowing for tracing of the internal functionality of the engine.
 * Note that the trace logging only takes place in the debug build of the engine and is stripped
 * out in other builds.
 */
class Tracing {
  /**
   * Set storing the names of enabled trace channels.
   *
   * @type {Set<string>}
   * @private
   */

  /**
   * Enable call stack logging for trace calls. Defaults to false.
   *
   * @type {boolean}
   */

  /**
   * Enable or disable a trace channel.
   *
   * @param {string} channel - Name of the trace channel. Can be:
   *
   * - {@link TRACEID_RENDER_FRAME}
   * - {@link TRACEID_RENDER_FRAME_TIME}
   * - {@link TRACEID_RENDER_PASS}
   * - {@link TRACEID_RENDER_PASS_DETAIL}
   * - {@link TRACEID_RENDER_ACTION}
   * - {@link TRACEID_RENDER_TARGET_ALLOC}
   * - {@link TRACEID_TEXTURE_ALLOC}
   * - {@link TRACEID_SHADER_ALLOC}
   * - {@link TRACEID_SHADER_COMPILE}
   * - {@link TRACEID_VRAM_TEXTURE}
   * - {@link TRACEID_VRAM_VB}
   * - {@link TRACEID_VRAM_IB}
   * - {@link TRACEID_RENDERPIPELINE_ALLOC}
   * - {@link TRACEID_PIPELINELAYOUT_ALLOC}
   *
   * @param {boolean} enabled - New enabled state for the channel.
   */
  static set(channel, enabled = true) {
    if (enabled) {
      Tracing._traceChannels.add(channel);
    } else {
      Tracing._traceChannels.delete(channel);
    }
  }

  /**
   * Test if the trace channel is enabled.
   *
   * @param {string} channel - Name of the trace channel.
   * @returns {boolean} - True if the trace channel is enabled.
   */
  static get(channel) {
    return Tracing._traceChannels.has(channel);
  }
}
Tracing._traceChannels = new Set();
Tracing.stack = false;

export { Tracing };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2luZy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvdHJhY2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExvZyB0cmFjaW5nIGZ1bmN0aW9uYWxpdHksIGFsbG93aW5nIGZvciB0cmFjaW5nIG9mIHRoZSBpbnRlcm5hbCBmdW5jdGlvbmFsaXR5IG9mIHRoZSBlbmdpbmUuXG4gKiBOb3RlIHRoYXQgdGhlIHRyYWNlIGxvZ2dpbmcgb25seSB0YWtlcyBwbGFjZSBpbiB0aGUgZGVidWcgYnVpbGQgb2YgdGhlIGVuZ2luZSBhbmQgaXMgc3RyaXBwZWRcbiAqIG91dCBpbiBvdGhlciBidWlsZHMuXG4gKi9cbmNsYXNzIFRyYWNpbmcge1xuICAgIC8qKlxuICAgICAqIFNldCBzdG9yaW5nIHRoZSBuYW1lcyBvZiBlbmFibGVkIHRyYWNlIGNoYW5uZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge1NldDxzdHJpbmc+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3RhdGljIF90cmFjZUNoYW5uZWxzID0gbmV3IFNldCgpO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIGNhbGwgc3RhY2sgbG9nZ2luZyBmb3IgdHJhY2UgY2FsbHMuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3RhdGljIHN0YWNrID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgb3IgZGlzYWJsZSBhIHRyYWNlIGNoYW5uZWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhbm5lbCAtIE5hbWUgb2YgdGhlIHRyYWNlIGNoYW5uZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfUkVOREVSX0ZSQU1FfVxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUV9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9SRU5ERVJfUEFTU31cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1JFTkRFUl9QQVNTX0RFVEFJTH1cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1JFTkRFUl9BQ1RJT059XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9SRU5ERVJfVEFSR0VUX0FMTE9DfVxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfVEVYVFVSRV9BTExPQ31cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1NIQURFUl9BTExPQ31cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1NIQURFUl9DT01QSUxFfVxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfVlJBTV9URVhUVVJFfVxuICAgICAqIC0ge0BsaW5rIFRSQUNFSURfVlJBTV9WQn1cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1ZSQU1fSUJ9XG4gICAgICogLSB7QGxpbmsgVFJBQ0VJRF9SRU5ERVJQSVBFTElORV9BTExPQ31cbiAgICAgKiAtIHtAbGluayBUUkFDRUlEX1BJUEVMSU5FTEFZT1VUX0FMTE9DfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkIC0gTmV3IGVuYWJsZWQgc3RhdGUgZm9yIHRoZSBjaGFubmVsLlxuICAgICAqL1xuICAgIHN0YXRpYyBzZXQoY2hhbm5lbCwgZW5hYmxlZCA9IHRydWUpIHtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICBUcmFjaW5nLl90cmFjZUNoYW5uZWxzLmFkZChjaGFubmVsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIFRyYWNpbmcuX3RyYWNlQ2hhbm5lbHMuZGVsZXRlKGNoYW5uZWwpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgdGhlIHRyYWNlIGNoYW5uZWwgaXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFubmVsIC0gTmFtZSBvZiB0aGUgdHJhY2UgY2hhbm5lbC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUcnVlIGlmIHRoZSB0cmFjZSBjaGFubmVsIGlzIGVuYWJsZWQuXG4gICAgICovXG4gICAgc3RhdGljIGdldChjaGFubmVsKSB7XG4gICAgICAgIHJldHVybiBUcmFjaW5nLl90cmFjZUNoYW5uZWxzLmhhcyhjaGFubmVsKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRyYWNpbmcgfTtcbiJdLCJuYW1lcyI6WyJUcmFjaW5nIiwic2V0IiwiY2hhbm5lbCIsImVuYWJsZWQiLCJfdHJhY2VDaGFubmVscyIsImFkZCIsImRlbGV0ZSIsImdldCIsImhhcyIsIlNldCIsInN0YWNrIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsT0FBTyxDQUFDO0FBQ1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSSxFQUFBLE9BQU9DLEdBQUdBLENBQUNDLE9BQU8sRUFBRUMsT0FBTyxHQUFHLElBQUksRUFBRTtBQUdoQyxJQUFBLElBQUlBLE9BQU8sRUFBRTtBQUNUSCxNQUFBQSxPQUFPLENBQUNJLGNBQWMsQ0FBQ0MsR0FBRyxDQUFDSCxPQUFPLENBQUMsQ0FBQTtBQUN2QyxLQUFDLE1BQU07QUFDSEYsTUFBQUEsT0FBTyxDQUFDSSxjQUFjLENBQUNFLE1BQU0sQ0FBQ0osT0FBTyxDQUFDLENBQUE7QUFDMUMsS0FBQTtBQUVKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksT0FBT0ssR0FBR0EsQ0FBQ0wsT0FBTyxFQUFFO0FBQ2hCLElBQUEsT0FBT0YsT0FBTyxDQUFDSSxjQUFjLENBQUNJLEdBQUcsQ0FBQ04sT0FBTyxDQUFDLENBQUE7QUFDOUMsR0FBQTtBQUNKLENBQUE7QUExRE1GLE9BQU8sQ0FPRkksY0FBYyxHQUFHLElBQUlLLEdBQUcsRUFBRSxDQUFBO0FBUC9CVCxPQUFPLENBY0ZVLEtBQUssR0FBRyxLQUFLOzs7OyJ9
