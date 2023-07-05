import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_FRONT, CULLFACE_BACK, CULLFACE_NONE, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT3, UNIFORMTYPE_VEC3, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_INT, BINDGROUP_VIEW, BINDGROUP_MESH, SEMANTIC_ATTR, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
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
  /**
   * Create a new instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device used by the renderer.
   */
  constructor(graphicsDevice) {
    /** @type {boolean} */
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
  initViewBindGroupFormat(isClustered) {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      // format of the view uniform buffer
      const uniforms = [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4), new UniformFormat("cubeMapRotationMatrix", UNIFORMTYPE_MAT3), new UniformFormat("view_position", UNIFORMTYPE_VEC3), new UniformFormat("skyboxIntensity", UNIFORMTYPE_FLOAT), new UniformFormat("exposure", UNIFORMTYPE_FLOAT), new UniformFormat("textureBias", UNIFORMTYPE_FLOAT)];
      if (isClustered) {
        uniforms.push(...[new UniformFormat("clusterCellsCountByBoundsSize", UNIFORMTYPE_VEC3), new UniformFormat("clusterTextureSize", UNIFORMTYPE_VEC3), new UniformFormat("clusterBoundsMin", UNIFORMTYPE_VEC3), new UniformFormat("clusterBoundsDelta", UNIFORMTYPE_VEC3), new UniformFormat("clusterCellsDot", UNIFORMTYPE_VEC3), new UniformFormat("clusterCellsMax", UNIFORMTYPE_VEC3), new UniformFormat("clusterCompressionLimit0", UNIFORMTYPE_VEC2), new UniformFormat("shadowAtlasParams", UNIFORMTYPE_VEC2), new UniformFormat("clusterMaxCells", UNIFORMTYPE_INT), new UniformFormat("clusterSkip", UNIFORMTYPE_FLOAT)]);
      }
      this.viewUniformFormat = new UniformBufferFormat(this.device, uniforms);

      // format of the view bind group - contains single uniform buffer, and some textures
      const buffers = [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)];
      const textures = [new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('shadowAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH), new BindTextureFormat('cookieAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT), new BindTextureFormat('areaLightsLutTex1', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT), new BindTextureFormat('areaLightsLutTex2', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT)];
      if (isClustered) {
        textures.push(...[new BindTextureFormat('clusterWorldTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
      }
      this.viewBindGroupFormat = new BindGroupFormat(this.device, buffers, textures);
    }
  }
  setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {
    Debug.assert(Array.isArray(viewBindGroups), "viewBindGroups must be an array");
    const device = this.device;
    Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");
    while (viewBindGroups.length < viewCount) {
      const ub = new UniformBuffer(device, viewUniformFormat, false);
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
    this.initViewBindGroupFormat(this.scene.clusteredLightingEnabled);
  }
}

export { Renderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9yZW5kZXJlci9yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgTWF0MyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctc3BoZXJlLmpzJztcblxuaW1wb3J0IHtcbiAgICBTT1JUS0VZX0RFUFRILCBTT1JUS0VZX0ZPUldBUkQsXG4gICAgVklFV19DRU5URVIsIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodFRleHR1cmVBdGxhcyB9IGZyb20gJy4uL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQge1xuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBCSU5ER1JPVVBfTUVTSCwgQklOREdST1VQX1ZJRVcsIFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FLFxuICAgIFVOSUZPUk1UWVBFX01BVDQsIFVOSUZPUk1UWVBFX01BVDMsIFVOSUZPUk1UWVBFX1ZFQzMsIFVOSUZPUk1UWVBFX1ZFQzIsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9JTlQsXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBTRU1BTlRJQ19BVFRSLFxuICAgIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX0ZST05ULCBDVUxMRkFDRV9OT05FLFxuICAgIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FULCBTQU1QTEVUWVBFX0ZMT0FULCBTQU1QTEVUWVBFX0RFUFRIXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBCaW5kR3JvdXBGb3JtYXQsIEJpbmRCdWZmZXJGb3JtYXQsIEJpbmRUZXh0dXJlRm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnO1xuXG5pbXBvcnQgeyBTaGFkb3dNYXBDYWNoZSB9IGZyb20gJy4vc2hhZG93LW1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlckxvY2FsIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXItbG9jYWwuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCB9IGZyb20gJy4vc2hhZG93LXJlbmRlcmVyLWRpcmVjdGlvbmFsLmpzJztcbmltcG9ydCB7IENvb2tpZVJlbmRlcmVyIH0gZnJvbSAnLi9jb29raWUtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgU3RhdGljTWVzaGVzIH0gZnJvbSAnLi9zdGF0aWMtbWVzaGVzLmpzJztcbmltcG9ydCB7IFNoYWRvd1JlbmRlcmVyIH0gZnJvbSAnLi9zaGFkb3ctcmVuZGVyZXIuanMnO1xuXG5sZXQgX3NraW5VcGRhdGVJbmRleCA9IDA7XG5jb25zdCBib25lVGV4dHVyZVNpemUgPSBbMCwgMCwgMCwgMF07XG5jb25zdCB2aWV3UHJvak1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB2aWV3SW52TWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHZpZXdNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3Qgdmlld01hdDMgPSBuZXcgTWF0MygpO1xuY29uc3QgdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX2ZsaXBZTWF0ID0gbmV3IE1hdDQoKS5zZXRTY2FsZSgxLCAtMSwgMSk7XG5cbi8vIENvbnZlcnRzIGEgcHJvamVjdGlvbiBtYXRyaXggaW4gT3BlbkdMIHN0eWxlIChkZXB0aCByYW5nZSBvZiAtMS4uMSkgdG8gYSBEaXJlY3RYIHN0eWxlIChkZXB0aCByYW5nZSBvZiAwLi4xKS5cbmNvbnN0IF9maXhQcm9qUmFuZ2VNYXQgPSBuZXcgTWF0NCgpLnNldChbXG4gICAgMSwgMCwgMCwgMCxcbiAgICAwLCAxLCAwLCAwLFxuICAgIDAsIDAsIDAuNSwgMCxcbiAgICAwLCAwLCAwLjUsIDFcbl0pO1xuXG5jb25zdCBfdGVtcFByb2pNYXQwID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wUHJvak1hdDEgPSBuZXcgTWF0NCgpO1xuY29uc3QgX3RlbXBQcm9qTWF0MiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBfdGVtcFByb2pNYXQzID0gbmV3IE1hdDQoKTtcbmNvbnN0IF90ZW1wU2V0ID0gbmV3IFNldCgpO1xuXG4vKipcbiAqIFRoZSBiYXNlIHJlbmRlcmVyIGZ1bmN0aW9uYWxpdHkgdG8gYWxsb3cgaW1wbGVtZW50YXRpb24gb2Ygc3BlY2lhbGl6ZWQgcmVuZGVyZXJzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgUmVuZGVyZXIge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBjbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgcmVuZGVyZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZXxudWxsfSAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICAvLyB0ZXh0dXJlIGF0bGFzIG1hbmFnaW5nIHNoYWRvdyBtYXAgLyBjb29raWUgdGV4dHVyZSBhdGxhc3NpbmcgZm9yIG9tbmkgYW5kIHNwb3QgbGlnaHRzXG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMgPSBuZXcgTGlnaHRUZXh0dXJlQXRsYXMoZ3JhcGhpY3NEZXZpY2UpO1xuXG4gICAgICAgIC8vIHNoYWRvd3NcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IG5ldyBTaGFkb3dNYXBDYWNoZSgpO1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyID0gbmV3IFNoYWRvd1JlbmRlcmVyKHRoaXMsIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMpO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJlckxvY2FsID0gbmV3IFNoYWRvd1JlbmRlcmVyTG9jYWwodGhpcywgdGhpcy5zaGFkb3dSZW5kZXJlcik7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgPSBuZXcgU2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCh0aGlzLCB0aGlzLnNoYWRvd1JlbmRlcmVyKTtcblxuICAgICAgICAvLyBjb29raWVzXG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbmV3IENvb2tpZVJlbmRlcmVyKGdyYXBoaWNzRGV2aWNlLCB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzKTtcblxuICAgICAgICAvLyB2aWV3IGJpbmQgZ3JvdXAgZm9ybWF0IHdpdGggaXRzIHVuaWZvcm0gYnVmZmVyIGZvcm1hdFxuICAgICAgICB0aGlzLnZpZXdVbmlmb3JtRm9ybWF0ID0gbnVsbDtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3VwRm9ybWF0ID0gbnVsbDtcblxuICAgICAgICAvLyB0aW1pbmdcbiAgICAgICAgdGhpcy5fc2tpblRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9tb3JwaFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9saWdodENsdXN0ZXJzVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcblxuICAgICAgICAvLyBzdGF0c1xuICAgICAgICB0aGlzLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuX251bURyYXdDYWxsc0N1bGxlZCA9IDA7XG4gICAgICAgIHRoaXMuX2NhbWVyYXNSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnMgPSAwO1xuXG4gICAgICAgIC8vIFVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHNjb3BlID0gZ3JhcGhpY3NEZXZpY2Uuc2NvcGU7XG4gICAgICAgIHRoaXMuYm9uZVRleHR1cmVJZCA9IHNjb3BlLnJlc29sdmUoJ3RleHR1cmVfcG9zZU1hcCcpO1xuICAgICAgICB0aGlzLmJvbmVUZXh0dXJlU2l6ZUlkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9wb3NlTWFwU2l6ZScpO1xuICAgICAgICB0aGlzLnBvc2VNYXRyaXhJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wb3NlWzBdJyk7XG5cbiAgICAgICAgdGhpcy5tb2RlbE1hdHJpeElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X21vZGVsJyk7XG4gICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfbm9ybWFsJyk7XG4gICAgICAgIHRoaXMudmlld0ludklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdJbnZlcnNlJyk7XG4gICAgICAgIHRoaXMudmlld1BvcyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMudmlld1Bvc0lkID0gc2NvcGUucmVzb2x2ZSgndmlld19wb3NpdGlvbicpO1xuICAgICAgICB0aGlzLnByb2pJZCA9IHNjb3BlLnJlc29sdmUoJ21hdHJpeF9wcm9qZWN0aW9uJyk7XG4gICAgICAgIHRoaXMucHJvalNreWJveElkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3Byb2plY3Rpb25Ta3lib3gnKTtcbiAgICAgICAgdGhpcy52aWV3SWQgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlldycpO1xuICAgICAgICB0aGlzLnZpZXdJZDMgPSBzY29wZS5yZXNvbHZlKCdtYXRyaXhfdmlldzMnKTtcbiAgICAgICAgdGhpcy52aWV3UHJvaklkID0gc2NvcGUucmVzb2x2ZSgnbWF0cml4X3ZpZXdQcm9qZWN0aW9uJyk7XG4gICAgICAgIHRoaXMuZmxpcFlJZCA9IHNjb3BlLnJlc29sdmUoJ3Byb2plY3Rpb25GbGlwWScpO1xuICAgICAgICB0aGlzLnRibkJhc2lzID0gc2NvcGUucmVzb2x2ZSgndGJuQmFzaXMnKTtcbiAgICAgICAgdGhpcy5uZWFyQ2xpcElkID0gc2NvcGUucmVzb2x2ZSgnY2FtZXJhX25lYXInKTtcbiAgICAgICAgdGhpcy5mYXJDbGlwSWQgPSBzY29wZS5yZXNvbHZlKCdjYW1lcmFfZmFyJyk7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNJZCA9IHNjb3BlLnJlc29sdmUoJ2NhbWVyYV9wYXJhbXMnKTtcblxuICAgICAgICB0aGlzLmFscGhhVGVzdElkID0gc2NvcGUucmVzb2x2ZSgnYWxwaGFfcmVmJyk7XG4gICAgICAgIHRoaXMub3BhY2l0eU1hcElkID0gc2NvcGUucmVzb2x2ZSgndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG5cbiAgICAgICAgdGhpcy5leHBvc3VyZUlkID0gc2NvcGUucmVzb2x2ZSgnZXhwb3N1cmUnKTtcbiAgICAgICAgdGhpcy50d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZCA9IHNjb3BlLnJlc29sdmUoJ3R3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcicpO1xuICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKDApO1xuXG4gICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQSA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3dlaWdodHNfYScpO1xuICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0IgPSBzY29wZS5yZXNvbHZlKCdtb3JwaF93ZWlnaHRzX2InKTtcbiAgICAgICAgdGhpcy5tb3JwaFBvc2l0aW9uVGV4ID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhQb3NpdGlvblRleCcpO1xuICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4ID0gc2NvcGUucmVzb2x2ZSgnbW9ycGhOb3JtYWxUZXgnKTtcbiAgICAgICAgdGhpcy5tb3JwaFRleFBhcmFtcyA9IHNjb3BlLnJlc29sdmUoJ21vcnBoX3RleF9wYXJhbXMnKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnNoYWRvd1JlbmRlcmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jb29raWVSZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmxpZ2h0VGV4dHVyZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgc29ydENvbXBhcmUoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QyICYmIGRyYXdDYWxsQi56ZGlzdDIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0MiAtIGRyYXdDYWxsQi56ZGlzdDI7IC8vIGZyb250IHRvIGJhY2tcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdIC0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZU1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICAgICAgaWYgKGRyYXdDYWxsQS5sYXllciA9PT0gZHJhd0NhbGxCLmxheWVyKSB7XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGxBLmRyYXdPcmRlciAmJiBkcmF3Q2FsbEIuZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkcmF3Q2FsbEEuemRpc3QgJiYgZHJhd0NhbGxCLnpkaXN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDsgLy8gYmFjayB0byBmcm9udFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgICAgIGNvbnN0IGtleUIgPSBkcmF3Q2FsbEIuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICBzb3J0Q29tcGFyZURlcHRoKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgICAgIGNvbnN0IGtleUEgPSBkcmF3Q2FsbEEuX2tleVtTT1JUS0VZX0RFUFRIXTtcbiAgICAgICAgY29uc3Qga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfREVQVEhdO1xuXG4gICAgICAgIGlmIChrZXlBID09PSBrZXlCICYmIGRyYXdDYWxsQS5tZXNoICYmIGRyYXdDYWxsQi5tZXNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdXAgdGhlIHZpZXdwb3J0IGFuZCB0aGUgc2Npc3NvciBmb3IgY2FtZXJhIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jYW1lcmEuanMnKS5DYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgY29udGFpbmluZyB0aGUgdmlld3BvcnRcbiAgICAgKiBpbmZvcm1hdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gW3JlbmRlclRhcmdldF0gLSBUaGVcbiAgICAgKiByZW5kZXIgdGFyZ2V0LiBOVUxMIGZvciB0aGUgZGVmYXVsdCBvbmUuXG4gICAgICovXG4gICAgc2V0dXBWaWV3cG9ydChjYW1lcmEsIHJlbmRlclRhcmdldCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnU0VUVVAtVklFV1BPUlQnKTtcblxuICAgICAgICBjb25zdCBwaXhlbFdpZHRoID0gcmVuZGVyVGFyZ2V0ID8gcmVuZGVyVGFyZ2V0LndpZHRoIDogZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBwaXhlbEhlaWdodCA9IHJlbmRlclRhcmdldCA/IHJlbmRlclRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IHJlY3QgPSBjYW1lcmEucmVjdDtcbiAgICAgICAgbGV0IHggPSBNYXRoLmZsb29yKHJlY3QueCAqIHBpeGVsV2lkdGgpO1xuICAgICAgICBsZXQgeSA9IE1hdGguZmxvb3IocmVjdC55ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICBsZXQgdyA9IE1hdGguZmxvb3IocmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgIGxldCBoID0gTWF0aC5mbG9vcihyZWN0LncgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgIGRldmljZS5zZXRWaWV3cG9ydCh4LCB5LCB3LCBoKTtcblxuICAgICAgICAvLyB1c2Ugdmlld3BvcnQgcmVjdGFuZ2xlIGJ5IGRlZmF1bHQuIFVzZSBzY2lzc29yIHJlY3RhbmdsZSB3aGVuIHJlcXVpcmVkLlxuICAgICAgICBpZiAoY2FtZXJhLl9zY2lzc29yUmVjdENsZWFyKSB7XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yUmVjdCA9IGNhbWVyYS5zY2lzc29yUmVjdDtcbiAgICAgICAgICAgIHggPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnggKiBwaXhlbFdpZHRoKTtcbiAgICAgICAgICAgIHkgPSBNYXRoLmZsb29yKHNjaXNzb3JSZWN0LnkgKiBwaXhlbEhlaWdodCk7XG4gICAgICAgICAgICB3ID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC56ICogcGl4ZWxXaWR0aCk7XG4gICAgICAgICAgICBoID0gTWF0aC5mbG9vcihzY2lzc29yUmVjdC53ICogcGl4ZWxIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICAgIGRldmljZS5zZXRTY2lzc29yKHgsIHksIHcsIGgpO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpIHtcblxuICAgICAgICAvLyBmbGlwcGluZyBwcm9qIG1hdHJpeFxuICAgICAgICBjb25zdCBmbGlwWSA9IHRhcmdldD8uZmxpcFk7XG5cbiAgICAgICAgbGV0IHZpZXdDb3VudCA9IDE7XG4gICAgICAgIGlmIChjYW1lcmEueHIgJiYgY2FtZXJhLnhyLnNlc3Npb24pIHtcbiAgICAgICAgICAgIGxldCB0cmFuc2Zvcm07XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBjYW1lcmEuX25vZGUucGFyZW50O1xuICAgICAgICAgICAgaWYgKHBhcmVudClcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm0gPSBwYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgY29uc3Qgdmlld3MgPSBjYW1lcmEueHIudmlld3M7XG4gICAgICAgICAgICB2aWV3Q291bnQgPSB2aWV3cy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IHZpZXdDb3VudDsgdisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmlldyA9IHZpZXdzW3ZdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnZpZXdJbnZPZmZNYXQubXVsMih0cmFuc2Zvcm0sIHZpZXcudmlld0ludk1hdCk7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcudmlld09mZk1hdC5jb3B5KHZpZXcudmlld0ludk9mZk1hdCkuaW52ZXJ0KCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3SW52T2ZmTWF0LmNvcHkodmlldy52aWV3SW52TWF0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy52aWV3T2ZmTWF0LmNvcHkodmlldy52aWV3TWF0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2aWV3LnZpZXdNYXQzLnNldEZyb21NYXQ0KHZpZXcudmlld09mZk1hdCk7XG4gICAgICAgICAgICAgICAgdmlldy5wcm9qVmlld09mZk1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcblxuICAgICAgICAgICAgICAgIHZpZXcucG9zaXRpb25bMF0gPSB2aWV3LnZpZXdJbnZPZmZNYXQuZGF0YVsxMl07XG4gICAgICAgICAgICAgICAgdmlldy5wb3NpdGlvblsxXSA9IHZpZXcudmlld0ludk9mZk1hdC5kYXRhWzEzXTtcbiAgICAgICAgICAgICAgICB2aWV3LnBvc2l0aW9uWzJdID0gdmlldy52aWV3SW52T2ZmTWF0LmRhdGFbMTRdO1xuXG4gICAgICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlldy5wcm9qVmlld09mZk1hdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIFByb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICBsZXQgcHJvak1hdCA9IGNhbWVyYS5wcm9qZWN0aW9uTWF0cml4O1xuICAgICAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVByb2plY3Rpb24ocHJvak1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHByb2pNYXRTa3lib3ggPSBjYW1lcmEuZ2V0UHJvamVjdGlvbk1hdHJpeFNreWJveCgpO1xuXG4gICAgICAgICAgICAvLyBmbGlwIHByb2plY3Rpb24gbWF0cmljZXNcbiAgICAgICAgICAgIGlmIChmbGlwWSkge1xuICAgICAgICAgICAgICAgIHByb2pNYXQgPSBfdGVtcFByb2pNYXQwLm11bDIoX2ZsaXBZTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0MS5tdWwyKF9mbGlwWU1hdCwgcHJvak1hdFNreWJveCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBkZXB0aCByYW5nZSBvZiBwcm9qZWN0aW9uIG1hdHJpY2VzICgtMS4uMSB0byAwLi4xKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgcHJvak1hdCA9IF90ZW1wUHJvak1hdDIubXVsMihfZml4UHJvalJhbmdlTWF0LCBwcm9qTWF0KTtcbiAgICAgICAgICAgICAgICBwcm9qTWF0U2t5Ym94ID0gX3RlbXBQcm9qTWF0My5tdWwyKF9maXhQcm9qUmFuZ2VNYXQsIHByb2pNYXRTa3lib3gpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnByb2pJZC5zZXRWYWx1ZShwcm9qTWF0LmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5wcm9qU2t5Ym94SWQuc2V0VmFsdWUocHJvak1hdFNreWJveC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld0ludmVyc2UgTWF0cml4XG4gICAgICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYS5jYWxjdWxhdGVUcmFuc2Zvcm0odmlld0ludk1hdCwgVklFV19DRU5URVIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBjYW1lcmEuX25vZGUuZ2V0Um90YXRpb24oKTtcbiAgICAgICAgICAgICAgICB2aWV3SW52TWF0LnNldFRSUyhwb3MsIHJvdCwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52aWV3SW52SWQuc2V0VmFsdWUodmlld0ludk1hdC5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlldyBNYXRyaXhcbiAgICAgICAgICAgIHZpZXdNYXQuY29weSh2aWV3SW52TWF0KS5pbnZlcnQoKTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkLnNldFZhbHVlKHZpZXdNYXQuZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZpZXcgM3gzXG4gICAgICAgICAgICB2aWV3TWF0My5zZXRGcm9tTWF0NCh2aWV3TWF0KTtcbiAgICAgICAgICAgIHRoaXMudmlld0lkMy5zZXRWYWx1ZSh2aWV3TWF0My5kYXRhKTtcblxuICAgICAgICAgICAgLy8gVmlld1Byb2plY3Rpb24gTWF0cml4XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHByb2pNYXQsIHZpZXdNYXQpO1xuICAgICAgICAgICAgdGhpcy52aWV3UHJvaklkLnNldFZhbHVlKHZpZXdQcm9qTWF0LmRhdGEpO1xuXG4gICAgICAgICAgICB0aGlzLmZsaXBZSWQuc2V0VmFsdWUoZmxpcFkgPyAtMSA6IDEpO1xuXG4gICAgICAgICAgICAvLyBWaWV3IFBvc2l0aW9uICh3b3JsZCBzcGFjZSlcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hWaWV3UG9zKGNhbWVyYS5fbm9kZS5nZXRQb3NpdGlvbigpKTtcblxuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW0uc2V0RnJvbU1hdDQodmlld1Byb2pNYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50Ym5CYXNpcy5zZXRWYWx1ZShmbGlwWSA/IC0xIDogMSk7XG5cbiAgICAgICAgLy8gTmVhciBhbmQgZmFyIGNsaXAgdmFsdWVzXG4gICAgICAgIGNvbnN0IG4gPSBjYW1lcmEuX25lYXJDbGlwO1xuICAgICAgICBjb25zdCBmID0gY2FtZXJhLl9mYXJDbGlwO1xuICAgICAgICB0aGlzLm5lYXJDbGlwSWQuc2V0VmFsdWUobik7XG4gICAgICAgIHRoaXMuZmFyQ2xpcElkLnNldFZhbHVlKGYpO1xuXG4gICAgICAgIC8vIGNhbWVyYSBwYXJhbXNcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMF0gPSAxIC8gZjtcbiAgICAgICAgdGhpcy5jYW1lcmFQYXJhbXNbMV0gPSBmO1xuICAgICAgICB0aGlzLmNhbWVyYVBhcmFtc1syXSA9IG47XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zWzNdID0gY2FtZXJhLnByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID8gMSA6IDA7XG4gICAgICAgIHRoaXMuY2FtZXJhUGFyYW1zSWQuc2V0VmFsdWUodGhpcy5jYW1lcmFQYXJhbXMpO1xuXG4gICAgICAgIC8vIGV4cG9zdXJlXG4gICAgICAgIHRoaXMuZXhwb3N1cmVJZC5zZXRWYWx1ZSh0aGlzLnNjZW5lLnBoeXNpY2FsVW5pdHMgPyBjYW1lcmEuZ2V0RXhwb3N1cmUoKSA6IHRoaXMuc2NlbmUuZXhwb3N1cmUpO1xuXG4gICAgICAgIHJldHVybiB2aWV3Q291bnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgdGhlIHZpZXdwb3J0IGlzIGFscmVhZHkgc2V0IHVwLCBvbmx5IGl0cyBhcmVhIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY2FtZXJhLmpzJykuQ2FtZXJhfSBjYW1lcmEgLSBUaGUgY2FtZXJhIHN1cHBseWluZyB0aGUgdmFsdWUgdG8gY2xlYXIgdG8uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY2xlYXJDb2xvcl0gLSBUcnVlIGlmIHRoZSBjb2xvciBidWZmZXIgc2hvdWxkIGJlIGNsZWFyZWQuIFVzZXMgdGhlIHZhbHVlXG4gICAgICogZnJvbSB0aGUgY2FtcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NsZWFyRGVwdGhdIC0gVHJ1ZSBpZiB0aGUgZGVwdGggYnVmZmVyIHNob3VsZCBiZSBjbGVhcmVkLiBVc2VzIHRoZSB2YWx1ZVxuICAgICAqIGZyb20gdGhlIGNhbXJhIGlmIG5vdCBzdXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjbGVhclN0ZW5jaWxdIC0gVHJ1ZSBpZiB0aGUgc3RlbmNpbCBidWZmZXIgc2hvdWxkIGJlIGNsZWFyZWQuIFVzZXMgdGhlXG4gICAgICogdmFsdWUgZnJvbSB0aGUgY2FtcmEgaWYgbm90IHN1cHBsaWVkLlxuICAgICAqL1xuICAgIGNsZWFyKGNhbWVyYSwgY2xlYXJDb2xvciwgY2xlYXJEZXB0aCwgY2xlYXJTdGVuY2lsKSB7XG5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSAoKGNsZWFyQ29sb3IgPz8gY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyKSA/IENMRUFSRkxBR19DT0xPUiA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAoKGNsZWFyRGVwdGggPz8gY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyKSA/IENMRUFSRkxBR19ERVBUSCA6IDApIHxcbiAgICAgICAgICAgICAgICAgICAgICAoKGNsZWFyU3RlbmNpbCA/PyBjYW1lcmEuX2NsZWFyU3RlbmNpbEJ1ZmZlcikgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApO1xuXG4gICAgICAgIGlmIChmbGFncykge1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnQ0xFQVInKTtcblxuICAgICAgICAgICAgZGV2aWNlLmNsZWFyKHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBmbGFnc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYWtlIHN1cmUgY29sb3JXcml0ZSBpcyBzZXQgdG8gdHJ1ZSB0byBhbGwgY2hhbm5lbHMsIGlmIHlvdSB3YW50IHRvIGZ1bGx5IGNsZWFyIHRoZSB0YXJnZXRcbiAgICAvLyBUT0RPOiB0aGlzIGZ1bmN0aW9uIGlzIG9ubHkgdXNlZCBmcm9tIG91dHNpZGUgb2YgZm9yd2FyZCByZW5kZXJlciwgYW5kIHNob3VsZCBiZSBkZXByZWNhdGVkXG4gICAgLy8gd2hlbiB0aGUgZnVuY3Rpb25hbGl0eSBtb3ZlcyB0byB0aGUgcmVuZGVyIHBhc3Nlcy4gTm90ZSB0aGF0IEVkaXRvciB1c2VzIGl0IGFzIHdlbGwuXG4gICAgc2V0Q2FtZXJhKGNhbWVyYSwgdGFyZ2V0LCBjbGVhciwgcmVuZGVyQWN0aW9uID0gbnVsbCkge1xuXG4gICAgICAgIHRoaXMuc2V0Q2FtZXJhVW5pZm9ybXMoY2FtZXJhLCB0YXJnZXQpO1xuICAgICAgICB0aGlzLmNsZWFyVmlldyhjYW1lcmEsIHRhcmdldCwgY2xlYXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB0aGlzIGlzIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBsaWdodG1hcHBlciBhbmQgdGhlIEVkaXRvcixcbiAgICAvLyBhbmQgd2lsbCBiZSByZW1vdmVkIHdoZW4gdGhvc2UgY2FsbCBhcmUgcmVtb3ZlZC5cbiAgICBjbGVhclZpZXcoY2FtZXJhLCB0YXJnZXQsIGNsZWFyLCBmb3JjZVdyaXRlKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1WSUVXJyk7XG5cbiAgICAgICAgZGV2aWNlLnNldFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgICAgICBkZXZpY2UudXBkYXRlQmVnaW4oKTtcblxuICAgICAgICBpZiAoZm9yY2VXcml0ZSkge1xuICAgICAgICAgICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZSh0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0dXBWaWV3cG9ydChjYW1lcmEsIHRhcmdldCk7XG5cbiAgICAgICAgaWYgKGNsZWFyKSB7XG5cbiAgICAgICAgICAgIC8vIHVzZSBjYW1lcmEgY2xlYXIgb3B0aW9ucyBpZiBhbnlcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSBjYW1lcmEuX2NsZWFyT3B0aW9ucztcbiAgICAgICAgICAgIGRldmljZS5jbGVhcihvcHRpb25zID8gb3B0aW9ucyA6IHtcbiAgICAgICAgICAgICAgICBjb2xvcjogW2NhbWVyYS5fY2xlYXJDb2xvci5yLCBjYW1lcmEuX2NsZWFyQ29sb3IuZywgY2FtZXJhLl9jbGVhckNvbG9yLmIsIGNhbWVyYS5fY2xlYXJDb2xvci5hXSxcbiAgICAgICAgICAgICAgICBkZXB0aDogY2FtZXJhLl9jbGVhckRlcHRoLFxuICAgICAgICAgICAgICAgIGZsYWdzOiAoY2FtZXJhLl9jbGVhckNvbG9yQnVmZmVyID8gQ0xFQVJGTEFHX0NPTE9SIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhckRlcHRoQnVmZmVyID8gQ0xFQVJGTEFHX0RFUFRIIDogMCkgfFxuICAgICAgICAgICAgICAgICAgICAgICAoY2FtZXJhLl9jbGVhclN0ZW5jaWxCdWZmZXIgPyBDTEVBUkZMQUdfU1RFTkNJTCA6IDApLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGNhbWVyYS5fY2xlYXJTdGVuY2lsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0dXBDdWxsTW9kZShjdWxsRmFjZXMsIGZsaXBGYWN0b3IsIGRyYXdDYWxsKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gZHJhd0NhbGwubWF0ZXJpYWw7XG4gICAgICAgIGxldCBtb2RlID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgaWYgKGN1bGxGYWNlcykge1xuICAgICAgICAgICAgbGV0IGZsaXBGYWNlcyA9IDE7XG5cbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9GUk9OVCB8fCBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9CQUNLKSB7XG4gICAgICAgICAgICAgICAgZmxpcEZhY2VzID0gZmxpcEZhY3RvciAqIGRyYXdDYWxsLmZsaXBGYWNlc0ZhY3RvciAqIGRyYXdDYWxsLm5vZGUud29ybGRTY2FsZVNpZ247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGlwRmFjZXMgPCAwKSB7XG4gICAgICAgICAgICAgICAgbW9kZSA9IG1hdGVyaWFsLmN1bGwgPT09IENVTExGQUNFX0ZST05UID8gQ1VMTEZBQ0VfQkFDSyA6IENVTExGQUNFX0ZST05UO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtb2RlID0gbWF0ZXJpYWwuY3VsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRldmljZS5zZXRDdWxsTW9kZShtb2RlKTtcblxuICAgICAgICBpZiAobW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSAmJiBtYXRlcmlhbC5jdWxsID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICB0aGlzLnR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcklkLnNldFZhbHVlKGRyYXdDYWxsLm5vZGUud29ybGRTY2FsZVNpZ24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlQ2FtZXJhRnJ1c3R1bShjYW1lcmEpIHtcblxuICAgICAgICBpZiAoY2FtZXJhLnhyICYmIGNhbWVyYS54ci52aWV3cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBmcnVzdHVtIGJhc2VkIG9uIFhSIHZpZXdcbiAgICAgICAgICAgIGNvbnN0IHZpZXcgPSBjYW1lcmEueHIudmlld3NbMF07XG4gICAgICAgICAgICB2aWV3UHJvak1hdC5tdWwyKHZpZXcucHJvak1hdCwgdmlldy52aWV3T2ZmTWF0KTtcbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgaWYgKGNhbWVyYS5jYWxjdWxhdGVQcm9qZWN0aW9uKSB7XG4gICAgICAgICAgICBjYW1lcmEuY2FsY3VsYXRlUHJvamVjdGlvbihwcm9qTWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgY2FtZXJhLmNhbGN1bGF0ZVRyYW5zZm9ybSh2aWV3SW52TWF0LCBWSUVXX0NFTlRFUik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwb3MgPSBjYW1lcmEuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHJvdCA9IGNhbWVyYS5fbm9kZS5nZXRSb3RhdGlvbigpO1xuICAgICAgICAgICAgdmlld0ludk1hdC5zZXRUUlMocG9zLCByb3QsIFZlYzMuT05FKTtcbiAgICAgICAgICAgIHRoaXMudmlld0ludklkLnNldFZhbHVlKHZpZXdJbnZNYXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgdmlld01hdC5jb3B5KHZpZXdJbnZNYXQpLmludmVydCgpO1xuXG4gICAgICAgIHZpZXdQcm9qTWF0Lm11bDIocHJvak1hdCwgdmlld01hdCk7XG4gICAgICAgIGNhbWVyYS5mcnVzdHVtLnNldEZyb21NYXQ0KHZpZXdQcm9qTWF0KTtcbiAgICB9XG5cbiAgICBzZXRCYXNlQ29uc3RhbnRzKGRldmljZSwgbWF0ZXJpYWwpIHtcblxuICAgICAgICAvLyBDdWxsIG1vZGVcbiAgICAgICAgZGV2aWNlLnNldEN1bGxNb2RlKG1hdGVyaWFsLmN1bGwpO1xuXG4gICAgICAgIC8vIEFscGhhIHRlc3RcbiAgICAgICAgaWYgKG1hdGVyaWFsLm9wYWNpdHlNYXApIHtcbiAgICAgICAgICAgIHRoaXMub3BhY2l0eU1hcElkLnNldFZhbHVlKG1hdGVyaWFsLm9wYWNpdHlNYXApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRlcmlhbC5vcGFjaXR5TWFwIHx8IG1hdGVyaWFsLmFscGhhVGVzdCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuYWxwaGFUZXN0SWQuc2V0VmFsdWUobWF0ZXJpYWwuYWxwaGFUZXN0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcblxuICAgICAgICBfc2tpblVwZGF0ZUluZGV4Kys7XG5cbiAgICAgICAgY29uc3QgZHJhd0NhbGxzQ291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBpZiAoZHJhd0NhbGxzQ291bnQgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHNraW5UaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2kgPSBkcmF3Q2FsbHNbaV0uc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKHNpKSB7XG4gICAgICAgICAgICAgICAgc2kudXBkYXRlTWF0cmljZXMoZHJhd0NhbGxzW2ldLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIHNpLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3NraW5UaW1lICs9IG5vdygpIC0gc2tpblRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIHVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBza2luVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCBjb3VudCA9IGRyYXdDYWxscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNraW4gPSBkcmF3Q2FsbC5za2luSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKHNraW4gJiYgc2tpbi5fZGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpbi51cGRhdGVNYXRyaXhQYWxldHRlKGRyYXdDYWxsLm5vZGUsIF9za2luVXBkYXRlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBza2luLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc2tpblRpbWUgKz0gbm93KCkgLSBza2luVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgdXBkYXRlTW9ycGhpbmcoZHJhd0NhbGxzKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbW9ycGhUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoSW5zdCA9IGRyYXdDYWxsLm1vcnBoSW5zdGFuY2U7XG4gICAgICAgICAgICBpZiAobW9ycGhJbnN0ICYmIG1vcnBoSW5zdC5fZGlydHkgJiYgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSkge1xuICAgICAgICAgICAgICAgIG1vcnBoSW5zdC51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX21vcnBoVGltZSArPSBub3coKSAtIG1vcnBoVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZ3B1VXBkYXRlKGRyYXdDYWxscykge1xuICAgICAgICAvLyBza2lwIGV2ZXJ5dGhpbmcgd2l0aCB2aXNpYmxlVGhpc0ZyYW1lID09PSBmYWxzZVxuICAgICAgICB0aGlzLnVwZGF0ZUdwdVNraW5NYXRyaWNlcyhkcmF3Q2FsbHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZU1vcnBoaW5nKGRyYXdDYWxscyk7XG4gICAgfVxuXG4gICAgc2V0VmVydGV4QnVmZmVycyhkZXZpY2UsIG1lc2gpIHtcblxuICAgICAgICAvLyBtYWluIHZlcnRleCBidWZmZXJcbiAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihtZXNoLnZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgc2V0TW9ycGhpbmcoZGV2aWNlLCBtb3JwaEluc3RhbmNlKSB7XG5cbiAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgaWYgKG1vcnBoSW5zdGFuY2UubW9ycGgudXNlVGV4dHVyZU1vcnBoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyIHdpdGggdmVydGV4IGlkc1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRWZXJ0ZXhCdWZmZXIobW9ycGhJbnN0YW5jZS5tb3JwaC52ZXJ0ZXhCdWZmZXJJZHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoUG9zaXRpb25UZXguc2V0VmFsdWUobW9ycGhJbnN0YW5jZS50ZXh0dXJlUG9zaXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoTm9ybWFsVGV4LnNldFZhbHVlKG1vcnBoSW5zdGFuY2UudGV4dHVyZU5vcm1hbHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoVGV4UGFyYW1zLnNldFZhbHVlKG1vcnBoSW5zdGFuY2UuX3RleHR1cmVQYXJhbXMpO1xuXG4gICAgICAgICAgICB9IGVsc2UgeyAgICAvLyB2ZXJ0ZXggYXR0cmlidXRlcyBiYXNlZCBtb3JwaGluZ1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgdCA9IDA7IHQgPCBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgdCsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmIgPSBtb3JwaEluc3RhbmNlLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzW3RdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGF0Y2ggc2VtYW50aWMgZm9yIHRoZSBidWZmZXIgdG8gY3VycmVudCBBVFRSIHNsb3QgKHVzaW5nIEFUVFI4IC0gQVRUUjE1IHJhbmdlKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBTRU1BTlRJQ19BVFRSICsgKHQgKyA4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC5lbGVtZW50c1swXS5uYW1lID0gc2VtYW50aWM7XG4gICAgICAgICAgICAgICAgICAgICAgICB2Yi5mb3JtYXQuZWxlbWVudHNbMF0uc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNlbWFudGljKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZiLmZvcm1hdC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcih2Yik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgYWxsIDggd2VpZ2h0c1xuICAgICAgICAgICAgICAgIHRoaXMubW9ycGhXZWlnaHRzQS5zZXRWYWx1ZShtb3JwaEluc3RhbmNlLl9zaGFkZXJNb3JwaFdlaWdodHNBKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vcnBoV2VpZ2h0c0Iuc2V0VmFsdWUobW9ycGhJbnN0YW5jZS5fc2hhZGVyTW9ycGhXZWlnaHRzQik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTa2lubmluZyhkZXZpY2UsIG1lc2hJbnN0YW5jZSkge1xuICAgICAgICBpZiAobWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2tpbkRyYXdDYWxscysrO1xuICAgICAgICAgICAgaWYgKGRldmljZS5zdXBwb3J0c0JvbmVUZXh0dXJlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVUZXh0dXJlID0gbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZS5ib25lVGV4dHVyZTtcbiAgICAgICAgICAgICAgICB0aGlzLmJvbmVUZXh0dXJlSWQuc2V0VmFsdWUoYm9uZVRleHR1cmUpO1xuICAgICAgICAgICAgICAgIGJvbmVUZXh0dXJlU2l6ZVswXSA9IGJvbmVUZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgIGJvbmVUZXh0dXJlU2l6ZVsxXSA9IGJvbmVUZXh0dXJlLmhlaWdodDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbMl0gPSAxLjAgLyBib25lVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICBib25lVGV4dHVyZVNpemVbM10gPSAxLjAgLyBib25lVGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5ib25lVGV4dHVyZVNpemVJZC5zZXRWYWx1ZShib25lVGV4dHVyZVNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2VNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlLm1hdHJpeFBhbGV0dGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0cyBWZWMzIGNhbWVyYSBwb3NpdGlvbiB1bmlmb3JtXG4gICAgZGlzcGF0Y2hWaWV3UG9zKHBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZwID0gdGhpcy52aWV3UG9zOyAgICAvLyBub3RlIHRoYXQgdGhpcyByZXVzZXMgYW4gYXJyYXlcbiAgICAgICAgdnBbMF0gPSBwb3NpdGlvbi54O1xuICAgICAgICB2cFsxXSA9IHBvc2l0aW9uLnk7XG4gICAgICAgIHZwWzJdID0gcG9zaXRpb24uejtcbiAgICAgICAgdGhpcy52aWV3UG9zSWQuc2V0VmFsdWUodnApO1xuICAgIH1cblxuICAgIGluaXRWaWV3QmluZEdyb3VwRm9ybWF0KGlzQ2x1c3RlcmVkKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgJiYgIXRoaXMudmlld1VuaWZvcm1Gb3JtYXQpIHtcblxuICAgICAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtcyA9IFtcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcIm1hdHJpeF92aWV3UHJvamVjdGlvblwiLCBVTklGT1JNVFlQRV9NQVQ0KSxcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcImN1YmVNYXBSb3RhdGlvbk1hdHJpeFwiLCBVTklGT1JNVFlQRV9NQVQzKSxcbiAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcInZpZXdfcG9zaXRpb25cIiwgVU5JRk9STVRZUEVfVkVDMyksXG4gICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJza3lib3hJbnRlbnNpdHlcIiwgVU5JRk9STVRZUEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiZXhwb3N1cmVcIiwgVU5JRk9STVRZUEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwidGV4dHVyZUJpYXNcIiwgVU5JRk9STVRZUEVfRkxPQVQpXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICB1bmlmb3Jtcy5wdXNoKC4uLltcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZVwiLCBVTklGT1JNVFlQRV9WRUMzKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyVGV4dHVyZVNpemVcIiwgVU5JRk9STVRZUEVfVkVDMyksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3RlckJvdW5kc01pblwiLCBVTklGT1JNVFlQRV9WRUMzKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyQm91bmRzRGVsdGFcIiwgVU5JRk9STVRZUEVfVkVDMyksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3RlckNlbGxzRG90XCIsIFVOSUZPUk1UWVBFX1ZFQzMpLFxuICAgICAgICAgICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdChcImNsdXN0ZXJDZWxsc01heFwiLCBVTklGT1JNVFlQRV9WRUMzKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFVuaWZvcm1Gb3JtYXQoXCJjbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBcIiwgVU5JRk9STVRZUEVfVkVDMiksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwic2hhZG93QXRsYXNQYXJhbXNcIiwgVU5JRk9STVRZUEVfVkVDMiksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3Rlck1heENlbGxzXCIsIFVOSUZPUk1UWVBFX0lOVCksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KFwiY2x1c3RlclNraXBcIiwgVU5JRk9STVRZUEVfRkxPQVQpXG4gICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudmlld1VuaWZvcm1Gb3JtYXQgPSBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdCh0aGlzLmRldmljZSwgdW5pZm9ybXMpO1xuXG4gICAgICAgICAgICAvLyBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cCAtIGNvbnRhaW5zIHNpbmdsZSB1bmlmb3JtIGJ1ZmZlciwgYW5kIHNvbWUgdGV4dHVyZXNcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlcnMgPSBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRCdWZmZXJGb3JtYXQoVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5UKVxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBbXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdsaWdodHNUZXh0dXJlRmxvYXQnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnbGlnaHRzVGV4dHVyZTgnLCBTSEFERVJTVEFHRV9GUkFHTUVOVCwgVEVYVFVSRURJTUVOU0lPTl8yRCwgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnc2hhZG93QXRsYXNUZXh0dXJlJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfREVQVEgpLFxuICAgICAgICAgICAgICAgIG5ldyBCaW5kVGV4dHVyZUZvcm1hdCgnY29va2llQXRsYXNUZXh0dXJlJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfRkxPQVQpLFxuXG4gICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdhcmVhTGlnaHRzTHV0VGV4MScsIFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBURVhUVVJFRElNRU5TSU9OXzJELCBTQU1QTEVUWVBFX0ZMT0FUKSxcbiAgICAgICAgICAgICAgICBuZXcgQmluZFRleHR1cmVGb3JtYXQoJ2FyZWFMaWdodHNMdXRUZXgyJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfRkxPQVQpXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWQpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlcy5wdXNoKC4uLltcbiAgICAgICAgICAgICAgICAgICAgbmV3IEJpbmRUZXh0dXJlRm9ybWF0KCdjbHVzdGVyV29ybGRUZXh0dXJlJywgU0hBREVSU1RBR0VfRlJBR01FTlQsIFRFWFRVUkVESU1FTlNJT05fMkQsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUKVxuICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBGb3JtYXQgPSBuZXcgQmluZEdyb3VwRm9ybWF0KHRoaXMuZGV2aWNlLCBidWZmZXJzLCB0ZXh0dXJlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyh2aWV3QmluZEdyb3Vwcywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZpZXdDb3VudCkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChBcnJheS5pc0FycmF5KHZpZXdCaW5kR3JvdXBzKSwgXCJ2aWV3QmluZEdyb3VwcyBtdXN0IGJlIGFuIGFycmF5XCIpO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodmlld0NvdW50ID09PSAxLCBcIlRoaXMgY29kZSBkb2VzIG5vdCBoYW5kbGUgdGhlIHZpZXdDb3VudCB5ZXRcIik7XG5cbiAgICAgICAgd2hpbGUgKHZpZXdCaW5kR3JvdXBzLmxlbmd0aCA8IHZpZXdDb3VudCkge1xuICAgICAgICAgICAgY29uc3QgdWIgPSBuZXcgVW5pZm9ybUJ1ZmZlcihkZXZpY2UsIHZpZXdVbmlmb3JtRm9ybWF0LCBmYWxzZSk7XG4gICAgICAgICAgICBjb25zdCBiZyA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCB2aWV3QmluZEdyb3VwRm9ybWF0LCB1Yik7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKGJnLCBgVmlld0JpbmRHcm91cF8ke2JnLmlkfWApO1xuICAgICAgICAgICAgdmlld0JpbmRHcm91cHMucHVzaChiZyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgdmlldyBiaW5kIGdyb3VwIC8gdW5pZm9ybXNcbiAgICAgICAgY29uc3Qgdmlld0JpbmRHcm91cCA9IHZpZXdCaW5kR3JvdXBzWzBdO1xuICAgICAgICB2aWV3QmluZEdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyLnVwZGF0ZSgpO1xuICAgICAgICB2aWV3QmluZEdyb3VwLnVwZGF0ZSgpO1xuXG4gICAgICAgIC8vIFRPRE87IHRoaXMgbmVlZHMgdG8gYmUgbW92ZWQgdG8gZHJhd0luc3RhbmNlIGZ1bmN0aW9ucyB0byBoYW5kbGUgWFJcbiAgICAgICAgZGV2aWNlLnNldEJpbmRHcm91cChCSU5ER1JPVVBfVklFVywgdmlld0JpbmRHcm91cCk7XG4gICAgfVxuXG4gICAgc2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMobWVzaEluc3RhbmNlLCBwYXNzKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGlmIChkZXZpY2Uuc3VwcG9ydHNVbmlmb3JtQnVmZmVycykge1xuXG4gICAgICAgICAgICAvLyBUT0RPOiBtb2RlbCBtYXRyaXggc2V0dXAgaXMgcGFydCBvZiB0aGUgZHJhd0luc3RhbmNlIGNhbGwsIGJ1dCB3aXRoIHVuaWZvcm0gYnVmZmVyIGl0J3MgbmVlZGVkXG4gICAgICAgICAgICAvLyBlYXJsaWVyIGhlcmUuIFRoaXMgbmVlZHMgdG8gYmUgcmVmYWN0b3JlZCBmb3IgbXVsdGktdmlldyBhbnl3YXlzLlxuICAgICAgICAgICAgdGhpcy5tb2RlbE1hdHJpeElkLnNldFZhbHVlKG1lc2hJbnN0YW5jZS5ub2RlLndvcmxkVHJhbnNmb3JtLmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5ub3JtYWxNYXRyaXhJZC5zZXRWYWx1ZShtZXNoSW5zdGFuY2Uubm9kZS5ub3JtYWxNYXRyaXguZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBtZXNoIGJpbmQgZ3JvdXAgLyB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgbWVzaEJpbmRHcm91cCA9IG1lc2hJbnN0YW5jZS5nZXRCaW5kR3JvdXAoZGV2aWNlLCBwYXNzKTtcbiAgICAgICAgICAgIG1lc2hCaW5kR3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXIudXBkYXRlKCk7XG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwLnVwZGF0ZSgpO1xuICAgICAgICAgICAgZGV2aWNlLnNldEJpbmRHcm91cChCSU5ER1JPVVBfTUVTSCwgbWVzaEJpbmRHcm91cCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkcmF3SW5zdGFuY2UoZGV2aWNlLCBtZXNoSW5zdGFuY2UsIG1lc2gsIHN0eWxlLCBub3JtYWwpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBtZXNoSW5zdGFuY2Uubm9kZS5uYW1lKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jaW5nRGF0YSA9IG1lc2hJbnN0YW5jZS5pbnN0YW5jaW5nRGF0YTtcbiAgICAgICAgaWYgKGluc3RhbmNpbmdEYXRhKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5zdGFuY2VkRHJhd0NhbGxzKys7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihpbnN0YW5jaW5nRGF0YS52ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICAgICAgICAgIGRldmljZS5kcmF3KG1lc2gucHJpbWl0aXZlW3N0eWxlXSwgaW5zdGFuY2luZ0RhdGEuY291bnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbW9kZWxNYXRyaXggPSBtZXNoSW5zdGFuY2Uubm9kZS53b3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxNYXRyaXhJZC5zZXRWYWx1ZShtb2RlbE1hdHJpeC5kYXRhKTtcblxuICAgICAgICAgICAgaWYgKG5vcm1hbCkge1xuICAgICAgICAgICAgICAgIHRoaXMubm9ybWFsTWF0cml4SWQuc2V0VmFsdWUobWVzaEluc3RhbmNlLm5vZGUubm9ybWFsTWF0cml4LmRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG5cbiAgICAvLyB1c2VkIGZvciBzdGVyZW9cbiAgICBkcmF3SW5zdGFuY2UyKGRldmljZSwgbWVzaEluc3RhbmNlLCBtZXNoLCBzdHlsZSkge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIG1lc2hJbnN0YW5jZS5ub2RlLm5hbWUpO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNpbmdEYXRhID0gbWVzaEluc3RhbmNlLmluc3RhbmNpbmdEYXRhO1xuICAgICAgICBpZiAoaW5zdGFuY2luZ0RhdGEpIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jaW5nRGF0YS5jb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnN0YW5jZWREcmF3Q2FsbHMrKztcbiAgICAgICAgICAgICAgICBkZXZpY2UuZHJhdyhtZXNoLnByaW1pdGl2ZVtzdHlsZV0sIGluc3RhbmNpbmdEYXRhLmNvdW50LCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG1hdHJpY2VzIGFyZSBhbHJlYWR5IHNldFxuICAgICAgICAgICAgZGV2aWNlLmRyYXcobWVzaC5wcmltaXRpdmVbc3R5bGVdLCB1bmRlZmluZWQsIHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICB9XG5cbiAgICBjdWxsKGNhbWVyYSwgZHJhd0NhbGxzLCB2aXNpYmxlTGlzdCkge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IGN1bGxUaW1lID0gbm93KCk7XG4gICAgICAgIGxldCBudW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBsZXQgdmlzaWJsZUxlbmd0aCA9IDA7XG4gICAgICAgIGNvbnN0IGRyYXdDYWxsc0NvdW50ID0gZHJhd0NhbGxzLmxlbmd0aDtcblxuICAgICAgICBjb25zdCBjdWxsaW5nTWFzayA9IGNhbWVyYS5jdWxsaW5nTWFzayB8fCAweEZGRkZGRkZGOyAvLyBpZiBtaXNzaW5nIGFzc3VtZSBjYW1lcmEncyBkZWZhdWx0IHZhbHVlXG5cbiAgICAgICAgaWYgKCFjYW1lcmEuZnJ1c3R1bUN1bGxpbmcpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIG5lZWQgdG8gY29weSBhcnJheSBhbnl3YXkgYmVjYXVzZSBzb3J0aW5nIHdpbGwgaGFwcGVuIGFuZCBpdCdsbCBicmVhayBvcmlnaW5hbCBkcmF3IGNhbGwgb3JkZXIgYXNzdW1wdGlvblxuICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGwudmlzaWJsZSAmJiAhZHJhd0NhbGwuY29tbWFuZCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgb2JqZWN0J3MgbWFzayBBTkQgdGhlIGNhbWVyYSdzIGN1bGxpbmdNYXNrIGlzIHplcm8gdGhlbiB0aGUgZ2FtZSBvYmplY3Qgd2lsbCBiZSBpbnZpc2libGUgZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLm1hc2sgJiYgKGRyYXdDYWxsLm1hc2sgJiBjdWxsaW5nTWFzaykgPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmlzaWJsZUxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBkcmF3Q2FsbHNbaV07XG4gICAgICAgICAgICBpZiAoIWRyYXdDYWxsLmNvbW1hbmQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsLnZpc2libGUpIGNvbnRpbnVlOyAvLyB1c2UgdmlzaWJsZSBwcm9wZXJ0eSB0byBxdWlja2x5IGhpZGUvc2hvdyBtZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgbGV0IHZpc2libGUgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIG9iamVjdCdzIG1hc2sgQU5EIHRoZSBjYW1lcmEncyBjdWxsaW5nTWFzayBpcyB6ZXJvIHRoZW4gdGhlIGdhbWUgb2JqZWN0IHdpbGwgYmUgaW52aXNpYmxlIGZyb20gdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXNrICYmIChkcmF3Q2FsbC5tYXNrICYgY3VsbGluZ01hc2spID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUgPSBkcmF3Q2FsbC5faXNWaXNpYmxlKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgbnVtRHJhd0NhbGxzQ3VsbGVkKys7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh2aXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVMaXN0W3Zpc2libGVMZW5ndGhdID0gZHJhd0NhbGw7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICAgICAgZHJhd0NhbGwudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgIHZpc2libGVMZW5ndGgrKztcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fY3VsbFRpbWUgKz0gbm93KCkgLSBjdWxsVGltZTtcbiAgICAgICAgdGhpcy5fbnVtRHJhd0NhbGxzQ3VsbGVkICs9IG51bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHZpc2libGVMZW5ndGg7XG4gICAgfVxuXG4gICAgY3VsbExpZ2h0cyhjYW1lcmEsIGxpZ2h0cykge1xuXG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICBjb25zdCBwaHlzaWNhbFVuaXRzID0gdGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG5cbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBtYXJrZWQgdmlzaWJsZSBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQuZ2V0Qm91bmRpbmdTcGhlcmUodGVtcFNwaGVyZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEuZnJ1c3R1bS5jb250YWluc1NwaGVyZSh0ZW1wU3BoZXJlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC51c2VQaHlzaWNhbFVuaXRzID0gcGh5c2ljYWxVbml0cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF4aW11bSBzY3JlZW4gYXJlYSB0YWtlbiBieSB0aGUgbGlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjcmVlblNpemUgPSBjYW1lcmEuZ2V0U2NyZWVuU2l6ZSh0ZW1wU3BoZXJlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Lm1heFNjcmVlblNpemUgPSBNYXRoLm1heChsaWdodC5tYXhTY3JlZW5TaXplLCBzY3JlZW5TaXplKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHNoYWRvdyBjYXN0aW5nIGxpZ2h0IGRvZXMgbm90IGhhdmUgc2hhZG93IG1hcCBhbGxvY2F0ZWQsIG1hcmsgaXQgdmlzaWJsZSB0byBhbGxvY2F0ZSBzaGFkb3cgbWFwXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3RlOiBUaGlzIHdvbid0IGJlIG5lZWRlZCB3aGVuIGNsdXN0ZXJlZCBzaGFkb3dzIGFyZSB1c2VkLCBidXQgYXQgdGhlIG1vbWVudCBldmVuIGN1bGxlZCBvdXQgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhcmUgdXNlZCBmb3IgcmVuZGVyaW5nLCBhbmQgbmVlZCBzaGFkb3cgbWFwIHRvIGJlIGFsbG9jYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZGVsZXRlIHRoaXMgY29kZSB3aGVuIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCBpcyBiZWluZyByZW1vdmVkIGFuZCBpcyBvbiBieSBkZWZhdWx0LlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MgJiYgIWxpZ2h0LnNoYWRvd01hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsaWdodC51c2VQaHlzaWNhbFVuaXRzID0gdGhpcy5zY2VuZS5waHlzaWNhbFVuaXRzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNoYWRvdyBtYXAgY3VsbGluZyBmb3IgZGlyZWN0aW9uYWwgYW5kIHZpc2libGUgbG9jYWwgbGlnaHRzXG4gICAgICogdmlzaWJsZSBtZXNoSW5zdGFuY2VzIGFyZSBjb2xsZWN0ZWQgaW50byBsaWdodC5fcmVuZGVyRGF0YSwgYW5kIGFyZSBtYXJrZWQgYXMgdmlzaWJsZVxuICAgICAqIGZvciBkaXJlY3Rpb25hbCBsaWdodHMgYWxzbyBzaGFkb3cgY2FtZXJhIG1hdHJpeCBpcyBzZXQgdXBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICBjdWxsU2hhZG93bWFwcyhjb21wKSB7XG5cbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICAvLyBzaGFkb3cgY2FzdGVycyBjdWxsaW5nIGZvciBsb2NhbCAocG9pbnQgYW5kIHNwb3QpIGxpZ2h0c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbXAuX2xpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBjb21wLl9saWdodHNbaV07XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzQ2x1c3RlcmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIGF0bGFzIHNsb3QgaXMgcmVhc3NpZ25lZCwgbWFrZSBzdXJlIHRvIHVwZGF0ZSB0aGUgc2hhZG93IG1hcCwgaW5jbHVkaW5nIHRoZSBjdWxsaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5hdGxhc1Nsb3RVcGRhdGVkICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPT09IFNIQURPV1VQREFURV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodC52aXNpYmxlVGhpc0ZyYW1lICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgIT09IFNIQURPV1VQREFURV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhc3RlcnMgPSBjb21wLl9saWdodENvbXBvc2l0aW9uRGF0YVtpXS5zaGFkb3dDYXN0ZXJzTGlzdDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJMb2NhbC5jdWxsKGxpZ2h0LCBjYXN0ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgY2FzdGVycyBjdWxsaW5nIGZvciBnbG9iYWwgKGRpcmVjdGlvbmFsKSBsaWdodHNcbiAgICAgICAgLy8gcmVuZGVyIGFjdGlvbnMgc3RvcmUgd2hpY2ggZGlyZWN0aW9uYWwgbGlnaHRzIGFyZSBuZWVkZWQgZm9yIGVhY2ggY2FtZXJhLCBzbyB0aGVzZSBhcmUgZ2V0dGluZyBjdWxsZWRcbiAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9ucyA9IGNvbXAuX3JlbmRlckFjdGlvbnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gcmVuZGVyQWN0aW9uLmRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodEluZGV4ID0gcmVuZGVyQWN0aW9uLmRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlc1tqXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGNvbXAuX2xpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYXN0ZXJzID0gY29tcC5fbGlnaHRDb21wb3NpdGlvbkRhdGFbbGlnaHRJbmRleF0uc2hhZG93Q2FzdGVyc0xpc3Q7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbC5jdWxsKGxpZ2h0LCBjYXN0ZXJzLCByZW5kZXJBY3Rpb24uY2FtZXJhLmNhbWVyYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB2aXNpYmlsaXR5IGN1bGxpbmcgb2YgbGlnaHRzLCBtZXNoSW5zdGFuY2VzLCBzaGFkb3dzIGNhc3RlcnNcbiAgICAgKiBBbHNvIGFwcGxpZXMgbWVzaEluc3RhbmNlLnZpc2libGUgYW5kIGNhbWVyYS5jdWxsaW5nTWFza1xuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uLlxuICAgICAqL1xuICAgIGN1bGxDb21wb3NpdGlvbihjb21wKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBjdWxsVGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9yZW5kZXItYWN0aW9uLmpzJykuUmVuZGVyQWN0aW9ufSAqL1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tpXTtcblxuICAgICAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgICAgIGNvbnN0IGxheWVySW5kZXggPSByZW5kZXJBY3Rpb24ubGF5ZXJJbmRleDtcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSAqL1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmxheWVyTGlzdFtsYXllckluZGV4XTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIuZW5hYmxlZCB8fCAhY29tcC5zdWJMYXllckVuYWJsZWRbbGF5ZXJJbmRleF0pIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSBjb21wLnN1YkxheWVyTGlzdFtsYXllckluZGV4XTtcblxuICAgICAgICAgICAgLy8gY2FtZXJhXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFQYXNzID0gcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4O1xuICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICBpZiAoY2FtZXJhKSB7XG5cbiAgICAgICAgICAgICAgICBjYW1lcmEuZnJhbWVVcGRhdGUocmVuZGVyQWN0aW9uLnJlbmRlclRhcmdldCk7XG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgY2FtZXJhIGFuZCBmcnVzdHVtIG9uY2VcbiAgICAgICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uLmZpcnN0Q2FtZXJhVXNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQ2FtZXJhRnJ1c3R1bShjYW1lcmEuY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FtZXJhc1JlbmRlcmVkKys7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY3VsbCBlYWNoIGxheWVyJ3Mgbm9uLWRpcmVjdGlvbmFsIGxpZ2h0cyBvbmNlIHdpdGggZWFjaCBjYW1lcmFcbiAgICAgICAgICAgICAgICAvLyBsaWdodHMgYXJlbid0IGNvbGxlY3RlZCBhbnl3aGVyZSwgYnV0IG1hcmtlZCBhcyB2aXNpYmxlXG4gICAgICAgICAgICAgICAgdGhpcy5jdWxsTGlnaHRzKGNhbWVyYS5jYW1lcmEsIGxheWVyLl9saWdodHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gY3VsbCBtZXNoIGluc3RhbmNlc1xuICAgICAgICAgICAgICAgIGNvbnN0IG9iamVjdHMgPSBsYXllci5pbnN0YW5jZXM7XG5cbiAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IHRoZW0gaW50byBsYXllciBhcnJheXNcbiAgICAgICAgICAgICAgICBjb25zdCB2aXNpYmxlID0gdHJhbnNwYXJlbnQgPyBvYmplY3RzLnZpc2libGVUcmFuc3BhcmVudFtjYW1lcmFQYXNzXSA6IG9iamVjdHMudmlzaWJsZU9wYXF1ZVtjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgICAgIC8vIHNoYXJlZCBvYmplY3RzIGFyZSBvbmx5IGN1bGxlZCBvbmNlXG4gICAgICAgICAgICAgICAgaWYgKCF2aXNpYmxlLmRvbmUpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIub25QcmVDdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5vblByZUN1bGwoY2FtZXJhUGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbHMgPSB0cmFuc3BhcmVudCA/IGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyA6IGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGUubGVuZ3RoID0gdGhpcy5jdWxsKGNhbWVyYS5jYW1lcmEsIGRyYXdDYWxscywgdmlzaWJsZS5saXN0KTtcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJsZS5kb25lID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIub25Qb3N0Q3VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIub25Qb3N0Q3VsbChjYW1lcmFQYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBzaGFkb3cgLyBjb29raWUgYXRsYXMgYWxsb2NhdGlvbiBmb3IgdGhlIHZpc2libGUgbGlnaHRzLiBVcGRhdGUgaXQgYWZ0ZXIgdGhlIGxpZ3RodHMgd2VyZSBjdWxsZWQsXG4gICAgICAgIC8vIGJ1dCBiZWZvcmUgc2hhZG93IG1hcHMgd2VyZSBjdWxsaW5nLCBhcyBpdCBtaWdodCBmb3JjZSBzb21lICd1cGRhdGUgb25jZScgc2hhZG93cyB0byBjdWxsLlxuICAgICAgICBpZiAodGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTGlnaHRUZXh0dXJlQXRsYXMoY29tcCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjdWxsIHNoYWRvdyBjYXN0ZXJzIGZvciBhbGwgbGlnaHRzXG4gICAgICAgIHRoaXMuY3VsbFNoYWRvd21hcHMoY29tcCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9jdWxsVGltZSArPSBub3coKSAtIGN1bGxUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBkcmF3Q2FsbHMgLSBNZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9ubHlMaXRTaGFkZXJzIC0gTGltaXRzIHRoZSB1cGRhdGUgdG8gc2hhZGVycyBhZmZlY3RlZCBieSBsaWdodGluZy5cbiAgICAgKi9cbiAgICB1cGRhdGVTaGFkZXJzKGRyYXdDYWxscywgb25seUxpdFNoYWRlcnMpIHtcbiAgICAgICAgY29uc3QgY291bnQgPSBkcmF3Q2FsbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1hdCA9IGRyYXdDYWxsc1tpXS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGlmIChtYXQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXRlcmlhbCBub3QgcHJvY2Vzc2VkIHlldFxuICAgICAgICAgICAgICAgIGlmICghX3RlbXBTZXQuaGFzKG1hdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RlbXBTZXQuYWRkKG1hdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCB0aGlzIGZvciBtYXRlcmlhbHMgbm90IHVzaW5nIHZhcmlhbnRzXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXQuZ2V0U2hhZGVyVmFyaWFudCAhPT0gTWF0ZXJpYWwucHJvdG90eXBlLmdldFNoYWRlclZhcmlhbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9ubHlMaXRTaGFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCBtYXRlcmlhbHMgbm90IHVzaW5nIGxpZ2h0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXQudXNlTGlnaHRpbmcgfHwgKG1hdC5lbWl0dGVyICYmICFtYXQuZW1pdHRlci5saWdodGluZykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBzaGFkZXIgdmFyaWFudHMgb24gdGhlIG1hdGVyaWFsIGFuZCBhbHNvIG9uIG1lc2ggaW5zdGFuY2VzIHRoYXQgdXNlIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXQuY2xlYXJWYXJpYW50cygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8ga2VlcCB0ZW1wIHNldCBlbXB0eVxuICAgICAgICBfdGVtcFNldC5jbGVhcigpO1xuICAgIH1cblxuICAgIHJlbmRlckNvb2tpZXMobGlnaHRzKSB7XG5cbiAgICAgICAgY29uc3QgY29va2llUmVuZGVyVGFyZ2V0ID0gdGhpcy5saWdodFRleHR1cmVBdGxhcy5jb29raWVSZW5kZXJUYXJnZXQ7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcblxuICAgICAgICAgICAgLy8gc2tpcCBjbHVzdGVyZWQgY29va2llcyB3aXRoIG5vIGFzc2lnbmVkIGF0bGFzIHNsb3RcbiAgICAgICAgICAgIGlmICghbGlnaHQuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gb25seSByZW5kZXIgY29va2llIHdoZW4gdGhlIHNsb3QgaXMgcmVhc3NpZ25lZCAoYXNzdW1pbmcgdGhlIGNvb2tpZSB0ZXh0dXJlIGlzIHN0YXRpYylcbiAgICAgICAgICAgIGlmICghbGlnaHQuYXRsYXNTbG90VXBkYXRlZClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgdGhpcy5fY29va2llUmVuZGVyZXIucmVuZGVyKGxpZ2h0LCBjb29raWVSZW5kZXJUYXJnZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gY29tcCAtIFRoZSBsYXllclxuICAgICAqIGNvbXBvc2l0aW9uIHRvIHVwZGF0ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGxpZ2h0c0NoYW5nZWQgLSBUcnVlIGlmIGxpZ2h0cyBvZiB0aGUgY29tcG9zaXRpb24gaGFzIGNoYW5nZWQuXG4gICAgICovXG4gICAgYmVnaW5GcmFtZShjb21wLCBsaWdodHNDaGFuZ2VkKSB7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBjb21wLl9tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBzaGFkZXJzIGlmIG5lZWRlZFxuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGlmIChzY2VuZS51cGRhdGVTaGFkZXJzIHx8IGxpZ2h0c0NoYW5nZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9ubHlMaXRTaGFkZXJzID0gIXNjZW5lLnVwZGF0ZVNoYWRlcnMgJiYgbGlnaHRzQ2hhbmdlZDtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyhtZXNoSW5zdGFuY2VzLCBvbmx5TGl0U2hhZGVycyk7XG4gICAgICAgICAgICBzY2VuZS51cGRhdGVTaGFkZXJzID0gZmFsc2U7XG4gICAgICAgICAgICBzY2VuZS5fc2hhZGVyVmVyc2lvbisrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBza2luIG1hdHJpY2VzIHRvIHByb3Blcmx5IGN1bGwgc2tpbm5lZCBvYmplY3RzIChidXQgZG9uJ3QgdXBkYXRlIHJlbmRlcmluZyBkYXRhIHlldClcbiAgICAgICAgdGhpcy51cGRhdGVDcHVTa2luTWF0cmljZXMobWVzaEluc3RhbmNlcyk7XG5cbiAgICAgICAgLy8gY2xlYXIgbWVzaCBpbnN0YW5jZSB2aXNpYmlsaXR5XG4gICAgICAgIGNvbnN0IG1pQ291bnQgPSBtZXNoSW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaUNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0udmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xlYXIgbGlnaHQgdmlzaWJpbGl0eVxuICAgICAgICBjb25zdCBsaWdodHMgPSBjb21wLl9saWdodHM7XG4gICAgICAgIGNvbnN0IGxpZ2h0Q291bnQgPSBsaWdodHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgbGlnaHRzW2ldLmJlZ2luRnJhbWUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbi5cbiAgICAgKi9cbiAgICB1cGRhdGVMaWdodFRleHR1cmVBdGxhcyhjb21wKSB7XG4gICAgICAgIHRoaXMubGlnaHRUZXh0dXJlQXRsYXMudXBkYXRlKGNvbXAuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXSwgY29tcC5fc3BsaXRMaWdodHNbTElHSFRUWVBFX09NTkldLCB0aGlzLnNjZW5lLmxpZ2h0aW5nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBjb21wIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICovXG4gICAgdXBkYXRlQ2x1c3RlcnMoY29tcCkge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGNvbnN0IGVtcHR5V29ybGRDbHVzdGVycyA9IGNvbXAuZ2V0RW1wdHlXb3JsZENsdXN0ZXJzKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICBjb25zdCByZW5kZXJBY3Rpb25zID0gY29tcC5fcmVuZGVyQWN0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgY2x1c3RlciA9IHJlbmRlckFjdGlvbi5saWdodENsdXN0ZXJzO1xuXG4gICAgICAgICAgICBpZiAoY2x1c3RlciAmJiBjbHVzdGVyICE9PSBlbXB0eVdvcmxkQ2x1c3RlcnMpIHtcblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBlYWNoIGNsdXN0ZXIgb25seSBvbmUgdGltZVxuICAgICAgICAgICAgICAgIGlmICghX3RlbXBTZXQuaGFzKGNsdXN0ZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIF90ZW1wU2V0LmFkZChjbHVzdGVyKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAubGF5ZXJMaXN0W3JlbmRlckFjdGlvbi5sYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgY2x1c3Rlci51cGRhdGUobGF5ZXIuY2x1c3RlcmVkTGlnaHRzU2V0LCB0aGlzLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiwgdGhpcy5zY2VuZS5saWdodGluZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8ga2VlcCB0ZW1wIHNldCBlbXB0eVxuICAgICAgICBfdGVtcFNldC5jbGVhcigpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fbGlnaHRDbHVzdGVyc1RpbWUgKz0gbm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q2x1c3RlcnMgPSBjb21wLl93b3JsZENsdXN0ZXJzLmxlbmd0aDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUgbGF5ZXIgY29tcG9zaXRpb24gZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IGNvbXAgLSBUaGUgbGF5ZXJcbiAgICAgKiBjb21wb3NpdGlvbiB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgLSBUcnVlIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IC0gRmxhZ3Mgb2Ygd2hhdCB3YXMgdXBkYXRlZFxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVMYXllckNvbXBvc2l0aW9uKGNvbXAsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgY29uc3QgbGVuID0gY29tcC5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb21wLmxheWVyTGlzdFtpXS5fcG9zdFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBzaGFkZXJWZXJzaW9uID0gc2NlbmUuX3NoYWRlclZlcnNpb247XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5sYXllckxpc3RbaV07XG4gICAgICAgICAgICBsYXllci5fc2hhZGVyVmVyc2lvbiA9IHNoYWRlclZlcnNpb247XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBsYXllci5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgICAgICBsYXllci5fcmVuZGVyVGltZSA9IDA7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgbGF5ZXIuX3ByZVJlbmRlckNhbGxlZEZvckNhbWVyYXMgPSAwO1xuICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDYWxsZWRGb3JDYW1lcmFzID0gMDtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gY29tcC5zdWJMYXllckxpc3RbaV07XG4gICAgICAgICAgICBpZiAodHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXIgfD0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3Bvc3RSZW5kZXJDb3VudGVyIHw9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXllci5fcG9zdFJlbmRlckNvdW50ZXJNYXggPSBsYXllci5fcG9zdFJlbmRlckNvdW50ZXI7XG5cbiAgICAgICAgICAgIC8vIHByZXBhcmUgbGF5ZXIgZm9yIGN1bGxpbmcgd2l0aCB0aGUgY2FtZXJhXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxheWVyLmNhbWVyYXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBsYXllci5pbnN0YW5jZXMucHJlcGFyZShqKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gR2VuZXJhdGUgc3RhdGljIGxpZ2h0aW5nIGZvciBtZXNoZXMgaW4gdGhpcyBsYXllciBpZiBuZWVkZWRcbiAgICAgICAgICAgIC8vIE5vdGU6IFN0YXRpYyBsaWdodGluZyBpcyBub3QgdXNlZCB3aGVuIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAobGF5ZXIuX25lZWRzU3RhdGljUHJlcGFyZSAmJiBsYXllci5fc3RhdGljTGlnaHRIYXNoICYmICF0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIC8vIFRPRE86IHJldXNlIHdpdGggdGhlIHNhbWUgc3RhdGljTGlnaHRIYXNoXG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9zdGF0aWNQcmVwYXJlRG9uZSkge1xuICAgICAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucmV2ZXJ0KGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgICAgICBTdGF0aWNNZXNoZXMucmV2ZXJ0KGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFN0YXRpY01lc2hlcy5wcmVwYXJlKHRoaXMuZGV2aWNlLCBzY2VuZSwgbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcywgbGF5ZXIuX2xpZ2h0cyk7XG4gICAgICAgICAgICAgICAgU3RhdGljTWVzaGVzLnByZXBhcmUodGhpcy5kZXZpY2UsIHNjZW5lLCBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMsIGxheWVyLl9saWdodHMpO1xuICAgICAgICAgICAgICAgIGNvbXAuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzY2VuZS51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBsYXllci5fbmVlZHNTdGF0aWNQcmVwYXJlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbGF5ZXIuX3N0YXRpY1ByZXBhcmVEb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBzdGF0aWMgbGF5ZXIgZGF0YSwgaWYgc29tZXRoaW5nJ3MgY2hhbmdlZFxuICAgICAgICBjb25zdCB1cGRhdGVkID0gY29tcC5fdXBkYXRlKHRoaXMuZGV2aWNlLCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgKz0gbm93KCkgLSBsYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHVwZGF0ZWQ7XG4gICAgfVxuXG4gICAgZnJhbWVVcGRhdGUoKSB7XG5cbiAgICAgICAgdGhpcy5jbHVzdGVyc0RlYnVnUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmluaXRWaWV3QmluZEdyb3VwRm9ybWF0KHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJlbmRlcmVyIH07XG4iXSwibmFtZXMiOlsiX3NraW5VcGRhdGVJbmRleCIsImJvbmVUZXh0dXJlU2l6ZSIsInZpZXdQcm9qTWF0IiwiTWF0NCIsInZpZXdJbnZNYXQiLCJ2aWV3TWF0Iiwidmlld01hdDMiLCJNYXQzIiwidGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiX2ZsaXBZTWF0Iiwic2V0U2NhbGUiLCJfZml4UHJvalJhbmdlTWF0Iiwic2V0IiwiX3RlbXBQcm9qTWF0MCIsIl90ZW1wUHJvak1hdDEiLCJfdGVtcFByb2pNYXQyIiwiX3RlbXBQcm9qTWF0MyIsIl90ZW1wU2V0IiwiU2V0IiwiUmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiY2x1c3RlcnNEZWJ1Z1JlbmRlcmVkIiwiZGV2aWNlIiwic2NlbmUiLCJsaWdodFRleHR1cmVBdGxhcyIsIkxpZ2h0VGV4dHVyZUF0bGFzIiwic2hhZG93TWFwQ2FjaGUiLCJTaGFkb3dNYXBDYWNoZSIsInNoYWRvd1JlbmRlcmVyIiwiU2hhZG93UmVuZGVyZXIiLCJfc2hhZG93UmVuZGVyZXJMb2NhbCIsIlNoYWRvd1JlbmRlcmVyTG9jYWwiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIlNoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJfY29va2llUmVuZGVyZXIiLCJDb29raWVSZW5kZXJlciIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsIl9za2luVGltZSIsIl9tb3JwaFRpbWUiLCJfY3VsbFRpbWUiLCJfc2hhZG93TWFwVGltZSIsIl9saWdodENsdXN0ZXJzVGltZSIsIl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2tpbkRyYXdDYWxscyIsIl9pbnN0YW5jZWREcmF3Q2FsbHMiLCJfc2hhZG93TWFwVXBkYXRlcyIsIl9udW1EcmF3Q2FsbHNDdWxsZWQiLCJfY2FtZXJhc1JlbmRlcmVkIiwiX2xpZ2h0Q2x1c3RlcnMiLCJzY29wZSIsImJvbmVUZXh0dXJlSWQiLCJyZXNvbHZlIiwiYm9uZVRleHR1cmVTaXplSWQiLCJwb3NlTWF0cml4SWQiLCJtb2RlbE1hdHJpeElkIiwibm9ybWFsTWF0cml4SWQiLCJ2aWV3SW52SWQiLCJ2aWV3UG9zIiwiRmxvYXQzMkFycmF5Iiwidmlld1Bvc0lkIiwicHJvaklkIiwicHJvalNreWJveElkIiwidmlld0lkIiwidmlld0lkMyIsInZpZXdQcm9qSWQiLCJmbGlwWUlkIiwidGJuQmFzaXMiLCJuZWFyQ2xpcElkIiwiZmFyQ2xpcElkIiwiY2FtZXJhUGFyYW1zIiwiY2FtZXJhUGFyYW1zSWQiLCJhbHBoYVRlc3RJZCIsIm9wYWNpdHlNYXBJZCIsImV4cG9zdXJlSWQiLCJ0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3JJZCIsInNldFZhbHVlIiwibW9ycGhXZWlnaHRzQSIsIm1vcnBoV2VpZ2h0c0IiLCJtb3JwaFBvc2l0aW9uVGV4IiwibW9ycGhOb3JtYWxUZXgiLCJtb3JwaFRleFBhcmFtcyIsImRlc3Ryb3kiLCJzb3J0Q29tcGFyZSIsImRyYXdDYWxsQSIsImRyYXdDYWxsQiIsImxheWVyIiwiZHJhd09yZGVyIiwiemRpc3QiLCJ6ZGlzdDIiLCJfa2V5IiwiU09SVEtFWV9GT1JXQVJEIiwic29ydENvbXBhcmVNZXNoIiwia2V5QSIsImtleUIiLCJtZXNoIiwiaWQiLCJzb3J0Q29tcGFyZURlcHRoIiwiU09SVEtFWV9ERVBUSCIsInNldHVwVmlld3BvcnQiLCJjYW1lcmEiLCJyZW5kZXJUYXJnZXQiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInBpeGVsV2lkdGgiLCJ3aWR0aCIsInBpeGVsSGVpZ2h0IiwiaGVpZ2h0IiwicmVjdCIsIngiLCJNYXRoIiwiZmxvb3IiLCJ5IiwidyIsInoiLCJoIiwic2V0Vmlld3BvcnQiLCJfc2Npc3NvclJlY3RDbGVhciIsInNjaXNzb3JSZWN0Iiwic2V0U2Npc3NvciIsInBvcEdwdU1hcmtlciIsInNldENhbWVyYVVuaWZvcm1zIiwidGFyZ2V0IiwiZmxpcFkiLCJ2aWV3Q291bnQiLCJ4ciIsInNlc3Npb24iLCJ0cmFuc2Zvcm0iLCJwYXJlbnQiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwidmlld3MiLCJsZW5ndGgiLCJ2IiwidmlldyIsInZpZXdJbnZPZmZNYXQiLCJtdWwyIiwidmlld09mZk1hdCIsImNvcHkiLCJpbnZlcnQiLCJzZXRGcm9tTWF0NCIsInByb2pWaWV3T2ZmTWF0IiwicHJvak1hdCIsInBvc2l0aW9uIiwiZGF0YSIsImZydXN0dW0iLCJwcm9qZWN0aW9uTWF0cml4IiwiY2FsY3VsYXRlUHJvamVjdGlvbiIsIlZJRVdfQ0VOVEVSIiwicHJvak1hdFNreWJveCIsImdldFByb2plY3Rpb25NYXRyaXhTa3lib3giLCJpc1dlYkdQVSIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsInBvcyIsImdldFBvc2l0aW9uIiwicm90IiwiZ2V0Um90YXRpb24iLCJzZXRUUlMiLCJWZWMzIiwiT05FIiwiZGlzcGF0Y2hWaWV3UG9zIiwibiIsIl9uZWFyQ2xpcCIsImYiLCJfZmFyQ2xpcCIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsInBoeXNpY2FsVW5pdHMiLCJnZXRFeHBvc3VyZSIsImV4cG9zdXJlIiwiY2xlYXIiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsImZsYWdzIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJDTEVBUkZMQUdfQ09MT1IiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsIkNMRUFSRkxBR19ERVBUSCIsIl9jbGVhclN0ZW5jaWxCdWZmZXIiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNvbG9yIiwiX2NsZWFyQ29sb3IiLCJyIiwiZyIsImIiLCJhIiwiZGVwdGgiLCJfY2xlYXJEZXB0aCIsInN0ZW5jaWwiLCJfY2xlYXJTdGVuY2lsIiwic2V0Q2FtZXJhIiwicmVuZGVyQWN0aW9uIiwiY2xlYXJWaWV3IiwiZm9yY2VXcml0ZSIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0Q29sb3JXcml0ZSIsInNldERlcHRoV3JpdGUiLCJvcHRpb25zIiwiX2NsZWFyT3B0aW9ucyIsInNldHVwQ3VsbE1vZGUiLCJjdWxsRmFjZXMiLCJmbGlwRmFjdG9yIiwiZHJhd0NhbGwiLCJtYXRlcmlhbCIsIm1vZGUiLCJDVUxMRkFDRV9OT05FIiwiZmxpcEZhY2VzIiwiY3VsbCIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfQkFDSyIsImZsaXBGYWNlc0ZhY3RvciIsIm5vZGUiLCJ3b3JsZFNjYWxlU2lnbiIsInNldEN1bGxNb2RlIiwidXBkYXRlQ2FtZXJhRnJ1c3R1bSIsInNldEJhc2VDb25zdGFudHMiLCJvcGFjaXR5TWFwIiwiYWxwaGFUZXN0IiwidXBkYXRlQ3B1U2tpbk1hdHJpY2VzIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJza2luVGltZSIsIm5vdyIsImkiLCJzaSIsInNraW5JbnN0YW5jZSIsInVwZGF0ZU1hdHJpY2VzIiwiX2RpcnR5IiwidXBkYXRlR3B1U2tpbk1hdHJpY2VzIiwiY291bnQiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwic2tpbiIsInVwZGF0ZU1hdHJpeFBhbGV0dGUiLCJ1cGRhdGVNb3JwaGluZyIsIm1vcnBoVGltZSIsIm1vcnBoSW5zdCIsIm1vcnBoSW5zdGFuY2UiLCJ1cGRhdGUiLCJncHVVcGRhdGUiLCJzZXRWZXJ0ZXhCdWZmZXJzIiwic2V0VmVydGV4QnVmZmVyIiwidmVydGV4QnVmZmVyIiwic2V0TW9ycGhpbmciLCJtb3JwaCIsInVzZVRleHR1cmVNb3JwaCIsInZlcnRleEJ1ZmZlcklkcyIsInRleHR1cmVQb3NpdGlvbnMiLCJ0ZXh0dXJlTm9ybWFscyIsIl90ZXh0dXJlUGFyYW1zIiwidCIsIl9hY3RpdmVWZXJ0ZXhCdWZmZXJzIiwidmIiLCJzZW1hbnRpYyIsIlNFTUFOVElDX0FUVFIiLCJmb3JtYXQiLCJlbGVtZW50cyIsIm5hbWUiLCJzY29wZUlkIiwiX3NoYWRlck1vcnBoV2VpZ2h0c0EiLCJfc2hhZGVyTW9ycGhXZWlnaHRzQiIsInNldFNraW5uaW5nIiwibWVzaEluc3RhbmNlIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJib25lVGV4dHVyZSIsIm1hdHJpeFBhbGV0dGUiLCJ2cCIsImluaXRWaWV3QmluZEdyb3VwRm9ybWF0IiwiaXNDbHVzdGVyZWQiLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwidW5pZm9ybXMiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfTUFUNCIsIlVOSUZPUk1UWVBFX01BVDMiLCJVTklGT1JNVFlQRV9WRUMzIiwiVU5JRk9STVRZUEVfRkxPQVQiLCJwdXNoIiwiVU5JRk9STVRZUEVfVkVDMiIsIlVOSUZPUk1UWVBFX0lOVCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJidWZmZXJzIiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJ0ZXh0dXJlcyIsIkJpbmRUZXh0dXJlRm9ybWF0IiwiVEVYVFVSRURJTUVOU0lPTl8yRCIsIlNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUIiwiU0FNUExFVFlQRV9ERVBUSCIsIlNBTVBMRVRZUEVfRkxPQVQiLCJCaW5kR3JvdXBGb3JtYXQiLCJzZXR1cFZpZXdVbmlmb3JtQnVmZmVycyIsInZpZXdCaW5kR3JvdXBzIiwiRGVidWciLCJhc3NlcnQiLCJBcnJheSIsImlzQXJyYXkiLCJ1YiIsIlVuaWZvcm1CdWZmZXIiLCJiZyIsIkJpbmRHcm91cCIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsInZpZXdCaW5kR3JvdXAiLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsInNldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9WSUVXIiwic2V0dXBNZXNoVW5pZm9ybUJ1ZmZlcnMiLCJwYXNzIiwid29ybGRUcmFuc2Zvcm0iLCJub3JtYWxNYXRyaXgiLCJtZXNoQmluZEdyb3VwIiwiZ2V0QmluZEdyb3VwIiwiQklOREdST1VQX01FU0giLCJkcmF3SW5zdGFuY2UiLCJzdHlsZSIsIm5vcm1hbCIsImluc3RhbmNpbmdEYXRhIiwiZHJhdyIsInByaW1pdGl2ZSIsIm1vZGVsTWF0cml4IiwiZHJhd0luc3RhbmNlMiIsInVuZGVmaW5lZCIsInZpc2libGVMaXN0IiwiY3VsbFRpbWUiLCJudW1EcmF3Q2FsbHNDdWxsZWQiLCJ2aXNpYmxlTGVuZ3RoIiwiY3VsbGluZ01hc2siLCJmcnVzdHVtQ3VsbGluZyIsInZpc2libGUiLCJjb21tYW5kIiwibWFzayIsIl9pc1Zpc2libGUiLCJjdWxsTGlnaHRzIiwibGlnaHRzIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHQiLCJlbmFibGVkIiwiX3R5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJnZXRCb3VuZGluZ1NwaGVyZSIsImNvbnRhaW5zU3BoZXJlIiwidXNlUGh5c2ljYWxVbml0cyIsInNjcmVlblNpemUiLCJnZXRTY3JlZW5TaXplIiwibWF4U2NyZWVuU2l6ZSIsIm1heCIsImNhc3RTaGFkb3dzIiwic2hhZG93TWFwIiwiY3VsbFNoYWRvd21hcHMiLCJjb21wIiwiX2xpZ2h0cyIsImF0bGFzU2xvdFVwZGF0ZWQiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiY2FzdGVycyIsIl9saWdodENvbXBvc2l0aW9uRGF0YSIsInNoYWRvd0Nhc3RlcnNMaXN0IiwicmVuZGVyQWN0aW9ucyIsIl9yZW5kZXJBY3Rpb25zIiwiZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzIiwiaiIsImxpZ2h0SW5kZXgiLCJjdWxsQ29tcG9zaXRpb24iLCJsYXllckluZGV4IiwibGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckxpc3QiLCJjYW1lcmFQYXNzIiwiY2FtZXJhSW5kZXgiLCJjYW1lcmFzIiwiZnJhbWVVcGRhdGUiLCJmaXJzdENhbWVyYVVzZSIsIm9iamVjdHMiLCJpbnN0YW5jZXMiLCJ2aXNpYmxlVHJhbnNwYXJlbnQiLCJ2aXNpYmxlT3BhcXVlIiwiZG9uZSIsIm9uUHJlQ3VsbCIsInRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJsaXN0Iiwib25Qb3N0Q3VsbCIsInVwZGF0ZUxpZ2h0VGV4dHVyZUF0bGFzIiwidXBkYXRlU2hhZGVycyIsIm9ubHlMaXRTaGFkZXJzIiwibWF0IiwiaGFzIiwiYWRkIiwiZ2V0U2hhZGVyVmFyaWFudCIsIk1hdGVyaWFsIiwicHJvdG90eXBlIiwidXNlTGlnaHRpbmciLCJlbWl0dGVyIiwibGlnaHRpbmciLCJjbGVhclZhcmlhbnRzIiwicmVuZGVyQ29va2llcyIsImNvb2tpZVJlbmRlclRhcmdldCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJyZW5kZXIiLCJiZWdpbkZyYW1lIiwibGlnaHRzQ2hhbmdlZCIsIm1lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlcyIsIl9zaGFkZXJWZXJzaW9uIiwibWlDb3VudCIsImxpZ2h0Q291bnQiLCJfc3BsaXRMaWdodHMiLCJMSUdIVFRZUEVfU1BPVCIsIkxJR0hUVFlQRV9PTU5JIiwidXBkYXRlQ2x1c3RlcnMiLCJzdGFydFRpbWUiLCJlbXB0eVdvcmxkQ2x1c3RlcnMiLCJnZXRFbXB0eVdvcmxkQ2x1c3RlcnMiLCJjbHVzdGVyIiwibGlnaHRDbHVzdGVycyIsImNsdXN0ZXJlZExpZ2h0c1NldCIsImdhbW1hQ29ycmVjdGlvbiIsIl93b3JsZENsdXN0ZXJzIiwidXBkYXRlTGF5ZXJDb21wb3NpdGlvbiIsImxheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwibGVuIiwiX3Bvc3RSZW5kZXJDb3VudGVyIiwic2hhZGVyVmVyc2lvbiIsIl9za2lwUmVuZGVyQ291bnRlciIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiX3JlbmRlclRpbWUiLCJfcHJlUmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsIl9wb3N0UmVuZGVyQ2FsbGVkRm9yQ2FtZXJhcyIsIl9wb3N0UmVuZGVyQ291bnRlck1heCIsInByZXBhcmUiLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiX3N0YXRpY0xpZ2h0SGFzaCIsIl9zdGF0aWNQcmVwYXJlRG9uZSIsIlN0YXRpY01lc2hlcyIsInJldmVydCIsInVwZGF0ZWQiLCJfdXBkYXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0NBLElBQUlBLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtBQUN4QixNQUFNQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNwQyxNQUFNQyxXQUFXLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDOUIsTUFBTUMsVUFBVSxHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBQzdCLE1BQU1FLE9BQU8sR0FBRyxJQUFJRixJQUFJLEVBQUUsQ0FBQTtBQUMxQixNQUFNRyxRQUFRLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTUMsVUFBVSxHQUFHLElBQUlDLGNBQWMsRUFBRSxDQUFBO0FBQ3ZDLE1BQU1DLFNBQVMsR0FBRyxJQUFJUCxJQUFJLEVBQUUsQ0FBQ1EsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTs7QUFFL0M7QUFDQSxNQUFNQyxnQkFBZ0IsR0FBRyxJQUFJVCxJQUFJLEVBQUUsQ0FBQ1UsR0FBRyxDQUFDLENBQ3BDLENBQUMs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
