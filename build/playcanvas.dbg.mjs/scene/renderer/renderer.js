/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, DEVICETYPE_WEBGPU, CULLFACE_NONE, CULLFACE_FRONTANDBACK, CULLFACE_FRONT, CULLFACE_BACK, UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, BINDGROUP_VIEW, SEMANTIC_ATTR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat, BindTextureFormat } from '../../platform/graphics/bind-group-format.js';
import { ShadowMapCache } from './shadow-map-cache.js';
import { ShadowRendererLocal } from './shadow-renderer-local.js';
import { ShadowRendererDirectional } from './shadow-renderer-directional.js';
import { CookieRenderer } from './cookie-renderer.js';
import { StaticMeshes } from './static-meshes.js';

let _skinUpdateIndex = 0;
const boneTextureSize = [0, 0, 0, 0];
const viewProjMat = new Mat4();
const viewInvMat = new Mat4();
const viewMat = new Mat4();
const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();
const viewMat3 = new Mat3();
const tempSphere = new BoundingSphere();
const _flipYMat = new Mat4().setScale(1, -1, 1);

const _fixProjRangeMat = new Mat4().set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);
const _tempProjMat0 = new Mat4();
const _tempProjMat1 = new Mat4();
const _tempProjMat2 = new Mat4();
const _tempProjMat3 = new Mat4();
const _tempSet = new Set();

class Renderer {

  constructor(graphicsDevice) {
    this.clustersDebugRendered = false;
    this.device = graphicsDevice;

    this.scene = null;

    this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);

