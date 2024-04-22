import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { XRTYPE_INLINE, XRTYPE_VR, XRTYPE_AR, XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGFORMAT_L8A8 } from './constants.js';
import { DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2 } from '../../platform/graphics/constants.js';
import { XrDepthSensing } from './xr-depth-sensing.js';
import { XrDomOverlay } from './xr-dom-overlay.js';
import { XrHitTest } from './xr-hit-test.js';
import { XrImageTracking } from './xr-image-tracking.js';
import { XrInput } from './xr-input.js';
import { XrLightEstimation } from './xr-light-estimation.js';
import { XrPlaneDetection } from './xr-plane-detection.js';
import { XrAnchors } from './xr-anchors.js';
import { XrMeshDetection } from './xr-mesh-detection.js';
import { XrViews } from './xr-views.js';

class XrManager extends EventHandler {
  constructor(app) {
    super();
    this.app = void 0;
    this._supported = platform.browser && !!navigator.xr;
    this._available = {};
    this._type = null;
    this._spaceType = null;
    this._session = null;
    this._baseLayer = null;
    this.webglBinding = null;
    this._referenceSpace = null;
    this.depthSensing = void 0;
    this.domOverlay = void 0;
    this.hitTest = void 0;
    this.imageTracking = void 0;
    this.planeDetection = void 0;
    this.meshDetection = void 0;
    this.input = void 0;
    this.lightEstimation = void 0;
    this.views = void 0;
    this.anchors = void 0;
    this._camera = null;
    this._localPosition = new Vec3();
    this._localRotation = new Quat();
    this._depthNear = 0.1;
    this._depthFar = 1000;
    this._supportedFrameRates = null;
    this._width = 0;
    this._height = 0;
    this._framebufferScaleFactor = 1.0;
    this.app = app;
    this._available[XRTYPE_INLINE] = false;
    this._available[XRTYPE_VR] = false;
    this._available[XRTYPE_AR] = false;
    this.views = new XrViews(this);
    this.depthSensing = new XrDepthSensing(this);
    this.domOverlay = new XrDomOverlay(this);
    this.hitTest = new XrHitTest(this);
    this.imageTracking = new XrImageTracking(this);
    this.planeDetection = new XrPlaneDetection(this);
    this.meshDetection = new XrMeshDetection(this);
    this.input = new XrInput(this);
    this.lightEstimation = new XrLightEstimation(this);
    this.anchors = new XrAnchors(this);
    this.views = new XrViews(this);
    if (this._supported) {
      navigator.xr.addEventListener('devicechange', () => {
        this._deviceAvailabilityCheck();
      });
      this._deviceAvailabilityCheck();
      this.app.graphicsDevice.on('devicelost', this._onDeviceLost, this);
      this.app.graphicsDevice.on('devicerestored', this._onDeviceRestored, this);
    }
  }
  destroy() {}
  start(camera, type, spaceType, options) {
    var _options$framebufferS, _this$app$graphicsDev, _this$app$graphicsDev2;
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
    this._framebufferScaleFactor = (_options$framebufferS = options == null ? void 0 : options.framebufferScaleFactor) != null ? _options$framebufferS : 1.0;
    this._setClipPlanes(camera.nearClip, camera.farClip);
    const opts = {
      requiredFeatures: [spaceType],
      optionalFeatures: []
    };
    const webgl = ((_this$app$graphicsDev = this.app.graphicsDevice) == null ? void 0 : _this$app$graphicsDev.isWebGL1) || ((_this$app$graphicsDev2 = this.app.graphicsDevice) == null ? void 0 : _this$app$graphicsDev2.isWebGL2);
    if (type === XRTYPE_AR) {
      opts.optionalFeatures.push('light-estimation');
      opts.optionalFeatures.push('hit-test');
      if (options) {
        if (options.imageTracking && this.imageTracking.supported) opts.optionalFeatures.push('image-tracking');
        if (options.planeDetection) opts.optionalFeatures.push('plane-detection');
        if (options.meshDetection) opts.optionalFeatures.push('mesh-detection');
      }
      if (this.domOverlay.supported && this.domOverlay.root) {
        opts.optionalFeatures.push('dom-overlay');
        opts.domOverlay = {
          root: this.domOverlay.root
        };
      }
      if (options && options.anchors && this.anchors.supported) {
        opts.optionalFeatures.push('anchors');
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
      if (webgl && options && options.cameraColor && this.views.supportedColor) {
        opts.optionalFeatures.push('camera-access');
      }
    }
    opts.optionalFeatures.push('hand-tracking');
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
  end(callback) {
    if (!this._session) {
      if (callback) callback(new Error('XR Session is not initialized'));
      return;
    }
    this.webglBinding = null;
    if (callback) this.once('end', callback);
    this._session.end();
  }
  isAvailable(type) {
    return this._available[type];
  }
  _deviceAvailabilityCheck() {
    for (const key in this._available) {
      this._sessionSupportCheck(key);
    }
  }
  initiateRoomCapture(callback) {
    if (!this._session) {
      callback(new Error('Session is not active'));
      return;
    }
    if (!this._session.initiateRoomCapture) {
      callback(new Error('Session does not support manual room capture'));
      return;
    }
    this._session.initiateRoomCapture().then(() => {
      if (callback) callback(null);
    }).catch(err => {
      if (callback) callback(err);
    });
  }
  updateTargetFrameRate(frameRate, callback) {
    var _this$_session;
    if (!((_this$_session = this._session) != null && _this$_session.updateTargetFrameRate)) {
      callback == null || callback(new Error('unable to update frameRate'));
      return;
    }
    this._session.updateTargetFrameRate(frameRate).then(() => {
      callback == null || callback();
    }).catch(err => {
      callback == null || callback(err);
    });
  }
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
  _onSessionStart(session, spaceType, callback) {
    let failed = false;
    this._session = session;
    const onVisibilityChange = () => {
      this.fire('visibility:change', session.visibilityState);
    };
    const onClipPlanesChange = () => {
      this._setClipPlanes(this._camera.nearClip, this._camera.farClip);
    };
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
      this._width = 0;
      this._height = 0;
      this._type = null;
      this._spaceType = null;
      if (this.app.systems) this.app.tick();
    };
    session.addEventListener('end', onEnd);
    session.addEventListener('visibilitychange', onVisibilityChange);
    this._camera.on('set_nearClip', onClipPlanesChange);
    this._camera.on('set_farClip', onClipPlanesChange);
    this._createBaseLayer();
    if (this.session.supportedFrameRates) {
      this._supportedFrameRates = Array.from(this.session.supportedFrameRates);
    } else {
      this._supportedFrameRates = null;
    }
    this._session.addEventListener('frameratechange', () => {
      var _this$_session2;
      this.fire('frameratechange', (_this$_session2 = this._session) == null ? void 0 : _this$_session2.frameRate);
    });
    session.requestReferenceSpace(spaceType).then(referenceSpace => {
      this._referenceSpace = referenceSpace;
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
  _setClipPlanes(near, far) {
    if (this._depthNear === near && this._depthFar === far) return;
    this._depthNear = near;
    this._depthFar = far;
    if (!this._session) return;
    this._session.updateRenderState({
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }
  _createBaseLayer() {
    const device = this.app.graphicsDevice;
    const framebufferScaleFactor = device.maxPixelRatio / window.devicePixelRatio * this._framebufferScaleFactor;
    this._baseLayer = new XRWebGLLayer(this._session, device.gl, {
      alpha: true,
      depth: true,
      stencil: true,
      framebufferScaleFactor: framebufferScaleFactor,
      antialias: false
    });
    const deviceType = device.deviceType;
    if ((deviceType === DEVICETYPE_WEBGL1 || deviceType === DEVICETYPE_WEBGL2) && window.XRWebGLBinding) {
      try {
        this.webglBinding = new XRWebGLBinding(this._session, device.gl);
      } catch (ex) {
        this.fire('error', ex);
      }
    }
    this._session.updateRenderState({
      baseLayer: this._baseLayer,
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }
  _onDeviceLost() {
    if (!this._session) return;
    if (this.webglBinding) this.webglBinding = null;
    this._baseLayer = null;
    this._session.updateRenderState({
      baseLayer: this._baseLayer,
      depthNear: this._depthNear,
      depthFar: this._depthFar
    });
  }
  _onDeviceRestored() {
    if (!this._session) return;
    setTimeout(() => {
      this.app.graphicsDevice.gl.makeXRCompatible().then(() => {
        this._createBaseLayer();
      }).catch(ex => {
        this.fire('error', ex);
      });
    }, 0);
  }
  update(frame) {
    if (!this._session) return false;
    const width = frame.session.renderState.baseLayer.framebufferWidth;
    const height = frame.session.renderState.baseLayer.framebufferHeight;
    if (this._width !== width || this._height !== height) {
      this._width = width;
      this._height = height;
      this.app.graphicsDevice.setResolution(width, height);
    }
    const pose = frame.getViewerPose(this._referenceSpace);
    if (!pose) return false;
    const lengthOld = this.views.list.length;
    this.views.update(frame, pose.views);
    const posePosition = pose.transform.position;
    const poseOrientation = pose.transform.orientation;
    this._localPosition.set(posePosition.x, posePosition.y, posePosition.z);
    this._localRotation.set(poseOrientation.x, poseOrientation.y, poseOrientation.z, poseOrientation.w);
    if (lengthOld === 0 && this.views.list.length > 0) {
      const viewProjMat = new Mat4();
      const view = this.views.list[0];
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
    this._camera.camera._node.setLocalPosition(this._localPosition);
    this._camera.camera._node.setLocalRotation(this._localRotation);
    this.input.update(frame);
    if (this._type === XRTYPE_AR) {
      if (this.hitTest.supported) this.hitTest.update(frame);
      if (this.lightEstimation.supported) this.lightEstimation.update(frame);
      if (this.imageTracking.supported) this.imageTracking.update(frame);
      if (this.anchors.supported) this.anchors.update(frame);
      if (this.planeDetection.supported) this.planeDetection.update(frame);
      if (this.depthSensing.supported) this.depthSensing.update();
      if (this.meshDetection.supported) this.meshDetection.update(frame);
    }
    this.fire('update', frame);
    return true;
  }
  get supported() {
    return this._supported;
  }
  get active() {
    return !!this._session;
  }
  get type() {
    return this._type;
  }
  get spaceType() {
    return this._spaceType;
  }
  get session() {
    return this._session;
  }
  get frameRate() {
    var _this$_session$frameR, _this$_session3;
    return (_this$_session$frameR = (_this$_session3 = this._session) == null ? void 0 : _this$_session3.frameRate) != null ? _this$_session$frameR : null;
  }
  get supportedFrameRates() {
    return this._supportedFrameRates;
  }
  get framebufferScaleFactor() {
    return this._framebufferScaleFactor;
  }
  set fixedFoveation(value) {
    var _this$_baseLayer$fixe, _this$_baseLayer;
    if (((_this$_baseLayer$fixe = (_this$_baseLayer = this._baseLayer) == null ? void 0 : _this$_baseLayer.fixedFoveation) != null ? _this$_baseLayer$fixe : null) !== null) {
      if (this.app.graphicsDevice.samples > 1) ;
      this._baseLayer.fixedFoveation = value;
    }
  }
  get fixedFoveation() {
    var _this$_baseLayer$fixe2, _this$_baseLayer2;
    return (_this$_baseLayer$fixe2 = (_this$_baseLayer2 = this._baseLayer) == null ? void 0 : _this$_baseLayer2.fixedFoveation) != null ? _this$_baseLayer$fixe2 : null;
  }
  get camera() {
    return this._camera ? this._camera.entity : null;
  }
  get visibilityState() {
    if (!this._session) return null;
    return this._session.visibilityState;
  }
}
XrManager.EVENT_AVAILABLE = 'available';
XrManager.EVENT_START = 'start';
XrManager.EVENT_END = 'end';
XrManager.EVENT_UPDATE = 'update';
XrManager.EVENT_ERROR = 'error';

export { XrManager };
