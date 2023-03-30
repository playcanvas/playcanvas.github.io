/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYGROUP_STATIC, BODYMASK_NOT_STATIC, BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_KINEMATIC, BODYMASK_ALL, BODYGROUP_DYNAMIC, BODYFLAG_KINEMATIC_OBJECT, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from './constants.js';
import { Component } from '../component.js';

// Shared math variable to avoid excessive allocation
let _ammoTransform;
let _ammoVec1, _ammoVec2, _ammoQuat;
const _quat1 = new Quat();
const _quat2 = new Quat();
const _vec3 = new Vec3();

/**
 * The rigidbody component, when combined with a {@link CollisionComponent}, allows your entities
 * to be simulated using realistic physics. A rigidbody component will fall under gravity and
 * collide with other rigid bodies. Using scripts, you can apply forces and impulses to rigid
 * bodies.
 *
 * You should never need to use the RigidBodyComponent constructor. To add an RigidBodyComponent to
 * a {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Create a static 1x1x1 box-shaped rigid body
 * const entity = pc.Entity();
 * entity.addComponent("rigidbody"); // Without options, this defaults to a 'static' body
 * entity.addComponent("collision"); // Without options, this defaults to a 1x1x1 box shape
 * ```
 *
 * To create a dynamic sphere with mass of 10, do:
 *
 * ```javascript
 * const entity = pc.Entity();
 * entity.addComponent("rigidbody", {
 *     type: pc.BODYTYPE_DYNAMIC,
 *     mass: 10
 * });
 * entity.addComponent("collision", {
 *     type: "sphere"
 * });
 * ```
 *
 * Relevant 'Engine-only' examples:
 *
 * - [Falling shapes](http://playcanvas.github.io/#physics/falling-shapes)
 * - [Vehicle physics](http://playcanvas.github.io/#physics/vehicle)
 *
 * @augments Component
 */
