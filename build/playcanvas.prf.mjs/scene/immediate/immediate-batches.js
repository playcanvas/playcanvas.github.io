/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { ImmediateBatch } from './immediate-batch.js';

class ImmediateBatches {
  constructor(device) {
    this.device = device;
    this.map = new Map();
  }

  getBatch(material, layer) {
    let batch = this.map.get(material);

    if (!batch) {
      batch = new ImmediateBatch(this.device, material, layer);
      this.map.set(material, batch);
    }

    return batch;
  }

  onPreRender(visibleList, transparent) {
    this.map.forEach(batch => {
      batch.onPreRender(visibleList, transparent);
    });
  }

}

export { ImmediateBatches };
