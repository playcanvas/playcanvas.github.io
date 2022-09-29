import '../../../core/tracing.js';
import { Quat } from '../../../math/quat.js';
import { Vec3 } from '../../../math/vec3.js';
import { BODYGROUP_STATIC, BODYMASK_NOT_STATIC, BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_KINEMATIC, BODYMASK_ALL, BODYGROUP_DYNAMIC, BODYFLAG_KINEMATIC_OBJECT, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from './constants.js';
import { Component } from '../component.js';

let ammoTransform;
let ammoVec1, ammoVec2, ammoQuat, ammoOrigin;

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
      ammoTransform = new Ammo.btTransform();
      ammoVec1 = new Ammo.btVector3();
      ammoVec2 = new Ammo.btVector3();
      ammoQuat = new Ammo.btQuaternion();
      ammoOrigin = new Ammo.btVector3(0, 0, 0);
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
        ammoVec1.setValue(factor.x, factor.y, factor.z);

        this._body.setAngularFactor(ammoVec1);
      }
    }
  }

  get angularFactor() {
    return this._angularFactor;
  }

  set angularVelocity(velocity) {
    if (this._body && this._type === BODYTYPE_DYNAMIC) {
      this._body.activate();

      ammoVec1.setValue(velocity.x, velocity.y, velocity.z);

      this._body.setAngularVelocity(ammoVec1);

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
        ammoVec1.setValue(factor.x, factor.y, factor.z);

        this._body.setLinearFactor(ammoVec1);
      }
    }
  }

  get linearFactor() {
    return this._linearFactor;
  }

  set linearVelocity(velocity) {
    if (this._body && this._type === BODYTYPE_DYNAMIC) {
      this._body.activate();

      ammoVec1.setValue(velocity.x, velocity.y, velocity.z);

      this._body.setLinearVelocity(ammoVec1);

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

        this._body.getCollisionShape().calculateLocalInertia(mass, ammoVec1);

        this._body.setMassProps(mass, ammoVec1);

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

      this._getEntityTransform(ammoTransform);

      const body = this.system.createBody(mass, shape, ammoTransform);
      body.setRestitution(this._restitution);
      body.setFriction(this._friction);
      body.setRollingFriction(this._rollingFriction);
      body.setDamping(this._linearDamping, this._angularDamping);

      if (this._type === BODYTYPE_DYNAMIC) {
        const linearFactor = this._linearFactor;
        ammoVec1.setValue(linearFactor.x, linearFactor.y, linearFactor.z);
        body.setLinearFactor(ammoVec1);
        const angularFactor = this._angularFactor;
        ammoVec1.setValue(angularFactor.x, angularFactor.y, angularFactor.z);
        body.setAngularFactor(ammoVec1);
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

  applyForce() {
    let x, y, z;
    let px, py, pz;

    switch (arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;

      case 2:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        px = arguments[1].x;
        py = arguments[1].y;
        pz = arguments[1].z;
        break;

      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;

      case 6:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        px = arguments[3];
        py = arguments[4];
        pz = arguments[5];
        break;
    }

    const body = this._body;

    if (body) {
      body.activate();
      ammoVec1.setValue(x, y, z);

      if (px !== undefined) {
        ammoVec2.setValue(px, py, pz);
        body.applyForce(ammoVec1, ammoVec2);
      } else {
        body.applyForce(ammoVec1, ammoOrigin);
      }
    }
  }

  applyTorque() {
    let x, y, z;

    switch (arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;

      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;

      default:
        return;
    }

    const body = this._body;

    if (body) {
      body.activate();
      ammoVec1.setValue(x, y, z);
      body.applyTorque(ammoVec1);
    }
  }

  applyImpulse() {
    let x, y, z;
    let px, py, pz;

    switch (arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;

      case 2:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        px = arguments[1].x;
        py = arguments[1].y;
        pz = arguments[1].z;
        break;

      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;

      case 6:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        px = arguments[3];
        py = arguments[4];
        pz = arguments[5];
        break;

      default:
        return;
    }

    const body = this._body;

    if (body) {
      body.activate();
      ammoVec1.setValue(x, y, z);

      if (px !== undefined) {
        ammoVec2.setValue(px, py, pz);
        body.applyImpulse(ammoVec1, ammoVec2);
      } else {
        body.applyImpulse(ammoVec1, ammoOrigin);
      }
    }
  }

  applyTorqueImpulse() {
    let x, y, z;

    switch (arguments.length) {
      case 1:
        x = arguments[0].x;
        y = arguments[0].y;
        z = arguments[0].z;
        break;

      case 3:
        x = arguments[0];
        y = arguments[1];
        z = arguments[2];
        break;

      default:
        return;
    }

    const body = this._body;

    if (body) {
      body.activate();
      ammoVec1.setValue(x, y, z);
      body.applyTorqueImpulse(ammoVec1);
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
    const pos = entity.getPosition();
    const rot = entity.getRotation();
    ammoVec1.setValue(pos.x, pos.y, pos.z);
    ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    transform.setOrigin(ammoVec1);
    transform.setRotation(ammoQuat);
  }

  syncEntityToBody() {
    const body = this._body;

    if (body) {
      this._getEntityTransform(ammoTransform);

      body.setWorldTransform(ammoTransform);

      if (this._type === BODYTYPE_KINEMATIC) {
        const motionState = body.getMotionState();

        if (motionState) {
          motionState.setWorldTransform(ammoTransform);
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
        motionState.getWorldTransform(ammoTransform);
        const p = ammoTransform.getOrigin();
        const q = ammoTransform.getRotation();
        this.entity.setPosition(p.x(), p.y(), p.z());
        this.entity.setRotation(q.x(), q.y(), q.z(), q.w());
      }
    }
  }

  _updateKinematic() {
    const motionState = this._body.getMotionState();

    if (motionState) {
      this._getEntityTransform(ammoTransform);

      motionState.setWorldTransform(ammoTransform);
    }
  }

  teleport() {
    if (arguments.length < 3) {
      if (arguments[0]) {
        this.entity.setPosition(arguments[0]);
      }

      if (arguments[1]) {
        if (arguments[1] instanceof Quat) {
          this.entity.setRotation(arguments[1]);
        } else {
          this.entity.setEulerAngles(arguments[1]);
        }
      }
    } else {
      if (arguments.length === 6) {
        this.entity.setEulerAngles(arguments[3], arguments[4], arguments[5]);
      }

      this.entity.setPosition(arguments[0], arguments[1], arguments[2]);
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
