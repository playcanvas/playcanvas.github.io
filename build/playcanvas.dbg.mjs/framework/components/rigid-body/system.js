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
          if (options.filterTags && !body.entity.tags.has(...options.filterTags) || options.filterCallback && !options.filterCallback(body.entity)) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuLi8uLi8uLi9jb3JlL29iamVjdC1wb29sLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG5sZXQgYW1tb1JheVN0YXJ0LCBhbW1vUmF5RW5kO1xuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBzdWNjZXNzZnVsIHJheWNhc3QgaGl0LlxuICovXG5jbGFzcyBSYXljYXN0UmVzdWx0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmF5Y2FzdFJlc3VsdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcG9pbnQgYXQgd2hpY2ggdGhlIHJheSBoaXQgdGhlIGVudGl0eSBpbiB3b3JsZCBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG5vcm1hbCAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBzdXJmYWNlIHdoZXJlIHRoZSByYXkgaGl0IGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoaXRGcmFjdGlvbiAtIFRoZSBub3JtYWxpemVkIGRpc3RhbmNlIChiZXR3ZWVuIDAgYW5kIDEpIGF0IHdoaWNoIHRoZSByYXkgaGl0XG4gICAgICogb2NjdXJyZWQgZnJvbSB0aGUgc3RhcnRpbmcgcG9pbnQuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgcG9pbnQsIG5vcm1hbCwgaGl0RnJhY3Rpb24pIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaGl0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IGF0IHdoaWNoIHRoZSByYXkgaGl0IHRoZSBlbnRpdHkgaW4gd29ybGQgc3BhY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wb2ludCA9IHBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbm9ybWFsIHZlY3RvciBvZiB0aGUgc3VyZmFjZSB3aGVyZSB0aGUgcmF5IGhpdCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5vcm1hbGl6ZWQgZGlzdGFuY2UgKGJldHdlZW4gMCBhbmQgMSkgYXQgd2hpY2ggdGhlIHJheSBoaXQgb2NjdXJyZWQgZnJvbSB0aGVcbiAgICAgICAgICogc3RhcnRpbmcgcG9pbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmhpdEZyYWN0aW9uID0gaGl0RnJhY3Rpb247XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAqL1xuY2xhc3MgU2luZ2xlQ29udGFjdFJlc3VsdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNpbmdsZUNvbnRhY3RSZXN1bHQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBhIC0gVGhlIGZpcnN0IGVudGl0eSBpbnZvbHZlZCBpbiB0aGUgY29udGFjdC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBiIC0gVGhlIHNlY29uZCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICogQHBhcmFtIHtDb250YWN0UG9pbnR9IGNvbnRhY3RQb2ludCAtIFRoZSBjb250YWN0IHBvaW50IGJldHdlZW4gdGhlIHR3byBlbnRpdGllcy5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYSwgYiwgY29udGFjdFBvaW50KSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBmaXJzdCBlbnRpdHkgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3QuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmEgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBzZWNvbmQgZW50aXR5IGludm9sdmVkIGluIHRoZSBjb250YWN0LlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5iID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3RcbiAgICAgICAgICAgICAqIHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIGJvZGllcyBjb2xsaWRlZC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmltcHVsc2UgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBwb2ludCBvbiBFbnRpdHkgQSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gQS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvaW50QSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBCIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0byBCLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9pbnRCID0gbmV3IFZlYzMoKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgcG9pbnQgb24gRW50aXR5IEEgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnBvaW50QSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHBvaW50IG9uIEVudGl0eSBCIHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5wb2ludEIgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIEVudGl0eSBCLCBpbiB3b3JsZCBzcGFjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5ub3JtYWwgPSBuZXcgVmVjMygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hID0gYTtcbiAgICAgICAgICAgIHRoaXMuYiA9IGI7XG4gICAgICAgICAgICB0aGlzLmltcHVsc2UgPSBjb250YWN0UG9pbnQuaW1wdWxzZTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEEgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludDtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludE90aGVyO1xuICAgICAgICAgICAgdGhpcy5wb2ludEEgPSBjb250YWN0UG9pbnQucG9pbnQ7XG4gICAgICAgICAgICB0aGlzLnBvaW50QiA9IGNvbnRhY3RQb2ludC5wb2ludE90aGVyO1xuICAgICAgICAgICAgdGhpcy5ub3JtYWwgPSBjb250YWN0UG9pbnQubm9ybWFsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIE9iamVjdCBob2xkaW5nIHRoZSByZXN1bHQgb2YgYSBjb250YWN0IGJldHdlZW4gdHdvIEVudGl0aWVzLlxuICovXG5jbGFzcyBDb250YWN0UG9pbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UG9pbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtsb2NhbFBvaW50XSAtIFRoZSBwb2ludCBvbiB0aGUgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLCByZWxhdGl2ZSB0b1xuICAgICAqIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbG9jYWxQb2ludE90aGVyXSAtIFRoZSBwb2ludCBvbiB0aGUgb3RoZXIgZW50aXR5IHdoZXJlIHRoZSBjb250YWN0IG9jY3VycmVkLFxuICAgICAqIHJlbGF0aXZlIHRvIHRoZSBvdGhlciBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50T3RoZXJdIC0gVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluXG4gICAgICogd29ybGQgc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbbm9ybWFsXSAtIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkXG4gICAgICogc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbXB1bHNlXSAtIFRoZSB0b3RhbCBhY2N1bXVsYXRlZCBpbXB1bHNlIGFwcGxpZWQgYnkgdGhlIGNvbnN0cmFpbnQgc29sdmVyXG4gICAgICogZHVyaW5nIHRoZSBsYXN0IHN1Yi1zdGVwLiBEZXNjcmliZXMgaG93IGhhcmQgdHdvIG9iamVjdHMgY29sbGlkZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9jYWxQb2ludCA9IG5ldyBWZWMzKCksIGxvY2FsUG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIHBvaW50ID0gbmV3IFZlYzMoKSwgcG9pbnRPdGhlciA9IG5ldyBWZWMzKCksIG5vcm1hbCA9IG5ldyBWZWMzKCksIGltcHVsc2UgPSAwKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnQgPSBsb2NhbFBvaW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcG9pbnQgb24gdGhlIG90aGVyIGVudGl0eSB3aGVyZSB0aGUgY29udGFjdCBvY2N1cnJlZCwgcmVsYXRpdmUgdG8gdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvY2FsUG9pbnRPdGhlciA9IGxvY2FsUG9pbnRPdGhlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnQgPSBwb2ludDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHBvaW50IG9uIHRoZSBvdGhlciBlbnRpdHkgd2hlcmUgdGhlIGNvbnRhY3Qgb2NjdXJyZWQsIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9pbnRPdGhlciA9IHBvaW50T3RoZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBub3JtYWwgdmVjdG9yIG9mIHRoZSBjb250YWN0IG9uIHRoZSBvdGhlciBlbnRpdHksIGluIHdvcmxkIHNwYWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9ybWFsID0gbm9ybWFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgYWNjdW11bGF0ZWQgaW1wdWxzZSBhcHBsaWVkIGJ5IHRoZSBjb25zdHJhaW50IHNvbHZlciBkdXJpbmcgdGhlIGxhc3Qgc3ViLXN0ZXAuXG4gICAgICAgICAqIERlc2NyaWJlcyBob3cgaGFyZCB0d28gb2JqZWN0cyBjb2xsaWRlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbXB1bHNlID0gaW1wdWxzZTtcbiAgICB9XG59XG5cbi8qKlxuICogT2JqZWN0IGhvbGRpbmcgdGhlIHJlc3VsdCBvZiBhIGNvbnRhY3QgYmV0d2VlbiB0d28gRW50aXRpZXMuXG4gKi9cbmNsYXNzIENvbnRhY3RSZXN1bHQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBDb250YWN0UmVzdWx0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUgZW50aXR5IHRoYXQgd2FzIGludm9sdmVkIGluIHRoZVxuICAgICAqIGNvbnRhY3Qgd2l0aCB0aGlzIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge0NvbnRhY3RQb2ludFtdfSBjb250YWN0cyAtIEFuIGFycmF5IG9mIENvbnRhY3RQb2ludHMgd2l0aCB0aGUgb3RoZXIgZW50aXR5LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihvdGhlciwgY29udGFjdHMpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgdGhhdCB3YXMgaW52b2x2ZWQgaW4gdGhlIGNvbnRhY3Qgd2l0aCB0aGlzIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vdGhlciA9IG90aGVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbiBhcnJheSBvZiBDb250YWN0UG9pbnRzIHdpdGggdGhlIG90aGVyIGVudGl0eS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbnRhY3RQb2ludFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb250YWN0cyA9IGNvbnRhY3RzO1xuICAgIH1cbn1cblxuY29uc3QgX3NjaGVtYSA9IFsnZW5hYmxlZCddO1xuXG4vKipcbiAqIFRoZSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gbWFpbnRhaW5zIHRoZSBkeW5hbWljcyB3b3JsZCBmb3Igc2ltdWxhdGluZyByaWdpZCBib2RpZXMsIGl0IGFsc29cbiAqIGNvbnRyb2xzIGdsb2JhbCB2YWx1ZXMgZm9yIHRoZSB3b3JsZCBzdWNoIGFzIGdyYXZpdHkuIE5vdGU6IFRoZSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gaXMgb25seVxuICogdmFsaWQgaWYgM0QgUGh5c2ljcyBpcyBlbmFibGVkIGluIHlvdXIgYXBwbGljYXRpb24uIFlvdSBjYW4gZW5hYmxlIHRoaXMgaW4gdGhlIGFwcGxpY2F0aW9uXG4gKiBzZXR0aW5ncyBmb3IgeW91ciBwcm9qZWN0LlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtYXhTdWJTdGVwcyA9IDEwO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZml4ZWRUaW1lU3RlcCA9IDEgLyA2MDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbCBncmF2aXR5IGluIHRoZSBwaHlzaWNzIHNpbXVsYXRpb24uIERlZmF1bHRzIHRvXG4gICAgICogWzAsIC05LjgxLCAwXSB3aGljaCBpcyBhbiBhcHByb3hpbWF0aW9uIG9mIHRoZSBncmF2aXRhdGlvbmFsIGZvcmNlIG9uIEVhcnRoLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgZ3Jhdml0eSA9IG5ldyBWZWMzKDAsIC05LjgxLCAwKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ3Jhdml0eUZsb2F0MzIgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2R5bmFtaWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9raW5lbWF0aWMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSaWdpZEJvZHlDb21wb25lbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90cmlnZ2VycyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1JpZ2lkQm9keUNvbXBvbmVudFtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBvdW5kcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdyaWdpZGJvZHknO1xuICAgICAgICB0aGlzLl9zdGF0cyA9IGFwcC5zdGF0cy5mcmFtZTtcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBSaWdpZEJvZHlDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbCA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBudWxsO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zID0ge307XG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5vbignYmVmb3JlcmVtb3ZlJywgdGhpcy5vbkJlZm9yZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBjb250YWN0IG9jY3VycyBiZXR3ZWVuIHR3byByaWdpZCBib2RpZXMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2NvbnRhY3RcbiAgICAgKiBAcGFyYW0ge1NpbmdsZUNvbnRhY3RSZXN1bHR9IHJlc3VsdCAtIERldGFpbHMgb2YgdGhlIGNvbnRhY3QgYmV0d2VlbiB0aGUgdHdvIGJvZGllcy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBvbmNlIEFtbW8gaGFzIGJlZW4gbG9hZGVkLiBSZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgdGhlIHBoeXNpY3Mgd29ybGQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgb25MaWJyYXJ5TG9hZGVkKCkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIEFtbW8gcGh5c2ljcyB3b3JsZFxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24gPSBuZXcgQW1tby5idERlZmF1bHRDb2xsaXNpb25Db25maWd1cmF0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoZXIgPSBuZXcgQW1tby5idENvbGxpc2lvbkRpc3BhdGNoZXIodGhpcy5jb2xsaXNpb25Db25maWd1cmF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBuZXcgQW1tby5idERidnRCcm9hZHBoYXNlKCk7XG4gICAgICAgICAgICB0aGlzLnNvbHZlciA9IG5ldyBBbW1vLmJ0U2VxdWVudGlhbEltcHVsc2VDb25zdHJhaW50U29sdmVyKCk7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQgPSBuZXcgQW1tby5idERpc2NyZXRlRHluYW1pY3NXb3JsZCh0aGlzLmRpc3BhdGNoZXIsIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUsIHRoaXMuc29sdmVyLCB0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5keW5hbWljc1dvcmxkLnNldEludGVybmFsVGlja0NhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlciA9IEFtbW8uYWRkRnVuY3Rpb24odGhpcy5fY2hlY2tGb3JDb2xsaXNpb25zLmJpbmQodGhpcyksICd2aWYnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0SW50ZXJuYWxUaWNrQ2FsbGJhY2soY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ1dBUk5JTkc6IFRoaXMgdmVyc2lvbiBvZiBhbW1vLmpzIGNhbiBwb3RlbnRpYWxseSBmYWlsIHRvIHJlcG9ydCBjb250YWN0cy4gUGxlYXNlIHVwZGF0ZSBpdCB0byB0aGUgbGF0ZXN0IHZlcnNpb24uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExhemlseSBjcmVhdGUgdGVtcCB2YXJzXG4gICAgICAgICAgICBhbW1vUmF5U3RhcnQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGFtbW9SYXlFbmQgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIFJpZ2lkQm9keUNvbXBvbmVudC5vbkxpYnJhcnlMb2FkZWQoKTtcblxuICAgICAgICAgICAgdGhpcy5jb250YWN0UG9pbnRQb29sID0gbmV3IE9iamVjdFBvb2woQ29udGFjdFBvaW50LCAxKTtcbiAgICAgICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChDb250YWN0UmVzdWx0LCAxKTtcbiAgICAgICAgICAgIHRoaXMuc2luZ2xlQ29udGFjdFJlc3VsdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChTaW5nbGVDb250YWN0UmVzdWx0LCAxKTtcblxuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBVbmJpbmQgdGhlIHVwZGF0ZSBmdW5jdGlvbiBpZiB3ZSBoYXZlbid0IGxvYWRlZCBBbW1vIGJ5IG5vd1xuICAgICAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vZmYoJ3VwZGF0ZScsIHRoaXMub25VcGRhdGUsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbnN0IHByb3BzID0gW1xuICAgICAgICAgICAgJ21hc3MnLFxuICAgICAgICAgICAgJ2xpbmVhckRhbXBpbmcnLFxuICAgICAgICAgICAgJ2FuZ3VsYXJEYW1waW5nJyxcbiAgICAgICAgICAgICdsaW5lYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2FuZ3VsYXJGYWN0b3InLFxuICAgICAgICAgICAgJ2ZyaWN0aW9uJyxcbiAgICAgICAgICAgICdyb2xsaW5nRnJpY3Rpb24nLFxuICAgICAgICAgICAgJ3Jlc3RpdHV0aW9uJyxcbiAgICAgICAgICAgICd0eXBlJyxcbiAgICAgICAgICAgICdncm91cCcsXG4gICAgICAgICAgICAnbWFzaydcbiAgICAgICAgXTtcblxuICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIHByb3BzKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGRhdGFbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gbmV3IFZlYzModmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVsyXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgWydlbmFibGVkJ10pO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgLy8gY3JlYXRlIG5ldyBkYXRhIGJsb2NrIGZvciBjbG9uZVxuICAgICAgICBjb25zdCByaWdpZGJvZHkgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgZW5hYmxlZDogcmlnaWRib2R5LmVuYWJsZWQsXG4gICAgICAgICAgICBtYXNzOiByaWdpZGJvZHkubWFzcyxcbiAgICAgICAgICAgIGxpbmVhckRhbXBpbmc6IHJpZ2lkYm9keS5saW5lYXJEYW1waW5nLFxuICAgICAgICAgICAgYW5ndWxhckRhbXBpbmc6IHJpZ2lkYm9keS5hbmd1bGFyRGFtcGluZyxcbiAgICAgICAgICAgIGxpbmVhckZhY3RvcjogW3JpZ2lkYm9keS5saW5lYXJGYWN0b3IueCwgcmlnaWRib2R5LmxpbmVhckZhY3Rvci55LCByaWdpZGJvZHkubGluZWFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgYW5ndWxhckZhY3RvcjogW3JpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLngsIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnksIHJpZ2lkYm9keS5hbmd1bGFyRmFjdG9yLnpdLFxuICAgICAgICAgICAgZnJpY3Rpb246IHJpZ2lkYm9keS5mcmljdGlvbixcbiAgICAgICAgICAgIHJvbGxpbmdGcmljdGlvbjogcmlnaWRib2R5LnJvbGxpbmdGcmljdGlvbixcbiAgICAgICAgICAgIHJlc3RpdHV0aW9uOiByaWdpZGJvZHkucmVzdGl0dXRpb24sXG4gICAgICAgICAgICB0eXBlOiByaWdpZGJvZHkudHlwZSxcbiAgICAgICAgICAgIGdyb3VwOiByaWdpZGJvZHkuZ3JvdXAsXG4gICAgICAgICAgICBtYXNrOiByaWdpZGJvZHkubWFza1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IGNvbXBvbmVudC5ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVCb2R5KGJvZHkpO1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95Qm9keShib2R5KTtcblxuICAgICAgICAgICAgY29tcG9uZW50LmJvZHkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQm9keShib2R5LCBncm91cCwgbWFzaykge1xuICAgICAgICBpZiAoZ3JvdXAgIT09IHVuZGVmaW5lZCAmJiBtYXNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5hZGRSaWdpZEJvZHkoYm9keSwgZ3JvdXAsIG1hc2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkLmFkZFJpZ2lkQm9keShib2R5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUJvZHkoYm9keSkge1xuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmVtb3ZlUmlnaWRCb2R5KGJvZHkpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBsb2NhbEluZXJ0aWEgPSBuZXcgQW1tby5idFZlY3RvcjMoMCwgMCwgMCk7XG4gICAgICAgIGlmIChtYXNzICE9PSAwKSB7XG4gICAgICAgICAgICBzaGFwZS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgbG9jYWxJbmVydGlhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gbmV3IEFtbW8uYnREZWZhdWx0TW90aW9uU3RhdGUodHJhbnNmb3JtKTtcbiAgICAgICAgY29uc3QgYm9keUluZm8gPSBuZXcgQW1tby5idFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8obWFzcywgbW90aW9uU3RhdGUsIHNoYXBlLCBsb2NhbEluZXJ0aWEpO1xuICAgICAgICBjb25zdCBib2R5ID0gbmV3IEFtbW8uYnRSaWdpZEJvZHkoYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3koYm9keUluZm8pO1xuICAgICAgICBBbW1vLmRlc3Ryb3kobG9jYWxJbmVydGlhKTtcblxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICB9XG5cbiAgICBkZXN0cm95Qm9keShib2R5KSB7XG4gICAgICAgIC8vIFRoZSBtb3Rpb24gc3RhdGUgbmVlZHMgdG8gYmUgZGVzdHJveWVkIGV4cGxpY2l0bHkgKGlmIHByZXNlbnQpXG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShtb3Rpb25TdGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgQW1tby5kZXN0cm95KGJvZHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gdGhlIGZpcnN0IGVudGl0eSB0aGUgcmF5IGhpdHMuIEZpcmUgYSByYXkgaW50byB0aGUgd29ybGQgZnJvbVxuICAgICAqIHN0YXJ0IHRvIGVuZCwgaWYgdGhlIHJheSBoaXRzIGFuIGVudGl0eSB3aXRoIGEgY29sbGlzaW9uIGNvbXBvbmVudCwgaXQgcmV0dXJucyBhXG4gICAgICoge0BsaW5rIFJheWNhc3RSZXN1bHR9LCBvdGhlcndpc2UgcmV0dXJucyBudWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IHN0YXJ0cy5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSB3b3JsZCBzcGFjZSBwb2ludCB3aGVyZSB0aGUgcmF5IGVuZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBhZGRpdGlvbmFsIG9wdGlvbnMgZm9yIHRoZSByYXljYXN0aW5nLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cF0gLSBDb2xsaXNpb24gZ3JvdXAgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2tdIC0gQ29sbGlzaW9uIG1hc2sgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHthbnlbXX0gW29wdGlvbnMuZmlsdGVyVGFnc10gLSBUYWdzIGZpbHRlcnMuIERlZmluZWQgdGhlIHNhbWUgd2F5IGFzIGEge0BsaW5rIFRhZ3MjaGFzfVxuICAgICAqIHF1ZXJ5IGJ1dCB3aXRoaW4gYW4gYXJyYXkuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMuZmlsdGVyQ2FsbGJhY2tdIC0gQ3VzdG9tIGZ1bmN0aW9uIHRvIHVzZSB0byBmaWx0ZXIgZW50aXRpZXMuXG4gICAgICogTXVzdCByZXR1cm4gdHJ1ZSB0byBwcm9jZWVkIHdpdGggcmVzdWx0LiBUYWtlcyBvbmUgYXJndW1lbnQ6IHRoZSBlbnRpdHkgdG8gZXZhbHVhdGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UmF5Y2FzdFJlc3VsdHxudWxsfSBUaGUgcmVzdWx0IG9mIHRoZSByYXljYXN0aW5nIG9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIGhpdC5cbiAgICAgKi9cbiAgICByYXljYXN0Rmlyc3Qoc3RhcnQsIGVuZCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIC8vIFRhZ3MgYW5kIGN1c3RvbSBjYWxsYmFjayBjYW4gb25seSBiZSBwZXJmb3JtZWQgYnkgbG9va2luZyBhdCBhbGwgcmVzdWx0cy5cbiAgICAgICAgaWYgKG9wdGlvbnMuZmlsdGVyVGFncyB8fCBvcHRpb25zLmZpbHRlckNhbGxiYWNrKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNvcnQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmF5Y2FzdEFsbChzdGFydCwgZW5kLCBvcHRpb25zKVswXSB8fCBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgYW1tb1JheVN0YXJ0LnNldFZhbHVlKHN0YXJ0LngsIHN0YXJ0LnksIHN0YXJ0LnopO1xuICAgICAgICBhbW1vUmF5RW5kLnNldFZhbHVlKGVuZC54LCBlbmQueSwgZW5kLnopO1xuICAgICAgICBjb25zdCByYXlDYWxsYmFjayA9IG5ldyBBbW1vLkNsb3Nlc3RSYXlSZXN1bHRDYWxsYmFjayhhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHJheUNhbGxiYWNrLnNldF9tX2NvbGxpc2lvbkZpbHRlckdyb3VwKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uR3JvdXApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2sgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICByYXlDYWxsYmFjay5zZXRfbV9jb2xsaXNpb25GaWx0ZXJNYXNrKG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uTWFzayk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQucmF5VGVzdChhbW1vUmF5U3RhcnQsIGFtbW9SYXlFbmQsIHJheUNhbGxiYWNrKTtcbiAgICAgICAgaWYgKHJheUNhbGxiYWNrLmhhc0hpdCgpKSB7XG4gICAgICAgICAgICBjb25zdCBjb2xsaXNpb25PYmogPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3QoKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2JqLCBBbW1vLmJ0UmlnaWRCb2R5KTtcblxuICAgICAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb2ludCA9IHJheUNhbGxiYWNrLmdldF9tX2hpdFBvaW50V29ybGQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWwgPSByYXlDYWxsYmFjay5nZXRfbV9oaXROb3JtYWxXb3JsZCgpO1xuXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IFJheWNhc3RSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGJvZHkuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhwb2ludC54KCksIHBvaW50LnkoKSwgcG9pbnQueigpKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMobm9ybWFsLngoKSwgbm9ybWFsLnkoKSwgbm9ybWFsLnooKSksXG4gICAgICAgICAgICAgICAgICAgIHJheUNhbGxiYWNrLmdldF9tX2Nsb3Nlc3RIaXRGcmFjdGlvbigpXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIC8vIGtlZXBpbmcgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNyYXlDYXN0Rmlyc3Qgbm8gbG9uZ2VyIHJlcXVpcmVzIGEgY2FsbGJhY2suIFRoZSByZXN1bHQgb2YgdGhlIHJheWNhc3QgaXMgcmV0dXJuZWQgYnkgdGhlIGZ1bmN0aW9uIGluc3RlYWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KHJheUNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJheWNhc3QgdGhlIHdvcmxkIGFuZCByZXR1cm4gYWxsIGVudGl0aWVzIHRoZSByYXkgaGl0cy4gSXQgcmV0dXJucyBhbiBhcnJheSBvZlxuICAgICAqIHtAbGluayBSYXljYXN0UmVzdWx0fSwgb25lIGZvciBlYWNoIGhpdC4gSWYgbm8gaGl0cyBhcmUgZGV0ZWN0ZWQsIHRoZSByZXR1cm5lZCBhcnJheSB3aWxsIGJlXG4gICAgICogb2YgbGVuZ3RoIDAuIFJlc3VsdHMgYXJlIHNvcnRlZCBieSBkaXN0YW5jZSB3aXRoIGNsb3Nlc3QgZmlyc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgc3RhcnRzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIHdvcmxkIHNwYWNlIHBvaW50IHdoZXJlIHRoZSByYXkgZW5kcy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIGFkZGl0aW9uYWwgb3B0aW9ucyBmb3IgdGhlIHJheWNhc3RpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zb3J0XSAtIFdoZXRoZXIgdG8gc29ydCByYXljYXN0IHJlc3VsdHMgYmFzZWQgb24gZGlzdGFuY2Ugd2l0aCBjbG9zZXN0XG4gICAgICogZmlyc3QuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cF0gLSBDb2xsaXNpb24gZ3JvdXAgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZpbHRlckNvbGxpc2lvbk1hc2tdIC0gQ29sbGlzaW9uIG1hc2sgdG8gYXBwbHkgdG8gdGhlIHJheWNhc3QuXG4gICAgICogQHBhcmFtIHthbnlbXX0gW29wdGlvbnMuZmlsdGVyVGFnc10gLSBUYWdzIGZpbHRlcnMuIERlZmluZWQgdGhlIHNhbWUgd2F5IGFzIGEge0BsaW5rIFRhZ3MjaGFzfVxuICAgICAqIHF1ZXJ5IGJ1dCB3aXRoaW4gYW4gYXJyYXkuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMuZmlsdGVyQ2FsbGJhY2tdIC0gQ3VzdG9tIGZ1bmN0aW9uIHRvIHVzZSB0byBmaWx0ZXIgZW50aXRpZXMuXG4gICAgICogTXVzdCByZXR1cm4gdHJ1ZSB0byBwcm9jZWVkIHdpdGggcmVzdWx0LiBUYWtlcyB0aGUgZW50aXR5IHRvIGV2YWx1YXRlIGFzIGFyZ3VtZW50LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1JheWNhc3RSZXN1bHRbXX0gQW4gYXJyYXkgb2YgcmF5Y2FzdCBoaXQgcmVzdWx0cyAoMCBsZW5ndGggaWYgdGhlcmUgd2VyZSBubyBoaXRzKS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCByZXN1bHRzIG9mIGEgcmF5Y2FzdCBiZXR3ZWVuIDAsIDIsIDIgYW5kIDAsIC0yLCAtMlxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJldHVybiBhbGwgcmVzdWx0cyBvZiBhIHJheWNhc3QgYmV0d2VlbiAwLCAyLCAyIGFuZCAwLCAtMiwgLTJcbiAgICAgKiAvLyB3aGVyZSBoaXQgZW50aXR5IGlzIHRhZ2dlZCB3aXRoIGBiaXJkYCBPUiBgbWFtbWFsYFxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpLCB7XG4gICAgICogICAgIGZpbHRlclRhZ3M6IFsgXCJiaXJkXCIsIFwibWFtbWFsXCIgXVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmV0dXJuIGFsbCByZXN1bHRzIG9mIGEgcmF5Y2FzdCBiZXR3ZWVuIDAsIDIsIDIgYW5kIDAsIC0yLCAtMlxuICAgICAqIC8vIHdoZXJlIGhpdCBlbnRpdHkgaGFzIGEgYGNhbWVyYWAgY29tcG9uZW50XG4gICAgICogY29uc3QgaGl0cyA9IHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LnJheWNhc3RBbGwobmV3IFZlYzMoMCwgMiwgMiksIG5ldyBWZWMzKDAsIC0yLCAtMiksIHtcbiAgICAgKiAgICAgZmlsdGVyQ2FsbGJhY2s6IChlbnRpdHkpID0+IGVudGl0eSAmJiBlbnRpdHkuY2FtZXJhXG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZXR1cm4gYWxsIHJlc3VsdHMgb2YgYSByYXljYXN0IGJldHdlZW4gMCwgMiwgMiBhbmQgMCwgLTIsIC0yXG4gICAgICogLy8gd2hlcmUgaGl0IGVudGl0eSBpcyB0YWdnZWQgd2l0aCAoYGNhcm5pdm9yZWAgQU5EIGBtYW1tYWxgKSBPUiAoYGNhcm5pdm9yZWAgQU5EIGByZXB0aWxlYClcbiAgICAgKiAvLyBhbmQgdGhlIGVudGl0eSBoYXMgYW4gYGFuaW1gIGNvbXBvbmVudFxuICAgICAqIGNvbnN0IGhpdHMgPSB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5yYXljYXN0QWxsKG5ldyBWZWMzKDAsIDIsIDIpLCBuZXcgVmVjMygwLCAtMiwgLTIpLCB7XG4gICAgICogICAgIGZpbHRlclRhZ3M6IFtcbiAgICAgKiAgICAgICAgIFsgXCJjYXJuaXZvcmVcIiwgXCJtYW1tYWxcIiBdLFxuICAgICAqICAgICAgICAgWyBcImNhcm5pdm9yZVwiLCBcInJlcHRpbGVcIiBdXG4gICAgICogICAgIF0sXG4gICAgICogICAgIGZpbHRlckNhbGxiYWNrOiAoZW50aXR5KSA9PiBlbnRpdHkgJiYgZW50aXR5LmFuaW1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICByYXljYXN0QWxsKHN0YXJ0LCBlbmQsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoQW1tby5BbGxIaXRzUmF5UmVzdWx0Q2FsbGJhY2ssICdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jcmF5Y2FzdEFsbDogWW91ciB2ZXJzaW9uIG9mIGFtbW8uanMgZG9lcyBub3QgZXhwb3NlIEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrLiBVcGRhdGUgaXQgdG8gbGF0ZXN0LicpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICBhbW1vUmF5U3RhcnQuc2V0VmFsdWUoc3RhcnQueCwgc3RhcnQueSwgc3RhcnQueik7XG4gICAgICAgIGFtbW9SYXlFbmQuc2V0VmFsdWUoZW5kLngsIGVuZC55LCBlbmQueik7XG4gICAgICAgIGNvbnN0IHJheUNhbGxiYWNrID0gbmV3IEFtbW8uQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrKGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmZpbHRlckNvbGxpc2lvbkdyb3VwID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgcmF5Q2FsbGJhY2suc2V0X21fY29sbGlzaW9uRmlsdGVyR3JvdXAob3B0aW9ucy5maWx0ZXJDb2xsaXNpb25Hcm91cCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmlsdGVyQ29sbGlzaW9uTWFzayA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHJheUNhbGxiYWNrLnNldF9tX2NvbGxpc2lvbkZpbHRlck1hc2sob3B0aW9ucy5maWx0ZXJDb2xsaXNpb25NYXNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5yYXlUZXN0KGFtbW9SYXlTdGFydCwgYW1tb1JheUVuZCwgcmF5Q2FsbGJhY2spO1xuICAgICAgICBpZiAocmF5Q2FsbGJhY2suaGFzSGl0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxpc2lvbk9ianMgPSByYXlDYWxsYmFjay5nZXRfbV9jb2xsaXNpb25PYmplY3RzKCk7XG4gICAgICAgICAgICBjb25zdCBwb2ludHMgPSByYXlDYWxsYmFjay5nZXRfbV9oaXRQb2ludFdvcmxkKCk7XG4gICAgICAgICAgICBjb25zdCBub3JtYWxzID0gcmF5Q2FsbGJhY2suZ2V0X21faGl0Tm9ybWFsV29ybGQoKTtcbiAgICAgICAgICAgIGNvbnN0IGhpdEZyYWN0aW9ucyA9IHJheUNhbGxiYWNrLmdldF9tX2hpdEZyYWN0aW9ucygpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1IaXRzID0gY29sbGlzaW9uT2Jqcy5zaXplKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUhpdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBBbW1vLmNhc3RPYmplY3QoY29sbGlzaW9uT2Jqcy5hdChpKSwgQW1tby5idFJpZ2lkQm9keSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYm9keSAmJiBib2R5LmVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5maWx0ZXJUYWdzICYmICFib2R5LmVudGl0eS50YWdzLmhhcyguLi5vcHRpb25zLmZpbHRlclRhZ3MpIHx8IG9wdGlvbnMuZmlsdGVyQ2FsbGJhY2sgJiYgIW9wdGlvbnMuZmlsdGVyQ2FsbGJhY2soYm9keS5lbnRpdHkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvaW50ID0gcG9pbnRzLmF0KGkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWwgPSBub3JtYWxzLmF0KGkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgUmF5Y2FzdFJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHkuZW50aXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZlYzMocG9pbnQueCgpLCBwb2ludC55KCksIHBvaW50LnooKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMyhub3JtYWwueCgpLCBub3JtYWwueSgpLCBub3JtYWwueigpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpdEZyYWN0aW9ucy5hdChpKVxuICAgICAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc29ydCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMuc29ydCgoYSwgYikgPT4gYS5oaXRGcmFjdGlvbiAtIGIuaGl0RnJhY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgQW1tby5kZXN0cm95KHJheUNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9yZXMgYSBjb2xsaXNpb24gYmV0d2VlbiB0aGUgZW50aXR5IGFuZCBvdGhlciBpbiB0aGUgY29udGFjdHMgbWFwIGFuZCByZXR1cm5zIHRydWUgaWYgaXRcbiAgICAgKiBpcyBhIG5ldyBjb2xsaXNpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIGVudGl0eSB0aGF0IGNvbGxpZGVzIHdpdGggdGhlIGZpcnN0XG4gICAgICogZW50aXR5LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoaXMgaXMgYSBuZXcgY29sbGlzaW9uLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3RvcmVDb2xsaXNpb24oZW50aXR5LCBvdGhlcikge1xuICAgICAgICBsZXQgaXNOZXdDb2xsaXNpb24gPSBmYWxzZTtcbiAgICAgICAgY29uc3QgZ3VpZCA9IGVudGl0eS5nZXRHdWlkKCk7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25zW2d1aWRdID0gdGhpcy5jb2xsaXNpb25zW2d1aWRdIHx8IHsgb3RoZXJzOiBbXSwgZW50aXR5OiBlbnRpdHkgfTtcblxuICAgICAgICBpZiAodGhpcy5jb2xsaXNpb25zW2d1aWRdLm90aGVycy5pbmRleE9mKG90aGVyKSA8IDApIHtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uc1tndWlkXS5vdGhlcnMucHVzaChvdGhlcik7XG4gICAgICAgICAgICBpc05ld0NvbGxpc2lvbiA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZyYW1lQ29sbGlzaW9uc1tndWlkXSA9IHRoaXMuZnJhbWVDb2xsaXNpb25zW2d1aWRdIHx8IHsgb3RoZXJzOiBbXSwgZW50aXR5OiBlbnRpdHkgfTtcbiAgICAgICAgdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF0ub3RoZXJzLnB1c2gob3RoZXIpO1xuXG4gICAgICAgIHJldHVybiBpc05ld0NvbGxpc2lvbjtcbiAgICB9XG5cbiAgICBfY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8oY29udGFjdFBvaW50KSB7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRBKCk7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRCKCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uV29ybGRPbkEgPSBjb250YWN0UG9pbnQuZ2V0UG9zaXRpb25Xb3JsZE9uQSgpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25CID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkIoKTtcbiAgICAgICAgY29uc3Qgbm9ybWFsV29ybGRPbkIgPSBjb250YWN0UG9pbnQuZ2V0X21fbm9ybWFsV29ybGRPbkIoKTtcblxuICAgICAgICBjb25zdCBjb250YWN0ID0gdGhpcy5jb250YWN0UG9pbnRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludC5zZXQobG9jYWxQb2ludEEueCgpLCBsb2NhbFBvaW50QS55KCksIGxvY2FsUG9pbnRBLnooKSk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludE90aGVyLnNldChsb2NhbFBvaW50Qi54KCksIGxvY2FsUG9pbnRCLnkoKSwgbG9jYWxQb2ludEIueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludC5zZXQocG9zaXRpb25Xb3JsZE9uQS54KCksIHBvc2l0aW9uV29ybGRPbkEueSgpLCBwb3NpdGlvbldvcmxkT25BLnooKSk7XG4gICAgICAgIGNvbnRhY3QucG9pbnRPdGhlci5zZXQocG9zaXRpb25Xb3JsZE9uQi54KCksIHBvc2l0aW9uV29ybGRPbkIueSgpLCBwb3NpdGlvbldvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3Qubm9ybWFsLnNldChub3JtYWxXb3JsZE9uQi54KCksIG5vcm1hbFdvcmxkT25CLnkoKSwgbm9ybWFsV29ybGRPbkIueigpKTtcbiAgICAgICAgY29udGFjdC5pbXB1bHNlID0gY29udGFjdFBvaW50LmdldEFwcGxpZWRJbXB1bHNlKCk7XG4gICAgICAgIHJldHVybiBjb250YWN0O1xuICAgIH1cblxuICAgIF9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8oY29udGFjdFBvaW50KSB7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRBID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRBKCk7XG4gICAgICAgIGNvbnN0IGxvY2FsUG9pbnRCID0gY29udGFjdFBvaW50LmdldF9tX2xvY2FsUG9pbnRCKCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uV29ybGRPbkEgPSBjb250YWN0UG9pbnQuZ2V0UG9zaXRpb25Xb3JsZE9uQSgpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbldvcmxkT25CID0gY29udGFjdFBvaW50LmdldFBvc2l0aW9uV29ybGRPbkIoKTtcbiAgICAgICAgY29uc3Qgbm9ybWFsV29ybGRPbkIgPSBjb250YWN0UG9pbnQuZ2V0X21fbm9ybWFsV29ybGRPbkIoKTtcblxuICAgICAgICBjb25zdCBjb250YWN0ID0gdGhpcy5jb250YWN0UG9pbnRQb29sLmFsbG9jYXRlKCk7XG4gICAgICAgIGNvbnRhY3QubG9jYWxQb2ludE90aGVyLnNldChsb2NhbFBvaW50QS54KCksIGxvY2FsUG9pbnRBLnkoKSwgbG9jYWxQb2ludEEueigpKTtcbiAgICAgICAgY29udGFjdC5sb2NhbFBvaW50LnNldChsb2NhbFBvaW50Qi54KCksIGxvY2FsUG9pbnRCLnkoKSwgbG9jYWxQb2ludEIueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludE90aGVyLnNldChwb3NpdGlvbldvcmxkT25BLngoKSwgcG9zaXRpb25Xb3JsZE9uQS55KCksIHBvc2l0aW9uV29ybGRPbkEueigpKTtcbiAgICAgICAgY29udGFjdC5wb2ludC5zZXQocG9zaXRpb25Xb3JsZE9uQi54KCksIHBvc2l0aW9uV29ybGRPbkIueSgpLCBwb3NpdGlvbldvcmxkT25CLnooKSk7XG4gICAgICAgIGNvbnRhY3Qubm9ybWFsLnNldChub3JtYWxXb3JsZE9uQi54KCksIG5vcm1hbFdvcmxkT25CLnkoKSwgbm9ybWFsV29ybGRPbkIueigpKTtcbiAgICAgICAgY29udGFjdC5pbXB1bHNlID0gY29udGFjdFBvaW50LmdldEFwcGxpZWRJbXB1bHNlKCk7XG4gICAgICAgIHJldHVybiBjb250YWN0O1xuICAgIH1cblxuICAgIF9jcmVhdGVTaW5nbGVDb250YWN0UmVzdWx0KGEsIGIsIGNvbnRhY3RQb2ludCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sLmFsbG9jYXRlKCk7XG5cbiAgICAgICAgcmVzdWx0LmEgPSBhO1xuICAgICAgICByZXN1bHQuYiA9IGI7XG4gICAgICAgIHJlc3VsdC5sb2NhbFBvaW50QSA9IGNvbnRhY3RQb2ludC5sb2NhbFBvaW50O1xuICAgICAgICByZXN1bHQubG9jYWxQb2ludEIgPSBjb250YWN0UG9pbnQubG9jYWxQb2ludE90aGVyO1xuICAgICAgICByZXN1bHQucG9pbnRBID0gY29udGFjdFBvaW50LnBvaW50O1xuICAgICAgICByZXN1bHQucG9pbnRCID0gY29udGFjdFBvaW50LnBvaW50T3RoZXI7XG4gICAgICAgIHJlc3VsdC5ub3JtYWwgPSBjb250YWN0UG9pbnQubm9ybWFsO1xuICAgICAgICByZXN1bHQuaW1wdWxzZSA9IGNvbnRhY3RQb2ludC5pbXB1bHNlO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnRhY3RSZXN1bHQob3RoZXIsIGNvbnRhY3RzKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuY29udGFjdFJlc3VsdFBvb2wuYWxsb2NhdGUoKTtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gb3RoZXI7XG4gICAgICAgIHJlc3VsdC5jb250YWN0cyA9IGNvbnRhY3RzO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgY29sbGlzaW9ucyB0aGF0IG5vIGxvbmdlciBleGlzdCBmcm9tIHRoZSBjb2xsaXNpb25zIGxpc3QgYW5kIGZpcmVzIGNvbGxpc2lvbmVuZFxuICAgICAqIGV2ZW50cyB0byB0aGUgcmVsYXRlZCBlbnRpdGllcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NsZWFuT2xkQ29sbGlzaW9ucygpIHtcbiAgICAgICAgZm9yIChjb25zdCBndWlkIGluIHRoaXMuY29sbGlzaW9ucykge1xuICAgICAgICAgICAgaWYgKHRoaXMuY29sbGlzaW9ucy5oYXNPd25Qcm9wZXJ0eShndWlkKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lQ29sbGlzaW9uID0gdGhpcy5mcmFtZUNvbGxpc2lvbnNbZ3VpZF07XG4gICAgICAgICAgICAgICAgY29uc3QgY29sbGlzaW9uID0gdGhpcy5jb2xsaXNpb25zW2d1aWRdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eSA9IGNvbGxpc2lvbi5lbnRpdHk7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5Q29sbGlzaW9uID0gZW50aXR5LmNvbGxpc2lvbjtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlSaWdpZGJvZHkgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICAgICAgICAgIGNvbnN0IG90aGVycyA9IGNvbGxpc2lvbi5vdGhlcnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVuZ3RoID0gb3RoZXJzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBsZXQgaSA9IGxlbmd0aDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG90aGVyID0gb3RoZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY29udGFjdCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgY3VycmVudCBmcmFtZSBjb2xsaXNpb25zIHRoZW4gZmlyZSBldmVudFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZyYW1lQ29sbGlzaW9uIHx8IGZyYW1lQ29sbGlzaW9uLm90aGVycy5pbmRleE9mKG90aGVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIG90aGVycyBsaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICBvdGhlcnMuc3BsaWNlKGksIDEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBoYW5kbGUgYSB0cmlnZ2VyIGVudGl0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbnRpdHlDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50aXR5Q29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJsZWF2ZScsIG90aGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG90aGVyLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdGhlci5yaWdpZGJvZHkuZmlyZSgndHJpZ2dlcmxlYXZlJywgZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFvdGhlci50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3VwcHJlc3MgZXZlbnRzIGlmIHRoZSBvdGhlciBlbnRpdHkgaXMgYSB0cmlnZ2VyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eVJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlSaWdpZGJvZHkuZmlyZSgnY29sbGlzaW9uZW5kJywgb3RoZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvbGxpc2lvbi5maXJlKCdjb2xsaXNpb25lbmQnLCBvdGhlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG90aGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29sbGlzaW9uc1tndWlkXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGVudGl0eSBoYXMgYSBjb250YWN0IGV2ZW50IGF0dGFjaGVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBFbnRpdHkgdG8gdGVzdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgZW50aXR5IGhhcyBhIGNvbnRhY3QgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYXNDb250YWN0RXZlbnQoZW50aXR5KSB7XG4gICAgICAgIGNvbnN0IGMgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICBpZiAoYyAmJiAoYy5oYXNFdmVudCgnY29sbGlzaW9uc3RhcnQnKSB8fCBjLmhhc0V2ZW50KCdjb2xsaXNpb25lbmQnKSB8fCBjLmhhc0V2ZW50KCdjb250YWN0JykpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHIgPSBlbnRpdHkucmlnaWRib2R5O1xuICAgICAgICByZXR1cm4gciAmJiAoci5oYXNFdmVudCgnY29sbGlzaW9uc3RhcnQnKSB8fCByLmhhc0V2ZW50KCdjb2xsaXNpb25lbmQnKSB8fCByLmhhc0V2ZW50KCdjb250YWN0JykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBmb3IgY29sbGlzaW9ucyBhbmQgZmlyZXMgY29sbGlzaW9uIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3b3JsZCAtIFRoZSBwb2ludGVyIHRvIHRoZSBkeW5hbWljcyB3b3JsZCB0aGF0IGludm9rZWQgdGhpcyBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGltZVN0ZXAgLSBUaGUgYW1vdW50IG9mIHNpbXVsYXRpb24gdGltZSBwcm9jZXNzZWQgaW4gdGhlIGxhc3Qgc2ltdWxhdGlvbiB0aWNrLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NoZWNrRm9yQ29sbGlzaW9ucyh3b3JsZCwgdGltZVN0ZXApIHtcbiAgICAgICAgY29uc3QgZHluYW1pY3NXb3JsZCA9IEFtbW8ud3JhcFBvaW50ZXIod29ybGQsIEFtbW8uYnREeW5hbWljc1dvcmxkKTtcblxuICAgICAgICAvLyBDaGVjayBmb3IgY29sbGlzaW9ucyBhbmQgZmlyZSBjYWxsYmFja3NcbiAgICAgICAgY29uc3QgZGlzcGF0Y2hlciA9IGR5bmFtaWNzV29ybGQuZ2V0RGlzcGF0Y2hlcigpO1xuICAgICAgICBjb25zdCBudW1NYW5pZm9sZHMgPSBkaXNwYXRjaGVyLmdldE51bU1hbmlmb2xkcygpO1xuXG4gICAgICAgIHRoaXMuZnJhbWVDb2xsaXNpb25zID0ge307XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBhbGwgY29udGFjdHMgYW5kIGZpcmUgZXZlbnRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtTWFuaWZvbGRzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1hbmlmb2xkID0gZGlzcGF0Y2hlci5nZXRNYW5pZm9sZEJ5SW5kZXhJbnRlcm5hbChpKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keTAgPSBtYW5pZm9sZC5nZXRCb2R5MCgpO1xuICAgICAgICAgICAgY29uc3QgYm9keTEgPSBtYW5pZm9sZC5nZXRCb2R5MSgpO1xuXG4gICAgICAgICAgICBjb25zdCB3YjAgPSBBbW1vLmNhc3RPYmplY3QoYm9keTAsIEFtbW8uYnRSaWdpZEJvZHkpO1xuICAgICAgICAgICAgY29uc3Qgd2IxID0gQW1tby5jYXN0T2JqZWN0KGJvZHkxLCBBbW1vLmJ0UmlnaWRCb2R5KTtcblxuICAgICAgICAgICAgY29uc3QgZTAgPSB3YjAuZW50aXR5O1xuICAgICAgICAgICAgY29uc3QgZTEgPSB3YjEuZW50aXR5O1xuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBlbnRpdHkgaXMgbnVsbCAtIFRPRE86IGludmVzdGlnYXRlIHdoZW4gdGhpcyBoYXBwZW5zXG4gICAgICAgICAgICBpZiAoIWUwIHx8ICFlMSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmbGFnczAgPSB3YjAuZ2V0Q29sbGlzaW9uRmxhZ3MoKTtcbiAgICAgICAgICAgIGNvbnN0IGZsYWdzMSA9IHdiMS5nZXRDb2xsaXNpb25GbGFncygpO1xuXG4gICAgICAgICAgICBjb25zdCBudW1Db250YWN0cyA9IG1hbmlmb2xkLmdldE51bUNvbnRhY3RzKCk7XG4gICAgICAgICAgICBjb25zdCBmb3J3YXJkQ29udGFjdHMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHJldmVyc2VDb250YWN0cyA9IFtdO1xuICAgICAgICAgICAgbGV0IG5ld0NvbGxpc2lvbjtcblxuICAgICAgICAgICAgaWYgKG51bUNvbnRhY3RzID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IGZpcmUgY29udGFjdCBldmVudHMgZm9yIHRyaWdnZXJzXG4gICAgICAgICAgICAgICAgaWYgKChmbGFnczAgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGZsYWdzMSAmIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwRXZlbnRzID0gZTAuY29sbGlzaW9uICYmIChlMC5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUwLmNvbGxpc2lvbi5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUV2ZW50cyA9IGUxLmNvbGxpc2lvbiAmJiAoZTEuY29sbGlzaW9uLmhhc0V2ZW50KCd0cmlnZ2VyZW50ZXInKSB8fCBlMS5jb2xsaXNpb24uaGFzRXZlbnQoJ3RyaWdnZXJsZWF2ZScpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTBCb2R5RXZlbnRzID0gZTAucmlnaWRib2R5ICYmIChlMC5yaWdpZGJvZHkuaGFzRXZlbnQoJ3RyaWdnZXJlbnRlcicpIHx8IGUwLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmxlYXZlJykpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlMUJvZHlFdmVudHMgPSBlMS5yaWdpZGJvZHkgJiYgKGUxLnJpZ2lkYm9keS5oYXNFdmVudCgndHJpZ2dlcmVudGVyJykgfHwgZTEucmlnaWRib2R5Lmhhc0V2ZW50KCd0cmlnZ2VybGVhdmUnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSB0cmlnZ2VyZW50ZXIgZXZlbnRzIGZvciB0cmlnZ2Vyc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUwLCBlMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uICYmICEoZmxhZ3MxICYgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAuY29sbGlzaW9uLmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q29sbGlzaW9uID0gdGhpcy5fc3RvcmVDb2xsaXNpb24oZTEsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24gJiYgIShmbGFnczAgJiBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5jb2xsaXNpb24uZmlyZSgndHJpZ2dlcmVudGVyJywgZTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyZSB0cmlnZ2VyZW50ZXIgZXZlbnRzIGZvciByaWdpZGJvZGllc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZTBCb2R5RXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5yaWdpZGJvZHkuZmlyZSgndHJpZ2dlcmVudGVyJywgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGUxQm9keUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZTEucmlnaWRib2R5LmZpcmUoJ3RyaWdnZXJlbnRlcicsIGUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUwRXZlbnRzID0gdGhpcy5faGFzQ29udGFjdEV2ZW50KGUwKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZTFFdmVudHMgPSB0aGlzLl9oYXNDb250YWN0RXZlbnQoZTEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBnbG9iYWxFdmVudHMgPSB0aGlzLmhhc0V2ZW50KCdjb250YWN0Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsb2JhbEV2ZW50cyB8fCBlMEV2ZW50cyB8fCBlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1Db250YWN0czsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnRDb250YWN0UG9pbnQgPSBtYW5pZm9sZC5nZXRDb250YWN0UG9pbnQoaik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGFjdFBvaW50ID0gdGhpcy5fY3JlYXRlQ29udGFjdFBvaW50RnJvbUFtbW8oYnRDb250YWN0UG9pbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwRXZlbnRzIHx8IGUxRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcndhcmRDb250YWN0cy5wdXNoKGNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmVyc2VDb250YWN0UG9pbnQgPSB0aGlzLl9jcmVhdGVSZXZlcnNlQ29udGFjdFBvaW50RnJvbUFtbW8oYnRDb250YWN0UG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXZlcnNlQ29udGFjdHMucHVzaChyZXZlcnNlQ29udGFjdFBvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2xvYmFsRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcmUgZ2xvYmFsIGNvbnRhY3QgZXZlbnQgZm9yIGV2ZXJ5IGNvbnRhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fY3JlYXRlU2luZ2xlQ29udGFjdFJlc3VsdChlMCwgZTEsIGNvbnRhY3RQb2ludCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnY29udGFjdCcsIHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTBFdmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkUmVzdWx0ID0gdGhpcy5fY3JlYXRlQ29udGFjdFJlc3VsdChlMSwgZm9yd2FyZENvbnRhY3RzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2xsaXNpb24gPSB0aGlzLl9zdG9yZUNvbGxpc2lvbihlMCwgZTEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUwLmNvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgnY29udGFjdCcsIGZvcndhcmRSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMC5jb2xsaXNpb24uZmlyZSgnY29sbGlzaW9uc3RhcnQnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMC5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ2NvbnRhY3QnLCBmb3J3YXJkUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NvbGxpc2lvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZTAucmlnaWRib2R5LmZpcmUoJ2NvbGxpc2lvbnN0YXJ0JywgZm9yd2FyZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlMUV2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJldmVyc2VSZXN1bHQgPSB0aGlzLl9jcmVhdGVDb250YWN0UmVzdWx0KGUwLCByZXZlcnNlQ29udGFjdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NvbGxpc2lvbiA9IHRoaXMuX3N0b3JlQ29sbGlzaW9uKGUxLCBlMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZTEuY29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCdjb250YWN0JywgcmV2ZXJzZVJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdDb2xsaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUxLmNvbGxpc2lvbi5maXJlKCdjb2xsaXNpb25zdGFydCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUxLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgnY29udGFjdCcsIHJldmVyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV3Q29sbGlzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlMS5yaWdpZGJvZHkuZmlyZSgnY29sbGlzaW9uc3RhcnQnLCByZXZlcnNlUmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGZvciBjb2xsaXNpb25zIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IGFuZCBmaXJlIGV2ZW50c1xuICAgICAgICB0aGlzLl9jbGVhbk9sZENvbGxpc2lvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBjb250YWN0IHBvb2xzXG4gICAgICAgIHRoaXMuY29udGFjdFBvaW50UG9vbC5mcmVlQWxsKCk7XG4gICAgICAgIHRoaXMuY29udGFjdFJlc3VsdFBvb2wuZnJlZUFsbCgpO1xuICAgICAgICB0aGlzLnNpbmdsZUNvbnRhY3RSZXN1bHRQb29sLmZyZWVBbGwoKTtcbiAgICB9XG5cbiAgICBvblVwZGF0ZShkdCkge1xuICAgICAgICBsZXQgaSwgbGVuO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMucGh5c2ljc1N0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIGRvd25jYXN0IGdyYXZpdHkgdG8gZmxvYXQzMiBzbyB3ZSBjYW4gYWNjdXJhdGVseSBjb21wYXJlIHdpdGggZXhpc3RpbmdcbiAgICAgICAgLy8gZ3Jhdml0eSBzZXQgaW4gYW1tby5cbiAgICAgICAgdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMF0gPSB0aGlzLmdyYXZpdHkueDtcbiAgICAgICAgdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMV0gPSB0aGlzLmdyYXZpdHkueTtcbiAgICAgICAgdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMl0gPSB0aGlzLmdyYXZpdHkuejtcblxuICAgICAgICAvLyBDaGVjayB0byBzZWUgd2hldGhlciB3ZSBuZWVkIHRvIHVwZGF0ZSBncmF2aXR5IG9uIHRoZSBkeW5hbWljcyB3b3JsZFxuICAgICAgICBjb25zdCBncmF2aXR5ID0gdGhpcy5keW5hbWljc1dvcmxkLmdldEdyYXZpdHkoKTtcbiAgICAgICAgaWYgKGdyYXZpdHkueCgpICE9PSB0aGlzLl9ncmF2aXR5RmxvYXQzMlswXSB8fFxuICAgICAgICAgICAgZ3Jhdml0eS55KCkgIT09IHRoaXMuX2dyYXZpdHlGbG9hdDMyWzFdIHx8XG4gICAgICAgICAgICBncmF2aXR5LnooKSAhPT0gdGhpcy5fZ3Jhdml0eUZsb2F0MzJbMl0pIHtcbiAgICAgICAgICAgIGdyYXZpdHkuc2V0VmFsdWUodGhpcy5ncmF2aXR5LngsIHRoaXMuZ3Jhdml0eS55LCB0aGlzLmdyYXZpdHkueik7XG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNzV29ybGQuc2V0R3Jhdml0eShncmF2aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyaWdnZXJzID0gdGhpcy5fdHJpZ2dlcnM7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHRyaWdnZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0cmlnZ2Vyc1tpXS51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbXBvdW5kcyA9IHRoaXMuX2NvbXBvdW5kcztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gY29tcG91bmRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb21wb3VuZHNbaV0uX3VwZGF0ZUNvbXBvdW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgYWxsIGtpbmVtYXRpYyBib2RpZXMgYmFzZWQgb24gdGhlaXIgY3VycmVudCBlbnRpdHkgdHJhbnNmb3JtXG4gICAgICAgIGNvbnN0IGtpbmVtYXRpYyA9IHRoaXMuX2tpbmVtYXRpYztcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0ga2luZW1hdGljLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBraW5lbWF0aWNbaV0uX3VwZGF0ZUtpbmVtYXRpYygpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCB0aGUgcGh5c2ljcyBzaW11bGF0aW9uXG4gICAgICAgIHRoaXMuZHluYW1pY3NXb3JsZC5zdGVwU2ltdWxhdGlvbihkdCwgdGhpcy5tYXhTdWJTdGVwcywgdGhpcy5maXhlZFRpbWVTdGVwKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHRyYW5zZm9ybXMgb2YgYWxsIGVudGl0aWVzIHJlZmVyZW5jaW5nIGEgZHluYW1pYyBib2R5XG4gICAgICAgIGNvbnN0IGR5bmFtaWMgPSB0aGlzLl9keW5hbWljO1xuICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBkeW5hbWljLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBkeW5hbWljW2ldLl91cGRhdGVEeW5hbWljKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZHluYW1pY3NXb3JsZC5zZXRJbnRlcm5hbFRpY2tDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX2NoZWNrRm9yQ29sbGlzaW9ucyhBbW1vLmdldFBvaW50ZXIodGhpcy5keW5hbWljc1dvcmxkKSwgZHQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMucGh5c2ljc1RpbWUgPSBub3coKSAtIHRoaXMuX3N0YXRzLnBoeXNpY3NTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcblxuICAgICAgICBpZiAodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5keW5hbWljc1dvcmxkKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLnNvbHZlcik7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5vdmVybGFwcGluZ1BhaXJDYWNoZSk7XG4gICAgICAgICAgICBBbW1vLmRlc3Ryb3kodGhpcy5kaXNwYXRjaGVyKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLmNvbGxpc2lvbkNvbmZpZ3VyYXRpb24pO1xuICAgICAgICAgICAgdGhpcy5keW5hbWljc1dvcmxkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuc29sdmVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMub3ZlcmxhcHBpbmdQYWlyQ2FjaGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaGVyID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuY29sbGlzaW9uQ29uZmlndXJhdGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IENvbnRhY3RQb2ludCwgQ29udGFjdFJlc3VsdCwgUmF5Y2FzdFJlc3VsdCwgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLCBTaW5nbGVDb250YWN0UmVzdWx0IH07XG4iXSwibmFtZXMiOlsiYW1tb1JheVN0YXJ0IiwiYW1tb1JheUVuZCIsIlJheWNhc3RSZXN1bHQiLCJjb25zdHJ1Y3RvciIsImVudGl0eSIsInBvaW50Iiwibm9ybWFsIiwiaGl0RnJhY3Rpb24iLCJTaW5nbGVDb250YWN0UmVzdWx0IiwiYSIsImIiLCJjb250YWN0UG9pbnQiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJpbXB1bHNlIiwibG9jYWxQb2ludEEiLCJWZWMzIiwibG9jYWxQb2ludEIiLCJwb2ludEEiLCJwb2ludEIiLCJsb2NhbFBvaW50IiwibG9jYWxQb2ludE90aGVyIiwicG9pbnRPdGhlciIsIkNvbnRhY3RQb2ludCIsIkNvbnRhY3RSZXN1bHQiLCJvdGhlciIsImNvbnRhY3RzIiwiX3NjaGVtYSIsIlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsImFwcCIsIm1heFN1YlN0ZXBzIiwiZml4ZWRUaW1lU3RlcCIsImdyYXZpdHkiLCJfZ3Jhdml0eUZsb2F0MzIiLCJGbG9hdDMyQXJyYXkiLCJfZHluYW1pYyIsIl9raW5lbWF0aWMiLCJfdHJpZ2dlcnMiLCJfY29tcG91bmRzIiwiaWQiLCJfc3RhdHMiLCJzdGF0cyIsImZyYW1lIiwiQ29tcG9uZW50VHlwZSIsIlJpZ2lkQm9keUNvbXBvbmVudCIsIkRhdGFUeXBlIiwiUmlnaWRCb2R5Q29tcG9uZW50RGF0YSIsImNvbnRhY3RQb2ludFBvb2wiLCJjb250YWN0UmVzdWx0UG9vbCIsInNpbmdsZUNvbnRhY3RSZXN1bHRQb29sIiwic2NoZW1hIiwiY29sbGlzaW9ucyIsImZyYW1lQ29sbGlzaW9ucyIsIm9uIiwib25CZWZvcmVSZW1vdmUiLCJvblJlbW92ZSIsIm9uTGlicmFyeUxvYWRlZCIsIkFtbW8iLCJjb2xsaXNpb25Db25maWd1cmF0aW9uIiwiYnREZWZhdWx0Q29sbGlzaW9uQ29uZmlndXJhdGlvbiIsImRpc3BhdGNoZXIiLCJidENvbGxpc2lvbkRpc3BhdGNoZXIiLCJvdmVybGFwcGluZ1BhaXJDYWNoZSIsImJ0RGJ2dEJyb2FkcGhhc2UiLCJzb2x2ZXIiLCJidFNlcXVlbnRpYWxJbXB1bHNlQ29uc3RyYWludFNvbHZlciIsImR5bmFtaWNzV29ybGQiLCJidERpc2NyZXRlRHluYW1pY3NXb3JsZCIsInNldEludGVybmFsVGlja0NhbGxiYWNrIiwiY2hlY2tGb3JDb2xsaXNpb25zUG9pbnRlciIsImFkZEZ1bmN0aW9uIiwiX2NoZWNrRm9yQ29sbGlzaW9ucyIsImJpbmQiLCJEZWJ1ZyIsIndhcm4iLCJidFZlY3RvcjMiLCJPYmplY3RQb29sIiwic3lzdGVtcyIsIm9uVXBkYXRlIiwib2ZmIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsInByb3BzIiwicHJvcGVydHkiLCJoYXNPd25Qcm9wZXJ0eSIsInZhbHVlIiwiQXJyYXkiLCJpc0FycmF5IiwiY2xvbmVDb21wb25lbnQiLCJjbG9uZSIsInJpZ2lkYm9keSIsImVuYWJsZWQiLCJtYXNzIiwibGluZWFyRGFtcGluZyIsImFuZ3VsYXJEYW1waW5nIiwibGluZWFyRmFjdG9yIiwieCIsInkiLCJ6IiwiYW5ndWxhckZhY3RvciIsImZyaWN0aW9uIiwicm9sbGluZ0ZyaWN0aW9uIiwicmVzdGl0dXRpb24iLCJ0eXBlIiwiZ3JvdXAiLCJtYXNrIiwiYWRkQ29tcG9uZW50IiwiYm9keSIsInJlbW92ZUJvZHkiLCJkZXN0cm95Qm9keSIsImFkZEJvZHkiLCJ1bmRlZmluZWQiLCJhZGRSaWdpZEJvZHkiLCJyZW1vdmVSaWdpZEJvZHkiLCJjcmVhdGVCb2R5Iiwic2hhcGUiLCJ0cmFuc2Zvcm0iLCJsb2NhbEluZXJ0aWEiLCJjYWxjdWxhdGVMb2NhbEluZXJ0aWEiLCJtb3Rpb25TdGF0ZSIsImJ0RGVmYXVsdE1vdGlvblN0YXRlIiwiYm9keUluZm8iLCJidFJpZ2lkQm9keUNvbnN0cnVjdGlvbkluZm8iLCJidFJpZ2lkQm9keSIsImRlc3Ryb3kiLCJnZXRNb3Rpb25TdGF0ZSIsInJheWNhc3RGaXJzdCIsInN0YXJ0IiwiZW5kIiwib3B0aW9ucyIsImZpbHRlclRhZ3MiLCJmaWx0ZXJDYWxsYmFjayIsInNvcnQiLCJyYXljYXN0QWxsIiwicmVzdWx0Iiwic2V0VmFsdWUiLCJyYXlDYWxsYmFjayIsIkNsb3Nlc3RSYXlSZXN1bHRDYWxsYmFjayIsImZpbHRlckNvbGxpc2lvbkdyb3VwIiwic2V0X21fY29sbGlzaW9uRmlsdGVyR3JvdXAiLCJmaWx0ZXJDb2xsaXNpb25NYXNrIiwic2V0X21fY29sbGlzaW9uRmlsdGVyTWFzayIsInJheVRlc3QiLCJoYXNIaXQiLCJjb2xsaXNpb25PYmoiLCJnZXRfbV9jb2xsaXNpb25PYmplY3QiLCJjYXN0T2JqZWN0IiwiZ2V0X21faGl0UG9pbnRXb3JsZCIsImdldF9tX2hpdE5vcm1hbFdvcmxkIiwiZ2V0X21fY2xvc2VzdEhpdEZyYWN0aW9uIiwiZGVwcmVjYXRlZCIsImNhbGxiYWNrIiwiYXNzZXJ0IiwiQWxsSGl0c1JheVJlc3VsdENhbGxiYWNrIiwicmVzdWx0cyIsImNvbGxpc2lvbk9ianMiLCJnZXRfbV9jb2xsaXNpb25PYmplY3RzIiwicG9pbnRzIiwibm9ybWFscyIsImhpdEZyYWN0aW9ucyIsImdldF9tX2hpdEZyYWN0aW9ucyIsIm51bUhpdHMiLCJzaXplIiwiaSIsImF0IiwidGFncyIsImhhcyIsInB1c2giLCJfc3RvcmVDb2xsaXNpb24iLCJpc05ld0NvbGxpc2lvbiIsImd1aWQiLCJnZXRHdWlkIiwib3RoZXJzIiwiaW5kZXhPZiIsIl9jcmVhdGVDb250YWN0UG9pbnRGcm9tQW1tbyIsImdldF9tX2xvY2FsUG9pbnRBIiwiZ2V0X21fbG9jYWxQb2ludEIiLCJwb3NpdGlvbldvcmxkT25BIiwiZ2V0UG9zaXRpb25Xb3JsZE9uQSIsInBvc2l0aW9uV29ybGRPbkIiLCJnZXRQb3NpdGlvbldvcmxkT25CIiwibm9ybWFsV29ybGRPbkIiLCJnZXRfbV9ub3JtYWxXb3JsZE9uQiIsImNvbnRhY3QiLCJhbGxvY2F0ZSIsInNldCIsImdldEFwcGxpZWRJbXB1bHNlIiwiX2NyZWF0ZVJldmVyc2VDb250YWN0UG9pbnRGcm9tQW1tbyIsIl9jcmVhdGVTaW5nbGVDb250YWN0UmVzdWx0IiwiX2NyZWF0ZUNvbnRhY3RSZXN1bHQiLCJfY2xlYW5PbGRDb2xsaXNpb25zIiwiZnJhbWVDb2xsaXNpb24iLCJjb2xsaXNpb24iLCJlbnRpdHlDb2xsaXNpb24iLCJlbnRpdHlSaWdpZGJvZHkiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiZmlyZSIsIl9oYXNDb250YWN0RXZlbnQiLCJjIiwiaGFzRXZlbnQiLCJyIiwid29ybGQiLCJ0aW1lU3RlcCIsIndyYXBQb2ludGVyIiwiYnREeW5hbWljc1dvcmxkIiwiZ2V0RGlzcGF0Y2hlciIsIm51bU1hbmlmb2xkcyIsImdldE51bU1hbmlmb2xkcyIsIm1hbmlmb2xkIiwiZ2V0TWFuaWZvbGRCeUluZGV4SW50ZXJuYWwiLCJib2R5MCIsImdldEJvZHkwIiwiYm9keTEiLCJnZXRCb2R5MSIsIndiMCIsIndiMSIsImUwIiwiZTEiLCJmbGFnczAiLCJnZXRDb2xsaXNpb25GbGFncyIsImZsYWdzMSIsIm51bUNvbnRhY3RzIiwiZ2V0TnVtQ29udGFjdHMiLCJmb3J3YXJkQ29udGFjdHMiLCJyZXZlcnNlQ29udGFjdHMiLCJuZXdDb2xsaXNpb24iLCJCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCIsImUwRXZlbnRzIiwiZTFFdmVudHMiLCJlMEJvZHlFdmVudHMiLCJlMUJvZHlFdmVudHMiLCJnbG9iYWxFdmVudHMiLCJqIiwiYnRDb250YWN0UG9pbnQiLCJnZXRDb250YWN0UG9pbnQiLCJyZXZlcnNlQ29udGFjdFBvaW50IiwiZm9yd2FyZFJlc3VsdCIsInJldmVyc2VSZXN1bHQiLCJmcmVlQWxsIiwiZHQiLCJsZW4iLCJwaHlzaWNzU3RhcnQiLCJub3ciLCJnZXRHcmF2aXR5Iiwic2V0R3Jhdml0eSIsInRyaWdnZXJzIiwidXBkYXRlVHJhbnNmb3JtIiwiY29tcG91bmRzIiwiX3VwZGF0ZUNvbXBvdW5kIiwia2luZW1hdGljIiwiX3VwZGF0ZUtpbmVtYXRpYyIsInN0ZXBTaW11bGF0aW9uIiwiZHluYW1pYyIsIl91cGRhdGVEeW5hbWljIiwiZ2V0UG9pbnRlciIsInBoeXNpY3NUaW1lIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBYUEsSUFBSUEsWUFBWSxFQUFFQyxVQUFVLENBQUE7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFFQyxXQUFXLEVBQUU7QUFDNUM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0gsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0FBRXBCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUND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
