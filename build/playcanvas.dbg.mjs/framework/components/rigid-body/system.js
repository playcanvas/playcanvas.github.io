/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../../core/time.js';
import { ObjectPool } from '../../../core/object-pool.js';
import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../math/vec3.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vc3lzdGVtLmpzJztcblxuaW1wb3J0IHsgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gQXBwQmFzZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG5cbmxldCBhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQ7XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIHN1Y2Nlc3NmdWwgcmF5Y2FzdCBoaXQuXG4gKi9cbmNsYXNzIFJheWNhc3RSZXN1bHQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBSYXljYXN0UmVzdWx0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcG9pbnQgYXQgd2hpY2ggdGhlIHJheSBoaXQgdGhlIGVudGl0eSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG5vcm1hbCAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBzdXJmYWNlIHdoZXJlIHRoZSByYXkgaGl0IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihlbnRpdHksIHBvaW50LCBub3JtYWwpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RW50aXR5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbnRpdHkgPSBlbnRpdHk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBhdCB3aGljaCB0aGUgcmF5IGhpdCB0aGUgZW50aXR5IGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnQgPSBwb2ludDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIHN1cmZhY2Ugd2hlcmUgdGhlIHJheSBoaXQgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ub3JtYWwgPSBub3JtYWw7XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAqL1xuY2xhc3MgU2luZ2xlQ29udGFjdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNpbmdsZUNvbnRhY3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gYSAtIFRoZSBmaXJzdCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGIgLSBUaGUgc2Vjb25kIGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgKiBAcGFyYW0ge0NvbnRhY3RQb2ludH0gY29udGFjdFBvaW50IC0gVGhlIGNvbnRhY3QgcG9pbnQgYmV0d2VlbiB0aGUgdHdvIGVudGl0aWVzLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGZpcnN0IGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7RW50aXR5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmEgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBzZWNvbmQgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuYiA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHRvdGFsIGFjY3VtdWxhdGVkIGltcHVsc2UgYXBwbGllZCBieSB0aGUgY29uc3RyYWludCBzb2x2ZXIgZHVyaW5nIHRoZSBsYXN0XG4gICAgICAgICAgICAgKiBzdWItc3RlcC4gRGVzY3JpYmVzIGhvdyBoYXJkIHR3byBib2RpZXMgY29sbGlkZWQuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5pbXB1bHNlID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEEgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvIEEuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQiB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gQi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBBIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5wb2ludEEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQiB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMucG9pbnRCID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgY29udGFjdCBvbiBFbnRpdHkgQiwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubm9ybWFsID0gbmV3IFZlYzMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYSA9IGE7XG4gICAgICAgICAgICB0aGlzLmIgPSBiO1xuICAgICAgICAgICAgdGhpcy5pbXB1bHNlID0gY29udGFjdFBvaW50LmltcHVsc2U7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnQ7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnRPdGhlcjtcbiAgICAgICAgICAgIHRoaXMucG9pbnRBID0gY29udGFjdFBvaW50LnBvaW50O1xuICAgICAgICAgICAgdGhpcy5wb2ludEIgPSBjb250YWN0UG9pbnQucG9pbnRPdGhlcjtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsID0gY29udGFjdFBvaW50Lm5vcm1hbDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBPYmplY3QgaG9sZGluZyB0aGUgcmVzdWx0IG9mIGEgY29udGFjdCBiZXR3ZWVuIHR3byBFbnRpdGllcy5cbiAqL1xuY2xhc3MgQ29udGFjdFBvaW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ29udGFjdFBvaW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbG9jYWxQb2ludF0gLSBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG9cbiAgICAgKiB0aGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2xvY2FsUG9pbnRPdGhlcl0gLSBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCxcbiAgICAgKiByZWxhdGl2ZSB0byB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50XSAtIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtwb2ludE90aGVyXSAtIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpblxuICAgICAqIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW25vcm1hbF0gLSBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgY29udGFjdCBvbiB0aGUgb3RoZXIgZW50aXR5LCBpbiB3b3JsZFxuICAgICAqIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaW1wdWxzZV0gLSBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlclxuICAgICAqIGR1cmluZyB0aGUgbGFzdCBzdWItc3RlcC4gRGVzY3JpYmVzIGhvdyBoYXJkIHR3byBvYmplY3RzIGNvbGxpZGUuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGxvY2FsUG9pbnQgPSBuZXcgVmVjMygpLCBsb2NhbFBvaW50T3RoZXIgPSBuZXcgVmVjMygpLCBwb2ludCA9IG5ldyBWZWMzKCksIHBvaW50T3RoZXIgPSBuZXcgVmVjMygpLCBub3JtYWwgPSBuZXcgVmVjMygpLCBpbXB1bHNlID0gMCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvIHRoZSBlbnRpdHkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbFBvaW50ID0gbG9jYWxQb2ludDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2NhbFBvaW50T3RoZXIgPSBsb2NhbFBvaW50T3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBvaW50ID0gcG9pbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBvaW50T3RoZXIgPSBwb2ludE90aGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgY29udGFjdCBvbiB0aGUgb3RoZXIgZW50aXR5LCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHRvdGFsIGFjY3VtdWxhdGVkIGltcHVsc2UgYXBwbGllZCBieSB0aGUgY29uc3RyYWludCBzb2x2ZXIgZHVyaW5nIHRoZSBsYXN0IHN1Yi1zdGVwLlxuICAgICAgICAgKiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIG9iamVjdHMgY29sbGlkZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW1wdWxzZSA9IGltcHVsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIEVudGl0aWVzLlxuICovXG5jbGFzcyBDb250YWN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ29udGFjdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3Qgd2l0aCB0aGlzIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge0NvbnRhY3RQb2ludFtdfSBjb250YWN0cyAtIEFuIGFycmF5IG9mIENvbnRhY3RQb2ludHMgd2l0aCB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihvdGhlciwgY29udGFjdHMpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3Qgd2l0aCB0aGlzIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub3RoZXIgPSBvdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQW4gYXJyYXkgb2YgQ29udGFjdFBvaW50cyB3aXRoIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtDb250YWN0UG9pbnRbXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGFjdHMgPSBjb250YWN0cztcbiAgICB9XG59XG5cbmNvbnN0IF9zY2hlbWEgPSBbJ2VuYWJsZWQnXTtcblxuLyoqXG4gKiBUaGUgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIG1haW50YWlucyB0aGUgZHluYW1pY3Mgd29ybGQgZm9yIHNpbXVsYXRpbmcgcmlnaWQgYm9kaWVzLCBpdCBhbHNvXG4gKiBjb250cm9scyBnbG9iYWwgdmFsdWVzIGZvciB0aGUgd29ybGQgc3VjaCBhcyBncmF2aXR5LiBOb3RlOiBUaGUgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIGlzIG9ubHlcbiAqIHZhbGlkIGlmIDNEIFBoeXNpY3MgaXMgZW5hYmxlZCBpbiB5b3VyIGFwcGxpY2F0aW9uLiBZb3UgY2FuIGVuYWJsZSB0aGlzIGluIHRoZSBhcHBsaWNhdGlvblxuICogc2V0dGluZ3MgZm9yIHlvdXIgcHJvamVjdC5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKi9cbmNsYXNzIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBleHRlbmRzIENvbXBvbmVudFN5c3RlbSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbWF4U3ViU3RlcHMgPSAxMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGZpeGVkVGltZVN0ZXAgPSAxIC8gNjA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd29ybGQgc3BhY2UgdmVjdG9yIHJlcHJlc2VudGluZyBnbG9iYWwgZ3Jhdml0eSBpbiB0aGUgcGh5c2ljcyBzaW11bGF0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIFswLCAtOS44MSwgMF0gd2hpY2ggaXMgYW4gYXBwcm94aW1hdGlvbiBvZiB0aGUgZ3Jhdml0YXRpb25hbCBmb3JjZSBvbiBFYXJ0aC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGdyYXZpdHkgPSBuZXcgVmVjMygwLCAtOS44MSwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmlnaWRCb2R5Q29tcG9uZW50W119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZHluYW1pYyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2tpbmVtYXRpYyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RyaWdnZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmlnaWRCb2R5Q29tcG9uZW50W119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY29tcG91bmRzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBCYXNlfSBhcHAgLSBUaGUgQXBwbGljYXRpb24uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAncmlnaWRib2R5JztcbiAgICAgICAgdGhpcy5fc3RhdHMgPSBhcHAuc3RhdHMuZnJhbWU7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gUmlnaWRCb2R5Q29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gUmlnaWRCb2R5Q29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLmNvbnRhY3RQb2ludFBvb2wgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbnRhY3RSZXN1bHRQb29sID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuXG4gICAgICAgIHRoaXMuY29sbGlzaW9ucyA9IHt9O1xuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9ucyA9IHt9O1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMub25CZWZvcmVSZW1vdmUsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgY29udGFjdCBvY2N1cnMgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNjb250YWN0XG4gICAgICogQHBhcmFtIHtTaW5nbGVDb250YWN0UmVzdWx0fSByZXN1bHQgLSBEZXRhaWxzIG9mIHRoZSBjb250YWN0IGJldHdlZW4gdGhlIHR3byBib2RpZXMuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgb25jZSBBbW1vIGhhcyBiZWVuIGxvYWRlZC4gUmVzcG9uc2libGUgZm9yIGNyZWF0aW5nIHRoZSBwaHlzaWNzIHdvcmxkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG9uTGlicmFyeUxvYWRlZCgpIHtcbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBBbW1vIHBoeXNpY3Mgd29ybGRcbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uID0gbmV3IEFtbW8uYnREZWZhdWx0Q29sbGlzaW9uQ29uZmlndXJhdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaGVyID0gbmV3IEFtbW8uYnRDb2xsaXNpb25EaXNwYXRjaGVyKHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbik7XG4gICAgICAgICAgICB0aGlzLm92ZXJsYXBwaW5nUGFpckNhY2hlID0gbmV3IEFtbW8uYnREYnZ0QnJvYWRwaGFzZSgpO1xuICAgICAgICAgICAgdGhpcy5zb2x2ZXIgPSBuZXcgQW1tby5idFNlcXVlbnRpYWxJbXB1bHNlQ29uc3RyYWludFNvbHZlcigpO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkID0gbmV3IEFtbW8uYnREaXNjcmV0ZUR5bmFtaWNzV29ybGQodGhpcy5kaXNwYXRjaGVyLCB0aGlzLm92ZXJsYXBwaW5nUGFpckNhY2hlLCB0aGlzLnNvbHZlciwgdGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZHluYW1pY3NXb3JsZC5zZXRJbnRlcm5hbFRpY2tDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoZWNrRm9yQ29sbGlzaW9uc1BvaW50ZXIgPSBBbW1vLmFkZEZ1bmN0aW9uKHRoaXMuX2NoZWNrRm9yQ29sbGlzaW9ucy5iaW5kKHRoaXMpLCAndmlmJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnNldEludGVybmFsVGlja0NhbGxiYWNrKGNoZWNrRm9yQ29sbGlzaW9uc1BvaW50ZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdXQVJOSU5HOiBUaGlzIHZlcnNpb24gb2YgYW1tby5qcyBjYW4gcG90ZW50aWFsbHkgZmFpbCB0byByZXBvcnQgY29udGFjdHMuIFBsZWFzZSB1cGRhdGUgaXQgdG8gdGhlIGxhdGVzdCB2ZXJzaW9uLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBMYXppbHkgY3JlYXRlIHRlbXAgdmFyc1xuICAgICAgICAgICAgYW1tb1JheVN0YXJ0ID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBhbW1vUmF5RW5kID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBSaWdpZEJvZHlDb21wb25lbnQub25MaWJyYXJ5TG9hZGVkKCk7XG5cbiAgICAgICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbCA9IG5ldyBPYmplY3RQb29sKENvbnRhY3RQb2ludCwgMSk7XG4gICAgICAgICAgICB0aGlzLmNvbnRhY3RSZXN1bHRQb29sID0gbmV3IE9iamVjdFBvb2woQ29udGFjdFJlc3VsdCwgMSk7XG4gICAgICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sID0gbmV3IE9iamVjdFBvb2woU2luZ2xlQ29udGFjdFJlc3VsdCwgMSk7XG5cbiAgICAgICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub24oJ3VwZGF0ZScsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVW5iaW5kIHRoZSB1cGRhdGUgZnVuY3Rpb24gaWYgd2UgaGF2ZW4ndCBsb2FkZWQgQW1tbyBieSBub3dcbiAgICAgICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBjb25zdCBwcm9wcyA9IFtcbiAgICAgICAgICAgICdtYXNzJyxcbiAgICAgICAgICAgICdsaW5lYXJEYW1waW5nJyxcbiAgICAgICAgICAgICdhbmd1bGFyRGFtcGluZycsXG4gICAgICAgICAgICAnbGluZWFyRmFjdG9yJyxcbiAgICAgICAgICAgICdhbmd1bGFyRmFjdG9yJyxcbiAgICAgICAgICAgICdmcmljdGlvbicsXG4gICAgICAgICAgICAncm9sbGluZ0ZyaWN0aW9uJyxcbiAgICAgICAgICAgICdyZXN0aXR1dGlvbicsXG4gICAgICAgICAgICAndHlwZScsXG4gICAgICAgICAgICAnZ3JvdXAnLFxuICAgICAgICAgICAgJ21hc2snXG4gICAgICAgIF07XG5cbiAgICAgICAgZm9yIChjb25zdCBwcm9wZXJ0eSBvZiBwcm9wcykge1xuICAgICAgICAgICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBkYXRhW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50W3Byb3BlcnR5XSA9IG5ldyBWZWMzKHZhbHVlWzBdLCB2YWx1ZVsxXSwgdmFsdWVbMl0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIFsnZW5hYmxlZCddKTtcbiAgICB9XG5cbiAgICBjbG9uZUNvbXBvbmVudChlbnRpdHksIGNsb25lKSB7XG4gICAgICAgIC8vIGNyZWF0ZSBuZXcgZGF0YSBibG9jayBmb3IgY2xvbmVcbiAgICAgICAgY29uc3QgcmlnaWRib2R5ID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHJpZ2lkYm9keS5lbmFibGVkLFxuICAgICAgICAgICAgbWFzczogcmlnaWRib2R5Lm1hc3MsXG4gICAgICAgICAgICBsaW5lYXJEYW1waW5nOiByaWdpZGJvZHkubGluZWFyRGFtcGluZyxcbiAgICAgICAgICAgIGFuZ3VsYXJEYW1waW5nOiByaWdpZGJvZHkuYW5ndWxhckRhbXBpbmcsXG4gICAgICAgICAgICBsaW5lYXJGYWN0b3I6IFtyaWdpZGJvZHkubGluZWFyRmFjdG9yLngsIHJpZ2lkYm9keS5saW5lYXJGYWN0b3IueSwgcmlnaWRib2R5LmxpbmVhckZhY3Rvci56XSxcbiAgICAgICAgICAgIGFuZ3VsYXJGYWN0b3I6IFtyaWdpZGJvZHkuYW5ndWxhckZhY3Rvci54LCByaWdpZGJvZHkuYW5ndWxhckZhY3Rvci55LCByaWdpZGJvZHkuYW5ndWxhckZhY3Rvci56XSxcbiAgICAgICAgICAgIGZyaWN0aW9uOiByaWdpZGJvZHkuZnJpY3Rpb24sXG4gICAgICAgICAgICByb2xsaW5nRnJpY3Rpb246IHJpZ2lkYm9keS5yb2xsaW5nRnJpY3Rpb24sXG4gICAgICAgICAgICByZXN0aXR1dGlvbjogcmlnaWRib2R5LnJlc3RpdHV0aW9uLFxuICAgICAgICAgICAgdHlwZTogcmlnaWRib2R5LnR5cGUsXG4gICAgICAgICAgICBncm91cDogcmlnaWRib2R5Lmdyb3VwLFxuICAgICAgICAgICAgbWFzazogcmlnaWRib2R5Lm1hc2tcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGhpcy5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGlmIChjb21wb25lbnQuZW5hYmxlZCkge1xuICAgICAgICAgICAgY29tcG9uZW50LmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlKGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBjb21wb25lbnQuYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQm9keShib2R5KTtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveUJvZHkoYm9keSk7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5ib2R5ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZEJvZHkoYm9keSwgZ3JvdXAsIG1hc2spIHtcbiAgICAgICAgaWYgKGdyb3VwICE9PSB1bmRlZmluZWQgJiYgbWFzayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuYWRkUmlnaWRCb2R5KGJvZHksIGdyb3VwLCBtYXNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5hZGRSaWdpZEJvZHkoYm9keSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVCb2R5KGJvZHkpIHtcbiAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnJlbW92ZVJpZ2lkQm9keShib2R5KTtcbiAgICB9XG5cbiAgICBjcmVhdGVCb2R5KG1hc3MsIHNoYXBlLCB0cmFuc2Zvcm0pIHtcbiAgICAgICAgY29uc3QgbG9jYWxJbmVydGlhID0gbmV3IEFtbW8uYnRWZWN0b3IzKDAsIDAsIDApO1xuICAgICAgICBpZiAobWFzcyAhPT0gMCkge1xuICAgICAgICAgICAgc2hhcGUuY2FsY3VsYXRlTG9jYWxJbmVydGlhKG1hc3MsIGxvY2FsSW5lcnRpYSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IG5ldyBBbW1vLmJ0RGVmYXVsdE1vdGlvblN0YXRlKHRyYW5zZm9ybSk7XG4gICAgICAgIGNvbnN0IGJvZHlJbmZvID0gbmV3IEFtbW8uYnRSaWdpZEJvZHlDb25zdHJ1Y3Rpb25JbmZvKG1hc3MsIG1vdGlvblN0YXRlLCBzaGFwZSwgbG9jYWxJbmVydGlhKTtcbiAgICAgICAgY29uc3QgYm9keSA9IG5ldyBBbW1vLmJ0UmlnaWRCb2R5KGJvZHlJbmZvKTtcbiAgICAgICAgQW1tby5kZXN0cm95KGJvZHlJbmZvKTtcbiAgICAgICAgQW1tby5kZXN0cm95KGxvY2FsSW5lcnRpYSk7XG5cbiAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgfVxuXG4gICAgZGVzdHJveUJvZHkoYm9keSkge1xuICAgICAgICAvLyBUaGUgbW90aW9uIHN0YXRlIG5lZWRzIHRvIGJlIGRlc3Ryb3llZCBleHBsaWNpdGx5IChpZiBwcmVzZW50KVxuICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IGJvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgaWYgKG1vdGlvblN0YXRlKSB7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kobW90aW9uU3RhdGUpO1xuICAgICAgICB9XG4gICAgICAgIEFtbW8uZGVzdHJveShib2R5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSYXljYXN0IHRoZSB3b3JsZCBhbmQgcmV0dXJuIHRoZSBmaXJzdCBlbnRpdHkgdGhlIHJheSBoaXRzLiBGaXJlIGEgcmF5IGludG8gdGhlIHdvcmxkIGZyb21cbiAgICAgKiBzdGFydCB0byBlbmQsIGlmIHRoZSByYXkgaGl0cyBhbiBlbnRpdHkgd2l0aCBhIGNvbGxpc2lvbiBjb21wb25lbnQsIGl0IHJldHVybnMgYVxuICAgICAqIHtAbGluayBSYXljYXN0UmVzdWx0fSwgb3RoZXJ3aXNlIHJldHVybnMgbnVsbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBUaGUgd29ybGQgc3BhY2UgcG9pbnQgd2hlcmUgdGhlIHJheSBzdGFydHMuXG4gICAgICogQHBhcmFtIHtWZWMzfSBlbmQgLSBUaGUgd29ybGQgc3BhY2UgcG9pbnQgd2hlcmUgdGhlIHJheSBlbmRzLlxuICAgICAqIEByZXR1cm5zIHtSYXljYXN0UmVzdWx0fSBUaGUgcmVzdWx0IG9mIHRoZSByYXljYXN0aW5nIG9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIGhpdC5cbiAgICAgKi9cbiAgICByYXljYXN0Rmlyc3Qoc3RhcnQsIGVuZCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBhbW1vUmF5U3RhcnQuc2V0VmFsdWUoc3RhcnQueCwgc3RhcnQueSwgc3RhcnQueik7XG4gICAgICAgIGFtbW9SYXlFbmQuc2V0VmFsdWUoZW5kLngsIGVuZC55LCBlbmQueik7XG4gICAgICAgIGNvbnN0IHJheUNhbGxiYWNrID0gbmV3IEFtbW8uQ2xvc2VzdFJheVJlc3VsdENhbGxiYWNrKGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCk7XG5cbiAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnJheVRlc3QoYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kLCByYXlDYWxsYmFjayk7XG4gICAgICAgIGlmIChyYXlDYWxsYmFjay5oYXNIaXQoKSkge1xuICAgICAgICAgICAgY29uc3QgY29sbGlzaW9uT2JqID0gcmF5Q2FsbGJhY2suZ2V0X21fY29sbGlzaW9uT2JqZWN0KCk7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gQW1tby5jYXN0T2JqZWN0KGNvbGxpc2lvbk9iaiwgQW1tby5idFJpZ2lkQm9keSk7XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvaW50ID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0UG9pbnRXb3JsZCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbCA9IHJheUNhbGxiYWNrLmdldF9tX2hpdE5vcm1hbFdvcmxkKCk7XG5cbiAgICAgICAgICAgICAgICByZXN1bHQgPSBuZXcgUmF5Y2FzdFJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYm9keS5lbnRpdHksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKHBvaW50LngoKSwgcG9pbnQueSgpLCBwb2ludC56KCkpLFxuICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhub3JtYWwueCgpLCBub3JtYWwueSgpLCBub3JtYWwueigpKVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAvLyBrZWVwaW5nIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jcmF5Q2FzdEZpcnN0IG5vIGxvbmdlciByZXF1aXJlcyBhIGNhbGxiYWNrLiBUaGUgcmVzdWx0IG9mIHRoZSByYXljYXN0IGlzIHJldHVybmVkIGJ5IHRoZSBmdW5jdGlvbiBpbnN0ZWFkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gYXJndW1lbnRzWzJdO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShyYXlDYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSYXljYXN0IHRoZSB3b3JsZCBhbmQgcmV0dXJuIGFsbCBlbnRpdGllcyB0aGUgcmF5IGhpdHMuIEl0IHJldHVybnMgYW4gYXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgUmF5Y2FzdFJlc3VsdH0sIG9uZSBmb3IgZWFjaCBoaXQuIElmIG5vIGhpdHMgYXJlIGRldGVjdGVkLCB0aGUgcmV0dXJuZWQgYXJyYXkgd2lsbCBiZVxuICAgICAqIG9mIGxlbmd0aCAwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHJldHVybnMge1JheWNhc3RSZXN1bHRbXX0gQW4gYXJyYXkgb2YgcmF5Y2FzdCBoaXQgcmVzdWx0cyAoMCBsZW5ndGggaWYgdGhlcmUgd2VyZSBubyBoaXRzKS5cbiAgICAgKi9cbiAgICByYXljYXN0QWxsKHN0YXJ0LCBlbmQpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrLCAncGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI3JheWNhc3RBbGw6IFlvdXIgdmVyc2lvbiBvZiBhbW1vLmpzIGRvZXMgbm90IGV4cG9zZSBBbW1vLkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjay4gVXBkYXRlIGl0IHRvIGxhdGVzdC4nKTtcblxuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgYW1tb1JheVN0YXJ0LnNldFZhbHVlKHN0YXJ0LngsIHN0YXJ0LnksIHN0YXJ0LnopO1xuICAgICAgICBhbW1vUmF5RW5kLnNldFZhbHVlKGVuZC54LCBlbmQueSwgZW5kLnopO1xuICAgICAgICBjb25zdCByYXlDYWxsYmFjayA9IG5ldyBBbW1vLkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjayhhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQpO1xuXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5yYXlUZXN0KGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCwgcmF5Q2FsbGJhY2spO1xuICAgICAgICBpZiAocmF5Q2FsbGJhY2suaGFzSGl0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbk9ianMgPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3RzKCk7XG4gICAgICAgICAgICBjb25zdCBwb2ludHMgPSByYXlDYWxsYmFjay5nZXRfbV9oaXRQb2ludFdvcmxkKCk7XG4gICAgICAgICAgICBjb25zdCBub3JtYWxzID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0Tm9ybWFsV29ybGQoKTtcblxuICAgICAgICAgICAgY29uc3QgbnVtSGl0cyA9IGNvbGxpc2lvbk9ianMuc2l6ZSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1IaXRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib2R5ID0gQW1tby5jYXN0T2JqZWN0KGNvbGxpc2lvbk9ianMuYXQoaSksIEFtbW8uYnRSaWdpZEJvZHkpO1xuICAgICAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvaW50ID0gcG9pbnRzLmF0KGkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWwgPSBub3JtYWxzLmF0KGkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgUmF5Y2FzdFJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHkuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMocG9pbnQueCgpLCBwb2ludC55KCksIHBvaW50LnooKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhub3JtYWwueCgpLCBub3JtYWwueSgpLCBub3JtYWwueigpKVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBBbW1vLmRlc3Ryb3kocmF5Q2FsbGJhY2spO1xuXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3JlcyBhIGNvbGxpc2lvbiBiZXR3ZWVuIHRoZSBlbnRpdHkgYW5kIG90aGVyIGluIHRoZSBjb250YWN0cyBtYXAgYW5kIHJldHVybnMgdHJ1ZSBpZiBpdFxuICAgICAqIGlzIGEgbmV3IGNvbGxpc2lvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCBjb2xsaWRlcyB3aXRoIHRoZSBmaXJzdCBlbnRpdHkuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhpcyBpcyBhIG5ldyBjb2xsaXNpb24sIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zdG9yZUNvbGxpc2lvbihlbnRpdHksIG90aGVyKSB7XG4gICAgICAgIGxldCBpc05ld0NvbGxpc2lvbiA9IGZhbHNlO1xuICAgICAgICBjb25zdCBndWlkID0gZW50aXR5LmdldEd1aWQoKTtcblxuICAgICAgICB0aGlzLmNvbGxpc2lvbnNbZ3VpZF0gPSB0aGlzLmNvbGxpc2lvbnNbZ3VpZF0gfHwgeyBvdGhlcnM6IFtdLCBlbnRpdHk6IGVudGl0eSB9O1xuXG4gICAgICAgIGlmICh0aGlzLmNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLmluZGV4T2Yob3RoZXIpIDwgMCkge1xuICAgICAgICAgICAgdGhpcy5jb2xsaXNpb25zW2d1aWRdLm90aGVycy5wdXNoKG90aGVyKTtcbiAgICAgICAgICAgIGlzTmV3Q29sbGlzaW9uID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdID0gdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0gfHwgeyBvdGhlcnM6IFtdLCBlbnRpdHk6IGVudGl0eSB9O1xuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXS5vdGhlcnMucHVzaChvdGhlcik7XG5cbiAgICAgICAgcmV0dXJuIGlzTmV3Q29sbGlzaW9uO1xuICAgIH1cblxuICAgIF9jcmVhdGVDb250YWN0UG9pbnRGcm9tQW1tbyhjb250YWN0UG9pbnQpIHtcbiAgICAgICAgY29uc3QgbG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQuZ2V0X21fbG9jYWxQb2ludEEoKTtcbiAgICAgICAgY29uc3QgbG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQuZ2V0X21fbG9jYWxQb2ludEIoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQSA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25BKCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uV29ybGRPbkIgPSBjb250YWN0UG9pbnQuZ2V0UG9zaXRpb25Xb3JsZE9uQigpO1xuICAgICAgICBjb25zdCBub3JtYWxXb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRfbV9ub3JtYWxXb3JsZE9uQigpO1xuXG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSB0aGlzLmNvbnRhY3RQb2ludFBvb2wuYWxsb2NhdGUoKTtcbiAgICAgICAgY29udGFjdC5sb2NhbFBvaW50LnNldChsb2NhbFBvaW50QS54KCksIGxvY2FsUG9pbnRBLnkoKSwgbG9jYWxQb2ludEEueigpKTtcbiAgICAgICAgY29udGFjdC5sb2NhbFBvaW50T3RoZXIuc2V0KGxvY2FsUG9pbnRCLngoKSwgbG9jYWxQb2ludEIueSgpLCBsb2NhbFBvaW50Qi56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50LnNldChwb3NpdGlvbldvcmxkT25BLngoKSwgcG9zaXRpb25Xb3JsZE9uQS55KCksIHBvc2l0aW9uV29ybGRPbkEueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludE90aGVyLnNldChwb3NpdGlvbldvcmxkT25CLngoKSwgcG9zaXRpb25Xb3JsZE9uQi55KCksIHBvc2l0aW9uV29ybGRPbkIueigpKTtcbiAgICAgICAgY29udGFjdC5ub3JtYWwuc2V0KG5vcm1hbFdvcmxkT25CLngoKSwgbm9ybWFsV29ybGRPbkIueSgpLCBub3JtYWxXb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0LmltcHVsc2UgPSBjb250YWN0UG9pbnQuZ2V0QXBwbGllZEltcHVsc2UoKTtcbiAgICAgICAgcmV0dXJuIGNvbnRhY3Q7XG4gICAgfVxuXG4gICAgX2NyZWF0ZVJldmVyc2VDb250YWN0UG9pbnRGcm9tQW1tbyhjb250YWN0UG9pbnQpIHtcbiAgICAgICAgY29uc3QgbG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQuZ2V0X21fbG9jYWxQb2ludEEoKTtcbiAgICAgICAgY29uc3QgbG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQuZ2V0X21fbG9jYWxQb2ludEIoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQSA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25BKCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uV29ybGRPbkIgPSBjb250YWN0UG9pbnQuZ2V0UG9zaXRpb25Xb3JsZE9uQigpO1xuICAgICAgICBjb25zdCBub3JtYWxXb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRfbV9ub3JtYWxXb3JsZE9uQigpO1xuXG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSB0aGlzLmNvbnRhY3RQb2ludFBvb2wuYWxsb2NhdGUoKTtcbiAgICAgICAgY29udGFjdC5sb2NhbFBvaW50T3RoZXIuc2V0KGxvY2FsUG9pbnRBLngoKSwgbG9jYWxQb2ludEEueSgpLCBsb2NhbFBvaW50QS56KCkpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnQuc2V0KGxvY2FsUG9pbnRCLngoKSwgbG9jYWxQb2ludEIueSgpLCBsb2NhbFBvaW50Qi56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50T3RoZXIuc2V0KHBvc2l0aW9uV29ybGRPbkEueCgpLCBwb3NpdGlvbldvcmxkT25BLnkoKSwgcG9zaXRpb25Xb3JsZE9uQS56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50LnNldChwb3NpdGlvbldvcmxkT25CLngoKSwgcG9zaXRpb25Xb3JsZE9uQi55KCksIHBvc2l0aW9uV29ybGRPbkIueigpKTtcbiAgICAgICAgY29udGFjdC5ub3JtYWwuc2V0KG5vcm1hbFdvcmxkT25CLngoKSwgbm9ybWFsV29ybGRPbkIueSgpLCBub3JtYWxXb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0LmltcHVsc2UgPSBjb250YWN0UG9pbnQuZ2V0QXBwbGllZEltcHVsc2UoKTtcbiAgICAgICAgcmV0dXJuIGNvbnRhY3Q7XG4gICAgfVxuXG4gICAgX2NyZWF0ZVNpbmdsZUNvbnRhY3RSZXN1bHQoYSwgYiwgY29udGFjdFBvaW50KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wuYWxsb2NhdGUoKTtcblxuICAgICAgICByZXN1bHQuYSA9IGE7XG4gICAgICAgIHJlc3VsdC5iID0gYjtcbiAgICAgICAgcmVzdWx0LmxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnQ7XG4gICAgICAgIHJlc3VsdC5sb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50T3RoZXI7XG4gICAgICAgIHJlc3VsdC5wb2ludEEgPSBjb250YWN0UG9pbnQucG9pbnQ7XG4gICAgICAgIHJlc3VsdC5wb2ludEIgPSBjb250YWN0UG9pbnQucG9pbnRPdGhlcjtcbiAgICAgICAgcmVzdWx0Lm5vcm1hbCA9IGNvbnRhY3RQb2ludC5ub3JtYWw7XG4gICAgICAgIHJlc3VsdC5pbXB1bHNlID0gY29udGFjdFBvaW50LmltcHVsc2U7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlQ29udGFjdFJlc3VsdChvdGhlciwgY29udGFjdHMpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jb250YWN0UmVzdWx0UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICByZXN1bHQub3RoZXIgPSBvdGhlcjtcbiAgICAgICAgcmVzdWx0LmNvbnRhY3RzID0gY29udGFjdHM7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBjb2xsaXNpb25zIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IGZyb20gdGhlIGNvbGxpc2lvbnMgbGlzdCBhbmQgZmlyZXMgY29sbGlzaW9uZW5kXG4gICAgICogZXZlbnRzIHRvIHRoZSByZWxhdGVkIGVudGl0aWVzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xlYW5PbGRDb2xsaXNpb25zKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGd1aWQgaW4gdGhpcy5jb2xsaXNpb25zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jb2xsaXNpb25zLmhhc093blByb3BlcnR5KGd1aWQpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVDb2xsaXNpb24gPSB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xsaXNpb24gPSB0aGlzLmNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gY29sbGlzaW9uLmVudGl0eTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlDb2xsaXNpb24gPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eVJpZ2lkYm9keSA9IGVudGl0eS5yaWdpZGJvZHk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3RoZXJzID0gY29sbGlzaW9uLm90aGVycztcbiAgICAgICAgICAgICAgICBjb25zdCBsZW5ndGggPSBvdGhlcnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGxldCBpID0gbGVuZ3RoO1xuICAgICAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3RoZXIgPSBvdGhlcnNbaV07XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBjb250YWN0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBjdXJyZW50IGZyYW1lIGNvbGxpc2lvbnMgdGhlbiBmaXJlIGV2ZW50XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnJhbWVDb2xsaXNpb24gfHwgZnJhbWVDb2xsaXNpb24ub3RoZXJzLmluZGV4T2Yob3RoZXIpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gb3RoZXJzIGxpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIG90aGVycy5zcGxpY2UoaSwgMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBhIHRyaWdnZXIgZW50aXR5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eUNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlDb2xsaXNpb24uZmlyZSgndHJpZ2dlcmxlYXZlJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob3RoZXIucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyLnJpZ2lkYm9keS5maXJlKCd0cmlnZ2VybGVhdmUnLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIW90aGVyLnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzdXBwcmVzcyBldmVudHMgaWYgdGhlIG90aGVyIGVudGl0eSBpcyBhIHRyaWdnZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5UmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eVJpZ2lkYm9keS5maXJlKCdjb2xsaXNpb25lbmQnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5Q29sbGlzaW9uLmZpcmUoJ2NvbGxpc2lvbmVuZCcsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3RoZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5jb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZW50aXR5IGhhcyBhIGNvbnRhY3QgZXZlbnQgYXR0YWNoZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbnRpdHkgLSBFbnRpdHkgdG8gdGVzdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgZW50aXR5IGhhcyBhIGNvbnRhY3QgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYXNDb250YWN0RXZlbnQoZW50aXR5KSB7XG4gICAgICAgIGNvbnN0IGMgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICBpZiAoYyAmJiAoYy5oYXNFdmVudCgnY29sbGlzaW9uc3RhcnQnKSB8fCBjLmhhc0V2ZW50KCdjb2xsaXNpb25lbmQnKSB8fCBjLmhhc0V2ZW50KCdjb250YWN0JykpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHIgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICByZXR1cm4gciAmJiAoci5oYXNFdmVudCgnY29sbGlzaW9uc3RhcnQnKSB8fCByLmhhc0V2ZW50KCdjb2xsaXNpb25lbmQnKSB8fCByLmhhc0V2ZW50KCdjb250YWN0JykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBmb3IgY29sbGlzaW9ucyBhbmQgZmlyZXMgY29sbGlzaW9uIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3b3JsZCAtIFRoZSBwb2ludGVyIHRvIHRoZSBkeW5hbWljcyB3b3JsZCB0aGF0IGludm9rZWQgdGhpcyBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGltZVN0ZXAgLSBUaGUgYW1vdW50IG9mIHNpbXVsYXRpb24gdGltZSBwcm9jZXNzZWQgaW4gdGhlIGxhc3Qgc2ltdWxhdGlvbiB0aWNrLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NoZWNrRm9yQ29sbGlzaW9ucyh3b3JsZCwgdGltZVN0ZXApIHtcbiAgICAgICAgY29uc3QgZHluYW1pY3NXb3JsZCA9IEFtbW8ud3JhcFBvaW50ZXIod29ybGQsIEFtbW8uYnREeW5hbWljc1dvcmxkKTtcblxuICAgICAgICAvLyBDaGVjayBmb3IgY29sbGlzaW9ucyBhbmQgZmlyZSBjYWxsYmFja3NcbiAgICAgICAgY29uc3QgZGlzcGF0Y2hlciA9IGR5bmFtaWNzV29ybGQuZ2V0RGlzcGF0Y2hlcigpO1xuICAgICAgICBjb25zdCBudW1NYW5pZm9sZHMgPSBkaXNwYXRjaGVyLmdldE51bU1hbmlmb2xkcygpO1xuXG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBhbGwgY29udGFjdHMgYW5kIGZpcmUgZXZlbnRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtTWFuaWZvbGRzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1hbmlmb2xkID0gZGlzcGF0Y2hlci5nZXRNYW5pZm9sZEJ5SW5kZXhJbnRlcm5hbChpKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keTAgPSBtYW5pZm9sZC5nZXRCb2R5MCgpO1xuICAgICAgICAgICAgY29uc3QgYm9keTEgPSBtYW5pZm9sZC5nZXRCb2R5MSgpO1xuXG4gICAgICAgICAgICBjb25zdCB3YjAgPSBBbW1vLmNhc3RPYmplY3QoYm9keTAsIEFtbW8uYnRSaWdpZEJvZHkpO1xuICAgICAgICAgICAgY29uc3Qgd2IxID0gQW1tby5jYXN0T2JqZWN0KGJvZHkxLCBBbW1vLmJ0UmlnaWRCb2R5KTtcblxuICAgICAgICAgICAgY29uc3QgZTAgPSB3YjAuZW50aXR5O1xuICAgICAgICAgICAgY29uc3QgZTEgPSB3YjEuZW50aXR5O1xuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBlbnRpdHkgaXMgbnVsbCAtIFRPRE86IGludmVzdGlnYXRlIHdoZW4gdGhpcyBoYXBwZW5zXG4gICAgICAgICAgICBpZiAoIWUwIHx8ICFlMSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmbGFnczAgPSB3YjAuZ2V0Q29sbGlzaW9uRmxhZ3MoKTtcbiAgICAgICAgICAgIGNvbnN0IGZsYWdzMSA9IHdiMS5nZXRDb2xsaXNpb25GbGFncygpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1Db250YWN0cyA9IG1hbmlmb2xkLmdldE51bUNvbnRhY3RzKCk7XG4gICAgICAgICAgICBjb25zdCBmb3J3YXJkQ29udGFjdHMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHJldmVyc2VDb250YWN0cyA9IFtdO1xuICAgICAgICAgICAgbGV0IG5ld0NvbGxpc2lvbjtcblxuICAgICAgICAgICAgaWYgKG51bUNvbnRhY3RzID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IGZpcmUgY29udGFjdCBldmVudHMgZm9yIHRyaWdnZXJzXG4gICAgICAgICAgICAgICAgaWYgKChmbGFnczAgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGZsYWdzMSAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwRXZlbnRzID0gZTAuY29sbGlzaW9uICYmIChlMC5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUwLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUV2ZW50cyA9IGUxLmNvbGxpc2lvbiAmJiAoZTEuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMS5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTBCb2R5RXZlbnRzID0gZTAucmlnaWRib2R5ICYmIChlMC5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUwLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUJvZHlFdmVudHMgPSBlMS5yaWdpZGJvZHkgJiYgKGUxLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTEucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSB0cmlnZ2VyZW50ZXIgZXZlbnRzIGZvciB0cmlnZ2Vyc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUwLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uICYmICEoZmxhZ3MxICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTEsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24gJiYgIShmbGFnczAgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgndHJpZ2dlcmVudGVyJywgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSB0cmlnZ2VyZW50ZXIgZXZlbnRzIGZvciByaWdpZGJvZGllc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZTBCb2R5RXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5yaWdpZGJvZHkuZmlyZSgndHJpZ2dlcmVudGVyJywgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGUxQm9keUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwRXZlbnRzID0gdGhpcy5faGFzQ29udGFjdEV2ZW50KGUwKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFFdmVudHMgPSB0aGlzLl9oYXNDb250YWN0RXZlbnQoZTEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBnbG9iYWxFdmVudHMgPSB0aGlzLmhhc0V2ZW50KCdjb250YWN0Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsb2JhbEV2ZW50cyB8fCBlMEV2ZW50cyB8fCBlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1Db250YWN0czsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnRDb250YWN0UG9pbnQgPSBtYW5pZm9sZC5nZXRDb250YWN0UG9pbnQoaik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGFjdFBvaW50ID0gdGhpcy5fY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8oYnRDb250YWN0UG9pbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzIHx8IGUxRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcndhcmRDb250YWN0cy5wdXNoKGNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmVyc2VDb250YWN0UG9pbnQgPSB0aGlzLl9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8oYnRDb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlQ29udGFjdHMucHVzaChyZXZlcnNlQ29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2xvYmFsRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgZ2xvYmFsIGNvbnRhY3QgZXZlbnQgZm9yIGV2ZXJ5IGNvbnRhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChlMCwgZTEsIGNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnY29udGFjdCcsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkUmVzdWx0ID0gdGhpcy5fY3JlYXRlQ29udGFjdFJlc3VsdChlMSwgZm9yd2FyZENvbnRhY3RzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwLmNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgnY29udGFjdCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uc3RhcnQnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMC5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ2NvbnRhY3QnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmVyc2VSZXN1bHQgPSB0aGlzLl9jcmVhdGVDb250YWN0UmVzdWx0KGUwLCByZXZlcnNlQ29udGFjdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTEuY29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCdjb250YWN0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCdjb2xsaXNpb25zdGFydCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgnY29udGFjdCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgnY29sbGlzaW9uc3RhcnQnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGZvciBjb2xsaXNpb25zIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IGFuZCBmaXJlIGV2ZW50c1xuICAgICAgICB0aGlzLl9jbGVhbk9sZENvbGxpc2lvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBjb250YWN0IHBvb2xzXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbC5mcmVlQWxsKCk7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wuZnJlZUFsbCgpO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sLmZyZWVBbGwoKTtcbiAgICB9XG5cbiAgICBvblVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgaSwgbGVuO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMucGh5c2ljc1N0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIENoZWNrIHRvIHNlZSB3aGV0aGVyIHdlIG5lZWQgdG8gdXBkYXRlIGdyYXZpdHkgb24gdGhlIGR5bmFtaWNzIHdvcmxkXG4gICAgICAgIGNvbnN0IGdyYXZpdHkgPSB0aGlzLmR5bmFtaWNzV29ybGQuZ2V0R3Jhdml0eSgpO1xuICAgICAgICBpZiAoZ3Jhdml0eS54KCkgIT09IHRoaXMuZ3Jhdml0eS54IHx8IGdyYXZpdHkueSgpICE9PSB0aGlzLmdyYXZpdHkueSB8fCBncmF2aXR5LnooKSAhPT0gdGhpcy5ncmF2aXR5LnopIHtcbiAgICAgICAgICAgIGdyYXZpdHkuc2V0VmFsdWUodGhpcy5ncmF2aXR5LngsIHRoaXMuZ3Jhdml0eS55LCB0aGlzLmdyYXZpdHkueik7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0R3Jhdml0eShncmF2aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyaWdnZXJzID0gdGhpcy5fdHJpZ2dlcnM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHRyaWdnZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0cmlnZ2Vyc1tpXS51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbXBvdW5kcyA9IHRoaXMuX2NvbXBvdW5kcztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gY29tcG91bmRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb21wb3VuZHNbaV0uX3VwZGF0ZUNvbXBvdW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgYWxsIGtpbmVtYXRpYyBib2RpZXMgYmFzZWQgb24gdGhlaXIgY3VycmVudCBlbnRpdHkgdHJhbnNmb3JtXG4gICAgICAgIGNvbnN0IGtpbmVtYXRpYyA9IHRoaXMuX2tpbmVtYXRpYztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0ga2luZW1hdGljLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBraW5lbWF0aWNbaV0uX3VwZGF0ZUtpbmVtYXRpYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCB0aGUgcGh5c2ljcyBzaW11bGF0aW9uXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5zdGVwU2ltdWxhdGlvbihkdCwgdGhpcy5tYXhTdWJTdGVwcywgdGhpcy5maXhlZFRpbWVTdGVwKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHRyYW5zZm9ybXMgb2YgYWxsIGVudGl0aWVzIHJlZmVyZW5jaW5nIGEgZHluYW1pYyBib2R5XG4gICAgICAgIGNvbnN0IGR5bmFtaWMgPSB0aGlzLl9keW5hbWljO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBkeW5hbWljLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBkeW5hbWljW2ldLl91cGRhdGVEeW5hbWljKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZHluYW1pY3NXb3JsZC5zZXRJbnRlcm5hbFRpY2tDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX2NoZWNrRm9yQ29sbGlzaW9ucyhBbW1vLmdldFBvaW50ZXIodGhpcy5keW5hbWljc1dvcmxkKSwgZHQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMucGh5c2ljc1RpbWUgPSBub3coKSAtIHRoaXMuX3N0YXRzLnBoeXNpY3NTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5keW5hbWljc1dvcmxkKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLnNvbHZlcik7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5kaXNwYXRjaGVyKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuc29sdmVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaGVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IENvbnRhY3RQb2ludCwgQ29udGFjdFJlc3VsdCwgUmF5Y2FzdFJlc3VsdCwgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLCBTaW5nbGVDb250YWN0UmVzdWx0IH07XG4iXSwibmFtZXMiOlsiYW1tb1JheVN0YXJ0IiwiYW1tb1JheUVuZCIsIlJheWNhc3RSZXN1bHQiLCJjb25zdHJ1Y3RvciIsImVudGl0eSIsInBvaW50Iiwibm9ybWFsIiwiU2luZ2xlQ29udGFjdFJlc3VsdCIsImEiLCJiIiwiY29udGFjdFBvaW50IiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiaW1wdWxzZSIsImxvY2FsUG9pbnRBIiwiVmVjMyIsImxvY2FsUG9pbnRCIiwicG9pbnRBIiwicG9pbnRCIiwibG9jYWxQb2ludCIsImxvY2FsUG9pbnRPdGhlciIsInBvaW50T3RoZXIiLCJDb250YWN0UG9pbnQiLCJDb250YWN0UmVzdWx0Iiwib3RoZXIiLCJjb250YWN0cyIsIl9zY2hlbWEiLCJSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJhcHAiLCJtYXhTdWJTdGVwcyIsImZpeGVkVGltZVN0ZXAiLCJncmF2aXR5IiwiX2R5bmFtaWMiLCJfa2luZW1hdGljIiwiX3RyaWdnZXJzIiwiX2NvbXBvdW5kcyIsImlkIiwiX3N0YXRzIiwic3RhdHMiLCJmcmFtZSIsIkNvbXBvbmVudFR5cGUiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJEYXRhVHlwZSIsIlJpZ2lkQm9keUNvbXBvbmVudERhdGEiLCJjb250YWN0UG9pbnRQb29sIiwiY29udGFjdFJlc3VsdFBvb2wiLCJzaW5nbGVDb250YWN0UmVzdWx0UG9vbCIsInNjaGVtYSIsImNvbGxpc2lvbnMiLCJmcmFtZUNvbGxpc2lvbnMiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwib25SZW1vdmUiLCJvbkxpYnJhcnlMb2FkZWQiLCJBbW1vIiwiY29sbGlzaW9uQ29uZmlndXJhdGlvbiIsImJ0RGVmYXVsdENvbGxpc2lvbkNvbmZpZ3VyYXRpb24iLCJkaXNwYXRjaGVyIiwiYnRDb2xsaXNpb25EaXNwYXRjaGVyIiwib3ZlcmxhcHBpbmdQYWlyQ2FjaGUiLCJidERidnRCcm9hZHBoYXNlIiwic29sdmVyIiwiYnRTZXF1ZW50aWFsSW1wdWxzZUNvbnN0cmFpbnRTb2x2ZXIiLCJkeW5hbWljc1dvcmxkIiwiYnREaXNjcmV0ZUR5bmFtaWNzV29ybGQiLCJzZXRJbnRlcm5hbFRpY2tDYWxsYmFjayIsImNoZWNrRm9yQ29sbGlzaW9uc1BvaW50ZXIiLCJhZGRGdW5jdGlvbiIsIl9jaGVja0ZvckNvbGxpc2lvbnMiLCJiaW5kIiwiRGVidWciLCJ3YXJuIiwiYnRWZWN0b3IzIiwiT2JqZWN0UG9vbCIsInN5c3RlbXMiLCJvblVwZGF0ZSIsIm9mZiIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJwcm9wcyIsInByb3BlcnR5IiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsIkFycmF5IiwiaXNBcnJheSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJyaWdpZGJvZHkiLCJlbmFibGVkIiwibWFzcyIsImxpbmVhckRhbXBpbmciLCJhbmd1bGFyRGFtcGluZyIsImxpbmVhckZhY3RvciIsIngiLCJ5IiwieiIsImFuZ3VsYXJGYWN0b3IiLCJmcmljdGlvbiIsInJvbGxpbmdGcmljdGlvbiIsInJlc3RpdHV0aW9uIiwidHlwZSIsImdyb3VwIiwibWFzayIsImFkZENvbXBvbmVudCIsImJvZHkiLCJyZW1vdmVCb2R5IiwiZGVzdHJveUJvZHkiLCJhZGRCb2R5IiwidW5kZWZpbmVkIiwiYWRkUmlnaWRCb2R5IiwicmVtb3ZlUmlnaWRCb2R5IiwiY3JlYXRlQm9keSIsInNoYXBlIiwidHJhbnNmb3JtIiwibG9jYWxJbmVydGlhIiwiY2FsY3VsYXRlTG9jYWxJbmVydGlhIiwibW90aW9uU3RhdGUiLCJidERlZmF1bHRNb3Rpb25TdGF0ZSIsImJvZHlJbmZvIiwiYnRSaWdpZEJvZHlDb25zdHJ1Y3Rpb25JbmZvIiwiYnRSaWdpZEJvZHkiLCJkZXN0cm95IiwiZ2V0TW90aW9uU3RhdGUiLCJyYXljYXN0Rmlyc3QiLCJzdGFydCIsImVuZCIsInJlc3VsdCIsInNldFZhbHVlIiwicmF5Q2FsbGJhY2siLCJDbG9zZXN0UmF5UmVzdWx0Q2FsbGJhY2siLCJyYXlUZXN0IiwiaGFzSGl0IiwiY29sbGlzaW9uT2JqIiwiZ2V0X21fY29sbGlzaW9uT2JqZWN0IiwiY2FzdE9iamVjdCIsImdldF9tX2hpdFBvaW50V29ybGQiLCJnZXRfbV9oaXROb3JtYWxXb3JsZCIsImRlcHJlY2F0ZWQiLCJjYWxsYmFjayIsInJheWNhc3RBbGwiLCJhc3NlcnQiLCJBbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2siLCJyZXN1bHRzIiwiY29sbGlzaW9uT2JqcyIsImdldF9tX2NvbGxpc2lvbk9iamVjdHMiLCJwb2ludHMiLCJub3JtYWxzIiwibnVtSGl0cyIsInNpemUiLCJpIiwiYXQiLCJwdXNoIiwiX3N0b3JlQ29sbGlzaW9uIiwiaXNOZXdDb2xsaXNpb24iLCJndWlkIiwiZ2V0R3VpZCIsIm90aGVycyIsImluZGV4T2YiLCJfY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8iLCJnZXRfbV9sb2NhbFBvaW50QSIsImdldF9tX2xvY2FsUG9pbnRCIiwicG9zaXRpb25Xb3JsZE9uQSIsImdldFBvc2l0aW9uV29ybGRPbkEiLCJwb3NpdGlvbldvcmxkT25CIiwiZ2V0UG9zaXRpb25Xb3JsZE9uQiIsIm5vcm1hbFdvcmxkT25CIiwiZ2V0X21fbm9ybWFsV29ybGRPbkIiLCJjb250YWN0IiwiYWxsb2NhdGUiLCJzZXQiLCJnZXRBcHBsaWVkSW1wdWxzZSIsIl9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8iLCJfY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdCIsIl9jcmVhdGVDb250YWN0UmVzdWx0IiwiX2NsZWFuT2xkQ29sbGlzaW9ucyIsImZyYW1lQ29sbGlzaW9uIiwiY29sbGlzaW9uIiwiZW50aXR5Q29sbGlzaW9uIiwiZW50aXR5UmlnaWRib2R5Iiwic3BsaWNlIiwidHJpZ2dlciIsImZpcmUiLCJfaGFzQ29udGFjdEV2ZW50IiwiYyIsImhhc0V2ZW50IiwiciIsIndvcmxkIiwidGltZVN0ZXAiLCJ3cmFwUG9pbnRlciIsImJ0RHluYW1pY3NXb3JsZCIsImdldERpc3BhdGNoZXIiLCJudW1NYW5pZm9sZHMiLCJnZXROdW1NYW5pZm9sZHMiLCJtYW5pZm9sZCIsImdldE1hbmlmb2xkQnlJbmRleEludGVybmFsIiwiYm9keTAiLCJnZXRCb2R5MCIsImJvZHkxIiwiZ2V0Qm9keTEiLCJ3YjAiLCJ3YjEiLCJlMCIsImUxIiwiZmxhZ3MwIiwiZ2V0Q29sbGlzaW9uRmxhZ3MiLCJmbGFnczEiLCJudW1Db250YWN0cyIsImdldE51bUNvbnRhY3RzIiwiZm9yd2FyZENvbnRhY3RzIiwicmV2ZXJzZUNvbnRhY3RzIiwibmV3Q29sbGlzaW9uIiwiQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QiLCJlMEV2ZW50cyIsImUxRXZlbnRzIiwiZTBCb2R5RXZlbnRzIiwiZTFCb2R5RXZlbnRzIiwiZ2xvYmFsRXZlbnRzIiwiaiIsImJ0Q29udGFjdFBvaW50IiwiZ2V0Q29udGFjdFBvaW50IiwicmV2ZXJzZUNvbnRhY3RQb2ludCIsImZvcndhcmRSZXN1bHQiLCJyZXZlcnNlUmVzdWx0IiwiZnJlZUFsbCIsImR0IiwibGVuIiwicGh5c2ljc1N0YXJ0Iiwibm93IiwiZ2V0R3Jhdml0eSIsInNldEdyYXZpdHkiLCJ0cmlnZ2VycyIsInVwZGF0ZVRyYW5zZm9ybSIsImNvbXBvdW5kcyIsIl91cGRhdGVDb21wb3VuZCIsImtpbmVtYXRpYyIsIl91cGRhdGVLaW5lbWF0aWMiLCJzdGVwU2ltdWxhdGlvbiIsImR5bmFtaWMiLCJfdXBkYXRlRHluYW1pYyIsImdldFBvaW50ZXIiLCJwaHlzaWNzVGltZSIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLElBQUlBLFlBQUosRUFBa0JDLFVBQWxCLENBQUE7O0FBS0EsTUFBTUMsYUFBTixDQUFvQjtBQVNoQkMsRUFBQUEsV0FBVyxDQUFDQyxNQUFELEVBQVNDLEtBQVQsRUFBZ0JDLE1BQWhCLEVBQXdCO0lBTS9CLElBQUtGLENBQUFBLE1BQUwsR0FBY0EsTUFBZCxDQUFBO0lBT0EsSUFBS0MsQ0FBQUEsS0FBTCxHQUFhQSxLQUFiLENBQUE7SUFPQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWNBLE1BQWQsQ0FBQTtBQUNILEdBQUE7O0FBOUJlLENBQUE7O0FBb0NwQixNQUFNQyxtQkFBTixDQUEwQjtBQVN0QkosRUFBQUEsV0FBVyxDQUFDSyxDQUFELEVBQUlDLENBQUosRUFBT0MsWUFBUCxFQUFxQjtBQUM1QixJQUFBLElBQUlDLFNBQVMsQ0FBQ0MsTUFBVixLQUFxQixDQUF6QixFQUE0QjtNQU14QixJQUFLSixDQUFBQSxDQUFMLEdBQVMsSUFBVCxDQUFBO01BT0EsSUFBS0MsQ0FBQUEs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
