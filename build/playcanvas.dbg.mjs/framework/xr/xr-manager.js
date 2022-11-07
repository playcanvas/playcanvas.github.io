/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1tYW5hZ2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgWFJUWVBFX0lOTElORSwgWFJUWVBFX1ZSLCBYUlRZUEVfQVIsIFhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVLCBYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgWHJIaXRUZXN0IH0gZnJvbSAnLi94ci1oaXQtdGVzdC5qcyc7XG5pbXBvcnQgeyBYcklucHV0IH0gZnJvbSAnLi94ci1pbnB1dC5qcyc7XG5pbXBvcnQgeyBYckxpZ2h0RXN0aW1hdGlvbiB9IGZyb20gJy4veHItbGlnaHQtZXN0aW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBYckltYWdlVHJhY2tpbmcgfSBmcm9tICcuL3hyLWltYWdlLXRyYWNraW5nLmpzJztcbmltcG9ydCB7IFhyRG9tT3ZlcmxheSB9IGZyb20gJy4veHItZG9tLW92ZXJsYXkuanMnO1xuaW1wb3J0IHsgWHJEZXB0aFNlbnNpbmcgfSBmcm9tICcuL3hyLWRlcHRoLXNlbnNpbmcuanMnO1xuaW1wb3J0IHsgWHJQbGFuZURldGVjdGlvbiB9IGZyb20gJy4veHItcGxhbmUtZGV0ZWN0aW9uLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gQ2FtZXJhQ29tcG9uZW50ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBBcHBCYXNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYck1hbmFnZXIjZW5kWHJ9IGFuZCB7QGxpbmsgWHJNYW5hZ2VyI3N0YXJ0WHJ9LlxuICpcbiAqIEBjYWxsYmFjayBYckVycm9yQ2FsbGJhY2tcbiAqIEBwYXJhbSB7RXJyb3J8bnVsbH0gZXJyIC0gVGhlIEVycm9yIG9iamVjdCBvciBudWxsIGlmIG9wZXJhdGlvbiB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuXG4vKipcbiAqIE1hbmFnZSBhbmQgdXBkYXRlIFhSIHNlc3Npb24gYW5kIGl0cyBzdGF0ZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBYck1hbmFnZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcHBCYXNlfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhcHA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zdXBwb3J0ZWQgPSBwbGF0Zm9ybS5icm93c2VyICYmICEhbmF2aWdhdG9yLnhyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIGJvb2xlYW4+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2F2YWlsYWJsZSA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3R5cGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJTZXNzaW9ufG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2Vzc2lvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJXZWJHTExheWVyfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYmFzZUxheWVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUlJlZmVyZW5jZVNwYWNlfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVmZXJlbmNlU3BhY2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGRlcHRoIHNlbnNpbmcgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyRGVwdGhTZW5zaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZXB0aFNlbnNpbmc7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gRE9NIG92ZXJsYXkgY2FwYWJpbGl0aWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hyRG9tT3ZlcmxheX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZG9tT3ZlcmxheTtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIHRoZSBhYmlsaXR5IHRvIHBlcmZvcm0gaGl0IHRlc3RzIG9uIHRoZSByZXByZXNlbnRhdGlvbiBvZiByZWFsIHdvcmxkIGdlb21ldHJ5XG4gICAgICogb2YgdGhlIHVuZGVybHlpbmcgQVIgc3lzdGVtLlxuICAgICAqXG4gICAgICogQHR5cGUge1hySGl0VGVzdH1cbiAgICAgKi9cbiAgICBoaXRUZXN0O1xuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZXMgYWNjZXNzIHRvIGltYWdlIHRyYWNraW5nIGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckltYWdlVHJhY2tpbmd9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGltYWdlVHJhY2tpbmc7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gcGxhbmUgZGV0ZWN0aW9uIGNhcGFiaWxpdGllcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYclBsYW5lRGV0ZWN0aW9ufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBwbGFuZURldGVjdGlvbjtcblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBJbnB1dCBTb3VyY2VzLlxuICAgICAqXG4gICAgICogQHR5cGUge1hySW5wdXR9XG4gICAgICovXG4gICAgaW5wdXQ7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlcyBhY2Nlc3MgdG8gbGlnaHQgZXN0aW1hdGlvbiBjYXBhYmlsaXRpZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJMaWdodEVzdGltYXRpb259XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxpZ2h0RXN0aW1hdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDYW1lcmFDb21wb25lbnR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FtZXJhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3MgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheTwqPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdmlld3NQb29sID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aE5lYXIgPSAwLjE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoRmFyID0gMTAwMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfd2lkdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oZWlnaHQgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXBwQmFzZX0gYXBwIC0gVGhlIG1haW4gYXBwbGljYXRpb24uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuYXBwID0gYXBwO1xuXG4gICAgICAgIC8vIEFkZCBhbGwgdGhlIHN1cHBvcnRlZCBzZXNzaW9uIHR5cGVzXG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZVtYUlRZUEVfSU5MSU5FXSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdmFpbGFibGVbWFJUWVBFX1ZSXSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdmFpbGFibGVbWFJUWVBFX0FSXSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nID0gbmV3IFhyRGVwdGhTZW5zaW5nKHRoaXMpO1xuICAgICAgICB0aGlzLmRvbU92ZXJsYXkgPSBuZXcgWHJEb21PdmVybGF5KHRoaXMpO1xuICAgICAgICB0aGlzLmhpdFRlc3QgPSBuZXcgWHJIaXRUZXN0KHRoaXMpO1xuICAgICAgICB0aGlzLmltYWdlVHJhY2tpbmcgPSBuZXcgWHJJbWFnZVRyYWNraW5nKHRoaXMpO1xuICAgICAgICB0aGlzLnBsYW5lRGV0ZWN0aW9uID0gbmV3IFhyUGxhbmVEZXRlY3Rpb24odGhpcyk7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBuZXcgWHJJbnB1dCh0aGlzKTtcbiAgICAgICAgdGhpcy5saWdodEVzdGltYXRpb24gPSBuZXcgWHJMaWdodEVzdGltYXRpb24odGhpcyk7XG5cbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyAxLiBITUQgY2xhc3Mgd2l0aCBpdHMgcGFyYW1zXG4gICAgICAgIC8vIDIuIFNwYWNlIGNsYXNzXG4gICAgICAgIC8vIDMuIENvbnRyb2xsZXJzIGNsYXNzXG5cbiAgICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZCkge1xuICAgICAgICAgICAgbmF2aWdhdG9yLnhyLmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZWNoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLl9kZXZpY2VBdmFpbGFiaWxpdHlDaGVjaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhdmFpbGFiaWxpdHkgb2Ygc3BlY2lmaWMgWFIgdHlwZSBpcyBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNhdmFpbGFibGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSBzZXNzaW9uIHR5cGUgdGhhdCBoYXMgY2hhbmdlZCBhdmFpbGFiaWxpdHkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhdmFpbGFibGUgLSBUcnVlIGlmIHNwZWNpZmllZCBzZXNzaW9uIHR5cGUgaXMgbm93IGF2YWlsYWJsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignYXZhaWxhYmxlJywgZnVuY3Rpb24gKHR5cGUsIGF2YWlsYWJsZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZygnXCInICsgdHlwZSArICdcIiBYUiBzZXNzaW9uIGlzIG5vdyAnICsgKGF2YWlsYWJsZSA/ICdhdmFpbGFibGUnIDogJ3VuYXZhaWxhYmxlJykpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhdmFpbGFiaWxpdHkgb2Ygc3BlY2lmaWMgWFIgdHlwZSBpcyBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciNhdmFpbGFibGU6W3R5cGVdXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhdmFpbGFibGUgLSBUcnVlIGlmIHNwZWNpZmllZCBzZXNzaW9uIHR5cGUgaXMgbm93IGF2YWlsYWJsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignYXZhaWxhYmxlOicgKyBwYy5YUlRZUEVfVlIsIGZ1bmN0aW9uIChhdmFpbGFibGUpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coJ0ltbWVyc2l2ZSBWUiBzZXNzaW9uIGlzIG5vdyAnICsgKGF2YWlsYWJsZSA/ICdhdmFpbGFibGUnIDogJ3VuYXZhaWxhYmxlJykpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBYUiBzZXNzaW9uIGlzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJNYW5hZ2VyI3N0YXJ0XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIub24oJ3N0YXJ0JywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBYUiBzZXNzaW9uIGhhcyBzdGFydGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgZW5kZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJNYW5hZ2VyI2VuZFxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIFhSIHNlc3Npb24gaGFzIGVuZGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIFhSIHNlc3Npb24gaXMgdXBkYXRlZCwgcHJvdmlkaW5nIHJlbGV2YW50IFhSRnJhbWUgb2JqZWN0LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyTWFuYWdlciN1cGRhdGVcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZnJhbWUgLSBbWFJGcmFtZV0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hSRnJhbWUpXG4gICAgICogb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgZm9yIGludGVyZmFjaW5nIGRpcmVjdGx5IHdpdGggV2ViWFIgQVBJcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbigndXBkYXRlJywgZnVuY3Rpb24gKGZyYW1lKSB7XG4gICAgICpcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gWFIgc2Vzc2lvbiBpcyBmYWlsZWQgdG8gc3RhcnQgb3IgZmFpbGVkIHRvIGNoZWNrIGZvciBzZXNzaW9uIHR5cGUgc3VwcG9ydC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYck1hbmFnZXIjZXJyb3JcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJvciAtIEVycm9yIG9iamVjdCByZWxhdGVkIHRvIGZhaWx1cmUgb2Ygc2Vzc2lvbiBzdGFydCBvciBjaGVjayBvZiBzZXNzaW9uXG4gICAgICogdHlwZSBzdXBwb3J0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChleCkge1xuICAgICAqICAgICAvLyBYUiBzZXNzaW9uIGhhcyBmYWlsZWQgdG8gc3RhcnQsIG9yIGZhaWxlZCB0byBjaGVjayBmb3Igc2Vzc2lvbiB0eXBlIHN1cHBvcnRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHRoZSBYck1hbmFnZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5kZXB0aFNlbnNpbmcuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmRlcHRoU2Vuc2luZyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gc3RhcnQgWFIgc2Vzc2lvbiBmb3IgcHJvdmlkZWQge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gYW5kIG9wdGlvbmFsbHkgZmlyZXNcbiAgICAgKiBjYWxsYmFjayB3aGVuIHNlc3Npb24gaXMgY3JlYXRlZCBvciBmYWlsZWQgdG8gY3JlYXRlLiBJbnRlZ3JhdGVkIFhSIEFQSXMgbmVlZCB0byBiZSBlbmFibGVkXG4gICAgICogYnkgcHJvdmlkaW5nIHJlbGV2YW50IG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gSXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciBYUiBzZXNzaW9uIGFuZCBtYW5pcHVsYXRlZCBiYXNlZFxuICAgICAqIG9uIHBvc2UgdHJhY2tpbmcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBhbHdheXMgc3VwcG9ydGVkIHNwYWNlIHdpdGggc29tZSBiYXNpYyB0cmFja2luZ1xuICAgICAqIGNhcGFiaWxpdGllcy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMfTogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGVcbiAgICAgKiB2aWV3ZXIgYXQgdGhlIHRpbWUgb2YgY3JlYXRpb24uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3IgYmFzaWMgbG9jYWwgWFIgc2Vzc2lvbnMuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTEZMT09SfTogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW5cbiAgICAgKiBhdCB0aGUgZmxvb3IgaW4gYSBzYWZlIHBvc2l0aW9uIGZvciB0aGUgdXNlciB0byBzdGFuZC4gVGhlIHkgYXhpcyBlcXVhbHMgMCBhdCBmbG9vciBsZXZlbC5cbiAgICAgKiBGbG9vciBsZXZlbCB2YWx1ZSBtaWdodCBiZSBlc3RpbWF0ZWQgYnkgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0uIEl0IGlzIG1lYW50IGZvciBzZWF0ZWQgb3JcbiAgICAgKiBiYXNpYyBsb2NhbCBYUiBzZXNzaW9ucy5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3Qgd2l0aCBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIFhSIHNlc3Npb24gaW5pdGlhbGl6YXRpb24uXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMub3B0aW9uYWxGZWF0dXJlc10gLSBPcHRpb25hbCBmZWF0dXJlcyBmb3IgWFJTZXNzaW9uIHN0YXJ0LiBJdCBpc1xuICAgICAqIHVzZWQgZm9yIGdldHRpbmcgYWNjZXNzIHRvIGFkZGl0aW9uYWwgV2ViWFIgc3BlYyBleHRlbnNpb25zLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuaW1hZ2VUcmFja2luZ10gLSBTZXQgdG8gdHJ1ZSB0byBhdHRlbXB0IHRvIGVuYWJsZVxuICAgICAqIHtAbGluayBYckltYWdlVHJhY2tpbmd9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucGxhbmVEZXRlY3Rpb25dIC0gU2V0IHRvIHRydWUgdG8gYXR0ZW1wdCB0byBlbmFibGVcbiAgICAgKiB7QGxpbmsgWHJQbGFuZURldGVjdGlvbn0uXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IFtvcHRpb25zLmNhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIHNlc3Npb25cbiAgICAgKiBpcyBzdGFydGVkLiBUaGUgY2FsbGJhY2sgaGFzIG9uZSBhcmd1bWVudCBFcnJvciAtIGl0IGlzIG51bGwgaWYgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgWFJcbiAgICAgKiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5kZXB0aFNlbnNpbmddIC0gT3B0aW9uYWwgb2JqZWN0IHdpdGggZGVwdGggc2Vuc2luZyBwYXJhbWV0ZXJzIHRvXG4gICAgICogYXR0ZW1wdCB0byBlbmFibGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nfS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGVwdGhTZW5zaW5nLnVzYWdlUHJlZmVyZW5jZV0gLSBPcHRpb25hbCB1c2FnZSBwcmVmZXJlbmNlIGZvciBkZXB0aFxuICAgICAqIHNlbnNpbmcsIGNhbiBiZSAnY3B1LW9wdGltaXplZCcgb3IgJ2dwdS1vcHRpbWl6ZWQnIChYUkRFUFRIU0VOU0lOR1VTQUdFXyopLCBkZWZhdWx0cyB0b1xuICAgICAqICdjcHUtb3B0aW1pemVkJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsIGJlIGNob3NlbiBieSB0aGUgdW5kZXJseWluZyBkZXB0aCBzZW5zaW5nXG4gICAgICogc3lzdGVtLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2VdIC0gT3B0aW9uYWwgZGF0YSBmb3JtYXRcbiAgICAgKiBwcmVmZXJlbmNlIGZvciBkZXB0aCBzZW5zaW5nLCBjYW4gYmUgJ2x1bWluYW5jZS1hbHBoYScgb3IgJ2Zsb2F0MzInXG4gICAgICogKFhSREVQVEhTRU5TSU5HRk9STUFUXyopLCBkZWZhdWx0cyB0byAnbHVtaW5hbmNlLWFscGhhJy4gTW9zdCBwcmVmZXJyZWQgYW5kIHN1cHBvcnRlZCB3aWxsXG4gICAgICogYmUgY2hvc2VuIGJ5IHRoZSB1bmRlcmx5aW5nIGRlcHRoIHNlbnNpbmcgc3lzdGVtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX1ZSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IpO1xuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYnV0dG9uLm9uKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgYXBwLnhyLnN0YXJ0KGNhbWVyYSwgcGMuWFJUWVBFX0FSLCBwYy5YUlNQQUNFX0xPQ0FMRkxPT1IsIHtcbiAgICAgKiAgICAgICAgIGRlcHRoU2Vuc2luZzogeyB9XG4gICAgICogICAgIH0pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0KGNhbWVyYSwgdHlwZSwgc3BhY2VUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCBjYWxsYmFjayA9IG9wdGlvbnM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JylcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcblxuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZVt0eXBlXSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIGlzIG5vdCBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ1hSIHNlc3Npb24gaXMgYWxyZWFkeSBzdGFydGVkJykpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gdGhpcztcbiAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IHNwYWNlVHlwZTtcblxuICAgICAgICB0aGlzLl9zZXRDbGlwUGxhbmVzKGNhbWVyYS5uZWFyQ2xpcCwgY2FtZXJhLmZhckNsaXApO1xuXG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gbWFrZVhSQ29tcGF0aWJsZVxuICAgICAgICAvLyBzY2VuYXJpbyB0byB0ZXN0OlxuICAgICAgICAvLyAxLiBhcHAgaXMgcnVubmluZyBvbiBpbnRlZ3JhdGVkIEdQVVxuICAgICAgICAvLyAyLiBYUiBkZXZpY2UgaXMgY29ubmVjdGVkLCB0byBhbm90aGVyIEdQVVxuICAgICAgICAvLyAzLiBwcm9iYWJseSBpbW1lcnNpdmUtdnIgd2lsbCBmYWlsIHRvIGJlIGNyZWF0ZWRcbiAgICAgICAgLy8gNC4gY2FsbCBtYWtlWFJDb21wYXRpYmxlLCB2ZXJ5IGxpa2VseSB3aWxsIGxlYWQgdG8gY29udGV4dCBsb3NzXG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHtcbiAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXM6IFtzcGFjZVR5cGVdLFxuICAgICAgICAgICAgb3B0aW9uYWxGZWF0dXJlczogW11cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gWFJUWVBFX0FSKSB7XG4gICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnbGlnaHQtZXN0aW1hdGlvbicpO1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hpdC10ZXN0Jyk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW1hZ2VUcmFja2luZyAmJiB0aGlzLmltYWdlVHJhY2tpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnaW1hZ2UtdHJhY2tpbmcnKTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnBsYW5lRGV0ZWN0aW9uKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgncGxhbmUtZGV0ZWN0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmRvbU92ZXJsYXkuc3VwcG9ydGVkICYmIHRoaXMuZG9tT3ZlcmxheS5yb290KSB7XG4gICAgICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2RvbS1vdmVybGF5Jyk7XG4gICAgICAgICAgICAgICAgb3B0cy5kb21PdmVybGF5ID0geyByb290OiB0aGlzLmRvbU92ZXJsYXkucm9vdCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoU2Vuc2luZyAmJiB0aGlzLmRlcHRoU2Vuc2luZy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRzLm9wdGlvbmFsRmVhdHVyZXMucHVzaCgnZGVwdGgtc2Vuc2luZycpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXNhZ2VQcmVmZXJlbmNlID0gW1hSREVQVEhTRU5TSU5HVVNBR0VfQ1BVXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRm9ybWF0UHJlZmVyZW5jZSA9IFtYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4XTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmRlcHRoU2Vuc2luZy51c2FnZVByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gdXNhZ2VQcmVmZXJlbmNlLmluZGV4T2Yob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHVzYWdlUHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2VQcmVmZXJlbmNlLnVuc2hpZnQob3B0aW9ucy5kZXB0aFNlbnNpbmcudXNhZ2VQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kZXB0aFNlbnNpbmcuZGF0YUZvcm1hdFByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZGF0YUZvcm1hdFByZWZlcmVuY2UuaW5kZXhPZihvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmQgIT09IC0xKSBkYXRhRm9ybWF0UHJlZmVyZW5jZS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZvcm1hdFByZWZlcmVuY2UudW5zaGlmdChvcHRpb25zLmRlcHRoU2Vuc2luZy5kYXRhRm9ybWF0UHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb3B0cy5kZXB0aFNlbnNpbmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIHVzYWdlUHJlZmVyZW5jZTogdXNhZ2VQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhRm9ybWF0UHJlZmVyZW5jZTogZGF0YUZvcm1hdFByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFhSVFlQRV9WUikge1xuICAgICAgICAgICAgb3B0cy5vcHRpb25hbEZlYXR1cmVzLnB1c2goJ2hhbmQtdHJhY2tpbmcnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMub3B0aW9uYWxGZWF0dXJlcylcbiAgICAgICAgICAgIG9wdHMub3B0aW9uYWxGZWF0dXJlcyA9IG9wdHMub3B0aW9uYWxGZWF0dXJlcy5jb25jYXQob3B0aW9ucy5vcHRpb25hbEZlYXR1cmVzKTtcblxuICAgICAgICBpZiAodGhpcy5pbWFnZVRyYWNraW5nLnN1cHBvcnRlZCAmJiB0aGlzLmltYWdlVHJhY2tpbmcuaW1hZ2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnByZXBhcmVJbWFnZXMoKGVyciwgdHJhY2tlZEltYWdlcykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0cmFja2VkSW1hZ2VzICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICBvcHRzLnRyYWNrZWRJbWFnZXMgPSB0cmFja2VkSW1hZ2VzO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS5cbiAgICAgKiBAcGFyYW0geyp9IG9wdGlvbnMgLSBTZXNzaW9uIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtYckVycm9yQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRXJyb3IgY2FsbGJhY2suXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TdGFydE9wdGlvbnNSZWFkeSh0eXBlLCBzcGFjZVR5cGUsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG5hdmlnYXRvci54ci5yZXF1ZXN0U2Vzc2lvbih0eXBlLCBvcHRpb25zKS50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9jYW1lcmEuY2FtZXJhLnhyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2NhbWVyYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3NwYWNlVHlwZSA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gZW5kIFhSIHNlc3Npb24gYW5kIG9wdGlvbmFsbHkgZmlyZXMgY2FsbGJhY2sgd2hlbiBzZXNzaW9uIGlzIGVuZGVkIG9yIGZhaWxlZCB0b1xuICAgICAqIGVuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7WHJFcnJvckNhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2Ugc2Vzc2lvbiBpc1xuICAgICAqIHN0YXJ0ZWQuIFRoZSBjYWxsYmFjayBoYXMgb25lIGFyZ3VtZW50IEVycm9yIC0gaXQgaXMgbnVsbCBpZiBzdWNjZXNzZnVsbHkgc3RhcnRlZCBYUlxuICAgICAqIHNlc3Npb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIGlmIChldnQua2V5ID09PSBwYy5LRVlfRVNDQVBFICYmIGFwcC54ci5hY3RpdmUpIHtcbiAgICAgKiAgICAgICAgIGFwcC54ci5lbmQoKTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGVuZChjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBpbml0aWFsaXplZCcpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYWxsYmFjaykgdGhpcy5vbmNlKCdlbmQnLCBjYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbi5lbmQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzcGVjaWZpYyB0eXBlIG9mIHNlc3Npb24gaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBTZXNzaW9uIHR5cGUuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9JTkxJTkV9OiBJbmxpbmUgLSBhbHdheXMgYXZhaWxhYmxlIHR5cGUgb2Ygc2Vzc2lvbi4gSXQgaGFzIGxpbWl0ZWQgZmVhdHVyZXNcbiAgICAgKiBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkIGludG8gSFRNTCBlbGVtZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVFlQRV9WUn06IEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoXG4gICAgICogYmVzdCBhdmFpbGFibGUgdHJhY2tpbmcgZmVhdHVyZXMuXG4gICAgICogLSB7QGxpbmsgWFJUWVBFX0FSfTogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlXG4gICAgICogdGhhdCBpcyBpbnRlbmRlZCB0byBiZSBibGVuZGVkIHdpdGggcmVhbC13b3JsZCBlbnZpcm9ubWVudC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKGFwcC54ci5pc0F2YWlsYWJsZShwYy5YUlRZUEVfVlIpKSB7XG4gICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAqIH1cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzcGVjaWZpZWQgc2Vzc2lvbiB0eXBlIGlzIGF2YWlsYWJsZS5cbiAgICAgKi9cbiAgICBpc0F2YWlsYWJsZSh0eXBlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdmFpbGFibGVbdHlwZV07XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb25TdXBwb3J0Q2hlY2soa2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gU2Vzc2lvbiB0eXBlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Nlc3Npb25TdXBwb3J0Q2hlY2sodHlwZSkge1xuICAgICAgICBuYXZpZ2F0b3IueHIuaXNTZXNzaW9uU3VwcG9ydGVkKHR5cGUpLnRoZW4oKGF2YWlsYWJsZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2F2YWlsYWJsZVt0eXBlXSA9PT0gYXZhaWxhYmxlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlW3R5cGVdID0gYXZhaWxhYmxlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGUnLCB0eXBlLCBhdmFpbGFibGUpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdhdmFpbGFibGU6JyArIHR5cGUsIGF2YWlsYWJsZSk7XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUlNlc3Npb259IHNlc3Npb24gLSBYUiBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcGFjZVR5cGUgLSBTcGFjZSB0eXBlIHRvIHJlcXVlc3QgZm9yIHRoZSBzZXNzaW9uLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgdG8gY2FsbCB3aGVuIHNlc3Npb24gaXMgc3RhcnRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vblNlc3Npb25TdGFydChzZXNzaW9uLCBzcGFjZVR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCBmYWlsZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblxuICAgICAgICBjb25zdCBvblZpc2liaWxpdHlDaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3Zpc2liaWxpdHk6Y2hhbmdlJywgc2Vzc2lvbi52aXNpYmlsaXR5U3RhdGUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9uQ2xpcFBsYW5lc0NoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldENsaXBQbGFuZXModGhpcy5fY2FtZXJhLm5lYXJDbGlwLCB0aGlzLl9jYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gY2xlYW4gdXAgb25jZSBzZXNzaW9uIGlzIGVuZGVkXG4gICAgICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYS5vZmYoJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLm9mZignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS54ciA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XG4gICAgICAgICAgICBzZXNzaW9uLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvblZpc2liaWxpdHlDaGFuZ2UpO1xuXG4gICAgICAgICAgICBpZiAoIWZhaWxlZCkgdGhpcy5maXJlKCdlbmQnKTtcblxuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnZpZXdzID0gW107XG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IDA7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSAwO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9zcGFjZVR5cGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZCcsIG9uRW5kKTtcbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgb25WaXNpYmlsaXR5Q2hhbmdlKTtcblxuICAgICAgICB0aGlzLl9jYW1lcmEub24oJ3NldF9uZWFyQ2xpcCcsIG9uQ2xpcFBsYW5lc0NoYW5nZSk7XG4gICAgICAgIHRoaXMuX2NhbWVyYS5vbignc2V0X2ZhckNsaXAnLCBvbkNsaXBQbGFuZXNDaGFuZ2UpO1xuXG4gICAgICAgIHRoaXMuX2Jhc2VMYXllciA9IG5ldyBYUldlYkdMTGF5ZXIoc2Vzc2lvbiwgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UuZ2wsIHtcbiAgICAgICAgICAgIGFscGhhOiB0cnVlLFxuICAgICAgICAgICAgZGVwdGg6IHRydWUsXG4gICAgICAgICAgICBzdGVuY2lsOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlc3Npb24udXBkYXRlUmVuZGVyU3RhdGUoe1xuICAgICAgICAgICAgYmFzZUxheWVyOiB0aGlzLl9iYXNlTGF5ZXIsXG4gICAgICAgICAgICBkZXB0aE5lYXI6IHRoaXMuX2RlcHRoTmVhcixcbiAgICAgICAgICAgIGRlcHRoRmFyOiB0aGlzLl9kZXB0aEZhclxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZXF1ZXN0IHJlZmVyZW5jZSBzcGFjZVxuICAgICAgICBzZXNzaW9uLnJlcXVlc3RSZWZlcmVuY2VTcGFjZShzcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9yZWZlcmVuY2VTcGFjZSA9IHJlZmVyZW5jZVNwYWNlO1xuXG4gICAgICAgICAgICAvLyBvbGQgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHdpbGwgbmV2ZXIgYmUgdHJpZ2dlcmVkLFxuICAgICAgICAgICAgLy8gc28gcXVldWUgdXAgbmV3IHRpY2tcbiAgICAgICAgICAgIHRoaXMuYXBwLnRpY2soKTtcblxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnc3RhcnQnKTtcbiAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgc2Vzc2lvbi5lbmQoKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgLSBOZWFyIHBsYW5lIGRpc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYXIgLSBGYXIgcGxhbmUgZGlzdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0Q2xpcFBsYW5lcyhuZWFyLCBmYXIpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlcHRoTmVhciA9PT0gbmVhciAmJiB0aGlzLl9kZXB0aEZhciA9PT0gZmFyKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2RlcHRoTmVhciA9IG5lYXI7XG4gICAgICAgIHRoaXMuX2RlcHRoRmFyID0gZmFyO1xuXG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBpZiBzZXNzaW9uIGlzIGF2YWlsYWJsZSxcbiAgICAgICAgLy8gcXVldWUgdXAgcmVuZGVyIHN0YXRlIHVwZGF0ZVxuICAgICAgICB0aGlzLl9zZXNzaW9uLnVwZGF0ZVJlbmRlclN0YXRlKHtcbiAgICAgICAgICAgIGRlcHRoTmVhcjogdGhpcy5fZGVwdGhOZWFyLFxuICAgICAgICAgICAgZGVwdGhGYXI6IHRoaXMuX2RlcHRoRmFyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdXBkYXRlIHdhcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBjYW52YXMgcmVzb2x1dGlvbiBzaG91bGQgYmUgc2V0IG9uIGZpcnN0IGZyYW1lIGF2YWlsYWJpbGl0eSBvciByZXNvbHV0aW9uIGNoYW5nZXNcbiAgICAgICAgY29uc3Qgd2lkdGggPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlcldpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlckhlaWdodDtcbiAgICAgICAgaWYgKHRoaXMuX3dpZHRoICE9PSB3aWR0aCB8fCB0aGlzLl9oZWlnaHQgIT09IGhlaWdodCkge1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLnNldFJlc29sdXRpb24od2lkdGgsIGhlaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwb3NlID0gZnJhbWUuZ2V0Vmlld2VyUG9zZSh0aGlzLl9yZWZlcmVuY2VTcGFjZSk7XG5cbiAgICAgICAgaWYgKCFwb3NlKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgbGVuZ3RoTmV3ID0gcG9zZS52aWV3cy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGxlbmd0aE5ldyA+IHRoaXMudmlld3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBhZGQgbmV3IHZpZXdzIGludG8gbGlzdFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gKGxlbmd0aE5ldyAtIHRoaXMudmlld3MubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IHZpZXcgPSB0aGlzLnZpZXdzUG9vbC5wb3AoKTtcbiAgICAgICAgICAgICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdwb3J0OiBuZXcgVmVjNCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvak1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2aWV3T2ZmTWF0OiBuZXcgTWF0NCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmlld0ludk1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdJbnZPZmZNYXQ6IG5ldyBNYXQ0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qVmlld09mZk1hdDogbmV3IE1hdDQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdNYXQzOiBuZXcgTWF0MygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IG5ldyBGbG9hdDMyQXJyYXkoMyksXG4gICAgICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogbmV3IFF1YXQoKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMudmlld3MucHVzaCh2aWV3KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChsZW5ndGhOZXcgPD0gdGhpcy52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSB2aWV3cyBmcm9tIGxpc3QgaW50byBwb29sXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8ICh0aGlzLnZpZXdzLmxlbmd0aCAtIGxlbmd0aE5ldyk7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMudmlld3NQb29sLnB1c2godGhpcy52aWV3cy5wb3AoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXNldCBwb3NpdGlvblxuICAgICAgICBjb25zdCBwb3NlUG9zaXRpb24gPSBwb3NlLnRyYW5zZm9ybS5wb3NpdGlvbjtcbiAgICAgICAgY29uc3QgcG9zZU9yaWVudGF0aW9uID0gcG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb247XG4gICAgICAgIHRoaXMuX2xvY2FsUG9zaXRpb24uc2V0KHBvc2VQb3NpdGlvbi54LCBwb3NlUG9zaXRpb24ueSwgcG9zZVBvc2l0aW9uLnopO1xuICAgICAgICB0aGlzLl9sb2NhbFJvdGF0aW9uLnNldChwb3NlT3JpZW50YXRpb24ueCwgcG9zZU9yaWVudGF0aW9uLnksIHBvc2VPcmllbnRhdGlvbi56LCBwb3NlT3JpZW50YXRpb24udyk7XG5cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllcjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvc2Uudmlld3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8vIGZvciBlYWNoIHZpZXcsIGNhbGN1bGF0ZSBtYXRyaWNlc1xuICAgICAgICAgICAgY29uc3Qgdmlld1JhdyA9IHBvc2Uudmlld3NbaV07XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy52aWV3c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHZpZXdwb3J0ID0gbGF5ZXIuZ2V0Vmlld3BvcnQodmlld1Jhdyk7XG5cbiAgICAgICAgICAgIHZpZXcudmlld3BvcnQueCA9IHZpZXdwb3J0Lng7XG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LnkgPSB2aWV3cG9ydC55O1xuICAgICAgICAgICAgdmlldy52aWV3cG9ydC56ID0gdmlld3BvcnQud2lkdGg7XG4gICAgICAgICAgICB2aWV3LnZpZXdwb3J0LncgPSB2aWV3cG9ydC5oZWlnaHQ7XG5cbiAgICAgICAgICAgIHZpZXcucHJvak1hdC5zZXQodmlld1Jhdy5wcm9qZWN0aW9uTWF0cml4KTtcbiAgICAgICAgICAgIHZpZXcudmlld01hdC5zZXQodmlld1Jhdy50cmFuc2Zvcm0uaW52ZXJzZS5tYXRyaXgpO1xuICAgICAgICAgICAgdmlldy52aWV3SW52TWF0LnNldCh2aWV3UmF3LnRyYW5zZm9ybS5tYXRyaXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zaXRpb24gYW5kIHJvdGF0ZSBjYW1lcmEgYmFzZWQgb24gY2FsY3VsYXRlZCB2ZWN0b3JzXG4gICAgICAgIHRoaXMuX2NhbWVyYS5jYW1lcmEuX25vZGUuc2V0TG9jYWxQb3NpdGlvbih0aGlzLl9sb2NhbFBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5fY2FtZXJhLmNhbWVyYS5fbm9kZS5zZXRMb2NhbFJvdGF0aW9uKHRoaXMuX2xvY2FsUm90YXRpb24pO1xuXG4gICAgICAgIHRoaXMuaW5wdXQudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gWFJUWVBFX0FSKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5oaXRUZXN0LnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmhpdFRlc3QudXBkYXRlKGZyYW1lKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMubGlnaHRFc3RpbWF0aW9uLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0RXN0aW1hdGlvbi51cGRhdGUoZnJhbWUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kZXB0aFNlbnNpbmcuc3VwcG9ydGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhTZW5zaW5nLnVwZGF0ZShmcmFtZSwgcG9zZSAmJiBwb3NlLnZpZXdzWzBdKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW1hZ2VUcmFja2luZy5zdXBwb3J0ZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5pbWFnZVRyYWNraW5nLnVwZGF0ZShmcmFtZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnBsYW5lRGV0ZWN0aW9uLnN1cHBvcnRlZClcbiAgICAgICAgICAgICAgICB0aGlzLnBsYW5lRGV0ZWN0aW9uLnVwZGF0ZShmcmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3VwZGF0ZScsIGZyYW1lKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIFhSIGlzIHN1cHBvcnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBzdXBwb3J0ZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdXBwb3J0ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBYUiBzZXNzaW9uIGlzIHJ1bm5pbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgYWN0aXZlKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9zZXNzaW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHlwZSBvZiBjdXJyZW50bHkgcnVubmluZyBYUiBzZXNzaW9uIG9yIG51bGwgaWYgbm8gc2Vzc2lvbiBpcyBydW5uaW5nLiBDYW4gYmUgYW55IG9mXG4gICAgICogWFJUWVBFXyouXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgcmVmZXJlbmNlIHNwYWNlIHR5cGUgb2YgY3VycmVudGx5IHJ1bm5pbmcgWFIgc2Vzc2lvbiBvciBudWxsIGlmIG5vIHNlc3Npb24gaXNcbiAgICAgKiBydW5uaW5nLiBDYW4gYmUgYW55IG9mIFhSU1BBQ0VfKi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgc3BhY2VUeXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3BhY2VUeXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGVzIGFjY2VzcyB0byBYUlNlc3Npb24gb2YgV2ViWFIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fG51bGx9XG4gICAgICovXG4gICAgZ2V0IHNlc3Npb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zZXNzaW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFjdGl2ZSBjYW1lcmEgZm9yIHdoaWNoIFhSIHNlc3Npb24gaXMgcnVubmluZyBvciBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge0VudGl0eXxudWxsfVxuICAgICAqL1xuICAgIGdldCBjYW1lcmEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYW1lcmEgPyB0aGlzLl9jYW1lcmEuZW50aXR5IDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmRpY2F0ZXMgd2hldGhlciBXZWJYUiBjb250ZW50IGlzIGN1cnJlbnRseSB2aXNpYmxlIHRvIHRoZSB1c2VyLCBhbmQgaWYgaXQgaXMsIHdoZXRoZXIgaXQnc1xuICAgICAqIHRoZSBwcmltYXJ5IGZvY3VzLiBDYW4gYmUgJ2hpZGRlbicsICd2aXNpYmxlJyBvciAndmlzaWJsZS1ibHVycmVkJy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB2aXNpYmlsaXR5U3RhdGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9zZXNzaW9uLnZpc2liaWxpdHlTdGF0ZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyTWFuYWdlciB9O1xuIl0sIm5hbWVzIjpbIlhyTWFuYWdlciIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXBwIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIm5hdmlnYXRvciIsInhyIiwiX2F2YWlsYWJsZSIsIl90eXBlIiwiX3NwYWNlVHlwZSIsIl9zZXNzaW9uIiwiX2Jhc2VMYXllciIsIl9yZWZlcmVuY2VTcGFjZSIsImRlcHRoU2Vuc2luZyIsImRvbU92ZXJsYXkiLCJoaXRUZXN0IiwiaW1hZ2VUcmFja2luZyIsInBsYW5lRGV0ZWN0aW9uIiwiaW5wdXQiLCJsaWdodEVzdGltYXRpb24iLCJfY2FtZXJhIiwidmlld3MiLCJ2aWV3c1Bvb2wiLCJfbG9jYWxQb3NpdGlvbiIsIlZlYzMiLCJfbG9jYWxSb3RhdGlvbiIsIlF1YXQiLCJfZGVwdGhOZWFyIiwiX2RlcHRoRmFyIiwiX3dpZHRoIiwiX2hlaWdodCIsIlhSVFlQRV9JTkxJTkUiLCJYUlRZUEVfVlIiLCJYUlRZUEVfQVIiLCJYckRlcHRoU2Vuc2luZyIsIlhyRG9tT3ZlcmxheSIsIlhySGl0VGVzdCIsIlhySW1hZ2VUcmFja2luZyIsIlhyUGxhbmVEZXRlY3Rpb24iLCJYcklucHV0IiwiWHJMaWdodEVzdGltYXRpb24iLCJhZGRFdmVudExpc3RlbmVyIiwiX2RldmljZUF2YWlsYWJpbGl0eUNoZWNrIiwiZGVzdHJveSIsInN0YXJ0IiwiY2FtZXJhIiwidHlwZSIsInNwYWNlVHlwZSIsIm9wdGlvbnMiLCJjYWxsYmFjayIsIkVycm9yIiwiX3NldENsaXBQbGFuZXMiLCJuZWFyQ2xpcCIsImZhckNsaXAiLCJvcHRzIiwicmVxdWlyZWRGZWF0dXJlcyIsIm9wdGlvbmFsRmVhdHVyZXMiLCJwdXNoIiwic3VwcG9ydGVkIiwicm9vdCIsInVzYWdlUHJlZmVyZW5jZSIsIlhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVIiwiZGF0YUZvcm1hdFByZWZlcmVuY2UiLCJYUkRFUFRIU0VOU0lOR0ZPUk1BVF9MOEE4IiwiaW5kIiwiaW5kZXhPZiIsInNwbGljZSIsInVuc2hpZnQiLCJjb25jYXQiLCJpbWFnZXMiLCJsZW5ndGgiLCJwcmVwYXJlSW1hZ2VzIiwiZXJyIiwidHJhY2tlZEltYWdlcyIsImZpcmUiLCJfb25TdGFydE9wdGlvbnNSZWFkeSIsInJlcXVlc3RTZXNzaW9uIiwidGhlbiIsInNlc3Npb24iLCJfb25TZXNzaW9uU3RhcnQiLCJjYXRjaCIsImV4IiwiZW5kIiwib25jZSIsImlzQXZhaWxhYmxlIiwia2V5IiwiX3Nlc3Npb25TdXBwb3J0Q2hlY2siLCJpc1Nlc3Npb25TdXBwb3J0ZWQiLCJhdmFpbGFibGUiLCJmYWlsZWQiLCJvblZpc2liaWxpdHlDaGFuZ2UiLCJ2aXNpYmlsaXR5U3RhdGUiLCJvbkNsaXBQbGFuZXNDaGFuZ2UiLCJvbkVuZCIsIm9mZiIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJ0aWNrIiwib24iLCJYUldlYkdMTGF5ZXIiLCJncmFwaGljc0RldmljZSIsImdsIiwiYWxwaGEiLCJkZXB0aCIsInN0ZW5jaWwiLCJ1cGRhdGVSZW5kZXJTdGF0ZSIsImJhc2VMYXllciIsImRlcHRoTmVhciIsImRlcHRoRmFyIiwicmVxdWVzdFJlZmVyZW5jZVNwYWNlIiwicmVmZXJlbmNlU3BhY2UiLCJuZWFyIiwiZmFyIiwidXBkYXRlIiwiZnJhbWUiLCJ3aWR0aCIsInJlbmRlclN0YXRlIiwiZnJhbWVidWZmZXJXaWR0aCIsImhlaWdodCIsImZyYW1lYnVmZmVySGVpZ2h0Iiwic2V0UmVzb2x1dGlvbiIsInBvc2UiLCJnZXRWaWV3ZXJQb3NlIiwibGVuZ3RoTmV3IiwiaSIsInZpZXciLCJwb3AiLCJ2aWV3cG9ydCIsIlZlYzQiLCJwcm9qTWF0IiwiTWF0NCIsInZpZXdNYXQiLCJ2aWV3T2ZmTWF0Iiwidmlld0ludk1hdCIsInZpZXdJbnZPZmZNYXQiLCJwcm9qVmlld09mZk1hdCIsInZpZXdNYXQzIiwiTWF0MyIsInBvc2l0aW9uIiwiRmxvYXQzMkFycmF5Iiwicm90YXRpb24iLCJwb3NlUG9zaXRpb24iLCJ0cmFuc2Zvcm0iLCJwb3NlT3JpZW50YXRpb24iLCJvcmllbnRhdGlvbiIsInNldCIsIngiLCJ5IiwieiIsInciLCJsYXllciIsInZpZXdSYXciLCJnZXRWaWV3cG9ydCIsInByb2plY3Rpb25NYXRyaXgiLCJpbnZlcnNlIiwibWF0cml4IiwiX25vZGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwic2V0TG9jYWxSb3RhdGlvbiIsImFjdGl2ZSIsImVudGl0eSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBa0NBLE1BQU1BLFNBQVMsU0FBU0MsWUFBWSxDQUFDOztFQW9LakNDLFdBQVcsQ0FBQ0MsR0FBRyxFQUFFO0FBQ2IsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQUFDLElBQUEsSUFBQSxDQWhLWkEsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUFNSEMsQ0FBQUEsVUFBVSxHQUFHQyxRQUFRLENBQUNDLE9BQU8sSUFBSSxDQUFDLENBQUNDLFNBQVMsQ0FBQ0MsRUFBRSxDQUFBO0lBQUEsSUFNL0NDLENBQUFBLFVBQVUsR0FBRyxFQUFFLENBQUE7SUFBQSxJQU1mQyxDQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNWkMsQ0FBQUEsVUFBVSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWpCQyxDQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNZkMsQ0FBQUEsVUFBVSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWpCQyxDQUFBQSxlQUFlLEdBQUcsSUFBSSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUXRCQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FR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
