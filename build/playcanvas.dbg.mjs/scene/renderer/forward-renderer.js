/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
import { BlendState } from '../../platform/graphics/blend-state.js';

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
          DebugGraphics.pushGpuMarker(device, `Material: ${material.name}`);

          // Uniforms I: material
          material.setParameters(device);
          if (lightMaskChanged) {
            const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
            this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
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
      var _renderAction$renderT;
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
      device.setBlendState(BlendState.DEFAULT);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQge1xuICAgIEZVTkNfQUxXQVlTLFxuICAgIFNURU5DSUxPUF9LRUVQXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJztcblxuaW1wb3J0IHtcbiAgICBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBGT0dfTk9ORSwgRk9HX0xJTkVBUixcbiAgICBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0JBS0UsXG4gICAgTEFZRVJJRF9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyc7XG5cbmNvbnN0IHdlYmdsMURlcHRoQ2xlYXJDb2xvciA9IG5ldyBDb2xvcigyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSk7XG5cbmNvbnN0IF9kcmF3Q2FsbExpc3QgPSB7XG4gICAgZHJhd0NhbGxzOiBbXSxcbiAgICBpc05ld01hdGVyaWFsOiBbXSxcbiAgICBsaWdodE1hc2tDaGFuZ2VkOiBbXVxufTtcblxuLyoqXG4gKiBUaGUgZm9yd2FyZCByZW5kZXJlciByZW5kZXJzIHtAbGluayBTY2VuZX1zLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgRm9yd2FyZFJlbmRlcmVyIGV4dGVuZHMgUmVuZGVyZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBGb3J3YXJkUmVuZGVyZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIHJlbmRlcmVyLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHN1cGVyKGdyYXBoaWNzRGV2aWNlKTtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxTd2l0Y2hlcyA9IDA7XG4gICAgICAgIHRoaXMuX2RlcHRoTWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2ZvcndhcmRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fc29ydFRpbWUgPSAwO1xuXG4gICAgICAgIC8vIFVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHNjb3BlID0gZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIHRoaXMuZm9nQ29sb3JJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19jb2xvcicpO1xuICAgICAgICB0aGlzLmZvZ1N0YXJ0SWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfc3RhcnQnKTtcbiAgICAgICAgdGhpcy5mb2dFbmRJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19lbmQnKTtcbiAgICAgICAgdGhpcy5mb2dEZW5zaXR5SWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfZGVuc2l0eScpO1xuXG4gICAgICAgIHRoaXMuYW1iaWVudElkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfZ2xvYmFsQW1iaWVudCcpO1xuICAgICAgICB0aGlzLnNreWJveEludGVuc2l0eUlkID0gc2NvcGUucmVzb2x2ZSgnc2t5Ym94SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMuY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdjdWJlTWFwUm90YXRpb25NYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodERpciA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eSA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFBvcyA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoID0gW107XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkID0gW107XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWQgPSBbXTtcblxuICAgICAgICB0aGlzLnNjcmVlblNpemVJZCA9IHNjb3BlLnJlc29sdmUoJ3VTY3JlZW5TaXplJyk7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemUgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIHRoaXMuZm9nQ29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAvLyBTdGF0aWMgcHJvcGVydGllcyB1c2VkIGJ5IHRoZSBQcm9maWxlciBpbiB0aGUgRWRpdG9yJ3MgTGF1bmNoIFBhZ2VcbiAgICBzdGF0aWMgc2tpcFJlbmRlckNhbWVyYSA9IG51bGw7XG5cbiAgICBzdGF0aWMgX3NraXBSZW5kZXJDb3VudGVyID0gMDtcblxuICAgIHN0YXRpYyBza2lwUmVuZGVyQWZ0ZXIgPSAwO1xuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lLmpzJykuU2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqL1xuICAgIGRpc3BhdGNoR2xvYmFsTGlnaHRzKHNjZW5lKSB7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yWzBdID0gc2NlbmUuYW1iaWVudExpZ2h0LnI7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yWzFdID0gc2NlbmUuYW1iaWVudExpZ2h0Lmc7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yWzJdID0gc2NlbmUuYW1iaWVudExpZ2h0LmI7XG4gICAgICAgIGlmIChzY2VuZS5nYW1tYUNvcnJlY3Rpb24pIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbaV0gPSBNYXRoLnBvdyh0aGlzLmFtYmllbnRDb2xvcltpXSwgMi4yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NlbmUucGh5c2ljYWxVbml0cykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFtYmllbnRDb2xvcltpXSAqPSBzY2VuZS5hbWJpZW50THVtaW5hbmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuYW1iaWVudElkLnNldFZhbHVlKHRoaXMuYW1iaWVudENvbG9yKTtcblxuICAgICAgICB0aGlzLnNreWJveEludGVuc2l0eUlkLnNldFZhbHVlKHNjZW5lLnBoeXNpY2FsVW5pdHMgPyBzY2VuZS5za3lib3hMdW1pbmFuY2UgOiBzY2VuZS5za3lib3hJbnRlbnNpdHkpO1xuICAgICAgICB0aGlzLmN1YmVNYXBSb3RhdGlvbk1hdHJpeElkLnNldFZhbHVlKHNjZW5lLl9za3lib3hSb3RhdGlvbk1hdDMuZGF0YSk7XG4gICAgfVxuXG4gICAgX3Jlc29sdmVMaWdodChzY29wZSwgaSkge1xuICAgICAgICBjb25zdCBsaWdodCA9ICdsaWdodCcgKyBpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2NvbG9yJyk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19kaXJlY3Rpb24nKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWFwJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd01hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dQYXJhbXMnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0ludGVuc2l0eScpO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19yYWRpdXMnKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3Bvc2l0aW9uJyk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaGFsZldpZHRoJyk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19oYWxmSGVpZ2h0Jyk7XG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19pbm5lckNvbmVBbmdsZScpO1xuICAgICAgICB0aGlzLmxpZ2h0T3V0QW5nbGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX291dGVyQ29uZUFuZ2xlJyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU1hdHJpeElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llTWF0cml4Jyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVPZmZzZXRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZU9mZnNldCcpO1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXNjYWRlc1xuICAgICAgICB0aGlzLnNoYWRvd01hdHJpeFBhbGV0dGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd01hdHJpeFBhbGV0dGVbMF0nKTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dDYXNjYWRlRGlzdGFuY2VzWzBdJyk7XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dDYXNjYWRlQ291bnQnKTtcbiAgICB9XG5cbiAgICBzZXRMVENEaXJlY3Rpb25hbExpZ2h0KHd0bSwgY250LCBkaXIsIGNhbXBvcywgZmFyKSB7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IGNhbXBvcy54IC0gZGlyLnggKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IGNhbXBvcy55IC0gZGlyLnkgKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IGNhbXBvcy56IC0gZGlyLnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgY29uc3QgaFdpZHRoID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygtMC41LCAwLCAwKSk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzBdID0gaFdpZHRoLnggKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzFdID0gaFdpZHRoLnkgKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzJdID0gaFdpZHRoLnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFdpZHRoW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhIZWlnaHQgPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKDAsIDAsIDAuNSkpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMF0gPSBoSGVpZ2h0LnggKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsxXSA9IGhIZWlnaHQueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzJdID0gaEhlaWdodC56ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0SGVpZ2h0W2NudF0pO1xuICAgIH1cblxuICAgIGRpc3BhdGNoRGlyZWN0TGlnaHRzKGRpcnMsIHNjZW5lLCBtYXNrLCBjYW1lcmEpIHtcbiAgICAgICAgbGV0IGNudCA9IDA7XG5cbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRpcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghKGRpcnNbaV0ubWFzayAmIG1hc2spKSBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3QgZGlyZWN0aW9uYWwgPSBkaXJzW2ldO1xuICAgICAgICAgICAgY29uc3Qgd3RtID0gZGlyZWN0aW9uYWwuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IGRpcmVjdGlvbmFsLl9saW5lYXJGaW5hbENvbG9yIDogZGlyZWN0aW9uYWwuX2ZpbmFsQ29sb3IpO1xuXG4gICAgICAgICAgICAvLyBEaXJlY3Rpb25hbCBsaWdodHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgICAgICB3dG0uZ2V0WShkaXJlY3Rpb25hbC5fZGlyZWN0aW9uKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICAgICAgZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi5ub3JtYWxpemUoKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJbY250XVswXSA9IGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24ueDtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJbY250XVsxXSA9IGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24ueTtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJbY250XVsyXSA9IGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24uejtcbiAgICAgICAgICAgIHRoaXMubGlnaHREaXJJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHREaXJbY250XSk7XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb25hbC5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZSAtIE5CIGRpcmVjdGlvbmFsIGFyZWEgbGlnaHQgc3BlY3VsYXIgaXMgYXBwcm94aW1hdGVkIGJ5IHB1dHRpbmcgdGhlIGFyZWEgbGlnaHQgYXQgdGhlIGZhciBjbGlwXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRMVENEaXJlY3Rpb25hbExpZ2h0KHd0bSwgY250LCBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLCBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKSwgY2FtZXJhLmZhckNsaXApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uYWwuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGRpcmVjdGlvbmFsLmdldFJlbmRlckRhdGEoY2FtZXJhLCAwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBkaXJlY3Rpb25hbC5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd01hdHJpeFBhbGV0dGVJZFtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLl9zaGFkb3dNYXRyaXhQYWxldHRlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZFtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVDb3VudElkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwubnVtQ2FzY2FkZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5zaGFkb3dJbnRlbnNpdHkpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gZGlyZWN0aW9uYWwuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMubGVuZ3RoID0gMztcbiAgICAgICAgICAgICAgICBwYXJhbXNbMF0gPSBkaXJlY3Rpb25hbC5fc2hhZG93UmVzb2x1dGlvbjsgIC8vIE5vdGU6IHRoaXMgbmVlZHMgdG8gY2hhbmdlIGZvciBub24tc3F1YXJlIHNoYWRvdyBtYXBzICgyIGNhc2NhZGVzKS4gQ3VycmVudGx5IHNxdWFyZSBpcyB1c2VkXG4gICAgICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNudCsrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjbnQ7XG4gICAgfVxuXG4gICAgc2V0TFRDUG9zaXRpb25hbExpZ2h0KHd0bSwgY250KSB7XG4gICAgICAgIGNvbnN0IGhXaWR0aCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoLTAuNSwgMCwgMCkpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVswXSA9IGhXaWR0aC54O1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVsxXSA9IGhXaWR0aC55O1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVsyXSA9IGhXaWR0aC56O1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRXaWR0aFtjbnRdKTtcblxuICAgICAgICBjb25zdCBoSGVpZ2h0ID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygwLCAwLCAwLjUpKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzBdID0gaEhlaWdodC54O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMV0gPSBoSGVpZ2h0Lnk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsyXSA9IGhIZWlnaHQuejtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodEhlaWdodFtjbnRdKTtcbiAgICB9XG5cbiAgICBkaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCkge1xuICAgICAgICBjb25zdCB3dG0gPSBvbW5pLl9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWRbY250XS5zZXRWYWx1ZShvbW5pLmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBvbW5pLl9saW5lYXJGaW5hbENvbG9yIDogb21uaS5fZmluYWxDb2xvcik7XG4gICAgICAgIHd0bS5nZXRUcmFuc2xhdGlvbihvbW5pLl9wb3NpdGlvbik7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IG9tbmkuX3Bvc2l0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IG9tbmkuX3Bvc2l0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IG9tbmkuX3Bvc2l0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgaWYgKG9tbmkuc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZVxuICAgICAgICAgICAgdGhpcy5zZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9tbmkuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgLy8gc2hhZG93IG1hcFxuICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gb21uaS5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG5cbiAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IG9tbmkuX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSk7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBvbW5pLl9zaGFkb3dSZW5kZXJQYXJhbXM7XG4gICAgICAgICAgICBwYXJhbXMubGVuZ3RoID0gNDtcbiAgICAgICAgICAgIHBhcmFtc1swXSA9IG9tbmkuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgIHBhcmFtc1syXSA9IGJpYXNlcy5iaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzNdID0gMS4wIC8gb21uaS5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtjbnRdLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2NudF0uc2V0VmFsdWUob21uaS5zaGFkb3dJbnRlbnNpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvbW5pLl9jb29raWUpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtjbnRdLnNldFZhbHVlKG9tbmkuX2Nvb2tpZSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZSh3dG0uZGF0YSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbY250XS5zZXRWYWx1ZShvbW5pLmNvb2tpZUludGVuc2l0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaFNwb3RMaWdodChzY2VuZSwgc2NvcGUsIHNwb3QsIGNudCkge1xuICAgICAgICBjb25zdCB3dG0gPSBzcG90Ll9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5faW5uZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB0aGlzLmxpZ2h0T3V0QW5nbGVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX291dGVyQ29uZUFuZ2xlQ29zKTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2NudF0uc2V0VmFsdWUoc3BvdC5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gc3BvdC5fbGluZWFyRmluYWxDb2xvciA6IHNwb3QuX2ZpbmFsQ29sb3IpO1xuICAgICAgICB3dG0uZ2V0VHJhbnNsYXRpb24oc3BvdC5fcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBzcG90Ll9wb3NpdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBzcG90Ll9wb3NpdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBzcG90Ll9wb3NpdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGlmIChzcG90LnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGVcbiAgICAgICAgICAgIHRoaXMuc2V0TFRDUG9zaXRpb25hbExpZ2h0KHd0bSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNwb3RzIHNoaW5lIGRvd24gdGhlIG5lZ2F0aXZlIFkgYXhpc1xuICAgICAgICB3dG0uZ2V0WShzcG90Ll9kaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgIHNwb3QuX2RpcmVjdGlvbi5ub3JtYWxpemUoKTtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzBdID0gc3BvdC5fZGlyZWN0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVsxXSA9IHNwb3QuX2RpcmVjdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMl0gPSBzcG90Ll9kaXJlY3Rpb24uejtcbiAgICAgICAgdGhpcy5saWdodERpcklkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodERpcltjbnRdKTtcblxuICAgICAgICBpZiAoc3BvdC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgbWFwXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBzcG90LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gc3BvdC5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHNwb3QuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gc3BvdC5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbM10gPSAxLjAgLyBzcG90LmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShzcG90LnNoYWRvd0ludGVuc2l0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3BvdC5fY29va2llKSB7XG5cbiAgICAgICAgICAgIC8vIGlmIHNoYWRvdyBpcyBub3QgcmVuZGVyZWQsIHdlIG5lZWQgdG8gZXZhbHVhdGUgbGlnaHQgcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgICAgICAgIGlmICghc3BvdC5jYXN0U2hhZG93cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvb2tpZU1hdHJpeCA9IExpZ2h0Q2FtZXJhLmV2YWxTcG90Q29va2llTWF0cml4KHNwb3QpO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKGNvb2tpZU1hdHJpeC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5fY29va2llKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtjbnRdLnNldFZhbHVlKHNwb3QuY29va2llSW50ZW5zaXR5KTtcbiAgICAgICAgICAgIGlmIChzcG90Ll9jb29raWVUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzBdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLng7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVsxXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS55O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMl0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0uejtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzNdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLnc7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZU1hdHJpeElkW2NudF0uc2V0VmFsdWUoc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybVswXSA9IHNwb3QuX2Nvb2tpZU9mZnNldC54O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm1bMV0gPSBzcG90Ll9jb29raWVPZmZzZXQueTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoTG9jYWxMaWdodHMoc29ydGVkTGlnaHRzLCBzY2VuZSwgbWFzaywgdXNlZERpckxpZ2h0cywgc3RhdGljTGlnaHRMaXN0KSB7XG5cbiAgICAgICAgbGV0IGNudCA9IHVzZWREaXJMaWdodHM7XG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgY29uc3Qgb21uaXMgPSBzb3J0ZWRMaWdodHNbTElHSFRUWVBFX09NTkldO1xuICAgICAgICBjb25zdCBudW1PbW5pcyA9IG9tbmlzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1PbW5pczsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBvbW5pID0gb21uaXNbaV07XG4gICAgICAgICAgICBpZiAoIShvbW5pLm1hc2sgJiBtYXNrKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAob21uaS5pc1N0YXRpYykgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoT21uaUxpZ2h0KHNjZW5lLCBzY29wZSwgb21uaSwgY250KTtcbiAgICAgICAgICAgIGNudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0YXRpY0lkID0gMDtcbiAgICAgICAgaWYgKHN0YXRpY0xpZ2h0TGlzdCkge1xuICAgICAgICAgICAgbGV0IG9tbmkgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgd2hpbGUgKG9tbmkgJiYgb21uaS5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoT21uaUxpZ2h0KHNjZW5lLCBzY29wZSwgb21uaSwgY250KTtcbiAgICAgICAgICAgICAgICBjbnQrKztcbiAgICAgICAgICAgICAgICBzdGF0aWNJZCsrO1xuICAgICAgICAgICAgICAgIG9tbmkgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3B0cyA9IHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfU1BPVF07XG4gICAgICAgIGNvbnN0IG51bVNwdHMgPSBzcHRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TcHRzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNwb3QgPSBzcHRzW2ldO1xuICAgICAgICAgICAgaWYgKCEoc3BvdC5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKHNwb3QuaXNTdGF0aWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaFNwb3RMaWdodChzY2VuZSwgc2NvcGUsIHNwb3QsIGNudCk7XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdGF0aWNMaWdodExpc3QpIHtcbiAgICAgICAgICAgIGxldCBzcG90ID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIHdoaWxlIChzcG90ICYmIHNwb3QuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaFNwb3RMaWdodChzY2VuZSwgc2NvcGUsIHNwb3QsIGNudCk7XG4gICAgICAgICAgICAgICAgY250Kys7XG4gICAgICAgICAgICAgICAgc3RhdGljSWQrKztcbiAgICAgICAgICAgICAgICBzcG90ID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGV4ZWN1dGUgZmlyc3QgcGFzcyBvdmVyIGRyYXcgY2FsbHMsIGluIG9yZGVyIHRvIHVwZGF0ZSBtYXRlcmlhbHMgLyBzaGFkZXJzXG4gICAgLy8gVE9ETzogaW1wbGVtZW50IHRoaXM6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XZWJHTF9BUEkvV2ViR0xfYmVzdF9wcmFjdGljZXMjY29tcGlsZV9zaGFkZXJzX2FuZF9saW5rX3Byb2dyYW1zX2luX3BhcmFsbGVsXG4gICAgLy8gd2hlcmUgaW5zdGVhZCBvZiBjb21waWxpbmcgYW5kIGxpbmtpbmcgc2hhZGVycywgd2hpY2ggaXMgc2VyaWFsIG9wZXJhdGlvbiwgd2UgY29tcGlsZSBhbGwgb2YgdGhlbSBhbmQgdGhlbiBsaW5rIHRoZW0sIGFsbG93aW5nIHRoZSB3b3JrIHRvXG4gICAgLy8gdGFrZSBwbGFjZSBpbiBwYXJhbGxlbFxuICAgIHJlbmRlckZvcndhcmRQcmVwYXJlTWF0ZXJpYWxzKGNhbWVyYSwgZHJhd0NhbGxzLCBkcmF3Q2FsbHNDb3VudCwgc29ydGVkTGlnaHRzLCBjdWxsaW5nTWFzaywgbGF5ZXIsIHBhc3MpIHtcblxuICAgICAgICBjb25zdCBhZGRDYWxsID0gKGRyYXdDYWxsLCBpc05ld01hdGVyaWFsLCBsaWdodE1hc2tDaGFuZ2VkKSA9PiB7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmRyYXdDYWxscy5wdXNoKGRyYXdDYWxsKTtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QuaXNOZXdNYXRlcmlhbC5wdXNoKGlzTmV3TWF0ZXJpYWwpO1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5saWdodE1hc2tDaGFuZ2VkLnB1c2gobGlnaHRNYXNrQ2hhbmdlZCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gc3RhcnQgd2l0aCBlbXB0eSBhcnJheXNcbiAgICAgICAgX2RyYXdDYWxsTGlzdC5kcmF3Q2FsbHMubGVuZ3RoID0gMDtcbiAgICAgICAgX2RyYXdDYWxsTGlzdC5pc05ld01hdGVyaWFsLmxlbmd0aCA9IDA7XG4gICAgICAgIF9kcmF3Q2FsbExpc3QubGlnaHRNYXNrQ2hhbmdlZC5sZW5ndGggPSAwO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IGxpZ2h0SGFzaCA9IGxheWVyID8gbGF5ZXIuX2xpZ2h0SGFzaCA6IDA7XG4gICAgICAgIGxldCBwcmV2TWF0ZXJpYWwgPSBudWxsLCBwcmV2T2JqRGVmcywgcHJldlN0YXRpYywgcHJldkxpZ2h0TWFzaztcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9ICovXG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcblxuICAgICAgICAgICAgLy8gYXBwbHkgdmlzaWJpbGl0eSBvdmVycmlkZVxuICAgICAgICAgICAgaWYgKGN1bGxpbmdNYXNrICYmIGRyYXdDYWxsLm1hc2sgJiYgIShjdWxsaW5nTWFzayAmIGRyYXdDYWxsLm1hc2spKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY29tbWFuZCkge1xuXG4gICAgICAgICAgICAgICAgYWRkQ2FsbChkcmF3Q2FsbCwgZmFsc2UsIGZhbHNlKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhID09PSBGb3J3YXJkUmVuZGVyZXIuc2tpcFJlbmRlckNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlciA+PSBGb3J3YXJkUmVuZGVyZXIuc2tpcFJlbmRlckFmdGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5fc2tpcFJlbmRlckNvdW50ZXIgPj0gbGF5ZXIuc2tpcFJlbmRlckFmdGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLl9za2lwUmVuZGVyQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGRyYXdDYWxsLmVuc3VyZU1hdGVyaWFsKGRldmljZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG9iakRlZnMgPSBkcmF3Q2FsbC5fc2hhZGVyRGVmcztcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodE1hc2sgPSBkcmF3Q2FsbC5tYXNrO1xuXG4gICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsICYmIG1hdGVyaWFsID09PSBwcmV2TWF0ZXJpYWwgJiYgb2JqRGVmcyAhPT0gcHJldk9iakRlZnMpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJldk1hdGVyaWFsID0gbnVsbDsgLy8gZm9yY2UgY2hhbmdlIHNoYWRlciBpZiB0aGUgb2JqZWN0IHVzZXMgYSBkaWZmZXJlbnQgdmFyaWFudCBvZiB0aGUgc2FtZSBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5pc1N0YXRpYyB8fCBwcmV2U3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsICE9PSBwcmV2TWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxTd2l0Y2hlcysrO1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5fc2NlbmUgPSBzY2VuZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIG1hdGVyaWFsIGhhcyBkaXJ0eUJsZW5kIHNldCwgbm90aWZ5IHNjZW5lIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2VuZS5sYXllcnMuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdIHx8IGRyYXdDYWxsLl9zaGFkZXJEZWZzICE9PSBvYmpEZWZzIHx8IGRyYXdDYWxsLl9saWdodEhhc2ggIT09IGxpZ2h0SGFzaCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hcmtlciB0byBhbGxvdyB1cyB0byBzZWUgdGhlIHNvdXJjZSBub2RlIGZvciBzaGFkZXIgYWxsb2NcbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYE5vZGU6ICR7ZHJhd0NhbGwubm9kZS5uYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGRyYXcgY2FsbHMgbm90IHVzaW5nIHN0YXRpYyBsaWdodHMgdXNlIHZhcmlhbnRzIGNhY2hlIG9uIG1hdGVyaWFsIHRvIHF1aWNrbHkgZmluZCB0aGUgc2hhZGVyLCBhcyB0aGV5IGFyZSBhbGxcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHNhbWUgZm9yIHRoZSBzYW1lIHBhc3MsIHVzaW5nIGFsbCBsaWdodHMgb2YgdGhlIHNjZW5lXG4gICAgICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwuaXNTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhbnRLZXkgPSBwYXNzICsgJ18nICsgb2JqRGVmcyArICdfJyArIGxpZ2h0SGFzaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLl9zaGFkZXJbcGFzc10gPSBtYXRlcmlhbC52YXJpYW50c1t2YXJpYW50S2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwuX3NoYWRlcltwYXNzXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIG51bGwsIHNvcnRlZExpZ2h0cywgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC52YXJpYW50c1t2YXJpYW50S2V5XSA9IGRyYXdDYWxsLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN0YXRpYyBsaWdodHMgZ2VuZXJhdGUgdW5pcXVlIHNoYWRlciBwZXIgZHJhdyBjYWxsLCBhcyBzdGF0aWMgbGlnaHRzIGFyZSB1bmlxdWUgcGVyIGRyYXcgY2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBzbyB2YXJpYW50cyBjYWNoZSBpcyBub3QgdXNlZFxuICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgZHJhd0NhbGwuX3N0YXRpY0xpZ2h0TGlzdCwgc29ydGVkTGlnaHRzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLl9saWdodEhhc2ggPSBsaWdodEhhc2g7XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoZHJhd0NhbGwuX3NoYWRlcltwYXNzXSwgXCJubyBzaGFkZXIgZm9yIHBhc3NcIiwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICAgICAgYWRkQ2FsbChkcmF3Q2FsbCwgbWF0ZXJpYWwgIT09IHByZXZNYXRlcmlhbCwgIXByZXZNYXRlcmlhbCB8fCBsaWdodE1hc2sgIT09IHByZXZMaWdodE1hc2spO1xuXG4gICAgICAgICAgICAgICAgcHJldk1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgcHJldk9iakRlZnMgPSBvYmpEZWZzO1xuICAgICAgICAgICAgICAgIHByZXZMaWdodE1hc2sgPSBsaWdodE1hc2s7XG4gICAgICAgICAgICAgICAgcHJldlN0YXRpYyA9IGRyYXdDYWxsLmlzU3RhdGljO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJvY2VzcyB0aGUgYmF0Y2ggb2Ygc2hhZGVycyBjcmVhdGVkIGhlcmVcbiAgICAgICAgZGV2aWNlLmVuZFNoYWRlckJhdGNoPy4oKTtcblxuICAgICAgICByZXR1cm4gX2RyYXdDYWxsTGlzdDtcbiAgICB9XG5cbiAgICByZW5kZXJGb3J3YXJkSW50ZXJuYWwoY2FtZXJhLCBwcmVwYXJlZENhbGxzLCBzb3J0ZWRMaWdodHMsIHBhc3MsIGRyYXdDYWxsYmFjaywgZmxpcEZhY2VzKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IHBhc3NGbGFnID0gMSA8PCBwYXNzO1xuXG4gICAgICAgIC8vIFJlbmRlciB0aGUgc2NlbmVcbiAgICAgICAgbGV0IHNraXBNYXRlcmlhbCA9IGZhbHNlO1xuICAgICAgICBjb25zdCBwcmVwYXJlZENhbGxzQ291bnQgPSBwcmVwYXJlZENhbGxzLmRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJlcGFyZWRDYWxsc0NvdW50OyBpKyspIHtcblxuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBwcmVwYXJlZENhbGxzLmRyYXdDYWxsc1tpXTtcblxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIHtcblxuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgYSBjb21tYW5kXG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuY29tbWFuZCgpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdNYXRlcmlhbCA9IHByZXBhcmVkQ2FsbHMuaXNOZXdNYXRlcmlhbFtpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodE1hc2tDaGFuZ2VkID0gcHJlcGFyZWRDYWxscy5saWdodE1hc2tDaGFuZ2VkW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqRGVmcyA9IGRyYXdDYWxsLl9zaGFkZXJEZWZzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFzayA9IGRyYXdDYWxsLm1hc2s7XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3TWF0ZXJpYWwpIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXNoYWRlci5mYWlsZWQgJiYgIWRldmljZS5zZXRTaGFkZXIoc2hhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEVycm9yIGNvbXBpbGluZyBzaGFkZXIgWyR7c2hhZGVyLmxhYmVsfV0gZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3Bhc3N9IG9iakRlZnM9JHtvYmpEZWZzfWAsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgcmVuZGVyaW5nIHdpdGggdGhlIG1hdGVyaWFsIGlmIHNoYWRlciBmYWlsZWRcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1hdGVyaWFsID0gc2hhZGVyLmZhaWxlZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNraXBNYXRlcmlhbClcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBNYXRlcmlhbDogJHttYXRlcmlhbC5uYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIEk6IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRNYXNrQ2hhbmdlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlZERpckxpZ2h0cyA9IHRoaXMuZGlzcGF0Y2hEaXJlY3RMaWdodHMoc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0sIHNjZW5lLCBsaWdodE1hc2ssIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoTG9jYWxMaWdodHMoc29ydGVkTGlnaHRzLCBzY2VuZSwgbGlnaHRNYXNrLCB1c2VkRGlyTGlnaHRzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcblxuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShtYXRlcmlhbC5ibGVuZFN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoU3RhdGUobWF0ZXJpYWwuZGVwdGhTdGF0ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEFscGhhVG9Db3ZlcmFnZShtYXRlcmlhbC5hbHBoYVRvQ292ZXJhZ2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kZXB0aEJpYXMgfHwgbWF0ZXJpYWwuc2xvcGVEZXB0aEJpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXModHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzVmFsdWVzKG1hdGVyaWFsLmRlcHRoQmlhcywgbWF0ZXJpYWwuc2xvcGVEZXB0aEJpYXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBOb2RlOiAke2RyYXdDYWxsLm5vZGUubmFtZX1gKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q3VsbE1vZGUoY2FtZXJhLl9jdWxsRmFjZXMsIGZsaXBGYWNlcywgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbEZyb250ID0gZHJhd0NhbGwuc3RlbmNpbEZyb250IHx8IG1hdGVyaWFsLnN0ZW5jaWxGcm9udDtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsQmFjayA9IGRyYXdDYWxsLnN0ZW5jaWxCYWNrIHx8IG1hdGVyaWFsLnN0ZW5jaWxCYWNrO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCB8fCBzdGVuY2lsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFRlc3QodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsRnJvbnQgPT09IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZGVudGljYWwgZnJvbnQvYmFjayBzdGVuY2lsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmMoc3RlbmNpbEZyb250LmZ1bmMsIHN0ZW5jaWxGcm9udC5yZWYsIHN0ZW5jaWxGcm9udC5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbihzdGVuY2lsRnJvbnQuZmFpbCwgc3RlbmNpbEZyb250LnpmYWlsLCBzdGVuY2lsRnJvbnQuenBhc3MsIHN0ZW5jaWxGcm9udC53cml0ZU1hc2spO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2VwYXJhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsRnJvbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNGcm9udChzdGVuY2lsRnJvbnQuZnVuYywgc3RlbmNpbEZyb250LnJlZiwgc3RlbmNpbEZyb250LnJlYWRNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNGcm9udChGVU5DX0FMV0FZUywgMCwgMHhGRik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udChTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxGdW5jQmFjayhzdGVuY2lsQmFjay5mdW5jLCBzdGVuY2lsQmFjay5yZWYsIHN0ZW5jaWxCYWNrLnJlYWRNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkJhY2soc3RlbmNpbEJhY2suZmFpbCwgc3RlbmNpbEJhY2suemZhaWwsIHN0ZW5jaWxCYWNrLnpwYXNzLCBzdGVuY2lsQmFjay53cml0ZU1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNCYWNrKEZVTkNfQUxXQVlTLCAwLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkJhY2soU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCBTVEVOQ0lMT1BfS0VFUCwgMHhGRik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFRlc3QoZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBkcmF3Q2FsbC5tZXNoO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWcpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRWZXJ0ZXhCdWZmZXJzKGRldmljZSwgbWVzaCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRNb3JwaGluZyhkZXZpY2UsIGRyYXdDYWxsLm1vcnBoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2tpbm5pbmcoZGV2aWNlLCBkcmF3Q2FsbCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwTWVzaFVuaWZvcm1CdWZmZXJzKGRyYXdDYWxsLCBwYXNzKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gZHJhd0NhbGwucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldEluZGV4QnVmZmVyKG1lc2guaW5kZXhCdWZmZXJbc3R5bGVdKTtcblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGxiYWNrKGRyYXdDYWxsLCBpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci5zZXNzaW9uICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCB2aWV3cy5sZW5ndGg7IHYrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQodmlldy52aWV3cG9ydC54LCB2aWV3LnZpZXdwb3J0LnksIHZpZXcudmlld3BvcnQueiwgdmlldy52aWV3cG9ydC53KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQuc2V0VmFsdWUodmlldy52aWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlldy52aWV3SW52T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQzLnNldFZhbHVlKHZpZXcudmlld01hdDMuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qVmlld09mZk1hdC5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZpZXcucG9zaXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodiA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHJhd0luc3RhbmNlKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UyKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVW5zZXQgbWVzaEluc3RhbmNlIG92ZXJyaWRlcyBiYWNrIHRvIG1hdGVyaWFsIHZhbHVlcyBpZiBuZXh0IGRyYXcgY2FsbCB3aWxsIHVzZSB0aGUgc2FtZSBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIGlmIChpIDwgcHJlcGFyZWRDYWxsc0NvdW50IC0gMSAmJiAhcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2kgKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgZHJhd0NhbGwucGFyYW1ldGVycyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmQoY2FtZXJhLCBhbGxEcmF3Q2FsbHMsIGFsbERyYXdDYWxsc0NvdW50LCBzb3J0ZWRMaWdodHMsIHBhc3MsIGN1bGxpbmdNYXNrLCBkcmF3Q2FsbGJhY2ssIGxheWVyLCBmbGlwRmFjZXMpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGZvcndhcmRTdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gcnVuIGZpcnN0IHBhc3Mgb3ZlciBkcmF3IGNhbGxzIGFuZCBoYW5kbGUgbWF0ZXJpYWwgLyBzaGFkZXIgdXBkYXRlc1xuICAgICAgICBjb25zdCBwcmVwYXJlZENhbGxzID0gdGhpcy5yZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGFsbERyYXdDYWxscywgYWxsRHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgY3VsbGluZ01hc2ssIGxheWVyLCBwYXNzKTtcblxuICAgICAgICAvLyByZW5kZXIgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5yZW5kZXJGb3J3YXJkSW50ZXJuYWwoY2FtZXJhLCBwcmVwYXJlZENhbGxzLCBzb3J0ZWRMaWdodHMsIHBhc3MsIGRyYXdDYWxsYmFjaywgZmxpcEZhY2VzKTtcblxuICAgICAgICBfZHJhd0NhbGxMaXN0Lmxlbmd0aCA9IDA7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9mb3J3YXJkVGltZSArPSBub3coKSAtIGZvcndhcmRTdGFydFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHNldFNjZW5lQ29uc3RhbnRzKCkge1xuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLy8gU2V0IHVwIGFtYmllbnQvZXhwb3N1cmVcbiAgICAgICAgdGhpcy5kaXNwYXRjaEdsb2JhbExpZ2h0cyhzY2VuZSk7XG5cbiAgICAgICAgLy8gU2V0IHVwIHRoZSBmb2dcbiAgICAgICAgaWYgKHNjZW5lLmZvZyAhPT0gRk9HX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMF0gPSBzY2VuZS5mb2dDb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclsxXSA9IHNjZW5lLmZvZ0NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzJdID0gc2NlbmUuZm9nQ29sb3IuYjtcbiAgICAgICAgICAgIGlmIChzY2VuZS5nYW1tYUNvcnJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZvZ0NvbG9yW2ldID0gTWF0aC5wb3codGhpcy5mb2dDb2xvcltpXSwgMi4yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9ySWQuc2V0VmFsdWUodGhpcy5mb2dDb2xvcik7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZm9nID09PSBGT0dfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dTdGFydElkLnNldFZhbHVlKHNjZW5lLmZvZ1N0YXJ0KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ0VuZElkLnNldFZhbHVlKHNjZW5lLmZvZ0VuZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nRGVuc2l0eUlkLnNldFZhbHVlKHNjZW5lLmZvZ0RlbnNpdHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHVwIHNjcmVlbiBzaXplIC8vIHNob3VsZCBiZSBSVCBzaXplP1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVswXSA9IGRldmljZS53aWR0aDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVsxXSA9IGRldmljZS5oZWlnaHQ7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMl0gPSAxIC8gZGV2aWNlLndpZHRoO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzNdID0gMSAvIGRldmljZS5oZWlnaHQ7XG4gICAgICAgIHRoaXMuc2NyZWVuU2l6ZUlkLnNldFZhbHVlKHRoaXMuX3NjcmVlblNpemUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29tcFVwZGF0ZWRGbGFncyAtIEZsYWdzIG9mIHdoYXQgd2FzIHVwZGF0ZWQuXG4gICAgICovXG4gICAgdXBkYXRlTGlnaHRTdGF0cyhjb21wLCBjb21wVXBkYXRlZEZsYWdzKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGlmIChjb21wVXBkYXRlZEZsYWdzICYgQ09NUFVQREFURURfTElHSFRTIHx8ICFzY2VuZS5fc3RhdHNVcGRhdGVkKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IHNjZW5lLl9zdGF0cztcbiAgICAgICAgICAgIHN0YXRzLmxpZ2h0cyA9IGNvbXAuX2xpZ2h0cy5sZW5ndGg7XG4gICAgICAgICAgICBzdGF0cy5keW5hbWljTGlnaHRzID0gMDtcbiAgICAgICAgICAgIHN0YXRzLmJha2VkTGlnaHRzID0gMDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0cy5saWdodHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGwgPSBjb21wLl9saWdodHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKGwuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKGwubWFzayAmIE1BU0tfQUZGRUNUX0RZTkFNSUMpIHx8IChsLm1hc2sgJiBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCkpIHsgLy8gaWYgYWZmZWN0cyBkeW5hbWljIG9yIGJha2VkIG9iamVjdHMgaW4gcmVhbC10aW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5keW5hbWljTGlnaHRzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGwubWFzayAmIE1BU0tfQkFLRSkgeyAvLyBpZiBiYWtlZCBpbnRvIGxpZ2h0bWFwc1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMuYmFrZWRMaWdodHMrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb21wVXBkYXRlZEZsYWdzICYgQ09NUFVQREFURURfSU5TVEFOQ0VTIHx8ICFzY2VuZS5fc3RhdHNVcGRhdGVkKSB7XG4gICAgICAgICAgICBzY2VuZS5fc3RhdHMubWVzaEluc3RhbmNlcyA9IGNvbXAuX21lc2hJbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgc2NlbmUuX3N0YXRzVXBkYXRlZCA9IHRydWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJ1aWxkcyBhIGZyYW1lIGdyYXBoIGZvciB0aGUgcmVuZGVyaW5nIG9mIHRoZSB3aG9sZSBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZS1ncmFwaC5qcycpLkZyYW1lR3JhcGh9IGZyYW1lR3JhcGggLSBUaGUgZnJhbWUtZ3JhcGggdGhhdCBpcyBidWlsdC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlXG4gICAgICogbGF5ZXIgY29tcG9zaXRpb24gdXNlZCB0byBidWlsZCB0aGUgZnJhbWUgZ3JhcGguXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJ1aWxkRnJhbWVHcmFwaChmcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGZyYW1lR3JhcGgucmVzZXQoKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZShsYXllckNvbXBvc2l0aW9uKTtcblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmcgcmVuZGVyIHBhc3Nlc1xuICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgICAgIC8vIGNvb2tpZXNcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVuZGVyIGNvb2tpZXMgZm9yIGFsbCBsb2NhbCB2aXNpYmxlIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5saWdodGluZy5jb29raWVzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJDb29raWVzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNvb2tpZXMobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX09NTkldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgJ0NsdXN0ZXJlZENvb2tpZXMnKTtcbiAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxvY2FsIHNoYWRvd3MgLSB0aGVzZSBhcmUgc2hhcmVkIGJ5IGFsbCBjYW1lcmFzIChub3QgZW50aXJlbHkgY29ycmVjdGx5KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSk7XG4gICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCAnQ2x1c3RlcmVkTG9jYWxTaGFkb3dzJyk7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIHNoYWRvd3Mgb25seSB3aGVuIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLmxpZ2h0aW5nLnNoYWRvd3NFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwbGl0TGlnaHRzID0gbGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwucHJlcGFyZUNsdXN0ZXJlZFJlbmRlclBhc3MocmVuZGVyUGFzcywgc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdLCBzcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBjbHVzdGVycyBhbGwgdGhlIHRpbWVcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLmFmdGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNsdXN0ZXJzKGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gbm9uLWNsdXN0ZXJlZCBsb2NhbCBzaGFkb3dzIC0gdGhlc2UgYXJlIHNoYXJlZCBieSBhbGwgY2FtZXJhcyAobm90IGVudGlyZWx5IGNvcnJlY3RseSlcbiAgICAgICAgICAgIGNvbnN0IHNwbGl0TGlnaHRzID0gbGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHM7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsLmJ1aWxkTm9uQ2x1c3RlcmVkUmVuZGVyUGFzc2VzKGZyYW1lR3JhcGgsIHNwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSwgc3BsaXRMaWdodHNbTElHSFRUWVBFX09NTkldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1haW4gcGFzc2VzXG4gICAgICAgIGxldCBzdGFydEluZGV4ID0gMDtcbiAgICAgICAgbGV0IG5ld1N0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgbGV0IHJlbmRlclRhcmdldCA9IG51bGw7XG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBsYXllckNvbXBvc2l0aW9uLl9yZW5kZXJBY3Rpb25zO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW3JlbmRlckFjdGlvbi5jYW1lcmFJbmRleF07XG5cbiAgICAgICAgICAgIC8vIHNraXAgZGlzYWJsZWQgbGF5ZXJzXG4gICAgICAgICAgICBpZiAoIXJlbmRlckFjdGlvbi5pc0xheWVyRW5hYmxlZChsYXllckNvbXBvc2l0aW9uKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpc0RlcHRoTGF5ZXIgPSBsYXllci5pZCA9PT0gTEFZRVJJRF9ERVBUSDtcbiAgICAgICAgICAgIGNvbnN0IGlzR3JhYlBhc3MgPSBpc0RlcHRoTGF5ZXIgJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKTtcblxuICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgc2hhZG93cyBnZXQgcmUtcmVuZGVyZWQgZm9yIGVhY2ggY2FtZXJhXG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uLmhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzICYmIGNhbWVyYSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuYnVpbGRGcmFtZUdyYXBoKGZyYW1lR3JhcGgsIHJlbmRlckFjdGlvbiwgY2FtZXJhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RhcnQgb2YgYmxvY2sgb2YgcmVuZGVyIGFjdGlvbnMgcmVuZGVyaW5nIHRvIHRoZSBzYW1lIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIGlmIChuZXdTdGFydCkge1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc3RhcnRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgcmVuZGVyVGFyZ2V0ID0gcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZmluZCB0aGUgbmV4dCBlbmFibGVkIHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgIGxldCBuZXh0SW5kZXggPSBpICsgMTtcbiAgICAgICAgICAgIHdoaWxlIChyZW5kZXJBY3Rpb25zW25leHRJbmRleF0gJiYgIXJlbmRlckFjdGlvbnNbbmV4dEluZGV4XS5pc0xheWVyRW5hYmxlZChsYXllckNvbXBvc2l0aW9uKSkge1xuICAgICAgICAgICAgICAgIG5leHRJbmRleCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpbmZvIGFib3V0IHRoZSBuZXh0IHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IG5leHRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW25leHRJbmRleF07XG4gICAgICAgICAgICBjb25zdCBpc05leHRMYXllckRlcHRoID0gbmV4dFJlbmRlckFjdGlvbiA/IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W25leHRSZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF0uaWQgPT09IExBWUVSSURfREVQVEggOiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyR3JhYlBhc3MgPSBpc05leHRMYXllckRlcHRoICYmIChjYW1lcmEucmVuZGVyU2NlbmVDb2xvck1hcCB8fCBjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCk7XG5cbiAgICAgICAgICAgIC8vIGVuZCBvZiB0aGUgYmxvY2sgdXNpbmcgdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKCFuZXh0UmVuZGVyQWN0aW9uIHx8IG5leHRSZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ICE9PSByZW5kZXJUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBuZXh0UmVuZGVyQWN0aW9uLmhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzIHx8IGlzTmV4dExheWVyR3JhYlBhc3MgfHwgaXNHcmFiUGFzcykge1xuXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIHRoZSByZW5kZXIgYWN0aW9ucyBpbiB0aGUgcmFuZ2VcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgaSwgaXNHcmFiUGFzcyk7XG5cbiAgICAgICAgICAgICAgICAvLyBwb3N0cHJvY2Vzc2luZ1xuICAgICAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzICYmIGNhbWVyYT8ub25Qb3N0cHJvY2Vzc2luZykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc1Bvc3Rwcm9jZXNzaW5nKHJlbmRlckFjdGlvbiwgbGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgUG9zdHByb2Nlc3NgKTtcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZS1ncmFwaC5qcycpLkZyYW1lR3JhcGh9IGZyYW1lR3JhcGggLSBUaGUgZnJhbWUgZ3JhcGguXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbGF5ZXJDb21wb3NpdGlvbiAtIFRoZVxuICAgICAqIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgZW5kSW5kZXgsIGlzR3JhYlBhc3MpIHtcblxuICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICBjb25zdCByYW5nZSA9IHsgc3RhcnQ6IHN0YXJ0SW5kZXgsIGVuZDogZW5kSW5kZXggfTtcbiAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NSZW5kZXJBY3Rpb25zKGxheWVyQ29tcG9zaXRpb24sIHJhbmdlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGNvbnN0IHN0YXJ0UmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tzdGFydEluZGV4XTtcbiAgICAgICAgY29uc3QgZW5kUmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tlbmRJbmRleF07XG4gICAgICAgIGNvbnN0IHN0YXJ0TGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtzdGFydFJlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gc3RhcnRMYXllci5jYW1lcmFzW3N0YXJ0UmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICBpZiAoY2FtZXJhKSB7XG5cbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIG9uIHRoZSBjYW1lcmEgY29tcG9uZW50IGJlZm9yZSByZW5kZXJpbmcgd2l0aCB0aGlzIGNhbWVyYSBmb3IgdGhlIGZpcnN0IHRpbWVcbiAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSAmJiBjYW1lcmEub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLmJlZm9yZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2FtZXJhLm9uUHJlUmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgd2hlbiB3ZSdyZSBkb25lIHJlbmRlcmluZyB3aXRoIHRoaXMgY2FtZXJhXG4gICAgICAgICAgICBpZiAoZW5kUmVuZGVyQWN0aW9uLmxhc3RDYW1lcmFVc2UgJiYgY2FtZXJhLm9uUG9zdFJlbmRlcikge1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuYWZ0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNhbWVyYS5vblBvc3RSZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVwdGggZ3JhYiBwYXNzIG9uIHdlYmdsMSBpcyBub3JtYWwgcmVuZGVyIHBhc3MgKHNjZW5lIGdldHMgcmUtcmVuZGVyZWQpXG4gICAgICAgIGNvbnN0IGdyYWJQYXNzUmVxdWlyZWQgPSBpc0dyYWJQYXNzICYmIFNjZW5lR3JhYi5yZXF1aXJlc1JlbmRlclBhc3ModGhpcy5kZXZpY2UsIGNhbWVyYSk7XG4gICAgICAgIGNvbnN0IGlzUmVhbFBhc3MgPSAhaXNHcmFiUGFzcyB8fCBncmFiUGFzc1JlcXVpcmVkO1xuXG4gICAgICAgIGlmIChpc1JlYWxQYXNzKSB7XG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuaW5pdChyZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCA9IGNhbWVyYS5jYW1lcmEuZnVsbFNpemVDbGVhclJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChncmFiUGFzc1JlcXVpcmVkKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB3ZWJnbDEgZGVwdGggcmVuZGVyaW5nIGNsZWFyIHZhbHVlc1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJDb2xvcih3ZWJnbDFEZXB0aENsZWFyQ29sb3IpO1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aCgxLjApO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlbmRlclBhc3MuZnVsbFNpemVDbGVhclJlY3QpIHsgLy8gaWYgY2FtZXJhIHJlbmRlcmluZyBjb3ZlcnMgdGhlIGZ1bGwgdmlld3BvcnRcblxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhckNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJDb2xvcihjYW1lcmEuY2FtZXJhLmNsZWFyQ29sb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyRGVwdGgoY2FtZXJhLmNhbWVyYS5jbGVhckRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyU3RlbmNpbChjYW1lcmEuY2FtZXJhLmNsZWFyU3RlbmNpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgJHtpc0dyYWJQYXNzID8gJ1NjZW5lR3JhYicgOiAnUmVuZGVyQWN0aW9uJ30gJHtzdGFydEluZGV4fS0ke2VuZEluZGV4fSBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgQ2FtOiAke2NhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICctJ31gKTtcbiAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICB1cGRhdGUoY29tcCkge1xuXG4gICAgICAgIHRoaXMuZnJhbWVVcGRhdGUoKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSZW5kZXJlci5mcmFtZVVwZGF0ZSgpO1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgc2t5Ym94LCBzaW5jZSB0aGlzIG1pZ2h0IGNoYW5nZSBfbWVzaEluc3RhbmNlc1xuICAgICAgICB0aGlzLnNjZW5lLl91cGRhdGVTa3kodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvbiBpZiBzb21ldGhpbmcgaGFzIGJlZW4gaW52YWxpZGF0ZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IHRoaXMudXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuICAgICAgICBjb25zdCBsaWdodHNDaGFuZ2VkID0gKHVwZGF0ZWQgJiBDT01QVVBEQVRFRF9MSUdIVFMpICE9PSAwO1xuXG4gICAgICAgIHRoaXMudXBkYXRlTGlnaHRTdGF0cyhjb21wLCB1cGRhdGVkKTtcblxuICAgICAgICAvLyBTaW5nbGUgcGVyLWZyYW1lIGNhbGN1bGF0aW9uc1xuICAgICAgICB0aGlzLmJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCk7XG4gICAgICAgIHRoaXMuc2V0U2NlbmVDb25zdGFudHMoKTtcblxuICAgICAgICAvLyB2aXNpYmlsaXR5IGN1bGxpbmcgb2YgbGlnaHRzLCBtZXNoSW5zdGFuY2VzLCBzaGFkb3dzIGNhc3RlcnNcbiAgICAgICAgLy8gYWZ0ZXIgdGhpcyB0aGUgc2NlbmUgY3VsbGluZyBpcyBkb25lIGFuZCBzY3JpcHQgY2FsbGJhY2tzIGNhbiBiZSBjYWxsZWQgdG8gcmVwb3J0IHdoaWNoIG9iamVjdHMgYXJlIHZpc2libGVcbiAgICAgICAgdGhpcy5jdWxsQ29tcG9zaXRpb24oY29tcCk7XG5cbiAgICAgICAgLy8gR1BVIHVwZGF0ZSBmb3IgYWxsIHZpc2libGUgb2JqZWN0c1xuICAgICAgICB0aGlzLmdwdVVwZGF0ZShjb21wLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICByZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhLm9uUG9zdHByb2Nlc3NpbmcpO1xuXG4gICAgICAgIC8vIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgZm9yIGNhbWVyYVxuICAgICAgICBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwYXNzIHJlcHJlc2VudGluZyB0aGUgbGF5ZXIgY29tcG9zaXRpb24ncyByZW5kZXIgYWN0aW9ucyBpbiB0aGUgc3BlY2lmaWVkIHJhbmdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uIHRvIHJlbmRlci5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc1JlbmRlckFjdGlvbnMoY29tcCwgcmFuZ2UpIHtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IHJhbmdlLnN0YXJ0OyBpIDw9IHJhbmdlLmVuZDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlbmRlckFjdGlvbihjb21wLCByZW5kZXJBY3Rpb25zW2ldLCBpID09PSByYW5nZS5zdGFydCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb259IHJlbmRlckFjdGlvbiAtIFRoZSByZW5kZXJcbiAgICAgKiBhY3Rpb24uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaXJzdFJlbmRlckFjdGlvbiAtIFRydWUgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBpbiB0aGUgcmVuZGVyIHBhc3MuXG4gICAgICovXG4gICAgcmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbiwgZmlyc3RSZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24uaXNMYXllckVuYWJsZWQoY29tcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgY2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJ25vbmFtZScpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGxheWVyLm5hbWUpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZHJhd1RpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gQ2FsbCBwcmVyZW5kZXIgY2FsbGJhY2sgaWYgdGhlcmUncyBvbmVcbiAgICAgICAgaWYgKCF0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUoY2FtZXJhUGFzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJhbnNwYXJlbnQgJiYgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGxlZCBmb3IgdGhlIGZpcnN0IHN1YmxheWVyIGFuZCBmb3IgZXZlcnkgY2FtZXJhXG4gICAgICAgIGlmICghKGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBpZiAobGF5ZXIub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblByZVJlbmRlcihjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCBhIGZpcnN0IHJlbmRlciBhY3Rpb24gdG8gdGhlIHJlbmRlciB0YXJnZXQsIG9yIGlmIHRoZSByZW5kZXIgdGFyZ2V0IHdhcyBub3RcbiAgICAgICAgICAgIC8vIGZ1bGx5IGNsZWFyZWQgb24gcGFzcyBzdGFydCwgd2UgbmVlZCB0byBleGVjdXRlIGNsZWFycyBoZXJlXG4gICAgICAgICAgICBpZiAoIWZpcnN0UmVuZGVyQWN0aW9uIHx8ICFjYW1lcmEuY2FtZXJhLmZ1bGxTaXplQ2xlYXJSZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhcihjYW1lcmEuY2FtZXJhLCByZW5kZXJBY3Rpb24uY2xlYXJDb2xvciwgcmVuZGVyQWN0aW9uLmNsZWFyRGVwdGgsIHJlbmRlckFjdGlvbi5jbGVhclN0ZW5jaWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzb3J0VGltZSA9IG5vdygpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9zb3J0VmlzaWJsZSh0cmFuc3BhcmVudCwgY2FtZXJhLmNhbWVyYS5ub2RlLCBjYW1lcmFQYXNzKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5fc29ydFRpbWUgKz0gbm93KCkgLSBzb3J0VGltZTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIC8vIGFkZCBkZWJ1ZyBtZXNoIGluc3RhbmNlcyB0byB2aXNpYmxlIGxpc3RcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLm9uUHJlUmVuZGVyTGF5ZXIobGF5ZXIsIHZpc2libGUsIHRyYW5zcGFyZW50KTtcblxuICAgICAgICAgICAgLy8gdXBsb2FkIGNsdXN0ZXJlZCBsaWdodHMgdW5pZm9ybXNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycy5hY3RpdmF0ZSh0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAgICAgICAgIC8vIGRlYnVnIHJlbmRlcmluZyBvZiBjbHVzdGVyc1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgJiYgdGhpcy5zY2VuZS5saWdodGluZy5kZWJ1Z0xheWVyID09PSBsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFdvcmxkQ2x1c3RlcnNEZWJ1Zy5yZW5kZXIocmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMsIHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBub3QgdmVyeSBjbGV2ZXIgZ2xvYmFsIHZhcmlhYmxlIHdoaWNoIGlzIG9ubHkgdXNlZnVsIHdoZW4gdGhlcmUncyBqdXN0IG9uZSBjYW1lcmFcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYSA9IGNhbWVyYS5jYW1lcmE7XG5cbiAgICAgICAgICAgIGNvbnN0IHZpZXdDb3VudCA9IHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLmNhbWVyYSwgcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHJlbmRlckFjdGlvbi52aWV3QmluZEdyb3VwcywgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0LCB2aWV3Q291bnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmFibGUgZmxpcCBmYWNlcyBpZiBlaXRoZXIgdGhlIGNhbWVyYSBoYXMgX2ZsaXBGYWNlcyBlbmFibGVkIG9yIHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICAvLyBoYXMgZmxpcFkgZW5hYmxlZFxuICAgICAgICAgICAgY29uc3QgZmxpcEZhY2VzID0gISEoY2FtZXJhLmNhbWVyYS5fZmxpcEZhY2VzIF4gcmVuZGVyQWN0aW9uPy5yZW5kZXJUYXJnZXQ/LmZsaXBZKTtcblxuICAgICAgICAgICAgY29uc3QgZHJhd3MgPSB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJGb3J3YXJkKGNhbWVyYS5jYW1lcmEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLl9zcGxpdExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5zaGFkZXJQYXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLmN1bGxpbmdNYXNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uRHJhd0NhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzKTtcbiAgICAgICAgICAgIGxheWVyLl9mb3J3YXJkRHJhd0NhbGxzICs9IHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgLSBkcmF3cztcblxuICAgICAgICAgICAgLy8gUmV2ZXJ0IHRlbXAgZnJhbWUgc3R1ZmZcbiAgICAgICAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIG5vdCBiZSBoZXJlLCBhcyBlYWNoIHJlbmRlcmluZyAvIGNsZWFyaW5nIHNob3VsZCBleHBsaWNpdGx5IHNldCB1cCB3aGF0XG4gICAgICAgICAgICAvLyBpdCByZXF1aXJlcyAodGhlIHByb3BlcnRpZXMgYXJlIHBhcnQgb2YgcmVuZGVyIHBpcGVsaW5lIG9uIFdlYkdQVSBhbnl3YXlzKVxuICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsVGVzdChmYWxzZSk7IC8vIGRvbid0IGxlYWsgc3RlbmNpbCBzdGF0ZVxuICAgICAgICAgICAgZGV2aWNlLnNldEFscGhhVG9Db3ZlcmFnZShmYWxzZSk7IC8vIGRvbid0IGxlYWsgYTJjIHN0YXRlXG4gICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGwgbGF5ZXIncyBwb3N0cmVuZGVyIGNhbGxiYWNrIGlmIHRoZXJlJ3Mgb25lXG4gICAgICAgIGlmICghdHJhbnNwYXJlbnQgJiYgbGF5ZXIub25Qb3N0UmVuZGVyT3BhcXVlKSB7XG4gICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXJPcGFxdWUoY2FtZXJhUGFzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJhbnNwYXJlbnQgJiYgbGF5ZXIub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgIGxheWVyLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50KGNhbWVyYVBhc3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsYXllci5vblBvc3RSZW5kZXIgJiYgIShsYXllci5fcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMgJiAoMSA8PCBjYW1lcmFQYXNzKSkpIHtcbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciAmPSB+KHRyYW5zcGFyZW50ID8gMiA6IDEpO1xuICAgICAgICAgICAgaWYgKGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxheWVyLm9uUG9zdFJlbmRlcihjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMgfD0gMSA8PCBjYW1lcmFQYXNzO1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciA9IGxheWVyLl9wb3N0UmVuZGVyQ291bnRlck1heDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgbGF5ZXIuX3JlbmRlclRpbWUgKz0gbm93KCkgLSBkcmF3VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxufVxuXG5leHBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJ3ZWJnbDFEZXB0aENsZWFyQ29sb3IiLCJDb2xvciIsIl9kcmF3Q2FsbExpc3QiLCJkcmF3Q2FsbHMiLCJpc05ld01hdGVyaWFsIiwibGlnaHRNYXNrQ2hhbmdlZCIsIkZvcndhcmRSZW5kZXJlciIsIlJlbmRlcmVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImRldmljZSIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJfZGVwdGhNYXBUaW1lIiwiX2ZvcndhcmRUaW1lIiwiX3NvcnRUaW1lIiwic2NvcGUiLCJmb2dDb2xvcklkIiwicmVzb2x2ZSIsImZvZ1N0YXJ0SWQiLCJmb2dFbmRJZCIsImZvZ0RlbnNpdHlJZCIsImFtYmllbnRJZCIsInNreWJveEludGVuc2l0eUlkIiwiY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQiLCJsaWdodENvbG9ySWQiLCJsaWdodERpciIsImxpZ2h0RGlySWQiLCJsaWdodFNoYWRvd01hcElkIiwibGlnaHRTaGFkb3dNYXRyaXhJZCIsImxpZ2h0U2hhZG93UGFyYW1zSWQiLCJsaWdodFNoYWRvd0ludGVuc2l0eSIsImxpZ2h0UmFkaXVzSWQiLCJsaWdodFBvcyIsImxpZ2h0UG9zSWQiLCJsaWdodFdpZHRoIiwibGlnaHRXaWR0aElkIiwibGlnaHRIZWlnaHQiLCJsaWdodEhlaWdodElkIiwibGlnaHRJbkFuZ2xlSWQiLCJsaWdodE91dEFuZ2xlSWQiLCJsaWdodENvb2tpZUlkIiwibGlnaHRDb29raWVJbnRJZCIsImxpZ2h0Q29va2llTWF0cml4SWQiLCJsaWdodENvb2tpZU9mZnNldElkIiwic2hhZG93TWF0cml4UGFsZXR0ZUlkIiwic2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkIiwic2hhZG93Q2FzY2FkZUNvdW50SWQiLCJzY3JlZW5TaXplSWQiLCJfc2NyZWVuU2l6ZSIsIkZsb2F0MzJBcnJheSIsImZvZ0NvbG9yIiwiYW1iaWVudENvbG9yIiwiZGVzdHJveSIsImRpc3BhdGNoR2xvYmFsTGlnaHRzIiwic2NlbmUiLCJhbWJpZW50TGlnaHQiLCJyIiwiZyIsImIiLCJnYW1tYUNvcnJlY3Rpb24iLCJpIiwiTWF0aCIsInBvdyIsInBoeXNpY2FsVW5pdHMiLCJhbWJpZW50THVtaW5hbmNlIiwic2V0VmFsdWUiLCJza3lib3hMdW1pbmFuY2UiLCJza3lib3hJbnRlbnNpdHkiLCJfc2t5Ym94Um90YXRpb25NYXQzIiwiZGF0YSIsIl9yZXNvbHZlTGlnaHQiLCJsaWdodCIsInNldExUQ0RpcmVjdGlvbmFsTGlnaHQiLCJ3dG0iLCJjbnQiLCJkaXIiLCJjYW1wb3MiLCJmYXIiLCJ4IiwieSIsInoiLCJoV2lkdGgiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJWZWMzIiwiaEhlaWdodCIsImRpc3BhdGNoRGlyZWN0TGlnaHRzIiwiZGlycyIsIm1hc2siLCJjYW1lcmEiLCJsZW5ndGgiLCJkaXJlY3Rpb25hbCIsIl9ub2RlIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJfbGluZWFyRmluYWxDb2xvciIsIl9maW5hbENvbG9yIiwiZ2V0WSIsIl9kaXJlY3Rpb24iLCJtdWxTY2FsYXIiLCJub3JtYWxpemUiLCJzaGFwZSIsIkxJR0hUU0hBUEVfUFVOQ1RVQUwiLCJnZXRQb3NpdGlvbiIsImZhckNsaXAiLCJjYXN0U2hhZG93cyIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJiaWFzZXMiLCJfZ2V0VW5pZm9ybUJpYXNWYWx1ZXMiLCJzaGFkb3dCdWZmZXIiLCJzaGFkb3dNYXRyaXgiLCJfc2hhZG93TWF0cml4UGFsZXR0ZSIsIl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzIiwibnVtQ2FzY2FkZXMiLCJzaGFkb3dJbnRlbnNpdHkiLCJwYXJhbXMiLCJfc2hhZG93UmVuZGVyUGFyYW1zIiwiX3NoYWRvd1Jlc29sdXRpb24iLCJub3JtYWxCaWFzIiwiYmlhcyIsInNldExUQ1Bvc2l0aW9uYWxMaWdodCIsImRpc3BhdGNoT21uaUxpZ2h0Iiwib21uaSIsImF0dGVudWF0aW9uRW5kIiwiZ2V0VHJhbnNsYXRpb24iLCJfcG9zaXRpb24iLCJfY29va2llIiwiY29va2llSW50ZW5zaXR5IiwiZGlzcGF0Y2hTcG90TGlnaHQiLCJzcG90IiwiX2lubmVyQ29uZUFuZ2xlQ29zIiwiX291dGVyQ29uZUFuZ2xlQ29zIiwiY29va2llTWF0cml4IiwiTGlnaHRDYW1lcmEiLCJldmFsU3BvdENvb2tpZU1hdHJpeCIsIl9jb29raWVUcmFuc2Zvcm0iLCJfY29va2llVHJhbnNmb3JtVW5pZm9ybSIsInciLCJfY29va2llT2Zmc2V0VW5pZm9ybSIsIl9jb29raWVPZmZzZXQiLCJkaXNwYXRjaExvY2FsTGlnaHRzIiwic29ydGVkTGlnaHRzIiwidXNlZERpckxpZ2h0cyIsInN0YXRpY0xpZ2h0TGlzdCIsIm9tbmlzIiwiTElHSFRUWVBFX09NTkkiLCJudW1PbW5pcyIsImlzU3RhdGljIiwic3RhdGljSWQiLCJfdHlwZSIsInNwdHMiLCJMSUdIVFRZUEVfU1BPVCIsIm51bVNwdHMiLCJyZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyIsImRyYXdDYWxsc0NvdW50IiwiY3VsbGluZ01hc2siLCJsYXllciIsInBhc3MiLCJhZGRDYWxsIiwiZHJhd0NhbGwiLCJwdXNoIiwibGlnaHRIYXNoIiwiX2xpZ2h0SGFzaCIsInByZXZNYXRlcmlhbCIsInByZXZPYmpEZWZzIiwicHJldlN0YXRpYyIsInByZXZMaWdodE1hc2siLCJjb21tYW5kIiwic2tpcFJlbmRlckNhbWVyYSIsIl9za2lwUmVuZGVyQ291bnRlciIsInNraXBSZW5kZXJBZnRlciIsImVuc3VyZU1hdGVyaWFsIiwibWF0ZXJpYWwiLCJvYmpEZWZzIiwiX3NoYWRlckRlZnMiLCJsaWdodE1hc2siLCJfc2NlbmUiLCJkaXJ0eSIsInVwZGF0ZVVuaWZvcm1zIiwiX2RpcnR5QmxlbmQiLCJsYXllcnMiLCJfc2hhZGVyIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJub2RlIiwibmFtZSIsInZhcmlhbnRLZXkiLCJ2YXJpYW50cyIsInVwZGF0ZVBhc3NTaGFkZXIiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJfc3RhdGljTGlnaHRMaXN0IiwicG9wR3B1TWFya2VyIiwiRGVidWciLCJhc3NlcnQiLCJlbmRTaGFkZXJCYXRjaCIsInJlbmRlckZvcndhcmRJbnRlcm5hbCIsInByZXBhcmVkQ2FsbHMiLCJkcmF3Q2FsbGJhY2siLCJmbGlwRmFjZXMiLCJwYXNzRmxhZyIsInNraXBNYXRlcmlhbCIsInByZXBhcmVkQ2FsbHNDb3VudCIsIm5ld01hdGVyaWFsIiwic2hhZGVyIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiZXJyb3IiLCJsYWJlbCIsInNldFBhcmFtZXRlcnMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJhbHBoYVRlc3RJZCIsImFscGhhVGVzdCIsInNldEJsZW5kU3RhdGUiLCJibGVuZFN0YXRlIiwic2V0RGVwdGhTdGF0ZSIsImRlcHRoU3RhdGUiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRvQ292ZXJhZ2UiLCJkZXB0aEJpYXMiLCJzbG9wZURlcHRoQmlhcyIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsInNldEN1bGxNb2RlIiwiX2N1bGxGYWNlcyIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwic2V0U3RlbmNpbFRlc3QiLCJzZXRTdGVuY2lsRnVuYyIsImZ1bmMiLCJyZWYiLCJyZWFkTWFzayIsInNldFN0ZW5jaWxPcGVyYXRpb24iLCJmYWlsIiwiemZhaWwiLCJ6cGFzcyIsIndyaXRlTWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQiLCJGVU5DX0FMV0FZUyIsIlNURU5DSUxPUF9LRUVQIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJtZXNoIiwic2V0VmVydGV4QnVmZmVycyIsInNldE1vcnBoaW5nIiwibW9ycGhJbnN0YW5jZSIsInNldFNraW5uaW5nIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJzdHlsZSIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsInhyIiwic2Vzc2lvbiIsInZpZXdzIiwidiIsInZpZXciLCJzZXRWaWV3cG9ydCIsInZpZXdwb3J0IiwicHJvaklkIiwicHJvak1hdCIsInByb2pTa3lib3hJZCIsInZpZXdJZCIsInZpZXdPZmZNYXQiLCJ2aWV3SW52SWQiLCJ2aWV3SW52T2ZmTWF0Iiwidmlld0lkMyIsInZpZXdNYXQzIiwidmlld1Byb2pJZCIsInByb2pWaWV3T2ZmTWF0Iiwidmlld1Bvc0lkIiwicG9zaXRpb24iLCJkcmF3SW5zdGFuY2UiLCJkcmF3SW5zdGFuY2UyIiwicGFyYW1ldGVycyIsInJlbmRlckZvcndhcmQiLCJhbGxEcmF3Q2FsbHMiLCJhbGxEcmF3Q2FsbHNDb3VudCIsImZvcndhcmRTdGFydFRpbWUiLCJub3ciLCJzZXRTY2VuZUNvbnN0YW50cyIsImZvZyIsIkZPR19OT05FIiwiRk9HX0xJTkVBUiIsImZvZ1N0YXJ0IiwiZm9nRW5kIiwiZm9nRGVuc2l0eSIsIndpZHRoIiwiaGVpZ2h0IiwidXBkYXRlTGlnaHRTdGF0cyIsImNvbXAiLCJjb21wVXBkYXRlZEZsYWdzIiwiQ09NUFVQREFURURfTElHSFRTIiwiX3N0YXRzVXBkYXRlZCIsInN0YXRzIiwiX3N0YXRzIiwibGlnaHRzIiwiX2xpZ2h0cyIsImR5bmFtaWNMaWdodHMiLCJiYWtlZExpZ2h0cyIsImwiLCJlbmFibGVkIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiTUFTS19CQUtFIiwiQ09NUFVQREFURURfSU5TVEFOQ0VTIiwibWVzaEluc3RhbmNlcyIsIl9tZXNoSW5zdGFuY2VzIiwiYnVpbGRGcmFtZUdyYXBoIiwiZnJhbWVHcmFwaCIsImxheWVyQ29tcG9zaXRpb24iLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJyZXNldCIsInVwZGF0ZSIsInJlbmRlclBhc3MiLCJSZW5kZXJQYXNzIiwibGlnaHRpbmciLCJjb29raWVzRW5hYmxlZCIsInJlbmRlckNvb2tpZXMiLCJfc3BsaXRMaWdodHMiLCJyZXF1aXJlc0N1YmVtYXBzIiwiRGVidWdIZWxwZXIiLCJzZXROYW1lIiwiYWRkUmVuZGVyUGFzcyIsInNoYWRvd3NFbmFibGVkIiwic3BsaXRMaWdodHMiLCJfc2hhZG93UmVuZGVyZXJMb2NhbCIsInByZXBhcmVDbHVzdGVyZWRSZW5kZXJQYXNzIiwiYWZ0ZXIiLCJ1cGRhdGVDbHVzdGVycyIsImJ1aWxkTm9uQ2x1c3RlcmVkUmVuZGVyUGFzc2VzIiwic3RhcnRJbmRleCIsIm5ld1N0YXJ0IiwicmVuZGVyVGFyZ2V0IiwicmVuZGVyQWN0aW9ucyIsIl9yZW5kZXJBY3Rpb25zIiwicmVuZGVyQWN0aW9uIiwibGF5ZXJMaXN0IiwibGF5ZXJJbmRleCIsImNhbWVyYXMiLCJjYW1lcmFJbmRleCIsImlzTGF5ZXJFbmFibGVkIiwiaXNEZXB0aExheWVyIiwiaWQiLCJMQVlFUklEX0RFUFRIIiwiaXNHcmFiUGFzcyIsInJlbmRlclNjZW5lQ29sb3JNYXAiLCJyZW5kZXJTY2VuZURlcHRoTWFwIiwiaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIm5leHRJbmRleCIsIm5leHRSZW5kZXJBY3Rpb24iLCJpc05leHRMYXllckRlcHRoIiwiaXNOZXh0TGF5ZXJHcmFiUGFzcyIsImFkZE1haW5SZW5kZXJQYXNzIiwidHJpZ2dlclBvc3Rwcm9jZXNzIiwib25Qb3N0cHJvY2Vzc2luZyIsInJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyIsImVuZEluZGV4IiwicmFuZ2UiLCJzdGFydCIsImVuZCIsInJlbmRlclBhc3NSZW5kZXJBY3Rpb25zIiwic3RhcnRSZW5kZXJBY3Rpb24iLCJlbmRSZW5kZXJBY3Rpb24iLCJzdGFydExheWVyIiwiZmlyc3RDYW1lcmFVc2UiLCJvblByZVJlbmRlciIsImJlZm9yZSIsImxhc3RDYW1lcmFVc2UiLCJvblBvc3RSZW5kZXIiLCJncmFiUGFzc1JlcXVpcmVkIiwiU2NlbmVHcmFiIiwicmVxdWlyZXNSZW5kZXJQYXNzIiwiaXNSZWFsUGFzcyIsImluaXQiLCJmdWxsU2l6ZUNsZWFyUmVjdCIsInNldENsZWFyQ29sb3IiLCJzZXRDbGVhckRlcHRoIiwiY2xlYXJDb2xvciIsImNsZWFyRGVwdGgiLCJjbGVhclN0ZW5jaWwiLCJzZXRDbGVhclN0ZW5jaWwiLCJlbnRpdHkiLCJmcmFtZVVwZGF0ZSIsInNoYWRvd1JlbmRlcmVyIiwiX3VwZGF0ZVNreSIsInVwZGF0ZWQiLCJ1cGRhdGVMYXllckNvbXBvc2l0aW9uIiwibGlnaHRzQ2hhbmdlZCIsImJlZ2luRnJhbWUiLCJjdWxsQ29tcG9zaXRpb24iLCJncHVVcGRhdGUiLCJyZW5kZXJSZW5kZXJBY3Rpb24iLCJmaXJzdFJlbmRlckFjdGlvbiIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJMaXN0IiwiY2FtZXJhUGFzcyIsImRyYXdUaW1lIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblByZVJlbmRlclRyYW5zcGFyZW50IiwiX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJzZXR1cFZpZXdwb3J0IiwiY2xlYXIiLCJzb3J0VGltZSIsIl9zb3J0VmlzaWJsZSIsIm9iamVjdHMiLCJpbnN0YW5jZXMiLCJ2aXNpYmxlIiwidmlzaWJsZVRyYW5zcGFyZW50IiwidmlzaWJsZU9wYXF1ZSIsImltbWVkaWF0ZSIsIm9uUHJlUmVuZGVyTGF5ZXIiLCJsaWdodENsdXN0ZXJzIiwiYWN0aXZhdGUiLCJsaWdodFRleHR1cmVBdGxhcyIsImNsdXN0ZXJzRGVidWdSZW5kZXJlZCIsImRlYnVnTGF5ZXIiLCJXb3JsZENsdXN0ZXJzRGVidWciLCJyZW5kZXIiLCJfYWN0aXZlQ2FtZXJhIiwidmlld0NvdW50Iiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJ2aWV3QmluZEdyb3VwcyIsIl9mbGlwRmFjZXMiLCJmbGlwWSIsImRyYXdzIiwibGlzdCIsInNoYWRlclBhc3MiLCJvbkRyYXdDYWxsIiwiQmxlbmRTdGF0ZSIsIkRFRkFVTFQiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJUcmFuc3BhcmVudCIsIl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsIl9wb3N0UmVuZGVyQ291bnRlciIsIl9wb3N0UmVuZGVyQ291bnRlck1heCIsIl9yZW5kZXJUaW1lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNEJBLE1BQU1BLHFCQUFxQixHQUFHLElBQUlDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHLEVBQUUsS0FBSyxHQUFHLEdBQUcsRUFBRSxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUE7QUFFM0YsTUFBTUMsYUFBYSxHQUFHO0FBQ2xCQyxFQUFBQSxTQUFTLEVBQUUsRUFBRTtBQUNiQyxFQUFBQSxhQUFhLEVBQUUsRUFBRTtBQUNqQkMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFBQTtBQUN0QixDQUFDLENBQUE7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGVBQWUsU0FBU0MsUUFBUSxDQUFDO0FBQ25DO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXLENBQUNDLGNBQWMsRUFBRTtJQUN4QixLQUFLLENBQUNBLGNBQWMsQ0FBQyxDQUFBO0FBRXJCLElBQUEsTUFBTUMsTUFBTSxH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
