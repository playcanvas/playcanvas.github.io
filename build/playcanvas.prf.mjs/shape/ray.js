/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../core/tracing.js';
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
