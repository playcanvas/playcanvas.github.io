/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

/**
 * Object holding the result of a successful raycast hit.
 */
class RaycastResult {
  /**
   * Create a new RaycastResult instance.
   *
   * @param {import('../../entity.js').Entity} entity - The entity that was hit.
   * @param {Vec3} point - The point at which the ray hit the entity in world space.
   * @param {Vec3} normal - The normal vector of the surface where the ray hit in world space.
   * @hideconstructor
   */
  constructor(entity, point, normal) {
    /**
     * The entity that was hit.
     *
     * @type {import('../../entity.js').Entity}
     */
    this.entity = entity;

    /**
     * The point at which the ray hit the entity in world space.
     *
     * @type {Vec3}
     */
    this.point = point;

    /**
     * The normal vector of the surface where the ray hit in world space.
     *
     * @type {Vec3}
     */
    this.normal = normal;
  }
}

/**
 * Object holding the result of a contact between two rigid bodies.
 */
class SingleContactResult {
  /**
   * Create a new SingleContactResult instance.
   *
   * @param {import('../../entity.js').Entity} a - The first entity involved in the contact.
   * @param {import('../../entity.js').Entity} b - The second entity involved in the contact.
   * @param {ContactPoint} contactPoint - The contact point between the two entities.
   * @hideconstructor
   */
  constructor(a, b, contactPoint) {
    if (arguments.length === 0) {
      /**
       * The first entity involved in the contact.
       *
       * @type {import('../../entity.js').Entity}
       */
      this.a = null;

      /**
       * The second entity involved in the contact.
       *
       * @type {import('../../entity.js').Entity}
       */
      this.b = null;

      /**
       * The total accumulated impulse applied by the constraint solver during the last
       * sub-step. Describes how hard two bodies collided.
       *
       * @type {number}
       */
      this.impulse = 0;

      /**
       * The point on Entity A where the contact occurred, relative to A.
       *
       * @type {Vec3}
       */
      this.localPointA = new Vec3();

      /**
       * The point on Entity B where the contact occurred, relative to B.
       *
       * @type {Vec3}
       */
      this.localPointB = new Vec3();

      /**
       * The point on Entity A where the contact occurred, in world space.
       *
       * @type {Vec3}
       */
      this.pointA = new Vec3();

      /**
       * The point on Entity B where the contact occurred, in world space.
       *
       * @type {Vec3}
       */
      this.pointB = new Vec3();

      /**
       * The normal vector of the contact on Entity B, in world space.
       *
       * @type {Vec3}
       */
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

/**
 * Object holding the result of a contact between two Entities.
 */
class ContactPoint {
  /**
   * Create a new ContactPoint instance.
   *
   * @param {Vec3} [localPoint] - The point on the entity where the contact occurred, relative to
   * the entity.
   * @param {Vec3} [localPointOther] - The point on the other entity where the contact occurred,
   * relative to the other entity.
   * @param {Vec3} [point] - The point on the entity where the contact occurred, in world space.
   * @param {Vec3} [pointOther] - The point on the other entity where the contact occurred, in
   * world space.
   * @param {Vec3} [normal] - The normal vector of the contact on the other entity, in world
   * space.
   * @param {number} [impulse] - The total accumulated impulse applied by the constraint solver
   * during the last sub-step. Describes how hard two objects collide. Defaults to 0.
   * @hideconstructor
   */
  constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0) {
    /**
     * The point on the entity where the contact occurred, relative to the entity.
     *
     * @type {Vec3}
     */
    this.localPoint = localPoint;

    /**
     * The point on the other entity where the contact occurred, relative to the other entity.
     *
     * @type {Vec3}
     */
    this.localPointOther = localPointOther;

    /**
     * The point on the entity where the contact occurred, in world space.
     *
     * @type {Vec3}
     */
    this.point = point;

    /**
     * The point on the other entity where the contact occurred, in world space.
     *
     * @type {Vec3}
     */
    this.pointOther = pointOther;

    /**
     * The normal vector of the contact on the other entity, in world space.
     *
     * @type {Vec3}
     */
    this.normal = normal;

    /**
     * The total accumulated impulse applied by the constraint solver during the last sub-step.
     * Describes how hard two objects collide.
     *
     * @type {number}
     */
    this.impulse = impulse;
  }
}

/**
 * Object holding the result of a contact between two Entities.
 */
class ContactResult {
  /**
   * Create a new ContactResult instance.
   *
   * @param {import('../../entity.js').Entity} other - The entity that was involved in the
   * contact with this entity.
   * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
   * @hideconstructor
   */
  constructor(other, contacts) {
    /**
     * The entity that was involved in the contact with this entity.
     *
     * @type {import('../../entity.js').Entity}
     */
    this.other = other;

    /**
     * An array of ContactPoints with the other entity.
     *
     * @type {ContactPoint[]}
     */
    this.contacts = contacts;
  }
}
const _schema = ['enabled'];

/**
 * The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies, it also
 * controls global values for the world such as gravity. Note: The RigidBodyComponentSystem is only
 * valid if 3D Physics is enabled in your application. You can enable this in the application
 * settings for your project.
 *
 * @augments ComponentSystem
 */
class RigidBodyComponentSystem extends ComponentSystem {
  /**
   * @type {number}
   * @ignore
   */

  /**
   * @type {number}
   * @ignore
   */

  /**
   * The world space vector representing global gravity in the physics simulation. Defaults to
   * [0, -9.81, 0] which is an approximation of the gravitational force on Earth.
   *
   * @type {Vec3}
   */

  /**
   * @type {Float32Array}
   * @private
   */

  /**
   * @type {RigidBodyComponent[]}
   * @private
   */

  /**
   * @type {RigidBodyComponent[]}
   * @private
   */

  /**
   * @type {RigidBodyComponent[]}
   * @private
   */

  /**
   * @type {RigidBodyComponent[]}
   * @private
   */

  /**
   * Create a new RigidBodyComponentSystem.
   *
   * @param {import('../../app-base.js').AppBase} app - The Application.
   * @hideconstructor
   */
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

  /**
   * Fired when a contact occurs between two rigid bodies.
   *
   * @event RigidBodyComponentSystem#contact
   * @param {SingleContactResult} result - Details of the contact between the two bodies.
   */

  /**
   * Called once Ammo has been loaded. Responsible for creating the physics world.
   *
   * @ignore
   */
  onLibraryLoaded() {
    // Create the Ammo physics world
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

      // Lazily create temp vars
      ammoRayStart = new Ammo.btVector3();
      ammoRayEnd = new Ammo.btVector3();
      RigidBodyComponent.onLibraryLoaded();
      this.contactPointPool = new ObjectPool(ContactPoint, 1);
      this.contactResultPool = new ObjectPool(ContactResult, 1);
      this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);
      this.app.systems.on('update', this.onUpdate, this);
    } else {
      // Unbind the update function if we haven't loaded Ammo by now
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
    // create new data block for clone
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
    // The motion state needs to be destroyed explicitly (if present)
    const motionState = body.getMotionState();
    if (motionState) {
      Ammo.destroy(motionState);
    }
    Ammo.destroy(body);
  }

  /**
   * Raycast the world and return the first entity the ray hits. Fire a ray into the world from
   * start to end, if the ray hits an entity with a collision component, it returns a
   * {@link RaycastResult}, otherwise returns null.
   *
   * @param {Vec3} start - The world space point where the ray starts.
   * @param {Vec3} end - The world space point where the ray ends.
   * @returns {RaycastResult} The result of the raycasting or null if there was no hit.
   */
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

        // keeping for backwards compatibility
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

  /**
   * Raycast the world and return all entities the ray hits. It returns an array of
   * {@link RaycastResult}, one for each hit. If no hits are detected, the returned array will be
   * of length 0.
   *
   * @param {Vec3} start - The world space point where the ray starts.
   * @param {Vec3} end - The world space point where the ray ends.
   * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
   */
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

  /**
   * Stores a collision between the entity and other in the contacts map and returns true if it
   * is a new collision.
   *
   * @param {import('../../entity.js').Entity} entity - The entity.
   * @param {import('../../entity.js').Entity} other - The entity that collides with the first
   * entity.
   * @returns {boolean} True if this is a new collision, false otherwise.
   * @private
   */
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

  /**
   * Removes collisions that no longer exist from the collisions list and fires collisionend
   * events to the related entities.
   *
   * @private
   */
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
          // if the contact does not exist in the current frame collisions then fire event
          if (!frameCollision || frameCollision.others.indexOf(other) < 0) {
            // remove from others list
            others.splice(i, 1);
            if (entity.trigger) {
              // handle a trigger entity
              if (entityCollision) {
                entityCollision.fire('triggerleave', other);
              }
              if (other.rigidbody) {
                other.rigidbody.fire('triggerleave', entity);
              }
            } else if (!other.trigger) {
              // suppress events if the other entity is a trigger
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

  /**
   * Returns true if the entity has a contact event attached and false otherwise.
   *
   * @param {import('../../entity.js').Entity} entity - Entity to test.
   * @returns {boolean} True if the entity has a contact and false otherwise.
   * @private
   */
  _hasContactEvent(entity) {
    const c = entity.collision;
    if (c && (c.hasEvent('collisionstart') || c.hasEvent('collisionend') || c.hasEvent('contact'))) {
      return true;
    }
    const r = entity.rigidbody;
    return r && (r.hasEvent('collisionstart') || r.hasEvent('collisionend') || r.hasEvent('contact'));
  }

  /**
   * Checks for collisions and fires collision events.
   *
   * @param {number} world - The pointer to the dynamics world that invoked this callback.
   * @param {number} timeStep - The amount of simulation time processed in the last simulation tick.
   * @private
   */
  _checkForCollisions(world, timeStep) {
    const dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);

    // Check for collisions and fire callbacks
    const dispatcher = dynamicsWorld.getDispatcher();
    const numManifolds = dispatcher.getNumManifolds();
    this.frameCollisions = {};

    // loop through the all contacts and fire events
    for (let i = 0; i < numManifolds; i++) {
      const manifold = dispatcher.getManifoldByIndexInternal(i);
      const body0 = manifold.getBody0();
      const body1 = manifold.getBody1();
      const wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
      const wb1 = Ammo.castObject(body1, Ammo.btRigidBody);
      const e0 = wb0.entity;
      const e1 = wb1.entity;

      // check if entity is null - TODO: investigate when this happens
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
        // don't fire contact events for triggers
        if (flags0 & BODYFLAG_NORESPONSE_OBJECT || flags1 & BODYFLAG_NORESPONSE_OBJECT) {
          const e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
          const e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
          const e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent('triggerenter') || e0.rigidbody.hasEvent('triggerleave'));
          const e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent('triggerenter') || e1.rigidbody.hasEvent('triggerleave'));

          // fire triggerenter events for triggers
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

          // fire triggerenter events for rigidbodies
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
                // fire global contact event for every contact
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

    // check for collisions that no longer exist and fire events
    this._cleanOldCollisions();

    // Reset contact pools
    this.contactPointPool.freeAll();
    this.contactResultPool.freeAll();
    this.singleContactResultPool.freeAll();
  }
  onUpdate(dt) {
    let i, len;
    this._stats.physicsStart = now();

    // downcast gravity to float32 so we can accurately compare with existing
    // gravity set in ammo.
    this._gravityFloat32[0] = this.gravity.x;
    this._gravityFloat32[1] = this.gravity.y;
    this._gravityFloat32[2] = this.gravity.z;

    // Check to see whether we need to update gravity on the dynamics world
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

    // Update all kinematic bodies based on their current entity transform
    const kinematic = this._kinematic;
    for (i = 0, len = kinematic.length; i < len; i++) {
      kinematic[i]._updateKinematic();
    }

    // Step the physics simulation
    this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

    // Update the transforms of all entities referencing a dynamic body
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG5sZXQgYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kO1xuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBzdWNjZXNzZnVsIHJheWNhc3QgaGl0LlxuICovXG5jbGFzcyBSYXljYXN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmF5Y2FzdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcG9pbnQgYXQgd2hpY2ggdGhlIHJheSBoaXQgdGhlIGVudGl0eSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG5vcm1hbCAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBzdXJmYWNlIHdoZXJlIHRoZSByYXkgaGl0IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihlbnRpdHksIHBvaW50LCBub3JtYWwpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IGF0IHdoaWNoIHRoZSByYXkgaGl0IHRoZSBlbnRpdHkgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgc3VyZmFjZSB3aGVyZSB0aGUgcmF5IGhpdCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLlxuICovXG5jbGFzcyBTaW5nbGVDb250YWN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2luZ2xlQ29udGFjdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGEgLSBUaGUgZmlyc3QgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGIgLSBUaGUgc2Vjb25kIGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgKiBAcGFyYW0ge0NvbnRhY3RQb2ludH0gY29udGFjdFBvaW50IC0gVGhlIGNvbnRhY3QgcG9pbnQgYmV0d2VlbiB0aGUgdHdvIGVudGl0aWVzLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGZpcnN0IGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuYSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHNlY29uZCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmIgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyIGR1cmluZyB0aGUgbGFzdFxuICAgICAgICAgICAgICogc3ViLXN0ZXAuIERlc2NyaWJlcyBob3cgaGFyZCB0d28gYm9kaWVzIGNvbGxpZGVkLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuaW1wdWxzZSA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBBIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byBBLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRBID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEIgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvIEIuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEIgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMucG9pbnRBID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEIgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnBvaW50QiA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIGNvbnRhY3Qgb24gRW50aXR5IEIsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLm5vcm1hbCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmEgPSBhO1xuICAgICAgICAgICAgdGhpcy5iID0gYjtcbiAgICAgICAgICAgIHRoaXMuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5pbXB1bHNlO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50O1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50T3RoZXI7XG4gICAgICAgICAgICB0aGlzLnBvaW50QSA9IGNvbnRhY3RQb2ludC5wb2ludDtcbiAgICAgICAgICAgIHRoaXMucG9pbnRCID0gY29udGFjdFBvaW50LnBvaW50T3RoZXI7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbCA9IGNvbnRhY3RQb2ludC5ub3JtYWw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gRW50aXRpZXMuXG4gKi9cbmNsYXNzIENvbnRhY3RQb2ludCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENvbnRhY3RQb2ludCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2xvY2FsUG9pbnRdIC0gVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIHJlbGF0aXZlIHRvXG4gICAgICogdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtsb2NhbFBvaW50T3RoZXJdIC0gVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsXG4gICAgICogcmVsYXRpdmUgdG8gdGhlIG90aGVyIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtwb2ludF0gLSBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRPdGhlcl0gLSBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW5cbiAgICAgKiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtub3JtYWxdIC0gVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIGNvbnRhY3Qgb24gdGhlIG90aGVyIGVudGl0eSwgaW4gd29ybGRcbiAgICAgKiBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2ltcHVsc2VdIC0gVGhlIHRvdGFsIGFjY3VtdWxhdGVkIGltcHVsc2UgYXBwbGllZCBieSB0aGUgY29uc3RyYWludCBzb2x2ZXJcbiAgICAgKiBkdXJpbmcgdGhlIGxhc3Qgc3ViLXN0ZXAuIERlc2NyaWJlcyBob3cgaGFyZCB0d28gb2JqZWN0cyBjb2xsaWRlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihsb2NhbFBvaW50ID0gbmV3IFZlYzMoKSwgbG9jYWxQb2ludE90aGVyID0gbmV3IFZlYzMoKSwgcG9pbnQgPSBuZXcgVmVjMygpLCBwb2ludE90aGVyID0gbmV3IFZlYzMoKSwgbm9ybWFsID0gbmV3IFZlYzMoKSwgaW1wdWxzZSA9IDApIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byB0aGUgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb2ludCA9IGxvY2FsUG9pbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9jYWxQb2ludE90aGVyID0gbG9jYWxQb2ludE90aGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludE90aGVyID0gcG9pbnRPdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5vcm1hbCB2ZWN0b3Igb2YgdGhlIGNvbnRhY3Qgb24gdGhlIG90aGVyIGVudGl0eSwgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ub3JtYWwgPSBub3JtYWw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyIGR1cmluZyB0aGUgbGFzdCBzdWItc3RlcC5cbiAgICAgICAgICogRGVzY3JpYmVzIGhvdyBoYXJkIHR3byBvYmplY3RzIGNvbGxpZGUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmltcHVsc2UgPSBpbXB1bHNlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBPYmplY3QgaG9sZGluZyB0aGUgcmVzdWx0IG9mIGEgY29udGFjdCBiZXR3ZWVuIHR3byBFbnRpdGllcy5cbiAqL1xuY2xhc3MgQ29udGFjdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IENvbnRhY3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlXG4gICAgICogY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7Q29udGFjdFBvaW50W119IGNvbnRhY3RzIC0gQW4gYXJyYXkgb2YgQ29udGFjdFBvaW50cyB3aXRoIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG90aGVyLCBjb250YWN0cykge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSB0aGF0IHdhcyBpbnZvbHZlZCBpbiB0aGUgY29udGFjdCB3aXRoIHRoaXMgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm90aGVyID0gb3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFuIGFycmF5IG9mIENvbnRhY3RQb2ludHMgd2l0aCB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q29udGFjdFBvaW50W119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNvbnRhY3RzID0gY29udGFjdHM7XG4gICAgfVxufVxuXG5jb25zdCBfc2NoZW1hID0gWydlbmFibGVkJ107XG5cbi8qKlxuICogVGhlIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBtYWludGFpbnMgdGhlIGR5bmFtaWNzIHdvcmxkIGZvciBzaW11bGF0aW5nIHJpZ2lkIGJvZGllcywgaXQgYWxzb1xuICogY29udHJvbHMgZ2xvYmFsIHZhbHVlcyBmb3IgdGhlIHdvcmxkIHN1Y2ggYXMgZ3Jhdml0eS4gTm90ZTogVGhlIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSBpcyBvbmx5XG4gKiB2YWxpZCBpZiAzRCBQaHlzaWNzIGlzIGVuYWJsZWQgaW4geW91ciBhcHBsaWNhdGlvbi4gWW91IGNhbiBlbmFibGUgdGhpcyBpbiB0aGUgYXBwbGljYXRpb25cbiAqIHNldHRpbmdzIGZvciB5b3VyIHByb2plY3QuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFN5c3RlbVxuICovXG5jbGFzcyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIG1heFN1YlN0ZXBzID0gMTA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmaXhlZFRpbWVTdGVwID0gMSAvIDYwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHdvcmxkIHNwYWNlIHZlY3RvciByZXByZXNlbnRpbmcgZ2xvYmFsIGdyYXZpdHkgaW4gdGhlIHBoeXNpY3Mgc2ltdWxhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiBbMCwgLTkuODEsIDBdIHdoaWNoIGlzIGFuIGFwcHJveGltYXRpb24gb2YgdGhlIGdyYXZpdGF0aW9uYWwgZm9yY2Ugb24gRWFydGguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBncmF2aXR5ID0gbmV3IFZlYzMoMCwgLTkuODEsIDApO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Zsb2F0MzJBcnJheX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ncmF2aXR5RmxvYXQzMiA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmlnaWRCb2R5Q29tcG9uZW50W119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZHluYW1pYyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2tpbmVtYXRpYyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RyaWdnZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmlnaWRCb2R5Q29tcG9uZW50W119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY29tcG91bmRzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIEFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ3JpZ2lkYm9keSc7XG4gICAgICAgIHRoaXMuX3N0YXRzID0gYXBwLnN0YXRzLmZyYW1lO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IFJpZ2lkQm9keUNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5EYXRhVHlwZSA9IFJpZ2lkQm9keUNvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5jb250YWN0UG9pbnRQb29sID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb250YWN0UmVzdWx0UG9vbCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hID0gX3NjaGVtYTtcblxuICAgICAgICB0aGlzLmNvbGxpc2lvbnMgPSB7fTtcbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnMgPSB7fTtcblxuICAgICAgICB0aGlzLm9uKCdiZWZvcmVyZW1vdmUnLCB0aGlzLm9uQmVmb3JlUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jY29udGFjdFxuICAgICAqIEBwYXJhbSB7U2luZ2xlQ29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIG9uY2UgQW1tbyBoYXMgYmVlbiBsb2FkZWQuIFJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyB0aGUgcGh5c2ljcyB3b3JsZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBvbkxpYnJhcnlMb2FkZWQoKSB7XG4gICAgICAgIC8vIENyZWF0ZSB0aGUgQW1tbyBwaHlzaWNzIHdvcmxkXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbiA9IG5ldyBBbW1vLmJ0RGVmYXVsdENvbGxpc2lvbkNvbmZpZ3VyYXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hlciA9IG5ldyBBbW1vLmJ0Q29sbGlzaW9uRGlzcGF0Y2hlcih0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgdGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSA9IG5ldyBBbW1vLmJ0RGJ2dEJyb2FkcGhhc2UoKTtcbiAgICAgICAgICAgIHRoaXMuc29sdmVyID0gbmV3IEFtbW8uYnRTZXF1ZW50aWFsSW1wdWxzZUNvbnN0cmFpbnRTb2x2ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZCA9IG5ldyBBbW1vLmJ0RGlzY3JldGVEeW5hbWljc1dvcmxkKHRoaXMuZGlzcGF0Y2hlciwgdGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSwgdGhpcy5zb2x2ZXIsIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGVja0ZvckNvbGxpc2lvbnNQb2ludGVyID0gQW1tby5hZGRGdW5jdGlvbih0aGlzLl9jaGVja0ZvckNvbGxpc2lvbnMuYmluZCh0aGlzKSwgJ3ZpZicpO1xuICAgICAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5zZXRJbnRlcm5hbFRpY2tDYWxsYmFjayhjaGVja0ZvckNvbGxpc2lvbnNQb2ludGVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignV0FSTklORzogVGhpcyB2ZXJzaW9uIG9mIGFtbW8uanMgY2FuIHBvdGVudGlhbGx5IGZhaWwgdG8gcmVwb3J0IGNvbnRhY3RzLiBQbGVhc2UgdXBkYXRlIGl0IHRvIHRoZSBsYXRlc3QgdmVyc2lvbi4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTGF6aWx5IGNyZWF0ZSB0ZW1wIHZhcnNcbiAgICAgICAgICAgIGFtbW9SYXlTdGFydCA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgYW1tb1JheUVuZCA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgUmlnaWRCb2R5Q29tcG9uZW50Lm9uTGlicmFyeUxvYWRlZCgpO1xuXG4gICAgICAgICAgICB0aGlzLmNvbnRhY3RQb2ludFBvb2wgPSBuZXcgT2JqZWN0UG9vbChDb250YWN0UG9pbnQsIDEpO1xuICAgICAgICAgICAgdGhpcy5jb250YWN0UmVzdWx0UG9vbCA9IG5ldyBPYmplY3RQb29sKENvbnRhY3RSZXN1bHQsIDEpO1xuICAgICAgICAgICAgdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbCA9IG5ldyBPYmplY3RQb29sKFNpbmdsZUNvbnRhY3RSZXN1bHQsIDEpO1xuXG4gICAgICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9uKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFVuYmluZCB0aGUgdXBkYXRlIGZ1bmN0aW9uIGlmIHdlIGhhdmVuJ3QgbG9hZGVkIEFtbW8gYnkgbm93XG4gICAgICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgY29uc3QgcHJvcHMgPSBbXG4gICAgICAgICAgICAnbWFzcycsXG4gICAgICAgICAgICAnbGluZWFyRGFtcGluZycsXG4gICAgICAgICAgICAnYW5ndWxhckRhbXBpbmcnLFxuICAgICAgICAgICAgJ2xpbmVhckZhY3RvcicsXG4gICAgICAgICAgICAnYW5ndWxhckZhY3RvcicsXG4gICAgICAgICAgICAnZnJpY3Rpb24nLFxuICAgICAgICAgICAgJ3JvbGxpbmdGcmljdGlvbicsXG4gICAgICAgICAgICAncmVzdGl0dXRpb24nLFxuICAgICAgICAgICAgJ3R5cGUnLFxuICAgICAgICAgICAgJ2dyb3VwJyxcbiAgICAgICAgICAgICdtYXNrJ1xuICAgICAgICBdO1xuXG4gICAgICAgIGZvciAoY29uc3QgcHJvcGVydHkgb2YgcHJvcHMpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gZGF0YVtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFtwcm9wZXJ0eV0gPSBuZXcgVmVjMyh2YWx1ZVswXSwgdmFsdWVbMV0sIHZhbHVlWzJdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBbJ2VuYWJsZWQnXSk7XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICAvLyBjcmVhdGUgbmV3IGRhdGEgYmxvY2sgZm9yIGNsb25lXG4gICAgICAgIGNvbnN0IHJpZ2lkYm9keSA9IGVudGl0eS5yaWdpZGJvZHk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBlbmFibGVkOiByaWdpZGJvZHkuZW5hYmxlZCxcbiAgICAgICAgICAgIG1hc3M6IHJpZ2lkYm9keS5tYXNzLFxuICAgICAgICAgICAgbGluZWFyRGFtcGluZzogcmlnaWRib2R5LmxpbmVhckRhbXBpbmcsXG4gICAgICAgICAgICBhbmd1bGFyRGFtcGluZzogcmlnaWRib2R5LmFuZ3VsYXJEYW1waW5nLFxuICAgICAgICAgICAgbGluZWFyRmFjdG9yOiBbcmlnaWRib2R5LmxpbmVhckZhY3Rvci54LCByaWdpZGJvZHkubGluZWFyRmFjdG9yLnksIHJpZ2lkYm9keS5saW5lYXJGYWN0b3Iuel0sXG4gICAgICAgICAgICBhbmd1bGFyRmFjdG9yOiBbcmlnaWRib2R5LmFuZ3VsYXJGYWN0b3IueCwgcmlnaWRib2R5LmFuZ3VsYXJGYWN0b3IueSwgcmlnaWRib2R5LmFuZ3VsYXJGYWN0b3Iuel0sXG4gICAgICAgICAgICBmcmljdGlvbjogcmlnaWRib2R5LmZyaWN0aW9uLFxuICAgICAgICAgICAgcm9sbGluZ0ZyaWN0aW9uOiByaWdpZGJvZHkucm9sbGluZ0ZyaWN0aW9uLFxuICAgICAgICAgICAgcmVzdGl0dXRpb246IHJpZ2lkYm9keS5yZXN0aXR1dGlvbixcbiAgICAgICAgICAgIHR5cGU6IHJpZ2lkYm9keS50eXBlLFxuICAgICAgICAgICAgZ3JvdXA6IHJpZ2lkYm9keS5ncm91cCxcbiAgICAgICAgICAgIG1hc2s6IHJpZ2lkYm9keS5tYXNrXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCBkYXRhKTtcbiAgICB9XG5cbiAgICBvbkJlZm9yZVJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblJlbW92ZShlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb25zdCBib2R5ID0gY29tcG9uZW50LmJvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUJvZHkoYm9keSk7XG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lCb2R5KGJvZHkpO1xuXG4gICAgICAgICAgICBjb21wb25lbnQuYm9keSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRCb2R5KGJvZHksIGdyb3VwLCBtYXNrKSB7XG4gICAgICAgIGlmIChncm91cCAhPT0gdW5kZWZpbmVkICYmIG1hc2sgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLmFkZFJpZ2lkQm9keShib2R5LCBncm91cCwgbWFzayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuYWRkUmlnaWRCb2R5KGJvZHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlQm9keShib2R5KSB7XG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5yZW1vdmVSaWdpZEJvZHkoYm9keSk7XG4gICAgfVxuXG4gICAgY3JlYXRlQm9keShtYXNzLCBzaGFwZSwgdHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IGxvY2FsSW5lcnRpYSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygwLCAwLCAwKTtcbiAgICAgICAgaWYgKG1hc3MgIT09IDApIHtcbiAgICAgICAgICAgIHNoYXBlLmNhbGN1bGF0ZUxvY2FsSW5lcnRpYShtYXNzLCBsb2NhbEluZXJ0aWEpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSBuZXcgQW1tby5idERlZmF1bHRNb3Rpb25TdGF0ZSh0cmFuc2Zvcm0pO1xuICAgICAgICBjb25zdCBib2R5SW5mbyA9IG5ldyBBbW1vLmJ0UmlnaWRCb2R5Q29uc3RydWN0aW9uSW5mbyhtYXNzLCBtb3Rpb25TdGF0ZSwgc2hhcGUsIGxvY2FsSW5lcnRpYSk7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBuZXcgQW1tby5idFJpZ2lkQm9keShib2R5SW5mbyk7XG4gICAgICAgIEFtbW8uZGVzdHJveShib2R5SW5mbyk7XG4gICAgICAgIEFtbW8uZGVzdHJveShsb2NhbEluZXJ0aWEpO1xuXG4gICAgICAgIHJldHVybiBib2R5O1xuICAgIH1cblxuICAgIGRlc3Ryb3lCb2R5KGJvZHkpIHtcbiAgICAgICAgLy8gVGhlIG1vdGlvbiBzdGF0ZSBuZWVkcyB0byBiZSBkZXN0cm95ZWQgZXhwbGljaXRseSAoaWYgcHJlc2VudClcbiAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSBib2R5LmdldE1vdGlvblN0YXRlKCk7XG4gICAgICAgIGlmIChtb3Rpb25TdGF0ZSkge1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KG1vdGlvblN0YXRlKTtcbiAgICAgICAgfVxuICAgICAgICBBbW1vLmRlc3Ryb3koYm9keSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmF5Y2FzdCB0aGUgd29ybGQgYW5kIHJldHVybiB0aGUgZmlyc3QgZW50aXR5IHRoZSByYXkgaGl0cy4gRmlyZSBhIHJheSBpbnRvIHRoZSB3b3JsZCBmcm9tXG4gICAgICogc3RhcnQgdG8gZW5kLCBpZiB0aGUgcmF5IGhpdHMgYW4gZW50aXR5IHdpdGggYSBjb2xsaXNpb24gY29tcG9uZW50LCBpdCByZXR1cm5zIGFcbiAgICAgKiB7QGxpbmsgUmF5Y2FzdFJlc3VsdH0sIG90aGVyd2lzZSByZXR1cm5zIG51bGwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgc3RhcnRzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgZW5kcy5cbiAgICAgKiBAcmV0dXJucyB7UmF5Y2FzdFJlc3VsdH0gVGhlIHJlc3VsdCBvZiB0aGUgcmF5Y2FzdGluZyBvciBudWxsIGlmIHRoZXJlIHdhcyBubyBoaXQuXG4gICAgICovXG4gICAgcmF5Y2FzdEZpcnN0KHN0YXJ0LCBlbmQpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgYW1tb1JheVN0YXJ0LnNldFZhbHVlKHN0YXJ0LngsIHN0YXJ0LnksIHN0YXJ0LnopO1xuICAgICAgICBhbW1vUmF5RW5kLnNldFZhbHVlKGVuZC54LCBlbmQueSwgZW5kLnopO1xuICAgICAgICBjb25zdCByYXlDYWxsYmFjayA9IG5ldyBBbW1vLkNsb3Nlc3RSYXlSZXN1bHRDYWxsYmFjayhhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQpO1xuXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5yYXlUZXN0KGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCwgcmF5Q2FsbGJhY2spO1xuICAgICAgICBpZiAocmF5Q2FsbGJhY2suaGFzSGl0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbk9iaiA9IHJheUNhbGxiYWNrLmdldF9tX2NvbGxpc2lvbk9iamVjdCgpO1xuICAgICAgICAgICAgY29uc3QgYm9keSA9IEFtbW8uY2FzdE9iamVjdChjb2xsaXNpb25PYmosIEFtbW8uYnRSaWdpZEJvZHkpO1xuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHJheUNhbGxiYWNrLmdldF9tX2hpdFBvaW50V29ybGQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWwgPSByYXlDYWxsYmFjay5nZXRfbV9oaXROb3JtYWxXb3JsZCgpO1xuXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGJvZHkuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhwb2ludC54KCksIHBvaW50LnkoKSwgcG9pbnQueigpKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSlcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgLy8ga2VlcGluZyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI3JheUNhc3RGaXJzdCBubyBsb25nZXIgcmVxdWlyZXMgYSBjYWxsYmFjay4gVGhlIHJlc3VsdCBvZiB0aGUgcmF5Y2FzdCBpcyByZXR1cm5lZCBieSB0aGUgZnVuY3Rpb24gaW5zdGVhZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2socmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBBbW1vLmRlc3Ryb3kocmF5Q2FsbGJhY2spO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmF5Y2FzdCB0aGUgd29ybGQgYW5kIHJldHVybiBhbGwgZW50aXRpZXMgdGhlIHJheSBoaXRzLiBJdCByZXR1cm5zIGFuIGFycmF5IG9mXG4gICAgICoge0BsaW5rIFJheWNhc3RSZXN1bHR9LCBvbmUgZm9yIGVhY2ggaGl0LiBJZiBubyBoaXRzIGFyZSBkZXRlY3RlZCwgdGhlIHJldHVybmVkIGFycmF5IHdpbGwgYmVcbiAgICAgKiBvZiBsZW5ndGggMC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBUaGUgd29ybGQgc3BhY2UgcG9pbnQgd2hlcmUgdGhlIHJheSBzdGFydHMuXG4gICAgICogQHBhcmFtIHtWZWMzfSBlbmQgLSBUaGUgd29ybGQgc3BhY2UgcG9pbnQgd2hlcmUgdGhlIHJheSBlbmRzLlxuICAgICAqIEByZXR1cm5zIHtSYXljYXN0UmVzdWx0W119IEFuIGFycmF5IG9mIHJheWNhc3QgaGl0IHJlc3VsdHMgKDAgbGVuZ3RoIGlmIHRoZXJlIHdlcmUgbm8gaGl0cykuXG4gICAgICovXG4gICAgcmF5Y2FzdEFsbChzdGFydCwgZW5kKSB7XG4gICAgICAgIERlYnVnLmFzc2VydChBbW1vLkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjaywgJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNyYXljYXN0QWxsOiBZb3VyIHZlcnNpb24gb2YgYW1tby5qcyBkb2VzIG5vdCBleHBvc2UgQW1tby5BbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2suIFVwZGF0ZSBpdCB0byBsYXRlc3QuJyk7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGFtbW9SYXlTdGFydC5zZXRWYWx1ZShzdGFydC54LCBzdGFydC55LCBzdGFydC56KTtcbiAgICAgICAgYW1tb1JheUVuZC5zZXRWYWx1ZShlbmQueCwgZW5kLnksIGVuZC56KTtcbiAgICAgICAgY29uc3QgcmF5Q2FsbGJhY2sgPSBuZXcgQW1tby5BbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2soYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kKTtcblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmpzID0gcmF5Q2FsbGJhY2suZ2V0X21fY29sbGlzaW9uT2JqZWN0cygpO1xuICAgICAgICAgICAgY29uc3QgcG9pbnRzID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0UG9pbnRXb3JsZCgpO1xuICAgICAgICAgICAgY29uc3Qgbm9ybWFscyA9IHJheUNhbGxiYWNrLmdldF9tX2hpdE5vcm1hbFdvcmxkKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG51bUhpdHMgPSBjb2xsaXNpb25PYmpzLnNpemUoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSGl0czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9keSA9IEFtbW8uY2FzdE9iamVjdChjb2xsaXNpb25PYmpzLmF0KGkpLCBBbW1vLmJ0UmlnaWRCb2R5KTtcbiAgICAgICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHBvaW50cy5hdChpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsID0gbm9ybWFscy5hdChpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmVudGl0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKHBvaW50LngoKSwgcG9pbnQueSgpLCBwb2ludC56KCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSlcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KHJheUNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9yZXMgYSBjb2xsaXNpb24gYmV0d2VlbiB0aGUgZW50aXR5IGFuZCBvdGhlciBpbiB0aGUgY29udGFjdHMgbWFwIGFuZCByZXR1cm5zIHRydWUgaWYgaXRcbiAgICAgKiBpcyBhIG5ldyBjb2xsaXNpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIGVudGl0eSB0aGF0IGNvbGxpZGVzIHdpdGggdGhlIGZpcnN0XG4gICAgICogZW50aXR5LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoaXMgaXMgYSBuZXcgY29sbGlzaW9uLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3RvcmVDb2xsaXNpb24oZW50aXR5LCBvdGhlcikge1xuICAgICAgICBsZXQgaXNOZXdDb2xsaXNpb24gPSBmYWxzZTtcbiAgICAgICAgY29uc3QgZ3VpZCA9IGVudGl0eS5nZXRHdWlkKCk7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zW2d1aWRdID0gdGhpcy5jb2xsaXNpb25zW2d1aWRdIHx8IHsgb3RoZXJzOiBbXSwgZW50aXR5OiBlbnRpdHkgfTtcblxuICAgICAgICBpZiAodGhpcy5jb2xsaXNpb25zW2d1aWRdLm90aGVycy5pbmRleE9mKG90aGVyKSA8IDApIHtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uc1tndWlkXS5vdGhlcnMucHVzaChvdGhlcik7XG4gICAgICAgICAgICBpc05ld0NvbGxpc2lvbiA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXSA9IHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdIHx8IHsgb3RoZXJzOiBbXSwgZW50aXR5OiBlbnRpdHkgfTtcbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLnB1c2gob3RoZXIpO1xuXG4gICAgICAgIHJldHVybiBpc05ld0NvbGxpc2lvbjtcbiAgICB9XG5cbiAgICBfY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8oY29udGFjdFBvaW50KSB7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRBKCk7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRCKCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uV29ybGRPbkEgPSBjb250YWN0UG9pbnQuZ2V0UG9zaXRpb25Xb3JsZE9uQSgpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25CID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkIoKTtcbiAgICAgICAgY29uc3Qgbm9ybWFsV29ybGRPbkIgPSBjb250YWN0UG9pbnQuZ2V0X21fbm9ybWFsV29ybGRPbkIoKTtcblxuICAgICAgICBjb25zdCBjb250YWN0ID0gdGhpcy5jb250YWN0UG9pbnRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludC5zZXQobG9jYWxQb2ludEEueCgpLCBsb2NhbFBvaW50QS55KCksIGxvY2FsUG9pbnRBLnooKSk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludE90aGVyLnNldChsb2NhbFBvaW50Qi54KCksIGxvY2FsUG9pbnRCLnkoKSwgbG9jYWxQb2ludEIueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludC5zZXQocG9zaXRpb25Xb3JsZE9uQS54KCksIHBvc2l0aW9uV29ybGRPbkEueSgpLCBwb3NpdGlvbldvcmxkT25BLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnRPdGhlci5zZXQocG9zaXRpb25Xb3JsZE9uQi54KCksIHBvc2l0aW9uV29ybGRPbkIueSgpLCBwb3NpdGlvbldvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3Qubm9ybWFsLnNldChub3JtYWxXb3JsZE9uQi54KCksIG5vcm1hbFdvcmxkT25CLnkoKSwgbm9ybWFsV29ybGRPbkIueigpKTtcbiAgICAgICAgY29udGFjdC5pbXB1bHNlID0gY29udGFjdFBvaW50LmdldEFwcGxpZWRJbXB1bHNlKCk7XG4gICAgICAgIHJldHVybiBjb250YWN0O1xuICAgIH1cblxuICAgIF9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8oY29udGFjdFBvaW50KSB7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRBKCk7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRCKCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uV29ybGRPbkEgPSBjb250YWN0UG9pbnQuZ2V0UG9zaXRpb25Xb3JsZE9uQSgpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25CID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkIoKTtcbiAgICAgICAgY29uc3Qgbm9ybWFsV29ybGRPbkIgPSBjb250YWN0UG9pbnQuZ2V0X21fbm9ybWFsV29ybGRPbkIoKTtcblxuICAgICAgICBjb25zdCBjb250YWN0ID0gdGhpcy5jb250YWN0UG9pbnRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludE90aGVyLnNldChsb2NhbFBvaW50QS54KCksIGxvY2FsUG9pbnRBLnkoKSwgbG9jYWxQb2ludEEueigpKTtcbiAgICAgICAgY29udGFjdC5sb2NhbFBvaW50LnNldChsb2NhbFBvaW50Qi54KCksIGxvY2FsUG9pbnRCLnkoKSwgbG9jYWxQb2ludEIueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludE90aGVyLnNldChwb3NpdGlvbldvcmxkT25BLngoKSwgcG9zaXRpb25Xb3JsZE9uQS55KCksIHBvc2l0aW9uV29ybGRPbkEueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludC5zZXQocG9zaXRpb25Xb3JsZE9uQi54KCksIHBvc2l0aW9uV29ybGRPbkIueSgpLCBwb3NpdGlvbldvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3Qubm9ybWFsLnNldChub3JtYWxXb3JsZE9uQi54KCksIG5vcm1hbFdvcmxkT25CLnkoKSwgbm9ybWFsV29ybGRPbkIueigpKTtcbiAgICAgICAgY29udGFjdC5pbXB1bHNlID0gY29udGFjdFBvaW50LmdldEFwcGxpZWRJbXB1bHNlKCk7XG4gICAgICAgIHJldHVybiBjb250YWN0O1xuICAgIH1cblxuICAgIF9jcmVhdGVTaW5nbGVDb250YWN0UmVzdWx0KGEsIGIsIGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sLmFsbG9jYXRlKCk7XG5cbiAgICAgICAgcmVzdWx0LmEgPSBhO1xuICAgICAgICByZXN1bHQuYiA9IGI7XG4gICAgICAgIHJlc3VsdC5sb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50O1xuICAgICAgICByZXN1bHQubG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludE90aGVyO1xuICAgICAgICByZXN1bHQucG9pbnRBID0gY29udGFjdFBvaW50LnBvaW50O1xuICAgICAgICByZXN1bHQucG9pbnRCID0gY29udGFjdFBvaW50LnBvaW50T3RoZXI7XG4gICAgICAgIHJlc3VsdC5ub3JtYWwgPSBjb250YWN0UG9pbnQubm9ybWFsO1xuICAgICAgICByZXN1bHQuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5pbXB1bHNlO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnRhY3RSZXN1bHQob3RoZXIsIGNvbnRhY3RzKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuY29udGFjdFJlc3VsdFBvb2wuYWxsb2NhdGUoKTtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gb3RoZXI7XG4gICAgICAgIHJlc3VsdC5jb250YWN0cyA9IGNvbnRhY3RzO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgY29sbGlzaW9ucyB0aGF0IG5vIGxvbmdlciBleGlzdCBmcm9tIHRoZSBjb2xsaXNpb25zIGxpc3QgYW5kIGZpcmVzIGNvbGxpc2lvbmVuZFxuICAgICAqIGV2ZW50cyB0byB0aGUgcmVsYXRlZCBlbnRpdGllcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NsZWFuT2xkQ29sbGlzaW9ucygpIHtcbiAgICAgICAgZm9yIChjb25zdCBndWlkIGluIHRoaXMuY29sbGlzaW9ucykge1xuICAgICAgICAgICAgaWYgKHRoaXMuY29sbGlzaW9ucy5oYXNPd25Qcm9wZXJ0eShndWlkKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lQ29sbGlzaW9uID0gdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgY29uc3QgY29sbGlzaW9uID0gdGhpcy5jb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eSA9IGNvbGxpc2lvbi5lbnRpdHk7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5Q29sbGlzaW9uID0gZW50aXR5LmNvbGxpc2lvbjtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlSaWdpZGJvZHkgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICAgICAgICAgIGNvbnN0IG90aGVycyA9IGNvbGxpc2lvbi5vdGhlcnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gb3RoZXJzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBsZXQgaSA9IGxlbmd0aDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG90aGVyID0gb3RoZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY29udGFjdCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgY3VycmVudCBmcmFtZSBjb2xsaXNpb25zIHRoZW4gZmlyZSBldmVudFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZyYW1lQ29sbGlzaW9uIHx8IGZyYW1lQ29sbGlzaW9uLm90aGVycy5pbmRleE9mKG90aGVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIG90aGVycyBsaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICBvdGhlcnMuc3BsaWNlKGksIDEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBoYW5kbGUgYSB0cmlnZ2VyIGVudGl0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5Q29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJsZWF2ZScsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG90aGVyLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdGhlci5yaWdpZGJvZHkuZmlyZSgndHJpZ2dlcmxlYXZlJywgZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFvdGhlci50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3VwcHJlc3MgZXZlbnRzIGlmIHRoZSBvdGhlciBlbnRpdHkgaXMgYSB0cmlnZ2VyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eVJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlSaWdpZGJvZHkuZmlyZSgnY29sbGlzaW9uZW5kJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvbGxpc2lvbi5maXJlKCdjb2xsaXNpb25lbmQnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG90aGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGVudGl0eSBoYXMgYSBjb250YWN0IGV2ZW50IGF0dGFjaGVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBFbnRpdHkgdG8gdGVzdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgZW50aXR5IGhhcyBhIGNvbnRhY3QgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYXNDb250YWN0RXZlbnQoZW50aXR5KSB7XG4gICAgICAgIGNvbnN0IGMgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICBpZiAoYyAmJiAoYy5oYXNFdmVudCgnY29sbGlzaW9uc3RhcnQnKSB8fCBjLmhhc0V2ZW50KCdjb2xsaXNpb25lbmQnKSB8fCBjLmhhc0V2ZW50KCdjb250YWN0JykpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHIgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICByZXR1cm4gciAmJiAoci5oYXNFdmVudCgnY29sbGlzaW9uc3RhcnQnKSB8fCByLmhhc0V2ZW50KCdjb2xsaXNpb25lbmQnKSB8fCByLmhhc0V2ZW50KCdjb250YWN0JykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBmb3IgY29sbGlzaW9ucyBhbmQgZmlyZXMgY29sbGlzaW9uIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3b3JsZCAtIFRoZSBwb2ludGVyIHRvIHRoZSBkeW5hbWljcyB3b3JsZCB0aGF0IGludm9rZWQgdGhpcyBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGltZVN0ZXAgLSBUaGUgYW1vdW50IG9mIHNpbXVsYXRpb24gdGltZSBwcm9jZXNzZWQgaW4gdGhlIGxhc3Qgc2ltdWxhdGlvbiB0aWNrLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NoZWNrRm9yQ29sbGlzaW9ucyh3b3JsZCwgdGltZVN0ZXApIHtcbiAgICAgICAgY29uc3QgZHluYW1pY3NXb3JsZCA9IEFtbW8ud3JhcFBvaW50ZXIod29ybGQsIEFtbW8uYnREeW5hbWljc1dvcmxkKTtcblxuICAgICAgICAvLyBDaGVjayBmb3IgY29sbGlzaW9ucyBhbmQgZmlyZSBjYWxsYmFja3NcbiAgICAgICAgY29uc3QgZGlzcGF0Y2hlciA9IGR5bmFtaWNzV29ybGQuZ2V0RGlzcGF0Y2hlcigpO1xuICAgICAgICBjb25zdCBudW1NYW5pZm9sZHMgPSBkaXNwYXRjaGVyLmdldE51bU1hbmlmb2xkcygpO1xuXG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBhbGwgY29udGFjdHMgYW5kIGZpcmUgZXZlbnRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtTWFuaWZvbGRzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1hbmlmb2xkID0gZGlzcGF0Y2hlci5nZXRNYW5pZm9sZEJ5SW5kZXhJbnRlcm5hbChpKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keTAgPSBtYW5pZm9sZC5nZXRCb2R5MCgpO1xuICAgICAgICAgICAgY29uc3QgYm9keTEgPSBtYW5pZm9sZC5nZXRCb2R5MSgpO1xuXG4gICAgICAgICAgICBjb25zdCB3YjAgPSBBbW1vLmNhc3RPYmplY3QoYm9keTAsIEFtbW8uYnRSaWdpZEJvZHkpO1xuICAgICAgICAgICAgY29uc3Qgd2IxID0gQW1tby5jYXN0T2JqZWN0KGJvZHkxLCBBbW1vLmJ0UmlnaWRCb2R5KTtcblxuICAgICAgICAgICAgY29uc3QgZTAgPSB3YjAuZW50aXR5O1xuICAgICAgICAgICAgY29uc3QgZTEgPSB3YjEuZW50aXR5O1xuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBlbnRpdHkgaXMgbnVsbCAtIFRPRE86IGludmVzdGlnYXRlIHdoZW4gdGhpcyBoYXBwZW5zXG4gICAgICAgICAgICBpZiAoIWUwIHx8ICFlMSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmbGFnczAgPSB3YjAuZ2V0Q29sbGlzaW9uRmxhZ3MoKTtcbiAgICAgICAgICAgIGNvbnN0IGZsYWdzMSA9IHdiMS5nZXRDb2xsaXNpb25GbGFncygpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1Db250YWN0cyA9IG1hbmlmb2xkLmdldE51bUNvbnRhY3RzKCk7XG4gICAgICAgICAgICBjb25zdCBmb3J3YXJkQ29udGFjdHMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHJldmVyc2VDb250YWN0cyA9IFtdO1xuICAgICAgICAgICAgbGV0IG5ld0NvbGxpc2lvbjtcblxuICAgICAgICAgICAgaWYgKG51bUNvbnRhY3RzID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IGZpcmUgY29udGFjdCBldmVudHMgZm9yIHRyaWdnZXJzXG4gICAgICAgICAgICAgICAgaWYgKChmbGFnczAgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGZsYWdzMSAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwRXZlbnRzID0gZTAuY29sbGlzaW9uICYmIChlMC5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUwLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUV2ZW50cyA9IGUxLmNvbGxpc2lvbiAmJiAoZTEuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMS5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTBCb2R5RXZlbnRzID0gZTAucmlnaWRib2R5ICYmIChlMC5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUwLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUJvZHlFdmVudHMgPSBlMS5yaWdpZGJvZHkgJiYgKGUxLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTEucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSB0cmlnZ2VyZW50ZXIgZXZlbnRzIGZvciB0cmlnZ2Vyc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUwLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uICYmICEoZmxhZ3MxICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTEsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24gJiYgIShmbGFnczAgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgndHJpZ2dlcmVudGVyJywgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSB0cmlnZ2VyZW50ZXIgZXZlbnRzIGZvciByaWdpZGJvZGllc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZTBCb2R5RXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5yaWdpZGJvZHkuZmlyZSgndHJpZ2dlcmVudGVyJywgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGUxQm9keUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwRXZlbnRzID0gdGhpcy5faGFzQ29udGFjdEV2ZW50KGUwKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFFdmVudHMgPSB0aGlzLl9oYXNDb250YWN0RXZlbnQoZTEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBnbG9iYWxFdmVudHMgPSB0aGlzLmhhc0V2ZW50KCdjb250YWN0Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsb2JhbEV2ZW50cyB8fCBlMEV2ZW50cyB8fCBlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1Db250YWN0czsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnRDb250YWN0UG9pbnQgPSBtYW5pZm9sZC5nZXRDb250YWN0UG9pbnQoaik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGFjdFBvaW50ID0gdGhpcy5fY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8oYnRDb250YWN0UG9pbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzIHx8IGUxRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcndhcmRDb250YWN0cy5wdXNoKGNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmVyc2VDb250YWN0UG9pbnQgPSB0aGlzLl9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8oYnRDb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlQ29udGFjdHMucHVzaChyZXZlcnNlQ29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2xvYmFsRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgZ2xvYmFsIGNvbnRhY3QgZXZlbnQgZm9yIGV2ZXJ5IGNvbnRhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChlMCwgZTEsIGNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnY29udGFjdCcsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkUmVzdWx0ID0gdGhpcy5fY3JlYXRlQ29udGFjdFJlc3VsdChlMSwgZm9yd2FyZENvbnRhY3RzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwLmNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgnY29udGFjdCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uc3RhcnQnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMC5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ2NvbnRhY3QnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmVyc2VSZXN1bHQgPSB0aGlzLl9jcmVhdGVDb250YWN0UmVzdWx0KGUwLCByZXZlcnNlQ29udGFjdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTEuY29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCdjb250YWN0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCdjb2xsaXNpb25zdGFydCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgnY29udGFjdCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgnY29sbGlzaW9uc3RhcnQnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGZvciBjb2xsaXNpb25zIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IGFuZCBmaXJlIGV2ZW50c1xuICAgICAgICB0aGlzLl9jbGVhbk9sZENvbGxpc2lvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBjb250YWN0IHBvb2xzXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbC5mcmVlQWxsKCk7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wuZnJlZUFsbCgpO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sLmZyZWVBbGwoKTtcbiAgICB9XG5cbiAgICBvblVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgaSwgbGVuO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMucGh5c2ljc1N0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIGRvd25jYXN0IGdyYXZpdHkgdG8gZmxvYXQzMiBzbyB3ZSBjYW4gYWNjdXJhdGVseSBjb21wYXJlIHdpdGggZXhpc3RpbmdcbiAgICAgICAgLy8gZ3Jhdml0eSBzZXQgaW4gYW1tby5cbiAgICAgICAgdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMF0gPSB0aGlzLmdyYXZpdHkueDtcbiAgICAgICAgdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMV0gPSB0aGlzLmdyYXZpdHkueTtcbiAgICAgICAgdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMl0gPSB0aGlzLmdyYXZpdHkuejtcblxuICAgICAgICAvLyBDaGVjayB0byBzZWUgd2hldGhlciB3ZSBuZWVkIHRvIHVwZGF0ZSBncmF2aXR5IG9uIHRoZSBkeW5hbWljcyB3b3JsZFxuICAgICAgICBjb25zdCBncmF2aXR5ID0gdGhpcy5keW5hbWljc1dvcmxkLmdldEdyYXZpdHkoKTtcbiAgICAgICAgaWYgKGdyYXZpdHkueCgpICE9PSB0aGlzLl9ncmF2aXR5RmxvYXQzMlswXSB8fFxuICAgICAgICAgICAgZ3Jhdml0eS55KCkgIT09IHRoaXMuX2dyYXZpdHlGbG9hdDMyWzFdIHx8XG4gICAgICAgICAgICBncmF2aXR5LnooKSAhPT0gdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMl0pIHtcbiAgICAgICAgICAgIGdyYXZpdHkuc2V0VmFsdWUodGhpcy5ncmF2aXR5LngsIHRoaXMuZ3Jhdml0eS55LCB0aGlzLmdyYXZpdHkueik7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0R3Jhdml0eShncmF2aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyaWdnZXJzID0gdGhpcy5fdHJpZ2dlcnM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHRyaWdnZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0cmlnZ2Vyc1tpXS51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbXBvdW5kcyA9IHRoaXMuX2NvbXBvdW5kcztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gY29tcG91bmRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb21wb3VuZHNbaV0uX3VwZGF0ZUNvbXBvdW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgYWxsIGtpbmVtYXRpYyBib2RpZXMgYmFzZWQgb24gdGhlaXIgY3VycmVudCBlbnRpdHkgdHJhbnNmb3JtXG4gICAgICAgIGNvbnN0IGtpbmVtYXRpYyA9IHRoaXMuX2tpbmVtYXRpYztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0ga2luZW1hdGljLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBraW5lbWF0aWNbaV0uX3VwZGF0ZUtpbmVtYXRpYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCB0aGUgcGh5c2ljcyBzaW11bGF0aW9uXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5zdGVwU2ltdWxhdGlvbihkdCwgdGhpcy5tYXhTdWJTdGVwcywgdGhpcy5maXhlZFRpbWVTdGVwKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHRyYW5zZm9ybXMgb2YgYWxsIGVudGl0aWVzIHJlZmVyZW5jaW5nIGEgZHluYW1pYyBib2R5XG4gICAgICAgIGNvbnN0IGR5bmFtaWMgPSB0aGlzLl9keW5hbWljO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBkeW5hbWljLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBkeW5hbWljW2ldLl91cGRhdGVEeW5hbWljKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZHluYW1pY3NXb3JsZC5zZXRJbnRlcm5hbFRpY2tDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX2NoZWNrRm9yQ29sbGlzaW9ucyhBbW1vLmdldFBvaW50ZXIodGhpcy5keW5hbWljc1dvcmxkKSwgZHQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMucGh5c2ljc1RpbWUgPSBub3coKSAtIHRoaXMuX3N0YXRzLnBoeXNpY3NTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5keW5hbWljc1dvcmxkKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLnNvbHZlcik7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5kaXNwYXRjaGVyKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuc29sdmVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaGVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IENvbnRhY3RQb2ludCwgQ29udGFjdFJlc3VsdCwgUmF5Y2FzdFJlc3VsdCwgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLCBTaW5nbGVDb250YWN0UmVzdWx0IH07XG4iXSwibmFtZXMiOlsiYW1tb1JheVN0YXJ0IiwiYW1tb1JheUVuZCIsIlJheWNhc3RSZXN1bHQiLCJjb25zdHJ1Y3RvciIsImVudGl0eSIsInBvaW50Iiwibm9ybWFsIiwiU2luZ2xlQ29udGFjdFJlc3VsdCIsImEiLCJiIiwiY29udGFjdFBvaW50IiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiaW1wdWxzZSIsImxvY2FsUG9pbnRBIiwiVmVjMyIsImxvY2FsUG9pbnRCIiwicG9pbnRBIiwicG9pbnRCIiwibG9jYWxQb2ludCIsImxvY2FsUG9pbnRPdGhlciIsInBvaW50T3RoZXIiLCJDb250YWN0UG9pbnQiLCJDb250YWN0UmVzdWx0Iiwib3RoZXIiLCJjb250YWN0cyIsIl9zY2hlbWEiLCJSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJhcHAiLCJtYXhTdWJTdGVwcyIsImZpeGVkVGltZVN0ZXAiLCJncmF2aXR5IiwiX2dyYXZpdHlGbG9hdDMyIiwiRmxvYXQzMkFycmF5IiwiX2R5bmFtaWMiLCJfa2luZW1hdGljIiwiX3RyaWdnZXJzIiwiX2NvbXBvdW5kcyIsImlkIiwiX3N0YXRzIiwic3RhdHMiLCJmcmFtZSIsIkNvbXBvbmVudFR5cGUiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJEYXRhVHlwZSIsIlJpZ2lkQm9keUNvbXBvbmVudERhdGEiLCJjb250YWN0UG9pbnRQb29sIiwiY29udGFjdFJlc3VsdFBvb2wiLCJzaW5nbGVDb250YWN0UmVzdWx0UG9vbCIsInNjaGVtYSIsImNvbGxpc2lvbnMiLCJmcmFtZUNvbGxpc2lvbnMiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwib25SZW1vdmUiLCJvbkxpYnJhcnlMb2FkZWQiLCJBbW1vIiwiY29sbGlzaW9uQ29uZmlndXJhdGlvbiIsImJ0RGVmYXVsdENvbGxpc2lvbkNvbmZpZ3VyYXRpb24iLCJkaXNwYXRjaGVyIiwiYnRDb2xsaXNpb25EaXNwYXRjaGVyIiwib3ZlcmxhcHBpbmdQYWlyQ2FjaGUiLCJidERidnRCcm9hZHBoYXNlIiwic29sdmVyIiwiYnRTZXF1ZW50aWFsSW1wdWxzZUNvbnN0cmFpbnRTb2x2ZXIiLCJkeW5hbWljc1dvcmxkIiwiYnREaXNjcmV0ZUR5bmFtaWNzV29ybGQiLCJzZXRJbnRlcm5hbFRpY2tDYWxsYmFjayIsImNoZWNrRm9yQ29sbGlzaW9uc1BvaW50ZXIiLCJhZGRGdW5jdGlvbiIsIl9jaGVja0ZvckNvbGxpc2lvbnMiLCJiaW5kIiwiRGVidWciLCJ3YXJuIiwiYnRWZWN0b3IzIiwiT2JqZWN0UG9vbCIsInN5c3RlbXMiLCJvblVwZGF0ZSIsIm9mZiIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJwcm9wcyIsInByb3BlcnR5IiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsIkFycmF5IiwiaXNBcnJheSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJyaWdpZGJvZHkiLCJlbmFibGVkIiwibWFzcyIsImxpbmVhckRhbXBpbmciLCJhbmd1bGFyRGFtcGluZyIsImxpbmVhckZhY3RvciIsIngiLCJ5IiwieiIsImFuZ3VsYXJGYWN0b3IiLCJmcmljdGlvbiIsInJvbGxpbmdGcmljdGlvbiIsInJlc3RpdHV0aW9uIiwidHlwZSIsImdyb3VwIiwibWFzayIsImFkZENvbXBvbmVudCIsImJvZHkiLCJyZW1vdmVCb2R5IiwiZGVzdHJveUJvZHkiLCJhZGRCb2R5IiwidW5kZWZpbmVkIiwiYWRkUmlnaWRCb2R5IiwicmVtb3ZlUmlnaWRCb2R5IiwiY3JlYXRlQm9keSIsInNoYXBlIiwidHJhbnNmb3JtIiwibG9jYWxJbmVydGlhIiwiY2FsY3VsYXRlTG9jYWxJbmVydGlhIiwibW90aW9uU3RhdGUiLCJidERlZmF1bHRNb3Rpb25TdGF0ZSIsImJvZHlJbmZvIiwiYnRSaWdpZEJvZHlDb25zdHJ1Y3Rpb25JbmZvIiwiYnRSaWdpZEJvZHkiLCJkZXN0cm95IiwiZ2V0TW90aW9uU3RhdGUiLCJyYXljYXN0Rmlyc3QiLCJzdGFydCIsImVuZCIsInJlc3VsdCIsInNldFZhbHVlIiwicmF5Q2FsbGJhY2siLCJDbG9zZXN0UmF5UmVzdWx0Q2FsbGJhY2siLCJyYXlUZXN0IiwiaGFzSGl0IiwiY29sbGlzaW9uT2JqIiwiZ2V0X21fY29sbGlzaW9uT2JqZWN0IiwiY2FzdE9iamVjdCIsImdldF9tX2hpdFBvaW50V29ybGQiLCJnZXRfbV9oaXROb3JtYWxXb3JsZCIsImRlcHJlY2F0ZWQiLCJjYWxsYmFjayIsInJheWNhc3RBbGwiLCJhc3NlcnQiLCJBbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2siLCJyZXN1bHRzIiwiY29sbGlzaW9uT2JqcyIsImdldF9tX2NvbGxpc2lvbk9iamVjdHMiLCJwb2ludHMiLCJub3JtYWxzIiwibnVtSGl0cyIsInNpemUiLCJpIiwiYXQiLCJwdXNoIiwiX3N0b3JlQ29sbGlzaW9uIiwiaXNOZXdDb2xsaXNpb24iLCJndWlkIiwiZ2V0R3VpZCIsIm90aGVycyIsImluZGV4T2YiLCJfY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8iLCJnZXRfbV9sb2NhbFBvaW50QSIsImdldF9tX2xvY2FsUG9pbnRCIiwicG9zaXRpb25Xb3JsZE9uQSIsImdldFBvc2l0aW9uV29ybGRPbkEiLCJwb3NpdGlvbldvcmxkT25CIiwiZ2V0UG9zaXRpb25Xb3JsZE9uQiIsIm5vcm1hbFdvcmxkT25CIiwiZ2V0X21fbm9ybWFsV29ybGRPbkIiLCJjb250YWN0IiwiYWxsb2NhdGUiLCJzZXQiLCJnZXRBcHBsaWVkSW1wdWxzZSIsIl9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8iLCJfY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdCIsIl9jcmVhdGVDb250YWN0UmVzdWx0IiwiX2NsZWFuT2xkQ29sbGlzaW9ucyIsImZyYW1lQ29sbGlzaW9uIiwiY29sbGlzaW9uIiwiZW50aXR5Q29sbGlzaW9uIiwiZW50aXR5UmlnaWRib2R5Iiwic3BsaWNlIiwidHJpZ2dlciIsImZpcmUiLCJfaGFzQ29udGFjdEV2ZW50IiwiYyIsImhhc0V2ZW50IiwiciIsIndvcmxkIiwidGltZVN0ZXAiLCJ3cmFwUG9pbnRlciIsImJ0RHluYW1pY3NXb3JsZCIsImdldERpc3BhdGNoZXIiLCJudW1NYW5pZm9sZHMiLCJnZXROdW1NYW5pZm9sZHMiLCJtYW5pZm9sZCIsImdldE1hbmlmb2xkQnlJbmRleEludGVybmFsIiwiYm9keTAiLCJnZXRCb2R5MCIsImJvZHkxIiwiZ2V0Qm9keTEiLCJ3YjAiLCJ3YjEiLCJlMCIsImUxIiwiZmxhZ3MwIiwiZ2V0Q29sbGlzaW9uRmxhZ3MiLCJmbGFnczEiLCJudW1Db250YWN0cyIsImdldE51bUNvbnRhY3RzIiwiZm9yd2FyZENvbnRhY3RzIiwicmV2ZXJzZUNvbnRhY3RzIiwibmV3Q29sbGlzaW9uIiwiQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QiLCJlMEV2ZW50cyIsImUxRXZlbnRzIiwiZTBCb2R5RXZlbnRzIiwiZTFCb2R5RXZlbnRzIiwiZ2xvYmFsRXZlbnRzIiwiaiIsImJ0Q29udGFjdFBvaW50IiwiZ2V0Q29udGFjdFBvaW50IiwicmV2ZXJzZUNvbnRhY3RQb2ludCIsImZvcndhcmRSZXN1bHQiLCJyZXZlcnNlUmVzdWx0IiwiZnJlZUFsbCIsImR0IiwibGVuIiwicGh5c2ljc1N0YXJ0Iiwibm93IiwiZ2V0R3Jhdml0eSIsInNldEdyYXZpdHkiLCJ0cmlnZ2VycyIsInVwZGF0ZVRyYW5zZm9ybSIsImNvbXBvdW5kcyIsIl91cGRhdGVDb21wb3VuZCIsImtpbmVtYXRpYyIsIl91cGRhdGVLaW5lbWF0aWMiLCJzdGVwU2ltdWxhdGlvbiIsImR5bmFtaWMiLCJfdXBkYXRlRHluYW1pYyIsImdldFBvaW50ZXIiLCJwaHlzaWNzVGltZSIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBYUEsSUFBSUEsWUFBWSxFQUFFQyxVQUFVLENBQUE7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRTtBQUMvQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDRixNQUFNLEdBQUdBLE1BQU0sQ0FBQTs7QUFFcEI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7O0FBRWxCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3hCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLG1CQUFtQixDQUFDO0FBQ3RCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUosRUFBQUEsV0FBVyxDQUFDSyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsWUFBWSxFQUFFO0FBQzVCLElBQUEsSUFBSUMsU0FBUyxDQUFDQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3hCO0FBQ1o7QUFDQTtBQUNBO0FBQ0E7TUFDWSxJQUFJLENBQUNKLENBQUMsR0FBRyxJQUFJLENBQUE7O0FBRWI7QUFDWjtBQUNBO0FBQ0E7QUFDQTtNQUNZLElBQUksQ0FBQ0Ms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
