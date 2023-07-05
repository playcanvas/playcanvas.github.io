import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { XRTYPE_INLINE, XRTYPE_VR, XRTYPE_AR, XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGFORMAT_L8A8 } from './constants.js';
import { XrDepthSensing } from './xr-depth-sensing.js';
import { XrDomOverlay } from './xr-dom-overlay.js';
import { XrHitTest } from './xr-hit-test.js';
import { XrImageTracking } from './xr-image-tracking.js';
import { XrInput } from './xr-input.js';
import { XrLightEstimation } from './xr-light-estimation.js';
import { XrPlaneDetection } from './xr-plane-detection.js';

/**
 * Callback used by {@link XrManager#endXr} and {@link XrManager#startXr}.
 *
 * @callback XrErrorCallback
 * @param {Error|null} err - The Error object or null if operation was successful.
 */

/**
 * Manage and update XR session and its states.
 *
 * @augments EventHandler
 */
class XrManager extends EventHandler {
  /**
   * Create a new XrManager instance.
   *
   * @param {import('../app-base.js').AppBase} app - The main application.
   * @hideconstructor
   */
  constructor(app) {
    super();
    /**
     * @type {import('../app-base.js').AppBase}
     * @ignore
     */
    this.app = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!navigator.xr;
    /**
     * @type {Object<string, boolean>}
     * @private
     */
    this._available = {};
    /**
     * @type {string|null}
     * @private
     */
    this._type = null;
    /**
     * @type {string|null}
     * @private
     */
    this._spaceType = null;
    /**
     * @type {XRSession|null}
     * @private
     */
    this._session = null;
    /**
     * @type {XRWebGLLayer|null}
     * @private
     */
    this._baseLayer = null;
    /**
     * @type {XRReferenceSpace|null}
     * @private
     */
    this._referenceSpace = null;
    /**
     * Provides access to depth sensing capabilities.
     *
     * @type {XrDepthSensing}
     * @ignore
     */
    this.depthSensing = void 0;
    /**
     * Provides access to DOM overlay capabilities.
     *
     * @type {XrDomOverlay}
     * @ignore
     */
    this.domOverlay = void 0;
    /**
     * Provides the ability to perform hit tests on the representation of real world geometry
     * of the underlying AR system.
     *
     * @type {XrHitTest}
     */
    this.hitTest = void 0;
    /**
     * Provides access to image tracking capabilities.
     *
     * @type {XrImageTracking}
     * @ignore
     */
    this.imageTracking = void 0;
    /**
     * Provides access to plane detection capabilities.
     *
     * @type {XrPlaneDetection}
     * @ignore
     */
    this.planeDetection = void 0;
    /**
     * Provides access to Input Sources.
     *
     * @type {XrInput}
     */
    this.input = void 0;
    /**
     * Provides access to light estimation capabilities.
     *
     * @type {XrLightEstimation}
     * @ignore
     */
    this.lightEstimation = void 0;
    /**
     * @type {import('../components/camera/component.js').CameraComponent}
     * @private
     */
    this._camera = null;
    /**
     * @type {Array<*>}
     * @ignore
     */
    this.views = [];
    /**
     * @type {Array<*>}
     * @ignore
     */
    this.viewsPool = [];
    /**
     * @type {Vec3}
     * @private
     */
    this._localPosition = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this._localRotation = new Quat();
    /**
     * @type {number}
     * @private
     */
    this._depthNear = 0.1;
    /**
     * @type {number}
     * @private
     */
    this._depthFar = 1000;
    /**
     * @type {number}
     * @private
     */
    this._width = 0;
    /**
     * @type {number}
     * @private
     */
    this._height = 0;
    this.app = app;

    // Add all the supported session types
    this._available[XRTYPE_INLINE] = false;
    this._available[XRTYPE_VR] = false;
    this._available[XRTYPE_AR] = false;
    this.depthSensing = new XrDepthSensing(this);
    this.domOverlay = new XrDomOverlay(this);
    this.hitTest = new XrHitTest(this);
    this.imageTracking = new XrImageTracking(this);
    this.planeDetection = new XrPlaneDetection(this);
    this.input = new XrInput(this);
    this.lightEstimation = new XrLightEstimation(this);

    // TODO
    // 1. HMD class with its params
    // 2. Space class
    // 3. Controllers class

    if (this._supported) {
      navigator.xr.addEventListener('devicechange', () => {
        this._deviceAvailabilityCheck();
      });
      this._deviceAvailabilityCheck();
    }
  }

  /**
   * Fired when availability of specific XR type is changed.
   *
   * @event XrManager#available
   * @param {string} type - The session type that has changed availability.
   * @param {boolean} available - True if specified session type is now available.
   * @example
   * app.xr.on('available', function (type, available) {
   *     console.log('"' + type + '" XR session is now ' + (available ? 'available' : 'unavailable'));
   * });
   */

  /**
   * Fired when availability of specific XR type is changed.
   *
   * @event XrManager#available:[type]
   * @param {boolean} available - True if specified session type is now available.
   * @example
   * app.xr.on('available:' + pc.XRTYPE_VR, function (available) {
   *     console.log('Immersive VR session is now ' + (available ? 'available' : 'unavailable'));
   * });
   */

  /**
   * Fired when XR session is started.
   *
   * @event XrManager#start
   * @example
   * app.xr.on('start', function () {
   *     // XR session has started
   * });
   */

  /**
   * Fired when XR session is ended.
   *
   * @event XrManager#end
   * @example
   * app.xr.on('end', function () {
   *     // XR session has ended
   * });
   */

  /**
   * Fired when XR session is updated, providing relevant XRFrame object.
   *
   * @event XrManager#update
   * @param {object} frame - [XRFrame](https://developer.mozilla.org/en-US/docs/Web/API/XRFrame)
   * object that can be used for interfacing directly with WebXR APIs.
   * @example
   * app.xr.on('update', function (frame) {
   *
   * });
   */

  /**
   * Fired when XR session is failed to start or failed to check for session type support.
   *
   * @event XrManager#error
   * @param {Error} error - Error object related to failure of session start or check of session
   * type support.
   * @example
   * app.xr.on('error', function (ex) {
   *     // XR session has failed to start, or failed to check for session type support
   * });
   */

  /**
   * Destroys the XrManager instance.
   *
   * @ignore
   */
  destroy() {
    this.depthSensing.destroy();
    this.depthSensing = null;
  }

