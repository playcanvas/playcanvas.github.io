/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
