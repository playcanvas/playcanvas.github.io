import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT } from '../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF1, SHADOW_PCF3, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

function gauss(x, sigma) {
  return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}
function gaussWeights(kernelSize) {
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
const tempSet = new Set();
const shadowCamView = new Mat4();
const shadowCamViewProj = new Mat4();
const pixelOffset = new Float32Array(2);
const blurScissorRect = new Vec4(1, 1, 0, 0);
const viewportMatrix = new Mat4();
class ShadowRenderer {
  constructor(renderer, lightTextureAtlas) {
    this.shadowPassCache = [];
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
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;
    this.blendStateWrite = new BlendState();
    this.blendStateNoWrite = new BlendState();
    this.blendStateNoWrite.setColorWrite(false, false, false, false);
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
    let hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF1 || shadowType === SHADOW_PCF3) && device.supportsDepthShadow;
    if (type === LIGHTTYPE_OMNI && !isClustered) {
      hwPcf = false;
    }
    shadowCam.clearColorBuffer = !hwPcf;
  }
  _cullShadowCastersInternal(meshInstances, visible, camera) {
    const numInstances = meshInstances.length;
    for (let i = 0; i < numInstances; i++) {
      const meshInstance = meshInstances[i];
      if (meshInstance.castShadow) {
        if (!meshInstance.cull || meshInstance._isVisible(camera)) {
          meshInstance.visibleThisFrame = true;
          visible.push(meshInstance);
        }
      }
    }
  }
  cullShadowCasters(comp, light, visible, camera, casters) {
    visible.length = 0;
    if (casters) {
      this._cullShadowCastersInternal(casters, visible, camera);
    } else {
      const layers = comp.layerList;
      const len = layers.length;
      for (let i = 0; i < len; i++) {
        const layer = layers[i];
        if (layer._lightsSet.has(light)) {
          if (!tempSet.has(layer)) {
            tempSet.add(layer);
            this._cullShadowCastersInternal(layer.shadowCasters, visible, camera);
          }
        }
      }
      tempSet.clear();
    }
    visible.sort(this.renderer.sortCompareDepth);
  }
  setupRenderState(device, light) {
    if (device.isWebGL1 && device.extStandardDerivatives) {
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
    const isClustered = this.renderer.scene.clusteredLightingEnabled;
    const gpuOrGl2 = device.isWebGL2 || device.isWebGPU;
    const useShadowSampler = isClustered ? light._isPcf && gpuOrGl2 : light._isPcf && gpuOrGl2 && light._type !== LIGHTTYPE_OMNI;
    device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
    device.setDepthState(light.shadowDepthState);
    device.setStencilState(null, null);
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
  getShadowPass(light) {
    var _this$shadowPassCache;
    const lightType = light._type;
    const shadowType = light._shadowType;
    let shadowPassInfo = (_this$shadowPassCache = this.shadowPassCache[lightType]) == null ? void 0 : _this$shadowPassCache[shadowType];
    if (!shadowPassInfo) {
      const shadowPassName = `ShadowPass_${lightType}_${shadowType}`;
      shadowPassInfo = ShaderPass.get(this.device).allocate(shadowPassName, {
        isShadow: true,
        lightType: lightType,
        shadowType: shadowType
      });
      if (!this.shadowPassCache[lightType]) this.shadowPassCache[lightType] = [];
      this.shadowPassCache[lightType][shadowType] = shadowPassInfo;
    }
    return shadowPassInfo.index;
  }
  submitCasters(visibleCasters, light) {
    const device = this.device;
    const renderer = this.renderer;
    const scene = renderer.scene;
    const passFlags = 1 << SHADER_SHADOW;
    const shadowPass = this.getShadowPass(light);
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
        renderer.setupCullMode(true, 1, meshInstance);
        material.setParameters(device);
        meshInstance.setParameters(device, passFlags);
      }
      const shaderInstance = meshInstance.getShaderInstance(shadowPass, 0, scene, this.viewUniformFormat, this.viewBindGroupFormat);
      const shadowShader = shaderInstance.shader;
      meshInstance._key[SORTKEY_DEPTH] = shadowShader.id;
      device.setShader(shadowShader);
      renderer.setVertexBuffers(device, mesh);
      renderer.setMorphing(device, meshInstance.morphInstance);
      this.renderer.setupMeshUniformBuffers(shaderInstance, meshInstance);
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
    if (needs) {
      this.renderer._shadowMapUpdates += light.numShadowFaces;
    }
    return needs;
  }
  getLightRenderData(light, camera, face) {
    return light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
  }
  setupRenderPass(renderPass, shadowCamera, clearRenderTarget) {
    const rt = shadowCamera.renderTarget;
    renderPass.init(rt);
    renderPass.depthStencilOps.clearDepthValue = 1;
    renderPass.depthStencilOps.clearDepth = clearRenderTarget;
    if (rt.depthBuffer) {
      renderPass.depthStencilOps.storeDepth = true;
    } else {
      renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);
      renderPass.colorOps.clear = clearRenderTarget;
      renderPass.depthStencilOps.storeDepth = false;
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
  renderFace(light, camera, face, clear, insideRenderPass = true) {
    const device = this.device;
    const lightRenderData = this.getLightRenderData(light, camera, face);
    const shadowCam = lightRenderData.shadowCamera;
    this.dispatchUniforms(light, shadowCam, lightRenderData, face);
    const rt = shadowCam.renderTarget;
    const renderer = this.renderer;
    renderer.setCameraUniforms(shadowCam, rt);
    if (device.supportsUniformBuffers) {
      renderer.setupViewUniformBuffers(lightRenderData.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, 1);
    }
    if (insideRenderPass) {
      renderer.setupViewport(shadowCam, rt);
      if (clear) {
        renderer.clear(shadowCam);
      }
    } else {
      renderer.clearView(shadowCam, rt, true, false);
    }
    this.setupRenderState(device, light);
    this.submitCasters(lightRenderData.visibleCasters, light);
  }
  render(light, camera, insideRenderPass = true) {
    if (this.needsShadowRendering(light)) {
      const faceCount = light.numShadowFaces;
      for (let face = 0; face < faceCount; face++) {
        this.prepareFace(light, camera, face);
        this.renderFace(light, camera, face, true, insideRenderPass);
      }
      this.renderVsm(light, camera);
    }
  }
  renderVsm(light, camera) {
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
    device.setBlendState(BlendState.NOBLEND);
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
  }
  initViewBindGroupFormat() {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      this.viewUniformFormat = new UniformBufferFormat(this.device, [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)]);
      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)]);
    }
  }
  frameUpdate() {
    this.initViewBindGroupFormat();
  }
}

export { ShadowRenderer };
