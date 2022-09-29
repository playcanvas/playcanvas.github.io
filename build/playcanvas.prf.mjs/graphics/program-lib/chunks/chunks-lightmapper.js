/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import bakeDirLmEndPS from './lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from './lightmapper/frag/bakeLmEnd.js';
import dilatePS from './lightmapper/frag/dilate.js';
import bilateralDeNoisePS from './lightmapper/frag/bilateralDeNoise.js';

const shaderChunksLightmapper = {
  bakeDirLmEndPS,
  bakeLmEndPS,
  dilatePS,
  bilateralDeNoisePS
};

export { shaderChunksLightmapper };
