/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';
import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';
import { XRTYPE_INLINE, XRTYPE_VR, XRTYPE_AR, XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGFORMAT_L8A8 } from './constants.js';
import { XrHitTest } from './xr-hit-test.js';
import { XrInput } from './xr-input.js';
import { XrLightEstimation } from './xr-light-estimation.js';
import { XrImageTracking } from './xr-image-tracking.js';
import { XrDomOverlay } from './xr-dom-overlay.js';
import { XrDepthSensing } from './xr-depth-sensing.js';
import { XrPlaneDetection } from './xr-plane-detection.js';

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

    if (this._supported) {
      navigator.xr.addEventListener('devicechange', () => {
        this._deviceAvailabilityCheck();
      });

      this._deviceAvailabilityCheck();
    }
  }

  destroy() {
    this.depthSensing.destroy();
    this.depthSensing = null;
  }

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
      this.views = [];
      this._width = 0;
      this._height = 0;
      this._type = null;
      this._spaceType = null;
      this.app.tick();
    };

    session.addEventListener('end', onEnd);
    session.addEventListener('visibilitychange', onVisibilityChange);

    this._camera.on('set_nearClip', onClipPlanesChange);

    this._camera.on('set_farClip', onClipPlanesChange);

    this._baseLayer = new XRWebGLLayer(session, this.app.graphicsDevice.gl, {
      alpha: true,
      depth: true,
      stencil: true
    });
    session.updateRenderState({
      baseLayer: this._baseLayer,
      depthNear: this._depthNear,
      depthFar: this._depthFar
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
    const lengthNew = pose.views.length;

    if (lengthNew > this.views.length) {
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
      for (let i = 0; i < this.views.length - lengthNew; i++) {
        this.viewsPool.push(this.views.pop());
      }
    }

    const posePosition = pose.transform.position;
    const poseOrientation = pose.transform.orientation;

    this._localPosition.set(posePosition.x, posePosition.y, posePosition.z);

    this._localRotation.set(poseOrientation.x, poseOrientation.y, poseOrientation.z, poseOrientation.w);

    const layer = frame.session.renderState.baseLayer;

    for (let i = 0; i < pose.views.length; i++) {
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

  get camera() {
    return this._camera ? this._camera.entity : null;
  }

  get visibilityState() {
    if (!this._session) return null;
    return this._session.visibilityState;
  }

}

export { XrManager };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3hyL3hyLW1hbmFnZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5cbmltcG9ydCB7IE1hdDMgfSBmcm9tICcuLi9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IFhSVFlQRV9JTkxJTkUsIFhSVFlQRV9WUiwgWFJUWVBFX0FSLCBYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSwgWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFhySGl0VGVzdCB9IGZyb20gJy4veHItaGl0LXRlc3QuanMnO1xuaW1wb3J0IHsgWHJJbnB1dCB9IGZyb20gJy4veHItaW5wdXQuanMnO1xuaW1wb3J0IHsgWHJMaWdodEVzdGltYXRpb24gfSBmcm9tICcuL3hyLWxpZ2h0LWVzdGltYXRpb24uanMnO1xuaW1wb3J0IHsgWHJJbWFnZVRyYWNraW5nIH0gZnJvbSAnLi94ci1pbWFnZS10cmFja2luZy5qcyc7XG5pbXBvcnQgeyBYckRvbU92ZXJsYXkgfSBmcm9tICcuL3hyLWRvbS1vdmVybGF5LmpzJztcbmltcG9ydCB7IFhyRGVwdGhTZW5zaW5nIH0gZnJvbSAnLi94ci1kZXB0aC1zZW5zaW5nLmpzJztcbmltcG9ydCB7IFhyUGxhbmVEZXRlY3Rpb24gfSBmcm9tICcuL3hyLXBsYW5lLWRldGVjdGlvbi5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBBcHBCYXNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgWHJNYW5hZ2VyI2VuZFhyfSBhbmQge0BsaW5rIFhyTWFuYWdlciNzdGFydFhyfS5cbiAqXG4gKiBAY2FsbGJhY2sgWHJFcnJvckNhbGxiYWNrXG4gKiBAcGFyYW0ge0Vycm9yfG51bGx9IGVyciAtIFRoZSBFcnJvciBvYmplY3Qgb3IgbnVsbCBpZiBvcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWwuXG4gKi9cblxuLyoqXG4gKiBNYW5hZ2UgYW5kIHVwZGF0ZSBYUiBzZXNzaW9uIGFuZCBpdHMgc3RhdGVzLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJNYW5hZ2VyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXBwQmFzZX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXBwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIW5hdmlnYXRvci54cjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBib29sZWFuPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hdmFpbGFibGUgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSU2Vzc2lvbnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSV2ViR0xMYXllcnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Jhc2VMYXllciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJSZWZlcmVuY2VTcGFjZXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZmVyZW5jZVNwYWNlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBkZXB0aCBzZW5zaW5nIGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRlcHRoU2Vuc2luZ31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVwdGhTZW5zaW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIERPTSBvdmVybGF5IGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRvbU92ZXJsYXl9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRvbU92ZXJsYXk7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyB0aGUgYWJpbGl0eSB0byBwZXJmb3JtIGhpdCB0ZXN0cyBvbiB0aGUgcmVwcmVzZW50YXRpb24gb2YgcmVhbCB3b3JsZCBnZW9tZXRyeVxuICAgICAqIG9mIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3R9XG4gICAgICovXG4gICAgaGl0VGVzdDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBpbWFnZSB0cmFja2luZyBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJJbWFnZVRyYWNraW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbWFnZVRyYWNraW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIHBsYW5lIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJQbGFuZURldGVjdGlvbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcGxhbmVEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gSW5wdXQgU291cmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0fVxuICAgICAqL1xuICAgIGlucHV0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGxpZ2h0IGVzdGltYXRpb24gY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTGlnaHRFc3RpbWF0aW9ufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsaWdodEVzdGltYXRpb247XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Q2FtZXJhQ29tcG9uZW50fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbWVyYSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXk8Kj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHZpZXdzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXk8Kj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHZpZXdzUG9vbCA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVwdGhOZWFyID0gMC4xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aEZhciA9IDEwMDA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dpZHRoID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGVpZ2h0ID0gMDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYck1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FwcEJhc2V9IGFwcCAtIFRoZSBtYWluIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcblxuICAgICAgICAvLyBBZGQgYWxsIHRoZSBzdXBwb3J0ZWQgc2Vzc2lvbiB0eXBlc1xuICAgICAgICB0aGlzLl9hdmFpbGFibGVbWFJUWVBFX0lOTElORV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9WUl0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9BUl0gPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG5ldyBYckRlcHRoU2Vuc2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5kb21PdmVybGF5ID0gbmV3IFhyRG9tT3ZlcmxheSh0aGlzKTtcbiAgICAgICAgdGhpcy5oaXRUZXN0ID0gbmV3IFhySGl0VGVzdCh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nID0gbmV3IFhySW1hZ2VUcmFja2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbiA9IG5ldyBYclBsYW5lRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmlucHV0ID0gbmV3IFhySW5wdXQodGhpcyk7XG4gICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uID0gbmV3IFhyTGlnaHRFc3RpbWF0aW9uKHRoaXMpO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gMS4gSE1EIGNsYXNzIHdpdGggaXRzIHBhcmFtc1xuICAgICAgICAvLyAyLiBTcGFjZSBjbGFzc1xuICAgICAgICAvLyAzLiBDb250cm9sbGVycyBjbGFzc1xuXG4gICAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci54ci5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgc2Vzc2lvbiB0eXBlIHRoYXQgaGFzIGNoYW5nZWQgYXZhaWxhYmlsaXR5LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZScsIGZ1bmN0aW9uICh0eXBlLCBhdmFpbGFibGUpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1wiJyArIHR5cGUgKyAnXCIgWFIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlOlt0eXBlXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZTonICsgcGMuWFJUWVBFX1ZSLCBmdW5jdGlvbiAoYXZhaWxhYmxlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdJbW1lcnNpdmUgVlIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gWFIgc2Vzc2lvbiBpcyBzdGFydGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNzdGFydFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdzdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgc3RhcnRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNlbmRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBYUiBzZXNzaW9uIGhhcyBlbmRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHVwZGF0ZWQsIHByb3ZpZGluZyByZWxldmFudCBYUkZyYW1lIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjdXBkYXRlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGZyYW1lIC0gW1hSRnJhbWVdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9YUkZyYW1lKVxuICAgICAqIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIGZvciBpbnRlcmZhY2luZyBkaXJlY3RseSB3aXRoIFdlYlhSIEFQSXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ3VwZGF0ZScsIGZ1bmN0aW9uIChmcmFtZSkge1xuICAgICAqXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZmFpbGVkIHRvIHN0YXJ0IG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJNYW5hZ2VyI2Vycm9yXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSBFcnJvciBvYmplY3QgcmVsYXRlZCB0byBmYWlsdXJlIG9mIHNlc3Npb24gc3RhcnQgb3IgY2hlY2sgb2Ygc2Vzc2lvblxuICAgICAqIHR5cGUgc3VwcG9ydC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZXJyb3InLCBmdW5jdGlvbiAoZXgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgZmFpbGVkIHRvIHN0YXJ0LCBvciBmYWlsZWQgdG8gY2hlY2sgZm9yIHNlc3Npb24gdHlwZSBzdXBwb3J0XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgWHJNYW5hZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIHN0YXJ0IFhSIHNlc3Npb24gZm9yIHByb3ZpZGVkIHtAbGluayBDYW1lcmFDb21wb25lbnR9IGFuZCBvcHRpb25hbGx5IGZpcmVzXG4gICAgICogY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGNyZWF0ZWQgb3IgZmFpbGVkIHRvIGNyZWF0ZS4gSW50ZWdyYXRlZCBYUiBBUElzIG5lZWQgdG8gYmUgZW5hYmxlZFxuICAgICAqIGJ5IHByb3ZpZGluZyByZWxldmFudCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIEl0IHdpbGwgYmUgdXNlZCB0byByZW5kZXIgWFIgc2Vzc2lvbiBhbmQgbWFuaXB1bGF0ZWQgYmFzZWRcbiAgICAgKiBvbiBwb3NlIHRyYWNraW5nLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRZUEVfSU5MSU5FfTogSW5saW5lIC0gYWx3YXlzIGF2YWlsYWJsZSB0eXBlIG9mIHNlc3Npb24uIEl0IGhhcyBsaW1pdGVkIGZlYXR1cmVzXG4gICAgICogYXZhaWxhYmlsaXR5IGFuZCBpcyByZW5kZXJlZCBpbnRvIEhUTUwgZWxlbWVudC5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfVlJ9OiBJbW1lcnNpdmUgVlIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byBWUiBkZXZpY2Ugd2l0aFxuICAgICAqIGJlc3QgYXZhaWxhYmxlIHRyYWNraW5nIGZlYXR1cmVzLlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9BUn06IEltbWVyc2l2ZSBBUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSL0FSIGRldmljZVxuICAgICAqIHRoYXQgaXMgaW50ZW5kZWQgdG8gYmUgYmxlbmRlZCB3aXRoIHJlYWwtd29ybGQgZW52aXJvbm1lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVklFV0VSfTogVmlld2VyIC0gYWx3YXlzIHN1cHBvcnRlZCBzcGFjZSB3aXRoIHNvbWUgYmFzaWMgdHJhY2tpbmdcbiAgICAgKiBjYXBhYmlsaXRpZXMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTH06IExvY2FsIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luIG5lYXIgdGhlXG4gICAgICogdmlld2VyIGF0IHRoZSB0aW1lIG9mIGNyZWF0aW9uLiBJdCBpcyBtZWFudCBmb3Igc2VhdGVkIG9yIGJhc2ljIGxvY2FsIFhSIHNlc3Npb25zLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUxGTE9PUn06IExvY2FsIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luXG4gICAgICogYXQgdGhlIGZsb29yIGluIGEgc2FmZSBwb3NpdGlvbiBmb3IgdGhlIHVzZXIgdG8gc3RhbmQuIFRoZSB5IGF4aXMgZXF1YWxzIDAgYXQgZmxvb3IgbGV2ZWwuXG4gICAgICogRmxvb3IgbGV2ZWwgdmFsdWUgbWlnaHQgYmUgZXN0aW1hdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIHBsYXRmb3JtLiBJdCBpcyBtZWFudCBmb3Igc2VhdGVkIG9yXG4gICAgICogYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9CT1VOREVERkxPT1J9OiBCb3VuZGVkIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggaXRzIG5hdGl2ZVxuICAgICAqIG9yaWdpbiBhdCB0aGUgZmxvb3IsIHdoZXJlIHRoZSB1c2VyIGlzIGV4cGVjdGVkIHRvIG1vdmUgd2l0aGluIGEgcHJlLWVzdGFibGlzaGVkIGJvdW5kYXJ5LlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVU5CT1VOREVEfTogVW5ib3VuZGVkIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdoZXJlIHRoZSB1c2VyIGlzXG4gICAgICogZXhwZWN0ZWQgdG8gbW92ZSBmcmVlbHkgYXJvdW5kIHRoZWlyIGVudmlyb25tZW50LCBwb3RlbnRpYWxseSBsb25nIGRpc3RhbmNlcyBmcm9tIHRoZWlyXG4gICAgICogc3RhcnRpbmcgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IHdpdGggYWRkaXRpb25hbCBvcHRpb25zIGZvciBYUiBzZXNzaW9uIGluaXRpYWxpemF0aW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFtvcHRpb25zLm9wdGlvbmFsRmVhdHVyZXNdIC0gT3B0aW9uYWwgZmVhdHVyZXMgZm9yIFhSU2Vzc2lvbiBzdGFydC4gSXQgaXNcbiAgICAgKiB1c2VkIGZvciBnZXR0aW5nIGFjY2VzcyB0byBhZGRpdGlvbmFsIFdlYlhSIHNwZWMgZXh0ZW5zaW9ucy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmltYWdlVHJhY2tpbmddIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJJbWFnZVRyYWNraW5nfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnBsYW5lRGV0ZWN0aW9uXSAtIFNldCB0byB0cnVlIHRvIGF0dGVtcHQgdG8gZW5hYmxlXG4gICAgICoge0BsaW5rIFhyUGxhbmVEZXRlY3Rpb259LlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBbb3B0aW9ucy5jYWxsYmFja10gLSBPcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiBjYWxsZWQgb25jZSBzZXNzaW9uXG4gICAgICogaXMgc3RhcnRlZC4gVGhlIGNhbGxiYWNrIGhhcyBvbmUgYXJndW1lbnQgRXJyb3IgLSBpdCBpcyBudWxsIGlmIHN1Y2Nlc3NmdWxseSBzdGFydGVkIFhSXG4gICAgICogc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnMuZGVwdGhTZW5zaW5nXSAtIE9wdGlvbmFsIG9iamVjdCB3aXRoIGRlcHRoIHNlbnNpbmcgcGFyYW1ldGVycyB0b1xuICAgICAqIGF0dGVtcHQgdG8gZW5hYmxlIHtAbGluayBYckRlcHRoU2Vuc2luZ30uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2VdIC0gT3B0aW9uYWwgdXNhZ2UgcHJlZmVyZW5jZSBmb3IgZGVwdGhcbiAgICAgKiBzZW5zaW5nLCBjYW4gYmUgJ2NwdS1vcHRpbWl6ZWQnIG9yICdncHUtb3B0aW1pemVkJyAoWFJERVBUSFNFTlNJTkdVU0FHRV8qKSwgZGVmYXVsdHMgdG9cbiAgICAgKiAnY3B1LW9wdGltaXplZCcuIE1vc3QgcHJlZmVycmVkIGFuZCBzdXBwb3J0ZWQgd2lsbCBiZSBjaG9zZW4gYnkgdGhlIHVuZGVybHlpbmcgZGVwdGggc2Vuc2luZ1xuICAgICAqIHN5c3RlbS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLmRhdGFGb3JtYXRQcmVmZXJlbmNlXSAtIE9wdGlvbmFsIGRhdGEgZm9ybWF0XG4gICAgICogcHJlZmVyZW5jZSBmb3IgZGVwdGggc2Vuc2luZywgY2FuIGJlICdsdW1pbmFuY2UtYWxwaGEnIG9yICdmbG9hdDMyJ1xuICAgICAqIChYUkRFUFRIU0VOU0lOR0ZPUk1BVF8qKSwgZGVmYXVsdHMgdG8gJ2x1bWluYW5jZS1hbHBoYScuIE1vc3QgcHJlZmVycmVkIGFuZCBzdXBwb3J0ZWQgd2lsbFxuICAgICAqIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nIHN5c3RlbS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGJ1dHRvbi5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIGFwcC54ci5zdGFydChjYW1lcmEsIHBjLlhSVFlQRV9WUiwgcGMuWFJTUEFDRV9MT0NBTEZMT09SKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGJ1dHRvbi5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIGFwcC54ci5zdGFydChjYW1lcmEsIHBjLlhSVFlQRV9BUiwgcGMuWFJTUEFDRV9MT0NBTEZMT09SLCB7XG4gICAgICogICAgICAgICBkZXB0aFNlbnNpbmc6IHsgfVxuICAgICAqICAgICB9KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBzdGFydChjYW1lcmEsIHR5cGUsIHNwYWNlVHlwZSwgb3B0aW9ucykge1xuICAgICAgICBsZXQgY2FsbGJhY2sgPSBvcHRpb25zO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcpXG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9hdmFpbGFibGVbdHlwZV0pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBpcyBub3QgYXZhaWxhYmxlJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBzZXNzaW9uIGlzIGFscmVhZHkgc3RhcnRlZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbWVyYSA9IGNhbWVyYTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IHRoaXM7XG4gICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlO1xuICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBzcGFjZVR5cGU7XG5cbiAgICAgICAgdGhpcy5fc2V0Q2xpcFBsYW5lcyhjYW1lcmEubmVhckNsaXAsIGNhbWVyYS5mYXJDbGlwKTtcblxuICAgICAgICAvLyBUT0RPXG4gICAgICAgIC8vIG1ha2VYUkNvbXBhdGlibGVcbiAgICAgICAgLy8gc2NlbmFyaW8gdG8gdGVzdDpcbiAgICAgICAgLy8gMS4gYXBwIGlzIHJ1bm5pbmcgb24gaW50ZWdyYXRlZCBHUFVcbiAgICAgICAgLy8gMi4gWFIgZGV2aWNlIGlzIGNvbm5lY3RlZCwgdG8gYW5vdGhlciBHUFVcbiAgICAgICAgLy8gMy4gcHJvYmFibHkgaW1tZXJzaXZlLXZyIHdpbGwgZmFpbCB0byBiZSBjcmVhdGVkXG4gICAgICAgIC8vIDQuIGNhbGwgbWFrZVhSQ29tcGF0aWJsZSwgdmVyeSBsaWtlbHkgd2lsbCBsZWFkIHRvIGNvbnRleHQgbG9zc1xuXG4gICAgICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICAgICAgICByZXF1aXJlZEZlYXR1cmVzOiBbc3BhY2VUeXBlXSxcbiAgICAgICAgICAgIG9wdGlvbmFsRmVhdHVyZXM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHR5cGUgPT09IFhSVFlQRV9BUikge1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2xpZ2h0LWVzdGltYXRpb24nKTtcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdoaXQtdGVzdCcpO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmltYWdlVHJhY2tpbmcgJiYgdGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2ltYWdlLXRyYWNraW5nJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5wbGFuZURldGVjdGlvbilcbiAgICAgICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ3BsYW5lLWRldGVjdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5kb21PdmVybGF5LnN1cHBvcnRlZCAmJiB0aGlzLmRvbU92ZXJsYXkucm9vdCkge1xuICAgICAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdkb20tb3ZlcmxheScpO1xuICAgICAgICAgICAgICAgIG9wdHMuZG9tT3ZlcmxheSA9IHsgcm9vdDogdGhpcy5kb21PdmVybGF5LnJvb3QgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXB0aFNlbnNpbmcgJiYgdGhpcy5kZXB0aFNlbnNpbmcuc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2RlcHRoLXNlbnNpbmcnKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHVzYWdlUHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVV07XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YUZvcm1hdFByZWZlcmVuY2UgPSBbWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOF07XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZCA9IHVzYWdlUHJlZmVyZW5jZS5pbmRleE9mKG9wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSB1c2FnZVByZWZlcmVuY2Uuc3BsaWNlKGluZCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZS51bnNoaWZ0KG9wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGVwdGhTZW5zaW5nLmRhdGFGb3JtYXRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZCA9IGRhdGFGb3JtYXRQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kICE9PSAtMSkgZGF0YUZvcm1hdFByZWZlcmVuY2Uuc3BsaWNlKGluZCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFGb3JtYXRQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG9wdHMuZGVwdGhTZW5zaW5nID0ge1xuICAgICAgICAgICAgICAgICAgICB1c2FnZVByZWZlcmVuY2U6IHVzYWdlUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2U6IGRhdGFGb3JtYXRQcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBYUlRZUEVfVlIpIHtcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcy5wdXNoKCdoYW5kLXRyYWNraW5nJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm9wdGlvbmFsRmVhdHVyZXMpXG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMgPSBvcHRzLm9wdGlvbmFsRmVhdHVyZXMuY29uY2F0KG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuaW1hZ2VUcmFja2luZy5zdXBwb3J0ZWQgJiYgdGhpcy5pbWFnZVRyYWNraW5nLmltYWdlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuaW1hZ2VUcmFja2luZy5wcmVwYXJlSW1hZ2VzKChlcnIsIHRyYWNrZWRJbWFnZXMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHJhY2tlZEltYWdlcyAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgb3B0cy50cmFja2VkSW1hZ2VzID0gdHJhY2tlZEltYWdlcztcblxuICAgICAgICAgICAgICAgIHRoaXMuX29uU3RhcnRPcHRpb25zUmVhZHkodHlwZSwgc3BhY2VUeXBlLCBvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uU3RhcnRPcHRpb25zUmVhZHkodHlwZSwgc3BhY2VUeXBlLCBvcHRzLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuXG4gICAgICogQHBhcmFtIHsqfSBvcHRpb25zIC0gU2Vzc2lvbiBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBjYWxsYmFjayAtIEVycm9yIGNhbGxiYWNrLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uU3RhcnRPcHRpb25zUmVhZHkodHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBuYXZpZ2F0b3IueHIucmVxdWVzdFNlc3Npb24odHlwZSwgb3B0aW9ucykudGhlbigoc2Vzc2lvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5fb25TZXNzaW9uU3RhcnQoc2Vzc2lvbiwgc3BhY2VUeXBlLCBjYWxsYmFjayk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIGVuZCBYUiBzZXNzaW9uIGFuZCBvcHRpb25hbGx5IGZpcmVzIGNhbGxiYWNrIHdoZW4gc2Vzc2lvbiBpcyBlbmRlZCBvciBmYWlsZWQgdG9cbiAgICAgKiBlbmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1hyRXJyb3JDYWxsYmFja30gW2NhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb24gaXNcbiAgICAgKiBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWYgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgWFJcbiAgICAgKiBzZXNzaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2dCkge1xuICAgICAqICAgICBpZiAoZXZ0LmtleSA9PT0gcGMuS0VZX0VTQ0FQRSAmJiBhcHAueHIuYWN0aXZlKSB7XG4gICAgICogICAgICAgICBhcHAueHIuZW5kKCk7XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBlbmQoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ldyBFcnJvcignWFIgU2Vzc2lvbiBpcyBub3QgaW5pdGlhbGl6ZWQnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FsbGJhY2spIHRoaXMub25jZSgnZW5kJywgY2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24uZW5kKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgc3BlY2lmaWMgdHlwZSBvZiBzZXNzaW9uIGlzIGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRZUEVfSU5MSU5FfTogSW5saW5lIC0gYWx3YXlzIGF2YWlsYWJsZSB0eXBlIG9mIHNlc3Npb24uIEl0IGhhcyBsaW1pdGVkIGZlYXR1cmVzXG4gICAgICogYXZhaWxhYmlsaXR5IGFuZCBpcyByZW5kZXJlZCBpbnRvIEhUTUwgZWxlbWVudC5cbiAgICAgKiAtIHtAbGluayBYUlRZUEVfVlJ9OiBJbW1lcnNpdmUgVlIgLSBzZXNzaW9uIHRoYXQgcHJvdmlkZXMgZXhjbHVzaXZlIGFjY2VzcyB0byBWUiBkZXZpY2Ugd2l0aFxuICAgICAqIGJlc3QgYXZhaWxhYmxlIHRyYWNraW5nIGZlYXR1cmVzLlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9BUn06IEltbWVyc2l2ZSBBUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSL0FSIGRldmljZVxuICAgICAqIHRoYXQgaXMgaW50ZW5kZWQgdG8gYmUgYmxlbmRlZCB3aXRoIHJlYWwtd29ybGQgZW52aXJvbm1lbnQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChhcHAueHIuaXNBdmFpbGFibGUocGMuWFJUWVBFX1ZSKSkge1xuICAgICAqICAgICAvLyBWUiBpcyBhdmFpbGFibGVcbiAgICAgKiB9XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3BlY2lmaWVkIHNlc3Npb24gdHlwZSBpcyBhdmFpbGFibGUuXG4gICAgICovXG4gICAgaXNBdmFpbGFibGUodHlwZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlW3R5cGVdO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXNzaW9uU3VwcG9ydENoZWNrKGtleSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFNlc3Npb24gdHlwZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXNzaW9uU3VwcG9ydENoZWNrKHR5cGUpIHtcbiAgICAgICAgbmF2aWdhdG9yLnhyLmlzU2Vzc2lvblN1cHBvcnRlZCh0eXBlKS50aGVuKChhdmFpbGFibGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hdmFpbGFibGVbdHlwZV0gPT09IGF2YWlsYWJsZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuX2F2YWlsYWJsZVt0eXBlXSA9IGF2YWlsYWJsZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlJywgdHlwZSwgYXZhaWxhYmxlKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlOicgKyB0eXBlLCBhdmFpbGFibGUpO1xuICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7WFJTZXNzaW9ufSBzZXNzaW9uIC0gWFIgc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3BhY2VUeXBlIC0gU3BhY2UgdHlwZSB0byByZXF1ZXN0IGZvciB0aGUgc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIHRvIGNhbGwgd2hlbiBzZXNzaW9uIGlzIHN0YXJ0ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TZXNzaW9uU3RhcnQoc2Vzc2lvbiwgc3BhY2VUeXBlLCBjYWxsYmFjaykge1xuICAgICAgICBsZXQgZmFpbGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IHNlc3Npb247XG5cbiAgICAgICAgY29uc3Qgb25WaXNpYmlsaXR5Q2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5maXJlKCd2aXNpYmlsaXR5OmNoYW5nZScsIHNlc3Npb24udmlzaWJpbGl0eVN0YXRlKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBvbkNsaXBQbGFuZXNDaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9zZXRDbGlwUGxhbmVzKHRoaXMuX2NhbWVyYS5uZWFyQ2xpcCwgdGhpcy5fY2FtZXJhLmZhckNsaXApO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGNsZWFuIHVwIG9uY2Ugc2Vzc2lvbiBpcyBlbmRlZFxuICAgICAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYW1lcmEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmEub2ZmKCdzZXRfbmVhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5vZmYoJ3NldF9mYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEueHIgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlc3Npb24ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kJywgb25FbmQpO1xuICAgICAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25WaXNpYmlsaXR5Q2hhbmdlKTtcblxuICAgICAgICAgICAgaWYgKCFmYWlsZWQpIHRoaXMuZmlyZSgnZW5kJyk7XG5cbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fcmVmZXJlbmNlU3BhY2UgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy52aWV3cyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSAwO1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gMDtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fc3BhY2VUeXBlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gb2xkIHJlcXVlc3RBbmltYXRpb25GcmFtZSB3aWxsIG5ldmVyIGJlIHRyaWdnZXJlZCxcbiAgICAgICAgICAgIC8vIHNvIHF1ZXVlIHVwIG5ldyB0aWNrXG4gICAgICAgICAgICB0aGlzLmFwcC50aWNrKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XG4gICAgICAgIHNlc3Npb24uYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIG9uVmlzaWJpbGl0eUNoYW5nZSk7XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhLm9uKCdzZXRfbmVhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuICAgICAgICB0aGlzLl9jYW1lcmEub24oJ3NldF9mYXJDbGlwJywgb25DbGlwUGxhbmVzQ2hhbmdlKTtcblxuICAgICAgICB0aGlzLl9iYXNlTGF5ZXIgPSBuZXcgWFJXZWJHTExheWVyKHNlc3Npb24sIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLmdsLCB7XG4gICAgICAgICAgICBhbHBoYTogdHJ1ZSxcbiAgICAgICAgICAgIGRlcHRoOiB0cnVlLFxuICAgICAgICAgICAgc3RlbmNpbDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICBzZXNzaW9uLnVwZGF0ZVJlbmRlclN0YXRlKHtcbiAgICAgICAgICAgIGJhc2VMYXllcjogdGhpcy5fYmFzZUxheWVyLFxuICAgICAgICAgICAgZGVwdGhOZWFyOiB0aGlzLl9kZXB0aE5lYXIsXG4gICAgICAgICAgICBkZXB0aEZhcjogdGhpcy5fZGVwdGhGYXJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcmVxdWVzdCByZWZlcmVuY2Ugc3BhY2VcbiAgICAgICAgc2Vzc2lvbi5yZXF1ZXN0UmVmZXJlbmNlU3BhY2Uoc3BhY2VUeXBlKS50aGVuKChyZWZlcmVuY2VTcGFjZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fcmVmZXJlbmNlU3BhY2UgPSByZWZlcmVuY2VTcGFjZTtcblxuICAgICAgICAgICAgLy8gb2xkIHJlcXVlc3RBbmltYXRpb25GcmFtZSB3aWxsIG5ldmVyIGJlIHRyaWdnZXJlZCxcbiAgICAgICAgICAgIC8vIHNvIHF1ZXVlIHVwIG5ldyB0aWNrXG4gICAgICAgICAgICB0aGlzLmFwcC50aWNrKCk7XG5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3N0YXJ0Jyk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHNlc3Npb24uZW5kKCk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZWFyIC0gTmVhciBwbGFuZSBkaXN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFyIC0gRmFyIHBsYW5lIGRpc3RhbmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldENsaXBQbGFuZXMobmVhciwgZmFyKSB7XG4gICAgICAgIGlmICh0aGlzLl9kZXB0aE5lYXIgPT09IG5lYXIgJiYgdGhpcy5fZGVwdGhGYXIgPT09IGZhcilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9kZXB0aE5lYXIgPSBuZWFyO1xuICAgICAgICB0aGlzLl9kZXB0aEZhciA9IGZhcjtcblxuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gaWYgc2Vzc2lvbiBpcyBhdmFpbGFibGUsXG4gICAgICAgIC8vIHF1ZXVlIHVwIHJlbmRlciBzdGF0ZSB1cGRhdGVcbiAgICAgICAgdGhpcy5fc2Vzc2lvbi51cGRhdGVSZW5kZXJTdGF0ZSh7XG4gICAgICAgICAgICBkZXB0aE5lYXI6IHRoaXMuX2RlcHRoTmVhcixcbiAgICAgICAgICAgIGRlcHRoRmFyOiB0aGlzLl9kZXB0aEZhclxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHVwZGF0ZSB3YXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gY2FudmFzIHJlc29sdXRpb24gc2hvdWxkIGJlIHNldCBvbiBmaXJzdCBmcmFtZSBhdmFpbGFiaWxpdHkgb3IgcmVzb2x1dGlvbiBjaGFuZ2VzXG4gICAgICAgIGNvbnN0IHdpZHRoID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXIuZnJhbWVidWZmZXJXaWR0aDtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXIuZnJhbWVidWZmZXJIZWlnaHQ7XG4gICAgICAgIGlmICh0aGlzLl93aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5faGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5zZXRSZXNvbHV0aW9uKHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcG9zZSA9IGZyYW1lLmdldFZpZXdlclBvc2UodGhpcy5fcmVmZXJlbmNlU3BhY2UpO1xuXG4gICAgICAgIGlmICghcG9zZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGxlbmd0aE5ldyA9IHBvc2Uudmlld3MubGVuZ3RoO1xuXG4gICAgICAgIGlmIChsZW5ndGhOZXcgPiB0aGlzLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gYWRkIG5ldyB2aWV3cyBpbnRvIGxpc3RcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IChsZW5ndGhOZXcgLSB0aGlzLnZpZXdzLmxlbmd0aCk7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCB2aWV3ID0gdGhpcy52aWV3c1Bvb2wucG9wKCk7XG4gICAgICAgICAgICAgICAgaWYgKCF2aWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3cG9ydDogbmV3IFZlYzQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2pNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3TWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld09mZk1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdJbnZNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3SW52T2ZmTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvalZpZXdPZmZNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3TWF0MzogbmV3IE1hdDMoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBuZXcgRmxvYXQzMkFycmF5KDMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IG5ldyBRdWF0KClcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdzLnB1c2godmlldyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobGVuZ3RoTmV3IDw9IHRoaXMudmlld3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgdmlld3MgZnJvbSBsaXN0IGludG8gcG9vbFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAodGhpcy52aWV3cy5sZW5ndGggLSBsZW5ndGhOZXcpOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdzUG9vbC5wdXNoKHRoaXMudmlld3MucG9wKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgcG9zaXRpb25cbiAgICAgICAgY29uc3QgcG9zZVBvc2l0aW9uID0gcG9zZS50cmFuc2Zvcm0ucG9zaXRpb247XG4gICAgICAgIGNvbnN0IHBvc2VPcmllbnRhdGlvbiA9IHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uO1xuICAgICAgICB0aGlzLl9sb2NhbFBvc2l0aW9uLnNldChwb3NlUG9zaXRpb24ueCwgcG9zZVBvc2l0aW9uLnksIHBvc2VQb3NpdGlvbi56KTtcbiAgICAgICAgdGhpcy5fbG9jYWxSb3RhdGlvbi5zZXQocG9zZU9yaWVudGF0aW9uLngsIHBvc2VPcmllbnRhdGlvbi55LCBwb3NlT3JpZW50YXRpb24ueiwgcG9zZU9yaWVudGF0aW9uLncpO1xuXG4gICAgICAgIGNvbnN0IGxheWVyID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXI7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb3NlLnZpZXdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAvLyBmb3IgZWFjaCB2aWV3LCBjYWxjdWxhdGUgbWF0cmljZXNcbiAgICAgICAgICAgIGNvbnN0IHZpZXdSYXcgPSBwb3NlLnZpZXdzW2ldO1xuICAgICAgICAgICAgY29uc3QgdmlldyA9IHRoaXMudmlld3NbaV07XG4gICAgICAgICAgICBjb25zdCB2aWV3cG9ydCA9IGxheWVyLmdldFZpZXdwb3J0KHZpZXdSYXcpO1xuXG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LnggPSB2aWV3cG9ydC54O1xuICAgICAgICAgICAgdmlldy52aWV3cG9ydC55ID0gdmlld3BvcnQueTtcbiAgICAgICAgICAgIHZpZXcudmlld3BvcnQueiA9IHZpZXdwb3J0LndpZHRoO1xuICAgICAgICAgICAgdmlldy52aWV3cG9ydC53ID0gdmlld3BvcnQuaGVpZ2h0O1xuXG4gICAgICAgICAgICB2aWV3LnByb2pNYXQuc2V0KHZpZXdSYXcucHJvamVjdGlvbk1hdHJpeCk7XG4gICAgICAgICAgICB2aWV3LnZpZXdNYXQuc2V0KHZpZXdSYXcudHJhbnNmb3JtLmludmVyc2UubWF0cml4KTtcbiAgICAgICAgICAgIHZpZXcudmlld0ludk1hdC5zZXQodmlld1Jhdy50cmFuc2Zvcm0ubWF0cml4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGUgY2FtZXJhIGJhc2VkIG9uIGNhbGN1bGF0ZWQgdmVjdG9yc1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLl9ub2RlLnNldExvY2FsUG9zaXRpb24odGhpcy5fbG9jYWxQb3NpdGlvbik7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEuX25vZGUuc2V0TG9jYWxSb3RhdGlvbih0aGlzLl9sb2NhbFJvdGF0aW9uKTtcblxuICAgICAgICB0aGlzLmlucHV0LnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFhSVFlQRV9BUikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaGl0VGVzdC5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5oaXRUZXN0LnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmxpZ2h0RXN0aW1hdGlvbi5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodEVzdGltYXRpb24udXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGVwdGhTZW5zaW5nLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZy51cGRhdGUoZnJhbWUsIHBvc2UgJiYgcG9zZS52aWV3c1swXSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmltYWdlVHJhY2tpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuaW1hZ2VUcmFja2luZy51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wbGFuZURldGVjdGlvbi5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbi51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCd1cGRhdGUnLCBmcmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBYUiBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3VwcG9ydGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VwcG9ydGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgWFIgc2Vzc2lvbiBpcyBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGFjdGl2ZSgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHR5cGUgb2YgY3VycmVudGx5IHJ1bm5pbmcgWFIgc2Vzc2lvbiBvciBudWxsIGlmIG5vIHNlc3Npb24gaXMgcnVubmluZy4gQ2FuIGJlIGFueSBvZlxuICAgICAqIFhSVFlQRV8qLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHJlZmVyZW5jZSBzcGFjZSB0eXBlIG9mIGN1cnJlbnRseSBydW5uaW5nIFhSIHNlc3Npb24gb3IgbnVsbCBpZiBubyBzZXNzaW9uIGlzXG4gICAgICogcnVubmluZy4gQ2FuIGJlIGFueSBvZiBYUlNQQUNFXyouXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHNwYWNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwYWNlVHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gWFJTZXNzaW9uIG9mIFdlYlhSLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdHxudWxsfVxuICAgICAqL1xuICAgIGdldCBzZXNzaW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBY3RpdmUgY2FtZXJhIGZvciB3aGljaCBYUiBzZXNzaW9uIGlzIHJ1bm5pbmcgb3IgbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbnRpdHl8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgY2FtZXJhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhID8gdGhpcy5fY2FtZXJhLmVudGl0eSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5kaWNhdGVzIHdoZXRoZXIgV2ViWFIgY29udGVudCBpcyBjdXJyZW50bHkgdmlzaWJsZSB0byB0aGUgdXNlciwgYW5kIGlmIGl0IGlzLCB3aGV0aGVyIGl0J3NcbiAgICAgKiB0aGUgcHJpbWFyeSBmb2N1cy4gQ2FuIGJlICdoaWRkZW4nLCAndmlzaWJsZScgb3IgJ3Zpc2libGUtYmx1cnJlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgdmlzaWJpbGl0eVN0YXRlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYck1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJYck1hbmFnZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJuYXZpZ2F0b3IiLCJ4ciIsIl9hdmFpbGFibGUiLCJfdHlwZSIsIl9zcGFjZVR5cGUiLCJfc2Vzc2lvbiIsIl9iYXNlTGF5ZXIiLCJfcmVmZXJlbmNlU3BhY2UiLCJkZXB0aFNlbnNpbmciLCJkb21PdmVybGF5IiwiaGl0VGVzdCIsImltYWdlVHJhY2tpbmciLCJwbGFuZURldGVjdGlvbiIsImlucHV0IiwibGlnaHRFc3RpbWF0aW9uIiwiX2NhbWVyYSIsInZpZXdzIiwidmlld3NQb29sIiwiX2xvY2FsUG9zaXRpb24iLCJWZWMzIiwiX2xvY2FsUm90YXRpb24iLCJRdWF0IiwiX2RlcHRoTmVhciIsIl9kZXB0aEZhciIsIl93aWR0aCIsIl9oZWlnaHQiLCJYUlRZUEVfSU5MSU5FIiwiWFJUWVBFX1ZSIiwiWFJUWVBFX0FSIiwiWHJEZXB0aFNlbnNpbmciLCJYckRvbU92ZXJsYXkiLCJYckhpdFRlc3QiLCJYckltYWdlVHJhY2tpbmciLCJYclBsYW5lRGV0ZWN0aW9uIiwiWHJJbnB1dCIsIlhyTGlnaHRFc3RpbWF0aW9uIiwiYWRkRXZlbnRMaXN0ZW5lciIsIl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjayIsImRlc3Ryb3kiLCJzdGFydCIsImNhbWVyYSIsInR5cGUiLCJzcGFjZVR5cGUiLCJvcHRpb25zIiwiY2FsbGJhY2siLCJFcnJvciIsIl9zZXRDbGlwUGxhbmVzIiwibmVhckNsaXAiLCJmYXJDbGlwIiwib3B0cyIsInJlcXVpcmVkRmVhdHVyZXMiLCJvcHRpb25hbEZlYXR1cmVzIiwicHVzaCIsInN1cHBvcnRlZCIsInJvb3QiLCJ1c2FnZVByZWZlcmVuY2UiLCJYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSIsImRhdGFGb3JtYXRQcmVmZXJlbmNlIiwiWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCIsImluZCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1bnNoaWZ0IiwiY29uY2F0IiwiaW1hZ2VzIiwibGVuZ3RoIiwicHJlcGFyZUltYWdlcyIsImVyciIsInRyYWNrZWRJbWFnZXMiLCJmaXJlIiwiX29uU3RhcnRPcHRpb25zUmVhZHkiLCJyZXF1ZXN0U2Vzc2lvbiIsInRoZW4iLCJzZXNzaW9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiY2F0Y2giLCJleCIsImVuZCIsIm9uY2UiLCJpc0F2YWlsYWJsZSIsImtleSIsIl9zZXNzaW9uU3VwcG9ydENoZWNrIiwiaXNTZXNzaW9uU3VwcG9ydGVkIiwiYXZhaWxhYmxlIiwiZmFpbGVkIiwib25WaXNpYmlsaXR5Q2hhbmdlIiwidmlzaWJpbGl0eVN0YXRlIiwib25DbGlwUGxhbmVzQ2hhbmdlIiwib25FbmQiLCJvZmYiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwidGljayIsIm9uIiwiWFJXZWJHTExheWVyIiwiZ3JhcGhpY3NEZXZpY2UiLCJnbCIsImFscGhhIiwiZGVwdGgiLCJzdGVuY2lsIiwidXBkYXRlUmVuZGVyU3RhdGUiLCJiYXNlTGF5ZXIiLCJkZXB0aE5lYXIiLCJkZXB0aEZhciIsInJlcXVlc3RSZWZlcmVuY2VTcGFjZSIsInJlZmVyZW5jZVNwYWNlIiwibmVhciIsImZhciIsInVwZGF0ZSIsImZyYW1lIiwid2lkdGgiLCJyZW5kZXJTdGF0ZSIsImZyYW1lYnVmZmVyV2lkdGgiLCJoZWlnaHQiLCJmcmFtZWJ1ZmZlckhlaWdodCIsInNldFJlc29sdXRpb24iLCJwb3NlIiwiZ2V0Vmlld2VyUG9zZSIsImxlbmd0aE5ldyIsImkiLCJ2aWV3IiwicG9wIiwidmlld3BvcnQiLCJWZWM0IiwicHJvak1hdCIsIk1hdDQiLCJ2aWV3TWF0Iiwidmlld09mZk1hdCIsInZpZXdJbnZNYXQiLCJ2aWV3SW52T2ZmTWF0IiwicHJvalZpZXdPZmZNYXQiLCJ2aWV3TWF0MyIsIk1hdDMiLCJwb3NpdGlvbiIsIkZsb2F0MzJBcnJheSIsInJvdGF0aW9uIiwicG9zZVBvc2l0aW9uIiwidHJhbnNmb3JtIiwicG9zZU9yaWVudGF0aW9uIiwib3JpZW50YXRpb24iLCJzZXQiLCJ4IiwieSIsInoiLCJ3IiwibGF5ZXIiLCJ2aWV3UmF3IiwiZ2V0Vmlld3BvcnQiLCJwcm9qZWN0aW9uTWF0cml4IiwiaW52ZXJzZSIsIm1hdHJpeCIsIl9ub2RlIiwic2V0TG9jYWxQb3NpdGlvbiIsInNldExvY2FsUm90YXRpb24iLCJhY3RpdmUiLCJlbnRpdHkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWtDQSxNQUFNQSxTQUFOLFNBQXdCQyxZQUF4QixDQUFxQztFQW9LakNDLFdBQVcsQ0FBQ0MsR0FBRCxFQUFNO0FBQ2IsSUFBQSxLQUFBLEVBQUEsQ0FBQTtBQURhLElBQUEsSUFBQSxDQS9KakJBLEdBK0ppQixHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUF6SmpCQyxDQUFBQSxVQXlKaUIsR0F6SkpDLFFBQVEsQ0FBQ0MsT0FBVCxJQUFvQixDQUFDLENBQUNDLFNBQVMsQ0FBQ0MsRUF5SjVCLENBQUE7SUFBQSxJQW5KakJDLENBQUFBLFVBbUppQixHQW5KSixFQW1KSSxDQUFBO0lBQUEsSUE3SWpCQyxDQUFBQSxLQTZJaUIsR0E3SVQsSUE2SVMsQ0FBQTtJQUFBLElBdklqQkMsQ0FBQUEsVUF1SWlCLEdBdklKLElBdUlJLENBQUE7SUFBQSxJQWpJakJDLENBQUFBLFFBaUlpQixHQWpJTixJQWlJTSxDQUFBO0lBQUEsSUEzSGpCQyxDQUFBQSxVQTJIaUIsR0EzSEosSUEySEksQ0FBQTtJQUFBLElBckhqQkMsQ0FBQUEsZUFxSGlCLEdBckhDLElBcUhELENBQUE7QUFBQSxJQUFBLElBQUEsQ0E3R2pCQyxZQTZHaUIsR0FBQSxLQUFBLENBQUEsQ0FB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
