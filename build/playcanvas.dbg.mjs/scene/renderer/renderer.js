/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, DEVICETYPE_WEBGPU, CULLFACE_NONE, CULLFACE_FRONTANDBACK, CULLFACE_FRONT, CULLFACE_BACK, UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, BINDGROUP_VIEW, BINDGROUP_MESH, SEMANTIC_ATTR } from '../../platform/graphics/constants.js';
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
import { ShadowRenderer } from './shadow-renderer.js';

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

// Converts a projection matrix in OpenGL style (depth range of -1..1) to a DirectX style (depth range of 0..1).
const _fixProjRangeMat = new Mat4().set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);
const _tempProjMat0 = new Mat4();
const _tempProjMat1 = new Mat4();
const _tempProjMat2 = new Mat4();
const _tempProjMat3 = new Mat4();
const _tempSet = new Set();

/**
 * The base renderer functionality to allow implementation of specialized renderers.
 *
 * @ignore
 */
class Renderer {
  /** @type {boolean} */

  /**
   * Create a new instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device used by the renderer.
   */
  constructor(graphicsDevice) {
    this.clustersDebugRendered = false;
    this.device = graphicsDevice;

    /** @type {import('../scene.js').Scene|null} */
    this.scene = null;

    // texture atlas managing shadow map / cookie texture atlassing for omni and spot lights
    this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);

