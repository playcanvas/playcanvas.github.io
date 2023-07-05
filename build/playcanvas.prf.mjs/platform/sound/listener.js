import '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';

class Listener {
	constructor(manager) {
		this._manager = manager;
		this.position = new Vec3();
		this.velocity = new Vec3();
		this.orientation = new Mat4();
	}
	getPosition() {
		return this.position;
	}
	setPosition(position) {
		this.position.copy(position);
		const listener = this.listener;
		if (listener) {
			if ('positionX' in listener) {
				listener.positionX.value = position.x;
				listener.positionY.value = position.y;
				listener.positionZ.value = position.z;
			} else if (listener.setPosition) {
				listener.setPosition(position.x, position.y, position.z);
			}
		}
	}
	getVelocity() {
		return this.velocity;
	}
	setVelocity(velocity) {}
	setOrientation(orientation) {
		this.orientation.copy(orientation);
		const listener = this.listener;
		if (listener) {
			const m = orientation.data;
			if ('forwardX' in listener) {
				listener.forwardX.value = -m[8];
				listener.forwardY.value = -m[9];
				listener.forwardZ.value = -m[10];
				listener.upX.value = m[4];
				listener.upY.value = m[5];
				listener.upZ.value = m[6];
			} else if (listener.setOrientation) {
				listener.setOrientation(-m[8], -m[9], -m[10], m[4], m[5], m[6]);
			}
		}
	}
	getOrientation() {
		return this.orientation;
	}
	get listener() {
		const context = this._manager.context;
		return context ? context.listener : null;
	}
}

export { Listener };