  /**
   * Attempts to start XR session for provided {@link CameraComponent} and optionally fires
   * callback when session is created or failed to create. Integrated XR APIs need to be enabled
   * by providing relevant options.
   *
   * @param {import('../components/camera/component.js').CameraComponent} camera - It will be
   * used to render XR session and manipulated based on pose tracking.
   * @param {string} type - Session type. Can be one of the following:
   *
   * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited features
   * availability and is rendered into HTML element.
   * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with
   * best available tracking features.
   * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device
   * that is intended to be blended with real-world environment.
   *
   * @param {string} spaceType - Reference space type. Can be one of the following:
   *
   * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
   * capabilities.
   * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
   * viewer at the time of creation. It is meant for seated or basic local XR sessions.
   * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
   * at the floor in a safe position for the user to stand. The y axis equals 0 at floor level.
   * Floor level value might be estimated by the underlying platform. It is meant for seated or
   * basic local XR sessions.
   * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
   * origin at the floor, where the user is expected to move within a pre-established boundary.
   * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
   * expected to move freely around their environment, potentially long distances from their
   * starting point.
   *
   * @param {object} [options] - Object with additional options for XR session initialization.
   * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
   * used for getting access to additional WebXR spec extensions.
   * @param {boolean} [options.imageTracking] - Set to true to attempt to enable
   * {@link XrImageTracking}.
   * @param {boolean} [options.planeDetection] - Set to true to attempt to enable
   * {@link XrPlaneDetection}.
   * @param {XrErrorCallback} [options.callback] - Optional callback function called once session
   * is started. The callback has one argument Error - it is null if successfully started XR
   * session.
   * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
   * attempt to enable {@link XrDepthSensing}.
   * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
   * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
   * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
   * system.
   * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
   * preference for depth sensing, can be 'luminance-alpha' or 'float32'
   * (XRDEPTHSENSINGFORMAT_*), defaults to 'luminance-alpha'. Most preferred and supported will
   * be chosen by the underlying depth sensing system.
   * @example
   * button.on('click', function () {
   *     app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR);
   * });
   * @example
   * button.on('click', function () {
   *     app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
   *         depthSensing: { }
   *     });
   * });
   */
  start(camera, type, spaceType, options) {
    let callback = options;
    if (typeof options === 'object') callback = options.callback;
    if (!this._available[type]) {
      if (callback) callback(new Error('XR is not available'));
      return;
    }
    if (this._session) {
      if (callback) callback(new Error('XR session is already started'));
      return;
    }
    this._camera = camera;
    this._camera.camera.xr = this;
    this._type = type;
    this._spaceType = spaceType;
    this._setClipPlanes(camera.nearClip, camera.farClip);

    // TODO
    // makeXRCompatible
    // scenario to test:
    // 1. app is running on integrated GPU
    // 2. XR device is connected, to another GPU
    // 3. probably immersive-vr will fail to be created
    // 4. call makeXRCompatible, very likely will lead to context loss

    const opts = {
      requiredFeatures: [spaceType],
      optionalFeatures: []
    };
    if (type === XRTYPE_AR) {
      opts.optionalFeatures.push('light-estimation');
      opts.optionalFeatures.push('hit-test');
      if (options) {
        if (options.imageTracking && this.imageTracking.supported) opts.optionalFeatures.push('image-tracking');
        if (options.planeDetection) opts.optionalFeatures.push('plane-detection');
      }
      if (this.domOverlay.supported && this.domOverlay.root) {
        opts.optionalFeatures.push('dom-overlay');
        opts.domOverlay = {
          root: this.domOverlay.root
        };
      }
      if (options && options.depthSensing && this.depthSensing.supported) {
        opts.optionalFeatures.push('depth-sensing');
        const usagePreference = [XRDEPTHSENSINGUSAGE_CPU];
        const dataFormatPreference = [XRDEPTHSENSINGFORMAT_L8A8];
        if (options.depthSensing.usagePreference) {
          const ind = usagePreference.indexOf(options.depthSensing.usagePreference);
          if (ind !== -1) usagePreference.splice(ind, 1);
          usagePreference.unshift(options.depthSensing.usagePreference);
        }
        if (options.depthSensing.dataFormatPreference) {
          const ind = dataFormatPreference.indexOf(options.depthSensing.dataFormatPreference);
          if (ind !== -1) dataFormatPreference.splice(ind, 1);
          dataFormatPreference.unshift(options.depthSensing.dataFormatPreference);
        }
        opts.depthSensing = {
          usagePreference: usagePreference,
          dataFormatPreference: dataFormatPreference
        };
      }
    } else if (type === XRTYPE_VR) {
      opts.optionalFeatures.push('hand-tracking');
    }
    if (options && options.optionalFeatures) opts.optionalFeatures = opts.optionalFeatures.concat(options.optionalFeatures);
    if (this.imageTracking.supported && this.imageTracking.images.length) {
      this.imageTracking.prepareImages((err, trackedImages) => {
        if (err) {
          if (callback) callback(err);
          this.fire('error', err);
          return;
        }
        if (trackedImages !== null) opts.trackedImages = trackedImages;
        this._onStartOptionsReady(type, spaceType, opts, callback);
      });
    } else {
      this._onStartOptionsReady(type, spaceType, opts, callback);
    }
  }

  /**
   * @param {string} type - Session type.
   * @param {string} spaceType - Reference space type.
   * @param {*} options - Session options.
   * @param {XrErrorCallback} callback - Error callback.
   * @private
   */
  _onStartOptionsReady(type, spaceType, options, callback) {
    navigator.xr.requestSession(type, options).then(session => {
      this._onSessionStart(session, spaceType, callback);
    }).catch(ex => {
      this._camera.camera.xr = null;
      this._camera = null;
      this._type = null;
      this._spaceType = null;
      if (callback) callback(ex);
      this.fire('error', ex);
    });
  }

  /**
   * Attempts to end XR session and optionally fires callback when session is ended or failed to
   * end.
   *
   * @param {XrErrorCallback} [callback] - Optional callback function called once session is
   * started. The callback has one argument Error - it is null if successfully started XR
   * session.
   * @example
   * app.keyboard.on('keydown', function (evt) {
   *     if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
   *         app.xr.end();
   *     }
   * });
   */
  end(callback) {
    if (!this._session) {
      if (callback) callback(new Error('XR Session is not initialized'));
      return;
    }
    if (callback) this.once('end', callback);
    this._session.end();
  }

  /**
   * Check if specific type of session is available.
   *
   * @param {string} type - Session type. Can be one of the following:
   *
   * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited features
   * availability and is rendered into HTML element.
   * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to VR device with
   * best available tracking features.
   * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to VR/AR device
   * that is intended to be blended with real-world environment.
   *
   * @example
   * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
   *     // VR is available
   * }
   * @returns {boolean} True if specified session type is available.
   */
  isAvailable(type) {
    return this._available[type];
  }

  /** @private */
  _deviceAvailabilityCheck() {
    for (const key in this._available) {
      this._sessionSupportCheck(key);
    }
  }

  /**
   * @param {string} type - Session type.
   * @private
   */
  _sessionSupportCheck(type) {
    navigator.xr.isSessionSupported(type).then(available => {
      if (this._available[type] === available) return;
      this._available[type] = available;
      this.fire('available', type, available);
      this.fire('available:' + type, available);
    }).catch(ex => {
      this.fire('error', ex);
    });
  }

