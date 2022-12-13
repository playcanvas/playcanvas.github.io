/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG5sZXQgYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kO1xuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBzdWNjZXNzZnVsIHJheWNhc3QgaGl0LlxuICovXG5jbGFzcyBSYXljYXN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmF5Y2FzdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcG9pbnQgYXQgd2hpY2ggdGhlIHJheSBoaXQgdGhlIGVudGl0eSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG5vcm1hbCAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBzdXJmYWNlIHdoZXJlIHRoZSByYXkgaGl0IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihlbnRpdHksIHBvaW50LCBub3JtYWwpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IGF0IHdoaWNoIHRoZSByYXkgaGl0IHRoZSBlbnRpdHkgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgc3VyZmFjZSB3aGVyZSB0aGUgcmF5IGhpdCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLlxuICovXG5jbGFzcyBTaW5nbGVDb250YWN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2luZ2xlQ29udGFjdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGEgLSBUaGUgZmlyc3QgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGIgLSBUaGUgc2Vjb25kIGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgKiBAcGFyYW0ge0NvbnRhY3RQb2ludH0gY29udGFjdFBvaW50IC0gVGhlIGNvbnRhY3QgcG9pbnQgYmV0d2VlbiB0aGUgdHdvIGVudGl0aWVzLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGZpcnN0IGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuYSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHNlY29uZCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmIgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyIGR1cmluZyB0aGUgbGFzdFxuICAgICAgICAgICAgICogc3ViLXN0ZXAuIERlc2NyaWJlcyBob3cgaGFyZCB0d28gYm9kaWVzIGNvbGxpZGVkLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuaW1wdWxzZSA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBBIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byBBLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRBID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEIgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvIEIuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEIgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMucG9pbnRBID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEIgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnBvaW50QiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIGNvbnRhY3Qgb24gRW50aXR5IEIsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLm5vcm1hbCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmEgPSBhO1xuICAgICAgICAgICAgdGhpcy5iID0gYjtcbiAgICAgICAgICAgIHRoaXMuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5pbXB1bHNlO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50O1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50T3RoZXI7XG4gICAgICAgICAgICB0aGlzLnBvaW50QSA9IGNvbnRhY3RQb2ludC5wb2ludDtcbiAgICAgICAgICAgIHRoaXMucG9pbnRCID0gY29udGFjdFBvaW50LnBvaW50T3RoZXI7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbCA9IGNvbnRhY3RQb2ludC5ub3JtYWw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gRW50aXRpZXMuXG4gKi9cbmNsYXNzIENvbnRhY3RQb2ludCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENvbnRhY3RQb2ludCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2xvY2FsUG9pbnRdIC0gVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvXG4gICAgICogdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtsb2NhbFBvaW50T3RoZXJdIC0gVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsXG4gICAgICogcmVsYXRpdmUgdG8gdGhlIG90aGVyIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtwb2ludF0gLSBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRPdGhlcl0gLSBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW5cbiAgICAgKiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtub3JtYWxdIC0gVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIGNvbnRhY3Qgb24gdGhlIG90aGVyIGVudGl0eSwgaW4gd29ybGRcbiAgICAgKiBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2ltcHVsc2VdIC0gVGhlIHRvdGFsIGFjY3VtdWxhdGVkIGltcHVsc2UgYXBwbGllZCBieSB0aGUgY29uc3RyYWludCBzb2x2ZXJcbiAgICAgKiBkdXJpbmcgdGhlIGxhc3Qgc3ViLXN0ZXAuIERlc2NyaWJlcyBob3cgaGFyZCB0d28gb2JqZWN0cyBjb2xsaWRlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihsb2NhbFBvaW50ID0gbmV3IFZlYzMoKSwgbG9jYWxQb2ludE90aGVyID0gbmV3IFZlYzMoKSwgcG9pbnQgPSBuZXcgVmVjMygpLCBwb2ludE90aGVyID0gbmV3IFZlYzMoKSwgbm9ybWFsID0gbmV3IFZlYzMoKSwgaW1wdWxzZSA9IDApIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byB0aGUgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb2ludCA9IGxvY2FsUG9pbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb2ludE90aGVyID0gbG9jYWxQb2ludE90aGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludE90aGVyID0gcG9pbnRPdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIGNvbnRhY3Qgb24gdGhlIG90aGVyIGVudGl0eSwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ub3JtYWwgPSBub3JtYWw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyIGR1cmluZyB0aGUgbGFzdCBzdWItc3RlcC5cbiAgICAgICAgICogRGVzY3JpYmVzIGhvdyBoYXJkIHR3byBvYmplY3RzIGNvbGxpZGUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmltcHVsc2UgPSBpbXB1bHNlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBPYmplY3QgaG9sZGluZyB0aGUgcmVzdWx0IG9mIGEgY29udGFjdCBiZXR3ZWVuIHR3byBFbnRpdGllcy5cbiAqL1xuY2xhc3MgQ29udGFjdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENvbnRhY3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlXG4gICAgICogY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7Q29udGFjdFBvaW50W119IGNvbnRhY3RzIC0gQW4gYXJyYXkgb2YgQ29udGFjdFBvaW50cyB3aXRoIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG90aGVyLCBjb250YWN0cykge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSB0aGF0IHdhcyBpbnZvbHZlZCBpbiB0aGUgY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm90aGVyID0gb3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFuIGFycmF5IG9mIENvbnRhY3RQb2ludHMgd2l0aCB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q29udGFjdFBvaW50W119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNvbnRhY3RzID0gY29udGFjdHM7XG4gICAgfVxufVxuXG5jb25zdCBfc2NoZW1hID0gWydlbmFibGVkJ107XG5cbi8qKlxuICogVGhlIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBtYWludGFpbnMgdGhlIGR5bmFtaWNzIHdvcmxkIGZvciBzaW11bGF0aW5nIHJpZ2lkIGJvZGllcywgaXQgYWxzb1xuICogY29udHJvbHMgZ2xvYmFsIHZhbHVlcyBmb3IgdGhlIHdvcmxkIHN1Y2ggYXMgZ3Jhdml0eS4gTm90ZTogVGhlIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBpcyBvbmx5XG4gKiB2YWxpZCBpZiAzRCBQaHlzaWNzIGlzIGVuYWJsZWQgaW4geW91ciBhcHBsaWNhdGlvbi4gWW91IGNhbiBlbmFibGUgdGhpcyBpbiB0aGUgYXBwbGljYXRpb25cbiAqIHNldHRpbmdzIGZvciB5b3VyIHByb2plY3QuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG1heFN1YlN0ZXBzID0gMTA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmaXhlZFRpbWVTdGVwID0gMSAvIDYwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHdvcmxkIHNwYWNlIHZlY3RvciByZXByZXNlbnRpbmcgZ2xvYmFsIGdyYXZpdHkgaW4gdGhlIHBoeXNpY3Mgc2ltdWxhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiBbMCwgLTkuODEsIDBdIHdoaWNoIGlzIGFuIGFwcHJveGltYXRpb24gb2YgdGhlIGdyYXZpdGF0aW9uYWwgZm9yY2Ugb24gRWFydGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBncmF2aXR5ID0gbmV3IFZlYzMoMCwgLTkuODEsIDApO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2R5bmFtaWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9raW5lbWF0aWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90cmlnZ2VycyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBvdW5kcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdyaWdpZGJvZHknO1xuICAgICAgICB0aGlzLl9zdGF0cyA9IGFwcC5zdGF0cy5mcmFtZTtcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBudWxsO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0ge307XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBjb250YWN0IG9jY3VycyBiZXR3ZWVuIHR3byByaWdpZCBib2RpZXMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2NvbnRhY3RcbiAgICAgKiBAcGFyYW0ge1NpbmdsZUNvbnRhY3RSZXN1bHR9IHJlc3VsdCAtIERldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIGJvZGllcy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBvbmNlIEFtbW8gaGFzIGJlZW4gbG9hZGVkLiBSZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgdGhlIHBoeXNpY3Mgd29ybGQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25MaWJyYXJ5TG9hZGVkKCkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIEFtbW8gcGh5c2ljcyB3b3JsZFxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBuZXcgQW1tby5idERlZmF1bHRDb2xsaXNpb25Db25maWd1cmF0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoZXIgPSBuZXcgQW1tby5idENvbGxpc2lvbkRpc3BhdGNoZXIodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBuZXcgQW1tby5idERidnRCcm9hZHBoYXNlKCk7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG5ldyBBbW1vLmJ0U2VxdWVudGlhbEltcHVsc2VDb25zdHJhaW50U29sdmVyKCk7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQgPSBuZXcgQW1tby5idERpc2NyZXRlRHluYW1pY3NXb3JsZCh0aGlzLmRpc3BhdGNoZXIsIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUsIHRoaXMuc29sdmVyLCB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5keW5hbWljc1dvcmxkLnNldEludGVybmFsVGlja0NhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlciA9IEFtbW8uYWRkRnVuY3Rpb24odGhpcy5fY2hlY2tGb3JDb2xsaXNpb25zLmJpbmQodGhpcyksICd2aWYnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2soY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ1dBUk5JTkc6IFRoaXMgdmVyc2lvbiBvZiBhbW1vLmpzIGNhbiBwb3RlbnRpYWxseSBmYWlsIHRvIHJlcG9ydCBjb250YWN0cy4gUGxlYXNlIHVwZGF0ZSBpdCB0byB0aGUgbGF0ZXN0IHZlcnNpb24uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExhemlseSBjcmVhdGUgdGVtcCB2YXJzXG4gICAgICAgICAgICBhbW1vUmF5U3RhcnQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGFtbW9SYXlFbmQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIFJpZ2lkQm9keUNvbXBvbmVudC5vbkxpYnJhcnlMb2FkZWQoKTtcblxuICAgICAgICAgICAgdGhpcy5jb250YWN0UG9pbnRQb29sID0gbmV3IE9iamVjdFBvb2woQ29udGFjdFBvaW50LCAxKTtcbiAgICAgICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChDb250YWN0UmVzdWx0LCAxKTtcbiAgICAgICAgICAgIHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChTaW5nbGVDb250YWN0UmVzdWx0LCAxKTtcblxuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBVbmJpbmQgdGhlIHVwZGF0ZSBmdW5jdGlvbiBpZiB3ZSBoYXZlbid0IGxvYWRlZCBBbW1vIGJ5IG5vd1xuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3VwZGF0ZScsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbnN0IHByb3BzID0gW1xuICAgICAgICAgICAgJ21hc3MnLFxuICAgICAgICAgICAgJ2xpbmVhckRhbXBpbmcnLFxuICAgICAgICAgICAgJ2FuZ3VsYXJEYW1waW5nJyxcbiAgICAgICAgICAgICdsaW5lYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2FuZ3VsYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2ZyaWN0aW9uJyxcbiAgICAgICAgICAgICdyb2xsaW5nRnJpY3Rpb24nLFxuICAgICAgICAgICAgJ3Jlc3RpdHV0aW9uJyxcbiAgICAgICAgICAgICd0eXBlJyxcbiAgICAgICAgICAgICdncm91cCcsXG4gICAgICAgICAgICAnbWFzaydcbiAgICAgICAgXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIHByb3BzKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGRhdGFbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gbmV3IFZlYzModmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgWydlbmFibGVkJ10pO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gY3JlYXRlIG5ldyBkYXRhIGJsb2NrIGZvciBjbG9uZVxuICAgICAgICBjb25zdCByaWdpZGJvZHkgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgZW5hYmxlZDogcmlnaWRib2R5LmVuYWJsZWQsXG4gICAgICAgICAgICBtYXNzOiByaWdpZGJvZHkubWFzcyxcbiAgICAgICAgICAgIGxpbmVhckRhbXBpbmc6IHJpZ2lkYm9keS5saW5lYXJEYW1waW5nLFxuICAgICAgICAgICAgYW5ndWxhckRhbXBpbmc6IHJpZ2lkYm9keS5hbmd1bGFyRGFtcGluZyxcbiAgICAgICAgICAgIGxpbmVhckZhY3RvcjogW3JpZ2lkYm9keS5saW5lYXJGYWN0b3IueCwgcmlnaWRib2R5LmxpbmVhckZhY3Rvci55LCByaWdpZGJvZHkubGluZWFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgYW5ndWxhckZhY3RvcjogW3JpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLngsIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnksIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgZnJpY3Rpb246IHJpZ2lkYm9keS5mcmljdGlvbixcbiAgICAgICAgICAgIHJvbGxpbmdGcmljdGlvbjogcmlnaWRib2R5LnJvbGxpbmdGcmljdGlvbixcbiAgICAgICAgICAgIHJlc3RpdHV0aW9uOiByaWdpZGJvZHkucmVzdGl0dXRpb24sXG4gICAgICAgICAgICB0eXBlOiByaWdpZGJvZHkudHlwZSxcbiAgICAgICAgICAgIGdyb3VwOiByaWdpZGJvZHkuZ3JvdXAsXG4gICAgICAgICAgICBtYXNrOiByaWdpZGJvZHkubWFza1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IGNvbXBvbmVudC5ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVCb2R5KGJvZHkpO1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95Qm9keShib2R5KTtcblxuICAgICAgICAgICAgY29tcG9uZW50LmJvZHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQm9keShib2R5LCBncm91cCwgbWFzaykge1xuICAgICAgICBpZiAoZ3JvdXAgIT09IHVuZGVmaW5lZCAmJiBtYXNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5hZGRSaWdpZEJvZHkoYm9keSwgZ3JvdXAsIG1hc2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLmFkZFJpZ2lkQm9keShib2R5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUJvZHkoYm9keSkge1xuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmVtb3ZlUmlnaWRCb2R5KGJvZHkpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBsb2NhbEluZXJ0aWEgPSBuZXcgQW1tby5idFZlY3RvcjMoMCwgMCwgMCk7XG4gICAgICAgIGlmIChtYXNzICE9PSAwKSB7XG4gICAgICAgICAgICBzaGFwZS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgbG9jYWxJbmVydGlhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gbmV3IEFtbW8uYnREZWZhdWx0TW90aW9uU3RhdGUodHJhbnNmb3JtKTtcbiAgICAgICAgY29uc3QgYm9keUluZm8gPSBuZXcgQW1tby5idFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8obWFzcywgbW90aW9uU3RhdGUsIHNoYXBlLCBsb2NhbEluZXJ0aWEpO1xuICAgICAgICBjb25zdCBib2R5ID0gbmV3IEFtbW8uYnRSaWdpZEJvZHkoYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3koYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3kobG9jYWxJbmVydGlhKTtcblxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICB9XG5cbiAgICBkZXN0cm95Qm9keShib2R5KSB7XG4gICAgICAgIC8vIFRoZSBtb3Rpb24gc3RhdGUgbmVlZHMgdG8gYmUgZGVzdHJveWVkIGV4cGxpY2l0bHkgKGlmIHByZXNlbnQpXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShtb3Rpb25TdGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgQW1tby5kZXN0cm95KGJvZHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gdGhlIGZpcnN0IGVudGl0eSB0aGUgcmF5IGhpdHMuIEZpcmUgYSByYXkgaW50byB0aGUgd29ybGQgZnJvbVxuICAgICAqIHN0YXJ0IHRvIGVuZCwgaWYgdGhlIHJheSBoaXRzIGFuIGVudGl0eSB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudCwgaXQgcmV0dXJucyBhXG4gICAgICoge0BsaW5rIFJheWNhc3RSZXN1bHR9LCBvdGhlcndpc2UgcmV0dXJucyBudWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHJldHVybnMge1JheWNhc3RSZXN1bHR9IFRoZSByZXN1bHQgb2YgdGhlIHJheWNhc3Rpbmcgb3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gaGl0LlxuICAgICAqL1xuICAgIHJheWNhc3RGaXJzdChzdGFydCwgZW5kKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIGFtbW9SYXlTdGFydC5zZXRWYWx1ZShzdGFydC54LCBzdGFydC55LCBzdGFydC56KTtcbiAgICAgICAgYW1tb1JheUVuZC5zZXRWYWx1ZShlbmQueCwgZW5kLnksIGVuZC56KTtcbiAgICAgICAgY29uc3QgcmF5Q2FsbGJhY2sgPSBuZXcgQW1tby5DbG9zZXN0UmF5UmVzdWx0Q2FsbGJhY2soYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kKTtcblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmogPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3QoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2JqLCBBbW1vLmJ0UmlnaWRCb2R5KTtcbiAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9pbnQgPSByYXlDYWxsYmFjay5nZXRfbV9oaXRQb2ludFdvcmxkKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0Tm9ybWFsV29ybGQoKTtcblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBSYXljYXN0UmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBib2R5LmVudGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMocG9pbnQueCgpLCBwb2ludC55KCksIHBvaW50LnooKSksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKG5vcm1hbC54KCksIG5vcm1hbC55KCksIG5vcm1hbC56KCkpXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIC8vIGtlZXBpbmcgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNyYXlDYXN0Rmlyc3Qgbm8gbG9uZ2VyIHJlcXVpcmVzIGEgY2FsbGJhY2suIFRoZSByZXN1bHQgb2YgdGhlIHJheWNhc3QgaXMgcmV0dXJuZWQgYnkgdGhlIGZ1bmN0aW9uIGluc3RlYWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KHJheUNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gYWxsIGVudGl0aWVzIHRoZSByYXkgaGl0cy4gSXQgcmV0dXJucyBhbiBhcnJheSBvZlxuICAgICAqIHtAbGluayBSYXljYXN0UmVzdWx0fSwgb25lIGZvciBlYWNoIGhpdC4gSWYgbm8gaGl0cyBhcmUgZGV0ZWN0ZWQsIHRoZSByZXR1cm5lZCBhcnJheSB3aWxsIGJlXG4gICAgICogb2YgbGVuZ3RoIDAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgc3RhcnRzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgZW5kcy5cbiAgICAgKiBAcmV0dXJucyB7UmF5Y2FzdFJlc3VsdFtdfSBBbiBhcnJheSBvZiByYXljYXN0IGhpdCByZXN1bHRzICgwIGxlbmd0aCBpZiB0aGVyZSB3ZXJlIG5vIGhpdHMpLlxuICAgICAqL1xuICAgIHJheWNhc3RBbGwoc3RhcnQsIGVuZCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoQW1tby5BbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2ssICdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jcmF5Y2FzdEFsbDogWW91ciB2ZXJzaW9uIG9mIGFtbW8uanMgZG9lcyBub3QgZXhwb3NlIEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrLiBVcGRhdGUgaXQgdG8gbGF0ZXN0LicpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICBhbW1vUmF5U3RhcnQuc2V0VmFsdWUoc3RhcnQueCwgc3RhcnQueSwgc3RhcnQueik7XG4gICAgICAgIGFtbW9SYXlFbmQuc2V0VmFsdWUoZW5kLngsIGVuZC55LCBlbmQueik7XG4gICAgICAgIGNvbnN0IHJheUNhbGxiYWNrID0gbmV3IEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrKGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCk7XG5cbiAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnJheVRlc3QoYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kLCByYXlDYWxsYmFjayk7XG4gICAgICAgIGlmIChyYXlDYWxsYmFjay5oYXNIaXQoKSkge1xuICAgICAgICAgICAgY29uc3QgY29sbGlzaW9uT2JqcyA9IHJheUNhbGxiYWNrLmdldF9tX2NvbGxpc2lvbk9iamVjdHMoKTtcbiAgICAgICAgICAgIGNvbnN0IHBvaW50cyA9IHJheUNhbGxiYWNrLmdldF9tX2hpdFBvaW50V29ybGQoKTtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbHMgPSByYXlDYWxsYmFjay5nZXRfbV9oaXROb3JtYWxXb3JsZCgpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1IaXRzID0gY29sbGlzaW9uT2Jqcy5zaXplKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUhpdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2Jqcy5hdChpKSwgQW1tby5idFJpZ2lkQm9keSk7XG4gICAgICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9pbnQgPSBwb2ludHMuYXQoaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbCA9IG5vcm1hbHMuYXQoaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBSYXljYXN0UmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5lbnRpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhwb2ludC54KCksIHBvaW50LnkoKSwgcG9pbnQueigpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKG5vcm1hbC54KCksIG5vcm1hbC55KCksIG5vcm1hbC56KCkpXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShyYXlDYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcmVzIGEgY29sbGlzaW9uIGJldHdlZW4gdGhlIGVudGl0eSBhbmQgb3RoZXIgaW4gdGhlIGNvbnRhY3RzIG1hcCBhbmQgcmV0dXJucyB0cnVlIGlmIGl0XG4gICAgICogaXMgYSBuZXcgY29sbGlzaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCBjb2xsaWRlcyB3aXRoIHRoZSBmaXJzdFxuICAgICAqIGVudGl0eS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGlzIGlzIGEgbmV3IGNvbGxpc2lvbiwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N0b3JlQ29sbGlzaW9uKGVudGl0eSwgb3RoZXIpIHtcbiAgICAgICAgbGV0IGlzTmV3Q29sbGlzaW9uID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGd1aWQgPSBlbnRpdHkuZ2V0R3VpZCgpO1xuXG4gICAgICAgIHRoaXMuY29sbGlzaW9uc1tndWlkXSA9IHRoaXMuY29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG5cbiAgICAgICAgaWYgKHRoaXMuY29sbGlzaW9uc1tndWlkXS5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLnB1c2gob3RoZXIpO1xuICAgICAgICAgICAgaXNOZXdDb2xsaXNpb24gPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0gPSB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdLm90aGVycy5wdXNoKG90aGVyKTtcblxuICAgICAgICByZXR1cm4gaXNOZXdDb2xsaXNpb247XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnQuc2V0KGxvY2FsUG9pbnRBLngoKSwgbG9jYWxQb2ludEEueSgpLCBsb2NhbFBvaW50QS56KCkpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkEueCgpLCBwb3NpdGlvbldvcmxkT25BLnkoKSwgcG9zaXRpb25Xb3JsZE9uQS56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50T3RoZXIuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEEueCgpLCBsb2NhbFBvaW50QS55KCksIGxvY2FsUG9pbnRBLnooKSk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludC5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnRPdGhlci5zZXQocG9zaXRpb25Xb3JsZE9uQS54KCksIHBvc2l0aW9uV29ybGRPbkEueSgpLCBwb3NpdGlvbldvcmxkT25BLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5hbGxvY2F0ZSgpO1xuXG4gICAgICAgIHJlc3VsdC5hID0gYTtcbiAgICAgICAgcmVzdWx0LmIgPSBiO1xuICAgICAgICByZXN1bHQubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgcmVzdWx0LmxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnRPdGhlcjtcbiAgICAgICAgcmVzdWx0LnBvaW50QSA9IGNvbnRhY3RQb2ludC5wb2ludDtcbiAgICAgICAgcmVzdWx0LnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICByZXN1bHQubm9ybWFsID0gY29udGFjdFBvaW50Lm5vcm1hbDtcbiAgICAgICAgcmVzdWx0LmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIF9jcmVhdGVDb250YWN0UmVzdWx0KG90aGVyLCBjb250YWN0cykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IG90aGVyO1xuICAgICAgICByZXN1bHQuY29udGFjdHMgPSBjb250YWN0cztcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNvbGxpc2lvbnMgdGhhdCBubyBsb25nZXIgZXhpc3QgZnJvbSB0aGUgY29sbGlzaW9ucyBsaXN0IGFuZCBmaXJlcyBjb2xsaXNpb25lbmRcbiAgICAgKiBldmVudHMgdG8gdGhlIHJlbGF0ZWQgZW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbGVhbk9sZENvbGxpc2lvbnMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgZ3VpZCBpbiB0aGlzLmNvbGxpc2lvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbGxpc2lvbnMuaGFzT3duUHJvcGVydHkoZ3VpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZUNvbGxpc2lvbiA9IHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbiA9IHRoaXMuY29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHkgPSBjb2xsaXNpb24uZW50aXR5O1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eUNvbGxpc2lvbiA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5UmlnaWRib2R5ID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlcnMgPSBjb2xsaXNpb24ub3RoZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IG90aGVycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGkgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdGhlciA9IG90aGVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGNvbnRhY3QgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGN1cnJlbnQgZnJhbWUgY29sbGlzaW9ucyB0aGVuIGZpcmUgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcmFtZUNvbGxpc2lvbiB8fCBmcmFtZUNvbGxpc2lvbi5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBvdGhlcnMgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJzLnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIGEgdHJpZ2dlciBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvbGxpc2lvbi5maXJlKCd0cmlnZ2VybGVhdmUnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvdGhlci5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXIucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJsZWF2ZScsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghb3RoZXIudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN1cHByZXNzIGV2ZW50cyBpZiB0aGUgb3RoZXIgZW50aXR5IGlzIGEgdHJpZ2dlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlSaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5UmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbmVuZCcsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eUNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlDb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uZW5kJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvdGhlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29udGFjdCBldmVudCBhdHRhY2hlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gRW50aXR5IHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGVudGl0eSBoYXMgYSBjb250YWN0IGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGFzQ29udGFjdEV2ZW50KGVudGl0eSkge1xuICAgICAgICBjb25zdCBjID0gZW50aXR5LmNvbGxpc2lvbjtcbiAgICAgICAgaWYgKGMgJiYgKGMuaGFzRXZlbnQoJ2NvbGxpc2lvbnN0YXJ0JykgfHwgYy5oYXNFdmVudCgnY29sbGlzaW9uZW5kJykgfHwgYy5oYXNFdmVudCgnY29udGFjdCcpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgcmV0dXJuIHIgJiYgKHIuaGFzRXZlbnQoJ2NvbGxpc2lvbnN0YXJ0JykgfHwgci5oYXNFdmVudCgnY29sbGlzaW9uZW5kJykgfHwgci5oYXNFdmVudCgnY29udGFjdCcpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgZm9yIGNvbGxpc2lvbnMgYW5kIGZpcmVzIGNvbGxpc2lvbiBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd29ybGQgLSBUaGUgcG9pbnRlciB0byB0aGUgZHluYW1pY3Mgd29ybGQgdGhhdCBpbnZva2VkIHRoaXMgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRpbWVTdGVwIC0gVGhlIGFtb3VudCBvZiBzaW11bGF0aW9uIHRpbWUgcHJvY2Vzc2VkIGluIHRoZSBsYXN0IHNpbXVsYXRpb24gdGljay5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jaGVja0ZvckNvbGxpc2lvbnMod29ybGQsIHRpbWVTdGVwKSB7XG4gICAgICAgIGNvbnN0IGR5bmFtaWNzV29ybGQgPSBBbW1vLndyYXBQb2ludGVyKHdvcmxkLCBBbW1vLmJ0RHluYW1pY3NXb3JsZCk7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIGNvbGxpc2lvbnMgYW5kIGZpcmUgY2FsbGJhY2tzXG4gICAgICAgIGNvbnN0IGRpc3BhdGNoZXIgPSBkeW5hbWljc1dvcmxkLmdldERpc3BhdGNoZXIoKTtcbiAgICAgICAgY29uc3QgbnVtTWFuaWZvbGRzID0gZGlzcGF0Y2hlci5nZXROdW1NYW5pZm9sZHMoKTtcblxuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9ucyA9IHt9O1xuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgYWxsIGNvbnRhY3RzIGFuZCBmaXJlIGV2ZW50c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU1hbmlmb2xkczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYW5pZm9sZCA9IGRpc3BhdGNoZXIuZ2V0TWFuaWZvbGRCeUluZGV4SW50ZXJuYWwoaSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJvZHkwID0gbWFuaWZvbGQuZ2V0Qm9keTAoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkxID0gbWFuaWZvbGQuZ2V0Qm9keTEoKTtcblxuICAgICAgICAgICAgY29uc3Qgd2IwID0gQW1tby5jYXN0T2JqZWN0KGJvZHkwLCBBbW1vLmJ0UmlnaWRCb2R5KTtcbiAgICAgICAgICAgIGNvbnN0IHdiMSA9IEFtbW8uY2FzdE9iamVjdChib2R5MSwgQW1tby5idFJpZ2lkQm9keSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGUwID0gd2IwLmVudGl0eTtcbiAgICAgICAgICAgIGNvbnN0IGUxID0gd2IxLmVudGl0eTtcblxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgZW50aXR5IGlzIG51bGwgLSBUT0RPOiBpbnZlc3RpZ2F0ZSB3aGVuIHRoaXMgaGFwcGVuc1xuICAgICAgICAgICAgaWYgKCFlMCB8fCAhZTEpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmxhZ3MwID0gd2IwLmdldENvbGxpc2lvbkZsYWdzKCk7XG4gICAgICAgICAgICBjb25zdCBmbGFnczEgPSB3YjEuZ2V0Q29sbGlzaW9uRmxhZ3MoKTtcblxuICAgICAgICAgICAgY29uc3QgbnVtQ29udGFjdHMgPSBtYW5pZm9sZC5nZXROdW1Db250YWN0cygpO1xuICAgICAgICAgICAgY29uc3QgZm9yd2FyZENvbnRhY3RzID0gW107XG4gICAgICAgICAgICBjb25zdCByZXZlcnNlQ29udGFjdHMgPSBbXTtcbiAgICAgICAgICAgIGxldCBuZXdDb2xsaXNpb247XG5cbiAgICAgICAgICAgIGlmIChudW1Db250YWN0cyA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBmaXJlIGNvbnRhY3QgZXZlbnRzIGZvciB0cmlnZ2Vyc1xuICAgICAgICAgICAgICAgIGlmICgoZmxhZ3MwICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpIHx8XG4gICAgICAgICAgICAgICAgICAgIChmbGFnczEgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEV2ZW50cyA9IGUwLmNvbGxpc2lvbiAmJiAoZTAuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMC5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFFdmVudHMgPSBlMS5jb2xsaXNpb24gJiYgKGUxLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTEuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwQm9keUV2ZW50cyA9IGUwLnJpZ2lkYm9keSAmJiAoZTAucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMC5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFCb2R5RXZlbnRzID0gZTEucmlnaWRib2R5ICYmIChlMS5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUxLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgdHJpZ2dlcmVudGVyIGV2ZW50cyBmb3IgdHJpZ2dlcnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbiAmJiAhKGZsYWdzMSAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLmNvbGxpc2lvbi5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uICYmICEoZmxhZ3MwICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEuY29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgdHJpZ2dlcmVudGVyIGV2ZW50cyBmb3IgcmlnaWRib2RpZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUwQm9keUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMUJvZHlFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLnJpZ2lkYm9keS5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEV2ZW50cyA9IHRoaXMuX2hhc0NvbnRhY3RFdmVudChlMCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUxRXZlbnRzID0gdGhpcy5faGFzQ29udGFjdEV2ZW50KGUxKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2xvYmFsRXZlbnRzID0gdGhpcy5oYXNFdmVudCgnY29udGFjdCcpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbG9iYWxFdmVudHMgfHwgZTBFdmVudHMgfHwgZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtQ29udGFjdHM7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ0Q29udGFjdFBvaW50ID0gbWFuaWZvbGQuZ2V0Q29udGFjdFBvaW50KGopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhY3RQb2ludCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGJ0Q29udGFjdFBvaW50KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMEV2ZW50cyB8fCBlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3J3YXJkQ29udGFjdHMucHVzaChjb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXZlcnNlQ29udGFjdFBvaW50ID0gdGhpcy5fY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGJ0Q29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZUNvbnRhY3RzLnB1c2gocmV2ZXJzZUNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdsb2JhbEV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmaXJlIGdsb2JhbCBjb250YWN0IGV2ZW50IGZvciBldmVyeSBjb250YWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2NyZWF0ZVNpbmdsZUNvbnRhY3RSZXN1bHQoZTAsIGUxLCBjb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NvbnRhY3QnLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9yd2FyZFJlc3VsdCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RSZXN1bHQoZTEsIGZvcndhcmRDb250YWN0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMC5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ2NvbnRhY3QnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTAucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCdjb250YWN0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCdjb2xsaXNpb25zdGFydCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXZlcnNlUmVzdWx0ID0gdGhpcy5fY3JlYXRlQ29udGFjdFJlc3VsdChlMCwgcmV2ZXJzZUNvbnRhY3RzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxLmNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgnY29udGFjdCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uc3RhcnQnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ2NvbnRhY3QnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaGVjayBmb3IgY29sbGlzaW9ucyB0aGF0IG5vIGxvbmdlciBleGlzdCBhbmQgZmlyZSBldmVudHNcbiAgICAgICAgdGhpcy5fY2xlYW5PbGRDb2xsaXNpb25zKCk7XG5cbiAgICAgICAgLy8gUmVzZXQgY29udGFjdCBwb29sc1xuICAgICAgICB0aGlzLmNvbnRhY3RQb2ludFBvb2wuZnJlZUFsbCgpO1xuICAgICAgICB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmZyZWVBbGwoKTtcbiAgICAgICAgdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5mcmVlQWxsKCk7XG4gICAgfVxuXG4gICAgb25VcGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGksIGxlbjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnBoeXNpY3NTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBDaGVjayB0byBzZWUgd2hldGhlciB3ZSBuZWVkIHRvIHVwZGF0ZSBncmF2aXR5IG9uIHRoZSBkeW5hbWljcyB3b3JsZFxuICAgICAgICBjb25zdCBncmF2aXR5ID0gdGhpcy5keW5hbWljc1dvcmxkLmdldEdyYXZpdHkoKTtcbiAgICAgICAgaWYgKGdyYXZpdHkueCgpICE9PSB0aGlzLmdyYXZpdHkueCB8fCBncmF2aXR5LnkoKSAhPT0gdGhpcy5ncmF2aXR5LnkgfHwgZ3Jhdml0eS56KCkgIT09IHRoaXMuZ3Jhdml0eS56KSB7XG4gICAgICAgICAgICBncmF2aXR5LnNldFZhbHVlKHRoaXMuZ3Jhdml0eS54LCB0aGlzLmdyYXZpdHkueSwgdGhpcy5ncmF2aXR5LnopO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnNldEdyYXZpdHkoZ3Jhdml0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0cmlnZ2VycyA9IHRoaXMuX3RyaWdnZXJzO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB0cmlnZ2Vycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdHJpZ2dlcnNbaV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb21wb3VuZHMgPSB0aGlzLl9jb21wb3VuZHM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGNvbXBvdW5kcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29tcG91bmRzW2ldLl91cGRhdGVDb21wb3VuZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBraW5lbWF0aWMgYm9kaWVzIGJhc2VkIG9uIHRoZWlyIGN1cnJlbnQgZW50aXR5IHRyYW5zZm9ybVxuICAgICAgICBjb25zdCBraW5lbWF0aWMgPSB0aGlzLl9raW5lbWF0aWM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGtpbmVtYXRpYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAga2luZW1hdGljW2ldLl91cGRhdGVLaW5lbWF0aWMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgdGhlIHBoeXNpY3Mgc2ltdWxhdGlvblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc3RlcFNpbXVsYXRpb24oZHQsIHRoaXMubWF4U3ViU3RlcHMsIHRoaXMuZml4ZWRUaW1lU3RlcCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSB0cmFuc2Zvcm1zIG9mIGFsbCBlbnRpdGllcyByZWZlcmVuY2luZyBhIGR5bmFtaWMgYm9keVxuICAgICAgICBjb25zdCBkeW5hbWljID0gdGhpcy5fZHluYW1pYztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gZHluYW1pYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgZHluYW1pY1tpXS5fdXBkYXRlRHluYW1pYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9jaGVja0ZvckNvbGxpc2lvbnMoQW1tby5nZXRQb2ludGVyKHRoaXMuZHluYW1pY3NXb3JsZCksIGR0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnBoeXNpY3NUaW1lID0gbm93KCkgLSB0aGlzLl9zdGF0cy5waHlzaWNzU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuZHluYW1pY3NXb3JsZCk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5zb2x2ZXIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuZGlzcGF0Y2hlcik7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLm92ZXJsYXBwaW5nUGFpckNhY2hlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKFJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBDb250YWN0UG9pbnQsIENvbnRhY3RSZXN1bHQsIFJheWNhc3RSZXN1bHQsIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSwgU2luZ2xlQ29udGFjdFJlc3VsdCB9O1xuIl0sIm5hbWVzIjpbImFtbW9SYXlTdGFydCIsImFtbW9SYXlFbmQiLCJSYXljYXN0UmVzdWx0IiwiY29uc3RydWN0b3IiLCJlbnRpdHkiLCJwb2ludCIsIm5vcm1hbCIsIlNpbmdsZUNvbnRhY3RSZXN1bHQiLCJhIiwiYiIsImNvbnRhY3RQb2ludCIsImFyZ3VtZW50cyIsImxlbmd0aCIsImltcHVsc2UiLCJsb2NhbFBvaW50QSIsIlZlYzMiLCJsb2NhbFBvaW50QiIsInBvaW50QSIsInBvaW50QiIsImxvY2FsUG9pbnQiLCJsb2NhbFBvaW50T3RoZXIiLCJwb2ludE90aGVyIiwiQ29udGFjdFBvaW50IiwiQ29udGFjdFJlc3VsdCIsIm90aGVyIiwiY29udGFjdHMiLCJfc2NoZW1hIiwiUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiYXBwIiwibWF4U3ViU3RlcHMiLCJmaXhlZFRpbWVTdGVwIiwiZ3Jhdml0eSIsIl9keW5hbWljIiwiX2tpbmVtYXRpYyIsIl90cmlnZ2VycyIsIl9jb21wb3VuZHMiLCJpZCIsIl9zdGF0cyIsInN0YXRzIiwiZnJhbWUiLCJDb21wb25lbnRUeXBlIiwiUmlnaWRCb2R5Q29tcG9uZW50IiwiRGF0YVR5cGUiLCJSaWdpZEJvZHlDb21wb25lbnREYXRhIiwiY29udGFjdFBvaW50UG9vbCIsImNvbnRhY3RSZXN1bHRQb29sIiwic2luZ2xlQ29udGFjdFJlc3VsdFBvb2wiLCJzY2hlbWEiLCJjb2xsaXNpb25zIiwiZnJhbWVDb2xsaXNpb25zIiwib24iLCJvbkJlZm9yZVJlbW92ZSIsIm9uUmVtb3ZlIiwib25MaWJyYXJ5TG9hZGVkIiwiQW1tbyIsImNvbGxpc2lvbkNvbmZpZ3VyYXRpb24iLCJidERlZmF1bHRDb2xsaXNpb25Db25maWd1cmF0aW9uIiwiZGlzcGF0Y2hlciIsImJ0Q29sbGlzaW9uRGlzcGF0Y2hlciIsIm92ZXJsYXBwaW5nUGFpckNhY2hlIiwiYnREYnZ0QnJvYWRwaGFzZSIsInNvbHZlciIsImJ0U2VxdWVudGlhbEltcHVsc2VDb25zdHJhaW50U29sdmVyIiwiZHluYW1pY3NXb3JsZCIsImJ0RGlzY3JldGVEeW5hbWljc1dvcmxkIiwic2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2siLCJjaGVja0ZvckNvbGxpc2lvbnNQb2ludGVyIiwiYWRkRnVuY3Rpb24iLCJfY2hlY2tGb3JDb2xsaXNpb25zIiwiYmluZCIsIkRlYnVnIiwid2FybiIsImJ0VmVjdG9yMyIsIk9iamVjdFBvb2wiLCJzeXN0ZW1zIiwib25VcGRhdGUiLCJvZmYiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsImNvbXBvbmVudCIsImRhdGEiLCJwcm9wZXJ0aWVzIiwicHJvcHMiLCJwcm9wZXJ0eSIsImhhc093blByb3BlcnR5IiwidmFsdWUiLCJBcnJheSIsImlzQXJyYXkiLCJjbG9uZUNvbXBvbmVudCIsImNsb25lIiwicmlnaWRib2R5IiwiZW5hYmxlZCIsIm1hc3MiLCJsaW5lYXJEYW1waW5nIiwiYW5ndWxhckRhbXBpbmciLCJsaW5lYXJGYWN0b3IiLCJ4IiwieSIsInoiLCJhbmd1bGFyRmFjdG9yIiwiZnJpY3Rpb24iLCJyb2xsaW5nRnJpY3Rpb24iLCJyZXN0aXR1dGlvbiIsInR5cGUiLCJncm91cCIsIm1hc2siLCJhZGRDb21wb25lbnQiLCJib2R5IiwicmVtb3ZlQm9keSIsImRlc3Ryb3lCb2R5IiwiYWRkQm9keSIsInVuZGVmaW5lZCIsImFkZFJpZ2lkQm9keSIsInJlbW92ZVJpZ2lkQm9keSIsImNyZWF0ZUJvZHkiLCJzaGFwZSIsInRyYW5zZm9ybSIsImxvY2FsSW5lcnRpYSIsImNhbGN1bGF0ZUxvY2FsSW5lcnRpYSIsIm1vdGlvblN0YXRlIiwiYnREZWZhdWx0TW90aW9uU3RhdGUiLCJib2R5SW5mbyIsImJ0UmlnaWRCb2R5Q29uc3RydWN0aW9uSW5mbyIsImJ0UmlnaWRCb2R5IiwiZGVzdHJveSIsImdldE1vdGlvblN0YXRlIiwicmF5Y2FzdEZpcnN0Iiwic3RhcnQiLCJlbmQiLCJyZXN1bHQiLCJzZXRWYWx1ZSIsInJheUNhbGxiYWNrIiwiQ2xvc2VzdFJheVJlc3VsdENhbGxiYWNrIiwicmF5VGVzdCIsImhhc0hpdCIsImNvbGxpc2lvbk9iaiIsImdldF9tX2NvbGxpc2lvbk9iamVjdCIsImNhc3RPYmplY3QiLCJnZXRfbV9oaXRQb2ludFdvcmxkIiwiZ2V0X21faGl0Tm9ybWFsV29ybGQiLCJkZXByZWNhdGVkIiwiY2FsbGJhY2siLCJyYXljYXN0QWxsIiwiYXNzZXJ0IiwiQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrIiwicmVzdWx0cyIsImNvbGxpc2lvbk9ianMiLCJnZXRfbV9jb2xsaXNpb25PYmplY3RzIiwicG9pbnRzIiwibm9ybWFscyIsIm51bUhpdHMiLCJzaXplIiwiaSIsImF0IiwicHVzaCIsIl9zdG9yZUNvbGxpc2lvbiIsImlzTmV3Q29sbGlzaW9uIiwiZ3VpZCIsImdldEd1aWQiLCJvdGhlcnMiLCJpbmRleE9mIiwiX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vIiwiZ2V0X21fbG9jYWxQb2ludEEiLCJnZXRfbV9sb2NhbFBvaW50QiIsInBvc2l0aW9uV29ybGRPbkEiLCJnZXRQb3NpdGlvbldvcmxkT25BIiwicG9zaXRpb25Xb3JsZE9uQiIsImdldFBvc2l0aW9uV29ybGRPbkIiLCJub3JtYWxXb3JsZE9uQiIsImdldF9tX25vcm1hbFdvcmxkT25CIiwiY29udGFjdCIsImFsbG9jYXRlIiwic2V0IiwiZ2V0QXBwbGllZEltcHVsc2UiLCJfY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vIiwiX2NyZWF0ZVNpbmdsZUNvbnRhY3RSZXN1bHQiLCJfY3JlYXRlQ29udGFjdFJlc3VsdCIsIl9jbGVhbk9sZENvbGxpc2lvbnMiLCJmcmFtZUNvbGxpc2lvbiIsImNvbGxpc2lvbiIsImVudGl0eUNvbGxpc2lvbiIsImVudGl0eVJpZ2lkYm9keSIsInNwbGljZSIsInRyaWdnZXIiLCJmaXJlIiwiX2hhc0NvbnRhY3RFdmVudCIsImMiLCJoYXNFdmVudCIsInIiLCJ3b3JsZCIsInRpbWVTdGVwIiwid3JhcFBvaW50ZXIiLCJidER5bmFtaWNzV29ybGQiLCJnZXREaXNwYXRjaGVyIiwibnVtTWFuaWZvbGRzIiwiZ2V0TnVtTWFuaWZvbGRzIiwibWFuaWZvbGQiLCJnZXRNYW5pZm9sZEJ5SW5kZXhJbnRlcm5hbCIsImJvZHkwIiwiZ2V0Qm9keTAiLCJib2R5MSIsImdldEJvZHkxIiwid2IwIiwid2IxIiwiZTAiLCJlMSIsImZsYWdzMCIsImdldENvbGxpc2lvbkZsYWdzIiwiZmxhZ3MxIiwibnVtQ29udGFjdHMiLCJnZXROdW1Db250YWN0cyIsImZvcndhcmRDb250YWN0cyIsInJldmVyc2VDb250YWN0cyIsIm5ld0NvbGxpc2lvbiIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiZTBFdmVudHMiLCJlMUV2ZW50cyIsImUwQm9keUV2ZW50cyIsImUxQm9keUV2ZW50cyIsImdsb2JhbEV2ZW50cyIsImoiLCJidENvbnRhY3RQb2ludCIsImdldENvbnRhY3RQb2ludCIsInJldmVyc2VDb250YWN0UG9pbnQiLCJmb3J3YXJkUmVzdWx0IiwicmV2ZXJzZVJlc3VsdCIsImZyZWVBbGwiLCJkdCIsImxlbiIsInBoeXNpY3NTdGFydCIsIm5vdyIsImdldEdyYXZpdHkiLCJzZXRHcmF2aXR5IiwidHJpZ2dlcnMiLCJ1cGRhdGVUcmFuc2Zvcm0iLCJjb21wb3VuZHMiLCJfdXBkYXRlQ29tcG91bmQiLCJraW5lbWF0aWMiLCJfdXBkYXRlS2luZW1hdGljIiwic3RlcFNpbXVsYXRpb24iLCJkeW5hbWljIiwiX3VwZGF0ZUR5bmFtaWMiLCJnZXRQb2ludGVyIiwicGh5c2ljc1RpbWUiLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQWFBLElBQUlBLFlBQVksRUFBRUMsVUFBVSxDQUFBOztBQUs1QixNQUFNQyxhQUFhLENBQUM7QUFTaEJDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRTtJQU0vQixJQUFJLENBQUNGLE1BQU0sR0FBR0EsTUFBTSxDQUFBOztJQU9wQixJQUFJLENBQUNDLEtBQUssR0FBR0EsS0FBSyxDQUFBOztJQU9sQixJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3hC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
