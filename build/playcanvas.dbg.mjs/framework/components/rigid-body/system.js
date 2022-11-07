/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';
import { Debug } from '../../../core/debug.js';
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
      } else {
        Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
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
          Debug.deprecated('pc.RigidBodyComponentSystem#rayCastFirst no longer requires a callback. The result of the raycast is returned by the function instead.');
          const callback = arguments[2];
          callback(result);
        }
      }
    }
    Ammo.destroy(rayCallback);
    return result;
  }

  raycastAll(start, end) {
    Debug.assert(Ammo.AllHitsRayResultCallback, 'pc.RigidBodyComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.');
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

    const gravity = this.dynamicsWorld.getGravity();
    if (gravity.x() !== this.gravity.x || gravity.y() !== this.gravity.y || gravity.z() !== this.gravity.z) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBBcHBCYXNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cblxubGV0IGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZDtcblxuLyoqXG4gKiBPYmplY3QgaG9sZGluZyB0aGUgcmVzdWx0IG9mIGEgc3VjY2Vzc2Z1bCByYXljYXN0IGhpdC5cbiAqL1xuY2xhc3MgUmF5Y2FzdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJheWNhc3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSB0aGF0IHdhcyBoaXQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb2ludCAtIFRoZSBwb2ludCBhdCB3aGljaCB0aGUgcmF5IGhpdCB0aGUgZW50aXR5IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gbm9ybWFsIC0gVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIHN1cmZhY2Ugd2hlcmUgdGhlIHJheSBoaXQgaW4gd29ybGQgc3BhY2UuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgcG9pbnQsIG5vcm1hbCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSB0aGF0IHdhcyBoaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IGF0IHdoaWNoIHRoZSByYXkgaGl0IHRoZSBlbnRpdHkgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgc3VyZmFjZSB3aGVyZSB0aGUgcmF5IGhpdCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLlxuICovXG5jbGFzcyBTaW5nbGVDb250YWN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2luZ2xlQ29udGFjdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBhIC0gVGhlIGZpcnN0IGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gYiAtIFRoZSBzZWNvbmQgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAqIEBwYXJhbSB7Q29udGFjdFBvaW50fSBjb250YWN0UG9pbnQgLSBUaGUgY29udGFjdCBwb2ludCBiZXR3ZWVuIHRoZSB0d28gZW50aXRpZXMuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGEsIGIsIGNvbnRhY3RQb2ludCkge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgZmlyc3QgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuYSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHNlY29uZCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5iID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3RcbiAgICAgICAgICAgICAqIHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIGJvZGllcyBjb2xsaWRlZC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmltcHVsc2UgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gQS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBCIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byBCLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRCID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEEgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnBvaW50QSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBCIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5wb2ludEIgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIEVudGl0eSBCLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5ub3JtYWwgPSBuZXcgVmVjMygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hID0gYTtcbiAgICAgICAgICAgIHRoaXMuYiA9IGI7XG4gICAgICAgICAgICB0aGlzLmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludE90aGVyO1xuICAgICAgICAgICAgdGhpcy5wb2ludEEgPSBjb250YWN0UG9pbnQucG9pbnQ7XG4gICAgICAgICAgICB0aGlzLnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICAgICAgdGhpcy5ub3JtYWwgPSBjb250YWN0UG9pbnQubm9ybWFsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIEVudGl0aWVzLlxuICovXG5jbGFzcyBDb250YWN0UG9pbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UG9pbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtsb2NhbFBvaW50XSAtIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbG9jYWxQb2ludE90aGVyXSAtIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLFxuICAgICAqIHJlbGF0aXZlIHRvIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50T3RoZXJdIC0gVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluXG4gICAgICogd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbm9ybWFsXSAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkXG4gICAgICogc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbXB1bHNlXSAtIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyXG4gICAgICogZHVyaW5nIHRoZSBsYXN0IHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIG9iamVjdHMgY29sbGlkZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9jYWxQb2ludCA9IG5ldyBWZWMzKCksIGxvY2FsUG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIHBvaW50ID0gbmV3IFZlYzMoKSwgcG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIG5vcm1hbCA9IG5ldyBWZWMzKCksIGltcHVsc2UgPSAwKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnQgPSBsb2NhbFBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnRPdGhlciA9IGxvY2FsUG9pbnRPdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnQgPSBwb2ludDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnRPdGhlciA9IHBvaW50T3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9ybWFsID0gbm9ybWFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3Qgc3ViLXN0ZXAuXG4gICAgICAgICAqIERlc2NyaWJlcyBob3cgaGFyZCB0d28gb2JqZWN0cyBjb2xsaWRlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXB1bHNlID0gaW1wdWxzZTtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gRW50aXRpZXMuXG4gKi9cbmNsYXNzIENvbnRhY3RSZXN1bHQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UmVzdWx0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IG90aGVyIC0gVGhlIGVudGl0eSB0aGF0IHdhcyBpbnZvbHZlZCBpbiB0aGUgY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7Q29udGFjdFBvaW50W119IGNvbnRhY3RzIC0gQW4gYXJyYXkgb2YgQ29udGFjdFBvaW50cyB3aXRoIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG90aGVyLCBjb250YWN0cykge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSB0aGF0IHdhcyBpbnZvbHZlZCBpbiB0aGUgY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RW50aXR5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vdGhlciA9IG90aGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbiBhcnJheSBvZiBDb250YWN0UG9pbnRzIHdpdGggdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbnRhY3RQb2ludFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb250YWN0cyA9IGNvbnRhY3RzO1xuICAgIH1cbn1cblxuY29uc3QgX3NjaGVtYSA9IFsnZW5hYmxlZCddO1xuXG4vKipcbiAqIFRoZSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gbWFpbnRhaW5zIHRoZSBkeW5hbWljcyB3b3JsZCBmb3Igc2ltdWxhdGluZyByaWdpZCBib2RpZXMsIGl0IGFsc29cbiAqIGNvbnRyb2xzIGdsb2JhbCB2YWx1ZXMgZm9yIHRoZSB3b3JsZCBzdWNoIGFzIGdyYXZpdHkuIE5vdGU6IFRoZSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gaXMgb25seVxuICogdmFsaWQgaWYgM0QgUGh5c2ljcyBpcyBlbmFibGVkIGluIHlvdXIgYXBwbGljYXRpb24uIFlvdSBjYW4gZW5hYmxlIHRoaXMgaW4gdGhlIGFwcGxpY2F0aW9uXG4gKiBzZXR0aW5ncyBmb3IgeW91ciBwcm9qZWN0LlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtYXhTdWJTdGVwcyA9IDEwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZml4ZWRUaW1lU3RlcCA9IDEgLyA2MDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbCBncmF2aXR5IGluIHRoZSBwaHlzaWNzIHNpbXVsYXRpb24uIERlZmF1bHRzIHRvXG4gICAgICogWzAsIC05LjgxLCAwXSB3aGljaCBpcyBhbiBhcHByb3hpbWF0aW9uIG9mIHRoZSBncmF2aXRhdGlvbmFsIGZvcmNlIG9uIEVhcnRoLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ3Jhdml0eSA9IG5ldyBWZWMzKDAsIC05LjgxLCAwKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9keW5hbWljID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmlnaWRCb2R5Q29tcG9uZW50W119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfa2luZW1hdGljID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmlnaWRCb2R5Q29tcG9uZW50W119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdHJpZ2dlcnMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb21wb3VuZHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdyaWdpZGJvZHknO1xuICAgICAgICB0aGlzLl9zdGF0cyA9IGFwcC5zdGF0cy5mcmFtZTtcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBudWxsO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0ge307XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBjb250YWN0IG9jY3VycyBiZXR3ZWVuIHR3byByaWdpZCBib2RpZXMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2NvbnRhY3RcbiAgICAgKiBAcGFyYW0ge1NpbmdsZUNvbnRhY3RSZXN1bHR9IHJlc3VsdCAtIERldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIGJvZGllcy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBvbmNlIEFtbW8gaGFzIGJlZW4gbG9hZGVkLiBSZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgdGhlIHBoeXNpY3Mgd29ybGQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25MaWJyYXJ5TG9hZGVkKCkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIEFtbW8gcGh5c2ljcyB3b3JsZFxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBuZXcgQW1tby5idERlZmF1bHRDb2xsaXNpb25Db25maWd1cmF0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoZXIgPSBuZXcgQW1tby5idENvbGxpc2lvbkRpc3BhdGNoZXIodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBuZXcgQW1tby5idERidnRCcm9hZHBoYXNlKCk7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG5ldyBBbW1vLmJ0U2VxdWVudGlhbEltcHVsc2VDb25zdHJhaW50U29sdmVyKCk7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQgPSBuZXcgQW1tby5idERpc2NyZXRlRHluYW1pY3NXb3JsZCh0aGlzLmRpc3BhdGNoZXIsIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUsIHRoaXMuc29sdmVyLCB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5keW5hbWljc1dvcmxkLnNldEludGVybmFsVGlja0NhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlciA9IEFtbW8uYWRkRnVuY3Rpb24odGhpcy5fY2hlY2tGb3JDb2xsaXNpb25zLmJpbmQodGhpcyksICd2aWYnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2soY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ1dBUk5JTkc6IFRoaXMgdmVyc2lvbiBvZiBhbW1vLmpzIGNhbiBwb3RlbnRpYWxseSBmYWlsIHRvIHJlcG9ydCBjb250YWN0cy4gUGxlYXNlIHVwZGF0ZSBpdCB0byB0aGUgbGF0ZXN0IHZlcnNpb24uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExhemlseSBjcmVhdGUgdGVtcCB2YXJzXG4gICAgICAgICAgICBhbW1vUmF5U3RhcnQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGFtbW9SYXlFbmQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIFJpZ2lkQm9keUNvbXBvbmVudC5vbkxpYnJhcnlMb2FkZWQoKTtcblxuICAgICAgICAgICAgdGhpcy5jb250YWN0UG9pbnRQb29sID0gbmV3IE9iamVjdFBvb2woQ29udGFjdFBvaW50LCAxKTtcbiAgICAgICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChDb250YWN0UmVzdWx0LCAxKTtcbiAgICAgICAgICAgIHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChTaW5nbGVDb250YWN0UmVzdWx0LCAxKTtcblxuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBVbmJpbmQgdGhlIHVwZGF0ZSBmdW5jdGlvbiBpZiB3ZSBoYXZlbid0IGxvYWRlZCBBbW1vIGJ5IG5vd1xuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3VwZGF0ZScsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbnN0IHByb3BzID0gW1xuICAgICAgICAgICAgJ21hc3MnLFxuICAgICAgICAgICAgJ2xpbmVhckRhbXBpbmcnLFxuICAgICAgICAgICAgJ2FuZ3VsYXJEYW1waW5nJyxcbiAgICAgICAgICAgICdsaW5lYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2FuZ3VsYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2ZyaWN0aW9uJyxcbiAgICAgICAgICAgICdyb2xsaW5nRnJpY3Rpb24nLFxuICAgICAgICAgICAgJ3Jlc3RpdHV0aW9uJyxcbiAgICAgICAgICAgICd0eXBlJyxcbiAgICAgICAgICAgICdncm91cCcsXG4gICAgICAgICAgICAnbWFzaydcbiAgICAgICAgXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIHByb3BzKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGRhdGFbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gbmV3IFZlYzModmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgWydlbmFibGVkJ10pO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gY3JlYXRlIG5ldyBkYXRhIGJsb2NrIGZvciBjbG9uZVxuICAgICAgICBjb25zdCByaWdpZGJvZHkgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgZW5hYmxlZDogcmlnaWRib2R5LmVuYWJsZWQsXG4gICAgICAgICAgICBtYXNzOiByaWdpZGJvZHkubWFzcyxcbiAgICAgICAgICAgIGxpbmVhckRhbXBpbmc6IHJpZ2lkYm9keS5saW5lYXJEYW1waW5nLFxuICAgICAgICAgICAgYW5ndWxhckRhbXBpbmc6IHJpZ2lkYm9keS5hbmd1bGFyRGFtcGluZyxcbiAgICAgICAgICAgIGxpbmVhckZhY3RvcjogW3JpZ2lkYm9keS5saW5lYXJGYWN0b3IueCwgcmlnaWRib2R5LmxpbmVhckZhY3Rvci55LCByaWdpZGJvZHkubGluZWFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgYW5ndWxhckZhY3RvcjogW3JpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLngsIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnksIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgZnJpY3Rpb246IHJpZ2lkYm9keS5mcmljdGlvbixcbiAgICAgICAgICAgIHJvbGxpbmdGcmljdGlvbjogcmlnaWRib2R5LnJvbGxpbmdGcmljdGlvbixcbiAgICAgICAgICAgIHJlc3RpdHV0aW9uOiByaWdpZGJvZHkucmVzdGl0dXRpb24sXG4gICAgICAgICAgICB0eXBlOiByaWdpZGJvZHkudHlwZSxcbiAgICAgICAgICAgIGdyb3VwOiByaWdpZGJvZHkuZ3JvdXAsXG4gICAgICAgICAgICBtYXNrOiByaWdpZGJvZHkubWFza1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IGNvbXBvbmVudC5ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVCb2R5KGJvZHkpO1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95Qm9keShib2R5KTtcblxuICAgICAgICAgICAgY29tcG9uZW50LmJvZHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQm9keShib2R5LCBncm91cCwgbWFzaykge1xuICAgICAgICBpZiAoZ3JvdXAgIT09IHVuZGVmaW5lZCAmJiBtYXNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5hZGRSaWdpZEJvZHkoYm9keSwgZ3JvdXAsIG1hc2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLmFkZFJpZ2lkQm9keShib2R5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUJvZHkoYm9keSkge1xuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmVtb3ZlUmlnaWRCb2R5KGJvZHkpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBsb2NhbEluZXJ0aWEgPSBuZXcgQW1tby5idFZlY3RvcjMoMCwgMCwgMCk7XG4gICAgICAgIGlmIChtYXNzICE9PSAwKSB7XG4gICAgICAgICAgICBzaGFwZS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgbG9jYWxJbmVydGlhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gbmV3IEFtbW8uYnREZWZhdWx0TW90aW9uU3RhdGUodHJhbnNmb3JtKTtcbiAgICAgICAgY29uc3QgYm9keUluZm8gPSBuZXcgQW1tby5idFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8obWFzcywgbW90aW9uU3RhdGUsIHNoYXBlLCBsb2NhbEluZXJ0aWEpO1xuICAgICAgICBjb25zdCBib2R5ID0gbmV3IEFtbW8uYnRSaWdpZEJvZHkoYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3koYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3kobG9jYWxJbmVydGlhKTtcblxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICB9XG5cbiAgICBkZXN0cm95Qm9keShib2R5KSB7XG4gICAgICAgIC8vIFRoZSBtb3Rpb24gc3RhdGUgbmVlZHMgdG8gYmUgZGVzdHJveWVkIGV4cGxpY2l0bHkgKGlmIHByZXNlbnQpXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShtb3Rpb25TdGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgQW1tby5kZXN0cm95KGJvZHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gdGhlIGZpcnN0IGVudGl0eSB0aGUgcmF5IGhpdHMuIEZpcmUgYSByYXkgaW50byB0aGUgd29ybGQgZnJvbVxuICAgICAqIHN0YXJ0IHRvIGVuZCwgaWYgdGhlIHJheSBoaXRzIGFuIGVudGl0eSB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudCwgaXQgcmV0dXJucyBhXG4gICAgICoge0BsaW5rIFJheWNhc3RSZXN1bHR9LCBvdGhlcndpc2UgcmV0dXJucyBudWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHJldHVybnMge1JheWNhc3RSZXN1bHR9IFRoZSByZXN1bHQgb2YgdGhlIHJheWNhc3Rpbmcgb3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gaGl0LlxuICAgICAqL1xuICAgIHJheWNhc3RGaXJzdChzdGFydCwgZW5kKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIGFtbW9SYXlTdGFydC5zZXRWYWx1ZShzdGFydC54LCBzdGFydC55LCBzdGFydC56KTtcbiAgICAgICAgYW1tb1JheUVuZC5zZXRWYWx1ZShlbmQueCwgZW5kLnksIGVuZC56KTtcbiAgICAgICAgY29uc3QgcmF5Q2FsbGJhY2sgPSBuZXcgQW1tby5DbG9zZXN0UmF5UmVzdWx0Q2FsbGJhY2soYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kKTtcblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmogPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3QoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2JqLCBBbW1vLmJ0UmlnaWRCb2R5KTtcbiAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9pbnQgPSByYXlDYWxsYmFjay5nZXRfbV9oaXRQb2ludFdvcmxkKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0Tm9ybWFsV29ybGQoKTtcblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBSYXljYXN0UmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBib2R5LmVudGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMocG9pbnQueCgpLCBwb2ludC55KCksIHBvaW50LnooKSksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKG5vcm1hbC54KCksIG5vcm1hbC55KCksIG5vcm1hbC56KCkpXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIC8vIGtlZXBpbmcgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNyYXlDYXN0Rmlyc3Qgbm8gbG9uZ2VyIHJlcXVpcmVzIGEgY2FsbGJhY2suIFRoZSByZXN1bHQgb2YgdGhlIHJheWNhc3QgaXMgcmV0dXJuZWQgYnkgdGhlIGZ1bmN0aW9uIGluc3RlYWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KHJheUNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gYWxsIGVudGl0aWVzIHRoZSByYXkgaGl0cy4gSXQgcmV0dXJucyBhbiBhcnJheSBvZlxuICAgICAqIHtAbGluayBSYXljYXN0UmVzdWx0fSwgb25lIGZvciBlYWNoIGhpdC4gSWYgbm8gaGl0cyBhcmUgZGV0ZWN0ZWQsIHRoZSByZXR1cm5lZCBhcnJheSB3aWxsIGJlXG4gICAgICogb2YgbGVuZ3RoIDAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgc3RhcnRzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgZW5kcy5cbiAgICAgKiBAcmV0dXJucyB7UmF5Y2FzdFJlc3VsdFtdfSBBbiBhcnJheSBvZiByYXljYXN0IGhpdCByZXN1bHRzICgwIGxlbmd0aCBpZiB0aGVyZSB3ZXJlIG5vIGhpdHMpLlxuICAgICAqL1xuICAgIHJheWNhc3RBbGwoc3RhcnQsIGVuZCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoQW1tby5BbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2ssICdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jcmF5Y2FzdEFsbDogWW91ciB2ZXJzaW9uIG9mIGFtbW8uanMgZG9lcyBub3QgZXhwb3NlIEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrLiBVcGRhdGUgaXQgdG8gbGF0ZXN0LicpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICBhbW1vUmF5U3RhcnQuc2V0VmFsdWUoc3RhcnQueCwgc3RhcnQueSwgc3RhcnQueik7XG4gICAgICAgIGFtbW9SYXlFbmQuc2V0VmFsdWUoZW5kLngsIGVuZC55LCBlbmQueik7XG4gICAgICAgIGNvbnN0IHJheUNhbGxiYWNrID0gbmV3IEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrKGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCk7XG5cbiAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnJheVRlc3QoYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kLCByYXlDYWxsYmFjayk7XG4gICAgICAgIGlmIChyYXlDYWxsYmFjay5oYXNIaXQoKSkge1xuICAgICAgICAgICAgY29uc3QgY29sbGlzaW9uT2JqcyA9IHJheUNhbGxiYWNrLmdldF9tX2NvbGxpc2lvbk9iamVjdHMoKTtcbiAgICAgICAgICAgIGNvbnN0IHBvaW50cyA9IHJheUNhbGxiYWNrLmdldF9tX2hpdFBvaW50V29ybGQoKTtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbHMgPSByYXlDYWxsYmFjay5nZXRfbV9oaXROb3JtYWxXb3JsZCgpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1IaXRzID0gY29sbGlzaW9uT2Jqcy5zaXplKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUhpdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2Jqcy5hdChpKSwgQW1tby5idFJpZ2lkQm9keSk7XG4gICAgICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9pbnQgPSBwb2ludHMuYXQoaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbCA9IG5vcm1hbHMuYXQoaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBSYXljYXN0UmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5lbnRpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhwb2ludC54KCksIHBvaW50LnkoKSwgcG9pbnQueigpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKG5vcm1hbC54KCksIG5vcm1hbC55KCksIG5vcm1hbC56KCkpXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShyYXlDYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcmVzIGEgY29sbGlzaW9uIGJldHdlZW4gdGhlIGVudGl0eSBhbmQgb3RoZXIgaW4gdGhlIGNvbnRhY3RzIG1hcCBhbmQgcmV0dXJucyB0cnVlIGlmIGl0XG4gICAgICogaXMgYSBuZXcgY29sbGlzaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IG90aGVyIC0gVGhlIGVudGl0eSB0aGF0IGNvbGxpZGVzIHdpdGggdGhlIGZpcnN0IGVudGl0eS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGlzIGlzIGEgbmV3IGNvbGxpc2lvbiwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N0b3JlQ29sbGlzaW9uKGVudGl0eSwgb3RoZXIpIHtcbiAgICAgICAgbGV0IGlzTmV3Q29sbGlzaW9uID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGd1aWQgPSBlbnRpdHkuZ2V0R3VpZCgpO1xuXG4gICAgICAgIHRoaXMuY29sbGlzaW9uc1tndWlkXSA9IHRoaXMuY29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG5cbiAgICAgICAgaWYgKHRoaXMuY29sbGlzaW9uc1tndWlkXS5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLnB1c2gob3RoZXIpO1xuICAgICAgICAgICAgaXNOZXdDb2xsaXNpb24gPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0gPSB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdLm90aGVycy5wdXNoKG90aGVyKTtcblxuICAgICAgICByZXR1cm4gaXNOZXdDb2xsaXNpb247XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnQuc2V0KGxvY2FsUG9pbnRBLngoKSwgbG9jYWxQb2ludEEueSgpLCBsb2NhbFBvaW50QS56KCkpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkEueCgpLCBwb3NpdGlvbldvcmxkT25BLnkoKSwgcG9zaXRpb25Xb3JsZE9uQS56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50T3RoZXIuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEEueCgpLCBsb2NhbFBvaW50QS55KCksIGxvY2FsUG9pbnRBLnooKSk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludC5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnRPdGhlci5zZXQocG9zaXRpb25Xb3JsZE9uQS54KCksIHBvc2l0aW9uV29ybGRPbkEueSgpLCBwb3NpdGlvbldvcmxkT25BLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5hbGxvY2F0ZSgpO1xuXG4gICAgICAgIHJlc3VsdC5hID0gYTtcbiAgICAgICAgcmVzdWx0LmIgPSBiO1xuICAgICAgICByZXN1bHQubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgcmVzdWx0LmxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnRPdGhlcjtcbiAgICAgICAgcmVzdWx0LnBvaW50QSA9IGNvbnRhY3RQb2ludC5wb2ludDtcbiAgICAgICAgcmVzdWx0LnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICByZXN1bHQubm9ybWFsID0gY29udGFjdFBvaW50Lm5vcm1hbDtcbiAgICAgICAgcmVzdWx0LmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIF9jcmVhdGVDb250YWN0UmVzdWx0KG90aGVyLCBjb250YWN0cykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IG90aGVyO1xuICAgICAgICByZXN1bHQuY29udGFjdHMgPSBjb250YWN0cztcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNvbGxpc2lvbnMgdGhhdCBubyBsb25nZXIgZXhpc3QgZnJvbSB0aGUgY29sbGlzaW9ucyBsaXN0IGFuZCBmaXJlcyBjb2xsaXNpb25lbmRcbiAgICAgKiBldmVudHMgdG8gdGhlIHJlbGF0ZWQgZW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbGVhbk9sZENvbGxpc2lvbnMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgZ3VpZCBpbiB0aGlzLmNvbGxpc2lvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbGxpc2lvbnMuaGFzT3duUHJvcGVydHkoZ3VpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZUNvbGxpc2lvbiA9IHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbiA9IHRoaXMuY29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHkgPSBjb2xsaXNpb24uZW50aXR5O1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eUNvbGxpc2lvbiA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5UmlnaWRib2R5ID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlcnMgPSBjb2xsaXNpb24ub3RoZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IG90aGVycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGkgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdGhlciA9IG90aGVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGNvbnRhY3QgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGN1cnJlbnQgZnJhbWUgY29sbGlzaW9ucyB0aGVuIGZpcmUgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcmFtZUNvbGxpc2lvbiB8fCBmcmFtZUNvbGxpc2lvbi5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBvdGhlcnMgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJzLnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIGEgdHJpZ2dlciBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvbGxpc2lvbi5maXJlKCd0cmlnZ2VybGVhdmUnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvdGhlci5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXIucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJsZWF2ZScsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghb3RoZXIudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN1cHByZXNzIGV2ZW50cyBpZiB0aGUgb3RoZXIgZW50aXR5IGlzIGEgdHJpZ2dlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlSaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5UmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbmVuZCcsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eUNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlDb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uZW5kJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvdGhlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29udGFjdCBldmVudCBhdHRhY2hlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGVudGl0eSAtIEVudGl0eSB0byB0ZXN0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29udGFjdCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhc0NvbnRhY3RFdmVudChlbnRpdHkpIHtcbiAgICAgICAgY29uc3QgYyA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgIGlmIChjICYmIChjLmhhc0V2ZW50KCdjb2xsaXNpb25zdGFydCcpIHx8IGMuaGFzRXZlbnQoJ2NvbGxpc2lvbmVuZCcpIHx8IGMuaGFzRXZlbnQoJ2NvbnRhY3QnKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgciA9IGVudGl0eS5yaWdpZGJvZHk7XG4gICAgICAgIHJldHVybiByICYmIChyLmhhc0V2ZW50KCdjb2xsaXNpb25zdGFydCcpIHx8IHIuaGFzRXZlbnQoJ2NvbGxpc2lvbmVuZCcpIHx8IHIuaGFzRXZlbnQoJ2NvbnRhY3QnKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGZvciBjb2xsaXNpb25zIGFuZCBmaXJlcyBjb2xsaXNpb24gZXZlbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdvcmxkIC0gVGhlIHBvaW50ZXIgdG8gdGhlIGR5bmFtaWNzIHdvcmxkIHRoYXQgaW52b2tlZCB0aGlzIGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lU3RlcCAtIFRoZSBhbW91bnQgb2Ygc2ltdWxhdGlvbiB0aW1lIHByb2Nlc3NlZCBpbiB0aGUgbGFzdCBzaW11bGF0aW9uIHRpY2suXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2hlY2tGb3JDb2xsaXNpb25zKHdvcmxkLCB0aW1lU3RlcCkge1xuICAgICAgICBjb25zdCBkeW5hbWljc1dvcmxkID0gQW1tby53cmFwUG9pbnRlcih3b3JsZCwgQW1tby5idER5bmFtaWNzV29ybGQpO1xuXG4gICAgICAgIC8vIENoZWNrIGZvciBjb2xsaXNpb25zIGFuZCBmaXJlIGNhbGxiYWNrc1xuICAgICAgICBjb25zdCBkaXNwYXRjaGVyID0gZHluYW1pY3NXb3JsZC5nZXREaXNwYXRjaGVyKCk7XG4gICAgICAgIGNvbnN0IG51bU1hbmlmb2xkcyA9IGRpc3BhdGNoZXIuZ2V0TnVtTWFuaWZvbGRzKCk7XG5cbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnMgPSB7fTtcblxuICAgICAgICAvLyBsb29wIHRocm91Z2ggdGhlIGFsbCBjb250YWN0cyBhbmQgZmlyZSBldmVudHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1NYW5pZm9sZHM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWFuaWZvbGQgPSBkaXNwYXRjaGVyLmdldE1hbmlmb2xkQnlJbmRleEludGVybmFsKGkpO1xuXG4gICAgICAgICAgICBjb25zdCBib2R5MCA9IG1hbmlmb2xkLmdldEJvZHkwKCk7XG4gICAgICAgICAgICBjb25zdCBib2R5MSA9IG1hbmlmb2xkLmdldEJvZHkxKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHdiMCA9IEFtbW8uY2FzdE9iamVjdChib2R5MCwgQW1tby5idFJpZ2lkQm9keSk7XG4gICAgICAgICAgICBjb25zdCB3YjEgPSBBbW1vLmNhc3RPYmplY3QoYm9keTEsIEFtbW8uYnRSaWdpZEJvZHkpO1xuXG4gICAgICAgICAgICBjb25zdCBlMCA9IHdiMC5lbnRpdHk7XG4gICAgICAgICAgICBjb25zdCBlMSA9IHdiMS5lbnRpdHk7XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIGVudGl0eSBpcyBudWxsIC0gVE9ETzogaW52ZXN0aWdhdGUgd2hlbiB0aGlzIGhhcHBlbnNcbiAgICAgICAgICAgIGlmICghZTAgfHwgIWUxKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGZsYWdzMCA9IHdiMC5nZXRDb2xsaXNpb25GbGFncygpO1xuICAgICAgICAgICAgY29uc3QgZmxhZ3MxID0gd2IxLmdldENvbGxpc2lvbkZsYWdzKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG51bUNvbnRhY3RzID0gbWFuaWZvbGQuZ2V0TnVtQ29udGFjdHMoKTtcbiAgICAgICAgICAgIGNvbnN0IGZvcndhcmRDb250YWN0cyA9IFtdO1xuICAgICAgICAgICAgY29uc3QgcmV2ZXJzZUNvbnRhY3RzID0gW107XG4gICAgICAgICAgICBsZXQgbmV3Q29sbGlzaW9uO1xuXG4gICAgICAgICAgICBpZiAobnVtQ29udGFjdHMgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZG9uJ3QgZmlyZSBjb250YWN0IGV2ZW50cyBmb3IgdHJpZ2dlcnNcbiAgICAgICAgICAgICAgICBpZiAoKGZsYWdzMCAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSB8fFxuICAgICAgICAgICAgICAgICAgICAoZmxhZ3MxICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTBFdmVudHMgPSBlMC5jb2xsaXNpb24gJiYgKGUwLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTAuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUxRXZlbnRzID0gZTEuY29sbGlzaW9uICYmIChlMS5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUxLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEJvZHlFdmVudHMgPSBlMC5yaWdpZGJvZHkgJiYgKGUwLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTAucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUxQm9keUV2ZW50cyA9IGUxLnJpZ2lkYm9keSAmJiAoZTEucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMS5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBmaXJlIHRyaWdnZXJlbnRlciBldmVudHMgZm9yIHRyaWdnZXJzXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMEV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24gJiYgIShmbGFnczEgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgndHJpZ2dlcmVudGVyJywgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGUxRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbiAmJiAhKGZsYWdzMCAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBmaXJlIHRyaWdnZXJlbnRlciBldmVudHMgZm9yIHJpZ2lkYm9kaWVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMEJvZHlFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTEsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZTFCb2R5RXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUwLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgndHJpZ2dlcmVudGVyJywgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTBFdmVudHMgPSB0aGlzLl9oYXNDb250YWN0RXZlbnQoZTApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUV2ZW50cyA9IHRoaXMuX2hhc0NvbnRhY3RFdmVudChlMSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsb2JhbEV2ZW50cyA9IHRoaXMuaGFzRXZlbnQoJ2NvbnRhY3QnKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2xvYmFsRXZlbnRzIHx8IGUwRXZlbnRzIHx8IGUxRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbnRhY3RzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidENvbnRhY3RQb2ludCA9IG1hbmlmb2xkLmdldENvbnRhY3RQb2ludChqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250YWN0UG9pbnQgPSB0aGlzLl9jcmVhdGVDb250YWN0UG9pbnRGcm9tQW1tbyhidENvbnRhY3RQb2ludCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMgfHwgZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yd2FyZENvbnRhY3RzLnB1c2goY29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmV2ZXJzZUNvbnRhY3RQb2ludCA9IHRoaXMuX2NyZWF0ZVJldmVyc2VDb250YWN0UG9pbnRGcm9tQW1tbyhidENvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VDb250YWN0cy5wdXNoKHJldmVyc2VDb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnbG9iYWxFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSBnbG9iYWwgY29udGFjdCBldmVudCBmb3IgZXZlcnkgY29udGFjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9jcmVhdGVTaW5nbGVDb250YWN0UmVzdWx0KGUwLCBlMSwgY29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdjb250YWN0JywgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMEV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcndhcmRSZXN1bHQgPSB0aGlzLl9jcmVhdGVDb250YWN0UmVzdWx0KGUxLCBmb3J3YXJkQ29udGFjdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUwLCBlMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTAuY29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLmNvbGxpc2lvbi5maXJlKCdjb250YWN0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLmNvbGxpc2lvbi5maXJlKCdjb2xsaXNpb25zdGFydCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5yaWdpZGJvZHkuZmlyZSgnY29udGFjdCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5yaWdpZGJvZHkuZmlyZSgnY29sbGlzaW9uc3RhcnQnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmV2ZXJzZVJlc3VsdCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RSZXN1bHQoZTAsIHJldmVyc2VDb250YWN0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTEsIGUwKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMS5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEuY29sbGlzaW9uLmZpcmUoJ2NvbnRhY3QnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEuY29sbGlzaW9uLmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTEucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLnJpZ2lkYm9keS5maXJlKCdjb250YWN0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLnJpZ2lkYm9keS5maXJlKCdjb2xsaXNpb25zdGFydCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2hlY2sgZm9yIGNvbGxpc2lvbnMgdGhhdCBubyBsb25nZXIgZXhpc3QgYW5kIGZpcmUgZXZlbnRzXG4gICAgICAgIHRoaXMuX2NsZWFuT2xkQ29sbGlzaW9ucygpO1xuXG4gICAgICAgIC8vIFJlc2V0IGNvbnRhY3QgcG9vbHNcbiAgICAgICAgdGhpcy5jb250YWN0UG9pbnRQb29sLmZyZWVBbGwoKTtcbiAgICAgICAgdGhpcy5jb250YWN0UmVzdWx0UG9vbC5mcmVlQWxsKCk7XG4gICAgICAgIHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wuZnJlZUFsbCgpO1xuICAgIH1cblxuICAgIG9uVXBkYXRlKGR0KSB7XG4gICAgICAgIGxldCBpLCBsZW47XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cy5waHlzaWNzU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIHdoZXRoZXIgd2UgbmVlZCB0byB1cGRhdGUgZ3Jhdml0eSBvbiB0aGUgZHluYW1pY3Mgd29ybGRcbiAgICAgICAgY29uc3QgZ3Jhdml0eSA9IHRoaXMuZHluYW1pY3NXb3JsZC5nZXRHcmF2aXR5KCk7XG4gICAgICAgIGlmIChncmF2aXR5LngoKSAhPT0gdGhpcy5ncmF2aXR5LnggfHwgZ3Jhdml0eS55KCkgIT09IHRoaXMuZ3Jhdml0eS55IHx8IGdyYXZpdHkueigpICE9PSB0aGlzLmdyYXZpdHkueikge1xuICAgICAgICAgICAgZ3Jhdml0eS5zZXRWYWx1ZSh0aGlzLmdyYXZpdHkueCwgdGhpcy5ncmF2aXR5LnksIHRoaXMuZ3Jhdml0eS56KTtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5zZXRHcmF2aXR5KGdyYXZpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHJpZ2dlcnMgPSB0aGlzLl90cmlnZ2VycztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gdHJpZ2dlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRyaWdnZXJzW2ldLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29tcG91bmRzID0gdGhpcy5fY29tcG91bmRzO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBjb21wb3VuZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbXBvdW5kc1tpXS5fdXBkYXRlQ29tcG91bmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBhbGwga2luZW1hdGljIGJvZGllcyBiYXNlZCBvbiB0aGVpciBjdXJyZW50IGVudGl0eSB0cmFuc2Zvcm1cbiAgICAgICAgY29uc3Qga2luZW1hdGljID0gdGhpcy5fa2luZW1hdGljO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBraW5lbWF0aWMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGtpbmVtYXRpY1tpXS5fdXBkYXRlS2luZW1hdGljKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIHRoZSBwaHlzaWNzIHNpbXVsYXRpb25cbiAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnN0ZXBTaW11bGF0aW9uKGR0LCB0aGlzLm1heFN1YlN0ZXBzLCB0aGlzLmZpeGVkVGltZVN0ZXApO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgdHJhbnNmb3JtcyBvZiBhbGwgZW50aXRpZXMgcmVmZXJlbmNpbmcgYSBkeW5hbWljIGJvZHlcbiAgICAgICAgY29uc3QgZHluYW1pYyA9IHRoaXMuX2R5bmFtaWM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGR5bmFtaWMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGR5bmFtaWNbaV0uX3VwZGF0ZUR5bmFtaWMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5keW5hbWljc1dvcmxkLnNldEludGVybmFsVGlja0NhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fY2hlY2tGb3JDb2xsaXNpb25zKEFtbW8uZ2V0UG9pbnRlcih0aGlzLmR5bmFtaWNzV29ybGQpLCBkdCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cy5waHlzaWNzVGltZSA9IG5vdygpIC0gdGhpcy5fc3RhdHMucGh5c2ljc1N0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3VwZGF0ZScsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLmR5bmFtaWNzV29ybGQpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuc29sdmVyKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLm92ZXJsYXBwaW5nUGFpckNhY2hlKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLmRpc3BhdGNoZXIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbik7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5zb2x2ZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhSaWdpZEJvZHlDb21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgQ29udGFjdFBvaW50LCBDb250YWN0UmVzdWx0LCBSYXljYXN0UmVzdWx0LCBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0sIFNpbmdsZUNvbnRhY3RSZXN1bHQgfTtcbiJdLCJuYW1lcyI6WyJhbW1vUmF5U3RhcnQiLCJhbW1vUmF5RW5kIiwiUmF5Y2FzdFJlc3VsdCIsImNvbnN0cnVjdG9yIiwiZW50aXR5IiwicG9pbnQiLCJub3JtYWwiLCJTaW5nbGVDb250YWN0UmVzdWx0IiwiYSIsImIiLCJjb250YWN0UG9pbnQiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJpbXB1bHNlIiwibG9jYWxQb2ludEEiLCJWZWMzIiwibG9jYWxQb2ludEIiLCJwb2ludEEiLCJwb2ludEIiLCJsb2NhbFBvaW50IiwibG9jYWxQb2ludE90aGVyIiwicG9pbnRPdGhlciIsIkNvbnRhY3RQb2ludCIsIkNvbnRhY3RSZXN1bHQiLCJvdGhlciIsImNvbnRhY3RzIiwiX3NjaGVtYSIsIlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsImFwcCIsIm1heFN1YlN0ZXBzIiwiZml4ZWRUaW1lU3RlcCIsImdyYXZpdHkiLCJfZHluYW1pYyIsIl9raW5lbWF0aWMiLCJfdHJpZ2dlcnMiLCJfY29tcG91bmRzIiwiaWQiLCJfc3RhdHMiLCJzdGF0cyIsImZyYW1lIiwiQ29tcG9uZW50VHlwZSIsIlJpZ2lkQm9keUNvbXBvbmVudCIsIkRhdGFUeXBlIiwiUmlnaWRCb2R5Q29tcG9uZW50RGF0YSIsImNvbnRhY3RQb2ludFBvb2wiLCJjb250YWN0UmVzdWx0UG9vbCIsInNpbmdsZUNvbnRhY3RSZXN1bHRQb29sIiwic2NoZW1hIiwiY29sbGlzaW9ucyIsImZyYW1lQ29sbGlzaW9ucyIsIm9uIiwib25CZWZvcmVSZW1vdmUiLCJvblJlbW92ZSIsIm9uTGlicmFyeUxvYWRlZCIsIkFtbW8iLCJjb2xsaXNpb25Db25maWd1cmF0aW9uIiwiYnREZWZhdWx0Q29sbGlzaW9uQ29uZmlndXJhdGlvbiIsImRpc3BhdGNoZXIiLCJidENvbGxpc2lvbkRpc3BhdGNoZXIiLCJvdmVybGFwcGluZ1BhaXJDYWNoZSIsImJ0RGJ2dEJyb2FkcGhhc2UiLCJzb2x2ZXIiLCJidFNlcXVlbnRpYWxJbXB1bHNlQ29uc3RyYWludFNvbHZlciIsImR5bmFtaWNzV29ybGQiLCJidERpc2NyZXRlRHluYW1pY3NXb3JsZCIsInNldEludGVybmFsVGlja0NhbGxiYWNrIiwiY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlciIsImFkZEZ1bmN0aW9uIiwiX2NoZWNrRm9yQ29sbGlzaW9ucyIsImJpbmQiLCJEZWJ1ZyIsIndhcm4iLCJidFZlY3RvcjMiLCJPYmplY3RQb29sIiwic3lzdGVtcyIsIm9uVXBkYXRlIiwib2ZmIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsInByb3BzIiwicHJvcGVydHkiLCJoYXNPd25Qcm9wZXJ0eSIsInZhbHVlIiwiQXJyYXkiLCJpc0FycmF5IiwiY2xvbmVDb21wb25lbnQiLCJjbG9uZSIsInJpZ2lkYm9keSIsImVuYWJsZWQiLCJtYXNzIiwibGluZWFyRGFtcGluZyIsImFuZ3VsYXJEYW1waW5nIiwibGluZWFyRmFjdG9yIiwieCIsInkiLCJ6IiwiYW5ndWxhckZhY3RvciIsImZyaWN0aW9uIiwicm9sbGluZ0ZyaWN0aW9uIiwicmVzdGl0dXRpb24iLCJ0eXBlIiwiZ3JvdXAiLCJtYXNrIiwiYWRkQ29tcG9uZW50IiwiYm9keSIsInJlbW92ZUJvZHkiLCJkZXN0cm95Qm9keSIsImFkZEJvZHkiLCJ1bmRlZmluZWQiLCJhZGRSaWdpZEJvZHkiLCJyZW1vdmVSaWdpZEJvZHkiLCJjcmVhdGVCb2R5Iiwic2hhcGUiLCJ0cmFuc2Zvcm0iLCJsb2NhbEluZXJ0aWEiLCJjYWxjdWxhdGVMb2NhbEluZXJ0aWEiLCJtb3Rpb25TdGF0ZSIsImJ0RGVmYXVsdE1vdGlvblN0YXRlIiwiYm9keUluZm8iLCJidFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8iLCJidFJpZ2lkQm9keSIsImRlc3Ryb3kiLCJnZXRNb3Rpb25TdGF0ZSIsInJheWNhc3RGaXJzdCIsInN0YXJ0IiwiZW5kIiwicmVzdWx0Iiwic2V0VmFsdWUiLCJyYXlDYWxsYmFjayIsIkNsb3Nlc3RSYXlSZXN1bHRDYWxsYmFjayIsInJheVRlc3QiLCJoYXNIaXQiLCJjb2xsaXNpb25PYmoiLCJnZXRfbV9jb2xsaXNpb25PYmplY3QiLCJjYXN0T2JqZWN0IiwiZ2V0X21faGl0UG9pbnRXb3JsZCIsImdldF9tX2hpdE5vcm1hbFdvcmxkIiwiZGVwcmVjYXRlZCIsImNhbGxiYWNrIiwicmF5Y2FzdEFsbCIsImFzc2VydCIsIkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjayIsInJlc3VsdHMiLCJjb2xsaXNpb25PYmpzIiwiZ2V0X21fY29sbGlzaW9uT2JqZWN0cyIsInBvaW50cyIsIm5vcm1hbHMiLCJudW1IaXRzIiwic2l6ZSIsImkiLCJhdCIsInB1c2giLCJfc3RvcmVDb2xsaXNpb24iLCJpc05ld0NvbGxpc2lvbiIsImd1aWQiLCJnZXRHdWlkIiwib3RoZXJzIiwiaW5kZXhPZiIsIl9jcmVhdGVDb250YWN0UG9pbnRGcm9tQW1tbyIsImdldF9tX2xvY2FsUG9pbnRBIiwiZ2V0X21fbG9jYWxQb2ludEIiLCJwb3NpdGlvbldvcmxkT25BIiwiZ2V0UG9zaXRpb25Xb3JsZE9uQSIsInBvc2l0aW9uV29ybGRPbkIiLCJnZXRQb3NpdGlvbldvcmxkT25CIiwibm9ybWFsV29ybGRPbkIiLCJnZXRfbV9ub3JtYWxXb3JsZE9uQiIsImNvbnRhY3QiLCJhbGxvY2F0ZSIsInNldCIsImdldEFwcGxpZWRJbXB1bHNlIiwiX2NyZWF0ZVJldmVyc2VDb250YWN0UG9pbnRGcm9tQW1tbyIsIl9jcmVhdGVTaW5nbGVDb250YWN0UmVzdWx0IiwiX2NyZWF0ZUNvbnRhY3RSZXN1bHQiLCJfY2xlYW5PbGRDb2xsaXNpb25zIiwiZnJhbWVDb2xsaXNpb24iLCJjb2xsaXNpb24iLCJlbnRpdHlDb2xsaXNpb24iLCJlbnRpdHlSaWdpZGJvZHkiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiZmlyZSIsIl9oYXNDb250YWN0RXZlbnQiLCJjIiwiaGFzRXZlbnQiLCJyIiwid29ybGQiLCJ0aW1lU3RlcCIsIndyYXBQb2ludGVyIiwiYnREeW5hbWljc1dvcmxkIiwiZ2V0RGlzcGF0Y2hlciIsIm51bU1hbmlmb2xkcyIsImdldE51bU1hbmlmb2xkcyIsIm1hbmlmb2xkIiwiZ2V0TWFuaWZvbGRCeUluZGV4SW50ZXJuYWwiLCJib2R5MCIsImdldEJvZHkwIiwiYm9keTEiLCJnZXRCb2R5MSIsIndiMCIsIndiMSIsImUwIiwiZTEiLCJmbGFnczAiLCJnZXRDb2xsaXNpb25GbGFncyIsImZsYWdzMSIsIm51bUNvbnRhY3RzIiwiZ2V0TnVtQ29udGFjdHMiLCJmb3J3YXJkQ29udGFjdHMiLCJyZXZlcnNlQ29udGFjdHMiLCJuZXdDb2xsaXNpb24iLCJCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCIsImUwRXZlbnRzIiwiZTFFdmVudHMiLCJlMEJvZHlFdmVudHMiLCJlMUJvZHlFdmVudHMiLCJnbG9iYWxFdmVudHMiLCJqIiwiYnRDb250YWN0UG9pbnQiLCJnZXRDb250YWN0UG9pbnQiLCJyZXZlcnNlQ29udGFjdFBvaW50IiwiZm9yd2FyZFJlc3VsdCIsInJldmVyc2VSZXN1bHQiLCJmcmVlQWxsIiwiZHQiLCJsZW4iLCJwaHlzaWNzU3RhcnQiLCJub3ciLCJnZXRHcmF2aXR5Iiwic2V0R3Jhdml0eSIsInRyaWdnZXJzIiwidXBkYXRlVHJhbnNmb3JtIiwiY29tcG91bmRzIiwiX3VwZGF0ZUNvbXBvdW5kIiwia2luZW1hdGljIiwiX3VwZGF0ZUtpbmVtYXRpYyIsInN0ZXBTaW11bGF0aW9uIiwiZHluYW1pYyIsIl91cGRhdGVEeW5hbWljIiwiZ2V0UG9pbnRlciIsInBoeXNpY3NUaW1lIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsSUFBSUEsWUFBWSxFQUFFQyxVQUFVLENBQUE7O0FBSzVCLE1BQU1DLGFBQWEsQ0FBQztBQVNoQkMsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFFO0lBTS9CLElBQUksQ0FBQ0YsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0lBT3BCLElBQUksQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7O0lBT2xCLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7QUFDeEIsR0FBQTtBQUNKLENBQUE7O0FBS0EsTUFBTUMsbUJBQW1CLENBQUM7QUFTdEJKLEVBQUFBLFdBQVcsQ0FBQ0ssQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLFlBQVksRUFBRTtBQUM1QixJQUFBLElBQUlDLFNBQVMsQ0FBQ0MsTUFBTSxLQUFLLENBQUMsRUFBRTtNQU14QixJQUFJLENBQUNKLENBQUMsR0FBRyxJQUFJLENBQUE7O01BT2IsSUFBSSxDQUFDQyxDQUFDLEdB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
