/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../math/math.js';
import { Mat4 } from '../../../math/mat4.js';
import { Quat } from '../../../math/quat.js';
import { Vec2 } from '../../../math/vec2.js';
import { Component } from '../component.js';
import { MOTION_LOCKED, MOTION_LIMITED, MOTION_FREE } from './constants.js';

const properties = ['angularDampingX', 'angularDampingY', 'angularDampingZ', 'angularEquilibriumX', 'angularEquilibriumY', 'angularEquilibriumZ', 'angularLimitsX', 'angularLimitsY', 'angularLimitsZ', 'angularMotionX', 'angularMotionY', 'angularMotionZ', 'angularSpringX', 'angularSpringY', 'angularSpringZ', 'angularStiffnessX', 'angularStiffnessY', 'angularStiffnessZ', 'breakForce', 'enableCollision', 'enabled', 'entityA', 'entityB', 'linearDampingX', 'linearDampingY', 'linearDampingZ', 'linearEquilibriumX', 'linearEquilibriumY', 'linearEquilibriumZ', 'linearLimitsX', 'linearLimitsY', 'linearLimitsZ', 'linearMotionX', 'linearMotionY', 'linearMotionZ', 'linearSpringX', 'linearSpringY', 'linearSpringZ', 'linearStiffnessX', 'linearStiffnessY', 'linearStiffnessZ'];

class JointComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    Debug.assert(typeof Ammo !== 'undefined', 'ERROR: Attempting to create a pc.JointComponent but Ammo.js is not loaded');
    this._constraint = null;
    this._entityA = null;
    this._entityB = null;
    this._breakForce = 3.4e+38;
    this._enableCollision = true;
    this._linearMotionX = MOTION_LOCKED;
    this._linearLimitsX = new Vec2(0, 0);
    this._linearSpringX = false;
    this._linearStiffnessX = 0;
    this._linearDampingX = 1;
    this._linearEquilibriumX = 0;
    this._linearMotionY = MOTION_LOCKED;
    this._linearLimitsY = new Vec2(0, 0);
    this._linearSpringY = false;
    this._linearStiffnessY = 0;
    this._linearDampingY = 1;
    this._linearEquilibriumY = 0;
    this._linearMotionZ = MOTION_LOCKED;
    this._linearLimitsZ = new Vec2(0, 0);
    this._linearSpringZ = false;
    this._linearStiffnessZ = 0;
    this._linearDampingZ = 1;
    this._linearEquilibriumZ = 0;
    this._angularMotionX = MOTION_LOCKED;
    this._angularLimitsX = new Vec2(0, 0);
    this._angularSpringX = false;
    this._angularStiffnessX = 0;
    this._angularDampingX = 1;
    this._angularEquilibriumX = 0;
    this._angularMotionY = MOTION_LOCKED;
    this._angularLimitsY = new Vec2(0, 0);
    this._angularSpringY = false;
    this._angularStiffnessY = 0;
    this._angularDampingY = 1;
    this._angularEquilibriumY = 0;
    this._angularMotionZ = MOTION_LOCKED;
    this._angularLimitsZ = new Vec2(0, 0);
    this._angularSpringZ = false;
    this._angularEquilibriumZ = 0;
    this._angularDampingZ = 1;
    this._angularStiffnessZ = 0;
    this.on('set_enabled', this._onSetEnabled, this);
  }

  set entityA(body) {
    this._destroyConstraint();

    this._entityA = body;

    this._createConstraint();
  }

  get entityA() {
    return this._entityA;
  }

  set entityB(body) {
    this._destroyConstraint();

    this._entityB = body;

    this._createConstraint();
  }

  get entityB() {
    return this._entityB;
  }

  set breakForce(force) {
    if (this._constraint && this._breakForce !== force) {
      this._constraint.setBreakingImpulseThreshold(force);

      this._breakForce = force;
    }
  }

  get breakForce() {
    return this._breakForce;
  }

  set enableCollision(enableCollision) {
    this._destroyConstraint();

    this._enableCollision = enableCollision;

    this._createConstraint();
  }

  get enableCollision() {
    return this._enableCollision;
  }

  set angularLimitsX(limits) {
    if (!this._angularLimitsX.equals(limits)) {
      this._angularLimitsX.copy(limits);

      this._updateAngularLimits();
    }
  }

  get angularLimitsX() {
    return this._angularLimitsX;
  }

  set angularMotionX(value) {
    if (this._angularMotionX !== value) {
      this._angularMotionX = value;

      this._updateAngularLimits();
    }
  }

  get angularMotionX() {
    return this._angularMotionX;
  }

  set angularLimitsY(limits) {
    if (!this._angularLimitsY.equals(limits)) {
      this._angularLimitsY.copy(limits);

      this._updateAngularLimits();
    }
  }

  get angularLimitsY() {
    return this._angularLimitsY;
  }

  set angularMotionY(value) {
    if (this._angularMotionY !== value) {
      this._angularMotionY = value;

      this._updateAngularLimits();
    }
  }

  get angularMotionY() {
    return this._angularMotionY;
  }

  set angularLimitsZ(limits) {
    if (!this._angularLimitsZ.equals(limits)) {
      this._angularLimitsZ.copy(limits);

      this._updateAngularLimits();
    }
  }

  get angularLimitsZ() {
    return this._angularLimitsZ;
  }

  set angularMotionZ(value) {
    if (this._angularMotionZ !== value) {
      this._angularMotionZ = value;

      this._updateAngularLimits();
    }
  }

  get angularMotionZ() {
    return this._angularMotionZ;
  }

  set linearLimitsX(limits) {
    if (!this._linearLimitsX.equals(limits)) {
      this._linearLimitsX.copy(limits);

      this._updateLinearLimits();
    }
  }

  get linearLimitsX() {
    return this._linearLimitsX;
  }

  set linearMotionX(value) {
    if (this._linearMotionX !== value) {
      this._linearMotionX = value;

      this._updateLinearLimits();
    }
  }

  get linearMotionX() {
    return this._linearMotionX;
  }

  set linearLimitsY(limits) {
    if (!this._linearLimitsY.equals(limits)) {
      this._linearLimitsY.copy(limits);

      this._updateLinearLimits();
    }
  }

  get linearLimitsY() {
    return this._linearLimitsY;
  }

  set linearMotionY(value) {
    if (this._linearMotionY !== value) {
      this._linearMotionY = value;

      this._updateLinearLimits();
    }
  }

  get linearMotionY() {
    return this._linearMotionY;
  }

  set linearLimitsZ(limits) {
    if (!this._linearLimitsZ.equals(limits)) {
      this._linearLimitsZ.copy(limits);

      this._updateLinearLimits();
    }
  }

  get linearLimitsZ() {
    return this._linearLimitsZ;
  }

  set linearMotionZ(value) {
    if (this._linearMotionZ !== value) {
      this._linearMotionZ = value;

      this._updateLinearLimits();
    }
  }

  get linearMotionZ() {
    return this._linearMotionZ;
  }

  _convertTransform(pcTransform, ammoTransform) {
    const pos = pcTransform.getTranslation();
    const rot = new Quat();
    rot.setFromMat4(pcTransform);
    const ammoVec = new Ammo.btVector3(pos.x, pos.y, pos.z);
    const ammoQuat = new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w);
    ammoTransform.setOrigin(ammoVec);
    ammoTransform.setRotation(ammoQuat);
    Ammo.destroy(ammoVec);
    Ammo.destroy(ammoQuat);
  }

  _updateAngularLimits() {
    const constraint = this._constraint;

    if (constraint) {
      let lx, ly, lz, ux, uy, uz;

      if (this._angularMotionX === MOTION_LIMITED) {
        lx = this._angularLimitsX.x * math.DEG_TO_RAD;
        ux = this._angularLimitsX.y * math.DEG_TO_RAD;
      } else if (this._angularMotionX === MOTION_FREE) {
        lx = 1;
        ux = 0;
      } else {
        lx = ux = 0;
      }

      if (this._angularMotionY === MOTION_LIMITED) {
        ly = this._angularLimitsY.x * math.DEG_TO_RAD;
        uy = this._angularLimitsY.y * math.DEG_TO_RAD;
      } else if (this._angularMotionY === MOTION_FREE) {
        ly = 1;
        uy = 0;
      } else {
        ly = uy = 0;
      }

      if (this._angularMotionZ === MOTION_LIMITED) {
        lz = this._angularLimitsZ.x * math.DEG_TO_RAD;
        uz = this._angularLimitsZ.y * math.DEG_TO_RAD;
      } else if (this._angularMotionZ === MOTION_FREE) {
        lz = 1;
        uz = 0;
      } else {
        lz = uz = 0;
      }

      const limits = new Ammo.btVector3(lx, ly, lz);
      constraint.setAngularLowerLimit(limits);
      limits.setValue(ux, uy, uz);
      constraint.setAngularUpperLimit(limits);
      Ammo.destroy(limits);
    }
  }

  _updateLinearLimits() {
    const constraint = this._constraint;

    if (constraint) {
      let lx, ly, lz, ux, uy, uz;

      if (this._linearMotionX === MOTION_LIMITED) {
        lx = this._linearLimitsX.x;
        ux = this._linearLimitsX.y;
      } else if (this._linearMotionX === MOTION_FREE) {
        lx = 1;
        ux = 0;
      } else {
        lx = ux = 0;
      }

      if (this._linearMotionY === MOTION_LIMITED) {
        ly = this._linearLimitsY.x;
        uy = this._linearLimitsY.y;
      } else if (this._linearMotionY === MOTION_FREE) {
        ly = 1;
        uy = 0;
      } else {
        ly = uy = 0;
      }

      if (this._linearMotionZ === MOTION_LIMITED) {
        lz = this._linearLimitsZ.x;
        uz = this._linearLimitsZ.y;
      } else if (this._linearMotionZ === MOTION_FREE) {
        lz = 1;
        uz = 0;
      } else {
        lz = uz = 0;
      }

      const limits = new Ammo.btVector3(lx, ly, lz);
      constraint.setLinearLowerLimit(limits);
      limits.setValue(ux, uy, uz);
      constraint.setLinearUpperLimit(limits);
      Ammo.destroy(limits);
    }
  }

  _createConstraint() {
    if (this._entityA && this._entityA.rigidbody) {
      this._destroyConstraint();

      const mat = new Mat4();
      const bodyA = this._entityA.rigidbody.body;
      bodyA.activate();
      const jointWtm = this.entity.getWorldTransform();

      const entityAWtm = this._entityA.getWorldTransform();

      const invEntityAWtm = entityAWtm.clone().invert();
      mat.mul2(invEntityAWtm, jointWtm);
      const frameA = new Ammo.btTransform();

      this._convertTransform(mat, frameA);

      if (this._entityB && this._entityB.rigidbody) {
        const bodyB = this._entityB.rigidbody.body;
        bodyB.activate();

        const entityBWtm = this._entityB.getWorldTransform();

        const invEntityBWtm = entityBWtm.clone().invert();
        mat.mul2(invEntityBWtm, jointWtm);
        const frameB = new Ammo.btTransform();

        this._convertTransform(mat, frameB);

        this._constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA, bodyB, frameA, frameB, !this._enableCollision);
        Ammo.destroy(frameB);
      } else {
        this._constraint = new Ammo.btGeneric6DofSpringConstraint(bodyA, frameA, !this._enableCollision);
      }

      Ammo.destroy(frameA);
      const axis = ['X', 'Y', 'Z', 'X', 'Y', 'Z'];

      for (let i = 0; i < 6; i++) {
        const type = i < 3 ? '_linear' : '_angular';

        this._constraint.enableSpring(i, this[type + 'Spring' + axis[i]]);

        this._constraint.setDamping(i, this[type + 'Damping' + axis[i]]);

        this._constraint.setEquilibriumPoint(i, this[type + 'Equilibrium' + axis[i]]);

        this._constraint.setStiffness(i, this[type + 'Stiffness' + axis[i]]);
      }

      this._constraint.setBreakingImpulseThreshold(this._breakForce);

      this._updateLinearLimits();

      this._updateAngularLimits();

      const app = this.system.app;
      const dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
      dynamicsWorld.addConstraint(this._constraint, !this._enableCollision);
    }
  }

  _destroyConstraint() {
    if (this._constraint) {
      const app = this.system.app;
      const dynamicsWorld = app.systems.rigidbody.dynamicsWorld;
      dynamicsWorld.removeConstraint(this._constraint);
      Ammo.destroy(this._constraint);
      this._constraint = null;
    }
  }

  initFromData(data) {
    for (const prop of properties) {
      if (data.hasOwnProperty(prop)) {
        if (data[prop] instanceof Vec2) {
          this['_' + prop].copy(data[prop]);
        } else {
          this['_' + prop] = data[prop];
        }
      }
    }

    this._createConstraint();
  }

  onEnable() {
    this._createConstraint();
  }

  onDisable() {
    this._destroyConstraint();
  }

  _onSetEnabled(prop, old, value) {}

  _onBeforeRemove() {
    this.fire('remove');
  }

}