    // shadows
    this.shadowMapCache = new ShadowMapCache();
    this.shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
    this._shadowRendererLocal = new ShadowRendererLocal(this, this.shadowRenderer);
    this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.shadowRenderer);

    // cookies
    this._cookieRenderer = new CookieRenderer(graphicsDevice, this.lightTextureAtlas);

    // view bind group format with its uniform buffer format
    this.viewUniformFormat = null;
    this.viewBindGroupFormat = null;

    // timing
    this._skinTime = 0;
    this._morphTime = 0;
    this._cullTime = 0;
    this._shadowMapTime = 0;
    this._lightClustersTime = 0;
    this._layerCompositionUpdateTime = 0;

    // stats
    this._shadowDrawCalls = 0;
    this._skinDrawCalls = 0;
    this._instancedDrawCalls = 0;
    this._shadowMapUpdates = 0;
    this._numDrawCallsCulled = 0;
    this._camerasRendered = 0;
    this._lightClusters = 0;

    // Uniforms
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
    this.shadowRenderer = null;
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
        return drawCallB.zdist - drawCallA.zdist; // back to front
      } else if (drawCallA.zdist2 && drawCallB.zdist2) {
        return drawCallA.zdist2 - drawCallB.zdist2; // front to back
      }
    }

    return drawCallB._key[SORTKEY_FORWARD] - drawCallA._key[SORTKEY_FORWARD];
  }
  sortCompareMesh(drawCallA, drawCallB) {
    if (drawCallA.layer === drawCallB.layer) {
      if (drawCallA.drawOrder && drawCallB.drawOrder) {
        return drawCallA.drawOrder - drawCallB.drawOrder;
      } else if (drawCallA.zdist && drawCallB.zdist) {
        return drawCallB.zdist - drawCallA.zdist; // back to front
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

  /**
   * Set up the viewport and the scissor for camera rendering.
   *
   * @param {import('../camera.js').Camera} camera - The camera containing the viewport
   * information.
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} [renderTarget] - The
   * render target. NULL for the default one.
   */
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

    // by default clear is using viewport rectangle. Use scissor rectangle when required.
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

  /**
   * Clear the current render target, using currently set up viewport.
   *
   * @param {import('../composition/render-action.js').RenderAction} renderAction - Render action
   * containing the clear flags.
   * @param {import('../camera.js').Camera} camera - Camera containing the clear values.
   */
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
  setCameraUniforms(camera, target) {
    // flipping proj matrix
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
      // Projection Matrix
      let projMat = camera.projectionMatrix;
      if (camera.calculateProjection) {
        camera.calculateProjection(projMat, VIEW_CENTER);
      }
      let projMatSkybox = camera.getProjectionMatrixSkybox();

      // flip projection matrices
      if (flipY) {
        projMat = _tempProjMat0.mul2(_flipYMat, projMat);
        projMatSkybox = _tempProjMat1.mul2(_flipYMat, projMatSkybox);
      }

      // update depth range of projection matrices (-1..1 to 0..1)
      if (this.device.deviceType === DEVICETYPE_WEBGPU) {
        projMat = _tempProjMat2.mul2(_fixProjRangeMat, projMat);
        projMatSkybox = _tempProjMat3.mul2(_fixProjRangeMat, projMatSkybox);
      }
      this.projId.setValue(projMat.data);
      this.projSkyboxId.setValue(projMatSkybox.data);

      // ViewInverse Matrix
      if (camera.calculateTransform) {
        camera.calculateTransform(viewInvMat, VIEW_CENTER);
      } else {
        const pos = camera._node.getPosition();
        const rot = camera._node.getRotation();
        viewInvMat.setTRS(pos, rot, Vec3.ONE);
      }
      this.viewInvId.setValue(viewInvMat.data);

      // View Matrix
      viewMat.copy(viewInvMat).invert();
      this.viewId.setValue(viewMat.data);

      // View 3x3
      viewMat3.setFromMat4(viewMat);
      this.viewId3.setValue(viewMat3.data);

      // ViewProjection Matrix
      viewProjMat.mul2(projMat, viewMat);
      this.viewProjId.setValue(viewProjMat.data);
      this.flipYId.setValue(flipY ? -1 : 1);

      // View Position (world space)
      this.dispatchViewPos(camera._node.getPosition());
      camera.frustum.setFromMat4(viewProjMat);
    }
    this.tbnBasis.setValue(flipY ? -1 : 1);

    // Near and far clip values
    const n = camera._nearClip;
    const f = camera._farClip;
    this.nearClipId.setValue(n);
    this.farClipId.setValue(f);

    // camera params
    this.cameraParams[0] = 1 / f;
    this.cameraParams[1] = f;
    this.cameraParams[2] = n;
    this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
    this.cameraParamsId.setValue(this.cameraParams);

    // exposure
    this.exposureId.setValue(this.scene.physicalUnits ? camera.getExposure() : this.scene.exposure);
    return viewCount;
  }

  // make sure colorWrite is set to true to all channels, if you want to fully clear the target
  // TODO: this function is only used from outside of forward renderer, and should be deprecated
  // when the functionality moves to the render passes. Note that Editor uses it as well.
  setCamera(camera, target, clear, renderAction = null) {
    this.setCameraUniforms(camera, target);
    this.clearView(camera, target, clear, false);
  }

  // TODO: this is currently used by the lightmapper and the Editor,
  // and will be removed when those call are removed.
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
      // use camera clear options if any
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
      // calculate frustum based on XR view
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
    // Cull mode
    device.setCullMode(material.cull);

    // Alpha test
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
    // skip everything with visibleThisFrame === false
    this.updateGpuSkinMatrices(drawCalls);
    this.updateMorphing(drawCalls);
  }
  setVertexBuffers(device, mesh) {
    // main vertex buffer
    device.setVertexBuffer(mesh.vertexBuffer);
  }
  setMorphing(device, morphInstance) {
    if (morphInstance) {
      if (morphInstance.morph.useTextureMorph) {
        // vertex buffer with vertex ids
        device.setVertexBuffer(morphInstance.morph.vertexBufferIds);

        // textures
        this.morphPositionTex.setValue(morphInstance.texturePositions);
        this.morphNormalTex.setValue(morphInstance.textureNormals);

        // texture params
        this.morphTexParams.setValue(morphInstance._textureParams);
      } else {
        // vertex attributes based morphing

        for (let t = 0; t < morphInstance._activeVertexBuffers.length; t++) {
          const vb = morphInstance._activeVertexBuffers[t];
          if (vb) {
            // patch semantic for the buffer to current ATTR slot (using ATTR8 - ATTR15 range)
            const semantic = SEMANTIC_ATTR + (t + 8);
            vb.format.elements[0].name = semantic;
            vb.format.elements[0].scopeId = device.scope.resolve(semantic);
            vb.format.update();
            device.setVertexBuffer(vb);
          }
        }

        // set all 8 weights
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

  // sets Vec3 camera position uniform
  dispatchViewPos(position) {
    const vp = this.viewPos; // note that this reuses an array
    vp[0] = position.x;
    vp[1] = position.y;
    vp[2] = position.z;
    this.viewPosId.setValue(vp);
  }
  initViewBindGroupFormat() {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      // format of the view uniform buffer
      this.viewUniformFormat = new UniformBufferFormat(this.device, [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)]);

      // format of the view bind group - contains single uniform buffer, and some textures
      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)], [new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
    }
  }
  setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {
    Debug.assert(Array.isArray(viewBindGroups), "viewBindGroups must be an array");
    const device = this.device;
    Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");
    while (viewBindGroups.length < viewCount) {
      const ub = new UniformBuffer(device, viewUniformFormat);
      const bg = new BindGroup(device, viewBindGroupFormat, ub);
      DebugHelper.setName(bg, `ViewBindGroup_${bg.id}`);
      viewBindGroups.push(bg);
    }

    // update view bind group / uniforms
    const viewBindGroup = viewBindGroups[0];
    viewBindGroup.defaultUniformBuffer.update();
    viewBindGroup.update();

    // TODO; this needs to be moved to drawInstance functions to handle XR
    device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
  }
  setupMeshUniformBuffers(meshInstance, pass) {
    const device = this.device;
    if (device.supportsUniformBuffers) {
      // TODO: model matrix setup is part of the drawInstance call, but with uniform buffer it's needed
      // earlier here. This needs to be refactored for multi-view anyways.
      this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
      this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);

      // update mesh bind group / uniform buffer
      const meshBindGroup = meshInstance.getBindGroup(device, pass);
      meshBindGroup.defaultUniformBuffer.update();
      meshBindGroup.update();
      device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
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

  // used for stereo
  drawInstance2(device, meshInstance, mesh, style) {
    DebugGraphics.pushGpuMarker(device, meshInstance.node.name);
    const instancingData = meshInstance.instancingData;
    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.draw(mesh.primitive[style], instancingData.count, true);
      }
    } else {
      // matrices are already set
      device.draw(mesh.primitive[style], undefined, true);
    }
    DebugGraphics.popGpuMarker(device);
  }
  cull(camera, drawCalls, visibleList) {
    const cullTime = now();
    let numDrawCallsCulled = 0;
    let visibleLength = 0;
    const drawCallsCount = drawCalls.length;
    const cullingMask = camera.cullingMask || 0xFFFFFFFF; // if missing assume camera's default value

    if (!camera.frustumCulling) {
      for (let i = 0; i < drawCallsCount; i++) {
        // need to copy array anyway because sorting will happen and it'll break original draw call order assumption
        const drawCall = drawCalls[i];
        if (!drawCall.visible && !drawCall.command) continue;

        // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
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
        if (!drawCall.visible) continue; // use visible property to quickly hide/show meshInstances
        let visible = true;

        // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
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
        // directional lights are marked visible at the start of the frame
        if (light._type !== LIGHTTYPE_DIRECTIONAL) {
          light.getBoundingSphere(tempSphere);
          if (camera.frustum.containsSphere(tempSphere)) {
            light.visibleThisFrame = true;
            light.usePhysicalUnits = physicalUnits;

            // maximum screen area taken by the light
            const screenSize = camera.getScreenSize(tempSphere);
            light.maxScreenSize = Math.max(light.maxScreenSize, screenSize);
          } else {
            // if shadow casting light does not have shadow map allocated, mark it visible to allocate shadow map
            // Note: This won't be needed when clustered shadows are used, but at the moment even culled out lights
            // are used for rendering, and need shadow map to be allocated
            // TODO: delete this code when clusteredLightingEnabled is being removed and is on by default.
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

  /**
   * Shadow map culling for directional and visible local lights
   * visible meshInstances are collected into light._renderData, and are marked as visible
   * for directional lights also shadow camera matrix is set up
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  cullShadowmaps(comp) {
    const isClustered = this.scene.clusteredLightingEnabled;

    // shadow casters culling for local (point and spot) lights
    for (let i = 0; i < comp._lights.length; i++) {
      const light = comp._lights[i];
      if (light._type !== LIGHTTYPE_DIRECTIONAL) {
        if (isClustered) {
          // if atlas slot is reassigned, make sure to update the shadow map, including the culling
          if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
          }
        }
        if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
          const casters = comp._lightCompositionData[i].shadowCastersList;
          this._shadowRendererLocal.cull(light, casters);
        }
      }
    }

    // shadow casters culling for global (directional) lights
    // render actions store which directional lights are needed for each camera, so these are getting culled
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

  /**
   * visibility culling of lights, meshInstances, shadows casters
   * Also applies meshInstance.visible and camera.cullingMask
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  cullComposition(comp) {
    const cullTime = now();
    const renderActions = comp._renderActions;
    for (let i = 0; i < renderActions.length; i++) {
      /** @type {import('../composition/render-action.js').RenderAction} */
      const renderAction = renderActions[i];

      // layer
      const layerIndex = renderAction.layerIndex;
      /** @type {import('../layer.js').Layer} */
      const layer = comp.layerList[layerIndex];
      if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) continue;
      const transparent = comp.subLayerList[layerIndex];

      // camera
      const cameraPass = renderAction.cameraIndex;
      /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
      const camera = layer.cameras[cameraPass];
      if (camera) {
        camera.frameUpdate(renderAction.renderTarget);

        // update camera and frustum once
        if (renderAction.firstCameraUse) {
          this.updateCameraFrustum(camera.camera);
          this._camerasRendered++;
        }

        // cull each layer's non-directional lights once with each camera
        // lights aren't collected anywhere, but marked as visible
        this.cullLights(camera.camera, layer._lights);

        // cull mesh instances
        const objects = layer.instances;

        // collect them into layer arrays
        const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

        // shared objects are only culled once
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

    // update shadow / cookie atlas allocation for the visible lights. Update it after the ligthts were culled,
    // but before shadow maps were culling, as it might force some 'update once' shadows to cull.
    if (this.scene.clusteredLightingEnabled) {
      this.updateLightTextureAtlas(comp);
    }

    // cull shadow casters for all lights
    this.cullShadowmaps(comp);
    this._cullTime += now() - cullTime;
  }

  /**
   * @param {import('../mesh-instance.js').MeshInstance[]} drawCalls - Mesh instances.
   * @param {boolean} onlyLitShaders - Limits the update to shaders affected by lighting.
   */
  updateShaders(drawCalls, onlyLitShaders) {
    const count = drawCalls.length;
    for (let i = 0; i < count; i++) {
      const mat = drawCalls[i].material;
      if (mat) {
        // material not processed yet
        if (!_tempSet.has(mat)) {
          _tempSet.add(mat);

          // skip this for materials not using variants
          if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
            if (onlyLitShaders) {
              // skip materials not using lighting
              if (!mat.useLighting || mat.emitter && !mat.emitter.lighting) continue;
            }

            // clear shader variants on the material and also on mesh instances that use it
            mat.clearVariants();
          }
        }
      }
    }

    // keep temp set empty
    _tempSet.clear();
  }
  renderCookies(lights) {
    const cookieRenderTarget = this.lightTextureAtlas.cookieRenderTarget;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];

      // skip clustered cookies with no assigned atlas slot
      if (!light.atlasViewportAllocated) continue;

      // only render cookie when the slot is reassigned (assuming the cookie texture is static)
      if (!light.atlasSlotUpdated) continue;
      this._cookieRenderer.render(light, cookieRenderTarget);
    }
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition to update.
   * @param {boolean} lightsChanged - True if lights of the composition has changed.
   */
  beginFrame(comp, lightsChanged) {
    const meshInstances = comp._meshInstances;

    // Update shaders if needed
    const scene = this.scene;
    if (scene.updateShaders || lightsChanged) {
      const onlyLitShaders = !scene.updateShaders && lightsChanged;
      this.updateShaders(meshInstances, onlyLitShaders);
      scene.updateShaders = false;
      scene._shaderVersion++;
    }

    // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
    this.updateCpuSkinMatrices(meshInstances);

    // clear mesh instance visibility
    const miCount = meshInstances.length;
    for (let i = 0; i < miCount; i++) {
      meshInstances[i].visibleThisFrame = false;
    }

    // clear light visibility
    const lights = comp._lights;
    const lightCount = lights.length;
    for (let i = 0; i < lightCount; i++) {
      lights[i].beginFrame();
    }
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  updateLightTextureAtlas(comp) {
    this.lightTextureAtlas.update(comp._splitLights[LIGHTTYPE_SPOT], comp._splitLights[LIGHTTYPE_OMNI], this.scene.lighting);
  }

  /**
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition.
   */
  updateClusters(comp) {
    const startTime = now();
    const emptyWorldClusters = comp.getEmptyWorldClusters(this.device);
    const renderActions = comp._renderActions;
    for (let i = 0; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const cluster = renderAction.lightClusters;
      if (cluster && cluster !== emptyWorldClusters) {
        // update each cluster only one time
        if (!_tempSet.has(cluster)) {
          _tempSet.add(cluster);
          const layer = comp.layerList[renderAction.layerIndex];
          cluster.update(layer.clusteredLightsSet, this.scene.gammaCorrection, this.scene.lighting);
        }
      }
    }

    // keep temp set empty
    _tempSet.clear();
    this._lightClustersTime += now() - startTime;
    this._lightClusters = comp._worldClusters.length;
  }

  /**
   * Updates the layer composition for rendering.
   *
   * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
   * composition to update.
   * @param {boolean} clusteredLightingEnabled - True if clustered lighting is enabled.
   * @returns {number} - Flags of what was updated
   * @ignore
   */
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

      // prepare layer for culling with the camera
      for (let j = 0; j < layer.cameras.length; j++) {
        layer.instances.prepare(j);
      }

      // Generate static lighting for meshes in this layer if needed
      // Note: Static lighting is not used when clustered lighting is enabled
      if (layer._needsStaticPrepare && layer._staticLightHash && !this.scene.clusteredLightingEnabled) {
        // TODO: reuse with the same staticLightHash
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

    // Update static layer data, if something's changed
    const updated = comp._update(this.device, clusteredLightingEnabled);
    this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
    return updated;
  }
  frameUpdate() {
    this.clustersDebugRendered = false;
    this.initViewBindGroupFormat();
  }
}

export { Renderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctc3BoZXJlLmpzJztcblxuaW1wb3J0IHtcbiAgICBTT1JUS0VZX0RFUFRILCBTT1JUS0VZX0ZPUldBUkQsXG4gICAgVklFV19DRU5URVIsIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQge1xuICAgIERFVklDRVRZUEVfV0VCR1BVLFxuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBCSU5ER1JPVVBfTUVTSCwgQklOREdST1VQX1ZJRVcsIFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FLFxuICAgIFVOSUZPUk1UWVBFX01BVDQsXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBTRU1BTlRJQ19BVFRSLFxuICAgIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX0ZST05ULCBDVUxMRkFDRV9GUk9OVEFOREJBQ0ssIENVTExGQUNFX05PTkUsXG4gICAgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVRcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXIuanMnO1xuaW1wb3J0IHsgQmluZEdyb3VwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtRm9ybWF0LCBVbmlmb3JtQnVmZmVyRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRHcm91cEZvcm1hdCwgQmluZEJ1ZmZlckZvcm1hdCwgQmluZFRleHR1cmVGb3JtYXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5cbmltcG9ydCB7IFNoYWRvd01hcENhY2hlIH0gZnJvbSAnLi9zaGFkb3ctbWFwLWNhY2hlLmpzJztcbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyTG9jYWwgfSBmcm9tICcuL3NoYWRvdy1yZW5kZXJlci1sb2NhbC5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXItZGlyZWN0aW9uYWwuanMnO1xuaW1wb3J0IHsgQ29va2llUmVuZGVyZXIgfSBmcm9tICcuL2Nvb2tpZS1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBTdGF0aWNNZXNoZXMgfSBmcm9tICcuL3N0YXRpYy1tZXNoZXMuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXIgfSBmcm9tICcuL3NoYWRvdy1yZW5kZXJlci5qcyc7XG5cbmxldCBfc2tpblVwZGF0ZUluZGV4ID0gMDtcbmNvbnN0IGJvbmVUZXh0dXJlU2l6ZSA9IFswLCAwLCAwLCAwXTtcbmNvbnN0IHZpZXdQcm9qTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdJbnZNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld01hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB3b3JsZE1hdFggPSBuZXcgVmVjMygpO1xuY29uc3Qgd29ybGRNYXRZID0gbmV3IFZlYzMoKTtcbmNvbnN0IHdvcmxkTWF0WiA9IG5ldyBWZWMzKCk7XG5jb25zdCB2aWV3TWF0MyA9IG5ldyBNYXQzKCk7XG5jb25zdCB0ZW1wU3BoZXJlID0gbmV3IEJvdW5kaW5nU3BoZXJlKCk7XG5jb25zdCBfZmxpcFlNYXQgPSBuZXcgTWF0NCgpLnNldFNjYWxlKDEsIC0xLCAxKTtcblxuLy8gQ29udmVydHMgYSBwcm9qZWN0aW9uIG1hdHJpeCBpbiBPcGVuR0wgc3R5bGUgKGRlcHRoIHJhbmdlIG9mIC0xLi4xKSB0byBhIERpcmVjdFggc3R5bGUgKGRlcHRoIHJhbmdlIG9mIDAuLjEpLlxuY29uc3QgX2ZpeFByb2pSYW5nZU1hdCA9IG5ldyBNYXQ0KCkuc2V0KFtcbiAgICAxLCAwLCAwLCAwLFxuICAgIDAsIDEsIDAsIDAsXG4gICAgMCwgMCwgMC41LCAwLFxuICAgIDAsIDAsIDAuNSwgMVxuXSk7XG5cbmNvbnN0IF90ZW1wUHJvak1hdDAgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0MSA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQyID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wUHJvak1hdDMgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogVGhlIGJhc2UgcmVuZGVyZXIgZnVuY3Rpb25hbGl0eSB0byBhbGxvdyBpbXBsZW1lbnRhdGlvbiBvZiBzcGVjaWFsaXplZCByZW5kZXJlcnMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJlciB7XG4gICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgIGNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSByZW5kZXJlci5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfG51bGx9ICovXG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuXG4gICAgICAgIC8vIHRleHR1cmUgYXRsYXMgbWFuYWdpbmcgc2hhZG93IG1hcCAvIGNvb2tpZSB0ZXh0dXJlIGF0bGFzc2luZyBmb3Igb21uaSBhbmQgc3BvdCBsaWdodHNcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG5ldyBMaWdodFRleHR1cmVBdGxhcyhncmFwaGljc0RldmljZSk7XG5cbiAgICAgICAgLy8gc2hhZG93c1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbmV3IFNoYWRvd01hcENhY2hlKCk7XG4gICAgICAgIHRoaXMuc2hhZG93UmVuZGVyZXIgPSBuZXcgU2hhZG93UmVuZGVyZXIodGhpcywgdGhpcy5saWdodFRleHR1cmVBdGxhcyk7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwgPSBuZXcgU2hhZG93UmVuZGVyZXJMb2NhbCh0aGlzLCB0aGlzLnNoYWRvd1JlbmRlcmVyKTtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCA9IG5ldyBTaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsKHRoaXMsIHRoaXMuc2hhZG93UmVuZGVyZXIpO1xuXG4gICAgICAgIC8vIGNvb2tpZXNcbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIgPSBuZXcgQ29va2llUmVuZGVyZXIoZ3JhcGhpY3NEZXZpY2UsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuXG4gICAgICAgIC8vIHZpZXcgYmluZCBncm91cCBmb3JtYXQgd2l0aCBpdHMgdW5pZm9ybSBidWZmZXIgZm9ybWF0XG4gICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBudWxsO1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBudWxsO1xuXG4gICAgICAgIC8vIHRpbWluZ1xuICAgICAgICB0aGlzLl9za2luVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX21vcnBoVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1bGxUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnNUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSAwO1xuXG4gICAgICAgIC8vIHN0YXRzXG4gICAgICAgIHRoaXMuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkb3dNYXBVcGRhdGVzID0gMDtcbiAgICAgICAgdGhpcy5fbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgdGhpcy5fY2FtZXJhc1JlbmRlcmVkID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVycyA9IDA7XG5cbiAgICAgICAgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2NvcGUgPSBncmFwaGljc0RldmljZS5zY29wZTtcbiAgICAgICAgdGhpcy5ib25lVGV4dHVyZUlkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9wb3NlTWFwJyk7XG4gICAgICAgIHRoaXMuYm9uZVRleHR1cmVTaXplSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX3Bvc2VNYXBTaXplJyk7XG4gICAgICAgIHRoaXMucG9zZU1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Bvc2VbMF0nKTtcblxuICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbW9kZWwnKTtcbiAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9ub3JtYWwnKTtcbiAgICAgICAgdGhpcy52aWV3SW52SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlld0ludmVyc2UnKTtcbiAgICAgICAgdGhpcy52aWV3UG9zID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQgPSBzY29wZS5yZXNvbHZlKCd2aWV3X3Bvc2l0aW9uJyk7XG4gICAgICAgIHRoaXMucHJvaklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Byb2plY3Rpb24nKTtcbiAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfcHJvamVjdGlvblNreWJveCcpO1xuICAgICAgICB0aGlzLnZpZXdJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3Jyk7XG4gICAgICAgIHRoaXMudmlld0lkMyA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF92aWV3MycpO1xuICAgICAgICB0aGlzLnZpZXdQcm9qSWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlld1Byb2plY3Rpb24nKTtcbiAgICAgICAgdGhpcy5mbGlwWUlkID0gc2NvcGUucmVzb2x2ZSgncHJvamVjdGlvbkZsaXBZJyk7XG4gICAgICAgIHRoaXMudGJuQmFzaXMgPSBzY29wZS5yZXNvbHZlKCd0Ym5CYXNpcycpO1xuICAgICAgICB0aGlzLm5lYXJDbGlwSWQgPSBzY29wZS5yZXNvbHZlKCdjYW1lcmFfbmVhcicpO1xuICAgICAgICB0aGlzLmZhckNsaXBJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9mYXInKTtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc0lkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX3BhcmFtcycpO1xuXG4gICAgICAgIHRoaXMuYWxwaGFUZXN0SWQgPSBzY29wZS5yZXNvbHZlKCdhbHBoYV9yZWYnKTtcbiAgICAgICAgdGhpcy5vcGFjaXR5TWFwSWQgPSBzY29wZS5yZXNvbHZlKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcblxuICAgICAgICB0aGlzLmV4cG9zdXJlSWQgPSBzY29wZS5yZXNvbHZlKCdleHBvc3VyZScpO1xuICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkID0gc2NvcGUucmVzb2x2ZSgndHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yJyk7XG5cbiAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNBID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfd2VpZ2h0c19hJyk7XG4gICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQiA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3dlaWdodHNfYicpO1xuICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXggPSBzY29wZS5yZXNvbHZlKCdtb3JwaFBvc2l0aW9uVGV4Jyk7XG4gICAgICAgIHRoaXMubW9ycGhOb3JtYWxUZXggPSBzY29wZS5yZXNvbHZlKCdtb3JwaE5vcm1hbFRleCcpO1xuICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhfdGV4X3BhcmFtcycpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuc2hhZG93UmVuZGVyZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzID0gbnVsbDtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZShkcmF3Q2FsbEEsIGRyYXdDYWxsQikge1xuICAgICAgICBpZiAoZHJhd0NhbGxBLmxheWVyID09PSBkcmF3Q2FsbEIubGF5ZXIpIHtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbEEuZHJhd09yZGVyICYmIGRyYXdDYWxsQi5kcmF3T3JkZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRyYXdDYWxsQS56ZGlzdCAmJiBkcmF3Q2FsbEIuemRpc3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0OyAvLyBiYWNrIHRvIGZyb250XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRyYXdDYWxsQS56ZGlzdDIgJiYgZHJhd0NhbGxCLnpkaXN0Mikge1xuICAgICAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEEuemRpc3QyIC0gZHJhd0NhbGxCLnpkaXN0MjsgLy8gZnJvbnQgdG8gYmFja1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gLSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cblxuICAgIHNvcnRDb21wYXJlTWVzaChkcmF3Q2FsbEEsIGRyYXdDYWxsQikge1xuICAgICAgICBpZiAoZHJhd0NhbGxBLmxheWVyID09PSBkcmF3Q2FsbEIubGF5ZXIpIHtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbEEuZHJhd09yZGVyICYmIGRyYXdDYWxsQi5kcmF3T3JkZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRyYXdDYWxsQS56ZGlzdCAmJiBkcmF3Q2FsbEIuemRpc3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0OyAvLyBiYWNrIHRvIGZyb250XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICAgICAgY29uc3Qga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG5cbiAgICAgICAgaWYgKGtleUEgPT09IGtleUIgJiYgZHJhd0NhbGxBLm1lc2ggJiYgZHJhd0NhbGxCLm1lc2gpIHtcbiAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEIubWVzaC5pZCAtIGRyYXdDYWxsQS5tZXNoLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGtleUIgLSBrZXlBO1xuICAgIH1cblxuICAgIHNvcnRDb21wYXJlRGVwdGgoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgY29uc3Qga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfREVQVEhdO1xuICAgICAgICBjb25zdCBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9ERVBUSF07XG5cbiAgICAgICAgaWYgKGtleUEgPT09IGtleUIgJiYgZHJhd0NhbGxBLm1lc2ggJiYgZHJhd0NhbGxCLm1lc2gpIHtcbiAgICAgICAgICAgIHJldHVybiBkcmF3Q2FsbEIubWVzaC5pZCAtIGRyYXdDYWxsQS5tZXNoLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGtleUIgLSBrZXlBO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB1cCB0aGUgdmlld3BvcnQgYW5kIHRoZSBzY2lzc29yIGZvciBjYW1lcmEgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NhbWVyYS5qcycpLkNhbWVyYX0gY2FtZXJhIC0gVGhlIGNhbWVyYSBjb250YWluaW5nIHRoZSB2aWV3cG9ydFxuICAgICAqIGluZm9ybWF0aW9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSBbcmVuZGVyVGFyZ2V0XSAtIFRoZVxuICAgICAqIHJlbmRlciB0YXJnZXQuIE5VTEwgZm9yIHRoZSBkZWZhdWx0IG9uZS5cbiAgICAgKi9cbiAgICBzZXR1cFZpZXdwb3J0KGNhbWVyYSwgcmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdTRVRVUC1WSUVXUE9SVCcpO1xuXG4gICAgICAgIGNvbnN0IHBpeGVsV2lkdGggPSByZW5kZXJUYXJnZXQgPyByZW5kZXJUYXJnZXQud2lkdGggOiBkZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IHBpeGVsSGVpZ2h0ID0gcmVuZGVyVGFyZ2V0ID8gcmVuZGVyVGFyZ2V0LmhlaWdodCA6IGRldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgcmVjdCA9IGNhbWVyYS5yZWN0O1xuICAgICAgICBsZXQgeCA9IE1hdGguZmxvb3IocmVjdC54ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgIGxldCB5ID0gTWF0aC5mbG9vcihyZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgIGxldCB3ID0gTWF0aC5mbG9vcihyZWN0LnogKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgbGV0IGggPSBNYXRoLmZsb29yKHJlY3QudyAqIHBpeGVsSGVpZ2h0KTtcbiAgICAgICAgZGV2aWNlLnNldFZpZXdwb3J0KHgsIHksIHcsIGgpO1xuXG4gICAgICAgIC8vIGJ5IGRlZmF1bHQgY2xlYXIgaXMgdXNpbmcgdmlld3BvcnQgcmVjdGFuZ2xlLiBVc2Ugc2Npc3NvciByZWN0YW5nbGUgd2hlbiByZXF1aXJlZC5cbiAgICAgICAgaWYgKGNhbWVyYS5fc2Npc3NvclJlY3RDbGVhcikge1xuICAgICAgICAgICAgY29uc3Qgc2Npc3NvclJlY3QgPSBjYW1lcmEuc2Npc3NvclJlY3Q7XG4gICAgICAgICAgICB4ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC54ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICB5ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC55ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICAgICAgdyA9IE1hdGguZmxvb3Ioc2Npc3NvclJlY3QueiAqIHBpeGVsV2lkdGgpO1xuICAgICAgICAgICAgaCA9IE1hdGguZmxvb3Ioc2Npc3NvclJlY3QudyAqIHBpeGVsSGVpZ2h0KTtcbiAgICAgICAgfVxuICAgICAgICBkZXZpY2Uuc2V0U2Npc3Nvcih4LCB5LCB3LCBoKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFyIHRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXQsIHVzaW5nIGN1cnJlbnRseSBzZXQgdXAgdmlld3BvcnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vcmVuZGVyLWFjdGlvbi5qcycpLlJlbmRlckFjdGlvbn0gcmVuZGVyQWN0aW9uIC0gUmVuZGVyIGFjdGlvblxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGNsZWFyIGZsYWdzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIENhbWVyYSBjb250YWluaW5nIHRoZSBjbGVhciB2YWx1ZXMuXG4gICAgICovXG4gICAgY2xlYXIocmVuZGVyQWN0aW9uLCBjYW1lcmEpIHtcblxuICAgICAgICBjb25zdCBmbGFncyA9IChyZW5kZXJBY3Rpb24uY2xlYXJDb2xvciA/IENMRUFSRkxBR19DT0xPUiA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAocmVuZGVyQWN0aW9uLmNsZWFyRGVwdGggPyBDTEVBUkZMQUdfREVQVEggOiAwKSB8XG4gICAgICAgICAgICAgICAgICAgICAgKHJlbmRlckFjdGlvbi5jbGVhclN0ZW5jaWwgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApO1xuXG4gICAgICAgIGlmIChmbGFncykge1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnQ0xFQVItVklFV1BPUlQnKTtcblxuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBmbGFnc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDYW1lcmFVbmlmb3JtcyhjYW1lcmEsIHRhcmdldCkge1xuXG4gICAgICAgIC8vIGZsaXBwaW5nIHByb2ogbWF0cml4XG4gICAgICAgIGNvbnN0IGZsaXBZID0gdGFyZ2V0Py5mbGlwWTtcblxuICAgICAgICBsZXQgdmlld0NvdW50ID0gMTtcbiAgICAgICAgaWYgKGNhbWVyYS54ciAmJiBjYW1lcmEueHIuc2Vzc2lvbikge1xuICAgICAgICAgICAgbGV0IHRyYW5zZm9ybTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IGNhbWVyYS5fbm9kZS5wYXJlbnQ7XG4gICAgICAgICAgICBpZiAocGFyZW50KVxuICAgICAgICAgICAgICAgIHRyYW5zZm9ybSA9IHBhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBjb25zdCB2aWV3cyA9IGNhbWVyYS54ci52aWV3cztcbiAgICAgICAgICAgIHZpZXdDb3VudCA9IHZpZXdzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IHYgPSAwOyB2IDwgdmlld0NvdW50OyB2KyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gdmlld3Nbdl07XG5cbiAgICAgICAgICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld0ludk9mZk1hdC5tdWwyKHRyYW5zZm9ybSwgdmlldy52aWV3SW52TWF0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3T2ZmTWF0LmNvcHkodmlldy52aWV3SW52T2ZmTWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdJbnZPZmZNYXQuY29weSh2aWV3LnZpZXdJbnZNYXQpO1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdPZmZNYXQuY29weSh2aWV3LnZpZXdNYXQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZpZXcudmlld01hdDMuc2V0RnJvbU1hdDQodmlldy52aWV3T2ZmTWF0KTtcbiAgICAgICAgICAgICAgICB2aWV3LnByb2pWaWV3T2ZmTWF0Lm11bDIodmlldy5wcm9qTWF0LCB2aWV3LnZpZXdPZmZNYXQpO1xuXG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblswXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzEyXTtcbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzFdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTNdO1xuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMl0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxNF07XG5cbiAgICAgICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3LnByb2pWaWV3T2ZmTWF0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gUHJvamVjdGlvbiBNYXRyaXhcbiAgICAgICAgICAgIGxldCBwcm9qTWF0ID0gY2FtZXJhLnByb2plY3Rpb25NYXRyaXg7XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbihwcm9qTWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcHJvak1hdFNreWJveCA9IGNhbWVyYS5nZXRQcm9qZWN0aW9uTWF0cml4U2t5Ym94KCk7XG5cbiAgICAgICAgICAgIC8vIGZsaXAgcHJvamVjdGlvbiBtYXRyaWNlc1xuICAgICAgICAgICAgaWYgKGZsaXBZKSB7XG4gICAgICAgICAgICAgICAgcHJvak1hdCA9IF90ZW1wUHJvak1hdDAubXVsMihfZmxpcFlNYXQsIHByb2pNYXQpO1xuICAgICAgICAgICAgICAgIHByb2pNYXRTa3lib3ggPSBfdGVtcFByb2pNYXQxLm11bDIoX2ZsaXBZTWF0LCBwcm9qTWF0U2t5Ym94KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGRlcHRoIHJhbmdlIG9mIHByb2plY3Rpb24gbWF0cmljZXMgKC0xLi4xIHRvIDAuLjEpXG4gICAgICAgICAgICBpZiAodGhpcy5kZXZpY2UuZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9XRUJHUFUpIHtcbiAgICAgICAgICAgICAgICBwcm9qTWF0ID0gX3RlbXBQcm9qTWF0Mi5tdWwyKF9maXhQcm9qUmFuZ2VNYXQsIHByb2pNYXQpO1xuICAgICAgICAgICAgICAgIHByb2pNYXRTa3lib3ggPSBfdGVtcFByb2pNYXQzLm11bDIoX2ZpeFByb2pSYW5nZU1hdCwgcHJvak1hdFNreWJveCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucHJvaklkLnNldFZhbHVlKHByb2pNYXQuZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnByb2pTa3lib3hJZC5zZXRWYWx1ZShwcm9qTWF0U2t5Ym94LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3SW52ZXJzZSBNYXRyaXhcbiAgICAgICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSh2aWV3SW52TWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvcyA9IGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvdCA9IGNhbWVyYS5fbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgICAgIHZpZXdJbnZNYXQuc2V0VFJTKHBvcywgcm90LCBWZWMzLk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3SW52TWF0LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IE1hdHJpeFxuICAgICAgICAgICAgdmlld01hdC5jb3B5KHZpZXdJbnZNYXQpLmludmVydCgpO1xuICAgICAgICAgICAgdGhpcy52aWV3SWQuc2V0VmFsdWUodmlld01hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyAzeDNcbiAgICAgICAgICAgIHZpZXdNYXQzLnNldEZyb21NYXQ0KHZpZXdNYXQpO1xuICAgICAgICAgICAgdGhpcy52aWV3SWQzLnNldFZhbHVlKHZpZXdNYXQzLmRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3UHJvamVjdGlvbiBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdQcm9qTWF0Lm11bDIocHJvak1hdCwgdmlld01hdCk7XG4gICAgICAgICAgICB0aGlzLnZpZXdQcm9qSWQuc2V0VmFsdWUodmlld1Byb2pNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIHRoaXMuZmxpcFlJZC5zZXRWYWx1ZShmbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgUG9zaXRpb24gKHdvcmxkIHNwYWNlKVxuICAgICAgICAgICAgdGhpcy5kaXNwYXRjaFZpZXdQb3MoY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCkpO1xuXG4gICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3UHJvak1hdCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRibkJhc2lzLnNldFZhbHVlKGZsaXBZID8gLTEgOiAxKTtcblxuICAgICAgICAvLyBOZWFyIGFuZCBmYXIgY2xpcCB2YWx1ZXNcbiAgICAgICAgY29uc3QgbiA9IGNhbWVyYS5fbmVhckNsaXA7XG4gICAgICAgIGNvbnN0IGYgPSBjYW1lcmEuX2ZhckNsaXA7XG4gICAgICAgIHRoaXMubmVhckNsaXBJZC5zZXRWYWx1ZShuKTtcbiAgICAgICAgdGhpcy5mYXJDbGlwSWQuc2V0VmFsdWUoZik7XG5cbiAgICAgICAgLy8gY2FtZXJhIHBhcmFtc1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1swXSA9IDEgLyBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1sxXSA9IGY7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzJdID0gbjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbM10gPSBjYW1lcmEucHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgPyAxIDogMDtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNJZC5zZXRWYWx1ZSh0aGlzLmNhbWVyYVBhcmFtcyk7XG5cbiAgICAgICAgLy8gZXhwb3N1cmVcbiAgICAgICAgdGhpcy5leHBvc3VyZUlkLnNldFZhbHVlKHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cyA/IGNhbWVyYS5nZXRFeHBvc3VyZSgpIDogdGhpcy5zY2VuZS5leHBvc3VyZSk7XG5cbiAgICAgICAgcmV0dXJuIHZpZXdDb3VudDtcbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgY29sb3JXcml0ZSBpcyBzZXQgdG8gdHJ1ZSB0byBhbGwgY2hhbm5lbHMsIGlmIHlvdSB3YW50IHRvIGZ1bGx5IGNsZWFyIHRoZSB0YXJnZXRcbiAgICAvLyBUT0RPOiB0aGlzIGZ1bmN0aW9uIGlzIG9ubHkgdXNlZCBmcm9tIG91dHNpZGUgb2YgZm9yd2FyZCByZW5kZXJlciwgYW5kIHNob3VsZCBiZSBkZXByZWNhdGVkXG4gICAgLy8gd2hlbiB0aGUgZnVuY3Rpb25hbGl0eSBtb3ZlcyB0byB0aGUgcmVuZGVyIHBhc3Nlcy4gTm90ZSB0aGF0IEVkaXRvciB1c2VzIGl0IGFzIHdlbGwuXG4gICAgc2V0Q2FtZXJhKGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgcmVuZGVyQWN0aW9uID0gbnVsbCkge1xuXG4gICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpO1xuICAgICAgICB0aGlzLmNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB0aGlzIGlzIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBsaWdodG1hcHBlciBhbmQgdGhlIEVkaXRvcixcbiAgICAvLyBhbmQgd2lsbCBiZSByZW1vdmVkIHdoZW4gdGhvc2UgY2FsbCBhcmUgcmVtb3ZlZC5cbiAgICBjbGVhclZpZXcoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCBmb3JjZVdyaXRlKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXJyk7XG5cbiAgICAgICAgZGV2aWNlLnNldFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgICAgICBkZXZpY2UudXBkYXRlQmVnaW4oKTtcblxuICAgICAgICBpZiAoZm9yY2VXcml0ZSkge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBWaWV3cG9ydChjYW1lcmEsIHRhcmdldCk7XG5cbiAgICAgICAgaWYgKGNsZWFyKSB7XG4gICAgICAgICAgICAvLyB1c2UgY2FtZXJhIGNsZWFyIG9wdGlvbnMgaWYgYW55XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0gY2FtZXJhLl9jbGVhck9wdGlvbnM7XG5cbiAgICAgICAgICAgIGRldmljZS5jbGVhcihvcHRpb25zID8gb3B0aW9ucyA6IHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIGZsYWdzOiAoY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyID8gQ0xFQVJGTEFHX0NPTE9SIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhclN0ZW5jaWxCdWZmZXIgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0Q3VsbE1vZGUoY3VsbEZhY2VzLCBmbGlwLCBkcmF3Q2FsbCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuICAgICAgICBsZXQgbW9kZSA9IENVTExGQUNFX05PTkU7XG4gICAgICAgIGlmIChjdWxsRmFjZXMpIHtcbiAgICAgICAgICAgIGxldCBmbGlwRmFjZXMgPSAxO1xuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuY3VsbCA+IENVTExGQUNFX05PTkUgJiYgbWF0ZXJpYWwuY3VsbCA8IENVTExGQUNFX0ZST05UQU5EQkFDSykge1xuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5mbGlwRmFjZXMpXG4gICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyAqPSAtMTtcblxuICAgICAgICAgICAgICAgIGlmIChmbGlwKVxuICAgICAgICAgICAgICAgICAgICBmbGlwRmFjZXMgKj0gLTE7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB3dCA9IGRyYXdDYWxsLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgd3QuZ2V0WCh3b3JsZE1hdFgpO1xuICAgICAgICAgICAgICAgIHd0LmdldFkod29ybGRNYXRZKTtcbiAgICAgICAgICAgICAgICB3dC5nZXRaKHdvcmxkTWF0Wik7XG4gICAgICAgICAgICAgICAgd29ybGRNYXRYLmNyb3NzKHdvcmxkTWF0WCwgd29ybGRNYXRZKTtcbiAgICAgICAgICAgICAgICBpZiAod29ybGRNYXRYLmRvdCh3b3JsZE1hdFopIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICBmbGlwRmFjZXMgKj0gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmxpcEZhY2VzIDwgMCkge1xuICAgICAgICAgICAgICAgIG1vZGUgPSBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9GUk9OVCA/IENVTExGQUNFX0JBQ0sgOiBDVUxMRkFDRV9GUk9OVDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbW9kZSA9IG1hdGVyaWFsLmN1bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5kZXZpY2Uuc2V0Q3VsbE1vZGUobW9kZSk7XG5cbiAgICAgICAgaWYgKG1vZGUgPT09IENVTExGQUNFX05PTkUgJiYgbWF0ZXJpYWwuY3VsbCA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgY29uc3Qgd3QyID0gZHJhd0NhbGwubm9kZS53b3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgIHd0Mi5nZXRYKHdvcmxkTWF0WCk7XG4gICAgICAgICAgICB3dDIuZ2V0WSh3b3JsZE1hdFkpO1xuICAgICAgICAgICAgd3QyLmdldFood29ybGRNYXRaKTtcbiAgICAgICAgICAgIHdvcmxkTWF0WC5jcm9zcyh3b3JsZE1hdFgsIHdvcmxkTWF0WSk7XG4gICAgICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKHdvcmxkTWF0WC5kb3Qod29ybGRNYXRaKSA8IDAgPyAtMS4wIDogMS4wKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNhbWVyYUZydXN0dW0oY2FtZXJhKSB7XG5cbiAgICAgICAgaWYgKGNhbWVyYS54ciAmJiBjYW1lcmEueHIudmlld3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgZnJ1c3R1bSBiYXNlZCBvbiBYUiB2aWV3XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gY2FtZXJhLnhyLnZpZXdzWzBdO1xuICAgICAgICAgICAgdmlld1Byb2pNYXQubXVsMih2aWV3LnByb2pNYXQsIHZpZXcudmlld09mZk1hdCk7XG4gICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3UHJvak1hdCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9qTWF0ID0gY2FtZXJhLnByb2plY3Rpb25NYXRyaXg7XG4gICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbikge1xuICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24ocHJvak1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcG9zID0gY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIHZpZXdJbnZNYXQuc2V0VFJTKHBvcywgcm90LCBWZWMzLk9ORSk7XG4gICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3SW52TWF0LmRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcblxuICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3UHJvak1hdCk7XG4gICAgfVxuXG4gICAgc2V0QmFzZUNvbnN0YW50cyhkZXZpY2UsIG1hdGVyaWFsKSB7XG5cbiAgICAgICAgLy8gQ3VsbCBtb2RlXG4gICAgICAgIGRldmljZS5zZXRDdWxsTW9kZShtYXRlcmlhbC5jdWxsKTtcblxuICAgICAgICAvLyBBbHBoYSB0ZXN0XG4gICAgICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwKSB7XG4gICAgICAgICAgICB0aGlzLm9wYWNpdHlNYXBJZC5zZXRWYWx1ZShtYXRlcmlhbC5vcGFjaXR5TWFwKTtcbiAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcblxuICAgICAgICBfc2tpblVwZGF0ZUluZGV4Kys7XG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBpZiAoZHJhd0NhbGxzQ291bnQgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2kgPSBkcmF3Q2FsbHNbaV0uc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKHNpKSB7XG4gICAgICAgICAgICAgICAgc2kudXBkYXRlTWF0cmljZXMoZHJhd0NhbGxzW2ldLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIHNpLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBjb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNraW4gPSBkcmF3Q2FsbC5za2luSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKHNraW4gJiYgc2tpbi5fZGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpbi51cGRhdGVNYXRyaXhQYWxldHRlKGRyYXdDYWxsLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBza2luLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc2tpblRpbWUgKz0gbm93KCkgLSBza2luVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgdXBkYXRlTW9ycGhpbmcoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbW9ycGhUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoSW5zdCA9IGRyYXdDYWxsLm1vcnBoSW5zdGFuY2U7XG4gICAgICAgICAgICBpZiAobW9ycGhJbnN0ICYmIG1vcnBoSW5zdC5fZGlydHkgJiYgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSkge1xuICAgICAgICAgICAgICAgIG1vcnBoSW5zdC51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX21vcnBoVGltZSArPSBub3coKSAtIG1vcnBoVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZ3B1VXBkYXRlKGRyYXdDYWxscykge1xuICAgICAgICAvLyBza2lwIGV2ZXJ5dGhpbmcgd2l0aCB2aXNpYmxlVGhpc0ZyYW1lID09PSBmYWxzZVxuICAgICAgICB0aGlzLnVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscyk7XG4gICAgfVxuXG4gICAgc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpIHtcblxuICAgICAgICAvLyBtYWluIHZlcnRleCBidWZmZXJcbiAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihtZXNoLnZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgc2V0TW9ycGhpbmcoZGV2aWNlLCBtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UubW9ycGgudXNlVGV4dHVyZU1vcnBoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyIHdpdGggdmVydGV4IGlkc1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobW9ycGhJbnN0YW5jZS5tb3JwaC52ZXJ0ZXhCdWZmZXJJZHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXguc2V0VmFsdWUobW9ycGhJbnN0YW5jZS50ZXh0dXJlUG9zaXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZU5vcm1hbHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3RleHR1cmVQYXJhbXMpO1xuXG4gICAgICAgICAgICB9IGVsc2UgeyAgICAvLyB2ZXJ0ZXggYXR0cmlidXRlcyBiYXNlZCBtb3JwaGluZ1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgdCA9IDA7IHQgPCBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgdCsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmIgPSBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzW3RdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGF0Y2ggc2VtYW50aWMgZm9yIHRoZSBidWZmZXIgdG8gY3VycmVudCBBVFRSIHNsb3QgKHVzaW5nIEFUVFI4IC0gQVRUUjE1IHJhbmdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBTRU1BTlRJQ19BVFRSICsgKHQgKyA4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC5lbGVtZW50c1swXS5uYW1lID0gc2VtYW50aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0uc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNlbWFudGljKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcih2Yik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgYWxsIDggd2VpZ2h0c1xuICAgICAgICAgICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQS5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl9zaGFkZXJNb3JwaFdlaWdodHNBKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Iuc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSkge1xuICAgICAgICBpZiAobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2tpbkRyYXdDYWxscysrO1xuICAgICAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c0JvbmVUZXh0dXJlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVUZXh0dXJlID0gbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5ib25lVGV4dHVyZTtcbiAgICAgICAgICAgICAgICB0aGlzLmJvbmVUZXh0dXJlSWQuc2V0VmFsdWUoYm9uZVRleHR1cmUpO1xuICAgICAgICAgICAgICAgIGJvbmVUZXh0dXJlU2l6ZVswXSA9IGJvbmVUZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgIGJvbmVUZXh0dXJlU2l6ZVsxXSA9IGJvbmVUZXh0dXJlLmhlaWdodDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMl0gPSAxLjAgLyBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbM10gPSAxLjAgLyBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZC5zZXRWYWx1ZShib25lVGV4dHVyZVNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2VNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlLm1hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0cyBWZWMzIGNhbWVyYSBwb3NpdGlvbiB1bmlmb3JtXG4gICAgZGlzcGF0Y2hWaWV3UG9zKHBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZwID0gdGhpcy52aWV3UG9zOyAgICAvLyBub3RlIHRoYXQgdGhpcyByZXVzZXMgYW4gYXJyYXlcbiAgICAgICAgdnBbMF0gPSBwb3NpdGlvbi54O1xuICAgICAgICB2cFsxXSA9IHBvc2l0aW9uLnk7XG4gICAgICAgIHZwWzJdID0gcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodnApO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIHNvbWUgdGV4dHVyZXNcbiAgICAgICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG5ldyBCaW5kR3JvdXBGb3JtYXQodGhpcy5kZXZpY2UsIFtcbiAgICAgICAgICAgICAgICBuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpXG4gICAgICAgICAgICBdLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdsaWdodHNUZXh0dXJlRmxvYXQnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHZpZXdCaW5kR3JvdXBzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCwgdmlld0NvdW50KSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KEFycmF5LmlzQXJyYXkodmlld0JpbmRHcm91cHMpLCBcInZpZXdCaW5kR3JvdXBzIG11c3QgYmUgYW4gYXJyYXlcIik7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnLmFzc2VydCh2aWV3Q291bnQgPT09IDEsIFwiVGhpcyBjb2RlIGRvZXMgbm90IGhhbmRsZSB0aGUgdmlld0NvdW50IHlldFwiKTtcblxuICAgICAgICB3aGlsZSAodmlld0JpbmRHcm91cHMubGVuZ3RoIDwgdmlld0NvdW50KSB7XG4gICAgICAgICAgICBjb25zdCB1YiA9IG5ldyBVbmlmb3JtQnVmZmVyKGRldmljZSwgdmlld1VuaWZvcm1Gb3JtYXQpO1xuICAgICAgICAgICAgY29uc3QgYmcgPSBuZXcgQmluZEdyb3VwKGRldmljZSwgdmlld0JpbmRHcm91cEZvcm1hdCwgdWIpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShiZywgYFZpZXdCaW5kR3JvdXBfJHtiZy5pZH1gKTtcbiAgICAgICAgICAgIHZpZXdCaW5kR3JvdXBzLnB1c2goYmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHZpZXcgYmluZCBncm91cCAvIHVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHZpZXdCaW5kR3JvdXAgPSB2aWV3QmluZEdyb3Vwc1swXTtcbiAgICAgICAgdmlld0JpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgdmlld0JpbmRHcm91cC51cGRhdGUoKTtcblxuICAgICAgICAvLyBUT0RPOyB0aGlzIG5lZWRzIHRvIGJlIG1vdmVkIHRvIGRyYXdJbnN0YW5jZSBmdW5jdGlvbnMgdG8gaGFuZGxlIFhSXG4gICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX1ZJRVcsIHZpZXdCaW5kR3JvdXApO1xuICAgIH1cblxuICAgIHNldHVwTWVzaFVuaWZvcm1CdWZmZXJzKG1lc2hJbnN0YW5jZSwgcGFzcykge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcblxuICAgICAgICAgICAgLy8gVE9ETzogbW9kZWwgbWF0cml4IHNldHVwIGlzIHBhcnQgb2YgdGhlIGRyYXdJbnN0YW5jZSBjYWxsLCBidXQgd2l0aCB1bmlmb3JtIGJ1ZmZlciBpdCdzIG5lZWRlZFxuICAgICAgICAgICAgLy8gZWFybGllciBoZXJlLiBUaGlzIG5lZWRzIHRvIGJlIHJlZmFjdG9yZWQgZm9yIG11bHRpLXZpZXcgYW55d2F5cy5cbiAgICAgICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uubm9kZS53b3JsZFRyYW5zZm9ybS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLm5vZGUubm9ybWFsTWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgbWVzaCBiaW5kIGdyb3VwIC8gdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG1lc2hCaW5kR3JvdXAgPSBtZXNoSW5zdGFuY2UuZ2V0QmluZEdyb3VwKGRldmljZSwgcGFzcyk7XG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyLnVwZGF0ZSgpO1xuICAgICAgICAgICAgbWVzaEJpbmRHcm91cC51cGRhdGUoKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX01FU0gsIG1lc2hCaW5kR3JvdXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZHJhd0luc3RhbmNlKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSwgbm9ybWFsKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgbWVzaEluc3RhbmNlLm5vZGUubmFtZSk7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2luZ0RhdGEgPSBtZXNoSW5zdGFuY2UuaW5zdGFuY2luZ0RhdGE7XG4gICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YSkge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIoaW5zdGFuY2luZ0RhdGEudmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIGluc3RhbmNpbmdEYXRhLmNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG1vZGVsTWF0cml4ID0gbWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQuc2V0VmFsdWUobW9kZWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGlmIChub3JtYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLm5vcm1hbE1hdHJpeC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLy8gdXNlZCBmb3Igc3RlcmVvXG4gICAgZHJhd0luc3RhbmNlMihkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXRyaWNlcyBhcmUgYWxyZWFkeSBzZXRcbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgY3VsbChjYW1lcmEsIGRyYXdDYWxscywgdmlzaWJsZUxpc3QpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBjdWxsVGltZSA9IG5vdygpO1xuICAgICAgICBsZXQgbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHZpc2libGVMZW5ndGggPSAwO1xuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgY3VsbGluZ01hc2sgPSBjYW1lcmEuY3VsbGluZ01hc2sgfHwgMHhGRkZGRkZGRjsgLy8gaWYgbWlzc2luZyBhc3N1bWUgY2FtZXJhJ3MgZGVmYXVsdCB2YWx1ZVxuXG4gICAgICAgIGlmICghY2FtZXJhLmZydXN0dW1DdWxsaW5nKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBuZWVkIHRvIGNvcHkgYXJyYXkgYW55d2F5IGJlY2F1c2Ugc29ydGluZyB3aWxsIGhhcHBlbiBhbmQgaXQnbGwgYnJlYWsgb3JpZ2luYWwgZHJhdyBjYWxsIG9yZGVyIGFzc3VtcHRpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLnZpc2libGUgJiYgIWRyYXdDYWxsLmNvbW1hbmQpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIG9iamVjdCdzIG1hc2sgQU5EIHRoZSBjYW1lcmEncyBjdWxsaW5nTWFzayBpcyB6ZXJvIHRoZW4gdGhlIGdhbWUgb2JqZWN0IHdpbGwgYmUgaW52aXNpYmxlIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXNrICYmIChkcmF3Q2FsbC5tYXNrICYgY3VsbGluZ01hc2spID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxlbmd0aCsrO1xuICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHZpc2libGVMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5jb21tYW5kKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC52aXNpYmxlKSBjb250aW51ZTsgLy8gdXNlIHZpc2libGUgcHJvcGVydHkgdG8gcXVpY2tseSBoaWRlL3Nob3cgbWVzaEluc3RhbmNlc1xuICAgICAgICAgICAgICAgIGxldCB2aXNpYmxlID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBvYmplY3QncyBtYXNrIEFORCB0aGUgY2FtZXJhJ3MgY3VsbGluZ01hc2sgaXMgemVybyB0aGVuIHRoZSBnYW1lIG9iamVjdCB3aWxsIGJlIGludmlzaWJsZSBmcm9tIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwubWFzayAmJiAoZHJhd0NhbGwubWFzayAmIGN1bGxpbmdNYXNrKSA9PT0gMCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuY3VsbCkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlID0gZHJhd0NhbGwuX2lzVmlzaWJsZShjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgIG51bURyYXdDYWxsc0N1bGxlZCsrO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodmlzaWJsZSkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2N1bGxUaW1lICs9IG5vdygpIC0gY3VsbFRpbWU7XG4gICAgICAgIHRoaXMuX251bURyYXdDYWxsc0N1bGxlZCArPSBudW1EcmF3Q2FsbHNDdWxsZWQ7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHJldHVybiB2aXNpYmxlTGVuZ3RoO1xuICAgIH1cblxuICAgIGN1bGxMaWdodHMoY2FtZXJhLCBsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgcGh5c2ljYWxVbml0cyA9IHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIC8vIGRpcmVjdGlvbmFsIGxpZ2h0cyBhcmUgbWFya2VkIHZpc2libGUgYXQgdGhlIHN0YXJ0IG9mIHRoZSBmcmFtZVxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LmdldEJvdW5kaW5nU3BoZXJlKHRlbXBTcGhlcmUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUodGVtcFNwaGVyZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudXNlUGh5c2ljYWxVbml0cyA9IHBoeXNpY2FsVW5pdHM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1heGltdW0gc2NyZWVuIGFyZWEgdGFrZW4gYnkgdGhlIGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzY3JlZW5TaXplID0gY2FtZXJhLmdldFNjcmVlblNpemUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC5tYXhTY3JlZW5TaXplID0gTWF0aC5tYXgobGlnaHQubWF4U2NyZWVuU2l6ZSwgc2NyZWVuU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBzaGFkb3cgY2FzdGluZyBsaWdodCBkb2VzIG5vdCBoYXZlIHNoYWRvdyBtYXAgYWxsb2NhdGVkLCBtYXJrIGl0IHZpc2libGUgdG8gYWxsb2NhdGUgc2hhZG93IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90ZTogVGhpcyB3b24ndCBiZSBuZWVkZWQgd2hlbiBjbHVzdGVyZWQgc2hhZG93cyBhcmUgdXNlZCwgYnV0IGF0IHRoZSBtb21lbnQgZXZlbiBjdWxsZWQgb3V0IGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJlIHVzZWQgZm9yIHJlbmRlcmluZywgYW5kIG5lZWQgc2hhZG93IG1hcCB0byBiZSBhbGxvY2F0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGRlbGV0ZSB0aGlzIGNvZGUgd2hlbiBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgaXMgYmVpbmcgcmVtb3ZlZCBhbmQgaXMgb24gYnkgZGVmYXVsdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzICYmICFsaWdodC5zaGFkb3dNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQudXNlUGh5c2ljYWxVbml0cyA9IHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaGFkb3cgbWFwIGN1bGxpbmcgZm9yIGRpcmVjdGlvbmFsIGFuZCB2aXNpYmxlIGxvY2FsIGxpZ2h0c1xuICAgICAqIHZpc2libGUgbWVzaEluc3RhbmNlcyBhcmUgY29sbGVjdGVkIGludG8gbGlnaHQuX3JlbmRlckRhdGEsIGFuZCBhcmUgbWFya2VkIGFzIHZpc2libGVcbiAgICAgKiBmb3IgZGlyZWN0aW9uYWwgbGlnaHRzIGFsc28gc2hhZG93IGNhbWVyYSBtYXRyaXggaXMgc2V0IHVwXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbFNoYWRvd21hcHMoY29tcCkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc3RlcnMgY3VsbGluZyBmb3IgbG9jYWwgKHBvaW50IGFuZCBzcG90KSBsaWdodHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wLl9saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gY29tcC5fbGlnaHRzW2ldO1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcblxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBhdGxhcyBzbG90IGlzIHJlYXNzaWduZWQsIG1ha2Ugc3VyZSB0byB1cGRhdGUgdGhlIHNoYWRvdyBtYXAsIGluY2x1ZGluZyB0aGUgY3VsbGluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNTbG90VXBkYXRlZCAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHQudmlzaWJsZVRoaXNGcmFtZSAmJiBsaWdodC5jYXN0U2hhZG93cyAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlICE9PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYXN0ZXJzID0gY29tcC5fbGlnaHRDb21wb3NpdGlvbkRhdGFbaV0uc2hhZG93Q2FzdGVyc0xpc3Q7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwuY3VsbChsaWdodCwgY2FzdGVycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc3RlcnMgY3VsbGluZyBmb3IgZ2xvYmFsIChkaXJlY3Rpb25hbCkgbGlnaHRzXG4gICAgICAgIC8vIHJlbmRlciBhY3Rpb25zIHN0b3JlIHdoaWNoIGRpcmVjdGlvbmFsIGxpZ2h0cyBhcmUgbmVlZGVkIGZvciBlYWNoIGNhbWVyYSwgc28gdGhlc2UgYXJlIGdldHRpbmcgY3VsbGVkXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IHJlbmRlckFjdGlvbi5kaXJlY3Rpb25hbExpZ2h0c0luZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IHJlbmRlckFjdGlvbi5kaXJlY3Rpb25hbExpZ2h0c0luZGljZXNbal07XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBjb21wLl9saWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgY2FzdGVycyA9IGNvbXAuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdLnNoYWRvd0Nhc3RlcnNMaXN0O1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuY3VsbChsaWdodCwgY2FzdGVycywgcmVuZGVyQWN0aW9uLmNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdmlzaWJpbGl0eSBjdWxsaW5nIG9mIGxpZ2h0cywgbWVzaEluc3RhbmNlcywgc2hhZG93cyBjYXN0ZXJzXG4gICAgICogQWxzbyBhcHBsaWVzIG1lc2hJbnN0YW5jZS52aXNpYmxlIGFuZCBjYW1lcmEuY3VsbGluZ01hc2tcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICBjdWxsQ29tcG9zaXRpb24oY29tcCkge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgY3VsbFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vcmVuZGVyLWFjdGlvbi5qcycpLlJlbmRlckFjdGlvbn0gKi9cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG5cbiAgICAgICAgICAgIC8vIGxheWVyXG4gICAgICAgICAgICBjb25zdCBsYXllckluZGV4ID0gcmVuZGVyQWN0aW9uLmxheWVySW5kZXg7XG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gKi9cbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICBpZiAoIWxheWVyLmVuYWJsZWQgfHwgIWNvbXAuc3ViTGF5ZXJFbmFibGVkW2xheWVySW5kZXhdKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbbGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYVxuICAgICAgICAgICAgY29uc3QgY2FtZXJhUGFzcyA9IHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleDtcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSAqL1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZyYW1lVXBkYXRlKHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNhbWVyYSBhbmQgZnJ1c3R1bSBvbmNlXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNhbWVyYUZydXN0dW0oY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCsrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGN1bGwgZWFjaCBsYXllcidzIG5vbi1kaXJlY3Rpb25hbCBsaWdodHMgb25jZSB3aXRoIGVhY2ggY2FtZXJhXG4gICAgICAgICAgICAgICAgLy8gbGlnaHRzIGFyZW4ndCBjb2xsZWN0ZWQgYW55d2hlcmUsIGJ1dCBtYXJrZWQgYXMgdmlzaWJsZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VsbExpZ2h0cyhjYW1lcmEuY2FtZXJhLCBsYXllci5fbGlnaHRzKTtcblxuICAgICAgICAgICAgICAgIC8vIGN1bGwgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAgICAgLy8gY29sbGVjdCB0aGVtIGludG8gbGF5ZXIgYXJyYXlzXG4gICAgICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgICAgICAvLyBzaGFyZWQgb2JqZWN0cyBhcmUgb25seSBjdWxsZWQgb25jZVxuICAgICAgICAgICAgICAgIGlmICghdmlzaWJsZS5kb25lKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLm9uUHJlQ3VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25QcmVDdWxsKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gdHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxlbmd0aCA9IHRoaXMuY3VsbChjYW1lcmEuY2FtZXJhLCBkcmF3Q2FsbHMsIHZpc2libGUubGlzdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLm9uUG9zdEN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUG9zdEN1bGwoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgc2hhZG93IC8gY29va2llIGF0bGFzIGFsbG9jYXRpb24gZm9yIHRoZSB2aXNpYmxlIGxpZ2h0cy4gVXBkYXRlIGl0IGFmdGVyIHRoZSBsaWd0aHRzIHdlcmUgY3VsbGVkLFxuICAgICAgICAvLyBidXQgYmVmb3JlIHNoYWRvdyBtYXBzIHdlcmUgY3VsbGluZywgYXMgaXQgbWlnaHQgZm9yY2Ugc29tZSAndXBkYXRlIG9uY2UnIHNoYWRvd3MgdG8gY3VsbC5cbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzKGNvbXApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3VsbCBzaGFkb3cgY2FzdGVycyBmb3IgYWxsIGxpZ2h0c1xuICAgICAgICB0aGlzLmN1bGxTaGFkb3dtYXBzKGNvbXApO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gTWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbmx5TGl0U2hhZGVycyAtIExpbWl0cyB0aGUgdXBkYXRlIHRvIHNoYWRlcnMgYWZmZWN0ZWQgYnkgbGlnaHRpbmcuXG4gICAgICovXG4gICAgdXBkYXRlU2hhZGVycyhkcmF3Q2FsbHMsIG9ubHlMaXRTaGFkZXJzKSB7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXQgPSBkcmF3Q2FsbHNbaV0ubWF0ZXJpYWw7XG4gICAgICAgICAgICBpZiAobWF0KSB7XG4gICAgICAgICAgICAgICAgLy8gbWF0ZXJpYWwgbm90IHByb2Nlc3NlZCB5ZXRcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhtYXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIF90ZW1wU2V0LmFkZChtYXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBmb3IgbWF0ZXJpYWxzIG5vdCB1c2luZyB2YXJpYW50c1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0LmdldFNoYWRlclZhcmlhbnQgIT09IE1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXJWYXJpYW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbmx5TGl0U2hhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNraXAgbWF0ZXJpYWxzIG5vdCB1c2luZyBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0LnVzZUxpZ2h0aW5nIHx8IChtYXQuZW1pdHRlciAmJiAhbWF0LmVtaXR0ZXIubGlnaHRpbmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2hhZGVyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbCBhbmQgYWxzbyBvbiBtZXNoIGluc3RhbmNlcyB0aGF0IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcbiAgICB9XG5cbiAgICByZW5kZXJDb29raWVzKGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IGNvb2tpZVJlbmRlclRhcmdldCA9IHRoaXMubGlnaHRUZXh0dXJlQXRsYXMuY29va2llUmVuZGVyVGFyZ2V0O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgIC8vIHNraXAgY2x1c3RlcmVkIGNvb2tpZXMgd2l0aCBubyBhc3NpZ25lZCBhdGxhcyBzbG90XG4gICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIG9ubHkgcmVuZGVyIGNvb2tpZSB3aGVuIHRoZSBzbG90IGlzIHJlYXNzaWduZWQgKGFzc3VtaW5nIHRoZSBjb29raWUgdGV4dHVyZSBpcyBzdGF0aWMpXG4gICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzU2xvdFVwZGF0ZWQpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyLnJlbmRlcihsaWdodCwgY29va2llUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbiB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBsaWdodHNDaGFuZ2VkIC0gVHJ1ZSBpZiBsaWdodHMgb2YgdGhlIGNvbXBvc2l0aW9uIGhhcyBjaGFuZ2VkLlxuICAgICAqL1xuICAgIGJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCkge1xuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcztcblxuICAgICAgICAvLyBVcGRhdGUgc2hhZGVycyBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBpZiAoc2NlbmUudXBkYXRlU2hhZGVycyB8fCBsaWdodHNDaGFuZ2VkKSB7XG4gICAgICAgICAgICBjb25zdCBvbmx5TGl0U2hhZGVycyA9ICFzY2VuZS51cGRhdGVTaGFkZXJzICYmIGxpZ2h0c0NoYW5nZWQ7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMobWVzaEluc3RhbmNlcywgb25seUxpdFNoYWRlcnMpO1xuICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IGZhbHNlO1xuICAgICAgICAgICAgc2NlbmUuX3NoYWRlclZlcnNpb24rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBhbGwgc2tpbiBtYXRyaWNlcyB0byBwcm9wZXJseSBjdWxsIHNraW5uZWQgb2JqZWN0cyAoYnV0IGRvbid0IHVwZGF0ZSByZW5kZXJpbmcgZGF0YSB5ZXQpXG4gICAgICAgIHRoaXMudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKG1lc2hJbnN0YW5jZXMpO1xuXG4gICAgICAgIC8vIGNsZWFyIG1lc2ggaW5zdGFuY2UgdmlzaWJpbGl0eVxuICAgICAgICBjb25zdCBtaUNvdW50ID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWlDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGxpZ2h0IHZpc2liaWxpdHlcbiAgICAgICAgY29uc3QgbGlnaHRzID0gY29tcC5fbGlnaHRzO1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodENvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGxpZ2h0c1tpXS5iZWdpbkZyYW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoY29tcCkge1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLnVwZGF0ZShjb21wLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIGNvbXAuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5zY2VuZS5saWdodGluZyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZUNsdXN0ZXJzKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBlbXB0eVdvcmxkQ2x1c3RlcnMgPSBjb21wLmdldEVtcHR5V29ybGRDbHVzdGVycyh0aGlzLmRldmljZSk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXIgPSByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycztcblxuICAgICAgICAgICAgaWYgKGNsdXN0ZXIgJiYgY2x1c3RlciAhPT0gZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZWFjaCBjbHVzdGVyIG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhjbHVzdGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcFNldC5hZGQoY2x1c3Rlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXIudXBkYXRlKGxheWVyLmNsdXN0ZXJlZExpZ2h0c1NldCwgdGhpcy5zY2VuZS5nYW1tYUNvcnJlY3Rpb24sIHRoaXMuc2NlbmUubGlnaHRpbmcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnNUaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gY29tcC5fd29ybGRDbHVzdGVycy5sZW5ndGg7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIGxheWVyIGNvbXBvc2l0aW9uIGZvciByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIC0gVHJ1ZSBpZiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEZsYWdzIG9mIHdoYXQgd2FzIHVwZGF0ZWRcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGxlbiA9IGNvbXAubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29tcC5sYXllckxpc3RbaV0uX3Bvc3RSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3Qgc2hhZGVyVmVyc2lvbiA9IHNjZW5lLl9zaGFkZXJWZXJzaW9uO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgbGF5ZXIuX3NoYWRlclZlcnNpb24gPSBzaGFkZXJWZXJzaW9uO1xuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgbGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3JlbmRlclRpbWUgPSAwO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyA9IDA7XG4gICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgaWYgKHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyIHw9IDI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciB8PSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyTWF4ID0gbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyO1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGxheWVyIGZvciBjdWxsaW5nIHdpdGggdGhlIGNhbWVyYVxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsYXllci5jYW1lcmFzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuaW5zdGFuY2VzLnByZXBhcmUoaik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdlbmVyYXRlIHN0YXRpYyBsaWdodGluZyBmb3IgbWVzaGVzIGluIHRoaXMgbGF5ZXIgaWYgbmVlZGVkXG4gICAgICAgICAgICAvLyBOb3RlOiBTdGF0aWMgbGlnaHRpbmcgaXMgbm90IHVzZWQgd2hlbiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKGxheWVyLl9uZWVkc1N0YXRpY1ByZXBhcmUgJiYgbGF5ZXIuX3N0YXRpY0xpZ2h0SGFzaCAmJiAhdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiByZXVzZSB3aXRoIHRoZSBzYW1lIHN0YXRpY0xpZ2h0SGFzaFxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fc3RhdGljUHJlcGFyZURvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnJldmVydChsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnJldmVydChsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucHJlcGFyZSh0aGlzLmRldmljZSwgc2NlbmUsIGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXMsIGxheWVyLl9saWdodHMpO1xuICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5wcmVwYXJlKHRoaXMuZGV2aWNlLCBzY2VuZSwgbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzLCBsYXllci5fbGlnaHRzKTtcbiAgICAgICAgICAgICAgICBjb21wLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX25lZWRzU3RhdGljUHJlcGFyZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGxheWVyLl9zdGF0aWNQcmVwYXJlRG9uZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgc3RhdGljIGxheWVyIGRhdGEsIGlmIHNvbWV0aGluZydzIGNoYW5nZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IGNvbXAuX3VwZGF0ZSh0aGlzLmRldmljZSwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lICs9IG5vdygpIC0gbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHJldHVybiB1cGRhdGVkO1xuICAgIH1cblxuICAgIGZyYW1lVXBkYXRlKCkge1xuXG4gICAgICAgIHRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJfc2tpblVwZGF0ZUluZGV4IiwiYm9uZVRleHR1cmVTaXplIiwidmlld1Byb2pNYXQiLCJNYXQ0Iiwidmlld0ludk1hdCIsInZpZXdNYXQiLCJ3b3JsZE1hdFgiLCJWZWMzIiwid29ybGRNYXRZIiwid29ybGRNYXRaIiwidmlld01hdDMiLCJNYXQzIiwidGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiX2ZsaXBZTWF0Iiwic2V0U2NhbGUiLCJfZml4UHJvalJhbmdlTWF0Iiwic2V0IiwiX3RlbXBQcm9qTWF0MCIsIl90ZW1wUHJvak1hdDEiLCJfdGVtcFByb2pNYXQyIiwiX3RlbXBQcm9qTWF0MyIsIl90ZW1wU2V0IiwiU2V0IiwiUmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkIiwiZGV2aWNlIiwic2NlbmUiLCJsaWdodFRleHR1cmVBdGxhcyIsIkxpZ2h0VGV4dHVyZUF0bGFzIiwic2hhZG93TWFwQ2FjaGUiLCJTaGFkb3dNYXBDYWNoZSIsInNoYWRvd1JlbmRlcmVyIiwiU2hhZG93UmVuZGVyZXIiLCJfc2hhZG93UmVuZGVyZXJMb2NhbCIsIlNoYWRvd1JlbmRlcmVyTG9jYWwiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIlNoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJfY29va2llUmVuZGVyZXIiLCJDb29raWVSZW5kZXJlciIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsIl9za2luVGltZSIsIl9tb3JwaFRpbWUiLCJfY3VsbFRpbWUiLCJfc2hhZG93TWFwVGltZSIsIl9saWdodENsdXN0ZXJzVGltZSIsIl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2tpbkRyYXdDYWxscyIsIl9pbnN0YW5jZWREcmF3Q2FsbHMiLCJfc2hhZG93TWFwVXBkYXRlcyIsIl9udW1EcmF3Q2FsbHNDdWxsZWQiLCJfY2FtZXJhc1JlbmRlcmVkIiwiX2xpZ2h0Q2x1c3RlcnMiLCJzY29wZSIsImJvbmVUZXh0dXJlSWQiLCJyZXNvbHZlIiwiYm9uZVRleHR1cmVTaXplSWQiLCJwb3NlTWF0cml4SWQiLCJtb2RlbE1hdHJpeElkIiwibm9ybWFsTWF0cml4SWQiLCJ2aWV3SW52SWQiLCJ2aWV3UG9zIiwiRmxvYXQzMkFycmF5Iiwidmlld1Bvc0lkIiwicHJvaklkIiwicHJvalNreWJveElkIiwidmlld0lkIiwidmlld0lkMyIsInZpZXdQcm9qSWQiLCJmbGlwWUlkIiwidGJuQmFzaXMiLCJuZWFyQ2xpcElkIiwiZmFyQ2xpcElkIiwiY2FtZXJhUGFyYW1zIiwiY2FtZXJhUGFyYW1zSWQiLCJhbHBoYVRlc3RJZCIsIm9wYWNpdHlNYXBJZCIsImV4cG9zdXJlSWQiLCJ0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZCIsIm1vcnBoV2VpZ2h0c0EiLCJtb3JwaFdlaWdodHNCIiwibW9ycGhQb3NpdGlvblRleCIsIm1vcnBoTm9ybWFsVGV4IiwibW9ycGhUZXhQYXJhbXMiLCJkZXN0cm95Iiwic29ydENvbXBhcmUiLCJkcmF3Q2FsbEEiLCJkcmF3Q2FsbEIiLCJsYXllciIsImRyYXdPcmRlciIsInpkaXN0IiwiemRpc3QyIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsInNvcnRDb21wYXJlTWVzaCIsImtleUEiLCJrZXlCIiwibWVzaCIsImlkIiwic29ydENvbXBhcmVEZXB0aCIsIlNPUlRLRVlfREVQVEgiLCJzZXR1cFZpZXdwb3J0IiwiY2FtZXJhIiwicmVuZGVyVGFyZ2V0IiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJwaXhlbFdpZHRoIiwid2lkdGgiLCJwaXhlbEhlaWdodCIsImhlaWdodCIsInJlY3QiLCJ4IiwiTWF0aCIsImZsb29yIiwieSIsInciLCJ6IiwiaCIsInNldFZpZXdwb3J0IiwiX3NjaXNzb3JSZWN0Q2xlYXIiLCJzY2lzc29yUmVjdCIsInNldFNjaXNzb3IiLCJwb3BHcHVNYXJrZXIiLCJjbGVhciIsInJlbmRlckFjdGlvbiIsImZsYWdzIiwiY2xlYXJDb2xvciIsIkNMRUFSRkxBR19DT0xPUiIsImNsZWFyRGVwdGgiLCJDTEVBUkZMQUdfREVQVEgiLCJjbGVhclN0ZW5jaWwiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNvbG9yIiwiX2NsZWFyQ29sb3IiLCJyIiwiZyIsImIiLCJhIiwiZGVwdGgiLCJfY2xlYXJEZXB0aCIsInN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsIiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJ0YXJnZXQiLCJmbGlwWSIsInZpZXdDb3VudCIsInhyIiwic2Vzc2lvbiIsInRyYW5zZm9ybSIsInBhcmVudCIsIl9ub2RlIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJ2aWV3cyIsImxlbmd0aCIsInYiLCJ2aWV3Iiwidmlld0ludk9mZk1hdCIsIm11bDIiLCJ2aWV3T2ZmTWF0IiwiY29weSIsImludmVydCIsInNldEZyb21NYXQ0IiwicHJvalZpZXdPZmZNYXQiLCJwcm9qTWF0IiwicG9zaXRpb24iLCJkYXRhIiwiZnJ1c3R1bSIsInByb2plY3Rpb25NYXRyaXgiLCJjYWxjdWxhdGVQcm9qZWN0aW9uIiwiVklFV19DRU5URVIiLCJwcm9qTWF0U2t5Ym94IiwiZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCIsImRldmljZVR5cGUiLCJERVZJQ0VUWVBFX1dFQkdQVSIsInNldFZhbHVlIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwicG9zIiwiZ2V0UG9zaXRpb24iLCJyb3QiLCJnZXRSb3RhdGlvbiIsInNldFRSUyIsIk9ORSIsImRpc3BhdGNoVmlld1BvcyIsIm4iLCJfbmVhckNsaXAiLCJmIiwiX2ZhckNsaXAiLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJwaHlzaWNhbFVuaXRzIiwiZ2V0RXhwb3N1cmUiLCJleHBvc3VyZSIsInNldENhbWVyYSIsImNsZWFyVmlldyIsImZvcmNlV3JpdGUiLCJzZXRSZW5kZXJUYXJnZXQiLCJ1cGRhdGVCZWdpbiIsInNldENvbG9yV3JpdGUiLCJzZXREZXB0aFdyaXRlIiwib3B0aW9ucyIsIl9jbGVhck9wdGlvbnMiLCJfY2xlYXJDb2xvckJ1ZmZlciIsIl9jbGVhckRlcHRoQnVmZmVyIiwiX2NsZWFyU3RlbmNpbEJ1ZmZlciIsInNldEN1bGxNb2RlIiwiY3VsbEZhY2VzIiwiZmxpcCIsImRyYXdDYWxsIiwibWF0ZXJpYWwiLCJtb2RlIiwiQ1VMTEZBQ0VfTk9ORSIsImZsaXBGYWNlcyIsImN1bGwiLCJDVUxMRkFDRV9GUk9OVEFOREJBQ0siLCJ3dCIsIm5vZGUiLCJ3b3JsZFRyYW5zZm9ybSIsImdldFgiLCJnZXRZIiwiZ2V0WiIsImNyb3NzIiwiZG90IiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9CQUNLIiwid3QyIiwidXBkYXRlQ2FtZXJhRnJ1c3R1bSIsInNldEJhc2VDb25zdGFudHMiLCJvcGFjaXR5TWFwIiwiYWxwaGFUZXN0IiwidXBkYXRlQ3B1U2tpbk1hdHJpY2VzIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJza2luVGltZSIsIm5vdyIsImkiLCJzaSIsInNraW5JbnN0YW5jZSIsInVwZGF0ZU1hdHJpY2VzIiwiX2RpcnR5IiwidXBkYXRlR3B1U2tpbk1hdHJpY2VzIiwiY291bnQiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwic2tpbiIsInVwZGF0ZU1hdHJpeFBhbGV0dGUiLCJ1cGRhdGVNb3JwaGluZyIsIm1vcnBoVGltZSIsIm1vcnBoSW5zdCIsIm1vcnBoSW5zdGFuY2UiLCJ1cGRhdGUiLCJncHVVcGRhdGUiLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0VmVydGV4QnVmZmVyIiwidmVydGV4QnVmZmVyIiwic2V0TW9ycGhpbmciLCJtb3JwaCIsInVzZVRleHR1cmVNb3JwaCIsInZlcnRleEJ1ZmZlcklkcyIsInRleHR1cmVQb3NpdGlvbnMiLCJ0ZXh0dXJlTm9ybWFscyIsIl90ZXh0dXJlUGFyYW1zIiwidCIsIl9hY3RpdmVWZXJ0ZXhCdWZmZXJzIiwidmIiLCJzZW1hbnRpYyIsIlNFTUFOVElDX0FUVFIiLCJmb3JtYXQiLCJlbGVtZW50cyIsIm5hbWUiLCJzY29wZUlkIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0EiLCJfc2hhZGVyTW9ycGhXZWlnaHRzQiIsInNldFNraW5uaW5nIiwibWVzaEluc3RhbmNlIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJib25lVGV4dHVyZSIsIm1hdHJpeFBhbGV0dGUiLCJ2cCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0Iiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfTUFUNCIsIkJpbmRHcm91cEZvcm1hdCIsIkJpbmRCdWZmZXJGb3JtYXQiLCJVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSIsIlNIQURFUlNUQUdFX1ZFUlRFWCIsIlNIQURFUlNUQUdFX0ZSQUdNRU5UIiwiQmluZFRleHR1cmVGb3JtYXQiLCJURVhUVVJFRElNRU5TSU9OXzJEIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwiRGVidWciLCJhc3NlcnQiLCJBcnJheSIsImlzQXJyYXkiLCJ1YiIsIlVuaWZvcm1CdWZmZXIiLCJiZyIsIkJpbmRHcm91cCIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsInB1c2giLCJ2aWV3QmluZEdyb3VwIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJzZXRCaW5kR3JvdXAiLCJCSU5ER1JPVVBfVklFVyIsInNldHVwTWVzaFVuaWZvcm1CdWZmZXJzIiwicGFzcyIsIm5vcm1hbE1hdHJpeCIsIm1lc2hCaW5kR3JvdXAiLCJnZXRCaW5kR3JvdXAiLCJCSU5ER1JPVVBfTUVTSCIsImRyYXdJbnN0YW5jZSIsInN0eWxlIiwibm9ybWFsIiwiaW5zdGFuY2luZ0RhdGEiLCJkcmF3IiwicHJpbWl0aXZlIiwibW9kZWxNYXRyaXgiLCJkcmF3SW5zdGFuY2UyIiwidW5kZWZpbmVkIiwidmlzaWJsZUxpc3QiLCJjdWxsVGltZSIsIm51bURyYXdDYWxsc0N1bGxlZCIsInZpc2libGVMZW5ndGgiLCJjdWxsaW5nTWFzayIsImZydXN0dW1DdWxsaW5nIiwidmlzaWJsZSIsImNvbW1hbmQiLCJtYXNrIiwiX2lzVmlzaWJsZSIsImN1bGxMaWdodHMiLCJsaWdodHMiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJsaWdodCIsImVuYWJsZWQiLCJfdHlwZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImdldEJvdW5kaW5nU3BoZXJlIiwiY29udGFpbnNTcGhlcmUiLCJ1c2VQaHlzaWNhbFVuaXRzIiwic2NyZWVuU2l6ZSIsImdldFNjcmVlblNpemUiLCJtYXhTY3JlZW5TaXplIiwibWF4IiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dNYXAiLCJjdWxsU2hhZG93bWFwcyIsImNvbXAiLCJpc0NsdXN0ZXJlZCIsIl9saWdodHMiLCJhdGxhc1Nsb3RVcGRhdGVkIiwic2hhZG93VXBkYXRlTW9kZSIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsImNhc3RlcnMiLCJfbGlnaHRDb21wb3NpdGlvbkRhdGEiLCJzaGFkb3dDYXN0ZXJzTGlzdCIsInJlbmRlckFjdGlvbnMiLCJfcmVuZGVyQWN0aW9ucyIsImRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcyIsImoiLCJsaWdodEluZGV4IiwiY3VsbENvbXBvc2l0aW9uIiwibGF5ZXJJbmRleCIsImxheWVyTGlzdCIsInN1YkxheWVyRW5hYmxlZCIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJMaXN0IiwiY2FtZXJhUGFzcyIsImNhbWVyYUluZGV4IiwiY2FtZXJhcyIsImZyYW1lVXBkYXRlIiwiZmlyc3RDYW1lcmFVc2UiLCJvYmplY3RzIiwiaW5zdGFuY2VzIiwidmlzaWJsZVRyYW5zcGFyZW50IiwidmlzaWJsZU9wYXF1ZSIsImRvbmUiLCJvblByZUN1bGwiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJvcGFxdWVNZXNoSW5zdGFuY2VzIiwibGlzdCIsIm9uUG9zdEN1bGwiLCJ1cGRhdGVMaWdodFRleHR1cmVBdGxhcyIsInVwZGF0ZVNoYWRlcnMiLCJvbmx5TGl0U2hhZGVycyIsIm1hdCIsImhhcyIsImFkZCIsImdldFNoYWRlclZhcmlhbnQiLCJNYXRlcmlhbCIsInByb3RvdHlwZSIsInVzZUxpZ2h0aW5nIiwiZW1pdHRlciIsImxpZ2h0aW5nIiwiY2xlYXJWYXJpYW50cyIsInJlbmRlckNvb2tpZXMiLCJjb29raWVSZW5kZXJUYXJnZXQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwicmVuZGVyIiwiYmVnaW5GcmFtZSIsImxpZ2h0c0NoYW5nZWQiLCJtZXNoSW5zdGFuY2VzIiwiX21lc2hJbnN0YW5jZXMiLCJfc2hhZGVyVmVyc2lvbiIsIm1pQ291bnQiLCJsaWdodENvdW50IiwiX3NwbGl0TGlnaHRzIiwiTElHSFRUWVBFX1NQT1QiLCJMSUdIVFRZUEVfT01OSSIsInVwZGF0ZUNsdXN0ZXJzIiwic3RhcnRUaW1lIiwiZW1wdHlXb3JsZENsdXN0ZXJzIiwiZ2V0RW1wdHlXb3JsZENsdXN0ZXJzIiwiY2x1c3RlciIsImxpZ2h0Q2x1c3RlcnMiLCJjbHVzdGVyZWRMaWdodHNTZXQiLCJnYW1tYUNvcnJlY3Rpb24iLCJfd29ybGRDbHVzdGVycyIsInVwZGF0ZUxheWVyQ29tcG9zaXRpb24iLCJsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsImxlbiIsIl9wb3N0UmVuZGVyQ291bnRlciIsInNoYWRlclZlcnNpb24iLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9yZW5kZXJUaW1lIiwiX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJfcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMiLCJfcG9zdFJlbmRlckNvdW50ZXJNYXgiLCJwcmVwYXJlIiwiX25lZWRzU3RhdGljUHJlcGFyZSIsIl9zdGF0aWNMaWdodEhhc2giLCJfc3RhdGljUHJlcGFyZURvbmUiLCJTdGF0aWNNZXNoZXMiLCJyZXZlcnQiLCJ1cGRhdGVkIiwiX3VwZGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBdUNBLElBQUlBLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtBQUN4QixNQUFNQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFB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
