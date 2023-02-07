/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { CHUNKAPI_1_57, CHUNKAPI_1_60, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_51 } from '../../../platform/graphics/constants.js';
import { Debug } from '../../../core/debug.js';
import { shaderChunks } from './chunks.js';

const chunkVersions = {
  // frontend
  aoPS: CHUNKAPI_1_57,
  clearCoatPS: CHUNKAPI_1_57,
  clearCoatGlossPS: CHUNKAPI_1_60,
  clearCoatNormalPS: CHUNKAPI_1_57,
  diffusePS: CHUNKAPI_1_57,
  diffuseDetailMapPS: CHUNKAPI_1_57,
  emissivePS: CHUNKAPI_1_57,
  glossPS: CHUNKAPI_1_60,
  lightmapDirPS: CHUNKAPI_1_55,
  lightmapSinglePS: CHUNKAPI_1_55,
  metalnessPS: CHUNKAPI_1_57,
  normalMapPS: CHUNKAPI_1_57,
  normalDetailMapPS: CHUNKAPI_1_57,
  opacityPS: CHUNKAPI_1_57,
  parallaxPS: CHUNKAPI_1_57,
  sheenPS: CHUNKAPI_1_57,
  sheenGlossPS: CHUNKAPI_1_60,
  specularPS: CHUNKAPI_1_57,
  specularityFactorPS: CHUNKAPI_1_57,
  thicknessPS: CHUNKAPI_1_57,
  transmissionPS: CHUNKAPI_1_57,
  // backend
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

// removed
const removedChunks = {
  ambientPrefilteredCubePS: CHUNKAPI_1_51,
  ambientPrefilteredCubeLodPS: CHUNKAPI_1_51,
  dpAtlasQuadPS: CHUNKAPI_1_51,
  genParaboloidPS: CHUNKAPI_1_51,
  prefilterCubemapPS: CHUNKAPI_1_51,
  reflectionDpAtlasPS: CHUNKAPI_1_51,
  reflectionPrefilteredCubePS: CHUNKAPI_1_51,
  reflectionPrefilteredCubeLodPS: CHUNKAPI_1_51,
  refractionPS: CHUNKAPI_1_56,
  combineClearCoatPS: CHUNKAPI_1_56,
  combineDiffusePS: CHUNKAPI_1_56,
  combineDiffuseSpecularPS: CHUNKAPI_1_56,
  combineDiffuseSpecularNoReflPS: CHUNKAPI_1_56,
  combineDiffuseSpecularNoReflSeparateAmbientPS: CHUNKAPI_1_56,
  combineDiffuseSpecularOldPS: CHUNKAPI_1_56,
  combineDiffuseSpecularNoConservePS: CHUNKAPI_1_55,
  lightmapSingleVertPS: CHUNKAPI_1_55,
  normalMapFastPS: CHUNKAPI_1_55,
  specularAaNonePS: CHUNKAPI_1_55,
  specularAaToksvigPS: CHUNKAPI_1_55,
  specularAaToksvigFastPS: CHUNKAPI_1_55
};

// compare two "major.minor" semantic version strings and return true if a is a smaller version than b.
const semverLess = (a, b) => {
  const aver = a.split('.').map(t => parseInt(t, 10));
  const bver = b.split('.').map(t => parseInt(t, 10));
  return aver[0] < bver[0] || aver[0] === bver[0] && aver[1] < bver[1];
};

// validate user chunks
const validateUserChunks = userChunks => {
  const userAPIVersion = userChunks.APIVersion;
  for (const chunkName in userChunks) {
    if (chunkName === 'APIVersion') {
      continue;
    }
    if (!shaderChunks.hasOwnProperty(chunkName)) {
      const removedVersion = removedChunks[chunkName];
      if (removedVersion) {
        Debug.warnOnce(`Shader chunk '${chunkName}' was removed in API ${removedVersion} and is no longer supported.`);
      } else {
        Debug.warnOnce(`Shader chunk '${chunkName}' is not supported.`);
      }
    } else {
      const engineAPIVersion = chunkVersions[chunkName];
      const chunkIsOutdated = engineAPIVersion && (!userAPIVersion || semverLess(userAPIVersion, engineAPIVersion));
      if (chunkIsOutdated) {
        Debug.warnOnce(`Shader chunk '${chunkName}' is API version ${engineAPIVersion}, but the supplied chunk is version ${userAPIVersion || '-'}. Please update to the latest API.`);
      }
    }
  }
};

export { validateUserChunks };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2h1bmstdmFsaWRhdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rLXZhbGlkYXRpb24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ0hVTktBUElfMV81MSwgQ0hVTktBUElfMV81NSwgQ0hVTktBUElfMV81NiwgQ0hVTktBUElfMV81NywgQ0hVTktBUElfMV82MCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi9jaHVua3MuanMnO1xuXG5jb25zdCBjaHVua1ZlcnNpb25zID0ge1xuICAgIC8vIGZyb250ZW5kXG4gICAgYW9QUzogQ0hVTktBUElfMV81NyxcbiAgICBjbGVhckNvYXRQUzogQ0hVTktBUElfMV81NyxcbiAgICBjbGVhckNvYXRHbG9zc1BTOiBDSFVOS0FQSV8xXzYwLFxuICAgIGNsZWFyQ29hdE5vcm1hbFBTOiBDSFVOS0FQSV8xXzU3LFxuICAgIGRpZmZ1c2VQUzogQ0hVTktBUElfMV81NyxcbiAgICBkaWZmdXNlRGV0YWlsTWFwUFM6IENIVU5LQVBJXzFfNTcsXG4gICAgZW1pc3NpdmVQUzogQ0hVTktBUElfMV81NyxcbiAgICBnbG9zc1BTOiBDSFVOS0FQSV8xXzYwLFxuICAgIGxpZ2h0bWFwRGlyUFM6IENIVU5LQVBJXzFfNTUsXG4gICAgbGlnaHRtYXBTaW5nbGVQUzogQ0hVTktBUElfMV81NSxcbiAgICBtZXRhbG5lc3NQUzogQ0hVTktBUElfMV81NyxcbiAgICBub3JtYWxNYXBQUzogQ0hVTktBUElfMV81NyxcbiAgICBub3JtYWxEZXRhaWxNYXBQUzogQ0hVTktBUElfMV81NyxcbiAgICBvcGFjaXR5UFM6IENIVU5LQVBJXzFfNTcsXG4gICAgcGFyYWxsYXhQUzogQ0hVTktBUElfMV81NyxcbiAgICBzaGVlblBTOiBDSFVOS0FQSV8xXzU3LFxuICAgIHNoZWVuR2xvc3NQUzogQ0hVTktBUElfMV82MCxcbiAgICBzcGVjdWxhclBTOiBDSFVOS0FQSV8xXzU3LFxuICAgIHNwZWN1bGFyaXR5RmFjdG9yUFM6IENIVU5LQVBJXzFfNTcsXG4gICAgdGhpY2tuZXNzUFM6IENIVU5LQVBJXzFfNTcsXG4gICAgdHJhbnNtaXNzaW9uUFM6IENIVU5LQVBJXzFfNTcsXG5cbiAgICAvLyBiYWNrZW5kXG4gICAgY2x1c3RlcmVkTGlnaHRQUzogQ0hVTktBUElfMV81NSxcbiAgICBmcmVzbmVsU2NobGlja1BTOiBDSFVOS0FQSV8xXzU1LFxuICAgIGVuZFBTOiBDSFVOS0FQSV8xXzU1LFxuICAgIGxpZ2h0bWFwQWRkUFM6IENIVU5LQVBJXzFfNTUsXG4gICAgbGlnaHRtYXBEaXJBZGRQUzogQ0hVTktBUElfMV81NSxcbiAgICBsaWdodFNwZWN1bGFyQW5pc29HR1hQUzogQ0hVTktBUElfMV81NSxcbiAgICBsaWdodFNwZWN1bGFyQmxpbm5QUzogQ0hVTktBUElfMV81NSxcbiAgICBsaWdodFNwZWN1bGFyUGhvbmdQUzogQ0hVTktBUElfMV81NSxcbiAgICBub3JtYWxWZXJ0ZXhQUzogQ0hVTktBUElfMV81NSxcbiAgICBzdGFydFBTOiBDSFVOS0FQSV8xXzU1LFxuICAgIHJlZmxlY3Rpb25FbnZQUzogQ0hVTktBUElfMV81NlxufTtcblxuLy8gcmVtb3ZlZFxuY29uc3QgcmVtb3ZlZENodW5rcyA9IHtcbiAgICBhbWJpZW50UHJlZmlsdGVyZWRDdWJlUFM6IENIVU5LQVBJXzFfNTEsXG4gICAgYW1iaWVudFByZWZpbHRlcmVkQ3ViZUxvZFBTOiBDSFVOS0FQSV8xXzUxLFxuICAgIGRwQXRsYXNRdWFkUFM6IENIVU5LQVBJXzFfNTEsXG4gICAgZ2VuUGFyYWJvbG9pZFBTOiBDSFVOS0FQSV8xXzUxLFxuICAgIHByZWZpbHRlckN1YmVtYXBQUzogQ0hVTktBUElfMV81MSxcbiAgICByZWZsZWN0aW9uRHBBdGxhc1BTOiBDSFVOS0FQSV8xXzUxLFxuICAgIHJlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmVQUzogQ0hVTktBUElfMV81MSxcbiAgICByZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlTG9kUFM6IENIVU5LQVBJXzFfNTEsXG4gICAgcmVmcmFjdGlvblBTOiBDSFVOS0FQSV8xXzU2LFxuICAgIGNvbWJpbmVDbGVhckNvYXRQUzogQ0hVTktBUElfMV81NixcbiAgICBjb21iaW5lRGlmZnVzZVBTOiBDSFVOS0FQSV8xXzU2LFxuICAgIGNvbWJpbmVEaWZmdXNlU3BlY3VsYXJQUzogQ0hVTktBUElfMV81NixcbiAgICBjb21iaW5lRGlmZnVzZVNwZWN1bGFyTm9SZWZsUFM6IENIVU5LQVBJXzFfNTYsXG4gICAgY29tYmluZURpZmZ1c2VTcGVjdWxhck5vUmVmbFNlcGFyYXRlQW1iaWVudFBTOiBDSFVOS0FQSV8xXzU2LFxuICAgIGNvbWJpbmVEaWZmdXNlU3BlY3VsYXJPbGRQUzogQ0hVTktBUElfMV81NixcbiAgICBjb21iaW5lRGlmZnVzZVNwZWN1bGFyTm9Db25zZXJ2ZVBTOiBDSFVOS0FQSV8xXzU1LFxuICAgIGxpZ2h0bWFwU2luZ2xlVmVydFBTOiBDSFVOS0FQSV8xXzU1LFxuICAgIG5vcm1hbE1hcEZhc3RQUzogQ0hVTktBUElfMV81NSxcbiAgICBzcGVjdWxhckFhTm9uZVBTOiBDSFVOS0FQSV8xXzU1LFxuICAgIHNwZWN1bGFyQWFUb2tzdmlnUFM6IENIVU5LQVBJXzFfNTUsXG4gICAgc3BlY3VsYXJBYVRva3N2aWdGYXN0UFM6IENIVU5LQVBJXzFfNTVcbn07XG5cbi8vIGNvbXBhcmUgdHdvIFwibWFqb3IubWlub3JcIiBzZW1hbnRpYyB2ZXJzaW9uIHN0cmluZ3MgYW5kIHJldHVybiB0cnVlIGlmIGEgaXMgYSBzbWFsbGVyIHZlcnNpb24gdGhhbiBiLlxuY29uc3Qgc2VtdmVyTGVzcyA9IChhLCBiKSA9PiB7XG4gICAgY29uc3QgYXZlciA9IGEuc3BsaXQoJy4nKS5tYXAodCA9PiBwYXJzZUludCh0LCAxMCkpO1xuICAgIGNvbnN0IGJ2ZXIgPSBiLnNwbGl0KCcuJykubWFwKHQgPT4gcGFyc2VJbnQodCwgMTApKTtcbiAgICByZXR1cm4gKGF2ZXJbMF0gPCBidmVyWzBdKSB8fCAoKGF2ZXJbMF0gPT09IGJ2ZXJbMF0pICYmIChhdmVyWzFdIDwgYnZlclsxXSkpO1xufTtcblxuLy8gdmFsaWRhdGUgdXNlciBjaHVua3NcbmNvbnN0IHZhbGlkYXRlVXNlckNodW5rcyA9ICh1c2VyQ2h1bmtzKSA9PiB7XG4gICAgY29uc3QgdXNlckFQSVZlcnNpb24gPSB1c2VyQ2h1bmtzLkFQSVZlcnNpb247XG4gICAgZm9yIChjb25zdCBjaHVua05hbWUgaW4gdXNlckNodW5rcykge1xuICAgICAgICBpZiAoY2h1bmtOYW1lID09PSAnQVBJVmVyc2lvbicpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzaGFkZXJDaHVua3MuaGFzT3duUHJvcGVydHkoY2h1bmtOYW1lKSkge1xuICAgICAgICAgICAgY29uc3QgcmVtb3ZlZFZlcnNpb24gPSByZW1vdmVkQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgICAgICAgICBpZiAocmVtb3ZlZFZlcnNpb24pIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShgU2hhZGVyIGNodW5rICcke2NodW5rTmFtZX0nIHdhcyByZW1vdmVkIGluIEFQSSAke3JlbW92ZWRWZXJzaW9ufSBhbmQgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC5gKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYFNoYWRlciBjaHVuayAnJHtjaHVua05hbWV9JyBpcyBub3Qgc3VwcG9ydGVkLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZW5naW5lQVBJVmVyc2lvbiA9IGNodW5rVmVyc2lvbnNbY2h1bmtOYW1lXTtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rSXNPdXRkYXRlZCA9IGVuZ2luZUFQSVZlcnNpb24gJiYgKCF1c2VyQVBJVmVyc2lvbiB8fCBzZW12ZXJMZXNzKHVzZXJBUElWZXJzaW9uLCBlbmdpbmVBUElWZXJzaW9uKSk7XG5cbiAgICAgICAgICAgIGlmIChjaHVua0lzT3V0ZGF0ZWQpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShgU2hhZGVyIGNodW5rICcke2NodW5rTmFtZX0nIGlzIEFQSSB2ZXJzaW9uICR7ZW5naW5lQVBJVmVyc2lvbn0sIGJ1dCB0aGUgc3VwcGxpZWQgY2h1bmsgaXMgdmVyc2lvbiAke3VzZXJBUElWZXJzaW9uIHx8ICctJ30uIFBsZWFzZSB1cGRhdGUgdG8gdGhlIGxhdGVzdCBBUEkuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5leHBvcnQge1xuICAgIHZhbGlkYXRlVXNlckNodW5rc1xufTtcbiJdLCJuYW1lcyI6WyJjaHVua1ZlcnNpb25zIiwiYW9QUyIsIkNIVU5LQVBJXzFfNTciLCJjbGVhckNvYXRQUyIsImNsZWFyQ29hdEdsb3NzUFMiLCJDSFVOS0FQSV8xXzYwIiwiY2xlYXJDb2F0Tm9ybWFsUFMiLCJkaWZmdXNlUFMiLCJkaWZmdXNlRGV0YWlsTWFwUFMiLCJlbWlzc2l2ZVBTIiwiZ2xvc3NQUyIsImxpZ2h0bWFwRGlyUFMiLCJDSFVOS0FQSV8xXzU1IiwibGlnaHRtYXBTaW5nbGVQUyIsIm1ldGFsbmVzc1BTIiwibm9ybWFsTWFwUFMiLCJub3JtYWxEZXRhaWxNYXBQUyIsIm9wYWNpdHlQUyIsInBhcmFsbGF4UFMiLCJzaGVlblBTIiwic2hlZW5HbG9zc1BTIiwic3BlY3VsYXJQUyIsInNwZWN1bGFyaXR5RmFjdG9yUFMiLCJ0aGlja25lc3NQUyIsInRyYW5zbWlzc2lvblBTIiwiY2x1c3RlcmVkTGlnaHRQUyIsImZyZXNuZWxTY2hsaWNrUFMiLCJlbmRQUyIsImxpZ2h0bWFwQWRkUFMiLCJsaWdodG1hcERpckFkZFBTIiwibGlnaHRTcGVjdWxhckFuaXNvR0dYUFMiLCJsaWdodFNwZWN1bGFyQmxpbm5QUyIsImxpZ2h0U3BlY3VsYXJQaG9uZ1BTIiwibm9ybWFsVmVydGV4UFMiLCJzdGFydFBTIiwicmVmbGVjdGlvbkVudlBTIiwiQ0hVTktBUElfMV81NiIsInJlbW92ZWRDaHVua3MiLCJhbWJpZW50UHJlZmlsdGVyZWRDdWJlUFMiLCJDSFVOS0FQSV8xXzUxIiwiYW1iaWVudFByZWZpbHRlcmVkQ3ViZUxvZFBTIiwiZHBBdGxhc1F1YWRQUyIsImdlblBhcmFib2xvaWRQUyIsInByZWZpbHRlckN1YmVtYXBQUyIsInJlZmxlY3Rpb25EcEF0bGFzUFMiLCJyZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlUFMiLCJyZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlTG9kUFMiLCJyZWZyYWN0aW9uUFMiLCJjb21iaW5lQ2xlYXJDb2F0UFMiLCJjb21iaW5lRGlmZnVzZVBTIiwiY29tYmluZURpZmZ1c2VTcGVjdWxhclBTIiwiY29tYmluZURpZmZ1c2VTcGVjdWxhck5vUmVmbFBTIiwiY29tYmluZURpZmZ1c2VTcGVjdWxhck5vUmVmbFNlcGFyYXRlQW1iaWVudFBTIiwiY29tYmluZURpZmZ1c2VTcGVjdWxhck9sZFBTIiwiY29tYmluZURpZmZ1c2VTcGVjdWxhck5vQ29uc2VydmVQUyIsImxpZ2h0bWFwU2luZ2xlVmVydFBTIiwibm9ybWFsTWFwRmFzdFBTIiwic3BlY3VsYXJBYU5vbmVQUyIsInNwZWN1bGFyQWFUb2tzdmlnUFMiLCJzcGVjdWxhckFhVG9rc3ZpZ0Zhc3RQUyIsInNlbXZlckxlc3MiLCJhIiwiYiIsImF2ZXIiLCJzcGxpdCIsIm1hcCIsInQiLCJwYXJzZUludCIsImJ2ZXIiLCJ2YWxpZGF0ZVVzZXJDaHVua3MiLCJ1c2VyQ2h1bmtzIiwidXNlckFQSVZlcnNpb24iLCJBUElWZXJzaW9uIiwiY2h1bmtOYW1lIiwic2hhZGVyQ2h1bmtzIiwiaGFzT3duUHJvcGVydHkiLCJyZW1vdmVkVmVyc2lvbiIsIkRlYnVn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
