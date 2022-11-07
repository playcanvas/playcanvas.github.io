/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvam9pbnQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IE1PVElPTl9GUkVFLCBNT1RJT05fTElNSVRFRCwgTU9USU9OX0xPQ0tFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5Kb2ludENvbXBvbmVudFN5c3RlbX0gSm9pbnRDb21wb25lbnRTeXN0ZW0gKi9cblxuY29uc3QgcHJvcGVydGllcyA9IFtcbiAgICAnYW5ndWxhckRhbXBpbmdYJywgJ2FuZ3VsYXJEYW1waW5nWScsICdhbmd1bGFyRGFtcGluZ1onLFxuICAgICdhbmd1bGFyRXF1aWxpYnJpdW1YJywgJ2FuZ3VsYXJFcXVpbGlicml1bVknLCAnYW5ndWxhckVxdWlsaWJyaXVtWicsXG4gICAgJ2FuZ3VsYXJMaW1pdHNYJywgJ2FuZ3VsYXJMaW1pdHNZJywgJ2FuZ3VsYXJMaW1pdHNaJyxcbiAgICAnYW5ndWxhck1vdGlvblgnLCAnYW5ndWxhck1vdGlvblknLCAnYW5ndWxhck1vdGlvblonLFxuICAgICdhbmd1bGFyU3ByaW5nWCcsICdhbmd1bGFyU3ByaW5nWScsICdhbmd1bGFyU3ByaW5nWicsXG4gICAgJ2FuZ3VsYXJTdGlmZm5lc3NYJywgJ2FuZ3VsYXJTdGlmZm5lc3NZJywgJ2FuZ3VsYXJTdGlmZm5lc3NaJyxcbiAgICAnYnJlYWtGb3JjZScsICdlbmFibGVDb2xsaXNpb24nLCAnZW5hYmxlZCcsICdlbnRpdHlBJywgJ2VudGl0eUInLFxuICAgICdsaW5lYXJEYW1waW5nWCcsICdsaW5lYXJEYW1waW5nWScsICdsaW5lYXJEYW1waW5nWicsXG4gICAgJ2xpbmVhckVxdWlsaWJyaXVtWCcsICdsaW5lYXJFcXVpbGlicml1bVknLCAnbGluZWFyRXF1aWxpYnJpdW1aJyxcbiAgICAnbGluZWFyTGltaXRzWCcsICdsaW5lYXJMaW1pdHNZJywgJ2xpbmVhckxpbWl0c1onLFxuICAgICdsaW5lYXJNb3Rpb25YJywgJ2xpbmVhck1vdGlvblknLCAnbGluZWFyTW90aW9uWicsXG4gICAgJ2xpbmVhclNwcmluZ1gnLCAnbGluZWFyU3ByaW5nWScsICdsaW5lYXJTcHJpbmdaJyxcbiAgICAnbGluZWFyU3RpZmZuZXNzWCcsICdsaW5lYXJTdGlmZm5lc3NZJywgJ2xpbmVhclN0aWZmbmVzc1onXG5dO1xuXG4vKipcbiAqIFRoZSBKb2ludENvbXBvbmVudCBhZGRzIGEgcGh5c2ljcyBqb2ludCBjb25zdHJhaW50IGxpbmtpbmcgdHdvIHJpZ2lkIGJvZGllcy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEpvaW50Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgSm9pbnRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0pvaW50Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQodHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnLCAnRVJST1I6IEF0dGVtcHRpbmcgdG8gY3JlYXRlIGEgcGMuSm9pbnRDb21wb25lbnQgYnV0IEFtbW8uanMgaXMgbm90IGxvYWRlZCcpO1xuXG4gICAgICAgIHRoaXMuX2NvbnN0cmFpbnQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2VudGl0eUEgPSBudWxsO1xuICAgICAgICB0aGlzLl9lbnRpdHlCID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYnJlYWtGb3JjZSA9IDMuNGUrMzg7XG4gICAgICAgIHRoaXMuX2VuYWJsZUNvbGxpc2lvbiA9IHRydWU7XG5cbiAgICAgICAgLy8gTGluZWFyIFggZGVncmVlIG9mIGZyZWVkb21cbiAgICAgICAgdGhpcy5fbGluZWFyTW90aW9uWCA9IE1PVElPTl9MT0NLRUQ7XG4gICAgICAgIHRoaXMuX2xpbmVhckxpbWl0c1ggPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fbGluZWFyU3ByaW5nWCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9saW5lYXJTdGlmZm5lc3NYID0gMDtcbiAgICAgICAgdGhpcy5fbGluZWFyRGFtcGluZ1ggPSAxO1xuICAgICAgICB0aGlzLl9saW5lYXJFcXVpbGlicml1bVggPSAwO1xuXG4gICAgICAgIC8vIExpbmVhciBZIGRlZ3JlZSBvZiBmcmVlZG9tXG4gICAgICAgIHRoaXMuX2xpbmVhck1vdGlvblkgPSBNT1RJT05fTE9DS0VEO1xuICAgICAgICB0aGlzLl9saW5lYXJMaW1pdHNZID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX2xpbmVhclNwcmluZ1kgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbGluZWFyU3RpZmZuZXNzWSA9IDA7XG4gICAgICAgIHRoaXMuX2xpbmVhckRhbXBpbmdZID0gMTtcbiAgICAgICAgdGhpcy5fbGluZWFyRXF1aWxpYnJpdW1ZID0gMDtcblxuICAgICAgICAvLyBMaW5lYXIgWiBkZWdyZWUgb2YgZnJlZWRvbVxuICAgICAgICB0aGlzLl9saW5lYXJNb3Rpb25aID0gTU9USU9OX0xPQ0tFRDtcbiAgICAgICAgdGhpcy5fbGluZWFyTGltaXRzWiA9IG5ldyBWZWMyKDAsIDApO1xuICAgICAgICB0aGlzLl9saW5lYXJTcHJpbmdaID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xpbmVhclN0aWZmbmVzc1ogPSAwO1xuICAgICAgICB0aGlzLl9saW5lYXJEYW1waW5nWiA9IDE7XG4gICAgICAgIHRoaXMuX2xpbmVhckVxdWlsaWJyaXVtWiA9IDA7XG5cbiAgICAgICAgLy8gQW5ndWxhciBYIGRlZ3JlZSBvZiBmcmVlZG9tXG4gICAgICAgIHRoaXMuX2FuZ3VsYXJNb3Rpb25YID0gTU9USU9OX0xPQ0tFRDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckxpbWl0c1ggPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclNwcmluZ1ggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclN0aWZmbmVzc1ggPSAwO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZ1ggPSAxO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRXF1aWxpYnJpdW1YID0gMDtcblxuICAgICAgICAvLyBBbmd1bGFyIFkgZGVncmVlIG9mIGZyZWVkb21cbiAgICAgICAgdGhpcy5fYW5ndWxhck1vdGlvblkgPSBNT1RJT05fTE9DS0VEO1xuICAgICAgICB0aGlzLl9hbmd1bGFyTGltaXRzWSA9IG5ldyBWZWMyKDAsIDApO1xuICAgICAgICB0aGlzLl9hbmd1bGFyU3ByaW5nWSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hbmd1bGFyU3RpZmZuZXNzWSA9IDA7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJEYW1waW5nWSA9IDE7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJFcXVpbGlicml1bVkgPSAwO1xuXG4gICAgICAgIC8vIEFuZ3VsYXIgWiBkZWdyZWUgb2YgZnJlZWRvbVxuICAgICAgICB0aGlzLl9hbmd1bGFyTW90aW9uWiA9IE1PVElPTl9MT0NLRUQ7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJMaW1pdHNaID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJTcHJpbmdaID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJFcXVpbGlicml1bVogPSAwO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZ1ogPSAxO1xuICAgICAgICB0aGlzLl9hbmd1bGFyU3RpZmZuZXNzWiA9IDA7XG5cbiAgICAgICAgdGhpcy5vbignc2V0X2VuYWJsZWQnLCB0aGlzLl9vblNldEVuYWJsZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIHNldCBlbnRpdHlBKGJvZHkpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveUNvbnN0cmFpbnQoKTtcbiAgICAgICAgdGhpcy5fZW50aXR5QSA9IGJvZHk7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBnZXQgZW50aXR5QSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudGl0eUE7XG4gICAgfVxuXG4gICAgc2V0IGVudGl0eUIoYm9keSkge1xuICAgICAgICB0aGlzLl9kZXN0cm95Q29uc3RyYWludCgpO1xuICAgICAgICB0aGlzLl9lbnRpdHlCID0gYm9keTtcbiAgICAgICAgdGhpcy5fY3JlYXRlQ29uc3RyYWludCgpO1xuICAgIH1cblxuICAgIGdldCBlbnRpdHlCKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW50aXR5QjtcbiAgICB9XG5cbiAgICBzZXQgYnJlYWtGb3JjZShmb3JjZSkge1xuICAgICAgICBpZiAodGhpcy5fY29uc3RyYWludCAmJiB0aGlzLl9icmVha0ZvcmNlICE9PSBmb3JjZSkge1xuICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5zZXRCcmVha2luZ0ltcHVsc2VUaHJlc2hvbGQoZm9yY2UpO1xuICAgICAgICAgICAgdGhpcy5fYnJlYWtGb3JjZSA9IGZvcmNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGJyZWFrRm9yY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9icmVha0ZvcmNlO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVDb2xsaXNpb24oZW5hYmxlQ29sbGlzaW9uKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lDb25zdHJhaW50KCk7XG4gICAgICAgIHRoaXMuX2VuYWJsZUNvbGxpc2lvbiA9IGVuYWJsZUNvbGxpc2lvbjtcbiAgICAgICAgdGhpcy5fY3JlYXRlQ29uc3RyYWludCgpO1xuICAgIH1cblxuICAgIGdldCBlbmFibGVDb2xsaXNpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVDb2xsaXNpb247XG4gICAgfVxuXG4gICAgc2V0IGFuZ3VsYXJMaW1pdHNYKGxpbWl0cykge1xuICAgICAgICBpZiAoIXRoaXMuX2FuZ3VsYXJMaW1pdHNYLmVxdWFscyhsaW1pdHMpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyTGltaXRzWC5jb3B5KGxpbWl0cyk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhckxpbWl0c1goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyTGltaXRzWDtcbiAgICB9XG5cbiAgICBzZXQgYW5ndWxhck1vdGlvblgodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25YICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhck1vdGlvblggPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyTW90aW9uWCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJNb3Rpb25YO1xuICAgIH1cblxuICAgIHNldCBhbmd1bGFyTGltaXRzWShsaW1pdHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyTGltaXRzWS5lcXVhbHMobGltaXRzKSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhckxpbWl0c1kuY29weShsaW1pdHMpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJMaW1pdHNZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckxpbWl0c1k7XG4gICAgfVxuXG4gICAgc2V0IGFuZ3VsYXJNb3Rpb25ZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJNb3Rpb25ZID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhck1vdGlvblkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyTW90aW9uWTtcbiAgICB9XG5cbiAgICBzZXQgYW5ndWxhckxpbWl0c1oobGltaXRzKSB7XG4gICAgICAgIGlmICghdGhpcy5fYW5ndWxhckxpbWl0c1ouZXF1YWxzKGxpbWl0cykpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJMaW1pdHNaLmNvcHkobGltaXRzKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyTGltaXRzWigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJMaW1pdHNaO1xuICAgIH1cblxuICAgIHNldCBhbmd1bGFyTW90aW9uWih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYW5ndWxhck1vdGlvblogIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyTW90aW9uWiA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJNb3Rpb25aKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhck1vdGlvblo7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVhckxpbWl0c1gobGltaXRzKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGluZWFyTGltaXRzWC5lcXVhbHMobGltaXRzKSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyTGltaXRzWC5jb3B5KGxpbWl0cyk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaW5lYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJMaW1pdHNYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyTGltaXRzWDtcbiAgICB9XG5cbiAgICBzZXQgbGluZWFyTW90aW9uWCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbGluZWFyTW90aW9uWCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhck1vdGlvblggPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhck1vdGlvblgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJNb3Rpb25YO1xuICAgIH1cblxuICAgIHNldCBsaW5lYXJMaW1pdHNZKGxpbWl0cykge1xuICAgICAgICBpZiAoIXRoaXMuX2xpbmVhckxpbWl0c1kuZXF1YWxzKGxpbWl0cykpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhckxpbWl0c1kuY29weShsaW1pdHMpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyTGltaXRzWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhckxpbWl0c1k7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVhck1vdGlvblkodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJNb3Rpb25ZID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaW5lYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJNb3Rpb25ZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyTW90aW9uWTtcbiAgICB9XG5cbiAgICBzZXQgbGluZWFyTGltaXRzWihsaW1pdHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saW5lYXJMaW1pdHNaLmVxdWFscyhsaW1pdHMpKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJMaW1pdHNaLmNvcHkobGltaXRzKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhckxpbWl0c1ooKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJMaW1pdHNaO1xuICAgIH1cblxuICAgIHNldCBsaW5lYXJNb3Rpb25aKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9saW5lYXJNb3Rpb25aICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyTW90aW9uWiA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyTW90aW9uWigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhck1vdGlvblo7XG4gICAgfVxuXG4gICAgX2NvbnZlcnRUcmFuc2Zvcm0ocGNUcmFuc2Zvcm0sIGFtbW9UcmFuc2Zvcm0pIHtcbiAgICAgICAgY29uc3QgcG9zID0gcGNUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24oKTtcbiAgICAgICAgY29uc3Qgcm90ID0gbmV3IFF1YXQoKTtcbiAgICAgICAgcm90LnNldEZyb21NYXQ0KHBjVHJhbnNmb3JtKTtcblxuICAgICAgICBjb25zdCBhbW1vVmVjID0gbmV3IEFtbW8uYnRWZWN0b3IzKHBvcy54LCBwb3MueSwgcG9zLnopO1xuICAgICAgICBjb25zdCBhbW1vUXVhdCA9IG5ldyBBbW1vLmJ0UXVhdGVybmlvbihyb3QueCwgcm90LnksIHJvdC56LCByb3Qudyk7XG5cbiAgICAgICAgYW1tb1RyYW5zZm9ybS5zZXRPcmlnaW4oYW1tb1ZlYyk7XG4gICAgICAgIGFtbW9UcmFuc2Zvcm0uc2V0Um90YXRpb24oYW1tb1F1YXQpO1xuXG4gICAgICAgIEFtbW8uZGVzdHJveShhbW1vVmVjKTtcbiAgICAgICAgQW1tby5kZXN0cm95KGFtbW9RdWF0KTtcbiAgICB9XG5cbiAgICBfdXBkYXRlQW5ndWxhckxpbWl0cygpIHtcbiAgICAgICAgY29uc3QgY29uc3RyYWludCA9IHRoaXMuX2NvbnN0cmFpbnQ7XG4gICAgICAgIGlmIChjb25zdHJhaW50KSB7XG4gICAgICAgICAgICBsZXQgbHgsIGx5LCBseiwgdXgsIHV5LCB1ejtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25YID09PSBNT1RJT05fTElNSVRFRCkge1xuICAgICAgICAgICAgICAgIGx4ID0gdGhpcy5fYW5ndWxhckxpbWl0c1gueCAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgICAgICB1eCA9IHRoaXMuX2FuZ3VsYXJMaW1pdHNYLnkgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25YID09PSBNT1RJT05fRlJFRSkge1xuICAgICAgICAgICAgICAgIGx4ID0gMTtcbiAgICAgICAgICAgICAgICB1eCA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBNT1RJT05fTE9DS0VEXG4gICAgICAgICAgICAgICAgbHggPSB1eCA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWSA9PT0gTU9USU9OX0xJTUlURUQpIHtcbiAgICAgICAgICAgICAgICBseSA9IHRoaXMuX2FuZ3VsYXJMaW1pdHNZLnggKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICAgICAgdXkgPSB0aGlzLl9hbmd1bGFyTGltaXRzWS55ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWSA9PT0gTU9USU9OX0ZSRUUpIHtcbiAgICAgICAgICAgICAgICBseSA9IDE7XG4gICAgICAgICAgICAgICAgdXkgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gTU9USU9OX0xPQ0tFRFxuICAgICAgICAgICAgICAgIGx5ID0gdXkgPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fYW5ndWxhck1vdGlvblogPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHogPSB0aGlzLl9hbmd1bGFyTGltaXRzWi54ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgICAgIHV6ID0gdGhpcy5fYW5ndWxhckxpbWl0c1oueSAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYW5ndWxhck1vdGlvblogPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHogPSAxO1xuICAgICAgICAgICAgICAgIHV6ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseiA9IHV6ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbGltaXRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKGx4LCBseSwgbHopO1xuICAgICAgICAgICAgY29uc3RyYWludC5zZXRBbmd1bGFyTG93ZXJMaW1pdChsaW1pdHMpO1xuICAgICAgICAgICAgbGltaXRzLnNldFZhbHVlKHV4LCB1eSwgdXopO1xuICAgICAgICAgICAgY29uc3RyYWludC5zZXRBbmd1bGFyVXBwZXJMaW1pdChsaW1pdHMpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KGxpbWl0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlTGluZWFyTGltaXRzKCkge1xuICAgICAgICBjb25zdCBjb25zdHJhaW50ID0gdGhpcy5fY29uc3RyYWludDtcbiAgICAgICAgaWYgKGNvbnN0cmFpbnQpIHtcbiAgICAgICAgICAgIGxldCBseCwgbHksIGx6LCB1eCwgdXksIHV6O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbGluZWFyTW90aW9uWCA9PT0gTU9USU9OX0xJTUlURUQpIHtcbiAgICAgICAgICAgICAgICBseCA9IHRoaXMuX2xpbmVhckxpbWl0c1gueDtcbiAgICAgICAgICAgICAgICB1eCA9IHRoaXMuX2xpbmVhckxpbWl0c1gueTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fbGluZWFyTW90aW9uWCA9PT0gTU9USU9OX0ZSRUUpIHtcbiAgICAgICAgICAgICAgICBseCA9IDE7XG4gICAgICAgICAgICAgICAgdXggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gTU9USU9OX0xPQ0tFRFxuICAgICAgICAgICAgICAgIGx4ID0gdXggPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fbGluZWFyTW90aW9uWSA9PT0gTU9USU9OX0xJTUlURUQpIHtcbiAgICAgICAgICAgICAgICBseSA9IHRoaXMuX2xpbmVhckxpbWl0c1kueDtcbiAgICAgICAgICAgICAgICB1eSA9IHRoaXMuX2xpbmVhckxpbWl0c1kueTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fbGluZWFyTW90aW9uWSA9PT0gTU9USU9OX0ZSRUUpIHtcbiAgICAgICAgICAgICAgICBseSA9IDE7XG4gICAgICAgICAgICAgICAgdXkgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gTU9USU9OX0xPQ0tFRFxuICAgICAgICAgICAgICAgIGx5ID0gdXkgPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fbGluZWFyTW90aW9uWiA9PT0gTU9USU9OX0xJTUlURUQpIHtcbiAgICAgICAgICAgICAgICBseiA9IHRoaXMuX2xpbmVhckxpbWl0c1oueDtcbiAgICAgICAgICAgICAgICB1eiA9IHRoaXMuX2xpbmVhckxpbWl0c1oueTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fbGluZWFyTW90aW9uWiA9PT0gTU9USU9OX0ZSRUUpIHtcbiAgICAgICAgICAgICAgICBseiA9IDE7XG4gICAgICAgICAgICAgICAgdXogPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gTU9USU9OX0xPQ0tFRFxuICAgICAgICAgICAgICAgIGx6ID0gdXogPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBsaW1pdHMgPSBuZXcgQW1tby5idFZlY3RvcjMobHgsIGx5LCBseik7XG4gICAgICAgICAgICBjb25zdHJhaW50LnNldExpbmVhckxvd2VyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIGxpbWl0cy5zZXRWYWx1ZSh1eCwgdXksIHV6KTtcbiAgICAgICAgICAgIGNvbnN0cmFpbnQuc2V0TGluZWFyVXBwZXJMaW1pdChsaW1pdHMpO1xuICAgICAgICAgICAgQW1tby5kZXN0cm95KGxpbWl0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY3JlYXRlQ29uc3RyYWludCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VudGl0eUEgJiYgdGhpcy5fZW50aXR5QS5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lDb25zdHJhaW50KCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdCA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJvZHlBID0gdGhpcy5fZW50aXR5QS5yaWdpZGJvZHkuYm9keTtcbiAgICAgICAgICAgIGJvZHlBLmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGpvaW50V3RtID0gdGhpcy5lbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgY29uc3QgZW50aXR5QVd0bSA9IHRoaXMuX2VudGl0eUEuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIGNvbnN0IGludkVudGl0eUFXdG0gPSBlbnRpdHlBV3RtLmNsb25lKCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICBtYXQubXVsMihpbnZFbnRpdHlBV3RtLCBqb2ludFd0bSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGZyYW1lQSA9IG5ldyBBbW1vLmJ0VHJhbnNmb3JtKCk7XG4gICAgICAgICAgICB0aGlzLl9jb252ZXJ0VHJhbnNmb3JtKG1hdCwgZnJhbWVBKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2VudGl0eUIgJiYgdGhpcy5fZW50aXR5Qi5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib2R5QiA9IHRoaXMuX2VudGl0eUIucmlnaWRib2R5LmJvZHk7XG4gICAgICAgICAgICAgICAgYm9keUIuYWN0aXZhdGUoKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGVudGl0eUJXdG0gPSB0aGlzLl9lbnRpdHlCLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW52RW50aXR5Qld0bSA9IGVudGl0eUJXdG0uY2xvbmUoKS5pbnZlcnQoKTtcbiAgICAgICAgICAgICAgICBtYXQubXVsMihpbnZFbnRpdHlCV3RtLCBqb2ludFd0bSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZUIgPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnZlcnRUcmFuc2Zvcm0obWF0LCBmcmFtZUIpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludCA9IG5ldyBBbW1vLmJ0R2VuZXJpYzZEb2ZTcHJpbmdDb25zdHJhaW50KGJvZHlBLCBib2R5QiwgZnJhbWVBLCBmcmFtZUIsICF0aGlzLl9lbmFibGVDb2xsaXNpb24pO1xuXG4gICAgICAgICAgICAgICAgQW1tby5kZXN0cm95KGZyYW1lQik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQgPSBuZXcgQW1tby5idEdlbmVyaWM2RG9mU3ByaW5nQ29uc3RyYWludChib2R5QSwgZnJhbWVBLCAhdGhpcy5fZW5hYmxlQ29sbGlzaW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgQW1tby5kZXN0cm95KGZyYW1lQSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGF4aXMgPSBbJ1gnLCAnWScsICdaJywgJ1gnLCAnWScsICdaJ107XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IGkgPCAzID8gJ19saW5lYXInIDogJ19hbmd1bGFyJztcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LmVuYWJsZVNwcmluZyhpLCB0aGlzW3R5cGUgKyAnU3ByaW5nJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LnNldERhbXBpbmcoaSwgdGhpc1t0eXBlICsgJ0RhbXBpbmcnICsgYXhpc1tpXV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQuc2V0RXF1aWxpYnJpdW1Qb2ludChpLCB0aGlzW3R5cGUgKyAnRXF1aWxpYnJpdW0nICsgYXhpc1tpXV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQuc2V0U3RpZmZuZXNzKGksIHRoaXNbdHlwZSArICdTdGlmZm5lc3MnICsgYXhpc1tpXV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LnNldEJyZWFraW5nSW1wdWxzZVRocmVzaG9sZCh0aGlzLl9icmVha0ZvcmNlKTtcblxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgICAgIGNvbnN0IGR5bmFtaWNzV29ybGQgPSBhcHAuc3lzdGVtcy5yaWdpZGJvZHkuZHluYW1pY3NXb3JsZDtcbiAgICAgICAgICAgIGR5bmFtaWNzV29ybGQuYWRkQ29uc3RyYWludCh0aGlzLl9jb25zdHJhaW50LCAhdGhpcy5fZW5hYmxlQ29sbGlzaW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9kZXN0cm95Q29uc3RyYWludCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnN0cmFpbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgICAgIGNvbnN0IGR5bmFtaWNzV29ybGQgPSBhcHAuc3lzdGVtcy5yaWdpZGJvZHkuZHluYW1pY3NXb3JsZDtcbiAgICAgICAgICAgIGR5bmFtaWNzV29ybGQucmVtb3ZlQ29uc3RyYWludCh0aGlzLl9jb25zdHJhaW50KTtcblxuICAgICAgICAgICAgQW1tby5kZXN0cm95KHRoaXMuX2NvbnN0cmFpbnQpO1xuICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbml0RnJvbURhdGEoZGF0YSkge1xuICAgICAgICBmb3IgKGNvbnN0IHByb3Agb2YgcHJvcGVydGllcykge1xuICAgICAgICAgICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YVtwcm9wXSBpbnN0YW5jZW9mIFZlYzIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1snXycgKyBwcm9wXS5jb3B5KGRhdGFbcHJvcF0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbJ18nICsgcHJvcF0gPSBkYXRhW3Byb3BdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlQ29uc3RyYWludCgpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBfb25TZXRFbmFibGVkKHByb3AsIG9sZCwgdmFsdWUpIHtcbiAgICB9XG5cbiAgICBfb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgfVxufVxuXG5jb25zdCBmdW5jdGlvbk1hcCA9IHtcbiAgICBEYW1waW5nOiAnc2V0RGFtcGluZycsXG4gICAgRXF1aWxpYnJpdW06ICdzZXRFcXVpbGlicml1bVBvaW50JyxcbiAgICBTcHJpbmc6ICdlbmFibGVTcHJpbmcnLFxuICAgIFN0aWZmbmVzczogJ3NldFN0aWZmbmVzcydcbn07XG5cbi8vIERlZmluZSBhZGRpdGlvbmFsIHByb3BlcnRpZXMgZm9yIGVhY2ggZGVncmVlIG9mIGZyZWVkb21cblsnbGluZWFyJywgJ2FuZ3VsYXInXS5mb3JFYWNoKCh0eXBlKSA9PiB7XG4gICAgWydEYW1waW5nJywgJ0VxdWlsaWJyaXVtJywgJ1NwcmluZycsICdTdGlmZm5lc3MnXS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgIFsnWCcsICdZJywgJ1onXS5mb3JFYWNoKChheGlzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwcm9wID0gdHlwZSArIG5hbWUgKyBheGlzO1xuICAgICAgICAgICAgY29uc3QgcHJvcEludGVybmFsID0gJ18nICsgcHJvcDtcblxuICAgICAgICAgICAgbGV0IGluZGV4ID0gKHR5cGUgPT09ICdsaW5lYXInKSA/IDAgOiAzO1xuICAgICAgICAgICAgaWYgKGF4aXMgPT09ICdZJykgaW5kZXggKz0gMTtcbiAgICAgICAgICAgIGlmIChheGlzID09PSAnWicpIGluZGV4ICs9IDI7XG5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShKb2ludENvbXBvbmVudC5wcm90b3R5cGUsIHByb3AsIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNbcHJvcEludGVybmFsXTtcbiAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXNbcHJvcEludGVybmFsXSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbcHJvcEludGVybmFsXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludFtmdW5jdGlvbk1hcFtuYW1lXV0oaW5kZXgsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn0pO1xuXG5leHBvcnQgeyBKb2ludENvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbInByb3BlcnRpZXMiLCJKb2ludENvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiRGVidWciLCJhc3NlcnQiLCJBbW1vIiwiX2NvbnN0cmFpbnQiLCJfZW50aXR5QSIsIl9lbnRpdHlCIiwiX2JyZWFrRm9yY2UiLCJfZW5hYmxlQ29sbGlzaW9uIiwiX2xpbmVhck1vdGlvblgiLCJNT1RJT05fTE9DS0VEIiwiX2xpbmVhckxpbWl0c1giLCJWZWMyIiwiX2xpbmVhclNwcmluZ1giLCJfbGluZWFyU3RpZmZuZXNzWCIsIl9saW5lYXJEYW1waW5nWCIsIl9saW5lYXJFcXVpbGlicml1bVgiLCJfbGluZWFyTW90aW9uWSIsIl9saW5lYXJMaW1pdHNZIiwiX2xpbmVhclNwcmluZ1kiLCJfbGluZWFyU3RpZmZuZXNzWSIsIl9saW5lYXJEYW1waW5nWSIsIl9saW5lYXJFcXVpbGlicml1bVkiLCJfbGluZWFyTW90aW9uWiIsIl9saW5lYXJMaW1pdHNaIiwiX2xpbmVhclNwcmluZ1oiLCJfbGluZWFyU3RpZmZuZXNzWiIsIl9saW5lYXJEYW1waW5nWiIsIl9saW5lYXJFcXVpbGlicml1bVoiLCJfYW5ndWxhck1vdGlvblgiLCJfYW5ndWxhckxpbWl0c1giLCJfYW5ndWxhclNwcmluZ1giLCJfYW5ndWxhclN0aWZmbmVzc1giLCJfYW5ndWxhckRhbXBpbmdYIiwiX2FuZ3VsYXJFcXVpbGlicml1bVgiLCJfYW5ndWxhck1vdGlvblkiLCJfYW5ndWxhckxpbWl0c1kiLCJfYW5ndWxhclNwcmluZ1kiLCJfYW5ndWxhclN0aWZmbmVzc1kiLCJfYW5ndWxhckRhbXBpbmdZIiwiX2FuZ3VsYXJFcXVpbGlicml1bVkiLCJfYW5ndWxhck1vdGlvbloiLCJfYW5ndWxhckxpbWl0c1oiLCJfYW5ndWxhclNwcmluZ1oiLCJfYW5ndWxhckVxdWlsaWJyaXVtWiIsIl9hbmd1bGFyRGFtcGluZ1oiLCJfYW5ndWxhclN0aWZmbmVzc1oiLCJvbiIsIl9vblNldEVuYWJsZWQiLCJlbnRpdHlBIiwiYm9keSIsIl9kZXN0cm95Q29uc3RyYWludCIsIl9jcmVhdGVDb25zdHJhaW50IiwiZW50aXR5QiIsImJyZWFrRm9yY2UiLCJmb3JjZSIsInNldEJyZWFraW5nSW1wdWxzZVRocmVzaG9sZCIsImVuYWJsZUNvbGxpc2lvbiIsImFuZ3VsYXJMaW1pdHNYIiwibGltaXRzIiwiZXF1YWxzIiwiY29weSIsIl91cGRhdGVBbmd1bGFyTGltaXRzIiwiYW5ndWxhck1vdGlvblgiLCJ2YWx1ZSIsImFuZ3VsYXJMaW1pdHNZIiwiYW5ndWxhck1vdGlvblkiLCJhbmd1bGFyTGltaXRzWiIsImFuZ3VsYXJNb3Rpb25aIiwibGluZWFyTGltaXRzWCIsIl91cGRhdGVMaW5lYXJMaW1pdHMiLCJsaW5lYXJNb3Rpb25YIiwibGluZWFyTGltaXRzWSIsImxpbmVhck1vdGlvblkiLCJsaW5lYXJMaW1pdHNaIiwibGluZWFyTW90aW9uWiIsIl9jb252ZXJ0VHJhbnNmb3JtIiwicGNUcmFuc2Zvcm0iLCJhbW1vVHJhbnNmb3JtIiwicG9zIiwiZ2V0VHJhbnNsYXRpb24iLCJyb3QiLCJRdWF0Iiwic2V0RnJvbU1hdDQiLCJhbW1vVmVjIiwiYnRWZWN0b3IzIiwieCIsInkiLCJ6IiwiYW1tb1F1YXQiLCJidFF1YXRlcm5pb24iLCJ3Iiwic2V0T3JpZ2luIiwic2V0Um90YXRpb24iLCJkZXN0cm95IiwiY29uc3RyYWludCIsImx4IiwibHkiLCJseiIsInV4IiwidXkiLCJ1eiIsIk1PVElPTl9MSU1JVEVEIiwibWF0aCIsIkRFR19UT19SQUQiLCJNT1RJT05fRlJFRSIsInNldEFuZ3VsYXJMb3dlckxpbWl0Iiwic2V0VmFsdWUiLCJzZXRBbmd1bGFyVXBwZXJMaW1pdCIsInNldExpbmVhckxvd2VyTGltaXQiLCJzZXRMaW5lYXJVcHBlckxpbWl0IiwicmlnaWRib2R5IiwibWF0IiwiTWF0NCIsImJvZHlBIiwiYWN0aXZhdGUiLCJqb2ludFd0bSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZW50aXR5QVd0bSIsImludkVudGl0eUFXdG0iLCJjbG9uZSIsImludmVydCIsIm11bDIiLCJmcmFtZUEiLCJidFRyYW5zZm9ybSIsImJvZHlCIiwiZW50aXR5Qld0bSIsImludkVudGl0eUJXdG0iLCJmcmFtZUIiLCJidEdlbmVyaWM2RG9mU3ByaW5nQ29uc3RyYWludCIsImF4aXMiLCJpIiwidHlwZSIsImVuYWJsZVNwcmluZyIsInNldERhbXBpbmciLCJzZXRFcXVpbGlicml1bVBvaW50Iiwic2V0U3RpZmZuZXNzIiwiYXBwIiwiZHluYW1pY3NXb3JsZCIsInN5c3RlbXMiLCJhZGRDb25zdHJhaW50IiwicmVtb3ZlQ29uc3RyYWludCIsImluaXRGcm9tRGF0YSIsImRhdGEiLCJwcm9wIiwiaGFzT3duUHJvcGVydHkiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsIm9sZCIsIl9vbkJlZm9yZVJlbW92ZSIsImZpcmUiLCJmdW5jdGlvbk1hcCIsIkRhbXBpbmciLCJFcXVpbGlicml1bSIsIlNwcmluZyIsIlN0aWZmbmVzcyIsImZvckVhY2giLCJuYW1lIiwicHJvcEludGVybmFsIiwiaW5kZXgiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsInByb3RvdHlwZSIsImdldCIsInNldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQWNBLE1BQU1BLFVBQVUsR0FBRyxDQUNmLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUN2RCxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFDbkUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQ3BELGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUNwRCxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFDcEQsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQzdELFlBQVksRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFDaEUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQ3BELG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUNoRSxlQUFlLEVBQUUsZUFBZSxF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
