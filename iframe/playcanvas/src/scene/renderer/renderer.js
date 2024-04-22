import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { LightCube } from '../graphics/light-cube.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_FRONT, CULLFACE_BACK, CULLFACE_NONE, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT3, UNIFORMTYPE_VEC3, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_INT, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, BINDGROUP_VIEW, BINDGROUP_MESH, SEMANTIC_ATTR } from '../../platform/graphics/constants.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindUniformBufferFormat, BindTextureFormat, BindGroupFormat } from '../../platform/graphics/bind-group-format.js';
import { ShadowMapCache } from './shadow-map-cache.js';
import { ShadowRendererLocal } from './shadow-renderer-local.js';
import { ShadowRendererDirectional } from './shadow-renderer-directional.js';
import { ShadowRenderer } from './shadow-renderer.js';
import { WorldClustersAllocator } from './world-clusters-allocator.js';
import { RenderPassUpdateClustered } from './render-pass-update-clustered.js';
import { getBlueNoiseTexture } from '../graphics/noise-textures.js';
import { BlueNoise } from '../../core/math/blue-noise.js';

let _skinUpdateIndex = 0;
const viewProjMat = new Mat4();
const viewInvMat = new Mat4();
const viewMat = new Mat4();
const viewMat3 = new Mat3();
const tempSphere = new BoundingSphere();
const _flipYMat = new Mat4().setScale(1, -1, 1);
const _tempLightSet = new Set();
const _tempLayerSet = new Set();
const _fixProjRangeMat = new Mat4().set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);
const _haltonSequence = [new Vec2(0.5, 0.333333), new Vec2(0.25, 0.666667), new Vec2(0.75, 0.111111), new Vec2(0.125, 0.444444), new Vec2(0.625, 0.777778), new Vec2(0.375, 0.222222), new Vec2(0.875, 0.555556), new Vec2(0.0625, 0.888889), new Vec2(0.5625, 0.037037), new Vec2(0.3125, 0.370370), new Vec2(0.8125, 0.703704), new Vec2(0.1875, 0.148148), new Vec2(0.6875, 0.481481), new Vec2(0.4375, 0.814815), new Vec2(0.9375, 0.259259), new Vec2(0.03125, 0.592593)];
const _tempProjMat0 = new Mat4();
const _tempProjMat1 = new Mat4();
const _tempProjMat2 = new Mat4();
const _tempProjMat3 = new Mat4();
const _tempProjMat4 = new Mat4();
const _tempProjMat5 = new Mat4();
const _tempSet = new Set();
const _tempMeshInstances = [];
const _tempMeshInstancesSkinned = [];
class Renderer {
  constructor(graphicsDevice) {
    this.clustersDebugRendered = false;
    this.processingMeshInstances = new Set();
    this.worldClustersAllocator = void 0;
    this.lights = [];
    this.localLights = [];
    this.cameraDirShadowLights = new Map();
    this.dirLightShadows = new Map();
    this.blueNoise = new BlueNoise(123);
    this.device = graphicsDevice;
    this.scene = null;
    this.worldClustersAllocator = new WorldClustersAllocator(graphicsDevice);
    this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);
    this.shadowMapCache = new ShadowMapCache();
    this.shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
    this._shadowRendererLocal = new ShadowRendererLocal(this, this.shadowRenderer);
    this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.shadowRenderer);
    this._renderPassUpdateClustered = new RenderPassUpdateClustered(this.device, this, this.shadowRenderer, this._shadowRendererLocal, this.lightTextureAtlas);
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
    this.viewIndexId = scope.resolve('view_index');
    this.blueNoiseJitterVersion = 0;
    this.blueNoiseJitterVec = new Vec4();
    this.blueNoiseJitterData = new Float32Array(4);
    this.blueNoiseJitterId = scope.resolve('blueNoiseJitter');
    this.blueNoiseTextureId = scope.resolve('blueNoiseTex32');
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
    this.lightCube = new LightCube();
    this.constantLightCube = scope.resolve('lightCube[0]');
  }
  destroy() {
    this.shadowRenderer = null;
    this._shadowRendererLocal = null;
    this._shadowRendererDirectional = null;
    this.shadowMapCache.destroy();
    this.shadowMapCache = null;
    this._renderPassUpdateClustered.destroy();
    this._renderPassUpdateClustered = null;
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
  }
  setCameraUniforms(camera, target) {
    const flipY = target == null ? void 0 : target.flipY;
    let viewCount = 1;
    if (camera.xr && camera.xr.session) {
      var _camera$_node;
      const transform = ((_camera$_node = camera._node) == null || (_camera$_node = _camera$_node.parent) == null ? void 0 : _camera$_node.getWorldTransform()) || null;
      const views = camera.xr.views;
      viewCount = views.list.length;
      for (let v = 0; v < viewCount; v++) {
        const view = views.list[v];
        view.updateTransforms(transform);
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
      if (this.device.isWebGPU) {
        projMat = _tempProjMat2.mul2(_fixProjRangeMat, projMat);
        projMatSkybox = _tempProjMat3.mul2(_fixProjRangeMat, projMatSkybox);
      }
      const {
        jitter
      } = camera;
      let jitterX = 0;
      let jitterY = 0;
      if (jitter > 0) {
        const targetWidth = target ? target.width : this.device.width;
        const targetHeight = target ? target.height : this.device.height;
        const offset = _haltonSequence[this.device.renderVersion % _haltonSequence.length];
        jitterX = jitter * (offset.x * 2 - 1) / targetWidth;
        jitterY = jitter * (offset.y * 2 - 1) / targetHeight;
        projMat = _tempProjMat4.copy(projMat);
        projMat.data[8] = jitterX;
        projMat.data[9] = jitterY;
        projMatSkybox = _tempProjMat5.copy(projMatSkybox);
        projMatSkybox.data[8] = jitterX;
        projMatSkybox.data[9] = jitterY;
        if (this.blueNoiseJitterVersion !== this.device.renderVersion) {
          this.blueNoiseJitterVersion = this.device.renderVersion;
          this.blueNoise.vec4(this.blueNoiseJitterVec);
        }
      }
      const jitterVec = jitter > 0 ? this.blueNoiseJitterVec : Vec4.ZERO;
      this.blueNoiseJitterData[0] = jitterVec.x;
      this.blueNoiseJitterData[1] = jitterVec.y;
      this.blueNoiseJitterData[2] = jitterVec.z;
      this.blueNoiseJitterData[3] = jitterVec.w;
      this.blueNoiseJitterId.setValue(this.blueNoiseJitterData);
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
      camera._storeShaderMatrices(viewProjMat, jitterX, jitterY, this.device.renderVersion);
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
    return viewCount;
  }
  clear(camera, clearColor, clearDepth, clearStencil) {
    const flags = ((clearColor != null ? clearColor : camera._clearColorBuffer) ? CLEARFLAG_COLOR : 0) | ((clearDepth != null ? clearDepth : camera._clearDepthBuffer) ? CLEARFLAG_DEPTH : 0) | ((clearStencil != null ? clearStencil : camera._clearStencilBuffer) ? CLEARFLAG_STENCIL : 0);
    if (flags) {
      const device = this.device;
      device.clear({
        color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
        depth: camera._clearDepth,
        stencil: camera._clearStencil,
        flags: flags
      });
    }
  }
  setCamera(camera, target, clear, renderAction = null) {
    this.setCameraUniforms(camera, target);
    this.clearView(camera, target, clear, false);
  }
  clearView(camera, target, clear, forceWrite) {
    const device = this.device;
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
    if (camera.xr && camera.xr.views.list.length) {
      const view = camera.xr.views.list[0];
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
    }
    if (material.opacityMap || material.alphaTest > 0) {
      this.alphaTestId.setValue(material.alphaTest);
    }
  }
  updateCpuSkinMatrices(drawCalls) {
    _skinUpdateIndex++;
    const drawCallsCount = drawCalls.length;
    if (drawCallsCount === 0) return;
    for (let i = 0; i < drawCallsCount; i++) {
      const si = drawCalls[i].skinInstance;
      if (si) {
        si.updateMatrices(drawCalls[i].node, _skinUpdateIndex);
        si._dirty = true;
      }
    }
  }
  updateGpuSkinMatrices(drawCalls) {
    for (const drawCall of drawCalls) {
      const skin = drawCall.skinInstance;
      if (skin && skin._dirty) {
        skin.updateMatrixPalette(drawCall.node, _skinUpdateIndex);
        skin._dirty = false;
      }
    }
  }
  updateMorphing(drawCalls) {
    for (const drawCall of drawCalls) {
      const morphInst = drawCall.morphInstance;
      if (morphInst && morphInst._dirty) {
        morphInst.update();
      }
    }
  }
  updateGSplats(drawCalls) {
    for (const drawCall of drawCalls) {
      var _drawCall$gsplatInsta;
      (_drawCall$gsplatInsta = drawCall.gsplatInstance) == null || _drawCall$gsplatInsta.update();
    }
  }
  gpuUpdate(drawCalls) {
    this.updateGpuSkinMatrices(drawCalls);
    this.updateMorphing(drawCalls);
    this.updateGSplats(drawCalls);
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
    const skinInstance = meshInstance.skinInstance;
    if (skinInstance) {
      this._skinDrawCalls++;
      if (device.supportsBoneTextures) {
        const boneTexture = skinInstance.boneTexture;
        this.boneTextureId.setValue(boneTexture);
        this.boneTextureSizeId.setValue(skinInstance.boneTextureSize);
      } else {
        this.poseMatrixId.setValue(skinInstance.matrixPalette);
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
  initViewBindGroupFormat(isClustered) {
    if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
      const uniforms = [new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4), new UniformFormat("cubeMapRotationMatrix", UNIFORMTYPE_MAT3), new UniformFormat("view_position", UNIFORMTYPE_VEC3), new UniformFormat("skyboxIntensity", UNIFORMTYPE_FLOAT), new UniformFormat("exposure", UNIFORMTYPE_FLOAT), new UniformFormat("textureBias", UNIFORMTYPE_FLOAT)];
      if (isClustered) {
        uniforms.push(...[new UniformFormat("clusterCellsCountByBoundsSize", UNIFORMTYPE_VEC3), new UniformFormat("clusterTextureSize", UNIFORMTYPE_VEC3), new UniformFormat("clusterBoundsMin", UNIFORMTYPE_VEC3), new UniformFormat("clusterBoundsDelta", UNIFORMTYPE_VEC3), new UniformFormat("clusterCellsDot", UNIFORMTYPE_VEC3), new UniformFormat("clusterCellsMax", UNIFORMTYPE_VEC3), new UniformFormat("clusterCompressionLimit0", UNIFORMTYPE_VEC2), new UniformFormat("shadowAtlasParams", UNIFORMTYPE_VEC2), new UniformFormat("clusterMaxCells", UNIFORMTYPE_INT), new UniformFormat("clusterSkip", UNIFORMTYPE_FLOAT)]);
      }
      this.viewUniformFormat = new UniformBufferFormat(this.device, uniforms);
      const formats = [new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT), new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT), new BindTextureFormat('shadowAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH), new BindTextureFormat('cookieAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT), new BindTextureFormat('areaLightsLutTex1', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT), new BindTextureFormat('areaLightsLutTex2', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT)];
      if (isClustered) {
        formats.push(...[new BindTextureFormat('clusterWorldTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)]);
      }
      this.viewBindGroupFormat = new BindGroupFormat(this.device, formats);
    }
  }
  setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {
    const device = this.device;
    while (viewBindGroups.length < viewCount) {
      const ub = new UniformBuffer(device, viewUniformFormat, false);
      const bg = new BindGroup(device, viewBindGroupFormat, ub);
      viewBindGroups.push(bg);
    }
    const viewBindGroup = viewBindGroups[0];
    viewBindGroup.defaultUniformBuffer.update();
    viewBindGroup.update();
    device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
  }
  setupMeshUniformBuffers(shaderInstance, meshInstance) {
    const device = this.device;
    if (device.supportsUniformBuffers) {
      this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
      this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
      const meshBindGroup = shaderInstance.getBindGroup(device);
      meshBindGroup.defaultUniformBuffer.update();
      meshBindGroup.update();
      device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
    }
  }
  drawInstance(device, meshInstance, mesh, style, normal) {
    const modelMatrix = meshInstance.node.worldTransform;
    this.modelMatrixId.setValue(modelMatrix.data);
    if (normal) {
      this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
    }
    const instancingData = meshInstance.instancingData;
    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.setVertexBuffer(instancingData.vertexBuffer);
        device.draw(mesh.primitive[style], instancingData.count);
      } else {
        device.clearVertexBuffer();
      }
    } else {
      device.draw(mesh.primitive[style]);
    }
  }
  drawInstance2(device, meshInstance, mesh, style) {
    const instancingData = meshInstance.instancingData;
    if (instancingData) {
      if (instancingData.count > 0) {
        this._instancedDrawCalls++;
        device.draw(mesh.primitive[style], instancingData.count, true);
      } else {
        device.clearVertexBuffer();
      }
    } else {
      device.draw(mesh.primitive[style], undefined, true);
    }
  }
  cull(camera, drawCalls, culledInstances) {
    const opaque = culledInstances.opaque;
    opaque.length = 0;
    const transparent = culledInstances.transparent;
    transparent.length = 0;
    const doCull = camera.frustumCulling;
    const count = drawCalls.length;
    for (let i = 0; i < count; i++) {
      const drawCall = drawCalls[i];
      if (drawCall.visible) {
        const visible = !doCull || !drawCall.cull || drawCall._isVisible(camera);
        if (visible) {
          drawCall.visibleThisFrame = true;
          const bucket = drawCall.transparent ? transparent : opaque;
          bucket.push(drawCall);
          if (drawCall.skinInstance || drawCall.morphInstance || drawCall.gsplatInstance) {
            this.processingMeshInstances.add(drawCall);
            if (drawCall.gsplatInstance) {
              drawCall.gsplatInstance.cameras.push(camera);
            }
          }
        }
      }
    }
  }
  collectLights(comp) {
    this.lights.length = 0;
    this.localLights.length = 0;
    const stats = this.scene._stats;
    const count = comp.layerList.length;
    for (let i = 0; i < count; i++) {
      const layer = comp.layerList[i];
      if (!_tempLayerSet.has(layer)) {
        _tempLayerSet.add(layer);
        const lights = layer._lights;
        for (let j = 0; j < lights.length; j++) {
          const light = lights[j];
          if (!_tempLightSet.has(light)) {
            _tempLightSet.add(light);
            this.lights.push(light);
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {
              this.localLights.push(light);
            }
          }
        }
      }
    }
    stats.lights = this.lights.length;
    _tempLightSet.clear();
    _tempLayerSet.clear();
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
    const isClustered = this.scene.clusteredLightingEnabled;
    for (let i = 0; i < this.localLights.length; i++) {
      const light = this.localLights[i];
      if (light._type !== LIGHTTYPE_DIRECTIONAL) {
        if (isClustered) {
          if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
          }
        } else {
          if (light.shadowUpdateMode === SHADOWUPDATE_NONE && light.castShadows) {
            if (!light.getRenderData(null, 0).shadowCamera.renderTarget) {
              light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
            }
          }
        }
        if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
          this._shadowRendererLocal.cull(light, comp);
        }
      }
    }
    this.cameraDirShadowLights.clear();
    const cameras = comp.cameras;
    for (let i = 0; i < cameras.length; i++) {
      const cameraComponent = cameras[i];
      if (cameraComponent.enabled) {
        const camera = cameraComponent.camera;
        let lightList;
        const cameraLayers = camera.layers;
        for (let l = 0; l < cameraLayers.length; l++) {
          const cameraLayer = comp.getLayerById(cameraLayers[l]);
          if (cameraLayer) {
            const layerDirLights = cameraLayer.splitLights[LIGHTTYPE_DIRECTIONAL];
            for (let j = 0; j < layerDirLights.length; j++) {
              const light = layerDirLights[j];
              if (light.castShadows && !_tempSet.has(light)) {
                var _lightList;
                _tempSet.add(light);
                lightList = (_lightList = lightList) != null ? _lightList : [];
                lightList.push(light);
                this._shadowRendererDirectional.cull(light, comp, camera);
              }
            }
          }
        }
        if (lightList) {
          this.cameraDirShadowLights.set(camera, lightList);
        }
        _tempSet.clear();
      }
    }
  }
  cullComposition(comp) {
    this.processingMeshInstances.clear();
    const numCameras = comp.cameras.length;
    for (let i = 0; i < numCameras; i++) {
      const camera = comp.cameras[i];
      let currentRenderTarget;
      let cameraChanged = true;
      this._camerasRendered++;
      const layerIds = camera.layers;
      for (let j = 0; j < layerIds.length; j++) {
        const layer = comp.getLayerById(layerIds[j]);
        if (layer && layer.enabled) {
          var _camera$renderTarget;
          const renderTarget = (_camera$renderTarget = camera.renderTarget) != null ? _camera$renderTarget : layer.renderTarget;
          if (cameraChanged || renderTarget !== currentRenderTarget) {
            cameraChanged = false;
            currentRenderTarget = renderTarget;
            camera.frameUpdate(renderTarget);
            this.updateCameraFrustum(camera.camera);
          }
          this.cullLights(camera.camera, layer._lights);
          layer.onPreCull == null || layer.onPreCull(comp.camerasMap.get(camera));
          const culledInstances = layer.getCulledInstances(camera.camera);
          this.cull(camera.camera, layer.meshInstances, culledInstances);
          layer.onPostCull == null || layer.onPostCull(comp.camerasMap.get(camera));
        }
      }
    }
    if (this.scene.clusteredLightingEnabled) {
      this.updateLightTextureAtlas();
    }
    this.cullShadowmaps(comp);
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
  updateFrameUniforms() {
    this.blueNoiseTextureId.setValue(getBlueNoiseTexture(this.device));
  }
  beginFrame(comp) {
    const scene = this.scene;
    const updateShaders = scene.updateShaders;
    const layers = comp.layerList;
    const layerCount = layers.length;
    for (let i = 0; i < layerCount; i++) {
      const layer = layers[i];
      const meshInstances = layer.meshInstances;
      const count = meshInstances.length;
      for (let j = 0; j < count; j++) {
        const meshInst = meshInstances[j];
        meshInst.visibleThisFrame = false;
        if (updateShaders) {
          _tempMeshInstances.push(meshInst);
        }
        if (meshInst.skinInstance) {
          _tempMeshInstancesSkinned.push(meshInst);
        }
      }
    }
    if (updateShaders) {
      const onlyLitShaders = !scene.updateShaders;
      this.updateShaders(_tempMeshInstances, onlyLitShaders);
      scene.updateShaders = false;
      scene._shaderVersion++;
    }
    this.updateFrameUniforms();
    this.updateCpuSkinMatrices(_tempMeshInstancesSkinned);
    _tempMeshInstances.length = 0;
    _tempMeshInstancesSkinned.length = 0;
    const lights = this.lights;
    const lightCount = lights.length;
    for (let i = 0; i < lightCount; i++) {
      lights[i].beginFrame();
    }
  }
  updateLightTextureAtlas() {
    this.lightTextureAtlas.update(this.localLights, this.scene.lighting);
  }
  updateLayerComposition(comp) {
    const len = comp.layerList.length;
    for (let i = 0; i < len; i++) {
      comp.layerList[i]._postRenderCounter = 0;
    }
    const scene = this.scene;
    const shaderVersion = scene._shaderVersion;
    for (let i = 0; i < len; i++) {
      const layer = comp.layerList[i];
      layer._shaderVersion = shaderVersion;
      layer._preRenderCalledForCameras = 0;
      layer._postRenderCalledForCameras = 0;
      const transparent = comp.subLayerList[i];
      if (transparent) {
        layer._postRenderCounter |= 2;
      } else {
        layer._postRenderCounter |= 1;
      }
      layer._postRenderCounterMax = layer._postRenderCounter;
    }
    comp._update();
  }
  frameUpdate() {
    this.clustersDebugRendered = false;
    this.initViewBindGroupFormat(this.scene.clusteredLightingEnabled);
    this.dirLightShadows.clear();
  }
}

export { Renderer };
