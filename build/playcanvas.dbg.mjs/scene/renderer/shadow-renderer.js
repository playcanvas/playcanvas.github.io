/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Color } from '../../core/math/color.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF3, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { LightCamera } from './light-camera.js';
import { FUNC_LESSEQUAL } from '../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../../platform/graphics/simple-post-effect.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { ShadowMap } from './shadow-map.js';
import { ShadowMapCache } from './shadow-map-cache.js';
import { ShaderPass } from '../shader-pass.js';

const aabbPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];

const _depthRange = {
  min: 0,
  max: 0
};
function getDepthRange(cameraViewMatrix, aabbMin, aabbMax) {
  aabbPoints[0].x = aabbPoints[1].x = aabbPoints[2].x = aabbPoints[3].x = aabbMin.x;
  aabbPoints[1].y = aabbPoints[3].y = aabbPoints[7].y = aabbPoints[5].y = aabbMin.y;
  aabbPoints[2].z = aabbPoints[3].z = aabbPoints[6].z = aabbPoints[7].z = aabbMin.z;
  aabbPoints[4].x = aabbPoints[5].x = aabbPoints[6].x = aabbPoints[7].x = aabbMax.x;
  aabbPoints[0].y = aabbPoints[2].y = aabbPoints[4].y = aabbPoints[6].y = aabbMax.y;
  aabbPoints[0].z = aabbPoints[1].z = aabbPoints[4].z = aabbPoints[5].z = aabbMax.z;
  let minz = 9999999999;
  let maxz = -9999999999;
  for (let i = 0; i < 8; ++i) {
    cameraViewMatrix.transformPoint(aabbPoints[i], aabbPoints[i]);
    const z = aabbPoints[i].z;
    if (z < minz) minz = z;
    if (z > maxz) maxz = z;
  }
  _depthRange.min = minz;
  _depthRange.max = maxz;
  return _depthRange;
}
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
const visibleSceneAabb = new BoundingBox();
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
const center = new Vec3();
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
  constructor(forwardRenderer, lightTextureAtlas) {
    this.device = forwardRenderer.device;

    this.forwardRenderer = forwardRenderer;

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

    this.shadowMapCache = new ShadowMapCache();
  }
  destroy() {
    this.shadowMapCache.destroy();
    this.shadowMapCache = null;
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

    visible.sort(this.forwardRenderer.depthSortCompare);
  }

  cullLocal(light, drawCalls) {
    const isClustered = this.forwardRenderer.scene.clusteredLightingEnabled;

    light.visibleThisFrame = true;

    if (!isClustered) {
      if (!light._shadowMap) {
        light._shadowMap = ShadowMap.create(this.device, light);
      }
    }
    const type = light._type;
    const faceCount = type === LIGHTTYPE_SPOT ? 1 : 6;
    for (let face = 0; face < faceCount; face++) {
      const lightRenderData = light.getRenderData(null, face);
      const shadowCam = lightRenderData.shadowCamera;
      shadowCam.nearClip = light.attenuationEnd / 1000;
      shadowCam.farClip = light.attenuationEnd;
      const shadowCamNode = shadowCam._node;
      const lightNode = light._node;
      shadowCamNode.setPosition(lightNode.getPosition());
      if (type === LIGHTTYPE_SPOT) {
        shadowCam.fov = light._outerConeAngle * 2;

        shadowCamNode.setRotation(lightNode.getRotation());
        shadowCamNode.rotateLocal(-90, 0, 0);
      } else if (type === LIGHTTYPE_OMNI) {
        if (isClustered) {
          const tileSize = this.lightTextureAtlas.shadowAtlasResolution * light.atlasViewport.z / 3;
          const texelSize = 2 / tileSize;
          const filterSize = texelSize * this.lightTextureAtlas.shadowEdgePixels;
          shadowCam.fov = Math.atan(1 + filterSize) * math.RAD_TO_DEG * 2;
        } else {
          shadowCam.fov = 90;
        }
      }

      this.forwardRenderer.updateCameraFrustum(shadowCam);
      this.cullShadowCasters(drawCalls, lightRenderData.visibleCasters, shadowCam);
    }
  }

  generateSplitDistances(light, nearDist, farDist) {
    light._shadowCascadeDistances.fill(farDist);
    for (let i = 1; i < light.numCascades; i++) {
      const fraction = i / light.numCascades;
      const linearDist = nearDist + (farDist - nearDist) * fraction;
      const logDist = nearDist * (farDist / nearDist) ** fraction;
      const dist = math.lerp(linearDist, logDist, light.cascadeDistribution);
      light._shadowCascadeDistances[i - 1] = dist;
    }
  }

  cullDirectional(light, drawCalls, camera) {
    light.visibleThisFrame = true;
    if (!light._shadowMap) {
      light._shadowMap = ShadowMap.create(this.device, light);
    }

    const nearDist = camera._nearClip;
    this.generateSplitDistances(light, nearDist, light.shadowDistance);
    for (let cascade = 0; cascade < light.numCascades; cascade++) {
      const lightRenderData = light.getRenderData(camera, cascade);
      const shadowCam = lightRenderData.shadowCamera;

      shadowCam.renderTarget = light._shadowMap.renderTargets[0];

      lightRenderData.shadowViewport.copy(light.cascades[cascade]);
      lightRenderData.shadowScissor.copy(light.cascades[cascade]);
      const shadowCamNode = shadowCam._node;
      const lightNode = light._node;
      shadowCamNode.setPosition(lightNode.getPosition());

      shadowCamNode.setRotation(lightNode.getRotation());
      shadowCamNode.rotateLocal(-90, 0, 0);

      const frustumNearDist = cascade === 0 ? nearDist : light._shadowCascadeDistances[cascade - 1];
      const frustumFarDist = light._shadowCascadeDistances[cascade];
      const frustumPoints = camera.getFrustumCorners(frustumNearDist, frustumFarDist);
      center.set(0, 0, 0);
      const cameraWorldMat = camera.node.getWorldTransform();
      for (let i = 0; i < 8; i++) {
        cameraWorldMat.transformPoint(frustumPoints[i], frustumPoints[i]);
        center.add(frustumPoints[i]);
      }
      center.mulScalar(1 / 8);

      let radius = 0;
      for (let i = 0; i < 8; i++) {
        const dist = frustumPoints[i].sub(center).length();
        if (dist > radius) radius = dist;
      }

      const right = shadowCamNode.right;
      const up = shadowCamNode.up;
      const lightDir = shadowCamNode.forward;

      const sizeRatio = 0.25 * light._shadowResolution / radius;
      const x = Math.ceil(center.dot(up) * sizeRatio) / sizeRatio;
      const y = Math.ceil(center.dot(right) * sizeRatio) / sizeRatio;
      const scaledUp = up.mulScalar(x);
      const scaledRight = right.mulScalar(y);
      const dot = center.dot(lightDir);
      const scaledDir = lightDir.mulScalar(dot);
      center.add2(scaledUp, scaledRight).add(scaledDir);

      shadowCamNode.setPosition(center);
      shadowCamNode.translateLocal(0, 0, 1000000);
      shadowCam.nearClip = 0;
      shadowCam.farClip = 2000000;
      shadowCam.orthoHeight = radius;

      this.forwardRenderer.updateCameraFrustum(shadowCam);
      this.cullShadowCasters(drawCalls, lightRenderData.visibleCasters, shadowCam);

      let emptyAabb = true;
      const visibleCasters = lightRenderData.visibleCasters;
      for (let i = 0; i < visibleCasters.length; i++) {
        const meshInstance = visibleCasters[i];
        if (emptyAabb) {
          emptyAabb = false;
          visibleSceneAabb.copy(meshInstance.aabb);
        } else {
          visibleSceneAabb.add(meshInstance.aabb);
        }
      }

      shadowCamView.copy(shadowCamNode.getWorldTransform()).invert();
      const depthRange = getDepthRange(shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax());

      shadowCamNode.translateLocal(0, 0, depthRange.max + 0.1);
      shadowCam.farClip = depthRange.max - depthRange.min + 0.2;
    }
  }
  setupRenderState(device, light) {
    const isClustered = this.forwardRenderer.scene.clusteredLightingEnabled;

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
      this.forwardRenderer.dispatchViewPos(shadowCamNode.getPosition());
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
    const forwardRenderer = this.forwardRenderer;
    const scene = forwardRenderer.scene;
    const passFlags = 1 << SHADER_SHADOW;

    const shadowPass = ShaderPass.getShadow(light._type, light._shadowType);

    const count = visibleCasters.length;
    for (let i = 0; i < count; i++) {
      const meshInstance = visibleCasters[i];
      const mesh = meshInstance.mesh;
      meshInstance.ensureMaterial(device);
      const material = meshInstance.material;

      forwardRenderer.setBaseConstants(device, material);
      forwardRenderer.setSkinning(device, meshInstance, material);
      if (material.dirty) {
        material.updateUniforms(device, scene);
        material.dirty = false;
      }
      if (material.chunks) {
        forwardRenderer.setCullMode(true, false, meshInstance);

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

      forwardRenderer.setVertexBuffers(device, mesh);
      forwardRenderer.setMorphing(device, meshInstance.morphInstance);
      const style = meshInstance.renderStyle;
      device.setIndexBuffer(mesh.indexBuffer[style]);

      forwardRenderer.drawInstance(device, meshInstance, mesh, style);
      forwardRenderer._shadowDrawCalls++;
    }
  }
  render(light, camera) {
    if (light.enabled && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame) {
      const device = this.device;
      if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
        light.shadowUpdateMode = SHADOWUPDATE_NONE;
      }
      const type = light._type;
      const shadowType = light._shadowType;
      const faceCount = light.numShadowFaces;
      const forwardRenderer = this.forwardRenderer;
      forwardRenderer._shadowMapUpdates += faceCount;
      const isClustered = forwardRenderer.scene.clusteredLightingEnabled;
      DebugGraphics.pushGpuMarker(device, `SHADOW ${light._node.name}`);
      this.setupRenderState(device, light);
      for (let face = 0; face < faceCount; face++) {
        DebugGraphics.pushGpuMarker(device, `FACE ${face}`);

        const lightRenderData = light.getRenderData(type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
        const shadowCam = lightRenderData.shadowCamera;

        ShadowRenderer.setShadowCameraSettings(shadowCam, device, shadowType, type, isClustered);

        const renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
        shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];
        this.dispatchUniforms(light, shadowCam, lightRenderData, face);
        forwardRenderer.setCamera(shadowCam, shadowCam.renderTarget, true);

        this.submitCasters(lightRenderData.visibleCasters, light);
        DebugGraphics.popGpuMarker(device);
      }

      if (light._isVsm && light._vsmBlurSize > 1) {
        const _isClustered = this.forwardRenderer.scene.clusteredLightingEnabled;
        if (!_isClustered || type === LIGHTTYPE_DIRECTIONAL) {
          this.applyVsmBlur(light, camera);
        }
      }
      this.restoreRenderState(device);
      DebugGraphics.popGpuMarker(device);
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
    DebugGraphics.pushGpuMarker(device, 'VSM');
    const lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
    const shadowCam = lightRenderData.shadowCamera;
    const origShadowMap = shadowCam.renderTarget;

    const tempShadowMap = this.shadowMapCache.get(device, light);
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

    this.shadowMapCache.add(light, tempShadowMap);
    DebugGraphics.popGpuMarker(device);
  }
}

export { ShadowRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsXG4gICAgU0hBREVSX1NIQURPVyxcbiAgICBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMzIsXG4gICAgU0hBRE9XVVBEQVRFX05PTkUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgU09SVEtFWV9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5cbmltcG9ydCB7IEZVTkNfTEVTU0VRVUFMIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NpbXBsZS1wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBTaGFkb3dNYXAgfSBmcm9tICcuL3NoYWRvdy1tYXAuanMnO1xuaW1wb3J0IHsgU2hhZG93TWFwQ2FjaGUgfSBmcm9tICcuL3NoYWRvdy1tYXAtY2FjaGUuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uL3NoYWRlci1wYXNzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IE1lc2hJbnN0YW5jZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IExpZ2h0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9mb3J3YXJkLXJlbmRlcmVyLmpzJykuRm9yd2FyZFJlbmRlcmVyfSBGb3J3YXJkUmVuZGVyZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9IExpZ2h0VGV4dHVyZUF0bGFzICovXG5cbmNvbnN0IGFhYmJQb2ludHMgPSBbXG4gICAgbmV3IFZlYzMoKSwgbmV3IFZlYzMoKSwgbmV3IFZlYzMoKSwgbmV3IFZlYzMoKSxcbiAgICBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXG5dO1xuXG4vLyBldmFsdWF0ZSBkZXB0aCByYW5nZSB0aGUgYWFiYiB0YWtlcyBpbiB0aGUgc3BhY2Ugb2YgdGhlIGNhbWVyYVxuY29uc3QgX2RlcHRoUmFuZ2UgPSB7IG1pbjogMCwgbWF4OiAwIH07XG5mdW5jdGlvbiBnZXREZXB0aFJhbmdlKGNhbWVyYVZpZXdNYXRyaXgsIGFhYmJNaW4sIGFhYmJNYXgpIHtcbiAgICBhYWJiUG9pbnRzWzBdLnggPSBhYWJiUG9pbnRzWzFdLnggPSBhYWJiUG9pbnRzWzJdLnggPSBhYWJiUG9pbnRzWzNdLnggPSBhYWJiTWluLng7XG4gICAgYWFiYlBvaW50c1sxXS55ID0gYWFiYlBvaW50c1szXS55ID0gYWFiYlBvaW50c1s3XS55ID0gYWFiYlBvaW50c1s1XS55ID0gYWFiYk1pbi55O1xuICAgIGFhYmJQb2ludHNbMl0ueiA9IGFhYmJQb2ludHNbM10ueiA9IGFhYmJQb2ludHNbNl0ueiA9IGFhYmJQb2ludHNbN10ueiA9IGFhYmJNaW4uejtcbiAgICBhYWJiUG9pbnRzWzRdLnggPSBhYWJiUG9pbnRzWzVdLnggPSBhYWJiUG9pbnRzWzZdLnggPSBhYWJiUG9pbnRzWzddLnggPSBhYWJiTWF4Lng7XG4gICAgYWFiYlBvaW50c1swXS55ID0gYWFiYlBvaW50c1syXS55ID0gYWFiYlBvaW50c1s0XS55ID0gYWFiYlBvaW50c1s2XS55ID0gYWFiYk1heC55O1xuICAgIGFhYmJQb2ludHNbMF0ueiA9IGFhYmJQb2ludHNbMV0ueiA9IGFhYmJQb2ludHNbNF0ueiA9IGFhYmJQb2ludHNbNV0ueiA9IGFhYmJNYXguejtcblxuICAgIGxldCBtaW56ID0gOTk5OTk5OTk5OTtcbiAgICBsZXQgbWF4eiA9IC05OTk5OTk5OTk5O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCA4OyArK2kpIHtcbiAgICAgICAgY2FtZXJhVmlld01hdHJpeC50cmFuc2Zvcm1Qb2ludChhYWJiUG9pbnRzW2ldLCBhYWJiUG9pbnRzW2ldKTtcbiAgICAgICAgY29uc3QgeiA9IGFhYmJQb2ludHNbaV0uejtcbiAgICAgICAgaWYgKHogPCBtaW56KSBtaW56ID0gejtcbiAgICAgICAgaWYgKHogPiBtYXh6KSBtYXh6ID0gejtcbiAgICB9XG5cbiAgICBfZGVwdGhSYW5nZS5taW4gPSBtaW56O1xuICAgIF9kZXB0aFJhbmdlLm1heCA9IG1heHo7XG4gICAgcmV0dXJuIF9kZXB0aFJhbmdlO1xufVxuXG5mdW5jdGlvbiBnYXVzcyh4LCBzaWdtYSkge1xuICAgIHJldHVybiBNYXRoLmV4cCgtKHggKiB4KSAvICgyLjAgKiBzaWdtYSAqIHNpZ21hKSk7XG59XG5cbmNvbnN0IG1heEJsdXJTaXplID0gMjU7XG5mdW5jdGlvbiBnYXVzc1dlaWdodHMoa2VybmVsU2l6ZSkge1xuICAgIGlmIChrZXJuZWxTaXplID4gbWF4Qmx1clNpemUpIHtcbiAgICAgICAga2VybmVsU2l6ZSA9IG1heEJsdXJTaXplO1xuICAgIH1cbiAgICBjb25zdCBzaWdtYSA9IChrZXJuZWxTaXplIC0gMSkgLyAoMiAqIDMpO1xuXG4gICAgY29uc3QgaGFsZldpZHRoID0gKGtlcm5lbFNpemUgLSAxKSAqIDAuNTtcbiAgICBjb25zdCB2YWx1ZXMgPSBuZXcgQXJyYXkoa2VybmVsU2l6ZSk7XG4gICAgbGV0IHN1bSA9IDAuMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gPSBnYXVzcyhpIC0gaGFsZldpZHRoLCBzaWdtYSk7XG4gICAgICAgIHN1bSArPSB2YWx1ZXNbaV07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXJuZWxTaXplOyArK2kpIHtcbiAgICAgICAgdmFsdWVzW2ldIC89IHN1bTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn1cblxuY29uc3QgdmlzaWJsZVNjZW5lQWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuY29uc3Qgc2hhZG93Q2FtVmlldyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBzaGFkb3dDYW1WaWV3UHJvaiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBwaXhlbE9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5jb25zdCBibHVyU2Npc3NvclJlY3QgPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTtcbmNvbnN0IG9wQ2hhbklkID0geyByOiAxLCBnOiAyLCBiOiAzLCBhOiA0IH07XG5jb25zdCBjZW50ZXIgPSBuZXcgVmVjMygpO1xuY29uc3Qgdmlld3BvcnRNYXRyaXggPSBuZXcgTWF0NCgpO1xuXG5mdW5jdGlvbiBnZXREZXB0aEtleShtZXNoSW5zdGFuY2UpIHtcbiAgICBjb25zdCBtYXRlcmlhbCA9IG1lc2hJbnN0YW5jZS5tYXRlcmlhbDtcbiAgICBjb25zdCB4ID0gbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA/IDEwIDogMDtcbiAgICBsZXQgeSA9IDA7XG4gICAgaWYgKG1hdGVyaWFsLm9wYWNpdHlNYXApIHtcbiAgICAgICAgY29uc3Qgb3BDaGFuID0gbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWw7XG4gICAgICAgIGlmIChvcENoYW4pIHtcbiAgICAgICAgICAgIHkgPSBvcENoYW5JZFtvcENoYW5dO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB4ICsgeTtcbn1cblxuLyoqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFNoYWRvd1JlbmRlcmVyIHtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZvcndhcmRSZW5kZXJlcn0gZm9yd2FyZFJlbmRlcmVyIC0gVGhlIGZvcndhcmQgcmVuZGVyZXIuXG4gICAgICogQHBhcmFtIHtMaWdodFRleHR1cmVBdGxhc30gbGlnaHRUZXh0dXJlQXRsYXMgLSBUaGUgc2hhZG93IG1hcCBhdGxhcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihmb3J3YXJkUmVuZGVyZXIsIGxpZ2h0VGV4dHVyZUF0bGFzKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZm9yd2FyZFJlbmRlcmVyLmRldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge0ZvcndhcmRSZW5kZXJlcn0gKi9cbiAgICAgICAgdGhpcy5mb3J3YXJkUmVuZGVyZXIgPSBmb3J3YXJkUmVuZGVyZXI7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtMaWdodFRleHR1cmVBdGxhc30gKi9cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IGxpZ2h0VGV4dHVyZUF0bGFzO1xuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQgPSBzY29wZS5yZXNvbHZlKCdwb2x5Z29uT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgLy8gVlNNXG4gICAgICAgIHRoaXMuc291cmNlSWQgPSBzY29wZS5yZXNvbHZlKCdzb3VyY2UnKTtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncGl4ZWxPZmZzZXQnKTtcbiAgICAgICAgdGhpcy53ZWlnaHRJZCA9IHNjb3BlLnJlc29sdmUoJ3dlaWdodFswXScpO1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXJDb2RlID0gW3NoYWRlckNodW5rcy5ibHVyVlNNUFMsICcjZGVmaW5lIEdBVVNTXFxuJyArIHNoYWRlckNodW5rcy5ibHVyVlNNUFNdO1xuICAgICAgICBjb25zdCBwYWNrZWQgPSAnI2RlZmluZSBQQUNLRURcXG4nO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlID0gW3BhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMF0sIHBhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMV1dO1xuXG4gICAgICAgIC8vIGNhY2hlIGZvciB2c20gYmx1ciBzaGFkZXJzXG4gICAgICAgIHRoaXMuYmx1clZzbVNoYWRlciA9IFt7fSwge31dO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXIgPSBbe30sIHt9XTtcblxuICAgICAgICB0aGlzLmJsdXJWc21XZWlnaHRzID0ge307XG5cbiAgICAgICAgLy8gdW5pZm9ybXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfcmFkaXVzJyk7XG5cbiAgICAgICAgLy8gc2hhZG93IG1hcCBjYWNoZVxuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbmV3IFNoYWRvd01hcENhY2hlKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZXMgc2hhZG93IGNhbWVyYSBmb3IgYSBsaWdodCBhbmQgc2V0cyB1cCBpdHMgY29uc3RhbnQgcHJvcGVydGllc1xuICAgIHN0YXRpYyBjcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gTGlnaHRDYW1lcmEuY3JlYXRlKCdTaGFkb3dDYW1lcmEnLCB0eXBlLCBmYWNlKTtcblxuICAgICAgICAvLyBkb24ndCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIGlmIHJlbmRlcmluZyBhIGRlcHRoIG1hcFxuICAgICAgICBpZiAoc2hhZG93VHlwZSA+PSBTSEFET1dfVlNNOCAmJiBzaGFkb3dUeXBlIDw9IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRvd0NhbS5jbGVhckRlcHRoQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgc3RhdGljIHNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCkge1xuXG4gICAgICAgIC8vIG5vcm1hbCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIGVuY29kZSBkZXB0aCBpbiBSR0JBOCBhbmQgZG8gbWFudWFsIFBDRiBzYW1wbGluZ1xuICAgICAgICAvLyBjbHVzdGVyZWQgb21uaSBzaGFkb3dzIG9uIHdlYmdsMiB1c2UgZGVwdGggZm9ybWF0IGFuZCBoYXJkd2FyZSBQQ0Ygc2FtcGxpbmdcbiAgICAgICAgbGV0IGh3UGNmID0gc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUgfHwgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmIGRldmljZS53ZWJnbDIpO1xuICAgICAgICBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICBod1BjZiA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3JCdWZmZXIgPSAhaHdQY2Y7XG4gICAgfVxuXG4gICAgLy8gY3VsbHMgdGhlIGxpc3Qgb2YgbWVzaGVzIGluc3RhbmNlcyBieSB0aGUgY2FtZXJhLCBzdG9yaW5nIHZpc2libGUgbWVzaCBpbnN0YW5jZXMgaW4gdGhlIHNwZWNpZmllZCBhcnJheVxuICAgIGN1bGxTaGFkb3dDYXN0ZXJzKG1lc2hJbnN0YW5jZXMsIHZpc2libGUsIGNhbWVyYSkge1xuXG4gICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG51bUluc3RhbmNlcyA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUluc3RhbmNlczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSBtZXNoSW5zdGFuY2VzW2ldO1xuXG4gICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZS5jdWxsIHx8IG1lc2hJbnN0YW5jZS5faXNWaXNpYmxlKGNhbWVyYSkpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdmlzaWJsZVtjb3VudF0gPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZpc2libGUubGVuZ3RoID0gY291bnQ7XG5cbiAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIHByb2JhYmx5IHNvcnQgc2hhZG93IG1lc2hlcyBieSBzaGFkZXIgYW5kIG5vdCBkZXB0aFxuICAgICAgICB2aXNpYmxlLnNvcnQodGhpcy5mb3J3YXJkUmVuZGVyZXIuZGVwdGhTb3J0Q29tcGFyZSk7XG4gICAgfVxuXG4gICAgLy8gY3VsbCBsb2NhbCBzaGFkb3cgbWFwXG4gICAgY3VsbExvY2FsKGxpZ2h0LCBkcmF3Q2FsbHMpIHtcblxuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMuZm9yd2FyZFJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICAvLyBmb3JjZSBsaWdodCB2aXNpYmlsaXR5IGlmIGZ1bmN0aW9uIHdhcyBtYW51YWxseSBjYWxsZWRcbiAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgc2hhZG93IG1hcCB1bmxlc3MgaW4gY2x1c3RlcmVkIGxpZ2h0aW5nIG1vZGVcbiAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgaWYgKCFsaWdodC5fc2hhZG93TWFwKSB7XG4gICAgICAgICAgICAgICAgbGlnaHQuX3NoYWRvd01hcCA9IFNoYWRvd01hcC5jcmVhdGUodGhpcy5kZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHR5cGUgPSBsaWdodC5fdHlwZTtcbiAgICAgICAgY29uc3QgZmFjZUNvdW50ID0gdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QgPyAxIDogNjtcblxuICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IGZhY2VDb3VudDsgZmFjZSsrKSB7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBkYXRhIGFyZSBzaGFyZWQgYmV0d2VlbiBjYW1lcmFzIGZvciBsb2NhbCBsaWdodHMsIHNvIHBhc3MgbnVsbCBmb3IgY2FtZXJhXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKG51bGwsIGZhY2UpO1xuICAgICAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICAgICAgc2hhZG93Q2FtLm5lYXJDbGlwID0gbGlnaHQuYXR0ZW51YXRpb25FbmQgLyAxMDAwO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZhckNsaXAgPSBsaWdodC5hdHRlbnVhdGlvbkVuZDtcblxuICAgICAgICAgICAgY29uc3Qgc2hhZG93Q2FtTm9kZSA9IHNoYWRvd0NhbS5fbm9kZTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0Tm9kZSA9IGxpZ2h0Ll9ub2RlO1xuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5zZXRQb3NpdGlvbihsaWdodE5vZGUuZ2V0UG9zaXRpb24oKSk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgIHNoYWRvd0NhbS5mb3YgPSBsaWdodC5fb3V0ZXJDb25lQW5nbGUgKiAyO1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FtZXJhIGxvb2tzIGRvd24gdGhlIG5lZ2F0aXZlIFosIGFuZCBzcG90IGxpZ2h0IHBvaW50cyBkb3duIHRoZSBuZWdhdGl2ZSBZXG4gICAgICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5zZXRSb3RhdGlvbihsaWdodE5vZGUuZ2V0Um90YXRpb24oKSk7XG4gICAgICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5yb3RhdGVMb2NhbCgtOTAsIDAsIDApO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB3aGVuIHJlbmRlcmluZyBvbW5pIHNoYWRvd3MgdG8gYW4gYXRsYXMsIHVzZSBsYXJnZXIgZm92IGJ5IGZldyBwaXhlbHMgdG8gYWxsb3cgc2hhZG93IGZpbHRlcmluZyB0byBzdGF5IG9uIGEgc2luZ2xlIGZhY2VcbiAgICAgICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlsZVNpemUgPSB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLnNoYWRvd0F0bGFzUmVzb2x1dGlvbiAqIGxpZ2h0LmF0bGFzVmlld3BvcnQueiAvIDM7ICAgIC8vIHVzaW5nIDN4MyBmb3IgY3ViZW1hcFxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXhlbFNpemUgPSAyIC8gdGlsZVNpemU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbHRlclNpemUgPSB0ZXhlbFNpemUgKiB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLnNoYWRvd0VkZ2VQaXhlbHM7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd0NhbS5mb3YgPSBNYXRoLmF0YW4oMSArIGZpbHRlclNpemUpICogbWF0aC5SQURfVE9fREVHICogMjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzaGFkb3dDYW0uZm92ID0gOTA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjdWxsIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgICAgICB0aGlzLmZvcndhcmRSZW5kZXJlci51cGRhdGVDYW1lcmFGcnVzdHVtKHNoYWRvd0NhbSk7XG4gICAgICAgICAgICB0aGlzLmN1bGxTaGFkb3dDYXN0ZXJzKGRyYXdDYWxscywgbGlnaHRSZW5kZXJEYXRhLnZpc2libGVDYXN0ZXJzLCBzaGFkb3dDYW0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gdG8gZ2VuZXJhdGUgZnJ1c3R1bSBzcGxpdCBkaXN0YW5jZXNcbiAgICBnZW5lcmF0ZVNwbGl0RGlzdGFuY2VzKGxpZ2h0LCBuZWFyRGlzdCwgZmFyRGlzdCkge1xuXG4gICAgICAgIGxpZ2h0Ll9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzLmZpbGwoZmFyRGlzdCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgbGlnaHQubnVtQ2FzY2FkZXM7IGkrKykge1xuXG4gICAgICAgICAgICAvLyAgbGVycCBiZXR3ZWVuIGxpbmVhciBhbmQgbG9nYXJpdGhtaWMgZGlzdGFuY2UsIGNhbGxlZCBwcmFjdGljYWwgc3BsaXQgZGlzdGFuY2VcbiAgICAgICAgICAgIGNvbnN0IGZyYWN0aW9uID0gaSAvIGxpZ2h0Lm51bUNhc2NhZGVzO1xuICAgICAgICAgICAgY29uc3QgbGluZWFyRGlzdCA9IG5lYXJEaXN0ICsgKGZhckRpc3QgLSBuZWFyRGlzdCkgKiBmcmFjdGlvbjtcbiAgICAgICAgICAgIGNvbnN0IGxvZ0Rpc3QgPSBuZWFyRGlzdCAqIChmYXJEaXN0IC8gbmVhckRpc3QpICoqIGZyYWN0aW9uO1xuICAgICAgICAgICAgY29uc3QgZGlzdCA9IG1hdGgubGVycChsaW5lYXJEaXN0LCBsb2dEaXN0LCBsaWdodC5jYXNjYWRlRGlzdHJpYnV0aW9uKTtcbiAgICAgICAgICAgIGxpZ2h0Ll9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzW2kgLSAxXSA9IGRpc3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjdWxsIGRpcmVjdGlvbmFsIHNoYWRvdyBtYXBcbiAgICBjdWxsRGlyZWN0aW9uYWwobGlnaHQsIGRyYXdDYWxscywgY2FtZXJhKSB7XG5cbiAgICAgICAgLy8gZm9yY2UgbGlnaHQgdmlzaWJpbGl0eSBpZiBmdW5jdGlvbiB3YXMgbWFudWFsbHkgY2FsbGVkXG4gICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuXG4gICAgICAgIGlmICghbGlnaHQuX3NoYWRvd01hcCkge1xuICAgICAgICAgICAgbGlnaHQuX3NoYWRvd01hcCA9IFNoYWRvd01hcC5jcmVhdGUodGhpcy5kZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdlbmVyYXRlIHNwbGl0cyBmb3IgdGhlIGNhc2NhZGVzXG4gICAgICAgIGNvbnN0IG5lYXJEaXN0ID0gY2FtZXJhLl9uZWFyQ2xpcDtcbiAgICAgICAgdGhpcy5nZW5lcmF0ZVNwbGl0RGlzdGFuY2VzKGxpZ2h0LCBuZWFyRGlzdCwgbGlnaHQuc2hhZG93RGlzdGFuY2UpO1xuXG4gICAgICAgIGZvciAobGV0IGNhc2NhZGUgPSAwOyBjYXNjYWRlIDwgbGlnaHQubnVtQ2FzY2FkZXM7IGNhc2NhZGUrKykge1xuXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKGNhbWVyYSwgY2FzY2FkZSk7XG4gICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgICAgICAvLyBhc3NpZ24gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgLy8gTm90ZTogdGhpcyBpcyBkb25lIGR1cmluZyByZW5kZXJpbmcgZm9yIGFsbCBzaGFkb3cgbWFwcywgYnV0IGRvIGl0IGhlcmUgZm9yIHRoZSBjYXNlIHNoYWRvdyByZW5kZXJpbmcgZm9yIHRoZSBkaXJlY3Rpb25hbCBsaWdodFxuICAgICAgICAgICAgLy8gaXMgZGlzYWJsZWQgLSB3ZSBuZWVkIHNoYWRvdyBtYXAgdG8gYmUgYXNzaWduZWQgZm9yIHJlbmRlcmluZyB0byB3b3JrIGV2ZW4gaW4gdGhpcyBjYXNlLiBUaGlzIG5lZWRzIGZ1cnRoZXIgcmVmYWN0b3JpbmcgLSBhcyB3aGVuXG4gICAgICAgICAgICAvLyBzaGFkb3cgcmVuZGVyaW5nIGlzIHNldCB0byBTSEFET1dVUERBVEVfTk9ORSwgd2Ugc2hvdWxkIG5vdCBldmVuIGV4ZWN1dGUgc2hhZG93IG1hcCBjdWxsaW5nXG4gICAgICAgICAgICBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0ID0gbGlnaHQuX3NoYWRvd01hcC5yZW5kZXJUYXJnZXRzWzBdO1xuXG4gICAgICAgICAgICAvLyB2aWV3cG9ydFxuICAgICAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1ZpZXdwb3J0LmNvcHkobGlnaHQuY2FzY2FkZXNbY2FzY2FkZV0pO1xuICAgICAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1NjaXNzb3IuY29weShsaWdodC5jYXNjYWRlc1tjYXNjYWRlXSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG4gICAgICAgICAgICBjb25zdCBsaWdodE5vZGUgPSBsaWdodC5fbm9kZTtcblxuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5zZXRQb3NpdGlvbihsaWdodE5vZGUuZ2V0UG9zaXRpb24oKSk7XG5cbiAgICAgICAgICAgIC8vIENhbWVyYSBsb29rcyBkb3duIHRoZSBuZWdhdGl2ZSBaLCBhbmQgZGlyZWN0aW9uYWwgbGlnaHQgcG9pbnRzIGRvd24gdGhlIG5lZ2F0aXZlIFlcbiAgICAgICAgICAgIHNoYWRvd0NhbU5vZGUuc2V0Um90YXRpb24obGlnaHROb2RlLmdldFJvdGF0aW9uKCkpO1xuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5yb3RhdGVMb2NhbCgtOTAsIDAsIDApO1xuXG4gICAgICAgICAgICAvLyBnZXQgY2FtZXJhJ3MgZnJ1c3R1bSBjb3JuZXJzIGZvciB0aGUgY2FzY2FkZSwgY29udmVydCB0aGVtIHRvIHdvcmxkIHNwYWNlIGFuZCBmaW5kIHRoZWlyIGNlbnRlclxuICAgICAgICAgICAgY29uc3QgZnJ1c3R1bU5lYXJEaXN0ID0gY2FzY2FkZSA9PT0gMCA/IG5lYXJEaXN0IDogbGlnaHQuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbY2FzY2FkZSAtIDFdO1xuICAgICAgICAgICAgY29uc3QgZnJ1c3R1bUZhckRpc3QgPSBsaWdodC5fc2hhZG93Q2FzY2FkZURpc3RhbmNlc1tjYXNjYWRlXTtcbiAgICAgICAgICAgIGNvbnN0IGZydXN0dW1Qb2ludHMgPSBjYW1lcmEuZ2V0RnJ1c3R1bUNvcm5lcnMoZnJ1c3R1bU5lYXJEaXN0LCBmcnVzdHVtRmFyRGlzdCk7XG4gICAgICAgICAgICBjZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhV29ybGRNYXQgPSBjYW1lcmEubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjYW1lcmFXb3JsZE1hdC50cmFuc2Zvcm1Qb2ludChmcnVzdHVtUG9pbnRzW2ldLCBmcnVzdHVtUG9pbnRzW2ldKTtcbiAgICAgICAgICAgICAgICBjZW50ZXIuYWRkKGZydXN0dW1Qb2ludHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2VudGVyLm11bFNjYWxhcigxIC8gOCk7XG5cbiAgICAgICAgICAgIC8vIHJhZGl1cyBvZiB0aGUgd29ybGQgc3BhY2UgYm91bmRpbmcgc3BoZXJlIGZvciB0aGUgZnJ1c3R1bSBzbGljZVxuICAgICAgICAgICAgbGV0IHJhZGl1cyA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3QgPSBmcnVzdHVtUG9pbnRzW2ldLnN1YihjZW50ZXIpLmxlbmd0aCgpO1xuICAgICAgICAgICAgICAgIGlmIChkaXN0ID4gcmFkaXVzKVxuICAgICAgICAgICAgICAgICAgICByYWRpdXMgPSBkaXN0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBheGlzIG9mIGxpZ2h0IGNvb3JkaW5hdGUgc3lzdGVtXG4gICAgICAgICAgICBjb25zdCByaWdodCA9IHNoYWRvd0NhbU5vZGUucmlnaHQ7XG4gICAgICAgICAgICBjb25zdCB1cCA9IHNoYWRvd0NhbU5vZGUudXA7XG4gICAgICAgICAgICBjb25zdCBsaWdodERpciA9IHNoYWRvd0NhbU5vZGUuZm9yd2FyZDtcblxuICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHRoZSBzcGhlcmUncyBjZW50ZXIgaW50byB0aGUgY2VudGVyIG9mIHRoZSBzaGFkb3cgbWFwLCBwaXhlbCBhbGlnbmVkLlxuICAgICAgICAgICAgLy8gdGhpcyBtYWtlcyB0aGUgc2hhZG93IG1hcCBzdGFibGUgYW5kIGF2b2lkcyBzaGltbWVyaW5nIG9uIHRoZSBlZGdlcyB3aGVuIHRoZSBjYW1lcmEgbW92ZXNcbiAgICAgICAgICAgIGNvbnN0IHNpemVSYXRpbyA9IDAuMjUgKiBsaWdodC5fc2hhZG93UmVzb2x1dGlvbiAvIHJhZGl1cztcbiAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLmNlaWwoY2VudGVyLmRvdCh1cCkgKiBzaXplUmF0aW8pIC8gc2l6ZVJhdGlvO1xuICAgICAgICAgICAgY29uc3QgeSA9IE1hdGguY2VpbChjZW50ZXIuZG90KHJpZ2h0KSAqIHNpemVSYXRpbykgLyBzaXplUmF0aW87XG5cbiAgICAgICAgICAgIGNvbnN0IHNjYWxlZFVwID0gdXAubXVsU2NhbGFyKHgpO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVkUmlnaHQgPSByaWdodC5tdWxTY2FsYXIoeSk7XG4gICAgICAgICAgICBjb25zdCBkb3QgPSBjZW50ZXIuZG90KGxpZ2h0RGlyKTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlZERpciA9IGxpZ2h0RGlyLm11bFNjYWxhcihkb3QpO1xuICAgICAgICAgICAgY2VudGVyLmFkZDIoc2NhbGVkVXAsIHNjYWxlZFJpZ2h0KS5hZGQoc2NhbGVkRGlyKTtcblxuICAgICAgICAgICAgLy8gbG9vayBhdCB0aGUgY2VudGVyIGZyb20gZmFyIGF3YXkgdG8gaW5jbHVkZSBhbGwgY2FzdGVycyBkdXJpbmcgY3VsbGluZ1xuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5zZXRQb3NpdGlvbihjZW50ZXIpO1xuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS50cmFuc2xhdGVMb2NhbCgwLCAwLCAxMDAwMDAwKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5uZWFyQ2xpcCA9IDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZmFyQ2xpcCA9IDIwMDAwMDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0ub3J0aG9IZWlnaHQgPSByYWRpdXM7XG5cbiAgICAgICAgICAgIC8vIGN1bGwgc2hhZG93IGNhc3RlcnNcbiAgICAgICAgICAgIHRoaXMuZm9yd2FyZFJlbmRlcmVyLnVwZGF0ZUNhbWVyYUZydXN0dW0oc2hhZG93Q2FtKTtcbiAgICAgICAgICAgIHRoaXMuY3VsbFNoYWRvd0Nhc3RlcnMoZHJhd0NhbGxzLCBsaWdodFJlbmRlckRhdGEudmlzaWJsZUNhc3RlcnMsIHNoYWRvd0NhbSk7XG5cbiAgICAgICAgICAgIC8vIGZpbmQgb3V0IEFBQkIgb2YgdmlzaWJsZSBzaGFkb3cgY2FzdGVyc1xuICAgICAgICAgICAgbGV0IGVtcHR5QWFiYiA9IHRydWU7XG4gICAgICAgICAgICBjb25zdCB2aXNpYmxlQ2FzdGVycyA9IGxpZ2h0UmVuZGVyRGF0YS52aXNpYmxlQ2FzdGVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaWJsZUNhc3RlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB2aXNpYmxlQ2FzdGVyc1tpXTtcblxuICAgICAgICAgICAgICAgIGlmIChlbXB0eUFhYmIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1wdHlBYWJiID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVTY2VuZUFhYmIuY29weShtZXNoSW5zdGFuY2UuYWFiYik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZVNjZW5lQWFiYi5hZGQobWVzaEluc3RhbmNlLmFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGRlcHRoIHJhbmdlIG9mIHRoZSBjYXN0ZXIncyBBQUJCIGZyb20gdGhlIHBvaW50IG9mIHZpZXcgb2YgdGhlIHNoYWRvdyBjYW1lcmFcbiAgICAgICAgICAgIHNoYWRvd0NhbVZpZXcuY29weShzaGFkb3dDYW1Ob2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpLmludmVydCgpO1xuICAgICAgICAgICAgY29uc3QgZGVwdGhSYW5nZSA9IGdldERlcHRoUmFuZ2Uoc2hhZG93Q2FtVmlldywgdmlzaWJsZVNjZW5lQWFiYi5nZXRNaW4oKSwgdmlzaWJsZVNjZW5lQWFiYi5nZXRNYXgoKSk7XG5cbiAgICAgICAgICAgIC8vIGFkanVzdCBzaGFkb3cgY2FtZXJhJ3MgbmVhciBhbmQgZmFyIHBsYW5lIHRvIHRoZSBkZXB0aCByYW5nZSBvZiBjYXN0ZXJzIHRvIG1heGltaXplIHByZWNpc2lvblxuICAgICAgICAgICAgLy8gb2YgdmFsdWVzIHN0b3JlZCBpbiB0aGUgc2hhZG93IG1hcC4gTWFrZSBpdCBzbGlnaHRseSBsYXJnZXIgdG8gYXZvaWQgY2xpcHBpbmcgb24gbmVhciAvIGZhciBwbGFuZS5cbiAgICAgICAgICAgIHNoYWRvd0NhbU5vZGUudHJhbnNsYXRlTG9jYWwoMCwgMCwgZGVwdGhSYW5nZS5tYXggKyAwLjEpO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZhckNsaXAgPSBkZXB0aFJhbmdlLm1heCAtIGRlcHRoUmFuZ2UubWluICsgMC4yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLmZvcndhcmRSZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZGVwdGggYmlhc1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyh0cnVlKTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzVmFsdWVzKGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wLCBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFsxXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzBdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCBzdGFuZGFyZCBzaGFkb3dtYXAgc3RhdGVzXG4gICAgICAgIGRldmljZS5zZXRCbGVuZGluZyhmYWxzZSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhUZXN0KHRydWUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhGdW5jKEZVTkNfTEVTU0VRVUFMKTtcblxuICAgICAgICBjb25zdCB1c2VTaGFkb3dTYW1wbGVyID0gaXNDbHVzdGVyZWQgP1xuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGRldmljZS53ZWJnbDIgOiAgICAgLy8gYm90aCBzcG90IGFuZCBvbW5pIGxpZ2h0IGFyZSB1c2luZyBzaGFkb3cgc2FtcGxlciBvbiB3ZWJnbDIgd2hlbiBjbHVzdGVyZWRcbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuICAgICAgICBpZiAodXNlU2hhZG93U2FtcGxlcikge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXN0b3JlUmVuZGVyU3RhdGUoZGV2aWNlKSB7XG5cbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG5cbiAgICAgICAgLy8gcG9zaXRpb24gLyByYW5nZVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5mb3J3YXJkUmVuZGVyZXIuZGlzcGF0Y2hWaWV3UG9zKHNoYWRvd0NhbU5vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICB0aGlzLnNoYWRvd01hcExpZ2h0UmFkaXVzSWQuc2V0VmFsdWUobGlnaHQuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmlldy1wcm9qZWN0aW9uIHNoYWRvdyBtYXRyaXhcbiAgICAgICAgc2hhZG93Q2FtVmlldy5zZXRUUlMoc2hhZG93Q2FtTm9kZS5nZXRQb3NpdGlvbigpLCBzaGFkb3dDYW1Ob2RlLmdldFJvdGF0aW9uKCksIFZlYzMuT05FKS5pbnZlcnQoKTtcbiAgICAgICAgc2hhZG93Q2FtVmlld1Byb2oubXVsMihzaGFkb3dDYW0ucHJvamVjdGlvbk1hdHJpeCwgc2hhZG93Q2FtVmlldyk7XG5cbiAgICAgICAgLy8gdmlld3BvcnQgaGFuZGxpbmdcbiAgICAgICAgY29uc3QgcmVjdFZpZXdwb3J0ID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1ZpZXdwb3J0O1xuICAgICAgICBzaGFkb3dDYW0ucmVjdCA9IHJlY3RWaWV3cG9ydDtcbiAgICAgICAgc2hhZG93Q2FtLnNjaXNzb3JSZWN0ID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1NjaXNzb3I7XG5cbiAgICAgICAgdmlld3BvcnRNYXRyaXguc2V0Vmlld3BvcnQocmVjdFZpZXdwb3J0LngsIHJlY3RWaWV3cG9ydC55LCByZWN0Vmlld3BvcnQueiwgcmVjdFZpZXdwb3J0LncpO1xuICAgICAgICBsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4Lm11bDIodmlld3BvcnRNYXRyaXgsIHNoYWRvd0NhbVZpZXdQcm9qKTtcblxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgLy8gY29weSBtYXRyaXggdG8gc2hhZG93IGNhc2NhZGUgcGFsZXR0ZVxuICAgICAgICAgICAgbGlnaHQuX3NoYWRvd01hdHJpeFBhbGV0dGUuc2V0KGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXguZGF0YSwgZmFjZSAqIDE2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IHZpc2libGVDYXN0ZXJzIC0gVmlzaWJsZSBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge0xpZ2h0fSBsaWdodCAtIFRoZSBsaWdodC5cbiAgICAgKi9cbiAgICBzdWJtaXRDYXN0ZXJzKHZpc2libGVDYXN0ZXJzLCBsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBmb3J3YXJkUmVuZGVyZXIgPSB0aGlzLmZvcndhcmRSZW5kZXJlcjtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBmb3J3YXJkUmVuZGVyZXIuc2NlbmU7XG4gICAgICAgIGNvbnN0IHBhc3NGbGFncyA9IDEgPDwgU0hBREVSX1NIQURPVztcblxuICAgICAgICAvLyBTb3J0IHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIGNvbnN0IHNoYWRvd1Bhc3MgPSBTaGFkZXJQYXNzLmdldFNoYWRvdyhsaWdodC5fdHlwZSwgbGlnaHQuX3NoYWRvd1R5cGUpO1xuXG4gICAgICAgIC8vIFJlbmRlclxuICAgICAgICBjb25zdCBjb3VudCA9IHZpc2libGVDYXN0ZXJzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB2aXNpYmxlQ2FzdGVyc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2UubWVzaDtcblxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmVuc3VyZU1hdGVyaWFsKGRldmljZSk7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG1lc2hJbnN0YW5jZS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgLy8gc2V0IGJhc2ljIG1hdGVyaWFsIHN0YXRlcy9wYXJhbWV0ZXJzXG4gICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0QmFzZUNvbnN0YW50cyhkZXZpY2UsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgIGZvcndhcmRSZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGlydHkpIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuY2h1bmtzKSB7XG5cbiAgICAgICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0Q3VsbE1vZGUodHJ1ZSwgZmFsc2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJIChzaGFkb3cpOiBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIElJIChzaGFkb3cpOiBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzXG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBwYXNzRmxhZ3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgc2hhZGVyXG4gICAgICAgICAgICBsZXQgc2hhZG93U2hhZGVyID0gbWVzaEluc3RhbmNlLl9zaGFkZXJbc2hhZG93UGFzc107XG4gICAgICAgICAgICBpZiAoIXNoYWRvd1NoYWRlcikge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBzaGFkb3dQYXNzKTtcbiAgICAgICAgICAgICAgICBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuX2tleVtTT1JUS0VZX0RFUFRIXSA9IGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNoYWRvd1NoYWRlci5mYWlsZWQgJiYgIWRldmljZS5zZXRTaGFkZXIoc2hhZG93U2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBFcnJvciBjb21waWxpbmcgc2hhZG93IHNoYWRlciBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7c2hhZG93UGFzc31gLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBidWZmZXJzXG4gICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgZm9yd2FyZFJlbmRlcmVyLnNldE1vcnBoaW5nKGRldmljZSwgbWVzaEluc3RhbmNlLm1vcnBoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IG1lc2hJbnN0YW5jZS5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgIGRldmljZS5zZXRJbmRleEJ1ZmZlcihtZXNoLmluZGV4QnVmZmVyW3N0eWxlXSk7XG5cbiAgICAgICAgICAgIC8vIGRyYXdcbiAgICAgICAgICAgIGZvcndhcmRSZW5kZXJlci5kcmF3SW5zdGFuY2UoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgIGZvcndhcmRSZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSkge1xuXG4gICAgICAgIGlmIChsaWdodC5lbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgICAgICBpZiAobGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfTk9ORTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IGxpZ2h0Ll9zaGFkb3dUeXBlO1xuICAgICAgICAgICAgY29uc3QgZmFjZUNvdW50ID0gbGlnaHQubnVtU2hhZG93RmFjZXM7XG5cbiAgICAgICAgICAgIGNvbnN0IGZvcndhcmRSZW5kZXJlciA9IHRoaXMuZm9yd2FyZFJlbmRlcmVyO1xuICAgICAgICAgICAgZm9yd2FyZFJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzICs9IGZhY2VDb3VudDtcbiAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gZm9yd2FyZFJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYFNIQURPVyAke2xpZ2h0Ll9ub2RlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KTtcblxuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYEZBQ0UgJHtmYWNlfWApO1xuXG4gICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgc2hhZG93cyBhcmUgcGVyIGNhbWVyYSwgc28gZ2V0IGFwcHJvcHJpYXRlIHJlbmRlciBkYXRhXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YSh0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCBmYWNlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgICAgICAgICAgLy8gY2FtZXJhIGNsZWFyIHNldHRpbmdcbiAgICAgICAgICAgICAgICAvLyBOb3RlOiB3aGVuIGNsdXN0ZXJlZCBsaWdodGluZyBpcyB0aGUgb25seSBsaWdodCB0eXBlLCB0aGlzIGNvZGUgY2FuIGJlIG1vdmVkIHRvIGNyZWF0ZVNoYWRvd0NhbWVyYSBmdW5jdGlvblxuICAgICAgICAgICAgICAgIFNoYWRvd1JlbmRlcmVyLnNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCk7XG5cbiAgICAgICAgICAgICAgICAvLyBhc3NpZ24gcmVuZGVyIHRhcmdldCBmb3IgdGhlIGZhY2VcbiAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJUYXJnZXRJbmRleCA9IHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IDAgOiBmYWNlO1xuICAgICAgICAgICAgICAgIHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQgPSBsaWdodC5fc2hhZG93TWFwLnJlbmRlclRhcmdldHNbcmVuZGVyVGFyZ2V0SW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSk7XG5cbiAgICAgICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0Q2FtZXJhKHNoYWRvd0NhbSwgc2hhZG93Q2FtLnJlbmRlclRhcmdldCwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICB0aGlzLnN1Ym1pdENhc3RlcnMobGlnaHRSZW5kZXJEYXRhLnZpc2libGVDYXN0ZXJzLCBsaWdodCk7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWU00gYmx1clxuICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1ZzbSAmJiBsaWdodC5fdnNtQmx1clNpemUgPiAxKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBhbGwgbm9uLWNsdXN0ZXJlZCBhbmQgZGlyZWN0aW9uYWwgbGlnaHRzIHN1cHBvcnQgdnNtXG4gICAgICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLmZvcndhcmRSZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCB8fCB0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBseVZzbUJsdXIobGlnaHQsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpO1xuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnVlNNJyk7XG5cbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gY2FtZXJhIDogbnVsbCwgMCk7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG4gICAgICAgIGNvbnN0IG9yaWdTaGFkb3dNYXAgPSBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIHRlbXBvcmFyeSByZW5kZXIgdGFyZ2V0IGZvciBibHVycmluZ1xuICAgICAgICAvLyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBvcHRpbWFsIGFuZCBzaGFkb3cgbWFwIGNvdWxkIGhhdmUgZGVwdGggYnVmZmVyIG9uIGluIGFkZGl0aW9uIHRvIGNvbG9yIGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGZvciBibHVycmluZyBvbmx5IG9uZSBidWZmZXIgaXMgbmVlZGVkLlxuICAgICAgICBjb25zdCB0ZW1wU2hhZG93TWFwID0gdGhpcy5zaGFkb3dNYXBDYWNoZS5nZXQoZGV2aWNlLCBsaWdodCk7XG4gICAgICAgIGNvbnN0IHRlbXBSdCA9IHRlbXBTaGFkb3dNYXAucmVuZGVyVGFyZ2V0c1swXTtcblxuICAgICAgICBjb25zdCBpc1ZzbTggPSBsaWdodC5fc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTg7XG4gICAgICAgIGNvbnN0IGJsdXJNb2RlID0gbGlnaHQudnNtQmx1ck1vZGU7XG4gICAgICAgIGNvbnN0IGZpbHRlclNpemUgPSBsaWdodC5fdnNtQmx1clNpemU7XG4gICAgICAgIGNvbnN0IGJsdXJTaGFkZXIgPSB0aGlzLmdldFZzbUJsdXJTaGFkZXIoaXNWc204LCBibHVyTW9kZSwgZmlsdGVyU2l6ZSk7XG5cbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LnogPSBsaWdodC5fc2hhZG93UmVzb2x1dGlvbiAtIDI7XG4gICAgICAgIGJsdXJTY2lzc29yUmVjdC53ID0gYmx1clNjaXNzb3JSZWN0Lno7XG5cbiAgICAgICAgLy8gQmx1ciBob3Jpem9udGFsXG4gICAgICAgIHRoaXMuc291cmNlSWQuc2V0VmFsdWUob3JpZ1NoYWRvd01hcC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMSAvIGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICBwaXhlbE9mZnNldFsxXSA9IDA7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZC5zZXRWYWx1ZShwaXhlbE9mZnNldCk7XG4gICAgICAgIGlmIChibHVyTW9kZSA9PT0gQkxVUl9HQVVTU0lBTikgdGhpcy53ZWlnaHRJZC5zZXRWYWx1ZSh0aGlzLmJsdXJWc21XZWlnaHRzW2ZpbHRlclNpemVdKTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGVtcFJ0LCBibHVyU2hhZGVyLCBudWxsLCBibHVyU2Npc3NvclJlY3QpO1xuXG4gICAgICAgIC8vIEJsdXIgdmVydGljYWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZSh0ZW1wUnQuY29sb3JCdWZmZXIpO1xuICAgICAgICBwaXhlbE9mZnNldFsxXSA9IHBpeGVsT2Zmc2V0WzBdO1xuICAgICAgICBwaXhlbE9mZnNldFswXSA9IDA7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZC5zZXRWYWx1ZShwaXhlbE9mZnNldCk7XG4gICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIG9yaWdTaGFkb3dNYXAsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSB0ZW1wb3Jhcnkgc2hhZG93IG1hcCBiYWNrIHRvIHRoZSBjYWNoZVxuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlLmFkZChsaWdodCwgdGVtcFNoYWRvd01hcCk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNoYWRvd1JlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsiYWFiYlBvaW50cyIsIlZlYzMiLCJfZGVwdGhSYW5nZSIsIm1pbiIsIm1heCIsImdldERlcHRoUmFuZ2UiLCJjYW1lcmFWaWV3TWF0cml4IiwiYWFiYk1pbiIsImFhYmJNYXgiLCJ4IiwieSIsInoiLCJtaW56IiwibWF4eiIsImkiLCJ0cmFuc2Zvcm1Qb2ludCIsImdhdXNzIiwic2lnbWEiLCJNYXRoIiwiZXhwIiwibWF4Qmx1clNpemUiLCJnYXVzc1dlaWdodHMiLCJrZXJuZWxTaXplIiwiaGFsZldpZHRoIiwidmFsdWVzIiwiQXJyYXkiLCJzdW0iLCJ2aXNpYmxlU2NlbmVBYWJiIiwiQm91bmRpbmdCb3giLCJzaGFkb3dDYW1WaWV3IiwiTWF0NCIsInNoYWRvd0NhbVZpZXdQcm9qIiwicGl4ZWxPZmZzZXQiLCJGbG9hdDMyQXJyYXkiLCJibHVyU2Npc3NvclJlY3QiLCJWZWM0Iiwib3BDaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwiY2VudGVyIiwidmlld3BvcnRNYXRyaXgiLCJnZXREZXB0aEtleSIsIm1lc2hJbnN0YW5jZSIsIm1hdGVyaWFsIiwic2tpbkluc3RhbmNlIiwib3BhY2l0eU1hcCIsIm9wQ2hhbiIsIm9wYWNpdHlNYXBDaGFubmVsIiwiU2hhZG93UmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImZvcndhcmRSZW5kZXJlciIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiZGV2aWNlIiwic2NvcGUiLCJwb2x5Z29uT2Zmc2V0SWQiLCJyZXNvbHZlIiwicG9seWdvbk9mZnNldCIsInNvdXJjZUlkIiwicGl4ZWxPZmZzZXRJZCIsIndlaWdodElkIiwiYmx1clZzbVNoYWRlckNvZGUiLCJzaGFkZXJDaHVua3MiLCJibHVyVlNNUFMiLCJwYWNrZWQiLCJibHVyUGFja2VkVnNtU2hhZGVyQ29kZSIsImJsdXJWc21TaGFkZXIiLCJibHVyUGFja2VkVnNtU2hhZGVyIiwiYmx1clZzbVdlaWdodHMiLCJzaGFkb3dNYXBMaWdodFJhZGl1c0lkIiwic2hhZG93TWFwQ2FjaGUiLCJTaGFkb3dNYXBDYWNoZSIsImRlc3Ryb3kiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJzaGFkb3dUeXBlIiwidHlwZSIsImZhY2UiLCJzaGFkb3dDYW0iLCJMaWdodENhbWVyYSIsImNyZWF0ZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTMyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInNldFNoYWRvd0NhbWVyYVNldHRpbmdzIiwiaXNDbHVzdGVyZWQiLCJod1BjZiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjMiLCJ3ZWJnbDIiLCJMSUdIVFRZUEVfT01OSSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjdWxsU2hhZG93Q2FzdGVycyIsIm1lc2hJbnN0YW5jZXMiLCJ2aXNpYmxlIiwiY2FtZXJhIiwiY291bnQiLCJudW1JbnN0YW5jZXMiLCJsZW5ndGgiLCJjdWxsIiwiX2lzVmlzaWJsZSIsInZpc2libGVUaGlzRnJhbWUiLCJzb3J0IiwiZGVwdGhTb3J0Q29tcGFyZSIsImN1bGxMb2NhbCIsImxpZ2h0IiwiZHJhd0NhbGxzIiwic2NlbmUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJfc2hhZG93TWFwIiwiU2hhZG93TWFwIiwiX3R5cGUiLCJmYWNlQ291bnQiLCJMSUdIVFRZUEVfU1BPVCIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzaGFkb3dDYW1lcmEiLCJuZWFyQ2xpcCIsImF0dGVudWF0aW9uRW5kIiwiZmFyQ2xpcCIsInNoYWRvd0NhbU5vZGUiLCJfbm9kZSIsImxpZ2h0Tm9kZSIsInNldFBvc2l0aW9uIiwiZ2V0UG9zaXRpb24iLCJmb3YiLCJfb3V0ZXJDb25lQW5nbGUiLCJzZXRSb3RhdGlvbiIsImdldFJvdGF0aW9uIiwicm90YXRlTG9jYWwiLCJ0aWxlU2l6ZSIsInNoYWRvd0F0bGFzUmVzb2x1dGlvbiIsImF0bGFzVmlld3BvcnQiLCJ0ZXhlbFNpemUiLCJmaWx0ZXJTaXplIiwic2hhZG93RWRnZVBpeGVscyIsImF0YW4iLCJtYXRoIiwiUkFEX1RPX0RFRyIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJ2aXNpYmxlQ2FzdGVycyIsImdlbmVyYXRlU3BsaXREaXN0YW5jZXMiLCJuZWFyRGlzdCIsImZhckRpc3QiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsImZpbGwiLCJudW1DYXNjYWRlcyIsImZyYWN0aW9uIiwibGluZWFyRGlzdCIsImxvZ0Rpc3QiLCJkaXN0IiwibGVycCIsImNhc2NhZGVEaXN0cmlidXRpb24iLCJjdWxsRGlyZWN0aW9uYWwiLCJfbmVhckNsaXAiLCJzaGFkb3dEaXN0YW5jZSIsImNhc2NhZGUiLCJyZW5kZXJUYXJnZXQiLCJyZW5kZXJUYXJnZXRzIiwic2hhZG93Vmlld3BvcnQiLCJjb3B5IiwiY2FzY2FkZXMiLCJzaGFkb3dTY2lzc29yIiwiZnJ1c3R1bU5lYXJEaXN0IiwiZnJ1c3R1bUZhckRpc3QiLCJmcnVzdHVtUG9pbnRzIiwiZ2V0RnJ1c3R1bUNvcm5lcnMiLCJzZXQiLCJjYW1lcmFXb3JsZE1hdCIsIm5vZGUiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImFkZCIsIm11bFNjYWxhciIsInJhZGl1cyIsInN1YiIsInJpZ2h0IiwidXAiLCJsaWdodERpciIsImZvcndhcmQiLCJzaXplUmF0aW8iLCJfc2hhZG93UmVzb2x1dGlvbiIsImNlaWwiLCJkb3QiLCJzY2FsZWRVcCIsInNjYWxlZFJpZ2h0Iiwic2NhbGVkRGlyIiwiYWRkMiIsInRyYW5zbGF0ZUxvY2FsIiwib3J0aG9IZWlnaHQiLCJlbXB0eUFhYmIiLCJhYWJiIiwiaW52ZXJ0IiwiZGVwdGhSYW5nZSIsImdldE1pbiIsImdldE1heCIsInNldHVwUmVuZGVyU3RhdGUiLCJzZXREZXB0aEJpYXMiLCJzZXREZXB0aEJpYXNWYWx1ZXMiLCJzaGFkb3dCaWFzIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsInNldFZhbHVlIiwic2V0QmxlbmRpbmciLCJzZXREZXB0aFdyaXRlIiwic2V0RGVwdGhUZXN0Iiwic2V0RGVwdGhGdW5jIiwiRlVOQ19MRVNTRVFVQUwiLCJ1c2VTaGFkb3dTYW1wbGVyIiwiX2lzUGNmIiwic2V0Q29sb3JXcml0ZSIsInJlc3RvcmVSZW5kZXJTdGF0ZSIsImRpc3BhdGNoVW5pZm9ybXMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJkaXNwYXRjaFZpZXdQb3MiLCJzZXRUUlMiLCJPTkUiLCJtdWwyIiwicHJvamVjdGlvbk1hdHJpeCIsInJlY3RWaWV3cG9ydCIsInJlY3QiLCJzY2lzc29yUmVjdCIsInNldFZpZXdwb3J0IiwidyIsInNoYWRvd01hdHJpeCIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwiZGF0YSIsInN1Ym1pdENhc3RlcnMiLCJwYXNzRmxhZ3MiLCJTSEFERVJfU0hBRE9XIiwic2hhZG93UGFzcyIsIlNoYWRlclBhc3MiLCJnZXRTaGFkb3ciLCJfc2hhZG93VHlwZSIsIm1lc2giLCJlbnN1cmVNYXRlcmlhbCIsInNldEJhc2VDb25zdGFudHMiLCJzZXRTa2lubmluZyIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJjaHVua3MiLCJzZXRDdWxsTW9kZSIsInNldFBhcmFtZXRlcnMiLCJzaGFkb3dTaGFkZXIiLCJfc2hhZGVyIiwidXBkYXRlUGFzc1NoYWRlciIsIl9rZXkiLCJTT1JUS0VZX0RFUFRIIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiRGVidWciLCJlcnJvciIsIm5hbWUiLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0TW9ycGhpbmciLCJtb3JwaEluc3RhbmNlIiwic3R5bGUiLCJyZW5kZXJTdHlsZSIsInNldEluZGV4QnVmZmVyIiwiaW5kZXhCdWZmZXIiLCJkcmF3SW5zdGFuY2UiLCJfc2hhZG93RHJhd0NhbGxzIiwicmVuZGVyIiwiZW5hYmxlZCIsImNhc3RTaGFkb3dzIiwic2hhZG93VXBkYXRlTW9kZSIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsIm51bVNoYWRvd0ZhY2VzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInJlbmRlclRhcmdldEluZGV4Iiwic2V0Q2FtZXJhIiwicG9wR3B1TWFya2VyIiwiX2lzVnNtIiwiX3ZzbUJsdXJTaXplIiwiYXBwbHlWc21CbHVyIiwiZ2V0VnNtQmx1clNoYWRlciIsImlzVnNtOCIsImJsdXJNb2RlIiwiYmx1clNoYWRlciIsImJsdXJWUyIsImZ1bGxzY3JlZW5RdWFkVlMiLCJibHVyRlMiLCJibHVyU2hhZGVyTmFtZSIsImNyZWF0ZVNoYWRlckZyb21Db2RlIiwib3JpZ1NoYWRvd01hcCIsInRlbXBTaGFkb3dNYXAiLCJnZXQiLCJ0ZW1wUnQiLCJ2c21CbHVyTW9kZSIsImNvbG9yQnVmZmVyIiwiQkxVUl9HQVVTU0lBTiIsImRyYXdRdWFkV2l0aFNoYWRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7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
