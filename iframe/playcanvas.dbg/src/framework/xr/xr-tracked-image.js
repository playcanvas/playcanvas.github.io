import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

/**
 * The tracked image interface that is created by the Image Tracking system and is provided as a
 * list from {@link XrImageTracking#images}. It contains information about the tracking state as
 * well as the position and rotation of the tracked image.
 *
 * @category XR
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
   * @ignore
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
   * Get the world position of the tracked image.
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
   * Get the world rotation of the tracked image.
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
/**
 * Fired when image becomes actively tracked.
 *
 * @event
 * @example
 * trackedImage.on('tracked', () => {
 *     console.log('Image is now tracked');
 * });
 */
XrTrackedImage.EVENT_TRACKED = 'tracked';
/**
 * Fired when image is no longer actively tracked.
 *
 * @event
 * @example
 * trackedImage.on('untracked', () => {
 *     console.log('Image is no longer tracked');
 * });
 */
XrTrackedImage.EVENT_UNTRACKED = 'untracked';

export { XrTrackedImage };
