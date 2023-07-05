import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, FOG_NONE, FOG_LINEAR, COMPUPDATED_LIGHTS, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, COMPUPDATED_INSTANCES, LAYERID_DEPTH } from '../constants.js';
import { Renderer } from './renderer.js';
import { LightCamera } from './light-camera.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';
import { SceneGrab } from '../graphics/scene-grab.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);
const _drawCallList = {
  drawCalls: [],
  isNewMaterial: [],
  lightMaskChanged: [],
  clear: function () {
    this.drawCalls.length = 0;
    this.isNewMaterial.length = 0;
    this.lightMaskChanged.length = 0;
  }
};
function vogelDiskPrecalculationSamples(numSamples) {
  const samples = [];
  for (let i = 0; i < numSamples; ++i) {
    const r = Math.sqrt(i + 0.5) / Math.sqrt(numSamples);
    samples.push(r);
  }
  return samples;
}
function vogelSpherePrecalculationSamples(numSamples) {
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const weight = i / numSamples;
    const radius = Math.sqrt(1.0 - weight * weight);
    samples.push(radius);
  }
  return samples;
}

/**
 * The forward renderer renders {@link Scene}s.
 *
 * @ignore
 */
class ForwardRenderer extends Renderer {
  /**
   * Create a new ForwardRenderer instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device used by the renderer.
   */
  constructor(graphicsDevice) {
    super(graphicsDevice);
    const device = this.device;
    this._forwardDrawCalls = 0;
    this._materialSwitches = 0;
    this._depthMapTime = 0;
    this._forwardTime = 0;
    this._sortTime = 0;

    // Uniforms
    const scope = device.scope;
    this.fogColorId = scope.resolve('fog_color');
    this.fogStartId = scope.resolve('fog_start');
    this.fogEndId = scope.resolve('fog_end');
    this.fogDensityId = scope.resolve('fog_density');
    this.ambientId = scope.resolve('light_globalAmbient');
    this.skyboxIntensityId = scope.resolve('skyboxIntensity');
    this.cubeMapRotationMatrixId = scope.resolve('cubeMapRotationMatrix');
    this.pcssDiskSamplesId = scope.resolve('pcssDiskSamples[0]');
    this.pcssSphereSamplesId = scope.resolve('pcssSphereSamples[0]');
    this.lightColorId = [];
    this.lightDir = [];
    this.lightDirId = [];
    this.lightShadowMapId = [];
    this.lightShadowMatrixId = [];
    this.lightShadowParamsId = [];
    this.lightShadowIntensity = [];
    this.lightRadiusId = [];
    this.lightPos = [];
    this.lightPosId = [];
    this.lightWidth = [];
    this.lightWidthId = [];
    this.lightHeight = [];
    this.lightHeightId = [];
    this.lightInAngleId = [];
    this.lightOutAngleId = [];
    this.lightCookieId = [];
    this.lightCookieIntId = [];
    this.lightCookieMatrixId = [];
    this.lightCookieOffsetId = [];
    this.lightShadowSearchAreaId = [];
    this.lightCameraParamsId = [];

    // shadow cascades
    this.shadowMatrixPaletteId = [];
    this.shadowCascadeDistancesId = [];
    this.shadowCascadeCountId = [];
    this.screenSizeId = scope.resolve('uScreenSize');
    this._screenSize = new Float32Array(4);
    this.fogColor = new Float32Array(3);
    this.ambientColor = new Float32Array(3);
    this.pcssDiskSamples = vogelDiskPrecalculationSamples(16);
    this.pcssSphereSamples = vogelSpherePrecalculationSamples(16);
  }
  destroy() {
    super.destroy();
  }

  // Static properties used by the Profiler in the Editor's Launch Page

