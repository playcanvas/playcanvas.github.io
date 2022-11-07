/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, BINDGROUP_VIEW, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, CULLFACE_FRONTANDBACK, CULLFACE_FRONT, CULLFACE_BACK, FUNC_ALWAYS, STENCILOP_KEEP, BINDGROUP_MESH, SEMANTIC_ATTR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat, BindTextureFormat } from '../../platform/graphics/bind-group-format.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
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
const _tempSet = new Set();

class ForwardRenderer {

  constructor(graphicsDevice) {
    this.clustersDebugRendered = false;
    this.device = graphicsDevice;
    const device = this.device;

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
        if (!_tempSet.has(mat)) {
          _tempSet.add(mat);

          if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
            if (onlyLitShaders) {
              if (!mat.useLighting || mat.emitter && !mat.emitter.lighting) continue;
            }

            mat.clearVariants();
          }
        }
      }
    }

    _tempSet.clear();
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
    const emptyWorldClusters = comp.getEmptyWorldClusters(this.device);
    const renderActions = comp._renderActions;
    for (let i = 0; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const cluster = renderAction.lightClusters;
      if (cluster && cluster !== emptyWorldClusters) {
        if (!_tempSet.has(cluster)) {
          _tempSet.add(cluster);
          const layer = comp.layerList[renderAction.layerIndex];
          cluster.update(layer.clusteredLightsSet, this.scene.gammaCorrection, this.scene.lighting);
        }
      }
    }

    _tempSet.clear();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuXG5pbXBvcnQge1xuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBDVUxMRkFDRV9CQUNLLCBDVUxMRkFDRV9GUk9OVCwgQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLCBDVUxMRkFDRV9OT05FLFxuICAgIEZVTkNfQUxXQVlTLFxuICAgIFNFTUFOVElDX0FUVFIsXG4gICAgU1RFTkNJTE9QX0tFRVAsXG4gICAgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBTSEFERVJTVEFHRV9WRVJURVgsIFNIQURFUlNUQUdFX0ZSQUdNRU5ULFxuICAgIEJJTkRHUk9VUF9WSUVXLCBCSU5ER1JPVVBfTUVTSCwgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsXG4gICAgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVRcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXIuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBCaW5kR3JvdXBGb3JtYXQsIEJpbmRCdWZmZXJGb3JtYXQsIEJpbmRUZXh0dXJlRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmluZEdyb3VwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJQYXNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXBhc3MuanMnO1xuXG5pbXBvcnQge1xuICAgIENPTVBVUERBVEVEX0lOU1RBTkNFUywgQ09NUFVQREFURURfTElHSFRTLFxuICAgIEZPR19OT05FLCBGT0dfTElORUFSLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIExJR0hUU0hBUEVfUFVOQ1RVQUwsXG4gICAgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQsIE1BU0tfQUZGRUNUX0RZTkFNSUMsIE1BU0tfQkFLRSxcbiAgICBTSEFET1dVUERBVEVfTk9ORSxcbiAgICBTT1JUS0VZX0RFUFRILCBTT1JUS0VZX0ZPUldBUkQsXG4gICAgVklFV19DRU5URVIsIFNIQURPV1VQREFURV9USElTRlJBTUUsIExBWUVSSURfREVQVEgsIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4uL21hdGVyaWFscy9tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuXG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlciB9IGZyb20gJy4vc2hhZG93LXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFN0YXRpY01lc2hlcyB9IGZyb20gJy4vc3RhdGljLW1lc2hlcy5qcyc7XG5pbXBvcnQgeyBDb29raWVSZW5kZXJlciB9IGZyb20gJy4vY29va2llLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IExpZ2h0Q2FtZXJhIH0gZnJvbSAnLi9saWdodC1jYW1lcmEuanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVyc0RlYnVnIH0gZnJvbSAnLi4vbGlnaHRpbmcvd29ybGQtY2x1c3RlcnMtZGVidWcuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vcmVuZGVyLWFjdGlvbi5qcycpLlJlbmRlckFjdGlvbn0gUmVuZGVyQWN0aW9uICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gUmVuZGVyVGFyZ2V0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gQ2FtZXJhQ29tcG9uZW50ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gTGF5ZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBTY2VuZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IE1lc2hJbnN0YW5jZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2NhbWVyYS5qcycpLkNhbWVyYX0gQ2FtZXJhICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZnJhbWUtZ3JhcGguanMnKS5GcmFtZUdyYXBofSBGcmFtZUdyYXBoICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBMYXllckNvbXBvc2l0aW9uICovXG5cbmNvbnN0IHZpZXdJbnZNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld01hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2aWV3TWF0MyA9IG5ldyBNYXQzKCk7XG5jb25zdCB2aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5sZXQgcHJvak1hdDtcblxuY29uc3QgZmxpcFlNYXQgPSBuZXcgTWF0NCgpLnNldFNjYWxlKDEsIC0xLCAxKTtcbmNvbnN0IGZsaXBwZWRWaWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCBmbGlwcGVkU2t5Ym94UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHdvcmxkTWF0WCA9IG5ldyBWZWMzKCk7XG5jb25zdCB3b3JsZE1hdFkgPSBuZXcgVmVjMygpO1xuY29uc3Qgd29ybGRNYXRaID0gbmV3IFZlYzMoKTtcblxuY29uc3Qgd2ViZ2wxRGVwdGhDbGVhckNvbG9yID0gbmV3IENvbG9yKDI1NC4wIC8gMjU1LCAyNTQuMCAvIDI1NSwgMjU0LjAgLyAyNTUsIDI1NC4wIC8gMjU1KTtcbmNvbnN0IHRlbXBTcGhlcmUgPSBuZXcgQm91bmRpbmdTcGhlcmUoKTtcbmNvbnN0IGJvbmVUZXh0dXJlU2l6ZSA9IFswLCAwLCAwLCAwXTtcbmxldCBib25lVGV4dHVyZSwgaW5zdGFuY2luZ0RhdGEsIG1vZGVsTWF0cml4O1xuXG5sZXQga2V5QSwga2V5QjtcblxubGV0IF9za2luVXBkYXRlSW5kZXggPSAwO1xuXG5jb25zdCBfZHJhd0NhbGxMaXN0ID0ge1xuICAgIGRyYXdDYWxsczogW10sXG4gICAgaXNOZXdNYXRlcmlhbDogW10sXG4gICAgbGlnaHRNYXNrQ2hhbmdlZDogW11cbn07XG5cbmNvbnN0IF90ZW1wU2V0ID0gbmV3IFNldCgpO1xuXG4vKipcbiAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyIHJlbmRlcnMge0BsaW5rIFNjZW5lfXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBGb3J3YXJkUmVuZGVyZXIge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBjbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBGb3J3YXJkUmVuZGVyZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7U2NlbmV8bnVsbH0gKi9cbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9kZXB0aE1hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1bGxUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fc29ydFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9za2luVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX21vcnBoVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gMDtcblxuICAgICAgICAvLyB0ZXh0dXJlIGF0bGFzIG1hbmFnaW5nIHNoYWRvdyBtYXAgLyBjb29raWUgdGV4dHVyZSBhdGxhc3NpbmcgZm9yIG9tbmkgYW5kIHNwb3QgbGlnaHRzXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBuZXcgTGlnaHRUZXh0dXJlQXRsYXMoZGV2aWNlKTtcblxuICAgICAgICAvLyBzaGFkb3dzXG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyID0gbmV3IFNoYWRvd1JlbmRlcmVyKHRoaXMsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuXG4gICAgICAgIC8vIGNvb2tpZXNcbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIgPSBuZXcgQ29va2llUmVuZGVyZXIoZGV2aWNlLCB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzY29wZSA9IGRldmljZS5zY29wZTtcbiAgICAgICAgdGhpcy5wcm9qSWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcHJvamVjdGlvbicpO1xuICAgICAgICB0aGlzLnByb2pTa3lib3hJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wcm9qZWN0aW9uU2t5Ym94Jyk7XG4gICAgICAgIHRoaXMudmlld0lkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXcnKTtcbiAgICAgICAgdGhpcy52aWV3SWQzID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXczJyk7XG4gICAgICAgIHRoaXMudmlld0ludklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdJbnZlcnNlJyk7XG4gICAgICAgIHRoaXMudmlld1Byb2pJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3UHJvamVjdGlvbicpO1xuICAgICAgICB0aGlzLmZsaXBZSWQgPSBzY29wZS5yZXNvbHZlKCdwcm9qZWN0aW9uRmxpcFknKTtcbiAgICAgICAgdGhpcy52aWV3UG9zID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQgPSBzY29wZS5yZXNvbHZlKCd2aWV3X3Bvc2l0aW9uJyk7XG4gICAgICAgIHRoaXMubmVhckNsaXBJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9uZWFyJyk7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX2ZhcicpO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc0lkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX3BhcmFtcycpO1xuICAgICAgICB0aGlzLnRibkJhc2lzID0gc2NvcGUucmVzb2x2ZSgndGJuQmFzaXMnKTtcblxuICAgICAgICB0aGlzLmZvZ0NvbG9ySWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfY29sb3InKTtcbiAgICAgICAgdGhpcy5mb2dTdGFydElkID0gc2NvcGUucmVzb2x2ZSgnZm9nX3N0YXJ0Jyk7XG4gICAgICAgIHRoaXMuZm9nRW5kSWQgPSBzY29wZS5yZXNvbHZlKCdmb2dfZW5kJyk7XG4gICAgICAgIHRoaXMuZm9nRGVuc2l0eUlkID0gc2NvcGUucmVzb2x2ZSgnZm9nX2RlbnNpdHknKTtcblxuICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbW9kZWwnKTtcbiAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9ub3JtYWwnKTtcbiAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcG9zZVswXScpO1xuICAgICAgICB0aGlzLmJvbmVUZXh0dXJlSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX3Bvc2VNYXAnKTtcbiAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfcG9zZU1hcFNpemUnKTtcblxuICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0EgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF93ZWlnaHRzX2EnKTtcbiAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNCID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfd2VpZ2h0c19iJyk7XG4gICAgICAgIHRoaXMubW9ycGhQb3NpdGlvblRleCA9IHNjb3BlLnJlc29sdmUoJ21vcnBoUG9zaXRpb25UZXgnKTtcbiAgICAgICAgdGhpcy5tb3JwaE5vcm1hbFRleCA9IHNjb3BlLnJlc29sdmUoJ21vcnBoTm9ybWFsVGV4Jyk7XG4gICAgICAgIHRoaXMubW9ycGhUZXhQYXJhbXMgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF90ZXhfcGFyYW1zJyk7XG5cbiAgICAgICAgdGhpcy5hbHBoYVRlc3RJZCA9IHNjb3BlLnJlc29sdmUoJ2FscGhhX3JlZicpO1xuICAgICAgICB0aGlzLm9wYWNpdHlNYXBJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuXG4gICAgICAgIHRoaXMuYW1iaWVudElkID0gc2NvcGUucmVzb2x2ZSgnbGlnaHRfZ2xvYmFsQW1iaWVudCcpO1xuICAgICAgICB0aGlzLmV4cG9zdXJlSWQgPSBzY29wZS5yZXNvbHZlKCdleHBvc3VyZScpO1xuICAgICAgICB0aGlzLnNreWJveEludGVuc2l0eUlkID0gc2NvcGUucmVzb2x2ZSgnc2t5Ym94SW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMuY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdjdWJlTWFwUm90YXRpb25NYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodERpciA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0RGlySWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eSA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UmFkaXVzSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFBvcyA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoID0gW107XG4gICAgICAgIHRoaXMubGlnaHRXaWR0aElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRJbkFuZ2xlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUlkID0gW107XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVJbnRJZCA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llTWF0cml4SWQgPSBbXTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkID0gW107XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4UGFsZXR0ZUlkID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZUNvdW50SWQgPSBbXTtcblxuICAgICAgICB0aGlzLnNjcmVlblNpemVJZCA9IHNjb3BlLnJlc29sdmUoJ3VTY3JlZW5TaXplJyk7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemUgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIHRoaXMudHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9ySWQgPSBzY29wZS5yZXNvbHZlKCd0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3InKTtcblxuICAgICAgICB0aGlzLmZvZ0NvbG9yID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5hbWJpZW50Q29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgIC8vIFN0YXRpYyBwcm9wZXJ0aWVzIHVzZWQgYnkgdGhlIFByb2ZpbGVyIGluIHRoZSBFZGl0b3IncyBMYXVuY2ggUGFnZVxuICAgIHN0YXRpYyBza2lwUmVuZGVyQ2FtZXJhID0gbnVsbDtcblxuICAgIHN0YXRpYyBfc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgc3RhdGljIHNraXBSZW5kZXJBZnRlciA9IDA7XG4gICAgLy8gI2VuZGlmXG5cbiAgICBzb3J0Q29tcGFyZShkcmF3Q2FsbEEsIGRyYXdDYWxsQikge1xuICAgICAgICBpZiAoZHJhd0NhbGxBLmxheWVyID09PSBkcmF3Q2FsbEIubGF5ZXIpIHtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbEEuZHJhd09yZGVyICYmIGRyYXdDYWxsQi5kcmF3T3JkZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRyYXdDYWxsQS56ZGlzdCAmJiBkcmF3Q2FsbEIuemRpc3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0OyAvLyBiYWNrIHRvIGZyb250XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRyYXdDYWxsQS56ZGlzdDIgJiYgZHJhd0NhbGxCLnpkaXN0Mikge1xuICAgICAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEEuemRpc3QyIC0gZHJhd0NhbGxCLnpkaXN0MjsgLy8gZnJvbnQgdG8gYmFja1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gLSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cblxuICAgIHNvcnRDb21wYXJlTWVzaChkcmF3Q2FsbEEsIGRyYXdDYWxsQikge1xuICAgICAgICBpZiAoZHJhd0NhbGxBLmxheWVyID09PSBkcmF3Q2FsbEIubGF5ZXIpIHtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbEEuZHJhd09yZGVyICYmIGRyYXdDYWxsQi5kcmF3T3JkZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRyYXdDYWxsQS56ZGlzdCAmJiBkcmF3Q2FsbEIuemRpc3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0OyAvLyBiYWNrIHRvIGZyb250XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICAgICAga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG5cbiAgICAgICAgaWYgKGtleUEgPT09IGtleUIgJiYgZHJhd0NhbGxBLm1lc2ggJiYgZHJhd0NhbGxCLm1lc2gpIHtcbiAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEIubWVzaC5pZCAtIGRyYXdDYWxsQS5tZXNoLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGtleUIgLSBrZXlBO1xuICAgIH1cblxuICAgIGRlcHRoU29ydENvbXBhcmUoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfREVQVEhdO1xuICAgICAgICBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9ERVBUSF07XG5cbiAgICAgICAgaWYgKGtleUEgPT09IGtleUIgJiYgZHJhd0NhbGxBLm1lc2ggJiYgZHJhd0NhbGxCLm1lc2gpIHtcbiAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEIubWVzaC5pZCAtIGRyYXdDYWxsQS5tZXNoLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGtleUIgLSBrZXlBO1xuICAgIH1cblxuICAgIHVwZGF0ZUNhbWVyYUZydXN0dW0oY2FtZXJhKSB7XG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGZydXN0dW0gYmFzZWQgb24gWFIgdmlld1xuICAgICAgICAgICAgY29uc3QgdmlldyA9IGNhbWVyYS54ci52aWV3c1swXTtcbiAgICAgICAgICAgIHZpZXdQcm9qTWF0Lm11bDIodmlldy5wcm9qTWF0LCB2aWV3LnZpZXdPZmZNYXQpO1xuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvak1hdCA9IGNhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24pIHtcbiAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKHByb2pNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKHZpZXdJbnZNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBvcyA9IGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3Qgcm90ID0gY2FtZXJhLl9ub2RlLmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICB2aWV3TWF0LmNvcHkodmlld0ludk1hdCkuaW52ZXJ0KCk7XG5cbiAgICAgICAgdmlld1Byb2pNYXQubXVsMihwcm9qTWF0LCB2aWV3TWF0KTtcbiAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIHNvbWUgdGV4dHVyZXNcbiAgICAgICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG5ldyBCaW5kR3JvdXBGb3JtYXQodGhpcy5kZXZpY2UsIFtcbiAgICAgICAgICAgICAgICBuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpXG4gICAgICAgICAgICBdLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdsaWdodHNUZXh0dXJlRmxvYXQnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldENhbWVyYVVuaWZvcm1zKGNhbWVyYSwgdGFyZ2V0LCByZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICBsZXQgdHJhbnNmb3JtO1xuXG4gICAgICAgIGxldCB2aWV3Q291bnQgPSAxO1xuICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci5zZXNzaW9uKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBjYW1lcmEuX25vZGUucGFyZW50O1xuICAgICAgICAgICAgaWYgKHBhcmVudCkgdHJhbnNmb3JtID0gcGFyZW50LmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHZpZXdzID0gY2FtZXJhLnhyLnZpZXdzO1xuICAgICAgICAgICAgdmlld0NvdW50ID0gdmlld3MubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCB2aWV3Q291bnQ7IHYrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZpZXcgPSB2aWV3c1t2XTtcblxuICAgICAgICAgICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3SW52T2ZmTWF0Lm11bDIodHJhbnNmb3JtLCB2aWV3LnZpZXdJbnZNYXQpO1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdPZmZNYXQuY29weSh2aWV3LnZpZXdJbnZPZmZNYXQpLmludmVydCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld0ludk9mZk1hdC5jb3B5KHZpZXcudmlld0ludk1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld09mZk1hdC5jb3B5KHZpZXcudmlld01hdCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmlldy52aWV3TWF0My5zZXRGcm9tTWF0NCh2aWV3LnZpZXdPZmZNYXQpO1xuICAgICAgICAgICAgICAgIHZpZXcucHJvalZpZXdPZmZNYXQubXVsMih2aWV3LnByb2pNYXQsIHZpZXcudmlld09mZk1hdCk7XG5cbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzBdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTJdO1xuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMV0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxM107XG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblsyXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzE0XTtcblxuICAgICAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXcucHJvalZpZXdPZmZNYXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gUHJvamVjdGlvbiBNYXRyaXhcbiAgICAgICAgICAgIHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKHByb2pNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucHJvaklkLnNldFZhbHVlKHByb2pNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFNreWJveCBQcm9qZWN0aW9uIE1hdHJpeFxuICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUoY2FtZXJhLmdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKS5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld0ludmVyc2UgTWF0cml4XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkLnNldFZhbHVlKHZpZXdNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgM3gzXG4gICAgICAgICAgICB2aWV3TWF0My5zZXRGcm9tTWF0NCh2aWV3TWF0KTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkMy5zZXRWYWx1ZSh2aWV3TWF0My5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld1Byb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuXG4gICAgICAgICAgICBpZiAodGFyZ2V0ICYmIHRhcmdldC5mbGlwWSkge1xuICAgICAgICAgICAgICAgIGZsaXBwZWRWaWV3UHJvak1hdC5tdWwyKGZsaXBZTWF0LCB2aWV3UHJvak1hdCk7XG4gICAgICAgICAgICAgICAgZmxpcHBlZFNreWJveFByb2pNYXQubXVsMihmbGlwWU1hdCwgY2FtZXJhLmdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUoZmxpcHBlZFZpZXdQcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgIHRoaXMucHJvalNreWJveElkLnNldFZhbHVlKGZsaXBwZWRTa3lib3hQcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlld1Byb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUoY2FtZXJhLmdldFByb2plY3Rpb25NYXRyaXhTa3lib3goKS5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5mbGlwWUlkLnNldFZhbHVlKHRhcmdldD8uZmxpcFkgPyAtMSA6IDEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IFBvc2l0aW9uICh3b3JsZCBzcGFjZSlcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hWaWV3UG9zKGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50Ym5CYXNpcy5zZXRWYWx1ZSh0YXJnZXQgJiYgdGFyZ2V0LmZsaXBZID8gLTEgOiAxKTtcblxuICAgICAgICAvLyBOZWFyIGFuZCBmYXIgY2xpcCB2YWx1ZXNcbiAgICAgICAgdGhpcy5uZWFyQ2xpcElkLnNldFZhbHVlKGNhbWVyYS5fbmVhckNsaXApO1xuICAgICAgICB0aGlzLmZhckNsaXBJZC5zZXRWYWx1ZShjYW1lcmEuX2ZhckNsaXApO1xuXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIHRoaXMuZXhwb3N1cmVJZC5zZXRWYWx1ZShjYW1lcmEuZ2V0RXhwb3N1cmUoKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4cG9zdXJlSWQuc2V0VmFsdWUodGhpcy5zY2VuZS5leHBvc3VyZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBuID0gY2FtZXJhLl9uZWFyQ2xpcDtcbiAgICAgICAgY29uc3QgZiA9IGNhbWVyYS5fZmFyQ2xpcDtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMF0gPSAxIC8gZjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMV0gPSBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1syXSA9IG47XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzNdID0gY2FtZXJhLnByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID8gMSA6IDA7XG5cbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNJZC5zZXRWYWx1ZSh0aGlzLmNhbWVyYVBhcmFtcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMocmVuZGVyQWN0aW9uLCB2aWV3Q291bnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gbWFrZSBzdXJlIGNvbG9yV3JpdGUgaXMgc2V0IHRvIHRydWUgdG8gYWxsIGNoYW5uZWxzLCBpZiB5b3Ugd2FudCB0byBmdWxseSBjbGVhciB0aGUgdGFyZ2V0XG4gICAgLy8gVE9ETzogdGhpcyBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgZnJvbSBvdXRzaWRlIG9mIGZvcndhcmQgcmVuZGVyZXIsIGFuZCBzaG91bGQgYmUgZGVwcmVjYXRlZFxuICAgIC8vIHdoZW4gdGhlIGZ1bmN0aW9uYWxpdHkgbW92ZXMgdG8gdGhlIHJlbmRlciBwYXNzZXMuXG4gICAgc2V0Q2FtZXJhKGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgcmVuZGVyQWN0aW9uID0gbnVsbCkge1xuXG4gICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQsIHJlbmRlckFjdGlvbik7XG4gICAgICAgIHRoaXMuY2xlYXJWaWV3KGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgZmFsc2UpO1xuICAgIH1cblxuICAgIHNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHJlbmRlckFjdGlvbiwgdmlld0NvdW50KSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHJlbmRlckFjdGlvbiwgXCJSZW5kZXJBY3Rpb24gY2Fubm90IGJlIG51bGxcIik7XG4gICAgICAgIGlmIChyZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodmlld0NvdW50ID09PSAxLCBcIlRoaXMgY29kZSBkb2VzIG5vdCBoYW5kbGUgdGhlIHZpZXdDb3VudCB5ZXRcIik7XG5cbiAgICAgICAgICAgIHdoaWxlIChyZW5kZXJBY3Rpb24udmlld0JpbmRHcm91cHMubGVuZ3RoIDwgdmlld0NvdW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdWIgPSBuZXcgVW5pZm9ybUJ1ZmZlcihkZXZpY2UsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJnID0gbmV3IEJpbmRHcm91cChkZXZpY2UsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCwgdWIpO1xuICAgICAgICAgICAgICAgIHJlbmRlckFjdGlvbi52aWV3QmluZEdyb3Vwcy5wdXNoKGJnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIHZpZXcgYmluZCBncm91cCAvIHVuaWZvcm1zXG4gICAgICAgICAgICBjb25zdCB2aWV3QmluZEdyb3VwID0gcmVuZGVyQWN0aW9uLnZpZXdCaW5kR3JvdXBzWzBdO1xuICAgICAgICAgICAgdmlld0JpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgICAgIHZpZXdCaW5kR3JvdXAudXBkYXRlKCk7XG5cbiAgICAgICAgICAgIC8vIFRPRE87IHRoaXMgbmVlZHMgdG8gYmUgbW92ZWQgdG8gZHJhd0luc3RhbmNlIGZ1bmN0aW9ucyB0byBoYW5kbGUgWFJcbiAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX1ZJRVcsIHZpZXdCaW5kR3JvdXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHVwIHRoZSB2aWV3cG9ydCBhbmQgdGhlIHNjaXNzb3IgZm9yIGNhbWVyYSByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NhbWVyYX0gY2FtZXJhIC0gVGhlIGNhbWVyYSBjb250YWluaW5nIHRoZSB2aWV3cG9ydCBpbmZvcm1hdGlvbi5cbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW3JlbmRlclRhcmdldF0gLSBUaGUgcmVuZGVyIHRhcmdldC4gTlVMTCBmb3IgdGhlIGRlZmF1bHQgb25lLlxuICAgICAqL1xuICAgIHNldHVwVmlld3BvcnQoY2FtZXJhLCByZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ1NFVFVQLVZJRVdQT1JUJyk7XG5cbiAgICAgICAgY29uc3QgcGl4ZWxXaWR0aCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgcGl4ZWxIZWlnaHQgPSByZW5kZXJUYXJnZXQgPyByZW5kZXJUYXJnZXQuaGVpZ2h0IDogZGV2aWNlLmhlaWdodDtcblxuICAgICAgICBjb25zdCByZWN0ID0gY2FtZXJhLnJlY3Q7XG4gICAgICAgIGxldCB4ID0gTWF0aC5mbG9vcihyZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgbGV0IHkgPSBNYXRoLmZsb29yKHJlY3QueSAqIHBpeGVsSGVpZ2h0KTtcbiAgICAgICAgbGV0IHcgPSBNYXRoLmZsb29yKHJlY3QueiAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgaCA9IE1hdGguZmxvb3IocmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQoeCwgeSwgdywgaCk7XG5cbiAgICAgICAgLy8gYnkgZGVmYXVsdCBjbGVhciBpcyB1c2luZyB2aWV3cG9ydCByZWN0YW5nbGUuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldCwgdXNpbmcgY3VycmVudGx5IHNldCB1cCB2aWV3cG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyQWN0aW9ufSByZW5kZXJBY3Rpb24gLSBSZW5kZXIgYWN0aW9uIGNvbnRhaW5pbmcgdGhlIGNsZWFyIGZsYWdzLlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhfSBjYW1lcmEgLSBDYW1lcmEgY29udGFpbmluZyB0aGUgY2xlYXIgdmFsdWVzLlxuICAgICAqL1xuICAgIGNsZWFyKHJlbmRlckFjdGlvbiwgY2FtZXJhKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXUE9SVCcpO1xuXG4gICAgICAgIGRldmljZS5jbGVhcih7XG4gICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICBzdGVuY2lsOiBjYW1lcmEuX2NsZWFyU3RlbmNpbCxcbiAgICAgICAgICAgIGZsYWdzOiAocmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IgPyBDTEVBUkZMQUdfQ09MT1IgOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgKHJlbmRlckFjdGlvbi5jbGVhckRlcHRoID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgIChyZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsID8gQ0xFQVJGTEFHX1NURU5DSUwgOiAwKVxuICAgICAgICB9KTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IHRoaXMgaXMgY3VycmVudGx5IHVzZWQgYnkgdGhlIGxpZ2h0bWFwcGVyIGFuZCB0aGUgRWRpdG9yLFxuICAgIC8vIGFuZCB3aWxsIGJlIHJlbW92ZWQgd2hlbiB0aG9zZSBjYWxsIGFyZSByZW1vdmVkLlxuICAgIGNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZvcmNlV3JpdGUpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ0NMRUFSLVZJRVcnKTtcblxuICAgICAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHRhcmdldCk7XG4gICAgICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuXG4gICAgICAgIGlmIChmb3JjZVdyaXRlKSB7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXR1cFZpZXdwb3J0KGNhbWVyYSwgdGFyZ2V0KTtcblxuICAgICAgICBpZiAoY2xlYXIpIHtcbiAgICAgICAgICAgIC8vIHVzZSBjYW1lcmEgY2xlYXIgb3B0aW9ucyBpZiBhbnlcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBjYW1lcmEuX2NsZWFyT3B0aW9ucztcblxuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKG9wdGlvbnMgPyBvcHRpb25zIDoge1xuICAgICAgICAgICAgICAgIGNvbG9yOiBbY2FtZXJhLl9jbGVhckNvbG9yLnIsIGNhbWVyYS5fY2xlYXJDb2xvci5nLCBjYW1lcmEuX2NsZWFyQ29sb3IuYiwgY2FtZXJhLl9jbGVhckNvbG9yLmFdLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICAgICAgZmxhZ3M6IChjYW1lcmEuX2NsZWFyQ29sb3JCdWZmZXIgPyBDTEVBUkZMQUdfQ09MT1IgOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgIChjYW1lcmEuX2NsZWFyRGVwdGhCdWZmZXIgPyBDTEVBUkZMQUdfREVQVEggOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgIChjYW1lcmEuX2NsZWFyU3RlbmNpbEJ1ZmZlciA/IENMRUFSRkxBR19TVEVOQ0lMIDogMCksXG4gICAgICAgICAgICAgICAgc3RlbmNpbDogY2FtZXJhLl9jbGVhclN0ZW5jaWxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKi9cbiAgICBkaXNwYXRjaEdsb2JhbExpZ2h0cyhzY2VuZSkge1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclswXSA9IHNjZW5lLmFtYmllbnRMaWdodC5yO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclsxXSA9IHNjZW5lLmFtYmllbnRMaWdodC5nO1xuICAgICAgICB0aGlzLmFtYmllbnRDb2xvclsyXSA9IHNjZW5lLmFtYmllbnRMaWdodC5iO1xuICAgICAgICBpZiAoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuYW1iaWVudENvbG9yW2ldID0gTWF0aC5wb3codGhpcy5hbWJpZW50Q29sb3JbaV0sIDIuMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNjZW5lLnBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbWJpZW50Q29sb3JbaV0gKj0gc2NlbmUuYW1iaWVudEx1bWluYW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFtYmllbnRJZC5zZXRWYWx1ZSh0aGlzLmFtYmllbnRDb2xvcik7XG5cbiAgICAgICAgdGhpcy5za3lib3hJbnRlbnNpdHlJZC5zZXRWYWx1ZShzY2VuZS5waHlzaWNhbFVuaXRzID8gc2NlbmUuc2t5Ym94THVtaW5hbmNlIDogc2NlbmUuc2t5Ym94SW50ZW5zaXR5KTtcbiAgICAgICAgdGhpcy5jdWJlTWFwUm90YXRpb25NYXRyaXhJZC5zZXRWYWx1ZShzY2VuZS5fc2t5Ym94Um90YXRpb25NYXQzLmRhdGEpO1xuICAgIH1cblxuICAgIF9yZXNvbHZlTGlnaHQoc2NvcGUsIGkpIHtcbiAgICAgICAgY29uc3QgbGlnaHQgPSAnbGlnaHQnICsgaTtcbiAgICAgICAgdGhpcy5saWdodENvbG9ySWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb2xvcicpO1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodERpcklkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfZGlyZWN0aW9uJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX3NoYWRvd01hcCcpO1xuICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXRyaXgnKTtcbiAgICAgICAgdGhpcy5saWdodFNoYWRvd1BhcmFtc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93UGFyYW1zJyk7XG4gICAgICAgIHRoaXMubGlnaHRTaGFkb3dJbnRlbnNpdHlbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dJbnRlbnNpdHknKTtcbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfcmFkaXVzJyk7XG4gICAgICAgIHRoaXMubGlnaHRQb3NbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19wb3NpdGlvbicpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbaV0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2hhbGZXaWR0aCcpO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2ldID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaGFsZkhlaWdodCcpO1xuICAgICAgICB0aGlzLmxpZ2h0SW5BbmdsZUlkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfaW5uZXJDb25lQW5nbGUnKTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19vdXRlckNvbmVBbmdsZScpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWUnKTtcbiAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfY29va2llSW50ZW5zaXR5Jyk7XG4gICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtpXSA9IHNjb3BlLnJlc29sdmUobGlnaHQgKyAnX2Nvb2tpZU1hdHJpeCcpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29va2llT2Zmc2V0SWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19jb29raWVPZmZzZXQnKTtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWRbaV0gPSBzY29wZS5yZXNvbHZlKGxpZ2h0ICsgJ19zaGFkb3dNYXRyaXhQYWxldHRlWzBdJyk7XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93Q2FzY2FkZURpc3RhbmNlc1swXScpO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc2NhZGVDb3VudElkW2ldID0gc2NvcGUucmVzb2x2ZShsaWdodCArICdfc2hhZG93Q2FzY2FkZUNvdW50Jyk7XG4gICAgfVxuXG4gICAgc2V0TFRDRGlyZWN0aW9uYWxMaWdodCh3dG0sIGNudCwgZGlyLCBjYW1wb3MsIGZhcikge1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBjYW1wb3MueCAtIGRpci54ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBjYW1wb3MueSAtIGRpci55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBjYW1wb3MueiAtIGRpci56ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGNvbnN0IGhXaWR0aCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoLTAuNSwgMCwgMCkpO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVswXSA9IGhXaWR0aC54ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVsxXSA9IGhXaWR0aC55ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhbY250XVsyXSA9IGhXaWR0aC56ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0V2lkdGhJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRXaWR0aFtjbnRdKTtcblxuICAgICAgICBjb25zdCBoSGVpZ2h0ID0gd3RtLnRyYW5zZm9ybVZlY3RvcihuZXcgVmVjMygwLCAwLCAwLjUpKTtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzBdID0gaEhlaWdodC54ICogZmFyO1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMV0gPSBoSGVpZ2h0LnkgKiBmYXI7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVsyXSA9IGhIZWlnaHQueiAqIGZhcjtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodElkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodEhlaWdodFtjbnRdKTtcbiAgICB9XG5cbiAgICBkaXNwYXRjaERpcmVjdExpZ2h0cyhkaXJzLCBzY2VuZSwgbWFzaywgY2FtZXJhKSB7XG4gICAgICAgIGxldCBjbnQgPSAwO1xuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5kZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkaXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIShkaXJzW2ldLm1hc2sgJiBtYXNrKSkgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGlvbmFsID0gZGlyc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHd0bSA9IGRpcmVjdGlvbmFsLl9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVMaWdodChzY29wZSwgY250KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodENvbG9ySWRbY250XS5zZXRWYWx1ZShzY2VuZS5nYW1tYUNvcnJlY3Rpb24gPyBkaXJlY3Rpb25hbC5fbGluZWFyRmluYWxDb2xvciA6IGRpcmVjdGlvbmFsLl9maW5hbENvbG9yKTtcblxuICAgICAgICAgICAgLy8gRGlyZWN0aW9uYWwgbGlnaHRzIHNoaW5lIGRvd24gdGhlIG5lZ2F0aXZlIFkgYXhpc1xuICAgICAgICAgICAgd3RtLmdldFkoZGlyZWN0aW9uYWwuX2RpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgICAgIGRpcmVjdGlvbmFsLl9kaXJlY3Rpb24ubm9ybWFsaXplKCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMF0gPSBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLng7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMV0gPSBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLnk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMl0gPSBkaXJlY3Rpb25hbC5fZGlyZWN0aW9uLno7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0RGlySWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0RGlyW2NudF0pO1xuXG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uYWwuc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGUgLSBOQiBkaXJlY3Rpb25hbCBhcmVhIGxpZ2h0IHNwZWN1bGFyIGlzIGFwcHJveGltYXRlZCBieSBwdXR0aW5nIHRoZSBhcmVhIGxpZ2h0IGF0IHRoZSBmYXIgY2xpcFxuICAgICAgICAgICAgICAgIHRoaXMuc2V0TFRDRGlyZWN0aW9uYWxMaWdodCh3dG0sIGNudCwgZGlyZWN0aW9uYWwuX2RpcmVjdGlvbiwgY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCksIGNhbWVyYS5mYXJDbGlwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbmFsLmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBkaXJlY3Rpb25hbC5nZXRSZW5kZXJEYXRhKGNhbWVyYSwgMCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmlhc2VzID0gZGlyZWN0aW9uYWwuX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWFwSWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93QnVmZmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShsaWdodFJlbmRlckRhdGEuc2hhZG93TWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXhQYWxldHRlSWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5fc2hhZG93TWF0cml4UGFsZXR0ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlRGlzdGFuY2VzSWRbY250XS5zZXRWYWx1ZShkaXJlY3Rpb25hbC5fc2hhZG93Q2FzY2FkZURpc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dDYXNjYWRlQ291bnRJZFtjbnRdLnNldFZhbHVlKGRpcmVjdGlvbmFsLm51bUNhc2NhZGVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2NudF0uc2V0VmFsdWUoZGlyZWN0aW9uYWwuc2hhZG93SW50ZW5zaXR5KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IGRpcmVjdGlvbmFsLl9zaGFkb3dSZW5kZXJQYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDM7XG4gICAgICAgICAgICAgICAgcGFyYW1zWzBdID0gZGlyZWN0aW9uYWwuX3NoYWRvd1Jlc29sdXRpb247ICAvLyBOb3RlOiB0aGlzIG5lZWRzIHRvIGNoYW5nZSBmb3Igbm9uLXNxdWFyZSBzaGFkb3cgbWFwcyAoMiBjYXNjYWRlcykuIEN1cnJlbnRseSBzcXVhcmUgaXMgdXNlZFxuICAgICAgICAgICAgICAgIHBhcmFtc1sxXSA9IGJpYXNlcy5ub3JtYWxCaWFzO1xuICAgICAgICAgICAgICAgIHBhcmFtc1syXSA9IGJpYXNlcy5iaWFzO1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtjbnRdLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY250O1xuICAgIH1cblxuICAgIHNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCkge1xuICAgICAgICBjb25zdCBoV2lkdGggPSB3dG0udHJhbnNmb3JtVmVjdG9yKG5ldyBWZWMzKC0wLjUsIDAsIDApKTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMF0gPSBoV2lkdGgueDtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMV0gPSBoV2lkdGgueTtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoW2NudF1bMl0gPSBoV2lkdGguejtcbiAgICAgICAgdGhpcy5saWdodFdpZHRoSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0V2lkdGhbY250XSk7XG5cbiAgICAgICAgY29uc3QgaEhlaWdodCA9IHd0bS50cmFuc2Zvcm1WZWN0b3IobmV3IFZlYzMoMCwgMCwgMC41KSk7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRbY250XVswXSA9IGhIZWlnaHQueDtcbiAgICAgICAgdGhpcy5saWdodEhlaWdodFtjbnRdWzFdID0gaEhlaWdodC55O1xuICAgICAgICB0aGlzLmxpZ2h0SGVpZ2h0W2NudF1bMl0gPSBoSGVpZ2h0Lno7XG4gICAgICAgIHRoaXMubGlnaHRIZWlnaHRJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHRIZWlnaHRbY250XSk7XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hPbW5pTGlnaHQoc2NlbmUsIHNjb3BlLCBvbW5pLCBjbnQpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gb21uaS5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodFJhZGl1c0lkW2NudF0uc2V0VmFsdWUob21uaS5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIHRoaXMubGlnaHRDb2xvcklkW2NudF0uc2V0VmFsdWUoc2NlbmUuZ2FtbWFDb3JyZWN0aW9uID8gb21uaS5fbGluZWFyRmluYWxDb2xvciA6IG9tbmkuX2ZpbmFsQ29sb3IpO1xuICAgICAgICB3dG0uZ2V0VHJhbnNsYXRpb24ob21uaS5fcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMF0gPSBvbW5pLl9wb3NpdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMV0gPSBvbW5pLl9wb3NpdGlvbi55O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zW2NudF1bMl0gPSBvbW5pLl9wb3NpdGlvbi56O1xuICAgICAgICB0aGlzLmxpZ2h0UG9zSWRbY250XS5zZXRWYWx1ZSh0aGlzLmxpZ2h0UG9zW2NudF0pO1xuXG4gICAgICAgIGlmIChvbW5pLnNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAvLyBub24tcHVuY3R1YWwgc2hhcGVcbiAgICAgICAgICAgIHRoaXMuc2V0TFRDUG9zaXRpb25hbExpZ2h0KHd0bSwgY250KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvbW5pLmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBtYXBcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IG9tbmkuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXBJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgICAgICBjb25zdCBiaWFzZXMgPSBvbW5pLl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gb21uaS5fc2hhZG93UmVuZGVyUGFyYW1zO1xuICAgICAgICAgICAgcGFyYW1zLmxlbmd0aCA9IDQ7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBvbW5pLl9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICAgICAgcGFyYW1zWzFdID0gYmlhc2VzLm5vcm1hbEJpYXM7XG4gICAgICAgICAgICBwYXJhbXNbMl0gPSBiaWFzZXMuYmlhcztcbiAgICAgICAgICAgIHBhcmFtc1szXSA9IDEuMCAvIG9tbmkuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93UGFyYW1zSWRbY250XS5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd0ludGVuc2l0eVtjbnRdLnNldFZhbHVlKG9tbmkuc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob21uaS5fY29va2llKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSWRbY250XS5zZXRWYWx1ZShvbW5pLl9jb29raWUpO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hdHJpeElkW2NudF0uc2V0VmFsdWUod3RtLmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZUludElkW2NudF0uc2V0VmFsdWUob21uaS5jb29raWVJbnRlbnNpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpIHtcbiAgICAgICAgY29uc3Qgd3RtID0gc3BvdC5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgIGlmICghdGhpcy5saWdodENvbG9ySWRbY250XSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZUxpZ2h0KHNjb3BlLCBjbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodEluQW5nbGVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2lubmVyQ29uZUFuZ2xlQ29zKTtcbiAgICAgICAgdGhpcy5saWdodE91dEFuZ2xlSWRbY250XS5zZXRWYWx1ZShzcG90Ll9vdXRlckNvbmVBbmdsZUNvcyk7XG4gICAgICAgIHRoaXMubGlnaHRSYWRpdXNJZFtjbnRdLnNldFZhbHVlKHNwb3QuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB0aGlzLmxpZ2h0Q29sb3JJZFtjbnRdLnNldFZhbHVlKHNjZW5lLmdhbW1hQ29ycmVjdGlvbiA/IHNwb3QuX2xpbmVhckZpbmFsQ29sb3IgOiBzcG90Ll9maW5hbENvbG9yKTtcbiAgICAgICAgd3RtLmdldFRyYW5zbGF0aW9uKHNwb3QuX3Bvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzBdID0gc3BvdC5fcG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzFdID0gc3BvdC5fcG9zaXRpb24ueTtcbiAgICAgICAgdGhpcy5saWdodFBvc1tjbnRdWzJdID0gc3BvdC5fcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy5saWdodFBvc0lkW2NudF0uc2V0VmFsdWUodGhpcy5saWdodFBvc1tjbnRdKTtcblxuICAgICAgICBpZiAoc3BvdC5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgLy8gbm9uLXB1bmN0dWFsIHNoYXBlXG4gICAgICAgICAgICB0aGlzLnNldExUQ1Bvc2l0aW9uYWxMaWdodCh3dG0sIGNudCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTcG90cyBzaGluZSBkb3duIHRoZSBuZWdhdGl2ZSBZIGF4aXNcbiAgICAgICAgd3RtLmdldFkoc3BvdC5fZGlyZWN0aW9uKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICBzcG90Ll9kaXJlY3Rpb24ubm9ybWFsaXplKCk7XG4gICAgICAgIHRoaXMubGlnaHREaXJbY250XVswXSA9IHNwb3QuX2RpcmVjdGlvbi54O1xuICAgICAgICB0aGlzLmxpZ2h0RGlyW2NudF1bMV0gPSBzcG90Ll9kaXJlY3Rpb24ueTtcbiAgICAgICAgdGhpcy5saWdodERpcltjbnRdWzJdID0gc3BvdC5fZGlyZWN0aW9uLno7XG4gICAgICAgIHRoaXMubGlnaHREaXJJZFtjbnRdLnNldFZhbHVlKHRoaXMubGlnaHREaXJbY250XSk7XG5cbiAgICAgICAgaWYgKHNwb3QuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgLy8gc2hhZG93IG1hcFxuICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gc3BvdC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICAgICAgdGhpcy5saWdodFNoYWRvd01hcElkW2NudF0uc2V0VmFsdWUobGlnaHRSZW5kZXJEYXRhLnNoYWRvd0J1ZmZlcik7XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dNYXRyaXhJZFtjbnRdLnNldFZhbHVlKGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGJpYXNlcyA9IHNwb3QuX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSk7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBzcG90Ll9zaGFkb3dSZW5kZXJQYXJhbXM7XG4gICAgICAgICAgICBwYXJhbXMubGVuZ3RoID0gNDtcbiAgICAgICAgICAgIHBhcmFtc1swXSA9IHNwb3QuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgICAgICBwYXJhbXNbMV0gPSBiaWFzZXMubm9ybWFsQmlhcztcbiAgICAgICAgICAgIHBhcmFtc1syXSA9IGJpYXNlcy5iaWFzO1xuICAgICAgICAgICAgcGFyYW1zWzNdID0gMS4wIC8gc3BvdC5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRTaGFkb3dQYXJhbXNJZFtjbnRdLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93SW50ZW5zaXR5W2NudF0uc2V0VmFsdWUoc3BvdC5zaGFkb3dJbnRlbnNpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNwb3QuX2Nvb2tpZSkge1xuXG4gICAgICAgICAgICAvLyBpZiBzaGFkb3cgaXMgbm90IHJlbmRlcmVkLCB3ZSBuZWVkIHRvIGV2YWx1YXRlIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAoIXNwb3QuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb29raWVNYXRyaXggPSBMaWdodENhbWVyYS5ldmFsU3BvdENvb2tpZU1hdHJpeChzcG90KTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0U2hhZG93TWF0cml4SWRbY250XS5zZXRWYWx1ZShjb29raWVNYXRyaXguZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0Q29va2llSW50SWRbY250XS5zZXRWYWx1ZShzcG90LmNvb2tpZUludGVuc2l0eSk7XG4gICAgICAgICAgICBpZiAoc3BvdC5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVswXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS54O1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm1bMV0gPSBzcG90Ll9jb29raWVUcmFuc2Zvcm0ueTtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtWzJdID0gc3BvdC5fY29va2llVHJhbnNmb3JtLno7XG4gICAgICAgICAgICAgICAgc3BvdC5fY29va2llVHJhbnNmb3JtVW5pZm9ybVszXSA9IHNwb3QuX2Nvb2tpZVRyYW5zZm9ybS53O1xuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRDb29raWVNYXRyaXhJZFtjbnRdLnNldFZhbHVlKHNwb3QuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHNwb3QuX2Nvb2tpZU9mZnNldFVuaWZvcm1bMF0gPSBzcG90Ll9jb29raWVPZmZzZXQueDtcbiAgICAgICAgICAgICAgICBzcG90Ll9jb29raWVPZmZzZXRVbmlmb3JtWzFdID0gc3BvdC5fY29va2llT2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5saWdodENvb2tpZU9mZnNldElkW2NudF0uc2V0VmFsdWUoc3BvdC5fY29va2llT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkaXNwYXRjaExvY2FsTGlnaHRzKHNvcnRlZExpZ2h0cywgc2NlbmUsIG1hc2ssIHVzZWREaXJMaWdodHMsIHN0YXRpY0xpZ2h0TGlzdCkge1xuXG4gICAgICAgIGxldCBjbnQgPSB1c2VkRGlyTGlnaHRzO1xuICAgICAgICBjb25zdCBzY29wZSA9IHRoaXMuZGV2aWNlLnNjb3BlO1xuXG4gICAgICAgIGNvbnN0IG9tbmlzID0gc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9PTU5JXTtcbiAgICAgICAgY29uc3QgbnVtT21uaXMgPSBvbW5pcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtT21uaXM7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgb21uaSA9IG9tbmlzW2ldO1xuICAgICAgICAgICAgaWYgKCEob21uaS5tYXNrICYgbWFzaykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKG9tbmkuaXNTdGF0aWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCk7XG4gICAgICAgICAgICBjbnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdGF0aWNJZCA9IDA7XG4gICAgICAgIGlmIChzdGF0aWNMaWdodExpc3QpIHtcbiAgICAgICAgICAgIGxldCBvbW5pID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIHdoaWxlIChvbW5pICYmIG9tbmkuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaE9tbmlMaWdodChzY2VuZSwgc2NvcGUsIG9tbmksIGNudCk7XG4gICAgICAgICAgICAgICAgY250Kys7XG4gICAgICAgICAgICAgICAgc3RhdGljSWQrKztcbiAgICAgICAgICAgICAgICBvbW5pID0gc3RhdGljTGlnaHRMaXN0W3N0YXRpY0lkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNwdHMgPSBzb3J0ZWRMaWdodHNbTElHSFRUWVBFX1NQT1RdO1xuICAgICAgICBjb25zdCBudW1TcHRzID0gc3B0cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU3B0czsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzcG90ID0gc3B0c1tpXTtcbiAgICAgICAgICAgIGlmICghKHNwb3QubWFzayAmIG1hc2spKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzcG90LmlzU3RhdGljKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpO1xuICAgICAgICAgICAgY250Kys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBsZXQgc3BvdCA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB3aGlsZSAoc3BvdCAmJiBzcG90Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hTcG90TGlnaHQoc2NlbmUsIHNjb3BlLCBzcG90LCBjbnQpO1xuICAgICAgICAgICAgICAgIGNudCsrO1xuICAgICAgICAgICAgICAgIHN0YXRpY0lkKys7XG4gICAgICAgICAgICAgICAgc3BvdCA9IHN0YXRpY0xpZ2h0TGlzdFtzdGF0aWNJZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjdWxsKGNhbWVyYSwgZHJhd0NhbGxzLCB2aXNpYmxlTGlzdCkge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIGxldCBudW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBsZXQgdmlzaWJsZUxlbmd0aCA9IDA7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcblxuICAgICAgICBjb25zdCBjdWxsaW5nTWFzayA9IGNhbWVyYS5jdWxsaW5nTWFzayB8fCAweEZGRkZGRkZGOyAvLyBpZiBtaXNzaW5nIGFzc3VtZSBjYW1lcmEncyBkZWZhdWx0IHZhbHVlXG5cbiAgICAgICAgaWYgKCFjYW1lcmEuZnJ1c3R1bUN1bGxpbmcpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIG5lZWQgdG8gY29weSBhcnJheSBhbnl3YXkgYmVjYXVzZSBzb3J0aW5nIHdpbGwgaGFwcGVuIGFuZCBpdCdsbCBicmVhayBvcmlnaW5hbCBkcmF3IGNhbGwgb3JkZXIgYXNzdW1wdGlvblxuICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwudmlzaWJsZSAmJiAhZHJhd0NhbGwuY29tbWFuZCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgb2JqZWN0J3MgbWFzayBBTkQgdGhlIGNhbWVyYSdzIGN1bGxpbmdNYXNrIGlzIHplcm8gdGhlbiB0aGUgZ2FtZSBvYmplY3Qgd2lsbCBiZSBpbnZpc2libGUgZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLm1hc2sgJiYgKGRyYXdDYWxsLm1hc2sgJiBjdWxsaW5nTWFzaykgPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmlzaWJsZUxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmNvbW1hbmQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLnZpc2libGUpIGNvbnRpbnVlOyAvLyB1c2UgdmlzaWJsZSBwcm9wZXJ0eSB0byBxdWlja2x5IGhpZGUvc2hvdyBtZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgbGV0IHZpc2libGUgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIG9iamVjdCdzIG1hc2sgQU5EIHRoZSBjYW1lcmEncyBjdWxsaW5nTWFzayBpcyB6ZXJvIHRoZW4gdGhlIGdhbWUgb2JqZWN0IHdpbGwgYmUgaW52aXNpYmxlIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXNrICYmIChkcmF3Q2FsbC5tYXNrICYgY3VsbGluZ01hc2spID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUgPSBkcmF3Q2FsbC5faXNWaXNpYmxlKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgbnVtRHJhd0NhbGxzQ3VsbGVkKys7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh2aXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgdGhpcy5fbnVtRHJhd0NhbGxzQ3VsbGVkICs9IG51bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHZpc2libGVMZW5ndGg7XG4gICAgfVxuXG4gICAgY3VsbExpZ2h0cyhjYW1lcmEsIGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBwaHlzaWNhbFVuaXRzID0gdGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBtYXJrZWQgdmlzaWJsZSBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQuZ2V0Qm91bmRpbmdTcGhlcmUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEuZnJ1c3R1bS5jb250YWluc1NwaGVyZSh0ZW1wU3BoZXJlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC51c2VQaHlzaWNhbFVuaXRzID0gcGh5c2ljYWxVbml0cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF4aW11bSBzY3JlZW4gYXJlYSB0YWtlbiBieSB0aGUgbGlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcmVlblNpemUgPSBjYW1lcmEuZ2V0U2NyZWVuU2l6ZSh0ZW1wU3BoZXJlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Lm1heFNjcmVlblNpemUgPSBNYXRoLm1heChsaWdodC5tYXhTY3JlZW5TaXplLCBzY3JlZW5TaXplKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHNoYWRvdyBjYXN0aW5nIGxpZ2h0IGRvZXMgbm90IGhhdmUgc2hhZG93IG1hcCBhbGxvY2F0ZWQsIG1hcmsgaXQgdmlzaWJsZSB0byBhbGxvY2F0ZSBzaGFkb3cgbWFwXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3RlOiBUaGlzIHdvbid0IGJlIG5lZWRlZCB3aGVuIGNsdXN0ZXJlZCBzaGFkb3dzIGFyZSB1c2VkLCBidXQgYXQgdGhlIG1vbWVudCBldmVuIGN1bGxlZCBvdXQgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhcmUgdXNlZCBmb3IgcmVuZGVyaW5nLCBhbmQgbmVlZCBzaGFkb3cgbWFwIHRvIGJlIGFsbG9jYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZGVsZXRlIHRoaXMgY29kZSB3aGVuIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCBpcyBiZWluZyByZW1vdmVkIGFuZCBpcyBvbiBieSBkZWZhdWx0LlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MgJiYgIWxpZ2h0LnNoYWRvd01hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC51c2VQaHlzaWNhbFVuaXRzID0gdGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcblxuICAgICAgICBfc2tpblVwZGF0ZUluZGV4Kys7XG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBpZiAoZHJhd0NhbGxzQ291bnQgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2kgPSBkcmF3Q2FsbHNbaV0uc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKHNpKSB7XG4gICAgICAgICAgICAgICAgc2kudXBkYXRlTWF0cmljZXMoZHJhd0NhbGxzW2ldLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIHNpLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbHNbaV0udmlzaWJsZVRoaXNGcmFtZSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBza2luID0gZHJhd0NhbGxzW2ldLnNraW5JbnN0YW5jZTtcbiAgICAgICAgICAgIGlmIChza2luKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNraW4uX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHNraW4udXBkYXRlTWF0cml4UGFsZXR0ZShkcmF3Q2FsbHNbaV0ubm9kZSwgX3NraW5VcGRhdGVJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIHNraW4uX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9za2luVGltZSArPSBub3coKSAtIHNraW5UaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICB1cGRhdGVNb3JwaGluZyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBtb3JwaFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoSW5zdCA9IGRyYXdDYWxsc1tpXS5tb3JwaEluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdCAmJiBtb3JwaEluc3QuX2RpcnR5ICYmIGRyYXdDYWxsc1tpXS52aXNpYmxlVGhpc0ZyYW1lKSB7XG4gICAgICAgICAgICAgICAgbW9ycGhJbnN0LnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fbW9ycGhUaW1lICs9IG5vdygpIC0gbW9ycGhUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBzZXRCYXNlQ29uc3RhbnRzKGRldmljZSwgbWF0ZXJpYWwpIHtcbiAgICAgICAgLy8gQ3VsbCBtb2RlXG4gICAgICAgIGRldmljZS5zZXRDdWxsTW9kZShtYXRlcmlhbC5jdWxsKTtcbiAgICAgICAgLy8gQWxwaGEgdGVzdFxuICAgICAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICAgICAgdGhpcy5vcGFjaXR5TWFwSWQuc2V0VmFsdWUobWF0ZXJpYWwub3BhY2l0eU1hcCk7XG4gICAgICAgICAgICB0aGlzLmFscGhhVGVzdElkLnNldFZhbHVlKG1hdGVyaWFsLmFscGhhVGVzdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMrKztcbiAgICAgICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMpIHtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZSA9IG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UuYm9uZVRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZUlkLnNldFZhbHVlKGJvbmVUZXh0dXJlKTtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMF0gPSBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMV0gPSBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzJdID0gMS4wIC8gYm9uZVRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzNdID0gMS4wIC8gYm9uZVRleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmVTaXplSWQuc2V0VmFsdWUoYm9uZVRleHR1cmVTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5tYXRyaXhQYWxldHRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJldHVybnMgbnVtYmVyIG9mIGV4dHJhIGRyYXcgY2FsbHMgdG8gc2tpcCAtIHVzZWQgdG8gc2tpcCBhdXRvIGluc3RhbmNlZCBtZXNoZXMgZHJhdyBjYWxscy4gYnkgZGVmYXVsdCByZXR1cm4gMCB0byBub3Qgc2tpcCBhbnkgYWRkaXRpb25hbCBkcmF3IGNhbGxzXG4gICAgZHJhd0luc3RhbmNlKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSwgbm9ybWFsKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgbWVzaEluc3RhbmNlLm5vZGUubmFtZSk7XG5cbiAgICAgICAgaW5zdGFuY2luZ0RhdGEgPSBtZXNoSW5zdGFuY2UuaW5zdGFuY2luZ0RhdGE7XG4gICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YSkge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIoaW5zdGFuY2luZ0RhdGEudmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIGluc3RhbmNpbmdEYXRhLmNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1vZGVsTWF0cml4ID0gbWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQuc2V0VmFsdWUobW9kZWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGlmIChub3JtYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLm5vcm1hbE1hdHJpeC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLy8gdXNlZCBmb3Igc3RlcmVvXG4gICAgZHJhd0luc3RhbmNlMihkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXRyaWNlcyBhcmUgYWxyZWFkeSBzZXRcbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgcmVuZGVyU2hhZG93cyhsaWdodHMsIGNhbWVyYSkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzaGFkb3dNYXBTdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQgJiYgbGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBjbHVzdGVyZWQgc2hhZG93cyB3aXRoIG5vIGFzc2lnbmVkIGF0bGFzIHNsb3RcbiAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgYXRsYXMgc2xvdCBpcyByZWFzc2lnbmVkLCBtYWtlIHN1cmUgc2hhZG93IGlzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNTbG90VXBkYXRlZCAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyLnJlbmRlcihsaWdodCwgY2FtZXJhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVGltZSArPSBub3coKSAtIHNoYWRvd01hcFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgcmVuZGVyQ29va2llcyhsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBjb29raWVSZW5kZXJUYXJnZXQgPSB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmNvb2tpZVJlbmRlclRhcmdldDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAvLyBza2lwIGNsdXN0ZXJlZCBjb29raWVzIHdpdGggbm8gYXNzaWduZWQgYXRsYXMgc2xvdFxuICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAvLyBvbmx5IHJlbmRlciBjb29raWUgd2hlbiB0aGUgc2xvdCBpcyByZWFzc2lnbmVkIChhc3N1bWluZyB0aGUgY29va2llIHRleHR1cmUgaXMgc3RhdGljKVxuICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1Nsb3RVcGRhdGVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5yZW5kZXIobGlnaHQsIGNvb2tpZVJlbmRlclRhcmdldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdWxsTW9kZShjdWxsRmFjZXMsIGZsaXAsIGRyYXdDYWxsKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG4gICAgICAgIGxldCBtb2RlID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgaWYgKGN1bGxGYWNlcykge1xuICAgICAgICAgICAgbGV0IGZsaXBGYWNlcyA9IDE7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jdWxsID4gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsIDwgQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmZsaXBGYWNlcylcbiAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzICo9IC0xO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZsaXApXG4gICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyAqPSAtMTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHd0ID0gZHJhd0NhbGwubm9kZS53b3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICB3dC5nZXRYKHdvcmxkTWF0WCk7XG4gICAgICAgICAgICAgICAgd3QuZ2V0WSh3b3JsZE1hdFkpO1xuICAgICAgICAgICAgICAgIHd0LmdldFood29ybGRNYXRaKTtcbiAgICAgICAgICAgICAgICB3b3JsZE1hdFguY3Jvc3Mod29ybGRNYXRYLCB3b3JsZE1hdFkpO1xuICAgICAgICAgICAgICAgIGlmICh3b3JsZE1hdFguZG90KHdvcmxkTWF0WikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyAqPSAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGlwRmFjZXMgPCAwKSB7XG4gICAgICAgICAgICAgICAgbW9kZSA9IG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0ZST05UID8gQ1VMTEZBQ0VfQkFDSyA6IENVTExGQUNFX0ZST05UO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRldmljZS5zZXRDdWxsTW9kZShtb2RlKTtcblxuICAgICAgICBpZiAobW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICBjb25zdCB3dDIgPSBkcmF3Q2FsbC5ub2RlLndvcmxkVHJhbnNmb3JtO1xuICAgICAgICAgICAgd3QyLmdldFgod29ybGRNYXRYKTtcbiAgICAgICAgICAgIHd0Mi5nZXRZKHdvcmxkTWF0WSk7XG4gICAgICAgICAgICB3dDIuZ2V0Wih3b3JsZE1hdFopO1xuICAgICAgICAgICAgd29ybGRNYXRYLmNyb3NzKHdvcmxkTWF0WCwgd29ybGRNYXRZKTtcbiAgICAgICAgICAgIGlmICh3b3JsZE1hdFguZG90KHdvcmxkTWF0WikgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZC5zZXRWYWx1ZSgtMS4wKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZC5zZXRWYWx1ZSgxLjApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpIHtcblxuICAgICAgICAvLyBtYWluIHZlcnRleCBidWZmZXJcbiAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihtZXNoLnZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgc2V0TW9ycGhpbmcoZGV2aWNlLCBtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UubW9ycGgudXNlVGV4dHVyZU1vcnBoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyIHdpdGggdmVydGV4IGlkc1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobW9ycGhJbnN0YW5jZS5tb3JwaC52ZXJ0ZXhCdWZmZXJJZHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXguc2V0VmFsdWUobW9ycGhJbnN0YW5jZS50ZXh0dXJlUG9zaXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZU5vcm1hbHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3RleHR1cmVQYXJhbXMpO1xuXG4gICAgICAgICAgICB9IGVsc2UgeyAgICAvLyB2ZXJ0ZXggYXR0cmlidXRlcyBiYXNlZCBtb3JwaGluZ1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgdCA9IDA7IHQgPCBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgdCsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmIgPSBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzW3RdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGF0Y2ggc2VtYW50aWMgZm9yIHRoZSBidWZmZXIgdG8gY3VycmVudCBBVFRSIHNsb3QgKHVzaW5nIEFUVFI4IC0gQVRUUjE1IHJhbmdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBTRU1BTlRJQ19BVFRSICsgKHQgKyA4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC5lbGVtZW50c1swXS5uYW1lID0gc2VtYW50aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0uc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNlbWFudGljKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcih2Yik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgYWxsIDggd2VpZ2h0c1xuICAgICAgICAgICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQS5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl9zaGFkZXJNb3JwaFdlaWdodHNBKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Iuc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXRzIFZlYzMgY2FtZXJhIHBvc2l0aW9uIHVuaWZvcm1cbiAgICBkaXNwYXRjaFZpZXdQb3MocG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgdnAgPSB0aGlzLnZpZXdQb3M7XG4gICAgICAgIHZwWzBdID0gcG9zaXRpb24ueDtcbiAgICAgICAgdnBbMV0gPSBwb3NpdGlvbi55O1xuICAgICAgICB2cFsyXSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZwKTtcbiAgICB9XG5cbiAgICAvLyBleGVjdXRlIGZpcnN0IHBhc3Mgb3ZlciBkcmF3IGNhbGxzLCBpbiBvcmRlciB0byB1cGRhdGUgbWF0ZXJpYWxzIC8gc2hhZGVyc1xuICAgIC8vIFRPRE86IGltcGxlbWVudCB0aGlzOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2ViR0xfQVBJL1dlYkdMX2Jlc3RfcHJhY3RpY2VzI2NvbXBpbGVfc2hhZGVyc19hbmRfbGlua19wcm9ncmFtc19pbl9wYXJhbGxlbFxuICAgIC8vIHdoZXJlIGluc3RlYWQgb2YgY29tcGlsaW5nIGFuZCBsaW5raW5nIHNoYWRlcnMsIHdoaWNoIGlzIHNlcmlhbCBvcGVyYXRpb24sIHdlIGNvbXBpbGUgYWxsIG9mIHRoZW0gYW5kIHRoZW4gbGluayB0aGVtLCBhbGxvd2luZyB0aGUgd29yayB0b1xuICAgIC8vIHRha2UgcGxhY2UgaW4gcGFyYWxsZWxcbiAgICByZW5kZXJGb3J3YXJkUHJlcGFyZU1hdGVyaWFscyhjYW1lcmEsIGRyYXdDYWxscywgZHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgY3VsbGluZ01hc2ssIGxheWVyLCBwYXNzKSB7XG5cbiAgICAgICAgY29uc3QgYWRkQ2FsbCA9IChkcmF3Q2FsbCwgaXNOZXdNYXRlcmlhbCwgbGlnaHRNYXNrQ2hhbmdlZCkgPT4ge1xuICAgICAgICAgICAgX2RyYXdDYWxsTGlzdC5kcmF3Q2FsbHMucHVzaChkcmF3Q2FsbCk7XG4gICAgICAgICAgICBfZHJhd0NhbGxMaXN0LmlzTmV3TWF0ZXJpYWwucHVzaChpc05ld01hdGVyaWFsKTtcbiAgICAgICAgICAgIF9kcmF3Q2FsbExpc3QubGlnaHRNYXNrQ2hhbmdlZC5wdXNoKGxpZ2h0TWFza0NoYW5nZWQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggZW1wdHkgYXJyYXlzXG4gICAgICAgIF9kcmF3Q2FsbExpc3QuZHJhd0NhbGxzLmxlbmd0aCA9IDA7XG4gICAgICAgIF9kcmF3Q2FsbExpc3QuaXNOZXdNYXRlcmlhbC5sZW5ndGggPSAwO1xuICAgICAgICBfZHJhd0NhbGxMaXN0LmxpZ2h0TWFza0NoYW5nZWQubGVuZ3RoID0gMDtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBsaWdodEhhc2ggPSBsYXllciA/IGxheWVyLl9saWdodEhhc2ggOiAwO1xuICAgICAgICBsZXQgcHJldk1hdGVyaWFsID0gbnVsbCwgcHJldk9iakRlZnMsIHByZXZTdGF0aWMsIHByZXZMaWdodE1hc2s7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7TWVzaEluc3RhbmNlfSAqL1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG5cbiAgICAgICAgICAgIC8vIGFwcGx5IHZpc2liaWxpdHkgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmIChjdWxsaW5nTWFzayAmJiBkcmF3Q2FsbC5tYXNrICYmICEoY3VsbGluZ01hc2sgJiBkcmF3Q2FsbC5tYXNrKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIHtcblxuICAgICAgICAgICAgICAgIGFkZENhbGwoZHJhd0NhbGwsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYSA9PT0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPj0gRm9yd2FyZFJlbmRlcmVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID49IGxheWVyLnNraXBSZW5kZXJBZnRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5lbnN1cmVNYXRlcmlhbChkZXZpY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBvYmpEZWZzID0gZHJhd0NhbGwuX3NoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRNYXNrID0gZHJhd0NhbGwubWFzaztcblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAmJiBtYXRlcmlhbCA9PT0gcHJldk1hdGVyaWFsICYmIG9iakRlZnMgIT09IHByZXZPYmpEZWZzKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZNYXRlcmlhbCA9IG51bGw7IC8vIGZvcmNlIGNoYW5nZSBzaGFkZXIgaWYgdGhlIG9iamVjdCB1c2VzIGEgZGlmZmVyZW50IHZhcmlhbnQgb2YgdGhlIHNhbWUgbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuaXNTdGF0aWMgfHwgcHJldlN0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsU3dpdGNoZXMrKztcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuX3NjZW5lID0gc2NlbmU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGVVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBtYXRlcmlhbCBoYXMgZGlydHlCbGVuZCBzZXQsIG5vdGlmeSBzY2VuZSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5fZGlydHlCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUubGF5ZXJzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwuX3NoYWRlcltwYXNzXSB8fCBkcmF3Q2FsbC5fc2hhZGVyRGVmcyAhPT0gb2JqRGVmcyB8fCBkcmF3Q2FsbC5fbGlnaHRIYXNoICE9PSBsaWdodEhhc2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBkcmF3IGNhbGxzIG5vdCB1c2luZyBzdGF0aWMgbGlnaHRzIHVzZSB2YXJpYW50cyBjYWNoZSBvbiBtYXRlcmlhbCB0byBxdWlja2x5IGZpbmQgdGhlIHNoYWRlciwgYXMgdGhleSBhcmUgYWxsXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzYW1lIGZvciB0aGUgc2FtZSBwYXNzLCB1c2luZyBhbGwgbGlnaHRzIG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YXJpYW50S2V5ID0gcGFzcyArICdfJyArIG9iakRlZnMgKyAnXycgKyBsaWdodEhhc2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdID0gbWF0ZXJpYWwudmFyaWFudHNbdmFyaWFudEtleV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLl9zaGFkZXJbcGFzc10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBudWxsLCBzb3J0ZWRMaWdodHMsIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQsIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwudmFyaWFudHNbdmFyaWFudEtleV0gPSBkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzdGF0aWMgbGlnaHRzIGdlbmVyYXRlIHVuaXF1ZSBzaGFkZXIgcGVyIGRyYXcgY2FsbCwgYXMgc3RhdGljIGxpZ2h0cyBhcmUgdW5pcXVlIHBlciBkcmF3IGNhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgc28gdmFyaWFudHMgY2FjaGUgaXMgbm90IHVzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIGRyYXdDYWxsLl9zdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cywgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCwgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC5fbGlnaHRIYXNoID0gbGlnaHRIYXNoO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdLCBcIm5vIHNoYWRlciBmb3IgcGFzc1wiLCBtYXRlcmlhbCk7XG5cbiAgICAgICAgICAgICAgICBhZGRDYWxsKGRyYXdDYWxsLCBtYXRlcmlhbCAhPT0gcHJldk1hdGVyaWFsLCAhcHJldk1hdGVyaWFsIHx8IGxpZ2h0TWFzayAhPT0gcHJldkxpZ2h0TWFzayk7XG5cbiAgICAgICAgICAgICAgICBwcmV2TWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBwcmV2T2JqRGVmcyA9IG9iakRlZnM7XG4gICAgICAgICAgICAgICAgcHJldkxpZ2h0TWFzayA9IGxpZ2h0TWFzaztcbiAgICAgICAgICAgICAgICBwcmV2U3RhdGljID0gZHJhd0NhbGwuaXNTdGF0aWM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2RyYXdDYWxsTGlzdDtcbiAgICB9XG5cbiAgICByZW5kZXJGb3J3YXJkSW50ZXJuYWwoY2FtZXJhLCBwcmVwYXJlZENhbGxzLCBzb3J0ZWRMaWdodHMsIHBhc3MsIGRyYXdDYWxsYmFjaywgZmxpcEZhY2VzKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzdXBwb3J0c1VuaWZvcm1CdWZmZXJzID0gZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnM7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgcGFzc0ZsYWcgPSAxIDw8IHBhc3M7XG5cbiAgICAgICAgLy8gUmVuZGVyIHRoZSBzY2VuZVxuICAgICAgICBjb25zdCBwcmVwYXJlZENhbGxzQ291bnQgPSBwcmVwYXJlZENhbGxzLmRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJlcGFyZWRDYWxsc0NvdW50OyBpKyspIHtcblxuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBwcmVwYXJlZENhbGxzLmRyYXdDYWxsc1tpXTtcblxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIHtcblxuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgYSBjb21tYW5kXG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuY29tbWFuZCgpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBhIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdNYXRlcmlhbCA9IHByZXBhcmVkQ2FsbHMuaXNOZXdNYXRlcmlhbFtpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodE1hc2tDaGFuZ2VkID0gcHJlcGFyZWRDYWxscy5saWdodE1hc2tDaGFuZ2VkW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqRGVmcyA9IGRyYXdDYWxsLl9zaGFkZXJEZWZzO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0TWFzayA9IGRyYXdDYWxsLm1hc2s7XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3TWF0ZXJpYWwpIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkZXIgPSBkcmF3Q2FsbC5fc2hhZGVyW3Bhc3NdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXNoYWRlci5mYWlsZWQgJiYgIWRldmljZS5zZXRTaGFkZXIoc2hhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYEVycm9yIGNvbXBpbGluZyBzaGFkZXIgZm9yIG1hdGVyaWFsPSR7bWF0ZXJpYWwubmFtZX0gcGFzcz0ke3Bhc3N9IG9iakRlZnM9JHtvYmpEZWZzfWAsIG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFVuaWZvcm1zIEk6IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcnMoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRNYXNrQ2hhbmdlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlZERpckxpZ2h0cyA9IHRoaXMuZGlzcGF0Y2hEaXJlY3RMaWdodHMoc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0sIHNjZW5lLCBsaWdodE1hc2ssIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoTG9jYWxMaWdodHMoc29ydGVkTGlnaHRzLCBzY2VuZSwgbGlnaHRNYXNrLCB1c2VkRGlyTGlnaHRzLCBkcmF3Q2FsbC5fc3RhdGljTGlnaHRMaXN0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcblxuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRpbmcobWF0ZXJpYWwuYmxlbmQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuYmxlbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbC5zZXBhcmF0ZUFscGhhQmxlbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlKG1hdGVyaWFsLmJsZW5kU3JjLCBtYXRlcmlhbC5ibGVuZERzdCwgbWF0ZXJpYWwuYmxlbmRTcmNBbHBoYSwgbWF0ZXJpYWwuYmxlbmREc3RBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZShtYXRlcmlhbC5ibGVuZEVxdWF0aW9uLCBtYXRlcmlhbC5ibGVuZEFscGhhRXF1YXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRGdW5jdGlvbihtYXRlcmlhbC5ibGVuZFNyYywgbWF0ZXJpYWwuYmxlbmREc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCbGVuZEVxdWF0aW9uKG1hdGVyaWFsLmJsZW5kRXF1YXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRDb2xvcldyaXRlKG1hdGVyaWFsLnJlZFdyaXRlLCBtYXRlcmlhbC5ncmVlbldyaXRlLCBtYXRlcmlhbC5ibHVlV3JpdGUsIG1hdGVyaWFsLmFscGhhV3JpdGUpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZShtYXRlcmlhbC5kZXB0aFdyaXRlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzIGZpeGVzIHRoZSBjYXNlIHdoZXJlIHRoZSB1c2VyIHdpc2hlcyB0byB0dXJuIG9mZiBkZXB0aCB0ZXN0aW5nIGJ1dCB3YW50cyB0byB3cml0ZSBkZXB0aFxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWwuZGVwdGhXcml0ZSAmJiAhbWF0ZXJpYWwuZGVwdGhUZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhGdW5jKEZVTkNfQUxXQVlTKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFRlc3QodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhGdW5jKG1hdGVyaWFsLmRlcHRoRnVuYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhUZXN0KG1hdGVyaWFsLmRlcHRoVGVzdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QWxwaGFUb0NvdmVyYWdlKG1hdGVyaWFsLmFscGhhVG9Db3ZlcmFnZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmRlcHRoQmlhcyB8fCBtYXRlcmlhbC5zbG9wZURlcHRoQmlhcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoQmlhcyh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aEJpYXNWYWx1ZXMobWF0ZXJpYWwuZGVwdGhCaWFzLCBtYXRlcmlhbC5zbG9wZURlcHRoQmlhcyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q3VsbE1vZGUoY2FtZXJhLl9jdWxsRmFjZXMsIGZsaXBGYWNlcywgZHJhd0NhbGwpO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbEZyb250ID0gZHJhd0NhbGwuc3RlbmNpbEZyb250IHx8IG1hdGVyaWFsLnN0ZW5jaWxGcm9udDtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsQmFjayA9IGRyYXdDYWxsLnN0ZW5jaWxCYWNrIHx8IG1hdGVyaWFsLnN0ZW5jaWxCYWNrO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCB8fCBzdGVuY2lsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFRlc3QodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsRnJvbnQgPT09IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZGVudGljYWwgZnJvbnQvYmFjayBzdGVuY2lsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmMoc3RlbmNpbEZyb250LmZ1bmMsIHN0ZW5jaWxGcm9udC5yZWYsIHN0ZW5jaWxGcm9udC5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbihzdGVuY2lsRnJvbnQuZmFpbCwgc3RlbmNpbEZyb250LnpmYWlsLCBzdGVuY2lsRnJvbnQuenBhc3MsIHN0ZW5jaWxGcm9udC53cml0ZU1hc2spO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2VwYXJhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsRnJvbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNGcm9udChzdGVuY2lsRnJvbnQuZnVuYywgc3RlbmNpbEZyb250LnJlZiwgc3RlbmNpbEZyb250LnJlYWRNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgZnJvbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNGcm9udChGVU5DX0FMV0FZUywgMCwgMHhGRik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udChTVEVOQ0lMT1BfS0VFUCwgU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCBiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxGdW5jQmFjayhzdGVuY2lsQmFjay5mdW5jLCBzdGVuY2lsQmFjay5yZWYsIHN0ZW5jaWxCYWNrLnJlYWRNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkJhY2soc3RlbmNpbEJhY2suZmFpbCwgc3RlbmNpbEJhY2suemZhaWwsIHN0ZW5jaWxCYWNrLnpwYXNzLCBzdGVuY2lsQmFjay53cml0ZU1hc2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbEZ1bmNCYWNrKEZVTkNfQUxXQVlTLCAwLCAweEZGKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbE9wZXJhdGlvbkJhY2soU1RFTkNJTE9QX0tFRVAsIFNURU5DSUxPUF9LRUVQLCBTVEVOQ0lMT1BfS0VFUCwgMHhGRik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0U3RlbmNpbFRlc3QoZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBkcmF3Q2FsbC5tZXNoO1xuXG4gICAgICAgICAgICAgICAgLy8gVW5pZm9ybXMgSUk6IG1lc2hJbnN0YW5jZSBvdmVycmlkZXNcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWcpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRWZXJ0ZXhCdWZmZXJzKGRldmljZSwgbWVzaCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRNb3JwaGluZyhkZXZpY2UsIGRyYXdDYWxsLm1vcnBoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2tpbm5pbmcoZGV2aWNlLCBkcmF3Q2FsbCwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBtb2RlbCBtYXRyaXggc2V0dXAgaXMgcGFydCBvZiB0aGUgZHJhd0luc3RhbmNlIGNhbGwsIGJ1dCB3aXRoIHVuaWZvcm0gYnVmZmVyIGl0J3MgbmVlZGVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGVhcmxpZXIgaGVyZS4gVGhpcyBuZWVkcyB0byBiZSByZWZhY3RvcmVkIGZvciBtdWx0aS12aWV3IGFueXdheXMuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShkcmF3Q2FsbC5ub2RlLndvcmxkVHJhbnNmb3JtLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKGRyYXdDYWxsLm5vZGUubm9ybWFsTWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBtZXNoIGJpbmQgZ3JvdXAgLyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwID0gZHJhd0NhbGwuZ2V0QmluZEdyb3VwKGRldmljZSwgcGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXIudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX01FU0gsIG1lc2hCaW5kR3JvdXApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gZHJhd0NhbGwucmVuZGVyU3R5bGU7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldEluZGV4QnVmZmVyKG1lc2guaW5kZXhCdWZmZXJbc3R5bGVdKTtcblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGxiYWNrKGRyYXdDYWxsLCBpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci5zZXNzaW9uICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCB2aWV3cy5sZW5ndGg7IHYrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQodmlldy52aWV3cG9ydC54LCB2aWV3LnZpZXdwb3J0LnksIHZpZXcudmlld3BvcnQueiwgdmlldy52aWV3cG9ydC53KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUodmlldy5wcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQuc2V0VmFsdWUodmlldy52aWV3T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlldy52aWV3SW52T2ZmTWF0LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3SWQzLnNldFZhbHVlKHZpZXcudmlld01hdDMuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlldy5wcm9qVmlld09mZk1hdC5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZpZXcucG9zaXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodiA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHJhd0luc3RhbmNlKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UyKGRldmljZSwgZHJhd0NhbGwsIG1lc2gsIHN0eWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kcmF3SW5zdGFuY2UoZGV2aWNlLCBkcmF3Q2FsbCwgbWVzaCwgc3R5bGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVW5zZXQgbWVzaEluc3RhbmNlIG92ZXJyaWRlcyBiYWNrIHRvIG1hdGVyaWFsIHZhbHVlcyBpZiBuZXh0IGRyYXcgY2FsbCB3aWxsIHVzZSB0aGUgc2FtZSBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIGlmIChpIDwgcHJlcGFyZWRDYWxsc0NvdW50IC0gMSAmJiAhcHJlcGFyZWRDYWxscy5pc05ld01hdGVyaWFsW2kgKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXJzKGRldmljZSwgZHJhd0NhbGwucGFyYW1ldGVycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyRm9yd2FyZChjYW1lcmEsIGFsbERyYXdDYWxscywgYWxsRHJhd0NhbGxzQ291bnQsIHNvcnRlZExpZ2h0cywgcGFzcywgY3VsbGluZ01hc2ssIGRyYXdDYWxsYmFjaywgbGF5ZXIsIGZsaXBGYWNlcykge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgZm9yd2FyZFN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBydW4gZmlyc3QgcGFzcyBvdmVyIGRyYXcgY2FsbHMgYW5kIGhhbmRsZSBtYXRlcmlhbCAvIHNoYWRlciB1cGRhdGVzXG4gICAgICAgIGNvbnN0IHByZXBhcmVkQ2FsbHMgPSB0aGlzLnJlbmRlckZvcndhcmRQcmVwYXJlTWF0ZXJpYWxzKGNhbWVyYSwgYWxsRHJhd0NhbGxzLCBhbGxEcmF3Q2FsbHNDb3VudCwgc29ydGVkTGlnaHRzLCBjdWxsaW5nTWFzaywgbGF5ZXIsIHBhc3MpO1xuXG4gICAgICAgIC8vIHJlbmRlciBtZXNoIGluc3RhbmNlc1xuICAgICAgICB0aGlzLnJlbmRlckZvcndhcmRJbnRlcm5hbChjYW1lcmEsIHByZXBhcmVkQ2FsbHMsIHNvcnRlZExpZ2h0cywgcGFzcywgZHJhd0NhbGxiYWNrLCBmbGlwRmFjZXMpO1xuXG4gICAgICAgIF9kcmF3Q2FsbExpc3QubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2ZvcndhcmRUaW1lICs9IG5vdygpIC0gZm9yd2FyZFN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gTWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbmx5TGl0U2hhZGVycyAtIExpbWl0cyB0aGUgdXBkYXRlIHRvIHNoYWRlcnMgYWZmZWN0ZWQgYnkgbGlnaHRpbmcuXG4gICAgICovXG4gICAgdXBkYXRlU2hhZGVycyhkcmF3Q2FsbHMsIG9ubHlMaXRTaGFkZXJzKSB7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXQgPSBkcmF3Q2FsbHNbaV0ubWF0ZXJpYWw7XG4gICAgICAgICAgICBpZiAobWF0KSB7XG4gICAgICAgICAgICAgICAgLy8gbWF0ZXJpYWwgbm90IHByb2Nlc3NlZCB5ZXRcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhtYXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIF90ZW1wU2V0LmFkZChtYXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBmb3IgbWF0ZXJpYWxzIG5vdCB1c2luZyB2YXJpYW50c1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0LmdldFNoYWRlclZhcmlhbnQgIT09IE1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXJWYXJpYW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbmx5TGl0U2hhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNraXAgbWF0ZXJpYWxzIG5vdCB1c2luZyBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0LnVzZUxpZ2h0aW5nIHx8IChtYXQuZW1pdHRlciAmJiAhbWF0LmVtaXR0ZXIubGlnaHRpbmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2hhZGVyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbCBhbmQgYWxzbyBvbiBtZXNoIGluc3RhbmNlcyB0aGF0IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbGlnaHRzQ2hhbmdlZCAtIFRydWUgaWYgbGlnaHRzIG9mIHRoZSBjb21wb3NpdGlvbiBoYXMgY2hhbmdlZC5cbiAgICAgKi9cbiAgICBiZWdpbkZyYW1lKGNvbXAsIGxpZ2h0c0NoYW5nZWQpIHtcbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGNvbXAuX21lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgLy8gVXBkYXRlIHNoYWRlcnMgaWYgbmVlZGVkXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgaWYgKHNjZW5lLnVwZGF0ZVNoYWRlcnMgfHwgbGlnaHRzQ2hhbmdlZCkge1xuICAgICAgICAgICAgY29uc3Qgb25seUxpdFNoYWRlcnMgPSAhc2NlbmUudXBkYXRlU2hhZGVycyAmJiBsaWdodHNDaGFuZ2VkO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzKG1lc2hJbnN0YW5jZXMsIG9ubHlMaXRTaGFkZXJzKTtcbiAgICAgICAgICAgIHNjZW5lLnVwZGF0ZVNoYWRlcnMgPSBmYWxzZTtcbiAgICAgICAgICAgIHNjZW5lLl9zaGFkZXJWZXJzaW9uKys7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgYWxsIHNraW4gbWF0cmljZXMgdG8gcHJvcGVybHkgY3VsbCBza2lubmVkIG9iamVjdHMgKGJ1dCBkb24ndCB1cGRhdGUgcmVuZGVyaW5nIGRhdGEgeWV0KVxuICAgICAgICB0aGlzLnVwZGF0ZUNwdVNraW5NYXRyaWNlcyhtZXNoSW5zdGFuY2VzKTtcblxuICAgICAgICAvLyBjbGVhciBtZXNoIGluc3RhbmNlIHZpc2liaWxpdHlcbiAgICAgICAgY29uc3QgbWlDb3VudCA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlVGhpc0ZyYW1lID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBsaWdodCB2aXNpYmlsaXR5XG4gICAgICAgIGNvbnN0IGxpZ2h0cyA9IGNvbXAuX2xpZ2h0cztcbiAgICAgICAgY29uc3QgbGlnaHRDb3VudCA9IGxpZ2h0cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBsaWdodHNbaV0uYmVnaW5GcmFtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUgbGF5ZXIgY29tcG9zaXRpb24gZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllciBjb21wb3NpdGlvbiB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgLSBUcnVlIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gRmxhZ3Mgb2Ygd2hhdCB3YXMgdXBkYXRlZFxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVMYXllckNvbXBvc2l0aW9uKGNvbXAsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgbGVuID0gY29tcC5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb21wLmxheWVyTGlzdFtpXS5fcG9zdFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBzaGFkZXJWZXJzaW9uID0gc2NlbmUuX3NoYWRlclZlcnNpb247XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbaV07XG4gICAgICAgICAgICBsYXllci5fc2hhZGVyVmVyc2lvbiA9IHNoYWRlclZlcnNpb247XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgICAgICBsYXllci5fcmVuZGVyVGltZSA9IDA7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgbGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzID0gMDtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbaV07XG4gICAgICAgICAgICBpZiAodHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgfD0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyIHw9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXggPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXI7XG5cbiAgICAgICAgICAgIC8vIHByZXBhcmUgbGF5ZXIgZm9yIGN1bGxpbmcgd2l0aCB0aGUgY2FtZXJhXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxheWVyLmNhbWVyYXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBsYXllci5pbnN0YW5jZXMucHJlcGFyZShqKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gR2VuZXJhdGUgc3RhdGljIGxpZ2h0aW5nIGZvciBtZXNoZXMgaW4gdGhpcyBsYXllciBpZiBuZWVkZWRcbiAgICAgICAgICAgIC8vIE5vdGU6IFN0YXRpYyBsaWdodGluZyBpcyBub3QgdXNlZCB3aGVuIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAobGF5ZXIuX25lZWRzU3RhdGljUHJlcGFyZSAmJiBsYXllci5fc3RhdGljTGlnaHRIYXNoICYmICF0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIC8vIFRPRE86IHJldXNlIHdpdGggdGhlIHNhbWUgc3RhdGljTGlnaHRIYXNoXG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9zdGF0aWNQcmVwYXJlRG9uZSkge1xuICAgICAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucmV2ZXJ0KGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucmV2ZXJ0KGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5wcmVwYXJlKHRoaXMuZGV2aWNlLCBzY2VuZSwgbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcywgbGF5ZXIuX2xpZ2h0cyk7XG4gICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnByZXBhcmUodGhpcy5kZXZpY2UsIHNjZW5lLCBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMsIGxheWVyLl9saWdodHMpO1xuICAgICAgICAgICAgICAgIGNvbXAuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzY2VuZS51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBsYXllci5fbmVlZHNTdGF0aWNQcmVwYXJlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3N0YXRpY1ByZXBhcmVEb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBzdGF0aWMgbGF5ZXIgZGF0YSwgaWYgc29tZXRoaW5nJ3MgY2hhbmdlZFxuICAgICAgICBjb25zdCB1cGRhdGVkID0gY29tcC5fdXBkYXRlKHRoaXMuZGV2aWNlLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgKz0gbm93KCkgLSBsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHVwZGF0ZWQ7XG4gICAgfVxuXG4gICAgZ3B1VXBkYXRlKGRyYXdDYWxscykge1xuICAgICAgICAvLyBza2lwIGV2ZXJ5dGhpbmcgd2l0aCB2aXNpYmxlVGhpc0ZyYW1lID09PSBmYWxzZVxuICAgICAgICB0aGlzLnVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscyk7XG4gICAgfVxuXG4gICAgc2V0U2NlbmVDb25zdGFudHMoKSB7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvLyBTZXQgdXAgYW1iaWVudC9leHBvc3VyZVxuICAgICAgICB0aGlzLmRpc3BhdGNoR2xvYmFsTGlnaHRzKHNjZW5lKTtcblxuICAgICAgICAvLyBTZXQgdXAgdGhlIGZvZ1xuICAgICAgICBpZiAoc2NlbmUuZm9nICE9PSBGT0dfTk9ORSkge1xuICAgICAgICAgICAgdGhpcy5mb2dDb2xvclswXSA9IHNjZW5lLmZvZ0NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLmZvZ0NvbG9yWzFdID0gc2NlbmUuZm9nQ29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbMl0gPSBzY2VuZS5mb2dDb2xvci5iO1xuICAgICAgICAgICAgaWYgKHNjZW5lLmdhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JbaV0gPSBNYXRoLnBvdyh0aGlzLmZvZ0NvbG9yW2ldLCAyLjIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZm9nQ29sb3JJZC5zZXRWYWx1ZSh0aGlzLmZvZ0NvbG9yKTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5mb2cgPT09IEZPR19MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZvZ1N0YXJ0SWQuc2V0VmFsdWUoc2NlbmUuZm9nU3RhcnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZm9nRW5kSWQuc2V0VmFsdWUoc2NlbmUuZm9nRW5kKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2dEZW5zaXR5SWQuc2V0VmFsdWUoc2NlbmUuZm9nRGVuc2l0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdXAgc2NyZWVuIHNpemUgLy8gc2hvdWxkIGJlIFJUIHNpemU/XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzBdID0gZGV2aWNlLndpZHRoO1xuICAgICAgICB0aGlzLl9zY3JlZW5TaXplWzFdID0gZGV2aWNlLmhlaWdodDtcbiAgICAgICAgdGhpcy5fc2NyZWVuU2l6ZVsyXSA9IDEgLyBkZXZpY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuX3NjcmVlblNpemVbM10gPSAxIC8gZGV2aWNlLmhlaWdodDtcbiAgICAgICAgdGhpcy5zY3JlZW5TaXplSWQuc2V0VmFsdWUodGhpcy5fc2NyZWVuU2l6ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb21wVXBkYXRlZEZsYWdzIC0gRmxhZ3Mgb2Ygd2hhdCB3YXMgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVMaWdodFN0YXRzKGNvbXAsIGNvbXBVcGRhdGVkRmxhZ3MpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9MSUdIVFMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gc2NlbmUuX3N0YXRzO1xuICAgICAgICAgICAgc3RhdHMubGlnaHRzID0gY29tcC5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMgPSAwO1xuICAgICAgICAgICAgc3RhdHMuYmFrZWRMaWdodHMgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRzLmxpZ2h0czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAobC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgobC5tYXNrICYgTUFTS19BRkZFQ1RfRFlOQU1JQykgfHwgKGwubWFzayAmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSkgeyAvLyBpZiBhZmZlY3RzIGR5bmFtaWMgb3IgYmFrZWQgb2JqZWN0cyBpbiByZWFsLXRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLmR5bmFtaWNMaWdodHMrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobC5tYXNrICYgTUFTS19CQUtFKSB7IC8vIGlmIGJha2VkIGludG8gbGlnaHRtYXBzXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5iYWtlZExpZ2h0cysrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBVcGRhdGVkRmxhZ3MgJiBDT01QVVBEQVRFRF9JTlNUQU5DRVMgfHwgIXNjZW5lLl9zdGF0c1VwZGF0ZWQpIHtcbiAgICAgICAgICAgIHNjZW5lLl9zdGF0cy5tZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBzY2VuZS5fc3RhdHNVcGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2hhZG93IG1hcCBjdWxsaW5nIGZvciBkaXJlY3Rpb25hbCBhbmQgdmlzaWJsZSBsb2NhbCBsaWdodHNcbiAgICAgKiB2aXNpYmxlIG1lc2hJbnN0YW5jZXMgYXJlIGNvbGxlY3RlZCBpbnRvIGxpZ2h0Ll9yZW5kZXJEYXRhLCBhbmQgYXJlIG1hcmtlZCBhcyB2aXNpYmxlXG4gICAgICogZm9yIGRpcmVjdGlvbmFsIGxpZ2h0cyBhbHNvIHNoYWRvdyBjYW1lcmEgbWF0cml4IGlzIHNldCB1cFxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGN1bGxTaGFkb3dtYXBzKGNvbXApIHtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzdGVycyBjdWxsaW5nIGZvciBsb2NhbCAocG9pbnQgYW5kIHNwb3QpIGxpZ2h0c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbXAuX2xpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBjb21wLl9saWdodHNbaV07XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC52aXNpYmxlVGhpc0ZyYW1lICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhc3RlcnMgPSBjb21wLl9saWdodENvbXBvc2l0aW9uRGF0YVtpXS5zaGFkb3dDYXN0ZXJzTGlzdDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXIuY3VsbExvY2FsKGxpZ2h0LCBjYXN0ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgY2FzdGVycyBjdWxsaW5nIGZvciBnbG9iYWwgKGRpcmVjdGlvbmFsKSBsaWdodHNcbiAgICAgICAgLy8gcmVuZGVyIGFjdGlvbnMgc3RvcmUgd2hpY2ggZGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBuZWVkZWQgZm9yIGVhY2ggY2FtZXJhLCBzbyB0aGVzZSBhcmUgZ2V0dGluZyBjdWxsZWRcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gcmVuZGVyQWN0aW9uLmRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodEluZGV4ID0gcmVuZGVyQWN0aW9uLmRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlc1tqXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGNvbXAuX2xpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYXN0ZXJzID0gY29tcC5fbGlnaHRDb21wb3NpdGlvbkRhdGFbbGlnaHRJbmRleF0uc2hhZG93Q2FzdGVyc0xpc3Q7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXIuY3VsbERpcmVjdGlvbmFsKGxpZ2h0LCBjYXN0ZXJzLCByZW5kZXJBY3Rpb24uY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB2aXNpYmlsaXR5IGN1bGxpbmcgb2YgbGlnaHRzLCBtZXNoSW5zdGFuY2VzLCBzaGFkb3dzIGNhc3RlcnNcbiAgICAgKiBBbHNvIGFwcGxpZXMgbWVzaEluc3RhbmNlLnZpc2libGUgYW5kIGNhbWVyYS5jdWxsaW5nTWFza1xuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGN1bGxDb21wb3NpdGlvbihjb21wKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBjdWxsVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7UmVuZGVyQWN0aW9ufSAqL1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcblxuICAgICAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgICAgIGNvbnN0IGxheWVySW5kZXggPSByZW5kZXJBY3Rpb24ubGF5ZXJJbmRleDtcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7TGF5ZXJ9ICovXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFsYXllci5lbmFibGVkIHx8ICFjb21wLnN1YkxheWVyRW5hYmxlZFtsYXllckluZGV4XSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBjYW1lcmFcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgICAgICAvKiogQHR5cGUge0NhbWVyYUNvbXBvbmVudH0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgICAgIGNhbWVyYS5mcmFtZVVwZGF0ZShyZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0KTtcblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBjYW1lcmEgYW5kIGZydXN0dW0gb25jZVxuICAgICAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uZmlyc3RDYW1lcmFVc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVDYW1lcmFGcnVzdHVtKGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmFzUmVuZGVyZWQrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjdWxsIGVhY2ggbGF5ZXIncyBub24tZGlyZWN0aW9uYWwgbGlnaHRzIG9uY2Ugd2l0aCBlYWNoIGNhbWVyYVxuICAgICAgICAgICAgICAgIC8vIGxpZ2h0cyBhcmVuJ3QgY29sbGVjdGVkIGFueXdoZXJlLCBidXQgbWFya2VkIGFzIHZpc2libGVcbiAgICAgICAgICAgICAgICB0aGlzLmN1bGxMaWdodHMoY2FtZXJhLmNhbWVyYSwgbGF5ZXIuX2xpZ2h0cyk7XG5cbiAgICAgICAgICAgICAgICAvLyBjdWxsIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqZWN0cyA9IGxheWVyLmluc3RhbmNlcztcblxuICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgdGhlbSBpbnRvIGxheWVyIGFycmF5c1xuICAgICAgICAgICAgICAgIGNvbnN0IHZpc2libGUgPSB0cmFuc3BhcmVudCA/IG9iamVjdHMudmlzaWJsZVRyYW5zcGFyZW50W2NhbWVyYVBhc3NdIDogb2JqZWN0cy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAgICAgLy8gc2hhcmVkIG9iamVjdHMgYXJlIG9ubHkgY3VsbGVkIG9uY2VcbiAgICAgICAgICAgICAgICBpZiAoIXZpc2libGUuZG9uZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5vblByZUN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUHJlQ3VsbChjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IHRyYW5zcGFyZW50ID8gbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIDogbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5sZW5ndGggPSB0aGlzLmN1bGwoY2FtZXJhLmNhbWVyYSwgZHJhd0NhbGxzLCB2aXNpYmxlLmxpc3QpO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5vblBvc3RDdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5vblBvc3RDdWxsKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3VsbCBzaGFkb3cgY2FzdGVycyBmb3IgYWxsIGxpZ2h0c1xuICAgICAgICB0aGlzLmN1bGxTaGFkb3dtYXBzKGNvbXApO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzKGNvbXApIHtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcy51cGRhdGUoY29tcC5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdLCBjb21wLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0sIHRoaXMuc2NlbmUubGlnaHRpbmcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICB1cGRhdGVDbHVzdGVycyhjb21wKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgZW1wdHlXb3JsZENsdXN0ZXJzID0gY29tcC5nZXRFbXB0eVdvcmxkQ2x1c3RlcnModGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBjbHVzdGVyID0gcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnM7XG5cbiAgICAgICAgICAgIGlmIChjbHVzdGVyICYmIGNsdXN0ZXIgIT09IGVtcHR5V29ybGRDbHVzdGVycykge1xuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGVhY2ggY2x1c3RlciBvbmx5IG9uZSB0aW1lXG4gICAgICAgICAgICAgICAgaWYgKCFfdGVtcFNldC5oYXMoY2x1c3RlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBTZXQuYWRkKGNsdXN0ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbcmVuZGVyQWN0aW9uLmxheWVySW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyLnVwZGF0ZShsYXllci5jbHVzdGVyZWRMaWdodHNTZXQsIHRoaXMuc2NlbmUuZ2FtbWFDb3JyZWN0aW9uLCB0aGlzLnNjZW5lLmxpZ2h0aW5nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBrZWVwIHRlbXAgc2V0IGVtcHR5XG4gICAgICAgIF90ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzVGltZSArPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVycyA9IGNvbXAuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBCdWlsZHMgYSBmcmFtZSBncmFwaCBmb3IgdGhlIHJlbmRlcmluZyBvZiB0aGUgd2hvbGUgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZyYW1lR3JhcGh9IGZyYW1lR3JhcGggLSBUaGUgZnJhbWUtZ3JhcGggdGhhdCBpcyBidWlsdC5cbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGxheWVyQ29tcG9zaXRpb24gLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24gdXNlZCB0byBidWlsZCB0aGUgZnJhbWUgZ3JhcGguXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJ1aWxkRnJhbWVHcmFwaChmcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgZnJhbWVHcmFwaC5yZXNldCgpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlKGxheWVyQ29tcG9zaXRpb24pO1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBzaGFkb3cgLyBjb29raWUgYXRsYXMgYWxsb2NhdGlvbiBmb3IgdGhlIHZpc2libGUgbGlnaHRzXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzKGxheWVyQ29tcG9zaXRpb24pO1xuXG4gICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgY29va2llcyBmb3IgYWxsIGxvY2FsIHZpc2libGUgbGlnaHRzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUubGlnaHRpbmcuY29va2llc0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJDb29raWVzKGxheWVyQ29tcG9zaXRpb24uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyQ29va2llcyhsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsICdDbHVzdGVyZWRDb29raWVzJyk7XG4gICAgICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2NhbCBzaGFkb3dzXG4gICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgc2hhZG93cyBmb3IgYWxsIGxvY2FsIHZpc2libGUgbGlnaHRzIC0gdGhlc2Ugc2hhZG93IG1hcHMgYXJlIHNoYXJlZCBieSBhbGwgY2FtZXJhc1xuICAgICAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgfHwgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiB0aGlzLnNjZW5lLmxpZ2h0aW5nLnNoYWRvd3NFbmFibGVkKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyU2hhZG93cyhsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0pO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyU2hhZG93cyhsYXllckNvbXBvc2l0aW9uLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgbGlnaHQgY2x1c3RlcnNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNsdXN0ZXJzKGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmVuZGVyUGFzcy5yZXF1aXJlc0N1YmVtYXBzID0gZmFsc2U7XG4gICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgJ0xvY2FsU2hhZG93TWFwcycpO1xuICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG5cbiAgICAgICAgLy8gbWFpbiBwYXNzZXNcbiAgICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbmV3U3RhcnQgPSB0cnVlO1xuICAgICAgICBsZXQgcmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGxheWVyQ29tcG9zaXRpb24uX3JlbmRlckFjdGlvbnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICAgICAgLy8gc2tpcCBkaXNhYmxlZCBsYXllcnNcbiAgICAgICAgICAgIGlmICghcmVuZGVyQWN0aW9uLmlzTGF5ZXJFbmFibGVkKGxheWVyQ29tcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzRGVwdGhMYXllciA9IGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgY29uc3QgaXNHcmFiUGFzcyA9IGlzRGVwdGhMYXllciAmJiAoY2FtZXJhLnJlbmRlclNjZW5lQ29sb3JNYXAgfHwgY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXApO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCBzaGFkb3dzIGdldCByZS1yZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmFcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uaGFzRGlyZWN0aW9uYWxTaGFkb3dMaWdodHMgJiYgY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyUGFzcyA9IG5ldyBSZW5kZXJQYXNzKHRoaXMuZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc0RpcmVjdGlvbmFsU2hhZG93cyhyZW5kZXJBY3Rpb24sIGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJlbmRlclBhc3MucmVxdWlyZXNDdWJlbWFwcyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgYERpclNoYWRvd01hcGApO1xuICAgICAgICAgICAgICAgIGZyYW1lR3JhcGguYWRkUmVuZGVyUGFzcyhyZW5kZXJQYXNzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RhcnQgb2YgYmxvY2sgb2YgcmVuZGVyIGFjdGlvbnMgcmVuZGVyaW5nIHRvIHRoZSBzYW1lIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIGlmIChuZXdTdGFydCkge1xuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc3RhcnRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgcmVuZGVyVGFyZ2V0ID0gcmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZmluZCB0aGUgbmV4dCBlbmFibGVkIHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgIGxldCBuZXh0SW5kZXggPSBpICsgMTtcbiAgICAgICAgICAgIHdoaWxlIChyZW5kZXJBY3Rpb25zW25leHRJbmRleF0gJiYgIXJlbmRlckFjdGlvbnNbbmV4dEluZGV4XS5pc0xheWVyRW5hYmxlZChsYXllckNvbXBvc2l0aW9uKSkge1xuICAgICAgICAgICAgICAgIG5leHRJbmRleCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpbmZvIGFib3V0IHRoZSBuZXh0IHJlbmRlciBhY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IG5leHRSZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW25leHRJbmRleF07XG4gICAgICAgICAgICBjb25zdCBpc05leHRMYXllckRlcHRoID0gbmV4dFJlbmRlckFjdGlvbiA/IGxheWVyQ29tcG9zaXRpb24ubGF5ZXJMaXN0W25leHRSZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF0uaWQgPT09IExBWUVSSURfREVQVEggOiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGlzTmV4dExheWVyR3JhYlBhc3MgPSBpc05leHRMYXllckRlcHRoICYmIChjYW1lcmEucmVuZGVyU2NlbmVDb2xvck1hcCB8fCBjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCk7XG5cbiAgICAgICAgICAgIC8vIGVuZCBvZiB0aGUgYmxvY2sgdXNpbmcgdGhlIHNhbWUgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgaWYgKCFuZXh0UmVuZGVyQWN0aW9uIHx8IG5leHRSZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ICE9PSByZW5kZXJUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBuZXh0UmVuZGVyQWN0aW9uLmhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzIHx8IGlzTmV4dExheWVyR3JhYlBhc3MgfHwgaXNHcmFiUGFzcykge1xuXG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyIHRoZSByZW5kZXIgYWN0aW9ucyBpbiB0aGUgcmFuZ2VcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1haW5SZW5kZXJQYXNzKGZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24sIHJlbmRlclRhcmdldCwgc3RhcnRJbmRleCwgaSwgaXNHcmFiUGFzcyk7XG5cbiAgICAgICAgICAgICAgICAvLyBwb3N0cHJvY2Vzc2luZ1xuICAgICAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzICYmIGNhbWVyYT8ub25Qb3N0cHJvY2Vzc2luZykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzID0gbmV3IFJlbmRlclBhc3ModGhpcy5kZXZpY2UsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc1Bvc3Rwcm9jZXNzaW5nKHJlbmRlckFjdGlvbiwgbGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJQYXNzLnJlcXVpcmVzQ3ViZW1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShyZW5kZXJQYXNzLCBgUG9zdHByb2Nlc3NgKTtcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVHcmFwaC5hZGRSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG5ld1N0YXJ0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RnJhbWVHcmFwaH0gZnJhbWVHcmFwaCAtIFRoZSBmcmFtZSBncmFwaFxuICAgICAqIEBwYXJhbSB7TGF5ZXJDb21wb3NpdGlvbn0gbGF5ZXJDb21wb3NpdGlvbiAtIFRoZSBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICBhZGRNYWluUmVuZGVyUGFzcyhmcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uLCByZW5kZXJUYXJnZXQsIHN0YXJ0SW5kZXgsIGVuZEluZGV4LCBpc0dyYWJQYXNzKSB7XG5cbiAgICAgICAgLy8gcmVuZGVyIHRoZSByZW5kZXIgYWN0aW9ucyBpbiB0aGUgcmFuZ2VcbiAgICAgICAgY29uc3QgcmFuZ2UgPSB7IHN0YXJ0OiBzdGFydEluZGV4LCBlbmQ6IGVuZEluZGV4IH07XG4gICAgICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyh0aGlzLmRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyhsYXllckNvbXBvc2l0aW9uLCByYW5nZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBsYXllckNvbXBvc2l0aW9uLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBjb25zdCBzdGFydFJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbc3RhcnRJbmRleF07XG4gICAgICAgIGNvbnN0IHN0YXJ0TGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtzdGFydFJlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgY2FtZXJhID0gc3RhcnRMYXllci5jYW1lcmFzW3N0YXJ0UmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICAvLyBkZXB0aCBncmFiIHBhc3Mgb24gd2ViZ2wxIGlzIG5vcm1hbCByZW5kZXIgcGFzcyAoc2NlbmUgZ2V0cyByZS1yZW5kZXJlZClcbiAgICAgICAgY29uc3QgaXNXZWJnbDFEZXB0aEdyYWJQYXNzID0gaXNHcmFiUGFzcyAmJiAhdGhpcy5kZXZpY2Uud2ViZ2wyICYmIGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwO1xuICAgICAgICBjb25zdCBpc1JlYWxQYXNzID0gIWlzR3JhYlBhc3MgfHwgaXNXZWJnbDFEZXB0aEdyYWJQYXNzO1xuXG4gICAgICAgIGlmIChpc1JlYWxQYXNzKSB7XG5cbiAgICAgICAgICAgIHJlbmRlclBhc3MuaW5pdChyZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgcmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCA9IGNhbWVyYS5jYW1lcmEuZnVsbFNpemVDbGVhclJlY3Q7XG5cbiAgICAgICAgICAgIGlmIChpc1dlYmdsMURlcHRoR3JhYlBhc3MpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlYmdsMSBkZXB0aCByZW5kZXJpbmcgY2xlYXIgdmFsdWVzXG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckNvbG9yKHdlYmdsMURlcHRoQ2xlYXJDb2xvcik7XG4gICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckRlcHRoKDEuMCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkgeyAvLyBpZiBjYW1lcmEgcmVuZGVyaW5nIGNvdmVycyB0aGUgZnVsbCB2aWV3cG9ydFxuXG4gICAgICAgICAgICAgICAgaWYgKHN0YXJ0UmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyUGFzcy5zZXRDbGVhckNvbG9yKGNhbWVyYS5jYW1lcmEuY2xlYXJDb2xvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzdGFydFJlbmRlckFjdGlvbi5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJEZXB0aChjYW1lcmEuY2FtZXJhLmNsZWFyRGVwdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhcnRSZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbmRlclBhc3Muc2V0Q2xlYXJTdGVuY2lsKGNhbWVyYS5jYW1lcmEuY2xlYXJTdGVuY2lsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHJlbmRlclBhc3MsIGAke2lzR3JhYlBhc3MgPyAnU2NlbmVHcmFiJyA6ICdSZW5kZXJBY3Rpb24nfSAke3N0YXJ0SW5kZXh9LSR7ZW5kSW5kZXh9IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBDYW06ICR7Y2FtZXJhID8gY2FtZXJhLmVudGl0eS5uYW1lIDogJy0nfWApO1xuICAgICAgICBmcmFtZUdyYXBoLmFkZFJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZShjb21wKSB7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIHRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgc2t5Ym94LCBzaW5jZSB0aGlzIG1pZ2h0IGNoYW5nZSBfbWVzaEluc3RhbmNlc1xuICAgICAgICB0aGlzLnNjZW5lLl91cGRhdGVTa3kodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvbiBpZiBzb21ldGhpbmcgaGFzIGJlZW4gaW52YWxpZGF0ZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IHRoaXMudXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuICAgICAgICBjb25zdCBsaWdodHNDaGFuZ2VkID0gKHVwZGF0ZWQgJiBDT01QVVBEQVRFRF9MSUdIVFMpICE9PSAwO1xuXG4gICAgICAgIHRoaXMudXBkYXRlTGlnaHRTdGF0cyhjb21wLCB1cGRhdGVkKTtcblxuICAgICAgICAvLyBTaW5nbGUgcGVyLWZyYW1lIGNhbGN1bGF0aW9uc1xuICAgICAgICB0aGlzLmJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCk7XG4gICAgICAgIHRoaXMuc2V0U2NlbmVDb25zdGFudHMoKTtcblxuICAgICAgICAvLyB2aXNpYmlsaXR5IGN1bGxpbmcgb2YgbGlnaHRzLCBtZXNoSW5zdGFuY2VzLCBzaGFkb3dzIGNhc3RlcnNcbiAgICAgICAgLy8gYWZ0ZXIgdGhpcyB0aGUgc2NlbmUgY3VsbGluZyBpcyBkb25lIGFuZCBzY3JpcHQgY2FsbGJhY2tzIGNhbiBiZSBjYWxsZWQgdG8gcmVwb3J0IHdoaWNoIG9iamVjdHMgYXJlIHZpc2libGVcbiAgICAgICAgdGhpcy5jdWxsQ29tcG9zaXRpb24oY29tcCk7XG5cbiAgICAgICAgLy8gR1BVIHVwZGF0ZSBmb3IgYWxsIHZpc2libGUgb2JqZWN0c1xuICAgICAgICB0aGlzLmdwdVVwZGF0ZShjb21wLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgcGFzcyBmb3IgZGlyZWN0aW9uYWwgc2hhZG93IG1hcHMgb2YgdGhlIGNhbWVyYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyQWN0aW9ufSByZW5kZXJBY3Rpb24gLSBUaGUgcmVuZGVyIGFjdGlvbi5cbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGxheWVyQ29tcG9zaXRpb24gLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlclBhc3NEaXJlY3Rpb25hbFNoYWRvd3MocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHJlbmRlckFjdGlvbi5kaXJlY3Rpb25hbExpZ2h0cy5sZW5ndGggPiAwKTtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcblxuICAgICAgICB0aGlzLnJlbmRlclNoYWRvd3MocmVuZGVyQWN0aW9uLmRpcmVjdGlvbmFsTGlnaHRzLCBjYW1lcmEuY2FtZXJhKTtcbiAgICB9XG5cbiAgICByZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmcocmVuZGVyQWN0aW9uLCBsYXllckNvbXBvc2l0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4XTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgJiYgY2FtZXJhLm9uUG9zdHByb2Nlc3NpbmcpO1xuXG4gICAgICAgIC8vIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgZm9yIGNhbWVyYVxuICAgICAgICBjYW1lcmEub25Qb3N0cHJvY2Vzc2luZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwYXNzIHJlcHJlc2VudGluZyB0aGUgbGF5ZXIgY29tcG9zaXRpb24ncyByZW5kZXIgYWN0aW9ucyBpbiB0aGUgc3BlY2lmaWVkIHJhbmdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllckNvbXBvc2l0aW9ufSBjb21wIC0gdGhlIGxheWVyIGNvbXBvc2l0aW9uIHRvIHJlbmRlci5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc1JlbmRlckFjdGlvbnMoY29tcCwgcmFuZ2UpIHtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IHJhbmdlLnN0YXJ0OyBpIDw9IHJhbmdlLmVuZDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlbmRlckFjdGlvbihjb21wLCByZW5kZXJBY3Rpb25zW2ldLCBpID09PSByYW5nZS5zdGFydCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0xheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtSZW5kZXJBY3Rpb259IHJlbmRlckFjdGlvbiAtIFRoZSByZW5kZXIgYWN0aW9uLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZmlyc3RSZW5kZXJBY3Rpb24gLSBUcnVlIGlmIHRoaXMgaXMgdGhlIGZpcnN0IHJlbmRlciBhY3Rpb24gaW4gdGhlIHJlbmRlciBwYXNzLlxuICAgICAqL1xuICAgIHJlbmRlclJlbmRlckFjdGlvbihjb21wLCByZW5kZXJBY3Rpb24sIGZpcnN0UmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIC8vIGxheWVyXG4gICAgICAgIGNvbnN0IGxheWVySW5kZXggPSByZW5kZXJBY3Rpb24ubGF5ZXJJbmRleDtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtsYXllckluZGV4XTtcbiAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSBjb21wLnN1YkxheWVyTGlzdFtsYXllckluZGV4XTtcblxuICAgICAgICBjb25zdCBjYW1lcmFQYXNzID0gcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4O1xuICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgIGlmICghcmVuZGVyQWN0aW9uLmlzTGF5ZXJFbmFibGVkKGNvbXApKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGNhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICdub25hbWUnKTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuZGV2aWNlLCBsYXllci5uYW1lKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGRyYXdUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmIChjYW1lcmEpIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIG9uIHRoZSBjYW1lcmEgY29tcG9uZW50IGJlZm9yZSByZW5kZXJpbmcgd2l0aCB0aGlzIGNhbWVyYSBmb3IgdGhlIGZpcnN0IHRpbWUgZHVyaW5nIHRoZSBmcmFtZVxuICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSAmJiBjYW1lcmEub25QcmVSZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEub25QcmVSZW5kZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGwgcHJlcmVuZGVyIGNhbGxiYWNrIGlmIHRoZXJlJ3Mgb25lXG4gICAgICAgIGlmICghdHJhbnNwYXJlbnQgJiYgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUpIHtcbiAgICAgICAgICAgIGxheWVyLm9uUHJlUmVuZGVyT3BhcXVlKGNhbWVyYVBhc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKHRyYW5zcGFyZW50ICYmIGxheWVyLm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgIGxheWVyLm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQoY2FtZXJhUGFzcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsZWQgZm9yIHRoZSBmaXJzdCBzdWJsYXllciBhbmQgZm9yIGV2ZXJ5IGNhbWVyYVxuICAgICAgICBpZiAoIShsYXllci5fcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyAmICgxIDw8IGNhbWVyYVBhc3MpKSkge1xuICAgICAgICAgICAgaWYgKGxheWVyLm9uUHJlUmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIub25QcmVSZW5kZXIoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXllci5fcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyB8PSAxIDw8IGNhbWVyYVBhc3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FtZXJhKSB7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0dXBWaWV3cG9ydChjYW1lcmEuY2FtZXJhLCByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0KTtcblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBub3QgYSBmaXJzdCByZW5kZXIgYWN0aW9uIHRvIHRoZSByZW5kZXIgdGFyZ2V0LCBvciBpZiB0aGUgcmVuZGVyIHRhcmdldCB3YXMgbm90XG4gICAgICAgICAgICAvLyBmdWxseSBjbGVhcmVkIG9uIHBhc3Mgc3RhcnQsIHdlIG5lZWQgdG8gZXhlY3V0ZSBjbGVhcnMgaGVyZVxuICAgICAgICAgICAgaWYgKCFmaXJzdFJlbmRlckFjdGlvbiB8fCAhY2FtZXJhLmNhbWVyYS5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xlYXIocmVuZGVyQWN0aW9uLCBjYW1lcmEuY2FtZXJhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgY29uc3Qgc29ydFRpbWUgPSBub3coKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBsYXllci5fc29ydFZpc2libGUodHJhbnNwYXJlbnQsIGNhbWVyYS5jYW1lcmEubm9kZSwgY2FtZXJhUGFzcyk7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMuX3NvcnRUaW1lICs9IG5vdygpIC0gc29ydFRpbWU7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgY29uc3Qgb2JqZWN0cyA9IGxheWVyLmluc3RhbmNlcztcbiAgICAgICAgICAgIGNvbnN0IHZpc2libGUgPSB0cmFuc3BhcmVudCA/IG9iamVjdHMudmlzaWJsZVRyYW5zcGFyZW50W2NhbWVyYVBhc3NdIDogb2JqZWN0cy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAvLyBhZGQgZGVidWcgbWVzaCBpbnN0YW5jZXMgdG8gdmlzaWJsZSBsaXN0XG4gICAgICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5vblByZVJlbmRlckxheWVyKGxheWVyLCB2aXNpYmxlLCB0cmFuc3BhcmVudCk7XG5cbiAgICAgICAgICAgIC8vIHVwbG9hZCBjbHVzdGVyZWQgbGlnaHRzIHVuaWZvcm1zXG4gICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnMuYWN0aXZhdGUodGhpcy5saWdodFRleHR1cmVBdGxhcyk7XG5cbiAgICAgICAgICAgICAgICAvLyBkZWJ1ZyByZW5kZXJpbmcgb2YgY2x1c3RlcnNcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkICYmIHRoaXMuc2NlbmUubGlnaHRpbmcuZGVidWdMYXllciA9PT0gbGF5ZXIuaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBXb3JsZENsdXN0ZXJzRGVidWcucmVuZGVyKHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzLCB0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgbm90IHZlcnkgY2xldmVyIGdsb2JhbCB2YXJpYWJsZSB3aGljaCBpcyBvbmx5IHVzZWZ1bCB3aGVuIHRoZXJlJ3MganVzdCBvbmUgY2FtZXJhXG4gICAgICAgICAgICB0aGlzLnNjZW5lLl9hY3RpdmVDYW1lcmEgPSBjYW1lcmEuY2FtZXJhO1xuXG4gICAgICAgICAgICB0aGlzLnNldENhbWVyYVVuaWZvcm1zKGNhbWVyYS5jYW1lcmEsIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQsIHJlbmRlckFjdGlvbik7XG5cbiAgICAgICAgICAgIC8vIGVuYWJsZSBmbGlwIGZhY2VzIGlmIGVpdGhlciB0aGUgY2FtZXJhIGhhcyBfZmxpcEZhY2VzIGVuYWJsZWQgb3IgdGhlIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIC8vIGhhcyBmbGlwWSBlbmFibGVkXG4gICAgICAgICAgICBjb25zdCBmbGlwRmFjZXMgPSAhIShjYW1lcmEuY2FtZXJhLl9mbGlwRmFjZXMgXiByZW5kZXJBY3Rpb24/LnJlbmRlclRhcmdldD8uZmxpcFkpO1xuXG4gICAgICAgICAgICBjb25zdCBkcmF3cyA9IHRoaXMuX2ZvcndhcmREcmF3Q2FsbHM7XG4gICAgICAgICAgICB0aGlzLnJlbmRlckZvcndhcmQoY2FtZXJhLmNhbWVyYSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxpc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuX3NwbGl0TGlnaHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnNoYWRlclBhc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuY3VsbGluZ01hc2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25EcmF3Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbGlwRmFjZXMpO1xuICAgICAgICAgICAgbGF5ZXIuX2ZvcndhcmREcmF3Q2FsbHMgKz0gdGhpcy5fZm9yd2FyZERyYXdDYWxscyAtIGRyYXdzO1xuXG4gICAgICAgICAgICAvLyBSZXZlcnQgdGVtcCBmcmFtZSBzdHVmZlxuICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgbm90IGJlIGhlcmUsIGFzIGVhY2ggcmVuZGVyaW5nIC8gY2xlYXJpbmcgc2hvdWxkIGV4cGxpY2l0bHkgc2V0IHVwIHdoYXRcbiAgICAgICAgICAgIC8vIGl0IHJlcXVpcmVzICh0aGUgcHJvcGVydGllcyBhcmUgcGFydCBvZiByZW5kZXIgcGlwZWxpbmUgb24gV2ViR1BVIGFueXdheXMpXG4gICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRTdGVuY2lsVGVzdChmYWxzZSk7IC8vIGRvbid0IGxlYWsgc3RlbmNpbCBzdGF0ZVxuICAgICAgICAgICAgZGV2aWNlLnNldEFscGhhVG9Db3ZlcmFnZShmYWxzZSk7IC8vIGRvbid0IGxlYWsgYTJjIHN0YXRlXG4gICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhCaWFzKGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgb24gdGhlIGNhbWVyYSBjb21wb25lbnQgd2hlbiB3ZSdyZSBkb25lIHJlbmRlcmluZyBhbGwgbGF5ZXJzIHdpdGggdGhpcyBjYW1lcmFcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSAmJiBjYW1lcmEub25Qb3N0UmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLm9uUG9zdFJlbmRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbCBsYXllcidzIHBvc3RyZW5kZXIgY2FsbGJhY2sgaWYgdGhlcmUncyBvbmVcbiAgICAgICAgaWYgKCF0cmFuc3BhcmVudCAmJiBsYXllci5vblBvc3RSZW5kZXJPcGFxdWUpIHtcbiAgICAgICAgICAgIGxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZShjYW1lcmFQYXNzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0cmFuc3BhcmVudCAmJiBsYXllci5vblBvc3RSZW5kZXJUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQoY2FtZXJhUGFzcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxheWVyLm9uUG9zdFJlbmRlciAmJiAhKGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyAmICgxIDw8IGNhbWVyYVBhc3MpKSkge1xuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyICY9IH4odHJhbnNwYXJlbnQgPyAyIDogMSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIub25Qb3N0UmVuZGVyKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyB8PSAxIDw8IGNhbWVyYVBhc3M7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyID0gbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyTWF4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBsYXllci5fcmVuZGVyVGltZSArPSBub3coKSAtIGRyYXdUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG59XG5cbmV4cG9ydCB7IEZvcndhcmRSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbInZpZXdJbnZNYXQiLCJNYXQ0Iiwidmlld01hdCIsInZpZXdNYXQzIiwiTWF0MyIsInZpZXdQcm9qTWF0IiwicHJvak1hdCIsImZsaXBZTWF0Iiwic2V0U2NhbGUiLCJmbGlwcGVkVmlld1Byb2pNYXQiLCJmbGlwcGVkU2t5Ym94UHJvak1hdCIsIndvcmxkTWF0WCIsIlZlYzMiLCJ3b3JsZE1hdFkiLCJ3b3JsZE1hdFoiLCJ3ZWJnbDFEZXB0aENsZWFyQ29sb3IiLCJDb2xvciIsInRlbXBTcGhlcmUiLCJCb3VuZGluZ1NwaGVyZSIsImJvbmVUZXh0dXJlU2l6ZSIsImJvbmVUZXh0dXJlIiwiaW5zdGFuY2luZ0RhdGEiLCJtb2RlbE1hdHJpeCIsImtleUEiLCJrZXlCIiwiX3NraW5VcGRhdGVJbmRleCIsIl9kcmF3Q2FsbExpc3QiLCJkcmF3Q2FsbHMiLCJpc05ld01hdGVyaWFsIiwibGlnaHRNYXNrQ2hhbmdlZCIsIl90ZW1wU2V0IiwiU2V0IiwiRm9yd2FyZFJlbmRlcmVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImNsdXN0ZXJzRGVidWdSZW5kZXJlZCIsImRldmljZSIsInNjZW5lIiwiX3NoYWRvd0RyYXdDYWxscyIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiX3NraW5EcmF3Q2FsbHMiLCJfbnVtRHJhd0NhbGxzQ3VsbGVkIiwiX2luc3RhbmNlZERyYXdDYWxscyIsIl9jYW1lcmFzUmVuZGVyZWQiLCJfbWF0ZXJpYWxTd2l0Y2hlcyIsIl9zaGFkb3dNYXBVcGRhdGVzIiwiX3NoYWRvd01hcFRpbWUiLCJfZGVwdGhNYXBUaW1lIiwiX2ZvcndhcmRUaW1lIiwiX2N1bGxUaW1lIiwiX3NvcnRUaW1lIiwiX3NraW5UaW1lIiwiX21vcnBoVGltZSIsIl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsIl9saWdodENsdXN0ZXJzVGltZSIsIl9saWdodENsdXN0ZXJzIiwibGlnaHRUZXh0dXJlQXRsYXMiLCJMaWdodFRleHR1cmVBdGxhcyIsIl9zaGFkb3dSZW5kZXJlciIsIlNoYWRvd1JlbmRlcmVyIiwiX2Nvb2tpZVJlbmRlcmVyIiwiQ29va2llUmVuZGVyZXIiLCJzY29wZSIsInByb2pJZCIsInJlc29sdmUiLCJwcm9qU2t5Ym94SWQiLCJ2aWV3SWQiLCJ2aWV3SWQzIiwidmlld0ludklkIiwidmlld1Byb2pJZCIsImZsaXBZSWQiLCJ2aWV3UG9zIiwiRmxvYXQzMkFycmF5Iiwidmlld1Bvc0lkIiwibmVhckNsaXBJZCIsImZhckNsaXBJZCIsImNhbWVyYVBhcmFtc0lkIiwidGJuQmFzaXMiLCJmb2dDb2xvcklkIiwiZm9nU3RhcnRJZCIsImZvZ0VuZElkIiwiZm9nRGVuc2l0eUlkIiwibW9kZWxNYXRyaXhJZCIsIm5vcm1hbE1hdHJpeElkIiwicG9zZU1hdHJpeElkIiwiYm9uZVRleHR1cmVJZCIsImJvbmVUZXh0dXJlU2l6ZUlkIiwibW9ycGhXZWlnaHRzQSIsIm1vcnBoV2VpZ2h0c0IiLCJtb3JwaFBvc2l0aW9uVGV4IiwibW9ycGhOb3JtYWxUZXgiLCJtb3JwaFRleFBhcmFtcyIsImFscGhhVGVzdElkIiwib3BhY2l0eU1hcElkIiwiYW1iaWVudElkIiwiZXhwb3N1cmVJZCIsInNreWJveEludGVuc2l0eUlkIiwiY3ViZU1hcFJvdGF0aW9uTWF0cml4SWQiLCJsaWdodENvbG9ySWQiLCJsaWdodERpciIsImxpZ2h0RGlySWQiLCJsaWdodFNoYWRvd01hcElkIiwibGlnaHRTaGFkb3dNYXRyaXhJZCIsImxpZ2h0U2hhZG93UGFyYW1zSWQiLCJsaWdodFNoYWRvd0ludGVuc2l0eSIsImxpZ2h0UmFkaXVzSWQiLCJsaWdodFBvcyIsImxpZ2h0UG9zSWQiLCJsaWdodFdpZHRoIiwibGlnaHRXaWR0aElkIiwibGlnaHRIZWlnaHQiLCJsaWdodEhlaWdodElkIiwibGlnaHRJbkFuZ2xlSWQiLCJsaWdodE91dEFuZ2xlSWQiLCJsaWdodENvb2tpZUlkIiwibGlnaHRDb29raWVJbnRJZCIsImxpZ2h0Q29va2llTWF0cml4SWQiLCJsaWdodENvb2tpZU9mZnNldElkIiwic2hhZG93TWF0cml4UGFsZXR0ZUlkIiwic2hhZG93Q2FzY2FkZURpc3RhbmNlc0lkIiwic2hhZG93Q2FzY2FkZUNvdW50SWQiLCJzY3JlZW5TaXplSWQiLCJfc2NyZWVuU2l6ZSIsInR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkIiwiZm9nQ29sb3IiLCJhbWJpZW50Q29sb3IiLCJjYW1lcmFQYXJhbXMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJkZXN0cm95Iiwic29ydENvbXBhcmUiLCJkcmF3Q2FsbEEiLCJkcmF3Q2FsbEIiLCJsYXllciIsImRyYXdPcmRlciIsInpkaXN0IiwiemRpc3QyIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsInNvcnRDb21wYXJlTWVzaCIsIm1lc2giLCJpZCIsImRlcHRoU29ydENvbXBhcmUiLCJTT1JUS0VZX0RFUFRIIiwidXBkYXRlQ2FtZXJhRnJ1c3R1bSIsImNhbWVyYSIsInhyIiwidmlld3MiLCJsZW5ndGgiLCJ2aWV3IiwibXVsMiIsInZpZXdPZmZNYXQiLCJmcnVzdHVtIiwic2V0RnJvbU1hdDQiLCJwcm9qZWN0aW9uTWF0cml4IiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsIlZJRVdfQ0VOVEVSIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwicG9zIiwiX25vZGUiLCJnZXRQb3NpdGlvbiIsInJvdCIsImdldFJvdGF0aW9uIiwic2V0VFJTIiwiT05FIiwic2V0VmFsdWUiLCJkYXRhIiwiY29weSIsImludmVydCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0Iiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfTUFUNCIsIkJpbmRHcm91cEZvcm1hdCIsIkJpbmRCdWZmZXJGb3JtYXQiLCJVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSIsIlNIQURFUlNUQUdFX1ZFUlRFWCIsIlNIQURFUlNUQUdFX0ZSQUdNRU5UIiwiQmluZFRleHR1cmVGb3JtYXQiLCJURVhUVVJFRElNRU5TSU9OXzJEIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJzZXRDYW1lcmFVbmlmb3JtcyIsInRhcmdldCIsInJlbmRlckFjdGlvbiIsInRyYW5zZm9ybSIsInZpZXdDb3VudCIsInNlc3Npb24iLCJwYXJlbnQiLCJnZXRXb3JsZFRyYW5zZm9ybSIsInYiLCJ2aWV3SW52T2ZmTWF0IiwicHJvalZpZXdPZmZNYXQiLCJwb3NpdGlvbiIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJmbGlwWSIsImRpc3BhdGNoVmlld1BvcyIsIl9uZWFyQ2xpcCIsIl9mYXJDbGlwIiwicGh5c2ljYWxVbml0cyIsImdldEV4cG9zdXJlIiwiZXhwb3N1cmUiLCJuIiwiZiIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsInNldHVwVmlld1VuaWZvcm1CdWZmZXJzIiwic2V0Q2FtZXJhIiwiY2xlYXIiLCJjbGVhclZpZXciLCJEZWJ1ZyIsImFzc2VydCIsInZpZXdCaW5kR3JvdXBzIiwidWIiLCJVbmlmb3JtQnVmZmVyIiwiYmciLCJCaW5kR3JvdXAiLCJwdXNoIiwidmlld0JpbmRHcm91cCIsImRlZmF1bHRVbmlmb3JtQnVmZmVyIiwidXBkYXRlIiwic2V0QmluZEdyb3VwIiwiQklOREdST1VQX1ZJRVciLCJzZXR1cFZpZXdwb3J0IiwicmVuZGVyVGFyZ2V0IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJwaXhlbFdpZHRoIiwid2lkdGgiLCJwaXhlbEhlaWdodCIsImhlaWdodCIsInJlY3QiLCJ4IiwiTWF0aCIsImZsb29yIiwieSIsInciLCJ6IiwiaCIsInNldFZpZXdwb3J0IiwiX3NjaXNzb3JSZWN0Q2xlYXIiLCJzY2lzc29yUmVjdCIsInNldFNjaXNzb3IiLCJwb3BHcHVNYXJrZXIiLCJjb2xvciIsIl9jbGVhckNvbG9yIiwiciIsImciLCJiIiwiYSIsImRlcHRoIiwiX2NsZWFyRGVwdGgiLCJzdGVuY2lsIiwiX2NsZWFyU3RlbmNpbCIsImZsYWdzIiwiY2xlYXJDb2xvciIsIkNMRUFSRkxBR19DT0xPUiIsImNsZWFyRGVwdGgiLCJDTEVBUkZMQUdfREVQVEgiLCJjbGVhclN0ZW5jaWwiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImZvcmNlV3JpdGUiLCJzZXRSZW5kZXJUYXJnZXQiLCJ1cGRhdGVCZWdpbiIsInNldENvbG9yV3JpdGUiLCJzZXREZXB0aFdyaXRlIiwib3B0aW9ucyIsIl9jbGVhck9wdGlvbnMiLCJfY2xlYXJDb2xvckJ1ZmZlciIsIl9jbGVhckRlcHRoQnVmZmVyIiwiX2NsZWFyU3RlbmNpbEJ1ZmZlciIsImRpc3BhdGNoR2xvYmFsTGlnaHRzIiwiYW1iaWVudExpZ2h0IiwiZ2FtbWFDb3JyZWN0aW9uIiwiaSIsInBvdyIsImFtYmllbnRMdW1pbmFuY2UiLCJza3lib3hMdW1pbmFuY2UiLCJza3lib3hJbnRlbnNpdHkiLCJfc2t5Ym94Um90YXRpb25NYXQzIiwiX3Jlc29sdmVMaWdodCIsImxpZ2h0Iiwic2V0TFRDRGlyZWN0aW9uYWxMaWdodCIsInd0bSIsImNudCIsImRpciIsImNhbXBvcyIsImZhciIsImhXaWR0aCIsInRyYW5zZm9ybVZlY3RvciIsImhIZWlnaHQiLCJkaXNwYXRjaERpcmVjdExpZ2h0cyIsImRpcnMiLCJtYXNrIiwiZGlyZWN0aW9uYWwiLCJfbGluZWFyRmluYWxDb2xvciIsIl9maW5hbENvbG9yIiwiZ2V0WSIsIl9kaXJlY3Rpb24iLCJtdWxTY2FsYXIiLCJub3JtYWxpemUiLCJzaGFwZSIsIkxJR0hUU0hBUEVfUFVOQ1RVQUwiLCJmYXJDbGlwIiwiY2FzdFNoYWRvd3MiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwic2hhZG93QnVmZmVyIiwic2hhZG93TWF0cml4IiwiX3NoYWRvd01hdHJpeFBhbGV0dGUiLCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlcyIsIm51bUNhc2NhZGVzIiwic2hhZG93SW50ZW5zaXR5IiwicGFyYW1zIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dSZXNvbHV0aW9uIiwibm9ybWFsQmlhcyIsImJpYXMiLCJzZXRMVENQb3NpdGlvbmFsTGlnaHQiLCJkaXNwYXRjaE9tbmlMaWdodCIsIm9tbmkiLCJhdHRlbnVhdGlvbkVuZCIsImdldFRyYW5zbGF0aW9uIiwiX3Bvc2l0aW9uIiwiX2Nvb2tpZSIsImNvb2tpZUludGVuc2l0eSIsImRpc3BhdGNoU3BvdExpZ2h0Iiwic3BvdCIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImNvb2tpZU1hdHJpeCIsIkxpZ2h0Q2FtZXJhIiwiZXZhbFNwb3RDb29raWVNYXRyaXgiLCJfY29va2llVHJhbnNmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0iLCJfY29va2llT2Zmc2V0VW5pZm9ybSIsIl9jb29raWVPZmZzZXQiLCJkaXNwYXRjaExvY2FsTGlnaHRzIiwic29ydGVkTGlnaHRzIiwidXNlZERpckxpZ2h0cyIsInN0YXRpY0xpZ2h0TGlzdCIsIm9tbmlzIiwiTElHSFRUWVBFX09NTkkiLCJudW1PbW5pcyIsImlzU3RhdGljIiwic3RhdGljSWQiLCJfdHlwZSIsInNwdHMiLCJMSUdIVFRZUEVfU1BPVCIsIm51bVNwdHMiLCJjdWxsIiwidmlzaWJsZUxpc3QiLCJjdWxsVGltZSIsIm5vdyIsIm51bURyYXdDYWxsc0N1bGxlZCIsInZpc2libGVMZW5ndGgiLCJkcmF3Q2FsbHNDb3VudCIsImN1bGxpbmdNYXNrIiwiZnJ1c3R1bUN1bGxpbmciLCJkcmF3Q2FsbCIsInZpc2libGUiLCJjb21tYW5kIiwidmlzaWJsZVRoaXNGcmFtZSIsIl9pc1Zpc2libGUiLCJjdWxsTGlnaHRzIiwibGlnaHRzIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwiZW5hYmxlZCIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImdldEJvdW5kaW5nU3BoZXJlIiwiY29udGFpbnNTcGhlcmUiLCJ1c2VQaHlzaWNhbFVuaXRzIiwic2NyZWVuU2l6ZSIsImdldFNjcmVlblNpemUiLCJtYXhTY3JlZW5TaXplIiwibWF4Iiwic2hhZG93TWFwIiwidXBkYXRlQ3B1U2tpbk1hdHJpY2VzIiwic2tpblRpbWUiLCJzaSIsInNraW5JbnN0YW5jZSIsInVwZGF0ZU1hdHJpY2VzIiwibm9kZSIsIl9kaXJ0eSIsInVwZGF0ZUdwdVNraW5NYXRyaWNlcyIsInNraW4iLCJ1cGRhdGVNYXRyaXhQYWxldHRlIiwidXBkYXRlTW9ycGhpbmciLCJtb3JwaFRpbWUiLCJtb3JwaEluc3QiLCJtb3JwaEluc3RhbmNlIiwic2V0QmFzZUNvbnN0YW50cyIsIm1hdGVyaWFsIiwic2V0Q3VsbE1vZGUiLCJvcGFjaXR5TWFwIiwiYWxwaGFUZXN0Iiwic2V0U2tpbm5pbmciLCJtZXNoSW5zdGFuY2UiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsIm1hdHJpeFBhbGV0dGUiLCJkcmF3SW5zdGFuY2UiLCJzdHlsZSIsIm5vcm1hbCIsIm5hbWUiLCJjb3VudCIsInNldFZlcnRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlciIsImRyYXciLCJwcmltaXRpdmUiLCJ3b3JsZFRyYW5zZm9ybSIsIm5vcm1hbE1hdHJpeCIsImRyYXdJbnN0YW5jZTIiLCJ1bmRlZmluZWQiLCJyZW5kZXJTaGFkb3dzIiwiaXNDbHVzdGVyZWQiLCJzaGFkb3dNYXBTdGFydFRpbWUiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwiYXRsYXNTbG90VXBkYXRlZCIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfTk9ORSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJyZW5kZXIiLCJyZW5kZXJDb29raWVzIiwiY29va2llUmVuZGVyVGFyZ2V0IiwiY3VsbEZhY2VzIiwiZmxpcCIsIm1vZGUiLCJDVUxMRkFDRV9OT05FIiwiZmxpcEZhY2VzIiwiQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLIiwid3QiLCJnZXRYIiwiZ2V0WiIsImNyb3NzIiwiZG90IiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9CQUNLIiwid3QyIiwic2V0VmVydGV4QnVmZmVycyIsInNldE1vcnBoaW5nIiwibW9ycGgiLCJ1c2VUZXh0dXJlTW9ycGgiLCJ2ZXJ0ZXhCdWZmZXJJZHMiLCJ0ZXh0dXJlUG9zaXRpb25zIiwidGV4dHVyZU5vcm1hbHMiLCJfdGV4dHVyZVBhcmFtcyIsInQiLCJfYWN0aXZlVmVydGV4QnVmZmVycyIsInZiIiwic2VtYW50aWMiLCJTRU1BTlRJQ19BVFRSIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJzY29wZUlkIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0EiLCJfc2hhZGVyTW9ycGhXZWlnaHRzQiIsInZwIiwicmVuZGVyRm9yd2FyZFByZXBhcmVNYXRlcmlhbHMiLCJwYXNzIiwiYWRkQ2FsbCIsImxpZ2h0SGFzaCIsIl9saWdodEhhc2giLCJwcmV2TWF0ZXJpYWwiLCJwcmV2T2JqRGVmcyIsInByZXZTdGF0aWMiLCJwcmV2TGlnaHRNYXNrIiwic2tpcFJlbmRlckNhbWVyYSIsIl9za2lwUmVuZGVyQ291bnRlciIsInNraXBSZW5kZXJBZnRlciIsImVuc3VyZU1hdGVyaWFsIiwib2JqRGVmcyIsIl9zaGFkZXJEZWZzIiwibGlnaHRNYXNrIiwiX3NjZW5lIiwiZGlydHkiLCJ1cGRhdGVVbmlmb3JtcyIsIl9kaXJ0eUJsZW5kIiwibGF5ZXJzIiwiX3NoYWRlciIsInZhcmlhbnRLZXkiLCJ2YXJpYW50cyIsInVwZGF0ZVBhc3NTaGFkZXIiLCJfc3RhdGljTGlnaHRMaXN0IiwicmVuZGVyRm9yd2FyZEludGVybmFsIiwicHJlcGFyZWRDYWxscyIsImRyYXdDYWxsYmFjayIsInBhc3NGbGFnIiwicHJlcGFyZWRDYWxsc0NvdW50IiwibmV3TWF0ZXJpYWwiLCJzaGFkZXIiLCJmYWlsZWQiLCJzZXRTaGFkZXIiLCJlcnJvciIsInNldFBhcmFtZXRlcnMiLCJzZXRCbGVuZGluZyIsImJsZW5kIiwic2VwYXJhdGVBbHBoYUJsZW5kIiwic2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlIiwiYmxlbmRTcmMiLCJibGVuZERzdCIsImJsZW5kU3JjQWxwaGEiLCJibGVuZERzdEFscGhhIiwic2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlIiwiYmxlbmRFcXVhdGlvbiIsImJsZW5kQWxwaGFFcXVhdGlvbiIsInNldEJsZW5kRnVuY3Rpb24iLCJzZXRCbGVuZEVxdWF0aW9uIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsImRlcHRoV3JpdGUiLCJkZXB0aFRlc3QiLCJzZXREZXB0aEZ1bmMiLCJGVU5DX0FMV0FZUyIsInNldERlcHRoVGVzdCIsImRlcHRoRnVuYyIsInNldEFscGhhVG9Db3ZlcmFnZSIsImFscGhhVG9Db3ZlcmFnZSIsImRlcHRoQmlhcyIsInNsb3BlRGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiX2N1bGxGYWNlcyIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwic2V0U3RlbmNpbFRlc3QiLCJzZXRTdGVuY2lsRnVuYyIsImZ1bmMiLCJyZWYiLCJyZWFkTWFzayIsInNldFN0ZW5jaWxPcGVyYXRpb24iLCJmYWlsIiwiemZhaWwiLCJ6cGFzcyIsIndyaXRlTWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQiLCJTVEVOQ0lMT1BfS0VFUCIsInNldFN0ZW5jaWxGdW5jQmFjayIsInNldFN0ZW5jaWxPcGVyYXRpb25CYWNrIiwibWVzaEJpbmRHcm91cCIsImdldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9NRVNIIiwicmVuZGVyU3R5bGUiLCJzZXRJbmRleEJ1ZmZlciIsImluZGV4QnVmZmVyIiwidmlld3BvcnQiLCJwYXJhbWV0ZXJzIiwicmVuZGVyRm9yd2FyZCIsImFsbERyYXdDYWxscyIsImFsbERyYXdDYWxsc0NvdW50IiwiZm9yd2FyZFN0YXJ0VGltZSIsInVwZGF0ZVNoYWRlcnMiLCJvbmx5TGl0U2hhZGVycyIsIm1hdCIsImhhcyIsImFkZCIsImdldFNoYWRlclZhcmlhbnQiLCJNYXRlcmlhbCIsInByb3RvdHlwZSIsInVzZUxpZ2h0aW5nIiwiZW1pdHRlciIsImxpZ2h0aW5nIiwiY2xlYXJWYXJpYW50cyIsImJlZ2luRnJhbWUiLCJjb21wIiwibGlnaHRzQ2hhbmdlZCIsIm1lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlcyIsIl9zaGFkZXJWZXJzaW9uIiwibWlDb3VudCIsIl9saWdodHMiLCJsaWdodENvdW50IiwidXBkYXRlTGF5ZXJDb21wb3NpdGlvbiIsImxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwibGVuIiwibGF5ZXJMaXN0IiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwic2hhZGVyVmVyc2lvbiIsIl9yZW5kZXJUaW1lIiwiX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJfcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJ0cmFuc3BhcmVudCIsInN1YkxheWVyTGlzdCIsIl9wb3N0UmVuZGVyQ291bnRlck1heCIsImoiLCJjYW1lcmFzIiwiaW5zdGFuY2VzIiwicHJlcGFyZSIsIl9uZWVkc1N0YXRpY1ByZXBhcmUiLCJfc3RhdGljTGlnaHRIYXNoIiwiX3N0YXRpY1ByZXBhcmVEb25lIiwiU3RhdGljTWVzaGVzIiwicmV2ZXJ0Iiwib3BhcXVlTWVzaEluc3RhbmNlcyIsInRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyIsInVwZGF0ZWQiLCJfdXBkYXRlIiwiZ3B1VXBkYXRlIiwic2V0U2NlbmVDb25zdGFudHMiLCJmb2ciLCJGT0dfTk9ORSIsIkZPR19MSU5FQVIiLCJmb2dTdGFydCIsImZvZ0VuZCIsImZvZ0RlbnNpdHkiLCJ1cGRhdGVMaWdodFN0YXRzIiwiY29tcFVwZGF0ZWRGbGFncyIsIkNPTVBVUERBVEVEX0xJR0hUUyIsIl9zdGF0c1VwZGF0ZWQiLCJzdGF0cyIsIl9zdGF0cyIsImR5bmFtaWNMaWdodHMiLCJiYWtlZExpZ2h0cyIsImwiLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJNQVNLX0JBS0UiLCJDT01QVVBEQVRFRF9JTlNUQU5DRVMiLCJjdWxsU2hhZG93bWFwcyIsImNhc3RlcnMiLCJfbGlnaHRDb21wb3NpdGlvbkRhdGEiLCJzaGFkb3dDYXN0ZXJzTGlzdCIsImN1bGxMb2NhbCIsInJlbmRlckFjdGlvbnMiLCJfcmVuZGVyQWN0aW9ucyIsImRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcyIsImxpZ2h0SW5kZXgiLCJjdWxsRGlyZWN0aW9uYWwiLCJjdWxsQ29tcG9zaXRpb24iLCJsYXllckluZGV4Iiwic3ViTGF5ZXJFbmFibGVkIiwiY2FtZXJhUGFzcyIsImNhbWVyYUluZGV4IiwiZnJhbWVVcGRhdGUiLCJmaXJzdENhbWVyYVVzZSIsIm9iamVjdHMiLCJ2aXNpYmxlVHJhbnNwYXJlbnQiLCJ2aXNpYmxlT3BhcXVlIiwiZG9uZSIsIm9uUHJlQ3VsbCIsImxpc3QiLCJvblBvc3RDdWxsIiwidXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMiLCJfc3BsaXRMaWdodHMiLCJ1cGRhdGVDbHVzdGVycyIsInN0YXJ0VGltZSIsImVtcHR5V29ybGRDbHVzdGVycyIsImdldEVtcHR5V29ybGRDbHVzdGVycyIsImNsdXN0ZXIiLCJsaWdodENsdXN0ZXJzIiwiY2x1c3RlcmVkTGlnaHRzU2V0IiwiX3dvcmxkQ2x1c3RlcnMiLCJidWlsZEZyYW1lR3JhcGgiLCJmcmFtZUdyYXBoIiwibGF5ZXJDb21wb3NpdGlvbiIsInJlc2V0IiwicmVuZGVyUGFzcyIsIlJlbmRlclBhc3MiLCJjb29raWVzRW5hYmxlZCIsInJlcXVpcmVzQ3ViZW1hcHMiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJhZGRSZW5kZXJQYXNzIiwic2hhZG93c0VuYWJsZWQiLCJzdGFydEluZGV4IiwibmV3U3RhcnQiLCJpc0xheWVyRW5hYmxlZCIsImlzRGVwdGhMYXllciIsIkxBWUVSSURfREVQVEgiLCJpc0dyYWJQYXNzIiwicmVuZGVyU2NlbmVDb2xvck1hcCIsInJlbmRlclNjZW5lRGVwdGhNYXAiLCJoYXNEaXJlY3Rpb25hbFNoYWRvd0xpZ2h0cyIsInJlbmRlclBhc3NEaXJlY3Rpb25hbFNoYWRvd3MiLCJuZXh0SW5kZXgiLCJuZXh0UmVuZGVyQWN0aW9uIiwiaXNOZXh0TGF5ZXJEZXB0aCIsImlzTmV4dExheWVyR3JhYlBhc3MiLCJhZGRNYWluUmVuZGVyUGFzcyIsInRyaWdnZXJQb3N0cHJvY2VzcyIsIm9uUG9zdHByb2Nlc3NpbmciLCJyZW5kZXJQYXNzUG9zdHByb2Nlc3NpbmciLCJlbmRJbmRleCIsInJhbmdlIiwic3RhcnQiLCJlbmQiLCJyZW5kZXJQYXNzUmVuZGVyQWN0aW9ucyIsInN0YXJ0UmVuZGVyQWN0aW9uIiwic3RhcnRMYXllciIsImlzV2ViZ2wxRGVwdGhHcmFiUGFzcyIsIndlYmdsMiIsImlzUmVhbFBhc3MiLCJpbml0IiwiZnVsbFNpemVDbGVhclJlY3QiLCJzZXRDbGVhckNvbG9yIiwic2V0Q2xlYXJEZXB0aCIsInNldENsZWFyU3RlbmNpbCIsImVudGl0eSIsIl91cGRhdGVTa3kiLCJkaXJlY3Rpb25hbExpZ2h0cyIsInJlbmRlclJlbmRlckFjdGlvbiIsImZpcnN0UmVuZGVyQWN0aW9uIiwiZHJhd1RpbWUiLCJvblByZVJlbmRlciIsIm9uUHJlUmVuZGVyT3BhcXVlIiwib25QcmVSZW5kZXJUcmFuc3BhcmVudCIsInNvcnRUaW1lIiwiX3NvcnRWaXNpYmxlIiwiaW1tZWRpYXRlIiwib25QcmVSZW5kZXJMYXllciIsImFjdGl2YXRlIiwiZGVidWdMYXllciIsIldvcmxkQ2x1c3RlcnNEZWJ1ZyIsIl9hY3RpdmVDYW1lcmEiLCJfZmxpcEZhY2VzIiwiZHJhd3MiLCJzaGFkZXJQYXNzIiwib25EcmF3Q2FsbCIsImxhc3RDYW1lcmFVc2UiLCJvblBvc3RSZW5kZXIiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJUcmFuc3BhcmVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTBEQSxNQUFNQSxVQUFVLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDN0IsTUFBTUMsT0FBTyxHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBQzFCLE1BQU1FLFFBQVEs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
