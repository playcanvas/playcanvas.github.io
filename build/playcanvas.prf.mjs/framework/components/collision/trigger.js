/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { BODYFLAG_NORESPONSE_OBJECT, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from '../rigid-body/constants.js';

let ammoVec1, ammoQuat, ammoTransform;

class Trigger {
  constructor(app, component, data) {
    this.entity = component.entity;
    this.component = component;
    this.app = app;

    if (typeof Ammo !== 'undefined' && !ammoVec1) {
      ammoVec1 = new Ammo.btVector3();
      ammoQuat = new Ammo.btQuaternion();
      ammoTransform = new Ammo.btTransform();
    }

    this.initialize(data);
  }

  initialize(data) {
    const entity = this.entity;
    const shape = data.shape;

    if (shape && typeof Ammo !== 'undefined') {
      if (entity.trigger) {
        entity.trigger.destroy();
      }

      const mass = 1;
      const pos = entity.getPosition();
      const rot = entity.getRotation();
      ammoVec1.setValue(pos.x, pos.y, pos.z);
      ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
      ammoTransform.setOrigin(ammoVec1);
      ammoTransform.setRotation(ammoQuat);
      const body = this.app.systems.rigidbody.createBody(mass, shape, ammoTransform);
      body.setRestitution(0);
      body.setFriction(0);
      body.setDamping(0, 0);
      ammoVec1.setValue(0, 0, 0);
      body.setLinearFactor(ammoVec1);
      body.setAngularFactor(ammoVec1);
      body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_NORESPONSE_OBJECT);
      body.entity = entity;
      this.body = body;

      if (this.component.enabled && entity.enabled) {
        this.enable();
      }
    }
  }

  destroy() {
    const body = this.body;
    if (!body) return;
    this.disable();
    this.app.systems.rigidbody.destroyBody(body);
  }

  _getEntityTransform(transform) {
    const pos = this.entity.getPosition();
    const rot = this.entity.getRotation();
    ammoVec1.setValue(pos.x, pos.y, pos.z);
    ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
    transform.setOrigin(ammoVec1);
    transform.setRotation(ammoQuat);
  }

  updateTransform() {
    this._getEntityTransform(ammoTransform);

    const body = this.body;
    body.setWorldTransform(ammoTransform);
    body.activate();
  }

  enable() {
    const body = this.body;
    if (!body) return;
    const systems = this.app.systems;
    systems.rigidbody.addBody(body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);

    systems.rigidbody._triggers.push(this);

    body.forceActivationState(BODYSTATE_ACTIVE_TAG);
    this.updateTransform();
  }

  disable() {
    const body = this.body;
    if (!body) return;
    const systems = this.app.systems;

    const idx = systems.rigidbody._triggers.indexOf(this);

    if (idx > -1) {
      systems.rigidbody._triggers.splice(idx, 1);
    }

    systems.rigidbody.removeBody(body);
    body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
  }

}

export { Trigger };
