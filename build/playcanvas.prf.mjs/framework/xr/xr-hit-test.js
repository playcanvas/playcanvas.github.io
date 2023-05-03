import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XRTYPE_AR, XRSPACE_VIEWER } from './constants.js';
import { XrHitTestSource } from './xr-hit-test-source.js';

class XrHitTest extends EventHandler {
	constructor(manager) {
		super();
		this.manager = void 0;
		this._supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);
		this._session = null;
		this.sources = [];
		this.manager = manager;
		if (this._supported) {
			this.manager.on('start', this._onSessionStart, this);
			this.manager.on('end', this._onSessionEnd, this);
		}
	}
	_onSessionStart() {
		if (this.manager.type !== XRTYPE_AR) return;
		this._session = this.manager.session;
	}
	_onSessionEnd() {
		if (!this._session) return;
		this._session = null;
		for (let i = 0; i < this.sources.length; i++) {
			this.sources[i].onStop();
		}
		this.sources = [];
	}
	isAvailable(callback, fireError) {
		let err;
		if (!this._supported) err = new Error('XR HitTest is not supported');
		if (!this._session) err = new Error('XR Session is not started (1)');
		if (this.manager.type !== XRTYPE_AR) err = new Error('XR HitTest is available only for AR');
		if (err) {
			if (callback) callback(err);
			if (fireError) fireError.fire('error', err);
			return false;
		}
		return true;
	}
	start(options = {}) {
		if (!this.isAvailable(options.callback, this)) return;
		if (!options.profile && !options.spaceType) options.spaceType = XRSPACE_VIEWER;
		let xrRay;
		const offsetRay = options.offsetRay;
		if (offsetRay) {
			const origin = new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z, 1.0);
			const direction = new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z, 0.0);
			xrRay = new XRRay(origin, direction);
		}
		const callback = options.callback;
		if (options.spaceType) {
			this._session.requestReferenceSpace(options.spaceType).then(referenceSpace => {
				if (!this._session) {
					const err = new Error('XR Session is not started (2)');
					if (callback) callback(err);
					this.fire('error', err);
					return;
				}
				this._session.requestHitTestSource({
					space: referenceSpace,
					entityTypes: options.entityTypes || undefined,
					offsetRay: xrRay
				}).then(xrHitTestSource => {
					this._onHitTestSource(xrHitTestSource, false, callback);
				}).catch(ex => {
					if (callback) callback(ex);
					this.fire('error', ex);
				});
			}).catch(ex => {
				if (callback) callback(ex);
				this.fire('error', ex);
			});
		} else {
			this._session.requestHitTestSourceForTransientInput({
				profile: options.profile,
				entityTypes: options.entityTypes || undefined,
				offsetRay: xrRay
			}).then(xrHitTestSource => {
				this._onHitTestSource(xrHitTestSource, true, callback);
			}).catch(ex => {
				if (callback) callback(ex);
				this.fire('error', ex);
			});
		}
	}
	_onHitTestSource(xrHitTestSource, transient, callback) {
		if (!this._session) {
			xrHitTestSource.cancel();
			const err = new Error('XR Session is not started (3)');
			if (callback) callback(err);
			this.fire('error', err);
			return;
		}
		const hitTestSource = new XrHitTestSource(this.manager, xrHitTestSource, transient);
		this.sources.push(hitTestSource);
		if (callback) callback(null, hitTestSource);
		this.fire('add', hitTestSource);
	}
	update(frame) {
		for (let i = 0; i < this.sources.length; i++) {
			this.sources[i].update(frame);
		}
	}
	get supported() {
		return this._supported;
	}
}

export { XrHitTest };
