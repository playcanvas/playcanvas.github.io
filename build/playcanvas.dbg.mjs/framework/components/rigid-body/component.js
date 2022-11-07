/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
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
        Debug.error('ERROR: applyTorque: function takes 1 or 3 arguments');
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
        Debug.error('ERROR: applyImpulse: function takes 1, 2, 3 or 6 arguments');
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
        Debug.error('ERROR: applyTorqueImpulse: function takes 1 or 3 arguments');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWVRZUEVfU1RBVElDLFxuICAgIEJPRFlHUk9VUF9EWU5BTUlDLCBCT0RZR1JPVVBfS0lORU1BVElDLCBCT0RZR1JPVVBfU1RBVElDLFxuICAgIEJPRFlNQVNLX0FMTCwgQk9EWU1BU0tfTk9UX1NUQVRJQyxcbiAgICBCT0RZU1RBVEVfQUNUSVZFX1RBRywgQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OLCBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OLFxuICAgIEJPRFlUWVBFX0RZTkFNSUMsIEJPRFlUWVBFX0tJTkVNQVRJQ1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0gUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtICovXG5cbi8vIFNoYXJlZCBtYXRoIHZhcmlhYmxlIHRvIGF2b2lkIGV4Y2Vzc2l2ZSBhbGxvY2F0aW9uXG5sZXQgYW1tb1RyYW5zZm9ybTtcbmxldCBhbW1vVmVjMSwgYW1tb1ZlYzIsIGFtbW9RdWF0LCBhbW1vT3JpZ2luO1xuXG4vKipcbiAqIFRoZSByaWdpZGJvZHkgY29tcG9uZW50LCB3aGVuIGNvbWJpbmVkIHdpdGggYSB7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50fSwgYWxsb3dzIHlvdXIgZW50aXRpZXNcbiAqIHRvIGJlIHNpbXVsYXRlZCB1c2luZyByZWFsaXN0aWMgcGh5c2ljcy4gQSByaWdpZGJvZHkgY29tcG9uZW50IHdpbGwgZmFsbCB1bmRlciBncmF2aXR5IGFuZFxuICogY29sbGlkZSB3aXRoIG90aGVyIHJpZ2lkIGJvZGllcy4gVXNpbmcgc2NyaXB0cywgeW91IGNhbiBhcHBseSBmb3JjZXMgYW5kIGltcHVsc2VzIHRvIHJpZ2lkXG4gKiBib2RpZXMuXG4gKlxuICogWW91IHNob3VsZCBuZXZlciBuZWVkIHRvIHVzZSB0aGUgUmlnaWRCb2R5Q29tcG9uZW50IGNvbnN0cnVjdG9yLiBUbyBhZGQgYW4gUmlnaWRCb2R5Q29tcG9uZW50IHRvXG4gKiBhIHtAbGluayBFbnRpdHl9LCB1c2Uge0BsaW5rIEVudGl0eSNhZGRDb21wb25lbnR9OlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIENyZWF0ZSBhIHN0YXRpYyAxeDF4MSBib3gtc2hhcGVkIHJpZ2lkIGJvZHlcbiAqIGNvbnN0IGVudGl0eSA9IHBjLkVudGl0eSgpO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcInJpZ2lkYm9keVwiKTsgLy8gV2l0aCBubyBvcHRpb25zIHNwZWNpZmllZCwgdGhpcyBkZWZhdWx0cyB0byBhICdzdGF0aWMnIGJvZHlcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjb2xsaXNpb25cIik7IC8vIFdpdGggbm8gb3B0aW9ucyBzcGVjaWZpZWQsIHRoaXMgZGVmYXVsdHMgdG8gYSAxeDF4MSBib3ggc2hhcGVcbiAqIGBgYFxuICpcbiAqIFRvIGNyZWF0ZSBhIGR5bmFtaWMgc3BoZXJlIHdpdGggbWFzcyBvZiAxMCwgZG86XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3QgZW50aXR5ID0gcGMuRW50aXR5KCk7XG4gKiBlbnRpdHkuYWRkQ29tcG9uZW50KFwicmlnaWRib2R5XCIsIHtcbiAqICAgICB0eXBlOiBwYy5CT0RZVFlQRV9EWU5BTUlDLFxuICogICAgIG1hc3M6IDEwXG4gKiB9KTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjb2xsaXNpb25cIiwge1xuICogICAgIHR5cGU6IFwic3BoZXJlXCJcbiAqIH0pO1xuICogYGBgXG4gKlxuICogUmVsZXZhbnQgJ0VuZ2luZS1vbmx5JyBleGFtcGxlczpcbiAqXG4gKiAtIFtGYWxsaW5nIHNoYXBlc10oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyNwaHlzaWNzL2ZhbGxpbmctc2hhcGVzKVxuICogLSBbVmVoaWNsZSBwaHlzaWNzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3BoeXNpY3MvdmVoaWNsZSlcbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFJpZ2lkQm9keUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSB0aGlzIGNvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fYW5ndWxhckRhbXBpbmcgPSAwO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRmFjdG9yID0gbmV3IFZlYzMoMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuX2JvZHkgPSBudWxsO1xuICAgICAgICB0aGlzLl9mcmljdGlvbiA9IDAuNTtcbiAgICAgICAgdGhpcy5fZ3JvdXAgPSBCT0RZR1JPVVBfU1RBVElDO1xuICAgICAgICB0aGlzLl9saW5lYXJEYW1waW5nID0gMDtcbiAgICAgICAgdGhpcy5fbGluZWFyRmFjdG9yID0gbmV3IFZlYzMoMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2xpbmVhclZlbG9jaXR5ID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5fbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG4gICAgICAgIHRoaXMuX21hc3MgPSAxO1xuICAgICAgICB0aGlzLl9yZXN0aXR1dGlvbiA9IDA7XG4gICAgICAgIHRoaXMuX3JvbGxpbmdGcmljdGlvbiA9IDA7XG4gICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3R5cGUgPSBCT0RZVFlQRV9TVEFUSUM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjY29udGFjdFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0YXJ0IHRvdWNoaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudCNjb2xsaXNpb25zdGFydFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0b3AgdG91Y2hpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I2NvbGxpc2lvbmVuZFxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBvdGhlciAtIFRoZSB7QGxpbmsgRW50aXR5fSB0aGF0IHN0b3BwZWQgdG91Y2hpbmcgdGhpcyByaWdpZCBib2R5LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHJpZ2lkIGJvZHkgZW50ZXJzIGEgdHJpZ2dlciB2b2x1bWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I3RyaWdnZXJlbnRlclxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBvdGhlciAtIFRoZSB7QGxpbmsgRW50aXR5fSB3aXRoIHRyaWdnZXIgdm9sdW1lIHRoYXQgdGhpcyByaWdpZCBib2R5IGVudGVyZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBleGl0cyBhIHRyaWdnZXIgdm9sdW1lLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudCN0cmlnZ2VybGVhdmVcbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBleGl0ZWQuXG4gICAgICovXG5cbiAgICBzdGF0aWMgb25MaWJyYXJ5TG9hZGVkKCkge1xuXG4gICAgICAgIC8vIExhemlseSBjcmVhdGUgc2hhcmVkIHZhcmlhYmxlXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGFtbW9UcmFuc2Zvcm0gPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgYW1tb1ZlYzEgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGFtbW9WZWMyID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBhbW1vUXVhdCA9IG5ldyBBbW1vLmJ0UXVhdGVybmlvbigpO1xuICAgICAgICAgICAgYW1tb09yaWdpbiA9IG5ldyBBbW1vLmJ0VmVjdG9yMygwLCAwLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSByYXRlIGF0IHdoaWNoIGEgYm9keSBsb3NlcyBhbmd1bGFyIHZlbG9jaXR5IG92ZXIgdGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJEYW1waW5nKGRhbXBpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJEYW1waW5nICE9PSBkYW1waW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKHRoaXMuX2xpbmVhckRhbXBpbmcsIGRhbXBpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckRhbXBpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2NhbGluZyBmYWN0b3IgZm9yIGFuZ3VsYXIgbW92ZW1lbnQgb2YgdGhlIGJvZHkgaW4gZWFjaCBheGlzLiBPbmx5IHZhbGlkIGZvciByaWdpZCBib2RpZXMgb2ZcbiAgICAgKiB0eXBlIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfS4gRGVmYXVsdHMgdG8gMSBpbiBhbGwgYXhlcyAoYm9keSBjYW4gZnJlZWx5IHJvdGF0ZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhckZhY3RvcihmYWN0b3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRmFjdG9yLmNvcHkoZmFjdG9yKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKGZhY3Rvci54LCBmYWN0b3IueSwgZmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0QW5ndWxhckZhY3RvcihhbW1vVmVjMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhckZhY3RvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJGYWN0b3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyB0aGUgcm90YXRpb25hbCBzcGVlZCBvZiB0aGUgYm9keSBhcm91bmQgZWFjaCB3b3JsZCBheGlzLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJWZWxvY2l0eSh2ZWxvY2l0eSkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRBbmd1bGFyVmVsb2NpdHkoYW1tb1ZlYzEpO1xuXG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyVmVsb2NpdHkuY29weSh2ZWxvY2l0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhclZlbG9jaXR5KCkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICBjb25zdCB2ZWxvY2l0eSA9IHRoaXMuX2JvZHkuZ2V0QW5ndWxhclZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyVmVsb2NpdHkuc2V0KHZlbG9jaXR5LngoKSwgdmVsb2NpdHkueSgpLCB2ZWxvY2l0eS56KCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyVmVsb2NpdHk7XG4gICAgfVxuXG4gICAgc2V0IGJvZHkoYm9keSkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSAhPT0gYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fYm9keSA9IGJvZHk7XG5cbiAgICAgICAgICAgIGlmIChib2R5ICYmIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGJvZHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ib2R5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmcmljdGlvbiB2YWx1ZSB1c2VkIHdoZW4gY29udGFjdHMgb2NjdXIgYmV0d2VlbiB0d28gYm9kaWVzLiBBIGhpZ2hlciB2YWx1ZSBpbmRpY2F0ZXNcbiAgICAgKiBtb3JlIGZyaWN0aW9uLiBTaG91bGQgYmUgc2V0IGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIDAuNS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZyaWN0aW9uKGZyaWN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLl9mcmljdGlvbiAhPT0gZnJpY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX2ZyaWN0aW9uID0gZnJpY3Rpb247XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRGcmljdGlvbihmcmljdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZnJpY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mcmljdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sbGlzaW9uIGdyb3VwIHRoaXMgYm9keSBiZWxvbmdzIHRvLiBDb21iaW5lIHRoZSBncm91cCBhbmQgdGhlIG1hc2sgdG8gcHJldmVudCBib2RpZXNcbiAgICAgKiBjb2xsaWRpbmcgd2l0aCBlYWNoIG90aGVyLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZ3JvdXAoZ3JvdXApIHtcbiAgICAgICAgaWYgKHRoaXMuX2dyb3VwICE9PSBncm91cCkge1xuICAgICAgICAgICAgdGhpcy5fZ3JvdXAgPSBncm91cDtcblxuICAgICAgICAgICAgLy8gcmUtZW5hYmxpbmcgc2ltdWxhdGlvbiBhZGRzIHJpZ2lkYm9keSBiYWNrIGludG8gd29ybGQgd2l0aCBuZXcgbWFza3NcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBncm91cCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dyb3VwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSByYXRlIGF0IHdoaWNoIGEgYm9keSBsb3NlcyBsaW5lYXIgdmVsb2NpdHkgb3ZlciB0aW1lLiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbGluZWFyRGFtcGluZyhkYW1waW5nKSB7XG4gICAgICAgIGlmICh0aGlzLl9saW5lYXJEYW1waW5nICE9PSBkYW1waW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJEYW1waW5nID0gZGFtcGluZztcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldERhbXBpbmcoZGFtcGluZywgdGhpcy5fYW5ndWxhckRhbXBpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhckRhbXBpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJEYW1waW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNjYWxpbmcgZmFjdG9yIGZvciBsaW5lYXIgbW92ZW1lbnQgb2YgdGhlIGJvZHkgaW4gZWFjaCBheGlzLiBPbmx5IHZhbGlkIGZvciByaWdpZCBib2RpZXMgb2ZcbiAgICAgKiB0eXBlIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfS4gRGVmYXVsdHMgdG8gMSBpbiBhbGwgYXhlcyAoYm9keSBjYW4gZnJlZWx5IG1vdmUpLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGxpbmVhckZhY3RvcihmYWN0b3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saW5lYXJGYWN0b3IuZXF1YWxzKGZhY3RvcikpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhckZhY3Rvci5jb3B5KGZhY3Rvcik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZShmYWN0b3IueCwgZmFjdG9yLnksIGZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldExpbmVhckZhY3RvcihhbW1vVmVjMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRmFjdG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgdGhlIHNwZWVkIG9mIHRoZSBib2R5IGluIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGxpbmVhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgYW1tb1ZlYzEuc2V0VmFsdWUodmVsb2NpdHkueCwgdmVsb2NpdHkueSwgdmVsb2NpdHkueik7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LnNldExpbmVhclZlbG9jaXR5KGFtbW9WZWMxKTtcblxuICAgICAgICAgICAgdGhpcy5fbGluZWFyVmVsb2NpdHkuY29weSh2ZWxvY2l0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyVmVsb2NpdHkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlbG9jaXR5ID0gdGhpcy5fYm9keS5nZXRMaW5lYXJWZWxvY2l0eSgpO1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyVmVsb2NpdHkuc2V0KHZlbG9jaXR5LngoKSwgdmVsb2NpdHkueSgpLCB2ZWxvY2l0eS56KCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJWZWxvY2l0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sbGlzaW9uIG1hc2sgc2V0cyB3aGljaCBncm91cHMgdGhpcyBib2R5IGNvbGxpZGVzIHdpdGguIEl0IGlzIGEgYml0ZmllbGQgb2YgMTYgYml0cyxcbiAgICAgKiB0aGUgZmlyc3QgOCBiaXRzIGFyZSByZXNlcnZlZCBmb3IgZW5naW5lIHVzZS4gRGVmYXVsdHMgdG8gNjU1MzUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNrKG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuX21hc2sgPSBtYXNrO1xuXG4gICAgICAgICAgICAvLyByZS1lbmFibGluZyBzaW11bGF0aW9uIGFkZHMgcmlnaWRib2R5IGJhY2sgaW50byB3b3JsZCB3aXRoIG5ldyBtYXNrc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXNzIG9mIHRoZSBib2R5LiBUaGlzIGlzIG9ubHkgcmVsZXZhbnQgZm9yIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfSBib2RpZXMsIG90aGVyIHR5cGVzXG4gICAgICogaGF2ZSBpbmZpbml0ZSBtYXNzLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFzcyhtYXNzKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXNzICE9PSBtYXNzKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXNzID0gbWFzcztcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZDtcbiAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlTG9jYWxJbmVydGlhIHdyaXRlcyBsb2NhbCBpbmVydGlhIHRvIGFtbW9WZWMxIGhlcmUuLi5cbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LmdldENvbGxpc2lvblNoYXBlKCkuY2FsY3VsYXRlTG9jYWxJbmVydGlhKG1hc3MsIGFtbW9WZWMxKTtcbiAgICAgICAgICAgICAgICAvLyAuLi5hbmQgdGhlbiB3cml0ZXMgdGhlIGNhbGN1bGF0ZWQgbG9jYWwgaW5lcnRpYSB0byB0aGUgYm9keVxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TWFzc1Byb3BzKG1hc3MsIGFtbW9WZWMxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnVwZGF0ZUluZXJ0aWFUZW5zb3IoKTtcblxuICAgICAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFzcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmZsdWVuY2VzIHRoZSBhbW91bnQgb2YgZW5lcmd5IGxvc3Qgd2hlbiB0d28gcmlnaWQgYm9kaWVzIGNvbGxpZGUuIFRoZSBjYWxjdWxhdGlvblxuICAgICAqIG11bHRpcGxpZXMgdGhlIHJlc3RpdHV0aW9uIHZhbHVlcyBmb3IgYm90aCBjb2xsaWRpbmcgYm9kaWVzLiBBIG11bHRpcGxpZWQgdmFsdWUgb2YgMCBtZWFuc1xuICAgICAqIHRoYXQgYWxsIGVuZXJneSBpcyBsb3N0IGluIHRoZSBjb2xsaXNpb24gd2hpbGUgYSB2YWx1ZSBvZiAxIG1lYW5zIHRoYXQgbm8gZW5lcmd5IGlzIGxvc3QuXG4gICAgICogU2hvdWxkIGJlIHNldCBpbiB0aGUgcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcmVzdGl0dXRpb24ocmVzdGl0dXRpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuX3Jlc3RpdHV0aW9uICE9PSByZXN0aXR1dGlvbikge1xuICAgICAgICAgICAgdGhpcy5fcmVzdGl0dXRpb24gPSByZXN0aXR1dGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldFJlc3RpdHV0aW9uKHJlc3RpdHV0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZXN0aXR1dGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc3RpdHV0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSB0b3JzaW9uYWwgZnJpY3Rpb24gb3J0aG9nb25hbCB0byB0aGUgY29udGFjdCBwb2ludC4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJvbGxpbmdGcmljdGlvbihmcmljdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fcm9sbGluZ0ZyaWN0aW9uICE9PSBmcmljdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fcm9sbGluZ0ZyaWN0aW9uID0gZnJpY3Rpb247XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRSb2xsaW5nRnJpY3Rpb24oZnJpY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJvbGxpbmdGcmljdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JvbGxpbmdGcmljdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmlnaWQgYm9keSB0eXBlIGRldGVybWluZXMgaG93IHRoZSBib2R5IGlzIHNpbXVsYXRlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfTogaW5maW5pdGUgbWFzcyBhbmQgY2Fubm90IG1vdmUuXG4gICAgICogLSB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ306IHNpbXVsYXRlZCBhY2NvcmRpbmcgdG8gYXBwbGllZCBmb3JjZXMuXG4gICAgICogLSB7QGxpbmsgQk9EWVRZUEVfS0lORU1BVElDfTogaW5maW5pdGUgbWFzcyBhbmQgZG9lcyBub3QgcmVzcG9uZCB0byBmb3JjZXMgKGNhbiBvbmx5IGJlXG4gICAgICogbW92ZWQgYnkgc2V0dGluZyB0aGUgcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIGNvbXBvbmVudCdzIHtAbGluayBFbnRpdHl9KS5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgdHlwZSh0eXBlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlICE9PSB0eXBlKSB7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gdHlwZTtcblxuICAgICAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuXG4gICAgICAgICAgICAvLyBzZXQgZ3JvdXAgYW5kIG1hc2sgdG8gZGVmYXVsdHMgZm9yIHR5cGVcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfRFlOQU1JQzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JvdXAgPSBCT0RZR1JPVVBfRFlOQU1JQztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFzayA9IEJPRFlNQVNLX0FMTDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9LSU5FTUFUSUM6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX0tJTkVNQVRJQztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFzayA9IEJPRFlNQVNLX0FMTDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9TVEFUSUM6XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JvdXAgPSBCT0RZR1JPVVBfU1RBVElDO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXNrID0gQk9EWU1BU0tfTk9UX1NUQVRJQztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBib2R5XG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUJvZHkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgRW50aXR5IGhhcyBhIENvbGxpc2lvbiBzaGFwZSBhdHRhY2hlZCB0aGVuIGNyZWF0ZSBhIHJpZ2lkIGJvZHkgdXNpbmcgdGhpcyBzaGFwZS4gVGhpc1xuICAgICAqIG1ldGhvZCBkZXN0cm95cyB0aGUgZXhpc3RpbmcgYm9keS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgY3JlYXRlQm9keSgpIHtcbiAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIGxldCBzaGFwZTtcblxuICAgICAgICBpZiAoZW50aXR5LmNvbGxpc2lvbikge1xuICAgICAgICAgICAgc2hhcGUgPSBlbnRpdHkuY29sbGlzaW9uLnNoYXBlO1xuXG4gICAgICAgICAgICAvLyBpZiBhIHRyaWdnZXIgd2FzIGFscmVhZHkgY3JlYXRlZCBmcm9tIHRoZSBjb2xsaXNpb24gc3lzdGVtXG4gICAgICAgICAgICAvLyBkZXN0cm95IGl0XG4gICAgICAgICAgICBpZiAoZW50aXR5LnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICBlbnRpdHkudHJpZ2dlci5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGVudGl0eS50cmlnZ2VyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNoYXBlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSlcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5vblJlbW92ZShlbnRpdHksIHRoaXMpO1xuXG4gICAgICAgICAgICBjb25zdCBtYXNzID0gdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQyA/IHRoaXMuX21hc3MgOiAwO1xuXG4gICAgICAgICAgICB0aGlzLl9nZXRFbnRpdHlUcmFuc2Zvcm0oYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLnN5c3RlbS5jcmVhdGVCb2R5KG1hc3MsIHNoYXBlLCBhbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRSZXN0aXR1dGlvbih0aGlzLl9yZXN0aXR1dGlvbik7XG4gICAgICAgICAgICBib2R5LnNldEZyaWN0aW9uKHRoaXMuX2ZyaWN0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKHRoaXMuX3JvbGxpbmdGcmljdGlvbik7XG4gICAgICAgICAgICBib2R5LnNldERhbXBpbmcodGhpcy5fbGluZWFyRGFtcGluZywgdGhpcy5fYW5ndWxhckRhbXBpbmcpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVhckZhY3RvciA9IHRoaXMuX2xpbmVhckZhY3RvcjtcbiAgICAgICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZShsaW5lYXJGYWN0b3IueCwgbGluZWFyRmFjdG9yLnksIGxpbmVhckZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICBib2R5LnNldExpbmVhckZhY3RvcihhbW1vVmVjMSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBhbmd1bGFyRmFjdG9yID0gdGhpcy5fYW5ndWxhckZhY3RvcjtcbiAgICAgICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZShhbmd1bGFyRmFjdG9yLngsIGFuZ3VsYXJGYWN0b3IueSwgYW5ndWxhckZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFuZ3VsYXJGYWN0b3IoYW1tb1ZlYzEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpIHtcbiAgICAgICAgICAgICAgICBib2R5LnNldENvbGxpc2lvbkZsYWdzKGJvZHkuZ2V0Q29sbGlzaW9uRmxhZ3MoKSB8IEJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1QpO1xuICAgICAgICAgICAgICAgIGJvZHkuc2V0QWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuZW50aXR5ID0gZW50aXR5O1xuXG4gICAgICAgICAgICB0aGlzLmJvZHkgPSBib2R5O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIGVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgY3VycmVudGx5IGFjdGl2ZWx5IGJlaW5nIHNpbXVsYXRlZC4gSS5lLiBOb3QgJ3NsZWVwaW5nJy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBib2R5IGlzIGFjdGl2ZS5cbiAgICAgKi9cbiAgICBpc0FjdGl2ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JvZHkgPyB0aGlzLl9ib2R5LmlzQWN0aXZlKCkgOiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JjaWJseSBhY3RpdmF0ZSB0aGUgcmlnaWQgYm9keSBzaW11bGF0aW9uLiBPbmx5IGFmZmVjdHMgcmlnaWQgYm9kaWVzIG9mIHR5cGVcbiAgICAgKiB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ30uXG4gICAgICovXG4gICAgYWN0aXZhdGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlbmFibGVTaW11bGF0aW9uKCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24gJiYgZW50aXR5LmNvbGxpc2lvbi5lbmFibGVkICYmICF0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFkZEJvZHkoYm9keSwgdGhpcy5fZ3JvdXAsIHRoaXMuX21hc2spO1xuXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfRFlOQU1JQzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9keW5hbWljLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9BQ1RJVkVfVEFHKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2tpbmVtYXRpYy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfQUNUSVZFX1RBRyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2NvbXBvdW5kcy5wdXNoKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc2FibGVTaW11bGF0aW9uKCkge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkgJiYgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN5c3RlbSA9IHRoaXMuc3lzdGVtO1xuXG4gICAgICAgICAgICBsZXQgaWR4ID0gc3lzdGVtLl9jb21wb3VuZHMuaW5kZXhPZih0aGlzLmVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLl9jb21wb3VuZHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlkeCA9IHN5c3RlbS5fZHluYW1pYy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLl9keW5hbWljLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZHggPSBzeXN0ZW0uX2tpbmVtYXRpYy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc3lzdGVtLl9raW5lbWF0aWMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN5c3RlbS5yZW1vdmVCb2R5KGJvZHkpO1xuXG4gICAgICAgICAgICAvLyBzZXQgYWN0aXZhdGlvbiBzdGF0ZSB0byBkaXNhYmxlIHNpbXVsYXRpb24gdG8gYXZvaWQgYm9keS5pc0FjdGl2ZSgpIHRvIHJldHVyblxuICAgICAgICAgICAgLy8gdHJ1ZSBldmVuIGlmIGl0J3Mgbm90IGluIHRoZSBkeW5hbWljcyB3b3JsZFxuICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OKTtcblxuICAgICAgICAgICAgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IGFuIGZvcmNlIHRvIHRoZSBib2R5IGF0IGEgcG9pbnQuIEJ5IGRlZmF1bHQsIHRoZSBmb3JjZSBpcyBhcHBsaWVkIGF0IHRoZSBvcmlnaW4gb2YgdGhlXG4gICAgICogYm9keS4gSG93ZXZlciwgdGhlIGZvcmNlIGNhbiBiZSBhcHBsaWVkIGF0IGFuIG9mZnNldCB0aGlzIHBvaW50IGJ5IHNwZWNpZnlpbmcgYSB3b3JsZCBzcGFjZVxuICAgICAqIHZlY3RvciBmcm9tIHRoZSBib2R5J3Mgb3JpZ2luIHRvIHRoZSBwb2ludCBvZiBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkXG4gICAgICogc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgZm9yY2UgKGFuZCBvcHRpb25hbCByZWxhdGl2ZSBwb2ludCkgdmlhIDNELXZlY3RvciBvclxuICAgICAqIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIGZvcmNlIGluIHdvcmxkLXNwYWNlIG9yXG4gICAgICogdGhlIHgtY29tcG9uZW50IG9mIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHJlbGF0aXZlIHBvaW50XG4gICAgICogYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gd29ybGQtc3BhY2Ugb3IgdGhlIHktY29tcG9uZW50IG9mIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B4XSAtIFRoZSB4LWNvbXBvbmVudCBvZiBhIHdvcmxkLXNwYWNlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgcG9zaXRpb25cbiAgICAgKiB3aGVyZSB0aGUgZm9yY2UgaXMgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiBhIHdvcmxkLXNwYWNlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgcG9zaXRpb25cbiAgICAgKiB3aGVyZSB0aGUgZm9yY2UgaXMgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiBhIHdvcmxkLXNwYWNlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgcG9zaXRpb25cbiAgICAgKiB3aGVyZSB0aGUgZm9yY2UgaXMgYXBwbGllZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGFwcHJveGltYXRpb24gb2YgZ3Jhdml0eSBhdCB0aGUgYm9keSdzIGNlbnRlclxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKDAsIC0xMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBhcHByb3hpbWF0aW9uIG9mIGdyYXZpdHkgYXQgMSB1bml0IGRvd24gdGhlIHdvcmxkIFogZnJvbSB0aGUgY2VudGVyIG9mIHRoZSBib2R5XG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoMCwgLTEwLCAwLCAwLCAwLCAxKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGEgZm9yY2UgYXQgdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiAvLyBDYWxjdWxhdGUgYSBmb3JjZSB2ZWN0b3IgcG9pbnRpbmcgaW4gdGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiB0aGUgZW50aXR5XG4gICAgICogdmFyIGZvcmNlID0gdGhpcy5lbnRpdHkuZm9yd2FyZC5jbG9uZSgpLm11bFNjYWxhcigxMDApO1xuICAgICAqXG4gICAgICogLy8gQXBwbHkgdGhlIGZvcmNlXG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoZm9yY2UpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYSBmb3JjZSBhdCBzb21lIHJlbGF0aXZlIG9mZnNldCBmcm9tIHRoZSBib2R5J3MgY2VudGVyXG4gICAgICogLy8gQ2FsY3VsYXRlIGEgZm9yY2UgdmVjdG9yIHBvaW50aW5nIGluIHRoZSB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gb2YgdGhlIGVudGl0eVxuICAgICAqIHZhciBmb3JjZSA9IHRoaXMuZW50aXR5LmZvcndhcmQuY2xvbmUoKS5tdWxTY2FsYXIoMTAwKTtcbiAgICAgKlxuICAgICAqIC8vIENhbGN1bGF0ZSB0aGUgd29ybGQgc3BhY2UgcmVsYXRpdmUgb2Zmc2V0XG4gICAgICogdmFyIHJlbGF0aXZlUG9zID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgY2hpbGRFbnRpdHkgPSB0aGlzLmVudGl0eS5maW5kQnlOYW1lKCdFbmdpbmUnKTtcbiAgICAgKiByZWxhdGl2ZVBvcy5zdWIyKGNoaWxkRW50aXR5LmdldFBvc2l0aW9uKCksIHRoaXMuZW50aXR5LmdldFBvc2l0aW9uKCkpO1xuICAgICAqXG4gICAgICogLy8gQXBwbHkgdGhlIGZvcmNlXG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoZm9yY2UsIHJlbGF0aXZlUG9zKTtcbiAgICAgKi9cbiAgICBhcHBseUZvcmNlKCkge1xuICAgICAgICBsZXQgeCwgeSwgejtcbiAgICAgICAgbGV0IHB4LCBweSwgcHo7XG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF0ueDtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzBdLnk7XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1swXS56O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF0ueDtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzBdLnk7XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1swXS56O1xuICAgICAgICAgICAgICAgIHB4ID0gYXJndW1lbnRzWzFdLng7XG4gICAgICAgICAgICAgICAgcHkgPSBhcmd1bWVudHNbMV0ueTtcbiAgICAgICAgICAgICAgICBweiA9IGFyZ3VtZW50c1sxXS56O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzJdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzJdO1xuICAgICAgICAgICAgICAgIHB4ID0gYXJndW1lbnRzWzNdO1xuICAgICAgICAgICAgICAgIHB5ID0gYXJndW1lbnRzWzRdO1xuICAgICAgICAgICAgICAgIHB6ID0gYXJndW1lbnRzWzVdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICAgICAgYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICBpZiAocHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGFtbW9WZWMyLnNldFZhbHVlKHB4LCBweSwgcHopO1xuICAgICAgICAgICAgICAgIGJvZHkuYXBwbHlGb3JjZShhbW1vVmVjMSwgYW1tb1ZlYzIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBib2R5LmFwcGx5Rm9yY2UoYW1tb1ZlYzEsIGFtbW9PcmlnaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgdG9ycXVlIChyb3RhdGlvbmFsIGZvcmNlKSB0byB0aGUgYm9keS4gVGhpcyBmdW5jdGlvbiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW5cbiAgICAgKiBlaXRoZXIgc3BlY2lmeSB0aGUgdG9ycXVlIGZvcmNlIHdpdGggYSAzRC12ZWN0b3Igb3Igd2l0aCAzIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZVxuICAgICAqIG9yIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgdmVjdG9yXG4gICAgICogdmFyIHRvcnF1ZSA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5VG9ycXVlKHRvcnF1ZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgbnVtYmVyc1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWUoMCwgMTAsIDApO1xuICAgICAqL1xuICAgIGFwcGx5VG9ycXVlKCkge1xuICAgICAgICBsZXQgeCwgeSwgejtcbiAgICAgICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgeCA9IGFyZ3VtZW50c1swXS54O1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMF0ueTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzBdLno7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgeCA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzFdO1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKCdFUlJPUjogYXBwbHlUb3JxdWU6IGZ1bmN0aW9uIHRha2VzIDEgb3IgMyBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIGJvZHkuYXBwbHlUb3JxdWUoYW1tb1ZlYzEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW4gaW1wdWxzZSAoaW5zdGFudGFuZW91cyBjaGFuZ2Ugb2YgdmVsb2NpdHkpIHRvIHRoZSBib2R5IGF0IGEgcG9pbnQuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIGltcHVsc2UgKGFuZCBvcHRpb25hbCByZWxhdGl2ZSBwb2ludClcbiAgICAgKiB2aWEgM0QtdmVjdG9yIG9yIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIGltcHVsc2UgaW4gd29ybGQtc3BhY2Ugb3JcbiAgICAgKiB0aGUgeC1jb21wb25lbnQgb2YgdGhlIGltcHVsc2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSByZWxhdGl2ZSBwb2ludFxuICAgICAqIGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZSBsb2NhbC1zcGFjZSBvZiB0aGUgZW50aXR5IG9yIHRoZSB5LWNvbXBvbmVudCBvZiB0aGVcbiAgICAgKiBpbXB1bHNlIHRvIGFwcGx5IGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIGltcHVsc2UgdG8gYXBwbHkgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweD0wXSAtIFRoZSB4LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B5PTBdIC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSBwb2ludCBhdCB3aGljaCB0byBhcHBseSB0aGUgaW1wdWxzZSBpbiB0aGVcbiAgICAgKiBsb2NhbC1zcGFjZSBvZiB0aGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHo9MF0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHBvaW50IGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgdGhlIGVudGl0eSdzIHBvc2l0aW9uLlxuICAgICAqIHZhciBpbXB1bHNlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlJbXB1bHNlKGltcHVsc2UpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IDEgdW5pdCBkb3duIHRoZSBwb3NpdGl2ZVxuICAgICAqIC8vIHotYXhpcyBvZiB0aGUgZW50aXR5J3MgbG9jYWwtc3BhY2UuXG4gICAgICogdmFyIGltcHVsc2UgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogdmFyIHJlbGF0aXZlUG9pbnQgPSBuZXcgcGMuVmVjMygwLCAwLCAxKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZShpbXB1bHNlLCByZWxhdGl2ZVBvaW50KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCB0aGUgZW50aXR5J3MgcG9zaXRpb24uXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoMCwgMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IDEgdW5pdCBkb3duIHRoZSBwb3NpdGl2ZVxuICAgICAqIC8vIHotYXhpcyBvZiB0aGUgZW50aXR5J3MgbG9jYWwtc3BhY2UuXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoMCwgMTAsIDAsIDAsIDAsIDEpO1xuICAgICAqL1xuICAgIGFwcGx5SW1wdWxzZSgpIHtcbiAgICAgICAgbGV0IHgsIHksIHo7XG4gICAgICAgIGxldCBweCwgcHksIHB6O1xuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdLng7XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1swXS55O1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMF0uejtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdLng7XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1swXS55O1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMF0uejtcbiAgICAgICAgICAgICAgICBweCA9IGFyZ3VtZW50c1sxXS54O1xuICAgICAgICAgICAgICAgIHB5ID0gYXJndW1lbnRzWzFdLnk7XG4gICAgICAgICAgICAgICAgcHogPSBhcmd1bWVudHNbMV0uejtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMV07XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgNjpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMV07XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgICAgICAgICBweCA9IGFyZ3VtZW50c1szXTtcbiAgICAgICAgICAgICAgICBweSA9IGFyZ3VtZW50c1s0XTtcbiAgICAgICAgICAgICAgICBweiA9IGFyZ3VtZW50c1s1XTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0VSUk9SOiBhcHBseUltcHVsc2U6IGZ1bmN0aW9uIHRha2VzIDEsIDIsIDMgb3IgNiBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIGlmIChweCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgYW1tb1ZlYzIuc2V0VmFsdWUocHgsIHB5LCBweik7XG4gICAgICAgICAgICAgICAgYm9keS5hcHBseUltcHVsc2UoYW1tb1ZlYzEsIGFtbW9WZWMyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYm9keS5hcHBseUltcHVsc2UoYW1tb1ZlYzEsIGFtbW9PcmlnaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYSB0b3JxdWUgaW1wdWxzZSAocm90YXRpb25hbCBmb3JjZSBhcHBsaWVkIGluc3RhbnRhbmVvdXNseSkgdG8gdGhlIGJvZHkuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIHRvcnF1ZSBmb3JjZSB3aXRoIGEgM0QtdmVjdG9yIG9yIHdpdGggM1xuICAgICAqIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHRvcnF1ZSBpbXB1bHNlIGluXG4gICAgICogd29ybGQtc3BhY2Ugb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKHRvcnF1ZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgbnVtYmVyc1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKDAsIDEwLCAwKTtcbiAgICAgKi9cbiAgICBhcHBseVRvcnF1ZUltcHVsc2UoKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdLng7XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1swXS55O1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMF0uejtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMV07XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0VSUk9SOiBhcHBseVRvcnF1ZUltcHVsc2U6IGZ1bmN0aW9uIHRha2VzIDEgb3IgMyBhcmd1bWVudHMnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKGFtbW9WZWMxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3RhdGljLlxuICAgICAqL1xuICAgIGlzU3RhdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX1NUQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIG9mIHR5cGUge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ30gb3Ige0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzdGF0aWMgb3Iga2luZW1hdGljLlxuICAgICAqL1xuICAgIGlzU3RhdGljT3JLaW5lbWF0aWMoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfU1RBVElDIHx8IHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIG9mIHR5cGUge0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBraW5lbWF0aWMuXG4gICAgICovXG4gICAgaXNLaW5lbWF0aWMoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfS0lORU1BVElDKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXcml0ZXMgYW4gZW50aXR5IHRyYW5zZm9ybSBpbnRvIGFuIEFtbW8uYnRUcmFuc2Zvcm0gYnV0IGlnbm9yaW5nIHNjYWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHRyYW5zZm9ybSAtIFRoZSBhbW1vIHRyYW5zZm9ybSB0byB3cml0ZSB0aGUgZW50aXR5IHRyYW5zZm9ybSB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRFbnRpdHlUcmFuc2Zvcm0odHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBjb25zdCBwb3MgPSBlbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgcm90ID0gZW50aXR5LmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgYW1tb1ZlYzEuc2V0VmFsdWUocG9zLngsIHBvcy55LCBwb3Mueik7XG4gICAgICAgIGFtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcblxuICAgICAgICB0cmFuc2Zvcm0uc2V0T3JpZ2luKGFtbW9WZWMxKTtcbiAgICAgICAgdHJhbnNmb3JtLnNldFJvdGF0aW9uKGFtbW9RdWF0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHJpZ2lkIGJvZHkgdHJhbnNmb3JtIHRvIGJlIHRoZSBzYW1lIGFzIHRoZSBFbnRpdHkgdHJhbnNmb3JtLiBUaGlzIG11c3QgYmUgY2FsbGVkXG4gICAgICogYWZ0ZXIgYW55IEVudGl0eSB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbnMgKGUuZy4ge0BsaW5rIEVudGl0eSNzZXRQb3NpdGlvbn0pIGFyZSBjYWxsZWQgaW5cbiAgICAgKiBvcmRlciB0byB1cGRhdGUgdGhlIHJpZ2lkIGJvZHkgdG8gbWF0Y2ggdGhlIEVudGl0eS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc3luY0VudGl0eVRvQm9keSgpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9nZXRFbnRpdHlUcmFuc2Zvcm0oYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIGJvZHkuc2V0V29ybGRUcmFuc2Zvcm0oYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IGJvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbW90aW9uU3RhdGUuc2V0V29ybGRUcmFuc2Zvcm0oYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhbiBlbnRpdHkncyB0cmFuc2Zvcm0gdG8gbWF0Y2ggdGhhdCBvZiB0aGUgd29ybGQgdHJhbnNmb3JtYXRpb24gbWF0cml4IG9mIGEgZHluYW1pY1xuICAgICAqIHJpZ2lkIGJvZHkncyBtb3Rpb24gc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVEeW5hbWljKCkge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcblxuICAgICAgICAvLyBJZiBhIGR5bmFtaWMgYm9keSBpcyBmcm96ZW4sIHdlIGNhbiBhc3N1bWUgaXRzIG1vdGlvbiBzdGF0ZSB0cmFuc2Zvcm0gaXNcbiAgICAgICAgLy8gdGhlIHNhbWUgaXMgdGhlIGVudGl0eSB3b3JsZCB0cmFuc2Zvcm1cbiAgICAgICAgaWYgKGJvZHkuaXNBY3RpdmUoKSkge1xuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBtb3Rpb24gc3RhdGUuIE5vdGUgdGhhdCB0aGUgdGVzdCBmb3IgdGhlIHByZXNlbmNlIG9mIHRoZSBtb3Rpb25cbiAgICAgICAgICAgIC8vIHN0YXRlIGlzIHRlY2huaWNhbGx5IHJlZHVuZGFudCBzaW5jZSB0aGUgZW5naW5lIGNyZWF0ZXMgb25lIGZvciBhbGwgYm9kaWVzLlxuICAgICAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSBib2R5LmdldE1vdGlvblN0YXRlKCk7XG4gICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICBtb3Rpb25TdGF0ZS5nZXRXb3JsZFRyYW5zZm9ybShhbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHAgPSBhbW1vVHJhbnNmb3JtLmdldE9yaWdpbigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHEgPSBhbW1vVHJhbnNmb3JtLmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24ocC54KCksIHAueSgpLCBwLnooKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0Um90YXRpb24ocS54KCksIHEueSgpLCBxLnooKSwgcS53KCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGVzIHRoZSBlbnRpdHkncyB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggaW50byB0aGUgbW90aW9uIHN0YXRlIG9mIGEga2luZW1hdGljIGJvZHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVLaW5lbWF0aWMoKSB7XG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gdGhpcy5fYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2dldEVudGl0eVRyYW5zZm9ybShhbW1vVHJhbnNmb3JtKTtcbiAgICAgICAgICAgIG1vdGlvblN0YXRlLnNldFdvcmxkVHJhbnNmb3JtKGFtbW9UcmFuc2Zvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGVsZXBvcnQgYW4gZW50aXR5IHRvIGEgbmV3IHdvcmxkLXNwYWNlIHBvc2l0aW9uLCBvcHRpb25hbGx5IHNldHRpbmcgb3JpZW50YXRpb24uIFRoaXNcbiAgICAgKiBmdW5jdGlvbiBzaG91bGQgb25seSBiZSBjYWxsZWQgZm9yIHJpZ2lkIGJvZGllcyB0aGF0IGFyZSBkeW5hbWljLiBUaGlzIGZ1bmN0aW9uIGhhcyB0aHJlZVxuICAgICAqIHZhbGlkIHNpZ25hdHVyZXMuIFRoZSBmaXJzdCB0YWtlcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGZvciB0aGUgcG9zaXRpb24gYW5kIGFuIG9wdGlvbmFsXG4gICAgICogMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIEV1bGVyIHJvdGF0aW9uLiBUaGUgc2Vjb25kIHRha2VzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIHRoZVxuICAgICAqIHBvc2l0aW9uIGFuZCBhbiBvcHRpb25hbCBxdWF0ZXJuaW9uIGZvciByb3RhdGlvbi4gVGhlIHRoaXJkIHRha2VzIDMgbnVtYmVycyBmb3IgdGhlIHBvc2l0aW9uXG4gICAgICogYW5kIGFuIG9wdGlvbmFsIDMgbnVtYmVycyBmb3IgRXVsZXIgcm90YXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHRoZSBuZXcgcG9zaXRpb24gb3IgdGhlIG5ldyBwb3NpdGlvblxuICAgICAqIHgtY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8UXVhdHxudW1iZXJ9IHkgLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIG9yIHF1YXRlcm5pb24gaG9sZGluZyB0aGUgbmV3IHJvdGF0aW9uXG4gICAgICogb3IgdGhlIG5ldyBwb3NpdGlvbiB5LWNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBuZXcgcG9zaXRpb24gei1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcnhdIC0gVGhlIG5ldyBFdWxlciB4LWFuZ2xlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcnldIC0gVGhlIG5ldyBFdWxlciB5LWFuZ2xlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcnpdIC0gVGhlIG5ldyBFdWxlciB6LWFuZ2xlIHZhbHVlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB0aGUgb3JpZ2luXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydChwYy5WZWMzLlpFUk8pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB0aGUgb3JpZ2luXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydCgwLCAwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBbMSwgMiwgM10gYW5kIHJlc2V0IG9yaWVudGF0aW9uXG4gICAgICogdmFyIHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydChwb3NpdGlvbiwgcGMuVmVjMy5aRVJPKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBbMSwgMiwgM10gYW5kIHJlc2V0IG9yaWVudGF0aW9uXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS50ZWxlcG9ydCgxLCAyLCAzLCAwLCAwLCAwKTtcbiAgICAgKi9cbiAgICB0ZWxlcG9ydCgpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzWzBdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24oYXJndW1lbnRzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhcmd1bWVudHNbMV0pIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgUXVhdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbihhcmd1bWVudHNbMV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gNikge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldEV1bGVyQW5nbGVzKGFyZ3VtZW50c1szXSwgYXJndW1lbnRzWzRdLCBhcmd1bWVudHNbNV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24oYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zeW5jRW50aXR5VG9Cb2R5KCk7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYm9keSkge1xuICAgICAgICAgICAgdGhpcy5jcmVhdGVCb2R5KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbImFtbW9UcmFuc2Zvcm0iLCJhbW1vVmVjMSIsImFtbW9WZWMyIiwiYW1tb1F1YXQiLCJhbW1vT3JpZ2luIiwiUmlnaWRCb2R5Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfYW5ndWxhckRhbXBpbmciLCJfYW5ndWxhckZhY3RvciIsIlZlYzMiLCJfYW5ndWxhclZlbG9jaXR5IiwiX2JvZHkiLCJfZnJpY3Rpb24iLCJfZ3JvdXAiLCJCT0RZR1JPVVBfU1RBVElDIiwiX2xpbmVhckRhbXBpbmciLCJfbGluZWFyRmFjdG9yIiwiX2xpbmVhclZlbG9jaXR5IiwiX21hc2siLCJCT0RZTUFTS19OT1RfU1RBVElDIiwiX21hc3MiLCJfcmVzdGl0dXRpb24iLCJfcm9sbGluZ0ZyaWN0aW9uIiwiX3NpbXVsYXRpb25FbmFibGVkIiwiX3R5cGUiLCJCT0RZVFlQRV9TVEFUSUMiLCJvbkxpYnJhcnlMb2FkZWQiLCJBbW1vIiwiYnRUcmFuc2Zvcm0iLCJidFZlY3RvcjMiLCJidFF1YXRlcm5pb24iLCJhbmd1bGFyRGFtcGluZyIsImRhbXBpbmciLCJzZXREYW1waW5nIiwiYW5ndWxhckZhY3RvciIsImZhY3RvciIsImVxdWFscyIsImNvcHkiLCJCT0RZVFlQRV9EWU5BTUlDIiwic2V0VmFsdWUiLCJ4IiwieSIsInoiLCJzZXRBbmd1bGFyRmFjdG9yIiwiYW5ndWxhclZlbG9jaXR5IiwidmVsb2NpdHkiLCJhY3RpdmF0ZSIsInNldEFuZ3VsYXJWZWxvY2l0eSIsImdldEFuZ3VsYXJWZWxvY2l0eSIsInNldCIsImJvZHkiLCJmcmljdGlvbiIsInNldEZyaWN0aW9uIiwiZ3JvdXAiLCJlbmFibGVkIiwiZGlzYWJsZVNpbXVsYXRpb24iLCJlbmFibGVTaW11bGF0aW9uIiwibGluZWFyRGFtcGluZyIsImxpbmVhckZhY3RvciIsInNldExpbmVhckZhY3RvciIsImxpbmVhclZlbG9jaXR5Iiwic2V0TGluZWFyVmVsb2NpdHkiLCJnZXRMaW5lYXJWZWxvY2l0eSIsIm1hc2siLCJtYXNzIiwiZ2V0Q29sbGlzaW9uU2hhcGUiLCJjYWxjdWxhdGVMb2NhbEluZXJ0aWEiLCJzZXRNYXNzUHJvcHMiLCJ1cGRhdGVJbmVydGlhVGVuc29yIiwicmVzdGl0dXRpb24iLCJzZXRSZXN0aXR1dGlvbiIsInJvbGxpbmdGcmljdGlvbiIsInNldFJvbGxpbmdGcmljdGlvbiIsInR5cGUiLCJCT0RZR1JPVVBfRFlOQU1JQyIsIkJPRFlNQVNLX0FMTCIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIkJPRFlHUk9VUF9LSU5FTUFUSUMiLCJjcmVhdGVCb2R5Iiwic2hhcGUiLCJjb2xsaXNpb24iLCJ0cmlnZ2VyIiwiZGVzdHJveSIsIm9uUmVtb3ZlIiwiX2dldEVudGl0eVRyYW5zZm9ybSIsInNldENvbGxpc2lvbkZsYWdzIiwiZ2V0Q29sbGlzaW9uRmxhZ3MiLCJCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUIiwic2V0QWN0aXZhdGlvblN0YXRlIiwiQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OIiwiaXNBY3RpdmUiLCJhZGRCb2R5IiwiX2R5bmFtaWMiLCJwdXNoIiwiZm9yY2VBY3RpdmF0aW9uU3RhdGUiLCJCT0RZU1RBVEVfQUNUSVZFX1RBRyIsInN5bmNFbnRpdHlUb0JvZHkiLCJfa2luZW1hdGljIiwiX2NvbXBvdW5kcyIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJyZW1vdmVCb2R5IiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsImFwcGx5Rm9yY2UiLCJweCIsInB5IiwicHoiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJhcHBseVRvcnF1ZSIsIkRlYnVnIiwiZXJyb3IiLCJhcHBseUltcHVsc2UiLCJhcHBseVRvcnF1ZUltcHVsc2UiLCJpc1N0YXRpYyIsImlzU3RhdGljT3JLaW5lbWF0aWMiLCJpc0tpbmVtYXRpYyIsInRyYW5zZm9ybSIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJ3Iiwic2V0T3JpZ2luIiwic2V0Um90YXRpb24iLCJzZXRXb3JsZFRyYW5zZm9ybSIsIm1vdGlvblN0YXRlIiwiZ2V0TW90aW9uU3RhdGUiLCJfdXBkYXRlRHluYW1pYyIsImdldFdvcmxkVHJhbnNmb3JtIiwicCIsImdldE9yaWdpbiIsInEiLCJzZXRQb3NpdGlvbiIsIl91cGRhdGVLaW5lbWF0aWMiLCJ0ZWxlcG9ydCIsIlF1YXQiLCJzZXRFdWxlckFuZ2xlcyIsIm9uRW5hYmxlIiwib25EaXNhYmxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQWtCQSxJQUFJQSxhQUFhLENBQUE7QUFDakIsSUFBSUMsUUFBUSxFQUFFQyxRQUFRLEVBQUVDLFFBQVEsRUFBRUMsVUFBVSxDQUFBOztBQXNDNUMsTUFBTUMsa0JBQWtCLFNBQVNDLFNBQVMsQ0FBQztBQU92Q0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUVyQixJQUFJLENBQUNDLGVBQWUsR0FBRyxDQUFDLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsSUFBSUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDdkMsSUFBQSxJ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
