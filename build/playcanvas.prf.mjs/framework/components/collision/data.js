/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../../../core/math/vec3.js';

class CollisionComponentData {
  constructor() {
    this.enabled = true;
    this.type = 'box';
    this.halfExtents = new Vec3(0.5, 0.5, 0.5);
    this.radius = 0.5;
    this.axis = 1;
    this.height = 2;
    this.asset = null;
    this.renderAsset = null;

    this.shape = null;
    this.model = null;
    this.render = null;
    this.initialized = false;
  }
}

export { CollisionComponentData };
