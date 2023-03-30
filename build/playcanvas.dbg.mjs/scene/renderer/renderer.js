/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
  setupCullMode(cullFaces, flipFactor, drawCall) {
    const material = drawCall.material;
    let mode = CULLFACE_NONE;
    if (cullFaces) {
      let flipFaces = 1;
      if (material.cull === CULLFACE_FRONT || material.cull === CULLFACE_BACK) {
        flipFaces = flipFactor * drawCall.flipFacesFactor * drawCall.node.worldScaleSign;
      }
      if (flipFaces < 0) {
        mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
      } else {
        mode = material.cull;
      }
    }
    this.device.setCullMode(mode);
    if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
      this.twoSidedLightingNegScaleFactorId.setValue(drawCall.node.worldScaleSign);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctc3BoZXJlLmpzJztcblxuaW1wb3J0IHtcbiAgICBTT1JUS0VZX0RFUFRILCBTT1JUS0VZX0ZPUldBUkQsXG4gICAgVklFV19DRU5URVIsIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQge1xuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBCSU5ER1JPVVBfTUVTSCwgQklOREdST1VQX1ZJRVcsIFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FLFxuICAgIFVOSUZPUk1UWVBFX01BVDQsXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBTRU1BTlRJQ19BVFRSLFxuICAgIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX0ZST05ULCBDVUxMRkFDRV9OT05FLFxuICAgIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBCaW5kR3JvdXBGb3JtYXQsIEJpbmRCdWZmZXJGb3JtYXQsIEJpbmRUZXh0dXJlRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuXG5pbXBvcnQgeyBTaGFkb3dNYXBDYWNoZSB9IGZyb20gJy4vc2hhZG93LW1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlckxvY2FsIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXItbG9jYWwuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCB9IGZyb20gJy4vc2hhZG93LXJlbmRlcmVyLWRpcmVjdGlvbmFsLmpzJztcbmltcG9ydCB7IENvb2tpZVJlbmRlcmVyIH0gZnJvbSAnLi9jb29raWUtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgU3RhdGljTWVzaGVzIH0gZnJvbSAnLi9zdGF0aWMtbWVzaGVzLmpzJztcbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXIuanMnO1xuXG5sZXQgX3NraW5VcGRhdGVJbmRleCA9IDA7XG5jb25zdCBib25lVGV4dHVyZVNpemUgPSBbMCwgMCwgMCwgMF07XG5jb25zdCB2aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2aWV3SW52TWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld01hdDMgPSBuZXcgTWF0MygpO1xuY29uc3QgdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX2ZsaXBZTWF0ID0gbmV3IE1hdDQoKS5zZXRTY2FsZSgxLCAtMSwgMSk7XG5cbi8vIENvbnZlcnRzIGEgcHJvamVjdGlvbiBtYXRyaXggaW4gT3BlbkdMIHN0eWxlIChkZXB0aCByYW5nZSBvZiAtMS4uMSkgdG8gYSBEaXJlY3RYIHN0eWxlIChkZXB0aCByYW5nZSBvZiAwLi4xKS5cbmNvbnN0IF9maXhQcm9qUmFuZ2VNYXQgPSBuZXcgTWF0NCgpLnNldChbXG4gICAgMSwgMCwgMCwgMCxcbiAgICAwLCAxLCAwLCAwLFxuICAgIDAsIDAsIDAuNSwgMCxcbiAgICAwLCAwLCAwLjUsIDFcbl0pO1xuXG5jb25zdCBfdGVtcFByb2pNYXQwID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wUHJvak1hdDEgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0MiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQzID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wU2V0ID0gbmV3IFNldCgpO1xuXG4vKipcbiAqIFRoZSBiYXNlIHJlbmRlcmVyIGZ1bmN0aW9uYWxpdHkgdG8gYWxsb3cgaW1wbGVtZW50YXRpb24gb2Ygc3BlY2lhbGl6ZWQgcmVuZGVyZXJzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgUmVuZGVyZXIge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBjbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZXxudWxsfSAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICAvLyB0ZXh0dXJlIGF0bGFzIG1hbmFnaW5nIHNoYWRvdyBtYXAgLyBjb29raWUgdGV4dHVyZSBhdGxhc3NpbmcgZm9yIG9tbmkgYW5kIHNwb3QgbGlnaHRzXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBuZXcgTGlnaHRUZXh0dXJlQXRsYXMoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIC8vIHNoYWRvd3NcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IG5ldyBTaGFkb3dNYXBDYWNoZSgpO1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyID0gbmV3IFNoYWRvd1JlbmRlcmVyKHRoaXMsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsID0gbmV3IFNoYWRvd1JlbmRlcmVyTG9jYWwodGhpcywgdGhpcy5zaGFkb3dSZW5kZXJlcik7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgPSBuZXcgU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCh0aGlzLCB0aGlzLnNoYWRvd1JlbmRlcmVyKTtcblxuICAgICAgICAvLyBjb29raWVzXG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbmV3IENvb2tpZVJlbmRlcmVyKGdyYXBoaWNzRGV2aWNlLCB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAvLyB2aWV3IGJpbmQgZ3JvdXAgZm9ybWF0IHdpdGggaXRzIHVuaWZvcm0gYnVmZmVyIGZvcm1hdFxuICAgICAgICB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0ID0gbnVsbDtcblxuICAgICAgICAvLyB0aW1pbmdcbiAgICAgICAgdGhpcy5fc2tpblRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9tb3JwaFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcblxuICAgICAgICAvLyBzdGF0c1xuICAgICAgICB0aGlzLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuX251bURyYXdDYWxsc0N1bGxlZCA9IDA7XG4gICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnMgPSAwO1xuXG4gICAgICAgIC8vIFVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHNjb3BlID0gZ3JhcGhpY3NEZXZpY2Uuc2NvcGU7XG4gICAgICAgIHRoaXMuYm9uZVRleHR1cmVJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfcG9zZU1hcCcpO1xuICAgICAgICB0aGlzLmJvbmVUZXh0dXJlU2l6ZUlkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9wb3NlTWFwU2l6ZScpO1xuICAgICAgICB0aGlzLnBvc2VNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wb3NlWzBdJyk7XG5cbiAgICAgICAgdGhpcy5tb2RlbE1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X21vZGVsJyk7XG4gICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbm9ybWFsJyk7XG4gICAgICAgIHRoaXMudmlld0ludklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdJbnZlcnNlJyk7XG4gICAgICAgIHRoaXMudmlld1BvcyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkID0gc2NvcGUucmVzb2x2ZSgndmlld19wb3NpdGlvbicpO1xuICAgICAgICB0aGlzLnByb2pJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wcm9qZWN0aW9uJyk7XG4gICAgICAgIHRoaXMucHJvalNreWJveElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Byb2plY3Rpb25Ta3lib3gnKTtcbiAgICAgICAgdGhpcy52aWV3SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlldycpO1xuICAgICAgICB0aGlzLnZpZXdJZDMgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlldzMnKTtcbiAgICAgICAgdGhpcy52aWV3UHJvaklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdQcm9qZWN0aW9uJyk7XG4gICAgICAgIHRoaXMuZmxpcFlJZCA9IHNjb3BlLnJlc29sdmUoJ3Byb2plY3Rpb25GbGlwWScpO1xuICAgICAgICB0aGlzLnRibkJhc2lzID0gc2NvcGUucmVzb2x2ZSgndGJuQmFzaXMnKTtcbiAgICAgICAgdGhpcy5uZWFyQ2xpcElkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX25lYXInKTtcbiAgICAgICAgdGhpcy5mYXJDbGlwSWQgPSBzY29wZS5yZXNvbHZlKCdjYW1lcmFfZmFyJyk7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9wYXJhbXMnKTtcblxuICAgICAgICB0aGlzLmFscGhhVGVzdElkID0gc2NvcGUucmVzb2x2ZSgnYWxwaGFfcmVmJyk7XG4gICAgICAgIHRoaXMub3BhY2l0eU1hcElkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG5cbiAgICAgICAgdGhpcy5leHBvc3VyZUlkID0gc2NvcGUucmVzb2x2ZSgnZXhwb3N1cmUnKTtcbiAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZCA9IHNjb3BlLnJlc29sdmUoJ3R3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcicpO1xuICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKDApO1xuXG4gICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQSA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3dlaWdodHNfYScpO1xuICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0IgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF93ZWlnaHRzX2InKTtcbiAgICAgICAgdGhpcy5tb3JwaFBvc2l0aW9uVGV4ID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhQb3NpdGlvblRleCcpO1xuICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4ID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhOb3JtYWxUZXgnKTtcbiAgICAgICAgdGhpcy5tb3JwaFRleFBhcmFtcyA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3RleF9wYXJhbXMnKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgc29ydENvbXBhcmUoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QyICYmIGRyYXdDYWxsQi56ZGlzdDIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0MiAtIGRyYXdDYWxsQi56ZGlzdDI7IC8vIGZyb250IHRvIGJhY2tcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdIC0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZU1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgICAgIGNvbnN0IGtleUIgPSBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZURlcHRoKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGNvbnN0IGtleUEgPSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0RFUFRIXTtcbiAgICAgICAgY29uc3Qga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfREVQVEhdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdXAgdGhlIHZpZXdwb3J0IGFuZCB0aGUgc2Npc3NvciBmb3IgY2FtZXJhIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgY29udGFpbmluZyB0aGUgdmlld3BvcnRcbiAgICAgKiBpbmZvcm1hdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gW3JlbmRlclRhcmdldF0gLSBUaGVcbiAgICAgKiByZW5kZXIgdGFyZ2V0LiBOVUxMIGZvciB0aGUgZGVmYXVsdCBvbmUuXG4gICAgICovXG4gICAgc2V0dXBWaWV3cG9ydChjYW1lcmEsIHJlbmRlclRhcmdldCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnU0VUVVAtVklFV1BPUlQnKTtcblxuICAgICAgICBjb25zdCBwaXhlbFdpZHRoID0gcmVuZGVyVGFyZ2V0ID8gcmVuZGVyVGFyZ2V0LndpZHRoIDogZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBwaXhlbEhlaWdodCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IHJlY3QgPSBjYW1lcmEucmVjdDtcbiAgICAgICAgbGV0IHggPSBNYXRoLmZsb29yKHJlY3QueCAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgeSA9IE1hdGguZmxvb3IocmVjdC55ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBsZXQgdyA9IE1hdGguZmxvb3IocmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgIGxldCBoID0gTWF0aC5mbG9vcihyZWN0LncgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh4LCB5LCB3LCBoKTtcblxuICAgICAgICAvLyB1c2Ugdmlld3BvcnQgcmVjdGFuZ2xlIGJ5IGRlZmF1bHQuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpIHtcblxuICAgICAgICAvLyBmbGlwcGluZyBwcm9qIG1hdHJpeFxuICAgICAgICBjb25zdCBmbGlwWSA9IHRhcmdldD8uZmxpcFk7XG5cbiAgICAgICAgbGV0IHZpZXdDb3VudCA9IDE7XG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24pIHtcbiAgICAgICAgICAgIGxldCB0cmFuc2Zvcm07XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBjYW1lcmEuX25vZGUucGFyZW50O1xuICAgICAgICAgICAgaWYgKHBhcmVudClcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm0gPSBwYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG4gICAgICAgICAgICB2aWV3Q291bnQgPSB2aWV3cy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdDb3VudDsgdisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdJbnZPZmZNYXQubXVsMih0cmFuc2Zvcm0sIHZpZXcudmlld0ludk1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld09mZk1hdC5jb3B5KHZpZXcudmlld0ludk9mZk1hdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3SW52T2ZmTWF0LmNvcHkodmlldy52aWV3SW52TWF0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3T2ZmTWF0LmNvcHkodmlldy52aWV3TWF0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2aWV3LnZpZXdNYXQzLnNldEZyb21NYXQ0KHZpZXcudmlld09mZk1hdCk7XG4gICAgICAgICAgICAgICAgdmlldy5wcm9qVmlld09mZk1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcblxuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMF0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxMl07XG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblsxXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzEzXTtcbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzJdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTRdO1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlldy5wcm9qVmlld09mZk1hdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIFByb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICBsZXQgcHJvak1hdCA9IGNhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgICAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24ocHJvak1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHByb2pNYXRTa3lib3ggPSBjYW1lcmEuZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCgpO1xuXG4gICAgICAgICAgICAvLyBmbGlwIHByb2plY3Rpb24gbWF0cmljZXNcbiAgICAgICAgICAgIGlmIChmbGlwWSkge1xuICAgICAgICAgICAgICAgIHByb2pNYXQgPSBfdGVtcFByb2pNYXQwLm11bDIoX2ZsaXBZTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0MS5tdWwyKF9mbGlwWU1hdCwgcHJvak1hdFNreWJveCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBkZXB0aCByYW5nZSBvZiBwcm9qZWN0aW9uIG1hdHJpY2VzICgtMS4uMSB0byAwLi4xKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgcHJvak1hdCA9IF90ZW1wUHJvak1hdDIubXVsMihfZml4UHJvalJhbmdlTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0My5tdWwyKF9maXhQcm9qUmFuZ2VNYXQsIHByb2pNYXRTa3lib3gpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZShwcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUocHJvak1hdFNreWJveC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld0ludmVyc2UgTWF0cml4XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkLnNldFZhbHVlKHZpZXdNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgM3gzXG4gICAgICAgICAgICB2aWV3TWF0My5zZXRGcm9tTWF0NCh2aWV3TWF0KTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkMy5zZXRWYWx1ZSh2aWV3TWF0My5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld1Byb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKHZpZXdQcm9qTWF0LmRhdGEpO1xuXG4gICAgICAgICAgICB0aGlzLmZsaXBZSWQuc2V0VmFsdWUoZmxpcFkgPyAtMSA6IDEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IFBvc2l0aW9uICh3b3JsZCBzcGFjZSlcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hWaWV3UG9zKGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50Ym5CYXNpcy5zZXRWYWx1ZShmbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgLy8gTmVhciBhbmQgZmFyIGNsaXAgdmFsdWVzXG4gICAgICAgIGNvbnN0IG4gPSBjYW1lcmEuX25lYXJDbGlwO1xuICAgICAgICBjb25zdCBmID0gY2FtZXJhLl9mYXJDbGlwO1xuICAgICAgICB0aGlzLm5lYXJDbGlwSWQuc2V0VmFsdWUobik7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkLnNldFZhbHVlKGYpO1xuXG4gICAgICAgIC8vIGNhbWVyYSBwYXJhbXNcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMF0gPSAxIC8gZjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMV0gPSBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1syXSA9IG47XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzNdID0gY2FtZXJhLnByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID8gMSA6IDA7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zSWQuc2V0VmFsdWUodGhpcy5jYW1lcmFQYXJhbXMpO1xuXG4gICAgICAgIC8vIGV4cG9zdXJlXG4gICAgICAgIHRoaXMuZXhwb3N1cmVJZC5zZXRWYWx1ZSh0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHMgPyBjYW1lcmEuZ2V0RXhwb3N1cmUoKSA6IHRoaXMuc2NlbmUuZXhwb3N1cmUpO1xuXG4gICAgICAgIHJldHVybiB2aWV3Q291bnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgdGhlIHZpZXdwb3J0IGlzIGFscmVhZHkgc2V0IHVwLCBvbmx5IGl0cyBhcmVhIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY2FtZXJhLmpzJykuQ2FtZXJhfSBjYW1lcmEgLSBUaGUgY2FtZXJhIHN1cHBseWluZyB0aGUgdmFsdWUgdG8gY2xlYXIgdG8uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY2xlYXJDb2xvcl0gLSBUcnVlIGlmIHRoZSBjb2xvciBidWZmZXIgc2hvdWxkIGJlIGNsZWFyZWQuIFVzZXMgdGhlIHZhbHVlXG4gICAgICogZnJvbSB0aGUgY2FtcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NsZWFyRGVwdGhdIC0gVHJ1ZSBpZiB0aGUgZGVwdGggYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLiBVc2VzIHRoZSB2YWx1ZVxuICAgICAqIGZyb20gdGhlIGNhbXJhIGlmIG5vdCBzdXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjbGVhclN0ZW5jaWxdIC0gVHJ1ZSBpZiB0aGUgc3RlbmNpbCBidWZmZXIgc2hvdWxkIGJlIGNsZWFyZWQuIFVzZXMgdGhlXG4gICAgICogdmFsdWUgZnJvbSB0aGUgY2FtcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqL1xuICAgIGNsZWFyKGNhbWVyYSwgY2xlYXJDb2xvciwgY2xlYXJEZXB0aCwgY2xlYXJTdGVuY2lsKSB7XG5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSAoKGNsZWFyQ29sb3IgPz8gY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyKSA/IENMRUFSRkxBR19DT0xPUiA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAoKGNsZWFyRGVwdGggPz8gY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyKSA/IENMRUFSRkxBR19ERVBUSCA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAoKGNsZWFyU3RlbmNpbCA/PyBjYW1lcmEuX2NsZWFyU3RlbmNpbEJ1ZmZlcikgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApO1xuXG4gICAgICAgIGlmIChmbGFncykge1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnQ0xFQVInKTtcblxuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBmbGFnc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgY29sb3JXcml0ZSBpcyBzZXQgdG8gdHJ1ZSB0byBhbGwgY2hhbm5lbHMsIGlmIHlvdSB3YW50IHRvIGZ1bGx5IGNsZWFyIHRoZSB0YXJnZXRcbiAgICAvLyBUT0RPOiB0aGlzIGZ1bmN0aW9uIGlzIG9ubHkgdXNlZCBmcm9tIG91dHNpZGUgb2YgZm9yd2FyZCByZW5kZXJlciwgYW5kIHNob3VsZCBiZSBkZXByZWNhdGVkXG4gICAgLy8gd2hlbiB0aGUgZnVuY3Rpb25hbGl0eSBtb3ZlcyB0byB0aGUgcmVuZGVyIHBhc3Nlcy4gTm90ZSB0aGF0IEVkaXRvciB1c2VzIGl0IGFzIHdlbGwuXG4gICAgc2V0Q2FtZXJhKGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgcmVuZGVyQWN0aW9uID0gbnVsbCkge1xuXG4gICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpO1xuICAgICAgICB0aGlzLmNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB0aGlzIGlzIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBsaWdodG1hcHBlciBhbmQgdGhlIEVkaXRvcixcbiAgICAvLyBhbmQgd2lsbCBiZSByZW1vdmVkIHdoZW4gdGhvc2UgY2FsbCBhcmUgcmVtb3ZlZC5cbiAgICBjbGVhclZpZXcoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCBmb3JjZVdyaXRlKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXJyk7XG5cbiAgICAgICAgZGV2aWNlLnNldFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgICAgICBkZXZpY2UudXBkYXRlQmVnaW4oKTtcblxuICAgICAgICBpZiAoZm9yY2VXcml0ZSkge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBWaWV3cG9ydChjYW1lcmEsIHRhcmdldCk7XG5cbiAgICAgICAgaWYgKGNsZWFyKSB7XG5cbiAgICAgICAgICAgIC8vIHVzZSBjYW1lcmEgY2xlYXIgb3B0aW9ucyBpZiBhbnlcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBjYW1lcmEuX2NsZWFyT3B0aW9ucztcbiAgICAgICAgICAgIGRldmljZS5jbGVhcihvcHRpb25zID8gb3B0aW9ucyA6IHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIGZsYWdzOiAoY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyID8gQ0xFQVJGTEFHX0NPTE9SIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhclN0ZW5jaWxCdWZmZXIgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0dXBDdWxsTW9kZShjdWxsRmFjZXMsIGZsaXBGYWN0b3IsIGRyYXdDYWxsKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG4gICAgICAgIGxldCBtb2RlID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgaWYgKGN1bGxGYWNlcykge1xuICAgICAgICAgICAgbGV0IGZsaXBGYWNlcyA9IDE7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9GUk9OVCB8fCBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9CQUNLKSB7XG4gICAgICAgICAgICAgICAgZmxpcEZhY2VzID0gZmxpcEZhY3RvciAqIGRyYXdDYWxsLmZsaXBGYWNlc0ZhY3RvciAqIGRyYXdDYWxsLm5vZGUud29ybGRTY2FsZVNpZ247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGlwRmFjZXMgPCAwKSB7XG4gICAgICAgICAgICAgICAgbW9kZSA9IG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0ZST05UID8gQ1VMTEZBQ0VfQkFDSyA6IENVTExGQUNFX0ZST05UO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRldmljZS5zZXRDdWxsTW9kZShtb2RlKTtcblxuICAgICAgICBpZiAobW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKGRyYXdDYWxsLm5vZGUud29ybGRTY2FsZVNpZ24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlQ2FtZXJhRnJ1c3R1bShjYW1lcmEpIHtcblxuICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBmcnVzdHVtIGJhc2VkIG9uIFhSIHZpZXdcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSBjYW1lcmEueHIudmlld3NbMF07XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbihwcm9qTWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSh2aWV3SW52TWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGNhbWVyYS5fbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgdmlld0ludk1hdC5zZXRUUlMocG9zLCByb3QsIFZlYzMuT05FKTtcbiAgICAgICAgICAgIHRoaXMudmlld0ludklkLnNldFZhbHVlKHZpZXdJbnZNYXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgdmlld01hdC5jb3B5KHZpZXdJbnZNYXQpLmludmVydCgpO1xuXG4gICAgICAgIHZpZXdQcm9qTWF0Lm11bDIocHJvak1hdCwgdmlld01hdCk7XG4gICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICB9XG5cbiAgICBzZXRCYXNlQ29uc3RhbnRzKGRldmljZSwgbWF0ZXJpYWwpIHtcblxuICAgICAgICAvLyBDdWxsIG1vZGVcbiAgICAgICAgZGV2aWNlLnNldEN1bGxNb2RlKG1hdGVyaWFsLmN1bGwpO1xuXG4gICAgICAgIC8vIEFscGhhIHRlc3RcbiAgICAgICAgaWYgKG1hdGVyaWFsLm9wYWNpdHlNYXApIHtcbiAgICAgICAgICAgIHRoaXMub3BhY2l0eU1hcElkLnNldFZhbHVlKG1hdGVyaWFsLm9wYWNpdHlNYXApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwIHx8IG1hdGVyaWFsLmFscGhhVGVzdCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcblxuICAgICAgICBfc2tpblVwZGF0ZUluZGV4Kys7XG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBpZiAoZHJhd0NhbGxzQ291bnQgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2kgPSBkcmF3Q2FsbHNbaV0uc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKHNpKSB7XG4gICAgICAgICAgICAgICAgc2kudXBkYXRlTWF0cmljZXMoZHJhd0NhbGxzW2ldLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIHNpLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBjb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNraW4gPSBkcmF3Q2FsbC5za2luSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKHNraW4gJiYgc2tpbi5fZGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpbi51cGRhdGVNYXRyaXhQYWxldHRlKGRyYXdDYWxsLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBza2luLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc2tpblRpbWUgKz0gbm93KCkgLSBza2luVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgdXBkYXRlTW9ycGhpbmcoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbW9ycGhUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoSW5zdCA9IGRyYXdDYWxsLm1vcnBoSW5zdGFuY2U7XG4gICAgICAgICAgICBpZiAobW9ycGhJbnN0ICYmIG1vcnBoSW5zdC5fZGlydHkgJiYgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSkge1xuICAgICAgICAgICAgICAgIG1vcnBoSW5zdC51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX21vcnBoVGltZSArPSBub3coKSAtIG1vcnBoVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZ3B1VXBkYXRlKGRyYXdDYWxscykge1xuICAgICAgICAvLyBza2lwIGV2ZXJ5dGhpbmcgd2l0aCB2aXNpYmxlVGhpc0ZyYW1lID09PSBmYWxzZVxuICAgICAgICB0aGlzLnVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscyk7XG4gICAgfVxuXG4gICAgc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpIHtcblxuICAgICAgICAvLyBtYWluIHZlcnRleCBidWZmZXJcbiAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihtZXNoLnZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgc2V0TW9ycGhpbmcoZGV2aWNlLCBtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UubW9ycGgudXNlVGV4dHVyZU1vcnBoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyIHdpdGggdmVydGV4IGlkc1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobW9ycGhJbnN0YW5jZS5tb3JwaC52ZXJ0ZXhCdWZmZXJJZHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXguc2V0VmFsdWUobW9ycGhJbnN0YW5jZS50ZXh0dXJlUG9zaXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZU5vcm1hbHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3RleHR1cmVQYXJhbXMpO1xuXG4gICAgICAgICAgICB9IGVsc2UgeyAgICAvLyB2ZXJ0ZXggYXR0cmlidXRlcyBiYXNlZCBtb3JwaGluZ1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgdCA9IDA7IHQgPCBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgdCsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmIgPSBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzW3RdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGF0Y2ggc2VtYW50aWMgZm9yIHRoZSBidWZmZXIgdG8gY3VycmVudCBBVFRSIHNsb3QgKHVzaW5nIEFUVFI4IC0gQVRUUjE1IHJhbmdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBTRU1BTlRJQ19BVFRSICsgKHQgKyA4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC5lbGVtZW50c1swXS5uYW1lID0gc2VtYW50aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0uc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNlbWFudGljKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcih2Yik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgYWxsIDggd2VpZ2h0c1xuICAgICAgICAgICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQS5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl9zaGFkZXJNb3JwaFdlaWdodHNBKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Iuc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSkge1xuICAgICAgICBpZiAobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2tpbkRyYXdDYWxscysrO1xuICAgICAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c0JvbmVUZXh0dXJlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVUZXh0dXJlID0gbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5ib25lVGV4dHVyZTtcbiAgICAgICAgICAgICAgICB0aGlzLmJvbmVUZXh0dXJlSWQuc2V0VmFsdWUoYm9uZVRleHR1cmUpO1xuICAgICAgICAgICAgICAgIGJvbmVUZXh0dXJlU2l6ZVswXSA9IGJvbmVUZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgIGJvbmVUZXh0dXJlU2l6ZVsxXSA9IGJvbmVUZXh0dXJlLmhlaWdodDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMl0gPSAxLjAgLyBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbM10gPSAxLjAgLyBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZC5zZXRWYWx1ZShib25lVGV4dHVyZVNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2VNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlLm1hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0cyBWZWMzIGNhbWVyYSBwb3NpdGlvbiB1bmlmb3JtXG4gICAgZGlzcGF0Y2hWaWV3UG9zKHBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZwID0gdGhpcy52aWV3UG9zOyAgICAvLyBub3RlIHRoYXQgdGhpcyByZXVzZXMgYW4gYXJyYXlcbiAgICAgICAgdnBbMF0gPSBwb3NpdGlvbi54O1xuICAgICAgICB2cFsxXSA9IHBvc2l0aW9uLnk7XG4gICAgICAgIHZwWzJdID0gcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodnApO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzICYmICF0aGlzLnZpZXdVbmlmb3JtRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgdGhpcy52aWV3VW5pZm9ybUZvcm1hdCA9IG5ldyBVbmlmb3JtQnVmZmVyRm9ybWF0KHRoaXMuZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJtYXRyaXhfdmlld1Byb2plY3Rpb25cIiwgVU5JRk9STVRZUEVfTUFUNClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIHNvbWUgdGV4dHVyZXNcbiAgICAgICAgICAgIHRoaXMudmlld0JpbmRHcm91cEZvcm1hdCA9IG5ldyBCaW5kR3JvdXBGb3JtYXQodGhpcy5kZXZpY2UsIFtcbiAgICAgICAgICAgICAgICBuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpXG4gICAgICAgICAgICBdLCBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdsaWdodHNUZXh0dXJlRmxvYXQnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnbGlnaHRzVGV4dHVyZTgnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldHVwVmlld1VuaWZvcm1CdWZmZXJzKHZpZXdCaW5kR3JvdXBzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCwgdmlld0NvdW50KSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KEFycmF5LmlzQXJyYXkodmlld0JpbmRHcm91cHMpLCBcInZpZXdCaW5kR3JvdXBzIG11c3QgYmUgYW4gYXJyYXlcIik7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnLmFzc2VydCh2aWV3Q291bnQgPT09IDEsIFwiVGhpcyBjb2RlIGRvZXMgbm90IGhhbmRsZSB0aGUgdmlld0NvdW50IHlldFwiKTtcblxuICAgICAgICB3aGlsZSAodmlld0JpbmRHcm91cHMubGVuZ3RoIDwgdmlld0NvdW50KSB7XG4gICAgICAgICAgICBjb25zdCB1YiA9IG5ldyBVbmlmb3JtQnVmZmVyKGRldmljZSwgdmlld1VuaWZvcm1Gb3JtYXQpO1xuICAgICAgICAgICAgY29uc3QgYmcgPSBuZXcgQmluZEdyb3VwKGRldmljZSwgdmlld0JpbmRHcm91cEZvcm1hdCwgdWIpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShiZywgYFZpZXdCaW5kR3JvdXBfJHtiZy5pZH1gKTtcbiAgICAgICAgICAgIHZpZXdCaW5kR3JvdXBzLnB1c2goYmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHZpZXcgYmluZCBncm91cCAvIHVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHZpZXdCaW5kR3JvdXAgPSB2aWV3QmluZEdyb3Vwc1swXTtcbiAgICAgICAgdmlld0JpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgdmlld0JpbmRHcm91cC51cGRhdGUoKTtcblxuICAgICAgICAvLyBUT0RPOyB0aGlzIG5lZWRzIHRvIGJlIG1vdmVkIHRvIGRyYXdJbnN0YW5jZSBmdW5jdGlvbnMgdG8gaGFuZGxlIFhSXG4gICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX1ZJRVcsIHZpZXdCaW5kR3JvdXApO1xuICAgIH1cblxuICAgIHNldHVwTWVzaFVuaWZvcm1CdWZmZXJzKG1lc2hJbnN0YW5jZSwgcGFzcykge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBpZiAoZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMpIHtcblxuICAgICAgICAgICAgLy8gVE9ETzogbW9kZWwgbWF0cml4IHNldHVwIGlzIHBhcnQgb2YgdGhlIGRyYXdJbnN0YW5jZSBjYWxsLCBidXQgd2l0aCB1bmlmb3JtIGJ1ZmZlciBpdCdzIG5lZWRlZFxuICAgICAgICAgICAgLy8gZWFybGllciBoZXJlLiBUaGlzIG5lZWRzIHRvIGJlIHJlZmFjdG9yZWQgZm9yIG11bHRpLXZpZXcgYW55d2F5cy5cbiAgICAgICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uubm9kZS53b3JsZFRyYW5zZm9ybS5kYXRhKTtcbiAgICAgICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLm5vZGUubm9ybWFsTWF0cml4LmRhdGEpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgbWVzaCBiaW5kIGdyb3VwIC8gdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG1lc2hCaW5kR3JvdXAgPSBtZXNoSW5zdGFuY2UuZ2V0QmluZEdyb3VwKGRldmljZSwgcGFzcyk7XG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyLnVwZGF0ZSgpO1xuICAgICAgICAgICAgbWVzaEJpbmRHcm91cC51cGRhdGUoKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX01FU0gsIG1lc2hCaW5kR3JvdXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZHJhd0luc3RhbmNlKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSwgbm9ybWFsKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgbWVzaEluc3RhbmNlLm5vZGUubmFtZSk7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2luZ0RhdGEgPSBtZXNoSW5zdGFuY2UuaW5zdGFuY2luZ0RhdGE7XG4gICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YSkge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlZERyYXdDYWxscysrO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIoaW5zdGFuY2luZ0RhdGEudmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIGluc3RhbmNpbmdEYXRhLmNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG1vZGVsTWF0cml4ID0gbWVzaEluc3RhbmNlLm5vZGUud29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICB0aGlzLm1vZGVsTWF0cml4SWQuc2V0VmFsdWUobW9kZWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIGlmIChub3JtYWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5vcm1hbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLm5vcm1hbE1hdHJpeC5kYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgLy8gdXNlZCBmb3Igc3RlcmVvXG4gICAgZHJhd0luc3RhbmNlMihkZXZpY2UsIG1lc2hJbnN0YW5jZSwgbWVzaCwgc3R5bGUpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCBpbnN0YW5jaW5nRGF0YS5jb3VudCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXRyaWNlcyBhcmUgYWxyZWFkeSBzZXRcbiAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgY3VsbChjYW1lcmEsIGRyYXdDYWxscywgdmlzaWJsZUxpc3QpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBjdWxsVGltZSA9IG5vdygpO1xuICAgICAgICBsZXQgbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHZpc2libGVMZW5ndGggPSAwO1xuICAgICAgICBjb25zdCBkcmF3Q2FsbHNDb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgY3VsbGluZ01hc2sgPSBjYW1lcmEuY3VsbGluZ01hc2sgfHwgMHhGRkZGRkZGRjsgLy8gaWYgbWlzc2luZyBhc3N1bWUgY2FtZXJhJ3MgZGVmYXVsdCB2YWx1ZVxuXG4gICAgICAgIGlmICghY2FtZXJhLmZydXN0dW1DdWxsaW5nKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBuZWVkIHRvIGNvcHkgYXJyYXkgYW55d2F5IGJlY2F1c2Ugc29ydGluZyB3aWxsIGhhcHBlbiBhbmQgaXQnbGwgYnJlYWsgb3JpZ2luYWwgZHJhdyBjYWxsIG9yZGVyIGFzc3VtcHRpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLnZpc2libGUgJiYgIWRyYXdDYWxsLmNvbW1hbmQpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIG9iamVjdCdzIG1hc2sgQU5EIHRoZSBjYW1lcmEncyBjdWxsaW5nTWFzayBpcyB6ZXJvIHRoZW4gdGhlIGdhbWUgb2JqZWN0IHdpbGwgYmUgaW52aXNpYmxlIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXNrICYmIChkcmF3Q2FsbC5tYXNrICYgY3VsbGluZ01hc2spID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxlbmd0aCsrO1xuICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHZpc2libGVMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC5jb21tYW5kKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbC52aXNpYmxlKSBjb250aW51ZTsgLy8gdXNlIHZpc2libGUgcHJvcGVydHkgdG8gcXVpY2tseSBoaWRlL3Nob3cgbWVzaEluc3RhbmNlc1xuICAgICAgICAgICAgICAgIGxldCB2aXNpYmxlID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBvYmplY3QncyBtYXNrIEFORCB0aGUgY2FtZXJhJ3MgY3VsbGluZ01hc2sgaXMgemVybyB0aGVuIHRoZSBnYW1lIG9iamVjdCB3aWxsIGJlIGludmlzaWJsZSBmcm9tIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwubWFzayAmJiAoZHJhd0NhbGwubWFzayAmIGN1bGxpbmdNYXNrKSA9PT0gMCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGwuY3VsbCkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlID0gZHJhd0NhbGwuX2lzVmlzaWJsZShjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgIG51bURyYXdDYWxsc0N1bGxlZCsrO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodmlzaWJsZSkge1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdDYWxsLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2N1bGxUaW1lICs9IG5vdygpIC0gY3VsbFRpbWU7XG4gICAgICAgIHRoaXMuX251bURyYXdDYWxsc0N1bGxlZCArPSBudW1EcmF3Q2FsbHNDdWxsZWQ7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHJldHVybiB2aXNpYmxlTGVuZ3RoO1xuICAgIH1cblxuICAgIGN1bGxMaWdodHMoY2FtZXJhLCBsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgY29uc3QgcGh5c2ljYWxVbml0cyA9IHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIC8vIGRpcmVjdGlvbmFsIGxpZ2h0cyBhcmUgbWFya2VkIHZpc2libGUgYXQgdGhlIHN0YXJ0IG9mIHRoZSBmcmFtZVxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LmdldEJvdW5kaW5nU3BoZXJlKHRlbXBTcGhlcmUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUodGVtcFNwaGVyZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudXNlUGh5c2ljYWxVbml0cyA9IHBoeXNpY2FsVW5pdHM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1heGltdW0gc2NyZWVuIGFyZWEgdGFrZW4gYnkgdGhlIGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzY3JlZW5TaXplID0gY2FtZXJhLmdldFNjcmVlblNpemUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC5tYXhTY3JlZW5TaXplID0gTWF0aC5tYXgobGlnaHQubWF4U2NyZWVuU2l6ZSwgc2NyZWVuU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBzaGFkb3cgY2FzdGluZyBsaWdodCBkb2VzIG5vdCBoYXZlIHNoYWRvdyBtYXAgYWxsb2NhdGVkLCBtYXJrIGl0IHZpc2libGUgdG8gYWxsb2NhdGUgc2hhZG93IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90ZTogVGhpcyB3b24ndCBiZSBuZWVkZWQgd2hlbiBjbHVzdGVyZWQgc2hhZG93cyBhcmUgdXNlZCwgYnV0IGF0IHRoZSBtb21lbnQgZXZlbiBjdWxsZWQgb3V0IGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJlIHVzZWQgZm9yIHJlbmRlcmluZywgYW5kIG5lZWQgc2hhZG93IG1hcCB0byBiZSBhbGxvY2F0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGRlbGV0ZSB0aGlzIGNvZGUgd2hlbiBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgaXMgYmVpbmcgcmVtb3ZlZCBhbmQgaXMgb24gYnkgZGVmYXVsdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzICYmICFsaWdodC5zaGFkb3dNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQudXNlUGh5c2ljYWxVbml0cyA9IHRoaXMuc2NlbmUucGh5c2ljYWxVbml0cztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaGFkb3cgbWFwIGN1bGxpbmcgZm9yIGRpcmVjdGlvbmFsIGFuZCB2aXNpYmxlIGxvY2FsIGxpZ2h0c1xuICAgICAqIHZpc2libGUgbWVzaEluc3RhbmNlcyBhcmUgY29sbGVjdGVkIGludG8gbGlnaHQuX3JlbmRlckRhdGEsIGFuZCBhcmUgbWFya2VkIGFzIHZpc2libGVcbiAgICAgKiBmb3IgZGlyZWN0aW9uYWwgbGlnaHRzIGFsc28gc2hhZG93IGNhbWVyYSBtYXRyaXggaXMgc2V0IHVwXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgY3VsbFNoYWRvd21hcHMoY29tcCkge1xuXG4gICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc3RlcnMgY3VsbGluZyBmb3IgbG9jYWwgKHBvaW50IGFuZCBzcG90KSBsaWdodHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wLl9saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gY29tcC5fbGlnaHRzW2ldO1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcblxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBhdGxhcyBzbG90IGlzIHJlYXNzaWduZWQsIG1ha2Ugc3VyZSB0byB1cGRhdGUgdGhlIHNoYWRvdyBtYXAsIGluY2x1ZGluZyB0aGUgY3VsbGluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNTbG90VXBkYXRlZCAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHQudmlzaWJsZVRoaXNGcmFtZSAmJiBsaWdodC5jYXN0U2hhZG93cyAmJiBsaWdodC5zaGFkb3dVcGRhdGVNb2RlICE9PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYXN0ZXJzID0gY29tcC5fbGlnaHRDb21wb3NpdGlvbkRhdGFbaV0uc2hhZG93Q2FzdGVyc0xpc3Q7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyTG9jYWwuY3VsbChsaWdodCwgY2FzdGVycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hhZG93IGNhc3RlcnMgY3VsbGluZyBmb3IgZ2xvYmFsIChkaXJlY3Rpb25hbCkgbGlnaHRzXG4gICAgICAgIC8vIHJlbmRlciBhY3Rpb25zIHN0b3JlIHdoaWNoIGRpcmVjdGlvbmFsIGxpZ2h0cyBhcmUgbmVlZGVkIGZvciBlYWNoIGNhbWVyYSwgc28gdGhlc2UgYXJlIGdldHRpbmcgY3VsbGVkXG4gICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbnMgPSBjb21wLl9yZW5kZXJBY3Rpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IHJlbmRlckFjdGlvbi5kaXJlY3Rpb25hbExpZ2h0c0luZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IHJlbmRlckFjdGlvbi5kaXJlY3Rpb25hbExpZ2h0c0luZGljZXNbal07XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBjb21wLl9saWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgY2FzdGVycyA9IGNvbXAuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdLnNoYWRvd0Nhc3RlcnNMaXN0O1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuY3VsbChsaWdodCwgY2FzdGVycywgcmVuZGVyQWN0aW9uLmNhbWVyYS5jYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdmlzaWJpbGl0eSBjdWxsaW5nIG9mIGxpZ2h0cywgbWVzaEluc3RhbmNlcywgc2hhZG93cyBjYXN0ZXJzXG4gICAgICogQWxzbyBhcHBsaWVzIG1lc2hJbnN0YW5jZS52aXNpYmxlIGFuZCBjYW1lcmEuY3VsbGluZ01hc2tcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICBjdWxsQ29tcG9zaXRpb24oY29tcCkge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgY3VsbFRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vcmVuZGVyLWFjdGlvbi5qcycpLlJlbmRlckFjdGlvbn0gKi9cbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbaV07XG5cbiAgICAgICAgICAgIC8vIGxheWVyXG4gICAgICAgICAgICBjb25zdCBsYXllckluZGV4ID0gcmVuZGVyQWN0aW9uLmxheWVySW5kZXg7XG4gICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gKi9cbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICBpZiAoIWxheWVyLmVuYWJsZWQgfHwgIWNvbXAuc3ViTGF5ZXJFbmFibGVkW2xheWVySW5kZXhdKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbbGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYVxuICAgICAgICAgICAgY29uc3QgY2FtZXJhUGFzcyA9IHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleDtcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSAqL1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZyYW1lVXBkYXRlKHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNhbWVyYSBhbmQgZnJ1c3R1bSBvbmNlXG4gICAgICAgICAgICAgICAgaWYgKHJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNhbWVyYUZydXN0dW0oY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCsrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGN1bGwgZWFjaCBsYXllcidzIG5vbi1kaXJlY3Rpb25hbCBsaWdodHMgb25jZSB3aXRoIGVhY2ggY2FtZXJhXG4gICAgICAgICAgICAgICAgLy8gbGlnaHRzIGFyZW4ndCBjb2xsZWN0ZWQgYW55d2hlcmUsIGJ1dCBtYXJrZWQgYXMgdmlzaWJsZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VsbExpZ2h0cyhjYW1lcmEuY2FtZXJhLCBsYXllci5fbGlnaHRzKTtcblxuICAgICAgICAgICAgICAgIC8vIGN1bGwgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICBjb25zdCBvYmplY3RzID0gbGF5ZXIuaW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAgICAgLy8gY29sbGVjdCB0aGVtIGludG8gbGF5ZXIgYXJyYXlzXG4gICAgICAgICAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgICAgICAvLyBzaGFyZWQgb2JqZWN0cyBhcmUgb25seSBjdWxsZWQgb25jZVxuICAgICAgICAgICAgICAgIGlmICghdmlzaWJsZS5kb25lKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLm9uUHJlQ3VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25QcmVDdWxsKGNhbWVyYVBhc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gdHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlLmxlbmd0aCA9IHRoaXMuY3VsbChjYW1lcmEuY2FtZXJhLCBkcmF3Q2FsbHMsIHZpc2libGUubGlzdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLm9uUG9zdEN1bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLm9uUG9zdEN1bGwoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgc2hhZG93IC8gY29va2llIGF0bGFzIGFsbG9jYXRpb24gZm9yIHRoZSB2aXNpYmxlIGxpZ2h0cy4gVXBkYXRlIGl0IGFmdGVyIHRoZSBsaWd0aHRzIHdlcmUgY3VsbGVkLFxuICAgICAgICAvLyBidXQgYmVmb3JlIHNoYWRvdyBtYXBzIHdlcmUgY3VsbGluZywgYXMgaXQgbWlnaHQgZm9yY2Ugc29tZSAndXBkYXRlIG9uY2UnIHNoYWRvd3MgdG8gY3VsbC5cbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzKGNvbXApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3VsbCBzaGFkb3cgY2FzdGVycyBmb3IgYWxsIGxpZ2h0c1xuICAgICAgICB0aGlzLmN1bGxTaGFkb3dtYXBzKGNvbXApO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gTWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbmx5TGl0U2hhZGVycyAtIExpbWl0cyB0aGUgdXBkYXRlIHRvIHNoYWRlcnMgYWZmZWN0ZWQgYnkgbGlnaHRpbmcuXG4gICAgICovXG4gICAgdXBkYXRlU2hhZGVycyhkcmF3Q2FsbHMsIG9ubHlMaXRTaGFkZXJzKSB7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXQgPSBkcmF3Q2FsbHNbaV0ubWF0ZXJpYWw7XG4gICAgICAgICAgICBpZiAobWF0KSB7XG4gICAgICAgICAgICAgICAgLy8gbWF0ZXJpYWwgbm90IHByb2Nlc3NlZCB5ZXRcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhtYXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIF90ZW1wU2V0LmFkZChtYXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBmb3IgbWF0ZXJpYWxzIG5vdCB1c2luZyB2YXJpYW50c1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0LmdldFNoYWRlclZhcmlhbnQgIT09IE1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXJWYXJpYW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbmx5TGl0U2hhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNraXAgbWF0ZXJpYWxzIG5vdCB1c2luZyBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0LnVzZUxpZ2h0aW5nIHx8IChtYXQuZW1pdHRlciAmJiAhbWF0LmVtaXR0ZXIubGlnaHRpbmcpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgc2hhZGVyIHZhcmlhbnRzIG9uIHRoZSBtYXRlcmlhbCBhbmQgYWxzbyBvbiBtZXNoIGluc3RhbmNlcyB0aGF0IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcbiAgICB9XG5cbiAgICByZW5kZXJDb29raWVzKGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IGNvb2tpZVJlbmRlclRhcmdldCA9IHRoaXMubGlnaHRUZXh0dXJlQXRsYXMuY29va2llUmVuZGVyVGFyZ2V0O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgIC8vIHNraXAgY2x1c3RlcmVkIGNvb2tpZXMgd2l0aCBubyBhc3NpZ25lZCBhdGxhcyBzbG90XG4gICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIG9ubHkgcmVuZGVyIGNvb2tpZSB3aGVuIHRoZSBzbG90IGlzIHJlYXNzaWduZWQgKGFzc3VtaW5nIHRoZSBjb29raWUgdGV4dHVyZSBpcyBzdGF0aWMpXG4gICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzU2xvdFVwZGF0ZWQpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyLnJlbmRlcihsaWdodCwgY29va2llUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbiB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBsaWdodHNDaGFuZ2VkIC0gVHJ1ZSBpZiBsaWdodHMgb2YgdGhlIGNvbXBvc2l0aW9uIGhhcyBjaGFuZ2VkLlxuICAgICAqL1xuICAgIGJlZ2luRnJhbWUoY29tcCwgbGlnaHRzQ2hhbmdlZCkge1xuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gY29tcC5fbWVzaEluc3RhbmNlcztcblxuICAgICAgICAvLyBVcGRhdGUgc2hhZGVycyBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBpZiAoc2NlbmUudXBkYXRlU2hhZGVycyB8fCBsaWdodHNDaGFuZ2VkKSB7XG4gICAgICAgICAgICBjb25zdCBvbmx5TGl0U2hhZGVycyA9ICFzY2VuZS51cGRhdGVTaGFkZXJzICYmIGxpZ2h0c0NoYW5nZWQ7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMobWVzaEluc3RhbmNlcywgb25seUxpdFNoYWRlcnMpO1xuICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IGZhbHNlO1xuICAgICAgICAgICAgc2NlbmUuX3NoYWRlclZlcnNpb24rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBhbGwgc2tpbiBtYXRyaWNlcyB0byBwcm9wZXJseSBjdWxsIHNraW5uZWQgb2JqZWN0cyAoYnV0IGRvbid0IHVwZGF0ZSByZW5kZXJpbmcgZGF0YSB5ZXQpXG4gICAgICAgIHRoaXMudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKG1lc2hJbnN0YW5jZXMpO1xuXG4gICAgICAgIC8vIGNsZWFyIG1lc2ggaW5zdGFuY2UgdmlzaWJpbGl0eVxuICAgICAgICBjb25zdCBtaUNvdW50ID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWlDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGxpZ2h0IHZpc2liaWxpdHlcbiAgICAgICAgY29uc3QgbGlnaHRzID0gY29tcC5fbGlnaHRzO1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodENvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGxpZ2h0c1tpXS5iZWdpbkZyYW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoY29tcCkge1xuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLnVwZGF0ZShjb21wLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0sIGNvbXAuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5zY2VuZS5saWdodGluZyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIHVwZGF0ZUNsdXN0ZXJzKGNvbXApIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBlbXB0eVdvcmxkQ2x1c3RlcnMgPSBjb21wLmdldEVtcHR5V29ybGRDbHVzdGVycyh0aGlzLmRldmljZSk7XG5cbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXIgPSByZW5kZXJBY3Rpb24ubGlnaHRDbHVzdGVycztcblxuICAgICAgICAgICAgaWYgKGNsdXN0ZXIgJiYgY2x1c3RlciAhPT0gZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZWFjaCBjbHVzdGVyIG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgICAgICBpZiAoIV90ZW1wU2V0LmhhcyhjbHVzdGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBfdGVtcFNldC5hZGQoY2x1c3Rlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtyZW5kZXJBY3Rpb24ubGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXIudXBkYXRlKGxheWVyLmNsdXN0ZXJlZExpZ2h0c1NldCwgdGhpcy5zY2VuZS5nYW1tYUNvcnJlY3Rpb24sIHRoaXMuc2NlbmUubGlnaHRpbmcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdGVtcCBzZXQgZW1wdHlcbiAgICAgICAgX3RlbXBTZXQuY2xlYXIoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnNUaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzID0gY29tcC5fd29ybGRDbHVzdGVycy5sZW5ndGg7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIGxheWVyIGNvbXBvc2l0aW9uIGZvciByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24gdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIC0gVHJ1ZSBpZiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSAtIEZsYWdzIG9mIHdoYXQgd2FzIHVwZGF0ZWRcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlTGF5ZXJDb21wb3NpdGlvbihjb21wLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGxlbiA9IGNvbXAubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29tcC5sYXllckxpc3RbaV0uX3Bvc3RSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3Qgc2hhZGVyVmVyc2lvbiA9IHNjZW5lLl9zaGFkZXJWZXJzaW9uO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgbGF5ZXIuX3NoYWRlclZlcnNpb24gPSBzaGFkZXJWZXJzaW9uO1xuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgbGF5ZXIuX3NraXBSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3JlbmRlclRpbWUgPSAwO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGxheWVyLl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzID0gMDtcbiAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyA9IDA7XG4gICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGNvbXAuc3ViTGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgaWYgKHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyIHw9IDI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxheWVyLl9wb3N0UmVuZGVyQ291bnRlciB8PSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyTWF4ID0gbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyO1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGxheWVyIGZvciBjdWxsaW5nIHdpdGggdGhlIGNhbWVyYVxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsYXllci5jYW1lcmFzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuaW5zdGFuY2VzLnByZXBhcmUoaik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdlbmVyYXRlIHN0YXRpYyBsaWdodGluZyBmb3IgbWVzaGVzIGluIHRoaXMgbGF5ZXIgaWYgbmVlZGVkXG4gICAgICAgICAgICAvLyBOb3RlOiBTdGF0aWMgbGlnaHRpbmcgaXMgbm90IHVzZWQgd2hlbiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKGxheWVyLl9uZWVkc1N0YXRpY1ByZXBhcmUgJiYgbGF5ZXIuX3N0YXRpY0xpZ2h0SGFzaCAmJiAhdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiByZXVzZSB3aXRoIHRoZSBzYW1lIHN0YXRpY0xpZ2h0SGFzaFxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fc3RhdGljUHJlcGFyZURvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnJldmVydChsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnJldmVydChsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucHJlcGFyZSh0aGlzLmRldmljZSwgc2NlbmUsIGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXMsIGxheWVyLl9saWdodHMpO1xuICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5wcmVwYXJlKHRoaXMuZGV2aWNlLCBzY2VuZSwgbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzLCBsYXllci5fbGlnaHRzKTtcbiAgICAgICAgICAgICAgICBjb21wLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX25lZWRzU3RhdGljUHJlcGFyZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGxheWVyLl9zdGF0aWNQcmVwYXJlRG9uZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgc3RhdGljIGxheWVyIGRhdGEsIGlmIHNvbWV0aGluZydzIGNoYW5nZWRcbiAgICAgICAgY29uc3QgdXBkYXRlZCA9IGNvbXAuX3VwZGF0ZSh0aGlzLmRldmljZSwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lICs9IG5vdygpIC0gbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHJldHVybiB1cGRhdGVkO1xuICAgIH1cblxuICAgIGZyYW1lVXBkYXRlKCkge1xuXG4gICAgICAgIHRoaXMuY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5pbml0Vmlld0JpbmRHcm91cEZvcm1hdCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJfc2tpblVwZGF0ZUluZGV4IiwiYm9uZVRleHR1cmVTaXplIiwidmlld1Byb2pNYXQiLCJNYXQ0Iiwidmlld0ludk1hdCIsInZpZXdNYXQiLCJ2aWV3TWF0MyIsIk1hdDMiLCJ0ZW1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJfZmxpcFlNYXQiLCJzZXRTY2FsZSIsIl9maXhQcm9qUmFuZ2VNYXQiLCJzZXQiLCJfdGVtcFByb2pNYXQwIiwiX3RlbXBQcm9qTWF0MSIsIl90ZW1wUHJvak1hdDIiLCJfdGVtcFByb2pNYXQzIiwiX3RlbXBTZXQiLCJTZXQiLCJSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJjbHVzdGVyc0RlYnVnUmVuZGVyZWQiLCJkZXZpY2UiLCJzY2VuZSIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiTGlnaHRUZXh0dXJlQXRsYXMiLCJzaGFkb3dNYXBDYWNoZSIsIlNoYWRvd01hcENhY2hlIiwic2hhZG93UmVuZGVyZXIiLCJTaGFkb3dSZW5kZXJlciIsIl9zaGFkb3dSZW5kZXJlckxvY2FsIiwiU2hhZG93UmVuZGVyZXJMb2NhbCIsIl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIiwiU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIl9jb29raWVSZW5kZXJlciIsIkNvb2tpZVJlbmRlcmVyIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiX3NraW5UaW1lIiwiX21vcnBoVGltZSIsIl9jdWxsVGltZSIsIl9zaGFkb3dNYXBUaW1lIiwiX2xpZ2h0Q2x1c3RlcnNUaW1lIiwiX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwiX3NoYWRvd0RyYXdDYWxscyIsIl9za2luRHJhd0NhbGxzIiwiX2luc3RhbmNlZERyYXdDYWxscyIsIl9zaGFkb3dNYXBVcGRhdGVzIiwiX251bURyYXdDYWxsc0N1bGxlZCIsIl9jYW1lcmFzUmVuZGVyZWQiLCJfbGlnaHRDbHVzdGVycyIsInNjb3BlIiwiYm9uZVRleHR1cmVJZCIsInJlc29sdmUiLCJib25lVGV4dHVyZVNpemVJZCIsInBvc2VNYXRyaXhJZCIsIm1vZGVsTWF0cml4SWQiLCJub3JtYWxNYXRyaXhJZCIsInZpZXdJbnZJZCIsInZpZXdQb3MiLCJGbG9hdDMyQXJyYXkiLCJ2aWV3UG9zSWQiLCJwcm9qSWQiLCJwcm9qU2t5Ym94SWQiLCJ2aWV3SWQiLCJ2aWV3SWQzIiwidmlld1Byb2pJZCIsImZsaXBZSWQiLCJ0Ym5CYXNpcyIsIm5lYXJDbGlwSWQiLCJmYXJDbGlwSWQiLCJjYW1lcmFQYXJhbXMiLCJjYW1lcmFQYXJhbXNJZCIsImFscGhhVGVzdElkIiwib3BhY2l0eU1hcElkIiwiZXhwb3N1cmVJZCIsInR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkIiwic2V0VmFsdWUiLCJtb3JwaFdlaWdodHNBIiwibW9ycGhXZWlnaHRzQiIsIm1vcnBoUG9zaXRpb25UZXgiLCJtb3JwaE5vcm1hbFRleCIsIm1vcnBoVGV4UGFyYW1zIiwiZGVzdHJveSIsInNvcnRDb21wYXJlIiwiZHJhd0NhbGxBIiwiZHJhd0NhbGxCIiwibGF5ZXIiLCJkcmF3T3JkZXIiLCJ6ZGlzdCIsInpkaXN0MiIsIl9rZXkiLCJTT1JUS0VZX0ZPUldBUkQiLCJzb3J0Q29tcGFyZU1lc2giLCJrZXlBIiwia2V5QiIsIm1lc2giLCJpZCIsInNvcnRDb21wYXJlRGVwdGgiLCJTT1JUS0VZX0RFUFRIIiwic2V0dXBWaWV3cG9ydCIsImNhbWVyYSIsInJlbmRlclRhcmdldCIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwicGl4ZWxXaWR0aCIsIndpZHRoIiwicGl4ZWxIZWlnaHQiLCJoZWlnaHQiLCJyZWN0IiwieCIsIk1hdGgiLCJmbG9vciIsInkiLCJ3IiwieiIsImgiLCJzZXRWaWV3cG9ydCIsIl9zY2lzc29yUmVjdENsZWFyIiwic2Npc3NvclJlY3QiLCJzZXRTY2lzc29yIiwicG9wR3B1TWFya2VyIiwic2V0Q2FtZXJhVW5pZm9ybXMiLCJ0YXJnZXQiLCJmbGlwWSIsInZpZXdDb3VudCIsInhyIiwic2Vzc2lvbiIsInRyYW5zZm9ybSIsInBhcmVudCIsIl9ub2RlIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJ2aWV3cyIsImxlbmd0aCIsInYiLCJ2aWV3Iiwidmlld0ludk9mZk1hdCIsIm11bDIiLCJ2aWV3T2ZmTWF0IiwiY29weSIsImludmVydCIsInNldEZyb21NYXQ0IiwicHJvalZpZXdPZmZNYXQiLCJwcm9qTWF0IiwicG9zaXRpb24iLCJkYXRhIiwiZnJ1c3R1bSIsInByb2plY3Rpb25NYXRyaXgiLCJjYWxjdWxhdGVQcm9qZWN0aW9uIiwiVklFV19DRU5URVIiLCJwcm9qTWF0U2t5Ym94IiwiZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCIsImlzV2ViR1BVIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwicG9zIiwiZ2V0UG9zaXRpb24iLCJyb3QiLCJnZXRSb3RhdGlvbiIsInNldFRSUyIsIlZlYzMiLCJPTkUiLCJkaXNwYXRjaFZpZXdQb3MiLCJuIiwiX25lYXJDbGlwIiwiZiIsIl9mYXJDbGlwIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwicGh5c2ljYWxVbml0cyIsImdldEV4cG9zdXJlIiwiZXhwb3N1cmUiLCJjbGVhciIsImNsZWFyQ29sb3IiLCJjbGVhckRlcHRoIiwiY2xlYXJTdGVuY2lsIiwiZmxhZ3MiLCJfY2xlYXJDb2xvckJ1ZmZlciIsIkNMRUFSRkxBR19DT0xPUiIsIl9jbGVhckRlcHRoQnVmZmVyIiwiQ0xFQVJGTEFHX0RFUFRIIiwiX2NsZWFyU3RlbmNpbEJ1ZmZlciIsIkNMRUFSRkxBR19TVEVOQ0lMIiwiY29sb3IiLCJfY2xlYXJDb2xvciIsInIiLCJnIiwiYiIsImEiLCJkZXB0aCIsIl9jbGVhckRlcHRoIiwic3RlbmNpbCIsIl9jbGVhclN0ZW5jaWwiLCJzZXRDYW1lcmEiLCJyZW5kZXJBY3Rpb24iLCJjbGVhclZpZXciLCJmb3JjZVdyaXRlIiwic2V0UmVuZGVyVGFyZ2V0IiwidXBkYXRlQmVnaW4iLCJzZXRDb2xvcldyaXRlIiwic2V0RGVwdGhXcml0ZSIsIm9wdGlvbnMiLCJfY2xlYXJPcHRpb25zIiwic2V0dXBDdWxsTW9kZSIsImN1bGxGYWNlcyIsImZsaXBGYWN0b3IiLCJkcmF3Q2FsbCIsIm1hdGVyaWFsIiwibW9kZSIsIkNVTExGQUNFX05PTkUiLCJmbGlwRmFjZXMiLCJjdWxsIiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9CQUNLIiwiZmxpcEZhY2VzRmFjdG9yIiwibm9kZSIsIndvcmxkU2NhbGVTaWduIiwic2V0Q3VsbE1vZGUiLCJ1cGRhdGVDYW1lcmFGcnVzdHVtIiwic2V0QmFzZUNvbnN0YW50cyIsIm9wYWNpdHlNYXAiLCJhbHBoYVRlc3QiLCJ1cGRhdGVDcHVTa2luTWF0cmljZXMiLCJkcmF3Q2FsbHMiLCJkcmF3Q2FsbHNDb3VudCIsInNraW5UaW1lIiwibm93IiwiaSIsInNpIiwic2tpbkluc3RhbmNlIiwidXBkYXRlTWF0cmljZXMiLCJfZGlydHkiLCJ1cGRhdGVHcHVTa2luTWF0cmljZXMiLCJjb3VudCIsInZpc2libGVUaGlzRnJhbWUiLCJza2luIiwidXBkYXRlTWF0cml4UGFsZXR0ZSIsInVwZGF0ZU1vcnBoaW5nIiwibW9ycGhUaW1lIiwibW9ycGhJbnN0IiwibW9ycGhJbnN0YW5jZSIsInVwZGF0ZSIsImdwdVVwZGF0ZSIsInNldFZlcnRleEJ1ZmZlcnMiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJ2ZXJ0ZXhCdWZmZXIiLCJzZXRNb3JwaGluZyIsIm1vcnBoIiwidXNlVGV4dHVyZU1vcnBoIiwidmVydGV4QnVmZmVySWRzIiwidGV4dHVyZVBvc2l0aW9ucyIsInRleHR1cmVOb3JtYWxzIiwiX3RleHR1cmVQYXJhbXMiLCJ0IiwiX2FjdGl2ZVZlcnRleEJ1ZmZlcnMiLCJ2YiIsInNlbWFudGljIiwiU0VNQU5USUNfQVRUUiIsImZvcm1hdCIsImVsZW1lbnRzIiwibmFtZSIsInNjb3BlSWQiLCJfc2hhZGVyTW9ycGhXZWlnaHRzQSIsIl9zaGFkZXJNb3JwaFdlaWdodHNCIiwic2V0U2tpbm5pbmciLCJtZXNoSW5zdGFuY2UiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsImJvbmVUZXh0dXJlIiwibWF0cml4UGFsZXR0ZSIsInZwIiwiaW5pdFZpZXdCaW5kR3JvdXBGb3JtYXQiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJCaW5kVGV4dHVyZUZvcm1hdCIsIlRFWFRVUkVESU1FTlNJT05fMkQiLCJTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCIsInNldHVwVmlld1VuaWZvcm1CdWZmZXJzIiwidmlld0JpbmRHcm91cHMiLCJEZWJ1ZyIsImFzc2VydCIsIkFycmF5IiwiaXNBcnJheSIsInViIiwiVW5pZm9ybUJ1ZmZlciIsImJnIiwiQmluZEdyb3VwIiwiRGVidWdIZWxwZXIiLCJzZXROYW1lIiwicHVzaCIsInZpZXdCaW5kR3JvdXAiLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsInNldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9WSUVXIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJwYXNzIiwid29ybGRUcmFuc2Zvcm0iLCJub3JtYWxNYXRyaXgiLCJtZXNoQmluZEdyb3VwIiwiZ2V0QmluZEdyb3VwIiwiQklOREdST1VQX01FU0giLCJkcmF3SW5zdGFuY2UiLCJzdHlsZSIsIm5vcm1hbCIsImluc3RhbmNpbmdEYXRhIiwiZHJhdyIsInByaW1pdGl2ZSIsIm1vZGVsTWF0cml4IiwiZHJhd0luc3RhbmNlMiIsInVuZGVmaW5lZCIsInZpc2libGVMaXN0IiwiY3VsbFRpbWUiLCJudW1EcmF3Q2FsbHNDdWxsZWQiLCJ2aXNpYmxlTGVuZ3RoIiwiY3VsbGluZ01hc2siLCJmcnVzdHVtQ3VsbGluZyIsInZpc2libGUiLCJjb21tYW5kIiwibWFzayIsIl9pc1Zpc2libGUiLCJjdWxsTGlnaHRzIiwibGlnaHRzIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHQiLCJlbmFibGVkIiwiX3R5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJnZXRCb3VuZGluZ1NwaGVyZSIsImNvbnRhaW5zU3BoZXJlIiwidXNlUGh5c2ljYWxVbml0cyIsInNjcmVlblNpemUiLCJnZXRTY3JlZW5TaXplIiwibWF4U2NyZWVuU2l6ZSIsIm1heCIsImNhc3RTaGFkb3dzIiwic2hhZG93TWFwIiwiY3VsbFNoYWRvd21hcHMiLCJjb21wIiwiaXNDbHVzdGVyZWQiLCJfbGlnaHRzIiwiYXRsYXNTbG90VXBkYXRlZCIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfTk9ORSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJjYXN0ZXJzIiwiX2xpZ2h0Q29tcG9zaXRpb25EYXRhIiwic2hhZG93Q2FzdGVyc0xpc3QiLCJyZW5kZXJBY3Rpb25zIiwiX3JlbmRlckFjdGlvbnMiLCJkaXJlY3Rpb25hbExpZ2h0c0luZGljZXMiLCJqIiwibGlnaHRJbmRleCIsImN1bGxDb21wb3NpdGlvbiIsImxheWVySW5kZXgiLCJsYXllckxpc3QiLCJzdWJMYXllckVuYWJsZWQiLCJ0cmFuc3BhcmVudCIsInN1YkxheWVyTGlzdCIsImNhbWVyYVBhc3MiLCJjYW1lcmFJbmRleCIsImNhbWVyYXMiLCJmcmFtZVVwZGF0ZSIsImZpcnN0Q2FtZXJhVXNlIiwib2JqZWN0cyIsImluc3RhbmNlcyIsInZpc2libGVUcmFuc3BhcmVudCIsInZpc2libGVPcGFxdWUiLCJkb25lIiwib25QcmVDdWxsIiwidHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIiwib3BhcXVlTWVzaEluc3RhbmNlcyIsImxpc3QiLCJvblBvc3RDdWxsIiwidXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMiLCJ1cGRhdGVTaGFkZXJzIiwib25seUxpdFNoYWRlcnMiLCJtYXQiLCJoYXMiLCJhZGQiLCJnZXRTaGFkZXJWYXJpYW50IiwiTWF0ZXJpYWwiLCJwcm90b3R5cGUiLCJ1c2VMaWdodGluZyIsImVtaXR0ZXIiLCJsaWdodGluZyIsImNsZWFyVmFyaWFudHMiLCJyZW5kZXJDb29raWVzIiwiY29va2llUmVuZGVyVGFyZ2V0IiwiYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCIsInJlbmRlciIsImJlZ2luRnJhbWUiLCJsaWdodHNDaGFuZ2VkIiwibWVzaEluc3RhbmNlcyIsIl9tZXNoSW5zdGFuY2VzIiwiX3NoYWRlclZlcnNpb24iLCJtaUNvdW50IiwibGlnaHRDb3VudCIsIl9zcGxpdExpZ2h0cyIsIkxJR0hUVFlQRV9TUE9UIiwiTElHSFRUWVBFX09NTkkiLCJ1cGRhdGVDbHVzdGVycyIsInN0YXJ0VGltZSIsImVtcHR5V29ybGRDbHVzdGVycyIsImdldEVtcHR5V29ybGRDbHVzdGVycyIsImNsdXN0ZXIiLCJsaWdodENsdXN0ZXJzIiwiY2x1c3RlcmVkTGlnaHRzU2V0IiwiZ2FtbWFDb3JyZWN0aW9uIiwiX3dvcmxkQ2x1c3RlcnMiLCJ1cGRhdGVMYXllckNvbXBvc2l0aW9uIiwibGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJsZW4iLCJfcG9zdFJlbmRlckNvdW50ZXIiLCJzaGFkZXJWZXJzaW9uIiwiX3NraXBSZW5kZXJDb3VudGVyIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJfcmVuZGVyVGltZSIsIl9wcmVSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzIiwiX3Bvc3RSZW5kZXJDb3VudGVyTWF4IiwicHJlcGFyZSIsIl9uZWVkc1N0YXRpY1ByZXBhcmUiLCJfc3RhdGljTGlnaHRIYXNoIiwiX3N0YXRpY1ByZXBhcmVEb25lIiwiU3RhdGljTWVzaGVzIiwicmV2ZXJ0IiwidXBkYXRlZCIsIl91cGRhdGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNDQSxJQUFJQSxnQkFBZ0IsR0FBRyxDQUFDLENBQUE7QUFDeEIsTUFBTUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDcEMsTUFBTUMsV0FBVyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzlCLE1BQU1DLFVBQVUsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUM3QixNQUFNRSxPQUFPLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDMUIsTUFBTUcsUUFBUSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzNC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
