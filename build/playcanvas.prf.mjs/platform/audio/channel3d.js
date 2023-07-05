import '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { DISTANCE_INVERSE, DISTANCE_LINEAR, DISTANCE_EXPONENTIAL } from './constants.js';
import { hasAudioContext } from './capabilities.js';
import { Channel } from './channel.js';

const MAX_DISTANCE = 10000;
class Channel3d extends Channel {
	constructor(manager, sound, options) {
		super(manager, sound, options);
		this.position = new Vec3();
		this.velocity = new Vec3();
		if (hasAudioContext()) {
			this.panner = manager.context.createPanner();
		} else {
			this.maxDistance = MAX_DISTANCE;
			this.minDistance = 1;
			this.rollOffFactor = 1;
			this.distanceModel = DISTANCE_INVERSE;
		}
	}
	getPosition() {
		return this.position;
	}
	setPosition(position) {
		this.position.copy(position);
		const panner = this.panner;
		if ('positionX' in panner) {
			panner.positionX.value = position.x;
			panner.positionY.value = position.y;
			panner.positionZ.value = position.z;
		} else if (panner.setPosition) {
			panner.setPosition(position.x, position.y, position.z);
		}
	}
	getVelocity() {
		return this.velocity;
	}
	setVelocity(velocity) {
		this.velocity.copy(velocity);
	}
	getMaxDistance() {
		return this.panner.maxDistance;
	}
	setMaxDistance(max) {
		this.panner.maxDistance = max;
	}
	getMinDistance() {
		return this.panner.refDistance;
	}
	setMinDistance(min) {
		this.panner.refDistance = min;
	}
	getRollOffFactor() {
		return this.panner.rolloffFactor;
	}
	setRollOffFactor(factor) {
		this.panner.rolloffFactor = factor;
	}
	getDistanceModel() {
		return this.panner.distanceModel;
	}
	setDistanceModel(distanceModel) {
		this.panner.distanceModel = distanceModel;
	}
	_createSource() {
		const context = this.manager.context;
		this.source = context.createBufferSource();
		this.source.buffer = this.sound.buffer;
		this.source.connect(this.panner);
		this.panner.connect(this.gain);
		this.gain.connect(context.destination);
		if (!this.loop) {
			this.source.onended = this.pause.bind(this);
		}
	}
}
if (!hasAudioContext()) {
	let offset = new Vec3();
	const fallOff = function fallOff(posOne, posTwo, refDistance, maxDistance, rolloffFactor, distanceModel) {
		offset = offset.sub2(posOne, posTwo);
		const distance = offset.length();
		if (distance < refDistance) {
			return 1;
		} else if (distance > maxDistance) {
			return 0;
		}
		let result = 0;
		if (distanceModel === DISTANCE_LINEAR) {
			result = 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance);
		} else if (distanceModel === DISTANCE_INVERSE) {
			result = refDistance / (refDistance + rolloffFactor * (distance - refDistance));
		} else if (distanceModel === DISTANCE_EXPONENTIAL) {
			result = Math.pow(distance / refDistance, -rolloffFactor);
		}
		return math.clamp(result, 0, 1);
	};
	Object.assign(Channel3d.prototype, {
		setPosition: function (position) {
			this.position.copy(position);
			if (this.source) {
				const listener = this.manager.listener;
				const lpos = listener.getPosition();
				const factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor, this.distanceModel);
				const v = this.getVolume();
				this.source.volume = v * factor;
			}
		},
		getMaxDistance: function () {
			return this.maxDistance;
		},
		setMaxDistance: function (max) {
			this.maxDistance = max;
		},
		getMinDistance: function () {
			return this.minDistance;
		},
		setMinDistance: function (min) {
			this.minDistance = min;
		},
		getRollOffFactor: function () {
			return this.rollOffFactor;
		},
		setRollOffFactor: function (factor) {
			this.rollOffFactor = factor;
		},
		getDistanceModel: function () {
			return this.distanceModel;
		},
		setDistanceModel: function (distanceModel) {
			this.distanceModel = distanceModel;
		}
	});
}

export { Channel3d };
