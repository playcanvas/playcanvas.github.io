/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
   * @param {number} hitFraction - The normalized distance (between 0 and 1) at which the ray hit
   * occurred from the starting point.
   * @hideconstructor
   */
  constructor(entity, point, normal, hitFraction) {
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

    /**
     * The normalized distance (between 0 and 1) at which the ray hit occurred from the
     * starting point.
     *
     * @type {number}
     */
    this.hitFraction = hitFraction;
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
   * @param {object} [options] - The additional options for the raycasting.
   * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
   * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
   * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
   * query but within an array.
   * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
   * Must return true to proceed with result. Takes one argument: the entity to evaluate.
   *
   * @returns {RaycastResult|null} The result of the raycasting or null if there was no hit.
   */
  raycastFirst(start, end, options = {}) {
    // Tags and custom callback can only be performed by looking at all results.
    if (options.filterTags || options.filterCallback) {
      options.sort = true;
      return this.raycastAll(start, end, options)[0] || null;
    }
    let result = null;
    ammoRayStart.setValue(start.x, start.y, start.z);
    ammoRayEnd.setValue(end.x, end.y, end.z);
    const rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);
    if (typeof options.filterCollisionGroup === 'number') {
      rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
    }
    if (typeof options.filterCollisionMask === 'number') {
      rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
    }
    this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
    if (rayCallback.hasHit()) {
      const collisionObj = rayCallback.get_m_collisionObject();
      const body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
      if (body) {
        const point = rayCallback.get_m_hitPointWorld();
        const normal = rayCallback.get_m_hitNormalWorld();
        result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()), rayCallback.get_m_closestHitFraction());

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
   * of length 0. Results are sorted by distance with closest first.
   *
   * @param {Vec3} start - The world space point where the ray starts.
   * @param {Vec3} end - The world space point where the ray ends.
   * @param {object} [options] - The additional options for the raycasting.
   * @param {boolean} [options.sort] - Whether to sort raycast results based on distance with closest
   * first. Defaults to false.
   * @param {number} [options.filterCollisionGroup] - Collision group to apply to the raycast.
   * @param {number} [options.filterCollisionMask] - Collision mask to apply to the raycast.
   * @param {any[]} [options.filterTags] - Tags filters. Defined the same way as a {@link Tags#has}
   * query but within an array.
   * @param {Function} [options.filterCallback] - Custom function to use to filter entities.
   * Must return true to proceed with result. Takes the entity to evaluate as argument.
   *
   * @returns {RaycastResult[]} An array of raycast hit results (0 length if there were no hits).
   *
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2));
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * // where hit entity is tagged with `bird` OR `mammal`
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
   *     filterTags: [ "bird", "mammal" ]
   * });
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * // where hit entity has a `camera` component
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
   *     filterCallback: (entity) => entity && entity.camera
   * });
   * @example
   * // Return all results of a raycast between 0, 2, 2 and 0, -2, -2
   * // where hit entity is tagged with (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
   * // and the entity has an `anim` component
   * const hits = this.app.systems.rigidbody.raycastAll(new Vec3(0, 2, 2), new Vec3(0, -2, -2), {
   *     filterTags: [
   *         [ "carnivore", "mammal" ],
   *         [ "carnivore", "reptile" ]
   *     ],
   *     filterCallback: (entity) => entity && entity.anim
   * });
   */
  raycastAll(start, end, options = {}) {
    Debug.assert(Ammo.AllHitsRayResultCallback, 'pc.RigidBodyComponentSystem#raycastAll: Your version of ammo.js does not expose Ammo.AllHitsRayResultCallback. Update it to latest.');
    const results = [];
    ammoRayStart.setValue(start.x, start.y, start.z);
    ammoRayEnd.setValue(end.x, end.y, end.z);
    const rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);
    if (typeof options.filterCollisionGroup === 'number') {
      rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
    }
    if (typeof options.filterCollisionMask === 'number') {
      rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
    }
    this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
    if (rayCallback.hasHit()) {
      const collisionObjs = rayCallback.get_m_collisionObjects();
      const points = rayCallback.get_m_hitPointWorld();
      const normals = rayCallback.get_m_hitNormalWorld();
      const hitFractions = rayCallback.get_m_hitFractions();
      const numHits = collisionObjs.size();
      for (let i = 0; i < numHits; i++) {
        const body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);
        if (body && body.entity) {
          if (options.filterTags && !body.entity.has(...options.filterTags) || options.filterCallback && !options.filterCallback(body.entity)) {
            continue;
          }
          const point = points.at(i);
          const normal = normals.at(i);
          const result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()), hitFractions.at(i));
          results.push(result);
        }
      }
      if (options.sort) {
        results.sort((a, b) => a.hitFraction - b.hitFraction);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG5sZXQgYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kO1xuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBzdWNjZXNzZnVsIHJheWNhc3QgaGl0LlxuICovXG5jbGFzcyBSYXljYXN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmF5Y2FzdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcG9pbnQgYXQgd2hpY2ggdGhlIHJheSBoaXQgdGhlIGVudGl0eSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG5vcm1hbCAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBzdXJmYWNlIHdoZXJlIHRoZSByYXkgaGl0IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoaXRGcmFjdGlvbiAtIFRoZSBub3JtYWxpemVkIGRpc3RhbmNlIChiZXR3ZWVuIDAgYW5kIDEpIGF0IHdoaWNoIHRoZSByYXkgaGl0XG4gICAgICogb2NjdXJyZWQgZnJvbSB0aGUgc3RhcnRpbmcgcG9pbnQuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgcG9pbnQsIG5vcm1hbCwgaGl0RnJhY3Rpb24pIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IGF0IHdoaWNoIHRoZSByYXkgaGl0IHRoZSBlbnRpdHkgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgc3VyZmFjZSB3aGVyZSB0aGUgcmF5IGhpdCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5vcm1hbGl6ZWQgZGlzdGFuY2UgKGJldHdlZW4gMCBhbmQgMSkgYXQgd2hpY2ggdGhlIHJheSBoaXQgb2NjdXJyZWQgZnJvbSB0aGVcbiAgICAgICAgICogc3RhcnRpbmcgcG9pbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmhpdEZyYWN0aW9uID0gaGl0RnJhY3Rpb247XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAqL1xuY2xhc3MgU2luZ2xlQ29udGFjdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNpbmdsZUNvbnRhY3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBhIC0gVGhlIGZpcnN0IGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBiIC0gVGhlIHNlY29uZCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICogQHBhcmFtIHtDb250YWN0UG9pbnR9IGNvbnRhY3RQb2ludCAtIFRoZSBjb250YWN0IHBvaW50IGJldHdlZW4gdGhlIHR3byBlbnRpdGllcy5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYSwgYiwgY29udGFjdFBvaW50KSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBmaXJzdCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmEgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBzZWNvbmQgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5iID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3RcbiAgICAgICAgICAgICAqIHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIGJvZGllcyBjb2xsaWRlZC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmltcHVsc2UgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gQS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBCIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byBCLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRCID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEEgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnBvaW50QSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBCIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5wb2ludEIgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIEVudGl0eSBCLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5ub3JtYWwgPSBuZXcgVmVjMygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hID0gYTtcbiAgICAgICAgICAgIHRoaXMuYiA9IGI7XG4gICAgICAgICAgICB0aGlzLmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludE90aGVyO1xuICAgICAgICAgICAgdGhpcy5wb2ludEEgPSBjb250YWN0UG9pbnQucG9pbnQ7XG4gICAgICAgICAgICB0aGlzLnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICAgICAgdGhpcy5ub3JtYWwgPSBjb250YWN0UG9pbnQubm9ybWFsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIEVudGl0aWVzLlxuICovXG5jbGFzcyBDb250YWN0UG9pbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UG9pbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtsb2NhbFBvaW50XSAtIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbG9jYWxQb2ludE90aGVyXSAtIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLFxuICAgICAqIHJlbGF0aXZlIHRvIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50T3RoZXJdIC0gVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluXG4gICAgICogd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbm9ybWFsXSAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkXG4gICAgICogc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbXB1bHNlXSAtIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyXG4gICAgICogZHVyaW5nIHRoZSBsYXN0IHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIG9iamVjdHMgY29sbGlkZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9jYWxQb2ludCA9IG5ldyBWZWMzKCksIGxvY2FsUG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIHBvaW50ID0gbmV3IFZlYzMoKSwgcG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIG5vcm1hbCA9IG5ldyBWZWMzKCksIGltcHVsc2UgPSAwKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnQgPSBsb2NhbFBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnRPdGhlciA9IGxvY2FsUG9pbnRPdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnQgPSBwb2ludDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnRPdGhlciA9IHBvaW50T3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9ybWFsID0gbm9ybWFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3Qgc3ViLXN0ZXAuXG4gICAgICAgICAqIERlc2NyaWJlcyBob3cgaGFyZCB0d28gb2JqZWN0cyBjb2xsaWRlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXB1bHNlID0gaW1wdWxzZTtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gRW50aXRpZXMuXG4gKi9cbmNsYXNzIENvbnRhY3RSZXN1bHQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UmVzdWx0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUgZW50aXR5IHRoYXQgd2FzIGludm9sdmVkIGluIHRoZVxuICAgICAqIGNvbnRhY3Qgd2l0aCB0aGlzIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge0NvbnRhY3RQb2ludFtdfSBjb250YWN0cyAtIEFuIGFycmF5IG9mIENvbnRhY3RQb2ludHMgd2l0aCB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihvdGhlciwgY29udGFjdHMpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3Qgd2l0aCB0aGlzIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vdGhlciA9IG90aGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbiBhcnJheSBvZiBDb250YWN0UG9pbnRzIHdpdGggdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbnRhY3RQb2ludFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb250YWN0cyA9IGNvbnRhY3RzO1xuICAgIH1cbn1cblxuY29uc3QgX3NjaGVtYSA9IFsnZW5hYmxlZCddO1xuXG4vKipcbiAqIFRoZSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gbWFpbnRhaW5zIHRoZSBkeW5hbWljcyB3b3JsZCBmb3Igc2ltdWxhdGluZyByaWdpZCBib2RpZXMsIGl0IGFsc29cbiAqIGNvbnRyb2xzIGdsb2JhbCB2YWx1ZXMgZm9yIHRoZSB3b3JsZCBzdWNoIGFzIGdyYXZpdHkuIE5vdGU6IFRoZSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gaXMgb25seVxuICogdmFsaWQgaWYgM0QgUGh5c2ljcyBpcyBlbmFibGVkIGluIHlvdXIgYXBwbGljYXRpb24uIFlvdSBjYW4gZW5hYmxlIHRoaXMgaW4gdGhlIGFwcGxpY2F0aW9uXG4gKiBzZXR0aW5ncyBmb3IgeW91ciBwcm9qZWN0LlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtYXhTdWJTdGVwcyA9IDEwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZml4ZWRUaW1lU3RlcCA9IDEgLyA2MDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbCBncmF2aXR5IGluIHRoZSBwaHlzaWNzIHNpbXVsYXRpb24uIERlZmF1bHRzIHRvXG4gICAgICogWzAsIC05LjgxLCAwXSB3aGljaCBpcyBhbiBhcHByb3hpbWF0aW9uIG9mIHRoZSBncmF2aXRhdGlvbmFsIGZvcmNlIG9uIEVhcnRoLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ3Jhdml0eSA9IG5ldyBWZWMzKDAsIC05LjgxLCAwKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ3Jhdml0eUZsb2F0MzIgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2R5bmFtaWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9raW5lbWF0aWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90cmlnZ2VycyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBvdW5kcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdyaWdpZGJvZHknO1xuICAgICAgICB0aGlzLl9zdGF0cyA9IGFwcC5zdGF0cy5mcmFtZTtcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBudWxsO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0ge307XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBjb250YWN0IG9jY3VycyBiZXR3ZWVuIHR3byByaWdpZCBib2RpZXMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2NvbnRhY3RcbiAgICAgKiBAcGFyYW0ge1NpbmdsZUNvbnRhY3RSZXN1bHR9IHJlc3VsdCAtIERldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIGJvZGllcy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBvbmNlIEFtbW8gaGFzIGJlZW4gbG9hZGVkLiBSZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgdGhlIHBoeXNpY3Mgd29ybGQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25MaWJyYXJ5TG9hZGVkKCkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIEFtbW8gcGh5c2ljcyB3b3JsZFxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBuZXcgQW1tby5idERlZmF1bHRDb2xsaXNpb25Db25maWd1cmF0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoZXIgPSBuZXcgQW1tby5idENvbGxpc2lvbkRpc3BhdGNoZXIodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBuZXcgQW1tby5idERidnRCcm9hZHBoYXNlKCk7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG5ldyBBbW1vLmJ0U2VxdWVudGlhbEltcHVsc2VDb25zdHJhaW50U29sdmVyKCk7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQgPSBuZXcgQW1tby5idERpc2NyZXRlRHluYW1pY3NXb3JsZCh0aGlzLmRpc3BhdGNoZXIsIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUsIHRoaXMuc29sdmVyLCB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5keW5hbWljc1dvcmxkLnNldEludGVybmFsVGlja0NhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlciA9IEFtbW8uYWRkRnVuY3Rpb24odGhpcy5fY2hlY2tGb3JDb2xsaXNpb25zLmJpbmQodGhpcyksICd2aWYnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2soY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ1dBUk5JTkc6IFRoaXMgdmVyc2lvbiBvZiBhbW1vLmpzIGNhbiBwb3RlbnRpYWxseSBmYWlsIHRvIHJlcG9ydCBjb250YWN0cy4gUGxlYXNlIHVwZGF0ZSBpdCB0byB0aGUgbGF0ZXN0IHZlcnNpb24uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExhemlseSBjcmVhdGUgdGVtcCB2YXJzXG4gICAgICAgICAgICBhbW1vUmF5U3RhcnQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGFtbW9SYXlFbmQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIFJpZ2lkQm9keUNvbXBvbmVudC5vbkxpYnJhcnlMb2FkZWQoKTtcblxuICAgICAgICAgICAgdGhpcy5jb250YWN0UG9pbnRQb29sID0gbmV3IE9iamVjdFBvb2woQ29udGFjdFBvaW50LCAxKTtcbiAgICAgICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChDb250YWN0UmVzdWx0LCAxKTtcbiAgICAgICAgICAgIHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChTaW5nbGVDb250YWN0UmVzdWx0LCAxKTtcblxuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBVbmJpbmQgdGhlIHVwZGF0ZSBmdW5jdGlvbiBpZiB3ZSBoYXZlbid0IGxvYWRlZCBBbW1vIGJ5IG5vd1xuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3VwZGF0ZScsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbnN0IHByb3BzID0gW1xuICAgICAgICAgICAgJ21hc3MnLFxuICAgICAgICAgICAgJ2xpbmVhckRhbXBpbmcnLFxuICAgICAgICAgICAgJ2FuZ3VsYXJEYW1waW5nJyxcbiAgICAgICAgICAgICdsaW5lYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2FuZ3VsYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2ZyaWN0aW9uJyxcbiAgICAgICAgICAgICdyb2xsaW5nRnJpY3Rpb24nLFxuICAgICAgICAgICAgJ3Jlc3RpdHV0aW9uJyxcbiAgICAgICAgICAgICd0eXBlJyxcbiAgICAgICAgICAgICdncm91cCcsXG4gICAgICAgICAgICAnbWFzaydcbiAgICAgICAgXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIHByb3BzKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGRhdGFbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gbmV3IFZlYzModmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgWydlbmFibGVkJ10pO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gY3JlYXRlIG5ldyBkYXRhIGJsb2NrIGZvciBjbG9uZVxuICAgICAgICBjb25zdCByaWdpZGJvZHkgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgZW5hYmxlZDogcmlnaWRib2R5LmVuYWJsZWQsXG4gICAgICAgICAgICBtYXNzOiByaWdpZGJvZHkubWFzcyxcbiAgICAgICAgICAgIGxpbmVhckRhbXBpbmc6IHJpZ2lkYm9keS5saW5lYXJEYW1waW5nLFxuICAgICAgICAgICAgYW5ndWxhckRhbXBpbmc6IHJpZ2lkYm9keS5hbmd1bGFyRGFtcGluZyxcbiAgICAgICAgICAgIGxpbmVhckZhY3RvcjogW3JpZ2lkYm9keS5saW5lYXJGYWN0b3IueCwgcmlnaWRib2R5LmxpbmVhckZhY3Rvci55LCByaWdpZGJvZHkubGluZWFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgYW5ndWxhckZhY3RvcjogW3JpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLngsIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnksIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgZnJpY3Rpb246IHJpZ2lkYm9keS5mcmljdGlvbixcbiAgICAgICAgICAgIHJvbGxpbmdGcmljdGlvbjogcmlnaWRib2R5LnJvbGxpbmdGcmljdGlvbixcbiAgICAgICAgICAgIHJlc3RpdHV0aW9uOiByaWdpZGJvZHkucmVzdGl0dXRpb24sXG4gICAgICAgICAgICB0eXBlOiByaWdpZGJvZHkudHlwZSxcbiAgICAgICAgICAgIGdyb3VwOiByaWdpZGJvZHkuZ3JvdXAsXG4gICAgICAgICAgICBtYXNrOiByaWdpZGJvZHkubWFza1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IGNvbXBvbmVudC5ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVCb2R5KGJvZHkpO1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95Qm9keShib2R5KTtcblxuICAgICAgICAgICAgY29tcG9uZW50LmJvZHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQm9keShib2R5LCBncm91cCwgbWFzaykge1xuICAgICAgICBpZiAoZ3JvdXAgIT09IHVuZGVmaW5lZCAmJiBtYXNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5hZGRSaWdpZEJvZHkoYm9keSwgZ3JvdXAsIG1hc2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLmFkZFJpZ2lkQm9keShib2R5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUJvZHkoYm9keSkge1xuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmVtb3ZlUmlnaWRCb2R5KGJvZHkpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBsb2NhbEluZXJ0aWEgPSBuZXcgQW1tby5idFZlY3RvcjMoMCwgMCwgMCk7XG4gICAgICAgIGlmIChtYXNzICE9PSAwKSB7XG4gICAgICAgICAgICBzaGFwZS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgbG9jYWxJbmVydGlhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gbmV3IEFtbW8uYnREZWZhdWx0TW90aW9uU3RhdGUodHJhbnNmb3JtKTtcbiAgICAgICAgY29uc3QgYm9keUluZm8gPSBuZXcgQW1tby5idFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8obWFzcywgbW90aW9uU3RhdGUsIHNoYXBlLCBsb2NhbEluZXJ0aWEpO1xuICAgICAgICBjb25zdCBib2R5ID0gbmV3IEFtbW8uYnRSaWdpZEJvZHkoYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3koYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3kobG9jYWxJbmVydGlhKTtcblxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICB9XG5cbiAgICBkZXN0cm95Qm9keShib2R5KSB7XG4gICAgICAgIC8vIFRoZSBtb3Rpb24gc3RhdGUgbmVlZHMgdG8gYmUgZGVzdHJveWVkIGV4cGxpY2l0bHkgKGlmIHByZXNlbnQpXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShtb3Rpb25TdGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgQW1tby5kZXN0cm95KGJvZHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gdGhlIGZpcnN0IGVudGl0eSB0aGUgcmF5IGhpdHMuIEZpcmUgYSByYXkgaW50byB0aGUgd29ybGQgZnJvbVxuICAgICAqIHN0YXJ0IHRvIGVuZCwgaWYgdGhlIHJheSBoaXRzIGFuIGVudGl0eSB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudCwgaXQgcmV0dXJucyBhXG4gICAgICoge0BsaW5rIFJheWNhc3RSZXN1bHR9LCBvdGhlcndpc2UgcmV0dXJucyBudWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIHRoZSByYXljYXN0aW5nLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cF0gLSBDb2xsaXNpb24gZ3JvdXAgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2tdIC0gQ29sbGlzaW9uIG1hc2sgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHthbnlbXX0gW29wdGlvbnMuZmlsdGVyVGFnc10gLSBUYWdzIGZpbHRlcnMuIERlZmluZWQgdGhlIHNhbWUgd2F5IGFzIGEge0BsaW5rIFRhZ3MjaGFzfVxuICAgICAqIHF1ZXJ5IGJ1dCB3aXRoaW4gYW4gYXJyYXkuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMuZmlsdGVyQ2FsbGJhY2tdIC0gQ3VzdG9tIGZ1bmN0aW9uIHRvIHVzZSB0byBmaWx0ZXIgZW50aXRpZXMuXG4gICAgICogTXVzdCByZXR1cm4gdHJ1ZSB0byBwcm9jZWVkIHdpdGggcmVzdWx0LiBUYWtlcyBvbmUgYXJndW1lbnQ6IHRoZSBlbnRpdHkgdG8gZXZhbHVhdGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UmF5Y2FzdFJlc3VsdHxudWxsfSBUaGUgcmVzdWx0IG9mIHRoZSByYXljYXN0aW5nIG9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIGhpdC5cbiAgICAgKi9cbiAgICByYXljYXN0Rmlyc3Qoc3RhcnQsIGVuZCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIC8vIFRhZ3MgYW5kIGN1c3RvbSBjYWxsYmFjayBjYW4gb25seSBiZSBwZXJmb3JtZWQgYnkgbG9va2luZyBhdCBhbGwgcmVzdWx0cy5cbiAgICAgICAgaWYgKG9wdGlvbnMuZmlsdGVyVGFncyB8fCBvcHRpb25zLmZpbHRlckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNvcnQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmF5Y2FzdEFsbChzdGFydCwgZW5kLCBvcHRpb25zKVswXSB8fCBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgYW1tb1JheVN0YXJ0LnNldFZhbHVlKHN0YXJ0LngsIHN0YXJ0LnksIHN0YXJ0LnopO1xuICAgICAgICBhbW1vUmF5RW5kLnNldFZhbHVlKGVuZC54LCBlbmQueSwgZW5kLnopO1xuICAgICAgICBjb25zdCByYXlDYWxsYmFjayA9IG5ldyBBbW1vLkNsb3Nlc3RSYXlSZXN1bHRDYWxsYmFjayhhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHJheUNhbGxiYWNrLnNldF9tX2NvbGxpc2lvbkZpbHRlckdyb3VwKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uR3JvdXApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2sgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICByYXlDYWxsYmFjay5zZXRfbV9jb2xsaXNpb25GaWx0ZXJNYXNrKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uTWFzayk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmogPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3QoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2JqLCBBbW1vLmJ0UmlnaWRCb2R5KTtcblxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHJheUNhbGxiYWNrLmdldF9tX2hpdFBvaW50V29ybGQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWwgPSByYXlDYWxsYmFjay5nZXRfbV9oaXROb3JtYWxXb3JsZCgpO1xuXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGJvZHkuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhwb2ludC54KCksIHBvaW50LnkoKSwgcG9pbnQueigpKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSksXG4gICAgICAgICAgICAgICAgICAgIHJheUNhbGxiYWNrLmdldF9tX2Nsb3Nlc3RIaXRGcmFjdGlvbigpXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIC8vIGtlZXBpbmcgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNyYXlDYXN0Rmlyc3Qgbm8gbG9uZ2VyIHJlcXVpcmVzIGEgY2FsbGJhY2suIFRoZSByZXN1bHQgb2YgdGhlIHJheWNhc3QgaXMgcmV0dXJuZWQgYnkgdGhlIGZ1bmN0aW9uIGluc3RlYWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KHJheUNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gYWxsIGVudGl0aWVzIHRoZSByYXkgaGl0cy4gSXQgcmV0dXJucyBhbiBhcnJheSBvZlxuICAgICAqIHtAbGluayBSYXljYXN0UmVzdWx0fSwgb25lIGZvciBlYWNoIGhpdC4gSWYgbm8gaGl0cyBhcmUgZGV0ZWN0ZWQsIHRoZSByZXR1cm5lZCBhcnJheSB3aWxsIGJlXG4gICAgICogb2YgbGVuZ3RoIDAuIFJlc3VsdHMgYXJlIHNvcnRlZCBieSBkaXN0YW5jZSB3aXRoIGNsb3Nlc3QgZmlyc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgc3RhcnRzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgZW5kcy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIGFkZGl0aW9uYWwgb3B0aW9ucyBmb3IgdGhlIHJheWNhc3RpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zb3J0XSAtIFdoZXRoZXIgdG8gc29ydCByYXljYXN0IHJlc3VsdHMgYmFzZWQgb24gZGlzdGFuY2Ugd2l0aCBjbG9zZXN0XG4gICAgICogZmlyc3QuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cF0gLSBDb2xsaXNpb24gZ3JvdXAgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2tdIC0gQ29sbGlzaW9uIG1hc2sgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHthbnlbXX0gW29wdGlvbnMuZmlsdGVyVGFnc10gLSBUYWdzIGZpbHRlcnMuIERlZmluZWQgdGhlIHNhbWUgd2F5IGFzIGEge0BsaW5rIFRhZ3MjaGFzfVxuICAgICAqIHF1ZXJ5IGJ1dCB3aXRoaW4gYW4gYXJyYXkuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMuZmlsdGVyQ2FsbGJhY2tdIC0gQ3VzdG9tIGZ1bmN0aW9uIHRvIHVzZSB0byBmaWx0ZXIgZW50aXRpZXMuXG4gICAgICogTXVzdCByZXR1cm4gdHJ1ZSB0byBwcm9jZWVkIHdpdGggcmVzdWx0LiBUYWtlcyB0aGUgZW50aXR5IHRvIGV2YWx1YXRlIGFzIGFyZ3VtZW50LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1JheWNhc3RSZXN1bHRbXX0gQW4gYXJyYXkgb2YgcmF5Y2FzdCBoaXQgcmVzdWx0cyAoMCBsZW5ndGggaWYgdGhlcmUgd2VyZSBubyBoaXRzKS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCByZXN1bHRzIG9mIGEgcmF5Y2FzdCBiZXR3ZWVuIDAsIDIsIDIgYW5kIDAsIC0yLCAtMlxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgcmVzdWx0cyBvZiBhIHJheWNhc3QgYmV0d2VlbiAwLCAyLCAyIGFuZCAwLCAtMiwgLTJcbiAgICAgKiAvLyB3aGVyZSBoaXQgZW50aXR5IGlzIHRhZ2dlZCB3aXRoIGBiaXJkYCBPUiBgbWFtbWFsYFxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpLCB7XG4gICAgICogICAgIGZpbHRlclRhZ3M6IFsgXCJiaXJkXCIsIFwibWFtbWFsXCIgXVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCByZXN1bHRzIG9mIGEgcmF5Y2FzdCBiZXR3ZWVuIDAsIDIsIDIgYW5kIDAsIC0yLCAtMlxuICAgICAqIC8vIHdoZXJlIGhpdCBlbnRpdHkgaGFzIGEgYGNhbWVyYWAgY29tcG9uZW50XG4gICAgICogY29uc3QgaGl0cyA9IHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LnJheWNhc3RBbGwobmV3IFZlYzMoMCwgMiwgMiksIG5ldyBWZWMzKDAsIC0yLCAtMiksIHtcbiAgICAgKiAgICAgZmlsdGVyQ2FsbGJhY2s6IChlbnRpdHkpID0+IGVudGl0eSAmJiBlbnRpdHkuY2FtZXJhXG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIHJlc3VsdHMgb2YgYSByYXljYXN0IGJldHdlZW4gMCwgMiwgMiBhbmQgMCwgLTIsIC0yXG4gICAgICogLy8gd2hlcmUgaGl0IGVudGl0eSBpcyB0YWdnZWQgd2l0aCAoYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgKSBPUiAoYGNhcm5pdm9yZWAgQU5EIGByZXB0aWxlYClcbiAgICAgKiAvLyBhbmQgdGhlIGVudGl0eSBoYXMgYW4gYGFuaW1gIGNvbXBvbmVudFxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpLCB7XG4gICAgICogICAgIGZpbHRlclRhZ3M6IFtcbiAgICAgKiAgICAgICAgIFsgXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIiBdLFxuICAgICAqICAgICAgICAgWyBcImNhcm5pdm9yZVwiLCBcInJlcHRpbGVcIiBdXG4gICAgICogICAgIF0sXG4gICAgICogICAgIGZpbHRlckNhbGxiYWNrOiAoZW50aXR5KSA9PiBlbnRpdHkgJiYgZW50aXR5LmFuaW1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICByYXljYXN0QWxsKHN0YXJ0LCBlbmQsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoQW1tby5BbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2ssICdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jcmF5Y2FzdEFsbDogWW91ciB2ZXJzaW9uIG9mIGFtbW8uanMgZG9lcyBub3QgZXhwb3NlIEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrLiBVcGRhdGUgaXQgdG8gbGF0ZXN0LicpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICBhbW1vUmF5U3RhcnQuc2V0VmFsdWUoc3RhcnQueCwgc3RhcnQueSwgc3RhcnQueik7XG4gICAgICAgIGFtbW9SYXlFbmQuc2V0VmFsdWUoZW5kLngsIGVuZC55LCBlbmQueik7XG4gICAgICAgIGNvbnN0IHJheUNhbGxiYWNrID0gbmV3IEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrKGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlckNvbGxpc2lvbkdyb3VwID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgcmF5Q2FsbGJhY2suc2V0X21fY29sbGlzaW9uRmlsdGVyR3JvdXAob3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uTWFzayA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHJheUNhbGxiYWNrLnNldF9tX2NvbGxpc2lvbkZpbHRlck1hc2sob3B0aW9ucy5maWx0ZXJDb2xsaXNpb25NYXNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5yYXlUZXN0KGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCwgcmF5Q2FsbGJhY2spO1xuICAgICAgICBpZiAocmF5Q2FsbGJhY2suaGFzSGl0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbk9ianMgPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3RzKCk7XG4gICAgICAgICAgICBjb25zdCBwb2ludHMgPSByYXlDYWxsYmFjay5nZXRfbV9oaXRQb2ludFdvcmxkKCk7XG4gICAgICAgICAgICBjb25zdCBub3JtYWxzID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0Tm9ybWFsV29ybGQoKTtcbiAgICAgICAgICAgIGNvbnN0IGhpdEZyYWN0aW9ucyA9IHJheUNhbGxiYWNrLmdldF9tX2hpdEZyYWN0aW9ucygpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1IaXRzID0gY29sbGlzaW9uT2Jqcy5zaXplKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUhpdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2Jqcy5hdChpKSwgQW1tby5idFJpZ2lkQm9keSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYm9keSAmJiBib2R5LmVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5maWx0ZXJUYWdzICYmICFib2R5LmVudGl0eS5oYXMoLi4ub3B0aW9ucy5maWx0ZXJUYWdzKSB8fCBvcHRpb25zLmZpbHRlckNhbGxiYWNrICYmICFvcHRpb25zLmZpbHRlckNhbGxiYWNrKGJvZHkuZW50aXR5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHBvaW50cy5hdChpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsID0gbm9ybWFscy5hdChpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmVudGl0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKHBvaW50LngoKSwgcG9pbnQueSgpLCBwb2ludC56KCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBoaXRGcmFjdGlvbnMuYXQoaSlcbiAgICAgICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNvcnQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnNvcnQoKGEsIGIpID0+IGEuaGl0RnJhY3Rpb24gLSBiLmhpdEZyYWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIEFtbW8uZGVzdHJveShyYXlDYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcmVzIGEgY29sbGlzaW9uIGJldHdlZW4gdGhlIGVudGl0eSBhbmQgb3RoZXIgaW4gdGhlIGNvbnRhY3RzIG1hcCBhbmQgcmV0dXJucyB0cnVlIGlmIGl0XG4gICAgICogaXMgYSBuZXcgY29sbGlzaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBvdGhlciAtIFRoZSBlbnRpdHkgdGhhdCBjb2xsaWRlcyB3aXRoIHRoZSBmaXJzdFxuICAgICAqIGVudGl0eS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGlzIGlzIGEgbmV3IGNvbGxpc2lvbiwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3N0b3JlQ29sbGlzaW9uKGVudGl0eSwgb3RoZXIpIHtcbiAgICAgICAgbGV0IGlzTmV3Q29sbGlzaW9uID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGd1aWQgPSBlbnRpdHkuZ2V0R3VpZCgpO1xuXG4gICAgICAgIHRoaXMuY29sbGlzaW9uc1tndWlkXSA9IHRoaXMuY29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG5cbiAgICAgICAgaWYgKHRoaXMuY29sbGlzaW9uc1tndWlkXS5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLnB1c2gob3RoZXIpO1xuICAgICAgICAgICAgaXNOZXdDb2xsaXNpb24gPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0gPSB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXSB8fCB7IG90aGVyczogW10sIGVudGl0eTogZW50aXR5IH07XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdLm90aGVycy5wdXNoKG90aGVyKTtcblxuICAgICAgICByZXR1cm4gaXNOZXdDb2xsaXNpb247XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnQuc2V0KGxvY2FsUG9pbnRBLngoKSwgbG9jYWxQb2ludEEueSgpLCBsb2NhbFBvaW50QS56KCkpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkEueCgpLCBwb3NpdGlvbldvcmxkT25BLnkoKSwgcG9zaXRpb25Xb3JsZE9uQS56KCkpO1xuICAgICAgICBjb250YWN0LnBvaW50T3RoZXIuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QSgpO1xuICAgICAgICBjb25zdCBsb2NhbFBvaW50QiA9IGNvbnRhY3RQb2ludC5nZXRfbV9sb2NhbFBvaW50QigpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25BID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkEoKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25Xb3JsZE9uQiA9IGNvbnRhY3RQb2ludC5nZXRQb3NpdGlvbldvcmxkT25CKCk7XG4gICAgICAgIGNvbnN0IG5vcm1hbFdvcmxkT25CID0gY29udGFjdFBvaW50LmdldF9tX25vcm1hbFdvcmxkT25CKCk7XG5cbiAgICAgICAgY29uc3QgY29udGFjdCA9IHRoaXMuY29udGFjdFBvaW50UG9vbC5hbGxvY2F0ZSgpO1xuICAgICAgICBjb250YWN0LmxvY2FsUG9pbnRPdGhlci5zZXQobG9jYWxQb2ludEEueCgpLCBsb2NhbFBvaW50QS55KCksIGxvY2FsUG9pbnRBLnooKSk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludC5zZXQobG9jYWxQb2ludEIueCgpLCBsb2NhbFBvaW50Qi55KCksIGxvY2FsUG9pbnRCLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnRPdGhlci5zZXQocG9zaXRpb25Xb3JsZE9uQS54KCksIHBvc2l0aW9uV29ybGRPbkEueSgpLCBwb3NpdGlvbldvcmxkT25BLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnQuc2V0KHBvc2l0aW9uV29ybGRPbkIueCgpLCBwb3NpdGlvbldvcmxkT25CLnkoKSwgcG9zaXRpb25Xb3JsZE9uQi56KCkpO1xuICAgICAgICBjb250YWN0Lm5vcm1hbC5zZXQobm9ybWFsV29ybGRPbkIueCgpLCBub3JtYWxXb3JsZE9uQi55KCksIG5vcm1hbFdvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3QuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5nZXRBcHBsaWVkSW1wdWxzZSgpO1xuICAgICAgICByZXR1cm4gY29udGFjdDtcbiAgICB9XG5cbiAgICBfY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChhLCBiLCBjb250YWN0UG9pbnQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5hbGxvY2F0ZSgpO1xuXG4gICAgICAgIHJlc3VsdC5hID0gYTtcbiAgICAgICAgcmVzdWx0LmIgPSBiO1xuICAgICAgICByZXN1bHQubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgcmVzdWx0LmxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmxvY2FsUG9pbnRPdGhlcjtcbiAgICAgICAgcmVzdWx0LnBvaW50QSA9IGNvbnRhY3RQb2ludC5wb2ludDtcbiAgICAgICAgcmVzdWx0LnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICByZXN1bHQubm9ybWFsID0gY29udGFjdFBvaW50Lm5vcm1hbDtcbiAgICAgICAgcmVzdWx0LmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIF9jcmVhdGVDb250YWN0UmVzdWx0KG90aGVyLCBjb250YWN0cykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IG90aGVyO1xuICAgICAgICByZXN1bHQuY29udGFjdHMgPSBjb250YWN0cztcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNvbGxpc2lvbnMgdGhhdCBubyBsb25nZXIgZXhpc3QgZnJvbSB0aGUgY29sbGlzaW9ucyBsaXN0IGFuZCBmaXJlcyBjb2xsaXNpb25lbmRcbiAgICAgKiBldmVudHMgdG8gdGhlIHJlbGF0ZWQgZW50aXRpZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jbGVhbk9sZENvbGxpc2lvbnMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgZ3VpZCBpbiB0aGlzLmNvbGxpc2lvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbGxpc2lvbnMuaGFzT3duUHJvcGVydHkoZ3VpZCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZUNvbGxpc2lvbiA9IHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbiA9IHRoaXMuY29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHkgPSBjb2xsaXNpb24uZW50aXR5O1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eUNvbGxpc2lvbiA9IGVudGl0eS5jb2xsaXNpb247XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5UmlnaWRib2R5ID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlcnMgPSBjb2xsaXNpb24ub3RoZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IG90aGVycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGkgPSBsZW5ndGg7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdGhlciA9IG90aGVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGNvbnRhY3QgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGN1cnJlbnQgZnJhbWUgY29sbGlzaW9ucyB0aGVuIGZpcmUgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcmFtZUNvbGxpc2lvbiB8fCBmcmFtZUNvbGxpc2lvbi5vdGhlcnMuaW5kZXhPZihvdGhlcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBvdGhlcnMgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJzLnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIGEgdHJpZ2dlciBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvbGxpc2lvbi5maXJlKCd0cmlnZ2VybGVhdmUnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvdGhlci5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXIucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJsZWF2ZScsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghb3RoZXIudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN1cHByZXNzIGV2ZW50cyBpZiB0aGUgb3RoZXIgZW50aXR5IGlzIGEgdHJpZ2dlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlSaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5UmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbmVuZCcsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eUNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlDb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uZW5kJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvdGhlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29udGFjdCBldmVudCBhdHRhY2hlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gRW50aXR5IHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGVudGl0eSBoYXMgYSBjb250YWN0IGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGFzQ29udGFjdEV2ZW50KGVudGl0eSkge1xuICAgICAgICBjb25zdCBjID0gZW50aXR5LmNvbGxpc2lvbjtcbiAgICAgICAgaWYgKGMgJiYgKGMuaGFzRXZlbnQoJ2NvbGxpc2lvbnN0YXJ0JykgfHwgYy5oYXNFdmVudCgnY29sbGlzaW9uZW5kJykgfHwgYy5oYXNFdmVudCgnY29udGFjdCcpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByID0gZW50aXR5LnJpZ2lkYm9keTtcbiAgICAgICAgcmV0dXJuIHIgJiYgKHIuaGFzRXZlbnQoJ2NvbGxpc2lvbnN0YXJ0JykgfHwgci5oYXNFdmVudCgnY29sbGlzaW9uZW5kJykgfHwgci5oYXNFdmVudCgnY29udGFjdCcpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgZm9yIGNvbGxpc2lvbnMgYW5kIGZpcmVzIGNvbGxpc2lvbiBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd29ybGQgLSBUaGUgcG9pbnRlciB0byB0aGUgZHluYW1pY3Mgd29ybGQgdGhhdCBpbnZva2VkIHRoaXMgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRpbWVTdGVwIC0gVGhlIGFtb3VudCBvZiBzaW11bGF0aW9uIHRpbWUgcHJvY2Vzc2VkIGluIHRoZSBsYXN0IHNpbXVsYXRpb24gdGljay5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jaGVja0ZvckNvbGxpc2lvbnMod29ybGQsIHRpbWVTdGVwKSB7XG4gICAgICAgIGNvbnN0IGR5bmFtaWNzV29ybGQgPSBBbW1vLndyYXBQb2ludGVyKHdvcmxkLCBBbW1vLmJ0RHluYW1pY3NXb3JsZCk7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIGNvbGxpc2lvbnMgYW5kIGZpcmUgY2FsbGJhY2tzXG4gICAgICAgIGNvbnN0IGRpc3BhdGNoZXIgPSBkeW5hbWljc1dvcmxkLmdldERpc3BhdGNoZXIoKTtcbiAgICAgICAgY29uc3QgbnVtTWFuaWZvbGRzID0gZGlzcGF0Y2hlci5nZXROdW1NYW5pZm9sZHMoKTtcblxuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9ucyA9IHt9O1xuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgYWxsIGNvbnRhY3RzIGFuZCBmaXJlIGV2ZW50c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU1hbmlmb2xkczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYW5pZm9sZCA9IGRpc3BhdGNoZXIuZ2V0TWFuaWZvbGRCeUluZGV4SW50ZXJuYWwoaSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJvZHkwID0gbWFuaWZvbGQuZ2V0Qm9keTAoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkxID0gbWFuaWZvbGQuZ2V0Qm9keTEoKTtcblxuICAgICAgICAgICAgY29uc3Qgd2IwID0gQW1tby5jYXN0T2JqZWN0KGJvZHkwLCBBbW1vLmJ0UmlnaWRCb2R5KTtcbiAgICAgICAgICAgIGNvbnN0IHdiMSA9IEFtbW8uY2FzdE9iamVjdChib2R5MSwgQW1tby5idFJpZ2lkQm9keSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGUwID0gd2IwLmVudGl0eTtcbiAgICAgICAgICAgIGNvbnN0IGUxID0gd2IxLmVudGl0eTtcblxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgZW50aXR5IGlzIG51bGwgLSBUT0RPOiBpbnZlc3RpZ2F0ZSB3aGVuIHRoaXMgaGFwcGVuc1xuICAgICAgICAgICAgaWYgKCFlMCB8fCAhZTEpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmxhZ3MwID0gd2IwLmdldENvbGxpc2lvbkZsYWdzKCk7XG4gICAgICAgICAgICBjb25zdCBmbGFnczEgPSB3YjEuZ2V0Q29sbGlzaW9uRmxhZ3MoKTtcblxuICAgICAgICAgICAgY29uc3QgbnVtQ29udGFjdHMgPSBtYW5pZm9sZC5nZXROdW1Db250YWN0cygpO1xuICAgICAgICAgICAgY29uc3QgZm9yd2FyZENvbnRhY3RzID0gW107XG4gICAgICAgICAgICBjb25zdCByZXZlcnNlQ29udGFjdHMgPSBbXTtcbiAgICAgICAgICAgIGxldCBuZXdDb2xsaXNpb247XG5cbiAgICAgICAgICAgIGlmIChudW1Db250YWN0cyA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBmaXJlIGNvbnRhY3QgZXZlbnRzIGZvciB0cmlnZ2Vyc1xuICAgICAgICAgICAgICAgIGlmICgoZmxhZ3MwICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpIHx8XG4gICAgICAgICAgICAgICAgICAgIChmbGFnczEgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEV2ZW50cyA9IGUwLmNvbGxpc2lvbiAmJiAoZTAuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMC5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFFdmVudHMgPSBlMS5jb2xsaXNpb24gJiYgKGUxLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTEuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwQm9keUV2ZW50cyA9IGUwLnJpZ2lkYm9keSAmJiAoZTAucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMC5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFCb2R5RXZlbnRzID0gZTEucmlnaWRib2R5ICYmIChlMS5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUxLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgdHJpZ2dlcmVudGVyIGV2ZW50cyBmb3IgdHJpZ2dlcnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbiAmJiAhKGZsYWdzMSAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLmNvbGxpc2lvbi5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uICYmICEoZmxhZ3MwICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEuY29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgdHJpZ2dlcmVudGVyIGV2ZW50cyBmb3IgcmlnaWRib2RpZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUwQm9keUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMUJvZHlFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLnJpZ2lkYm9keS5maXJlKCd0cmlnZ2VyZW50ZXInLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMEV2ZW50cyA9IHRoaXMuX2hhc0NvbnRhY3RFdmVudChlMCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUxRXZlbnRzID0gdGhpcy5faGFzQ29udGFjdEV2ZW50KGUxKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2xvYmFsRXZlbnRzID0gdGhpcy5oYXNFdmVudCgnY29udGFjdCcpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbG9iYWxFdmVudHMgfHwgZTBFdmVudHMgfHwgZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtQ29udGFjdHM7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ0Q29udGFjdFBvaW50ID0gbWFuaWZvbGQuZ2V0Q29udGFjdFBvaW50KGopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhY3RQb2ludCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RQb2ludEZyb21BbW1vKGJ0Q29udGFjdFBvaW50KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMEV2ZW50cyB8fCBlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3J3YXJkQ29udGFjdHMucHVzaChjb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXZlcnNlQ29udGFjdFBvaW50ID0gdGhpcy5fY3JlYXRlUmV2ZXJzZUNvbnRhY3RQb2ludEZyb21BbW1vKGJ0Q29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV2ZXJzZUNvbnRhY3RzLnB1c2gocmV2ZXJzZUNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdsb2JhbEV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmaXJlIGdsb2JhbCBjb250YWN0IGV2ZW50IGZvciBldmVyeSBjb250YWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2NyZWF0ZVNpbmdsZUNvbnRhY3RSZXN1bHQoZTAsIGUxLCBjb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2NvbnRhY3QnLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9yd2FyZFJlc3VsdCA9IHRoaXMuX2NyZWF0ZUNvbnRhY3RSZXN1bHQoZTEsIGZvcndhcmRDb250YWN0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTAsIGUxKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMC5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ2NvbnRhY3QnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTAucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCdjb250YWN0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUwLnJpZ2lkYm9keS5maXJlKCdjb2xsaXNpb25zdGFydCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTFFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXZlcnNlUmVzdWx0ID0gdGhpcy5fY3JlYXRlQ29udGFjdFJlc3VsdChlMCwgcmV2ZXJzZUNvbnRhY3RzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMSwgZTApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxLmNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgnY29udGFjdCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uc3RhcnQnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ2NvbnRhY3QnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaGVjayBmb3IgY29sbGlzaW9ucyB0aGF0IG5vIGxvbmdlciBleGlzdCBhbmQgZmlyZSBldmVudHNcbiAgICAgICAgdGhpcy5fY2xlYW5PbGRDb2xsaXNpb25zKCk7XG5cbiAgICAgICAgLy8gUmVzZXQgY29udGFjdCBwb29sc1xuICAgICAgICB0aGlzLmNvbnRhY3RQb2ludFBvb2wuZnJlZUFsbCgpO1xuICAgICAgICB0aGlzLmNvbnRhY3RSZXN1bHRQb29sLmZyZWVBbGwoKTtcbiAgICAgICAgdGhpcy5zaW5nbGVDb250YWN0UmVzdWx0UG9vbC5mcmVlQWxsKCk7XG4gICAgfVxuXG4gICAgb25VcGRhdGUoZHQpIHtcbiAgICAgICAgbGV0IGksIGxlbjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnBoeXNpY3NTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBkb3duY2FzdCBncmF2aXR5IHRvIGZsb2F0MzIgc28gd2UgY2FuIGFjY3VyYXRlbHkgY29tcGFyZSB3aXRoIGV4aXN0aW5nXG4gICAgICAgIC8vIGdyYXZpdHkgc2V0IGluIGFtbW8uXG4gICAgICAgIHRoaXMuX2dyYXZpdHlGbG9hdDMyWzBdID0gdGhpcy5ncmF2aXR5Lng7XG4gICAgICAgIHRoaXMuX2dyYXZpdHlGbG9hdDMyWzFdID0gdGhpcy5ncmF2aXR5Lnk7XG4gICAgICAgIHRoaXMuX2dyYXZpdHlGbG9hdDMyWzJdID0gdGhpcy5ncmF2aXR5Lno7XG5cbiAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIHdoZXRoZXIgd2UgbmVlZCB0byB1cGRhdGUgZ3Jhdml0eSBvbiB0aGUgZHluYW1pY3Mgd29ybGRcbiAgICAgICAgY29uc3QgZ3Jhdml0eSA9IHRoaXMuZHluYW1pY3NXb3JsZC5nZXRHcmF2aXR5KCk7XG4gICAgICAgIGlmIChncmF2aXR5LngoKSAhPT0gdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMF0gfHxcbiAgICAgICAgICAgIGdyYXZpdHkueSgpICE9PSB0aGlzLl9ncmF2aXR5RmxvYXQzMlsxXSB8fFxuICAgICAgICAgICAgZ3Jhdml0eS56KCkgIT09IHRoaXMuX2dyYXZpdHlGbG9hdDMyWzJdKSB7XG4gICAgICAgICAgICBncmF2aXR5LnNldFZhbHVlKHRoaXMuZ3Jhdml0eS54LCB0aGlzLmdyYXZpdHkueSwgdGhpcy5ncmF2aXR5LnopO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLnNldEdyYXZpdHkoZ3Jhdml0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0cmlnZ2VycyA9IHRoaXMuX3RyaWdnZXJzO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSB0cmlnZ2Vycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdHJpZ2dlcnNbaV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb21wb3VuZHMgPSB0aGlzLl9jb21wb3VuZHM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGNvbXBvdW5kcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29tcG91bmRzW2ldLl91cGRhdGVDb21wb3VuZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBraW5lbWF0aWMgYm9kaWVzIGJhc2VkIG9uIHRoZWlyIGN1cnJlbnQgZW50aXR5IHRyYW5zZm9ybVxuICAgICAgICBjb25zdCBraW5lbWF0aWMgPSB0aGlzLl9raW5lbWF0aWM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IGtpbmVtYXRpYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAga2luZW1hdGljW2ldLl91cGRhdGVLaW5lbWF0aWMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgdGhlIHBoeXNpY3Mgc2ltdWxhdGlvblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc3RlcFNpbXVsYXRpb24oZHQsIHRoaXMubWF4U3ViU3RlcHMsIHRoaXMuZml4ZWRUaW1lU3RlcCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSB0cmFuc2Zvcm1zIG9mIGFsbCBlbnRpdGllcyByZWZlcmVuY2luZyBhIGR5bmFtaWMgYm9keVxuICAgICAgICBjb25zdCBkeW5hbWljID0gdGhpcy5fZHluYW1pYztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gZHluYW1pYy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgZHluYW1pY1tpXS5fdXBkYXRlRHluYW1pYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9jaGVja0ZvckNvbGxpc2lvbnMoQW1tby5nZXRQb2ludGVyKHRoaXMuZHluYW1pY3NXb3JsZCksIGR0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnBoeXNpY3NUaW1lID0gbm93KCkgLSB0aGlzLl9zdGF0cy5waHlzaWNzU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLmFwcC5zeXN0ZW1zLm9mZigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuZHluYW1pY3NXb3JsZCk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5zb2x2ZXIpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuZGlzcGF0Y2hlcik7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLm92ZXJsYXBwaW5nUGFpckNhY2hlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKFJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUsIF9zY2hlbWEpO1xuXG5leHBvcnQgeyBDb250YWN0UG9pbnQsIENvbnRhY3RSZXN1bHQsIFJheWNhc3RSZXN1bHQsIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSwgU2luZ2xlQ29udGFjdFJlc3VsdCB9O1xuIl0sIm5hbWVzIjpbImFtbW9SYXlTdGFydCIsImFtbW9SYXlFbmQiLCJSYXljYXN0UmVzdWx0IiwiY29uc3RydWN0b3IiLCJlbnRpdHkiLCJwb2ludCIsIm5vcm1hbCIsImhpdEZyYWN0aW9uIiwiU2luZ2xlQ29udGFjdFJlc3VsdCIsImEiLCJiIiwiY29udGFjdFBvaW50IiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiaW1wdWxzZSIsImxvY2FsUG9pbnRBIiwiVmVjMyIsImxvY2FsUG9pbnRCIiwicG9pbnRBIiwicG9pbnRCIiwibG9jYWxQb2ludCIsImxvY2FsUG9pbnRPdGhlciIsInBvaW50T3RoZXIiLCJDb250YWN0UG9pbnQiLCJDb250YWN0UmVzdWx0Iiwib3RoZXIiLCJjb250YWN0cyIsIl9zY2hlbWEiLCJSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJhcHAiLCJtYXhTdWJTdGVwcyIsImZpeGVkVGltZVN0ZXAiLCJncmF2aXR5IiwiX2dyYXZpdHlGbG9hdDMyIiwiRmxvYXQzMkFycmF5IiwiX2R5bmFtaWMiLCJfa2luZW1hdGljIiwiX3RyaWdnZXJzIiwiX2NvbXBvdW5kcyIsImlkIiwiX3N0YXRzIiwic3RhdHMiLCJmcmFtZSIsIkNvbXBvbmVudFR5cGUiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJEYXRhVHlwZSIsIlJpZ2lkQm9keUNvbXBvbmVudERhdGEiLCJjb250YWN0UG9pbnRQb29sIiwiY29udGFjdFJlc3VsdFBvb2wiLCJzaW5nbGVDb250YWN0UmVzdWx0UG9vbCIsInNjaGVtYSIsImNvbGxpc2lvbnMiLCJmcmFtZUNvbGxpc2lvbnMiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwib25SZW1vdmUiLCJvbkxpYnJhcnlMb2FkZWQiLCJBbW1vIiwiY29sbGlzaW9uQ29uZmlndXJhdGlvbiIsImJ0RGVmYXVsdENvbGxpc2lvbkNvbmZpZ3VyYXRpb24iLCJkaXNwYXRjaGVyIiwiYnRDb2xsaXNpb25EaXNwYXRjaGVyIiwib3ZlcmxhcHBpbmdQYWlyQ2FjaGUiLCJidERidnRCcm9hZHBoYXNlIiwic29sdmVyIiwiYnRTZXF1ZW50aWFsSW1wdWxzZUNvbnN0cmFpbnRTb2x2ZXIiLCJkeW5hbWljc1dvcmxkIiwiYnREaXNjcmV0ZUR5bmFtaWNzV29ybGQiLCJzZXRJbnRlcm5hbFRpY2tDYWxsYmFjayIsImNoZWNrRm9yQ29sbGlzaW9uc1BvaW50ZXIiLCJhZGRGdW5jdGlvbiIsIl9jaGVja0ZvckNvbGxpc2lvbnMiLCJiaW5kIiwiRGVidWciLCJ3YXJuIiwiYnRWZWN0b3IzIiwiT2JqZWN0UG9vbCIsInN5c3RlbXMiLCJvblVwZGF0ZSIsIm9mZiIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJwcm9wcyIsInByb3BlcnR5IiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsIkFycmF5IiwiaXNBcnJheSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJyaWdpZGJvZHkiLCJlbmFibGVkIiwibWFzcyIsImxpbmVhckRhbXBpbmciLCJhbmd1bGFyRGFtcGluZyIsImxpbmVhckZhY3RvciIsIngiLCJ5IiwieiIsImFuZ3VsYXJGYWN0b3IiLCJmcmljdGlvbiIsInJvbGxpbmdGcmljdGlvbiIsInJlc3RpdHV0aW9uIiwidHlwZSIsImdyb3VwIiwibWFzayIsImFkZENvbXBvbmVudCIsImJvZHkiLCJyZW1vdmVCb2R5IiwiZGVzdHJveUJvZHkiLCJhZGRCb2R5IiwidW5kZWZpbmVkIiwiYWRkUmlnaWRCb2R5IiwicmVtb3ZlUmlnaWRCb2R5IiwiY3JlYXRlQm9keSIsInNoYXBlIiwidHJhbnNmb3JtIiwibG9jYWxJbmVydGlhIiwiY2FsY3VsYXRlTG9jYWxJbmVydGlhIiwibW90aW9uU3RhdGUiLCJidERlZmF1bHRNb3Rpb25TdGF0ZSIsImJvZHlJbmZvIiwiYnRSaWdpZEJvZHlDb25zdHJ1Y3Rpb25JbmZvIiwiYnRSaWdpZEJvZHkiLCJkZXN0cm95IiwiZ2V0TW90aW9uU3RhdGUiLCJyYXljYXN0Rmlyc3QiLCJzdGFydCIsImVuZCIsIm9wdGlvbnMiLCJmaWx0ZXJUYWdzIiwiZmlsdGVyQ2FsbGJhY2siLCJzb3J0IiwicmF5Y2FzdEFsbCIsInJlc3VsdCIsInNldFZhbHVlIiwicmF5Q2FsbGJhY2siLCJDbG9zZXN0UmF5UmVzdWx0Q2FsbGJhY2siLCJmaWx0ZXJDb2xsaXNpb25Hcm91cCIsInNldF9tX2NvbGxpc2lvbkZpbHRlckdyb3VwIiwiZmlsdGVyQ29sbGlzaW9uTWFzayIsInNldF9tX2NvbGxpc2lvbkZpbHRlck1hc2siLCJyYXlUZXN0IiwiaGFzSGl0IiwiY29sbGlzaW9uT2JqIiwiZ2V0X21fY29sbGlzaW9uT2JqZWN0IiwiY2FzdE9iamVjdCIsImdldF9tX2hpdFBvaW50V29ybGQiLCJnZXRfbV9oaXROb3JtYWxXb3JsZCIsImdldF9tX2Nsb3Nlc3RIaXRGcmFjdGlvbiIsImRlcHJlY2F0ZWQiLCJjYWxsYmFjayIsImFzc2VydCIsIkFsbEhpdHNSYXlSZXN1bHRDYWxsYmFjayIsInJlc3VsdHMiLCJjb2xsaXNpb25PYmpzIiwiZ2V0X21fY29sbGlzaW9uT2JqZWN0cyIsInBvaW50cyIsIm5vcm1hbHMiLCJoaXRGcmFjdGlvbnMiLCJnZXRfbV9oaXRGcmFjdGlvbnMiLCJudW1IaXRzIiwic2l6ZSIsImkiLCJhdCIsImhhcyIsInB1c2giLCJfc3RvcmVDb2xsaXNpb24iLCJpc05ld0NvbGxpc2lvbiIsImd1aWQiLCJnZXRHdWlkIiwib3RoZXJzIiwiaW5kZXhPZiIsIl9jcmVhdGVDb250YWN0UG9pbnRGcm9tQW1tbyIsImdldF9tX2xvY2FsUG9pbnRBIiwiZ2V0X21fbG9jYWxQb2ludEIiLCJwb3NpdGlvbldvcmxkT25BIiwiZ2V0UG9zaXRpb25Xb3JsZE9uQSIsInBvc2l0aW9uV29ybGRPbkIiLCJnZXRQb3NpdGlvbldvcmxkT25CIiwibm9ybWFsV29ybGRPbkIiLCJnZXRfbV9ub3JtYWxXb3JsZE9uQiIsImNvbnRhY3QiLCJhbGxvY2F0ZSIsInNldCIsImdldEFwcGxpZWRJbXB1bHNlIiwiX2NyZWF0ZVJldmVyc2VDb250YWN0UG9pbnRGcm9tQW1tbyIsIl9jcmVhdGVTaW5nbGVDb250YWN0UmVzdWx0IiwiX2NyZWF0ZUNvbnRhY3RSZXN1bHQiLCJfY2xlYW5PbGRDb2xsaXNpb25zIiwiZnJhbWVDb2xsaXNpb24iLCJjb2xsaXNpb24iLCJlbnRpdHlDb2xsaXNpb24iLCJlbnRpdHlSaWdpZGJvZHkiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiZmlyZSIsIl9oYXNDb250YWN0RXZlbnQiLCJjIiwiaGFzRXZlbnQiLCJyIiwid29ybGQiLCJ0aW1lU3RlcCIsIndyYXBQb2ludGVyIiwiYnREeW5hbWljc1dvcmxkIiwiZ2V0RGlzcGF0Y2hlciIsIm51bU1hbmlmb2xkcyIsImdldE51bU1hbmlmb2xkcyIsIm1hbmlmb2xkIiwiZ2V0TWFuaWZvbGRCeUluZGV4SW50ZXJuYWwiLCJib2R5MCIsImdldEJvZHkwIiwiYm9keTEiLCJnZXRCb2R5MSIsIndiMCIsIndiMSIsImUwIiwiZTEiLCJmbGFnczAiLCJnZXRDb2xsaXNpb25GbGFncyIsImZsYWdzMSIsIm51bUNvbnRhY3RzIiwiZ2V0TnVtQ29udGFjdHMiLCJmb3J3YXJkQ29udGFjdHMiLCJyZXZlcnNlQ29udGFjdHMiLCJuZXdDb2xsaXNpb24iLCJCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCIsImUwRXZlbnRzIiwiZTFFdmVudHMiLCJlMEJvZHlFdmVudHMiLCJlMUJvZHlFdmVudHMiLCJnbG9iYWxFdmVudHMiLCJqIiwiYnRDb250YWN0UG9pbnQiLCJnZXRDb250YWN0UG9pbnQiLCJyZXZlcnNlQ29udGFjdFBvaW50IiwiZm9yd2FyZFJlc3VsdCIsInJldmVyc2VSZXN1bHQiLCJmcmVlQWxsIiwiZHQiLCJsZW4iLCJwaHlzaWNzU3RhcnQiLCJub3ciLCJnZXRHcmF2aXR5Iiwic2V0R3Jhdml0eSIsInRyaWdnZXJzIiwidXBkYXRlVHJhbnNmb3JtIiwiY29tcG91bmRzIiwiX3VwZGF0ZUNvbXBvdW5kIiwia2luZW1hdGljIiwiX3VwZGF0ZUtpbmVtYXRpYyIsInN0ZXBTaW11bGF0aW9uIiwiZHluYW1pYyIsIl91cGRhdGVEeW5hbWljIiwiZ2V0UG9pbnRlciIsInBoeXNpY3NUaW1lIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFhQSxJQUFJQSxZQUFZLEVBQUVDLFVBQVUsQ0FBQTs7QUFFNUI7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsYUFBYSxDQUFDO0FBQ2hCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsV0FBVyxFQUFFO0FBQzVDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNILE1BQU0sR0FBR0EsTUFBTSxDQUFBOztBQUVwQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxLQUFLLEdB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
