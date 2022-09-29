/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_WORLD } from '../constants.js';

class BatchGroup {
  constructor(id, name, dynamic, maxAabbSize, layers = [LAYERID_WORLD]) {
    this.dynamic = dynamic;
    this.maxAabbSize = maxAabbSize;
    this.id = id;
    this.name = name;
    this.layers = layers;
    this._ui = false;
    this._sprite = false;
    this._obj = {
      model: [],
      element: [],
      sprite: [],
      render: []
    };
  }

}

BatchGroup.MODEL = 'model';
BatchGroup.ELEMENT = 'element';
BatchGroup.SPRITE = 'sprite';
BatchGroup.RENDER = 'render';

export { BatchGroup };
