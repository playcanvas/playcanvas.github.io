/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { FUNC_ALWAYS, STENCILOP_KEEP } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, FOG_NONE, FOG_LINEAR, COMPUPDATED_LIGHTS, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, COMPUPDATED_INSTANCES, LAYERID_DEPTH } from '../constants.js';
import { Renderer } from './renderer.js';
import { LightCamera } from './light-camera.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';
import { SceneGrab } from '../graphics/scene-grab.js';

const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);
const _drawCallList = {
  drawCalls: [],
  isNewMaterial: [],
  lightMaskChanged: []
};

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

    // shadow cascades
    this.shadowMatrixPaletteId = [];
    this.shadowCascadeDistancesId = [];
    this.shadowCascadeCountId = [];
    this.screenSizeId = scope.resolve('uScreenSize');
    this._screenSize = new Float32Array(4);
    this.fogColor = new Float32Array(3);
    this.ambientColor = new Float32Array(3);
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
        const params = directional._shadowRenderParams;
        params.length = 3;
        params[0] = directional._shadowResolution; // Note: this needs to change for non-square shadow maps (2 cascades). Currently square is used
        params[1] = biases.normalBias;
        params[2] = biases.bias;
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
  renderShadowsLocal(lights, camera) {
    const isClustered = this.scene.clusteredLightingEnabled;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      Debug.assert(light._type !== LIGHTTYPE_DIRECTIONAL);

      // skip clustered shadows with no assigned atlas slot
      if (isClustered && !light.atlasViewportAllocated) {
        continue;
      }
      this.shadowRenderer.render(light, camera);
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
    _drawCallList.drawCalls.length = 0;
    _drawCallList.isNewMaterial.length = 0;
    _drawCallList.lightMaskChanged.length = 0;
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
          DebugGraphics.pushGpuMarker(device, drawCall.node.name);

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

    // Render the scene
    let skipMaterial = false;
    const preparedCallsCount = preparedCalls.drawCalls.length;
    for (let i = 0; i < preparedCallsCount; i++) {
      const drawCall = preparedCalls.drawCalls[i];
      if (drawCall.command) {
        // We have a command
        drawCall.command();
      } else {
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

          // Uniforms I: material
          material.setParameters(device);
          if (lightMaskChanged) {
            const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
            this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
          }
          this.alphaTestId.setValue(material.alphaTest);
          device.setBlending(material.blend);
          if (material.blend) {
            if (material.separateAlphaBlend) {
              device.setBlendFunctionSeparate(material.blendSrc, material.blendDst, material.blendSrcAlpha, material.blendDstAlpha);
              device.setBlendEquationSeparate(material.blendEquation, material.blendAlphaEquation);
            } else {
              device.setBlendFunction(material.blendSrc, material.blendDst);
              device.setBlendEquation(material.blendEquation);
            }
          }
          device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
          device.setDepthWrite(material.depthWrite);

          // this fixes the case where the user wishes to turn off depth testing but wants to write depth
          if (material.depthWrite && !material.depthTest) {
            device.setDepthFunc(FUNC_ALWAYS);
            device.setDepthTest(true);
          } else {
            device.setDepthFunc(material.depthFunc);
            device.setDepthTest(material.depthTest);
          }
          device.setAlphaToCoverage(material.alphaToCoverage);
          if (material.depthBias || material.slopeDepthBias) {
            device.setDepthBias(true);
            device.setDepthBiasValues(material.depthBias, material.slopeDepthBias);
          } else {
            device.setDepthBias(false);
          }
        }
        this.setCullMode(camera._cullFaces, flipFaces, drawCall);
        const stencilFront = drawCall.stencilFront || material.stencilFront;
        const stencilBack = drawCall.stencilBack || material.stencilBack;
        if (stencilFront || stencilBack) {
          device.setStencilTest(true);
          if (stencilFront === stencilBack) {
            // identical front/back stencil
            device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
            device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
          } else {
            // separate
            if (stencilFront) {
              // set front
              device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
              device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
            } else {
              // default front
              device.setStencilFuncFront(FUNC_ALWAYS, 0, 0xFF);
              device.setStencilOperationFront(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
            }
            if (stencilBack) {
              // set back
              device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
              device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
            } else {
              // default back
              device.setStencilFuncBack(FUNC_ALWAYS, 0, 0xFF);
              device.setStencilOperationBack(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
            }
          }
        } else {
          device.setStencilTest(false);
        }
        const mesh = drawCall.mesh;

        // Uniforms II: meshInstance overrides
        drawCall.setParameters(device, passFlag);
        this.setVertexBuffers(device, mesh);
        this.setMorphing(device, drawCall.morphInstance);
        this.setSkinning(device, drawCall);
        this.setupMeshUniformBuffers(drawCall, pass);
        const style = drawCall.renderStyle;
        device.setIndexBuffer(mesh.indexBuffer[style]);
        if (drawCallback) {
          drawCallback(drawCall, i);
        }
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
      }
    }
  }
  renderForward(camera, allDrawCalls, allDrawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer, flipFaces) {
    const forwardStartTime = now();

    // run first pass over draw calls and handle material / shader updates
    const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, allDrawCallsCount, sortedLights, cullingMask, layer, pass);

    // render mesh instances
    this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
    _drawCallList.length = 0;
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
    frameGraph.reset();
    this.update(layerComposition);
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    if (clusteredLightingEnabled) {
      const _renderPass = new RenderPass(this.device, () => {
        // render cookies for all local visible lights
        if (this.scene.lighting.cookiesEnabled) {
          this.renderCookies(layerComposition._splitLights[LIGHTTYPE_SPOT]);
          this.renderCookies(layerComposition._splitLights[LIGHTTYPE_OMNI]);
        }
      });
      _renderPass.requiresCubemaps = false;
      DebugHelper.setName(_renderPass, 'ClusteredCookies');
      frameGraph.addRenderPass(_renderPass);
    }

    // local shadows
    const renderPass = new RenderPass(this.device, () => {
      // render shadows for all local visible lights - these shadow maps are shared by all cameras
      if (!clusteredLightingEnabled || clusteredLightingEnabled && this.scene.lighting.shadowsEnabled) {
        this.renderShadowsLocal(layerComposition._splitLights[LIGHTTYPE_SPOT]);
        this.renderShadowsLocal(layerComposition._splitLights[LIGHTTYPE_OMNI]);
      }

      // update light clusters
      if (clusteredLightingEnabled) {
        this.updateClusters(layerComposition);
      }
    });
    renderPass.requiresCubemaps = false;
    DebugHelper.setName(renderPass, 'LocalShadowMaps');
    frameGraph.addRenderPass(renderPass);

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
          const _renderPass2 = new RenderPass(this.device, () => {
            this.renderPassPostprocessing(renderAction, layerComposition);
          });
          _renderPass2.requiresCubemaps = false;
          DebugHelper.setName(_renderPass2, `Postprocess`);
          frameGraph.addRenderPass(_renderPass2);
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
      var _renderAction$renderT;
      this.setupViewport(camera.camera, renderAction.renderTarget);

      // if this is not a first render action to the render target, or if the render target was not
      // fully cleared on pass start, we need to execute clears here
      if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
        this.clear(renderAction, camera.camera);
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
        renderAction.lightClusters.activate(this.lightTextureAtlas);

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
      const draws = this._forwardDrawCalls;
      this.renderForward(camera.camera, visible.list, visible.length, layer._splitLights, layer.shaderPass, layer.cullingMask, layer.onDrawCall, layer, flipFaces);
      layer._forwardDrawCalls += this._forwardDrawCalls - draws;

      // Revert temp frame stuff
      // TODO: this should not be here, as each rendering / clearing should explicitly set up what
      // it requires (the properties are part of render pipeline on WebGPU anyways)
      device.setColorWrite(true, true, true, true);
      device.setStencilTest(false); // don't leak stencil state
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQge1xuICAgIEZVTkNfQUxXQVlTLFxuICAgIFNURU5DSUxPUF9LRUVQXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJztcblxuaW1wb3J0IHtcbiAgICBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBGT0dfTk9ORSwgRk9HX0xJTkVBUixcbiAgICBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0JBS0UsXG4gICAgTEFZRVJJRF9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcblxuY29uc3Qgd2ViZ2wxRGVwdGhDbGVhckNvbG9yID0gbmV3IENvbG9yKDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1KTtcblxuY29uc3QgX2RyYXdDYWxsTGlzdCA9IHtcbiAgICBkcmF3Q2FsbHM6IFtdLFxuICAgIGlzTmV3TWF0ZXJpYWw6IFtdLFxuICAgIGxpZ2h0TWFza0NoYW5nZWQ6IFtdXG59O1xuXG4vKipcbiAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyIHJlbmRlcnMge0BsaW5rIFNjZW5lfXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBGb3J3YXJkUmVuZGVyZXIgZXh0ZW5kcyBSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEZvcndhcmRSZW5kZXJlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5fZGVwdGhNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9zb3J0VGltZSA9IDA7XG5cbiAgICAgICAgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBkZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvcklkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2NvbG9yJyk7XG4gICAgICAgIHRoaXMuZm9nU3RhcnRJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19zdGFydCcpO1xuICAgICAgICB0aGlzLmZvZ0VuZElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2VuZCcpO1xuICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19kZW5zaXR5Jyk7XG5cbiAgICAgICAgdGhpcy5hbWJpZW50SWQgPSBzY29wZS5yZXNvbHZlKCdsaWdodF9nbG9iYWxBbWJpZW50Jyk7XG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQgPSBzY29wZS5yZXNvbHZlKCdza3lib3hJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5jdWJlTWFwUm90YXRpb25NYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ2N1YmVNYXBSb3RhdGlvbk1hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyID0gW107XG4gICAgICAgIHRoaXMubGlnaHREaXJJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5ID0gW107XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zID0gW107XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGggPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0T3V0QW5nbGVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWQgPSBbXTtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWQgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZCA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NyZWVuU2l6ZUlkID0gc2NvcGUucmVzb2x2ZSgndVNjcmVlblNpemUnKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgIC8vIFN0YXRpYyBwcm9wZXJ0aWVzIHVzZWQgYnkgdGhlIFByb2ZpbGVyIGluIHRoZSBFZGl0b3IncyBMYXVuY2ggUGFnZVxuICAgIHN0YXRpYyBza2lwUmVuZGVyQ2FtZXJhID0gbnVsbDtcblxuICAgIHN0YXRpYyBfc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgc3RhdGljIHNraXBSZW5kZXJBZnRlciA9IDA7XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICovXG4gICAgZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpIHtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMF0gPSBzY2VuZS5hbWJpZW50TGlnaHQucjtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMV0gPSBzY2VuZS5hbWJpZW50TGlnaHQuZztcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMl0gPSBzY2VuZS5hbWJpZW50TGlnaHQuYjtcbiAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFtYmllbnRDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuYW1iaWVudENvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzY2VuZS5waHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldICo9IHNjZW5lLmFtYmllbnRMdW1pbmFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hbWJpZW50SWQuc2V0VmFsdWUodGhpcy5hbWJpZW50Q29sb3IpO1xuXG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUucGh5c2ljYWxVbml0cyA/IHNjZW5lLnNreWJveEx1bWluYW5jZSA6IHNjZW5lLnNreWJveEludGVuc2l0eSk7XG4gICAgICAgIHRoaXMuY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQuc2V0VmFsdWUoc2NlbmUuX3NreWJveFJvdGF0aW9uTWF0My5kYXRhKTtcbiAgICB9XG5cbiAgICBfcmVzb2x2ZUxpZ2h0KHNjb3BlLCBpKSB7XG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gJ2xpZ2h0JyArIGk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29sb3InKTtcbiAgICAgICAgdGhpcy5saWdodERpcltpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHREaXJJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2RpcmVjdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXAnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4Jyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd1BhcmFtcycpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3JhZGl1cycpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcG9zaXRpb24nKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19oYWxmV2lkdGgnKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZIZWlnaHQnKTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2lubmVyQ29uZUFuZ2xlJyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfb3V0ZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llJyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZUludGVuc2l0eScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llT2Zmc2V0Jyk7XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4UGFsZXR0ZVswXScpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbMF0nKTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVDb3VudCcpO1xuICAgIH1cblxuICAgIHNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpciwgY2FtcG9zLCBmYXIpIHtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gY2FtcG9zLnggLSBkaXIueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gY2FtcG9zLnkgLSBkaXIueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gY2FtcG9zLnogLSBkaXIueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGgueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0LnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hEaXJlY3RMaWdodHMoZGlycywgc2NlbmUsIG1hc2ssIGNhbWVyYSkge1xuICAgICAgICBsZXQgY250ID0gMDtcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCEoZGlyc1tpXS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBkaXJlY3Rpb25hbCA9IGRpcnNbaV07XG4gICAgICAgICAgICBjb25zdCB3dG0gPSBkaXJlY3Rpb25hbC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gZGlyZWN0aW9uYWwuX2xpbmVhckZpbmFsQ29sb3IgOiBkaXJlY3Rpb25hbC5fZmluYWxDb2xvcik7XG5cbiAgICAgICAgICAgIC8vIERpcmVjdGlvbmFsIGxpZ2h0cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgICAgIHd0bS5nZXRZKGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgICAgICBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzBdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi54O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi55O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzJdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi56O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcklkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodERpcltjbnRdKTtcblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbmFsLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlIC0gTkIgZGlyZWN0aW9uYWwgYXJlYSBsaWdodCBzcGVjdWxhciBpcyBhcHByb3hpbWF0ZWQgYnkgcHV0dGluZyB0aGUgYXJlYSBsaWdodCBhdCB0aGUgZmFyIGNsaXBcbiAgICAgICAgICAgICAgICB0aGlzLnNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24sIGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpLCBjYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb25hbC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gZGlyZWN0aW9uYWwuZ2V0UmVuZGVyRGF0YShjYW1lcmEsIDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IGRpcmVjdGlvbmFsLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd01hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5udW1DYXNjYWRlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBkaXJlY3Rpb25hbC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSAzO1xuICAgICAgICAgICAgICAgIHBhcmFtc1swXSA9IGRpcmVjdGlvbmFsLl9zaGFkb3dSZXNvbHV0aW9uOyAgLy8gTm90ZTogdGhpcyBuZWVkcyB0byBjaGFuZ2UgZm9yIG5vbi1zcXVhcmUgc2hhZG93IG1hcHMgKDIgY2FzY2FkZXMpLiBDdXJyZW50bHkgc3F1YXJlIGlzIHVzZWRcbiAgICAgICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNudDtcbiAgICB9XG5cbiAgICBzZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpIHtcbiAgICAgICAgY29uc3QgaFdpZHRoID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygtMC41LCAwLCAwKSk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzBdID0gaFdpZHRoLng7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzFdID0gaFdpZHRoLnk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzJdID0gaFdpZHRoLno7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFdpZHRoW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhIZWlnaHQgPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKDAsIDAsIDAuNSkpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMF0gPSBoSGVpZ2h0Lng7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsxXSA9IGhIZWlnaHQueTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzJdID0gaEhlaWdodC56O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0SGVpZ2h0W2NudF0pO1xuICAgIH1cblxuICAgIGRpc3BhdGNoT21uaUxpZ2h0KHNjZW5lLCBzY29wZSwgb21uaSwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IG9tbmkuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtjbnRdLnNldFZhbHVlKG9tbmkuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IG9tbmkuX2xpbmVhckZpbmFsQ29sb3IgOiBvbW5pLl9maW5hbENvbG9yKTtcbiAgICAgICAgd3RtLmdldFRyYW5zbGF0aW9uKG9tbmkuX3Bvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gb21uaS5fcG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gb21uaS5fcG9zaXRpb24ueTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gb21uaS5fcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBpZiAob21uaS5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlXG4gICAgICAgICAgICB0aGlzLnNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob21uaS5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgbWFwXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBvbW5pLmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gb21uaS5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IG9tbmkuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gb21uaS5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbM10gPSAxLjAgLyBvbW5pLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShvbW5pLnNoYWRvd0ludGVuc2l0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9tbmkuX2Nvb2tpZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2NudF0uc2V0VmFsdWUob21uaS5fY29va2llKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHd0bS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtjbnRdLnNldFZhbHVlKG9tbmkuY29va2llSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IHNwb3QuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWRbY250XS5zZXRWYWx1ZShzcG90Ll9pbm5lckNvbmVBbmdsZUNvcyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5fb3V0ZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWRbY250XS5zZXRWYWx1ZShzcG90LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBzcG90Ll9saW5lYXJGaW5hbENvbG9yIDogc3BvdC5fZmluYWxDb2xvcik7XG4gICAgICAgIHd0bS5nZXRUcmFuc2xhdGlvbihzcG90Ll9wb3NpdGlvbik7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IHNwb3QuX3Bvc2l0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IHNwb3QuX3Bvc2l0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IHNwb3QuX3Bvc2l0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgaWYgKHNwb3Quc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZVxuICAgICAgICAgICAgdGhpcy5zZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BvdHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgIHd0bS5nZXRZKHNwb3QuX2RpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgc3BvdC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMF0gPSBzcG90Ll9kaXJlY3Rpb24ueDtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gc3BvdC5fZGlyZWN0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVsyXSA9IHNwb3QuX2RpcmVjdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0RGlyW2NudF0pO1xuXG4gICAgICAgIGlmIChzcG90LmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHNwb3QuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBzcG90Ll9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gc3BvdC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBzcG90Ll9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIHNwb3QuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKHNwb3Quc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcG90Ll9jb29raWUpIHtcblxuICAgICAgICAgICAgLy8gaWYgc2hhZG93IGlzIG5vdCByZW5kZXJlZCwgd2UgbmVlZCB0byBldmFsdWF0ZSBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgaWYgKCFzcG90LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29va2llTWF0cml4ID0gTGlnaHRDYW1lcmEuZXZhbFNwb3RDb29raWVNYXRyaXgoc3BvdCk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUoY29va2llTWF0cml4LmRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWUpO1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2NudF0uc2V0VmFsdWUoc3BvdC5jb29raWVJbnRlbnNpdHkpO1xuICAgICAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzFdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLnk7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVsyXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS56O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bM10gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0udztcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtKTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzBdID0gc3BvdC5fY29va2llT2Zmc2V0Lng7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybVsxXSA9IHNwb3QuX2Nvb2tpZU9mZnNldC55O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVPZmZzZXRJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hMb2NhbExpZ2h0cyhzb3J0ZWRMaWdodHMsIHNjZW5lLCBtYXNrLCB1c2VkRGlyTGlnaHRzLCBzdGF0aWNMaWdodExpc3QpIHtcblxuICAgICAgICBsZXQgY250ID0gdXNlZERpckxpZ2h0cztcbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICBjb25zdCBvbW5pcyA9IHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfT01OSV07XG4gICAgICAgIGNvbnN0IG51bU9tbmlzID0gb21uaXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU9tbmlzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9tbmkgPSBvbW5pc1tpXTtcbiAgICAgICAgICAgIGlmICghKG9tbmkubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChvbW5pLmlzU3RhdGljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RhdGljSWQgPSAwO1xuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBsZXQgb21uaSA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB3aGlsZSAob21uaSAmJiBvbW5pLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgICAgIGNudCsrO1xuICAgICAgICAgICAgICAgIHN0YXRpY0lkKys7XG4gICAgICAgICAgICAgICAgb21uaSA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcHRzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9TUE9UXTtcbiAgICAgICAgY29uc3QgbnVtU3B0cyA9IHNwdHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNwdHM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc3BvdCA9IHNwdHNbaV07XG4gICAgICAgICAgICBpZiAoIShzcG90Lm1hc2sgJiBtYXNrKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoc3BvdC5pc1N0YXRpYykgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgIGNudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0YXRpY0xpZ2h0TGlzdCkge1xuICAgICAgICAgICAgbGV0IHNwb3QgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgd2hpbGUgKHNwb3QgJiYgc3BvdC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgICAgICBjbnQrKztcbiAgICAgICAgICAgICAgICBzdGF0aWNJZCsrO1xuICAgICAgICAgICAgICAgIHNwb3QgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyU2hhZG93c0xvY2FsKGxpZ2h0cywgY2FtZXJhKSB7XG5cbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCk7XG5cbiAgICAgICAgICAgIC8vIHNraXAgY2x1c3RlcmVkIHNoYWRvd3Mgd2l0aCBubyBhc3NpZ25lZCBhdGxhcyBzbG90XG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQgJiYgIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zaGFkb3dSZW5kZXJlci5yZW5kZXIobGlnaHQsIGNhbWVyYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleGVjdXRlIGZpcnN0IHBhc3Mgb3ZlciBkcmF3IGNhbGxzLCBpbiBvcmRlciB0byB1cGRhdGUgbWF0ZXJpYWxzIC8gc2hhZGVyc1xuICAgIC8vIFRPRE86IGltcGxlbWVudCB0aGlzOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2ViR0xfQVBJL1dlYkdMX2Jlc3RfcHJhY3RpY2VzI2NvbXBpbGVfc2hhZGVyc19hbmRfbGlua19wcm9ncmFtc19pbl9wYXJhbGxlbFxuICAgIC8vIHdoZXJlIGluc3RlYWQgb2YgY29tcGlsaW5nIGFuZCBsaW5raW5nIHNoYWRlcnMsIHdoaWNoIGlzIHNlcmlhbCBvcGVyYXRpb24sIHdlIGNvbXBpbGUgYWxsIG9mIHRoZW0gYW5kIHRoZW4gbGluayB0aGVtLCBhbGxvd2luZyB0aGUgd29yayB0b1xuICAgIC8vIHRha2UgcGxhY2UgaW4gcGFyYWxsZWxcbiAgICByZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGRyYXdDYWxscywgZHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgY3VsbGluZ01hc2ssIGxheWVyLCBwYXNzKSB7XG5cbiAgICAgICAgY29uc3QgYWRkQ2FsbCA9IChkcmF3Q2FsbCwgaXNOZXdNYXRlcmlhbCwgbGlnaHRNYXNrQ2hhbmdlZCkgPT4ge1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5kcmF3Q2FsbHMucHVzaChkcmF3Q2FsbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmlzTmV3TWF0ZXJpYWwucHVzaChpc05ld01hdGVyaWFsKTtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QubGlnaHRNYXNrQ2hhbmdlZC5wdXNoKGxpZ2h0TWFza0NoYW5nZWQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggZW1wdHkgYXJyYXlzXG4gICAgICAgIF9kcmF3Q2FsbExpc3QuZHJhd0NhbGxzLmxlbmd0aCA9IDA7XG4gICAgICAgIF9kcmF3Q2FsbExpc3QuaXNOZXdNYXRlcmlhbC5sZW5ndGggPSAwO1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmxpZ2h0TWFza0NoYW5nZWQubGVuZ3RoID0gMDtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBsaWdodEhhc2ggPSBsYXllciA/IGxheWVyLl9saWdodEhhc2ggOiAwO1xuICAgICAgICBsZXQgcHJldk1hdGVyaWFsID0gbnVsbCwgcHJldk9iakRlZnMsIHByZXZTdGF0aWMsIHByZXZMaWdodE1hc2s7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSAqL1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG5cbiAgICAgICAgICAgIC8vIGFwcGx5IHZpc2liaWxpdHkgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmIChjdWxsaW5nTWFzayAmJiBkcmF3Q2FsbC5tYXNrICYmICEoY3VsbGluZ01hc2sgJiBkcmF3Q2FsbC5tYXNrKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIHtcblxuICAgICAgICAgICAgICAgIGFkZENhbGwoZHJhd0NhbGwsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYSA9PT0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPj0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID49IGxheWVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5lbnN1cmVNYXRlcmlhbChkZXZpY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAmJiBtYXRlcmlhbCA9PT0gcHJldk1hdGVyaWFsICYmIG9iakRlZnMgIT09IHByZXZPYmpEZWZzKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG51bGw7IC8vIGZvcmNlIGNoYW5nZSBzaGFkZXIgaWYgdGhlIG9iamVjdCB1c2VzIGEgZGlmZmVyZW50IHZhcmlhbnQgb2YgdGhlIHNhbWUgbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuaXNTdGF0aWMgfHwgcHJldlN0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsU3dpdGNoZXMrKztcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuX3NjZW5lID0gc2NlbmU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBtYXRlcmlhbCBoYXMgZGlydHlCbGVuZCBzZXQsIG5vdGlmeSBzY2VuZSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5fZGlydHlCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUubGF5ZXJzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwuX3NoYWRlcltwYXNzXSB8fCBkcmF3Q2FsbC5fc2hhZGVyRGVmcyAhPT0gb2JqRGVmcyB8fCBkcmF3Q2FsbC5fbGlnaHRIYXNoICE9PSBsaWdodEhhc2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXJrZXIgdG8gYWxsb3cgdXMgdG8gc2VlIHRoZSBzb3VyY2Ugbm9kZSBmb3Igc2hhZGVyIGFsbG9jXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGRyYXdDYWxsLm5vZGUubmFtZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZHJhdyBjYWxscyBub3QgdXNpbmcgc3RhdGljIGxpZ2h0cyB1c2UgdmFyaWFudHMgY2FjaGUgb24gbWF0ZXJpYWwgdG8gcXVpY2tseSBmaW5kIHRoZSBzaGFkZXIsIGFzIHRoZXkgYXJlIGFsbFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc2FtZSBmb3IgdGhlIHNhbWUgcGFzcywgdXNpbmcgYWxsIGxpZ2h0cyBvZiB0aGUgc2NlbmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudEtleSA9IHBhc3MgKyAnXycgKyBvYmpEZWZzICsgJ18nICsgbGlnaHRIYXNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwuX3NoYWRlcltwYXNzXSA9IG1hdGVyaWFsLnZhcmlhbnRzW3ZhcmlhbnRLZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgbnVsbCwgc29ydGVkTGlnaHRzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnZhcmlhbnRzW3ZhcmlhbnRLZXldID0gZHJhd0NhbGwuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RhdGljIGxpZ2h0cyBnZW5lcmF0ZSB1bmlxdWUgc2hhZGVyIHBlciBkcmF3IGNhbGwsIGFzIHN0YXRpYyBsaWdodHMgYXJlIHVuaXF1ZSBwZXIgZHJhdyBjYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHNvIHZhcmlhbnRzIGNhY2hlIGlzIG5vdCB1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwuX2xpZ2h0SGFzaCA9IGxpZ2h0SGFzaDtcblxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdLCBcIm5vIHNoYWRlciBmb3IgcGFzc1wiLCBtYXRlcmlhbCk7XG5cbiAgICAgICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsLCAhcHJldk1hdGVyaWFsIHx8IGxpZ2h0TWFzayAhPT0gcHJldkxpZ2h0TWFzayk7XG5cbiAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBwcmV2T2JqRGVmcyA9IG9iakRlZnM7XG4gICAgICAgICAgICAgICAgcHJldkxpZ2h0TWFzayA9IGxpZ2h0TWFzaztcbiAgICAgICAgICAgICAgICBwcmV2U3RhdGljID0gZHJhd0NhbGwuaXNTdGF0aWM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9jZXNzIHRoZSBiYXRjaCBvZiBzaGFkZXJzIGNyZWF0ZWQgaGVyZVxuICAgICAgICBkZXZpY2UuZW5kU2hhZGVyQmF0Y2g/LigpO1xuXG4gICAgICAgIHJldHVybiBfZHJhd0NhbGxMaXN0O1xuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWcgPSAxIDw8IHBhc3M7XG5cbiAgICAgICAgLy8gUmVuZGVyIHRoZSBzY2VuZVxuICAgICAgICBsZXQgc2tpcE1hdGVyaWFsID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHNDb3VudCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVwYXJlZENhbGxzQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzW2ldO1xuXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY29tbWFuZCkge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIGNvbW1hbmRcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5jb21tYW5kKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGEgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld01hdGVyaWFsID0gcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFza0NoYW5nZWQgPSBwcmVwYXJlZENhbGxzLmxpZ2h0TWFza0NoYW5nZWRbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChuZXdNYXRlcmlhbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IGRyYXdDYWxsLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2hhZGVyLmZhaWxlZCAmJiAhZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7cGFzc30gb2JqRGVmcz0ke29iakRlZnN9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCByZW5kZXJpbmcgd2l0aCB0aGUgbWF0ZXJpYWwgaWYgc2hhZGVyIGZhaWxlZFxuICAgICAgICAgICAgICAgICAgICBza2lwTWF0ZXJpYWwgPSBzaGFkZXIuZmFpbGVkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2tpcE1hdGVyaWFsKVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodE1hc2tDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VkRGlyTGlnaHRzID0gdGhpcy5kaXNwYXRjaERpcmVjdExpZ2h0cyhzb3J0ZWRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXSwgc2NlbmUsIGxpZ2h0TWFzaywgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hMb2NhbExpZ2h0cyhzb3J0ZWRMaWdodHMsIHNjZW5lLCBsaWdodE1hc2ssIHVzZWREaXJMaWdodHMsIGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3QpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbHBoYVRlc3RJZC5zZXRWYWx1ZShtYXRlcmlhbC5hbHBoYVRlc3QpO1xuXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZGluZyhtYXRlcmlhbC5ibGVuZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5ibGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLnNlcGFyYXRlQWxwaGFCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUobWF0ZXJpYWwuYmxlbmRTcmMsIG1hdGVyaWFsLmJsZW5kRHN0LCBtYXRlcmlhbC5ibGVuZFNyY0FscGhhLCBtYXRlcmlhbC5ibGVuZERzdEFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlKG1hdGVyaWFsLmJsZW5kRXF1YXRpb24sIG1hdGVyaWFsLmJsZW5kQWxwaGFFcXVhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZEZ1bmN0aW9uKG1hdGVyaWFsLmJsZW5kU3JjLCBtYXRlcmlhbC5ibGVuZERzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kRXF1YXRpb24obWF0ZXJpYWwuYmxlbmRFcXVhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUobWF0ZXJpYWwucmVkV3JpdGUsIG1hdGVyaWFsLmdyZWVuV3JpdGUsIG1hdGVyaWFsLmJsdWVXcml0ZSwgbWF0ZXJpYWwuYWxwaGFXcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKG1hdGVyaWFsLmRlcHRoV3JpdGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoaXMgZml4ZXMgdGhlIGNhc2Ugd2hlcmUgdGhlIHVzZXIgd2lzaGVzIHRvIHR1cm4gb2ZmIGRlcHRoIHRlc3RpbmcgYnV0IHdhbnRzIHRvIHdyaXRlIGRlcHRoXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kZXB0aFdyaXRlICYmICFtYXRlcmlhbC5kZXB0aFRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEZ1bmMoRlVOQ19BTFdBWVMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoVGVzdCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEZ1bmMobWF0ZXJpYWwuZGVwdGhGdW5jKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFRlc3QobWF0ZXJpYWwuZGVwdGhUZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRBbHBoYVRvQ292ZXJhZ2UobWF0ZXJpYWwuYWxwaGFUb0NvdmVyYWdlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGVwdGhCaWFzIHx8IG1hdGVyaWFsLnNsb3BlRGVwdGhCaWFzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhc1ZhbHVlcyhtYXRlcmlhbC5kZXB0aEJpYXMsIG1hdGVyaWFsLnNsb3BlRGVwdGhCaWFzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDdWxsTW9kZShjYW1lcmEuX2N1bGxGYWNlcywgZmxpcEZhY2VzLCBkcmF3Q2FsbCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsRnJvbnQgPSBkcmF3Q2FsbC5zdGVuY2lsRnJvbnQgfHwgbWF0ZXJpYWwuc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWxCYWNrID0gZHJhd0NhbGwuc3RlbmNpbEJhY2sgfHwgbWF0ZXJpYWwuc3RlbmNpbEJhY2s7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsVGVzdCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCA9PT0gc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlkZW50aWNhbCBmcm9udC9iYWNrIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuYyhzdGVuY2lsRnJvbnQuZnVuYywgc3RlbmNpbEZyb250LnJlZiwgc3RlbmNpbEZyb250LnJlYWRNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uKHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXBhcmF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBmcm9udFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0Zyb250KHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoc3RlbmNpbEZyb250LmZhaWwsIHN0ZW5jaWxGcm9udC56ZmFpbCwgc3RlbmNpbEZyb250LnpwYXNzLCBzdGVuY2lsRnJvbnQud3JpdGVNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCBmcm9udFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0Zyb250KEZVTkNfQUxXQVlTLCAwLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KFNURU5DSUxPUF9LRUVQLCBTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIDB4RkYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNCYWNrKHN0ZW5jaWxCYWNrLmZ1bmMsIHN0ZW5jaWxCYWNrLnJlZiwgc3RlbmNpbEJhY2sucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhzdGVuY2lsQmFjay5mYWlsLCBzdGVuY2lsQmFjay56ZmFpbCwgc3RlbmNpbEJhY2suenBhc3MsIHN0ZW5jaWxCYWNrLndyaXRlTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0JhY2soRlVOQ19BTFdBWVMsIDAsIDB4RkYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsVGVzdChmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGRyYXdDYWxsLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJSTogbWVzaEluc3RhbmNlIG92ZXJyaWRlc1xuICAgICAgICAgICAgICAgIGRyYXdDYWxsLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBwYXNzRmxhZyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldFZlcnRleEJ1ZmZlcnMoZGV2aWNlLCBtZXNoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldE1vcnBoaW5nKGRldmljZSwgZHJhd0NhbGwubW9ycGhJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTa2lubmluZyhkZXZpY2UsIGRyYXdDYWxsKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMoZHJhd0NhbGwsIHBhc3MpO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBkcmF3Q2FsbC5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0SW5kZXhCdWZmZXIobWVzaC5pbmRleEJ1ZmZlcltzdHlsZV0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbGJhY2soZHJhd0NhbGwsIGkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24gJiYgY2FtZXJhLnhyLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3cyA9IGNhbWVyYS54ci52aWV3cztcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdzLmxlbmd0aDsgdisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gdmlld3Nbdl07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh2aWV3LnZpZXdwb3J0LngsIHZpZXcudmlld3BvcnQueSwgdmlldy52aWV3cG9ydC56LCB2aWV3LnZpZXdwb3J0LncpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZC5zZXRWYWx1ZSh2aWV3LnZpZXdPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZDMuc2V0VmFsdWUodmlldy52aWV3TWF0My5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Byb2pJZC5zZXRWYWx1ZSh2aWV3LnByb2pWaWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodmlldy5wb3NpdGlvbik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdJbnN0YW5jZTIoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdJbnN0YW5jZShkZXZpY2UsIGRyYXdDYWxsLCBtZXNoLCBzdHlsZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBVbnNldCBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzIGJhY2sgdG8gbWF0ZXJpYWwgdmFsdWVzIGlmIG5leHQgZHJhdyBjYWxsIHdpbGwgdXNlIHRoZSBzYW1lIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgaWYgKGkgPCBwcmVwYXJlZENhbGxzQ291bnQgLSAxICYmICFwcmVwYXJlZENhbGxzLmlzTmV3TWF0ZXJpYWxbaSArIDFdKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBkcmF3Q2FsbC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXJGb3J3YXJkKGNhbWVyYSwgYWxsRHJhd0NhbGxzLCBhbGxEcmF3Q2FsbHNDb3VudCwgc29ydGVkTGlnaHRzLCBwYXNzLCBjdWxsaW5nTWFzaywgZHJhd0NhbGxiYWNrLCBsYXllciwgZmxpcEZhY2VzKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBmb3J3YXJkU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHJ1biBmaXJzdCBwYXNzIG92ZXIgZHJhdyBjYWxscyBhbmQgaGFuZGxlIG1hdGVyaWFsIC8gc2hhZGVyIHVwZGF0ZXNcbiAgICAgICAgY29uc3QgcHJlcGFyZWRDYWxscyA9IHRoaXMucmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMoY2FtZXJhLCBhbGxEcmF3Q2FsbHMsIGFsbERyYXdDYWxsc0NvdW50LCBzb3J0ZWRMaWdodHMsIGN1bGxpbmdNYXNrLCBsYXllciwgcGFzcyk7XG5cbiAgICAgICAgLy8gcmVuZGVyIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgIHRoaXMucmVuZGVyRm9yd2FyZEludGVybmFsKGNhbWVyYSwgcHJlcGFyZWRDYWxscywgc29ydGVkTGlnaHRzLCBwYXNzLCBkcmF3Q2FsbGJhY2ssIGZsaXBGYWNlcyk7XG5cbiAgICAgICAgX2RyYXdDYWxsTGlzdC5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fZm9yd2FyZFRpbWUgKz0gbm93KCkgLSBmb3J3YXJkU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBzZXRTY2VuZUNvbnN0YW50cygpIHtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuXG4gICAgICAgIC8vIFNldCB1cCBhbWJpZW50L2V4cG9zdXJlXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpO1xuXG4gICAgICAgIC8vIFNldCB1cCB0aGUgZm9nXG4gICAgICAgIGlmIChzY2VuZS5mb2cgIT09IEZPR19OT05FKSB7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzBdID0gc2NlbmUuZm9nQ29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMV0gPSBzY2VuZS5mb2dDb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclsyXSA9IHNjZW5lLmZvZ0NvbG9yLmI7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2dDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuZm9nQ29sb3JbaV0sIDIuMik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5mb2dDb2xvcklkLnNldFZhbHVlKHRoaXMuZm9nQ29sb3IpO1xuICAgICAgICAgICAgaWYgKHNjZW5lLmZvZyA9PT0gRk9HX0xJTkVBUikge1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nU3RhcnRJZC5zZXRWYWx1ZShzY2VuZS5mb2dTdGFydCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dFbmRJZC5zZXRWYWx1ZShzY2VuZS5mb2dFbmQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZC5zZXRWYWx1ZShzY2VuZS5mb2dEZW5zaXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB1cCBzY3JlZW4gc2l6ZSAvLyBzaG91bGQgYmUgUlQgc2l6ZT9cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMF0gPSBkZXZpY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMV0gPSBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzJdID0gMSAvIGRldmljZS53aWR0aDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVszXSA9IDEgLyBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB0aGlzLnNjcmVlblNpemVJZC5zZXRWYWx1ZSh0aGlzLl9zY3JlZW5TaXplKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbXBVcGRhdGVkRmxhZ3MgLSBGbGFncyBvZiB3aGF0IHdhcyB1cGRhdGVkLlxuICAgICAqL1xuICAgIHVwZGF0ZUxpZ2h0U3RhdHMoY29tcCwgY29tcFVwZGF0ZWRGbGFncykge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBpZiAoY29tcFVwZGF0ZWRGbGFncyAmIENPTVBVUERBVEVEX0xJR0hUUyB8fCAhc2NlbmUuX3N0YXRzVXBkYXRlZCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBzY2VuZS5fc3RhdHM7XG4gICAgICAgICAgICBzdGF0cy5saWdodHMgPSBjb21wLl9saWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgc3RhdHMuZHluYW1pY0xpZ2h0cyA9IDA7XG4gICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cyA9IDA7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdHMubGlnaHRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsID0gY29tcC5fbGlnaHRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChsLmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKChsLm1hc2sgJiBNQVNLX0FGRkVDVF9EWU5BTUlDKSB8fCAobC5tYXNrICYgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQpKSB7IC8vIGlmIGFmZmVjdHMgZHluYW1pYyBvciBiYWtlZCBvYmplY3RzIGluIHJlYWwtdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMuZHluYW1pY0xpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChsLm1hc2sgJiBNQVNLX0JBS0UpIHsgLy8gaWYgYmFrZWQgaW50byBsaWdodG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLmJha2VkTGlnaHRzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29tcFVwZGF0ZWRGbGFncyAmIENPTVBVUERBVEVEX0lOU1RBTkNFUyB8fCAhc2NlbmUuX3N0YXRzVXBkYXRlZCkge1xuICAgICAgICAgICAgc2NlbmUuX3N0YXRzLm1lc2hJbnN0YW5jZXMgPSBjb21wLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lLl9zdGF0c1VwZGF0ZWQgPSB0cnVlO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBCdWlsZHMgYSBmcmFtZSBncmFwaCBmb3IgdGhlIHJlbmRlcmluZyBvZiB0aGUgd2hvbGUgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWUtZ3JhcGguanMnKS5GcmFtZUdyYXBofSBmcmFtZUdyYXBoIC0gVGhlIGZyYW1lLWdyYXBoIHRoYXQgaXMgYnVpbHQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbGF5ZXJDb21wb3NpdGlvbiAtIFRoZVxuICAgICAqIGxheWVyIGNvbXBvc2l0aW9uIHVzZWQgdG8gYnVpbGQgdGhlIGZyYW1lIGdyYXBoLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBidWlsZEZyYW1lR3JhcGgoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbikge1xuXG4gICAgICAgIGZyYW1lR3JhcGgucmVzZXQoKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZShsYXllckNvbXBvc2l0aW9uKTtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgY29va2llcyBmb3IgYWxsIGxvY2FsIHZpc2libGUgbGlnaHRzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUubGlnaHRpbmcuY29va2llc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJDb29raWVzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyQ29va2llcyhsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsICdDbHVzdGVyZWRDb29raWVzJyk7XG4gICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2NhbCBzaGFkb3dzXG4gICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgc2hhZG93cyBmb3IgYWxsIGxvY2FsIHZpc2libGUgbGlnaHRzIC0gdGhlc2Ugc2hhZG93IG1hcHMgYXJlIHNoYXJlZCBieSBhbGwgY2FtZXJhc1xuICAgICAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgfHwgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiB0aGlzLnNjZW5lLmxpZ2h0aW5nLnNoYWRvd3NFbmFibGVkKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyU2hhZG93c0xvY2FsKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJTaGFkb3dzTG9jYWwobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX09NTkldKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGxpZ2h0IGNsdXN0ZXJzXG4gICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVDbHVzdGVycyhsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsICdMb2NhbFNoYWRvd01hcHMnKTtcbiAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuXG4gICAgICAgIC8vIG1haW4gcGFzc2VzXG4gICAgICAgIGxldCBzdGFydEluZGV4ID0gMDtcbiAgICAgICAgbGV0IG5ld1N0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgbGV0IHJlbmRlclRhcmdldCA9IG51bGw7XG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBsYXllckNvbXBvc2l0aW9uLl9yZW5kZXJBY3Rpb25zO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW3JlbmRlckFjdGlvbi5jYW1lcmFJbmRleF07XG5cbiAgICAgICAgICAgIC8vIHNraXAgZGlzYWJsZWQgbGF5ZXJzXG4gICAgICAgICAgICBpZiAoIXJlbmRlckFjdGlvbi5pc0xheWVyRW5hYmxlZChsYXllckNvbXBvc2l0aW9uKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpc0RlcHRoTGF5ZXIgPSBsYXllci5pZCA9PT0gTEFZRVJJRF9ERVBUSDtcbiAgICAgICAgICAgIGNvbnN0IGlzR3JhYlBhc3MgPSBpc0RlcHRoTGF5ZXIgJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKTtcblxuICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgc2hhZG93cyBnZXQgcmUtcmVuZGVyZWQgZm9yIGVhY2ggY2FtZXJhXG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uLmhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzICYmIGNhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuYnVpbGRGcmFtZUdyYXBoKGZyYW1lR3JhcGgsIHJlbmRlckFjdGlvbiwgY2FtZXJhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RhcnQgb2YgYmxvY2sgb2YgcmVuZGVyIGFjdGlvbnMgcmVuZGVyaW5nIHRvIHRoZSBzYW1lIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIGlmIChuZXdTdGFydCkge1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc3RhcnRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgcmVuZGVyVGFyZ2V0ID0gcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZmluZCB0aGUgbmV4dCBlbmFibGVkIHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgIGxldCBuZXh0SW5kZXggPSBpICsgMTtcbiAgICAgICAgICAgIHdoaWxlIChyZW5kZXJBY3Rpb25zW25leHRJbmRleF0gJiYgIXJlbmRlckFjdGlvbnNbbmV4dEluZGV4XS5pc0xheWVyRW5hYmxlZChsYXllckNvbXBvc2l0aW9uKSkge1xuICAgICAgICAgICAgICAgIG5leHRJbmRleCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpbmZvIGFib3V0IHRoZSBuZXh0IHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IG5leHRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW25leHRJbmRleF07XG4gICAgICAgICAgICBjb25zdCBpc05leHRMYXllckRlcHRoID0gbmV4dFJlbmRlckFjdGlvbiA/IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W25leHRSZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF0uaWQgPT09IExBWUVSSURfREVQVEggOiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyR3JhYlBhc3MgPSBpc05leHRMYXllckRlcHRoICYmIChjYW1lcmEucmVuZGVyU2NlbmVDb2xvck1hcCB8fCBjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCk7XG5cbiAgICAgICAgICAgIC8vIGVuZCBvZiB0aGUgYmxvY2sgdXNpbmcgdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKCFuZXh0UmVuZGVyQWN0aW9uIHx8IG5leHRSZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ICE9PSByZW5kZXJUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBuZXh0UmVuZGVyQWN0aW9uLmhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzIHx8IGlzTmV4dExheWVyR3JhYlBhc3MgfHwgaXNHcmFiUGFzcykge1xuXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIHRoZSByZW5kZXIgYWN0aW9ucyBpbiB0aGUgcmFuZ2VcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgaSwgaXNHcmFiUGFzcyk7XG5cbiAgICAgICAgICAgICAgICAvLyBwb3N0cHJvY2Vzc2luZ1xuICAgICAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzICYmIGNhbWVyYT8ub25Qb3N0cHJvY2Vzc2luZykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc1Bvc3Rwcm9jZXNzaW5nKHJlbmRlckFjdGlvbiwgbGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgUG9zdHByb2Nlc3NgKTtcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZS1ncmFwaC5qcycpLkZyYW1lR3JhcGh9IGZyYW1lR3JhcGggLSBUaGUgZnJhbWUgZ3JhcGguXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbGF5ZXJDb21wb3NpdGlvbiAtIFRoZVxuICAgICAqIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgZW5kSW5kZXgsIGlzR3JhYlBhc3MpIHtcblxuICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICBjb25zdCByYW5nZSA9IHsgc3RhcnQ6IHN0YXJ0SW5kZXgsIGVuZDogZW5kSW5kZXggfTtcbiAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NSZW5kZXJBY3Rpb25zKGxheWVyQ29tcG9zaXRpb24sIHJhbmdlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGNvbnN0IHN0YXJ0UmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tzdGFydEluZGV4XTtcbiAgICAgICAgY29uc3QgZW5kUmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tlbmRJbmRleF07XG4gICAgICAgIGNvbnN0IHN0YXJ0TGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtzdGFydFJlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gc3RhcnRMYXllci5jYW1lcmFzW3N0YXJ0UmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICBpZiAoY2FtZXJhKSB7XG5cbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIG9uIHRoZSBjYW1lcmEgY29tcG9uZW50IGJlZm9yZSByZW5kZXJpbmcgd2l0aCB0aGlzIGNhbWVyYSBmb3IgdGhlIGZpcnN0IHRpbWVcbiAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSAmJiBjYW1lcmEub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLmJlZm9yZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2FtZXJhLm9uUHJlUmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgd2hlbiB3ZSdyZSBkb25lIHJlbmRlcmluZyB3aXRoIHRoaXMgY2FtZXJhXG4gICAgICAgICAgICBpZiAoZW5kUmVuZGVyQWN0aW9uLmxhc3RDYW1lcmFVc2UgJiYgY2FtZXJhLm9uUG9zdFJlbmRlcikge1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuYWZ0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNhbWVyYS5vblBvc3RSZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVwdGggZ3JhYiBwYXNzIG9uIHdlYmdsMSBpcyBub3JtYWwgcmVuZGVyIHBhc3MgKHNjZW5lIGdldHMgcmUtcmVuZGVyZWQpXG4gICAgICAgIGNvbnN0IGdyYWJQYXNzUmVxdWlyZWQgPSBpc0dyYWJQYXNzICYmIFNjZW5lR3JhYi5yZXF1aXJlc1JlbmRlclBhc3ModGhpcy5kZXZpY2UsIGNhbWVyYSk7XG4gICAgICAgIGNvbnN0IGlzUmVhbFBhc3MgPSAhaXNHcmFiUGFzcyB8fCBncmFiUGFzc1JlcXVpcmVkO1xuXG4gICAgICAgIGlmIChpc1JlYWxQYXNzKSB7XG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuaW5pdChyZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCA9IGNhbWVyYS5jYW1lcmEuZnVsbFNpemVDbGVhclJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChncmFiUGFzc1JlcXVpcmVkKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB3ZWJnbDEgZGVwdGggcmVuZGVyaW5nIGNsZWFyIHZhbHVlc1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJDb2xvcih3ZWJnbDFEZXB0aENsZWFyQ29sb3IpO1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aCgxLjApO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlbmRlclBhc3MuZnVsbFNpemVDbGVhclJlY3QpIHsgLy8gaWYgY2FtZXJhIHJlbmRlcmluZyBjb3ZlcnMgdGhlIGZ1bGwgdmlld3BvcnRcblxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhckNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJDb2xvcihjYW1lcmEuY2FtZXJhLmNsZWFyQ29sb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyRGVwdGgoY2FtZXJhLmNhbWVyYS5jbGVhckRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyU3RlbmNpbChjYW1lcmEuY2FtZXJhLmNsZWFyU3RlbmNpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgJHtpc0dyYWJQYXNzID8gJ1NjZW5lR3JhYicgOiAnUmVuZGVyQWN0aW9uJ30gJHtzdGFydEluZGV4fS0ke2VuZEluZGV4fSBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgQ2FtOiAke2NhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICctJ31gKTtcbiAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICB1cGRhdGUoY29tcCkge1xuXG4gICAgICAgIHRoaXMuZnJhbWVVcGRhdGUoKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSZW5kZXJlci5mcmFtZVVwZGF0ZSgpO1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgc2t5Ym94LCBzaW5jZSB0aGlzIG1pZ2h0IGNoYW5nZSBfbWVzaEluc3RhbmNlc1xuICAgICAgICB0aGlzLnNjZW5lLl91cGRhdGVTa3kodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvbiBpZiBzb21ldGhpbmcgaGFzIGJlZW4gaW52YWxpZGF0ZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IHRoaXMudXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuICAgICAgICBjb25zdCBsaWdodHNDaGFuZ2VkID0gKHVwZGF0ZWQgJiBDT01QVVBEQVRFRF9MSUdIVFMpICE9PSAwO1xuXG4gICAgICAgIHRoaXMudXBkYXRlTGlnaHRTdGF0cyhjb21wLCB1cGRhdGVkKTtcblxuICAgICAgICAvLyBTaW5nbGUgcGVyLWZyYW1lIGNhbGN1bGF0aW9uc1xuICAgICAgICB0aGlzLmJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCk7XG4gICAgICAgIHRoaXMuc2V0U2NlbmVDb25zdGFudHMoKTtcblxuICAgICAgICAvLyB2aXNpYmlsaXR5IGN1bGxpbmcgb2YgbGlnaHRzLCBtZXNoSW5zdGFuY2VzLCBzaGFkb3dzIGNhc3RlcnNcbiAgICAgICAgLy8gYWZ0ZXIgdGhpcyB0aGUgc2NlbmUgY3VsbGluZyBpcyBkb25lIGFuZCBzY3JpcHQgY2FsbGJhY2tzIGNhbiBiZSBjYWxsZWQgdG8gcmVwb3J0IHdoaWNoIG9iamVjdHMgYXJlIHZpc2libGVcbiAgICAgICAgdGhpcy5jdWxsQ29tcG9zaXRpb24oY29tcCk7XG5cbiAgICAgICAgLy8gR1BVIHVwZGF0ZSBmb3IgYWxsIHZpc2libGUgb2JqZWN0c1xuICAgICAgICB0aGlzLmdwdVVwZGF0ZShjb21wLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICByZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhLm9uUG9zdHByb2Nlc3NpbmcpO1xuXG4gICAgICAgIC8vIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgZm9yIGNhbWVyYVxuICAgICAgICBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwYXNzIHJlcHJlc2VudGluZyB0aGUgbGF5ZXIgY29tcG9zaXRpb24ncyByZW5kZXIgYWN0aW9ucyBpbiB0aGUgc3BlY2lmaWVkIHJhbmdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uIHRvIHJlbmRlci5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc1JlbmRlckFjdGlvbnMoY29tcCwgcmFuZ2UpIHtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IHJhbmdlLnN0YXJ0OyBpIDw9IHJhbmdlLmVuZDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlbmRlckFjdGlvbihjb21wLCByZW5kZXJBY3Rpb25zW2ldLCBpID09PSByYW5nZS5zdGFydCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb259IHJlbmRlckFjdGlvbiAtIFRoZSByZW5kZXJcbiAgICAgKiBhY3Rpb24uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaXJzdFJlbmRlckFjdGlvbiAtIFRydWUgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBpbiB0aGUgcmVuZGVyIHBhc3MuXG4gICAgICovXG4gICAgcmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbiwgZmlyc3RSZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24uaXNMYXllckVuYWJsZWQoY29tcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgY2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJ25vbmFtZScpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGxheWVyLm5hbWUpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZHJhd1RpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gQ2FsbCBwcmVyZW5kZXIgY2FsbGJhY2sgaWYgdGhlcmUncyBvbmVcbiAgICAgICAgaWYgKCF0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUoY2FtZXJhUGFzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJhbnNwYXJlbnQgJiYgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGxlZCBmb3IgdGhlIGZpcnN0IHN1YmxheWVyIGFuZCBmb3IgZXZlcnkgY2FtZXJhXG4gICAgICAgIGlmICghKGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBpZiAobGF5ZXIub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblByZVJlbmRlcihjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCBhIGZpcnN0IHJlbmRlciBhY3Rpb24gdG8gdGhlIHJlbmRlciB0YXJnZXQsIG9yIGlmIHRoZSByZW5kZXIgdGFyZ2V0IHdhcyBub3RcbiAgICAgICAgICAgIC8vIGZ1bGx5IGNsZWFyZWQgb24gcGFzcyBzdGFydCwgd2UgbmVlZCB0byBleGVjdXRlIGNsZWFycyBoZXJlXG4gICAgICAgICAgICBpZiAoIWZpcnN0UmVuZGVyQWN0aW9uIHx8ICFjYW1lcmEuY2FtZXJhLmZ1bGxTaXplQ2xlYXJSZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhcihyZW5kZXJBY3Rpb24sIGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzb3J0VGltZSA9IG5vdygpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9zb3J0VmlzaWJsZSh0cmFuc3BhcmVudCwgY2FtZXJhLmNhbWVyYS5ub2RlLCBjYW1lcmFQYXNzKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5fc29ydFRpbWUgKz0gbm93KCkgLSBzb3J0VGltZTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIC8vIGFkZCBkZWJ1ZyBtZXNoIGluc3RhbmNlcyB0byB2aXNpYmxlIGxpc3RcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLm9uUHJlUmVuZGVyTGF5ZXIobGF5ZXIsIHZpc2libGUsIHRyYW5zcGFyZW50KTtcblxuICAgICAgICAgICAgLy8gdXBsb2FkIGNsdXN0ZXJlZCBsaWdodHMgdW5pZm9ybXNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycy5hY3RpdmF0ZSh0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAgICAgICAgIC8vIGRlYnVnIHJlbmRlcmluZyBvZiBjbHVzdGVyc1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgJiYgdGhpcy5zY2VuZS5saWdodGluZy5kZWJ1Z0xheWVyID09PSBsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFdvcmxkQ2x1c3RlcnNEZWJ1Zy5yZW5kZXIocmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMsIHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBub3QgdmVyeSBjbGV2ZXIgZ2xvYmFsIHZhcmlhYmxlIHdoaWNoIGlzIG9ubHkgdXNlZnVsIHdoZW4gdGhlcmUncyBqdXN0IG9uZSBjYW1lcmFcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYSA9IGNhbWVyYS5jYW1lcmE7XG5cbiAgICAgICAgICAgIGNvbnN0IHZpZXdDb3VudCA9IHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLmNhbWVyYSwgcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHJlbmRlckFjdGlvbi52aWV3QmluZEdyb3VwcywgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0LCB2aWV3Q291bnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmFibGUgZmxpcCBmYWNlcyBpZiBlaXRoZXIgdGhlIGNhbWVyYSBoYXMgX2ZsaXBGYWNlcyBlbmFibGVkIG9yIHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICAvLyBoYXMgZmxpcFkgZW5hYmxlZFxuICAgICAgICAgICAgY29uc3QgZmxpcEZhY2VzID0gISEoY2FtZXJhLmNhbWVyYS5fZmxpcEZhY2VzIF4gcmVuZGVyQWN0aW9uPy5yZW5kZXJUYXJnZXQ/LmZsaXBZKTtcblxuICAgICAgICAgICAgY29uc3QgZHJhd3MgPSB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJGb3J3YXJkKGNhbWVyYS5jYW1lcmEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLl9zcGxpdExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5zaGFkZXJQYXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLmN1bGxpbmdNYXNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uRHJhd0NhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzKTtcbiAgICAgICAgICAgIGxheWVyLl9mb3J3YXJkRHJhd0NhbGxzICs9IHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgLSBkcmF3cztcblxuICAgICAgICAgICAgLy8gUmV2ZXJ0IHRlbXAgZnJhbWUgc3R1ZmZcbiAgICAgICAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIG5vdCBiZSBoZXJlLCBhcyBlYWNoIHJlbmRlcmluZyAvIGNsZWFyaW5nIHNob3VsZCBleHBsaWNpdGx5IHNldCB1cCB3aGF0XG4gICAgICAgICAgICAvLyBpdCByZXF1aXJlcyAodGhlIHByb3BlcnRpZXMgYXJlIHBhcnQgb2YgcmVuZGVyIHBpcGVsaW5lIG9uIFdlYkdQVSBhbnl3YXlzKVxuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFRlc3QoZmFsc2UpOyAvLyBkb24ndCBsZWFrIHN0ZW5jaWwgc3RhdGVcbiAgICAgICAgICAgIGRldmljZS5zZXRBbHBoYVRvQ292ZXJhZ2UoZmFsc2UpOyAvLyBkb24ndCBsZWFrIGEyYyBzdGF0ZVxuICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsIGxheWVyJ3MgcG9zdHJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyT3BhcXVlKGNhbWVyYVBhc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGF5ZXIub25Qb3N0UmVuZGVyICYmICEobGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgJj0gfih0cmFuc3BhcmVudCA/IDIgOiAxKTtcbiAgICAgICAgICAgIGlmIChsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXIoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGxheWVyLl9yZW5kZXJUaW1lICs9IG5vdygpIC0gZHJhd1RpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cbn1cblxuZXhwb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsid2ViZ2wxRGVwdGhDbGVhckNvbG9yIiwiQ29sb3IiLCJfZHJhd0NhbGxMaXN0IiwiZHJhd0NhbGxzIiwiaXNOZXdNYXRlcmlhbCIsImxpZ2h0TWFza0NoYW5nZWQiLCJGb3J3YXJkUmVuZGVyZXIiLCJSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZXZpY2UiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9tYXRlcmlhbFN3aXRjaGVzIiwiX2RlcHRoTWFwVGltZSIsIl9mb3J3YXJkVGltZSIsIl9zb3J0VGltZSIsInNjb3BlIiwiZm9nQ29sb3JJZCIsInJlc29sdmUiLCJmb2dTdGFydElkIiwiZm9nRW5kSWQiLCJmb2dEZW5zaXR5SWQiLCJhbWJpZW50SWQiLCJza3lib3hJbnRlbnNpdHlJZCIsImN1YmVNYXBSb3RhdGlvbk1hdHJpeElkIiwibGlnaHRDb2xvcklkIiwibGlnaHREaXIiLCJsaWdodERpcklkIiwibGlnaHRTaGFkb3dNYXBJZCIsImxpZ2h0U2hhZG93TWF0cml4SWQiLCJsaWdodFNoYWRvd1BhcmFtc0lkIiwibGlnaHRTaGFkb3dJbnRlbnNpdHkiLCJsaWdodFJhZGl1c0lkIiwibGlnaHRQb3MiLCJsaWdodFBvc0lkIiwibGlnaHRXaWR0aCIsImxpZ2h0V2lkdGhJZCIsImxpZ2h0SGVpZ2h0IiwibGlnaHRIZWlnaHRJZCIsImxpZ2h0SW5BbmdsZUlkIiwibGlnaHRPdXRBbmdsZUlkIiwibGlnaHRDb29raWVJZCIsImxpZ2h0Q29va2llSW50SWQiLCJsaWdodENvb2tpZU1hdHJpeElkIiwibGlnaHRDb29raWVPZmZzZXRJZCIsInNoYWRvd01hdHJpeFBhbGV0dGVJZCIsInNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZCIsInNoYWRvd0Nhc2NhZGVDb3VudElkIiwic2NyZWVuU2l6ZUlkIiwiX3NjcmVlblNpemUiLCJGbG9hdDMyQXJyYXkiLCJmb2dDb2xvciIsImFtYmllbnRDb2xvciIsImRlc3Ryb3kiLCJkaXNwYXRjaEdsb2JhbExpZ2h0cyIsInNjZW5lIiwiYW1iaWVudExpZ2h0IiwiciIsImciLCJiIiwiZ2FtbWFDb3JyZWN0aW9uIiwiaSIsIk1hdGgiLCJwb3ciLCJwaHlzaWNhbFVuaXRzIiwiYW1iaWVudEx1bWluYW5jZSIsInNldFZhbHVlIiwic2t5Ym94THVtaW5hbmNlIiwic2t5Ym94SW50ZW5zaXR5IiwiX3NreWJveFJvdGF0aW9uTWF0MyIsImRhdGEiLCJfcmVzb2x2ZUxpZ2h0IiwibGlnaHQiLCJzZXRMVENEaXJlY3Rpb25hbExpZ2h0Iiwid3RtIiwiY250IiwiZGlyIiwiY2FtcG9zIiwiZmFyIiwieCIsInkiLCJ6IiwiaFdpZHRoIiwidHJhbnNmb3JtVmVjdG9yIiwiVmVjMyIsImhIZWlnaHQiLCJkaXNwYXRjaERpcmVjdExpZ2h0cyIsImRpcnMiLCJtYXNrIiwiY2FtZXJhIiwibGVuZ3RoIiwiZGlyZWN0aW9uYWwiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsImdldFkiLCJfZGlyZWN0aW9uIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiZ2V0UG9zaXRpb24iLCJmYXJDbGlwIiwiY2FzdFNoYWRvd3MiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwic2hhZG93QnVmZmVyIiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsIm51bUNhc2NhZGVzIiwic2hhZG93SW50ZW5zaXR5IiwicGFyYW1zIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwibm9ybWFsQmlhcyIsImJpYXMiLCJzZXRMVENQb3NpdGlvbmFsTGlnaHQiLCJkaXNwYXRjaE9tbmlMaWdodCIsIm9tbmkiLCJhdHRlbnVhdGlvbkVuZCIsImdldFRyYW5zbGF0aW9uIiwiX3Bvc2l0aW9uIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsImRpc3BhdGNoU3BvdExpZ2h0Iiwic3BvdCIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImNvb2tpZU1hdHJpeCIsIkxpZ2h0Q2FtZXJhIiwiZXZhbFNwb3RDb29raWVNYXRyaXgiLCJfY29va2llVHJhbnNmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0iLCJ3IiwiX2Nvb2tpZU9mZnNldFVuaWZvcm0iLCJfY29va2llT2Zmc2V0IiwiZGlzcGF0Y2hMb2NhbExpZ2h0cyIsInNvcnRlZExpZ2h0cyIsInVzZWREaXJMaWdodHMiLCJzdGF0aWNMaWdodExpc3QiLCJvbW5pcyIsIkxJR0hUVFlQRV9PTU5JIiwibnVtT21uaXMiLCJpc1N0YXRpYyIsInN0YXRpY0lkIiwiX3R5cGUiLCJzcHRzIiwiTElHSFRUWVBFX1NQT1QiLCJudW1TcHRzIiwicmVuZGVyU2hhZG93c0xvY2FsIiwibGlnaHRzIiwiaXNDbHVzdGVyZWQiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJEZWJ1ZyIsImFzc2VydCIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJzaGFkb3dSZW5kZXJlciIsInJlbmRlciIsInJlbmRlckZvcndhcmRQcmVwYXJlTWF0ZXJpYWxzIiwiZHJhd0NhbGxzQ291bnQiLCJjdWxsaW5nTWFzayIsImxheWVyIiwicGFzcyIsImFkZENhbGwiLCJkcmF3Q2FsbCIsInB1c2giLCJsaWdodEhhc2giLCJfbGlnaHRIYXNoIiwicHJldk1hdGVyaWFsIiwicHJldk9iakRlZnMiLCJwcmV2U3RhdGljIiwicHJldkxpZ2h0TWFzayIsImNvbW1hbmQiLCJza2lwUmVuZGVyQ2FtZXJhIiwiX3NraXBSZW5kZXJDb3VudGVyIiwic2tpcFJlbmRlckFmdGVyIiwiZW5zdXJlTWF0ZXJpYWwiLCJtYXRlcmlhbCIsIm9iakRlZnMiLCJfc2hhZGVyRGVmcyIsImxpZ2h0TWFzayIsIl9zY2VuZSIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJfZGlydHlCbGVuZCIsImxheWVycyIsIl9zaGFkZXIiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsIm5vZGUiLCJuYW1lIiwidmFyaWFudEtleSIsInZhcmlhbnRzIiwidXBkYXRlUGFzc1NoYWRlciIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsIl9zdGF0aWNMaWdodExpc3QiLCJwb3BHcHVNYXJrZXIiLCJlbmRTaGFkZXJCYXRjaCIsInJlbmRlckZvcndhcmRJbnRlcm5hbCIsInByZXBhcmVkQ2FsbHMiLCJkcmF3Q2FsbGJhY2siLCJmbGlwRmFjZXMiLCJwYXNzRmxhZyIsInNraXBNYXRlcmlhbCIsInByZXBhcmVkQ2FsbHNDb3VudCIsIm5ld01hdGVyaWFsIiwic2hhZGVyIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiZXJyb3IiLCJsYWJlbCIsInNldFBhcmFtZXRlcnMiLCJhbHBoYVRlc3RJZCIsImFscGhhVGVzdCIsInNldEJsZW5kaW5nIiwiYmxlbmQiLCJzZXBhcmF0ZUFscGhhQmxlbmQiLCJzZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUiLCJibGVuZFNyYyIsImJsZW5kRHN0IiwiYmxlbmRTcmNBbHBoYSIsImJsZW5kRHN0QWxwaGEiLCJzZXRCbGVuZEVxdWF0aW9uU2VwYXJhdGUiLCJibGVuZEVxdWF0aW9uIiwiYmxlbmRBbHBoYUVxdWF0aW9uIiwic2V0QmxlbmRGdW5jdGlvbiIsInNldEJsZW5kRXF1YXRpb24iLCJzZXRDb2xvcldyaXRlIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsInNldERlcHRoV3JpdGUiLCJkZXB0aFdyaXRlIiwiZGVwdGhUZXN0Iiwic2V0RGVwdGhGdW5jIiwiRlVOQ19BTFdBWVMiLCJzZXREZXB0aFRlc3QiLCJkZXB0aEZ1bmMiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRvQ292ZXJhZ2UiLCJkZXB0aEJpYXMiLCJzbG9wZURlcHRoQmlhcyIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsInNldEN1bGxNb2RlIiwiX2N1bGxGYWNlcyIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwic2V0U3RlbmNpbFRlc3QiLCJzZXRTdGVuY2lsRnVuYyIsImZ1bmMiLCJyZWYiLCJyZWFkTWFzayIsInNldFN0ZW5jaWxPcGVyYXRpb24iLCJmYWlsIiwiemZhaWwiLCJ6cGFzcyIsIndyaXRlTWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQiLCJTVEVOQ0lMT1BfS0VFUCIsInNldFN0ZW5jaWxGdW5jQmFjayIsInNldFN0ZW5jaWxPcGVyYXRpb25CYWNrIiwibWVzaCIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRNb3JwaGluZyIsIm1vcnBoSW5zdGFuY2UiLCJzZXRTa2lubmluZyIsInNldHVwTWVzaFVuaWZvcm1CdWZmZXJzIiwic3R5bGUiLCJyZW5kZXJTdHlsZSIsInNldEluZGV4QnVmZmVyIiwiaW5kZXhCdWZmZXIiLCJ4ciIsInNlc3Npb24iLCJ2aWV3cyIsInYiLCJ2aWV3Iiwic2V0Vmlld3BvcnQiLCJ2aWV3cG9ydCIsInByb2pJZCIsInByb2pNYXQiLCJwcm9qU2t5Ym94SWQiLCJ2aWV3SWQiLCJ2aWV3T2ZmTWF0Iiwidmlld0ludklkIiwidmlld0ludk9mZk1hdCIsInZpZXdJZDMiLCJ2aWV3TWF0MyIsInZpZXdQcm9qSWQiLCJwcm9qVmlld09mZk1hdCIsInZpZXdQb3NJZCIsInBvc2l0aW9uIiwiZHJhd0luc3RhbmNlIiwiZHJhd0luc3RhbmNlMiIsInBhcmFtZXRlcnMiLCJyZW5kZXJGb3J3YXJkIiwiYWxsRHJhd0NhbGxzIiwiYWxsRHJhd0NhbGxzQ291bnQiLCJmb3J3YXJkU3RhcnRUaW1lIiwibm93Iiwic2V0U2NlbmVDb25zdGFudHMiLCJmb2ciLCJGT0dfTk9ORSIsIkZPR19MSU5FQVIiLCJmb2dTdGFydCIsImZvZ0VuZCIsImZvZ0RlbnNpdHkiLCJ3aWR0aCIsImhlaWdodCIsInVwZGF0ZUxpZ2h0U3RhdHMiLCJjb21wIiwiY29tcFVwZGF0ZWRGbGFncyIsIkNPTVBVUERBVEVEX0xJR0hUUyIsIl9zdGF0c1VwZGF0ZWQiLCJzdGF0cyIsIl9zdGF0cyIsIl9saWdodHMiLCJkeW5hbWljTGlnaHRzIiwiYmFrZWRMaWdodHMiLCJsIiwiZW5hYmxlZCIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsIkNPTVBVUERBVEVEX0lOU1RBTkNFUyIsIm1lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlcyIsImJ1aWxkRnJhbWVHcmFwaCIsImZyYW1lR3JhcGgiLCJsYXllckNvbXBvc2l0aW9uIiwicmVzZXQiLCJ1cGRhdGUiLCJyZW5kZXJQYXNzIiwiUmVuZGVyUGFzcyIsImxpZ2h0aW5nIiwiY29va2llc0VuYWJsZWQiLCJyZW5kZXJDb29raWVzIiwiX3NwbGl0TGlnaHRzIiwicmVxdWlyZXNDdWJlbWFwcyIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsImFkZFJlbmRlclBhc3MiLCJzaGFkb3dzRW5hYmxlZCIsInVwZGF0ZUNsdXN0ZXJzIiwic3RhcnRJbmRleCIsIm5ld1N0YXJ0IiwicmVuZGVyVGFyZ2V0IiwicmVuZGVyQWN0aW9ucyIsIl9yZW5kZXJBY3Rpb25zIiwicmVuZGVyQWN0aW9uIiwibGF5ZXJMaXN0IiwibGF5ZXJJbmRleCIsImNhbWVyYXMiLCJjYW1lcmFJbmRleCIsImlzTGF5ZXJFbmFibGVkIiwiaXNEZXB0aExheWVyIiwiaWQiLCJMQVlFUklEX0RFUFRIIiwiaXNHcmFiUGFzcyIsInJlbmRlclNjZW5lQ29sb3JNYXAiLCJyZW5kZXJTY2VuZURlcHRoTWFwIiwiaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIm5leHRJbmRleCIsIm5leHRSZW5kZXJBY3Rpb24iLCJpc05leHRMYXllckRlcHRoIiwiaXNOZXh0TGF5ZXJHcmFiUGFzcyIsImFkZE1haW5SZW5kZXJQYXNzIiwidHJpZ2dlclBvc3Rwcm9jZXNzIiwib25Qb3N0cHJvY2Vzc2luZyIsInJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyIsImVuZEluZGV4IiwicmFuZ2UiLCJzdGFydCIsImVuZCIsInJlbmRlclBhc3NSZW5kZXJBY3Rpb25zIiwic3RhcnRSZW5kZXJBY3Rpb24iLCJlbmRSZW5kZXJBY3Rpb24iLCJzdGFydExheWVyIiwiZmlyc3RDYW1lcmFVc2UiLCJvblByZVJlbmRlciIsImJlZm9yZSIsImxhc3RDYW1lcmFVc2UiLCJvblBvc3RSZW5kZXIiLCJhZnRlciIsImdyYWJQYXNzUmVxdWlyZWQiLCJTY2VuZUdyYWIiLCJyZXF1aXJlc1JlbmRlclBhc3MiLCJpc1JlYWxQYXNzIiwiaW5pdCIsImZ1bGxTaXplQ2xlYXJSZWN0Iiwic2V0Q2xlYXJDb2xvciIsInNldENsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInNldENsZWFyU3RlbmNpbCIsImVudGl0eSIsImZyYW1lVXBkYXRlIiwiX3VwZGF0ZVNreSIsInVwZGF0ZWQiLCJ1cGRhdGVMYXllckNvbXBvc2l0aW9uIiwibGlnaHRzQ2hhbmdlZCIsImJlZ2luRnJhbWUiLCJjdWxsQ29tcG9zaXRpb24iLCJncHVVcGRhdGUiLCJyZW5kZXJSZW5kZXJBY3Rpb24iLCJmaXJzdFJlbmRlckFjdGlvbiIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJMaXN0IiwiY2FtZXJhUGFzcyIsImRyYXdUaW1lIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblByZVJlbmRlclRyYW5zcGFyZW50IiwiX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJzZXR1cFZpZXdwb3J0IiwiY2xlYXIiLCJzb3J0VGltZSIsIl9zb3J0VmlzaWJsZSIsIm9iamVjdHMiLCJpbnN0YW5jZXMiLCJ2aXNpYmxlIiwidmlzaWJsZVRyYW5zcGFyZW50IiwidmlzaWJsZU9wYXF1ZSIsImltbWVkaWF0ZSIsIm9uUHJlUmVuZGVyTGF5ZXIiLCJsaWdodENsdXN0ZXJzIiwiYWN0aXZhdGUiLCJsaWdodFRleHR1cmVBdGxhcyIsImNsdXN0ZXJzRGVidWdSZW5kZXJlZCIsImRlYnVnTGF5ZXIiLCJXb3JsZENsdXN0ZXJzRGVidWciLCJfYWN0aXZlQ2FtZXJhIiwidmlld0NvdW50Iiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJ2aWV3QmluZEdyb3VwcyIsIl9mbGlwRmFjZXMiLCJmbGlwWSIsImRyYXdzIiwibGlzdCIsInNoYWRlclBhc3MiLCJvbkRyYXdDYWxsIiwib25Qb3N0UmVuZGVyT3BhcXVlIiwib25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQiLCJfcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJfcG9zdFJlbmRlckNvdW50ZXIiLCJfcG9zdFJlbmRlckNvdW50ZXJNYXgiLCJfcmVuZGVyVGltZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMkJBLE1BQU1BLHFCQUFxQixHQUFHLElBQUlDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHLEVBQUUsS0FBSyxHQUFHLEdBQUcsRUFBRSxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUE7QUFFM0YsTUFBTUMsYUFBYSxHQUFHO0FBQ2xCQyxFQUFBQSxTQUFTLEVBQUUsRUFBRTtBQUNiQyxFQUFBQSxhQUFhLEVBQUUsRUFBRTtBQUNqQkMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFBQTtBQUN0QixDQUFDLENBQUE7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1D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
