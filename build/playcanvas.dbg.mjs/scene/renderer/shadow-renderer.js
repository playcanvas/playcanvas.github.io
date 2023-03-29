/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
        renderer.setCullMode(true, false, meshInstance);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBTSEFERVJTVEFHRV9GUkFHTUVOVCwgU0hBREVSU1RBR0VfVkVSVEVYLCBVTklGT1JNVFlQRV9NQVQ0LCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSxcbiAgICBTSEFERVJfU0hBRE9XLFxuICAgIFNIQURPV19QQ0YzLCBTSEFET1dfUENGNSwgU0hBRE9XX1ZTTTgsIFNIQURPV19WU00zMixcbiAgICBTSEFET1dVUERBVEVfTk9ORSwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRSxcbiAgICBTT1JUS0VZX0RFUFRIXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkZXJQYXNzIH0gZnJvbSAnLi4vc2hhZGVyLXBhc3MuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4vbGlnaHQtY2FtZXJhLmpzJztcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXJGb3JtYXQsIFVuaWZvcm1Gb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmluZEJ1ZmZlckZvcm1hdCwgQmluZEdyb3VwRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuZnVuY3Rpb24gZ2F1c3NXZWlnaHRzKGtlcm5lbFNpemUpIHtcbiAgICBjb25zdCBzaWdtYSA9IChrZXJuZWxTaXplIC0gMSkgLyAoMiAqIDMpO1xuXG4gICAgY29uc3QgaGFsZldpZHRoID0gKGtlcm5lbFNpemUgLSAxKSAqIDAuNTtcbiAgICBjb25zdCB2YWx1ZXMgPSBuZXcgQXJyYXkoa2VybmVsU2l6ZSk7XG4gICAgbGV0IHN1bSA9IDAuMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gPSBnYXVzcyhpIC0gaGFsZldpZHRoLCBzaWdtYSk7XG4gICAgICAgIHN1bSArPSB2YWx1ZXNbaV07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXJuZWxTaXplOyArK2kpIHtcbiAgICAgICAgdmFsdWVzW2ldIC89IHN1bTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn1cblxuY29uc3Qgc2hhZG93Q2FtVmlldyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBzaGFkb3dDYW1WaWV3UHJvaiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBwaXhlbE9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5jb25zdCBibHVyU2Npc3NvclJlY3QgPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTtcbmNvbnN0IG9wQ2hhbklkID0geyByOiAxLCBnOiAyLCBiOiAzLCBhOiA0IH07XG5jb25zdCB2aWV3cG9ydE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmZ1bmN0aW9uIGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSkge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuICAgIGNvbnN0IHggPSBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID8gMTAgOiAwO1xuICAgIGxldCB5ID0gMDtcbiAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICBjb25zdCBvcENoYW4gPSBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbDtcbiAgICAgICAgaWYgKG9wQ2hhbikge1xuICAgICAgICAgICAgeSA9IG9wQ2hhbklkW29wQ2hhbl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHggKyB5O1xufVxuXG4vKipcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU2hhZG93UmVuZGVyZXIge1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlcmVyLmpzJykuUmVuZGVyZXJ9IHJlbmRlcmVyIC0gVGhlIHJlbmRlcmVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9IGxpZ2h0VGV4dHVyZUF0bGFzIC0gVGhlXG4gICAgICogc2hhZG93IG1hcCBhdGxhcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihyZW5kZXJlciwgbGlnaHRUZXh0dXJlQXRsYXMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSByZW5kZXJlci5kZXZpY2U7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn0gKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9saWdodGluZy9saWdodC10ZXh0dXJlLWF0bGFzLmpzJykuTGlnaHRUZXh0dXJlQXRsYXN9ICovXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBsaWdodFRleHR1cmVBdGxhcztcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncG9seWdvbk9mZnNldCcpO1xuICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXQgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIC8vIFZTTVxuICAgICAgICB0aGlzLnNvdXJjZUlkID0gc2NvcGUucmVzb2x2ZSgnc291cmNlJyk7XG4gICAgICAgIHRoaXMucGl4ZWxPZmZzZXRJZCA9IHNjb3BlLnJlc29sdmUoJ3BpeGVsT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMud2VpZ2h0SWQgPSBzY29wZS5yZXNvbHZlKCd3ZWlnaHRbMF0nKTtcbiAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZSA9IFtzaGFkZXJDaHVua3MuYmx1clZTTVBTLCAnI2RlZmluZSBHQVVTU1xcbicgKyBzaGFkZXJDaHVua3MuYmx1clZTTVBTXTtcbiAgICAgICAgY29uc3QgcGFja2VkID0gJyNkZWZpbmUgUEFDS0VEXFxuJztcbiAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyQ29kZSA9IFtwYWNrZWQgKyB0aGlzLmJsdXJWc21TaGFkZXJDb2RlWzBdLCBwYWNrZWQgKyB0aGlzLmJsdXJWc21TaGFkZXJDb2RlWzFdXTtcblxuICAgICAgICAvLyBjYWNoZSBmb3IgdnNtIGJsdXIgc2hhZGVyc1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXIgPSBbe30sIHt9XTtcbiAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyID0gW3t9LCB7fV07XG5cbiAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0cyA9IHt9O1xuXG4gICAgICAgIC8vIHVuaWZvcm1zXG4gICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZCA9IHNjb3BlLnJlc29sdmUoJ2xpZ2h0X3JhZGl1cycpO1xuXG4gICAgICAgIC8vIHZpZXcgYmluZCBncm91cCBmb3JtYXQgd2l0aCBpdHMgdW5pZm9ybSBidWZmZXIgZm9ybWF0XG4gICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBudWxsO1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGJsZW5kIHN0YXRlc1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVXcml0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZU5vV3JpdGUgPSBuZXcgQmxlbmRTdGF0ZSgpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZXMgc2hhZG93IGNhbWVyYSBmb3IgYSBsaWdodCBhbmQgc2V0cyB1cCBpdHMgY29uc3RhbnQgcHJvcGVydGllc1xuICAgIHN0YXRpYyBjcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gTGlnaHRDYW1lcmEuY3JlYXRlKCdTaGFkb3dDYW1lcmEnLCB0eXBlLCBmYWNlKTtcblxuICAgICAgICAvLyBkb24ndCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIGlmIHJlbmRlcmluZyBhIGRlcHRoIG1hcFxuICAgICAgICBpZiAoc2hhZG93VHlwZSA+PSBTSEFET1dfVlNNOCAmJiBzaGFkb3dUeXBlIDw9IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRvd0NhbS5jbGVhckRlcHRoQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgc3RhdGljIHNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCkge1xuXG4gICAgICAgIC8vIG5vcm1hbCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIGVuY29kZSBkZXB0aCBpbiBSR0JBOCBhbmQgZG8gbWFudWFsIFBDRiBzYW1wbGluZ1xuICAgICAgICAvLyBjbHVzdGVyZWQgb21uaSBzaGFkb3dzIG9uIHdlYmdsMiB1c2UgZGVwdGggZm9ybWF0IGFuZCBoYXJkd2FyZSBQQ0Ygc2FtcGxpbmdcbiAgICAgICAgbGV0IGh3UGNmID0gc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUgfHwgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmIGRldmljZS5zdXBwb3J0c0RlcHRoU2hhZG93KTtcbiAgICAgICAgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgaHdQY2YgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yQnVmZmVyID0gIWh3UGNmO1xuICAgIH1cblxuICAgIC8vIGN1bGxzIHRoZSBsaXN0IG9mIG1lc2hlcyBpbnN0YW5jZXMgYnkgdGhlIGNhbWVyYSwgc3RvcmluZyB2aXNpYmxlIG1lc2ggaW5zdGFuY2VzIGluIHRoZSBzcGVjaWZpZWQgYXJyYXlcbiAgICBjdWxsU2hhZG93Q2FzdGVycyhtZXNoSW5zdGFuY2VzLCB2aXNpYmxlLCBjYW1lcmEpIHtcblxuICAgICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgICBjb25zdCBudW1JbnN0YW5jZXMgPSBtZXNoSW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1JbnN0YW5jZXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gbWVzaEluc3RhbmNlc1tpXTtcblxuICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5jYXN0U2hhZG93KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2UuY3VsbCB8fCBtZXNoSW5zdGFuY2UuX2lzVmlzaWJsZShjYW1lcmEpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZVtjb3VudF0gPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmlzaWJsZS5sZW5ndGggPSBjb3VudDtcblxuICAgICAgICAvLyBUT0RPOiB3ZSBzaG91bGQgcHJvYmFibHkgc29ydCBzaGFkb3cgbWVzaGVzIGJ5IHNoYWRlciBhbmQgbm90IGRlcHRoXG4gICAgICAgIHZpc2libGUuc29ydCh0aGlzLnJlbmRlcmVyLnNvcnRDb21wYXJlRGVwdGgpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyU3RhdGUoZGV2aWNlLCBsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZGVwdGggYmlhc1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMiB8fCBkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXModHJ1ZSk7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhc1ZhbHVlcyhsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMCwgbGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFsxXSA9IGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wO1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgc3RhbmRhcmQgc2hhZG93bWFwIHN0YXRlc1xuICAgICAgICBjb25zdCB1c2VTaGFkb3dTYW1wbGVyID0gaXNDbHVzdGVyZWQgP1xuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGRldmljZS53ZWJnbDIgOiAgICAgLy8gYm90aCBzcG90IGFuZCBvbW5pIGxpZ2h0IGFyZSB1c2luZyBzaGFkb3cgc2FtcGxlciBvbiB3ZWJnbDIgd2hlbiBjbHVzdGVyZWRcbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuXG4gICAgICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKHVzZVNoYWRvd1NhbXBsZXIgPyB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlIDogdGhpcy5ibGVuZFN0YXRlV3JpdGUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLkRFRkFVTFQpO1xuICAgIH1cblxuICAgIHJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpIHtcblxuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IDA7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoVW5pZm9ybXMobGlnaHQsIHNoYWRvd0NhbSwgbGlnaHRSZW5kZXJEYXRhLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtTm9kZSA9IHNoYWRvd0NhbS5fbm9kZTtcblxuICAgICAgICAvLyBwb3NpdGlvbiAvIHJhbmdlXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLmRpc3BhdGNoVmlld1BvcyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkLnNldFZhbHVlKGxpZ2h0LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZpZXctcHJvamVjdGlvbiBzaGFkb3cgbWF0cml4XG4gICAgICAgIHNoYWRvd0NhbVZpZXcuc2V0VFJTKHNoYWRvd0NhbU5vZGUuZ2V0UG9zaXRpb24oKSwgc2hhZG93Q2FtTm9kZS5nZXRSb3RhdGlvbigpLCBWZWMzLk9ORSkuaW52ZXJ0KCk7XG4gICAgICAgIHNoYWRvd0NhbVZpZXdQcm9qLm11bDIoc2hhZG93Q2FtLnByb2plY3Rpb25NYXRyaXgsIHNoYWRvd0NhbVZpZXcpO1xuXG4gICAgICAgIC8vIHZpZXdwb3J0IGhhbmRsaW5nXG4gICAgICAgIGNvbnN0IHJlY3RWaWV3cG9ydCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dWaWV3cG9ydDtcbiAgICAgICAgc2hhZG93Q2FtLnJlY3QgPSByZWN0Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5zY2lzc29yUmVjdCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dTY2lzc29yO1xuXG4gICAgICAgIHZpZXdwb3J0TWF0cml4LnNldFZpZXdwb3J0KHJlY3RWaWV3cG9ydC54LCByZWN0Vmlld3BvcnQueSwgcmVjdFZpZXdwb3J0LnosIHJlY3RWaWV3cG9ydC53KTtcbiAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5tdWwyKHZpZXdwb3J0TWF0cml4LCBzaGFkb3dDYW1WaWV3UHJvaik7XG5cbiAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIC8vIGNvcHkgbWF0cml4IHRvIHNoYWRvdyBjYXNjYWRlIHBhbGV0dGVcbiAgICAgICAgICAgIGxpZ2h0Ll9zaGFkb3dNYXRyaXhQYWxldHRlLnNldChsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEsIGZhY2UgKiAxNik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSB2aXNpYmxlQ2FzdGVycyAtIFZpc2libGUgbWVzaFxuICAgICAqIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGlnaHQuanMnKS5MaWdodH0gbGlnaHQgLSBUaGUgbGlnaHQuXG4gICAgICovXG4gICAgc3VibWl0Q2FzdGVycyh2aXNpYmxlQ2FzdGVycywgbGlnaHQpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVyO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHJlbmRlcmVyLnNjZW5lO1xuICAgICAgICBjb25zdCBwYXNzRmxhZ3MgPSAxIDw8IFNIQURFUl9TSEFET1c7XG5cbiAgICAgICAgLy8gU29ydCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gU2hhZGVyUGFzcy5nZXRTaGFkb3cobGlnaHQuX3R5cGUsIGxpZ2h0Ll9zaGFkb3dUeXBlKTtcblxuICAgICAgICAvLyBUT0RPOiBTaW1pbGFybHkgdG8gZm9yd2FyZCByZW5kZXJlciwgYSBzaGFkZXIgY3JlYXRpb24gcGFydCBvZiB0aGlzIGxvb3Agc2hvdWxkIGJlIHNwbGl0IGludG8gYSBzZXBhcmF0ZSBsb29wLFxuICAgICAgICAvLyBhbmQgZW5kU2hhZGVyQmF0Y2ggc2hvdWxkIGJlIGNhbGxlZCBhdCBpdHMgZW5kXG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldEN1bGxNb2RlKHRydWUsIGZhbHNlLCBtZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSSAoc2hhZG93KTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJSSAoc2hhZG93KTogbWVzaEluc3RhbmNlIG92ZXJyaWRlc1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWdzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IHNoYWRlclxuICAgICAgICAgICAgbGV0IHNoYWRvd1NoYWRlciA9IG1lc2hJbnN0YW5jZS5fc2hhZGVyW3NoYWRvd1Bhc3NdO1xuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgc2hhZG93UGFzcywgbnVsbCwgbnVsbCwgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgICAgICBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuX2tleVtTT1JUS0VZX0RFUFRIXSA9IGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNoYWRvd1NoYWRlci5mYWlsZWQgJiYgIWRldmljZS5zZXRTaGFkZXIoc2hhZG93U2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBFcnJvciBjb21waWxpbmcgc2hhZG93IHNoYWRlciBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7c2hhZG93UGFzc31gLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBidWZmZXJzXG4gICAgICAgICAgICByZW5kZXJlci5zZXRWZXJ0ZXhCdWZmZXJzKGRldmljZSwgbWVzaCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRNb3JwaGluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZS5tb3JwaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zZXR1cE1lc2hVbmlmb3JtQnVmZmVycyhtZXNoSW5zdGFuY2UsIHNoYWRvd1Bhc3MpO1xuXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IG1lc2hJbnN0YW5jZS5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgIGRldmljZS5zZXRJbmRleEJ1ZmZlcihtZXNoLmluZGV4QnVmZmVyW3N0eWxlXSk7XG5cbiAgICAgICAgICAgIC8vIGRyYXdcbiAgICAgICAgICAgIHJlbmRlcmVyLmRyYXdJbnN0YW5jZShkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpO1xuICAgICAgICAgICAgcmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscysrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbmVlZHNTaGFkb3dSZW5kZXJpbmcobGlnaHQpIHtcblxuICAgICAgICBjb25zdCBuZWVkcyA9IGxpZ2h0LmVuYWJsZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUgJiYgbGlnaHQudmlzaWJsZVRoaXNGcmFtZTtcblxuICAgICAgICBpZiAobGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRSkge1xuICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9OT05FO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzICs9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5lZWRzO1xuICAgIH1cblxuICAgIGdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKSB7XG4gICAgICAgIC8vIGRpcmVjdGlvbmFsIHNoYWRvd3MgYXJlIHBlciBjYW1lcmEsIHNvIGdldCBhcHByb3ByaWF0ZSByZW5kZXIgZGF0YVxuICAgICAgICByZXR1cm4gbGlnaHQuZ2V0UmVuZGVyRGF0YShsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gY2FtZXJhIDogbnVsbCwgZmFjZSk7XG4gICAgfVxuXG4gICAgc2V0dXBSZW5kZXJQYXNzKHJlbmRlclBhc3MsIHNoYWRvd0NhbWVyYSwgY2xlYXJSZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCBydCA9IHNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIHJlbmRlclBhc3MuaW5pdChydCk7XG5cbiAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aFZhbHVlID0gMTtcbiAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCA9IGNsZWFyUmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIGlmIHJlbmRlcmluZyB0byBkZXB0aCBidWZmZXJcbiAgICAgICAgaWYgKHJ0LmRlcHRoQnVmZmVyKSB7XG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGggPSB0cnVlO1xuXG4gICAgICAgIH0gZWxzZSB7IC8vIHJlbmRlcmluZyB0byBjb2xvciBidWZmZXJcblxuICAgICAgICAgICAgcmVuZGVyUGFzcy5jb2xvck9wcy5jbGVhclZhbHVlLmNvcHkoc2hhZG93Q2FtZXJhLmNsZWFyQ29sb3IpO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5jb2xvck9wcy5jbGVhciA9IGNsZWFyUmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVEZXB0aCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm90IHNhbXBsaW5nIGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjdWJlbWFwc1xuICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyByZW5kZXIgdGFyZ2V0IC8gcmVuZGVyIHRhcmdldCBzZXR0aW5ncyB0byBhbGxvdyByZW5kZXIgcGFzcyB0byBiZSBzZXQgdXBcbiAgICBwcmVwYXJlRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3QgdHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gbGlnaHQuX3NoYWRvd1R5cGU7XG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5yZW5kZXJlci5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gdGhpcy5nZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSk7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgLy8gY2FtZXJhIGNsZWFyIHNldHRpbmdcbiAgICAgICAgLy8gTm90ZTogd2hlbiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgdGhlIG9ubHkgbGlnaHRpbmcgdHlwZSwgdGhpcyBjb2RlIGNhbiBiZSBtb3ZlZCB0byBjcmVhdGVTaGFkb3dDYW1lcmEgZnVuY3Rpb25cbiAgICAgICAgU2hhZG93UmVuZGVyZXIuc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCB0aGlzLmRldmljZSwgc2hhZG93VHlwZSwgdHlwZSwgaXNDbHVzdGVyZWQpO1xuXG4gICAgICAgIC8vIGFzc2lnbiByZW5kZXIgdGFyZ2V0IGZvciB0aGUgZmFjZVxuICAgICAgICBjb25zdCByZW5kZXJUYXJnZXRJbmRleCA9IHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IDAgOiBmYWNlO1xuICAgICAgICBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0ID0gbGlnaHQuX3NoYWRvd01hcC5yZW5kZXJUYXJnZXRzW3JlbmRlclRhcmdldEluZGV4XTtcblxuICAgICAgICByZXR1cm4gc2hhZG93Q2FtO1xuICAgIH1cblxuICAgIHJlbmRlckZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSwgY2xlYXIsIGluc2lkZVJlbmRlclBhc3MgPSB0cnVlKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzaGFkb3dNYXBTdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYFNIQURPVyAke2xpZ2h0Ll9ub2RlLm5hbWV9IEZBQ0UgJHtmYWNlfWApO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHRoaXMuZ2V0TGlnaHRSZW5kZXJEYXRhKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hVbmlmb3JtcyhsaWdodCwgc2hhZG93Q2FtLCBsaWdodFJlbmRlckRhdGEsIGZhY2UpO1xuXG4gICAgICAgIGNvbnN0IHJ0ID0gc2hhZG93Q2FtLnJlbmRlclRhcmdldDtcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVyO1xuICAgICAgICByZW5kZXJlci5zZXRDYW1lcmFVbmlmb3JtcyhzaGFkb3dDYW0sIHJ0KTtcbiAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzKSB7XG4gICAgICAgICAgICByZW5kZXJlci5zZXR1cFZpZXdVbmlmb3JtQnVmZmVycyhsaWdodFJlbmRlckRhdGEudmlld0JpbmRHcm91cHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5zaWRlUmVuZGVyUGFzcykge1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0dXBWaWV3cG9ydChzaGFkb3dDYW0sIHJ0KTtcblxuICAgICAgICAgICAgLy8gY2xlYXIgaGVyZSBpcyB1c2VkIHRvIGNsZWFyIGEgdmlld3BvcnQgaW5zaWRlIHJlbmRlciB0YXJnZXQuXG4gICAgICAgICAgICBpZiAoY2xlYXIpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJlci5jbGVhcihzaGFkb3dDYW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGlzIG9ubHkgdXNlZCBieSBsaWdodG1hcHBlciwgdGlsbCBpdCdzIGNvbnZlcnRlZCB0byByZW5kZXIgcGFzc2VzXG4gICAgICAgICAgICByZW5kZXJlci5jbGVhclZpZXcoc2hhZG93Q2FtLCBydCwgdHJ1ZSwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXR1cFJlbmRlclN0YXRlKGRldmljZSwgbGlnaHQpO1xuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnN1Ym1pdENhc3RlcnMobGlnaHRSZW5kZXJEYXRhLnZpc2libGVDYXN0ZXJzLCBsaWdodCk7XG5cbiAgICAgICAgdGhpcy5yZXN0b3JlUmVuZGVyU3RhdGUoZGV2aWNlKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgcmVuZGVyZXIuX3NoYWRvd01hcFRpbWUgKz0gbm93KCkgLSBzaGFkb3dNYXBTdGFydFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHJlbmRlcihsaWdodCwgY2FtZXJhLCBpbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZSkge1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzU2hhZG93UmVuZGVyaW5nKGxpZ2h0KSkge1xuICAgICAgICAgICAgY29uc3QgZmFjZUNvdW50ID0gbGlnaHQubnVtU2hhZG93RmFjZXM7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBmYWNlc1xuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgIHRoaXMucHJlcGFyZUZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UsIHRydWUsIGluc2lkZVJlbmRlclBhc3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhcHBseSB2c21cbiAgICAgICAgICAgIHRoaXMucmVuZGVyVm1zKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyVm1zKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICAvLyBWU00gYmx1ciBpZiBsaWdodCBzdXBwb3J0cyB2c20gKGRpcmVjdGlvbmFsIGFuZCBzcG90IGluIGdlbmVyYWwpXG4gICAgICAgIGlmIChsaWdodC5faXNWc20gJiYgbGlnaHQuX3ZzbUJsdXJTaXplID4gMSkge1xuXG4gICAgICAgICAgICAvLyBpbiBjbHVzdGVyZWQgbW9kZSwgb25seSBkaXJlY3Rpb25hbCBsaWdodCBjYW4gYmUgdm1zXG4gICAgICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCB8fCBsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBseVZzbUJsdXIobGlnaHQsIGNhbWVyYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRWc21CbHVyU2hhZGVyKGlzVnNtOCwgYmx1ck1vZGUsIGZpbHRlclNpemUpIHtcblxuICAgICAgICBsZXQgYmx1clNoYWRlciA9IChpc1ZzbTggPyB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXIgOiB0aGlzLmJsdXJWc21TaGFkZXIpW2JsdXJNb2RlXVtmaWx0ZXJTaXplXTtcbiAgICAgICAgaWYgKCFibHVyU2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmJsdXJWc21XZWlnaHRzW2ZpbHRlclNpemVdID0gZ2F1c3NXZWlnaHRzKGZpbHRlclNpemUpO1xuXG4gICAgICAgICAgICBjb25zdCBibHVyVlMgPSBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUztcbiAgICAgICAgICAgIGxldCBibHVyRlMgPSAnI2RlZmluZSBTQU1QTEVTICcgKyBmaWx0ZXJTaXplICsgJ1xcbic7XG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clBhY2tlZFZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBibHVyRlMgKz0gdGhpcy5ibHVyVnNtU2hhZGVyQ29kZVtibHVyTW9kZV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBibHVyU2hhZGVyTmFtZSA9ICdibHVyVnNtJyArIGJsdXJNb2RlICsgJycgKyBmaWx0ZXJTaXplICsgJycgKyBpc1ZzbTg7XG4gICAgICAgICAgICBibHVyU2hhZGVyID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUodGhpcy5kZXZpY2UsIGJsdXJWUywgYmx1ckZTLCBibHVyU2hhZGVyTmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChpc1ZzbTgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJbYmx1ck1vZGVdW2ZpbHRlclNpemVdID0gYmx1clNoYWRlcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYmx1clNoYWRlcjtcbiAgICB9XG5cbiAgICBhcHBseVZzbUJsdXIobGlnaHQsIGNhbWVyYSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBWU00gJHtsaWdodC5fbm9kZS5uYW1lfWApO1xuXG4gICAgICAgIC8vIHJlbmRlciBzdGF0ZVxuICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLkRFRkFVTFQpO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IGNhbWVyYSA6IG51bGwsIDApO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuICAgICAgICBjb25zdCBvcmlnU2hhZG93TWFwID0gc2hhZG93Q2FtLnJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyB0ZW1wb3JhcnkgcmVuZGVyIHRhcmdldCBmb3IgYmx1cnJpbmdcbiAgICAgICAgLy8gVE9ETzogdGhpcyBpcyBwcm9iYWJseSBub3Qgb3B0aW1hbCBhbmQgc2hhZG93IG1hcCBjb3VsZCBoYXZlIGRlcHRoIGJ1ZmZlciBvbiBpbiBhZGRpdGlvbiB0byBjb2xvciBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBmb3IgYmx1cnJpbmcgb25seSBvbmUgYnVmZmVyIGlzIG5lZWRlZC5cbiAgICAgICAgY29uc3QgdGVtcFNoYWRvd01hcCA9IHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuZ2V0KGRldmljZSwgbGlnaHQpO1xuICAgICAgICBjb25zdCB0ZW1wUnQgPSB0ZW1wU2hhZG93TWFwLnJlbmRlclRhcmdldHNbMF07XG5cbiAgICAgICAgY29uc3QgaXNWc204ID0gbGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19WU004O1xuICAgICAgICBjb25zdCBibHVyTW9kZSA9IGxpZ2h0LnZzbUJsdXJNb2RlO1xuICAgICAgICBjb25zdCBmaWx0ZXJTaXplID0gbGlnaHQuX3ZzbUJsdXJTaXplO1xuICAgICAgICBjb25zdCBibHVyU2hhZGVyID0gdGhpcy5nZXRWc21CbHVyU2hhZGVyKGlzVnNtOCwgYmx1ck1vZGUsIGZpbHRlclNpemUpO1xuXG4gICAgICAgIGJsdXJTY2lzc29yUmVjdC56ID0gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb24gLSAyO1xuICAgICAgICBibHVyU2Npc3NvclJlY3QudyA9IGJsdXJTY2lzc29yUmVjdC56O1xuXG4gICAgICAgIC8vIEJsdXIgaG9yaXpvbnRhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKG9yaWdTaGFkb3dNYXAuY29sb3JCdWZmZXIpO1xuICAgICAgICBwaXhlbE9mZnNldFswXSA9IDEgLyBsaWdodC5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMV0gPSAwO1xuICAgICAgICB0aGlzLnBpeGVsT2Zmc2V0SWQuc2V0VmFsdWUocGl4ZWxPZmZzZXQpO1xuICAgICAgICBpZiAoYmx1ck1vZGUgPT09IEJMVVJfR0FVU1NJQU4pIHRoaXMud2VpZ2h0SWQuc2V0VmFsdWUodGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSk7XG4gICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRlbXBSdCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyBCbHVyIHZlcnRpY2FsXG4gICAgICAgIHRoaXMuc291cmNlSWQuc2V0VmFsdWUodGVtcFJ0LmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMV0gPSBwaXhlbE9mZnNldFswXTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAwO1xuICAgICAgICB0aGlzLnBpeGVsT2Zmc2V0SWQuc2V0VmFsdWUocGl4ZWxPZmZzZXQpO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCBvcmlnU2hhZG93TWFwLCBibHVyU2hhZGVyLCBudWxsLCBibHVyU2Npc3NvclJlY3QpO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgdGVtcG9yYXJ5IHNoYWRvdyBtYXAgYmFjayB0byB0aGUgY2FjaGVcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zaGFkb3dNYXBDYWNoZS5hZGQobGlnaHQsIHRlbXBTaGFkb3dNYXApO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgJiYgIXRoaXMudmlld1VuaWZvcm1Gb3JtYXQpIHtcblxuICAgICAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0ID0gbmV3IFVuaWZvcm1CdWZmZXJGb3JtYXQodGhpcy5kZXZpY2UsIFtcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcIm1hdHJpeF92aWV3UHJvamVjdGlvblwiLCBVTklGT1JNVFlQRV9NQVQ0KVxuICAgICAgICAgICAgXSk7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyBiaW5kIGdyb3VwIC0gY29udGFpbnMgc2luZ2xlIHVuaWZvcm0gYnVmZmVyLCBhbmQgbm8gdGV4dHVyZXNcbiAgICAgICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG5ldyBCaW5kR3JvdXBGb3JtYXQodGhpcy5kZXZpY2UsIFtcbiAgICAgICAgICAgICAgICBuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpXG4gICAgICAgICAgICBdLCBbXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZyYW1lVXBkYXRlKCkge1xuICAgICAgICB0aGlzLmluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkb3dSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbImdhdXNzIiwieCIsInNpZ21hIiwiTWF0aCIsImV4cCIsImdhdXNzV2VpZ2h0cyIsImtlcm5lbFNpemUiLCJoYWxmV2lkdGgiLCJ2YWx1ZXMiLCJBcnJheSIsInN1bSIsImkiLCJzaGFkb3dDYW1WaWV3IiwiTWF0NCIsInNoYWRvd0NhbVZpZXdQcm9qIiwicGl4ZWxPZmZzZXQiLCJGbG9hdDMyQXJyYXkiLCJibHVyU2Npc3NvclJlY3QiLCJWZWM0Iiwib3BDaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwidmlld3BvcnRNYXRyaXgiLCJnZXREZXB0aEtleSIsIm1lc2hJbnN0YW5jZSIsIm1hdGVyaWFsIiwic2tpbkluc3RhbmNlIiwieSIsIm9wYWNpdHlNYXAiLCJvcENoYW4iLCJvcGFjaXR5TWFwQ2hhbm5lbCIsIlNoYWRvd1JlbmRlcmVyIiwiY29uc3RydWN0b3IiLCJyZW5kZXJlciIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiZGV2aWNlIiwic2NvcGUiLCJwb2x5Z29uT2Zmc2V0SWQiLCJyZXNvbHZlIiwicG9seWdvbk9mZnNldCIsInNvdXJjZUlkIiwicGl4ZWxPZmZzZXRJZCIsIndlaWdodElkIiwiYmx1clZzbVNoYWRlckNvZGUiLCJzaGFkZXJDaHVua3MiLCJibHVyVlNNUFMiLCJwYWNrZWQiLCJibHVyUGFja2VkVnNtU2hhZGVyQ29kZSIsImJsdXJWc21TaGFkZXIiLCJibHVyUGFja2VkVnNtU2hhZGVyIiwiYmx1clZzbVdlaWdodHMiLCJzaGFkb3dNYXBMaWdodFJhZGl1c0lkIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiYmxlbmRTdGF0ZVdyaXRlIiwiQmxlbmRTdGF0ZSIsImJsZW5kU3RhdGVOb1dyaXRlIiwic2V0Q29sb3JXcml0ZSIsImNyZWF0ZVNoYWRvd0NhbWVyYSIsInNoYWRvd1R5cGUiLCJ0eXBlIiwiZmFjZSIsInNoYWRvd0NhbSIsIkxpZ2h0Q2FtZXJhIiwiY3JlYXRlIiwiU0hBRE9XX1ZTTTgiLCJTSEFET1dfVlNNMzIiLCJjbGVhckNvbG9yIiwiQ29sb3IiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwic2V0U2hhZG93Q2FtZXJhU2V0dGluZ3MiLCJpc0NsdXN0ZXJlZCIsImh3UGNmIiwiU0hBRE9XX1BDRjUiLCJTSEFET1dfUENGMyIsInN1cHBvcnRzRGVwdGhTaGFkb3ciLCJMSUdIVFRZUEVfT01OSSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjdWxsU2hhZG93Q2FzdGVycyIsIm1lc2hJbnN0YW5jZXMiLCJ2aXNpYmxlIiwiY2FtZXJhIiwiY291bnQiLCJudW1JbnN0YW5jZXMiLCJsZW5ndGgiLCJjYXN0U2hhZG93IiwiY3VsbCIsIl9pc1Zpc2libGUiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwic29ydCIsInNvcnRDb21wYXJlRGVwdGgiLCJzZXR1cFJlbmRlclN0YXRlIiwibGlnaHQiLCJzY2VuZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsIndlYmdsMiIsImlzV2ViR1BVIiwiX3R5cGUiLCJzZXREZXB0aEJpYXMiLCJzZXREZXB0aEJpYXNWYWx1ZXMiLCJzaGFkb3dCaWFzIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsInNldFZhbHVlIiwidXNlU2hhZG93U2FtcGxlciIsIl9pc1BjZiIsInNldEJsZW5kU3RhdGUiLCJzZXREZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIkRFRkFVTFQiLCJyZXN0b3JlUmVuZGVyU3RhdGUiLCJkaXNwYXRjaFVuaWZvcm1zIiwibGlnaHRSZW5kZXJEYXRhIiwic2hhZG93Q2FtTm9kZSIsIl9ub2RlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiZGlzcGF0Y2hWaWV3UG9zIiwiZ2V0UG9zaXRpb24iLCJhdHRlbnVhdGlvbkVuZCIsInNldFRSUyIsImdldFJvdGF0aW9uIiwiVmVjMyIsIk9ORSIsImludmVydCIsIm11bDIiLCJwcm9qZWN0aW9uTWF0cml4IiwicmVjdFZpZXdwb3J0Iiwic2hhZG93Vmlld3BvcnQiLCJyZWN0Iiwic2Npc3NvclJlY3QiLCJzaGFkb3dTY2lzc29yIiwic2V0Vmlld3BvcnQiLCJ6IiwidyIsInNoYWRvd01hdHJpeCIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwic2V0IiwiZGF0YSIsInN1Ym1pdENhc3RlcnMiLCJ2aXNpYmxlQ2FzdGVycyIsInBhc3NGbGFncyIsIlNIQURFUl9TSEFET1ciLCJzaGFkb3dQYXNzIiwiU2hhZGVyUGFzcyIsImdldFNoYWRvdyIsIl9zaGFkb3dUeXBlIiwibWVzaCIsImVuc3VyZU1hdGVyaWFsIiwic2V0QmFzZUNvbnN0YW50cyIsInNldFNraW5uaW5nIiwiZGlydHkiLCJ1cGRhdGVVbmlmb3JtcyIsImNodW5rcyIsInNldEN1bGxNb2RlIiwic2V0UGFyYW1ldGVycyIsInNoYWRvd1NoYWRlciIsIl9zaGFkZXIiLCJ1cGRhdGVQYXNzU2hhZGVyIiwiX2tleSIsIlNPUlRLRVlfREVQVEgiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJEZWJ1ZyIsImVycm9yIiwibmFtZSIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRNb3JwaGluZyIsIm1vcnBoSW5zdGFuY2UiLCJzZXR1cE1lc2hVbmlmb3JtQnVmZmVycyIsInN0eWxlIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwiZHJhd0luc3RhbmNlIiwiX3NoYWRvd0RyYXdDYWxscyIsIm5lZWRzU2hhZG93UmVuZGVyaW5nIiwibmVlZHMiLCJlbmFibGVkIiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJudW1TaGFkb3dGYWNlcyIsImdldExpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzZXR1cFJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwic2hhZG93Q2FtZXJhIiwiY2xlYXJSZW5kZXJUYXJnZXQiLCJydCIsInJlbmRlclRhcmdldCIsImluaXQiLCJkZXB0aFN0ZW5jaWxPcHMiLCJjbGVhckRlcHRoVmFsdWUiLCJjbGVhckRlcHRoIiwiZGVwdGhCdWZmZXIiLCJzdG9yZURlcHRoIiwiY29sb3JPcHMiLCJjbGVhclZhbHVlIiwiY29weSIsImNsZWFyIiwicmVxdWlyZXNDdWJlbWFwcyIsInByZXBhcmVGYWNlIiwicmVuZGVyVGFyZ2V0SW5kZXgiLCJfc2hhZG93TWFwIiwicmVuZGVyVGFyZ2V0cyIsInJlbmRlckZhY2UiLCJpbnNpZGVSZW5kZXJQYXNzIiwic2hhZG93TWFwU3RhcnRUaW1lIiwibm93IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzZXRDYW1lcmFVbmlmb3JtcyIsInN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwic2V0dXBWaWV3cG9ydCIsImNsZWFyVmlldyIsInBvcEdwdU1hcmtlciIsIl9zaGFkb3dNYXBUaW1lIiwicmVuZGVyIiwiZmFjZUNvdW50IiwicmVuZGVyVm1zIiwiX2lzVnNtIiwiX3ZzbUJsdXJTaXplIiwiYXBwbHlWc21CbHVyIiwiZ2V0VnNtQmx1clNoYWRlciIsImlzVnNtOCIsImJsdXJNb2RlIiwiZmlsdGVyU2l6ZSIsImJsdXJTaGFkZXIiLCJibHVyVlMiLCJmdWxsc2NyZWVuUXVhZFZTIiwiYmx1ckZTIiwiYmx1clNoYWRlck5hbWUiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsIm9yaWdTaGFkb3dNYXAiLCJ0ZW1wU2hhZG93TWFwIiwic2hhZG93TWFwQ2FjaGUiLCJnZXQiLCJ0ZW1wUnQiLCJ2c21CbHVyTW9kZSIsIl9zaGFkb3dSZXNvbHV0aW9uIiwiY29sb3JCdWZmZXIiLCJCTFVSX0dBVVNTSUFOIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwiYWRkIiwiaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQiLCJVbmlmb3JtQnVmZmVyRm9ybWF0IiwiVW5pZm9ybUZvcm1hdCIsIlVOSUZPUk1UWVBFX01BVDQiLCJCaW5kR3JvdXBGb3JtYXQiLCJCaW5kQnVmZmVyRm9ybWF0IiwiVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUiLCJTSEFERVJTVEFHRV9WRVJURVgiLCJTSEFERVJTVEFHRV9GUkFHTUVOVCIsImZyYW1lVXBkYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE0QkEsU0FBU0EsS0FBSyxDQUFDQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtBQUNyQixFQUFBLE9BQU9DLElBQUksQ0FBQ0MsR0FBRyxDQUFDLEVBQUVILENBQUMsR0FBR0EsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHQyxLQUFLLEdBQUdBLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDckQsQ0FBQTtBQUVBLFNBQVNHLFlBQVksQ0FBQ0MsVUFBVSxFQUFFO0VBQzlCLE1BQU1KLEtBQUssR0FBRyxDQUFDSSxVQUFVLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FB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
