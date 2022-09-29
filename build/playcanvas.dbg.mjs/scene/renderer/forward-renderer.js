/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';
import { Mat3 } from '../../math/mat3.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec3 } from '../../math/vec3.js';
import { Color } from '../../math/color.js';
import { BoundingSphere } from '../../shape/bounding-sphere.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, BINDGROUP_VIEW, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, CULLFACE_FRONTANDBACK, CULLFACE_FRONT, CULLFACE_BACK, FUNC_ALWAYS, STENCILOP_KEEP, BINDGROUP_MESH, SEMANTIC_ATTR } from '../../graphics/constants.js';
import { DebugGraphics } from '../../graphics/debug-graphics.js';
import { UniformBuffer } from '../../graphics/uniform-buffer.js';
import { UniformBufferFormat, UniformFormat } from '../../graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat, BindTextureFormat } from '../../graphics/bind-group-format.js';
import { BindGroup } from '../../graphics/bind-group.js';
import { RenderPass } from '../../graphics/render-pass.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, FOG_NONE, FOG_LINEAR, COMPUPDATED_LIGHTS, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, COMPUPDATED_INSTANCES, LAYERID_DEPTH } from '../constants.js';
import { Material } from '../materials/material.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { ShadowRenderer } from './shadow-renderer.js';
import { StaticMeshes } from './static-meshes.js';
import { CookieRenderer } from './cookie-renderer.js';
import { LightCamera } from './light-camera.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';

const viewInvMat = new Mat4();
const viewMat = new Mat4();
const viewMat3 = new Mat3();
const viewProjMat = new Mat4();
let projMat;
const flipYMat = new Mat4().setScale(1, -1, 1);
const flippedViewProjMat = new Mat4();
const flippedSkyboxProjMat = new Mat4();
const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();
const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);
const tempSphere = new BoundingSphere();
const boneTextureSize = [0, 0, 0, 0];
let boneTexture, instancingData, modelMatrix;
let keyA, keyB;
let _skinUpdateIndex = 0;
const _drawCallList = {
  drawCalls: [],
  isNewMaterial: [],
  lightMaskChanged: []
};

const _tempMaterialSet = new Set();

class ForwardRenderer {
  constructor(graphicsDevice) {
    this.clustersDebugRendered = false;
    this.device = graphicsDevice;
    this.scene = null;
    this._shadowDrawCalls = 0;
    this._forwardDrawCalls = 0;
    this._skinDrawCalls = 0;
    this._numDrawCallsCulled = 0;
    this._instancedDrawCalls = 0;
    this._camerasRendered = 0;
    this._materialSwitches = 0;
    this._shadowMapUpdates = 0;
    this._shadowMapTime = 0;
    this._depthMapTime = 0;
    this._forwardTime = 0;
    this._cullTime = 0;
    this._sortTime = 0;
    this._skinTime = 0;
    this._morphTime = 0;
    this._layerCompositionUpdateTime = 0;
    this._lightClustersTime = 0;
    this._lightClusters = 0;
    const device = this.device;
    this.library = device.getProgramLibrary();
    this.lightTextureAtlas = new LightTextureAtlas(device);
    this._shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
    this._cookieRenderer = new CookieRenderer(device, this.lightTextureAtlas);
    const scope = device.scope;
    this.projId = scope.resolve('matrix_projection');
    this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
    this.viewId = scope.resolve('matrix_view');
    this.viewId3 = scope.resolve('matrix_view3');
    this.viewInvId = scope.resolve('matrix_viewInverse');
    this.viewProjId = scope.resolve('matrix_viewProjection');
    this.flipYId = scope.resolve('projectionFlipY');
    this.viewPos = new Float32Array(3);
    this.viewPosId = scope.resolve('view_position');
    this.nearClipId = scope.resolve('camera_near');
    this.farClipId = scope.resolve('camera_far');
    this.cameraParamsId = scope.resolve('camera_params');
    this.tbnBasis = scope.resolve('tbnBasis');
    this.fogColorId = scope.resolve('fog_color');
    this.fogStartId = scope.resolve('fog_start');
    this.fogEndId = scope.resolve('fog_end');
    this.fogDensityId = scope.resolve('fog_density');
    this.modelMatrixId = scope.resolve('matrix_model');
    this.normalMatrixId = scope.resolve('matrix_normal');
    this.poseMatrixId = scope.resolve('matrix_pose[0]');
    this.boneTextureId = scope.resolve('texture_poseMap');
    this.boneTextureSizeId = scope.resolve('texture_poseMapSize');
    this.morphWeightsA = scope.resolve('morph_weights_a');
    this.morphWeightsB = scope.resolve('morph_weights_b');
    this.morphPositionTex = scope.resolve('morphPositionTex');
    this.morphNormalTex = scope.resolve('morphNormalTex');
    this.morphTexParams = scope.resolve('morph_tex_params');
    this.alphaTestId = scope.resolve('alpha_ref');
    this.opacityMapId = scope.resolve('texture_opacityMap');
    this.ambientId = scope.resolve('light_globalAmbient');
    this.exposureId = scope.resolve('exposure');
    this.skyboxIntensityId = scope.resolve('skyboxIntensity');
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
    this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');
    this.fogColor = new Float32Array(3);
    this.ambientColor = new Float32Array(3);
    this.cameraParams = new Float32Array(4);
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;
  }

  destroy() {
    this._shadowRenderer.destroy();

    this._shadowRenderer = null;

    this._cookieRenderer.destroy();

    this._cookieRenderer = null;
    this.lightTextureAtlas.destroy();
    this.lightTextureAtlas = null;
  }

  sortCompare(drawCallA, drawCallB) {
    if (drawCallA.layer === drawCallB.layer) {
      if (drawCallA.drawOrder && drawCallB.drawOrder) {
        return drawCallA.drawOrder - drawCallB.drawOrder;
      } else if (drawCallA.zdist && drawCallB.zdist) {
        return drawCallB.zdist - drawCallA.zdist;
      } else if (drawCallA.zdist2 && drawCallB.zdist2) {
        return drawCallA.zdist2 - drawCallB.zdist2;
      }
    }

    return drawCallB._key[SORTKEY_FORWARD] - drawCallA._key[SORTKEY_FORWARD];
  }

  sortCompareMesh(drawCallA, drawCallB) {
    if (drawCallA.layer === drawCallB.layer) {
      if (drawCallA.drawOrder && drawCallB.drawOrder) {
        return drawCallA.drawOrder - drawCallB.drawOrder;
      } else if (drawCallA.zdist && drawCallB.zdist) {
        return drawCallB.zdist - drawCallA.zdist;
      }
    }

    keyA = drawCallA._key[SORTKEY_FORWARD];
    keyB = drawCallB._key[SORTKEY_FORWARD];

    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
      return drawCallB.mesh.id - drawCallA.mesh.id;
    }