const functionMap = {
  Damping: 'setDamping',
  Equilibrium: 'setEquilibriumPoint',
  Spring: 'enableSpring',
  Stiffness: 'setStiffness'
};
['linear', 'angular'].forEach(type => {
  ['Damping', 'Equilibrium', 'Spring', 'Stiffness'].forEach(name => {
    ['X', 'Y', 'Z'].forEach(axis => {
      const prop = type + name + axis;
      const propInternal = '_' + prop;
      let index = type === 'linear' ? 0 : 3;
      if (axis === 'Y') index += 1;
      if (axis === 'Z') index += 2;
      Object.defineProperty(JointComponent.prototype, prop, {
        get: function () {
          return this[propInternal];
        },
        set: function (value) {
          if (this[propInternal] !== value) {
            this[propInternal] = value;

            this._constraint[functionMap[name]](index, value);
          }
        }
      });
    });
  });
});

export { JointComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvam9pbnQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uLy4uL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzIuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBNT1RJT05fRlJFRSwgTU9USU9OX0xJTUlURUQsIE1PVElPTl9MT0NLRUQgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuSm9pbnRDb21wb25lbnRTeXN0ZW19IEpvaW50Q29tcG9uZW50U3lzdGVtICovXG5cbmNvbnN0IHByb3BlcnRpZXMgPSBbXG4gICAgJ2FuZ3VsYXJEYW1waW5nWCcsICdhbmd1bGFyRGFtcGluZ1knLCAnYW5ndWxhckRhbXBpbmdaJyxcbiAgICAnYW5ndWxhckVxdWlsaWJyaXVtWCcsICdhbmd1bGFyRXF1aWxpYnJpdW1ZJywgJ2FuZ3VsYXJFcXVpbGlicml1bVonLFxuICAgICdhbmd1bGFyTGltaXRzWCcsICdhbmd1bGFyTGltaXRzWScsICdhbmd1bGFyTGltaXRzWicsXG4gICAgJ2FuZ3VsYXJNb3Rpb25YJywgJ2FuZ3VsYXJNb3Rpb25ZJywgJ2FuZ3VsYXJNb3Rpb25aJyxcbiAgICAnYW5ndWxhclNwcmluZ1gnLCAnYW5ndWxhclNwcmluZ1knLCAnYW5ndWxhclNwcmluZ1onLFxuICAgICdhbmd1bGFyU3RpZmZuZXNzWCcsICdhbmd1bGFyU3RpZmZuZXNzWScsICdhbmd1bGFyU3RpZmZuZXNzWicsXG4gICAgJ2JyZWFrRm9yY2UnLCAnZW5hYmxlQ29sbGlzaW9uJywgJ2VuYWJsZWQnLCAnZW50aXR5QScsICdlbnRpdHlCJyxcbiAgICAnbGluZWFyRGFtcGluZ1gnLCAnbGluZWFyRGFtcGluZ1knLCAnbGluZWFyRGFtcGluZ1onLFxuICAgICdsaW5lYXJFcXVpbGlicml1bVgnLCAnbGluZWFyRXF1aWxpYnJpdW1ZJywgJ2xpbmVhckVxdWlsaWJyaXVtWicsXG4gICAgJ2xpbmVhckxpbWl0c1gnLCAnbGluZWFyTGltaXRzWScsICdsaW5lYXJMaW1pdHNaJyxcbiAgICAnbGluZWFyTW90aW9uWCcsICdsaW5lYXJNb3Rpb25ZJywgJ2xpbmVhck1vdGlvblonLFxuICAgICdsaW5lYXJTcHJpbmdYJywgJ2xpbmVhclNwcmluZ1knLCAnbGluZWFyU3ByaW5nWicsXG4gICAgJ2xpbmVhclN0aWZmbmVzc1gnLCAnbGluZWFyU3RpZmZuZXNzWScsICdsaW5lYXJTdGlmZm5lc3NaJ1xuXTtcblxuLyoqXG4gKiBUaGUgSm9pbnRDb21wb25lbnQgYWRkcyBhIHBoeXNpY3Mgam9pbnQgY29uc3RyYWludCBsaW5raW5nIHR3byByaWdpZCBib2RpZXMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICogQGlnbm9yZVxuICovXG5jbGFzcyBKb2ludENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEpvaW50Q29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtKb2ludENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJywgJ0VSUk9SOiBBdHRlbXB0aW5nIHRvIGNyZWF0ZSBhIHBjLkpvaW50Q29tcG9uZW50IGJ1dCBBbW1vLmpzIGlzIG5vdCBsb2FkZWQnKTtcblxuICAgICAgICB0aGlzLl9jb25zdHJhaW50ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9lbnRpdHlBID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZW50aXR5QiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2JyZWFrRm9yY2UgPSAzLjRlKzM4O1xuICAgICAgICB0aGlzLl9lbmFibGVDb2xsaXNpb24gPSB0cnVlO1xuXG4gICAgICAgIC8vIExpbmVhciBYIGRlZ3JlZSBvZiBmcmVlZG9tXG4gICAgICAgIHRoaXMuX2xpbmVhck1vdGlvblggPSBNT1RJT05fTE9DS0VEO1xuICAgICAgICB0aGlzLl9saW5lYXJMaW1pdHNYID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX2xpbmVhclNwcmluZ1ggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbGluZWFyU3RpZmZuZXNzWCA9IDA7XG4gICAgICAgIHRoaXMuX2xpbmVhckRhbXBpbmdYID0gMTtcbiAgICAgICAgdGhpcy5fbGluZWFyRXF1aWxpYnJpdW1YID0gMDtcblxuICAgICAgICAvLyBMaW5lYXIgWSBkZWdyZWUgb2YgZnJlZWRvbVxuICAgICAgICB0aGlzLl9saW5lYXJNb3Rpb25ZID0gTU9USU9OX0xPQ0tFRDtcbiAgICAgICAgdGhpcy5fbGluZWFyTGltaXRzWSA9IG5ldyBWZWMyKDAsIDApO1xuICAgICAgICB0aGlzLl9saW5lYXJTcHJpbmdZID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xpbmVhclN0aWZmbmVzc1kgPSAwO1xuICAgICAgICB0aGlzLl9saW5lYXJEYW1waW5nWSA9IDE7XG4gICAgICAgIHRoaXMuX2xpbmVhckVxdWlsaWJyaXVtWSA9IDA7XG5cbiAgICAgICAgLy8gTGluZWFyIFogZGVncmVlIG9mIGZyZWVkb21cbiAgICAgICAgdGhpcy5fbGluZWFyTW90aW9uWiA9IE1PVElPTl9MT0NLRUQ7XG4gICAgICAgIHRoaXMuX2xpbmVhckxpbWl0c1ogPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fbGluZWFyU3ByaW5nWiA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9saW5lYXJTdGlmZm5lc3NaID0gMDtcbiAgICAgICAgdGhpcy5fbGluZWFyRGFtcGluZ1ogPSAxO1xuICAgICAgICB0aGlzLl9saW5lYXJFcXVpbGlicml1bVogPSAwO1xuXG4gICAgICAgIC8vIEFuZ3VsYXIgWCBkZWdyZWUgb2YgZnJlZWRvbVxuICAgICAgICB0aGlzLl9hbmd1bGFyTW90aW9uWCA9IE1PVElPTl9MT0NLRUQ7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJMaW1pdHNYID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJTcHJpbmdYID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJTdGlmZm5lc3NYID0gMDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckRhbXBpbmdYID0gMTtcbiAgICAgICAgdGhpcy5fYW5ndWxhckVxdWlsaWJyaXVtWCA9IDA7XG5cbiAgICAgICAgLy8gQW5ndWxhciBZIGRlZ3JlZSBvZiBmcmVlZG9tXG4gICAgICAgIHRoaXMuX2FuZ3VsYXJNb3Rpb25ZID0gTU9USU9OX0xPQ0tFRDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckxpbWl0c1kgPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclNwcmluZ1kgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclN0aWZmbmVzc1kgPSAwO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZ1kgPSAxO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRXF1aWxpYnJpdW1ZID0gMDtcblxuICAgICAgICAvLyBBbmd1bGFyIFogZGVncmVlIG9mIGZyZWVkb21cbiAgICAgICAgdGhpcy5fYW5ndWxhck1vdGlvblogPSBNT1RJT05fTE9DS0VEO1xuICAgICAgICB0aGlzLl9hbmd1bGFyTGltaXRzWiA9IG5ldyBWZWMyKDAsIDApO1xuICAgICAgICB0aGlzLl9hbmd1bGFyU3ByaW5nWiA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRXF1aWxpYnJpdW1aID0gMDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckRhbXBpbmdaID0gMTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclN0aWZmbmVzc1ogPSAwO1xuXG4gICAgICAgIHRoaXMub24oJ3NldF9lbmFibGVkJywgdGhpcy5fb25TZXRFbmFibGVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBzZXQgZW50aXR5QShib2R5KSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lDb25zdHJhaW50KCk7XG4gICAgICAgIHRoaXMuX2VudGl0eUEgPSBib2R5O1xuICAgICAgICB0aGlzLl9jcmVhdGVDb25zdHJhaW50KCk7XG4gICAgfVxuXG4gICAgZ2V0IGVudGl0eUEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbnRpdHlBO1xuICAgIH1cblxuICAgIHNldCBlbnRpdHlCKGJvZHkpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveUNvbnN0cmFpbnQoKTtcbiAgICAgICAgdGhpcy5fZW50aXR5QiA9IGJvZHk7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBnZXQgZW50aXR5QigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudGl0eUI7XG4gICAgfVxuXG4gICAgc2V0IGJyZWFrRm9yY2UoZm9yY2UpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnN0cmFpbnQgJiYgdGhpcy5fYnJlYWtGb3JjZSAhPT0gZm9yY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQuc2V0QnJlYWtpbmdJbXB1bHNlVGhyZXNob2xkKGZvcmNlKTtcbiAgICAgICAgICAgIHRoaXMuX2JyZWFrRm9yY2UgPSBmb3JjZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBicmVha0ZvcmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYnJlYWtGb3JjZTtcbiAgICB9XG5cbiAgICBzZXQgZW5hYmxlQ29sbGlzaW9uKGVuYWJsZUNvbGxpc2lvbikge1xuICAgICAgICB0aGlzLl9kZXN0cm95Q29uc3RyYWludCgpO1xuICAgICAgICB0aGlzLl9lbmFibGVDb2xsaXNpb24gPSBlbmFibGVDb2xsaXNpb247XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlQ29sbGlzaW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlQ29sbGlzaW9uO1xuICAgIH1cblxuICAgIHNldCBhbmd1bGFyTGltaXRzWChsaW1pdHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyTGltaXRzWC5lcXVhbHMobGltaXRzKSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhckxpbWl0c1guY29weShsaW1pdHMpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJMaW1pdHNYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckxpbWl0c1g7XG4gICAgfVxuXG4gICAgc2V0IGFuZ3VsYXJNb3Rpb25YKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJNb3Rpb25YID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhck1vdGlvblgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyTW90aW9uWDtcbiAgICB9XG5cbiAgICBzZXQgYW5ndWxhckxpbWl0c1kobGltaXRzKSB7XG4gICAgICAgIGlmICghdGhpcy5fYW5ndWxhckxpbWl0c1kuZXF1YWxzKGxpbWl0cykpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJMaW1pdHNZLmNvcHkobGltaXRzKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyTGltaXRzWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJMaW1pdHNZO1xuICAgIH1cblxuICAgIHNldCBhbmd1bGFyTW90aW9uWSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYW5ndWxhck1vdGlvblkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyTW90aW9uWSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJNb3Rpb25ZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhck1vdGlvblk7XG4gICAgfVxuXG4gICAgc2V0IGFuZ3VsYXJMaW1pdHNaKGxpbWl0cykge1xuICAgICAgICBpZiAoIXRoaXMuX2FuZ3VsYXJMaW1pdHNaLmVxdWFscyhsaW1pdHMpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyTGltaXRzWi5jb3B5KGxpbWl0cyk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhckxpbWl0c1ooKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyTGltaXRzWjtcbiAgICB9XG5cbiAgICBzZXQgYW5ndWxhck1vdGlvbloodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25aICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhck1vdGlvblogPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyTW90aW9uWigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJNb3Rpb25aO1xuICAgIH1cblxuICAgIHNldCBsaW5lYXJMaW1pdHNYKGxpbWl0cykge1xuICAgICAgICBpZiAoIXRoaXMuX2xpbmVhckxpbWl0c1guZXF1YWxzKGxpbWl0cykpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhckxpbWl0c1guY29weShsaW1pdHMpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyTGltaXRzWCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhckxpbWl0c1g7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVhck1vdGlvblgodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblggIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJNb3Rpb25YID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaW5lYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJNb3Rpb25YKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyTW90aW9uWDtcbiAgICB9XG5cbiAgICBzZXQgbGluZWFyTGltaXRzWShsaW1pdHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saW5lYXJMaW1pdHNZLmVxdWFscyhsaW1pdHMpKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJMaW1pdHNZLmNvcHkobGltaXRzKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhckxpbWl0c1koKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJMaW1pdHNZO1xuICAgIH1cblxuICAgIHNldCBsaW5lYXJNb3Rpb25ZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9saW5lYXJNb3Rpb25ZICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyTW90aW9uWSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyTW90aW9uWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhck1vdGlvblk7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVhckxpbWl0c1oobGltaXRzKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGluZWFyTGltaXRzWi5lcXVhbHMobGltaXRzKSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyTGltaXRzWi5jb3B5KGxpbWl0cyk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaW5lYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJMaW1pdHNaKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyTGltaXRzWjtcbiAgICB9XG5cbiAgICBzZXQgbGluZWFyTW90aW9uWih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbGluZWFyTW90aW9uWiAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhck1vdGlvblogPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhck1vdGlvblooKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJNb3Rpb25aO1xuICAgIH1cblxuICAgIF9jb252ZXJ0VHJhbnNmb3JtKHBjVHJhbnNmb3JtLCBhbW1vVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IHBvcyA9IHBjVHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKCk7XG4gICAgICAgIGNvbnN0IHJvdCA9IG5ldyBRdWF0KCk7XG4gICAgICAgIHJvdC5zZXRGcm9tTWF0NChwY1RyYW5zZm9ybSk7XG5cbiAgICAgICAgY29uc3QgYW1tb1ZlYyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgY29uc3QgYW1tb1F1YXQgPSBuZXcgQW1tby5idFF1YXRlcm5pb24ocm90LngsIHJvdC55LCByb3Queiwgcm90LncpO1xuXG4gICAgICAgIGFtbW9UcmFuc2Zvcm0uc2V0T3JpZ2luKGFtbW9WZWMpO1xuICAgICAgICBhbW1vVHJhbnNmb3JtLnNldFJvdGF0aW9uKGFtbW9RdWF0KTtcblxuICAgICAgICBBbW1vLmRlc3Ryb3koYW1tb1ZlYyk7XG4gICAgICAgIEFtbW8uZGVzdHJveShhbW1vUXVhdCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKSB7XG4gICAgICAgIGNvbnN0IGNvbnN0cmFpbnQgPSB0aGlzLl9jb25zdHJhaW50O1xuICAgICAgICBpZiAoY29uc3RyYWludCkge1xuICAgICAgICAgICAgbGV0IGx4LCBseSwgbHosIHV4LCB1eSwgdXo7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWCA9PT0gTU9USU9OX0xJTUlURUQpIHtcbiAgICAgICAgICAgICAgICBseCA9IHRoaXMuX2FuZ3VsYXJMaW1pdHNYLnggKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICAgICAgdXggPSB0aGlzLl9hbmd1bGFyTGltaXRzWC55ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWCA9PT0gTU9USU9OX0ZSRUUpIHtcbiAgICAgICAgICAgICAgICBseCA9IDE7XG4gICAgICAgICAgICAgICAgdXggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gTU9USU9OX0xPQ0tFRFxuICAgICAgICAgICAgICAgIGx4ID0gdXggPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fYW5ndWxhck1vdGlvblkgPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHkgPSB0aGlzLl9hbmd1bGFyTGltaXRzWS54ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgICAgIHV5ID0gdGhpcy5fYW5ndWxhckxpbWl0c1kueSAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYW5ndWxhck1vdGlvblkgPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHkgPSAxO1xuICAgICAgICAgICAgICAgIHV5ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseSA9IHV5ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25aID09PSBNT1RJT05fTElNSVRFRCkge1xuICAgICAgICAgICAgICAgIGx6ID0gdGhpcy5fYW5ndWxhckxpbWl0c1oueCAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgICAgICB1eiA9IHRoaXMuX2FuZ3VsYXJMaW1pdHNaLnkgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25aID09PSBNT1RJT05fRlJFRSkge1xuICAgICAgICAgICAgICAgIGx6ID0gMTtcbiAgICAgICAgICAgICAgICB1eiA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBNT1RJT05fTE9DS0VEXG4gICAgICAgICAgICAgICAgbHogPSB1eiA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGxpbWl0cyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhseCwgbHksIGx6KTtcbiAgICAgICAgICAgIGNvbnN0cmFpbnQuc2V0QW5ndWxhckxvd2VyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIGxpbWl0cy5zZXRWYWx1ZSh1eCwgdXksIHV6KTtcbiAgICAgICAgICAgIGNvbnN0cmFpbnQuc2V0QW5ndWxhclVwcGVyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShsaW1pdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUxpbmVhckxpbWl0cygpIHtcbiAgICAgICAgY29uc3QgY29uc3RyYWludCA9IHRoaXMuX2NvbnN0cmFpbnQ7XG4gICAgICAgIGlmIChjb25zdHJhaW50KSB7XG4gICAgICAgICAgICBsZXQgbHgsIGx5LCBseiwgdXgsIHV5LCB1ejtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblggPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHggPSB0aGlzLl9saW5lYXJMaW1pdHNYLng7XG4gICAgICAgICAgICAgICAgdXggPSB0aGlzLl9saW5lYXJMaW1pdHNYLnk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2xpbmVhck1vdGlvblggPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHggPSAxO1xuICAgICAgICAgICAgICAgIHV4ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseCA9IHV4ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblkgPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHkgPSB0aGlzLl9saW5lYXJMaW1pdHNZLng7XG4gICAgICAgICAgICAgICAgdXkgPSB0aGlzLl9saW5lYXJMaW1pdHNZLnk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2xpbmVhck1vdGlvblkgPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHkgPSAxO1xuICAgICAgICAgICAgICAgIHV5ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseSA9IHV5ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblogPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHogPSB0aGlzLl9saW5lYXJMaW1pdHNaLng7XG4gICAgICAgICAgICAgICAgdXogPSB0aGlzLl9saW5lYXJMaW1pdHNaLnk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2xpbmVhck1vdGlvblogPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHogPSAxO1xuICAgICAgICAgICAgICAgIHV6ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseiA9IHV6ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbGltaXRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKGx4LCBseSwgbHopO1xuICAgICAgICAgICAgY29uc3RyYWludC5zZXRMaW5lYXJMb3dlckxpbWl0KGxpbWl0cyk7XG4gICAgICAgICAgICBsaW1pdHMuc2V0VmFsdWUodXgsIHV5LCB1eik7XG4gICAgICAgICAgICBjb25zdHJhaW50LnNldExpbmVhclVwcGVyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShsaW1pdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnN0cmFpbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbnRpdHlBICYmIHRoaXMuX2VudGl0eUEucmlnaWRib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95Q29uc3RyYWludCgpO1xuXG4gICAgICAgICAgICBjb25zdCBtYXQgPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgICAgICBjb25zdCBib2R5QSA9IHRoaXMuX2VudGl0eUEucmlnaWRib2R5LmJvZHk7XG4gICAgICAgICAgICBib2R5QS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBjb25zdCBqb2ludFd0bSA9IHRoaXMuZW50aXR5LmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVudGl0eUFXdG0gPSB0aGlzLl9lbnRpdHlBLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBjb25zdCBpbnZFbnRpdHlBV3RtID0gZW50aXR5QVd0bS5jbG9uZSgpLmludmVydCgpO1xuICAgICAgICAgICAgbWF0Lm11bDIoaW52RW50aXR5QVd0bSwgam9pbnRXdG0pO1xuXG4gICAgICAgICAgICBjb25zdCBmcmFtZUEgPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgdGhpcy5fY29udmVydFRyYW5zZm9ybShtYXQsIGZyYW1lQSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9lbnRpdHlCICYmIHRoaXMuX2VudGl0eUIucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9keUIgPSB0aGlzLl9lbnRpdHlCLnJpZ2lkYm9keS5ib2R5O1xuICAgICAgICAgICAgICAgIGJvZHlCLmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlCV3RtID0gdGhpcy5fZW50aXR5Qi5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGludkVudGl0eUJXdG0gPSBlbnRpdHlCV3RtLmNsb25lKCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgbWF0Lm11bDIoaW52RW50aXR5Qld0bSwgam9pbnRXdG0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVCID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb252ZXJ0VHJhbnNmb3JtKG1hdCwgZnJhbWVCKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQgPSBuZXcgQW1tby5idEdlbmVyaWM2RG9mU3ByaW5nQ29uc3RyYWludChib2R5QSwgYm9keUIsIGZyYW1lQSwgZnJhbWVCLCAhdGhpcy5fZW5hYmxlQ29sbGlzaW9uKTtcblxuICAgICAgICAgICAgICAgIEFtbW8uZGVzdHJveShmcmFtZUIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50ID0gbmV3IEFtbW8uYnRHZW5lcmljNkRvZlNwcmluZ0NvbnN0cmFpbnQoYm9keUEsIGZyYW1lQSwgIXRoaXMuX2VuYWJsZUNvbGxpc2lvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShmcmFtZUEpO1xuXG4gICAgICAgICAgICBjb25zdCBheGlzID0gWydYJywgJ1knLCAnWicsICdYJywgJ1knLCAnWiddO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBpIDwgMyA/ICdfbGluZWFyJyA6ICdfYW5ndWxhcic7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5lbmFibGVTcHJpbmcoaSwgdGhpc1t0eXBlICsgJ1NwcmluZycgKyBheGlzW2ldXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5zZXREYW1waW5nKGksIHRoaXNbdHlwZSArICdEYW1waW5nJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LnNldEVxdWlsaWJyaXVtUG9pbnQoaSwgdGhpc1t0eXBlICsgJ0VxdWlsaWJyaXVtJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LnNldFN0aWZmbmVzcyhpLCB0aGlzW3R5cGUgKyAnU3RpZmZuZXNzJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5zZXRCcmVha2luZ0ltcHVsc2VUaHJlc2hvbGQodGhpcy5fYnJlYWtGb3JjZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuXG4gICAgICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgICAgICBjb25zdCBkeW5hbWljc1dvcmxkID0gYXBwLnN5c3RlbXMucmlnaWRib2R5LmR5bmFtaWNzV29ybGQ7XG4gICAgICAgICAgICBkeW5hbWljc1dvcmxkLmFkZENvbnN0cmFpbnQodGhpcy5fY29uc3RyYWludCwgIXRoaXMuX2VuYWJsZUNvbGxpc2lvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZGVzdHJveUNvbnN0cmFpbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb25zdHJhaW50KSB7XG4gICAgICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgICAgICBjb25zdCBkeW5hbWljc1dvcmxkID0gYXBwLnN5c3RlbXMucmlnaWRib2R5LmR5bmFtaWNzV29ybGQ7XG4gICAgICAgICAgICBkeW5hbWljc1dvcmxkLnJlbW92ZUNvbnN0cmFpbnQodGhpcy5fY29uc3RyYWludCk7XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLl9jb25zdHJhaW50KTtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdEZyb21EYXRhKGRhdGEpIHtcbiAgICAgICAgZm9yIChjb25zdCBwcm9wIG9mIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGFbcHJvcF0gaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbJ18nICsgcHJvcF0uY29weShkYXRhW3Byb3BdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzWydfJyArIHByb3BdID0gZGF0YVtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jcmVhdGVDb25zdHJhaW50KCk7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lDb25zdHJhaW50KCk7XG4gICAgfVxuXG4gICAgX29uU2V0RW5hYmxlZChwcm9wLCBvbGQsIHZhbHVlKSB7XG4gICAgfVxuXG4gICAgX29uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScpO1xuICAgIH1cbn1cblxuY29uc3QgZnVuY3Rpb25NYXAgPSB7XG4gICAgRGFtcGluZzogJ3NldERhbXBpbmcnLFxuICAgIEVxdWlsaWJyaXVtOiAnc2V0RXF1aWxpYnJpdW1Qb2ludCcsXG4gICAgU3ByaW5nOiAnZW5hYmxlU3ByaW5nJyxcbiAgICBTdGlmZm5lc3M6ICdzZXRTdGlmZm5lc3MnXG59O1xuXG4vLyBEZWZpbmUgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIGZvciBlYWNoIGRlZ3JlZSBvZiBmcmVlZG9tXG5bJ2xpbmVhcicsICdhbmd1bGFyJ10uZm9yRWFjaCgodHlwZSkgPT4ge1xuICAgIFsnRGFtcGluZycsICdFcXVpbGlicml1bScsICdTcHJpbmcnLCAnU3RpZmZuZXNzJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgICBbJ1gnLCAnWScsICdaJ10uZm9yRWFjaCgoYXhpcykgPT4ge1xuICAgICAgICAgICAgY29uc3QgcHJvcCA9IHR5cGUgKyBuYW1lICsgYXhpcztcbiAgICAgICAgICAgIGNvbnN0IHByb3BJbnRlcm5hbCA9ICdfJyArIHByb3A7XG5cbiAgICAgICAgICAgIGxldCBpbmRleCA9ICh0eXBlID09PSAnbGluZWFyJykgPyAwIDogMztcbiAgICAgICAgICAgIGlmIChheGlzID09PSAnWScpIGluZGV4ICs9IDE7XG4gICAgICAgICAgICBpZiAoYXhpcyA9PT0gJ1onKSBpbmRleCArPSAyO1xuXG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSm9pbnRDb21wb25lbnQucHJvdG90eXBlLCBwcm9wLCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3Byb3BJbnRlcm5hbF07XG4gICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzW3Byb3BJbnRlcm5hbF0gIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW3Byb3BJbnRlcm5hbF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnRbZnVuY3Rpb25NYXBbbmFtZV1dKGluZGV4LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59KTtcblxuZXhwb3J0IHsgSm9pbnRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJwcm9wZXJ0aWVzIiwiSm9pbnRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIkRlYnVnIiwiYXNzZXJ0IiwiQW1tbyIsIl9jb25zdHJhaW50IiwiX2VudGl0eUEiLCJfZW50aXR5QiIsIl9icmVha0ZvcmNlIiwiX2VuYWJsZUNvbGxpc2lvbiIsIl9saW5lYXJNb3Rpb25YIiwiTU9USU9OX0xPQ0tFRCIsIl9saW5lYXJMaW1pdHNYIiwiVmVjMiIsIl9saW5lYXJTcHJpbmdYIiwiX2xpbmVhclN0aWZmbmVzc1giLCJfbGluZWFyRGFtcGluZ1giLCJfbGluZWFyRXF1aWxpYnJpdW1YIiwiX2xpbmVhck1vdGlvblkiLCJfbGluZWFyTGltaXRzWSIsIl9saW5lYXJTcHJpbmdZIiwiX2xpbmVhclN0aWZmbmVzc1kiLCJfbGluZWFyRGFtcGluZ1kiLCJfbGluZWFyRXF1aWxpYnJpdW1ZIiwiX2xpbmVhck1vdGlvbloiLCJfbGluZWFyTGltaXRzWiIsIl9saW5lYXJTcHJpbmdaIiwiX2xpbmVhclN0aWZmbmVzc1oiLCJfbGluZWFyRGFtcGluZ1oiLCJfbGluZWFyRXF1aWxpYnJpdW1aIiwiX2FuZ3VsYXJNb3Rpb25YIiwiX2FuZ3VsYXJMaW1pdHNYIiwiX2FuZ3VsYXJTcHJpbmdYIiwiX2FuZ3VsYXJTdGlmZm5lc3NYIiwiX2FuZ3VsYXJEYW1waW5nWCIsIl9hbmd1bGFyRXF1aWxpYnJpdW1YIiwiX2FuZ3VsYXJNb3Rpb25ZIiwiX2FuZ3VsYXJMaW1pdHNZIiwiX2FuZ3VsYXJTcHJpbmdZIiwiX2FuZ3VsYXJTdGlmZm5lc3NZIiwiX2FuZ3VsYXJEYW1waW5nWSIsIl9hbmd1bGFyRXF1aWxpYnJpdW1ZIiwiX2FuZ3VsYXJNb3Rpb25aIiwiX2FuZ3VsYXJMaW1pdHNaIiwiX2FuZ3VsYXJTcHJpbmdaIiwiX2FuZ3VsYXJFcXVpbGlicml1bVoiLCJfYW5ndWxhckRhbXBpbmdaIiwiX2FuZ3VsYXJTdGlmZm5lc3NaIiwib24iLCJfb25TZXRFbmFibGVkIiwiZW50aXR5QSIsImJvZHkiLCJfZGVzdHJveUNvbnN0cmFpbnQiLCJfY3JlYXRlQ29uc3RyYWludCIsImVudGl0eUIiLCJicmVha0ZvcmNlIiwiZm9yY2UiLCJzZXRCcmVha2luZ0ltcHVsc2VUaHJlc2hvbGQiLCJlbmFibGVDb2xsaXNpb24iLCJhbmd1bGFyTGltaXRzWCIsImxpbWl0cyIsImVxdWFscyIsImNvcHkiLCJfdXBkYXRlQW5ndWxhckxpbWl0cyIsImFuZ3VsYXJNb3Rpb25YIiwidmFsdWUiLCJhbmd1bGFyTGltaXRzWSIsImFuZ3VsYXJNb3Rpb25ZIiwiYW5ndWxhckxpbWl0c1oiLCJhbmd1bGFyTW90aW9uWiIsImxpbmVhckxpbWl0c1giLCJfdXBkYXRlTGluZWFyTGltaXRzIiwibGluZWFyTW90aW9uWCIsImxpbmVhckxpbWl0c1kiLCJsaW5lYXJNb3Rpb25ZIiwibGluZWFyTGltaXRzWiIsImxpbmVhck1vdGlvbloiLCJfY29udmVydFRyYW5zZm9ybSIsInBjVHJhbnNmb3JtIiwiYW1tb1RyYW5zZm9ybSIsInBvcyIsImdldFRyYW5zbGF0aW9uIiwicm90IiwiUXVhdCIsInNldEZyb21NYXQ0IiwiYW1tb1ZlYyIsImJ0VmVjdG9yMyIsIngiLCJ5IiwieiIsImFtbW9RdWF0IiwiYnRRdWF0ZXJuaW9uIiwidyIsInNldE9yaWdpbiIsInNldFJvdGF0aW9uIiwiZGVzdHJveSIsImNvbnN0cmFpbnQiLCJseCIsImx5IiwibHoiLCJ1eCIsInV5IiwidXoiLCJNT1RJT05fTElNSVRFRCIsIm1hdGgiLCJERUdfVE9fUkFEIiwiTU9USU9OX0ZSRUUiLCJzZXRBbmd1bGFyTG93ZXJMaW1pdCIsInNldFZhbHVlIiwic2V0QW5ndWxhclVwcGVyTGltaXQiLCJzZXRMaW5lYXJMb3dlckxpbWl0Iiwic2V0TGluZWFyVXBwZXJMaW1pdCIsInJpZ2lkYm9keSIsIm1hdCIsIk1hdDQiLCJib2R5QSIsImFjdGl2YXRlIiwiam9pbnRXdG0iLCJnZXRXb3JsZFRyYW5zZm9ybSIsImVudGl0eUFXdG0iLCJpbnZFbnRpdHlBV3RtIiwiY2xvbmUiLCJpbnZlcnQiLCJtdWwyIiwiZnJhbWVBIiwiYnRUcmFuc2Zvcm0iLCJib2R5QiIsImVudGl0eUJXdG0iLCJpbnZFbnRpdHlCV3RtIiwiZnJhbWVCIiwiYnRHZW5lcmljNkRvZlNwcmluZ0NvbnN0cmFpbnQiLCJheGlzIiwiaSIsInR5cGUiLCJlbmFibGVTcHJpbmciLCJzZXREYW1waW5nIiwic2V0RXF1aWxpYnJpdW1Qb2ludCIsInNldFN0aWZmbmVzcyIsImFwcCIsImR5bmFtaWNzV29ybGQiLCJzeXN0ZW1zIiwiYWRkQ29uc3RyYWludCIsInJlbW92ZUNvbnN0cmFpbnQiLCJpbml0RnJvbURhdGEiLCJkYXRhIiwicHJvcCIsImhhc093blByb3BlcnR5Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJvbGQiLCJfb25CZWZvcmVSZW1vdmUiLCJmaXJlIiwiZnVuY3Rpb25NYXAiLCJEYW1waW5nIiwiRXF1aWxpYnJpdW0iLCJTcHJpbmciLCJTdGlmZm5lc3MiLCJmb3JFYWNoIiwibmFtZSIsInByb3BJbnRlcm5hbCIsImluZGV4IiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJwcm90b3R5cGUiLCJnZXQiLCJzZXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFjQSxNQUFNQSxVQUFVLEdBQUcsQ0FDZixpQkFEZSxFQUNJLGlCQURKLEVBQ3VCLGlCQUR2QixFQUVmLHFCQUZlLEVBRVEscUJBRlIsRUFFK0IscUJBRi9CLEVBR2YsZ0JBSGUsRUFHRyxnQkFISCxFQUdxQixnQkFIckIsRUFJZixnQkFKZSxFQUlHLGdCQUpILEVBSXFCLGdCQUpyQixFQUtmLGdCQUxlLEVBS0csZ0JBTEgsRUFLcUIsZ0JBTHJCLEVBTWYsbUJBTmUsRUFNTSxtQkFOTixFQU0yQixtQkFOM0IsRUFPZixZQVBlLEVBT0QsaUJBUEMsRUFPa0IsU0FQbEIsRUFPNkIsU0FQN0IsRUFPd0MsU0FQeEMsRUFRZixnQkFSZSxFQVFHLGdCQVJILEVBUXFCLGdCQVJyQixFQVNmLG9CQVRlLEVBU08sb0JBVFAsRUFTNkIsb0JBVDdCLEVBVWYsZUFWZSxFQVVFLGVBVkYsRUFVbUIsZUFWbkIsRUFXZixlQVhlLEVBV0UsZUFYRixF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