class RigidBodyComponent extends Component {
  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /**
   * Create a new RigidBodyComponent instance.
   *
   * @param {import('./system.js').RigidBodyComponentSystem} system - The ComponentSystem that
   * created this component.
   * @param {import('../../entity.js').Entity} entity - The entity this component is attached to.
   */
  constructor(system, entity) {
    // eslint-disable-line no-useless-constructor
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

  /**
   * Fired when a contact occurs between two rigid bodies.
   *
   * @event RigidBodyComponent#contact
   * @param {ContactResult} result - Details of the contact between the two rigid bodies.
   */

  /**
   * Fired when two rigid bodies start touching.
   *
   * @event RigidBodyComponent#collisionstart
   * @param {ContactResult} result - Details of the contact between the two rigid bodies.
   */

  /**
   * Fired when two rigid bodies stop touching.
   *
   * @event RigidBodyComponent#collisionend
   * @param {import('../../entity.js').Entity} other - The {@link Entity} that stopped touching this rigid body.
   */

  /**
   * Fired when a rigid body enters a trigger volume.
   *
   * @event RigidBodyComponent#triggerenter
   * @param {import('../../entity.js').Entity} other - The {@link Entity} with trigger volume that this rigid body entered.
   */

  /**
   * Fired when a rigid body exits a trigger volume.
   *
   * @event RigidBodyComponent#triggerleave
   * @param {import('../../entity.js').Entity} other - The {@link Entity} with trigger volume that this rigid body exited.
   */

  /** @ignore */
  static onLibraryLoaded() {
    // Lazily create shared variable
    if (typeof Ammo !== 'undefined') {
      _ammoTransform = new Ammo.btTransform();
      _ammoVec1 = new Ammo.btVector3();
      _ammoVec2 = new Ammo.btVector3();
      _ammoQuat = new Ammo.btQuaternion();
    }
  }

  /**
   * Controls the rate at which a body loses angular velocity over time.
   *
   * @type {number}
   */
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

  /**
   * Scaling factor for angular movement of the body in each axis. Only valid for rigid bodies of
   * type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely rotate).
   *
   * @type {Vec3}
   */
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

  /**
   * Defines the rotational speed of the body around each world axis.
   *
   * @type {Vec3}
   */
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

  /**
   * The friction value used when contacts occur between two bodies. A higher value indicates
   * more friction. Should be set in the range 0 to 1. Defaults to 0.5.
   *
   * @type {number}
   */
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

  /**
   * The collision group this body belongs to. Combine the group and the mask to prevent bodies
   * colliding with each other. Defaults to 1.
   *
   * @type {number}
   */
  set group(group) {
    if (this._group !== group) {
      this._group = group;

      // re-enabling simulation adds rigidbody back into world with new masks
      if (this.enabled && this.entity.enabled) {
        this.disableSimulation();
        this.enableSimulation();
      }
    }
  }
  get group() {
    return this._group;
  }

  /**
   * Controls the rate at which a body loses linear velocity over time. Defaults to 0.
   *
   * @type {number}
   */
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

  /**
   * Scaling factor for linear movement of the body in each axis. Only valid for rigid bodies of
   * type {@link BODYTYPE_DYNAMIC}. Defaults to 1 in all axes (body can freely move).
   *
   * @type {Vec3}
   */
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

  /**
   * Defines the speed of the body in a given direction.
   *
   * @type {Vec3}
   */
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

  /**
   * The collision mask sets which groups this body collides with. It is a bitfield of 16 bits,
   * the first 8 bits are reserved for engine use. Defaults to 65535.
   *
   * @type {number}
   */
  set mask(mask) {
    if (this._mask !== mask) {
      this._mask = mask;

      // re-enabling simulation adds rigidbody back into world with new masks
      if (this.enabled && this.entity.enabled) {
        this.disableSimulation();
        this.enableSimulation();
      }
    }
  }
  get mask() {
    return this._mask;
  }

  /**
   * The mass of the body. This is only relevant for {@link BODYTYPE_DYNAMIC} bodies, other types
   * have infinite mass. Defaults to 1.
   *
   * @type {number}
   */
  set mass(mass) {
    if (this._mass !== mass) {
      this._mass = mass;
      if (this._body && this._type === BODYTYPE_DYNAMIC) {
        const enabled = this.enabled && this.entity.enabled;
        if (enabled) {
          this.disableSimulation();
        }

        // calculateLocalInertia writes local inertia to ammoVec1 here...
        this._body.getCollisionShape().calculateLocalInertia(mass, _ammoVec1);
        // ...and then writes the calculated local inertia to the body
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

  /**
   * Influences the amount of energy lost when two rigid bodies collide. The calculation
   * multiplies the restitution values for both colliding bodies. A multiplied value of 0 means
   * that all energy is lost in the collision while a value of 1 means that no energy is lost.
   * Should be set in the range 0 to 1. Defaults to 0.
   *
   * @type {number}
   */
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

  /**
   * Sets a torsional friction orthogonal to the contact point. Defaults to 0.
   *
   * @type {number}
   */
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

  /**
   * The rigid body type determines how the body is simulated. Can be:
   *
   * - {@link BODYTYPE_STATIC}: infinite mass and cannot move.
   * - {@link BODYTYPE_DYNAMIC}: simulated according to applied forces.
   * - {@link BODYTYPE_KINEMATIC}: infinite mass and does not respond to forces (can only be
   * moved by setting the position and rotation of component's {@link Entity}).
   *
   * Defaults to {@link BODYTYPE_STATIC}.
   *
   * @type {string}
   */
  set type(type) {
    if (this._type !== type) {
      this._type = type;
      this.disableSimulation();

      // set group and mask to defaults for type
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

      // Create a new body
      this.createBody();
    }
  }
  get type() {
    return this._type;
  }

  /**
   * If the Entity has a Collision shape attached then create a rigid body using this shape. This
   * method destroys the existing body.
   *
   * @private
   */
  createBody() {
    const entity = this.entity;
    let shape;
    if (entity.collision) {
      shape = entity.collision.shape;

      // if a trigger was already created from the collision system
      // destroy it
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

  /**
   * Returns true if the rigid body is currently actively being simulated. I.e. Not 'sleeping'.
   *
   * @returns {boolean} True if the body is active.
   */
  isActive() {
    return this._body ? this._body.isActive() : false;
  }

  /**
   * Forcibly activate the rigid body simulation. Only affects rigid bodies of type
   * {@link BODYTYPE_DYNAMIC}.
   */
  activate() {
    if (this._body) {
      this._body.activate();
    }
  }

  /**
   * Add a body to the simulation.
   *
   * @ignore
   */
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

  /**
   * Remove a body from the simulation.
   *
   * @ignore
   */
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

      // set activation state to disable simulation to avoid body.isActive() to return
      // true even if it's not in the dynamics world
      body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
      this._simulationEnabled = false;
    }
  }

  /**
   * Apply an force to the body at a point. By default, the force is applied at the origin of the
   * body. However, the force can be applied at an offset this point by specifying a world space
   * vector from the body's origin to the point of application. This function has two valid
   * signatures. You can either specify the force (and optional relative point) via 3D-vector or
   * numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the force in world-space or
   * the x-component of the force in world-space.
   * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point
   * at which to apply the impulse in world-space or the y-component of the force in world-space.
   * @param {number} [z] - The z-component of the force in world-space.
   * @param {number} [px] - The x-component of a world-space offset from the body's position
   * where the force is applied.
   * @param {number} [py] - The y-component of a world-space offset from the body's position
   * where the force is applied.
   * @param {number} [pz] - The z-component of a world-space offset from the body's position
   * where the force is applied.
   * @example
   * // Apply an approximation of gravity at the body's center
   * this.entity.rigidbody.applyForce(0, -10, 0);
   * @example
   * // Apply an approximation of gravity at 1 unit down the world Z from the center of the body
   * this.entity.rigidbody.applyForce(0, -10, 0, 0, 0, 1);
   * @example
   * // Apply a force at the body's center
   * // Calculate a force vector pointing in the world space direction of the entity
   * var force = this.entity.forward.clone().mulScalar(100);
   *
   * // Apply the force
   * this.entity.rigidbody.applyForce(force);
   * @example
   * // Apply a force at some relative offset from the body's center
   * // Calculate a force vector pointing in the world space direction of the entity
   * var force = this.entity.forward.clone().mulScalar(100);
   *
   * // Calculate the world space relative offset
   * var relativePos = new pc.Vec3();
   * var childEntity = this.entity.findByName('Engine');
   * relativePos.sub2(childEntity.getPosition(), this.entity.getPosition());
   *
   * // Apply the force
   * this.entity.rigidbody.applyForce(force, relativePos);
   */
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

  /**
   * Apply torque (rotational force) to the body. This function has two valid signatures. You can
   * either specify the torque force with a 3D-vector or with 3 numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the torque force in world-space
   * or the x-component of the torque force in world-space.
   * @param {number} [y] - The y-component of the torque force in world-space.
   * @param {number} [z] - The z-component of the torque force in world-space.
   * @example
   * // Apply via vector
   * var torque = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyTorque(torque);
   * @example
   * // Apply via numbers
   * entity.rigidbody.applyTorque(0, 10, 0);
   */
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

  /**
   * Apply an impulse (instantaneous change of velocity) to the body at a point. This function
   * has two valid signatures. You can either specify the impulse (and optional relative point)
   * via 3D-vector or numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the impulse in world-space or
   * the x-component of the impulse in world-space.
   * @param {Vec3|number} [y] - An optional 3-dimensional vector representing the relative point
   * at which to apply the impulse in the local-space of the entity or the y-component of the
   * impulse to apply in world-space.
   * @param {number} [z] - The z-component of the impulse to apply in world-space.
   * @param {number} [px] - The x-component of the point at which to apply the impulse in the
   * local-space of the entity.
   * @param {number} [py] - The y-component of the point at which to apply the impulse in the
   * local-space of the entity.
   * @param {number} [pz] - The z-component of the point at which to apply the impulse in the
   * local-space of the entity.
   * @example
   * // Apply an impulse along the world-space positive y-axis at the entity's position.
   * var impulse = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyImpulse(impulse);
   * @example
   * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
   * // z-axis of the entity's local-space.
   * var impulse = new pc.Vec3(0, 10, 0);
   * var relativePoint = new pc.Vec3(0, 0, 1);
   * entity.rigidbody.applyImpulse(impulse, relativePoint);
   * @example
   * // Apply an impulse along the world-space positive y-axis at the entity's position.
   * entity.rigidbody.applyImpulse(0, 10, 0);
   * @example
   * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
   * // z-axis of the entity's local-space.
   * entity.rigidbody.applyImpulse(0, 10, 0, 0, 0, 1);
   */
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

  /**
   * Apply a torque impulse (rotational force applied instantaneously) to the body. This function
   * has two valid signatures. You can either specify the torque force with a 3D-vector or with 3
   * numbers.
   *
   * @param {Vec3|number} x - A 3-dimensional vector representing the torque impulse in
   * world-space or the x-component of the torque impulse in world-space.
   * @param {number} [y] - The y-component of the torque impulse in world-space.
   * @param {number} [z] - The z-component of the torque impulse in world-space.
   * @example
   * // Apply via vector
   * var torque = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyTorqueImpulse(torque);
   * @example
   * // Apply via numbers
   * entity.rigidbody.applyTorqueImpulse(0, 10, 0);
   */
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

  /**
   * Returns true if the rigid body is of type {@link BODYTYPE_STATIC}.
   *
   * @returns {boolean} True if static.
   */
  isStatic() {
    return this._type === BODYTYPE_STATIC;
  }

  /**
   * Returns true if the rigid body is of type {@link BODYTYPE_STATIC} or {@link BODYTYPE_KINEMATIC}.
   *
   * @returns {boolean} True if static or kinematic.
   */
  isStaticOrKinematic() {
    return this._type === BODYTYPE_STATIC || this._type === BODYTYPE_KINEMATIC;
  }

  /**
   * Returns true if the rigid body is of type {@link BODYTYPE_KINEMATIC}.
   *
   * @returns {boolean} True if kinematic.
   */
  isKinematic() {
    return this._type === BODYTYPE_KINEMATIC;
  }

  /**
   * Writes an entity transform into an Ammo.btTransform but ignoring scale.
   *
   * @param {object} transform - The ammo transform to write the entity transform to.
   * @private
   */
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

  /**
   * Set the rigid body transform to be the same as the Entity transform. This must be called
   * after any Entity transformation functions (e.g. {@link Entity#setPosition}) are called in
   * order to update the rigid body to match the Entity.
   *
   * @private
   */
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

  /**
   * Sets an entity's transform to match that of the world transformation matrix of a dynamic
   * rigid body's motion state.
   *
   * @private
   */
  _updateDynamic() {
    const body = this._body;
    const entity = this.entity;

    // Update motion state if body is active
    // or entity's transform was manually modified
    if (body.isActive() || entity._wasDirty) {
      if (entity._wasDirty) {
        // Warn the user about setting transform instead of using teleport function
        Debug.warn('Cannot set rigid body transform from entity. Use entity.rigidbody#teleport instead.');
      }

      // Update the motion state. Note that the test for the presence of the motion
      // state is technically redundant since the engine creates one for all bodies.
      const motionState = body.getMotionState();
      if (motionState) {
        motionState.getWorldTransform(_ammoTransform);
        const p = _ammoTransform.getOrigin();
        const q = _ammoTransform.getRotation();
        const component = entity.collision;
        if (component && component._hasOffset) {
          const lo = component.data.linearOffset;
          const ao = component.data.angularOffset;

          // Un-rotate the angular offset and then use the new rotation to
          // un-translate the linear offset in local space
          // Order of operations matter here
          const invertedAo = _quat2.copy(ao).invert();
          const entityRot = _quat1.set(q.x(), q.y(), q.z(), q.w()).mul(invertedAo);
          entityRot.transformVector(lo, _vec3);
          entity.setPosition(p.x() - _vec3.x, p.y() - _vec3.y, p.z() - _vec3.z);
          entity.setRotation(entityRot);
        } else {
          entity.setPosition(p.x(), p.y(), p.z());
          entity.setRotation(q.x(), q.y(), q.z(), q.w());
        }
        entity._wasDirty = false;
      }
    }
  }

  /**
   * Writes the entity's world transformation matrix into the motion state of a kinematic body.
   *
   * @private
   */
  _updateKinematic() {
    const motionState = this._body.getMotionState();
    if (motionState) {
      this._getEntityTransform(_ammoTransform);
      motionState.setWorldTransform(_ammoTransform);
    }
  }

  /**
   * Teleport an entity to a new world-space position, optionally setting orientation. This
   * function should only be called for rigid bodies that are dynamic. This function has three
   * valid signatures. The first takes a 3-dimensional vector for the position and an optional
   * 3-dimensional vector for Euler rotation. The second takes a 3-dimensional vector for the
   * position and an optional quaternion for rotation. The third takes 3 numbers for the position
   * and an optional 3 numbers for Euler rotation.
   *
   * @param {Vec3|number} x - A 3-dimensional vector holding the new position or the new position
   * x-coordinate.
   * @param {Quat|Vec3|number} [y] - A 3-dimensional vector or quaternion holding the new
   * rotation or the new position y-coordinate.
   * @param {number} [z] - The new position z-coordinate.
   * @param {number} [rx] - The new Euler x-angle value.
   * @param {number} [ry] - The new Euler y-angle value.
   * @param {number} [rz] - The new Euler z-angle value.
   * @example
   * // Teleport the entity to the origin
   * entity.rigidbody.teleport(pc.Vec3.ZERO);
   * @example
   * // Teleport the entity to the origin
   * entity.rigidbody.teleport(0, 0, 0);
   * @example
   * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
   * var position = new pc.Vec3(1, 2, 3);
   * entity.rigidbody.teleport(position, pc.Vec3.ZERO);
   * @example
   * // Teleport the entity to world-space coordinate [1, 2, 3] and reset orientation
   * entity.rigidbody.teleport(1, 2, 3, 0, 0, 0);
   */
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

  /** @ignore */
  onEnable() {
    if (!this._body) {
      this.createBody();
    }
    this.enableSimulation();
  }

  /** @ignore */
  onDisable() {
    this.disableSimulation();
  }
}

export { RigidBodyComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWVRZUEVfU1RBVElDLFxuICAgIEJPRFlHUk9VUF9EWU5BTUlDLCBCT0RZR1JPVVBfS0lORU1BVElDLCBCT0RZR1JPVVBfU1RBVElDLFxuICAgIEJPRFlNQVNLX0FMTCwgQk9EWU1BU0tfTk9UX1NUQVRJQyxcbiAgICBCT0RZU1RBVEVfQUNUSVZFX1RBRywgQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OLCBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OLFxuICAgIEJPRFlUWVBFX0RZTkFNSUMsIEJPRFlUWVBFX0tJTkVNQVRJQ1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vLyBTaGFyZWQgbWF0aCB2YXJpYWJsZSB0byBhdm9pZCBleGNlc3NpdmUgYWxsb2NhdGlvblxubGV0IF9hbW1vVHJhbnNmb3JtO1xubGV0IF9hbW1vVmVjMSwgX2FtbW9WZWMyLCBfYW1tb1F1YXQ7XG5jb25zdCBfcXVhdDEgPSBuZXcgUXVhdCgpO1xuY29uc3QgX3F1YXQyID0gbmV3IFF1YXQoKTtcbmNvbnN0IF92ZWMzID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBUaGUgcmlnaWRib2R5IGNvbXBvbmVudCwgd2hlbiBjb21iaW5lZCB3aXRoIGEge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0sIGFsbG93cyB5b3VyIGVudGl0aWVzXG4gKiB0byBiZSBzaW11bGF0ZWQgdXNpbmcgcmVhbGlzdGljIHBoeXNpY3MuIEEgcmlnaWRib2R5IGNvbXBvbmVudCB3aWxsIGZhbGwgdW5kZXIgZ3Jhdml0eSBhbmRcbiAqIGNvbGxpZGUgd2l0aCBvdGhlciByaWdpZCBib2RpZXMuIFVzaW5nIHNjcmlwdHMsIHlvdSBjYW4gYXBwbHkgZm9yY2VzIGFuZCBpbXB1bHNlcyB0byByaWdpZFxuICogYm9kaWVzLlxuICpcbiAqIFlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0byB1c2UgdGhlIFJpZ2lkQm9keUNvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIFJpZ2lkQm9keUNvbXBvbmVudCB0b1xuICogYSB7QGxpbmsgRW50aXR5fSwgdXNlIHtAbGluayBFbnRpdHkjYWRkQ29tcG9uZW50fTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBDcmVhdGUgYSBzdGF0aWMgMXgxeDEgYm94LXNoYXBlZCByaWdpZCBib2R5XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhICdzdGF0aWMnIGJvZHlcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjb2xsaXNpb25cIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhIDF4MXgxIGJveCBzaGFwZVxuICogYGBgXG4gKlxuICogVG8gY3JlYXRlIGEgZHluYW1pYyBzcGhlcmUgd2l0aCBtYXNzIG9mIDEwLCBkbzpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIiwge1xuICogICAgIHR5cGU6IHBjLkJPRFlUWVBFX0RZTkFNSUMsXG4gKiAgICAgbWFzczogMTBcbiAqIH0pO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcImNvbGxpc2lvblwiLCB7XG4gKiAgICAgdHlwZTogXCJzcGhlcmVcIlxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICpcbiAqIC0gW0ZhbGxpbmcgc2hhcGVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3BoeXNpY3MvZmFsbGluZy1zaGFwZXMpXG4gKiAtIFtWZWhpY2xlIHBoeXNpY3NdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jcGh5c2ljcy92ZWhpY2xlKVxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfYW5ndWxhckRhbXBpbmcgPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2FuZ3VsYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9hbmd1bGFyVmVsb2NpdHkgPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2JvZHkgPSBudWxsO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZyaWN0aW9uID0gMC41O1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJEYW1waW5nID0gMDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJWZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzcyA9IDE7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVzdGl0dXRpb24gPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JvbGxpbmdGcmljdGlvbiA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF90eXBlID0gQk9EWVRZUEVfU1RBVElDO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoaXMgY29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdXNlbGVzcy1jb25zdHJ1Y3RvclxuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjY29udGFjdFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0YXJ0IHRvdWNoaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudCNjb2xsaXNpb25zdGFydFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0b3AgdG91Y2hpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I2NvbGxpc2lvbmVuZFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgc3RvcHBlZCB0b3VjaGluZyB0aGlzIHJpZ2lkIGJvZHkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBlbnRlcnMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmVudGVyXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBlbnRlcmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHJpZ2lkIGJvZHkgZXhpdHMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmxlYXZlXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBleGl0ZWQuXG4gICAgICovXG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIHN0YXRpYyBvbkxpYnJhcnlMb2FkZWQoKSB7XG4gICAgICAgIC8vIExhemlseSBjcmVhdGUgc2hhcmVkIHZhcmlhYmxlXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIF9hbW1vVHJhbnNmb3JtID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIF9hbW1vVmVjMSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgX2FtbW9WZWMyID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBfYW1tb1F1YXQgPSBuZXcgQW1tby5idFF1YXRlcm5pb24oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSByYXRlIGF0IHdoaWNoIGEgYm9keSBsb3NlcyBhbmd1bGFyIHZlbG9jaXR5IG92ZXIgdGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJEYW1waW5nKGRhbXBpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJEYW1waW5nICE9PSBkYW1waW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKHRoaXMuX2xpbmVhckRhbXBpbmcsIGRhbXBpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckRhbXBpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2NhbGluZyBmYWN0b3IgZm9yIGFuZ3VsYXIgbW92ZW1lbnQgb2YgdGhlIGJvZHkgaW4gZWFjaCBheGlzLiBPbmx5IHZhbGlkIGZvciByaWdpZCBib2RpZXMgb2ZcbiAgICAgKiB0eXBlIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfS4gRGVmYXVsdHMgdG8gMSBpbiBhbGwgYXhlcyAoYm9keSBjYW4gZnJlZWx5IHJvdGF0ZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhckZhY3RvcihmYWN0b3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRmFjdG9yLmNvcHkoZmFjdG9yKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShmYWN0b3IueCwgZmFjdG9yLnksIGZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldEFuZ3VsYXJGYWN0b3IoX2FtbW9WZWMxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckZhY3RvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIHRoZSByb3RhdGlvbmFsIHNwZWVkIG9mIHRoZSBib2R5IGFyb3VuZCBlYWNoIHdvcmxkIGF4aXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRBbmd1bGFyVmVsb2NpdHkoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5LmNvcHkodmVsb2NpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldEFuZ3VsYXJWZWxvY2l0eSgpO1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5LnNldCh2ZWxvY2l0eS54KCksIHZlbG9jaXR5LnkoKSwgdmVsb2NpdHkueigpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIHNldCBib2R5KGJvZHkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgIT09IGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkgPSBib2R5O1xuXG4gICAgICAgICAgICBpZiAoYm9keSAmJiB0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBib2R5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYm9keTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJpY3Rpb24gdmFsdWUgdXNlZCB3aGVuIGNvbnRhY3RzIG9jY3VyIGJldHdlZW4gdHdvIGJvZGllcy4gQSBoaWdoZXIgdmFsdWUgaW5kaWNhdGVzXG4gICAgICogbW9yZSBmcmljdGlvbi4gU2hvdWxkIGJlIHNldCBpbiB0aGUgcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byAwLjUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmcmljdGlvbihmcmljdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fZnJpY3Rpb24gIT09IGZyaWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9mcmljdGlvbiA9IGZyaWN0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0RnJpY3Rpb24oZnJpY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZyaWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZnJpY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbGxpc2lvbiBncm91cCB0aGlzIGJvZHkgYmVsb25ncyB0by4gQ29tYmluZSB0aGUgZ3JvdXAgYW5kIHRoZSBtYXNrIHRvIHByZXZlbnQgYm9kaWVzXG4gICAgICogY29sbGlkaW5nIHdpdGggZWFjaCBvdGhlci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGdyb3VwKGdyb3VwKSB7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCAhPT0gZ3JvdXApIHtcbiAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gZ3JvdXA7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZ3JvdXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyB0aGUgcmF0ZSBhdCB3aGljaCBhIGJvZHkgbG9zZXMgbGluZWFyIHZlbG9jaXR5IG92ZXIgdGltZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpbmVhckRhbXBpbmcoZGFtcGluZykge1xuICAgICAgICBpZiAodGhpcy5fbGluZWFyRGFtcGluZyAhPT0gZGFtcGluZykge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKGRhbXBpbmcsIHRoaXMuX2FuZ3VsYXJEYW1waW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRGFtcGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTY2FsaW5nIGZhY3RvciBmb3IgbGluZWFyIG1vdmVtZW50IG9mIHRoZSBib2R5IGluIGVhY2ggYXhpcy4gT25seSB2YWxpZCBmb3IgcmlnaWQgYm9kaWVzIG9mXG4gICAgICogdHlwZSB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ30uIERlZmF1bHRzIHRvIDEgaW4gYWxsIGF4ZXMgKGJvZHkgY2FuIGZyZWVseSBtb3ZlKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIHNldCBsaW5lYXJGYWN0b3IoZmFjdG9yKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGluZWFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJGYWN0b3IuY29weShmYWN0b3IpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGZhY3Rvci54LCBmYWN0b3IueSwgZmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TGluZWFyRmFjdG9yKF9hbW1vVmVjMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRmFjdG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgdGhlIHNwZWVkIG9mIHRoZSBib2R5IGluIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGxpbmVhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRMaW5lYXJWZWxvY2l0eShfYW1tb1ZlYzEpO1xuXG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5jb3B5KHZlbG9jaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldExpbmVhclZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5zZXQodmVsb2NpdHkueCgpLCB2ZWxvY2l0eS55KCksIHZlbG9jaXR5LnooKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xsaXNpb24gbWFzayBzZXRzIHdoaWNoIGdyb3VwcyB0aGlzIGJvZHkgY29sbGlkZXMgd2l0aC4gSXQgaXMgYSBiaXRmaWVsZCBvZiAxNiBiaXRzLFxuICAgICAqIHRoZSBmaXJzdCA4IGJpdHMgYXJlIHJlc2VydmVkIGZvciBlbmdpbmUgdXNlLiBEZWZhdWx0cyB0byA2NTUzNS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hc2sobWFzaykge1xuICAgICAgICBpZiAodGhpcy5fbWFzayAhPT0gbWFzaykge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IG1hc2s7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hc3Mgb2YgdGhlIGJvZHkuIFRoaXMgaXMgb25seSByZWxldmFudCBmb3Ige0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9IGJvZGllcywgb3RoZXIgdHlwZXNcbiAgICAgKiBoYXZlIGluZmluaXRlIG1hc3MuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNzKG1hc3MpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc3MgIT09IG1hc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc3MgPSBtYXNzO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgICAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGVMb2NhbEluZXJ0aWEgd3JpdGVzIGxvY2FsIGluZXJ0aWEgdG8gYW1tb1ZlYzEgaGVyZS4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuZ2V0Q29sbGlzaW9uU2hhcGUoKS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgX2FtbW9WZWMxKTtcbiAgICAgICAgICAgICAgICAvLyAuLi5hbmQgdGhlbiB3cml0ZXMgdGhlIGNhbGN1bGF0ZWQgbG9jYWwgaW5lcnRpYSB0byB0aGUgYm9keVxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TWFzc1Byb3BzKG1hc3MsIF9hbW1vVmVjMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS51cGRhdGVJbmVydGlhVGVuc29yKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5mbHVlbmNlcyB0aGUgYW1vdW50IG9mIGVuZXJneSBsb3N0IHdoZW4gdHdvIHJpZ2lkIGJvZGllcyBjb2xsaWRlLiBUaGUgY2FsY3VsYXRpb25cbiAgICAgKiBtdWx0aXBsaWVzIHRoZSByZXN0aXR1dGlvbiB2YWx1ZXMgZm9yIGJvdGggY29sbGlkaW5nIGJvZGllcy4gQSBtdWx0aXBsaWVkIHZhbHVlIG9mIDAgbWVhbnNcbiAgICAgKiB0aGF0IGFsbCBlbmVyZ3kgaXMgbG9zdCBpbiB0aGUgY29sbGlzaW9uIHdoaWxlIGEgdmFsdWUgb2YgMSBtZWFucyB0aGF0IG5vIGVuZXJneSBpcyBsb3N0LlxuICAgICAqIFNob3VsZCBiZSBzZXQgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlc3RpdHV0aW9uKHJlc3RpdHV0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZXN0aXR1dGlvbiAhPT0gcmVzdGl0dXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc3RpdHV0aW9uID0gcmVzdGl0dXRpb247XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRSZXN0aXR1dGlvbihyZXN0aXR1dGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVzdGl0dXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXN0aXR1dGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgdG9yc2lvbmFsIGZyaWN0aW9uIG9ydGhvZ29uYWwgdG8gdGhlIGNvbnRhY3QgcG9pbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByb2xsaW5nRnJpY3Rpb24oZnJpY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuX3JvbGxpbmdGcmljdGlvbiAhPT0gZnJpY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3JvbGxpbmdGcmljdGlvbiA9IGZyaWN0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKGZyaWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByb2xsaW5nRnJpY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb2xsaW5nRnJpY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJpZ2lkIGJvZHkgdHlwZSBkZXRlcm1pbmVzIGhvdyB0aGUgYm9keSBpcyBzaW11bGF0ZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ306IGluZmluaXRlIG1hc3MgYW5kIGNhbm5vdCBtb3ZlLlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9OiBzaW11bGF0ZWQgYWNjb3JkaW5nIHRvIGFwcGxpZWQgZm9yY2VzLlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ306IGluZmluaXRlIG1hc3MgYW5kIGRvZXMgbm90IHJlc3BvbmQgdG8gZm9yY2VzIChjYW4gb25seSBiZVxuICAgICAqIG1vdmVkIGJ5IHNldHRpbmcgdGhlIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBjb21wb25lbnQncyB7QGxpbmsgRW50aXR5fSkuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodHlwZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gdHlwZSkge1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG5cbiAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcblxuICAgICAgICAgICAgLy8gc2V0IGdyb3VwIGFuZCBtYXNrIHRvIGRlZmF1bHRzIGZvciB0eXBlXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX0RZTkFNSUM6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX0RZTkFNSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19BTEw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9LSU5FTUFUSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19BTEw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBuZXcgYm9keVxuICAgICAgICAgICAgdGhpcy5jcmVhdGVCb2R5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIEVudGl0eSBoYXMgYSBDb2xsaXNpb24gc2hhcGUgYXR0YWNoZWQgdGhlbiBjcmVhdGUgYSByaWdpZCBib2R5IHVzaW5nIHRoaXMgc2hhcGUuIFRoaXNcbiAgICAgKiBtZXRob2QgZGVzdHJveXMgdGhlIGV4aXN0aW5nIGJvZHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNyZWF0ZUJvZHkoKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBsZXQgc2hhcGU7XG5cbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgIHNoYXBlID0gZW50aXR5LmNvbGxpc2lvbi5zaGFwZTtcblxuICAgICAgICAgICAgLy8gaWYgYSB0cmlnZ2VyIHdhcyBhbHJlYWR5IGNyZWF0ZWQgZnJvbSB0aGUgY29sbGlzaW9uIHN5c3RlbVxuICAgICAgICAgICAgLy8gZGVzdHJveSBpdFxuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaGFwZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpXG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ub25SZW1vdmUoZW50aXR5LCB0aGlzKTtcblxuICAgICAgICAgICAgY29uc3QgbWFzcyA9IHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMgPyB0aGlzLl9tYXNzIDogMDtcblxuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuc3lzdGVtLmNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRSZXN0aXR1dGlvbih0aGlzLl9yZXN0aXR1dGlvbik7XG4gICAgICAgICAgICBib2R5LnNldEZyaWN0aW9uKHRoaXMuX2ZyaWN0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKHRoaXMuX3JvbGxpbmdGcmljdGlvbik7XG4gICAgICAgICAgICBib2R5LnNldERhbXBpbmcodGhpcy5fbGluZWFyRGFtcGluZywgdGhpcy5fYW5ndWxhckRhbXBpbmcpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVhckZhY3RvciA9IHRoaXMuX2xpbmVhckZhY3RvcjtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUobGluZWFyRmFjdG9yLngsIGxpbmVhckZhY3Rvci55LCBsaW5lYXJGYWN0b3Iueik7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRMaW5lYXJGYWN0b3IoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJGYWN0b3IgPSB0aGlzLl9hbmd1bGFyRmFjdG9yO1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShhbmd1bGFyRmFjdG9yLngsIGFuZ3VsYXJGYWN0b3IueSwgYW5ndWxhckZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFuZ3VsYXJGYWN0b3IoX2FtbW9WZWMxKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfS0lORU1BVElDKSB7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRDb2xsaXNpb25GbGFncyhib2R5LmdldENvbGxpc2lvbkZsYWdzKCkgfCBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUKTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBib2R5LmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAgICAgdGhpcy5ib2R5ID0gYm9keTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiBlbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIGN1cnJlbnRseSBhY3RpdmVseSBiZWluZyBzaW11bGF0ZWQuIEkuZS4gTm90ICdzbGVlcGluZycuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYm9keSBpcyBhY3RpdmUuXG4gICAgICovXG4gICAgaXNBY3RpdmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ib2R5ID8gdGhpcy5fYm9keS5pc0FjdGl2ZSgpIDogZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yY2libHkgYWN0aXZhdGUgdGhlIHJpZ2lkIGJvZHkgc2ltdWxhdGlvbi4gT25seSBhZmZlY3RzIHJpZ2lkIGJvZGllcyBvZiB0eXBlXG4gICAgICoge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9LlxuICAgICAqL1xuICAgIGFjdGl2YXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgYm9keSB0byB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmFibGVTaW11bGF0aW9uKCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24gJiYgZW50aXR5LmNvbGxpc2lvbi5lbmFibGVkICYmICF0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFkZEJvZHkoYm9keSwgdGhpcy5fZ3JvdXAsIHRoaXMuX21hc2spO1xuXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfRFlOQU1JQzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9keW5hbWljLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9BQ1RJVkVfVEFHKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2tpbmVtYXRpYy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfQUNUSVZFX1RBRyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2NvbXBvdW5kcy5wdXNoKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhIGJvZHkgZnJvbSB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkaXNhYmxlU2ltdWxhdGlvbigpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5ICYmIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcblxuICAgICAgICAgICAgbGV0IGlkeCA9IHN5c3RlbS5fY29tcG91bmRzLmluZGV4T2YodGhpcy5lbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fY29tcG91bmRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZHggPSBzeXN0ZW0uX2R5bmFtaWMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fZHluYW1pYy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWR4ID0gc3lzdGVtLl9raW5lbWF0aWMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fa2luZW1hdGljLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzeXN0ZW0ucmVtb3ZlQm9keShib2R5KTtcblxuICAgICAgICAgICAgLy8gc2V0IGFjdGl2YXRpb24gc3RhdGUgdG8gZGlzYWJsZSBzaW11bGF0aW9uIHRvIGF2b2lkIGJvZHkuaXNBY3RpdmUoKSB0byByZXR1cm5cbiAgICAgICAgICAgIC8vIHRydWUgZXZlbiBpZiBpdCdzIG5vdCBpbiB0aGUgZHluYW1pY3Mgd29ybGRcbiAgICAgICAgICAgIGJvZHkuZm9yY2VBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTik7XG5cbiAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBmb3JjZSB0byB0aGUgYm9keSBhdCBhIHBvaW50LiBCeSBkZWZhdWx0LCB0aGUgZm9yY2UgaXMgYXBwbGllZCBhdCB0aGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIGJvZHkuIEhvd2V2ZXIsIHRoZSBmb3JjZSBjYW4gYmUgYXBwbGllZCBhdCBhbiBvZmZzZXQgdGhpcyBwb2ludCBieSBzcGVjaWZ5aW5nIGEgd29ybGQgc3BhY2VcbiAgICAgKiB2ZWN0b3IgZnJvbSB0aGUgYm9keSdzIG9yaWdpbiB0byB0aGUgcG9pbnQgb2YgYXBwbGljYXRpb24uIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIGZvcmNlIChhbmQgb3B0aW9uYWwgcmVsYXRpdmUgcG9pbnQpIHZpYSAzRC12ZWN0b3Igb3JcbiAgICAgKiBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSByZWxhdGl2ZSBwb2ludFxuICAgICAqIGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHdvcmxkLXNwYWNlIG9yIHRoZSB5LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweF0gLSBUaGUgeC1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweV0gLSBUaGUgeS1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwel0gLSBUaGUgei1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBhcHByb3hpbWF0aW9uIG9mIGdyYXZpdHkgYXQgdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZSgwLCAtMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gYXBwcm94aW1hdGlvbiBvZiBncmF2aXR5IGF0IDEgdW5pdCBkb3duIHRoZSB3b3JsZCBaIGZyb20gdGhlIGNlbnRlciBvZiB0aGUgYm9keVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKDAsIC0xMCwgMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhIGZvcmNlIGF0IHRoZSBib2R5J3MgY2VudGVyXG4gICAgICogLy8gQ2FsY3VsYXRlIGEgZm9yY2UgdmVjdG9yIHBvaW50aW5nIGluIHRoZSB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gb2YgdGhlIGVudGl0eVxuICAgICAqIHZhciBmb3JjZSA9IHRoaXMuZW50aXR5LmZvcndhcmQuY2xvbmUoKS5tdWxTY2FsYXIoMTAwKTtcbiAgICAgKlxuICAgICAqIC8vIEFwcGx5IHRoZSBmb3JjZVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKGZvcmNlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGEgZm9yY2UgYXQgc29tZSByZWxhdGl2ZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIGNlbnRlclxuICAgICAqIC8vIENhbGN1bGF0ZSBhIGZvcmNlIHZlY3RvciBwb2ludGluZyBpbiB0aGUgd29ybGQgc3BhY2UgZGlyZWN0aW9uIG9mIHRoZSBlbnRpdHlcbiAgICAgKiB2YXIgZm9yY2UgPSB0aGlzLmVudGl0eS5mb3J3YXJkLmNsb25lKCkubXVsU2NhbGFyKDEwMCk7XG4gICAgICpcbiAgICAgKiAvLyBDYWxjdWxhdGUgdGhlIHdvcmxkIHNwYWNlIHJlbGF0aXZlIG9mZnNldFxuICAgICAqIHZhciByZWxhdGl2ZVBvcyA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogdmFyIGNoaWxkRW50aXR5ID0gdGhpcy5lbnRpdHkuZmluZEJ5TmFtZSgnRW5naW5lJyk7XG4gICAgICogcmVsYXRpdmVQb3Muc3ViMihjaGlsZEVudGl0eS5nZXRQb3NpdGlvbigpLCB0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpKTtcbiAgICAgKlxuICAgICAqIC8vIEFwcGx5IHRoZSBmb3JjZVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKGZvcmNlLCByZWxhdGl2ZVBvcyk7XG4gICAgICovXG4gICAgYXBwbHlGb3JjZSh4LCB5LCB6LCBweCwgcHksIHB6KSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeC54LCB4LnksIHgueik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKHkueCwgeS55LCB5LnopO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChweCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKHB4LCBweSwgcHopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoMCwgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuYXBwbHlGb3JjZShfYW1tb1ZlYzEsIF9hbW1vVmVjMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSB0b3JxdWUgKHJvdGF0aW9uYWwgZm9yY2UpIHRvIHRoZSBib2R5LiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhblxuICAgICAqIGVpdGhlciBzcGVjaWZ5IHRoZSB0b3JxdWUgZm9yY2Ugd2l0aCBhIDNELXZlY3RvciBvciB3aXRoIDMgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlXG4gICAgICogb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWUodG9ycXVlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSBudW1iZXJzXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZSgwLCAxMCwgMCk7XG4gICAgICovXG4gICAgYXBwbHlUb3JxdWUoeCwgeSwgeikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib2R5LmFwcGx5VG9ycXVlKF9hbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBpbXB1bHNlIChpbnN0YW50YW5lb3VzIGNoYW5nZSBvZiB2ZWxvY2l0eSkgdG8gdGhlIGJvZHkgYXQgYSBwb2ludC4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgaW1wdWxzZSAoYW5kIG9wdGlvbmFsIHJlbGF0aXZlIHBvaW50KVxuICAgICAqIHZpYSAzRC12ZWN0b3Igb3IgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHJlbGF0aXZlIHBvaW50XG4gICAgICogYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkgb3IgdGhlIHktY29tcG9uZW50IG9mIHRoZVxuICAgICAqIGltcHVsc2UgdG8gYXBwbHkgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSB0byBhcHBseSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B4XSAtIFRoZSB4LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCB0aGUgZW50aXR5J3MgcG9zaXRpb24uXG4gICAgICogdmFyIGltcHVsc2UgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoaW1wdWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiB2YXIgaW1wdWxzZSA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB2YXIgcmVsYXRpdmVQb2ludCA9IG5ldyBwYy5WZWMzKDAsIDAsIDEpO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlJbXB1bHNlKGltcHVsc2UsIHJlbGF0aXZlUG9pbnQpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IHRoZSBlbnRpdHkncyBwb3NpdGlvbi5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCwgMCwgMCwgMSk7XG4gICAgICovXG4gICAgYXBwbHlJbXB1bHNlKHgsIHksIHosIHB4LCBweSwgcHopIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LngsIHgueSwgeC56KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoeS54LCB5LnksIHkueik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHB4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUocHgsIHB5LCBweik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMi5zZXRWYWx1ZSgwLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYm9keS5hcHBseUltcHVsc2UoX2FtbW9WZWMxLCBfYW1tb1ZlYzIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYSB0b3JxdWUgaW1wdWxzZSAocm90YXRpb25hbCBmb3JjZSBhcHBsaWVkIGluc3RhbnRhbmVvdXNseSkgdG8gdGhlIGJvZHkuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIHRvcnF1ZSBmb3JjZSB3aXRoIGEgM0QtdmVjdG9yIG9yIHdpdGggM1xuICAgICAqIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHRvcnF1ZSBpbXB1bHNlIGluXG4gICAgICogd29ybGQtc3BhY2Ugb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKHRvcnF1ZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgbnVtYmVyc1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKDAsIDEwLCAwKTtcbiAgICAgKi9cbiAgICBhcHBseVRvcnF1ZUltcHVsc2UoeCwgeSwgeikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKF9hbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgb2YgdHlwZSB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHN0YXRpYy5cbiAgICAgKi9cbiAgICBpc1N0YXRpYygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9TVEFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9IG9yIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3RhdGljIG9yIGtpbmVtYXRpYy5cbiAgICAgKi9cbiAgICBpc1N0YXRpY09yS2luZW1hdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX1NUQVRJQyB8fCB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYga2luZW1hdGljLlxuICAgICAqL1xuICAgIGlzS2luZW1hdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGVzIGFuIGVudGl0eSB0cmFuc2Zvcm0gaW50byBhbiBBbW1vLmJ0VHJhbnNmb3JtIGJ1dCBpZ25vcmluZyBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB0cmFuc2Zvcm0gLSBUaGUgYW1tbyB0cmFuc2Zvcm0gdG8gd3JpdGUgdGhlIGVudGl0eSB0cmFuc2Zvcm0gdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0RW50aXR5VHJhbnNmb3JtKHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcblxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICBjb25zdCBib2R5UG9zID0gY29tcG9uZW50LmdldFNoYXBlUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHlSb3QgPSBjb21wb25lbnQuZ2V0U2hhcGVSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGJvZHlQb3MueCwgYm9keVBvcy55LCBib2R5UG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKGJvZHlSb3QueCwgYm9keVJvdC55LCBib2R5Um90LnosIGJvZHlSb3Qudyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBlbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGVudGl0eS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHBvcy54LCBwb3MueSwgcG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRPcmlnaW4oX2FtbW9WZWMxKTtcbiAgICAgICAgdHJhbnNmb3JtLnNldFJvdGF0aW9uKF9hbW1vUXVhdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByaWdpZCBib2R5IHRyYW5zZm9ybSB0byBiZSB0aGUgc2FtZSBhcyB0aGUgRW50aXR5IHRyYW5zZm9ybS4gVGhpcyBtdXN0IGJlIGNhbGxlZFxuICAgICAqIGFmdGVyIGFueSBFbnRpdHkgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb25zIChlLmcuIHtAbGluayBFbnRpdHkjc2V0UG9zaXRpb259KSBhcmUgY2FsbGVkIGluXG4gICAgICogb3JkZXIgdG8gdXBkYXRlIHRoZSByaWdpZCBib2R5IHRvIG1hdGNoIHRoZSBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHN5bmNFbnRpdHlUb0JvZHkoKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IGJvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbW90aW9uU3RhdGUuc2V0V29ybGRUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYW4gZW50aXR5J3MgdHJhbnNmb3JtIHRvIG1hdGNoIHRoYXQgb2YgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBvZiBhIGR5bmFtaWNcbiAgICAgKiByaWdpZCBib2R5J3MgbW90aW9uIHN0YXRlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlRHluYW1pYygpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuXG4gICAgICAgIC8vIFVwZGF0ZSBtb3Rpb24gc3RhdGUgaWYgYm9keSBpcyBhY3RpdmVcbiAgICAgICAgLy8gb3IgZW50aXR5J3MgdHJhbnNmb3JtIHdhcyBtYW51YWxseSBtb2RpZmllZFxuICAgICAgICBpZiAoYm9keS5pc0FjdGl2ZSgpIHx8IGVudGl0eS5fd2FzRGlydHkpIHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuX3dhc0RpcnR5KSB7XG4gICAgICAgICAgICAgICAgLy8gV2FybiB0aGUgdXNlciBhYm91dCBzZXR0aW5nIHRyYW5zZm9ybSBpbnN0ZWFkIG9mIHVzaW5nIHRlbGVwb3J0IGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgRGVidWcud2FybignQ2Fubm90IHNldCByaWdpZCBib2R5IHRyYW5zZm9ybSBmcm9tIGVudGl0eS4gVXNlIGVudGl0eS5yaWdpZGJvZHkjdGVsZXBvcnQgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBtb3Rpb24gc3RhdGUuIE5vdGUgdGhhdCB0aGUgdGVzdCBmb3IgdGhlIHByZXNlbmNlIG9mIHRoZSBtb3Rpb25cbiAgICAgICAgICAgIC8vIHN0YXRlIGlzIHRlY2huaWNhbGx5IHJlZHVuZGFudCBzaW5jZSB0aGUgZW5naW5lIGNyZWF0ZXMgb25lIGZvciBhbGwgYm9kaWVzLlxuICAgICAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSBib2R5LmdldE1vdGlvblN0YXRlKCk7XG4gICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICBtb3Rpb25TdGF0ZS5nZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwID0gX2FtbW9UcmFuc2Zvcm0uZ2V0T3JpZ2luKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcSA9IF9hbW1vVHJhbnNmb3JtLmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQgJiYgY29tcG9uZW50Ll9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG8gPSBjb21wb25lbnQuZGF0YS5saW5lYXJPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFvID0gY29tcG9uZW50LmRhdGEuYW5ndWxhck9mZnNldDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVbi1yb3RhdGUgdGhlIGFuZ3VsYXIgb2Zmc2V0IGFuZCB0aGVuIHVzZSB0aGUgbmV3IHJvdGF0aW9uIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHVuLXRyYW5zbGF0ZSB0aGUgbGluZWFyIG9mZnNldCBpbiBsb2NhbCBzcGFjZVxuICAgICAgICAgICAgICAgICAgICAvLyBPcmRlciBvZiBvcGVyYXRpb25zIG1hdHRlciBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmVydGVkQW8gPSBfcXVhdDIuY29weShhbykuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eVJvdCA9IF9xdWF0MS5zZXQocS54KCksIHEueSgpLCBxLnooKSwgcS53KCkpLm11bChpbnZlcnRlZEFvKTtcblxuICAgICAgICAgICAgICAgICAgICBlbnRpdHlSb3QudHJhbnNmb3JtVmVjdG9yKGxvLCBfdmVjMyk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zZXRQb3NpdGlvbihwLngoKSAtIF92ZWMzLngsIHAueSgpIC0gX3ZlYzMueSwgcC56KCkgLSBfdmVjMy56KTtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNldFJvdGF0aW9uKGVudGl0eVJvdCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNldFBvc2l0aW9uKHAueCgpLCBwLnkoKSwgcC56KCkpO1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc2V0Um90YXRpb24ocS54KCksIHEueSgpLCBxLnooKSwgcS53KCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVudGl0eS5fd2FzRGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyaXRlcyB0aGUgZW50aXR5J3Mgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4IGludG8gdGhlIG1vdGlvbiBzdGF0ZSBvZiBhIGtpbmVtYXRpYyBib2R5LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlS2luZW1hdGljKCkge1xuICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IHRoaXMuX2JvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgaWYgKG1vdGlvblN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9nZXRFbnRpdHlUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuICAgICAgICAgICAgbW90aW9uU3RhdGUuc2V0V29ybGRUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGVsZXBvcnQgYW4gZW50aXR5IHRvIGEgbmV3IHdvcmxkLXNwYWNlIHBvc2l0aW9uLCBvcHRpb25hbGx5IHNldHRpbmcgb3JpZW50YXRpb24uIFRoaXNcbiAgICAgKiBmdW5jdGlvbiBzaG91bGQgb25seSBiZSBjYWxsZWQgZm9yIHJpZ2lkIGJvZGllcyB0aGF0IGFyZSBkeW5hbWljLiBUaGlzIGZ1bmN0aW9uIGhhcyB0aHJlZVxuICAgICAqIHZhbGlkIHNpZ25hdHVyZXMuIFRoZSBmaXJzdCB0YWtlcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGZvciB0aGUgcG9zaXRpb24gYW5kIGFuIG9wdGlvbmFsXG4gICAgICogMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIEV1bGVyIHJvdGF0aW9uLiBUaGUgc2Vjb25kIHRha2VzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIHRoZVxuICAgICAqIHBvc2l0aW9uIGFuZCBhbiBvcHRpb25hbCBxdWF0ZXJuaW9uIGZvciByb3RhdGlvbi4gVGhlIHRoaXJkIHRha2VzIDMgbnVtYmVycyBmb3IgdGhlIHBvc2l0aW9uXG4gICAgICogYW5kIGFuIG9wdGlvbmFsIDMgbnVtYmVycyBmb3IgRXVsZXIgcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHRoZSBuZXcgcG9zaXRpb24gb3IgdGhlIG5ldyBwb3NpdGlvblxuICAgICAqIHgtY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge1F1YXR8VmVjM3xudW1iZXJ9IFt5XSAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3Igb3IgcXVhdGVybmlvbiBob2xkaW5nIHRoZSBuZXdcbiAgICAgKiByb3RhdGlvbiBvciB0aGUgbmV3IHBvc2l0aW9uIHktY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIG5ldyBwb3NpdGlvbiB6LWNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtyeF0gLSBUaGUgbmV3IEV1bGVyIHgtYW5nbGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtyeV0gLSBUaGUgbmV3IEV1bGVyIHktYW5nbGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtyel0gLSBUaGUgbmV3IEV1bGVyIHotYW5nbGUgdmFsdWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHRoZSBvcmlnaW5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KHBjLlZlYzMuWkVSTyk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHRoZSBvcmlnaW5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KDAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxLCAyLCAzXSBhbmQgcmVzZXQgb3JpZW50YXRpb25cbiAgICAgKiB2YXIgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KHBvc2l0aW9uLCBwYy5WZWMzLlpFUk8pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxLCAyLCAzXSBhbmQgcmVzZXQgb3JpZW50YXRpb25cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KDEsIDIsIDMsIDAsIDAsIDApO1xuICAgICAqL1xuICAgIHRlbGVwb3J0KHgsIHksIHosIHJ4LCByeSwgcnopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbih4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbih5KTtcbiAgICAgICAgfSBlbHNlIGlmICh5IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoeSk7XG4gICAgICAgIH0gZWxzZSBpZiAocnggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMocngsIHJ5LCByeik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQm9keSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIl9hbW1vVHJhbnNmb3JtIiwiX2FtbW9WZWMxIiwiX2FtbW9WZWMyIiwiX2FtbW9RdWF0IiwiX3F1YXQxIiwiUXVhdCIsIl9xdWF0MiIsIl92ZWMzIiwiVmVjMyIsIlJpZ2lkQm9keUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX2FuZ3VsYXJEYW1waW5nIiwiX2FuZ3VsYXJGYWN0b3IiLCJfYW5ndWxhclZlbG9jaXR5IiwiX2JvZHkiLCJfZnJpY3Rpb24iLCJfZ3JvdXAiLCJCT0RZR1JPVVBfU1RBVElDIiwiX2xpbmVhckRhbXBpbmciLCJfbGluZWFyRmFjdG9yIiwiX2xpbmVhclZlbG9jaXR5IiwiX21hc2siLCJCT0RZTUFTS19OT1RfU1RBVElDIiwiX21hc3MiLCJfcmVzdGl0dXRpb24iLCJfcm9sbGluZ0ZyaWN0aW9uIiwiX3NpbXVsYXRpb25FbmFibGVkIiwiX3R5cGUiLCJCT0RZVFlQRV9TVEFUSUMiLCJvbkxpYnJhcnlMb2FkZWQiLCJBbW1vIiwiYnRUcmFuc2Zvcm0iLCJidFZlY3RvcjMiLCJidFF1YXRlcm5pb24iLCJhbmd1bGFyRGFtcGluZyIsImRhbXBpbmciLCJzZXREYW1waW5nIiwiYW5ndWxhckZhY3RvciIsImZhY3RvciIsImVxdWFscyIsImNvcHkiLCJCT0RZVFlQRV9EWU5BTUlDIiwic2V0VmFsdWUiLCJ4IiwieSIsInoiLCJzZXRBbmd1bGFyRmFjdG9yIiwiYW5ndWxhclZlbG9jaXR5IiwidmVsb2NpdHkiLCJhY3RpdmF0ZSIsInNldEFuZ3VsYXJWZWxvY2l0eSIsImdldEFuZ3VsYXJWZWxvY2l0eSIsInNldCIsImJvZHkiLCJmcmljdGlvbiIsInNldEZyaWN0aW9uIiwiZ3JvdXAiLCJlbmFibGVkIiwiZGlzYWJsZVNpbXVsYXRpb24iLCJlbmFibGVTaW11bGF0aW9uIiwibGluZWFyRGFtcGluZyIsImxpbmVhckZhY3RvciIsInNldExpbmVhckZhY3RvciIsImxpbmVhclZlbG9jaXR5Iiwic2V0TGluZWFyVmVsb2NpdHkiLCJnZXRMaW5lYXJWZWxvY2l0eSIsIm1hc2siLCJtYXNzIiwiZ2V0Q29sbGlzaW9uU2hhcGUiLCJjYWxjdWxhdGVMb2NhbEluZXJ0aWEiLCJzZXRNYXNzUHJvcHMiLCJ1cGRhdGVJbmVydGlhVGVuc29yIiwicmVzdGl0dXRpb24iLCJzZXRSZXN0aXR1dGlvbiIsInJvbGxpbmdGcmljdGlvbiIsInNldFJvbGxpbmdGcmljdGlvbiIsInR5cGUiLCJCT0RZR1JPVVBfRFlOQU1JQyIsIkJPRFlNQVNLX0FMTCIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIkJPRFlHUk9VUF9LSU5FTUFUSUMiLCJjcmVhdGVCb2R5Iiwic2hhcGUiLCJjb2xsaXNpb24iLCJ0cmlnZ2VyIiwiZGVzdHJveSIsIm9uUmVtb3ZlIiwiX2dldEVudGl0eVRyYW5zZm9ybSIsInNldENvbGxpc2lvbkZsYWdzIiwiZ2V0Q29sbGlzaW9uRmxhZ3MiLCJCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUIiwic2V0QWN0aXZhdGlvblN0YXRlIiwiQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OIiwiaXNBY3RpdmUiLCJhZGRCb2R5IiwiX2R5bmFtaWMiLCJwdXNoIiwiZm9yY2VBY3RpdmF0aW9uU3RhdGUiLCJCT0RZU1RBVEVfQUNUSVZFX1RBRyIsInN5bmNFbnRpdHlUb0JvZHkiLCJfa2luZW1hdGljIiwiX2NvbXBvdW5kcyIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJyZW1vdmVCb2R5IiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsImFwcGx5Rm9yY2UiLCJweCIsInB5IiwicHoiLCJ1bmRlZmluZWQiLCJhcHBseVRvcnF1ZSIsImFwcGx5SW1wdWxzZSIsImFwcGx5VG9ycXVlSW1wdWxzZSIsImlzU3RhdGljIiwiaXNTdGF0aWNPcktpbmVtYXRpYyIsImlzS2luZW1hdGljIiwidHJhbnNmb3JtIiwiY29tcG9uZW50IiwiYm9keVBvcyIsImdldFNoYXBlUG9zaXRpb24iLCJib2R5Um90IiwiZ2V0U2hhcGVSb3RhdGlvbiIsInciLCJwb3MiLCJnZXRQb3NpdGlvbiIsInJvdCIsImdldFJvdGF0aW9uIiwic2V0T3JpZ2luIiwic2V0Um90YXRpb24iLCJzZXRXb3JsZFRyYW5zZm9ybSIsIm1vdGlvblN0YXRlIiwiZ2V0TW90aW9uU3RhdGUiLCJfdXBkYXRlRHluYW1pYyIsIl93YXNEaXJ0eSIsIkRlYnVnIiwid2FybiIsImdldFdvcmxkVHJhbnNmb3JtIiwicCIsImdldE9yaWdpbiIsInEiLCJfaGFzT2Zmc2V0IiwibG8iLCJkYXRhIiwibGluZWFyT2Zmc2V0IiwiYW8iLCJhbmd1bGFyT2Zmc2V0IiwiaW52ZXJ0ZWRBbyIsImludmVydCIsImVudGl0eVJvdCIsIm11bCIsInRyYW5zZm9ybVZlY3RvciIsInNldFBvc2l0aW9uIiwiX3VwZGF0ZUtpbmVtYXRpYyIsInRlbGVwb3J0IiwicngiLCJyeSIsInJ6Iiwic2V0RXVsZXJBbmdsZXMiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFjQTtBQUNBLElBQUlBLGNBQWMsQ0FBQTtBQUNsQixJQUFJQyxTQUFTLEVBQUVDLFNBQVMsRUFBRUMsU0FBUyxDQUFBO0FBQ25DLE1BQU1DLE1BQU0sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN6QixNQUFNQyxNQUFNLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDekIsTUFBTUUsS0FBSyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUV4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxrQkFBa0IsU0FBU0MsU0FBUyxDQUFDO0FBQ3ZDOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBOztBQUdBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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
