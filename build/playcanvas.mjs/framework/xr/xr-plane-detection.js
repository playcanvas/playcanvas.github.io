import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrPlane } from './xr-plane.js';

class XrPlaneDetection extends EventHandler {
	constructor(manager) {
		super();
		this._manager = void 0;
		this._supported = platform.browser && !!window.XRPlane;
		this._available = false;
		this._planesIndex = new Map();
		this._planes = null;
		this._manager = manager;
		if (this._supported) {
			this._manager.on('end', this._onSessionEnd, this);
		}
	}
	_onSessionEnd() {
		if (this._planes) {
			for (let i = 0; i < this._planes.length; i++) {
				this._planes[i].destroy();
			}
		}
		this._planesIndex.clear();
		this._planes = null;
		if (this._available) {
			this._available = false;
			this.fire('unavailable');
		}
	}
	update(frame) {
		let detectedPlanes;
		if (!this._available) {
			try {
				detectedPlanes = frame.detectedPlanes;
				this._planes = [];
				this._available = true;
				this.fire('available');
			} catch (ex) {
				return;
			}
		} else {
			detectedPlanes = frame.detectedPlanes;
		}
		for (const [xrPlane, plane] of this._planesIndex) {
			if (detectedPlanes.has(xrPlane)) continue;
			this._planesIndex.delete(xrPlane);
			this._planes.splice(this._planes.indexOf(plane), 1);
			plane.destroy();
			this.fire('remove', plane);
		}
		for (const xrPlane of detectedPlanes) {
			let plane = this._planesIndex.get(xrPlane);
			if (!plane) {
				plane = new XrPlane(this, xrPlane);
				this._planesIndex.set(xrPlane, plane);
				this._planes.push(plane);
				plane.update(frame);
				this.fire('add', plane);
			} else {
				plane.update(frame);
			}
		}
	}
	get supported() {
		return this._supported;
	}
	get available() {
		return this._available;
	}
	get planes() {
		return this._planes;
	}
}

export { XrPlaneDetection };
