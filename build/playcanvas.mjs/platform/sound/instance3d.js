import '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { DISTANCE_LINEAR, DISTANCE_INVERSE, DISTANCE_EXPONENTIAL } from '../audio/constants.js';
import { hasAudioContext } from '../audio/capabilities.js';
import { SoundInstance } from './instance.js';

const MAX_DISTANCE = 10000;
class SoundInstance3d extends SoundInstance {
	constructor(manager, sound, options = {}) {
		super(manager, sound, options);
		this._position = new Vec3();
		this._velocity = new Vec3();
		if (options.position) this.position = options.position;
		this.maxDistance = options.maxDistance !== undefined ? Number(options.maxDistance) : MAX_DISTANCE;
		this.refDistance = options.refDistance !== undefined ? Number(options.refDistance) : 1;
		this.rollOffFactor = options.rollOffFactor !== undefined ? Number(options.rollOffFactor) : 1;
		this.distanceModel = options.distanceModel !== undefined ? options.distanceModel : DISTANCE_LINEAR;
	}
	_initializeNodes() {
		this.gain = this._manager.context.createGain();
		this.panner = this._manager.context.createPanner();
		this.panner.connect(this.gain);
		this._inputNode = this.panner;
		this._connectorNode = this.gain;
		this._connectorNode.connect(this._manager.context.destination);
	}
	set position(value) {
		this._position.copy(value);
		const panner = this.panner;
		if ('positionX' in panner) {
			panner.positionX.value = value.x;
			panner.positionY.value = value.y;
			panner.positionZ.value = value.z;
		} else if (panner.setPosition) {
			panner.setPosition(value.x, value.y, value.z);
		}
	}
	get position() {
		return this._position;
	}
	set velocity(velocity) {
		this._velocity.copy(velocity);
	}
	get velocity() {
		return this._velocity;
	}
	set maxDistance(value) {
		this.panner.maxDistance = value;
	}
	get maxDistance() {
		return this.panner.maxDistance;
	}
	set refDistance(value) {
		this.panner.refDistance = value;
	}
	get refDistance() {
		return this.panner.refDistance;
	}
	set rollOffFactor(value) {
		this.panner.rolloffFactor = value;
	}
	get rollOffFactor() {
		return this.panner.rolloffFactor;
	}
	set distanceModel(value) {
		this.panner.distanceModel = value;
	}
	get distanceModel() {
		return this.panner.distanceModel;
	}
}
if (!hasAudioContext()) {
	let offset = new Vec3();
	const fallOff = function fallOff(posOne, posTwo, refDistance, maxDistance, rollOffFactor, distanceModel) {
		offset = offset.sub2(posOne, posTwo);
		const distance = offset.length();
		if (distance < refDistance) {
			return 1;
		} else if (distance > maxDistance) {
			return 0;
		}
		let result = 0;
		if (distanceModel === DISTANCE_LINEAR) {
			result = 1 - rollOffFactor * (distance - refDistance) / (maxDistance - refDistance);
		} else if (distanceModel === DISTANCE_INVERSE) {
			result = refDistance / (refDistance + rollOffFactor * (distance - refDistance));
		} else if (distanceModel === DISTANCE_EXPONENTIAL) {
			result = Math.pow(distance / refDistance, -rollOffFactor);
		}
		return math.clamp(result, 0, 1);
	};
	Object.defineProperty(SoundInstance3d.prototype, 'position', {
		get: function () {
			return this._position;
		},
		set: function (position) {
			this._position.copy(position);
			if (this.source) {
				const listener = this._manager.listener;
				const lpos = listener.getPosition();
				const factor = fallOff(lpos, this._position, this.refDistance, this.maxDistance, this.rollOffFactor, this.distanceModel);
				const v = this.volume;
				this.source.volume = v * factor * this._manager.volume;
			}
		}
	});
	Object.defineProperty(SoundInstance3d.prototype, 'maxDistance', {
		get: function () {
			return this._maxDistance;
		},
		set: function (value) {
			this._maxDistance = value;
		}
	});
	Object.defineProperty(SoundInstance3d.prototype, 'refDistance', {
		get: function () {
			return this._refDistance;
		},
		set: function (value) {
			this._refDistance = value;
		}
	});
	Object.defineProperty(SoundInstance3d.prototype, 'rollOffFactor', {
		get: function () {
			return this._rollOffFactor;
		},
		set: function (value) {
			this._rollOffFactor = value;
		}
	});
	Object.defineProperty(SoundInstance3d.prototype, 'distanceModel', {
		get: function () {
			return this._distanceModel;
		},
		set: function (value) {
			this._distanceModel = value;
		}
	});
}

export { SoundInstance3d };
