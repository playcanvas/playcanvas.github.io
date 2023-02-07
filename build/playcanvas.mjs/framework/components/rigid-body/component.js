import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYGROUP_STATIC, BODYMASK_NOT_STATIC, BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_KINEMATIC, BODYMASK_ALL, BODYGROUP_DYNAMIC, BODYFLAG_KINEMATIC_OBJECT, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from './constants.js';
import { Component } from '../component.js';

let _ammoTransform;
let _ammoVec1, _ammoVec2, _ammoQuat;
const _quat1 = new Quat();
const _quat2 = new Quat();
const _vec3 = new Vec3();
class RigidBodyComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._angularDamping = 0;
		this._angularFactor = new Vec3(1, 1, 1);
		this._angularVelocity = new Vec3();
		this._body = null;
		this._friction = 0.5;
		this._group = BODYGROUP_STATIC;
		this._linearDamping = 0;
		this._linearFactor = new Vec3(1, 1, 1);
		this._linearVelocity = new Vec3();
		this._mask = BODYMASK_NOT_STATIC;
		this._mass = 1;
		this._restitution = 0;
		this._rollingFriction = 0;
		this._simulationEnabled = false;
		this._type = BODYTYPE_STATIC;
	}
	static onLibraryLoaded() {
		if (typeof Ammo !== 'undefined') {
			_ammoTransform = new Ammo.btTransform();
			_ammoVec1 = new Ammo.btVector3();
			_ammoVec2 = new Ammo.btVector3();
			_ammoQuat = new Ammo.btQuaternion();
		}
	}
	set angularDamping(damping) {
		if (this._angularDamping !== damping) {
			this._angularDamping = damping;
			if (this._body) {
				this._body.setDamping(this._linearDamping, damping);
			}
		}
	}
	get angularDamping() {
		return this._angularDamping;
	}
	set angularFactor(factor) {
		if (!this._angularFactor.equals(factor)) {
			this._angularFactor.copy(factor);
			if (this._body && this._type === BODYTYPE_DYNAMIC) {
				_ammoVec1.setValue(factor.x, factor.y, factor.z);
				this._body.setAngularFactor(_ammoVec1);
			}
		}
	}
	get angularFactor() {
		return this._angularFactor;
	}
	set angularVelocity(velocity) {
		if (this._body && this._type === BODYTYPE_DYNAMIC) {
			this._body.activate();
			_ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
			this._body.setAngularVelocity(_ammoVec1);
			this._angularVelocity.copy(velocity);
		}
	}
	get angularVelocity() {
		if (this._body && this._type === BODYTYPE_DYNAMIC) {
			const velocity = this._body.getAngularVelocity();
			this._angularVelocity.set(velocity.x(), velocity.y(), velocity.z());
		}
		return this._angularVelocity;
	}
	set body(body) {
		if (this._body !== body) {
			this._body = body;
			if (body && this._simulationEnabled) {
				body.activate();
			}
		}
	}
	get body() {
		return this._body;
	}
	set friction(friction) {
		if (this._friction !== friction) {
			this._friction = friction;
			if (this._body) {
				this._body.setFriction(friction);
			}
		}
	}
	get friction() {
		return this._friction;
	}
	set group(group) {
		if (this._group !== group) {
			this._group = group;
			if (this.enabled && this.entity.enabled) {
				this.disableSimulation();
				this.enableSimulation();
			}
		}
	}
	get group() {
		return this._group;
	}
	set linearDamping(damping) {
		if (this._linearDamping !== damping) {
			this._linearDamping = damping;
			if (this._body) {
				this._body.setDamping(damping, this._angularDamping);
			}
		}
	}
	get linearDamping() {
		return this._linearDamping;
	}
	set linearFactor(factor) {
		if (!this._linearFactor.equals(factor)) {
			this._linearFactor.copy(factor);
			if (this._body && this._type === BODYTYPE_DYNAMIC) {
				_ammoVec1.setValue(factor.x, factor.y, factor.z);
				this._body.setLinearFactor(_ammoVec1);
			}
		}
	}
	get linearFactor() {
		return this._linearFactor;
	}
	set linearVelocity(velocity) {
		if (this._body && this._type === BODYTYPE_DYNAMIC) {
			this._body.activate();
			_ammoVec1.setValue(velocity.x, velocity.y, velocity.z);
			this._body.setLinearVelocity(_ammoVec1);
			this._linearVelocity.copy(velocity);
		}
	}
	get linearVelocity() {
		if (this._body && this._type === BODYTYPE_DYNAMIC) {
			const velocity = this._body.getLinearVelocity();
			this._linearVelocity.set(velocity.x(), velocity.y(), velocity.z());
		}
		return this._linearVelocity;
	}
	set mask(mask) {
		if (this._mask !== mask) {
			this._mask = mask;
			if (this.enabled && this.entity.enabled) {
				this.disableSimulation();
				this.enableSimulation();
			}
		}
	}
	get mask() {
		return this._mask;
	}
	set mass(mass) {
		if (this._mass !== mass) {
			this._mass = mass;
			if (this._body && this._type === BODYTYPE_DYNAMIC) {
				const enabled = this.enabled && this.entity.enabled;
				if (enabled) {
					this.disableSimulation();
				}
				this._body.getCollisionShape().calculateLocalInertia(mass, _ammoVec1);
				this._body.setMassProps(mass, _ammoVec1);
				this._body.updateInertiaTensor();
				if (enabled) {
					this.enableSimulation();
				}
			}
		}
	}
	get mass() {
		return this._mass;
	}
	set restitution(restitution) {
		if (this._restitution !== restitution) {
			this._restitution = restitution;
			if (this._body) {
				this._body.setRestitution(restitution);
			}
		}
	}
	get restitution() {
		return this._restitution;
	}
	set rollingFriction(friction) {
		if (this._rollingFriction !== friction) {
			this._rollingFriction = friction;
			if (this._body) {
				this._body.setRollingFriction(friction);
			}
		}
	}
	get rollingFriction() {
		return this._rollingFriction;
	}
	set type(type) {
		if (this._type !== type) {
			this._type = type;
			this.disableSimulation();
			switch (type) {
				case BODYTYPE_DYNAMIC:
					this._group = BODYGROUP_DYNAMIC;
					this._mask = BODYMASK_ALL;
					break;
				case BODYTYPE_KINEMATIC:
					this._group = BODYGROUP_KINEMATIC;
					this._mask = BODYMASK_ALL;
					break;
				case BODYTYPE_STATIC:
				default:
					this._group = BODYGROUP_STATIC;
					this._mask = BODYMASK_NOT_STATIC;
					break;
			}
			this.createBody();
		}
	}
	get type() {
		return this._type;
	}
	createBody() {
		const entity = this.entity;
		let shape;
		if (entity.collision) {
			shape = entity.collision.shape;
			if (entity.trigger) {
				entity.trigger.destroy();
				delete entity.trigger;
			}
		}
		if (shape) {
			if (this._body) this.system.onRemove(entity, this);
			const mass = this._type === BODYTYPE_DYNAMIC ? this._mass : 0;
			this._getEntityTransform(_ammoTransform);
			const body = this.system.createBody(mass, shape, _ammoTransform);
			body.setRestitution(this._restitution);
			body.setFriction(this._friction);
			body.setRollingFriction(this._rollingFriction);
			body.setDamping(this._linearDamping, this._angularDamping);
			if (this._type === BODYTYPE_DYNAMIC) {
				const linearFactor = this._linearFactor;
				_ammoVec1.setValue(linearFactor.x, linearFactor.y, linearFactor.z);
				body.setLinearFactor(_ammoVec1);
				const angularFactor = this._angularFactor;
				_ammoVec1.setValue(angularFactor.x, angularFactor.y, angularFactor.z);
				body.setAngularFactor(_ammoVec1);
			} else if (this._type === BODYTYPE_KINEMATIC) {
				body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_KINEMATIC_OBJECT);
				body.setActivationState(BODYSTATE_DISABLE_DEACTIVATION);
			}
			body.entity = entity;
			this.body = body;
			if (this.enabled && entity.enabled) {
				this.enableSimulation();
			}
		}
	}
	isActive() {
		return this._body ? this._body.isActive() : false;
	}
	activate() {
		if (this._body) {
			this._body.activate();
		}
	}
	enableSimulation() {
		const entity = this.entity;
		if (entity.collision && entity.collision.enabled && !this._simulationEnabled) {
			const body = this._body;
			if (body) {
				this.system.addBody(body, this._group, this._mask);
				switch (this._type) {
					case BODYTYPE_DYNAMIC:
						this.system._dynamic.push(this);
						body.forceActivationState(BODYSTATE_ACTIVE_TAG);
						this.syncEntityToBody();
						break;
					case BODYTYPE_KINEMATIC:
						this.system._kinematic.push(this);
						body.forceActivationState(BODYSTATE_DISABLE_DEACTIVATION);
						break;
					case BODYTYPE_STATIC:
						body.forceActivationState(BODYSTATE_ACTIVE_TAG);
						this.syncEntityToBody();
						break;
				}
				if (entity.collision.type === 'compound') {
					this.system._compounds.push(entity.collision);
				}
				body.activate();
				this._simulationEnabled = true;
			}
		}
	}
	disableSimulation() {
		const body = this._body;
		if (body && this._simulationEnabled) {
			const system = this.system;
			let idx = system._compounds.indexOf(this.entity.collision);
			if (idx > -1) {
				system._compounds.splice(idx, 1);
			}
			idx = system._dynamic.indexOf(this);
			if (idx > -1) {
				system._dynamic.splice(idx, 1);
			}
			idx = system._kinematic.indexOf(this);
			if (idx > -1) {
				system._kinematic.splice(idx, 1);
			}
			system.removeBody(body);
			body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
			this._simulationEnabled = false;
		}
	}
	applyForce(x, y, z, px, py, pz) {
		const body = this._body;
		if (body) {
			body.activate();
			if (x instanceof Vec3) {
				_ammoVec1.setValue(x.x, x.y, x.z);
			} else {
				_ammoVec1.setValue(x, y, z);
			}
			if (y instanceof Vec3) {
				_ammoVec2.setValue(y.x, y.y, y.z);
			} else if (px !== undefined) {
				_ammoVec2.setValue(px, py, pz);
			} else {
				_ammoVec2.setValue(0, 0, 0);
			}
			body.applyForce(_ammoVec1, _ammoVec2);
		}
	}
	applyTorque(x, y, z) {
		const body = this._body;
		if (body) {
			body.activate();
			if (x instanceof Vec3) {
				_ammoVec1.setValue(x.x, x.y, x.z);
			} else {
				_ammoVec1.setValue(x, y, z);
			}
			body.applyTorque(_ammoVec1);
		}
	}
	applyImpulse(x, y, z, px, py, pz) {
		const body = this._body;
		if (body) {
			body.activate();
			if (x instanceof Vec3) {
				_ammoVec1.setValue(x.x, x.y, x.z);
			} else {
				_ammoVec1.setValue(x, y, z);
			}
			if (y instanceof Vec3) {
				_ammoVec2.setValue(y.x, y.y, y.z);
			} else if (px !== undefined) {
				_ammoVec2.setValue(px, py, pz);
			} else {
				_ammoVec2.setValue(0, 0, 0);
			}
			body.applyImpulse(_ammoVec1, _ammoVec2);
		}
	}
	applyTorqueImpulse(x, y, z) {
		const body = this._body;
		if (body) {
			body.activate();
			if (x instanceof Vec3) {
				_ammoVec1.setValue(x.x, x.y, x.z);
			} else {
				_ammoVec1.setValue(x, y, z);
			}
			body.applyTorqueImpulse(_ammoVec1);
		}
	}
	isStatic() {
		return this._type === BODYTYPE_STATIC;
	}
	isStaticOrKinematic() {
		return this._type === BODYTYPE_STATIC || this._type === BODYTYPE_KINEMATIC;
	}
	isKinematic() {
		return this._type === BODYTYPE_KINEMATIC;
	}
	_getEntityTransform(transform) {
		const entity = this.entity;
		const component = entity.collision;
		if (component) {
			const bodyPos = component.getShapePosition();
			const bodyRot = component.getShapeRotation();
			_ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
			_ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
		} else {
			const pos = entity.getPosition();
			const rot = entity.getRotation();
			_ammoVec1.setValue(pos.x, pos.y, pos.z);
			_ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
		}
		transform.setOrigin(_ammoVec1);
		transform.setRotation(_ammoQuat);
	}
	syncEntityToBody() {
		const body = this._body;
		if (body) {
			this._getEntityTransform(_ammoTransform);
			body.setWorldTransform(_ammoTransform);
			if (this._type === BODYTYPE_KINEMATIC) {
				const motionState = body.getMotionState();
				if (motionState) {
					motionState.setWorldTransform(_ammoTransform);
				}
			}
			body.activate();
		}
	}
	_updateDynamic() {
		const body = this._body;
		if (body.isActive()) {
			const motionState = body.getMotionState();
			if (motionState) {
				const entity = this.entity;
				motionState.getWorldTransform(_ammoTransform);
				const p = _ammoTransform.getOrigin();
				const q = _ammoTransform.getRotation();
				const component = entity.collision;
				if (component && component._hasOffset) {
					const lo = component.data.linearOffset;
					const ao = component.data.angularOffset;
					const invertedAo = _quat2.copy(ao).invert();
					const entityRot = _quat1.set(q.x(), q.y(), q.z(), q.w()).mul(invertedAo);
					entityRot.transformVector(lo, _vec3);
					entity.setPosition(p.x() - _vec3.x, p.y() - _vec3.y, p.z() - _vec3.z);
					entity.setRotation(entityRot);
				} else {
					entity.setPosition(p.x(), p.y(), p.z());
					entity.setRotation(q.x(), q.y(), q.z(), q.w());
				}
			}
		}
	}
	_updateKinematic() {
		const motionState = this._body.getMotionState();
		if (motionState) {
			this._getEntityTransform(_ammoTransform);
			motionState.setWorldTransform(_ammoTransform);
		}
	}
	teleport(x, y, z, rx, ry, rz) {
		if (x instanceof Vec3) {
			this.entity.setPosition(x);
		} else {
			this.entity.setPosition(x, y, z);
		}
		if (y instanceof Quat) {
			this.entity.setRotation(y);
		} else if (y instanceof Vec3) {
			this.entity.setEulerAngles(y);
		} else if (rx !== undefined) {
			this.entity.setEulerAngles(rx, ry, rz);
		}
		this.syncEntityToBody();
	}
	onEnable() {
		if (!this._body) {
			this.createBody();
		}
		this.enableSimulation();
	}
	onDisable() {
		this.disableSimulation();
	}
}

export { RigidBodyComponent };
