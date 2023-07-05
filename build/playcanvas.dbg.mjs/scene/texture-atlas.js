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
   * const atlas = new pc.TextureAtlas();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS1hdGxhcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL3RleHR1cmUtYXRsYXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuLyoqXG4gKiBBIFRleHR1cmVBdGxhcyBjb250YWlucyBhIG51bWJlciBvZiBmcmFtZXMgZnJvbSBhIHRleHR1cmUuIEVhY2ggZnJhbWUgZGVmaW5lcyBhIHJlZ2lvbiBpbiBhXG4gKiB0ZXh0dXJlLiBUaGUgVGV4dHVyZUF0bGFzIGlzIHJlZmVyZW5jZWQgYnkge0BsaW5rIFNwcml0ZX1zLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgVGV4dHVyZUF0bGFzIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVGV4dHVyZUF0bGFzIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhdGxhcyA9IG5ldyBwYy5UZXh0dXJlQXRsYXMoKTtcbiAgICAgKiBhdGxhcy5mcmFtZXMgPSB7XG4gICAgICogICAgICcwJzoge1xuICAgICAqICAgICAgICAgLy8gcmVjdCBoYXMgdSwgdiwgd2lkdGggYW5kIGhlaWdodCBpbiBwaXhlbHNcbiAgICAgKiAgICAgICAgIHJlY3Q6IG5ldyBwYy5WZWM0KDAsIDAsIDI1NiwgMjU2KSxcbiAgICAgKiAgICAgICAgIC8vIHBpdm90IGhhcyB4LCB5IHZhbHVlcyBiZXR3ZWVuIDAtMSB3aGljaCBkZWZpbmUgdGhlIHBvaW50XG4gICAgICogICAgICAgICAvLyB3aXRoaW4gdGhlIGZyYW1lIGFyb3VuZCB3aGljaCByb3RhdGlvbiBhbmQgc2NhbGUgaXMgY2FsY3VsYXRlZFxuICAgICAqICAgICAgICAgcGl2b3Q6IG5ldyBwYy5WZWMyKDAuNSwgMC41KSxcbiAgICAgKiAgICAgICAgIC8vIGJvcmRlciBoYXMgbGVmdCwgYm90dG9tLCByaWdodCBhbmQgdG9wIGluIHBpeGVscyBkZWZpbmluZyByZWdpb25zIGZvciA5LXNsaWNpbmdcbiAgICAgKiAgICAgICAgIGJvcmRlcjogbmV3IHBjLlZlYzQoNSwgNSwgNSwgNSlcbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgJzEnOiB7XG4gICAgICogICAgICAgICByZWN0OiBuZXcgcGMuVmVjNCgyNTYsIDAsIDI1NiwgMjU2KSxcbiAgICAgKiAgICAgICAgIHBpdm90OiBuZXcgcGMuVmVjMigwLjUsIDAuNSksXG4gICAgICogICAgICAgICBib3JkZXI6IG5ldyBwYy5WZWM0KDUsIDUsIDUsIDUpXG4gICAgICogICAgIH1cbiAgICAgKiB9O1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3RleHR1cmUgPSBudWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge29iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2ZyYW1lcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHRleHR1cmUgdXNlZCBieSB0aGUgYXRsYXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKi9cbiAgICBzZXQgdGV4dHVyZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl90ZXh0dXJlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnRleHR1cmUnLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRhaW5zIGZyYW1lcyB3aGljaCBkZWZpbmUgcG9ydGlvbnMgb2YgdGhlIHRleHR1cmUgYXRsYXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqL1xuICAgIHNldCBmcmFtZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZnJhbWVzID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmZyYW1lcycsIHZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgZnJhbWVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZnJhbWVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBhIG5ldyBmcmFtZSBpbiB0aGUgdGV4dHVyZSBhdGxhcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBUaGUga2V5IG9mIHRoZSBmcmFtZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIFRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBmcmFtZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fSBkYXRhLnJlY3QgLSBUaGUgdSwgdiwgd2lkdGgsIGhlaWdodCBwcm9wZXJ0aWVzXG4gICAgICogb2YgdGhlIGZyYW1lIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29yZS9tYXRoL3ZlYzIuanMnKS5WZWMyfSBkYXRhLnBpdm90IC0gVGhlIHBpdm90IG9mIHRoZSBmcmFtZSAtIHZhbHVlc1xuICAgICAqIGFyZSBiZXR3ZWVuIDAtMS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fSBkYXRhLmJvcmRlciAtIFRoZSBib3JkZXIgb2YgdGhlIGZyYW1lIGZvclxuICAgICAqIDktc2xpY2luZy4gVmFsdWVzIGFyZSBvcmRlcmVkIGFzIGZvbGxvd3M6IGxlZnQsIGJvdHRvbSwgcmlnaHQsIHRvcCBib3JkZXIgaW4gcGl4ZWxzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXRsYXMuc2V0RnJhbWUoJzEnLCB7XG4gICAgICogICAgIHJlY3Q6IG5ldyBwYy5WZWM0KDAsIDAsIDEyOCwgMTI4KSxcbiAgICAgKiAgICAgcGl2b3Q6IG5ldyBwYy5WZWMyKDAuNSwgMC41KSxcbiAgICAgKiAgICAgYm9yZGVyOiBuZXcgcGMuVmVjNCg1LCA1LCA1LCA1KVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHNldEZyYW1lKGtleSwgZGF0YSkge1xuICAgICAgICBsZXQgZnJhbWUgPSB0aGlzLl9mcmFtZXNba2V5XTtcbiAgICAgICAgaWYgKCFmcmFtZSkge1xuICAgICAgICAgICAgZnJhbWUgPSB7XG4gICAgICAgICAgICAgICAgcmVjdDogZGF0YS5yZWN0LmNsb25lKCksXG4gICAgICAgICAgICAgICAgcGl2b3Q6IGRhdGEucGl2b3QuY2xvbmUoKSxcbiAgICAgICAgICAgICAgICBib3JkZXI6IGRhdGEuYm9yZGVyLmNsb25lKClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLl9mcmFtZXNba2V5XSA9IGZyYW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWUucmVjdC5jb3B5KGRhdGEucmVjdCk7XG4gICAgICAgICAgICBmcmFtZS5waXZvdC5jb3B5KGRhdGEucGl2b3QpO1xuICAgICAgICAgICAgZnJhbWUuYm9yZGVyLmNvcHkoZGF0YS5ib3JkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6ZnJhbWUnLCBrZXkudG9TdHJpbmcoKSwgZnJhbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBmcmFtZSBmcm9tIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFRoZSBrZXkgb2YgdGhlIGZyYW1lLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXRsYXMucmVtb3ZlRnJhbWUoJzEnKTtcbiAgICAgKi9cbiAgICByZW1vdmVGcmFtZShrZXkpIHtcbiAgICAgICAgY29uc3QgZnJhbWUgPSB0aGlzLl9mcmFtZXNba2V5XTtcbiAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZnJhbWVzW2tleV07XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZTpmcmFtZScsIGtleS50b1N0cmluZygpLCBmcmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHVwIHRoZSB1bmRlcmx5aW5nIHRleHR1cmUgb3duZWQgYnkgdGhlIGF0bGFzLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgVGV4dHVyZUF0bGFzIH07XG4iXSwibmFtZXMiOlsiVGV4dHVyZUF0bGFzIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJfdGV4dHVyZSIsIl9mcmFtZXMiLCJ0ZXh0dXJlIiwidmFsdWUiLCJmaXJlIiwiZnJhbWVzIiwic2V0RnJhbWUiLCJrZXkiLCJkYXRhIiwiZnJhbWUiLCJyZWN0IiwiY2xvbmUiLCJwaXZvdCIsImJvcmRlciIsImNvcHkiLCJ0b1N0cmluZyIsInJlbW92ZUZyYW1lIiwiZGVzdHJveSJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxZQUFZLFNBQVNDLFlBQVksQ0FBQztBQUNwQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxX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
