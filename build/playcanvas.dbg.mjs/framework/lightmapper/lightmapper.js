/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, CHUNKAPI_1_55, CULLFACE_NONE, TEXHINT_LIGHTMAP, TEXTURETYPE_DEFAULT, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { LightingParams } from '../../scene/lighting/lighting-params.js';
import { WorldClusters } from '../../scene/lighting/world-clusters.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../scene/shader-lib/chunks/chunks-lightmapper.js';
import { PROJECTION_ORTHOGRAPHIC, MASK_AFFECT_LIGHTMAPPED, BAKE_COLORDIR, MASK_BAKE, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, FOG_NONE, LIGHTTYPE_SPOT, PROJECTION_PERSPECTIVE, LIGHTTYPE_OMNI, SHADER_FORWARDHDR, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT } from '../../scene/constants.js';
import { Camera } from '../../scene/camera.js';
import { GraphNode } from '../../scene/graph-node.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { BakeLightSimple } from './bake-light-simple.js';
import { BakeLightAmbient } from './bake-light-ambient.js';
import { BakeMeshNode } from './bake-mesh-node.js';
import { LightmapCache } from '../../scene/graphics/lightmap-cache.js';
import { LightmapFilters } from './lightmap-filters.js';

const MAX_LIGHTMAP_SIZE = 2048;
const PASS_COLOR = 0;
const PASS_DIR = 1;
const tempVec = new Vec3();

/**
 * The lightmapper is used to bake scene lights into textures.
 */
class Lightmapper {
  /**
   * Create a new Lightmapper instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device used by the lightmapper.
   * @param {import('../entity.js').Entity} root - The root entity of the scene.
   * @param {import('../../scene/scene.js').Scene} scene - The scene to lightmap.
   * @param {import('../../scene/renderer/forward-renderer.js').ForwardRenderer} renderer - The
   * renderer.
   * @param {import('../asset/asset-registry.js').AssetRegistry} assets - Registry of assets to
   * lightmap.
   * @hideconstructor
   */
  constructor(device, root, scene, renderer, assets) {
    this.device = device;
    this.root = root;
    this.scene = scene;
    this.renderer = renderer;
    this.assets = assets;
    this.shadowMapCache = renderer.shadowMapCache;
    this._tempSet = new Set();
    this._initCalled = false;

    // internal materials used by baking
    this.passMaterials = [];
    this.ambientAOMaterial = null;
    this.fog = '';
    this.ambientLight = new Color();

    // dictionary of spare render targets with color buffer for each used size
    this.renderTargets = new Map();
    this.stats = {
      renderPasses: 0,
      lightmapCount: 0,
      totalRenderTime: 0,
      forwardTime: 0,
      fboTime: 0,
      shadowMapTime: 0,
      compileTime: 0,
      shadersLinked: 0
    };
  }
  destroy() {
    // release reference to the texture
    LightmapCache.decRef(this.blackTex);
    this.blackTex = null;

    // destroy all lightmaps
    LightmapCache.destroy();
    this.device = null;
    this.root = null;
    this.scene = null;
    this.renderer = null;
    this.assets = null;
  }
  initBake(device) {
    // only initialize one time
    if (!this._initCalled) {
      this._initCalled = true;

      // lightmap filtering shaders
      this.lightmapFilters = new LightmapFilters(device);

      // shader related
      this.constantBakeDir = device.scope.resolve('bakeDir');
      this.materials = [];

      // small black texture
      this.blackTex = new Texture(this.device, {
        width: 4,
        height: 4,
        format: PIXELFORMAT_RGBA8,
        type: TEXTURETYPE_RGBM,
        name: 'lightmapBlack'
      });

      // incref black texture in the cache to avoid it being destroyed
      LightmapCache.incRef(this.blackTex);

      // camera used for baking
      const camera = new Camera();
      camera.clearColor.set(0, 0, 0, 0);
      camera.clearColorBuffer = true;
      camera.clearDepthBuffer = false;
      camera.clearStencilBuffer = false;
      camera.frustumCulling = false;
      camera.projection = PROJECTION_ORTHOGRAPHIC;
      camera.aspectRatio = 1;
      camera.node = new GraphNode();
      this.camera = camera;
    }

    // create light cluster structure
    if (this.scene.clusteredLightingEnabled) {
      // create light params, and base most parameters on the lighting params of the scene
      const lightingParams = new LightingParams(device.supportsAreaLights, device.maxTextureSize, () => {});
      this.lightingParams = lightingParams;
      const srcParams = this.scene.lighting;
      lightingParams.shadowsEnabled = srcParams.shadowsEnabled;
      lightingParams.shadowAtlasResolution = srcParams.shadowAtlasResolution;
      lightingParams.cookiesEnabled = srcParams.cookiesEnabled;
      lightingParams.cookieAtlasResolution = srcParams.cookieAtlasResolution;
      lightingParams.areaLightsEnabled = srcParams.areaLightsEnabled;

      // some custom lightmapping params - we bake single light a time
      lightingParams.cells = new Vec3(3, 3, 3);
      lightingParams.maxLightsPerCell = 4;
      this.worldClusters = new WorldClusters(device);
      this.worldClusters.name = 'ClusterLightmapper';
    }
  }
  finishBake(bakeNodes) {
    this.materials = [];
    function destroyRT(rt) {
      // this can cause ref count to be 0 and texture destroyed
      LightmapCache.decRef(rt.colorBuffer);

      // destroy render target itself
      rt.destroy();
    }

    // spare render targets including color buffer
    this.renderTargets.forEach(rt => {
      destroyRT(rt);
    });
    this.renderTargets.clear();

    // destroy render targets from nodes (but not color buffer)
    bakeNodes.forEach(node => {
      node.renderTargets.forEach(rt => {
        destroyRT(rt);
      });
      node.renderTargets.length = 0;
    });

    // this shader is only valid for specific brightness and contrast values, dispose it
    this.ambientAOMaterial = null;

    // delete light cluster
    if (this.worldClusters) {
      this.worldClusters.destroy();
      this.worldClusters = null;
    }
  }
  createMaterialForPass(device, scene, pass, addAmbient) {
    const material = new StandardMaterial();
    material.name = `lmMaterial-pass:${pass}-ambient:${addAmbient}`;
    material.chunks.APIVersion = CHUNKAPI_1_55;
    material.chunks.transformVS = '#define UV1LAYOUT\n' + shaderChunks.transformVS; // draw UV1

    if (pass === PASS_COLOR) {
      let bakeLmEndChunk = shaderChunksLightmapper.bakeLmEndPS; // encode to RGBM
      if (addAmbient) {
        // diffuse light stores accumulated AO, apply contrast and brightness to it
        // and multiply ambient light color by the AO
        bakeLmEndChunk = `
                    dDiffuseLight = ((dDiffuseLight - 0.5) * max(${scene.ambientBakeOcclusionContrast.toFixed(1)} + 1.0, 0.0)) + 0.5;
                    dDiffuseLight += vec3(${scene.ambientBakeOcclusionBrightness.toFixed(1)});
                    dDiffuseLight = saturate(dDiffuseLight);
                    dDiffuseLight *= dAmbientLight;
                ` + bakeLmEndChunk;
      } else {
        material.ambient = new Color(0, 0, 0); // don't bake ambient
        material.ambientTint = true;
      }
      material.chunks.basePS = shaderChunks.basePS + (scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? '\n#define LIGHTMAP_RGBM\n' : '');
      material.chunks.endPS = bakeLmEndChunk;
      material.lightMap = this.blackTex;
    } else {
      material.chunks.basePS = shaderChunks.basePS + '\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n';
      material.chunks.endPS = shaderChunksLightmapper.bakeDirLmEndPS;
    }

    // avoid writing unrelated things to alpha
    material.chunks.outputAlphaPS = '\n';
    material.chunks.outputAlphaOpaquePS = '\n';
    material.chunks.outputAlphaPremulPS = '\n';
    material.cull = CULLFACE_NONE;
    material.forceUv1 = true; // provide data to xformUv1
    material.update();
    return material;
  }
  createMaterials(device, scene, passCount) {
    for (let pass = 0; pass < passCount; pass++) {
      if (!this.passMaterials[pass]) {
        this.passMaterials[pass] = this.createMaterialForPass(device, scene, pass, false);
      }
    }

    // material used on last render of ambient light to multiply accumulated AO in lightmap by ambient light
    if (!this.ambientAOMaterial) {
      this.ambientAOMaterial = this.createMaterialForPass(device, scene, 0, true);
      this.ambientAOMaterial.onUpdateShader = function (options) {
        // mark LM as without ambient, to add it
        options.litOptions.lightMapWithoutAmbient = true;
        // don't add ambient to diffuse directly but keep it separate, to allow AO to be multiplied in
        options.litOptions.separateAmbient = true;
        return options;
      };
    }
  }
  createTexture(size, name) {
    return new Texture(this.device, {
      profilerHint: TEXHINT_LIGHTMAP,
      width: size,
      height: size,
      format: this.scene.lightmapPixelFormat,
      mipmaps: false,
      type: this.scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      name: name
    });
  }

