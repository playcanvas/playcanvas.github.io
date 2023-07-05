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
    /** @private */
    this._angularDamping = 0;
    /** @private */
    this._angularFactor = new Vec3(1, 1, 1);
    /** @private */
    this._angularVelocity = new Vec3();
    /** @private */
    this._body = null;
    /** @private */
    this._friction = 0.5;
    /** @private */
    this._group = BODYGROUP_STATIC;
    /** @private */
    this._linearDamping = 0;
    /** @private */
    this._linearFactor = new Vec3(1, 1, 1);
    /** @private */
    this._linearVelocity = new Vec3();
    /** @private */
    this._mask = BODYMASK_NOT_STATIC;
    /** @private */
    this._mass = 1;
    /** @private */
    this._restitution = 0;
    /** @private */
    this._rollingFriction = 0;
    /** @private */
    this._simulationEnabled = false;
    /** @private */
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
   * const force = this.entity.forward.clone().mulScalar(100);
   *
   * // Apply the force
   * this.entity.rigidbody.applyForce(force);
   * @example
   * // Apply a force at some relative offset from the body's center
   * // Calculate a force vector pointing in the world space direction of the entity
   * const force = this.entity.forward.clone().mulScalar(100);
   *
   * // Calculate the world space relative offset
   * const relativePos = new pc.Vec3();
   * const childEntity = this.entity.findByName('Engine');
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
   * const torque = new pc.Vec3(0, 10, 0);
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
   * const impulse = new pc.Vec3(0, 10, 0);
   * entity.rigidbody.applyImpulse(impulse);
   * @example
   * // Apply an impulse along the world-space positive y-axis at 1 unit down the positive
   * // z-axis of the entity's local-space.
   * const impulse = new pc.Vec3(0, 10, 0);
   * const relativePoint = new pc.Vec3(0, 0, 1);
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
   * const torque = new pc.Vec3(0, 10, 0);
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

    // If a dynamic body is frozen, we can assume its motion state transform is
    // the same is the entity world transform
    if (body.isActive()) {
      // Update the motion state. Note that the test for the presence of the motion
      // state is technically redundant since the engine creates one for all bodies.
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
   * const position = new pc.Vec3(1, 2, 3);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWVRZUEVfU1RBVElDLFxuICAgIEJPRFlHUk9VUF9EWU5BTUlDLCBCT0RZR1JPVVBfS0lORU1BVElDLCBCT0RZR1JPVVBfU1RBVElDLFxuICAgIEJPRFlNQVNLX0FMTCwgQk9EWU1BU0tfTk9UX1NUQVRJQyxcbiAgICBCT0RZU1RBVEVfQUNUSVZFX1RBRywgQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OLCBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OLFxuICAgIEJPRFlUWVBFX0RZTkFNSUMsIEJPRFlUWVBFX0tJTkVNQVRJQ1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vLyBTaGFyZWQgbWF0aCB2YXJpYWJsZSB0byBhdm9pZCBleGNlc3NpdmUgYWxsb2NhdGlvblxubGV0IF9hbW1vVHJhbnNmb3JtO1xubGV0IF9hbW1vVmVjMSwgX2FtbW9WZWMyLCBfYW1tb1F1YXQ7XG5jb25zdCBfcXVhdDEgPSBuZXcgUXVhdCgpO1xuY29uc3QgX3F1YXQyID0gbmV3IFF1YXQoKTtcbmNvbnN0IF92ZWMzID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBUaGUgcmlnaWRib2R5IGNvbXBvbmVudCwgd2hlbiBjb21iaW5lZCB3aXRoIGEge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0sIGFsbG93cyB5b3VyIGVudGl0aWVzXG4gKiB0byBiZSBzaW11bGF0ZWQgdXNpbmcgcmVhbGlzdGljIHBoeXNpY3MuIEEgcmlnaWRib2R5IGNvbXBvbmVudCB3aWxsIGZhbGwgdW5kZXIgZ3Jhdml0eSBhbmRcbiAqIGNvbGxpZGUgd2l0aCBvdGhlciByaWdpZCBib2RpZXMuIFVzaW5nIHNjcmlwdHMsIHlvdSBjYW4gYXBwbHkgZm9yY2VzIGFuZCBpbXB1bHNlcyB0byByaWdpZFxuICogYm9kaWVzLlxuICpcbiAqIFlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0byB1c2UgdGhlIFJpZ2lkQm9keUNvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIFJpZ2lkQm9keUNvbXBvbmVudCB0b1xuICogYSB7QGxpbmsgRW50aXR5fSwgdXNlIHtAbGluayBFbnRpdHkjYWRkQ29tcG9uZW50fTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBDcmVhdGUgYSBzdGF0aWMgMXgxeDEgYm94LXNoYXBlZCByaWdpZCBib2R5XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhICdzdGF0aWMnIGJvZHlcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjb2xsaXNpb25cIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhIDF4MXgxIGJveCBzaGFwZVxuICogYGBgXG4gKlxuICogVG8gY3JlYXRlIGEgZHluYW1pYyBzcGhlcmUgd2l0aCBtYXNzIG9mIDEwLCBkbzpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIiwge1xuICogICAgIHR5cGU6IHBjLkJPRFlUWVBFX0RZTkFNSUMsXG4gKiAgICAgbWFzczogMTBcbiAqIH0pO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcImNvbGxpc2lvblwiLCB7XG4gKiAgICAgdHlwZTogXCJzcGhlcmVcIlxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICpcbiAqIC0gW0ZhbGxpbmcgc2hhcGVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3BoeXNpY3MvZmFsbGluZy1zaGFwZXMpXG4gKiAtIFtWZWhpY2xlIHBoeXNpY3NdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jcGh5c2ljcy92ZWhpY2xlKVxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfYW5ndWxhckRhbXBpbmcgPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2FuZ3VsYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9hbmd1bGFyVmVsb2NpdHkgPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2JvZHkgPSBudWxsO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZyaWN0aW9uID0gMC41O1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJEYW1waW5nID0gMDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJWZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzcyA9IDE7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVzdGl0dXRpb24gPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JvbGxpbmdGcmljdGlvbiA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF90eXBlID0gQk9EWVRZUEVfU1RBVElDO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoaXMgY29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdXNlbGVzcy1jb25zdHJ1Y3RvclxuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjY29udGFjdFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0YXJ0IHRvdWNoaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudCNjb2xsaXNpb25zdGFydFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0b3AgdG91Y2hpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I2NvbGxpc2lvbmVuZFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgc3RvcHBlZCB0b3VjaGluZyB0aGlzIHJpZ2lkIGJvZHkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBlbnRlcnMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmVudGVyXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBlbnRlcmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHJpZ2lkIGJvZHkgZXhpdHMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmxlYXZlXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBleGl0ZWQuXG4gICAgICovXG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIHN0YXRpYyBvbkxpYnJhcnlMb2FkZWQoKSB7XG4gICAgICAgIC8vIExhemlseSBjcmVhdGUgc2hhcmVkIHZhcmlhYmxlXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIF9hbW1vVHJhbnNmb3JtID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIF9hbW1vVmVjMSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgX2FtbW9WZWMyID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBfYW1tb1F1YXQgPSBuZXcgQW1tby5idFF1YXRlcm5pb24oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSByYXRlIGF0IHdoaWNoIGEgYm9keSBsb3NlcyBhbmd1bGFyIHZlbG9jaXR5IG92ZXIgdGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJEYW1waW5nKGRhbXBpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJEYW1waW5nICE9PSBkYW1waW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKHRoaXMuX2xpbmVhckRhbXBpbmcsIGRhbXBpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckRhbXBpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2NhbGluZyBmYWN0b3IgZm9yIGFuZ3VsYXIgbW92ZW1lbnQgb2YgdGhlIGJvZHkgaW4gZWFjaCBheGlzLiBPbmx5IHZhbGlkIGZvciByaWdpZCBib2RpZXMgb2ZcbiAgICAgKiB0eXBlIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfS4gRGVmYXVsdHMgdG8gMSBpbiBhbGwgYXhlcyAoYm9keSBjYW4gZnJlZWx5IHJvdGF0ZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhckZhY3RvcihmYWN0b3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRmFjdG9yLmNvcHkoZmFjdG9yKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShmYWN0b3IueCwgZmFjdG9yLnksIGZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldEFuZ3VsYXJGYWN0b3IoX2FtbW9WZWMxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckZhY3RvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIHRoZSByb3RhdGlvbmFsIHNwZWVkIG9mIHRoZSBib2R5IGFyb3VuZCBlYWNoIHdvcmxkIGF4aXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRBbmd1bGFyVmVsb2NpdHkoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5LmNvcHkodmVsb2NpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldEFuZ3VsYXJWZWxvY2l0eSgpO1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5LnNldCh2ZWxvY2l0eS54KCksIHZlbG9jaXR5LnkoKSwgdmVsb2NpdHkueigpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIHNldCBib2R5KGJvZHkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgIT09IGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkgPSBib2R5O1xuXG4gICAgICAgICAgICBpZiAoYm9keSAmJiB0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBib2R5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYm9keTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJpY3Rpb24gdmFsdWUgdXNlZCB3aGVuIGNvbnRhY3RzIG9jY3VyIGJldHdlZW4gdHdvIGJvZGllcy4gQSBoaWdoZXIgdmFsdWUgaW5kaWNhdGVzXG4gICAgICogbW9yZSBmcmljdGlvbi4gU2hvdWxkIGJlIHNldCBpbiB0aGUgcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byAwLjUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmcmljdGlvbihmcmljdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fZnJpY3Rpb24gIT09IGZyaWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9mcmljdGlvbiA9IGZyaWN0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0RnJpY3Rpb24oZnJpY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZyaWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZnJpY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbGxpc2lvbiBncm91cCB0aGlzIGJvZHkgYmVsb25ncyB0by4gQ29tYmluZSB0aGUgZ3JvdXAgYW5kIHRoZSBtYXNrIHRvIHByZXZlbnQgYm9kaWVzXG4gICAgICogY29sbGlkaW5nIHdpdGggZWFjaCBvdGhlci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGdyb3VwKGdyb3VwKSB7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCAhPT0gZ3JvdXApIHtcbiAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gZ3JvdXA7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZ3JvdXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyB0aGUgcmF0ZSBhdCB3aGljaCBhIGJvZHkgbG9zZXMgbGluZWFyIHZlbG9jaXR5IG92ZXIgdGltZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpbmVhckRhbXBpbmcoZGFtcGluZykge1xuICAgICAgICBpZiAodGhpcy5fbGluZWFyRGFtcGluZyAhPT0gZGFtcGluZykge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKGRhbXBpbmcsIHRoaXMuX2FuZ3VsYXJEYW1waW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRGFtcGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTY2FsaW5nIGZhY3RvciBmb3IgbGluZWFyIG1vdmVtZW50IG9mIHRoZSBib2R5IGluIGVhY2ggYXhpcy4gT25seSB2YWxpZCBmb3IgcmlnaWQgYm9kaWVzIG9mXG4gICAgICogdHlwZSB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ30uIERlZmF1bHRzIHRvIDEgaW4gYWxsIGF4ZXMgKGJvZHkgY2FuIGZyZWVseSBtb3ZlKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIHNldCBsaW5lYXJGYWN0b3IoZmFjdG9yKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGluZWFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJGYWN0b3IuY29weShmYWN0b3IpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGZhY3Rvci54LCBmYWN0b3IueSwgZmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TGluZWFyRmFjdG9yKF9hbW1vVmVjMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRmFjdG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgdGhlIHNwZWVkIG9mIHRoZSBib2R5IGluIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGxpbmVhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRMaW5lYXJWZWxvY2l0eShfYW1tb1ZlYzEpO1xuXG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5jb3B5KHZlbG9jaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldExpbmVhclZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5zZXQodmVsb2NpdHkueCgpLCB2ZWxvY2l0eS55KCksIHZlbG9jaXR5LnooKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xsaXNpb24gbWFzayBzZXRzIHdoaWNoIGdyb3VwcyB0aGlzIGJvZHkgY29sbGlkZXMgd2l0aC4gSXQgaXMgYSBiaXRmaWVsZCBvZiAxNiBiaXRzLFxuICAgICAqIHRoZSBmaXJzdCA4IGJpdHMgYXJlIHJlc2VydmVkIGZvciBlbmdpbmUgdXNlLiBEZWZhdWx0cyB0byA2NTUzNS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hc2sobWFzaykge1xuICAgICAgICBpZiAodGhpcy5fbWFzayAhPT0gbWFzaykge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IG1hc2s7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hc3Mgb2YgdGhlIGJvZHkuIFRoaXMgaXMgb25seSByZWxldmFudCBmb3Ige0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9IGJvZGllcywgb3RoZXIgdHlwZXNcbiAgICAgKiBoYXZlIGluZmluaXRlIG1hc3MuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNzKG1hc3MpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc3MgIT09IG1hc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc3MgPSBtYXNzO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgICAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGVMb2NhbEluZXJ0aWEgd3JpdGVzIGxvY2FsIGluZXJ0aWEgdG8gYW1tb1ZlYzEgaGVyZS4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuZ2V0Q29sbGlzaW9uU2hhcGUoKS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgX2FtbW9WZWMxKTtcbiAgICAgICAgICAgICAgICAvLyAuLi5hbmQgdGhlbiB3cml0ZXMgdGhlIGNhbGN1bGF0ZWQgbG9jYWwgaW5lcnRpYSB0byB0aGUgYm9keVxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TWFzc1Byb3BzKG1hc3MsIF9hbW1vVmVjMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS51cGRhdGVJbmVydGlhVGVuc29yKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5mbHVlbmNlcyB0aGUgYW1vdW50IG9mIGVuZXJneSBsb3N0IHdoZW4gdHdvIHJpZ2lkIGJvZGllcyBjb2xsaWRlLiBUaGUgY2FsY3VsYXRpb25cbiAgICAgKiBtdWx0aXBsaWVzIHRoZSByZXN0aXR1dGlvbiB2YWx1ZXMgZm9yIGJvdGggY29sbGlkaW5nIGJvZGllcy4gQSBtdWx0aXBsaWVkIHZhbHVlIG9mIDAgbWVhbnNcbiAgICAgKiB0aGF0IGFsbCBlbmVyZ3kgaXMgbG9zdCBpbiB0aGUgY29sbGlzaW9uIHdoaWxlIGEgdmFsdWUgb2YgMSBtZWFucyB0aGF0IG5vIGVuZXJneSBpcyBsb3N0LlxuICAgICAqIFNob3VsZCBiZSBzZXQgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlc3RpdHV0aW9uKHJlc3RpdHV0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZXN0aXR1dGlvbiAhPT0gcmVzdGl0dXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc3RpdHV0aW9uID0gcmVzdGl0dXRpb247XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRSZXN0aXR1dGlvbihyZXN0aXR1dGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVzdGl0dXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXN0aXR1dGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgdG9yc2lvbmFsIGZyaWN0aW9uIG9ydGhvZ29uYWwgdG8gdGhlIGNvbnRhY3QgcG9pbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByb2xsaW5nRnJpY3Rpb24oZnJpY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuX3JvbGxpbmdGcmljdGlvbiAhPT0gZnJpY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3JvbGxpbmdGcmljdGlvbiA9IGZyaWN0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKGZyaWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByb2xsaW5nRnJpY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb2xsaW5nRnJpY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJpZ2lkIGJvZHkgdHlwZSBkZXRlcm1pbmVzIGhvdyB0aGUgYm9keSBpcyBzaW11bGF0ZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ306IGluZmluaXRlIG1hc3MgYW5kIGNhbm5vdCBtb3ZlLlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9OiBzaW11bGF0ZWQgYWNjb3JkaW5nIHRvIGFwcGxpZWQgZm9yY2VzLlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ306IGluZmluaXRlIG1hc3MgYW5kIGRvZXMgbm90IHJlc3BvbmQgdG8gZm9yY2VzIChjYW4gb25seSBiZVxuICAgICAqIG1vdmVkIGJ5IHNldHRpbmcgdGhlIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBjb21wb25lbnQncyB7QGxpbmsgRW50aXR5fSkuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodHlwZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gdHlwZSkge1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG5cbiAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcblxuICAgICAgICAgICAgLy8gc2V0IGdyb3VwIGFuZCBtYXNrIHRvIGRlZmF1bHRzIGZvciB0eXBlXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX0RZTkFNSUM6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX0RZTkFNSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19BTEw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9LSU5FTUFUSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19BTEw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBuZXcgYm9keVxuICAgICAgICAgICAgdGhpcy5jcmVhdGVCb2R5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIEVudGl0eSBoYXMgYSBDb2xsaXNpb24gc2hhcGUgYXR0YWNoZWQgdGhlbiBjcmVhdGUgYSByaWdpZCBib2R5IHVzaW5nIHRoaXMgc2hhcGUuIFRoaXNcbiAgICAgKiBtZXRob2QgZGVzdHJveXMgdGhlIGV4aXN0aW5nIGJvZHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNyZWF0ZUJvZHkoKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBsZXQgc2hhcGU7XG5cbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgIHNoYXBlID0gZW50aXR5LmNvbGxpc2lvbi5zaGFwZTtcblxuICAgICAgICAgICAgLy8gaWYgYSB0cmlnZ2VyIHdhcyBhbHJlYWR5IGNyZWF0ZWQgZnJvbSB0aGUgY29sbGlzaW9uIHN5c3RlbVxuICAgICAgICAgICAgLy8gZGVzdHJveSBpdFxuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaGFwZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpXG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ub25SZW1vdmUoZW50aXR5LCB0aGlzKTtcblxuICAgICAgICAgICAgY29uc3QgbWFzcyA9IHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMgPyB0aGlzLl9tYXNzIDogMDtcblxuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuc3lzdGVtLmNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRSZXN0aXR1dGlvbih0aGlzLl9yZXN0aXR1dGlvbik7XG4gICAgICAgICAgICBib2R5LnNldEZyaWN0aW9uKHRoaXMuX2ZyaWN0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKHRoaXMuX3JvbGxpbmdGcmljdGlvbik7XG4gICAgICAgICAgICBib2R5LnNldERhbXBpbmcodGhpcy5fbGluZWFyRGFtcGluZywgdGhpcy5fYW5ndWxhckRhbXBpbmcpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVhckZhY3RvciA9IHRoaXMuX2xpbmVhckZhY3RvcjtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUobGluZWFyRmFjdG9yLngsIGxpbmVhckZhY3Rvci55LCBsaW5lYXJGYWN0b3Iueik7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRMaW5lYXJGYWN0b3IoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJGYWN0b3IgPSB0aGlzLl9hbmd1bGFyRmFjdG9yO1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShhbmd1bGFyRmFjdG9yLngsIGFuZ3VsYXJGYWN0b3IueSwgYW5ndWxhckZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFuZ3VsYXJGYWN0b3IoX2FtbW9WZWMxKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfS0lORU1BVElDKSB7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRDb2xsaXNpb25GbGFncyhib2R5LmdldENvbGxpc2lvbkZsYWdzKCkgfCBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUKTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBib2R5LmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAgICAgdGhpcy5ib2R5ID0gYm9keTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiBlbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIGN1cnJlbnRseSBhY3RpdmVseSBiZWluZyBzaW11bGF0ZWQuIEkuZS4gTm90ICdzbGVlcGluZycuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYm9keSBpcyBhY3RpdmUuXG4gICAgICovXG4gICAgaXNBY3RpdmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ib2R5ID8gdGhpcy5fYm9keS5pc0FjdGl2ZSgpIDogZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yY2libHkgYWN0aXZhdGUgdGhlIHJpZ2lkIGJvZHkgc2ltdWxhdGlvbi4gT25seSBhZmZlY3RzIHJpZ2lkIGJvZGllcyBvZiB0eXBlXG4gICAgICoge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9LlxuICAgICAqL1xuICAgIGFjdGl2YXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgYm9keSB0byB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmFibGVTaW11bGF0aW9uKCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24gJiYgZW50aXR5LmNvbGxpc2lvbi5lbmFibGVkICYmICF0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFkZEJvZHkoYm9keSwgdGhpcy5fZ3JvdXAsIHRoaXMuX21hc2spO1xuXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfRFlOQU1JQzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9keW5hbWljLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9BQ1RJVkVfVEFHKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2tpbmVtYXRpYy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfQUNUSVZFX1RBRyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2NvbXBvdW5kcy5wdXNoKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhIGJvZHkgZnJvbSB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkaXNhYmxlU2ltdWxhdGlvbigpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5ICYmIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcblxuICAgICAgICAgICAgbGV0IGlkeCA9IHN5c3RlbS5fY29tcG91bmRzLmluZGV4T2YodGhpcy5lbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fY29tcG91bmRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZHggPSBzeXN0ZW0uX2R5bmFtaWMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fZHluYW1pYy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWR4ID0gc3lzdGVtLl9raW5lbWF0aWMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fa2luZW1hdGljLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzeXN0ZW0ucmVtb3ZlQm9keShib2R5KTtcblxuICAgICAgICAgICAgLy8gc2V0IGFjdGl2YXRpb24gc3RhdGUgdG8gZGlzYWJsZSBzaW11bGF0aW9uIHRvIGF2b2lkIGJvZHkuaXNBY3RpdmUoKSB0byByZXR1cm5cbiAgICAgICAgICAgIC8vIHRydWUgZXZlbiBpZiBpdCdzIG5vdCBpbiB0aGUgZHluYW1pY3Mgd29ybGRcbiAgICAgICAgICAgIGJvZHkuZm9yY2VBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTik7XG5cbiAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBmb3JjZSB0byB0aGUgYm9keSBhdCBhIHBvaW50LiBCeSBkZWZhdWx0LCB0aGUgZm9yY2UgaXMgYXBwbGllZCBhdCB0aGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIGJvZHkuIEhvd2V2ZXIsIHRoZSBmb3JjZSBjYW4gYmUgYXBwbGllZCBhdCBhbiBvZmZzZXQgdGhpcyBwb2ludCBieSBzcGVjaWZ5aW5nIGEgd29ybGQgc3BhY2VcbiAgICAgKiB2ZWN0b3IgZnJvbSB0aGUgYm9keSdzIG9yaWdpbiB0byB0aGUgcG9pbnQgb2YgYXBwbGljYXRpb24uIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIGZvcmNlIChhbmQgb3B0aW9uYWwgcmVsYXRpdmUgcG9pbnQpIHZpYSAzRC12ZWN0b3Igb3JcbiAgICAgKiBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSByZWxhdGl2ZSBwb2ludFxuICAgICAqIGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHdvcmxkLXNwYWNlIG9yIHRoZSB5LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweF0gLSBUaGUgeC1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweV0gLSBUaGUgeS1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwel0gLSBUaGUgei1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBhcHByb3hpbWF0aW9uIG9mIGdyYXZpdHkgYXQgdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZSgwLCAtMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gYXBwcm94aW1hdGlvbiBvZiBncmF2aXR5IGF0IDEgdW5pdCBkb3duIHRoZSB3b3JsZCBaIGZyb20gdGhlIGNlbnRlciBvZiB0aGUgYm9keVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKDAsIC0xMCwgMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhIGZvcmNlIGF0IHRoZSBib2R5J3MgY2VudGVyXG4gICAgICogLy8gQ2FsY3VsYXRlIGEgZm9yY2UgdmVjdG9yIHBvaW50aW5nIGluIHRoZSB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gb2YgdGhlIGVudGl0eVxuICAgICAqIGNvbnN0IGZvcmNlID0gdGhpcy5lbnRpdHkuZm9yd2FyZC5jbG9uZSgpLm11bFNjYWxhcigxMDApO1xuICAgICAqXG4gICAgICogLy8gQXBwbHkgdGhlIGZvcmNlXG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoZm9yY2UpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYSBmb3JjZSBhdCBzb21lIHJlbGF0aXZlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgY2VudGVyXG4gICAgICogLy8gQ2FsY3VsYXRlIGEgZm9yY2UgdmVjdG9yIHBvaW50aW5nIGluIHRoZSB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gb2YgdGhlIGVudGl0eVxuICAgICAqIGNvbnN0IGZvcmNlID0gdGhpcy5lbnRpdHkuZm9yd2FyZC5jbG9uZSgpLm11bFNjYWxhcigxMDApO1xuICAgICAqXG4gICAgICogLy8gQ2FsY3VsYXRlIHRoZSB3b3JsZCBzcGFjZSByZWxhdGl2ZSBvZmZzZXRcbiAgICAgKiBjb25zdCByZWxhdGl2ZVBvcyA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogY29uc3QgY2hpbGRFbnRpdHkgPSB0aGlzLmVudGl0eS5maW5kQnlOYW1lKCdFbmdpbmUnKTtcbiAgICAgKiByZWxhdGl2ZVBvcy5zdWIyKGNoaWxkRW50aXR5LmdldFBvc2l0aW9uKCksIHRoaXMuZW50aXR5LmdldFBvc2l0aW9uKCkpO1xuICAgICAqXG4gICAgICogLy8gQXBwbHkgdGhlIGZvcmNlXG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoZm9yY2UsIHJlbGF0aXZlUG9zKTtcbiAgICAgKi9cbiAgICBhcHBseUZvcmNlKHgsIHksIHosIHB4LCBweSwgcHopIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LngsIHgueSwgeC56KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoeS54LCB5LnksIHkueik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHB4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUocHgsIHB5LCBweik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMi5zZXRWYWx1ZSgwLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYm9keS5hcHBseUZvcmNlKF9hbW1vVmVjMSwgX2FtbW9WZWMyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IHRvcnF1ZSAocm90YXRpb25hbCBmb3JjZSkgdG8gdGhlIGJvZHkuIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzLiBZb3UgY2FuXG4gICAgICogZWl0aGVyIHNwZWNpZnkgdGhlIHRvcnF1ZSBmb3JjZSB3aXRoIGEgM0QtdmVjdG9yIG9yIHdpdGggMyBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2VcbiAgICAgKiBvciB0aGUgeC1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgdmlhIHZlY3RvclxuICAgICAqIGNvbnN0IHRvcnF1ZSA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5VG9ycXVlKHRvcnF1ZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgbnVtYmVyc1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWUoMCwgMTAsIDApO1xuICAgICAqL1xuICAgIGFwcGx5VG9ycXVlKHgsIHksIHopIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LngsIHgueSwgeC56KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYm9keS5hcHBseVRvcnF1ZShfYW1tb1ZlYzEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW4gaW1wdWxzZSAoaW5zdGFudGFuZW91cyBjaGFuZ2Ugb2YgdmVsb2NpdHkpIHRvIHRoZSBib2R5IGF0IGEgcG9pbnQuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIGltcHVsc2UgKGFuZCBvcHRpb25hbCByZWxhdGl2ZSBwb2ludClcbiAgICAgKiB2aWEgM0QtdmVjdG9yIG9yIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIGltcHVsc2UgaW4gd29ybGQtc3BhY2Ugb3JcbiAgICAgKiB0aGUgeC1jb21wb25lbnQgb2YgdGhlIGltcHVsc2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSByZWxhdGl2ZSBwb2ludFxuICAgICAqIGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZSBsb2NhbC1zcGFjZSBvZiB0aGUgZW50aXR5IG9yIHRoZSB5LWNvbXBvbmVudCBvZiB0aGVcbiAgICAgKiBpbXB1bHNlIHRvIGFwcGx5IGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIGltcHVsc2UgdG8gYXBwbHkgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweF0gLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHBvaW50IGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweV0gLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHBvaW50IGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHBvaW50IGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgdGhlIGVudGl0eSdzIHBvc2l0aW9uLlxuICAgICAqIGNvbnN0IGltcHVsc2UgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoaW1wdWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiBjb25zdCBpbXB1bHNlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGNvbnN0IHJlbGF0aXZlUG9pbnQgPSBuZXcgcGMuVmVjMygwLCAwLCAxKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZShpbXB1bHNlLCByZWxhdGl2ZVBvaW50KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCB0aGUgZW50aXR5J3MgcG9zaXRpb24uXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoMCwgMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IDEgdW5pdCBkb3duIHRoZSBwb3NpdGl2ZVxuICAgICAqIC8vIHotYXhpcyBvZiB0aGUgZW50aXR5J3MgbG9jYWwtc3BhY2UuXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoMCwgMTAsIDAsIDAsIDAsIDEpO1xuICAgICAqL1xuICAgIGFwcGx5SW1wdWxzZSh4LCB5LCB6LCBweCwgcHksIHB6KSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeC54LCB4LnksIHgueik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKHkueCwgeS55LCB5LnopO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChweCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKHB4LCBweSwgcHopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoMCwgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuYXBwbHlJbXB1bHNlKF9hbW1vVmVjMSwgX2FtbW9WZWMyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IGEgdG9ycXVlIGltcHVsc2UgKHJvdGF0aW9uYWwgZm9yY2UgYXBwbGllZCBpbnN0YW50YW5lb3VzbHkpIHRvIHRoZSBib2R5LiBUaGlzIGZ1bmN0aW9uXG4gICAgICogaGFzIHR3byB2YWxpZCBzaWduYXR1cmVzLiBZb3UgY2FuIGVpdGhlciBzcGVjaWZ5IHRoZSB0b3JxdWUgZm9yY2Ugd2l0aCBhIDNELXZlY3RvciBvciB3aXRoIDNcbiAgICAgKiBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSB0b3JxdWUgaW1wdWxzZSBpblxuICAgICAqIHdvcmxkLXNwYWNlIG9yIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGltcHVsc2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGltcHVsc2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGltcHVsc2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgdmVjdG9yXG4gICAgICogY29uc3QgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKHRvcnF1ZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgbnVtYmVyc1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKDAsIDEwLCAwKTtcbiAgICAgKi9cbiAgICBhcHBseVRvcnF1ZUltcHVsc2UoeCwgeSwgeikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKF9hbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgb2YgdHlwZSB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHN0YXRpYy5cbiAgICAgKi9cbiAgICBpc1N0YXRpYygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9TVEFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9IG9yIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3RhdGljIG9yIGtpbmVtYXRpYy5cbiAgICAgKi9cbiAgICBpc1N0YXRpY09yS2luZW1hdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX1NUQVRJQyB8fCB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYga2luZW1hdGljLlxuICAgICAqL1xuICAgIGlzS2luZW1hdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGVzIGFuIGVudGl0eSB0cmFuc2Zvcm0gaW50byBhbiBBbW1vLmJ0VHJhbnNmb3JtIGJ1dCBpZ25vcmluZyBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB0cmFuc2Zvcm0gLSBUaGUgYW1tbyB0cmFuc2Zvcm0gdG8gd3JpdGUgdGhlIGVudGl0eSB0cmFuc2Zvcm0gdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0RW50aXR5VHJhbnNmb3JtKHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcblxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICBjb25zdCBib2R5UG9zID0gY29tcG9uZW50LmdldFNoYXBlUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHlSb3QgPSBjb21wb25lbnQuZ2V0U2hhcGVSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGJvZHlQb3MueCwgYm9keVBvcy55LCBib2R5UG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKGJvZHlSb3QueCwgYm9keVJvdC55LCBib2R5Um90LnosIGJvZHlSb3Qudyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBlbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGVudGl0eS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHBvcy54LCBwb3MueSwgcG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRPcmlnaW4oX2FtbW9WZWMxKTtcbiAgICAgICAgdHJhbnNmb3JtLnNldFJvdGF0aW9uKF9hbW1vUXVhdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByaWdpZCBib2R5IHRyYW5zZm9ybSB0byBiZSB0aGUgc2FtZSBhcyB0aGUgRW50aXR5IHRyYW5zZm9ybS4gVGhpcyBtdXN0IGJlIGNhbGxlZFxuICAgICAqIGFmdGVyIGFueSBFbnRpdHkgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb25zIChlLmcuIHtAbGluayBFbnRpdHkjc2V0UG9zaXRpb259KSBhcmUgY2FsbGVkIGluXG4gICAgICogb3JkZXIgdG8gdXBkYXRlIHRoZSByaWdpZCBib2R5IHRvIG1hdGNoIHRoZSBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHN5bmNFbnRpdHlUb0JvZHkoKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IGJvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbW90aW9uU3RhdGUuc2V0V29ybGRUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYW4gZW50aXR5J3MgdHJhbnNmb3JtIHRvIG1hdGNoIHRoYXQgb2YgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBvZiBhIGR5bmFtaWNcbiAgICAgKiByaWdpZCBib2R5J3MgbW90aW9uIHN0YXRlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlRHluYW1pYygpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG5cbiAgICAgICAgLy8gSWYgYSBkeW5hbWljIGJvZHkgaXMgZnJvemVuLCB3ZSBjYW4gYXNzdW1lIGl0cyBtb3Rpb24gc3RhdGUgdHJhbnNmb3JtIGlzXG4gICAgICAgIC8vIHRoZSBzYW1lIGlzIHRoZSBlbnRpdHkgd29ybGQgdHJhbnNmb3JtXG4gICAgICAgIGlmIChib2R5LmlzQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbW90aW9uIHN0YXRlLiBOb3RlIHRoYXQgdGhlIHRlc3QgZm9yIHRoZSBwcmVzZW5jZSBvZiB0aGUgbW90aW9uXG4gICAgICAgICAgICAvLyBzdGF0ZSBpcyB0ZWNobmljYWxseSByZWR1bmRhbnQgc2luY2UgdGhlIGVuZ2luZSBjcmVhdGVzIG9uZSBmb3IgYWxsIGJvZGllcy5cbiAgICAgICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICAgICAgaWYgKG1vdGlvblN0YXRlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5lbnRpdHk7XG5cbiAgICAgICAgICAgICAgICBtb3Rpb25TdGF0ZS5nZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwID0gX2FtbW9UcmFuc2Zvcm0uZ2V0T3JpZ2luKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcSA9IF9hbW1vVHJhbnNmb3JtLmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQgJiYgY29tcG9uZW50Ll9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG8gPSBjb21wb25lbnQuZGF0YS5saW5lYXJPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFvID0gY29tcG9uZW50LmRhdGEuYW5ndWxhck9mZnNldDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVbi1yb3RhdGUgdGhlIGFuZ3VsYXIgb2Zmc2V0IGFuZCB0aGVuIHVzZSB0aGUgbmV3IHJvdGF0aW9uIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHVuLXRyYW5zbGF0ZSB0aGUgbGluZWFyIG9mZnNldCBpbiBsb2NhbCBzcGFjZVxuICAgICAgICAgICAgICAgICAgICAvLyBPcmRlciBvZiBvcGVyYXRpb25zIG1hdHRlciBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmVydGVkQW8gPSBfcXVhdDIuY29weShhbykuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eVJvdCA9IF9xdWF0MS5zZXQocS54KCksIHEueSgpLCBxLnooKSwgcS53KCkpLm11bChpbnZlcnRlZEFvKTtcblxuICAgICAgICAgICAgICAgICAgICBlbnRpdHlSb3QudHJhbnNmb3JtVmVjdG9yKGxvLCBfdmVjMyk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zZXRQb3NpdGlvbihwLngoKSAtIF92ZWMzLngsIHAueSgpIC0gX3ZlYzMueSwgcC56KCkgLSBfdmVjMy56KTtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNldFJvdGF0aW9uKGVudGl0eVJvdCk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc2V0UG9zaXRpb24ocC54KCksIHAueSgpLCBwLnooKSk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zZXRSb3RhdGlvbihxLngoKSwgcS55KCksIHEueigpLCBxLncoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGVzIHRoZSBlbnRpdHkncyB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggaW50byB0aGUgbW90aW9uIHN0YXRlIG9mIGEga2luZW1hdGljIGJvZHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVLaW5lbWF0aWMoKSB7XG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gdGhpcy5fYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2dldEVudGl0eVRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgICAgICBtb3Rpb25TdGF0ZS5zZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZWxlcG9ydCBhbiBlbnRpdHkgdG8gYSBuZXcgd29ybGQtc3BhY2UgcG9zaXRpb24sIG9wdGlvbmFsbHkgc2V0dGluZyBvcmllbnRhdGlvbi4gVGhpc1xuICAgICAqIGZ1bmN0aW9uIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmb3IgcmlnaWQgYm9kaWVzIHRoYXQgYXJlIGR5bmFtaWMuIFRoaXMgZnVuY3Rpb24gaGFzIHRocmVlXG4gICAgICogdmFsaWQgc2lnbmF0dXJlcy4gVGhlIGZpcnN0IHRha2VzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIHRoZSBwb3NpdGlvbiBhbmQgYW4gb3B0aW9uYWxcbiAgICAgKiAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgRXVsZXIgcm90YXRpb24uIFRoZSBzZWNvbmQgdGFrZXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgdGhlXG4gICAgICogcG9zaXRpb24gYW5kIGFuIG9wdGlvbmFsIHF1YXRlcm5pb24gZm9yIHJvdGF0aW9uLiBUaGUgdGhpcmQgdGFrZXMgMyBudW1iZXJzIGZvciB0aGUgcG9zaXRpb25cbiAgICAgKiBhbmQgYW4gb3B0aW9uYWwgMyBudW1iZXJzIGZvciBFdWxlciByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIG5ldyBwb3NpdGlvbiBvciB0aGUgbmV3IHBvc2l0aW9uXG4gICAgICogeC1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7UXVhdHxWZWMzfG51bWJlcn0gW3ldIC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciBvciBxdWF0ZXJuaW9uIGhvbGRpbmcgdGhlIG5ld1xuICAgICAqIHJvdGF0aW9uIG9yIHRoZSBuZXcgcG9zaXRpb24geS1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgbmV3IHBvc2l0aW9uIHotY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3J4XSAtIFRoZSBuZXcgRXVsZXIgeC1hbmdsZSB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3J5XSAtIFRoZSBuZXcgRXVsZXIgeS1hbmdsZSB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3J6XSAtIFRoZSBuZXcgRXVsZXIgei1hbmdsZSB2YWx1ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gdGhlIG9yaWdpblxuICAgICAqIGVudGl0eS5yaWdpZGJvZHkudGVsZXBvcnQocGMuVmVjMy5aRVJPKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gdGhlIG9yaWdpblxuICAgICAqIGVudGl0eS5yaWdpZGJvZHkudGVsZXBvcnQoMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgWzEsIDIsIDNdIGFuZCByZXNldCBvcmllbnRhdGlvblxuICAgICAqIGNvbnN0IHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydChwb3NpdGlvbiwgcGMuVmVjMy5aRVJPKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBbMSwgMiwgM10gYW5kIHJlc2V0IG9yaWVudGF0aW9uXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydCgxLCAyLCAzLCAwLCAwLCAwKTtcbiAgICAgKi9cbiAgICB0ZWxlcG9ydCh4LCB5LCB6LCByeCwgcnksIHJ6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24oeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbih4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh5IGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0Um90YXRpb24oeSk7XG4gICAgICAgIH0gZWxzZSBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKHkpO1xuICAgICAgICB9IGVsc2UgaWYgKHJ4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKHJ4LCByeSwgcnopO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeW5jRW50aXR5VG9Cb2R5KCk7XG4gICAgfVxuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUJvZHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgIH1cblxuICAgIC8qKiBAaWdub3JlICovXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJfYW1tb1RyYW5zZm9ybSIsIl9hbW1vVmVjMSIsIl9hbW1vVmVjMiIsIl9hbW1vUXVhdCIsIl9xdWF0MSIsIlF1YXQiLCJfcXVhdDIiLCJfdmVjMyIsIlZlYzMiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9hbmd1bGFyRGFtcGluZyIsIl9hbmd1bGFyRmFjdG9yIiwiX2FuZ3VsYXJWZWxvY2l0eSIsIl9ib2R5IiwiX2ZyaWN0aW9uIiwiX2dyb3VwIiwiQk9EWUdST1VQX1NUQVRJQyIsIl9saW5lYXJEYW1waW5nIiwiX2xpbmVhckZhY3RvciIsIl9saW5lYXJWZWxvY2l0eSIsIl9tYXNrIiwiQk9EWU1BU0tfTk9UX1NUQVRJQyIsIl9tYXNzIiwiX3Jlc3RpdHV0aW9uIiwiX3JvbGxpbmdGcmljdGlvbiIsIl9zaW11bGF0aW9uRW5hYmxlZCIsIl90eXBlIiwiQk9EWVRZUEVfU1RBVElDIiwib25MaWJyYXJ5TG9hZGVkIiwiQW1tbyIsImJ0VHJhbnNmb3JtIiwiYnRWZWN0b3IzIiwiYnRRdWF0ZXJuaW9uIiwiYW5ndWxhckRhbXBpbmciLCJkYW1waW5nIiwic2V0RGFtcGluZyIsImFuZ3VsYXJGYWN0b3IiLCJmYWN0b3IiLCJlcXVhbHMiLCJjb3B5IiwiQk9EWVRZUEVfRFlOQU1JQyIsInNldFZhbHVlIiwieCIsInkiLCJ6Iiwic2V0QW5ndWxhckZhY3RvciIsImFuZ3VsYXJWZWxvY2l0eSIsInZlbG9jaXR5IiwiYWN0aXZhdGUiLCJzZXRBbmd1bGFyVmVsb2NpdHkiLCJnZXRBbmd1bGFyVmVsb2NpdHkiLCJzZXQiLCJib2R5IiwiZnJpY3Rpb24iLCJzZXRGcmljdGlvbiIsImdyb3VwIiwiZW5hYmxlZCIsImRpc2FibGVTaW11bGF0aW9uIiwiZW5hYmxlU2ltdWxhdGlvbiIsImxpbmVhckRhbXBpbmciLCJsaW5lYXJGYWN0b3IiLCJzZXRMaW5lYXJGYWN0b3IiLCJsaW5lYXJWZWxvY2l0eSIsInNldExpbmVhclZlbG9jaXR5IiwiZ2V0TGluZWFyVmVsb2NpdHkiLCJtYXNrIiwibWFzcyIsImdldENvbGxpc2lvblNoYXBlIiwiY2FsY3VsYXRlTG9jYWxJbmVydGlhIiwic2V0TWFzc1Byb3BzIiwidXBkYXRlSW5lcnRpYVRlbnNvciIsInJlc3RpdHV0aW9uIiwic2V0UmVzdGl0dXRpb24iLCJyb2xsaW5nRnJpY3Rpb24iLCJzZXRSb2xsaW5nRnJpY3Rpb24iLCJ0eXBlIiwiQk9EWUdST1VQX0RZTkFNSUMiLCJCT0RZTUFTS19BTEwiLCJCT0RZVFlQRV9LSU5FTUFUSUMiLCJCT0RZR1JPVVBfS0lORU1BVElDIiwiY3JlYXRlQm9keSIsInNoYXBlIiwiY29sbGlzaW9uIiwidHJpZ2dlciIsImRlc3Ryb3kiLCJvblJlbW92ZSIsIl9nZXRFbnRpdHlUcmFuc2Zvcm0iLCJzZXRDb2xsaXNpb25GbGFncyIsImdldENvbGxpc2lvbkZsYWdzIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsInNldEFjdGl2YXRpb25TdGF0ZSIsIkJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsImlzQWN0aXZlIiwiYWRkQm9keSIsIl9keW5hbWljIiwicHVzaCIsImZvcmNlQWN0aXZhdGlvblN0YXRlIiwiQk9EWVNUQVRFX0FDVElWRV9UQUciLCJzeW5jRW50aXR5VG9Cb2R5IiwiX2tpbmVtYXRpYyIsIl9jb21wb3VuZHMiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwicmVtb3ZlQm9keSIsIkJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04iLCJhcHBseUZvcmNlIiwicHgiLCJweSIsInB6IiwidW5kZWZpbmVkIiwiYXBwbHlUb3JxdWUiLCJhcHBseUltcHVsc2UiLCJhcHBseVRvcnF1ZUltcHVsc2UiLCJpc1N0YXRpYyIsImlzU3RhdGljT3JLaW5lbWF0aWMiLCJpc0tpbmVtYXRpYyIsInRyYW5zZm9ybSIsImNvbXBvbmVudCIsImJvZHlQb3MiLCJnZXRTaGFwZVBvc2l0aW9uIiwiYm9keVJvdCIsImdldFNoYXBlUm90YXRpb24iLCJ3IiwicG9zIiwiZ2V0UG9zaXRpb24iLCJyb3QiLCJnZXRSb3RhdGlvbiIsInNldE9yaWdpbiIsInNldFJvdGF0aW9uIiwic2V0V29ybGRUcmFuc2Zvcm0iLCJtb3Rpb25TdGF0ZSIsImdldE1vdGlvblN0YXRlIiwiX3VwZGF0ZUR5bmFtaWMiLCJnZXRXb3JsZFRyYW5zZm9ybSIsInAiLCJnZXRPcmlnaW4iLCJxIiwiX2hhc09mZnNldCIsImxvIiwiZGF0YSIsImxpbmVhck9mZnNldCIsImFvIiwiYW5ndWxhck9mZnNldCIsImludmVydGVkQW8iLCJpbnZlcnQiLCJlbnRpdHlSb3QiLCJtdWwiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJzZXRQb3NpdGlvbiIsIl91cGRhdGVLaW5lbWF0aWMiLCJ0ZWxlcG9ydCIsInJ4IiwicnkiLCJyeiIsInNldEV1bGVyQW5nbGVzIiwib25FbmFibGUiLCJvbkRpc2FibGUiXSwibWFwcGluZ3Mi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
