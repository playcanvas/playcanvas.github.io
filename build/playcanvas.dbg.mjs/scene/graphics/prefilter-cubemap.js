/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM } from '../../platform/graphics/constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { drawQuadWithShader } from './quad-render-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

// https://seblagarde.wordpress.com/2012/06/10/amd-cubemapgen-for-physically-based-rendering/
function areaElement(x, y) {
  return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
}
function texelCoordSolidAngle(u, v, size) {
  // Scale up to [-1, 1] range (inclusive), offset by 0.5 to point to texel center.
  let _u = 2.0 * (u + 0.5) / size - 1.0;
  let _v = 2.0 * (v + 0.5) / size - 1.0;

  // fixSeams
  _u *= 1.0 - 1.0 / size;
  _v *= 1.0 - 1.0 / size;
  const invResolution = 1.0 / size;

  // U and V are the -1..1 texture coordinate on the current face.
  // Get projected area for this texel
  const x0 = _u - invResolution;
  const y0 = _v - invResolution;
  const x1 = _u + invResolution;
  const y1 = _v + invResolution;
  let solidAngle = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1);

  // fixSeams cut
  if (u === 0 && v === 0 || u === size - 1 && v === 0 || u === 0 && v === size - 1 || u === size - 1 && v === size - 1) {
    solidAngle /= 3;
  } else if (u === 0 || v === 0 || u === size - 1 || v === size - 1) {
    solidAngle *= 0.5;
  }
  return solidAngle;
}
function shFromCubemap(device, source, dontFlipX) {
  if (source.format !== PIXELFORMAT_RGBA8) {
    Debug.error("ERROR: SH: cubemap must be RGBA8");
    return null;
  }
  if (!source._levels[0] || !source._levels[0][0]) {
    Debug.error("ERROR: SH: cubemap must be synced to CPU");
    return null;
  }
  const cubeSize = source.width;
  if (!source._levels[0][0].length) {
    // Cubemap is not composed of arrays
    if (source._levels[0][0] instanceof HTMLImageElement) {
      // Cubemap is made of imgs - convert to arrays
      const shader = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.fullscreenQuadPS, "fsQuadSimple");
      const constantTexSource = device.scope.resolve("source");
      for (let face = 0; face < 6; face++) {
        const img = source._levels[0][face];
        const tex = new Texture(device, {
          name: 'prefiltered-cube',
          cubemap: false,
          type: TEXTURETYPE_DEFAULT,
          format: source.format,
          width: cubeSize,
          height: cubeSize,
          mipmaps: false
        });
        tex._levels[0] = img;
        tex.upload();
        const tex2 = new Texture(device, {
          name: 'prefiltered-cube',
          cubemap: false,
          type: TEXTURETYPE_DEFAULT,
          format: source.format,
          width: cubeSize,
          height: cubeSize,
          mipmaps: false
        });
        const targ = new RenderTarget({
          colorBuffer: tex2,
          depth: false
        });
        constantTexSource.setValue(tex);
        device.setBlendState(BlendState.DEFAULT);
        drawQuadWithShader(device, targ, shader);
        const gl = device.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, targ.impl._glFrameBuffer);
        const pixels = new Uint8Array(cubeSize * cubeSize * 4);
        gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        source._levels[0][face] = pixels;
      }
    } else {
      Debug.error("ERROR: SH: cubemap must be composed of arrays or images");
      return null;
    }
  }
  const dirs = [];
  for (let y = 0; y < cubeSize; y++) {
    for (let x = 0; x < cubeSize; x++) {
      const u = x / (cubeSize - 1) * 2 - 1;
      const v = y / (cubeSize - 1) * 2 - 1;
      dirs[y * cubeSize + x] = new Vec3(u, v, 1.0).normalize();
    }
  }
  const sh = new Float32Array(9 * 3);
  const coef1 = 0;
  const coef2 = 1 * 3;
  const coef3 = 2 * 3;
  const coef4 = 3 * 3;
  const coef5 = 4 * 3;
  const coef6 = 5 * 3;
  const coef7 = 6 * 3;
  const coef8 = 7 * 3;
  const coef9 = 8 * 3;
  const nx = 0;
  const px = 1;
  const ny = 2;
  const py = 3;
  const nz = 4;
  const pz = 5;
  let accum = 0;
  for (let face = 0; face < 6; face++) {
    for (let y = 0; y < cubeSize; y++) {
      for (let x = 0; x < cubeSize; x++) {
        const addr = y * cubeSize + x;
        const weight = texelCoordSolidAngle(x, y, cubeSize);

        // http://home.comcast.net/~tom_forsyth/blog.wiki.html#[[Spherical%20Harmonics%20in%20Actual%20Games%20notes]]
        const weight1 = weight * 4 / 17;
        const weight2 = weight * 8 / 17;
        const weight3 = weight * 15 / 17;
        const weight4 = weight * 5 / 68;
        const weight5 = weight * 15 / 68;
        const dir = dirs[addr];
        let dx, dy, dz;
        if (face === nx) {
          dx = dir.z;
          dy = -dir.y;
          dz = -dir.x;
        } else if (face === px) {
          dx = -dir.z;
          dy = -dir.y;
          dz = dir.x;
        } else if (face === ny) {
          dx = dir.x;
          dy = dir.z;
          dz = dir.y;
        } else if (face === py) {
          dx = dir.x;
          dy = -dir.z;
          dz = -dir.y;
        } else if (face === nz) {
          dx = dir.x;
          dy = -dir.y;
          dz = dir.z;
        } else if (face === pz) {
          dx = -dir.x;
          dy = -dir.y;
          dz = -dir.z;
        }
        if (!dontFlipX) dx = -dx; // flip original cubemap x instead of doing it at runtime

        const a = source._levels[0][face][addr * 4 + 3] / 255.0;
        for (let c = 0; c < 3; c++) {
          let value = source._levels[0][face][addr * 4 + c] / 255.0;
          if (source.type === TEXTURETYPE_RGBM) {
            value *= a * 8.0;
            value *= value;
          } else {
            value = Math.pow(value, 2.2);
          }
          sh[coef1 + c] += value * weight1;
          sh[coef2 + c] += value * weight2 * dx;
          sh[coef3 + c] += value * weight2 * dy;
          sh[coef4 + c] += value * weight2 * dz;
          sh[coef5 + c] += value * weight3 * dx * dz;
          sh[coef6 + c] += value * weight3 * dz * dy;
          sh[coef7 + c] += value * weight3 * dy * dx;
          sh[coef8 + c] += value * weight4 * (3.0 * dz * dz - 1.0);
          sh[coef9 + c] += value * weight5 * (dx * dx - dy * dy);
          accum += weight;
        }
      }
    }
  }
  for (let c = 0; c < sh.length; c++) {
    sh[c] *= 4 * Math.PI / accum;
  }
  return sh;
}

