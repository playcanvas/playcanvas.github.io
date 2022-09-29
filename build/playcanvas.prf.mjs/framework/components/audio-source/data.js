/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { DISTANCE_INVERSE } from '../../../audio/constants.js';

class AudioSourceComponentData {
  constructor() {
    this.enabled = true;
    this.assets = [];
    this.activate = true;
    this.volume = 1;
    this.pitch = 1;
    this.loop = false;
    this['3d'] = true;
    this.minDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    this.distanceModel = DISTANCE_INVERSE;
    this.paused = true;
    this.sources = {};
    this.currentSource = null;
    this.channel = null;
  }

}

export { AudioSourceComponentData };
