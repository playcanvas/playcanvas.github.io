/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Component } from '../component.js';
import { MOTION_LOCKED, MOTION_LIMITED, MOTION_FREE } from './constants.js';

const properties = ['angularDampingX', 'angularDampingY', 'angularDampingZ', 'angularEquilibriumX', 'angularEquilibriumY', 'angularEquilibriumZ', 'angularLimitsX', 'angularLimitsY', 'angularLimitsZ', 'angularMotionX', 'angularMotionY', 'angularMotionZ', 'angularSpringX', 'angularSpringY', 'angularSpringZ', 'angularStiffnessX', 'angularStiffnessY', 'angularStiffnessZ', 'breakForce', 'enableCollision', 'enabled', 'entityA', 'entityB', 'linearDampingX', 'linearDampingY', 'linearDampingZ', 'linearEquilibriumX', 'linearEquilibriumY', 'linearEquilibriumZ', 'linearLimitsX', 'linearLimitsY', 'linearLimitsZ', 'linearMotionX', 'linearMotionY', 'linearMotionZ', 'linearSpringX', 'linearSpringY', 'linearSpringZ', 'linearStiffnessX', 'linearStiffnessY', 'linearStiffnessZ'];

/**
 * The JointComponent adds a physics joint constraint linking two rigid bodies.
 *
 * @augments Component
 * @ignore
 */
