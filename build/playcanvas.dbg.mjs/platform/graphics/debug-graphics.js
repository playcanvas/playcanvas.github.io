/**
 * Internal graphics debug system - gpu markers and similar. Note that the functions only execute in the
 * debug build, and are stripped out in other builds.
 *
 * @ignore
 */
class DebugGraphics {
  /**
   * An array of markers, representing a stack.
   *
   * @type {string[]}
   * @private
   */

  /**
   * Clear internal stack of the GPU markers. It should be called at the start of the frame to
   * prevent the array growing if there are exceptions during the rendering.
   */
  static clearGpuMarkers() {
    DebugGraphics.markers.length = 0;
  }

  /**
   * Push GPU marker to the stack on the device.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {string} name - The name of the marker.
   */
  static pushGpuMarker(device, name) {
    DebugGraphics.markers.push(name);
    device.pushMarker(name);
  }

  /**
   * Pop GPU marker from the stack on the device.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   */
  static popGpuMarker(device) {
    if (DebugGraphics.markers.length) {
      DebugGraphics.markers.pop();
    }
    device.popMarker();
  }

  /**
   * Converts current markers into a single string format.
   *
   * @returns {string} String representation of current markers.
   */
  static toString() {
    return DebugGraphics.markers.join(" | ");
  }
}
DebugGraphics.markers = [];

export { DebugGraphics };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWctZ3JhcGhpY3MuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEludGVybmFsIGdyYXBoaWNzIGRlYnVnIHN5c3RlbSAtIGdwdSBtYXJrZXJzIGFuZCBzaW1pbGFyLiBOb3RlIHRoYXQgdGhlIGZ1bmN0aW9ucyBvbmx5IGV4ZWN1dGUgaW4gdGhlXG4gKiBkZWJ1ZyBidWlsZCwgYW5kIGFyZSBzdHJpcHBlZCBvdXQgaW4gb3RoZXIgYnVpbGRzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgRGVidWdHcmFwaGljcyB7XG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbWFya2VycywgcmVwcmVzZW50aW5nIGEgc3RhY2suXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzdGF0aWMgbWFya2VycyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgaW50ZXJuYWwgc3RhY2sgb2YgdGhlIEdQVSBtYXJrZXJzLiBJdCBzaG91bGQgYmUgY2FsbGVkIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWUgdG9cbiAgICAgKiBwcmV2ZW50IHRoZSBhcnJheSBncm93aW5nIGlmIHRoZXJlIGFyZSBleGNlcHRpb25zIGR1cmluZyB0aGUgcmVuZGVyaW5nLlxuICAgICAqL1xuICAgIHN0YXRpYyBjbGVhckdwdU1hcmtlcnMoKSB7XG4gICAgICAgIERlYnVnR3JhcGhpY3MubWFya2Vycy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFB1c2ggR1BVIG1hcmtlciB0byB0aGUgc3RhY2sgb24gdGhlIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIG1hcmtlci5cbiAgICAgKi9cbiAgICBzdGF0aWMgcHVzaEdwdU1hcmtlcihkZXZpY2UsIG5hbWUpIHtcbiAgICAgICAgRGVidWdHcmFwaGljcy5tYXJrZXJzLnB1c2gobmFtZSk7XG4gICAgICAgIGRldmljZS5wdXNoTWFya2VyKG5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBvcCBHUFUgbWFya2VyIGZyb20gdGhlIHN0YWNrIG9uIHRoZSBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgcG9wR3B1TWFya2VyKGRldmljZSkge1xuICAgICAgICBpZiAoRGVidWdHcmFwaGljcy5tYXJrZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5tYXJrZXJzLnBvcCgpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5wb3BNYXJrZXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBjdXJyZW50IG1hcmtlcnMgaW50byBhIHNpbmdsZSBzdHJpbmcgZm9ybWF0LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGN1cnJlbnQgbWFya2Vycy5cbiAgICAgKi9cbiAgICBzdGF0aWMgdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiBEZWJ1Z0dyYXBoaWNzLm1hcmtlcnMuam9pbihcIiB8IFwiKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IERlYnVnR3JhcGhpY3MgfTtcbiJdLCJuYW1lcyI6WyJEZWJ1Z0dyYXBoaWNzIiwiY2xlYXJHcHVNYXJrZXJzIiwibWFya2VycyIsImxlbmd0aCIsInB1c2hHcHVNYXJrZXIiLCJkZXZpY2UiLCJuYW1lIiwicHVzaCIsInB1c2hNYXJrZXIiLCJwb3BHcHVNYXJrZXIiLCJwb3AiLCJwb3BNYXJrZXIiLCJ0b1N0cmluZyIsImpvaW4iXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7RUFDSSxPQUFPQyxlQUFlQSxHQUFHO0FBQ3JCRCxJQUFBQSxhQUFhLENBQUNFLE9BQU8sQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUNwQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJLEVBQUEsT0FBT0MsYUFBYUEsQ0FBQ0MsTUFBTSxFQUFFQyxJQUFJLEVBQUU7QUFDL0JOLElBQUFBLGFBQWEsQ0FBQ0UsT0FBTyxDQUFDSyxJQUFJLENBQUNELElBQUksQ0FBQyxDQUFBO0FBQ2hDRCxJQUFBQSxNQUFNLENBQUNHLFVBQVUsQ0FBQ0YsSUFBSSxDQUFDLENBQUE7QUFDM0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksT0FBT0csWUFBWUEsQ0FBQ0osTUFBTSxFQUFFO0FBQ3hCLElBQUEsSUFBSUwsYUFBYSxDQUFDRSxPQUFPLENBQUNDLE1BQU0sRUFBRTtBQUM5QkgsTUFBQUEsYUFBYSxDQUFDRSxPQUFPLENBQUNRLEdBQUcsRUFBRSxDQUFBO0FBQy9CLEtBQUE7SUFDQUwsTUFBTSxDQUFDTSxTQUFTLEVBQUUsQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxPQUFPQyxRQUFRQSxHQUFHO0FBQ2QsSUFBQSxPQUFPWixhQUFhLENBQUNFLE9BQU8sQ0FBQ1csSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzVDLEdBQUE7QUFDSixDQUFBO0FBaERNYixhQUFhLENBT1JFLE9BQU8sR0FBRyxFQUFFOzs7OyJ9
