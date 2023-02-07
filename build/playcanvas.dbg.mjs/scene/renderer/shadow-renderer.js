/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { DEVICETYPE_WEBGPU, FUNC_LESSEQUAL, UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF3, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat } from '../../platform/graphics/bind-group-format.js';

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
      if (!meshInstance.cull || meshInstance._isVisible(camera)) {
        meshInstance.visibleThisFrame = true;
        visible[count] = meshInstance;
        count++;
      }
    }
    visible.length = count;

    // TODO: we should probably sort shadow meshes by shader and not depth
    visible.sort(this.renderer.sortCompareDepth);
  }
  setupRenderState(device, light) {
    const isClustered = this.renderer.scene.clusteredLightingEnabled;

    // depth bias
    if (device.webgl2 || device.deviceType === DEVICETYPE_WEBGPU) {
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
    device.setBlending(false);
    device.setDepthWrite(true);
    device.setDepthTest(true);
    device.setDepthFunc(FUNC_LESSEQUAL);
    const useShadowSampler = isClustered ? light._isPcf && device.webgl2 :
    // both spot and omni light are using shadow sampler on webgl2 when clustered
    light._isPcf && device.webgl2 && light._type !== LIGHTTYPE_OMNI; // for non-clustered, point light is using depth encoded in color buffer (should change to shadow sampler)
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

    // only clear the render pass target if all faces (cascades) are getting rendered
    if (clearRenderTarget) {
      // color
      const clearColor = shadowCamera.clearColorBuffer;
      renderPass.colorOps.clear = clearColor;
      if (clearColor) renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);

      // depth
      renderPass.depthStencilOps.storeDepth = !clearColor;
      renderPass.setClearDepth(1.0);
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
    // Note: when clustered lighting is the only light type, this code can be moved to createShadowCamera function
    ShadowRenderer.setShadowCameraSettings(shadowCam, this.device, shadowType, type, isClustered);

    // assign render target for the face
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
    this.renderer.setCameraUniforms(shadowCam, rt);
    if (device.supportsUniformBuffers) {
      this.renderer.setupViewUniformBuffers(lightRenderData.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, 1);
    }

    // if this is called from a render pass, no clearing takes place
    if (clear) {
      this.renderer.clearView(shadowCam, rt, true, false);
    } else {
      this.renderer.setupViewport(shadowCam, rt);
    }

    // render mesh instances
    this.submitCasters(lightRenderData.visibleCasters, light);
    this.restoreRenderState(device);
    DebugGraphics.popGpuMarker(device);
    this.renderer._shadowMapTime += now() - shadowMapStartTime;
  }
  render(light, camera) {
    if (this.needsShadowRendering(light)) {
      const faceCount = light.numShadowFaces;

      // render faces
      for (let face = 0; face < faceCount; face++) {
        this.prepareFace(light, camera, face);
        this.renderFace(light, camera, face, true);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBERVZJQ0VUWVBFX1dFQkdQVSwgRlVOQ19MRVNTRVFVQUwsIFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBTSEFERVJTVEFHRV9WRVJURVgsIFVOSUZPUk1UWVBFX01BVDQsIFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi9ncmFwaGljcy9xdWFkLXJlbmRlci11dGlscy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxVUl9HQVVTU0lBTixcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLFxuICAgIFNIQURFUl9TSEFET1csXG4gICAgU0hBRE9XX1BDRjMsIFNIQURPV19QQ0Y1LCBTSEFET1dfVlNNOCwgU0hBRE9XX1ZTTTMyLFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FLFxuICAgIFNPUlRLRVlfREVQVEhcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi9zaGFkZXItcGFzcy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IExpZ2h0Q2FtZXJhIH0gZnJvbSAnLi9saWdodC1jYW1lcmEuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlckZvcm1hdCwgVW5pZm9ybUZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBCaW5kQnVmZmVyRm9ybWF0LCBCaW5kR3JvdXBGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuY29uc3QgbWF4Qmx1clNpemUgPSAyNTtcbmZ1bmN0aW9uIGdhdXNzV2VpZ2h0cyhrZXJuZWxTaXplKSB7XG4gICAgaWYgKGtlcm5lbFNpemUgPiBtYXhCbHVyU2l6ZSkge1xuICAgICAgICBrZXJuZWxTaXplID0gbWF4Qmx1clNpemU7XG4gICAgfVxuICAgIGNvbnN0IHNpZ21hID0gKGtlcm5lbFNpemUgLSAxKSAvICgyICogMyk7XG5cbiAgICBjb25zdCBoYWxmV2lkdGggPSAoa2VybmVsU2l6ZSAtIDEpICogMC41O1xuICAgIGNvbnN0IHZhbHVlcyA9IG5ldyBBcnJheShrZXJuZWxTaXplKTtcbiAgICBsZXQgc3VtID0gMC4wO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2VybmVsU2l6ZTsgKytpKSB7XG4gICAgICAgIHZhbHVlc1tpXSA9IGdhdXNzKGkgLSBoYWxmV2lkdGgsIHNpZ21hKTtcbiAgICAgICAgc3VtICs9IHZhbHVlc1tpXTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gLz0gc3VtO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xufVxuXG5jb25zdCBzaGFkb3dDYW1WaWV3ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHNoYWRvd0NhbVZpZXdQcm9qID0gbmV3IE1hdDQoKTtcbmNvbnN0IHBpeGVsT2Zmc2V0ID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbmNvbnN0IGJsdXJTY2lzc29yUmVjdCA9IG5ldyBWZWM0KDEsIDEsIDAsIDApO1xuY29uc3Qgb3BDaGFuSWQgPSB7IHI6IDEsIGc6IDIsIGI6IDMsIGE6IDQgfTtcbmNvbnN0IHZpZXdwb3J0TWF0cml4ID0gbmV3IE1hdDQoKTtcblxuZnVuY3Rpb24gZ2V0RGVwdGhLZXkobWVzaEluc3RhbmNlKSB7XG4gICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdGFuY2UubWF0ZXJpYWw7XG4gICAgY29uc3QgeCA9IG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPyAxMCA6IDA7XG4gICAgbGV0IHkgPSAwO1xuICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwKSB7XG4gICAgICAgIGNvbnN0IG9wQ2hhbiA9IG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsO1xuICAgICAgICBpZiAob3BDaGFuKSB7XG4gICAgICAgICAgICB5ID0gb3BDaGFuSWRbb3BDaGFuXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geCArIHk7XG59XG5cbi8qKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTaGFkb3dSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn0gcmVuZGVyZXIgLSBUaGUgcmVuZGVyZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gbGlnaHRUZXh0dXJlQXRsYXMgLSBUaGVcbiAgICAgKiBzaGFkb3cgbWFwIGF0bGFzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHJlbmRlcmVyLCBsaWdodFRleHR1cmVBdGxhcykge1xuICAgICAgICB0aGlzLmRldmljZSA9IHJlbmRlcmVyLmRldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXJlci5qcycpLlJlbmRlcmVyfSAqL1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gcmVuZGVyZXI7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gKi9cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IGxpZ2h0VGV4dHVyZUF0bGFzO1xuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQgPSBzY29wZS5yZXNvbHZlKCdwb2x5Z29uT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgLy8gVlNNXG4gICAgICAgIHRoaXMuc291cmNlSWQgPSBzY29wZS5yZXNvbHZlKCdzb3VyY2UnKTtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncGl4ZWxPZmZzZXQnKTtcbiAgICAgICAgdGhpcy53ZWlnaHRJZCA9IHNjb3BlLnJlc29sdmUoJ3dlaWdodFswXScpO1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXJDb2RlID0gW3NoYWRlckNodW5rcy5ibHVyVlNNUFMsICcjZGVmaW5lIEdBVVNTXFxuJyArIHNoYWRlckNodW5rcy5ibHVyVlNNUFNdO1xuICAgICAgICBjb25zdCBwYWNrZWQgPSAnI2RlZmluZSBQQUNLRURcXG4nO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlID0gW3BhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMF0sIHBhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMV1dO1xuXG4gICAgICAgIC8vIGNhY2hlIGZvciB2c20gYmx1ciBzaGFkZXJzXG4gICAgICAgIHRoaXMuYmx1clZzbVNoYWRlciA9IFt7fSwge31dO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXIgPSBbe30sIHt9XTtcblxuICAgICAgICB0aGlzLmJsdXJWc21XZWlnaHRzID0ge307XG5cbiAgICAgICAgLy8gdW5pZm9ybXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfcmFkaXVzJyk7XG5cbiAgICAgICAgLy8gdmlldyBiaW5kIGdyb3VwIGZvcm1hdCB3aXRoIGl0cyB1bmlmb3JtIGJ1ZmZlciBmb3JtYXRcbiAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG51bGw7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlcyBzaGFkb3cgY2FtZXJhIGZvciBhIGxpZ2h0IGFuZCBzZXRzIHVwIGl0cyBjb25zdGFudCBwcm9wZXJ0aWVzXG4gICAgc3RhdGljIGNyZWF0ZVNoYWRvd0NhbWVyYShkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGZhY2UpIHtcblxuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBMaWdodENhbWVyYS5jcmVhdGUoJ1NoYWRvd0NhbWVyYScsIHR5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIGRvbid0IGNsZWFyIHRoZSBjb2xvciBidWZmZXIgaWYgcmVuZGVyaW5nIGEgZGVwdGggbWFwXG4gICAgICAgIGlmIChzaGFkb3dUeXBlID49IFNIQURPV19WU004ICYmIHNoYWRvd1R5cGUgPD0gU0hBRE9XX1ZTTTMyKSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyRGVwdGhCdWZmZXIgPSB0cnVlO1xuICAgICAgICBzaGFkb3dDYW0uY2xlYXJTdGVuY2lsQnVmZmVyID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICBzdGF0aWMgc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCBkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKSB7XG5cbiAgICAgICAgLy8gbm9ybWFsIG9tbmkgc2hhZG93cyBvbiB3ZWJnbDIgZW5jb2RlIGRlcHRoIGluIFJHQkE4IGFuZCBkbyBtYW51YWwgUENGIHNhbXBsaW5nXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIHVzZSBkZXB0aCBmb3JtYXQgYW5kIGhhcmR3YXJlIFBDRiBzYW1wbGluZ1xuICAgICAgICBsZXQgaHdQY2YgPSBzaGFkb3dUeXBlID09PSBTSEFET1dfUENGNSB8fCAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgZGV2aWNlLnN1cHBvcnRzRGVwdGhTaGFkb3cpO1xuICAgICAgICBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgIWlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICBod1BjZiA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3JCdWZmZXIgPSAhaHdQY2Y7XG4gICAgfVxuXG4gICAgLy8gY3VsbHMgdGhlIGxpc3Qgb2YgbWVzaGVzIGluc3RhbmNlcyBieSB0aGUgY2FtZXJhLCBzdG9yaW5nIHZpc2libGUgbWVzaCBpbnN0YW5jZXMgaW4gdGhlIHNwZWNpZmllZCBhcnJheVxuICAgIGN1bGxTaGFkb3dDYXN0ZXJzKG1lc2hJbnN0YW5jZXMsIHZpc2libGUsIGNhbWVyYSkge1xuXG4gICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IG51bUluc3RhbmNlcyA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUluc3RhbmNlczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSBtZXNoSW5zdGFuY2VzW2ldO1xuXG4gICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZS5jdWxsIHx8IG1lc2hJbnN0YW5jZS5faXNWaXNpYmxlKGNhbWVyYSkpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdmlzaWJsZVtjb3VudF0gPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZpc2libGUubGVuZ3RoID0gY291bnQ7XG5cbiAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIHByb2JhYmx5IHNvcnQgc2hhZG93IG1lc2hlcyBieSBzaGFkZXIgYW5kIG5vdCBkZXB0aFxuICAgICAgICB2aXNpYmxlLnNvcnQodGhpcy5yZW5kZXJlci5zb3J0Q29tcGFyZURlcHRoKTtcbiAgICB9XG5cbiAgICBzZXR1cFJlbmRlclN0YXRlKGRldmljZSwgbGlnaHQpIHtcblxuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIGRlcHRoIGJpYXNcbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR1BVKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKHRydWUpO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXNWYWx1ZXMobGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjAsIGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZC5zZXRWYWx1ZSh0aGlzLnBvbHlnb25PZmZzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZC5zZXRWYWx1ZSh0aGlzLnBvbHlnb25PZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHN0YW5kYXJkIHNoYWRvd21hcCBzdGF0ZXNcbiAgICAgICAgZGV2aWNlLnNldEJsZW5kaW5nKGZhbHNlKTtcbiAgICAgICAgZGV2aWNlLnNldERlcHRoV3JpdGUodHJ1ZSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aFRlc3QodHJ1ZSk7XG4gICAgICAgIGRldmljZS5zZXREZXB0aEZ1bmMoRlVOQ19MRVNTRVFVQUwpO1xuXG4gICAgICAgIGNvbnN0IHVzZVNoYWRvd1NhbXBsZXIgPSBpc0NsdXN0ZXJlZCA/XG4gICAgICAgICAgICBsaWdodC5faXNQY2YgJiYgZGV2aWNlLndlYmdsMiA6ICAgICAvLyBib3RoIHNwb3QgYW5kIG9tbmkgbGlnaHQgYXJlIHVzaW5nIHNoYWRvdyBzYW1wbGVyIG9uIHdlYmdsMiB3aGVuIGNsdXN0ZXJlZFxuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGRldmljZS53ZWJnbDIgJiYgbGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9PTU5JOyAgICAvLyBmb3Igbm9uLWNsdXN0ZXJlZCwgcG9pbnQgbGlnaHQgaXMgdXNpbmcgZGVwdGggZW5jb2RlZCBpbiBjb2xvciBidWZmZXIgKHNob3VsZCBjaGFuZ2UgdG8gc2hhZG93IHNhbXBsZXIpXG4gICAgICAgIGlmICh1c2VTaGFkb3dTYW1wbGVyKSB7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZShmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpIHtcblxuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IDA7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQuc2V0VmFsdWUodGhpcy5wb2x5Z29uT2Zmc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoVW5pZm9ybXMobGlnaHQsIHNoYWRvd0NhbSwgbGlnaHRSZW5kZXJEYXRhLCBmYWNlKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtTm9kZSA9IHNoYWRvd0NhbS5fbm9kZTtcblxuICAgICAgICAvLyBwb3NpdGlvbiAvIHJhbmdlXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLmRpc3BhdGNoVmlld1BvcyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkLnNldFZhbHVlKGxpZ2h0LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZpZXctcHJvamVjdGlvbiBzaGFkb3cgbWF0cml4XG4gICAgICAgIHNoYWRvd0NhbVZpZXcuc2V0VFJTKHNoYWRvd0NhbU5vZGUuZ2V0UG9zaXRpb24oKSwgc2hhZG93Q2FtTm9kZS5nZXRSb3RhdGlvbigpLCBWZWMzLk9ORSkuaW52ZXJ0KCk7XG4gICAgICAgIHNoYWRvd0NhbVZpZXdQcm9qLm11bDIoc2hhZG93Q2FtLnByb2plY3Rpb25NYXRyaXgsIHNoYWRvd0NhbVZpZXcpO1xuXG4gICAgICAgIC8vIHZpZXdwb3J0IGhhbmRsaW5nXG4gICAgICAgIGNvbnN0IHJlY3RWaWV3cG9ydCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dWaWV3cG9ydDtcbiAgICAgICAgc2hhZG93Q2FtLnJlY3QgPSByZWN0Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5zY2lzc29yUmVjdCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dTY2lzc29yO1xuXG4gICAgICAgIHZpZXdwb3J0TWF0cml4LnNldFZpZXdwb3J0KHJlY3RWaWV3cG9ydC54LCByZWN0Vmlld3BvcnQueSwgcmVjdFZpZXdwb3J0LnosIHJlY3RWaWV3cG9ydC53KTtcbiAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5tdWwyKHZpZXdwb3J0TWF0cml4LCBzaGFkb3dDYW1WaWV3UHJvaik7XG5cbiAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIC8vIGNvcHkgbWF0cml4IHRvIHNoYWRvdyBjYXNjYWRlIHBhbGV0dGVcbiAgICAgICAgICAgIGxpZ2h0Ll9zaGFkb3dNYXRyaXhQYWxldHRlLnNldChsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEsIGZhY2UgKiAxNik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSB2aXNpYmxlQ2FzdGVycyAtIFZpc2libGUgbWVzaFxuICAgICAqIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGlnaHQuanMnKS5MaWdodH0gbGlnaHQgLSBUaGUgbGlnaHQuXG4gICAgICovXG4gICAgc3VibWl0Q2FzdGVycyh2aXNpYmxlQ2FzdGVycywgbGlnaHQpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVyO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHJlbmRlcmVyLnNjZW5lO1xuICAgICAgICBjb25zdCBwYXNzRmxhZ3MgPSAxIDw8IFNIQURFUl9TSEFET1c7XG5cbiAgICAgICAgLy8gU29ydCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gU2hhZGVyUGFzcy5nZXRTaGFkb3cobGlnaHQuX3R5cGUsIGxpZ2h0Ll9zaGFkb3dUeXBlKTtcblxuICAgICAgICAvLyBUT0RPOiBTaW1pbGFybHkgdG8gZm9yd2FyZCByZW5kZXJlciwgYSBzaGFkZXIgY3JlYXRpb24gcGFydCBvZiB0aGlzIGxvb3Agc2hvdWxkIGJlIHNwbGl0IGludG8gYSBzZXBhcmF0ZSBsb29wLFxuICAgICAgICAvLyBhbmQgZW5kU2hhZGVyQmF0Y2ggc2hvdWxkIGJlIGNhbGxlZCBhdCBpdHMgZW5kXG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldEN1bGxNb2RlKHRydWUsIGZhbHNlLCBtZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSSAoc2hhZG93KTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJSSAoc2hhZG93KTogbWVzaEluc3RhbmNlIG92ZXJyaWRlc1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWdzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IHNoYWRlclxuICAgICAgICAgICAgbGV0IHNoYWRvd1NoYWRlciA9IG1lc2hJbnN0YW5jZS5fc2hhZGVyW3NoYWRvd1Bhc3NdO1xuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIpIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgc2hhZG93UGFzcywgbnVsbCwgbnVsbCwgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgICAgICBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuX2tleVtTT1JUS0VZX0RFUFRIXSA9IGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNoYWRvd1NoYWRlci5mYWlsZWQgJiYgIWRldmljZS5zZXRTaGFkZXIoc2hhZG93U2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBFcnJvciBjb21waWxpbmcgc2hhZG93IHNoYWRlciBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7c2hhZG93UGFzc31gLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBidWZmZXJzXG4gICAgICAgICAgICByZW5kZXJlci5zZXRWZXJ0ZXhCdWZmZXJzKGRldmljZSwgbWVzaCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRNb3JwaGluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZS5tb3JwaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zZXR1cE1lc2hVbmlmb3JtQnVmZmVycyhtZXNoSW5zdGFuY2UsIHNoYWRvd1Bhc3MpO1xuXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IG1lc2hJbnN0YW5jZS5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgIGRldmljZS5zZXRJbmRleEJ1ZmZlcihtZXNoLmluZGV4QnVmZmVyW3N0eWxlXSk7XG5cbiAgICAgICAgICAgIC8vIGRyYXdcbiAgICAgICAgICAgIHJlbmRlcmVyLmRyYXdJbnN0YW5jZShkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpO1xuICAgICAgICAgICAgcmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscysrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbmVlZHNTaGFkb3dSZW5kZXJpbmcobGlnaHQpIHtcblxuICAgICAgICBjb25zdCBuZWVkcyA9IGxpZ2h0LmVuYWJsZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUgJiYgbGlnaHQudmlzaWJsZVRoaXNGcmFtZTtcblxuICAgICAgICBpZiAobGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRSkge1xuICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9OT05FO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzICs9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5lZWRzO1xuICAgIH1cblxuICAgIGdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKSB7XG4gICAgICAgIC8vIGRpcmVjdGlvbmFsIHNoYWRvd3MgYXJlIHBlciBjYW1lcmEsIHNvIGdldCBhcHByb3ByaWF0ZSByZW5kZXIgZGF0YVxuICAgICAgICByZXR1cm4gbGlnaHQuZ2V0UmVuZGVyRGF0YShsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gY2FtZXJhIDogbnVsbCwgZmFjZSk7XG4gICAgfVxuXG4gICAgc2V0dXBSZW5kZXJQYXNzKHJlbmRlclBhc3MsIHNoYWRvd0NhbWVyYSwgY2xlYXJSZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCBydCA9IHNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIHJlbmRlclBhc3MuaW5pdChydCk7XG5cbiAgICAgICAgLy8gb25seSBjbGVhciB0aGUgcmVuZGVyIHBhc3MgdGFyZ2V0IGlmIGFsbCBmYWNlcyAoY2FzY2FkZXMpIGFyZSBnZXR0aW5nIHJlbmRlcmVkXG4gICAgICAgIGlmIChjbGVhclJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgLy8gY29sb3JcbiAgICAgICAgICAgIGNvbnN0IGNsZWFyQ29sb3IgPSBzaGFkb3dDYW1lcmEuY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXIgPSBjbGVhckNvbG9yO1xuICAgICAgICAgICAgaWYgKGNsZWFyQ29sb3IpXG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5jb2xvck9wcy5jbGVhclZhbHVlLmNvcHkoc2hhZG93Q2FtZXJhLmNsZWFyQ29sb3IpO1xuXG4gICAgICAgICAgICAvLyBkZXB0aFxuICAgICAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVEZXB0aCA9ICFjbGVhckNvbG9yO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckRlcHRoKDEuMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBub3Qgc2FtcGxpbmcgZHluYW1pY2FsbHkgZ2VuZXJhdGVkIGN1YmVtYXBzXG4gICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIHJlbmRlciB0YXJnZXQgLyByZW5kZXIgdGFyZ2V0IHNldHRpbmdzIHRvIGFsbG93IHJlbmRlciBwYXNzIHRvIGJlIHNldCB1cFxuICAgIHByZXBhcmVGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UpIHtcblxuICAgICAgICBjb25zdCB0eXBlID0gbGlnaHQuX3R5cGU7XG4gICAgICAgIGNvbnN0IHNoYWRvd1R5cGUgPSBsaWdodC5fc2hhZG93VHlwZTtcbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSB0aGlzLmdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICAvLyBjYW1lcmEgY2xlYXIgc2V0dGluZ1xuICAgICAgICAvLyBOb3RlOiB3aGVuIGNsdXN0ZXJlZCBsaWdodGluZyBpcyB0aGUgb25seSBsaWdodCB0eXBlLCB0aGlzIGNvZGUgY2FuIGJlIG1vdmVkIHRvIGNyZWF0ZVNoYWRvd0NhbWVyYSBmdW5jdGlvblxuICAgICAgICBTaGFkb3dSZW5kZXJlci5zZXRTaGFkb3dDYW1lcmFTZXR0aW5ncyhzaGFkb3dDYW0sIHRoaXMuZGV2aWNlLCBzaGFkb3dUeXBlLCB0eXBlLCBpc0NsdXN0ZXJlZCk7XG5cbiAgICAgICAgLy8gYXNzaWduIHJlbmRlciB0YXJnZXQgZm9yIHRoZSBmYWNlXG4gICAgICAgIGNvbnN0IHJlbmRlclRhcmdldEluZGV4ID0gdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gMCA6IGZhY2U7XG4gICAgICAgIHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQgPSBsaWdodC5fc2hhZG93TWFwLnJlbmRlclRhcmdldHNbcmVuZGVyVGFyZ2V0SW5kZXhdO1xuXG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgcmVuZGVyRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlLCBjbGVhcikge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2hhZG93TWFwU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBTSEFET1cgJHtsaWdodC5fbm9kZS5uYW1lfSBGQUNFICR7ZmFjZX1gKTtcblxuICAgICAgICB0aGlzLnNldHVwUmVuZGVyU3RhdGUoZGV2aWNlLCBsaWdodCk7XG5cbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gdGhpcy5nZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSk7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgdGhpcy5kaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSk7XG5cbiAgICAgICAgY29uc3QgcnQgPSBzaGFkb3dDYW0ucmVuZGVyVGFyZ2V0O1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNldENhbWVyYVVuaWZvcm1zKHNoYWRvd0NhbSwgcnQpO1xuICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMobGlnaHRSZW5kZXJEYXRhLnZpZXdCaW5kR3JvdXBzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhpcyBpcyBjYWxsZWQgZnJvbSBhIHJlbmRlciBwYXNzLCBubyBjbGVhcmluZyB0YWtlcyBwbGFjZVxuICAgICAgICBpZiAoY2xlYXIpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuY2xlYXJWaWV3KHNoYWRvd0NhbSwgcnQsIHRydWUsIGZhbHNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2V0dXBWaWV3cG9ydChzaGFkb3dDYW0sIHJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnN1Ym1pdENhc3RlcnMobGlnaHRSZW5kZXJEYXRhLnZpc2libGVDYXN0ZXJzLCBsaWdodCk7XG5cbiAgICAgICAgdGhpcy5yZXN0b3JlUmVuZGVyU3RhdGUoZGV2aWNlKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZSArPSBub3coKSAtIHNoYWRvd01hcFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgcmVuZGVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBpZiAodGhpcy5uZWVkc1NoYWRvd1JlbmRlcmluZyhsaWdodCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZhY2VDb3VudCA9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgZmFjZXNcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXBwbHkgdnNtXG4gICAgICAgICAgICB0aGlzLnJlbmRlclZtcyhsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlclZtcyhsaWdodCwgY2FtZXJhKSB7XG5cbiAgICAgICAgLy8gVlNNIGJsdXIgaWYgbGlnaHQgc3VwcG9ydHMgdnNtIChkaXJlY3Rpb25hbCBhbmQgc3BvdCBpbiBnZW5lcmFsKVxuICAgICAgICBpZiAobGlnaHQuX2lzVnNtICYmIGxpZ2h0Ll92c21CbHVyU2l6ZSA+IDEpIHtcblxuICAgICAgICAgICAgLy8gaW4gY2x1c3RlcmVkIG1vZGUsIG9ubHkgZGlyZWN0aW9uYWwgbGlnaHQgY2FuIGJlIHZtc1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgIGlmICghaXNDbHVzdGVyZWQgfHwgbGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgVlNNICR7bGlnaHQuX25vZGUubmFtZX1gKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCAwKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcbiAgICAgICAgY29uc3Qgb3JpZ1NoYWRvd01hcCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgZm9yIGJsdXJyaW5nXG4gICAgICAgIC8vIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG9wdGltYWwgYW5kIHNoYWRvdyBtYXAgY291bGQgaGF2ZSBkZXB0aCBidWZmZXIgb24gaW4gYWRkaXRpb24gdG8gY29sb3IgYnVmZmVyLFxuICAgICAgICAvLyBhbmQgZm9yIGJsdXJyaW5nIG9ubHkgb25lIGJ1ZmZlciBpcyBuZWVkZWQuXG4gICAgICAgIGNvbnN0IHRlbXBTaGFkb3dNYXAgPSB0aGlzLnJlbmRlcmVyLnNoYWRvd01hcENhY2hlLmdldChkZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgY29uc3QgdGVtcFJ0ID0gdGVtcFNoYWRvd01hcC5yZW5kZXJUYXJnZXRzWzBdO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtOCA9IGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNODtcbiAgICAgICAgY29uc3QgYmx1ck1vZGUgPSBsaWdodC52c21CbHVyTW9kZTtcbiAgICAgICAgY29uc3QgZmlsdGVyU2l6ZSA9IGxpZ2h0Ll92c21CbHVyU2l6ZTtcbiAgICAgICAgY29uc3QgYmx1clNoYWRlciA9IHRoaXMuZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKTtcblxuICAgICAgICBibHVyU2Npc3NvclJlY3QueiA9IGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uIC0gMjtcbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LncgPSBibHVyU2Npc3NvclJlY3QuejtcblxuICAgICAgICAvLyBCbHVyIGhvcml6b250YWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZShvcmlnU2hhZG93TWFwLmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAxIC8gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgaWYgKGJsdXJNb2RlID09PSBCTFVSX0dBVVNTSUFOKSB0aGlzLndlaWdodElkLnNldFZhbHVlKHRoaXMuYmx1clZzbVdlaWdodHNbZmlsdGVyU2l6ZV0pO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUnQsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gQmx1ciB2ZXJ0aWNhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKHRlbXBSdC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gcGl4ZWxPZmZzZXRbMF07XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgb3JpZ1NoYWRvd01hcCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIHRlbXBvcmFyeSBzaGFkb3cgbWFwIGJhY2sgdG8gdGhlIGNhY2hlXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuYWRkKGxpZ2h0LCB0ZW1wU2hhZG93TWFwKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIG5vIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZG93UmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJnYXVzcyIsIngiLCJzaWdtYSIsIk1hdGgiLCJleHAiLCJtYXhCbHVyU2l6ZSIsImdhdXNzV2VpZ2h0cyIsImtlcm5lbFNpemUiLCJoYWxmV2lkdGgiLCJ2YWx1ZXMiLCJBcnJheSIsInN1bSIsImkiLCJzaGFkb3dDYW1WaWV3IiwiTWF0NCIsInNoYWRvd0NhbVZpZXdQcm9qIiwicGl4ZWxPZmZzZXQiLCJGbG9hdDMyQXJyYXkiLCJibHVyU2Npc3NvclJlY3QiLCJWZWM0Iiwib3BDaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwidmlld3BvcnRNYXRyaXgiLCJnZXREZXB0aEtleSIsIm1lc2hJbnN0YW5jZSIsIm1hdGVyaWFsIiwic2tpbkluc3RhbmNlIiwieSIsIm9wYWNpdHlNYXAiLCJvcENoYW4iLCJvcGFjaXR5TWFwQ2hhbm5lbCIsIlNoYWRvd1JlbmRlcmVyIiwiY29uc3RydWN0b3IiLCJyZW5kZXJlciIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiZGV2aWNlIiwic2NvcGUiLCJwb2x5Z29uT2Zmc2V0SWQiLCJyZXNvbHZlIiwicG9seWdvbk9mZnNldCIsInNvdXJjZUlkIiwicGl4ZWxPZmZzZXRJZCIsIndlaWdodElkIiwiYmx1clZzbVNoYWRlckNvZGUiLCJzaGFkZXJDaHVua3MiLCJibHVyVlNNUFMiLCJwYWNrZWQiLCJibHVyUGFja2VkVnNtU2hhZGVyQ29kZSIsImJsdXJWc21TaGFkZXIiLCJibHVyUGFja2VkVnNtU2hhZGVyIiwiYmx1clZzbVdlaWdodHMiLCJzaGFkb3dNYXBMaWdodFJhZGl1c0lkIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiY3JlYXRlU2hhZG93Q2FtZXJhIiwic2hhZG93VHlwZSIsInR5cGUiLCJmYWNlIiwic2hhZG93Q2FtIiwiTGlnaHRDYW1lcmEiLCJjcmVhdGUiLCJTSEFET1dfVlNNOCIsIlNIQURPV19WU00zMiIsImNsZWFyQ29sb3IiLCJDb2xvciIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJzZXRTaGFkb3dDYW1lcmFTZXR0aW5ncyIsImlzQ2x1c3RlcmVkIiwiaHdQY2YiLCJTSEFET1dfUENGNSIsIlNIQURPV19QQ0YzIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsIkxJR0hUVFlQRV9PTU5JIiwiY2xlYXJDb2xvckJ1ZmZlciIsImN1bGxTaGFkb3dDYXN0ZXJzIiwibWVzaEluc3RhbmNlcyIsInZpc2libGUiLCJjYW1lcmEiLCJjb3VudCIsIm51bUluc3RhbmNlcyIsImxlbmd0aCIsImN1bGwiLCJfaXNWaXNpYmxlIiwidmlzaWJsZVRoaXNGcmFtZSIsInNvcnQiLCJzb3J0Q29tcGFyZURlcHRoIiwic2V0dXBSZW5kZXJTdGF0ZSIsImxpZ2h0Iiwic2NlbmUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJ3ZWJnbDIiLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHUFUiLCJfdHlwZSIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsInNoYWRvd0JpYXMiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwic2V0VmFsdWUiLCJzZXRCbGVuZGluZyIsInNldERlcHRoV3JpdGUiLCJzZXREZXB0aFRlc3QiLCJzZXREZXB0aEZ1bmMiLCJGVU5DX0xFU1NFUVVBTCIsInVzZVNoYWRvd1NhbXBsZXIiLCJfaXNQY2YiLCJzZXRDb2xvcldyaXRlIiwicmVzdG9yZVJlbmRlclN0YXRlIiwiZGlzcGF0Y2hVbmlmb3JtcyIsImxpZ2h0UmVuZGVyRGF0YSIsInNoYWRvd0NhbU5vZGUiLCJfbm9kZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImRpc3BhdGNoVmlld1BvcyIsImdldFBvc2l0aW9uIiwiYXR0ZW51YXRpb25FbmQiLCJzZXRUUlMiLCJnZXRSb3RhdGlvbiIsIlZlYzMiLCJPTkUiLCJpbnZlcnQiLCJtdWwyIiwicHJvamVjdGlvbk1hdHJpeCIsInJlY3RWaWV3cG9ydCIsInNoYWRvd1ZpZXdwb3J0IiwicmVjdCIsInNjaXNzb3JSZWN0Iiwic2hhZG93U2Npc3NvciIsInNldFZpZXdwb3J0IiwieiIsInciLCJzaGFkb3dNYXRyaXgiLCJfc2hhZG93TWF0cml4UGFsZXR0ZSIsInNldCIsImRhdGEiLCJzdWJtaXRDYXN0ZXJzIiwidmlzaWJsZUNhc3RlcnMiLCJwYXNzRmxhZ3MiLCJTSEFERVJfU0hBRE9XIiwic2hhZG93UGFzcyIsIlNoYWRlclBhc3MiLCJnZXRTaGFkb3ciLCJfc2hhZG93VHlwZSIsIm1lc2giLCJlbnN1cmVNYXRlcmlhbCIsInNldEJhc2VDb25zdGFudHMiLCJzZXRTa2lubmluZyIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJjaHVua3MiLCJzZXRDdWxsTW9kZSIsInNldFBhcmFtZXRlcnMiLCJzaGFkb3dTaGFkZXIiLCJfc2hhZGVyIiwidXBkYXRlUGFzc1NoYWRlciIsIl9rZXkiLCJTT1JUS0VZX0RFUFRIIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiRGVidWciLCJlcnJvciIsIm5hbWUiLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0TW9ycGhpbmciLCJtb3JwaEluc3RhbmNlIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJzdHlsZSIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsImRyYXdJbnN0YW5jZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJuZWVkc1NoYWRvd1JlbmRlcmluZyIsIm5lZWRzIiwiZW5hYmxlZCIsImNhc3RTaGFkb3dzIiwic2hhZG93VXBkYXRlTW9kZSIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsIl9zaGFkb3dNYXBVcGRhdGVzIiwibnVtU2hhZG93RmFjZXMiLCJnZXRMaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwic2V0dXBSZW5kZXJQYXNzIiwicmVuZGVyUGFzcyIsInNoYWRvd0NhbWVyYSIsImNsZWFyUmVuZGVyVGFyZ2V0IiwicnQiLCJyZW5kZXJUYXJnZXQiLCJpbml0IiwiY29sb3JPcHMiLCJjbGVhciIsImNsZWFyVmFsdWUiLCJjb3B5IiwiZGVwdGhTdGVuY2lsT3BzIiwic3RvcmVEZXB0aCIsInNldENsZWFyRGVwdGgiLCJyZXF1aXJlc0N1YmVtYXBzIiwicHJlcGFyZUZhY2UiLCJyZW5kZXJUYXJnZXRJbmRleCIsIl9zaGFkb3dNYXAiLCJyZW5kZXJUYXJnZXRzIiwicmVuZGVyRmFjZSIsInNoYWRvd01hcFN0YXJ0VGltZSIsIm5vdyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJ2aWV3QmluZEdyb3VwcyIsImNsZWFyVmlldyIsInNldHVwVmlld3BvcnQiLCJwb3BHcHVNYXJrZXIiLCJfc2hhZG93TWFwVGltZSIsInJlbmRlciIsImZhY2VDb3VudCIsInJlbmRlclZtcyIsIl9pc1ZzbSIsIl92c21CbHVyU2l6ZSIsImFwcGx5VnNtQmx1ciIsImdldFZzbUJsdXJTaGFkZXIiLCJpc1ZzbTgiLCJibHVyTW9kZSIsImZpbHRlclNpemUiLCJibHVyU2hhZGVyIiwiYmx1clZTIiwiZnVsbHNjcmVlblF1YWRWUyIsImJsdXJGUyIsImJsdXJTaGFkZXJOYW1lIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJvcmlnU2hhZG93TWFwIiwidGVtcFNoYWRvd01hcCIsInNoYWRvd01hcENhY2hlIiwiZ2V0IiwidGVtcFJ0IiwidnNtQmx1ck1vZGUiLCJfc2hhZG93UmVzb2x1dGlvbiIsImNvbG9yQnVmZmVyIiwiQkxVUl9HQVVTU0lBTiIsImRyYXdRdWFkV2l0aFNoYWRlciIsImFkZCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0IiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJmcmFtZVVwZGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTBCQSxTQUFTQSxLQUFLLENBQUNDLENBQUMsRUFBRUMsS0FBSyxFQUFFO0FBQ3JCLEVBQUEsT0FBT0MsSUFBSSxDQUFDQyxHQUFHLENBQUMsRUFBRUgsQ0FBQyxHQUFHQSxDQUFDLENBQUMsSUFBSSxHQUFHLEdBQUdDLEtBQUssR0FBR0EsS0FBSyxDQUFDLENBQUMsQ0FBQTtBQUNyRCxDQUFBO0FBRUEsTUFBTUcsV0FBVyxHQUFHLEVBQUUsQ0FBQTtBQUN0QixTQUFTQyxZQUFZLENBQUNDLFVBQVUsRUFBRTtFQUM5QixJQUFJQSxVQUFVLEdBQUdGLFdBQVcsRUFBRTtBQUMxQkUsSUFBQUEsVUFBVSxHQUFHRixXQUFXLENBQUE7QUFDNUIsR0FBQTtFQUNBLE1BQU1ILEtBQUssR0FBRyxDQUFDSyxVQUFVLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUV4QyxFQUFBLE1BQU1DLFNBQVMsR0FBRyxDQUFDRCxVQUFVLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQTtBQUN4QyxFQUFBLE1BQU1FLE1BQU0sR0FBRyxJQUFJQyxLQUFLLENBQUNILFVBQVUsQ0FBQyxDQUFBO0VBQ3BDLElBQUlJLEdBQUcsR0FBRyxHQUFHLENBQUE7RUFDYixLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0wsVUFBVSxFQUFFLEVBQUVLLENBQUMsRUFBRTtJQUNqQ0gsTUFBTSxDQUFDRyxDQUFDLENBQUMsR0FBR1osS0FBSyxDQUFDWSxDQUFDLEdBQUdKLFNBQVMsRUFBRU4sS0FBSyxDQUFDLENBQUE7QUFDdkNTLElBQUFBLEdBQUcsSUFBSUYsTUFBTSxDQUFDRyxDQUFDLENBQUMsQ0FBQTtBQUNwQixHQUFB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
