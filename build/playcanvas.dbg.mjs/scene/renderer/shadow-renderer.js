/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { math } from '../../math/math.js';
import { Vec3 } from '../../math/vec3.js';
import { Vec4 } from '../../math/vec4.js';
import { Mat4 } from '../../math/mat4.js';
import { Color } from '../../math/color.js';
import { BoundingBox } from '../../shape/bounding-box.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF3, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { LightCamera } from './light-camera.js';
import { FUNC_LESSEQUAL } from '../../graphics/constants.js';
import { drawQuadWithShader } from '../../graphics/simple-post-effect.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { DebugGraphics } from '../../graphics/debug-graphics.js';
import { ShadowMap } from './shadow-map.js';
import { ShadowMapCache } from './shadow-map-cache.js';
import { Frustum } from '../../shape/frustum.js';
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
      const frustumPoints = Frustum.getPoints(camera, frustumNearDist, frustumFarDist);
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
    const useShadowSampler = isClustered ? light._isPcf && device.webgl2 : light._isPcf && device.webgl2 && light._type !== LIGHTTYPE_OMNI;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi8uLi9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsXG4gICAgU0hBREVSX1NIQURPVyxcbiAgICBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMzIsXG4gICAgU0hBRE9XVVBEQVRFX05PTkUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgU09SVEtFWV9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5cbmltcG9ydCB7IEZVTkNfTEVTU0VRVUFMIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3NpbXBsZS1wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvcHJvZ3JhbS1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFNoYWRvd01hcCB9IGZyb20gJy4vc2hhZG93LW1hcC5qcyc7XG5pbXBvcnQgeyBTaGFkb3dNYXBDYWNoZSB9IGZyb20gJy4vc2hhZG93LW1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBGcnVzdHVtIH0gZnJvbSAnLi4vLi4vc2hhcGUvZnJ1c3R1bS5qcyc7XG5pbXBvcnQgeyBTaGFkZXJQYXNzIH0gZnJvbSAnLi4vc2hhZGVyLXBhc3MuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gTWVzaEluc3RhbmNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vbGlnaHQuanMnKS5MaWdodH0gTGlnaHQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2ZvcndhcmQtcmVuZGVyZXIuanMnKS5Gb3J3YXJkUmVuZGVyZXJ9IEZvcndhcmRSZW5kZXJlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gTGlnaHRUZXh0dXJlQXRsYXMgKi9cblxuY29uc3QgYWFiYlBvaW50cyA9IFtcbiAgICBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLFxuICAgIG5ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKClcbl07XG5cbi8vIGV2YWx1YXRlIGRlcHRoIHJhbmdlIHRoZSBhYWJiIHRha2VzIGluIHRoZSBzcGFjZSBvZiB0aGUgY2FtZXJhXG5jb25zdCBfZGVwdGhSYW5nZSA9IHsgbWluOiAwLCBtYXg6IDAgfTtcbmZ1bmN0aW9uIGdldERlcHRoUmFuZ2UoY2FtZXJhVmlld01hdHJpeCwgYWFiYk1pbiwgYWFiYk1heCkge1xuICAgIGFhYmJQb2ludHNbMF0ueCA9IGFhYmJQb2ludHNbMV0ueCA9IGFhYmJQb2ludHNbMl0ueCA9IGFhYmJQb2ludHNbM10ueCA9IGFhYmJNaW4ueDtcbiAgICBhYWJiUG9pbnRzWzFdLnkgPSBhYWJiUG9pbnRzWzNdLnkgPSBhYWJiUG9pbnRzWzddLnkgPSBhYWJiUG9pbnRzWzVdLnkgPSBhYWJiTWluLnk7XG4gICAgYWFiYlBvaW50c1syXS56ID0gYWFiYlBvaW50c1szXS56ID0gYWFiYlBvaW50c1s2XS56ID0gYWFiYlBvaW50c1s3XS56ID0gYWFiYk1pbi56O1xuICAgIGFhYmJQb2ludHNbNF0ueCA9IGFhYmJQb2ludHNbNV0ueCA9IGFhYmJQb2ludHNbNl0ueCA9IGFhYmJQb2ludHNbN10ueCA9IGFhYmJNYXgueDtcbiAgICBhYWJiUG9pbnRzWzBdLnkgPSBhYWJiUG9pbnRzWzJdLnkgPSBhYWJiUG9pbnRzWzRdLnkgPSBhYWJiUG9pbnRzWzZdLnkgPSBhYWJiTWF4Lnk7XG4gICAgYWFiYlBvaW50c1swXS56ID0gYWFiYlBvaW50c1sxXS56ID0gYWFiYlBvaW50c1s0XS56ID0gYWFiYlBvaW50c1s1XS56ID0gYWFiYk1heC56O1xuXG4gICAgbGV0IG1pbnogPSA5OTk5OTk5OTk5O1xuICAgIGxldCBtYXh6ID0gLTk5OTk5OTk5OTk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDg7ICsraSkge1xuICAgICAgICBjYW1lcmFWaWV3TWF0cml4LnRyYW5zZm9ybVBvaW50KGFhYmJQb2ludHNbaV0sIGFhYmJQb2ludHNbaV0pO1xuICAgICAgICBjb25zdCB6ID0gYWFiYlBvaW50c1tpXS56O1xuICAgICAgICBpZiAoeiA8IG1pbnopIG1pbnogPSB6O1xuICAgICAgICBpZiAoeiA+IG1heHopIG1heHogPSB6O1xuICAgIH1cblxuICAgIF9kZXB0aFJhbmdlLm1pbiA9IG1pbno7XG4gICAgX2RlcHRoUmFuZ2UubWF4ID0gbWF4ejtcbiAgICByZXR1cm4gX2RlcHRoUmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuY29uc3QgbWF4Qmx1clNpemUgPSAyNTtcbmZ1bmN0aW9uIGdhdXNzV2VpZ2h0cyhrZXJuZWxTaXplKSB7XG4gICAgaWYgKGtlcm5lbFNpemUgPiBtYXhCbHVyU2l6ZSkge1xuICAgICAgICBrZXJuZWxTaXplID0gbWF4Qmx1clNpemU7XG4gICAgfVxuICAgIGNvbnN0IHNpZ21hID0gKGtlcm5lbFNpemUgLSAxKSAvICgyICogMyk7XG5cbiAgICBjb25zdCBoYWxmV2lkdGggPSAoa2VybmVsU2l6ZSAtIDEpICogMC41O1xuICAgIGNvbnN0IHZhbHVlcyA9IG5ldyBBcnJheShrZXJuZWxTaXplKTtcbiAgICBsZXQgc3VtID0gMC4wO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2VybmVsU2l6ZTsgKytpKSB7XG4gICAgICAgIHZhbHVlc1tpXSA9IGdhdXNzKGkgLSBoYWxmV2lkdGgsIHNpZ21hKTtcbiAgICAgICAgc3VtICs9IHZhbHVlc1tpXTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gLz0gc3VtO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xufVxuXG5jb25zdCB2aXNpYmxlU2NlbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBzaGFkb3dDYW1WaWV3ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNoYWRvd0NhbVZpZXdQcm9qID0gbmV3IE1hdDQoKTtcbmNvbnN0IHBpeGVsT2Zmc2V0ID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbmNvbnN0IGJsdXJTY2lzc29yUmVjdCA9IG5ldyBWZWM0KDEsIDEsIDAsIDApO1xuY29uc3Qgb3BDaGFuSWQgPSB7IHI6IDEsIGc6IDIsIGI6IDMsIGE6IDQgfTtcbmNvbnN0IGNlbnRlciA9IG5ldyBWZWMzKCk7XG5jb25zdCB2aWV3cG9ydE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmZ1bmN0aW9uIGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSkge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuICAgIGNvbnN0IHggPSBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID8gMTAgOiAwO1xuICAgIGxldCB5ID0gMDtcbiAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICBjb25zdCBvcENoYW4gPSBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbDtcbiAgICAgICAgaWYgKG9wQ2hhbikge1xuICAgICAgICAgICAgeSA9IG9wQ2hhbklkW29wQ2hhbl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHggKyB5O1xufVxuXG4vKipcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU2hhZG93UmVuZGVyZXIge1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Rm9yd2FyZFJlbmRlcmVyfSBmb3J3YXJkUmVuZGVyZXIgLSBUaGUgZm9yd2FyZCByZW5kZXJlci5cbiAgICAgKiBAcGFyYW0ge0xpZ2h0VGV4dHVyZUF0bGFzfSBsaWdodFRleHR1cmVBdGxhcyAtIFRoZSBzaGFkb3cgbWFwIGF0bGFzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGZvcndhcmRSZW5kZXJlciwgbGlnaHRUZXh0dXJlQXRsYXMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBmb3J3YXJkUmVuZGVyZXIuZGV2aWNlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7Rm9yd2FyZFJlbmRlcmVyfSAqL1xuICAgICAgICB0aGlzLmZvcndhcmRSZW5kZXJlciA9IGZvcndhcmRSZW5kZXJlcjtcblxuICAgICAgICAvKiogQHR5cGUge0xpZ2h0VGV4dHVyZUF0bGFzfSAqL1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzID0gbGlnaHRUZXh0dXJlQXRsYXM7XG5cbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZCA9IHNjb3BlLnJlc29sdmUoJ3BvbHlnb25PZmZzZXQnKTtcbiAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0ID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuICAgICAgICAvLyBWU01cbiAgICAgICAgdGhpcy5zb3VyY2VJZCA9IHNjb3BlLnJlc29sdmUoJ3NvdXJjZScpO1xuICAgICAgICB0aGlzLnBpeGVsT2Zmc2V0SWQgPSBzY29wZS5yZXNvbHZlKCdwaXhlbE9mZnNldCcpO1xuICAgICAgICB0aGlzLndlaWdodElkID0gc2NvcGUucmVzb2x2ZSgnd2VpZ2h0WzBdJyk7XG4gICAgICAgIHRoaXMuYmx1clZzbVNoYWRlckNvZGUgPSBbc2hhZGVyQ2h1bmtzLmJsdXJWU01QUywgJyNkZWZpbmUgR0FVU1NcXG4nICsgc2hhZGVyQ2h1bmtzLmJsdXJWU01QU107XG4gICAgICAgIGNvbnN0IHBhY2tlZCA9ICcjZGVmaW5lIFBBQ0tFRFxcbic7XG4gICAgICAgIHRoaXMuYmx1clBhY2tlZFZzbVNoYWRlckNvZGUgPSBbcGFja2VkICsgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZVswXSwgcGFja2VkICsgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZVsxXV07XG5cbiAgICAgICAgLy8gY2FjaGUgZm9yIHZzbSBibHVyIHNoYWRlcnNcbiAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyID0gW3t9LCB7fV07XG4gICAgICAgIHRoaXMuYmx1clBhY2tlZFZzbVNoYWRlciA9IFt7fSwge31dO1xuXG4gICAgICAgIHRoaXMuYmx1clZzbVdlaWdodHMgPSB7fTtcblxuICAgICAgICAvLyB1bmlmb3Jtc1xuICAgICAgICB0aGlzLnNoYWRvd01hcExpZ2h0UmFkaXVzSWQgPSBzY29wZS5yZXNvbHZlKCdsaWdodF9yYWRpdXMnKTtcblxuICAgICAgICAvLyBzaGFkb3cgbWFwIGNhY2hlXG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUgPSBuZXcgU2hhZG93TWFwQ2FjaGUoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlcyBzaGFkb3cgY2FtZXJhIGZvciBhIGxpZ2h0IGFuZCBzZXRzIHVwIGl0cyBjb25zdGFudCBwcm9wZXJ0aWVzXG4gICAgc3RhdGljIGNyZWF0ZVNoYWRvd0NhbWVyYShkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGZhY2UpIHtcblxuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBMaWdodENhbWVyYS5jcmVhdGUoJ1NoYWRvd0NhbWVyYScsIHR5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIGRvbid0IGNsZWFyIHRoZSBjb2xvciBidWZmZXIgaWYgcmVuZGVyaW5nIGEgZGVwdGggbWFwXG4gICAgICAgIGlmIChzaGFkb3dUeXBlID49IFNIQURPV19WU004ICYmIHNoYWRvd1R5cGUgPD0gU0hBRE9XX1ZTTTMyKSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyRGVwdGhCdWZmZXIgPSB0cnVlO1xuICAgICAgICBzaGFkb3dDYW0uY2xlYXJTdGVuY2lsQnVmZmVyID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICBzdGF0aWMgc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCBkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKSB7XG5cbiAgICAgICAgLy8gbm9ybWFsIG9tbmkgc2hhZG93cyBvbiB3ZWJnbDIgZW5jb2RlIGRlcHRoIGluIFJHQkE4IGFuZCBkbyBtYW51YWwgUENGIHNhbXBsaW5nXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIHVzZSBkZXB0aCBmb3JtYXQgYW5kIGhhcmR3YXJlIFBDRiBzYW1wbGluZ1xuICAgICAgICBsZXQgaHdQY2YgPSBzaGFkb3dUeXBlID09PSBTSEFET1dfUENGNSB8fCAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgZGV2aWNlLndlYmdsMik7XG4gICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgIGh3UGNmID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvckJ1ZmZlciA9ICFod1BjZjtcbiAgICB9XG5cbiAgICAvLyBjdWxscyB0aGUgbGlzdCBvZiBtZXNoZXMgaW5zdGFuY2VzIGJ5IHRoZSBjYW1lcmEsIHN0b3JpbmcgdmlzaWJsZSBtZXNoIGluc3RhbmNlcyBpbiB0aGUgc3BlY2lmaWVkIGFycmF5XG4gICAgY3VsbFNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcywgdmlzaWJsZSwgY2FtZXJhKSB7XG5cbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbnVtSW5zdGFuY2VzID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSW5zdGFuY2VzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIGlmICghbWVzaEluc3RhbmNlLmN1bGwgfHwgbWVzaEluc3RhbmNlLl9pc1Zpc2libGUoY2FtZXJhKSkge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB2aXNpYmxlW2NvdW50XSA9IG1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmlzaWJsZS5sZW5ndGggPSBjb3VudDtcblxuICAgICAgICAvLyBUT0RPOiB3ZSBzaG91bGQgcHJvYmFibHkgc29ydCBzaGFkb3cgbWVzaGVzIGJ5IHNoYWRlciBhbmQgbm90IGRlcHRoXG4gICAgICAgIHZpc2libGUuc29ydCh0aGlzLmZvcndhcmRSZW5kZXJlci5kZXB0aFNvcnRDb21wYXJlKTtcbiAgICB9XG5cbiAgICAvLyBjdWxsIGxvY2FsIHNoYWRvdyBtYXBcbiAgICBjdWxsTG9jYWwobGlnaHQsIGRyYXdDYWxscykge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5mb3J3YXJkUmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIGZvcmNlIGxpZ2h0IHZpc2liaWxpdHkgaWYgZnVuY3Rpb24gd2FzIG1hbnVhbGx5IGNhbGxlZFxuICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcblxuICAgICAgICAvLyBhbGxvY2F0ZSBzaGFkb3cgbWFwIHVubGVzcyBpbiBjbHVzdGVyZWQgbGlnaHRpbmcgbW9kZVxuICAgICAgICBpZiAoIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICBpZiAoIWxpZ2h0Ll9zaGFkb3dNYXApIHtcbiAgICAgICAgICAgICAgICBsaWdodC5fc2hhZG93TWFwID0gU2hhZG93TWFwLmNyZWF0ZSh0aGlzLmRldmljZSwgbGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBmYWNlQ291bnQgPSB0eXBlID09PSBMSUdIVFRZUEVfU1BPVCA/IDEgOiA2O1xuXG4gICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIGRhdGEgYXJlIHNoYXJlZCBiZXR3ZWVuIGNhbWVyYXMgZm9yIGxvY2FsIGxpZ2h0cywgc28gcGFzcyBudWxsIGZvciBjYW1lcmFcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgZmFjZSk7XG4gICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgICAgICBzaGFkb3dDYW0ubmVhckNsaXAgPSBsaWdodC5hdHRlbnVhdGlvbkVuZCAvIDEwMDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZmFyQ2xpcCA9IGxpZ2h0LmF0dGVudWF0aW9uRW5kO1xuXG4gICAgICAgICAgICBjb25zdCBzaGFkb3dDYW1Ob2RlID0gc2hhZG93Q2FtLl9ub2RlO1xuICAgICAgICAgICAgY29uc3QgbGlnaHROb2RlID0gbGlnaHQuX25vZGU7XG4gICAgICAgICAgICBzaGFkb3dDYW1Ob2RlLnNldFBvc2l0aW9uKGxpZ2h0Tm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgc2hhZG93Q2FtLmZvdiA9IGxpZ2h0Ll9vdXRlckNvbmVBbmdsZSAqIDI7XG5cbiAgICAgICAgICAgICAgICAvLyBDYW1lcmEgbG9va3MgZG93biB0aGUgbmVnYXRpdmUgWiwgYW5kIHNwb3QgbGlnaHQgcG9pbnRzIGRvd24gdGhlIG5lZ2F0aXZlIFlcbiAgICAgICAgICAgICAgICBzaGFkb3dDYW1Ob2RlLnNldFJvdGF0aW9uKGxpZ2h0Tm9kZS5nZXRSb3RhdGlvbigpKTtcbiAgICAgICAgICAgICAgICBzaGFkb3dDYW1Ob2RlLnJvdGF0ZUxvY2FsKC05MCwgMCwgMCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdoZW4gcmVuZGVyaW5nIG9tbmkgc2hhZG93cyB0byBhbiBhdGxhcywgdXNlIGxhcmdlciBmb3YgYnkgZmV3IHBpeGVscyB0byBhbGxvdyBzaGFkb3cgZmlsdGVyaW5nIHRvIHN0YXkgb24gYSBzaW5nbGUgZmFjZVxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWxlU2l6ZSA9IHRoaXMubGlnaHRUZXh0dXJlQXRsYXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uICogbGlnaHQuYXRsYXNWaWV3cG9ydC56IC8gMzsgICAgLy8gdXNpbmcgM3gzIGZvciBjdWJlbWFwXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleGVsU2l6ZSA9IDIgLyB0aWxlU2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsdGVyU2l6ZSA9IHRleGVsU2l6ZSAqIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMuc2hhZG93RWRnZVBpeGVscztcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93Q2FtLmZvdiA9IE1hdGguYXRhbigxICsgZmlsdGVyU2l6ZSkgKiBtYXRoLlJBRF9UT19ERUcgKiAyO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd0NhbS5mb3YgPSA5MDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGN1bGwgc2hhZG93IGNhc3RlcnNcbiAgICAgICAgICAgIHRoaXMuZm9yd2FyZFJlbmRlcmVyLnVwZGF0ZUNhbWVyYUZydXN0dW0oc2hhZG93Q2FtKTtcbiAgICAgICAgICAgIHRoaXMuY3VsbFNoYWRvd0Nhc3RlcnMoZHJhd0NhbGxzLCBsaWdodFJlbmRlckRhdGEudmlzaWJsZUNhc3RlcnMsIHNoYWRvd0NhbSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiB0byBnZW5lcmF0ZSBmcnVzdHVtIHNwbGl0IGRpc3RhbmNlc1xuICAgIGdlbmVyYXRlU3BsaXREaXN0YW5jZXMobGlnaHQsIG5lYXJEaXN0LCBmYXJEaXN0KSB7XG5cbiAgICAgICAgbGlnaHQuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMuZmlsbChmYXJEaXN0KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBsaWdodC5udW1DYXNjYWRlczsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8vICBsZXJwIGJldHdlZW4gbGluZWFyIGFuZCBsb2dhcml0aG1pYyBkaXN0YW5jZSwgY2FsbGVkIHByYWN0aWNhbCBzcGxpdCBkaXN0YW5jZVxuICAgICAgICAgICAgY29uc3QgZnJhY3Rpb24gPSBpIC8gbGlnaHQubnVtQ2FzY2FkZXM7XG4gICAgICAgICAgICBjb25zdCBsaW5lYXJEaXN0ID0gbmVhckRpc3QgKyAoZmFyRGlzdCAtIG5lYXJEaXN0KSAqIGZyYWN0aW9uO1xuICAgICAgICAgICAgY29uc3QgbG9nRGlzdCA9IG5lYXJEaXN0ICogKGZhckRpc3QgLyBuZWFyRGlzdCkgKiogZnJhY3Rpb247XG4gICAgICAgICAgICBjb25zdCBkaXN0ID0gbWF0aC5sZXJwKGxpbmVhckRpc3QsIGxvZ0Rpc3QsIGxpZ2h0LmNhc2NhZGVEaXN0cmlidXRpb24pO1xuICAgICAgICAgICAgbGlnaHQuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbaSAtIDFdID0gZGlzdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGN1bGwgZGlyZWN0aW9uYWwgc2hhZG93IG1hcFxuICAgIGN1bGxEaXJlY3Rpb25hbChsaWdodCwgZHJhd0NhbGxzLCBjYW1lcmEpIHtcblxuICAgICAgICAvLyBmb3JjZSBsaWdodCB2aXNpYmlsaXR5IGlmIGZ1bmN0aW9uIHdhcyBtYW51YWxseSBjYWxsZWRcbiAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKCFsaWdodC5fc2hhZG93TWFwKSB7XG4gICAgICAgICAgICBsaWdodC5fc2hhZG93TWFwID0gU2hhZG93TWFwLmNyZWF0ZSh0aGlzLmRldmljZSwgbGlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgc3BsaXRzIGZvciB0aGUgY2FzY2FkZXNcbiAgICAgICAgY29uc3QgbmVhckRpc3QgPSBjYW1lcmEuX25lYXJDbGlwO1xuICAgICAgICB0aGlzLmdlbmVyYXRlU3BsaXREaXN0YW5jZXMobGlnaHQsIG5lYXJEaXN0LCBsaWdodC5zaGFkb3dEaXN0YW5jZSk7XG5cbiAgICAgICAgZm9yIChsZXQgY2FzY2FkZSA9IDA7IGNhc2NhZGUgPCBsaWdodC5udW1DYXNjYWRlczsgY2FzY2FkZSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEoY2FtZXJhLCBjYXNjYWRlKTtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgICAgIC8vIGFzc2lnbiByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICAvLyBOb3RlOiB0aGlzIGlzIGRvbmUgZHVyaW5nIHJlbmRlcmluZyBmb3IgYWxsIHNoYWRvdyBtYXBzLCBidXQgZG8gaXQgaGVyZSBmb3IgdGhlIGNhc2Ugc2hhZG93IHJlbmRlcmluZyBmb3IgdGhlIGRpcmVjdGlvbmFsIGxpZ2h0XG4gICAgICAgICAgICAvLyBpcyBkaXNhYmxlZCAtIHdlIG5lZWQgc2hhZG93IG1hcCB0byBiZSBhc3NpZ25lZCBmb3IgcmVuZGVyaW5nIHRvIHdvcmsgZXZlbiBpbiB0aGlzIGNhc2UuIFRoaXMgbmVlZHMgZnVydGhlciByZWZhY3RvcmluZyAtIGFzIHdoZW5cbiAgICAgICAgICAgIC8vIHNoYWRvdyByZW5kZXJpbmcgaXMgc2V0IHRvIFNIQURPV1VQREFURV9OT05FLCB3ZSBzaG91bGQgbm90IGV2ZW4gZXhlY3V0ZSBzaGFkb3cgbWFwIGN1bGxpbmdcbiAgICAgICAgICAgIHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQgPSBsaWdodC5fc2hhZG93TWFwLnJlbmRlclRhcmdldHNbMF07XG5cbiAgICAgICAgICAgIC8vIHZpZXdwb3J0XG4gICAgICAgICAgICBsaWdodFJlbmRlckRhdGEuc2hhZG93Vmlld3BvcnQuY29weShsaWdodC5jYXNjYWRlc1tjYXNjYWRlXSk7XG4gICAgICAgICAgICBsaWdodFJlbmRlckRhdGEuc2hhZG93U2Npc3Nvci5jb3B5KGxpZ2h0LmNhc2NhZGVzW2Nhc2NhZGVdKTtcblxuICAgICAgICAgICAgY29uc3Qgc2hhZG93Q2FtTm9kZSA9IHNoYWRvd0NhbS5fbm9kZTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0Tm9kZSA9IGxpZ2h0Ll9ub2RlO1xuXG4gICAgICAgICAgICBzaGFkb3dDYW1Ob2RlLnNldFBvc2l0aW9uKGxpZ2h0Tm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgLy8gQ2FtZXJhIGxvb2tzIGRvd24gdGhlIG5lZ2F0aXZlIFosIGFuZCBkaXJlY3Rpb25hbCBsaWdodCBwb2ludHMgZG93biB0aGUgbmVnYXRpdmUgWVxuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5zZXRSb3RhdGlvbihsaWdodE5vZGUuZ2V0Um90YXRpb24oKSk7XG4gICAgICAgICAgICBzaGFkb3dDYW1Ob2RlLnJvdGF0ZUxvY2FsKC05MCwgMCwgMCk7XG5cbiAgICAgICAgICAgIC8vIGdldCBjYW1lcmEncyBmcnVzdHVtIGNvcm5lcnMgZm9yIHRoZSBjYXNjYWRlLCBjb252ZXJ0IHRoZW0gdG8gd29ybGQgc3BhY2UgYW5kIGZpbmQgdGhlaXIgY2VudGVyXG4gICAgICAgICAgICBjb25zdCBmcnVzdHVtTmVhckRpc3QgPSBjYXNjYWRlID09PSAwID8gbmVhckRpc3QgOiBsaWdodC5fc2hhZG93Q2FzY2FkZURpc3RhbmNlc1tjYXNjYWRlIC0gMV07XG4gICAgICAgICAgICBjb25zdCBmcnVzdHVtRmFyRGlzdCA9IGxpZ2h0Ll9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzW2Nhc2NhZGVdO1xuICAgICAgICAgICAgY29uc3QgZnJ1c3R1bVBvaW50cyA9IEZydXN0dW0uZ2V0UG9pbnRzKGNhbWVyYSwgZnJ1c3R1bU5lYXJEaXN0LCBmcnVzdHVtRmFyRGlzdCk7XG4gICAgICAgICAgICBjZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhV29ybGRNYXQgPSBjYW1lcmEubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjYW1lcmFXb3JsZE1hdC50cmFuc2Zvcm1Qb2ludChmcnVzdHVtUG9pbnRzW2ldLCBmcnVzdHVtUG9pbnRzW2ldKTtcbiAgICAgICAgICAgICAgICBjZW50ZXIuYWRkKGZydXN0dW1Qb2ludHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2VudGVyLm11bFNjYWxhcigxIC8gOCk7XG5cbiAgICAgICAgICAgIC8vIHJhZGl1cyBvZiB0aGUgd29ybGQgc3BhY2UgYm91bmRpbmcgc3BoZXJlIGZvciB0aGUgZnJ1c3R1bSBzbGljZVxuICAgICAgICAgICAgbGV0IHJhZGl1cyA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3QgPSBmcnVzdHVtUG9pbnRzW2ldLnN1YihjZW50ZXIpLmxlbmd0aCgpO1xuICAgICAgICAgICAgICAgIGlmIChkaXN0ID4gcmFkaXVzKVxuICAgICAgICAgICAgICAgICAgICByYWRpdXMgPSBkaXN0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBheGlzIG9mIGxpZ2h0IGNvb3JkaW5hdGUgc3lzdGVtXG4gICAgICAgICAgICBjb25zdCByaWdodCA9IHNoYWRvd0NhbU5vZGUucmlnaHQ7XG4gICAgICAgICAgICBjb25zdCB1cCA9IHNoYWRvd0NhbU5vZGUudXA7XG4gICAgICAgICAgICBjb25zdCBsaWdodERpciA9IHNoYWRvd0NhbU5vZGUuZm9yd2FyZDtcblxuICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHRoZSBzcGhlcmUncyBjZW50ZXIgaW50byB0aGUgY2VudGVyIG9mIHRoZSBzaGFkb3cgbWFwLCBwaXhlbCBhbGlnbmVkLlxuICAgICAgICAgICAgLy8gdGhpcyBtYWtlcyB0aGUgc2hhZG93IG1hcCBzdGFibGUgYW5kIGF2b2lkcyBzaGltbWVyaW5nIG9uIHRoZSBlZGdlcyB3aGVuIHRoZSBjYW1lcmEgbW92ZXNcbiAgICAgICAgICAgIGNvbnN0IHNpemVSYXRpbyA9IDAuMjUgKiBsaWdodC5fc2hhZG93UmVzb2x1dGlvbiAvIHJhZGl1cztcbiAgICAgICAgICAgIGNvbnN0IHggPSBNYXRoLmNlaWwoY2VudGVyLmRvdCh1cCkgKiBzaXplUmF0aW8pIC8gc2l6ZVJhdGlvO1xuICAgICAgICAgICAgY29uc3QgeSA9IE1hdGguY2VpbChjZW50ZXIuZG90KHJpZ2h0KSAqIHNpemVSYXRpbykgLyBzaXplUmF0aW87XG5cbiAgICAgICAgICAgIGNvbnN0IHNjYWxlZFVwID0gdXAubXVsU2NhbGFyKHgpO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVkUmlnaHQgPSByaWdodC5tdWxTY2FsYXIoeSk7XG4gICAgICAgICAgICBjb25zdCBkb3QgPSBjZW50ZXIuZG90KGxpZ2h0RGlyKTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlZERpciA9IGxpZ2h0RGlyLm11bFNjYWxhcihkb3QpO1xuICAgICAgICAgICAgY2VudGVyLmFkZDIoc2NhbGVkVXAsIHNjYWxlZFJpZ2h0KS5hZGQoc2NhbGVkRGlyKTtcblxuICAgICAgICAgICAgLy8gbG9vayBhdCB0aGUgY2VudGVyIGZyb20gZmFyIGF3YXkgdG8gaW5jbHVkZSBhbGwgY2FzdGVycyBkdXJpbmcgY3VsbGluZ1xuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS5zZXRQb3NpdGlvbihjZW50ZXIpO1xuICAgICAgICAgICAgc2hhZG93Q2FtTm9kZS50cmFuc2xhdGVMb2NhbCgwLCAwLCAxMDAwMDAwKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5uZWFyQ2xpcCA9IDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZmFyQ2xpcCA9IDIwMDAwMDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0ub3J0aG9IZWlnaHQgPSByYWRpdXM7XG5cbiAgICAgICAgICAgIC8vIGN1bGwgc2hhZG93IGNhc3RlcnNcbiAgICAgICAgICAgIHRoaXMuZm9yd2FyZFJlbmRlcmVyLnVwZGF0ZUNhbWVyYUZydXN0dW0oc2hhZG93Q2FtKTtcbiAgICAgICAgICAgIHRoaXMuY3VsbFNoYWRvd0Nhc3RlcnMoZHJhd0NhbGxzLCBsaWdodFJlbmRlckRhdGEudmlzaWJsZUNhc3RlcnMsIHNoYWRvd0NhbSk7XG5cbiAgICAgICAgICAgIC8vIGZpbmQgb3V0IEFBQkIgb2YgdmlzaWJsZSBzaGFkb3cgY2FzdGVyc1xuICAgICAgICAgICAgbGV0IGVtcHR5QWFiYiA9IHRydWU7XG4gICAgICAgICAgICBjb25zdCB2aXNpYmxlQ2FzdGVycyA9IGxpZ2h0UmVuZGVyRGF0YS52aXNpYmxlQ2FzdGVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmlzaWJsZUNhc3RlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB2aXNpYmxlQ2FzdGVyc1tpXTtcblxuICAgICAgICAgICAgICAgIGlmIChlbXB0eUFhYmIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1wdHlBYWJiID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVTY2VuZUFhYmIuY29weShtZXNoSW5zdGFuY2UuYWFiYik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZVNjZW5lQWFiYi5hZGQobWVzaEluc3RhbmNlLmFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGRlcHRoIHJhbmdlIG9mIHRoZSBjYXN0ZXIncyBBQUJCIGZyb20gdGhlIHBvaW50IG9mIHZpZXcgb2YgdGhlIHNoYWRvdyBjYW1lcmFcbiAgICAgICAgICAgIHNoYWRvd0NhbVZpZXcuY29weShzaGFkb3dDYW1Ob2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpLmludmVydCgpO1xuICAgICAgICAgICAgY29uc3QgZGVwdGhSYW5nZSA9IGdldERlcHRoUmFuZ2Uoc2hhZG93Q2FtVmlldywgdmlzaWJsZVNjZW5lQWFiYi5nZXRNaW4oKSwgdmlzaWJsZVNjZW5lQWFiYi5nZXRNYXgoKSk7XG5cbiAgICAgICAgICAgIC8vIGFkanVzdCBzaGFkb3cgY2FtZXJhJ3MgbmVhciBhbmQgZmFyIHBsYW5lIHRvIHRoZSBkZXB0aCByYW5nZSBvZiBjYXN0ZXJzIHRvIG1heGltaXplIHByZWNpc2lvblxuICAgICAgICAgICAgLy8gb2YgdmFsdWVzIHN0b3JlZCBpbiB0aGUgc2hhZG93IG1hcC4gTWFrZSBpdCBzbGlnaHRseSBsYXJnZXIgdG8gYXZvaWQgY2xpcHBpbmcgb24gbmVhciAvIGZhciBwbGFuZS5cbiAgICAgICAgICAgIHNoYWRvd0NhbU5vZGUudHJhbnNsYXRlTG9jYWwoMCwgMCwgZGVwdGhSYW5nZS5tYXggKyAwLjEpO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZhckNsaXAgPSBkZXB0aFJhbmdlLm1heCAtIGRlcHRoUmFuZ2UubWluICsgMC4yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLmZvcndhcmRSZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZGVwdGggYmlhc1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyh0cnVlKTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzVmFsdWVzKGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wLCBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFsxXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzBdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCBzdGFuZGFyZCBzaGFkb3dtYXAgc3RhdGVzXG4gICAgICAgIGRldmljZS5zZXRCbGVuZGluZyhmYWxzZSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhUZXN0KHRydWUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhGdW5jKEZVTkNfTEVTU0VRVUFMKTtcblxuICAgICAgICBjb25zdCB1c2VTaGFkb3dTYW1wbGVyID0gaXNDbHVzdGVyZWQgP1xuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGRldmljZS53ZWJnbDIgOiAgICAgLy8gYm90aCBzcG90IGFuZCBvbW5pIGxpZ2h0IGFyZSB1c2luZyBzaGFkb3cgc2FtcGxlciBvbiB3ZWJnbDIgd2hlbiBjbHVzdGVyZWRcbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuICAgICAgICBpZiAodXNlU2hhZG93U2FtcGxlcikge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXN0b3JlUmVuZGVyU3RhdGUoZGV2aWNlKSB7XG5cbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG5cbiAgICAgICAgLy8gcG9zaXRpb24gLyByYW5nZVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5mb3J3YXJkUmVuZGVyZXIuZGlzcGF0Y2hWaWV3UG9zKHNoYWRvd0NhbU5vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICB0aGlzLnNoYWRvd01hcExpZ2h0UmFkaXVzSWQuc2V0VmFsdWUobGlnaHQuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmlldy1wcm9qZWN0aW9uIHNoYWRvdyBtYXRyaXhcbiAgICAgICAgc2hhZG93Q2FtVmlldy5zZXRUUlMoc2hhZG93Q2FtTm9kZS5nZXRQb3NpdGlvbigpLCBzaGFkb3dDYW1Ob2RlLmdldFJvdGF0aW9uKCksIFZlYzMuT05FKS5pbnZlcnQoKTtcbiAgICAgICAgc2hhZG93Q2FtVmlld1Byb2oubXVsMihzaGFkb3dDYW0ucHJvamVjdGlvbk1hdHJpeCwgc2hhZG93Q2FtVmlldyk7XG5cbiAgICAgICAgLy8gdmlld3BvcnQgaGFuZGxpbmdcbiAgICAgICAgY29uc3QgcmVjdFZpZXdwb3J0ID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1ZpZXdwb3J0O1xuICAgICAgICBzaGFkb3dDYW0ucmVjdCA9IHJlY3RWaWV3cG9ydDtcbiAgICAgICAgc2hhZG93Q2FtLnNjaXNzb3JSZWN0ID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1NjaXNzb3I7XG5cbiAgICAgICAgdmlld3BvcnRNYXRyaXguc2V0Vmlld3BvcnQocmVjdFZpZXdwb3J0LngsIHJlY3RWaWV3cG9ydC55LCByZWN0Vmlld3BvcnQueiwgcmVjdFZpZXdwb3J0LncpO1xuICAgICAgICBsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4Lm11bDIodmlld3BvcnRNYXRyaXgsIHNoYWRvd0NhbVZpZXdQcm9qKTtcblxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgLy8gY29weSBtYXRyaXggdG8gc2hhZG93IGNhc2NhZGUgcGFsZXR0ZVxuICAgICAgICAgICAgbGlnaHQuX3NoYWRvd01hdHJpeFBhbGV0dGUuc2V0KGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXguZGF0YSwgZmFjZSAqIDE2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IHZpc2libGVDYXN0ZXJzIC0gVmlzaWJsZSBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge0xpZ2h0fSBsaWdodCAtIFRoZSBsaWdodC5cbiAgICAgKi9cbiAgICBzdWJtaXRDYXN0ZXJzKHZpc2libGVDYXN0ZXJzLCBsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBmb3J3YXJkUmVuZGVyZXIgPSB0aGlzLmZvcndhcmRSZW5kZXJlcjtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBmb3J3YXJkUmVuZGVyZXIuc2NlbmU7XG4gICAgICAgIGNvbnN0IHBhc3NGbGFncyA9IDEgPDwgU0hBREVSX1NIQURPVztcblxuICAgICAgICAvLyBTb3J0IHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIGNvbnN0IHNoYWRvd1Bhc3MgPSBTaGFkZXJQYXNzLmdldFNoYWRvdyhsaWdodC5fdHlwZSwgbGlnaHQuX3NoYWRvd1R5cGUpO1xuXG4gICAgICAgIC8vIFJlbmRlclxuICAgICAgICBjb25zdCBjb3VudCA9IHZpc2libGVDYXN0ZXJzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB2aXNpYmxlQ2FzdGVyc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2UubWVzaDtcblxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmVuc3VyZU1hdGVyaWFsKGRldmljZSk7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG1lc2hJbnN0YW5jZS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgLy8gc2V0IGJhc2ljIG1hdGVyaWFsIHN0YXRlcy9wYXJhbWV0ZXJzXG4gICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0QmFzZUNvbnN0YW50cyhkZXZpY2UsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgIGZvcndhcmRSZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGlydHkpIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuY2h1bmtzKSB7XG5cbiAgICAgICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0Q3VsbE1vZGUodHJ1ZSwgZmFsc2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJIChzaGFkb3cpOiBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIElJIChzaGFkb3cpOiBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzXG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBwYXNzRmxhZ3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgc2hhZGVyXG4gICAgICAgICAgICBsZXQgc2hhZG93U2hhZGVyID0gbWVzaEluc3RhbmNlLl9zaGFkZXJbc2hhZG93UGFzc107XG4gICAgICAgICAgICBpZiAoIXNoYWRvd1NoYWRlcikge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBzaGFkb3dQYXNzKTtcbiAgICAgICAgICAgICAgICBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuX2tleVtTT1JUS0VZX0RFUFRIXSA9IGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNoYWRvd1NoYWRlci5mYWlsZWQgJiYgIWRldmljZS5zZXRTaGFkZXIoc2hhZG93U2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBFcnJvciBjb21waWxpbmcgc2hhZG93IHNoYWRlciBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7c2hhZG93UGFzc31gLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBidWZmZXJzXG4gICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgZm9yd2FyZFJlbmRlcmVyLnNldE1vcnBoaW5nKGRldmljZSwgbWVzaEluc3RhbmNlLm1vcnBoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IG1lc2hJbnN0YW5jZS5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgIGRldmljZS5zZXRJbmRleEJ1ZmZlcihtZXNoLmluZGV4QnVmZmVyW3N0eWxlXSk7XG5cbiAgICAgICAgICAgIC8vIGRyYXdcbiAgICAgICAgICAgIGZvcndhcmRSZW5kZXJlci5kcmF3SW5zdGFuY2UoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgIGZvcndhcmRSZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzKys7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSkge1xuXG4gICAgICAgIGlmIChsaWdodC5lbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgICAgICBpZiAobGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfTk9ORTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IGxpZ2h0Ll9zaGFkb3dUeXBlO1xuICAgICAgICAgICAgY29uc3QgZmFjZUNvdW50ID0gbGlnaHQubnVtU2hhZG93RmFjZXM7XG5cbiAgICAgICAgICAgIGNvbnN0IGZvcndhcmRSZW5kZXJlciA9IHRoaXMuZm9yd2FyZFJlbmRlcmVyO1xuICAgICAgICAgICAgZm9yd2FyZFJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzICs9IGZhY2VDb3VudDtcbiAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gZm9yd2FyZFJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYFNIQURPVyAke2xpZ2h0Ll9ub2RlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KTtcblxuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYEZBQ0UgJHtmYWNlfWApO1xuXG4gICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgc2hhZG93cyBhcmUgcGVyIGNhbWVyYSwgc28gZ2V0IGFwcHJvcHJpYXRlIHJlbmRlciBkYXRhXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YSh0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCBmYWNlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgICAgICAgICAgLy8gY2FtZXJhIGNsZWFyIHNldHRpbmdcbiAgICAgICAgICAgICAgICAvLyBOb3RlOiB3aGVuIGNsdXN0ZXJlZCBsaWdodGluZyBpcyB0aGUgb25seSBsaWdodCB0eXBlLCB0aGlzIGNvZGUgY2FuIGJlIG1vdmVkIHRvIGNyZWF0ZVNoYWRvd0NhbWVyYSBmdW5jdGlvblxuICAgICAgICAgICAgICAgIFNoYWRvd1JlbmRlcmVyLnNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCk7XG5cbiAgICAgICAgICAgICAgICAvLyBhc3NpZ24gcmVuZGVyIHRhcmdldCBmb3IgdGhlIGZhY2VcbiAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJUYXJnZXRJbmRleCA9IHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IDAgOiBmYWNlO1xuICAgICAgICAgICAgICAgIHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQgPSBsaWdodC5fc2hhZG93TWFwLnJlbmRlclRhcmdldHNbcmVuZGVyVGFyZ2V0SW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSk7XG5cbiAgICAgICAgICAgICAgICBmb3J3YXJkUmVuZGVyZXIuc2V0Q2FtZXJhKHNoYWRvd0NhbSwgc2hhZG93Q2FtLnJlbmRlclRhcmdldCwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICB0aGlzLnN1Ym1pdENhc3RlcnMobGlnaHRSZW5kZXJEYXRhLnZpc2libGVDYXN0ZXJzLCBsaWdodCk7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWU00gYmx1clxuICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1ZzbSAmJiBsaWdodC5fdnNtQmx1clNpemUgPiAxKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBhbGwgbm9uLWNsdXN0ZXJlZCBhbmQgZGlyZWN0aW9uYWwgbGlnaHRzIHN1cHBvcnQgdnNtXG4gICAgICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLmZvcndhcmRSZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCB8fCB0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBseVZzbUJsdXIobGlnaHQsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpO1xuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnVlNNJyk7XG5cbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gY2FtZXJhIDogbnVsbCwgMCk7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG4gICAgICAgIGNvbnN0IG9yaWdTaGFkb3dNYXAgPSBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIHRlbXBvcmFyeSByZW5kZXIgdGFyZ2V0IGZvciBibHVycmluZ1xuICAgICAgICAvLyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBvcHRpbWFsIGFuZCBzaGFkb3cgbWFwIGNvdWxkIGhhdmUgZGVwdGggYnVmZmVyIG9uIGluIGFkZGl0aW9uIHRvIGNvbG9yIGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGZvciBibHVycmluZyBvbmx5IG9uZSBidWZmZXIgaXMgbmVlZGVkLlxuICAgICAgICBjb25zdCB0ZW1wU2hhZG93TWFwID0gdGhpcy5zaGFkb3dNYXBDYWNoZS5nZXQoZGV2aWNlLCBsaWdodCk7XG4gICAgICAgIGNvbnN0IHRlbXBSdCA9IHRlbXBTaGFkb3dNYXAucmVuZGVyVGFyZ2V0c1swXTtcblxuICAgICAgICBjb25zdCBpc1ZzbTggPSBsaWdodC5fc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTg7XG4gICAgICAgIGNvbnN0IGJsdXJNb2RlID0gbGlnaHQudnNtQmx1ck1vZGU7XG4gICAgICAgIGNvbnN0IGZpbHRlclNpemUgPSBsaWdodC5fdnNtQmx1clNpemU7XG4gICAgICAgIGNvbnN0IGJsdXJTaGFkZXIgPSB0aGlzLmdldFZzbUJsdXJTaGFkZXIoaXNWc204LCBibHVyTW9kZSwgZmlsdGVyU2l6ZSk7XG5cbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LnogPSBsaWdodC5fc2hhZG93UmVzb2x1dGlvbiAtIDI7XG4gICAgICAgIGJsdXJTY2lzc29yUmVjdC53ID0gYmx1clNjaXNzb3JSZWN0Lno7XG5cbiAgICAgICAgLy8gQmx1ciBob3Jpem9udGFsXG4gICAgICAgIHRoaXMuc291cmNlSWQuc2V0VmFsdWUob3JpZ1NoYWRvd01hcC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMSAvIGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICBwaXhlbE9mZnNldFsxXSA9IDA7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZC5zZXRWYWx1ZShwaXhlbE9mZnNldCk7XG4gICAgICAgIGlmIChibHVyTW9kZSA9PT0gQkxVUl9HQVVTU0lBTikgdGhpcy53ZWlnaHRJZC5zZXRWYWx1ZSh0aGlzLmJsdXJWc21XZWlnaHRzW2ZpbHRlclNpemVdKTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGVtcFJ0LCBibHVyU2hhZGVyLCBudWxsLCBibHVyU2Npc3NvclJlY3QpO1xuXG4gICAgICAgIC8vIEJsdXIgdmVydGljYWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZSh0ZW1wUnQuY29sb3JCdWZmZXIpO1xuICAgICAgICBwaXhlbE9mZnNldFsxXSA9IHBpeGVsT2Zmc2V0WzBdO1xuICAgICAgICBwaXhlbE9mZnNldFswXSA9IDA7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZC5zZXRWYWx1ZShwaXhlbE9mZnNldCk7XG4gICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIG9yaWdTaGFkb3dNYXAsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSB0ZW1wb3Jhcnkgc2hhZG93IG1hcCBiYWNrIHRvIHRoZSBjYWNoZVxuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlLmFkZChsaWdodCwgdGVtcFNoYWRvd01hcCk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNoYWRvd1JlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsiYWFiYlBvaW50cyIsIlZlYzMiLCJfZGVwdGhSYW5nZSIsIm1pbiIsIm1heCIsImdldERlcHRoUmFuZ2UiLCJjYW1lcmFWaWV3TWF0cml4IiwiYWFiYk1pbiIsImFhYmJNYXgiLCJ4IiwieSIsInoiLCJtaW56IiwibWF4eiIsImkiLCJ0cmFuc2Zvcm1Qb2ludCIsImdhdXNzIiwic2lnbWEiLCJNYXRoIiwiZXhwIiwibWF4Qmx1clNpemUiLCJnYXVzc1dlaWdodHMiLCJrZXJuZWxTaXplIiwiaGFsZldpZHRoIiwidmFsdWVzIiwiQXJyYXkiLCJzdW0iLCJ2aXNpYmxlU2NlbmVBYWJiIiwiQm91bmRpbmdCb3giLCJzaGFkb3dDYW1WaWV3IiwiTWF0NCIsInNoYWRvd0NhbVZpZXdQcm9qIiwicGl4ZWxPZmZzZXQiLCJGbG9hdDMyQXJyYXkiLCJibHVyU2Npc3NvclJlY3QiLCJWZWM0Iiwib3BDaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwiY2VudGVyIiwidmlld3BvcnRNYXRyaXgiLCJnZXREZXB0aEtleSIsIm1lc2hJbnN0YW5jZSIsIm1hdGVyaWFsIiwic2tpbkluc3RhbmNlIiwib3BhY2l0eU1hcCIsIm9wQ2hhbiIsIm9wYWNpdHlNYXBDaGFubmVsIiwiU2hhZG93UmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImZvcndhcmRSZW5kZXJlciIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiZGV2aWNlIiwic2NvcGUiLCJwb2x5Z29uT2Zmc2V0SWQiLCJyZXNvbHZlIiwicG9seWdvbk9mZnNldCIsInNvdXJjZUlkIiwicGl4ZWxPZmZzZXRJZCIsIndlaWdodElkIiwiYmx1clZzbVNoYWRlckNvZGUiLCJzaGFkZXJDaHVua3MiLCJibHVyVlNNUFMiLCJwYWNrZWQiLCJibHVyUGFja2VkVnNtU2hhZGVyQ29kZSIsImJsdXJWc21TaGFkZXIiLCJibHVyUGFja2VkVnNtU2hhZGVyIiwiYmx1clZzbVdlaWdodHMiLCJzaGFkb3dNYXBMaWdodFJhZGl1c0lkIiwic2hhZG93TWFwQ2FjaGUiLCJTaGFkb3dNYXBDYWNoZSIsImRlc3Ryb3kiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJzaGFkb3dUeXBlIiwidHlwZSIsImZhY2UiLCJzaGFkb3dDYW0iLCJMaWdodENhbWVyYSIsImNyZWF0ZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTMyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInNldFNoYWRvd0NhbWVyYVNldHRpbmdzIiwiaXNDbHVzdGVyZWQiLCJod1BjZiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjMiLCJ3ZWJnbDIiLCJMSUdIVFRZUEVfT01OSSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjdWxsU2hhZG93Q2FzdGVycyIsIm1lc2hJbnN0YW5jZXMiLCJ2aXNpYmxlIiwiY2FtZXJhIiwiY291bnQiLCJudW1JbnN0YW5jZXMiLCJsZW5ndGgiLCJjdWxsIiwiX2lzVmlzaWJsZSIsInZpc2libGVUaGlzRnJhbWUiLCJzb3J0IiwiZGVwdGhTb3J0Q29tcGFyZSIsImN1bGxMb2NhbCIsImxpZ2h0IiwiZHJhd0NhbGxzIiwic2NlbmUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJfc2hhZG93TWFwIiwiU2hhZG93TWFwIiwiX3R5cGUiLCJmYWNlQ291bnQiLCJMSUdIVFRZUEVfU1BPVCIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzaGFkb3dDYW1lcmEiLCJuZWFyQ2xpcCIsImF0dGVudWF0aW9uRW5kIiwiZmFyQ2xpcCIsInNoYWRvd0NhbU5vZGUiLCJfbm9kZSIsImxpZ2h0Tm9kZSIsInNldFBvc2l0aW9uIiwiZ2V0UG9zaXRpb24iLCJmb3YiLCJfb3V0ZXJDb25lQW5nbGUiLCJzZXRSb3RhdGlvbiIsImdldFJvdGF0aW9uIiwicm90YXRlTG9jYWwiLCJ0aWxlU2l6ZSIsInNoYWRvd0F0bGFzUmVzb2x1dGlvbiIsImF0bGFzVmlld3BvcnQiLCJ0ZXhlbFNpemUiLCJmaWx0ZXJTaXplIiwic2hhZG93RWRnZVBpeGVscyIsImF0YW4iLCJtYXRoIiwiUkFEX1RPX0RFRyIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJ2aXNpYmxlQ2FzdGVycyIsImdlbmVyYXRlU3BsaXREaXN0YW5jZXMiLCJuZWFyRGlzdCIsImZhckRpc3QiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsImZpbGwiLCJudW1DYXNjYWRlcyIsImZyYWN0aW9uIiwibGluZWFyRGlzdCIsImxvZ0Rpc3QiLCJkaXN0IiwibGVycCIsImNhc2NhZGVEaXN0cmlidXRpb24iLCJjdWxsRGlyZWN0aW9uYWwiLCJfbmVhckNsaXAiLCJzaGFkb3dEaXN0YW5jZSIsImNhc2NhZGUiLCJyZW5kZXJUYXJnZXQiLCJyZW5kZXJUYXJnZXRzIiwic2hhZG93Vmlld3BvcnQiLCJjb3B5IiwiY2FzY2FkZXMiLCJzaGFkb3dTY2lzc29yIiwiZnJ1c3R1bU5lYXJEaXN0IiwiZnJ1c3R1bUZhckRpc3QiLCJmcnVzdHVtUG9pbnRzIiwiRnJ1c3R1bSIsImdldFBvaW50cyIsInNldCIsImNhbWVyYVdvcmxkTWF0Iiwibm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiYWRkIiwibXVsU2NhbGFyIiwicmFkaXVzIiwic3ViIiwicmlnaHQiLCJ1cCIsImxpZ2h0RGlyIiwiZm9yd2FyZCIsInNpemVSYXRpbyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwiY2VpbCIsImRvdCIsInNjYWxlZFVwIiwic2NhbGVkUmlnaHQiLCJzY2FsZWREaXIiLCJhZGQyIiwidHJhbnNsYXRlTG9jYWwiLCJvcnRob0hlaWdodCIsImVtcHR5QWFiYiIsImFhYmIiLCJpbnZlcnQiLCJkZXB0aFJhbmdlIiwiZ2V0TWluIiwiZ2V0TWF4Iiwic2V0dXBSZW5kZXJTdGF0ZSIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsInNoYWRvd0JpYXMiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwic2V0VmFsdWUiLCJzZXRCbGVuZGluZyIsInNldERlcHRoV3JpdGUiLCJzZXREZXB0aFRlc3QiLCJzZXREZXB0aEZ1bmMiLCJGVU5DX0xFU1NFUVVBTCIsInVzZVNoYWRvd1NhbXBsZXIiLCJfaXNQY2YiLCJzZXRDb2xvcldyaXRlIiwicmVzdG9yZVJlbmRlclN0YXRlIiwiZGlzcGF0Y2hVbmlmb3JtcyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImRpc3BhdGNoVmlld1BvcyIsInNldFRSUyIsIk9ORSIsIm11bDIiLCJwcm9qZWN0aW9uTWF0cml4IiwicmVjdFZpZXdwb3J0IiwicmVjdCIsInNjaXNzb3JSZWN0Iiwic2V0Vmlld3BvcnQiLCJ3Iiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJkYXRhIiwic3VibWl0Q2FzdGVycyIsInBhc3NGbGFncyIsIlNIQURFUl9TSEFET1ciLCJzaGFkb3dQYXNzIiwiU2hhZGVyUGFzcyIsImdldFNoYWRvdyIsIl9zaGFkb3dUeXBlIiwibWVzaCIsImVuc3VyZU1hdGVyaWFsIiwic2V0QmFzZUNvbnN0YW50cyIsInNldFNraW5uaW5nIiwiZGlydHkiLCJ1cGRhdGVVbmlmb3JtcyIsImNodW5rcyIsInNldEN1bGxNb2RlIiwic2V0UGFyYW1ldGVycyIsInNoYWRvd1NoYWRlciIsIl9zaGFkZXIiLCJ1cGRhdGVQYXNzU2hhZGVyIiwiX2tleSIsIlNPUlRLRVlfREVQVEgiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJEZWJ1ZyIsImVycm9yIiwibmFtZSIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRNb3JwaGluZyIsIm1vcnBoSW5zdGFuY2UiLCJzdHlsZSIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsImRyYXdJbnN0YW5jZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJyZW5kZXIiLCJlbmFibGVkIiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwibnVtU2hhZG93RmFjZXMiLCJfc2hhZG93TWFwVXBkYXRlcyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwicmVuZGVyVGFyZ2V0SW5kZXgiLCJzZXRDYW1lcmEiLCJwb3BHcHVNYXJrZXIiLCJfaXNWc20iLCJfdnNtQmx1clNpemUiLCJhcHBseVZzbUJsdXIiLCJnZXRWc21CbHVyU2hhZGVyIiwiaXNWc204IiwiYmx1ck1vZGUiLCJibHVyU2hhZGVyIiwiYmx1clZTIiwiZnVsbHNjcmVlblF1YWRWUyIsImJsdXJGUyIsImJsdXJTaGFkZXJOYW1lIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJvcmlnU2hhZG93TWFwIiwidGVtcFNoYWRvd01hcCIsImdldCIsInRlbXBSdCIsInZzbUJsdXJNb2RlIiwiY29sb3JCdWZmZXIiLCJCTFVSX0dBVVNTSUFOIiwiZHJhd1F1YWRXaXRoU2hhZGVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7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
