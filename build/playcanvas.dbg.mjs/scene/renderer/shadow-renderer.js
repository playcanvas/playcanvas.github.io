/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF3, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';

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

/**
 * @ignore
 */
class ShadowRenderer {
  /**
   * @param {import('./renderer.js').Renderer} renderer - The renderer.
   * @param {import('../lighting/light-texture-atlas.js').LightTextureAtlas} lightTextureAtlas - The
   * shadow map atlas.
   */
  constructor(renderer, lightTextureAtlas) {
    this.device = renderer.device;

    /** @type {import('./renderer.js').Renderer} */
    this.renderer = renderer;

    /** @type {import('../lighting/light-texture-atlas.js').LightTextureAtlas} */
    this.lightTextureAtlas = lightTextureAtlas;
    const scope = this.device.scope;
    this.polygonOffsetId = scope.resolve('polygonOffset');
    this.polygonOffset = new Float32Array(2);

    // VSM
    this.sourceId = scope.resolve('source');
    this.pixelOffsetId = scope.resolve('pixelOffset');
    this.weightId = scope.resolve('weight[0]');
    this.blurVsmShaderCode = [shaderChunks.blurVSMPS, '#define GAUSS\n' + shaderChunks.blurVSMPS];
    const packed = '#define PACKED\n';
    this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];

    // cache for vsm blur shaders
    this.blurVsmShader = [{}, {}];
    this.blurPackedVsmShader = [{}, {}];
    this.blurVsmWeights = {};

    // uniforms
    this.shadowMapLightRadiusId = scope.resolve('light_radius');

    // view bind group format with its uniform buffer format
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;