  /**
   * @param {XRSession} session - XR session.
   * @param {string} spaceType - Space type to request for the session.
   * @param {Function} callback - Callback to call when session is started.
   * @private
   */
  _onSessionStart(session, spaceType, callback) {
    let failed = false;
    this._session = session;
    const onVisibilityChange = () => {
      this.fire('visibility:change', session.visibilityState);
    };
    const onClipPlanesChange = () => {
      this._setClipPlanes(this._camera.nearClip, this._camera.farClip);
    };

    // clean up once session is ended
    const onEnd = () => {
      if (this._camera) {
        this._camera.off('set_nearClip', onClipPlanesChange);
        this._camera.off('set_farClip', onClipPlanesChange);
        this._camera.camera.xr = null;
        this._camera = null;
      }
      session.removeEventListener('end', onEnd);
      session.removeEventListener('visibilitychange', onVisibilityChange);
      if (!failed) this.fire('end');
      this._session = null;
      this._referenceSpace = null;
      this.views = [];
      this._width = 0;
      this._height = 0;
      this._type = null;
      this._spaceType = null;

      // old requestAnimationFrame will never be triggered,
      // so queue up new tick
      this.app.tick();
    };
    session.addEventListener('end', onEnd);
    session.addEventListener('visibilitychange', onVisibilityChange);
    this._camera.on('set_nearClip', onClipPlanesChange);
    this._camera.on('set_farClip', onClipPlanesChange);

    // A framebufferScaleFactor scale of 1 is the full resolution of the display
    // so we need to calculate this based on devicePixelRatio of the dislay and what
    // we've set this in the graphics device
    Debug.assert(window, 'window is needed to scale the XR framebuffer. Are you running XR headless?');
    const framebufferScaleFactor = this.app.graphicsDevice.maxPixelRatio / window.devicePixelRatio;
    this._baseLayer = new XRWebGLLayer(session, this.app.graphicsDevice.gl, {
      alpha: true,
      depth: true,
      stencil: true,
      framebufferScaleFactor: framebufferScaleFactor
    });
    session.updateRenderState({
      baseLayer: this._baseLayer,
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });

    // request reference space
    session.requestReferenceSpace(spaceType).then(referenceSpace => {
      this._referenceSpace = referenceSpace;

      // old requestAnimationFrame will never be triggered,
      // so queue up new tick
      this.app.tick();
      if (callback) callback(null);
      this.fire('start');
    }).catch(ex => {
      failed = true;
      session.end();
      if (callback) callback(ex);
      this.fire('error', ex);
    });
  }

