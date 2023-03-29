/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../core/event-handler.js';

/**
 * A TextureAtlas contains a number of frames from a texture. Each frame defines a region in a
 * texture. The TextureAtlas is referenced by {@link Sprite}s.
 *
 * @augments EventHandler
 */
class TextureAtlas extends EventHandler {
  /**
   * Create a new TextureAtlas instance.
   *
   * @example
   * var atlas = new pc.TextureAtlas();
   * atlas.frames = {
   *     '0': {
   *         // rect has u, v, width and height in pixels
   *         rect: new pc.Vec4(0, 0, 256, 256),
   *         // pivot has x, y values between 0-1 which define the point
   *         // within the frame around which rotation and scale is calculated
   *         pivot: new pc.Vec2(0.5, 0.5),
   *         // border has left, bottom, right and top in pixels defining regions for 9-slicing
   *         border: new pc.Vec4(5, 5, 5, 5)
   *     },
   *     '1': {
   *         rect: new pc.Vec4(256, 0, 256, 256),
   *         pivot: new pc.Vec2(0.5, 0.5),
   *         border: new pc.Vec4(5, 5, 5, 5)
   *     }
   * };
   */
  constructor() {
    super();

    /**
     * @type {import('../platform/graphics/texture.js').Texture}
     * @private
     */
    this._texture = null;
    /**
     * @type {object}
     * @private
     */
    this._frames = null;
  }

  /**
   * The texture used by the atlas.
   *
   * @type {import('../platform/graphics/texture.js').Texture}
   */
  set texture(value) {
    this._texture = value;
    this.fire('set:texture', value);
  }
  get texture() {
    return this._texture;
  }

  /**
   * Contains frames which define portions of the texture atlas.
   *
   * @type {object}
   */
  set frames(value) {
    this._frames = value;
    this.fire('set:frames', value);
  }
  get frames() {
    return this._frames;
  }

  /**
   * Set a new frame in the texture atlas.
   *
   * @param {string} key - The key of the frame.
   * @param {object} data - The properties of the frame.
   * @param {import('../core/math/vec4.js').Vec4} data.rect - The u, v, width, height properties
   * of the frame in pixels.
   * @param {import('../core/math/vec2.js').Vec2} data.pivot - The pivot of the frame - values
   * are between 0-1.
   * @param {import('../core/math/vec4.js').Vec4} data.border - The border of the frame for
   * 9-slicing. Values are ordered as follows: left, bottom, right, top border in pixels.
   * @example
   * atlas.setFrame('1', {
   *     rect: new pc.Vec4(0, 0, 128, 128),
   *     pivot: new pc.Vec2(0.5, 0.5),
   *     border: new pc.Vec4(5, 5, 5, 5)
   * });
   */
  setFrame(key, data) {
    let frame = this._frames[key];
    if (!frame) {
      frame = {
        rect: data.rect.clone(),
        pivot: data.pivot.clone(),
        border: data.border.clone()
      };
      this._frames[key] = frame;
    } else {
      frame.rect.copy(data.rect);
      frame.pivot.copy(data.pivot);
      frame.border.copy(data.border);
    }
    this.fire('set:frame', key.toString(), frame);
  }

  /**
   * Removes a frame from the texture atlas.
   *
   * @param {string} key - The key of the frame.
   * @example
   * atlas.removeFrame('1');
   */
  removeFrame(key) {
    const frame = this._frames[key];
    if (frame) {
      delete this._frames[key];
      this.fire('remove:frame', key.toString(), frame);
    }
  }

  /**
   * Free up the underlying texture owned by the atlas.
   */
  destroy() {
    if (this._texture) {
      this._texture.destroy();
    }
  }
}

