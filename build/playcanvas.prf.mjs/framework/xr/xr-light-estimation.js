import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { XRTYPE_AR } from './constants.js';

const vec3A = new Vec3();
const vec3B = new Vec3();
const mat4A = new Mat4();
const mat4B = new Mat4();
class XrLightEstimation extends EventHandler {
	constructor(manager) {
		super();
		this._manager = void 0;
		this._supported = false;
		this._available = false;
		this._lightProbeRequested = false;
		this._lightProbe = null;
		this._intensity = 0;
		this._rotation = new Quat();
		this._color = new Color();
		this._sphericalHarmonics = new Float32Array(27);
		this._manager = manager;
		this._manager.on('start', this._onSessionStart, this);
		this._manager.on('end', this._onSessionEnd, this);
	}
	_onSessionStart() {
		const supported = !!this._manager.session.requestLightProbe;
		if (!supported) return;
		this._supported = true;
	}
	_onSessionEnd() {
		this._supported = false;
		this._available = false;
		this._lightProbeRequested = false;
		this._lightProbe = null;
	}
	start() {
		let err;
		if (!this._manager.session) err = new Error('XR session is not running');
		if (!err && this._manager.type !== XRTYPE_AR) err = new Error('XR session type is not AR');
		if (!err && !this._supported) err = new Error('light-estimation is not supported');
		if (!err && this._lightProbe || this._lightProbeRequested) err = new Error('light estimation is already requested');
		if (err) {
			this.fire('error', err);
			return;
		}
		this._lightProbeRequested = true;
		this._manager.session.requestLightProbe().then(lightProbe => {
			const wasRequested = this._lightProbeRequested;
			this._lightProbeRequested = false;
			if (this._manager.active) {
				if (wasRequested) {
					this._lightProbe = lightProbe;
				}
			} else {
				this.fire('error', new Error('XR session is not active'));
			}
		}).catch(ex => {
			this._lightProbeRequested = false;
			this.fire('error', ex);
		});
	}
	end() {
		this._lightProbeRequested = false;
		this._lightProbe = null;
		this._available = false;
	}
	update(frame) {
		if (!this._lightProbe) return;
		const lightEstimate = frame.getLightEstimate(this._lightProbe);
		if (!lightEstimate) return;
		if (!this._available) {
			this._available = true;
			this.fire('available');
		}
		const pli = lightEstimate.primaryLightIntensity;
		this._intensity = Math.max(1.0, Math.max(pli.x, Math.max(pli.y, pli.z)));
		vec3A.copy(pli).mulScalar(1 / this._intensity);
		this._color.set(vec3A.x, vec3A.y, vec3A.z);
		vec3A.set(0, 0, 0);
		vec3B.copy(lightEstimate.primaryLightDirection);
		mat4A.setLookAt(vec3B, vec3A, Vec3.UP);
		mat4B.setFromAxisAngle(Vec3.RIGHT, 90);
		mat4A.mul(mat4B);
		this._rotation.setFromMat4(mat4A);
		this._sphericalHarmonics.set(lightEstimate.sphericalHarmonicsCoefficients);
	}
	get supported() {
		return this._supported;
	}
	get available() {
		return this._available;
	}
	get intensity() {
		return this._available ? this._intensity : null;
	}
	get color() {
		return this._available ? this._color : null;
	}
	get rotation() {
		return this._available ? this._rotation : null;
	}
	get sphericalHarmonics() {
		return this._available ? this._sphericalHarmonics : null;
	}
}

export { XrLightEstimation };