  /**
   * @param {number} near - Near plane distance.
   * @param {number} far - Far plane distance.
   * @private
   */
  _setClipPlanes(near, far) {
    if (this._depthNear === near && this._depthFar === far) return;
    this._depthNear = near;
    this._depthFar = far;
    if (!this._session) return;

    // if session is available,
    // queue up render state update
    this._session.updateRenderState({
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   *
   * @returns {boolean} True if update was successful, false otherwise.
   * @ignore
   */
  update(frame) {
    if (!this._session) return false;

    // canvas resolution should be set on first frame availability or resolution changes
    const width = frame.session.renderState.baseLayer.framebufferWidth;
    const height = frame.session.renderState.baseLayer.framebufferHeight;
    if (this._width !== width || this._height !== height) {
      this._width = width;
      this._height = height;
      this.app.graphicsDevice.setResolution(width, height);
    }
    const pose = frame.getViewerPose(this._referenceSpace);
    if (!pose) return false;
    const lengthOld = this.views.length;
    const lengthNew = pose.views.length;
    while (lengthNew > this.views.length) {
      let view = this.viewsPool.pop();
      if (!view) {
        view = {
          viewport: new Vec4(),
          projMat: new Mat4(),
          viewMat: new Mat4(),
          viewOffMat: new Mat4(),
          viewInvMat: new Mat4(),
          viewInvOffMat: new Mat4(),
          projViewOffMat: new Mat4(),
          viewMat3: new Mat3(),
          position: new Float32Array(3),
          rotation: new Quat()
        };
      }
      this.views.push(view);
    }
    // remove views from list into pool
    while (lengthNew < this.views.length) {
      this.viewsPool.push(this.views.pop());
    }

    // reset position
    const posePosition = pose.transform.position;
    const poseOrientation = pose.transform.orientation;
    this._localPosition.set(posePosition.x, posePosition.y, posePosition.z);
    this._localRotation.set(poseOrientation.x, poseOrientation.y, poseOrientation.z, poseOrientation.w);
    const layer = frame.session.renderState.baseLayer;
    for (let i = 0; i < pose.views.length; i++) {
      // for each view, calculate matrices
      const viewRaw = pose.views[i];
      const view = this.views[i];
      const viewport = layer.getViewport(viewRaw);
      view.viewport.x = viewport.x;
      view.viewport.y = viewport.y;
      view.viewport.z = viewport.width;
      view.viewport.w = viewport.height;
      view.projMat.set(viewRaw.projectionMatrix);
      view.viewMat.set(viewRaw.transform.inverse.matrix);
      view.viewInvMat.set(viewRaw.transform.matrix);
    }

    // update the camera fov properties only when we had 0 views
    if (lengthOld === 0 && this.views.length > 0) {
      const viewProjMat = new Mat4();
      const view = this.views[0];
      viewProjMat.copy(view.projMat);
      const data = viewProjMat.data;
      const fov = 2.0 * Math.atan(1.0 / data[5]) * 180.0 / Math.PI;
      const aspectRatio = data[5] / data[0];
      const farClip = data[14] / (data[10] + 1);
      const nearClip = data[14] / (data[10] - 1);
      const horizontalFov = false;
      const camera = this._camera.camera;
      camera.setXrProperties({
        aspectRatio,
        farClip,
        fov,
        horizontalFov,
        nearClip
      });
    }

    // position and rotate camera based on calculated vectors
    this._camera.camera._node.setLocalPosition(this._localPosition);
    this._camera.camera._node.setLocalRotation(this._localRotation);
    this.input.update(frame);
    if (this._type === XRTYPE_AR) {
      if (this.hitTest.supported) this.hitTest.update(frame);
      if (this.lightEstimation.supported) this.lightEstimation.update(frame);
      if (this.depthSensing.supported) this.depthSensing.update(frame, pose && pose.views[0]);
      if (this.imageTracking.supported) this.imageTracking.update(frame);
      if (this.planeDetection.supported) this.planeDetection.update(frame);
    }
    this.fire('update', frame);
    return true;
  }

  /**
   * True if XR is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if XR session is running.
   *
   * @type {boolean}
   */
  get active() {
    return !!this._session;
  }

  /**
   * Returns type of currently running XR session or null if no session is running. Can be any of
   * XRTYPE_*.
   *
   * @type {string|null}
   */
  get type() {
    return this._type;
  }

  /**
   * Returns reference space type of currently running XR session or null if no session is
   * running. Can be any of XRSPACE_*.
   *
   * @type {string|null}
   */
  get spaceType() {
    return this._spaceType;
  }

  /**
   * Provides access to XRSession of WebXR.
   *
   * @type {object|null}
   */
  get session() {
    return this._session;
  }

  /**
   * Active camera for which XR session is running or null.
   *
   * @type {import('../entity.js').Entity|null}
   */
  get camera() {
    return this._camera ? this._camera.entity : null;
  }

  /**
   * Indicates whether WebXR content is currently visible to the user, and if it is, whether it's
   * the primary focus. Can be 'hidden', 'visible' or 'visible-blurred'.
   *
   * @type {string}
   * @ignore
   */
  get visibilityState() {
    if (!this._session) return null;
    return this._session.visibilityState;
  }
}

export { XrManager };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tYW5hZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgWFJUWVBFX0lOTElORSwgWFJUWVBFX1ZSLCBYUlRZUEVfQVIsIFhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVLCBYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWHJEZXB0aFNlbnNpbmcgfSBmcm9tICcuL3hyLWRlcHRoLXNlbnNpbmcuanMnO1xuaW1wb3J0IHsgWHJEb21PdmVybGF5IH0gZnJvbSAnLi94ci1kb20tb3ZlcmxheS5qcyc7XG5pbXBvcnQgeyBYckhpdFRlc3QgfSBmcm9tICcuL3hyLWhpdC10ZXN0LmpzJztcbmltcG9ydCB7IFhySW1hZ2VUcmFja2luZyB9IGZyb20gJy4veHItaW1hZ2UtdHJhY2tpbmcuanMnO1xuaW1wb3J0IHsgWHJJbnB1dCB9IGZyb20gJy4veHItaW5wdXQuanMnO1xuaW1wb3J0IHsgWHJMaWdodEVzdGltYXRpb24gfSBmcm9tICcuL3hyLWxpZ2h0LWVzdGltYXRpb24uanMnO1xuaW1wb3J0IHsgWHJQbGFuZURldGVjdGlvbiB9IGZyb20gJy4veHItcGxhbmUtZGV0ZWN0aW9uLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYck1hbmFnZXIjZW5kWHJ9IGFuZCB7QGxpbmsgWHJNYW5hZ2VyI3N0YXJ0WHJ9LlxuICpcbiAqIEBjYWxsYmFjayBYckVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBvciBudWxsIGlmIG9wZXJhdGlvbiB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuXG4vKipcbiAqIE1hbmFnZSBhbmQgdXBkYXRlIFhSIHNlc3Npb24gYW5kIGl0cyBzdGF0ZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBYck1hbmFnZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXBwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIW5hdmlnYXRvci54cjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBib29sZWFuPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hdmFpbGFibGUgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSU2Vzc2lvbnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSV2ViR0xMYXllcnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Jhc2VMYXllciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJSZWZlcmVuY2VTcGFjZXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZmVyZW5jZVNwYWNlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBkZXB0aCBzZW5zaW5nIGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRlcHRoU2Vuc2luZ31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVwdGhTZW5zaW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIERPTSBvdmVybGF5IGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRvbU92ZXJsYXl9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRvbU92ZXJsYXk7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyB0aGUgYWJpbGl0eSB0byBwZXJmb3JtIGhpdCB0ZXN0cyBvbiB0aGUgcmVwcmVzZW50YXRpb24gb2YgcmVhbCB3b3JsZCBnZW9tZXRyeVxuICAgICAqIG9mIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3R9XG4gICAgICovXG4gICAgaGl0VGVzdDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBpbWFnZSB0cmFja2luZyBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJJbWFnZVRyYWNraW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbWFnZVRyYWNraW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIHBsYW5lIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJQbGFuZURldGVjdGlvbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcGxhbmVEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gSW5wdXQgU291cmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0fVxuICAgICAqL1xuICAgIGlucHV0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGxpZ2h0IGVzdGltYXRpb24gY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTGlnaHRFc3RpbWF0aW9ufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsaWdodEVzdGltYXRpb247XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FtZXJhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3MgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3NQb29sID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aE5lYXIgPSAwLjE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoRmFyID0gMTAwMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfd2lkdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oZWlnaHQgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBtYWluIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcblxuICAgICAgICAvLyBBZGQgYWxsIHRoZSBzdXBwb3J0ZWQgc2Vzc2lvbiB0eXBlc1xuICAgICAgICB0aGlzLl9hdmFpbGFibGVbWFJUWVBFX0lOTElORV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9WUl0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9BUl0gPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG5ldyBYckRlcHRoU2Vuc2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5kb21PdmVybGF5ID0gbmV3IFhyRG9tT3ZlcmxheSh0aGlzKTtcbiAgICAgICAgdGhpcy5oaXRUZXN0ID0gbmV3IFhySGl0VGVzdCh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nID0gbmV3IFhySW1hZ2VUcmFja2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbiA9IG5ldyBYclBsYW5lRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmlucHV0ID0gbmV3IFhySW5wdXQodGhpcyk7XG4gICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uID0gbmV3IFhyTGlnaHRFc3RpbWF0aW9uKHRoaXMpO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gMS4gSE1EIGNsYXNzIHdpdGggaXRzIHBhcmFtc1xuICAgICAgICAvLyAyLiBTcGFjZSBjbGFzc1xuICAgICAgICAvLyAzLiBDb250cm9sbGVycyBjbGFzc1xuXG4gICAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci54ci5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgc2Vzc2lvbiB0eXBlIHRoYXQgaGFzIGNoYW5nZWQgYXZhaWxhYmlsaXR5LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZScsIGZ1bmN0aW9uICh0eXBlLCBhdmFpbGFibGUpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1wiJyArIHR5cGUgKyAnXCIgWFIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlOlt0eXBlXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZTonICsgcGMuWFJUWVBFX1ZSLCBmdW5jdGlvbiAoYXZhaWxhYmxlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdJbW1lcnNpdmUgVlIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gWFIgc2Vzc2lvbiBpcyBzdGFydGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNzdGFydFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdzdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgc3RhcnRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNlbmRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBYUiBzZXNzaW9uIGhhcyBlbmRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHVwZGF0ZWQsIHByb3ZpZGluZyByZWxldmFudCBYUkZyYW1lIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjdXBkYXRlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGZyYW1lIC0gW1hSRnJhbWVdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9YUkZyYW1lKVxuICAgICAqIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIGZvciBpbnRlcmZhY2luZyBkaXJlY3RseSB3aXRoIFdlYlhSIEFQSXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ3VwZGF0ZScsIGZ1bmN0aW9uIChmcmFtZSkge1xuICAgICAqXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZmFpbGVkIHRvIHN0YXJ0IG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJNYW5hZ2VyI2Vycm9yXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSBFcnJvciBvYmplY3QgcmVsYXRlZCB0byBmYWlsdXJlIG9mIHNlc3Npb24gc3RhcnQgb3IgY2hlY2sgb2Ygc2Vzc2lvblxuICAgICAqIHR5cGUgc3VwcG9ydC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZXJyb3InLCBmdW5jdGlvbiAoZXgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgZmFpbGVkIHRvIHN0YXJ0LCBvciBmYWlsZWQgdG8gY2hlY2sgZm9yIHNlc3Npb24gdHlwZSBzdXBwb3J0XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgWHJNYW5hZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIHN0YXJ0IFhSIHNlc3Npb24gZm9yIHByb3ZpZGVkIHtAbGluayBDYW1lcmFDb21wb25lbnR9IGFuZCBvcHRpb25hbGx5IGZpcmVzXG4gICAgICogY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGNyZWF0ZWQgb3IgZmFpbGVkIHRvIGNyZWF0ZS4gSW50ZWdyYXRlZCBYUiBBUElzIG5lZWQgdG8gYmUgZW5hYmxlZFxuICAgICAqIGJ5IHByb3ZpZGluZyByZWxldmFudCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gSXQgd2lsbCBiZVxuICAgICAqIHVzZWQgdG8gcmVuZGVyIFhSIHNlc3Npb24gYW5kIG1hbmlwdWxhdGVkIGJhc2VkIG9uIHBvc2UgdHJhY2tpbmcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBhbHdheXMgc3VwcG9ydGVkIHNwYWNlIHdpdGggc29tZSBiYXNpYyB0cmFja2luZ1xuICAgICAqIGNhcGFiaWxpdGllcy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMfTogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGVcbiAgICAgKiB2aWV3ZXIgYXQgdGhlIHRpbWUgb2YgY3JlYXRpb24uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3IgYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTEZMT09SfTogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW5cbiAgICAgKiBhdCB0aGUgZmxvb3IgaW4gYSBzYWZlIHBvc2l0aW9uIGZvciB0aGUgdXNlciB0byBzdGFuZC4gVGhlIHkgYXhpcyBlcXVhbHMgMCBhdCBmbG9vciBsZXZlbC5cbiAgICAgKiBGbG9vciBsZXZlbCB2YWx1ZSBtaWdodCBiZSBlc3RpbWF0ZWQgYnkgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3JcbiAgICAgKiBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3Qgd2l0aCBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIFhSIHNlc3Npb24gaW5pdGlhbGl6YXRpb24uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMub3B0aW9uYWxGZWF0dXJlc10gLSBPcHRpb25hbCBmZWF0dXJlcyBmb3IgWFJTZXNzaW9uIHN0YXJ0LiBJdCBpc1xuICAgICAqIHVzZWQgZm9yIGdldHRpbmcgYWNjZXNzIHRvIGFkZGl0aW9uYWwgV2ViWFIgc3BlYyBleHRlbnNpb25zLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaW1hZ2VUcmFja2luZ10gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZVxuICAgICAqIHtAbGluayBYckltYWdlVHJhY2tpbmd9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGxhbmVEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJQbGFuZURldGVjdGlvbn0uXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IFtvcHRpb25zLmNhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb25cbiAgICAgKiBpcyBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWYgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgWFJcbiAgICAgKiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5kZXB0aFNlbnNpbmddIC0gT3B0aW9uYWwgb2JqZWN0IHdpdGggZGVwdGggc2Vuc2luZyBwYXJhbWV0ZXJzIHRvXG4gICAgICogYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nfS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZV0gLSBPcHRpb25hbCB1c2FnZSBwcmVmZXJlbmNlIGZvciBkZXB0aFxuICAgICAqIHNlbnNpbmcsIGNhbiBiZSAnY3B1LW9wdGltaXplZCcgb3IgJ2dwdS1vcHRpbWl6ZWQnIChYUkRFUFRIU0VOU0lOR1VTQUdFXyopLCBkZWZhdWx0cyB0b1xuICAgICAqICdjcHUtb3B0aW1pemVkJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nXG4gICAgICogc3lzdGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2VdIC0gT3B0aW9uYWwgZGF0YSBmb3JtYXRcbiAgICAgKiBwcmVmZXJlbmNlIGZvciBkZXB0aCBzZW5zaW5nLCBjYW4gYmUgJ2x1bWluYW5jZS1hbHBoYScgb3IgJ2Zsb2F0MzInXG4gICAgICogKFhSREVQVEhTRU5TSU5HRk9STUFUXyopLCBkZWZhdWx0cyB0byAnbHVtaW5hbmNlLWFscGhhJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsXG4gICAgICogYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmcgc3lzdGVtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX1ZSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IpO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX0FSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IsIHtcbiAgICAgKiAgICAgICAgIGRlcHRoU2Vuc2luZzogeyB9XG4gICAgICogICAgIH0pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0KGNhbWVyYSwgdHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCBjYWxsYmFjayA9IG9wdGlvbnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JylcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcblxuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZVt0eXBlXSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIGlzIG5vdCBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIHNlc3Npb24gaXMgYWxyZWFkeSBzdGFydGVkJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gdGhpcztcbiAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IHNwYWNlVHlwZTtcblxuICAgICAgICB0aGlzLl9zZXRDbGlwUGxhbmVzKGNhbWVyYS5uZWFyQ2xpcCwgY2FtZXJhLmZhckNsaXApO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gbWFrZVhSQ29tcGF0aWJsZVxuICAgICAgICAvLyBzY2VuYXJpbyB0byB0ZXN0OlxuICAgICAgICAvLyAxLiBhcHAgaXMgcnVubmluZyBvbiBpbnRlZ3JhdGVkIEdQVVxuICAgICAgICAvLyAyLiBYUiBkZXZpY2UgaXMgY29ubmVjdGVkLCB0byBhbm90aGVyIEdQVVxuICAgICAgICAvLyAzLiBwcm9iYWJseSBpbW1lcnNpdmUtdnIgd2lsbCBmYWlsIHRvIGJlIGNyZWF0ZWRcbiAgICAgICAgLy8gNC4gY2FsbCBtYWtlWFJDb21wYXRpYmxlLCB2ZXJ5IGxpa2VseSB3aWxsIGxlYWQgdG8gY29udGV4dCBsb3NzXG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXM6IFtzcGFjZVR5cGVdLFxuICAgICAgICAgICAgb3B0aW9uYWxGZWF0dXJlczogW11cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gWFJUWVBFX0FSKSB7XG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnbGlnaHQtZXN0aW1hdGlvbicpO1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hpdC10ZXN0Jyk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW1hZ2VUcmFja2luZyAmJiB0aGlzLmltYWdlVHJhY2tpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnaW1hZ2UtdHJhY2tpbmcnKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnBsYW5lRGV0ZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgncGxhbmUtZGV0ZWN0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRvbU92ZXJsYXkuc3VwcG9ydGVkICYmIHRoaXMuZG9tT3ZlcmxheS5yb290KSB7XG4gICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2RvbS1vdmVybGF5Jyk7XG4gICAgICAgICAgICAgICAgb3B0cy5kb21PdmVybGF5ID0geyByb290OiB0aGlzLmRvbU92ZXJsYXkucm9vdCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoU2Vuc2luZyAmJiB0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnZGVwdGgtc2Vuc2luZycpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXNhZ2VQcmVmZXJlbmNlID0gW1hSREVQVEhTRU5TSU5HVVNBR0VfQ1BVXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRm9ybWF0UHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4XTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gdXNhZ2VQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHVzYWdlUHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2VQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZGF0YUZvcm1hdFByZWZlcmVuY2UuaW5kZXhPZihvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSBkYXRhRm9ybWF0UHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2UudW5zaGlmdChvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb3B0cy5kZXB0aFNlbnNpbmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZTogdXNhZ2VQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhRm9ybWF0UHJlZmVyZW5jZTogZGF0YUZvcm1hdFByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFhSVFlQRV9WUikge1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hhbmQtdHJhY2tpbmcnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcylcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcyA9IG9wdHMub3B0aW9uYWxGZWF0dXJlcy5jb25jYXQob3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzKTtcblxuICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZCAmJiB0aGlzLmltYWdlVHJhY2tpbmcuaW1hZ2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnByZXBhcmVJbWFnZXMoKGVyciwgdHJhY2tlZEltYWdlcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0cmFja2VkSW1hZ2VzICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLnRyYWNrZWRJbWFnZXMgPSB0cmFja2VkSW1hZ2VzO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS5cbiAgICAgKiBAcGFyYW0geyp9IG9wdGlvbnMgLSBTZXNzaW9uIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRXJyb3IgY2FsbGJhY2suXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG5hdmlnYXRvci54ci5yZXF1ZXN0U2Vzc2lvbih0eXBlLCBvcHRpb25zKS50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gZW5kIFhSIHNlc3Npb24gYW5kIG9wdGlvbmFsbHkgZmlyZXMgY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGVuZGVkIG9yIGZhaWxlZCB0b1xuICAgICAqIGVuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpc1xuICAgICAqIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIGlmIChldnQua2V5ID09PSBwYy5LRVlfRVNDQVBFICYmIGFwcC54ci5hY3RpdmUpIHtcbiAgICAgKiAgICAgICAgIGFwcC54ci5lbmQoKTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZChjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBpbml0aWFsaXplZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYWxsYmFjaykgdGhpcy5vbmNlKCdlbmQnLCBjYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbi5lbmQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzcGVjaWZpYyB0eXBlIG9mIHNlc3Npb24gaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGFwcC54ci5pc0F2YWlsYWJsZShwYy5YUlRZUEVfVlIpKSB7XG4gICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAqIH1cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIGF2YWlsYWJsZS5cbiAgICAgKi9cbiAgICBpc0F2YWlsYWJsZSh0eXBlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdmFpbGFibGVbdHlwZV07XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25TdXBwb3J0Q2hlY2soa2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb25TdXBwb3J0Q2hlY2sodHlwZSkge1xuICAgICAgICBuYXZpZ2F0b3IueHIuaXNTZXNzaW9uU3VwcG9ydGVkKHR5cGUpLnRoZW4oKGF2YWlsYWJsZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F2YWlsYWJsZVt0eXBlXSA9PT0gYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlW3R5cGVdID0gYXZhaWxhYmxlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGUnLCB0eXBlLCBhdmFpbGFibGUpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGU6JyArIHR5cGUsIGF2YWlsYWJsZSk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUlNlc3Npb259IHNlc3Npb24gLSBYUiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBTcGFjZSB0eXBlIHRvIHJlcXVlc3QgZm9yIHRoZSBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdG8gY2FsbCB3aGVuIHNlc3Npb24gaXMgc3RhcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCBmYWlsZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblxuICAgICAgICBjb25zdCBvblZpc2liaWxpdHlDaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3Zpc2liaWxpdHk6Y2hhbmdlJywgc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9uQ2xpcFBsYW5lc0NoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldENsaXBQbGFuZXModGhpcy5fY2FtZXJhLm5lYXJDbGlwLCB0aGlzLl9jYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gY2xlYW4gdXAgb25jZSBzZXNzaW9uIGlzIGVuZGVkXG4gICAgICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5vZmYoJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLm9mZignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEueHIgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlc3Npb24ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kJywgb25FbmQpO1xuICAgICAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25WaXNpYmlsaXR5Q2hhbmdlKTtcblxuICAgICAgICAgICAgaWYgKCFmYWlsZWQpIHRoaXMuZmlyZSgnZW5kJyk7XG5cbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fcmVmZXJlbmNlU3BhY2UgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy52aWV3cyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSAwO1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gMDtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fc3BhY2VUeXBlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gb2xkIHJlcXVlc3RBbmltYXRpb25GcmFtZSB3aWxsIG5ldmVyIGJlIHRyaWdnZXJlZCxcbiAgICAgICAgICAgIC8vIHNvIHF1ZXVlIHVwIG5ldyB0aWNrXG4gICAgICAgICAgICB0aGlzLmFwcC50aWNrKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XG4gICAgICAgIHNlc3Npb24uYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIG9uVmlzaWJpbGl0eUNoYW5nZSk7XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhLm9uKCdzZXRfbmVhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICB0aGlzLl9jYW1lcmEub24oJ3NldF9mYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcblxuICAgICAgICAvLyBBIGZyYW1lYnVmZmVyU2NhbGVGYWN0b3Igc2NhbGUgb2YgMSBpcyB0aGUgZnVsbCByZXNvbHV0aW9uIG9mIHRoZSBkaXNwbGF5XG4gICAgICAgIC8vIHNvIHdlIG5lZWQgdG8gY2FsY3VsYXRlIHRoaXMgYmFzZWQgb24gZGV2aWNlUGl4ZWxSYXRpbyBvZiB0aGUgZGlzbGF5IGFuZCB3aGF0XG4gICAgICAgIC8vIHdlJ3ZlIHNldCB0aGlzIGluIHRoZSBncmFwaGljcyBkZXZpY2VcbiAgICAgICAgRGVidWcuYXNzZXJ0KHdpbmRvdywgJ3dpbmRvdyBpcyBuZWVkZWQgdG8gc2NhbGUgdGhlIFhSIGZyYW1lYnVmZmVyLiBBcmUgeW91IHJ1bm5pbmcgWFIgaGVhZGxlc3M/Jyk7XG4gICAgICAgIGNvbnN0IGZyYW1lYnVmZmVyU2NhbGVGYWN0b3IgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5tYXhQaXhlbFJhdGlvIC8gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG5cbiAgICAgICAgdGhpcy5fYmFzZUxheWVyID0gbmV3IFhSV2ViR0xMYXllcihzZXNzaW9uLCB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5nbCwge1xuICAgICAgICAgICAgYWxwaGE6IHRydWUsXG4gICAgICAgICAgICBkZXB0aDogdHJ1ZSxcbiAgICAgICAgICAgIHN0ZW5jaWw6IHRydWUsXG4gICAgICAgICAgICBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yOiBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgYmFzZUxheWVyOiB0aGlzLl9iYXNlTGF5ZXIsXG4gICAgICAgICAgICBkZXB0aE5lYXI6IHRoaXMuX2RlcHRoTmVhcixcbiAgICAgICAgICAgIGRlcHRoRmFyOiB0aGlzLl9kZXB0aEZhclxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZXF1ZXN0IHJlZmVyZW5jZSBzcGFjZVxuICAgICAgICBzZXNzaW9uLnJlcXVlc3RSZWZlcmVuY2VTcGFjZShzcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IHJlZmVyZW5jZVNwYWNlO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcblxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnc3RhcnQnKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2Vzc2lvbi5lbmQoKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgLSBOZWFyIHBsYW5lIGRpc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYXIgLSBGYXIgcGxhbmUgZGlzdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0Q2xpcFBsYW5lcyhuZWFyLCBmYXIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlcHRoTmVhciA9PT0gbmVhciAmJiB0aGlzLl9kZXB0aEZhciA9PT0gZmFyKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2RlcHRoTmVhciA9IG5lYXI7XG4gICAgICAgIHRoaXMuX2RlcHRoRmFyID0gZmFyO1xuXG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBpZiBzZXNzaW9uIGlzIGF2YWlsYWJsZSxcbiAgICAgICAgLy8gcXVldWUgdXAgcmVuZGVyIHN0YXRlIHVwZGF0ZVxuICAgICAgICB0aGlzLl9zZXNzaW9uLnVwZGF0ZVJlbmRlclN0YXRlKHtcbiAgICAgICAgICAgIGRlcHRoTmVhcjogdGhpcy5fZGVwdGhOZWFyLFxuICAgICAgICAgICAgZGVwdGhGYXI6IHRoaXMuX2RlcHRoRmFyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdXBkYXRlIHdhcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBjYW52YXMgcmVzb2x1dGlvbiBzaG91bGQgYmUgc2V0IG9uIGZpcnN0IGZyYW1lIGF2YWlsYWJpbGl0eSBvciByZXNvbHV0aW9uIGNoYW5nZXNcbiAgICAgICAgY29uc3Qgd2lkdGggPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlcldpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlckhlaWdodDtcbiAgICAgICAgaWYgKHRoaXMuX3dpZHRoICE9PSB3aWR0aCB8fCB0aGlzLl9oZWlnaHQgIT09IGhlaWdodCkge1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLnNldFJlc29sdXRpb24od2lkdGgsIGhlaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwb3NlID0gZnJhbWUuZ2V0Vmlld2VyUG9zZSh0aGlzLl9yZWZlcmVuY2VTcGFjZSk7XG5cbiAgICAgICAgaWYgKCFwb3NlKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgbGVuZ3RoT2xkID0gdGhpcy52aWV3cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGxlbmd0aE5ldyA9IHBvc2Uudmlld3MubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChsZW5ndGhOZXcgPiB0aGlzLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgbGV0IHZpZXcgPSB0aGlzLnZpZXdzUG9vbC5wb3AoKTtcbiAgICAgICAgICAgIGlmICghdmlldykge1xuICAgICAgICAgICAgICAgIHZpZXcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHZpZXdwb3J0OiBuZXcgVmVjNCgpLFxuICAgICAgICAgICAgICAgICAgICBwcm9qTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICB2aWV3TWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICB2aWV3T2ZmTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICB2aWV3SW52TWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICB2aWV3SW52T2ZmTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICBwcm9qVmlld09mZk1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgdmlld01hdDM6IG5ldyBNYXQzKCksXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBuZXcgRmxvYXQzMkFycmF5KDMpLFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogbmV3IFF1YXQoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudmlld3MucHVzaCh2aWV3KTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZW1vdmUgdmlld3MgZnJvbSBsaXN0IGludG8gcG9vbFxuICAgICAgICB3aGlsZSAobGVuZ3RoTmV3IDwgdGhpcy52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMudmlld3NQb29sLnB1c2godGhpcy52aWV3cy5wb3AoKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXNldCBwb3NpdGlvblxuICAgICAgICBjb25zdCBwb3NlUG9zaXRpb24gPSBwb3NlLnRyYW5zZm9ybS5wb3NpdGlvbjtcbiAgICAgICAgY29uc3QgcG9zZU9yaWVudGF0aW9uID0gcG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb247XG4gICAgICAgIHRoaXMuX2xvY2FsUG9zaXRpb24uc2V0KHBvc2VQb3NpdGlvbi54LCBwb3NlUG9zaXRpb24ueSwgcG9zZVBvc2l0aW9uLnopO1xuICAgICAgICB0aGlzLl9sb2NhbFJvdGF0aW9uLnNldChwb3NlT3JpZW50YXRpb24ueCwgcG9zZU9yaWVudGF0aW9uLnksIHBvc2VPcmllbnRhdGlvbi56LCBwb3NlT3JpZW50YXRpb24udyk7XG5cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllcjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvc2Uudmlld3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8vIGZvciBlYWNoIHZpZXcsIGNhbGN1bGF0ZSBtYXRyaWNlc1xuICAgICAgICAgICAgY29uc3Qgdmlld1JhdyA9IHBvc2Uudmlld3NbaV07XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy52aWV3c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHZpZXdwb3J0ID0gbGF5ZXIuZ2V0Vmlld3BvcnQodmlld1Jhdyk7XG5cbiAgICAgICAgICAgIHZpZXcudmlld3BvcnQueCA9IHZpZXdwb3J0Lng7XG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LnkgPSB2aWV3cG9ydC55O1xuICAgICAgICAgICAgdmlldy52aWV3cG9ydC56ID0gdmlld3BvcnQud2lkdGg7XG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LncgPSB2aWV3cG9ydC5oZWlnaHQ7XG5cbiAgICAgICAgICAgIHZpZXcucHJvak1hdC5zZXQodmlld1Jhdy5wcm9qZWN0aW9uTWF0cml4KTtcbiAgICAgICAgICAgIHZpZXcudmlld01hdC5zZXQodmlld1Jhdy50cmFuc2Zvcm0uaW52ZXJzZS5tYXRyaXgpO1xuICAgICAgICAgICAgdmlldy52aWV3SW52TWF0LnNldCh2aWV3UmF3LnRyYW5zZm9ybS5tYXRyaXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBjYW1lcmEgZm92IHByb3BlcnRpZXMgb25seSB3aGVuIHdlIGhhZCAwIHZpZXdzXG4gICAgICAgIGlmIChsZW5ndGhPbGQgPT09IDAgJiYgdGhpcy52aWV3cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCB2aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy52aWV3c1swXTtcblxuICAgICAgICAgICAgdmlld1Byb2pNYXQuY29weSh2aWV3LnByb2pNYXQpO1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHZpZXdQcm9qTWF0LmRhdGE7XG5cbiAgICAgICAgICAgIGNvbnN0IGZvdiA9ICgyLjAgKiBNYXRoLmF0YW4oMS4wIC8gZGF0YVs1XSkgKiAxODAuMCkgLyBNYXRoLlBJO1xuICAgICAgICAgICAgY29uc3QgYXNwZWN0UmF0aW8gPSBkYXRhWzVdIC8gZGF0YVswXTtcbiAgICAgICAgICAgIGNvbnN0IGZhckNsaXAgPSBkYXRhWzE0XSAvIChkYXRhWzEwXSArIDEpO1xuICAgICAgICAgICAgY29uc3QgbmVhckNsaXAgPSBkYXRhWzE0XSAvIChkYXRhWzEwXSAtIDEpO1xuICAgICAgICAgICAgY29uc3QgaG9yaXpvbnRhbEZvdiA9IGZhbHNlO1xuXG5cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRoaXMuX2NhbWVyYS5jYW1lcmE7XG4gICAgICAgICAgICBjYW1lcmEuc2V0WHJQcm9wZXJ0aWVzKHtcbiAgICAgICAgICAgICAgICBhc3BlY3RSYXRpbyxcbiAgICAgICAgICAgICAgICBmYXJDbGlwLFxuICAgICAgICAgICAgICAgIGZvdixcbiAgICAgICAgICAgICAgICBob3Jpem9udGFsRm92LFxuICAgICAgICAgICAgICAgIG5lYXJDbGlwXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGUgY2FtZXJhIGJhc2VkIG9uIGNhbGN1bGF0ZWQgdmVjdG9yc1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLl9ub2RlLnNldExvY2FsUG9zaXRpb24odGhpcy5fbG9jYWxQb3NpdGlvbik7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEuX25vZGUuc2V0TG9jYWxSb3RhdGlvbih0aGlzLl9sb2NhbFJvdGF0aW9uKTtcblxuICAgICAgICB0aGlzLmlucHV0LnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFhSVFlQRV9BUikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaGl0VGVzdC5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5oaXRUZXN0LnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmxpZ2h0RXN0aW1hdGlvbi5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodEVzdGltYXRpb24udXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGVwdGhTZW5zaW5nLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZy51cGRhdGUoZnJhbWUsIHBvc2UgJiYgcG9zZS52aWV3c1swXSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmltYWdlVHJhY2tpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuaW1hZ2VUcmFja2luZy51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wbGFuZURldGVjdGlvbi5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbi51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCd1cGRhdGUnLCBmcmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBYUiBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3VwcG9ydGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VwcG9ydGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgWFIgc2Vzc2lvbiBpcyBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGFjdGl2ZSgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHR5cGUgb2YgY3VycmVudGx5IHJ1bm5pbmcgWFIgc2Vzc2lvbiBvciBudWxsIGlmIG5vIHNlc3Npb24gaXMgcnVubmluZy4gQ2FuIGJlIGFueSBvZlxuICAgICAqIFhSVFlQRV8qLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHJlZmVyZW5jZSBzcGFjZSB0eXBlIG9mIGN1cnJlbnRseSBydW5uaW5nIFhSIHNlc3Npb24gb3IgbnVsbCBpZiBubyBzZXNzaW9uIGlzXG4gICAgICogcnVubmluZy4gQ2FuIGJlIGFueSBvZiBYUlNQQUNFXyouXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHNwYWNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwYWNlVHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gWFJTZXNzaW9uIG9mIFdlYlhSLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdHxudWxsfVxuICAgICAqL1xuICAgIGdldCBzZXNzaW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBY3RpdmUgY2FtZXJhIGZvciB3aGljaCBYUiBzZXNzaW9uIGlzIHJ1bm5pbmcgb3IgbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eXxudWxsfVxuICAgICAqL1xuICAgIGdldCBjYW1lcmEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEgPyB0aGlzLl9jYW1lcmEuZW50aXR5IDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmRpY2F0ZXMgd2hldGhlciBXZWJYUiBjb250ZW50IGlzIGN1cnJlbnRseSB2aXNpYmxlIHRvIHRoZSB1c2VyLCBhbmQgaWYgaXQgaXMsIHdoZXRoZXIgaXQnc1xuICAgICAqIHRoZSBwcmltYXJ5IGZvY3VzLiBDYW4gYmUgJ2hpZGRlbicsICd2aXNpYmxlJyBvciAndmlzaWJsZS1ibHVycmVkJy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB2aXNpYmlsaXR5U3RhdGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9zZXNzaW9uLnZpc2liaWxpdHlTdGF0ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyTWFuYWdlciB9O1xuIl0sIm5hbWVzIjpbIlhyTWFuYWdlciIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIm5hdmlnYXRvciIsInhyIiwiX2F2YWlsYWJsZSIsIl90eXBlIiwiX3NwYWNlVHlwZSIsIl9zZXNzaW9uIiwiX2Jhc2VMYXllciIsIl9yZWZlcmVuY2VTcGFjZSIsImRlcHRoU2Vuc2luZyIsImRvbU92ZXJsYXkiLCJoaXRUZXN0IiwiaW1hZ2VUcmFja2luZyIsInBsYW5lRGV0ZWN0aW9uIiwiaW5wdXQiLCJsaWdodEVzdGltYXRpb24iLCJfY2FtZXJhIiwidmlld3MiLCJ2aWV3c1Bvb2wiLCJfbG9jYWxQb3NpdGlvbiIsIlZlYzMiLCJfbG9jYWxSb3RhdGlvbiIsIlF1YXQiLCJfZGVwdGhOZWFyIiwiX2RlcHRoRmFyIiwiX3dpZHRoIiwiX2hlaWdodCIsIlhSVFlQRV9JTkxJTkUiLCJYUlRZUEVfVlIiLCJYUlRZUEVfQVIiLCJYckRlcHRoU2Vuc2luZyIsIlhyRG9tT3ZlcmxheSIsIlhySGl0VGVzdCIsIlhySW1hZ2VUcmFja2luZyIsIlhyUGxhbmVEZXRlY3Rpb24iLCJYcklucHV0IiwiWHJMaWdodEVzdGltYXRpb24iLCJhZGRFdmVudExpc3RlbmVyIiwiX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrIiwiZGVzdHJveSIsInN0YXJ0IiwiY2FtZXJhIiwidHlwZSIsInNwYWNlVHlwZSIsIm9wdGlvbnMiLCJjYWxsYmFjayIsIkVycm9yIiwiX3NldENsaXBQbGFuZXMiLCJuZWFyQ2xpcCIsImZhckNsaXAiLCJvcHRzIiwicmVxdWlyZWRGZWF0dXJlcyIsIm9wdGlvbmFsRmVhdHVyZXMiLCJwdXNoIiwic3VwcG9ydGVkIiwicm9vdCIsInVzYWdlUHJlZmVyZW5jZSIsIlhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVIiwiZGF0YUZvcm1hdFByZWZlcmVuY2UiLCJYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IiwiaW5kIiwiaW5kZXhPZiIsInNwbGljZSIsInVuc2hpZnQiLCJjb25jYXQiLCJpbWFnZXMiLCJsZW5ndGgiLCJwcmVwYXJlSW1hZ2VzIiwiZXJyIiwidHJhY2tlZEltYWdlcyIsImZpcmUiLCJfb25TdGFydE9wdGlvbnNSZWFkeSIsInJlcXVlc3RTZXNzaW9uIiwidGhlbiIsInNlc3Npb24iLCJfb25TZXNzaW9uU3RhcnQiLCJjYXRjaCIsImV4IiwiZW5kIiwib25jZSIsImlzQXZhaWxhYmxlIiwia2V5IiwiX3Nlc3Npb25TdXBwb3J0Q2hlY2siLCJpc1Nlc3Npb25TdXBwb3J0ZWQiLCJhdmFpbGFibGUiLCJmYWlsZWQiLCJvblZpc2liaWxpdHlDaGFuZ2UiLCJ2aXNpYmlsaXR5U3RhdGUiLCJvbkNsaXBQbGFuZXNDaGFuZ2UiLCJvbkVuZCIsIm9mZiIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJ0aWNrIiwib24iLCJEZWJ1ZyIsImFzc2VydCIsIndpbmRvdyIsImZyYW1lYnVmZmVyU2NhbGVGYWN0b3IiLCJncmFwaGljc0RldmljZSIsIm1heFBpeGVsUmF0aW8iLCJkZXZpY2VQaXhlbFJhdGlvIiwiWFJXZWJHTExheWVyIiwiZ2wiLCJhbHBoYSIsImRlcHRoIiwic3RlbmNpbCIsInVwZGF0ZVJlbmRlclN0YXRlIiwiYmFzZUxheWVyIiwiZGVwdGhOZWFyIiwiZGVwdGhGYXIiLCJyZXF1ZXN0UmVmZXJlbmNlU3BhY2UiLCJyZWZlcmVuY2VTcGFjZSIsIm5lYXIiLCJmYXIiLCJ1cGRhdGUiLCJmcmFtZSIsIndpZHRoIiwicmVuZGVyU3RhdGUiLCJmcmFtZWJ1ZmZlcldpZHRoIiwiaGVpZ2h0IiwiZnJhbWVidWZmZXJIZWlnaHQiLCJzZXRSZXNvbHV0aW9uIiwicG9zZSIsImdldFZpZXdlclBvc2UiLCJsZW5ndGhPbGQiLCJsZW5ndGhOZXciLCJ2aWV3IiwicG9wIiwidmlld3BvcnQiLCJWZWM0IiwicHJvak1hdCIsIk1hdDQiLCJ2aWV3TWF0Iiwidmlld09mZk1hdCIsInZpZXdJbnZNYXQiLCJ2aWV3SW52T2ZmTWF0IiwicHJvalZpZXdPZmZNYXQiLCJ2aWV3TWF0MyIsIk1hdDMiLCJwb3NpdGlvbiIsIkZsb2F0MzJBcnJheSIsInJvdGF0aW9uIiwicG9zZVBvc2l0aW9uIiwidHJhbnNmb3JtIiwicG9zZU9yaWVudGF0aW9uIiwib3JpZW50YXRpb24iLCJzZXQiLCJ4IiwieSIsInoiLCJ3IiwibGF5ZXIiLCJpIiwidmlld1JhdyIsImdldFZpZXdwb3J0IiwicHJvamVjdGlvbk1hdHJpeCIsImludmVyc2UiLCJtYXRyaXgiLCJ2aWV3UHJvak1hdCIsImNvcHkiLCJkYXRhIiwiZm92IiwiTWF0aCIsImF0YW4iLCJQSSIsImFzcGVjdFJhdGlvIiwiaG9yaXpvbnRhbEZvdiIsInNldFhyUHJvcGVydGllcyIsIl9ub2RlIiwic2V0TG9jYWxQb3NpdGlvbiIsInNldExvY2FsUm90YXRpb24iLCJhY3RpdmUiLCJlbnRpdHkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxTQUFTQyxZQUFZLENBQUM7QUE4SmpDO0FBQ0o7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
