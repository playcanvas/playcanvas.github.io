import { path } from '../../core/path.js';
import '../../core/debug.js';
import { Http, http } from '../../platform/net/http.js';
import { hasAudioContext } from '../../platform/audio/capabilities.js';
import { Sound } from '../../platform/sound/sound.js';

const ie = function () {
	if (typeof window === 'undefined') {
		return false;
	}
	const ua = window.navigator.userAgent;
	const msie = ua.indexOf('MSIE ');
	if (msie > 0) {
		return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
	}
	const trident = ua.indexOf('Trident/');
	if (trident > 0) {
		const rv = ua.indexOf('rv:');
		return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
	}
	return false;
}();
const supportedExtensions = ['.ogg', '.mp3', '.wav', '.mp4a', '.m4a', '.mp4', '.aac', '.opus'];
class AudioHandler {
	constructor(app) {
		this.handlerType = "audio";
		this.manager = app.soundManager;
		this.maxRetries = 0;
	}
	_isSupported(url) {
		const ext = path.getExtension(url);
		return supportedExtensions.indexOf(ext) > -1;
	}
	load(url, callback) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		const success = function success(resource) {
			callback(null, new Sound(resource));
		};
		const error = function error(err) {
			let msg = 'Error loading audio url: ' + url.original;
			if (err) {
				msg += ': ' + (err.message || err);
			}
			console.warn(msg);
			callback(msg);
		};
		if (this._createSound) {
			if (!this._isSupported(url.original)) {
				error(`Audio format for ${url.original} not supported`);
				return;
			}
			this._createSound(url.load, success, error);
		} else {
			error(null);
		}
	}
	open(url, data) {
		return data;
	}
	patch(asset, assets) {}
	_createSound(url, success, error) {
		if (hasAudioContext()) {
			const manager = this.manager;
			if (!manager.context) {
				error('Audio manager has no audio context');
				return;
			}
			const options = {
				retry: this.maxRetries > 0,
				maxRetries: this.maxRetries
			};
			if (url.startsWith('blob:') || url.startsWith('data:')) {
				options.responseType = Http.ResponseType.ARRAY_BUFFER;
			}
			http.get(url, options, function (err, response) {
				if (err) {
					error(err);
					return;
				}
				manager.context.decodeAudioData(response, success, error);
			});
		} else {
			let audio = null;
			try {
				audio = new Audio();
			} catch (e) {
				error('No support for Audio element');
				return;
			}
			if (ie) {
				document.body.appendChild(audio);
			}
			const onReady = function onReady() {
				audio.removeEventListener('canplaythrough', onReady);
				if (ie) {
					document.body.removeChild(audio);
				}
				success(audio);
			};
			audio.onerror = function () {
				audio.onerror = null;
				if (ie) {
					document.body.removeChild(audio);
				}
				error();
			};
			audio.addEventListener('canplaythrough', onReady);
			audio.src = url;
		}
	}
}

export { AudioHandler };
