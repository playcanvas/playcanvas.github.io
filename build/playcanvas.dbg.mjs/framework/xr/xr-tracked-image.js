import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * The tracked image interface that is created by the Image Tracking system and is provided as a
 * list from {@link XrImageTracking#images}. It contains information about the tracking state as
 * well as the position and rotation of the tracked image.
 *
 * @augments EventHandler
 */
class XrTrackedImage extends EventHandler {
  /**
   * The tracked image interface that is created by the Image Tracking system and is provided as
   * a list from {@link XrImageTracking#images}. It contains information about the tracking state
   * as well as the position and rotation of the tracked image.
   *
   * @param {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap} image - Image
   * that is matching the real world image as closely as possible. Resolution of images should be
   * at least 300x300. High resolution does NOT improve tracking performance. Color of image is
   * irrelevant, so grayscale images can be used. Images with too many geometric features or
   * repeating patterns will reduce tracking stability.
   * @param {number} width - Width (in meters) of image in real world. Providing this value as
   * close to the real value will improve tracking quality.
   * @hideconstructor
   */
  constructor(image, width) {
    super();
    /**
     * @type {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap}
     * @private
     */
    this._image = void 0;
    /**
     * @type {number}
     * @private
     */
    this._width = void 0;
    /**
     * @type {ImageBitmap|null}
     * @private
     */
    this._bitmap = null;
    /**
     * @type {number}
     * @ignore
     */
    this._measuredWidth = 0;
    /**
     * @type {boolean}
     * @private
     */
    this._trackable = false;
    /**
     * @type {boolean}
     * @private
     */
    this._tracking = false;
    /**
     * @type {boolean}
     * @private
     */
    this._emulated = false;
    /**
     * @type {*}
     * @ignore
     */
    this._pose = null;
    /**
     * @type {Vec3}
     * @private
     */
    this._position = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this._rotation = new Quat();
    this._image = image;
    this._width = width;
  }

  /**
   * Fired when image becomes actively tracked.
   *
   * @event XrTrackedImage#tracked
   */

  /**
   * Fired when image is no more actively tracked.
   *
   * @event XrTrackedImage#untracked
   */

  /**
   * Image that is used for tracking.
   *
   * @type {HTMLCanvasElement|HTMLImageElement|SVGImageElement|HTMLVideoElement|Blob|ImageData|ImageBitmap}
   */
  get image() {
    return this._image;
  }

  /**
   * Width that is provided to assist tracking performance. This property can be updated only
   * when the AR session is not running.
   *
   * @type {number}
   */
  set width(value) {
    this._width = value;
  }
  get width() {
    return this._width;
  }

  /**
   * True if image is trackable. A too small resolution or invalid images can be untrackable by
   * the underlying AR system.
   *
   * @type {boolean}
   */
  get trackable() {
    return this._trackable;
  }

  /**
   * True if image is in tracking state and being tracked in real world by the underlying AR
   * system.
   *
   * @type {boolean}
   */
  get tracking() {
    return this._tracking;
  }

  /**
   * True if image was recently tracked but currently is not actively tracked due to inability of
   * identifying the image by the underlying AR system. Position and rotation will be based on
   * the previously known transformation assuming the tracked image has not moved.
   *
   * @type {boolean}
   */
  get emulated() {
    return this._emulated;
  }

  /**
   * @returns {Promise<ImageBitmap>} Promise that resolves to an image bitmap.
   * @ignore
   */
  prepare() {
    if (this._bitmap) {
      return {
        image: this._bitmap,
        widthInMeters: this._width
      };
    }
    return createImageBitmap(this._image).then(bitmap => {
      this._bitmap = bitmap;
      return {
        image: this._bitmap,
        widthInMeters: this._width
      };
    });
  }

  /**
   * Destroys the tracked image.
   *
   * @ignore
   */
  destroy() {
    this._image = null;
    this._pose = null;
    if (this._bitmap) {
      this._bitmap.close();
      this._bitmap = null;
    }
  }

  /**
   * Get the position of the tracked image. The position is the most recent one based on the
   * tracked image state.
   *
   * @returns {Vec3} Position in world space.
   * @example
   * // update entity position to match tracked image position
   * entity.setPosition(trackedImage.getPosition());
   */
  getPosition() {
    if (this._pose) this._position.copy(this._pose.transform.position);
    return this._position;
  }

  /**
   * Get the rotation of the tracked image. The rotation is the most recent based on the tracked
   * image state.
   *
   * @returns {Quat} Rotation in world space.
   * @example
   * // update entity rotation to match tracked image rotation
   * entity.setRotation(trackedImage.getRotation());
   */
  getRotation() {
    if (this._pose) this._rotation.copy(this._pose.transform.orientation);
    return this._rotation;
  }
}

export { XrTrackedImage };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItdHJhY2tlZC1pbWFnZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci10cmFja2VkLWltYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcblxuLyoqXG4gKiBUaGUgdHJhY2tlZCBpbWFnZSBpbnRlcmZhY2UgdGhhdCBpcyBjcmVhdGVkIGJ5IHRoZSBJbWFnZSBUcmFja2luZyBzeXN0ZW0gYW5kIGlzIHByb3ZpZGVkIGFzIGFcbiAqIGxpc3QgZnJvbSB7QGxpbmsgWHJJbWFnZVRyYWNraW5nI2ltYWdlc30uIEl0IGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSB0cmFja2luZyBzdGF0ZSBhc1xuICogd2VsbCBhcyB0aGUgcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIHRoZSB0cmFja2VkIGltYWdlLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJUcmFja2VkSW1hZ2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fFNWR0ltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEJsb2J8SW1hZ2VEYXRhfEltYWdlQml0bWFwfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ltYWdlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF93aWR0aDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtJbWFnZUJpdG1hcHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JpdG1hcCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfbWVhc3VyZWRXaWR0aCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90cmFja2FibGUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RyYWNraW5nID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbXVsYXRlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUgeyp9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9wb3NlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Bvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0cmFja2VkIGltYWdlIGludGVyZmFjZSB0aGF0IGlzIGNyZWF0ZWQgYnkgdGhlIEltYWdlIFRyYWNraW5nIHN5c3RlbSBhbmQgaXMgcHJvdmlkZWQgYXNcbiAgICAgKiBhIGxpc3QgZnJvbSB7QGxpbmsgWHJJbWFnZVRyYWNraW5nI2ltYWdlc30uIEl0IGNvbnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSB0cmFja2luZyBzdGF0ZVxuICAgICAqIGFzIHdlbGwgYXMgdGhlIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiB0aGUgdHJhY2tlZCBpbWFnZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR8SFRNTEltYWdlRWxlbWVudHxTVkdJbWFnZUVsZW1lbnR8SFRNTFZpZGVvRWxlbWVudHxCbG9ifEltYWdlRGF0YXxJbWFnZUJpdG1hcH0gaW1hZ2UgLSBJbWFnZVxuICAgICAqIHRoYXQgaXMgbWF0Y2hpbmcgdGhlIHJlYWwgd29ybGQgaW1hZ2UgYXMgY2xvc2VseSBhcyBwb3NzaWJsZS4gUmVzb2x1dGlvbiBvZiBpbWFnZXMgc2hvdWxkIGJlXG4gICAgICogYXQgbGVhc3QgMzAweDMwMC4gSGlnaCByZXNvbHV0aW9uIGRvZXMgTk9UIGltcHJvdmUgdHJhY2tpbmcgcGVyZm9ybWFuY2UuIENvbG9yIG9mIGltYWdlIGlzXG4gICAgICogaXJyZWxldmFudCwgc28gZ3JheXNjYWxlIGltYWdlcyBjYW4gYmUgdXNlZC4gSW1hZ2VzIHdpdGggdG9vIG1hbnkgZ2VvbWV0cmljIGZlYXR1cmVzIG9yXG4gICAgICogcmVwZWF0aW5nIHBhdHRlcm5zIHdpbGwgcmVkdWNlIHRyYWNraW5nIHN0YWJpbGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBXaWR0aCAoaW4gbWV0ZXJzKSBvZiBpbWFnZSBpbiByZWFsIHdvcmxkLiBQcm92aWRpbmcgdGhpcyB2YWx1ZSBhc1xuICAgICAqIGNsb3NlIHRvIHRoZSByZWFsIHZhbHVlIHdpbGwgaW1wcm92ZSB0cmFja2luZyBxdWFsaXR5LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihpbWFnZSwgd2lkdGgpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9pbWFnZSA9IGltYWdlO1xuICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW1hZ2UgYmVjb21lcyBhY3RpdmVseSB0cmFja2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyVHJhY2tlZEltYWdlI3RyYWNrZWRcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW1hZ2UgaXMgbm8gbW9yZSBhY3RpdmVseSB0cmFja2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyVHJhY2tlZEltYWdlI3VudHJhY2tlZFxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogSW1hZ2UgdGhhdCBpcyB1c2VkIGZvciB0cmFja2luZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fFNWR0ltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEJsb2J8SW1hZ2VEYXRhfEltYWdlQml0bWFwfVxuICAgICAqL1xuICAgIGdldCBpbWFnZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIHRoYXQgaXMgcHJvdmlkZWQgdG8gYXNzaXN0IHRyYWNraW5nIHBlcmZvcm1hbmNlLiBUaGlzIHByb3BlcnR5IGNhbiBiZSB1cGRhdGVkIG9ubHlcbiAgICAgKiB3aGVuIHRoZSBBUiBzZXNzaW9uIGlzIG5vdCBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIGltYWdlIGlzIHRyYWNrYWJsZS4gQSB0b28gc21hbGwgcmVzb2x1dGlvbiBvciBpbnZhbGlkIGltYWdlcyBjYW4gYmUgdW50cmFja2FibGUgYnlcbiAgICAgKiB0aGUgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdHJhY2thYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHJhY2thYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaW1hZ2UgaXMgaW4gdHJhY2tpbmcgc3RhdGUgYW5kIGJlaW5nIHRyYWNrZWQgaW4gcmVhbCB3b3JsZCBieSB0aGUgdW5kZXJseWluZyBBUlxuICAgICAqIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0cmFja2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RyYWNraW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaW1hZ2Ugd2FzIHJlY2VudGx5IHRyYWNrZWQgYnV0IGN1cnJlbnRseSBpcyBub3QgYWN0aXZlbHkgdHJhY2tlZCBkdWUgdG8gaW5hYmlsaXR5IG9mXG4gICAgICogaWRlbnRpZnlpbmcgdGhlIGltYWdlIGJ5IHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS4gUG9zaXRpb24gYW5kIHJvdGF0aW9uIHdpbGwgYmUgYmFzZWQgb25cbiAgICAgKiB0aGUgcHJldmlvdXNseSBrbm93biB0cmFuc2Zvcm1hdGlvbiBhc3N1bWluZyB0aGUgdHJhY2tlZCBpbWFnZSBoYXMgbm90IG1vdmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGVtdWxhdGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW11bGF0ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8SW1hZ2VCaXRtYXA+fSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gaW1hZ2UgYml0bWFwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBwcmVwYXJlKCkge1xuICAgICAgICBpZiAodGhpcy5fYml0bWFwKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGltYWdlOiB0aGlzLl9iaXRtYXAsXG4gICAgICAgICAgICAgICAgd2lkdGhJbk1ldGVyczogdGhpcy5fd2lkdGhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3JlYXRlSW1hZ2VCaXRtYXAodGhpcy5faW1hZ2UpXG4gICAgICAgICAgICAudGhlbigoYml0bWFwKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYml0bWFwID0gYml0bWFwO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGltYWdlOiB0aGlzLl9iaXRtYXAsXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoSW5NZXRlcnM6IHRoaXMuX3dpZHRoXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHRoZSB0cmFja2VkIGltYWdlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcG9zZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JpdG1hcCkge1xuICAgICAgICAgICAgdGhpcy5fYml0bWFwLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLl9iaXRtYXAgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwb3NpdGlvbiBvZiB0aGUgdHJhY2tlZCBpbWFnZS4gVGhlIHBvc2l0aW9uIGlzIHRoZSBtb3N0IHJlY2VudCBvbmUgYmFzZWQgb24gdGhlXG4gICAgICogdHJhY2tlZCBpbWFnZSBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBQb3NpdGlvbiBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHVwZGF0ZSBlbnRpdHkgcG9zaXRpb24gdG8gbWF0Y2ggdHJhY2tlZCBpbWFnZSBwb3NpdGlvblxuICAgICAqIGVudGl0eS5zZXRQb3NpdGlvbih0cmFja2VkSW1hZ2UuZ2V0UG9zaXRpb24oKSk7XG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl9wb3NlKSB0aGlzLl9wb3NpdGlvbi5jb3B5KHRoaXMuX3Bvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcm90YXRpb24gb2YgdGhlIHRyYWNrZWQgaW1hZ2UuIFRoZSByb3RhdGlvbiBpcyB0aGUgbW9zdCByZWNlbnQgYmFzZWQgb24gdGhlIHRyYWNrZWRcbiAgICAgKiBpbWFnZSBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBSb3RhdGlvbiBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHVwZGF0ZSBlbnRpdHkgcm90YXRpb24gdG8gbWF0Y2ggdHJhY2tlZCBpbWFnZSByb3RhdGlvblxuICAgICAqIGVudGl0eS5zZXRSb3RhdGlvbih0cmFja2VkSW1hZ2UuZ2V0Um90YXRpb24oKSk7XG4gICAgICovXG4gICAgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl9wb3NlKSB0aGlzLl9yb3RhdGlvbi5jb3B5KHRoaXMuX3Bvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JvdGF0aW9uO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJUcmFja2VkSW1hZ2UgfTtcbiJdLCJuYW1lcyI6WyJYclRyYWNrZWRJbWFnZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiaW1hZ2UiLCJ3aWR0aCIsIl9pbWFnZSIsIl93aWR0aCIsIl9iaXRtYXAiLCJfbWVhc3VyZWRXaWR0aCIsIl90cmFja2FibGUiLCJfdHJhY2tpbmciLCJfZW11bGF0ZWQiLCJfcG9zZSIsIl9wb3NpdGlvbiIsIlZlYzMiLCJfcm90YXRpb24iLCJRdWF0IiwidmFsdWUiLCJ0cmFja2FibGUiLCJ0cmFja2luZyIsImVtdWxhdGVkIiwicHJlcGFyZSIsIndpZHRoSW5NZXRlcnMiLCJjcmVhdGVJbWFnZUJpdG1hcCIsInRoZW4iLCJiaXRtYXAiLCJkZXN0cm95IiwiY2xvc2UiLCJnZXRQb3NpdGlvbiIsImNvcHkiLCJ0cmFuc2Zvcm0iLCJwb3NpdGlvbiIsImdldFJvdGF0aW9uIiwib3JpZW50YXRpb24iXSwibWFwcGluZ3MiOiI7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGNBQWMsU0FBU0MsWUFBWSxDQUFDO0FBNkR0QztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLEtBQUssRUFBRUMsS0FBSyxFQUFFO0FBQ3RCLElBQUEsS0FBSyxFQUFFLENBQUE7QUEzRVg7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRU47QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBRWQ7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxjQUFjLEdBQUcsQ0FBQyxDQUFBO0FBRWxCO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUVsQjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFFakI7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBRWpCO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUVaO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLFNBQVMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUV0QjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7SUFtQmxCLElBQUksQ0FBQ1gsTUFBTSxHQUFHRixLQUFLLENBQUE7SUFDbkIsSUFBSSxDQUFDRyxNQUFNLEdBQUdGLEtBQUssQ0FBQTtBQUN2QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUQsS0FBS0EsR0FBRztJQUNSLE9BQU8sSUFBSSxDQUFDRSxNQUFNLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJRCxLQUFLQSxDQUFDYSxLQUFLLEVBQUU7SUFDYixJQUFJLENBQUNYLE1BQU0sR0FBR1csS0FBSyxDQUFBO0FBQ3ZCLEdBQUE7RUFFQSxJQUFJYixLQUFLQSxHQUFHO0lBQ1IsT0FBTyxJQUFJLENBQUNFLE1BQU0sQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlZLFNBQVNBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQ1QsVUFBVSxDQUFBO0FBQzFCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSVUsUUFBUUEsR0FBRztJQUNYLE9BQU8sSUFBSSxDQUFDVCxTQUFTLENBQUE7QUFDekIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlVLFFBQVFBLEdBQUc7SUFDWCxPQUFPLElBQUksQ0FBQ1QsU0FBUyxDQUFBO0FBQ3pCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDSVUsRUFBQUEsT0FBT0EsR0FBRztJQUNOLElBQUksSUFBSSxDQUFDZCxPQUFPLEVBQUU7TUFDZCxPQUFPO1FBQ0hKLEtBQUssRUFBRSxJQUFJLENBQUNJLE9BQU87UUFDbkJlLGFBQWEsRUFBRSxJQUFJLENBQUNoQixNQUFBQTtPQUN2QixDQUFBO0FBQ0wsS0FBQTtJQUVBLE9BQU9pQixpQkFBaUIsQ0FBQyxJQUFJLENBQUNsQixNQUFNLENBQUMsQ0FDaENtQixJQUFJLENBQUVDLE1BQU0sSUFBSztNQUNkLElBQUksQ0FBQ2xCLE9BQU8sR0FBR2tCLE1BQU0sQ0FBQTtNQUNyQixPQUFPO1FBQ0h0QixLQUFLLEVBQUUsSUFBSSxDQUFDSSxPQUFPO1FBQ25CZSxhQUFhLEVBQUUsSUFBSSxDQUFDaEIsTUFBQUE7T0FDdkIsQ0FBQTtBQUNMLEtBQUMsQ0FBQyxDQUFBO0FBQ1YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lvQixFQUFBQSxPQUFPQSxHQUFHO0lBQ04sSUFBSSxDQUFDckIsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUNsQixJQUFJLENBQUNPLEtBQUssR0FBRyxJQUFJLENBQUE7SUFFakIsSUFBSSxJQUFJLENBQUNMLE9BQU8sRUFBRTtBQUNkLE1BQUEsSUFBSSxDQUFDQSxPQUFPLENBQUNvQixLQUFLLEVBQUUsQ0FBQTtNQUNwQixJQUFJLENBQUNwQixPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJcUIsRUFBQUEsV0FBV0EsR0FBRztBQUNWLElBQUEsSUFBSSxJQUFJLENBQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDQyxTQUFTLENBQUNnQixJQUFJLENBQUMsSUFBSSxDQUFDakIsS0FBSyxDQUFDa0IsU0FBUyxDQUFDQyxRQUFRLENBQUMsQ0FBQTtJQUNsRSxPQUFPLElBQUksQ0FBQ2xCLFNBQVMsQ0FBQTtBQUN6QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJbUIsRUFBQUEsV0FBV0EsR0FBRztBQUNWLElBQUEsSUFBSSxJQUFJLENBQUNwQixLQUFLLEVBQUUsSUFBSSxDQUFDRyxTQUFTLENBQUNjLElBQUksQ0FBQyxJQUFJLENBQUNqQixLQUFLLENBQUNrQixTQUFTLENBQUNHLFdBQVcsQ0FBQyxDQUFBO0lBQ3JFLE9BQU8sSUFBSSxDQUFDbEIsU0FBUyxDQUFBO0FBQ3pCLEdBQUE7QUFDSjs7OzsifQ==
