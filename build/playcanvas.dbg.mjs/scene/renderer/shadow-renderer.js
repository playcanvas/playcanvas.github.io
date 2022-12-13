/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { FUNC_LESSEQUAL } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../../platform/graphics/simple-post-effect.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF3, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';

function gauss(x, sigma) {
  return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}
const maxBlurSize = 25;
function gaussWeights(kernelSize) {
  if (kernelSize > maxBlurSize) {
    kernelSize = maxBlurSize;
  }
  const sigma = (kernelSize - 1) / (2 * 3);
  const halfWidth = (kernelSize - 1) * 0.5;
  const values = new Array(kernelSize);
  let sum = 0.0;
  for (let i = 0; i < kernelSize; ++i) {
    values[i] = gauss(i - halfWidth, sigma);
    sum += values[i];
  }
  for (let i = 0; i < kernelSize; ++i) {
    values[i] /= sum;
  }
  return values;
}
const shadowCamView = new Mat4();
const shadowCamViewProj = new Mat4();
const pixelOffset = new Float32Array(2);
const blurScissorRect = new Vec4(1, 1, 0, 0);
const opChanId = {
  r: 1,
  g: 2,
  b: 3,
  a: 4
};
const viewportMatrix = new Mat4();
function getDepthKey(meshInstance) {
  const material = meshInstance.material;
  const x = meshInstance.skinInstance ? 10 : 0;
  let y = 0;
  if (material.opacityMap) {
    const opChan = material.opacityMapChannel;
    if (opChan) {
      y = opChanId[opChan];
    }
  }
  return x + y;
}

class ShadowRenderer {
  constructor(renderer, lightTextureAtlas) {
    this.device = renderer.device;

    this.renderer = renderer;

    this.lightTextureAtlas = lightTextureAtlas;
    const scope = this.device.scope;
    this.polygonOffsetId = scope.resolve('polygonOffset');
    this.polygonOffset = new Float32Array(2);

    this.sourceId = scope.resolve('source');
    this.pixelOffsetId = scope.resolve('pixelOffset');
    this.weightId = scope.resolve('weight[0]');
    this.blurVsmShaderCode = [shaderChunks.blurVSMPS, '#define GAUSS\n' + shaderChunks.blurVSMPS];
    const packed = '#define PACKED\n';
    this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];

    this.blurVsmShader = [{}, {}];
    this.blurPackedVsmShader = [{}, {}];
    this.blurVsmWeights = {};