    this.shadowMapCache = new ShadowMapCache();
    this._shadowRendererLocal = new ShadowRendererLocal(this, this.lightTextureAtlas);
    this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.lightTextureAtlas);

    this._cookieRenderer = new CookieRenderer(graphicsDevice, this.lightTextureAtlas);
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;

    this._skinTime = 0;
    this._morphTime = 0;
    this._cullTime = 0;
    this._shadowMapTime = 0;
    this._lightClustersTime = 0;
    this._layerCompositionUpdateTime = 0;

    this._shadowDrawCalls = 0;
    this._skinDrawCalls = 0;
    this._instancedDrawCalls = 0;
    this._shadowMapUpdates = 0;
    this._numDrawCallsCulled = 0;
    this._camerasRendered = 0;
    this._lightClusters = 0;

    const scope = graphicsDevice.scope;
    this.boneTextureId = scope.resolve('texture_poseMap');
    this.boneTextureSizeId = scope.resolve('texture_poseMapSize');
    this.poseMatrixId = scope.resolve('matrix_pose[0]');
    this.modelMatrixId = scope.resolve('matrix_model');
    this.normalMatrixId = scope.resolve('matrix_normal');
    this.viewInvId = scope.resolve('matrix_viewInverse');
    this.viewPos = new Float32Array(3);
    this.viewPosId = scope.resolve('view_position');
    this.projId = scope.resolve('matrix_projection');
    this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
    this.viewId = scope.resolve('matrix_view');
    this.viewId3 = scope.resolve('matrix_view3');
    this.viewProjId = scope.resolve('matrix_viewProjection');
    this.flipYId = scope.resolve('projectionFlipY');
    this.tbnBasis = scope.resolve('tbnBasis');
    this.nearClipId = scope.resolve('camera_near');
    this.farClipId = scope.resolve('camera_far');
    this.cameraParams = new Float32Array(4);
    this.cameraParamsId = scope.resolve('camera_params');
    this.alphaTestId = scope.resolve('alpha_ref');
    this.opacityMapId = scope.resolve('texture_opacityMap');
    this.exposureId = scope.resolve('exposure');
    this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');
    this.morphWeightsA = scope.resolve('morph_weights_a');
    this.morphWeightsB = scope.resolve('morph_weights_b');
    this.morphPositionTex = scope.resolve('morphPositionTex');
    this.morphNormalTex = scope.resolve('morphNormalTex');
    this.morphTexParams = scope.resolve('morph_tex_params');
  }
  destroy() {
    this._shadowRendererLocal = null;
    this._shadowRendererDirectional = null;
    this.shadowMapCache.destroy();
    this.shadowMapCache = null;
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

    const keyA = drawCallA._key[SORTKEY_FORWARD];
    const keyB = drawCallB._key[SORTKEY_FORWARD];
    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
      return drawCallB.mesh.id - drawCallA.mesh.id;
    }
    return keyB - keyA;
  }
  sortCompareDepth(drawCallA, drawCallB) {
    const keyA = drawCallA._key[SORTKEY_DEPTH];
    const keyB = drawCallB._key[SORTKEY_DEPTH];
    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
      return drawCallB.mesh.id - drawCallA.mesh.id;
    }
    return keyB - keyA;
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
    const flags = (renderAction.clearColor ? CLEARFLAG_COLOR : 0) | (renderAction.clearDepth ? CLEARFLAG_DEPTH : 0) | (renderAction.clearStencil ? CLEARFLAG_STENCIL : 0);
    if (flags) {
      const device = this.device;
      DebugGraphics.pushGpuMarker(device, 'CLEAR-VIEWPORT');
      device.clear({
        color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
        depth: camera._clearDepth,
        stencil: camera._clearStencil,
        flags: flags
      });
      DebugGraphics.popGpuMarker(device);
    }
  }
  setCameraUniforms(camera, target, renderAction) {
    const flipY = target == null ? void 0 : target.flipY;
    let viewCount = 1;
    if (camera.xr && camera.xr.session) {
      let transform;
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
      let projMat = camera.projectionMatrix;
      if (camera.calculateProjection) {
        camera.calculateProjection(projMat, VIEW_CENTER);
      }
      let projMatSkybox = camera.getProjectionMatrixSkybox();

      if (flipY) {
        projMat = _tempProjMat0.mul2(_flipYMat, projMat);
        projMatSkybox = _tempProjMat1.mul2(_flipYMat, projMatSkybox);
      }

      if (this.device.deviceType === DEVICETYPE_WEBGPU) {
        projMat = _tempProjMat2.mul2(_fixProjRangeMat, projMat);
        projMatSkybox = _tempProjMat3.mul2(_fixProjRangeMat, projMatSkybox);
      }
      this.projId.setValue(projMat.data);
      this.projSkyboxId.setValue(projMatSkybox.data);

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
      this.viewProjId.setValue(viewProjMat.data);
      this.flipYId.setValue(flipY ? -1 : 1);

      this.dispatchViewPos(camera._node.getPosition());
      camera.frustum.setFromMat4(viewProjMat);
    }
    this.tbnBasis.setValue(flipY ? -1 : 1);

    const n = camera._nearClip;
    const f = camera._farClip;
    this.nearClipId.setValue(n);
    this.farClipId.setValue(f);

    this.cameraParams[0] = 1 / f;
    this.cameraParams[1] = f;
    this.cameraParams[2] = n;
    this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
    this.cameraParamsId.setValue(this.cameraParams);

    this.exposureId.setValue(this.scene.physicalUnits ? camera.getExposure() : this.scene.exposure);
    if (this.device.supportsUniformBuffers) {
      this.setupViewUniformBuffers(renderAction, viewCount);
    }
  }

  setCamera(camera, target, clear, renderAction = null) {
    this.setCameraUniforms(camera, target, renderAction);
    this.clearView(camera, target, clear, false);
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
      this.twoSidedLightingNegScaleFactorId.setValue(worldMatX.dot(worldMatZ) < 0 ? -1.0 : 1.0);
    }
  }
  updateCameraFrustum(camera) {
    if (camera.xr && camera.xr.views.length) {
      const view = camera.xr.views[0];
      viewProjMat.mul2(view.projMat, view.viewOffMat);
      camera.frustum.setFromMat4(viewProjMat);
      return;
    }
    const projMat = camera.projectionMatrix;
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
  setBaseConstants(device, material) {
    device.setCullMode(material.cull);

    if (material.opacityMap) {
      this.opacityMapId.setValue(material.opacityMap);
      this.alphaTestId.setValue(material.alphaTest);
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
    const count = drawCalls.length;
    for (let i = 0; i < count; i++) {
      const drawCall = drawCalls[i];
      if (drawCall.visibleThisFrame) {
        const skin = drawCall.skinInstance;
        if (skin && skin._dirty) {
          skin.updateMatrixPalette(drawCall.node, _skinUpdateIndex);
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
      const drawCall = drawCalls[i];
      const morphInst = drawCall.morphInstance;
      if (morphInst && morphInst._dirty && drawCall.visibleThisFrame) {
        morphInst.update();
      }
    }
    this._morphTime += now() - morphTime;
  }
  gpuUpdate(drawCalls) {
    this.updateGpuSkinMatrices(drawCalls);
    this.updateMorphing(drawCalls);
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
  setSkinning(device, meshInstance) {
    if (meshInstance.skinInstance) {
      this._skinDrawCalls++;
      if (device.supportsBoneTextures) {
        const boneTexture = meshInstance.skinInstance.boneTexture;
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

  dispatchViewPos(position) {
    const vp = this.viewPos;
    vp[0] = position.x;
    vp[1] = position.y;
    vp[2] = position.z;
    this.viewPosId.setValue(vp);
  }
  initViewBindGroupFormat() {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      this.viewUniformFormat = new UniformBufferFormat(this.device, [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)]);

      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)], [new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
    }
  }
  setupViewUniformBuffers(renderAction, viewCount) {
    Debug.assert(renderAction, "RenderAction cannot be null");
    if (renderAction) {
      const device = this.device;
      Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");
      while (renderAction.viewBindGroups.length < viewCount) {
        const ub = new UniformBuffer(device, this.viewUniformFormat);
        const bg = new BindGroup(device, this.viewBindGroupFormat, ub);
        DebugHelper.setName(bg, `ViewBindGroup_${bg.id}`);
        renderAction.viewBindGroups.push(bg);
      }

      const viewBindGroup = renderAction.viewBindGroups[0];
      viewBindGroup.defaultUniformBuffer.update();
      viewBindGroup.update();

      device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
    }
  }
  drawInstance(device, meshInstance, mesh, style, normal) {
    DebugGraphics.pushGpuMarker(device, meshInstance.node.name);
    const instancingData = meshInstance.instancingData;
    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.setVertexBuffer(instancingData.vertexBuffer);
        device.draw(mesh.primitive[style], instancingData.count);
      }
    } else {
      const modelMatrix = meshInstance.node.worldTransform;
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
    const instancingData = meshInstance.instancingData;
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

  cullShadowmaps(comp) {
    for (let i = 0; i < comp._lights.length; i++) {
      const light = comp._lights[i];
      if (light._type !== LIGHTTYPE_DIRECTIONAL) {
        if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
          const casters = comp._lightCompositionData[i].shadowCastersList;
          this._shadowRendererLocal.cull(light, casters);
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
        this._shadowRendererDirectional.cull(light, casters, renderAction.camera.camera);
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
  renderCookies(lights) {
    const cookieRenderTarget = this.lightTextureAtlas.cookieRenderTarget;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];

      if (!light.atlasViewportAllocated) continue;

      if (!light.atlasSlotUpdated) continue;
      this._cookieRenderer.render(light, cookieRenderTarget);
    }
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
  baseUpdate() {
    this.clustersDebugRendered = false;
    this.initViewBindGroupFormat();
  }
}

export { Renderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctc3BoZXJlLmpzJztcblxuaW1wb3J0IHtcbiAgICBTT1JUS0VZX0RFUFRILCBTT1JUS0VZX0ZPUldBUkQsXG4gICAgVklFV19DRU5URVIsIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURPV1VQREFURV9OT05FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQge1xuICAgIERFVklDRVRZUEVfV0VCR1BVLFxuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBCSU5ER1JPVVBfVklFVywgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsXG4gICAgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBTSEFERVJTVEFHRV9WRVJURVgsIFNIQURFUlNUQUdFX0ZSQUdNRU5ULFxuICAgIFNFTUFOVElDX0FUVFIsXG4gICAgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX0ZST05UQU5EQkFDSywgQ1VMTEZBQ0VfTk9ORSxcbiAgICBURVhUVVJFRElNRU5TSU9OXzJELCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVFxufSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBCaW5kR3JvdXAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLmpzJztcbmltcG9ydCB7IFVuaWZvcm1Gb3JtYXQsIFVuaWZvcm1CdWZmZXJGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnO1xuaW1wb3J0IHsgQmluZEdyb3VwRm9ybWF0LCBCaW5kQnVmZmVyRm9ybWF0LCBCaW5kVGV4dHVyZUZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJztcblxuaW1wb3J0IHsgU2hhZG93TWFwQ2FjaGUgfSBmcm9tICcuL3NoYWRvdy1tYXAtY2FjaGUuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXJMb2NhbCB9IGZyb20gJy4vc2hhZG93LXJlbmRlcmVyLWxvY2FsLmpzJztcbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgfSBmcm9tICcuL3NoYWRvdy1yZW5kZXJlci1kaXJlY3Rpb25hbC5qcyc7XG5pbXBvcnQgeyBDb29raWVSZW5kZXJlciB9IGZyb20gJy4vY29va2llLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFN0YXRpY01lc2hlcyB9IGZyb20gJy4vc3RhdGljLW1lc2hlcy5qcyc7XG5cbmxldCBfc2tpblVwZGF0ZUluZGV4ID0gMDtcbmNvbnN0IGJvbmVUZXh0dXJlU2l6ZSA9IFswLCAwLCAwLCAwXTtcbmNvbnN0IHZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdJbnZNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld01hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB3b3JsZE1hdFggPSBuZXcgVmVjMygpO1xuY29uc3Qgd29ybGRNYXRZID0gbmV3IFZlYzMoKTtcbmNvbnN0IHdvcmxkTWF0WiA9IG5ldyBWZWMzKCk7XG5jb25zdCB2aWV3TWF0MyA9IG5ldyBNYXQzKCk7XG5jb25zdCB0ZW1wU3BoZXJlID0gbmV3IEJvdW5kaW5nU3BoZXJlKCk7XG5jb25zdCBfZmxpcFlNYXQgPSBuZXcgTWF0NCgpLnNldFNjYWxlKDEsIC0xLCAxKTtcblxuLy8gQ29udmVydHMgYSBwcm9qZWN0aW9uIG1hdHJpeCBpbiBPcGVuR0wgc3R5bGUgKGRlcHRoIHJhbmdlIG9mIC0xLi4xKSB0byBhIERpcmVjdFggc3R5bGUgKGRlcHRoIHJhbmdlIG9mIDAuLjEpLlxuY29uc3QgX2ZpeFByb2pSYW5nZU1hdCA9IG5ldyBNYXQ0KCkuc2V0KFtcbiAgICAxLCAwLCAwLCAwLFxuICAgIDAsIDEsIDAsIDAsXG4gICAgMCwgMCwgMC41LCAwLFxuICAgIDAsIDAsIDAuNSwgMVxuXSk7XG5cbmNvbnN0IF90ZW1wUHJvak1hdDAgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0MSA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQyID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wUHJvak1hdDMgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogVGhlIGJhc2UgcmVuZGVyZXIgZnVuY3Rpb25hbGl0eSB0byBhbGxvdyBpbXBsZW1lbnRhdGlvbiBvZiBzcGVjaWFsaXplZCByZW5kZXJlcnMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJlciB7XG4gICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgIGNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSByZW5kZXJlci5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfG51bGx9ICovXG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuXG4gICAgICAgIC8vIHRleHR1cmUgYXRsYXMgbWFuYWdpbmcgc2hhZG93IG1hcCAvIGNvb2tpZSB0ZXh0dXJlIGF0bGFzc2luZyBmb3Igb21uaSBhbmQgc3BvdCBsaWdodHNcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG5ldyBMaWdodFRleHR1cmVBdGxhcyhncmFwaGljc0RldmljZSk7XG5cbiAgICAgICAgLy8gc2hhZG93c1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbmV3IFNoYWRvd01hcENhY2hlKCk7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwgPSBuZXcgU2hhZG93UmVuZGVyZXJMb2NhbCh0aGlzLCB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCA9IG5ldyBTaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsKHRoaXMsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuXG4gICAgICAgIC8vIGNvb2tpZXNcbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIgPSBuZXcgQ29va2llUmVuZGVyZXIoZ3JhcGhpY3NEZXZpY2UsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuXG4gICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBudWxsO1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBudWxsO1xuXG4gICAgICAgIC8vIHRpbWluZ1xuICAgICAgICB0aGlzLl9za2luVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX21vcnBoVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1bGxUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnNUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSAwO1xuXG4gICAgICAgIC8vIHN0YXRzXG4gICAgICAgIHRoaXMuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkb3dNYXBVcGRhdGVzID0gMDtcbiAgICAgICAgdGhpcy5fbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgdGhpcy5fY2FtZXJhc1JlbmRlcmVkID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVycyA9IDA7XG5cbiAgICAgICAgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBncmFwaGljc0RldmljZS5zY29wZTtcbiAgICAgICAgdGhpcy5ib25lVGV4dHVyZUlkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9wb3NlTWFwJyk7XG4gICAgICAgIHRoaXMuYm9uZVRleHR1cmVTaXplSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX3Bvc2VNYXBTaXplJyk7XG4gICAgICAgIHRoaXMucG9zZU1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Bvc2VbMF0nKTtcblxuICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbW9kZWwnKTtcbiAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9ub3JtYWwnKTtcbiAgICAgICAgdGhpcy52aWV3SW52SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlld0ludmVyc2UnKTtcbiAgICAgICAgdGhpcy52aWV3UG9zID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQgPSBzY29wZS5yZXNvbHZlKCd2aWV3X3Bvc2l0aW9uJyk7XG4gICAgICAgIHRoaXMucHJvaklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Byb2plY3Rpb24nKTtcbiAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcHJvamVjdGlvblNreWJveCcpO1xuICAgICAgICB0aGlzLnZpZXdJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3Jyk7XG4gICAgICAgIHRoaXMudmlld0lkMyA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3MycpO1xuICAgICAgICB0aGlzLnZpZXdQcm9qSWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlld1Byb2plY3Rpb24nKTtcbiAgICAgICAgdGhpcy5mbGlwWUlkID0gc2NvcGUucmVzb2x2ZSgncHJvamVjdGlvbkZsaXBZJyk7XG4gICAgICAgIHRoaXMudGJuQmFzaXMgPSBzY29wZS5yZXNvbHZlKCd0Ym5CYXNpcycpO1xuICAgICAgICB0aGlzLm5lYXJDbGlwSWQgPSBzY29wZS5yZXNvbHZlKCdjYW1lcmFfbmVhcicpO1xuICAgICAgICB0aGlzLmZhckNsaXBJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9mYXInKTtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc0lkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX3BhcmFtcycpO1xuXG4gICAgICAgIHRoaXMuYWxwaGFUZXN0SWQgPSBzY29wZS5yZXNvbHZlKCdhbHBoYV9yZWYnKTtcbiAgICAgICAgdGhpcy5vcGFjaXR5TWFwSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcblxuICAgICAgICB0aGlzLmV4cG9zdXJlSWQgPSBzY29wZS5yZXNvbHZlKCdleHBvc3VyZScpO1xuICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkID0gc2NvcGUucmVzb2x2ZSgndHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yJyk7XG5cbiAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNBID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfd2VpZ2h0c19hJyk7XG4gICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQiA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3dlaWdodHNfYicpO1xuICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXggPSBzY29wZS5yZXNvbHZlKCdtb3JwaFBvc2l0aW9uVGV4Jyk7XG4gICAgICAgIHRoaXMubW9ycGhOb3JtYWxUZXggPSBzY29wZS5yZXNvbHZlKCdtb3JwaE5vcm1hbFRleCcpO1xuICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfdGV4X3BhcmFtcycpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwgPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBudWxsO1xuICAgIH1cblxuICAgIHNvcnRDb21wYXJlKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGlmIChkcmF3Q2FsbEEubGF5ZXIgPT09IGRyYXdDYWxsQi5sYXllcikge1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsQS5kcmF3T3JkZXIgJiYgZHJhd0NhbGxCLmRyYXdPcmRlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEEuZHJhd09yZGVyIC0gZHJhd0NhbGxCLmRyYXdPcmRlcjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZHJhd0NhbGxBLnpkaXN0ICYmIGRyYXdDYWxsQi56ZGlzdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEIuemRpc3QgLSBkcmF3Q2FsbEEuemRpc3Q7IC8vIGJhY2sgdG8gZnJvbnRcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZHJhd0NhbGxBLnpkaXN0MiAmJiBkcmF3Q2FsbEIuemRpc3QyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS56ZGlzdDIgLSBkcmF3Q2FsbEIuemRpc3QyOyAvLyBmcm9udCB0byBiYWNrXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9GT1JXQVJEXSAtIGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgfVxuXG4gICAgc29ydENvbXBhcmVNZXNoKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGlmIChkcmF3Q2FsbEEubGF5ZXIgPT09IGRyYXdDYWxsQi5sYXllcikge1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsQS5kcmF3T3JkZXIgJiYgZHJhd0NhbGxCLmRyYXdPcmRlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEEuZHJhd09yZGVyIC0gZHJhd0NhbGxCLmRyYXdPcmRlcjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZHJhd0NhbGxBLnpkaXN0ICYmIGRyYXdDYWxsQi56ZGlzdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEIuemRpc3QgLSBkcmF3Q2FsbEEuemRpc3Q7IC8vIGJhY2sgdG8gZnJvbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGtleUEgPSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgICAgICBjb25zdCBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcblxuICAgICAgICBpZiAoa2V5QSA9PT0ga2V5QiAmJiBkcmF3Q2FsbEEubWVzaCAmJiBkcmF3Q2FsbEIubWVzaCkge1xuICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi5tZXNoLmlkIC0gZHJhd0NhbGxBLm1lc2guaWQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ga2V5QiAtIGtleUE7XG4gICAgfVxuXG4gICAgc29ydENvbXBhcmVEZXB0aChkcmF3Q2FsbEEsIGRyYXdDYWxsQikge1xuICAgICAgICBjb25zdCBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9ERVBUSF07XG4gICAgICAgIGNvbnN0IGtleUIgPSBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0RFUFRIXTtcblxuICAgICAgICBpZiAoa2V5QSA9PT0ga2V5QiAmJiBkcmF3Q2FsbEEubWVzaCAmJiBkcmF3Q2FsbEIubWVzaCkge1xuICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi5tZXNoLmlkIC0gZHJhd0NhbGxBLm1lc2guaWQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ga2V5QiAtIGtleUE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHVwIHRoZSB2aWV3cG9ydCBhbmQgdGhlIHNjaXNzb3IgZm9yIGNhbWVyYSByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY2FtZXJhLmpzJykuQ2FtZXJhfSBjYW1lcmEgLSBUaGUgY2FtZXJhIGNvbnRhaW5pbmcgdGhlIHZpZXdwb3J0XG4gICAgICogaW5mb3JtYXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IFtyZW5kZXJUYXJnZXRdIC0gVGhlXG4gICAgICogcmVuZGVyIHRhcmdldC4gTlVMTCBmb3IgdGhlIGRlZmF1bHQgb25lLlxuICAgICAqL1xuICAgIHNldHVwVmlld3BvcnQoY2FtZXJhLCByZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ1NFVFVQLVZJRVdQT1JUJyk7XG5cbiAgICAgICAgY29uc3QgcGl4ZWxXaWR0aCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgcGl4ZWxIZWlnaHQgPSByZW5kZXJUYXJnZXQgPyByZW5kZXJUYXJnZXQuaGVpZ2h0IDogZGV2aWNlLmhlaWdodDtcblxuICAgICAgICBjb25zdCByZWN0ID0gY2FtZXJhLnJlY3Q7XG4gICAgICAgIGxldCB4ID0gTWF0aC5mbG9vcihyZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgbGV0IHkgPSBNYXRoLmZsb29yKHJlY3QueSAqIHBpeGVsSGVpZ2h0KTtcbiAgICAgICAgbGV0IHcgPSBNYXRoLmZsb29yKHJlY3QueiAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgaCA9IE1hdGguZmxvb3IocmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBkZXZpY2Uuc2V0Vmlld3BvcnQoeCwgeSwgdywgaCk7XG5cbiAgICAgICAgLy8gYnkgZGVmYXVsdCBjbGVhciBpcyB1c2luZyB2aWV3cG9ydCByZWN0YW5nbGUuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldCwgdXNpbmcgY3VycmVudGx5IHNldCB1cCB2aWV3cG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9yZW5kZXItYWN0aW9uLmpzJykuUmVuZGVyQWN0aW9ufSByZW5kZXJBY3Rpb24gLSBSZW5kZXIgYWN0aW9uXG4gICAgICogY29udGFpbmluZyB0aGUgY2xlYXIgZmxhZ3MuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NhbWVyYS5qcycpLkNhbWVyYX0gY2FtZXJhIC0gQ2FtZXJhIGNvbnRhaW5pbmcgdGhlIGNsZWFyIHZhbHVlcy5cbiAgICAgKi9cbiAgICBjbGVhcihyZW5kZXJBY3Rpb24sIGNhbWVyYSkge1xuXG4gICAgICAgIGNvbnN0IGZsYWdzID0gKHJlbmRlckFjdGlvbi5jbGVhckNvbG9yID8gQ0xFQVJGTEFHX0NPTE9SIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgIChyZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCA/IENMRUFSRkxBR19ERVBUSCA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAocmVuZGVyQWN0aW9uLmNsZWFyU3RlbmNpbCA/IENMRUFSRkxBR19TVEVOQ0lMIDogMCk7XG5cbiAgICAgICAgaWYgKGZsYWdzKSB7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXUE9SVCcpO1xuXG4gICAgICAgICAgICBkZXZpY2UuY2xlYXIoe1xuICAgICAgICAgICAgICAgIGNvbG9yOiBbY2FtZXJhLl9jbGVhckNvbG9yLnIsIGNhbWVyYS5fY2xlYXJDb2xvci5nLCBjYW1lcmEuX2NsZWFyQ29sb3IuYiwgY2FtZXJhLl9jbGVhckNvbG9yLmFdLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBjYW1lcmEuX2NsZWFyRGVwdGgsXG4gICAgICAgICAgICAgICAgc3RlbmNpbDogY2FtZXJhLl9jbGVhclN0ZW5jaWwsXG4gICAgICAgICAgICAgICAgZmxhZ3M6IGZsYWdzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldENhbWVyYVVuaWZvcm1zKGNhbWVyYSwgdGFyZ2V0LCByZW5kZXJBY3Rpb24pIHtcblxuICAgICAgICAvLyBmbGlwcGluZyBwcm9qIG1hdHJpeFxuICAgICAgICBjb25zdCBmbGlwWSA9IHRhcmdldD8uZmxpcFk7XG5cbiAgICAgICAgbGV0IHZpZXdDb3VudCA9IDE7XG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24pIHtcbiAgICAgICAgICAgIGxldCB0cmFuc2Zvcm07XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBjYW1lcmEuX25vZGUucGFyZW50O1xuICAgICAgICAgICAgaWYgKHBhcmVudClcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm0gPSBwYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG4gICAgICAgICAgICB2aWV3Q291bnQgPSB2aWV3cy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdDb3VudDsgdisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdJbnZPZmZNYXQubXVsMih0cmFuc2Zvcm0sIHZpZXcudmlld0ludk1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld09mZk1hdC5jb3B5KHZpZXcudmlld0ludk9mZk1hdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3SW52T2ZmTWF0LmNvcHkodmlldy52aWV3SW52TWF0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3T2ZmTWF0LmNvcHkodmlldy52aWV3TWF0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2aWV3LnZpZXdNYXQzLnNldEZyb21NYXQ0KHZpZXcudmlld09mZk1hdCk7XG4gICAgICAgICAgICAgICAgdmlldy5wcm9qVmlld09mZk1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcblxuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMF0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxMl07XG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblsxXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzEzXTtcbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzJdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTRdO1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlldy5wcm9qVmlld09mZk1hdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIFByb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICBsZXQgcHJvak1hdCA9IGNhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgICAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24ocHJvak1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHByb2pNYXRTa3lib3ggPSBjYW1lcmEuZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCgpO1xuXG4gICAgICAgICAgICAvLyBmbGlwIHByb2plY3Rpb24gbWF0cmljZXNcbiAgICAgICAgICAgIGlmIChmbGlwWSkge1xuICAgICAgICAgICAgICAgIHByb2pNYXQgPSBfdGVtcFByb2pNYXQwLm11bDIoX2ZsaXBZTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0MS5tdWwyKF9mbGlwWU1hdCwgcHJvak1hdFNreWJveCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBkZXB0aCByYW5nZSBvZiBwcm9qZWN0aW9uIG1hdHJpY2VzICgtMS4uMSB0byAwLi4xKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR1BVKSB7XG4gICAgICAgICAgICAgICAgcHJvak1hdCA9IF90ZW1wUHJvak1hdDIubXVsMihfZml4UHJvalJhbmdlTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0My5tdWwyKF9maXhQcm9qUmFuZ2VNYXQsIHByb2pNYXRTa3lib3gpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZShwcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUocHJvak1hdFNreWJveC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld0ludmVyc2UgTWF0cml4XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkLnNldFZhbHVlKHZpZXdNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgM3gzXG4gICAgICAgICAgICB2aWV3TWF0My5zZXRGcm9tTWF0NCh2aWV3TWF0KTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkMy5zZXRWYWx1ZSh2aWV3TWF0My5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld1Byb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKHZpZXdQcm9qTWF0LmRhdGEpO1xuXG4gICAgICAgICAgICB0aGlzLmZsaXBZSWQuc2V0VmFsdWUoZmxpcFkgPyAtMSA6IDEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IFBvc2l0aW9uICh3b3JsZCBzcGFjZSlcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hWaWV3UG9zKGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50Ym5CYXNpcy5zZXRWYWx1ZShmbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgLy8gTmVhciBhbmQgZmFyIGNsaXAgdmFsdWVzXG4gICAgICAgIGNvbnN0IG4gPSBjYW1lcmEuX25lYXJDbGlwO1xuICAgICAgICBjb25zdCBmID0gY2FtZXJhLl9mYXJDbGlwO1xuICAgICAgICB0aGlzLm5lYXJDbGlwSWQuc2V0VmFsdWUobik7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkLnNldFZhbHVlKGYpO1xuXG4gICAgICAgIC8vIGNhbWVyYSBwYXJhbXNcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMF0gPSAxIC8gZjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMV0gPSBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1syXSA9IG47XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzNdID0gY2FtZXJhLnByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID8gMSA6IDA7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zSWQuc2V0VmFsdWUodGhpcy5jYW1lcmFQYXJhbXMpO1xuXG4gICAgICAgIC8vIGV4cG9zdXJlXG4gICAgICAgIHRoaXMuZXhwb3N1cmVJZC5zZXRWYWx1ZSh0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHMgPyBjYW1lcmEuZ2V0RXhwb3N1cmUoKSA6IHRoaXMuc2NlbmUuZXhwb3N1cmUpO1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHJlbmRlckFjdGlvbiwgdmlld0NvdW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG1ha2Ugc3VyZSBjb2xvcldyaXRlIGlzIHNldCB0byB0cnVlIHRvIGFsbCBjaGFubmVscywgaWYgeW91IHdhbnQgdG8gZnVsbHkgY2xlYXIgdGhlIHRhcmdldFxuICAgIC8vIFRPRE86IHRoaXMgZnVuY3Rpb24gaXMgb25seSB1c2VkIGZyb20gb3V0c2lkZSBvZiBmb3J3YXJkIHJlbmRlcmVyLCBhbmQgc2hvdWxkIGJlIGRlcHJlY2F0ZWRcbiAgICAvLyB3aGVuIHRoZSBmdW5jdGlvbmFsaXR5IG1vdmVzIHRvIHRoZSByZW5kZXIgcGFzc2VzLiBOb3RlIHRoYXQgRWRpdG9yIHVzZXMgaXQgYXMgd2VsbC5cbiAgICBzZXRDYW1lcmEoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCByZW5kZXJBY3Rpb24gPSBudWxsKSB7XG5cbiAgICAgICAgdGhpcy5zZXRDYW1lcmFVbmlmb3JtcyhjYW1lcmEsIHRhcmdldCwgcmVuZGVyQWN0aW9uKTtcbiAgICAgICAgdGhpcy5jbGVhclZpZXcoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogdGhpcyBpcyBjdXJyZW50bHkgdXNlZCBieSB0aGUgbGlnaHRtYXBwZXIgYW5kIHRoZSBFZGl0b3IsXG4gICAgLy8gYW5kIHdpbGwgYmUgcmVtb3ZlZCB3aGVuIHRob3NlIGNhbGwgYXJlIHJlbW92ZWQuXG4gICAgY2xlYXJWaWV3KGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgZm9yY2VXcml0ZSkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnQ0xFQVItVklFVycpO1xuXG4gICAgICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICAgICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICAgICAgaWYgKGZvcmNlV3JpdGUpIHtcbiAgICAgICAgICAgIGRldmljZS5zZXRDb2xvcldyaXRlKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgZGV2aWNlLnNldERlcHRoV3JpdGUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldHVwVmlld3BvcnQoY2FtZXJhLCB0YXJnZXQpO1xuXG4gICAgICAgIGlmIChjbGVhcikge1xuICAgICAgICAgICAgLy8gdXNlIGNhbWVyYSBjbGVhciBvcHRpb25zIGlmIGFueVxuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IGNhbWVyYS5fY2xlYXJPcHRpb25zO1xuXG4gICAgICAgICAgICBkZXZpY2UuY2xlYXIob3B0aW9ucyA/IG9wdGlvbnMgOiB7XG4gICAgICAgICAgICAgICAgY29sb3I6IFtjYW1lcmEuX2NsZWFyQ29sb3IuciwgY2FtZXJhLl9jbGVhckNvbG9yLmcsIGNhbWVyYS5fY2xlYXJDb2xvci5iLCBjYW1lcmEuX2NsZWFyQ29sb3IuYV0sXG4gICAgICAgICAgICAgICAgZGVwdGg6IGNhbWVyYS5fY2xlYXJEZXB0aCxcbiAgICAgICAgICAgICAgICBmbGFnczogKGNhbWVyYS5fY2xlYXJDb2xvckJ1ZmZlciA/IENMRUFSRkxBR19DT0xPUiA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAgKGNhbWVyYS5fY2xlYXJEZXB0aEJ1ZmZlciA/IENMRUFSRkxBR19ERVBUSCA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAgKGNhbWVyYS5fY2xlYXJTdGVuY2lsQnVmZmVyID8gQ0xFQVJGTEFHX1NURU5DSUwgOiAwKSxcbiAgICAgICAgICAgICAgICBzdGVuY2lsOiBjYW1lcmEuX2NsZWFyU3RlbmNpbFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIHNldEN1bGxNb2RlKGN1bGxGYWNlcywgZmxpcCwgZHJhd0NhbGwpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBkcmF3Q2FsbC5tYXRlcmlhbDtcbiAgICAgICAgbGV0IG1vZGUgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICBpZiAoY3VsbEZhY2VzKSB7XG4gICAgICAgICAgICBsZXQgZmxpcEZhY2VzID0gMTtcblxuICAgICAgICAgICAgaWYgKG1hdGVyaWFsLmN1bGwgPiBDVUxMRkFDRV9OT05FICYmIG1hdGVyaWFsLmN1bGwgPCBDVUxMRkFDRV9GUk9OVEFOREJBQ0spIHtcbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuZmxpcEZhY2VzKVxuICAgICAgICAgICAgICAgICAgICBmbGlwRmFjZXMgKj0gLTE7XG5cbiAgICAgICAgICAgICAgICBpZiAoZmxpcClcbiAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzICo9IC0xO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgd3QgPSBkcmF3Q2FsbC5ub2RlLndvcmxkVHJhbnNmb3JtO1xuICAgICAgICAgICAgICAgIHd0LmdldFgod29ybGRNYXRYKTtcbiAgICAgICAgICAgICAgICB3dC5nZXRZKHdvcmxkTWF0WSk7XG4gICAgICAgICAgICAgICAgd3QuZ2V0Wih3b3JsZE1hdFopO1xuICAgICAgICAgICAgICAgIHdvcmxkTWF0WC5jcm9zcyh3b3JsZE1hdFgsIHdvcmxkTWF0WSk7XG4gICAgICAgICAgICAgICAgaWYgKHdvcmxkTWF0WC5kb3Qod29ybGRNYXRaKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZmxpcEZhY2VzICo9IC0xO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsaXBGYWNlcyA8IDApIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbCA9PT0gQ1VMTEZBQ0VfRlJPTlQgPyBDVUxMRkFDRV9CQUNLIDogQ1VMTEZBQ0VfRlJPTlQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1vZGUgPSBtYXRlcmlhbC5jdWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGV2aWNlLnNldEN1bGxNb2RlKG1vZGUpO1xuXG4gICAgICAgIGlmIChtb2RlID09PSBDVUxMRkFDRV9OT05FICYmIG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX05PTkUpIHtcbiAgICAgICAgICAgIGNvbnN0IHd0MiA9IGRyYXdDYWxsLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICB3dDIuZ2V0WCh3b3JsZE1hdFgpO1xuICAgICAgICAgICAgd3QyLmdldFkod29ybGRNYXRZKTtcbiAgICAgICAgICAgIHd0Mi5nZXRaKHdvcmxkTWF0Wik7XG4gICAgICAgICAgICB3b3JsZE1hdFguY3Jvc3Mod29ybGRNYXRYLCB3b3JsZE1hdFkpO1xuICAgICAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZC5zZXRWYWx1ZSh3b3JsZE1hdFguZG90KHdvcmxkTWF0WikgPCAwID8gLTEuMCA6IDEuMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVDYW1lcmFGcnVzdHVtKGNhbWVyYSkge1xuXG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnZpZXdzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGZydXN0dW0gYmFzZWQgb24gWFIgdmlld1xuICAgICAgICAgICAgY29uc3QgdmlldyA9IGNhbWVyYS54ci52aWV3c1swXTtcbiAgICAgICAgICAgIHZpZXdQcm9qTWF0Lm11bDIodmlldy5wcm9qTWF0LCB2aWV3LnZpZXdPZmZNYXQpO1xuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJvak1hdCA9IGNhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24pIHtcbiAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKHByb2pNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKHZpZXdJbnZNYXQsIFZJRVdfQ0VOVEVSKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBvcyA9IGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3Qgcm90ID0gY2FtZXJhLl9ub2RlLmdldFJvdGF0aW9uKCk7XG4gICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICB2aWV3TWF0LmNvcHkodmlld0ludk1hdCkuaW52ZXJ0KCk7XG5cbiAgICAgICAgdmlld1Byb2pNYXQubXVsMihwcm9qTWF0LCB2aWV3TWF0KTtcbiAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgIH1cblxuICAgIHNldEJhc2VDb25zdGFudHMoZGV2aWNlLCBtYXRlcmlhbCkge1xuXG4gICAgICAgIC8vIEN1bGwgbW9kZVxuICAgICAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUobWF0ZXJpYWwuY3VsbCk7XG5cbiAgICAgICAgLy8gQWxwaGEgdGVzdFxuICAgICAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCkge1xuICAgICAgICAgICAgdGhpcy5vcGFjaXR5TWFwSWQuc2V0VmFsdWUobWF0ZXJpYWwub3BhY2l0eU1hcCk7XG4gICAgICAgICAgICB0aGlzLmFscGhhVGVzdElkLnNldFZhbHVlKG1hdGVyaWFsLmFscGhhVGVzdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVDcHVTa2luTWF0cmljZXMoZHJhd0NhbGxzKSB7XG5cbiAgICAgICAgX3NraW5VcGRhdGVJbmRleCsrO1xuXG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgaWYgKGRyYXdDYWxsc0NvdW50ID09PSAwKSByZXR1cm47XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNpID0gZHJhd0NhbGxzW2ldLnNraW5JbnN0YW5jZTtcbiAgICAgICAgICAgIGlmIChzaSkge1xuICAgICAgICAgICAgICAgIHNpLnVwZGF0ZU1hdHJpY2VzKGRyYXdDYWxsc1tpXS5ub2RlLCBfc2tpblVwZGF0ZUluZGV4KTtcbiAgICAgICAgICAgICAgICBzaS5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9za2luVGltZSArPSBub3coKSAtIHNraW5UaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICB1cGRhdGVHcHVTa2luTWF0cmljZXMoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2tpblRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgY291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBza2luID0gZHJhd0NhbGwuc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgICAgIGlmIChza2luICYmIHNraW4uX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHNraW4udXBkYXRlTWF0cml4UGFsZXR0ZShkcmF3Q2FsbC5ub2RlLCBfc2tpblVwZGF0ZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgc2tpbi5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscykge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IG1vcnBoVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBjb25zdCBtb3JwaEluc3QgPSBkcmF3Q2FsbC5tb3JwaEluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdCAmJiBtb3JwaEluc3QuX2RpcnR5ICYmIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgICAgICBtb3JwaEluc3QudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9tb3JwaFRpbWUgKz0gbm93KCkgLSBtb3JwaFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGdwdVVwZGF0ZShkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gc2tpcCBldmVyeXRoaW5nIHdpdGggdmlzaWJsZVRoaXNGcmFtZSA9PT0gZmFsc2VcbiAgICAgICAgdGhpcy51cGRhdGVHcHVTa2luTWF0cmljZXMoZHJhd0NhbGxzKTtcbiAgICAgICAgdGhpcy51cGRhdGVNb3JwaGluZyhkcmF3Q2FsbHMpO1xuICAgIH1cblxuICAgIHNldFZlcnRleEJ1ZmZlcnMoZGV2aWNlLCBtZXNoKSB7XG5cbiAgICAgICAgLy8gbWFpbiB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobWVzaC52ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHNldE1vcnBoaW5nKGRldmljZSwgbW9ycGhJbnN0YW5jZSkge1xuXG4gICAgICAgIGlmIChtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgIGlmIChtb3JwaEluc3RhbmNlLm1vcnBoLnVzZVRleHR1cmVNb3JwaCkge1xuXG4gICAgICAgICAgICAgICAgLy8gdmVydGV4IGJ1ZmZlciB3aXRoIHZlcnRleCBpZHNcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VmVydGV4QnVmZmVyKG1vcnBoSW5zdGFuY2UubW9ycGgudmVydGV4QnVmZmVySWRzKTtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFBvc2l0aW9uVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZVBvc2l0aW9ucyk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaE5vcm1hbFRleC5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLnRleHR1cmVOb3JtYWxzKTtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFRleFBhcmFtcy5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl90ZXh0dXJlUGFyYW1zKTtcblxuICAgICAgICAgICAgfSBlbHNlIHsgICAgLy8gdmVydGV4IGF0dHJpYnV0ZXMgYmFzZWQgbW9ycGhpbmdcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IHQgPSAwOyB0IDwgbW9ycGhJbnN0YW5jZS5fYWN0aXZlVmVydGV4QnVmZmVycy5sZW5ndGg7IHQrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZiID0gbW9ycGhJbnN0YW5jZS5fYWN0aXZlVmVydGV4QnVmZmVyc1t0XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhdGNoIHNlbWFudGljIGZvciB0aGUgYnVmZmVyIHRvIGN1cnJlbnQgQVRUUiBzbG90ICh1c2luZyBBVFRSOCAtIEFUVFIxNSByYW5nZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gU0VNQU5USUNfQVRUUiArICh0ICsgOCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0ubmFtZSA9IHNlbWFudGljO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIuZm9ybWF0LmVsZW1lbnRzWzBdLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShzZW1hbnRpYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIodmIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IGFsbCA4IHdlaWdodHNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Euc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNCLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3NoYWRlck1vcnBoV2VpZ2h0c0IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2tpbm5pbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMrKztcbiAgICAgICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib25lVGV4dHVyZSA9IG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UuYm9uZVRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZUlkLnNldFZhbHVlKGJvbmVUZXh0dXJlKTtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMF0gPSBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMV0gPSBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzJdID0gMS4wIC8gYm9uZVRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzNdID0gMS4wIC8gYm9uZVRleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmVTaXplSWQuc2V0VmFsdWUoYm9uZVRleHR1cmVTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5tYXRyaXhQYWxldHRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldHMgVmVjMyBjYW1lcmEgcG9zaXRpb24gdW5pZm9ybVxuICAgIGRpc3BhdGNoVmlld1Bvcyhwb3NpdGlvbikge1xuICAgICAgICBjb25zdCB2cCA9IHRoaXMudmlld1BvczsgICAgLy8gbm90ZSB0aGF0IHRoaXMgcmV1c2VzIGFuIGFycmF5XG4gICAgICAgIHZwWzBdID0gcG9zaXRpb24ueDtcbiAgICAgICAgdnBbMV0gPSBwb3NpdGlvbi55O1xuICAgICAgICB2cFsyXSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZwKTtcbiAgICB9XG5cbiAgICBpbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpIHtcblxuICAgICAgICBpZiAodGhpcy5kZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycyAmJiAhdGhpcy52aWV3VW5pZm9ybUZvcm1hdCkge1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdCh0aGlzLmRldmljZSwgW1xuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwibWF0cml4X3ZpZXdQcm9qZWN0aW9uXCIsIFVOSUZPUk1UWVBFX01BVDQpXG4gICAgICAgICAgICBdKTtcblxuICAgICAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSB2aWV3IGJpbmQgZ3JvdXAgLSBjb250YWlucyBzaW5nbGUgdW5pZm9ybSBidWZmZXIsIGFuZCBzb21lIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnbGlnaHRzVGV4dHVyZUZsb2F0JywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUKVxuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyhyZW5kZXJBY3Rpb24sIHZpZXdDb3VudCkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChyZW5kZXJBY3Rpb24sIFwiUmVuZGVyQWN0aW9uIGNhbm5vdCBiZSBudWxsXCIpO1xuICAgICAgICBpZiAocmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZpZXdDb3VudCA9PT0gMSwgXCJUaGlzIGNvZGUgZG9lcyBub3QgaGFuZGxlIHRoZSB2aWV3Q291bnQgeWV0XCIpO1xuXG4gICAgICAgICAgICB3aGlsZSAocmVuZGVyQWN0aW9uLnZpZXdCaW5kR3JvdXBzLmxlbmd0aCA8IHZpZXdDb3VudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHViID0gbmV3IFVuaWZvcm1CdWZmZXIoZGV2aWNlLCB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBiZyA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQsIHViKTtcbiAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKGJnLCBgVmlld0JpbmRHcm91cF8ke2JnLmlkfWApO1xuICAgICAgICAgICAgICAgIHJlbmRlckFjdGlvbi52aWV3QmluZEdyb3Vwcy5wdXNoKGJnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIHZpZXcgYmluZCBncm91cCAvIHVuaWZvcm1zXG4gICAgICAgICAgICBjb25zdCB2aWV3QmluZEdyb3VwID0gcmVuZGVyQWN0aW9uLnZpZXdCaW5kR3JvdXBzWzBdO1xuICAgICAgICAgICAgdmlld0JpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgICAgIHZpZXdCaW5kR3JvdXAudXBkYXRlKCk7XG5cbiAgICAgICAgICAgIC8vIFRPRE87IHRoaXMgbmVlZHMgdG8gYmUgbW92ZWQgdG8gZHJhd0luc3RhbmNlIGZ1bmN0aW9ucyB0byBoYW5kbGUgWFJcbiAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX1ZJRVcsIHZpZXdCaW5kR3JvdXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZHJhd0luc3RhbmNlKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSwgbm9ybWFsKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgbWVzaEluc3RhbmNlLm5vZGUubmFtZSk7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2luZ0RhdGEgPSBtZXNoSW5zdGFuY2UuaW5zdGFuY2luZ0RhdGE7XG4gICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YSkge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIoaW5zdGFuY2luZ0RhdGEudmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIGluc3RhbmNpbmdEYXRhLmNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG1vZGVsTWF0cml4ID0gbWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQuc2V0VmFsdWUobW9kZWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGlmIChub3JtYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLm5vcm1hbE1hdHJpeC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLy8gdXNlZCBmb3Igc3RlcmVvXG4gICAgZHJhd0luc3RhbmNlMihkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXRyaWNlcyBhcmUgYWxyZWFkeSBzZXRcbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgY3VsbChjYW1lcmEsIGRyYXdDYWxscywgdmlzaWJsZUxpc3QpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBjdWxsVGltZSA9IG5vdygpO1xuICAgICAgICBsZXQgbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHZpc2libGVMZW5ndGggPSAwO1xuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgY3VsbGluZ01hc2sgPSBjYW1lcmEuY3VsbGluZ01hc2sgfHwgMHhGRkZGRkZGRjsgLy8gaWYgbWlzc2luZyBhc3N1bWUgY2FtZXJhJ3MgZGVmYXVsdCB2YWx1ZVxuXG4gICAgICAgIGlmICghY2FtZXJhLmZydXN0dW1DdWxsaW5nKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBuZWVkIHRvIGNvcHkgYXJyYXkgYW55d2F5IGJlY2F1c2Ugc29ydGluZyB3aWxsIGhhcHBlbiBhbmQgaXQnbGwgYnJlYWsgb3JpZ2luYWwgZHJhdyBjYWxsIG9yZGVyIGFzc3VtcHRpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLnZpc2libGUgJiYgIWRyYXdDYWxsLmNvbW1hbmQpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIG9iamVjdCdzIG1hc2sgQU5EIHRoZSBjYW1lcmEncyBjdWxsaW5nTWFzayBpcyB6ZXJvIHRoZW4gdGhlIGdhbWUgb2JqZWN0IHdpbGwgYmUgaW52aXNpYmxlIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXNrICYmIChkcmF3Q2FsbC5tYXNrICYgY3VsbGluZ01hc2spID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxlbmd0aCsrO1xuICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHZpc2libGVMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5jb21tYW5kKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC52aXNpYmxlKSBjb250aW51ZTsgLy8gdXNlIHZpc2libGUgcHJvcGVydHkgdG8gcXVpY2tseSBoaWRlL3Nob3cgbWVzaEluc3RhbmNlc1xuICAgICAgICAgICAgICAgIGxldCB2aXNpYmxlID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBvYmplY3QncyBtYXNrIEFORCB0aGUgY2FtZXJhJ3MgY3VsbGluZ01hc2sgaXMgemVybyB0aGVuIHRoZSBnYW1lIG9iamVjdCB3aWxsIGJlIGludmlzaWJsZSBmcm9tIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwubWFzayAmJiAoZHJhd0NhbGwubWFzayAmIGN1bGxpbmdNYXNrKSA9PT0gMCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuY3VsbCkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlID0gZHJhd0NhbGwuX2lzVmlzaWJsZShjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgIG51bURyYXdDYWxsc0N1bGxlZCsrO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodmlzaWJsZSkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2N1bGxUaW1lICs9IG5vdygpIC0gY3VsbFRpbWU7XG4gICAgICAgIHRoaXMuX251bURyYXdDYWxsc0N1bGxlZCArPSBudW1EcmF3Q2FsbHNDdWxsZWQ7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHJldHVybiB2aXNpYmxlTGVuZ3RoO1xuICAgIH1cblxuICAgIGN1bGxMaWdodHMoY2FtZXJhLCBsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgcGh5c2ljYWxVbml0cyA9IHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIC8vIGRpcmVjdGlvbmFsIGxpZ2h0cyBhcmUgbWFya2VkIHZpc2libGUgYXQgdGhlIHN0YXJ0IG9mIHRoZSBmcmFtZVxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LmdldEJvdW5kaW5nU3BoZXJlKHRlbXBTcGhlcmUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUodGVtcFNwaGVyZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudXNlUGh5c2ljYWxVbml0cyA9IHBoeXNpY2FsVW5pdHM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1heGltdW0gc2NyZWVuIGFyZWEgdGFrZW4gYnkgdGhlIGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzY3JlZW5TaXplID0gY2FtZXJhLmdldFNjcmVlblNpemUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC5tYXhTY3JlZW5TaXplID0gTWF0aC5tYXgobGlnaHQubWF4U2NyZWVuU2l6ZSwgc2NyZWVuU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBzaGFkb3cgY2FzdGluZyBsaWdodCBkb2VzIG5vdCBoYXZlIHNoYWRvdyBtYXAgYWxsb2NhdGVkLCBtYXJrIGl0IHZpc2libGUgdG8gYWxsb2NhdGUgc2hhZG93IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90ZTogVGhpcyB3b24ndCBiZSBuZWVkZWQgd2hlbiBjbHVzdGVyZWQgc2hhZG93cyBhcmUgdXNlZCwgYnV0IGF0IHRoZSBtb21lbnQgZXZlbiBjdWxsZWQgb3V0IGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJlIHVzZWQgZm9yIHJlbmRlcmluZywgYW5kIG5lZWQgc2hhZG93IG1hcCB0byBiZSBhbGxvY2F0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGRlbGV0ZSB0aGlzIGNvZGUgd2hlbiBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgaXMgYmVpbmcgcmVtb3ZlZCBhbmQgaXMgb24gYnkgZGVmYXVsdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzICYmICFsaWdodC5zaGFkb3dNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQudXNlUGh5c2ljYWxVbml0cyA9IHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaGFkb3cgbWFwIGN1bGxpbmcgZm9yIGRpcmVjdGlvbmFsIGFuZCB2aXNpYmxlIGxvY2FsIGxpZ2h0c1xuICAgICAqIHZpc2libGUgbWVzaEluc3RhbmNlcyBhcmUgY29sbGVjdGVkIGludG8gbGlnaHQuX3JlbmRlckRhdGEsIGFuZCBhcmUgbWFya2VkIGFzIHZpc2libGVcbiAgICAgKiBmb3IgZGlyZWN0aW9uYWwgbGlnaHRzIGFsc28gc2hhZG93IGNhbWVyYSBtYXRyaXggaXMgc2V0IHVwXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbFNoYWRvd21hcHMoY29tcCkge1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGxvY2FsIChwb2ludCBhbmQgc3BvdCkgbGlnaHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcC5fbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FzdGVycyA9IGNvbXAuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2ldLnNoYWRvd0Nhc3RlcnNMaXN0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsLmN1bGwobGlnaHQsIGNhc3RlcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGdsb2JhbCAoZGlyZWN0aW9uYWwpIGxpZ2h0c1xuICAgICAgICAvLyByZW5kZXIgYWN0aW9ucyBzdG9yZSB3aGljaCBkaXJlY3Rpb25hbCBsaWdodHMgYXJlIG5lZWRlZCBmb3IgZWFjaCBjYW1lcmEsIHNvIHRoZXNlIGFyZSBnZXR0aW5nIGN1bGxlZFxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgY291bnQgPSByZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSByZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzW2pdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gY29tcC5fbGlnaHRzW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhc3RlcnMgPSBjb21wLl9saWdodENvbXBvc2l0aW9uRGF0YVtsaWdodEluZGV4XS5zaGFkb3dDYXN0ZXJzTGlzdDtcbiAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsLmN1bGwobGlnaHQsIGNhc3RlcnMsIHJlbmRlckFjdGlvbi5jYW1lcmEuY2FtZXJhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAqIEFsc28gYXBwbGllcyBtZXNoSW5zdGFuY2UudmlzaWJsZSBhbmQgY2FtZXJhLmN1bGxpbmdNYXNrXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbENvbXBvc2l0aW9uKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb259ICovXG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuXG4gICAgICAgICAgICAvLyBsYXllclxuICAgICAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9ICovXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFsYXllci5lbmFibGVkIHx8ICFjb21wLnN1YkxheWVyRW5hYmxlZFtsYXllckluZGV4XSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBjYW1lcmFcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgICAgIGNhbWVyYS5mcmFtZVVwZGF0ZShyZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0KTtcblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBjYW1lcmEgYW5kIGZydXN0dW0gb25jZVxuICAgICAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uZmlyc3RDYW1lcmFVc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVDYW1lcmFGcnVzdHVtKGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmFzUmVuZGVyZWQrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjdWxsIGVhY2ggbGF5ZXIncyBub24tZGlyZWN0aW9uYWwgbGlnaHRzIG9uY2Ugd2l0aCBlYWNoIGNhbWVyYVxuICAgICAgICAgICAgICAgIC8vIGxpZ2h0cyBhcmVuJ3QgY29sbGVjdGVkIGFueXdoZXJlLCBidXQgbWFya2VkIGFzIHZpc2libGVcbiAgICAgICAgICAgICAgICB0aGlzLmN1bGxMaWdodHMoY2FtZXJhLmNhbWVyYSwgbGF5ZXIuX2xpZ2h0cyk7XG5cbiAgICAgICAgICAgICAgICAvLyBjdWxsIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqZWN0cyA9IGxheWVyLmluc3RhbmNlcztcblxuICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgdGhlbSBpbnRvIGxheWVyIGFycmF5c1xuICAgICAgICAgICAgICAgIGNvbnN0IHZpc2libGUgPSB0cmFuc3BhcmVudCA/IG9iamVjdHMudmlzaWJsZVRyYW5zcGFyZW50W2NhbWVyYVBhc3NdIDogb2JqZWN0cy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAgICAgLy8gc2hhcmVkIG9iamVjdHMgYXJlIG9ubHkgY3VsbGVkIG9uY2VcbiAgICAgICAgICAgICAgICBpZiAoIXZpc2libGUuZG9uZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5vblByZUN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUHJlQ3VsbChjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IHRyYW5zcGFyZW50ID8gbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIDogbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5sZW5ndGggPSB0aGlzLmN1bGwoY2FtZXJhLmNhbWVyYSwgZHJhd0NhbGxzLCB2aXNpYmxlLmxpc3QpO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5vblBvc3RDdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5vblBvc3RDdWxsKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3VsbCBzaGFkb3cgY2FzdGVycyBmb3IgYWxsIGxpZ2h0c1xuICAgICAgICB0aGlzLmN1bGxTaGFkb3dtYXBzKGNvbXApO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gTWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbmx5TGl0U2hhZGVycyAtIExpbWl0cyB0aGUgdXBkYXRlIHRvIHNoYWRlcnMgYWZmZWN0ZWQgYnkgbGlnaHRpbmcuXG4gICAgICovXG4gICAgdXBkYXRlU2hhZGVycyhkcmF3Q2FsbHMsIG9ubHlMaXRTaGFkZXJzKSB7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXQgPSBkcmF3Q2FsbHNbaV0ubWF0ZXJpYWw7XG4gICAgICAgICAgICBpZiAobWF0KSB7XG4gICAgICAgICAgICAgICAgLy8gbWF0ZXJpYWwgbm90IHByb2Nlc3NlZCB5ZXRcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhtYXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIF90ZW1wU2V0LmFkZChtYXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBmb3IgbWF0ZXJpYWxzIG5vdCB1c2luZyB2YXJpYW50c1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0LmdldFNoYWRlclZhcmlhbnQgIT09IE1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXJWYXJpYW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbmx5TGl0U2hhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNraXAgbWF0ZXJpYWxzIG5vdCB1c2luZyBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0LnVzZUxpZ2h0aW5nIHx8IChtYXQuZW1pdHRlciAmJiAhbWF0LmVtaXR0ZXIubGlnaHRpbmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2hhZGVyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbCBhbmQgYWxzbyBvbiBtZXNoIGluc3RhbmNlcyB0aGF0IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcbiAgICB9XG5cbiAgICByZW5kZXJDb29raWVzKGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IGNvb2tpZVJlbmRlclRhcmdldCA9IHRoaXMubGlnaHRUZXh0dXJlQXRsYXMuY29va2llUmVuZGVyVGFyZ2V0O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgIC8vIHNraXAgY2x1c3RlcmVkIGNvb2tpZXMgd2l0aCBubyBhc3NpZ25lZCBhdGxhcyBzbG90XG4gICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIG9ubHkgcmVuZGVyIGNvb2tpZSB3aGVuIHRoZSBzbG90IGlzIHJlYXNzaWduZWQgKGFzc3VtaW5nIHRoZSBjb29raWUgdGV4dHVyZSBpcyBzdGF0aWMpXG4gICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzU2xvdFVwZGF0ZWQpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyLnJlbmRlcihsaWdodCwgY29va2llUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbiB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBsaWdodHNDaGFuZ2VkIC0gVHJ1ZSBpZiBsaWdodHMgb2YgdGhlIGNvbXBvc2l0aW9uIGhhcyBjaGFuZ2VkLlxuICAgICAqL1xuICAgIGJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCkge1xuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcztcblxuICAgICAgICAvLyBVcGRhdGUgc2hhZGVycyBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBpZiAoc2NlbmUudXBkYXRlU2hhZGVycyB8fCBsaWdodHNDaGFuZ2VkKSB7XG4gICAgICAgICAgICBjb25zdCBvbmx5TGl0U2hhZGVycyA9ICFzY2VuZS51cGRhdGVTaGFkZXJzICYmIGxpZ2h0c0NoYW5nZWQ7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMobWVzaEluc3RhbmNlcywgb25seUxpdFNoYWRlcnMpO1xuICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IGZhbHNlO1xuICAgICAgICAgICAgc2NlbmUuX3NoYWRlclZlcnNpb24rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBhbGwgc2tpbiBtYXRyaWNlcyB0byBwcm9wZXJseSBjdWxsIHNraW5uZWQgb2JqZWN0cyAoYnV0IGRvbid0IHVwZGF0ZSByZW5kZXJpbmcgZGF0YSB5ZXQpXG4gICAgICAgIHRoaXMudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKG1lc2hJbnN0YW5jZXMpO1xuXG4gICAgICAgIC8vIGNsZWFyIG1lc2ggaW5zdGFuY2UgdmlzaWJpbGl0eVxuICAgICAgICBjb25zdCBtaUNvdW50ID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWlDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGxpZ2h0IHZpc2liaWxpdHlcbiAgICAgICAgY29uc3QgbGlnaHRzID0gY29tcC5fbGlnaHRzO1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodENvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGxpZ2h0c1tpXS5iZWdpbkZyYW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoY29tcCkge1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLnVwZGF0ZShjb21wLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIGNvbXAuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5zY2VuZS5saWdodGluZyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZUNsdXN0ZXJzKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBlbXB0eVdvcmxkQ2x1c3RlcnMgPSBjb21wLmdldEVtcHR5V29ybGRDbHVzdGVycyh0aGlzLmRldmljZSk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXIgPSByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycztcblxuICAgICAgICAgICAgaWYgKGNsdXN0ZXIgJiYgY2x1c3RlciAhPT0gZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZWFjaCBjbHVzdGVyIG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhjbHVzdGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcFNldC5hZGQoY2x1c3Rlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXIudXBkYXRlKGxheWVyLmNsdXN0ZXJlZExpZ2h0c1NldCwgdGhpcy5zY2VuZS5nYW1tYUNvcnJlY3Rpb24sIHRoaXMuc2NlbmUubGlnaHRpbmcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnNUaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gY29tcC5fd29ybGRDbHVzdGVycy5sZW5ndGg7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIGxheWVyIGNvbXBvc2l0aW9uIGZvciByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIC0gVHJ1ZSBpZiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEZsYWdzIG9mIHdoYXQgd2FzIHVwZGF0ZWRcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGxlbiA9IGNvbXAubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29tcC5sYXllckxpc3RbaV0uX3Bvc3RSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3Qgc2hhZGVyVmVyc2lvbiA9IHNjZW5lLl9zaGFkZXJWZXJzaW9uO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgbGF5ZXIuX3NoYWRlclZlcnNpb24gPSBzaGFkZXJWZXJzaW9uO1xuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgbGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3JlbmRlclRpbWUgPSAwO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyA9IDA7XG4gICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgaWYgKHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyIHw9IDI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciB8PSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyTWF4ID0gbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyO1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGxheWVyIGZvciBjdWxsaW5nIHdpdGggdGhlIGNhbWVyYVxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsYXllci5jYW1lcmFzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuaW5zdGFuY2VzLnByZXBhcmUoaik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdlbmVyYXRlIHN0YXRpYyBsaWdodGluZyBmb3IgbWVzaGVzIGluIHRoaXMgbGF5ZXIgaWYgbmVlZGVkXG4gICAgICAgICAgICAvLyBOb3RlOiBTdGF0aWMgbGlnaHRpbmcgaXMgbm90IHVzZWQgd2hlbiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKGxheWVyLl9uZWVkc1N0YXRpY1ByZXBhcmUgJiYgbGF5ZXIuX3N0YXRpY0xpZ2h0SGFzaCAmJiAhdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiByZXVzZSB3aXRoIHRoZSBzYW1lIHN0YXRpY0xpZ2h0SGFzaFxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fc3RhdGljUHJlcGFyZURvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnJldmVydChsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnJldmVydChsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucHJlcGFyZSh0aGlzLmRldmljZSwgc2NlbmUsIGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXMsIGxheWVyLl9saWdodHMpO1xuICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5wcmVwYXJlKHRoaXMuZGV2aWNlLCBzY2VuZSwgbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzLCBsYXllci5fbGlnaHRzKTtcbiAgICAgICAgICAgICAgICBjb21wLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX25lZWRzU3RhdGljUHJlcGFyZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGxheWVyLl9zdGF0aWNQcmVwYXJlRG9uZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgc3RhdGljIGxheWVyIGRhdGEsIGlmIHNvbWV0aGluZydzIGNoYW5nZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IGNvbXAuX3VwZGF0ZSh0aGlzLmRldmljZSwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lICs9IG5vdygpIC0gbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHJldHVybiB1cGRhdGVkO1xuICAgIH1cblxuICAgIGJhc2VVcGRhdGUoKSB7XG5cbiAgICAgICAgdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXJlciB9O1xuIl0sIm5hbWVzIjpbIl9za2luVXBkYXRlSW5kZXgiLCJib25lVGV4dHVyZVNpemUiLCJ2aWV3UHJvak1hdCIsIk1hdDQiLCJ2aWV3SW52TWF0Iiwidmlld01hdCIsIndvcmxkTWF0WCIsIlZlYzMiLCJ3b3JsZE1hdFkiLCJ3b3JsZE1hdFoiLCJ2aWV3TWF0MyIsIk1hdDMiLCJ0ZW1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJfZmxpcFlNYXQiLCJzZXRTY2FsZSIsIl9maXhQcm9qUmFuZ2VNYXQiLCJzZXQiLCJfdGVtcFByb2pNYXQwIiwiX3RlbXBQcm9qTWF0MSIsIl90ZW1wUHJvak1hdDIiLCJfdGVtcFByb2pNYXQzIiwiX3RlbXBTZXQiLCJTZXQiLCJSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJjbHVzdGVyc0RlYnVnUmVuZGVyZWQiLCJkZXZpY2UiLCJzY2VuZSIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiTGlnaHRUZXh0dXJlQXRsYXMiLCJzaGFkb3dNYXBDYWNoZSIsIlNoYWRvd01hcENhY2hlIiwiX3NoYWRvd1JlbmRlcmVyTG9jYWwiLCJTaGFkb3dSZW5kZXJlckxvY2FsIiwiX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJTaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIiwiX2Nvb2tpZVJlbmRlcmVyIiwiQ29va2llUmVuZGVyZXIiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJfc2tpblRpbWUiLCJfbW9ycGhUaW1lIiwiX2N1bGxUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJfbGlnaHRDbHVzdGVyc1RpbWUiLCJfbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJfc2hhZG93RHJhd0NhbGxzIiwiX3NraW5EcmF3Q2FsbHMiLCJfaW5zdGFuY2VkRHJhd0NhbGxzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJfbnVtRHJhd0NhbGxzQ3VsbGVkIiwiX2NhbWVyYXNSZW5kZXJlZCIsIl9saWdodENsdXN0ZXJzIiwic2NvcGUiLCJib25lVGV4dHVyZUlkIiwicmVzb2x2ZSIsImJvbmVUZXh0dXJlU2l6ZUlkIiwicG9zZU1hdHJpeElkIiwibW9kZWxNYXRyaXhJZCIsIm5vcm1hbE1hdHJpeElkIiwidmlld0ludklkIiwidmlld1BvcyIsIkZsb2F0MzJBcnJheSIsInZpZXdQb3NJZCIsInByb2pJZCIsInByb2pTa3lib3hJZCIsInZpZXdJZCIsInZpZXdJZDMiLCJ2aWV3UHJvaklkIiwiZmxpcFlJZCIsInRibkJhc2lzIiwibmVhckNsaXBJZCIsImZhckNsaXBJZCIsImNhbWVyYVBhcmFtcyIsImNhbWVyYVBhcmFtc0lkIiwiYWxwaGFUZXN0SWQiLCJvcGFjaXR5TWFwSWQiLCJleHBvc3VyZUlkIiwidHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9ySWQiLCJtb3JwaFdlaWdodHNBIiwibW9ycGhXZWlnaHRzQiIsIm1vcnBoUG9zaXRpb25UZXgiLCJtb3JwaE5vcm1hbFRleCIsIm1vcnBoVGV4UGFyYW1zIiwiZGVzdHJveSIsInNvcnRDb21wYXJlIiwiZHJhd0NhbGxBIiwiZHJhd0NhbGxCIiwibGF5ZXIiLCJkcmF3T3JkZXIiLCJ6ZGlzdCIsInpkaXN0MiIsIl9rZXkiLCJTT1JUS0VZX0ZPUldBUkQiLCJzb3J0Q29tcGFyZU1lc2giLCJrZXlBIiwia2V5QiIsIm1lc2giLCJpZCIsInNvcnRDb21wYXJlRGVwdGgiLCJTT1JUS0VZX0RFUFRIIiwic2V0dXBWaWV3cG9ydCIsImNhbWVyYSIsInJlbmRlclRhcmdldCIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwicGl4ZWxXaWR0aCIsIndpZHRoIiwicGl4ZWxIZWlnaHQiLCJoZWlnaHQiLCJyZWN0IiwieCIsIk1hdGgiLCJmbG9vciIsInkiLCJ3IiwieiIsImgiLCJzZXRWaWV3cG9ydCIsIl9zY2lzc29yUmVjdENsZWFyIiwic2Npc3NvclJlY3QiLCJzZXRTY2lzc29yIiwicG9wR3B1TWFya2VyIiwiY2xlYXIiLCJyZW5kZXJBY3Rpb24iLCJmbGFncyIsImNsZWFyQ29sb3IiLCJDTEVBUkZMQUdfQ09MT1IiLCJjbGVhckRlcHRoIiwiQ0xFQVJGTEFHX0RFUFRIIiwiY2xlYXJTdGVuY2lsIiwiQ0xFQVJGTEFHX1NURU5DSUwiLCJjb2xvciIsIl9jbGVhckNvbG9yIiwiciIsImciLCJiIiwiYSIsImRlcHRoIiwiX2NsZWFyRGVwdGgiLCJzdGVuY2lsIiwiX2NsZWFyU3RlbmNpbCIsInNldENhbWVyYVVuaWZvcm1zIiwidGFyZ2V0IiwiZmxpcFkiLCJ2aWV3Q291bnQiLCJ4ciIsInNlc3Npb24iLCJ0cmFuc2Zvcm0iLCJwYXJlbnQiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwidmlld3MiLCJsZW5ndGgiLCJ2IiwidmlldyIsInZpZXdJbnZPZmZNYXQiLCJtdWwyIiwidmlld09mZk1hdCIsImNvcHkiLCJpbnZlcnQiLCJzZXRGcm9tTWF0NCIsInByb2pWaWV3T2ZmTWF0IiwicHJvak1hdCIsInBvc2l0aW9uIiwiZGF0YSIsImZydXN0dW0iLCJwcm9qZWN0aW9uTWF0cml4IiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsIlZJRVdfQ0VOVEVSIiwicHJvak1hdFNreWJveCIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHUFUiLCJzZXRWYWx1ZSIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJzZXRUUlMiLCJPTkUiLCJkaXNwYXRjaFZpZXdQb3MiLCJuIiwiX25lYXJDbGlwIiwiZiIsIl9mYXJDbGlwIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwicGh5c2ljYWxVbml0cyIsImdldEV4cG9zdXJlIiwiZXhwb3N1cmUiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic2V0dXBWaWV3VW5pZm9ybUJ1ZmZlcnMiLCJzZXRDYW1lcmEiLCJjbGVhclZpZXciLCJmb3JjZVdyaXRlIiwic2V0UmVuZGVyVGFyZ2V0IiwidXBkYXRlQmVnaW4iLCJzZXRDb2xvcldyaXRlIiwic2V0RGVwdGhXcml0ZSIsIm9wdGlvbnMiLCJfY2xlYXJPcHRpb25zIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsIl9jbGVhclN0ZW5jaWxCdWZmZXIiLCJzZXRDdWxsTW9kZSIsImN1bGxGYWNlcyIsImZsaXAiLCJkcmF3Q2FsbCIsIm1hdGVyaWFsIiwibW9kZSIsIkNVTExGQUNFX05PTkUiLCJmbGlwRmFjZXMiLCJjdWxsIiwiQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLIiwid3QiLCJub2RlIiwid29ybGRUcmFuc2Zvcm0iLCJnZXRYIiwiZ2V0WSIsImdldFoiLCJjcm9zcyIsImRvdCIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfQkFDSyIsInd0MiIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJzZXRCYXNlQ29uc3RhbnRzIiwib3BhY2l0eU1hcCIsImFscGhhVGVzdCIsInVwZGF0ZUNwdVNraW5NYXRyaWNlcyIsImRyYXdDYWxscyIsImRyYXdDYWxsc0NvdW50Iiwic2tpblRpbWUiLCJub3ciLCJpIiwic2kiLCJza2luSW5zdGFuY2UiLCJ1cGRhdGVNYXRyaWNlcyIsIl9kaXJ0eSIsInVwZGF0ZUdwdVNraW5NYXRyaWNlcyIsImNvdW50IiwidmlzaWJsZVRoaXNGcmFtZSIsInNraW4iLCJ1cGRhdGVNYXRyaXhQYWxldHRlIiwidXBkYXRlTW9ycGhpbmciLCJtb3JwaFRpbWUiLCJtb3JwaEluc3QiLCJtb3JwaEluc3RhbmNlIiwidXBkYXRlIiwiZ3B1VXBkYXRlIiwic2V0VmVydGV4QnVmZmVycyIsInNldFZlcnRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlciIsInNldE1vcnBoaW5nIiwibW9ycGgiLCJ1c2VUZXh0dXJlTW9ycGgiLCJ2ZXJ0ZXhCdWZmZXJJZHMiLCJ0ZXh0dXJlUG9zaXRpb25zIiwidGV4dHVyZU5vcm1hbHMiLCJfdGV4dHVyZVBhcmFtcyIsInQiLCJfYWN0aXZlVmVydGV4QnVmZmVycyIsInZiIiwic2VtYW50aWMiLCJTRU1BTlRJQ19BVFRSIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJuYW1lIiwic2NvcGVJZCIsIl9zaGFkZXJNb3JwaFdlaWdodHNBIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0IiLCJzZXRTa2lubmluZyIsIm1lc2hJbnN0YW5jZSIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwiYm9uZVRleHR1cmUiLCJtYXRyaXhQYWxldHRlIiwidnAiLCJpbml0Vmlld0JpbmRHcm91cEZvcm1hdCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfTUFUNCIsIkJpbmRHcm91cEZvcm1hdCIsIkJpbmRCdWZmZXJGb3JtYXQiLCJVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSIsIlNIQURFUlNUQUdFX1ZFUlRFWCIsIlNIQURFUlNUQUdFX0ZSQUdNRU5UIiwiQmluZFRleHR1cmVGb3JtYXQiLCJURVhUVVJFRElNRU5TSU9OXzJEIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJEZWJ1ZyIsImFzc2VydCIsInZpZXdCaW5kR3JvdXBzIiwidWIiLCJVbmlmb3JtQnVmZmVyIiwiYmciLCJCaW5kR3JvdXAiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJwdXNoIiwidmlld0JpbmRHcm91cCIsImRlZmF1bHRVbmlmb3JtQnVmZmVyIiwic2V0QmluZEdyb3VwIiwiQklOREdST1VQX1ZJRVciLCJkcmF3SW5zdGFuY2UiLCJzdHlsZSIsIm5vcm1hbCIsImluc3RhbmNpbmdEYXRhIiwiZHJhdyIsInByaW1pdGl2ZSIsIm1vZGVsTWF0cml4Iiwibm9ybWFsTWF0cml4IiwiZHJhd0luc3RhbmNlMiIsInVuZGVmaW5lZCIsInZpc2libGVMaXN0IiwiY3VsbFRpbWUiLCJudW1EcmF3Q2FsbHNDdWxsZWQiLCJ2aXNpYmxlTGVuZ3RoIiwiY3VsbGluZ01hc2siLCJmcnVzdHVtQ3VsbGluZyIsInZpc2libGUiLCJjb21tYW5kIiwibWFzayIsIl9pc1Zpc2libGUiLCJjdWxsTGlnaHRzIiwibGlnaHRzIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHQiLCJlbmFibGVkIiwiX3R5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJnZXRCb3VuZGluZ1NwaGVyZSIsImNvbnRhaW5zU3BoZXJlIiwidXNlUGh5c2ljYWxVbml0cyIsInNjcmVlblNpemUiLCJnZXRTY3JlZW5TaXplIiwibWF4U2NyZWVuU2l6ZSIsIm1heCIsImNhc3RTaGFkb3dzIiwic2hhZG93TWFwIiwiY3VsbFNoYWRvd21hcHMiLCJjb21wIiwiX2xpZ2h0cyIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfTk9ORSIsImNhc3RlcnMiLCJfbGlnaHRDb21wb3NpdGlvbkRhdGEiLCJzaGFkb3dDYXN0ZXJzTGlzdCIsInJlbmRlckFjdGlvbnMiLCJfcmVuZGVyQWN0aW9ucyIsImRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcyIsImoiLCJsaWdodEluZGV4IiwiY3VsbENvbXBvc2l0aW9uIiwibGF5ZXJJbmRleCIsImxheWVyTGlzdCIsInN1YkxheWVyRW5hYmxlZCIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJMaXN0IiwiY2FtZXJhUGFzcyIsImNhbWVyYUluZGV4IiwiY2FtZXJhcyIsImZyYW1lVXBkYXRlIiwiZmlyc3RDYW1lcmFVc2UiLCJvYmplY3RzIiwiaW5zdGFuY2VzIiwidmlzaWJsZVRyYW5zcGFyZW50IiwidmlzaWJsZU9wYXF1ZSIsImRvbmUiLCJvblByZUN1bGwiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJvcGFxdWVNZXNoSW5zdGFuY2VzIiwibGlzdCIsIm9uUG9zdEN1bGwiLCJ1cGRhdGVTaGFkZXJzIiwib25seUxpdFNoYWRlcnMiLCJtYXQiLCJoYXMiLCJhZGQiLCJnZXRTaGFkZXJWYXJpYW50IiwiTWF0ZXJpYWwiLCJwcm90b3R5cGUiLCJ1c2VMaWdodGluZyIsImVtaXR0ZXIiLCJsaWdodGluZyIsImNsZWFyVmFyaWFudHMiLCJyZW5kZXJDb29raWVzIiwiY29va2llUmVuZGVyVGFyZ2V0IiwiYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCIsImF0bGFzU2xvdFVwZGF0ZWQiLCJyZW5kZXIiLCJiZWdpbkZyYW1lIiwibGlnaHRzQ2hhbmdlZCIsIm1lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlcyIsIl9zaGFkZXJWZXJzaW9uIiwibWlDb3VudCIsImxpZ2h0Q291bnQiLCJ1cGRhdGVMaWdodFRleHR1cmVBdGxhcyIsIl9zcGxpdExpZ2h0cyIsIkxJR0hUVFlQRV9TUE9UIiwiTElHSFRUWVBFX09NTkkiLCJ1cGRhdGVDbHVzdGVycyIsInN0YXJ0VGltZSIsImVtcHR5V29ybGRDbHVzdGVycyIsImdldEVtcHR5V29ybGRDbHVzdGVycyIsImNsdXN0ZXIiLCJsaWdodENsdXN0ZXJzIiwiY2x1c3RlcmVkTGlnaHRzU2V0IiwiZ2FtbWFDb3JyZWN0aW9uIiwiX3dvcmxkQ2x1c3RlcnMiLCJ1cGRhdGVMYXllckNvbXBvc2l0aW9uIiwibGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJsZW4iLCJfcG9zdFJlbmRlckNvdW50ZXIiLCJzaGFkZXJWZXJzaW9uIiwiX3NraXBSZW5kZXJDb3VudGVyIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJfcmVuZGVyVGltZSIsIl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDb3VudGVyTWF4IiwicHJlcGFyZSIsIl9uZWVkc1N0YXRpY1ByZXBhcmUiLCJfc3RhdGljTGlnaHRIYXNoIiwiX3N0YXRpY1ByZXBhcmVEb25lIiwiU3RhdGljTWVzaGVzIiwicmV2ZXJ0IiwidXBkYXRlZCIsIl91cGRhdGUiLCJiYXNlVXBkYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNDQSxJQUFJQSxnQkFBZ0IsR0FBRyxDQUFDLENBQUE7QUFDeEIsTUFBTUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFD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QUFPSCxTQUFTLENBQUNHLFNBQVMsR0FBR0YsU0FBUyxDQUFDRSxTQUFTLENBQUE7T0FDbkQsTUFBTSxJQUFJSCxTQUFTLENBQUNJLEtBQUssSUFBSUgsU0FBUyxDQUFDRyxLQUFLLEVBQUU7QUFDM0MsUUFBQSxPQUFPSCxTQUFTLENBQUNHLEtBQUssR0FBR0osU0FBUyxDQUFDSSxLQUFLLENBQUE7T0FDM0MsTUFBTSxJQUFJSixTQUFTLENBQUNLLE1BQU0sSUFBSUosU0FBUyxDQUFDSSxNQUFNLEVBQUU7QUFDN0MsUUFBQSxPQUFPTCxTQUFTLENBQUNLLE1BQU0sR0FBR0osU0FBUyxDQUFDSSxNQUFNLENBQUE7QUFDOUMsT0FBQTtBQUNKLEtBQUE7O0FBRUEsSUFBQSxPQUFPSixTQUFTLENBQUNLLElBQUksQ0FBQ0MsZUFBZSxDQUFDLEdBQUdQLFNBQVMsQ0FBQ00sSUFBSSxDQUFDQyxlQUFlLENBQUMsQ0FBQTtBQUM1RSxHQUFBO0FBRUFDLEVBQUFBLGVBQWUsQ0FBQ1IsU0FBUyxFQUFFQyxTQUFTLEVBQUU7QUFDbEMsSUFBQSxJQUFJRCxTQUFTLENBQUNFLEtBQUssS0FBS0QsU0FBUyxDQUFDQyxLQUFLLEVBQUU7QUFDckMsTUFBQSxJQUFJRixTQUFTLENBQUNHLFNBQVMsSUFBSUYsU0FBUyxDQUFDRSxTQUFTLEVBQUU7QUFDNUMsUUFBQSxPQUFPSCxTQUFTLENBQUNHLFNBQVMsR0FBR0YsU0FBUyxDQUFDRSxTQUFTLENBQUE7T0FDbkQsTUFBTSxJQUFJSCxTQUFTLENBQUNJLEtBQUssSUFBSUgsU0FBUyxDQUFDRyxLQUFLLEVBQUU7QUFDM0MsUUFBQSxPQUFPSCxTQUFTLENBQUNHLEtBQUssR0FBR0osU0FBUyxDQUFDSSxLQUFLLENBQUE7QUFDNUMsT0FBQTtBQUNKLEtBQUE7O0FBRUEsSUFBQSxNQUFNSyxJQUFJLEdBQUdULFNBQVMsQ0FBQ00sSUFBSSxDQUFDQyxlQUFlLENBQUMsQ0FBQTtBQUM1QyxJQUFBLE1BQU1HLElBQUksR0FBR1QsU0FBUyxDQUFDSyxJQUFJLENBQUNDLGVBQWUsQ0FBQyxDQUFBO0lBRTVDLElBQUlFLElBQUksS0FBS0MsSUFBSSxJQUFJVixTQUFTLENBQUNXLElBQUksSUFBSVYsU0FBUyxDQUFDVSxJQUFJLEVBQUU7TUFDbkQsT0FBT1YsU0FBUyxDQUFDVSxJQUFJLENBQUNDLEVBQUUsR0FBR1osU0FBUyxDQUFDVyxJQUFJLENBQUNDLEVBQUUsQ0FBQTtBQUNoRCxLQUFBO0lBRUEsT0FBT0YsSUFBSSxHQUFHRCxJQUFJLENBQUE7QUFDdEIsR0FBQTtBQUVBSSxFQUFBQSxnQkFBZ0IsQ0FBQ2IsU0FBUyxFQUFFQyxTQUFTLEVBQUU7QUFDbkMsSUFBQSxNQUFNUSxJQUFJLEdBQUdULFNBQVMsQ0FBQ00sSUFBSSxDQUFDUSxhQUFhLENBQUMsQ0FBQTtBQUMxQyxJQUFBLE1BQU1KLElBQUksR0FBR1QsU0FBUyxDQUFDSyxJQUFJLENBQUNRLGFBQWEsQ0FBQyxDQUFBO0lBRTFDLElBQUlMLElBQUksS0FBS0MsSUFBSSxJQUFJVixTQUFTLENBQUNXLElBQUksSUFBSVYsU0FBUyxDQUFDVSxJQUFJLEVBQUU7TUFDbkQsT0FBT1YsU0FBUyxDQUFDVSxJQUFJLENBQUNDLEVBQUUsR0FBR1osU0FBUyxDQUFDVyxJQUFJLENBQUNDLEVBQUUsQ0FBQTtBQUNoRCxLQUFBO0lBRUEsT0FBT0YsSUFBSSxHQUFHRCxJQUFJLENBQUE7QUFDdEIsR0FBQTs7QUFVQU0sRUFBQUEsYUFBYSxDQUFDQyxNQUFNLEVBQUVDLFlBQVksRUFBRTtBQUVoQyxJQUFBLE1BQU03RSxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7QUFDMUI4RSxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQy9FLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO0lBRXJELE1BQU1nRixVQUFVLEdBQUdILFlBQVksR0FBR0EsWUFBWSxDQUFDSSxLQUFLLEdBQUdqRixNQUFNLENBQUNpRixLQUFLLENBQUE7SUFDbkUsTUFBTUMsV0FBVyxHQUFHTCxZQUFZLEdBQUdBLFlBQVksQ0FBQ00sTUFBTSxHQUFHbkYsTUFBTSxDQUFDbUYsTUFBTSxDQUFBO0FBRXRFLElBQUEsTUFBTUMsSUFBSSxHQUFHUixNQUFNLENBQUNRLElBQUksQ0FBQTtJQUN4QixJQUFJQyxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSCxJQUFJLENBQUNDLENBQUMsR0FBR0wsVUFBVSxDQUFDLENBQUE7SUFDdkMsSUFBSVEsQ0FBQyxHQUFHRixJQUFJLENBQUNDLEtBQUssQ0FBQ0gsSUFBSSxDQUFDSSxDQUFDLEdBQUdOLFdBQVcsQ0FBQyxDQUFBO0lBQ3hDLElBQUlPLENBQUMsR0FBR0gsSUFBSSxDQUFDQyxLQUFLLENBQUNILElBQUksQ0FBQ00sQ0FBQyxHQUFHVixVQUFVLENBQUMsQ0FBQTtJQUN2QyxJQUFJVyxDQUFDLEdBQUdMLElBQUksQ0FBQ0MsS0FBSyxDQUFDSCxJQUFJLENBQUNLLENBQUMsR0FBR1AsV0FBVyxDQUFDLENBQUE7SUFDeENsRixNQUFNLENBQUM0RixXQUFXLENBQUNQLENBQUMsRUFBRUcsQ0FBQyxFQUFFQyxDQUFDLEVBQUVFLENBQUMsQ0FBQyxDQUFBOztJQUc5QixJQUFJZixNQUFNLENBQUNpQixpQkFBaUIsRUFBRTtBQUMxQixNQUFBLE1BQU1DLFdBQVcsR0FBR2xCLE1BQU0sQ0FBQ2tCLFdBQVcsQ0FBQTtNQUN0Q1QsQ0FBQyxHQUFHQyxJQUFJLENBQUNDLEtBQUssQ0FBQ08sV0FBVyxDQUFDVCxDQUFDLEdBQUdMLFVBQVUsQ0FBQyxDQUFBO01BQzFDUSxDQUFDLEdBQUdGLElBQUksQ0FBQ0MsS0FBSyxDQUFDTyxXQUFXLENBQUNOLENBQUMsR0FBR04sV0FBVyxDQUFDLENBQUE7TUFDM0NPLENBQUMsR0FBR0gsSUFBSSxDQUFDQyxLQUFLLENBQUNPLFdBQVcsQ0FBQ0osQ0FBQyxHQUFHVixVQUFVLENBQUMsQ0FBQTtNQUMxQ1csQ0FBQyxHQUFHTCxJQUFJLENBQUNDLEtBQUssQ0FBQ08sV0FBVyxDQUFDTCxDQUFDLEdBQUdQLFdBQVcsQ0FBQyxDQUFBO0FBQy9DLEtBQUE7SUFDQWxGLE1BQU0sQ0FBQytGLFVBQVUsQ0FBQ1YsQ0FBQyxFQUFFRyxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxDQUFDLENBQUE7QUFFN0JiLElBQUFBLGFBQWEsQ0FBQ2tCLFlBQVksQ0FBQ2hHLE1BQU0sQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7O0FBU0FpRyxFQUFBQSxLQUFLLENBQUNDLFlBQVksRUFBRXRCLE1BQU0sRUFBRTtJQUV4QixNQUFNdUIsS0FBSyxHQUFHLENBQUNELFlBQVksQ0FBQ0UsVUFBVSxHQUFHQyxlQUFlLEdBQUcsQ0FBQyxLQUM3Q0gsWUFBWSxDQUFDSSxVQUFVLEdBQUdDLGVBQWUsR0FBRyxDQUFDLENBQUMsSUFDOUNMLFlBQVksQ0FBQ00sWUFBWSxHQUFHQyxpQkFBaUIsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVqRSxJQUFBLElBQUlOLEtBQUssRUFBRTtBQUNQLE1BQUEsTUFBTW5HLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtBQUMxQjhFLE1BQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDL0UsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUE7TUFFckRBLE1BQU0sQ0FBQ2lHLEtBQUssQ0FBQztRQUNUUyxLQUFLLEVBQUUsQ0FBQzlCLE1BQU0sQ0FBQytCLFdBQVcsQ0FBQ0MsQ0FBQyxFQUFFaEMsTUFBTSxDQUFDK0IsV0FBVyxDQUFDRSxDQUFDLEVBQUVqQyxNQUFNLENBQUMrQixXQUFXLENBQUNHLENBQUMsRUFBRWxDLE1BQU0sQ0FBQytCLFdBQVcsQ0FBQ0ksQ0FBQyxDQUFDO1FBQy9GQyxLQUFLLEVBQUVwQyxNQUFNLENBQUNxQyxXQUFXO1FBQ3pCQyxPQUFPLEVBQUV0QyxNQUFNLENBQUN1QyxhQUFhO0FBQzdCaEIsUUFBQUEsS0FBSyxFQUFFQSxLQUFBQTtBQUNYLE9BQUMsQ0FBQyxDQUFBO0FBRUZyQixNQUFBQSxhQUFhLENBQUNrQixZQUFZLENBQUNoRyxNQUFNLENBQUMsQ0FBQTtBQUN0QyxLQUFBO0FBQ0osR0FBQTtBQUVBb0gsRUFBQUEsaUJBQWlCLENBQUN4QyxNQUFNLEVBQUV5QyxNQUFNLEVBQUVuQixZQUFZLEVBQUU7QUFHNUMsSUFBQSxNQUFNb0IsS0FBSyxHQUFHRCxNQUFNLElBQU5BLElBQUFBLEdBQUFBLEtBQUFBLENBQUFBLEdBQUFBLE1BQU0sQ0FBRUMsS0FBSyxDQUFBO0lBRTNCLElBQUlDLFNBQVMsR0FBRyxDQUFDLENBQUE7SUFDakIsSUFBSTNDLE1BQU0sQ0FBQzRDLEVBQUUsSUFBSTVDLE1BQU0sQ0FBQzRDLEVBQUUsQ0FBQ0MsT0FBTyxFQUFFO0FBQ2hDLE1BQUEsSUFBSUMsU0FBUyxDQUFBO0FBQ2IsTUFBQSxNQUFNQyxNQUFNLEdBQUcvQyxNQUFNLENBQUNnRCxLQUFLLENBQUNELE1BQU0sQ0FBQTtBQUNsQyxNQUFBLElBQUlBLE1BQU0sRUFDTkQsU0FBUyxHQUFHQyxNQUFNLENBQUNFLGlCQUFpQixFQUFFLENBQUE7QUFFMUMsTUFBQSxNQUFNQyxLQUFLLEdBQUdsRCxNQUFNLENBQUM0QyxFQUFFLENBQUNNLEtBQUssQ0FBQTtNQUM3QlAsU0FBUyxHQUFHTyxLQUFLLENBQUNDLE1BQU0sQ0FBQTtNQUN4QixLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1QsU0FBUyxFQUFFUyxDQUFDLEVBQUUsRUFBRTtBQUNoQyxRQUFBLE1BQU1DLElBQUksR0FBR0gsS0FBSyxDQUFDRSxDQUFDLENBQUMsQ0FBQTtBQUVyQixRQUFBLElBQUlMLE1BQU0sRUFBRTtVQUNSTSxJQUFJLENBQUNDLGFBQWEsQ0FBQ0MsSUFBSSxDQUFDVCxTQUFTLEVBQUVPLElBQUksQ0FBQ3pKLFVBQVUsQ0FBQyxDQUFBO1VBQ25EeUosSUFBSSxDQUFDRyxVQUFVLENBQUNDLElBQUksQ0FBQ0osSUFBSSxDQUFDQyxhQUFhLENBQUMsQ0FBQ0ksTUFBTSxFQUFFLENBQUE7QUFDckQsU0FBQyxNQUFNO1VBQ0hMLElBQUksQ0FBQ0MsYUFBYSxDQUFDRyxJQUFJLENBQUNKLElBQUksQ0FBQ3pKLFVBQVUsQ0FBQyxDQUFBO1VBQ3hDeUosSUFBSSxDQUFDRyxVQUFVLENBQUNDLElBQUksQ0FBQ0osSUFBSSxDQUFDeEosT0FBTyxDQUFDLENBQUE7QUFDdEMsU0FBQTtRQUVBd0osSUFBSSxDQUFDbkosUUFBUSxDQUFDeUosV0FBVyxDQUFDTixJQUFJLENBQUNHLFVBQVUsQ0FBQyxDQUFBO0FBQzFDSCxRQUFBQSxJQUFJLENBQUNPLGNBQWMsQ0FBQ0wsSUFBSSxDQUFDRixJQUFJLENBQUNRLE9BQU8sRUFBRVIsSUFBSSxDQUFDRyxVQUFVLENBQUMsQ0FBQTtBQUV2REgsUUFBQUEsSUFBSSxDQUFDUyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUdULElBQUksQ0FBQ0MsYUFBYSxDQUFDUyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDOUNWLFFBQUFBLElBQUksQ0FBQ1MsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHVCxJQUFJLENBQUNDLGFBQWEsQ0FBQ1MsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQzlDVixRQUFBQSxJQUFJLENBQUNTLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBR1QsSUFBSSxDQUFDQyxhQUFhLENBQUNTLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQTtRQUU5Qy9ELE1BQU0sQ0FBQ2dFLE9BQU8sQ0FBQ0wsV0FBVyxDQUFDTixJQUFJLENBQUNPLGNBQWMsQ0FBQyxDQUFBO0FBQ25ELE9BQUE7QUFDSixLQUFDLE1BQU07QUFHSCxNQUFBLElBQUlDLE9BQU8sR0FBRzdELE1BQU0sQ0FBQ2lFLGdCQUFnQixDQUFBO01BQ3JDLElBQUlqRSxNQUFNLENBQUNrRSxtQkFBbUIsRUFBRTtBQUM1QmxFLFFBQUFBLE1BQU0sQ0FBQ2tFLG1CQUFtQixDQUFDTCxPQUFPLEVBQUVNLFdBQVcsQ0FBQyxDQUFBO0FBQ3BELE9BQUE7QUFDQSxNQUFBLElBQUlDLGFBQWEsR0FBR3BFLE1BQU0sQ0FBQ3FFLHlCQUF5QixFQUFFLENBQUE7O0FBR3RELE1BQUEsSUFBSTNCLEtBQUssRUFBRTtRQUNQbUIsT0FBTyxHQUFHbkosYUFBYSxDQUFDNkksSUFBSSxDQUFDakosU0FBUyxFQUFFdUosT0FBTyxDQUFDLENBQUE7UUFDaERPLGFBQWEsR0FBR3pKLGFBQWEsQ0FBQzRJLElBQUksQ0FBQ2pKLFNBQVMsRUFBRThKLGFBQWEsQ0FBQyxDQUFBO0FBQ2hFLE9BQUE7O0FBR0EsTUFBQSxJQUFJLElBQUksQ0FBQ2hKLE1BQU0sQ0FBQ2tKLFVBQVUsS0FBS0MsaUJBQWlCLEVBQUU7UUFDOUNWLE9BQU8sR0FBR2pKLGFBQWEsQ0FBQzJJLElBQUksQ0FBQy9JLGdCQUFnQixFQUFFcUosT0FBTyxDQUFDLENBQUE7UUFDdkRPLGFBQWEsR0FBR3ZKLGFBQWEsQ0FBQzBJLElBQUksQ0FBQy9JLGdCQUFnQixFQUFFNEosYUFBYSxDQUFDLENBQUE7QUFDdkUsT0FBQTtNQUVBLElBQUksQ0FBQzFHLE1BQU0sQ0FBQzhHLFFBQVEsQ0FBQ1gsT0FBTyxDQUFDRSxJQUFJLENBQUMsQ0FBQTtNQUNsQyxJQUFJLENBQUNwRyxZQUFZLENBQUM2RyxRQUFRLENBQUNKLGFBQWEsQ0FBQ0wsSUFBSSxDQUFDLENBQUE7O01BRzlDLElBQUkvRCxNQUFNLENBQUN5RSxrQkFBa0IsRUFBRTtBQUMzQnpFLFFBQUFBLE1BQU0sQ0FBQ3lFLGtCQUFrQixDQUFDN0ssVUFBVSxFQUFFdUssV0FBVyxDQUFDLENBQUE7QUFDdEQsT0FBQyxNQUFNO0FBQ0gsUUFBQSxNQUFNTyxHQUFHLEdBQUcxRSxNQUFNLENBQUNnRCxLQUFLLENBQUMyQixXQUFXLEVBQUUsQ0FBQTtBQUN0QyxRQUFBLE1BQU1DLEdBQUcsR0FBRzVFLE1BQU0sQ0FBQ2dELEtBQUssQ0FBQzZCLFdBQVcsRUFBRSxDQUFBO1FBQ3RDakwsVUFBVSxDQUFDa0wsTUFBTSxDQUFDSixHQUFHLEVBQUVFLEdBQUcsRUFBRTdLLElBQUksQ0FBQ2dMLEdBQUcsQ0FBQyxDQUFBO0FBQ3pDLE9BQUE7TUFDQSxJQUFJLENBQUN6SCxTQUFTLENBQUNrSCxRQUFRLENBQUM1SyxVQUFVLENBQUNtSyxJQUFJLENBQUMsQ0FBQTs7QUFHeENsSyxNQUFBQSxPQUFPLENBQUM0SixJQUFJLENBQUM3SixVQUFVLENBQUMsQ0FBQzhKLE1BQU0sRUFBRSxDQUFBO01BQ2pDLElBQUksQ0FBQzlGLE1BQU0sQ0FBQzRHLFFBQVEsQ0FBQzNLLE9BQU8sQ0FBQ2tLLElBQUksQ0FBQyxDQUFBOztBQUdsQzdKLE1BQUFBLFFBQVEsQ0FBQ3lKLFdBQVcsQ0FBQzlKLE9BQU8sQ0FBQyxDQUFBO01BQzdCLElBQUksQ0FBQ2dFLE9BQU8sQ0FBQzJHLFFBQVEsQ0FBQ3RLLFFBQVEsQ0FBQzZKLElBQUksQ0FBQyxDQUFBOztBQUdwQ3JLLE1BQUFBLFdBQVcsQ0FBQzZKLElBQUksQ0FBQ00sT0FBTyxFQUFFaEssT0FBTyxDQUFDLENBQUE7TUFDbEMsSUFBSSxDQUFDaUUsVUFBVSxDQUFDMEcsUUFBUSxDQUFDOUssV0FBVyxDQUFDcUssSUFBSSxDQUFDLENBQUE7TUFFMUMsSUFBSSxDQUFDaEcsT0FBTyxDQUFDeUcsUUFBUSxDQUFDOUIsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBOztNQUdyQyxJQUFJLENBQUNzQyxlQUFlLENBQUNoRixNQUFNLENBQUNnRCxLQUFLLENBQUMyQixXQUFXLEVBQUUsQ0FBQyxDQUFBO0FBRWhEM0UsTUFBQUEsTUFBTSxDQUFDZ0UsT0FBTyxDQUFDTCxXQUFXLENBQUNqSyxXQUFXLENBQUMsQ0FBQTtBQUMzQyxLQUFBO0lBRUEsSUFBSSxDQUFDc0UsUUFBUSxDQUFDd0csUUFBUSxDQUFDOUIsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBOztBQUd0QyxJQUFBLE1BQU11QyxDQUFDLEdBQUdqRixNQUFNLENBQUNrRixTQUFTLENBQUE7QUFDMUIsSUFBQSxNQUFNQyxDQUFDLEdBQUduRixNQUFNLENBQUNvRixRQUFRLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNuSCxVQUFVLENBQUN1RyxRQUFRLENBQUNTLENBQUMsQ0FBQyxDQUFBO0FBQzNCLElBQUEsSUFBSSxDQUFDL0csU0FBUyxDQUFDc0csUUFBUSxDQUFDVyxDQUFDLENBQUMsQ0FBQTs7SUFHMUIsSUFBSSxDQUFDaEgsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBR2dILENBQUMsQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ2hILFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR2dILENBQUMsQ0FBQTtBQUN4QixJQUFBLElBQUksQ0FBQ2hILFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBRzhHLENBQUMsQ0FBQTtBQUN4QixJQUFBLElBQUksQ0FBQzlHLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBRzZCLE1BQU0sQ0FBQ3FGLFVBQVUsS0FBS0MsdUJBQXVCLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUM1RSxJQUFJLENBQUNsSCxjQUFjLENBQUNvRyxRQUFRLENBQUMsSUFBSSxDQUFDckcsWUFBWSxDQUFDLENBQUE7O0lBRy9DLElBQUksQ0FBQ0ksVUFBVSxDQUFDaUcsUUFBUSxDQUFDLElBQUksQ0FBQ25KLEtBQUssQ0FBQ2tLLGFBQWEsR0FBR3ZGLE1BQU0sQ0FBQ3dGLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQ25LLEtBQUssQ0FBQ29LLFFBQVEsQ0FBQyxDQUFBO0FBRS9GLElBQUEsSUFBSSxJQUFJLENBQUNySyxNQUFNLENBQUNzSyxzQkFBc0IsRUFBRTtBQUNwQyxNQUFBLElBQUksQ0FBQ0MsdUJBQXVCLENBQUNyRSxZQUFZLEVBQUVxQixTQUFTLENBQUMsQ0FBQTtBQUN6RCxLQUFBO0FBQ0osR0FBQTs7RUFLQWlELFNBQVMsQ0FBQzVGLE1BQU0sRUFBRXlDLE1BQU0sRUFBRXBCLEtBQUssRUFBRUMsWUFBWSxHQUFHLElBQUksRUFBRTtJQUVsRCxJQUFJLENBQUNrQixpQkFBaUIsQ0FBQ3hDLE1BQU0sRUFBRXlDLE1BQU0sRUFBRW5CLFlBQVksQ0FBQyxDQUFBO0lBQ3BELElBQUksQ0FBQ3VFLFNBQVMsQ0FBQzdGLE1BQU0sRUFBRXlDLE1BQU0sRUFBRXBCLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUNoRCxHQUFBOztFQUlBd0UsU0FBUyxDQUFDN0YsTUFBTSxFQUFFeUMsTUFBTSxFQUFFcEIsS0FBSyxFQUFFeUUsVUFBVSxFQUFFO0FBRXpDLElBQUEsTUFBTTFLLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtBQUMxQjhFLElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDL0UsTUFBTSxFQUFFLFlBQVksQ0FBQyxDQUFBO0FBRWpEQSxJQUFBQSxNQUFNLENBQUMySyxlQUFlLENBQUN0RCxNQUFNLENBQUMsQ0FBQTtJQUM5QnJILE1BQU0sQ0FBQzRLLFdBQVcsRUFBRSxDQUFBO0FBRXBCLElBQUEsSUFBSUYsVUFBVSxFQUFFO01BQ1oxSyxNQUFNLENBQUM2SyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDNUM3SyxNQUFBQSxNQUFNLENBQUM4SyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDOUIsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDbkcsYUFBYSxDQUFDQyxNQUFNLEVBQUV5QyxNQUFNLENBQUMsQ0FBQTtBQUVsQyxJQUFBLElBQUlwQixLQUFLLEVBQUU7QUFFUCxNQUFBLE1BQU04RSxPQUFPLEdBQUduRyxNQUFNLENBQUNvRyxhQUFhLENBQUE7QUFFcENoTCxNQUFBQSxNQUFNLENBQUNpRyxLQUFLLENBQUM4RSxPQUFPLEdBQUdBLE9BQU8sR0FBRztRQUM3QnJFLEtBQUssRUFBRSxDQUFDOUIsTUFBTSxDQUFDK0IsV0FBVyxDQUFDQyxDQUFDLEVBQUVoQyxNQUFNLENBQUMrQixXQUFXLENBQUNFLENBQUMsRUFBRWpDLE1BQU0sQ0FBQytCLFdBQVcsQ0FBQ0csQ0FBQyxFQUFFbEMsTUFBTSxDQUFDK0IsV0FBVyxDQUFDSSxDQUFDLENBQUM7UUFDL0ZDLEtBQUssRUFBRXBDLE1BQU0sQ0FBQ3FDLFdBQVc7UUFDekJkLEtBQUssRUFBRSxDQUFDdkIsTUFBTSxDQUFDcUcsaUJBQWlCLEdBQUc1RSxlQUFlLEdBQUcsQ0FBQyxLQUM5Q3pCLE1BQU0sQ0FBQ3NHLGlCQUFpQixHQUFHM0UsZUFBZSxHQUFHLENBQUMsQ0FBQyxJQUMvQzNCLE1BQU0sQ0FBQ3VHLG1CQUFtQixHQUFHMUUsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1FBQzNEUyxPQUFPLEVBQUV0QyxNQUFNLENBQUN1QyxhQUFBQTtBQUNwQixPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUE7QUFFQXJDLElBQUFBLGFBQWEsQ0FBQ2tCLFlBQVksQ0FBQ2hHLE1BQU0sQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7QUFFQW9MLEVBQUFBLFdBQVcsQ0FBQ0MsU0FBUyxFQUFFQyxJQUFJLEVBQUVDLFFBQVEsRUFBRTtBQUNuQyxJQUFBLE1BQU1DLFFBQVEsR0FBR0QsUUFBUSxDQUFDQyxRQUFRLENBQUE7SUFDbEMsSUFBSUMsSUFBSSxHQUFHQyxhQUFhLENBQUE7QUFDeEIsSUFBQSxJQUFJTCxTQUFTLEVBQUU7TUFDWCxJQUFJTSxTQUFTLEdBQUcsQ0FBQyxDQUFBO01BRWpCLElBQUlILFFBQVEsQ0FBQ0ksSUFBSSxHQUFHRixhQUFhLElBQUlGLFFBQVEsQ0FBQ0ksSUFBSSxHQUFHQyxxQkFBcUIsRUFBRTtBQUN4RSxRQUFBLElBQUlOLFFBQVEsQ0FBQ0ksU0FBUyxFQUNsQkEsU0FBUyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBRW5CLFFBQUEsSUFBSUwsSUFBSSxFQUNKSyxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUE7QUFFbkIsUUFBQSxNQUFNRyxFQUFFLEdBQUdQLFFBQVEsQ0FBQ1EsSUFBSSxDQUFDQyxjQUFjLENBQUE7QUFDdkNGLFFBQUFBLEVBQUUsQ0FBQ0csSUFBSSxDQUFDdk4sU0FBUyxDQUFDLENBQUE7QUFDbEJvTixRQUFBQSxFQUFFLENBQUNJLElBQUksQ0FBQ3ROLFNBQVMsQ0FBQyxDQUFBO0FBQ2xCa04sUUFBQUEsRUFBRSxDQUFDSyxJQUFJLENBQUN0TixTQUFTLENBQUMsQ0FBQTtBQUNsQkgsUUFBQUEsU0FBUyxDQUFDME4sS0FBSyxDQUFDMU4sU0FBUyxFQUFFRSxTQUFTLENBQUMsQ0FBQTtRQUNyQyxJQUFJRixTQUFTLENBQUMyTixHQUFHLENBQUN4TixTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUU7VUFDOUI4TSxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDbkIsU0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJQSxTQUFTLEdBQUcsQ0FBQyxFQUFFO1FBQ2ZGLElBQUksR0FBR0QsUUFBUSxDQUFDSSxJQUFJLEtBQUtVLGNBQWMsR0FBR0MsYUFBYSxHQUFHRCxjQUFjLENBQUE7QUFDNUUsT0FBQyxNQUFNO1FBQ0hiLElBQUksR0FBR0QsUUFBUSxDQUFDSSxJQUFJLENBQUE7QUFDeEIsT0FBQTtBQUNKLEtBQUE7QUFDQSxJQUFBLElBQUksQ0FBQzVMLE1BQU0sQ0FBQ29MLFdBQVcsQ0FBQ0ssSUFBSSxDQUFDLENBQUE7SUFFN0IsSUFBSUEsSUFBSSxLQUFLQyxhQUFhLElBQUlGLFFBQVEsQ0FBQ0ksSUFBSSxLQUFLRixhQUFhLEVBQUU7QUFDM0QsTUFBQSxNQUFNYyxHQUFHLEdBQUdqQixRQUFRLENBQUNRLElBQUksQ0FBQ0MsY0FBYyxDQUFBO0FBQ3hDUSxNQUFBQSxHQUFHLENBQUNQLElBQUksQ0FBQ3ZOLFNBQVMsQ0FBQyxDQUFBO0FBQ25COE4sTUFBQUEsR0FBRyxDQUFDTixJQUFJLENBQUN0TixTQUFTLENBQUMsQ0FBQTtBQUNuQjROLE1BQUFBLEdBQUcsQ0FBQ0wsSUFBSSxDQUFDdE4sU0FBUyxDQUFDLENBQUE7QUFDbkJILE1BQUFBLFNBQVMsQ0FBQzBOLEtBQUssQ0FBQzFOLFNBQVMsRUFBRUUsU0FBUyxDQUFDLENBQUE7QUFDckMsTUFBQSxJQUFJLENBQUN3RSxnQ0FBZ0MsQ0FBQ2dHLFFBQVEsQ0FBQzFLLFNBQVMsQ0FBQzJOLEdBQUcsQ0FBQ3hOLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUM3RixLQUFBO0FBQ0osR0FBQTtFQUVBNE4sbUJBQW1CLENBQUM3SCxNQUFNLEVBQUU7SUFFeEIsSUFBSUEsTUFBTSxDQUFDNEMsRUFBRSxJQUFJNUMsTUFBTSxDQUFDNEMsRUFBRSxDQUFDTSxLQUFLLENBQUNDLE1BQU0sRUFBRTtNQUVyQyxNQUFNRSxJQUFJLEdBQUdyRCxNQUFNLENBQUM0QyxFQUFFLENBQUNNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUMvQnhKLFdBQVcsQ0FBQzZKLElBQUksQ0FBQ0YsSUFBSSxDQUFDUSxPQUFPLEVBQUVSLElBQUksQ0FBQ0csVUFBVSxDQUFDLENBQUE7QUFDL0N4RCxNQUFBQSxNQUFNLENBQUNnRSxPQUFPLENBQUNMLFdBQVcsQ0FBQ2pLLFdBQVcsQ0FBQyxDQUFBO0FBQ3ZDLE1BQUEsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE1BQU1tSyxPQUFPLEdBQUc3RCxNQUFNLENBQUNpRSxnQkFBZ0IsQ0FBQTtJQUN2QyxJQUFJakUsTUFBTSxDQUFDa0UsbUJBQW1CLEVBQUU7QUFDNUJsRSxNQUFBQSxNQUFNLENBQUNrRSxtQkFBbUIsQ0FBQ0wsT0FBTyxFQUFFTSxXQUFXLENBQUMsQ0FBQTtBQUNwRCxLQUFBO0lBRUEsSUFBSW5FLE1BQU0sQ0FBQ3lFLGtCQUFrQixFQUFFO0FBQzNCekUsTUFBQUEsTUFBTSxDQUFDeUUsa0JBQWtCLENBQUM3SyxVQUFVLEVBQUV1SyxXQUFXLENBQUMsQ0FBQTtBQUN0RCxLQUFDLE1BQU07QUFDSCxNQUFBLE1BQU1PLEdBQUcsR0FBRzFFLE1BQU0sQ0FBQ2dELEtBQUssQ0FBQzJCLFdBQVcsRUFBRSxDQUFBO0FBQ3RDLE1BQUEsTUFBTUMsR0FBRyxHQUFHNUUsTUFBTSxDQUFDZ0QsS0FBSyxDQUFDNkIsV0FBVyxFQUFFLENBQUE7TUFDdENqTCxVQUFVLENBQUNrTCxNQUFNLENBQUNKLEdBQUcsRUFBRUUsR0FBRyxFQUFFN0ssSUFBSSxDQUFDZ0wsR0FBRyxDQUFDLENBQUE7TUFDckMsSUFBSSxDQUFDekgsU0FBUyxDQUFDa0gsUUFBUSxDQUFDNUssVUFBVSxDQUFDbUssSUFBSSxDQUFDLENBQUE7QUFDNUMsS0FBQTtBQUNBbEssSUFBQUEsT0FBTyxDQUFDNEosSUFBSSxDQUFDN0osVUFBVSxDQUFDLENBQUM4SixNQUFNLEVBQUUsQ0FBQTtBQUVqQ2hLLElBQUFBLFdBQVcsQ0FBQzZKLElBQUksQ0FBQ00sT0FBTyxFQUFFaEssT0FBTyxDQUFDLENBQUE7QUFDbENtRyxJQUFBQSxNQUFNLENBQUNnRSxPQUFPLENBQUNMLFdBQVcsQ0FBQ2pLLFdBQVcsQ0FBQyxDQUFBO0FBQzNDLEdBQUE7QUFFQW9PLEVBQUFBLGdCQUFnQixDQUFDMU0sTUFBTSxFQUFFd0wsUUFBUSxFQUFFO0FBRy9CeEwsSUFBQUEsTUFBTSxDQUFDb0wsV0FBVyxDQUFDSSxRQUFRLENBQUNJLElBQUksQ0FBQyxDQUFBOztJQUdqQyxJQUFJSixRQUFRLENBQUNtQixVQUFVLEVBQUU7TUFDckIsSUFBSSxDQUFDekosWUFBWSxDQUFDa0csUUFBUSxDQUFDb0MsUUFBUSxDQUFDbUIsVUFBVSxDQUFDLENBQUE7TUFDL0MsSUFBSSxDQUFDMUosV0FBVyxDQUFDbUcsUUFBUSxDQUFDb0MsUUFBUSxDQUFDb0IsU0FBUyxDQUFDLENBQUE7QUFDakQsS0FBQTtBQUNKLEdBQUE7RUFFQUMscUJBQXFCLENBQUNDLFNBQVMsRUFBRTtBQUU3QjFPLElBQUFBLGdCQUFnQixFQUFFLENBQUE7QUFFbEIsSUFBQSxNQUFNMk8sY0FBYyxHQUFHRCxTQUFTLENBQUMvRSxNQUFNLENBQUE7SUFDdkMsSUFBSWdGLGNBQWMsS0FBSyxDQUFDLEVBQUUsT0FBQTtJQUcxQixNQUFNQyxRQUFRLEdBQUdDLEdBQUcsRUFBRSxDQUFBO0lBR3RCLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSCxjQUFjLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBQ3JDLE1BQUEsTUFBTUMsRUFBRSxHQUFHTCxTQUFTLENBQUNJLENBQUMsQ0FBQyxDQUFDRSxZQUFZLENBQUE7QUFDcEMsTUFBQSxJQUFJRCxFQUFFLEVBQUU7UUFDSkEsRUFBRSxDQUFDRSxjQUFjLENBQUNQLFNBQVMsQ0FBQ0ksQ0FBQyxDQUFDLENBQUNuQixJQUFJLEVBQUUzTixnQkFBZ0IsQ0FBQyxDQUFBO1FBQ3REK08sRUFBRSxDQUFDRyxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ3BCLE9BQUE7QUFDSixLQUFBO0FBR0EsSUFBQSxJQUFJLENBQUN4TSxTQUFTLElBQUltTSxHQUFHLEVBQUUsR0FBR0QsUUFBUSxDQUFBO0FBRXRDLEdBQUE7RUFFQU8scUJBQXFCLENBQUNULFNBQVMsRUFBRTtJQUU3QixNQUFNRSxRQUFRLEdBQUdDLEdBQUcsRUFBRSxDQUFBO0FBR3RCLElBQUEsTUFBTU8sS0FBSyxHQUFHVixTQUFTLENBQUMvRSxNQUFNLENBQUE7SUFDOUIsS0FBSyxJQUFJbUYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHTSxLQUFLLEVBQUVOLENBQUMsRUFBRSxFQUFFO0FBQzVCLE1BQUEsTUFBTTNCLFFBQVEsR0FBR3VCLFNBQVMsQ0FBQ0ksQ0FBQyxDQUFDLENBQUE7TUFDN0IsSUFBSTNCLFFBQVEsQ0FBQ2tDLGdCQUFnQixFQUFFO0FBQzNCLFFBQUEsTUFBTUMsSUFBSSxHQUFHbkMsUUFBUSxDQUFDNkIsWUFBWSxDQUFBO0FBQ2xDLFFBQUEsSUFBSU0sSUFBSSxJQUFJQSxJQUFJLENBQUNKLE1BQU0sRUFBRTtVQUNyQkksSUFBSSxDQUFDQyxtQkFBbUIsQ0FBQ3BDLFFBQVEsQ0FBQ1EsSUFBSSxFQUFFM04sZ0JBQWdCLENBQUMsQ0FBQTtVQUN6RHNQLElBQUksQ0FBQ0osTUFBTSxHQUFHLEtBQUssQ0FBQTtBQUN2QixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFHQSxJQUFBLElBQUksQ0FBQ3hNLFNBQVMsSUFBSW1NLEdBQUcsRUFBRSxHQUFHRCxRQUFRLENBQUE7QUFFdEMsR0FBQTtFQUVBWSxjQUFjLENBQUNkLFNBQVMsRUFBRTtJQUV0QixNQUFNZSxTQUFTLEdBQUdaLEdBQUcsRUFBRSxDQUFBO0FBR3ZCLElBQUEsTUFBTUYsY0FBYyxHQUFHRCxTQUFTLENBQUMvRSxNQUFNLENBQUE7SUFDdkMsS0FBSyxJQUFJbUYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSCxjQUFjLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBQ3JDLE1BQUEsTUFBTTNCLFFBQVEsR0FBR3VCLFNBQVMsQ0FBQ0ksQ0FBQyxDQUFDLENBQUE7QUFDN0IsTUFBQSxNQUFNWSxTQUFTLEdBQUd2QyxRQUFRLENBQUN3QyxhQUFhLENBQUE7TUFDeEMsSUFBSUQsU0FBUyxJQUFJQSxTQUFTLENBQUNSLE1BQU0sSUFBSS9CLFFBQVEsQ0FBQ2tDLGdCQUFnQixFQUFFO1FBQzVESyxTQUFTLENBQUNFLE1BQU0sRUFBRSxDQUFBO0FBQ3RCLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUNqTixVQUFVLElBQUlrTSxHQUFHLEVBQUUsR0FBR1ksU0FBUyxDQUFBO0FBRXhDLEdBQUE7RUFFQUksU0FBUyxDQUFDbkIsU0FBUyxFQUFFO0FBRWpCLElBQUEsSUFBSSxDQUFDUyxxQkFBcUIsQ0FBQ1QsU0FBUyxDQUFDLENBQUE7QUFDckMsSUFBQSxJQUFJLENBQUNjLGNBQWMsQ0FBQ2QsU0FBUyxDQUFDLENBQUE7QUFDbEMsR0FBQTtBQUVBb0IsRUFBQUEsZ0JBQWdCLENBQUNsTyxNQUFNLEVBQUV1RSxJQUFJLEVBQUU7QUFHM0J2RSxJQUFBQSxNQUFNLENBQUNtTyxlQUFlLENBQUM1SixJQUFJLENBQUM2SixZQUFZLENBQUMsQ0FBQTtBQUM3QyxHQUFBO0FBRUFDLEVBQUFBLFdBQVcsQ0FBQ3JPLE1BQU0sRUFBRStOLGFBQWEsRUFBRTtBQUUvQixJQUFBLElBQUlBLGFBQWEsRUFBRTtBQUVmLE1BQUEsSUFBSUEsYUFBYSxDQUFDTyxLQUFLLENBQUNDLGVBQWUsRUFBRTtRQUdyQ3ZPLE1BQU0sQ0FBQ21PLGVBQWUsQ0FBQ0osYUFBYSxDQUFDTyxLQUFLLENBQUNFLGVBQWUsQ0FBQyxDQUFBOztRQUczRCxJQUFJLENBQUNqTCxnQkFBZ0IsQ0FBQzZGLFFBQVEsQ0FBQzJFLGFBQWEsQ0FBQ1UsZ0JBQWdCLENBQUMsQ0FBQTtRQUM5RCxJQUFJLENBQUNqTCxjQUFjLENBQUM0RixRQUFRLENBQUMyRSxhQUFhLENBQUNXLGNBQWMsQ0FBQyxDQUFBOztRQUcxRCxJQUFJLENBQUNqTCxjQUFjLENBQUMyRixRQUFRLENBQUMyRSxhQUFhLENBQUNZLGNBQWMsQ0FBQyxDQUFBO0FBRTlELE9BQUMsTUFBTTs7QUFFSCxRQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHYixhQUFhLENBQUNjLG9CQUFvQixDQUFDOUcsTUFBTSxFQUFFNkcsQ0FBQyxFQUFFLEVBQUU7QUFFaEUsVUFBQSxNQUFNRSxFQUFFLEdBQUdmLGFBQWEsQ0FBQ2Msb0JBQW9CLENBQUNELENBQUMsQ0FBQyxDQUFBO0FBQ2hELFVBQUEsSUFBSUUsRUFBRSxFQUFFO0FBR0osWUFBQSxNQUFNQyxRQUFRLEdBQUdDLGFBQWEsSUFBSUosQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO1lBQ3hDRSxFQUFFLENBQUNHLE1BQU0sQ0FBQ0MsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDQyxJQUFJLEdBQUdKLFFBQVEsQ0FBQTtBQUNyQ0QsWUFBQUEsRUFBRSxDQUFDRyxNQUFNLENBQUNDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQ0UsT0FBTyxHQUFHcFAsTUFBTSxDQUFDMkIsS0FBSyxDQUFDRSxPQUFPLENBQUNrTixRQUFRLENBQUMsQ0FBQTtBQUM5REQsWUFBQUEsRUFBRSxDQUFDRyxNQUFNLENBQUNqQixNQUFNLEVBQUUsQ0FBQTtBQUVsQmhPLFlBQUFBLE1BQU0sQ0FBQ21PLGVBQWUsQ0FBQ1csRUFBRSxDQUFDLENBQUE7QUFDOUIsV0FBQTtBQUNKLFNBQUE7O1FBR0EsSUFBSSxDQUFDekwsYUFBYSxDQUFDK0YsUUFBUSxDQUFDMkUsYUFBYSxDQUFDc0Isb0JBQW9CLENBQUMsQ0FBQTtRQUMvRCxJQUFJLENBQUMvTCxhQUFhLENBQUM4RixRQUFRLENBQUMyRSxhQUFhLENBQUN1QixvQkFBb0IsQ0FBQyxDQUFBO0FBQ25FLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBQyxFQUFBQSxXQUFXLENBQUN2UCxNQUFNLEVBQUV3UCxZQUFZLEVBQUU7SUFDOUIsSUFBSUEsWUFBWSxDQUFDcEMsWUFBWSxFQUFFO01BQzNCLElBQUksQ0FBQy9MLGNBQWMsRUFBRSxDQUFBO01BQ3JCLElBQUlyQixNQUFNLENBQUN5UCxvQkFBb0IsRUFBRTtBQUM3QixRQUFBLE1BQU1DLFdBQVcsR0FBR0YsWUFBWSxDQUFDcEMsWUFBWSxDQUFDc0MsV0FBVyxDQUFBO0FBQ3pELFFBQUEsSUFBSSxDQUFDOU4sYUFBYSxDQUFDd0gsUUFBUSxDQUFDc0csV0FBVyxDQUFDLENBQUE7QUFDeENyUixRQUFBQSxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUdxUixXQUFXLENBQUN6SyxLQUFLLENBQUE7QUFDdEM1RyxRQUFBQSxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUdxUixXQUFXLENBQUN2SyxNQUFNLENBQUE7UUFDdkM5RyxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHcVIsV0FBVyxDQUFDekssS0FBSyxDQUFBO1FBQzVDNUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBR3FSLFdBQVcsQ0FBQ3ZLLE1BQU0sQ0FBQTtBQUM3QyxRQUFBLElBQUksQ0FBQ3JELGlCQUFpQixDQUFDc0gsUUFBUSxDQUFDL0ssZUFBZSxDQUFDLENBQUE7QUFDcEQsT0FBQyxNQUFNO1FBQ0gsSUFBSSxDQUFDMEQsWUFBWSxDQUFDcUgsUUFBUSxDQUFDb0csWUFBWSxDQUFDcEMsWUFBWSxDQUFDdUMsYUFBYSxDQUFDLENBQUE7QUFDdkUsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztFQUdBL0YsZUFBZSxDQUFDbEIsUUFBUSxFQUFFO0FBQ3RCLElBQUEsTUFBTWtILEVBQUUsR0FBRyxJQUFJLENBQUN6TixPQUFPLENBQUE7QUFDdkJ5TixJQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUdsSCxRQUFRLENBQUNyRCxDQUFDLENBQUE7QUFDbEJ1SyxJQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUdsSCxRQUFRLENBQUNsRCxDQUFDLENBQUE7QUFDbEJvSyxJQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUdsSCxRQUFRLENBQUNoRCxDQUFDLENBQUE7QUFDbEIsSUFBQSxJQUFJLENBQUNyRCxTQUFTLENBQUMrRyxRQUFRLENBQUN3RyxFQUFFLENBQUMsQ0FBQTtBQUMvQixHQUFBO0FBRUFDLEVBQUFBLHVCQUF1QixHQUFHO0lBRXRCLElBQUksSUFBSSxDQUFDN1AsTUFBTSxDQUFDc0ssc0JBQXNCLElBQUksQ0FBQyxJQUFJLENBQUMxSixpQkFBaUIsRUFBRTtBQUcvRCxNQUFBLElBQUksQ0FBQ0EsaUJBQWlCLEdBQUcsSUFBSWtQLG1CQUFtQixDQUFDLElBQUksQ0FBQzlQLE1BQU0sRUFBRSxDQUMxRCxJQUFJK1AsYUFBYSxDQUFDLHVCQUF1QixFQUFFQyxnQkFBZ0IsQ0FBQyxDQUMvRCxDQUFDLENBQUE7O0FBR0YsTUFBQSxJQUFJLENBQUNuUCxtQkFBbUIsR0FBRyxJQUFJb1AsZUFBZSxDQUFDLElBQUksQ0FBQ2pRLE1BQU0sRUFBRSxDQUN4RCxJQUFJa1EsZ0JBQWdCLENBQUNDLGdDQUFnQyxFQUFFQyxrQkFBa0IsR0FBR0Msb0JBQW9CLENBQUMsQ0FDcEcsRUFBRSxDQUNDLElBQUlDLGlCQUFpQixDQUFDLG9CQUFvQixFQUFFRCxvQkFBb0IsRUFBRUUsbUJBQW1CLEVBQUVDLDZCQUE2QixDQUFDLENBQ3hILENBQUMsQ0FBQTtBQUNOLEtBQUE7QUFDSixHQUFBO0FBRUFqRyxFQUFBQSx1QkFBdUIsQ0FBQ3JFLFlBQVksRUFBRXFCLFNBQVMsRUFBRTtBQUU3Q2tKLElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDeEssWUFBWSxFQUFFLDZCQUE2QixDQUFDLENBQUE7QUFDekQsSUFBQSxJQUFJQSxZQUFZLEVBQUU7QUFFZCxNQUFBLE1BQU1sRyxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7TUFDMUJ5USxLQUFLLENBQUNDLE1BQU0sQ0FBQ25KLFNBQVMsS0FBSyxDQUFDLEVBQUUsNkNBQTZDLENBQUMsQ0FBQTtBQUU1RSxNQUFBLE9BQU9yQixZQUFZLENBQUN5SyxjQUFjLENBQUM1SSxNQUFNLEdBQUdSLFNBQVMsRUFBRTtRQUNuRCxNQUFNcUosRUFBRSxHQUFHLElBQUlDLGFBQWEsQ0FBQzdRLE1BQU0sRUFBRSxJQUFJLENBQUNZLGlCQUFpQixDQUFDLENBQUE7QUFDNUQsUUFBQSxNQUFNa1EsRUFBRSxHQUFHLElBQUlDLFNBQVMsQ0FBQy9RLE1BQU0sRUFBRSxJQUFJLENBQUNhLG1CQUFtQixFQUFFK1AsRUFBRSxDQUFDLENBQUE7UUFDOURJLFdBQVcsQ0FBQ0MsT0FBTyxDQUFDSCxFQUFFLEVBQUcsaUJBQWdCQSxFQUFFLENBQUN0TSxFQUFHLENBQUEsQ0FBQyxDQUFDLENBQUE7QUFDakQwQixRQUFBQSxZQUFZLENBQUN5SyxjQUFjLENBQUNPLElBQUksQ0FBQ0osRUFBRSxDQUFDLENBQUE7QUFDeEMsT0FBQTs7QUFHQSxNQUFBLE1BQU1LLGFBQWEsR0FBR2pMLFlBQVksQ0FBQ3lLLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNwRFEsTUFBQUEsYUFBYSxDQUFDQyxvQkFBb0IsQ0FBQ3BELE1BQU0sRUFBRSxDQUFBO01BQzNDbUQsYUFBYSxDQUFDbkQsTUFBTSxFQUFFLENBQUE7O0FBR3RCaE8sTUFBQUEsTUFBTSxDQUFDcVIsWUFBWSxDQUFDQyxjQUFjLEVBQUVILGFBQWEsQ0FBQyxDQUFBO0FBQ3RELEtBQUE7QUFDSixHQUFBO0VBRUFJLFlBQVksQ0FBQ3ZSLE1BQU0sRUFBRXdQLFlBQVksRUFBRWpMLElBQUksRUFBRWlOLEtBQUssRUFBRUMsTUFBTSxFQUFFO0lBRXBEM00sYUFBYSxDQUFDQyxhQUFhLENBQUMvRSxNQUFNLEVBQUV3UCxZQUFZLENBQUN6RCxJQUFJLENBQUNvRCxJQUFJLENBQUMsQ0FBQTtBQUUzRCxJQUFBLE1BQU11QyxjQUFjLEdBQUdsQyxZQUFZLENBQUNrQyxjQUFjLENBQUE7QUFDbEQsSUFBQSxJQUFJQSxjQUFjLEVBQUU7QUFDaEIsTUFBQSxJQUFJQSxjQUFjLENBQUNsRSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1FBQzFCLElBQUksQ0FBQ2xNLG1CQUFtQixFQUFFLENBQUE7QUFDMUJ0QixRQUFBQSxNQUFNLENBQUNtTyxlQUFlLENBQUN1RCxjQUFjLENBQUN0RCxZQUFZLENBQUMsQ0FBQTtBQUNuRHBPLFFBQUFBLE1BQU0sQ0FBQzJSLElBQUksQ0FBQ3BOLElBQUksQ0FBQ3FOLFNBQVMsQ0FBQ0osS0FBSyxDQUFDLEVBQUVFLGNBQWMsQ0FBQ2xFLEtBQUssQ0FBQyxDQUFBO0FBQzVELE9BQUE7QUFDSixLQUFDLE1BQU07QUFDSCxNQUFBLE1BQU1xRSxXQUFXLEdBQUdyQyxZQUFZLENBQUN6RCxJQUFJLENBQUNDLGNBQWMsQ0FBQTtNQUNwRCxJQUFJLENBQUNoSyxhQUFhLENBQUNvSCxRQUFRLENBQUN5SSxXQUFXLENBQUNsSixJQUFJLENBQUMsQ0FBQTtBQUU3QyxNQUFBLElBQUk4SSxNQUFNLEVBQUU7QUFDUixRQUFBLElBQUksQ0FBQ3hQLGNBQWMsQ0FBQ21ILFFBQVEsQ0FBQ29HLFlBQVksQ0FBQ3pELElBQUksQ0FBQytGLFlBQVksQ0FBQ25KLElBQUksQ0FBQyxDQUFBO0FBQ3JFLE9BQUE7TUFFQTNJLE1BQU0sQ0FBQzJSLElBQUksQ0FBQ3BOLElBQUksQ0FBQ3FOLFNBQVMsQ0FBQ0osS0FBSyxDQUFDLENBQUMsQ0FBQTtBQUN0QyxLQUFBO0FBRUExTSxJQUFBQSxhQUFhLENBQUNrQixZQUFZLENBQUNoRyxNQUFNLENBQUMsQ0FBQTtBQUN0QyxHQUFBOztFQUdBK1IsYUFBYSxDQUFDL1IsTUFBTSxFQUFFd1AsWUFBWSxFQUFFakwsSUFBSSxFQUFFaU4sS0FBSyxFQUFFO0lBRTdDMU0sYUFBYSxDQUFDQyxhQUFhLENBQUMvRSxNQUFNLEVBQUV3UCxZQUFZLENBQUN6RCxJQUFJLENBQUNvRCxJQUFJLENBQUMsQ0FBQTtBQUUzRCxJQUFBLE1BQU11QyxjQUFjLEdBQUdsQyxZQUFZLENBQUNrQyxjQUFjLENBQUE7QUFDbEQsSUFBQSxJQUFJQSxjQUFjLEVBQUU7QUFDaEIsTUFBQSxJQUFJQSxjQUFjLENBQUNsRSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1FBQzFCLElBQUksQ0FBQ2xNLG1CQUFtQixFQUFFLENBQUE7QUFDMUJ0QixRQUFBQSxNQUFNLENBQUMyUixJQUFJLENBQUNwTixJQUFJLENBQUNxTixTQUFTLENBQUNKLEtBQUssQ0FBQyxFQUFFRSxjQUFjLENBQUNsRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbEUsT0FBQTtBQUNKLEtBQUMsTUFBTTtBQUVIeE4sTUFBQUEsTUFBTSxDQUFDMlIsSUFBSSxDQUFDcE4sSUFBSSxDQUFDcU4sU0FBUyxDQUFDSixLQUFLLENBQUMsRUFBRVEsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3ZELEtBQUE7QUFFQWxOLElBQUFBLGFBQWEsQ0FBQ2tCLFlBQVksQ0FBQ2hHLE1BQU0sQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7QUFFQTRMLEVBQUFBLElBQUksQ0FBQ2hILE1BQU0sRUFBRWtJLFNBQVMsRUFBRW1GLFdBQVcsRUFBRTtJQUVqQyxNQUFNQyxRQUFRLEdBQUdqRixHQUFHLEVBQUUsQ0FBQTtJQUN0QixJQUFJa0Ysa0JBQWtCLEdBQUcsQ0FBQyxDQUFBO0lBRzFCLElBQUlDLGFBQWEsR0FBRyxDQUFDLENBQUE7QUFDckIsSUFBQSxNQUFNckYsY0FBYyxHQUFHRCxTQUFTLENBQUMvRSxNQUFNLENBQUE7QUFFdkMsSUFBQSxNQUFNc0ssV0FBVyxHQUFHek4sTUFBTSxDQUFDeU4sV0FBVyxJQUFJLFVBQVUsQ0FBQTs7QUFFcEQsSUFBQSxJQUFJLENBQUN6TixNQUFNLENBQUMwTixjQUFjLEVBQUU7TUFDeEIsS0FBSyxJQUFJcEYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSCxjQUFjLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBRXJDLFFBQUEsTUFBTTNCLFFBQVEsR0FBR3VCLFNBQVMsQ0FBQ0ksQ0FBQyxDQUFDLENBQUE7UUFDN0IsSUFBSSxDQUFDM0IsUUFBUSxDQUFDZ0gsT0FBTyxJQUFJLENBQUNoSCxRQUFRLENBQUNpSCxPQUFPLEVBQUUsU0FBQTs7QUFHNUMsUUFBQSxJQUFJakgsUUFBUSxDQUFDa0gsSUFBSSxJQUFJLENBQUNsSCxRQUFRLENBQUNrSCxJQUFJLEdBQUdKLFdBQVcsTUFBTSxDQUFDLEVBQUUsU0FBQTtBQUUxREosUUFBQUEsV0FBVyxDQUFDRyxhQUFhLENBQUMsR0FBRzdHLFFBQVEsQ0FBQTtBQUNyQzZHLFFBQUFBLGFBQWEsRUFBRSxDQUFBO1FBQ2Y3RyxRQUFRLENBQUNrQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDcEMsT0FBQTtBQUNBLE1BQUEsT0FBTzJFLGFBQWEsQ0FBQTtBQUN4QixLQUFBO0lBRUEsS0FBSyxJQUFJbEYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSCxjQUFjLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBQ3JDLE1BQUEsTUFBTTNCLFFBQVEsR0FBR3VCLFNBQVMsQ0FBQ0ksQ0FBQyxDQUFDLENBQUE7QUFDN0IsTUFBQSxJQUFJLENBQUMzQixRQUFRLENBQUNpSCxPQUFPLEVBQUU7QUFDbkIsUUFBQSxJQUFJLENBQUNqSCxRQUFRLENBQUNnSCxPQUFPLEVBQUUsU0FBQTtRQUN2QixJQUFJQSxPQUFPLEdBQUcsSUFBSSxDQUFBOztBQUdsQixRQUFBLElBQUloSCxRQUFRLENBQUNrSCxJQUFJLElBQUksQ0FBQ2xILFFBQVEsQ0FBQ2tILElBQUksR0FBR0osV0FBVyxNQUFNLENBQUMsRUFBRSxTQUFBO1FBRTFELElBQUk5RyxRQUFRLENBQUNLLElBQUksRUFBRTtBQUNmMkcsVUFBQUEsT0FBTyxHQUFHaEgsUUFBUSxDQUFDbUgsVUFBVSxDQUFDOU4sTUFBTSxDQUFDLENBQUE7QUFFckN1TixVQUFBQSxrQkFBa0IsRUFBRSxDQUFBO0FBRXhCLFNBQUE7QUFFQSxRQUFBLElBQUlJLE9BQU8sRUFBRTtBQUNUTixVQUFBQSxXQUFXLENBQUNHLGFBQWEsQ0FBQyxHQUFHN0csUUFBUSxDQUFBO0FBQ3JDNkcsVUFBQUEsYUFBYSxFQUFFLENBQUE7VUFDZjdHLFFBQVEsQ0FBQ2tDLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUNwQyxTQUFBO0FBQ0osT0FBQyxNQUFNO0FBQ0h3RSxRQUFBQSxXQUFXLENBQUNHLGFBQWEsQ0FBQyxHQUFHN0csUUFBUSxDQUFBO0FBQ3JDNkcsUUFBQUEsYUFBYSxFQUFFLENBQUE7UUFDZjdHLFFBQVEsQ0FBQ2tDLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUNwQyxPQUFBO0FBQ0osS0FBQTtBQUdBLElBQUEsSUFBSSxDQUFDek0sU0FBUyxJQUFJaU0sR0FBRyxFQUFFLEdBQUdpRixRQUFRLENBQUE7SUFDbEMsSUFBSSxDQUFDMVEsbUJBQW1CLElBQUkyUSxrQkFBa0IsQ0FBQTtBQUc5QyxJQUFBLE9BQU9DLGFBQWEsQ0FBQTtBQUN4QixHQUFBO0FBRUFPLEVBQUFBLFVBQVUsQ0FBQy9OLE1BQU0sRUFBRWdPLE1BQU0sRUFBRTtBQUV2QixJQUFBLE1BQU1DLHdCQUF3QixHQUFHLElBQUksQ0FBQzVTLEtBQUssQ0FBQzRTLHdCQUF3QixDQUFBO0FBQ3BFLElBQUEsTUFBTTFJLGFBQWEsR0FBRyxJQUFJLENBQUNsSyxLQUFLLENBQUNrSyxhQUFhLENBQUE7QUFDOUMsSUFBQSxLQUFLLElBQUkrQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcwRixNQUFNLENBQUM3SyxNQUFNLEVBQUVtRixDQUFDLEVBQUUsRUFBRTtBQUNwQyxNQUFBLE1BQU00RixLQUFLLEdBQUdGLE1BQU0sQ0FBQzFGLENBQUMsQ0FBQyxDQUFBO01BRXZCLElBQUk0RixLQUFLLENBQUNDLE9BQU8sRUFBRTtBQUVmLFFBQUEsSUFBSUQsS0FBSyxDQUFDRSxLQUFLLEtBQUtDLHFCQUFxQixFQUFFO0FBQ3ZDSCxVQUFBQSxLQUFLLENBQUNJLGlCQUFpQixDQUFDbFUsVUFBVSxDQUFDLENBQUE7VUFDbkMsSUFBSTRGLE1BQU0sQ0FBQ2dFLE9BQU8sQ0FBQ3VLLGNBQWMsQ0FBQ25VLFVBQVUsQ0FBQyxFQUFFO1lBQzNDOFQsS0FBSyxDQUFDckYsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO1lBQzdCcUYsS0FBSyxDQUFDTSxnQkFBZ0IsR0FBR2pKLGFBQWEsQ0FBQTs7QUFHdEMsWUFBQSxNQUFNa0osVUFBVSxHQUFHek8sTUFBTSxDQUFDME8sYUFBYSxDQUFDdFUsVUFBVSxDQUFDLENBQUE7QUFDbkQ4VCxZQUFBQSxLQUFLLENBQUNTLGFBQWEsR0FBR2pPLElBQUksQ0FBQ2tPLEdBQUcsQ0FBQ1YsS0FBSyxDQUFDUyxhQUFhLEVBQUVGLFVBQVUsQ0FBQyxDQUFBO0FBQ25FLFdBQUMsTUFBTTtZQUtILElBQUksQ0FBQ1Isd0JBQXdCLEVBQUU7Y0FDM0IsSUFBSUMsS0FBSyxDQUFDVyxXQUFXLElBQUksQ0FBQ1gsS0FBSyxDQUFDWSxTQUFTLEVBQUU7Z0JBQ3ZDWixLQUFLLENBQUNyRixnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDakMsZUFBQTtBQUNKLGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQyxNQUFNO0FBQ0hxRixVQUFBQSxLQUFLLENBQUNNLGdCQUFnQixHQUFHLElBQUksQ0FBQ25ULEtBQUssQ0FBQ2tLLGFBQWEsQ0FBQTtBQUNyRCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztFQVVBd0osY0FBYyxDQUFDQyxJQUFJLEVBQUU7QUFHakIsSUFBQSxLQUFLLElBQUkxRyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcwRyxJQUFJLENBQUNDLE9BQU8sQ0FBQzlMLE1BQU0sRUFBRW1GLENBQUMsRUFBRSxFQUFFO0FBQzFDLE1BQUEsTUFBTTRGLEtBQUssR0FBR2MsSUFBSSxDQUFDQyxPQUFPLENBQUMzRyxDQUFDLENBQUMsQ0FBQTtBQUM3QixNQUFBLElBQUk0RixLQUFLLENBQUNFLEtBQUssS0FBS0MscUJBQXFCLEVBQUU7QUFDdkMsUUFBQSxJQUFJSCxLQUFLLENBQUNyRixnQkFBZ0IsSUFBSXFGLEtBQUssQ0FBQ1csV0FBVyxJQUFJWCxLQUFLLENBQUNnQixnQkFBZ0IsS0FBS0MsaUJBQWlCLEVBQUU7VUFDN0YsTUFBTUMsT0FBTyxHQUFHSixJQUFJLENBQUNLLHFCQUFxQixDQUFDL0csQ0FBQyxDQUFDLENBQUNnSCxpQkFBaUIsQ0FBQTtVQUMvRCxJQUFJLENBQUM1VCxvQkFBb0IsQ0FBQ3NMLElBQUksQ0FBQ2tILEtBQUssRUFBRWtCLE9BQU8sQ0FBQyxDQUFBO0FBQ2xELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7QUFJQSxJQUFBLE1BQU1HLGFBQWEsR0FBR1AsSUFBSSxDQUFDUSxjQUFjLENBQUE7QUFDekMsSUFBQSxLQUFLLElBQUlsSCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdpSCxhQUFhLENBQUNwTSxNQUFNLEVBQUVtRixDQUFDLEVBQUUsRUFBRTtBQUMzQyxNQUFBLE1BQU1oSCxZQUFZLEdBQUdpTyxhQUFhLENBQUNqSCxDQUFDLENBQUMsQ0FBQTtBQUNyQyxNQUFBLE1BQU1NLEtBQUssR0FBR3RILFlBQVksQ0FBQ21PLHdCQUF3QixDQUFDdE0sTUFBTSxDQUFBO01BQzFELEtBQUssSUFBSXVNLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzlHLEtBQUssRUFBRThHLENBQUMsRUFBRSxFQUFFO0FBQzVCLFFBQUEsTUFBTUMsVUFBVSxHQUFHck8sWUFBWSxDQUFDbU8sd0JBQXdCLENBQUNDLENBQUMsQ0FBQyxDQUFBO0FBQzNELFFBQUEsTUFBTXhCLEtBQUssR0FBR2MsSUFBSSxDQUFDQyxPQUFPLENBQUNVLFVBQVUsQ0FBQyxDQUFBO1FBQ3RDLE1BQU1QLE9BQU8sR0FBR0osSUFBSSxDQUFDSyxxQkFBcUIsQ0FBQ00sVUFBVSxDQUFDLENBQUNMLGlCQUFpQixDQUFBO0FBQ3hFLFFBQUEsSUFBSSxDQUFDMVQsMEJBQTBCLENBQUNvTCxJQUFJLENBQUNrSCxLQUFLLEVBQUVrQixPQUFPLEVBQUU5TixZQUFZLENBQUN0QixNQUFNLENBQUNBLE1BQU0sQ0FBQyxDQUFBO0FBQ3BGLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFTQTRQLGVBQWUsQ0FBQ1osSUFBSSxFQUFFO0lBR2xCLE1BQU0xQixRQUFRLEdBQUdqRixHQUFHLEVBQUUsQ0FBQTtBQUd0QixJQUFBLE1BQU1rSCxhQUFhLEdBQUdQLElBQUksQ0FBQ1EsY0FBYyxDQUFBO0FBQ3pDLElBQUEsS0FBSyxJQUFJbEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHaUgsYUFBYSxDQUFDcE0sTUFBTSxFQUFFbUYsQ0FBQyxFQUFFLEVBQUU7QUFHM0MsTUFBQSxNQUFNaEgsWUFBWSxHQUFHaU8sYUFBYSxDQUFDakgsQ0FBQyxDQUFDLENBQUE7O0FBR3JDLE1BQUEsTUFBTXVILFVBQVUsR0FBR3ZPLFlBQVksQ0FBQ3VPLFVBQVUsQ0FBQTtBQUUxQyxNQUFBLE1BQU0zUSxLQUFLLEdBQUc4UCxJQUFJLENBQUNjLFNBQVMsQ0FBQ0QsVUFBVSxDQUFDLENBQUE7QUFDeEMsTUFBQSxJQUFJLENBQUMzUSxLQUFLLENBQUNpUCxPQUFPLElBQUksQ0FBQ2EsSUFBSSxDQUFDZSxlQUFlLENBQUNGLFVBQVUsQ0FBQyxFQUFFLFNBQUE7QUFDekQsTUFBQSxNQUFNRyxXQUFXLEdBQUdoQixJQUFJLENBQUNpQixZQUFZLENBQUNKLFVBQVUsQ0FBQyxDQUFBOztBQUdqRCxNQUFBLE1BQU1LLFVBQVUsR0FBRzVPLFlBQVksQ0FBQzZPLFdBQVcsQ0FBQTtBQUUzQyxNQUFBLE1BQU1uUSxNQUFNLEdBQUdkLEtBQUssQ0FBQ2tSLE9BQU8sQ0FBQ0YsVUFBVSxDQUFDLENBQUE7QUFFeEMsTUFBQSxJQUFJbFEsTUFBTSxFQUFFO0FBRVJBLFFBQUFBLE1BQU0sQ0FBQ3FRLFdBQVcsQ0FBQy9PLFlBQVksQ0FBQ3JCLFlBQVksQ0FBQyxDQUFBOztRQUc3QyxJQUFJcUIsWUFBWSxDQUFDZ1AsY0FBYyxFQUFFO0FBQzdCLFVBQUEsSUFBSSxDQUFDekksbUJBQW1CLENBQUM3SCxNQUFNLENBQUNBLE1BQU0sQ0FBQyxDQUFBO1VBQ3ZDLElBQUksQ0FBQ25ELGdCQUFnQixFQUFFLENBQUE7QUFDM0IsU0FBQTs7UUFJQSxJQUFJLENBQUNrUixVQUFVLENBQUMvTixNQUFNLENBQUNBLE1BQU0sRUFBRWQsS0FBSyxDQUFDK1AsT0FBTyxDQUFDLENBQUE7O0FBRzdDLFFBQUEsTUFBTXNCLE9BQU8sR0FBR3JSLEtBQUssQ0FBQ3NSLFNBQVMsQ0FBQTs7QUFHL0IsUUFBQSxNQUFNN0MsT0FBTyxHQUFHcUMsV0FBVyxHQUFHTyxPQUFPLENBQUNFLGtCQUFrQixDQUFDUCxVQUFVLENBQUMsR0FBR0ssT0FBTyxDQUFDRyxhQUFhLENBQUNSLFVBQVUsQ0FBQyxDQUFBOztBQUd4RyxRQUFBLElBQUksQ0FBQ3ZDLE9BQU8sQ0FBQ2dELElBQUksRUFBRTtVQUVmLElBQUl6UixLQUFLLENBQUMwUixTQUFTLEVBQUU7QUFDakIxUixZQUFBQSxLQUFLLENBQUMwUixTQUFTLENBQUNWLFVBQVUsQ0FBQyxDQUFBO0FBQy9CLFdBQUE7VUFFQSxNQUFNaEksU0FBUyxHQUFHOEgsV0FBVyxHQUFHOVEsS0FBSyxDQUFDMlIsd0JBQXdCLEdBQUczUixLQUFLLENBQUM0UixtQkFBbUIsQ0FBQTtBQUMxRm5ELFVBQUFBLE9BQU8sQ0FBQ3hLLE1BQU0sR0FBRyxJQUFJLENBQUM2RCxJQUFJLENBQUNoSCxNQUFNLENBQUNBLE1BQU0sRUFBRWtJLFNBQVMsRUFBRXlGLE9BQU8sQ0FBQ29ELElBQUksQ0FBQyxDQUFBO1VBQ2xFcEQsT0FBTyxDQUFDZ0QsSUFBSSxHQUFHLElBQUksQ0FBQTtVQUVuQixJQUFJelIsS0FBSyxDQUFDOFIsVUFBVSxFQUFFO0FBQ2xCOVIsWUFBQUEsS0FBSyxDQUFDOFIsVUFBVSxDQUFDZCxVQUFVLENBQUMsQ0FBQTtBQUNoQyxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUdBLElBQUEsSUFBSSxDQUFDbkIsY0FBYyxDQUFDQyxJQUFJLENBQUMsQ0FBQTtBQUd6QixJQUFBLElBQUksQ0FBQzVTLFNBQVMsSUFBSWlNLEdBQUcsRUFBRSxHQUFHaUYsUUFBUSxDQUFBO0FBRXRDLEdBQUE7O0FBTUEyRCxFQUFBQSxhQUFhLENBQUMvSSxTQUFTLEVBQUVnSixjQUFjLEVBQUU7QUFDckMsSUFBQSxNQUFNdEksS0FBSyxHQUFHVixTQUFTLENBQUMvRSxNQUFNLENBQUE7SUFDOUIsS0FBSyxJQUFJbUYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHTSxLQUFLLEVBQUVOLENBQUMsRUFBRSxFQUFFO0FBQzVCLE1BQUEsTUFBTTZJLEdBQUcsR0FBR2pKLFNBQVMsQ0FBQ0ksQ0FBQyxDQUFDLENBQUMxQixRQUFRLENBQUE7QUFDakMsTUFBQSxJQUFJdUssR0FBRyxFQUFFO0FBRUwsUUFBQSxJQUFJLENBQUNyVyxRQUFRLENBQUNzVyxHQUFHLENBQUNELEdBQUcsQ0FBQyxFQUFFO0FBQ3BCclcsVUFBQUEsUUFBUSxDQUFDdVcsR0FBRyxDQUFDRixHQUFHLENBQUMsQ0FBQTs7VUFHakIsSUFBSUEsR0FBRyxDQUFDRyxnQkFBZ0IsS0FBS0MsUUFBUSxDQUFDQyxTQUFTLENBQUNGLGdCQUFnQixFQUFFO0FBRTlELFlBQUEsSUFBSUosY0FBYyxFQUFFO0FBRWhCLGNBQUEsSUFBSSxDQUFDQyxHQUFHLENBQUNNLFdBQVcsSUFBS04sR0FBRyxDQUFDTyxPQUFPLElBQUksQ0FBQ1AsR0FBRyxDQUFDTyxPQUFPLENBQUNDLFFBQVMsRUFDMUQsU0FBQTtBQUNSLGFBQUE7O1lBR0FSLEdBQUcsQ0FBQ1MsYUFBYSxFQUFFLENBQUE7QUFDdkIsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7SUFHQTlXLFFBQVEsQ0FBQ3VHLEtBQUssRUFBRSxDQUFBO0FBQ3BCLEdBQUE7RUFFQXdRLGFBQWEsQ0FBQzdELE1BQU0sRUFBRTtBQUVsQixJQUFBLE1BQU04RCxrQkFBa0IsR0FBRyxJQUFJLENBQUN4VyxpQkFBaUIsQ0FBQ3dXLGtCQUFrQixDQUFBO0FBQ3BFLElBQUEsS0FBSyxJQUFJeEosQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMEYsTUFBTSxDQUFDN0ssTUFBTSxFQUFFbUYsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsTUFBQSxNQUFNNEYsS0FBSyxHQUFHRixNQUFNLENBQUMxRixDQUFDLENBQUMsQ0FBQTs7QUFHdkIsTUFBQSxJQUFJLENBQUM0RixLQUFLLENBQUM2RCxzQkFBc0IsRUFDN0IsU0FBQTs7QUFHSixNQUFBLElBQUksQ0FBQzdELEtBQUssQ0FBQzhELGdCQUFnQixFQUN2QixTQUFBO01BRUosSUFBSSxDQUFDbFcsZUFBZSxDQUFDbVcsTUFBTSxDQUFDL0QsS0FBSyxFQUFFNEQsa0JBQWtCLENBQUMsQ0FBQTtBQUMxRCxLQUFBO0FBQ0osR0FBQTs7QUFPQUksRUFBQUEsVUFBVSxDQUFDbEQsSUFBSSxFQUFFbUQsYUFBYSxFQUFFO0FBQzVCLElBQUEsTUFBTUMsYUFBYSxHQUFHcEQsSUFBSSxDQUFDcUQsY0FBYyxDQUFBOztBQUd6QyxJQUFBLE1BQU1oWCxLQUFLLEdBQUcsSUFBSSxDQUFDQSxLQUFLLENBQUE7QUFDeEIsSUFBQSxJQUFJQSxLQUFLLENBQUM0VixhQUFhLElBQUlrQixhQUFhLEVBQUU7QUFDdEMsTUFBQSxNQUFNakIsY0FBYyxHQUFHLENBQUM3VixLQUFLLENBQUM0VixhQUFhLElBQUlrQixhQUFhLENBQUE7QUFDNUQsTUFBQSxJQUFJLENBQUNsQixhQUFhLENBQUNtQixhQUFhLEVBQUVsQixjQUFjLENBQUMsQ0FBQTtNQUNqRDdWLEtBQUssQ0FBQzRWLGFBQWEsR0FBRyxLQUFLLENBQUE7TUFDM0I1VixLQUFLLENBQUNpWCxjQUFjLEVBQUUsQ0FBQTtBQUMxQixLQUFBOztBQUdBLElBQUEsSUFBSSxDQUFDcksscUJBQXFCLENBQUNtSyxhQUFhLENBQUMsQ0FBQTs7QUFHekMsSUFBQSxNQUFNRyxPQUFPLEdBQUdILGFBQWEsQ0FBQ2pQLE1BQU0sQ0FBQTtJQUNwQyxLQUFLLElBQUltRixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdpSyxPQUFPLEVBQUVqSyxDQUFDLEVBQUUsRUFBRTtBQUM5QjhKLE1BQUFBLGFBQWEsQ0FBQzlKLENBQUMsQ0FBQyxDQUFDTyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7QUFDN0MsS0FBQTs7QUFHQSxJQUFBLE1BQU1tRixNQUFNLEdBQUdnQixJQUFJLENBQUNDLE9BQU8sQ0FBQTtBQUMzQixJQUFBLE1BQU11RCxVQUFVLEdBQUd4RSxNQUFNLENBQUM3SyxNQUFNLENBQUE7SUFDaEMsS0FBSyxJQUFJbUYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHa0ssVUFBVSxFQUFFbEssQ0FBQyxFQUFFLEVBQUU7QUFDakMwRixNQUFBQSxNQUFNLENBQUMxRixDQUFDLENBQUMsQ0FBQzRKLFVBQVUsRUFBRSxDQUFBO0FBQzFCLEtBQUE7QUFDSixHQUFBOztFQU1BTyx1QkFBdUIsQ0FBQ3pELElBQUksRUFBRTtJQUMxQixJQUFJLENBQUMxVCxpQkFBaUIsQ0FBQzhOLE1BQU0sQ0FBQzRGLElBQUksQ0FBQzBELFlBQVksQ0FBQ0MsY0FBYyxDQUFDLEVBQUUzRCxJQUFJLENBQUMwRCxZQUFZLENBQUNFLGNBQWMsQ0FBQyxFQUFFLElBQUksQ0FBQ3ZYLEtBQUssQ0FBQ3NXLFFBQVEsQ0FBQyxDQUFBO0FBQzVILEdBQUE7O0VBTUFrQixjQUFjLENBQUM3RCxJQUFJLEVBQUU7SUFHakIsTUFBTThELFNBQVMsR0FBR3pLLEdBQUcsRUFBRSxDQUFBO0lBR3ZCLE1BQU0wSyxrQkFBa0IsR0FBRy9ELElBQUksQ0FBQ2dFLHFCQUFxQixDQUFDLElBQUksQ0FBQzVYLE1BQU0sQ0FBQyxDQUFBO0FBRWxFLElBQUEsTUFBTW1VLGFBQWEsR0FBR1AsSUFBSSxDQUFDUSxjQUFjLENBQUE7QUFDekMsSUFBQSxLQUFLLElBQUlsSCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdpSCxhQUFhLENBQUNwTSxNQUFNLEVBQUVtRixDQUFDLEVBQUUsRUFBRTtBQUMzQyxNQUFBLE1BQU1oSCxZQUFZLEdBQUdpTyxhQUFhLENBQUNqSCxDQUFDLENBQUMsQ0FBQTtBQUNyQyxNQUFBLE1BQU0ySyxPQUFPLEdBQUczUixZQUFZLENBQUM0UixhQUFhLENBQUE7QUFFMUMsTUFBQSxJQUFJRCxPQUFPLElBQUlBLE9BQU8sS0FBS0Ysa0JBQWtCLEVBQUU7QUFHM0MsUUFBQSxJQUFJLENBQUNqWSxRQUFRLENBQUNzVyxHQUFHLENBQUM2QixPQUFPLENBQUMsRUFBRTtBQUN4Qm5ZLFVBQUFBLFFBQVEsQ0FBQ3VXLEdBQUcsQ0FBQzRCLE9BQU8sQ0FBQyxDQUFBO1VBRXJCLE1BQU0vVCxLQUFLLEdBQUc4UCxJQUFJLENBQUNjLFNBQVMsQ0FBQ3hPLFlBQVksQ0FBQ3VPLFVBQVUsQ0FBQyxDQUFBO0FBQ3JEb0QsVUFBQUEsT0FBTyxDQUFDN0osTUFBTSxDQUFDbEssS0FBSyxDQUFDaVUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDOVgsS0FBSyxDQUFDK1gsZUFBZSxFQUFFLElBQUksQ0FBQy9YLEtBQUssQ0FBQ3NXLFFBQVEsQ0FBQyxDQUFBO0FBQzdGLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7SUFHQTdXLFFBQVEsQ0FBQ3VHLEtBQUssRUFBRSxDQUFBO0FBR2hCLElBQUEsSUFBSSxDQUFDL0Usa0JBQWtCLElBQUkrTCxHQUFHLEVBQUUsR0FBR3lLLFNBQVMsQ0FBQTtBQUM1QyxJQUFBLElBQUksQ0FBQ2hXLGNBQWMsR0FBR2tTLElBQUksQ0FBQ3FFLGNBQWMsQ0FBQ2xRLE1BQU0sQ0FBQTtBQUVwRCxHQUFBOztBQVdBbVEsRUFBQUEsc0JBQXNCLENBQUN0RSxJQUFJLEVBQUVmLHdCQUF3QixFQUFFO0lBR25ELE1BQU1zRiwwQkFBMEIsR0FBR2xMLEdBQUcsRUFBRSxDQUFBO0FBR3hDLElBQUEsTUFBTW1MLEdBQUcsR0FBR3hFLElBQUksQ0FBQ2MsU0FBUyxDQUFDM00sTUFBTSxDQUFBO0lBQ2pDLEtBQUssSUFBSW1GLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2tMLEdBQUcsRUFBRWxMLENBQUMsRUFBRSxFQUFFO01BQzFCMEcsSUFBSSxDQUFDYyxTQUFTLENBQUN4SCxDQUFDLENBQUMsQ0FBQ21MLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtBQUM1QyxLQUFBO0FBRUEsSUFBQSxNQUFNcFksS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO0FBQ3hCLElBQUEsTUFBTXFZLGFBQWEsR0FBR3JZLEtBQUssQ0FBQ2lYLGNBQWMsQ0FBQTtJQUMxQyxLQUFLLElBQUloSyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdrTCxHQUFHLEVBQUVsTCxDQUFDLEVBQUUsRUFBRTtBQUMxQixNQUFBLE1BQU1wSixLQUFLLEdBQUc4UCxJQUFJLENBQUNjLFNBQVMsQ0FBQ3hILENBQUMsQ0FBQyxDQUFBO01BQy9CcEosS0FBSyxDQUFDb1QsY0FBYyxHQUFHb0IsYUFBYSxDQUFBO01BRXBDeFUsS0FBSyxDQUFDeVUsa0JBQWtCLEdBQUcsQ0FBQyxDQUFBO01BQzVCelUsS0FBSyxDQUFDMFUsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO01BQzNCMVUsS0FBSyxDQUFDMUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO01BQzFCMEMsS0FBSyxDQUFDMlUsV0FBVyxHQUFHLENBQUMsQ0FBQTtNQUdyQjNVLEtBQUssQ0FBQzRVLDBCQUEwQixHQUFHLENBQUMsQ0FBQTtNQUNwQzVVLEtBQUssQ0FBQzZVLDJCQUEyQixHQUFHLENBQUMsQ0FBQTtBQUNyQyxNQUFBLE1BQU0vRCxXQUFXLEdBQUdoQixJQUFJLENBQUNpQixZQUFZLENBQUMzSCxDQUFDLENBQUMsQ0FBQTtBQUN4QyxNQUFBLElBQUkwSCxXQUFXLEVBQUU7UUFDYjlRLEtBQUssQ0FBQ3VVLGtCQUFrQixJQUFJLENBQUMsQ0FBQTtBQUNqQyxPQUFDLE1BQU07UUFDSHZVLEtBQUssQ0FBQ3VVLGtCQUFrQixJQUFJLENBQUMsQ0FBQTtBQUNqQyxPQUFBO0FBQ0F2VSxNQUFBQSxLQUFLLENBQUM4VSxxQkFBcUIsR0FBRzlVLEtBQUssQ0FBQ3VVLGtCQUFrQixDQUFBOztBQUd0RCxNQUFBLEtBQUssSUFBSS9ELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3hRLEtBQUssQ0FBQ2tSLE9BQU8sQ0FBQ2pOLE1BQU0sRUFBRXVNLENBQUMsRUFBRSxFQUFFO0FBQzNDeFEsUUFBQUEsS0FBSyxDQUFDc1IsU0FBUyxDQUFDeUQsT0FBTyxDQUFDdkUsQ0FBQyxDQUFDLENBQUE7QUFDOUIsT0FBQTs7QUFJQSxNQUFBLElBQUl4USxLQUFLLENBQUNnVixtQkFBbUIsSUFBSWhWLEtBQUssQ0FBQ2lWLGdCQUFnQixJQUFJLENBQUMsSUFBSSxDQUFDOVksS0FBSyxDQUFDNFMsd0JBQXdCLEVBQUU7UUFFN0YsSUFBSS9PLEtBQUssQ0FBQ2tWLGtCQUFrQixFQUFFO0FBQzFCQyxVQUFBQSxZQUFZLENBQUNDLE1BQU0sQ0FBQ3BWLEtBQUssQ0FBQzRSLG1CQUFtQixDQUFDLENBQUE7QUFDOUN1RCxVQUFBQSxZQUFZLENBQUNDLE1BQU0sQ0FBQ3BWLEtBQUssQ0FBQzJSLHdCQUF3QixDQUFDLENBQUE7QUFDdkQsU0FBQTtBQUNBd0QsUUFBQUEsWUFBWSxDQUFDSixPQUFPLENBQUMsSUFBSSxDQUFDN1ksTUFBTSxFQUFFQyxLQUFLLEVBQUU2RCxLQUFLLENBQUM0UixtQkFBbUIsRUFBRTVSLEtBQUssQ0FBQytQLE9BQU8sQ0FBQyxDQUFBO0FBQ2xGb0YsUUFBQUEsWUFBWSxDQUFDSixPQUFPLENBQUMsSUFBSSxDQUFDN1ksTUFBTSxFQUFFQyxLQUFLLEVBQUU2RCxLQUFLLENBQUMyUix3QkFBd0IsRUFBRTNSLEtBQUssQ0FBQytQLE9BQU8sQ0FBQyxDQUFBO1FBQ3ZGRCxJQUFJLENBQUN0RyxNQUFNLEdBQUcsSUFBSSxDQUFBO1FBQ2xCck4sS0FBSyxDQUFDNFYsYUFBYSxHQUFHLElBQUksQ0FBQTtRQUMxQi9SLEtBQUssQ0FBQ2dWLG1CQUFtQixHQUFHLEtBQUssQ0FBQTtRQUNqQ2hWLEtBQUssQ0FBQ2tWLGtCQUFrQixHQUFHLElBQUksQ0FBQTtBQUNuQyxPQUFBO0FBQ0osS0FBQTs7SUFHQSxNQUFNRyxPQUFPLEdBQUd2RixJQUFJLENBQUN3RixPQUFPLENBQUMsSUFBSSxDQUFDcFosTUFBTSxFQUFFNlMsd0JBQXdCLENBQUMsQ0FBQTtBQUduRSxJQUFBLElBQUksQ0FBQzFSLDJCQUEyQixJQUFJOEwsR0FBRyxFQUFFLEdBQUdrTCwwQkFBMEIsQ0FBQTtBQUd0RSxJQUFBLE9BQU9nQixPQUFPLENBQUE7QUFDbEIsR0FBQTtBQUVBRSxFQUFBQSxVQUFVLEdBQUc7SUFFVCxJQUFJLENBQUN0WixxQkFBcUIsR0FBRyxLQUFLLENBQUE7SUFFbEMsSUFBSSxDQUFDOFAsdUJBQXVCLEVBQUUsQ0FBQTtBQUNsQyxHQUFBO0FBQ0o7Ozs7In0=