  // recursively walk the hierarchy of nodes starting at the specified node
  // collect all nodes that need to be lightmapped to bakeNodes array
  // collect all nodes with geometry to allNodes array
  collectModels(node, bakeNodes, allNodes) {
    var _node$model, _node$model2, _node$render;
    if (!node.enabled) return;

    // mesh instances from model component
    let meshInstances;
    if ((_node$model = node.model) != null && _node$model.model && (_node$model2 = node.model) != null && _node$model2.enabled) {
      if (allNodes) allNodes.push(new BakeMeshNode(node));
      if (node.model.lightmapped) {
        if (bakeNodes) {
          meshInstances = node.model.model.meshInstances;
        }
      }
    }

    // mesh instances from render component
    if ((_node$render = node.render) != null && _node$render.enabled) {
      if (allNodes) allNodes.push(new BakeMeshNode(node));
      if (node.render.lightmapped) {
        if (bakeNodes) {
          meshInstances = node.render.meshInstances;
        }
      }
    }
    if (meshInstances) {
      let hasUv1 = true;
      for (let i = 0; i < meshInstances.length; i++) {
        if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
          Debug.log(`Lightmapper - node [${node.name}] contains meshes without required uv1, excluding it from baking.`);
          hasUv1 = false;
          break;
        }
      }
      if (hasUv1) {
        const notInstancedMeshInstances = [];
        for (let i = 0; i < meshInstances.length; i++) {
          const mesh = meshInstances[i].mesh;

          // is this mesh an instance of already used mesh in this node
          if (this._tempSet.has(mesh)) {
            // collect each instance (object with shared VB) as separate "node"
            bakeNodes.push(new BakeMeshNode(node, [meshInstances[i]]));
          } else {
            notInstancedMeshInstances.push(meshInstances[i]);
          }
          this._tempSet.add(mesh);
        }
        this._tempSet.clear();

        // collect all non-shared objects as one "node"
        if (notInstancedMeshInstances.length > 0) {
          bakeNodes.push(new BakeMeshNode(node, notInstancedMeshInstances));
        }
      }
    }
    for (let i = 0; i < node._children.length; i++) {
      this.collectModels(node._children[i], bakeNodes, allNodes);
    }
  }

  // prepare all meshInstances that cast shadows into lightmaps
  prepareShadowCasters(nodes) {
    const casters = [];
    for (let n = 0; n < nodes.length; n++) {
      const component = nodes[n].component;
      component.castShadows = component.castShadowsLightmap;
      if (component.castShadowsLightmap) {
        const meshes = nodes[n].meshInstances;
        for (let i = 0; i < meshes.length; i++) {
          meshes[i].visibleThisFrame = true;
          casters.push(meshes[i]);
        }
      }
    }
    return casters;
  }

  // updates world transform for nodes
  updateTransforms(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const meshInstances = nodes[i].meshInstances;
      for (let j = 0; j < meshInstances.length; j++) {
        meshInstances[j].node.getWorldTransform();
      }
    }
  }

  // Note: this function is also called by the Editor to display estimated LM size in the inspector,
  // do not change its signature.
  calculateLightmapSize(node) {
    let data;
    const sizeMult = this.scene.lightmapSizeMultiplier || 16;
    const scale = tempVec;
    let srcArea, lightmapSizeMultiplier;
    if (node.model) {
      lightmapSizeMultiplier = node.model.lightmapSizeMultiplier;
      if (node.model.asset) {
        data = this.assets.get(node.model.asset).data;
        if (data.area) {
          srcArea = data.area;
        }
      } else if (node.model._area) {
        data = node.model;
        if (data._area) {
          srcArea = data._area;
        }
      }
    } else if (node.render) {
      lightmapSizeMultiplier = node.render.lightmapSizeMultiplier;
      if (node.render.type !== 'asset') {
        if (node.render._area) {
          data = node.render;
          if (data._area) {
            srcArea = data._area;
          }
        }
      }
    }

    // copy area
    const area = {
      x: 1,
      y: 1,
      z: 1,
      uv: 1
    };
    if (srcArea) {
      area.x = srcArea.x;
      area.y = srcArea.y;
      area.z = srcArea.z;
      area.uv = srcArea.uv;
    }
    const areaMult = lightmapSizeMultiplier || 1;
    area.x *= areaMult;
    area.y *= areaMult;
    area.z *= areaMult;

    // bounds of the component
    const component = node.render || node.model;
    const bounds = this.computeNodeBounds(component.meshInstances);

    // total area in the lightmap is based on the world space bounds of the mesh
    scale.copy(bounds.halfExtents);
    let totalArea = area.x * scale.y * scale.z + area.y * scale.x * scale.z + area.z * scale.x * scale.y;
    totalArea /= area.uv;
    totalArea = Math.sqrt(totalArea);
    const lightmapSize = Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || MAX_LIGHTMAP_SIZE);
    return lightmapSize;
  }
  setLightmapping(nodes, value, passCount, shaderDefs) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const meshInstances = node.meshInstances;
      for (let j = 0; j < meshInstances.length; j++) {
        const meshInstance = meshInstances[j];
        meshInstance.setLightmapped(value);
        if (value) {
          if (shaderDefs) {
            meshInstance._shaderDefs |= shaderDefs;
          }

          // only lights that affect lightmapped objects are used on this mesh now that it is baked
          meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;

          // textures
          for (let pass = 0; pass < passCount; pass++) {
            const tex = node.renderTargets[pass].colorBuffer;
            tex.minFilter = FILTER_LINEAR;
            tex.magFilter = FILTER_LINEAR;
            meshInstance.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tex);
          }
        }
      }
    }
  }

  /**
   * Generates and applies the lightmaps.
   *
   * @param {import('../entity.js').Entity[]|null} nodes - An array of entities (with model or
   * render components) to render lightmaps for. If not supplied, the entire scene will be baked.
   * @param {number} [mode] - Baking mode. Can be:
   *
   * - {@link BAKE_COLOR}: single color lightmap
   * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for
   * bump/specular)
   *
   * Only lights with bakeDir=true will be used for generating the dominant light direction.
   * Defaults to {@link BAKE_COLORDIR}.
   */
  bake(nodes, mode = BAKE_COLORDIR) {
    const device = this.device;
    const startTime = now();

    // update skybox
    this.scene._updateSky(device);
    device.fire('lightmapper:start', {
      timestamp: startTime,
      target: this
    });
    this.stats.renderPasses = 0;
    this.stats.shadowMapTime = 0;
    this.stats.forwardTime = 0;
    const startShaders = device._shaderStats.linked;
    const startFboTime = device._renderTargetCreationTime;
    const startCompileTime = device._shaderStats.compileTime;

    // BakeMeshNode objects for baking
    const bakeNodes = [];

    // all BakeMeshNode objects
    const allNodes = [];

    // collect nodes / meshInstances for baking
    if (nodes) {
      // collect nodes for baking based on specified list of nodes
      for (let i = 0; i < nodes.length; i++) {
        this.collectModels(nodes[i], bakeNodes, null);
      }

      // collect all nodes from the scene
      this.collectModels(this.root, null, allNodes);
    } else {
      // collect nodes from the root of the scene
      this.collectModels(this.root, bakeNodes, allNodes);
    }
    DebugGraphics.pushGpuMarker(this.device, 'LMBake');

    // bake nodes
    if (bakeNodes.length > 0) {
      // disable lightmapping
      const passCount = mode === BAKE_COLORDIR ? 2 : 1;
      this.setLightmapping(bakeNodes, false, passCount);
      this.initBake(device);
      this.bakeInternal(passCount, bakeNodes, allNodes);

      // Enable new lightmaps
      let shaderDefs = SHADERDEF_LM;
      if (mode === BAKE_COLORDIR) {
        shaderDefs |= SHADERDEF_DIRLM;
      }

      // mark lightmap as containing ambient lighting
      if (this.scene.ambientBake) {
        shaderDefs |= SHADERDEF_LMAMBIENT;
      }
      this.setLightmapping(bakeNodes, true, passCount, shaderDefs);

      // clean up memory
      this.finishBake(bakeNodes);
    }
    DebugGraphics.popGpuMarker(this.device);
    const nowTime = now();
    this.stats.totalRenderTime = nowTime - startTime;
    this.stats.shadersLinked = device._shaderStats.linked - startShaders;
    this.stats.compileTime = device._shaderStats.compileTime - startCompileTime;
    this.stats.fboTime = device._renderTargetCreationTime - startFboTime;
    this.stats.lightmapCount = bakeNodes.length;
    device.fire('lightmapper:end', {
      timestamp: nowTime,
      target: this
    });
  }

  // this allocates lightmap textures and render targets.
  allocateTextures(bakeNodes, passCount) {
    for (let i = 0; i < bakeNodes.length; i++) {
      // required lightmap size
      const bakeNode = bakeNodes[i];
      const size = this.calculateLightmapSize(bakeNode.node);

      // texture and render target for each pass, stored per node
      for (let pass = 0; pass < passCount; pass++) {
        const tex = this.createTexture(size, 'lightmapper_lightmap_' + i);
        LightmapCache.incRef(tex);
        bakeNode.renderTargets[pass] = new RenderTarget({
          colorBuffer: tex,
          depth: false
        });
      }

      // single temporary render target of each size
      if (!this.renderTargets.has(size)) {
        const tex = this.createTexture(size, 'lightmapper_temp_lightmap_' + size);
        LightmapCache.incRef(tex);
        this.renderTargets.set(size, new RenderTarget({
          colorBuffer: tex,
          depth: false
        }));
      }
    }
  }
  prepareLightsToBake(layerComposition, allLights, bakeLights) {
    // ambient light
    if (this.scene.ambientBake) {
      const ambientLight = new BakeLightAmbient(this.scene);
      bakeLights.push(ambientLight);
    }

    // scene lights
    const sceneLights = layerComposition._lights;
    for (let i = 0; i < sceneLights.length; i++) {
      const light = sceneLights[i];

      // store all lights and their original settings we need to temporarily modify
      const bakeLight = new BakeLightSimple(this.scene, light);
      allLights.push(bakeLight);

      // bake light
      if (light.enabled && (light.mask & MASK_BAKE) !== 0) {
        // if baked, it can't be used as static
        light.isStatic = false;
        light.mask = 0xFFFFFFFF;
        light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
        bakeLights.push(bakeLight);
      }
    }

    // sort bake lights by type to minimize shader switches
    bakeLights.sort();
  }
  restoreLights(allLights) {
    for (let i = 0; i < allLights.length; i++) {
      allLights[i].restore();
    }
  }
  setupScene() {
    // lightmapper needs original model draw calls
    this.revertStatic = false;
    if (this.scene._needsStaticPrepare) {
      this.scene._needsStaticPrepare = false;
      this.revertStatic = true;
    }

    // backup
    this.fog = this.scene.fog;
    this.ambientLight.copy(this.scene.ambientLight);

    // set up scene
    this.scene.fog = FOG_NONE;

    // if not baking ambient, set it to black
    if (!this.scene.ambientBake) {
      this.scene.ambientLight.set(0, 0, 0);
    }

    // apply scene settings
    this.renderer.setSceneConstants();
  }
  restoreScene() {
    this.scene.fog = this.fog;
    this.scene.ambientLight.copy(this.ambientLight);

    // Revert static preprocessing
    if (this.revertStatic) {
      this.scene._needsStaticPrepare = true;
    }
  }

  // compute bounding box for a single node
  computeNodeBounds(meshInstances) {
    const bounds = new BoundingBox();
    if (meshInstances.length > 0) {
      bounds.copy(meshInstances[0].aabb);
      for (let m = 1; m < meshInstances.length; m++) {
        bounds.add(meshInstances[m].aabb);
      }
    }
    return bounds;
  }

  // compute bounding box for each node
  computeNodesBounds(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const meshInstances = nodes[i].meshInstances;
      nodes[i].bounds = this.computeNodeBounds(meshInstances);
    }
  }

  // compute compound bounding box for an array of mesh instances
  computeBounds(meshInstances) {
    const bounds = new BoundingBox();
    for (let i = 0; i < meshInstances.length; i++) {
      bounds.copy(meshInstances[0].aabb);
      for (let m = 1; m < meshInstances.length; m++) {
        bounds.add(meshInstances[m].aabb);
      }
    }
    return bounds;
  }
  backupMaterials(meshInstances) {
    for (let i = 0; i < meshInstances.length; i++) {
      this.materials[i] = meshInstances[i].material;
    }
  }
  restoreMaterials(meshInstances) {
    for (let i = 0; i < meshInstances.length; i++) {
      meshInstances[i].material = this.materials[i];
    }
  }
  lightCameraPrepare(device, bakeLight) {
    const light = bakeLight.light;
    let shadowCam;

    // only prepare camera for spot light, other cameras need to be adjusted per cubemap face / per node later
    if (light.type === LIGHTTYPE_SPOT) {
      const lightRenderData = light.getRenderData(null, 0);
      shadowCam = lightRenderData.shadowCamera;
      shadowCam._node.setPosition(light._node.getPosition());
      shadowCam._node.setRotation(light._node.getRotation());
      shadowCam._node.rotateLocal(-90, 0, 0);
      shadowCam.projection = PROJECTION_PERSPECTIVE;
      shadowCam.nearClip = light.attenuationEnd / 1000;
      shadowCam.farClip = light.attenuationEnd;
      shadowCam.aspectRatio = 1;
      shadowCam.fov = light._outerConeAngle * 2;
      this.renderer.updateCameraFrustum(shadowCam);
    }
    return shadowCam;
  }

  // prepares camera / frustum of the light for rendering the bakeNode
  // returns true if light affects the bakeNode
  lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds) {
    const light = bakeLight.light;
    let lightAffectsNode = true;
    if (light.type === LIGHTTYPE_DIRECTIONAL) {
      // tweak directional light camera to fully see all casters and they are fully inside the frustum
      tempVec.copy(casterBounds.center);
      tempVec.y += casterBounds.halfExtents.y;
      this.camera.node.setPosition(tempVec);
      this.camera.node.setEulerAngles(-90, 0, 0);
      this.camera.nearClip = 0;
      this.camera.farClip = casterBounds.halfExtents.y * 2;
      const frustumSize = Math.max(casterBounds.halfExtents.x, casterBounds.halfExtents.z);
      this.camera.orthoHeight = frustumSize;
    } else {
      // for other light types, test if light affects the node
      if (!bakeLight.lightBounds.intersects(bakeNode.bounds)) {
        lightAffectsNode = false;
      }
    }

    // per meshInstance culling for spot light only
    // (omni lights cull per face later, directional lights don't cull)
    if (light.type === LIGHTTYPE_SPOT) {
      let nodeVisible = false;
      const meshInstances = bakeNode.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        if (meshInstances[i]._isVisible(shadowCam)) {
          nodeVisible = true;
          break;
        }
      }
      if (!nodeVisible) {
        lightAffectsNode = false;
      }
    }
    return lightAffectsNode;
  }

  // set up light array for a single light
  setupLightArray(lightArray, light) {
    lightArray[LIGHTTYPE_DIRECTIONAL].length = 0;
    lightArray[LIGHTTYPE_OMNI].length = 0;
    lightArray[LIGHTTYPE_SPOT].length = 0;
    lightArray[light.type][0] = light;
    light.visibleThisFrame = true;
  }
  renderShadowMap(shadowMapRendered, casters, lightArray, bakeLight) {
    const light = bakeLight.light;
    if (!shadowMapRendered && light.castShadows) {
      // allocate shadow map from the cache to avoid per light allocation
      if (!light.shadowMap && !this.scene.clusteredLightingEnabled) {
        light.shadowMap = this.shadowMapCache.get(this.device, light);
      }
      if (light.type === LIGHTTYPE_DIRECTIONAL) {
        this.renderer._shadowRendererDirectional.cull(light, casters, this.camera);
        this.renderer.shadowRenderer.render(light, this.camera);
      } else {
        this.renderer._shadowRendererLocal.cull(light, casters);
        this.renderer.renderShadowsLocal(lightArray[light.type], this.camera);
      }
    }
    return true;
  }
  postprocessTextures(device, bakeNodes, passCount) {
    const numDilates2x = 1; // 1 or 2 dilates (depending on filter being enabled)
    const dilateShader = this.lightmapFilters.shaderDilate;

    // bilateral denoise filter - runs as a first pass, before dilate
    const filterLightmap = this.scene.lightmapFilterEnabled;
    if (filterLightmap) {
      this.lightmapFilters.prepareDenoise(this.scene.lightmapFilterRange, this.scene.lightmapFilterSmoothness);
    }
    for (let node = 0; node < bakeNodes.length; node++) {
      const bakeNode = bakeNodes[node];
      DebugGraphics.pushGpuMarker(this.device, `LMPost:${node}`);
      for (let pass = 0; pass < passCount; pass++) {
        const nodeRT = bakeNode.renderTargets[pass];
        const lightmap = nodeRT.colorBuffer;
        const tempRT = this.renderTargets.get(lightmap.width);
        const tempTex = tempRT.colorBuffer;
        this.lightmapFilters.prepare(lightmap.width, lightmap.height);

        // bounce dilate between textures, execute denoise on the first pass
        for (let i = 0; i < numDilates2x; i++) {
          this.lightmapFilters.setSourceTexture(lightmap);
          const bilateralFilterEnabled = filterLightmap && pass === 0 && i === 0;
          drawQuadWithShader(device, tempRT, bilateralFilterEnabled ? this.lightmapFilters.shaderDenoise : dilateShader);
          this.lightmapFilters.setSourceTexture(tempTex);
          drawQuadWithShader(device, nodeRT, dilateShader);
        }
      }
      DebugGraphics.popGpuMarker(this.device);
    }
  }
  bakeInternal(passCount, bakeNodes, allNodes) {
    const scene = this.scene;
    const device = this.device;
    const clusteredLightingEnabled = scene.clusteredLightingEnabled;
    this.createMaterials(device, scene, passCount);
    this.setupScene();

    // update layer composition
    scene.layers._update();

    // compute bounding boxes for nodes
    this.computeNodesBounds(bakeNodes);

    // Calculate lightmap sizes and allocate textures
    this.allocateTextures(bakeNodes, passCount);

    // Collect bakeable lights, and also keep allLights along with their properties we change to restore them later
    const allLights = [],
      bakeLights = [];
    this.prepareLightsToBake(scene.layers, allLights, bakeLights);

    // update transforms
    this.updateTransforms(allNodes);

    // get all meshInstances that cast shadows into lightmap and set them up for realtime shadow casting
    const casters = this.prepareShadowCasters(allNodes);

    // update skinned and morphed meshes
    this.renderer.updateCpuSkinMatrices(casters);
    this.renderer.gpuUpdate(casters);

    // compound bounding box for all casters, used to compute shared directional light shadow
    const casterBounds = this.computeBounds(casters);
    let i, j, rcv, m;

    // Prepare models
    for (i = 0; i < bakeNodes.length; i++) {
      const bakeNode = bakeNodes[i];
      rcv = bakeNode.meshInstances;
      for (j = 0; j < rcv.length; j++) {
        // patch meshInstance
        m = rcv[j];
        m.setLightmapped(false);
        m.mask = MASK_BAKE; // only affected by LM lights

        // patch material
        m.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], m.material.lightMap ? m.material.lightMap : this.blackTex);
        m.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], this.blackTex);
      }
    }

    // Disable all bakeable lights
    for (j = 0; j < bakeLights.length; j++) {
      bakeLights[j].light.enabled = false;
    }
    const lightArray = [[], [], []];
    let pass, node;
    let shadersUpdatedOn1stPass = false;

    // Accumulate lights into RGBM textures
    for (i = 0; i < bakeLights.length; i++) {
      const bakeLight = bakeLights[i];
      const isAmbientLight = bakeLight instanceof BakeLightAmbient;

      // light can be baked using many virtual lights to create soft effect
      let numVirtualLights = bakeLight.numVirtualLights;

      // direction baking is not currently compatible with virtual lights, as we end up with no valid direction in lights penumbra
      if (passCount > 1 && numVirtualLights > 1 && bakeLight.light.bakeDir) {
        numVirtualLights = 1;
        Debug.warn('Lightmapper\'s BAKE_COLORDIR mode is not compatible with Light\'s bakeNumSamples larger than one. Forcing it to one.');
      }
      for (let virtualLightIndex = 0; virtualLightIndex < numVirtualLights; virtualLightIndex++) {
        DebugGraphics.pushGpuMarker(device, `Light:${bakeLight.light._node.name}:${virtualLightIndex}`);

        // prepare virtual light
        if (numVirtualLights > 1) {
          bakeLight.prepareVirtualLight(virtualLightIndex, numVirtualLights);
        }
        bakeLight.startBake();
        let shadowMapRendered = false;
        const shadowCam = this.lightCameraPrepare(device, bakeLight);
        for (node = 0; node < bakeNodes.length; node++) {
          const bakeNode = bakeNodes[node];
          rcv = bakeNode.meshInstances;
          const lightAffectsNode = this.lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds);
          if (!lightAffectsNode) {
            continue;
          }
          this.setupLightArray(lightArray, bakeLight.light);
          if (clusteredLightingEnabled) {
            this.renderer.lightTextureAtlas.update(lightArray[LIGHTTYPE_SPOT], lightArray[LIGHTTYPE_OMNI], this.lightingParams);
          }

          // render light shadow map needs to be rendered
          shadowMapRendered = this.renderShadowMap(shadowMapRendered, casters, lightArray, bakeLight);
          if (clusteredLightingEnabled) {
            const clusterLights = lightArray[LIGHTTYPE_SPOT].concat(lightArray[LIGHTTYPE_OMNI]);
            this.worldClusters.update(clusterLights, this.scene.gammaCorrection, this.lightingParams);
          }

          // Store original materials
          this.backupMaterials(rcv);
          for (pass = 0; pass < passCount; pass++) {
            // only bake first virtual light for pass 1, as it does not handle overlapping lights
            if (pass > 0 && virtualLightIndex > 0) {
              break;
            }

            // don't bake ambient light in pass 1, as there's no main direction
            if (isAmbientLight && pass > 0) {
              break;
            }
            DebugGraphics.pushGpuMarker(device, `LMPass:${pass}`);

            // lightmap size
            const nodeRT = bakeNode.renderTargets[pass];
            const lightmapSize = bakeNode.renderTargets[pass].colorBuffer.width;

            // get matching temp render target to render to
            const tempRT = this.renderTargets.get(lightmapSize);
            const tempTex = tempRT.colorBuffer;
            if (pass === 0) {
              shadersUpdatedOn1stPass = scene.updateShaders;
            } else if (shadersUpdatedOn1stPass) {
              scene.updateShaders = true;
            }
            let passMaterial = this.passMaterials[pass];
            if (isAmbientLight) {
              // for last virtual light of ambient light, multiply accumulated AO lightmap with ambient light
              const lastVirtualLightForPass = virtualLightIndex + 1 === numVirtualLights;
              if (lastVirtualLightForPass && pass === 0) {
                passMaterial = this.ambientAOMaterial;
              }
            }

            // set up material for baking a pass
            for (j = 0; j < rcv.length; j++) {
              rcv[j].material = passMaterial;
            }

            // update shader
            this.renderer.updateShaders(rcv);

            // ping-ponging output
            this.renderer.setCamera(this.camera, tempRT, true);
            if (pass === PASS_DIR) {
              this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
            }

            // prepare clustered lighting
            if (clusteredLightingEnabled) {
              this.worldClusters.activate(this.renderer.lightTextureAtlas);
            }
            this.renderer._forwardTime = 0;
            this.renderer._shadowMapTime = 0;
            this.renderer.renderForward(this.camera, rcv, rcv.length, lightArray, SHADER_FORWARDHDR);
            device.updateEnd();
            this.stats.shadowMapTime += this.renderer._shadowMapTime;
            this.stats.forwardTime += this.renderer._forwardTime;
            this.stats.renderPasses++;

            // temp render target now has lightmap, store it for the node
            bakeNode.renderTargets[pass] = tempRT;

            // and release previous lightmap into temp render target pool
            this.renderTargets.set(lightmapSize, nodeRT);
            for (j = 0; j < rcv.length; j++) {
              m = rcv[j];
              m.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tempTex); // ping-ponging input
              m._shaderDefs |= SHADERDEF_LM; // force using LM even if material doesn't have it
            }

            DebugGraphics.popGpuMarker(device);
          }

          // Revert to original materials
          this.restoreMaterials(rcv);
        }
        bakeLight.endBake(this.shadowMapCache);
        DebugGraphics.popGpuMarker(device);
      }
    }
    this.postprocessTextures(device, bakeNodes, passCount);

    // restore changes
    for (node = 0; node < allNodes.length; node++) {
      allNodes[node].restore();
    }
    this.restoreLights(allLights);
    this.restoreScene();

    // empty cache to minimize persistent memory use .. if some cached textures are needed,
    // they will be allocated again as needed
    if (!clusteredLightingEnabled) {
      this.shadowMapCache.clear();
    }
  }
}

