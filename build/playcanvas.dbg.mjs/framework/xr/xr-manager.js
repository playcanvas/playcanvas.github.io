/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
   * @type {import('../app-base.js').AppBase}
   * @ignore
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {Object<string, boolean>}
   * @private
   */

  /**
   * @type {string|null}
   * @private
   */

  /**
   * @type {string|null}
   * @private
   */

  /**
   * @type {XRSession|null}
   * @private
   */

  /**
   * @type {XRWebGLLayer|null}
   * @private
   */

  /**
   * @type {XRReferenceSpace|null}
   * @private
   */

  /**
   * Provides access to depth sensing capabilities.
   *
   * @type {XrDepthSensing}
   * @ignore
   */

  /**
   * Provides access to DOM overlay capabilities.
   *
   * @type {XrDomOverlay}
   * @ignore
   */

  /**
   * Provides the ability to perform hit tests on the representation of real world geometry
   * of the underlying AR system.
   *
   * @type {XrHitTest}
   */

  /**
   * Provides access to image tracking capabilities.
   *
   * @type {XrImageTracking}
   * @ignore
   */

  /**
   * Provides access to plane detection capabilities.
   *
   * @type {XrPlaneDetection}
   * @ignore
   */

  /**
   * Provides access to Input Sources.
   *
   * @type {XrInput}
   */

  /**
   * Provides access to light estimation capabilities.
   *
   * @type {XrLightEstimation}
   * @ignore
   */

  /**
   * @type {import('../components/camera/component.js').CameraComponent}
   * @private
   */

  /**
   * @type {Array<*>}
   * @ignore
   */

  /**
   * @type {Array<*>}
   * @ignore
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Quat}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * Create a new XrManager instance.
   *
   * @param {import('../app-base.js').AppBase} app - The main application.
   * @hideconstructor
   */
  constructor(app) {
    super();
    this.app = void 0;
    this._supported = platform.browser && !!navigator.xr;
    this._available = {};
    this._type = null;
    this._spaceType = null;
    this._session = null;
    this._baseLayer = null;
    this._referenceSpace = null;
    this.depthSensing = void 0;
    this.domOverlay = void 0;
    this.hitTest = void 0;
    this.imageTracking = void 0;
    this.planeDetection = void 0;
    this.input = void 0;
    this.lightEstimation = void 0;
    this._camera = null;
    this.views = [];
    this.viewsPool = [];
    this._localPosition = new Vec3();
    this._localRotation = new Quat();
    this._depthNear = 0.1;
    this._depthFar = 1000;
    this._width = 0;
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
    if (lengthNew > this.views.length) {
      // add new views into list
      for (let i = 0; i <= lengthNew - this.views.length; i++) {
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
    } else if (lengthNew <= this.views.length) {
      // remove views from list into pool
      for (let i = 0; i < this.views.length - lengthNew; i++) {
        this.viewsPool.push(this.views.pop());
      }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tYW5hZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgWFJUWVBFX0lOTElORSwgWFJUWVBFX1ZSLCBYUlRZUEVfQVIsIFhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVLCBYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWHJEZXB0aFNlbnNpbmcgfSBmcm9tICcuL3hyLWRlcHRoLXNlbnNpbmcuanMnO1xuaW1wb3J0IHsgWHJEb21PdmVybGF5IH0gZnJvbSAnLi94ci1kb20tb3ZlcmxheS5qcyc7XG5pbXBvcnQgeyBYckhpdFRlc3QgfSBmcm9tICcuL3hyLWhpdC10ZXN0LmpzJztcbmltcG9ydCB7IFhySW1hZ2VUcmFja2luZyB9IGZyb20gJy4veHItaW1hZ2UtdHJhY2tpbmcuanMnO1xuaW1wb3J0IHsgWHJJbnB1dCB9IGZyb20gJy4veHItaW5wdXQuanMnO1xuaW1wb3J0IHsgWHJMaWdodEVzdGltYXRpb24gfSBmcm9tICcuL3hyLWxpZ2h0LWVzdGltYXRpb24uanMnO1xuaW1wb3J0IHsgWHJQbGFuZURldGVjdGlvbiB9IGZyb20gJy4veHItcGxhbmUtZGV0ZWN0aW9uLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYck1hbmFnZXIjZW5kWHJ9IGFuZCB7QGxpbmsgWHJNYW5hZ2VyI3N0YXJ0WHJ9LlxuICpcbiAqIEBjYWxsYmFjayBYckVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBvciBudWxsIGlmIG9wZXJhdGlvbiB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuXG4vKipcbiAqIE1hbmFnZSBhbmQgdXBkYXRlIFhSIHNlc3Npb24gYW5kIGl0cyBzdGF0ZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBYck1hbmFnZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXBwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIW5hdmlnYXRvci54cjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBib29sZWFuPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hdmFpbGFibGUgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSU2Vzc2lvbnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSV2ViR0xMYXllcnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Jhc2VMYXllciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJSZWZlcmVuY2VTcGFjZXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZmVyZW5jZVNwYWNlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBkZXB0aCBzZW5zaW5nIGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRlcHRoU2Vuc2luZ31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVwdGhTZW5zaW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIERPTSBvdmVybGF5IGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRvbU92ZXJsYXl9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRvbU92ZXJsYXk7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyB0aGUgYWJpbGl0eSB0byBwZXJmb3JtIGhpdCB0ZXN0cyBvbiB0aGUgcmVwcmVzZW50YXRpb24gb2YgcmVhbCB3b3JsZCBnZW9tZXRyeVxuICAgICAqIG9mIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3R9XG4gICAgICovXG4gICAgaGl0VGVzdDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBpbWFnZSB0cmFja2luZyBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJJbWFnZVRyYWNraW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbWFnZVRyYWNraW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIHBsYW5lIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJQbGFuZURldGVjdGlvbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcGxhbmVEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gSW5wdXQgU291cmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0fVxuICAgICAqL1xuICAgIGlucHV0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGxpZ2h0IGVzdGltYXRpb24gY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTGlnaHRFc3RpbWF0aW9ufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsaWdodEVzdGltYXRpb247XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FtZXJhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3MgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3NQb29sID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aE5lYXIgPSAwLjE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoRmFyID0gMTAwMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfd2lkdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oZWlnaHQgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBtYWluIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcblxuICAgICAgICAvLyBBZGQgYWxsIHRoZSBzdXBwb3J0ZWQgc2Vzc2lvbiB0eXBlc1xuICAgICAgICB0aGlzLl9hdmFpbGFibGVbWFJUWVBFX0lOTElORV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9WUl0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9BUl0gPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG5ldyBYckRlcHRoU2Vuc2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5kb21PdmVybGF5ID0gbmV3IFhyRG9tT3ZlcmxheSh0aGlzKTtcbiAgICAgICAgdGhpcy5oaXRUZXN0ID0gbmV3IFhySGl0VGVzdCh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nID0gbmV3IFhySW1hZ2VUcmFja2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbiA9IG5ldyBYclBsYW5lRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmlucHV0ID0gbmV3IFhySW5wdXQodGhpcyk7XG4gICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uID0gbmV3IFhyTGlnaHRFc3RpbWF0aW9uKHRoaXMpO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gMS4gSE1EIGNsYXNzIHdpdGggaXRzIHBhcmFtc1xuICAgICAgICAvLyAyLiBTcGFjZSBjbGFzc1xuICAgICAgICAvLyAzLiBDb250cm9sbGVycyBjbGFzc1xuXG4gICAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci54ci5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgc2Vzc2lvbiB0eXBlIHRoYXQgaGFzIGNoYW5nZWQgYXZhaWxhYmlsaXR5LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZScsIGZ1bmN0aW9uICh0eXBlLCBhdmFpbGFibGUpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1wiJyArIHR5cGUgKyAnXCIgWFIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlOlt0eXBlXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZTonICsgcGMuWFJUWVBFX1ZSLCBmdW5jdGlvbiAoYXZhaWxhYmxlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdJbW1lcnNpdmUgVlIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gWFIgc2Vzc2lvbiBpcyBzdGFydGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNzdGFydFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdzdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgc3RhcnRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNlbmRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBYUiBzZXNzaW9uIGhhcyBlbmRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHVwZGF0ZWQsIHByb3ZpZGluZyByZWxldmFudCBYUkZyYW1lIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjdXBkYXRlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGZyYW1lIC0gW1hSRnJhbWVdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9YUkZyYW1lKVxuICAgICAqIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIGZvciBpbnRlcmZhY2luZyBkaXJlY3RseSB3aXRoIFdlYlhSIEFQSXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ3VwZGF0ZScsIGZ1bmN0aW9uIChmcmFtZSkge1xuICAgICAqXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZmFpbGVkIHRvIHN0YXJ0IG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJNYW5hZ2VyI2Vycm9yXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSBFcnJvciBvYmplY3QgcmVsYXRlZCB0byBmYWlsdXJlIG9mIHNlc3Npb24gc3RhcnQgb3IgY2hlY2sgb2Ygc2Vzc2lvblxuICAgICAqIHR5cGUgc3VwcG9ydC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZXJyb3InLCBmdW5jdGlvbiAoZXgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgZmFpbGVkIHRvIHN0YXJ0LCBvciBmYWlsZWQgdG8gY2hlY2sgZm9yIHNlc3Npb24gdHlwZSBzdXBwb3J0XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgWHJNYW5hZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIHN0YXJ0IFhSIHNlc3Npb24gZm9yIHByb3ZpZGVkIHtAbGluayBDYW1lcmFDb21wb25lbnR9IGFuZCBvcHRpb25hbGx5IGZpcmVzXG4gICAgICogY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGNyZWF0ZWQgb3IgZmFpbGVkIHRvIGNyZWF0ZS4gSW50ZWdyYXRlZCBYUiBBUElzIG5lZWQgdG8gYmUgZW5hYmxlZFxuICAgICAqIGJ5IHByb3ZpZGluZyByZWxldmFudCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gSXQgd2lsbCBiZVxuICAgICAqIHVzZWQgdG8gcmVuZGVyIFhSIHNlc3Npb24gYW5kIG1hbmlwdWxhdGVkIGJhc2VkIG9uIHBvc2UgdHJhY2tpbmcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBhbHdheXMgc3VwcG9ydGVkIHNwYWNlIHdpdGggc29tZSBiYXNpYyB0cmFja2luZ1xuICAgICAqIGNhcGFiaWxpdGllcy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMfTogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGVcbiAgICAgKiB2aWV3ZXIgYXQgdGhlIHRpbWUgb2YgY3JlYXRpb24uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3IgYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTEZMT09SfTogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW5cbiAgICAgKiBhdCB0aGUgZmxvb3IgaW4gYSBzYWZlIHBvc2l0aW9uIGZvciB0aGUgdXNlciB0byBzdGFuZC4gVGhlIHkgYXhpcyBlcXVhbHMgMCBhdCBmbG9vciBsZXZlbC5cbiAgICAgKiBGbG9vciBsZXZlbCB2YWx1ZSBtaWdodCBiZSBlc3RpbWF0ZWQgYnkgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3JcbiAgICAgKiBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3Qgd2l0aCBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIFhSIHNlc3Npb24gaW5pdGlhbGl6YXRpb24uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMub3B0aW9uYWxGZWF0dXJlc10gLSBPcHRpb25hbCBmZWF0dXJlcyBmb3IgWFJTZXNzaW9uIHN0YXJ0LiBJdCBpc1xuICAgICAqIHVzZWQgZm9yIGdldHRpbmcgYWNjZXNzIHRvIGFkZGl0aW9uYWwgV2ViWFIgc3BlYyBleHRlbnNpb25zLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaW1hZ2VUcmFja2luZ10gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZVxuICAgICAqIHtAbGluayBYckltYWdlVHJhY2tpbmd9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGxhbmVEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJQbGFuZURldGVjdGlvbn0uXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IFtvcHRpb25zLmNhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb25cbiAgICAgKiBpcyBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWYgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgWFJcbiAgICAgKiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5kZXB0aFNlbnNpbmddIC0gT3B0aW9uYWwgb2JqZWN0IHdpdGggZGVwdGggc2Vuc2luZyBwYXJhbWV0ZXJzIHRvXG4gICAgICogYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nfS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZV0gLSBPcHRpb25hbCB1c2FnZSBwcmVmZXJlbmNlIGZvciBkZXB0aFxuICAgICAqIHNlbnNpbmcsIGNhbiBiZSAnY3B1LW9wdGltaXplZCcgb3IgJ2dwdS1vcHRpbWl6ZWQnIChYUkRFUFRIU0VOU0lOR1VTQUdFXyopLCBkZWZhdWx0cyB0b1xuICAgICAqICdjcHUtb3B0aW1pemVkJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nXG4gICAgICogc3lzdGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2VdIC0gT3B0aW9uYWwgZGF0YSBmb3JtYXRcbiAgICAgKiBwcmVmZXJlbmNlIGZvciBkZXB0aCBzZW5zaW5nLCBjYW4gYmUgJ2x1bWluYW5jZS1hbHBoYScgb3IgJ2Zsb2F0MzInXG4gICAgICogKFhSREVQVEhTRU5TSU5HRk9STUFUXyopLCBkZWZhdWx0cyB0byAnbHVtaW5hbmNlLWFscGhhJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsXG4gICAgICogYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmcgc3lzdGVtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX1ZSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IpO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX0FSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IsIHtcbiAgICAgKiAgICAgICAgIGRlcHRoU2Vuc2luZzogeyB9XG4gICAgICogICAgIH0pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0KGNhbWVyYSwgdHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCBjYWxsYmFjayA9IG9wdGlvbnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JylcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcblxuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZVt0eXBlXSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIGlzIG5vdCBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIHNlc3Npb24gaXMgYWxyZWFkeSBzdGFydGVkJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gdGhpcztcbiAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IHNwYWNlVHlwZTtcblxuICAgICAgICB0aGlzLl9zZXRDbGlwUGxhbmVzKGNhbWVyYS5uZWFyQ2xpcCwgY2FtZXJhLmZhckNsaXApO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gbWFrZVhSQ29tcGF0aWJsZVxuICAgICAgICAvLyBzY2VuYXJpbyB0byB0ZXN0OlxuICAgICAgICAvLyAxLiBhcHAgaXMgcnVubmluZyBvbiBpbnRlZ3JhdGVkIEdQVVxuICAgICAgICAvLyAyLiBYUiBkZXZpY2UgaXMgY29ubmVjdGVkLCB0byBhbm90aGVyIEdQVVxuICAgICAgICAvLyAzLiBwcm9iYWJseSBpbW1lcnNpdmUtdnIgd2lsbCBmYWlsIHRvIGJlIGNyZWF0ZWRcbiAgICAgICAgLy8gNC4gY2FsbCBtYWtlWFJDb21wYXRpYmxlLCB2ZXJ5IGxpa2VseSB3aWxsIGxlYWQgdG8gY29udGV4dCBsb3NzXG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXM6IFtzcGFjZVR5cGVdLFxuICAgICAgICAgICAgb3B0aW9uYWxGZWF0dXJlczogW11cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gWFJUWVBFX0FSKSB7XG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnbGlnaHQtZXN0aW1hdGlvbicpO1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hpdC10ZXN0Jyk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW1hZ2VUcmFja2luZyAmJiB0aGlzLmltYWdlVHJhY2tpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnaW1hZ2UtdHJhY2tpbmcnKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnBsYW5lRGV0ZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgncGxhbmUtZGV0ZWN0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRvbU92ZXJsYXkuc3VwcG9ydGVkICYmIHRoaXMuZG9tT3ZlcmxheS5yb290KSB7XG4gICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2RvbS1vdmVybGF5Jyk7XG4gICAgICAgICAgICAgICAgb3B0cy5kb21PdmVybGF5ID0geyByb290OiB0aGlzLmRvbU92ZXJsYXkucm9vdCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoU2Vuc2luZyAmJiB0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnZGVwdGgtc2Vuc2luZycpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXNhZ2VQcmVmZXJlbmNlID0gW1hSREVQVEhTRU5TSU5HVVNBR0VfQ1BVXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRm9ybWF0UHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4XTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gdXNhZ2VQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHVzYWdlUHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2VQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZGF0YUZvcm1hdFByZWZlcmVuY2UuaW5kZXhPZihvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSBkYXRhRm9ybWF0UHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2UudW5zaGlmdChvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb3B0cy5kZXB0aFNlbnNpbmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZTogdXNhZ2VQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhRm9ybWF0UHJlZmVyZW5jZTogZGF0YUZvcm1hdFByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFhSVFlQRV9WUikge1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hhbmQtdHJhY2tpbmcnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcylcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcyA9IG9wdHMub3B0aW9uYWxGZWF0dXJlcy5jb25jYXQob3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzKTtcblxuICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZCAmJiB0aGlzLmltYWdlVHJhY2tpbmcuaW1hZ2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnByZXBhcmVJbWFnZXMoKGVyciwgdHJhY2tlZEltYWdlcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0cmFja2VkSW1hZ2VzICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLnRyYWNrZWRJbWFnZXMgPSB0cmFja2VkSW1hZ2VzO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS5cbiAgICAgKiBAcGFyYW0geyp9IG9wdGlvbnMgLSBTZXNzaW9uIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRXJyb3IgY2FsbGJhY2suXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG5hdmlnYXRvci54ci5yZXF1ZXN0U2Vzc2lvbih0eXBlLCBvcHRpb25zKS50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gZW5kIFhSIHNlc3Npb24gYW5kIG9wdGlvbmFsbHkgZmlyZXMgY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGVuZGVkIG9yIGZhaWxlZCB0b1xuICAgICAqIGVuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpc1xuICAgICAqIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIGlmIChldnQua2V5ID09PSBwYy5LRVlfRVNDQVBFICYmIGFwcC54ci5hY3RpdmUpIHtcbiAgICAgKiAgICAgICAgIGFwcC54ci5lbmQoKTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZChjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBpbml0aWFsaXplZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYWxsYmFjaykgdGhpcy5vbmNlKCdlbmQnLCBjYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbi5lbmQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzcGVjaWZpYyB0eXBlIG9mIHNlc3Npb24gaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGFwcC54ci5pc0F2YWlsYWJsZShwYy5YUlRZUEVfVlIpKSB7XG4gICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAqIH1cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIGF2YWlsYWJsZS5cbiAgICAgKi9cbiAgICBpc0F2YWlsYWJsZSh0eXBlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdmFpbGFibGVbdHlwZV07XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25TdXBwb3J0Q2hlY2soa2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb25TdXBwb3J0Q2hlY2sodHlwZSkge1xuICAgICAgICBuYXZpZ2F0b3IueHIuaXNTZXNzaW9uU3VwcG9ydGVkKHR5cGUpLnRoZW4oKGF2YWlsYWJsZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F2YWlsYWJsZVt0eXBlXSA9PT0gYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlW3R5cGVdID0gYXZhaWxhYmxlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGUnLCB0eXBlLCBhdmFpbGFibGUpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGU6JyArIHR5cGUsIGF2YWlsYWJsZSk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUlNlc3Npb259IHNlc3Npb24gLSBYUiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBTcGFjZSB0eXBlIHRvIHJlcXVlc3QgZm9yIHRoZSBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdG8gY2FsbCB3aGVuIHNlc3Npb24gaXMgc3RhcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCBmYWlsZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblxuICAgICAgICBjb25zdCBvblZpc2liaWxpdHlDaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3Zpc2liaWxpdHk6Y2hhbmdlJywgc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9uQ2xpcFBsYW5lc0NoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldENsaXBQbGFuZXModGhpcy5fY2FtZXJhLm5lYXJDbGlwLCB0aGlzLl9jYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gY2xlYW4gdXAgb25jZSBzZXNzaW9uIGlzIGVuZGVkXG4gICAgICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5vZmYoJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLm9mZignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEueHIgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlc3Npb24ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kJywgb25FbmQpO1xuICAgICAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25WaXNpYmlsaXR5Q2hhbmdlKTtcblxuICAgICAgICAgICAgaWYgKCFmYWlsZWQpIHRoaXMuZmlyZSgnZW5kJyk7XG5cbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fcmVmZXJlbmNlU3BhY2UgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy52aWV3cyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSAwO1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gMDtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fc3BhY2VUeXBlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gb2xkIHJlcXVlc3RBbmltYXRpb25GcmFtZSB3aWxsIG5ldmVyIGJlIHRyaWdnZXJlZCxcbiAgICAgICAgICAgIC8vIHNvIHF1ZXVlIHVwIG5ldyB0aWNrXG4gICAgICAgICAgICB0aGlzLmFwcC50aWNrKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XG4gICAgICAgIHNlc3Npb24uYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIG9uVmlzaWJpbGl0eUNoYW5nZSk7XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhLm9uKCdzZXRfbmVhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICB0aGlzLl9jYW1lcmEub24oJ3NldF9mYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcblxuICAgICAgICAvLyBBIGZyYW1lYnVmZmVyU2NhbGVGYWN0b3Igc2NhbGUgb2YgMSBpcyB0aGUgZnVsbCByZXNvbHV0aW9uIG9mIHRoZSBkaXNwbGF5XG4gICAgICAgIC8vIHNvIHdlIG5lZWQgdG8gY2FsY3VsYXRlIHRoaXMgYmFzZWQgb24gZGV2aWNlUGl4ZWxSYXRpbyBvZiB0aGUgZGlzbGF5IGFuZCB3aGF0XG4gICAgICAgIC8vIHdlJ3ZlIHNldCB0aGlzIGluIHRoZSBncmFwaGljcyBkZXZpY2VcbiAgICAgICAgRGVidWcuYXNzZXJ0KHdpbmRvdywgJ3dpbmRvdyBpcyBuZWVkZWQgdG8gc2NhbGUgdGhlIFhSIGZyYW1lYnVmZmVyLiBBcmUgeW91IHJ1bm5pbmcgWFIgaGVhZGxlc3M/Jyk7XG4gICAgICAgIGNvbnN0IGZyYW1lYnVmZmVyU2NhbGVGYWN0b3IgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5tYXhQaXhlbFJhdGlvIC8gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG5cbiAgICAgICAgdGhpcy5fYmFzZUxheWVyID0gbmV3IFhSV2ViR0xMYXllcihzZXNzaW9uLCB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5nbCwge1xuICAgICAgICAgICAgYWxwaGE6IHRydWUsXG4gICAgICAgICAgICBkZXB0aDogdHJ1ZSxcbiAgICAgICAgICAgIHN0ZW5jaWw6IHRydWUsXG4gICAgICAgICAgICBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yOiBmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgYmFzZUxheWVyOiB0aGlzLl9iYXNlTGF5ZXIsXG4gICAgICAgICAgICBkZXB0aE5lYXI6IHRoaXMuX2RlcHRoTmVhcixcbiAgICAgICAgICAgIGRlcHRoRmFyOiB0aGlzLl9kZXB0aEZhclxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZXF1ZXN0IHJlZmVyZW5jZSBzcGFjZVxuICAgICAgICBzZXNzaW9uLnJlcXVlc3RSZWZlcmVuY2VTcGFjZShzcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IHJlZmVyZW5jZVNwYWNlO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcblxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnc3RhcnQnKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2Vzc2lvbi5lbmQoKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgLSBOZWFyIHBsYW5lIGRpc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYXIgLSBGYXIgcGxhbmUgZGlzdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0Q2xpcFBsYW5lcyhuZWFyLCBmYXIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlcHRoTmVhciA9PT0gbmVhciAmJiB0aGlzLl9kZXB0aEZhciA9PT0gZmFyKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2RlcHRoTmVhciA9IG5lYXI7XG4gICAgICAgIHRoaXMuX2RlcHRoRmFyID0gZmFyO1xuXG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBpZiBzZXNzaW9uIGlzIGF2YWlsYWJsZSxcbiAgICAgICAgLy8gcXVldWUgdXAgcmVuZGVyIHN0YXRlIHVwZGF0ZVxuICAgICAgICB0aGlzLl9zZXNzaW9uLnVwZGF0ZVJlbmRlclN0YXRlKHtcbiAgICAgICAgICAgIGRlcHRoTmVhcjogdGhpcy5fZGVwdGhOZWFyLFxuICAgICAgICAgICAgZGVwdGhGYXI6IHRoaXMuX2RlcHRoRmFyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdXBkYXRlIHdhcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBjYW52YXMgcmVzb2x1dGlvbiBzaG91bGQgYmUgc2V0IG9uIGZpcnN0IGZyYW1lIGF2YWlsYWJpbGl0eSBvciByZXNvbHV0aW9uIGNoYW5nZXNcbiAgICAgICAgY29uc3Qgd2lkdGggPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlcldpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlckhlaWdodDtcbiAgICAgICAgaWYgKHRoaXMuX3dpZHRoICE9PSB3aWR0aCB8fCB0aGlzLl9oZWlnaHQgIT09IGhlaWdodCkge1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLnNldFJlc29sdXRpb24od2lkdGgsIGhlaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwb3NlID0gZnJhbWUuZ2V0Vmlld2VyUG9zZSh0aGlzLl9yZWZlcmVuY2VTcGFjZSk7XG5cbiAgICAgICAgaWYgKCFwb3NlKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgbGVuZ3RoT2xkID0gdGhpcy52aWV3cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGxlbmd0aE5ldyA9IHBvc2Uudmlld3MubGVuZ3RoO1xuXG4gICAgICAgIGlmIChsZW5ndGhOZXcgPiB0aGlzLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gYWRkIG5ldyB2aWV3cyBpbnRvIGxpc3RcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IChsZW5ndGhOZXcgLSB0aGlzLnZpZXdzLmxlbmd0aCk7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCB2aWV3ID0gdGhpcy52aWV3c1Bvb2wucG9wKCk7XG4gICAgICAgICAgICAgICAgaWYgKCF2aWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3cG9ydDogbmV3IFZlYzQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2pNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3TWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld09mZk1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdJbnZNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3SW52T2ZmTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvalZpZXdPZmZNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3TWF0MzogbmV3IE1hdDMoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBuZXcgRmxvYXQzMkFycmF5KDMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IG5ldyBRdWF0KClcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdzLnB1c2godmlldyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobGVuZ3RoTmV3IDw9IHRoaXMudmlld3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgdmlld3MgZnJvbSBsaXN0IGludG8gcG9vbFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAodGhpcy52aWV3cy5sZW5ndGggLSBsZW5ndGhOZXcpOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdzUG9vbC5wdXNoKHRoaXMudmlld3MucG9wKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgcG9zaXRpb25cbiAgICAgICAgY29uc3QgcG9zZVBvc2l0aW9uID0gcG9zZS50cmFuc2Zvcm0ucG9zaXRpb247XG4gICAgICAgIGNvbnN0IHBvc2VPcmllbnRhdGlvbiA9IHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uO1xuICAgICAgICB0aGlzLl9sb2NhbFBvc2l0aW9uLnNldChwb3NlUG9zaXRpb24ueCwgcG9zZVBvc2l0aW9uLnksIHBvc2VQb3NpdGlvbi56KTtcbiAgICAgICAgdGhpcy5fbG9jYWxSb3RhdGlvbi5zZXQocG9zZU9yaWVudGF0aW9uLngsIHBvc2VPcmllbnRhdGlvbi55LCBwb3NlT3JpZW50YXRpb24ueiwgcG9zZU9yaWVudGF0aW9uLncpO1xuXG4gICAgICAgIGNvbnN0IGxheWVyID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXI7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb3NlLnZpZXdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAvLyBmb3IgZWFjaCB2aWV3LCBjYWxjdWxhdGUgbWF0cmljZXNcbiAgICAgICAgICAgIGNvbnN0IHZpZXdSYXcgPSBwb3NlLnZpZXdzW2ldO1xuICAgICAgICAgICAgY29uc3QgdmlldyA9IHRoaXMudmlld3NbaV07XG4gICAgICAgICAgICBjb25zdCB2aWV3cG9ydCA9IGxheWVyLmdldFZpZXdwb3J0KHZpZXdSYXcpO1xuXG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LnggPSB2aWV3cG9ydC54O1xuICAgICAgICAgICAgdmlldy52aWV3cG9ydC55ID0gdmlld3BvcnQueTtcbiAgICAgICAgICAgIHZpZXcudmlld3BvcnQueiA9IHZpZXdwb3J0LndpZHRoO1xuICAgICAgICAgICAgdmlldy52aWV3cG9ydC53ID0gdmlld3BvcnQuaGVpZ2h0O1xuXG4gICAgICAgICAgICB2aWV3LnByb2pNYXQuc2V0KHZpZXdSYXcucHJvamVjdGlvbk1hdHJpeCk7XG4gICAgICAgICAgICB2aWV3LnZpZXdNYXQuc2V0KHZpZXdSYXcudHJhbnNmb3JtLmludmVyc2UubWF0cml4KTtcbiAgICAgICAgICAgIHZpZXcudmlld0ludk1hdC5zZXQodmlld1Jhdy50cmFuc2Zvcm0ubWF0cml4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgY2FtZXJhIGZvdiBwcm9wZXJ0aWVzIG9ubHkgd2hlbiB3ZSBoYWQgMCB2aWV3c1xuICAgICAgICBpZiAobGVuZ3RoT2xkID09PSAwICYmIHRoaXMudmlld3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3Qgdmlld1Byb2pNYXQgPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgY29uc3QgdmlldyA9IHRoaXMudmlld3NbMF07XG5cbiAgICAgICAgICAgIHZpZXdQcm9qTWF0LmNvcHkodmlldy5wcm9qTWF0KTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB2aWV3UHJvak1hdC5kYXRhO1xuXG4gICAgICAgICAgICBjb25zdCBmb3YgPSAoMi4wICogTWF0aC5hdGFuKDEuMCAvIGRhdGFbNV0pICogMTgwLjApIC8gTWF0aC5QSTtcbiAgICAgICAgICAgIGNvbnN0IGFzcGVjdFJhdGlvID0gZGF0YVs1XSAvIGRhdGFbMF07XG4gICAgICAgICAgICBjb25zdCBmYXJDbGlwID0gZGF0YVsxNF0gLyAoZGF0YVsxMF0gKyAxKTtcbiAgICAgICAgICAgIGNvbnN0IG5lYXJDbGlwID0gZGF0YVsxNF0gLyAoZGF0YVsxMF0gLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGhvcml6b250YWxGb3YgPSBmYWxzZTtcblxuXG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLl9jYW1lcmEuY2FtZXJhO1xuICAgICAgICAgICAgY2FtZXJhLnNldFhyUHJvcGVydGllcyh7XG4gICAgICAgICAgICAgICAgYXNwZWN0UmF0aW8sXG4gICAgICAgICAgICAgICAgZmFyQ2xpcCxcbiAgICAgICAgICAgICAgICBmb3YsXG4gICAgICAgICAgICAgICAgaG9yaXpvbnRhbEZvdixcbiAgICAgICAgICAgICAgICBuZWFyQ2xpcFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcm90YXRlIGNhbWVyYSBiYXNlZCBvbiBjYWxjdWxhdGVkIHZlY3RvcnNcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS5fbm9kZS5zZXRMb2NhbFBvc2l0aW9uKHRoaXMuX2xvY2FsUG9zaXRpb24pO1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLl9ub2RlLnNldExvY2FsUm90YXRpb24odGhpcy5fbG9jYWxSb3RhdGlvbik7XG5cbiAgICAgICAgdGhpcy5pbnB1dC51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBYUlRZUEVfQVIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmhpdFRlc3Quc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuaGl0VGVzdC51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5saWdodEVzdGltYXRpb24uc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcudXBkYXRlKGZyYW1lLCBwb3NlICYmIHBvc2Uudmlld3NbMF0pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmltYWdlVHJhY2tpbmcudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMucGxhbmVEZXRlY3Rpb24uc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMucGxhbmVEZXRlY3Rpb24udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgndXBkYXRlJywgZnJhbWUpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgWFIgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIFhSIHNlc3Npb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBhY3RpdmUoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX3Nlc3Npb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0eXBlIG9mIGN1cnJlbnRseSBydW5uaW5nIFhSIHNlc3Npb24gb3IgbnVsbCBpZiBubyBzZXNzaW9uIGlzIHJ1bm5pbmcuIENhbiBiZSBhbnkgb2ZcbiAgICAgKiBYUlRZUEVfKi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyByZWZlcmVuY2Ugc3BhY2UgdHlwZSBvZiBjdXJyZW50bHkgcnVubmluZyBYUiBzZXNzaW9uIG9yIG51bGwgaWYgbm8gc2Vzc2lvbiBpc1xuICAgICAqIHJ1bm5pbmcuIENhbiBiZSBhbnkgb2YgWFJTUEFDRV8qLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCBzcGFjZVR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcGFjZVR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIFhSU2Vzc2lvbiBvZiBXZWJYUi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgc2Vzc2lvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nlc3Npb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZlIGNhbWVyYSBmb3Igd2hpY2ggWFIgc2Vzc2lvbiBpcyBydW5uaW5nIG9yIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgY2FtZXJhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhID8gdGhpcy5fY2FtZXJhLmVudGl0eSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5kaWNhdGVzIHdoZXRoZXIgV2ViWFIgY29udGVudCBpcyBjdXJyZW50bHkgdmlzaWJsZSB0byB0aGUgdXNlciwgYW5kIGlmIGl0IGlzLCB3aGV0aGVyIGl0J3NcbiAgICAgKiB0aGUgcHJpbWFyeSBmb2N1cy4gQ2FuIGJlICdoaWRkZW4nLCAndmlzaWJsZScgb3IgJ3Zpc2libGUtYmx1cnJlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgdmlzaWJpbGl0eVN0YXRlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYck1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJYck1hbmFnZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJuYXZpZ2F0b3IiLCJ4ciIsIl9hdmFpbGFibGUiLCJfdHlwZSIsIl9zcGFjZVR5cGUiLCJfc2Vzc2lvbiIsIl9iYXNlTGF5ZXIiLCJfcmVmZXJlbmNlU3BhY2UiLCJkZXB0aFNlbnNpbmciLCJkb21PdmVybGF5IiwiaGl0VGVzdCIsImltYWdlVHJhY2tpbmciLCJwbGFuZURldGVjdGlvbiIsImlucHV0IiwibGlnaHRFc3RpbWF0aW9uIiwiX2NhbWVyYSIsInZpZXdzIiwidmlld3NQb29sIiwiX2xvY2FsUG9zaXRpb24iLCJWZWMzIiwiX2xvY2FsUm90YXRpb24iLCJRdWF0IiwiX2RlcHRoTmVhciIsIl9kZXB0aEZhciIsIl93aWR0aCIsIl9oZWlnaHQiLCJYUlRZUEVfSU5MSU5FIiwiWFJUWVBFX1ZSIiwiWFJUWVBFX0FSIiwiWHJEZXB0aFNlbnNpbmciLCJYckRvbU92ZXJsYXkiLCJYckhpdFRlc3QiLCJYckltYWdlVHJhY2tpbmciLCJYclBsYW5lRGV0ZWN0aW9uIiwiWHJJbnB1dCIsIlhyTGlnaHRFc3RpbWF0aW9uIiwiYWRkRXZlbnRMaXN0ZW5lciIsIl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjayIsImRlc3Ryb3kiLCJzdGFydCIsImNhbWVyYSIsInR5cGUiLCJzcGFjZVR5cGUiLCJvcHRpb25zIiwiY2FsbGJhY2siLCJFcnJvciIsIl9zZXRDbGlwUGxhbmVzIiwibmVhckNsaXAiLCJmYXJDbGlwIiwib3B0cyIsInJlcXVpcmVkRmVhdHVyZXMiLCJvcHRpb25hbEZlYXR1cmVzIiwicHVzaCIsInN1cHBvcnRlZCIsInJvb3QiLCJ1c2FnZVByZWZlcmVuY2UiLCJYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSIsImRhdGFGb3JtYXRQcmVmZXJlbmNlIiwiWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCIsImluZCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1bnNoaWZ0IiwiY29uY2F0IiwiaW1hZ2VzIiwibGVuZ3RoIiwicHJlcGFyZUltYWdlcyIsImVyciIsInRyYWNrZWRJbWFnZXMiLCJmaXJlIiwiX29uU3RhcnRPcHRpb25zUmVhZHkiLCJyZXF1ZXN0U2Vzc2lvbiIsInRoZW4iLCJzZXNzaW9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiY2F0Y2giLCJleCIsImVuZCIsIm9uY2UiLCJpc0F2YWlsYWJsZSIsImtleSIsIl9zZXNzaW9uU3VwcG9ydENoZWNrIiwiaXNTZXNzaW9uU3VwcG9ydGVkIiwiYXZhaWxhYmxlIiwiZmFpbGVkIiwib25WaXNpYmlsaXR5Q2hhbmdlIiwidmlzaWJpbGl0eVN0YXRlIiwib25DbGlwUGxhbmVzQ2hhbmdlIiwib25FbmQiLCJvZmYiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwidGljayIsIm9uIiwiRGVidWciLCJhc3NlcnQiLCJ3aW5kb3ciLCJmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJtYXhQaXhlbFJhdGlvIiwiZGV2aWNlUGl4ZWxSYXRpbyIsIlhSV2ViR0xMYXllciIsImdsIiwiYWxwaGEiLCJkZXB0aCIsInN0ZW5jaWwiLCJ1cGRhdGVSZW5kZXJTdGF0ZSIsImJhc2VMYXllciIsImRlcHRoTmVhciIsImRlcHRoRmFyIiwicmVxdWVzdFJlZmVyZW5jZVNwYWNlIiwicmVmZXJlbmNlU3BhY2UiLCJuZWFyIiwiZmFyIiwidXBkYXRlIiwiZnJhbWUiLCJ3aWR0aCIsInJlbmRlclN0YXRlIiwiZnJhbWVidWZmZXJXaWR0aCIsImhlaWdodCIsImZyYW1lYnVmZmVySGVpZ2h0Iiwic2V0UmVzb2x1dGlvbiIsInBvc2UiLCJnZXRWaWV3ZXJQb3NlIiwibGVuZ3RoT2xkIiwibGVuZ3RoTmV3IiwiaSIsInZpZXciLCJwb3AiLCJ2aWV3cG9ydCIsIlZlYzQiLCJwcm9qTWF0IiwiTWF0NCIsInZpZXdNYXQiLCJ2aWV3T2ZmTWF0Iiwidmlld0ludk1hdCIsInZpZXdJbnZPZmZNYXQiLCJwcm9qVmlld09mZk1hdCIsInZpZXdNYXQzIiwiTWF0MyIsInBvc2l0aW9uIiwiRmxvYXQzMkFycmF5Iiwicm90YXRpb24iLCJwb3NlUG9zaXRpb24iLCJ0cmFuc2Zvcm0iLCJwb3NlT3JpZW50YXRpb24iLCJvcmllbnRhdGlvbiIsInNldCIsIngiLCJ5IiwieiIsInciLCJsYXllciIsInZpZXdSYXciLCJnZXRWaWV3cG9ydCIsInByb2plY3Rpb25NYXRyaXgiLCJpbnZlcnNlIiwibWF0cml4Iiwidmlld1Byb2pNYXQiLCJjb3B5IiwiZGF0YSIsImZvdiIsIk1hdGgiLCJhdGFuIiwiUEkiLCJhc3BlY3RSYXRpbyIsImhvcml6b250YWxGb3YiLCJzZXRYclByb3BlcnRpZXMiLCJfbm9kZSIsInNldExvY2FsUG9zaXRpb24iLCJzZXRMb2NhbFJvdGF0aW9uIiwiYWN0aXZlIiwiZW50aXR5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxTQUFTQyxZQUFZLENBQUM7QUFDakM7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxHQUFHLEVBQUU7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