  /**
   * @param {import('../scene.js').Scene} scene - The scene.
   */
  dispatchGlobalLights(scene) {
    this.ambientColor[0] = scene.ambientLight.r;
    this.ambientColor[1] = scene.ambientLight.g;
    this.ambientColor[2] = scene.ambientLight.b;
    if (scene.gammaCorrection) {
      for (let i = 0; i < 3; i++) {
        this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
      }
    }
    if (scene.physicalUnits) {
      for (let i = 0; i < 3; i++) {
        this.ambientColor[i] *= scene.ambientLuminance;
      }
    }
    this.ambientId.setValue(this.ambientColor);
    this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
    this.cubeMapRotationMatrixId.setValue(scene._skyboxRotationMat3.data);
  }
  _resolveLight(scope, i) {
    const light = 'light' + i;
    this.lightColorId[i] = scope.resolve(light + '_color');
    this.lightDir[i] = new Float32Array(3);
    this.lightDirId[i] = scope.resolve(light + '_direction');
    this.lightShadowMapId[i] = scope.resolve(light + '_shadowMap');
    this.lightShadowMatrixId[i] = scope.resolve(light + '_shadowMatrix');
    this.lightShadowParamsId[i] = scope.resolve(light + '_shadowParams');
    this.lightShadowIntensity[i] = scope.resolve(light + '_shadowIntensity');
    this.lightShadowSearchAreaId[i] = scope.resolve(light + '_shadowSearchArea');
    this.lightRadiusId[i] = scope.resolve(light + '_radius');
    this.lightPos[i] = new Float32Array(3);
    this.lightPosId[i] = scope.resolve(light + '_position');
    this.lightWidth[i] = new Float32Array(3);
    this.lightWidthId[i] = scope.resolve(light + '_halfWidth');
    this.lightHeight[i] = new Float32Array(3);
    this.lightHeightId[i] = scope.resolve(light + '_halfHeight');
    this.lightInAngleId[i] = scope.resolve(light + '_innerConeAngle');
    this.lightOutAngleId[i] = scope.resolve(light + '_outerConeAngle');
    this.lightCookieId[i] = scope.resolve(light + '_cookie');
    this.lightCookieIntId[i] = scope.resolve(light + '_cookieIntensity');
    this.lightCookieMatrixId[i] = scope.resolve(light + '_cookieMatrix');
    this.lightCookieOffsetId[i] = scope.resolve(light + '_cookieOffset');
    this.lightCameraParamsId[i] = scope.resolve(light + '_cameraParams');

    // shadow cascades
    this.shadowMatrixPaletteId[i] = scope.resolve(light + '_shadowMatrixPalette[0]');
    this.shadowCascadeDistancesId[i] = scope.resolve(light + '_shadowCascadeDistances[0]');
    this.shadowCascadeCountId[i] = scope.resolve(light + '_shadowCascadeCount');
  }
  setLTCDirectionalLight(wtm, cnt, dir, campos, far) {
    this.lightPos[cnt][0] = campos.x - dir.x * far;
    this.lightPos[cnt][1] = campos.y - dir.y * far;
    this.lightPos[cnt][2] = campos.z - dir.z * far;
    this.lightPosId[cnt].setValue(this.lightPos[cnt]);
    const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
    this.lightWidth[cnt][0] = hWidth.x * far;
    this.lightWidth[cnt][1] = hWidth.y * far;
    this.lightWidth[cnt][2] = hWidth.z * far;
    this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
    const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
    this.lightHeight[cnt][0] = hHeight.x * far;
    this.lightHeight[cnt][1] = hHeight.y * far;
    this.lightHeight[cnt][2] = hHeight.z * far;
    this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
  }
  dispatchDirectLights(dirs, scene, mask, camera) {
    let cnt = 0;
    const scope = this.device.scope;
    for (let i = 0; i < dirs.length; i++) {
      if (!(dirs[i].mask & mask)) continue;
      const directional = dirs[i];
      const wtm = directional._node.getWorldTransform();
      if (!this.lightColorId[cnt]) {
        this._resolveLight(scope, cnt);
      }
      this.lightColorId[cnt].setValue(scene.gammaCorrection ? directional._linearFinalColor : directional._finalColor);

      // Directional lights shine down the negative Y axis
      wtm.getY(directional._direction).mulScalar(-1);
      directional._direction.normalize();
      this.lightDir[cnt][0] = directional._direction.x;
      this.lightDir[cnt][1] = directional._direction.y;
      this.lightDir[cnt][2] = directional._direction.z;
      this.lightDirId[cnt].setValue(this.lightDir[cnt]);
      if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
        // non-punctual shape - NB directional area light specular is approximated by putting the area light at the far clip
        this.setLTCDirectionalLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
      }
      if (directional.castShadows) {
        const lightRenderData = directional.getRenderData(camera, 0);
        const biases = directional._getUniformBiasValues(lightRenderData);
        this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
        this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
        this.shadowMatrixPaletteId[cnt].setValue(directional._shadowMatrixPalette);
        this.shadowCascadeDistancesId[cnt].setValue(directional._shadowCascadeDistances);
        this.shadowCascadeCountId[cnt].setValue(directional.numCascades);
        this.lightShadowIntensity[cnt].setValue(directional.shadowIntensity);
        const pixelsPerMeter = 1.0 / (lightRenderData.shadowCamera.renderTarget.width / directional.penumbraSize);
        this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter);
        const cameraParams = directional._shadowCameraParams;
        cameraParams.length = 4;
        cameraParams[0] = lightRenderData.depthRangeCompensation;
        cameraParams[1] = lightRenderData.shadowCamera._farClip;
        cameraParams[2] = lightRenderData.shadowCamera._nearClip;
        cameraParams[3] = 1;
        this.lightCameraParamsId[cnt].setValue(cameraParams);
        const params = directional._shadowRenderParams;
        params.length = 4;
        params[0] = directional._shadowResolution; // Note: this needs to change for non-square shadow maps (2 cascades). Currently square is used
        params[1] = biases.normalBias;
        params[2] = biases.bias;
        params[3] = 0;
        this.lightShadowParamsId[cnt].setValue(params);
      }
      cnt++;
    }
    return cnt;
  }
  setLTCPositionalLight(wtm, cnt) {
    const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
    this.lightWidth[cnt][0] = hWidth.x;
    this.lightWidth[cnt][1] = hWidth.y;
    this.lightWidth[cnt][2] = hWidth.z;
    this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
    const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
    this.lightHeight[cnt][0] = hHeight.x;
    this.lightHeight[cnt][1] = hHeight.y;
    this.lightHeight[cnt][2] = hHeight.z;
    this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
  }
  dispatchOmniLight(scene, scope, omni, cnt) {
    const wtm = omni._node.getWorldTransform();
    if (!this.lightColorId[cnt]) {
      this._resolveLight(scope, cnt);
    }
    this.lightRadiusId[cnt].setValue(omni.attenuationEnd);
    this.lightColorId[cnt].setValue(scene.gammaCorrection ? omni._linearFinalColor : omni._finalColor);
    wtm.getTranslation(omni._position);
    this.lightPos[cnt][0] = omni._position.x;
    this.lightPos[cnt][1] = omni._position.y;
    this.lightPos[cnt][2] = omni._position.z;
    this.lightPosId[cnt].setValue(this.lightPos[cnt]);
    if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
      // non-punctual shape
      this.setLTCPositionalLight(wtm, cnt);
    }
    if (omni.castShadows) {
      // shadow map
      const lightRenderData = omni.getRenderData(null, 0);
      this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
      const biases = omni._getUniformBiasValues(lightRenderData);
      const params = omni._shadowRenderParams;
      params.length = 4;
      params[0] = omni._shadowResolution;
      params[1] = biases.normalBias;
      params[2] = biases.bias;
      params[3] = 1.0 / omni.attenuationEnd;
      this.lightShadowParamsId[cnt].setValue(params);
      this.lightShadowIntensity[cnt].setValue(omni.shadowIntensity);
      const pixelsPerMeter = 1.0 / (lightRenderData.shadowCamera.renderTarget.width / omni.penumbraSize);
      this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter);
      const cameraParams = omni._shadowCameraParams;
      cameraParams.length = 4;
      cameraParams[0] = 1;
      cameraParams[1] = lightRenderData.shadowCamera._farClip;
      cameraParams[2] = lightRenderData.shadowCamera._nearClip;
      cameraParams[3] = 0;
      this.lightCameraParamsId[cnt].setValue(cameraParams);
    }
    if (omni._cookie) {
      this.lightCookieId[cnt].setValue(omni._cookie);
      this.lightShadowMatrixId[cnt].setValue(wtm.data);
      this.lightCookieIntId[cnt].setValue(omni.cookieIntensity);
    }
  }
  dispatchSpotLight(scene, scope, spot, cnt) {
    const wtm = spot._node.getWorldTransform();
    if (!this.lightColorId[cnt]) {
      this._resolveLight(scope, cnt);
    }
    this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
    this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
    this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
    this.lightColorId[cnt].setValue(scene.gammaCorrection ? spot._linearFinalColor : spot._finalColor);
    wtm.getTranslation(spot._position);
    this.lightPos[cnt][0] = spot._position.x;
    this.lightPos[cnt][1] = spot._position.y;
    this.lightPos[cnt][2] = spot._position.z;
    this.lightPosId[cnt].setValue(this.lightPos[cnt]);
    if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
      // non-punctual shape
      this.setLTCPositionalLight(wtm, cnt);
    }

    // Spots shine down the negative Y axis
    wtm.getY(spot._direction).mulScalar(-1);
    spot._direction.normalize();
    this.lightDir[cnt][0] = spot._direction.x;
    this.lightDir[cnt][1] = spot._direction.y;
    this.lightDir[cnt][2] = spot._direction.z;
    this.lightDirId[cnt].setValue(this.lightDir[cnt]);
    if (spot.castShadows) {
      // shadow map
      const lightRenderData = spot.getRenderData(null, 0);
      this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
      this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
      const biases = spot._getUniformBiasValues(lightRenderData);
      const params = spot._shadowRenderParams;
      params.length = 4;
      params[0] = spot._shadowResolution;
      params[1] = biases.normalBias;
      params[2] = biases.bias;
      params[3] = 1.0 / spot.attenuationEnd;
      this.lightShadowParamsId[cnt].setValue(params);
      this.lightShadowIntensity[cnt].setValue(spot.shadowIntensity);
      const pixelsPerMeter = 1.0 / (lightRenderData.shadowCamera.renderTarget.width / spot.penumbraSize);
      const fov = lightRenderData.shadowCamera._fov * Math.PI / 180.0;
      const fovRatio = 1.0 / Math.tan(fov / 2.0);
      this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter * fovRatio);
      const cameraParams = spot._shadowCameraParams;
      cameraParams.length = 4;
      cameraParams[0] = 1;
      cameraParams[1] = lightRenderData.shadowCamera._farClip;
      cameraParams[2] = lightRenderData.shadowCamera._nearClip;
      cameraParams[3] = 0;
      this.lightCameraParamsId[cnt].setValue(cameraParams);
    }
    if (spot._cookie) {
      // if shadow is not rendered, we need to evaluate light projection matrix
      if (!spot.castShadows) {
        const cookieMatrix = LightCamera.evalSpotCookieMatrix(spot);
        this.lightShadowMatrixId[cnt].setValue(cookieMatrix.data);
      }
      this.lightCookieId[cnt].setValue(spot._cookie);
      this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
      if (spot._cookieTransform) {
        spot._cookieTransformUniform[0] = spot._cookieTransform.x;
        spot._cookieTransformUniform[1] = spot._cookieTransform.y;
        spot._cookieTransformUniform[2] = spot._cookieTransform.z;
        spot._cookieTransformUniform[3] = spot._cookieTransform.w;
        this.lightCookieMatrixId[cnt].setValue(spot._cookieTransformUniform);
        spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
        spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
        this.lightCookieOffsetId[cnt].setValue(spot._cookieOffsetUniform);
      }
    }
  }
  dispatchLocalLights(sortedLights, scene, mask, usedDirLights, staticLightList) {
    let cnt = usedDirLights;
    const scope = this.device.scope;
    const omnis = sortedLights[LIGHTTYPE_OMNI];
    const numOmnis = omnis.length;
    for (let i = 0; i < numOmnis; i++) {
      const omni = omnis[i];
      if (!(omni.mask & mask)) continue;
      if (omni.isStatic) continue;
      this.dispatchOmniLight(scene, scope, omni, cnt);
      cnt++;
    }
    let staticId = 0;
    if (staticLightList) {
      let omni = staticLightList[staticId];
      while (omni && omni._type === LIGHTTYPE_OMNI) {
        this.dispatchOmniLight(scene, scope, omni, cnt);
        cnt++;
        staticId++;
        omni = staticLightList[staticId];
      }
    }
    const spts = sortedLights[LIGHTTYPE_SPOT];
    const numSpts = spts.length;
    for (let i = 0; i < numSpts; i++) {
      const spot = spts[i];
      if (!(spot.mask & mask)) continue;
      if (spot.isStatic) continue;
      this.dispatchSpotLight(scene, scope, spot, cnt);
      cnt++;
    }
    if (staticLightList) {
      let spot = staticLightList[staticId];
      while (spot && spot._type === LIGHTTYPE_SPOT) {
        this.dispatchSpotLight(scene, scope, spot, cnt);
        cnt++;
        staticId++;
        spot = staticLightList[staticId];
      }
    }
  }

  // execute first pass over draw calls, in order to update materials / shaders
  // TODO: implement this: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#compile_shaders_and_link_programs_in_parallel
  // where instead of compiling and linking shaders, which is serial operation, we compile all of them and then link them, allowing the work to
  // take place in parallel
  renderForwardPrepareMaterials(camera, drawCalls, drawCallsCount, sortedLights, cullingMask, layer, pass) {
    const addCall = (drawCall, isNewMaterial, lightMaskChanged) => {
      _drawCallList.drawCalls.push(drawCall);
      _drawCallList.isNewMaterial.push(isNewMaterial);
      _drawCallList.lightMaskChanged.push(lightMaskChanged);
    };

    // start with empty arrays
    _drawCallList.clear();
    const device = this.device;
    const scene = this.scene;
    const lightHash = layer ? layer._lightHash : 0;
    let prevMaterial = null,
      prevObjDefs,
      prevStatic,
      prevLightMask;
    for (let i = 0; i < drawCallsCount; i++) {
      /** @type {import('../mesh-instance.js').MeshInstance} */
      const drawCall = drawCalls[i];

      // apply visibility override
      if (cullingMask && drawCall.mask && !(cullingMask & drawCall.mask)) continue;
      if (drawCall.command) {
        addCall(drawCall, false, false);
      } else {
        if (camera === ForwardRenderer.skipRenderCamera) {
          if (ForwardRenderer._skipRenderCounter >= ForwardRenderer.skipRenderAfter) continue;
          ForwardRenderer._skipRenderCounter++;
        }
        if (layer) {
          if (layer._skipRenderCounter >= layer.skipRenderAfter) continue;
          layer._skipRenderCounter++;
        }
        drawCall.ensureMaterial(device);
        const material = drawCall.material;
        const objDefs = drawCall._shaderDefs;
        const lightMask = drawCall.mask;
        if (material && material === prevMaterial && objDefs !== prevObjDefs) {
          prevMaterial = null; // force change shader if the object uses a different variant of the same material
        }

        if (drawCall.isStatic || prevStatic) {
          prevMaterial = null;
        }
        if (material !== prevMaterial) {
          this._materialSwitches++;
          material._scene = scene;
          if (material.dirty) {
            material.updateUniforms(device, scene);
            material.dirty = false;
          }

          // if material has dirtyBlend set, notify scene here
          if (material._dirtyBlend) {
            scene.layers._dirtyBlend = true;
          }
        }
        if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs || drawCall._lightHash !== lightHash) {
          // marker to allow us to see the source node for shader alloc
          DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);

          // draw calls not using static lights use variants cache on material to quickly find the shader, as they are all
          // the same for the same pass, using all lights of the scene
          if (!drawCall.isStatic) {
            const variantKey = pass + '_' + objDefs + '_' + lightHash;
            drawCall._shader[pass] = material.variants[variantKey];
            if (!drawCall._shader[pass]) {
              drawCall.updatePassShader(scene, pass, null, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
              material.variants[variantKey] = drawCall._shader[pass];
            }
          } else {
            // static lights generate unique shader per draw call, as static lights are unique per draw call,
            // and so variants cache is not used
            drawCall.updatePassShader(scene, pass, drawCall._staticLightList, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
          }
          drawCall._lightHash = lightHash;
          DebugGraphics.popGpuMarker(device);
        }
        Debug.assert(drawCall._shader[pass], "no shader for pass", material);
        addCall(drawCall, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);
        prevMaterial = material;
        prevObjDefs = objDefs;
        prevLightMask = lightMask;
        prevStatic = drawCall.isStatic;
      }
    }

    // process the batch of shaders created here
    device.endShaderBatch == null ? void 0 : device.endShaderBatch();
    return _drawCallList;
  }
  renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
    const device = this.device;
    const scene = this.scene;
    const passFlag = 1 << pass;
    const flipFactor = flipFaces ? -1 : 1;
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;

    // Render the scene
    let skipMaterial = false;
    const preparedCallsCount = preparedCalls.drawCalls.length;
    for (let i = 0; i < preparedCallsCount; i++) {
      const drawCall = preparedCalls.drawCalls[i];
      if (drawCall.command) {
        // We have a command
        drawCall.command();
      } else {
        var _drawCall$stencilFron, _drawCall$stencilBack;
        // We have a mesh instance
        const newMaterial = preparedCalls.isNewMaterial[i];
        const lightMaskChanged = preparedCalls.lightMaskChanged[i];
        const material = drawCall.material;
        const objDefs = drawCall._shaderDefs;
        const lightMask = drawCall.mask;
        if (newMaterial) {
          const shader = drawCall._shader[pass];
          if (!shader.failed && !device.setShader(shader)) {
            Debug.error(`Error compiling shader [${shader.label}] for material=${material.name} pass=${pass} objDefs=${objDefs}`, material);
          }

          // skip rendering with the material if shader failed
          skipMaterial = shader.failed;
          if (skipMaterial) break;
          DebugGraphics.pushGpuMarker(device, `Material: ${material.name}`);

          // Uniforms I: material
          material.setParameters(device);
          if (lightMaskChanged) {
            const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
            if (!clusteredLightingEnabled) {
              this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
            }
          }
          this.alphaTestId.setValue(material.alphaTest);
          device.setBlendState(material.blendState);
          device.setDepthState(material.depthState);
          device.setAlphaToCoverage(material.alphaToCoverage);
          if (material.depthBias || material.slopeDepthBias) {
            device.setDepthBias(true);
            device.setDepthBiasValues(material.depthBias, material.slopeDepthBias);
          } else {
            device.setDepthBias(false);
          }
          DebugGraphics.popGpuMarker(device);
        }
        DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);
        this.setupCullMode(camera._cullFaces, flipFactor, drawCall);
        const stencilFront = (_drawCall$stencilFron = drawCall.stencilFront) != null ? _drawCall$stencilFron : material.stencilFront;
        const stencilBack = (_drawCall$stencilBack = drawCall.stencilBack) != null ? _drawCall$stencilBack : material.stencilBack;
        device.setStencilState(stencilFront, stencilBack);
        const mesh = drawCall.mesh;

        // Uniforms II: meshInstance overrides
        drawCall.setParameters(device, passFlag);
        this.setVertexBuffers(device, mesh);
        this.setMorphing(device, drawCall.morphInstance);
        this.setSkinning(device, drawCall);
        this.setupMeshUniformBuffers(drawCall, pass);
        const style = drawCall.renderStyle;
        device.setIndexBuffer(mesh.indexBuffer[style]);
        drawCallback == null ? void 0 : drawCallback(drawCall, i);
        if (camera.xr && camera.xr.session && camera.xr.views.length) {
          const views = camera.xr.views;
          for (let v = 0; v < views.length; v++) {
            const view = views[v];
            device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);
            this.projId.setValue(view.projMat.data);
            this.projSkyboxId.setValue(view.projMat.data);
            this.viewId.setValue(view.viewOffMat.data);
            this.viewInvId.setValue(view.viewInvOffMat.data);
            this.viewId3.setValue(view.viewMat3.data);
            this.viewProjId.setValue(view.projViewOffMat.data);
            this.viewPosId.setValue(view.position);
            if (v === 0) {
              this.drawInstance(device, drawCall, mesh, style, true);
            } else {
              this.drawInstance2(device, drawCall, mesh, style);
            }
            this._forwardDrawCalls++;
          }
        } else {
          this.drawInstance(device, drawCall, mesh, style, true);
          this._forwardDrawCalls++;
        }

        // Unset meshInstance overrides back to material values if next draw call will use the same material
        if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
          material.setParameters(device, drawCall.parameters);
        }
        DebugGraphics.popGpuMarker(device);
      }
    }
  }
  renderForward(camera, allDrawCalls, allDrawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer, flipFaces) {
    const forwardStartTime = now();

    // run first pass over draw calls and handle material / shader updates
    const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, allDrawCallsCount, sortedLights, cullingMask, layer, pass);

    // render mesh instances
    this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
    _drawCallList.clear();
    this._forwardTime += now() - forwardStartTime;
  }
  setSceneConstants() {
    const scene = this.scene;

    // Set up ambient/exposure
    this.dispatchGlobalLights(scene);

    // Set up the fog
    if (scene.fog !== FOG_NONE) {
      this.fogColor[0] = scene.fogColor.r;
      this.fogColor[1] = scene.fogColor.g;
      this.fogColor[2] = scene.fogColor.b;
      if (scene.gammaCorrection) {
        for (let i = 0; i < 3; i++) {
          this.fogColor[i] = Math.pow(this.fogColor[i], 2.2);
        }
      }
      this.fogColorId.setValue(this.fogColor);
      if (scene.fog === FOG_LINEAR) {
        this.fogStartId.setValue(scene.fogStart);
        this.fogEndId.setValue(scene.fogEnd);
      } else {
        this.fogDensityId.setValue(scene.fogDensity);
      }
    }

    // Set up screen size // should be RT size?
    const device = this.device;
    this._screenSize[0] = device.width;
    this._screenSize[1] = device.height;
    this._screenSize[2] = 1 / device.width;
    this._screenSize[3] = 1 / device.height;
    this.screenSizeId.setValue(this._screenSize);
    this.pcssDiskSamplesId.setValue(this.pcssDiskSamples);
    this.pcssSphereSamplesId.setValue(this.pcssSphereSamples);
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   * @param {number} compUpdatedFlags - Flags of what was updated.
   */
  updateLightStats(comp, compUpdatedFlags) {
    const scene = this.scene;
    if (compUpdatedFlags & COMPUPDATED_LIGHTS || !scene._statsUpdated) {
      const stats = scene._stats;
      stats.lights = comp._lights.length;
      stats.dynamicLights = 0;
      stats.bakedLights = 0;
      for (let i = 0; i < stats.lights; i++) {
        const l = comp._lights[i];
        if (l.enabled) {
          if (l.mask & MASK_AFFECT_DYNAMIC || l.mask & MASK_AFFECT_LIGHTMAPPED) {
            // if affects dynamic or baked objects in real-time
            stats.dynamicLights++;
          }
          if (l.mask & MASK_BAKE) {
            // if baked into lightmaps
            stats.bakedLights++;
          }
        }
      }
    }
    if (compUpdatedFlags & COMPUPDATED_INSTANCES || !scene._statsUpdated) {
      scene._stats.meshInstances = comp._meshInstances.length;
    }
    scene._statsUpdated = true;
  }

  /**
   * Builds a frame graph for the rendering of the whole frame.
   *
   * @param {import('../frame-graph.js').FrameGraph} frameGraph - The frame-graph that is built.
   * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
   * layer composition used to build the frame graph.
   * @ignore
   */
  buildFrameGraph(frameGraph, layerComposition) {
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    frameGraph.reset();
    this.update(layerComposition);

    // clustered lighting render passes
    if (clusteredLightingEnabled) {
      // cookies
      {
        const renderPass = new RenderPass(this.device, () => {
          // render cookies for all local visible lights
          if (this.scene.lighting.cookiesEnabled) {
            this.renderCookies(layerComposition._splitLights[LIGHTTYPE_SPOT]);
            this.renderCookies(layerComposition._splitLights[LIGHTTYPE_OMNI]);
          }
        });
        renderPass.requiresCubemaps = false;
        DebugHelper.setName(renderPass, 'ClusteredCookies');
        frameGraph.addRenderPass(renderPass);
      }

      // local shadows - these are shared by all cameras (not entirely correctly)
      {
        const renderPass = new RenderPass(this.device);
        DebugHelper.setName(renderPass, 'ClusteredLocalShadows');
        renderPass.requiresCubemaps = false;
        frameGraph.addRenderPass(renderPass);

        // render shadows only when needed
        if (this.scene.lighting.shadowsEnabled) {
          const splitLights = layerComposition._splitLights;
          this._shadowRendererLocal.prepareClusteredRenderPass(renderPass, splitLights[LIGHTTYPE_SPOT], splitLights[LIGHTTYPE_OMNI]);
        }

        // update clusters all the time
        renderPass.after = () => {
          this.updateClusters(layerComposition);
        };
      }
    } else {
      // non-clustered local shadows - these are shared by all cameras (not entirely correctly)
      const splitLights = layerComposition._splitLights;
      this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, splitLights[LIGHTTYPE_SPOT], splitLights[LIGHTTYPE_OMNI]);
    }

    // main passes
    let startIndex = 0;
    let newStart = true;
    let renderTarget = null;
    const renderActions = layerComposition._renderActions;
    for (let i = startIndex; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const layer = layerComposition.layerList[renderAction.layerIndex];
      const camera = layer.cameras[renderAction.cameraIndex];

      // skip disabled layers
      if (!renderAction.isLayerEnabled(layerComposition)) {
        continue;
      }
      const isDepthLayer = layer.id === LAYERID_DEPTH;
      const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

      // directional shadows get re-rendered for each camera
      if (renderAction.hasDirectionalShadowLights && camera) {
        this._shadowRendererDirectional.buildFrameGraph(frameGraph, renderAction, camera);
      }

      // start of block of render actions rendering to the same render target
      if (newStart) {
        newStart = false;
        startIndex = i;
        renderTarget = renderAction.renderTarget;
      }

      // find the next enabled render action
      let nextIndex = i + 1;
      while (renderActions[nextIndex] && !renderActions[nextIndex].isLayerEnabled(layerComposition)) {
        nextIndex++;
      }

      // info about the next render action
      const nextRenderAction = renderActions[nextIndex];
      const isNextLayerDepth = nextRenderAction ? layerComposition.layerList[nextRenderAction.layerIndex].id === LAYERID_DEPTH : false;
      const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

      // end of the block using the same render target
      if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget || nextRenderAction.hasDirectionalShadowLights || isNextLayerGrabPass || isGrabPass) {
        // render the render actions in the range
        this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i, isGrabPass);

        // postprocessing
        if (renderAction.triggerPostprocess && camera != null && camera.onPostprocessing) {
          const renderPass = new RenderPass(this.device, () => {
            this.renderPassPostprocessing(renderAction, layerComposition);
          });
          renderPass.requiresCubemaps = false;
          DebugHelper.setName(renderPass, `Postprocess`);
          frameGraph.addRenderPass(renderPass);
        }
        newStart = true;
      }
    }
  }

  /**
   * @param {import('../frame-graph.js').FrameGraph} frameGraph - The frame graph.
   * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
   * layer composition.
   */
  addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex, isGrabPass) {
    // render the render actions in the range
    const range = {
      start: startIndex,
      end: endIndex
    };
    const renderPass = new RenderPass(this.device, () => {
      this.renderPassRenderActions(layerComposition, range);
    });
    const renderActions = layerComposition._renderActions;
    const startRenderAction = renderActions[startIndex];
    const endRenderAction = renderActions[endIndex];
    const startLayer = layerComposition.layerList[startRenderAction.layerIndex];
    const camera = startLayer.cameras[startRenderAction.cameraIndex];
    if (camera) {
      // callback on the camera component before rendering with this camera for the first time
      if (startRenderAction.firstCameraUse && camera.onPreRender) {
        renderPass.before = () => {
          camera.onPreRender();
        };
      }

      // callback on the camera component when we're done rendering with this camera
      if (endRenderAction.lastCameraUse && camera.onPostRender) {
        renderPass.after = () => {
          camera.onPostRender();
        };
      }
    }

    // depth grab pass on webgl1 is normal render pass (scene gets re-rendered)
    const grabPassRequired = isGrabPass && SceneGrab.requiresRenderPass(this.device, camera);
    const isRealPass = !isGrabPass || grabPassRequired;
    if (isRealPass) {
      renderPass.init(renderTarget);
      renderPass.fullSizeClearRect = camera.camera.fullSizeClearRect;
      if (grabPassRequired) {
        // webgl1 depth rendering clear values
        renderPass.setClearColor(webgl1DepthClearColor);
        renderPass.setClearDepth(1.0);
      } else if (renderPass.fullSizeClearRect) {
        // if camera rendering covers the full viewport

        if (startRenderAction.clearColor) {
          renderPass.setClearColor(camera.camera.clearColor);
        }
        if (startRenderAction.clearDepth) {
          renderPass.setClearDepth(camera.camera.clearDepth);
        }
        if (startRenderAction.clearStencil) {
          renderPass.setClearStencil(camera.camera.clearStencil);
        }
      }
    }
    DebugHelper.setName(renderPass, `${isGrabPass ? 'SceneGrab' : 'RenderAction'} ${startIndex}-${endIndex} ` + `Cam: ${camera ? camera.entity.name : '-'}`);
    frameGraph.addRenderPass(renderPass);
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  update(comp) {
    this.frameUpdate();
    this.shadowRenderer.frameUpdate();
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;

    // update the skybox, since this might change _meshInstances
    this.scene._updateSky(this.device);

    // update layer composition if something has been invalidated
    const updated = this.updateLayerComposition(comp, clusteredLightingEnabled);
    const lightsChanged = (updated & COMPUPDATED_LIGHTS) !== 0;
    this.updateLightStats(comp, updated);

    // Single per-frame calculations
    this.beginFrame(comp, lightsChanged);
    this.setSceneConstants();

    // visibility culling of lights, meshInstances, shadows casters
    // after this the scene culling is done and script callbacks can be called to report which objects are visible
    this.cullComposition(comp);

    // GPU update for all visible objects
    this.gpuUpdate(comp._meshInstances);
  }
  renderPassPostprocessing(renderAction, layerComposition) {
    const layer = layerComposition.layerList[renderAction.layerIndex];
    const camera = layer.cameras[renderAction.cameraIndex];
    Debug.assert(renderAction.triggerPostprocess && camera.onPostprocessing);

    // trigger postprocessing for camera
    camera.onPostprocessing();
  }

  /**
   * Render pass representing the layer composition's render actions in the specified range.
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition to render.
   * @ignore
   */
  renderPassRenderActions(comp, range) {
    const renderActions = comp._renderActions;
    for (let i = range.start; i <= range.end; i++) {
      this.renderRenderAction(comp, renderActions[i], i === range.start);
    }
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   * @param {import('../composition/render-action.js').RenderAction} renderAction - The render
   * action.
   * @param {boolean} firstRenderAction - True if this is the first render action in the render pass.
   */
  renderRenderAction(comp, renderAction, firstRenderAction) {
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    const device = this.device;

    // layer
    const layerIndex = renderAction.layerIndex;
    const layer = comp.layerList[layerIndex];
    const transparent = comp.subLayerList[layerIndex];
    const cameraPass = renderAction.cameraIndex;
    const camera = layer.cameras[cameraPass];
    if (!renderAction.isLayerEnabled(comp)) {
      return;
    }
    DebugGraphics.pushGpuMarker(this.device, camera ? camera.entity.name : 'noname');
    DebugGraphics.pushGpuMarker(this.device, layer.name);
    const drawTime = now();

    // Call prerender callback if there's one
    if (!transparent && layer.onPreRenderOpaque) {
      layer.onPreRenderOpaque(cameraPass);
    } else if (transparent && layer.onPreRenderTransparent) {
      layer.onPreRenderTransparent(cameraPass);
    }

    // Called for the first sublayer and for every camera
    if (!(layer._preRenderCalledForCameras & 1 << cameraPass)) {
      if (layer.onPreRender) {
        layer.onPreRender(cameraPass);
      }
      layer._preRenderCalledForCameras |= 1 << cameraPass;
    }
    if (camera) {
      var _renderAction$renderT, _camera$camera$shader, _camera$camera$shader2;
      this.setupViewport(camera.camera, renderAction.renderTarget);

      // if this is not a first render action to the render target, or if the render target was not
      // fully cleared on pass start, we need to execute clears here
      if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
        this.clear(camera.camera, renderAction.clearColor, renderAction.clearDepth, renderAction.clearStencil);
      }
      const sortTime = now();
      layer._sortVisible(transparent, camera.camera.node, cameraPass);
      this._sortTime += now() - sortTime;
      const objects = layer.instances;
      const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

      // add debug mesh instances to visible list
      this.scene.immediate.onPreRenderLayer(layer, visible, transparent);

      // upload clustered lights uniforms
      if (clusteredLightingEnabled && renderAction.lightClusters) {
        renderAction.lightClusters.activate();

        // debug rendering of clusters
        if (!this.clustersDebugRendered && this.scene.lighting.debugLayer === layer.id) {
          this.clustersDebugRendered = true;
          WorldClustersDebug.render(renderAction.lightClusters, this.scene);
        }
      }

      // Set the not very clever global variable which is only useful when there's just one camera
      this.scene._activeCamera = camera.camera;
      const viewCount = this.setCameraUniforms(camera.camera, renderAction.renderTarget);
      if (device.supportsUniformBuffers) {
        this.setupViewUniformBuffers(renderAction.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, viewCount);
      }

      // enable flip faces if either the camera has _flipFaces enabled or the render target
      // has flipY enabled
      const flipFaces = !!(camera.camera._flipFaces ^ (renderAction == null ? void 0 : (_renderAction$renderT = renderAction.renderTarget) == null ? void 0 : _renderAction$renderT.flipY));

      // shader pass - use setting from camera if available, otherwise use layer setting
      const shaderPass = (_camera$camera$shader = (_camera$camera$shader2 = camera.camera.shaderPassInfo) == null ? void 0 : _camera$camera$shader2.index) != null ? _camera$camera$shader : layer.shaderPass;
      const draws = this._forwardDrawCalls;
      this.renderForward(camera.camera, visible.list, visible.length, layer._splitLights, shaderPass, layer.cullingMask, layer.onDrawCall, layer, flipFaces);
      layer._forwardDrawCalls += this._forwardDrawCalls - draws;

      // Revert temp frame stuff
      // TODO: this should not be here, as each rendering / clearing should explicitly set up what
      // it requires (the properties are part of render pipeline on WebGPU anyways)
      device.setBlendState(BlendState.NOBLEND);
      device.setStencilState(null, null);
      device.setAlphaToCoverage(false); // don't leak a2c state
      device.setDepthBias(false);
    }

    // Call layer's postrender callback if there's one
    if (!transparent && layer.onPostRenderOpaque) {
      layer.onPostRenderOpaque(cameraPass);
    } else if (transparent && layer.onPostRenderTransparent) {
      layer.onPostRenderTransparent(cameraPass);
    }
    if (layer.onPostRender && !(layer._postRenderCalledForCameras & 1 << cameraPass)) {
      layer._postRenderCounter &= ~(transparent ? 2 : 1);
      if (layer._postRenderCounter === 0) {
        layer.onPostRender(cameraPass);
        layer._postRenderCalledForCameras |= 1 << cameraPass;
        layer._postRenderCounter = layer._postRenderCounterMax;
      }
    }
    DebugGraphics.popGpuMarker(this.device);
    DebugGraphics.popGpuMarker(this.device);
    layer._renderTime += now() - drawTime;
  }
}
ForwardRenderer.skipRenderCamera = null;
ForwardRenderer._skipRenderCounter = 0;
ForwardRenderer.skipRenderAfter = 0;

export { ForwardRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJztcblxuaW1wb3J0IHtcbiAgICBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBGT0dfTk9ORSwgRk9HX0xJTkVBUixcbiAgICBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0JBS0UsXG4gICAgTEFZRVJJRF9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyc7XG5cbmNvbnN0IHdlYmdsMURlcHRoQ2xlYXJDb2xvciA9IG5ldyBDb2xvcigyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSk7XG5cbmNvbnN0IF9kcmF3Q2FsbExpc3QgPSB7XG4gICAgZHJhd0NhbGxzOiBbXSxcbiAgICBpc05ld01hdGVyaWFsOiBbXSxcbiAgICBsaWdodE1hc2tDaGFuZ2VkOiBbXSxcblxuICAgIGNsZWFyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZHJhd0NhbGxzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuaXNOZXdNYXRlcmlhbC5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmxpZ2h0TWFza0NoYW5nZWQubGVuZ3RoID0gMDtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiB2b2dlbERpc2tQcmVjYWxjdWxhdGlvblNhbXBsZXMobnVtU2FtcGxlcykge1xuICAgIGNvbnN0IHNhbXBsZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBjb25zdCByID0gTWF0aC5zcXJ0KGkgKyAwLjUpIC8gTWF0aC5zcXJ0KG51bVNhbXBsZXMpO1xuICAgICAgICBzYW1wbGVzLnB1c2gocik7XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVzO1xufVxuXG5mdW5jdGlvbiB2b2dlbFNwaGVyZVByZWNhbGN1bGF0aW9uU2FtcGxlcyhudW1TYW1wbGVzKSB7XG4gICAgY29uc3Qgc2FtcGxlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHdlaWdodCA9IGkgLyBudW1TYW1wbGVzO1xuICAgICAgICBjb25zdCByYWRpdXMgPSBNYXRoLnNxcnQoMS4wIC0gd2VpZ2h0ICogd2VpZ2h0KTtcbiAgICAgICAgc2FtcGxlcy5wdXNoKHJhZGl1cyk7XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVzO1xufVxuXG4vKipcbiAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyIHJlbmRlcnMge0BsaW5rIFNjZW5lfXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBGb3J3YXJkUmVuZGVyZXIgZXh0ZW5kcyBSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEZvcndhcmRSZW5kZXJlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5fZGVwdGhNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9zb3J0VGltZSA9IDA7XG5cbiAgICAgICAgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBkZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvcklkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2NvbG9yJyk7XG4gICAgICAgIHRoaXMuZm9nU3RhcnRJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19zdGFydCcpO1xuICAgICAgICB0aGlzLmZvZ0VuZElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2VuZCcpO1xuICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19kZW5zaXR5Jyk7XG5cbiAgICAgICAgdGhpcy5hbWJpZW50SWQgPSBzY29wZS5yZXNvbHZlKCdsaWdodF9nbG9iYWxBbWJpZW50Jyk7XG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQgPSBzY29wZS5yZXNvbHZlKCdza3lib3hJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5jdWJlTWFwUm90YXRpb25NYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ2N1YmVNYXBSb3RhdGlvbk1hdHJpeCcpO1xuICAgICAgICB0aGlzLnBjc3NEaXNrU2FtcGxlc0lkID0gc2NvcGUucmVzb2x2ZSgncGNzc0Rpc2tTYW1wbGVzWzBdJyk7XG4gICAgICAgIHRoaXMucGNzc1NwaGVyZVNhbXBsZXNJZCA9IHNjb3BlLnJlc29sdmUoJ3Bjc3NTcGhlcmVTYW1wbGVzWzBdJyk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkID0gW107XG4gICAgICAgIHRoaXMubGlnaHREaXIgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodERpcklkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHkgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRQb3MgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0ID0gW107XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU1hdHJpeElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVPZmZzZXRJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93U2VhcmNoQXJlYUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDYW1lcmFQYXJhbXNJZCA9IFtdO1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXNjYWRlc1xuICAgICAgICB0aGlzLnNoYWRvd01hdHJpeFBhbGV0dGVJZCA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZCA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVDb3VudElkID0gW107XG5cbiAgICAgICAgdGhpcy5zY3JlZW5TaXplSWQgPSBzY29wZS5yZXNvbHZlKCd1U2NyZWVuU2l6ZScpO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICB0aGlzLmZvZ0NvbG9yID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMucGNzc0Rpc2tTYW1wbGVzID0gdm9nZWxEaXNrUHJlY2FsY3VsYXRpb25TYW1wbGVzKDE2KTtcbiAgICAgICAgdGhpcy5wY3NzU3BoZXJlU2FtcGxlcyA9IHZvZ2VsU3BoZXJlUHJlY2FsY3VsYXRpb25TYW1wbGVzKDE2KTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgIC8vIFN0YXRpYyBwcm9wZXJ0aWVzIHVzZWQgYnkgdGhlIFByb2ZpbGVyIGluIHRoZSBFZGl0b3IncyBMYXVuY2ggUGFnZVxuICAgIHN0YXRpYyBza2lwUmVuZGVyQ2FtZXJhID0gbnVsbDtcblxuICAgIHN0YXRpYyBfc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgc3RhdGljIHNraXBSZW5kZXJBZnRlciA9IDA7XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICovXG4gICAgZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpIHtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMF0gPSBzY2VuZS5hbWJpZW50TGlnaHQucjtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMV0gPSBzY2VuZS5hbWJpZW50TGlnaHQuZztcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMl0gPSBzY2VuZS5hbWJpZW50TGlnaHQuYjtcbiAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFtYmllbnRDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuYW1iaWVudENvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzY2VuZS5waHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldICo9IHNjZW5lLmFtYmllbnRMdW1pbmFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hbWJpZW50SWQuc2V0VmFsdWUodGhpcy5hbWJpZW50Q29sb3IpO1xuXG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUucGh5c2ljYWxVbml0cyA/IHNjZW5lLnNreWJveEx1bWluYW5jZSA6IHNjZW5lLnNreWJveEludGVuc2l0eSk7XG4gICAgICAgIHRoaXMuY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQuc2V0VmFsdWUoc2NlbmUuX3NreWJveFJvdGF0aW9uTWF0My5kYXRhKTtcbiAgICB9XG5cbiAgICBfcmVzb2x2ZUxpZ2h0KHNjb3BlLCBpKSB7XG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gJ2xpZ2h0JyArIGk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29sb3InKTtcbiAgICAgICAgdGhpcy5saWdodERpcltpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHREaXJJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2RpcmVjdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXAnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4Jyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd1BhcmFtcycpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dTZWFyY2hBcmVhSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dTZWFyY2hBcmVhJyk7XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3JhZGl1cycpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcG9zaXRpb24nKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19oYWxmV2lkdGgnKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZIZWlnaHQnKTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2lubmVyQ29uZUFuZ2xlJyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfb3V0ZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llJyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZUludGVuc2l0eScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llT2Zmc2V0Jyk7XG4gICAgICAgIHRoaXMubGlnaHRDYW1lcmFQYXJhbXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2NhbWVyYVBhcmFtcycpO1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXNjYWRlc1xuICAgICAgICB0aGlzLnNoYWRvd01hdHJpeFBhbGV0dGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd01hdHJpeFBhbGV0dGVbMF0nKTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dDYXNjYWRlRGlzdGFuY2VzWzBdJyk7XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dDYXNjYWRlQ291bnQnKTtcbiAgICB9XG5cbiAgICBzZXRMVENEaXJlY3Rpb25hbExpZ2h0KHd0bSwgY250LCBkaXIsIGNhbXBvcywgZmFyKSB7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IGNhbXBvcy54IC0gZGlyLnggKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IGNhbXBvcy55IC0gZGlyLnkgKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IGNhbXBvcy56IC0gZGlyLnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgY29uc3QgaFdpZHRoID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygtMC41LCAwLCAwKSk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzBdID0gaFdpZHRoLnggKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzFdID0gaFdpZHRoLnkgKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzJdID0gaFdpZHRoLnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFdpZHRoW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhIZWlnaHQgPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKDAsIDAsIDAuNSkpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMF0gPSBoSGVpZ2h0LnggKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsxXSA9IGhIZWlnaHQueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzJdID0gaEhlaWdodC56ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0SGVpZ2h0W2NudF0pO1xuICAgIH1cblxuICAgIGRpc3BhdGNoRGlyZWN0TGlnaHRzKGRpcnMsIHNjZW5lLCBtYXNrLCBjYW1lcmEpIHtcbiAgICAgICAgbGV0IGNudCA9IDA7XG5cbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghKGRpcnNbaV0ubWFzayAmIG1hc2spKSBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3QgZGlyZWN0aW9uYWwgPSBkaXJzW2ldO1xuICAgICAgICAgICAgY29uc3Qgd3RtID0gZGlyZWN0aW9uYWwuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IGRpcmVjdGlvbmFsLl9saW5lYXJGaW5hbENvbG9yIDogZGlyZWN0aW9uYWwuX2ZpbmFsQ29sb3IpO1xuXG4gICAgICAgICAgICAvLyBEaXJlY3Rpb25hbCBsaWdodHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgICAgICB3dG0uZ2V0WShkaXJlY3Rpb25hbC5fZGlyZWN0aW9uKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICAgICAgZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJbY250XVswXSA9IGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24ueDtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJbY250XVsxXSA9IGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24ueTtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJbY250XVsyXSA9IGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24uejtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHREaXJbY250XSk7XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb25hbC5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZSAtIE5CIGRpcmVjdGlvbmFsIGFyZWEgbGlnaHQgc3BlY3VsYXIgaXMgYXBwcm94aW1hdGVkIGJ5IHB1dHRpbmcgdGhlIGFyZWEgbGlnaHQgYXQgdGhlIGZhciBjbGlwXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRMVENEaXJlY3Rpb25hbExpZ2h0KHd0bSwgY250LCBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLCBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKSwgY2FtZXJhLmZhckNsaXApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uYWwuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGRpcmVjdGlvbmFsLmdldFJlbmRlckRhdGEoY2FtZXJhLCAwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBkaXJlY3Rpb25hbC5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd01hdHJpeFBhbGV0dGVJZFtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLl9zaGFkb3dNYXRyaXhQYWxldHRlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZFtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVDb3VudElkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwubnVtQ2FzY2FkZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5zaGFkb3dJbnRlbnNpdHkpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcGl4ZWxzUGVyTWV0ZXIgPSAxLjAgLyAobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQud2lkdGggLyBkaXJlY3Rpb25hbC5wZW51bWJyYVNpemUpO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dTZWFyY2hBcmVhSWRbY250XS5zZXRWYWx1ZShwaXhlbHNQZXJNZXRlcik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmFQYXJhbXMgPSBkaXJlY3Rpb25hbC5fc2hhZG93Q2FtZXJhUGFyYW1zO1xuICAgICAgICAgICAgICAgIGNhbWVyYVBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgICAgIGNhbWVyYVBhcmFtc1swXSA9IGxpZ2h0UmVuZGVyRGF0YS5kZXB0aFJhbmdlQ29tcGVuc2F0aW9uO1xuICAgICAgICAgICAgICAgIGNhbWVyYVBhcmFtc1sxXSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzJdID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYS5fbmVhckNsaXA7XG4gICAgICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzNdID0gMTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0Q2FtZXJhUGFyYW1zSWRbY250XS5zZXRWYWx1ZShjYW1lcmFQYXJhbXMpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gZGlyZWN0aW9uYWwuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMubGVuZ3RoID0gNDtcbiAgICAgICAgICAgICAgICBwYXJhbXNbMF0gPSBkaXJlY3Rpb25hbC5fc2hhZG93UmVzb2x1dGlvbjsgIC8vIE5vdGU6IHRoaXMgbmVlZHMgdG8gY2hhbmdlIGZvciBub24tc3F1YXJlIHNoYWRvdyBtYXBzICgyIGNhc2NhZGVzKS4gQ3VycmVudGx5IHNxdWFyZSBpcyB1c2VkXG4gICAgICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zWzNdID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNudDtcbiAgICB9XG5cbiAgICBzZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpIHtcbiAgICAgICAgY29uc3QgaFdpZHRoID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygtMC41LCAwLCAwKSk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzBdID0gaFdpZHRoLng7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzFdID0gaFdpZHRoLnk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzJdID0gaFdpZHRoLno7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFdpZHRoW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhIZWlnaHQgPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKDAsIDAsIDAuNSkpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMF0gPSBoSGVpZ2h0Lng7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsxXSA9IGhIZWlnaHQueTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzJdID0gaEhlaWdodC56O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0SGVpZ2h0W2NudF0pO1xuICAgIH1cblxuICAgIGRpc3BhdGNoT21uaUxpZ2h0KHNjZW5lLCBzY29wZSwgb21uaSwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IG9tbmkuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtjbnRdLnNldFZhbHVlKG9tbmkuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IG9tbmkuX2xpbmVhckZpbmFsQ29sb3IgOiBvbW5pLl9maW5hbENvbG9yKTtcbiAgICAgICAgd3RtLmdldFRyYW5zbGF0aW9uKG9tbmkuX3Bvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gb21uaS5fcG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gb21uaS5fcG9zaXRpb24ueTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gb21uaS5fcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBpZiAob21uaS5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlXG4gICAgICAgICAgICB0aGlzLnNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob21uaS5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgbWFwXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBvbW5pLmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gb21uaS5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IG9tbmkuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gb21uaS5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbM10gPSAxLjAgLyBvbW5pLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShvbW5pLnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHBpeGVsc1Blck1ldGVyID0gMS4wIC8gKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0LndpZHRoIC8gb21uaS5wZW51bWJyYVNpemUpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1NlYXJjaEFyZWFJZFtjbnRdLnNldFZhbHVlKHBpeGVsc1Blck1ldGVyKTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhcmFtcyA9IG9tbmkuX3NoYWRvd0NhbWVyYVBhcmFtcztcblxuICAgICAgICAgICAgY2FtZXJhUGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBjYW1lcmFQYXJhbXNbMF0gPSAxO1xuICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzFdID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYS5fZmFyQ2xpcDtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1syXSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX25lYXJDbGlwO1xuICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzNdID0gMDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDYW1lcmFQYXJhbXNJZFtjbnRdLnNldFZhbHVlKGNhbWVyYVBhcmFtcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9tbmkuX2Nvb2tpZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2NudF0uc2V0VmFsdWUob21uaS5fY29va2llKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHd0bS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtjbnRdLnNldFZhbHVlKG9tbmkuY29va2llSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IHNwb3QuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWRbY250XS5zZXRWYWx1ZShzcG90Ll9pbm5lckNvbmVBbmdsZUNvcyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5fb3V0ZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWRbY250XS5zZXRWYWx1ZShzcG90LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBzcG90Ll9saW5lYXJGaW5hbENvbG9yIDogc3BvdC5fZmluYWxDb2xvcik7XG4gICAgICAgIHd0bS5nZXRUcmFuc2xhdGlvbihzcG90Ll9wb3NpdGlvbik7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IHNwb3QuX3Bvc2l0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IHNwb3QuX3Bvc2l0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IHNwb3QuX3Bvc2l0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgaWYgKHNwb3Quc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZVxuICAgICAgICAgICAgdGhpcy5zZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BvdHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgIHd0bS5nZXRZKHNwb3QuX2RpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgc3BvdC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMF0gPSBzcG90Ll9kaXJlY3Rpb24ueDtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gc3BvdC5fZGlyZWN0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVsyXSA9IHNwb3QuX2RpcmVjdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0RGlyW2NudF0pO1xuXG4gICAgICAgIGlmIChzcG90LmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHNwb3QuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBzcG90Ll9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gc3BvdC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBzcG90Ll9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIHNwb3QuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKHNwb3Quc2hhZG93SW50ZW5zaXR5KTtcblxuICAgICAgICAgICAgY29uc3QgcGl4ZWxzUGVyTWV0ZXIgPSAxLjAgLyAobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQud2lkdGggLyBzcG90LnBlbnVtYnJhU2l6ZSk7XG4gICAgICAgICAgICBjb25zdCBmb3YgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9mb3YgKiBNYXRoLlBJIC8gMTgwLjA7XG4gICAgICAgICAgICBjb25zdCBmb3ZSYXRpbyA9IDEuMCAvIE1hdGgudGFuKGZvdiAvIDIuMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93U2VhcmNoQXJlYUlkW2NudF0uc2V0VmFsdWUocGl4ZWxzUGVyTWV0ZXIgKiBmb3ZSYXRpbyk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhcmFtcyA9IHNwb3QuX3NoYWRvd0NhbWVyYVBhcmFtcztcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgY2FtZXJhUGFyYW1zWzBdID0gMTtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1sxXSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgICAgICBjYW1lcmFQYXJhbXNbMl0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9uZWFyQ2xpcDtcbiAgICAgICAgICAgIGNhbWVyYVBhcmFtc1szXSA9IDA7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q2FtZXJhUGFyYW1zSWRbY250XS5zZXRWYWx1ZShjYW1lcmFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZSkge1xuXG4gICAgICAgICAgICAvLyBpZiBzaGFkb3cgaXMgbm90IHJlbmRlcmVkLCB3ZSBuZWVkIHRvIGV2YWx1YXRlIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAoIXNwb3QuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb29raWVNYXRyaXggPSBMaWdodENhbWVyYS5ldmFsU3BvdENvb2tpZU1hdHJpeChzcG90KTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShjb29raWVNYXRyaXguZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbY250XS5zZXRWYWx1ZShzcG90LmNvb2tpZUludGVuc2l0eSk7XG4gICAgICAgICAgICBpZiAoc3BvdC5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVswXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS54O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMV0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzJdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLno7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVszXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS53O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVPZmZzZXQueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzFdID0gc3BvdC5fY29va2llT2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2NudF0uc2V0VmFsdWUoc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaExvY2FsTGlnaHRzKHNvcnRlZExpZ2h0cywgc2NlbmUsIG1hc2ssIHVzZWREaXJMaWdodHMsIHN0YXRpY0xpZ2h0TGlzdCkge1xuXG4gICAgICAgIGxldCBjbnQgPSB1c2VkRGlyTGlnaHRzO1xuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGNvbnN0IG9tbmlzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9PTU5JXTtcbiAgICAgICAgY29uc3QgbnVtT21uaXMgPSBvbW5pcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtT21uaXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgb21uaSA9IG9tbmlzW2ldO1xuICAgICAgICAgICAgaWYgKCEob21uaS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKG9tbmkuaXNTdGF0aWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCk7XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGF0aWNJZCA9IDA7XG4gICAgICAgIGlmIChzdGF0aWNMaWdodExpc3QpIHtcbiAgICAgICAgICAgIGxldCBvbW5pID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIHdoaWxlIChvbW5pICYmIG9tbmkuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCk7XG4gICAgICAgICAgICAgICAgY250Kys7XG4gICAgICAgICAgICAgICAgc3RhdGljSWQrKztcbiAgICAgICAgICAgICAgICBvbW5pID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNwdHMgPSBzb3J0ZWRMaWdodHNbTElHSFRUWVBFX1NQT1RdO1xuICAgICAgICBjb25zdCBudW1TcHRzID0gc3B0cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU3B0czsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzcG90ID0gc3B0c1tpXTtcbiAgICAgICAgICAgIGlmICghKHNwb3QubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzcG90LmlzU3RhdGljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBsZXQgc3BvdCA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB3aGlsZSAoc3BvdCAmJiBzcG90Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpO1xuICAgICAgICAgICAgICAgIGNudCsrO1xuICAgICAgICAgICAgICAgIHN0YXRpY0lkKys7XG4gICAgICAgICAgICAgICAgc3BvdCA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleGVjdXRlIGZpcnN0IHBhc3Mgb3ZlciBkcmF3IGNhbGxzLCBpbiBvcmRlciB0byB1cGRhdGUgbWF0ZXJpYWxzIC8gc2hhZGVyc1xuICAgIC8vIFRPRE86IGltcGxlbWVudCB0aGlzOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2ViR0xfQVBJL1dlYkdMX2Jlc3RfcHJhY3RpY2VzI2NvbXBpbGVfc2hhZGVyc19hbmRfbGlua19wcm9ncmFtc19pbl9wYXJhbGxlbFxuICAgIC8vIHdoZXJlIGluc3RlYWQgb2YgY29tcGlsaW5nIGFuZCBsaW5raW5nIHNoYWRlcnMsIHdoaWNoIGlzIHNlcmlhbCBvcGVyYXRpb24sIHdlIGNvbXBpbGUgYWxsIG9mIHRoZW0gYW5kIHRoZW4gbGluayB0aGVtLCBhbGxvd2luZyB0aGUgd29yayB0b1xuICAgIC8vIHRha2UgcGxhY2UgaW4gcGFyYWxsZWxcbiAgICByZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGRyYXdDYWxscywgZHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgY3VsbGluZ01hc2ssIGxheWVyLCBwYXNzKSB7XG5cbiAgICAgICAgY29uc3QgYWRkQ2FsbCA9IChkcmF3Q2FsbCwgaXNOZXdNYXRlcmlhbCwgbGlnaHRNYXNrQ2hhbmdlZCkgPT4ge1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5kcmF3Q2FsbHMucHVzaChkcmF3Q2FsbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmlzTmV3TWF0ZXJpYWwucHVzaChpc05ld01hdGVyaWFsKTtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QubGlnaHRNYXNrQ2hhbmdlZC5wdXNoKGxpZ2h0TWFza0NoYW5nZWQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggZW1wdHkgYXJyYXlzXG4gICAgICAgIF9kcmF3Q2FsbExpc3QuY2xlYXIoKTtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBsaWdodEhhc2ggPSBsYXllciA/IGxheWVyLl9saWdodEhhc2ggOiAwO1xuICAgICAgICBsZXQgcHJldk1hdGVyaWFsID0gbnVsbCwgcHJldk9iakRlZnMsIHByZXZTdGF0aWMsIHByZXZMaWdodE1hc2s7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSAqL1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG5cbiAgICAgICAgICAgIC8vIGFwcGx5IHZpc2liaWxpdHkgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmIChjdWxsaW5nTWFzayAmJiBkcmF3Q2FsbC5tYXNrICYmICEoY3VsbGluZ01hc2sgJiBkcmF3Q2FsbC5tYXNrKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIHtcblxuICAgICAgICAgICAgICAgIGFkZENhbGwoZHJhd0NhbGwsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYSA9PT0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPj0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID49IGxheWVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5lbnN1cmVNYXRlcmlhbChkZXZpY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAmJiBtYXRlcmlhbCA9PT0gcHJldk1hdGVyaWFsICYmIG9iakRlZnMgIT09IHByZXZPYmpEZWZzKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG51bGw7IC8vIGZvcmNlIGNoYW5nZSBzaGFkZXIgaWYgdGhlIG9iamVjdCB1c2VzIGEgZGlmZmVyZW50IHZhcmlhbnQgb2YgdGhlIHNhbWUgbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuaXNTdGF0aWMgfHwgcHJldlN0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsU3dpdGNoZXMrKztcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuX3NjZW5lID0gc2NlbmU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBtYXRlcmlhbCBoYXMgZGlydHlCbGVuZCBzZXQsIG5vdGlmeSBzY2VuZSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5fZGlydHlCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUubGF5ZXJzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwuX3NoYWRlcltwYXNzXSB8fCBkcmF3Q2FsbC5fc2hhZGVyRGVmcyAhPT0gb2JqRGVmcyB8fCBkcmF3Q2FsbC5fbGlnaHRIYXNoICE9PSBsaWdodEhhc2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXJrZXIgdG8gYWxsb3cgdXMgdG8gc2VlIHRoZSBzb3VyY2Ugbm9kZSBmb3Igc2hhZGVyIGFsbG9jXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBOb2RlOiAke2RyYXdDYWxsLm5vZGUubmFtZX1gKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBkcmF3IGNhbGxzIG5vdCB1c2luZyBzdGF0aWMgbGlnaHRzIHVzZSB2YXJpYW50cyBjYWNoZSBvbiBtYXRlcmlhbCB0byBxdWlja2x5IGZpbmQgdGhlIHNoYWRlciwgYXMgdGhleSBhcmUgYWxsXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzYW1lIGZvciB0aGUgc2FtZSBwYXNzLCB1c2luZyBhbGwgbGlnaHRzIG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YXJpYW50S2V5ID0gcGFzcyArICdfJyArIG9iakRlZnMgKyAnXycgKyBsaWdodEhhc2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdID0gbWF0ZXJpYWwudmFyaWFudHNbdmFyaWFudEtleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLl9zaGFkZXJbcGFzc10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBudWxsLCBzb3J0ZWRMaWdodHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwudmFyaWFudHNbdmFyaWFudEtleV0gPSBkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzdGF0aWMgbGlnaHRzIGdlbmVyYXRlIHVuaXF1ZSBzaGFkZXIgcGVyIGRyYXcgY2FsbCwgYXMgc3RhdGljIGxpZ2h0cyBhcmUgdW5pcXVlIHBlciBkcmF3IGNhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgc28gdmFyaWFudHMgY2FjaGUgaXMgbm90IHVzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cywgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC5fbGlnaHRIYXNoID0gbGlnaHRIYXNoO1xuXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGRyYXdDYWxsLl9zaGFkZXJbcGFzc10sIFwibm8gc2hhZGVyIGZvciBwYXNzXCIsIG1hdGVyaWFsKTtcblxuICAgICAgICAgICAgICAgIGFkZENhbGwoZHJhd0NhbGwsIG1hdGVyaWFsICE9PSBwcmV2TWF0ZXJpYWwsICFwcmV2TWF0ZXJpYWwgfHwgbGlnaHRNYXNrICE9PSBwcmV2TGlnaHRNYXNrKTtcblxuICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIHByZXZPYmpEZWZzID0gb2JqRGVmcztcbiAgICAgICAgICAgICAgICBwcmV2TGlnaHRNYXNrID0gbGlnaHRNYXNrO1xuICAgICAgICAgICAgICAgIHByZXZTdGF0aWMgPSBkcmF3Q2FsbC5pc1N0YXRpYztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHByb2Nlc3MgdGhlIGJhdGNoIG9mIHNoYWRlcnMgY3JlYXRlZCBoZXJlXG4gICAgICAgIGRldmljZS5lbmRTaGFkZXJCYXRjaD8uKCk7XG5cbiAgICAgICAgcmV0dXJuIF9kcmF3Q2FsbExpc3Q7XG4gICAgfVxuXG4gICAgcmVuZGVyRm9yd2FyZEludGVybmFsKGNhbWVyYSwgcHJlcGFyZWRDYWxscywgc29ydGVkTGlnaHRzLCBwYXNzLCBkcmF3Q2FsbGJhY2ssIGZsaXBGYWNlcykge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBwYXNzRmxhZyA9IDEgPDwgcGFzcztcbiAgICAgICAgY29uc3QgZmxpcEZhY3RvciA9IGZsaXBGYWNlcyA/IC0xIDogMTtcbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gUmVuZGVyIHRoZSBzY2VuZVxuICAgICAgICBsZXQgc2tpcE1hdGVyaWFsID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHNDb3VudCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVwYXJlZENhbGxzQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzW2ldO1xuXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY29tbWFuZCkge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIGNvbW1hbmRcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5jb21tYW5kKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGEgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld01hdGVyaWFsID0gcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFza0NoYW5nZWQgPSBwcmVwYXJlZENhbGxzLmxpZ2h0TWFza0NoYW5nZWRbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChuZXdNYXRlcmlhbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IGRyYXdDYWxsLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2hhZGVyLmZhaWxlZCAmJiAhZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7cGFzc30gb2JqRGVmcz0ke29iakRlZnN9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCByZW5kZXJpbmcgd2l0aCB0aGUgbWF0ZXJpYWwgaWYgc2hhZGVyIGZhaWxlZFxuICAgICAgICAgICAgICAgICAgICBza2lwTWF0ZXJpYWwgPSBzaGFkZXIuZmFpbGVkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2tpcE1hdGVyaWFsKVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYE1hdGVyaWFsOiAke21hdGVyaWFsLm5hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodE1hc2tDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VkRGlyTGlnaHRzID0gdGhpcy5kaXNwYXRjaERpcmVjdExpZ2h0cyhzb3J0ZWRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXSwgc2NlbmUsIGxpZ2h0TWFzaywgY2FtZXJhKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoTG9jYWxMaWdodHMoc29ydGVkTGlnaHRzLCBzY2VuZSwgbGlnaHRNYXNrLCB1c2VkRGlyTGlnaHRzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcblxuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShtYXRlcmlhbC5ibGVuZFN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoU3RhdGUobWF0ZXJpYWwuZGVwdGhTdGF0ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEFscGhhVG9Db3ZlcmFnZShtYXRlcmlhbC5hbHBoYVRvQ292ZXJhZ2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kZXB0aEJpYXMgfHwgbWF0ZXJpYWwuc2xvcGVEZXB0aEJpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXModHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzVmFsdWVzKG1hdGVyaWFsLmRlcHRoQmlhcywgbWF0ZXJpYWwuc2xvcGVEZXB0aEJpYXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBOb2RlOiAke2RyYXdDYWxsLm5vZGUubmFtZX1gKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBDdWxsTW9kZShjYW1lcmEuX2N1bGxGYWNlcywgZmxpcEZhY3RvciwgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbEZyb250ID0gZHJhd0NhbGwuc3RlbmNpbEZyb250ID8/IG1hdGVyaWFsLnN0ZW5jaWxGcm9udDtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsQmFjayA9IGRyYXdDYWxsLnN0ZW5jaWxCYWNrID8/IG1hdGVyaWFsLnN0ZW5jaWxCYWNrO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjayk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gZHJhd0NhbGwubWVzaDtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIElJOiBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzXG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFnKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TW9ycGhpbmcoZGV2aWNlLCBkcmF3Q2FsbC5tb3JwaEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNraW5uaW5nKGRldmljZSwgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXR1cE1lc2hVbmlmb3JtQnVmZmVycyhkcmF3Q2FsbCwgcGFzcyk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdHlsZSA9IGRyYXdDYWxsLnJlbmRlclN0eWxlO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRJbmRleEJ1ZmZlcihtZXNoLmluZGV4QnVmZmVyW3N0eWxlXSk7XG5cbiAgICAgICAgICAgICAgICBkcmF3Q2FsbGJhY2s/LihkcmF3Q2FsbCwgaSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci5zZXNzaW9uICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCB2aWV3cy5sZW5ndGg7IHYrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQodmlldy52aWV3cG9ydC54LCB2aWV3LnZpZXdwb3J0LnksIHZpZXcudmlld3BvcnQueiwgdmlldy52aWV3cG9ydC53KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQuc2V0VmFsdWUodmlldy52aWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlldy52aWV3SW52T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQzLnNldFZhbHVlKHZpZXcudmlld01hdDMuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qVmlld09mZk1hdC5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZpZXcucG9zaXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodiA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHJhd0luc3RhbmNlKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UyKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVW5zZXQgbWVzaEluc3RhbmNlIG92ZXJyaWRlcyBiYWNrIHRvIG1hdGVyaWFsIHZhbHVlcyBpZiBuZXh0IGRyYXcgY2FsbCB3aWxsIHVzZSB0aGUgc2FtZSBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIGlmIChpIDwgcHJlcGFyZWRDYWxsc0NvdW50IC0gMSAmJiAhcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2kgKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgZHJhd0NhbGwucGFyYW1ldGVycyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmQoY2FtZXJhLCBhbGxEcmF3Q2FsbHMsIGFsbERyYXdDYWxsc0NvdW50LCBzb3J0ZWRMaWdodHMsIHBhc3MsIGN1bGxpbmdNYXNrLCBkcmF3Q2FsbGJhY2ssIGxheWVyLCBmbGlwRmFjZXMpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGZvcndhcmRTdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gcnVuIGZpcnN0IHBhc3Mgb3ZlciBkcmF3IGNhbGxzIGFuZCBoYW5kbGUgbWF0ZXJpYWwgLyBzaGFkZXIgdXBkYXRlc1xuICAgICAgICBjb25zdCBwcmVwYXJlZENhbGxzID0gdGhpcy5yZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGFsbERyYXdDYWxscywgYWxsRHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgY3VsbGluZ01hc2ssIGxheWVyLCBwYXNzKTtcblxuICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5yZW5kZXJGb3J3YXJkSW50ZXJuYWwoY2FtZXJhLCBwcmVwYXJlZENhbGxzLCBzb3J0ZWRMaWdodHMsIHBhc3MsIGRyYXdDYWxsYmFjaywgZmxpcEZhY2VzKTtcblxuICAgICAgICBfZHJhd0NhbGxMaXN0LmNsZWFyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9mb3J3YXJkVGltZSArPSBub3coKSAtIGZvcndhcmRTdGFydFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHNldFNjZW5lQ29uc3RhbnRzKCkge1xuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLy8gU2V0IHVwIGFtYmllbnQvZXhwb3N1cmVcbiAgICAgICAgdGhpcy5kaXNwYXRjaEdsb2JhbExpZ2h0cyhzY2VuZSk7XG5cbiAgICAgICAgLy8gU2V0IHVwIHRoZSBmb2dcbiAgICAgICAgaWYgKHNjZW5lLmZvZyAhPT0gRk9HX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMF0gPSBzY2VuZS5mb2dDb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclsxXSA9IHNjZW5lLmZvZ0NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzJdID0gc2NlbmUuZm9nQ29sb3IuYjtcbiAgICAgICAgICAgIGlmIChzY2VuZS5nYW1tYUNvcnJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvZ0NvbG9yW2ldID0gTWF0aC5wb3codGhpcy5mb2dDb2xvcltpXSwgMi4yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9ySWQuc2V0VmFsdWUodGhpcy5mb2dDb2xvcik7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZm9nID09PSBGT0dfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dTdGFydElkLnNldFZhbHVlKHNjZW5lLmZvZ1N0YXJ0KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ0VuZElkLnNldFZhbHVlKHNjZW5lLmZvZ0VuZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nRGVuc2l0eUlkLnNldFZhbHVlKHNjZW5lLmZvZ0RlbnNpdHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHVwIHNjcmVlbiBzaXplIC8vIHNob3VsZCBiZSBSVCBzaXplP1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVswXSA9IGRldmljZS53aWR0aDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVsxXSA9IGRldmljZS5oZWlnaHQ7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMl0gPSAxIC8gZGV2aWNlLndpZHRoO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzNdID0gMSAvIGRldmljZS5oZWlnaHQ7XG4gICAgICAgIHRoaXMuc2NyZWVuU2l6ZUlkLnNldFZhbHVlKHRoaXMuX3NjcmVlblNpemUpO1xuXG4gICAgICAgIHRoaXMucGNzc0Rpc2tTYW1wbGVzSWQuc2V0VmFsdWUodGhpcy5wY3NzRGlza1NhbXBsZXMpO1xuICAgICAgICB0aGlzLnBjc3NTcGhlcmVTYW1wbGVzSWQuc2V0VmFsdWUodGhpcy5wY3NzU3BoZXJlU2FtcGxlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb21wVXBkYXRlZEZsYWdzIC0gRmxhZ3Mgb2Ygd2hhdCB3YXMgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVMaWdodFN0YXRzKGNvbXAsIGNvbXBVcGRhdGVkRmxhZ3MpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9MSUdIVFMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gc2NlbmUuX3N0YXRzO1xuICAgICAgICAgICAgc3RhdHMubGlnaHRzID0gY29tcC5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMgPSAwO1xuICAgICAgICAgICAgc3RhdHMuYmFrZWRMaWdodHMgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRzLmxpZ2h0czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAobC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgobC5tYXNrICYgTUFTS19BRkZFQ1RfRFlOQU1JQykgfHwgKGwubWFzayAmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSkgeyAvLyBpZiBhZmZlY3RzIGR5bmFtaWMgb3IgYmFrZWQgb2JqZWN0cyBpbiByZWFsLXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobC5tYXNrICYgTUFTS19CQUtFKSB7IC8vIGlmIGJha2VkIGludG8gbGlnaHRtYXBzXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9JTlNUQU5DRVMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIHNjZW5lLl9zdGF0cy5tZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBzY2VuZS5fc3RhdHNVcGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQnVpbGRzIGEgZnJhbWUgZ3JhcGggZm9yIHRoZSByZW5kZXJpbmcgb2YgdGhlIHdob2xlIGZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1lLWdyYXBoLmpzJykuRnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZS1ncmFwaCB0aGF0IGlzIGJ1aWx0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGxheWVyQ29tcG9zaXRpb24gLSBUaGVcbiAgICAgKiBsYXllciBjb21wb3NpdGlvbiB1c2VkIHRvIGJ1aWxkIHRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYnVpbGRGcmFtZUdyYXBoKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgZnJhbWVHcmFwaC5yZXNldCgpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlKGxheWVyQ29tcG9zaXRpb24pO1xuXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZyByZW5kZXIgcGFzc2VzXG4gICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAgICAgLy8gY29va2llc1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgY29va2llcyBmb3IgYWxsIGxvY2FsIHZpc2libGUgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLmxpZ2h0aW5nLmNvb2tpZXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNvb2tpZXMobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyQ29va2llcyhsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCAnQ2x1c3RlcmVkQ29va2llcycpO1xuICAgICAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbG9jYWwgc2hhZG93cyAtIHRoZXNlIGFyZSBzaGFyZWQgYnkgYWxsIGNhbWVyYXMgKG5vdCBlbnRpcmVseSBjb3JyZWN0bHkpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsICdDbHVzdGVyZWRMb2NhbFNoYWRvd3MnKTtcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgc2hhZG93cyBvbmx5IHdoZW4gbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUubGlnaHRpbmcuc2hhZG93c0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3BsaXRMaWdodHMgPSBsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0cztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbC5wcmVwYXJlQ2x1c3RlcmVkUmVuZGVyUGFzcyhyZW5kZXJQYXNzLCBzcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIHNwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNsdXN0ZXJzIGFsbCB0aGUgdGltZVxuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuYWZ0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQ2x1c3RlcnMobGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBub24tY2x1c3RlcmVkIGxvY2FsIHNoYWRvd3MgLSB0aGVzZSBhcmUgc2hhcmVkIGJ5IGFsbCBjYW1lcmFzIChub3QgZW50aXJlbHkgY29ycmVjdGx5KVxuICAgICAgICAgICAgY29uc3Qgc3BsaXRMaWdodHMgPSBsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0cztcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwuYnVpbGROb25DbHVzdGVyZWRSZW5kZXJQYXNzZXMoZnJhbWVHcmFwaCwgc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdLCBzcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFpbiBwYXNzZXNcbiAgICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICBsZXQgcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICAgICAgLy8gc2tpcCBkaXNhYmxlZCBsYXllcnNcbiAgICAgICAgICAgIGlmICghcmVuZGVyQWN0aW9uLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzRGVwdGhMYXllciA9IGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgY29uc3QgaXNHcmFiUGFzcyA9IGlzRGVwdGhMYXllciAmJiAoY2FtZXJhLnJlbmRlclNjZW5lQ29sb3JNYXAgfHwgY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXApO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGdldCByZS1yZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmFcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgJiYgY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbC5idWlsZEZyYW1lR3JhcGgoZnJhbWVHcmFwaCwgcmVuZGVyQWN0aW9uLCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdGFydCBvZiBibG9jayBvZiByZW5kZXIgYWN0aW9ucyByZW5kZXJpbmcgdG8gdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKG5ld1N0YXJ0KSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzdGFydEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICByZW5kZXJUYXJnZXQgPSByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmaW5kIHRoZSBuZXh0IGVuYWJsZWQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgbGV0IG5leHRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgd2hpbGUgKHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XSAmJiAhcmVuZGVyQWN0aW9uc1tuZXh0SW5kZXhdLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgbmV4dEluZGV4Kys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluZm8gYWJvdXQgdGhlIG5leHQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgY29uc3QgbmV4dFJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyRGVwdGggPSBuZXh0UmVuZGVyQWN0aW9uID8gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RbbmV4dFJlbmRlckFjdGlvbi5sYXllckluZGV4XS5pZCA9PT0gTEFZRVJJRF9ERVBUSCA6IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaXNOZXh0TGF5ZXJHcmFiUGFzcyA9IGlzTmV4dExheWVyRGVwdGggJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKTtcblxuICAgICAgICAgICAgLy8gZW5kIG9mIHRoZSBibG9jayB1c2luZyB0aGUgc2FtZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICBpZiAoIW5leHRSZW5kZXJBY3Rpb24gfHwgbmV4dFJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQgIT09IHJlbmRlclRhcmdldCB8fFxuICAgICAgICAgICAgICAgIG5leHRSZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgfHwgaXNOZXh0TGF5ZXJHcmFiUGFzcyB8fCBpc0dyYWJQYXNzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBpLCBpc0dyYWJQYXNzKTtcblxuICAgICAgICAgICAgICAgIC8vIHBvc3Rwcm9jZXNzaW5nXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhPy5vblBvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGBQb3N0cHJvY2Vzc2ApO1xuICAgICAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1lLWdyYXBoLmpzJykuRnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlXG4gICAgICogbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBlbmRJbmRleCwgaXNHcmFiUGFzcykge1xuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgcmVuZGVyIGFjdGlvbnMgaW4gdGhlIHJhbmdlXG4gICAgICAgIGNvbnN0IHJhbmdlID0geyBzdGFydDogc3RhcnRJbmRleCwgZW5kOiBlbmRJbmRleCB9O1xuICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc1JlbmRlckFjdGlvbnMobGF5ZXJDb21wb3NpdGlvbiwgcmFuZ2UpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gbGF5ZXJDb21wb3NpdGlvbi5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgY29uc3Qgc3RhcnRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW3N0YXJ0SW5kZXhdO1xuICAgICAgICBjb25zdCBlbmRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2VuZEluZGV4XTtcbiAgICAgICAgY29uc3Qgc3RhcnRMYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3N0YXJ0UmVuZGVyQWN0aW9uLmxheWVySW5kZXhdO1xuICAgICAgICBjb25zdCBjYW1lcmEgPSBzdGFydExheWVyLmNhbWVyYXNbc3RhcnRSZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgYmVmb3JlIHJlbmRlcmluZyB3aXRoIHRoaXMgY2FtZXJhIGZvciB0aGUgZmlyc3QgdGltZVxuICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmZpcnN0Q2FtZXJhVXNlICYmIGNhbWVyYS5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuYmVmb3JlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjYW1lcmEub25QcmVSZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBvbiB0aGUgY2FtZXJhIGNvbXBvbmVudCB3aGVuIHdlJ3JlIGRvbmUgcmVuZGVyaW5nIHdpdGggdGhpcyBjYW1lcmFcbiAgICAgICAgICAgIGlmIChlbmRSZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSAmJiBjYW1lcmEub25Qb3N0UmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5hZnRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2FtZXJhLm9uUG9zdFJlbmRlcigpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXB0aCBncmFiIHBhc3Mgb24gd2ViZ2wxIGlzIG5vcm1hbCByZW5kZXIgcGFzcyAoc2NlbmUgZ2V0cyByZS1yZW5kZXJlZClcbiAgICAgICAgY29uc3QgZ3JhYlBhc3NSZXF1aXJlZCA9IGlzR3JhYlBhc3MgJiYgU2NlbmVHcmFiLnJlcXVpcmVzUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgY2FtZXJhKTtcbiAgICAgICAgY29uc3QgaXNSZWFsUGFzcyA9ICFpc0dyYWJQYXNzIHx8IGdyYWJQYXNzUmVxdWlyZWQ7XG5cbiAgICAgICAgaWYgKGlzUmVhbFBhc3MpIHtcblxuICAgICAgICAgICAgcmVuZGVyUGFzcy5pbml0KHJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICByZW5kZXJQYXNzLmZ1bGxTaXplQ2xlYXJSZWN0ID0gY2FtZXJhLmNhbWVyYS5mdWxsU2l6ZUNsZWFyUmVjdDtcblxuICAgICAgICAgICAgaWYgKGdyYWJQYXNzUmVxdWlyZWQpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlYmdsMSBkZXB0aCByZW5kZXJpbmcgY2xlYXIgdmFsdWVzXG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckNvbG9yKHdlYmdsMURlcHRoQ2xlYXJDb2xvcik7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckRlcHRoKDEuMCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkgeyAvLyBpZiBjYW1lcmEgcmVuZGVyaW5nIGNvdmVycyB0aGUgZnVsbCB2aWV3cG9ydFxuXG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckNvbG9yKGNhbWVyYS5jYW1lcmEuY2xlYXJDb2xvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aChjYW1lcmEuY2FtZXJhLmNsZWFyRGVwdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJTdGVuY2lsKGNhbWVyYS5jYW1lcmEuY2xlYXJTdGVuY2lsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGAke2lzR3JhYlBhc3MgPyAnU2NlbmVHcmFiJyA6ICdSZW5kZXJBY3Rpb24nfSAke3N0YXJ0SW5kZXh9LSR7ZW5kSW5kZXh9IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBDYW06ICR7Y2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJy0nfWApO1xuICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZShjb21wKSB7XG5cbiAgICAgICAgdGhpcy5mcmFtZVVwZGF0ZSgpO1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyLmZyYW1lVXBkYXRlKCk7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBza3lib3gsIHNpbmNlIHRoaXMgbWlnaHQgY2hhbmdlIF9tZXNoSW5zdGFuY2VzXG4gICAgICAgIHRoaXMuc2NlbmUuX3VwZGF0ZVNreSh0aGlzLmRldmljZSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGxheWVyIGNvbXBvc2l0aW9uIGlmIHNvbWV0aGluZyBoYXMgYmVlbiBpbnZhbGlkYXRlZFxuICAgICAgICBjb25zdCB1cGRhdGVkID0gdGhpcy51cGRhdGVMYXllckNvbXBvc2l0aW9uKGNvbXAsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCk7XG4gICAgICAgIGNvbnN0IGxpZ2h0c0NoYW5nZWQgPSAodXBkYXRlZCAmIENPTVBVUERBVEVEX0xJR0hUUykgIT09IDA7XG5cbiAgICAgICAgdGhpcy51cGRhdGVMaWdodFN0YXRzKGNvbXAsIHVwZGF0ZWQpO1xuXG4gICAgICAgIC8vIFNpbmdsZSBwZXItZnJhbWUgY2FsY3VsYXRpb25zXG4gICAgICAgIHRoaXMuYmVnaW5GcmFtZShjb21wLCBsaWdodHNDaGFuZ2VkKTtcbiAgICAgICAgdGhpcy5zZXRTY2VuZUNvbnN0YW50cygpO1xuXG4gICAgICAgIC8vIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAgICAvLyBhZnRlciB0aGlzIHRoZSBzY2VuZSBjdWxsaW5nIGlzIGRvbmUgYW5kIHNjcmlwdCBjYWxsYmFja3MgY2FuIGJlIGNhbGxlZCB0byByZXBvcnQgd2hpY2ggb2JqZWN0cyBhcmUgdmlzaWJsZVxuICAgICAgICB0aGlzLmN1bGxDb21wb3NpdGlvbihjb21wKTtcblxuICAgICAgICAvLyBHUFUgdXBkYXRlIGZvciBhbGwgdmlzaWJsZSBvYmplY3RzXG4gICAgICAgIHRoaXMuZ3B1VXBkYXRlKGNvbXAuX21lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIHJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyhyZW5kZXJBY3Rpb24sIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tyZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyAmJiBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZyk7XG5cbiAgICAgICAgLy8gdHJpZ2dlciBwb3N0cHJvY2Vzc2luZyBmb3IgY2FtZXJhXG4gICAgICAgIGNhbWVyYS5vblBvc3Rwcm9jZXNzaW5nKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBhc3MgcmVwcmVzZW50aW5nIHRoZSBsYXllciBjb21wb3NpdGlvbidzIHJlbmRlciBhY3Rpb25zIGluIHRoZSBzcGVjaWZpZWQgcmFuZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gcmVuZGVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyhjb21wLCByYW5nZSkge1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gcmFuZ2Uuc3RhcnQ7IGkgPD0gcmFuZ2UuZW5kOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbnNbaV0sIGkgPT09IHJhbmdlLnN0YXJ0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vcmVuZGVyLWFjdGlvbi5qcycpLlJlbmRlckFjdGlvbn0gcmVuZGVyQWN0aW9uIC0gVGhlIHJlbmRlclxuICAgICAqIGFjdGlvbi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZpcnN0UmVuZGVyQWN0aW9uIC0gVHJ1ZSBpZiB0aGlzIGlzIHRoZSBmaXJzdCByZW5kZXIgYWN0aW9uIGluIHRoZSByZW5kZXIgcGFzcy5cbiAgICAgKi9cbiAgICByZW5kZXJSZW5kZXJBY3Rpb24oY29tcCwgcmVuZGVyQWN0aW9uLCBmaXJzdFJlbmRlckFjdGlvbikge1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICAvLyBsYXllclxuICAgICAgICBjb25zdCBsYXllckluZGV4ID0gcmVuZGVyQWN0aW9uLmxheWVySW5kZXg7XG4gICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbbGF5ZXJJbmRleF07XG5cbiAgICAgICAgY29uc3QgY2FtZXJhUGFzcyA9IHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleDtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICBpZiAoIXJlbmRlckFjdGlvbi5pc0xheWVyRW5hYmxlZChjb21wKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuZGV2aWNlLCBjYW1lcmEgPyBjYW1lcmEuZW50aXR5Lm5hbWUgOiAnbm9uYW1lJyk7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgbGF5ZXIubmFtZSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBkcmF3VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBDYWxsIHByZXJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUHJlUmVuZGVyT3BhcXVlKSB7XG4gICAgICAgICAgICBsYXllci5vblByZVJlbmRlck9wYXF1ZShjYW1lcmFQYXNzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblByZVJlbmRlclRyYW5zcGFyZW50KGNhbWVyYVBhc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbGVkIGZvciB0aGUgZmlyc3Qgc3VibGF5ZXIgYW5kIGZvciBldmVyeSBjYW1lcmFcbiAgICAgICAgaWYgKCEobGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgJiAoMSA8PCBjYW1lcmFQYXNzKSkpIHtcbiAgICAgICAgICAgIGlmIChsYXllci5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIGxheWVyLm9uUHJlUmVuZGVyKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgfD0gMSA8PCBjYW1lcmFQYXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbWVyYSkge1xuXG4gICAgICAgICAgICB0aGlzLnNldHVwVmlld3BvcnQoY2FtZXJhLmNhbWVyYSwgcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgbm90IGEgZmlyc3QgcmVuZGVyIGFjdGlvbiB0byB0aGUgcmVuZGVyIHRhcmdldCwgb3IgaWYgdGhlIHJlbmRlciB0YXJnZXQgd2FzIG5vdFxuICAgICAgICAgICAgLy8gZnVsbHkgY2xlYXJlZCBvbiBwYXNzIHN0YXJ0LCB3ZSBuZWVkIHRvIGV4ZWN1dGUgY2xlYXJzIGhlcmVcbiAgICAgICAgICAgIGlmICghZmlyc3RSZW5kZXJBY3Rpb24gfHwgIWNhbWVyYS5jYW1lcmEuZnVsbFNpemVDbGVhclJlY3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyKGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5jbGVhckNvbG9yLCByZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCwgcmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGNvbnN0IHNvcnRUaW1lID0gbm93KCk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgbGF5ZXIuX3NvcnRWaXNpYmxlKHRyYW5zcGFyZW50LCBjYW1lcmEuY2FtZXJhLm5vZGUsIGNhbWVyYVBhc3MpO1xuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLl9zb3J0VGltZSArPSBub3coKSAtIHNvcnRUaW1lO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGNvbnN0IG9iamVjdHMgPSBsYXllci5pbnN0YW5jZXM7XG4gICAgICAgICAgICBjb25zdCB2aXNpYmxlID0gdHJhbnNwYXJlbnQgPyBvYmplY3RzLnZpc2libGVUcmFuc3BhcmVudFtjYW1lcmFQYXNzXSA6IG9iamVjdHMudmlzaWJsZU9wYXF1ZVtjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgLy8gYWRkIGRlYnVnIG1lc2ggaW5zdGFuY2VzIHRvIHZpc2libGUgbGlzdFxuICAgICAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUub25QcmVSZW5kZXJMYXllcihsYXllciwgdmlzaWJsZSwgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgICAgICAvLyB1cGxvYWQgY2x1c3RlcmVkIGxpZ2h0cyB1bmlmb3Jtc1xuICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycykge1xuICAgICAgICAgICAgICAgIHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzLmFjdGl2YXRlKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBkZWJ1ZyByZW5kZXJpbmcgb2YgY2x1c3RlcnNcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkICYmIHRoaXMuc2NlbmUubGlnaHRpbmcuZGVidWdMYXllciA9PT0gbGF5ZXIuaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBXb3JsZENsdXN0ZXJzRGVidWcucmVuZGVyKHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzLCB0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgbm90IHZlcnkgY2xldmVyIGdsb2JhbCB2YXJpYWJsZSB3aGljaCBpcyBvbmx5IHVzZWZ1bCB3aGVuIHRoZXJlJ3MganVzdCBvbmUgY2FtZXJhXG4gICAgICAgICAgICB0aGlzLnNjZW5lLl9hY3RpdmVDYW1lcmEgPSBjYW1lcmEuY2FtZXJhO1xuXG4gICAgICAgICAgICBjb25zdCB2aWV3Q291bnQgPSB0aGlzLnNldENhbWVyYVVuaWZvcm1zKGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXR1cFZpZXdVbmlmb3JtQnVmZmVycyhyZW5kZXJBY3Rpb24udmlld0JpbmRHcm91cHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCwgdmlld0NvdW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZW5hYmxlIGZsaXAgZmFjZXMgaWYgZWl0aGVyIHRoZSBjYW1lcmEgaGFzIF9mbGlwRmFjZXMgZW5hYmxlZCBvciB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgLy8gaGFzIGZsaXBZIGVuYWJsZWRcbiAgICAgICAgICAgIGNvbnN0IGZsaXBGYWNlcyA9ICEhKGNhbWVyYS5jYW1lcmEuX2ZsaXBGYWNlcyBeIHJlbmRlckFjdGlvbj8ucmVuZGVyVGFyZ2V0Py5mbGlwWSk7XG5cbiAgICAgICAgICAgIC8vIHNoYWRlciBwYXNzIC0gdXNlIHNldHRpbmcgZnJvbSBjYW1lcmEgaWYgYXZhaWxhYmxlLCBvdGhlcndpc2UgdXNlIGxheWVyIHNldHRpbmdcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlclBhc3MgPSBjYW1lcmEuY2FtZXJhLnNoYWRlclBhc3NJbmZvPy5pbmRleCA/PyBsYXllci5zaGFkZXJQYXNzO1xuXG4gICAgICAgICAgICBjb25zdCBkcmF3cyA9IHRoaXMuX2ZvcndhcmREcmF3Q2FsbHM7XG4gICAgICAgICAgICB0aGlzLnJlbmRlckZvcndhcmQoY2FtZXJhLmNhbWVyYSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxpc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuX3NwbGl0TGlnaHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlclBhc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuY3VsbGluZ01hc2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25EcmF3Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbGlwRmFjZXMpO1xuICAgICAgICAgICAgbGF5ZXIuX2ZvcndhcmREcmF3Q2FsbHMgKz0gdGhpcy5fZm9yd2FyZERyYXdDYWxscyAtIGRyYXdzO1xuXG4gICAgICAgICAgICAvLyBSZXZlcnQgdGVtcCBmcmFtZSBzdHVmZlxuICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgbm90IGJlIGhlcmUsIGFzIGVhY2ggcmVuZGVyaW5nIC8gY2xlYXJpbmcgc2hvdWxkIGV4cGxpY2l0bHkgc2V0IHVwIHdoYXRcbiAgICAgICAgICAgIC8vIGl0IHJlcXVpcmVzICh0aGUgcHJvcGVydGllcyBhcmUgcGFydCBvZiByZW5kZXIgcGlwZWxpbmUgb24gV2ViR1BVIGFueXdheXMpXG4gICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLk5PQkxFTkQpO1xuICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxTdGF0ZShudWxsLCBudWxsKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRBbHBoYVRvQ292ZXJhZ2UoZmFsc2UpOyAvLyBkb24ndCBsZWFrIGEyYyBzdGF0ZVxuICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsIGxheWVyJ3MgcG9zdHJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyT3BhcXVlKGNhbWVyYVBhc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGF5ZXIub25Qb3N0UmVuZGVyICYmICEobGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgJj0gfih0cmFuc3BhcmVudCA/IDIgOiAxKTtcbiAgICAgICAgICAgIGlmIChsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXIoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGxheWVyLl9yZW5kZXJUaW1lICs9IG5vdygpIC0gZHJhd1RpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cbn1cblxuZXhwb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsid2ViZ2wxRGVwdGhDbGVhckNvbG9yIiwiQ29sb3IiLCJfZHJhd0NhbGxMaXN0IiwiZHJhd0NhbGxzIiwiaXNOZXdNYXRlcmlhbCIsImxpZ2h0TWFza0NoYW5nZWQiLCJjbGVhciIsImxlbmd0aCIsInZvZ2VsRGlza1ByZWNhbGN1bGF0aW9uU2FtcGxlcyIsIm51bVNhbXBsZXMiLCJzYW1wbGVzIiwiaSIsInIiLCJNYXRoIiwic3FydCIsInB1c2giLCJ2b2dlbFNwaGVyZVByZWNhbGN1bGF0aW9uU2FtcGxlcyIsIndlaWdodCIsInJhZGl1cyIsIkZvcndhcmRSZW5kZXJlciIsIlJlbmRlcmVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImRldmljZSIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJfZGVwdGhNYXBUaW1lIiwiX2ZvcndhcmRUaW1lIiwiX3NvcnRUaW1lIiwic2NvcGUiLCJmb2dDb2xvcklkIiwicmVzb2x2ZSIsImZvZ1N0YXJ0SWQiLCJmb2dFbmRJZCIsImZvZ0RlbnNpdHlJZCIsImFtYmllbnRJZCIsInNreWJveEludGVuc2l0eUlkIiwiY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQiLCJwY3NzRGlza1NhbXBsZXNJZCIsInBjc3NTcGhlcmVTYW1wbGVzSWQiLCJsaWdodENvbG9ySWQiLCJsaWdodERpciIsImxpZ2h0RGlySWQiLCJsaWdodFNoYWRvd01hcElkIiwibGlnaHRTaGFkb3dNYXRyaXhJZCIsImxpZ2h0U2hhZG93UGFyYW1zSWQiLCJsaWdodFNoYWRvd0ludGVuc2l0eSIsImxpZ2h0UmFkaXVzSWQiLCJsaWdodFBvcyIsImxpZ2h0UG9zSWQiLCJsaWdodFdpZHRoIiwibGlnaHRXaWR0aElkIiwibGlnaHRIZWlnaHQiLCJsaWdodEhlaWdodElkIiwibGlnaHRJbkFuZ2xlSWQiLCJsaWdodE91dEFuZ2xlSWQiLCJsaWdodENvb2tpZUlkIiwibGlnaHRDb29raWVJbnRJZCIsImxpZ2h0Q29va2llTWF0cml4SWQiLCJsaWdodENvb2tpZU9mZnNldElkIiwibGlnaHRTaGFkb3dTZWFyY2hBcmVhSWQiLCJsaWdodENhbWVyYVBhcmFtc0lkIiwic2hhZG93TWF0cml4UGFsZXR0ZUlkIiwic2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkIiwic2hhZG93Q2FzY2FkZUNvdW50SWQiLCJzY3JlZW5TaXplSWQiLCJfc2NyZWVuU2l6ZSIsIkZsb2F0MzJBcnJheSIsImZvZ0NvbG9yIiwiYW1iaWVudENvbG9yIiwicGNzc0Rpc2tTYW1wbGVzIiwicGNzc1NwaGVyZVNhbXBsZXMiLCJkZXN0cm95IiwiZGlzcGF0Y2hHbG9iYWxMaWdodHMiLCJzY2VuZSIsImFtYmllbnRMaWdodCIsImciLCJiIiwiZ2FtbWFDb3JyZWN0aW9uIiwicG93IiwicGh5c2ljYWxVbml0cyIsImFtYmllbnRMdW1pbmFuY2UiLCJzZXRWYWx1ZSIsInNreWJveEx1bWluYW5jZSIsInNreWJveEludGVuc2l0eSIsIl9za3lib3hSb3RhdGlvbk1hdDMiLCJkYXRhIiwiX3Jlc29sdmVMaWdodCIsImxpZ2h0Iiwic2V0TFRDRGlyZWN0aW9uYWxMaWdodCIsInd0bSIsImNudCIsImRpciIsImNhbXBvcyIsImZhciIsIngiLCJ5IiwieiIsImhXaWR0aCIsInRyYW5zZm9ybVZlY3RvciIsIlZlYzMiLCJoSGVpZ2h0IiwiZGlzcGF0Y2hEaXJlY3RMaWdodHMiLCJkaXJzIiwibWFzayIsImNhbWVyYSIsImRpcmVjdGlvbmFsIiwiX25vZGUiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl9saW5lYXJGaW5hbENvbG9yIiwiX2ZpbmFsQ29sb3IiLCJnZXRZIiwiX2RpcmVjdGlvbiIsIm11bFNjYWxhciIsIm5vcm1hbGl6ZSIsInNoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsImdldFBvc2l0aW9uIiwiZmFyQ2xpcCIsImNhc3RTaGFkb3dzIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsImJpYXNlcyIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsInNoYWRvd0J1ZmZlciIsInNoYWRvd01hdHJpeCIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwiX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMiLCJudW1DYXNjYWRlcyIsInNoYWRvd0ludGVuc2l0eSIsInBpeGVsc1Blck1ldGVyIiwic2hhZG93Q2FtZXJhIiwicmVuZGVyVGFyZ2V0Iiwid2lkdGgiLCJwZW51bWJyYVNpemUiLCJjYW1lcmFQYXJhbXMiLCJfc2hhZG93Q2FtZXJhUGFyYW1zIiwiZGVwdGhSYW5nZUNvbXBlbnNhdGlvbiIsIl9mYXJDbGlwIiwiX25lYXJDbGlwIiwicGFyYW1zIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwibm9ybWFsQmlhcyIsImJpYXMiLCJzZXRMVENQb3NpdGlvbmFsTGlnaHQiLCJkaXNwYXRjaE9tbmlMaWdodCIsIm9tbmkiLCJhdHRlbnVhdGlvbkVuZCIsImdldFRyYW5zbGF0aW9uIiwiX3Bvc2l0aW9uIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsImRpc3BhdGNoU3BvdExpZ2h0Iiwic3BvdCIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImZvdiIsIl9mb3YiLCJQSSIsImZvdlJhdGlvIiwidGFuIiwiY29va2llTWF0cml4IiwiTGlnaHRDYW1lcmEiLCJldmFsU3BvdENvb2tpZU1hdHJpeCIsIl9jb29raWVUcmFuc2Zvcm0iLCJfY29va2llVHJhbnNmb3JtVW5pZm9ybSIsInciLCJfY29va2llT2Zmc2V0VW5pZm9ybSIsIl9jb29raWVPZmZzZXQiLCJkaXNwYXRjaExvY2FsTGlnaHRzIiwic29ydGVkTGlnaHRzIiwidXNlZERpckxpZ2h0cyIsInN0YXRpY0xpZ2h0TGlzdCIsIm9tbmlzIiwiTElHSFRUWVBFX09NTkkiLCJudW1PbW5pcyIsImlzU3RhdGljIiwic3RhdGljSWQiLCJfdHlwZSIsInNwdHMiLCJMSUdIVFRZUEVfU1BPVCIsIm51bVNwdHMiLCJyZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyIsImRyYXdDYWxsc0NvdW50IiwiY3VsbGluZ01hc2siLCJsYXllciIsInBhc3MiLCJhZGRDYWxsIiwiZHJhd0NhbGwiLCJsaWdodEhhc2giLCJfbGlnaHRIYXNoIiwicHJldk1hdGVyaWFsIiwicHJldk9iakRlZnMiLCJwcmV2U3RhdGljIiwicHJldkxpZ2h0TWFzayIsImNvbW1hbmQiLCJza2lwUmVuZGVyQ2FtZXJhIiwiX3NraXBSZW5kZXJDb3VudGVyIiwic2tpcFJlbmRlckFmdGVyIiwiZW5zdXJlTWF0ZXJpYWwiLCJtYXRlcmlhbCIsIm9iakRlZnMiLCJfc2hhZGVyRGVmcyIsImxpZ2h0TWFzayIsIl9zY2VuZSIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJfZGlydHlCbGVuZCIsImxheWVycyIsIl9zaGFkZXIiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsIm5vZGUiLCJuYW1lIiwidmFyaWFudEtleSIsInZhcmlhbnRzIiwidXBkYXRlUGFzc1NoYWRlciIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsIl9zdGF0aWNMaWdodExpc3QiLCJwb3BHcHVNYXJrZXIiLCJEZWJ1ZyIsImFzc2VydCIsImVuZFNoYWRlckJhdGNoIiwicmVuZGVyRm9yd2FyZEludGVybmFsIiwicHJlcGFyZWRDYWxscyIsImRyYXdDYWxsYmFjayIsImZsaXBGYWNlcyIsInBhc3NGbGFnIiwiZmxpcEZhY3RvciIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsInNraXBNYXRlcmlhbCIsInByZXBhcmVkQ2FsbHNDb3VudCIsIl9kcmF3Q2FsbCRzdGVuY2lsRnJvbiIsIl9kcmF3Q2FsbCRzdGVuY2lsQmFjayIsIm5ld01hdGVyaWFsIiwic2hhZGVyIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiZXJyb3IiLCJsYWJlbCIsInNldFBhcmFtZXRlcnMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJhbHBoYVRlc3RJZCIsImFscGhhVGVzdCIsInNldEJsZW5kU3RhdGUiLCJibGVuZFN0YXRlIiwic2V0RGVwdGhTdGF0ZSIsImRlcHRoU3RhdGUiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRvQ292ZXJhZ2UiLCJkZXB0aEJpYXMiLCJzbG9wZURlcHRoQmlhcyIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsInNldHVwQ3VsbE1vZGUiLCJfY3VsbEZhY2VzIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJzZXRTdGVuY2lsU3RhdGUiLCJtZXNoIiwic2V0VmVydGV4QnVmZmVycyIsInNldE1vcnBoaW5nIiwibW9ycGhJbnN0YW5jZSIsInNldFNraW5uaW5nIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJzdHlsZSIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsInhyIiwic2Vzc2lvbiIsInZpZXdzIiwidiIsInZpZXciLCJzZXRWaWV3cG9ydCIsInZpZXdwb3J0IiwicHJvaklkIiwicHJvak1hdCIsInByb2pTa3lib3hJZCIsInZpZXdJZCIsInZpZXdPZmZNYXQiLCJ2aWV3SW52SWQiLCJ2aWV3SW52T2ZmTWF0Iiwidmlld0lkMyIsInZpZXdNYXQzIiwidmlld1Byb2pJZCIsInByb2pWaWV3T2ZmTWF0Iiwidmlld1Bvc0lkIiwicG9zaXRpb24iLCJkcmF3SW5zdGFuY2UiLCJkcmF3SW5zdGFuY2UyIiwicGFyYW1ldGVycyIsInJlbmRlckZvcndhcmQiLCJhbGxEcmF3Q2FsbHMiLCJhbGxEcmF3Q2FsbHNDb3VudCIsImZvcndhcmRTdGFydFRpbWUiLCJub3ciLCJzZXRTY2VuZUNvbnN0YW50cyIsImZvZyIsIkZPR19OT05FIiwiRk9HX0xJTkVBUiIsImZvZ1N0YXJ0IiwiZm9nRW5kIiwiZm9nRGVuc2l0eSIsImhlaWdodCIsInVwZGF0ZUxpZ2h0U3RhdHMiLCJjb21wIiwiY29tcFVwZGF0ZWRGbGFncyIsIkNPTVBVUERBVEVEX0xJR0hUUyIsIl9zdGF0c1VwZGF0ZWQiLCJzdGF0cyIsIl9zdGF0cyIsImxpZ2h0cyIsIl9saWdodHMiLCJkeW5hbWljTGlnaHRzIiwiYmFrZWRMaWdodHMiLCJsIiwiZW5hYmxlZCIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsIkNPTVBVUERBVEVEX0lOU1RBTkNFUyIsIm1lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlcyIsImJ1aWxkRnJhbWVHcmFwaCIsImZyYW1lR3JhcGgiLCJsYXllckNvbXBvc2l0aW9uIiwicmVzZXQiLCJ1cGRhdGUiLCJyZW5kZXJQYXNzIiwiUmVuZGVyUGFzcyIsImxpZ2h0aW5nIiwiY29va2llc0VuYWJsZWQiLCJyZW5kZXJDb29raWVzIiwiX3NwbGl0TGlnaHRzIiwicmVxdWlyZXNDdWJlbWFwcyIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsImFkZFJlbmRlclBhc3MiLCJzaGFkb3dzRW5hYmxlZCIsInNwbGl0TGlnaHRzIiwiX3NoYWRvd1JlbmRlcmVyTG9jYWwiLCJwcmVwYXJlQ2x1c3RlcmVkUmVuZGVyUGFzcyIsImFmdGVyIiwidXBkYXRlQ2x1c3RlcnMiLCJidWlsZE5vbkNsdXN0ZXJlZFJlbmRlclBhc3NlcyIsInN0YXJ0SW5kZXgiLCJuZXdTdGFydCIsInJlbmRlckFjdGlvbnMiLCJfcmVuZGVyQWN0aW9ucyIsInJlbmRlckFjdGlvbiIsImxheWVyTGlzdCIsImxheWVySW5kZXgiLCJjYW1lcmFzIiwiY2FtZXJhSW5kZXgiLCJpc0xheWVyRW5hYmxlZCIsImlzRGVwdGhMYXllciIsImlkIiwiTEFZRVJJRF9ERVBUSCIsImlzR3JhYlBhc3MiLCJyZW5kZXJTY2VuZUNvbG9yTWFwIiwicmVuZGVyU2NlbmVEZXB0aE1hcCIsImhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzIiwiX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJuZXh0SW5kZXgiLCJuZXh0UmVuZGVyQWN0aW9uIiwiaXNOZXh0TGF5ZXJEZXB0aCIsImlzTmV4dExheWVyR3JhYlBhc3MiLCJhZGRNYWluUmVuZGVyUGFzcyIsInRyaWdnZXJQb3N0cHJvY2VzcyIsIm9uUG9zdHByb2Nlc3NpbmciLCJyZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmciLCJlbmRJbmRleCIsInJhbmdlIiwic3RhcnQiLCJlbmQiLCJyZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyIsInN0YXJ0UmVuZGVyQWN0aW9uIiwiZW5kUmVuZGVyQWN0aW9uIiwic3RhcnRMYXllciIsImZpcnN0Q2FtZXJhVXNlIiwib25QcmVSZW5kZXIiLCJiZWZvcmUiLCJsYXN0Q2FtZXJhVXNlIiwib25Qb3N0UmVuZGVyIiwiZ3JhYlBhc3NSZXF1aXJlZCIsIlNjZW5lR3JhYiIsInJlcXVpcmVzUmVuZGVyUGFzcyIsImlzUmVhbFBhc3MiLCJpbml0IiwiZnVsbFNpemVDbGVhclJlY3QiLCJzZXRDbGVhckNvbG9yIiwic2V0Q2xlYXJEZXB0aCIsImNsZWFyQ29sb3IiLCJjbGVhckRlcHRoIiwiY2xlYXJTdGVuY2lsIiwic2V0Q2xlYXJTdGVuY2lsIiwiZW50aXR5IiwiZnJhbWVVcGRhdGUiLCJzaGFkb3dSZW5kZXJlciIsIl91cGRhdGVTa3kiLCJ1cGRhdGVkIiwidXBkYXRlTGF5ZXJDb21wb3NpdGlvbiIsImxpZ2h0c0NoYW5nZWQiLCJiZWdpbkZyYW1lIiwiY3VsbENvbXBvc2l0aW9uIiwiZ3B1VXBkYXRlIiwicmVuZGVyUmVuZGVyQWN0aW9uIiwiZmlyc3RSZW5kZXJBY3Rpb24iLCJ0cmFuc3BhcmVudCIsInN1YkxheWVyTGlzdCIsImNhbWVyYVBhc3MiLCJkcmF3VGltZSIsIm9uUHJlUmVuZGVyT3BhcXVlIiwib25QcmVSZW5kZXJUcmFuc3BhcmVudCIsIl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3JlbmRlckFjdGlvbiRyZW5kZXJUIiwiX2NhbWVyYSRjYW1lcmEkc2hhZGVyIiwiX2NhbWVyYSRjYW1lcmEkc2hhZGVyMiIsInNldHVwVmlld3BvcnQiLCJzb3J0VGltZSIsIl9zb3J0VmlzaWJsZSIsIm9iamVjdHMiLCJpbnN0YW5jZXMiLCJ2aXNpYmxlIiwidmlzaWJsZVRyYW5zcGFyZW50IiwidmlzaWJsZU9wYXF1ZSIsImltbWVkaWF0ZSIsIm9uUHJlUmVuZGVyTGF5ZXIiLCJsaWdodENsdXN0ZXJzIiwiYWN0aXZhdGUiLCJjbHVzdGVyc0RlYnVnUmVuZGVyZWQiLCJkZWJ1Z0xheWVyIiwiV29ybGRDbHVzdGVyc0RlYnVnIiwicmVuZGVyIiwiX2FjdGl2ZUNhbWVyYSIsInZpZXdDb3VudCIsInNldENhbWVyYVVuaWZvcm1zIiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsInNldHVwVmlld1VuaWZvcm1CdWZmZXJzIiwidmlld0JpbmRHcm91cHMiLCJfZmxpcEZhY2VzIiwiZmxpcFkiLCJzaGFkZXJQYXNzIiwic2hhZGVyUGFzc0luZm8iLCJpbmRleCIsImRyYXdzIiwibGlzdCIsIm9uRHJhd0NhbGwiLCJCbGVuZFN0YXRlIiwiTk9CTEVORCIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlclRyYW5zcGFyZW50IiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwiX3Bvc3RSZW5kZXJDb3VudGVyTWF4IiwiX3JlbmRlclRpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUF3QkEsTUFBTUEscUJBQXFCLEdBQUcsSUFBSUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLEVBQUUsS0FBSyxHQUFHLEdBQUcsRUFBRSxLQUFLLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUUzRixNQUFNQyxhQUFhLEdBQUc7QUFDbEJDLEVBQUFBLFNBQVMsRUFBRSxFQUFFO0FBQ2JDLEVBQUFBLGFBQWEsRUFBRSxFQUFFO0FBQ2pCQyxFQUFBQSxnQkFBZ0IsRUFBRSxFQUFFO0VBRXBCQyxLQUFLLEVBQUUsWUFBWTtBQUNmLElBQUEsSUFBSSxDQUFDSCxTQUFTLENBQUNJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNILGFBQWEsQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBQTtB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
