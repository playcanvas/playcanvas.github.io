/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { FUNC_ALWAYS, STENCILOP_KEEP, BINDGROUP_MESH } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, FOG_NONE, FOG_LINEAR, COMPUPDATED_LIGHTS, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, COMPUPDATED_INSTANCES, LAYERID_DEPTH } from '../constants.js';
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

class ForwardRenderer extends Renderer {
  constructor(graphicsDevice) {
    super(graphicsDevice);
    const device = this.device;
    this._forwardDrawCalls = 0;
    this._materialSwitches = 0;
    this._depthMapTime = 0;
    this._forwardTime = 0;
    this._sortTime = 0;

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

      wtm.getY(directional._direction).mulScalar(-1);
      directional._direction.normalize();
      this.lightDir[cnt][0] = directional._direction.x;
      this.lightDir[cnt][1] = directional._direction.y;
      this.lightDir[cnt][2] = directional._direction.z;
      this.lightDirId[cnt].setValue(this.lightDir[cnt]);
      if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
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
        params[0] = directional._shadowResolution;
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
      this.setLTCPositionalLight(wtm, cnt);
    }
    if (omni.castShadows) {
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
      this.setLTCPositionalLight(wtm, cnt);
    }

    wtm.getY(spot._direction).mulScalar(-1);
    spot._direction.normalize();
    this.lightDir[cnt][0] = spot._direction.x;
    this.lightDir[cnt][1] = spot._direction.y;
    this.lightDir[cnt][2] = spot._direction.z;
    this.lightDirId[cnt].setValue(this.lightDir[cnt]);
    if (spot.castShadows) {
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
      if (isClustered) {
        if (!light.atlasViewportAllocated) {
          continue;
        }

        if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
          light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }
      }
      this._shadowRendererLocal.render(light, camera);
    }
  }

  renderForwardPrepareMaterials(camera, drawCalls, drawCallsCount, sortedLights, cullingMask, layer, pass) {
    const addCall = (drawCall, isNewMaterial, lightMaskChanged) => {
      _drawCallList.drawCalls.push(drawCall);
      _drawCallList.isNewMaterial.push(isNewMaterial);
      _drawCallList.lightMaskChanged.push(lightMaskChanged);
    };

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
      const drawCall = drawCalls[i];

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
          prevMaterial = null;
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

          if (material._dirtyBlend) {
            scene.layers._dirtyBlend = true;
          }
        }
        if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs || drawCall._lightHash !== lightHash) {
          if (!drawCall.isStatic) {
            const variantKey = pass + '_' + objDefs + '_' + lightHash;
            drawCall._shader[pass] = material.variants[variantKey];
            if (!drawCall._shader[pass]) {
              drawCall.updatePassShader(scene, pass, null, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
              material.variants[variantKey] = drawCall._shader[pass];
            }
          } else {
            drawCall.updatePassShader(scene, pass, drawCall._staticLightList, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
          }
          drawCall._lightHash = lightHash;
        }
        Debug.assert(drawCall._shader[pass], "no shader for pass", material);
        addCall(drawCall, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);
        prevMaterial = material;
        prevObjDefs = objDefs;
        prevLightMask = lightMask;
        prevStatic = drawCall.isStatic;
      }
    }
    return _drawCallList;
  }
  renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
    const device = this.device;
    const supportsUniformBuffers = device.supportsUniformBuffers;
    const scene = this.scene;
    const passFlag = 1 << pass;

    const preparedCallsCount = preparedCalls.drawCalls.length;
    for (let i = 0; i < preparedCallsCount; i++) {
      const drawCall = preparedCalls.drawCalls[i];
      if (drawCall.command) {
        drawCall.command();
      } else {
        const newMaterial = preparedCalls.isNewMaterial[i];
        const lightMaskChanged = preparedCalls.lightMaskChanged[i];
        const material = drawCall.material;
        const objDefs = drawCall._shaderDefs;
        const lightMask = drawCall.mask;
        if (newMaterial) {
          const shader = drawCall._shader[pass];
          if (!shader.failed && !device.setShader(shader)) {
            Debug.error(`Error compiling shader for material=${material.name} pass=${pass} objDefs=${objDefs}`, material);
          }

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
            device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
            device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
          } else {
            if (stencilFront) {
              device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
              device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
            } else {
              device.setStencilFuncFront(FUNC_ALWAYS, 0, 0xFF);
              device.setStencilOperationFront(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
            }
            if (stencilBack) {
              device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
              device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
            } else {
              device.setStencilFuncBack(FUNC_ALWAYS, 0, 0xFF);
              device.setStencilOperationBack(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
            }
          }
        } else {
          device.setStencilTest(false);
        }
        const mesh = drawCall.mesh;

        drawCall.setParameters(device, passFlag);
        this.setVertexBuffers(device, mesh);
        this.setMorphing(device, drawCall.morphInstance);
        this.setSkinning(device, drawCall);
        if (supportsUniformBuffers) {
          this.modelMatrixId.setValue(drawCall.node.worldTransform.data);
          this.normalMatrixId.setValue(drawCall.node.normalMatrix.data);

          const meshBindGroup = drawCall.getBindGroup(device, pass);
          meshBindGroup.defaultUniformBuffer.update();
          meshBindGroup.update();
          device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
        }
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

        if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
          material.setParameters(device, drawCall.parameters);
        }
      }
    }
  }
  renderForward(camera, allDrawCalls, allDrawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer, flipFaces) {
    const forwardStartTime = now();

    const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, allDrawCallsCount, sortedLights, cullingMask, layer, pass);

    this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
    _drawCallList.length = 0;
    this._forwardTime += now() - forwardStartTime;
  }
  setSceneConstants() {
    const scene = this.scene;

    this.dispatchGlobalLights(scene);

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

    const device = this.device;
    this._screenSize[0] = device.width;
    this._screenSize[1] = device.height;
    this._screenSize[2] = 1 / device.width;
    this._screenSize[3] = 1 / device.height;
    this.screenSizeId.setValue(this._screenSize);
  }

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
            stats.dynamicLights++;
          }
          if (l.mask & MASK_BAKE) {
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

  buildFrameGraph(frameGraph, layerComposition) {
    frameGraph.reset();
    this.update(layerComposition);
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    if (clusteredLightingEnabled) {
      this.updateLightTextureAtlas(layerComposition);
      const _renderPass = new RenderPass(this.device, () => {
        if (this.scene.lighting.cookiesEnabled) {
          this.renderCookies(layerComposition._splitLights[LIGHTTYPE_SPOT]);
          this.renderCookies(layerComposition._splitLights[LIGHTTYPE_OMNI]);
        }
      });
      _renderPass.requiresCubemaps = false;
      DebugHelper.setName(_renderPass, 'ClusteredCookies');
      frameGraph.addRenderPass(_renderPass);
    }

    const renderPass = new RenderPass(this.device, () => {
      if (!clusteredLightingEnabled || clusteredLightingEnabled && this.scene.lighting.shadowsEnabled) {
        this.renderShadowsLocal(layerComposition._splitLights[LIGHTTYPE_SPOT]);
        this.renderShadowsLocal(layerComposition._splitLights[LIGHTTYPE_OMNI]);
      }

      if (clusteredLightingEnabled) {
        this.updateClusters(layerComposition);
      }
    });
    renderPass.requiresCubemaps = false;
    DebugHelper.setName(renderPass, 'LocalShadowMaps');
    frameGraph.addRenderPass(renderPass);

    let startIndex = 0;
    let newStart = true;
    let renderTarget = null;
    const renderActions = layerComposition._renderActions;
    for (let i = startIndex; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const layer = layerComposition.layerList[renderAction.layerIndex];
      const camera = layer.cameras[renderAction.cameraIndex];

      if (!renderAction.isLayerEnabled(layerComposition)) {
        continue;
      }
      const isDepthLayer = layer.id === LAYERID_DEPTH;
      const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

      if (renderAction.hasDirectionalShadowLights && camera) {
        this._shadowRendererDirectional.buildFrameGraph(frameGraph, renderAction, camera);
      }

      if (newStart) {
        newStart = false;
        startIndex = i;
        renderTarget = renderAction.renderTarget;
      }

      let nextIndex = i + 1;
      while (renderActions[nextIndex] && !renderActions[nextIndex].isLayerEnabled(layerComposition)) {
        nextIndex++;
      }

      const nextRenderAction = renderActions[nextIndex];
      const isNextLayerDepth = nextRenderAction ? layerComposition.layerList[nextRenderAction.layerIndex].id === LAYERID_DEPTH : false;
      const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

      if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget || nextRenderAction.hasDirectionalShadowLights || isNextLayerGrabPass || isGrabPass) {
        this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i, isGrabPass);

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

  addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex, isGrabPass) {
    const range = {
      start: startIndex,
      end: endIndex
    };
    const renderPass = new RenderPass(this.device, () => {
      this.renderPassRenderActions(layerComposition, range);
    });
    const renderActions = layerComposition._renderActions;
    const startRenderAction = renderActions[startIndex];
    const startLayer = layerComposition.layerList[startRenderAction.layerIndex];
    const camera = startLayer.cameras[startRenderAction.cameraIndex];

    const grabPassRequired = isGrabPass && SceneGrab.requiresRenderPass(this.device, camera);
    const isRealPass = !isGrabPass || grabPassRequired;
    if (isRealPass) {
      renderPass.init(renderTarget);
      renderPass.fullSizeClearRect = camera.camera.fullSizeClearRect;
      if (grabPassRequired) {
        renderPass.setClearColor(webgl1DepthClearColor);
        renderPass.setClearDepth(1.0);
      } else if (renderPass.fullSizeClearRect) {

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

  update(comp) {
    this.baseUpdate();
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;

    this.scene._updateSky(this.device);

    const updated = this.updateLayerComposition(comp, clusteredLightingEnabled);
    const lightsChanged = (updated & COMPUPDATED_LIGHTS) !== 0;
    this.updateLightStats(comp, updated);

    this.beginFrame(comp, lightsChanged);
    this.setSceneConstants();

    this.cullComposition(comp);

    this.gpuUpdate(comp._meshInstances);
  }
  renderPassPostprocessing(renderAction, layerComposition) {
    const layer = layerComposition.layerList[renderAction.layerIndex];
    const camera = layer.cameras[renderAction.cameraIndex];
    Debug.assert(renderAction.triggerPostprocess && camera.onPostprocessing);

    camera.onPostprocessing();
  }

  renderPassRenderActions(comp, range) {
    const renderActions = comp._renderActions;
    for (let i = range.start; i <= range.end; i++) {
      this.renderRenderAction(comp, renderActions[i], i === range.start);
    }
  }

  renderRenderAction(comp, renderAction, firstRenderAction) {
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    const device = this.device;

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
    if (camera) {
      if (renderAction.firstCameraUse && camera.onPreRender) {
        camera.onPreRender();
      }
    }

    if (!transparent && layer.onPreRenderOpaque) {
      layer.onPreRenderOpaque(cameraPass);
    } else if (transparent && layer.onPreRenderTransparent) {
      layer.onPreRenderTransparent(cameraPass);
    }

    if (!(layer._preRenderCalledForCameras & 1 << cameraPass)) {
      if (layer.onPreRender) {
        layer.onPreRender(cameraPass);
      }
      layer._preRenderCalledForCameras |= 1 << cameraPass;
    }
    if (camera) {
      var _renderAction$renderT;
      this.setupViewport(camera.camera, renderAction.renderTarget);

      if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
        this.clear(renderAction, camera.camera);
      }
      const sortTime = now();
      layer._sortVisible(transparent, camera.camera.node, cameraPass);
      this._sortTime += now() - sortTime;
      const objects = layer.instances;
      const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

      this.scene.immediate.onPreRenderLayer(layer, visible, transparent);

      if (clusteredLightingEnabled && renderAction.lightClusters) {
        renderAction.lightClusters.activate(this.lightTextureAtlas);

        if (!this.clustersDebugRendered && this.scene.lighting.debugLayer === layer.id) {
          this.clustersDebugRendered = true;
          WorldClustersDebug.render(renderAction.lightClusters, this.scene);
        }
      }

      this.scene._activeCamera = camera.camera;
      this.setCameraUniforms(camera.camera, renderAction.renderTarget, renderAction);

      const flipFaces = !!(camera.camera._flipFaces ^ (renderAction == null ? void 0 : (_renderAction$renderT = renderAction.renderTarget) == null ? void 0 : _renderAction$renderT.flipY));
      const draws = this._forwardDrawCalls;
      this.renderForward(camera.camera, visible.list, visible.length, layer._splitLights, layer.shaderPass, layer.cullingMask, layer.onDrawCall, layer, flipFaces);
      layer._forwardDrawCalls += this._forwardDrawCalls - draws;

      device.setColorWrite(true, true, true, true);
      device.setStencilTest(false);
      device.setAlphaToCoverage(false);
      device.setDepthBias(false);

      if (renderAction.lastCameraUse && camera.onPostRender) {
        camera.onPostRender();
      }
    }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQge1xuICAgIEZVTkNfQUxXQVlTLFxuICAgIFNURU5DSUxPUF9LRUVQLFxuICAgIEJJTkRHUk9VUF9NRVNIXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyUGFzcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci1wYXNzLmpzJztcblxuaW1wb3J0IHtcbiAgICBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBGT0dfTk9ORSwgRk9HX0xJTkVBUixcbiAgICBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBMSUdIVFNIQVBFX1BVTkNUVUFMLFxuICAgIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0JBS0UsXG4gICAgU0hBRE9XVVBEQVRFX05PTkUsXG4gICAgU0hBRE9XVVBEQVRFX1RISVNGUkFNRSwgTEFZRVJJRF9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcblxuY29uc3Qgd2ViZ2wxRGVwdGhDbGVhckNvbG9yID0gbmV3IENvbG9yKDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1KTtcblxuY29uc3QgX2RyYXdDYWxsTGlzdCA9IHtcbiAgICBkcmF3Q2FsbHM6IFtdLFxuICAgIGlzTmV3TWF0ZXJpYWw6IFtdLFxuICAgIGxpZ2h0TWFza0NoYW5nZWQ6IFtdXG59O1xuXG4vKipcbiAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyIHJlbmRlcnMge0BsaW5rIFNjZW5lfXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBGb3J3YXJkUmVuZGVyZXIgZXh0ZW5kcyBSZW5kZXJlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEZvcndhcmRSZW5kZXJlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc3VwZXIoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5fZGVwdGhNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9zb3J0VGltZSA9IDA7XG5cbiAgICAgICAgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBkZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvcklkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2NvbG9yJyk7XG4gICAgICAgIHRoaXMuZm9nU3RhcnRJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19zdGFydCcpO1xuICAgICAgICB0aGlzLmZvZ0VuZElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2VuZCcpO1xuICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZCA9IHNjb3BlLnJlc29sdmUoJ2ZvZ19kZW5zaXR5Jyk7XG5cbiAgICAgICAgdGhpcy5hbWJpZW50SWQgPSBzY29wZS5yZXNvbHZlKCdsaWdodF9nbG9iYWxBbWJpZW50Jyk7XG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQgPSBzY29wZS5yZXNvbHZlKCdza3lib3hJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5jdWJlTWFwUm90YXRpb25NYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ2N1YmVNYXBSb3RhdGlvbk1hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyID0gW107XG4gICAgICAgIHRoaXMubGlnaHREaXJJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5ID0gW107XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zID0gW107XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGggPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0T3V0QW5nbGVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWQgPSBbXTtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWQgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZCA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NyZWVuU2l6ZUlkID0gc2NvcGUucmVzb2x2ZSgndVNjcmVlblNpemUnKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgIC8vIFN0YXRpYyBwcm9wZXJ0aWVzIHVzZWQgYnkgdGhlIFByb2ZpbGVyIGluIHRoZSBFZGl0b3IncyBMYXVuY2ggUGFnZVxuICAgIHN0YXRpYyBza2lwUmVuZGVyQ2FtZXJhID0gbnVsbDtcblxuICAgIHN0YXRpYyBfc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgc3RhdGljIHNraXBSZW5kZXJBZnRlciA9IDA7XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICovXG4gICAgZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpIHtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMF0gPSBzY2VuZS5hbWJpZW50TGlnaHQucjtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMV0gPSBzY2VuZS5hbWJpZW50TGlnaHQuZztcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbMl0gPSBzY2VuZS5hbWJpZW50TGlnaHQuYjtcbiAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFtYmllbnRDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuYW1iaWVudENvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzY2VuZS5waHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldICo9IHNjZW5lLmFtYmllbnRMdW1pbmFuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hbWJpZW50SWQuc2V0VmFsdWUodGhpcy5hbWJpZW50Q29sb3IpO1xuXG4gICAgICAgIHRoaXMuc2t5Ym94SW50ZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUucGh5c2ljYWxVbml0cyA/IHNjZW5lLnNreWJveEx1bWluYW5jZSA6IHNjZW5lLnNreWJveEludGVuc2l0eSk7XG4gICAgICAgIHRoaXMuY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQuc2V0VmFsdWUoc2NlbmUuX3NreWJveFJvdGF0aW9uTWF0My5kYXRhKTtcbiAgICB9XG5cbiAgICBfcmVzb2x2ZUxpZ2h0KHNjb3BlLCBpKSB7XG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gJ2xpZ2h0JyArIGk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29sb3InKTtcbiAgICAgICAgdGhpcy5saWdodERpcltpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHREaXJJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2RpcmVjdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXAnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4Jyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd1BhcmFtcycpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3JhZGl1cycpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcG9zaXRpb24nKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19oYWxmV2lkdGgnKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtpXSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZIZWlnaHQnKTtcbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2lubmVyQ29uZUFuZ2xlJyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfb3V0ZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llJyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZUludGVuc2l0eScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llT2Zmc2V0Jyk7XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93TWF0cml4UGFsZXR0ZVswXScpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXNbMF0nKTtcbiAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd0Nhc2NhZGVDb3VudCcpO1xuICAgIH1cblxuICAgIHNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpciwgY2FtcG9zLCBmYXIpIHtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gY2FtcG9zLnggLSBkaXIueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gY2FtcG9zLnkgLSBkaXIueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gY2FtcG9zLnogLSBkaXIueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueSAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGgueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueCAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0LnogKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hEaXJlY3RMaWdodHMoZGlycywgc2NlbmUsIG1hc2ssIGNhbWVyYSkge1xuICAgICAgICBsZXQgY250ID0gMDtcblxuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGlycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCEoZGlyc1tpXS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBkaXJlY3Rpb25hbCA9IGRpcnNbaV07XG4gICAgICAgICAgICBjb25zdCB3dG0gPSBkaXJlY3Rpb25hbC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZXNvbHZlTGlnaHQoc2NvcGUsIGNudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gZGlyZWN0aW9uYWwuX2xpbmVhckZpbmFsQ29sb3IgOiBkaXJlY3Rpb25hbC5fZmluYWxDb2xvcik7XG5cbiAgICAgICAgICAgIC8vIERpcmVjdGlvbmFsIGxpZ2h0cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgICAgIHd0bS5nZXRZKGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24pLm11bFNjYWxhcigtMSk7XG4gICAgICAgICAgICBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzBdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi54O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi55O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzJdID0gZGlyZWN0aW9uYWwuX2RpcmVjdGlvbi56O1xuICAgICAgICAgICAgdGhpcy5saWdodERpcklkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodERpcltjbnRdKTtcblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbmFsLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlIC0gTkIgZGlyZWN0aW9uYWwgYXJlYSBsaWdodCBzcGVjdWxhciBpcyBhcHByb3hpbWF0ZWQgYnkgcHV0dGluZyB0aGUgYXJlYSBsaWdodCBhdCB0aGUgZmFyIGNsaXBcbiAgICAgICAgICAgICAgICB0aGlzLnNldExUQ0RpcmVjdGlvbmFsTGlnaHQod3RtLCBjbnQsIGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24sIGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpLCBjYW1lcmEuZmFyQ2xpcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb25hbC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gZGlyZWN0aW9uYWwuZ2V0UmVuZGVyRGF0YShjYW1lcmEsIDApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IGRpcmVjdGlvbmFsLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd01hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkW2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5udW1DYXNjYWRlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBkaXJlY3Rpb25hbC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSAzO1xuICAgICAgICAgICAgICAgIHBhcmFtc1swXSA9IGRpcmVjdGlvbmFsLl9zaGFkb3dSZXNvbHV0aW9uOyAgLy8gTm90ZTogdGhpcyBuZWVkcyB0byBjaGFuZ2UgZm9yIG5vbi1zcXVhcmUgc2hhZG93IG1hcHMgKDIgY2FzY2FkZXMpLiBDdXJyZW50bHkgc3F1YXJlIGlzIHVzZWRcbiAgICAgICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNudDtcbiAgICB9XG5cbiAgICBzZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpIHtcbiAgICAgICAgY29uc3QgaFdpZHRoID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygtMC41LCAwLCAwKSk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzBdID0gaFdpZHRoLng7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzFdID0gaFdpZHRoLnk7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aFtjbnRdWzJdID0gaFdpZHRoLno7XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFdpZHRoW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhIZWlnaHQgPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKDAsIDAsIDAuNSkpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMF0gPSBoSGVpZ2h0Lng7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsxXSA9IGhIZWlnaHQueTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzJdID0gaEhlaWdodC56O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0SWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0SGVpZ2h0W2NudF0pO1xuICAgIH1cblxuICAgIGRpc3BhdGNoT21uaUxpZ2h0KHNjZW5lLCBzY29wZSwgb21uaSwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IG9tbmkuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtjbnRdLnNldFZhbHVlKG9tbmkuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IG9tbmkuX2xpbmVhckZpbmFsQ29sb3IgOiBvbW5pLl9maW5hbENvbG9yKTtcbiAgICAgICAgd3RtLmdldFRyYW5zbGF0aW9uKG9tbmkuX3Bvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gb21uaS5fcG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gb21uaS5fcG9zaXRpb24ueTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gb21uaS5fcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBpZiAob21uaS5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlXG4gICAgICAgICAgICB0aGlzLnNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob21uaS5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgbWFwXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBvbW5pLmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gb21uaS5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IG9tbmkuX3NoYWRvd1JlbmRlclBhcmFtcztcbiAgICAgICAgICAgIHBhcmFtcy5sZW5ndGggPSA0O1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gb21uaS5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzJdID0gYmlhc2VzLmJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbM10gPSAxLjAgLyBvbW5pLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2NudF0uc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbY250XS5zZXRWYWx1ZShvbW5pLnNoYWRvd0ludGVuc2l0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9tbmkuX2Nvb2tpZSkge1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUlkW2NudF0uc2V0VmFsdWUob21uaS5fY29va2llKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHd0bS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZFtjbnRdLnNldFZhbHVlKG9tbmkuY29va2llSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KSB7XG4gICAgICAgIGNvbnN0IHd0bSA9IHNwb3QuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBpZiAoIXRoaXMubGlnaHRDb2xvcklkW2NudF0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWRbY250XS5zZXRWYWx1ZShzcG90Ll9pbm5lckNvbmVBbmdsZUNvcyk7XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkW2NudF0uc2V0VmFsdWUoc3BvdC5fb3V0ZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWRbY250XS5zZXRWYWx1ZShzcG90LmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBzcG90Ll9saW5lYXJGaW5hbENvbG9yIDogc3BvdC5fZmluYWxDb2xvcik7XG4gICAgICAgIHd0bS5nZXRUcmFuc2xhdGlvbihzcG90Ll9wb3NpdGlvbik7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVswXSA9IHNwb3QuX3Bvc2l0aW9uLng7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsxXSA9IHNwb3QuX3Bvc2l0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbY250XVsyXSA9IHNwb3QuX3Bvc2l0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHRQb3NJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRQb3NbY250XSk7XG5cbiAgICAgICAgaWYgKHNwb3Quc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgIC8vIG5vbi1wdW5jdHVhbCBzaGFwZVxuICAgICAgICAgICAgdGhpcy5zZXRMVENQb3NpdGlvbmFsTGlnaHQod3RtLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BvdHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgIHd0bS5nZXRZKHNwb3QuX2RpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgc3BvdC5fZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMF0gPSBzcG90Ll9kaXJlY3Rpb24ueDtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzFdID0gc3BvdC5fZGlyZWN0aW9uLnk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVsyXSA9IHNwb3QuX2RpcmVjdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0RGlyW2NudF0pO1xuXG4gICAgICAgIGlmIChzcG90LmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IHNwb3QuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBzcG90Ll9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gc3BvdC5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBzcG90Ll9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIHNwb3QuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKHNwb3Quc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcG90Ll9jb29raWUpIHtcblxuICAgICAgICAgICAgLy8gaWYgc2hhZG93IGlzIG5vdCByZW5kZXJlZCwgd2UgbmVlZCB0byBldmFsdWF0ZSBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgaWYgKCFzcG90LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29va2llTWF0cml4ID0gTGlnaHRDYW1lcmEuZXZhbFNwb3RDb29raWVNYXRyaXgoc3BvdCk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUoY29va2llTWF0cml4LmRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWUpO1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2NudF0uc2V0VmFsdWUoc3BvdC5jb29raWVJbnRlbnNpdHkpO1xuICAgICAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzFdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLnk7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVsyXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS56O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bM10gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0udztcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWRbY250XS5zZXRWYWx1ZShzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtKTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzBdID0gc3BvdC5fY29va2llT2Zmc2V0Lng7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybVsxXSA9IHNwb3QuX2Nvb2tpZU9mZnNldC55O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVPZmZzZXRJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hMb2NhbExpZ2h0cyhzb3J0ZWRMaWdodHMsIHNjZW5lLCBtYXNrLCB1c2VkRGlyTGlnaHRzLCBzdGF0aWNMaWdodExpc3QpIHtcblxuICAgICAgICBsZXQgY250ID0gdXNlZERpckxpZ2h0cztcbiAgICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLmRldmljZS5zY29wZTtcblxuICAgICAgICBjb25zdCBvbW5pcyA9IHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfT01OSV07XG4gICAgICAgIGNvbnN0IG51bU9tbmlzID0gb21uaXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bU9tbmlzOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG9tbmkgPSBvbW5pc1tpXTtcbiAgICAgICAgICAgIGlmICghKG9tbmkubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChvbW5pLmlzU3RhdGljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RhdGljSWQgPSAwO1xuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBsZXQgb21uaSA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB3aGlsZSAob21uaSAmJiBvbW5pLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpO1xuICAgICAgICAgICAgICAgIGNudCsrO1xuICAgICAgICAgICAgICAgIHN0YXRpY0lkKys7XG4gICAgICAgICAgICAgICAgb21uaSA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcHRzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9TUE9UXTtcbiAgICAgICAgY29uc3QgbnVtU3B0cyA9IHNwdHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNwdHM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc3BvdCA9IHNwdHNbaV07XG4gICAgICAgICAgICBpZiAoIShzcG90Lm1hc2sgJiBtYXNrKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoc3BvdC5pc1N0YXRpYykgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgIGNudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0YXRpY0xpZ2h0TGlzdCkge1xuICAgICAgICAgICAgbGV0IHNwb3QgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgd2hpbGUgKHNwb3QgJiYgc3BvdC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoU3BvdExpZ2h0KHNjZW5lLCBzY29wZSwgc3BvdCwgY250KTtcbiAgICAgICAgICAgICAgICBjbnQrKztcbiAgICAgICAgICAgICAgICBzdGF0aWNJZCsrO1xuICAgICAgICAgICAgICAgIHNwb3QgPSBzdGF0aWNMaWdodExpc3Rbc3RhdGljSWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyU2hhZG93c0xvY2FsKGxpZ2h0cywgY2FtZXJhKSB7XG5cbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCk7XG5cbiAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZCkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBjbHVzdGVyZWQgc2hhZG93cyB3aXRoIG5vIGFzc2lnbmVkIGF0bGFzIHNsb3RcbiAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgYXRsYXMgc2xvdCBpcyByZWFzc2lnbmVkLCBtYWtlIHN1cmUgc2hhZG93IGlzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNTbG90VXBkYXRlZCAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwucmVuZGVyKGxpZ2h0LCBjYW1lcmEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZSBmaXJzdCBwYXNzIG92ZXIgZHJhdyBjYWxscywgaW4gb3JkZXIgdG8gdXBkYXRlIG1hdGVyaWFscyAvIHNoYWRlcnNcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgdGhpczogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYkdMX0FQSS9XZWJHTF9iZXN0X3ByYWN0aWNlcyNjb21waWxlX3NoYWRlcnNfYW5kX2xpbmtfcHJvZ3JhbXNfaW5fcGFyYWxsZWxcbiAgICAvLyB3aGVyZSBpbnN0ZWFkIG9mIGNvbXBpbGluZyBhbmQgbGlua2luZyBzaGFkZXJzLCB3aGljaCBpcyBzZXJpYWwgb3BlcmF0aW9uLCB3ZSBjb21waWxlIGFsbCBvZiB0aGVtIGFuZCB0aGVuIGxpbmsgdGhlbSwgYWxsb3dpbmcgdGhlIHdvcmsgdG9cbiAgICAvLyB0YWtlIHBsYWNlIGluIHBhcmFsbGVsXG4gICAgcmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMoY2FtZXJhLCBkcmF3Q2FsbHMsIGRyYXdDYWxsc0NvdW50LCBzb3J0ZWRMaWdodHMsIGN1bGxpbmdNYXNrLCBsYXllciwgcGFzcykge1xuXG4gICAgICAgIGNvbnN0IGFkZENhbGwgPSAoZHJhd0NhbGwsIGlzTmV3TWF0ZXJpYWwsIGxpZ2h0TWFza0NoYW5nZWQpID0+IHtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QuZHJhd0NhbGxzLnB1c2goZHJhd0NhbGwpO1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5pc05ld01hdGVyaWFsLnB1c2goaXNOZXdNYXRlcmlhbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmxpZ2h0TWFza0NoYW5nZWQucHVzaChsaWdodE1hc2tDaGFuZ2VkKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBzdGFydCB3aXRoIGVtcHR5IGFycmF5c1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmRyYXdDYWxscy5sZW5ndGggPSAwO1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmlzTmV3TWF0ZXJpYWwubGVuZ3RoID0gMDtcbiAgICAgICAgX2RyYXdDYWxsTGlzdC5saWdodE1hc2tDaGFuZ2VkLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgbGlnaHRIYXNoID0gbGF5ZXIgPyBsYXllci5fbGlnaHRIYXNoIDogMDtcbiAgICAgICAgbGV0IHByZXZNYXRlcmlhbCA9IG51bGwsIHByZXZPYmpEZWZzLCBwcmV2U3RhdGljLCBwcmV2TGlnaHRNYXNrO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuXG4gICAgICAgICAgICAvLyBhcHBseSB2aXNpYmlsaXR5IG92ZXJyaWRlXG4gICAgICAgICAgICBpZiAoY3VsbGluZ01hc2sgJiYgZHJhd0NhbGwubWFzayAmJiAhKGN1bGxpbmdNYXNrICYgZHJhd0NhbGwubWFzaykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jb21tYW5kKSB7XG5cbiAgICAgICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEgPT09IEZvcndhcmRSZW5kZXJlci5za2lwUmVuZGVyQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyID49IEZvcndhcmRSZW5kZXJlci5za2lwUmVuZGVyQWZ0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLl9za2lwUmVuZGVyQ291bnRlciA+PSBsYXllci5za2lwUmVuZGVyQWZ0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqRGVmcyA9IGRyYXdDYWxsLl9zaGFkZXJEZWZzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFzayA9IGRyYXdDYWxsLm1hc2s7XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwgJiYgbWF0ZXJpYWwgPT09IHByZXZNYXRlcmlhbCAmJiBvYmpEZWZzICE9PSBwcmV2T2JqRGVmcykge1xuICAgICAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBudWxsOyAvLyBmb3JjZSBjaGFuZ2Ugc2hhZGVyIGlmIHRoZSBvYmplY3QgdXNlcyBhIGRpZmZlcmVudCB2YXJpYW50IG9mIHRoZSBzYW1lIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmlzU3RhdGljIHx8IHByZXZTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJldk1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwgIT09IHByZXZNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzKys7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9zY2VuZSA9IHNjZW5lO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kaXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlVW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgbWF0ZXJpYWwgaGFzIGRpcnR5QmxlbmQgc2V0LCBub3RpZnkgc2NlbmUgaGVyZVxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuX2RpcnR5QmxlbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lLmxheWVycy5fZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLl9zaGFkZXJbcGFzc10gfHwgZHJhd0NhbGwuX3NoYWRlckRlZnMgIT09IG9iakRlZnMgfHwgZHJhd0NhbGwuX2xpZ2h0SGFzaCAhPT0gbGlnaHRIYXNoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZHJhdyBjYWxscyBub3QgdXNpbmcgc3RhdGljIGxpZ2h0cyB1c2UgdmFyaWFudHMgY2FjaGUgb24gbWF0ZXJpYWwgdG8gcXVpY2tseSBmaW5kIHRoZSBzaGFkZXIsIGFzIHRoZXkgYXJlIGFsbFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc2FtZSBmb3IgdGhlIHNhbWUgcGFzcywgdXNpbmcgYWxsIGxpZ2h0cyBvZiB0aGUgc2NlbmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudEtleSA9IHBhc3MgKyAnXycgKyBvYmpEZWZzICsgJ18nICsgbGlnaHRIYXNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwuX3NoYWRlcltwYXNzXSA9IG1hdGVyaWFsLnZhcmlhbnRzW3ZhcmlhbnRLZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgbnVsbCwgc29ydGVkTGlnaHRzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnZhcmlhbnRzW3ZhcmlhbnRLZXldID0gZHJhd0NhbGwuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RhdGljIGxpZ2h0cyBnZW5lcmF0ZSB1bmlxdWUgc2hhZGVyIHBlciBkcmF3IGNhbGwsIGFzIHN0YXRpYyBsaWdodHMgYXJlIHVuaXF1ZSBwZXIgZHJhdyBjYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHNvIHZhcmlhbnRzIGNhY2hlIGlzIG5vdCB1c2VkXG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwuX2xpZ2h0SGFzaCA9IGxpZ2h0SGFzaDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoZHJhd0NhbGwuX3NoYWRlcltwYXNzXSwgXCJubyBzaGFkZXIgZm9yIHBhc3NcIiwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICAgICAgYWRkQ2FsbChkcmF3Q2FsbCwgbWF0ZXJpYWwgIT09IHByZXZNYXRlcmlhbCwgIXByZXZNYXRlcmlhbCB8fCBsaWdodE1hc2sgIT09IHByZXZMaWdodE1hc2spO1xuXG4gICAgICAgICAgICAgICAgcHJldk1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgcHJldk9iakRlZnMgPSBvYmpEZWZzO1xuICAgICAgICAgICAgICAgIHByZXZMaWdodE1hc2sgPSBsaWdodE1hc2s7XG4gICAgICAgICAgICAgICAgcHJldlN0YXRpYyA9IGRyYXdDYWxsLmlzU3RhdGljO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9kcmF3Q2FsbExpc3Q7XG4gICAgfVxuXG4gICAgcmVuZGVyRm9yd2FyZEludGVybmFsKGNhbWVyYSwgcHJlcGFyZWRDYWxscywgc29ydGVkTGlnaHRzLCBwYXNzLCBkcmF3Q2FsbGJhY2ssIGZsaXBGYWNlcykge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc3VwcG9ydHNVbmlmb3JtQnVmZmVycyA9IGRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IHBhc3NGbGFnID0gMSA8PCBwYXNzO1xuXG4gICAgICAgIC8vIFJlbmRlciB0aGUgc2NlbmVcbiAgICAgICAgY29uc3QgcHJlcGFyZWRDYWxsc0NvdW50ID0gcHJlcGFyZWRDYWxscy5kcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZXBhcmVkQ2FsbHNDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gcHJlcGFyZWRDYWxscy5kcmF3Q2FsbHNbaV07XG5cbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jb21tYW5kKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGEgY29tbWFuZFxuICAgICAgICAgICAgICAgIGRyYXdDYWxsLmNvbW1hbmQoKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgYSBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TWF0ZXJpYWwgPSBwcmVwYXJlZENhbGxzLmlzTmV3TWF0ZXJpYWxbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrQ2hhbmdlZCA9IHByZXBhcmVkQ2FsbHMubGlnaHRNYXNrQ2hhbmdlZFtpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9iakRlZnMgPSBkcmF3Q2FsbC5fc2hhZGVyRGVmcztcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodE1hc2sgPSBkcmF3Q2FsbC5tYXNrO1xuXG4gICAgICAgICAgICAgICAgaWYgKG5ld01hdGVyaWFsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gZHJhd0NhbGwuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzaGFkZXIuZmFpbGVkICYmICFkZXZpY2Uuc2V0U2hhZGVyKHNoYWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBFcnJvciBjb21waWxpbmcgc2hhZGVyIGZvciBtYXRlcmlhbD0ke21hdGVyaWFsLm5hbWV9IHBhc3M9JHtwYXNzfSBvYmpEZWZzPSR7b2JqRGVmc31gLCBtYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJOiBtYXRlcmlhbFxuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0TWFza0NoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVzZWREaXJMaWdodHMgPSB0aGlzLmRpc3BhdGNoRGlyZWN0TGlnaHRzKHNvcnRlZExpZ2h0c1tMSUdIVFRZUEVfRElSRUNUSU9OQUxdLCBzY2VuZSwgbGlnaHRNYXNrLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaExvY2FsTGlnaHRzKHNvcnRlZExpZ2h0cywgc2NlbmUsIGxpZ2h0TWFzaywgdXNlZERpckxpZ2h0cywgZHJhd0NhbGwuX3N0YXRpY0xpZ2h0TGlzdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFscGhhVGVzdElkLnNldFZhbHVlKG1hdGVyaWFsLmFscGhhVGVzdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kaW5nKG1hdGVyaWFsLmJsZW5kKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmJsZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuc2VwYXJhdGVBbHBoYUJsZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZShtYXRlcmlhbC5ibGVuZFNyYywgbWF0ZXJpYWwuYmxlbmREc3QsIG1hdGVyaWFsLmJsZW5kU3JjQWxwaGEsIG1hdGVyaWFsLmJsZW5kRHN0QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZEVxdWF0aW9uU2VwYXJhdGUobWF0ZXJpYWwuYmxlbmRFcXVhdGlvbiwgbWF0ZXJpYWwuYmxlbmRBbHBoYUVxdWF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kRnVuY3Rpb24obWF0ZXJpYWwuYmxlbmRTcmMsIG1hdGVyaWFsLmJsZW5kRHN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRFcXVhdGlvbihtYXRlcmlhbC5ibGVuZEVxdWF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZShtYXRlcmlhbC5yZWRXcml0ZSwgbWF0ZXJpYWwuZ3JlZW5Xcml0ZSwgbWF0ZXJpYWwuYmx1ZVdyaXRlLCBtYXRlcmlhbC5hbHBoYVdyaXRlKTtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoV3JpdGUobWF0ZXJpYWwuZGVwdGhXcml0ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdGhpcyBmaXhlcyB0aGUgY2FzZSB3aGVyZSB0aGUgdXNlciB3aXNoZXMgdG8gdHVybiBvZmYgZGVwdGggdGVzdGluZyBidXQgd2FudHMgdG8gd3JpdGUgZGVwdGhcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRlcHRoV3JpdGUgJiYgIW1hdGVyaWFsLmRlcHRoVGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoRnVuYyhGVU5DX0FMV0FZUyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhUZXN0KHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoRnVuYyhtYXRlcmlhbC5kZXB0aEZ1bmMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoVGVzdChtYXRlcmlhbC5kZXB0aFRlc3QpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEFscGhhVG9Db3ZlcmFnZShtYXRlcmlhbC5hbHBoYVRvQ292ZXJhZ2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kZXB0aEJpYXMgfHwgbWF0ZXJpYWwuc2xvcGVEZXB0aEJpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXModHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzVmFsdWVzKG1hdGVyaWFsLmRlcHRoQmlhcywgbWF0ZXJpYWwuc2xvcGVEZXB0aEJpYXMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldEN1bGxNb2RlKGNhbWVyYS5fY3VsbEZhY2VzLCBmbGlwRmFjZXMsIGRyYXdDYWxsKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWxGcm9udCA9IGRyYXdDYWxsLnN0ZW5jaWxGcm9udCB8fCBtYXRlcmlhbC5zdGVuY2lsRnJvbnQ7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbEJhY2sgPSBkcmF3Q2FsbC5zdGVuY2lsQmFjayB8fCBtYXRlcmlhbC5zdGVuY2lsQmFjaztcblxuICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsRnJvbnQgfHwgc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxUZXN0KHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbEZyb250ID09PSBzdGVuY2lsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWRlbnRpY2FsIGZyb250L2JhY2sgc3RlbmNpbFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxGdW5jKHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxPcGVyYXRpb24oc3RlbmNpbEZyb250LmZhaWwsIHN0ZW5jaWxGcm9udC56ZmFpbCwgc3RlbmNpbEZyb250LnpwYXNzLCBzdGVuY2lsRnJvbnQud3JpdGVNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlcGFyYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbEZyb250KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGZyb250XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxGdW5jRnJvbnQoc3RlbmNpbEZyb250LmZ1bmMsIHN0ZW5jaWxGcm9udC5yZWYsIHN0ZW5jaWxGcm9udC5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udChzdGVuY2lsRnJvbnQuZmFpbCwgc3RlbmNpbEZyb250LnpmYWlsLCBzdGVuY2lsRnJvbnQuenBhc3MsIHN0ZW5jaWxGcm9udC53cml0ZU1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IGZyb250XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxGdW5jRnJvbnQoRlVOQ19BTFdBWVMsIDAsIDB4RkYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCBTVEVOQ0lMT1BfS0VFUCwgMHhGRik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0JhY2soc3RlbmNpbEJhY2suZnVuYywgc3RlbmNpbEJhY2sucmVmLCBzdGVuY2lsQmFjay5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKHN0ZW5jaWxCYWNrLmZhaWwsIHN0ZW5jaWxCYWNrLnpmYWlsLCBzdGVuY2lsQmFjay56cGFzcywgc3RlbmNpbEJhY2sud3JpdGVNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCBiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxGdW5jQmFjayhGVU5DX0FMV0FZUywgMCwgMHhGRik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKFNURU5DSUxPUF9LRUVQLCBTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIDB4RkYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxUZXN0KGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gZHJhd0NhbGwubWVzaDtcblxuICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIElJOiBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzXG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFnKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TW9ycGhpbmcoZGV2aWNlLCBkcmF3Q2FsbC5tb3JwaEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNraW5uaW5nKGRldmljZSwgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBtb2RlbCBtYXRyaXggc2V0dXAgaXMgcGFydCBvZiB0aGUgZHJhd0luc3RhbmNlIGNhbGwsIGJ1dCB3aXRoIHVuaWZvcm0gYnVmZmVyIGl0J3MgbmVlZGVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGVhcmxpZXIgaGVyZS4gVGhpcyBuZWVkcyB0byBiZSByZWZhY3RvcmVkIGZvciBtdWx0aS12aWV3IGFueXdheXMuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShkcmF3Q2FsbC5ub2RlLndvcmxkVHJhbnNmb3JtLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKGRyYXdDYWxsLm5vZGUubm9ybWFsTWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBtZXNoIGJpbmQgZ3JvdXAgLyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwID0gZHJhd0NhbGwuZ2V0QmluZEdyb3VwKGRldmljZSwgcGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXIudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX01FU0gsIG1lc2hCaW5kR3JvdXApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gZHJhd0NhbGwucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldEluZGV4QnVmZmVyKG1lc2guaW5kZXhCdWZmZXJbc3R5bGVdKTtcblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGxiYWNrKGRyYXdDYWxsLCBpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci5zZXNzaW9uICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCB2aWV3cy5sZW5ndGg7IHYrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQodmlldy52aWV3cG9ydC54LCB2aWV3LnZpZXdwb3J0LnksIHZpZXcudmlld3BvcnQueiwgdmlldy52aWV3cG9ydC53KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQuc2V0VmFsdWUodmlldy52aWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlldy52aWV3SW52T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQzLnNldFZhbHVlKHZpZXcudmlld01hdDMuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qVmlld09mZk1hdC5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZpZXcucG9zaXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodiA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHJhd0luc3RhbmNlKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UyKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVW5zZXQgbWVzaEluc3RhbmNlIG92ZXJyaWRlcyBiYWNrIHRvIG1hdGVyaWFsIHZhbHVlcyBpZiBuZXh0IGRyYXcgY2FsbCB3aWxsIHVzZSB0aGUgc2FtZSBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIGlmIChpIDwgcHJlcGFyZWRDYWxsc0NvdW50IC0gMSAmJiAhcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2kgKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgZHJhd0NhbGwucGFyYW1ldGVycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyRm9yd2FyZChjYW1lcmEsIGFsbERyYXdDYWxscywgYWxsRHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgcGFzcywgY3VsbGluZ01hc2ssIGRyYXdDYWxsYmFjaywgbGF5ZXIsIGZsaXBGYWNlcykge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZm9yd2FyZFN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBydW4gZmlyc3QgcGFzcyBvdmVyIGRyYXcgY2FsbHMgYW5kIGhhbmRsZSBtYXRlcmlhbCAvIHNoYWRlciB1cGRhdGVzXG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHMgPSB0aGlzLnJlbmRlckZvcndhcmRQcmVwYXJlTWF0ZXJpYWxzKGNhbWVyYSwgYWxsRHJhd0NhbGxzLCBhbGxEcmF3Q2FsbHNDb3VudCwgc29ydGVkTGlnaHRzLCBjdWxsaW5nTWFzaywgbGF5ZXIsIHBhc3MpO1xuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpO1xuXG4gICAgICAgIF9kcmF3Q2FsbExpc3QubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2ZvcndhcmRUaW1lICs9IG5vdygpIC0gZm9yd2FyZFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgc2V0U2NlbmVDb25zdGFudHMoKSB7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvLyBTZXQgdXAgYW1iaWVudC9leHBvc3VyZVxuICAgICAgICB0aGlzLmRpc3BhdGNoR2xvYmFsTGlnaHRzKHNjZW5lKTtcblxuICAgICAgICAvLyBTZXQgdXAgdGhlIGZvZ1xuICAgICAgICBpZiAoc2NlbmUuZm9nICE9PSBGT0dfTk9ORSkge1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclswXSA9IHNjZW5lLmZvZ0NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzFdID0gc2NlbmUuZm9nQ29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMl0gPSBzY2VuZS5mb2dDb2xvci5iO1xuICAgICAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbaV0gPSBNYXRoLnBvdyh0aGlzLmZvZ0NvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JJZC5zZXRWYWx1ZSh0aGlzLmZvZ0NvbG9yKTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5mb2cgPT09IEZPR19MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ1N0YXJ0SWQuc2V0VmFsdWUoc2NlbmUuZm9nU3RhcnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nRW5kSWQuc2V0VmFsdWUoc2NlbmUuZm9nRW5kKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dEZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUuZm9nRGVuc2l0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdXAgc2NyZWVuIHNpemUgLy8gc2hvdWxkIGJlIFJUIHNpemU/XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzBdID0gZGV2aWNlLndpZHRoO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzFdID0gZGV2aWNlLmhlaWdodDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVsyXSA9IDEgLyBkZXZpY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbM10gPSAxIC8gZGV2aWNlLmhlaWdodDtcbiAgICAgICAgdGhpcy5zY3JlZW5TaXplSWQuc2V0VmFsdWUodGhpcy5fc2NyZWVuU2l6ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb21wVXBkYXRlZEZsYWdzIC0gRmxhZ3Mgb2Ygd2hhdCB3YXMgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVMaWdodFN0YXRzKGNvbXAsIGNvbXBVcGRhdGVkRmxhZ3MpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9MSUdIVFMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gc2NlbmUuX3N0YXRzO1xuICAgICAgICAgICAgc3RhdHMubGlnaHRzID0gY29tcC5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMgPSAwO1xuICAgICAgICAgICAgc3RhdHMuYmFrZWRMaWdodHMgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRzLmxpZ2h0czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAobC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgobC5tYXNrICYgTUFTS19BRkZFQ1RfRFlOQU1JQykgfHwgKGwubWFzayAmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSkgeyAvLyBpZiBhZmZlY3RzIGR5bmFtaWMgb3IgYmFrZWQgb2JqZWN0cyBpbiByZWFsLXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobC5tYXNrICYgTUFTS19CQUtFKSB7IC8vIGlmIGJha2VkIGludG8gbGlnaHRtYXBzXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9JTlNUQU5DRVMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIHNjZW5lLl9zdGF0cy5tZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBzY2VuZS5fc3RhdHNVcGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQnVpbGRzIGEgZnJhbWUgZ3JhcGggZm9yIHRoZSByZW5kZXJpbmcgb2YgdGhlIHdob2xlIGZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1lLWdyYXBoLmpzJykuRnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZS1ncmFwaCB0aGF0IGlzIGJ1aWx0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGxheWVyQ29tcG9zaXRpb24gLSBUaGVcbiAgICAgKiBsYXllciBjb21wb3NpdGlvbiB1c2VkIHRvIGJ1aWxkIHRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYnVpbGRGcmFtZUdyYXBoKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBmcmFtZUdyYXBoLnJlc2V0KCk7XG5cbiAgICAgICAgdGhpcy51cGRhdGUobGF5ZXJDb21wb3NpdGlvbik7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIHNoYWRvdyAvIGNvb2tpZSBhdGxhcyBhbGxvY2F0aW9uIGZvciB0aGUgdmlzaWJsZSBsaWdodHNcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMobGF5ZXJDb21wb3NpdGlvbik7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIHJlbmRlciBjb29raWVzIGZvciBhbGwgbG9jYWwgdmlzaWJsZSBsaWdodHNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5saWdodGluZy5jb29raWVzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNvb2tpZXMobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJDb29raWVzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgJ0NsdXN0ZXJlZENvb2tpZXMnKTtcbiAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvY2FsIHNoYWRvd3NcbiAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlLCAoKSA9PiB7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBzaGFkb3dzIGZvciBhbGwgbG9jYWwgdmlzaWJsZSBsaWdodHMgLSB0aGVzZSBzaGFkb3cgbWFwcyBhcmUgc2hhcmVkIGJ5IGFsbCBjYW1lcmFzXG4gICAgICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCB8fCAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHRoaXMuc2NlbmUubGlnaHRpbmcuc2hhZG93c0VuYWJsZWQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJTaGFkb3dzTG9jYWwobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclNoYWRvd3NMb2NhbChsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgbGlnaHQgY2x1c3RlcnNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNsdXN0ZXJzKGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgJ0xvY2FsU2hhZG93TWFwcycpO1xuICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG5cbiAgICAgICAgLy8gbWFpbiBwYXNzZXNcbiAgICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICBsZXQgcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICAgICAgLy8gc2tpcCBkaXNhYmxlZCBsYXllcnNcbiAgICAgICAgICAgIGlmICghcmVuZGVyQWN0aW9uLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzRGVwdGhMYXllciA9IGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgY29uc3QgaXNHcmFiUGFzcyA9IGlzRGVwdGhMYXllciAmJiAoY2FtZXJhLnJlbmRlclNjZW5lQ29sb3JNYXAgfHwgY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXApO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGdldCByZS1yZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmFcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgJiYgY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbC5idWlsZEZyYW1lR3JhcGgoZnJhbWVHcmFwaCwgcmVuZGVyQWN0aW9uLCBjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdGFydCBvZiBibG9jayBvZiByZW5kZXIgYWN0aW9ucyByZW5kZXJpbmcgdG8gdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKG5ld1N0YXJ0KSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzdGFydEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICByZW5kZXJUYXJnZXQgPSByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmaW5kIHRoZSBuZXh0IGVuYWJsZWQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgbGV0IG5leHRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgd2hpbGUgKHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XSAmJiAhcmVuZGVyQWN0aW9uc1tuZXh0SW5kZXhdLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgbmV4dEluZGV4Kys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluZm8gYWJvdXQgdGhlIG5leHQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgY29uc3QgbmV4dFJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyRGVwdGggPSBuZXh0UmVuZGVyQWN0aW9uID8gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RbbmV4dFJlbmRlckFjdGlvbi5sYXllckluZGV4XS5pZCA9PT0gTEFZRVJJRF9ERVBUSCA6IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaXNOZXh0TGF5ZXJHcmFiUGFzcyA9IGlzTmV4dExheWVyRGVwdGggJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKTtcblxuICAgICAgICAgICAgLy8gZW5kIG9mIHRoZSBibG9jayB1c2luZyB0aGUgc2FtZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICBpZiAoIW5leHRSZW5kZXJBY3Rpb24gfHwgbmV4dFJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQgIT09IHJlbmRlclRhcmdldCB8fFxuICAgICAgICAgICAgICAgIG5leHRSZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgfHwgaXNOZXh0TGF5ZXJHcmFiUGFzcyB8fCBpc0dyYWJQYXNzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBpLCBpc0dyYWJQYXNzKTtcblxuICAgICAgICAgICAgICAgIC8vIHBvc3Rwcm9jZXNzaW5nXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhPy5vblBvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGBQb3N0cHJvY2Vzc2ApO1xuICAgICAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1lLWdyYXBoLmpzJykuRnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlXG4gICAgICogbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBlbmRJbmRleCwgaXNHcmFiUGFzcykge1xuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgcmVuZGVyIGFjdGlvbnMgaW4gdGhlIHJhbmdlXG4gICAgICAgIGNvbnN0IHJhbmdlID0geyBzdGFydDogc3RhcnRJbmRleCwgZW5kOiBlbmRJbmRleCB9O1xuICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc1JlbmRlckFjdGlvbnMobGF5ZXJDb21wb3NpdGlvbiwgcmFuZ2UpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gbGF5ZXJDb21wb3NpdGlvbi5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgY29uc3Qgc3RhcnRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW3N0YXJ0SW5kZXhdO1xuICAgICAgICBjb25zdCBzdGFydExheWVyID0gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3Rbc3RhcnRSZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IHN0YXJ0TGF5ZXIuY2FtZXJhc1tzdGFydFJlbmRlckFjdGlvbi5jYW1lcmFJbmRleF07XG5cbiAgICAgICAgLy8gZGVwdGggZ3JhYiBwYXNzIG9uIHdlYmdsMSBpcyBub3JtYWwgcmVuZGVyIHBhc3MgKHNjZW5lIGdldHMgcmUtcmVuZGVyZWQpXG4gICAgICAgIGNvbnN0IGdyYWJQYXNzUmVxdWlyZWQgPSBpc0dyYWJQYXNzICYmIFNjZW5lR3JhYi5yZXF1aXJlc1JlbmRlclBhc3ModGhpcy5kZXZpY2UsIGNhbWVyYSk7XG4gICAgICAgIGNvbnN0IGlzUmVhbFBhc3MgPSAhaXNHcmFiUGFzcyB8fCBncmFiUGFzc1JlcXVpcmVkO1xuXG4gICAgICAgIGlmIChpc1JlYWxQYXNzKSB7XG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuaW5pdChyZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCA9IGNhbWVyYS5jYW1lcmEuZnVsbFNpemVDbGVhclJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChncmFiUGFzc1JlcXVpcmVkKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB3ZWJnbDEgZGVwdGggcmVuZGVyaW5nIGNsZWFyIHZhbHVlc1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJDb2xvcih3ZWJnbDFEZXB0aENsZWFyQ29sb3IpO1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aCgxLjApO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlbmRlclBhc3MuZnVsbFNpemVDbGVhclJlY3QpIHsgLy8gaWYgY2FtZXJhIHJlbmRlcmluZyBjb3ZlcnMgdGhlIGZ1bGwgdmlld3BvcnRcblxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhckNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJDb2xvcihjYW1lcmEuY2FtZXJhLmNsZWFyQ29sb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyRGVwdGgoY2FtZXJhLmNhbWVyYS5jbGVhckRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyU3RlbmNpbChjYW1lcmEuY2FtZXJhLmNsZWFyU3RlbmNpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgJHtpc0dyYWJQYXNzID8gJ1NjZW5lR3JhYicgOiAnUmVuZGVyQWN0aW9uJ30gJHtzdGFydEluZGV4fS0ke2VuZEluZGV4fSBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgQ2FtOiAke2NhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICctJ31gKTtcbiAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICB1cGRhdGUoY29tcCkge1xuXG4gICAgICAgIHRoaXMuYmFzZVVwZGF0ZSgpO1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgc2t5Ym94LCBzaW5jZSB0aGlzIG1pZ2h0IGNoYW5nZSBfbWVzaEluc3RhbmNlc1xuICAgICAgICB0aGlzLnNjZW5lLl91cGRhdGVTa3kodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvbiBpZiBzb21ldGhpbmcgaGFzIGJlZW4gaW52YWxpZGF0ZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IHRoaXMudXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuICAgICAgICBjb25zdCBsaWdodHNDaGFuZ2VkID0gKHVwZGF0ZWQgJiBDT01QVVBEQVRFRF9MSUdIVFMpICE9PSAwO1xuXG4gICAgICAgIHRoaXMudXBkYXRlTGlnaHRTdGF0cyhjb21wLCB1cGRhdGVkKTtcblxuICAgICAgICAvLyBTaW5nbGUgcGVyLWZyYW1lIGNhbGN1bGF0aW9uc1xuICAgICAgICB0aGlzLmJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCk7XG4gICAgICAgIHRoaXMuc2V0U2NlbmVDb25zdGFudHMoKTtcblxuICAgICAgICAvLyB2aXNpYmlsaXR5IGN1bGxpbmcgb2YgbGlnaHRzLCBtZXNoSW5zdGFuY2VzLCBzaGFkb3dzIGNhc3RlcnNcbiAgICAgICAgLy8gYWZ0ZXIgdGhpcyB0aGUgc2NlbmUgY3VsbGluZyBpcyBkb25lIGFuZCBzY3JpcHQgY2FsbGJhY2tzIGNhbiBiZSBjYWxsZWQgdG8gcmVwb3J0IHdoaWNoIG9iamVjdHMgYXJlIHZpc2libGVcbiAgICAgICAgdGhpcy5jdWxsQ29tcG9zaXRpb24oY29tcCk7XG5cbiAgICAgICAgLy8gR1BVIHVwZGF0ZSBmb3IgYWxsIHZpc2libGUgb2JqZWN0c1xuICAgICAgICB0aGlzLmdwdVVwZGF0ZShjb21wLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICByZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhLm9uUG9zdHByb2Nlc3NpbmcpO1xuXG4gICAgICAgIC8vIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgZm9yIGNhbWVyYVxuICAgICAgICBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwYXNzIHJlcHJlc2VudGluZyB0aGUgbGF5ZXIgY29tcG9zaXRpb24ncyByZW5kZXIgYWN0aW9ucyBpbiB0aGUgc3BlY2lmaWVkIHJhbmdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uIHRvIHJlbmRlci5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc1JlbmRlckFjdGlvbnMoY29tcCwgcmFuZ2UpIHtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IHJhbmdlLnN0YXJ0OyBpIDw9IHJhbmdlLmVuZDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlbmRlckFjdGlvbihjb21wLCByZW5kZXJBY3Rpb25zW2ldLCBpID09PSByYW5nZS5zdGFydCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb259IHJlbmRlckFjdGlvbiAtIFRoZSByZW5kZXJcbiAgICAgKiBhY3Rpb24uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaXJzdFJlbmRlckFjdGlvbiAtIFRydWUgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBpbiB0aGUgcmVuZGVyIHBhc3MuXG4gICAgICovXG4gICAgcmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbiwgZmlyc3RSZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24uaXNMYXllckVuYWJsZWQoY29tcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgY2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJ25vbmFtZScpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGxheWVyLm5hbWUpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZHJhd1RpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgYmVmb3JlIHJlbmRlcmluZyB3aXRoIHRoaXMgY2FtZXJhIGZvciB0aGUgZmlyc3QgdGltZSBkdXJpbmcgdGhlIGZyYW1lXG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uLmZpcnN0Q2FtZXJhVXNlICYmIGNhbWVyYS5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5vblByZVJlbmRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbCBwcmVyZW5kZXIgY2FsbGJhY2sgaWYgdGhlcmUncyBvbmVcbiAgICAgICAgaWYgKCF0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUoY2FtZXJhUGFzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJhbnNwYXJlbnQgJiYgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGxlZCBmb3IgdGhlIGZpcnN0IHN1YmxheWVyIGFuZCBmb3IgZXZlcnkgY2FtZXJhXG4gICAgICAgIGlmICghKGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBpZiAobGF5ZXIub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblByZVJlbmRlcihjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCBhIGZpcnN0IHJlbmRlciBhY3Rpb24gdG8gdGhlIHJlbmRlciB0YXJnZXQsIG9yIGlmIHRoZSByZW5kZXIgdGFyZ2V0IHdhcyBub3RcbiAgICAgICAgICAgIC8vIGZ1bGx5IGNsZWFyZWQgb24gcGFzcyBzdGFydCwgd2UgbmVlZCB0byBleGVjdXRlIGNsZWFycyBoZXJlXG4gICAgICAgICAgICBpZiAoIWZpcnN0UmVuZGVyQWN0aW9uIHx8ICFjYW1lcmEuY2FtZXJhLmZ1bGxTaXplQ2xlYXJSZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhcihyZW5kZXJBY3Rpb24sIGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzb3J0VGltZSA9IG5vdygpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9zb3J0VmlzaWJsZSh0cmFuc3BhcmVudCwgY2FtZXJhLmNhbWVyYS5ub2RlLCBjYW1lcmFQYXNzKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5fc29ydFRpbWUgKz0gbm93KCkgLSBzb3J0VGltZTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIC8vIGFkZCBkZWJ1ZyBtZXNoIGluc3RhbmNlcyB0byB2aXNpYmxlIGxpc3RcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLm9uUHJlUmVuZGVyTGF5ZXIobGF5ZXIsIHZpc2libGUsIHRyYW5zcGFyZW50KTtcblxuICAgICAgICAgICAgLy8gdXBsb2FkIGNsdXN0ZXJlZCBsaWdodHMgdW5pZm9ybXNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycy5hY3RpdmF0ZSh0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAgICAgICAgIC8vIGRlYnVnIHJlbmRlcmluZyBvZiBjbHVzdGVyc1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgJiYgdGhpcy5zY2VuZS5saWdodGluZy5kZWJ1Z0xheWVyID09PSBsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFdvcmxkQ2x1c3RlcnNEZWJ1Zy5yZW5kZXIocmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMsIHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBub3QgdmVyeSBjbGV2ZXIgZ2xvYmFsIHZhcmlhYmxlIHdoaWNoIGlzIG9ubHkgdXNlZnVsIHdoZW4gdGhlcmUncyBqdXN0IG9uZSBjYW1lcmFcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYSA9IGNhbWVyYS5jYW1lcmE7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLmNhbWVyYSwgcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCwgcmVuZGVyQWN0aW9uKTtcblxuICAgICAgICAgICAgLy8gZW5hYmxlIGZsaXAgZmFjZXMgaWYgZWl0aGVyIHRoZSBjYW1lcmEgaGFzIF9mbGlwRmFjZXMgZW5hYmxlZCBvciB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgLy8gaGFzIGZsaXBZIGVuYWJsZWRcbiAgICAgICAgICAgIGNvbnN0IGZsaXBGYWNlcyA9ICEhKGNhbWVyYS5jYW1lcmEuX2ZsaXBGYWNlcyBeIHJlbmRlckFjdGlvbj8ucmVuZGVyVGFyZ2V0Py5mbGlwWSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGRyYXdzID0gdGhpcy5fZm9yd2FyZERyYXdDYWxscztcbiAgICAgICAgICAgIHRoaXMucmVuZGVyRm9yd2FyZChjYW1lcmEuY2FtZXJhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUubGlzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5fc3BsaXRMaWdodHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuc2hhZGVyUGFzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5jdWxsaW5nTWFzayxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5vbkRyYXdDYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyk7XG4gICAgICAgICAgICBsYXllci5fZm9yd2FyZERyYXdDYWxscyArPSB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzIC0gZHJhd3M7XG5cbiAgICAgICAgICAgIC8vIFJldmVydCB0ZW1wIGZyYW1lIHN0dWZmXG4gICAgICAgICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBub3QgYmUgaGVyZSwgYXMgZWFjaCByZW5kZXJpbmcgLyBjbGVhcmluZyBzaG91bGQgZXhwbGljaXRseSBzZXQgdXAgd2hhdFxuICAgICAgICAgICAgLy8gaXQgcmVxdWlyZXMgKHRoZSBwcm9wZXJ0aWVzIGFyZSBwYXJ0IG9mIHJlbmRlciBwaXBlbGluZSBvbiBXZWJHUFUgYW55d2F5cylcbiAgICAgICAgICAgIGRldmljZS5zZXRDb2xvcldyaXRlKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxUZXN0KGZhbHNlKTsgLy8gZG9uJ3QgbGVhayBzdGVuY2lsIHN0YXRlXG4gICAgICAgICAgICBkZXZpY2Uuc2V0QWxwaGFUb0NvdmVyYWdlKGZhbHNlKTsgLy8gZG9uJ3QgbGVhayBhMmMgc3RhdGVcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBvbiB0aGUgY2FtZXJhIGNvbXBvbmVudCB3aGVuIHdlJ3JlIGRvbmUgcmVuZGVyaW5nIGFsbCBsYXllcnMgd2l0aCB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5sYXN0Q2FtZXJhVXNlICYmIGNhbWVyYS5vblBvc3RSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEub25Qb3N0UmVuZGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsIGxheWVyJ3MgcG9zdHJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyT3BhcXVlKGNhbWVyYVBhc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGF5ZXIub25Qb3N0UmVuZGVyICYmICEobGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgJj0gfih0cmFuc3BhcmVudCA/IDIgOiAxKTtcbiAgICAgICAgICAgIGlmIChsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXIoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGxheWVyLl9yZW5kZXJUaW1lICs9IG5vdygpIC0gZHJhd1RpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cbn1cblxuZXhwb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsid2ViZ2wxRGVwdGhDbGVhckNvbG9yIiwiQ29sb3IiLCJfZHJhd0NhbGxMaXN0IiwiZHJhd0NhbGxzIiwiaXNOZXdNYXRlcmlhbCIsImxpZ2h0TWFza0NoYW5nZWQiLCJGb3J3YXJkUmVuZGVyZXIiLCJSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZXZpY2UiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9tYXRlcmlhbFN3aXRjaGVzIiwiX2RlcHRoTWFwVGltZSIsIl9mb3J3YXJkVGltZSIsIl9zb3J0VGltZSIsInNjb3BlIiwiZm9nQ29sb3JJZCIsInJlc29sdmUiLCJmb2dTdGFydElkIiwiZm9nRW5kSWQiLCJmb2dEZW5zaXR5SWQiLCJhbWJpZW50SWQiLCJza3lib3hJbnRlbnNpdHlJZCIsImN1YmVNYXBSb3RhdGlvbk1hdHJpeElkIiwibGlnaHRDb2xvcklkIiwibGlnaHREaXIiLCJsaWdodERpcklkIiwibGlnaHRTaGFkb3dNYXBJZCIsImxpZ2h0U2hhZG93TWF0cml4SWQiLCJsaWdodFNoYWRvd1BhcmFtc0lkIiwibGlnaHRTaGFkb3dJbnRlbnNpdHkiLCJsaWdodFJhZGl1c0lkIiwibGlnaHRQb3MiLCJsaWdodFBvc0lkIiwibGlnaHRXaWR0aCIsImxpZ2h0V2lkdGhJZCIsImxpZ2h0SGVpZ2h0IiwibGlnaHRIZWlnaHRJZCIsImxpZ2h0SW5BbmdsZUlkIiwibGlnaHRPdXRBbmdsZUlkIiwibGlnaHRDb29raWVJZCIsImxpZ2h0Q29va2llSW50SWQiLCJsaWdodENvb2tpZU1hdHJpeElkIiwibGlnaHRDb29raWVPZmZzZXRJZCIsInNoYWRvd01hdHJpeFBhbGV0dGVJZCIsInNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZCIsInNoYWRvd0Nhc2NhZGVDb3VudElkIiwic2NyZWVuU2l6ZUlkIiwiX3NjcmVlblNpemUiLCJGbG9hdDMyQXJyYXkiLCJmb2dDb2xvciIsImFtYmllbnRDb2xvciIsImRlc3Ryb3kiLCJkaXNwYXRjaEdsb2JhbExpZ2h0cyIsInNjZW5lIiwiYW1iaWVudExpZ2h0IiwiciIsImciLCJiIiwiZ2FtbWFDb3JyZWN0aW9uIiwiaSIsIk1hdGgiLCJwb3ciLCJwaHlzaWNhbFVuaXRzIiwiYW1iaWVudEx1bWluYW5jZSIsInNldFZhbHVlIiwic2t5Ym94THVtaW5hbmNlIiwic2t5Ym94SW50ZW5zaXR5IiwiX3NreWJveFJvdGF0aW9uTWF0MyIsImRhdGEiLCJfcmVzb2x2ZUxpZ2h0IiwibGlnaHQiLCJzZXRMVENEaXJlY3Rpb25hbExpZ2h0Iiwid3RtIiwiY250IiwiZGlyIiwiY2FtcG9zIiwiZmFyIiwieCIsInkiLCJ6IiwiaFdpZHRoIiwidHJhbnNmb3JtVmVjdG9yIiwiVmVjMyIsImhIZWlnaHQiLCJkaXNwYXRjaERpcmVjdExpZ2h0cyIsImRpcnMiLCJtYXNrIiwiY2FtZXJhIiwibGVuZ3RoIiwiZGlyZWN0aW9uYWwiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsImdldFkiLCJfZGlyZWN0aW9uIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiZ2V0UG9zaXRpb24iLCJmYXJDbGlwIiwiY2FzdFNoYWRvd3MiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwic2hhZG93QnVmZmVyIiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsIm51bUNhc2NhZGVzIiwic2hhZG93SW50ZW5zaXR5IiwicGFyYW1zIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwibm9ybWFsQmlhcyIsImJpYXMiLCJzZXRMVENQb3NpdGlvbmFsTGlnaHQiLCJkaXNwYXRjaE9tbmlMaWdodCIsIm9tbmkiLCJhdHRlbnVhdGlvbkVuZCIsImdldFRyYW5zbGF0aW9uIiwiX3Bvc2l0aW9uIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsImRpc3BhdGNoU3BvdExpZ2h0Iiwic3BvdCIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImNvb2tpZU1hdHJpeCIsIkxpZ2h0Q2FtZXJhIiwiZXZhbFNwb3RDb29raWVNYXRyaXgiLCJfY29va2llVHJhbnNmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0iLCJ3IiwiX2Nvb2tpZU9mZnNldFVuaWZvcm0iLCJfY29va2llT2Zmc2V0IiwiZGlzcGF0Y2hMb2NhbExpZ2h0cyIsInNvcnRlZExpZ2h0cyIsInVzZWREaXJMaWdodHMiLCJzdGF0aWNMaWdodExpc3QiLCJvbW5pcyIsIkxJR0hUVFlQRV9PTU5JIiwibnVtT21uaXMiLCJpc1N0YXRpYyIsInN0YXRpY0lkIiwiX3R5cGUiLCJzcHRzIiwiTElHSFRUWVBFX1NQT1QiLCJudW1TcHRzIiwicmVuZGVyU2hhZG93c0xvY2FsIiwibGlnaHRzIiwiaXNDbHVzdGVyZWQiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJEZWJ1ZyIsImFzc2VydCIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJhdGxhc1Nsb3RVcGRhdGVkIiwic2hhZG93VXBkYXRlTW9kZSIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsIl9zaGFkb3dSZW5kZXJlckxvY2FsIiwicmVuZGVyIiwicmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMiLCJkcmF3Q2FsbHNDb3VudCIsImN1bGxpbmdNYXNrIiwibGF5ZXIiLCJwYXNzIiwiYWRkQ2FsbCIsImRyYXdDYWxsIiwicHVzaCIsImxpZ2h0SGFzaCIsIl9saWdodEhhc2giLCJwcmV2TWF0ZXJpYWwiLCJwcmV2T2JqRGVmcyIsInByZXZTdGF0aWMiLCJwcmV2TGlnaHRNYXNrIiwiY29tbWFuZCIsInNraXBSZW5kZXJDYW1lcmEiLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJza2lwUmVuZGVyQWZ0ZXIiLCJlbnN1cmVNYXRlcmlhbCIsIm1hdGVyaWFsIiwib2JqRGVmcyIsIl9zaGFkZXJEZWZzIiwibGlnaHRNYXNrIiwiX3NjZW5lIiwiZGlydHkiLCJ1cGRhdGVVbmlmb3JtcyIsIl9kaXJ0eUJsZW5kIiwibGF5ZXJzIiwiX3NoYWRlciIsInZhcmlhbnRLZXkiLCJ2YXJpYW50cyIsInVwZGF0ZVBhc3NTaGFkZXIiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJfc3RhdGljTGlnaHRMaXN0IiwicmVuZGVyRm9yd2FyZEludGVybmFsIiwicHJlcGFyZWRDYWxscyIsImRyYXdDYWxsYmFjayIsImZsaXBGYWNlcyIsInN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMiLCJwYXNzRmxhZyIsInByZXBhcmVkQ2FsbHNDb3VudCIsIm5ld01hdGVyaWFsIiwic2hhZGVyIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiZXJyb3IiLCJuYW1lIiwic2V0UGFyYW1ldGVycyIsImFscGhhVGVzdElkIiwiYWxwaGFUZXN0Iiwic2V0QmxlbmRpbmciLCJibGVuZCIsInNlcGFyYXRlQWxwaGFCbGVuZCIsInNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZSIsImJsZW5kU3JjIiwiYmxlbmREc3QiLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsInNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZSIsImJsZW5kRXF1YXRpb24iLCJibGVuZEFscGhhRXF1YXRpb24iLCJzZXRCbGVuZEZ1bmN0aW9uIiwic2V0QmxlbmRFcXVhdGlvbiIsInNldENvbG9yV3JpdGUiLCJyZWRXcml0ZSIsImdyZWVuV3JpdGUiLCJibHVlV3JpdGUiLCJhbHBoYVdyaXRlIiwic2V0RGVwdGhXcml0ZSIsImRlcHRoV3JpdGUiLCJkZXB0aFRlc3QiLCJzZXREZXB0aEZ1bmMiLCJGVU5DX0FMV0FZUyIsInNldERlcHRoVGVzdCIsImRlcHRoRnVuYyIsInNldEFscGhhVG9Db3ZlcmFnZSIsImFscGhhVG9Db3ZlcmFnZSIsImRlcHRoQmlhcyIsInNsb3BlRGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwic2V0Q3VsbE1vZGUiLCJfY3VsbEZhY2VzIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJzZXRTdGVuY2lsVGVzdCIsInNldFN0ZW5jaWxGdW5jIiwiZnVuYyIsInJlZiIsInJlYWRNYXNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwid3JpdGVNYXNrIiwic2V0U3RlbmNpbEZ1bmNGcm9udCIsInNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udCIsIlNURU5DSUxPUF9LRUVQIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJtZXNoIiwic2V0VmVydGV4QnVmZmVycyIsInNldE1vcnBoaW5nIiwibW9ycGhJbnN0YW5jZSIsInNldFNraW5uaW5nIiwibW9kZWxNYXRyaXhJZCIsIm5vZGUiLCJ3b3JsZFRyYW5zZm9ybSIsIm5vcm1hbE1hdHJpeElkIiwibm9ybWFsTWF0cml4IiwibWVzaEJpbmRHcm91cCIsImdldEJpbmRHcm91cCIsImRlZmF1bHRVbmlmb3JtQnVmZmVyIiwidXBkYXRlIiwic2V0QmluZEdyb3VwIiwiQklOREdST1VQX01FU0giLCJzdHlsZSIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsInhyIiwic2Vzc2lvbiIsInZpZXdzIiwidiIsInZpZXciLCJzZXRWaWV3cG9ydCIsInZpZXdwb3J0IiwicHJvaklkIiwicHJvak1hdCIsInByb2pTa3lib3hJZCIsInZpZXdJZCIsInZpZXdPZmZNYXQiLCJ2aWV3SW52SWQiLCJ2aWV3SW52T2ZmTWF0Iiwidmlld0lkMyIsInZpZXdNYXQzIiwidmlld1Byb2pJZCIsInByb2pWaWV3T2ZmTWF0Iiwidmlld1Bvc0lkIiwicG9zaXRpb24iLCJkcmF3SW5zdGFuY2UiLCJkcmF3SW5zdGFuY2UyIiwicGFyYW1ldGVycyIsInJlbmRlckZvcndhcmQiLCJhbGxEcmF3Q2FsbHMiLCJhbGxEcmF3Q2FsbHNDb3VudCIsImZvcndhcmRTdGFydFRpbWUiLCJub3ciLCJzZXRTY2VuZUNvbnN0YW50cyIsImZvZyIsIkZPR19OT05FIiwiRk9HX0xJTkVBUiIsImZvZ1N0YXJ0IiwiZm9nRW5kIiwiZm9nRGVuc2l0eSIsIndpZHRoIiwiaGVpZ2h0IiwidXBkYXRlTGlnaHRTdGF0cyIsImNvbXAiLCJjb21wVXBkYXRlZEZsYWdzIiwiQ09NUFVQREFURURfTElHSFRTIiwiX3N0YXRzVXBkYXRlZCIsInN0YXRzIiwiX3N0YXRzIiwiX2xpZ2h0cyIsImR5bmFtaWNMaWdodHMiLCJiYWtlZExpZ2h0cyIsImwiLCJlbmFibGVkIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiTUFTS19CQUtFIiwiQ09NUFVQREFURURfSU5TVEFOQ0VTIiwibWVzaEluc3RhbmNlcyIsIl9tZXNoSW5zdGFuY2VzIiwiYnVpbGRGcmFtZUdyYXBoIiwiZnJhbWVHcmFwaCIsImxheWVyQ29tcG9zaXRpb24iLCJyZXNldCIsInVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzIiwicmVuZGVyUGFzcyIsIlJlbmRlclBhc3MiLCJsaWdodGluZyIsImNvb2tpZXNFbmFibGVkIiwicmVuZGVyQ29va2llcyIsIl9zcGxpdExpZ2h0cyIsInJlcXVpcmVzQ3ViZW1hcHMiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJhZGRSZW5kZXJQYXNzIiwic2hhZG93c0VuYWJsZWQiLCJ1cGRhdGVDbHVzdGVycyIsInN0YXJ0SW5kZXgiLCJuZXdTdGFydCIsInJlbmRlclRhcmdldCIsInJlbmRlckFjdGlvbnMiLCJfcmVuZGVyQWN0aW9ucyIsInJlbmRlckFjdGlvbiIsImxheWVyTGlzdCIsImxheWVySW5kZXgiLCJjYW1lcmFzIiwiY2FtZXJhSW5kZXgiLCJpc0xheWVyRW5hYmxlZCIsImlzRGVwdGhMYXllciIsImlkIiwiTEFZRVJJRF9ERVBUSCIsImlzR3JhYlBhc3MiLCJyZW5kZXJTY2VuZUNvbG9yTWFwIiwicmVuZGVyU2NlbmVEZXB0aE1hcCIsImhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzIiwiX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJuZXh0SW5kZXgiLCJuZXh0UmVuZGVyQWN0aW9uIiwiaXNOZXh0TGF5ZXJEZXB0aCIsImlzTmV4dExheWVyR3JhYlBhc3MiLCJhZGRNYWluUmVuZGVyUGFzcyIsInRyaWdnZXJQb3N0cHJvY2VzcyIsIm9uUG9zdHByb2Nlc3NpbmciLCJyZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmciLCJlbmRJbmRleCIsInJhbmdlIiwic3RhcnQiLCJlbmQiLCJyZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyIsInN0YXJ0UmVuZGVyQWN0aW9uIiwic3RhcnRMYXllciIsImdyYWJQYXNzUmVxdWlyZWQiLCJTY2VuZUdyYWIiLCJyZXF1aXJlc1JlbmRlclBhc3MiLCJpc1JlYWxQYXNzIiwiaW5pdCIsImZ1bGxTaXplQ2xlYXJSZWN0Iiwic2V0Q2xlYXJDb2xvciIsInNldENsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInNldENsZWFyU3RlbmNpbCIsImVudGl0eSIsImJhc2VVcGRhdGUiLCJfdXBkYXRlU2t5IiwidXBkYXRlZCIsInVwZGF0ZUxheWVyQ29tcG9zaXRpb24iLCJsaWdodHNDaGFuZ2VkIiwiYmVnaW5GcmFtZSIsImN1bGxDb21wb3NpdGlvbiIsImdwdVVwZGF0ZSIsInJlbmRlclJlbmRlckFjdGlvbiIsImZpcnN0UmVuZGVyQWN0aW9uIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckxpc3QiLCJjYW1lcmFQYXNzIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJkcmF3VGltZSIsImZpcnN0Q2FtZXJhVXNlIiwib25QcmVSZW5kZXIiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQiLCJfcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsInNldHVwVmlld3BvcnQiLCJjbGVhciIsInNvcnRUaW1lIiwiX3NvcnRWaXNpYmxlIiwib2JqZWN0cyIsImluc3RhbmNlcyIsInZpc2libGUiLCJ2aXNpYmxlVHJhbnNwYXJlbnQiLCJ2aXNpYmxlT3BhcXVlIiwiaW1tZWRpYXRlIiwib25QcmVSZW5kZXJMYXllciIsImxpZ2h0Q2x1c3RlcnMiLCJhY3RpdmF0ZSIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkIiwiZGVidWdMYXllciIsIldvcmxkQ2x1c3RlcnNEZWJ1ZyIsIl9hY3RpdmVDYW1lcmEiLCJzZXRDYW1lcmFVbmlmb3JtcyIsIl9mbGlwRmFjZXMiLCJmbGlwWSIsImRyYXdzIiwibGlzdCIsInNoYWRlclBhc3MiLCJvbkRyYXdDYWxsIiwibGFzdENhbWVyYVVzZSIsIm9uUG9zdFJlbmRlciIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlclRyYW5zcGFyZW50IiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwiX3Bvc3RSZW5kZXJDb3VudGVyTWF4IiwicG9wR3B1TWFya2VyIiwiX3JlbmRlclRpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTZCQSxNQUFNQSxxQkFBcUIsR0FBRyxJQUFJQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsRUFBRSxLQUFLLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHLEVBQUUsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFBO0FBRTNGLE1BQU1DLGFBQWEsR0FBRztBQUNsQkMsRUFBQUEsU0FBUyxFQUFFLEVBQUU7QUFDYkMsRUFBQUEsYUFBYSxFQUFFLEVBQUU7QUFDakJDLEVBQUFBLGdCQUFnQixFQUFFLEVBQUE7QUFDdEIsQ0FBQyxDQUFBOztBQU9ELE1BQU1DLGVBQWUsU0FBU0MsUUFBUSxDQUFDO0VBT25DQyxXQUFXLENBQUNDLGNBQWMsRUFBRTtJQUN4QixLQUFLLENBQUNBLGNBQWMsQ0FBQyxDQUFBO0FBRXJCLElBQUEsTUFBTUMsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0lBRTFCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLENBQUMsQ0FBQTtJQUN0QixJQUFJLENBQUNDLFlBQVksR0FBRyxDQUFDLENBQUE7SUFDckIsSUFBSSxDQUFDQyxTQUFTLEdBQUcsQ0FBQyxDQUFBOztBQUdsQixJQUFBLE1BQU1DLEtBQUssR0FBR04sTUFBTSxDQUFDTSxLQUFLLENBQUE7SUFFMUIsSUFBSSxDQUFDQyxVQUFVLEdBQUdELEtBQUssQ0FBQ0UsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFBO0lBQzVDLElBQUksQ0FBQ0MsVUFBVSxHQUFHSCxLQUFLLENBQUNFLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQTtJQUM1QyxJQUFJLENBQUNFLFFBQVEsR0FBR0osS0FBSyxDQUFDRSxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUE7SUFDeEMsSUFBSSxDQUFDRyxZQUFZLEdBQUdMLEtBQUssQ0FBQ0UsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFBO0lBRWhELElBQUksQ0FBQ0ksU0FBUyxHQUFHTixLQUFLLENBQUNFLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO0lBQ3JELElBQUksQ0FBQ0ssaUJBQWlCLEdBQUdQLEtBQUssQ0FBQ0UsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUE7SUFDekQsSUFBSSxDQUFDTSx1QkFBdUIsR0FBR1IsS0FBSyxDQUFDRSxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQTtJQUNyRSxJQUFJLENBQUNPLFlBQVksR0FBRyxFQUFFLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLEVBQUUsQ0FBQTtJQUNwQixJQUFJLENBQUNDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtJQUMxQixJQUFJLENBQUNDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLG9CQUFvQixHQUFHLEVBQUUsQ0FBQTtJQUM5QixJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLEVBQUUsQ0FBQTtJQUNwQixJQUFJLENBQUNDLFVBQVUsR0FBRyxFQUFFLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsRUFBRSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEVBQUUsQ0FBQTtJQUNyQixJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLEVBQUUsQ0FBQTtJQUN6QixJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxFQUFFLENBQUE7SUFDN0IsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxFQUFFLENBQUE7O0lBRzdCLElBQUksQ0FBQ0MscUJBQXFCLEdBQUcsRUFBRSxDQUFBO0lBQy9CLElBQUksQ0FBQ0Msd0JBQXdCLEdBQUcsRUFBRSxDQUFBO0lBQ2xDLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsRUFBRSxDQUFBO0lBRTlCLElBQUksQ0FBQ0MsWUFBWSxHQUFHaEMsS0FBSyxDQUFDRSxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUE7QUFDaEQsSUFBQSxJQUFJLENBQUMrQixXQUFXLEdBQUcsSUFBSUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRXRDLElBQUEsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSUQsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ25DLElBQUEsSUFBSSxDQUFDRSxZQUFZLEdBQUcsSUFBSUYsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNDLEdBQUE7QUFFQUcsRUFBQUEsT0FBTyxHQUFHO0lBQ04sS0FBSyxDQUFDQSxPQUFPLEVBQUUsQ0FBQTtBQUNuQixHQUFBOztFQWNBQyxvQkFBb0IsQ0FBQ0MsS0FBSyxFQUFFO0lBQ3hCLElBQUksQ0FBQ0gsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRyxLQUFLLENBQUNDLFlBQVksQ0FBQ0MsQ0FBQyxDQUFBO0lBQzNDLElBQUksQ0FBQ0wsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRyxLQUFLLENBQUNDLFlBQVksQ0FBQ0UsQ0FBQyxDQUFBO0lBQzNDLElBQUksQ0FBQ04sWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRyxLQUFLLENBQUNDLFlBQVksQ0FBQ0csQ0FBQyxDQUFBO0lBQzNDLElBQUlKLEtBQUssQ0FBQ0ssZUFBZSxFQUFFO01BQ3ZCLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxFQUFFLEVBQUU7QUFDeEIsUUFBQSxJQUFJLENBQUNULFlBQVksQ0FBQ1MsQ0FBQyxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ1gsWUFBWSxDQUFDUyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUM5RCxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUlOLEtBQUssQ0FBQ1MsYUFBYSxFQUFFO01BQ3JCLEtBQUssSUFBSUgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxFQUFFLEVBQUU7UUFDeEIsSUFBSSxDQUFDVCxZQUFZLENBQUNTLENBQUMsQ0FBQyxJQUFJTixLQUFLLENBQUNVLGdCQUFnQixDQUFBO0FBQ2xELE9BQUE7QUFDSixLQUFBO0lBQ0EsSUFBSSxDQUFDM0MsU0FBUyxDQUFDNEMsUUFBUSxDQUFDLElBQUksQ0FBQ2QsWUFBWSxDQUFDLENBQUE7QUFFMUMsSUFBQSxJQUFJLENBQUM3QixpQkFBaUIsQ0FBQzJDLFFBQVEsQ0FBQ1gsS0FBSyxDQUFDUyxhQUFhLEdBQUdULEtBQUssQ0FBQ1ksZUFBZSxHQUFHWixLQUFLLENBQUNhLGVBQWUsQ0FBQyxDQUFBO0lBQ3BHLElBQUksQ0FBQzVDLHVCQUF1QixDQUFDMEMsUUFBUSxDQUFDWCxLQUFLLENBQUNjLG1CQUFtQixDQUFDQyxJQUFJLENBQUMsQ0FBQTtBQUN6RSxHQUFBO0FBRUFDLEVBQUFBLGFBQWEsQ0FBQ3ZELEtBQUssRUFBRTZDLENBQUMsRUFBRTtBQUNwQixJQUFBLE1BQU1XLEtBQUssR0FBRyxPQUFPLEdBQUdYLENBQUMsQ0FBQTtBQUN6QixJQUFBLElBQUksQ0FBQ3BDLFlBQVksQ0FBQ29DLENBQUMsQ0FBQyxHQUFHN0MsS0FBSyxDQUFDRSxPQUFPLENBQUNzRCxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUE7SUFDdEQsSUFBSSxDQUFDOUMsUUFBUSxDQUFDbUMsQ0FBQyxDQUFDLEdBQUcsSUFBSVgsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3RDLElBQUEsSUFBSSxDQUFDdkIsVUFBVSxDQUFDa0MsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxZQUFZLENBQUMsQ0FBQTtBQUN4RCxJQUFBLElBQUksQ0FBQzVDLGdCQUFnQixDQUFDaUMsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxZQUFZLENBQUMsQ0FBQTtBQUM5RCxJQUFBLElBQUksQ0FBQzNDLG1CQUFtQixDQUFDZ0MsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxlQUFlLENBQUMsQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQzFDLG1CQUFtQixDQUFDK0IsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxlQUFlLENBQUMsQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQ3pDLG9CQUFvQixDQUFDOEIsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxDQUFBO0FBQ3hFLElBQUEsSUFBSSxDQUFDeEMsYUFBYSxDQUFDNkIsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQTtJQUN4RCxJQUFJLENBQUN2QyxRQUFRLENBQUM0QixDQUFDLENBQUMsR0FBRyxJQUFJWCxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdEMsSUFBQSxJQUFJLENBQUNoQixVQUFVLENBQUMyQixDQUFDLENBQUMsR0FBRzdDLEtBQUssQ0FBQ0UsT0FBTyxDQUFDc0QsS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFBO0lBQ3ZELElBQUksQ0FBQ3JDLFVBQVUsQ0FBQzBCLENBQUMsQ0FBQyxHQUFHLElBQUlYLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQ2QsWUFBWSxDQUFDeUIsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyxZQUFZLENBQUMsQ0FBQTtJQUMxRCxJQUFJLENBQUNuQyxXQUFXLENBQUN3QixDQUFDLENBQUMsR0FBRyxJQUFJWCxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDekMsSUFBQSxJQUFJLENBQUNaLGFBQWEsQ0FBQ3VCLENBQUMsQ0FBQyxHQUFHN0MsS0FBSyxDQUFDRSxPQUFPLENBQUNzRCxLQUFLLEdBQUcsYUFBYSxDQUFDLENBQUE7QUFDNUQsSUFBQSxJQUFJLENBQUNqQyxjQUFjLENBQUNzQixDQUFDLENBQUMsR0FBRzdDLEtBQUssQ0FBQ0UsT0FBTyxDQUFDc0QsS0FBSyxHQUFHLGlCQUFpQixDQUFDLENBQUE7QUFDakUsSUFBQSxJQUFJLENBQUNoQyxlQUFlLENBQUNxQixDQUFDLENBQUMsR0FBRzdDLEtBQUssQ0FBQ0UsT0FBTyxDQUFDc0QsS0FBSyxHQUFHLGlCQUFpQixDQUFDLENBQUE7QUFDbEUsSUFBQSxJQUFJLENBQUMvQixhQUFhLENBQUNvQixDQUFDLENBQUMsR0FBRzdDLEtBQUssQ0FBQ0UsT0FBTyxDQUFDc0QsS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFBO0FBQ3hELElBQUEsSUFBSSxDQUFDOUIsZ0JBQWdCLENBQUNtQixDQUFDLENBQUMsR0FBRzdDLEtBQUssQ0FBQ0UsT0FBTyxDQUFDc0QsS0FBSyxHQUFHLGtCQUFrQixDQUFDLENBQUE7QUFDcEUsSUFBQSxJQUFJLENBQUM3QixtQkFBbUIsQ0FBQ2tCLENBQUMsQ0FBQyxHQUFHN0MsS0FBSyxDQUFDRSxPQUFPLENBQUNzRCxLQUFLLEdBQUcsZUFBZSxDQUFDLENBQUE7QUFDcEUsSUFBQSxJQUFJLENBQUM1QixtQkFBbUIsQ0FBQ2lCLENBQUMsQ0FBQyxHQUFHN0MsS0FBSyxDQUFDRSxPQUFPLENBQUNzRCxLQUFLLEdBQUcsZUFBZSxDQUFDLENBQUE7O0FBR3BFLElBQUEsSUFBSSxDQUFDM0IscUJBQXFCLENBQUNnQixDQUFDLENBQUMsR0FBRzdDLEtBQUssQ0FBQ0UsT0FBTyxDQUFDc0QsS0FBSyxHQUFHLHlCQUF5QixDQUFDLENBQUE7QUFDaEYsSUFBQSxJQUFJLENBQUMxQix3QkFBd0IsQ0FBQ2UsQ0FBQyxDQUFDLEdBQUc3QyxLQUFLLENBQUNFLE9BQU8sQ0FBQ3NELEtBQUssR0FBRyw0QkFBNEIsQ0FBQyxDQUFBO0FBQ3RGLElBQUEsSUFBSSxDQUFDekIsb0JBQW9CLENBQUNjLENBQUMsQ0FBQyxHQUFHN0MsS0FBSyxDQUFDRSxPQUFPLENBQUNzRCxLQUFLLEdBQUcscUJBQXFCLENBQUMsQ0FBQTtBQUMvRSxHQUFBO0VBRUFDLHNCQUFzQixDQUFDQyxHQUFHLEVBQUVDLEdBQUcsRUFBRUMsR0FBRyxFQUFFQyxNQUFNLEVBQUVDLEdBQUcsRUFBRTtBQUMvQyxJQUFBLElBQUksQ0FBQzdDLFFBQVEsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHRSxNQUFNLENBQUNFLENBQUMsR0FBR0gsR0FBRyxDQUFDRyxDQUFDLEdBQUdELEdBQUcsQ0FBQTtBQUM5QyxJQUFBLElBQUksQ0FBQzdDLFFBQVEsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHRSxNQUFNLENBQUNHLENBQUMsR0FBR0osR0FBRyxDQUFDSSxDQUFDLEdBQUdGLEdBQUcsQ0FBQTtBQUM5QyxJQUFBLElBQUksQ0FBQzdDLFFBQVEsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHRSxNQUFNLENBQUNJLENBQUMsR0FBR0wsR0FBRyxDQUFDSyxDQUFDLEdBQUdILEdBQUcsQ0FBQTtBQUM5QyxJQUFBLElBQUksQ0FBQzVDLFVBQVUsQ0FBQ3lDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMsSUFBSSxDQUFDakMsUUFBUSxDQUFDMEMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVqRCxJQUFBLE1BQU1PLE1BQU0sR0FBR1IsR0FBRyxDQUFDUyxlQUFlLENBQUMsSUFBSUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3hELElBQUEsSUFBSSxDQUFDakQsVUFBVSxDQUFDd0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdPLE1BQU0sQ0FBQ0gsQ0FBQyxHQUFHRCxHQUFHLENBQUE7QUFDeEMsSUFBQSxJQUFJLENBQUMzQyxVQUFVLENBQUN3QyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR08sTUFBTSxDQUFDRixDQUFDLEdBQUdGLEdBQUcsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQzNDLFVBQVUsQ0FBQ3dDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHTyxNQUFNLENBQUNELENBQUMsR0FBR0gsR0FBRyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDMUMsWUFBWSxDQUFDdUMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQyxJQUFJLENBQUMvQixVQUFVLENBQUN3QyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBRXJELElBQUEsTUFBTVUsT0FBTyxHQUFHWCxHQUFHLENBQUNTLGVBQWUsQ0FBQyxJQUFJQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ3hELElBQUEsSUFBSSxDQUFDL0MsV0FBVyxDQUFDc0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdVLE9BQU8sQ0FBQ04sQ0FBQyxHQUFHRCxHQUFHLENBQUE7QUFDMUMsSUFBQSxJQUFJLENBQUN6QyxXQUFXLENBQUNzQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR1UsT0FBTyxDQUFDTCxDQUFDLEdBQUdGLEdBQUcsQ0FBQTtBQUMxQyxJQUFBLElBQUksQ0FBQ3pDLFdBQVcsQ0FBQ3NDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHVSxPQUFPLENBQUNKLENBQUMsR0FBR0gsR0FBRyxDQUFBO0FBQzFDLElBQUEsSUFBSSxDQUFDeEMsYUFBYSxDQUFDcUMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQyxJQUFJLENBQUM3QixXQUFXLENBQUNzQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQzNELEdBQUE7RUFFQVcsb0JBQW9CLENBQUNDLElBQUksRUFBRWhDLEtBQUssRUFBRWlDLElBQUksRUFBRUMsTUFBTSxFQUFFO0lBQzVDLElBQUlkLEdBQUcsR0FBRyxDQUFDLENBQUE7QUFFWCxJQUFBLE1BQU0zRCxLQUFLLEdBQUcsSUFBSSxDQUFDTixNQUFNLENBQUNNLEtBQUssQ0FBQTtBQUUvQixJQUFBLEtBQUssSUFBSTZDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzBCLElBQUksQ0FBQ0csTUFBTSxFQUFFN0IsQ0FBQyxFQUFFLEVBQUU7TUFDbEMsSUFBSSxFQUFFMEIsSUFBSSxDQUFDMUIsQ0FBQyxDQUFDLENBQUMyQixJQUFJLEdBQUdBLElBQUksQ0FBQyxFQUFFLFNBQUE7QUFFNUIsTUFBQSxNQUFNRyxXQUFXLEdBQUdKLElBQUksQ0FBQzFCLENBQUMsQ0FBQyxDQUFBO0FBQzNCLE1BQUEsTUFBTWEsR0FBRyxHQUFHaUIsV0FBVyxDQUFDQyxLQUFLLENBQUNDLGlCQUFpQixFQUFFLENBQUE7QUFFakQsTUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDcEUsWUFBWSxDQUFDa0QsR0FBRyxDQUFDLEVBQUU7QUFDekIsUUFBQSxJQUFJLENBQUNKLGFBQWEsQ0FBQ3ZELEtBQUssRUFBRTJELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLE9BQUE7QUFFQSxNQUFBLElBQUksQ0FBQ2xELFlBQVksQ0FBQ2tELEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNYLEtBQUssQ0FBQ0ssZUFBZSxHQUFHK0IsV0FBVyxDQUFDRyxpQkFBaUIsR0FBR0gsV0FBVyxDQUFDSSxXQUFXLENBQUMsQ0FBQTs7QUFHaEhyQixNQUFBQSxHQUFHLENBQUNzQixJQUFJLENBQUNMLFdBQVcsQ0FBQ00sVUFBVSxDQUFDLENBQUNDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlDUCxNQUFBQSxXQUFXLENBQUNNLFVBQVUsQ0FBQ0UsU0FBUyxFQUFFLENBQUE7QUFDbEMsTUFBQSxJQUFJLENBQUN6RSxRQUFRLENBQUNpRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR2dCLFdBQVcsQ0FBQ00sVUFBVSxDQUFDbEIsQ0FBQyxDQUFBO0FBQ2hELE1BQUEsSUFBSSxDQUFDckQsUUFBUSxDQUFDaUQsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdnQixXQUFXLENBQUNNLFVBQVUsQ0FBQ2pCLENBQUMsQ0FBQTtBQUNoRCxNQUFBLElBQUksQ0FBQ3RELFFBQVEsQ0FBQ2lELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHZ0IsV0FBVyxDQUFDTSxVQUFVLENBQUNoQixDQUFDLENBQUE7QUFDaEQsTUFBQSxJQUFJLENBQUN0RCxVQUFVLENBQUNnRCxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQ3hDLFFBQVEsQ0FBQ2lELEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFakQsTUFBQSxJQUFJZ0IsV0FBVyxDQUFDUyxLQUFLLEtBQUtDLG1CQUFtQixFQUFFO1FBRTNDLElBQUksQ0FBQzVCLHNCQUFzQixDQUFDQyxHQUFHLEVBQUVDLEdBQUcsRUFBRWdCLFdBQVcsQ0FBQ00sVUFBVSxFQUFFUixNQUFNLENBQUNHLEtBQUssQ0FBQ1UsV0FBVyxFQUFFLEVBQUViLE1BQU0sQ0FBQ2MsT0FBTyxDQUFDLENBQUE7QUFDN0csT0FBQTtNQUVBLElBQUlaLFdBQVcsQ0FBQ2EsV0FBVyxFQUFFO1FBRXpCLE1BQU1DLGVBQWUsR0FBR2QsV0FBVyxDQUFDZSxhQUFhLENBQUNqQixNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDNUQsUUFBQSxNQUFNa0IsTUFBTSxHQUFHaEIsV0FBVyxDQUFDaUIscUJBQXFCLENBQUNILGVBQWUsQ0FBQyxDQUFBO1FBRWpFLElBQUksQ0FBQzdFLGdCQUFnQixDQUFDK0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3VDLGVBQWUsQ0FBQ0ksWUFBWSxDQUFDLENBQUE7QUFDakUsUUFBQSxJQUFJLENBQUNoRixtQkFBbUIsQ0FBQzhDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN1QyxlQUFlLENBQUNLLFlBQVksQ0FBQ3hDLElBQUksQ0FBQyxDQUFBO1FBRXpFLElBQUksQ0FBQ3pCLHFCQUFxQixDQUFDOEIsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3lCLFdBQVcsQ0FBQ29CLG9CQUFvQixDQUFDLENBQUE7UUFDMUUsSUFBSSxDQUFDakUsd0JBQXdCLENBQUM2QixHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDeUIsV0FBVyxDQUFDcUIsdUJBQXVCLENBQUMsQ0FBQTtRQUNoRixJQUFJLENBQUNqRSxvQkFBb0IsQ0FBQzRCLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN5QixXQUFXLENBQUNzQixXQUFXLENBQUMsQ0FBQTtRQUNoRSxJQUFJLENBQUNsRixvQkFBb0IsQ0FBQzRDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN5QixXQUFXLENBQUN1QixlQUFlLENBQUMsQ0FBQTtBQUVwRSxRQUFBLE1BQU1DLE1BQU0sR0FBR3hCLFdBQVcsQ0FBQ3lCLG1CQUFtQixDQUFBO1FBQzlDRCxNQUFNLENBQUN6QixNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCeUIsUUFBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHeEIsV0FBVyxDQUFDMEIsaUJBQWlCLENBQUE7QUFDekNGLFFBQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR1IsTUFBTSxDQUFDVyxVQUFVLENBQUE7QUFDN0JILFFBQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR1IsTUFBTSxDQUFDWSxJQUFJLENBQUE7UUFDdkIsSUFBSSxDQUFDekYsbUJBQW1CLENBQUM2QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDaUQsTUFBTSxDQUFDLENBQUE7QUFDbEQsT0FBQTtBQUNBeEMsTUFBQUEsR0FBRyxFQUFFLENBQUE7QUFDVCxLQUFBO0FBQ0EsSUFBQSxPQUFPQSxHQUFHLENBQUE7QUFDZCxHQUFBO0FBRUE2QyxFQUFBQSxxQkFBcUIsQ0FBQzlDLEdBQUcsRUFBRUMsR0FBRyxFQUFFO0FBQzVCLElBQUEsTUFBTU8sTUFBTSxHQUFHUixHQUFHLENBQUNTLGVBQWUsQ0FBQyxJQUFJQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDeEQsSUFBSSxDQUFDakQsVUFBVSxDQUFDd0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdPLE1BQU0sQ0FBQ0gsQ0FBQyxDQUFBO0lBQ2xDLElBQUksQ0FBQzVDLFVBQVUsQ0FBQ3dDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHTyxNQUFNLENBQUNGLENBQUMsQ0FBQTtJQUNsQyxJQUFJLENBQUM3QyxVQUFVLENBQUN3QyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR08sTUFBTSxDQUFDRCxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJLENBQUM3QyxZQUFZLENBQUN1QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQy9CLFVBQVUsQ0FBQ3dDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFckQsSUFBQSxNQUFNVSxPQUFPLEdBQUdYLEdBQUcsQ0FBQ1MsZUFBZSxDQUFDLElBQUlDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFDeEQsSUFBSSxDQUFDL0MsV0FBVyxDQUFDc0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdVLE9BQU8sQ0FBQ04sQ0FBQyxDQUFBO0lBQ3BDLElBQUksQ0FBQzFDLFdBQVcsQ0FBQ3NDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHVSxPQUFPLENBQUNMLENBQUMsQ0FBQTtJQUNwQyxJQUFJLENBQUMzQyxXQUFXLENBQUNzQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR1UsT0FBTyxDQUFDSixDQUFDLENBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUMzQyxhQUFhLENBQUNxQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQzdCLFdBQVcsQ0FBQ3NDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDM0QsR0FBQTtFQUVBOEMsaUJBQWlCLENBQUNsRSxLQUFLLEVBQUV2QyxLQUFLLEVBQUUwRyxJQUFJLEVBQUUvQyxHQUFHLEVBQUU7QUFDdkMsSUFBQSxNQUFNRCxHQUFHLEdBQUdnRCxJQUFJLENBQUM5QixLQUFLLENBQUNDLGlCQUFpQixFQUFFLENBQUE7QUFFMUMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDcEUsWUFBWSxDQUFDa0QsR0FBRyxDQUFDLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNKLGFBQWEsQ0FBQ3ZELEtBQUssRUFBRTJELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7SUFFQSxJQUFJLENBQUMzQyxhQUFhLENBQUMyQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDd0QsSUFBSSxDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUNyRCxJQUFBLElBQUksQ0FBQ2xHLFlBQVksQ0FBQ2tELEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUNYLEtBQUssQ0FBQ0ssZUFBZSxHQUFHOEQsSUFBSSxDQUFDNUIsaUJBQWlCLEdBQUc0QixJQUFJLENBQUMzQixXQUFXLENBQUMsQ0FBQTtBQUNsR3JCLElBQUFBLEdBQUcsQ0FBQ2tELGNBQWMsQ0FBQ0YsSUFBSSxDQUFDRyxTQUFTLENBQUMsQ0FBQTtBQUNsQyxJQUFBLElBQUksQ0FBQzVGLFFBQVEsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHK0MsSUFBSSxDQUFDRyxTQUFTLENBQUM5QyxDQUFDLENBQUE7QUFDeEMsSUFBQSxJQUFJLENBQUM5QyxRQUFRLENBQUMwQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRytDLElBQUksQ0FBQ0csU0FBUyxDQUFDN0MsQ0FBQyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDL0MsUUFBUSxDQUFDMEMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcrQyxJQUFJLENBQUNHLFNBQVMsQ0FBQzVDLENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQy9DLFVBQVUsQ0FBQ3lDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMsSUFBSSxDQUFDakMsUUFBUSxDQUFDMEMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVqRCxJQUFBLElBQUkrQyxJQUFJLENBQUN0QixLQUFLLEtBQUtDLG1CQUFtQixFQUFFO0FBRXBDLE1BQUEsSUFBSSxDQUFDbUIscUJBQXFCLENBQUM5QyxHQUFHLEVBQUVDLEdBQUcsQ0FBQyxDQUFBO0FBQ3hDLEtBQUE7SUFFQSxJQUFJK0MsSUFBSSxDQUFDbEIsV0FBVyxFQUFFO01BR2xCLE1BQU1DLGVBQWUsR0FBR2lCLElBQUksQ0FBQ2hCLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFDbkQsSUFBSSxDQUFDOUUsZ0JBQWdCLENBQUMrQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDdUMsZUFBZSxDQUFDSSxZQUFZLENBQUMsQ0FBQTtBQUVqRSxNQUFBLE1BQU1GLE1BQU0sR0FBR2UsSUFBSSxDQUFDZCxxQkFBcUIsQ0FBQ0gsZUFBZSxDQUFDLENBQUE7QUFDMUQsTUFBQSxNQUFNVSxNQUFNLEdBQUdPLElBQUksQ0FBQ04sbUJBQW1CLENBQUE7TUFDdkNELE1BQU0sQ0FBQ3pCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDakJ5QixNQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUdPLElBQUksQ0FBQ0wsaUJBQWlCLENBQUE7QUFDbENGLE1BQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR1IsTUFBTSxDQUFDVyxVQUFVLENBQUE7QUFDN0JILE1BQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR1IsTUFBTSxDQUFDWSxJQUFJLENBQUE7TUFDdkJKLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUdPLElBQUksQ0FBQ0MsY0FBYyxDQUFBO01BQ3JDLElBQUksQ0FBQzdGLG1CQUFtQixDQUFDNkMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ2lELE1BQU0sQ0FBQyxDQUFBO01BQzlDLElBQUksQ0FBQ3BGLG9CQUFvQixDQUFDNEMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3dELElBQUksQ0FBQ1IsZUFBZSxDQUFDLENBQUE7QUFDakUsS0FBQTtJQUNBLElBQUlRLElBQUksQ0FBQ0ksT0FBTyxFQUFFO01BQ2QsSUFBSSxDQUFDckYsYUFBYSxDQUFDa0MsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3dELElBQUksQ0FBQ0ksT0FBTyxDQUFDLENBQUE7TUFDOUMsSUFBSSxDQUFDakcsbUJBQW1CLENBQUM4QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDUSxHQUFHLENBQUNKLElBQUksQ0FBQyxDQUFBO01BQ2hELElBQUksQ0FBQzVCLGdCQUFnQixDQUFDaUMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ3dELElBQUksQ0FBQ0ssZUFBZSxDQUFDLENBQUE7QUFDN0QsS0FBQTtBQUNKLEdBQUE7RUFFQUMsaUJBQWlCLENBQUN6RSxLQUFLLEVBQUV2QyxLQUFLLEVBQUVpSCxJQUFJLEVBQUV0RCxHQUFHLEVBQUU7QUFDdkMsSUFBQSxNQUFNRCxHQUFHLEdBQUd1RCxJQUFJLENBQUNyQyxLQUFLLENBQUNDLGlCQUFpQixFQUFFLENBQUE7QUFFMUMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDcEUsWUFBWSxDQUFDa0QsR0FBRyxDQUFDLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNKLGFBQWEsQ0FBQ3ZELEtBQUssRUFBRTJELEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7SUFFQSxJQUFJLENBQUNwQyxjQUFjLENBQUNvQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDK0QsSUFBSSxDQUFDQyxrQkFBa0IsQ0FBQyxDQUFBO0lBQzFELElBQUksQ0FBQzFGLGVBQWUsQ0FBQ21DLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMrRCxJQUFJLENBQUNFLGtCQUFrQixDQUFDLENBQUE7SUFDM0QsSUFBSSxDQUFDbkcsYUFBYSxDQUFDMkMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQytELElBQUksQ0FBQ04sY0FBYyxDQUFDLENBQUE7QUFDckQsSUFBQSxJQUFJLENBQUNsRyxZQUFZLENBQUNrRCxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDWCxLQUFLLENBQUNLLGVBQWUsR0FBR3FFLElBQUksQ0FBQ25DLGlCQUFpQixHQUFHbUMsSUFBSSxDQUFDbEMsV0FBVyxDQUFDLENBQUE7QUFDbEdyQixJQUFBQSxHQUFHLENBQUNrRCxjQUFjLENBQUNLLElBQUksQ0FBQ0osU0FBUyxDQUFDLENBQUE7QUFDbEMsSUFBQSxJQUFJLENBQUM1RixRQUFRLENBQUMwQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR3NELElBQUksQ0FBQ0osU0FBUyxDQUFDOUMsQ0FBQyxDQUFBO0FBQ3hDLElBQUEsSUFBSSxDQUFDOUMsUUFBUSxDQUFDMEMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdzRCxJQUFJLENBQUNKLFNBQVMsQ0FBQzdDLENBQUMsQ0FBQTtBQUN4QyxJQUFBLElBQUksQ0FBQy9DLFFBQVEsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHc0QsSUFBSSxDQUFDSixTQUFTLENBQUM1QyxDQUFDLENBQUE7QUFDeEMsSUFBQSxJQUFJLENBQUMvQyxVQUFVLENBQUN5QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQ2pDLFFBQVEsQ0FBQzBDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFFakQsSUFBQSxJQUFJc0QsSUFBSSxDQUFDN0IsS0FBSyxLQUFLQyxtQkFBbUIsRUFBRTtBQUVwQyxNQUFBLElBQUksQ0FBQ21CLHFCQUFxQixDQUFDOUMsR0FBRyxFQUFFQyxHQUFHLENBQUMsQ0FBQTtBQUN4QyxLQUFBOztBQUdBRCxJQUFBQSxHQUFHLENBQUNzQixJQUFJLENBQUNpQyxJQUFJLENBQUNoQyxVQUFVLENBQUMsQ0FBQ0MsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkMrQixJQUFBQSxJQUFJLENBQUNoQyxVQUFVLENBQUNFLFNBQVMsRUFBRSxDQUFBO0FBQzNCLElBQUEsSUFBSSxDQUFDekUsUUFBUSxDQUFDaUQsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdzRCxJQUFJLENBQUNoQyxVQUFVLENBQUNsQixDQUFDLENBQUE7QUFDekMsSUFBQSxJQUFJLENBQUNyRCxRQUFRLENBQUNpRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR3NELElBQUksQ0FBQ2hDLFVBQVUsQ0FBQ2pCLENBQUMsQ0FBQTtBQUN6QyxJQUFBLElBQUksQ0FBQ3RELFFBQVEsQ0FBQ2lELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHc0QsSUFBSSxDQUFDaEMsVUFBVSxDQUFDaEIsQ0FBQyxDQUFBO0FBQ3pDLElBQUEsSUFBSSxDQUFDdEQsVUFBVSxDQUFDZ0QsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQyxJQUFJLENBQUN4QyxRQUFRLENBQUNpRCxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBRWpELElBQUlzRCxJQUFJLENBQUN6QixXQUFXLEVBQUU7TUFHbEIsTUFBTUMsZUFBZSxHQUFHd0IsSUFBSSxDQUFDdkIsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQTtNQUNuRCxJQUFJLENBQUM5RSxnQkFBZ0IsQ0FBQytDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUN1QyxlQUFlLENBQUNJLFlBQVksQ0FBQyxDQUFBO0FBRWpFLE1BQUEsSUFBSSxDQUFDaEYsbUJBQW1CLENBQUM4QyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDdUMsZUFBZSxDQUFDSyxZQUFZLENBQUN4QyxJQUFJLENBQUMsQ0FBQTtBQUV6RSxNQUFBLE1BQU1xQyxNQUFNLEdBQUdzQixJQUFJLENBQUNyQixxQkFBcUIsQ0FBQ0gsZUFBZSxDQUFDLENBQUE7QUFDMUQsTUFBQSxNQUFNVSxNQUFNLEdBQUdjLElBQUksQ0FBQ2IsbUJBQW1CLENBQUE7TUFDdkNELE1BQU0sQ0FBQ3pCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDakJ5QixNQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUdjLElBQUksQ0FBQ1osaUJBQWlCLENBQUE7QUFDbENGLE1BQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR1IsTUFBTSxDQUFDVyxVQUFVLENBQUE7QUFDN0JILE1BQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBR1IsTUFBTSxDQUFDWSxJQUFJLENBQUE7TUFDdkJKLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUdjLElBQUksQ0FBQ04sY0FBYyxDQUFBO01BQ3JDLElBQUksQ0FBQzdGLG1CQUFtQixDQUFDNkMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ2lELE1BQU0sQ0FBQyxDQUFBO01BQzlDLElBQUksQ0FBQ3BGLG9CQUFvQixDQUFDNEMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQytELElBQUksQ0FBQ2YsZUFBZSxDQUFDLENBQUE7QUFDakUsS0FBQTtJQUVBLElBQUllLElBQUksQ0FBQ0gsT0FBTyxFQUFFO0FBR2QsTUFBQSxJQUFJLENBQUNHLElBQUksQ0FBQ3pCLFdBQVcsRUFBRTtBQUNuQixRQUFBLE1BQU00QixZQUFZLEdBQUdDLFdBQVcsQ0FBQ0Msb0JBQW9CLENBQUNMLElBQUksQ0FBQyxDQUFBO1FBQzNELElBQUksQ0FBQ3BHLG1CQUFtQixDQUFDOEMsR0FBRyxDQUFDLENBQUNULFFBQVEsQ0FBQ2tFLFlBQVksQ0FBQzlELElBQUksQ0FBQyxDQUFBO0FBQzdELE9BQUE7TUFFQSxJQUFJLENBQUM3QixhQUFhLENBQUNrQyxHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDK0QsSUFBSSxDQUFDSCxPQUFPLENBQUMsQ0FBQTtNQUM5QyxJQUFJLENBQUNwRixnQkFBZ0IsQ0FBQ2lDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMrRCxJQUFJLENBQUNGLGVBQWUsQ0FBQyxDQUFBO01BQ3pELElBQUlFLElBQUksQ0FBQ00sZ0JBQWdCLEVBQUU7UUFDdkJOLElBQUksQ0FBQ08sdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEdBQUdQLElBQUksQ0FBQ00sZ0JBQWdCLENBQUN4RCxDQUFDLENBQUE7UUFDekRrRCxJQUFJLENBQUNPLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxHQUFHUCxJQUFJLENBQUNNLGdCQUFnQixDQUFDdkQsQ0FBQyxDQUFBO1FBQ3pEaUQsSUFBSSxDQUFDTyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsR0FBR1AsSUFBSSxDQUFDTSxnQkFBZ0IsQ0FBQ3RELENBQUMsQ0FBQTtRQUN6RGdELElBQUksQ0FBQ08sdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEdBQUdQLElBQUksQ0FBQ00sZ0JBQWdCLENBQUNFLENBQUMsQ0FBQTtRQUN6RCxJQUFJLENBQUM5RixtQkFBbUIsQ0FBQ2dDLEdBQUcsQ0FBQyxDQUFDVCxRQUFRLENBQUMrRCxJQUFJLENBQUNPLHVCQUF1QixDQUFDLENBQUE7UUFDcEVQLElBQUksQ0FBQ1Msb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEdBQUdULElBQUksQ0FBQ1UsYUFBYSxDQUFDNUQsQ0FBQyxDQUFBO1FBQ25Ea0QsSUFBSSxDQUFDUyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsR0FBR1QsSUFBSSxDQUFDVSxhQUFhLENBQUMzRCxDQUFDLENBQUE7UUFDbkQsSUFBSSxDQUFDcEMsbUJBQW1CLENBQUMrQixHQUFHLENBQUMsQ0FBQ1QsUUFBUSxDQUFDK0QsSUFBSSxDQUFDUyxvQkFBb0IsQ0FBQyxDQUFBO0FBQ3JFLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtFQUVBRSxtQkFBbUIsQ0FBQ0MsWUFBWSxFQUFFdEYsS0FBSyxFQUFFaUMsSUFBSSxFQUFFc0QsYUFBYSxFQUFFQyxlQUFlLEVBQUU7SUFFM0UsSUFBSXBFLEdBQUcsR0FBR21FLGFBQWEsQ0FBQTtBQUN2QixJQUFBLE1BQU05SCxLQUFLLEdBQUcsSUFBSSxDQUFDTixNQUFNLENBQUNNLEtBQUssQ0FBQTtBQUUvQixJQUFBLE1BQU1nSSxLQUFLLEdBQUdILFlBQVksQ0FBQ0ksY0FBYyxDQUFDLENBQUE7QUFDMUMsSUFBQSxNQUFNQyxRQUFRLEdBQUdGLEtBQUssQ0FBQ3RELE1BQU0sQ0FBQTtJQUM3QixLQUFLLElBQUk3QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdxRixRQUFRLEVBQUVyRixDQUFDLEVBQUUsRUFBRTtBQUMvQixNQUFBLE1BQU02RCxJQUFJLEdBQUdzQixLQUFLLENBQUNuRixDQUFDLENBQUMsQ0FBQTtBQUNyQixNQUFBLElBQUksRUFBRTZELElBQUksQ0FBQ2xDLElBQUksR0FBR0EsSUFBSSxDQUFDLEVBQUUsU0FBQTtNQUN6QixJQUFJa0MsSUFBSSxDQUFDeUIsUUFBUSxFQUFFLFNBQUE7TUFDbkIsSUFBSSxDQUFDMUIsaUJBQWlCLENBQUNsRSxLQUFLLEVBQUV2QyxLQUFLLEVBQUUwRyxJQUFJLEVBQUUvQyxHQUFHLENBQUMsQ0FBQTtBQUMvQ0EsTUFBQUEsR0FBRyxFQUFFLENBQUE7QUFDVCxLQUFBO0lBRUEsSUFBSXlFLFFBQVEsR0FBRyxDQUFDLENBQUE7QUFDaEIsSUFBQSxJQUFJTCxlQUFlLEVBQUU7QUFDakIsTUFBQSxJQUFJckIsSUFBSSxHQUFHcUIsZUFBZSxDQUFDSyxRQUFRLENBQUMsQ0FBQTtBQUNwQyxNQUFBLE9BQU8xQixJQUFJLElBQUlBLElBQUksQ0FBQzJCLEtBQUssS0FBS0osY0FBYyxFQUFFO1FBQzFDLElBQUksQ0FBQ3hCLGlCQUFpQixDQUFDbEUsS0FBSyxFQUFFdkMsS0FBSyxFQUFFMEcsSUFBSSxFQUFFL0MsR0FBRyxDQUFDLENBQUE7QUFDL0NBLFFBQUFBLEdBQUcsRUFBRSxDQUFBO0FBQ0x5RSxRQUFBQSxRQUFRLEVBQUUsQ0FBQTtBQUNWMUIsUUFBQUEsSUFBSSxHQUFHcUIsZUFBZSxDQUFDSyxRQUFRLENBQUMsQ0FBQTtBQUNwQyxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsTUFBTUUsSUFBSSxHQUFHVCxZQUFZLENBQUNVLGNBQWMsQ0FBQyxDQUFBO0FBQ3pDLElBQUEsTUFBTUMsT0FBTyxHQUFHRixJQUFJLENBQUM1RCxNQUFNLENBQUE7SUFDM0IsS0FBSyxJQUFJN0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMkYsT0FBTyxFQUFFM0YsQ0FBQyxFQUFFLEVBQUU7QUFDOUIsTUFBQSxNQUFNb0UsSUFBSSxHQUFHcUIsSUFBSSxDQUFDekYsQ0FBQyxDQUFDLENBQUE7QUFDcEIsTUFBQSxJQUFJLEVBQUVvRSxJQUFJLENBQUN6QyxJQUFJLEdBQUdBLElBQUksQ0FBQyxFQUFFLFNBQUE7TUFDekIsSUFBSXlDLElBQUksQ0FBQ2tCLFFBQVEsRUFBRSxTQUFBO01BQ25CLElBQUksQ0FBQ25CLGlCQUFpQixDQUFDekUsS0FBSyxFQUFFdkMsS0FBSyxFQUFFaUgsSUFBSSxFQUFFdEQsR0FBRyxDQUFDLENBQUE7QUFDL0NBLE1BQUFBLEdBQUcsRUFBRSxDQUFBO0FBQ1QsS0FBQTtBQUVBLElBQUEsSUFBSW9FLGVBQWUsRUFBRTtBQUNqQixNQUFBLElBQUlkLElBQUksR0FBR2MsZUFBZSxDQUFDSyxRQUFRLENBQUMsQ0FBQTtBQUNwQyxNQUFBLE9BQU9uQixJQUFJLElBQUlBLElBQUksQ0FBQ29CLEtBQUssS0FBS0UsY0FBYyxFQUFFO1FBQzFDLElBQUksQ0FBQ3ZCLGlCQUFpQixDQUFDekUsS0FBSyxFQUFFdkMsS0FBSyxFQUFFaUgsSUFBSSxFQUFFdEQsR0FBRyxDQUFDLENBQUE7QUFDL0NBLFFBQUFBLEdBQUcsRUFBRSxDQUFBO0FBQ0x5RSxRQUFBQSxRQUFRLEVBQUUsQ0FBQTtBQUNWbkIsUUFBQUEsSUFBSSxHQUFHYyxlQUFlLENBQUNLLFFBQVEsQ0FBQyxDQUFBO0FBQ3BDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBSyxFQUFBQSxrQkFBa0IsQ0FBQ0MsTUFBTSxFQUFFakUsTUFBTSxFQUFFO0FBRS9CLElBQUEsTUFBTWtFLFdBQVcsR0FBRyxJQUFJLENBQUNwRyxLQUFLLENBQUNxRyx3QkFBd0IsQ0FBQTtBQUV2RCxJQUFBLEtBQUssSUFBSS9GLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzZGLE1BQU0sQ0FBQ2hFLE1BQU0sRUFBRTdCLENBQUMsRUFBRSxFQUFFO0FBQ3BDLE1BQUEsTUFBTVcsS0FBSyxHQUFHa0YsTUFBTSxDQUFDN0YsQ0FBQyxDQUFDLENBQUE7TUFDdkJnRyxLQUFLLENBQUNDLE1BQU0sQ0FBQ3RGLEtBQUssQ0FBQzZFLEtBQUssS0FBS1UscUJBQXFCLENBQUMsQ0FBQTtBQUVuRCxNQUFBLElBQUlKLFdBQVcsRUFBRTtBQUdiLFFBQUEsSUFBSSxDQUFDbkYsS0FBSyxDQUFDd0Ysc0JBQXNCLEVBQUU7QUFDL0IsVUFBQSxTQUFBO0FBQ0osU0FBQTs7UUFHQSxJQUFJeEYsS0FBSyxDQUFDeUYsZ0JBQWdCLElBQUl6RixLQUFLLENBQUMwRixnQkFBZ0IsS0FBS0MsaUJBQWlCLEVBQUU7VUFDeEUzRixLQUFLLENBQUMwRixnQkFBZ0IsR0FBR0Usc0JBQXNCLENBQUE7QUFDbkQsU0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJLENBQUNDLG9CQUFvQixDQUFDQyxNQUFNLENBQUM5RixLQUFLLEVBQUVpQixNQUFNLENBQUMsQ0FBQTtBQUNuRCxLQUFBO0FBQ0osR0FBQTs7QUFNQThFLEVBQUFBLDZCQUE2QixDQUFDOUUsTUFBTSxFQUFFdEYsU0FBUyxFQUFFcUssY0FBYyxFQUFFM0IsWUFBWSxFQUFFNEIsV0FBVyxFQUFFQyxLQUFLLEVBQUVDLElBQUksRUFBRTtJQUVyRyxNQUFNQyxPQUFPLEdBQUcsQ0FBQ0MsUUFBUSxFQUFFekssYUFBYSxFQUFFQyxnQkFBZ0IsS0FBSztBQUMzREgsTUFBQUEsYUFBYSxDQUFDQyxTQUFTLENBQUMySyxJQUFJLENBQUNELFFBQVEsQ0FBQyxDQUFBO0FBQ3RDM0ssTUFBQUEsYUFBYSxDQUFDRSxhQUFhLENBQUMwSyxJQUFJLENBQUMxSyxhQUFhLENBQUMsQ0FBQTtBQUMvQ0YsTUFBQUEsYUFBYSxDQUFDRyxnQkFBZ0IsQ0FBQ3lLLElBQUksQ0FBQ3pLLGdCQUFnQixDQUFDLENBQUE7S0FDeEQsQ0FBQTs7QUFHREgsSUFBQUEsYUFBYSxDQUFDQyxTQUFTLENBQUN1RixNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ2xDeEYsSUFBQUEsYUFBYSxDQUFDRSxhQUFhLENBQUNzRixNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ3RDeEYsSUFBQUEsYUFBYSxDQUFDRyxnQkFBZ0IsQ0FBQ3FGLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFFekMsSUFBQSxNQUFNaEYsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0FBQzFCLElBQUEsTUFBTTZDLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQTtJQUN4QixNQUFNd0gsU0FBUyxHQUFHTCxLQUFLLEdBQUdBLEtBQUssQ0FBQ00sVUFBVSxHQUFHLENBQUMsQ0FBQTtJQUM5QyxJQUFJQyxZQUFZLEdBQUcsSUFBSTtNQUFFQyxXQUFXO01BQUVDLFVBQVU7TUFBRUMsYUFBYSxDQUFBO0lBRS9ELEtBQUssSUFBSXZILENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzJHLGNBQWMsRUFBRTNHLENBQUMsRUFBRSxFQUFFO0FBR3JDLE1BQUEsTUFBTWdILFFBQVEsR0FBRzFLLFNBQVMsQ0FBQzBELENBQUMsQ0FBQyxDQUFBOztBQUc3QixNQUFBLElBQUk0RyxXQUFXLElBQUlJLFFBQVEsQ0FBQ3JGLElBQUksSUFBSSxFQUFFaUYsV0FBVyxHQUFHSSxRQUFRLENBQUNyRixJQUFJLENBQUMsRUFDOUQsU0FBQTtNQUVKLElBQUlxRixRQUFRLENBQUNRLE9BQU8sRUFBRTtBQUVsQlQsUUFBQUEsT0FBTyxDQUFDQyxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFBO0FBRW5DLE9BQUMsTUFBTTtBQUdILFFBQUEsSUFBSXBGLE1BQU0sS0FBS25GLGVBQWUsQ0FBQ2dMLGdCQUFnQixFQUFFO0FBQzdDLFVBQUEsSUFBSWhMLGVBQWUsQ0FBQ2lMLGtCQUFrQixJQUFJakwsZUFBZSxDQUFDa0wsZUFBZSxFQUNyRSxTQUFBO1VBQ0psTCxlQUFlLENBQUNpTCxrQkFBa0IsRUFBRSxDQUFBO0FBQ3hDLFNBQUE7QUFDQSxRQUFBLElBQUliLEtBQUssRUFBRTtBQUNQLFVBQUEsSUFBSUEsS0FBSyxDQUFDYSxrQkFBa0IsSUFBSWIsS0FBSyxDQUFDYyxlQUFlLEVBQ2pELFNBQUE7VUFDSmQsS0FBSyxDQUFDYSxrQkFBa0IsRUFBRSxDQUFBO0FBQzlCLFNBQUE7QUFHQVYsUUFBQUEsUUFBUSxDQUFDWSxjQUFjLENBQUMvSyxNQUFNLENBQUMsQ0FBQTtBQUMvQixRQUFBLE1BQU1nTCxRQUFRLEdBQUdiLFFBQVEsQ0FBQ2EsUUFBUSxDQUFBO0FBRWxDLFFBQUEsTUFBTUMsT0FBTyxHQUFHZCxRQUFRLENBQUNlLFdBQVcsQ0FBQTtBQUNwQyxRQUFBLE1BQU1DLFNBQVMsR0FBR2hCLFFBQVEsQ0FBQ3JGLElBQUksQ0FBQTtRQUUvQixJQUFJa0csUUFBUSxJQUFJQSxRQUFRLEtBQUtULFlBQVksSUFBSVUsT0FBTyxLQUFLVCxXQUFXLEVBQUU7QUFDbEVELFVBQUFBLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDdkIsU0FBQTs7QUFFQSxRQUFBLElBQUlKLFFBQVEsQ0FBQzFCLFFBQVEsSUFBSWdDLFVBQVUsRUFBRTtBQUNqQ0YsVUFBQUEsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUN2QixTQUFBO1FBRUEsSUFBSVMsUUFBUSxLQUFLVCxZQUFZLEVBQUU7VUFDM0IsSUFBSSxDQUFDckssaUJBQWlCLEVBQUUsQ0FBQTtVQUN4QjhLLFFBQVEsQ0FBQ0ksTUFBTSxHQUFHdkksS0FBSyxDQUFBO1VBRXZCLElBQUltSSxRQUFRLENBQUNLLEtBQUssRUFBRTtBQUNoQkwsWUFBQUEsUUFBUSxDQUFDTSxjQUFjLENBQUN0TCxNQUFNLEVBQUU2QyxLQUFLLENBQUMsQ0FBQTtZQUN0Q21JLFFBQVEsQ0FBQ0ssS0FBSyxHQUFHLEtBQUssQ0FBQTtBQUMxQixXQUFBOztVQUdBLElBQUlMLFFBQVEsQ0FBQ08sV0FBVyxFQUFFO0FBQ3RCMUksWUFBQUEsS0FBSyxDQUFDMkksTUFBTSxDQUFDRCxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQ25DLFdBQUE7QUFDSixTQUFBO0FBRUEsUUFBQSxJQUFJLENBQUNwQixRQUFRLENBQUNzQixPQUFPLENBQUN4QixJQUFJLENBQUMsSUFBSUUsUUFBUSxDQUFDZSxXQUFXLEtBQUtELE9BQU8sSUFBSWQsUUFBUSxDQUFDRyxVQUFVLEtBQUtELFNBQVMsRUFBRTtBQUlsRyxVQUFBLElBQUksQ0FBQ0YsUUFBUSxDQUFDMUIsUUFBUSxFQUFFO1lBQ3BCLE1BQU1pRCxVQUFVLEdBQUd6QixJQUFJLEdBQUcsR0FBRyxHQUFHZ0IsT0FBTyxHQUFHLEdBQUcsR0FBR1osU0FBUyxDQUFBO1lBQ3pERixRQUFRLENBQUNzQixPQUFPLENBQUN4QixJQUFJLENBQUMsR0FBR2UsUUFBUSxDQUFDVyxRQUFRLENBQUNELFVBQVUsQ0FBQyxDQUFBO0FBQ3RELFlBQUEsSUFBSSxDQUFDdkIsUUFBUSxDQUFDc0IsT0FBTyxDQUFDeEIsSUFBSSxDQUFDLEVBQUU7QUFDekJFLGNBQUFBLFFBQVEsQ0FBQ3lCLGdCQUFnQixDQUFDL0ksS0FBSyxFQUFFb0gsSUFBSSxFQUFFLElBQUksRUFBRTlCLFlBQVksRUFBRSxJQUFJLENBQUMwRCxpQkFBaUIsRUFBRSxJQUFJLENBQUNDLG1CQUFtQixDQUFDLENBQUE7Y0FDNUdkLFFBQVEsQ0FBQ1csUUFBUSxDQUFDRCxVQUFVLENBQUMsR0FBR3ZCLFFBQVEsQ0FBQ3NCLE9BQU8sQ0FBQ3hCLElBQUksQ0FBQyxDQUFBO0FBQzFELGFBQUE7QUFDSixXQUFDLE1BQU07WUFJSEUsUUFBUSxDQUFDeUIsZ0JBQWdCLENBQUMvSSxLQUFLLEVBQUVvSCxJQUFJLEVBQUVFLFFBQVEsQ0FBQzRCLGdCQUFnQixFQUFFNUQsWUFBWSxFQUFFLElBQUksQ0FBQzBELGlCQUFpQixFQUFFLElBQUksQ0FBQ0MsbUJBQW1CLENBQUMsQ0FBQTtBQUNySSxXQUFBO1VBQ0EzQixRQUFRLENBQUNHLFVBQVUsR0FBR0QsU0FBUyxDQUFBO0FBQ25DLFNBQUE7QUFFQWxCLFFBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDZSxRQUFRLENBQUNzQixPQUFPLENBQUN4QixJQUFJLENBQUMsRUFBRSxvQkFBb0IsRUFBRWUsUUFBUSxDQUFDLENBQUE7QUFFcEVkLFFBQUFBLE9BQU8sQ0FBQ0MsUUFBUSxFQUFFYSxRQUFRLEtBQUtULFlBQVksRUFBRSxDQUFDQSxZQUFZLElBQUlZLFNBQVMsS0FBS1QsYUFBYSxDQUFDLENBQUE7QUFFMUZILFFBQUFBLFlBQVksR0FBR1MsUUFBUSxDQUFBO0FBQ3ZCUixRQUFBQSxXQUFXLEdBQUdTLE9BQU8sQ0FBQTtBQUNyQlAsUUFBQUEsYUFBYSxHQUFHUyxTQUFTLENBQUE7UUFDekJWLFVBQVUsR0FBR04sUUFBUSxDQUFDMUIsUUFBUSxDQUFBO0FBQ2xDLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPakosYUFBYSxDQUFBO0FBQ3hCLEdBQUE7QUFFQXdNLEVBQUFBLHFCQUFxQixDQUFDakgsTUFBTSxFQUFFa0gsYUFBYSxFQUFFOUQsWUFBWSxFQUFFOEIsSUFBSSxFQUFFaUMsWUFBWSxFQUFFQyxTQUFTLEVBQUU7QUFDdEYsSUFBQSxNQUFNbk0sTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0FBQzFCLElBQUEsTUFBTW9NLHNCQUFzQixHQUFHcE0sTUFBTSxDQUFDb00sc0JBQXNCLENBQUE7QUFDNUQsSUFBQSxNQUFNdkosS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO0FBQ3hCLElBQUEsTUFBTXdKLFFBQVEsR0FBRyxDQUFDLElBQUlwQyxJQUFJLENBQUE7O0FBRzFCLElBQUEsTUFBTXFDLGtCQUFrQixHQUFHTCxhQUFhLENBQUN4TSxTQUFTLENBQUN1RixNQUFNLENBQUE7SUFDekQsS0FBSyxJQUFJN0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHbUosa0JBQWtCLEVBQUVuSixDQUFDLEVBQUUsRUFBRTtBQUV6QyxNQUFBLE1BQU1nSCxRQUFRLEdBQUc4QixhQUFhLENBQUN4TSxTQUFTLENBQUMwRCxDQUFDLENBQUMsQ0FBQTtNQUUzQyxJQUFJZ0gsUUFBUSxDQUFDUSxPQUFPLEVBQUU7UUFHbEJSLFFBQVEsQ0FBQ1EsT0FBTyxFQUFFLENBQUE7QUFFdEIsT0FBQyxNQUFNO0FBR0gsUUFBQSxNQUFNNEIsV0FBVyxHQUFHTixhQUFhLENBQUN2TSxhQUFhLENBQUN5RCxDQUFDLENBQUMsQ0FBQTtBQUNsRCxRQUFBLE1BQU14RCxnQkFBZ0IsR0FBR3NNLGFBQWEsQ0FBQ3RNLGdCQUFnQixDQUFDd0QsQ0FBQyxDQUFDLENBQUE7QUFDMUQsUUFBQSxNQUFNNkgsUUFBUSxHQUFHYixRQUFRLENBQUNhLFFBQVEsQ0FBQTtBQUNsQyxRQUFBLE1BQU1DLE9BQU8sR0FBR2QsUUFBUSxDQUFDZSxXQUFXLENBQUE7QUFDcEMsUUFBQSxNQUFNQyxTQUFTLEdBQUdoQixRQUFRLENBQUNyRixJQUFJLENBQUE7QUFFL0IsUUFBQSxJQUFJeUgsV0FBVyxFQUFFO0FBRWIsVUFBQSxNQUFNQyxNQUFNLEdBQUdyQyxRQUFRLENBQUNzQixPQUFPLENBQUN4QixJQUFJLENBQUMsQ0FBQTtBQUNyQyxVQUFBLElBQUksQ0FBQ3VDLE1BQU0sQ0FBQ0MsTUFBTSxJQUFJLENBQUN6TSxNQUFNLENBQUMwTSxTQUFTLENBQUNGLE1BQU0sQ0FBQyxFQUFFO0FBQzdDckQsWUFBQUEsS0FBSyxDQUFDd0QsS0FBSyxDQUFFLENBQUEsb0NBQUEsRUFBc0MzQixRQUFRLENBQUM0QixJQUFLLENBQVEzQyxNQUFBQSxFQUFBQSxJQUFLLENBQVdnQixTQUFBQSxFQUFBQSxPQUFRLENBQUMsQ0FBQSxFQUFFRCxRQUFRLENBQUMsQ0FBQTtBQUNqSCxXQUFBOztBQUdBQSxVQUFBQSxRQUFRLENBQUM2QixhQUFhLENBQUM3TSxNQUFNLENBQUMsQ0FBQTtBQUU5QixVQUFBLElBQUlMLGdCQUFnQixFQUFFO0FBQ2xCLFlBQUEsTUFBTXlJLGFBQWEsR0FBRyxJQUFJLENBQUN4RCxvQkFBb0IsQ0FBQ3VELFlBQVksQ0FBQ2tCLHFCQUFxQixDQUFDLEVBQUV4RyxLQUFLLEVBQUVzSSxTQUFTLEVBQUVwRyxNQUFNLENBQUMsQ0FBQTtBQUM5RyxZQUFBLElBQUksQ0FBQ21ELG1CQUFtQixDQUFDQyxZQUFZLEVBQUV0RixLQUFLLEVBQUVzSSxTQUFTLEVBQUUvQyxhQUFhLEVBQUUrQixRQUFRLENBQUM0QixnQkFBZ0IsQ0FBQyxDQUFBO0FBQ3RHLFdBQUE7VUFFQSxJQUFJLENBQUNlLFdBQVcsQ0FBQ3RKLFFBQVEsQ0FBQ3dILFFBQVEsQ0FBQytCLFNBQVMsQ0FBQyxDQUFBO0FBRTdDL00sVUFBQUEsTUFBTSxDQUFDZ04sV0FBVyxDQUFDaEMsUUFBUSxDQUFDaUMsS0FBSyxDQUFDLENBQUE7VUFDbEMsSUFBSWpDLFFBQVEsQ0FBQ2lDLEtBQUssRUFBRTtZQUNoQixJQUFJakMsUUFBUSxDQUFDa0Msa0JBQWtCLEVBQUU7QUFDN0JsTixjQUFBQSxNQUFNLENBQUNtTix3QkFBd0IsQ0FBQ25DLFFBQVEsQ0FBQ29DLFFBQVEsRUFBRXBDLFFBQVEsQ0FBQ3FDLFFBQVEsRUFBRXJDLFFBQVEsQ0FBQ3NDLGFBQWEsRUFBRXRDLFFBQVEsQ0FBQ3VDLGFBQWEsQ0FBQyxDQUFBO2NBQ3JIdk4sTUFBTSxDQUFDd04sd0JBQXdCLENBQUN4QyxRQUFRLENBQUN5QyxhQUFhLEVBQUV6QyxRQUFRLENBQUMwQyxrQkFBa0IsQ0FBQyxDQUFBO0FBQ3hGLGFBQUMsTUFBTTtjQUNIMU4sTUFBTSxDQUFDMk4sZ0JBQWdCLENBQUMzQyxRQUFRLENBQUNvQyxRQUFRLEVBQUVwQyxRQUFRLENBQUNxQyxRQUFRLENBQUMsQ0FBQTtBQUM3RHJOLGNBQUFBLE1BQU0sQ0FBQzROLGdCQUFnQixDQUFDNUMsUUFBUSxDQUFDeUMsYUFBYSxDQUFDLENBQUE7QUFDbkQsYUFBQTtBQUNKLFdBQUE7QUFDQXpOLFVBQUFBLE1BQU0sQ0FBQzZOLGFBQWEsQ0FBQzdDLFFBQVEsQ0FBQzhDLFFBQVEsRUFBRTlDLFFBQVEsQ0FBQytDLFVBQVUsRUFBRS9DLFFBQVEsQ0FBQ2dELFNBQVMsRUFBRWhELFFBQVEsQ0FBQ2lELFVBQVUsQ0FBQyxDQUFBO0FBQ3JHak8sVUFBQUEsTUFBTSxDQUFDa08sYUFBYSxDQUFDbEQsUUFBUSxDQUFDbUQsVUFBVSxDQUFDLENBQUE7O1VBR3pDLElBQUluRCxRQUFRLENBQUNtRCxVQUFVLElBQUksQ0FBQ25ELFFBQVEsQ0FBQ29ELFNBQVMsRUFBRTtBQUM1Q3BPLFlBQUFBLE1BQU0sQ0FBQ3FPLFlBQVksQ0FBQ0MsV0FBVyxDQUFDLENBQUE7QUFDaEN0TyxZQUFBQSxNQUFNLENBQUN1TyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDN0IsV0FBQyxNQUFNO0FBQ0h2TyxZQUFBQSxNQUFNLENBQUNxTyxZQUFZLENBQUNyRCxRQUFRLENBQUN3RCxTQUFTLENBQUMsQ0FBQTtBQUN2Q3hPLFlBQUFBLE1BQU0sQ0FBQ3VPLFlBQVksQ0FBQ3ZELFFBQVEsQ0FBQ29ELFNBQVMsQ0FBQyxDQUFBO0FBQzNDLFdBQUE7QUFFQXBPLFVBQUFBLE1BQU0sQ0FBQ3lPLGtCQUFrQixDQUFDekQsUUFBUSxDQUFDMEQsZUFBZSxDQUFDLENBQUE7QUFFbkQsVUFBQSxJQUFJMUQsUUFBUSxDQUFDMkQsU0FBUyxJQUFJM0QsUUFBUSxDQUFDNEQsY0FBYyxFQUFFO0FBQy9DNU8sWUFBQUEsTUFBTSxDQUFDNk8sWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQ3pCN08sTUFBTSxDQUFDOE8sa0JBQWtCLENBQUM5RCxRQUFRLENBQUMyRCxTQUFTLEVBQUUzRCxRQUFRLENBQUM0RCxjQUFjLENBQUMsQ0FBQTtBQUMxRSxXQUFDLE1BQU07QUFDSDVPLFlBQUFBLE1BQU0sQ0FBQzZPLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM5QixXQUFBO0FBQ0osU0FBQTtRQUVBLElBQUksQ0FBQ0UsV0FBVyxDQUFDaEssTUFBTSxDQUFDaUssVUFBVSxFQUFFN0MsU0FBUyxFQUFFaEMsUUFBUSxDQUFDLENBQUE7UUFFeEQsTUFBTThFLFlBQVksR0FBRzlFLFFBQVEsQ0FBQzhFLFlBQVksSUFBSWpFLFFBQVEsQ0FBQ2lFLFlBQVksQ0FBQTtRQUNuRSxNQUFNQyxXQUFXLEdBQUcvRSxRQUFRLENBQUMrRSxXQUFXLElBQUlsRSxRQUFRLENBQUNrRSxXQUFXLENBQUE7UUFFaEUsSUFBSUQsWUFBWSxJQUFJQyxXQUFXLEVBQUU7QUFDN0JsUCxVQUFBQSxNQUFNLENBQUNtUCxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUE7VUFDM0IsSUFBSUYsWUFBWSxLQUFLQyxXQUFXLEVBQUU7QUFFOUJsUCxZQUFBQSxNQUFNLENBQUNvUCxjQUFjLENBQUNILFlBQVksQ0FBQ0ksSUFBSSxFQUFFSixZQUFZLENBQUNLLEdBQUcsRUFBRUwsWUFBWSxDQUFDTSxRQUFRLENBQUMsQ0FBQTtBQUNqRnZQLFlBQUFBLE1BQU0sQ0FBQ3dQLG1CQUFtQixDQUFDUCxZQUFZLENBQUNRLElBQUksRUFBRVIsWUFBWSxDQUFDUyxLQUFLLEVBQUVULFlBQVksQ0FBQ1UsS0FBSyxFQUFFVixZQUFZLENBQUNXLFNBQVMsQ0FBQyxDQUFBO0FBQ2pILFdBQUMsTUFBTTtBQUVILFlBQUEsSUFBSVgsWUFBWSxFQUFFO0FBRWRqUCxjQUFBQSxNQUFNLENBQUM2UCxtQkFBbUIsQ0FBQ1osWUFBWSxDQUFDSSxJQUFJLEVBQUVKLFlBQVksQ0FBQ0ssR0FBRyxFQUFFTCxZQUFZLENBQUNNLFFBQVEsQ0FBQyxDQUFBO0FBQ3RGdlAsY0FBQUEsTUFBTSxDQUFDOFAsd0JBQXdCLENBQUNiLFlBQVksQ0FBQ1EsSUFBSSxFQUFFUixZQUFZLENBQUNTLEtBQUssRUFBRVQsWUFBWSxDQUFDVSxLQUFLLEVBQUVWLFlBQVksQ0FBQ1csU0FBUyxDQUFDLENBQUE7QUFDdEgsYUFBQyxNQUFNO2NBRUg1UCxNQUFNLENBQUM2UCxtQkFBbUIsQ0FBQ3ZCLFdBQVcsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUE7Y0FDaER0TyxNQUFNLENBQUM4UCx3QkFBd0IsQ0FBQ0MsY0FBYyxFQUFFQSxjQUFjLEVBQUVBLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN6RixhQUFBO0FBQ0EsWUFBQSxJQUFJYixXQUFXLEVBQUU7QUFFYmxQLGNBQUFBLE1BQU0sQ0FBQ2dRLGtCQUFrQixDQUFDZCxXQUFXLENBQUNHLElBQUksRUFBRUgsV0FBVyxDQUFDSSxHQUFHLEVBQUVKLFdBQVcsQ0FBQ0ssUUFBUSxDQUFDLENBQUE7QUFDbEZ2UCxjQUFBQSxNQUFNLENBQUNpUSx1QkFBdUIsQ0FBQ2YsV0FBVyxDQUFDTyxJQUFJLEVBQUVQLFdBQVcsQ0FBQ1EsS0FBSyxFQUFFUixXQUFXLENBQUNTLEtBQUssRUFBRVQsV0FBVyxDQUFDVSxTQUFTLENBQUMsQ0FBQTtBQUNqSCxhQUFDLE1BQU07Y0FFSDVQLE1BQU0sQ0FBQ2dRLGtCQUFrQixDQUFDMUIsV0FBVyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtjQUMvQ3RPLE1BQU0sQ0FBQ2lRLHVCQUF1QixDQUFDRixjQUFjLEVBQUVBLGNBQWMsRUFBRUEsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3hGLGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQyxNQUFNO0FBQ0gvUCxVQUFBQSxNQUFNLENBQUNtUCxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDaEMsU0FBQTtBQUVBLFFBQUEsTUFBTWUsSUFBSSxHQUFHL0YsUUFBUSxDQUFDK0YsSUFBSSxDQUFBOztBQUcxQi9GLFFBQUFBLFFBQVEsQ0FBQzBDLGFBQWEsQ0FBQzdNLE1BQU0sRUFBRXFNLFFBQVEsQ0FBQyxDQUFBO0FBRXhDLFFBQUEsSUFBSSxDQUFDOEQsZ0JBQWdCLENBQUNuUSxNQUFNLEVBQUVrUSxJQUFJLENBQUMsQ0FBQTtRQUNuQyxJQUFJLENBQUNFLFdBQVcsQ0FBQ3BRLE1BQU0sRUFBRW1LLFFBQVEsQ0FBQ2tHLGFBQWEsQ0FBQyxDQUFBO0FBQ2hELFFBQUEsSUFBSSxDQUFDQyxXQUFXLENBQUN0USxNQUFNLEVBQUVtSyxRQUFRLENBQUMsQ0FBQTtBQUVsQyxRQUFBLElBQUlpQyxzQkFBc0IsRUFBRTtBQUl4QixVQUFBLElBQUksQ0FBQ21FLGFBQWEsQ0FBQy9NLFFBQVEsQ0FBQzJHLFFBQVEsQ0FBQ3FHLElBQUksQ0FBQ0MsY0FBYyxDQUFDN00sSUFBSSxDQUFDLENBQUE7QUFDOUQsVUFBQSxJQUFJLENBQUM4TSxjQUFjLENBQUNsTixRQUFRLENBQUMyRyxRQUFRLENBQUNxRyxJQUFJLENBQUNHLFlBQVksQ0FBQy9NLElBQUksQ0FBQyxDQUFBOztVQUc3RCxNQUFNZ04sYUFBYSxHQUFHekcsUUFBUSxDQUFDMEcsWUFBWSxDQUFDN1EsTUFBTSxFQUFFaUssSUFBSSxDQUFDLENBQUE7QUFDekQyRyxVQUFBQSxhQUFhLENBQUNFLG9CQUFvQixDQUFDQyxNQUFNLEVBQUUsQ0FBQTtVQUMzQ0gsYUFBYSxDQUFDRyxNQUFNLEVBQUUsQ0FBQTtBQUN0Qi9RLFVBQUFBLE1BQU0sQ0FBQ2dSLFlBQVksQ0FBQ0MsY0FBYyxFQUFFTCxhQUFhLENBQUMsQ0FBQTtBQUN0RCxTQUFBO0FBRUEsUUFBQSxNQUFNTSxLQUFLLEdBQUcvRyxRQUFRLENBQUNnSCxXQUFXLENBQUE7UUFDbENuUixNQUFNLENBQUNvUixjQUFjLENBQUNsQixJQUFJLENBQUNtQixXQUFXLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUE7QUFFOUMsUUFBQSxJQUFJaEYsWUFBWSxFQUFFO0FBQ2RBLFVBQUFBLFlBQVksQ0FBQy9CLFFBQVEsRUFBRWhILENBQUMsQ0FBQyxDQUFBO0FBQzdCLFNBQUE7QUFFQSxRQUFBLElBQUk0QixNQUFNLENBQUN1TSxFQUFFLElBQUl2TSxNQUFNLENBQUN1TSxFQUFFLENBQUNDLE9BQU8sSUFBSXhNLE1BQU0sQ0FBQ3VNLEVBQUUsQ0FBQ0UsS0FBSyxDQUFDeE0sTUFBTSxFQUFFO0FBQzFELFVBQUEsTUFBTXdNLEtBQUssR0FBR3pNLE1BQU0sQ0FBQ3VNLEVBQUUsQ0FBQ0UsS0FBSyxDQUFBO0FBRTdCLFVBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELEtBQUssQ0FBQ3hNLE1BQU0sRUFBRXlNLENBQUMsRUFBRSxFQUFFO0FBQ25DLFlBQUEsTUFBTUMsSUFBSSxHQUFHRixLQUFLLENBQUNDLENBQUMsQ0FBQyxDQUFBO1lBRXJCelIsTUFBTSxDQUFDMlIsV0FBVyxDQUFDRCxJQUFJLENBQUNFLFFBQVEsQ0FBQ3ZOLENBQUMsRUFBRXFOLElBQUksQ0FBQ0UsUUFBUSxDQUFDdE4sQ0FBQyxFQUFFb04sSUFBSSxDQUFDRSxRQUFRLENBQUNyTixDQUFDLEVBQUVtTixJQUFJLENBQUNFLFFBQVEsQ0FBQzdKLENBQUMsQ0FBQyxDQUFBO1lBRXRGLElBQUksQ0FBQzhKLE1BQU0sQ0FBQ3JPLFFBQVEsQ0FBQ2tPLElBQUksQ0FBQ0ksT0FBTyxDQUFDbE8sSUFBSSxDQUFDLENBQUE7WUFDdkMsSUFBSSxDQUFDbU8sWUFBWSxDQUFDdk8sUUFBUSxDQUFDa08sSUFBSSxDQUFDSSxPQUFPLENBQUNsTyxJQUFJLENBQUMsQ0FBQTtZQUM3QyxJQUFJLENBQUNvTyxNQUFNLENBQUN4TyxRQUFRLENBQUNrTyxJQUFJLENBQUNPLFVBQVUsQ0FBQ3JPLElBQUksQ0FBQyxDQUFBO1lBQzFDLElBQUksQ0FBQ3NPLFNBQVMsQ0FBQzFPLFFBQVEsQ0FBQ2tPLElBQUksQ0FBQ1MsYUFBYSxDQUFDdk8sSUFBSSxDQUFDLENBQUE7WUFDaEQsSUFBSSxDQUFDd08sT0FBTyxDQUFDNU8sUUFBUSxDQUFDa08sSUFBSSxDQUFDVyxRQUFRLENBQUN6TyxJQUFJLENBQUMsQ0FBQTtZQUN6QyxJQUFJLENBQUMwTyxVQUFVLENBQUM5TyxRQUFRLENBQUNrTyxJQUFJLENBQUNhLGNBQWMsQ0FBQzNPLElBQUksQ0FBQyxDQUFBO1lBQ2xELElBQUksQ0FBQzRPLFNBQVMsQ0FBQ2hQLFFBQVEsQ0FBQ2tPLElBQUksQ0FBQ2UsUUFBUSxDQUFDLENBQUE7WUFFdEMsSUFBSWhCLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDVCxjQUFBLElBQUksQ0FBQ2lCLFlBQVksQ0FBQzFTLE1BQU0sRUFBRW1LLFFBQVEsRUFBRStGLElBQUksRUFBRWdCLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMxRCxhQUFDLE1BQU07Y0FDSCxJQUFJLENBQUN5QixhQUFhLENBQUMzUyxNQUFNLEVBQUVtSyxRQUFRLEVBQUUrRixJQUFJLEVBQUVnQixLQUFLLENBQUMsQ0FBQTtBQUNyRCxhQUFBO1lBRUEsSUFBSSxDQUFDalIsaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QixXQUFBO0FBQ0osU0FBQyxNQUFNO0FBQ0gsVUFBQSxJQUFJLENBQUN5UyxZQUFZLENBQUMxUyxNQUFNLEVBQUVtSyxRQUFRLEVBQUUrRixJQUFJLEVBQUVnQixLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUE7VUFDdEQsSUFBSSxDQUFDalIsaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QixTQUFBOztBQUdBLFFBQUEsSUFBSWtELENBQUMsR0FBR21KLGtCQUFrQixHQUFHLENBQUMsSUFBSSxDQUFDTCxhQUFhLENBQUN2TSxhQUFhLENBQUN5RCxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7VUFDbkU2SCxRQUFRLENBQUM2QixhQUFhLENBQUM3TSxNQUFNLEVBQUVtSyxRQUFRLENBQUN5SSxVQUFVLENBQUMsQ0FBQTtBQUN2RCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUFDLEVBQUFBLGFBQWEsQ0FBQzlOLE1BQU0sRUFBRStOLFlBQVksRUFBRUMsaUJBQWlCLEVBQUU1SyxZQUFZLEVBQUU4QixJQUFJLEVBQUVGLFdBQVcsRUFBRW1DLFlBQVksRUFBRWxDLEtBQUssRUFBRW1DLFNBQVMsRUFBRTtJQUdwSCxNQUFNNkcsZ0JBQWdCLEdBQUdDLEdBQUcsRUFBRSxDQUFBOztBQUk5QixJQUFBLE1BQU1oSCxhQUFhLEdBQUcsSUFBSSxDQUFDcEMsNkJBQTZCLENBQUM5RSxNQUFNLEVBQUUrTixZQUFZLEVBQUVDLGlCQUFpQixFQUFFNUssWUFBWSxFQUFFNEIsV0FBVyxFQUFFQyxLQUFLLEVBQUVDLElBQUksQ0FBQyxDQUFBOztBQUd6SSxJQUFBLElBQUksQ0FBQytCLHFCQUFxQixDQUFDakgsTUFBTSxFQUFFa0gsYUFBYSxFQUFFOUQsWUFBWSxFQUFFOEIsSUFBSSxFQUFFaUMsWUFBWSxFQUFFQyxTQUFTLENBQUMsQ0FBQTtJQUU5RjNNLGFBQWEsQ0FBQ3dGLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFHeEIsSUFBQSxJQUFJLENBQUM1RSxZQUFZLElBQUk2UyxHQUFHLEVBQUUsR0FBR0QsZ0JBQWdCLENBQUE7QUFFakQsR0FBQTtBQUVBRSxFQUFBQSxpQkFBaUIsR0FBRztBQUNoQixJQUFBLE1BQU1yUSxLQUFLLEdBQUcsSUFBSSxDQUFDQSxLQUFLLENBQUE7O0FBR3hCLElBQUEsSUFBSSxDQUFDRCxvQkFBb0IsQ0FBQ0MsS0FBSyxDQUFDLENBQUE7O0FBR2hDLElBQUEsSUFBSUEsS0FBSyxDQUFDc1EsR0FBRyxLQUFLQyxRQUFRLEVBQUU7TUFDeEIsSUFBSSxDQUFDM1EsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHSSxLQUFLLENBQUNKLFFBQVEsQ0FBQ00sQ0FBQyxDQUFBO01BQ25DLElBQUksQ0FBQ04sUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHSSxLQUFLLENBQUNKLFFBQVEsQ0FBQ08sQ0FBQyxDQUFBO01BQ25DLElBQUksQ0FBQ1AsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHSSxLQUFLLENBQUNKLFFBQVEsQ0FBQ1EsQ0FBQyxDQUFBO01BQ25DLElBQUlKLEtBQUssQ0FBQ0ssZUFBZSxFQUFFO1FBQ3ZCLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxFQUFFLEVBQUU7QUFDeEIsVUFBQSxJQUFJLENBQUNWLFFBQVEsQ0FBQ1UsQ0FBQyxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ1osUUFBUSxDQUFDVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUN0RCxTQUFBO0FBQ0osT0FBQTtNQUNBLElBQUksQ0FBQzVDLFVBQVUsQ0FBQ2lELFFBQVEsQ0FBQyxJQUFJLENBQUNmLFFBQVEsQ0FBQyxDQUFBO0FBQ3ZDLE1BQUEsSUFBSUksS0FBSyxDQUFDc1EsR0FBRyxLQUFLRSxVQUFVLEVBQUU7UUFDMUIsSUFBSSxDQUFDNVMsVUFBVSxDQUFDK0MsUUFBUSxDQUFDWCxLQUFLLENBQUN5USxRQUFRLENBQUMsQ0FBQTtRQUN4QyxJQUFJLENBQUM1UyxRQUFRLENBQUM4QyxRQUFRLENBQUNYLEtBQUssQ0FBQzBRLE1BQU0sQ0FBQyxDQUFBO0FBQ3hDLE9BQUMsTUFBTTtRQUNILElBQUksQ0FBQzVTLFlBQVksQ0FBQzZDLFFBQVEsQ0FBQ1gsS0FBSyxDQUFDMlEsVUFBVSxDQUFDLENBQUE7QUFDaEQsT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxNQUFNeFQsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0lBQzFCLElBQUksQ0FBQ3VDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBR3ZDLE1BQU0sQ0FBQ3lULEtBQUssQ0FBQTtJQUNsQyxJQUFJLENBQUNsUixXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUd2QyxNQUFNLENBQUMwVCxNQUFNLENBQUE7SUFDbkMsSUFBSSxDQUFDblIsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBR3ZDLE1BQU0sQ0FBQ3lULEtBQUssQ0FBQTtJQUN0QyxJQUFJLENBQUNsUixXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHdkMsTUFBTSxDQUFDMFQsTUFBTSxDQUFBO0lBQ3ZDLElBQUksQ0FBQ3BSLFlBQVksQ0FBQ2tCLFFBQVEsQ0FBQyxJQUFJLENBQUNqQixXQUFXLENBQUMsQ0FBQTtBQUNoRCxHQUFBOztBQU9Bb1IsRUFBQUEsZ0JBQWdCLENBQUNDLElBQUksRUFBRUMsZ0JBQWdCLEVBQUU7QUFHckMsSUFBQSxNQUFNaFIsS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO0lBQ3hCLElBQUlnUixnQkFBZ0IsR0FBR0Msa0JBQWtCLElBQUksQ0FBQ2pSLEtBQUssQ0FBQ2tSLGFBQWEsRUFBRTtBQUMvRCxNQUFBLE1BQU1DLEtBQUssR0FBR25SLEtBQUssQ0FBQ29SLE1BQU0sQ0FBQTtBQUMxQkQsTUFBQUEsS0FBSyxDQUFDaEwsTUFBTSxHQUFHNEssSUFBSSxDQUFDTSxPQUFPLENBQUNsUCxNQUFNLENBQUE7TUFDbENnUCxLQUFLLENBQUNHLGFBQWEsR0FBRyxDQUFDLENBQUE7TUFDdkJILEtBQUssQ0FBQ0ksV0FBVyxHQUFHLENBQUMsQ0FBQTtBQUVyQixNQUFBLEtBQUssSUFBSWpSLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzZRLEtBQUssQ0FBQ2hMLE1BQU0sRUFBRTdGLENBQUMsRUFBRSxFQUFFO0FBQ25DLFFBQUEsTUFBTWtSLENBQUMsR0FBR1QsSUFBSSxDQUFDTSxPQUFPLENBQUMvUSxDQUFDLENBQUMsQ0FBQTtRQUN6QixJQUFJa1IsQ0FBQyxDQUFDQyxPQUFPLEVBQUU7VUFDWCxJQUFLRCxDQUFDLENBQUN2UCxJQUFJLEdBQUd5UCxtQkFBbUIsSUFBTUYsQ0FBQyxDQUFDdlAsSUFBSSxHQUFHMFAsdUJBQXdCLEVBQUU7WUFDdEVSLEtBQUssQ0FBQ0csYUFBYSxFQUFFLENBQUE7QUFDekIsV0FBQTtBQUNBLFVBQUEsSUFBSUUsQ0FBQyxDQUFDdlAsSUFBSSxHQUFHMlAsU0FBUyxFQUFFO1lBQ3BCVCxLQUFLLENBQUNJLFdBQVcsRUFBRSxDQUFBO0FBQ3ZCLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJUCxnQkFBZ0IsR0FBR2EscUJBQXFCLElBQUksQ0FBQzdSLEtBQUssQ0FBQ2tSLGFBQWEsRUFBRTtNQUNsRWxSLEtBQUssQ0FBQ29SLE1BQU0sQ0FBQ1UsYUFBYSxHQUFHZixJQUFJLENBQUNnQixjQUFjLENBQUM1UCxNQUFNLENBQUE7QUFDM0QsS0FBQTtJQUVBbkMsS0FBSyxDQUFDa1IsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUU5QixHQUFBOztBQVVBYyxFQUFBQSxlQUFlLENBQUNDLFVBQVUsRUFBRUMsZ0JBQWdCLEVBQUU7SUFFMUNELFVBQVUsQ0FBQ0UsS0FBSyxFQUFFLENBQUE7QUFFbEIsSUFBQSxJQUFJLENBQUNqRSxNQUFNLENBQUNnRSxnQkFBZ0IsQ0FBQyxDQUFBO0FBRTdCLElBQUEsTUFBTTdMLHdCQUF3QixHQUFHLElBQUksQ0FBQ3JHLEtBQUssQ0FBQ3FHLHdCQUF3QixDQUFBO0FBQ3BFLElBQUEsSUFBSUEsd0JBQXdCLEVBQUU7QUFHMUIsTUFBQSxJQUFJLENBQUMrTCx1QkFBdUIsQ0FBQ0YsZ0JBQWdCLENBQUMsQ0FBQTtNQUU5QyxNQUFNRyxXQUFVLEdBQUcsSUFBSUMsVUFBVSxDQUFDLElBQUksQ0FBQ25WLE1BQU0sRUFBRSxNQUFNO0FBRWpELFFBQUEsSUFBSSxJQUFJLENBQUM2QyxLQUFLLENBQUN1UyxRQUFRLENBQUNDLGNBQWMsRUFBRTtVQUNwQyxJQUFJLENBQUNDLGFBQWEsQ0FBQ1AsZ0JBQWdCLENBQUNRLFlBQVksQ0FBQzFNLGNBQWMsQ0FBQyxDQUFDLENBQUE7VUFDakUsSUFBSSxDQUFDeU0sYUFBYSxDQUFDUCxnQkFBZ0IsQ0FBQ1EsWUFBWSxDQUFDaE4sY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUNyRSxTQUFBO0FBQ0osT0FBQyxDQUFDLENBQUE7TUFDRjJNLFdBQVUsQ0FBQ00sZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQ25DQyxNQUFBQSxXQUFXLENBQUNDLE9BQU8sQ0FBQ1IsV0FBVSxFQUFFLGtCQUFrQixDQUFDLENBQUE7QUFDbkRKLE1BQUFBLFVBQVUsQ0FBQ2EsYUFBYSxDQUFDVCxXQUFVLENBQUMsQ0FBQTtBQUN4QyxLQUFBOztJQUdBLE1BQU1BLFVBQVUsR0FBRyxJQUFJQyxVQUFVLENBQUMsSUFBSSxDQUFDblYsTUFBTSxFQUFFLE1BQU07QUFHakQsTUFBQSxJQUFJLENBQUNrSix3QkFBd0IsSUFBS0Esd0JBQXdCLElBQUksSUFBSSxDQUFDckcsS0FBSyxDQUFDdVMsUUFBUSxDQUFDUSxjQUFlLEVBQUU7UUFDL0YsSUFBSSxDQUFDN00sa0JBQWtCLENBQUNnTSxnQkFBZ0IsQ0FBQ1EsWUFBWSxDQUFDMU0sY0FBYyxDQUFDLENBQUMsQ0FBQTtRQUN0RSxJQUFJLENBQUNFLGtCQUFrQixDQUFDZ00sZ0JBQWdCLENBQUNRLFlBQVksQ0FBQ2hOLGNBQWMsQ0FBQyxDQUFDLENBQUE7QUFDMUUsT0FBQTs7QUFHQSxNQUFBLElBQUlXLHdCQUF3QixFQUFFO0FBQzFCLFFBQUEsSUFBSSxDQUFDMk0sY0FBYyxDQUFDZCxnQkFBZ0IsQ0FBQyxDQUFBO0FBQ3pDLE9BQUE7QUFDSixLQUFDLENBQUMsQ0FBQTtJQUNGRyxVQUFVLENBQUNNLGdCQUFnQixHQUFHLEtBQUssQ0FBQTtBQUNuQ0MsSUFBQUEsV0FBVyxDQUFDQyxPQUFPLENBQUNSLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFBO0FBQ2xESixJQUFBQSxVQUFVLENBQUNhLGFBQWEsQ0FBQ1QsVUFBVSxDQUFDLENBQUE7O0lBR3BDLElBQUlZLFVBQVUsR0FBRyxDQUFDLENBQUE7SUFDbEIsSUFBSUMsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNuQixJQUFJQyxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLElBQUEsTUFBTUMsYUFBYSxHQUFHbEIsZ0JBQWdCLENBQUNtQixjQUFjLENBQUE7QUFFckQsSUFBQSxLQUFLLElBQUkvUyxDQUFDLEdBQUcyUyxVQUFVLEVBQUUzUyxDQUFDLEdBQUc4UyxhQUFhLENBQUNqUixNQUFNLEVBQUU3QixDQUFDLEVBQUUsRUFBRTtBQUVwRCxNQUFBLE1BQU1nVCxZQUFZLEdBQUdGLGFBQWEsQ0FBQzlTLENBQUMsQ0FBQyxDQUFBO01BQ3JDLE1BQU02RyxLQUFLLEdBQUcrSyxnQkFBZ0IsQ0FBQ3FCLFNBQVMsQ0FBQ0QsWUFBWSxDQUFDRSxVQUFVLENBQUMsQ0FBQTtNQUNqRSxNQUFNdFIsTUFBTSxHQUFHaUYsS0FBSyxDQUFDc00sT0FBTyxDQUFDSCxZQUFZLENBQUNJLFdBQVcsQ0FBQyxDQUFBOztBQUd0RCxNQUFBLElBQUksQ0FBQ0osWUFBWSxDQUFDSyxjQUFjLENBQUN6QixnQkFBZ0IsQ0FBQyxFQUFFO0FBQ2hELFFBQUEsU0FBQTtBQUNKLE9BQUE7QUFFQSxNQUFBLE1BQU0wQixZQUFZLEdBQUd6TSxLQUFLLENBQUMwTSxFQUFFLEtBQUtDLGFBQWEsQ0FBQTtNQUMvQyxNQUFNQyxVQUFVLEdBQUdILFlBQVksS0FBSzFSLE1BQU0sQ0FBQzhSLG1CQUFtQixJQUFJOVIsTUFBTSxDQUFDK1IsbUJBQW1CLENBQUMsQ0FBQTs7QUFHN0YsTUFBQSxJQUFJWCxZQUFZLENBQUNZLDBCQUEwQixJQUFJaFMsTUFBTSxFQUFFO1FBQ25ELElBQUksQ0FBQ2lTLDBCQUEwQixDQUFDbkMsZUFBZSxDQUFDQyxVQUFVLEVBQUVxQixZQUFZLEVBQUVwUixNQUFNLENBQUMsQ0FBQTtBQUNyRixPQUFBOztBQUdBLE1BQUEsSUFBSWdSLFFBQVEsRUFBRTtBQUNWQSxRQUFBQSxRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ2hCRCxRQUFBQSxVQUFVLEdBQUczUyxDQUFDLENBQUE7UUFDZDZTLFlBQVksR0FBR0csWUFBWSxDQUFDSCxZQUFZLENBQUE7QUFDNUMsT0FBQTs7QUFHQSxNQUFBLElBQUlpQixTQUFTLEdBQUc5VCxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCLE1BQUEsT0FBTzhTLGFBQWEsQ0FBQ2dCLFNBQVMsQ0FBQyxJQUFJLENBQUNoQixhQUFhLENBQUNnQixTQUFTLENBQUMsQ0FBQ1QsY0FBYyxDQUFDekIsZ0JBQWdCLENBQUMsRUFBRTtBQUMzRmtDLFFBQUFBLFNBQVMsRUFBRSxDQUFBO0FBQ2YsT0FBQTs7QUFHQSxNQUFBLE1BQU1DLGdCQUFnQixHQUFHakIsYUFBYSxDQUFDZ0IsU0FBUyxDQUFDLENBQUE7QUFDakQsTUFBQSxNQUFNRSxnQkFBZ0IsR0FBR0QsZ0JBQWdCLEdBQUduQyxnQkFBZ0IsQ0FBQ3FCLFNBQVMsQ0FBQ2MsZ0JBQWdCLENBQUNiLFVBQVUsQ0FBQyxDQUFDSyxFQUFFLEtBQUtDLGFBQWEsR0FBRyxLQUFLLENBQUE7TUFDaEksTUFBTVMsbUJBQW1CLEdBQUdELGdCQUFnQixLQUFLcFMsTUFBTSxDQUFDOFIsbUJBQW1CLElBQUk5UixNQUFNLENBQUMrUixtQkFBbUIsQ0FBQyxDQUFBOztBQUcxRyxNQUFBLElBQUksQ0FBQ0ksZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDbEIsWUFBWSxLQUFLQSxZQUFZLElBQ25Fa0IsZ0JBQWdCLENBQUNILDBCQUEwQixJQUFJSyxtQkFBbUIsSUFBSVIsVUFBVSxFQUFFO0FBR2xGLFFBQUEsSUFBSSxDQUFDUyxpQkFBaUIsQ0FBQ3ZDLFVBQVUsRUFBRUMsZ0JBQWdCLEVBQUVpQixZQUFZLEVBQUVGLFVBQVUsRUFBRTNTLENBQUMsRUFBRXlULFVBQVUsQ0FBQyxDQUFBOztRQUc3RixJQUFJVCxZQUFZLENBQUNtQixrQkFBa0IsSUFBSXZTLE1BQU0sSUFBTkEsSUFBQUEsSUFBQUEsTUFBTSxDQUFFd1MsZ0JBQWdCLEVBQUU7VUFDN0QsTUFBTXJDLFlBQVUsR0FBRyxJQUFJQyxVQUFVLENBQUMsSUFBSSxDQUFDblYsTUFBTSxFQUFFLE1BQU07QUFDakQsWUFBQSxJQUFJLENBQUN3WCx3QkFBd0IsQ0FBQ3JCLFlBQVksRUFBRXBCLGdCQUFnQixDQUFDLENBQUE7QUFDakUsV0FBQyxDQUFDLENBQUE7VUFDRkcsWUFBVSxDQUFDTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7QUFDbkNDLFVBQUFBLFdBQVcsQ0FBQ0MsT0FBTyxDQUFDUixZQUFVLEVBQUcsYUFBWSxDQUFDLENBQUE7QUFDOUNKLFVBQUFBLFVBQVUsQ0FBQ2EsYUFBYSxDQUFDVCxZQUFVLENBQUMsQ0FBQTtBQUN4QyxTQUFBO0FBRUFhLFFBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDbkIsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQU9Bc0IsRUFBQUEsaUJBQWlCLENBQUN2QyxVQUFVLEVBQUVDLGdCQUFnQixFQUFFaUIsWUFBWSxFQUFFRixVQUFVLEVBQUUyQixRQUFRLEVBQUViLFVBQVUsRUFBRTtBQUc1RixJQUFBLE1BQU1jLEtBQUssR0FBRztBQUFFQyxNQUFBQSxLQUFLLEVBQUU3QixVQUFVO0FBQUU4QixNQUFBQSxHQUFHLEVBQUVILFFBQUFBO0tBQVUsQ0FBQTtJQUNsRCxNQUFNdkMsVUFBVSxHQUFHLElBQUlDLFVBQVUsQ0FBQyxJQUFJLENBQUNuVixNQUFNLEVBQUUsTUFBTTtBQUNqRCxNQUFBLElBQUksQ0FBQzZYLHVCQUF1QixDQUFDOUMsZ0JBQWdCLEVBQUUyQyxLQUFLLENBQUMsQ0FBQTtBQUN6RCxLQUFDLENBQUMsQ0FBQTtBQUVGLElBQUEsTUFBTXpCLGFBQWEsR0FBR2xCLGdCQUFnQixDQUFDbUIsY0FBYyxDQUFBO0FBQ3JELElBQUEsTUFBTTRCLGlCQUFpQixHQUFHN0IsYUFBYSxDQUFDSCxVQUFVLENBQUMsQ0FBQTtJQUNuRCxNQUFNaUMsVUFBVSxHQUFHaEQsZ0JBQWdCLENBQUNxQixTQUFTLENBQUMwQixpQkFBaUIsQ0FBQ3pCLFVBQVUsQ0FBQyxDQUFBO0lBQzNFLE1BQU10UixNQUFNLEdBQUdnVCxVQUFVLENBQUN6QixPQUFPLENBQUN3QixpQkFBaUIsQ0FBQ3ZCLFdBQVcsQ0FBQyxDQUFBOztBQUdoRSxJQUFBLE1BQU15QixnQkFBZ0IsR0FBR3BCLFVBQVUsSUFBSXFCLFNBQVMsQ0FBQ0Msa0JBQWtCLENBQUMsSUFBSSxDQUFDbFksTUFBTSxFQUFFK0UsTUFBTSxDQUFDLENBQUE7QUFDeEYsSUFBQSxNQUFNb1QsVUFBVSxHQUFHLENBQUN2QixVQUFVLElBQUlvQixnQkFBZ0IsQ0FBQTtBQUVsRCxJQUFBLElBQUlHLFVBQVUsRUFBRTtBQUVaakQsTUFBQUEsVUFBVSxDQUFDa0QsSUFBSSxDQUFDcEMsWUFBWSxDQUFDLENBQUE7QUFDN0JkLE1BQUFBLFVBQVUsQ0FBQ21ELGlCQUFpQixHQUFHdFQsTUFBTSxDQUFDQSxNQUFNLENBQUNzVCxpQkFBaUIsQ0FBQTtBQUU5RCxNQUFBLElBQUlMLGdCQUFnQixFQUFFO0FBR2xCOUMsUUFBQUEsVUFBVSxDQUFDb0QsYUFBYSxDQUFDaFoscUJBQXFCLENBQUMsQ0FBQTtBQUMvQzRWLFFBQUFBLFVBQVUsQ0FBQ3FELGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUVqQyxPQUFDLE1BQU0sSUFBSXJELFVBQVUsQ0FBQ21ELGlCQUFpQixFQUFFOztRQUVyQyxJQUFJUCxpQkFBaUIsQ0FBQ1UsVUFBVSxFQUFFO1VBQzlCdEQsVUFBVSxDQUFDb0QsYUFBYSxDQUFDdlQsTUFBTSxDQUFDQSxNQUFNLENBQUN5VCxVQUFVLENBQUMsQ0FBQTtBQUN0RCxTQUFBO1FBQ0EsSUFBSVYsaUJBQWlCLENBQUNXLFVBQVUsRUFBRTtVQUM5QnZELFVBQVUsQ0FBQ3FELGFBQWEsQ0FBQ3hULE1BQU0sQ0FBQ0EsTUFBTSxDQUFDMFQsVUFBVSxDQUFDLENBQUE7QUFDdEQsU0FBQTtRQUNBLElBQUlYLGlCQUFpQixDQUFDWSxZQUFZLEVBQUU7VUFDaEN4RCxVQUFVLENBQUN5RCxlQUFlLENBQUM1VCxNQUFNLENBQUNBLE1BQU0sQ0FBQzJULFlBQVksQ0FBQyxDQUFBO0FBQzFELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUVBakQsSUFBQUEsV0FBVyxDQUFDQyxPQUFPLENBQUNSLFVBQVUsRUFBRyxDQUFBLEVBQUUwQixVQUFVLEdBQUcsV0FBVyxHQUFHLGNBQWUsQ0FBQSxDQUFBLEVBQUdkLFVBQVcsQ0FBQSxDQUFBLEVBQUcyQixRQUFTLENBQUEsQ0FBQSxDQUFFLEdBQ3BGLENBQUEsS0FBQSxFQUFPMVMsTUFBTSxHQUFHQSxNQUFNLENBQUM2VCxNQUFNLENBQUNoTSxJQUFJLEdBQUcsR0FBSSxDQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ2hFa0ksSUFBQUEsVUFBVSxDQUFDYSxhQUFhLENBQUNULFVBQVUsQ0FBQyxDQUFBO0FBQ3hDLEdBQUE7O0VBTUFuRSxNQUFNLENBQUM2QyxJQUFJLEVBQUU7SUFFVCxJQUFJLENBQUNpRixVQUFVLEVBQUUsQ0FBQTtBQUVqQixJQUFBLE1BQU0zUCx3QkFBd0IsR0FBRyxJQUFJLENBQUNyRyxLQUFLLENBQUNxRyx3QkFBd0IsQ0FBQTs7SUFHcEUsSUFBSSxDQUFDckcsS0FBSyxDQUFDaVcsVUFBVSxDQUFDLElBQUksQ0FBQzlZLE1BQU0sQ0FBQyxDQUFBOztJQUdsQyxNQUFNK1ksT0FBTyxHQUFHLElBQUksQ0FBQ0Msc0JBQXNCLENBQUNwRixJQUFJLEVBQUUxSyx3QkFBd0IsQ0FBQyxDQUFBO0FBQzNFLElBQUEsTUFBTStQLGFBQWEsR0FBRyxDQUFDRixPQUFPLEdBQUdqRixrQkFBa0IsTUFBTSxDQUFDLENBQUE7QUFFMUQsSUFBQSxJQUFJLENBQUNILGdCQUFnQixDQUFDQyxJQUFJLEVBQUVtRixPQUFPLENBQUMsQ0FBQTs7QUFHcEMsSUFBQSxJQUFJLENBQUNHLFVBQVUsQ0FBQ3RGLElBQUksRUFBRXFGLGFBQWEsQ0FBQyxDQUFBO0lBQ3BDLElBQUksQ0FBQy9GLGlCQUFpQixFQUFFLENBQUE7O0FBSXhCLElBQUEsSUFBSSxDQUFDaUcsZUFBZSxDQUFDdkYsSUFBSSxDQUFDLENBQUE7O0FBRzFCLElBQUEsSUFBSSxDQUFDd0YsU0FBUyxDQUFDeEYsSUFBSSxDQUFDZ0IsY0FBYyxDQUFDLENBQUE7QUFDdkMsR0FBQTtBQUVBNEMsRUFBQUEsd0JBQXdCLENBQUNyQixZQUFZLEVBQUVwQixnQkFBZ0IsRUFBRTtJQUVyRCxNQUFNL0ssS0FBSyxHQUFHK0ssZ0JBQWdCLENBQUNxQixTQUFTLENBQUNELFlBQVksQ0FBQ0UsVUFBVSxDQUFDLENBQUE7SUFDakUsTUFBTXRSLE1BQU0sR0FBR2lGLEtBQUssQ0FBQ3NNLE9BQU8sQ0FBQ0gsWUFBWSxDQUFDSSxXQUFXLENBQUMsQ0FBQTtJQUN0RHBOLEtBQUssQ0FBQ0MsTUFBTSxDQUFDK00sWUFBWSxDQUFDbUIsa0JBQWtCLElBQUl2UyxNQUFNLENBQUN3UyxnQkFBZ0IsQ0FBQyxDQUFBOztJQUd4RXhTLE1BQU0sQ0FBQ3dTLGdCQUFnQixFQUFFLENBQUE7QUFDN0IsR0FBQTs7QUFTQU0sRUFBQUEsdUJBQXVCLENBQUNqRSxJQUFJLEVBQUU4RCxLQUFLLEVBQUU7QUFFakMsSUFBQSxNQUFNekIsYUFBYSxHQUFHckMsSUFBSSxDQUFDc0MsY0FBYyxDQUFBO0FBQ3pDLElBQUEsS0FBSyxJQUFJL1MsQ0FBQyxHQUFHdVUsS0FBSyxDQUFDQyxLQUFLLEVBQUV4VSxDQUFDLElBQUl1VSxLQUFLLENBQUNFLEdBQUcsRUFBRXpVLENBQUMsRUFBRSxFQUFFO0FBQzNDLE1BQUEsSUFBSSxDQUFDa1csa0JBQWtCLENBQUN6RixJQUFJLEVBQUVxQyxhQUFhLENBQUM5UyxDQUFDLENBQUMsRUFBRUEsQ0FBQyxLQUFLdVUsS0FBSyxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUN0RSxLQUFBO0FBQ0osR0FBQTs7QUFTQTBCLEVBQUFBLGtCQUFrQixDQUFDekYsSUFBSSxFQUFFdUMsWUFBWSxFQUFFbUQsaUJBQWlCLEVBQUU7QUFFdEQsSUFBQSxNQUFNcFEsd0JBQXdCLEdBQUcsSUFBSSxDQUFDckcsS0FBSyxDQUFDcUcsd0JBQXdCLENBQUE7QUFDcEUsSUFBQSxNQUFNbEosTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBOztBQUcxQixJQUFBLE1BQU1xVyxVQUFVLEdBQUdGLFlBQVksQ0FBQ0UsVUFBVSxDQUFBO0FBQzFDLElBQUEsTUFBTXJNLEtBQUssR0FBRzRKLElBQUksQ0FBQ3dDLFNBQVMsQ0FBQ0MsVUFBVSxDQUFDLENBQUE7QUFDeEMsSUFBQSxNQUFNa0QsV0FBVyxHQUFHM0YsSUFBSSxDQUFDNEYsWUFBWSxDQUFDbkQsVUFBVSxDQUFDLENBQUE7QUFFakQsSUFBQSxNQUFNb0QsVUFBVSxHQUFHdEQsWUFBWSxDQUFDSSxXQUFXLENBQUE7QUFDM0MsSUFBQSxNQUFNeFIsTUFBTSxHQUFHaUYsS0FBSyxDQUFDc00sT0FBTyxDQUFDbUQsVUFBVSxDQUFDLENBQUE7QUFFeEMsSUFBQSxJQUFJLENBQUN0RCxZQUFZLENBQUNLLGNBQWMsQ0FBQzVDLElBQUksQ0FBQyxFQUFFO0FBQ3BDLE1BQUEsT0FBQTtBQUNKLEtBQUE7QUFFQThGLElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDLElBQUksQ0FBQzNaLE1BQU0sRUFBRStFLE1BQU0sR0FBR0EsTUFBTSxDQUFDNlQsTUFBTSxDQUFDaE0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFBO0lBQ2hGOE0sYUFBYSxDQUFDQyxhQUFhLENBQUMsSUFBSSxDQUFDM1osTUFBTSxFQUFFZ0ssS0FBSyxDQUFDNEMsSUFBSSxDQUFDLENBQUE7SUFHcEQsTUFBTWdOLFFBQVEsR0FBRzNHLEdBQUcsRUFBRSxDQUFBO0FBR3RCLElBQUEsSUFBSWxPLE1BQU0sRUFBRTtBQUVSLE1BQUEsSUFBSW9SLFlBQVksQ0FBQzBELGNBQWMsSUFBSTlVLE1BQU0sQ0FBQytVLFdBQVcsRUFBRTtRQUNuRC9VLE1BQU0sQ0FBQytVLFdBQVcsRUFBRSxDQUFBO0FBQ3hCLE9BQUE7QUFDSixLQUFBOztBQUdBLElBQUEsSUFBSSxDQUFDUCxXQUFXLElBQUl2UCxLQUFLLENBQUMrUCxpQkFBaUIsRUFBRTtBQUN6Qy9QLE1BQUFBLEtBQUssQ0FBQytQLGlCQUFpQixDQUFDTixVQUFVLENBQUMsQ0FBQTtBQUN2QyxLQUFDLE1BQU0sSUFBSUYsV0FBVyxJQUFJdlAsS0FBSyxDQUFDZ1Esc0JBQXNCLEVBQUU7QUFDcERoUSxNQUFBQSxLQUFLLENBQUNnUSxzQkFBc0IsQ0FBQ1AsVUFBVSxDQUFDLENBQUE7QUFDNUMsS0FBQTs7SUFHQSxJQUFJLEVBQUV6UCxLQUFLLENBQUNpUSwwQkFBMEIsR0FBSSxDQUFDLElBQUlSLFVBQVcsQ0FBQyxFQUFFO01BQ3pELElBQUl6UCxLQUFLLENBQUM4UCxXQUFXLEVBQUU7QUFDbkI5UCxRQUFBQSxLQUFLLENBQUM4UCxXQUFXLENBQUNMLFVBQVUsQ0FBQyxDQUFBO0FBQ2pDLE9BQUE7QUFDQXpQLE1BQUFBLEtBQUssQ0FBQ2lRLDBCQUEwQixJQUFJLENBQUMsSUFBSVIsVUFBVSxDQUFBO0FBQ3ZELEtBQUE7QUFFQSxJQUFBLElBQUkxVSxNQUFNLEVBQUU7QUFBQSxNQUFBLElBQUEscUJBQUEsQ0FBQTtNQUVSLElBQUksQ0FBQ21WLGFBQWEsQ0FBQ25WLE1BQU0sQ0FBQ0EsTUFBTSxFQUFFb1IsWUFBWSxDQUFDSCxZQUFZLENBQUMsQ0FBQTs7TUFJNUQsSUFBSSxDQUFDc0QsaUJBQWlCLElBQUksQ0FBQ3ZVLE1BQU0sQ0FBQ0EsTUFBTSxDQUFDc1QsaUJBQWlCLEVBQUU7UUFDeEQsSUFBSSxDQUFDOEIsS0FBSyxDQUFDaEUsWUFBWSxFQUFFcFIsTUFBTSxDQUFDQSxNQUFNLENBQUMsQ0FBQTtBQUMzQyxPQUFBO01BR0EsTUFBTXFWLFFBQVEsR0FBR25ILEdBQUcsRUFBRSxDQUFBO0FBR3RCakosTUFBQUEsS0FBSyxDQUFDcVEsWUFBWSxDQUFDZCxXQUFXLEVBQUV4VSxNQUFNLENBQUNBLE1BQU0sQ0FBQ3lMLElBQUksRUFBRWlKLFVBQVUsQ0FBQyxDQUFBO0FBRy9ELE1BQUEsSUFBSSxDQUFDcFosU0FBUyxJQUFJNFMsR0FBRyxFQUFFLEdBQUdtSCxRQUFRLENBQUE7QUFHbEMsTUFBQSxNQUFNRSxPQUFPLEdBQUd0USxLQUFLLENBQUN1USxTQUFTLENBQUE7QUFDL0IsTUFBQSxNQUFNQyxPQUFPLEdBQUdqQixXQUFXLEdBQUdlLE9BQU8sQ0FBQ0csa0JBQWtCLENBQUNoQixVQUFVLENBQUMsR0FBR2EsT0FBTyxDQUFDSSxhQUFhLENBQUNqQixVQUFVLENBQUMsQ0FBQTs7QUFHeEcsTUFBQSxJQUFJLENBQUM1VyxLQUFLLENBQUM4WCxTQUFTLENBQUNDLGdCQUFnQixDQUFDNVEsS0FBSyxFQUFFd1EsT0FBTyxFQUFFakIsV0FBVyxDQUFDLENBQUE7O0FBR2xFLE1BQUEsSUFBSXJRLHdCQUF3QixJQUFJaU4sWUFBWSxDQUFDMEUsYUFBYSxFQUFFO1FBQ3hEMUUsWUFBWSxDQUFDMEUsYUFBYSxDQUFDQyxRQUFRLENBQUMsSUFBSSxDQUFDQyxpQkFBaUIsQ0FBQyxDQUFBOztBQUczRCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUNDLHFCQUFxQixJQUFJLElBQUksQ0FBQ25ZLEtBQUssQ0FBQ3VTLFFBQVEsQ0FBQzZGLFVBQVUsS0FBS2pSLEtBQUssQ0FBQzBNLEVBQUUsRUFBRTtVQUM1RSxJQUFJLENBQUNzRSxxQkFBcUIsR0FBRyxJQUFJLENBQUE7VUFDakNFLGtCQUFrQixDQUFDdFIsTUFBTSxDQUFDdU0sWUFBWSxDQUFDMEUsYUFBYSxFQUFFLElBQUksQ0FBQ2hZLEtBQUssQ0FBQyxDQUFBO0FBQ3JFLFNBQUE7QUFDSixPQUFBOztBQUdBLE1BQUEsSUFBSSxDQUFDQSxLQUFLLENBQUNzWSxhQUFhLEdBQUdwVyxNQUFNLENBQUNBLE1BQU0sQ0FBQTtBQUV4QyxNQUFBLElBQUksQ0FBQ3FXLGlCQUFpQixDQUFDclcsTUFBTSxDQUFDQSxNQUFNLEVBQUVvUixZQUFZLENBQUNILFlBQVksRUFBRUcsWUFBWSxDQUFDLENBQUE7O0FBSTlFLE1BQUEsTUFBTWhLLFNBQVMsR0FBRyxDQUFDLEVBQUVwSCxNQUFNLENBQUNBLE1BQU0sQ0FBQ3NXLFVBQVUsSUFBR2xGLFlBQVksNkNBQVpBLFlBQVksQ0FBRUgsWUFBWSxLQUExQixJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEscUJBQUEsQ0FBNEJzRixLQUFLLENBQUMsQ0FBQSxDQUFBO0FBRWxGLE1BQUEsTUFBTUMsS0FBSyxHQUFHLElBQUksQ0FBQ3RiLGlCQUFpQixDQUFBO0FBQ3BDLE1BQUEsSUFBSSxDQUFDNFMsYUFBYSxDQUFDOU4sTUFBTSxDQUFDQSxNQUFNLEVBQ2J5VixPQUFPLENBQUNnQixJQUFJLEVBQ1poQixPQUFPLENBQUN4VixNQUFNLEVBQ2RnRixLQUFLLENBQUN1TCxZQUFZLEVBQ2xCdkwsS0FBSyxDQUFDeVIsVUFBVSxFQUNoQnpSLEtBQUssQ0FBQ0QsV0FBVyxFQUNqQkMsS0FBSyxDQUFDMFIsVUFBVSxFQUNoQjFSLEtBQUssRUFDTG1DLFNBQVMsQ0FBQyxDQUFBO0FBQzdCbkMsTUFBQUEsS0FBSyxDQUFDL0osaUJBQWlCLElBQUksSUFBSSxDQUFDQSxpQkFBaUIsR0FBR3NiLEtBQUssQ0FBQTs7TUFLekR2YixNQUFNLENBQUM2TixhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDNUM3TixNQUFBQSxNQUFNLENBQUNtUCxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDNUJuUCxNQUFBQSxNQUFNLENBQUN5TyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUNoQ3pPLE1BQUFBLE1BQU0sQ0FBQzZPLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQTs7QUFHMUIsTUFBQSxJQUFJc0gsWUFBWSxDQUFDd0YsYUFBYSxJQUFJNVcsTUFBTSxDQUFDNlcsWUFBWSxFQUFFO1FBQ25EN1csTUFBTSxDQUFDNlcsWUFBWSxFQUFFLENBQUE7QUFDekIsT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUNyQyxXQUFXLElBQUl2UCxLQUFLLENBQUM2UixrQkFBa0IsRUFBRTtBQUMxQzdSLE1BQUFBLEtBQUssQ0FBQzZSLGtCQUFrQixDQUFDcEMsVUFBVSxDQUFDLENBQUE7QUFDeEMsS0FBQyxNQUFNLElBQUlGLFdBQVcsSUFBSXZQLEtBQUssQ0FBQzhSLHVCQUF1QixFQUFFO0FBQ3JEOVIsTUFBQUEsS0FBSyxDQUFDOFIsdUJBQXVCLENBQUNyQyxVQUFVLENBQUMsQ0FBQTtBQUM3QyxLQUFBO0FBQ0EsSUFBQSxJQUFJelAsS0FBSyxDQUFDNFIsWUFBWSxJQUFJLEVBQUU1UixLQUFLLENBQUMrUiwyQkFBMkIsR0FBSSxDQUFDLElBQUl0QyxVQUFXLENBQUMsRUFBRTtNQUNoRnpQLEtBQUssQ0FBQ2dTLGtCQUFrQixJQUFJLEVBQUV6QyxXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2xELE1BQUEsSUFBSXZQLEtBQUssQ0FBQ2dTLGtCQUFrQixLQUFLLENBQUMsRUFBRTtBQUNoQ2hTLFFBQUFBLEtBQUssQ0FBQzRSLFlBQVksQ0FBQ25DLFVBQVUsQ0FBQyxDQUFBO0FBQzlCelAsUUFBQUEsS0FBSyxDQUFDK1IsMkJBQTJCLElBQUksQ0FBQyxJQUFJdEMsVUFBVSxDQUFBO0FBQ3BEelAsUUFBQUEsS0FBSyxDQUFDZ1Msa0JBQWtCLEdBQUdoUyxLQUFLLENBQUNpUyxxQkFBcUIsQ0FBQTtBQUMxRCxPQUFBO0FBQ0osS0FBQTtBQUVBdkMsSUFBQUEsYUFBYSxDQUFDd0MsWUFBWSxDQUFDLElBQUksQ0FBQ2xjLE1BQU0sQ0FBQyxDQUFBO0FBQ3ZDMFosSUFBQUEsYUFBYSxDQUFDd0MsWUFBWSxDQUFDLElBQUksQ0FBQ2xjLE1BQU0sQ0FBQyxDQUFBO0FBR3ZDZ0ssSUFBQUEsS0FBSyxDQUFDbVMsV0FBVyxJQUFJbEosR0FBRyxFQUFFLEdBQUcyRyxRQUFRLENBQUE7QUFFekMsR0FBQTtBQUNKLENBQUE7QUFob0NNaGEsZUFBZSxDQW9FVmdMLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQXBFNUJoTCxlQUFlLENBc0VWaUwsa0JBQWtCLEdBQUcsQ0FBQyxDQUFBO0FBdEUzQmpMLGVBQWUsQ0F3RVZrTCxlQUFlLEdBQUcsQ0FBQzs7OzsifQ==