export { Lightmapper };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvbGlnaHRtYXBwZXIvbGlnaHRtYXBwZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBDSFVOS0FQSV8xXzU1LFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1QsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaGljcy9xdWFkLXJlbmRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTGlnaHRpbmdQYXJhbXMgfSBmcm9tICcuLi8uLi9zY2VuZS9saWdodGluZy9saWdodGluZy1wYXJhbXMuanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uLy4uL3NjZW5lL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3NMaWdodG1hcHBlciB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy1saWdodG1hcHBlci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkFLRV9DT0xPUkRJUixcbiAgICBGT0dfTk9ORSxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCxcbiAgICBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQywgUFJPSkVDVElPTl9QRVJTUEVDVElWRSxcbiAgICBTSEFERVJfRk9SV0FSREhEUixcbiAgICBTSEFERVJERUZfRElSTE0sIFNIQURFUkRFRl9MTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBNQVNLX0JBS0UsIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELFxuICAgIFNIQURPV1VQREFURV9SRUFMVElNRSwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRVxufSBmcm9tICcuLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhIH0gZnJvbSAnLi4vLi4vc2NlbmUvY2FtZXJhLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEJha2VMaWdodFNpbXBsZSB9IGZyb20gJy4vYmFrZS1saWdodC1zaW1wbGUuanMnO1xuaW1wb3J0IHsgQmFrZUxpZ2h0QW1iaWVudCB9IGZyb20gJy4vYmFrZS1saWdodC1hbWJpZW50LmpzJztcbmltcG9ydCB7IEJha2VNZXNoTm9kZSB9IGZyb20gJy4vYmFrZS1tZXNoLW5vZGUuanMnO1xuaW1wb3J0IHsgTGlnaHRtYXBDYWNoZSB9IGZyb20gJy4uLy4uL3NjZW5lL2dyYXBoaWNzL2xpZ2h0bWFwLWNhY2hlLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwRmlsdGVycyB9IGZyb20gJy4vbGlnaHRtYXAtZmlsdGVycy5qcyc7XG5cbmNvbnN0IE1BWF9MSUdIVE1BUF9TSVpFID0gMjA0ODtcblxuY29uc3QgUEFTU19DT0xPUiA9IDA7XG5jb25zdCBQQVNTX0RJUiA9IDE7XG5cbmNvbnN0IHRlbXBWZWMgPSBuZXcgVmVjMygpO1xuXG4vKipcbiAqIFRoZSBsaWdodG1hcHBlciBpcyB1c2VkIHRvIGJha2Ugc2NlbmUgbGlnaHRzIGludG8gdGV4dHVyZXMuXG4gKi9cbmNsYXNzIExpZ2h0bWFwcGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTGlnaHRtYXBwZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSBsaWdodG1hcHBlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fSByb290IC0gVGhlIHJvb3QgZW50aXR5IG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vc2NlbmUvc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUgdG8gbGlnaHRtYXAuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMnKS5Gb3J3YXJkUmVuZGVyZXJ9IHJlbmRlcmVyIC0gVGhlXG4gICAgICogcmVuZGVyZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2Fzc2V0L2Fzc2V0LXJlZ2lzdHJ5LmpzJykuQXNzZXRSZWdpc3RyeX0gYXNzZXRzIC0gUmVnaXN0cnkgb2YgYXNzZXRzIHRvXG4gICAgICogbGlnaHRtYXAuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgcm9vdCwgc2NlbmUsIHJlbmRlcmVyLCBhc3NldHMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMucm9vdCA9IHJvb3Q7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IGFzc2V0cztcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IHJlbmRlcmVyLnNoYWRvd01hcENhY2hlO1xuXG4gICAgICAgIHRoaXMuX3RlbXBTZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX2luaXRDYWxsZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBpbnRlcm5hbCBtYXRlcmlhbHMgdXNlZCBieSBiYWtpbmdcbiAgICAgICAgdGhpcy5wYXNzTWF0ZXJpYWxzID0gW107XG4gICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuZm9nID0gJyc7XG4gICAgICAgIHRoaXMuYW1iaWVudExpZ2h0ID0gbmV3IENvbG9yKCk7XG5cbiAgICAgICAgLy8gZGljdGlvbmFyeSBvZiBzcGFyZSByZW5kZXIgdGFyZ2V0cyB3aXRoIGNvbG9yIGJ1ZmZlciBmb3IgZWFjaCB1c2VkIHNpemVcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuc3RhdHMgPSB7XG4gICAgICAgICAgICByZW5kZXJQYXNzZXM6IDAsXG4gICAgICAgICAgICBsaWdodG1hcENvdW50OiAwLFxuICAgICAgICAgICAgdG90YWxSZW5kZXJUaW1lOiAwLFxuICAgICAgICAgICAgZm9yd2FyZFRpbWU6IDAsXG4gICAgICAgICAgICBmYm9UaW1lOiAwLFxuICAgICAgICAgICAgc2hhZG93TWFwVGltZTogMCxcbiAgICAgICAgICAgIGNvbXBpbGVUaW1lOiAwLFxuICAgICAgICAgICAgc2hhZGVyc0xpbmtlZDogMFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSByZWZlcmVuY2UgdG8gdGhlIHRleHR1cmVcbiAgICAgICAgTGlnaHRtYXBDYWNoZS5kZWNSZWYodGhpcy5ibGFja1RleCk7XG4gICAgICAgIHRoaXMuYmxhY2tUZXggPSBudWxsO1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgYWxsIGxpZ2h0bWFwc1xuICAgICAgICBMaWdodG1hcENhY2hlLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLmRldmljZSA9IG51bGw7XG4gICAgICAgIHRoaXMucm9vdCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5hc3NldHMgPSBudWxsO1xuICAgIH1cblxuICAgIGluaXRCYWtlKGRldmljZSkge1xuXG4gICAgICAgIC8vIG9ubHkgaW5pdGlhbGl6ZSBvbmUgdGltZVxuICAgICAgICBpZiAoIXRoaXMuX2luaXRDYWxsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2luaXRDYWxsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBsaWdodG1hcCBmaWx0ZXJpbmcgc2hhZGVyc1xuICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMgPSBuZXcgTGlnaHRtYXBGaWx0ZXJzKGRldmljZSk7XG5cbiAgICAgICAgICAgIC8vIHNoYWRlciByZWxhdGVkXG4gICAgICAgICAgICB0aGlzLmNvbnN0YW50QmFrZURpciA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdiYWtlRGlyJyk7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFscyA9IFtdO1xuXG4gICAgICAgICAgICAvLyBzbWFsbCBibGFjayB0ZXh0dXJlXG4gICAgICAgICAgICB0aGlzLmJsYWNrVGV4ID0gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogNCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IDQsXG4gICAgICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgICAgICB0eXBlOiBURVhUVVJFVFlQRV9SR0JNLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdsaWdodG1hcEJsYWNrJ1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGluY3JlZiBibGFjayB0ZXh0dXJlIGluIHRoZSBjYWNoZSB0byBhdm9pZCBpdCBiZWluZyBkZXN0cm95ZWRcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRoaXMuYmxhY2tUZXgpO1xuXG4gICAgICAgICAgICAvLyBjYW1lcmEgdXNlZCBmb3IgYmFraW5nXG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBuZXcgQ2FtZXJhKCk7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJDb2xvci5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJDb2xvckJ1ZmZlciA9IHRydWU7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJEZXB0aEJ1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyU3RlbmNpbEJ1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgY2FtZXJhLmZydXN0dW1DdWxsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBjYW1lcmEucHJvamVjdGlvbiA9IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDO1xuICAgICAgICAgICAgY2FtZXJhLmFzcGVjdFJhdGlvID0gMTtcbiAgICAgICAgICAgIGNhbWVyYS5ub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbGlnaHQgY2x1c3RlciBzdHJ1Y3R1cmVcbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBsaWdodCBwYXJhbXMsIGFuZCBiYXNlIG1vc3QgcGFyYW1ldGVycyBvbiB0aGUgbGlnaHRpbmcgcGFyYW1zIG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgY29uc3QgbGlnaHRpbmdQYXJhbXMgPSBuZXcgTGlnaHRpbmdQYXJhbXMoZGV2aWNlLnN1cHBvcnRzQXJlYUxpZ2h0cywgZGV2aWNlLm1heFRleHR1cmVTaXplLCAoKSA9PiB7fSk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0aW5nUGFyYW1zID0gbGlnaHRpbmdQYXJhbXM7XG5cbiAgICAgICAgICAgIGNvbnN0IHNyY1BhcmFtcyA9IHRoaXMuc2NlbmUubGlnaHRpbmc7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5zaGFkb3dzRW5hYmxlZCA9IHNyY1BhcmFtcy5zaGFkb3dzRW5hYmxlZDtcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLnNoYWRvd0F0bGFzUmVzb2x1dGlvbiA9IHNyY1BhcmFtcy5zaGFkb3dBdGxhc1Jlc29sdXRpb247XG5cbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmNvb2tpZXNFbmFibGVkID0gc3JjUGFyYW1zLmNvb2tpZXNFbmFibGVkO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuY29va2llQXRsYXNSZXNvbHV0aW9uID0gc3JjUGFyYW1zLmNvb2tpZUF0bGFzUmVzb2x1dGlvbjtcblxuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuYXJlYUxpZ2h0c0VuYWJsZWQgPSBzcmNQYXJhbXMuYXJlYUxpZ2h0c0VuYWJsZWQ7XG5cbiAgICAgICAgICAgIC8vIHNvbWUgY3VzdG9tIGxpZ2h0bWFwcGluZyBwYXJhbXMgLSB3ZSBiYWtlIHNpbmdsZSBsaWdodCBhIHRpbWVcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmNlbGxzID0gbmV3IFZlYzMoMywgMywgMyk7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5tYXhMaWdodHNQZXJDZWxsID0gNDtcblxuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzID0gbmV3IFdvcmxkQ2x1c3RlcnMoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXJMaWdodG1hcHBlcic7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmaW5pc2hCYWtlKGJha2VOb2Rlcykge1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gW107XG5cbiAgICAgICAgZnVuY3Rpb24gZGVzdHJveVJUKHJ0KSB7XG4gICAgICAgICAgICAvLyB0aGlzIGNhbiBjYXVzZSByZWYgY291bnQgdG8gYmUgMCBhbmQgdGV4dHVyZSBkZXN0cm95ZWRcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKHJ0LmNvbG9yQnVmZmVyKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSByZW5kZXIgdGFyZ2V0IGl0c2VsZlxuICAgICAgICAgICAgcnQuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3BhcmUgcmVuZGVyIHRhcmdldHMgaW5jbHVkaW5nIGNvbG9yIGJ1ZmZlclxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuZm9yRWFjaCgocnQpID0+IHtcbiAgICAgICAgICAgIGRlc3Ryb3lSVChydCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuY2xlYXIoKTtcblxuICAgICAgICAvLyBkZXN0cm95IHJlbmRlciB0YXJnZXRzIGZyb20gbm9kZXMgKGJ1dCBub3QgY29sb3IgYnVmZmVyKVxuICAgICAgICBiYWtlTm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXJUYXJnZXRzLmZvckVhY2goKHJ0KSA9PiB7XG4gICAgICAgICAgICAgICAgZGVzdHJveVJUKHJ0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgbm9kZS5yZW5kZXJUYXJnZXRzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRoaXMgc2hhZGVyIGlzIG9ubHkgdmFsaWQgZm9yIHNwZWNpZmljIGJyaWdodG5lc3MgYW5kIGNvbnRyYXN0IHZhbHVlcywgZGlzcG9zZSBpdFxuICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsID0gbnVsbDtcblxuICAgICAgICAvLyBkZWxldGUgbGlnaHQgY2x1c3RlclxuICAgICAgICBpZiAodGhpcy53b3JsZENsdXN0ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZU1hdGVyaWFsRm9yUGFzcyhkZXZpY2UsIHNjZW5lLCBwYXNzLCBhZGRBbWJpZW50KSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IGBsbU1hdGVyaWFsLXBhc3M6JHtwYXNzfS1hbWJpZW50OiR7YWRkQW1iaWVudH1gO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3MuQVBJVmVyc2lvbiA9IENIVU5LQVBJXzFfNTU7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy50cmFuc2Zvcm1WUyA9ICcjZGVmaW5lIFVWMUxBWU9VVFxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7IC8vIGRyYXcgVVYxXG5cbiAgICAgICAgaWYgKHBhc3MgPT09IFBBU1NfQ09MT1IpIHtcbiAgICAgICAgICAgIGxldCBiYWtlTG1FbmRDaHVuayA9IHNoYWRlckNodW5rc0xpZ2h0bWFwcGVyLmJha2VMbUVuZFBTOyAvLyBlbmNvZGUgdG8gUkdCTVxuICAgICAgICAgICAgaWYgKGFkZEFtYmllbnQpIHtcbiAgICAgICAgICAgICAgICAvLyBkaWZmdXNlIGxpZ2h0IHN0b3JlcyBhY2N1bXVsYXRlZCBBTywgYXBwbHkgY29udHJhc3QgYW5kIGJyaWdodG5lc3MgdG8gaXRcbiAgICAgICAgICAgICAgICAvLyBhbmQgbXVsdGlwbHkgYW1iaWVudCBsaWdodCBjb2xvciBieSB0aGUgQU9cbiAgICAgICAgICAgICAgICBiYWtlTG1FbmRDaHVuayA9IGBcbiAgICAgICAgICAgICAgICAgICAgZERpZmZ1c2VMaWdodCA9ICgoZERpZmZ1c2VMaWdodCAtIDAuNSkgKiBtYXgoJHtzY2VuZS5hbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0LnRvRml4ZWQoMSl9ICsgMS4wLCAwLjApKSArIDAuNTtcbiAgICAgICAgICAgICAgICAgICAgZERpZmZ1c2VMaWdodCArPSB2ZWMzKCR7c2NlbmUuYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzLnRvRml4ZWQoMSl9KTtcbiAgICAgICAgICAgICAgICAgICAgZERpZmZ1c2VMaWdodCA9IHNhdHVyYXRlKGREaWZmdXNlTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICo9IGRBbWJpZW50TGlnaHQ7XG4gICAgICAgICAgICAgICAgYCArIGJha2VMbUVuZENodW5rO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbWJpZW50ID0gbmV3IENvbG9yKDAsIDAsIDApOyAgICAvLyBkb24ndCBiYWtlIGFtYmllbnRcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbWJpZW50VGludCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuYmFzZVBTID0gc2hhZGVyQ2h1bmtzLmJhc2VQUyArIChzY2VuZS5saWdodG1hcFBpeGVsRm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCA/ICdcXG4jZGVmaW5lIExJR0hUTUFQX1JHQk1cXG4nIDogJycpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmVuZFBTID0gYmFrZUxtRW5kQ2h1bms7XG4gICAgICAgICAgICBtYXRlcmlhbC5saWdodE1hcCA9IHRoaXMuYmxhY2tUZXg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuYmFzZVBTID0gc2hhZGVyQ2h1bmtzLmJhc2VQUyArICdcXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2RpckxpZ2h0TWFwO1xcbnVuaWZvcm0gZmxvYXQgYmFrZURpcjtcXG4nO1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmVuZFBTID0gc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIuYmFrZURpckxtRW5kUFM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhdm9pZCB3cml0aW5nIHVucmVsYXRlZCB0aGluZ3MgdG8gYWxwaGFcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLm91dHB1dEFscGhhUFMgPSAnXFxuJztcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLm91dHB1dEFscGhhT3BhcXVlUFMgPSAnXFxuJztcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLm91dHB1dEFscGhhUHJlbXVsUFMgPSAnXFxuJztcbiAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX05PTkU7XG4gICAgICAgIG1hdGVyaWFsLmZvcmNlVXYxID0gdHJ1ZTsgLy8gcHJvdmlkZSBkYXRhIHRvIHhmb3JtVXYxXG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9XG5cbiAgICBjcmVhdGVNYXRlcmlhbHMoZGV2aWNlLCBzY2VuZSwgcGFzc0NvdW50KSB7XG4gICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5wYXNzTWF0ZXJpYWxzW3Bhc3NdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXNzTWF0ZXJpYWxzW3Bhc3NdID0gdGhpcy5jcmVhdGVNYXRlcmlhbEZvclBhc3MoZGV2aWNlLCBzY2VuZSwgcGFzcywgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWF0ZXJpYWwgdXNlZCBvbiBsYXN0IHJlbmRlciBvZiBhbWJpZW50IGxpZ2h0IHRvIG11bHRpcGx5IGFjY3VtdWxhdGVkIEFPIGluIGxpZ2h0bWFwIGJ5IGFtYmllbnQgbGlnaHRcbiAgICAgICAgaWYgKCF0aGlzLmFtYmllbnRBT01hdGVyaWFsKSB7XG4gICAgICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsID0gdGhpcy5jcmVhdGVNYXRlcmlhbEZvclBhc3MoZGV2aWNlLCBzY2VuZSwgMCwgdHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsLm9uVXBkYXRlU2hhZGVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIExNIGFzIHdpdGhvdXQgYW1iaWVudCwgdG8gYWRkIGl0XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmxpZ2h0TWFwV2l0aG91dEFtYmllbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IGFkZCBhbWJpZW50IHRvIGRpZmZ1c2UgZGlyZWN0bHkgYnV0IGtlZXAgaXQgc2VwYXJhdGUsIHRvIGFsbG93IEFPIHRvIGJlIG11bHRpcGxpZWQgaW5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMuc2VwYXJhdGVBbWJpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVUZXh0dXJlKHNpemUsIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBUZXh0dXJlKHRoaXMuZGV2aWNlLCB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBwcm9maWxlckhpbnQ6IFRFWEhJTlRfTElHSFRNQVAsXG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgIHdpZHRoOiBzaXplLFxuICAgICAgICAgICAgaGVpZ2h0OiBzaXplLFxuICAgICAgICAgICAgZm9ybWF0OiB0aGlzLnNjZW5lLmxpZ2h0bWFwUGl4ZWxGb3JtYXQsXG4gICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgIHR5cGU6IHRoaXMuc2NlbmUubGlnaHRtYXBQaXhlbEZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTggPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVCxcbiAgICAgICAgICAgIG1pbkZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGFkZHJlc3NWOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBuYW1lOiBuYW1lXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHJlY3Vyc2l2ZWx5IHdhbGsgdGhlIGhpZXJhcmNoeSBvZiBub2RlcyBzdGFydGluZyBhdCB0aGUgc3BlY2lmaWVkIG5vZGVcbiAgICAvLyBjb2xsZWN0IGFsbCBub2RlcyB0aGF0IG5lZWQgdG8gYmUgbGlnaHRtYXBwZWQgdG8gYmFrZU5vZGVzIGFycmF5XG4gICAgLy8gY29sbGVjdCBhbGwgbm9kZXMgd2l0aCBnZW9tZXRyeSB0byBhbGxOb2RlcyBhcnJheVxuICAgIGNvbGxlY3RNb2RlbHMobm9kZSwgYmFrZU5vZGVzLCBhbGxOb2Rlcykge1xuICAgICAgICBpZiAoIW5vZGUuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIG1lc2ggaW5zdGFuY2VzIGZyb20gbW9kZWwgY29tcG9uZW50XG4gICAgICAgIGxldCBtZXNoSW5zdGFuY2VzO1xuICAgICAgICBpZiAobm9kZS5tb2RlbD8ubW9kZWwgJiYgbm9kZS5tb2RlbD8uZW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKGFsbE5vZGVzKSBhbGxOb2Rlcy5wdXNoKG5ldyBCYWtlTWVzaE5vZGUobm9kZSkpO1xuICAgICAgICAgICAgaWYgKG5vZGUubW9kZWwubGlnaHRtYXBwZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoYmFrZU5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMgPSBub2RlLm1vZGVsLm1vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWVzaCBpbnN0YW5jZXMgZnJvbSByZW5kZXIgY29tcG9uZW50XG4gICAgICAgIGlmIChub2RlLnJlbmRlcj8uZW5hYmxlZCkge1xuICAgICAgICAgICAgaWYgKGFsbE5vZGVzKSBhbGxOb2Rlcy5wdXNoKG5ldyBCYWtlTWVzaE5vZGUobm9kZSkpO1xuICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLmxpZ2h0bWFwcGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJha2VOb2Rlcykge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzID0gbm9kZS5yZW5kZXIubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgbGV0IGhhc1V2MSA9IHRydWU7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghbWVzaEluc3RhbmNlc1tpXS5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVXYxKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmxvZyhgTGlnaHRtYXBwZXIgLSBub2RlIFske25vZGUubmFtZX1dIGNvbnRhaW5zIG1lc2hlcyB3aXRob3V0IHJlcXVpcmVkIHV2MSwgZXhjbHVkaW5nIGl0IGZyb20gYmFraW5nLmApO1xuICAgICAgICAgICAgICAgICAgICBoYXNVdjEgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaGFzVXYxKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaEluc3RhbmNlc1tpXS5tZXNoO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoaXMgbWVzaCBhbiBpbnN0YW5jZSBvZiBhbHJlYWR5IHVzZWQgbWVzaCBpbiB0aGlzIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX3RlbXBTZXQuaGFzKG1lc2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IGVhY2ggaW5zdGFuY2UgKG9iamVjdCB3aXRoIHNoYXJlZCBWQikgYXMgc2VwYXJhdGUgXCJub2RlXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJha2VOb2Rlcy5wdXNoKG5ldyBCYWtlTWVzaE5vZGUobm9kZSwgW21lc2hJbnN0YW5jZXNbaV1dKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzLnB1c2gobWVzaEluc3RhbmNlc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdGVtcFNldC5hZGQobWVzaCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fdGVtcFNldC5jbGVhcigpO1xuXG4gICAgICAgICAgICAgICAgLy8gY29sbGVjdCBhbGwgbm9uLXNoYXJlZCBvYmplY3RzIGFzIG9uZSBcIm5vZGVcIlxuICAgICAgICAgICAgICAgIGlmIChub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYmFrZU5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlLCBub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKG5vZGUuX2NoaWxkcmVuW2ldLCBiYWtlTm9kZXMsIGFsbE5vZGVzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByZXBhcmUgYWxsIG1lc2hJbnN0YW5jZXMgdGhhdCBjYXN0IHNoYWRvd3MgaW50byBsaWdodG1hcHNcbiAgICBwcmVwYXJlU2hhZG93Q2FzdGVycyhub2Rlcykge1xuXG4gICAgICAgIGNvbnN0IGNhc3RlcnMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZXNbbl0uY29tcG9uZW50O1xuXG4gICAgICAgICAgICBjb21wb25lbnQuY2FzdFNoYWRvd3MgPSBjb21wb25lbnQuY2FzdFNoYWRvd3NMaWdodG1hcDtcbiAgICAgICAgICAgIGlmIChjb21wb25lbnQuY2FzdFNoYWRvd3NMaWdodG1hcCkge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaGVzID0gbm9kZXNbbl0ubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtZXNoZXNbaV0udmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNhc3RlcnMucHVzaChtZXNoZXNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjYXN0ZXJzO1xuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgd29ybGQgdHJhbnNmb3JtIGZvciBub2Rlc1xuICAgIHVwZGF0ZVRyYW5zZm9ybXMobm9kZXMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbm9kZXNbaV0ubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbal0ubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTm90ZTogdGhpcyBmdW5jdGlvbiBpcyBhbHNvIGNhbGxlZCBieSB0aGUgRWRpdG9yIHRvIGRpc3BsYXkgZXN0aW1hdGVkIExNIHNpemUgaW4gdGhlIGluc3BlY3RvcixcbiAgICAvLyBkbyBub3QgY2hhbmdlIGl0cyBzaWduYXR1cmUuXG4gICAgY2FsY3VsYXRlTGlnaHRtYXBTaXplKG5vZGUpIHtcbiAgICAgICAgbGV0IGRhdGE7XG4gICAgICAgIGNvbnN0IHNpemVNdWx0ID0gdGhpcy5zY2VuZS5saWdodG1hcFNpemVNdWx0aXBsaWVyIHx8IDE2O1xuICAgICAgICBjb25zdCBzY2FsZSA9IHRlbXBWZWM7XG5cbiAgICAgICAgbGV0IHNyY0FyZWEsIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG5cbiAgICAgICAgaWYgKG5vZGUubW9kZWwpIHtcbiAgICAgICAgICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSBub2RlLm1vZGVsLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgICAgICAgICBpZiAobm9kZS5tb2RlbC5hc3NldCkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSB0aGlzLmFzc2V0cy5nZXQobm9kZS5tb2RlbC5hc3NldCkuZGF0YTtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5hcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgIHNyY0FyZWEgPSBkYXRhLmFyZWE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChub2RlLm1vZGVsLl9hcmVhKSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IG5vZGUubW9kZWw7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuX2FyZWE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG5vZGUucmVuZGVyKSB7XG4gICAgICAgICAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyID0gbm9kZS5yZW5kZXIubGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICAgICAgICAgIGlmIChub2RlLnJlbmRlci50eXBlICE9PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLl9hcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSBub2RlLnJlbmRlcjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyY0FyZWEgPSBkYXRhLl9hcmVhO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29weSBhcmVhXG4gICAgICAgIGNvbnN0IGFyZWEgPSB7IHg6IDEsIHk6IDEsIHo6IDEsIHV2OiAxIH07XG4gICAgICAgIGlmIChzcmNBcmVhKSB7XG4gICAgICAgICAgICBhcmVhLnggPSBzcmNBcmVhLng7XG4gICAgICAgICAgICBhcmVhLnkgPSBzcmNBcmVhLnk7XG4gICAgICAgICAgICBhcmVhLnogPSBzcmNBcmVhLno7XG4gICAgICAgICAgICBhcmVhLnV2ID0gc3JjQXJlYS51djtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFyZWFNdWx0ID0gbGlnaHRtYXBTaXplTXVsdGlwbGllciB8fCAxO1xuICAgICAgICBhcmVhLnggKj0gYXJlYU11bHQ7XG4gICAgICAgIGFyZWEueSAqPSBhcmVhTXVsdDtcbiAgICAgICAgYXJlYS56ICo9IGFyZWFNdWx0O1xuXG4gICAgICAgIC8vIGJvdW5kcyBvZiB0aGUgY29tcG9uZW50XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGUucmVuZGVyIHx8IG5vZGUubW9kZWw7XG4gICAgICAgIGNvbnN0IGJvdW5kcyA9IHRoaXMuY29tcHV0ZU5vZGVCb3VuZHMoY29tcG9uZW50Lm1lc2hJbnN0YW5jZXMpO1xuXG4gICAgICAgIC8vIHRvdGFsIGFyZWEgaW4gdGhlIGxpZ2h0bWFwIGlzIGJhc2VkIG9uIHRoZSB3b3JsZCBzcGFjZSBib3VuZHMgb2YgdGhlIG1lc2hcbiAgICAgICAgc2NhbGUuY29weShib3VuZHMuaGFsZkV4dGVudHMpO1xuICAgICAgICBsZXQgdG90YWxBcmVhID0gYXJlYS54ICogc2NhbGUueSAqIHNjYWxlLnogK1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJlYS55ICogc2NhbGUueCAqIHNjYWxlLnogK1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJlYS56ICogc2NhbGUueCAqIHNjYWxlLnk7XG4gICAgICAgIHRvdGFsQXJlYSAvPSBhcmVhLnV2O1xuICAgICAgICB0b3RhbEFyZWEgPSBNYXRoLnNxcnQodG90YWxBcmVhKTtcblxuICAgICAgICBjb25zdCBsaWdodG1hcFNpemUgPSBNYXRoLm1pbihtYXRoLm5leHRQb3dlck9mVHdvKHRvdGFsQXJlYSAqIHNpemVNdWx0KSwgdGhpcy5zY2VuZS5saWdodG1hcE1heFJlc29sdXRpb24gfHwgTUFYX0xJR0hUTUFQX1NJWkUpO1xuXG4gICAgICAgIHJldHVybiBsaWdodG1hcFNpemU7XG4gICAgfVxuXG4gICAgc2V0TGlnaHRtYXBwaW5nKG5vZGVzLCB2YWx1ZSwgcGFzc0NvdW50LCBzaGFkZXJEZWZzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG5vZGUubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaisrKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSBtZXNoSW5zdGFuY2VzW2pdO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zZXRMaWdodG1hcHBlZCh2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNoYWRlckRlZnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5fc2hhZGVyRGVmcyB8PSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gb25seSBsaWdodHMgdGhhdCBhZmZlY3QgbGlnaHRtYXBwZWQgb2JqZWN0cyBhcmUgdXNlZCBvbiB0aGlzIG1lc2ggbm93IHRoYXQgaXQgaXMgYmFrZWRcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hc2sgPSBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRDtcblxuICAgICAgICAgICAgICAgICAgICAvLyB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSBub2RlLnJlbmRlclRhcmdldHNbcGFzc10uY29sb3JCdWZmZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXgubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleC5tYWdGaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1twYXNzXSwgdGV4KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyBhbmQgYXBwbGllcyB0aGUgbGlnaHRtYXBzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eVtdfG51bGx9IG5vZGVzIC0gQW4gYXJyYXkgb2YgZW50aXRpZXMgKHdpdGggbW9kZWwgb3JcbiAgICAgKiByZW5kZXIgY29tcG9uZW50cykgdG8gcmVuZGVyIGxpZ2h0bWFwcyBmb3IuIElmIG5vdCBzdXBwbGllZCwgdGhlIGVudGlyZSBzY2VuZSB3aWxsIGJlIGJha2VkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbW9kZV0gLSBCYWtpbmcgbW9kZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcFxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1JESVJ9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXAgKyBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24gKHVzZWQgZm9yXG4gICAgICogYnVtcC9zcGVjdWxhcilcbiAgICAgKlxuICAgICAqIE9ubHkgbGlnaHRzIHdpdGggYmFrZURpcj10cnVlIHdpbGwgYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uLlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBCQUtFX0NPTE9SRElSfS5cbiAgICAgKi9cbiAgICBiYWtlKG5vZGVzLCBtb2RlID0gQkFLRV9DT0xPUkRJUikge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcblxuICAgICAgICAvLyB1cGRhdGUgc2t5Ym94XG4gICAgICAgIHRoaXMuc2NlbmUuX3VwZGF0ZVNreShkZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgZGV2aWNlLmZpcmUoJ2xpZ2h0bWFwcGVyOnN0YXJ0Jywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBzdGFydFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuc3RhdHMucmVuZGVyUGFzc2VzID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0U2hhZGVycyA9IGRldmljZS5fc2hhZGVyU3RhdHMubGlua2VkO1xuICAgICAgICBjb25zdCBzdGFydEZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZTtcbiAgICAgICAgY29uc3Qgc3RhcnRDb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWU7XG5cbiAgICAgICAgLy8gQmFrZU1lc2hOb2RlIG9iamVjdHMgZm9yIGJha2luZ1xuICAgICAgICBjb25zdCBiYWtlTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBhbGwgQmFrZU1lc2hOb2RlIG9iamVjdHNcbiAgICAgICAgY29uc3QgYWxsTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIC8gbWVzaEluc3RhbmNlcyBmb3IgYmFraW5nXG4gICAgICAgIGlmIChub2Rlcykge1xuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIGZvciBiYWtpbmcgYmFzZWQgb24gc3BlY2lmaWVkIGxpc3Qgb2Ygbm9kZXNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZXNbaV0sIGJha2VOb2RlcywgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIGZyb20gdGhlIHNjZW5lXG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHModGhpcy5yb290LCBudWxsLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gY29sbGVjdCBub2RlcyBmcm9tIHRoZSByb290IG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKHRoaXMucm9vdCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgJ0xNQmFrZScpO1xuXG4gICAgICAgIC8vIGJha2Ugbm9kZXNcbiAgICAgICAgaWYgKGJha2VOb2Rlcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIGRpc2FibGUgbGlnaHRtYXBwaW5nXG4gICAgICAgICAgICBjb25zdCBwYXNzQ291bnQgPSBtb2RlID09PSBCQUtFX0NPTE9SRElSID8gMiA6IDE7XG4gICAgICAgICAgICB0aGlzLnNldExpZ2h0bWFwcGluZyhiYWtlTm9kZXMsIGZhbHNlLCBwYXNzQ291bnQpO1xuXG4gICAgICAgICAgICB0aGlzLmluaXRCYWtlKGRldmljZSk7XG4gICAgICAgICAgICB0aGlzLmJha2VJbnRlcm5hbChwYXNzQ291bnQsIGJha2VOb2RlcywgYWxsTm9kZXMpO1xuXG4gICAgICAgICAgICAvLyBFbmFibGUgbmV3IGxpZ2h0bWFwc1xuICAgICAgICAgICAgbGV0IHNoYWRlckRlZnMgPSBTSEFERVJERUZfTE07XG5cbiAgICAgICAgICAgIGlmIChtb2RlID09PSBCQUtFX0NPTE9SRElSKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfRElSTE07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG1hcmsgbGlnaHRtYXAgYXMgY29udGFpbmluZyBhbWJpZW50IGxpZ2h0aW5nXG4gICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgICAgIHNoYWRlckRlZnMgfD0gU0hBREVSREVGX0xNQU1CSUVOVDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc2V0TGlnaHRtYXBwaW5nKGJha2VOb2RlcywgdHJ1ZSwgcGFzc0NvdW50LCBzaGFkZXJEZWZzKTtcblxuICAgICAgICAgICAgLy8gY2xlYW4gdXAgbWVtb3J5XG4gICAgICAgICAgICB0aGlzLmZpbmlzaEJha2UoYmFrZU5vZGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICBjb25zdCBub3dUaW1lID0gbm93KCk7XG4gICAgICAgIHRoaXMuc3RhdHMudG90YWxSZW5kZXJUaW1lID0gbm93VGltZSAtIHN0YXJ0VGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5zaGFkZXJzTGlua2VkID0gZGV2aWNlLl9zaGFkZXJTdGF0cy5saW5rZWQgLSBzdGFydFNoYWRlcnM7XG4gICAgICAgIHRoaXMuc3RhdHMuY29tcGlsZVRpbWUgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmNvbXBpbGVUaW1lIC0gc3RhcnRDb21waWxlVGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5mYm9UaW1lID0gZGV2aWNlLl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUgLSBzdGFydEZib1RpbWU7XG4gICAgICAgIHRoaXMuc3RhdHMubGlnaHRtYXBDb3VudCA9IGJha2VOb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBkZXZpY2UuZmlyZSgnbGlnaHRtYXBwZXI6ZW5kJywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBub3dUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvLyB0aGlzIGFsbG9jYXRlcyBsaWdodG1hcCB0ZXh0dXJlcyBhbmQgcmVuZGVyIHRhcmdldHMuXG4gICAgYWxsb2NhdGVUZXh0dXJlcyhiYWtlTm9kZXMsIHBhc3NDb3VudCkge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmFrZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8vIHJlcXVpcmVkIGxpZ2h0bWFwIHNpemVcbiAgICAgICAgICAgIGNvbnN0IGJha2VOb2RlID0gYmFrZU5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IHRoaXMuY2FsY3VsYXRlTGlnaHRtYXBTaXplKGJha2VOb2RlLm5vZGUpO1xuXG4gICAgICAgICAgICAvLyB0ZXh0dXJlIGFuZCByZW5kZXIgdGFyZ2V0IGZvciBlYWNoIHBhc3MsIHN0b3JlZCBwZXIgbm9kZVxuICAgICAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuY3JlYXRlVGV4dHVyZShzaXplLCAoJ2xpZ2h0bWFwcGVyX2xpZ2h0bWFwXycgKyBpKSk7XG4gICAgICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGV4KTtcbiAgICAgICAgICAgICAgICBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgsXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzaW5nbGUgdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgb2YgZWFjaCBzaXplXG4gICAgICAgICAgICBpZiAoIXRoaXMucmVuZGVyVGFyZ2V0cy5oYXMoc2l6ZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLmNyZWF0ZVRleHR1cmUoc2l6ZSwgKCdsaWdodG1hcHBlcl90ZW1wX2xpZ2h0bWFwXycgKyBzaXplKSk7XG4gICAgICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuc2V0KHNpemUsIG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGV4LFxuICAgICAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcmVwYXJlTGlnaHRzVG9CYWtlKGxheWVyQ29tcG9zaXRpb24sIGFsbExpZ2h0cywgYmFrZUxpZ2h0cykge1xuXG4gICAgICAgIC8vIGFtYmllbnQgbGlnaHRcbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuYW1iaWVudEJha2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGFtYmllbnRMaWdodCA9IG5ldyBCYWtlTGlnaHRBbWJpZW50KHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgYmFrZUxpZ2h0cy5wdXNoKGFtYmllbnRMaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY2VuZSBsaWdodHNcbiAgICAgICAgY29uc3Qgc2NlbmVMaWdodHMgPSBsYXllckNvbXBvc2l0aW9uLl9saWdodHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NlbmVMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gc2NlbmVMaWdodHNbaV07XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIGFsbCBsaWdodHMgYW5kIHRoZWlyIG9yaWdpbmFsIHNldHRpbmdzIHdlIG5lZWQgdG8gdGVtcG9yYXJpbHkgbW9kaWZ5XG4gICAgICAgICAgICBjb25zdCBiYWtlTGlnaHQgPSBuZXcgQmFrZUxpZ2h0U2ltcGxlKHRoaXMuc2NlbmUsIGxpZ2h0KTtcbiAgICAgICAgICAgIGFsbExpZ2h0cy5wdXNoKGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgIC8vIGJha2UgbGlnaHRcbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkICYmIChsaWdodC5tYXNrICYgTUFTS19CQUtFKSAhPT0gMCkge1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgYmFrZWQsIGl0IGNhbid0IGJlIHVzZWQgYXMgc3RhdGljXG4gICAgICAgICAgICAgICAgbGlnaHQuaXNTdGF0aWMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGxpZ2h0Lm1hc2sgPSAweEZGRkZGRkZGO1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBTSEFET1dVUERBVEVfUkVBTFRJTUUgOiBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICAgICAgICAgIGJha2VMaWdodHMucHVzaChiYWtlTGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc29ydCBiYWtlIGxpZ2h0cyBieSB0eXBlIHRvIG1pbmltaXplIHNoYWRlciBzd2l0Y2hlc1xuICAgICAgICBiYWtlTGlnaHRzLnNvcnQoKTtcbiAgICB9XG5cbiAgICByZXN0b3JlTGlnaHRzKGFsbExpZ2h0cykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhbGxMaWdodHNbaV0ucmVzdG9yZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBTY2VuZSgpIHtcblxuICAgICAgICAvLyBsaWdodG1hcHBlciBuZWVkcyBvcmlnaW5hbCBtb2RlbCBkcmF3IGNhbGxzXG4gICAgICAgIHRoaXMucmV2ZXJ0U3RhdGljID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLnNjZW5lLl9uZWVkc1N0YXRpY1ByZXBhcmUpIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX25lZWRzU3RhdGljUHJlcGFyZSA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5yZXZlcnRTdGF0aWMgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYmFja3VwXG4gICAgICAgIHRoaXMuZm9nID0gdGhpcy5zY2VuZS5mb2c7XG4gICAgICAgIHRoaXMuYW1iaWVudExpZ2h0LmNvcHkodGhpcy5zY2VuZS5hbWJpZW50TGlnaHQpO1xuXG4gICAgICAgIC8vIHNldCB1cCBzY2VuZVxuICAgICAgICB0aGlzLnNjZW5lLmZvZyA9IEZPR19OT05FO1xuXG4gICAgICAgIC8vIGlmIG5vdCBiYWtpbmcgYW1iaWVudCwgc2V0IGl0IHRvIGJsYWNrXG4gICAgICAgIGlmICghdGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5hbWJpZW50TGlnaHQuc2V0KDAsIDAsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXBwbHkgc2NlbmUgc2V0dGluZ3NcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRTY2VuZUNvbnN0YW50cygpO1xuICAgIH1cblxuICAgIHJlc3RvcmVTY2VuZSgpIHtcblxuICAgICAgICB0aGlzLnNjZW5lLmZvZyA9IHRoaXMuZm9nO1xuICAgICAgICB0aGlzLnNjZW5lLmFtYmllbnRMaWdodC5jb3B5KHRoaXMuYW1iaWVudExpZ2h0KTtcblxuICAgICAgICAvLyBSZXZlcnQgc3RhdGljIHByZXByb2Nlc3NpbmdcbiAgICAgICAgaWYgKHRoaXMucmV2ZXJ0U3RhdGljKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLl9uZWVkc1N0YXRpY1ByZXBhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBib3VuZGluZyBib3ggZm9yIGEgc2luZ2xlIG5vZGVcbiAgICBjb21wdXRlTm9kZUJvdW5kcyhtZXNoSW5zdGFuY2VzKSB7XG5cbiAgICAgICAgY29uc3QgYm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYm91bmRzLmNvcHkobWVzaEluc3RhbmNlc1swXS5hYWJiKTtcbiAgICAgICAgICAgIGZvciAobGV0IG0gPSAxOyBtIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IG0rKykge1xuICAgICAgICAgICAgICAgIGJvdW5kcy5hZGQobWVzaEluc3RhbmNlc1ttXS5hYWJiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBib3VuZHM7XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBib3VuZGluZyBib3ggZm9yIGVhY2ggbm9kZVxuICAgIGNvbXB1dGVOb2Rlc0JvdW5kcyhub2Rlcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2Rlc1tpXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgbm9kZXNbaV0uYm91bmRzID0gdGhpcy5jb21wdXRlTm9kZUJvdW5kcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgY29tcG91bmQgYm91bmRpbmcgYm94IGZvciBhbiBhcnJheSBvZiBtZXNoIGluc3RhbmNlc1xuICAgIGNvbXB1dGVCb3VuZHMobWVzaEluc3RhbmNlcykge1xuXG4gICAgICAgIGNvbnN0IGJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYm91bmRzLmNvcHkobWVzaEluc3RhbmNlc1swXS5hYWJiKTtcbiAgICAgICAgICAgIGZvciAobGV0IG0gPSAxOyBtIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IG0rKykge1xuICAgICAgICAgICAgICAgIGJvdW5kcy5hZGQobWVzaEluc3RhbmNlc1ttXS5hYWJiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBib3VuZHM7XG4gICAgfVxuXG4gICAgYmFja3VwTWF0ZXJpYWxzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsc1tpXSA9IG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXN0b3JlTWF0ZXJpYWxzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbHNbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsaWdodENhbWVyYVByZXBhcmUoZGV2aWNlLCBiYWtlTGlnaHQpIHtcblxuICAgICAgICBjb25zdCBsaWdodCA9IGJha2VMaWdodC5saWdodDtcbiAgICAgICAgbGV0IHNoYWRvd0NhbTtcblxuICAgICAgICAvLyBvbmx5IHByZXBhcmUgY2FtZXJhIGZvciBzcG90IGxpZ2h0LCBvdGhlciBjYW1lcmFzIG5lZWQgdG8gYmUgYWRqdXN0ZWQgcGVyIGN1YmVtYXAgZmFjZSAvIHBlciBub2RlIGxhdGVyXG4gICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICAgICAgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICAgICAgc2hhZG93Q2FtLl9ub2RlLnNldFBvc2l0aW9uKGxpZ2h0Ll9ub2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgc2hhZG93Q2FtLl9ub2RlLnNldFJvdGF0aW9uKGxpZ2h0Ll9ub2RlLmdldFJvdGF0aW9uKCkpO1xuICAgICAgICAgICAgc2hhZG93Q2FtLl9ub2RlLnJvdGF0ZUxvY2FsKC05MCwgMCwgMCk7XG5cbiAgICAgICAgICAgIHNoYWRvd0NhbS5wcm9qZWN0aW9uID0gUFJPSkVDVElPTl9QRVJTUEVDVElWRTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5uZWFyQ2xpcCA9IGxpZ2h0LmF0dGVudWF0aW9uRW5kIC8gMTAwMDtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5mYXJDbGlwID0gbGlnaHQuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBzaGFkb3dDYW0uYXNwZWN0UmF0aW8gPSAxO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZvdiA9IGxpZ2h0Ll9vdXRlckNvbmVBbmdsZSAqIDI7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlQ2FtZXJhRnJ1c3R1bShzaGFkb3dDYW0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgY2FtZXJhIC8gZnJ1c3R1bSBvZiB0aGUgbGlnaHQgZm9yIHJlbmRlcmluZyB0aGUgYmFrZU5vZGVcbiAgICAvLyByZXR1cm5zIHRydWUgaWYgbGlnaHQgYWZmZWN0cyB0aGUgYmFrZU5vZGVcbiAgICBsaWdodENhbWVyYVByZXBhcmVBbmRDdWxsKGJha2VMaWdodCwgYmFrZU5vZGUsIHNoYWRvd0NhbSwgY2FzdGVyQm91bmRzKSB7XG5cbiAgICAgICAgY29uc3QgbGlnaHQgPSBiYWtlTGlnaHQubGlnaHQ7XG4gICAgICAgIGxldCBsaWdodEFmZmVjdHNOb2RlID0gdHJ1ZTtcblxuICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG5cbiAgICAgICAgICAgIC8vIHR3ZWFrIGRpcmVjdGlvbmFsIGxpZ2h0IGNhbWVyYSB0byBmdWxseSBzZWUgYWxsIGNhc3RlcnMgYW5kIHRoZXkgYXJlIGZ1bGx5IGluc2lkZSB0aGUgZnJ1c3R1bVxuICAgICAgICAgICAgdGVtcFZlYy5jb3B5KGNhc3RlckJvdW5kcy5jZW50ZXIpO1xuICAgICAgICAgICAgdGVtcFZlYy55ICs9IGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy55O1xuXG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5ub2RlLnNldFBvc2l0aW9uKHRlbXBWZWMpO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEubm9kZS5zZXRFdWxlckFuZ2xlcygtOTAsIDAsIDApO1xuXG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5uZWFyQ2xpcCA9IDA7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5mYXJDbGlwID0gY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLnkgKiAyO1xuXG4gICAgICAgICAgICBjb25zdCBmcnVzdHVtU2l6ZSA9IE1hdGgubWF4KGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy54LCBjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueik7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5vcnRob0hlaWdodCA9IGZydXN0dW1TaXplO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGZvciBvdGhlciBsaWdodCB0eXBlcywgdGVzdCBpZiBsaWdodCBhZmZlY3RzIHRoZSBub2RlXG4gICAgICAgICAgICBpZiAoIWJha2VMaWdodC5saWdodEJvdW5kcy5pbnRlcnNlY3RzKGJha2VOb2RlLmJvdW5kcykpIHtcbiAgICAgICAgICAgICAgICBsaWdodEFmZmVjdHNOb2RlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwZXIgbWVzaEluc3RhbmNlIGN1bGxpbmcgZm9yIHNwb3QgbGlnaHQgb25seVxuICAgICAgICAvLyAob21uaSBsaWdodHMgY3VsbCBwZXIgZmFjZSBsYXRlciwgZGlyZWN0aW9uYWwgbGlnaHRzIGRvbid0IGN1bGwpXG4gICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgbGV0IG5vZGVWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBiYWtlTm9kZS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXNbaV0uX2lzVmlzaWJsZShzaGFkb3dDYW0pKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVWaXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFub2RlVmlzaWJsZSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0QWZmZWN0c05vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaWdodEFmZmVjdHNOb2RlO1xuICAgIH1cblxuICAgIC8vIHNldCB1cCBsaWdodCBhcnJheSBmb3IgYSBzaW5nbGUgbGlnaHRcbiAgICBzZXR1cExpZ2h0QXJyYXkobGlnaHRBcnJheSwgbGlnaHQpIHtcblxuICAgICAgICBsaWdodEFycmF5W0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0ubGVuZ3RoID0gMDtcbiAgICAgICAgbGlnaHRBcnJheVtMSUdIVFRZUEVfT01OSV0ubGVuZ3RoID0gMDtcbiAgICAgICAgbGlnaHRBcnJheVtMSUdIVFRZUEVfU1BPVF0ubGVuZ3RoID0gMDtcblxuICAgICAgICBsaWdodEFycmF5W2xpZ2h0LnR5cGVdWzBdID0gbGlnaHQ7XG4gICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgIH1cblxuICAgIHJlbmRlclNoYWRvd01hcChzaGFkb3dNYXBSZW5kZXJlZCwgY2FzdGVycywgbGlnaHRBcnJheSwgYmFrZUxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbGlnaHQgPSBiYWtlTGlnaHQubGlnaHQ7XG4gICAgICAgIGlmICghc2hhZG93TWFwUmVuZGVyZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgLy8gYWxsb2NhdGUgc2hhZG93IG1hcCBmcm9tIHRoZSBjYWNoZSB0byBhdm9pZCBwZXIgbGlnaHQgYWxsb2NhdGlvblxuICAgICAgICAgICAgaWYgKCFsaWdodC5zaGFkb3dNYXAgJiYgIXRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93TWFwID0gdGhpcy5zaGFkb3dNYXBDYWNoZS5nZXQodGhpcy5kZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwuY3VsbChsaWdodCwgY2FzdGVycywgdGhpcy5jYW1lcmEpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93UmVuZGVyZXIucmVuZGVyKGxpZ2h0LCB0aGlzLmNhbWVyYSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyTG9jYWwuY3VsbChsaWdodCwgY2FzdGVycyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXJTaGFkb3dzTG9jYWwobGlnaHRBcnJheVtsaWdodC50eXBlXSwgdGhpcy5jYW1lcmEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcG9zdHByb2Nlc3NUZXh0dXJlcyhkZXZpY2UsIGJha2VOb2RlcywgcGFzc0NvdW50KSB7XG5cbiAgICAgICAgY29uc3QgbnVtRGlsYXRlczJ4ID0gMTsgLy8gMSBvciAyIGRpbGF0ZXMgKGRlcGVuZGluZyBvbiBmaWx0ZXIgYmVpbmcgZW5hYmxlZClcbiAgICAgICAgY29uc3QgZGlsYXRlU2hhZGVyID0gdGhpcy5saWdodG1hcEZpbHRlcnMuc2hhZGVyRGlsYXRlO1xuXG4gICAgICAgIC8vIGJpbGF0ZXJhbCBkZW5vaXNlIGZpbHRlciAtIHJ1bnMgYXMgYSBmaXJzdCBwYXNzLCBiZWZvcmUgZGlsYXRlXG4gICAgICAgIGNvbnN0IGZpbHRlckxpZ2h0bWFwID0gdGhpcy5zY2VuZS5saWdodG1hcEZpbHRlckVuYWJsZWQ7XG4gICAgICAgIGlmIChmaWx0ZXJMaWdodG1hcCkge1xuICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMucHJlcGFyZURlbm9pc2UodGhpcy5zY2VuZS5saWdodG1hcEZpbHRlclJhbmdlLCB0aGlzLnNjZW5lLmxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBub2RlID0gMDsgbm9kZSA8IGJha2VOb2Rlcy5sZW5ndGg7IG5vZGUrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbbm9kZV07XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgYExNUG9zdDoke25vZGV9YCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXAgPSBub2RlUlQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wUlQgPSB0aGlzLnJlbmRlclRhcmdldHMuZ2V0KGxpZ2h0bWFwLndpZHRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wVGV4ID0gdGVtcFJULmNvbG9yQnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMucHJlcGFyZShsaWdodG1hcC53aWR0aCwgbGlnaHRtYXAuaGVpZ2h0KTtcblxuICAgICAgICAgICAgICAgIC8vIGJvdW5jZSBkaWxhdGUgYmV0d2VlbiB0ZXh0dXJlcywgZXhlY3V0ZSBkZW5vaXNlIG9uIHRoZSBmaXJzdCBwYXNzXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1EaWxhdGVzMng7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNldFNvdXJjZVRleHR1cmUobGlnaHRtYXApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiaWxhdGVyYWxGaWx0ZXJFbmFibGVkID0gZmlsdGVyTGlnaHRtYXAgJiYgcGFzcyA9PT0gMCAmJiBpID09PSAwO1xuICAgICAgICAgICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUlQsIGJpbGF0ZXJhbEZpbHRlckVuYWJsZWQgPyB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zaGFkZXJEZW5vaXNlIDogZGlsYXRlU2hhZGVyKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zZXRTb3VyY2VUZXh0dXJlKHRlbXBUZXgpO1xuICAgICAgICAgICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCBub2RlUlQsIGRpbGF0ZVNoYWRlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBiYWtlSW50ZXJuYWwocGFzc0NvdW50LCBiYWtlTm9kZXMsIGFsbE5vZGVzKSB7XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlTWF0ZXJpYWxzKGRldmljZSwgc2NlbmUsIHBhc3NDb3VudCk7XG4gICAgICAgIHRoaXMuc2V0dXBTY2VuZSgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvblxuICAgICAgICBzY2VuZS5sYXllcnMuX3VwZGF0ZSgpO1xuXG4gICAgICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94ZXMgZm9yIG5vZGVzXG4gICAgICAgIHRoaXMuY29tcHV0ZU5vZGVzQm91bmRzKGJha2VOb2Rlcyk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGxpZ2h0bWFwIHNpemVzIGFuZCBhbGxvY2F0ZSB0ZXh0dXJlc1xuICAgICAgICB0aGlzLmFsbG9jYXRlVGV4dHVyZXMoYmFrZU5vZGVzLCBwYXNzQ291bnQpO1xuXG4gICAgICAgIC8vIENvbGxlY3QgYmFrZWFibGUgbGlnaHRzLCBhbmQgYWxzbyBrZWVwIGFsbExpZ2h0cyBhbG9uZyB3aXRoIHRoZWlyIHByb3BlcnRpZXMgd2UgY2hhbmdlIHRvIHJlc3RvcmUgdGhlbSBsYXRlclxuICAgICAgICBjb25zdCBhbGxMaWdodHMgPSBbXSwgYmFrZUxpZ2h0cyA9IFtdO1xuICAgICAgICB0aGlzLnByZXBhcmVMaWdodHNUb0Jha2Uoc2NlbmUubGF5ZXJzLCBhbGxMaWdodHMsIGJha2VMaWdodHMpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMudXBkYXRlVHJhbnNmb3JtcyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gZ2V0IGFsbCBtZXNoSW5zdGFuY2VzIHRoYXQgY2FzdCBzaGFkb3dzIGludG8gbGlnaHRtYXAgYW5kIHNldCB0aGVtIHVwIGZvciByZWFsdGltZSBzaGFkb3cgY2FzdGluZ1xuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5wcmVwYXJlU2hhZG93Q2FzdGVycyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHNraW5uZWQgYW5kIG1vcnBoZWQgbWVzaGVzXG4gICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKGNhc3RlcnMpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmdwdVVwZGF0ZShjYXN0ZXJzKTtcblxuICAgICAgICAvLyBjb21wb3VuZCBib3VuZGluZyBib3ggZm9yIGFsbCBjYXN0ZXJzLCB1c2VkIHRvIGNvbXB1dGUgc2hhcmVkIGRpcmVjdGlvbmFsIGxpZ2h0IHNoYWRvd1xuICAgICAgICBjb25zdCBjYXN0ZXJCb3VuZHMgPSB0aGlzLmNvbXB1dGVCb3VuZHMoY2FzdGVycyk7XG5cbiAgICAgICAgbGV0IGksIGosIHJjdiwgbTtcblxuICAgICAgICAvLyBQcmVwYXJlIG1vZGVsc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tpXTtcbiAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAvLyBwYXRjaCBtZXNoSW5zdGFuY2VcbiAgICAgICAgICAgICAgICBtID0gcmN2W2pdO1xuXG4gICAgICAgICAgICAgICAgbS5zZXRMaWdodG1hcHBlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgbS5tYXNrID0gTUFTS19CQUtFOyAvLyBvbmx5IGFmZmVjdGVkIGJ5IExNIGxpZ2h0c1xuXG4gICAgICAgICAgICAgICAgLy8gcGF0Y2ggbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbS5tYXRlcmlhbC5saWdodE1hcCA/IG0ubWF0ZXJpYWwubGlnaHRNYXAgOiB0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgdGhpcy5ibGFja1RleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEaXNhYmxlIGFsbCBiYWtlYWJsZSBsaWdodHNcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IGJha2VMaWdodHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGJha2VMaWdodHNbal0ubGlnaHQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGlnaHRBcnJheSA9IFtbXSwgW10sIFtdXTtcbiAgICAgICAgbGV0IHBhc3MsIG5vZGU7XG4gICAgICAgIGxldCBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIEFjY3VtdWxhdGUgbGlnaHRzIGludG8gUkdCTSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZUxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZUxpZ2h0ID0gYmFrZUxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzQW1iaWVudExpZ2h0ID0gYmFrZUxpZ2h0IGluc3RhbmNlb2YgQmFrZUxpZ2h0QW1iaWVudDtcblxuICAgICAgICAgICAgLy8gbGlnaHQgY2FuIGJlIGJha2VkIHVzaW5nIG1hbnkgdmlydHVhbCBsaWdodHMgdG8gY3JlYXRlIHNvZnQgZWZmZWN0XG4gICAgICAgICAgICBsZXQgbnVtVmlydHVhbExpZ2h0cyA9IGJha2VMaWdodC5udW1WaXJ0dWFsTGlnaHRzO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb24gYmFraW5nIGlzIG5vdCBjdXJyZW50bHkgY29tcGF0aWJsZSB3aXRoIHZpcnR1YWwgbGlnaHRzLCBhcyB3ZSBlbmQgdXAgd2l0aCBubyB2YWxpZCBkaXJlY3Rpb24gaW4gbGlnaHRzIHBlbnVtYnJhXG4gICAgICAgICAgICBpZiAocGFzc0NvdW50ID4gMSAmJiBudW1WaXJ0dWFsTGlnaHRzID4gMSAmJiBiYWtlTGlnaHQubGlnaHQuYmFrZURpcikge1xuICAgICAgICAgICAgICAgIG51bVZpcnR1YWxMaWdodHMgPSAxO1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0xpZ2h0bWFwcGVyXFwncyBCQUtFX0NPTE9SRElSIG1vZGUgaXMgbm90IGNvbXBhdGlibGUgd2l0aCBMaWdodFxcJ3MgYmFrZU51bVNhbXBsZXMgbGFyZ2VyIHRoYW4gb25lLiBGb3JjaW5nIGl0IHRvIG9uZS4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgdmlydHVhbExpZ2h0SW5kZXggPSAwOyB2aXJ0dWFsTGlnaHRJbmRleCA8IG51bVZpcnR1YWxMaWdodHM7IHZpcnR1YWxMaWdodEluZGV4KyspIHtcblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBMaWdodDoke2Jha2VMaWdodC5saWdodC5fbm9kZS5uYW1lfToke3ZpcnR1YWxMaWdodEluZGV4fWApO1xuXG4gICAgICAgICAgICAgICAgLy8gcHJlcGFyZSB2aXJ0dWFsIGxpZ2h0XG4gICAgICAgICAgICAgICAgaWYgKG51bVZpcnR1YWxMaWdodHMgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGJha2VMaWdodC5wcmVwYXJlVmlydHVhbExpZ2h0KHZpcnR1YWxMaWdodEluZGV4LCBudW1WaXJ0dWFsTGlnaHRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBiYWtlTGlnaHQuc3RhcnRCYWtlKCk7XG4gICAgICAgICAgICAgICAgbGV0IHNoYWRvd01hcFJlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSB0aGlzLmxpZ2h0Q2FtZXJhUHJlcGFyZShkZXZpY2UsIGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKG5vZGUgPSAwOyBub2RlIDwgYmFrZU5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbbm9kZV07XG4gICAgICAgICAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRBZmZlY3RzTm9kZSA9IHRoaXMubGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbChiYWtlTGlnaHQsIGJha2VOb2RlLCBzaGFkb3dDYW0sIGNhc3RlckJvdW5kcyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRBZmZlY3RzTm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldHVwTGlnaHRBcnJheShsaWdodEFycmF5LCBiYWtlTGlnaHQubGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIubGlnaHRUZXh0dXJlQXRsYXMudXBkYXRlKGxpZ2h0QXJyYXlbTElHSFRUWVBFX1NQT1RdLCBsaWdodEFycmF5W0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgbGlnaHQgc2hhZG93IG1hcCBuZWVkcyB0byBiZSByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICBzaGFkb3dNYXBSZW5kZXJlZCA9IHRoaXMucmVuZGVyU2hhZG93TWFwKHNoYWRvd01hcFJlbmRlcmVkLCBjYXN0ZXJzLCBsaWdodEFycmF5LCBiYWtlTGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJMaWdodHMgPSBsaWdodEFycmF5W0xJR0hUVFlQRV9TUE9UXS5jb25jYXQobGlnaHRBcnJheVtMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLnVwZGF0ZShjbHVzdGVyTGlnaHRzLCB0aGlzLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSBvcmlnaW5hbCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrdXBNYXRlcmlhbHMocmN2KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSBiYWtlIGZpcnN0IHZpcnR1YWwgbGlnaHQgZm9yIHBhc3MgMSwgYXMgaXQgZG9lcyBub3QgaGFuZGxlIG92ZXJsYXBwaW5nIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPiAwICYmIHZpcnR1YWxMaWdodEluZGV4ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb24ndCBiYWtlIGFtYmllbnQgbGlnaHQgaW4gcGFzcyAxLCBhcyB0aGVyZSdzIG5vIG1haW4gZGlyZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQgJiYgcGFzcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYExNUGFzczoke3Bhc3N9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0bWFwIHNpemVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcFNpemUgPSBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdLmNvbG9yQnVmZmVyLndpZHRoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgbWF0Y2hpbmcgdGVtcCByZW5kZXIgdGFyZ2V0IHRvIHJlbmRlciB0b1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFJUID0gdGhpcy5yZW5kZXJUYXJnZXRzLmdldChsaWdodG1hcFNpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFRleCA9IHRlbXBSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IHNjZW5lLnVwZGF0ZVNoYWRlcnM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNoYWRlcnNVcGRhdGVkT24xc3RQYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwYXNzTWF0ZXJpYWwgPSB0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgbGFzdCB2aXJ0dWFsIGxpZ2h0IG9mIGFtYmllbnQgbGlnaHQsIG11bHRpcGx5IGFjY3VtdWxhdGVkIEFPIGxpZ2h0bWFwIHdpdGggYW1iaWVudCBsaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RWaXJ0dWFsTGlnaHRGb3JQYXNzID0gdmlydHVhbExpZ2h0SW5kZXggKyAxID09PSBudW1WaXJ0dWFsTGlnaHRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyAmJiBwYXNzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhc3NNYXRlcmlhbCA9IHRoaXMuYW1iaWVudEFPTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdXAgbWF0ZXJpYWwgZm9yIGJha2luZyBhIHBhc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByY3Zbal0ubWF0ZXJpYWwgPSBwYXNzTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBzaGFkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlU2hhZGVycyhyY3YpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwaW5nLXBvbmdpbmcgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNldENhbWVyYSh0aGlzLmNhbWVyYSwgdGVtcFJULCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IFBBU1NfRElSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25zdGFudEJha2VEaXIuc2V0VmFsdWUoYmFrZUxpZ2h0LmxpZ2h0LmJha2VEaXIgPyAxIDogMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLmFjdGl2YXRlKHRoaXMucmVuZGVyZXIubGlnaHRUZXh0dXJlQXRsYXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXJGb3J3YXJkKHRoaXMuY2FtZXJhLCByY3YsIHJjdi5sZW5ndGgsIGxpZ2h0QXJyYXksIFNIQURFUl9GT1JXQVJESERSKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnVwZGF0ZUVuZCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRzLnNoYWRvd01hcFRpbWUgKz0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdHMuZm9yd2FyZFRpbWUgKz0gdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRzLnJlbmRlclBhc3NlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlbXAgcmVuZGVyIHRhcmdldCBub3cgaGFzIGxpZ2h0bWFwLCBzdG9yZSBpdCBmb3IgdGhlIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc10gPSB0ZW1wUlQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCByZWxlYXNlIHByZXZpb3VzIGxpZ2h0bWFwIGludG8gdGVtcCByZW5kZXIgdGFyZ2V0IHBvb2xcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5zZXQobGlnaHRtYXBTaXplLCBub2RlUlQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcmN2Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbSA9IHJjdltqXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1twYXNzXSwgdGVtcFRleCk7IC8vIHBpbmctcG9uZ2luZyBpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0uX3NoYWRlckRlZnMgfD0gU0hBREVSREVGX0xNOyAvLyBmb3JjZSB1c2luZyBMTSBldmVuIGlmIG1hdGVyaWFsIGRvZXNuJ3QgaGF2ZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmV2ZXJ0IHRvIG9yaWdpbmFsIG1hdGVyaWFsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3RvcmVNYXRlcmlhbHMocmN2KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBiYWtlTGlnaHQuZW5kQmFrZSh0aGlzLnNoYWRvd01hcENhY2hlKTtcblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3Rwcm9jZXNzVGV4dHVyZXMoZGV2aWNlLCBiYWtlTm9kZXMsIHBhc3NDb3VudCk7XG5cbiAgICAgICAgLy8gcmVzdG9yZSBjaGFuZ2VzXG4gICAgICAgIGZvciAobm9kZSA9IDA7IG5vZGUgPCBhbGxOb2Rlcy5sZW5ndGg7IG5vZGUrKykge1xuICAgICAgICAgICAgYWxsTm9kZXNbbm9kZV0ucmVzdG9yZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZXN0b3JlTGlnaHRzKGFsbExpZ2h0cyk7XG4gICAgICAgIHRoaXMucmVzdG9yZVNjZW5lKCk7XG5cbiAgICAgICAgLy8gZW1wdHkgY2FjaGUgdG8gbWluaW1pemUgcGVyc2lzdGVudCBtZW1vcnkgdXNlIC4uIGlmIHNvbWUgY2FjaGVkIHRleHR1cmVzIGFyZSBuZWVkZWQsXG4gICAgICAgIC8vIHRoZXkgd2lsbCBiZSBhbGxvY2F0ZWQgYWdhaW4gYXMgbmVlZGVkXG4gICAgICAgIGlmICghY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0bWFwcGVyIH07XG4iXSwibmFtZXMiOlsiTUFYX0xJR0hUTUFQX1NJWkUiLCJQQVNTX0NPTE9SIiwiUEFTU19ESVIiLCJ0ZW1wVmVjIiwiVmVjMyIsIkxpZ2h0bWFwcGVyIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJyb290Iiwic2NlbmUiLCJyZW5kZXJlciIsImFzc2V0cyIsInNoYWRvd01hcENhY2hlIiwiX3RlbXBTZXQiLCJTZXQiLCJfaW5pdENhbGxlZCIsInBhc3NNYXRlcmlhbHMiLCJhbWJpZW50QU9NYXRlcmlhbCIsImZvZyIsImFtYmllbnRMaWdodCIsIkNvbG9yIiwicmVuZGVyVGFyZ2V0cyIsIk1hcCIsInN0YXRzIiwicmVuZGVyUGFzc2VzIiwibGlnaHRtYXBDb3VudCIsInRvdGFsUmVuZGVyVGltZSIsImZvcndhcmRUaW1lIiwiZmJvVGltZSIsInNoYWRvd01hcFRpbWUiLCJjb21waWxlVGltZSIsInNoYWRlcnNMaW5rZWQiLCJkZXN0cm95IiwiTGlnaHRtYXBDYWNoZSIsImRlY1JlZiIsImJsYWNrVGV4IiwiaW5pdEJha2UiLCJsaWdodG1hcEZpbHRlcnMiLCJMaWdodG1hcEZpbHRlcnMiLCJjb25zdGFudEJha2VEaXIiLCJzY29wZSIsInJlc29sdmUiLCJtYXRlcmlhbHMiLCJUZXh0dXJlIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBOCIsInR5cGUiLCJURVhUVVJFVFlQRV9SR0JNIiwibmFtZSIsImluY1JlZiIsImNhbWVyYSIsIkNhbWVyYSIsImNsZWFyQ29sb3IiLCJzZXQiLCJjbGVhckNvbG9yQnVmZmVyIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsImZydXN0dW1DdWxsaW5nIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiYXNwZWN0UmF0aW8iLCJub2RlIiwiR3JhcGhOb2RlIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHRpbmdQYXJhbXMiLCJMaWdodGluZ1BhcmFtcyIsInN1cHBvcnRzQXJlYUxpZ2h0cyIsIm1heFRleHR1cmVTaXplIiwic3JjUGFyYW1zIiwibGlnaHRpbmciLCJzaGFkb3dzRW5hYmxlZCIsInNoYWRvd0F0bGFzUmVzb2x1dGlvbiIsImNvb2tpZXNFbmFibGVkIiwiY29va2llQXRsYXNSZXNvbHV0aW9uIiwiYXJlYUxpZ2h0c0VuYWJsZWQiLCJjZWxscyIsIm1heExpZ2h0c1BlckNlbGwiLCJ3b3JsZENsdXN0ZXJzIiwiV29ybGRDbHVzdGVycyIsImZpbmlzaEJha2UiLCJiYWtlTm9kZXMiLCJkZXN0cm95UlQiLCJydCIsImNvbG9yQnVmZmVyIiwiZm9yRWFjaCIsImNsZWFyIiwibGVuZ3RoIiwiY3JlYXRlTWF0ZXJpYWxGb3JQYXNzIiwicGFzcyIsImFkZEFtYmllbnQiLCJtYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJjaHVua3MiLCJBUElWZXJzaW9uIiwiQ0hVTktBUElfMV81NSIsInRyYW5zZm9ybVZTIiwic2hhZGVyQ2h1bmtzIiwiYmFrZUxtRW5kQ2h1bmsiLCJzaGFkZXJDaHVua3NMaWdodG1hcHBlciIsImJha2VMbUVuZFBTIiwiYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCIsInRvRml4ZWQiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MiLCJhbWJpZW50IiwiYW1iaWVudFRpbnQiLCJiYXNlUFMiLCJsaWdodG1hcFBpeGVsRm9ybWF0IiwiZW5kUFMiLCJsaWdodE1hcCIsImJha2VEaXJMbUVuZFBTIiwib3V0cHV0QWxwaGFQUyIsIm91dHB1dEFscGhhT3BhcXVlUFMiLCJvdXRwdXRBbHBoYVByZW11bFBTIiwiY3VsbCIsIkNVTExGQUNFX05PTkUiLCJmb3JjZVV2MSIsInVwZGF0ZSIsImNyZWF0ZU1hdGVyaWFscyIsInBhc3NDb3VudCIsIm9uVXBkYXRlU2hhZGVyIiwib3B0aW9ucyIsImxpdE9wdGlvbnMiLCJsaWdodE1hcFdpdGhvdXRBbWJpZW50Iiwic2VwYXJhdGVBbWJpZW50IiwiY3JlYXRlVGV4dHVyZSIsInNpemUiLCJwcm9maWxlckhpbnQiLCJURVhISU5UX0xJR0hUTUFQIiwibWlwbWFwcyIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJjb2xsZWN0TW9kZWxzIiwiYWxsTm9kZXMiLCJlbmFibGVkIiwibWVzaEluc3RhbmNlcyIsIm1vZGVsIiwicHVzaCIsIkJha2VNZXNoTm9kZSIsImxpZ2h0bWFwcGVkIiwicmVuZGVyIiwiaGFzVXYxIiwiaSIsIm1lc2giLCJ2ZXJ0ZXhCdWZmZXIiLCJEZWJ1ZyIsImxvZyIsIm5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMiLCJoYXMiLCJhZGQiLCJfY2hpbGRyZW4iLCJwcmVwYXJlU2hhZG93Q2FzdGVycyIsIm5vZGVzIiwiY2FzdGVycyIsIm4iLCJjb21wb25lbnQiLCJjYXN0U2hhZG93cyIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJtZXNoZXMiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwidXBkYXRlVHJhbnNmb3JtcyIsImoiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImNhbGN1bGF0ZUxpZ2h0bWFwU2l6ZSIsImRhdGEiLCJzaXplTXVsdCIsImxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJzY2FsZSIsInNyY0FyZWEiLCJhc3NldCIsImdldCIsImFyZWEiLCJfYXJlYSIsIngiLCJ5IiwieiIsInV2IiwiYXJlYU11bHQiLCJib3VuZHMiLCJjb21wdXRlTm9kZUJvdW5kcyIsImNvcHkiLCJoYWxmRXh0ZW50cyIsInRvdGFsQXJlYSIsIk1hdGgiLCJzcXJ0IiwibGlnaHRtYXBTaXplIiwibWluIiwibWF0aCIsIm5leHRQb3dlck9mVHdvIiwibGlnaHRtYXBNYXhSZXNvbHV0aW9uIiwic2V0TGlnaHRtYXBwaW5nIiwidmFsdWUiLCJzaGFkZXJEZWZzIiwibWVzaEluc3RhbmNlIiwic2V0TGlnaHRtYXBwZWQiLCJfc2hhZGVyRGVmcyIsIm1hc2siLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsInRleCIsIkZJTFRFUl9MSU5FQVIiLCJzZXRSZWFsdGltZUxpZ2h0bWFwIiwiTWVzaEluc3RhbmNlIiwibGlnaHRtYXBQYXJhbU5hbWVzIiwiYmFrZSIsIm1vZGUiLCJCQUtFX0NPTE9SRElSIiwic3RhcnRUaW1lIiwibm93IiwiX3VwZGF0ZVNreSIsImZpcmUiLCJ0aW1lc3RhbXAiLCJ0YXJnZXQiLCJzdGFydFNoYWRlcnMiLCJfc2hhZGVyU3RhdHMiLCJsaW5rZWQiLCJzdGFydEZib1RpbWUiLCJfcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwic3RhcnRDb21waWxlVGltZSIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiYmFrZUludGVybmFsIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiYW1iaWVudEJha2UiLCJTSEFERVJERUZfTE1BTUJJRU5UIiwicG9wR3B1TWFya2VyIiwibm93VGltZSIsImFsbG9jYXRlVGV4dHVyZXMiLCJiYWtlTm9kZSIsIlJlbmRlclRhcmdldCIsImRlcHRoIiwicHJlcGFyZUxpZ2h0c1RvQmFrZSIsImxheWVyQ29tcG9zaXRpb24iLCJhbGxMaWdodHMiLCJiYWtlTGlnaHRzIiwiQmFrZUxpZ2h0QW1iaWVudCIsInNjZW5lTGlnaHRzIiwiX2xpZ2h0cyIsImxpZ2h0IiwiYmFrZUxpZ2h0IiwiQmFrZUxpZ2h0U2ltcGxlIiwiTUFTS19CQUtFIiwiaXNTdGF0aWMiLCJzaGFkb3dVcGRhdGVNb2RlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsInNvcnQiLCJyZXN0b3JlTGlnaHRzIiwicmVzdG9yZSIsInNldHVwU2NlbmUiLCJyZXZlcnRTdGF0aWMiLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiRk9HX05PTkUiLCJzZXRTY2VuZUNvbnN0YW50cyIsInJlc3RvcmVTY2VuZSIsIkJvdW5kaW5nQm94IiwiYWFiYiIsIm0iLCJjb21wdXRlTm9kZXNCb3VuZHMiLCJjb21wdXRlQm91bmRzIiwiYmFja3VwTWF0ZXJpYWxzIiwicmVzdG9yZU1hdGVyaWFscyIsImxpZ2h0Q2FtZXJhUHJlcGFyZSIsInNoYWRvd0NhbSIsIkxJR0hUVFlQRV9TUE9UIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNoYWRvd0NhbWVyYSIsIl9ub2RlIiwic2V0UG9zaXRpb24iLCJnZXRQb3NpdGlvbiIsInNldFJvdGF0aW9uIiwiZ2V0Um90YXRpb24iLCJyb3RhdGVMb2NhbCIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJuZWFyQ2xpcCIsImF0dGVudWF0aW9uRW5kIiwiZmFyQ2xpcCIsImZvdiIsIl9vdXRlckNvbmVBbmdsZSIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJsaWdodENhbWVyYVByZXBhcmVBbmRDdWxsIiwiY2FzdGVyQm91bmRzIiwibGlnaHRBZmZlY3RzTm9kZSIsImNlbnRlciIsInNldEV1bGVyQW5nbGVzIiwiZnJ1c3R1bVNpemUiLCJtYXgiLCJvcnRob0hlaWdodCIsImxpZ2h0Qm91bmRzIiwiaW50ZXJzZWN0cyIsIm5vZGVWaXNpYmxlIiwiX2lzVmlzaWJsZSIsInNldHVwTGlnaHRBcnJheSIsImxpZ2h0QXJyYXkiLCJMSUdIVFRZUEVfT01OSSIsInJlbmRlclNoYWRvd01hcCIsInNoYWRvd01hcFJlbmRlcmVkIiwic2hhZG93TWFwIiwiX3NoYWRvd1JlbmRlcmVyRGlyZWN0aW9uYWwiLCJzaGFkb3dSZW5kZXJlciIsIl9zaGFkb3dSZW5kZXJlckxvY2FsIiwicmVuZGVyU2hhZG93c0xvY2FsIiwicG9zdHByb2Nlc3NUZXh0dXJlcyIsIm51bURpbGF0ZXMyeCIsImRpbGF0ZVNoYWRlciIsInNoYWRlckRpbGF0ZSIsImZpbHRlckxpZ2h0bWFwIiwibGlnaHRtYXBGaWx0ZXJFbmFibGVkIiwicHJlcGFyZURlbm9pc2UiLCJsaWdodG1hcEZpbHRlclJhbmdlIiwibGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzIiwibm9kZVJUIiwibGlnaHRtYXAiLCJ0ZW1wUlQiLCJ0ZW1wVGV4IiwicHJlcGFyZSIsInNldFNvdXJjZVRleHR1cmUiLCJiaWxhdGVyYWxGaWx0ZXJFbmFibGVkIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwic2hhZGVyRGVub2lzZSIsImxheWVycyIsIl91cGRhdGUiLCJ1cGRhdGVDcHVTa2luTWF0cmljZXMiLCJncHVVcGRhdGUiLCJyY3YiLCJzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyIsImlzQW1iaWVudExpZ2h0IiwibnVtVmlydHVhbExpZ2h0cyIsImJha2VEaXIiLCJ3YXJuIiwidmlydHVhbExpZ2h0SW5kZXgiLCJwcmVwYXJlVmlydHVhbExpZ2h0Iiwic3RhcnRCYWtlIiwibGlnaHRUZXh0dXJlQXRsYXMiLCJjbHVzdGVyTGlnaHRzIiwiY29uY2F0IiwiZ2FtbWFDb3JyZWN0aW9uIiwidXBkYXRlU2hhZGVycyIsInBhc3NNYXRlcmlhbCIsImxhc3RWaXJ0dWFsTGlnaHRGb3JQYXNzIiwic2V0Q2FtZXJhIiwic2V0VmFsdWUiLCJhY3RpdmF0ZSIsIl9mb3J3YXJkVGltZSIsIl9zaGFkb3dNYXBUaW1lIiwicmVuZGVyRm9yd2FyZCIsIlNIQURFUl9GT1JXQVJESERSIiwidXBkYXRlRW5kIiwiZW5kQmFrZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStDQSxNQUFNQSxpQkFBaUIsR0FBRyxJQUFJLENBQUE7QUFFOUIsTUFBTUMsVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUNwQixNQUFNQyxRQUFRLEdBQUcsQ0FBQyxDQUFBO0FBRWxCLE1BQU1DLE9BQU8sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsV0FBVyxDQUFDO0FBQ2Q7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFQyxRQUFRLEVBQUVDLE1BQU0sRUFBRTtJQUMvQyxJQUFJLENBQUNKLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsSUFBSSxHQUFHQSxJQUFJLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxLQUFLLEdBQUdBLEtBQUssQ0FBQTtJQUNsQixJQUFJLENBQUNDLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7QUFDcEIsSUFBQSxJQUFJLENBQUNDLGNBQWMsR0FBR0YsUUFBUSxDQUFDRSxjQUFjLENBQUE7QUFFN0MsSUFBQSxJQUFJLENBQUNDLFFB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