    return keyB - keyA;
  }

  depthSortCompare(drawCallA, drawCallB) {
    keyA = drawCallA._key[SORTKEY_DEPTH];
    keyB = drawCallB._key[SORTKEY_DEPTH];

    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
      return drawCallB.mesh.id - drawCallA.mesh.id;
    }

    return keyB - keyA;
  }

  updateCameraFrustum(camera) {
    if (camera.xr && camera.xr.views.length) {
      const view = camera.xr.views[0];
      viewProjMat.mul2(view.projMat, view.viewOffMat);
      camera.frustum.setFromMat4(viewProjMat);
      return;
    }

    projMat = camera.projectionMatrix;

    if (camera.calculateProjection) {
      camera.calculateProjection(projMat, VIEW_CENTER);
    }

    if (camera.calculateTransform) {
      camera.calculateTransform(viewInvMat, VIEW_CENTER);
    } else {
      const pos = camera._node.getPosition();

      const rot = camera._node.getRotation();

      viewInvMat.setTRS(pos, rot, Vec3.ONE);
      this.viewInvId.setValue(viewInvMat.data);
    }

    viewMat.copy(viewInvMat).invert();
    viewProjMat.mul2(projMat, viewMat);
    camera.frustum.setFromMat4(viewProjMat);
  }

  initViewBindGroupFormat() {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      this.viewUniformFormat = new UniformBufferFormat(this.device, [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)]);
      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)], [new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
    }
  }

  setCameraUniforms(camera, target, renderAction) {
    let transform;
    let viewCount = 1;

    if (camera.xr && camera.xr.session) {
      const parent = camera._node.parent;
      if (parent) transform = parent.getWorldTransform();
      const views = camera.xr.views;
      viewCount = views.length;

      for (let v = 0; v < viewCount; v++) {
        const view = views[v];

        if (parent) {
          view.viewInvOffMat.mul2(transform, view.viewInvMat);
          view.viewOffMat.copy(view.viewInvOffMat).invert();
        } else {
          view.viewInvOffMat.copy(view.viewInvMat);
          view.viewOffMat.copy(view.viewMat);
        }

        view.viewMat3.setFromMat4(view.viewOffMat);
        view.projViewOffMat.mul2(view.projMat, view.viewOffMat);
        view.position[0] = view.viewInvOffMat.data[12];
        view.position[1] = view.viewInvOffMat.data[13];
        view.position[2] = view.viewInvOffMat.data[14];
        camera.frustum.setFromMat4(view.projViewOffMat);
      }
    } else {
      projMat = camera.projectionMatrix;

      if (camera.calculateProjection) {
        camera.calculateProjection(projMat, VIEW_CENTER);
      }

      this.projId.setValue(projMat.data);
      this.projSkyboxId.setValue(camera.getProjectionMatrixSkybox().data);

      if (camera.calculateTransform) {
        camera.calculateTransform(viewInvMat, VIEW_CENTER);
      } else {
        const pos = camera._node.getPosition();

        const rot = camera._node.getRotation();

        viewInvMat.setTRS(pos, rot, Vec3.ONE);
      }

      this.viewInvId.setValue(viewInvMat.data);
      viewMat.copy(viewInvMat).invert();
      this.viewId.setValue(viewMat.data);
      viewMat3.setFromMat4(viewMat);
      this.viewId3.setValue(viewMat3.data);
      viewProjMat.mul2(projMat, viewMat);

      if (target && target.flipY) {
        flippedViewProjMat.mul2(flipYMat, viewProjMat);
        flippedSkyboxProjMat.mul2(flipYMat, camera.getProjectionMatrixSkybox());
        this.viewProjId.setValue(flippedViewProjMat.data);
        this.projSkyboxId.setValue(flippedSkyboxProjMat.data);
      } else {
        this.viewProjId.setValue(viewProjMat.data);
        this.projSkyboxId.setValue(camera.getProjectionMatrixSkybox().data);
      }

      this.flipYId.setValue(target != null && target.flipY ? -1 : 1);
      this.dispatchViewPos(camera._node.getPosition());
      camera.frustum.setFromMat4(viewProjMat);
    }

    this.tbnBasis.setValue(target && target.flipY ? -1 : 1);
    this.nearClipId.setValue(camera._nearClip);
    this.farClipId.setValue(camera._farClip);

    if (this.scene.physicalUnits) {
      this.exposureId.setValue(camera.getExposure());
    } else {
      this.exposureId.setValue(this.scene.exposure);
    }

    const n = camera._nearClip;
    const f = camera._farClip;
    this.cameraParams[0] = 1 / f;
    this.cameraParams[1] = f;
    this.cameraParams[2] = n;
    this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
    this.cameraParamsId.setValue(this.cameraParams);

    if (this.device.supportsUniformBuffers) {
      this.setupViewUniformBuffers(renderAction, viewCount);
    }
  }

  setCamera(camera, target, clear, renderAction = null) {
    this.setCameraUniforms(camera, target, renderAction);
    this.clearView(camera, target, clear, false);
  }

  setupViewUniformBuffers(renderAction, viewCount) {
    Debug.assert(renderAction, "RenderAction cannot be null");

    if (renderAction) {
      const device = this.device;
      Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");

      while (renderAction.viewBindGroups.length < viewCount) {
        const ub = new UniformBuffer(device, this.viewUniformFormat);
        const bg = new BindGroup(device, this.viewBindGroupFormat, ub);
        renderAction.viewBindGroups.push(bg);
      }

      const viewBindGroup = renderAction.viewBindGroups[0];
      viewBindGroup.defaultUniformBuffer.update();
      viewBindGroup.update();
      device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
    }
  }

  setupViewport(camera, renderTarget) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, 'SETUP-VIEWPORT');
    const pixelWidth = renderTarget ? renderTarget.width : device.width;
    const pixelHeight = renderTarget ? renderTarget.height : device.height;
    const rect = camera.rect;
    let x = Math.floor(rect.x * pixelWidth);
    let y = Math.floor(rect.y * pixelHeight);
    let w = Math.floor(rect.z * pixelWidth);
    let h = Math.floor(rect.w * pixelHeight);
    device.setViewport(x, y, w, h);

    if (camera._scissorRectClear) {
      const scissorRect = camera.scissorRect;
      x = Math.floor(scissorRect.x * pixelWidth);
      y = Math.floor(scissorRect.y * pixelHeight);
      w = Math.floor(scissorRect.z * pixelWidth);
      h = Math.floor(scissorRect.w * pixelHeight);
    }

    device.setScissor(x, y, w, h);
    DebugGraphics.popGpuMarker(device);
  }

  clear(renderAction, camera) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, 'CLEAR-VIEWPORT');
    device.clear({
      color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
      depth: camera._clearDepth,
      stencil: camera._clearStencil,
      flags: (renderAction.clearColor ? CLEARFLAG_COLOR : 0) | (renderAction.clearDepth ? CLEARFLAG_DEPTH : 0) | (renderAction.clearStencil ? CLEARFLAG_STENCIL : 0)
    });
    DebugGraphics.popGpuMarker(device);
  }

  clearView(camera, target, clear, forceWrite) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, 'CLEAR-VIEW');
    device.setRenderTarget(target);
    device.updateBegin();

    if (forceWrite) {
      device.setColorWrite(true, true, true, true);
      device.setDepthWrite(true);
    }

    this.setupViewport(camera, target);

    if (clear) {
      const options = camera._clearOptions;
      device.clear(options ? options : {
        color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
        depth: camera._clearDepth,
        flags: (camera._clearColorBuffer ? CLEARFLAG_COLOR : 0) | (camera._clearDepthBuffer ? CLEARFLAG_DEPTH : 0) | (camera._clearStencilBuffer ? CLEARFLAG_STENCIL : 0),
        stencil: camera._clearStencil
      });
    }

    DebugGraphics.popGpuMarker(device);
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

    if (scene.sky) {
      this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
    }
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

  cull(camera, drawCalls, visibleList) {
    const cullTime = now();
    let numDrawCallsCulled = 0;
    let visibleLength = 0;
    const drawCallsCount = drawCalls.length;
    const cullingMask = camera.cullingMask || 0xFFFFFFFF;

    if (!camera.frustumCulling) {
      for (let i = 0; i < drawCallsCount; i++) {
        const drawCall = drawCalls[i];
        if (!drawCall.visible && !drawCall.command) continue;
        if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;
        visibleList[visibleLength] = drawCall;
        visibleLength++;
        drawCall.visibleThisFrame = true;
      }

      return visibleLength;
    }

    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];

      if (!drawCall.command) {
        if (!drawCall.visible) continue;
        let visible = true;
        if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

        if (drawCall.cull) {
          visible = drawCall._isVisible(camera);
          numDrawCallsCulled++;
        }

        if (visible) {
          visibleList[visibleLength] = drawCall;
          visibleLength++;
          drawCall.visibleThisFrame = true;
        }
      } else {
        visibleList[visibleLength] = drawCall;
        visibleLength++;
        drawCall.visibleThisFrame = true;
      }
    }

    this._cullTime += now() - cullTime;
    this._numDrawCallsCulled += numDrawCallsCulled;
    return visibleLength;
  }

  cullLights(camera, lights) {
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    const physicalUnits = this.scene.physicalUnits;

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];

      if (light.enabled) {
        if (light._type !== LIGHTTYPE_DIRECTIONAL) {
          light.getBoundingSphere(tempSphere);

          if (camera.frustum.containsSphere(tempSphere)) {
            light.visibleThisFrame = true;
            light.usePhysicalUnits = physicalUnits;
            const screenSize = camera.getScreenSize(tempSphere);
            light.maxScreenSize = Math.max(light.maxScreenSize, screenSize);
          } else {
            if (!clusteredLightingEnabled) {
              if (light.castShadows && !light.shadowMap) {
                light.visibleThisFrame = true;
              }
            }
          }
        } else {
          light.usePhysicalUnits = this.scene.physicalUnits;
        }
      }
    }
  }

  updateCpuSkinMatrices(drawCalls) {
    _skinUpdateIndex++;
    const drawCallsCount = drawCalls.length;
    if (drawCallsCount === 0) return;
    const skinTime = now();

    for (let i = 0; i < drawCallsCount; i++) {
      const si = drawCalls[i].skinInstance;

      if (si) {
        si.updateMatrices(drawCalls[i].node, _skinUpdateIndex);
        si._dirty = true;
      }
    }

    this._skinTime += now() - skinTime;
  }

  updateGpuSkinMatrices(drawCalls) {
    const skinTime = now();
    const drawCallsCount = drawCalls.length;

    for (let i = 0; i < drawCallsCount; i++) {
      if (!drawCalls[i].visibleThisFrame) continue;
      const skin = drawCalls[i].skinInstance;

      if (skin) {
        if (skin._dirty) {
          skin.updateMatrixPalette(drawCalls[i].node, _skinUpdateIndex);
          skin._dirty = false;
        }
      }
    }

    this._skinTime += now() - skinTime;
  }

  updateMorphing(drawCalls) {
    const morphTime = now();
    const drawCallsCount = drawCalls.length;

    for (let i = 0; i < drawCallsCount; i++) {
      const morphInst = drawCalls[i].morphInstance;

      if (morphInst && morphInst._dirty && drawCalls[i].visibleThisFrame) {
        morphInst.update();
      }
    }

    this._morphTime += now() - morphTime;
  }

  setBaseConstants(device, material) {
    device.setCullMode(material.cull);

    if (material.opacityMap) {
      this.opacityMapId.setValue(material.opacityMap);
      this.alphaTestId.setValue(material.alphaTest);
    }
  }

  setSkinning(device, meshInstance, material) {
    if (meshInstance.skinInstance) {
      this._skinDrawCalls++;

      if (device.supportsBoneTextures) {
        boneTexture = meshInstance.skinInstance.boneTexture;
        this.boneTextureId.setValue(boneTexture);
        boneTextureSize[0] = boneTexture.width;
        boneTextureSize[1] = boneTexture.height;
        boneTextureSize[2] = 1.0 / boneTexture.width;
        boneTextureSize[3] = 1.0 / boneTexture.height;
        this.boneTextureSizeId.setValue(boneTextureSize);
      } else {
        this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
      }
    }
  }

  drawInstance(device, meshInstance, mesh, style, normal) {
    DebugGraphics.pushGpuMarker(device, meshInstance.node.name);
    instancingData = meshInstance.instancingData;

    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.setVertexBuffer(instancingData.vertexBuffer);
        device.draw(mesh.primitive[style], instancingData.count);
      }
    } else {
      modelMatrix = meshInstance.node.worldTransform;
      this.modelMatrixId.setValue(modelMatrix.data);

      if (normal) {
        this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
      }

      device.draw(mesh.primitive[style]);
    }

    DebugGraphics.popGpuMarker(device);
  }

  drawInstance2(device, meshInstance, mesh, style) {
    DebugGraphics.pushGpuMarker(device, meshInstance.node.name);
    instancingData = meshInstance.instancingData;

    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.draw(mesh.primitive[style], instancingData.count, true);
      }
    } else {
      device.draw(mesh.primitive[style], undefined, true);
    }

    DebugGraphics.popGpuMarker(device);
  }

  renderShadows(lights, camera) {
    const isClustered = this.scene.clusteredLightingEnabled;
    const shadowMapStartTime = now();

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];

      if (isClustered && light._type !== LIGHTTYPE_DIRECTIONAL) {
        if (!light.atlasViewportAllocated) {
          continue;
        }

        if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
          light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        }
      }

      this._shadowRenderer.render(light, camera);
    }

    this._shadowMapTime += now() - shadowMapStartTime;
  }

  renderCookies(lights) {
    const cookieRenderTarget = this.lightTextureAtlas.cookieRenderTarget;

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (!light.atlasViewportAllocated) continue;
      if (!light.atlasSlotUpdated) continue;

      this._cookieRenderer.render(light, cookieRenderTarget);
    }
  }

  setCullMode(cullFaces, flip, drawCall) {
    const material = drawCall.material;
    let mode = CULLFACE_NONE;

    if (cullFaces) {
      let flipFaces = 1;

      if (material.cull > CULLFACE_NONE && material.cull < CULLFACE_FRONTANDBACK) {
        if (drawCall.flipFaces) flipFaces *= -1;
        if (flip) flipFaces *= -1;
        const wt = drawCall.node.worldTransform;
        wt.getX(worldMatX);
        wt.getY(worldMatY);
        wt.getZ(worldMatZ);
        worldMatX.cross(worldMatX, worldMatY);

        if (worldMatX.dot(worldMatZ) < 0) {
          flipFaces *= -1;
        }
      }

      if (flipFaces < 0) {
        mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
      } else {
        mode = material.cull;
      }
    }

    this.device.setCullMode(mode);

    if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
      const wt2 = drawCall.node.worldTransform;
      wt2.getX(worldMatX);
      wt2.getY(worldMatY);
      wt2.getZ(worldMatZ);
      worldMatX.cross(worldMatX, worldMatY);

      if (worldMatX.dot(worldMatZ) < 0) {
        this.twoSidedLightingNegScaleFactorId.setValue(-1.0);
      } else {
        this.twoSidedLightingNegScaleFactorId.setValue(1.0);
      }
    }
  }

  setVertexBuffers(device, mesh) {
    device.setVertexBuffer(mesh.vertexBuffer);
  }

  setMorphing(device, morphInstance) {
    if (morphInstance) {
      if (morphInstance.morph.useTextureMorph) {
        device.setVertexBuffer(morphInstance.morph.vertexBufferIds);
        this.morphPositionTex.setValue(morphInstance.texturePositions);
        this.morphNormalTex.setValue(morphInstance.textureNormals);
        this.morphTexParams.setValue(morphInstance._textureParams);
      } else {
        for (let t = 0; t < morphInstance._activeVertexBuffers.length; t++) {
          const vb = morphInstance._activeVertexBuffers[t];

          if (vb) {
            const semantic = SEMANTIC_ATTR + (t + 8);
            vb.format.elements[0].name = semantic;
            vb.format.elements[0].scopeId = device.scope.resolve(semantic);
            vb.format.update();
            device.setVertexBuffer(vb);
          }
        }

        this.morphWeightsA.setValue(morphInstance._shaderMorphWeightsA);
        this.morphWeightsB.setValue(morphInstance._shaderMorphWeightsB);
      }
    }
  }

  dispatchViewPos(position) {
    const vp = this.viewPos;
    vp[0] = position.x;
    vp[1] = position.y;
    vp[2] = position.z;
    this.viewPosId.setValue(vp);
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
        }

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
        this.setSkinning(device, drawCall, material);

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

  updateShaders(drawCalls, onlyLitShaders) {
    const count = drawCalls.length;

    for (let i = 0; i < count; i++) {
      const mat = drawCalls[i].material;

      if (mat) {
        if (!_tempMaterialSet.has(mat)) {
          _tempMaterialSet.add(mat);

          if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
            if (onlyLitShaders) {
              if (!mat.useLighting || mat.emitter && !mat.emitter.lighting) continue;
            }

            mat.clearVariants();
          }
        }
      }
    }

    _tempMaterialSet.clear();
  }

  beginFrame(comp, lightsChanged) {
    const meshInstances = comp._meshInstances;
    const scene = this.scene;

    if (scene.updateShaders || lightsChanged) {
      const onlyLitShaders = !scene.updateShaders && lightsChanged;
      this.updateShaders(meshInstances, onlyLitShaders);
      scene.updateShaders = false;
      scene._shaderVersion++;
    }

    this.updateCpuSkinMatrices(meshInstances);
    const miCount = meshInstances.length;

    for (let i = 0; i < miCount; i++) {
      meshInstances[i].visibleThisFrame = false;
    }

    const lights = comp._lights;
    const lightCount = lights.length;

    for (let i = 0; i < lightCount; i++) {
      lights[i].beginFrame();
    }
  }

  updateLayerComposition(comp, clusteredLightingEnabled) {
    const layerCompositionUpdateTime = now();
    const len = comp.layerList.length;

    for (let i = 0; i < len; i++) {
      comp.layerList[i]._postRenderCounter = 0;
    }

    const scene = this.scene;
    const shaderVersion = scene._shaderVersion;

    for (let i = 0; i < len; i++) {
      const layer = comp.layerList[i];
      layer._shaderVersion = shaderVersion;
      layer._skipRenderCounter = 0;
      layer._forwardDrawCalls = 0;
      layer._shadowDrawCalls = 0;
      layer._renderTime = 0;
      layer._preRenderCalledForCameras = 0;
      layer._postRenderCalledForCameras = 0;
      const transparent = comp.subLayerList[i];

      if (transparent) {
        layer._postRenderCounter |= 2;
      } else {
        layer._postRenderCounter |= 1;
      }

      layer._postRenderCounterMax = layer._postRenderCounter;

      for (let j = 0; j < layer.cameras.length; j++) {
        layer.instances.prepare(j);
      }

      if (layer._needsStaticPrepare && layer._staticLightHash && !this.scene.clusteredLightingEnabled) {
        if (layer._staticPrepareDone) {
          StaticMeshes.revert(layer.opaqueMeshInstances);
          StaticMeshes.revert(layer.transparentMeshInstances);
        }

        StaticMeshes.prepare(this.device, scene, layer.opaqueMeshInstances, layer._lights);
        StaticMeshes.prepare(this.device, scene, layer.transparentMeshInstances, layer._lights);
        comp._dirty = true;
        scene.updateShaders = true;
        layer._needsStaticPrepare = false;
        layer._staticPrepareDone = true;
      }
    }

    const updated = comp._update(this.device, clusteredLightingEnabled);

    this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
    return updated;
  }

  gpuUpdate(drawCalls) {
    this.updateGpuSkinMatrices(drawCalls);
    this.updateMorphing(drawCalls);
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

  cullShadowmaps(comp) {
    for (let i = 0; i < comp._lights.length; i++) {
      const light = comp._lights[i];

      if (light._type !== LIGHTTYPE_DIRECTIONAL) {
        if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
          const casters = comp._lightCompositionData[i].shadowCastersList;

          this._shadowRenderer.cullLocal(light, casters);
        }
      }
    }

    const renderActions = comp._renderActions;

    for (let i = 0; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const count = renderAction.directionalLightsIndices.length;

      for (let j = 0; j < count; j++) {
        const lightIndex = renderAction.directionalLightsIndices[j];
        const light = comp._lights[lightIndex];
        const casters = comp._lightCompositionData[lightIndex].shadowCastersList;

        this._shadowRenderer.cullDirectional(light, casters, renderAction.camera.camera);
      }
    }
  }

  cullComposition(comp) {
    const cullTime = now();
    const renderActions = comp._renderActions;

    for (let i = 0; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const layerIndex = renderAction.layerIndex;
      const layer = comp.layerList[layerIndex];
      if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) continue;
      const transparent = comp.subLayerList[layerIndex];
      const cameraPass = renderAction.cameraIndex;
      const camera = layer.cameras[cameraPass];

      if (camera) {
        camera.frameUpdate(renderAction.renderTarget);

        if (renderAction.firstCameraUse) {
          this.updateCameraFrustum(camera.camera);
          this._camerasRendered++;
        }

        this.cullLights(camera.camera, layer._lights);
        const objects = layer.instances;
        const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

        if (!visible.done) {
          if (layer.onPreCull) {
            layer.onPreCull(cameraPass);
          }

          const drawCalls = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;
          visible.length = this.cull(camera.camera, drawCalls, visible.list);
          visible.done = true;

          if (layer.onPostCull) {
            layer.onPostCull(cameraPass);
          }
        }
      }
    }

    this.cullShadowmaps(comp);
    this._cullTime += now() - cullTime;
  }

  updateLightTextureAtlas(comp) {
    this.lightTextureAtlas.update(comp._splitLights[LIGHTTYPE_SPOT], comp._splitLights[LIGHTTYPE_OMNI], this.scene.lighting);
  }

  updateClusters(comp) {
    const startTime = now();

    for (let i = 0; i < comp._worldClusters.length; i++) {
      const cluster = comp._worldClusters[i];
      cluster.update(comp._lights, this.scene.gammaCorrection, this.scene.lighting);
    }

    this._lightClustersTime += now() - startTime;
    this._lightClusters = comp._worldClusters.length;
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
        this.renderShadows(layerComposition._splitLights[LIGHTTYPE_SPOT]);
        this.renderShadows(layerComposition._splitLights[LIGHTTYPE_OMNI]);
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
        const _renderPass2 = new RenderPass(this.device, () => {
          this.renderPassDirectionalShadows(renderAction, layerComposition);
        });

        _renderPass2.requiresCubemaps = false;
        DebugHelper.setName(_renderPass2, `DirShadowMap`);
        frameGraph.addRenderPass(_renderPass2);
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
          const _renderPass3 = new RenderPass(this.device, () => {
            this.renderPassPostprocessing(renderAction, layerComposition);
          });

          _renderPass3.requiresCubemaps = false;
          DebugHelper.setName(_renderPass3, `Postprocess`);
          frameGraph.addRenderPass(_renderPass3);
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
    const isWebgl1DepthGrabPass = isGrabPass && !this.device.webgl2 && camera.renderSceneDepthMap;
    const isRealPass = !isGrabPass || isWebgl1DepthGrabPass;

    if (isRealPass) {
      renderPass.init(renderTarget);
      renderPass.fullSizeClearRect = camera.camera.fullSizeClearRect;

      if (isWebgl1DepthGrabPass) {
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
    const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
    this.clustersDebugRendered = false;
    this.initViewBindGroupFormat();

    this.scene._updateSky(this.device);

    const updated = this.updateLayerComposition(comp, clusteredLightingEnabled);
    const lightsChanged = (updated & COMPUPDATED_LIGHTS) !== 0;
    this.updateLightStats(comp, updated);
    this.beginFrame(comp, lightsChanged);
    this.setSceneConstants();
    this.cullComposition(comp);
    this.gpuUpdate(comp._meshInstances);
  }

  renderPassDirectionalShadows(renderAction, layerComposition) {
    Debug.assert(renderAction.directionalLights.length > 0);
    const layer = layerComposition.layerList[renderAction.layerIndex];
    const camera = layer.cameras[renderAction.cameraIndex];
    this.renderShadows(renderAction.directionalLights, camera.camera);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uLy4uL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQ0xFQVJGTEFHX0NPTE9SLCBDTEVBUkZMQUdfREVQVEgsIENMRUFSRkxBR19TVEVOQ0lMLFxuICAgIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX0ZST05ULCBDVUxMRkFDRV9GUk9OVEFOREJBQ0ssIENVTExGQUNFX05PTkUsXG4gICAgRlVOQ19BTFdBWVMsXG4gICAgU0VNQU5USUNfQVRUUixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9NQVQ0LFxuICAgIFNIQURFUlNUQUdFX1ZFUlRFWCwgU0hBREVSU1RBR0VfRlJBR01FTlQsXG4gICAgQklOREdST1VQX1ZJRVcsIEJJTkRHUk9VUF9NRVNILCBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSxcbiAgICBURVhUVVJFRElNRU5TSU9OXzJELCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVFxufSBmcm9tICcuLi8uLi9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXIgfSBmcm9tICcuLi8uLi9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtRm9ybWF0LCBVbmlmb3JtQnVmZmVyRm9ybWF0IH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRHcm91cEZvcm1hdCwgQmluZEJ1ZmZlckZvcm1hdCwgQmluZFRleHR1cmVGb3JtYXQgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBCaW5kR3JvdXAgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9iaW5kLWdyb3VwLmpzJztcbmltcG9ydCB7IFJlbmRlclBhc3MgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9yZW5kZXItcGFzcy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQ09NUFVQREFURURfSU5TVEFOQ0VTLCBDT01QVVBEQVRFRF9MSUdIVFMsXG4gICAgRk9HX05PTkUsIEZPR19MSU5FQVIsXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCxcbiAgICBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCwgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19CQUtFLFxuICAgIFNIQURPV1VQREFURV9OT05FLFxuICAgIFNPUlRLRVlfREVQVEgsIFNPUlRLRVlfRk9SV0FSRCxcbiAgICBWSUVXX0NFTlRFUiwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRSwgTEFZRVJJRF9ERVBUSCwgUFJPSkVDVElPTl9PUlRIT0dSQVBISUNcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IExpZ2h0VGV4dHVyZUF0bGFzIH0gZnJvbSAnLi4vbGlnaHRpbmcvbGlnaHQtdGV4dHVyZS1hdGxhcy5qcyc7XG5cbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgU3RhdGljTWVzaGVzIH0gZnJvbSAnLi9zdGF0aWMtbWVzaGVzLmpzJztcbmltcG9ydCB7IENvb2tpZVJlbmRlcmVyIH0gZnJvbSAnLi9jb29raWUtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBXb3JsZENsdXN0ZXJzRGVidWcgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy1kZWJ1Zy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9yZW5kZXItYWN0aW9uLmpzJykuUmVuZGVyQWN0aW9ufSBSZW5kZXJBY3Rpb24gKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSBSZW5kZXJUYXJnZXQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBMYXllciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3NjZW5lLmpzJykuU2NlbmV9IFNjZW5lICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gTWVzaEluc3RhbmNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vY2FtZXJhLmpzJykuQ2FtZXJhfSBDYW1lcmEgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9mcmFtZS1ncmFwaC5qcycpLkZyYW1lR3JhcGh9IEZyYW1lR3JhcGggKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IExheWVyQ29tcG9zaXRpb24gKi9cblxuY29uc3Qgdmlld0ludk1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2aWV3TWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdNYXQzID0gbmV3IE1hdDMoKTtcbmNvbnN0IHZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbmxldCBwcm9qTWF0O1xuXG5jb25zdCBmbGlwWU1hdCA9IG5ldyBNYXQ0KCkuc2V0U2NhbGUoMSwgLTEsIDEpO1xuY29uc3QgZmxpcHBlZFZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IGZsaXBwZWRTa3lib3hQcm9qTWF0ID0gbmV3IE1hdDQoKTtcblxuY29uc3Qgd29ybGRNYXRYID0gbmV3IFZlYzMoKTtcbmNvbnN0IHdvcmxkTWF0WSA9IG5ldyBWZWMzKCk7XG5jb25zdCB3b3JsZE1hdFogPSBuZXcgVmVjMygpO1xuXG5jb25zdCB3ZWJnbDFEZXB0aENsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUpO1xuY29uc3QgdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgYm9uZVRleHR1cmVTaXplID0gWzAsIDAsIDAsIDBdO1xubGV0IGJvbmVUZXh0dXJlLCBpbnN0YW5jaW5nRGF0YSwgbW9kZWxNYXRyaXg7XG5cbmxldCBrZXlBLCBrZXlCO1xuXG5sZXQgX3NraW5VcGRhdGVJbmRleCA9IDA7XG5cbmNvbnN0IF9kcmF3Q2FsbExpc3QgPSB7XG4gICAgZHJhd0NhbGxzOiBbXSxcbiAgICBpc05ld01hdGVyaWFsOiBbXSxcbiAgICBsaWdodE1hc2tDaGFuZ2VkOiBbXVxufTtcblxuY29uc3QgX3RlbXBNYXRlcmlhbFNldCA9IG5ldyBTZXQoKTtcblxuLyoqXG4gKiBUaGUgZm9yd2FyZCByZW5kZXJlciByZW5kZXJzIHtAbGluayBTY2VuZX1zLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgRm9yd2FyZFJlbmRlcmVyIHtcbiAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRm9yd2FyZFJlbmRlcmVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIHJlbmRlcmVyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7U2NlbmV8bnVsbH0gKi9cbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9kZXB0aE1hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1bGxUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fc29ydFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9za2luVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX21vcnBoVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gMDtcblxuICAgICAgICAvLyBTaGFkZXJzXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICB0aGlzLmxpYnJhcnkgPSBkZXZpY2UuZ2V0UHJvZ3JhbUxpYnJhcnkoKTtcblxuICAgICAgICAvLyB0ZXh0dXJlIGF0bGFzIG1hbmFnaW5nIHNoYWRvdyBtYXAgLyBjb29raWUgdGV4dHVyZSBhdGxhc3NpbmcgZm9yIG9tbmkgYW5kIHNwb3QgbGlnaHRzXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBuZXcgTGlnaHRUZXh0dXJlQXRsYXMoZGV2aWNlKTtcblxuICAgICAgICAvLyBzaGFkb3dzXG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyID0gbmV3IFNoYWRvd1JlbmRlcmVyKHRoaXMsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuXG4gICAgICAgIC8vIGNvb2tpZXNcbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIgPSBuZXcgQ29va2llUmVuZGVyZXIoZGV2aWNlLCB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzY29wZSA9IGRldmljZS5zY29wZTtcbiAgICAgICAgdGhpcy5wcm9qSWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcHJvamVjdGlvbicpO1xuICAgICAgICB0aGlzLnByb2pTa3lib3hJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wcm9qZWN0aW9uU2t5Ym94Jyk7XG4gICAgICAgIHRoaXMudmlld0lkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXcnKTtcbiAgICAgICAgdGhpcy52aWV3SWQzID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXczJyk7XG4gICAgICAgIHRoaXMudmlld0ludklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdJbnZlcnNlJyk7XG4gICAgICAgIHRoaXMudmlld1Byb2pJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3UHJvamVjdGlvbicpO1xuICAgICAgICB0aGlzLmZsaXBZSWQgPSBzY29wZS5yZXNvbHZlKCdwcm9qZWN0aW9uRmxpcFknKTtcbiAgICAgICAgdGhpcy52aWV3UG9zID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQgPSBzY29wZS5yZXNvbHZlKCd2aWV3X3Bvc2l0aW9uJyk7XG4gICAgICAgIHRoaXMubmVhckNsaXBJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9uZWFyJyk7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX2ZhcicpO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc0lkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX3BhcmFtcycpO1xuICAgICAgICB0aGlzLnRibkJhc2lzID0gc2NvcGUucmVzb2x2ZSgndGJuQmFzaXMnKTtcblxuICAgICAgICB0aGlzLmZvZ0NvbG9ySWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfY29sb3InKTtcbiAgICAgICAgdGhpcy5mb2dTdGFydElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX3N0YXJ0Jyk7XG4gICAgICAgIHRoaXMuZm9nRW5kSWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfZW5kJyk7XG4gICAgICAgIHRoaXMuZm9nRGVuc2l0eUlkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2RlbnNpdHknKTtcblxuICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbW9kZWwnKTtcbiAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9ub3JtYWwnKTtcbiAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcG9zZVswXScpO1xuICAgICAgICB0aGlzLmJvbmVUZXh0dXJlSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX3Bvc2VNYXAnKTtcbiAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfcG9zZU1hcFNpemUnKTtcblxuICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0EgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF93ZWlnaHRzX2EnKTtcbiAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNCID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfd2VpZ2h0c19iJyk7XG4gICAgICAgIHRoaXMubW9ycGhQb3NpdGlvblRleCA9IHNjb3BlLnJlc29sdmUoJ21vcnBoUG9zaXRpb25UZXgnKTtcbiAgICAgICAgdGhpcy5tb3JwaE5vcm1hbFRleCA9IHNjb3BlLnJlc29sdmUoJ21vcnBoTm9ybWFsVGV4Jyk7XG4gICAgICAgIHRoaXMubW9ycGhUZXhQYXJhbXMgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF90ZXhfcGFyYW1zJyk7XG5cbiAgICAgICAgdGhpcy5hbHBoYVRlc3RJZCA9IHNjb3BlLnJlc29sdmUoJ2FscGhhX3JlZicpO1xuICAgICAgICB0aGlzLm9wYWNpdHlNYXBJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuXG4gICAgICAgIHRoaXMuYW1iaWVudElkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfZ2xvYmFsQW1iaWVudCcpO1xuICAgICAgICB0aGlzLmV4cG9zdXJlSWQgPSBzY29wZS5yZXNvbHZlKCdleHBvc3VyZScpO1xuICAgICAgICB0aGlzLnNreWJveEludGVuc2l0eUlkID0gc2NvcGUucmVzb2x2ZSgnc2t5Ym94SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkID0gW107XG4gICAgICAgIHRoaXMubGlnaHREaXIgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodERpcklkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHkgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRQb3MgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0ID0gW107XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRPdXRBbmdsZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU1hdHJpeElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVPZmZzZXRJZCA9IFtdO1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXNjYWRlc1xuICAgICAgICB0aGlzLnNoYWRvd01hdHJpeFBhbGV0dGVJZCA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVEaXN0YW5jZXNJZCA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVDb3VudElkID0gW107XG5cbiAgICAgICAgdGhpcy5zY3JlZW5TaXplSWQgPSBzY29wZS5yZXNvbHZlKCd1U2NyZWVuU2l6ZScpO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkID0gc2NvcGUucmVzb2x2ZSgndHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yJyk7XG5cbiAgICAgICAgdGhpcy5mb2dDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuYW1iaWVudENvbG9yID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG51bGw7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBudWxsO1xuICAgIH1cblxuICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAvLyBTdGF0aWMgcHJvcGVydGllcyB1c2VkIGJ5IHRoZSBQcm9maWxlciBpbiB0aGUgRWRpdG9yJ3MgTGF1bmNoIFBhZ2VcbiAgICBzdGF0aWMgc2tpcFJlbmRlckNhbWVyYSA9IG51bGw7XG5cbiAgICBzdGF0aWMgX3NraXBSZW5kZXJDb3VudGVyID0gMDtcblxuICAgIHN0YXRpYyBza2lwUmVuZGVyQWZ0ZXIgPSAwO1xuICAgIC8vICNlbmRpZlxuXG4gICAgc29ydENvbXBhcmUoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QyICYmIGRyYXdDYWxsQi56ZGlzdDIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0MiAtIGRyYXdDYWxsQi56ZGlzdDI7IC8vIGZyb250IHRvIGJhY2tcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdIC0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZU1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgICAgIGtleUIgPSBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICBkZXB0aFNvcnRDb21wYXJlKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGtleUEgPSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0RFUFRIXTtcbiAgICAgICAga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfREVQVEhdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICB1cGRhdGVDYW1lcmFGcnVzdHVtKGNhbWVyYSkge1xuICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBmcnVzdHVtIGJhc2VkIG9uIFhSIHZpZXdcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSBjYW1lcmEueHIudmlld3NbMF07XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbihwcm9qTWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSh2aWV3SW52TWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGNhbWVyYS5fbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgdmlld0ludk1hdC5zZXRUUlMocG9zLCByb3QsIFZlYzMuT05FKTtcbiAgICAgICAgICAgIHRoaXMudmlld0ludklkLnNldFZhbHVlKHZpZXdJbnZNYXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgdmlld01hdC5jb3B5KHZpZXdJbnZNYXQpLmludmVydCgpO1xuXG4gICAgICAgIHZpZXdQcm9qTWF0Lm11bDIocHJvak1hdCwgdmlld01hdCk7XG4gICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICB9XG5cbiAgICBpbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpIHtcblxuICAgICAgICBpZiAodGhpcy5kZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycyAmJiAhdGhpcy52aWV3VW5pZm9ybUZvcm1hdCkge1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdCh0aGlzLmRldmljZSwgW1xuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwibWF0cml4X3ZpZXdQcm9qZWN0aW9uXCIsIFVOSUZPUk1UWVBFX01BVDQpXG4gICAgICAgICAgICBdKTtcblxuICAgICAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSB2aWV3IGJpbmQgZ3JvdXAgLSBjb250YWlucyBzaW5nbGUgdW5pZm9ybSBidWZmZXIsIGFuZCBzb21lIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnbGlnaHRzVGV4dHVyZUZsb2F0JywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUKVxuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDYW1lcmFVbmlmb3JtcyhjYW1lcmEsIHRhcmdldCwgcmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgbGV0IHRyYW5zZm9ybTtcblxuICAgICAgICBsZXQgdmlld0NvdW50ID0gMTtcbiAgICAgICAgaWYgKGNhbWVyYS54ciAmJiBjYW1lcmEueHIuc2Vzc2lvbikge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gY2FtZXJhLl9ub2RlLnBhcmVudDtcbiAgICAgICAgICAgIGlmIChwYXJlbnQpIHRyYW5zZm9ybSA9IHBhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBjb25zdCB2aWV3cyA9IGNhbWVyYS54ci52aWV3cztcbiAgICAgICAgICAgIHZpZXdDb3VudCA9IHZpZXdzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IHYgPSAwOyB2IDwgdmlld0NvdW50OyB2KyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gdmlld3Nbdl07XG5cbiAgICAgICAgICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld0ludk9mZk1hdC5tdWwyKHRyYW5zZm9ybSwgdmlldy52aWV3SW52TWF0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3T2ZmTWF0LmNvcHkodmlldy52aWV3SW52T2ZmTWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdJbnZPZmZNYXQuY29weSh2aWV3LnZpZXdJbnZNYXQpO1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdPZmZNYXQuY29weSh2aWV3LnZpZXdNYXQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZpZXcudmlld01hdDMuc2V0RnJvbU1hdDQodmlldy52aWV3T2ZmTWF0KTtcbiAgICAgICAgICAgICAgICB2aWV3LnByb2pWaWV3T2ZmTWF0Lm11bDIodmlldy5wcm9qTWF0LCB2aWV3LnZpZXdPZmZNYXQpO1xuXG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblswXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzEyXTtcbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzFdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTNdO1xuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMl0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxNF07XG5cbiAgICAgICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3LnByb2pWaWV3T2ZmTWF0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFByb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICBwcm9qTWF0ID0gY2FtZXJhLnByb2plY3Rpb25NYXRyaXg7XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbihwcm9qTWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZShwcm9qTWF0LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBTa3lib3ggUHJvamVjdGlvbiBNYXRyaXhcbiAgICAgICAgICAgIHRoaXMucHJvalNreWJveElkLnNldFZhbHVlKGNhbWVyYS5nZXRQcm9qZWN0aW9uTWF0cml4U2t5Ym94KCkuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXdJbnZlcnNlIE1hdHJpeFxuICAgICAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKHZpZXdJbnZNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9zID0gY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm90ID0gY2FtZXJhLl9ub2RlLmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICAgICAgdmlld0ludk1hdC5zZXRUUlMocG9zLCByb3QsIFZlYzMuT05FKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudmlld0ludklkLnNldFZhbHVlKHZpZXdJbnZNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgTWF0cml4XG4gICAgICAgICAgICB2aWV3TWF0LmNvcHkodmlld0ludk1hdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICB0aGlzLnZpZXdJZC5zZXRWYWx1ZSh2aWV3TWF0LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IDN4M1xuICAgICAgICAgICAgdmlld01hdDMuc2V0RnJvbU1hdDQodmlld01hdCk7XG4gICAgICAgICAgICB0aGlzLnZpZXdJZDMuc2V0VmFsdWUodmlld01hdDMuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXdQcm9qZWN0aW9uIE1hdHJpeFxuICAgICAgICAgICAgdmlld1Byb2pNYXQubXVsMihwcm9qTWF0LCB2aWV3TWF0KTtcblxuICAgICAgICAgICAgaWYgKHRhcmdldCAmJiB0YXJnZXQuZmxpcFkpIHtcbiAgICAgICAgICAgICAgICBmbGlwcGVkVmlld1Byb2pNYXQubXVsMihmbGlwWU1hdCwgdmlld1Byb2pNYXQpO1xuICAgICAgICAgICAgICAgIGZsaXBwZWRTa3lib3hQcm9qTWF0Lm11bDIoZmxpcFlNYXQsIGNhbWVyYS5nZXRQcm9qZWN0aW9uTWF0cml4U2t5Ym94KCkpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKGZsaXBwZWRWaWV3UHJvak1hdC5kYXRhKTtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZShmbGlwcGVkU2t5Ym94UHJvak1hdC5kYXRhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKHZpZXdQcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgIHRoaXMucHJvalNreWJveElkLnNldFZhbHVlKGNhbWVyYS5nZXRQcm9qZWN0aW9uTWF0cml4U2t5Ym94KCkuZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZmxpcFlJZC5zZXRWYWx1ZSh0YXJnZXQ/LmZsaXBZID8gLTEgOiAxKTtcblxuICAgICAgICAgICAgLy8gVmlldyBQb3NpdGlvbiAod29ybGQgc3BhY2UpXG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoVmlld1BvcyhjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKSk7XG5cbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGJuQmFzaXMuc2V0VmFsdWUodGFyZ2V0ICYmIHRhcmdldC5mbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgLy8gTmVhciBhbmQgZmFyIGNsaXAgdmFsdWVzXG4gICAgICAgIHRoaXMubmVhckNsaXBJZC5zZXRWYWx1ZShjYW1lcmEuX25lYXJDbGlwKTtcbiAgICAgICAgdGhpcy5mYXJDbGlwSWQuc2V0VmFsdWUoY2FtZXJhLl9mYXJDbGlwKTtcblxuICAgICAgICBpZiAodGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICB0aGlzLmV4cG9zdXJlSWQuc2V0VmFsdWUoY2FtZXJhLmdldEV4cG9zdXJlKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5leHBvc3VyZUlkLnNldFZhbHVlKHRoaXMuc2NlbmUuZXhwb3N1cmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbiA9IGNhbWVyYS5fbmVhckNsaXA7XG4gICAgICAgIGNvbnN0IGYgPSBjYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzBdID0gMSAvIGY7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzFdID0gZjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMl0gPSBuO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1szXSA9IGNhbWVyYS5wcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA/IDEgOiAwO1xuXG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zSWQuc2V0VmFsdWUodGhpcy5jYW1lcmFQYXJhbXMpO1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHJlbmRlckFjdGlvbiwgdmlld0NvdW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG1ha2Ugc3VyZSBjb2xvcldyaXRlIGlzIHNldCB0byB0cnVlIHRvIGFsbCBjaGFubmVscywgaWYgeW91IHdhbnQgdG8gZnVsbHkgY2xlYXIgdGhlIHRhcmdldFxuICAgIC8vIFRPRE86IHRoaXMgZnVuY3Rpb24gaXMgb25seSB1c2VkIGZyb20gb3V0c2lkZSBvZiBmb3J3YXJkIHJlbmRlcmVyLCBhbmQgc2hvdWxkIGJlIGRlcHJlY2F0ZWRcbiAgICAvLyB3aGVuIHRoZSBmdW5jdGlvbmFsaXR5IG1vdmVzIHRvIHRoZSByZW5kZXIgcGFzc2VzLlxuICAgIHNldENhbWVyYShjYW1lcmEsIHRhcmdldCwgY2xlYXIsIHJlbmRlckFjdGlvbiA9IG51bGwpIHtcblxuICAgICAgICB0aGlzLnNldENhbWVyYVVuaWZvcm1zKGNhbWVyYSwgdGFyZ2V0LCByZW5kZXJBY3Rpb24pO1xuICAgICAgICB0aGlzLmNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyhyZW5kZXJBY3Rpb24sIHZpZXdDb3VudCkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChyZW5kZXJBY3Rpb24sIFwiUmVuZGVyQWN0aW9uIGNhbm5vdCBiZSBudWxsXCIpO1xuICAgICAgICBpZiAocmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZpZXdDb3VudCA9PT0gMSwgXCJUaGlzIGNvZGUgZG9lcyBub3QgaGFuZGxlIHRoZSB2aWV3Q291bnQgeWV0XCIpO1xuXG4gICAgICAgICAgICB3aGlsZSAocmVuZGVyQWN0aW9uLnZpZXdCaW5kR3JvdXBzLmxlbmd0aCA8IHZpZXdDb3VudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHViID0gbmV3IFVuaWZvcm1CdWZmZXIoZGV2aWNlLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBiZyA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIHViKTtcbiAgICAgICAgICAgICAgICByZW5kZXJBY3Rpb24udmlld0JpbmRHcm91cHMucHVzaChiZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSB2aWV3IGJpbmQgZ3JvdXAgLyB1bmlmb3Jtc1xuICAgICAgICAgICAgY29uc3Qgdmlld0JpbmRHcm91cCA9IHJlbmRlckFjdGlvbi52aWV3QmluZEdyb3Vwc1swXTtcbiAgICAgICAgICAgIHZpZXdCaW5kR3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXIudXBkYXRlKCk7XG4gICAgICAgICAgICB2aWV3QmluZEdyb3VwLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAvLyBUT0RPOyB0aGlzIG5lZWRzIHRvIGJlIG1vdmVkIHRvIGRyYXdJbnN0YW5jZSBmdW5jdGlvbnMgdG8gaGFuZGxlIFhSXG4gICAgICAgICAgICBkZXZpY2Uuc2V0QmluZEdyb3VwKEJJTkRHUk9VUF9WSUVXLCB2aWV3QmluZEdyb3VwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB1cCB0aGUgdmlld3BvcnQgYW5kIHRoZSBzY2lzc29yIGZvciBjYW1lcmEgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgY29udGFpbmluZyB0aGUgdmlld3BvcnQgaW5mb21hdGlvbi5cbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW3JlbmRlclRhcmdldF0gLSBUaGUgcmVuZGVyIHRhcmdldC4gTlVMTCBmb3IgdGhlIGRlZmF1bHQgb25lLlxuICAgICAqL1xuICAgIHNldHVwVmlld3BvcnQoY2FtZXJhLCByZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ1NFVFVQLVZJRVdQT1JUJyk7XG5cbiAgICAgICAgY29uc3QgcGl4ZWxXaWR0aCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgcGl4ZWxIZWlnaHQgPSByZW5kZXJUYXJnZXQgPyByZW5kZXJUYXJnZXQuaGVpZ2h0IDogZGV2aWNlLmhlaWdodDtcblxuICAgICAgICBjb25zdCByZWN0ID0gY2FtZXJhLnJlY3Q7XG4gICAgICAgIGxldCB4ID0gTWF0aC5mbG9vcihyZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgbGV0IHkgPSBNYXRoLmZsb29yKHJlY3QueSAqIHBpeGVsSGVpZ2h0KTtcbiAgICAgICAgbGV0IHcgPSBNYXRoLmZsb29yKHJlY3QueiAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgaCA9IE1hdGguZmxvb3IocmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQoeCwgeSwgdywgaCk7XG5cbiAgICAgICAgLy8gYnkgZGVmYXVsdCBjbGVhciBpcyB1c2luZyB2aWV3cG9ydCByZWN0YW5nbGUuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldCwgdXNpbmcgY3VycmVudGx5IHNldCB1cCB2aWV3cG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyQWN0aW9ufSByZW5kZXJBY3Rpb24gLSBSZW5kZXIgYWN0aW9uIGNvbnRhaW5pbmcgdGhlIGNsZWFyIGZsYWdzLlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhfSBjYW1lcmEgLSBDYW1lcmEgY29udGFpbmluZyB0aGUgY2xlYXIgdmFsdWVzLlxuICAgICAqL1xuICAgIGNsZWFyKHJlbmRlckFjdGlvbiwgY2FtZXJhKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXUE9SVCcpO1xuXG4gICAgICAgIGRldmljZS5jbGVhcih7XG4gICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICBzdGVuY2lsOiBjYW1lcmEuX2NsZWFyU3RlbmNpbCxcbiAgICAgICAgICAgIGZsYWdzOiAocmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IgPyBDTEVBUkZMQUdfQ09MT1IgOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgKHJlbmRlckFjdGlvbi5jbGVhckRlcHRoID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgIChyZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsID8gQ0xFQVJGTEFHX1NURU5DSUwgOiAwKVxuICAgICAgICB9KTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IHRoaXMgaXMgY3VycmVudGx5IHVzZWQgYnkgdGhlIGxpZ2h0bWFwcGVyIGFuZCB0aGUgRWRpdG9yLFxuICAgIC8vIGFuZCB3aWxsIGJlIHJlbW92ZWQgd2hlbiB0aG9zZSBjYWxsIGFyZSByZW1vdmVkLlxuICAgIGNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZvcmNlV3JpdGUpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ0NMRUFSLVZJRVcnKTtcblxuICAgICAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHRhcmdldCk7XG4gICAgICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuXG4gICAgICAgIGlmIChmb3JjZVdyaXRlKSB7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYSwgdGFyZ2V0KTtcblxuICAgICAgICBpZiAoY2xlYXIpIHtcbiAgICAgICAgICAgIC8vIHVzZSBjYW1lcmEgY2xlYXIgb3B0aW9ucyBpZiBhbnlcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBjYW1lcmEuX2NsZWFyT3B0aW9ucztcblxuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKG9wdGlvbnMgPyBvcHRpb25zIDoge1xuICAgICAgICAgICAgICAgIGNvbG9yOiBbY2FtZXJhLl9jbGVhckNvbG9yLnIsIGNhbWVyYS5fY2xlYXJDb2xvci5nLCBjYW1lcmEuX2NsZWFyQ29sb3IuYiwgY2FtZXJhLl9jbGVhckNvbG9yLmFdLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICAgICAgZmxhZ3M6IChjYW1lcmEuX2NsZWFyQ29sb3JCdWZmZXIgPyBDTEVBUkZMQUdfQ09MT1IgOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgIChjYW1lcmEuX2NsZWFyRGVwdGhCdWZmZXIgPyBDTEVBUkZMQUdfREVQVEggOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgIChjYW1lcmEuX2NsZWFyU3RlbmNpbEJ1ZmZlciA/IENMRUFSRkxBR19TVEVOQ0lMIDogMCksXG4gICAgICAgICAgICAgICAgc3RlbmNpbDogY2FtZXJhLl9jbGVhclN0ZW5jaWxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKi9cbiAgICBkaXNwYXRjaEdsb2JhbExpZ2h0cyhzY2VuZSkge1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclswXSA9IHNjZW5lLmFtYmllbnRMaWdodC5yO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclsxXSA9IHNjZW5lLmFtYmllbnRMaWdodC5nO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclsyXSA9IHNjZW5lLmFtYmllbnRMaWdodC5iO1xuICAgICAgICBpZiAoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldID0gTWF0aC5wb3codGhpcy5hbWJpZW50Q29sb3JbaV0sIDIuMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNjZW5lLnBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbaV0gKj0gc2NlbmUuYW1iaWVudEx1bWluYW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFtYmllbnRJZC5zZXRWYWx1ZSh0aGlzLmFtYmllbnRDb2xvcik7XG5cbiAgICAgICAgaWYgKHNjZW5lLnNreSkge1xuICAgICAgICAgICAgdGhpcy5za3lib3hJbnRlbnNpdHlJZC5zZXRWYWx1ZShzY2VuZS5waHlzaWNhbFVuaXRzID8gc2NlbmUuc2t5Ym94THVtaW5hbmNlIDogc2NlbmUuc2t5Ym94SW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZXNvbHZlTGlnaHQoc2NvcGUsIGkpIHtcbiAgICAgICAgY29uc3QgbGlnaHQgPSAnbGlnaHQnICsgaTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb2xvcicpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodERpcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfZGlyZWN0aW9uJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd01hcCcpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93UGFyYW1zJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcmFkaXVzJyk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19wb3NpdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZXaWR0aCcpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaGFsZkhlaWdodCcpO1xuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaW5uZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19vdXRlckNvbmVBbmdsZScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llSW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZU1hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVPZmZzZXQnKTtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXRyaXhQYWxldHRlWzBdJyk7XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93Q2FzY2FkZURpc3RhbmNlc1swXScpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVDb3VudElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93Q2FzY2FkZUNvdW50Jyk7XG4gICAgfVxuXG4gICAgc2V0TFRDRGlyZWN0aW9uYWxMaWdodCh3dG0sIGNudCwgZGlyLCBjYW1wb3MsIGZhcikge1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBjYW1wb3MueCAtIGRpci54ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBjYW1wb3MueSAtIGRpci55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBjYW1wb3MueiAtIGRpci56ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhXaWR0aCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoLTAuNSwgMCwgMCkpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVswXSA9IGhXaWR0aC54ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVsxXSA9IGhXaWR0aC55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVsyXSA9IGhXaWR0aC56ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRXaWR0aFtjbnRdKTtcblxuICAgICAgICBjb25zdCBoSGVpZ2h0ID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygwLCAwLCAwLjUpKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzBdID0gaEhlaWdodC54ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMV0gPSBoSGVpZ2h0LnkgKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsyXSA9IGhIZWlnaHQueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodEhlaWdodFtjbnRdKTtcbiAgICB9XG5cbiAgICBkaXNwYXRjaERpcmVjdExpZ2h0cyhkaXJzLCBzY2VuZSwgbWFzaywgY2FtZXJhKSB7XG4gICAgICAgIGxldCBjbnQgPSAwO1xuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIShkaXJzW2ldLm1hc2sgJiBtYXNrKSkgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGlvbmFsID0gZGlyc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHd0bSA9IGRpcmVjdGlvbmFsLl9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBkaXJlY3Rpb25hbC5fbGluZWFyRmluYWxDb2xvciA6IGRpcmVjdGlvbmFsLl9maW5hbENvbG9yKTtcblxuICAgICAgICAgICAgLy8gRGlyZWN0aW9uYWwgbGlnaHRzIHNoaW5lIGRvd24gdGhlIG5lZ2F0aXZlIFkgYXhpc1xuICAgICAgICAgICAgd3RtLmdldFkoZGlyZWN0aW9uYWwuX2RpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgICAgIGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24ubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMF0gPSBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLng7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMV0gPSBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLnk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMl0gPSBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLno7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlySWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0RGlyW2NudF0pO1xuXG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uYWwuc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGUgLSBOQiBkaXJlY3Rpb25hbCBhcmVhIGxpZ2h0IHNwZWN1bGFyIGlzIGFwcHJveGltYXRlZCBieSBwdXR0aW5nIHRoZSBhcmVhIGxpZ2h0IGF0IHRoZSBmYXIgY2xpcFxuICAgICAgICAgICAgICAgIHRoaXMuc2V0TFRDRGlyZWN0aW9uYWxMaWdodCh3dG0sIGNudCwgZGlyZWN0aW9uYWwuX2RpcmVjdGlvbiwgY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCksIGNhbWVyYS5mYXJDbGlwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbmFsLmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBkaXJlY3Rpb25hbC5nZXRSZW5kZXJEYXRhKGNhbWVyYSwgMCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gZGlyZWN0aW9uYWwuX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5fc2hhZG93TWF0cml4UGFsZXR0ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5fc2hhZG93Q2FzY2FkZURpc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZFtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLm51bUNhc2NhZGVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuc2hhZG93SW50ZW5zaXR5KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IGRpcmVjdGlvbmFsLl9zaGFkb3dSZW5kZXJQYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDM7XG4gICAgICAgICAgICAgICAgcGFyYW1zWzBdID0gZGlyZWN0aW9uYWwuX3NoYWRvd1Jlc29sdXRpb247ICAvLyBOb3RlOiB0aGlzIG5lZWRzIHRvIGNoYW5nZSBmb3Igbm9uLXNxdWFyZSBzaGFkb3cgbWFwcyAoMiBjYXNjYWRlcykuIEN1cnJlbnRseSBzcXVhcmUgaXMgdXNlZFxuICAgICAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgICAgIHBhcmFtc1syXSA9IGJpYXNlcy5iaWFzO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtjbnRdLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY250O1xuICAgIH1cblxuICAgIHNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCkge1xuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueDtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGguejtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueDtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0Lno7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gb21uaS5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2NudF0uc2V0VmFsdWUob21uaS5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gb21uaS5fbGluZWFyRmluYWxDb2xvciA6IG9tbmkuX2ZpbmFsQ29sb3IpO1xuICAgICAgICB3dG0uZ2V0VHJhbnNsYXRpb24ob21uaS5fcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBvbW5pLl9wb3NpdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBvbW5pLl9wb3NpdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBvbW5pLl9wb3NpdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGlmIChvbW5pLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGVcbiAgICAgICAgICAgIHRoaXMuc2V0TFRDUG9zaXRpb25hbExpZ2h0KHd0bSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvbW5pLmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IG9tbmkuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBvbW5pLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gb21uaS5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBvbW5pLl9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIG9tbmkuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKG9tbmkuc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob21uaS5fY29va2llKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbY250XS5zZXRWYWx1ZShvbW5pLl9jb29raWUpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUod3RtLmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2NudF0uc2V0VmFsdWUob21uaS5jb29raWVJbnRlbnNpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gc3BvdC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2lubmVyQ29uZUFuZ2xlQ29zKTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWRbY250XS5zZXRWYWx1ZShzcG90Ll9vdXRlckNvbmVBbmdsZUNvcyk7XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtjbnRdLnNldFZhbHVlKHNwb3QuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IHNwb3QuX2xpbmVhckZpbmFsQ29sb3IgOiBzcG90Ll9maW5hbENvbG9yKTtcbiAgICAgICAgd3RtLmdldFRyYW5zbGF0aW9uKHNwb3QuX3Bvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gc3BvdC5fcG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gc3BvdC5fcG9zaXRpb24ueTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gc3BvdC5fcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBpZiAoc3BvdC5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlXG4gICAgICAgICAgICB0aGlzLnNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTcG90cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgd3RtLmdldFkoc3BvdC5fZGlyZWN0aW9uKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICBzcG90Ll9kaXJlY3Rpb24ubm9ybWFsaXplKCk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVswXSA9IHNwb3QuX2RpcmVjdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMV0gPSBzcG90Ll9kaXJlY3Rpb24ueTtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzJdID0gc3BvdC5fZGlyZWN0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHREaXJJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHREaXJbY250XSk7XG5cbiAgICAgICAgaWYgKHNwb3QuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgLy8gc2hhZG93IG1hcFxuICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gc3BvdC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IHNwb3QuX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSk7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBzcG90Ll9zaGFkb3dSZW5kZXJQYXJhbXM7XG4gICAgICAgICAgICBwYXJhbXMubGVuZ3RoID0gNDtcbiAgICAgICAgICAgIHBhcmFtc1swXSA9IHNwb3QuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgIHBhcmFtc1syXSA9IGJpYXNlcy5iaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzNdID0gMS4wIC8gc3BvdC5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtjbnRdLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2NudF0uc2V0VmFsdWUoc3BvdC5zaGFkb3dJbnRlbnNpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZSkge1xuXG4gICAgICAgICAgICAvLyBpZiBzaGFkb3cgaXMgbm90IHJlbmRlcmVkLCB3ZSBuZWVkIHRvIGV2YWx1YXRlIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAoIXNwb3QuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb29raWVNYXRyaXggPSBMaWdodENhbWVyYS5ldmFsU3BvdENvb2tpZU1hdHJpeChzcG90KTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShjb29raWVNYXRyaXguZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbY250XS5zZXRWYWx1ZShzcG90LmNvb2tpZUludGVuc2l0eSk7XG4gICAgICAgICAgICBpZiAoc3BvdC5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVswXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS54O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMV0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzJdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLno7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVszXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS53O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVPZmZzZXQueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzFdID0gc3BvdC5fY29va2llT2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2NudF0uc2V0VmFsdWUoc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaExvY2FsTGlnaHRzKHNvcnRlZExpZ2h0cywgc2NlbmUsIG1hc2ssIHVzZWREaXJMaWdodHMsIHN0YXRpY0xpZ2h0TGlzdCkge1xuXG4gICAgICAgIGxldCBjbnQgPSB1c2VkRGlyTGlnaHRzO1xuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGNvbnN0IG9tbmlzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9PTU5JXTtcbiAgICAgICAgY29uc3QgbnVtT21uaXMgPSBvbW5pcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtT21uaXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgb21uaSA9IG9tbmlzW2ldO1xuICAgICAgICAgICAgaWYgKCEob21uaS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKG9tbmkuaXNTdGF0aWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCk7XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGF0aWNJZCA9IDA7XG4gICAgICAgIGlmIChzdGF0aWNMaWdodExpc3QpIHtcbiAgICAgICAgICAgIGxldCBvbW5pID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIHdoaWxlIChvbW5pICYmIG9tbmkuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCk7XG4gICAgICAgICAgICAgICAgY250Kys7XG4gICAgICAgICAgICAgICAgc3RhdGljSWQrKztcbiAgICAgICAgICAgICAgICBvbW5pID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNwdHMgPSBzb3J0ZWRMaWdodHNbTElHSFRUWVBFX1NQT1RdO1xuICAgICAgICBjb25zdCBudW1TcHRzID0gc3B0cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU3B0czsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzcG90ID0gc3B0c1tpXTtcbiAgICAgICAgICAgIGlmICghKHNwb3QubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzcG90LmlzU3RhdGljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBsZXQgc3BvdCA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB3aGlsZSAoc3BvdCAmJiBzcG90Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpO1xuICAgICAgICAgICAgICAgIGNudCsrO1xuICAgICAgICAgICAgICAgIHN0YXRpY0lkKys7XG4gICAgICAgICAgICAgICAgc3BvdCA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjdWxsKGNhbWVyYSwgZHJhd0NhbGxzLCB2aXNpYmxlTGlzdCkge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIGxldCBudW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBsZXQgdmlzaWJsZUxlbmd0aCA9IDA7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcblxuICAgICAgICBjb25zdCBjdWxsaW5nTWFzayA9IGNhbWVyYS5jdWxsaW5nTWFzayB8fCAweEZGRkZGRkZGOyAvLyBpZiBtaXNzaW5nIGFzc3VtZSBjYW1lcmEncyBkZWZhdWx0IHZhbHVlXG5cbiAgICAgICAgaWYgKCFjYW1lcmEuZnJ1c3R1bUN1bGxpbmcpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIG5lZWQgdG8gY29weSBhcnJheSBhbnl3YXkgYmVjYXVzZSBzb3J0aW5nIHdpbGwgaGFwcGVuIGFuZCBpdCdsbCBicmVhayBvcmlnaW5hbCBkcmF3IGNhbGwgb3JkZXIgYXNzdW1wdGlvblxuICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwudmlzaWJsZSAmJiAhZHJhd0NhbGwuY29tbWFuZCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgb2JqZWN0J3MgbWFzayBBTkQgdGhlIGNhbWVyYSdzIGN1bGxpbmdNYXNrIGlzIHplcm8gdGhlbiB0aGUgZ2FtZSBvYmplY3Qgd2lsbCBiZSBpbnZpc2libGUgZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLm1hc2sgJiYgKGRyYXdDYWxsLm1hc2sgJiBjdWxsaW5nTWFzaykgPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmlzaWJsZUxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmNvbW1hbmQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLnZpc2libGUpIGNvbnRpbnVlOyAvLyB1c2UgdmlzaWJsZSBwcm9wZXJ0eSB0byBxdWlja2x5IGhpZGUvc2hvdyBtZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgbGV0IHZpc2libGUgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIG9iamVjdCdzIG1hc2sgQU5EIHRoZSBjYW1lcmEncyBjdWxsaW5nTWFzayBpcyB6ZXJvIHRoZW4gdGhlIGdhbWUgb2JqZWN0IHdpbGwgYmUgaW52aXNpYmxlIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXNrICYmIChkcmF3Q2FsbC5tYXNrICYgY3VsbGluZ01hc2spID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUgPSBkcmF3Q2FsbC5faXNWaXNpYmxlKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgbnVtRHJhd0NhbGxzQ3VsbGVkKys7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh2aXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgdGhpcy5fbnVtRHJhd0NhbGxzQ3VsbGVkICs9IG51bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHZpc2libGVMZW5ndGg7XG4gICAgfVxuXG4gICAgY3VsbExpZ2h0cyhjYW1lcmEsIGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBwaHlzaWNhbFVuaXRzID0gdGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBtYXJrZWQgdmlzaWJsZSBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQuZ2V0Qm91bmRpbmdTcGhlcmUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEuZnJ1c3R1bS5jb250YWluc1NwaGVyZSh0ZW1wU3BoZXJlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC51c2VQaHlzaWNhbFVuaXRzID0gcGh5c2ljYWxVbml0cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF4aW11bSBzY3JlZW4gYXJlYSB0YWtlbiBieSB0aGUgbGlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcmVlblNpemUgPSBjYW1lcmEuZ2V0U2NyZWVuU2l6ZSh0ZW1wU3BoZXJlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Lm1heFNjcmVlblNpemUgPSBNYXRoLm1heChsaWdodC5tYXhTY3JlZW5TaXplLCBzY3JlZW5TaXplKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHNoYWRvdyBjYXN0aW5nIGxpZ2h0IGRvZXMgbm90IGhhdmUgc2hhZG93IG1hcCBhbGxvY2F0ZWQsIG1hcmsgaXQgdmlzaWJsZSB0byBhbGxvY2F0ZSBzaGFkb3cgbWFwXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3RlOiBUaGlzIHdvbid0IGJlIG5lZWRlZCB3aGVuIGNsdXN0ZXJlZCBzaGFkb3dzIGFyZSB1c2VkLCBidXQgYXQgdGhlIG1vbWVudCBldmVuIGN1bGxlZCBvdXQgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhcmUgdXNlZCBmb3IgcmVuZGVyaW5nLCBhbmQgbmVlZCBzaGFkb3cgbWFwIHRvIGJlIGFsbG9jYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZGVsZXRlIHRoaXMgY29kZSB3aGVuIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCBpcyBiZWluZyByZW1vdmVkIGFuZCBpcyBvbiBieSBkZWZhdWx0LlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MgJiYgIWxpZ2h0LnNoYWRvd01hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC51c2VQaHlzaWNhbFVuaXRzID0gdGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcblxuICAgICAgICBfc2tpblVwZGF0ZUluZGV4Kys7XG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBpZiAoZHJhd0NhbGxzQ291bnQgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2kgPSBkcmF3Q2FsbHNbaV0uc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKHNpKSB7XG4gICAgICAgICAgICAgICAgc2kudXBkYXRlTWF0cmljZXMoZHJhd0NhbGxzW2ldLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIHNpLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbHNbaV0udmlzaWJsZVRoaXNGcmFtZSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBza2luID0gZHJhd0NhbGxzW2ldLnNraW5JbnN0YW5jZTtcbiAgICAgICAgICAgIGlmIChza2luKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNraW4uX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHNraW4udXBkYXRlTWF0cml4UGFsZXR0ZShkcmF3Q2FsbHNbaV0ubm9kZSwgX3NraW5VcGRhdGVJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIHNraW4uX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9za2luVGltZSArPSBub3coKSAtIHNraW5UaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICB1cGRhdGVNb3JwaGluZyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBtb3JwaFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoSW5zdCA9IGRyYXdDYWxsc1tpXS5tb3JwaEluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdCAmJiBtb3JwaEluc3QuX2RpcnR5ICYmIGRyYXdDYWxsc1tpXS52aXNpYmxlVGhpc0ZyYW1lKSB7XG4gICAgICAgICAgICAgICAgbW9ycGhJbnN0LnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fbW9ycGhUaW1lICs9IG5vdygpIC0gbW9ycGhUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBzZXRCYXNlQ29uc3RhbnRzKGRldmljZSwgbWF0ZXJpYWwpIHtcbiAgICAgICAgLy8gQ3VsbCBtb2RlXG4gICAgICAgIGRldmljZS5zZXRDdWxsTW9kZShtYXRlcmlhbC5jdWxsKTtcbiAgICAgICAgLy8gQWxwaGEgdGVzdFxuICAgICAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICAgICAgdGhpcy5vcGFjaXR5TWFwSWQuc2V0VmFsdWUobWF0ZXJpYWwub3BhY2l0eU1hcCk7XG4gICAgICAgICAgICB0aGlzLmFscGhhVGVzdElkLnNldFZhbHVlKG1hdGVyaWFsLmFscGhhVGVzdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMrKztcbiAgICAgICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMpIHtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZSA9IG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UuYm9uZVRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZUlkLnNldFZhbHVlKGJvbmVUZXh0dXJlKTtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMF0gPSBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMV0gPSBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzJdID0gMS4wIC8gYm9uZVRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzNdID0gMS4wIC8gYm9uZVRleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmVTaXplSWQuc2V0VmFsdWUoYm9uZVRleHR1cmVTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5tYXRyaXhQYWxldHRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJldHVybnMgbnVtYmVyIG9mIGV4dHJhIGRyYXcgY2FsbHMgdG8gc2tpcCAtIHVzZWQgdG8gc2tpcCBhdXRvIGluc3RhbmNlZCBtZXNoZXMgZHJhdyBjYWxscy4gYnkgZGVmYXVsdCByZXR1cm4gMCB0byBub3Qgc2tpcCBhbnkgYWRkaXRpb25hbCBkcmF3IGNhbGxzXG4gICAgZHJhd0luc3RhbmNlKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSwgbm9ybWFsKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgbWVzaEluc3RhbmNlLm5vZGUubmFtZSk7XG5cbiAgICAgICAgaW5zdGFuY2luZ0RhdGEgPSBtZXNoSW5zdGFuY2UuaW5zdGFuY2luZ0RhdGE7XG4gICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YSkge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIoaW5zdGFuY2luZ0RhdGEudmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIGluc3RhbmNpbmdEYXRhLmNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1vZGVsTWF0cml4ID0gbWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQuc2V0VmFsdWUobW9kZWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGlmIChub3JtYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLm5vcm1hbE1hdHJpeC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLy8gdXNlZCBmb3Igc3RlcmVvXG4gICAgZHJhd0luc3RhbmNlMihkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXRyaWNlcyBhcmUgYWxyZWFkeSBzZXRcbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgcmVuZGVyU2hhZG93cyhsaWdodHMsIGNhbWVyYSkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzaGFkb3dNYXBTdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQgJiYgbGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBjbHVzdGVyZWQgc2hhZG93cyB3aXRoIG5vIGFzc2lnbmVkIGF0bGFzIHNsb3RcbiAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgYXRsYXMgc2xvdCBpcyByZWFzc2lnbmVkLCBtYWtlIHN1cmUgc2hhZG93IGlzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNTbG90VXBkYXRlZCAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyLnJlbmRlcihsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVGltZSArPSBub3coKSAtIHNoYWRvd01hcFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgcmVuZGVyQ29va2llcyhsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBjb29raWVSZW5kZXJUYXJnZXQgPSB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmNvb2tpZVJlbmRlclRhcmdldDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAvLyBza2lwIGNsdXN0ZXJlZCBjb29raWVzIHdpdGggbm8gYXNzaWduZWQgYXRsYXMgc2xvdFxuICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAvLyBvbmx5IHJlbmRlciBjb29raWUgd2hlbiB0aGUgc2xvdCBpcyByZWFzc2lnbmVkIChhc3N1bWluZyB0aGUgY29va2llIHRleHR1cmUgaXMgc3RhdGljKVxuICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1Nsb3RVcGRhdGVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5yZW5kZXIobGlnaHQsIGNvb2tpZVJlbmRlclRhcmdldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdWxsTW9kZShjdWxsRmFjZXMsIGZsaXAsIGRyYXdDYWxsKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG4gICAgICAgIGxldCBtb2RlID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgaWYgKGN1bGxGYWNlcykge1xuICAgICAgICAgICAgbGV0IGZsaXBGYWNlcyA9IDE7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jdWxsID4gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsIDwgQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmZsaXBGYWNlcylcbiAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzICo9IC0xO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZsaXApXG4gICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyAqPSAtMTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHd0ID0gZHJhd0NhbGwubm9kZS53b3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICB3dC5nZXRYKHdvcmxkTWF0WCk7XG4gICAgICAgICAgICAgICAgd3QuZ2V0WSh3b3JsZE1hdFkpO1xuICAgICAgICAgICAgICAgIHd0LmdldFood29ybGRNYXRaKTtcbiAgICAgICAgICAgICAgICB3b3JsZE1hdFguY3Jvc3Mod29ybGRNYXRYLCB3b3JsZE1hdFkpO1xuICAgICAgICAgICAgICAgIGlmICh3b3JsZE1hdFguZG90KHdvcmxkTWF0WikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyAqPSAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGlwRmFjZXMgPCAwKSB7XG4gICAgICAgICAgICAgICAgbW9kZSA9IG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0ZST05UID8gQ1VMTEZBQ0VfQkFDSyA6IENVTExGQUNFX0ZST05UO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRldmljZS5zZXRDdWxsTW9kZShtb2RlKTtcblxuICAgICAgICBpZiAobW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICBjb25zdCB3dDIgPSBkcmF3Q2FsbC5ub2RlLndvcmxkVHJhbnNmb3JtO1xuICAgICAgICAgICAgd3QyLmdldFgod29ybGRNYXRYKTtcbiAgICAgICAgICAgIHd0Mi5nZXRZKHdvcmxkTWF0WSk7XG4gICAgICAgICAgICB3dDIuZ2V0Wih3b3JsZE1hdFopO1xuICAgICAgICAgICAgd29ybGRNYXRYLmNyb3NzKHdvcmxkTWF0WCwgd29ybGRNYXRZKTtcbiAgICAgICAgICAgIGlmICh3b3JsZE1hdFguZG90KHdvcmxkTWF0WikgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZC5zZXRWYWx1ZSgtMS4wKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZC5zZXRWYWx1ZSgxLjApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpIHtcblxuICAgICAgICAvLyBtYWluIHZlcnRleCBidWZmZXJcbiAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihtZXNoLnZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgc2V0TW9ycGhpbmcoZGV2aWNlLCBtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UubW9ycGgudXNlVGV4dHVyZU1vcnBoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyIHdpdGggdmVydGV4IGlkc1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobW9ycGhJbnN0YW5jZS5tb3JwaC52ZXJ0ZXhCdWZmZXJJZHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXguc2V0VmFsdWUobW9ycGhJbnN0YW5jZS50ZXh0dXJlUG9zaXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZU5vcm1hbHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3RleHR1cmVQYXJhbXMpO1xuXG4gICAgICAgICAgICB9IGVsc2UgeyAgICAvLyB2ZXJ0ZXggYXR0cmlidXRlcyBiYXNlZCBtb3JwaGluZ1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgdCA9IDA7IHQgPCBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgdCsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmIgPSBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzW3RdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGF0Y2ggc2VtYW50aWMgZm9yIHRoZSBidWZmZXIgdG8gY3VycmVudCBBVFRSIHNsb3QgKHVzaW5nIEFUVFI4IC0gQVRUUjE1IHJhbmdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBTRU1BTlRJQ19BVFRSICsgKHQgKyA4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC5lbGVtZW50c1swXS5uYW1lID0gc2VtYW50aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0uc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNlbWFudGljKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcih2Yik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgYWxsIDggd2VpZ2h0c1xuICAgICAgICAgICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQS5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl9zaGFkZXJNb3JwaFdlaWdodHNBKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Iuc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXRzIFZlYzMgY2FtZXJhIHBvc2l0aW9uIHVuaWZvcm1cbiAgICBkaXNwYXRjaFZpZXdQb3MocG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgdnAgPSB0aGlzLnZpZXdQb3M7XG4gICAgICAgIHZwWzBdID0gcG9zaXRpb24ueDtcbiAgICAgICAgdnBbMV0gPSBwb3NpdGlvbi55O1xuICAgICAgICB2cFsyXSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZwKTtcbiAgICB9XG5cbiAgICAvLyBleGVjdXRlIGZpcnN0IHBhc3Mgb3ZlciBkcmF3IGNhbGxzLCBpbiBvcmRlciB0byB1cGRhdGUgbWF0ZXJpYWxzIC8gc2hhZGVyc1xuICAgIC8vIFRPRE86IGltcGxlbWVudCB0aGlzOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2ViR0xfQVBJL1dlYkdMX2Jlc3RfcHJhY3RpY2VzI2NvbXBpbGVfc2hhZGVyc19hbmRfbGlua19wcm9ncmFtc19pbl9wYXJhbGxlbFxuICAgIC8vIHdoZXJlIGluc3RlYWQgb2YgY29tcGlsaW5nIGFuZCBsaW5raW5nIHNoYWRlcnMsIHdoaWNoIGlzIHNlcmlhbCBvcGVyYXRpb24sIHdlIGNvbXBpbGUgYWxsIG9mIHRoZW0gYW5kIHRoZW4gbGluayB0aGVtLCBhbGxvd2luZyB0aGUgd29yayB0b1xuICAgIC8vIHRha2UgcGxhY2UgaW4gcGFyYWxsZWxcbiAgICByZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGRyYXdDYWxscywgZHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgY3VsbGluZ01hc2ssIGxheWVyLCBwYXNzKSB7XG5cbiAgICAgICAgY29uc3QgYWRkQ2FsbCA9IChkcmF3Q2FsbCwgaXNOZXdNYXRlcmlhbCwgbGlnaHRNYXNrQ2hhbmdlZCkgPT4ge1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5kcmF3Q2FsbHMucHVzaChkcmF3Q2FsbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmlzTmV3TWF0ZXJpYWwucHVzaChpc05ld01hdGVyaWFsKTtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QubGlnaHRNYXNrQ2hhbmdlZC5wdXNoKGxpZ2h0TWFza0NoYW5nZWQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggZW1wdHkgYXJyYXlzXG4gICAgICAgIF9kcmF3Q2FsbExpc3QuZHJhd0NhbGxzLmxlbmd0aCA9IDA7XG4gICAgICAgIF9kcmF3Q2FsbExpc3QuaXNOZXdNYXRlcmlhbC5sZW5ndGggPSAwO1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmxpZ2h0TWFza0NoYW5nZWQubGVuZ3RoID0gMDtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBsaWdodEhhc2ggPSBsYXllciA/IGxheWVyLl9saWdodEhhc2ggOiAwO1xuICAgICAgICBsZXQgcHJldk1hdGVyaWFsID0gbnVsbCwgcHJldk9iakRlZnMsIHByZXZTdGF0aWMsIHByZXZMaWdodE1hc2s7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7TWVzaEluc3RhbmNlfSAqL1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG5cbiAgICAgICAgICAgIC8vIGFwcGx5IHZpc2liaWxpdHkgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmIChjdWxsaW5nTWFzayAmJiBkcmF3Q2FsbC5tYXNrICYmICEoY3VsbGluZ01hc2sgJiBkcmF3Q2FsbC5tYXNrKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIHtcblxuICAgICAgICAgICAgICAgIGFkZENhbGwoZHJhd0NhbGwsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYSA9PT0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPj0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID49IGxheWVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5lbnN1cmVNYXRlcmlhbChkZXZpY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAmJiBtYXRlcmlhbCA9PT0gcHJldk1hdGVyaWFsICYmIG9iakRlZnMgIT09IHByZXZPYmpEZWZzKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG51bGw7IC8vIGZvcmNlIGNoYW5nZSBzaGFkZXIgaWYgdGhlIG9iamVjdCB1c2VzIGEgZGlmZmVyZW50IHZhcmlhbnQgb2YgdGhlIHNhbWUgbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuaXNTdGF0aWMgfHwgcHJldlN0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsU3dpdGNoZXMrKztcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuX3NjZW5lID0gc2NlbmU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBtYXRlcmlhbCBoYXMgZGlydHlCbGVuZCBzZXQsIG5vdGlmeSBzY2VuZSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5fZGlydHlCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUubGF5ZXJzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwuX3NoYWRlcltwYXNzXSB8fCBkcmF3Q2FsbC5fc2hhZGVyRGVmcyAhPT0gb2JqRGVmcyB8fCBkcmF3Q2FsbC5fbGlnaHRIYXNoICE9PSBsaWdodEhhc2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZHJhdyBjYWxscyBub3QgdXNpbmcgc3RhdGljIGxpZ2h0cyB1c2UgdmFyaWFudHMgY2FjaGUgb24gbWF0ZXJpYWwgdG8gcXVpY2tseSBmaW5kIHRoZSBzaGFkZXIsIGFzIHRoZXkgYXJlIGFsbFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHNhbWUgZm9yIHRoZSBzYW1lIHBhc3MsIHVzaW5nIGFsbCBsaWdodHMgb2YgdGhlIHNjZW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudEtleSA9IHBhc3MgKyAnXycgKyBvYmpEZWZzICsgJ18nICsgbGlnaHRIYXNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLl9zaGFkZXJbcGFzc10gPSBtYXRlcmlhbC52YXJpYW50c1t2YXJpYW50S2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLl9zaGFkZXJbcGFzc10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgbnVsbCwgc29ydGVkTGlnaHRzLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0LCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC52YXJpYW50c1t2YXJpYW50S2V5XSA9IGRyYXdDYWxsLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN0YXRpYyBsaWdodHMgZ2VuZXJhdGUgdW5pcXVlIHNoYWRlciBwZXIgZHJhdyBjYWxsLCBhcyBzdGF0aWMgbGlnaHRzIGFyZSB1bmlxdWUgcGVyIGRyYXcgY2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgc28gdmFyaWFudHMgY2FjaGUgaXMgbm90IHVzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC5fbGlnaHRIYXNoID0gbGlnaHRIYXNoO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGRyYXdDYWxsLl9zaGFkZXJbcGFzc10sIFwibm8gc2hhZGVyIGZvciBwYXNzXCIsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsLCAhcHJldk1hdGVyaWFsIHx8IGxpZ2h0TWFzayAhPT0gcHJldkxpZ2h0TWFzayk7XG5cbiAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBwcmV2T2JqRGVmcyA9IG9iakRlZnM7XG4gICAgICAgICAgICAgICAgcHJldkxpZ2h0TWFzayA9IGxpZ2h0TWFzaztcbiAgICAgICAgICAgICAgICBwcmV2U3RhdGljID0gZHJhd0NhbGwuaXNTdGF0aWM7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfZHJhd0NhbGxMaXN0O1xuICAgIH1cblxuICAgIHJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgPSBkZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycztcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBwYXNzRmxhZyA9IDEgPDwgcGFzcztcblxuICAgICAgICAvLyBSZW5kZXIgdGhlIHNjZW5lXG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHNDb3VudCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVwYXJlZENhbGxzQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IHByZXBhcmVkQ2FsbHMuZHJhd0NhbGxzW2ldO1xuXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY29tbWFuZCkge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIGNvbW1hbmRcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5jb21tYW5kKCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGEgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld01hdGVyaWFsID0gcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFza0NoYW5nZWQgPSBwcmVwYXJlZENhbGxzLmxpZ2h0TWFza0NoYW5nZWRbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChuZXdNYXRlcmlhbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IGRyYXdDYWxsLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2hhZGVyLmZhaWxlZCAmJiAhZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgRXJyb3IgY29tcGlsaW5nIHNoYWRlciBmb3IgbWF0ZXJpYWw9JHttYXRlcmlhbC5uYW1lfSBwYXNzPSR7cGFzc30gb2JqRGVmcz0ke29iakRlZnN9YCwgbWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSTogbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodE1hc2tDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VkRGlyTGlnaHRzID0gdGhpcy5kaXNwYXRjaERpcmVjdExpZ2h0cyhzb3J0ZWRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXSwgc2NlbmUsIGxpZ2h0TWFzaywgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hMb2NhbExpZ2h0cyhzb3J0ZWRMaWdodHMsIHNjZW5lLCBsaWdodE1hc2ssIHVzZWREaXJMaWdodHMsIGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3QpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbHBoYVRlc3RJZC5zZXRWYWx1ZShtYXRlcmlhbC5hbHBoYVRlc3QpO1xuXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZGluZyhtYXRlcmlhbC5ibGVuZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5ibGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLnNlcGFyYXRlQWxwaGFCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUobWF0ZXJpYWwuYmxlbmRTcmMsIG1hdGVyaWFsLmJsZW5kRHN0LCBtYXRlcmlhbC5ibGVuZFNyY0FscGhhLCBtYXRlcmlhbC5ibGVuZERzdEFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlKG1hdGVyaWFsLmJsZW5kRXF1YXRpb24sIG1hdGVyaWFsLmJsZW5kQWxwaGFFcXVhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZEZ1bmN0aW9uKG1hdGVyaWFsLmJsZW5kU3JjLCBtYXRlcmlhbC5ibGVuZERzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kRXF1YXRpb24obWF0ZXJpYWwuYmxlbmRFcXVhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUobWF0ZXJpYWwucmVkV3JpdGUsIG1hdGVyaWFsLmdyZWVuV3JpdGUsIG1hdGVyaWFsLmJsdWVXcml0ZSwgbWF0ZXJpYWwuYWxwaGFXcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKG1hdGVyaWFsLmRlcHRoV3JpdGUpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoaXMgZml4ZXMgdGhlIGNhc2Ugd2hlcmUgdGhlIHVzZXIgd2lzaGVzIHRvIHR1cm4gb2ZmIGRlcHRoIHRlc3RpbmcgYnV0IHdhbnRzIHRvIHdyaXRlIGRlcHRoXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5kZXB0aFdyaXRlICYmICFtYXRlcmlhbC5kZXB0aFRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEZ1bmMoRlVOQ19BTFdBWVMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoVGVzdCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEZ1bmMobWF0ZXJpYWwuZGVwdGhGdW5jKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFRlc3QobWF0ZXJpYWwuZGVwdGhUZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRBbHBoYVRvQ292ZXJhZ2UobWF0ZXJpYWwuYWxwaGFUb0NvdmVyYWdlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGVwdGhCaWFzIHx8IG1hdGVyaWFsLnNsb3BlRGVwdGhCaWFzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhc1ZhbHVlcyhtYXRlcmlhbC5kZXB0aEJpYXMsIG1hdGVyaWFsLnNsb3BlRGVwdGhCaWFzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDdWxsTW9kZShjYW1lcmEuX2N1bGxGYWNlcywgZmxpcEZhY2VzLCBkcmF3Q2FsbCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsRnJvbnQgPSBkcmF3Q2FsbC5zdGVuY2lsRnJvbnQgfHwgbWF0ZXJpYWwuc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWxCYWNrID0gZHJhd0NhbGwuc3RlbmNpbEJhY2sgfHwgbWF0ZXJpYWwuc3RlbmNpbEJhY2s7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsVGVzdCh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCA9PT0gc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlkZW50aWNhbCBmcm9udC9iYWNrIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuYyhzdGVuY2lsRnJvbnQuZnVuYywgc3RlbmNpbEZyb250LnJlZiwgc3RlbmNpbEZyb250LnJlYWRNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uKHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXBhcmF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBmcm9udFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0Zyb250KHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoc3RlbmNpbEZyb250LmZhaWwsIHN0ZW5jaWxGcm9udC56ZmFpbCwgc3RlbmNpbEZyb250LnpwYXNzLCBzdGVuY2lsRnJvbnQud3JpdGVNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCBmcm9udFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0Zyb250KEZVTkNfQUxXQVlTLCAwLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KFNURU5DSUxPUF9LRUVQLCBTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIDB4RkYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNCYWNrKHN0ZW5jaWxCYWNrLmZ1bmMsIHN0ZW5jaWxCYWNrLnJlZiwgc3RlbmNpbEJhY2sucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhzdGVuY2lsQmFjay5mYWlsLCBzdGVuY2lsQmFjay56ZmFpbCwgc3RlbmNpbEJhY2suenBhc3MsIHN0ZW5jaWxCYWNrLndyaXRlTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsRnVuY0JhY2soRlVOQ19BTFdBWVMsIDAsIDB4RkYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsVGVzdChmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGRyYXdDYWxsLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAvLyBVbmlmb3JtcyBJSTogbWVzaEluc3RhbmNlIG92ZXJyaWRlc1xuICAgICAgICAgICAgICAgIGRyYXdDYWxsLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBwYXNzRmxhZyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldFZlcnRleEJ1ZmZlcnMoZGV2aWNlLCBtZXNoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldE1vcnBoaW5nKGRldmljZSwgZHJhd0NhbGwubW9ycGhJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTa2lubmluZyhkZXZpY2UsIGRyYXdDYWxsLCBtYXRlcmlhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3VwcG9ydHNVbmlmb3JtQnVmZmVycykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IG1vZGVsIG1hdHJpeCBzZXR1cCBpcyBwYXJ0IG9mIHRoZSBkcmF3SW5zdGFuY2UgY2FsbCwgYnV0IHdpdGggdW5pZm9ybSBidWZmZXIgaXQncyBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gZWFybGllciBoZXJlLiBUaGlzIG5lZWRzIHRvIGJlIHJlZmFjdG9yZWQgZm9yIG11bHRpLXZpZXcgYW55d2F5cy5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbE1hdHJpeElkLnNldFZhbHVlKGRyYXdDYWxsLm5vZGUud29ybGRUcmFuc2Zvcm0uZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQuc2V0VmFsdWUoZHJhd0NhbGwubm9kZS5ub3JtYWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIG1lc2ggYmluZCBncm91cCAvIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hCaW5kR3JvdXAgPSBkcmF3Q2FsbC5nZXRCaW5kR3JvdXAoZGV2aWNlLCBwYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEJpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEJpbmRHcm91cC51cGRhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJpbmRHcm91cChCSU5ER1JPVVBfTUVTSCwgbWVzaEJpbmRHcm91cCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBkcmF3Q2FsbC5yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0SW5kZXhCdWZmZXIobWVzaC5pbmRleEJ1ZmZlcltzdHlsZV0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbGJhY2soZHJhd0NhbGwsIGkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24gJiYgY2FtZXJhLnhyLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3cyA9IGNhbWVyYS54ci52aWV3cztcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdzLmxlbmd0aDsgdisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gdmlld3Nbdl07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh2aWV3LnZpZXdwb3J0LngsIHZpZXcudmlld3BvcnQueSwgdmlldy52aWV3cG9ydC56LCB2aWV3LnZpZXdwb3J0LncpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZSh2aWV3LnByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZC5zZXRWYWx1ZSh2aWV3LnZpZXdPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdJZDMuc2V0VmFsdWUodmlldy52aWV3TWF0My5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Byb2pJZC5zZXRWYWx1ZSh2aWV3LnByb2pWaWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodmlldy5wb3NpdGlvbik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdJbnN0YW5jZTIoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdJbnN0YW5jZShkZXZpY2UsIGRyYXdDYWxsLCBtZXNoLCBzdHlsZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBVbnNldCBtZXNoSW5zdGFuY2Ugb3ZlcnJpZGVzIGJhY2sgdG8gbWF0ZXJpYWwgdmFsdWVzIGlmIG5leHQgZHJhdyBjYWxsIHdpbGwgdXNlIHRoZSBzYW1lIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgaWYgKGkgPCBwcmVwYXJlZENhbGxzQ291bnQgLSAxICYmICFwcmVwYXJlZENhbGxzLmlzTmV3TWF0ZXJpYWxbaSArIDFdKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlLCBkcmF3Q2FsbC5wYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXJGb3J3YXJkKGNhbWVyYSwgYWxsRHJhd0NhbGxzLCBhbGxEcmF3Q2FsbHNDb3VudCwgc29ydGVkTGlnaHRzLCBwYXNzLCBjdWxsaW5nTWFzaywgZHJhd0NhbGxiYWNrLCBsYXllciwgZmxpcEZhY2VzKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBmb3J3YXJkU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHJ1biBmaXJzdCBwYXNzIG92ZXIgZHJhdyBjYWxscyBhbmQgaGFuZGxlIG1hdGVyaWFsIC8gc2hhZGVyIHVwZGF0ZXNcbiAgICAgICAgY29uc3QgcHJlcGFyZWRDYWxscyA9IHRoaXMucmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMoY2FtZXJhLCBhbGxEcmF3Q2FsbHMsIGFsbERyYXdDYWxsc0NvdW50LCBzb3J0ZWRMaWdodHMsIGN1bGxpbmdNYXNrLCBsYXllciwgcGFzcyk7XG5cbiAgICAgICAgLy8gcmVuZGVyIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgIHRoaXMucmVuZGVyRm9yd2FyZEludGVybmFsKGNhbWVyYSwgcHJlcGFyZWRDYWxscywgc29ydGVkTGlnaHRzLCBwYXNzLCBkcmF3Q2FsbGJhY2ssIGZsaXBGYWNlcyk7XG5cbiAgICAgICAgX2RyYXdDYWxsTGlzdC5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fZm9yd2FyZFRpbWUgKz0gbm93KCkgLSBmb3J3YXJkU3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBkcmF3Q2FsbHMgLSBNZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9ubHlMaXRTaGFkZXJzIC0gTGltaXRzIHRoZSB1cGRhdGUgdG8gc2hhZGVycyBhZmZlY3RlZCBieSBsaWdodGluZy5cbiAgICAgKi9cbiAgICB1cGRhdGVTaGFkZXJzKGRyYXdDYWxscywgb25seUxpdFNoYWRlcnMpIHtcbiAgICAgICAgY29uc3QgY291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1hdCA9IGRyYXdDYWxsc1tpXS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGlmIChtYXQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXRlcmlhbCBub3QgcHJvY2Vzc2VkIHlldFxuICAgICAgICAgICAgICAgIGlmICghX3RlbXBNYXRlcmlhbFNldC5oYXMobWF0KSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcE1hdGVyaWFsU2V0LmFkZChtYXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBmb3IgbWF0ZXJpYWxzIG5vdCB1c2luZyB2YXJpYW50c1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0LmdldFNoYWRlclZhcmlhbnQgIT09IE1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXJWYXJpYW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbmx5TGl0U2hhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNraXAgbWF0ZXJpYWxzIG5vdCB1c2luZyBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0LnVzZUxpZ2h0aW5nIHx8IChtYXQuZW1pdHRlciAmJiAhbWF0LmVtaXR0ZXIubGlnaHRpbmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2hhZGVyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbCBhbmQgYWxzbyBvbiBtZXNoIGluc3RhbmNlcyB0aGF0IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBNYXRlcmlhbFNldC5jbGVhcigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllciBjb21wb3NpdGlvbiB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBsaWdodHNDaGFuZ2VkIC0gVHJ1ZSBpZiBsaWdodHMgb2YgdGhlIGNvbXBvc2l0aW9uIGhhcyBjaGFuZ2VkLlxuICAgICAqL1xuICAgIGJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCkge1xuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcztcblxuICAgICAgICAvLyBVcGRhdGUgc2hhZGVycyBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBpZiAoc2NlbmUudXBkYXRlU2hhZGVycyB8fCBsaWdodHNDaGFuZ2VkKSB7XG4gICAgICAgICAgICBjb25zdCBvbmx5TGl0U2hhZGVycyA9ICFzY2VuZS51cGRhdGVTaGFkZXJzICYmIGxpZ2h0c0NoYW5nZWQ7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMobWVzaEluc3RhbmNlcywgb25seUxpdFNoYWRlcnMpO1xuICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IGZhbHNlO1xuICAgICAgICAgICAgc2NlbmUuX3NoYWRlclZlcnNpb24rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBhbGwgc2tpbiBtYXRyaWNlcyB0byBwcm9wZXJseSBjdWxsIHNraW5uZWQgb2JqZWN0cyAoYnV0IGRvbid0IHVwZGF0ZSByZW5kZXJpbmcgZGF0YSB5ZXQpXG4gICAgICAgIHRoaXMudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKG1lc2hJbnN0YW5jZXMpO1xuXG4gICAgICAgIC8vIGNsZWFyIG1lc2ggaW5zdGFuY2UgdmlzaWJpbGl0eVxuICAgICAgICBjb25zdCBtaUNvdW50ID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWlDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGxpZ2h0IHZpc2liaWxpdHlcbiAgICAgICAgY29uc3QgbGlnaHRzID0gY29tcC5fbGlnaHRzO1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodENvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGxpZ2h0c1tpXS5iZWdpbkZyYW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSBsYXllciBjb21wb3NpdGlvbiBmb3IgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uIHRvIHVwZGF0ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAtIFRydWUgaWYgY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIGVuYWJsZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gLSBGbGFncyBvZiB3aGF0IHdhcyB1cGRhdGVkXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUxheWVyQ29tcG9zaXRpb24oY29tcCwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBsZW4gPSBjb21wLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbXAubGF5ZXJMaXN0W2ldLl9wb3N0UmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IHNoYWRlclZlcnNpb24gPSBzY2VuZS5fc2hhZGVyVmVyc2lvbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgIGxheWVyLl9zaGFkZXJWZXJzaW9uID0gc2hhZGVyVmVyc2lvbjtcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGxheWVyLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgICAgICBsYXllci5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgICAgICBsYXllci5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9yZW5kZXJUaW1lID0gMDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBsYXllci5fcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyA9IDA7XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMgPSAwO1xuICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSBjb21wLnN1YkxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgIGlmICh0cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciB8PSAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgfD0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlck1heCA9IGxheWVyLl9wb3N0UmVuZGVyQ291bnRlcjtcblxuICAgICAgICAgICAgLy8gcHJlcGFyZSBsYXllciBmb3IgY3VsbGluZyB3aXRoIHRoZSBjYW1lcmFcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuY2FtZXJhcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGxheWVyLmluc3RhbmNlcy5wcmVwYXJlKGopO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSBzdGF0aWMgbGlnaHRpbmcgZm9yIG1lc2hlcyBpbiB0aGlzIGxheWVyIGlmIG5lZWRlZFxuICAgICAgICAgICAgLy8gTm90ZTogU3RhdGljIGxpZ2h0aW5nIGlzIG5vdCB1c2VkIHdoZW4gY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmIChsYXllci5fbmVlZHNTdGF0aWNQcmVwYXJlICYmIGxheWVyLl9zdGF0aWNMaWdodEhhc2ggJiYgIXRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogcmV1c2Ugd2l0aCB0aGUgc2FtZSBzdGF0aWNMaWdodEhhc2hcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX3N0YXRpY1ByZXBhcmVEb25lKSB7XG4gICAgICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5yZXZlcnQobGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5yZXZlcnQobGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnByZXBhcmUodGhpcy5kZXZpY2UsIHNjZW5lLCBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzLCBsYXllci5fbGlnaHRzKTtcbiAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucHJlcGFyZSh0aGlzLmRldmljZSwgc2NlbmUsIGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcywgbGF5ZXIuX2xpZ2h0cyk7XG4gICAgICAgICAgICAgICAgY29tcC5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNjZW5lLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGxheWVyLl9uZWVkc1N0YXRpY1ByZXBhcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBsYXllci5fc3RhdGljUHJlcGFyZURvbmUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHN0YXRpYyBsYXllciBkYXRhLCBpZiBzb21ldGhpbmcncyBjaGFuZ2VkXG4gICAgICAgIGNvbnN0IHVwZGF0ZWQgPSBjb21wLl91cGRhdGUodGhpcy5kZXZpY2UsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSArPSBub3coKSAtIGxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICByZXR1cm4gdXBkYXRlZDtcbiAgICB9XG5cbiAgICBncHVVcGRhdGUoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vIHNraXAgZXZlcnl0aGluZyB3aXRoIHZpc2libGVUaGlzRnJhbWUgPT09IGZhbHNlXG4gICAgICAgIHRoaXMudXBkYXRlR3B1U2tpbk1hdHJpY2VzKGRyYXdDYWxscyk7XG4gICAgICAgIHRoaXMudXBkYXRlTW9ycGhpbmcoZHJhd0NhbGxzKTtcbiAgICB9XG5cbiAgICBzZXRTY2VuZUNvbnN0YW50cygpIHtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuXG4gICAgICAgIC8vIFNldCB1cCBhbWJpZW50L2V4cG9zdXJlXG4gICAgICAgIHRoaXMuZGlzcGF0Y2hHbG9iYWxMaWdodHMoc2NlbmUpO1xuXG4gICAgICAgIC8vIFNldCB1cCB0aGUgZm9nXG4gICAgICAgIGlmIChzY2VuZS5mb2cgIT09IEZPR19OT05FKSB7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzBdID0gc2NlbmUuZm9nQ29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMV0gPSBzY2VuZS5mb2dDb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclsyXSA9IHNjZW5lLmZvZ0NvbG9yLmI7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mb2dDb2xvcltpXSA9IE1hdGgucG93KHRoaXMuZm9nQ29sb3JbaV0sIDIuMik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5mb2dDb2xvcklkLnNldFZhbHVlKHRoaXMuZm9nQ29sb3IpO1xuICAgICAgICAgICAgaWYgKHNjZW5lLmZvZyA9PT0gRk9HX0xJTkVBUikge1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nU3RhcnRJZC5zZXRWYWx1ZShzY2VuZS5mb2dTdGFydCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dFbmRJZC5zZXRWYWx1ZShzY2VuZS5mb2dFbmQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ0RlbnNpdHlJZC5zZXRWYWx1ZShzY2VuZS5mb2dEZW5zaXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB1cCBzY3JlZW4gc2l6ZSAvLyBzaG91bGQgYmUgUlQgc2l6ZT9cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMF0gPSBkZXZpY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbMV0gPSBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzJdID0gMSAvIGRldmljZS53aWR0aDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVszXSA9IDEgLyBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB0aGlzLnNjcmVlblNpemVJZC5zZXRWYWx1ZSh0aGlzLl9zY3JlZW5TaXplKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbXBVcGRhdGVkRmxhZ3MgLSBGbGFncyBvZiB3aGF0IHdhcyB1cGRhdGVkLlxuICAgICAqL1xuICAgIHVwZGF0ZUxpZ2h0U3RhdHMoY29tcCwgY29tcFVwZGF0ZWRGbGFncykge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBpZiAoY29tcFVwZGF0ZWRGbGFncyAmIENPTVBVUERBVEVEX0xJR0hUUyB8fCAhc2NlbmUuX3N0YXRzVXBkYXRlZCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBzY2VuZS5fc3RhdHM7XG4gICAgICAgICAgICBzdGF0cy5saWdodHMgPSBjb21wLl9saWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgc3RhdHMuZHluYW1pY0xpZ2h0cyA9IDA7XG4gICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cyA9IDA7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdHMubGlnaHRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsID0gY29tcC5fbGlnaHRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChsLmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKChsLm1hc2sgJiBNQVNLX0FGRkVDVF9EWU5BTUlDKSB8fCAobC5tYXNrICYgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQpKSB7IC8vIGlmIGFmZmVjdHMgZHluYW1pYyBvciBiYWtlZCBvYmplY3RzIGluIHJlYWwtdGltZVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMuZHluYW1pY0xpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChsLm1hc2sgJiBNQVNLX0JBS0UpIHsgLy8gaWYgYmFrZWQgaW50byBsaWdodG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLmJha2VkTGlnaHRzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29tcFVwZGF0ZWRGbGFncyAmIENPTVBVUERBVEVEX0lOU1RBTkNFUyB8fCAhc2NlbmUuX3N0YXRzVXBkYXRlZCkge1xuICAgICAgICAgICAgc2NlbmUuX3N0YXRzLm1lc2hJbnN0YW5jZXMgPSBjb21wLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjZW5lLl9zdGF0c1VwZGF0ZWQgPSB0cnVlO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaGFkb3cgbWFwIGN1bGxpbmcgZm9yIGRpcmVjdGlvbmFsIGFuZCB2aXNpYmxlIGxvY2FsIGxpZ2h0c1xuICAgICAqIHZpc2libGUgbWVzaEluc3RhbmNlcyBhcmUgY29sbGVjdGVkIGludG8gbGlnaHQuX3JlbmRlckRhdGEsIGFuZCBhcmUgbWFya2VkIGFzIHZpc2libGVcbiAgICAgKiBmb3IgZGlyZWN0aW9uYWwgbGlnaHRzIGFsc28gc2hhZG93IGNhbWVyYSBtYXRyaXggaXMgc2V0IHVwXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbFNoYWRvd21hcHMoY29tcCkge1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGxvY2FsIChwb2ludCBhbmQgc3BvdCkgbGlnaHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcC5fbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FzdGVycyA9IGNvbXAuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2ldLnNoYWRvd0Nhc3RlcnNMaXN0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlci5jdWxsTG9jYWwobGlnaHQsIGNhc3RlcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGdsb2JhbCAoZGlyZWN0aW9uYWwpIGxpZ2h0c1xuICAgICAgICAvLyByZW5kZXIgYWN0aW9ucyBzdG9yZSB3aGljaCBkaXJlY3Rpb25hbCBsaWdodHMgYXJlIG5lZWRlZCBmb3IgZWFjaCBjYW1lcmEsIHNvIHRoZXNlIGFyZSBnZXR0aW5nIGN1bGxlZFxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgY291bnQgPSByZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSByZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzW2pdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gY29tcC5fbGlnaHRzW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhc3RlcnMgPSBjb21wLl9saWdodENvbXBvc2l0aW9uRGF0YVtsaWdodEluZGV4XS5zaGFkb3dDYXN0ZXJzTGlzdDtcbiAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlci5jdWxsRGlyZWN0aW9uYWwobGlnaHQsIGNhc3RlcnMsIHJlbmRlckFjdGlvbi5jYW1lcmEuY2FtZXJhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAqIEFsc28gYXBwbGllcyBtZXNoSW5zdGFuY2UudmlzaWJsZSBhbmQgY2FtZXJhLmN1bGxpbmdNYXNrXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbENvbXBvc2l0aW9uKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIHtSZW5kZXJBY3Rpb259ICovXG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuXG4gICAgICAgICAgICAvLyBsYXllclxuICAgICAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICAgICAgLyoqIEB0eXBlIHtMYXllcn0gKi9cbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICBpZiAoIWxheWVyLmVuYWJsZWQgfHwgIWNvbXAuc3ViTGF5ZXJFbmFibGVkW2xheWVySW5kZXhdKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbbGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYVxuICAgICAgICAgICAgY29uc3QgY2FtZXJhUGFzcyA9IHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleDtcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7Q2FtZXJhQ29tcG9uZW50fSAqL1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZyYW1lVXBkYXRlKHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNhbWVyYSBhbmQgZnJ1c3R1bSBvbmNlXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNhbWVyYUZydXN0dW0oY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCsrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGN1bGwgZWFjaCBsYXllcidzIG5vbi1kaXJlY3Rpb25hbCBsaWdodHMgb25jZSB3aXRoIGVhY2ggY2FtZXJhXG4gICAgICAgICAgICAgICAgLy8gbGlnaHRzIGFyZW4ndCBjb2xsZWN0ZWQgYW55d2hlcmUsIGJ1dCBtYXJrZWQgYXMgdmlzaWJsZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VsbExpZ2h0cyhjYW1lcmEuY2FtZXJhLCBsYXllci5fbGlnaHRzKTtcblxuICAgICAgICAgICAgICAgIC8vIGN1bGwgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAgICAgLy8gY29sbGVjdCB0aGVtIGludG8gbGF5ZXIgYXJyYXlzXG4gICAgICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgICAgICAvLyBzaGFyZWQgb2JqZWN0cyBhcmUgb25seSBjdWxsZWQgb25jZVxuICAgICAgICAgICAgICAgIGlmICghdmlzaWJsZS5kb25lKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLm9uUHJlQ3VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25QcmVDdWxsKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gdHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxlbmd0aCA9IHRoaXMuY3VsbChjYW1lcmEuY2FtZXJhLCBkcmF3Q2FsbHMsIHZpc2libGUubGlzdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLm9uUG9zdEN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUG9zdEN1bGwoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjdWxsIHNoYWRvdyBjYXN0ZXJzIGZvciBhbGwgbGlnaHRzXG4gICAgICAgIHRoaXMuY3VsbFNoYWRvd21hcHMoY29tcCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9jdWxsVGltZSArPSBub3coKSAtIGN1bGxUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoY29tcCkge1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLnVwZGF0ZShjb21wLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIGNvbXAuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5zY2VuZS5saWdodGluZyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZUNsdXN0ZXJzKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbXAuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXIgPSBjb21wLl93b3JsZENsdXN0ZXJzW2ldO1xuICAgICAgICAgICAgY2x1c3Rlci51cGRhdGUoY29tcC5fbGlnaHRzLCB0aGlzLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiwgdGhpcy5zY2VuZS5saWdodGluZyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnNUaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gY29tcC5fd29ybGRDbHVzdGVycy5sZW5ndGg7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJ1aWxkcyBhIGZyYW1lIGdyYXBoIGZvciB0aGUgcmVuZGVyaW5nIG9mIHRoZSB3aG9sZSBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZS1ncmFwaCB0aGF0IGlzIGJ1aWx0LlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gbGF5ZXJDb21wb3NpdGlvbiAtIFRoZSBsYXllciBjb21wb3NpdGlvbiB1c2VkIHRvIGJ1aWxkIHRoZSBmcmFtZSBncmFwaC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYnVpbGRGcmFtZUdyYXBoKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBmcmFtZUdyYXBoLnJlc2V0KCk7XG5cbiAgICAgICAgdGhpcy51cGRhdGUobGF5ZXJDb21wb3NpdGlvbik7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIHNoYWRvdyAvIGNvb2tpZSBhdGxhcyBhbGxvY2F0aW9uIGZvciB0aGUgdmlzaWJsZSBsaWdodHNcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMobGF5ZXJDb21wb3NpdGlvbik7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIHJlbmRlciBjb29raWVzIGZvciBhbGwgbG9jYWwgdmlzaWJsZSBsaWdodHNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5saWdodGluZy5jb29raWVzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckNvb2tpZXMobGF5ZXJDb21wb3NpdGlvbi5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJDb29raWVzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgJ0NsdXN0ZXJlZENvb2tpZXMnKTtcbiAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvY2FsIHNoYWRvd3NcbiAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlLCAoKSA9PiB7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBzaGFkb3dzIGZvciBhbGwgbG9jYWwgdmlzaWJsZSBsaWdodHMgLSB0aGVzZSBzaGFkb3cgbWFwcyBhcmUgc2hhcmVkIGJ5IGFsbCBjYW1lcmFzXG4gICAgICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCB8fCAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHRoaXMuc2NlbmUubGlnaHRpbmcuc2hhZG93c0VuYWJsZWQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJTaGFkb3dzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJTaGFkb3dzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBsaWdodCBjbHVzdGVyc1xuICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQ2x1c3RlcnMobGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCAnTG9jYWxTaGFkb3dNYXBzJyk7XG4gICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcblxuICAgICAgICAvLyBtYWluIHBhc3Nlc1xuICAgICAgICBsZXQgc3RhcnRJbmRleCA9IDA7XG4gICAgICAgIGxldCBuZXdTdGFydCA9IHRydWU7XG4gICAgICAgIGxldCByZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gbGF5ZXJDb21wb3NpdGlvbi5fcmVuZGVyQWN0aW9ucztcblxuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RbcmVuZGVyQWN0aW9uLmxheWVySW5kZXhdO1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tyZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBza2lwIGRpc2FibGVkIGxheWVyc1xuICAgICAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24uaXNMYXllckVuYWJsZWQobGF5ZXJDb21wb3NpdGlvbikpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaXNEZXB0aExheWVyID0gbGF5ZXIuaWQgPT09IExBWUVSSURfREVQVEg7XG4gICAgICAgICAgICBjb25zdCBpc0dyYWJQYXNzID0gaXNEZXB0aExheWVyICYmIChjYW1lcmEucmVuZGVyU2NlbmVDb2xvck1hcCB8fCBjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCk7XG5cbiAgICAgICAgICAgIC8vIGRpcmVjdGlvbmFsIHNoYWRvd3MgZ2V0IHJlLXJlbmRlcmVkIGZvciBlYWNoIGNhbWVyYVxuICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5oYXNEaXJlY3Rpb25hbFNoYWRvd0xpZ2h0cyAmJiBjYW1lcmEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzRGlyZWN0aW9uYWxTaGFkb3dzKHJlbmRlckFjdGlvbiwgbGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgRGlyU2hhZG93TWFwYCk7XG4gICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdGFydCBvZiBibG9jayBvZiByZW5kZXIgYWN0aW9ucyByZW5kZXJpbmcgdG8gdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKG5ld1N0YXJ0KSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzdGFydEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICByZW5kZXJUYXJnZXQgPSByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmaW5kIHRoZSBuZXh0IGVuYWJsZWQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgbGV0IG5leHRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgd2hpbGUgKHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XSAmJiAhcmVuZGVyQWN0aW9uc1tuZXh0SW5kZXhdLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgbmV4dEluZGV4Kys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGluZm8gYWJvdXQgdGhlIG5leHQgcmVuZGVyIGFjdGlvblxuICAgICAgICAgICAgY29uc3QgbmV4dFJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbbmV4dEluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyRGVwdGggPSBuZXh0UmVuZGVyQWN0aW9uID8gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RbbmV4dFJlbmRlckFjdGlvbi5sYXllckluZGV4XS5pZCA9PT0gTEFZRVJJRF9ERVBUSCA6IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaXNOZXh0TGF5ZXJHcmFiUGFzcyA9IGlzTmV4dExheWVyRGVwdGggJiYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwIHx8IGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKTtcblxuICAgICAgICAgICAgLy8gZW5kIG9mIHRoZSBibG9jayB1c2luZyB0aGUgc2FtZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICBpZiAoIW5leHRSZW5kZXJBY3Rpb24gfHwgbmV4dFJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQgIT09IHJlbmRlclRhcmdldCB8fFxuICAgICAgICAgICAgICAgIG5leHRSZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgfHwgaXNOZXh0TGF5ZXJHcmFiUGFzcyB8fCBpc0dyYWJQYXNzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkTWFpblJlbmRlclBhc3MoZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbiwgcmVuZGVyVGFyZ2V0LCBzdGFydEluZGV4LCBpLCBpc0dyYWJQYXNzKTtcblxuICAgICAgICAgICAgICAgIC8vIHBvc3Rwcm9jZXNzaW5nXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhPy5vblBvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGBQb3N0cHJvY2Vzc2ApO1xuICAgICAgICAgICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGcmFtZUdyYXBofSBmcmFtZUdyYXBoIC0gVGhlIGZyYW1lIGdyYXBoXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgZW5kSW5kZXgsIGlzR3JhYlBhc3MpIHtcblxuICAgICAgICAvLyByZW5kZXIgdGhlIHJlbmRlciBhY3Rpb25zIGluIHRoZSByYW5nZVxuICAgICAgICBjb25zdCByYW5nZSA9IHsgc3RhcnQ6IHN0YXJ0SW5kZXgsIGVuZDogZW5kSW5kZXggfTtcbiAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBhc3NSZW5kZXJBY3Rpb25zKGxheWVyQ29tcG9zaXRpb24sIHJhbmdlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGNvbnN0IHN0YXJ0UmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tzdGFydEluZGV4XTtcbiAgICAgICAgY29uc3Qgc3RhcnRMYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3N0YXJ0UmVuZGVyQWN0aW9uLmxheWVySW5kZXhdO1xuICAgICAgICBjb25zdCBjYW1lcmEgPSBzdGFydExheWVyLmNhbWVyYXNbc3RhcnRSZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuXG4gICAgICAgIC8vIGRlcHRoIGdyYWIgcGFzcyBvbiB3ZWJnbDEgaXMgbm9ybWFsIHJlbmRlciBwYXNzIChzY2VuZSBnZXRzIHJlLXJlbmRlcmVkKVxuICAgICAgICBjb25zdCBpc1dlYmdsMURlcHRoR3JhYlBhc3MgPSBpc0dyYWJQYXNzICYmICF0aGlzLmRldmljZS53ZWJnbDIgJiYgY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXA7XG4gICAgICAgIGNvbnN0IGlzUmVhbFBhc3MgPSAhaXNHcmFiUGFzcyB8fCBpc1dlYmdsMURlcHRoR3JhYlBhc3M7XG5cbiAgICAgICAgaWYgKGlzUmVhbFBhc3MpIHtcblxuICAgICAgICAgICAgcmVuZGVyUGFzcy5pbml0KHJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICByZW5kZXJQYXNzLmZ1bGxTaXplQ2xlYXJSZWN0ID0gY2FtZXJhLmNhbWVyYS5mdWxsU2l6ZUNsZWFyUmVjdDtcblxuICAgICAgICAgICAgaWYgKGlzV2ViZ2wxRGVwdGhHcmFiUGFzcykge1xuXG4gICAgICAgICAgICAgICAgLy8gd2ViZ2wxIGRlcHRoIHJlbmRlcmluZyBjbGVhciB2YWx1ZXNcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyQ29sb3Iod2ViZ2wxRGVwdGhDbGVhckNvbG9yKTtcbiAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyRGVwdGgoMS4wKTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChyZW5kZXJQYXNzLmZ1bGxTaXplQ2xlYXJSZWN0KSB7IC8vIGlmIGNhbWVyYSByZW5kZXJpbmcgY292ZXJzIHRoZSBmdWxsIHZpZXdwb3J0XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJDb2xvcikge1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnNldENsZWFyQ29sb3IoY2FtZXJhLmNhbWVyYS5jbGVhckNvbG9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckRlcHRoKGNhbWVyYS5jYW1lcmEuY2xlYXJEZXB0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhclN0ZW5jaWwoY2FtZXJhLmNhbWVyYS5jbGVhclN0ZW5jaWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgYCR7aXNHcmFiUGFzcyA/ICdTY2VuZUdyYWInIDogJ1JlbmRlckFjdGlvbid9ICR7c3RhcnRJbmRleH0tJHtlbmRJbmRleH0gYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYENhbTogJHtjYW1lcmEgPyBjYW1lcmEuZW50aXR5Lm5hbWUgOiAnLSd9YCk7XG4gICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlKGNvbXApIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBza3lib3gsIHNpbmNlIHRoaXMgbWlnaHQgY2hhbmdlIF9tZXNoSW5zdGFuY2VzXG4gICAgICAgIHRoaXMuc2NlbmUuX3VwZGF0ZVNreSh0aGlzLmRldmljZSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGxheWVyIGNvbXBvc2l0aW9uIGlmIHNvbWV0aGluZyBoYXMgYmVlbiBpbnZhbGlkYXRlZFxuICAgICAgICBjb25zdCB1cGRhdGVkID0gdGhpcy51cGRhdGVMYXllckNvbXBvc2l0aW9uKGNvbXAsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCk7XG4gICAgICAgIGNvbnN0IGxpZ2h0c0NoYW5nZWQgPSAodXBkYXRlZCAmIENPTVBVUERBVEVEX0xJR0hUUykgIT09IDA7XG5cbiAgICAgICAgdGhpcy51cGRhdGVMaWdodFN0YXRzKGNvbXAsIHVwZGF0ZWQpO1xuXG4gICAgICAgIC8vIFNpbmdsZSBwZXItZnJhbWUgY2FsY3VsYXRpb25zXG4gICAgICAgIHRoaXMuYmVnaW5GcmFtZShjb21wLCBsaWdodHNDaGFuZ2VkKTtcbiAgICAgICAgdGhpcy5zZXRTY2VuZUNvbnN0YW50cygpO1xuXG4gICAgICAgIC8vIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAgICAvLyBhZnRlciB0aGlzIHRoZSBzY2VuZSBjdWxsaW5nIGlzIGRvbmUgYW5kIHNjcmlwdCBjYWxsYmFja3MgY2FuIGJlIGNhbGxlZCB0byByZXBvcnQgd2hpY2ggb2JqZWN0cyBhcmUgdmlzaWJsZVxuICAgICAgICB0aGlzLmN1bGxDb21wb3NpdGlvbihjb21wKTtcblxuICAgICAgICAvLyBHUFUgdXBkYXRlIGZvciBhbGwgdmlzaWJsZSBvYmplY3RzXG4gICAgICAgIHRoaXMuZ3B1VXBkYXRlKGNvbXAuX21lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwYXNzIGZvciBkaXJlY3Rpb25hbCBzaGFkb3cgbWFwcyBvZiB0aGUgY2FtZXJhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJBY3Rpb259IHJlbmRlckFjdGlvbiAtIFRoZSByZW5kZXIgYWN0aW9uLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gbGF5ZXJDb21wb3NpdGlvbiAtIFRoZSBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc0RpcmVjdGlvbmFsU2hhZG93cyhyZW5kZXJBY3Rpb24sIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQocmVuZGVyQWN0aW9uLmRpcmVjdGlvbmFsTGlnaHRzLmxlbmd0aCA+IDApO1xuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tyZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuXG4gICAgICAgIHRoaXMucmVuZGVyU2hhZG93cyhyZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHMsIGNhbWVyYS5jYW1lcmEpO1xuICAgIH1cblxuICAgIHJlbmRlclBhc3NQb3N0cHJvY2Vzc2luZyhyZW5kZXJBY3Rpb24sIGxheWVyQ29tcG9zaXRpb24pIHtcblxuICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tyZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXhdO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyAmJiBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZyk7XG5cbiAgICAgICAgLy8gdHJpZ2dlciBwb3N0cHJvY2Vzc2luZyBmb3IgY2FtZXJhXG4gICAgICAgIGNhbWVyYS5vblBvc3Rwcm9jZXNzaW5nKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBhc3MgcmVwcmVzZW50aW5nIHRoZSBsYXllciBjb21wb3NpdGlvbidzIHJlbmRlciBhY3Rpb25zIGluIHRoZSBzcGVjaWZpZWQgcmFuZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSB0aGUgbGF5ZXIgY29tcG9zaXRpb24gdG8gcmVuZGVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyhjb21wLCByYW5nZSkge1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gcmFuZ2Uuc3RhcnQ7IGkgPD0gcmFuZ2UuZW5kOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbnNbaV0sIGkgPT09IHJhbmdlLnN0YXJ0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcGFyYW0ge1JlbmRlckFjdGlvbn0gcmVuZGVyQWN0aW9uIC0gVGhlIHJlbmRlciBhY3Rpb24uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaXJzdFJlbmRlckFjdGlvbiAtIFRydWUgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBpbiB0aGUgcmVuZGVyIHBhc3MuXG4gICAgICovXG4gICAgcmVuZGVyUmVuZGVyQWN0aW9uKGNvbXAsIHJlbmRlckFjdGlvbiwgZmlyc3RSZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24uaXNMYXllckVuYWJsZWQoY29tcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgY2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJ25vbmFtZScpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGxheWVyLm5hbWUpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZHJhd1RpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgYmVmb3JlIHJlbmRlcmluZyB3aXRoIHRoaXMgY2FtZXJhIGZvciB0aGUgZmlyc3QgdGltZSBkdXJpbmcgdGhlIGZyYW1lXG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uLmZpcnN0Q2FtZXJhVXNlICYmIGNhbWVyYS5vblByZVJlbmRlcikge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5vblByZVJlbmRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbCBwcmVyZW5kZXIgY2FsbGJhY2sgaWYgdGhlcmUncyBvbmVcbiAgICAgICAgaWYgKCF0cmFuc3BhcmVudCAmJiBsYXllci5vblByZVJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUoY2FtZXJhUGFzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodHJhbnNwYXJlbnQgJiYgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGxlZCBmb3IgdGhlIGZpcnN0IHN1YmxheWVyIGFuZCBmb3IgZXZlcnkgY2FtZXJhXG4gICAgICAgIGlmICghKGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBpZiAobGF5ZXIub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblByZVJlbmRlcihjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCBhIGZpcnN0IHJlbmRlciBhY3Rpb24gdG8gdGhlIHJlbmRlciB0YXJnZXQsIG9yIGlmIHRoZSByZW5kZXIgdGFyZ2V0IHdhcyBub3RcbiAgICAgICAgICAgIC8vIGZ1bGx5IGNsZWFyZWQgb24gcGFzcyBzdGFydCwgd2UgbmVlZCB0byBleGVjdXRlIGNsZWFycyBoZXJlXG4gICAgICAgICAgICBpZiAoIWZpcnN0UmVuZGVyQWN0aW9uIHx8ICFjYW1lcmEuY2FtZXJhLmZ1bGxTaXplQ2xlYXJSZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhcihyZW5kZXJBY3Rpb24sIGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzb3J0VGltZSA9IG5vdygpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9zb3J0VmlzaWJsZSh0cmFuc3BhcmVudCwgY2FtZXJhLmNhbWVyYS5ub2RlLCBjYW1lcmFQYXNzKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5fc29ydFRpbWUgKz0gbm93KCkgLSBzb3J0VGltZTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIC8vIGFkZCBkZWJ1ZyBtZXNoIGluc3RhbmNlcyB0byB2aXNpYmxlIGxpc3RcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLm9uUHJlUmVuZGVyTGF5ZXIobGF5ZXIsIHZpc2libGUsIHRyYW5zcGFyZW50KTtcblxuICAgICAgICAgICAgLy8gdXBsb2FkIGNsdXN0ZXJlZCBsaWdodHMgdW5pZm9ybXNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycy5hY3RpdmF0ZSh0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAgICAgICAgIC8vIGRlYnVnIHJlbmRlcmluZyBvZiBjbHVzdGVyc1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgJiYgdGhpcy5zY2VuZS5saWdodGluZy5kZWJ1Z0xheWVyID09PSBsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIFdvcmxkQ2x1c3RlcnNEZWJ1Zy5yZW5kZXIocmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMsIHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBub3QgdmVyeSBjbGV2ZXIgZ2xvYmFsIHZhcmlhYmxlIHdoaWNoIGlzIG9ubHkgdXNlZnVsIHdoZW4gdGhlcmUncyBqdXN0IG9uZSBjYW1lcmFcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX2FjdGl2ZUNhbWVyYSA9IGNhbWVyYS5jYW1lcmE7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLmNhbWVyYSwgcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCwgcmVuZGVyQWN0aW9uKTtcblxuICAgICAgICAgICAgLy8gZW5hYmxlIGZsaXAgZmFjZXMgaWYgZWl0aGVyIHRoZSBjYW1lcmEgaGFzIF9mbGlwRmFjZXMgZW5hYmxlZCBvciB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgLy8gaGFzIGZsaXBZIGVuYWJsZWRcbiAgICAgICAgICAgIGNvbnN0IGZsaXBGYWNlcyA9ICEhKGNhbWVyYS5jYW1lcmEuX2ZsaXBGYWNlcyBeIHJlbmRlckFjdGlvbj8ucmVuZGVyVGFyZ2V0Py5mbGlwWSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGRyYXdzID0gdGhpcy5fZm9yd2FyZERyYXdDYWxscztcbiAgICAgICAgICAgIHRoaXMucmVuZGVyRm9yd2FyZChjYW1lcmEuY2FtZXJhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUubGlzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5fc3BsaXRMaWdodHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuc2hhZGVyUGFzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5jdWxsaW5nTWFzayxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5vbkRyYXdDYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyk7XG4gICAgICAgICAgICBsYXllci5fZm9yd2FyZERyYXdDYWxscyArPSB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzIC0gZHJhd3M7XG5cbiAgICAgICAgICAgIC8vIFJldmVydCB0ZW1wIGZyYW1lIHN0dWZmXG4gICAgICAgICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBub3QgYmUgaGVyZSwgYXMgZWFjaCByZW5kZXJpbmcgLyBjbGVhcmluZyBzaG91bGQgZXhwbGljaXRseSBzZXQgdXAgd2hhdFxuICAgICAgICAgICAgLy8gaXQgcmVxdWlyZXMgKHRoZSBwcm9wZXJ0aWVzIGFyZSBwYXJ0IG9mIHJlbmRlciBwaXBlbGluZSBvbiBXZWJHUFUgYW55d2F5cylcbiAgICAgICAgICAgIGRldmljZS5zZXRDb2xvcldyaXRlKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxUZXN0KGZhbHNlKTsgLy8gZG9uJ3QgbGVhayBzdGVuY2lsIHN0YXRlXG4gICAgICAgICAgICBkZXZpY2Uuc2V0QWxwaGFUb0NvdmVyYWdlKGZhbHNlKTsgLy8gZG9uJ3QgbGVhayBhMmMgc3RhdGVcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXMoZmFsc2UpO1xuXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBvbiB0aGUgY2FtZXJhIGNvbXBvbmVudCB3aGVuIHdlJ3JlIGRvbmUgcmVuZGVyaW5nIGFsbCBsYXllcnMgd2l0aCB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5sYXN0Q2FtZXJhVXNlICYmIGNhbWVyYS5vblBvc3RSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEub25Qb3N0UmVuZGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsIGxheWVyJ3MgcG9zdHJlbmRlciBjYWxsYmFjayBpZiB0aGVyZSdzIG9uZVxuICAgICAgICBpZiAoIXRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZSkge1xuICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyT3BhcXVlKGNhbWVyYVBhc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYW5zcGFyZW50ICYmIGxheWVyLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXJUcmFuc3BhcmVudChjYW1lcmFQYXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGF5ZXIub25Qb3N0UmVuZGVyICYmICEobGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzICYgKDEgPDwgY2FtZXJhUGFzcykpKSB7XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgJj0gfih0cmFuc3BhcmVudCA/IDIgOiAxKTtcbiAgICAgICAgICAgIGlmIChsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICBsYXllci5vblBvc3RSZW5kZXIoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIHw9IDEgPDwgY2FtZXJhUGFzcztcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGxheWVyLl9yZW5kZXJUaW1lICs9IG5vdygpIC0gZHJhd1RpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cbn1cblxuZXhwb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsidmlld0ludk1hdCIsIk1hdDQiLCJ2aWV3TWF0Iiwidmlld01hdDMiLCJNYXQzIiwidmlld1Byb2pNYXQiLCJwcm9qTWF0IiwiZmxpcFlNYXQiLCJzZXRTY2FsZSIsImZsaXBwZWRWaWV3UHJvak1hdCIsImZsaXBwZWRTa3lib3hQcm9qTWF0Iiwid29ybGRNYXRYIiwiVmVjMyIsIndvcmxkTWF0WSIsIndvcmxkTWF0WiIsIndlYmdsMURlcHRoQ2xlYXJDb2xvciIsIkNvbG9yIiwidGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiYm9uZVRleHR1cmVTaXplIiwiYm9uZVRleHR1cmUiLCJpbnN0YW5jaW5nRGF0YSIsIm1vZGVsTWF0cml4Iiwia2V5QSIsImtleUIiLCJfc2tpblVwZGF0ZUluZGV4IiwiX2RyYXdDYWxsTGlzdCIsImRyYXdDYWxscyIsImlzTmV3TWF0ZXJpYWwiLCJsaWdodE1hc2tDaGFuZ2VkIiwiX3RlbXBNYXRlcmlhbFNldCIsIlNldCIsIkZvcndhcmRSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJjbHVzdGVyc0RlYnVnUmVuZGVyZWQiLCJkZXZpY2UiLCJzY2VuZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9za2luRHJhd0NhbGxzIiwiX251bURyYXdDYWxsc0N1bGxlZCIsIl9pbnN0YW5jZWREcmF3Q2FsbHMiLCJfY2FtZXJhc1JlbmRlcmVkIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJfc2hhZG93TWFwVXBkYXRlcyIsIl9zaGFkb3dNYXBUaW1lIiwiX2RlcHRoTWFwVGltZSIsIl9mb3J3YXJkVGltZSIsIl9jdWxsVGltZSIsIl9zb3J0VGltZSIsIl9za2luVGltZSIsIl9tb3JwaFRpbWUiLCJfbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJfbGlnaHRDbHVzdGVyc1RpbWUiLCJfbGlnaHRDbHVzdGVycyIsImxpYnJhcnkiLCJnZXRQcm9ncmFtTGlicmFyeSIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiTGlnaHRUZXh0dXJlQXRsYXMiLCJfc2hhZG93UmVuZGVyZXIiLCJTaGFkb3dSZW5kZXJlciIsIl9jb29raWVSZW5kZXJlciIsIkNvb2tpZVJlbmRlcmVyIiwic2NvcGUiLCJwcm9qSWQiLCJyZXNvbHZlIiwicHJvalNreWJveElkIiwidmlld0lkIiwidmlld0lkMyIsInZpZXdJbnZJZCIsInZpZXdQcm9qSWQiLCJmbGlwWUlkIiwidmlld1BvcyIsIkZsb2F0MzJBcnJheSIsInZpZXdQb3NJZCIsIm5lYXJDbGlwSWQiLCJmYXJDbGlwSWQiLCJjYW1lcmFQYXJhbXNJZCIsInRibkJhc2lzIiwiZm9nQ29sb3JJZCIsImZvZ1N0YXJ0SWQiLCJmb2dFbmRJZCIsImZvZ0RlbnNpdHlJZCIsIm1vZGVsTWF0cml4SWQiLCJub3JtYWxNYXRyaXhJZCIsInBvc2VNYXRyaXhJZCIsImJvbmVUZXh0dXJlSWQiLCJib25lVGV4dHVyZVNpemVJZCIsIm1vcnBoV2VpZ2h0c0EiLCJtb3JwaFdlaWdodHNCIiwibW9ycGhQb3NpdGlvblRleCIsIm1vcnBoTm9ybWFsVGV4IiwibW9ycGhUZXhQYXJhbXMiLCJhbHBoYVRlc3RJZCIsIm9wYWNpdHlNYXBJZCIsImFtYmllbnRJZCIsImV4cG9zdXJlSWQiLCJza3lib3hJbnRlbnNpdHlJZCIsImxpZ2h0Q29sb3JJZCIsImxpZ2h0RGlyIiwibGlnaHREaXJJZCIsImxpZ2h0U2hhZG93TWFwSWQiLCJsaWdodFNoYWRvd01hdHJpeElkIiwibGlnaHRTaGFkb3dQYXJhbXNJZCIsImxpZ2h0U2hhZG93SW50ZW5zaXR5IiwibGlnaHRSYWRpdXNJZCIsImxpZ2h0UG9zIiwibGlnaHRQb3NJZCIsImxpZ2h0V2lkdGgiLCJsaWdodFdpZHRoSWQiLCJsaWdodEhlaWdodCIsImxpZ2h0SGVpZ2h0SWQiLCJsaWdodEluQW5nbGVJZCIsImxpZ2h0T3V0QW5nbGVJZCIsImxpZ2h0Q29va2llSWQiLCJsaWdodENvb2tpZUludElkIiwibGlnaHRDb29raWVNYXRyaXhJZCIsImxpZ2h0Q29va2llT2Zmc2V0SWQiLCJzaGFkb3dNYXRyaXhQYWxldHRlSWQiLCJzaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWQiLCJzaGFkb3dDYXNjYWRlQ291bnRJZCIsInNjcmVlblNpemVJZCIsIl9zY3JlZW5TaXplIiwidHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9ySWQiLCJmb2dDb2xvciIsImFtYmllbnRDb2xvciIsImNhbWVyYVBhcmFtcyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsImRlc3Ryb3kiLCJzb3J0Q29tcGFyZSIsImRyYXdDYWxsQSIsImRyYXdDYWxsQiIsImxheWVyIiwiZHJhd09yZGVyIiwiemRpc3QiLCJ6ZGlzdDIiLCJfa2V5IiwiU09SVEtFWV9GT1JXQVJEIiwic29ydENvbXBhcmVNZXNoIiwibWVzaCIsImlkIiwiZGVwdGhTb3J0Q29tcGFyZSIsIlNPUlRLRVlfREVQVEgiLCJ1cGRhdGVDYW1lcmFGcnVzdHVtIiwiY2FtZXJhIiwieHIiLCJ2aWV3cyIsImxlbmd0aCIsInZpZXciLCJtdWwyIiwidmlld09mZk1hdCIsImZydXN0dW0iLCJzZXRGcm9tTWF0NCIsInByb2plY3Rpb25NYXRyaXgiLCJjYWxjdWxhdGVQcm9qZWN0aW9uIiwiVklFV19DRU5URVIiLCJjYWxjdWxhdGVUcmFuc2Zvcm0iLCJwb3MiLCJfbm9kZSIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJzZXRUUlMiLCJPTkUiLCJzZXRWYWx1ZSIsImRhdGEiLCJjb3B5IiwiaW52ZXJ0IiwiaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJCaW5kVGV4dHVyZUZvcm1hdCIsIlRFWFRVUkVESU1FTlNJT05fMkQiLCJTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCIsInNldENhbWVyYVVuaWZvcm1zIiwidGFyZ2V0IiwicmVuZGVyQWN0aW9uIiwidHJhbnNmb3JtIiwidmlld0NvdW50Iiwic2Vzc2lvbiIsInBhcmVudCIsImdldFdvcmxkVHJhbnNmb3JtIiwidiIsInZpZXdJbnZPZmZNYXQiLCJwcm9qVmlld09mZk1hdCIsInBvc2l0aW9uIiwiZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCIsImZsaXBZIiwiZGlzcGF0Y2hWaWV3UG9zIiwiX25lYXJDbGlwIiwiX2ZhckNsaXAiLCJwaHlzaWNhbFVuaXRzIiwiZ2V0RXhwb3N1cmUiLCJleHBvc3VyZSIsIm4iLCJmIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJzZXRDYW1lcmEiLCJjbGVhciIsImNsZWFyVmlldyIsIkRlYnVnIiwiYXNzZXJ0Iiwidmlld0JpbmRHcm91cHMiLCJ1YiIsIlVuaWZvcm1CdWZmZXIiLCJiZyIsIkJpbmRHcm91cCIsInB1c2giLCJ2aWV3QmluZEdyb3VwIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJ1cGRhdGUiLCJzZXRCaW5kR3JvdXAiLCJCSU5ER1JPVVBfVklFVyIsInNldHVwVmlld3BvcnQiLCJyZW5kZXJUYXJnZXQiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInBpeGVsV2lkdGgiLCJ3aWR0aCIsInBpeGVsSGVpZ2h0IiwiaGVpZ2h0IiwicmVjdCIsIngiLCJNYXRoIiwiZmxvb3IiLCJ5IiwidyIsInoiLCJoIiwic2V0Vmlld3BvcnQiLCJfc2Npc3NvclJlY3RDbGVhciIsInNjaXNzb3JSZWN0Iiwic2V0U2Npc3NvciIsInBvcEdwdU1hcmtlciIsImNvbG9yIiwiX2NsZWFyQ29sb3IiLCJyIiwiZyIsImIiLCJhIiwiZGVwdGgiLCJfY2xlYXJEZXB0aCIsInN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsIiwiZmxhZ3MiLCJjbGVhckNvbG9yIiwiQ0xFQVJGTEFHX0NPTE9SIiwiY2xlYXJEZXB0aCIsIkNMRUFSRkxBR19ERVBUSCIsImNsZWFyU3RlbmNpbCIsIkNMRUFSRkxBR19TVEVOQ0lMIiwiZm9yY2VXcml0ZSIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0Q29sb3JXcml0ZSIsInNldERlcHRoV3JpdGUiLCJvcHRpb25zIiwiX2NsZWFyT3B0aW9ucyIsIl9jbGVhckNvbG9yQnVmZmVyIiwiX2NsZWFyRGVwdGhCdWZmZXIiLCJfY2xlYXJTdGVuY2lsQnVmZmVyIiwiZGlzcGF0Y2hHbG9iYWxMaWdodHMiLCJhbWJpZW50TGlnaHQiLCJnYW1tYUNvcnJlY3Rpb24iLCJpIiwicG93IiwiYW1iaWVudEx1bWluYW5jZSIsInNreSIsInNreWJveEx1bWluYW5jZSIsInNreWJveEludGVuc2l0eSIsIl9yZXNvbHZlTGlnaHQiLCJsaWdodCIsInNldExUQ0RpcmVjdGlvbmFsTGlnaHQiLCJ3dG0iLCJjbnQiLCJkaXIiLCJjYW1wb3MiLCJmYXIiLCJoV2lkdGgiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJoSGVpZ2h0IiwiZGlzcGF0Y2hEaXJlY3RMaWdodHMiLCJkaXJzIiwibWFzayIsImRpcmVjdGlvbmFsIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsImdldFkiLCJfZGlyZWN0aW9uIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwic2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiZmFyQ2xpcCIsImNhc3RTaGFkb3dzIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsImJpYXNlcyIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsInNoYWRvd0J1ZmZlciIsInNoYWRvd01hdHJpeCIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwiX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMiLCJudW1DYXNjYWRlcyIsInNoYWRvd0ludGVuc2l0eSIsInBhcmFtcyIsIl9zaGFkb3dSZW5kZXJQYXJhbXMiLCJfc2hhZG93UmVzb2x1dGlvbiIsIm5vcm1hbEJpYXMiLCJiaWFzIiwic2V0TFRDUG9zaXRpb25hbExpZ2h0IiwiZGlzcGF0Y2hPbW5pTGlnaHQiLCJvbW5pIiwiYXR0ZW51YXRpb25FbmQiLCJnZXRUcmFuc2xhdGlvbiIsIl9wb3NpdGlvbiIsIl9jb29raWUiLCJjb29raWVJbnRlbnNpdHkiLCJkaXNwYXRjaFNwb3RMaWdodCIsInNwb3QiLCJfaW5uZXJDb25lQW5nbGVDb3MiLCJfb3V0ZXJDb25lQW5nbGVDb3MiLCJjb29raWVNYXRyaXgiLCJMaWdodENhbWVyYSIsImV2YWxTcG90Q29va2llTWF0cml4IiwiX2Nvb2tpZVRyYW5zZm9ybSIsIl9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtIiwiX2Nvb2tpZU9mZnNldFVuaWZvcm0iLCJfY29va2llT2Zmc2V0IiwiZGlzcGF0Y2hMb2NhbExpZ2h0cyIsInNvcnRlZExpZ2h0cyIsInVzZWREaXJMaWdodHMiLCJzdGF0aWNMaWdodExpc3QiLCJvbW5pcyIsIkxJR0hUVFlQRV9PTU5JIiwibnVtT21uaXMiLCJpc1N0YXRpYyIsInN0YXRpY0lkIiwiX3R5cGUiLCJzcHRzIiwiTElHSFRUWVBFX1NQT1QiLCJudW1TcHRzIiwiY3VsbCIsInZpc2libGVMaXN0IiwiY3VsbFRpbWUiLCJub3ciLCJudW1EcmF3Q2FsbHNDdWxsZWQiLCJ2aXNpYmxlTGVuZ3RoIiwiZHJhd0NhbGxzQ291bnQiLCJjdWxsaW5nTWFzayIsImZydXN0dW1DdWxsaW5nIiwiZHJhd0NhbGwiLCJ2aXNpYmxlIiwiY29tbWFuZCIsInZpc2libGVUaGlzRnJhbWUiLCJfaXNWaXNpYmxlIiwiY3VsbExpZ2h0cyIsImxpZ2h0cyIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImVuYWJsZWQiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJnZXRCb3VuZGluZ1NwaGVyZSIsImNvbnRhaW5zU3BoZXJlIiwidXNlUGh5c2ljYWxVbml0cyIsInNjcmVlblNpemUiLCJnZXRTY3JlZW5TaXplIiwibWF4U2NyZWVuU2l6ZSIsIm1heCIsInNoYWRvd01hcCIsInVwZGF0ZUNwdVNraW5NYXRyaWNlcyIsInNraW5UaW1lIiwic2kiLCJza2luSW5zdGFuY2UiLCJ1cGRhdGVNYXRyaWNlcyIsIm5vZGUiLCJfZGlydHkiLCJ1cGRhdGVHcHVTa2luTWF0cmljZXMiLCJza2luIiwidXBkYXRlTWF0cml4UGFsZXR0ZSIsInVwZGF0ZU1vcnBoaW5nIiwibW9ycGhUaW1lIiwibW9ycGhJbnN0IiwibW9ycGhJbnN0YW5jZSIsInNldEJhc2VDb25zdGFudHMiLCJtYXRlcmlhbCIsInNldEN1bGxNb2RlIiwib3BhY2l0eU1hcCIsImFscGhhVGVzdCIsInNldFNraW5uaW5nIiwibWVzaEluc3RhbmNlIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJtYXRyaXhQYWxldHRlIiwiZHJhd0luc3RhbmNlIiwic3R5bGUiLCJub3JtYWwiLCJuYW1lIiwiY291bnQiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJ2ZXJ0ZXhCdWZmZXIiLCJkcmF3IiwicHJpbWl0aXZlIiwid29ybGRUcmFuc2Zvcm0iLCJub3JtYWxNYXRyaXgiLCJkcmF3SW5zdGFuY2UyIiwidW5kZWZpbmVkIiwicmVuZGVyU2hhZG93cyIsImlzQ2x1c3RlcmVkIiwic2hhZG93TWFwU3RhcnRUaW1lIiwiYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCIsImF0bGFzU2xvdFVwZGF0ZWQiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwicmVuZGVyIiwicmVuZGVyQ29va2llcyIsImNvb2tpZVJlbmRlclRhcmdldCIsImN1bGxGYWNlcyIsImZsaXAiLCJtb2RlIiwiQ1VMTEZBQ0VfTk9ORSIsImZsaXBGYWNlcyIsIkNVTExGQUNFX0ZST05UQU5EQkFDSyIsInd0IiwiZ2V0WCIsImdldFoiLCJjcm9zcyIsImRvdCIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfQkFDSyIsInd0MiIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRNb3JwaGluZyIsIm1vcnBoIiwidXNlVGV4dHVyZU1vcnBoIiwidmVydGV4QnVmZmVySWRzIiwidGV4dHVyZVBvc2l0aW9ucyIsInRleHR1cmVOb3JtYWxzIiwiX3RleHR1cmVQYXJhbXMiLCJ0IiwiX2FjdGl2ZVZlcnRleEJ1ZmZlcnMiLCJ2YiIsInNlbWFudGljIiwiU0VNQU5USUNfQVRUUiIsImZvcm1hdCIsImVsZW1lbnRzIiwic2NvcGVJZCIsIl9zaGFkZXJNb3JwaFdlaWdodHNBIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0IiLCJ2cCIsInJlbmRlckZvcndhcmRQcmVwYXJlTWF0ZXJpYWxzIiwicGFzcyIsImFkZENhbGwiLCJsaWdodEhhc2giLCJfbGlnaHRIYXNoIiwicHJldk1hdGVyaWFsIiwicHJldk9iakRlZnMiLCJwcmV2U3RhdGljIiwicHJldkxpZ2h0TWFzayIsInNraXBSZW5kZXJDYW1lcmEiLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJza2lwUmVuZGVyQWZ0ZXIiLCJlbnN1cmVNYXRlcmlhbCIsIm9iakRlZnMiLCJfc2hhZGVyRGVmcyIsImxpZ2h0TWFzayIsIl9zY2VuZSIsImRpcnR5IiwidXBkYXRlVW5pZm9ybXMiLCJfZGlydHlCbGVuZCIsImxheWVycyIsIl9zaGFkZXIiLCJ2YXJpYW50S2V5IiwidmFyaWFudHMiLCJ1cGRhdGVQYXNzU2hhZGVyIiwiX3N0YXRpY0xpZ2h0TGlzdCIsInJlbmRlckZvcndhcmRJbnRlcm5hbCIsInByZXBhcmVkQ2FsbHMiLCJkcmF3Q2FsbGJhY2siLCJwYXNzRmxhZyIsInByZXBhcmVkQ2FsbHNDb3VudCIsIm5ld01hdGVyaWFsIiwic2hhZGVyIiwiZmFpbGVkIiwic2V0U2hhZGVyIiwiZXJyb3IiLCJzZXRQYXJhbWV0ZXJzIiwic2V0QmxlbmRpbmciLCJibGVuZCIsInNlcGFyYXRlQWxwaGFCbGVuZCIsInNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZSIsImJsZW5kU3JjIiwiYmxlbmREc3QiLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsInNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZSIsImJsZW5kRXF1YXRpb24iLCJibGVuZEFscGhhRXF1YXRpb24iLCJzZXRCbGVuZEZ1bmN0aW9uIiwic2V0QmxlbmRFcXVhdGlvbiIsInJlZFdyaXRlIiwiZ3JlZW5Xcml0ZSIsImJsdWVXcml0ZSIsImFscGhhV3JpdGUiLCJkZXB0aFdyaXRlIiwiZGVwdGhUZXN0Iiwic2V0RGVwdGhGdW5jIiwiRlVOQ19BTFdBWVMiLCJzZXREZXB0aFRlc3QiLCJkZXB0aEZ1bmMiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRvQ292ZXJhZ2UiLCJkZXB0aEJpYXMiLCJzbG9wZURlcHRoQmlhcyIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsIl9jdWxsRmFjZXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInNldFN0ZW5jaWxUZXN0Iiwic2V0U3RlbmNpbEZ1bmMiLCJmdW5jIiwicmVmIiwicmVhZE1hc2siLCJzZXRTdGVuY2lsT3BlcmF0aW9uIiwiZmFpbCIsInpmYWlsIiwienBhc3MiLCJ3cml0ZU1hc2siLCJzZXRTdGVuY2lsRnVuY0Zyb250Iiwic2V0U3RlbmNpbE9wZXJhdGlvbkZyb250IiwiU1RFTkNJTE9QX0tFRVAiLCJzZXRTdGVuY2lsRnVuY0JhY2siLCJzZXRTdGVuY2lsT3BlcmF0aW9uQmFjayIsIm1lc2hCaW5kR3JvdXAiLCJnZXRCaW5kR3JvdXAiLCJCSU5ER1JPVVBfTUVTSCIsInJlbmRlclN0eWxlIiwic2V0SW5kZXhCdWZmZXIiLCJpbmRleEJ1ZmZlciIsInZpZXdwb3J0IiwicGFyYW1ldGVycyIsInJlbmRlckZvcndhcmQiLCJhbGxEcmF3Q2FsbHMiLCJhbGxEcmF3Q2FsbHNDb3VudCIsImZvcndhcmRTdGFydFRpbWUiLCJ1cGRhdGVTaGFkZXJzIiwib25seUxpdFNoYWRlcnMiLCJtYXQiLCJoYXMiLCJhZGQiLCJnZXRTaGFkZXJWYXJpYW50IiwiTWF0ZXJpYWwiLCJwcm90b3R5cGUiLCJ1c2VMaWdodGluZyIsImVtaXR0ZXIiLCJsaWdodGluZyIsImNsZWFyVmFyaWFudHMiLCJiZWdpbkZyYW1lIiwiY29tcCIsImxpZ2h0c0NoYW5nZWQiLCJtZXNoSW5zdGFuY2VzIiwiX21lc2hJbnN0YW5jZXMiLCJfc2hhZGVyVmVyc2lvbiIsIm1pQ291bnQiLCJfbGlnaHRzIiwibGlnaHRDb3VudCIsInVwZGF0ZUxheWVyQ29tcG9zaXRpb24iLCJsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsImxlbiIsImxheWVyTGlzdCIsIl9wb3N0UmVuZGVyQ291bnRlciIsInNoYWRlclZlcnNpb24iLCJfcmVuZGVyVGltZSIsIl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckxpc3QiLCJfcG9zdFJlbmRlckNvdW50ZXJNYXgiLCJqIiwiY2FtZXJhcyIsImluc3RhbmNlcyIsInByZXBhcmUiLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiX3N0YXRpY0xpZ2h0SGFzaCIsIl9zdGF0aWNQcmVwYXJlRG9uZSIsIlN0YXRpY01lc2hlcyIsInJldmVydCIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJ1cGRhdGVkIiwiX3VwZGF0ZSIsImdwdVVwZGF0ZSIsInNldFNjZW5lQ29uc3RhbnRzIiwiZm9nIiwiRk9HX05PTkUiLCJGT0dfTElORUFSIiwiZm9nU3RhcnQiLCJmb2dFbmQiLCJmb2dEZW5zaXR5IiwidXBkYXRlTGlnaHRTdGF0cyIsImNvbXBVcGRhdGVkRmxhZ3MiLCJDT01QVVBEQVRFRF9MSUdIVFMiLCJfc3RhdHNVcGRhdGVkIiwic3RhdHMiLCJfc3RhdHMiLCJkeW5hbWljTGlnaHRzIiwiYmFrZWRMaWdodHMiLCJsIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiTUFTS19CQUtFIiwiQ09NUFVQREFURURfSU5TVEFOQ0VTIiwiY3VsbFNoYWRvd21hcHMiLCJjYXN0ZXJzIiwiX2xpZ2h0Q29tcG9zaXRpb25EYXRhIiwic2hhZG93Q2FzdGVyc0xpc3QiLCJjdWxsTG9jYWwiLCJyZW5kZXJBY3Rpb25zIiwiX3JlbmRlckFjdGlvbnMiLCJkaXJlY3Rpb25hbExpZ2h0c0luZGljZXMiLCJsaWdodEluZGV4IiwiY3VsbERpcmVjdGlvbmFsIiwiY3VsbENvbXBvc2l0aW9uIiwibGF5ZXJJbmRleCIsInN1YkxheWVyRW5hYmxlZCIsImNhbWVyYVBhc3MiLCJjYW1lcmFJbmRleCIsImZyYW1lVXBkYXRlIiwiZmlyc3RDYW1lcmFVc2UiLCJvYmplY3RzIiwidmlzaWJsZVRyYW5zcGFyZW50IiwidmlzaWJsZU9wYXF1ZSIsImRvbmUiLCJvblByZUN1bGwiLCJsaXN0Iiwib25Qb3N0Q3VsbCIsInVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzIiwiX3NwbGl0TGlnaHRzIiwidXBkYXRlQ2x1c3RlcnMiLCJzdGFydFRpbWUiLCJfd29ybGRDbHVzdGVycyIsImNsdXN0ZXIiLCJidWlsZEZyYW1lR3JhcGgiLCJmcmFtZUdyYXBoIiwibGF5ZXJDb21wb3NpdGlvbiIsInJlc2V0IiwicmVuZGVyUGFzcyIsIlJlbmRlclBhc3MiLCJjb29raWVzRW5hYmxlZCIsInJlcXVpcmVzQ3ViZW1hcHMiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJhZGRSZW5kZXJQYXNzIiwic2hhZG93c0VuYWJsZWQiLCJzdGFydEluZGV4IiwibmV3U3RhcnQiLCJpc0xheWVyRW5hYmxlZCIsImlzRGVwdGhMYXllciIsIkxBWUVSSURfREVQVEgiLCJpc0dyYWJQYXNzIiwicmVuZGVyU2NlbmVDb2xvck1hcCIsInJlbmRlclNjZW5lRGVwdGhNYXAiLCJoYXNEaXJlY3Rpb25hbFNoYWRvd0xpZ2h0cyIsInJlbmRlclBhc3NEaXJlY3Rpb25hbFNoYWRvd3MiLCJuZXh0SW5kZXgiLCJuZXh0UmVuZGVyQWN0aW9uIiwiaXNOZXh0TGF5ZXJEZXB0aCIsImlzTmV4dExheWVyR3JhYlBhc3MiLCJhZGRNYWluUmVuZGVyUGFzcyIsInRyaWdnZXJQb3N0cHJvY2VzcyIsIm9uUG9zdHByb2Nlc3NpbmciLCJyZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmciLCJlbmRJbmRleCIsInJhbmdlIiwic3RhcnQiLCJlbmQiLCJyZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyIsInN0YXJ0UmVuZGVyQWN0aW9uIiwic3RhcnRMYXllciIsImlzV2ViZ2wxRGVwdGhHcmFiUGFzcyIsIndlYmdsMiIsImlzUmVhbFBhc3MiLCJpbml0IiwiZnVsbFNpemVDbGVhclJlY3QiLCJzZXRDbGVhckNvbG9yIiwic2V0Q2xlYXJEZXB0aCIsInNldENsZWFyU3RlbmNpbCIsImVudGl0eSIsIl91cGRhdGVTa3kiLCJkaXJlY3Rpb25hbExpZ2h0cyIsInJlbmRlclJlbmRlckFjdGlvbiIsImZpcnN0UmVuZGVyQWN0aW9uIiwiZHJhd1RpbWUiLCJvblByZVJlbmRlciIsIm9uUHJlUmVuZGVyT3BhcXVlIiwib25QcmVSZW5kZXJUcmFuc3BhcmVudCIsInNvcnRUaW1lIiwiX3NvcnRWaXNpYmxlIiwiaW1tZWRpYXRlIiwib25QcmVSZW5kZXJMYXllciIsImxpZ2h0Q2x1c3RlcnMiLCJhY3RpdmF0ZSIsImRlYnVnTGF5ZXIiLCJXb3JsZENsdXN0ZXJzRGVidWciLCJfYWN0aXZlQ2FtZXJhIiwiX2ZsaXBGYWNlcyIsImRyYXdzIiwic2hhZGVyUGFzcyIsIm9uRHJhd0NhbGwiLCJsYXN0Q2FtZXJhVXNlIiwib25Qb3N0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