    this.shadowMapLightRadiusId = scope.resolve('light_radius');
  }

  static createShadowCamera(device, shadowType, type, face) {
    const shadowCam = LightCamera.create('ShadowCamera', type, face);

    if (shadowType >= SHADOW_VSM8 && shadowType <= SHADOW_VSM32) {
      shadowCam.clearColor = new Color(0, 0, 0, 0);
    } else {
      shadowCam.clearColor = new Color(1, 1, 1, 1);
    }
    shadowCam.clearDepthBuffer = true;
    shadowCam.clearStencilBuffer = false;
    return shadowCam;
  }
  static setShadowCameraSettings(shadowCam, device, shadowType, type, isClustered) {
    let hwPcf = shadowType === SHADOW_PCF5 || shadowType === SHADOW_PCF3 && device.webgl2;
    if (type === LIGHTTYPE_OMNI && !isClustered) {
      hwPcf = false;
    }
    shadowCam.clearColorBuffer = !hwPcf;
  }

  cullShadowCasters(meshInstances, visible, camera) {
    let count = 0;
    const numInstances = meshInstances.length;
    for (let i = 0; i < numInstances; i++) {
      const meshInstance = meshInstances[i];
      if (!meshInstance.cull || meshInstance._isVisible(camera)) {
        meshInstance.visibleThisFrame = true;
        visible[count] = meshInstance;
        count++;
      }
    }
    visible.length = count;

    visible.sort(this.renderer.sortCompareDepth);
  }
  setupRenderState(device, light) {
    const isClustered = this.renderer.scene.clusteredLightingEnabled;

    if (device.webgl2) {
      if (light._type === LIGHTTYPE_OMNI && !isClustered) {
        device.setDepthBias(false);
      } else {
        device.setDepthBias(true);
        device.setDepthBiasValues(light.shadowBias * -1000.0, light.shadowBias * -1000.0);
      }
    } else if (device.extStandardDerivatives) {
      if (light._type === LIGHTTYPE_OMNI) {
        this.polygonOffset[0] = 0;
        this.polygonOffset[1] = 0;
        this.polygonOffsetId.setValue(this.polygonOffset);
      } else {
        this.polygonOffset[0] = light.shadowBias * -1000.0;
        this.polygonOffset[1] = light.shadowBias * -1000.0;
        this.polygonOffsetId.setValue(this.polygonOffset);
      }
    }

    device.setBlending(false);
    device.setDepthWrite(true);
    device.setDepthTest(true);
    device.setDepthFunc(FUNC_LESSEQUAL);
    const useShadowSampler = isClustered ? light._isPcf && device.webgl2 :
    light._isPcf && device.webgl2 && light._type !== LIGHTTYPE_OMNI;
    if (useShadowSampler) {
      device.setColorWrite(false, false, false, false);
    } else {
      device.setColorWrite(true, true, true, true);
    }
  }
  restoreRenderState(device) {
    if (device.webgl2) {
      device.setDepthBias(false);
    } else if (device.extStandardDerivatives) {
      this.polygonOffset[0] = 0;
      this.polygonOffset[1] = 0;
      this.polygonOffsetId.setValue(this.polygonOffset);
    }
  }
  dispatchUniforms(light, shadowCam, lightRenderData, face) {
    const shadowCamNode = shadowCam._node;

    if (light._type !== LIGHTTYPE_DIRECTIONAL) {
      this.renderer.dispatchViewPos(shadowCamNode.getPosition());
      this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
    }

    shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
    shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);

    const rectViewport = lightRenderData.shadowViewport;
    shadowCam.rect = rectViewport;
    shadowCam.scissorRect = lightRenderData.shadowScissor;
    viewportMatrix.setViewport(rectViewport.x, rectViewport.y, rectViewport.z, rectViewport.w);
    lightRenderData.shadowMatrix.mul2(viewportMatrix, shadowCamViewProj);
    if (light._type === LIGHTTYPE_DIRECTIONAL) {
      light._shadowMatrixPalette.set(lightRenderData.shadowMatrix.data, face * 16);
    }
  }

  submitCasters(visibleCasters, light) {
    const device = this.device;
    const renderer = this.renderer;
    const scene = renderer.scene;
    const passFlags = 1 << SHADER_SHADOW;

    const shadowPass = ShaderPass.getShadow(light._type, light._shadowType);

    const count = visibleCasters.length;
    for (let i = 0; i < count; i++) {
      const meshInstance = visibleCasters[i];
      const mesh = meshInstance.mesh;
      meshInstance.ensureMaterial(device);
      const material = meshInstance.material;

      renderer.setBaseConstants(device, material);
      renderer.setSkinning(device, meshInstance);
      if (material.dirty) {
        material.updateUniforms(device, scene);
        material.dirty = false;
      }
      if (material.chunks) {
        renderer.setCullMode(true, false, meshInstance);

        material.setParameters(device);

        meshInstance.setParameters(device, passFlags);
      }

      let shadowShader = meshInstance._shader[shadowPass];
      if (!shadowShader) {
        meshInstance.updatePassShader(scene, shadowPass);
        shadowShader = meshInstance._shader[shadowPass];
        meshInstance._key[SORTKEY_DEPTH] = getDepthKey(meshInstance);
      }
      if (!shadowShader.failed && !device.setShader(shadowShader)) {
        Debug.error(`Error compiling shadow shader for material=${material.name} pass=${shadowPass}`, material);
      }

      renderer.setVertexBuffers(device, mesh);
      renderer.setMorphing(device, meshInstance.morphInstance);
      const style = meshInstance.renderStyle;
      device.setIndexBuffer(mesh.indexBuffer[style]);

      renderer.drawInstance(device, meshInstance, mesh, style);
      renderer._shadowDrawCalls++;
    }
  }
  needsShadowRendering(light) {
    const needs = light.enabled && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame;
    if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
      light.shadowUpdateMode = SHADOWUPDATE_NONE;
    }
    this.renderer._shadowMapUpdates += light.numShadowFaces;
    return needs;
  }
  getLightRenderData(light, camera, face) {
    return light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
  }
  setupRenderPass(renderPass, shadowCamera, clearRenderTarget) {
    const rt = shadowCamera.renderTarget;
    renderPass.init(rt);

    if (clearRenderTarget) {
      const clearColor = shadowCamera.clearColorBuffer;
      renderPass.colorOps.clear = clearColor;
      if (clearColor) renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);

      renderPass.depthStencilOps.storeDepth = !clearColor;
      renderPass.setClearDepth(1.0);
    }

    renderPass.requiresCubemaps = false;
  }

  prepareFace(light, camera, face) {
    const type = light._type;
    const shadowType = light._shadowType;
    const isClustered = this.renderer.scene.clusteredLightingEnabled;
    const lightRenderData = this.getLightRenderData(light, camera, face);
    const shadowCam = lightRenderData.shadowCamera;

    ShadowRenderer.setShadowCameraSettings(shadowCam, this.device, shadowType, type, isClustered);

    const renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
    shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];
    return shadowCam;
  }
  renderFace(light, camera, face, clear) {
    const device = this.device;
    const shadowMapStartTime = now();
    DebugGraphics.pushGpuMarker(device, `SHADOW ${light._node.name} FACE ${face}`);
    this.setupRenderState(device, light);
    const lightRenderData = this.getLightRenderData(light, camera, face);
    const shadowCam = lightRenderData.shadowCamera;
    this.dispatchUniforms(light, shadowCam, lightRenderData, face);
    const rt = shadowCam.renderTarget;
    this.renderer.setCameraUniforms(shadowCam, rt, null);

    if (clear) {
      this.renderer.clearView(shadowCam, rt, true, false);
    } else {
      this.renderer.setupViewport(shadowCam, rt);
    }

    this.submitCasters(lightRenderData.visibleCasters, light);
    this.restoreRenderState(device);
    DebugGraphics.popGpuMarker(device);
    this.renderer._shadowMapTime += now() - shadowMapStartTime;
  }
  render(light, camera) {
    if (this.needsShadowRendering(light)) {
      const faceCount = light.numShadowFaces;

      for (let face = 0; face < faceCount; face++) {
        this.prepareFace(light, camera, face);
        this.renderFace(light, camera, face, true);
      }

      this.renderVms(light, camera);
    }
  }
  renderVms(light, camera) {
    if (light._isVsm && light._vsmBlurSize > 1) {
      const isClustered = this.renderer.scene.clusteredLightingEnabled;
      if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
        this.applyVsmBlur(light, camera);
      }
    }
  }
  getVsmBlurShader(isVsm8, blurMode, filterSize) {
    let blurShader = (isVsm8 ? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
    if (!blurShader) {
      this.blurVsmWeights[filterSize] = gaussWeights(filterSize);
      const blurVS = shaderChunks.fullscreenQuadVS;
      let blurFS = '#define SAMPLES ' + filterSize + '\n';
      if (isVsm8) {
        blurFS += this.blurPackedVsmShaderCode[blurMode];
      } else {
        blurFS += this.blurVsmShaderCode[blurMode];
      }
      const blurShaderName = 'blurVsm' + blurMode + '' + filterSize + '' + isVsm8;
      blurShader = createShaderFromCode(this.device, blurVS, blurFS, blurShaderName);
      if (isVsm8) {
        this.blurPackedVsmShader[blurMode][filterSize] = blurShader;
      } else {
        this.blurVsmShader[blurMode][filterSize] = blurShader;
      }
    }
    return blurShader;
  }
  applyVsmBlur(light, camera) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, `VSM ${light._node.name}`);
    const lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
    const shadowCam = lightRenderData.shadowCamera;
    const origShadowMap = shadowCam.renderTarget;

    const tempShadowMap = this.renderer.shadowMapCache.get(device, light);
    const tempRt = tempShadowMap.renderTargets[0];
    const isVsm8 = light._shadowType === SHADOW_VSM8;
    const blurMode = light.vsmBlurMode;
    const filterSize = light._vsmBlurSize;
    const blurShader = this.getVsmBlurShader(isVsm8, blurMode, filterSize);
    blurScissorRect.z = light._shadowResolution - 2;
    blurScissorRect.w = blurScissorRect.z;

    this.sourceId.setValue(origShadowMap.colorBuffer);
    pixelOffset[0] = 1 / light._shadowResolution;
    pixelOffset[1] = 0;
    this.pixelOffsetId.setValue(pixelOffset);
    if (blurMode === BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
    drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);

    this.sourceId.setValue(tempRt.colorBuffer);
    pixelOffset[1] = pixelOffset[0];
    pixelOffset[0] = 0;
    this.pixelOffsetId.setValue(pixelOffset);
    drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);

    this.renderer.shadowMapCache.add(light, tempShadowMap);
    DebugGraphics.popGpuMarker(device);
  }
}

export { ShadowRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBGVU5DX0xFU1NFUVVBTCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTFVSX0dBVVNTSUFOLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksXG4gICAgU0hBREVSX1NIQURPVyxcbiAgICBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMzIsXG4gICAgU0hBRE9XVVBEQVRFX05PTkUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgU09SVEtFWV9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3NoYWRlci1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuY29uc3QgbWF4Qmx1clNpemUgPSAyNTtcbmZ1bmN0aW9uIGdhdXNzV2VpZ2h0cyhrZXJuZWxTaXplKSB7XG4gICAgaWYgKGtlcm5lbFNpemUgPiBtYXhCbHVyU2l6ZSkge1xuICAgICAgICBrZXJuZWxTaXplID0gbWF4Qmx1clNpemU7XG4gICAgfVxuICAgIGNvbnN0IHNpZ21hID0gKGtlcm5lbFNpemUgLSAxKSAvICgyICogMyk7XG5cbiAgICBjb25zdCBoYWxmV2lkdGggPSAoa2VybmVsU2l6ZSAtIDEpICogMC41O1xuICAgIGNvbnN0IHZhbHVlcyA9IG5ldyBBcnJheShrZXJuZWxTaXplKTtcbiAgICBsZXQgc3VtID0gMC4wO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2VybmVsU2l6ZTsgKytpKSB7XG4gICAgICAgIHZhbHVlc1tpXSA9IGdhdXNzKGkgLSBoYWxmV2lkdGgsIHNpZ21hKTtcbiAgICAgICAgc3VtICs9IHZhbHVlc1tpXTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gLz0gc3VtO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xufVxuXG5jb25zdCBzaGFkb3dDYW1WaWV3ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNoYWRvd0NhbVZpZXdQcm9qID0gbmV3IE1hdDQoKTtcbmNvbnN0IHBpeGVsT2Zmc2V0ID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbmNvbnN0IGJsdXJTY2lzc29yUmVjdCA9IG5ldyBWZWM0KDEsIDEsIDAsIDApO1xuY29uc3Qgb3BDaGFuSWQgPSB7IHI6IDEsIGc6IDIsIGI6IDMsIGE6IDQgfTtcbmNvbnN0IHZpZXdwb3J0TWF0cml4ID0gbmV3IE1hdDQoKTtcblxuZnVuY3Rpb24gZ2V0RGVwdGhLZXkobWVzaEluc3RhbmNlKSB7XG4gICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdGFuY2UubWF0ZXJpYWw7XG4gICAgY29uc3QgeCA9IG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPyAxMCA6IDA7XG4gICAgbGV0IHkgPSAwO1xuICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwKSB7XG4gICAgICAgIGNvbnN0IG9wQ2hhbiA9IG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsO1xuICAgICAgICBpZiAob3BDaGFuKSB7XG4gICAgICAgICAgICB5ID0gb3BDaGFuSWRbb3BDaGFuXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geCArIHk7XG59XG5cbi8qKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTaGFkb3dSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn0gcmVuZGVyZXIgLSBUaGUgcmVuZGVyZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gbGlnaHRUZXh0dXJlQXRsYXMgLSBUaGVcbiAgICAgKiBzaGFkb3cgbWFwIGF0bGFzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHJlbmRlcmVyLCBsaWdodFRleHR1cmVBdGxhcykge1xuICAgICAgICB0aGlzLmRldmljZSA9IHJlbmRlcmVyLmRldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXJlci5qcycpLlJlbmRlcmVyfSAqL1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gcmVuZGVyZXI7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gKi9cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IGxpZ2h0VGV4dHVyZUF0bGFzO1xuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQgPSBzY29wZS5yZXNvbHZlKCdwb2x5Z29uT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgLy8gVlNNXG4gICAgICAgIHRoaXMuc291cmNlSWQgPSBzY29wZS5yZXNvbHZlKCdzb3VyY2UnKTtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncGl4ZWxPZmZzZXQnKTtcbiAgICAgICAgdGhpcy53ZWlnaHRJZCA9IHNjb3BlLnJlc29sdmUoJ3dlaWdodFswXScpO1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXJDb2RlID0gW3NoYWRlckNodW5rcy5ibHVyVlNNUFMsICcjZGVmaW5lIEdBVVNTXFxuJyArIHNoYWRlckNodW5rcy5ibHVyVlNNUFNdO1xuICAgICAgICBjb25zdCBwYWNrZWQgPSAnI2RlZmluZSBQQUNLRURcXG4nO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlID0gW3BhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMF0sIHBhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMV1dO1xuXG4gICAgICAgIC8vIGNhY2hlIGZvciB2c20gYmx1ciBzaGFkZXJzXG4gICAgICAgIHRoaXMuYmx1clZzbVNoYWRlciA9IFt7fSwge31dO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXIgPSBbe30sIHt9XTtcblxuICAgICAgICB0aGlzLmJsdXJWc21XZWlnaHRzID0ge307XG5cbiAgICAgICAgLy8gdW5pZm9ybXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfcmFkaXVzJyk7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlcyBzaGFkb3cgY2FtZXJhIGZvciBhIGxpZ2h0IGFuZCBzZXRzIHVwIGl0cyBjb25zdGFudCBwcm9wZXJ0aWVzXG4gICAgc3RhdGljIGNyZWF0ZVNoYWRvd0NhbWVyYShkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGZhY2UpIHtcblxuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBMaWdodENhbWVyYS5jcmVhdGUoJ1NoYWRvd0NhbWVyYScsIHR5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIGRvbid0IGNsZWFyIHRoZSBjb2xvciBidWZmZXIgaWYgcmVuZGVyaW5nIGEgZGVwdGggbWFwXG4gICAgICAgIGlmIChzaGFkb3dUeXBlID49IFNIQURPV19WU004ICYmIHNoYWRvd1R5cGUgPD0gU0hBRE9XX1ZTTTMyKSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyRGVwdGhCdWZmZXIgPSB0cnVlO1xuICAgICAgICBzaGFkb3dDYW0uY2xlYXJTdGVuY2lsQnVmZmVyID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICBzdGF0aWMgc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCBkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKSB7XG5cbiAgICAgICAgLy8gbm9ybWFsIG9tbmkgc2hhZG93cyBvbiB3ZWJnbDIgZW5jb2RlIGRlcHRoIGluIFJHQkE4IGFuZCBkbyBtYW51YWwgUENGIHNhbXBsaW5nXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIHVzZSBkZXB0aCBmb3JtYXQgYW5kIGhhcmR3YXJlIFBDRiBzYW1wbGluZ1xuICAgICAgICBsZXQgaHdQY2YgPSBzaGFkb3dUeXBlID09PSBTSEFET1dfUENGNSB8fCAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgZGV2aWNlLndlYmdsMik7XG4gICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgIGh3UGNmID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvckJ1ZmZlciA9ICFod1BjZjtcbiAgICB9XG5cbiAgICAvLyBjdWxscyB0aGUgbGlzdCBvZiBtZXNoZXMgaW5zdGFuY2VzIGJ5IHRoZSBjYW1lcmEsIHN0b3JpbmcgdmlzaWJsZSBtZXNoIGluc3RhbmNlcyBpbiB0aGUgc3BlY2lmaWVkIGFycmF5XG4gICAgY3VsbFNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcywgdmlzaWJsZSwgY2FtZXJhKSB7XG5cbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbnVtSW5zdGFuY2VzID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSW5zdGFuY2VzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIGlmICghbWVzaEluc3RhbmNlLmN1bGwgfHwgbWVzaEluc3RhbmNlLl9pc1Zpc2libGUoY2FtZXJhKSkge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB2aXNpYmxlW2NvdW50XSA9IG1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmlzaWJsZS5sZW5ndGggPSBjb3VudDtcblxuICAgICAgICAvLyBUT0RPOiB3ZSBzaG91bGQgcHJvYmFibHkgc29ydCBzaGFkb3cgbWVzaGVzIGJ5IHNoYWRlciBhbmQgbm90IGRlcHRoXG4gICAgICAgIHZpc2libGUuc29ydCh0aGlzLnJlbmRlcmVyLnNvcnRDb21wYXJlRGVwdGgpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyU3RhdGUoZGV2aWNlLCBsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZGVwdGggYmlhc1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyh0cnVlKTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzVmFsdWVzKGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wLCBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFsxXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzBdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCBzdGFuZGFyZCBzaGFkb3dtYXAgc3RhdGVzXG4gICAgICAgIGRldmljZS5zZXRCbGVuZGluZyhmYWxzZSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhUZXN0KHRydWUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhGdW5jKEZVTkNfTEVTU0VRVUFMKTtcblxuICAgICAgICBjb25zdCB1c2VTaGFkb3dTYW1wbGVyID0gaXNDbHVzdGVyZWQgP1xuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGRldmljZS53ZWJnbDIgOiAgICAgLy8gYm90aCBzcG90IGFuZCBvbW5pIGxpZ2h0IGFyZSB1c2luZyBzaGFkb3cgc2FtcGxlciBvbiB3ZWJnbDIgd2hlbiBjbHVzdGVyZWRcbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuICAgICAgICBpZiAodXNlU2hhZG93U2FtcGxlcikge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXN0b3JlUmVuZGVyU3RhdGUoZGV2aWNlKSB7XG5cbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG5cbiAgICAgICAgLy8gcG9zaXRpb24gLyByYW5nZVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5kaXNwYXRjaFZpZXdQb3Moc2hhZG93Q2FtTm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZC5zZXRWYWx1ZShsaWdodC5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2aWV3LXByb2plY3Rpb24gc2hhZG93IG1hdHJpeFxuICAgICAgICBzaGFkb3dDYW1WaWV3LnNldFRSUyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCksIHNoYWRvd0NhbU5vZGUuZ2V0Um90YXRpb24oKSwgVmVjMy5PTkUpLmludmVydCgpO1xuICAgICAgICBzaGFkb3dDYW1WaWV3UHJvai5tdWwyKHNoYWRvd0NhbS5wcm9qZWN0aW9uTWF0cml4LCBzaGFkb3dDYW1WaWV3KTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBoYW5kbGluZ1xuICAgICAgICBjb25zdCByZWN0Vmlld3BvcnQgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5yZWN0ID0gcmVjdFZpZXdwb3J0O1xuICAgICAgICBzaGFkb3dDYW0uc2Npc3NvclJlY3QgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93U2Npc3NvcjtcblxuICAgICAgICB2aWV3cG9ydE1hdHJpeC5zZXRWaWV3cG9ydChyZWN0Vmlld3BvcnQueCwgcmVjdFZpZXdwb3J0LnksIHJlY3RWaWV3cG9ydC56LCByZWN0Vmlld3BvcnQudyk7XG4gICAgICAgIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXgubXVsMih2aWV3cG9ydE1hdHJpeCwgc2hhZG93Q2FtVmlld1Byb2opO1xuXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAvLyBjb3B5IG1hdHJpeCB0byBzaGFkb3cgY2FzY2FkZSBwYWxldHRlXG4gICAgICAgICAgICBsaWdodC5fc2hhZG93TWF0cml4UGFsZXR0ZS5zZXQobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhLCBmYWNlICogMTYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gdmlzaWJsZUNhc3RlcnMgLSBWaXNpYmxlIG1lc2hcbiAgICAgKiBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IGxpZ2h0IC0gVGhlIGxpZ2h0LlxuICAgICAqL1xuICAgIHN1Ym1pdENhc3RlcnModmlzaWJsZUNhc3RlcnMsIGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSByZW5kZXJlci5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWdzID0gMSA8PCBTSEFERVJfU0hBRE9XO1xuXG4gICAgICAgIC8vIFNvcnQgc2hhZG93IGNhc3RlcnNcbiAgICAgICAgY29uc3Qgc2hhZG93UGFzcyA9IFNoYWRlclBhc3MuZ2V0U2hhZG93KGxpZ2h0Ll90eXBlLCBsaWdodC5fc2hhZG93VHlwZSk7XG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldEN1bGxNb2RlKHRydWUsIGZhbHNlLCBtZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSSAoc2hhZG93KTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJSSAoc2hhZG93KTogbWVzaEluc3RhbmNlIG92ZXJyaWRlc1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWdzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IHNoYWRlclxuICAgICAgICAgICAgbGV0IHNoYWRvd1NoYWRlciA9IG1lc2hJbnN0YW5jZS5fc2hhZGVyW3NoYWRvd1Bhc3NdO1xuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgc2hhZG93UGFzcyk7XG4gICAgICAgICAgICAgICAgc2hhZG93U2hhZGVyID0gbWVzaEluc3RhbmNlLl9zaGFkZXJbc2hhZG93UGFzc107XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9rZXlbU09SVEtFWV9ERVBUSF0gPSBnZXREZXB0aEtleShtZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIuZmFpbGVkICYmICFkZXZpY2Uuc2V0U2hhZGVyKHNoYWRvd1NoYWRlcikpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRvdyBzaGFkZXIgZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3NoYWRvd1Bhc3N9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgYnVmZmVyc1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0TW9ycGhpbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gbWVzaEluc3RhbmNlLnJlbmRlclN0eWxlO1xuICAgICAgICAgICAgZGV2aWNlLnNldEluZGV4QnVmZmVyKG1lc2guaW5kZXhCdWZmZXJbc3R5bGVdKTtcblxuICAgICAgICAgICAgLy8gZHJhd1xuICAgICAgICAgICAgcmVuZGVyZXIuZHJhd0luc3RhbmNlKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSk7XG4gICAgICAgICAgICByZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBuZWVkc1NoYWRvd1JlbmRlcmluZyhsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IG5lZWRzID0gbGlnaHQuZW5hYmxlZCAmJiBsaWdodC5jYXN0U2hhZG93cyAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlICE9PSBTSEFET1dVUERBVEVfTk9ORSAmJiBsaWdodC52aXNpYmxlVGhpc0ZyYW1lO1xuXG4gICAgICAgIGlmIChsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfVEhJU0ZSQU1FKSB7XG4gICAgICAgICAgICBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX05PTkU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzICs9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuXG4gICAgICAgIHJldHVybiBuZWVkcztcbiAgICB9XG5cbiAgICBnZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGFyZSBwZXIgY2FtZXJhLCBzbyBnZXQgYXBwcm9wcmlhdGUgcmVuZGVyIGRhdGFcbiAgICAgICAgcmV0dXJuIGxpZ2h0LmdldFJlbmRlckRhdGEobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IGNhbWVyYSA6IG51bGwsIGZhY2UpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyUGFzcyhyZW5kZXJQYXNzLCBzaGFkb3dDYW1lcmEsIGNsZWFyUmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgY29uc3QgcnQgPSBzaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICByZW5kZXJQYXNzLmluaXQocnQpO1xuXG4gICAgICAgIC8vIG9ubHkgY2xlYXIgdGhlIHJlbmRlciBwYXNzIHRhcmdldCBpZiBhbGwgZmFjZXMgKGNhc2NhZGVzKSBhcmUgZ2V0dGluZyByZW5kZXJlZFxuICAgICAgICBpZiAoY2xlYXJSZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIC8vIGNvbG9yXG4gICAgICAgICAgICBjb25zdCBjbGVhckNvbG9yID0gc2hhZG93Q2FtZXJhLmNsZWFyQ29sb3JCdWZmZXI7XG4gICAgICAgICAgICByZW5kZXJQYXNzLmNvbG9yT3BzLmNsZWFyID0gY2xlYXJDb2xvcjtcbiAgICAgICAgICAgIGlmIChjbGVhckNvbG9yKVxuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXJWYWx1ZS5jb3B5KHNoYWRvd0NhbWVyYS5jbGVhckNvbG9yKTtcblxuICAgICAgICAgICAgLy8gZGVwdGhcbiAgICAgICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGggPSAhY2xlYXJDb2xvcjtcbiAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aCgxLjApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm90IHNhbXBsaW5nIGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjdWJlbWFwc1xuICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyByZW5kZXIgdGFyZ2V0IC8gcmVuZGVyIHRhcmdldCBzZXR0aW5ncyB0byBhbGxvdyByZW5kZXIgcGFzcyB0byBiZSBzZXQgdXBcbiAgICBwcmVwYXJlRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3QgdHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gbGlnaHQuX3NoYWRvd1R5cGU7XG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gdGhpcy5nZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSk7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgLy8gY2FtZXJhIGNsZWFyIHNldHRpbmdcbiAgICAgICAgLy8gTm90ZTogd2hlbiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgdGhlIG9ubHkgbGlnaHQgdHlwZSwgdGhpcyBjb2RlIGNhbiBiZSBtb3ZlZCB0byBjcmVhdGVTaGFkb3dDYW1lcmEgZnVuY3Rpb25cbiAgICAgICAgU2hhZG93UmVuZGVyZXIuc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCB0aGlzLmRldmljZSwgc2hhZG93VHlwZSwgdHlwZSwgaXNDbHVzdGVyZWQpO1xuXG4gICAgICAgIC8vIGFzc2lnbiByZW5kZXIgdGFyZ2V0IGZvciB0aGUgZmFjZVxuICAgICAgICBjb25zdCByZW5kZXJUYXJnZXRJbmRleCA9IHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IDAgOiBmYWNlO1xuICAgICAgICBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0ID0gbGlnaHQuX3NoYWRvd01hcC5yZW5kZXJUYXJnZXRzW3JlbmRlclRhcmdldEluZGV4XTtcblxuICAgICAgICByZXR1cm4gc2hhZG93Q2FtO1xuICAgIH1cblxuICAgIHJlbmRlckZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSwgY2xlYXIpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNoYWRvd01hcFN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgU0hBRE9XICR7bGlnaHQuX25vZGUubmFtZX0gRkFDRSAke2ZhY2V9YCk7XG5cbiAgICAgICAgdGhpcy5zZXR1cFJlbmRlclN0YXRlKGRldmljZSwgbGlnaHQpO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHRoaXMuZ2V0TGlnaHRSZW5kZXJEYXRhKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hVbmlmb3JtcyhsaWdodCwgc2hhZG93Q2FtLCBsaWdodFJlbmRlckRhdGEsIGZhY2UpO1xuXG4gICAgICAgIGNvbnN0IHJ0ID0gc2hhZG93Q2FtLnJlbmRlclRhcmdldDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRDYW1lcmFVbmlmb3JtcyhzaGFkb3dDYW0sIHJ0LCBudWxsKTtcblxuICAgICAgICAvLyBpZiB0aGlzIGlzIGNhbGxlZCBmcm9tIGEgcmVuZGVyIHBhc3MsIG5vIGNsZWFyaW5nIHRha2VzIHBsYWNlXG4gICAgICAgIGlmIChjbGVhcikge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5jbGVhclZpZXcoc2hhZG93Q2FtLCBydCwgdHJ1ZSwgZmFsc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zZXR1cFZpZXdwb3J0KHNoYWRvd0NhbSwgcnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVuZGVyIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgIHRoaXMuc3VibWl0Q2FzdGVycyhsaWdodFJlbmRlckRhdGEudmlzaWJsZUNhc3RlcnMsIGxpZ2h0KTtcblxuICAgICAgICB0aGlzLnJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lICs9IG5vdygpIC0gc2hhZG93TWFwU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSkge1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzU2hhZG93UmVuZGVyaW5nKGxpZ2h0KSkge1xuICAgICAgICAgICAgY29uc3QgZmFjZUNvdW50ID0gbGlnaHQubnVtU2hhZG93RmFjZXM7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBmYWNlc1xuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgIHRoaXMucHJlcGFyZUZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UsIHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhcHBseSB2c21cbiAgICAgICAgICAgIHRoaXMucmVuZGVyVm1zKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyVm1zKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICAvLyBWU00gYmx1ciBpZiBsaWdodCBzdXBwb3J0cyB2c20gKGRpcmVjdGlvbmFsIGFuZCBzcG90IGluIGdlbmVyYWwpXG4gICAgICAgIGlmIChsaWdodC5faXNWc20gJiYgbGlnaHQuX3ZzbUJsdXJTaXplID4gMSkge1xuXG4gICAgICAgICAgICAvLyBpbiBjbHVzdGVyZWQgbW9kZSwgb25seSBkaXJlY3Rpb25hbCBsaWdodCBjYW4gYmUgdm1zXG4gICAgICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCB8fCBsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBseVZzbUJsdXIobGlnaHQsIGNhbWVyYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRWc21CbHVyU2hhZGVyKGlzVnNtOCwgYmx1ck1vZGUsIGZpbHRlclNpemUpIHtcblxuICAgICAgICBsZXQgYmx1clNoYWRlciA9IChpc1ZzbTggPyB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXIgOiB0aGlzLmJsdXJWc21TaGFkZXIpW2JsdXJNb2RlXVtmaWx0ZXJTaXplXTtcbiAgICAgICAgaWYgKCFibHVyU2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmJsdXJWc21XZWlnaHRzW2ZpbHRlclNpemVdID0gZ2F1c3NXZWlnaHRzKGZpbHRlclNpemUpO1xuXG4gICAgICAgICAgICBjb25zdCBibHVyVlMgPSBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUztcbiAgICAgICAgICAgIGxldCBibHVyRlMgPSAnI2RlZmluZSBTQU1QTEVTICcgKyBmaWx0ZXJTaXplICsgJ1xcbic7XG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clBhY2tlZFZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBibHVyRlMgKz0gdGhpcy5ibHVyVnNtU2hhZGVyQ29kZVtibHVyTW9kZV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBibHVyU2hhZGVyTmFtZSA9ICdibHVyVnNtJyArIGJsdXJNb2RlICsgJycgKyBmaWx0ZXJTaXplICsgJycgKyBpc1ZzbTg7XG4gICAgICAgICAgICBibHVyU2hhZGVyID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUodGhpcy5kZXZpY2UsIGJsdXJWUywgYmx1ckZTLCBibHVyU2hhZGVyTmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChpc1ZzbTgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJbYmx1ck1vZGVdW2ZpbHRlclNpemVdID0gYmx1clNoYWRlcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYmx1clNoYWRlcjtcbiAgICB9XG5cbiAgICBhcHBseVZzbUJsdXIobGlnaHQsIGNhbWVyYSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBWU00gJHtsaWdodC5fbm9kZS5uYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IGNhbWVyYSA6IG51bGwsIDApO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuICAgICAgICBjb25zdCBvcmlnU2hhZG93TWFwID0gc2hhZG93Q2FtLnJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyB0ZW1wb3JhcnkgcmVuZGVyIHRhcmdldCBmb3IgYmx1cnJpbmdcbiAgICAgICAgLy8gVE9ETzogdGhpcyBpcyBwcm9iYWJseSBub3Qgb3B0aW1hbCBhbmQgc2hhZG93IG1hcCBjb3VsZCBoYXZlIGRlcHRoIGJ1ZmZlciBvbiBpbiBhZGRpdGlvbiB0byBjb2xvciBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBmb3IgYmx1cnJpbmcgb25seSBvbmUgYnVmZmVyIGlzIG5lZWRlZC5cbiAgICAgICAgY29uc3QgdGVtcFNoYWRvd01hcCA9IHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuZ2V0KGRldmljZSwgbGlnaHQpO1xuICAgICAgICBjb25zdCB0ZW1wUnQgPSB0ZW1wU2hhZG93TWFwLnJlbmRlclRhcmdldHNbMF07XG5cbiAgICAgICAgY29uc3QgaXNWc204ID0gbGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19WU004O1xuICAgICAgICBjb25zdCBibHVyTW9kZSA9IGxpZ2h0LnZzbUJsdXJNb2RlO1xuICAgICAgICBjb25zdCBmaWx0ZXJTaXplID0gbGlnaHQuX3ZzbUJsdXJTaXplO1xuICAgICAgICBjb25zdCBibHVyU2hhZGVyID0gdGhpcy5nZXRWc21CbHVyU2hhZGVyKGlzVnNtOCwgYmx1ck1vZGUsIGZpbHRlclNpemUpO1xuXG4gICAgICAgIGJsdXJTY2lzc29yUmVjdC56ID0gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb24gLSAyO1xuICAgICAgICBibHVyU2Npc3NvclJlY3QudyA9IGJsdXJTY2lzc29yUmVjdC56O1xuXG4gICAgICAgIC8vIEJsdXIgaG9yaXpvbnRhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKG9yaWdTaGFkb3dNYXAuY29sb3JCdWZmZXIpO1xuICAgICAgICBwaXhlbE9mZnNldFswXSA9IDEgLyBsaWdodC5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMV0gPSAwO1xuICAgICAgICB0aGlzLnBpeGVsT2Zmc2V0SWQuc2V0VmFsdWUocGl4ZWxPZmZzZXQpO1xuICAgICAgICBpZiAoYmx1ck1vZGUgPT09IEJMVVJfR0FVU1NJQU4pIHRoaXMud2VpZ2h0SWQuc2V0VmFsdWUodGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSk7XG4gICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRlbXBSdCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyBCbHVyIHZlcnRpY2FsXG4gICAgICAgIHRoaXMuc291cmNlSWQuc2V0VmFsdWUodGVtcFJ0LmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMV0gPSBwaXhlbE9mZnNldFswXTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAwO1xuICAgICAgICB0aGlzLnBpeGVsT2Zmc2V0SWQuc2V0VmFsdWUocGl4ZWxPZmZzZXQpO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCBvcmlnU2hhZG93TWFwLCBibHVyU2hhZGVyLCBudWxsLCBibHVyU2Npc3NvclJlY3QpO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgdGVtcG9yYXJ5IHNoYWRvdyBtYXAgYmFjayB0byB0aGUgY2FjaGVcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zaGFkb3dNYXBDYWNoZS5hZGQobGlnaHQsIHRlbXBTaGFkb3dNYXApO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkb3dSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbImdhdXNzIiwieCIsInNpZ21hIiwiTWF0aCIsImV4cCIsIm1heEJsdXJTaXplIiwiZ2F1c3NXZWlnaHRzIiwia2VybmVsU2l6ZSIsImhhbGZXaWR0aCIsInZhbHVlcyIsIkFycmF5Iiwic3VtIiwiaSIsInNoYWRvd0NhbVZpZXciLCJNYXQ0Iiwic2hhZG93Q2FtVmlld1Byb2oiLCJwaXhlbE9mZnNldCIsIkZsb2F0MzJBcnJheSIsImJsdXJTY2lzc29yUmVjdCIsIlZlYzQiLCJvcENoYW5JZCIsInIiLCJnIiwiYiIsImEiLCJ2aWV3cG9ydE1hdHJpeCIsImdldERlcHRoS2V5IiwibWVzaEluc3RhbmNlIiwibWF0ZXJpYWwiLCJza2luSW5zdGFuY2UiLCJ5Iiwib3BhY2l0eU1hcCIsIm9wQ2hhbiIsIm9wYWNpdHlNYXBDaGFubmVsIiwiU2hhZG93UmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsInJlbmRlcmVyIiwibGlnaHRUZXh0dXJlQXRsYXMiLCJkZXZpY2UiLCJzY29wZSIsInBvbHlnb25PZmZzZXRJZCIsInJlc29sdmUiLCJwb2x5Z29uT2Zmc2V0Iiwic291cmNlSWQiLCJwaXhlbE9mZnNldElkIiwid2VpZ2h0SWQiLCJibHVyVnNtU2hhZGVyQ29kZSIsInNoYWRlckNodW5rcyIsImJsdXJWU01QUyIsInBhY2tlZCIsImJsdXJQYWNrZWRWc21TaGFkZXJDb2RlIiwiYmx1clZzbVNoYWRlciIsImJsdXJQYWNrZWRWc21TaGFkZXIiLCJibHVyVnNtV2VpZ2h0cyIsInNoYWRvd01hcExpZ2h0UmFkaXVzSWQiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJzaGFkb3dUeXBlIiwidHlwZSIsImZhY2UiLCJzaGFkb3dDYW0iLCJMaWdodENhbWVyYSIsImNyZWF0ZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTMyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInNldFNoYWRvd0NhbWVyYVNldHRpbmdzIiwiaXNDbHVzdGVyZWQiLCJod1BjZiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjMiLCJ3ZWJnbDIiLCJMSUdIVFRZUEVfT01OSSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjdWxsU2hhZG93Q2FzdGVycyIsIm1lc2hJbnN0YW5jZXMiLCJ2aXNpYmxlIiwiY2FtZXJhIiwiY291bnQiLCJudW1JbnN0YW5jZXMiLCJsZW5ndGgiLCJjdWxsIiwiX2lzVmlzaWJsZSIsInZpc2libGVUaGlzRnJhbWUiLCJzb3J0Iiwic29ydENvbXBhcmVEZXB0aCIsInNldHVwUmVuZGVyU3RhdGUiLCJsaWdodCIsInNjZW5lIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwiX3R5cGUiLCJzZXREZXB0aEJpYXMiLCJzZXREZXB0aEJpYXNWYWx1ZXMiLCJzaGFkb3dCaWFzIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsInNldFZhbHVlIiwic2V0QmxlbmRpbmciLCJzZXREZXB0aFdyaXRlIiwic2V0RGVwdGhUZXN0Iiwic2V0RGVwdGhGdW5jIiwiRlVOQ19MRVNTRVFVQUwiLCJ1c2VTaGFkb3dTYW1wbGVyIiwiX2lzUGNmIiwic2V0Q29sb3JXcml0ZSIsInJlc3RvcmVSZW5kZXJTdGF0ZSIsImRpc3BhdGNoVW5pZm9ybXMiLCJsaWdodFJlbmRlckRhdGEiLCJzaGFkb3dDYW1Ob2RlIiwiX25vZGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJkaXNwYXRjaFZpZXdQb3MiLCJnZXRQb3NpdGlvbiIsImF0dGVudWF0aW9uRW5kIiwic2V0VFJTIiwiZ2V0Um90YXRpb24iLCJWZWMzIiwiT05FIiwiaW52ZXJ0IiwibXVsMiIsInByb2plY3Rpb25NYXRyaXgiLCJyZWN0Vmlld3BvcnQiLCJzaGFkb3dWaWV3cG9ydCIsInJlY3QiLCJzY2lzc29yUmVjdCIsInNoYWRvd1NjaXNzb3IiLCJzZXRWaWV3cG9ydCIsInoiLCJ3Iiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJzZXQiLCJkYXRhIiwic3VibWl0Q2FzdGVycyIsInZpc2libGVDYXN0ZXJzIiwicGFzc0ZsYWdzIiwiU0hBREVSX1NIQURPVyIsInNoYWRvd1Bhc3MiLCJTaGFkZXJQYXNzIiwiZ2V0U2hhZG93IiwiX3NoYWRvd1R5cGUiLCJtZXNoIiwiZW5zdXJlTWF0ZXJpYWwiLCJzZXRCYXNlQ29uc3RhbnRzIiwic2V0U2tpbm5pbmciLCJkaXJ0eSIsInVwZGF0ZVVuaWZvcm1zIiwiY2h1bmtzIiwic2V0Q3VsbE1vZGUiLCJzZXRQYXJhbWV0ZXJzIiwic2hhZG93U2hhZGVyIiwiX3NoYWRlciIsInVwZGF0ZVBhc3NTaGFkZXIiLCJfa2V5IiwiU09SVEtFWV9ERVBUSCIsImZhaWxlZCIsInNldFNoYWRlciIsIkRlYnVnIiwiZXJyb3IiLCJuYW1lIiwic2V0VmVydGV4QnVmZmVycyIsInNldE1vcnBoaW5nIiwibW9ycGhJbnN0YW5jZSIsInN0eWxlIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwiZHJhd0luc3RhbmNlIiwiX3NoYWRvd0RyYXdDYWxscyIsIm5lZWRzU2hhZG93UmVuZGVyaW5nIiwibmVlZHMiLCJlbmFibGVkIiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJudW1TaGFkb3dGYWNlcyIsImdldExpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzZXR1cFJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwic2hhZG93Q2FtZXJhIiwiY2xlYXJSZW5kZXJUYXJnZXQiLCJydCIsInJlbmRlclRhcmdldCIsImluaXQiLCJjb2xvck9wcyIsImNsZWFyIiwiY2xlYXJWYWx1ZSIsImNvcHkiLCJkZXB0aFN0ZW5jaWxPcHMiLCJzdG9yZURlcHRoIiwic2V0Q2xlYXJEZXB0aCIsInJlcXVpcmVzQ3ViZW1hcHMiLCJwcmVwYXJlRmFjZSIsInJlbmRlclRhcmdldEluZGV4IiwiX3NoYWRvd01hcCIsInJlbmRlclRhcmdldHMiLCJyZW5kZXJGYWNlIiwic2hhZG93TWFwU3RhcnRUaW1lIiwibm93IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzZXRDYW1lcmFVbmlmb3JtcyIsImNsZWFyVmlldyIsInNldHVwVmlld3BvcnQiLCJwb3BHcHVNYXJrZXIiLCJfc2hhZG93TWFwVGltZSIsInJlbmRlciIsImZhY2VDb3VudCIsInJlbmRlclZtcyIsIl9pc1ZzbSIsIl92c21CbHVyU2l6ZSIsImFwcGx5VnNtQmx1ciIsImdldFZzbUJsdXJTaGFkZXIiLCJpc1ZzbTgiLCJibHVyTW9kZSIsImZpbHRlclNpemUiLCJibHVyU2hhZGVyIiwiYmx1clZTIiwiZnVsbHNjcmVlblF1YWRWUyIsImJsdXJGUyIsImJsdXJTaGFkZXJOYW1lIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJvcmlnU2hhZG93TWFwIiwidGVtcFNoYWRvd01hcCIsInNoYWRvd01hcENhY2hlIiwiZ2V0IiwidGVtcFJ0IiwidnNtQmx1ck1vZGUiLCJfc2hhZG93UmVzb2x1dGlvbiIsImNvbG9yQnVmZmVyIiwiQkxVUl9HQVVTU0lBTiIsImRyYXdRdWFkV2l0aFNoYWRlciIsImFkZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3QkEsU0FBU0EsS0FBSyxDQUFDQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtBQUNyQixFQUFBLE9BQU9DLElBQUksQ0FBQ0MsR0FBRyxDQUFDLEVBQUVILENBQUMsR0FBR0EsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHQyxLQUFLLEdBQUdBLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDckQsQ0FBQTtBQUVBLE1BQU1HLFdBQVcsR0FBRyxFQUFFLENBQUE7QUFDdEIsU0FBU0MsWUFBWSxDQUFDQyxVQUFVLEVBQUU7RUFDOUIsSUFBSUEsVUFBVSxHQUFHRixXQUFXLEVBQUU7QUFDMUJF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