class JointComponent extends Component {
  /**
   * Create a new JointComponent instance.
   *
   * @param {import('./system.js').JointComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);
    Debug.assert(typeof Ammo !== 'undefined', 'ERROR: Attempting to create a pc.JointComponent but Ammo.js is not loaded');
    this._constraint = null;
    this._entityA = null;
    this._entityB = null;
    this._breakForce = 3.4e+38;
    this._enableCollision = true;

    // Linear X degree of freedom
    this._linearMotionX = MOTION_LOCKED;
    this._linearLimitsX = new Vec2(0, 0);
    this._linearSpringX = false;
    this._linearStiffnessX = 0;
    this._linearDampingX = 1;
    this._linearEquilibriumX = 0;

    // Linear Y degree of freedom
    this._linearMotionY = MOTION_LOCKED;
    this._linearLimitsY = new Vec2(0, 0);
    this._linearSpringY = false;
    this._linearStiffnessY = 0;
    this._linearDampingY = 1;
    this._linearEquilibriumY = 0;

    // Linear Z degree of freedom
    this._linearMotionZ = MOTION_LOCKED;
    this._linearLimitsZ = new Vec2(0, 0);
    this._linearSpringZ = false;
    this._linearStiffnessZ = 0;
    this._linearDampingZ = 1;
    this._linearEquilibriumZ = 0;

    // Angular X degree of freedom
    this._angularMotionX = MOTION_LOCKED;
    this._angularLimitsX = new Vec2(0, 0);
    this._angularSpringX = false;
    this._angularStiffnessX = 0;
    this._angularDampingX = 1;
    this._angularEquilibriumX = 0;

    // Angular Y degree of freedom
    this._angularMotionY = MOTION_LOCKED;
    this._angularLimitsY = new Vec2(0, 0);
    this._angularSpringY = false;
    this._angularStiffnessY = 0;
    this._angularDampingY = 1;
    this._angularEquilibriumY = 0;

    // Angular Z degree of freedom
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
        // MOTION_LOCKED
        lx = ux = 0;
      }
      if (this._angularMotionY === MOTION_LIMITED) {
        ly = this._angularLimitsY.x * math.DEG_TO_RAD;
        uy = this._angularLimitsY.y * math.DEG_TO_RAD;
      } else if (this._angularMotionY === MOTION_FREE) {
        ly = 1;
        uy = 0;
      } else {
        // MOTION_LOCKED
        ly = uy = 0;
      }
      if (this._angularMotionZ === MOTION_LIMITED) {
        lz = this._angularLimitsZ.x * math.DEG_TO_RAD;
        uz = this._angularLimitsZ.y * math.DEG_TO_RAD;
      } else if (this._angularMotionZ === MOTION_FREE) {
        lz = 1;
        uz = 0;
      } else {
        // MOTION_LOCKED
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
        // MOTION_LOCKED
        lx = ux = 0;
      }
      if (this._linearMotionY === MOTION_LIMITED) {
        ly = this._linearLimitsY.x;
        uy = this._linearLimitsY.y;
      } else if (this._linearMotionY === MOTION_FREE) {
        ly = 1;
        uy = 0;
      } else {
        // MOTION_LOCKED
        ly = uy = 0;
      }
      if (this._linearMotionZ === MOTION_LIMITED) {
        lz = this._linearLimitsZ.x;
        uz = this._linearLimitsZ.y;
      } else if (this._linearMotionZ === MOTION_FREE) {
        lz = 1;
        uz = 0;
      } else {
        // MOTION_LOCKED
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

// Define additional properties for each degree of freedom
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvam9pbnQvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IE1PVElPTl9GUkVFLCBNT1RJT05fTElNSVRFRCwgTU9USU9OX0xPQ0tFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuY29uc3QgcHJvcGVydGllcyA9IFtcbiAgICAnYW5ndWxhckRhbXBpbmdYJywgJ2FuZ3VsYXJEYW1waW5nWScsICdhbmd1bGFyRGFtcGluZ1onLFxuICAgICdhbmd1bGFyRXF1aWxpYnJpdW1YJywgJ2FuZ3VsYXJFcXVpbGlicml1bVknLCAnYW5ndWxhckVxdWlsaWJyaXVtWicsXG4gICAgJ2FuZ3VsYXJMaW1pdHNYJywgJ2FuZ3VsYXJMaW1pdHNZJywgJ2FuZ3VsYXJMaW1pdHNaJyxcbiAgICAnYW5ndWxhck1vdGlvblgnLCAnYW5ndWxhck1vdGlvblknLCAnYW5ndWxhck1vdGlvblonLFxuICAgICdhbmd1bGFyU3ByaW5nWCcsICdhbmd1bGFyU3ByaW5nWScsICdhbmd1bGFyU3ByaW5nWicsXG4gICAgJ2FuZ3VsYXJTdGlmZm5lc3NYJywgJ2FuZ3VsYXJTdGlmZm5lc3NZJywgJ2FuZ3VsYXJTdGlmZm5lc3NaJyxcbiAgICAnYnJlYWtGb3JjZScsICdlbmFibGVDb2xsaXNpb24nLCAnZW5hYmxlZCcsICdlbnRpdHlBJywgJ2VudGl0eUInLFxuICAgICdsaW5lYXJEYW1waW5nWCcsICdsaW5lYXJEYW1waW5nWScsICdsaW5lYXJEYW1waW5nWicsXG4gICAgJ2xpbmVhckVxdWlsaWJyaXVtWCcsICdsaW5lYXJFcXVpbGlicml1bVknLCAnbGluZWFyRXF1aWxpYnJpdW1aJyxcbiAgICAnbGluZWFyTGltaXRzWCcsICdsaW5lYXJMaW1pdHNZJywgJ2xpbmVhckxpbWl0c1onLFxuICAgICdsaW5lYXJNb3Rpb25YJywgJ2xpbmVhck1vdGlvblknLCAnbGluZWFyTW90aW9uWicsXG4gICAgJ2xpbmVhclNwcmluZ1gnLCAnbGluZWFyU3ByaW5nWScsICdsaW5lYXJTcHJpbmdaJyxcbiAgICAnbGluZWFyU3RpZmZuZXNzWCcsICdsaW5lYXJTdGlmZm5lc3NZJywgJ2xpbmVhclN0aWZmbmVzc1onXG5dO1xuXG4vKipcbiAqIFRoZSBKb2ludENvbXBvbmVudCBhZGRzIGEgcGh5c2ljcyBqb2ludCBjb25zdHJhaW50IGxpbmtpbmcgdHdvIHJpZ2lkIGJvZGllcy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEpvaW50Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgSm9pbnRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5Kb2ludENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0XG4gICAgICogY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJywgJ0VSUk9SOiBBdHRlbXB0aW5nIHRvIGNyZWF0ZSBhIHBjLkpvaW50Q29tcG9uZW50IGJ1dCBBbW1vLmpzIGlzIG5vdCBsb2FkZWQnKTtcblxuICAgICAgICB0aGlzLl9jb25zdHJhaW50ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9lbnRpdHlBID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZW50aXR5QiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2JyZWFrRm9yY2UgPSAzLjRlKzM4O1xuICAgICAgICB0aGlzLl9lbmFibGVDb2xsaXNpb24gPSB0cnVlO1xuXG4gICAgICAgIC8vIExpbmVhciBYIGRlZ3JlZSBvZiBmcmVlZG9tXG4gICAgICAgIHRoaXMuX2xpbmVhck1vdGlvblggPSBNT1RJT05fTE9DS0VEO1xuICAgICAgICB0aGlzLl9saW5lYXJMaW1pdHNYID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX2xpbmVhclNwcmluZ1ggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbGluZWFyU3RpZmZuZXNzWCA9IDA7XG4gICAgICAgIHRoaXMuX2xpbmVhckRhbXBpbmdYID0gMTtcbiAgICAgICAgdGhpcy5fbGluZWFyRXF1aWxpYnJpdW1YID0gMDtcblxuICAgICAgICAvLyBMaW5lYXIgWSBkZWdyZWUgb2YgZnJlZWRvbVxuICAgICAgICB0aGlzLl9saW5lYXJNb3Rpb25ZID0gTU9USU9OX0xPQ0tFRDtcbiAgICAgICAgdGhpcy5fbGluZWFyTGltaXRzWSA9IG5ldyBWZWMyKDAsIDApO1xuICAgICAgICB0aGlzLl9saW5lYXJTcHJpbmdZID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xpbmVhclN0aWZmbmVzc1kgPSAwO1xuICAgICAgICB0aGlzLl9saW5lYXJEYW1waW5nWSA9IDE7XG4gICAgICAgIHRoaXMuX2xpbmVhckVxdWlsaWJyaXVtWSA9IDA7XG5cbiAgICAgICAgLy8gTGluZWFyIFogZGVncmVlIG9mIGZyZWVkb21cbiAgICAgICAgdGhpcy5fbGluZWFyTW90aW9uWiA9IE1PVElPTl9MT0NLRUQ7XG4gICAgICAgIHRoaXMuX2xpbmVhckxpbWl0c1ogPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fbGluZWFyU3ByaW5nWiA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9saW5lYXJTdGlmZm5lc3NaID0gMDtcbiAgICAgICAgdGhpcy5fbGluZWFyRGFtcGluZ1ogPSAxO1xuICAgICAgICB0aGlzLl9saW5lYXJFcXVpbGlicml1bVogPSAwO1xuXG4gICAgICAgIC8vIEFuZ3VsYXIgWCBkZWdyZWUgb2YgZnJlZWRvbVxuICAgICAgICB0aGlzLl9hbmd1bGFyTW90aW9uWCA9IE1PVElPTl9MT0NLRUQ7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJMaW1pdHNYID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJTcHJpbmdYID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2FuZ3VsYXJTdGlmZm5lc3NYID0gMDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckRhbXBpbmdYID0gMTtcbiAgICAgICAgdGhpcy5fYW5ndWxhckVxdWlsaWJyaXVtWCA9IDA7XG5cbiAgICAgICAgLy8gQW5ndWxhciBZIGRlZ3JlZSBvZiBmcmVlZG9tXG4gICAgICAgIHRoaXMuX2FuZ3VsYXJNb3Rpb25ZID0gTU9USU9OX0xPQ0tFRDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckxpbWl0c1kgPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclNwcmluZ1kgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclN0aWZmbmVzc1kgPSAwO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRGFtcGluZ1kgPSAxO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRXF1aWxpYnJpdW1ZID0gMDtcblxuICAgICAgICAvLyBBbmd1bGFyIFogZGVncmVlIG9mIGZyZWVkb21cbiAgICAgICAgdGhpcy5fYW5ndWxhck1vdGlvblogPSBNT1RJT05fTE9DS0VEO1xuICAgICAgICB0aGlzLl9hbmd1bGFyTGltaXRzWiA9IG5ldyBWZWMyKDAsIDApO1xuICAgICAgICB0aGlzLl9hbmd1bGFyU3ByaW5nWiA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hbmd1bGFyRXF1aWxpYnJpdW1aID0gMDtcbiAgICAgICAgdGhpcy5fYW5ndWxhckRhbXBpbmdaID0gMTtcbiAgICAgICAgdGhpcy5fYW5ndWxhclN0aWZmbmVzc1ogPSAwO1xuXG4gICAgICAgIHRoaXMub24oJ3NldF9lbmFibGVkJywgdGhpcy5fb25TZXRFbmFibGVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBzZXQgZW50aXR5QShib2R5KSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lDb25zdHJhaW50KCk7XG4gICAgICAgIHRoaXMuX2VudGl0eUEgPSBib2R5O1xuICAgICAgICB0aGlzLl9jcmVhdGVDb25zdHJhaW50KCk7XG4gICAgfVxuXG4gICAgZ2V0IGVudGl0eUEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbnRpdHlBO1xuICAgIH1cblxuICAgIHNldCBlbnRpdHlCKGJvZHkpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveUNvbnN0cmFpbnQoKTtcbiAgICAgICAgdGhpcy5fZW50aXR5QiA9IGJvZHk7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBnZXQgZW50aXR5QigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudGl0eUI7XG4gICAgfVxuXG4gICAgc2V0IGJyZWFrRm9yY2UoZm9yY2UpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnN0cmFpbnQgJiYgdGhpcy5fYnJlYWtGb3JjZSAhPT0gZm9yY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQuc2V0QnJlYWtpbmdJbXB1bHNlVGhyZXNob2xkKGZvcmNlKTtcbiAgICAgICAgICAgIHRoaXMuX2JyZWFrRm9yY2UgPSBmb3JjZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBicmVha0ZvcmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYnJlYWtGb3JjZTtcbiAgICB9XG5cbiAgICBzZXQgZW5hYmxlQ29sbGlzaW9uKGVuYWJsZUNvbGxpc2lvbikge1xuICAgICAgICB0aGlzLl9kZXN0cm95Q29uc3RyYWludCgpO1xuICAgICAgICB0aGlzLl9lbmFibGVDb2xsaXNpb24gPSBlbmFibGVDb2xsaXNpb247XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlQ29sbGlzaW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlQ29sbGlzaW9uO1xuICAgIH1cblxuICAgIHNldCBhbmd1bGFyTGltaXRzWChsaW1pdHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbmd1bGFyTGltaXRzWC5lcXVhbHMobGltaXRzKSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhckxpbWl0c1guY29weShsaW1pdHMpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJMaW1pdHNYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhckxpbWl0c1g7XG4gICAgfVxuXG4gICAgc2V0IGFuZ3VsYXJNb3Rpb25YKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJNb3Rpb25YID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhck1vdGlvblgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyTW90aW9uWDtcbiAgICB9XG5cbiAgICBzZXQgYW5ndWxhckxpbWl0c1kobGltaXRzKSB7XG4gICAgICAgIGlmICghdGhpcy5fYW5ndWxhckxpbWl0c1kuZXF1YWxzKGxpbWl0cykpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuZ3VsYXJMaW1pdHNZLmNvcHkobGltaXRzKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyTGltaXRzWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJMaW1pdHNZO1xuICAgIH1cblxuICAgIHNldCBhbmd1bGFyTW90aW9uWSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYW5ndWxhck1vdGlvblkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyTW90aW9uWSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuZ3VsYXJNb3Rpb25ZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5ndWxhck1vdGlvblk7XG4gICAgfVxuXG4gICAgc2V0IGFuZ3VsYXJMaW1pdHNaKGxpbWl0cykge1xuICAgICAgICBpZiAoIXRoaXMuX2FuZ3VsYXJMaW1pdHNaLmVxdWFscyhsaW1pdHMpKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmd1bGFyTGltaXRzWi5jb3B5KGxpbWl0cyk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVBbmd1bGFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5ndWxhckxpbWl0c1ooKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmd1bGFyTGltaXRzWjtcbiAgICB9XG5cbiAgICBzZXQgYW5ndWxhck1vdGlvbloodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25aICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYW5ndWxhck1vdGlvblogPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmd1bGFyTW90aW9uWigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuZ3VsYXJNb3Rpb25aO1xuICAgIH1cblxuICAgIHNldCBsaW5lYXJMaW1pdHNYKGxpbWl0cykge1xuICAgICAgICBpZiAoIXRoaXMuX2xpbmVhckxpbWl0c1guZXF1YWxzKGxpbWl0cykpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhckxpbWl0c1guY29weShsaW1pdHMpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyTGltaXRzWCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhckxpbWl0c1g7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVhck1vdGlvblgodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblggIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJNb3Rpb25YID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaW5lYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJNb3Rpb25YKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyTW90aW9uWDtcbiAgICB9XG5cbiAgICBzZXQgbGluZWFyTGltaXRzWShsaW1pdHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saW5lYXJMaW1pdHNZLmVxdWFscyhsaW1pdHMpKSB7XG4gICAgICAgICAgICB0aGlzLl9saW5lYXJMaW1pdHNZLmNvcHkobGltaXRzKTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhckxpbWl0c1koKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJMaW1pdHNZO1xuICAgIH1cblxuICAgIHNldCBsaW5lYXJNb3Rpb25ZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9saW5lYXJNb3Rpb25ZICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyTW90aW9uWSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTGluZWFyTGltaXRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZWFyTW90aW9uWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVhck1vdGlvblk7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVhckxpbWl0c1oobGltaXRzKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGluZWFyTGltaXRzWi5lcXVhbHMobGltaXRzKSkge1xuICAgICAgICAgICAgdGhpcy5fbGluZWFyTGltaXRzWi5jb3B5KGxpbWl0cyk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMaW5lYXJMaW1pdHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lYXJMaW1pdHNaKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZWFyTGltaXRzWjtcbiAgICB9XG5cbiAgICBzZXQgbGluZWFyTW90aW9uWih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbGluZWFyTW90aW9uWiAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpbmVhck1vdGlvblogPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpbmVhck1vdGlvblooKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lYXJNb3Rpb25aO1xuICAgIH1cblxuICAgIF9jb252ZXJ0VHJhbnNmb3JtKHBjVHJhbnNmb3JtLCBhbW1vVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IHBvcyA9IHBjVHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKCk7XG4gICAgICAgIGNvbnN0IHJvdCA9IG5ldyBRdWF0KCk7XG4gICAgICAgIHJvdC5zZXRGcm9tTWF0NChwY1RyYW5zZm9ybSk7XG5cbiAgICAgICAgY29uc3QgYW1tb1ZlYyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhwb3MueCwgcG9zLnksIHBvcy56KTtcbiAgICAgICAgY29uc3QgYW1tb1F1YXQgPSBuZXcgQW1tby5idFF1YXRlcm5pb24ocm90LngsIHJvdC55LCByb3Queiwgcm90LncpO1xuXG4gICAgICAgIGFtbW9UcmFuc2Zvcm0uc2V0T3JpZ2luKGFtbW9WZWMpO1xuICAgICAgICBhbW1vVHJhbnNmb3JtLnNldFJvdGF0aW9uKGFtbW9RdWF0KTtcblxuICAgICAgICBBbW1vLmRlc3Ryb3koYW1tb1ZlYyk7XG4gICAgICAgIEFtbW8uZGVzdHJveShhbW1vUXVhdCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUFuZ3VsYXJMaW1pdHMoKSB7XG4gICAgICAgIGNvbnN0IGNvbnN0cmFpbnQgPSB0aGlzLl9jb25zdHJhaW50O1xuICAgICAgICBpZiAoY29uc3RyYWludCkge1xuICAgICAgICAgICAgbGV0IGx4LCBseSwgbHosIHV4LCB1eSwgdXo7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWCA9PT0gTU9USU9OX0xJTUlURUQpIHtcbiAgICAgICAgICAgICAgICBseCA9IHRoaXMuX2FuZ3VsYXJMaW1pdHNYLnggKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICAgICAgdXggPSB0aGlzLl9hbmd1bGFyTGltaXRzWC55ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9hbmd1bGFyTW90aW9uWCA9PT0gTU9USU9OX0ZSRUUpIHtcbiAgICAgICAgICAgICAgICBseCA9IDE7XG4gICAgICAgICAgICAgICAgdXggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gTU9USU9OX0xPQ0tFRFxuICAgICAgICAgICAgICAgIGx4ID0gdXggPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fYW5ndWxhck1vdGlvblkgPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHkgPSB0aGlzLl9hbmd1bGFyTGltaXRzWS54ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICAgICAgICAgIHV5ID0gdGhpcy5fYW5ndWxhckxpbWl0c1kueSAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYW5ndWxhck1vdGlvblkgPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHkgPSAxO1xuICAgICAgICAgICAgICAgIHV5ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseSA9IHV5ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25aID09PSBNT1RJT05fTElNSVRFRCkge1xuICAgICAgICAgICAgICAgIGx6ID0gdGhpcy5fYW5ndWxhckxpbWl0c1oueCAqIG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgICAgICAgICB1eiA9IHRoaXMuX2FuZ3VsYXJMaW1pdHNaLnkgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2FuZ3VsYXJNb3Rpb25aID09PSBNT1RJT05fRlJFRSkge1xuICAgICAgICAgICAgICAgIGx6ID0gMTtcbiAgICAgICAgICAgICAgICB1eiA9IDA7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBNT1RJT05fTE9DS0VEXG4gICAgICAgICAgICAgICAgbHogPSB1eiA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGxpbWl0cyA9IG5ldyBBbW1vLmJ0VmVjdG9yMyhseCwgbHksIGx6KTtcbiAgICAgICAgICAgIGNvbnN0cmFpbnQuc2V0QW5ndWxhckxvd2VyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIGxpbWl0cy5zZXRWYWx1ZSh1eCwgdXksIHV6KTtcbiAgICAgICAgICAgIGNvbnN0cmFpbnQuc2V0QW5ndWxhclVwcGVyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShsaW1pdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUxpbmVhckxpbWl0cygpIHtcbiAgICAgICAgY29uc3QgY29uc3RyYWludCA9IHRoaXMuX2NvbnN0cmFpbnQ7XG4gICAgICAgIGlmIChjb25zdHJhaW50KSB7XG4gICAgICAgICAgICBsZXQgbHgsIGx5LCBseiwgdXgsIHV5LCB1ejtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblggPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHggPSB0aGlzLl9saW5lYXJMaW1pdHNYLng7XG4gICAgICAgICAgICAgICAgdXggPSB0aGlzLl9saW5lYXJMaW1pdHNYLnk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2xpbmVhck1vdGlvblggPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHggPSAxO1xuICAgICAgICAgICAgICAgIHV4ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseCA9IHV4ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblkgPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHkgPSB0aGlzLl9saW5lYXJMaW1pdHNZLng7XG4gICAgICAgICAgICAgICAgdXkgPSB0aGlzLl9saW5lYXJMaW1pdHNZLnk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2xpbmVhck1vdGlvblkgPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHkgPSAxO1xuICAgICAgICAgICAgICAgIHV5ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseSA9IHV5ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2xpbmVhck1vdGlvblogPT09IE1PVElPTl9MSU1JVEVEKSB7XG4gICAgICAgICAgICAgICAgbHogPSB0aGlzLl9saW5lYXJMaW1pdHNaLng7XG4gICAgICAgICAgICAgICAgdXogPSB0aGlzLl9saW5lYXJMaW1pdHNaLnk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2xpbmVhck1vdGlvblogPT09IE1PVElPTl9GUkVFKSB7XG4gICAgICAgICAgICAgICAgbHogPSAxO1xuICAgICAgICAgICAgICAgIHV6ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIE1PVElPTl9MT0NLRURcbiAgICAgICAgICAgICAgICBseiA9IHV6ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbGltaXRzID0gbmV3IEFtbW8uYnRWZWN0b3IzKGx4LCBseSwgbHopO1xuICAgICAgICAgICAgY29uc3RyYWludC5zZXRMaW5lYXJMb3dlckxpbWl0KGxpbWl0cyk7XG4gICAgICAgICAgICBsaW1pdHMuc2V0VmFsdWUodXgsIHV5LCB1eik7XG4gICAgICAgICAgICBjb25zdHJhaW50LnNldExpbmVhclVwcGVyTGltaXQobGltaXRzKTtcbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShsaW1pdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NyZWF0ZUNvbnN0cmFpbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbnRpdHlBICYmIHRoaXMuX2VudGl0eUEucmlnaWRib2R5KSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95Q29uc3RyYWludCgpO1xuXG4gICAgICAgICAgICBjb25zdCBtYXQgPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgICAgICBjb25zdCBib2R5QSA9IHRoaXMuX2VudGl0eUEucmlnaWRib2R5LmJvZHk7XG4gICAgICAgICAgICBib2R5QS5hY3RpdmF0ZSgpO1xuXG4gICAgICAgICAgICBjb25zdCBqb2ludFd0bSA9IHRoaXMuZW50aXR5LmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVudGl0eUFXdG0gPSB0aGlzLl9lbnRpdHlBLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICBjb25zdCBpbnZFbnRpdHlBV3RtID0gZW50aXR5QVd0bS5jbG9uZSgpLmludmVydCgpO1xuICAgICAgICAgICAgbWF0Lm11bDIoaW52RW50aXR5QVd0bSwgam9pbnRXdG0pO1xuXG4gICAgICAgICAgICBjb25zdCBmcmFtZUEgPSBuZXcgQW1tby5idFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgdGhpcy5fY29udmVydFRyYW5zZm9ybShtYXQsIGZyYW1lQSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9lbnRpdHlCICYmIHRoaXMuX2VudGl0eUIucmlnaWRib2R5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9keUIgPSB0aGlzLl9lbnRpdHlCLnJpZ2lkYm9keS5ib2R5O1xuICAgICAgICAgICAgICAgIGJvZHlCLmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBlbnRpdHlCV3RtID0gdGhpcy5fZW50aXR5Qi5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGludkVudGl0eUJXdG0gPSBlbnRpdHlCV3RtLmNsb25lKCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgbWF0Lm11bDIoaW52RW50aXR5Qld0bSwgam9pbnRXdG0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVCID0gbmV3IEFtbW8uYnRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb252ZXJ0VHJhbnNmb3JtKG1hdCwgZnJhbWVCKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQgPSBuZXcgQW1tby5idEdlbmVyaWM2RG9mU3ByaW5nQ29uc3RyYWludChib2R5QSwgYm9keUIsIGZyYW1lQSwgZnJhbWVCLCAhdGhpcy5fZW5hYmxlQ29sbGlzaW9uKTtcblxuICAgICAgICAgICAgICAgIEFtbW8uZGVzdHJveShmcmFtZUIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50ID0gbmV3IEFtbW8uYnRHZW5lcmljNkRvZlNwcmluZ0NvbnN0cmFpbnQoYm9keUEsIGZyYW1lQSwgIXRoaXMuX2VuYWJsZUNvbGxpc2lvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveShmcmFtZUEpO1xuXG4gICAgICAgICAgICBjb25zdCBheGlzID0gWydYJywgJ1knLCAnWicsICdYJywgJ1knLCAnWiddO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBpIDwgMyA/ICdfbGluZWFyJyA6ICdfYW5ndWxhcic7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5lbmFibGVTcHJpbmcoaSwgdGhpc1t0eXBlICsgJ1NwcmluZycgKyBheGlzW2ldXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5zZXREYW1waW5nKGksIHRoaXNbdHlwZSArICdEYW1waW5nJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LnNldEVxdWlsaWJyaXVtUG9pbnQoaSwgdGhpc1t0eXBlICsgJ0VxdWlsaWJyaXVtJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdHJhaW50LnNldFN0aWZmbmVzcyhpLCB0aGlzW3R5cGUgKyAnU3RpZmZuZXNzJyArIGF4aXNbaV1dKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fY29uc3RyYWludC5zZXRCcmVha2luZ0ltcHVsc2VUaHJlc2hvbGQodGhpcy5fYnJlYWtGb3JjZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxpbmVhckxpbWl0cygpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlQW5ndWxhckxpbWl0cygpO1xuXG4gICAgICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgICAgICBjb25zdCBkeW5hbWljc1dvcmxkID0gYXBwLnN5c3RlbXMucmlnaWRib2R5LmR5bmFtaWNzV29ybGQ7XG4gICAgICAgICAgICBkeW5hbWljc1dvcmxkLmFkZENvbnN0cmFpbnQodGhpcy5fY29uc3RyYWludCwgIXRoaXMuX2VuYWJsZUNvbGxpc2lvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZGVzdHJveUNvbnN0cmFpbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb25zdHJhaW50KSB7XG4gICAgICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgICAgICBjb25zdCBkeW5hbWljc1dvcmxkID0gYXBwLnN5c3RlbXMucmlnaWRib2R5LmR5bmFtaWNzV29ybGQ7XG4gICAgICAgICAgICBkeW5hbWljc1dvcmxkLnJlbW92ZUNvbnN0cmFpbnQodGhpcy5fY29uc3RyYWludCk7XG5cbiAgICAgICAgICAgIEFtbW8uZGVzdHJveSh0aGlzLl9jb25zdHJhaW50KTtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdEZyb21EYXRhKGRhdGEpIHtcbiAgICAgICAgZm9yIChjb25zdCBwcm9wIG9mIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGFbcHJvcF0gaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbJ18nICsgcHJvcF0uY29weShkYXRhW3Byb3BdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzWydfJyArIHByb3BdID0gZGF0YVtwcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jcmVhdGVDb25zdHJhaW50KCk7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUNvbnN0cmFpbnQoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lDb25zdHJhaW50KCk7XG4gICAgfVxuXG4gICAgX29uU2V0RW5hYmxlZChwcm9wLCBvbGQsIHZhbHVlKSB7XG4gICAgfVxuXG4gICAgX29uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScpO1xuICAgIH1cbn1cblxuY29uc3QgZnVuY3Rpb25NYXAgPSB7XG4gICAgRGFtcGluZzogJ3NldERhbXBpbmcnLFxuICAgIEVxdWlsaWJyaXVtOiAnc2V0RXF1aWxpYnJpdW1Qb2ludCcsXG4gICAgU3ByaW5nOiAnZW5hYmxlU3ByaW5nJyxcbiAgICBTdGlmZm5lc3M6ICdzZXRTdGlmZm5lc3MnXG59O1xuXG4vLyBEZWZpbmUgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIGZvciBlYWNoIGRlZ3JlZSBvZiBmcmVlZG9tXG5bJ2xpbmVhcicsICdhbmd1bGFyJ10uZm9yRWFjaCgodHlwZSkgPT4ge1xuICAgIFsnRGFtcGluZycsICdFcXVpbGlicml1bScsICdTcHJpbmcnLCAnU3RpZmZuZXNzJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgICBbJ1gnLCAnWScsICdaJ10uZm9yRWFjaCgoYXhpcykgPT4ge1xuICAgICAgICAgICAgY29uc3QgcHJvcCA9IHR5cGUgKyBuYW1lICsgYXhpcztcbiAgICAgICAgICAgIGNvbnN0IHByb3BJbnRlcm5hbCA9ICdfJyArIHByb3A7XG5cbiAgICAgICAgICAgIGxldCBpbmRleCA9ICh0eXBlID09PSAnbGluZWFyJykgPyAwIDogMztcbiAgICAgICAgICAgIGlmIChheGlzID09PSAnWScpIGluZGV4ICs9IDE7XG4gICAgICAgICAgICBpZiAoYXhpcyA9PT0gJ1onKSBpbmRleCArPSAyO1xuXG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoSm9pbnRDb21wb25lbnQucHJvdG90eXBlLCBwcm9wLCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3Byb3BJbnRlcm5hbF07XG4gICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzW3Byb3BJbnRlcm5hbF0gIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW3Byb3BJbnRlcm5hbF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN0cmFpbnRbZnVuY3Rpb25NYXBbbmFtZV1dKGluZGV4LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59KTtcblxuZXhwb3J0IHsgSm9pbnRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJwcm9wZXJ0aWVzIiwiSm9pbnRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIkRlYnVnIiwiYXNzZXJ0IiwiQW1tbyIsIl9jb25zdHJhaW50IiwiX2VudGl0eUEiLCJfZW50aXR5QiIsIl9icmVha0ZvcmNlIiwiX2VuYWJsZUNvbGxpc2lvbiIsIl9saW5lYXJNb3Rpb25YIiwiTU9USU9OX0xPQ0tFRCIsIl9saW5lYXJMaW1pdHNYIiwiVmVjMiIsIl9saW5lYXJTcHJpbmdYIiwiX2xpbmVhclN0aWZmbmVzc1giLCJfbGluZWFyRGFtcGluZ1giLCJfbGluZWFyRXF1aWxpYnJpdW1YIiwiX2xpbmVhck1vdGlvblkiLCJfbGluZWFyTGltaXRzWSIsIl9saW5lYXJTcHJpbmdZIiwiX2xpbmVhclN0aWZmbmVzc1kiLCJfbGluZWFyRGFtcGluZ1kiLCJfbGluZWFyRXF1aWxpYnJpdW1ZIiwiX2xpbmVhck1vdGlvbloiLCJfbGluZWFyTGltaXRzWiIsIl9saW5lYXJTcHJpbmdaIiwiX2xpbmVhclN0aWZmbmVzc1oiLCJfbGluZWFyRGFtcGluZ1oiLCJfbGluZWFyRXF1aWxpYnJpdW1aIiwiX2FuZ3VsYXJNb3Rpb25YIiwiX2FuZ3VsYXJMaW1pdHNYIiwiX2FuZ3VsYXJTcHJpbmdYIiwiX2FuZ3VsYXJTdGlmZm5lc3NYIiwiX2FuZ3VsYXJEYW1waW5nWCIsIl9hbmd1bGFyRXF1aWxpYnJpdW1YIiwiX2FuZ3VsYXJNb3Rpb25ZIiwiX2FuZ3VsYXJMaW1pdHNZIiwiX2FuZ3VsYXJTcHJpbmdZIiwiX2FuZ3VsYXJTdGlmZm5lc3NZIiwiX2FuZ3VsYXJEYW1waW5nWSIsIl9hbmd1bGFyRXF1aWxpYnJpdW1ZIiwiX2FuZ3VsYXJNb3Rpb25aIiwiX2FuZ3VsYXJMaW1pdHNaIiwiX2FuZ3VsYXJTcHJpbmdaIiwiX2FuZ3VsYXJFcXVpbGlicml1bVoiLCJfYW5ndWxhckRhbXBpbmdaIiwiX2FuZ3VsYXJTdGlmZm5lc3NaIiwib24iLCJfb25TZXRFbmFibGVkIiwiZW50aXR5QSIsImJvZHkiLCJfZGVzdHJveUNvbnN0cmFpbnQiLCJfY3JlYXRlQ29uc3RyYWludCIsImVudGl0eUIiLCJicmVha0ZvcmNlIiwiZm9yY2UiLCJzZXRCcmVha2luZ0ltcHVsc2VUaHJlc2hvbGQiLCJlbmFibGVDb2xsaXNpb24iLCJhbmd1bGFyTGltaXRzWCIsImxpbWl0cyIsImVxdWFscyIsImNvcHkiLCJfdXBkYXRlQW5ndWxhckxpbWl0cyIsImFuZ3VsYXJNb3Rpb25YIiwidmFsdWUiLCJhbmd1bGFyTGltaXRzWSIsImFuZ3VsYXJNb3Rpb25ZIiwiYW5ndWxhckxpbWl0c1oiLCJhbmd1bGFyTW90aW9uWiIsImxpbmVhckxpbWl0c1giLCJfdXBkYXRlTGluZWFyTGltaXRzIiwibGluZWFyTW90aW9uWCIsImxpbmVhckxpbWl0c1kiLCJsaW5lYXJNb3Rpb25ZIiwibGluZWFyTGltaXRzWiIsImxpbmVhck1vdGlvbloiLCJfY29udmVydFRyYW5zZm9ybSIsInBjVHJhbnNmb3JtIiwiYW1tb1RyYW5zZm9ybSIsInBvcyIsImdldFRyYW5zbGF0aW9uIiwicm90IiwiUXVhdCIsInNldEZyb21NYXQ0IiwiYW1tb1ZlYyIsImJ0VmVjdG9yMyIsIngiLCJ5IiwieiIsImFtbW9RdWF0IiwiYnRRdWF0ZXJuaW9uIiwidyIsInNldE9yaWdpbiIsInNldFJvdGF0aW9uIiwiZGVzdHJveSIsImNvbnN0cmFpbnQiLCJseCIsImx5IiwibHoiLCJ1eCIsInV5IiwidXoiLCJNT1RJT05fTElNSVRFRCIsIm1hdGgiLCJERUdfVE9fUkFEIiwiTU9USU9OX0ZSRUUiLCJzZXRBbmd1bGFyTG93ZXJMaW1pdCIsInNldFZhbHVlIiwic2V0QW5ndWxhclVwcGVyTGltaXQiLCJzZXRMaW5lYXJMb3dlckxpbWl0Iiwic2V0TGluZWFyVXBwZXJMaW1pdCIsInJpZ2lkYm9keSIsIm1hdCIsIk1hdDQiLCJib2R5QSIsImFjdGl2YXRlIiwiam9pbnRXdG0iLCJnZXRXb3JsZFRyYW5zZm9ybSIsImVudGl0eUFXdG0iLCJpbnZFbnRpdHlBV3RtIiwiY2xvbmUiLCJpbnZlcnQiLCJtdWwyIiwiZnJhbWVBIiwiYnRUcmFuc2Zvcm0iLCJib2R5QiIsImVudGl0eUJXdG0iLCJpbnZFbnRpdHlCV3RtIiwiZnJhbWVCIiwiYnRHZW5lcmljNkRvZlNwcmluZ0NvbnN0cmFpbnQiLCJheGlzIiwiaSIsInR5cGUiLCJlbmFibGVTcHJpbmciLCJzZXREYW1waW5nIiwic2V0RXF1aWxpYnJpdW1Qb2ludCIsInNldFN0aWZmbmVzcyIsImFwcCIsImR5bmFtaWNzV29ybGQiLCJzeXN0ZW1zIiwiYWRkQ29uc3RyYWludCIsInJlbW92ZUNvbnN0cmFpbnQiLCJpbml0RnJvbURhdGEiLCJkYXRhIiwicHJvcCIsImhhc093blByb3BlcnR5Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJvbGQiLCJfb25CZWZvcmVSZW1vdmUiLCJmaXJlIiwiZnVuY3Rpb25NYXAiLCJEYW1waW5nIiwiRXF1aWxpYnJpdW0iLCJTcHJpbmciLCJTdGlmZm5lc3MiLCJmb3JFYWNoIiwibmFtZSIsInByb3BJbnRlcm5hbCIsImluZGV4IiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJwcm90b3R5cGUiLCJnZXQiLCJzZXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFXQSxNQUFNQSxVQUFVLEdBQUcsQ0FDZixpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFDdkQscUJBQXFCLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCLEVBQ25FLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUNwRCxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFDcEQsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQ3BELG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUM3RCxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQ2hFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUNwRCxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFDaEUsZUFBZSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQ2pELGVBQWUsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUNqRCxlQUFlLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFDakQsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLENBQzdELENBQUE7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsY0FBYyxTQUFTQyxTQUFTLENBQUM7QUFDbkM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUVyQkMsS0FBSyxDQUFDQyxNQUFNLENBQUMsT0FBT0MsSUFBSSxLQUFLLFdBQVcsRUFBRSwyRUFBMkUsQ0FBQyxDQUFBO0lBRXRILElBQUksQ0FBQ0MsV0FBVyxHQUFHLElBQUksQ0FBQTtJQUV2QixJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLE9BQU8sQ0FBQTtJQUMxQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUksQ0FBQTs7QUFFNUI7SUFDQSxJQUFJLENBQUNDLGNBQWMsR0FBR0MsYUFBYSxDQUFBO0lBQ25DLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUlDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDQyxjQUFjLEdBQUcsS0FBSyxDQUFBO0lBQzNCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLENBQUMsQ0FBQTtJQUN4QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLENBQUMsQ0FBQTs7QUFFNUI7SUFDQSxJQUFJLENBQUNDLGNBQWMsR0FBR1AsYUFBYSxDQUFBO0lBQ25DLElBQUksQ0FBQ1EsY0FBYyxHQUFHLElBQUlOLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDTyxjQUFjLEdBQUcsS0FBSyxDQUFBO0lBQzNCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLENBQUMsQ0FBQTtJQUN4QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLENBQUMsQ0FBQTs7QUFFNUI7SUFDQSxJQUFJLENBQUNDLGNBQWMsR0FBR2IsYUFBYSxDQUFBO0lBQ25DLElBQUksQ0FBQ2MsY0FBYyxHQUFHLElBQUlaLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDYSxjQUFjLEdBQUcsS0FBSyxDQUFBO0lBQzNCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLENBQUMsQ0FBQTtJQUN4QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLENBQUMsQ0FBQTs7QUFFNUI7SUFDQSxJQUFJLENBQUNDLGVBQWUsR0FBR25CLGFBQWEsQ0FBQTtJQUNwQyxJQUFJLENBQUNvQixlQUFlLEdBQUcsSUFBSWxCLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDckMsSUFBSSxDQUFDbUIsZUFBZSxHQUFHLEtBQUssQ0FBQTtJQUM1QixJQUFJLENBQUNDLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtJQUMzQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtJQUN6QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLENBQUMsQ0FBQTs7QUFFN0I7SUFDQSxJQUFJLENBQUNDLGVBQWUsR0FBR3pCLGFBQWEsQ0FBQTtJQUNwQyxJQUFJLENBQUMwQixlQUFlLEdBQUcsSUFBSXhCLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDckMsSUFBSSxDQUFDeUIsZUFBZSxHQUFHLEtBQUssQ0FBQTtJQUM1QixJQUFJLENBQUNDLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtJQUMzQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtJQUN6QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLENBQUMsQ0FBQTs7QUFFN0I7SUFDQSxJQUFJLENBQUNDLGVBQWUsR0FBRy9CLGFBQWEsQ0FBQTtJQUNwQyxJQUFJLENBQUNnQyxlQUFlLEdBQUcsSUFBSTlCLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDckMsSUFBSSxDQUFDK0IsZUFBZSxHQUFHLEtBQUssQ0FBQTtJQUM1QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLENBQUMsQ0FBQTtJQUM3QixJQUFJLENBQUNDLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtJQUN6QixJQUFJLENBQUNDLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtJQUUzQixJQUFJLENBQUNDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDcEQsR0FBQTtFQUVBLElBQUlDLE9BQU9BLENBQUNDLElBQUksRUFBRTtJQUNkLElBQUksQ0FBQ0Msa0JBQWtCLEVBQUUsQ0FBQTtJQUN6QixJQUFJLENBQUM5QyxRQUFRLEdBQUc2QyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDRSxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLEdBQUE7RUFFQSxJQUFJSCxPQUFPQSxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUM1QyxRQUFRLENBQUE7QUFDeEIsR0FBQTtFQUVBLElBQUlnRCxPQUFPQSxDQUFDSCxJQUFJLEVBQUU7SUFDZCxJQUFJLENBQUNDLGtCQUFrQixFQUFFLENBQUE7SUFDekIsSUFBSSxDQUFDN0MsUUFBUSxHQUFHNEMsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0UsaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QixHQUFBO0VBRUEsSUFBSUMsT0FBT0EsR0FBRztJQUNWLE9BQU8sSUFBSSxDQUFDL0MsUUFBUSxDQUFBO0FBQ3hCLEdBQUE7RUFFQSxJQUFJZ0QsVUFBVUEsQ0FBQ0MsS0FBSyxFQUFFO0lBQ2xCLElBQUksSUFBSSxDQUFDbkQsV0FBVyxJQUFJLElBQUksQ0FBQ0csV0FBVyxLQUFLZ0QsS0FBSyxFQUFFO0FBQ2hELE1BQUEsSUFBSSxDQUFDbkQsV0FBVyxDQUFDb0QsMkJBQTJCLENBQUNELEtBQUssQ0FBQyxDQUFBO01BQ25ELElBQUksQ0FBQ2hELFdBQVcsR0FBR2dELEtBQUssQ0FBQTtBQUM1QixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlELFVBQVVBLEdBQUc7SUFDYixPQUFPLElBQUksQ0FBQy9DLFdBQVcsQ0FBQTtBQUMzQixHQUFBO0VBRUEsSUFBSWtELGVBQWVBLENBQUNBLGVBQWUsRUFBRTtJQUNqQyxJQUFJLENBQUNOLGtCQUFrQixFQUFFLENBQUE7SUFDekIsSUFBSSxDQUFDM0MsZ0JBQWdCLEdBQUdpRCxlQUFlLENBQUE7SUFDdkMsSUFBSSxDQUFDTCxpQkFBaUIsRUFBRSxDQUFBO0FBQzVCLEdBQUE7RUFFQSxJQUFJSyxlQUFlQSxHQUFHO0lBQ2xCLE9BQU8sSUFBSSxDQUFDakQsZ0JBQWdCLENBQUE7QUFDaEMsR0FBQTtFQUVBLElBQUlrRCxjQUFjQSxDQUFDQyxNQUFNLEVBQUU7SUFDdkIsSUFBSSxDQUFDLElBQUksQ0FBQzdCLGVBQWUsQ0FBQzhCLE1BQU0sQ0FBQ0QsTUFBTSxDQUFDLEVBQUU7QUFDdEMsTUFBQSxJQUFJLENBQUM3QixlQUFlLENBQUMrQixJQUFJLENBQUNGLE1BQU0sQ0FBQyxDQUFBO01BQ2pDLElBQUksQ0FBQ0csb0JBQW9CLEVBQUUsQ0FBQTtBQUMvQixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlKLGNBQWNBLEdBQUc7SUFDakIsT0FBTyxJQUFJLENBQUM1QixlQUFlLENBQUE7QUFDL0IsR0FBQTtFQUVBLElBQUlpQyxjQUFjQSxDQUFDQyxLQUFLLEVBQUU7QUFDdEIsSUFBQSxJQUFJLElBQUksQ0FBQ25DLGVBQWUsS0FBS21DLEtBQUssRUFBRTtNQUNoQyxJQUFJLENBQUNuQyxlQUFlLEdBQUdtQyxLQUFLLENBQUE7TUFDNUIsSUFBSSxDQUFDRixvQkFBb0IsRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUMsY0FBY0EsR0FBRztJQUNqQixPQUFPLElBQUksQ0FBQ2xDLGVBQWUsQ0FBQTtBQUMvQixHQUFBO0VBRUEsSUFBSW9DLGNBQWNBLENBQUNOLE1BQU0sRUFBRTtJQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDdkIsZUFBZSxDQUFDd0IsTUFBTSxDQUFDRCxNQUFNLENBQUMsRUFBRTtBQUN0QyxNQUFBLElBQUksQ0FBQ3ZCLGVBQWUsQ0FBQ3lCLElBQUksQ0FBQ0YsTUFBTSxDQUFDLENBQUE7TUFDakMsSUFBSSxDQUFDRyxvQkFBb0IsRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUcsY0FBY0EsR0FBRztJQUNqQixPQUFPLElBQUksQ0FBQzdCLGVBQWUsQ0FBQTtBQUMvQixHQUFBO0VBRUEsSUFBSThCLGNBQWNBLENBQUNGLEtBQUssRUFBRTtBQUN0QixJQUFBLElBQUksSUFBSSxDQUFDN0IsZUFBZSxLQUFLNkIsS0FBSyxFQUFFO01BQ2hDLElBQUksQ0FBQzdCLGVBQWUsR0FBRzZCLEtBQUssQ0FBQTtNQUM1QixJQUFJLENBQUNGLG9CQUFvQixFQUFFLENBQUE7QUFDL0IsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJSSxjQUFjQSxHQUFHO0lBQ2pCLE9BQU8sSUFBSSxDQUFDL0IsZUFBZSxDQUFBO0FBQy9CLEdBQUE7RUFFQSxJQUFJZ0MsY0FBY0EsQ0FBQ1IsTUFBTSxFQUFFO0lBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUNqQixlQUFlLENBQUNrQixNQUFNLENBQUNELE1BQU0sQ0FBQyxFQUFFO0FBQ3RDLE1BQUEsSUFBSSxDQUFDakIsZUFBZSxDQUFDbUIsSUFBSSxDQUFDRixNQUFNLENBQUMsQ0FBQTtNQUNqQyxJQUFJLENBQUNHLG9CQUFvQixFQUFFLENBQUE7QUFDL0IsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJSyxjQUFjQSxHQUFHO0lBQ2pCLE9BQU8sSUFBSSxDQUFDekIsZUFBZSxDQUFBO0FBQy9CLEdBQUE7RUFFQSxJQUFJMEIsY0FBY0EsQ0FBQ0osS0FBSyxFQUFFO0FBQ3RCLElBQUEsSUFBSSxJQUFJLENBQUN2QixlQUFlLEtBQUt1QixLQUFLLEVBQUU7TUFDaEMsSUFBSSxDQUFDdkIsZUFBZSxHQUFHdUIsS0FBSyxDQUFBO01BQzVCLElBQUksQ0FBQ0Ysb0JBQW9CLEVBQUUsQ0FBQTtBQUMvQixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlNLGNBQWNBLEdBQUc7SUFDakIsT0FBTyxJQUFJLENBQUMzQixlQUFlLENBQUE7QUFDL0IsR0FBQTtFQUVBLElBQUk0QixhQUFhQSxDQUFDVixNQUFNLEVBQUU7SUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQ2hELGNBQWMsQ0FBQ2lELE1BQU0sQ0FBQ0QsTUFBTSxDQUFDLEVBQUU7QUFDckMsTUFBQSxJQUFJLENBQUNoRCxjQUFjLENBQUNrRCxJQUFJLENBQUNGLE1BQU0sQ0FBQyxDQUFBO01BQ2hDLElBQUksQ0FBQ1csbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlELGFBQWFBLEdBQUc7SUFDaEIsT0FBTyxJQUFJLENBQUMxRCxjQUFjLENBQUE7QUFDOUIsR0FBQTtFQUVBLElBQUk0RCxhQUFhQSxDQUFDUCxLQUFLLEVBQUU7QUFDckIsSUFBQSxJQUFJLElBQUksQ0FBQ3ZELGNBQWMsS0FBS3VELEtBQUssRUFBRTtNQUMvQixJQUFJLENBQUN2RCxjQUFjLEdBQUd1RCxLQUFLLENBQUE7TUFDM0IsSUFBSSxDQUFDTSxtQkFBbUIsRUFBRSxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUMsYUFBYUEsR0FBRztJQUNoQixPQUFPLElBQUksQ0FBQzlELGNBQWMsQ0FBQTtBQUM5QixHQUFBO0VBRUEsSUFBSStELGFBQWFBLENBQUNiLE1BQU0sRUFBRTtJQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDekMsY0FBYyxDQUFDMEMsTUFBTSxDQUFDRCxNQUFNLENBQUMsRUFBRTtBQUNyQyxNQUFBLElBQUksQ0FBQ3pDLGNBQWMsQ0FBQzJDLElBQUksQ0FBQ0YsTUFBTSxDQUFDLENBQUE7TUFDaEMsSUFBSSxDQUFDVyxtQkFBbUIsRUFBRSxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBO0VBRUEsSUFBSUUsYUFBYUEsR0FBRztJQUNoQixPQUFPLElBQUksQ0FBQ3RELGNBQWMsQ0FBQTtBQUM5QixHQUFBO0VBRUEsSUFBSXVELGFBQWFBLENBQUNULEtBQUssRUFBRTtBQUNyQixJQUFBLElBQUksSUFBSSxDQUFDL0MsY0FBYyxLQUFLK0MsS0FBSyxFQUFFO01BQy9CLElBQUksQ0FBQy9DLGNBQWMsR0FBRytDLEtBQUssQ0FBQTtNQUMzQixJQUFJLENBQUNNLG1CQUFtQixFQUFFLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJRyxhQUFhQSxHQUFHO0lBQ2hCLE9BQU8sSUFBSSxDQUFDeEQsY0FBYyxDQUFBO0FBQzlCLEdBQUE7RUFFQSxJQUFJeUQsYUFBYUEsQ0FBQ2YsTUFBTSxFQUFFO0lBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUNuQyxjQUFjLENBQUNvQyxNQUFNLENBQUNELE1BQU0sQ0FBQyxFQUFFO0FBQ3JDLE1BQUEsSUFBSSxDQUFDbkMsY0FBYyxDQUFDcUMsSUFBSSxDQUFDRixNQUFNLENBQUMsQ0FBQTtNQUNoQyxJQUFJLENBQUNXLG1CQUFtQixFQUFFLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJSSxhQUFhQSxHQUFHO0lBQ2hCLE9BQU8sSUFBSSxDQUFDbEQsY0FBYyxDQUFBO0FBQzlCLEdBQUE7RUFFQSxJQUFJbUQsYUFBYUEsQ0FBQ1gsS0FBSyxFQUFFO0FBQ3JCLElBQUEsSUFBSSxJQUFJLENBQUN6QyxjQUFjLEtBQUt5QyxLQUFLLEVBQUU7TUFDL0IsSUFBSSxDQUFDekMsY0FBYyxHQUFHeUMsS0FBSyxDQUFBO01BQzNCLElBQUksQ0FBQ00sbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlLLGFBQWFBLEdBQUc7SUFDaEIsT0FBTyxJQUFJLENBQUNwRCxjQUFjLENBQUE7QUFDOUIsR0FBQTtBQUVBcUQsRUFBQUEsaUJBQWlCQSxDQUFDQyxXQUFXLEVBQUVDLGFBQWEsRUFBRTtBQUMxQyxJQUFBLE1BQU1DLEdBQUcsR0FBR0YsV0FBVyxDQUFDRyxjQUFjLEVBQUUsQ0FBQTtBQUN4QyxJQUFBLE1BQU1DLEdBQUcsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN0QkQsSUFBQUEsR0FBRyxDQUFDRSxXQUFXLENBQUNOLFdBQVcsQ0FBQyxDQUFBO0FBRTVCLElBQUEsTUFBTU8sT0FBTyxHQUFHLElBQUlqRixJQUFJLENBQUNrRixTQUFTLENBQUNOLEdBQUcsQ0FBQ08sQ0FBQyxFQUFFUCxHQUFHLENBQUNRLENBQUMsRUFBRVIsR0FBRyxDQUFDUyxDQUFDLENBQUMsQ0FBQTtJQUN2RCxNQUFNQyxRQUFRLEdBQUcsSUFBSXRGLElBQUksQ0FBQ3VGLFlBQVksQ0FBQ1QsR0FBRyxDQUFDSyxDQUFDLEVBQUVMLEdBQUcsQ0FBQ00sQ0FBQyxFQUFFTixHQUFHLENBQUNPLENBQUMsRUFBRVAsR0FBRyxDQUFDVSxDQUFDLENBQUMsQ0FBQTtBQUVsRWIsSUFBQUEsYUFBYSxDQUFDYyxTQUFTLENBQUNSLE9BQU8sQ0FBQyxDQUFBO0FBQ2hDTixJQUFBQSxhQUFhLENBQUNlLFdBQVcsQ0FBQ0osUUFBUSxDQUFDLENBQUE7QUFFbkN0RixJQUFBQSxJQUFJLENBQUMyRixPQUFPLENBQUNWLE9BQU8sQ0FBQyxDQUFBO0FBQ3JCakYsSUFBQUEsSUFBSSxDQUFDMkYsT0FBTyxDQUFDTCxRQUFRLENBQUMsQ0FBQTtBQUMxQixHQUFBO0FBRUEzQixFQUFBQSxvQkFBb0JBLEdBQUc7QUFDbkIsSUFBQSxNQUFNaUMsVUFBVSxHQUFHLElBQUksQ0FBQzNGLFdBQVcsQ0FBQTtBQUNuQyxJQUFBLElBQUkyRixVQUFVLEVBQUU7TUFDWixJQUFJQyxFQUFFLEVBQUVDLEVBQUUsRUFBRUMsRUFBRSxFQUFFQyxFQUFFLEVBQUVDLEVBQUUsRUFBRUMsRUFBRSxDQUFBO0FBRTFCLE1BQUEsSUFBSSxJQUFJLENBQUN4RSxlQUFlLEtBQUt5RSxjQUFjLEVBQUU7UUFDekNOLEVBQUUsR0FBRyxJQUFJLENBQUNsRSxlQUFlLENBQUN3RCxDQUFDLEdBQUdpQixJQUFJLENBQUNDLFVBQVUsQ0FBQTtRQUM3Q0wsRUFBRSxHQUFHLElBQUksQ0FBQ3JFLGVBQWUsQ0FBQ3lELENBQUMsR0FBR2dCLElBQUksQ0FBQ0MsVUFBVSxDQUFBO0FBQ2pELE9BQUMsTUFBTSxJQUFJLElBQUksQ0FBQzNFLGVBQWUsS0FBSzRFLFdBQVcsRUFBRTtBQUM3Q1QsUUFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUNORyxRQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ1YsT0FBQyxNQUFNO0FBQUU7UUFDTEgsRUFBRSxHQUFHRyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2YsT0FBQTtBQUVBLE1BQUEsSUFBSSxJQUFJLENBQUNoRSxlQUFlLEtBQUttRSxjQUFjLEVBQUU7UUFDekNMLEVBQUUsR0FBRyxJQUFJLENBQUM3RCxlQUFlLENBQUNrRCxDQUFDLEdBQUdpQixJQUFJLENBQUNDLFVBQVUsQ0FBQTtRQUM3Q0osRUFBRSxHQUFHLElBQUksQ0FBQ2hFLGVBQWUsQ0FBQ21ELENBQUMsR0FBR2dCLElBQUksQ0FBQ0MsVUFBVSxDQUFBO0FBQ2pELE9BQUMsTUFBTSxJQUFJLElBQUksQ0FBQ3JFLGVBQWUsS0FBS3NFLFdBQVcsRUFBRTtBQUM3Q1IsUUFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUNORyxRQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ1YsT0FBQyxNQUFNO0FBQUU7UUFDTEgsRUFBRSxHQUFHRyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2YsT0FBQTtBQUVBLE1BQUEsSUFBSSxJQUFJLENBQUMzRCxlQUFlLEtBQUs2RCxjQUFjLEVBQUU7UUFDekNKLEVBQUUsR0FBRyxJQUFJLENBQUN4RCxlQUFlLENBQUM0QyxDQUFDLEdBQUdpQixJQUFJLENBQUNDLFVBQVUsQ0FBQTtRQUM3Q0gsRUFBRSxHQUFHLElBQUksQ0FBQzNELGVBQWUsQ0FBQzZDLENBQUMsR0FBR2dCLElBQUksQ0FBQ0MsVUFBVSxDQUFBO0FBQ2pELE9BQUMsTUFBTSxJQUFJLElBQUksQ0FBQy9ELGVBQWUsS0FBS2dFLFdBQVcsRUFBRTtBQUM3Q1AsUUFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUNORyxRQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ1YsT0FBQyxNQUFNO0FBQUU7UUFDTEgsRUFBRSxHQUFHRyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2YsT0FBQTtBQUVBLE1BQUEsTUFBTTFDLE1BQU0sR0FBRyxJQUFJeEQsSUFBSSxDQUFDa0YsU0FBUyxDQUFDVyxFQUFFLEVBQUVDLEVBQUUsRUFBRUMsRUFBRSxDQUFDLENBQUE7QUFDN0NILE1BQUFBLFVBQVUsQ0FBQ1csb0JBQW9CLENBQUMvQyxNQUFNLENBQUMsQ0FBQTtNQUN2Q0EsTUFBTSxDQUFDZ0QsUUFBUSxDQUFDUixFQUFFLEVBQUVDLEVBQUUsRUFBRUMsRUFBRSxDQUFDLENBQUE7QUFDM0JOLE1BQUFBLFVBQVUsQ0FBQ2Esb0JBQW9CLENBQUNqRCxNQUFNLENBQUMsQ0FBQTtBQUN2Q3hELE1BQUFBLElBQUksQ0FBQzJGLE9BQU8sQ0FBQ25DLE1BQU0sQ0FBQyxDQUFBO0FBQ3hCLEtBQUE7QUFDSixHQUFBO0FBRUFXLEVBQUFBLG1CQUFtQkEsR0FBRztBQUNsQixJQUFBLE1BQU15QixVQUFVLEdBQUcsSUFBSSxDQUFDM0YsV0FBVyxDQUFBO0FBQ25DLElBQUEsSUFBSTJGLFVBQVUsRUFBRTtNQUNaLElBQUlDLEVBQUUsRUFBRUMsRUFBRSxFQUFFQyxFQUFFLEVBQUVDLEVBQUUsRUFBRUMsRUFBRSxFQUFFQyxFQUFFLENBQUE7QUFFMUIsTUFBQSxJQUFJLElBQUksQ0FBQzVGLGNBQWMsS0FBSzZGLGNBQWMsRUFBRTtBQUN4Q04sUUFBQUEsRUFBRSxHQUFHLElBQUksQ0FBQ3JGLGNBQWMsQ0FBQzJFLENBQUMsQ0FBQTtBQUMxQmEsUUFBQUEsRUFBRSxHQUFHLElBQUksQ0FBQ3hGLGNBQWMsQ0FBQzRFLENBQUMsQ0FBQTtBQUM5QixPQUFDLE1BQU0sSUFBSSxJQUFJLENBQUM5RSxjQUFjLEtBQUtnRyxXQUFXLEVBQUU7QUFDNUNULFFBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDTkcsUUFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUNWLE9BQUMsTUFBTTtBQUFFO1FBQ0xILEVBQUUsR0FBR0csRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUNmLE9BQUE7QUFFQSxNQUFBLElBQUksSUFBSSxDQUFDbEYsY0FBYyxLQUFLcUYsY0FBYyxFQUFFO0FBQ3hDTCxRQUFBQSxFQUFFLEdBQUcsSUFBSSxDQUFDL0UsY0FBYyxDQUFDb0UsQ0FBQyxDQUFBO0FBQzFCYyxRQUFBQSxFQUFFLEdBQUcsSUFBSSxDQUFDbEYsY0FBYyxDQUFDcUUsQ0FBQyxDQUFBO0FBQzlCLE9BQUMsTUFBTSxJQUFJLElBQUksQ0FBQ3RFLGNBQWMsS0FBS3dGLFdBQVcsRUFBRTtBQUM1Q1IsUUFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUNORyxRQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ1YsT0FBQyxNQUFNO0FBQUU7UUFDTEgsRUFBRSxHQUFHRyxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2YsT0FBQTtBQUVBLE1BQUEsSUFBSSxJQUFJLENBQUM3RSxjQUFjLEtBQUsrRSxjQUFjLEVBQUU7QUFDeENKLFFBQUFBLEVBQUUsR0FBRyxJQUFJLENBQUMxRSxjQUFjLENBQUM4RCxDQUFDLENBQUE7QUFDMUJlLFFBQUFBLEVBQUUsR0FBRyxJQUFJLENBQUM3RSxjQUFjLENBQUMrRCxDQUFDLENBQUE7QUFDOUIsT0FBQyxNQUFNLElBQUksSUFBSSxDQUFDaEUsY0FBYyxLQUFLa0YsV0FBVyxFQUFFO0FBQzVDUCxRQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ05HLFFBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDVixPQUFDLE1BQU07QUFBRTtRQUNMSCxFQUFFLEdBQUdHLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDZixPQUFBO0FBRUEsTUFBQSxNQUFNMUMsTUFBTSxHQUFHLElBQUl4RCxJQUFJLENBQUNrRixTQUFTLENBQUNXLEVBQUUsRUFBRUMsRUFBRSxFQUFFQyxFQUFFLENBQUMsQ0FBQTtBQUM3Q0gsTUFBQUEsVUFBVSxDQUFDYyxtQkFBbUIsQ0FBQ2xELE1BQU0sQ0FBQyxDQUFBO01BQ3RDQSxNQUFNLENBQUNnRCxRQUFRLENBQUNSLEVBQUUsRUFBRUMsRUFBRSxFQUFFQyxFQUFFLENBQUMsQ0FBQTtBQUMzQk4sTUFBQUEsVUFBVSxDQUFDZSxtQkFBbUIsQ0FBQ25ELE1BQU0sQ0FBQyxDQUFBO0FBQ3RDeEQsTUFBQUEsSUFBSSxDQUFDMkYsT0FBTyxDQUFDbkMsTUFBTSxDQUFDLENBQUE7QUFDeEIsS0FBQTtBQUNKLEdBQUE7QUFFQVAsRUFBQUEsaUJBQWlCQSxHQUFHO0lBQ2hCLElBQUksSUFBSSxDQUFDL0MsUUFBUSxJQUFJLElBQUksQ0FBQ0EsUUFBUSxDQUFDMEcsU0FBUyxFQUFFO01BQzFDLElBQUksQ0FBQzVELGtCQUFrQixFQUFFLENBQUE7QUFFekIsTUFBQSxNQUFNNkQsR0FBRyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO01BRXRCLE1BQU1DLEtBQUssR0FBRyxJQUFJLENBQUM3RyxRQUFRLENBQUMwRyxTQUFTLENBQUM3RCxJQUFJLENBQUE7TUFDMUNnRSxLQUFLLENBQUNDLFFBQVEsRUFBRSxDQUFBO0FBRWhCLE1BQUEsTUFBTUMsUUFBUSxHQUFHLElBQUksQ0FBQ3BILE1BQU0sQ0FBQ3FILGlCQUFpQixFQUFFLENBQUE7QUFFaEQsTUFBQSxNQUFNQyxVQUFVLEdBQUcsSUFBSSxDQUFDakgsUUFBUSxDQUFDZ0gsaUJBQWlCLEVBQUUsQ0FBQTtNQUNwRCxNQUFNRSxhQUFhLEdBQUdELFVBQVUsQ0FBQ0UsS0FBSyxFQUFFLENBQUNDLE1BQU0sRUFBRSxDQUFBO0FBQ2pEVCxNQUFBQSxHQUFHLENBQUNVLElBQUksQ0FBQ0gsYUFBYSxFQUFFSCxRQUFRLENBQUMsQ0FBQTtBQUVqQyxNQUFBLE1BQU1PLE1BQU0sR0FBRyxJQUFJeEgsSUFBSSxDQUFDeUgsV0FBVyxFQUFFLENBQUE7QUFDckMsTUFBQSxJQUFJLENBQUNoRCxpQkFBaUIsQ0FBQ29DLEdBQUcsRUFBRVcsTUFBTSxDQUFDLENBQUE7TUFFbkMsSUFBSSxJQUFJLENBQUNySCxRQUFRLElBQUksSUFBSSxDQUFDQSxRQUFRLENBQUN5RyxTQUFTLEVBQUU7UUFDMUMsTUFBTWMsS0FBSyxHQUFHLElBQUksQ0FBQ3ZILFFBQVEsQ0FBQ3lHLFNBQVMsQ0FBQzdELElBQUksQ0FBQTtRQUMxQzJFLEtBQUssQ0FBQ1YsUUFBUSxFQUFFLENBQUE7QUFFaEIsUUFBQSxNQUFNVyxVQUFVLEdBQUcsSUFBSSxDQUFDeEgsUUFBUSxDQUFDK0csaUJBQWlCLEVBQUUsQ0FBQTtRQUNwRCxNQUFNVSxhQUFhLEdBQUdELFVBQVUsQ0FBQ04sS0FBSyxFQUFFLENBQUNDLE1BQU0sRUFBRSxDQUFBO0FBQ2pEVCxRQUFBQSxHQUFHLENBQUNVLElBQUksQ0FBQ0ssYUFBYSxFQUFFWCxRQUFRLENBQUMsQ0FBQTtBQUVqQyxRQUFBLE1BQU1ZLE1BQU0sR0FBRyxJQUFJN0gsSUFBSSxDQUFDeUgsV0FBVyxFQUFFLENBQUE7QUFDckMsUUFBQSxJQUFJLENBQUNoRCxpQkFBaUIsQ0FBQ29DLEdBQUcsRUFBRWdCLE1BQU0sQ0FBQyxDQUFBO1FBRW5DLElBQUksQ0FBQzVILFdBQVcsR0FBRyxJQUFJRCxJQUFJLENBQUM4SCw2QkFBNkIsQ0FBQ2YsS0FBSyxFQUFFVyxLQUFLLEVBQUVGLE1BQU0sRUFBRUssTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDeEgsZ0JBQWdCLENBQUMsQ0FBQTtBQUUvR0wsUUFBQUEsSUFBSSxDQUFDMkYsT0FBTyxDQUFDa0MsTUFBTSxDQUFDLENBQUE7QUFDeEIsT0FBQyxNQUFNO0FBQ0gsUUFBQSxJQUFJLENBQUM1SCxXQUFXLEdBQUcsSUFBSUQsSUFBSSxDQUFDOEgsNkJBQTZCLENBQUNmLEtBQUssRUFBRVMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDbkgsZ0JBQWdCLENBQUMsQ0FBQTtBQUNwRyxPQUFBO0FBRUFMLE1BQUFBLElBQUksQ0FBQzJGLE9BQU8sQ0FBQzZCLE1BQU0sQ0FBQyxDQUFBO0FBRXBCLE1BQUEsTUFBTU8sSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQTtNQUUzQyxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsRUFBRSxFQUFFO1FBQ3hCLE1BQU1DLElBQUksR0FBR0QsQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLEdBQUcsVUFBVSxDQUFBO0FBQzNDLFFBQUEsSUFBSSxDQUFDL0gsV0FBVyxDQUFDaUksWUFBWSxDQUFDRixDQUFDLEVBQUUsSUFBSSxDQUFDQyxJQUFJLEdBQUcsUUFBUSxHQUFHRixJQUFJLENBQUNDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqRSxRQUFBLElBQUksQ0FBQy9ILFdBQVcsQ0FBQ2tJLFVBQVUsQ0FBQ0gsQ0FBQyxFQUFFLElBQUksQ0FBQ0MsSUFBSSxHQUFHLFNBQVMsR0FBR0YsSUFBSSxDQUFDQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDaEUsUUFBQSxJQUFJLENBQUMvSCxXQUFXLENBQUNtSSxtQkFBbUIsQ0FBQ0osQ0FBQyxFQUFFLElBQUksQ0FBQ0MsSUFBSSxHQUFHLGFBQWEsR0FBR0YsSUFBSSxDQUFDQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0UsUUFBQSxJQUFJLENBQUMvSCxXQUFXLENBQUNvSSxZQUFZLENBQUNMLENBQUMsRUFBRSxJQUFJLENBQUNDLElBQUksR0FBRyxXQUFXLEdBQUdGLElBQUksQ0FBQ0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3hFLE9BQUE7TUFFQSxJQUFJLENBQUMvSCxXQUFXLENBQUNvRCwyQkFBMkIsQ0FBQyxJQUFJLENBQUNqRCxXQUFXLENBQUMsQ0FBQTtNQUU5RCxJQUFJLENBQUMrRCxtQkFBbUIsRUFBRSxDQUFBO01BQzFCLElBQUksQ0FBQ1Isb0JBQW9CLEVBQUUsQ0FBQTtBQUUzQixNQUFBLE1BQU0yRSxHQUFHLEdBQUcsSUFBSSxDQUFDMUksTUFBTSxDQUFDMEksR0FBRyxDQUFBO01BQzNCLE1BQU1DLGFBQWEsR0FBR0QsR0FBRyxDQUFDRSxPQUFPLENBQUM1QixTQUFTLENBQUMyQixhQUFhLENBQUE7TUFDekRBLGFBQWEsQ0FBQ0UsYUFBYSxDQUFDLElBQUksQ0FBQ3hJLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQ0ksZ0JBQWdCLENBQUMsQ0FBQTtBQUN6RSxLQUFBO0FBQ0osR0FBQTtBQUVBMkMsRUFBQUEsa0JBQWtCQSxHQUFHO0lBQ2pCLElBQUksSUFBSSxDQUFDL0MsV0FBVyxFQUFFO0FBQ2xCLE1BQUEsTUFBTXFJLEdBQUcsR0FBRyxJQUFJLENBQUMxSSxNQUFNLENBQUMwSSxHQUFHLENBQUE7TUFDM0IsTUFBTUMsYUFBYSxHQUFHRCxHQUFHLENBQUNFLE9BQU8sQ0FBQzVCLFNBQVMsQ0FBQzJCLGFBQWEsQ0FBQTtBQUN6REEsTUFBQUEsYUFBYSxDQUFDRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUN6SSxXQUFXLENBQUMsQ0FBQTtBQUVoREQsTUFBQUEsSUFBSSxDQUFDMkYsT0FBTyxDQUFDLElBQUksQ0FBQzFGLFdBQVcsQ0FBQyxDQUFBO01BQzlCLElBQUksQ0FBQ0EsV0FBVyxHQUFHLElBQUksQ0FBQTtBQUMzQixLQUFBO0FBQ0osR0FBQTtFQUVBMEksWUFBWUEsQ0FBQ0MsSUFBSSxFQUFFO0FBQ2YsSUFBQSxLQUFLLE1BQU1DLElBQUksSUFBSXJKLFVBQVUsRUFBRTtBQUMzQixNQUFBLElBQUlvSixJQUFJLENBQUNFLGNBQWMsQ0FBQ0QsSUFBSSxDQUFDLEVBQUU7QUFDM0IsUUFBQSxJQUFJRCxJQUFJLENBQUNDLElBQUksQ0FBQyxZQUFZcEksSUFBSSxFQUFFO0FBQzVCLFVBQUEsSUFBSSxDQUFDLEdBQUcsR0FBR29JLElBQUksQ0FBQyxDQUFDbkYsSUFBSSxDQUFDa0YsSUFBSSxDQUFDQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ3JDLFNBQUMsTUFBTTtVQUNILElBQUksQ0FBQyxHQUFHLEdBQUdBLElBQUksQ0FBQyxHQUFHRCxJQUFJLENBQUNDLElBQUksQ0FBQyxDQUFBO0FBQ2pDLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksQ0FBQzVGLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsR0FBQTtBQUVBOEYsRUFBQUEsUUFBUUEsR0FBRztJQUNQLElBQUksQ0FBQzlGLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsR0FBQTtBQUVBK0YsRUFBQUEsU0FBU0EsR0FBRztJQUNSLElBQUksQ0FBQ2hHLGtCQUFrQixFQUFFLENBQUE7QUFDN0IsR0FBQTtBQUVBSCxFQUFBQSxhQUFhQSxDQUFDZ0csSUFBSSxFQUFFSSxHQUFHLEVBQUVwRixLQUFLLEVBQUUsRUFDaEM7QUFFQXFGLEVBQUFBLGVBQWVBLEdBQUc7QUFDZCxJQUFBLElBQUksQ0FBQ0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ3ZCLEdBQUE7QUFDSixDQUFBO0FBRUEsTUFBTUMsV0FBVyxHQUFHO0FBQ2hCQyxFQUFBQSxPQUFPLEVBQUUsWUFBWTtBQUNyQkMsRUFBQUEsV0FBVyxFQUFFLHFCQUFxQjtBQUNsQ0MsRUFBQUEsTUFBTSxFQUFFLGNBQWM7QUFDdEJDLEVBQUFBLFNBQVMsRUFBRSxjQUFBO0FBQ2YsQ0FBQyxDQUFBOztBQUVEO0FBQ0EsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUNDLE9BQU8sQ0FBRXhCLElBQUksSUFBSztBQUNwQyxFQUFBLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUN3QixPQUFPLENBQUVDLElBQUksSUFBSztJQUNoRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUNELE9BQU8sQ0FBRTFCLElBQUksSUFBSztBQUM5QixNQUFBLE1BQU1jLElBQUksR0FBR1osSUFBSSxHQUFHeUIsSUFBSSxHQUFHM0IsSUFBSSxDQUFBO0FBQy9CLE1BQUEsTUFBTTRCLFlBQVksR0FBRyxHQUFHLEdBQUdkLElBQUksQ0FBQTtNQUUvQixJQUFJZSxLQUFLLEdBQUkzQixJQUFJLEtBQUssUUFBUSxHQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDdkMsTUFBQSxJQUFJRixJQUFJLEtBQUssR0FBRyxFQUFFNkIsS0FBSyxJQUFJLENBQUMsQ0FBQTtBQUM1QixNQUFBLElBQUk3QixJQUFJLEtBQUssR0FBRyxFQUFFNkIsS0FBSyxJQUFJLENBQUMsQ0FBQTtNQUU1QkMsTUFBTSxDQUFDQyxjQUFjLENBQUNySyxjQUFjLENBQUNzSyxTQUFTLEVBQUVsQixJQUFJLEVBQUU7UUFDbERtQixHQUFHLEVBQUUsWUFBWTtVQUNiLE9BQU8sSUFBSSxDQUFDTCxZQUFZLENBQUMsQ0FBQTtTQUM1QjtBQUVETSxRQUFBQSxHQUFHLEVBQUUsVUFBVXBHLEtBQUssRUFBRTtBQUNsQixVQUFBLElBQUksSUFBSSxDQUFDOEYsWUFBWSxDQUFDLEtBQUs5RixLQUFLLEVBQUU7QUFDOUIsWUFBQSxJQUFJLENBQUM4RixZQUFZLENBQUMsR0FBRzlGLEtBQUssQ0FBQTtBQUMxQixZQUFBLElBQUksQ0FBQzVELFdBQVcsQ0FBQ21KLFdBQVcsQ0FBQ00sSUFBSSxDQUFDLENBQUMsQ0FBQ0UsS0FBSyxFQUFFL0YsS0FBSyxDQUFDLENBQUE7QUFDckQsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQyxDQUFDLENBQUE7QUFDTixDQUFDLENBQUM7Ozs7In0=
