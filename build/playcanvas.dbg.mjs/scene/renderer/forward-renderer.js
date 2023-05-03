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

      // shader pass - use setting from camera if available, otherwise use layer setting
      const shaderPass = (_camera$camera$shader = (_camera$camera$shader2 = camera.camera.shaderPassInfo) == null ? void 0 : _camera$camera$shader2.index) != null ? _camera$camera$shader : layer.shaderPass;
      const draws = this._forwardDrawCalls;
      this.renderForward(camera.camera, visible.list, visible.length, layer._splitLights, shaderPass, layer.cullingMask, layer.onDrawCall, layer, flipFaces);
      layer._forwardDrawCalls += this._forwardDrawCalls - draws;

      // Revert temp frame stuff
      // TODO: this should not be here, as each rendering / clearing should explicitly set up what
      // it requires (the properties are part of render pipeline on WebGPU anyways)
      device.setBlendState(BlendState.DEFAULT);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJztcblxuaW1wb3J0IHtcbiAgICBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBGT0dfTk9ORSwgRk9HX0xJTkVBUixcbiAgICBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0JBS0UsXG4gICAgTEFZRVJJRF9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyc7XG5cbmNvbnN0IHdlYmdsMURlcHRoQ2xlYXJDb2xvciA9IG5ldyBDb2xvcigyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSk7XG5cbmNvbnN0IF9kcmF3Q2FsbExpc3QgPSB7XG4gICAgZHJhd0NhbGxzOiBbXSxcbiAgICBpc05ld01hdGVyaWFsOiBbXSxcbiAgICBsaWdodE1hc2tDaGFuZ2VkOiBbXSxcblxuICAgIGNsZWFyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZHJhd0NhbGxzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuaXNOZXdNYXRlcmlhbC5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmxpZ2h0TWFza0NoYW5nZWQubGVuZ3RoID0gMDtcbiAgICB9XG59O1xuXG4vKipcbiAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyIHJlbmRlcnMge0BsaW5rIFNjZW5lfXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBGb3J3YXJkUmVuZGVyZXIgZXh0ZW5kcyBSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEZvcndhcmRSZW5kZXJlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5fZGVwdGhNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9zb3J0VGltZSA9IDA7XG5cbiAgICAgICAgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBkZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvcklkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2NvbG9yJyk7XG4gICAgICAgIHRoaXMuZm9nU3RhcnRJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19zdGFydCcpO1xuICAgICAgICB0aGlzLmZvZ0VuZElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2VuZCcpO1xuICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19kZW5zaXR5Jyk7XG5cbiAgICAgICAgdGhpcy5hbWJpZW50SWQgPSBzY29wZS5yZXNvbHZlKCdsaWdodF9nbG9iYWxBbWJpZW50Jyk7XG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQgPSBzY29wZS5yZXNvbHZlKCdza3lib3hJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5jdWJlTWFwUm90YXRpb25NYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ2N1YmVNYXBSb3RhdGlvbk1hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyID0gW107XG4gICAgICAgIHRoaXMubGlnaHREaXJJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5ID0gW107XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zID0gW107XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGggPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0T3V0QW5nbGVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWQgPSBbXTtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWQgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZCA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NyZWVuU2l6ZUlkID0gc2NvcGUucmVzb2x2ZSgndVNjcmVlblNpemUnKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgIC8vIFN0YXRpYyBwcm9wZXJ0aWVzIHVzZWQgYnkgdGhlIFByb2ZpbGVyIGluIHRoZSBFZGl0b3IncyBMYXVuY2ggUGFnZVxuICAgIHN0YXRpYyBza2lwUmVuZGVyQ2FtZXJhID0gbnVsbDtcblxuICAgIHN0YXRpYyBfc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgc3RhdGljIHNraXBSZW5kZXJBZnRlciA9IDA7XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICovXG4gICAgZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpIHtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMF0gPSBzY2VuZS5hbWJpZW50TGlnaHQucjtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMV0gPSBzY2VuZS5hbWJpZW50TGlnaHQuZztcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMl0gPSBzY2VuZS5hbWJpZW50TGlnaHQuYjtcbiAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFtYmllbnRDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuYW1iaWVudENvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzY2VuZS5waHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldICo9IHNjZW5lLmFtYmllbnRMdW1pbmFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hbWJpZW50SWQuc2V0VmFsdWUodGhpcy5hbWJpZW50Q29sb3IpO1xuXG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUucGh5c2ljYWxVbml0cyA/IHNjZW5lLnNreWJveEx1bWluYW5jZSA6IHNjZW5lLnNreWJveEludGVuc2l0eSk7XG4gICAgICAgIHRoaXMuY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQuc2V0VmFsdWUoc2NlbmUuX3NreWJveFJvdGF0aW9uTWF0My5kYXRhKTtcbiAgICB9XG5cbiAgICBfcmVzb2x2ZUxpZ2h0KHNjb3BlLCBpKSB7XG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gJ2xpZ2h0JyArIGk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29sb3InKTtcbiAgICAgICAgdGhpcy5saWdodERpcltpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHREaXJJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2RpcmVjdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXAnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4Jyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd1BhcmFtcycpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3JhZGl1cycpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcG9zaXRpb24nKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19oYWxmV2lkdGgnKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZIZWlnaHQnKTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2lubmVyQ29uZUFuZ2xlJyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfb3V0ZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llJyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZUludGVuc2l0eScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llT2Zmc2V0Jyk7XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4UGFsZXR0ZVswXScpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbMF0nKTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVDb3VudCcpO1xuICAgIH1cblxuICAgIHNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpciwgY2FtcG9zLCBmYXIpIHtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gY2FtcG9zLnggLSBkaXIueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gY2FtcG9zLnkgLSBkaXIueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gY2FtcG9zLnogLSBkaXIueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGgueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0LnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hEaXJlY3RMaWdodHMoZGlycywgc2NlbmUsIG1hc2ssIGNhbWVyYSkge1xuICAgICAgICBsZXQgY250ID0gMDtcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCEoZGlyc1tpXS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBkaXJlY3Rpb25hbCA9IGRpcnNbaV07XG4gICAgICAgICAgICBjb25zdCB3dG0gPSBkaXJlY3Rpb25hbC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gZGlyZWN0aW9uYWwuX2xpbmVhckZpbmFsQ29sb3IgOiBkaXJlY3Rpb25hbC5fZmluYWxDb2xvcik7XG5cbiAgICAgICAgICAgIC8vIERpcmVjdGlvbmFsIGxpZ2h0cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgICAgIHd0bS5nZXRZKGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgICAgICBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzBdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi54O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi55O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzJdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi56O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcklkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodERpcltjbnRdKTtcblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbmFsLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlIC0gTkIgZGlyZWN0aW9uYWwgYXJlYSBsaWdodCBzcGVjdWxhciBpcyBhcHByb3hpbWF0ZWQgYnkgcHV0dGluZyB0aGUgYXJlYSBsaWdodCBhdCB0aGUgZmFyIGNsaXBcbiAgICAgICAgICAgICAgICB0aGlzLnNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24sIGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpLCBjYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb25hbC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gZGlyZWN0aW9uYWwuZ2V0UmVuZGVyRGF0YShjYW1lcmEsIDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IGRpcmVjdGlvbmFsLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd01hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5udW1DYXNjYWRlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBkaXJlY3Rpb25hbC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSAzO1xuICAgICAgICAgICAgICAgIHBhcmFtc1swXSA9IGRpcmVjdGlvbmFsLl9zaGFkb3dSZXNvbHV0aW9uOyAgLy8gTm90ZTogdGhpcyBuZWVkcyB0byBjaGFuZ2UgZm9yIG5vbi1zcXVhcmUgc2hhZG93IG1hcHMgKDIgY2FzY2FkZXMpLiBDdXJyZW50bHkgc3F1YXJlIGlzIHVzZWRcbiAgICAgICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNudDtcbiAgICB9XG5cbiAgICBzZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpIHtcbiAgICAgICAgY29uc3QgaFdpZHRoID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygtMC41LCAwLCAwKSk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzBdID0gaFdpZHRoLng7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzFdID0gaFdpZHRoLnk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzJdID0gaFdpZHRoLno7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFdpZHRoW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhIZWlnaHQgPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKDAsIDAsIDAuNSkpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMF0gPSBoSGVpZ2h0Lng7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsxXSA9IGhIZWlnaHQueTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzJdID0gaEhlaWdodC56O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0SGVpZ2h0W2NudF0pO1xuICAgIH1cblxuICAgIGRpc3BhdGNoT21uaUxpZ2h0KHNjZW5lLCBzY29wZSwgb21uaSwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IG9tbmkuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtjbnRdLnNldFZhbHVlKG9tbmkuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IG9tbmkuX2xpbmVhckZpbmFsQ29sb3IgOiBvbW5pLl9maW5hbENvbG9yKTtcbiAgICAgICAgd3RtLmdldFRyYW5zbGF0aW9uKG9tbmkuX3Bvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gb21uaS5fcG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gb21uaS5fcG9zaXRpb24ueTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gb21uaS5fcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBpZiAob21uaS5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlXG4gICAgICAgICAgICB0aGlzLnNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob21uaS5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgbWFwXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBvbW5pLmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gb21uaS5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IG9tbmkuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gb21uaS5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbM10gPSAxLjAgLyBvbW5pLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShvbW5pLnNoYWRvd0ludGVuc2l0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9tbmkuX2Nvb2tpZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2NudF0uc2V0VmFsdWUob21uaS5fY29va2llKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHd0bS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtjbnRdLnNldFZhbHVlKG9tbmkuY29va2llSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IHNwb3QuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWRbY250XS5zZXRWYWx1ZShzcG90Ll9pbm5lckNvbmVBbmdsZUNvcyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5fb3V0ZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWRbY250XS5zZXRWYWx1ZShzcG90LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBzcG90Ll9saW5lYXJGaW5hbENvbG9yIDogc3BvdC5fZmluYWxDb2xvcik7XG4gICAgICAgIHd0bS5nZXRUcmFuc2xhdGlvbihzcG90Ll9wb3NpdGlvbik7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IHNwb3QuX3Bvc2l0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IHNwb3QuX3Bvc2l0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IHNwb3QuX3Bvc2l0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgaWYgKHNwb3Quc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZVxuICAgICAgICAgICAgdGhpcy5zZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BvdHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgIHd0bS5nZXRZKHNwb3QuX2RpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgc3BvdC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMF0gPSBzcG90Ll9kaXJlY3Rpb24ueDtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gc3BvdC5fZGlyZWN0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVsyXSA9IHNwb3QuX2RpcmVjdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0RGlyW2NudF0pO1xuXG4gICAgICAgIGlmIChzcG90LmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHNwb3QuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBzcG90Ll9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gc3BvdC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBzcG90Ll9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIHNwb3QuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKHNwb3Quc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcG90Ll9jb29raWUpIHtcblxuICAgICAgICAgICAgLy8gaWYgc2hhZG93IGlzIG5vdCByZW5kZXJlZCwgd2UgbmVlZCB0byBldmFsdWF0ZSBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgaWYgKCFzcG90LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29va2llTWF0cml4ID0gTGlnaHRDYW1lcmEuZXZhbFNwb3RDb29raWVNYXRyaXgoc3BvdCk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUoY29va2llTWF0cml4LmRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWUpO1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2NudF0uc2V0VmFsdWUoc3BvdC5jb29raWVJbnRlbnNpdHkpO1xuICAgICAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzFdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLnk7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVsyXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS56O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bM10gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0udztcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtKTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzBdID0gc3BvdC5fY29va2llT2Zmc2V0Lng7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybVsxXSA9IHNwb3QuX2Nvb2tpZU9mZnNldC55O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVPZmZzZXRJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hMb2NhbExpZ2h0cyhzb3J0ZWRMaWdodHMsIHNjZW5lLCBtYXNrLCB1c2VkRGlyTGlnaHRzLCBzdGF0aWNMaWdodExpc3QpIHtcblxuICAgICAgICBsZXQgY250ID0gdXNlZERpckxpZ2h0cztcbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICBjb25zdCBvbW5pcyA9IHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfT01OSV07XG4gICAgICAgIGNvbnN0IG51bU9tbmlzID0gb21uaXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU9tbmlzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9tbmkgPSBvbW5pc1tpXTtcbiAgICAgICAgICAgIGlmICghKG9tbmkubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChvbW5pLmlzU3RhdGljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RhdGljSWQgPSAwO1xuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBsZXQgb21uaSA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB3aGlsZSAob21uaSAmJiBvbW5pLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgICAgIGNudCsrO1xuICAgICAgICAgICAgICAgIHN0YXRpY0lkKys7XG4gICAgICAgICAgICAgICAgb21uaSA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcHRzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9TUE9UXTtcbiAgICAgICAgY29uc3QgbnVtU3B0cyA9IHNwdHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNwdHM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc3BvdCA9IHNwdHNbaV07XG4gICAgICAgICAgICBpZiAoIShzcG90Lm1hc2sgJiBtYXNrKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoc3BvdC5pc1N0YXRpYykgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgIGNudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0YXRpY0xpZ2h0TGlzdCkge1xuICAgICAgICAgICAgbGV0IHNwb3QgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgd2hpbGUgKHNwb3QgJiYgc3BvdC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgICAgICBjbnQrKztcbiAgICAgICAgICAgICAgICBzdGF0aWNJZCsrO1xuICAgICAgICAgICAgICAgIHNwb3QgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZSBmaXJzdCBwYXNzIG92ZXIgZHJhdyBjYWxscywgaW4gb3JkZXIgdG8gdXBkYXRlIG1hdGVyaWFscyAvIHNoYWRlcnNcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgdGhpczogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYkdMX0FQSS9XZWJHTF9iZXN0X3ByYWN0aWNlcyNjb21waWxlX3NoYWRlcnNfYW5kX2xpbmtfcHJvZ3JhbXNfaW5fcGFyYWxsZWxcbiAgICAvLyB3aGVyZSBpbnN0ZWFkIG9mIGNvbXBpbGluZyBhbmQgbGlua2luZyBzaGFkZXJzLCB3aGljaCBpcyBzZXJpYWwgb3BlcmF0aW9uLCB3ZSBjb21waWxlIGFsbCBvZiB0aGVtIGFuZCB0aGVuIGxpbmsgdGhlbSwgYWxsb3dpbmcgdGhlIHdvcmsgdG9cbiAgICAvLyB0YWtlIHBsYWNlIGluIHBhcmFsbGVsXG4gICAgcmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMoY2FtZXJhLCBkcmF3Q2FsbHMsIGRyYXdDYWxsc0NvdW50LCBzb3J0ZWRMaWdodHMsIGN1bGxpbmdNYXNrLCBsYXllciwgcGFzcykge1xuXG4gICAgICAgIGNvbnN0IGFkZENhbGwgPSAoZHJhd0NhbGwsIGlzTmV3TWF0ZXJpYWwsIGxpZ2h0TWFza0NoYW5nZWQpID0+IHtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QuZHJhd0NhbGxzLnB1c2goZHJhd0NhbGwpO1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5pc05ld01hdGVyaWFsLnB1c2goaXNOZXdNYXRlcmlhbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmxpZ2h0TWFza0NoYW5nZWQucHVzaChsaWdodE1hc2tDaGFuZ2VkKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBzdGFydCB3aXRoIGVtcHR5IGFycmF5c1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmNsZWFyKCk7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgbGlnaHRIYXNoID0gbGF5ZXIgPyBsYXllci5fbGlnaHRIYXNoIDogMDtcbiAgICAgICAgbGV0IHByZXZNYXRlcmlhbCA9IG51bGwsIHByZXZPYmpEZWZzLCBwcmV2U3RhdGljLCBwcmV2TGlnaHRNYXNrO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuXG4gICAgICAgICAgICAvLyBhcHBseSB2aXNpYmlsaXR5IG92ZXJyaWRlXG4gICAgICAgICAgICBpZiAoY3VsbGluZ01hc2sgJiYgZHJhd0NhbGwubWFzayAmJiAhKGN1bGxpbmdNYXNrICYgZHJhd0NhbGwubWFzaykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jb21tYW5kKSB7XG5cbiAgICAgICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEgPT09IEZvcndhcmRSZW5kZXJlci5za2lwUmVuZGVyQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyID49IEZvcndhcmRSZW5kZXJlci5za2lwUmVuZGVyQWZ0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLl9za2lwUmVuZGVyQ291bnRlciA+PSBsYXllci5za2lwUmVuZGVyQWZ0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqRGVmcyA9IGRyYXdDYWxsLl9zaGFkZXJEZWZzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFzayA9IGRyYXdDYWxsLm1hc2s7XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwgJiYgbWF0ZXJpYWwgPT09IHByZXZNYXRlcmlhbCAmJiBvYmpEZWZzICE9PSBwcmV2T2JqRGVmcykge1xuICAgICAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBudWxsOyAvLyBmb3JjZSBjaGFuZ2Ugc2hhZGVyIGlmIHRoZSBvYmplY3QgdXNlcyBhIGRpZmZlcmVudCB2YXJpYW50IG9mIHRoZSBzYW1lIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmlzU3RhdGljIHx8IHByZXZTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJldk1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwgIT09IHByZXZNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzKys7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9zY2VuZSA9IHNjZW5lO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlVW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgbWF0ZXJpYWwgaGFzIGRpcnR5QmxlbmQgc2V0LCBub3RpZnkgc2NlbmUgaGVyZVxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuX2RpcnR5QmxlbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lLmxheWVycy5fZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLl9zaGFkZXJbcGFzc10gfHwgZHJhd0NhbGwuX3NoYWRlckRlZnMgIT09IG9iakRlZnMgfHwgZHJhd0NhbGwuX2xpZ2h0SGFzaCAhPT0gbGlnaHRIYXNoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbWFya2VyIHRvIGFsbG93IHVzIHRvIHNlZSB0aGUgc291cmNlIG5vZGUgZm9yIHNoYWRlciBhbGxvY1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgTm9kZTogJHtkcmF3Q2FsbC5ub2RlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZHJhdyBjYWxscyBub3QgdXNpbmcgc3RhdGljIGxpZ2h0cyB1c2UgdmFyaWFudHMgY2FjaGUgb24gbWF0ZXJpYWwgdG8gcXVpY2tseSBmaW5kIHRoZSBzaGFkZXIsIGFzIHRoZXkgYXJlIGFsbFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc2FtZSBmb3IgdGhlIHNhbWUgcGFzcywgdXNpbmcgYWxsIGxpZ2h0cyBvZiB0aGUgc2NlbmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudEtleSA9IHBhc3MgKyAnXycgKyBvYmpEZWZzICsgJ18nICsgbGlnaHRIYXNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwuX3NoYWRlcltwYXNzXSA9IG1hdGVyaWFsLnZhcmlhbnRzW3ZhcmlhbnRLZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgbnVsbCwgc29ydGVkTGlnaHRzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnZhcmlhbnRzW3ZhcmlhbnRLZXldID0gZHJhd0NhbGwuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RhdGljIGxpZ2h0cyBnZW5lcmF0ZSB1bmlxdWUgc2hhZGVyIHBlciBkcmF3IGNhbGwsIGFzIHN0YXRpYyBsaWdodHMgYXJlIHVuaXF1ZSBwZXIgZHJhdyBjYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHNvIHZhcmlhbnRzIGNhY2hlIGlzIG5vdCB1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwuX2xpZ2h0SGFzaCA9IGxpZ2h0SGFzaDtcblxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdLCBcIm5vIHNoYWRlciBmb3IgcGFzc1wiLCBtYXRlcmlhbCk7XG5cbiAgICAgICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsLCAhcHJldk1hdGVyaWFsIHx8IGxpZ2h0TWFzayAhPT0gcHJldkxpZ2h0TWFzayk7XG5cbiAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBwcmV2T2JqRGVmcyA9IG9iakRlZnM7XG4gICAgICAgICAgICAgICAgcHJldkxpZ2h0TWFzayA9IGxpZ2h0TWFzaztcbiAgICAgICAgICAgICAgICBwcmV2U3RhdGljID0gZHJhd0NhbGwuaXNTdGF0aWM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9jZXNzIHRoZSBiYXRjaCBvZiBzaGFkZXJzIGNyZWF0ZWQgaGVyZVxuICAgICAgICBkZXZpY2UuZW5kU2hhZGVyQmF0Y2g/LigpO1xuXG4gICAgICAgIHJldHVybiBfZHJhd0NhbGxMaXN0O1xuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWcgPSAxIDw8IHBhc3M7XG4gICAgICAgIGNvbnN0IGZsaXBGYWN0b3IgPSBmbGlwRmFjZXMgPyAtMSA6IDE7XG5cbiAgICAgICAgLy8gUmVuZGVyIHRoZSBzY2VuZVxuICAgICAgICBsZXQgc2tpcE1hdGVyaWFsID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHNDb3VudCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVwYXJlZENhbGxzQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzW2ldO1xuXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY29tbWFuZCkge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIGNvbW1hbmRcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5jb21tYW5kKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGEgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld01hdGVyaWFsID0gcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFza0NoYW5nZWQgPSBwcmVwYXJlZENhbGxzLmxpZ2h0TWFza0NoYW5nZWRbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChuZXdNYXRlcmlhbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IGRyYXdDYWxsLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2hhZGVyLmZhaWxlZCAmJiAhZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7cGFzc30gb2JqRGVmcz0ke29iakRlZnN9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCByZW5kZXJpbmcgd2l0aCB0aGUgbWF0ZXJpYWwgaWYgc2hhZGVyIGZhaWxlZFxuICAgICAgICAgICAgICAgICAgICBza2lwTWF0ZXJpYWwgPSBzaGFkZXIuZmFpbGVkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2tpcE1hdGVyaWFsKVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYE1hdGVyaWFsOiAke21hdGVyaWFsLm5hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodE1hc2tDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VkRGlyTGlnaHRzID0gdGhpcy5kaXNwYXRjaERpcmVjdExpZ2h0cyhzb3J0ZWRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXSwgc2NlbmUsIGxpZ2h0TWFzaywgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hMb2NhbExpZ2h0cyhzb3J0ZWRMaWdodHMsIHNjZW5lLCBsaWdodE1hc2ssIHVzZWREaXJMaWdodHMsIGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3QpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbHBoYVRlc3RJZC5zZXRWYWx1ZShtYXRlcmlhbC5hbHBoYVRlc3QpO1xuXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKG1hdGVyaWFsLmJsZW5kU3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShtYXRlcmlhbC5kZXB0aFN0YXRlKTtcblxuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QWxwaGFUb0NvdmVyYWdlKG1hdGVyaWFsLmFscGhhVG9Db3ZlcmFnZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRlcHRoQmlhcyB8fCBtYXRlcmlhbC5zbG9wZURlcHRoQmlhcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXNWYWx1ZXMobWF0ZXJpYWwuZGVwdGhCaWFzLCBtYXRlcmlhbC5zbG9wZURlcHRoQmlhcyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYE5vZGU6ICR7ZHJhd0NhbGwubm9kZS5uYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXR1cEN1bGxNb2RlKGNhbWVyYS5fY3VsbEZhY2VzLCBmbGlwRmFjdG9yLCBkcmF3Q2FsbCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsRnJvbnQgPSBkcmF3Q2FsbC5zdGVuY2lsRnJvbnQgPz8gbWF0ZXJpYWwuc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWxCYWNrID0gZHJhd0NhbGwuc3RlbmNpbEJhY2sgPz8gbWF0ZXJpYWwuc3RlbmNpbEJhY2s7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxTdGF0ZShzdGVuY2lsRnJvbnQsIHN0ZW5jaWxCYWNrKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBkcmF3Q2FsbC5tZXNoO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWcpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRWZXJ0ZXhCdWZmZXJzKGRldmljZSwgbWVzaCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRNb3JwaGluZyhkZXZpY2UsIGRyYXdDYWxsLm1vcnBoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2tpbm5pbmcoZGV2aWNlLCBkcmF3Q2FsbCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwTWVzaFVuaWZvcm1CdWZmZXJzKGRyYXdDYWxsLCBwYXNzKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gZHJhd0NhbGwucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldEluZGV4QnVmZmVyKG1lc2guaW5kZXhCdWZmZXJbc3R5bGVdKTtcblxuICAgICAgICAgICAgICAgIGRyYXdDYWxsYmFjaz8uKGRyYXdDYWxsLCBpKTtcblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24gJiYgY2FtZXJhLnhyLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3cyA9IGNhbWVyYS54ci52aWV3cztcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdzLmxlbmd0aDsgdisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gdmlld3Nbdl07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh2aWV3LnZpZXdwb3J0LngsIHZpZXcudmlld3BvcnQueSwgdmlldy52aWV3cG9ydC56LCB2aWV3LnZpZXdwb3J0LncpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZC5zZXRWYWx1ZSh2aWV3LnZpZXdPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZDMuc2V0VmFsdWUodmlldy52aWV3TWF0My5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Byb2pJZC5zZXRWYWx1ZSh2aWV3LnByb2pWaWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodmlldy5wb3NpdGlvbik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdJbnN0YW5jZTIoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdJbnN0YW5jZShkZXZpY2UsIGRyYXdDYWxsLCBtZXNoLCBzdHlsZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBVbnNldCBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzIGJhY2sgdG8gbWF0ZXJpYWwgdmFsdWVzIGlmIG5leHQgZHJhdyBjYWxsIHdpbGwgdXNlIHRoZSBzYW1lIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgaWYgKGkgPCBwcmVwYXJlZENhbGxzQ291bnQgLSAxICYmICFwcmVwYXJlZENhbGxzLmlzTmV3TWF0ZXJpYWxbaSArIDFdKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBkcmF3Q2FsbC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyRm9yd2FyZChjYW1lcmEsIGFsbERyYXdDYWxscywgYWxsRHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgcGFzcywgY3VsbGluZ01hc2ssIGRyYXdDYWxsYmFjaywgbGF5ZXIsIGZsaXBGYWNlcykge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZm9yd2FyZFN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBydW4gZmlyc3QgcGFzcyBvdmVyIGRyYXcgY2FsbHMgYW5kIGhhbmRsZSBtYXRlcmlhbCAvIHNoYWRlciB1cGRhdGVzXG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHMgPSB0aGlzLnJlbmRlckZvcndhcmRQcmVwYXJlTWF0ZXJpYWxzKGNhbWVyYSwgYWxsRHJhd0NhbGxzLCBhbGxEcmF3Q2FsbHNDb3VudCwgc29ydGVkTGlnaHRzLCBjdWxsaW5nTWFzaywgbGF5ZXIsIHBhc3MpO1xuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpO1xuXG4gICAgICAgIF9kcmF3Q2FsbExpc3QuY2xlYXIoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2ZvcndhcmRUaW1lICs9IG5vdygpIC0gZm9yd2FyZFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgc2V0U2NlbmVDb25zdGFudHMoKSB7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvLyBTZXQgdXAgYW1iaWVudC9leHBvc3VyZVxuICAgICAgICB0aGlzLmRpc3BhdGNoR2xvYmFsTGlnaHRzKHNjZW5lKTtcblxuICAgICAgICAvLyBTZXQgdXAgdGhlIGZvZ1xuICAgICAgICBpZiAoc2NlbmUuZm9nICE9PSBGT0dfTk9ORSkge1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclswXSA9IHNjZW5lLmZvZ0NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzFdID0gc2NlbmUuZm9nQ29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMl0gPSBzY2VuZS5mb2dDb2xvci5iO1xuICAgICAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbaV0gPSBNYXRoLnBvdyh0aGlzLmZvZ0NvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JJZC5zZXRWYWx1ZSh0aGlzLmZvZ0NvbG9yKTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5mb2cgPT09IEZPR19MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ1N0YXJ0SWQuc2V0VmFsdWUoc2NlbmUuZm9nU3RhcnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nRW5kSWQuc2V0VmFsdWUoc2NlbmUuZm9nRW5kKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dEZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUuZm9nRGVuc2l0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdXAgc2NyZWVuIHNpemUgLy8gc2hvdWxkIGJlIFJUIHNpemU/XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzBdID0gZGV2aWNlLndpZHRoO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzFdID0gZGV2aWNlLmhlaWdodDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVsyXSA9IDEgLyBkZXZpY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbM10gPSAxIC8gZGV2aWNlLmhlaWdodDtcbiAgICAgICAgdGhpcy5zY3JlZW5TaXplSWQuc2V0VmFsdWUodGhpcy5fc2NyZWVuU2l6ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb21wVXBkYXRlZEZsYWdzIC0gRmxhZ3Mgb2Ygd2hhdCB3YXMgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVMaWdodFN0YXRzKGNvbXAsIGNvbXBVcGRhdGVkRmxhZ3MpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9MSUdIVFMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gc2NlbmUuX3N0YXRzO1xuICAgICAgICAgICAgc3RhdHMubGlnaHRzID0gY29tcC5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMgPSAwO1xuICAgICAgICAgICAgc3RhdHMuYmFrZWRMaWdodHMgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRzLmxpZ2h0czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAobC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgobC5tYXNrICYgTUFTS19BRkZFQ1RfRFlOQU1JQykgfHwgKGwubWFzayAmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSkgeyAvLyBpZiBhZmZlY3RzIGR5bmFtaWMgb3IgYmFrZWQgb2JqZWN0cyBpbiByZWFsLXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobC5tYXNrICYgTUFTS19CQUtFKSB7IC8vIGlmIGJha2VkIGludG8gbGlnaHRtYXBzXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9JTlNUQU5DRVMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIHNjZW5lLl9zdGF0cy5tZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBzY2VuZS5fc3RhdHNVcGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQnVpbGRzIGEgZnJhbWUgZ3JhcGggZm9yIHRoZSByZW5kZXJpbmcgb2YgdGhlIHdob2xlIGZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1lLWdyYXBoLmpzJykuRnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZS1ncmFwaCB0aGF0IGlzIGJ1aWx0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGxheWVyQ29tcG9zaXRpb24gLSBUaGVcbiAgICAgKiBsYXllciBjb21wb3NpdGlvbiB1c2VkIHRvIGJ1aWxkIHRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYnVpbGRGcmFtZUdyYXBoKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgZnJhbWVHcmFwaC5yZXNldCgpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlKGxheWVyQ29tcG9zaXRpb24pO1xuXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZyByZW5kZXIgcGFzc2VzXG4gICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAgICAgLy8gY29va2llc1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgY29va2llcyBmb3IgYWxsIGxvY2FsIHZpc2libGUgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLmxpZ2h0aW5nLmNvb2tpZXNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNvb2tpZXMobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyQ29va2llcyhsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCAnQ2x1c3RlcmVkQ29va2llcycpO1xuICAgICAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbG9jYWwgc2hhZG93cyAtIHRoZXNlIGFyZSBzaGFyZWQgYnkgYWxsIGNhbWVyYXMgKG5vdCBlbnRpcmVseSBjb3JyZWN0bHkpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsICdDbHVzdGVyZWRMb2NhbFNoYWRvd3MnKTtcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgc2hhZG93cyBvbmx5IHdoZW4gbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUubGlnaHRpbmcuc2hhZG93c0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3BsaXRMaWdodHMgPSBsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0cztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbC5wcmVwYXJlQ2x1c3RlcmVkUmVuZGVyUGFzcyhyZW5kZXJQYXNzLCBzcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIHNwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNsdXN0ZXJzIGFsbCB0aGUgdGltZVxuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuYWZ0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQ2x1c3RlcnMobGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBub24tY2x1c3RlcmVkIGxvY2FsIHNoYWRvd3MgLSB0aGVzZSBhcmUgc2hhcmVkIGJ5IGFsbCBjYW1lcmFzIChub3QgZW50aXJlbHkgY29ycmVjdGx5KVxuICAgICAgICAgICAgY29uc3Qgc3BsaXRMaWdodHMgPSBsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0cztcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwuYnVpbGROb25DbHVzdGVyZWRSZW5kZXJQYXNzZXMoZnJhbWVHcmFwaCwgc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdLCBzcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFpbiBwYXNzZXNcbiAgICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICBsZXQgcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICAgICAgLy8gc2tpcCBkaXNhYmxlZCBsYXllcnNcbiAgICAgICAgICAgIGlmICghcmVuZGVyQWN0aW9uLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzRGVwdGhMYXllciA9IGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgY29uc3QgaXNHcmFiUGFzcyA9IGlzRGVwdGhMYXllciAmJiAoY2FtZXJhLnJlbmRlclNjZW5lQ29sb3JNYXAgfHwgY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXApO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGdldCByZS1yZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmFcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgJiYgY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbC5idWlsZEZyYW1lR3JhcGgoZnJhbWVHcmFwaCwgcmVuZGVyQWN0aW9uLCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdGFydCBvZiBibG9jayBvZiByZW5kZXIgYWN0aW9ucyByZW5kZXJpbmcgdG8gdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKG5ld1N0YXJ0KSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzdGFydEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICByZW5kZXJUYXJnZXQgPSByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmaW5kIHRoZSBuZXh0IGVuYWJsZWQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgbGV0IG5leHRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgd2hpbGUgKHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XSAmJiAhcmVuZGVyQWN0aW9uc1tuZXh0SW5kZXhdLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgbmV4dEluZGV4Kys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluZm8gYWJvdXQgdGhlIG5leHQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgY29uc3QgbmV4dFJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyRGVwdGggPSBuZXh0UmVuZGVyQWN0aW9uID8gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RbbmV4dFJlbmRlckFjdGlvbi5sYXllckluZGV4XS5pZCA9PT0gTEFZRVJJRF9ERVBUSCA6IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaXNOZXh0TGF5ZXJHcmFiUGFzcyA9IGlzTmV4dExheWVyRGVwdGggJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKTtcblxuICAgICAgICAgICAgLy8gZW5kIG9mIHRoZSBibG9jayB1c2luZyB0aGUgc2FtZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICBpZiAoIW5leHRSZW5kZXJBY3Rpb24gfHwgbmV4dFJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQgIT09IHJlbmRlclRhcmdldCB8fFxuICAgICAgICAgICAgICAgIG5leHRSZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgfHwgaXNOZXh0TGF5ZXJHcmFiUGFzcyB8fCBpc0dyYWJQYXNzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBpLCBpc0dyYWJQYXNzKTtcblxuICAgICAgICAgICAgICAgIC8vIHBvc3Rwcm9jZXNzaW5nXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhPy5vblBvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGBQb3N0cHJvY2Vzc2ApO1xuICAgICAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1lLWdyYXBoLmpzJykuRnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlXG4gICAgICogbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBlbmRJbmRleCwgaXNHcmFiUGFzcykge1xuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgcmVuZGVyIGFjdGlvbnMgaW4gdGhlIHJhbmdlXG4gICAgICAgIGNvbnN0IHJhbmdlID0geyBzdGFydDogc3RhcnRJbmRleCwgZW5kOiBlbmRJbmRleCB9O1xuICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc1JlbmRlckFjdGlvbnMobGF5ZXJDb21wb3NpdGlvbiwgcmFuZ2UpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gbGF5ZXJDb21wb3NpdGlvbi5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgY29uc3Qgc3RhcnRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW3N0YXJ0SW5kZXhdO1xuICAgICAgICBjb25zdCBlbmRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2VuZEluZGV4XTtcbiAgICAgICAgY29uc3Qgc3RhcnRMYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3N0YXJ0UmVuZGVyQWN0aW9uLmxheWVySW5kZXhdO1xuICAgICAgICBjb25zdCBjYW1lcmEgPSBzdGFydExheWVyLmNhbWVyYXNbc3RhcnRSZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgYmVmb3JlIHJlbmRlcmluZyB3aXRoIHRoaXMgY2FtZXJhIGZvciB0aGUgZmlyc3QgdGltZVxuICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmZpcnN0Q2FtZXJhVXNlICYmIGNhbWVyYS5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MuYmVmb3JlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjYW1lcmEub25QcmVSZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBvbiB0aGUgY2FtZXJhIGNvbXBvbmVudCB3aGVuIHdlJ3JlIGRvbmUgcmVuZGVyaW5nIHdpdGggdGhpcyBjYW1lcmFcbiAgICAgICAgICAgIGlmIChlbmRSZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSAmJiBjYW1lcmEub25Qb3N0UmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5hZnRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2FtZXJhLm9uUG9zdFJlbmRlcigpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXB0aCBncmFiIHBhc3Mgb24gd2ViZ2wxIGlzIG5vcm1hbCByZW5kZXIgcGFzcyAoc2NlbmUgZ2V0cyByZS1yZW5kZXJlZClcbiAgICAgICAgY29uc3QgZ3JhYlBhc3NSZXF1aXJlZCA9IGlzR3JhYlBhc3MgJiYgU2NlbmVHcmFiLnJlcXVpcmVzUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgY2FtZXJhKTtcbiAgICAgICAgY29uc3QgaXNSZWFsUGFzcyA9ICFpc0dyYWJQYXNzIHx8IGdyYWJQYXNzUmVxdWlyZWQ7XG5cbiAgICAgICAgaWYgKGlzUmVhbFBhc3MpIHtcblxuICAgICAgICAgICAgcmVuZGVyUGFzcy5pbml0KHJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICByZW5kZXJQYXNzLmZ1bGxTaXplQ2xlYXJSZWN0ID0gY2FtZXJhLmNhbWVyYS5mdWxsU2l6ZUNsZWFyUmVjdDtcblxuICAgICAgICAgICAgaWYgKGdyYWJQYXNzUmVxdWlyZWQpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlYmdsMSBkZXB0aCByZW5kZXJpbmcgY2xlYXIgdmFsdWVzXG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckNvbG9yKHdlYmdsMURlcHRoQ2xlYXJDb2xvcik7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckRlcHRoKDEuMCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkgeyAvLyBpZiBjYW1lcmEgcmVuZGVyaW5nIGNvdmVycyB0aGUgZnVsbCB2aWV3cG9ydFxuXG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckNvbG9yKGNhbWVyYS5jYW1lcmEuY2xlYXJDb2xvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aChjYW1lcmEuY2FtZXJhLmNsZWFyRGVwdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJTdGVuY2lsKGNhbWVyYS5jYW1lcmEuY2xlYXJTdGVuY2lsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGAke2lzR3JhYlBhc3MgPyAnU2NlbmVHcmFiJyA6ICdSZW5kZXJBY3Rpb24nfSAke3N0YXJ0SW5kZXh9LSR7ZW5kSW5kZXh9IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBDYW06ICR7Y2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJy0nfWApO1xuICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZShjb21wKSB7XG5cbiAgICAgICAgdGhpcy5mcmFtZVVwZGF0ZSgpO1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyLmZyYW1lVXBkYXRlKCk7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBza3lib3gsIHNpbmNlIHRoaXMgbWlnaHQgY2hhbmdlIF9tZXNoSW5zdGFuY2VzXG4gICAgICAgIHRoaXMuc2NlbmUuX3VwZGF0ZVNreSh0aGlzLmRldmljZSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGxheWVyIGNvbXBvc2l0aW9uIGlmIHNvbWV0aGluZyBoYXMgYmVlbiBpbnZhbGlkYXRlZFxuICAgICAgICBjb25zdCB1cGRhdGVkID0gdGhpcy51cGRhdGVMYXllckNvbXBvc2l0aW9uKGNvbXAsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCk7XG4gICAgICAgIGNvbnN0IGxpZ2h0c0NoYW5nZWQgPSAodXBkYXRlZCAmIENPTVBVUERBVEVEX0xJR0hUUykgIT09IDA7XG5cbiAgICAgICAgdGhpcy51cGRhdGVMaWdodFN0YXRzKGNvbXAsIHVwZGF0ZWQpO1xuXG4gICAgICAgIC8vIFNpbmdsZSBwZXItZnJhbWUgY2FsY3VsYXRpb25zXG4gICAgICAgIHRoaXMuYmVnaW5GcmFtZShjb21wLCBsaWdodHNDaGFuZ2VkKTtcbiAgICAgICAgdGhpcy5zZXRTY2VuZUNvbnN0YW50cygpO1xuXG4gICAgICAgIC8vIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAgICAvLyBhZnRlciB0aGlzIHRoZSBzY2VuZSBjdWxsaW5nIGlzIGRvbmUgYW5kIHNjcmlwdCBjYWxsYmFja3MgY2FuIGJlIGNhbGxlZCB0byByZXBvcnQgd2hpY2ggb2JqZWN0cyBhcmUgdmlzaWJsZVxuICAgICAgICB0aGlzLmN1bGxDb21wb3NpdGlvbihjb21wKTtcblxuICAgICAgICAvLyBHUFUgdXBkYXRlIGZvciBhbGwgdmlzaWJsZSBvYmplY3RzXG4gICAgICAgIHRoaXMuZ3B1VXBkYXRlKGNvbXAuX21lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIHJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyhyZW5kZXJBY3Rpb24sIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tyZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyAmJiBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZyk7XG5cbiAgICAgICAgLy8gdHJpZ2dlciBwb3N0cHJvY2Vzc2luZyBmb3IgY2FtZXJhXG4gICAgICAgIGNhbWVyYS5vblBvc3Rwcm9jZXNzaW5nKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBhc3MgcmVwcmVzZW50aW5nIHRoZSBsYXllciBjb21wb3NpdGlvbidzIHJlbmRlciBhY3Rpb25zIGluIHRoZSBzcGVjaWZpZWQgcmFuZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gcmVuZGVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyhjb21wLCByYW5nZSkge1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gcmFuZ2Uuc3RhcnQ7IGkgPD0gcmFuZ2UuZW5kOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbnNbaV0sIGkgPT09IHJhbmdlLnN0YXJ0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vcmVuZGVyLWFjdGlvbi5qcycpLlJlbmRlckFjdGlvbn0gcmVuZGVyQWN0aW9uIC0gVGhlIHJlbmRlclxuICAgICAqIGFjdGlvbi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZpcnN0UmVuZGVyQWN0aW9uIC0gVHJ1ZSBpZiB0aGlzIGlzIHRoZSBmaXJzdCByZW5kZXIgYWN0aW9uIGluIHRoZSByZW5kZXIgcGFzcy5cbiAgICAgKi9cbiAgICByZW5kZXJSZW5kZXJBY3Rpb24oY29tcCwgcmVuZGVyQWN0aW9uLCBmaXJzdFJlbmRlckFjdGlvbikge1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICAvLyBsYXllclxuICAgICAgICBjb25zdCBsYXllckluZGV4ID0gcmVuZGVyQWN0aW9uLmxheWVySW5kZXg7XG4gICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbbGF5ZXJJbmRleF07XG5cbiAgICAgICAgY29uc3QgY2FtZXJhUGFzcyA9IHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleDtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICBpZiAoIXJlbmRlckFjdGlvbi5pc0xheWVyRW5hYmxlZChjb21wKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuZGV2aWNlLCBjYW1lcmEgPyBjYW1lcmEuZW50aXR5Lm5hbWUgOiAnbm9uYW1lJyk7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgbGF5ZXIubmFtZSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBkcmF3VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBDYWxsIHByZXJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUHJlUmVuZGVyT3BhcXVlKSB7XG4gICAgICAgICAgICBsYXllci5vblByZVJlbmRlck9wYXF1ZShjYW1lcmFQYXNzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblByZVJlbmRlclRyYW5zcGFyZW50KGNhbWVyYVBhc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbGVkIGZvciB0aGUgZmlyc3Qgc3VibGF5ZXIgYW5kIGZvciBldmVyeSBjYW1lcmFcbiAgICAgICAgaWYgKCEobGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgJiAoMSA8PCBjYW1lcmFQYXNzKSkpIHtcbiAgICAgICAgICAgIGlmIChsYXllci5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIGxheWVyLm9uUHJlUmVuZGVyKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgfD0gMSA8PCBjYW1lcmFQYXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbWVyYSkge1xuXG4gICAgICAgICAgICB0aGlzLnNldHVwVmlld3BvcnQoY2FtZXJhLmNhbWVyYSwgcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgbm90IGEgZmlyc3QgcmVuZGVyIGFjdGlvbiB0byB0aGUgcmVuZGVyIHRhcmdldCwgb3IgaWYgdGhlIHJlbmRlciB0YXJnZXQgd2FzIG5vdFxuICAgICAgICAgICAgLy8gZnVsbHkgY2xlYXJlZCBvbiBwYXNzIHN0YXJ0LCB3ZSBuZWVkIHRvIGV4ZWN1dGUgY2xlYXJzIGhlcmVcbiAgICAgICAgICAgIGlmICghZmlyc3RSZW5kZXJBY3Rpb24gfHwgIWNhbWVyYS5jYW1lcmEuZnVsbFNpemVDbGVhclJlY3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyKGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5jbGVhckNvbG9yLCByZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCwgcmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGNvbnN0IHNvcnRUaW1lID0gbm93KCk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgbGF5ZXIuX3NvcnRWaXNpYmxlKHRyYW5zcGFyZW50LCBjYW1lcmEuY2FtZXJhLm5vZGUsIGNhbWVyYVBhc3MpO1xuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLl9zb3J0VGltZSArPSBub3coKSAtIHNvcnRUaW1lO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGNvbnN0IG9iamVjdHMgPSBsYXllci5pbnN0YW5jZXM7XG4gICAgICAgICAgICBjb25zdCB2aXNpYmxlID0gdHJhbnNwYXJlbnQgPyBvYmplY3RzLnZpc2libGVUcmFuc3BhcmVudFtjYW1lcmFQYXNzXSA6IG9iamVjdHMudmlzaWJsZU9wYXF1ZVtjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgLy8gYWRkIGRlYnVnIG1lc2ggaW5zdGFuY2VzIHRvIHZpc2libGUgbGlzdFxuICAgICAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUub25QcmVSZW5kZXJMYXllcihsYXllciwgdmlzaWJsZSwgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgICAgICAvLyB1cGxvYWQgY2x1c3RlcmVkIGxpZ2h0cyB1bmlmb3Jtc1xuICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycykge1xuICAgICAgICAgICAgICAgIHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzLmFjdGl2YXRlKHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuXG4gICAgICAgICAgICAgICAgLy8gZGVidWcgcmVuZGVyaW5nIG9mIGNsdXN0ZXJzXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCAmJiB0aGlzLnNjZW5lLmxpZ2h0aW5nLmRlYnVnTGF5ZXIgPT09IGxheWVyLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgV29ybGRDbHVzdGVyc0RlYnVnLnJlbmRlcihyZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycywgdGhpcy5zY2VuZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTZXQgdGhlIG5vdCB2ZXJ5IGNsZXZlciBnbG9iYWwgdmFyaWFibGUgd2hpY2ggaXMgb25seSB1c2VmdWwgd2hlbiB0aGVyZSdzIGp1c3Qgb25lIGNhbWVyYVxuICAgICAgICAgICAgdGhpcy5zY2VuZS5fYWN0aXZlQ2FtZXJhID0gY2FtZXJhLmNhbWVyYTtcblxuICAgICAgICAgICAgY29uc3Qgdmlld0NvdW50ID0gdGhpcy5zZXRDYW1lcmFVbmlmb3JtcyhjYW1lcmEuY2FtZXJhLCByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMocmVuZGVyQWN0aW9uLnZpZXdCaW5kR3JvdXBzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIHZpZXdDb3VudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVuYWJsZSBmbGlwIGZhY2VzIGlmIGVpdGhlciB0aGUgY2FtZXJhIGhhcyBfZmxpcEZhY2VzIGVuYWJsZWQgb3IgdGhlIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIC8vIGhhcyBmbGlwWSBlbmFibGVkXG4gICAgICAgICAgICBjb25zdCBmbGlwRmFjZXMgPSAhIShjYW1lcmEuY2FtZXJhLl9mbGlwRmFjZXMgXiByZW5kZXJBY3Rpb24/LnJlbmRlclRhcmdldD8uZmxpcFkpO1xuXG4gICAgICAgICAgICAvLyBzaGFkZXIgcGFzcyAtIHVzZSBzZXR0aW5nIGZyb20gY2FtZXJhIGlmIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIHVzZSBsYXllciBzZXR0aW5nXG4gICAgICAgICAgICBjb25zdCBzaGFkZXJQYXNzID0gY2FtZXJhLmNhbWVyYS5zaGFkZXJQYXNzSW5mbz8uaW5kZXggPz8gbGF5ZXIuc2hhZGVyUGFzcztcblxuICAgICAgICAgICAgY29uc3QgZHJhd3MgPSB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJGb3J3YXJkKGNhbWVyYS5jYW1lcmEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLl9zcGxpdExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJQYXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLmN1bGxpbmdNYXNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uRHJhd0NhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzKTtcbiAgICAgICAgICAgIGxheWVyLl9mb3J3YXJkRHJhd0NhbGxzICs9IHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgLSBkcmF3cztcblxuICAgICAgICAgICAgLy8gUmV2ZXJ0IHRlbXAgZnJhbWUgc3R1ZmZcbiAgICAgICAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIG5vdCBiZSBoZXJlLCBhcyBlYWNoIHJlbmRlcmluZyAvIGNsZWFyaW5nIHNob3VsZCBleHBsaWNpdGx5IHNldCB1cCB3aGF0XG4gICAgICAgICAgICAvLyBpdCByZXF1aXJlcyAodGhlIHByb3BlcnRpZXMgYXJlIHBhcnQgb2YgcmVuZGVyIHBpcGVsaW5lIG9uIFdlYkdQVSBhbnl3YXlzKVxuICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsU3RhdGUobnVsbCwgbnVsbCk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0QWxwaGFUb0NvdmVyYWdlKGZhbHNlKTsgLy8gZG9uJ3QgbGVhayBhMmMgc3RhdGVcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbCBsYXllcidzIHBvc3RyZW5kZXIgY2FsbGJhY2sgaWYgdGhlcmUncyBvbmVcbiAgICAgICAgaWYgKCF0cmFuc3BhcmVudCAmJiBsYXllci5vblBvc3RSZW5kZXJPcGFxdWUpIHtcbiAgICAgICAgICAgIGxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZShjYW1lcmFQYXNzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0cmFuc3BhcmVudCAmJiBsYXllci5vblBvc3RSZW5kZXJUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQoY2FtZXJhUGFzcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxheWVyLm9uUG9zdFJlbmRlciAmJiAhKGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyAmICgxIDw8IGNhbWVyYVBhc3MpKSkge1xuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyICY9IH4odHJhbnNwYXJlbnQgPyAyIDogMSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyB8PSAxIDw8IGNhbWVyYVBhc3M7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyID0gbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyTWF4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBsYXllci5fcmVuZGVyVGltZSArPSBub3coKSAtIGRyYXdUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG59XG5cbmV4cG9ydCB7IEZvcndhcmRSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbIndlYmdsMURlcHRoQ2xlYXJDb2xvciIsIkNvbG9yIiwiX2RyYXdDYWxsTGlzdCIsImRyYXdDYWxscyIsImlzTmV3TWF0ZXJpYWwiLCJsaWdodE1hc2tDaGFuZ2VkIiwiY2xlYXIiLCJsZW5ndGgiLCJGb3J3YXJkUmVuZGVyZXIiLCJSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZXZpY2UiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9tYXRlcmlhbFN3aXRjaGVzIiwiX2RlcHRoTWFwVGltZSIsIl9mb3J3YXJkVGltZSIsIl9zb3J0VGltZSIsInNjb3BlIiwiZm9nQ29sb3JJZCIsInJlc29sdmUiLCJmb2dTdGFydElkIiwiZm9nRW5kSWQiLCJmb2dEZW5zaXR5SWQiLCJhbWJpZW50SWQiLCJza3lib3hJbnRlbnNpdHlJZCIsImN1YmVNYXBSb3RhdGlvbk1hdHJpeElkIiwibGlnaHRDb2xvcklkIiwibGlnaHREaXIiLCJsaWdodERpcklkIiwibGlnaHRTaGFkb3dNYXBJZCIsImxpZ2h0U2hhZG93TWF0cml4SWQiLCJsaWdodFNoYWRvd1BhcmFtc0lkIiwibGlnaHRTaGFkb3dJbnRlbnNpdHkiLCJsaWdodFJhZGl1c0lkIiwibGlnaHRQb3MiLCJsaWdodFBvc0lkIiwibGlnaHRXaWR0aCIsImxpZ2h0V2lkdGhJZCIsImxpZ2h0SGVpZ2h0IiwibGlnaHRIZWlnaHRJZCIsImxpZ2h0SW5BbmdsZUlkIiwibGlnaHRPdXRBbmdsZUlkIiwibGlnaHRDb29raWVJZCIsImxpZ2h0Q29va2llSW50SWQiLCJsaWdodENvb2tpZU1hdHJpeElkIiwibGlnaHRDb29raWVPZmZzZXRJZCIsInNoYWRvd01hdHJpeFBhbGV0dGVJZCIsInNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZCIsInNoYWRvd0Nhc2NhZGVDb3VudElkIiwic2NyZWVuU2l6ZUlkIiwiX3NjcmVlblNpemUiLCJGbG9hdDMyQXJyYXkiLCJmb2dDb2xvciIsImFtYmllbnRDb2xvciIsImRlc3Ryb3kiLCJkaXNwYXRjaEdsb2JhbExpZ2h0cyIsInNjZW5lIiwiYW1iaWVudExpZ2h0IiwiciIsImciLCJiIiwiZ2FtbWFDb3JyZWN0aW9uIiwiaSIsIk1hdGgiLCJwb3ciLCJwaHlzaWNhbFVuaXRzIiwiYW1iaWVudEx1bWluYW5jZSIsInNldFZhbHVlIiwic2t5Ym94THVtaW5hbmNlIiwic2t5Ym94SW50ZW5zaXR5IiwiX3NreWJveFJvdGF0aW9uTWF0MyIsImRhdGEiLCJfcmVzb2x2ZUxpZ2h0IiwibGlnaHQiLCJzZXRMVENEaXJlY3Rpb25hbExpZ2h0Iiwid3RtIiwiY250IiwiZGlyIiwiY2FtcG9zIiwiZmFyIiwieCIsInkiLCJ6IiwiaFdpZHRoIiwidHJhbnNmb3JtVmVjdG9yIiwiVmVjMyIsImhIZWlnaHQiLCJkaXNwYXRjaERpcmVjdExpZ2h0cyIsImRpcnMiLCJtYXNrIiwiY2FtZXJhIiwiZGlyZWN0aW9uYWwiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsImdldFkiLCJfZGlyZWN0aW9uIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiZ2V0UG9zaXRpb24iLCJmYXJDbGlwIiwiY2FzdFNoYWRvd3MiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwic2hhZG93QnVmZmVyIiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsIm51bUNhc2NhZGVzIiwic2hhZG93SW50ZW5zaXR5IiwicGFyYW1zIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwibm9ybWFsQmlhcyIsImJpYXMiLCJzZXRMVENQb3NpdGlvbmFsTGlnaHQiLCJkaXNwYXRjaE9tbmlMaWdodCIsIm9tbmkiLCJhdHRlbnVhdGlvbkVuZCIsImdldFRyYW5zbGF0aW9uIiwiX3Bvc2l0aW9uIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsImRpc3BhdGNoU3BvdExpZ2h0Iiwic3BvdCIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImNvb2tpZU1hdHJpeCIsIkxpZ2h0Q2FtZXJhIiwiZXZhbFNwb3RDb29raWVNYXRyaXgiLCJfY29va2llVHJhbnNmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0iLCJ3IiwiX2Nvb2tpZU9mZnNldFVuaWZvcm0iLCJfY29va2llT2Zmc2V0IiwiZGlzcGF0Y2hMb2NhbExpZ2h0cyIsInNvcnRlZExpZ2h0cyIsInVzZWREaXJMaWdodHMiLCJzdGF0aWNMaWdodExpc3QiLCJvbW5pcyIsIkxJR0hUVFlQRV9PTU5JIiwibnVtT21uaXMiLCJpc1N0YXRpYyIsInN0YXRpY0lkIiwiX3R5cGUiLCJzcHRzIiwiTElHSFRUWVBFX1NQT1QiLCJudW1TcHRzIiwicmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMiLCJkcmF3Q2FsbHNDb3VudCIsImN1bGxpbmdNYXNrIiwibGF5ZXIiLCJwYXNzIiwiYWRkQ2FsbCIsImRyYXdDYWxsIiwicHVzaCIsImxpZ2h0SGFzaCIsIl9saWdodEhhc2giLCJwcmV2TWF0ZXJpYWwiLCJwcmV2T2JqRGVmcyIsInByZXZTdGF0aWMiLCJwcmV2TGlnaHRNYXNrIiwiY29tbWFuZCIsInNraXBSZW5kZXJDYW1lcmEiLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJza2lwUmVuZGVyQWZ0ZXIiLCJlbnN1cmVNYXRlcmlhbCIsIm1hdGVyaWFsIiwib2JqRGVmcyIsIl9zaGFkZXJEZWZzIiwibGlnaHRNYXNrIiwiX3NjZW5lIiwiZGlydHkiLCJ1cGRhdGVVbmlmb3JtcyIsIl9kaXJ0eUJsZW5kIiwibGF5ZXJzIiwiX3NoYWRlciIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwibm9kZSIsIm5hbWUiLCJ2YXJpYW50S2V5IiwidmFyaWFudHMiLCJ1cGRhdGVQYXNzU2hhZGVyIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiX3N0YXRpY0xpZ2h0TGlzdCIsInBvcEdwdU1hcmtlciIsIkRlYnVnIiwiYXNzZXJ0IiwiZW5kU2hhZGVyQmF0Y2giLCJyZW5kZXJGb3J3YXJkSW50ZXJuYWwiLCJwcmVwYXJlZENhbGxzIiwiZHJhd0NhbGxiYWNrIiwiZmxpcEZhY2VzIiwicGFzc0ZsYWciLCJmbGlwRmFjdG9yIiwic2tpcE1hdGVyaWFsIiwicHJlcGFyZWRDYWxsc0NvdW50IiwiX2RyYXdDYWxsJHN0ZW5jaWxGcm9uIiwiX2RyYXdDYWxsJHN0ZW5jaWxCYWNrIiwibmV3TWF0ZXJpYWwiLCJzaGFkZXIiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJlcnJvciIsImxhYmVsIiwic2V0UGFyYW1ldGVycyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImFscGhhVGVzdElkIiwiYWxwaGFUZXN0Iiwic2V0QmxlbmRTdGF0ZSIsImJsZW5kU3RhdGUiLCJzZXREZXB0aFN0YXRlIiwiZGVwdGhTdGF0ZSIsInNldEFscGhhVG9Db3ZlcmFnZSIsImFscGhhVG9Db3ZlcmFnZSIsImRlcHRoQmlhcyIsInNsb3BlRGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwic2V0dXBDdWxsTW9kZSIsIl9jdWxsRmFjZXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInNldFN0ZW5jaWxTdGF0ZSIsIm1lc2giLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0TW9ycGhpbmciLCJtb3JwaEluc3RhbmNlIiwic2V0U2tpbm5pbmciLCJzZXR1cE1lc2hVbmlmb3JtQnVmZmVycyIsInN0eWxlIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwieHIiLCJzZXNzaW9uIiwidmlld3MiLCJ2IiwidmlldyIsInNldFZpZXdwb3J0Iiwidmlld3BvcnQiLCJwcm9qSWQiLCJwcm9qTWF0IiwicHJvalNreWJveElkIiwidmlld0lkIiwidmlld09mZk1hdCIsInZpZXdJbnZJZCIsInZpZXdJbnZPZmZNYXQiLCJ2aWV3SWQzIiwidmlld01hdDMiLCJ2aWV3UHJvaklkIiwicHJvalZpZXdPZmZNYXQiLCJ2aWV3UG9zSWQiLCJwb3NpdGlvbiIsImRyYXdJbnN0YW5jZSIsImRyYXdJbnN0YW5jZTIiLCJwYXJhbWV0ZXJzIiwicmVuZGVyRm9yd2FyZCIsImFsbERyYXdDYWxscyIsImFsbERyYXdDYWxsc0NvdW50IiwiZm9yd2FyZFN0YXJ0VGltZSIsIm5vdyIsInNldFNjZW5lQ29uc3RhbnRzIiwiZm9nIiwiRk9HX05PTkUiLCJGT0dfTElORUFSIiwiZm9nU3RhcnQiLCJmb2dFbmQiLCJmb2dEZW5zaXR5Iiwid2lkdGgiLCJoZWlnaHQiLCJ1cGRhdGVMaWdodFN0YXRzIiwiY29tcCIsImNvbXBVcGRhdGVkRmxhZ3MiLCJDT01QVVBEQVRFRF9MSUdIVFMiLCJfc3RhdHNVcGRhdGVkIiwic3RhdHMiLCJfc3RhdHMiLCJsaWdodHMiLCJfbGlnaHRzIiwiZHluYW1pY0xpZ2h0cyIsImJha2VkTGlnaHRzIiwibCIsImVuYWJsZWQiLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJNQVNLX0JBS0UiLCJDT01QVVBEQVRFRF9JTlNUQU5DRVMiLCJtZXNoSW5zdGFuY2VzIiwiX21lc2hJbnN0YW5jZXMiLCJidWlsZEZyYW1lR3JhcGgiLCJmcmFtZUdyYXBoIiwibGF5ZXJDb21wb3NpdGlvbiIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsInJlc2V0IiwidXBkYXRlIiwicmVuZGVyUGFzcyIsIlJlbmRlclBhc3MiLCJsaWdodGluZyIsImNvb2tpZXNFbmFibGVkIiwicmVuZGVyQ29va2llcyIsIl9zcGxpdExpZ2h0cyIsInJlcXVpcmVzQ3ViZW1hcHMiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJhZGRSZW5kZXJQYXNzIiwic2hhZG93c0VuYWJsZWQiLCJzcGxpdExpZ2h0cyIsIl9zaGFkb3dSZW5kZXJlckxvY2FsIiwicHJlcGFyZUNsdXN0ZXJlZFJlbmRlclBhc3MiLCJhZnRlciIsInVwZGF0ZUNsdXN0ZXJzIiwiYnVpbGROb25DbHVzdGVyZWRSZW5kZXJQYXNzZXMiLCJzdGFydEluZGV4IiwibmV3U3RhcnQiLCJyZW5kZXJUYXJnZXQiLCJyZW5kZXJBY3Rpb25zIiwiX3JlbmRlckFjdGlvbnMiLCJyZW5kZXJBY3Rpb24iLCJsYXllckxpc3QiLCJsYXllckluZGV4IiwiY2FtZXJhcyIsImNhbWVyYUluZGV4IiwiaXNMYXllckVuYWJsZWQiLCJpc0RlcHRoTGF5ZXIiLCJpZCIsIkxBWUVSSURfREVQVEgiLCJpc0dyYWJQYXNzIiwicmVuZGVyU2NlbmVDb2xvck1hcCIsInJlbmRlclNjZW5lRGVwdGhNYXAiLCJoYXNEaXJlY3Rpb25hbFNoYWRvd0xpZ2h0cyIsIl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIiwibmV4dEluZGV4IiwibmV4dFJlbmRlckFjdGlvbiIsImlzTmV4dExheWVyRGVwdGgiLCJpc05leHRMYXllckdyYWJQYXNzIiwiYWRkTWFpblJlbmRlclBhc3MiLCJ0cmlnZ2VyUG9zdHByb2Nlc3MiLCJvblBvc3Rwcm9jZXNzaW5nIiwicmVuZGVyUGFzc1Bvc3Rwcm9jZXNzaW5nIiwiZW5kSW5kZXgiLCJyYW5nZSIsInN0YXJ0IiwiZW5kIiwicmVuZGVyUGFzc1JlbmRlckFjdGlvbnMiLCJzdGFydFJlbmRlckFjdGlvbiIsImVuZFJlbmRlckFjdGlvbiIsInN0YXJ0TGF5ZXIiLCJmaXJzdENhbWVyYVVzZSIsIm9uUHJlUmVuZGVyIiwiYmVmb3JlIiwibGFzdENhbWVyYVVzZSIsIm9uUG9zdFJlbmRlciIsImdyYWJQYXNzUmVxdWlyZWQiLCJTY2VuZUdyYWIiLCJyZXF1aXJlc1JlbmRlclBhc3MiLCJpc1JlYWxQYXNzIiwiaW5pdCIsImZ1bGxTaXplQ2xlYXJSZWN0Iiwic2V0Q2xlYXJDb2xvciIsInNldENsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInNldENsZWFyU3RlbmNpbCIsImVudGl0eSIsImZyYW1lVXBkYXRlIiwic2hhZG93UmVuZGVyZXIiLCJfdXBkYXRlU2t5IiwidXBkYXRlZCIsInVwZGF0ZUxheWVyQ29tcG9zaXRpb24iLCJsaWdodHNDaGFuZ2VkIiwiYmVnaW5GcmFtZSIsImN1bGxDb21wb3NpdGlvbiIsImdwdVVwZGF0ZSIsInJlbmRlclJlbmRlckFjdGlvbiIsImZpcnN0UmVuZGVyQWN0aW9uIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckxpc3QiLCJjYW1lcmFQYXNzIiwiZHJhd1RpbWUiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQiLCJfcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsIl9yZW5kZXJBY3Rpb24kcmVuZGVyVCIsIl9jYW1lcmEkY2FtZXJhJHNoYWRlciIsIl9jYW1lcmEkY2FtZXJhJHNoYWRlcjIiLCJzZXR1cFZpZXdwb3J0Iiwic29ydFRpbWUiLCJfc29ydFZpc2libGUiLCJvYmplY3RzIiwiaW5zdGFuY2VzIiwidmlzaWJsZSIsInZpc2libGVUcmFuc3BhcmVudCIsInZpc2libGVPcGFxdWUiLCJpbW1lZGlhdGUiLCJvblByZVJlbmRlckxheWVyIiwibGlnaHRDbHVzdGVycyIsImFjdGl2YXRlIiwibGlnaHRUZXh0dXJlQXRsYXMiLCJjbHVzdGVyc0RlYnVnUmVuZGVyZWQiLCJkZWJ1Z0xheWVyIiwiV29ybGRDbHVzdGVyc0RlYnVnIiwicmVuZGVyIiwiX2FjdGl2ZUNhbWVyYSIsInZpZXdDb3VudCIsInNldENhbWVyYVVuaWZvcm1zIiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsInNldHVwVmlld1VuaWZvcm1CdWZmZXJzIiwidmlld0JpbmRHcm91cHMiLCJfZmxpcEZhY2VzIiwiZmxpcFkiLCJzaGFkZXJQYXNzIiwic2hhZGVyUGFzc0luZm8iLCJpbmRleCIsImRyYXdzIiwibGlzdCIsIm9uRHJhd0NhbGwiLCJCbGVuZFN0YXRlIiwiREVGQVVMVCIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlclRyYW5zcGFyZW50IiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwiX3Bvc3RSZW5kZXJDb3VudGVyTWF4IiwiX3JlbmRlclRpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUF3QkEsTUFBTUEscUJBQXFCLEdBQUcsSUFBSUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLEVBQUUsS0FBSyxHQUFHLEdBQUcsRUFBRSxLQUFLLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUUzRixNQUFNQyxhQUFhLEdBQUc7QUFDbEJDLEVBQUFBLFNBQVMsRUFBRSxFQUFFO0FBQ2JDLEVBQUFBLGFBQWEsRUFBRSxFQUFFO0FBQ2pCQyxFQUFBQSxnQkFBZ0IsRUFBRSxFQUFFO0VBRXBCQyxLQUFLLEVBQUUsWUFBWTtBQUNmLElBQUEsSUFBSSxDQUFDSCxTQUFTLENBQUNJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNILGFBQWEsQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUM3QixJQUFBLElBQUksQ0FBQ0YsZ0JBQWdCLENBQUNFLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDcEMsR0FBQTtBQUNKLENBQUMsQ0FBQTs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtB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
