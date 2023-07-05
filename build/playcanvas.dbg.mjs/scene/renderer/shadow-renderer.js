import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { SHADOW_VSM8, SHADOW_VSM32, SHADOW_PCF5, SHADOW_PCF1, SHADOW_PCF3, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
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
    /**
     * A cache of shadow passes. First index is looked up by light type, second by shadow type.
     *
     * @type {import('../shader-pass.js').ShaderPassInfo[][]}
     * @private
     */
    this.shadowPassCache = [];
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
    let hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF1 || shadowType === SHADOW_PCF3) && device.supportsDepthShadow;
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
    const gpuOrGl2 = device.webgl2 || device.isWebGPU;
    const useShadowSampler = isClustered ? light._isPcf && gpuOrGl2 :
    // both spot and omni light are using shadow sampler on webgl2 when clustered
    light._isPcf && gpuOrGl2 && light._type !== LIGHTTYPE_OMNI; // for non-clustered, point light is using depth encoded in color buffer (should change to shadow sampler)

    device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
    device.setDepthState(DepthState.DEFAULT);
    device.setStencilState(null, null);
  }
  restoreRenderState(device) {
    if (device.webgl2 || device.isWebGPU) {
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
  getShadowPass(light) {
    var _this$shadowPassCache;
    // get shader pass from cache for this light type and shadow type
    const lightType = light._type;
    const shadowType = light._shadowType;
    let shadowPassInfo = (_this$shadowPassCache = this.shadowPassCache[lightType]) == null ? void 0 : _this$shadowPassCache[shadowType];
    if (!shadowPassInfo) {
      // new shader pass if not in cache
      const shadowPassName = `ShadowPass_${lightType}_${shadowType}`;
      shadowPassInfo = ShaderPass.get(this.device).allocate(shadowPassName, {
        isShadow: true,
        lightType: lightType,
        shadowType: shadowType
      });

      // add it to the cache
      if (!this.shadowPassCache[lightType]) this.shadowPassCache[lightType] = [];
      this.shadowPassCache[lightType][shadowType] = shadowPassInfo;
    }
    return shadowPassInfo.index;
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
    const shadowPass = this.getShadowPass(light);

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
      this.renderVsm(light, camera);
    }
  }
  renderVsm(light, camera) {
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
    device.setBlendState(BlendState.NOBLEND);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBTSEFERVJTVEFHRV9GUkFHTUVOVCwgU0hBREVSU1RBR0VfVkVSVEVYLCBVTklGT1JNVFlQRV9NQVQ0LCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSxcbiAgICBTSEFERVJfU0hBRE9XLFxuICAgIFNIQURPV19QQ0YxLCBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMzIsXG4gICAgU0hBRE9XVVBEQVRFX05PTkUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgU09SVEtFWV9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3NoYWRlci1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyRm9ybWF0LCBVbmlmb3JtRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRCdWZmZXJGb3JtYXQsIEJpbmRHcm91cEZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyc7XG5pbXBvcnQgeyBEZXB0aFN0YXRlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVwdGgtc3RhdGUuanMnO1xuXG5mdW5jdGlvbiBnYXVzcyh4LCBzaWdtYSkge1xuICAgIHJldHVybiBNYXRoLmV4cCgtKHggKiB4KSAvICgyLjAgKiBzaWdtYSAqIHNpZ21hKSk7XG59XG5cbmZ1bmN0aW9uIGdhdXNzV2VpZ2h0cyhrZXJuZWxTaXplKSB7XG4gICAgY29uc3Qgc2lnbWEgPSAoa2VybmVsU2l6ZSAtIDEpIC8gKDIgKiAzKTtcblxuICAgIGNvbnN0IGhhbGZXaWR0aCA9IChrZXJuZWxTaXplIC0gMSkgKiAwLjU7XG4gICAgY29uc3QgdmFsdWVzID0gbmV3IEFycmF5KGtlcm5lbFNpemUpO1xuICAgIGxldCBzdW0gPSAwLjA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXJuZWxTaXplOyArK2kpIHtcbiAgICAgICAgdmFsdWVzW2ldID0gZ2F1c3MoaSAtIGhhbGZXaWR0aCwgc2lnbWEpO1xuICAgICAgICBzdW0gKz0gdmFsdWVzW2ldO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2VybmVsU2l6ZTsgKytpKSB7XG4gICAgICAgIHZhbHVlc1tpXSAvPSBzdW07XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG59XG5cbmNvbnN0IHNoYWRvd0NhbVZpZXcgPSBuZXcgTWF0NCgpO1xuY29uc3Qgc2hhZG93Q2FtVmlld1Byb2ogPSBuZXcgTWF0NCgpO1xuY29uc3QgcGl4ZWxPZmZzZXQgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuY29uc3QgYmx1clNjaXNzb3JSZWN0ID0gbmV3IFZlYzQoMSwgMSwgMCwgMCk7XG5jb25zdCBvcENoYW5JZCA9IHsgcjogMSwgZzogMiwgYjogMywgYTogNCB9O1xuY29uc3Qgdmlld3BvcnRNYXRyaXggPSBuZXcgTWF0NCgpO1xuXG5mdW5jdGlvbiBnZXREZXB0aEtleShtZXNoSW5zdGFuY2UpIHtcbiAgICBjb25zdCBtYXRlcmlhbCA9IG1lc2hJbnN0YW5jZS5tYXRlcmlhbDtcbiAgICBjb25zdCB4ID0gbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA/IDEwIDogMDtcbiAgICBsZXQgeSA9IDA7XG4gICAgaWYgKG1hdGVyaWFsLm9wYWNpdHlNYXApIHtcbiAgICAgICAgY29uc3Qgb3BDaGFuID0gbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWw7XG4gICAgICAgIGlmIChvcENoYW4pIHtcbiAgICAgICAgICAgIHkgPSBvcENoYW5JZFtvcENoYW5dO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB4ICsgeTtcbn1cblxuLyoqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFNoYWRvd1JlbmRlcmVyIHtcbiAgICAvKipcbiAgICAgKiBBIGNhY2hlIG9mIHNoYWRvdyBwYXNzZXMuIEZpcnN0IGluZGV4IGlzIGxvb2tlZCB1cCBieSBsaWdodCB0eXBlLCBzZWNvbmQgYnkgc2hhZG93IHR5cGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zaGFkZXItcGFzcy5qcycpLlNoYWRlclBhc3NJbmZvW11bXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNoYWRvd1Bhc3NDYWNoZSA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmVuZGVyZXIuanMnKS5SZW5kZXJlcn0gcmVuZGVyZXIgLSBUaGUgcmVuZGVyZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gbGlnaHRUZXh0dXJlQXRsYXMgLSBUaGVcbiAgICAgKiBzaGFkb3cgbWFwIGF0bGFzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHJlbmRlcmVyLCBsaWdodFRleHR1cmVBdGxhcykge1xuICAgICAgICB0aGlzLmRldmljZSA9IHJlbmRlcmVyLmRldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXJlci5qcycpLlJlbmRlcmVyfSAqL1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gcmVuZGVyZXI7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnKS5MaWdodFRleHR1cmVBdGxhc30gKi9cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IGxpZ2h0VGV4dHVyZUF0bGFzO1xuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0SWQgPSBzY29wZS5yZXNvbHZlKCdwb2x5Z29uT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMucG9seWdvbk9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgLy8gVlNNXG4gICAgICAgIHRoaXMuc291cmNlSWQgPSBzY29wZS5yZXNvbHZlKCdzb3VyY2UnKTtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkID0gc2NvcGUucmVzb2x2ZSgncGl4ZWxPZmZzZXQnKTtcbiAgICAgICAgdGhpcy53ZWlnaHRJZCA9IHNjb3BlLnJlc29sdmUoJ3dlaWdodFswXScpO1xuICAgICAgICB0aGlzLmJsdXJWc21TaGFkZXJDb2RlID0gW3NoYWRlckNodW5rcy5ibHVyVlNNUFMsICcjZGVmaW5lIEdBVVNTXFxuJyArIHNoYWRlckNodW5rcy5ibHVyVlNNUFNdO1xuICAgICAgICBjb25zdCBwYWNrZWQgPSAnI2RlZmluZSBQQUNLRURcXG4nO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlID0gW3BhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMF0sIHBhY2tlZCArIHRoaXMuYmx1clZzbVNoYWRlckNvZGVbMV1dO1xuXG4gICAgICAgIC8vIGNhY2hlIGZvciB2c20gYmx1ciBzaGFkZXJzXG4gICAgICAgIHRoaXMuYmx1clZzbVNoYWRlciA9IFt7fSwge31dO1xuICAgICAgICB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXIgPSBbe30sIHt9XTtcblxuICAgICAgICB0aGlzLmJsdXJWc21XZWlnaHRzID0ge307XG5cbiAgICAgICAgLy8gdW5pZm9ybXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBMaWdodFJhZGl1c0lkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfcmFkaXVzJyk7XG5cbiAgICAgICAgLy8gdmlldyBiaW5kIGdyb3VwIGZvcm1hdCB3aXRoIGl0cyB1bmlmb3JtIGJ1ZmZlciBmb3JtYXRcbiAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG51bGw7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG51bGw7XG5cbiAgICAgICAgLy8gYmxlbmQgc3RhdGVzXG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZVdyaXRlID0gbmV3IEJsZW5kU3RhdGUoKTtcbiAgICAgICAgdGhpcy5ibGVuZFN0YXRlTm9Xcml0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZU5vV3JpdGUuc2V0Q29sb3JXcml0ZShmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlcyBzaGFkb3cgY2FtZXJhIGZvciBhIGxpZ2h0IGFuZCBzZXRzIHVwIGl0cyBjb25zdGFudCBwcm9wZXJ0aWVzXG4gICAgc3RhdGljIGNyZWF0ZVNoYWRvd0NhbWVyYShkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGZhY2UpIHtcblxuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBMaWdodENhbWVyYS5jcmVhdGUoJ1NoYWRvd0NhbWVyYScsIHR5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIGRvbid0IGNsZWFyIHRoZSBjb2xvciBidWZmZXIgaWYgcmVuZGVyaW5nIGEgZGVwdGggbWFwXG4gICAgICAgIGlmIChzaGFkb3dUeXBlID49IFNIQURPV19WU004ICYmIHNoYWRvd1R5cGUgPD0gU0hBRE9XX1ZTTTMyKSB7XG4gICAgICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hhZG93Q2FtLmNsZWFyRGVwdGhCdWZmZXIgPSB0cnVlO1xuICAgICAgICBzaGFkb3dDYW0uY2xlYXJTdGVuY2lsQnVmZmVyID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICBzdGF0aWMgc2V0U2hhZG93Q2FtZXJhU2V0dGluZ3Moc2hhZG93Q2FtLCBkZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKSB7XG5cbiAgICAgICAgLy8gbm9ybWFsIG9tbmkgc2hhZG93cyBvbiB3ZWJnbDIgZW5jb2RlIGRlcHRoIGluIFJHQkE4IGFuZCBkbyBtYW51YWwgUENGIHNhbXBsaW5nXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBvbW5pIHNoYWRvd3Mgb24gd2ViZ2wyIHVzZSBkZXB0aCBmb3JtYXQgYW5kIGhhcmR3YXJlIFBDRiBzYW1wbGluZ1xuICAgICAgICBsZXQgaHdQY2YgPSBzaGFkb3dUeXBlID09PSBTSEFET1dfUENGNSB8fCAoKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YxIHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzKSAmJiBkZXZpY2Uuc3VwcG9ydHNEZXB0aFNoYWRvdyk7XG4gICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgIGh3UGNmID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvckJ1ZmZlciA9ICFod1BjZjtcbiAgICB9XG5cbiAgICAvLyBjdWxscyB0aGUgbGlzdCBvZiBtZXNoZXMgaW5zdGFuY2VzIGJ5IHRoZSBjYW1lcmEsIHN0b3JpbmcgdmlzaWJsZSBtZXNoIGluc3RhbmNlcyBpbiB0aGUgc3BlY2lmaWVkIGFycmF5XG4gICAgY3VsbFNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcywgdmlzaWJsZSwgY2FtZXJhKSB7XG5cbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbnVtSW5zdGFuY2VzID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSW5zdGFuY2VzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2UuY2FzdFNoYWRvdykge1xuICAgICAgICAgICAgICAgIGlmICghbWVzaEluc3RhbmNlLmN1bGwgfHwgbWVzaEluc3RhbmNlLl9pc1Zpc2libGUoY2FtZXJhKSkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVbY291bnRdID0gbWVzaEluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZpc2libGUubGVuZ3RoID0gY291bnQ7XG5cbiAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIHByb2JhYmx5IHNvcnQgc2hhZG93IG1lc2hlcyBieSBzaGFkZXIgYW5kIG5vdCBkZXB0aFxuICAgICAgICB2aXNpYmxlLnNvcnQodGhpcy5yZW5kZXJlci5zb3J0Q29tcGFyZURlcHRoKTtcbiAgICB9XG5cbiAgICBzZXR1cFJlbmRlclN0YXRlKGRldmljZSwgbGlnaHQpIHtcblxuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIGRlcHRoIGJpYXNcbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKHRydWUpO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXNWYWx1ZXMobGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjAsIGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZC5zZXRWYWx1ZSh0aGlzLnBvbHlnb25PZmZzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZC5zZXRWYWx1ZSh0aGlzLnBvbHlnb25PZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHN0YW5kYXJkIHNoYWRvd21hcCBzdGF0ZXNcbiAgICAgICAgY29uc3QgZ3B1T3JHbDIgPSBkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5pc1dlYkdQVTtcbiAgICAgICAgY29uc3QgdXNlU2hhZG93U2FtcGxlciA9IGlzQ2x1c3RlcmVkID9cbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBncHVPckdsMiA6ICAgICAvLyBib3RoIHNwb3QgYW5kIG9tbmkgbGlnaHQgYXJlIHVzaW5nIHNoYWRvdyBzYW1wbGVyIG9uIHdlYmdsMiB3aGVuIGNsdXN0ZXJlZFxuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGdwdU9yR2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuXG4gICAgICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKHVzZVNoYWRvd1NhbXBsZXIgPyB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlIDogdGhpcy5ibGVuZFN0YXRlV3JpdGUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLkRFRkFVTFQpO1xuICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFN0YXRlKG51bGwsIG51bGwpO1xuICAgIH1cblxuICAgIHJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpIHtcblxuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMiB8fCBkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG5cbiAgICAgICAgLy8gcG9zaXRpb24gLyByYW5nZVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5kaXNwYXRjaFZpZXdQb3Moc2hhZG93Q2FtTm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZC5zZXRWYWx1ZShsaWdodC5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2aWV3LXByb2plY3Rpb24gc2hhZG93IG1hdHJpeFxuICAgICAgICBzaGFkb3dDYW1WaWV3LnNldFRSUyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCksIHNoYWRvd0NhbU5vZGUuZ2V0Um90YXRpb24oKSwgVmVjMy5PTkUpLmludmVydCgpO1xuICAgICAgICBzaGFkb3dDYW1WaWV3UHJvai5tdWwyKHNoYWRvd0NhbS5wcm9qZWN0aW9uTWF0cml4LCBzaGFkb3dDYW1WaWV3KTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBoYW5kbGluZ1xuICAgICAgICBjb25zdCByZWN0Vmlld3BvcnQgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5yZWN0ID0gcmVjdFZpZXdwb3J0O1xuICAgICAgICBzaGFkb3dDYW0uc2Npc3NvclJlY3QgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93U2Npc3NvcjtcblxuICAgICAgICB2aWV3cG9ydE1hdHJpeC5zZXRWaWV3cG9ydChyZWN0Vmlld3BvcnQueCwgcmVjdFZpZXdwb3J0LnksIHJlY3RWaWV3cG9ydC56LCByZWN0Vmlld3BvcnQudyk7XG4gICAgICAgIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXgubXVsMih2aWV3cG9ydE1hdHJpeCwgc2hhZG93Q2FtVmlld1Byb2opO1xuXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAvLyBjb3B5IG1hdHJpeCB0byBzaGFkb3cgY2FzY2FkZSBwYWxldHRlXG4gICAgICAgICAgICBsaWdodC5fc2hhZG93TWF0cml4UGFsZXR0ZS5zZXQobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhLCBmYWNlICogMTYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0U2hhZG93UGFzcyhsaWdodCkge1xuXG4gICAgICAgIC8vIGdldCBzaGFkZXIgcGFzcyBmcm9tIGNhY2hlIGZvciB0aGlzIGxpZ2h0IHR5cGUgYW5kIHNoYWRvdyB0eXBlXG4gICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gbGlnaHQuX3NoYWRvd1R5cGU7XG4gICAgICAgIGxldCBzaGFkb3dQYXNzSW5mbyA9IHRoaXMuc2hhZG93UGFzc0NhY2hlW2xpZ2h0VHlwZV0/LltzaGFkb3dUeXBlXTtcbiAgICAgICAgaWYgKCFzaGFkb3dQYXNzSW5mbykge1xuXG4gICAgICAgICAgICAvLyBuZXcgc2hhZGVyIHBhc3MgaWYgbm90IGluIGNhY2hlXG4gICAgICAgICAgICBjb25zdCBzaGFkb3dQYXNzTmFtZSA9IGBTaGFkb3dQYXNzXyR7bGlnaHRUeXBlfV8ke3NoYWRvd1R5cGV9YDtcbiAgICAgICAgICAgIHNoYWRvd1Bhc3NJbmZvID0gU2hhZGVyUGFzcy5nZXQodGhpcy5kZXZpY2UpLmFsbG9jYXRlKHNoYWRvd1Bhc3NOYW1lLCB7XG4gICAgICAgICAgICAgICAgaXNTaGFkb3c6IHRydWUsXG4gICAgICAgICAgICAgICAgbGlnaHRUeXBlOiBsaWdodFR5cGUsXG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZTogc2hhZG93VHlwZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byB0aGUgY2FjaGVcbiAgICAgICAgICAgIGlmICghdGhpcy5zaGFkb3dQYXNzQ2FjaGVbbGlnaHRUeXBlXSlcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd1Bhc3NDYWNoZVtsaWdodFR5cGVdID0gW107XG4gICAgICAgICAgICB0aGlzLnNoYWRvd1Bhc3NDYWNoZVtsaWdodFR5cGVdW3NoYWRvd1R5cGVdID0gc2hhZG93UGFzc0luZm87XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhZG93UGFzc0luZm8uaW5kZXg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gdmlzaWJsZUNhc3RlcnMgLSBWaXNpYmxlIG1lc2hcbiAgICAgKiBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IGxpZ2h0IC0gVGhlIGxpZ2h0LlxuICAgICAqL1xuICAgIHN1Ym1pdENhc3RlcnModmlzaWJsZUNhc3RlcnMsIGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSByZW5kZXJlci5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWdzID0gMSA8PCBTSEFERVJfU0hBRE9XO1xuICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gdGhpcy5nZXRTaGFkb3dQYXNzKGxpZ2h0KTtcblxuICAgICAgICAvLyBUT0RPOiBTaW1pbGFybHkgdG8gZm9yd2FyZCByZW5kZXJlciwgYSBzaGFkZXIgY3JlYXRpb24gcGFydCBvZiB0aGlzIGxvb3Agc2hvdWxkIGJlIHNwbGl0IGludG8gYSBzZXBhcmF0ZSBsb29wLFxuICAgICAgICAvLyBhbmQgZW5kU2hhZGVyQmF0Y2ggc2hvdWxkIGJlIGNhbGxlZCBhdCBpdHMgZW5kXG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwQ3VsbE1vZGUodHJ1ZSwgMSwgbWVzaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIEkgKHNoYWRvdyk6IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUkgKHNoYWRvdyk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFncyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBzaGFkZXJcbiAgICAgICAgICAgIGxldCBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgIGlmICghc2hhZG93U2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHNoYWRvd1Bhc3MsIG51bGwsIG51bGwsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgc2hhZG93U2hhZGVyID0gbWVzaEluc3RhbmNlLl9zaGFkZXJbc2hhZG93UGFzc107XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9rZXlbU09SVEtFWV9ERVBUSF0gPSBnZXREZXB0aEtleShtZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIuZmFpbGVkICYmICFkZXZpY2Uuc2V0U2hhZGVyKHNoYWRvd1NoYWRlcikpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRvdyBzaGFkZXIgZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3NoYWRvd1Bhc3N9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgYnVmZmVyc1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0TW9ycGhpbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMobWVzaEluc3RhbmNlLCBzaGFkb3dQYXNzKTtcblxuICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBtZXNoSW5zdGFuY2UucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0SW5kZXhCdWZmZXIobWVzaC5pbmRleEJ1ZmZlcltzdHlsZV0pO1xuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICByZW5kZXJlci5kcmF3SW5zdGFuY2UoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgIHJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHMrKztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5lZWRzU2hhZG93UmVuZGVyaW5nKGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbmVlZHMgPSBsaWdodC5lbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWU7XG5cbiAgICAgICAgaWYgKGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPT09IFNIQURPV1VQREFURV9USElTRlJBTUUpIHtcbiAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfTk9ORTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZWVkcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyArPSBsaWdodC5udW1TaGFkb3dGYWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZWVkcztcbiAgICB9XG5cbiAgICBnZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGFyZSBwZXIgY2FtZXJhLCBzbyBnZXQgYXBwcm9wcmlhdGUgcmVuZGVyIGRhdGFcbiAgICAgICAgcmV0dXJuIGxpZ2h0LmdldFJlbmRlckRhdGEobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IGNhbWVyYSA6IG51bGwsIGZhY2UpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyUGFzcyhyZW5kZXJQYXNzLCBzaGFkb3dDYW1lcmEsIGNsZWFyUmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgY29uc3QgcnQgPSBzaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICByZW5kZXJQYXNzLmluaXQocnQpO1xuXG4gICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZSA9IDE7XG4gICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggPSBjbGVhclJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyBpZiByZW5kZXJpbmcgdG8gZGVwdGggYnVmZmVyXG4gICAgICAgIGlmIChydC5kZXB0aEJ1ZmZlcikge1xuXG4gICAgICAgICAgICByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoID0gdHJ1ZTtcblxuICAgICAgICB9IGVsc2UgeyAvLyByZW5kZXJpbmcgdG8gY29sb3IgYnVmZmVyXG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXJWYWx1ZS5jb3B5KHNoYWRvd0NhbWVyYS5jbGVhckNvbG9yKTtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXIgPSBjbGVhclJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdCBzYW1wbGluZyBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY3ViZW1hcHNcbiAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgcmVuZGVyIHRhcmdldCAvIHJlbmRlciB0YXJnZXQgc2V0dGluZ3MgdG8gYWxsb3cgcmVuZGVyIHBhc3MgdG8gYmUgc2V0IHVwXG4gICAgcHJlcGFyZUZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHR5cGUgPSBsaWdodC5fdHlwZTtcbiAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IGxpZ2h0Ll9zaGFkb3dUeXBlO1xuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHRoaXMuZ2V0TGlnaHRSZW5kZXJEYXRhKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgIC8vIGNhbWVyYSBjbGVhciBzZXR0aW5nXG4gICAgICAgIC8vIE5vdGU6IHdoZW4gY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIHRoZSBvbmx5IGxpZ2h0aW5nIHR5cGUsIHRoaXMgY29kZSBjYW4gYmUgbW92ZWQgdG8gY3JlYXRlU2hhZG93Q2FtZXJhIGZ1bmN0aW9uXG4gICAgICAgIFNoYWRvd1JlbmRlcmVyLnNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgdGhpcy5kZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKTtcblxuICAgICAgICAvLyBhc3NpZ24gcmVuZGVyIHRhcmdldCBmb3IgdGhlIGZhY2VcbiAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0SW5kZXggPSB0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyAwIDogZmFjZTtcbiAgICAgICAgc2hhZG93Q2FtLnJlbmRlclRhcmdldCA9IGxpZ2h0Ll9zaGFkb3dNYXAucmVuZGVyVGFyZ2V0c1tyZW5kZXJUYXJnZXRJbmRleF07XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICByZW5kZXJGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UsIGNsZWFyLCBpbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2hhZG93TWFwU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBTSEFET1cgJHtsaWdodC5fbm9kZS5uYW1lfSBGQUNFICR7ZmFjZX1gKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSB0aGlzLmdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICB0aGlzLmRpc3BhdGNoVW5pZm9ybXMobGlnaHQsIHNoYWRvd0NhbSwgbGlnaHRSZW5kZXJEYXRhLCBmYWNlKTtcblxuICAgICAgICBjb25zdCBydCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgcmVuZGVyZXIuc2V0Q2FtZXJhVW5pZm9ybXMoc2hhZG93Q2FtLCBydCk7XG4gICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycykge1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMobGlnaHRSZW5kZXJEYXRhLnZpZXdCaW5kR3JvdXBzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluc2lkZVJlbmRlclBhc3MpIHtcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwVmlld3BvcnQoc2hhZG93Q2FtLCBydCk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGhlcmUgaXMgdXNlZCB0byBjbGVhciBhIHZpZXdwb3J0IGluc2lkZSByZW5kZXIgdGFyZ2V0LlxuICAgICAgICAgICAgaWYgKGNsZWFyKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXIuY2xlYXIoc2hhZG93Q2FtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gdGhpcyBpcyBvbmx5IHVzZWQgYnkgbGlnaHRtYXBwZXIsIHRpbGwgaXQncyBjb252ZXJ0ZWQgdG8gcmVuZGVyIHBhc3Nlc1xuICAgICAgICAgICAgcmVuZGVyZXIuY2xlYXJWaWV3KHNoYWRvd0NhbSwgcnQsIHRydWUsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KTtcblxuICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5zdWJtaXRDYXN0ZXJzKGxpZ2h0UmVuZGVyRGF0YS52aXNpYmxlQ2FzdGVycywgbGlnaHQpO1xuXG4gICAgICAgIHRoaXMucmVzdG9yZVJlbmRlclN0YXRlKGRldmljZSk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lICs9IG5vdygpIC0gc2hhZG93TWFwU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSwgaW5zaWRlUmVuZGVyUGFzcyA9IHRydWUpIHtcblxuICAgICAgICBpZiAodGhpcy5uZWVkc1NoYWRvd1JlbmRlcmluZyhsaWdodCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZhY2VDb3VudCA9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgZmFjZXNcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlLCB0cnVlLCBpbnNpZGVSZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXBwbHkgdnNtXG4gICAgICAgICAgICB0aGlzLnJlbmRlclZzbShsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlclZzbShsaWdodCwgY2FtZXJhKSB7XG5cbiAgICAgICAgLy8gVlNNIGJsdXIgaWYgbGlnaHQgc3VwcG9ydHMgdnNtIChkaXJlY3Rpb25hbCBhbmQgc3BvdCBpbiBnZW5lcmFsKVxuICAgICAgICBpZiAobGlnaHQuX2lzVnNtICYmIGxpZ2h0Ll92c21CbHVyU2l6ZSA+IDEpIHtcblxuICAgICAgICAgICAgLy8gaW4gY2x1c3RlcmVkIG1vZGUsIG9ubHkgZGlyZWN0aW9uYWwgbGlnaHQgY2FuIGJlIHZtc1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgIGlmICghaXNDbHVzdGVyZWQgfHwgbGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgVlNNICR7bGlnaHQuX25vZGUubmFtZX1gKTtcblxuICAgICAgICAvLyByZW5kZXIgc3RhdGVcbiAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCAwKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcbiAgICAgICAgY29uc3Qgb3JpZ1NoYWRvd01hcCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgZm9yIGJsdXJyaW5nXG4gICAgICAgIC8vIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG9wdGltYWwgYW5kIHNoYWRvdyBtYXAgY291bGQgaGF2ZSBkZXB0aCBidWZmZXIgb24gaW4gYWRkaXRpb24gdG8gY29sb3IgYnVmZmVyLFxuICAgICAgICAvLyBhbmQgZm9yIGJsdXJyaW5nIG9ubHkgb25lIGJ1ZmZlciBpcyBuZWVkZWQuXG4gICAgICAgIGNvbnN0IHRlbXBTaGFkb3dNYXAgPSB0aGlzLnJlbmRlcmVyLnNoYWRvd01hcENhY2hlLmdldChkZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgY29uc3QgdGVtcFJ0ID0gdGVtcFNoYWRvd01hcC5yZW5kZXJUYXJnZXRzWzBdO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtOCA9IGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNODtcbiAgICAgICAgY29uc3QgYmx1ck1vZGUgPSBsaWdodC52c21CbHVyTW9kZTtcbiAgICAgICAgY29uc3QgZmlsdGVyU2l6ZSA9IGxpZ2h0Ll92c21CbHVyU2l6ZTtcbiAgICAgICAgY29uc3QgYmx1clNoYWRlciA9IHRoaXMuZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKTtcblxuICAgICAgICBibHVyU2Npc3NvclJlY3QueiA9IGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uIC0gMjtcbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LncgPSBibHVyU2Npc3NvclJlY3QuejtcblxuICAgICAgICAvLyBCbHVyIGhvcml6b250YWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZShvcmlnU2hhZG93TWFwLmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAxIC8gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgaWYgKGJsdXJNb2RlID09PSBCTFVSX0dBVVNTSUFOKSB0aGlzLndlaWdodElkLnNldFZhbHVlKHRoaXMuYmx1clZzbVdlaWdodHNbZmlsdGVyU2l6ZV0pO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUnQsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gQmx1ciB2ZXJ0aWNhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKHRlbXBSdC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gcGl4ZWxPZmZzZXRbMF07XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgb3JpZ1NoYWRvd01hcCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIHRlbXBvcmFyeSBzaGFkb3cgbWFwIGJhY2sgdG8gdGhlIGNhY2hlXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuYWRkKGxpZ2h0LCB0ZW1wU2hhZG93TWFwKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIG5vIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZG93UmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJnYXVzcyIsIngiLCJzaWdtYSIsIk1hdGgiLCJleHAiLCJnYXVzc1dlaWdodHMiLCJrZXJuZWxTaXplIiwiaGFsZldpZHRoIiwidmFsdWVzIiwiQXJyYXkiLCJzdW0iLCJpIiwic2hhZG93Q2FtVmlldyIsIk1hdDQiLCJzaGFkb3dDYW1WaWV3UHJvaiIsInBpeGVsT2Zmc2V0IiwiRmxvYXQzMkFycmF5IiwiYmx1clNjaXNzb3JSZWN0IiwiVmVjNCIsIm9wQ2hhbklkIiwiciIsImciLCJiIiwiYSIsInZpZXdwb3J0TWF0cml4IiwiZ2V0RGVwdGhLZXkiLCJtZXNoSW5zdGFuY2UiLCJtYXRlcmlhbCIsInNraW5JbnN0YW5jZSIsInkiLCJvcGFjaXR5TWFwIiwib3BDaGFuIiwib3BhY2l0eU1hcENoYW5uZWwiLCJTaGFkb3dSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwicmVuZGVyZXIiLCJsaWdodFRleHR1cmVBdGxhcyIsInNoYWRvd1Bhc3NDYWNoZSIsImRldmljZSIsInNjb3BlIiwicG9seWdvbk9mZnNldElkIiwicmVzb2x2ZSIsInBvbHlnb25PZmZzZXQiLCJzb3VyY2VJZCIsInBpeGVsT2Zmc2V0SWQiLCJ3ZWlnaHRJZCIsImJsdXJWc21TaGFkZXJDb2RlIiwic2hhZGVyQ2h1bmtzIiwiYmx1clZTTVBTIiwicGFja2VkIiwiYmx1clBhY2tlZFZzbVNoYWRlckNvZGUiLCJibHVyVnNtU2hhZGVyIiwiYmx1clBhY2tlZFZzbVNoYWRlciIsImJsdXJWc21XZWlnaHRzIiwic2hhZG93TWFwTGlnaHRSYWRpdXNJZCIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsImJsZW5kU3RhdGVXcml0ZSIsIkJsZW5kU3RhdGUiLCJibGVuZFN0YXRlTm9Xcml0ZSIsInNldENvbG9yV3JpdGUiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJzaGFkb3dUeXBlIiwidHlwZSIsImZhY2UiLCJzaGFkb3dDYW0iLCJMaWdodENhbWVyYSIsImNyZWF0ZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTMyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInNldFNoYWRvd0NhbWVyYVNldHRpbmdzIiwiaXNDbHVzdGVyZWQiLCJod1BjZiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjEiLCJTSEFET1dfUENGMyIsInN1cHBvcnRzRGVwdGhTaGFkb3ciLCJMSUdIVFRZUEVfT01OSSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjdWxsU2hhZG93Q2FzdGVycyIsIm1lc2hJbnN0YW5jZXMiLCJ2aXNpYmxlIiwiY2FtZXJhIiwiY291bnQiLCJudW1JbnN0YW5jZXMiLCJsZW5ndGgiLCJjYXN0U2hhZG93IiwiY3VsbCIsIl9pc1Zpc2libGUiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwic29ydCIsInNvcnRDb21wYXJlRGVwdGgiLCJzZXR1cFJlbmRlclN0YXRlIiwibGlnaHQiLCJzY2VuZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsIndlYmdsMiIsImlzV2ViR1BVIiwiX3R5cGUiLCJzZXREZXB0aEJpYXMiLCJzZXREZXB0aEJpYXNWYWx1ZXMiLCJzaGFkb3dCaWFzIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsInNldFZhbHVlIiwiZ3B1T3JHbDIiLCJ1c2VTaGFkb3dTYW1wbGVyIiwiX2lzUGNmIiwic2V0QmxlbmRTdGF0ZSIsInNldERlcHRoU3RhdGUiLCJEZXB0aFN0YXRlIiwiREVGQVVMVCIsInNldFN0ZW5jaWxTdGF0ZSIsInJlc3RvcmVSZW5kZXJTdGF0ZSIsImRpc3BhdGNoVW5pZm9ybXMiLCJsaWdodFJlbmRlckRhdGEiLCJzaGFkb3dDYW1Ob2RlIiwiX25vZGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJkaXNwYXRjaFZpZXdQb3MiLCJnZXRQb3NpdGlvbiIsImF0dGVudWF0aW9uRW5kIiwic2V0VFJTIiwiZ2V0Um90YXRpb24iLCJWZWMzIiwiT05FIiwiaW52ZXJ0IiwibXVsMiIsInByb2plY3Rpb25NYXRyaXgiLCJyZWN0Vmlld3BvcnQiLCJzaGFkb3dWaWV3cG9ydCIsInJlY3QiLCJzY2lzc29yUmVjdCIsInNoYWRvd1NjaXNzb3IiLCJzZXRWaWV3cG9ydCIsInoiLCJ3Iiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJzZXQiLCJkYXRhIiwiZ2V0U2hhZG93UGFzcyIsIl90aGlzJHNoYWRvd1Bhc3NDYWNoZSIsImxpZ2h0VHlwZSIsIl9zaGFkb3dUeXBlIiwic2hhZG93UGFzc0luZm8iLCJzaGFkb3dQYXNzTmFtZSIsIlNoYWRlclBhc3MiLCJnZXQiLCJhbGxvY2F0ZSIsImlzU2hhZG93IiwiaW5kZXgiLCJzdWJtaXRDYXN0ZXJzIiwidmlzaWJsZUNhc3RlcnMiLCJwYXNzRmxhZ3MiLCJTSEFERVJfU0hBRE9XIiwic2hhZG93UGFzcyIsIm1lc2giLCJlbnN1cmVNYXRlcmlhbCIsInNldEJhc2VDb25zdGFudHMiLCJzZXRTa2lubmluZyIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJjaHVua3MiLCJzZXR1cEN1bGxNb2RlIiwic2V0UGFyYW1ldGVycyIsInNoYWRvd1NoYWRlciIsIl9zaGFkZXIiLCJ1cGRhdGVQYXNzU2hhZGVyIiwiX2tleSIsIlNPUlRLRVlfREVQVEgiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJEZWJ1ZyIsImVycm9yIiwibmFtZSIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRNb3JwaGluZyIsIm1vcnBoSW5zdGFuY2UiLCJzZXR1cE1lc2hVbmlmb3JtQnVmZmVycyIsInN0eWxlIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwiZHJhd0luc3RhbmNlIiwiX3NoYWRvd0RyYXdDYWxscyIsIm5lZWRzU2hhZG93UmVuZGVyaW5nIiwibmVlZHMiLCJlbmFibGVkIiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJudW1TaGFkb3dGYWNlcyIsImdldExpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzZXR1cFJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwic2hhZG93Q2FtZXJhIiwiY2xlYXJSZW5kZXJUYXJnZXQiLCJydCIsInJlbmRlclRhcmdldCIsImluaXQiLCJkZXB0aFN0ZW5jaWxPcHMiLCJjbGVhckRlcHRoVmFsdWUiLCJjbGVhckRlcHRoIiwiZGVwdGhCdWZmZXIiLCJzdG9yZURlcHRoIiwiY29sb3JPcHMiLCJjbGVhclZhbHVlIiwiY29weSIsImNsZWFyIiwicmVxdWlyZXNDdWJlbWFwcyIsInByZXBhcmVGYWNlIiwicmVuZGVyVGFyZ2V0SW5kZXgiLCJfc2hhZG93TWFwIiwicmVuZGVyVGFyZ2V0cyIsInJlbmRlckZhY2UiLCJpbnNpZGVSZW5kZXJQYXNzIiwic2hhZG93TWFwU3RhcnRUaW1lIiwibm93IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzZXRDYW1lcmFVbmlmb3JtcyIsInN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwic2V0dXBWaWV3cG9ydCIsImNsZWFyVmlldyIsInBvcEdwdU1hcmtlciIsIl9zaGFkb3dNYXBUaW1lIiwicmVuZGVyIiwiZmFjZUNvdW50IiwicmVuZGVyVnNtIiwiX2lzVnNtIiwiX3ZzbUJsdXJTaXplIiwiYXBwbHlWc21CbHVyIiwiZ2V0VnNtQmx1clNoYWRlciIsImlzVnNtOCIsImJsdXJNb2RlIiwiZmlsdGVyU2l6ZSIsImJsdXJTaGFkZXIiLCJibHVyVlMiLCJmdWxsc2NyZWVuUXVhZFZTIiwiYmx1ckZTIiwiYmx1clNoYWRlck5hbWUiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsIk5PQkxFTkQiLCJvcmlnU2hhZG93TWFwIiwidGVtcFNoYWRvd01hcCIsInNoYWRvd01hcENhY2hlIiwidGVtcFJ0IiwidnNtQmx1ck1vZGUiLCJfc2hhZG93UmVzb2x1dGlvbiIsImNvbG9yQnVmZmVyIiwiQkxVUl9HQVVTU0lBTiIsImRyYXdRdWFkV2l0aFNoYWRlciIsImFkZCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0IiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJmcmFtZVVwZGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTRCQSxTQUFTQSxLQUFLQSxDQUFDQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtBQUNyQixFQUFBLE9BQU9DLElBQUksQ0FBQ0MsR0FBRyxDQUFDLEVBQUVILENBQUMsR0FBR0EsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHQyxLQUFLLEdBQUdBLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDckQsQ0FBQTtBQUVBLFNBQVNHLFlBQVlBLENBQUNDLFVBQVUsRUFBRTtFQUM5QixNQUFNSixLQUFLLEdBQUcsQ0FBQ0ksVUFBVSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFeEMsRUFBQSxNQUFNQyxTQUFTLEdBQUcsQ0FBQ0QsVUFBVSxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUE7QUFDeEMsRUFBQSxNQUFNRSxNQUFNLEdBQUcsSUFBSUMsS0FBSyxDQUFDSCxVQUFVLENBQUMsQ0FBQTtFQUNwQyxJQUFJSSxHQUFHLEdBQUcsR0FBRyxDQUFBO0VBQ2IsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdMLFVBQVUsRUFBRSxFQUFFSyxDQUFDLEVBQUU7SUFDakNILE1BQU0sQ0FBQ0csQ0FBQyxDQUFDLEdBQUdYLEtBQUssQ0FBQ1csQ0FBQyxHQUFHSixTQUFTLEVBQUVMLEtBQUssQ0FBQyxDQUFBO0FBQ3ZDUSxJQUFBQSxHQUFHLElBQUlGLE1BQU0sQ0FBQ0csQ0FBQyxDQUFDLENBQUE7QUFDcEIsR0FBQTtFQUVB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