export { TextureAtlas };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS1hdGxhcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3RleHR1cmUtYXRsYXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuLyoqXG4gKiBBIFRleHR1cmVBdGxhcyBjb250YWlucyBhIG51bWJlciBvZiBmcmFtZXMgZnJvbSBhIHRleHR1cmUuIEVhY2ggZnJhbWUgZGVmaW5lcyBhIHJlZ2lvbiBpbiBhXG4gKiB0ZXh0dXJlLiBUaGUgVGV4dHVyZUF0bGFzIGlzIHJlZmVyZW5jZWQgYnkge0BsaW5rIFNwcml0ZX1zLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgVGV4dHVyZUF0bGFzIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVGV4dHVyZUF0bGFzIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXRsYXMgPSBuZXcgcGMuVGV4dHVyZUF0bGFzKCk7XG4gICAgICogYXRsYXMuZnJhbWVzID0ge1xuICAgICAqICAgICAnMCc6IHtcbiAgICAgKiAgICAgICAgIC8vIHJlY3QgaGFzIHUsIHYsIHdpZHRoIGFuZCBoZWlnaHQgaW4gcGl4ZWxzXG4gICAgICogICAgICAgICByZWN0OiBuZXcgcGMuVmVjNCgwLCAwLCAyNTYsIDI1NiksXG4gICAgICogICAgICAgICAvLyBwaXZvdCBoYXMgeCwgeSB2YWx1ZXMgYmV0d2VlbiAwLTEgd2hpY2ggZGVmaW5lIHRoZSBwb2ludFxuICAgICAqICAgICAgICAgLy8gd2l0aGluIHRoZSBmcmFtZSBhcm91bmQgd2hpY2ggcm90YXRpb24gYW5kIHNjYWxlIGlzIGNhbGN1bGF0ZWRcbiAgICAgKiAgICAgICAgIHBpdm90OiBuZXcgcGMuVmVjMigwLjUsIDAuNSksXG4gICAgICogICAgICAgICAvLyBib3JkZXIgaGFzIGxlZnQsIGJvdHRvbSwgcmlnaHQgYW5kIHRvcCBpbiBwaXhlbHMgZGVmaW5pbmcgcmVnaW9ucyBmb3IgOS1zbGljaW5nXG4gICAgICogICAgICAgICBib3JkZXI6IG5ldyBwYy5WZWM0KDUsIDUsIDUsIDUpXG4gICAgICogICAgIH0sXG4gICAgICogICAgICcxJzoge1xuICAgICAqICAgICAgICAgcmVjdDogbmV3IHBjLlZlYzQoMjU2LCAwLCAyNTYsIDI1NiksXG4gICAgICogICAgICAgICBwaXZvdDogbmV3IHBjLlZlYzIoMC41LCAwLjUpLFxuICAgICAqICAgICAgICAgYm9yZGVyOiBuZXcgcGMuVmVjNCg1LCA1LCA1LCA1KVxuICAgICAqICAgICB9XG4gICAgICogfTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl90ZXh0dXJlID0gbnVsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9mcmFtZXMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0ZXh0dXJlIHVzZWQgYnkgdGhlIGF0bGFzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICovXG4gICAgc2V0IHRleHR1cmUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDp0ZXh0dXJlJywgdmFsdWUpO1xuICAgIH1cblxuICAgIGdldCB0ZXh0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250YWlucyBmcmFtZXMgd2hpY2ggZGVmaW5lIHBvcnRpb25zIG9mIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBzZXQgZnJhbWVzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2ZyYW1lcyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpmcmFtZXMnLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGZyYW1lcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZyYW1lcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgYSBuZXcgZnJhbWUgaW4gdGhlIHRleHR1cmUgYXRsYXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVGhlIGtleSBvZiB0aGUgZnJhbWUuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBUaGUgcHJvcGVydGllcyBvZiB0aGUgZnJhbWUuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gZGF0YS5yZWN0IC0gVGhlIHUsIHYsIHdpZHRoLCBoZWlnaHQgcHJvcGVydGllc1xuICAgICAqIG9mIHRoZSBmcmFtZSBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMyLmpzJykuVmVjMn0gZGF0YS5waXZvdCAtIFRoZSBwaXZvdCBvZiB0aGUgZnJhbWUgLSB2YWx1ZXNcbiAgICAgKiBhcmUgYmV0d2VlbiAwLTEuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gZGF0YS5ib3JkZXIgLSBUaGUgYm9yZGVyIG9mIHRoZSBmcmFtZSBmb3JcbiAgICAgKiA5LXNsaWNpbmcuIFZhbHVlcyBhcmUgb3JkZXJlZCBhcyBmb2xsb3dzOiBsZWZ0LCBib3R0b20sIHJpZ2h0LCB0b3AgYm9yZGVyIGluIHBpeGVscy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGF0bGFzLnNldEZyYW1lKCcxJywge1xuICAgICAqICAgICByZWN0OiBuZXcgcGMuVmVjNCgwLCAwLCAxMjgsIDEyOCksXG4gICAgICogICAgIHBpdm90OiBuZXcgcGMuVmVjMigwLjUsIDAuNSksXG4gICAgICogICAgIGJvcmRlcjogbmV3IHBjLlZlYzQoNSwgNSwgNSwgNSlcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzZXRGcmFtZShrZXksIGRhdGEpIHtcbiAgICAgICAgbGV0IGZyYW1lID0gdGhpcy5fZnJhbWVzW2tleV07XG4gICAgICAgIGlmICghZnJhbWUpIHtcbiAgICAgICAgICAgIGZyYW1lID0ge1xuICAgICAgICAgICAgICAgIHJlY3Q6IGRhdGEucmVjdC5jbG9uZSgpLFxuICAgICAgICAgICAgICAgIHBpdm90OiBkYXRhLnBpdm90LmNsb25lKCksXG4gICAgICAgICAgICAgICAgYm9yZGVyOiBkYXRhLmJvcmRlci5jbG9uZSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5fZnJhbWVzW2tleV0gPSBmcmFtZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyYW1lLnJlY3QuY29weShkYXRhLnJlY3QpO1xuICAgICAgICAgICAgZnJhbWUucGl2b3QuY29weShkYXRhLnBpdm90KTtcbiAgICAgICAgICAgIGZyYW1lLmJvcmRlci5jb3B5KGRhdGEuYm9yZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmZyYW1lJywga2V5LnRvU3RyaW5nKCksIGZyYW1lKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgZnJhbWUgZnJvbSB0aGUgdGV4dHVyZSBhdGxhcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBUaGUga2V5IG9mIHRoZSBmcmFtZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGF0bGFzLnJlbW92ZUZyYW1lKCcxJyk7XG4gICAgICovXG4gICAgcmVtb3ZlRnJhbWUoa2V5KSB7XG4gICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5fZnJhbWVzW2tleV07XG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2ZyYW1lc1trZXldO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmU6ZnJhbWUnLCBrZXkudG9TdHJpbmcoKSwgZnJhbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZSB1cCB0aGUgdW5kZXJseWluZyB0ZXh0dXJlIG93bmVkIGJ5IHRoZSBhdGxhcy5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IFRleHR1cmVBdGxhcyB9O1xuIl0sIm5hbWVzIjpbIlRleHR1cmVBdGxhcyIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiX3RleHR1cmUiLCJfZnJhbWVzIiwidGV4dHVyZSIsInZhbHVlIiwiZmlyZSIsImZyYW1lcyIsInNldEZyYW1lIiwia2V5IiwiZGF0YSIsImZyYW1lIiwicmVjdCIsImNsb25lIiwicGl2b3QiLCJib3JkZXIiLCJjb3B5IiwidG9TdHJpbmciLCJyZW1vdmVGcmFtZSIsImRlc3Ryb3kiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxZQUFZLFNBQVNDLFlBQVksQ0FBQztBQUNwQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFB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
