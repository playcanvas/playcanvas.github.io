import { BoundingBox } from '../../shape/bounding-box.js';
import { BoundingSphere } from '../../shape/bounding-sphere.js';
import { LIGHTTYPE_DIRECTIONAL } from '../constants.js';

const tempSphere = new BoundingSphere();

class BakeLight {
  constructor(scene, light) {
    this.scene = scene;
    this.light = light;
    this.store();
    light.numCascades = 1;

    if (light.type !== LIGHTTYPE_DIRECTIONAL) {
      light._node.getWorldTransform();

      light.getBoundingSphere(tempSphere);
      this.lightBounds = new BoundingBox();
      this.lightBounds.center.copy(tempSphere.center);
      this.lightBounds.halfExtents.set(tempSphere.radius, tempSphere.radius, tempSphere.radius);
    }
  }

  store() {
    this.mask = this.light.mask;
    this.shadowUpdateMode = this.light.shadowUpdateMode;
    this.enabled = this.light.enabled;
    this.intensity = this.light.intensity;
    this.rotation = this.light._node.getLocalRotation().clone();
    this.numCascades = this.light.numCascades;
  }

  restore() {
    const light = this.light;
    light.mask = this.mask;
    light.shadowUpdateMode = this.shadowUpdateMode;
    light.enabled = this.enabled;
    light.intensity = this.intensity;

    light._node.setLocalRotation(this.rotation);

    light.numCascades = this.numCascades;
  }

  startBake() {
    this.light.enabled = true;

    this.light._destroyShadowMap();
  }

  endBake(shadowMapCache) {
    const light = this.light;
    light.enabled = false;

    if (light.shadowMap) {
      if (light.shadowMap.cached) shadowMapCache.add(light, light.shadowMap);
      light.shadowMap = null;
    }
  }

}

export { BakeLight };