    // blend states
    this.blendStateWrite = new BlendState();
    this.blendStateNoWrite = new BlendState();
    this.blendStateNoWrite.setColorWrite(false, false, false, false);
  }

  // creates shadow camera for a light and sets up its constant properties
  static createShadowCamera(device, shadowType, type, face) {
    const shadowCam = LightCamera.create('ShadowCamera', type, face);

    // don't clear the color buffer if rendering a depth map
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
    // normal omni shadows on webgl2 encode depth in RGBA8 and do manual PCF sampling
    // clustered omni shadows on webgl2 use depth format and hardware PCF sampling
    let hwPcf = shadowType === SHADOW_PCF5 || shadowType === SHADOW_PCF3 && device.supportsDepthShadow;
    if (type === LIGHTTYPE_OMNI && !isClustered) {
      hwPcf = false;
    }
    shadowCam.clearColorBuffer = !hwPcf;
  }

  // culls the list of meshes instances by the camera, storing visible mesh instances in the specified array
  cullShadowCasters(meshInstances, visible, camera) {
    let count = 0;
    const numInstances = meshInstances.length;
    for (let i = 0; i < numInstances; i++) {
      const meshInstance = meshInstances[i];
      if (meshInstance.castShadow) {
        if (!meshInstance.cull || meshInstance._isVisible(camera)) {
          meshInstance.visibleThisFrame = true;
          visible[count] = meshInstance;
          count++;
        }
      }
    }
    visible.length = count;

    // TODO: we should probably sort shadow meshes by shader and not depth
    visible.sort(this.renderer.sortCompareDepth);
  }
  setupRenderState(device, light) {
    const isClustered = this.renderer.scene.clusteredLightingEnabled;

    // depth bias
    if (device.webgl2 || device.isWebGPU) {
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

    // Set standard shadowmap states
    const useShadowSampler = isClustered ? light._isPcf && device.webgl2 :
    // both spot and omni light are using shadow sampler on webgl2 when clustered
    light._isPcf && device.webgl2 && light._type !== LIGHTTYPE_OMNI; // for non-clustered, point light is using depth encoded in color buffer (should change to shadow sampler)

    device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
    device.setDepthState(DepthState.DEFAULT);
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

    // position / range
    if (light._type !== LIGHTTYPE_DIRECTIONAL) {
      this.renderer.dispatchViewPos(shadowCamNode.getPosition());
      this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
    }

    // view-projection shadow matrix
    shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
    shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);

    // viewport handling
    const rectViewport = lightRenderData.shadowViewport;
    shadowCam.rect = rectViewport;
    shadowCam.scissorRect = lightRenderData.shadowScissor;
    viewportMatrix.setViewport(rectViewport.x, rectViewport.y, rectViewport.z, rectViewport.w);
    lightRenderData.shadowMatrix.mul2(viewportMatrix, shadowCamViewProj);
    if (light._type === LIGHTTYPE_DIRECTIONAL) {
      // copy matrix to shadow cascade palette
      light._shadowMatrixPalette.set(lightRenderData.shadowMatrix.data, face * 16);
    }
  }

  /**
   * @param {import('../mesh-instance.js').MeshInstance[]} visibleCasters - Visible mesh
   * instances.
   * @param {import('../light.js').Light} light - The light.
   */
  submitCasters(visibleCasters, light) {
    const device = this.device;
    const renderer = this.renderer;
    const scene = renderer.scene;
    const passFlags = 1 << SHADER_SHADOW;

    // Sort shadow casters
    const shadowPass = ShaderPass.getShadow(light._type, light._shadowType);

    // TODO: Similarly to forward renderer, a shader creation part of this loop should be split into a separate loop,
    // and endShaderBatch should be called at its end

    // Render
    const count = visibleCasters.length;
    for (let i = 0; i < count; i++) {
      const meshInstance = visibleCasters[i];
      const mesh = meshInstance.mesh;
      meshInstance.ensureMaterial(device);
      const material = meshInstance.material;

      // set basic material states/parameters
      renderer.setBaseConstants(device, material);
      renderer.setSkinning(device, meshInstance);
      if (material.dirty) {
        material.updateUniforms(device, scene);
        material.dirty = false;
      }
      if (material.chunks) {
        renderer.setupCullMode(true, 1, meshInstance);

        // Uniforms I (shadow): material
        material.setParameters(device);

        // Uniforms II (shadow): meshInstance overrides
        meshInstance.setParameters(device, passFlags);
      }

      // set shader
      let shadowShader = meshInstance._shader[shadowPass];
      if (!shadowShader) {
        meshInstance.updatePassShader(scene, shadowPass, null, null, this.viewUniformFormat, this.viewBindGroupFormat);
        shadowShader = meshInstance._shader[shadowPass];
        meshInstance._key[SORTKEY_DEPTH] = getDepthKey(meshInstance);
      }
      if (!shadowShader.failed && !device.setShader(shadowShader)) {
        Debug.error(`Error compiling shadow shader for material=${material.name} pass=${shadowPass}`, material);
      }

      // set buffers
      renderer.setVertexBuffers(device, mesh);
      renderer.setMorphing(device, meshInstance.morphInstance);
      this.renderer.setupMeshUniformBuffers(meshInstance, shadowPass);
      const style = meshInstance.renderStyle;
      device.setIndexBuffer(mesh.indexBuffer[style]);

      // draw
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
    // directional shadows are per camera, so get appropriate render data
    return light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
  }
  setupRenderPass(renderPass, shadowCamera, clearRenderTarget) {
    const rt = shadowCamera.renderTarget;
    renderPass.init(rt);
    renderPass.depthStencilOps.clearDepthValue = 1;
    renderPass.depthStencilOps.clearDepth = clearRenderTarget;

    // if rendering to depth buffer
    if (rt.depthBuffer) {
      renderPass.depthStencilOps.storeDepth = true;
    } else {
      // rendering to color buffer

      renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);
      renderPass.colorOps.clear = clearRenderTarget;
      renderPass.depthStencilOps.storeDepth = false;
    }

    // not sampling dynamically generated cubemaps
    renderPass.requiresCubemaps = false;
  }

  // prepares render target / render target settings to allow render pass to be set up
  prepareFace(light, camera, face) {
    const type = light._type;
    const shadowType = light._shadowType;
    const isClustered = this.renderer.scene.clusteredLightingEnabled;
    const lightRenderData = this.getLightRenderData(light, camera, face);
    const shadowCam = lightRenderData.shadowCamera;

    // camera clear setting
    // Note: when clustered lighting is the only lighting type, this code can be moved to createShadowCamera function
    ShadowRenderer.setShadowCameraSettings(shadowCam, this.device, shadowType, type, isClustered);

    // assign render target for the face
    const renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
    shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];
    return shadowCam;
  }
  renderFace(light, camera, face, clear, insideRenderPass = true) {
    const device = this.device;
    const shadowMapStartTime = now();
    DebugGraphics.pushGpuMarker(device, `SHADOW ${light._node.name} FACE ${face}`);
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

      // clear here is used to clear a viewport inside render target.
      if (clear) {
        renderer.clear(shadowCam);
      }
    } else {
      // this is only used by lightmapper, till it's converted to render passes
      renderer.clearView(shadowCam, rt, true, false);
    }
    this.setupRenderState(device, light);

    // render mesh instances
    this.submitCasters(lightRenderData.visibleCasters, light);
    this.restoreRenderState(device);
    DebugGraphics.popGpuMarker(device);
    renderer._shadowMapTime += now() - shadowMapStartTime;
  }
  render(light, camera, insideRenderPass = true) {
    if (this.needsShadowRendering(light)) {
      const faceCount = light.numShadowFaces;

      // render faces
      for (let face = 0; face < faceCount; face++) {
        this.prepareFace(light, camera, face);
        this.renderFace(light, camera, face, true, insideRenderPass);
      }

      // apply vsm
      this.renderVms(light, camera);
    }
  }
  renderVms(light, camera) {
    // VSM blur if light supports vsm (directional and spot in general)
    if (light._isVsm && light._vsmBlurSize > 1) {
      // in clustered mode, only directional light can be vms
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

    // render state
    device.setBlendState(BlendState.DEFAULT);
    const lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
    const shadowCam = lightRenderData.shadowCamera;
    const origShadowMap = shadowCam.renderTarget;

    // temporary render target for blurring
    // TODO: this is probably not optimal and shadow map could have depth buffer on in addition to color buffer,
    // and for blurring only one buffer is needed.
    const tempShadowMap = this.renderer.shadowMapCache.get(device, light);
    const tempRt = tempShadowMap.renderTargets[0];
    const isVsm8 = light._shadowType === SHADOW_VSM8;
    const blurMode = light.vsmBlurMode;
    const filterSize = light._vsmBlurSize;
    const blurShader = this.getVsmBlurShader(isVsm8, blurMode, filterSize);
    blurScissorRect.z = light._shadowResolution - 2;
    blurScissorRect.w = blurScissorRect.z;

    // Blur horizontal
    this.sourceId.setValue(origShadowMap.colorBuffer);
    pixelOffset[0] = 1 / light._shadowResolution;
    pixelOffset[1] = 0;
    this.pixelOffsetId.setValue(pixelOffset);
    if (blurMode === BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
    drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);

    // Blur vertical
    this.sourceId.setValue(tempRt.colorBuffer);
    pixelOffset[1] = pixelOffset[0];
    pixelOffset[0] = 0;
    this.pixelOffsetId.setValue(pixelOffset);
    drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);

    // return the temporary shadow map back to the cache
    this.renderer.shadowMapCache.add(light, tempShadowMap);
    DebugGraphics.popGpuMarker(device);
  }
  initViewBindGroupFormat() {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      // format of the view uniform buffer
      this.viewUniformFormat = new UniformBufferFormat(this.device, [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)]);

      // format of the view bind group - contains single uniform buffer, and no textures
      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)], []);
    }
  }
  frameUpdate() {
    this.initViewBindGroupFormat();
  }
}

export { ShadowRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBTSEFERVJTVEFHRV9GUkFHTUVOVCwgU0hBREVSU1RBR0VfVkVSVEVYLCBVTklGT1JNVFlQRV9NQVQ0LCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSxcbiAgICBTSEFERVJfU0hBRE9XLFxuICAgIFNIQURPV19QQ0YzLCBTSEFET1dfUENGNSwgU0hBRE9XX1ZTTTgsIFNIQURPV19WU00zMixcbiAgICBTSEFET1dVUERBVEVfTk9ORSwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRSxcbiAgICBTT1JUS0VZX0RFUFRIXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkZXJQYXNzIH0gZnJvbSAnLi4vc2hhZGVyLXBhc3MuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4vbGlnaHQtY2FtZXJhLmpzJztcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXJGb3JtYXQsIFVuaWZvcm1Gb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmluZEJ1ZmZlckZvcm1hdCwgQmluZEdyb3VwRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuZnVuY3Rpb24gZ2F1c3NXZWlnaHRzKGtlcm5lbFNpemUpIHtcbiAgICBjb25zdCBzaWdtYSA9IChrZXJuZWxTaXplIC0gMSkgLyAoMiAqIDMpO1xuXG4gICAgY29uc3QgaGFsZldpZHRoID0gKGtlcm5lbFNpemUgLSAxKSAqIDAuNTtcbiAgICBjb25zdCB2YWx1ZXMgPSBuZXcgQXJyYXkoa2VybmVsU2l6ZSk7XG4gICAgbGV0IHN1bSA9IDAuMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gPSBnYXVzcyhpIC0gaGFsZldpZHRoLCBzaWdtYSk7XG4gICAgICAgIHN1bSArPSB2YWx1ZXNbaV07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXJuZWxTaXplOyArK2kpIHtcbiAgICAgICAgdmFsdWVzW2ldIC89IHN1bTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn1cblxuY29uc3Qgc2hhZG93Q2FtVmlldyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBzaGFkb3dDYW1WaWV3UHJvaiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBwaXhlbE9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5jb25zdCBibHVyU2Npc3NvclJlY3QgPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTtcbmNvbnN0IG9wQ2hhbklkID0geyByOiAxLCBnOiAyLCBiOiAzLCBhOiA0IH07XG5jb25zdCB2aWV3cG9ydE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmZ1bmN0aW9uIGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSkge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuICAgIGNvbnN0IHggPSBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID8gMTAgOiAwO1xuICAgIGxldCB5ID0gMDtcbiAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICBjb25zdCBvcENoYW4gPSBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbDtcbiAgICAgICAgaWYgKG9wQ2hhbikge1xuICAgICAgICAgICAgeSA9IG9wQ2hhbklkW29wQ2hhbl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHggKyB5O1xufVxuXG4vKipcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU2hhZG93UmVuZGVyZXIge1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlcmVyLmpzJykuUmVuZGVyZXJ9IHJlbmRlcmVyIC0gVGhlIHJlbmRlcmVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9IGxpZ2h0VGV4dHVyZUF0bGFzIC0gVGhlXG4gICAgICogc2hhZG93IG1hcCBhdGxhcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihyZW5kZXJlciwgbGlnaHRUZXh0dXJlQXRsYXMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSByZW5kZXJlci5kZXZpY2U7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn0gKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9ICovXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBsaWdodFRleHR1cmVBdGxhcztcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncG9seWdvbk9mZnNldCcpO1xuICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXQgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIC8vIFZTTVxuICAgICAgICB0aGlzLnNvdXJjZUlkID0gc2NvcGUucmVzb2x2ZSgnc291cmNlJyk7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZCA9IHNjb3BlLnJlc29sdmUoJ3BpeGVsT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMud2VpZ2h0SWQgPSBzY29wZS5yZXNvbHZlKCd3ZWlnaHRbMF0nKTtcbiAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZSA9IFtzaGFkZXJDaHVua3MuYmx1clZTTVBTLCAnI2RlZmluZSBHQVVTU1xcbicgKyBzaGFkZXJDaHVua3MuYmx1clZTTVBTXTtcbiAgICAgICAgY29uc3QgcGFja2VkID0gJyNkZWZpbmUgUEFDS0VEXFxuJztcbiAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyQ29kZSA9IFtwYWNrZWQgKyB0aGlzLmJsdXJWc21TaGFkZXJDb2RlWzBdLCBwYWNrZWQgKyB0aGlzLmJsdXJWc21TaGFkZXJDb2RlWzFdXTtcblxuICAgICAgICAvLyBjYWNoZSBmb3IgdnNtIGJsdXIgc2hhZGVyc1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXIgPSBbe30sIHt9XTtcbiAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyID0gW3t9LCB7fV07XG5cbiAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0cyA9IHt9O1xuXG4gICAgICAgIC8vIHVuaWZvcm1zXG4gICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZCA9IHNjb3BlLnJlc29sdmUoJ2xpZ2h0X3JhZGl1cycpO1xuXG4gICAgICAgIC8vIHZpZXcgYmluZCBncm91cCBmb3JtYXQgd2l0aCBpdHMgdW5pZm9ybSBidWZmZXIgZm9ybWF0XG4gICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBudWxsO1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGJsZW5kIHN0YXRlc1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVXcml0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZU5vV3JpdGUgPSBuZXcgQmxlbmRTdGF0ZSgpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZXMgc2hhZG93IGNhbWVyYSBmb3IgYSBsaWdodCBhbmQgc2V0cyB1cCBpdHMgY29uc3RhbnQgcHJvcGVydGllc1xuICAgIHN0YXRpYyBjcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gTGlnaHRDYW1lcmEuY3JlYXRlKCdTaGFkb3dDYW1lcmEnLCB0eXBlLCBmYWNlKTtcblxuICAgICAgICAvLyBkb24ndCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIGlmIHJlbmRlcmluZyBhIGRlcHRoIG1hcFxuICAgICAgICBpZiAoc2hhZG93VHlwZSA+PSBTSEFET1dfVlNNOCAmJiBzaGFkb3dUeXBlIDw9IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRvd0NhbS5jbGVhckRlcHRoQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgc3RhdGljIHNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCkge1xuXG4gICAgICAgIC8vIG5vcm1hbCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIGVuY29kZSBkZXB0aCBpbiBSR0JBOCBhbmQgZG8gbWFudWFsIFBDRiBzYW1wbGluZ1xuICAgICAgICAvLyBjbHVzdGVyZWQgb21uaSBzaGFkb3dzIG9uIHdlYmdsMiB1c2UgZGVwdGggZm9ybWF0IGFuZCBoYXJkd2FyZSBQQ0Ygc2FtcGxpbmdcbiAgICAgICAgbGV0IGh3UGNmID0gc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUgfHwgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmIGRldmljZS5zdXBwb3J0c0RlcHRoU2hhZG93KTtcbiAgICAgICAgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgaHdQY2YgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yQnVmZmVyID0gIWh3UGNmO1xuICAgIH1cblxuICAgIC8vIGN1bGxzIHRoZSBsaXN0IG9mIG1lc2hlcyBpbnN0YW5jZXMgYnkgdGhlIGNhbWVyYSwgc3RvcmluZyB2aXNpYmxlIG1lc2ggaW5zdGFuY2VzIGluIHRoZSBzcGVjaWZpZWQgYXJyYXlcbiAgICBjdWxsU2hhZG93Q2FzdGVycyhtZXNoSW5zdGFuY2VzLCB2aXNpYmxlLCBjYW1lcmEpIHtcblxuICAgICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgICBjb25zdCBudW1JbnN0YW5jZXMgPSBtZXNoSW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1JbnN0YW5jZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gbWVzaEluc3RhbmNlc1tpXTtcblxuICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5jYXN0U2hhZG93KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2UuY3VsbCB8fCBtZXNoSW5zdGFuY2UuX2lzVmlzaWJsZShjYW1lcmEpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZVtjb3VudF0gPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmlzaWJsZS5sZW5ndGggPSBjb3VudDtcblxuICAgICAgICAvLyBUT0RPOiB3ZSBzaG91bGQgcHJvYmFibHkgc29ydCBzaGFkb3cgbWVzaGVzIGJ5IHNoYWRlciBhbmQgbm90IGRlcHRoXG4gICAgICAgIHZpc2libGUuc29ydCh0aGlzLnJlbmRlcmVyLnNvcnRDb21wYXJlRGVwdGgpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyU3RhdGUoZGV2aWNlLCBsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZGVwdGggYmlhc1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMiB8fCBkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXModHJ1ZSk7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhc1ZhbHVlcyhsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMCwgbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFsxXSA9IGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgc3RhbmRhcmQgc2hhZG93bWFwIHN0YXRlc1xuICAgICAgICBjb25zdCB1c2VTaGFkb3dTYW1wbGVyID0gaXNDbHVzdGVyZWQgP1xuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGRldmljZS53ZWJnbDIgOiAgICAgLy8gYm90aCBzcG90IGFuZCBvbW5pIGxpZ2h0IGFyZSB1c2luZyBzaGFkb3cgc2FtcGxlciBvbiB3ZWJnbDIgd2hlbiBjbHVzdGVyZWRcbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuXG4gICAgICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKHVzZVNoYWRvd1NhbXBsZXIgPyB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlIDogdGhpcy5ibGVuZFN0YXRlV3JpdGUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLkRFRkFVTFQpO1xuICAgIH1cblxuICAgIHJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpIHtcblxuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IDA7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoVW5pZm9ybXMobGlnaHQsIHNoYWRvd0NhbSwgbGlnaHRSZW5kZXJEYXRhLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtTm9kZSA9IHNoYWRvd0NhbS5fbm9kZTtcblxuICAgICAgICAvLyBwb3NpdGlvbiAvIHJhbmdlXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLmRpc3BhdGNoVmlld1BvcyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkLnNldFZhbHVlKGxpZ2h0LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZpZXctcHJvamVjdGlvbiBzaGFkb3cgbWF0cml4XG4gICAgICAgIHNoYWRvd0NhbVZpZXcuc2V0VFJTKHNoYWRvd0NhbU5vZGUuZ2V0UG9zaXRpb24oKSwgc2hhZG93Q2FtTm9kZS5nZXRSb3RhdGlvbigpLCBWZWMzLk9ORSkuaW52ZXJ0KCk7XG4gICAgICAgIHNoYWRvd0NhbVZpZXdQcm9qLm11bDIoc2hhZG93Q2FtLnByb2plY3Rpb25NYXRyaXgsIHNoYWRvd0NhbVZpZXcpO1xuXG4gICAgICAgIC8vIHZpZXdwb3J0IGhhbmRsaW5nXG4gICAgICAgIGNvbnN0IHJlY3RWaWV3cG9ydCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dWaWV3cG9ydDtcbiAgICAgICAgc2hhZG93Q2FtLnJlY3QgPSByZWN0Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5zY2lzc29yUmVjdCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dTY2lzc29yO1xuXG4gICAgICAgIHZpZXdwb3J0TWF0cml4LnNldFZpZXdwb3J0KHJlY3RWaWV3cG9ydC54LCByZWN0Vmlld3BvcnQueSwgcmVjdFZpZXdwb3J0LnosIHJlY3RWaWV3cG9ydC53KTtcbiAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5tdWwyKHZpZXdwb3J0TWF0cml4LCBzaGFkb3dDYW1WaWV3UHJvaik7XG5cbiAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIC8vIGNvcHkgbWF0cml4IHRvIHNoYWRvdyBjYXNjYWRlIHBhbGV0dGVcbiAgICAgICAgICAgIGxpZ2h0Ll9zaGFkb3dNYXRyaXhQYWxldHRlLnNldChsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEsIGZhY2UgKiAxNik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSB2aXNpYmxlQ2FzdGVycyAtIFZpc2libGUgbWVzaFxuICAgICAqIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGlnaHQuanMnKS5MaWdodH0gbGlnaHQgLSBUaGUgbGlnaHQuXG4gICAgICovXG4gICAgc3VibWl0Q2FzdGVycyh2aXNpYmxlQ2FzdGVycywgbGlnaHQpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVyO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHJlbmRlcmVyLnNjZW5lO1xuICAgICAgICBjb25zdCBwYXNzRmxhZ3MgPSAxIDw8IFNIQURFUl9TSEFET1c7XG5cbiAgICAgICAgLy8gU29ydCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gU2hhZGVyUGFzcy5nZXRTaGFkb3cobGlnaHQuX3R5cGUsIGxpZ2h0Ll9zaGFkb3dUeXBlKTtcblxuICAgICAgICAvLyBUT0RPOiBTaW1pbGFybHkgdG8gZm9yd2FyZCByZW5kZXJlciwgYSBzaGFkZXIgY3JlYXRpb24gcGFydCBvZiB0aGlzIGxvb3Agc2hvdWxkIGJlIHNwbGl0IGludG8gYSBzZXBhcmF0ZSBsb29wLFxuICAgICAgICAvLyBhbmQgZW5kU2hhZGVyQmF0Y2ggc2hvdWxkIGJlIGNhbGxlZCBhdCBpdHMgZW5kXG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwQ3VsbE1vZGUodHJ1ZSwgMSwgbWVzaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIEkgKHNoYWRvdyk6IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUkgKHNoYWRvdyk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFncyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBzaGFkZXJcbiAgICAgICAgICAgIGxldCBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgIGlmICghc2hhZG93U2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHNoYWRvd1Bhc3MsIG51bGwsIG51bGwsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgc2hhZG93U2hhZGVyID0gbWVzaEluc3RhbmNlLl9zaGFkZXJbc2hhZG93UGFzc107XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9rZXlbU09SVEtFWV9ERVBUSF0gPSBnZXREZXB0aEtleShtZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIuZmFpbGVkICYmICFkZXZpY2Uuc2V0U2hhZGVyKHNoYWRvd1NoYWRlcikpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRvdyBzaGFkZXIgZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3NoYWRvd1Bhc3N9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgYnVmZmVyc1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0TW9ycGhpbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMobWVzaEluc3RhbmNlLCBzaGFkb3dQYXNzKTtcblxuICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBtZXNoSW5zdGFuY2UucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0SW5kZXhCdWZmZXIobWVzaC5pbmRleEJ1ZmZlcltzdHlsZV0pO1xuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICByZW5kZXJlci5kcmF3SW5zdGFuY2UoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgIHJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHMrKztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5lZWRzU2hhZG93UmVuZGVyaW5nKGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbmVlZHMgPSBsaWdodC5lbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWU7XG5cbiAgICAgICAgaWYgKGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPT09IFNIQURPV1VQREFURV9USElTRlJBTUUpIHtcbiAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfTk9ORTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZWVkcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyArPSBsaWdodC5udW1TaGFkb3dGYWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZWVkcztcbiAgICB9XG5cbiAgICBnZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGFyZSBwZXIgY2FtZXJhLCBzbyBnZXQgYXBwcm9wcmlhdGUgcmVuZGVyIGRhdGFcbiAgICAgICAgcmV0dXJuIGxpZ2h0LmdldFJlbmRlckRhdGEobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IGNhbWVyYSA6IG51bGwsIGZhY2UpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyUGFzcyhyZW5kZXJQYXNzLCBzaGFkb3dDYW1lcmEsIGNsZWFyUmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgY29uc3QgcnQgPSBzaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICByZW5kZXJQYXNzLmluaXQocnQpO1xuXG4gICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZSA9IDE7XG4gICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggPSBjbGVhclJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyBpZiByZW5kZXJpbmcgdG8gZGVwdGggYnVmZmVyXG4gICAgICAgIGlmIChydC5kZXB0aEJ1ZmZlcikge1xuXG4gICAgICAgICAgICByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoID0gdHJ1ZTtcblxuICAgICAgICB9IGVsc2UgeyAvLyByZW5kZXJpbmcgdG8gY29sb3IgYnVmZmVyXG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXJWYWx1ZS5jb3B5KHNoYWRvd0NhbWVyYS5jbGVhckNvbG9yKTtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXIgPSBjbGVhclJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdCBzYW1wbGluZyBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY3ViZW1hcHNcbiAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgcmVuZGVyIHRhcmdldCAvIHJlbmRlciB0YXJnZXQgc2V0dGluZ3MgdG8gYWxsb3cgcmVuZGVyIHBhc3MgdG8gYmUgc2V0IHVwXG4gICAgcHJlcGFyZUZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHR5cGUgPSBsaWdodC5fdHlwZTtcbiAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IGxpZ2h0Ll9zaGFkb3dUeXBlO1xuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHRoaXMuZ2V0TGlnaHRSZW5kZXJEYXRhKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgIC8vIGNhbWVyYSBjbGVhciBzZXR0aW5nXG4gICAgICAgIC8vIE5vdGU6IHdoZW4gY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIHRoZSBvbmx5IGxpZ2h0aW5nIHR5cGUsIHRoaXMgY29kZSBjYW4gYmUgbW92ZWQgdG8gY3JlYXRlU2hhZG93Q2FtZXJhIGZ1bmN0aW9uXG4gICAgICAgIFNoYWRvd1JlbmRlcmVyLnNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgdGhpcy5kZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKTtcblxuICAgICAgICAvLyBhc3NpZ24gcmVuZGVyIHRhcmdldCBmb3IgdGhlIGZhY2VcbiAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0SW5kZXggPSB0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyAwIDogZmFjZTtcbiAgICAgICAgc2hhZG93Q2FtLnJlbmRlclRhcmdldCA9IGxpZ2h0Ll9zaGFkb3dNYXAucmVuZGVyVGFyZ2V0c1tyZW5kZXJUYXJnZXRJbmRleF07XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICByZW5kZXJGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UsIGNsZWFyLCBpbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2hhZG93TWFwU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBTSEFET1cgJHtsaWdodC5fbm9kZS5uYW1lfSBGQUNFICR7ZmFjZX1gKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSB0aGlzLmdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICB0aGlzLmRpc3BhdGNoVW5pZm9ybXMobGlnaHQsIHNoYWRvd0NhbSwgbGlnaHRSZW5kZXJEYXRhLCBmYWNlKTtcblxuICAgICAgICBjb25zdCBydCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgcmVuZGVyZXIuc2V0Q2FtZXJhVW5pZm9ybXMoc2hhZG93Q2FtLCBydCk7XG4gICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycykge1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMobGlnaHRSZW5kZXJEYXRhLnZpZXdCaW5kR3JvdXBzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluc2lkZVJlbmRlclBhc3MpIHtcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwVmlld3BvcnQoc2hhZG93Q2FtLCBydCk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGhlcmUgaXMgdXNlZCB0byBjbGVhciBhIHZpZXdwb3J0IGluc2lkZSByZW5kZXIgdGFyZ2V0LlxuICAgICAgICAgICAgaWYgKGNsZWFyKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXIuY2xlYXIoc2hhZG93Q2FtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gdGhpcyBpcyBvbmx5IHVzZWQgYnkgbGlnaHRtYXBwZXIsIHRpbGwgaXQncyBjb252ZXJ0ZWQgdG8gcmVuZGVyIHBhc3Nlc1xuICAgICAgICAgICAgcmVuZGVyZXIuY2xlYXJWaWV3KHNoYWRvd0NhbSwgcnQsIHRydWUsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KTtcblxuICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5zdWJtaXRDYXN0ZXJzKGxpZ2h0UmVuZGVyRGF0YS52aXNpYmxlQ2FzdGVycywgbGlnaHQpO1xuXG4gICAgICAgIHRoaXMucmVzdG9yZVJlbmRlclN0YXRlKGRldmljZSk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lICs9IG5vdygpIC0gc2hhZG93TWFwU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSwgaW5zaWRlUmVuZGVyUGFzcyA9IHRydWUpIHtcblxuICAgICAgICBpZiAodGhpcy5uZWVkc1NoYWRvd1JlbmRlcmluZyhsaWdodCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZhY2VDb3VudCA9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgZmFjZXNcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlLCB0cnVlLCBpbnNpZGVSZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXBwbHkgdnNtXG4gICAgICAgICAgICB0aGlzLnJlbmRlclZtcyhsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlclZtcyhsaWdodCwgY2FtZXJhKSB7XG5cbiAgICAgICAgLy8gVlNNIGJsdXIgaWYgbGlnaHQgc3VwcG9ydHMgdnNtIChkaXJlY3Rpb25hbCBhbmQgc3BvdCBpbiBnZW5lcmFsKVxuICAgICAgICBpZiAobGlnaHQuX2lzVnNtICYmIGxpZ2h0Ll92c21CbHVyU2l6ZSA+IDEpIHtcblxuICAgICAgICAgICAgLy8gaW4gY2x1c3RlcmVkIG1vZGUsIG9ubHkgZGlyZWN0aW9uYWwgbGlnaHQgY2FuIGJlIHZtc1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgIGlmICghaXNDbHVzdGVyZWQgfHwgbGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgVlNNICR7bGlnaHQuX25vZGUubmFtZX1gKTtcblxuICAgICAgICAvLyByZW5kZXIgc3RhdGVcbiAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCAwKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcbiAgICAgICAgY29uc3Qgb3JpZ1NoYWRvd01hcCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgZm9yIGJsdXJyaW5nXG4gICAgICAgIC8vIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG9wdGltYWwgYW5kIHNoYWRvdyBtYXAgY291bGQgaGF2ZSBkZXB0aCBidWZmZXIgb24gaW4gYWRkaXRpb24gdG8gY29sb3IgYnVmZmVyLFxuICAgICAgICAvLyBhbmQgZm9yIGJsdXJyaW5nIG9ubHkgb25lIGJ1ZmZlciBpcyBuZWVkZWQuXG4gICAgICAgIGNvbnN0IHRlbXBTaGFkb3dNYXAgPSB0aGlzLnJlbmRlcmVyLnNoYWRvd01hcENhY2hlLmdldChkZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgY29uc3QgdGVtcFJ0ID0gdGVtcFNoYWRvd01hcC5yZW5kZXJUYXJnZXRzWzBdO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtOCA9IGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNODtcbiAgICAgICAgY29uc3QgYmx1ck1vZGUgPSBsaWdodC52c21CbHVyTW9kZTtcbiAgICAgICAgY29uc3QgZmlsdGVyU2l6ZSA9IGxpZ2h0Ll92c21CbHVyU2l6ZTtcbiAgICAgICAgY29uc3QgYmx1clNoYWRlciA9IHRoaXMuZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKTtcblxuICAgICAgICBibHVyU2Npc3NvclJlY3QueiA9IGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uIC0gMjtcbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LncgPSBibHVyU2Npc3NvclJlY3QuejtcblxuICAgICAgICAvLyBCbHVyIGhvcml6b250YWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZShvcmlnU2hhZG93TWFwLmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAxIC8gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgaWYgKGJsdXJNb2RlID09PSBCTFVSX0dBVVNTSUFOKSB0aGlzLndlaWdodElkLnNldFZhbHVlKHRoaXMuYmx1clZzbVdlaWdodHNbZmlsdGVyU2l6ZV0pO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUnQsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gQmx1ciB2ZXJ0aWNhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKHRlbXBSdC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gcGl4ZWxPZmZzZXRbMF07XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgb3JpZ1NoYWRvd01hcCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIHRlbXBvcmFyeSBzaGFkb3cgbWFwIGJhY2sgdG8gdGhlIGNhY2hlXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuYWRkKGxpZ2h0LCB0ZW1wU2hhZG93TWFwKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIG5vIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZG93UmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJnYXVzcyIsIngiLCJzaWdtYSIsIk1hdGgiLCJleHAiLCJnYXVzc1dlaWdodHMiLCJrZXJuZWxTaXplIiwiaGFsZldpZHRoIiwidmFsdWVzIiwiQXJyYXkiLCJzdW0iLCJpIiwic2hhZG93Q2FtVmlldyIsIk1hdDQiLCJzaGFkb3dDYW1WaWV3UHJvaiIsInBpeGVsT2Zmc2V0IiwiRmxvYXQzMkFycmF5IiwiYmx1clNjaXNzb3JSZWN0IiwiVmVjNCIsIm9wQ2hhbklkIiwiciIsImciLCJiIiwiYSIsInZpZXdwb3J0TWF0cml4IiwiZ2V0RGVwdGhLZXkiLCJtZXNoSW5zdGFuY2UiLCJtYXRlcmlhbCIsInNraW5JbnN0YW5jZSIsInkiLCJvcGFjaXR5TWFwIiwib3BDaGFuIiwib3BhY2l0eU1hcENoYW5uZWwiLCJTaGFkb3dSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwicmVuZGVyZXIiLCJsaWdodFRleHR1cmVBdGxhcyIsImRldmljZSIsInNjb3BlIiwicG9seWdvbk9mZnNldElkIiwicmVzb2x2ZSIsInBvbHlnb25PZmZzZXQiLCJzb3VyY2VJZCIsInBpeGVsT2Zmc2V0SWQiLCJ3ZWlnaHRJZCIsImJsdXJWc21TaGFkZXJDb2RlIiwic2hhZGVyQ2h1bmtzIiwiYmx1clZTTVBTIiwicGFja2VkIiwiYmx1clBhY2tlZFZzbVNoYWRlckNvZGUiLCJibHVyVnNtU2hhZGVyIiwiYmx1clBhY2tlZFZzbVNoYWRlciIsImJsdXJWc21XZWlnaHRzIiwic2hhZG93TWFwTGlnaHRSYWRpdXNJZCIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsImJsZW5kU3RhdGVXcml0ZSIsIkJsZW5kU3RhdGUiLCJibGVuZFN0YXRlTm9Xcml0ZSIsInNldENvbG9yV3JpdGUiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJzaGFkb3dUeXBlIiwidHlwZSIsImZhY2UiLCJzaGFkb3dDYW0iLCJMaWdodENhbWVyYSIsImNyZWF0ZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTMyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInNldFNoYWRvd0NhbWVyYVNldHRpbmdzIiwiaXNDbHVzdGVyZWQiLCJod1BjZiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjMiLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiTElHSFRUWVBFX09NTkkiLCJjbGVhckNvbG9yQnVmZmVyIiwiY3VsbFNoYWRvd0Nhc3RlcnMiLCJtZXNoSW5zdGFuY2VzIiwidmlzaWJsZSIsImNhbWVyYSIsImNvdW50IiwibnVtSW5zdGFuY2VzIiwibGVuZ3RoIiwiY2FzdFNoYWRvdyIsImN1bGwiLCJfaXNWaXNpYmxlIiwidmlzaWJsZVRoaXNGcmFtZSIsInNvcnQiLCJzb3J0Q29tcGFyZURlcHRoIiwic2V0dXBSZW5kZXJTdGF0ZSIsImxpZ2h0Iiwic2NlbmUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJ3ZWJnbDIiLCJpc1dlYkdQVSIsIl90eXBlIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwic2hhZG93QmlhcyIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJzZXRWYWx1ZSIsInVzZVNoYWRvd1NhbXBsZXIiLCJfaXNQY2YiLCJzZXRCbGVuZFN0YXRlIiwic2V0RGVwdGhTdGF0ZSIsIkRlcHRoU3RhdGUiLCJERUZBVUxUIiwicmVzdG9yZVJlbmRlclN0YXRlIiwiZGlzcGF0Y2hVbmlmb3JtcyIsImxpZ2h0UmVuZGVyRGF0YSIsInNoYWRvd0NhbU5vZGUiLCJfbm9kZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImRpc3BhdGNoVmlld1BvcyIsImdldFBvc2l0aW9uIiwiYXR0ZW51YXRpb25FbmQiLCJzZXRUUlMiLCJnZXRSb3RhdGlvbiIsIlZlYzMiLCJPTkUiLCJpbnZlcnQiLCJtdWwyIiwicHJvamVjdGlvbk1hdHJpeCIsInJlY3RWaWV3cG9ydCIsInNoYWRvd1ZpZXdwb3J0IiwicmVjdCIsInNjaXNzb3JSZWN0Iiwic2hhZG93U2Npc3NvciIsInNldFZpZXdwb3J0IiwieiIsInciLCJzaGFkb3dNYXRyaXgiLCJfc2hhZG93TWF0cml4UGFsZXR0ZSIsInNldCIsImRhdGEiLCJzdWJtaXRDYXN0ZXJzIiwidmlzaWJsZUNhc3RlcnMiLCJwYXNzRmxhZ3MiLCJTSEFERVJfU0hBRE9XIiwic2hhZG93UGFzcyIsIlNoYWRlclBhc3MiLCJnZXRTaGFkb3ciLCJfc2hhZG93VHlwZSIsIm1lc2giLCJlbnN1cmVNYXRlcmlhbCIsInNldEJhc2VDb25zdGFudHMiLCJzZXRTa2lubmluZyIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJjaHVua3MiLCJzZXR1cEN1bGxNb2RlIiwic2V0UGFyYW1ldGVycyIsInNoYWRvd1NoYWRlciIsIl9zaGFkZXIiLCJ1cGRhdGVQYXNzU2hhZGVyIiwiX2tleSIsIlNPUlRLRVlfREVQVEgiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJEZWJ1ZyIsImVycm9yIiwibmFtZSIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRNb3JwaGluZyIsIm1vcnBoSW5zdGFuY2UiLCJzZXR1cE1lc2hVbmlmb3JtQnVmZmVycyIsInN0eWxlIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwiZHJhd0luc3RhbmNlIiwiX3NoYWRvd0RyYXdDYWxscyIsIm5lZWRzU2hhZG93UmVuZGVyaW5nIiwibmVlZHMiLCJlbmFibGVkIiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJudW1TaGFkb3dGYWNlcyIsImdldExpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzZXR1cFJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwic2hhZG93Q2FtZXJhIiwiY2xlYXJSZW5kZXJUYXJnZXQiLCJydCIsInJlbmRlclRhcmdldCIsImluaXQiLCJkZXB0aFN0ZW5jaWxPcHMiLCJjbGVhckRlcHRoVmFsdWUiLCJjbGVhckRlcHRoIiwiZGVwdGhCdWZmZXIiLCJzdG9yZURlcHRoIiwiY29sb3JPcHMiLCJjbGVhclZhbHVlIiwiY29weSIsImNsZWFyIiwicmVxdWlyZXNDdWJlbWFwcyIsInByZXBhcmVGYWNlIiwicmVuZGVyVGFyZ2V0SW5kZXgiLCJfc2hhZG93TWFwIiwicmVuZGVyVGFyZ2V0cyIsInJlbmRlckZhY2UiLCJpbnNpZGVSZW5kZXJQYXNzIiwic2hhZG93TWFwU3RhcnRUaW1lIiwibm93IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzZXRDYW1lcmFVbmlmb3JtcyIsInN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwic2V0dXBWaWV3cG9ydCIsImNsZWFyVmlldyIsInBvcEdwdU1hcmtlciIsIl9zaGFkb3dNYXBUaW1lIiwicmVuZGVyIiwiZmFjZUNvdW50IiwicmVuZGVyVm1zIiwiX2lzVnNtIiwiX3ZzbUJsdXJTaXplIiwiYXBwbHlWc21CbHVyIiwiZ2V0VnNtQmx1clNoYWRlciIsImlzVnNtOCIsImJsdXJNb2RlIiwiZmlsdGVyU2l6ZSIsImJsdXJTaGFkZXIiLCJibHVyVlMiLCJmdWxsc2NyZWVuUXVhZFZTIiwiYmx1ckZTIiwiYmx1clNoYWRlck5hbWUiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsIm9yaWdTaGFkb3dNYXAiLCJ0ZW1wU2hhZG93TWFwIiwic2hhZG93TWFwQ2FjaGUiLCJnZXQiLCJ0ZW1wUnQiLCJ2c21CbHVyTW9kZSIsIl9zaGFkb3dSZXNvbHV0aW9uIiwiY29sb3JCdWZmZXIiLCJCTFVSX0dBVVNTSUFOIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwiYWRkIiwiaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQiLCJVbmlmb3JtQnVmZmVyRm9ybWF0IiwiVW5pZm9ybUZvcm1hdCIsIlVOSUZPUk1UWVBFX01BVDQiLCJCaW5kR3JvdXBGb3JtYXQiLCJCaW5kQnVmZmVyRm9ybWF0IiwiVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUiLCJTSEFERVJTVEFHRV9WRVJURVgiLCJTSEFERVJTVEFHRV9GUkFHTUVOVCIsImZyYW1lVXBkYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE0QkEsU0FBU0EsS0FBS0EsQ0FBQ0MsQ0FBQyxFQUFFQyxLQUFLLEVBQUU7QUFDckIsRUFBQSxPQUFPQyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxFQUFFSCxDQUFDLEdBQUdBLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBR0MsS0FBSyxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFBO0FBQ3JELENBQUE7QUFFQSxTQUFTRyxZQUFZQSxDQUFDQyxVQUFVLEVBQUU7RUFDOUIsTUFBTUosS0FBSyxHQUFHLENBQUNJLFVBQVUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxD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
