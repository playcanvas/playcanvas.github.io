/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_FRONT, CULLFACE_BACK, CULLFACE_NONE, UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, BINDGROUP_VIEW, BINDGROUP_MESH, SEMANTIC_ATTR } from '../../platform/graphics/constants.js';
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
    this.twoSidedLightingNegScaleFactorId.setValue(0);
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

    // use viewport rectangle by default. Use scissor rectangle when required.
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
      if (this.device.isWebGPU) {
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

  /**
   * Clears the active render target. If the viewport is already set up, only its area is cleared.
   *
   * @param {import('../camera.js').Camera} camera - The camera supplying the value to clear to.
   * @param {boolean} [clearColor] - True if the color buffer should be cleared. Uses the value
   * from the camra if not supplied.
   * @param {boolean} [clearDepth] - True if the depth buffer should be cleared. Uses the value
   * from the camra if not supplied.
   * @param {boolean} [clearStencil] - True if the stencil buffer should be cleared. Uses the
   * value from the camra if not supplied.
   */
  clear(camera, clearColor, clearDepth, clearStencil) {
    const flags = ((clearColor != null ? clearColor : camera._clearColorBuffer) ? CLEARFLAG_COLOR : 0) | ((clearDepth != null ? clearDepth : camera._clearDepthBuffer) ? CLEARFLAG_DEPTH : 0) | ((clearStencil != null ? clearStencil : camera._clearStencilBuffer) ? CLEARFLAG_STENCIL : 0);
    if (flags) {
      const device = this.device;
      DebugGraphics.pushGpuMarker(device, 'CLEAR');
      device.clear({
        color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
        depth: camera._clearDepth,
        stencil: camera._clearStencil,
        flags: flags
      });
      DebugGraphics.popGpuMarker(device);
    }
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
      if (material.cull === CULLFACE_FRONT || material.cull === CULLFACE_BACK) {
        if (drawCall.flipFaces) flipFaces *= -1;
        if (flip) flipFaces *= -1;
        flipFaces *= drawCall.node.negativeScaleWorld;
      }
      if (flipFaces < 0) {
        mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
      } else {
        mode = material.cull;
      }
    }
    this.device.setCullMode(mode);
    if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
      this.twoSidedLightingNegScaleFactorId.setValue(drawCall.node.negativeScaleWorld);
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
    }
    if (material.opacityMap || material.alphaTest > 0) {
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
      this.viewBindGroupFormat = new BindGroupFormat(this.device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)], [new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctc3BoZXJlLmpzJztcblxuaW1wb3J0IHtcbiAgICBTT1JUS0VZX0RFUFRILCBTT1JUS0VZX0ZPUldBUkQsXG4gICAgVklFV19DRU5URVIsIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQge1xuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBCSU5ER1JPVVBfTUVTSCwgQklOREdST1VQX1ZJRVcsIFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FLFxuICAgIFVOSUZPUk1UWVBFX01BVDQsXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBTRU1BTlRJQ19BVFRSLFxuICAgIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX0ZST05ULCBDVUxMRkFDRV9OT05FLFxuICAgIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBCaW5kR3JvdXBGb3JtYXQsIEJpbmRCdWZmZXJGb3JtYXQsIEJpbmRUZXh0dXJlRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuXG5pbXBvcnQgeyBTaGFkb3dNYXBDYWNoZSB9IGZyb20gJy4vc2hhZG93LW1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlckxvY2FsIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXItbG9jYWwuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCB9IGZyb20gJy4vc2hhZG93LXJlbmRlcmVyLWRpcmVjdGlvbmFsLmpzJztcbmltcG9ydCB7IENvb2tpZVJlbmRlcmVyIH0gZnJvbSAnLi9jb29raWUtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgU3RhdGljTWVzaGVzIH0gZnJvbSAnLi9zdGF0aWMtbWVzaGVzLmpzJztcbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXIuanMnO1xuXG5sZXQgX3NraW5VcGRhdGVJbmRleCA9IDA7XG5jb25zdCBib25lVGV4dHVyZVNpemUgPSBbMCwgMCwgMCwgMF07XG5jb25zdCB2aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2aWV3SW52TWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld01hdDMgPSBuZXcgTWF0MygpO1xuY29uc3QgdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX2ZsaXBZTWF0ID0gbmV3IE1hdDQoKS5zZXRTY2FsZSgxLCAtMSwgMSk7XG5cbi8vIENvbnZlcnRzIGEgcHJvamVjdGlvbiBtYXRyaXggaW4gT3BlbkdMIHN0eWxlIChkZXB0aCByYW5nZSBvZiAtMS4uMSkgdG8gYSBEaXJlY3RYIHN0eWxlIChkZXB0aCByYW5nZSBvZiAwLi4xKS5cbmNvbnN0IF9maXhQcm9qUmFuZ2VNYXQgPSBuZXcgTWF0NCgpLnNldChbXG4gICAgMSwgMCwgMCwgMCxcbiAgICAwLCAxLCAwLCAwLFxuICAgIDAsIDAsIDAuNSwgMCxcbiAgICAwLCAwLCAwLjUsIDFcbl0pO1xuXG5jb25zdCBfdGVtcFByb2pNYXQwID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wUHJvak1hdDEgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0MiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQzID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wU2V0ID0gbmV3IFNldCgpO1xuXG4vKipcbiAqIFRoZSBiYXNlIHJlbmRlcmVyIGZ1bmN0aW9uYWxpdHkgdG8gYWxsb3cgaW1wbGVtZW50YXRpb24gb2Ygc3BlY2lhbGl6ZWQgcmVuZGVyZXJzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgUmVuZGVyZXIge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBjbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZXxudWxsfSAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICAvLyB0ZXh0dXJlIGF0bGFzIG1hbmFnaW5nIHNoYWRvdyBtYXAgLyBjb29raWUgdGV4dHVyZSBhdGxhc3NpbmcgZm9yIG9tbmkgYW5kIHNwb3QgbGlnaHRzXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBuZXcgTGlnaHRUZXh0dXJlQXRsYXMoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIC8vIHNoYWRvd3NcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IG5ldyBTaGFkb3dNYXBDYWNoZSgpO1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyID0gbmV3IFNoYWRvd1JlbmRlcmVyKHRoaXMsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsID0gbmV3IFNoYWRvd1JlbmRlcmVyTG9jYWwodGhpcywgdGhpcy5zaGFkb3dSZW5kZXJlcik7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgPSBuZXcgU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCh0aGlzLCB0aGlzLnNoYWRvd1JlbmRlcmVyKTtcblxuICAgICAgICAvLyBjb29raWVzXG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbmV3IENvb2tpZVJlbmRlcmVyKGdyYXBoaWNzRGV2aWNlLCB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAvLyB2aWV3IGJpbmQgZ3JvdXAgZm9ybWF0IHdpdGggaXRzIHVuaWZvcm0gYnVmZmVyIGZvcm1hdFxuICAgICAgICB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0ID0gbnVsbDtcblxuICAgICAgICAvLyB0aW1pbmdcbiAgICAgICAgdGhpcy5fc2tpblRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9tb3JwaFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcblxuICAgICAgICAvLyBzdGF0c1xuICAgICAgICB0aGlzLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuX251bURyYXdDYWxsc0N1bGxlZCA9IDA7XG4gICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnMgPSAwO1xuXG4gICAgICAgIC8vIFVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHNjb3BlID0gZ3JhcGhpY3NEZXZpY2Uuc2NvcGU7XG4gICAgICAgIHRoaXMuYm9uZVRleHR1cmVJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfcG9zZU1hcCcpO1xuICAgICAgICB0aGlzLmJvbmVUZXh0dXJlU2l6ZUlkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9wb3NlTWFwU2l6ZScpO1xuICAgICAgICB0aGlzLnBvc2VNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wb3NlWzBdJyk7XG5cbiAgICAgICAgdGhpcy5tb2RlbE1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X21vZGVsJyk7XG4gICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbm9ybWFsJyk7XG4gICAgICAgIHRoaXMudmlld0ludklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdJbnZlcnNlJyk7XG4gICAgICAgIHRoaXMudmlld1BvcyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkID0gc2NvcGUucmVzb2x2ZSgndmlld19wb3NpdGlvbicpO1xuICAgICAgICB0aGlzLnByb2pJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wcm9qZWN0aW9uJyk7XG4gICAgICAgIHRoaXMucHJvalNreWJveElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Byb2plY3Rpb25Ta3lib3gnKTtcbiAgICAgICAgdGhpcy52aWV3SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlldycpO1xuICAgICAgICB0aGlzLnZpZXdJZDMgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlldzMnKTtcbiAgICAgICAgdGhpcy52aWV3UHJvaklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdQcm9qZWN0aW9uJyk7XG4gICAgICAgIHRoaXMuZmxpcFlJZCA9IHNjb3BlLnJlc29sdmUoJ3Byb2plY3Rpb25GbGlwWScpO1xuICAgICAgICB0aGlzLnRibkJhc2lzID0gc2NvcGUucmVzb2x2ZSgndGJuQmFzaXMnKTtcbiAgICAgICAgdGhpcy5uZWFyQ2xpcElkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX25lYXInKTtcbiAgICAgICAgdGhpcy5mYXJDbGlwSWQgPSBzY29wZS5yZXNvbHZlKCdjYW1lcmFfZmFyJyk7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9wYXJhbXMnKTtcblxuICAgICAgICB0aGlzLmFscGhhVGVzdElkID0gc2NvcGUucmVzb2x2ZSgnYWxwaGFfcmVmJyk7XG4gICAgICAgIHRoaXMub3BhY2l0eU1hcElkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG5cbiAgICAgICAgdGhpcy5leHBvc3VyZUlkID0gc2NvcGUucmVzb2x2ZSgnZXhwb3N1cmUnKTtcbiAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZCA9IHNjb3BlLnJlc29sdmUoJ3R3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcicpO1xuICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKDApO1xuXG4gICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQSA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3dlaWdodHNfYScpO1xuICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0IgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF93ZWlnaHRzX2InKTtcbiAgICAgICAgdGhpcy5tb3JwaFBvc2l0aW9uVGV4ID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhQb3NpdGlvblRleCcpO1xuICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4ID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhOb3JtYWxUZXgnKTtcbiAgICAgICAgdGhpcy5tb3JwaFRleFBhcmFtcyA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3RleF9wYXJhbXMnKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgc29ydENvbXBhcmUoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QyICYmIGRyYXdDYWxsQi56ZGlzdDIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0MiAtIGRyYXdDYWxsQi56ZGlzdDI7IC8vIGZyb250IHRvIGJhY2tcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdIC0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZU1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgICAgIGNvbnN0IGtleUIgPSBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZURlcHRoKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGNvbnN0IGtleUEgPSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0RFUFRIXTtcbiAgICAgICAgY29uc3Qga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfREVQVEhdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdXAgdGhlIHZpZXdwb3J0IGFuZCB0aGUgc2Npc3NvciBmb3IgY2FtZXJhIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgY29udGFpbmluZyB0aGUgdmlld3BvcnRcbiAgICAgKiBpbmZvcm1hdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gW3JlbmRlclRhcmdldF0gLSBUaGVcbiAgICAgKiByZW5kZXIgdGFyZ2V0LiBOVUxMIGZvciB0aGUgZGVmYXVsdCBvbmUuXG4gICAgICovXG4gICAgc2V0dXBWaWV3cG9ydChjYW1lcmEsIHJlbmRlclRhcmdldCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnU0VUVVAtVklFV1BPUlQnKTtcblxuICAgICAgICBjb25zdCBwaXhlbFdpZHRoID0gcmVuZGVyVGFyZ2V0ID8gcmVuZGVyVGFyZ2V0LndpZHRoIDogZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBwaXhlbEhlaWdodCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IHJlY3QgPSBjYW1lcmEucmVjdDtcbiAgICAgICAgbGV0IHggPSBNYXRoLmZsb29yKHJlY3QueCAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgeSA9IE1hdGguZmxvb3IocmVjdC55ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBsZXQgdyA9IE1hdGguZmxvb3IocmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgIGxldCBoID0gTWF0aC5mbG9vcihyZWN0LncgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh4LCB5LCB3LCBoKTtcblxuICAgICAgICAvLyB1c2Ugdmlld3BvcnQgcmVjdGFuZ2xlIGJ5IGRlZmF1bHQuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpIHtcblxuICAgICAgICAvLyBmbGlwcGluZyBwcm9qIG1hdHJpeFxuICAgICAgICBjb25zdCBmbGlwWSA9IHRhcmdldD8uZmxpcFk7XG5cbiAgICAgICAgbGV0IHZpZXdDb3VudCA9IDE7XG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24pIHtcbiAgICAgICAgICAgIGxldCB0cmFuc2Zvcm07XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBjYW1lcmEuX25vZGUucGFyZW50O1xuICAgICAgICAgICAgaWYgKHBhcmVudClcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm0gPSBwYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG4gICAgICAgICAgICB2aWV3Q291bnQgPSB2aWV3cy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdDb3VudDsgdisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdJbnZPZmZNYXQubXVsMih0cmFuc2Zvcm0sIHZpZXcudmlld0ludk1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld09mZk1hdC5jb3B5KHZpZXcudmlld0ludk9mZk1hdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3SW52T2ZmTWF0LmNvcHkodmlldy52aWV3SW52TWF0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3T2ZmTWF0LmNvcHkodmlldy52aWV3TWF0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2aWV3LnZpZXdNYXQzLnNldEZyb21NYXQ0KHZpZXcudmlld09mZk1hdCk7XG4gICAgICAgICAgICAgICAgdmlldy5wcm9qVmlld09mZk1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcblxuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMF0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxMl07XG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblsxXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzEzXTtcbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzJdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTRdO1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlldy5wcm9qVmlld09mZk1hdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIFByb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICBsZXQgcHJvak1hdCA9IGNhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgICAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24ocHJvak1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHByb2pNYXRTa3lib3ggPSBjYW1lcmEuZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCgpO1xuXG4gICAgICAgICAgICAvLyBmbGlwIHByb2plY3Rpb24gbWF0cmljZXNcbiAgICAgICAgICAgIGlmIChmbGlwWSkge1xuICAgICAgICAgICAgICAgIHByb2pNYXQgPSBfdGVtcFByb2pNYXQwLm11bDIoX2ZsaXBZTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0MS5tdWwyKF9mbGlwWU1hdCwgcHJvak1hdFNreWJveCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBkZXB0aCByYW5nZSBvZiBwcm9qZWN0aW9uIG1hdHJpY2VzICgtMS4uMSB0byAwLi4xKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgcHJvak1hdCA9IF90ZW1wUHJvak1hdDIubXVsMihfZml4UHJvalJhbmdlTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0My5tdWwyKF9maXhQcm9qUmFuZ2VNYXQsIHByb2pNYXRTa3lib3gpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZShwcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUocHJvak1hdFNreWJveC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld0ludmVyc2UgTWF0cml4XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkLnNldFZhbHVlKHZpZXdNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgM3gzXG4gICAgICAgICAgICB2aWV3TWF0My5zZXRGcm9tTWF0NCh2aWV3TWF0KTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkMy5zZXRWYWx1ZSh2aWV3TWF0My5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld1Byb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKHZpZXdQcm9qTWF0LmRhdGEpO1xuXG4gICAgICAgICAgICB0aGlzLmZsaXBZSWQuc2V0VmFsdWUoZmxpcFkgPyAtMSA6IDEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IFBvc2l0aW9uICh3b3JsZCBzcGFjZSlcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hWaWV3UG9zKGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50Ym5CYXNpcy5zZXRWYWx1ZShmbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgLy8gTmVhciBhbmQgZmFyIGNsaXAgdmFsdWVzXG4gICAgICAgIGNvbnN0IG4gPSBjYW1lcmEuX25lYXJDbGlwO1xuICAgICAgICBjb25zdCBmID0gY2FtZXJhLl9mYXJDbGlwO1xuICAgICAgICB0aGlzLm5lYXJDbGlwSWQuc2V0VmFsdWUobik7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkLnNldFZhbHVlKGYpO1xuXG4gICAgICAgIC8vIGNhbWVyYSBwYXJhbXNcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMF0gPSAxIC8gZjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMV0gPSBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1syXSA9IG47XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzNdID0gY2FtZXJhLnByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID8gMSA6IDA7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zSWQuc2V0VmFsdWUodGhpcy5jYW1lcmFQYXJhbXMpO1xuXG4gICAgICAgIC8vIGV4cG9zdXJlXG4gICAgICAgIHRoaXMuZXhwb3N1cmVJZC5zZXRWYWx1ZSh0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHMgPyBjYW1lcmEuZ2V0RXhwb3N1cmUoKSA6IHRoaXMuc2NlbmUuZXhwb3N1cmUpO1xuXG4gICAgICAgIHJldHVybiB2aWV3Q291bnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgdGhlIHZpZXdwb3J0IGlzIGFscmVhZHkgc2V0IHVwLCBvbmx5IGl0cyBhcmVhIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY2FtZXJhLmpzJykuQ2FtZXJhfSBjYW1lcmEgLSBUaGUgY2FtZXJhIHN1cHBseWluZyB0aGUgdmFsdWUgdG8gY2xlYXIgdG8uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY2xlYXJDb2xvcl0gLSBUcnVlIGlmIHRoZSBjb2xvciBidWZmZXIgc2hvdWxkIGJlIGNsZWFyZWQuIFVzZXMgdGhlIHZhbHVlXG4gICAgICogZnJvbSB0aGUgY2FtcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NsZWFyRGVwdGhdIC0gVHJ1ZSBpZiB0aGUgZGVwdGggYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLiBVc2VzIHRoZSB2YWx1ZVxuICAgICAqIGZyb20gdGhlIGNhbXJhIGlmIG5vdCBzdXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjbGVhclN0ZW5jaWxdIC0gVHJ1ZSBpZiB0aGUgc3RlbmNpbCBidWZmZXIgc2hvdWxkIGJlIGNsZWFyZWQuIFVzZXMgdGhlXG4gICAgICogdmFsdWUgZnJvbSB0aGUgY2FtcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqL1xuICAgIGNsZWFyKGNhbWVyYSwgY2xlYXJDb2xvciwgY2xlYXJEZXB0aCwgY2xlYXJTdGVuY2lsKSB7XG5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSAoKGNsZWFyQ29sb3IgPz8gY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyKSA/IENMRUFSRkxBR19DT0xPUiA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAoKGNsZWFyRGVwdGggPz8gY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyKSA/IENMRUFSRkxBR19ERVBUSCA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAoKGNsZWFyU3RlbmNpbCA/PyBjYW1lcmEuX2NsZWFyU3RlbmNpbEJ1ZmZlcikgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApO1xuXG4gICAgICAgIGlmIChmbGFncykge1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnQ0xFQVInKTtcblxuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBmbGFnc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgY29sb3JXcml0ZSBpcyBzZXQgdG8gdHJ1ZSB0byBhbGwgY2hhbm5lbHMsIGlmIHlvdSB3YW50IHRvIGZ1bGx5IGNsZWFyIHRoZSB0YXJnZXRcbiAgICAvLyBUT0RPOiB0aGlzIGZ1bmN0aW9uIGlzIG9ubHkgdXNlZCBmcm9tIG91dHNpZGUgb2YgZm9yd2FyZCByZW5kZXJlciwgYW5kIHNob3VsZCBiZSBkZXByZWNhdGVkXG4gICAgLy8gd2hlbiB0aGUgZnVuY3Rpb25hbGl0eSBtb3ZlcyB0byB0aGUgcmVuZGVyIHBhc3Nlcy4gTm90ZSB0aGF0IEVkaXRvciB1c2VzIGl0IGFzIHdlbGwuXG4gICAgc2V0Q2FtZXJhKGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgcmVuZGVyQWN0aW9uID0gbnVsbCkge1xuXG4gICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpO1xuICAgICAgICB0aGlzLmNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB0aGlzIGlzIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBsaWdodG1hcHBlciBhbmQgdGhlIEVkaXRvcixcbiAgICAvLyBhbmQgd2lsbCBiZSByZW1vdmVkIHdoZW4gdGhvc2UgY2FsbCBhcmUgcmVtb3ZlZC5cbiAgICBjbGVhclZpZXcoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCBmb3JjZVdyaXRlKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXJyk7XG5cbiAgICAgICAgZGV2aWNlLnNldFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgICAgICBkZXZpY2UudXBkYXRlQmVnaW4oKTtcblxuICAgICAgICBpZiAoZm9yY2VXcml0ZSkge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBWaWV3cG9ydChjYW1lcmEsIHRhcmdldCk7XG5cbiAgICAgICAgaWYgKGNsZWFyKSB7XG5cbiAgICAgICAgICAgIC8vIHVzZSBjYW1lcmEgY2xlYXIgb3B0aW9ucyBpZiBhbnlcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBjYW1lcmEuX2NsZWFyT3B0aW9ucztcbiAgICAgICAgICAgIGRldmljZS5jbGVhcihvcHRpb25zID8gb3B0aW9ucyA6IHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIGZsYWdzOiAoY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyID8gQ0xFQVJGTEFHX0NPTE9SIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhclN0ZW5jaWxCdWZmZXIgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0Q3VsbE1vZGUoY3VsbEZhY2VzLCBmbGlwLCBkcmF3Q2FsbCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IGRyYXdDYWxsLm1hdGVyaWFsO1xuICAgICAgICBsZXQgbW9kZSA9IENVTExGQUNFX05PTkU7XG4gICAgICAgIGlmIChjdWxsRmFjZXMpIHtcbiAgICAgICAgICAgIGxldCBmbGlwRmFjZXMgPSAxO1xuXG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwuY3VsbCA9PT0gQ1VMTEZBQ0VfRlJPTlQgfHwgbWF0ZXJpYWwuY3VsbCA9PT0gQ1VMTEZBQ0VfQkFDSykge1xuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5mbGlwRmFjZXMpXG4gICAgICAgICAgICAgICAgICAgIGZsaXBGYWNlcyAqPSAtMTtcblxuICAgICAgICAgICAgICAgIGlmIChmbGlwKVxuICAgICAgICAgICAgICAgICAgICBmbGlwRmFjZXMgKj0gLTE7XG5cbiAgICAgICAgICAgICAgICBmbGlwRmFjZXMgKj0gZHJhd0NhbGwubm9kZS5uZWdhdGl2ZVNjYWxlV29ybGQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGlwRmFjZXMgPCAwKSB7XG4gICAgICAgICAgICAgICAgbW9kZSA9IG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0ZST05UID8gQ1VMTEZBQ0VfQkFDSyA6IENVTExGQUNFX0ZST05UO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRldmljZS5zZXRDdWxsTW9kZShtb2RlKTtcblxuICAgICAgICBpZiAobW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKGRyYXdDYWxsLm5vZGUubmVnYXRpdmVTY2FsZVdvcmxkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNhbWVyYUZydXN0dW0oY2FtZXJhKSB7XG5cbiAgICAgICAgaWYgKGNhbWVyYS54ciAmJiBjYW1lcmEueHIudmlld3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgZnJ1c3R1bSBiYXNlZCBvbiBYUiB2aWV3XG4gICAgICAgICAgICBjb25zdCB2aWV3ID0gY2FtZXJhLnhyLnZpZXdzWzBdO1xuICAgICAgICAgICAgdmlld1Byb2pNYXQubXVsMih2aWV3LnByb2pNYXQsIHZpZXcudmlld09mZk1hdCk7XG4gICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3UHJvak1hdCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9qTWF0ID0gY2FtZXJhLnByb2plY3Rpb25NYXRyaXg7XG4gICAgICAgIGlmIChjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbikge1xuICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24ocHJvak1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcG9zID0gY2FtZXJhLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgIHZpZXdJbnZNYXQuc2V0VFJTKHBvcywgcm90LCBWZWMzLk9ORSk7XG4gICAgICAgICAgICB0aGlzLnZpZXdJbnZJZC5zZXRWYWx1ZSh2aWV3SW52TWF0LmRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcblxuICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuICAgICAgICBjYW1lcmEuZnJ1c3R1bS5zZXRGcm9tTWF0NCh2aWV3UHJvak1hdCk7XG4gICAgfVxuXG4gICAgc2V0QmFzZUNvbnN0YW50cyhkZXZpY2UsIG1hdGVyaWFsKSB7XG5cbiAgICAgICAgLy8gQ3VsbCBtb2RlXG4gICAgICAgIGRldmljZS5zZXRDdWxsTW9kZShtYXRlcmlhbC5jdWxsKTtcblxuICAgICAgICAvLyBBbHBoYSB0ZXN0XG4gICAgICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwKSB7XG4gICAgICAgICAgICB0aGlzLm9wYWNpdHlNYXBJZC5zZXRWYWx1ZShtYXRlcmlhbC5vcGFjaXR5TWFwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0ZXJpYWwub3BhY2l0eU1hcCB8fCBtYXRlcmlhbC5hbHBoYVRlc3QgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmFscGhhVGVzdElkLnNldFZhbHVlKG1hdGVyaWFsLmFscGhhVGVzdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVDcHVTa2luTWF0cmljZXMoZHJhd0NhbGxzKSB7XG5cbiAgICAgICAgX3NraW5VcGRhdGVJbmRleCsrO1xuXG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgaWYgKGRyYXdDYWxsc0NvdW50ID09PSAwKSByZXR1cm47XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNpID0gZHJhd0NhbGxzW2ldLnNraW5JbnN0YW5jZTtcbiAgICAgICAgICAgIGlmIChzaSkge1xuICAgICAgICAgICAgICAgIHNpLnVwZGF0ZU1hdHJpY2VzKGRyYXdDYWxsc1tpXS5ub2RlLCBfc2tpblVwZGF0ZUluZGV4KTtcbiAgICAgICAgICAgICAgICBzaS5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9za2luVGltZSArPSBub3coKSAtIHNraW5UaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICB1cGRhdGVHcHVTa2luTWF0cmljZXMoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc2tpblRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgY291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBza2luID0gZHJhd0NhbGwuc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgICAgIGlmIChza2luICYmIHNraW4uX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHNraW4udXBkYXRlTWF0cml4UGFsZXR0ZShkcmF3Q2FsbC5ub2RlLCBfc2tpblVwZGF0ZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgc2tpbi5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscykge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IG1vcnBoVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBjb25zdCBtb3JwaEluc3QgPSBkcmF3Q2FsbC5tb3JwaEluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdCAmJiBtb3JwaEluc3QuX2RpcnR5ICYmIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgICAgICBtb3JwaEluc3QudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9tb3JwaFRpbWUgKz0gbm93KCkgLSBtb3JwaFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGdwdVVwZGF0ZShkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gc2tpcCBldmVyeXRoaW5nIHdpdGggdmlzaWJsZVRoaXNGcmFtZSA9PT0gZmFsc2VcbiAgICAgICAgdGhpcy51cGRhdGVHcHVTa2luTWF0cmljZXMoZHJhd0NhbGxzKTtcbiAgICAgICAgdGhpcy51cGRhdGVNb3JwaGluZyhkcmF3Q2FsbHMpO1xuICAgIH1cblxuICAgIHNldFZlcnRleEJ1ZmZlcnMoZGV2aWNlLCBtZXNoKSB7XG5cbiAgICAgICAgLy8gbWFpbiB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobWVzaC52ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHNldE1vcnBoaW5nKGRldmljZSwgbW9ycGhJbnN0YW5jZSkge1xuXG4gICAgICAgIGlmIChtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgIGlmIChtb3JwaEluc3RhbmNlLm1vcnBoLnVzZVRleHR1cmVNb3JwaCkge1xuXG4gICAgICAgICAgICAgICAgLy8gdmVydGV4IGJ1ZmZlciB3aXRoIHZlcnRleCBpZHNcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VmVydGV4QnVmZmVyKG1vcnBoSW5zdGFuY2UubW9ycGgudmVydGV4QnVmZmVySWRzKTtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFBvc2l0aW9uVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZVBvc2l0aW9ucyk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaE5vcm1hbFRleC5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLnRleHR1cmVOb3JtYWxzKTtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFRleFBhcmFtcy5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl90ZXh0dXJlUGFyYW1zKTtcblxuICAgICAgICAgICAgfSBlbHNlIHsgICAgLy8gdmVydGV4IGF0dHJpYnV0ZXMgYmFzZWQgbW9ycGhpbmdcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IHQgPSAwOyB0IDwgbW9ycGhJbnN0YW5jZS5fYWN0aXZlVmVydGV4QnVmZmVycy5sZW5ndGg7IHQrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZiID0gbW9ycGhJbnN0YW5jZS5fYWN0aXZlVmVydGV4QnVmZmVyc1t0XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhdGNoIHNlbWFudGljIGZvciB0aGUgYnVmZmVyIHRvIGN1cnJlbnQgQVRUUiBzbG90ICh1c2luZyBBVFRSOCAtIEFUVFIxNSByYW5nZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gU0VNQU5USUNfQVRUUiArICh0ICsgOCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0ubmFtZSA9IHNlbWFudGljO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmIuZm9ybWF0LmVsZW1lbnRzWzBdLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShzZW1hbnRpYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIodmIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IGFsbCA4IHdlaWdodHNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Euc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb3JwaFdlaWdodHNCLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3NoYWRlck1vcnBoV2VpZ2h0c0IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2tpbm5pbmcoZGV2aWNlLCBtZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5EcmF3Q2FsbHMrKztcbiAgICAgICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib25lVGV4dHVyZSA9IG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UuYm9uZVRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZUlkLnNldFZhbHVlKGJvbmVUZXh0dXJlKTtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMF0gPSBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMV0gPSBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzJdID0gMS4wIC8gYm9uZVRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgYm9uZVRleHR1cmVTaXplWzNdID0gMS4wIC8gYm9uZVRleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgIHRoaXMuYm9uZVRleHR1cmVTaXplSWQuc2V0VmFsdWUoYm9uZVRleHR1cmVTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NlTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5tYXRyaXhQYWxldHRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldHMgVmVjMyBjYW1lcmEgcG9zaXRpb24gdW5pZm9ybVxuICAgIGRpc3BhdGNoVmlld1Bvcyhwb3NpdGlvbikge1xuICAgICAgICBjb25zdCB2cCA9IHRoaXMudmlld1BvczsgICAgLy8gbm90ZSB0aGF0IHRoaXMgcmV1c2VzIGFuIGFycmF5XG4gICAgICAgIHZwWzBdID0gcG9zaXRpb24ueDtcbiAgICAgICAgdnBbMV0gPSBwb3NpdGlvbi55O1xuICAgICAgICB2cFsyXSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkLnNldFZhbHVlKHZwKTtcbiAgICB9XG5cbiAgICBpbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpIHtcblxuICAgICAgICBpZiAodGhpcy5kZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycyAmJiAhdGhpcy52aWV3VW5pZm9ybUZvcm1hdCkge1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdCh0aGlzLmRldmljZSwgW1xuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwibWF0cml4X3ZpZXdQcm9qZWN0aW9uXCIsIFVOSUZPUk1UWVBFX01BVDQpXG4gICAgICAgICAgICBdKTtcblxuICAgICAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSB2aWV3IGJpbmQgZ3JvdXAgLSBjb250YWlucyBzaW5nbGUgdW5pZm9ybSBidWZmZXIsIGFuZCBzb21lIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXSwgW1xuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnbGlnaHRzVGV4dHVyZUZsb2F0JywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUKSxcbiAgICAgICAgICAgICAgICBuZXcgQmluZFRleHR1cmVGb3JtYXQoJ2xpZ2h0c1RleHR1cmU4JywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUKVxuICAgICAgICAgICAgXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyh2aWV3QmluZEdyb3Vwcywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZpZXdDb3VudCkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChBcnJheS5pc0FycmF5KHZpZXdCaW5kR3JvdXBzKSwgXCJ2aWV3QmluZEdyb3VwcyBtdXN0IGJlIGFuIGFycmF5XCIpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodmlld0NvdW50ID09PSAxLCBcIlRoaXMgY29kZSBkb2VzIG5vdCBoYW5kbGUgdGhlIHZpZXdDb3VudCB5ZXRcIik7XG5cbiAgICAgICAgd2hpbGUgKHZpZXdCaW5kR3JvdXBzLmxlbmd0aCA8IHZpZXdDb3VudCkge1xuICAgICAgICAgICAgY29uc3QgdWIgPSBuZXcgVW5pZm9ybUJ1ZmZlcihkZXZpY2UsIHZpZXdVbmlmb3JtRm9ybWF0KTtcbiAgICAgICAgICAgIGNvbnN0IGJnID0gbmV3IEJpbmRHcm91cChkZXZpY2UsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHViKTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUoYmcsIGBWaWV3QmluZEdyb3VwXyR7YmcuaWR9YCk7XG4gICAgICAgICAgICB2aWV3QmluZEdyb3Vwcy5wdXNoKGJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB2aWV3IGJpbmQgZ3JvdXAgLyB1bmlmb3Jtc1xuICAgICAgICBjb25zdCB2aWV3QmluZEdyb3VwID0gdmlld0JpbmRHcm91cHNbMF07XG4gICAgICAgIHZpZXdCaW5kR3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXIudXBkYXRlKCk7XG4gICAgICAgIHZpZXdCaW5kR3JvdXAudXBkYXRlKCk7XG5cbiAgICAgICAgLy8gVE9ETzsgdGhpcyBuZWVkcyB0byBiZSBtb3ZlZCB0byBkcmF3SW5zdGFuY2UgZnVuY3Rpb25zIHRvIGhhbmRsZSBYUlxuICAgICAgICBkZXZpY2Uuc2V0QmluZEdyb3VwKEJJTkRHUk9VUF9WSUVXLCB2aWV3QmluZEdyb3VwKTtcbiAgICB9XG5cbiAgICBzZXR1cE1lc2hVbmlmb3JtQnVmZmVycyhtZXNoSW5zdGFuY2UsIHBhc3MpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzKSB7XG5cbiAgICAgICAgICAgIC8vIFRPRE86IG1vZGVsIG1hdHJpeCBzZXR1cCBpcyBwYXJ0IG9mIHRoZSBkcmF3SW5zdGFuY2UgY2FsbCwgYnV0IHdpdGggdW5pZm9ybSBidWZmZXIgaXQncyBuZWVkZWRcbiAgICAgICAgICAgIC8vIGVhcmxpZXIgaGVyZS4gVGhpcyBuZWVkcyB0byBiZSByZWZhY3RvcmVkIGZvciBtdWx0aS12aWV3IGFueXdheXMuXG4gICAgICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm0uZGF0YSk7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLm5vcm1hbE1hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG1lc2ggYmluZCBncm91cCAvIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwID0gbWVzaEluc3RhbmNlLmdldEJpbmRHcm91cChkZXZpY2UsIHBhc3MpO1xuICAgICAgICAgICAgbWVzaEJpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAudXBkYXRlKCk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0QmluZEdyb3VwKEJJTkRHUk9VUF9NRVNILCBtZXNoQmluZEdyb3VwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRyYXdJbnN0YW5jZShkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUsIG5vcm1hbCkge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIG1lc2hJbnN0YW5jZS5ub2RlLm5hbWUpO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNpbmdEYXRhID0gbWVzaEluc3RhbmNlLmluc3RhbmNpbmdEYXRhO1xuICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEpIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YS5jb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YW5jZWREcmF3Q2FsbHMrKztcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VmVydGV4QnVmZmVyKGluc3RhbmNpbmdEYXRhLnZlcnRleEJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBtb2RlbE1hdHJpeCA9IG1lc2hJbnN0YW5jZS5ub2RlLndvcmxkVHJhbnNmb3JtO1xuICAgICAgICAgICAgdGhpcy5tb2RlbE1hdHJpeElkLnNldFZhbHVlKG1vZGVsTWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICBpZiAobm9ybWFsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uubm9kZS5ub3JtYWxNYXRyaXguZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIC8vIHVzZWQgZm9yIHN0ZXJlb1xuICAgIGRyYXdJbnN0YW5jZTIoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgbWVzaEluc3RhbmNlLm5vZGUubmFtZSk7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2luZ0RhdGEgPSBtZXNoSW5zdGFuY2UuaW5zdGFuY2luZ0RhdGE7XG4gICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YSkge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgaW5zdGFuY2luZ0RhdGEuY291bnQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbWF0cmljZXMgYXJlIGFscmVhZHkgc2V0XG4gICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgIH1cblxuICAgIGN1bGwoY2FtZXJhLCBkcmF3Q2FsbHMsIHZpc2libGVMaXN0KSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgY3VsbFRpbWUgPSBub3coKTtcbiAgICAgICAgbGV0IG51bURyYXdDYWxsc0N1bGxlZCA9IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGxldCB2aXNpYmxlTGVuZ3RoID0gMDtcbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuXG4gICAgICAgIGNvbnN0IGN1bGxpbmdNYXNrID0gY2FtZXJhLmN1bGxpbmdNYXNrIHx8IDB4RkZGRkZGRkY7IC8vIGlmIG1pc3NpbmcgYXNzdW1lIGNhbWVyYSdzIGRlZmF1bHQgdmFsdWVcblxuICAgICAgICBpZiAoIWNhbWVyYS5mcnVzdHVtQ3VsbGluZykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gbmVlZCB0byBjb3B5IGFycmF5IGFueXdheSBiZWNhdXNlIHNvcnRpbmcgd2lsbCBoYXBwZW4gYW5kIGl0J2xsIGJyZWFrIG9yaWdpbmFsIGRyYXcgY2FsbCBvcmRlciBhc3N1bXB0aW9uXG4gICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC52aXNpYmxlICYmICFkcmF3Q2FsbC5jb21tYW5kKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBvYmplY3QncyBtYXNrIEFORCB0aGUgY2FtZXJhJ3MgY3VsbGluZ01hc2sgaXMgemVybyB0aGVuIHRoZSBnYW1lIG9iamVjdCB3aWxsIGJlIGludmlzaWJsZSBmcm9tIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwubWFzayAmJiAoZHJhd0NhbGwubWFzayAmIGN1bGxpbmdNYXNrKSA9PT0gMCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2aXNpYmxlTGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgIGlmICghZHJhd0NhbGwuY29tbWFuZCkge1xuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwudmlzaWJsZSkgY29udGludWU7IC8vIHVzZSB2aXNpYmxlIHByb3BlcnR5IHRvIHF1aWNrbHkgaGlkZS9zaG93IG1lc2hJbnN0YW5jZXNcbiAgICAgICAgICAgICAgICBsZXQgdmlzaWJsZSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgb2JqZWN0J3MgbWFzayBBTkQgdGhlIGNhbWVyYSdzIGN1bGxpbmdNYXNrIGlzIHplcm8gdGhlbiB0aGUgZ2FtZSBvYmplY3Qgd2lsbCBiZSBpbnZpc2libGUgZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLm1hc2sgJiYgKGRyYXdDYWxsLm1hc2sgJiBjdWxsaW5nTWFzaykgPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZSA9IGRyYXdDYWxsLl9pc1Zpc2libGUoY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgICAgICBudW1EcmF3Q2FsbHNDdWxsZWQrKztcbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHZpc2libGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZUxlbmd0aCsrO1xuICAgICAgICAgICAgICAgICAgICBkcmF3Q2FsbC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxlbmd0aCsrO1xuICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9jdWxsVGltZSArPSBub3coKSAtIGN1bGxUaW1lO1xuICAgICAgICB0aGlzLl9udW1EcmF3Q2FsbHNDdWxsZWQgKz0gbnVtRHJhd0NhbGxzQ3VsbGVkO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICByZXR1cm4gdmlzaWJsZUxlbmd0aDtcbiAgICB9XG5cbiAgICBjdWxsTGlnaHRzKGNhbWVyYSwgbGlnaHRzKSB7XG5cbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIGNvbnN0IHBoeXNpY2FsVW5pdHMgPSB0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcblxuICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCBsaWdodHMgYXJlIG1hcmtlZCB2aXNpYmxlIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWVcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC5nZXRCb3VuZGluZ1NwaGVyZSh0ZW1wU3BoZXJlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5mcnVzdHVtLmNvbnRhaW5zU3BoZXJlKHRlbXBTcGhlcmUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnVzZVBoeXNpY2FsVW5pdHMgPSBwaHlzaWNhbFVuaXRzO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXhpbXVtIHNjcmVlbiBhcmVhIHRha2VuIGJ5IHRoZSBsaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NyZWVuU2l6ZSA9IGNhbWVyYS5nZXRTY3JlZW5TaXplKHRlbXBTcGhlcmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQubWF4U2NyZWVuU2l6ZSA9IE1hdGgubWF4KGxpZ2h0Lm1heFNjcmVlblNpemUsIHNjcmVlblNpemUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgc2hhZG93IGNhc3RpbmcgbGlnaHQgZG9lcyBub3QgaGF2ZSBzaGFkb3cgbWFwIGFsbG9jYXRlZCwgbWFyayBpdCB2aXNpYmxlIHRvIGFsbG9jYXRlIHNoYWRvdyBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vdGU6IFRoaXMgd29uJ3QgYmUgbmVlZGVkIHdoZW4gY2x1c3RlcmVkIHNoYWRvd3MgYXJlIHVzZWQsIGJ1dCBhdCB0aGUgbW9tZW50IGV2ZW4gY3VsbGVkIG91dCBsaWdodHNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFyZSB1c2VkIGZvciByZW5kZXJpbmcsIGFuZCBuZWVkIHNoYWRvdyBtYXAgdG8gYmUgYWxsb2NhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBkZWxldGUgdGhpcyBjb2RlIHdoZW4gY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIGlzIGJlaW5nIHJlbW92ZWQgYW5kIGlzIG9uIGJ5IGRlZmF1bHQuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhbGlnaHQuc2hhZG93TWFwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LnVzZVBoeXNpY2FsVW5pdHMgPSB0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2hhZG93IG1hcCBjdWxsaW5nIGZvciBkaXJlY3Rpb25hbCBhbmQgdmlzaWJsZSBsb2NhbCBsaWdodHNcbiAgICAgKiB2aXNpYmxlIG1lc2hJbnN0YW5jZXMgYXJlIGNvbGxlY3RlZCBpbnRvIGxpZ2h0Ll9yZW5kZXJEYXRhLCBhbmQgYXJlIG1hcmtlZCBhcyB2aXNpYmxlXG4gICAgICogZm9yIGRpcmVjdGlvbmFsIGxpZ2h0cyBhbHNvIHNoYWRvdyBjYW1lcmEgbWF0cml4IGlzIHNldCB1cFxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGN1bGxTaGFkb3dtYXBzKGNvbXApIHtcblxuICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGxvY2FsIChwb2ludCBhbmQgc3BvdCkgbGlnaHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcC5fbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGNvbXAuX2xpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgYXRsYXMgc2xvdCBpcyByZWFzc2lnbmVkLCBtYWtlIHN1cmUgdG8gdXBkYXRlIHRoZSBzaGFkb3cgbWFwLCBpbmNsdWRpbmcgdGhlIGN1bGxpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmF0bGFzU2xvdFVwZGF0ZWQgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgJiYgbGlnaHQuY2FzdFNoYWRvd3MgJiYgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FzdGVycyA9IGNvbXAuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2ldLnNoYWRvd0Nhc3RlcnNMaXN0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsLmN1bGwobGlnaHQsIGNhc3RlcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNoYWRvdyBjYXN0ZXJzIGN1bGxpbmcgZm9yIGdsb2JhbCAoZGlyZWN0aW9uYWwpIGxpZ2h0c1xuICAgICAgICAvLyByZW5kZXIgYWN0aW9ucyBzdG9yZSB3aGljaCBkaXJlY3Rpb25hbCBsaWdodHMgYXJlIG5lZWRlZCBmb3IgZWFjaCBjYW1lcmEsIHNvIHRoZXNlIGFyZSBnZXR0aW5nIGN1bGxlZFxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgY291bnQgPSByZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSByZW5kZXJBY3Rpb24uZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzW2pdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gY29tcC5fbGlnaHRzW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhc3RlcnMgPSBjb21wLl9saWdodENvbXBvc2l0aW9uRGF0YVtsaWdodEluZGV4XS5zaGFkb3dDYXN0ZXJzTGlzdDtcbiAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsLmN1bGwobGlnaHQsIGNhc3RlcnMsIHJlbmRlckFjdGlvbi5jYW1lcmEuY2FtZXJhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHZpc2liaWxpdHkgY3VsbGluZyBvZiBsaWdodHMsIG1lc2hJbnN0YW5jZXMsIHNoYWRvd3MgY2FzdGVyc1xuICAgICAqIEFsc28gYXBwbGllcyBtZXNoSW5zdGFuY2UudmlzaWJsZSBhbmQgY2FtZXJhLmN1bGxpbmdNYXNrXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbENvbXBvc2l0aW9uKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMnKS5SZW5kZXJBY3Rpb259ICovXG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuXG4gICAgICAgICAgICAvLyBsYXllclxuICAgICAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJlbmRlckFjdGlvbi5sYXllckluZGV4O1xuICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9ICovXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFsYXllci5lbmFibGVkIHx8ICFjb21wLnN1YkxheWVyRW5hYmxlZFtsYXllckluZGV4XSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBjYW1lcmFcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVBhc3MgPSByZW5kZXJBY3Rpb24uY2FtZXJhSW5kZXg7XG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgIGlmIChjYW1lcmEpIHtcblxuICAgICAgICAgICAgICAgIGNhbWVyYS5mcmFtZVVwZGF0ZShyZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0KTtcblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBjYW1lcmEgYW5kIGZydXN0dW0gb25jZVxuICAgICAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb24uZmlyc3RDYW1lcmFVc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVDYW1lcmFGcnVzdHVtKGNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW1lcmFzUmVuZGVyZWQrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjdWxsIGVhY2ggbGF5ZXIncyBub24tZGlyZWN0aW9uYWwgbGlnaHRzIG9uY2Ugd2l0aCBlYWNoIGNhbWVyYVxuICAgICAgICAgICAgICAgIC8vIGxpZ2h0cyBhcmVuJ3QgY29sbGVjdGVkIGFueXdoZXJlLCBidXQgbWFya2VkIGFzIHZpc2libGVcbiAgICAgICAgICAgICAgICB0aGlzLmN1bGxMaWdodHMoY2FtZXJhLmNhbWVyYSwgbGF5ZXIuX2xpZ2h0cyk7XG5cbiAgICAgICAgICAgICAgICAvLyBjdWxsIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgY29uc3Qgb2JqZWN0cyA9IGxheWVyLmluc3RhbmNlcztcblxuICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgdGhlbSBpbnRvIGxheWVyIGFycmF5c1xuICAgICAgICAgICAgICAgIGNvbnN0IHZpc2libGUgPSB0cmFuc3BhcmVudCA/IG9iamVjdHMudmlzaWJsZVRyYW5zcGFyZW50W2NhbWVyYVBhc3NdIDogb2JqZWN0cy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAgICAgLy8gc2hhcmVkIG9iamVjdHMgYXJlIG9ubHkgY3VsbGVkIG9uY2VcbiAgICAgICAgICAgICAgICBpZiAoIXZpc2libGUuZG9uZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5vblByZUN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUHJlQ3VsbChjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IHRyYW5zcGFyZW50ID8gbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIDogbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5sZW5ndGggPSB0aGlzLmN1bGwoY2FtZXJhLmNhbWVyYSwgZHJhd0NhbGxzLCB2aXNpYmxlLmxpc3QpO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5vblBvc3RDdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5vblBvc3RDdWxsKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHNoYWRvdyAvIGNvb2tpZSBhdGxhcyBhbGxvY2F0aW9uIGZvciB0aGUgdmlzaWJsZSBsaWdodHMuIFVwZGF0ZSBpdCBhZnRlciB0aGUgbGlndGh0cyB3ZXJlIGN1bGxlZCxcbiAgICAgICAgLy8gYnV0IGJlZm9yZSBzaGFkb3cgbWFwcyB3ZXJlIGN1bGxpbmcsIGFzIGl0IG1pZ2h0IGZvcmNlIHNvbWUgJ3VwZGF0ZSBvbmNlJyBzaGFkb3dzIHRvIGN1bGwuXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVMaWdodFRleHR1cmVBdGxhcyhjb21wKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGN1bGwgc2hhZG93IGNhc3RlcnMgZm9yIGFsbCBsaWdodHNcbiAgICAgICAgdGhpcy5jdWxsU2hhZG93bWFwcyhjb21wKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2N1bGxUaW1lICs9IG5vdygpIC0gY3VsbFRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IGRyYXdDYWxscyAtIE1lc2ggaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb25seUxpdFNoYWRlcnMgLSBMaW1pdHMgdGhlIHVwZGF0ZSB0byBzaGFkZXJzIGFmZmVjdGVkIGJ5IGxpZ2h0aW5nLlxuICAgICAqL1xuICAgIHVwZGF0ZVNoYWRlcnMoZHJhd0NhbGxzLCBvbmx5TGl0U2hhZGVycykge1xuICAgICAgICBjb25zdCBjb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWF0ID0gZHJhd0NhbGxzW2ldLm1hdGVyaWFsO1xuICAgICAgICAgICAgaWYgKG1hdCkge1xuICAgICAgICAgICAgICAgIC8vIG1hdGVyaWFsIG5vdCBwcm9jZXNzZWQgeWV0XG4gICAgICAgICAgICAgICAgaWYgKCFfdGVtcFNldC5oYXMobWF0KSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcFNldC5hZGQobWF0KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBza2lwIHRoaXMgZm9yIG1hdGVyaWFscyBub3QgdXNpbmcgdmFyaWFudHNcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdC5nZXRTaGFkZXJWYXJpYW50ICE9PSBNYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyVmFyaWFudCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob25seUxpdFNoYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBza2lwIG1hdGVyaWFscyBub3QgdXNpbmcgbGlnaHRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW1hdC51c2VMaWdodGluZyB8fCAobWF0LmVtaXR0ZXIgJiYgIW1hdC5lbWl0dGVyLmxpZ2h0aW5nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNsZWFyIHNoYWRlciB2YXJpYW50cyBvbiB0aGUgbWF0ZXJpYWwgYW5kIGFsc28gb24gbWVzaCBpbnN0YW5jZXMgdGhhdCB1c2UgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdC5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBrZWVwIHRlbXAgc2V0IGVtcHR5XG4gICAgICAgIF90ZW1wU2V0LmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcmVuZGVyQ29va2llcyhsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBjb29raWVSZW5kZXJUYXJnZXQgPSB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmNvb2tpZVJlbmRlclRhcmdldDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAvLyBza2lwIGNsdXN0ZXJlZCBjb29raWVzIHdpdGggbm8gYXNzaWduZWQgYXRsYXMgc2xvdFxuICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAvLyBvbmx5IHJlbmRlciBjb29raWUgd2hlbiB0aGUgc2xvdCBpcyByZWFzc2lnbmVkIChhc3N1bWluZyB0aGUgY29va2llIHRleHR1cmUgaXMgc3RhdGljKVxuICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1Nsb3RVcGRhdGVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5yZW5kZXIobGlnaHQsIGNvb2tpZVJlbmRlclRhcmdldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbGlnaHRzQ2hhbmdlZCAtIFRydWUgaWYgbGlnaHRzIG9mIHRoZSBjb21wb3NpdGlvbiBoYXMgY2hhbmdlZC5cbiAgICAgKi9cbiAgICBiZWdpbkZyYW1lKGNvbXAsIGxpZ2h0c0NoYW5nZWQpIHtcbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGNvbXAuX21lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgLy8gVXBkYXRlIHNoYWRlcnMgaWYgbmVlZGVkXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgaWYgKHNjZW5lLnVwZGF0ZVNoYWRlcnMgfHwgbGlnaHRzQ2hhbmdlZCkge1xuICAgICAgICAgICAgY29uc3Qgb25seUxpdFNoYWRlcnMgPSAhc2NlbmUudXBkYXRlU2hhZGVycyAmJiBsaWdodHNDaGFuZ2VkO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzKG1lc2hJbnN0YW5jZXMsIG9ubHlMaXRTaGFkZXJzKTtcbiAgICAgICAgICAgIHNjZW5lLnVwZGF0ZVNoYWRlcnMgPSBmYWxzZTtcbiAgICAgICAgICAgIHNjZW5lLl9zaGFkZXJWZXJzaW9uKys7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgYWxsIHNraW4gbWF0cmljZXMgdG8gcHJvcGVybHkgY3VsbCBza2lubmVkIG9iamVjdHMgKGJ1dCBkb24ndCB1cGRhdGUgcmVuZGVyaW5nIGRhdGEgeWV0KVxuICAgICAgICB0aGlzLnVwZGF0ZUNwdVNraW5NYXRyaWNlcyhtZXNoSW5zdGFuY2VzKTtcblxuICAgICAgICAvLyBjbGVhciBtZXNoIGluc3RhbmNlIHZpc2liaWxpdHlcbiAgICAgICAgY29uc3QgbWlDb3VudCA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlVGhpc0ZyYW1lID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBsaWdodCB2aXNpYmlsaXR5XG4gICAgICAgIGNvbnN0IGxpZ2h0cyA9IGNvbXAuX2xpZ2h0cztcbiAgICAgICAgY29uc3QgbGlnaHRDb3VudCA9IGxpZ2h0cy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBsaWdodHNbaV0uYmVnaW5GcmFtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzKGNvbXApIHtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcy51cGRhdGUoY29tcC5fc3BsaXRMaWdodHNbTElHSFRUWVBFX1NQT1RdLCBjb21wLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0sIHRoaXMuc2NlbmUubGlnaHRpbmcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICB1cGRhdGVDbHVzdGVycyhjb21wKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgZW1wdHlXb3JsZENsdXN0ZXJzID0gY29tcC5nZXRFbXB0eVdvcmxkQ2x1c3RlcnModGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBjbHVzdGVyID0gcmVuZGVyQWN0aW9uLmxpZ2h0Q2x1c3RlcnM7XG5cbiAgICAgICAgICAgIGlmIChjbHVzdGVyICYmIGNsdXN0ZXIgIT09IGVtcHR5V29ybGRDbHVzdGVycykge1xuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGVhY2ggY2x1c3RlciBvbmx5IG9uZSB0aW1lXG4gICAgICAgICAgICAgICAgaWYgKCFfdGVtcFNldC5oYXMoY2x1c3RlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBTZXQuYWRkKGNsdXN0ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbcmVuZGVyQWN0aW9uLmxheWVySW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyLnVwZGF0ZShsYXllci5jbHVzdGVyZWRMaWdodHNTZXQsIHRoaXMuc2NlbmUuZ2FtbWFDb3JyZWN0aW9uLCB0aGlzLnNjZW5lLmxpZ2h0aW5nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBrZWVwIHRlbXAgc2V0IGVtcHR5XG4gICAgICAgIF90ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzVGltZSArPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVycyA9IGNvbXAuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSBsYXllciBjb21wb3NpdGlvbiBmb3IgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uIHRvIHVwZGF0ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAtIFRydWUgaWYgY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIGVuYWJsZWQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gLSBGbGFncyBvZiB3aGF0IHdhcyB1cGRhdGVkXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUxheWVyQ29tcG9zaXRpb24oY29tcCwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBsZW4gPSBjb21wLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbXAubGF5ZXJMaXN0W2ldLl9wb3N0UmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IHNoYWRlclZlcnNpb24gPSBzY2VuZS5fc2hhZGVyVmVyc2lvbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgIGxheWVyLl9zaGFkZXJWZXJzaW9uID0gc2hhZGVyVmVyc2lvbjtcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGxheWVyLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgICAgICBsYXllci5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgICAgICBsYXllci5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9yZW5kZXJUaW1lID0gMDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBsYXllci5fcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyA9IDA7XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNhbGxlZEZvckNhbWVyYXMgPSAwO1xuICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSBjb21wLnN1YkxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgIGlmICh0cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciB8PSAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgfD0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlck1heCA9IGxheWVyLl9wb3N0UmVuZGVyQ291bnRlcjtcblxuICAgICAgICAgICAgLy8gcHJlcGFyZSBsYXllciBmb3IgY3VsbGluZyB3aXRoIHRoZSBjYW1lcmFcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuY2FtZXJhcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGxheWVyLmluc3RhbmNlcy5wcmVwYXJlKGopO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSBzdGF0aWMgbGlnaHRpbmcgZm9yIG1lc2hlcyBpbiB0aGlzIGxheWVyIGlmIG5lZWRlZFxuICAgICAgICAgICAgLy8gTm90ZTogU3RhdGljIGxpZ2h0aW5nIGlzIG5vdCB1c2VkIHdoZW4gY2x1c3RlcmVkIGxpZ2h0aW5nIGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmIChsYXllci5fbmVlZHNTdGF0aWNQcmVwYXJlICYmIGxheWVyLl9zdGF0aWNMaWdodEhhc2ggJiYgIXRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogcmV1c2Ugd2l0aCB0aGUgc2FtZSBzdGF0aWNMaWdodEhhc2hcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX3N0YXRpY1ByZXBhcmVEb25lKSB7XG4gICAgICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5yZXZlcnQobGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5yZXZlcnQobGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnByZXBhcmUodGhpcy5kZXZpY2UsIHNjZW5lLCBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzLCBsYXllci5fbGlnaHRzKTtcbiAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucHJlcGFyZSh0aGlzLmRldmljZSwgc2NlbmUsIGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcywgbGF5ZXIuX2xpZ2h0cyk7XG4gICAgICAgICAgICAgICAgY29tcC5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNjZW5lLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGxheWVyLl9uZWVkc1N0YXRpY1ByZXBhcmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBsYXllci5fc3RhdGljUHJlcGFyZURvbmUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHN0YXRpYyBsYXllciBkYXRhLCBpZiBzb21ldGhpbmcncyBjaGFuZ2VkXG4gICAgICAgIGNvbnN0IHVwZGF0ZWQgPSBjb21wLl91cGRhdGUodGhpcy5kZXZpY2UsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSArPSBub3coKSAtIGxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICByZXR1cm4gdXBkYXRlZDtcbiAgICB9XG5cbiAgICBmcmFtZVVwZGF0ZSgpIHtcblxuICAgICAgICB0aGlzLmNsdXN0ZXJzRGVidWdSZW5kZXJlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsiX3NraW5VcGRhdGVJbmRleCIsImJvbmVUZXh0dXJlU2l6ZSIsInZpZXdQcm9qTWF0IiwiTWF0NCIsInZpZXdJbnZNYXQiLCJ2aWV3TWF0Iiwidmlld01hdDMiLCJNYXQzIiwidGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiX2ZsaXBZTWF0Iiwic2V0U2NhbGUiLCJfZml4UHJvalJhbmdlTWF0Iiwic2V0IiwiX3RlbXBQcm9qTWF0MCIsIl90ZW1wUHJvak1hdDEiLCJfdGVtcFByb2pNYXQyIiwiX3RlbXBQcm9qTWF0MyIsIl90ZW1wU2V0IiwiU2V0IiwiUmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkIiwiZGV2aWNlIiwic2NlbmUiLCJsaWdodFRleHR1cmVBdGxhcyIsIkxpZ2h0VGV4dHVyZUF0bGFzIiwic2hhZG93TWFwQ2FjaGUiLCJTaGFkb3dNYXBDYWNoZSIsInNoYWRvd1JlbmRlcmVyIiwiU2hhZG93UmVuZGVyZXIiLCJfc2hhZG93UmVuZGVyZXJMb2NhbCIsIlNoYWRvd1JlbmRlcmVyTG9jYWwiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIlNoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJfY29va2llUmVuZGVyZXIiLCJDb29raWVSZW5kZXJlciIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsIl9za2luVGltZSIsIl9tb3JwaFRpbWUiLCJfY3VsbFRpbWUiLCJfc2hhZG93TWFwVGltZSIsIl9saWdodENsdXN0ZXJzVGltZSIsIl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2tpbkRyYXdDYWxscyIsIl9pbnN0YW5jZWREcmF3Q2FsbHMiLCJfc2hhZG93TWFwVXBkYXRlcyIsIl9udW1EcmF3Q2FsbHNDdWxsZWQiLCJfY2FtZXJhc1JlbmRlcmVkIiwiX2xpZ2h0Q2x1c3RlcnMiLCJzY29wZSIsImJvbmVUZXh0dXJlSWQiLCJyZXNvbHZlIiwiYm9uZVRleHR1cmVTaXplSWQiLCJwb3NlTWF0cml4SWQiLCJtb2RlbE1hdHJpeElkIiwibm9ybWFsTWF0cml4SWQiLCJ2aWV3SW52SWQiLCJ2aWV3UG9zIiwiRmxvYXQzMkFycmF5Iiwidmlld1Bvc0lkIiwicHJvaklkIiwicHJvalNreWJveElkIiwidmlld0lkIiwidmlld0lkMyIsInZpZXdQcm9qSWQiLCJmbGlwWUlkIiwidGJuQmFzaXMiLCJuZWFyQ2xpcElkIiwiZmFyQ2xpcElkIiwiY2FtZXJhUGFyYW1zIiwiY2FtZXJhUGFyYW1zSWQiLCJhbHBoYVRlc3RJZCIsIm9wYWNpdHlNYXBJZCIsImV4cG9zdXJlSWQiLCJ0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZCIsInNldFZhbHVlIiwibW9ycGhXZWlnaHRzQSIsIm1vcnBoV2VpZ2h0c0IiLCJtb3JwaFBvc2l0aW9uVGV4IiwibW9ycGhOb3JtYWxUZXgiLCJtb3JwaFRleFBhcmFtcyIsImRlc3Ryb3kiLCJzb3J0Q29tcGFyZSIsImRyYXdDYWxsQSIsImRyYXdDYWxsQiIsImxheWVyIiwiZHJhd09yZGVyIiwiemRpc3QiLCJ6ZGlzdDIiLCJfa2V5IiwiU09SVEtFWV9GT1JXQVJEIiwic29ydENvbXBhcmVNZXNoIiwia2V5QSIsImtleUIiLCJtZXNoIiwiaWQiLCJzb3J0Q29tcGFyZURlcHRoIiwiU09SVEtFWV9ERVBUSCIsInNldHVwVmlld3BvcnQiLCJjYW1lcmEiLCJyZW5kZXJUYXJnZXQiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInBpeGVsV2lkdGgiLCJ3aWR0aCIsInBpeGVsSGVpZ2h0IiwiaGVpZ2h0IiwicmVjdCIsIngiLCJNYXRoIiwiZmxvb3IiLCJ5IiwidyIsInoiLCJoIiwic2V0Vmlld3BvcnQiLCJfc2Npc3NvclJlY3RDbGVhciIsInNjaXNzb3JSZWN0Iiwic2V0U2Npc3NvciIsInBvcEdwdU1hcmtlciIsInNldENhbWVyYVVuaWZvcm1zIiwidGFyZ2V0IiwiZmxpcFkiLCJ2aWV3Q291bnQiLCJ4ciIsInNlc3Npb24iLCJ0cmFuc2Zvcm0iLCJwYXJlbnQiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwidmlld3MiLCJsZW5ndGgiLCJ2IiwidmlldyIsInZpZXdJbnZPZmZNYXQiLCJtdWwyIiwidmlld09mZk1hdCIsImNvcHkiLCJpbnZlcnQiLCJzZXRGcm9tTWF0NCIsInByb2pWaWV3T2ZmTWF0IiwicHJvak1hdCIsInBvc2l0aW9uIiwiZGF0YSIsImZydXN0dW0iLCJwcm9qZWN0aW9uTWF0cml4IiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsIlZJRVdfQ0VOVEVSIiwicHJvak1hdFNreWJveCIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJpc1dlYkdQVSIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJzZXRUUlMiLCJWZWMzIiwiT05FIiwiZGlzcGF0Y2hWaWV3UG9zIiwibiIsIl9uZWFyQ2xpcCIsImYiLCJfZmFyQ2xpcCIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsInBoeXNpY2FsVW5pdHMiLCJnZXRFeHBvc3VyZSIsImV4cG9zdXJlIiwiY2xlYXIiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsImZsYWdzIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJDTEVBUkZMQUdfQ09MT1IiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsIkNMRUFSRkxBR19ERVBUSCIsIl9jbGVhclN0ZW5jaWxCdWZmZXIiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNvbG9yIiwiX2NsZWFyQ29sb3IiLCJyIiwiZyIsImIiLCJhIiwiZGVwdGgiLCJfY2xlYXJEZXB0aCIsInN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsIiwic2V0Q2FtZXJhIiwicmVuZGVyQWN0aW9uIiwiY2xlYXJWaWV3IiwiZm9yY2VXcml0ZSIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0Q29sb3JXcml0ZSIsInNldERlcHRoV3JpdGUiLCJvcHRpb25zIiwiX2NsZWFyT3B0aW9ucyIsInNldEN1bGxNb2RlIiwiY3VsbEZhY2VzIiwiZmxpcCIsImRyYXdDYWxsIiwibWF0ZXJpYWwiLCJtb2RlIiwiQ1VMTEZBQ0VfTk9ORSIsImZsaXBGYWNlcyIsImN1bGwiLCJDVUxMRkFDRV9GUk9OVCIsIkNVTExGQUNFX0JBQ0siLCJub2RlIiwibmVnYXRpdmVTY2FsZVdvcmxkIiwidXBkYXRlQ2FtZXJhRnJ1c3R1bSIsInNldEJhc2VDb25zdGFudHMiLCJvcGFjaXR5TWFwIiwiYWxwaGFUZXN0IiwidXBkYXRlQ3B1U2tpbk1hdHJpY2VzIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJza2luVGltZSIsIm5vdyIsImkiLCJzaSIsInNraW5JbnN0YW5jZSIsInVwZGF0ZU1hdHJpY2VzIiwiX2RpcnR5IiwidXBkYXRlR3B1U2tpbk1hdHJpY2VzIiwiY291bnQiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwic2tpbiIsInVwZGF0ZU1hdHJpeFBhbGV0dGUiLCJ1cGRhdGVNb3JwaGluZyIsIm1vcnBoVGltZSIsIm1vcnBoSW5zdCIsIm1vcnBoSW5zdGFuY2UiLCJ1cGRhdGUiLCJncHVVcGRhdGUiLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0VmVydGV4QnVmZmVyIiwidmVydGV4QnVmZmVyIiwic2V0TW9ycGhpbmciLCJtb3JwaCIsInVzZVRleHR1cmVNb3JwaCIsInZlcnRleEJ1ZmZlcklkcyIsInRleHR1cmVQb3NpdGlvbnMiLCJ0ZXh0dXJlTm9ybWFscyIsIl90ZXh0dXJlUGFyYW1zIiwidCIsIl9hY3RpdmVWZXJ0ZXhCdWZmZXJzIiwidmIiLCJzZW1hbnRpYyIsIlNFTUFOVElDX0FUVFIiLCJmb3JtYXQiLCJlbGVtZW50cyIsIm5hbWUiLCJzY29wZUlkIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0EiLCJfc2hhZGVyTW9ycGhXZWlnaHRzQiIsInNldFNraW5uaW5nIiwibWVzaEluc3RhbmNlIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJib25lVGV4dHVyZSIsIm1hdHJpeFBhbGV0dGUiLCJ2cCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0Iiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfTUFUNCIsIkJpbmRHcm91cEZvcm1hdCIsIkJpbmRCdWZmZXJGb3JtYXQiLCJVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSIsIlNIQURFUlNUQUdFX1ZFUlRFWCIsIlNIQURFUlNUQUdFX0ZSQUdNRU5UIiwiQmluZFRleHR1cmVGb3JtYXQiLCJURVhUVVJFRElNRU5TSU9OXzJEIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwiRGVidWciLCJhc3NlcnQiLCJBcnJheSIsImlzQXJyYXkiLCJ1YiIsIlVuaWZvcm1CdWZmZXIiLCJiZyIsIkJpbmRHcm91cCIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsInB1c2giLCJ2aWV3QmluZEdyb3VwIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJzZXRCaW5kR3JvdXAiLCJCSU5ER1JPVVBfVklFVyIsInNldHVwTWVzaFVuaWZvcm1CdWZmZXJzIiwicGFzcyIsIndvcmxkVHJhbnNmb3JtIiwibm9ybWFsTWF0cml4IiwibWVzaEJpbmRHcm91cCIsImdldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9NRVNIIiwiZHJhd0luc3RhbmNlIiwic3R5bGUiLCJub3JtYWwiLCJpbnN0YW5jaW5nRGF0YSIsImRyYXciLCJwcmltaXRpdmUiLCJtb2RlbE1hdHJpeCIsImRyYXdJbnN0YW5jZTIiLCJ1bmRlZmluZWQiLCJ2aXNpYmxlTGlzdCIsImN1bGxUaW1lIiwibnVtRHJhd0NhbGxzQ3VsbGVkIiwidmlzaWJsZUxlbmd0aCIsImN1bGxpbmdNYXNrIiwiZnJ1c3R1bUN1bGxpbmciLCJ2aXNpYmxlIiwiY29tbWFuZCIsIm1hc2siLCJfaXNWaXNpYmxlIiwiY3VsbExpZ2h0cyIsImxpZ2h0cyIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0IiwiZW5hYmxlZCIsIl90eXBlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiZ2V0Qm91bmRpbmdTcGhlcmUiLCJjb250YWluc1NwaGVyZSIsInVzZVBoeXNpY2FsVW5pdHMiLCJzY3JlZW5TaXplIiwiZ2V0U2NyZWVuU2l6ZSIsIm1heFNjcmVlblNpemUiLCJtYXgiLCJjYXN0U2hhZG93cyIsInNoYWRvd01hcCIsImN1bGxTaGFkb3dtYXBzIiwiY29tcCIsImlzQ2x1c3RlcmVkIiwiX2xpZ2h0cyIsImF0bGFzU2xvdFVwZGF0ZWQiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiY2FzdGVycyIsIl9saWdodENvbXBvc2l0aW9uRGF0YSIsInNoYWRvd0Nhc3RlcnNMaXN0IiwicmVuZGVyQWN0aW9ucyIsIl9yZW5kZXJBY3Rpb25zIiwiZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzIiwiaiIsImxpZ2h0SW5kZXgiLCJjdWxsQ29tcG9zaXRpb24iLCJsYXllckluZGV4IiwibGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckxpc3QiLCJjYW1lcmFQYXNzIiwiY2FtZXJhSW5kZXgiLCJjYW1lcmFzIiwiZnJhbWVVcGRhdGUiLCJmaXJzdENhbWVyYVVzZSIsIm9iamVjdHMiLCJpbnN0YW5jZXMiLCJ2aXNpYmxlVHJhbnNwYXJlbnQiLCJ2aXNpYmxlT3BhcXVlIiwiZG9uZSIsIm9uUHJlQ3VsbCIsInRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJsaXN0Iiwib25Qb3N0Q3VsbCIsInVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzIiwidXBkYXRlU2hhZGVycyIsIm9ubHlMaXRTaGFkZXJzIiwibWF0IiwiaGFzIiwiYWRkIiwiZ2V0U2hhZGVyVmFyaWFudCIsIk1hdGVyaWFsIiwicHJvdG90eXBlIiwidXNlTGlnaHRpbmciLCJlbWl0dGVyIiwibGlnaHRpbmciLCJjbGVhclZhcmlhbnRzIiwicmVuZGVyQ29va2llcyIsImNvb2tpZVJlbmRlclRhcmdldCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJyZW5kZXIiLCJiZWdpbkZyYW1lIiwibGlnaHRzQ2hhbmdlZCIsIm1lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlcyIsIl9zaGFkZXJWZXJzaW9uIiwibWlDb3VudCIsImxpZ2h0Q291bnQiLCJfc3BsaXRMaWdodHMiLCJMSUdIVFRZUEVfU1BPVCIsIkxJR0hUVFlQRV9PTU5JIiwidXBkYXRlQ2x1c3RlcnMiLCJzdGFydFRpbWUiLCJlbXB0eVdvcmxkQ2x1c3RlcnMiLCJnZXRFbXB0eVdvcmxkQ2x1c3RlcnMiLCJjbHVzdGVyIiwibGlnaHRDbHVzdGVycyIsImNsdXN0ZXJlZExpZ2h0c1NldCIsImdhbW1hQ29ycmVjdGlvbiIsIl93b3JsZENsdXN0ZXJzIiwidXBkYXRlTGF5ZXJDb21wb3NpdGlvbiIsImxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwibGVuIiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwic2hhZGVyVmVyc2lvbiIsIl9za2lwUmVuZGVyQ291bnRlciIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiX3JlbmRlclRpbWUiLCJfcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsIl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsIl9wb3N0UmVuZGVyQ291bnRlck1heCIsInByZXBhcmUiLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiX3N0YXRpY0xpZ2h0SGFzaCIsIl9zdGF0aWNQcmVwYXJlRG9uZSIsIlN0YXRpY01lc2hlcyIsInJldmVydCIsInVwZGF0ZWQiLCJfdXBkYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFzQ0EsSUFBSUEsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0FBQ3hCLE1BQU1DLGVBQWUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ3BDLE1BQU1DLFdBQVcsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUM5QixNQUFNQyxVQUFVLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDN0IsTUFBTUUsT0FBTyxH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
