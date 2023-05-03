import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrTrackedImage } from './xr-tracked-image.js';

class XrImageTracking extends EventHandler {
	constructor(manager) {
		super();
		this._manager = void 0;
		this._supported = platform.browser && !!window.XRImageTrackingResult;
		this._available = false;
		this._images = [];
		this._manager = manager;
		if (this._supported) {
			this._manager.on('start', this._onSessionStart, this);
			this._manager.on('end', this._onSessionEnd, this);
		}
	}
	add(image, width) {
		if (!this._supported || this._manager.active) return null;
		const trackedImage = new XrTrackedImage(image, width);
		this._images.push(trackedImage);
		return trackedImage;
	}
	remove(trackedImage) {
		if (this._manager.active) return;
		const ind = this._images.indexOf(trackedImage);
		if (ind !== -1) {
			trackedImage.destroy();
			this._images.splice(ind, 1);
		}
	}
	_onSessionStart() {
		this._manager.session.getTrackedImageScores().then(images => {
			this._available = true;
			for (let i = 0; i < images.length; i++) {
				this._images[i]._trackable = images[i] === 'trackable';
			}
		}).catch(err => {
			this._available = false;
			this.fire('error', err);
		});
	}
	_onSessionEnd() {
		this._available = false;
		for (let i = 0; i < this._images.length; i++) {
			const image = this._images[i];
			image._pose = null;
			image._measuredWidth = 0;
			if (image._tracking) {
				image._tracking = false;
				image.fire('untracked');
			}
		}
	}
	prepareImages(callback) {
		if (this._images.length) {
			Promise.all(this._images.map(function (trackedImage) {
				return trackedImage.prepare();
			})).then(function (bitmaps) {
				callback(null, bitmaps);
			}).catch(function (err) {
				callback(err, null);
			});
		} else {
			callback(null, null);
		}
	}
	update(frame) {
		if (!this._available) return;
		const results = frame.getImageTrackingResults();
		const index = {};
		for (let i = 0; i < results.length; i++) {
			index[results[i].index] = results[i];
			const trackedImage = this._images[results[i].index];
			trackedImage._emulated = results[i].trackingState === 'emulated';
			trackedImage._measuredWidth = results[i].measuredWidthInMeters;
			trackedImage._pose = frame.getPose(results[i].imageSpace, this._manager._referenceSpace);
		}
		for (let i = 0; i < this._images.length; i++) {
			if (this._images[i]._tracking && !index[i]) {
				this._images[i]._tracking = false;
				this._images[i].fire('untracked');
			} else if (!this._images[i]._tracking && index[i]) {
				this._images[i]._tracking = true;
				this._images[i].fire('tracked');
			}
		}
	}
	get supported() {
		return this._supported;
	}
	get available() {
		return this._available;
	}
	get images() {
		return this._images;
	}
}

export { XrImageTracking };
