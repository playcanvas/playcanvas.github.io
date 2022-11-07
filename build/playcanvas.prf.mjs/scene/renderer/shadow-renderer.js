/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
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
      if (!shadowShader.failed && !device.setShader(shadowShader)) ;

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
      this.setupRenderState(device, light);
      for (let face = 0; face < faceCount; face++) {
        const lightRenderData = light.getRenderData(type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
        const shadowCam = lightRenderData.shadowCamera;

        ShadowRenderer.setShadowCameraSettings(shadowCam, device, shadowType, type, isClustered);

        const renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
        shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];
        this.dispatchUniforms(light, shadowCam, lightRenderData, face);
        forwardRenderer.setCamera(shadowCam, shadowCam.renderTarget, true);

        this.submitCasters(lightRenderData.visibleCasters, light);
      }

      if (light._isVsm && light._vsmBlurSize > 1) {
        const _isClustered = this.forwardRenderer.scene.clusteredLightingEnabled;
        if (!_isClustered || type === LIGHTTYPE_DIRECTIONAL) {
          this.applyVsmBlur(light, camera);
        }
      }
      this.restoreRenderState(device);
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
  }
}

export { ShadowRenderer };