export { shFromCubemap };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmlsdGVyLWN1YmVtYXAuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9wcmVmaWx0ZXItY3ViZW1hcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9SR0JBOCwgVEVYVFVSRVRZUEVfREVGQVVMVCwgVEVYVFVSRVRZUEVfUkdCTVxufSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4vcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcblxuLy8gaHR0cHM6Ly9zZWJsYWdhcmRlLndvcmRwcmVzcy5jb20vMjAxMi8wNi8xMC9hbWQtY3ViZW1hcGdlbi1mb3ItcGh5c2ljYWxseS1iYXNlZC1yZW5kZXJpbmcvXG5mdW5jdGlvbiBhcmVhRWxlbWVudCh4LCB5KSB7XG4gICAgcmV0dXJuIE1hdGguYXRhbjIoeCAqIHksIE1hdGguc3FydCh4ICogeCArIHkgKiB5ICsgMSkpO1xufVxuXG5mdW5jdGlvbiB0ZXhlbENvb3JkU29saWRBbmdsZSh1LCB2LCBzaXplKSB7XG4gICAgLy8gU2NhbGUgdXAgdG8gWy0xLCAxXSByYW5nZSAoaW5jbHVzaXZlKSwgb2Zmc2V0IGJ5IDAuNSB0byBwb2ludCB0byB0ZXhlbCBjZW50ZXIuXG4gICAgbGV0IF91ID0gKDIuMCAqICh1ICsgMC41KSAvIHNpemUpIC0gMS4wO1xuICAgIGxldCBfdiA9ICgyLjAgKiAodiArIDAuNSkgLyBzaXplKSAtIDEuMDtcblxuICAgIC8vIGZpeFNlYW1zXG4gICAgX3UgKj0gMS4wIC0gMS4wIC8gc2l6ZTtcbiAgICBfdiAqPSAxLjAgLSAxLjAgLyBzaXplO1xuXG4gICAgY29uc3QgaW52UmVzb2x1dGlvbiA9IDEuMCAvIHNpemU7XG5cbiAgICAvLyBVIGFuZCBWIGFyZSB0aGUgLTEuLjEgdGV4dHVyZSBjb29yZGluYXRlIG9uIHRoZSBjdXJyZW50IGZhY2UuXG4gICAgLy8gR2V0IHByb2plY3RlZCBhcmVhIGZvciB0aGlzIHRleGVsXG4gICAgY29uc3QgeDAgPSBfdSAtIGludlJlc29sdXRpb247XG4gICAgY29uc3QgeTAgPSBfdiAtIGludlJlc29sdXRpb247XG4gICAgY29uc3QgeDEgPSBfdSArIGludlJlc29sdXRpb247XG4gICAgY29uc3QgeTEgPSBfdiArIGludlJlc29sdXRpb247XG4gICAgbGV0IHNvbGlkQW5nbGUgPSBhcmVhRWxlbWVudCh4MCwgeTApIC0gYXJlYUVsZW1lbnQoeDAsIHkxKSAtIGFyZWFFbGVtZW50KHgxLCB5MCkgKyBhcmVhRWxlbWVudCh4MSwgeTEpO1xuXG4gICAgLy8gZml4U2VhbXMgY3V0XG4gICAgaWYgKCh1ID09PSAwICYmIHYgPT09IDApIHx8ICh1ID09PSBzaXplIC0gMSAmJiB2ID09PSAwKSB8fCAodSA9PT0gMCAmJiB2ID09PSBzaXplIC0gMSkgfHwgKHUgPT09IHNpemUgLSAxICYmIHYgPT09IHNpemUgLSAxKSkge1xuICAgICAgICBzb2xpZEFuZ2xlIC89IDM7XG4gICAgfSBlbHNlIGlmICh1ID09PSAwIHx8IHYgPT09IDAgfHwgdSA9PT0gc2l6ZSAtIDEgfHwgdiA9PT0gc2l6ZSAtIDEpIHtcbiAgICAgICAgc29saWRBbmdsZSAqPSAwLjU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNvbGlkQW5nbGU7XG59XG5cbmZ1bmN0aW9uIHNoRnJvbUN1YmVtYXAoZGV2aWNlLCBzb3VyY2UsIGRvbnRGbGlwWCkge1xuICAgIGlmIChzb3VyY2UuZm9ybWF0ICE9PSBQSVhFTEZPUk1BVF9SR0JBOCkge1xuICAgICAgICBEZWJ1Zy5lcnJvcihcIkVSUk9SOiBTSDogY3ViZW1hcCBtdXN0IGJlIFJHQkE4XCIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKCFzb3VyY2UuX2xldmVsc1swXSB8fCAhc291cmNlLl9sZXZlbHNbMF1bMF0pIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJFUlJPUjogU0g6IGN1YmVtYXAgbXVzdCBiZSBzeW5jZWQgdG8gQ1BVXCIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBjdWJlU2l6ZSA9IHNvdXJjZS53aWR0aDtcblxuICAgIGlmICghc291cmNlLl9sZXZlbHNbMF1bMF0ubGVuZ3RoKSB7XG4gICAgICAgIC8vIEN1YmVtYXAgaXMgbm90IGNvbXBvc2VkIG9mIGFycmF5c1xuICAgICAgICBpZiAoc291cmNlLl9sZXZlbHNbMF1bMF0gaW5zdGFuY2VvZiBIVE1MSW1hZ2VFbGVtZW50KSB7XG4gICAgICAgICAgICAvLyBDdWJlbWFwIGlzIG1hZGUgb2YgaW1ncyAtIGNvbnZlcnQgdG8gYXJyYXlzXG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBjcmVhdGVTaGFkZXJGcm9tQ29kZShkZXZpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlckNodW5rcy5mdWxsc2NyZWVuUXVhZFBTLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJmc1F1YWRTaW1wbGVcIik7XG4gICAgICAgICAgICBjb25zdCBjb25zdGFudFRleFNvdXJjZSA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwic291cmNlXCIpO1xuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbWcgPSBzb3VyY2UuX2xldmVsc1swXVtmYWNlXTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAncHJlZmlsdGVyZWQtY3ViZScsXG4gICAgICAgICAgICAgICAgICAgIGN1YmVtYXA6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBURVhUVVJFVFlQRV9ERUZBVUxULFxuICAgICAgICAgICAgICAgICAgICBmb3JtYXQ6IHNvdXJjZS5mb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiBjdWJlU2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBjdWJlU2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgbWlwbWFwczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0ZXguX2xldmVsc1swXSA9IGltZztcbiAgICAgICAgICAgICAgICB0ZXgudXBsb2FkKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZXgyID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdwcmVmaWx0ZXJlZC1jdWJlJyxcbiAgICAgICAgICAgICAgICAgICAgY3ViZW1hcDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFRFWFRVUkVUWVBFX0RFRkFVTFQsXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogc291cmNlLmZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IGN1YmVTaXplLFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IGN1YmVTaXplLFxuICAgICAgICAgICAgICAgICAgICBtaXBtYXBzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZyA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGV4MixcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4KTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLkRFRkFVTFQpO1xuICAgICAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRhcmcsIHNoYWRlcik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcbiAgICAgICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRhcmcuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwaXhlbHMgPSBuZXcgVWludDhBcnJheShjdWJlU2l6ZSAqIGN1YmVTaXplICogNCk7XG4gICAgICAgICAgICAgICAgZ2wucmVhZFBpeGVscygwLCAwLCB0ZXgud2lkdGgsIHRleC5oZWlnaHQsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHBpeGVscyk7XG5cbiAgICAgICAgICAgICAgICBzb3VyY2UuX2xldmVsc1swXVtmYWNlXSA9IHBpeGVscztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKFwiRVJST1I6IFNIOiBjdWJlbWFwIG11c3QgYmUgY29tcG9zZWQgb2YgYXJyYXlzIG9yIGltYWdlc1wiKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZGlycyA9IFtdO1xuICAgIGZvciAobGV0IHkgPSAwOyB5IDwgY3ViZVNpemU7IHkrKykge1xuICAgICAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGN1YmVTaXplOyB4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHUgPSAoeCAvIChjdWJlU2l6ZSAtIDEpKSAqIDIgLSAxO1xuICAgICAgICAgICAgY29uc3QgdiA9ICh5IC8gKGN1YmVTaXplIC0gMSkpICogMiAtIDE7XG4gICAgICAgICAgICBkaXJzW3kgKiBjdWJlU2l6ZSArIHhdID0gbmV3IFZlYzModSwgdiwgMS4wKS5ub3JtYWxpemUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHNoID0gbmV3IEZsb2F0MzJBcnJheSg5ICogMyk7XG4gICAgY29uc3QgY29lZjEgPSAwO1xuICAgIGNvbnN0IGNvZWYyID0gMSAqIDM7XG4gICAgY29uc3QgY29lZjMgPSAyICogMztcbiAgICBjb25zdCBjb2VmNCA9IDMgKiAzO1xuICAgIGNvbnN0IGNvZWY1ID0gNCAqIDM7XG4gICAgY29uc3QgY29lZjYgPSA1ICogMztcbiAgICBjb25zdCBjb2VmNyA9IDYgKiAzO1xuICAgIGNvbnN0IGNvZWY4ID0gNyAqIDM7XG4gICAgY29uc3QgY29lZjkgPSA4ICogMztcblxuICAgIGNvbnN0IG54ID0gMDtcbiAgICBjb25zdCBweCA9IDE7XG4gICAgY29uc3QgbnkgPSAyO1xuICAgIGNvbnN0IHB5ID0gMztcbiAgICBjb25zdCBueiA9IDQ7XG4gICAgY29uc3QgcHogPSA1O1xuXG4gICAgbGV0IGFjY3VtID0gMDtcblxuICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG4gICAgICAgIGZvciAobGV0IHkgPSAwOyB5IDwgY3ViZVNpemU7IHkrKykge1xuICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCBjdWJlU2l6ZTsgeCsrKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBhZGRyID0geSAqIGN1YmVTaXplICsgeDtcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWlnaHQgPSB0ZXhlbENvb3JkU29saWRBbmdsZSh4LCB5LCBjdWJlU2l6ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBodHRwOi8vaG9tZS5jb21jYXN0Lm5ldC9+dG9tX2ZvcnN5dGgvYmxvZy53aWtpLmh0bWwjW1tTcGhlcmljYWwlMjBIYXJtb25pY3MlMjBpbiUyMEFjdHVhbCUyMEdhbWVzJTIwbm90ZXNdXVxuICAgICAgICAgICAgICAgIGNvbnN0IHdlaWdodDEgPSB3ZWlnaHQgKiA0IC8gMTc7XG4gICAgICAgICAgICAgICAgY29uc3Qgd2VpZ2h0MiA9IHdlaWdodCAqIDggLyAxNztcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWlnaHQzID0gd2VpZ2h0ICogMTUgLyAxNztcbiAgICAgICAgICAgICAgICBjb25zdCB3ZWlnaHQ0ID0gd2VpZ2h0ICogNSAvIDY4O1xuICAgICAgICAgICAgICAgIGNvbnN0IHdlaWdodDUgPSB3ZWlnaHQgKiAxNSAvIDY4O1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZGlyID0gZGlyc1thZGRyXTtcblxuICAgICAgICAgICAgICAgIGxldCBkeCwgZHksIGR6O1xuICAgICAgICAgICAgICAgIGlmIChmYWNlID09PSBueCkge1xuICAgICAgICAgICAgICAgICAgICBkeCA9IGRpci56O1xuICAgICAgICAgICAgICAgICAgICBkeSA9IC1kaXIueTtcbiAgICAgICAgICAgICAgICAgICAgZHogPSAtZGlyLng7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmYWNlID09PSBweCkge1xuICAgICAgICAgICAgICAgICAgICBkeCA9IC1kaXIuejtcbiAgICAgICAgICAgICAgICAgICAgZHkgPSAtZGlyLnk7XG4gICAgICAgICAgICAgICAgICAgIGR6ID0gZGlyLng7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmYWNlID09PSBueSkge1xuICAgICAgICAgICAgICAgICAgICBkeCA9IGRpci54O1xuICAgICAgICAgICAgICAgICAgICBkeSA9IGRpci56O1xuICAgICAgICAgICAgICAgICAgICBkeiA9IGRpci55O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmFjZSA9PT0gcHkpIHtcbiAgICAgICAgICAgICAgICAgICAgZHggPSBkaXIueDtcbiAgICAgICAgICAgICAgICAgICAgZHkgPSAtZGlyLno7XG4gICAgICAgICAgICAgICAgICAgIGR6ID0gLWRpci55O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmFjZSA9PT0gbnopIHtcbiAgICAgICAgICAgICAgICAgICAgZHggPSBkaXIueDtcbiAgICAgICAgICAgICAgICAgICAgZHkgPSAtZGlyLnk7XG4gICAgICAgICAgICAgICAgICAgIGR6ID0gZGlyLno7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmYWNlID09PSBweikge1xuICAgICAgICAgICAgICAgICAgICBkeCA9IC1kaXIueDtcbiAgICAgICAgICAgICAgICAgICAgZHkgPSAtZGlyLnk7XG4gICAgICAgICAgICAgICAgICAgIGR6ID0gLWRpci56O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghZG9udEZsaXBYKSBkeCA9IC1keDsgLy8gZmxpcCBvcmlnaW5hbCBjdWJlbWFwIHggaW5zdGVhZCBvZiBkb2luZyBpdCBhdCBydW50aW1lXG5cbiAgICAgICAgICAgICAgICBjb25zdCBhID0gc291cmNlLl9sZXZlbHNbMF1bZmFjZV1bYWRkciAqIDQgKyAzXSAvIDI1NS4wO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgYyA9IDA7IGMgPCAzOyBjKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gIHNvdXJjZS5fbGV2ZWxzWzBdW2ZhY2VdW2FkZHIgKiA0ICsgY10gLyAyNTUuMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNvdXJjZS50eXBlID09PSBURVhUVVJFVFlQRV9SR0JNKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSAqPSBhICogOC4wO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgKj0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgucG93KHZhbHVlLCAyLjIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc2hbY29lZjEgKyBjXSArPSB2YWx1ZSAqIHdlaWdodDE7XG4gICAgICAgICAgICAgICAgICAgIHNoW2NvZWYyICsgY10gKz0gdmFsdWUgKiB3ZWlnaHQyICogZHg7XG4gICAgICAgICAgICAgICAgICAgIHNoW2NvZWYzICsgY10gKz0gdmFsdWUgKiB3ZWlnaHQyICogZHk7XG4gICAgICAgICAgICAgICAgICAgIHNoW2NvZWY0ICsgY10gKz0gdmFsdWUgKiB3ZWlnaHQyICogZHo7XG5cbiAgICAgICAgICAgICAgICAgICAgc2hbY29lZjUgKyBjXSArPSB2YWx1ZSAqIHdlaWdodDMgKiBkeCAqIGR6O1xuICAgICAgICAgICAgICAgICAgICBzaFtjb2VmNiArIGNdICs9IHZhbHVlICogd2VpZ2h0MyAqIGR6ICogZHk7XG4gICAgICAgICAgICAgICAgICAgIHNoW2NvZWY3ICsgY10gKz0gdmFsdWUgKiB3ZWlnaHQzICogZHkgKiBkeDtcblxuICAgICAgICAgICAgICAgICAgICBzaFtjb2VmOCArIGNdICs9IHZhbHVlICogd2VpZ2h0NCAqICgzLjAgKiBkeiAqIGR6IC0gMS4wKTtcbiAgICAgICAgICAgICAgICAgICAgc2hbY29lZjkgKyBjXSArPSB2YWx1ZSAqIHdlaWdodDUgKiAoZHggKiBkeCAtIGR5ICogZHkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGFjY3VtICs9IHdlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGxldCBjID0gMDsgYyA8IHNoLmxlbmd0aDsgYysrKSB7XG4gICAgICAgIHNoW2NdICo9IDQgKiBNYXRoLlBJIC8gYWNjdW07XG4gICAgfVxuXG4gICAgcmV0dXJuIHNoO1xufVxuXG5leHBvcnQgeyBzaEZyb21DdWJlbWFwIH07XG4iXSwibmFtZXMiOlsiYXJlYUVsZW1lbnQiLCJ4IiwieSIsIk1hdGgiLCJhdGFuMiIsInNxcnQiLCJ0ZXhlbENvb3JkU29saWRBbmdsZSIsInUiLCJ2Iiwic2l6ZSIsIl91IiwiX3YiLCJpbnZSZXNvbHV0aW9uIiwieDAiLCJ5MCIsIngxIiwieTEiLCJzb2xpZEFuZ2xlIiwic2hGcm9tQ3ViZW1hcCIsImRldmljZSIsInNvdXJjZSIsImRvbnRGbGlwWCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiRGVidWciLCJlcnJvciIsIl9sZXZlbHMiLCJjdWJlU2l6ZSIsIndpZHRoIiwibGVuZ3RoIiwiSFRNTEltYWdlRWxlbWVudCIsInNoYWRlciIsImNyZWF0ZVNoYWRlckZyb21Db2RlIiwic2hhZGVyQ2h1bmtzIiwiZnVsbHNjcmVlblF1YWRWUyIsImZ1bGxzY3JlZW5RdWFkUFMiLCJjb25zdGFudFRleFNvdXJjZSIsInNjb3BlIiwicmVzb2x2ZSIsImZhY2UiLCJpbWciLCJ0ZXgiLCJUZXh0dXJlIiwibmFtZSIsImN1YmVtYXAiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsImhlaWdodCIsIm1pcG1hcHMiLCJ1cGxvYWQiLCJ0ZXgyIiwidGFyZyIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJzZXRWYWx1ZSIsInNldEJsZW5kU3RhdGUiLCJCbGVuZFN0YXRlIiwiREVGQVVMVCIsImRyYXdRdWFkV2l0aFNoYWRlciIsImdsIiwiYmluZEZyYW1lYnVmZmVyIiwiRlJBTUVCVUZGRVIiLCJpbXBsIiwiX2dsRnJhbWVCdWZmZXIiLCJwaXhlbHMiLCJVaW50OEFycmF5IiwicmVhZFBpeGVscyIsIlJHQkEiLCJVTlNJR05FRF9CWVRFIiwiZGlycyIsIlZlYzMiLCJub3JtYWxpemUiLCJzaCIsIkZsb2F0MzJBcnJheSIsImNvZWYxIiwiY29lZjIiLCJjb2VmMyIsImNvZWY0IiwiY29lZjUiLCJjb2VmNiIsImNvZWY3IiwiY29lZjgiLCJjb2VmOSIsIm54IiwicHgiLCJueSIsInB5IiwibnoiLCJweiIsImFjY3VtIiwiYWRkciIsIndlaWdodCIsIndlaWdodDEiLCJ3ZWlnaHQyIiwid2VpZ2h0MyIsIndlaWdodDQiLCJ3ZWlnaHQ1IiwiZGlyIiwiZHgiLCJkeSIsImR6IiwieiIsImEiLCJjIiwidmFsdWUiLCJURVhUVVJFVFlQRV9SR0JNIiwicG93IiwiUEkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQWFBO0FBQ0EsU0FBU0EsV0FBVyxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUN2QixPQUFPQyxJQUFJLENBQUNDLEtBQUssQ0FBQ0gsQ0FBQyxHQUFHQyxDQUFDLEVBQUVDLElBQUksQ0FBQ0UsSUFBSSxDQUFDSixDQUFDLEdBQUdBLENBQUMsR0FBR0MsQ0FBQyxHQUFHQSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMxRCxDQUFBO0FBRUEsU0FBU0ksb0JBQW9CLENBQUNDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxJQUFJLEVBQUU7QUFDdEM7RUFDQSxJQUFJQyxFQUFFLEdBQUksR0FBRyxJQUFJSCxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUdFLElBQUksR0FBSSxHQUFHLENBQUE7RUFDdkMsSUFBSUUsRUFBRSxHQUFJLEdBQUcsSUFBSUgsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHQyxJQUFJLEdBQUksR0FBRyxDQUFBOztBQUV2QztBQUNBQyxFQUFBQSxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsR0FB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
