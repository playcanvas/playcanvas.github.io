/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';
import '../../../core/tracing.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { BODYFLAG_NORESPONSE_OBJECT } from './constants.js';
import { RigidBodyComponent } from './component.js';
import { RigidBodyComponentData } from './data.js';

let ammoRayStart, ammoRayEnd;
class RaycastResult {
	constructor(entity, point, normal) {
		this.entity = entity;
		this.point = point;
		this.normal = normal;
	}
}
class SingleContactResult {
	constructor(a, b, contactPoint) {
		if (arguments.length === 0) {
			this.a = null;
			this.b = null;
			this.impulse = 0;
			this.localPointA = new Vec3();
			this.localPointB = new Vec3();
			this.pointA = new Vec3();
			this.pointB = new Vec3();
			this.normal = new Vec3();
		} else {
			this.a = a;
			this.b = b;
			this.impulse = contactPoint.impulse;
			this.localPointA = contactPoint.localPoint;
			this.localPointB = contactPoint.localPointOther;
			this.pointA = contactPoint.point;
			this.pointB = contactPoint.pointOther;
			this.normal = contactPoint.normal;
		}
	}
}
class ContactPoint {
	constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0) {
		this.localPoint = localPoint;
		this.localPointOther = localPointOther;
		this.point = point;
		this.pointOther = pointOther;
		this.normal = normal;
		this.impulse = impulse;
	}
}
class ContactResult {
	constructor(other, contacts) {
		this.other = other;
		this.contacts = contacts;
	}
}
const _schema = ['enabled'];
class RigidBodyComponentSystem extends ComponentSystem {
	constructor(app) {
		super(app);
		this.maxSubSteps = 10;
		this.fixedTimeStep = 1 / 60;
		this.gravity = new Vec3(0, -9.81, 0);
		this._gravityFloat32 = new Float32Array(3);
		this._dynamic = [];
		this._kinematic = [];
		this._triggers = [];
		this._compounds = [];
		this.id = 'rigidbody';
		this._stats = app.stats.frame;
		this.ComponentType = RigidBodyComponent;
		this.DataType = RigidBodyComponentData;
		this.contactPointPool = null;
		this.contactResultPool = null;
		this.singleContactResultPool = null;
		this.schema = _schema;
		this.collisions = {};
		this.frameCollisions = {};
		this.on('beforeremove', this.onBeforeRemove, this);
		this.on('remove', this.onRemove, this);
	}
	onLibraryLoaded() {
		if (typeof Ammo !== 'undefined') {
			this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
			this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
			this.overlappingPairCache = new Ammo.btDbvtBroadphase();
			this.solver = new Ammo.btSequentialImpulseConstraintSolver();
			this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);
			if (this.dynamicsWorld.setInternalTickCallback) {
				const checkForCollisionsPointer = Ammo.addFunction(this._checkForCollisions.bind(this), 'vif');
				this.dynamicsWorld.setInternalTickCallback(checkForCollisionsPointer);
			}
			ammoRayStart = new Ammo.btVector3();
			ammoRayEnd = new Ammo.btVector3();
			RigidBodyComponent.onLibraryLoaded();
			this.contactPointPool = new ObjectPool(ContactPoint, 1);
			this.contactResultPool = new ObjectPool(ContactResult, 1);
			this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);
			this.app.systems.on('update', this.onUpdate, this);
		} else {
			this.app.systems.off('update', this.onUpdate, this);
		}
	}
	initializeComponentData(component, data, properties) {
		const props = ['mass', 'linearDamping', 'angularDamping', 'linearFactor', 'angularFactor', 'friction', 'rollingFriction', 'restitution', 'type', 'group', 'mask'];
		for (const property of props) {
			if (data.hasOwnProperty(property)) {
				const value = data[property];
				if (Array.isArray(value)) {
					component[property] = new Vec3(value[0], value[1], value[2]);
				} else {
					component[property] = value;
				}
			}
		}
		super.initializeComponentData(component, data, ['enabled']);
	}
	cloneComponent(entity, clone) {
		const rigidbody = entity.rigidbody;
		const data = {
			enabled: rigidbody.enabled,
			mass: rigidbody.mass,
			linearDamping: rigidbody.linearDamping,
			angularDamping: rigidbody.angularDamping,
			linearFactor: [rigidbody.linearFactor.x, rigidbody.linearFactor.y, rigidbody.linearFactor.z],
			angularFactor: [rigidbody.angularFactor.x, rigidbody.angularFactor.y, rigidbody.angularFactor.z],
			friction: rigidbody.friction,
			rollingFriction: rigidbody.rollingFriction,
			restitution: rigidbody.restitution,
			type: rigidbody.type,
			group: rigidbody.group,
			mask: rigidbody.mask
		};
		return this.addComponent(clone, data);
	}
	onBeforeRemove(entity, component) {
		if (component.enabled) {
			component.enabled = false;
		}
	}
	onRemove(entity, component) {
		const body = component.body;
		if (body) {
			this.removeBody(body);
			this.destroyBody(body);
			component.body = null;
		}
	}
	addBody(body, group, mask) {
		if (group !== undefined && mask !== undefined) {
			this.dynamicsWorld.addRigidBody(body, group, mask);
		} else {
			this.dynamicsWorld.addRigidBody(body);
		}
	}
	removeBody(body) {
		this.dynamicsWorld.removeRigidBody(body);
	}
	createBody(mass, shape, transform) {
		const localInertia = new Ammo.btVector3(0, 0, 0);
		if (mass !== 0) {
			shape.calculateLocalInertia(mass, localInertia);
		}
		const motionState = new Ammo.btDefaultMotionState(transform);
		const bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
		const body = new Ammo.btRigidBody(bodyInfo);
		Ammo.destroy(bodyInfo);
		Ammo.destroy(localInertia);
		return body;
	}
	destroyBody(body) {
		const motionState = body.getMotionState();
		if (motionState) {
			Ammo.destroy(motionState);
		}
		Ammo.destroy(body);
	}
	raycastFirst(start, end) {
		let result = null;
		ammoRayStart.setValue(start.x, start.y, start.z);
		ammoRayEnd.setValue(end.x, end.y, end.z);
		const rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);
		this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
		if (rayCallback.hasHit()) {
			const collisionObj = rayCallback.get_m_collisionObject();
			const body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
			if (body) {
				const point = rayCallback.get_m_hitPointWorld();
				const normal = rayCallback.get_m_hitNormalWorld();
				result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()));
				if (arguments.length > 2) {
					const callback = arguments[2];
					callback(result);
				}
			}
		}
		Ammo.destroy(rayCallback);
		return result;
	}
	raycastAll(start, end) {
		const results = [];
		ammoRayStart.setValue(start.x, start.y, start.z);
		ammoRayEnd.setValue(end.x, end.y, end.z);
		const rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);
		this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
		if (rayCallback.hasHit()) {
			const collisionObjs = rayCallback.get_m_collisionObjects();
			const points = rayCallback.get_m_hitPointWorld();
			const normals = rayCallback.get_m_hitNormalWorld();
			const numHits = collisionObjs.size();
			for (let i = 0; i < numHits; i++) {
				const body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);
				if (body) {
					const point = points.at(i);
					const normal = normals.at(i);
					const result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()));
					results.push(result);
				}
			}
		}
		Ammo.destroy(rayCallback);
		return results;
	}
	_storeCollision(entity, other) {
		let isNewCollision = false;
		const guid = entity.getGuid();
		this.collisions[guid] = this.collisions[guid] || {
			others: [],
			entity: entity
		};
		if (this.collisions[guid].others.indexOf(other) < 0) {
			this.collisions[guid].others.push(other);
			isNewCollision = true;
		}
		this.frameCollisions[guid] = this.frameCollisions[guid] || {
			others: [],
			entity: entity
		};
		this.frameCollisions[guid].others.push(other);
		return isNewCollision;
	}
	_createContactPointFromAmmo(contactPoint) {
		const localPointA = contactPoint.get_m_localPointA();
		const localPointB = contactPoint.get_m_localPointB();
		const positionWorldOnA = contactPoint.getPositionWorldOnA();
		const positionWorldOnB = contactPoint.getPositionWorldOnB();
		const normalWorldOnB = contactPoint.get_m_normalWorldOnB();
		const contact = this.contactPointPool.allocate();
		contact.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
		contact.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
		contact.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
		contact.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
		contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
		contact.impulse = contactPoint.getAppliedImpulse();
		return contact;
	}
	_createReverseContactPointFromAmmo(contactPoint) {
		const localPointA = contactPoint.get_m_localPointA();
		const localPointB = contactPoint.get_m_localPointB();
		const positionWorldOnA = contactPoint.getPositionWorldOnA();
		const positionWorldOnB = contactPoint.getPositionWorldOnB();
		const normalWorldOnB = contactPoint.get_m_normalWorldOnB();
		const contact = this.contactPointPool.allocate();
		contact.localPointOther.set(localPointA.x(), localPointA.y(), localPointA.z());
		contact.localPoint.set(localPointB.x(), localPointB.y(), localPointB.z());
		contact.pointOther.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
		contact.point.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
		contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
		contact.impulse = contactPoint.getAppliedImpulse();
		return contact;
	}
	_createSingleContactResult(a, b, contactPoint) {
		const result = this.singleContactResultPool.allocate();
		result.a = a;
		result.b = b;
		result.localPointA = contactPoint.localPoint;
		result.localPointB = contactPoint.localPointOther;
		result.pointA = contactPoint.point;
		result.pointB = contactPoint.pointOther;
		result.normal = contactPoint.normal;
		result.impulse = contactPoint.impulse;
		return result;
	}
	_createContactResult(other, contacts) {
		const result = this.contactResultPool.allocate();
		result.other = other;
		result.contacts = contacts;
		return result;
	}
	_cleanOldCollisions() {
		for (const guid in this.collisions) {
			if (this.collisions.hasOwnProperty(guid)) {
				const frameCollision = this.frameCollisions[guid];
				const collision = this.collisions[guid];
				const entity = collision.entity;
				const entityCollision = entity.collision;
				const entityRigidbody = entity.rigidbody;
				const others = collision.others;
				const length = others.length;
				let i = length;
				while (i--) {
					const other = others[i];
					if (!frameCollision || frameCollision.others.indexOf(other) < 0) {
						others.splice(i, 1);
						if (entity.trigger) {
							if (entityCollision) {
								entityCollision.fire('triggerleave', other);
							}
							if (other.rigidbody) {
								other.rigidbody.fire('triggerleave', entity);
							}
						} else if (!other.trigger) {
							if (entityRigidbody) {
								entityRigidbody.fire('collisionend', other);
							}
							if (entityCollision) {
								entityCollision.fire('collisionend', other);
							}
						}
					}
				}
				if (others.length === 0) {
					delete this.collisions[guid];
				}
			}
		}
	}
	_hasContactEvent(entity) {
		const c = entity.collision;
		if (c && (c.hasEvent('collisionstart') || c.hasEvent('collisionend') || c.hasEvent('contact'))) {
			return true;
		}
		const r = entity.rigidbody;
		return r && (r.hasEvent('collisionstart') || r.hasEvent('collisionend') || r.hasEvent('contact'));
	}
	_checkForCollisions(world, timeStep) {
		const dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);
		const dispatcher = dynamicsWorld.getDispatcher();
		const numManifolds = dispatcher.getNumManifolds();
		this.frameCollisions = {};
		for (let i = 0; i < numManifolds; i++) {
			const manifold = dispatcher.getManifoldByIndexInternal(i);
			const body0 = manifold.getBody0();
			const body1 = manifold.getBody1();
			const wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
			const wb1 = Ammo.castObject(body1, Ammo.btRigidBody);
			const e0 = wb0.entity;
			const e1 = wb1.entity;
			if (!e0 || !e1) {
				continue;
			}
			const flags0 = wb0.getCollisionFlags();
			const flags1 = wb1.getCollisionFlags();
			const numContacts = manifold.getNumContacts();
			const forwardContacts = [];
			const reverseContacts = [];
			let newCollision;
			if (numContacts > 0) {
				if (flags0 & BODYFLAG_NORESPONSE_OBJECT || flags1 & BODYFLAG_NORESPONSE_OBJECT) {
					const e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
					const e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
					const e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent('triggerenter') || e0.rigidbody.hasEvent('triggerleave'));
					const e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent('triggerenter') || e1.rigidbody.hasEvent('triggerleave'));
					if (e0Events) {
						newCollision = this._storeCollision(e0, e1);
						if (newCollision && !(flags1 & BODYFLAG_NORESPONSE_OBJECT)) {
							e0.collision.fire('triggerenter', e1);
						}
					}
					if (e1Events) {
						newCollision = this._storeCollision(e1, e0);
						if (newCollision && !(flags0 & BODYFLAG_NORESPONSE_OBJECT)) {
							e1.collision.fire('triggerenter', e0);
						}
					}
					if (e0BodyEvents) {
						if (!newCollision) {
							newCollision = this._storeCollision(e1, e0);
						}
						if (newCollision) {
							e0.rigidbody.fire('triggerenter', e1);
						}
					}
					if (e1BodyEvents) {
						if (!newCollision) {
							newCollision = this._storeCollision(e0, e1);
						}
						if (newCollision) {
							e1.rigidbody.fire('triggerenter', e0);
						}
					}
				} else {
					const e0Events = this._hasContactEvent(e0);
					const e1Events = this._hasContactEvent(e1);
					const globalEvents = this.hasEvent('contact');
					if (globalEvents || e0Events || e1Events) {
						for (let j = 0; j < numContacts; j++) {
							const btContactPoint = manifold.getContactPoint(j);
							const contactPoint = this._createContactPointFromAmmo(btContactPoint);
							if (e0Events || e1Events) {
								forwardContacts.push(contactPoint);
								const reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
								reverseContacts.push(reverseContactPoint);
							}
							if (globalEvents) {
								const result = this._createSingleContactResult(e0, e1, contactPoint);
								this.fire('contact', result);
							}
						}
						if (e0Events) {
							const forwardResult = this._createContactResult(e1, forwardContacts);
							newCollision = this._storeCollision(e0, e1);
							if (e0.collision) {
								e0.collision.fire('contact', forwardResult);
								if (newCollision) {
									e0.collision.fire('collisionstart', forwardResult);
								}
							}
							if (e0.rigidbody) {
								e0.rigidbody.fire('contact', forwardResult);
								if (newCollision) {
									e0.rigidbody.fire('collisionstart', forwardResult);
								}
							}
						}
						if (e1Events) {
							const reverseResult = this._createContactResult(e0, reverseContacts);
							newCollision = this._storeCollision(e1, e0);
							if (e1.collision) {
								e1.collision.fire('contact', reverseResult);
								if (newCollision) {
									e1.collision.fire('collisionstart', reverseResult);
								}
							}
							if (e1.rigidbody) {
								e1.rigidbody.fire('contact', reverseResult);
								if (newCollision) {
									e1.rigidbody.fire('collisionstart', reverseResult);
								}
							}
						}
					}
				}
			}
		}
		this._cleanOldCollisions();
		this.contactPointPool.freeAll();
		this.contactResultPool.freeAll();
		this.singleContactResultPool.freeAll();
	}
	onUpdate(dt) {
		let i, len;
		this._stats.physicsStart = now();
		this._gravityFloat32[0] = this.gravity.x;
		this._gravityFloat32[1] = this.gravity.y;
		this._gravityFloat32[2] = this.gravity.z;
		const gravity = this.dynamicsWorld.getGravity();
		if (gravity.x() !== this._gravityFloat32[0] || gravity.y() !== this._gravityFloat32[1] || gravity.z() !== this._gravityFloat32[2]) {
			gravity.setValue(this.gravity.x, this.gravity.y, this.gravity.z);
			this.dynamicsWorld.setGravity(gravity);
		}
		const triggers = this._triggers;
		for (i = 0, len = triggers.length; i < len; i++) {
			triggers[i].updateTransform();
		}
		const compounds = this._compounds;
		for (i = 0, len = compounds.length; i < len; i++) {
			compounds[i]._updateCompound();
		}
		const kinematic = this._kinematic;
		for (i = 0, len = kinematic.length; i < len; i++) {
			kinematic[i]._updateKinematic();
		}
		this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);
		const dynamic = this._dynamic;
		for (i = 0, len = dynamic.length; i < len; i++) {
			dynamic[i]._updateDynamic();
		}
		if (!this.dynamicsWorld.setInternalTickCallback) this._checkForCollisions(Ammo.getPointer(this.dynamicsWorld), dt);
		this._stats.physicsTime = now() - this._stats.physicsStart;
	}
	destroy() {
		super.destroy();
		this.app.systems.off('update', this.onUpdate, this);
		if (typeof Ammo !== 'undefined') {
			Ammo.destroy(this.dynamicsWorld);
			Ammo.destroy(this.solver);
			Ammo.destroy(this.overlappingPairCache);
			Ammo.destroy(this.dispatcher);
			Ammo.destroy(this.collisionConfiguration);
			this.dynamicsWorld = null;
			this.solver = null;
			this.overlappingPairCache = null;
			this.dispatcher = null;
			this.collisionConfiguration = null;
		}
	}
}
Component._buildAccessors(RigidBodyComponent.prototype, _schema);

export { ContactPoint, ContactResult, RaycastResult, RigidBodyComponentSystem, SingleContactResult };
