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
   * A cache of shadow passes. First index is looked up by light type, second by shadow type.
   *
   * @type {import('../shader-pass.js').ShaderPassInfo[][]}
   * @private
   */

  /**
   * @param {import('./renderer.js').Renderer} renderer - The renderer.
   * @param {import('../lighting/light-texture-atlas.js').LightTextureAtlas} lightTextureAtlas - The
   * shadow map atlas.
   */
  constructor(renderer, lightTextureAtlas) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93LXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBTSEFERVJTVEFHRV9GUkFHTUVOVCwgU0hBREVSU1RBR0VfVkVSVEVYLCBVTklGT1JNVFlQRV9NQVQ0LCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSxcbiAgICBTSEFERVJfU0hBRE9XLFxuICAgIFNIQURPV19QQ0YzLCBTSEFET1dfUENGNSwgU0hBRE9XX1ZTTTgsIFNIQURPV19WU00zMixcbiAgICBTSEFET1dVUERBVEVfTk9ORSwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRSxcbiAgICBTT1JUS0VZX0RFUFRIXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkZXJQYXNzIH0gZnJvbSAnLi4vc2hhZGVyLXBhc3MuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4vbGlnaHQtY2FtZXJhLmpzJztcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXJGb3JtYXQsIFVuaWZvcm1Gb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmluZEJ1ZmZlckZvcm1hdCwgQmluZEdyb3VwRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5cbmZ1bmN0aW9uIGdhdXNzKHgsIHNpZ21hKSB7XG4gICAgcmV0dXJuIE1hdGguZXhwKC0oeCAqIHgpIC8gKDIuMCAqIHNpZ21hICogc2lnbWEpKTtcbn1cblxuZnVuY3Rpb24gZ2F1c3NXZWlnaHRzKGtlcm5lbFNpemUpIHtcbiAgICBjb25zdCBzaWdtYSA9IChrZXJuZWxTaXplIC0gMSkgLyAoMiAqIDMpO1xuXG4gICAgY29uc3QgaGFsZldpZHRoID0gKGtlcm5lbFNpemUgLSAxKSAqIDAuNTtcbiAgICBjb25zdCB2YWx1ZXMgPSBuZXcgQXJyYXkoa2VybmVsU2l6ZSk7XG4gICAgbGV0IHN1bSA9IDAuMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtlcm5lbFNpemU7ICsraSkge1xuICAgICAgICB2YWx1ZXNbaV0gPSBnYXVzcyhpIC0gaGFsZldpZHRoLCBzaWdtYSk7XG4gICAgICAgIHN1bSArPSB2YWx1ZXNbaV07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXJuZWxTaXplOyArK2kpIHtcbiAgICAgICAgdmFsdWVzW2ldIC89IHN1bTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbn1cblxuY29uc3Qgc2hhZG93Q2FtVmlldyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBzaGFkb3dDYW1WaWV3UHJvaiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBwaXhlbE9mZnNldCA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5jb25zdCBibHVyU2Npc3NvclJlY3QgPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTtcbmNvbnN0IG9wQ2hhbklkID0geyByOiAxLCBnOiAyLCBiOiAzLCBhOiA0IH07XG5jb25zdCB2aWV3cG9ydE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbmZ1bmN0aW9uIGdldERlcHRoS2V5KG1lc2hJbnN0YW5jZSkge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuICAgIGNvbnN0IHggPSBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID8gMTAgOiAwO1xuICAgIGxldCB5ID0gMDtcbiAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICBjb25zdCBvcENoYW4gPSBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbDtcbiAgICAgICAgaWYgKG9wQ2hhbikge1xuICAgICAgICAgICAgeSA9IG9wQ2hhbklkW29wQ2hhbl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHggKyB5O1xufVxuXG4vKipcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU2hhZG93UmVuZGVyZXIge1xuICAgIC8qKlxuICAgICAqIEEgY2FjaGUgb2Ygc2hhZG93IHBhc3Nlcy4gRmlyc3QgaW5kZXggaXMgbG9va2VkIHVwIGJ5IGxpZ2h0IHR5cGUsIHNlY29uZCBieSBzaGFkb3cgdHlwZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3NoYWRlci1wYXNzLmpzJykuU2hhZGVyUGFzc0luZm9bXVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc2hhZG93UGFzc0NhY2hlID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9yZW5kZXJlci5qcycpLlJlbmRlcmVyfSByZW5kZXJlciAtIFRoZSByZW5kZXJlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGlnaHRpbmcvbGlnaHQtdGV4dHVyZS1hdGxhcy5qcycpLkxpZ2h0VGV4dHVyZUF0bGFzfSBsaWdodFRleHR1cmVBdGxhcyAtIFRoZVxuICAgICAqIHNoYWRvdyBtYXAgYXRsYXMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IocmVuZGVyZXIsIGxpZ2h0VGV4dHVyZUF0bGFzKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gcmVuZGVyZXIuZGV2aWNlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3JlbmRlcmVyLmpzJykuUmVuZGVyZXJ9ICovXG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSByZW5kZXJlcjtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vbGlnaHRpbmcvbGlnaHQtdGV4dHVyZS1hdGxhcy5qcycpLkxpZ2h0VGV4dHVyZUF0bGFzfSAqL1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzID0gbGlnaHRUZXh0dXJlQXRsYXM7XG5cbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZCA9IHNjb3BlLnJlc29sdmUoJ3BvbHlnb25PZmZzZXQnKTtcbiAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0ID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuICAgICAgICAvLyBWU01cbiAgICAgICAgdGhpcy5zb3VyY2VJZCA9IHNjb3BlLnJlc29sdmUoJ3NvdXJjZScpO1xuICAgICAgICB0aGlzLnBpeGVsT2Zmc2V0SWQgPSBzY29wZS5yZXNvbHZlKCdwaXhlbE9mZnNldCcpO1xuICAgICAgICB0aGlzLndlaWdodElkID0gc2NvcGUucmVzb2x2ZSgnd2VpZ2h0WzBdJyk7XG4gICAgICAgIHRoaXMuYmx1clZzbVNoYWRlckNvZGUgPSBbc2hhZGVyQ2h1bmtzLmJsdXJWU01QUywgJyNkZWZpbmUgR0FVU1NcXG4nICsgc2hhZGVyQ2h1bmtzLmJsdXJWU01QU107XG4gICAgICAgIGNvbnN0IHBhY2tlZCA9ICcjZGVmaW5lIFBBQ0tFRFxcbic7XG4gICAgICAgIHRoaXMuYmx1clBhY2tlZFZzbVNoYWRlckNvZGUgPSBbcGFja2VkICsgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZVswXSwgcGFja2VkICsgdGhpcy5ibHVyVnNtU2hhZGVyQ29kZVsxXV07XG5cbiAgICAgICAgLy8gY2FjaGUgZm9yIHZzbSBibHVyIHNoYWRlcnNcbiAgICAgICAgdGhpcy5ibHVyVnNtU2hhZGVyID0gW3t9LCB7fV07XG4gICAgICAgIHRoaXMuYmx1clBhY2tlZFZzbVNoYWRlciA9IFt7fSwge31dO1xuXG4gICAgICAgIHRoaXMuYmx1clZzbVdlaWdodHMgPSB7fTtcblxuICAgICAgICAvLyB1bmlmb3Jtc1xuICAgICAgICB0aGlzLnNoYWRvd01hcExpZ2h0UmFkaXVzSWQgPSBzY29wZS5yZXNvbHZlKCdsaWdodF9yYWRpdXMnKTtcblxuICAgICAgICAvLyB2aWV3IGJpbmQgZ3JvdXAgZm9ybWF0IHdpdGggaXRzIHVuaWZvcm0gYnVmZmVyIGZvcm1hdFxuICAgICAgICB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0ID0gbnVsbDtcblxuICAgICAgICAvLyBibGVuZCBzdGF0ZXNcbiAgICAgICAgdGhpcy5ibGVuZFN0YXRlV3JpdGUgPSBuZXcgQmxlbmRTdGF0ZSgpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlID0gbmV3IEJsZW5kU3RhdGUoKTtcbiAgICAgICAgdGhpcy5ibGVuZFN0YXRlTm9Xcml0ZS5zZXRDb2xvcldyaXRlKGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGVzIHNoYWRvdyBjYW1lcmEgZm9yIGEgbGlnaHQgYW5kIHNldHMgdXAgaXRzIGNvbnN0YW50IHByb3BlcnRpZXNcbiAgICBzdGF0aWMgY3JlYXRlU2hhZG93Q2FtZXJhKGRldmljZSwgc2hhZG93VHlwZSwgdHlwZSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IExpZ2h0Q2FtZXJhLmNyZWF0ZSgnU2hhZG93Q2FtZXJhJywgdHlwZSwgZmFjZSk7XG5cbiAgICAgICAgLy8gZG9uJ3QgY2xlYXIgdGhlIGNvbG9yIGJ1ZmZlciBpZiByZW5kZXJpbmcgYSBkZXB0aCBtYXBcbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPj0gU0hBRE9XX1ZTTTggJiYgc2hhZG93VHlwZSA8PSBTSEFET1dfVlNNMzIpIHtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5jbGVhckNvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hhZG93Q2FtLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkb3dDYW0uY2xlYXJEZXB0aEJ1ZmZlciA9IHRydWU7XG4gICAgICAgIHNoYWRvd0NhbS5jbGVhclN0ZW5jaWxCdWZmZXIgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gc2hhZG93Q2FtO1xuICAgIH1cblxuICAgIHN0YXRpYyBzZXRTaGFkb3dDYW1lcmFTZXR0aW5ncyhzaGFkb3dDYW0sIGRldmljZSwgc2hhZG93VHlwZSwgdHlwZSwgaXNDbHVzdGVyZWQpIHtcblxuICAgICAgICAvLyBub3JtYWwgb21uaSBzaGFkb3dzIG9uIHdlYmdsMiBlbmNvZGUgZGVwdGggaW4gUkdCQTggYW5kIGRvIG1hbnVhbCBQQ0Ygc2FtcGxpbmdcbiAgICAgICAgLy8gY2x1c3RlcmVkIG9tbmkgc2hhZG93cyBvbiB3ZWJnbDIgdXNlIGRlcHRoIGZvcm1hdCBhbmQgaGFyZHdhcmUgUENGIHNhbXBsaW5nXG4gICAgICAgIGxldCBod1BjZiA9IHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0Y1IHx8IChzaGFkb3dUeXBlID09PSBTSEFET1dfUENGMyAmJiBkZXZpY2Uuc3VwcG9ydHNEZXB0aFNoYWRvdyk7XG4gICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgIGh3UGNmID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkb3dDYW0uY2xlYXJDb2xvckJ1ZmZlciA9ICFod1BjZjtcbiAgICB9XG5cbiAgICAvLyBjdWxscyB0aGUgbGlzdCBvZiBtZXNoZXMgaW5zdGFuY2VzIGJ5IHRoZSBjYW1lcmEsIHN0b3JpbmcgdmlzaWJsZSBtZXNoIGluc3RhbmNlcyBpbiB0aGUgc3BlY2lmaWVkIGFycmF5XG4gICAgY3VsbFNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcywgdmlzaWJsZSwgY2FtZXJhKSB7XG5cbiAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbnVtSW5zdGFuY2VzID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSW5zdGFuY2VzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2UuY2FzdFNoYWRvdykge1xuICAgICAgICAgICAgICAgIGlmICghbWVzaEluc3RhbmNlLmN1bGwgfHwgbWVzaEluc3RhbmNlLl9pc1Zpc2libGUoY2FtZXJhKSkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVbY291bnRdID0gbWVzaEluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZpc2libGUubGVuZ3RoID0gY291bnQ7XG5cbiAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIHByb2JhYmx5IHNvcnQgc2hhZG93IG1lc2hlcyBieSBzaGFkZXIgYW5kIG5vdCBkZXB0aFxuICAgICAgICB2aXNpYmxlLnNvcnQodGhpcy5yZW5kZXJlci5zb3J0Q29tcGFyZURlcHRoKTtcbiAgICB9XG5cbiAgICBzZXR1cFJlbmRlclN0YXRlKGRldmljZSwgbGlnaHQpIHtcblxuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIGRlcHRoIGJpYXNcbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKHRydWUpO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXNWYWx1ZXMobGlnaHQuc2hhZG93QmlhcyAqIC0xMDAwLjAsIGxpZ2h0LnNoYWRvd0JpYXMgKiAtMTAwMC4wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldFswXSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZC5zZXRWYWx1ZSh0aGlzLnBvbHlnb25PZmZzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMV0gPSBsaWdodC5zaGFkb3dCaWFzICogLTEwMDAuMDtcbiAgICAgICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRJZC5zZXRWYWx1ZSh0aGlzLnBvbHlnb25PZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHN0YW5kYXJkIHNoYWRvd21hcCBzdGF0ZXNcbiAgICAgICAgY29uc3QgZ3B1T3JHbDIgPSBkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5pc1dlYkdQVTtcbiAgICAgICAgY29uc3QgdXNlU2hhZG93U2FtcGxlciA9IGlzQ2x1c3RlcmVkID9cbiAgICAgICAgICAgIGxpZ2h0Ll9pc1BjZiAmJiBncHVPckdsMiA6ICAgICAvLyBib3RoIHNwb3QgYW5kIG9tbmkgbGlnaHQgYXJlIHVzaW5nIHNoYWRvdyBzYW1wbGVyIG9uIHdlYmdsMiB3aGVuIGNsdXN0ZXJlZFxuICAgICAgICAgICAgbGlnaHQuX2lzUGNmICYmIGdwdU9yR2wyICYmIGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfT01OSTsgICAgLy8gZm9yIG5vbi1jbHVzdGVyZWQsIHBvaW50IGxpZ2h0IGlzIHVzaW5nIGRlcHRoIGVuY29kZWQgaW4gY29sb3IgYnVmZmVyIChzaG91bGQgY2hhbmdlIHRvIHNoYWRvdyBzYW1wbGVyKVxuXG4gICAgICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKHVzZVNoYWRvd1NhbXBsZXIgPyB0aGlzLmJsZW5kU3RhdGVOb1dyaXRlIDogdGhpcy5ibGVuZFN0YXRlV3JpdGUpO1xuICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLkRFRkFVTFQpO1xuICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFN0YXRlKG51bGwsIG51bGwpO1xuICAgIH1cblxuICAgIHJlc3RvcmVSZW5kZXJTdGF0ZShkZXZpY2UpIHtcblxuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMiB8fCBkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICB0aGlzLnBvbHlnb25PZmZzZXRbMF0gPSAwO1xuICAgICAgICAgICAgdGhpcy5wb2x5Z29uT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgICAgIHRoaXMucG9seWdvbk9mZnNldElkLnNldFZhbHVlKHRoaXMucG9seWdvbk9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFVuaWZvcm1zKGxpZ2h0LCBzaGFkb3dDYW0sIGxpZ2h0UmVuZGVyRGF0YSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHNoYWRvd0NhbU5vZGUgPSBzaGFkb3dDYW0uX25vZGU7XG5cbiAgICAgICAgLy8gcG9zaXRpb24gLyByYW5nZVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5kaXNwYXRjaFZpZXdQb3Moc2hhZG93Q2FtTm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93TWFwTGlnaHRSYWRpdXNJZC5zZXRWYWx1ZShsaWdodC5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2aWV3LXByb2plY3Rpb24gc2hhZG93IG1hdHJpeFxuICAgICAgICBzaGFkb3dDYW1WaWV3LnNldFRSUyhzaGFkb3dDYW1Ob2RlLmdldFBvc2l0aW9uKCksIHNoYWRvd0NhbU5vZGUuZ2V0Um90YXRpb24oKSwgVmVjMy5PTkUpLmludmVydCgpO1xuICAgICAgICBzaGFkb3dDYW1WaWV3UHJvai5tdWwyKHNoYWRvd0NhbS5wcm9qZWN0aW9uTWF0cml4LCBzaGFkb3dDYW1WaWV3KTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBoYW5kbGluZ1xuICAgICAgICBjb25zdCByZWN0Vmlld3BvcnQgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Vmlld3BvcnQ7XG4gICAgICAgIHNoYWRvd0NhbS5yZWN0ID0gcmVjdFZpZXdwb3J0O1xuICAgICAgICBzaGFkb3dDYW0uc2Npc3NvclJlY3QgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93U2Npc3NvcjtcblxuICAgICAgICB2aWV3cG9ydE1hdHJpeC5zZXRWaWV3cG9ydChyZWN0Vmlld3BvcnQueCwgcmVjdFZpZXdwb3J0LnksIHJlY3RWaWV3cG9ydC56LCByZWN0Vmlld3BvcnQudyk7XG4gICAgICAgIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXgubXVsMih2aWV3cG9ydE1hdHJpeCwgc2hhZG93Q2FtVmlld1Byb2opO1xuXG4gICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAvLyBjb3B5IG1hdHJpeCB0byBzaGFkb3cgY2FzY2FkZSBwYWxldHRlXG4gICAgICAgICAgICBsaWdodC5fc2hhZG93TWF0cml4UGFsZXR0ZS5zZXQobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhLCBmYWNlICogMTYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0U2hhZG93UGFzcyhsaWdodCkge1xuXG4gICAgICAgIC8vIGdldCBzaGFkZXIgcGFzcyBmcm9tIGNhY2hlIGZvciB0aGlzIGxpZ2h0IHR5cGUgYW5kIHNoYWRvdyB0eXBlXG4gICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gbGlnaHQuX3NoYWRvd1R5cGU7XG4gICAgICAgIGxldCBzaGFkb3dQYXNzSW5mbyA9IHRoaXMuc2hhZG93UGFzc0NhY2hlW2xpZ2h0VHlwZV0/LltzaGFkb3dUeXBlXTtcbiAgICAgICAgaWYgKCFzaGFkb3dQYXNzSW5mbykge1xuXG4gICAgICAgICAgICAvLyBuZXcgc2hhZGVyIHBhc3MgaWYgbm90IGluIGNhY2hlXG4gICAgICAgICAgICBjb25zdCBzaGFkb3dQYXNzTmFtZSA9IGBTaGFkb3dQYXNzXyR7bGlnaHRUeXBlfV8ke3NoYWRvd1R5cGV9YDtcbiAgICAgICAgICAgIHNoYWRvd1Bhc3NJbmZvID0gU2hhZGVyUGFzcy5nZXQodGhpcy5kZXZpY2UpLmFsbG9jYXRlKHNoYWRvd1Bhc3NOYW1lLCB7XG4gICAgICAgICAgICAgICAgaXNTaGFkb3c6IHRydWUsXG4gICAgICAgICAgICAgICAgbGlnaHRUeXBlOiBsaWdodFR5cGUsXG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZTogc2hhZG93VHlwZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byB0aGUgY2FjaGVcbiAgICAgICAgICAgIGlmICghdGhpcy5zaGFkb3dQYXNzQ2FjaGVbbGlnaHRUeXBlXSlcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd1Bhc3NDYWNoZVtsaWdodFR5cGVdID0gW107XG4gICAgICAgICAgICB0aGlzLnNoYWRvd1Bhc3NDYWNoZVtsaWdodFR5cGVdW3NoYWRvd1R5cGVdID0gc2hhZG93UGFzc0luZm87XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2hhZG93UGFzc0luZm8uaW5kZXg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gdmlzaWJsZUNhc3RlcnMgLSBWaXNpYmxlIG1lc2hcbiAgICAgKiBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xpZ2h0LmpzJykuTGlnaHR9IGxpZ2h0IC0gVGhlIGxpZ2h0LlxuICAgICAqL1xuICAgIHN1Ym1pdENhc3RlcnModmlzaWJsZUNhc3RlcnMsIGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSByZW5kZXJlci5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWdzID0gMSA8PCBTSEFERVJfU0hBRE9XO1xuICAgICAgICBjb25zdCBzaGFkb3dQYXNzID0gdGhpcy5nZXRTaGFkb3dQYXNzKGxpZ2h0KTtcblxuICAgICAgICAvLyBUT0RPOiBTaW1pbGFybHkgdG8gZm9yd2FyZCByZW5kZXJlciwgYSBzaGFkZXIgY3JlYXRpb24gcGFydCBvZiB0aGlzIGxvb3Agc2hvdWxkIGJlIHNwbGl0IGludG8gYSBzZXBhcmF0ZSBsb29wLFxuICAgICAgICAvLyBhbmQgZW5kU2hhZGVyQmF0Y2ggc2hvdWxkIGJlIGNhbGxlZCBhdCBpdHMgZW5kXG5cbiAgICAgICAgLy8gUmVuZGVyXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdmlzaWJsZUNhc3RlcnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHZpc2libGVDYXN0ZXJzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAvLyBzZXQgYmFzaWMgbWF0ZXJpYWwgc3RhdGVzL3BhcmFtZXRlcnNcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICByZW5kZXJlci5zZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jaHVua3MpIHtcblxuICAgICAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwQ3VsbE1vZGUodHJ1ZSwgMSwgbWVzaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIEkgKHNoYWRvdyk6IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUkgKHNoYWRvdyk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFncyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBzaGFkZXJcbiAgICAgICAgICAgIGxldCBzaGFkb3dTaGFkZXIgPSBtZXNoSW5zdGFuY2UuX3NoYWRlcltzaGFkb3dQYXNzXTtcbiAgICAgICAgICAgIGlmICghc2hhZG93U2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHNoYWRvd1Bhc3MsIG51bGwsIG51bGwsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgc2hhZG93U2hhZGVyID0gbWVzaEluc3RhbmNlLl9zaGFkZXJbc2hhZG93UGFzc107XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9rZXlbU09SVEtFWV9ERVBUSF0gPSBnZXREZXB0aEtleShtZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzaGFkb3dTaGFkZXIuZmFpbGVkICYmICFkZXZpY2Uuc2V0U2hhZGVyKHNoYWRvd1NoYWRlcikpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRvdyBzaGFkZXIgZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3NoYWRvd1Bhc3N9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgYnVmZmVyc1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0TW9ycGhpbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMobWVzaEluc3RhbmNlLCBzaGFkb3dQYXNzKTtcblxuICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBtZXNoSW5zdGFuY2UucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0SW5kZXhCdWZmZXIobWVzaC5pbmRleEJ1ZmZlcltzdHlsZV0pO1xuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICByZW5kZXJlci5kcmF3SW5zdGFuY2UoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgIHJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHMrKztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5lZWRzU2hhZG93UmVuZGVyaW5nKGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbmVlZHMgPSBsaWdodC5lbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWU7XG5cbiAgICAgICAgaWYgKGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPT09IFNIQURPV1VQREFURV9USElTRlJBTUUpIHtcbiAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfTk9ORTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZWVkcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyArPSBsaWdodC5udW1TaGFkb3dGYWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZWVkcztcbiAgICB9XG5cbiAgICBnZXRMaWdodFJlbmRlckRhdGEobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGFyZSBwZXIgY2FtZXJhLCBzbyBnZXQgYXBwcm9wcmlhdGUgcmVuZGVyIGRhdGFcbiAgICAgICAgcmV0dXJuIGxpZ2h0LmdldFJlbmRlckRhdGEobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IGNhbWVyYSA6IG51bGwsIGZhY2UpO1xuICAgIH1cblxuICAgIHNldHVwUmVuZGVyUGFzcyhyZW5kZXJQYXNzLCBzaGFkb3dDYW1lcmEsIGNsZWFyUmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgY29uc3QgcnQgPSBzaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICByZW5kZXJQYXNzLmluaXQocnQpO1xuXG4gICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZSA9IDE7XG4gICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggPSBjbGVhclJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyBpZiByZW5kZXJpbmcgdG8gZGVwdGggYnVmZmVyXG4gICAgICAgIGlmIChydC5kZXB0aEJ1ZmZlcikge1xuXG4gICAgICAgICAgICByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoID0gdHJ1ZTtcblxuICAgICAgICB9IGVsc2UgeyAvLyByZW5kZXJpbmcgdG8gY29sb3IgYnVmZmVyXG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXJWYWx1ZS5jb3B5KHNoYWRvd0NhbWVyYS5jbGVhckNvbG9yKTtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXIgPSBjbGVhclJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdCBzYW1wbGluZyBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY3ViZW1hcHNcbiAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgcmVuZGVyIHRhcmdldCAvIHJlbmRlciB0YXJnZXQgc2V0dGluZ3MgdG8gYWxsb3cgcmVuZGVyIHBhc3MgdG8gYmUgc2V0IHVwXG4gICAgcHJlcGFyZUZhY2UobGlnaHQsIGNhbWVyYSwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHR5cGUgPSBsaWdodC5fdHlwZTtcbiAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IGxpZ2h0Ll9zaGFkb3dUeXBlO1xuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMucmVuZGVyZXIuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHRoaXMuZ2V0TGlnaHRSZW5kZXJEYXRhKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgIC8vIGNhbWVyYSBjbGVhciBzZXR0aW5nXG4gICAgICAgIC8vIE5vdGU6IHdoZW4gY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIHRoZSBvbmx5IGxpZ2h0aW5nIHR5cGUsIHRoaXMgY29kZSBjYW4gYmUgbW92ZWQgdG8gY3JlYXRlU2hhZG93Q2FtZXJhIGZ1bmN0aW9uXG4gICAgICAgIFNoYWRvd1JlbmRlcmVyLnNldFNoYWRvd0NhbWVyYVNldHRpbmdzKHNoYWRvd0NhbSwgdGhpcy5kZXZpY2UsIHNoYWRvd1R5cGUsIHR5cGUsIGlzQ2x1c3RlcmVkKTtcblxuICAgICAgICAvLyBhc3NpZ24gcmVuZGVyIHRhcmdldCBmb3IgdGhlIGZhY2VcbiAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0SW5kZXggPSB0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyAwIDogZmFjZTtcbiAgICAgICAgc2hhZG93Q2FtLnJlbmRlclRhcmdldCA9IGxpZ2h0Ll9zaGFkb3dNYXAucmVuZGVyVGFyZ2V0c1tyZW5kZXJUYXJnZXRJbmRleF07XG5cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICByZW5kZXJGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UsIGNsZWFyLCBpbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2hhZG93TWFwU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBTSEFET1cgJHtsaWdodC5fbm9kZS5uYW1lfSBGQUNFICR7ZmFjZX1gKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSB0aGlzLmdldExpZ2h0UmVuZGVyRGF0YShsaWdodCwgY2FtZXJhLCBmYWNlKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICB0aGlzLmRpc3BhdGNoVW5pZm9ybXMobGlnaHQsIHNoYWRvd0NhbSwgbGlnaHRSZW5kZXJEYXRhLCBmYWNlKTtcblxuICAgICAgICBjb25zdCBydCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcjtcbiAgICAgICAgcmVuZGVyZXIuc2V0Q2FtZXJhVW5pZm9ybXMoc2hhZG93Q2FtLCBydCk7XG4gICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycykge1xuICAgICAgICAgICAgcmVuZGVyZXIuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMobGlnaHRSZW5kZXJEYXRhLnZpZXdCaW5kR3JvdXBzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluc2lkZVJlbmRlclBhc3MpIHtcbiAgICAgICAgICAgIHJlbmRlcmVyLnNldHVwVmlld3BvcnQoc2hhZG93Q2FtLCBydCk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGhlcmUgaXMgdXNlZCB0byBjbGVhciBhIHZpZXdwb3J0IGluc2lkZSByZW5kZXIgdGFyZ2V0LlxuICAgICAgICAgICAgaWYgKGNsZWFyKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXIuY2xlYXIoc2hhZG93Q2FtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gdGhpcyBpcyBvbmx5IHVzZWQgYnkgbGlnaHRtYXBwZXIsIHRpbGwgaXQncyBjb252ZXJ0ZWQgdG8gcmVuZGVyIHBhc3Nlc1xuICAgICAgICAgICAgcmVuZGVyZXIuY2xlYXJWaWV3KHNoYWRvd0NhbSwgcnQsIHRydWUsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBSZW5kZXJTdGF0ZShkZXZpY2UsIGxpZ2h0KTtcblxuICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5zdWJtaXRDYXN0ZXJzKGxpZ2h0UmVuZGVyRGF0YS52aXNpYmxlQ2FzdGVycywgbGlnaHQpO1xuXG4gICAgICAgIHRoaXMucmVzdG9yZVJlbmRlclN0YXRlKGRldmljZSk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lICs9IG5vdygpIC0gc2hhZG93TWFwU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICByZW5kZXIobGlnaHQsIGNhbWVyYSwgaW5zaWRlUmVuZGVyUGFzcyA9IHRydWUpIHtcblxuICAgICAgICBpZiAodGhpcy5uZWVkc1NoYWRvd1JlbmRlcmluZyhsaWdodCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZhY2VDb3VudCA9IGxpZ2h0Lm51bVNoYWRvd0ZhY2VzO1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgZmFjZXNcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVGYWNlKGxpZ2h0LCBjYW1lcmEsIGZhY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmFjZShsaWdodCwgY2FtZXJhLCBmYWNlLCB0cnVlLCBpbnNpZGVSZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXBwbHkgdnNtXG4gICAgICAgICAgICB0aGlzLnJlbmRlclZzbShsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlclZzbShsaWdodCwgY2FtZXJhKSB7XG5cbiAgICAgICAgLy8gVlNNIGJsdXIgaWYgbGlnaHQgc3VwcG9ydHMgdnNtIChkaXJlY3Rpb25hbCBhbmQgc3BvdCBpbiBnZW5lcmFsKVxuICAgICAgICBpZiAobGlnaHQuX2lzVnNtICYmIGxpZ2h0Ll92c21CbHVyU2l6ZSA+IDEpIHtcblxuICAgICAgICAgICAgLy8gaW4gY2x1c3RlcmVkIG1vZGUsIG9ubHkgZGlyZWN0aW9uYWwgbGlnaHQgY2FuIGJlIHZtc1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnJlbmRlcmVyLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgIGlmICghaXNDbHVzdGVyZWQgfHwgbGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKSB7XG5cbiAgICAgICAgbGV0IGJsdXJTaGFkZXIgPSAoaXNWc204ID8gdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyIDogdGhpcy5ibHVyVnNtU2hhZGVyKVtibHVyTW9kZV1bZmlsdGVyU2l6ZV07XG4gICAgICAgIGlmICghYmx1clNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5ibHVyVnNtV2VpZ2h0c1tmaWx0ZXJTaXplXSA9IGdhdXNzV2VpZ2h0cyhmaWx0ZXJTaXplKTtcblxuICAgICAgICAgICAgY29uc3QgYmx1clZTID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBsZXQgYmx1ckZTID0gJyNkZWZpbmUgU0FNUExFUyAnICsgZmlsdGVyU2l6ZSArICdcXG4nO1xuICAgICAgICAgICAgaWYgKGlzVnNtOCkge1xuICAgICAgICAgICAgICAgIGJsdXJGUyArPSB0aGlzLmJsdXJQYWNrZWRWc21TaGFkZXJDb2RlW2JsdXJNb2RlXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmx1ckZTICs9IHRoaXMuYmx1clZzbVNoYWRlckNvZGVbYmx1ck1vZGVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYmx1clNoYWRlck5hbWUgPSAnYmx1clZzbScgKyBibHVyTW9kZSArICcnICsgZmlsdGVyU2l6ZSArICcnICsgaXNWc204O1xuICAgICAgICAgICAgYmx1clNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCBibHVyVlMsIGJsdXJGUywgYmx1clNoYWRlck5hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaXNWc204KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibHVyUGFja2VkVnNtU2hhZGVyW2JsdXJNb2RlXVtmaWx0ZXJTaXplXSA9IGJsdXJTaGFkZXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYmx1clZzbVNoYWRlcltibHVyTW9kZV1bZmlsdGVyU2l6ZV0gPSBibHVyU2hhZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJsdXJTaGFkZXI7XG4gICAgfVxuXG4gICAgYXBwbHlWc21CbHVyKGxpZ2h0LCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgVlNNICR7bGlnaHQuX25vZGUubmFtZX1gKTtcblxuICAgICAgICAvLyByZW5kZXIgc3RhdGVcbiAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcblxuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBjYW1lcmEgOiBudWxsLCAwKTtcbiAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcbiAgICAgICAgY29uc3Qgb3JpZ1NoYWRvd01hcCA9IHNoYWRvd0NhbS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgZm9yIGJsdXJyaW5nXG4gICAgICAgIC8vIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG9wdGltYWwgYW5kIHNoYWRvdyBtYXAgY291bGQgaGF2ZSBkZXB0aCBidWZmZXIgb24gaW4gYWRkaXRpb24gdG8gY29sb3IgYnVmZmVyLFxuICAgICAgICAvLyBhbmQgZm9yIGJsdXJyaW5nIG9ubHkgb25lIGJ1ZmZlciBpcyBuZWVkZWQuXG4gICAgICAgIGNvbnN0IHRlbXBTaGFkb3dNYXAgPSB0aGlzLnJlbmRlcmVyLnNoYWRvd01hcENhY2hlLmdldChkZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgY29uc3QgdGVtcFJ0ID0gdGVtcFNoYWRvd01hcC5yZW5kZXJUYXJnZXRzWzBdO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtOCA9IGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNODtcbiAgICAgICAgY29uc3QgYmx1ck1vZGUgPSBsaWdodC52c21CbHVyTW9kZTtcbiAgICAgICAgY29uc3QgZmlsdGVyU2l6ZSA9IGxpZ2h0Ll92c21CbHVyU2l6ZTtcbiAgICAgICAgY29uc3QgYmx1clNoYWRlciA9IHRoaXMuZ2V0VnNtQmx1clNoYWRlcihpc1ZzbTgsIGJsdXJNb2RlLCBmaWx0ZXJTaXplKTtcblxuICAgICAgICBibHVyU2Npc3NvclJlY3QueiA9IGxpZ2h0Ll9zaGFkb3dSZXNvbHV0aW9uIC0gMjtcbiAgICAgICAgYmx1clNjaXNzb3JSZWN0LncgPSBibHVyU2Npc3NvclJlY3QuejtcblxuICAgICAgICAvLyBCbHVyIGhvcml6b250YWxcbiAgICAgICAgdGhpcy5zb3VyY2VJZC5zZXRWYWx1ZShvcmlnU2hhZG93TWFwLmNvbG9yQnVmZmVyKTtcbiAgICAgICAgcGl4ZWxPZmZzZXRbMF0gPSAxIC8gbGlnaHQuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgaWYgKGJsdXJNb2RlID09PSBCTFVSX0dBVVNTSUFOKSB0aGlzLndlaWdodElkLnNldFZhbHVlKHRoaXMuYmx1clZzbVdlaWdodHNbZmlsdGVyU2l6ZV0pO1xuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUnQsIGJsdXJTaGFkZXIsIG51bGwsIGJsdXJTY2lzc29yUmVjdCk7XG5cbiAgICAgICAgLy8gQmx1ciB2ZXJ0aWNhbFxuICAgICAgICB0aGlzLnNvdXJjZUlkLnNldFZhbHVlKHRlbXBSdC5jb2xvckJ1ZmZlcik7XG4gICAgICAgIHBpeGVsT2Zmc2V0WzFdID0gcGl4ZWxPZmZzZXRbMF07XG4gICAgICAgIHBpeGVsT2Zmc2V0WzBdID0gMDtcbiAgICAgICAgdGhpcy5waXhlbE9mZnNldElkLnNldFZhbHVlKHBpeGVsT2Zmc2V0KTtcbiAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgb3JpZ1NoYWRvd01hcCwgYmx1clNoYWRlciwgbnVsbCwgYmx1clNjaXNzb3JSZWN0KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIHRlbXBvcmFyeSBzaGFkb3cgbWFwIGJhY2sgdG8gdGhlIGNhY2hlXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93TWFwQ2FjaGUuYWRkKGxpZ2h0LCB0ZW1wU2hhZG93TWFwKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIG5vIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZG93UmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJnYXVzcyIsIngiLCJzaWdtYSIsIk1hdGgiLCJleHAiLCJnYXVzc1dlaWdodHMiLCJrZXJuZWxTaXplIiwiaGFsZldpZHRoIiwidmFsdWVzIiwiQXJyYXkiLCJzdW0iLCJpIiwic2hhZG93Q2FtVmlldyIsIk1hdDQiLCJzaGFkb3dDYW1WaWV3UHJvaiIsInBpeGVsT2Zmc2V0IiwiRmxvYXQzMkFycmF5IiwiYmx1clNjaXNzb3JSZWN0IiwiVmVjNCIsIm9wQ2hhbklkIiwiciIsImciLCJiIiwiYSIsInZpZXdwb3J0TWF0cml4IiwiZ2V0RGVwdGhLZXkiLCJtZXNoSW5zdGFuY2UiLCJtYXRlcmlhbCIsInNraW5JbnN0YW5jZSIsInkiLCJvcGFjaXR5TWFwIiwib3BDaGFuIiwib3BhY2l0eU1hcENoYW5uZWwiLCJTaGFkb3dSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwicmVuZGVyZXIiLCJsaWdodFRleHR1cmVBdGxhcyIsInNoYWRvd1Bhc3NDYWNoZSIsImRldmljZSIsInNjb3BlIiwicG9seWdvbk9mZnNldElkIiwicmVzb2x2ZSIsInBvbHlnb25PZmZzZXQiLCJzb3VyY2VJZCIsInBpeGVsT2Zmc2V0SWQiLCJ3ZWlnaHRJZCIsImJsdXJWc21TaGFkZXJDb2RlIiwic2hhZGVyQ2h1bmtzIiwiYmx1clZTTVBTIiwicGFja2VkIiwiYmx1clBhY2tlZFZzbVNoYWRlckNvZGUiLCJibHVyVnNtU2hhZGVyIiwiYmx1clBhY2tlZFZzbVNoYWRlciIsImJsdXJWc21XZWlnaHRzIiwic2hhZG93TWFwTGlnaHRSYWRpdXNJZCIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsImJsZW5kU3RhdGVXcml0ZSIsIkJsZW5kU3RhdGUiLCJibGVuZFN0YXRlTm9Xcml0ZSIsInNldENvbG9yV3JpdGUiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJzaGFkb3dUeXBlIiwidHlwZSIsImZhY2UiLCJzaGFkb3dDYW0iLCJMaWdodENhbWVyYSIsImNyZWF0ZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1ZTTTMyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInNldFNoYWRvd0NhbWVyYVNldHRpbmdzIiwiaXNDbHVzdGVyZWQiLCJod1BjZiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjMiLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiTElHSFRUWVBFX09NTkkiLCJjbGVhckNvbG9yQnVmZmVyIiwiY3VsbFNoYWRvd0Nhc3RlcnMiLCJtZXNoSW5zdGFuY2VzIiwidmlzaWJsZSIsImNhbWVyYSIsImNvdW50IiwibnVtSW5zdGFuY2VzIiwibGVuZ3RoIiwiY2FzdFNoYWRvdyIsImN1bGwiLCJfaXNWaXNpYmxlIiwidmlzaWJsZVRoaXNGcmFtZSIsInNvcnQiLCJzb3J0Q29tcGFyZURlcHRoIiwic2V0dXBSZW5kZXJTdGF0ZSIsImxpZ2h0Iiwic2NlbmUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJ3ZWJnbDIiLCJpc1dlYkdQVSIsIl90eXBlIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwic2hhZG93QmlhcyIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJzZXRWYWx1ZSIsImdwdU9yR2wyIiwidXNlU2hhZG93U2FtcGxlciIsIl9pc1BjZiIsInNldEJsZW5kU3RhdGUiLCJzZXREZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIkRFRkFVTFQiLCJzZXRTdGVuY2lsU3RhdGUiLCJyZXN0b3JlUmVuZGVyU3RhdGUiLCJkaXNwYXRjaFVuaWZvcm1zIiwibGlnaHRSZW5kZXJEYXRhIiwic2hhZG93Q2FtTm9kZSIsIl9ub2RlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiZGlzcGF0Y2hWaWV3UG9zIiwiZ2V0UG9zaXRpb24iLCJhdHRlbnVhdGlvbkVuZCIsInNldFRSUyIsImdldFJvdGF0aW9uIiwiVmVjMyIsIk9ORSIsImludmVydCIsIm11bDIiLCJwcm9qZWN0aW9uTWF0cml4IiwicmVjdFZpZXdwb3J0Iiwic2hhZG93Vmlld3BvcnQiLCJyZWN0Iiwic2Npc3NvclJlY3QiLCJzaGFkb3dTY2lzc29yIiwic2V0Vmlld3BvcnQiLCJ6IiwidyIsInNoYWRvd01hdHJpeCIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwic2V0IiwiZGF0YSIsImdldFNoYWRvd1Bhc3MiLCJfdGhpcyRzaGFkb3dQYXNzQ2FjaGUiLCJsaWdodFR5cGUiLCJfc2hhZG93VHlwZSIsInNoYWRvd1Bhc3NJbmZvIiwic2hhZG93UGFzc05hbWUiLCJTaGFkZXJQYXNzIiwiZ2V0IiwiYWxsb2NhdGUiLCJpc1NoYWRvdyIsImluZGV4Iiwic3VibWl0Q2FzdGVycyIsInZpc2libGVDYXN0ZXJzIiwicGFzc0ZsYWdzIiwiU0hBREVSX1NIQURPVyIsInNoYWRvd1Bhc3MiLCJtZXNoIiwiZW5zdXJlTWF0ZXJpYWwiLCJzZXRCYXNlQ29uc3RhbnRzIiwic2V0U2tpbm5pbmciLCJkaXJ0eSIsInVwZGF0ZVVuaWZvcm1zIiwiY2h1bmtzIiwic2V0dXBDdWxsTW9kZSIsInNldFBhcmFtZXRlcnMiLCJzaGFkb3dTaGFkZXIiLCJfc2hhZGVyIiwidXBkYXRlUGFzc1NoYWRlciIsIl9rZXkiLCJTT1JUS0VZX0RFUFRIIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiRGVidWciLCJlcnJvciIsIm5hbWUiLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0TW9ycGhpbmciLCJtb3JwaEluc3RhbmNlIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJzdHlsZSIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsImRyYXdJbnN0YW5jZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJuZWVkc1NoYWRvd1JlbmRlcmluZyIsIm5lZWRzIiwiZW5hYmxlZCIsImNhc3RTaGFkb3dzIiwic2hhZG93VXBkYXRlTW9kZSIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsIl9zaGFkb3dNYXBVcGRhdGVzIiwibnVtU2hhZG93RmFjZXMiLCJnZXRMaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwic2V0dXBSZW5kZXJQYXNzIiwicmVuZGVyUGFzcyIsInNoYWRvd0NhbWVyYSIsImNsZWFyUmVuZGVyVGFyZ2V0IiwicnQiLCJyZW5kZXJUYXJnZXQiLCJpbml0IiwiZGVwdGhTdGVuY2lsT3BzIiwiY2xlYXJEZXB0aFZhbHVlIiwiY2xlYXJEZXB0aCIsImRlcHRoQnVmZmVyIiwic3RvcmVEZXB0aCIsImNvbG9yT3BzIiwiY2xlYXJWYWx1ZSIsImNvcHkiLCJjbGVhciIsInJlcXVpcmVzQ3ViZW1hcHMiLCJwcmVwYXJlRmFjZSIsInJlbmRlclRhcmdldEluZGV4IiwiX3NoYWRvd01hcCIsInJlbmRlclRhcmdldHMiLCJyZW5kZXJGYWNlIiwiaW5zaWRlUmVuZGVyUGFzcyIsInNoYWRvd01hcFN0YXJ0VGltZSIsIm5vdyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJ2aWV3QmluZEdyb3VwcyIsInNldHVwVmlld3BvcnQiLCJjbGVhclZpZXciLCJwb3BHcHVNYXJrZXIiLCJfc2hhZG93TWFwVGltZSIsInJlbmRlciIsImZhY2VDb3VudCIsInJlbmRlclZzbSIsIl9pc1ZzbSIsIl92c21CbHVyU2l6ZSIsImFwcGx5VnNtQmx1ciIsImdldFZzbUJsdXJTaGFkZXIiLCJpc1ZzbTgiLCJibHVyTW9kZSIsImZpbHRlclNpemUiLCJibHVyU2hhZGVyIiwiYmx1clZTIiwiZnVsbHNjcmVlblF1YWRWUyIsImJsdXJGUyIsImJsdXJTaGFkZXJOYW1lIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJvcmlnU2hhZG93TWFwIiwidGVtcFNoYWRvd01hcCIsInNoYWRvd01hcENhY2hlIiwidGVtcFJ0IiwidnNtQmx1ck1vZGUiLCJfc2hhZG93UmVzb2x1dGlvbiIsImNvbG9yQnVmZmVyIiwiQkxVUl9HQVVTU0lBTiIsImRyYXdRdWFkV2l0aFNoYWRlciIsImFkZCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0IiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJmcmFtZVVwZGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTRCQSxTQUFTQSxLQUFLQSxDQUFDQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtBQUNyQixFQUFBLE9BQU9DLElBQUksQ0FBQ0MsR0FBRyxDQUFDLEVBQUVILENBQUMsR0FBR0EsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHQyxLQUFLLEdBQUdBLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDckQsQ0FBQTtBQUVBLFNBQVNHLFlBQVlBLENBQUNDLFVBQVUsRUFBRTtFQUM5QixNQUFNSixLQUFLLEdBQUcsQ0FBQ0ksVUFBVSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFeEMsRUFBQSxNQUFNQyxTQUFTLEdBQUcsQ0FBQ0QsVUFBVSxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUE7QUFDeEMsRUFBQSxNQUFNRSxNQUFNLEdBQUcsSUFBSUMsS0FBSyxDQUFDSCxVQUFVLENBQUMsQ0FBQTtFQUNwQyxJQUFJSSxHQUFHLEdBQUcsR0FBRyxDQUFBO0VBQ2IsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdMLFVBQVUsRUFBRSxFQUFFSyxDQUFDLEVBQUU7SUFDakNILE1BQU0sQ0FBQ0csQ0FBQyxDQUFDLEdBQUdYLEtBQUssQ0FBQ1csQ0FBQyxHQUFHSixTQUFTLEVBQUVMLEtBQUssQ0FBQyxDQUFBO0FBQ3ZDUSxJQUFBQSxHQUFHLElBQUlGLE1BQU0sQ0FBQ0csQ0FBQyxDQUFDLENBQUE7QUFDcEIsR0FBQTtFQUVBLEtBQUssSUFBSUEsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHTCxVQUFVLEVBQUUsRUFBRUssQ0FBQyxFQUFF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
