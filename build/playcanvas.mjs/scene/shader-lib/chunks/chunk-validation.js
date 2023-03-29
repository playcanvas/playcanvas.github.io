import { CHUNKAPI_1_57, CHUNKAPI_1_55, CHUNKAPI_1_56 } from '../../../platform/graphics/constants.js';
import '../../../core/tracing.js';
import { shaderChunks } from './chunks.js';

const chunkVersions = {
  aoPS: CHUNKAPI_1_57,
  clearCoatPS: CHUNKAPI_1_57,
  clearCoatGlossPS: CHUNKAPI_1_57,
  clearCoatNormalPS: CHUNKAPI_1_57,
  diffusePS: CHUNKAPI_1_57,
  diffuseDetailMapPS: CHUNKAPI_1_57,
  emissivePS: CHUNKAPI_1_57,
  lightmapDirPS: CHUNKAPI_1_55,
  lightmapSinglePS: CHUNKAPI_1_55,
  metalnessPS: CHUNKAPI_1_57,
  normalMapPS: CHUNKAPI_1_57,
  normalDetailMapPS: CHUNKAPI_1_57,
  opacityPS: CHUNKAPI_1_57,
  parallaxPS: CHUNKAPI_1_57,
  sheenPS: CHUNKAPI_1_57,
  sheenGlossPS: CHUNKAPI_1_57,
  specularPS: CHUNKAPI_1_57,
  specularityFactorPS: CHUNKAPI_1_57,
  thicknessPS: CHUNKAPI_1_57,
  transmissionPS: CHUNKAPI_1_57,
  clusteredLightPS: CHUNKAPI_1_55,
  fresnelSchlickPS: CHUNKAPI_1_55,
  endPS: CHUNKAPI_1_55,
  lightmapAddPS: CHUNKAPI_1_55,
  lightmapDirAddPS: CHUNKAPI_1_55,
  lightSpecularAnisoGGXPS: CHUNKAPI_1_55,
  lightSpecularBlinnPS: CHUNKAPI_1_55,
  lightSpecularPhongPS: CHUNKAPI_1_55,
  normalVertexPS: CHUNKAPI_1_55,
  startPS: CHUNKAPI_1_55,
  reflectionEnvPS: CHUNKAPI_1_56
};

const semverLess = (a, b) => {
  const aver = a.split('.').map(t => parseInt(t, 10));
  const bver = b.split('.').map(t => parseInt(t, 10));
  return aver[0] < bver[0] || aver[0] === bver[0] && aver[1] < bver[1];
};

const validateUserChunks = userChunks => {
  const userAPIVersion = userChunks.APIVersion;

  for (const chunkName in userChunks) {
    if (chunkName === 'APIVersion') {
      continue;
    }

    if (!shaderChunks.hasOwnProperty(chunkName)) ; else {
      const engineAPIVersion = chunkVersions[chunkName];
      engineAPIVersion && (!userAPIVersion || semverLess(userAPIVersion, engineAPIVersion));
    }
  }
};

export { validateUserChunks };
