import '../../core/debug.js';
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
		while (lengthNew < this.views.length) {
			this.viewsPool.push(this.views.pop());
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
