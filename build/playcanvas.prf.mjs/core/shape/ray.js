/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../tracing.js';
import { Vec3 } from '../math/vec3.js';

class Ray {
  constructor(origin = new Vec3(), direction = new Vec3(0, 0, -1)) {
    this.origin = origin;
    this.direction = direction;
  }

  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }
}

export { Ray };
