/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHtcbiAgICBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNULCBCT0RZVFlQRV9TVEFUSUMsXG4gICAgQk9EWUdST1VQX0RZTkFNSUMsIEJPRFlHUk9VUF9LSU5FTUFUSUMsIEJPRFlHUk9VUF9TVEFUSUMsXG4gICAgQk9EWU1BU0tfQUxMLCBCT0RZTUFTS19OT1RfU1RBVElDLFxuICAgIEJPRFlTVEFURV9BQ1RJVkVfVEFHLCBCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04sIEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04sXG4gICAgQk9EWVRZUEVfRFlOQU1JQywgQk9EWVRZUEVfS0lORU1BVElDXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtfSBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gKi9cblxuLy8gU2hhcmVkIG1hdGggdmFyaWFibGUgdG8gYXZvaWQgZXhjZXNzaXZlIGFsbG9jYXRpb25cbmxldCBhbW1vVHJhbnNmb3JtO1xubGV0IGFtbW9WZWMxLCBhbW1vVmVjMiwgYW1tb1F1YXQsIGFtbW9PcmlnaW47XG5cbi8qKlxuICogVGhlIHJpZ2lkYm9keSBjb21wb25lbnQsIHdoZW4gY29tYmluZWQgd2l0aCBhIHtAbGluayBDb2xsaXNpb25Db21wb25lbnR9LCBhbGxvd3MgeW91ciBlbnRpdGllc1xuICogdG8gYmUgc2ltdWxhdGVkIHVzaW5nIHJlYWxpc3RpYyBwaHlzaWNzLiBBIHJpZ2lkYm9keSBjb21wb25lbnQgd2lsbCBmYWxsIHVuZGVyIGdyYXZpdHkgYW5kXG4gKiBjb2xsaWRlIHdpdGggb3RoZXIgcmlnaWQgYm9kaWVzLiBVc2luZyBzY3JpcHRzLCB5b3UgY2FuIGFwcGx5IGZvcmNlcyBhbmQgaW1wdWxzZXMgdG8gcmlnaWRcbiAqIGJvZGllcy5cbiAqXG4gKiBZb3Ugc2hvdWxkIG5ldmVyIG5lZWQgdG8gdXNlIHRoZSBSaWdpZEJvZHlDb21wb25lbnQgY29uc3RydWN0b3IuIFRvIGFkZCBhbiBSaWdpZEJvZHlDb21wb25lbnQgdG9cbiAqIGEge0BsaW5rIEVudGl0eX0sIHVzZSB7QGxpbmsgRW50aXR5I2FkZENvbXBvbmVudH06XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gQ3JlYXRlIGEgc3RhdGljIDF4MXgxIGJveC1zaGFwZWQgcmlnaWQgYm9keVxuICogY29uc3QgZW50aXR5ID0gcGMuRW50aXR5KCk7XG4gKiBlbnRpdHkuYWRkQ29tcG9uZW50KFwicmlnaWRib2R5XCIpOyAvLyBXaXRoIG5vIG9wdGlvbnMgc3BlY2lmaWVkLCB0aGlzIGRlZmF1bHRzIHRvIGEgJ3N0YXRpYycgYm9keVxuICogZW50aXR5LmFkZENvbXBvbmVudChcImNvbGxpc2lvblwiKTsgLy8gV2l0aCBubyBvcHRpb25zIHNwZWNpZmllZCwgdGhpcyBkZWZhdWx0cyB0byBhIDF4MXgxIGJveCBzaGFwZVxuICogYGBgXG4gKlxuICogVG8gY3JlYXRlIGEgZHluYW1pYyBzcGhlcmUgd2l0aCBtYXNzIG9mIDEwLCBkbzpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBjb25zdCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJyaWdpZGJvZHlcIiwge1xuICogICAgIHR5cGU6IHBjLkJPRFlUWVBFX0RZTkFNSUMsXG4gKiAgICAgbWFzczogMTBcbiAqIH0pO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcImNvbGxpc2lvblwiLCB7XG4gKiAgICAgdHlwZTogXCJzcGhlcmVcIlxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICpcbiAqIC0gW0ZhbGxpbmcgc2hhcGVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3BoeXNpY3MvZmFsbGluZy1zaGFwZXMpXG4gKiAtIFtWZWhpY2xlIHBoeXNpY3NdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jcGh5c2ljcy92ZWhpY2xlKVxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUmlnaWRCb2R5Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmlnaWRCb2R5Q29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdCBjcmVhdGVkIHRoaXMgY29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5IHRoaXMgY29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZyA9IDA7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclZlbG9jaXR5ID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5fYm9keSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2ZyaWN0aW9uID0gMC41O1xuICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9TVEFUSUM7XG4gICAgICAgIHRoaXMuX2xpbmVhckRhbXBpbmcgPSAwO1xuICAgICAgICB0aGlzLl9saW5lYXJGYWN0b3IgPSBuZXcgVmVjMygxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fbGluZWFyVmVsb2NpdHkgPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLl9tYXNrID0gQk9EWU1BU0tfTk9UX1NUQVRJQztcbiAgICAgICAgdGhpcy5fbWFzcyA9IDE7XG4gICAgICAgIHRoaXMuX3Jlc3RpdHV0aW9uID0gMDtcbiAgICAgICAgdGhpcy5fcm9sbGluZ0ZyaWN0aW9uID0gMDtcbiAgICAgICAgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdHlwZSA9IEJPRFlUWVBFX1NUQVRJQztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgY29udGFjdCBvY2N1cnMgYmV0d2VlbiB0d28gcmlnaWQgYm9kaWVzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFJpZ2lkQm9keUNvbXBvbmVudCNjb250YWN0XG4gICAgICogQHBhcmFtIHtDb250YWN0UmVzdWx0fSByZXN1bHQgLSBEZXRhaWxzIG9mIHRoZSBjb250YWN0IGJldHdlZW4gdGhlIHR3byByaWdpZCBib2RpZXMuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHR3byByaWdpZCBib2RpZXMgc3RhcnQgdG91Y2hpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I2NvbGxpc2lvbnN0YXJ0XG4gICAgICogQHBhcmFtIHtDb250YWN0UmVzdWx0fSByZXN1bHQgLSBEZXRhaWxzIG9mIHRoZSBjb250YWN0IGJldHdlZW4gdGhlIHR3byByaWdpZCBib2RpZXMuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHR3byByaWdpZCBib2RpZXMgc3RvcCB0b3VjaGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjY29sbGlzaW9uZW5kXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgc3RvcHBlZCB0b3VjaGluZyB0aGlzIHJpZ2lkIGJvZHkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgcmlnaWQgYm9keSBlbnRlcnMgYSB0cmlnZ2VyIHZvbHVtZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBSaWdpZEJvZHlDb21wb25lbnQjdHJpZ2dlcmVudGVyXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IG90aGVyIC0gVGhlIHtAbGluayBFbnRpdHl9IHdpdGggdHJpZ2dlciB2b2x1bWUgdGhhdCB0aGlzIHJpZ2lkIGJvZHkgZW50ZXJlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSByaWdpZCBib2R5IGV4aXRzIGEgdHJpZ2dlciB2b2x1bWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmlnaWRCb2R5Q29tcG9uZW50I3RyaWdnZXJsZWF2ZVxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBvdGhlciAtIFRoZSB7QGxpbmsgRW50aXR5fSB3aXRoIHRyaWdnZXIgdm9sdW1lIHRoYXQgdGhpcyByaWdpZCBib2R5IGV4aXRlZC5cbiAgICAgKi9cblxuICAgIHN0YXRpYyBvbkxpYnJhcnlMb2FkZWQoKSB7XG5cbiAgICAgICAgLy8gTGF6aWx5IGNyZWF0ZSBzaGFyZWQgdmFyaWFibGVcbiAgICAgICAgaWYgKHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgYW1tb1RyYW5zZm9ybSA9IG5ldyBBbW1vLmJ0VHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBhbW1vVmVjMSA9IG5ldyBBbW1vLmJ0VmVjdG9yMygpO1xuICAgICAgICAgICAgYW1tb1ZlYzIgPSBuZXcgQW1tby5idFZlY3RvcjMoKTtcbiAgICAgICAgICAgIGFtbW9RdWF0ID0gbmV3IEFtbW8uYnRRdWF0ZXJuaW9uKCk7XG4gICAgICAgICAgICBhbW1vT3JpZ2luID0gbmV3IEFtbW8uYnRWZWN0b3IzKDAsIDAsIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgdGhlIHJhdGUgYXQgd2hpY2ggYSBib2R5IGxvc2VzIGFuZ3VsYXIgdmVsb2NpdHkgb3ZlciB0aW1lLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhckRhbXBpbmcoZGFtcGluZykge1xuICAgICAgICBpZiAodGhpcy5fYW5ndWxhckRhbXBpbmcgIT09IGRhbXBpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJEYW1waW5nID0gZGFtcGluZztcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldERhbXBpbmcodGhpcy5fbGluZWFyRGFtcGluZywgZGFtcGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhckRhbXBpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyRGFtcGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTY2FsaW5nIGZhY3RvciBmb3IgYW5ndWxhciBtb3ZlbWVudCBvZiB0aGUgYm9keSBpbiBlYWNoIGF4aXMuIE9ubHkgdmFsaWQgZm9yIHJpZ2lkIGJvZGllcyBvZlxuICAgICAqIHR5cGUge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9LiBEZWZhdWx0cyB0byAxIGluIGFsbCBheGVzIChib2R5IGNhbiBmcmVlbHkgcm90YXRlKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIHNldCBhbmd1bGFyRmFjdG9yKGZhY3Rvcikge1xuICAgICAgICBpZiAoIXRoaXMuX2FuZ3VsYXJGYWN0b3IuZXF1YWxzKGZhY3RvcikpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJGYWN0b3IuY29weShmYWN0b3IpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgYW1tb1ZlYzEuc2V0VmFsdWUoZmFjdG9yLngsIGZhY3Rvci55LCBmYWN0b3Iueik7XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRBbmd1bGFyRmFjdG9yKGFtbW9WZWMxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyRmFjdG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckZhY3RvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIHRoZSByb3RhdGlvbmFsIHNwZWVkIG9mIHRoZSBib2R5IGFyb3VuZCBlYWNoIHdvcmxkIGF4aXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgYW5ndWxhclZlbG9jaXR5KHZlbG9jaXR5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgYW1tb1ZlYzEuc2V0VmFsdWUodmVsb2NpdHkueCwgdmVsb2NpdHkueSwgdmVsb2NpdHkueik7XG4gICAgICAgICAgICB0aGlzLl9ib2R5LnNldEFuZ3VsYXJWZWxvY2l0eShhbW1vVmVjMSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eS5jb3B5KHZlbG9jaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyVmVsb2NpdHkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICYmIHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0RZTkFNSUMpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlbG9jaXR5ID0gdGhpcy5fYm9keS5nZXRBbmd1bGFyVmVsb2NpdHkoKTtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eS5zZXQodmVsb2NpdHkueCgpLCB2ZWxvY2l0eS55KCksIHZlbG9jaXR5LnooKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJWZWxvY2l0eTtcbiAgICB9XG5cbiAgICBzZXQgYm9keShib2R5KSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5ICE9PSBib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9ib2R5ID0gYm9keTtcblxuICAgICAgICAgICAgaWYgKGJvZHkgJiYgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYm9keSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JvZHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGZyaWN0aW9uIHZhbHVlIHVzZWQgd2hlbiBjb250YWN0cyBvY2N1ciBiZXR3ZWVuIHR3byBib2RpZXMuIEEgaGlnaGVyIHZhbHVlIGluZGljYXRlc1xuICAgICAqIG1vcmUgZnJpY3Rpb24uIFNob3VsZCBiZSBzZXQgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gMC41LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZnJpY3Rpb24oZnJpY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZyaWN0aW9uICE9PSBmcmljdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fZnJpY3Rpb24gPSBmcmljdGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldEZyaWN0aW9uKGZyaWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmcmljdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZyaWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xsaXNpb24gZ3JvdXAgdGhpcyBib2R5IGJlbG9uZ3MgdG8uIENvbWJpbmUgdGhlIGdyb3VwIGFuZCB0aGUgbWFzayB0byBwcmV2ZW50IGJvZGllc1xuICAgICAqIGNvbGxpZGluZyB3aXRoIGVhY2ggb3RoZXIuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBncm91cChncm91cCkge1xuICAgICAgICBpZiAodGhpcy5fZ3JvdXAgIT09IGdyb3VwKSB7XG4gICAgICAgICAgICB0aGlzLl9ncm91cCA9IGdyb3VwO1xuXG4gICAgICAgICAgICAvLyByZS1lbmFibGluZyBzaW11bGF0aW9uIGFkZHMgcmlnaWRib2R5IGJhY2sgaW50byB3b3JsZCB3aXRoIG5ldyBtYXNrc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGdyb3VwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgdGhlIHJhdGUgYXQgd2hpY2ggYSBib2R5IGxvc2VzIGxpbmVhciB2ZWxvY2l0eSBvdmVyIHRpbWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaW5lYXJEYW1waW5nKGRhbXBpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xpbmVhckRhbXBpbmcgIT09IGRhbXBpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhckRhbXBpbmcgPSBkYW1waW5nO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0RGFtcGluZyhkYW1waW5nLCB0aGlzLl9hbmd1bGFyRGFtcGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyRGFtcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhckRhbXBpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2NhbGluZyBmYWN0b3IgZm9yIGxpbmVhciBtb3ZlbWVudCBvZiB0aGUgYm9keSBpbiBlYWNoIGF4aXMuIE9ubHkgdmFsaWQgZm9yIHJpZ2lkIGJvZGllcyBvZlxuICAgICAqIHR5cGUge0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9LiBEZWZhdWx0cyB0byAxIGluIGFsbCBheGVzIChib2R5IGNhbiBmcmVlbHkgbW92ZSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgbGluZWFyRmFjdG9yKGZhY3Rvcikge1xuICAgICAgICBpZiAoIXRoaXMuX2xpbmVhckZhY3Rvci5lcXVhbHMoZmFjdG9yKSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyRmFjdG9yLmNvcHkoZmFjdG9yKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKGZhY3Rvci54LCBmYWN0b3IueSwgZmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TGluZWFyRmFjdG9yKGFtbW9WZWMxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJGYWN0b3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJGYWN0b3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyB0aGUgc3BlZWQgb2YgdGhlIGJvZHkgaW4gYSBnaXZlbiBkaXJlY3Rpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBzZXQgbGluZWFyVmVsb2NpdHkodmVsb2NpdHkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgdGhpcy5fYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZSh2ZWxvY2l0eS54LCB2ZWxvY2l0eS55LCB2ZWxvY2l0eS56KTtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0TGluZWFyVmVsb2NpdHkoYW1tb1ZlYzEpO1xuXG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5jb3B5KHZlbG9jaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJWZWxvY2l0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkgJiYgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfRFlOQU1JQykge1xuICAgICAgICAgICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLl9ib2R5LmdldExpbmVhclZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJWZWxvY2l0eS5zZXQodmVsb2NpdHkueCgpLCB2ZWxvY2l0eS55KCksIHZlbG9jaXR5LnooKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhclZlbG9jaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xsaXNpb24gbWFzayBzZXRzIHdoaWNoIGdyb3VwcyB0aGlzIGJvZHkgY29sbGlkZXMgd2l0aC4gSXQgaXMgYSBiaXRmaWVsZCBvZiAxNiBiaXRzLFxuICAgICAqIHRoZSBmaXJzdCA4IGJpdHMgYXJlIHJlc2VydmVkIGZvciBlbmdpbmUgdXNlLiBEZWZhdWx0cyB0byA2NTUzNS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hc2sobWFzaykge1xuICAgICAgICBpZiAodGhpcy5fbWFzayAhPT0gbWFzaykge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IG1hc2s7XG5cbiAgICAgICAgICAgIC8vIHJlLWVuYWJsaW5nIHNpbXVsYXRpb24gYWRkcyByaWdpZGJvZHkgYmFjayBpbnRvIHdvcmxkIHdpdGggbmV3IG1hc2tzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hc3Mgb2YgdGhlIGJvZHkuIFRoaXMgaXMgb25seSByZWxldmFudCBmb3Ige0BsaW5rIEJPRFlUWVBFX0RZTkFNSUN9IGJvZGllcywgb3RoZXIgdHlwZXNcbiAgICAgKiBoYXZlIGluZmluaXRlIG1hc3MuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNzKG1hc3MpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc3MgIT09IG1hc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc3MgPSBtYXNzO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSAmJiB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkO1xuICAgICAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGVMb2NhbEluZXJ0aWEgd3JpdGVzIGxvY2FsIGluZXJ0aWEgdG8gYW1tb1ZlYzEgaGVyZS4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuZ2V0Q29sbGlzaW9uU2hhcGUoKS5jYWxjdWxhdGVMb2NhbEluZXJ0aWEobWFzcywgYW1tb1ZlYzEpO1xuICAgICAgICAgICAgICAgIC8vIC4uLmFuZCB0aGVuIHdyaXRlcyB0aGUgY2FsY3VsYXRlZCBsb2NhbCBpbmVydGlhIHRvIHRoZSBib2R5XG4gICAgICAgICAgICAgICAgdGhpcy5fYm9keS5zZXRNYXNzUHJvcHMobWFzcywgYW1tb1ZlYzEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkudXBkYXRlSW5lcnRpYVRlbnNvcigpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbmFibGVTaW11bGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluZmx1ZW5jZXMgdGhlIGFtb3VudCBvZiBlbmVyZ3kgbG9zdCB3aGVuIHR3byByaWdpZCBib2RpZXMgY29sbGlkZS4gVGhlIGNhbGN1bGF0aW9uXG4gICAgICogbXVsdGlwbGllcyB0aGUgcmVzdGl0dXRpb24gdmFsdWVzIGZvciBib3RoIGNvbGxpZGluZyBib2RpZXMuIEEgbXVsdGlwbGllZCB2YWx1ZSBvZiAwIG1lYW5zXG4gICAgICogdGhhdCBhbGwgZW5lcmd5IGlzIGxvc3QgaW4gdGhlIGNvbGxpc2lvbiB3aGlsZSBhIHZhbHVlIG9mIDEgbWVhbnMgdGhhdCBubyBlbmVyZ3kgaXMgbG9zdC5cbiAgICAgKiBTaG91bGQgYmUgc2V0IGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZXN0aXR1dGlvbihyZXN0aXR1dGlvbikge1xuICAgICAgICBpZiAodGhpcy5fcmVzdGl0dXRpb24gIT09IHJlc3RpdHV0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXN0aXR1dGlvbiA9IHJlc3RpdHV0aW9uO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYm9keSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JvZHkuc2V0UmVzdGl0dXRpb24ocmVzdGl0dXRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlc3RpdHV0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVzdGl0dXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHRvcnNpb25hbCBmcmljdGlvbiBvcnRob2dvbmFsIHRvIHRoZSBjb250YWN0IHBvaW50LiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcm9sbGluZ0ZyaWN0aW9uKGZyaWN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLl9yb2xsaW5nRnJpY3Rpb24gIT09IGZyaWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9yb2xsaW5nRnJpY3Rpb24gPSBmcmljdGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9ib2R5LnNldFJvbGxpbmdGcmljdGlvbihmcmljdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcm9sbGluZ0ZyaWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm9sbGluZ0ZyaWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByaWdpZCBib2R5IHR5cGUgZGV0ZXJtaW5lcyBob3cgdGhlIGJvZHkgaXMgc2ltdWxhdGVkLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCT0RZVFlQRV9TVEFUSUN9OiBpbmZpbml0ZSBtYXNzIGFuZCBjYW5ub3QgbW92ZS5cbiAgICAgKiAtIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfTogc2ltdWxhdGVkIGFjY29yZGluZyB0byBhcHBsaWVkIGZvcmNlcy5cbiAgICAgKiAtIHtAbGluayBCT0RZVFlQRV9LSU5FTUFUSUN9OiBpbmZpbml0ZSBtYXNzIGFuZCBkb2VzIG5vdCByZXNwb25kIHRvIGZvcmNlcyAoY2FuIG9ubHkgYmVcbiAgICAgKiBtb3ZlZCBieSBzZXR0aW5nIHRoZSBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgY29tcG9uZW50J3Mge0BsaW5rIEVudGl0eX0pLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ30uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHR5cGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgIT09IHR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSB0eXBlO1xuXG4gICAgICAgICAgICB0aGlzLmRpc2FibGVTaW11bGF0aW9uKCk7XG5cbiAgICAgICAgICAgIC8vIHNldCBncm91cCBhbmQgbWFzayB0byBkZWZhdWx0cyBmb3IgdHlwZVxuICAgICAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9EWU5BTUlDOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9EWU5BTUlDO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXNrID0gQk9EWU1BU0tfQUxMO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX0tJTkVNQVRJQzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JvdXAgPSBCT0RZR1JPVVBfS0lORU1BVElDO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXNrID0gQk9EWU1BU0tfQUxMO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEJPRFlUWVBFX1NUQVRJQzpcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncm91cCA9IEJPRFlHUk9VUF9TVEFUSUM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hc2sgPSBCT0RZTUFTS19OT1RfU1RBVElDO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IGJvZHlcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQm9keSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRoZSBFbnRpdHkgaGFzIGEgQ29sbGlzaW9uIHNoYXBlIGF0dGFjaGVkIHRoZW4gY3JlYXRlIGEgcmlnaWQgYm9keSB1c2luZyB0aGlzIHNoYXBlLiBUaGlzXG4gICAgICogbWV0aG9kIGRlc3Ryb3lzIHRoZSBleGlzdGluZyBib2R5LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjcmVhdGVCb2R5KCkge1xuICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgbGV0IHNoYXBlO1xuXG4gICAgICAgIGlmIChlbnRpdHkuY29sbGlzaW9uKSB7XG4gICAgICAgICAgICBzaGFwZSA9IGVudGl0eS5jb2xsaXNpb24uc2hhcGU7XG5cbiAgICAgICAgICAgIC8vIGlmIGEgdHJpZ2dlciB3YXMgYWxyZWFkeSBjcmVhdGVkIGZyb20gdGhlIGNvbGxpc2lvbiBzeXN0ZW1cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgaXRcbiAgICAgICAgICAgIGlmIChlbnRpdHkudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgIGVudGl0eS50cmlnZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgZW50aXR5LnRyaWdnZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hhcGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9ib2R5KVxuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLm9uUmVtb3ZlKGVudGl0eSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1hc3MgPSB0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDID8gdGhpcy5fbWFzcyA6IDA7XG5cbiAgICAgICAgICAgIHRoaXMuX2dldEVudGl0eVRyYW5zZm9ybShhbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuc3lzdGVtLmNyZWF0ZUJvZHkobWFzcywgc2hhcGUsIGFtbW9UcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICBib2R5LnNldFJlc3RpdHV0aW9uKHRoaXMuX3Jlc3RpdHV0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0RnJpY3Rpb24odGhpcy5fZnJpY3Rpb24pO1xuICAgICAgICAgICAgYm9keS5zZXRSb2xsaW5nRnJpY3Rpb24odGhpcy5fcm9sbGluZ0ZyaWN0aW9uKTtcbiAgICAgICAgICAgIGJvZHkuc2V0RGFtcGluZyh0aGlzLl9saW5lYXJEYW1waW5nLCB0aGlzLl9hbmd1bGFyRGFtcGluZyk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9EWU5BTUlDKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZWFyRmFjdG9yID0gdGhpcy5fbGluZWFyRmFjdG9yO1xuICAgICAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKGxpbmVhckZhY3Rvci54LCBsaW5lYXJGYWN0b3IueSwgbGluZWFyRmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIGJvZHkuc2V0TGluZWFyRmFjdG9yKGFtbW9WZWMxKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJGYWN0b3IgPSB0aGlzLl9hbmd1bGFyRmFjdG9yO1xuICAgICAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKGFuZ3VsYXJGYWN0b3IueCwgYW5ndWxhckZhY3Rvci55LCBhbmd1bGFyRmFjdG9yLnopO1xuICAgICAgICAgICAgICAgIGJvZHkuc2V0QW5ndWxhckZhY3RvcihhbW1vVmVjMSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQykge1xuICAgICAgICAgICAgICAgIGJvZHkuc2V0Q29sbGlzaW9uRmxhZ3MoYm9keS5nZXRDb2xsaXNpb25GbGFncygpIHwgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCk7XG4gICAgICAgICAgICAgICAgYm9keS5zZXRBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYm9keS5lbnRpdHkgPSBlbnRpdHk7XG5cbiAgICAgICAgICAgIHRoaXMuYm9keSA9IGJvZHk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZVNpbXVsYXRpb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcmlnaWQgYm9keSBpcyBjdXJyZW50bHkgYWN0aXZlbHkgYmVpbmcgc2ltdWxhdGVkLiBJLmUuIE5vdCAnc2xlZXBpbmcnLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJvZHkgaXMgYWN0aXZlLlxuICAgICAqL1xuICAgIGlzQWN0aXZlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYm9keSA/IHRoaXMuX2JvZHkuaXNBY3RpdmUoKSA6IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcmNpYmx5IGFjdGl2YXRlIHRoZSByaWdpZCBib2R5IHNpbXVsYXRpb24uIE9ubHkgYWZmZWN0cyByaWdpZCBib2RpZXMgb2YgdHlwZVxuICAgICAqIHtAbGluayBCT0RZVFlQRV9EWU5BTUlDfS5cbiAgICAgKi9cbiAgICBhY3RpdmF0ZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2JvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVuYWJsZVNpbXVsYXRpb24oKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5O1xuICAgICAgICBpZiAoZW50aXR5LmNvbGxpc2lvbiAmJiBlbnRpdHkuY29sbGlzaW9uLmVuYWJsZWQgJiYgIXRoaXMuX3NpbXVsYXRpb25FbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYWRkQm9keShib2R5LCB0aGlzLl9ncm91cCwgdGhpcy5fbWFzayk7XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMuX3R5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9EWU5BTUlDOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX2R5bmFtaWMucHVzaCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHkuZm9yY2VBY3RpdmF0aW9uU3RhdGUoQk9EWVNUQVRFX0FDVElWRV9UQUcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeW5jRW50aXR5VG9Cb2R5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9LSU5FTUFUSUM6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fa2luZW1hdGljLnB1c2godGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBCT0RZVFlQRV9TVEFUSUM6XG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9BQ1RJVkVfVEFHKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3luY0VudGl0eVRvQm9keSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5jb2xsaXNpb24udHlwZSA9PT0gJ2NvbXBvdW5kJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fY29tcG91bmRzLnB1c2goZW50aXR5LmNvbGxpc2lvbik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYm9keS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2ltdWxhdGlvbkVuYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGlzYWJsZVNpbXVsYXRpb24oKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuICAgICAgICBpZiAoYm9keSAmJiB0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3Qgc3lzdGVtID0gdGhpcy5zeXN0ZW07XG5cbiAgICAgICAgICAgIGxldCBpZHggPSBzeXN0ZW0uX2NvbXBvdW5kcy5pbmRleE9mKHRoaXMuZW50aXR5LmNvbGxpc2lvbik7XG4gICAgICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgICAgICBzeXN0ZW0uX2NvbXBvdW5kcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWR4ID0gc3lzdGVtLl9keW5hbWljLmluZGV4T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgICAgICBzeXN0ZW0uX2R5bmFtaWMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlkeCA9IHN5c3RlbS5fa2luZW1hdGljLmluZGV4T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgICAgICBzeXN0ZW0uX2tpbmVtYXRpYy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3lzdGVtLnJlbW92ZUJvZHkoYm9keSk7XG5cbiAgICAgICAgICAgIC8vIHNldCBhY3RpdmF0aW9uIHN0YXRlIHRvIGRpc2FibGUgc2ltdWxhdGlvbiB0byBhdm9pZCBib2R5LmlzQWN0aXZlKCkgdG8gcmV0dXJuXG4gICAgICAgICAgICAvLyB0cnVlIGV2ZW4gaWYgaXQncyBub3QgaW4gdGhlIGR5bmFtaWNzIHdvcmxkXG4gICAgICAgICAgICBib2R5LmZvcmNlQWN0aXZhdGlvblN0YXRlKEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04pO1xuXG4gICAgICAgICAgICB0aGlzLl9zaW11bGF0aW9uRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW4gZm9yY2UgdG8gdGhlIGJvZHkgYXQgYSBwb2ludC4gQnkgZGVmYXVsdCwgdGhlIGZvcmNlIGlzIGFwcGxpZWQgYXQgdGhlIG9yaWdpbiBvZiB0aGVcbiAgICAgKiBib2R5LiBIb3dldmVyLCB0aGUgZm9yY2UgY2FuIGJlIGFwcGxpZWQgYXQgYW4gb2Zmc2V0IHRoaXMgcG9pbnQgYnkgc3BlY2lmeWluZyBhIHdvcmxkIHNwYWNlXG4gICAgICogdmVjdG9yIGZyb20gdGhlIGJvZHkncyBvcmlnaW4gdG8gdGhlIHBvaW50IG9mIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWRcbiAgICAgKiBzaWduYXR1cmVzLiBZb3UgY2FuIGVpdGhlciBzcGVjaWZ5IHRoZSBmb3JjZSAoYW5kIG9wdGlvbmFsIHJlbGF0aXZlIHBvaW50KSB2aWEgM0QtdmVjdG9yIG9yXG4gICAgICogbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgZm9yY2UgaW4gd29ybGQtc3BhY2Ugb3JcbiAgICAgKiB0aGUgeC1jb21wb25lbnQgb2YgdGhlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IFt5XSAtIEFuIG9wdGlvbmFsIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgcmVsYXRpdmUgcG9pbnRcbiAgICAgKiBhdCB3aGljaCB0byBhcHBseSB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZSBvciB0aGUgeS1jb21wb25lbnQgb2YgdGhlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHhdIC0gVGhlIHgtY29tcG9uZW50IG9mIGEgd29ybGQtc3BhY2Ugb2Zmc2V0IGZyb20gdGhlIGJvZHkncyBwb3NpdGlvblxuICAgICAqIHdoZXJlIHRoZSBmb3JjZSBpcyBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHldIC0gVGhlIHktY29tcG9uZW50IG9mIGEgd29ybGQtc3BhY2Ugb2Zmc2V0IGZyb20gdGhlIGJvZHkncyBwb3NpdGlvblxuICAgICAqIHdoZXJlIHRoZSBmb3JjZSBpcyBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHpdIC0gVGhlIHotY29tcG9uZW50IG9mIGEgd29ybGQtc3BhY2Ugb2Zmc2V0IGZyb20gdGhlIGJvZHkncyBwb3NpdGlvblxuICAgICAqIHdoZXJlIHRoZSBmb3JjZSBpcyBhcHBsaWVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gYXBwcm94aW1hdGlvbiBvZiBncmF2aXR5IGF0IHRoZSBib2R5J3MgY2VudGVyXG4gICAgICogdGhpcy5lbnRpdHkucmlnaWRib2R5LmFwcGx5Rm9yY2UoMCwgLTEwLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGFwcHJveGltYXRpb24gb2YgZ3Jhdml0eSBhdCAxIHVuaXQgZG93biB0aGUgd29ybGQgWiBmcm9tIHRoZSBjZW50ZXIgb2YgdGhlIGJvZHlcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZSgwLCAtMTAsIDAsIDAsIDAsIDEpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYSBmb3JjZSBhdCB0aGUgYm9keSdzIGNlbnRlclxuICAgICAqIC8vIENhbGN1bGF0ZSBhIGZvcmNlIHZlY3RvciBwb2ludGluZyBpbiB0aGUgd29ybGQgc3BhY2UgZGlyZWN0aW9uIG9mIHRoZSBlbnRpdHlcbiAgICAgKiB2YXIgZm9yY2UgPSB0aGlzLmVudGl0eS5mb3J3YXJkLmNsb25lKCkubXVsU2NhbGFyKDEwMCk7XG4gICAgICpcbiAgICAgKiAvLyBBcHBseSB0aGUgZm9yY2VcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZShmb3JjZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhIGZvcmNlIGF0IHNvbWUgcmVsYXRpdmUgb2Zmc2V0IGZyb20gdGhlIGJvZHkncyBjZW50ZXJcbiAgICAgKiAvLyBDYWxjdWxhdGUgYSBmb3JjZSB2ZWN0b3IgcG9pbnRpbmcgaW4gdGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiB0aGUgZW50aXR5XG4gICAgICogdmFyIGZvcmNlID0gdGhpcy5lbnRpdHkuZm9yd2FyZC5jbG9uZSgpLm11bFNjYWxhcigxMDApO1xuICAgICAqXG4gICAgICogLy8gQ2FsY3VsYXRlIHRoZSB3b3JsZCBzcGFjZSByZWxhdGl2ZSBvZmZzZXRcbiAgICAgKiB2YXIgcmVsYXRpdmVQb3MgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIHZhciBjaGlsZEVudGl0eSA9IHRoaXMuZW50aXR5LmZpbmRCeU5hbWUoJ0VuZ2luZScpO1xuICAgICAqIHJlbGF0aXZlUG9zLnN1YjIoY2hpbGRFbnRpdHkuZ2V0UG9zaXRpb24oKSwgdGhpcy5lbnRpdHkuZ2V0UG9zaXRpb24oKSk7XG4gICAgICpcbiAgICAgKiAvLyBBcHBseSB0aGUgZm9yY2VcbiAgICAgKiB0aGlzLmVudGl0eS5yaWdpZGJvZHkuYXBwbHlGb3JjZShmb3JjZSwgcmVsYXRpdmVQb3MpO1xuICAgICAqL1xuICAgIGFwcGx5Rm9yY2UoKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBsZXQgcHgsIHB5LCBwejtcbiAgICAgICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgeCA9IGFyZ3VtZW50c1swXS54O1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMF0ueTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzBdLno7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgeCA9IGFyZ3VtZW50c1swXS54O1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMF0ueTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzBdLno7XG4gICAgICAgICAgICAgICAgcHggPSBhcmd1bWVudHNbMV0ueDtcbiAgICAgICAgICAgICAgICBweSA9IGFyZ3VtZW50c1sxXS55O1xuICAgICAgICAgICAgICAgIHB6ID0gYXJndW1lbnRzWzFdLno7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgeCA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzFdO1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgICAgICAgeCA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzFdO1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMl07XG4gICAgICAgICAgICAgICAgcHggPSBhcmd1bWVudHNbM107XG4gICAgICAgICAgICAgICAgcHkgPSBhcmd1bWVudHNbNF07XG4gICAgICAgICAgICAgICAgcHogPSBhcmd1bWVudHNbNV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IHRoaXMuX2JvZHk7XG4gICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZSh4LCB5LCB6KTtcbiAgICAgICAgICAgIGlmIChweCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgYW1tb1ZlYzIuc2V0VmFsdWUocHgsIHB5LCBweik7XG4gICAgICAgICAgICAgICAgYm9keS5hcHBseUZvcmNlKGFtbW9WZWMxLCBhbW1vVmVjMik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJvZHkuYXBwbHlGb3JjZShhbW1vVmVjMSwgYW1tb09yaWdpbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSB0b3JxdWUgKHJvdGF0aW9uYWwgZm9yY2UpIHRvIHRoZSBib2R5LiBUaGlzIGZ1bmN0aW9uIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhblxuICAgICAqIGVpdGhlciBzcGVjaWZ5IHRoZSB0b3JxdWUgZm9yY2Ugd2l0aCBhIDNELXZlY3RvciBvciB3aXRoIDMgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlXG4gICAgICogb3IgdGhlIHgtY29tcG9uZW50IG9mIHRoZSB0b3JxdWUgZm9yY2UgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgdG9ycXVlIGZvcmNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBmb3JjZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSB2ZWN0b3JcbiAgICAgKiB2YXIgdG9ycXVlID0gbmV3IHBjLlZlYzMoMCwgMTAsIDApO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlUb3JxdWUodG9ycXVlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSBudW1iZXJzXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZSgwLCAxMCwgMCk7XG4gICAgICovXG4gICAgYXBwbHlUb3JxdWUoKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdLng7XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1swXS55O1xuICAgICAgICAgICAgICAgIHogPSBhcmd1bWVudHNbMF0uejtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICB4ID0gYXJndW1lbnRzWzBdO1xuICAgICAgICAgICAgICAgIHkgPSBhcmd1bWVudHNbMV07XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0VSUk9SOiBhcHBseVRvcnF1ZTogZnVuY3Rpb24gdGFrZXMgMSBvciAzIGFyZ3VtZW50cycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgYm9keS5hcHBseVRvcnF1ZShhbW1vVmVjMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhbiBpbXB1bHNlIChpbnN0YW50YW5lb3VzIGNoYW5nZSBvZiB2ZWxvY2l0eSkgdG8gdGhlIGJvZHkgYXQgYSBwb2ludC4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgaW1wdWxzZSAoYW5kIG9wdGlvbmFsIHJlbGF0aXZlIHBvaW50KVxuICAgICAqIHZpYSAzRC12ZWN0b3Igb3IgbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZSBvclxuICAgICAqIHRoZSB4LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN8bnVtYmVyfSBbeV0gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciByZXByZXNlbnRpbmcgdGhlIHJlbGF0aXZlIHBvaW50XG4gICAgICogYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkgb3IgdGhlIHktY29tcG9uZW50IG9mIHRoZVxuICAgICAqIGltcHVsc2UgdG8gYXBwbHkgaW4gd29ybGQtc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgaW1wdWxzZSB0byBhcHBseSBpbiB3b3JsZC1zcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3B4PTBdIC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSBwb2ludCBhdCB3aGljaCB0byBhcHBseSB0aGUgaW1wdWxzZSBpbiB0aGVcbiAgICAgKiBsb2NhbC1zcGFjZSBvZiB0aGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcHk9MF0gLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHBvaW50IGF0IHdoaWNoIHRvIGFwcGx5IHRoZSBpbXB1bHNlIGluIHRoZVxuICAgICAqIGxvY2FsLXNwYWNlIG9mIHRoZSBlbnRpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwej0wXSAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgcG9pbnQgYXQgd2hpY2ggdG8gYXBwbHkgdGhlIGltcHVsc2UgaW4gdGhlXG4gICAgICogbG9jYWwtc3BhY2Ugb2YgdGhlIGVudGl0eS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IGFuIGltcHVsc2UgYWxvbmcgdGhlIHdvcmxkLXNwYWNlIHBvc2l0aXZlIHktYXhpcyBhdCB0aGUgZW50aXR5J3MgcG9zaXRpb24uXG4gICAgICogdmFyIGltcHVsc2UgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseUltcHVsc2UoaW1wdWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiB2YXIgaW1wdWxzZSA9IG5ldyBwYy5WZWMzKDAsIDEwLCAwKTtcbiAgICAgKiB2YXIgcmVsYXRpdmVQb2ludCA9IG5ldyBwYy5WZWMzKDAsIDAsIDEpO1xuICAgICAqIGVudGl0eS5yaWdpZGJvZHkuYXBwbHlJbXB1bHNlKGltcHVsc2UsIHJlbGF0aXZlUG9pbnQpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgYW4gaW1wdWxzZSBhbG9uZyB0aGUgd29ybGQtc3BhY2UgcG9zaXRpdmUgeS1heGlzIGF0IHRoZSBlbnRpdHkncyBwb3NpdGlvbi5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBBcHBseSBhbiBpbXB1bHNlIGFsb25nIHRoZSB3b3JsZC1zcGFjZSBwb3NpdGl2ZSB5LWF4aXMgYXQgMSB1bml0IGRvd24gdGhlIHBvc2l0aXZlXG4gICAgICogLy8gei1heGlzIG9mIHRoZSBlbnRpdHkncyBsb2NhbC1zcGFjZS5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LmFwcGx5SW1wdWxzZSgwLCAxMCwgMCwgMCwgMCwgMSk7XG4gICAgICovXG4gICAgYXBwbHlJbXB1bHNlKCkge1xuICAgICAgICBsZXQgeCwgeSwgejtcbiAgICAgICAgbGV0IHB4LCBweSwgcHo7XG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF0ueDtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzBdLnk7XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1swXS56O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF0ueDtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzBdLnk7XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1swXS56O1xuICAgICAgICAgICAgICAgIHB4ID0gYXJndW1lbnRzWzFdLng7XG4gICAgICAgICAgICAgICAgcHkgPSBhcmd1bWVudHNbMV0ueTtcbiAgICAgICAgICAgICAgICBweiA9IGFyZ3VtZW50c1sxXS56O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzJdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzJdO1xuICAgICAgICAgICAgICAgIHB4ID0gYXJndW1lbnRzWzNdO1xuICAgICAgICAgICAgICAgIHB5ID0gYXJndW1lbnRzWzRdO1xuICAgICAgICAgICAgICAgIHB6ID0gYXJndW1lbnRzWzVdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignRVJST1I6IGFwcGx5SW1wdWxzZTogZnVuY3Rpb24gdGFrZXMgMSwgMiwgMyBvciA2IGFyZ3VtZW50cycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgaWYgKHB4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBhbW1vVmVjMi5zZXRWYWx1ZShweCwgcHksIHB6KTtcbiAgICAgICAgICAgICAgICBib2R5LmFwcGx5SW1wdWxzZShhbW1vVmVjMSwgYW1tb1ZlYzIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBib2R5LmFwcGx5SW1wdWxzZShhbW1vVmVjMSwgYW1tb09yaWdpbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBhIHRvcnF1ZSBpbXB1bHNlIChyb3RhdGlvbmFsIGZvcmNlIGFwcGxpZWQgaW5zdGFudGFuZW91c2x5KSB0byB0aGUgYm9keS4gVGhpcyBmdW5jdGlvblxuICAgICAqIGhhcyB0d28gdmFsaWQgc2lnbmF0dXJlcy4gWW91IGNhbiBlaXRoZXIgc3BlY2lmeSB0aGUgdG9ycXVlIGZvcmNlIHdpdGggYSAzRC12ZWN0b3Igb3Igd2l0aCAzXG4gICAgICogbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIHJlcHJlc2VudGluZyB0aGUgdG9ycXVlIGltcHVsc2UgaW5cbiAgICAgKiB3b3JsZC1zcGFjZSBvciB0aGUgeC1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBpbXB1bHNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBpbXB1bHNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHRvcnF1ZSBpbXB1bHNlIGluIHdvcmxkLXNwYWNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQXBwbHkgdmlhIHZlY3RvclxuICAgICAqIHZhciB0b3JxdWUgPSBuZXcgcGMuVmVjMygwLCAxMCwgMCk7XG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZUltcHVsc2UodG9ycXVlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEFwcGx5IHZpYSBudW1iZXJzXG4gICAgICogZW50aXR5LnJpZ2lkYm9keS5hcHBseVRvcnF1ZUltcHVsc2UoMCwgMTAsIDApO1xuICAgICAqL1xuICAgIGFwcGx5VG9ycXVlSW1wdWxzZSgpIHtcbiAgICAgICAgbGV0IHgsIHksIHo7XG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF0ueDtcbiAgICAgICAgICAgICAgICB5ID0gYXJndW1lbnRzWzBdLnk7XG4gICAgICAgICAgICAgICAgeiA9IGFyZ3VtZW50c1swXS56O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAgIHggPSBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICAgICAgeSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgICAgICB6ID0gYXJndW1lbnRzWzJdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignRVJST1I6IGFwcGx5VG9ycXVlSW1wdWxzZTogZnVuY3Rpb24gdGFrZXMgMSBvciAzIGFyZ3VtZW50cycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIGJvZHkuYWN0aXZhdGUoKTtcbiAgICAgICAgICAgIGFtbW9WZWMxLnNldFZhbHVlKHgsIHksIHopO1xuICAgICAgICAgICAgYm9keS5hcHBseVRvcnF1ZUltcHVsc2UoYW1tb1ZlYzEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSByaWdpZCBib2R5IGlzIG9mIHR5cGUge0BsaW5rIEJPRFlUWVBFX1NUQVRJQ30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzdGF0aWMuXG4gICAgICovXG4gICAgaXNTdGF0aWMoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfU1RBVElDKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgb2YgdHlwZSB7QGxpbmsgQk9EWVRZUEVfU1RBVElDfSBvciB7QGxpbmsgQk9EWVRZUEVfS0lORU1BVElDfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHN0YXRpYyBvciBraW5lbWF0aWMuXG4gICAgICovXG4gICAgaXNTdGF0aWNPcktpbmVtYXRpYygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9TVEFUSUMgfHwgdGhpcy5fdHlwZSA9PT0gQk9EWVRZUEVfS0lORU1BVElDKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHJpZ2lkIGJvZHkgaXMgb2YgdHlwZSB7QGxpbmsgQk9EWVRZUEVfS0lORU1BVElDfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGtpbmVtYXRpYy5cbiAgICAgKi9cbiAgICBpc0tpbmVtYXRpYygpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLl90eXBlID09PSBCT0RZVFlQRV9LSU5FTUFUSUMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyaXRlcyBhbiBlbnRpdHkgdHJhbnNmb3JtIGludG8gYW4gQW1tby5idFRyYW5zZm9ybSBidXQgaWdub3Jpbmcgc2NhbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gdHJhbnNmb3JtIC0gVGhlIGFtbW8gdHJhbnNmb3JtIHRvIHdyaXRlIHRoZSBlbnRpdHkgdHJhbnNmb3JtIHRvLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldEVudGl0eVRyYW5zZm9ybSh0cmFuc2Zvcm0pIHtcbiAgICAgICAgY29uc3QgZW50aXR5ID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIGNvbnN0IHBvcyA9IGVudGl0eS5nZXRQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCByb3QgPSBlbnRpdHkuZ2V0Um90YXRpb24oKTtcblxuICAgICAgICBhbW1vVmVjMS5zZXRWYWx1ZShwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgYW1tb1F1YXQuc2V0VmFsdWUocm90LngsIHJvdC55LCByb3Queiwgcm90LncpO1xuXG4gICAgICAgIHRyYW5zZm9ybS5zZXRPcmlnaW4oYW1tb1ZlYzEpO1xuICAgICAgICB0cmFuc2Zvcm0uc2V0Um90YXRpb24oYW1tb1F1YXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcmlnaWQgYm9keSB0cmFuc2Zvcm0gdG8gYmUgdGhlIHNhbWUgYXMgdGhlIEVudGl0eSB0cmFuc2Zvcm0uIFRoaXMgbXVzdCBiZSBjYWxsZWRcbiAgICAgKiBhZnRlciBhbnkgRW50aXR5IHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9ucyAoZS5nLiB7QGxpbmsgRW50aXR5I3NldFBvc2l0aW9ufSkgYXJlIGNhbGxlZCBpblxuICAgICAqIG9yZGVyIHRvIHVwZGF0ZSB0aGUgcmlnaWQgYm9keSB0byBtYXRjaCB0aGUgRW50aXR5LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzeW5jRW50aXR5VG9Cb2R5KCkge1xuICAgICAgICBjb25zdCBib2R5ID0gdGhpcy5fYm9keTtcbiAgICAgICAgaWYgKGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2dldEVudGl0eVRyYW5zZm9ybShhbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgYm9keS5zZXRXb3JsZFRyYW5zZm9ybShhbW1vVHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IEJPRFlUWVBFX0tJTkVNQVRJQykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vdGlvblN0YXRlID0gYm9keS5nZXRNb3Rpb25TdGF0ZSgpO1xuICAgICAgICAgICAgICAgIGlmIChtb3Rpb25TdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBtb3Rpb25TdGF0ZS5zZXRXb3JsZFRyYW5zZm9ybShhbW1vVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib2R5LmFjdGl2YXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGFuIGVudGl0eSdzIHRyYW5zZm9ybSB0byBtYXRjaCB0aGF0IG9mIHRoZSB3b3JsZCB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggb2YgYSBkeW5hbWljXG4gICAgICogcmlnaWQgYm9keSdzIG1vdGlvbiBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUR5bmFtaWMoKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB0aGlzLl9ib2R5O1xuXG4gICAgICAgIC8vIElmIGEgZHluYW1pYyBib2R5IGlzIGZyb3plbiwgd2UgY2FuIGFzc3VtZSBpdHMgbW90aW9uIHN0YXRlIHRyYW5zZm9ybSBpc1xuICAgICAgICAvLyB0aGUgc2FtZSBpcyB0aGUgZW50aXR5IHdvcmxkIHRyYW5zZm9ybVxuICAgICAgICBpZiAoYm9keS5pc0FjdGl2ZSgpKSB7XG4gICAgICAgICAgICAvLyBVcGRhdGUgdGhlIG1vdGlvbiBzdGF0ZS4gTm90ZSB0aGF0IHRoZSB0ZXN0IGZvciB0aGUgcHJlc2VuY2Ugb2YgdGhlIG1vdGlvblxuICAgICAgICAgICAgLy8gc3RhdGUgaXMgdGVjaG5pY2FsbHkgcmVkdW5kYW50IHNpbmNlIHRoZSBlbmdpbmUgY3JlYXRlcyBvbmUgZm9yIGFsbCBib2RpZXMuXG4gICAgICAgICAgICBjb25zdCBtb3Rpb25TdGF0ZSA9IGJvZHkuZ2V0TW90aW9uU3RhdGUoKTtcbiAgICAgICAgICAgIGlmIChtb3Rpb25TdGF0ZSkge1xuICAgICAgICAgICAgICAgIG1vdGlvblN0YXRlLmdldFdvcmxkVHJhbnNmb3JtKGFtbW9UcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcCA9IGFtbW9UcmFuc2Zvcm0uZ2V0T3JpZ2luKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcSA9IGFtbW9UcmFuc2Zvcm0uZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihwLngoKSwgcC55KCksIHAueigpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRSb3RhdGlvbihxLngoKSwgcS55KCksIHEueigpLCBxLncoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXcml0ZXMgdGhlIGVudGl0eSdzIHdvcmxkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBpbnRvIHRoZSBtb3Rpb24gc3RhdGUgb2YgYSBraW5lbWF0aWMgYm9keS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUtpbmVtYXRpYygpIHtcbiAgICAgICAgY29uc3QgbW90aW9uU3RhdGUgPSB0aGlzLl9ib2R5LmdldE1vdGlvblN0YXRlKCk7XG4gICAgICAgIGlmIChtb3Rpb25TdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fZ2V0RW50aXR5VHJhbnNmb3JtKGFtbW9UcmFuc2Zvcm0pO1xuICAgICAgICAgICAgbW90aW9uU3RhdGUuc2V0V29ybGRUcmFuc2Zvcm0oYW1tb1RyYW5zZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZWxlcG9ydCBhbiBlbnRpdHkgdG8gYSBuZXcgd29ybGQtc3BhY2UgcG9zaXRpb24sIG9wdGlvbmFsbHkgc2V0dGluZyBvcmllbnRhdGlvbi4gVGhpc1xuICAgICAqIGZ1bmN0aW9uIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmb3IgcmlnaWQgYm9kaWVzIHRoYXQgYXJlIGR5bmFtaWMuIFRoaXMgZnVuY3Rpb24gaGFzIHRocmVlXG4gICAgICogdmFsaWQgc2lnbmF0dXJlcy4gVGhlIGZpcnN0IHRha2VzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgZm9yIHRoZSBwb3NpdGlvbiBhbmQgYW4gb3B0aW9uYWxcbiAgICAgKiAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgRXVsZXIgcm90YXRpb24uIFRoZSBzZWNvbmQgdGFrZXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBmb3IgdGhlXG4gICAgICogcG9zaXRpb24gYW5kIGFuIG9wdGlvbmFsIHF1YXRlcm5pb24gZm9yIHJvdGF0aW9uLiBUaGUgdGhpcmQgdGFrZXMgMyBudW1iZXJzIGZvciB0aGUgcG9zaXRpb25cbiAgICAgKiBhbmQgYW4gb3B0aW9uYWwgMyBudW1iZXJzIGZvciBFdWxlciByb3RhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM3xudW1iZXJ9IHggLSBBIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIG5ldyBwb3NpdGlvbiBvciB0aGUgbmV3IHBvc2l0aW9uXG4gICAgICogeC1jb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7VmVjM3xRdWF0fG51bWJlcn0geSAtIEEgMy1kaW1lbnNpb25hbCB2ZWN0b3Igb3IgcXVhdGVybmlvbiBob2xkaW5nIHRoZSBuZXcgcm90YXRpb25cbiAgICAgKiBvciB0aGUgbmV3IHBvc2l0aW9uIHktY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3pdIC0gVGhlIG5ldyBwb3NpdGlvbiB6LWNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtyeF0gLSBUaGUgbmV3IEV1bGVyIHgtYW5nbGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtyeV0gLSBUaGUgbmV3IEV1bGVyIHktYW5nbGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtyel0gLSBUaGUgbmV3IEV1bGVyIHotYW5nbGUgdmFsdWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHRoZSBvcmlnaW5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KHBjLlZlYzMuWkVSTyk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBUZWxlcG9ydCB0aGUgZW50aXR5IHRvIHRoZSBvcmlnaW5cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KDAsIDAsIDApO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxLCAyLCAzXSBhbmQgcmVzZXQgb3JpZW50YXRpb25cbiAgICAgKiB2YXIgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KHBvc2l0aW9uLCBwYy5WZWMzLlpFUk8pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gVGVsZXBvcnQgdGhlIGVudGl0eSB0byB3b3JsZC1zcGFjZSBjb29yZGluYXRlIFsxLCAyLCAzXSBhbmQgcmVzZXQgb3JpZW50YXRpb25cbiAgICAgKiBlbnRpdHkucmlnaWRib2R5LnRlbGVwb3J0KDEsIDIsIDMsIDAsIDAsIDApO1xuICAgICAqL1xuICAgIHRlbGVwb3J0KCkge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHNbMF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihhcmd1bWVudHNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFyZ3VtZW50c1sxXSkge1xuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBRdWF0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LnNldFJvdGF0aW9uKGFyZ3VtZW50c1sxXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYXJndW1lbnRzWzFdKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSA2KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdHkuc2V0RXVsZXJBbmdsZXMoYXJndW1lbnRzWzNdLCBhcmd1bWVudHNbNF0sIGFyZ3VtZW50c1s1XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5zZXRQb3NpdGlvbihhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN5bmNFbnRpdHlUb0JvZHkoKTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ib2R5KSB7XG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUJvZHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZW5hYmxlU2ltdWxhdGlvbigpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5kaXNhYmxlU2ltdWxhdGlvbigpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmlnaWRCb2R5Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiYW1tb1RyYW5zZm9ybSIsImFtbW9WZWMxIiwiYW1tb1ZlYzIiLCJhbW1vUXVhdCIsImFtbW9PcmlnaW4iLCJSaWdpZEJvZHlDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9hbmd1bGFyRGFtcGluZyIsIl9hbmd1bGFyRmFjdG9yIiwiVmVjMyIsIl9hbmd1bGFyVmVsb2NpdHkiLCJfYm9keSIsIl9mcmljdGlvbiIsIl9ncm91cCIsIkJPRFlHUk9VUF9TVEFUSUMiLCJfbGluZWFyRGFtcGluZyIsIl9saW5lYXJGYWN0b3IiLCJfbGluZWFyVmVsb2NpdHkiLCJfbWFzayIsIkJPRFlNQVNLX05PVF9TVEFUSUMiLCJfbWFzcyIsIl9yZXN0aXR1dGlvbiIsIl9yb2xsaW5nRnJpY3Rpb24iLCJfc2ltdWxhdGlvbkVuYWJsZWQiLCJfdHlwZSIsIkJPRFlUWVBFX1NUQVRJQyIsIm9uTGlicmFyeUxvYWRlZCIsIkFtbW8iLCJidFRyYW5zZm9ybSIsImJ0VmVjdG9yMyIsImJ0UXVhdGVybmlvbiIsImFuZ3VsYXJEYW1waW5nIiwiZGFtcGluZyIsInNldERhbXBpbmciLCJhbmd1bGFyRmFjdG9yIiwiZmFjdG9yIiwiZXF1YWxzIiwiY29weSIsIkJPRFlUWVBFX0RZTkFNSUMiLCJzZXRWYWx1ZSIsIngiLCJ5IiwieiIsInNldEFuZ3VsYXJGYWN0b3IiLCJhbmd1bGFyVmVsb2NpdHkiLCJ2ZWxvY2l0eSIsImFjdGl2YXRlIiwic2V0QW5ndWxhclZlbG9jaXR5IiwiZ2V0QW5ndWxhclZlbG9jaXR5Iiwic2V0IiwiYm9keSIsImZyaWN0aW9uIiwic2V0RnJpY3Rpb24iLCJncm91cCIsImVuYWJsZWQiLCJkaXNhYmxlU2ltdWxhdGlvbiIsImVuYWJsZVNpbXVsYXRpb24iLCJsaW5lYXJEYW1waW5nIiwibGluZWFyRmFjdG9yIiwic2V0TGluZWFyRmFjdG9yIiwibGluZWFyVmVsb2NpdHkiLCJzZXRMaW5lYXJWZWxvY2l0eSIsImdldExpbmVhclZlbG9jaXR5IiwibWFzayIsIm1hc3MiLCJnZXRDb2xsaXNpb25TaGFwZSIsImNhbGN1bGF0ZUxvY2FsSW5lcnRpYSIsInNldE1hc3NQcm9wcyIsInVwZGF0ZUluZXJ0aWFUZW5zb3IiLCJyZXN0aXR1dGlvbiIsInNldFJlc3RpdHV0aW9uIiwicm9sbGluZ0ZyaWN0aW9uIiwic2V0Um9sbGluZ0ZyaWN0aW9uIiwidHlwZSIsIkJPRFlHUk9VUF9EWU5BTUlDIiwiQk9EWU1BU0tfQUxMIiwiQk9EWVRZUEVfS0lORU1BVElDIiwiQk9EWUdST1VQX0tJTkVNQVRJQyIsImNyZWF0ZUJvZHkiLCJzaGFwZSIsImNvbGxpc2lvbiIsInRyaWdnZXIiLCJkZXN0cm95Iiwib25SZW1vdmUiLCJfZ2V0RW50aXR5VHJhbnNmb3JtIiwic2V0Q29sbGlzaW9uRmxhZ3MiLCJnZXRDb2xsaXNpb25GbGFncyIsIkJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1QiLCJzZXRBY3RpdmF0aW9uU3RhdGUiLCJCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04iLCJpc0FjdGl2ZSIsImFkZEJvZHkiLCJfZHluYW1pYyIsInB1c2giLCJmb3JjZUFjdGl2YXRpb25TdGF0ZSIsIkJPRFlTVEFURV9BQ1RJVkVfVEFHIiwic3luY0VudGl0eVRvQm9keSIsIl9raW5lbWF0aWMiLCJfY29tcG91bmRzIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInJlbW92ZUJvZHkiLCJCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OIiwiYXBwbHlGb3JjZSIsInB4IiwicHkiLCJweiIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsImFwcGx5VG9ycXVlIiwiRGVidWciLCJlcnJvciIsImFwcGx5SW1wdWxzZSIsImFwcGx5VG9ycXVlSW1wdWxzZSIsImlzU3RhdGljIiwiaXNTdGF0aWNPcktpbmVtYXRpYyIsImlzS2luZW1hdGljIiwidHJhbnNmb3JtIiwicG9zIiwiZ2V0UG9zaXRpb24iLCJyb3QiLCJnZXRSb3RhdGlvbiIsInciLCJzZXRPcmlnaW4iLCJzZXRSb3RhdGlvbiIsInNldFdvcmxkVHJhbnNmb3JtIiwibW90aW9uU3RhdGUiLCJnZXRNb3Rpb25TdGF0ZSIsIl91cGRhdGVEeW5hbWljIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJwIiwiZ2V0T3JpZ2luIiwicSIsInNldFBvc2l0aW9uIiwiX3VwZGF0ZUtpbmVtYXRpYyIsInRlbGVwb3J0IiwiUXVhdCIsInNldEV1bGVyQW5nbGVzIiwib25FbmFibGUiLCJvbkRpc2FibGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBa0JBLElBQUlBLGFBQUosQ0FBQTtBQUNBLElBQUlDLFFBQUosRUFBY0MsUUFBZCxFQUF3QkMsUUFBeEIsRUFBa0NDLFVBQWxDLENBQUE7O0FBc0NBLE1BQU1DLGtCQUFOLFNBQWlDQyxTQUFqQyxDQUEyQztBQU92Q0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFELEVBQVNDLE1BQVQsRUFBaUI7SUFDeEIsS0FBTUQsQ0FBQUEsTUFBTixFQUFjQyxNQUFkLENBQUEsQ0FBQTtJQUVBLElBQUtDLENBQUFBLGVBQUwsR0FBdUIsQ0FBdkIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLGNBQUwsR0FBc0IsSUFBSUMsSUFBSixDQUFTLENBQVQsRUFBWSxDQUFaLEVBQWUsQ0FBZixDQUF0QixDQUFBO0FBQ0EsSUFBQSxJQUFBLENB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
