/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYGROUP_STATIC, BODYMASK_NOT_STATIC, BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYGROUP_KINEMATIC, BODYMASK_ALL, BODYGROUP_DYNAMIC, BODYFLAG_KINEMATIC_OBJECT, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from './constants.js';
import { Component } from '../component.js';

let _ammoTransform;
let _ammoVec1, _ammoVec2, _ammoQuat;
const _quat1 = new Quat();
const _quat2 = new Quat();
const _vec3 = new Vec3();

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
      _ammoTransform = new Ammo.btTransform();
      _ammoVec1 = new Ammo.btVector3();
      _ammoVec2 = new Ammo.btVector3();
      _ammoQuat = new Ammo.btQuaternion();
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
        _ammoVec1.setValue(factor.x, factor.y, factor.z);
        this._body.setAngularFactor(_ammoVec1);
      }
    }
  }
  get angularFactor() {
    return this._angularFactor;
  }

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
        _ammoVec1.setValue(factor.x, factor.y, factor.z);
        this._body.setLinearFactor(_ammoVec1);
      }
    }
  }
  get linearFactor() {
    return this._linearFactor;
  }

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

        this._body.getCollisionShape().calculateLocalInertia(mass, _ammoVec1);
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

  _updateDynamic() {
    const body = this._body;

    if (body.isActive()) {
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

  _updateKinematic() {
    const motionState = this._body.getMotionState();
    if (motionState) {
      this._getEntityTransform(_ammoTransform);
      motionState.setWorldTransform(_ammoTransform);
    }
  }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWVRZUEVfU1RBVElDLFxuICAgIEJPRFlHUk9VUF9EWU5BTUlDLCBCT0RZR1JPVVBfS0lORU1BVElDLCBCT0RZR1JPVVBfU1RBVElDLFxuICAgIEJPRFlNQVNLX0FMTCwgQk9EWU1BU0tfTk9UX1NUQVRJQyxcbiAgICBCT0RZU1RBVEVfQUNUSVZFX1RBRywgQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OLCBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OLFxuICAgIEJPRFlUWVBFX0RZTkFNSUMsIEJPRFlUWVBFX0tJTkVNQVRJQ1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vLyBTaGFyZWQgbWF0aCB2YXJpYWJsZSB0byBhdm9pZCBleGNlc3NpdmUgYWxsb2NhdGlvblxubGV0IF9hbW1vVHJhbnNmb3JtO1xubGV0IF9hbW1vVmVjMSwgX2FtbW9WZWMyLCBfYW1tb1F1YXQ7XG5jb25zdCBfcXVhdDEgPSBuZXcgUXVhdCgpO1xuY29uc3QgX3F1YXQyID0gbmV3IFF1YXQoKTtcbmNvbnN0IF92ZWMzID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBUaGUgcmlnaWRib2R5IGNvbXBvbmVudCwgd2hlbiBjb21iaW5lZCB3aXRoIGEge0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudH0sIGFsbG93cyB5b3VyIGVudGl0aWVzXG4gKiB0byBiZSBzaW11bGF0ZWQgdXNpbmcgcmVhbGlzdGljIHBoeXNpY3MuIEEgcmlnaWRib2R5IGNvbXBvbmVudCB3aWxsIGZhbGwgdW5kZXIgZ3Jhdml0eSBhbmRcbiAqIGNvbGxpZGUgd2l0aCBvdGhlciByaWdpZCBib2RpZXMuIFVzaW5nIHNjcmlwdHMsIHlvdSBjYW4gYXBwbHkgZm9yY2VzIGFuZCBpbXB1bHNlcyB0byByaWdpZFxuICogYm9kaWVzLlxuICpcbiAqIFlvdSBzaG91bGQgbmV2ZXIgbmVlZCB0byB1c2UgdGhlIFJpZ2lkQm9keUNvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIFJpZ2lkQm9keUNvbXBvbmVudCB0b1xuICogYSB7QGxpbmsgRW50aXR5fSwgdXNlIHtAbGluayBFbnRpdHkjYWRkQ29tcG9uZW50fTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBDcmVhdGUgYSBzdGF0aWMgMXgxeDEgYm94LXNoYXBlZCByaWdpZCBib2R5XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhICdzdGF0aWMnIGJvZHlcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJjb2xsaXNpb25cIik7IC8vIFdpdGhvdXQgb3B0aW9ucywgdGhpcyBkZWZhdWx0cyB0byBhIDF4MXgxIGJveCBzaGFwZVxuICogYGBgXG4gKlxuICogVG8gY3JlYXRlIGEgZHluYW1pYyBzcGhlcmUgd2l0aCBtYXNzIG9mIDEwLCBkbzpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIiwge1xuICogICAgIHR5cGU6IHBjLkJPRFlUWVBFX0RZTkFNSUMsXG4gKiAgICAgbWFzczogMTBcbiAqIH0pO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcImNvbGxpc2lvblwiLCB7XG4gKiAgICAgdHlwZTogXCJzcGhlcmVcIlxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICpcbiAqIC0gW0ZhbGxpbmcgc2hhcGVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3BoeXNpY3MvZmFsbGluZy1zaGFwZXMpXG4gKiAtIFtWZWhpY2xlIHBoeXNpY3NdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jcGh5c2ljcy92ZWhpY2xlKVxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfYW5ndWxhckRhbXBpbmcgPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2FuZ3VsYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9hbmd1bGFyVmVsb2NpdHkgPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2JvZHkgPSBudWxsO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZyaWN0aW9uID0gMC41O1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJEYW1waW5nID0gMDtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saW5lYXJWZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbWFzcyA9IDE7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVzdGl0dXRpb24gPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JvbGxpbmdGcmljdGlvbiA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF90eXBlID0gQk9EWVRZUEVfU1RBVElDO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJpZ2lkQm9keUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoaXMgY29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdXNlbGVzcy1jb25zdHJ1Y3RvclxuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGNvbnRhY3Qgb2NjdXJzIGJldHdlZW4gdHdvIHJpZ2lkIGJvZGllcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjY29udGFjdFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0YXJ0IHRvdWNoaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudCNjb2xsaXNpb25zdGFydFxuICAgICAqIEBwYXJhbSB7Q29udGFjdFJlc3VsdH0gcmVzdWx0IC0gRGV0YWlscyBvZiB0aGUgY29udGFjdCBiZXR3ZWVuIHRoZSB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0d28gcmlnaWQgYm9kaWVzIHN0b3AgdG91Y2hpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I2NvbGxpc2lvbmVuZFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgc3RvcHBlZCB0b3VjaGluZyB0aGlzIHJpZ2lkIGJvZHkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBlbnRlcnMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmVudGVyXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBlbnRlcmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHJpZ2lkIGJvZHkgZXhpdHMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmxlYXZlXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gb3RoZXIgLSBUaGUge0BsaW5rIEVudGl0eX0gd2l0aCB0cmlnZ2VyIHZvbHVtZSB0aGF0IHRoaXMgcmlnaWQgYm9keSBleGl0ZWQuXG4gICAgICovXG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIHN0YXRpYyBvbkxpYnJhcnlMb2FkZWQoKSB7XG4gICAgICAgIC8vIExhemlseSBjcmVhdGUgc2hhcmVkIHZhcmlhYmxlXG4gICAgICAgIGlmICh0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIF9hbW1vVHJhbnNmb3JtID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIF9hbW1vVmVjMSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgX2FtbW9WZWMyID0gbmV3IEFtbW8uYnRWZWN0b3IzKCk7XG4gICAgICAgICAgICBfYW1tb1F1YXQgPSBuZXcgQW1tby5idFF1YXRlcm5pb24oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIHRoZSByYXRlIGF0IHdoaWNoIGEgYm9keSBsb3NlcyBhbmd1bGFyIHZlbG9jaXR5IG92ZXIgdGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuZ3VsYXJEYW1waW5nKGRhbXBpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJEYW1waW5nICE9PSBkYW1waW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKHRoaXMuX2xpbmVhckRhbXBpbmcsIGRhbXBpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckRhbXBpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2NhbGluZyBmYWN0b3IgZm9yIGFuZ3VsYXIgbW92ZW1lbnQgb2YgdGhlIGJvZHkgaW4gZWFjaCBheGlzLiBPbmx5IHZhbGlkIGZvciByaWdpZCBib2RpZXMgb2ZcbiAgICAgKiB0eXBlIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfS4gRGVmYXVsdHMgdG8gMSBpbiBhbGwgYXhlcyAoYm9keSBjYW4gZnJlZWx5IHJvdGF0ZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhckZhY3RvcihmYWN0b3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyRmFjdG9yLmNvcHkoZmFjdG9yKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShmYWN0b3IueCwgZmFjdG9yLnksIGZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldEFuZ3VsYXJGYWN0b3IoX2FtbW9WZWMxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckZhY3RvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIHRoZSByb3RhdGlvbmFsIHNwZWVkIG9mIHRoZSBib2R5IGFyb3VuZCBlYWNoIHdvcmxkIGF4aXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRBbmd1bGFyVmVsb2NpdHkoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5LmNvcHkodmVsb2NpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldEFuZ3VsYXJWZWxvY2l0eSgpO1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5LnNldCh2ZWxvY2l0eS54KCksIHZlbG9jaXR5LnkoKSwgdmVsb2NpdHkueigpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIHNldCBib2R5KGJvZHkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgIT09IGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkgPSBib2R5O1xuXG4gICAgICAgICAgICBpZiAoYm9keSAmJiB0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBib2R5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYm9keTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJpY3Rpb24gdmFsdWUgdXNlZCB3aGVuIGNvbnRhY3RzIG9jY3VyIGJldHdlZW4gdHdvIGJvZGllcy4gQSBoaWdoZXIgdmFsdWUgaW5kaWNhdGVzXG4gICAgICogbW9yZSBmcmljdGlvbi4gU2hvdWxkIGJlIHNldCBpbiB0aGUgcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byAwLjUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmcmljdGlvbihmcmljdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fZnJpY3Rpb24gIT09IGZyaWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9mcmljdGlvbiA9IGZyaWN0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0RnJpY3Rpb24oZnJpY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZyaWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZnJpY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbGxpc2lvbiBncm91cCB0aGlzIGJvZHkgYmVsb25ncyB0by4gQ29tYmluZSB0aGUgZ3JvdXAgYW5kIHRoZSBtYXNrIHRvIHByZXZlbnQgYm9kaWVzXG4gICAgICogY29sbGlkaW5nIHdpdGggZWFjaCBvdGhlci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGdyb3VwKGdyb3VwKSB7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCAhPT0gZ3JvdXApIHtcbiAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gZ3JvdXA7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZ3JvdXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ncm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyB0aGUgcmF0ZSBhdCB3aGljaCBhIGJvZHkgbG9zZXMgbGluZWFyIHZlbG9jaXR5IG92ZXIgdGltZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpbmVhckRhbXBpbmcoZGFtcGluZykge1xuICAgICAgICBpZiAodGhpcy5fbGluZWFyRGFtcGluZyAhPT0gZGFtcGluZykge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyRGFtcGluZyA9IGRhbXBpbmc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXREYW1waW5nKGRhbXBpbmcsIHRoaXMuX2FuZ3VsYXJEYW1waW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJEYW1waW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRGFtcGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTY2FsaW5nIGZhY3RvciBmb3IgbGluZWFyIG1vdmVtZW50IG9mIHRoZSBib2R5IGluIGVhY2ggYXhpcy4gT25seSB2YWxpZCBmb3IgcmlnaWQgYm9kaWVzIG9mXG4gICAgICogdHlwZSB7QGxpbmsgQk9EWVRZUEVfRFlOQU1JQ30uIERlZmF1bHRzIHRvIDEgaW4gYWxsIGF4ZXMgKGJvZHkgY2FuIGZyZWVseSBtb3ZlKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIHNldCBsaW5lYXJGYWN0b3IoZmFjdG9yKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGluZWFyRmFjdG9yLmVxdWFscyhmYWN0b3IpKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJGYWN0b3IuY29weShmYWN0b3IpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGZhY3Rvci54LCBmYWN0b3IueSwgZmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TGluZWFyRmFjdG9yKF9hbW1vVmVjMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyRmFjdG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgdGhlIHNwZWVkIG9mIHRoZSBib2R5IGluIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGxpbmVhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHZlbG9jaXR5LngsIHZlbG9jaXR5LnksIHZlbG9jaXR5LnopO1xuICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRMaW5lYXJWZWxvY2l0eShfYW1tb1ZlYzEpO1xuXG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5jb3B5KHZlbG9jaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldExpbmVhclZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5zZXQodmVsb2NpdHkueCgpLCB2ZWxvY2l0eS55KCksIHZlbG9jaXR5LnooKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xsaXNpb24gbWFzayBzZXRzIHdoaWNoIGdyb3VwcyB0aGlzIGJvZHkgY29sbGlkZXMgd2l0aC4gSXQgaXMgYSBiaXRmaWVsZCBvZiAxNiBiaXRzLFxuICAgICAqIHRoZSBmaXJzdCA4IGJpdHMgYXJlIHJlc2VydmVkIGZvciBlbmdpbmUgdXNlLiBEZWZhdWx0cyB0byA2NTUzNS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hc2sobWFzaykge1xuICAgICAgICBpZiAodGhpcy5fbWFzayAhPT0gbWFzaykge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IG1hc2s7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hc3Mgb2YgdGhlIGJvZHkuIFRoaXMgaXMgb25seSByZWxldmFudCBmb3Ige0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9IGJvZGllcywgb3RoZXIgdHlwZXNcbiAgICAgKiBoYXZlIGluZmluaXRlIG1hc3MuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNzKG1hc3MpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc3MgIT09IG1hc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc3MgPSBtYXNzO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgICAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGVMb2NhbEluZXJ0aWEgd3JpdGVzIGxvY2FsIGluZXJ0aWEgdG8gYW1tb1ZlYzEgaGVyZS4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuZ2V0Q29sbGlzaW9uU2hhcGUoKS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgX2FtbW9WZWMxKTtcbiAgICAgICAgICAgICAgICAvLyAuLi5hbmQgdGhlbiB3cml0ZXMgdGhlIGNhbGN1bGF0ZWQgbG9jYWwgaW5lcnRpYSB0byB0aGUgYm9keVxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TWFzc1Byb3BzKG1hc3MsIF9hbW1vVmVjMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS51cGRhdGVJbmVydGlhVGVuc29yKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5mbHVlbmNlcyB0aGUgYW1vdW50IG9mIGVuZXJneSBsb3N0IHdoZW4gdHdvIHJpZ2lkIGJvZGllcyBjb2xsaWRlLiBUaGUgY2FsY3VsYXRpb25cbiAgICAgKiBtdWx0aXBsaWVzIHRoZSByZXN0aXR1dGlvbiB2YWx1ZXMgZm9yIGJvdGggY29sbGlkaW5nIGJvZGllcy4gQSBtdWx0aXBsaWVkIHZhbHVlIG9mIDAgbWVhbnNcbiAgICAgKiB0aGF0IGFsbCBlbmVyZ3kgaXMgbG9zdCBpbiB0aGUgY29sbGlzaW9uIHdoaWxlIGEgdmFsdWUgb2YgMSBtZWFucyB0aGF0IG5vIGVuZXJneSBpcyBsb3N0LlxuICAgICAqIFNob3VsZCBiZSBzZXQgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlc3RpdHV0aW9uKHJlc3RpdHV0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZXN0aXR1dGlvbiAhPT0gcmVzdGl0dXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc3RpdHV0aW9uID0gcmVzdGl0dXRpb247XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRSZXN0aXR1dGlvbihyZXN0aXR1dGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVzdGl0dXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXN0aXR1dGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgdG9yc2lvbmFsIGZyaWN0aW9uIG9ydGhvZ29uYWwgdG8gdGhlIGNvbnRhY3QgcG9pbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByb2xsaW5nRnJpY3Rpb24oZnJpY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuX3JvbGxpbmdGcmljdGlvbiAhPT0gZnJpY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3JvbGxpbmdGcmljdGlvbiA9IGZyaWN0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKGZyaWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByb2xsaW5nRnJpY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb2xsaW5nRnJpY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJpZ2lkIGJvZHkgdHlwZSBkZXRlcm1pbmVzIGhvdyB0aGUgYm9keSBpcyBzaW11bGF0ZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ306IGluZmluaXRlIG1hc3MgYW5kIGNhbm5vdCBtb3ZlLlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9OiBzaW11bGF0ZWQgYWNjb3JkaW5nIHRvIGFwcGxpZWQgZm9yY2VzLlxuICAgICAqIC0ge0BsaW5rIEJPRFlUWVBFX0tJTkVNQVRJQ306IGluZmluaXRlIG1hc3MgYW5kIGRvZXMgbm90IHJlc3BvbmQgdG8gZm9yY2VzIChjYW4gb25seSBiZVxuICAgICAqIG1vdmVkIGJ5IHNldHRpbmcgdGhlIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBjb21wb25lbnQncyB7QGxpbmsgRW50aXR5fSkuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodHlwZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gdHlwZSkge1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IHR5cGU7XG5cbiAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcblxuICAgICAgICAgICAgLy8gc2V0IGdyb3VwIGFuZCBtYXNrIHRvIGRlZmF1bHRzIGZvciB0eXBlXG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX0RZTkFNSUM6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX0RZTkFNSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19BTEw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9LSU5FTUFUSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19BTEw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyb3VwID0gQk9EWUdST1VQX1NUQVRJQztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFzayA9IEJPRFlNQVNLX05PVF9TVEFUSUM7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBuZXcgYm9keVxuICAgICAgICAgICAgdGhpcy5jcmVhdGVCb2R5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIEVudGl0eSBoYXMgYSBDb2xsaXNpb24gc2hhcGUgYXR0YWNoZWQgdGhlbiBjcmVhdGUgYSByaWdpZCBib2R5IHVzaW5nIHRoaXMgc2hhcGUuIFRoaXNcbiAgICAgKiBtZXRob2QgZGVzdHJveXMgdGhlIGV4aXN0aW5nIGJvZHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNyZWF0ZUJvZHkoKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBsZXQgc2hhcGU7XG5cbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24pIHtcbiAgICAgICAgICAgIHNoYXBlID0gZW50aXR5LmNvbGxpc2lvbi5zaGFwZTtcblxuICAgICAgICAgICAgLy8gaWYgYSB0cmlnZ2VyIHdhcyBhbHJlYWR5IGNyZWF0ZWQgZnJvbSB0aGUgY29sbGlzaW9uIHN5c3RlbVxuICAgICAgICAgICAgLy8gZGVzdHJveSBpdFxuICAgICAgICAgICAgaWYgKGVudGl0eS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LnRyaWdnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBlbnRpdHkudHJpZ2dlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaGFwZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpXG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0ub25SZW1vdmUoZW50aXR5LCB0aGlzKTtcblxuICAgICAgICAgICAgY29uc3QgbWFzcyA9IHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMgPyB0aGlzLl9tYXNzIDogMDtcblxuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuc3lzdGVtLmNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRSZXN0aXR1dGlvbih0aGlzLl9yZXN0aXR1dGlvbik7XG4gICAgICAgICAgICBib2R5LnNldEZyaWN0aW9uKHRoaXMuX2ZyaWN0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0Um9sbGluZ0ZyaWN0aW9uKHRoaXMuX3JvbGxpbmdGcmljdGlvbik7XG4gICAgICAgICAgICBib2R5LnNldERhbXBpbmcodGhpcy5fbGluZWFyRGFtcGluZywgdGhpcy5fYW5ndWxhckRhbXBpbmcpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVhckZhY3RvciA9IHRoaXMuX2xpbmVhckZhY3RvcjtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUobGluZWFyRmFjdG9yLngsIGxpbmVhckZhY3Rvci55LCBsaW5lYXJGYWN0b3Iueik7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRMaW5lYXJGYWN0b3IoX2FtbW9WZWMxKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJGYWN0b3IgPSB0aGlzLl9hbmd1bGFyRmFjdG9yO1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZShhbmd1bGFyRmFjdG9yLngsIGFuZ3VsYXJGYWN0b3IueSwgYW5ndWxhckZhY3Rvci56KTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFuZ3VsYXJGYWN0b3IoX2FtbW9WZWMxKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfS0lORU1BVElDKSB7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRDb2xsaXNpb25GbGFncyhib2R5LmdldENvbGxpc2lvbkZsYWdzKCkgfCBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUKTtcbiAgICAgICAgICAgICAgICBib2R5LnNldEFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBib2R5LmVudGl0eSA9IGVudGl0eTtcblxuICAgICAgICAgICAgdGhpcy5ib2R5ID0gYm9keTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiBlbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIGN1cnJlbnRseSBhY3RpdmVseSBiZWluZyBzaW11bGF0ZWQuIEkuZS4gTm90ICdzbGVlcGluZycuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYm9keSBpcyBhY3RpdmUuXG4gICAgICovXG4gICAgaXNBY3RpdmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ib2R5ID8gdGhpcy5fYm9keS5pc0FjdGl2ZSgpIDogZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yY2libHkgYWN0aXZhdGUgdGhlIHJpZ2lkIGJvZHkgc2ltdWxhdGlvbi4gT25seSBhZmZlY3RzIHJpZ2lkIGJvZGllcyBvZiB0eXBlXG4gICAgICoge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9LlxuICAgICAqL1xuICAgIGFjdGl2YXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fYm9keS5hY3RpdmF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgYm9keSB0byB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmFibGVTaW11bGF0aW9uKCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24gJiYgZW50aXR5LmNvbGxpc2lvbi5lbmFibGVkICYmICF0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFkZEJvZHkoYm9keSwgdGhpcy5fZ3JvdXAsIHRoaXMuX21hc2spO1xuXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfRFlOQU1JQzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9keW5hbWljLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9BQ1RJVkVfVEFHKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfS0lORU1BVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2tpbmVtYXRpYy5wdXNoKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQk9EWVRZUEVfU1RBVElDOlxuICAgICAgICAgICAgICAgICAgICAgICAgYm9keS5mb3JjZUFjdGl2YXRpb25TdGF0ZShCT0RZU1RBVEVfQUNUSVZFX1RBRyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uLnR5cGUgPT09ICdjb21wb3VuZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2NvbXBvdW5kcy5wdXNoKGVudGl0eS5jb2xsaXNpb24pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhIGJvZHkgZnJvbSB0aGUgc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkaXNhYmxlU2ltdWxhdGlvbigpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5ICYmIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCBzeXN0ZW0gPSB0aGlzLnN5c3RlbTtcblxuICAgICAgICAgICAgbGV0IGlkeCA9IHN5c3RlbS5fY29tcG91bmRzLmluZGV4T2YodGhpcy5lbnRpdHkuY29sbGlzaW9uKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fY29tcG91bmRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZHggPSBzeXN0ZW0uX2R5bmFtaWMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fZHluYW1pYy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWR4ID0gc3lzdGVtLl9raW5lbWF0aWMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5fa2luZW1hdGljLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzeXN0ZW0ucmVtb3ZlQm9keShib2R5KTtcblxuICAgICAgICAgICAgLy8gc2V0IGFjdGl2YXRpb24gc3RhdGUgdG8gZGlzYWJsZSBzaW11bGF0aW9uIHRvIGF2b2lkIGJvZHkuaXNBY3RpdmUoKSB0byByZXR1cm5cbiAgICAgICAgICAgIC8vIHRydWUgZXZlbiBpZiBpdCdzIG5vdCBpbiB0aGUgZHluYW1pY3Mgd29ybGRcbiAgICAgICAgICAgIGJvZHkuZm9yY2VBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTik7XG5cbiAgICAgICAgICAgIHRoaXMuX3NpbXVsYXRpb25FbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBmb3JjZSB0byB0aGUgYm9keSBhdCBhIHBvaW50LiBCeSBkZWZhdWx0LCB0aGUgZm9yY2UgaXMgYXBwbGllZCBhdCB0aGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIGJvZHkuIEhvd2V2ZXIsIHRoZSBmb3JjZSBjYW4gYmUgYXBwbGllZCBhdCBhbiBvZmZzZXQgdGhpcyBwb2ludCBieSBzcGVjaWZ5aW5nIGEgd29ybGQgc3BhY2VcbiAgICAgKiB2ZWN0b3IgZnJvbSB0aGUgYm9keSdzIG9yaWdpbiB0byB0aGUgcG9pbnQgb2YgYXBwbGljYXRpb24uIFRoaXMgZnVuY3Rpb24gaGFzIHR3byB2YWxpZFxuICAgICAqIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIGZvcmNlIChhbmQgb3B0aW9uYWwgcmVsYXRpdmUgcG9pbnQpIHZpYSAzRC12ZWN0b3Igb3JcbiAgICAgKiBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0geCAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSBmb3JjZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtWZWMzfG51bWJlcn0gW3ldIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgcmVwcmVzZW50aW5nIHRoZSByZWxhdGl2ZSBwb2ludFxuICAgICAqIGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHdvcmxkLXNwYWNlIG9yIHRoZSB5LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweF0gLSBUaGUgeC1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtweV0gLSBUaGUgeS1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwel0gLSBUaGUgei1jb21wb25lbnQgb2YgYSB3b3JsZC1zcGFjZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIHBvc2l0aW9uXG4gICAgICogd2hlcmUgdGhlIGZvcmNlIGlzIGFwcGxpZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBhcHByb3hpbWF0aW9uIG9mIGdyYXZpdHkgYXQgdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZSgwLCAtMTAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gYXBwcm94aW1hdGlvbiBvZiBncmF2aXR5IGF0IDEgdW5pdCBkb3duIHRoZSB3b3JsZCBaIGZyb20gdGhlIGNlbnRlciBvZiB0aGUgYm9keVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKDAsIC0xMCwgMCwgMCwgMCwgMSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhIGZvcmNlIGF0IHRoZSBib2R5J3MgY2VudGVyXG4gICAgICogLy8gQ2FsY3VsYXRlIGEgZm9yY2UgdmVjdG9yIHBvaW50aW5nIGluIHRoZSB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gb2YgdGhlIGVudGl0eVxuICAgICAqIHZhciBmb3JjZSA9IHRoaXMuZW50aXR5LmZvcndhcmQuY2xvbmUoKS5tdWxTY2FsYXIoMTAwKTtcbiAgICAgKlxuICAgICAqIC8vIEFwcGx5IHRoZSBmb3JjZVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKGZvcmNlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGEgZm9yY2UgYXQgc29tZSByZWxhdGl2ZSBvZmZzZXQgZnJvbSB0aGUgYm9keSdzIGNlbnRlclxuICAgICAqIC8vIENhbGN1bGF0ZSBhIGZvcmNlIHZlY3RvciBwb2ludGluZyBpbiB0aGUgd29ybGQgc3BhY2UgZGlyZWN0aW9uIG9mIHRoZSBlbnRpdHlcbiAgICAgKiB2YXIgZm9yY2UgPSB0aGlzLmVudGl0eS5mb3J3YXJkLmNsb25lKCkubXVsU2NhbGFyKDEwMCk7XG4gICAgICpcbiAgICAgKiAvLyBDYWxjdWxhdGUgdGhlIHdvcmxkIHNwYWNlIHJlbGF0aXZlIG9mZnNldFxuICAgICAqIHZhciByZWxhdGl2ZVBvcyA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogdmFyIGNoaWxkRW50aXR5ID0gdGhpcy5lbnRpdHkuZmluZEJ5TmFtZSgnRW5naW5lJyk7XG4gICAgICogcmVsYXRpdmVQb3Muc3ViMihjaGlsZEVudGl0eS5nZXRQb3NpdGlvbigpLCB0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpKTtcbiAgICAgKlxuICAgICAqIC8vIEFwcGx5IHRoZSBmb3JjZVxuICAgICAqIHRoaXMuZW50aXR5LnJpZ2lkYm9keS5hcHBseUZvcmNlKGZvcmNlLCByZWxhdGl2ZVBvcyk7XG4gICAgICovXG4gICAgYXBwbHlGb3JjZSh4LCB5LCB6LCBweCwgcHksIHB6KSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeC54LCB4LnksIHgueik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHkgaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKHkueCwgeS55LCB5LnopO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChweCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMyLnNldFZhbHVlKHB4LCBweSwgcHopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoMCwgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuYXBwbHlGb3JjZShfYW1tb1ZlYzEsIF9hbW1vVmVjMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSB0b3JxdWUgKHJvdGF0aW9uYWwgZm9yY2UpIHRvIHRoZSBib2R5LiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhblxuICAgICAqIGVpdGhlciBzcGVjaWZ5IHRoZSB0b3JxdWUgZm9yY2Ugd2l0aCBhIDNELXZlY3RvciBvciB3aXRoIDMgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlXG4gICAgICogb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWUodG9ycXVlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSBudW1iZXJzXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZSgwLCAxMCwgMCk7XG4gICAgICovXG4gICAgYXBwbHlUb3JxdWUoeCwgeSwgeikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib2R5LmFwcGx5VG9ycXVlKF9hbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBpbXB1bHNlIChpbnN0YW50YW5lb3VzIGNoYW5nZSBvZiB2ZWxvY2l0eSkgdG8gdGhlIGJvZHkgYXQgYSBwb2ludC4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgaW1wdWxzZSAoYW5kIG9wdGlvbmFsIHJlbGF0aXZlIHBvaW50KVxuICAgICAqIHZpYSAzRC12ZWN0b3Igb3IgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHJlbGF0aXZlIHBvaW50XG4gICAgICogYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkgb3IgdGhlIHktY29tcG9uZW50IG9mIHRoZVxuICAgICAqIGltcHVsc2UgdG8gYXBwbHkgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSB0byBhcHBseSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B4XSAtIFRoZSB4LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCB0aGUgZW50aXR5J3MgcG9zaXRpb24uXG4gICAgICogdmFyIGltcHVsc2UgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoaW1wdWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiB2YXIgaW1wdWxzZSA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB2YXIgcmVsYXRpdmVQb2ludCA9IG5ldyBwYy5WZWMzKDAsIDAsIDEpO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlJbXB1bHNlKGltcHVsc2UsIHJlbGF0aXZlUG9pbnQpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IHRoZSBlbnRpdHkncyBwb3NpdGlvbi5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCwgMCwgMCwgMSk7XG4gICAgICovXG4gICAgYXBwbHlJbXB1bHNlKHgsIHksIHosIHB4LCBweSwgcHopIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMS5zZXRWYWx1ZSh4LngsIHgueSwgeC56KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUoeS54LCB5LnksIHkueik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHB4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzIuc2V0VmFsdWUocHgsIHB5LCBweik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hbW1vVmVjMi5zZXRWYWx1ZSgwLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYm9keS5hcHBseUltcHVsc2UoX2FtbW9WZWMxLCBfYW1tb1ZlYzIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYSB0b3JxdWUgaW1wdWxzZSAocm90YXRpb25hbCBmb3JjZSBhcHBsaWVkIGluc3RhbnRhbmVvdXNseSkgdG8gdGhlIGJvZHkuIFRoaXMgZnVuY3Rpb25cbiAgICAgKiBoYXMgdHdvIHZhbGlkIHNpZ25hdHVyZXMuIFlvdSBjYW4gZWl0aGVyIHNwZWNpZnkgdGhlIHRvcnF1ZSBmb3JjZSB3aXRoIGEgM0QtdmVjdG9yIG9yIHdpdGggM1xuICAgICAqIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSB4IC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHRvcnF1ZSBpbXB1bHNlIGluXG4gICAgICogd29ybGQtc3BhY2Ugb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ldIC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKHRvcnF1ZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSB2aWEgbnVtYmVyc1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKDAsIDEwLCAwKTtcbiAgICAgKi9cbiAgICBhcHBseVRvcnF1ZUltcHVsc2UoeCwgeSwgeikge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHgueCwgeC55LCB4LnopO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfYW1tb1ZlYzEuc2V0VmFsdWUoeCwgeSwgeik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJvZHkuYXBwbHlUb3JxdWVJbXB1bHNlKF9hbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgb2YgdHlwZSB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHN0YXRpYy5cbiAgICAgKi9cbiAgICBpc1N0YXRpYygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9TVEFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9IG9yIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgc3RhdGljIG9yIGtpbmVtYXRpYy5cbiAgICAgKi9cbiAgICBpc1N0YXRpY09yS2luZW1hdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX1NUQVRJQyB8fCB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBvZiB0eXBlIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYga2luZW1hdGljLlxuICAgICAqL1xuICAgIGlzS2luZW1hdGljKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGVzIGFuIGVudGl0eSB0cmFuc2Zvcm0gaW50byBhbiBBbW1vLmJ0VHJhbnNmb3JtIGJ1dCBpZ25vcmluZyBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB0cmFuc2Zvcm0gLSBUaGUgYW1tbyB0cmFuc2Zvcm0gdG8gd3JpdGUgdGhlIGVudGl0eSB0cmFuc2Zvcm0gdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0RW50aXR5VHJhbnNmb3JtKHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcblxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICBjb25zdCBib2R5UG9zID0gY29tcG9uZW50LmdldFNoYXBlUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHlSb3QgPSBjb21wb25lbnQuZ2V0U2hhcGVSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKGJvZHlQb3MueCwgYm9keVBvcy55LCBib2R5UG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKGJvZHlSb3QueCwgYm9keVJvdC55LCBib2R5Um90LnosIGJvZHlSb3Qudyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBlbnRpdHkuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGVudGl0eS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgX2FtbW9WZWMxLnNldFZhbHVlKHBvcy54LCBwb3MueSwgcG9zLnopO1xuICAgICAgICAgICAgX2FtbW9RdWF0LnNldFZhbHVlKHJvdC54LCByb3QueSwgcm90LnosIHJvdC53KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRPcmlnaW4oX2FtbW9WZWMxKTtcbiAgICAgICAgdHJhbnNmb3JtLnNldFJvdGF0aW9uKF9hbW1vUXVhdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSByaWdpZCBib2R5IHRyYW5zZm9ybSB0byBiZSB0aGUgc2FtZSBhcyB0aGUgRW50aXR5IHRyYW5zZm9ybS4gVGhpcyBtdXN0IGJlIGNhbGxlZFxuICAgICAqIGFmdGVyIGFueSBFbnRpdHkgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb25zIChlLmcuIHtAbGluayBFbnRpdHkjc2V0UG9zaXRpb259KSBhcmUgY2FsbGVkIGluXG4gICAgICogb3JkZXIgdG8gdXBkYXRlIHRoZSByaWdpZCBib2R5IHRvIG1hdGNoIHRoZSBFbnRpdHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHN5bmNFbnRpdHlUb0JvZHkoKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSkge1xuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKF9hbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IGJvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbW90aW9uU3RhdGUuc2V0V29ybGRUcmFuc2Zvcm0oX2FtbW9UcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYW4gZW50aXR5J3MgdHJhbnNmb3JtIHRvIG1hdGNoIHRoYXQgb2YgdGhlIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBvZiBhIGR5bmFtaWNcbiAgICAgKiByaWdpZCBib2R5J3MgbW90aW9uIHN0YXRlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlRHluYW1pYygpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG5cbiAgICAgICAgLy8gSWYgYSBkeW5hbWljIGJvZHkgaXMgZnJvemVuLCB3ZSBjYW4gYXNzdW1lIGl0cyBtb3Rpb24gc3RhdGUgdHJhbnNmb3JtIGlzXG4gICAgICAgIC8vIHRoZSBzYW1lIGlzIHRoZSBlbnRpdHkgd29ybGQgdHJhbnNmb3JtXG4gICAgICAgIGlmIChib2R5LmlzQWN0aXZlKCkpIHtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbW90aW9uIHN0YXRlLiBOb3RlIHRoYXQgdGhlIHRlc3QgZm9yIHRoZSBwcmVzZW5jZSBvZiB0aGUgbW90aW9uXG4gICAgICAgICAgICAvLyBzdGF0ZSBpcyB0ZWNobmljYWxseSByZWR1bmRhbnQgc2luY2UgdGhlIGVuZ2luZSBjcmVhdGVzIG9uZSBmb3IgYWxsIGJvZGllcy5cbiAgICAgICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICAgICAgaWYgKG1vdGlvblN0YXRlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5lbnRpdHk7XG5cbiAgICAgICAgICAgICAgICBtb3Rpb25TdGF0ZS5nZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwID0gX2FtbW9UcmFuc2Zvcm0uZ2V0T3JpZ2luKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcSA9IF9hbW1vVHJhbnNmb3JtLmdldFJvdGF0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBlbnRpdHkuY29sbGlzaW9uO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQgJiYgY29tcG9uZW50Ll9oYXNPZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG8gPSBjb21wb25lbnQuZGF0YS5saW5lYXJPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFvID0gY29tcG9uZW50LmRhdGEuYW5ndWxhck9mZnNldDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVbi1yb3RhdGUgdGhlIGFuZ3VsYXIgb2Zmc2V0IGFuZCB0aGVuIHVzZSB0aGUgbmV3IHJvdGF0aW9uIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHVuLXRyYW5zbGF0ZSB0aGUgbGluZWFyIG9mZnNldCBpbiBsb2NhbCBzcGFjZVxuICAgICAgICAgICAgICAgICAgICAvLyBPcmRlciBvZiBvcGVyYXRpb25zIG1hdHRlciBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmVydGVkQW8gPSBfcXVhdDIuY29weShhbykuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eVJvdCA9IF9xdWF0MS5zZXQocS54KCksIHEueSgpLCBxLnooKSwgcS53KCkpLm11bChpbnZlcnRlZEFvKTtcblxuICAgICAgICAgICAgICAgICAgICBlbnRpdHlSb3QudHJhbnNmb3JtVmVjdG9yKGxvLCBfdmVjMyk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zZXRQb3NpdGlvbihwLngoKSAtIF92ZWMzLngsIHAueSgpIC0gX3ZlYzMueSwgcC56KCkgLSBfdmVjMy56KTtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNldFJvdGF0aW9uKGVudGl0eVJvdCk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuc2V0UG9zaXRpb24ocC54KCksIHAueSgpLCBwLnooKSk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5zZXRSb3RhdGlvbihxLngoKSwgcS55KCksIHEueigpLCBxLncoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGVzIHRoZSBlbnRpdHkncyB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggaW50byB0aGUgbW90aW9uIHN0YXRlIG9mIGEga2luZW1hdGljIGJvZHkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVLaW5lbWF0aWMoKSB7XG4gICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gdGhpcy5fYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICBpZiAobW90aW9uU3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2dldEVudGl0eVRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgICAgICBtb3Rpb25TdGF0ZS5zZXRXb3JsZFRyYW5zZm9ybShfYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZWxlcG9ydCBhbiBlbnRpdHkgdG8gYSBuZXcgd29ybGQtc3BhY2UgcG9zaXRpb24sIG9wdGlvbmFsbHkgc2V0dGluZyBvcmllbnRhdGlvbi4gVGhpc1xuICAgICAqIGZ1bmN0aW9uIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmb3IgcmlnaWQgYm9kaWVzIHRoYXQgYXJlIGR5bmFtaWMuIFRoaXMgZnVuY3Rpb24gaGFzIHRocmVlXG4gICAgICogdmFsaWQgc2lnbmF0dXJlcy4gVGhlIGZpcnN0IHRha2VzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIHRoZSBwb3NpdGlvbiBhbmQgYW4gb3B0aW9uYWxcbiAgICAgKiAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgRXVsZXIgcm90YXRpb24uIFRoZSBzZWNvbmQgdGFrZXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgdGhlXG4gICAgICogcG9zaXRpb24gYW5kIGFuIG9wdGlvbmFsIHF1YXRlcm5pb24gZm9yIHJvdGF0aW9uLiBUaGUgdGhpcmQgdGFrZXMgMyBudW1iZXJzIGZvciB0aGUgcG9zaXRpb25cbiAgICAgKiBhbmQgYW4gb3B0aW9uYWwgMyBudW1iZXJzIGZvciBFdWxlciByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIG5ldyBwb3NpdGlvbiBvciB0aGUgbmV3IHBvc2l0aW9uXG4gICAgICogeC1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7UXVhdHxWZWMzfG51bWJlcn0gW3ldIC0gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciBvciBxdWF0ZXJuaW9uIGhvbGRpbmcgdGhlIG5ld1xuICAgICAqIHJvdGF0aW9uIG9yIHRoZSBuZXcgcG9zaXRpb24geS1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgbmV3IHBvc2l0aW9uIHotY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3J4XSAtIFRoZSBuZXcgRXVsZXIgeC1hbmdsZSB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3J5XSAtIFRoZSBuZXcgRXVsZXIgeS1hbmdsZSB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3J6XSAtIFRoZSBuZXcgRXVsZXIgei1hbmdsZSB2YWx1ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gdGhlIG9yaWdpblxuICAgICAqIGVudGl0eS5yaWdpZGJvZHkudGVsZXBvcnQocGMuVmVjMy5aRVJPKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFRlbGVwb3J0IHRoZSBlbnRpdHkgdG8gdGhlIG9yaWdpblxuICAgICAqIGVudGl0eS5yaWdpZGJvZHkudGVsZXBvcnQoMCwgMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgWzEsIDIsIDNdIGFuZCByZXNldCBvcmllbnRhdGlvblxuICAgICAqIHZhciBwb3NpdGlvbiA9IG5ldyBwYy5WZWMzKDEsIDIsIDMpO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkudGVsZXBvcnQocG9zaXRpb24sIHBjLlZlYzMuWkVSTyk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgWzEsIDIsIDNdIGFuZCByZXNldCBvcmllbnRhdGlvblxuICAgICAqIGVudGl0eS5yaWdpZGJvZHkudGVsZXBvcnQoMSwgMiwgMywgMCwgMCwgMCk7XG4gICAgICovXG4gICAgdGVsZXBvcnQoeCwgeSwgeiwgcngsIHJ5LCByeikge1xuICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uKHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24oeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoeSBpbnN0YW5jZW9mIFF1YXQpIHtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKHkpO1xuICAgICAgICB9IGVsc2UgaWYgKHkgaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcyh5KTtcbiAgICAgICAgfSBlbHNlIGlmIChyeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRFdWxlckFuZ2xlcyhyeCwgcnksIHJ6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgIH1cblxuICAgIC8qKiBAaWdub3JlICovXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYm9keSkge1xuICAgICAgICAgICAgdGhpcy5jcmVhdGVCb2R5KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICB9XG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmlnaWRCb2R5Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiX2FtbW9UcmFuc2Zvcm0iLCJfYW1tb1ZlYzEiLCJfYW1tb1ZlYzIiLCJfYW1tb1F1YXQiLCJfcXVhdDEiLCJRdWF0IiwiX3F1YXQyIiwiX3ZlYzMiLCJWZWMzIiwiUmlnaWRCb2R5Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfYW5ndWxhckRhbXBpbmciLCJfYW5ndWxhckZhY3RvciIsIl9hbmd1bGFyVmVsb2NpdHkiLCJfYm9keSIsIl9mcmljdGlvbiIsIl9ncm91cCIsIkJPRFlHUk9VUF9TVEFUSUMiLCJfbGluZWFyRGFtcGluZyIsIl9saW5lYXJGYWN0b3IiLCJfbGluZWFyVmVsb2NpdHkiLCJfbWFzayIsIkJPRFlNQVNLX05PVF9TVEFUSUMiLCJfbWFzcyIsIl9yZXN0aXR1dGlvbiIsIl9yb2xsaW5nRnJpY3Rpb24iLCJfc2ltdWxhdGlvbkVuYWJsZWQiLCJfdHlwZSIsIkJPRFlUWVBFX1NUQVRJQyIsIm9uTGlicmFyeUxvYWRlZCIsIkFtbW8iLCJidFRyYW5zZm9ybSIsImJ0VmVjdG9yMyIsImJ0UXVhdGVybmlvbiIsImFuZ3VsYXJEYW1waW5nIiwiZGFtcGluZyIsInNldERhbXBpbmciLCJhbmd1bGFyRmFjdG9yIiwiZmFjdG9yIiwiZXF1YWxzIiwiY29weSIsIkJPRFlUWVBFX0RZTkFNSUMiLCJzZXRWYWx1ZSIsIngiLCJ5IiwieiIsInNldEFuZ3VsYXJGYWN0b3IiLCJhbmd1bGFyVmVsb2NpdHkiLCJ2ZWxvY2l0eSIsImFjdGl2YXRlIiwic2V0QW5ndWxhclZlbG9jaXR5IiwiZ2V0QW5ndWxhclZlbG9jaXR5Iiwic2V0IiwiYm9keSIsImZyaWN0aW9uIiwic2V0RnJpY3Rpb24iLCJncm91cCIsImVuYWJsZWQiLCJkaXNhYmxlU2ltdWxhdGlvbiIsImVuYWJsZVNpbXVsYXRpb24iLCJsaW5lYXJEYW1waW5nIiwibGluZWFyRmFjdG9yIiwic2V0TGluZWFyRmFjdG9yIiwibGluZWFyVmVsb2NpdHkiLCJzZXRMaW5lYXJWZWxvY2l0eSIsImdldExpbmVhclZlbG9jaXR5IiwibWFzayIsIm1hc3MiLCJnZXRDb2xsaXNpb25TaGFwZSIsImNhbGN1bGF0ZUxvY2FsSW5lcnRpYSIsInNldE1hc3NQcm9wcyIsInVwZGF0ZUluZXJ0aWFUZW5zb3IiLCJyZXN0aXR1dGlvbiIsInNldFJlc3RpdHV0aW9uIiwicm9sbGluZ0ZyaWN0aW9uIiwic2V0Um9sbGluZ0ZyaWN0aW9uIiwidHlwZSIsIkJPRFlHUk9VUF9EWU5BTUlDIiwiQk9EWU1BU0tfQUxMIiwiQk9EWVRZUEVfS0lORU1BVElDIiwiQk9EWUdST1VQX0tJTkVNQVRJQyIsImNyZWF0ZUJvZHkiLCJzaGFwZSIsImNvbGxpc2lvbiIsInRyaWdnZXIiLCJkZXN0cm95Iiwib25SZW1vdmUiLCJfZ2V0RW50aXR5VHJhbnNmb3JtIiwic2V0Q29sbGlzaW9uRmxhZ3MiLCJnZXRDb2xsaXNpb25GbGFncyIsIkJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1QiLCJzZXRBY3RpdmF0aW9uU3RhdGUiLCJCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04iLCJpc0FjdGl2ZSIsImFkZEJvZHkiLCJfZHluYW1pYyIsInB1c2giLCJmb3JjZUFjdGl2YXRpb25TdGF0ZSIsIkJPRFlTVEFURV9BQ1RJVkVfVEFHIiwic3luY0VudGl0eVRvQm9keSIsIl9raW5lbWF0aWMiLCJfY29tcG91bmRzIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInJlbW92ZUJvZHkiLCJCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OIiwiYXBwbHlGb3JjZSIsInB4IiwicHkiLCJweiIsInVuZGVmaW5lZCIsImFwcGx5VG9ycXVlIiwiYXBwbHlJbXB1bHNlIiwiYXBwbHlUb3JxdWVJbXB1bHNlIiwiaXNTdGF0aWMiLCJpc1N0YXRpY09yS2luZW1hdGljIiwiaXNLaW5lbWF0aWMiLCJ0cmFuc2Zvcm0iLCJjb21wb25lbnQiLCJib2R5UG9zIiwiZ2V0U2hhcGVQb3NpdGlvbiIsImJvZHlSb3QiLCJnZXRTaGFwZVJvdGF0aW9uIiwidyIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJzZXRPcmlnaW4iLCJzZXRSb3RhdGlvbiIsInNldFdvcmxkVHJhbnNmb3JtIiwibW90aW9uU3RhdGUiLCJnZXRNb3Rpb25TdGF0ZSIsIl91cGRhdGVEeW5hbWljIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJwIiwiZ2V0T3JpZ2luIiwicSIsIl9oYXNPZmZzZXQiLCJsbyIsImRhdGEiLCJsaW5lYXJPZmZzZXQiLCJhbyIsImFuZ3VsYXJPZmZzZXQiLCJpbnZlcnRlZEFvIiwiaW52ZXJ0IiwiZW50aXR5Um90IiwibXVsIiwidHJhbnNmb3JtVmVjdG9yIiwic2V0UG9zaXRpb24iLCJfdXBkYXRlS2luZW1hdGljIiwidGVsZXBvcnQiLCJyeCIsInJ5IiwicnoiLCJzZXRFdWxlckFuZ2xlcyIsIm9uRW5hYmxlIiwib25EaXNhYmxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBYUEsSUFB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
