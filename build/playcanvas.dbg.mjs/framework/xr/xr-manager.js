/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tYW5hZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSBcIi4uLy4uL2NvcmUvZGVidWcuanNcIjtcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgWFJUWVBFX0lOTElORSwgWFJUWVBFX1ZSLCBYUlRZUEVfQVIsIFhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVLCBYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWHJEZXB0aFNlbnNpbmcgfSBmcm9tICcuL3hyLWRlcHRoLXNlbnNpbmcuanMnO1xuaW1wb3J0IHsgWHJEb21PdmVybGF5IH0gZnJvbSAnLi94ci1kb20tb3ZlcmxheS5qcyc7XG5pbXBvcnQgeyBYckhpdFRlc3QgfSBmcm9tICcuL3hyLWhpdC10ZXN0LmpzJztcbmltcG9ydCB7IFhySW1hZ2VUcmFja2luZyB9IGZyb20gJy4veHItaW1hZ2UtdHJhY2tpbmcuanMnO1xuaW1wb3J0IHsgWHJJbnB1dCB9IGZyb20gJy4veHItaW5wdXQuanMnO1xuaW1wb3J0IHsgWHJMaWdodEVzdGltYXRpb24gfSBmcm9tICcuL3hyLWxpZ2h0LWVzdGltYXRpb24uanMnO1xuaW1wb3J0IHsgWHJQbGFuZURldGVjdGlvbiB9IGZyb20gJy4veHItcGxhbmUtZGV0ZWN0aW9uLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYck1hbmFnZXIjZW5kWHJ9IGFuZCB7QGxpbmsgWHJNYW5hZ2VyI3N0YXJ0WHJ9LlxuICpcbiAqIEBjYWxsYmFjayBYckVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBvciBudWxsIGlmIG9wZXJhdGlvbiB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuXG4vKipcbiAqIE1hbmFnZSBhbmQgdXBkYXRlIFhSIHNlc3Npb24gYW5kIGl0cyBzdGF0ZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBYck1hbmFnZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXBwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIW5hdmlnYXRvci54cjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBib29sZWFuPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hdmFpbGFibGUgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSU2Vzc2lvbnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSV2ViR0xMYXllcnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Jhc2VMYXllciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJSZWZlcmVuY2VTcGFjZXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZmVyZW5jZVNwYWNlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBkZXB0aCBzZW5zaW5nIGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRlcHRoU2Vuc2luZ31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVwdGhTZW5zaW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIERPTSBvdmVybGF5IGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckRvbU92ZXJsYXl9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRvbU92ZXJsYXk7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyB0aGUgYWJpbGl0eSB0byBwZXJmb3JtIGhpdCB0ZXN0cyBvbiB0aGUgcmVwcmVzZW50YXRpb24gb2YgcmVhbCB3b3JsZCBnZW9tZXRyeVxuICAgICAqIG9mIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3R9XG4gICAgICovXG4gICAgaGl0VGVzdDtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBpbWFnZSB0cmFja2luZyBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJJbWFnZVRyYWNraW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbWFnZVRyYWNraW5nO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIHBsYW5lIGRldGVjdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJQbGFuZURldGVjdGlvbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcGxhbmVEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gSW5wdXQgU291cmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0fVxuICAgICAqL1xuICAgIGlucHV0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGxpZ2h0IGVzdGltYXRpb24gY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyTGlnaHRFc3RpbWF0aW9ufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsaWdodEVzdGltYXRpb247XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FtZXJhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3MgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3NQb29sID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aE5lYXIgPSAwLjE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoRmFyID0gMTAwMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfd2lkdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oZWlnaHQgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBtYWluIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmFwcCA9IGFwcDtcblxuICAgICAgICAvLyBBZGQgYWxsIHRoZSBzdXBwb3J0ZWQgc2Vzc2lvbiB0eXBlc1xuICAgICAgICB0aGlzLl9hdmFpbGFibGVbWFJUWVBFX0lOTElORV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9WUl0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlW1hSVFlQRV9BUl0gPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG5ldyBYckRlcHRoU2Vuc2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5kb21PdmVybGF5ID0gbmV3IFhyRG9tT3ZlcmxheSh0aGlzKTtcbiAgICAgICAgdGhpcy5oaXRUZXN0ID0gbmV3IFhySGl0VGVzdCh0aGlzKTtcbiAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nID0gbmV3IFhySW1hZ2VUcmFja2luZyh0aGlzKTtcbiAgICAgICAgdGhpcy5wbGFuZURldGVjdGlvbiA9IG5ldyBYclBsYW5lRGV0ZWN0aW9uKHRoaXMpO1xuICAgICAgICB0aGlzLmlucHV0ID0gbmV3IFhySW5wdXQodGhpcyk7XG4gICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uID0gbmV3IFhyTGlnaHRFc3RpbWF0aW9uKHRoaXMpO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gMS4gSE1EIGNsYXNzIHdpdGggaXRzIHBhcmFtc1xuICAgICAgICAvLyAyLiBTcGFjZSBjbGFzc1xuICAgICAgICAvLyAzLiBDb250cm9sbGVycyBjbGFzc1xuXG4gICAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci54ci5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5fZGV2aWNlQXZhaWxhYmlsaXR5Q2hlY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgc2Vzc2lvbiB0eXBlIHRoYXQgaGFzIGNoYW5nZWQgYXZhaWxhYmlsaXR5LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZScsIGZ1bmN0aW9uICh0eXBlLCBhdmFpbGFibGUpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ1wiJyArIHR5cGUgKyAnXCIgWFIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYXZhaWxhYmlsaXR5IG9mIHNwZWNpZmljIFhSIHR5cGUgaXMgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjYXZhaWxhYmxlOlt0eXBlXVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYXZhaWxhYmxlIC0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIG5vdyBhdmFpbGFibGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ2F2YWlsYWJsZTonICsgcGMuWFJUWVBFX1ZSLCBmdW5jdGlvbiAoYXZhaWxhYmxlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKCdJbW1lcnNpdmUgVlIgc2Vzc2lvbiBpcyBub3cgJyArIChhdmFpbGFibGUgPyAnYXZhaWxhYmxlJyA6ICd1bmF2YWlsYWJsZScpKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gWFIgc2Vzc2lvbiBpcyBzdGFydGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNzdGFydFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdzdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgc3RhcnRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIGVuZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNlbmRcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBYUiBzZXNzaW9uIGhhcyBlbmRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHVwZGF0ZWQsIHByb3ZpZGluZyByZWxldmFudCBYUkZyYW1lIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjdXBkYXRlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGZyYW1lIC0gW1hSRnJhbWVdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9YUkZyYW1lKVxuICAgICAqIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIGZvciBpbnRlcmZhY2luZyBkaXJlY3RseSB3aXRoIFdlYlhSIEFQSXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ3VwZGF0ZScsIGZ1bmN0aW9uIChmcmFtZSkge1xuICAgICAqXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZmFpbGVkIHRvIHN0YXJ0IG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJNYW5hZ2VyI2Vycm9yXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSBFcnJvciBvYmplY3QgcmVsYXRlZCB0byBmYWlsdXJlIG9mIHNlc3Npb24gc3RhcnQgb3IgY2hlY2sgb2Ygc2Vzc2lvblxuICAgICAqIHR5cGUgc3VwcG9ydC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignZXJyb3InLCBmdW5jdGlvbiAoZXgpIHtcbiAgICAgKiAgICAgLy8gWFIgc2Vzc2lvbiBoYXMgZmFpbGVkIHRvIHN0YXJ0LCBvciBmYWlsZWQgdG8gY2hlY2sgZm9yIHNlc3Npb24gdHlwZSBzdXBwb3J0XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgWHJNYW5hZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIHN0YXJ0IFhSIHNlc3Npb24gZm9yIHByb3ZpZGVkIHtAbGluayBDYW1lcmFDb21wb25lbnR9IGFuZCBvcHRpb25hbGx5IGZpcmVzXG4gICAgICogY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGNyZWF0ZWQgb3IgZmFpbGVkIHRvIGNyZWF0ZS4gSW50ZWdyYXRlZCBYUiBBUElzIG5lZWQgdG8gYmUgZW5hYmxlZFxuICAgICAqIGJ5IHByb3ZpZGluZyByZWxldmFudCBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gSXQgd2lsbCBiZVxuICAgICAqIHVzZWQgdG8gcmVuZGVyIFhSIHNlc3Npb24gYW5kIG1hbmlwdWxhdGVkIGJhc2VkIG9uIHBvc2UgdHJhY2tpbmcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBhbHdheXMgc3VwcG9ydGVkIHNwYWNlIHdpdGggc29tZSBiYXNpYyB0cmFja2luZ1xuICAgICAqIGNhcGFiaWxpdGllcy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMfTogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGVcbiAgICAgKiB2aWV3ZXIgYXQgdGhlIHRpbWUgb2YgY3JlYXRpb24uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3IgYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTEZMT09SfTogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW5cbiAgICAgKiBhdCB0aGUgZmxvb3IgaW4gYSBzYWZlIHBvc2l0aW9uIGZvciB0aGUgdXNlciB0byBzdGFuZC4gVGhlIHkgYXhpcyBlcXVhbHMgMCBhdCBmbG9vciBsZXZlbC5cbiAgICAgKiBGbG9vciBsZXZlbCB2YWx1ZSBtaWdodCBiZSBlc3RpbWF0ZWQgYnkgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3JcbiAgICAgKiBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3Qgd2l0aCBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIFhSIHNlc3Npb24gaW5pdGlhbGl6YXRpb24uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMub3B0aW9uYWxGZWF0dXJlc10gLSBPcHRpb25hbCBmZWF0dXJlcyBmb3IgWFJTZXNzaW9uIHN0YXJ0LiBJdCBpc1xuICAgICAqIHVzZWQgZm9yIGdldHRpbmcgYWNjZXNzIHRvIGFkZGl0aW9uYWwgV2ViWFIgc3BlYyBleHRlbnNpb25zLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaW1hZ2VUcmFja2luZ10gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZVxuICAgICAqIHtAbGluayBYckltYWdlVHJhY2tpbmd9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGxhbmVEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJQbGFuZURldGVjdGlvbn0uXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IFtvcHRpb25zLmNhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb25cbiAgICAgKiBpcyBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWYgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgWFJcbiAgICAgKiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5kZXB0aFNlbnNpbmddIC0gT3B0aW9uYWwgb2JqZWN0IHdpdGggZGVwdGggc2Vuc2luZyBwYXJhbWV0ZXJzIHRvXG4gICAgICogYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nfS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZV0gLSBPcHRpb25hbCB1c2FnZSBwcmVmZXJlbmNlIGZvciBkZXB0aFxuICAgICAqIHNlbnNpbmcsIGNhbiBiZSAnY3B1LW9wdGltaXplZCcgb3IgJ2dwdS1vcHRpbWl6ZWQnIChYUkRFUFRIU0VOU0lOR1VTQUdFXyopLCBkZWZhdWx0cyB0b1xuICAgICAqICdjcHUtb3B0aW1pemVkJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nXG4gICAgICogc3lzdGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2VdIC0gT3B0aW9uYWwgZGF0YSBmb3JtYXRcbiAgICAgKiBwcmVmZXJlbmNlIGZvciBkZXB0aCBzZW5zaW5nLCBjYW4gYmUgJ2x1bWluYW5jZS1hbHBoYScgb3IgJ2Zsb2F0MzInXG4gICAgICogKFhSREVQVEhTRU5TSU5HRk9STUFUXyopLCBkZWZhdWx0cyB0byAnbHVtaW5hbmNlLWFscGhhJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsXG4gICAgICogYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmcgc3lzdGVtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX1ZSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IpO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX0FSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IsIHtcbiAgICAgKiAgICAgICAgIGRlcHRoU2Vuc2luZzogeyB9XG4gICAgICogICAgIH0pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0KGNhbWVyYSwgdHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCBjYWxsYmFjayA9IG9wdGlvbnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JylcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcblxuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZVt0eXBlXSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIGlzIG5vdCBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIHNlc3Npb24gaXMgYWxyZWFkeSBzdGFydGVkJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gdGhpcztcbiAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IHNwYWNlVHlwZTtcblxuICAgICAgICB0aGlzLl9zZXRDbGlwUGxhbmVzKGNhbWVyYS5uZWFyQ2xpcCwgY2FtZXJhLmZhckNsaXApO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gbWFrZVhSQ29tcGF0aWJsZVxuICAgICAgICAvLyBzY2VuYXJpbyB0byB0ZXN0OlxuICAgICAgICAvLyAxLiBhcHAgaXMgcnVubmluZyBvbiBpbnRlZ3JhdGVkIEdQVVxuICAgICAgICAvLyAyLiBYUiBkZXZpY2UgaXMgY29ubmVjdGVkLCB0byBhbm90aGVyIEdQVVxuICAgICAgICAvLyAzLiBwcm9iYWJseSBpbW1lcnNpdmUtdnIgd2lsbCBmYWlsIHRvIGJlIGNyZWF0ZWRcbiAgICAgICAgLy8gNC4gY2FsbCBtYWtlWFJDb21wYXRpYmxlLCB2ZXJ5IGxpa2VseSB3aWxsIGxlYWQgdG8gY29udGV4dCBsb3NzXG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXM6IFtzcGFjZVR5cGVdLFxuICAgICAgICAgICAgb3B0aW9uYWxGZWF0dXJlczogW11cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gWFJUWVBFX0FSKSB7XG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnbGlnaHQtZXN0aW1hdGlvbicpO1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hpdC10ZXN0Jyk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW1hZ2VUcmFja2luZyAmJiB0aGlzLmltYWdlVHJhY2tpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnaW1hZ2UtdHJhY2tpbmcnKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnBsYW5lRGV0ZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgncGxhbmUtZGV0ZWN0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRvbU92ZXJsYXkuc3VwcG9ydGVkICYmIHRoaXMuZG9tT3ZlcmxheS5yb290KSB7XG4gICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2RvbS1vdmVybGF5Jyk7XG4gICAgICAgICAgICAgICAgb3B0cy5kb21PdmVybGF5ID0geyByb290OiB0aGlzLmRvbU92ZXJsYXkucm9vdCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoU2Vuc2luZyAmJiB0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnZGVwdGgtc2Vuc2luZycpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXNhZ2VQcmVmZXJlbmNlID0gW1hSREVQVEhTRU5TSU5HVVNBR0VfQ1BVXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRm9ybWF0UHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4XTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gdXNhZ2VQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHVzYWdlUHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2VQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZGF0YUZvcm1hdFByZWZlcmVuY2UuaW5kZXhPZihvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSBkYXRhRm9ybWF0UHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2UudW5zaGlmdChvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb3B0cy5kZXB0aFNlbnNpbmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZTogdXNhZ2VQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhRm9ybWF0UHJlZmVyZW5jZTogZGF0YUZvcm1hdFByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFhSVFlQRV9WUikge1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hhbmQtdHJhY2tpbmcnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcylcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcyA9IG9wdHMub3B0aW9uYWxGZWF0dXJlcy5jb25jYXQob3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzKTtcblxuICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZCAmJiB0aGlzLmltYWdlVHJhY2tpbmcuaW1hZ2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnByZXBhcmVJbWFnZXMoKGVyciwgdHJhY2tlZEltYWdlcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0cmFja2VkSW1hZ2VzICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLnRyYWNrZWRJbWFnZXMgPSB0cmFja2VkSW1hZ2VzO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS5cbiAgICAgKiBAcGFyYW0geyp9IG9wdGlvbnMgLSBTZXNzaW9uIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRXJyb3IgY2FsbGJhY2suXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG5hdmlnYXRvci54ci5yZXF1ZXN0U2Vzc2lvbih0eXBlLCBvcHRpb25zKS50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gZW5kIFhSIHNlc3Npb24gYW5kIG9wdGlvbmFsbHkgZmlyZXMgY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGVuZGVkIG9yIGZhaWxlZCB0b1xuICAgICAqIGVuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpc1xuICAgICAqIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIGlmIChldnQua2V5ID09PSBwYy5LRVlfRVNDQVBFICYmIGFwcC54ci5hY3RpdmUpIHtcbiAgICAgKiAgICAgICAgIGFwcC54ci5lbmQoKTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZChjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBpbml0aWFsaXplZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYWxsYmFjaykgdGhpcy5vbmNlKCdlbmQnLCBjYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbi5lbmQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzcGVjaWZpYyB0eXBlIG9mIHNlc3Npb24gaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGFwcC54ci5pc0F2YWlsYWJsZShwYy5YUlRZUEVfVlIpKSB7XG4gICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAqIH1cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIGF2YWlsYWJsZS5cbiAgICAgKi9cbiAgICBpc0F2YWlsYWJsZSh0eXBlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdmFpbGFibGVbdHlwZV07XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25TdXBwb3J0Q2hlY2soa2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb25TdXBwb3J0Q2hlY2sodHlwZSkge1xuICAgICAgICBuYXZpZ2F0b3IueHIuaXNTZXNzaW9uU3VwcG9ydGVkKHR5cGUpLnRoZW4oKGF2YWlsYWJsZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F2YWlsYWJsZVt0eXBlXSA9PT0gYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlW3R5cGVdID0gYXZhaWxhYmxlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGUnLCB0eXBlLCBhdmFpbGFibGUpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGU6JyArIHR5cGUsIGF2YWlsYWJsZSk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUlNlc3Npb259IHNlc3Npb24gLSBYUiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBTcGFjZSB0eXBlIHRvIHJlcXVlc3QgZm9yIHRoZSBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdG8gY2FsbCB3aGVuIHNlc3Npb24gaXMgc3RhcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCBmYWlsZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblxuICAgICAgICBjb25zdCBvblZpc2liaWxpdHlDaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3Zpc2liaWxpdHk6Y2hhbmdlJywgc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9uQ2xpcFBsYW5lc0NoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldENsaXBQbGFuZXModGhpcy5fY2FtZXJhLm5lYXJDbGlwLCB0aGlzLl9jYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gY2xlYW4gdXAgb25jZSBzZXNzaW9uIGlzIGVuZGVkXG4gICAgICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5vZmYoJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLm9mZignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XG4gICAgICAgICAgICBzZXNzaW9uLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvblZpc2liaWxpdHlDaGFuZ2UpO1xuXG4gICAgICAgICAgICBpZiAoIWZhaWxlZCkgdGhpcy5maXJlKCdlbmQnKTtcblxuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnZpZXdzID0gW107XG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IDA7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSAwO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZCcsIG9uRW5kKTtcbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25WaXNpYmlsaXR5Q2hhbmdlKTtcblxuICAgICAgICB0aGlzLl9jYW1lcmEub24oJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5vbignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuXG4gICAgICAgIC8vIEEgZnJhbWVidWZmZXJTY2FsZUZhY3RvciBzY2FsZSBvZiAxIGlzIHRoZSBmdWxsIHJlc29sdXRpb24gb2YgdGhlIGRpc3BsYXlcbiAgICAgICAgLy8gc28gd2UgbmVlZCB0byBjYWxjdWxhdGUgdGhpcyBiYXNlZCBvbiBkZXZpY2VQaXhlbFJhdGlvIG9mIHRoZSBkaXNsYXkgYW5kIHdoYXRcbiAgICAgICAgLy8gd2UndmUgc2V0IHRoaXMgaW4gdGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAgICBEZWJ1Zy5hc3NlcnQod2luZG93LCAnd2luZG93IGlzIG5lZWRlZCB0byBzY2FsZSB0aGUgWFIgZnJhbWVidWZmZXIuIEFyZSB5b3UgcnVubmluZyBYUiBoZWFkbGVzcz8nKTtcbiAgICAgICAgY29uc3QgZnJhbWVidWZmZXJTY2FsZUZhY3RvciA9IHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLm1heFBpeGVsUmF0aW8gLyB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcblxuICAgICAgICB0aGlzLl9iYXNlTGF5ZXIgPSBuZXcgWFJXZWJHTExheWVyKHNlc3Npb24sIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLmdsLCB7XG4gICAgICAgICAgICBhbHBoYTogdHJ1ZSxcbiAgICAgICAgICAgIGRlcHRoOiB0cnVlLFxuICAgICAgICAgICAgc3RlbmNpbDogdHJ1ZSxcbiAgICAgICAgICAgIGZyYW1lYnVmZmVyU2NhbGVGYWN0b3I6IGZyYW1lYnVmZmVyU2NhbGVGYWN0b3JcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2Vzc2lvbi51cGRhdGVSZW5kZXJTdGF0ZSh7XG4gICAgICAgICAgICBiYXNlTGF5ZXI6IHRoaXMuX2Jhc2VMYXllcixcbiAgICAgICAgICAgIGRlcHRoTmVhcjogdGhpcy5fZGVwdGhOZWFyLFxuICAgICAgICAgICAgZGVwdGhGYXI6IHRoaXMuX2RlcHRoRmFyXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJlcXVlc3QgcmVmZXJlbmNlIHNwYWNlXG4gICAgICAgIHNlc3Npb24ucmVxdWVzdFJlZmVyZW5jZVNwYWNlKHNwYWNlVHlwZSkudGhlbigocmVmZXJlbmNlU3BhY2UpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3JlZmVyZW5jZVNwYWNlID0gcmVmZXJlbmNlU3BhY2U7XG5cbiAgICAgICAgICAgIC8vIG9sZCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgd2lsbCBuZXZlciBiZSB0cmlnZ2VyZWQsXG4gICAgICAgICAgICAvLyBzbyBxdWV1ZSB1cCBuZXcgdGlja1xuICAgICAgICAgICAgdGhpcy5hcHAudGljaygpO1xuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzdGFydCcpO1xuICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgICBzZXNzaW9uLmVuZCgpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhleCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbmVhciAtIE5lYXIgcGxhbmUgZGlzdGFuY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhciAtIEZhciBwbGFuZSBkaXN0YW5jZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRDbGlwUGxhbmVzKG5lYXIsIGZhcikge1xuICAgICAgICBpZiAodGhpcy5fZGVwdGhOZWFyID09PSBuZWFyICYmIHRoaXMuX2RlcHRoRmFyID09PSBmYXIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZGVwdGhOZWFyID0gbmVhcjtcbiAgICAgICAgdGhpcy5fZGVwdGhGYXIgPSBmYXI7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIGlmIHNlc3Npb24gaXMgYXZhaWxhYmxlLFxuICAgICAgICAvLyBxdWV1ZSB1cCByZW5kZXIgc3RhdGUgdXBkYXRlXG4gICAgICAgIHRoaXMuX3Nlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgZGVwdGhOZWFyOiB0aGlzLl9kZXB0aE5lYXIsXG4gICAgICAgICAgICBkZXB0aEZhcjogdGhpcy5fZGVwdGhGYXJcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB1cGRhdGUgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbikgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIGNhbnZhcyByZXNvbHV0aW9uIHNob3VsZCBiZSBzZXQgb24gZmlyc3QgZnJhbWUgYXZhaWxhYmlsaXR5IG9yIHJlc29sdXRpb24gY2hhbmdlc1xuICAgICAgICBjb25zdCB3aWR0aCA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyV2lkdGg7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVySGVpZ2h0O1xuICAgICAgICBpZiAodGhpcy5fd2lkdGggIT09IHdpZHRoIHx8IHRoaXMuX2hlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uuc2V0UmVzb2x1dGlvbih3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBvc2UgPSBmcmFtZS5nZXRWaWV3ZXJQb3NlKHRoaXMuX3JlZmVyZW5jZVNwYWNlKTtcblxuICAgICAgICBpZiAoIXBvc2UpIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCBsZW5ndGhOZXcgPSBwb3NlLnZpZXdzLmxlbmd0aDtcblxuICAgICAgICBpZiAobGVuZ3RoTmV3ID4gdGhpcy52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIGFkZCBuZXcgdmlld3MgaW50byBsaXN0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSAobGVuZ3RoTmV3IC0gdGhpcy52aWV3cy5sZW5ndGgpOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgdmlldyA9IHRoaXMudmlld3NQb29sLnBvcCgpO1xuICAgICAgICAgICAgICAgIGlmICghdmlldykge1xuICAgICAgICAgICAgICAgICAgICB2aWV3ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmlld3BvcnQ6IG5ldyBWZWM0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld01hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdPZmZNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3SW52TWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld0ludk9mZk1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2pWaWV3T2ZmTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld01hdDM6IG5ldyBNYXQzKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogbmV3IEZsb2F0MzJBcnJheSgzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBuZXcgUXVhdCgpXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy52aWV3cy5wdXNoKHZpZXcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGxlbmd0aE5ldyA8PSB0aGlzLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIHZpZXdzIGZyb20gbGlzdCBpbnRvIHBvb2xcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgKHRoaXMudmlld3MubGVuZ3RoIC0gbGVuZ3RoTmV3KTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3c1Bvb2wucHVzaCh0aGlzLnZpZXdzLnBvcCgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlc2V0IHBvc2l0aW9uXG4gICAgICAgIGNvbnN0IHBvc2VQb3NpdGlvbiA9IHBvc2UudHJhbnNmb3JtLnBvc2l0aW9uO1xuICAgICAgICBjb25zdCBwb3NlT3JpZW50YXRpb24gPSBwb3NlLnRyYW5zZm9ybS5vcmllbnRhdGlvbjtcbiAgICAgICAgdGhpcy5fbG9jYWxQb3NpdGlvbi5zZXQocG9zZVBvc2l0aW9uLngsIHBvc2VQb3NpdGlvbi55LCBwb3NlUG9zaXRpb24ueik7XG4gICAgICAgIHRoaXMuX2xvY2FsUm90YXRpb24uc2V0KHBvc2VPcmllbnRhdGlvbi54LCBwb3NlT3JpZW50YXRpb24ueSwgcG9zZU9yaWVudGF0aW9uLnosIHBvc2VPcmllbnRhdGlvbi53KTtcblxuICAgICAgICBjb25zdCBsYXllciA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9zZS52aWV3cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgLy8gZm9yIGVhY2ggdmlldywgY2FsY3VsYXRlIG1hdHJpY2VzXG4gICAgICAgICAgICBjb25zdCB2aWV3UmF3ID0gcG9zZS52aWV3c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLnZpZXdzW2ldO1xuICAgICAgICAgICAgY29uc3Qgdmlld3BvcnQgPSBsYXllci5nZXRWaWV3cG9ydCh2aWV3UmF3KTtcblxuICAgICAgICAgICAgdmlldy52aWV3cG9ydC54ID0gdmlld3BvcnQueDtcbiAgICAgICAgICAgIHZpZXcudmlld3BvcnQueSA9IHZpZXdwb3J0Lnk7XG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LnogPSB2aWV3cG9ydC53aWR0aDtcbiAgICAgICAgICAgIHZpZXcudmlld3BvcnQudyA9IHZpZXdwb3J0LmhlaWdodDtcblxuICAgICAgICAgICAgdmlldy5wcm9qTWF0LnNldCh2aWV3UmF3LnByb2plY3Rpb25NYXRyaXgpO1xuICAgICAgICAgICAgdmlldy52aWV3TWF0LnNldCh2aWV3UmF3LnRyYW5zZm9ybS5pbnZlcnNlLm1hdHJpeCk7XG4gICAgICAgICAgICB2aWV3LnZpZXdJbnZNYXQuc2V0KHZpZXdSYXcudHJhbnNmb3JtLm1hdHJpeCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcm90YXRlIGNhbWVyYSBiYXNlZCBvbiBjYWxjdWxhdGVkIHZlY3RvcnNcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS5fbm9kZS5zZXRMb2NhbFBvc2l0aW9uKHRoaXMuX2xvY2FsUG9zaXRpb24pO1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLl9ub2RlLnNldExvY2FsUm90YXRpb24odGhpcy5fbG9jYWxSb3RhdGlvbik7XG5cbiAgICAgICAgdGhpcy5pbnB1dC51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBYUlRZUEVfQVIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmhpdFRlc3Quc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuaGl0VGVzdC51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5saWdodEVzdGltYXRpb24uc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRFc3RpbWF0aW9uLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcudXBkYXRlKGZyYW1lLCBwb3NlICYmIHBvc2Uudmlld3NbMF0pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmltYWdlVHJhY2tpbmcudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMucGxhbmVEZXRlY3Rpb24uc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMucGxhbmVEZXRlY3Rpb24udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgndXBkYXRlJywgZnJhbWUpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgWFIgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIFhSIHNlc3Npb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBhY3RpdmUoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX3Nlc3Npb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0eXBlIG9mIGN1cnJlbnRseSBydW5uaW5nIFhSIHNlc3Npb24gb3IgbnVsbCBpZiBubyBzZXNzaW9uIGlzIHJ1bm5pbmcuIENhbiBiZSBhbnkgb2ZcbiAgICAgKiBYUlRZUEVfKi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyByZWZlcmVuY2Ugc3BhY2UgdHlwZSBvZiBjdXJyZW50bHkgcnVubmluZyBYUiBzZXNzaW9uIG9yIG51bGwgaWYgbm8gc2Vzc2lvbiBpc1xuICAgICAqIHJ1bm5pbmcuIENhbiBiZSBhbnkgb2YgWFJTUEFDRV8qLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCBzcGFjZVR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcGFjZVR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIFhSU2Vzc2lvbiBvZiBXZWJYUi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgc2Vzc2lvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nlc3Npb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZlIGNhbWVyYSBmb3Igd2hpY2ggWFIgc2Vzc2lvbiBpcyBydW5uaW5nIG9yIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgY2FtZXJhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FtZXJhID8gdGhpcy5fY2FtZXJhLmVudGl0eSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5kaWNhdGVzIHdoZXRoZXIgV2ViWFIgY29udGVudCBpcyBjdXJyZW50bHkgdmlzaWJsZSB0byB0aGUgdXNlciwgYW5kIGlmIGl0IGlzLCB3aGV0aGVyIGl0J3NcbiAgICAgKiB0aGUgcHJpbWFyeSBmb2N1cy4gQ2FuIGJlICdoaWRkZW4nLCAndmlzaWJsZScgb3IgJ3Zpc2libGUtYmx1cnJlZCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgdmlzaWJpbGl0eVN0YXRlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYck1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJYck1hbmFnZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJuYXZpZ2F0b3IiLCJ4ciIsIl9hdmFpbGFibGUiLCJfdHlwZSIsIl9zcGFjZVR5cGUiLCJfc2Vzc2lvbiIsIl9iYXNlTGF5ZXIiLCJfcmVmZXJlbmNlU3BhY2UiLCJkZXB0aFNlbnNpbmciLCJkb21PdmVybGF5IiwiaGl0VGVzdCIsImltYWdlVHJhY2tpbmciLCJwbGFuZURldGVjdGlvbiIsImlucHV0IiwibGlnaHRFc3RpbWF0aW9uIiwiX2NhbWVyYSIsInZpZXdzIiwidmlld3NQb29sIiwiX2xvY2FsUG9zaXRpb24iLCJWZWMzIiwiX2xvY2FsUm90YXRpb24iLCJRdWF0IiwiX2RlcHRoTmVhciIsIl9kZXB0aEZhciIsIl93aWR0aCIsIl9oZWlnaHQiLCJYUlRZUEVfSU5MSU5FIiwiWFJUWVBFX1ZSIiwiWFJUWVBFX0FSIiwiWHJEZXB0aFNlbnNpbmciLCJYckRvbU92ZXJsYXkiLCJYckhpdFRlc3QiLCJYckltYWdlVHJhY2tpbmciLCJYclBsYW5lRGV0ZWN0aW9uIiwiWHJJbnB1dCIsIlhyTGlnaHRFc3RpbWF0aW9uIiwiYWRkRXZlbnRMaXN0ZW5lciIsIl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjayIsImRlc3Ryb3kiLCJzdGFydCIsImNhbWVyYSIsInR5cGUiLCJzcGFjZVR5cGUiLCJvcHRpb25zIiwiY2FsbGJhY2siLCJFcnJvciIsIl9zZXRDbGlwUGxhbmVzIiwibmVhckNsaXAiLCJmYXJDbGlwIiwib3B0cyIsInJlcXVpcmVkRmVhdHVyZXMiLCJvcHRpb25hbEZlYXR1cmVzIiwicHVzaCIsInN1cHBvcnRlZCIsInJvb3QiLCJ1c2FnZVByZWZlcmVuY2UiLCJYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSIsImRhdGFGb3JtYXRQcmVmZXJlbmNlIiwiWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCIsImluZCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1bnNoaWZ0IiwiY29uY2F0IiwiaW1hZ2VzIiwibGVuZ3RoIiwicHJlcGFyZUltYWdlcyIsImVyciIsInRyYWNrZWRJbWFnZXMiLCJmaXJlIiwiX29uU3RhcnRPcHRpb25zUmVhZHkiLCJyZXF1ZXN0U2Vzc2lvbiIsInRoZW4iLCJzZXNzaW9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiY2F0Y2giLCJleCIsImVuZCIsIm9uY2UiLCJpc0F2YWlsYWJsZSIsImtleSIsIl9zZXNzaW9uU3VwcG9ydENoZWNrIiwiaXNTZXNzaW9uU3VwcG9ydGVkIiwiYXZhaWxhYmxlIiwiZmFpbGVkIiwib25WaXNpYmlsaXR5Q2hhbmdlIiwidmlzaWJpbGl0eVN0YXRlIiwib25DbGlwUGxhbmVzQ2hhbmdlIiwib25FbmQiLCJvZmYiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwidGljayIsIm9uIiwiRGVidWciLCJhc3NlcnQiLCJ3aW5kb3ciLCJmcmFtZWJ1ZmZlclNjYWxlRmFjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJtYXhQaXhlbFJhdGlvIiwiZGV2aWNlUGl4ZWxSYXRpbyIsIlhSV2ViR0xMYXllciIsImdsIiwiYWxwaGEiLCJkZXB0aCIsInN0ZW5jaWwiLCJ1cGRhdGVSZW5kZXJTdGF0ZSIsImJhc2VMYXllciIsImRlcHRoTmVhciIsImRlcHRoRmFyIiwicmVxdWVzdFJlZmVyZW5jZVNwYWNlIiwicmVmZXJlbmNlU3BhY2UiLCJuZWFyIiwiZmFyIiwidXBkYXRlIiwiZnJhbWUiLCJ3aWR0aCIsInJlbmRlclN0YXRlIiwiZnJhbWVidWZmZXJXaWR0aCIsImhlaWdodCIsImZyYW1lYnVmZmVySGVpZ2h0Iiwic2V0UmVzb2x1dGlvbiIsInBvc2UiLCJnZXRWaWV3ZXJQb3NlIiwibGVuZ3RoTmV3IiwiaSIsInZpZXciLCJwb3AiLCJ2aWV3cG9ydCIsIlZlYzQiLCJwcm9qTWF0IiwiTWF0NCIsInZpZXdNYXQiLCJ2aWV3T2ZmTWF0Iiwidmlld0ludk1hdCIsInZpZXdJbnZPZmZNYXQiLCJwcm9qVmlld09mZk1hdCIsInZpZXdNYXQzIiwiTWF0MyIsInBvc2l0aW9uIiwiRmxvYXQzMkFycmF5Iiwicm90YXRpb24iLCJwb3NlUG9zaXRpb24iLCJ0cmFuc2Zvcm0iLCJwb3NlT3JpZW50YXRpb24iLCJvcmllbnRhdGlvbiIsInNldCIsIngiLCJ5IiwieiIsInciLCJsYXllciIsInZpZXdSYXciLCJnZXRWaWV3cG9ydCIsInByb2plY3Rpb25NYXRyaXgiLCJpbnZlcnNlIiwibWF0cml4IiwiX25vZGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0TG9jYWxSb3RhdGlvbiIsImFjdGl2ZSIsImVudGl0eSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStCQSxNQUFNQSxTQUFTLFNBQVNDLFlBQVksQ0FBQzs7RUFvS2pDQyxXQUFXLENBQUNDLEdBQUcsRUFBRTtBQUNiLElBQUEsS0FBSyxFQUFFLENBQUE7QUFBQyxJQUFBLElBQUEsQ0FoS1pBLEdBQUcsR0FBQSxLQUFBLENBQUEsQ0FBQTtJQUFBLElBTUhDLENBQUFBLFVBQVUsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBQyxDQUFDQyxTQUFTLENBQUNDLEVBQUUsQ0FBQTtJQUFBLElBTS9DQyxDQUFBQSxVQUFVLEdBQUcsRUFBRSxDQUFBO0lBQUEsSUFNZkMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUFBLElBTVpDLENBQUFBLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1qQkMsQ0FBQUEsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWZDLENBQUFBLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1qQkMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVF0QkMsWUFBWSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUVpDLFVBQVUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFWQyxPQUFPLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRUEMsYUFBYSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUWJDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9kQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRTEMsZUFBZSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUFNZkMsQ0FBQUEsT0FBTyxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWRDLENBQUFBLEtBQUssR0FBRyxFQUFFLENBQUE7SUFBQSxJQU1WQyxDQUFBQSxTQUFTLEdBQUcsRUFBRSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTWRDLGNBQWMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU0zQkMsY0FBYyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0lBQUEsSUFNM0JDLENBQUFBLFVBQVUsR0FBRyxHQUFHLENBQUE7SUFBQSxJQU1oQkMsQ0FBQUEsU0FBUyxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWhCQyxDQUFBQSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQUEsSUFNVkMsQ0FBQUEsT0FBTyxHQUFHLENBQUMsQ0FBQTtJQVdQLElBQUksQ0FBQzdCLEdBQUcsR0FBR0EsR0FBRyxDQUFBOztBQUdkLElBQUEsSUFBSSxDQUFDTSxVQUFVLENBQUN3QixhQUFhLENBQUMsR0FBRyxLQUFLLENBQUE7QUFDdEMsSUFBQSxJQUFJLENBQUN4QixVQUFVLENBQUN5QixTQUFTLENBQUMsR0FBRyxLQUFLLENBQUE7QUFDbEMsSUFBQSxJQUFJLENBQUN6QixVQUFVLENBQUMwQixTQUFTLENBQUMsR0FBRyxLQUFLLENBQUE7QUFFbEMsSUFBQSxJQUFJLENBQUNwQixZQUFZLEdBQUcsSUFBSXFCLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM1QyxJQUFBLElBQUksQ0FBQ3BCLFVBQVUsR0FBRyxJQUFJcUIsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDcEIsT0FBTyxHQUFHLElBQUlxQixTQUFTLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJLENBQUNwQixhQUFhLEdBQUcsSUFBSXFCLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM5QyxJQUFBLElBQUksQ0FBQ3BCLGNBQWMsR0FBRyxJQUFJcUIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDaEQsSUFBQSxJQUFJLENBQUNwQixLQUFLLEdBQUcsSUFBSXFCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM5QixJQUFBLElBQUksQ0FBQ3BCLGVBQWUsR0FBRyxJQUFJcUIsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUE7O0lBT2xELElBQUksSUFBSSxDQUFDdEMsVUFBVSxFQUFFO0FBQ2pCRyxNQUFBQSxTQUFTLENBQUNDLEVBQUUsQ0FBQ21DLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxNQUFNO1FBQ2hELElBQUksQ0FBQ0Msd0JBQXdCLEVBQUUsQ0FBQTtBQUNuQyxPQUFDLENBQUMsQ0FBQTtNQUNGLElBQUksQ0FBQ0Esd0JBQXdCLEVBQUUsQ0FBQTtBQUNuQyxLQUFBO0FBQ0osR0FBQTs7QUEwRUFDLEVBQUFBLE9BQU8sR0FBRztBQUNOLElBQUEsSUFBSSxDQUFDOUIsWUFBWSxDQUFDOEIsT0FBTyxFQUFFLENBQUE7SUFDM0IsSUFBSSxDQUFDOUIsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUM1QixHQUFBOztFQWlFQStCLEtBQUssQ0FBQ0MsTUFBTSxFQUFFQyxJQUFJLEVBQUVDLFNBQVMsRUFBRUMsT0FBTyxFQUFFO0lBQ3BDLElBQUlDLFFBQVEsR0FBR0QsT0FBTyxDQUFBO0lBRXRCLElBQUksT0FBT0EsT0FBTyxLQUFLLFFBQVEsRUFDM0JDLFFBQVEsR0FBR0QsT0FBTyxDQUFDQyxRQUFRLENBQUE7QUFFL0IsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDMUMsVUFBVSxDQUFDdUMsSUFBSSxDQUFDLEVBQUU7TUFDeEIsSUFBSUcsUUFBUSxFQUFFQSxRQUFRLENBQUMsSUFBSUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQTtBQUN4RCxNQUFBLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxJQUFJLENBQUN4QyxRQUFRLEVBQUU7TUFDZixJQUFJdUMsUUFBUSxFQUFFQSxRQUFRLENBQUMsSUFBSUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQTtBQUNsRSxNQUFBLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDOUIsT0FBTyxHQUFHeUIsTUFBTSxDQUFBO0FBQ3JCLElBQUEsSUFBSSxDQUFDekIsT0FBTyxDQUFDeUIsTUFBTSxDQUFDdkMsRUFBRSxHQUFHLElBQUksQ0FBQTtJQUM3QixJQUFJLENBQUNFLEtBQUssR0FBR3NDLElBQUksQ0FBQTtJQUNqQixJQUFJLENBQUNyQyxVQUFVLEdBQUdzQyxTQUFTLENBQUE7SUFFM0IsSUFBSSxDQUFDSSxjQUFjLENBQUNOLE1BQU0sQ0FBQ08sUUFBUSxFQUFFUCxNQUFNLENBQUNRLE9BQU8sQ0FBQyxDQUFBOztBQVVwRCxJQUFBLE1BQU1DLElBQUksR0FBRztNQUNUQyxnQkFBZ0IsRUFBRSxDQUFDUixTQUFTLENBQUM7QUFDN0JTLE1BQUFBLGdCQUFnQixFQUFFLEVBQUE7S0FDckIsQ0FBQTtJQUVELElBQUlWLElBQUksS0FBS2IsU0FBUyxFQUFFO0FBQ3BCcUIsTUFBQUEsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0MsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUE7QUFDOUNILE1BQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQTtBQUV0QyxNQUFBLElBQUlULE9BQU8sRUFBRTtBQUNULFFBQUEsSUFBSUEsT0FBTyxDQUFDaEMsYUFBYSxJQUFJLElBQUksQ0FBQ0EsYUFBYSxDQUFDMEMsU0FBUyxFQUNyREosSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUE7UUFFaEQsSUFBSVQsT0FBTyxDQUFDL0IsY0FBYyxFQUN0QnFDLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO0FBQ3JELE9BQUE7TUFFQSxJQUFJLElBQUksQ0FBQzNDLFVBQVUsQ0FBQzRDLFNBQVMsSUFBSSxJQUFJLENBQUM1QyxVQUFVLENBQUM2QyxJQUFJLEVBQUU7QUFDbkRMLFFBQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQTtRQUN6Q0gsSUFBSSxDQUFDeEMsVUFBVSxHQUFHO0FBQUU2QyxVQUFBQSxJQUFJLEVBQUUsSUFBSSxDQUFDN0MsVUFBVSxDQUFDNkMsSUFBQUE7U0FBTSxDQUFBO0FBQ3BELE9BQUE7TUFFQSxJQUFJWCxPQUFPLElBQUlBLE9BQU8sQ0FBQ25DLFlBQVksSUFBSSxJQUFJLENBQUNBLFlBQVksQ0FBQzZDLFNBQVMsRUFBRTtBQUNoRUosUUFBQUEsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFBO0FBRTNDLFFBQUEsTUFBTUcsZUFBZSxHQUFHLENBQUNDLHVCQUF1QixDQUFDLENBQUE7QUFDakQsUUFBQSxNQUFNQyxvQkFBb0IsR0FBRyxDQUFDQyx5QkFBeUIsQ0FBQyxDQUFBO0FBRXhELFFBQUEsSUFBSWYsT0FBTyxDQUFDbkMsWUFBWSxDQUFDK0MsZUFBZSxFQUFFO1VBQ3RDLE1BQU1JLEdBQUcsR0FBR0osZUFBZSxDQUFDSyxPQUFPLENBQUNqQixPQUFPLENBQUNuQyxZQUFZLENBQUMrQyxlQUFlLENBQUMsQ0FBQTtBQUN6RSxVQUFBLElBQUlJLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRUosZUFBZSxDQUFDTSxNQUFNLENBQUNGLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQTtVQUM5Q0osZUFBZSxDQUFDTyxPQUFPLENBQUNuQixPQUFPLENBQUNuQyxZQUFZLENBQUMrQyxlQUFlLENBQUMsQ0FBQTtBQUNqRSxTQUFBO0FBRUEsUUFBQSxJQUFJWixPQUFPLENBQUNuQyxZQUFZLENBQUNpRCxvQkFBb0IsRUFBRTtVQUMzQyxNQUFNRSxHQUFHLEdBQUdGLG9CQUFvQixDQUFDRyxPQUFPLENBQUNqQixPQUFPLENBQUNuQyxZQUFZLENBQUNpRCxvQkFBb0IsQ0FBQyxDQUFBO0FBQ25GLFVBQUEsSUFBSUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFRixvQkFBb0IsQ0FBQ0ksTUFBTSxDQUFDRixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUE7VUFDbkRGLG9CQUFvQixDQUFDSyxPQUFPLENBQUNuQixPQUFPLENBQUNuQyxZQUFZLENBQUNpRCxvQkFBb0IsQ0FBQyxDQUFBO0FBQzNFLFNBQUE7UUFFQVIsSUFBSSxDQUFDekMsWUFBWSxHQUFHO0FBQ2hCK0MsVUFBQUEsZUFBZSxFQUFFQSxlQUFlO0FBQ2hDRSxVQUFBQSxvQkFBb0IsRUFBRUEsb0JBQUFBO1NBQ3pCLENBQUE7QUFDTCxPQUFBO0FBQ0osS0FBQyxNQUFNLElBQUloQixJQUFJLEtBQUtkLFNBQVMsRUFBRTtBQUMzQnNCLE1BQUFBLElBQUksQ0FBQ0UsZ0JBQWdCLENBQUNDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQTtBQUMvQyxLQUFBO0FBRUEsSUFBQSxJQUFJVCxPQUFPLElBQUlBLE9BQU8sQ0FBQ1EsZ0JBQWdCLEVBQ25DRixJQUFJLENBQUNFLGdCQUFnQixHQUFHRixJQUFJLENBQUNFLGdCQUFnQixDQUFDWSxNQUFNLENBQUNwQixPQUFPLENBQUNRLGdCQUFnQixDQUFDLENBQUE7QUFFbEYsSUFBQSxJQUFJLElBQUksQ0FBQ3hDLGFBQWEsQ0FBQzBDLFNBQVMsSUFBSSxJQUFJLENBQUMxQyxhQUFhLENBQUNxRCxNQUFNLENBQUNDLE1BQU0sRUFBRTtNQUNsRSxJQUFJLENBQUN0RCxhQUFhLENBQUN1RCxhQUFhLENBQUMsQ0FBQ0MsR0FBRyxFQUFFQyxhQUFhLEtBQUs7QUFDckQsUUFBQSxJQUFJRCxHQUFHLEVBQUU7QUFDTCxVQUFBLElBQUl2QixRQUFRLEVBQUVBLFFBQVEsQ0FBQ3VCLEdBQUcsQ0FBQyxDQUFBO0FBQzNCLFVBQUEsSUFBSSxDQUFDRSxJQUFJLENBQUMsT0FBTyxFQUFFRixHQUFHLENBQUMsQ0FBQTtBQUN2QixVQUFBLE9BQUE7QUFDSixTQUFBO1FBRUEsSUFBSUMsYUFBYSxLQUFLLElBQUksRUFDdEJuQixJQUFJLENBQUNtQixhQUFhLEdBQUdBLGFBQWEsQ0FBQTtRQUV0QyxJQUFJLENBQUNFLG9CQUFvQixDQUFDN0IsSUFBSSxFQUFFQyxTQUFTLEVBQUVPLElBQUksRUFBRUwsUUFBUSxDQUFDLENBQUE7QUFDOUQsT0FBQyxDQUFDLENBQUE7QUFDTixLQUFDLE1BQU07TUFDSCxJQUFJLENBQUMwQixvQkFBb0IsQ0FBQzdCLElBQUksRUFBRUMsU0FBUyxFQUFFTyxJQUFJLEVBQUVMLFFBQVEsQ0FBQyxDQUFBO0FBQzlELEtBQUE7QUFDSixHQUFBOztFQVNBMEIsb0JBQW9CLENBQUM3QixJQUFJLEVBQUVDLFNBQVMsRUFBRUMsT0FBTyxFQUFFQyxRQUFRLEVBQUU7QUFDckQ1QyxJQUFBQSxTQUFTLENBQUNDLEVBQUUsQ0FBQ3NFLGNBQWMsQ0FBQzlCLElBQUksRUFBRUUsT0FBTyxDQUFDLENBQUM2QixJQUFJLENBQUVDLE9BQU8sSUFBSztNQUN6RCxJQUFJLENBQUNDLGVBQWUsQ0FBQ0QsT0FBTyxFQUFFL0IsU0FBUyxFQUFFRSxRQUFRLENBQUMsQ0FBQTtBQUN0RCxLQUFDLENBQUMsQ0FBQytCLEtBQUssQ0FBRUMsRUFBRSxJQUFLO0FBQ2IsTUFBQSxJQUFJLENBQUM3RCxPQUFPLENBQUN5QixNQUFNLENBQUN2QyxFQUFFLEdBQUcsSUFBSSxDQUFBO01BQzdCLElBQUksQ0FBQ2MsT0FBTyxHQUFHLElBQUksQ0FBQTtNQUNuQixJQUFJLENBQUNaLEtBQUssR0FBRyxJQUFJLENBQUE7TUFDakIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSSxDQUFBO0FBRXRCLE1BQUEsSUFBSXdDLFFBQVEsRUFBRUEsUUFBUSxDQUFDZ0MsRUFBRSxDQUFDLENBQUE7QUFDMUIsTUFBQSxJQUFJLENBQUNQLElBQUksQ0FBQyxPQUFPLEVBQUVPLEVBQUUsQ0FBQyxDQUFBO0FBQzFCLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7RUFnQkFDLEdBQUcsQ0FBQ2pDLFFBQVEsRUFBRTtBQUNWLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3ZDLFFBQVEsRUFBRTtNQUNoQixJQUFJdUMsUUFBUSxFQUFFQSxRQUFRLENBQUMsSUFBSUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQTtBQUNsRSxNQUFBLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSUQsUUFBUSxFQUFFLElBQUksQ0FBQ2tDLElBQUksQ0FBQyxLQUFLLEVBQUVsQyxRQUFRLENBQUMsQ0FBQTtBQUV4QyxJQUFBLElBQUksQ0FBQ3ZDLFFBQVEsQ0FBQ3dFLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLEdBQUE7O0VBb0JBRSxXQUFXLENBQUN0QyxJQUFJLEVBQUU7QUFDZCxJQUFBLE9BQU8sSUFBSSxDQUFDdkMsVUFBVSxDQUFDdUMsSUFBSSxDQUFDLENBQUE7QUFDaEMsR0FBQTs7QUFHQUosRUFBQUEsd0JBQXdCLEdBQUc7QUFDdkIsSUFBQSxLQUFLLE1BQU0yQyxHQUFHLElBQUksSUFBSSxDQUFDOUUsVUFBVSxFQUFFO0FBQy9CLE1BQUEsSUFBSSxDQUFDK0Usb0JBQW9CLENBQUNELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztFQU1BQyxvQkFBb0IsQ0FBQ3hDLElBQUksRUFBRTtJQUN2QnpDLFNBQVMsQ0FBQ0MsRUFBRSxDQUFDaUYsa0JBQWtCLENBQUN6QyxJQUFJLENBQUMsQ0FBQytCLElBQUksQ0FBRVcsU0FBUyxJQUFLO01BQ3RELElBQUksSUFBSSxDQUFDakYsVUFBVSxDQUFDdUMsSUFBSSxDQUFDLEtBQUswQyxTQUFTLEVBQ25DLE9BQUE7QUFFSixNQUFBLElBQUksQ0FBQ2pGLFVBQVUsQ0FBQ3VDLElBQUksQ0FBQyxHQUFHMEMsU0FBUyxDQUFBO01BQ2pDLElBQUksQ0FBQ2QsSUFBSSxDQUFDLFdBQVcsRUFBRTVCLElBQUksRUFBRTBDLFNBQVMsQ0FBQyxDQUFBO01BQ3ZDLElBQUksQ0FBQ2QsSUFBSSxDQUFDLFlBQVksR0FBRzVCLElBQUksRUFBRTBDLFNBQVMsQ0FBQyxDQUFBO0FBQzdDLEtBQUMsQ0FBQyxDQUFDUixLQUFLLENBQUVDLEVBQUUsSUFBSztBQUNiLE1BQUEsSUFBSSxDQUFDUCxJQUFJLENBQUMsT0FBTyxFQUFFTyxFQUFFLENBQUMsQ0FBQTtBQUMxQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7O0FBUUFGLEVBQUFBLGVBQWUsQ0FBQ0QsT0FBTyxFQUFFL0IsU0FBUyxFQUFFRSxRQUFRLEVBQUU7SUFDMUMsSUFBSXdDLE1BQU0sR0FBRyxLQUFLLENBQUE7SUFFbEIsSUFBSSxDQUFDL0UsUUFBUSxHQUFHb0UsT0FBTyxDQUFBO0lBRXZCLE1BQU1ZLGtCQUFrQixHQUFHLE1BQU07TUFDN0IsSUFBSSxDQUFDaEIsSUFBSSxDQUFDLG1CQUFtQixFQUFFSSxPQUFPLENBQUNhLGVBQWUsQ0FBQyxDQUFBO0tBQzFELENBQUE7SUFFRCxNQUFNQyxrQkFBa0IsR0FBRyxNQUFNO0FBQzdCLE1BQUEsSUFBSSxDQUFDekMsY0FBYyxDQUFDLElBQUksQ0FBQy9CLE9BQU8sQ0FBQ2dDLFFBQVEsRUFBRSxJQUFJLENBQUNoQyxPQUFPLENBQUNpQyxPQUFPLENBQUMsQ0FBQTtLQUNuRSxDQUFBOztJQUdELE1BQU13QyxLQUFLLEdBQUcsTUFBTTtNQUNoQixJQUFJLElBQUksQ0FBQ3pFLE9BQU8sRUFBRTtRQUNkLElBQUksQ0FBQ0EsT0FBTyxDQUFDMEUsR0FBRyxDQUFDLGNBQWMsRUFBRUYsa0JBQWtCLENBQUMsQ0FBQTtRQUNwRCxJQUFJLENBQUN4RSxPQUFPLENBQUMwRSxHQUFHLENBQUMsYUFBYSxFQUFFRixrQkFBa0IsQ0FBQyxDQUFBO0FBRW5ELFFBQUEsSUFBSSxDQUFDeEUsT0FBTyxDQUFDeUIsTUFBTSxDQUFDdkMsRUFBRSxHQUFHLElBQUksQ0FBQTtRQUM3QixJQUFJLENBQUNjLE9BQU8sR0FBRyxJQUFJLENBQUE7QUFDdkIsT0FBQTtBQUVBMEQsTUFBQUEsT0FBTyxDQUFDaUIsbUJBQW1CLENBQUMsS0FBSyxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN6Q2YsTUFBQUEsT0FBTyxDQUFDaUIsbUJBQW1CLENBQUMsa0JBQWtCLEVBQUVMLGtCQUFrQixDQUFDLENBQUE7TUFFbkUsSUFBSSxDQUFDRCxNQUFNLEVBQUUsSUFBSSxDQUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7TUFFN0IsSUFBSSxDQUFDaEUsUUFBUSxHQUFHLElBQUksQ0FBQTtNQUNwQixJQUFJLENBQUNFLGVBQWUsR0FBRyxJQUFJLENBQUE7TUFDM0IsSUFBSSxDQUFDUyxLQUFLLEdBQUcsRUFBRSxDQUFBO01BQ2YsSUFBSSxDQUFDUSxNQUFNLEdBQUcsQ0FBQyxDQUFBO01BQ2YsSUFBSSxDQUFDQyxPQUFPLEdBQUcsQ0FBQyxDQUFBO01BQ2hCLElBQUksQ0FBQ3RCLEtBQUssR0FBRyxJQUFJLENBQUE7TUFDakIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSSxDQUFBOztBQUl0QixNQUFBLElBQUksQ0FBQ1IsR0FBRyxDQUFDK0YsSUFBSSxFQUFFLENBQUE7S0FDbEIsQ0FBQTtBQUVEbEIsSUFBQUEsT0FBTyxDQUFDckMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFb0QsS0FBSyxDQUFDLENBQUE7QUFDdENmLElBQUFBLE9BQU8sQ0FBQ3JDLGdCQUFnQixDQUFDLGtCQUFrQixFQUFFaUQsa0JBQWtCLENBQUMsQ0FBQTtJQUVoRSxJQUFJLENBQUN0RSxPQUFPLENBQUM2RSxFQUFFLENBQUMsY0FBYyxFQUFFTCxrQkFBa0IsQ0FBQyxDQUFBO0lBQ25ELElBQUksQ0FBQ3hFLE9BQU8sQ0FBQzZFLEVBQUUsQ0FBQyxhQUFhLEVBQUVMLGtCQUFrQixDQUFDLENBQUE7O0FBS2xETSxJQUFBQSxLQUFLLENBQUNDLE1BQU0sQ0FBQ0MsTUFBTSxFQUFFLDRFQUE0RSxDQUFDLENBQUE7QUFDbEcsSUFBQSxNQUFNQyxzQkFBc0IsR0FBRyxJQUFJLENBQUNwRyxHQUFHLENBQUNxRyxjQUFjLENBQUNDLGFBQWEsR0FBR0gsTUFBTSxDQUFDSSxnQkFBZ0IsQ0FBQTtBQUU5RixJQUFBLElBQUksQ0FBQzdGLFVBQVUsR0FBRyxJQUFJOEYsWUFBWSxDQUFDM0IsT0FBTyxFQUFFLElBQUksQ0FBQzdFLEdBQUcsQ0FBQ3FHLGNBQWMsQ0FBQ0ksRUFBRSxFQUFFO0FBQ3BFQyxNQUFBQSxLQUFLLEVBQUUsSUFBSTtBQUNYQyxNQUFBQSxLQUFLLEVBQUUsSUFBSTtBQUNYQyxNQUFBQSxPQUFPLEVBQUUsSUFBSTtBQUNiUixNQUFBQSxzQkFBc0IsRUFBRUEsc0JBQUFBO0FBQzVCLEtBQUMsQ0FBQyxDQUFBO0lBRUZ2QixPQUFPLENBQUNnQyxpQkFBaUIsQ0FBQztNQUN0QkMsU0FBUyxFQUFFLElBQUksQ0FBQ3BHLFVBQVU7TUFDMUJxRyxTQUFTLEVBQUUsSUFBSSxDQUFDckYsVUFBVTtNQUMxQnNGLFFBQVEsRUFBRSxJQUFJLENBQUNyRixTQUFBQTtBQUNuQixLQUFDLENBQUMsQ0FBQTs7SUFHRmtELE9BQU8sQ0FBQ29DLHFCQUFxQixDQUFDbkUsU0FBUyxDQUFDLENBQUM4QixJQUFJLENBQUVzQyxjQUFjLElBQUs7TUFDOUQsSUFBSSxDQUFDdkcsZUFBZSxHQUFHdUcsY0FBYyxDQUFBOztBQUlyQyxNQUFBLElBQUksQ0FBQ2xILEdBQUcsQ0FBQytGLElBQUksRUFBRSxDQUFBO0FBRWYsTUFBQSxJQUFJL0MsUUFBUSxFQUFFQSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDNUIsTUFBQSxJQUFJLENBQUN5QixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUE7QUFDdEIsS0FBQyxDQUFDLENBQUNNLEtBQUssQ0FBRUMsRUFBRSxJQUFLO0FBQ2JRLE1BQUFBLE1BQU0sR0FBRyxJQUFJLENBQUE7TUFDYlgsT0FBTyxDQUFDSSxHQUFHLEVBQUUsQ0FBQTtBQUNiLE1BQUEsSUFBSWpDLFFBQVEsRUFBRUEsUUFBUSxDQUFDZ0MsRUFBRSxDQUFDLENBQUE7QUFDMUIsTUFBQSxJQUFJLENBQUNQLElBQUksQ0FBQyxPQUFPLEVBQUVPLEVBQUUsQ0FBQyxDQUFBO0FBQzFCLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFPQTlCLEVBQUFBLGNBQWMsQ0FBQ2lFLElBQUksRUFBRUMsR0FBRyxFQUFFO0lBQ3RCLElBQUksSUFBSSxDQUFDMUYsVUFBVSxLQUFLeUYsSUFBSSxJQUFJLElBQUksQ0FBQ3hGLFNBQVMsS0FBS3lGLEdBQUcsRUFDbEQsT0FBQTtJQUVKLElBQUksQ0FBQzFGLFVBQVUsR0FBR3lGLElBQUksQ0FBQTtJQUN0QixJQUFJLENBQUN4RixTQUFTLEdBQUd5RixHQUFHLENBQUE7QUFFcEIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDM0csUUFBUSxFQUNkLE9BQUE7O0FBSUosSUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQ29HLGlCQUFpQixDQUFDO01BQzVCRSxTQUFTLEVBQUUsSUFBSSxDQUFDckYsVUFBVTtNQUMxQnNGLFFBQVEsRUFBRSxJQUFJLENBQUNyRixTQUFBQTtBQUNuQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7O0VBUUEwRixNQUFNLENBQUNDLEtBQUssRUFBRTtBQUNWLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQzdHLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQTs7SUFHaEMsTUFBTThHLEtBQUssR0FBR0QsS0FBSyxDQUFDekMsT0FBTyxDQUFDMkMsV0FBVyxDQUFDVixTQUFTLENBQUNXLGdCQUFnQixDQUFBO0lBQ2xFLE1BQU1DLE1BQU0sR0FBR0osS0FBSyxDQUFDekMsT0FBTyxDQUFDMkMsV0FBVyxDQUFDVixTQUFTLENBQUNhLGlCQUFpQixDQUFBO0lBQ3BFLElBQUksSUFBSSxDQUFDL0YsTUFBTSxLQUFLMkYsS0FBSyxJQUFJLElBQUksQ0FBQzFGLE9BQU8sS0FBSzZGLE1BQU0sRUFBRTtNQUNsRCxJQUFJLENBQUM5RixNQUFNLEdBQUcyRixLQUFLLENBQUE7TUFDbkIsSUFBSSxDQUFDMUYsT0FBTyxHQUFHNkYsTUFBTSxDQUFBO01BQ3JCLElBQUksQ0FBQzFILEdBQUcsQ0FBQ3FHLGNBQWMsQ0FBQ3VCLGFBQWEsQ0FBQ0wsS0FBSyxFQUFFRyxNQUFNLENBQUMsQ0FBQTtBQUN4RCxLQUFBO0lBRUEsTUFBTUcsSUFBSSxHQUFHUCxLQUFLLENBQUNRLGFBQWEsQ0FBQyxJQUFJLENBQUNuSCxlQUFlLENBQUMsQ0FBQTtBQUV0RCxJQUFBLElBQUksQ0FBQ2tILElBQUksRUFBRSxPQUFPLEtBQUssQ0FBQTtBQUV2QixJQUFBLE1BQU1FLFNBQVMsR0FBR0YsSUFBSSxDQUFDekcsS0FBSyxDQUFDaUQsTUFBTSxDQUFBO0FBRW5DLElBQUEsSUFBSTBELFNBQVMsR0FBRyxJQUFJLENBQUMzRyxLQUFLLENBQUNpRCxNQUFNLEVBQUU7QUFFL0IsTUFBQSxLQUFLLElBQUkyRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLElBQUtELFNBQVMsR0FBRyxJQUFJLENBQUMzRyxLQUFLLENBQUNpRCxNQUFPLEVBQUUyRCxDQUFDLEVBQUUsRUFBRTtBQUN2RCxRQUFBLElBQUlDLElBQUksR0FBRyxJQUFJLENBQUM1RyxTQUFTLENBQUM2RyxHQUFHLEVBQUUsQ0FBQTtRQUMvQixJQUFJLENBQUNELElBQUksRUFBRTtBQUNQQSxVQUFBQSxJQUFJLEdBQUc7WUFDSEUsUUFBUSxFQUFFLElBQUlDLElBQUksRUFBRTtZQUNwQkMsT0FBTyxFQUFFLElBQUlDLElBQUksRUFBRTtZQUNuQkMsT0FBTyxFQUFFLElBQUlELElBQUksRUFBRTtZQUNuQkUsVUFBVSxFQUFFLElBQUlGLElBQUksRUFBRTtZQUN0QkcsVUFBVSxFQUFFLElBQUlILElBQUksRUFBRTtZQUN0QkksYUFBYSxFQUFFLElBQUlKLElBQUksRUFBRTtZQUN6QkssY0FBYyxFQUFFLElBQUlMLElBQUksRUFBRTtZQUMxQk0sUUFBUSxFQUFFLElBQUlDLElBQUksRUFBRTtBQUNwQkMsWUFBQUEsUUFBUSxFQUFFLElBQUlDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDN0JDLFFBQVEsRUFBRSxJQUFJdkgsSUFBSSxFQUFBO1dBQ3JCLENBQUE7QUFDTCxTQUFBO0FBRUEsUUFBQSxJQUFJLENBQUNMLEtBQUssQ0FBQ29DLElBQUksQ0FBQ3lFLElBQUksQ0FBQyxDQUFBO0FBQ3pCLE9BQUE7S0FDSCxNQUFNLElBQUlGLFNBQVMsSUFBSSxJQUFJLENBQUMzRyxLQUFLLENBQUNpRCxNQUFNLEVBQUU7QUFFdkMsTUFBQSxLQUFLLElBQUkyRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUksSUFBSSxDQUFDNUcsS0FBSyxDQUFDaUQsTUFBTSxHQUFHMEQsU0FBVSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtRQUN0RCxJQUFJLENBQUMzRyxTQUFTLENBQUNtQyxJQUFJLENBQUMsSUFBSSxDQUFDcEMsS0FBSyxDQUFDOEcsR0FBRyxFQUFFLENBQUMsQ0FBQTtBQUN6QyxPQUFBO0FBQ0osS0FBQTs7QUFHQSxJQUFBLE1BQU1lLFlBQVksR0FBR3BCLElBQUksQ0FBQ3FCLFNBQVMsQ0FBQ0osUUFBUSxDQUFBO0FBQzVDLElBQUEsTUFBTUssZUFBZSxHQUFHdEIsSUFBSSxDQUFDcUIsU0FBUyxDQUFDRSxXQUFXLENBQUE7QUFDbEQsSUFBQSxJQUFJLENBQUM5SCxjQUFjLENBQUMrSCxHQUFHLENBQUNKLFlBQVksQ0FBQ0ssQ0FBQyxFQUFFTCxZQUFZLENBQUNNLENBQUMsRUFBRU4sWUFBWSxDQUFDTyxDQUFDLENBQUMsQ0FBQTtJQUN2RSxJQUFJLENBQUNoSSxjQUFjLENBQUM2SCxHQUFHLENBQUNGLGVBQWUsQ0FBQ0csQ0FBQyxFQUFFSCxlQUFlLENBQUNJLENBQUMsRUFBRUosZUFBZSxDQUFDSyxDQUFDLEVBQUVMLGVBQWUsQ0FBQ00sQ0FBQyxDQUFDLENBQUE7SUFFbkcsTUFBTUMsS0FBSyxHQUFHcEMsS0FBSyxDQUFDekMsT0FBTyxDQUFDMkMsV0FBVyxDQUFDVixTQUFTLENBQUE7QUFFakQsSUFBQSxLQUFLLElBQUlrQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdILElBQUksQ0FBQ3pHLEtBQUssQ0FBQ2lELE1BQU0sRUFBRTJELENBQUMsRUFBRSxFQUFFO0FBRXhDLE1BQUEsTUFBTTJCLE9BQU8sR0FBRzlCLElBQUksQ0FBQ3pHLEtBQUssQ0FBQzRHLENBQUMsQ0FBQyxDQUFBO0FBQzdCLE1BQUEsTUFBTUMsSUFBSSxHQUFHLElBQUksQ0FBQzdHLEtBQUssQ0FBQzRHLENBQUMsQ0FBQyxDQUFBO0FBQzFCLE1BQUEsTUFBTUcsUUFBUSxHQUFHdUIsS0FBSyxDQUFDRSxXQUFXLENBQUNELE9BQU8sQ0FBQyxDQUFBO0FBRTNDMUIsTUFBQUEsSUFBSSxDQUFDRSxRQUFRLENBQUNtQixDQUFDLEdBQUduQixRQUFRLENBQUNtQixDQUFDLENBQUE7QUFDNUJyQixNQUFBQSxJQUFJLENBQUNFLFFBQVEsQ0FBQ29CLENBQUMsR0FBR3BCLFFBQVEsQ0FBQ29CLENBQUMsQ0FBQTtBQUM1QnRCLE1BQUFBLElBQUksQ0FBQ0UsUUFBUSxDQUFDcUIsQ0FBQyxHQUFHckIsUUFBUSxDQUFDWixLQUFLLENBQUE7QUFDaENVLE1BQUFBLElBQUksQ0FBQ0UsUUFBUSxDQUFDc0IsQ0FBQyxHQUFHdEIsUUFBUSxDQUFDVCxNQUFNLENBQUE7TUFFakNPLElBQUksQ0FBQ0ksT0FBTyxDQUFDZ0IsR0FBRyxDQUFDTSxPQUFPLENBQUNFLGdCQUFnQixDQUFDLENBQUE7QUFDMUM1QixNQUFBQSxJQUFJLENBQUNNLE9BQU8sQ0FBQ2MsR0FBRyxDQUFDTSxPQUFPLENBQUNULFNBQVMsQ0FBQ1ksT0FBTyxDQUFDQyxNQUFNLENBQUMsQ0FBQTtNQUNsRDlCLElBQUksQ0FBQ1EsVUFBVSxDQUFDWSxHQUFHLENBQUNNLE9BQU8sQ0FBQ1QsU0FBUyxDQUFDYSxNQUFNLENBQUMsQ0FBQTtBQUNqRCxLQUFBOztBQUdBLElBQUEsSUFBSSxDQUFDNUksT0FBTyxDQUFDeUIsTUFBTSxDQUFDb0gsS0FBSyxDQUFDQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMzSSxjQUFjLENBQUMsQ0FBQTtBQUMvRCxJQUFBLElBQUksQ0FBQ0gsT0FBTyxDQUFDeUIsTUFBTSxDQUFDb0gsS0FBSyxDQUFDRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMxSSxjQUFjLENBQUMsQ0FBQTtBQUUvRCxJQUFBLElBQUksQ0FBQ1AsS0FBSyxDQUFDb0csTUFBTSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUV4QixJQUFBLElBQUksSUFBSSxDQUFDL0csS0FBSyxLQUFLeUIsU0FBUyxFQUFFO0FBQzFCLE1BQUEsSUFBSSxJQUFJLENBQUNsQixPQUFPLENBQUMyQyxTQUFTLEVBQ3RCLElBQUksQ0FBQzNDLE9BQU8sQ0FBQ3VHLE1BQU0sQ0FBQ0MsS0FBSyxDQUFDLENBQUE7QUFFOUIsTUFBQSxJQUFJLElBQUksQ0FBQ3BHLGVBQWUsQ0FBQ3VDLFNBQVMsRUFDOUIsSUFBSSxDQUFDdkMsZUFBZSxDQUFDbUcsTUFBTSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtNQUV0QyxJQUFJLElBQUksQ0FBQzFHLFlBQVksQ0FBQzZDLFNBQVMsRUFDM0IsSUFBSSxDQUFDN0MsWUFBWSxDQUFDeUcsTUFBTSxDQUFDQyxLQUFLLEVBQUVPLElBQUksSUFBSUEsSUFBSSxDQUFDekcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFMUQsTUFBQSxJQUFJLElBQUksQ0FBQ0wsYUFBYSxDQUFDMEMsU0FBUyxFQUM1QixJQUFJLENBQUMxQyxhQUFhLENBQUNzRyxNQUFNLENBQUNDLEtBQUssQ0FBQyxDQUFBO0FBRXBDLE1BQUEsSUFBSSxJQUFJLENBQUN0RyxjQUFjLENBQUN5QyxTQUFTLEVBQzdCLElBQUksQ0FBQ3pDLGNBQWMsQ0FBQ3FHLE1BQU0sQ0FBQ0MsS0FBSyxDQUFDLENBQUE7QUFDekMsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDN0MsSUFBSSxDQUFDLFFBQVEsRUFBRTZDLEtBQUssQ0FBQyxDQUFBO0FBRTFCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQU9BLEVBQUEsSUFBSTdELFNBQVMsR0FBRztJQUNaLE9BQU8sSUFBSSxDQUFDeEQsVUFBVSxDQUFBO0FBQzFCLEdBQUE7O0FBT0EsRUFBQSxJQUFJa0ssTUFBTSxHQUFHO0FBQ1QsSUFBQSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMxSixRQUFRLENBQUE7QUFDMUIsR0FBQTs7QUFRQSxFQUFBLElBQUlvQyxJQUFJLEdBQUc7SUFDUCxPQUFPLElBQUksQ0FBQ3RDLEtBQUssQ0FBQTtBQUNyQixHQUFBOztBQVFBLEVBQUEsSUFBSXVDLFNBQVMsR0FBRztJQUNaLE9BQU8sSUFBSSxDQUFDdEMsVUFBVSxDQUFBO0FBQzFCLEdBQUE7O0FBT0EsRUFBQSxJQUFJcUUsT0FBTyxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUNwRSxRQUFRLENBQUE7QUFDeEIsR0FBQTs7QUFPQSxFQUFBLElBQUltQyxNQUFNLEdBQUc7SUFDVCxPQUFPLElBQUksQ0FBQ3pCLE9BQU8sR0FBRyxJQUFJLENBQUNBLE9BQU8sQ0FBQ2lKLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDcEQsR0FBQTs7QUFTQSxFQUFBLElBQUkxRSxlQUFlLEdBQUc7QUFDbEIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDakYsUUFBUSxFQUNkLE9BQU8sSUFBSSxDQUFBO0FBRWYsSUFBQSxPQUFPLElBQUksQ0FBQ0EsUUFBUSxDQUFDaUYsZUFBZSxDQUFBO0FBQ3hDLEdBQUE7QUFDSjs7OzsifQ==
