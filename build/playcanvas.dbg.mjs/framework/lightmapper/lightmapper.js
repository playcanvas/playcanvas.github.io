import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, CHUNKAPI_1_62, CULLFACE_NONE, TEXHINT_LIGHTMAP, TEXTURETYPE_DEFAULT, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
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
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';

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
    material.chunks.APIVersion = CHUNKAPI_1_62;
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
    if (device.isWebGPU) {
      Debug.warnOnce('Lightmapper is not supported on WebGPU, skipping.');
      return;
    }
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
      this.renderer.shadowRenderer.frameUpdate();

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
  renderShadowMap(shadowMapRendered, casters, bakeLight) {
    const light = bakeLight.light;
    const isClustered = this.scene.clusteredLightingEnabled;
    if (!shadowMapRendered && light.castShadows) {
      // allocate shadow map from the cache to avoid per light allocation
      if (!light.shadowMap && !isClustered) {
        light.shadowMap = this.shadowMapCache.get(this.device, light);
      }
      if (light.type === LIGHTTYPE_DIRECTIONAL) {
        this.renderer._shadowRendererDirectional.cull(light, casters, this.camera);
      } else {
        this.renderer._shadowRendererLocal.cull(light, casters);
      }
      const insideRenderPass = false;
      this.renderer.shadowRenderer.render(light, this.camera, insideRenderPass);
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
    device.setBlendState(BlendState.NOBLEND);
    device.setDepthState(DepthState.NODEPTH);
    device.setStencilState(null, null);
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
          shadowMapRendered = this.renderShadowMap(shadowMapRendered, casters, bakeLight);
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
              this.worldClusters.activate();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvbGlnaHRtYXBwZXIvbGlnaHRtYXBwZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBDSFVOS0FQSV8xXzYyLFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1QsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaGljcy9xdWFkLXJlbmRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTGlnaHRpbmdQYXJhbXMgfSBmcm9tICcuLi8uLi9zY2VuZS9saWdodGluZy9saWdodGluZy1wYXJhbXMuanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uLy4uL3NjZW5lL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3NMaWdodG1hcHBlciB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy1saWdodG1hcHBlci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkFLRV9DT0xPUkRJUixcbiAgICBGT0dfTk9ORSxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCxcbiAgICBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQywgUFJPSkVDVElPTl9QRVJTUEVDVElWRSxcbiAgICBTSEFERVJfRk9SV0FSREhEUixcbiAgICBTSEFERVJERUZfRElSTE0sIFNIQURFUkRFRl9MTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBNQVNLX0JBS0UsIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELFxuICAgIFNIQURPV1VQREFURV9SRUFMVElNRSwgU0hBRE9XVVBEQVRFX1RISVNGUkFNRVxufSBmcm9tICcuLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhIH0gZnJvbSAnLi4vLi4vc2NlbmUvY2FtZXJhLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEJha2VMaWdodFNpbXBsZSB9IGZyb20gJy4vYmFrZS1saWdodC1zaW1wbGUuanMnO1xuaW1wb3J0IHsgQmFrZUxpZ2h0QW1iaWVudCB9IGZyb20gJy4vYmFrZS1saWdodC1hbWJpZW50LmpzJztcbmltcG9ydCB7IEJha2VNZXNoTm9kZSB9IGZyb20gJy4vYmFrZS1tZXNoLW5vZGUuanMnO1xuaW1wb3J0IHsgTGlnaHRtYXBDYWNoZSB9IGZyb20gJy4uLy4uL3NjZW5lL2dyYXBoaWNzL2xpZ2h0bWFwLWNhY2hlLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwRmlsdGVycyB9IGZyb20gJy4vbGlnaHRtYXAtZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBCbGVuZFN0YXRlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlcHRoLXN0YXRlLmpzJztcblxuY29uc3QgTUFYX0xJR0hUTUFQX1NJWkUgPSAyMDQ4O1xuXG5jb25zdCBQQVNTX0NPTE9SID0gMDtcbmNvbnN0IFBBU1NfRElSID0gMTtcblxuY29uc3QgdGVtcFZlYyA9IG5ldyBWZWMzKCk7XG5cbi8qKlxuICogVGhlIGxpZ2h0bWFwcGVyIGlzIHVzZWQgdG8gYmFrZSBzY2VuZSBsaWdodHMgaW50byB0ZXh0dXJlcy5cbiAqL1xuY2xhc3MgTGlnaHRtYXBwZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBMaWdodG1hcHBlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGxpZ2h0bWFwcGVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9IHJvb3QgLSBUaGUgcm9vdCBlbnRpdHkgb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY2VuZS9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZSB0byBsaWdodG1hcC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcycpLkZvcndhcmRSZW5kZXJlcn0gcmVuZGVyZXIgLSBUaGVcbiAgICAgKiByZW5kZXJlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fSBhc3NldHMgLSBSZWdpc3RyeSBvZiBhc3NldHMgdG9cbiAgICAgKiBsaWdodG1hcC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCByb290LCBzY2VuZSwgcmVuZGVyZXIsIGFzc2V0cykge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5yb290ID0gcm9vdDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gcmVuZGVyZXI7XG4gICAgICAgIHRoaXMuYXNzZXRzID0gYXNzZXRzO1xuICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlID0gcmVuZGVyZXIuc2hhZG93TWFwQ2FjaGU7XG5cbiAgICAgICAgdGhpcy5fdGVtcFNldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5faW5pdENhbGxlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGludGVybmFsIG1hdGVyaWFscyB1c2VkIGJ5IGJha2luZ1xuICAgICAgICB0aGlzLnBhc3NNYXRlcmlhbHMgPSBbXTtcbiAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5mb2cgPSAnJztcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQgPSBuZXcgQ29sb3IoKTtcblxuICAgICAgICAvLyBkaWN0aW9uYXJ5IG9mIHNwYXJlIHJlbmRlciB0YXJnZXRzIHdpdGggY29sb3IgYnVmZmVyIGZvciBlYWNoIHVzZWQgc2l6ZVxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgICAgICAgIHJlbmRlclBhc3NlczogMCxcbiAgICAgICAgICAgIGxpZ2h0bWFwQ291bnQ6IDAsXG4gICAgICAgICAgICB0b3RhbFJlbmRlclRpbWU6IDAsXG4gICAgICAgICAgICBmb3J3YXJkVGltZTogMCxcbiAgICAgICAgICAgIGZib1RpbWU6IDAsXG4gICAgICAgICAgICBzaGFkb3dNYXBUaW1lOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDAsXG4gICAgICAgICAgICBzaGFkZXJzTGlua2VkOiAwXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICAvLyByZWxlYXNlIHJlZmVyZW5jZSB0byB0aGUgdGV4dHVyZVxuICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZih0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgdGhpcy5ibGFja1RleCA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgbGlnaHRtYXBzXG4gICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IG51bGw7XG4gICAgfVxuXG4gICAgaW5pdEJha2UoZGV2aWNlKSB7XG5cbiAgICAgICAgLy8gb25seSBpbml0aWFsaXplIG9uZSB0aW1lXG4gICAgICAgIGlmICghdGhpcy5faW5pdENhbGxlZCkge1xuICAgICAgICAgICAgdGhpcy5faW5pdENhbGxlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwIGZpbHRlcmluZyBzaGFkZXJzXG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycyA9IG5ldyBMaWdodG1hcEZpbHRlcnMoZGV2aWNlKTtcblxuICAgICAgICAgICAgLy8gc2hhZGVyIHJlbGF0ZWRcbiAgICAgICAgICAgIHRoaXMuY29uc3RhbnRCYWtlRGlyID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2Jha2VEaXInKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWxzID0gW107XG5cbiAgICAgICAgICAgIC8vIHNtYWxsIGJsYWNrIHRleHR1cmVcbiAgICAgICAgICAgIHRoaXMuYmxhY2tUZXggPSBuZXcgVGV4dHVyZSh0aGlzLmRldmljZSwge1xuICAgICAgICAgICAgICAgIHdpZHRoOiA0LFxuICAgICAgICAgICAgICAgIGhlaWdodDogNCxcbiAgICAgICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgICAgICAgICAgICAgIHR5cGU6IFRFWFRVUkVUWVBFX1JHQk0sXG4gICAgICAgICAgICAgICAgbmFtZTogJ2xpZ2h0bWFwQmxhY2snXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gaW5jcmVmIGJsYWNrIHRleHR1cmUgaW4gdGhlIGNhY2hlIHRvIGF2b2lkIGl0IGJlaW5nIGRlc3Ryb3llZFxuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGhpcy5ibGFja1RleCk7XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSB1c2VkIGZvciBiYWtpbmdcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IG5ldyBDYW1lcmEoKTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhckNvbG9yLnNldCgwLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhckNvbG9yQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhckRlcHRoQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bUN1bGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbWVyYS5wcm9qZWN0aW9uID0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUM7XG4gICAgICAgICAgICBjYW1lcmEuYXNwZWN0UmF0aW8gPSAxO1xuICAgICAgICAgICAgY2FtZXJhLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBsaWdodCBjbHVzdGVyIHN0cnVjdHVyZVxuICAgICAgICBpZiAodGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIGxpZ2h0IHBhcmFtcywgYW5kIGJhc2UgbW9zdCBwYXJhbWV0ZXJzIG9uIHRoZSBsaWdodGluZyBwYXJhbXMgb2YgdGhlIHNjZW5lXG4gICAgICAgICAgICBjb25zdCBsaWdodGluZ1BhcmFtcyA9IG5ldyBMaWdodGluZ1BhcmFtcyhkZXZpY2Uuc3VwcG9ydHNBcmVhTGlnaHRzLCBkZXZpY2UubWF4VGV4dHVyZVNpemUsICgpID0+IHt9KTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRpbmdQYXJhbXMgPSBsaWdodGluZ1BhcmFtcztcblxuICAgICAgICAgICAgY29uc3Qgc3JjUGFyYW1zID0gdGhpcy5zY2VuZS5saWdodGluZztcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLnNoYWRvd3NFbmFibGVkID0gc3JjUGFyYW1zLnNoYWRvd3NFbmFibGVkO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gc3JjUGFyYW1zLnNoYWRvd0F0bGFzUmVzb2x1dGlvbjtcblxuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuY29va2llc0VuYWJsZWQgPSBzcmNQYXJhbXMuY29va2llc0VuYWJsZWQ7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5jb29raWVBdGxhc1Jlc29sdXRpb24gPSBzcmNQYXJhbXMuY29va2llQXRsYXNSZXNvbHV0aW9uO1xuXG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5hcmVhTGlnaHRzRW5hYmxlZCA9IHNyY1BhcmFtcy5hcmVhTGlnaHRzRW5hYmxlZDtcblxuICAgICAgICAgICAgLy8gc29tZSBjdXN0b20gbGlnaHRtYXBwaW5nIHBhcmFtcyAtIHdlIGJha2Ugc2luZ2xlIGxpZ2h0IGEgdGltZVxuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuY2VsbHMgPSBuZXcgVmVjMygzLCAzLCAzKTtcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLm1heExpZ2h0c1BlckNlbGwgPSA0O1xuXG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMgPSBuZXcgV29ybGRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLm5hbWUgPSAnQ2x1c3RlckxpZ2h0bWFwcGVyJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZpbmlzaEJha2UoYmFrZU5vZGVzKSB7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbHMgPSBbXTtcblxuICAgICAgICBmdW5jdGlvbiBkZXN0cm95UlQocnQpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgY2FuIGNhdXNlIHJlZiBjb3VudCB0byBiZSAwIGFuZCB0ZXh0dXJlIGRlc3Ryb3llZFxuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5kZWNSZWYocnQuY29sb3JCdWZmZXIpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IHJlbmRlciB0YXJnZXQgaXRzZWxmXG4gICAgICAgICAgICBydC5kZXN0cm95KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzcGFyZSByZW5kZXIgdGFyZ2V0cyBpbmNsdWRpbmcgY29sb3IgYnVmZmVyXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5mb3JFYWNoKChydCkgPT4ge1xuICAgICAgICAgICAgZGVzdHJveVJUKHJ0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5jbGVhcigpO1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgcmVuZGVyIHRhcmdldHMgZnJvbSBub2RlcyAoYnV0IG5vdCBjb2xvciBidWZmZXIpXG4gICAgICAgIGJha2VOb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICBub2RlLnJlbmRlclRhcmdldHMuZm9yRWFjaCgocnQpID0+IHtcbiAgICAgICAgICAgICAgICBkZXN0cm95UlQocnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBub2RlLnJlbmRlclRhcmdldHMubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGhpcyBzaGFkZXIgaXMgb25seSB2YWxpZCBmb3Igc3BlY2lmaWMgYnJpZ2h0bmVzcyBhbmQgY29udHJhc3QgdmFsdWVzLCBkaXNwb3NlIGl0XG4gICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIC8vIGRlbGV0ZSBsaWdodCBjbHVzdGVyXG4gICAgICAgIGlmICh0aGlzLndvcmxkQ2x1c3RlcnMpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlTWF0ZXJpYWxGb3JQYXNzKGRldmljZSwgc2NlbmUsIHBhc3MsIGFkZEFtYmllbnQpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gYGxtTWF0ZXJpYWwtcGFzczoke3Bhc3N9LWFtYmllbnQ6JHthZGRBbWJpZW50fWA7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5BUElWZXJzaW9uID0gQ0hVTktBUElfMV82MjtcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLnRyYW5zZm9ybVZTID0gJyNkZWZpbmUgVVYxTEFZT1VUXFxuJyArIHNoYWRlckNodW5rcy50cmFuc2Zvcm1WUzsgLy8gZHJhdyBVVjFcblxuICAgICAgICBpZiAocGFzcyA9PT0gUEFTU19DT0xPUikge1xuICAgICAgICAgICAgbGV0IGJha2VMbUVuZENodW5rID0gc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIuYmFrZUxtRW5kUFM7IC8vIGVuY29kZSB0byBSR0JNXG4gICAgICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgICAgIC8vIGRpZmZ1c2UgbGlnaHQgc3RvcmVzIGFjY3VtdWxhdGVkIEFPLCBhcHBseSBjb250cmFzdCBhbmQgYnJpZ2h0bmVzcyB0byBpdFxuICAgICAgICAgICAgICAgIC8vIGFuZCBtdWx0aXBseSBhbWJpZW50IGxpZ2h0IGNvbG9yIGJ5IHRoZSBBT1xuICAgICAgICAgICAgICAgIGJha2VMbUVuZENodW5rID0gYFxuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gKChkRGlmZnVzZUxpZ2h0IC0gMC41KSAqIG1heCgke3NjZW5lLmFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QudG9GaXhlZCgxKX0gKyAxLjAsIDAuMCkpICsgMC41O1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IHZlYzMoJHtzY2VuZS5hbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MudG9GaXhlZCgxKX0pO1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gc2F0dXJhdGUoZERpZmZ1c2VMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgKj0gZEFtYmllbnRMaWdodDtcbiAgICAgICAgICAgICAgICBgICsgYmFrZUxtRW5kQ2h1bms7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFtYmllbnQgPSBuZXcgQ29sb3IoMCwgMCwgMCk7ICAgIC8vIGRvbid0IGJha2UgYW1iaWVudFxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFtYmllbnRUaW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5iYXNlUFMgPSBzaGFkZXJDaHVua3MuYmFzZVBTICsgKHNjZW5lLmxpZ2h0bWFwUGl4ZWxGb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkE4ID8gJ1xcbiNkZWZpbmUgTElHSFRNQVBfUkdCTVxcbicgOiAnJyk7XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuZW5kUFMgPSBiYWtlTG1FbmRDaHVuaztcbiAgICAgICAgICAgIG1hdGVyaWFsLmxpZ2h0TWFwID0gdGhpcy5ibGFja1RleDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5iYXNlUFMgPSBzaGFkZXJDaHVua3MuYmFzZVBTICsgJ1xcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZGlyTGlnaHRNYXA7XFxudW5pZm9ybSBmbG9hdCBiYWtlRGlyO1xcbic7XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuZW5kUFMgPSBzaGFkZXJDaHVua3NMaWdodG1hcHBlci5iYWtlRGlyTG1FbmRQUztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF2b2lkIHdyaXRpbmcgdW5yZWxhdGVkIHRoaW5ncyB0byBhbHBoYVxuICAgICAgICBtYXRlcmlhbC5jaHVua3Mub3V0cHV0QWxwaGFQUyA9ICdcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3Mub3V0cHV0QWxwaGFPcGFxdWVQUyA9ICdcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jaHVua3Mub3V0cHV0QWxwaGFQcmVtdWxQUyA9ICdcXG4nO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgbWF0ZXJpYWwuZm9yY2VVdjEgPSB0cnVlOyAvLyBwcm92aWRlIGRhdGEgdG8geGZvcm1VdjFcbiAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIGNyZWF0ZU1hdGVyaWFscyhkZXZpY2UsIHNjZW5lLCBwYXNzQ291bnQpIHtcbiAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc10pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc10gPSB0aGlzLmNyZWF0ZU1hdGVyaWFsRm9yUGFzcyhkZXZpY2UsIHNjZW5lLCBwYXNzLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYXRlcmlhbCB1c2VkIG9uIGxhc3QgcmVuZGVyIG9mIGFtYmllbnQgbGlnaHQgdG8gbXVsdGlwbHkgYWNjdW11bGF0ZWQgQU8gaW4gbGlnaHRtYXAgYnkgYW1iaWVudCBsaWdodFxuICAgICAgICBpZiAoIXRoaXMuYW1iaWVudEFPTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwgPSB0aGlzLmNyZWF0ZU1hdGVyaWFsRm9yUGFzcyhkZXZpY2UsIHNjZW5lLCAwLCB0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwub25VcGRhdGVTaGFkZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgTE0gYXMgd2l0aG91dCBhbWJpZW50LCB0byBhZGQgaXRcbiAgICAgICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gZG9uJ3QgYWRkIGFtYmllbnQgdG8gZGlmZnVzZSBkaXJlY3RseSBidXQga2VlcCBpdCBzZXBhcmF0ZSwgdG8gYWxsb3cgQU8gdG8gYmUgbXVsdGlwbGllZCBpblxuICAgICAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5zZXBhcmF0ZUFtYmllbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZVRleHR1cmUoc2l6ZSwgbmFtZSkge1xuICAgICAgICByZXR1cm4gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHByb2ZpbGVySGludDogVEVYSElOVF9MSUdIVE1BUCxcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgd2lkdGg6IHNpemUsXG4gICAgICAgICAgICBoZWlnaHQ6IHNpemUsXG4gICAgICAgICAgICBmb3JtYXQ6IHRoaXMuc2NlbmUubGlnaHRtYXBQaXhlbEZvcm1hdCxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgdHlwZTogdGhpcy5zY2VuZS5saWdodG1hcFBpeGVsRm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxULFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gcmVjdXJzaXZlbHkgd2FsayB0aGUgaGllcmFyY2h5IG9mIG5vZGVzIHN0YXJ0aW5nIGF0IHRoZSBzcGVjaWZpZWQgbm9kZVxuICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIHRoYXQgbmVlZCB0byBiZSBsaWdodG1hcHBlZCB0byBiYWtlTm9kZXMgYXJyYXlcbiAgICAvLyBjb2xsZWN0IGFsbCBub2RlcyB3aXRoIGdlb21ldHJ5IHRvIGFsbE5vZGVzIGFycmF5XG4gICAgY29sbGVjdE1vZGVscyhub2RlLCBiYWtlTm9kZXMsIGFsbE5vZGVzKSB7XG4gICAgICAgIGlmICghbm9kZS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgLy8gbWVzaCBpbnN0YW5jZXMgZnJvbSBtb2RlbCBjb21wb25lbnRcbiAgICAgICAgbGV0IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChub2RlLm1vZGVsPy5tb2RlbCAmJiBub2RlLm1vZGVsPy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoYWxsTm9kZXMpIGFsbE5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlKSk7XG4gICAgICAgICAgICBpZiAobm9kZS5tb2RlbC5saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgICAgIGlmIChiYWtlTm9kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcyA9IG5vZGUubW9kZWwubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtZXNoIGluc3RhbmNlcyBmcm9tIHJlbmRlciBjb21wb25lbnRcbiAgICAgICAgaWYgKG5vZGUucmVuZGVyPy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoYWxsTm9kZXMpIGFsbE5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlKSk7XG4gICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIubGlnaHRtYXBwZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoYmFrZU5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMgPSBub2RlLnJlbmRlci5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBsZXQgaGFzVXYxID0gdHJ1ZTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2VzW2ldLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjEpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcubG9nKGBMaWdodG1hcHBlciAtIG5vZGUgWyR7bm9kZS5uYW1lfV0gY29udGFpbnMgbWVzaGVzIHdpdGhvdXQgcmVxdWlyZWQgdXYxLCBleGNsdWRpbmcgaXQgZnJvbSBiYWtpbmcuYCk7XG4gICAgICAgICAgICAgICAgICAgIGhhc1V2MSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChoYXNVdjEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2VzW2ldLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhpcyBtZXNoIGFuIGluc3RhbmNlIG9mIGFscmVhZHkgdXNlZCBtZXNoIGluIHRoaXMgbm9kZVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fdGVtcFNldC5oYXMobWVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgZWFjaCBpbnN0YW5jZSAob2JqZWN0IHdpdGggc2hhcmVkIFZCKSBhcyBzZXBhcmF0ZSBcIm5vZGVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgYmFrZU5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlLCBbbWVzaEluc3RhbmNlc1tpXV0pKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90ZW1wU2V0LmFkZChtZXNoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl90ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IGFsbCBub24tc2hhcmVkIG9iamVjdHMgYXMgb25lIFwibm9kZVwiXG4gICAgICAgICAgICAgICAgaWYgKG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUsIG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZS5fY2hpbGRyZW5baV0sIGJha2VOb2RlcywgYWxsTm9kZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZSBhbGwgbWVzaEluc3RhbmNlcyB0aGF0IGNhc3Qgc2hhZG93cyBpbnRvIGxpZ2h0bWFwc1xuICAgIHByZXBhcmVTaGFkb3dDYXN0ZXJzKG5vZGVzKSB7XG5cbiAgICAgICAgY29uc3QgY2FzdGVycyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IG5vZGVzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2Rlc1tuXS5jb21wb25lbnQ7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5jYXN0U2hhZG93cyA9IGNvbXBvbmVudC5jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5jYXN0U2hhZG93c0xpZ2h0bWFwKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBub2Rlc1tuXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlc1tpXS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY2FzdGVycy5wdXNoKG1lc2hlc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNhc3RlcnM7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyB3b3JsZCB0cmFuc2Zvcm0gZm9yIG5vZGVzXG4gICAgdXBkYXRlVHJhbnNmb3Jtcyhub2Rlcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2Rlc1tpXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tqXS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb3RlOiB0aGlzIGZ1bmN0aW9uIGlzIGFsc28gY2FsbGVkIGJ5IHRoZSBFZGl0b3IgdG8gZGlzcGxheSBlc3RpbWF0ZWQgTE0gc2l6ZSBpbiB0aGUgaW5zcGVjdG9yLFxuICAgIC8vIGRvIG5vdCBjaGFuZ2UgaXRzIHNpZ25hdHVyZS5cbiAgICBjYWxjdWxhdGVMaWdodG1hcFNpemUobm9kZSkge1xuICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgY29uc3Qgc2l6ZU11bHQgPSB0aGlzLnNjZW5lLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgfHwgMTY7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGVtcFZlYztcblxuICAgICAgICBsZXQgc3JjQXJlYSwgbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcblxuICAgICAgICBpZiAobm9kZS5tb2RlbCkge1xuICAgICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IG5vZGUubW9kZWwubGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICAgICAgICAgIGlmIChub2RlLm1vZGVsLmFzc2V0KSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHRoaXMuYXNzZXRzLmdldChub2RlLm1vZGVsLmFzc2V0KS5kYXRhO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLmFyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuYXJlYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG5vZGUubW9kZWwuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gbm9kZS5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5fYXJlYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5yZW5kZXIpIHtcbiAgICAgICAgICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSBub2RlLnJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLnR5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IG5vZGUucmVuZGVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuX2FyZWE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb3B5IGFyZWFcbiAgICAgICAgY29uc3QgYXJlYSA9IHsgeDogMSwgeTogMSwgejogMSwgdXY6IDEgfTtcbiAgICAgICAgaWYgKHNyY0FyZWEpIHtcbiAgICAgICAgICAgIGFyZWEueCA9IHNyY0FyZWEueDtcbiAgICAgICAgICAgIGFyZWEueSA9IHNyY0FyZWEueTtcbiAgICAgICAgICAgIGFyZWEueiA9IHNyY0FyZWEuejtcbiAgICAgICAgICAgIGFyZWEudXYgPSBzcmNBcmVhLnV2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXJlYU11bHQgPSBsaWdodG1hcFNpemVNdWx0aXBsaWVyIHx8IDE7XG4gICAgICAgIGFyZWEueCAqPSBhcmVhTXVsdDtcbiAgICAgICAgYXJlYS55ICo9IGFyZWFNdWx0O1xuICAgICAgICBhcmVhLnogKj0gYXJlYU11bHQ7XG5cbiAgICAgICAgLy8gYm91bmRzIG9mIHRoZSBjb21wb25lbnRcbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5yZW5kZXIgfHwgbm9kZS5tb2RlbDtcbiAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5jb21wdXRlTm9kZUJvdW5kcyhjb21wb25lbnQubWVzaEluc3RhbmNlcyk7XG5cbiAgICAgICAgLy8gdG90YWwgYXJlYSBpbiB0aGUgbGlnaHRtYXAgaXMgYmFzZWQgb24gdGhlIHdvcmxkIHNwYWNlIGJvdW5kcyBvZiB0aGUgbWVzaFxuICAgICAgICBzY2FsZS5jb3B5KGJvdW5kcy5oYWxmRXh0ZW50cyk7XG4gICAgICAgIGxldCB0b3RhbEFyZWEgPSBhcmVhLnggKiBzY2FsZS55ICogc2NhbGUueiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhLnkgKiBzY2FsZS54ICogc2NhbGUueiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhLnogKiBzY2FsZS54ICogc2NhbGUueTtcbiAgICAgICAgdG90YWxBcmVhIC89IGFyZWEudXY7XG4gICAgICAgIHRvdGFsQXJlYSA9IE1hdGguc3FydCh0b3RhbEFyZWEpO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0bWFwU2l6ZSA9IE1hdGgubWluKG1hdGgubmV4dFBvd2VyT2ZUd28odG90YWxBcmVhICogc2l6ZU11bHQpLCB0aGlzLnNjZW5lLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiB8fCBNQVhfTElHSFRNQVBfU0laRSk7XG5cbiAgICAgICAgcmV0dXJuIGxpZ2h0bWFwU2l6ZTtcbiAgICB9XG5cbiAgICBzZXRMaWdodG1hcHBpbmcobm9kZXMsIHZhbHVlLCBwYXNzQ291bnQsIHNoYWRlckRlZnMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbm9kZS5tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBqKyspIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbal07XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZGVyRGVmcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9zaGFkZXJEZWZzIHw9IHNoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IGxpZ2h0cyB0aGF0IGFmZmVjdCBsaWdodG1hcHBlZCBvYmplY3RzIGFyZSB1c2VkIG9uIHRoaXMgbWVzaCBub3cgdGhhdCBpdCBpcyBiYWtlZFxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWFzayA9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IG5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXS5jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleC5taW5GaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Lm1hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzW3Bhc3NdLCB0ZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGFuZCBhcHBsaWVzIHRoZSBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5W118bnVsbH0gbm9kZXMgLSBBbiBhcnJheSBvZiBlbnRpdGllcyAod2l0aCBtb2RlbCBvclxuICAgICAqIHJlbmRlciBjb21wb25lbnRzKSB0byByZW5kZXIgbGlnaHRtYXBzIGZvci4gSWYgbm90IHN1cHBsaWVkLCB0aGUgZW50aXJlIHNjZW5lIHdpbGwgYmUgYmFrZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttb2RlXSAtIEJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3JcbiAgICAgKiBidW1wL3NwZWN1bGFyKVxuICAgICAqXG4gICAgICogT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24uXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEJBS0VfQ09MT1JESVJ9LlxuICAgICAqL1xuICAgIGJha2Uobm9kZXMsIG1vZGUgPSBCQUtFX0NPTE9SRElSKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGlmIChkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKCdMaWdodG1hcHBlciBpcyBub3Qgc3VwcG9ydGVkIG9uIFdlYkdQVSwgc2tpcHBpbmcuJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcblxuICAgICAgICAvLyB1cGRhdGUgc2t5Ym94XG4gICAgICAgIHRoaXMuc2NlbmUuX3VwZGF0ZVNreShkZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgZGV2aWNlLmZpcmUoJ2xpZ2h0bWFwcGVyOnN0YXJ0Jywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBzdGFydFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuc3RhdHMucmVuZGVyUGFzc2VzID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0U2hhZGVycyA9IGRldmljZS5fc2hhZGVyU3RhdHMubGlua2VkO1xuICAgICAgICBjb25zdCBzdGFydEZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZTtcbiAgICAgICAgY29uc3Qgc3RhcnRDb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWU7XG5cbiAgICAgICAgLy8gQmFrZU1lc2hOb2RlIG9iamVjdHMgZm9yIGJha2luZ1xuICAgICAgICBjb25zdCBiYWtlTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBhbGwgQmFrZU1lc2hOb2RlIG9iamVjdHNcbiAgICAgICAgY29uc3QgYWxsTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIC8gbWVzaEluc3RhbmNlcyBmb3IgYmFraW5nXG4gICAgICAgIGlmIChub2Rlcykge1xuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIGZvciBiYWtpbmcgYmFzZWQgb24gc3BlY2lmaWVkIGxpc3Qgb2Ygbm9kZXNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZXNbaV0sIGJha2VOb2RlcywgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIGZyb20gdGhlIHNjZW5lXG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHModGhpcy5yb290LCBudWxsLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gY29sbGVjdCBub2RlcyBmcm9tIHRoZSByb290IG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKHRoaXMucm9vdCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgJ0xNQmFrZScpO1xuXG4gICAgICAgIC8vIGJha2Ugbm9kZXNcbiAgICAgICAgaWYgKGJha2VOb2Rlcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2hhZG93UmVuZGVyZXIuZnJhbWVVcGRhdGUoKTtcblxuICAgICAgICAgICAgLy8gZGlzYWJsZSBsaWdodG1hcHBpbmdcbiAgICAgICAgICAgIGNvbnN0IHBhc3NDb3VudCA9IG1vZGUgPT09IEJBS0VfQ09MT1JESVIgPyAyIDogMTtcbiAgICAgICAgICAgIHRoaXMuc2V0TGlnaHRtYXBwaW5nKGJha2VOb2RlcywgZmFsc2UsIHBhc3NDb3VudCk7XG5cbiAgICAgICAgICAgIHRoaXMuaW5pdEJha2UoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuYmFrZUludGVybmFsKHBhc3NDb3VudCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgICAgIC8vIEVuYWJsZSBuZXcgbGlnaHRtYXBzXG4gICAgICAgICAgICBsZXQgc2hhZGVyRGVmcyA9IFNIQURFUkRFRl9MTTtcblxuICAgICAgICAgICAgaWYgKG1vZGUgPT09IEJBS0VfQ09MT1JESVIpIHtcbiAgICAgICAgICAgICAgICBzaGFkZXJEZWZzIHw9IFNIQURFUkRFRl9ESVJMTTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbWFyayBsaWdodG1hcCBhcyBjb250YWluaW5nIGFtYmllbnQgbGlnaHRpbmdcbiAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfTE1BTUJJRU5UO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZXRMaWdodG1hcHBpbmcoYmFrZU5vZGVzLCB0cnVlLCBwYXNzQ291bnQsIHNoYWRlckRlZnMpO1xuXG4gICAgICAgICAgICAvLyBjbGVhbiB1cCBtZW1vcnlcbiAgICAgICAgICAgIHRoaXMuZmluaXNoQmFrZShiYWtlTm9kZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IG5vd1RpbWUgPSBub3coKTtcbiAgICAgICAgdGhpcy5zdGF0cy50b3RhbFJlbmRlclRpbWUgPSBub3dUaW1lIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLnNoYWRlcnNMaW5rZWQgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmxpbmtlZCAtIHN0YXJ0U2hhZGVycztcbiAgICAgICAgdGhpcy5zdGF0cy5jb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWUgLSBzdGFydENvbXBpbGVUaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLmZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSAtIHN0YXJ0RmJvVGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5saWdodG1hcENvdW50ID0gYmFrZU5vZGVzLmxlbmd0aDtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGRldmljZS5maXJlKCdsaWdodG1hcHBlcjplbmQnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vd1RpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8vIHRoaXMgYWxsb2NhdGVzIGxpZ2h0bWFwIHRleHR1cmVzIGFuZCByZW5kZXIgdGFyZ2V0cy5cbiAgICBhbGxvY2F0ZVRleHR1cmVzKGJha2VOb2RlcywgcGFzc0NvdW50KSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYWtlTm9kZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgLy8gcmVxdWlyZWQgbGlnaHRtYXAgc2l6ZVxuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gdGhpcy5jYWxjdWxhdGVMaWdodG1hcFNpemUoYmFrZU5vZGUubm9kZSk7XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmUgYW5kIHJlbmRlciB0YXJnZXQgZm9yIGVhY2ggcGFzcywgc3RvcmVkIHBlciBub2RlXG4gICAgICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5jcmVhdGVUZXh0dXJlKHNpemUsICgnbGlnaHRtYXBwZXJfbGlnaHRtYXBfJyArIGkpKTtcbiAgICAgICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXgpO1xuICAgICAgICAgICAgICAgIGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc10gPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IHRleCxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNpbmdsZSB0ZW1wb3JhcnkgcmVuZGVyIHRhcmdldCBvZiBlYWNoIHNpemVcbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXRzLmhhcyhzaXplKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuY3JlYXRlVGV4dHVyZShzaXplLCAoJ2xpZ2h0bWFwcGVyX3RlbXBfbGlnaHRtYXBfJyArIHNpemUpKTtcbiAgICAgICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5zZXQoc2l6ZSwgbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgsXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByZXBhcmVMaWdodHNUb0Jha2UobGF5ZXJDb21wb3NpdGlvbiwgYWxsTGlnaHRzLCBiYWtlTGlnaHRzKSB7XG5cbiAgICAgICAgLy8gYW1iaWVudCBsaWdodFxuICAgICAgICBpZiAodGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgY29uc3QgYW1iaWVudExpZ2h0ID0gbmV3IEJha2VMaWdodEFtYmllbnQodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICBiYWtlTGlnaHRzLnB1c2goYW1iaWVudExpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjZW5lIGxpZ2h0c1xuICAgICAgICBjb25zdCBzY2VuZUxpZ2h0cyA9IGxheWVyQ29tcG9zaXRpb24uX2xpZ2h0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZUxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBzY2VuZUxpZ2h0c1tpXTtcblxuICAgICAgICAgICAgLy8gc3RvcmUgYWxsIGxpZ2h0cyBhbmQgdGhlaXIgb3JpZ2luYWwgc2V0dGluZ3Mgd2UgbmVlZCB0byB0ZW1wb3JhcmlseSBtb2RpZnlcbiAgICAgICAgICAgIGNvbnN0IGJha2VMaWdodCA9IG5ldyBCYWtlTGlnaHRTaW1wbGUodGhpcy5zY2VuZSwgbGlnaHQpO1xuICAgICAgICAgICAgYWxsTGlnaHRzLnB1c2goYmFrZUxpZ2h0KTtcblxuICAgICAgICAgICAgLy8gYmFrZSBsaWdodFxuICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQgJiYgKGxpZ2h0Lm1hc2sgJiBNQVNLX0JBS0UpICE9PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBiYWtlZCwgaXQgY2FuJ3QgYmUgdXNlZCBhcyBzdGF0aWNcbiAgICAgICAgICAgICAgICBsaWdodC5pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgbGlnaHQubWFzayA9IDB4RkZGRkZGRkY7XG4gICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IFNIQURPV1VQREFURV9SRUFMVElNRSA6IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgICAgICAgICAgYmFrZUxpZ2h0cy5wdXNoKGJha2VMaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzb3J0IGJha2UgbGlnaHRzIGJ5IHR5cGUgdG8gbWluaW1pemUgc2hhZGVyIHN3aXRjaGVzXG4gICAgICAgIGJha2VMaWdodHMuc29ydCgpO1xuICAgIH1cblxuICAgIHJlc3RvcmVMaWdodHMoYWxsTGlnaHRzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFsbExpZ2h0c1tpXS5yZXN0b3JlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFNjZW5lKCkge1xuXG4gICAgICAgIC8vIGxpZ2h0bWFwcGVyIG5lZWRzIG9yaWdpbmFsIG1vZGVsIGRyYXcgY2FsbHNcbiAgICAgICAgdGhpcy5yZXZlcnRTdGF0aWMgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuX25lZWRzU3RhdGljUHJlcGFyZSkge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5fbmVlZHNTdGF0aWNQcmVwYXJlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnJldmVydFN0YXRpYyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBiYWNrdXBcbiAgICAgICAgdGhpcy5mb2cgPSB0aGlzLnNjZW5lLmZvZztcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQuY29weSh0aGlzLnNjZW5lLmFtYmllbnRMaWdodCk7XG5cbiAgICAgICAgLy8gc2V0IHVwIHNjZW5lXG4gICAgICAgIHRoaXMuc2NlbmUuZm9nID0gRk9HX05PTkU7XG5cbiAgICAgICAgLy8gaWYgbm90IGJha2luZyBhbWJpZW50LCBzZXQgaXQgdG8gYmxhY2tcbiAgICAgICAgaWYgKCF0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLmFtYmllbnRMaWdodC5zZXQoMCwgMCwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcHBseSBzY2VuZSBzZXR0aW5nc1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFNjZW5lQ29uc3RhbnRzKCk7XG4gICAgfVxuXG4gICAgcmVzdG9yZVNjZW5lKCkge1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZm9nID0gdGhpcy5mb2c7XG4gICAgICAgIHRoaXMuc2NlbmUuYW1iaWVudExpZ2h0LmNvcHkodGhpcy5hbWJpZW50TGlnaHQpO1xuXG4gICAgICAgIC8vIFJldmVydCBzdGF0aWMgcHJlcHJvY2Vzc2luZ1xuICAgICAgICBpZiAodGhpcy5yZXZlcnRTdGF0aWMpIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX25lZWRzU3RhdGljUHJlcGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGJvdW5kaW5nIGJveCBmb3IgYSBzaW5nbGUgbm9kZVxuICAgIGNvbXB1dGVOb2RlQm91bmRzKG1lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICBjb25zdCBib3VuZHMgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgICAgICBpZiAobWVzaEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBib3VuZHMuY29weShtZXNoSW5zdGFuY2VzWzBdLmFhYmIpO1xuICAgICAgICAgICAgZm9yIChsZXQgbSA9IDE7IG0gPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgYm91bmRzLmFkZChtZXNoSW5zdGFuY2VzW21dLmFhYmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJvdW5kcztcbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGJvdW5kaW5nIGJveCBmb3IgZWFjaCBub2RlXG4gICAgY29tcHV0ZU5vZGVzQm91bmRzKG5vZGVzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG5vZGVzW2ldLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBub2Rlc1tpXS5ib3VuZHMgPSB0aGlzLmNvbXB1dGVOb2RlQm91bmRzKG1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBjb21wb3VuZCBib3VuZGluZyBib3ggZm9yIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgY29tcHV0ZUJvdW5kcyhtZXNoSW5zdGFuY2VzKSB7XG5cbiAgICAgICAgY29uc3QgYm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBib3VuZHMuY29weShtZXNoSW5zdGFuY2VzWzBdLmFhYmIpO1xuICAgICAgICAgICAgZm9yIChsZXQgbSA9IDE7IG0gPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgYm91bmRzLmFkZChtZXNoSW5zdGFuY2VzW21dLmFhYmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJvdW5kcztcbiAgICB9XG5cbiAgICBiYWNrdXBNYXRlcmlhbHMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWxzW2ldID0gbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3RvcmVNYXRlcmlhbHMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsc1tpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxpZ2h0Q2FtZXJhUHJlcGFyZShkZXZpY2UsIGJha2VMaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gYmFrZUxpZ2h0LmxpZ2h0O1xuICAgICAgICBsZXQgc2hhZG93Q2FtO1xuXG4gICAgICAgIC8vIG9ubHkgcHJlcGFyZSBjYW1lcmEgZm9yIHNwb3QgbGlnaHQsIG90aGVyIGNhbWVyYXMgbmVlZCB0byBiZSBhZGp1c3RlZCBwZXIgY3ViZW1hcCBmYWNlIC8gcGVyIG5vZGUgbGF0ZXJcbiAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgICAgICBzaGFkb3dDYW0uX25vZGUuc2V0UG9zaXRpb24obGlnaHQuX25vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBzaGFkb3dDYW0uX25vZGUuc2V0Um90YXRpb24obGlnaHQuX25vZGUuZ2V0Um90YXRpb24oKSk7XG4gICAgICAgICAgICBzaGFkb3dDYW0uX25vZGUucm90YXRlTG9jYWwoLTkwLCAwLCAwKTtcblxuICAgICAgICAgICAgc2hhZG93Q2FtLnByb2plY3Rpb24gPSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgICAgICAgICAgc2hhZG93Q2FtLm5lYXJDbGlwID0gbGlnaHQuYXR0ZW51YXRpb25FbmQgLyAxMDAwO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZhckNsaXAgPSBsaWdodC5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5hc3BlY3RSYXRpbyA9IDE7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZm92ID0gbGlnaHQuX291dGVyQ29uZUFuZ2xlICogMjtcblxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci51cGRhdGVDYW1lcmFGcnVzdHVtKHNoYWRvd0NhbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyBjYW1lcmEgLyBmcnVzdHVtIG9mIHRoZSBsaWdodCBmb3IgcmVuZGVyaW5nIHRoZSBiYWtlTm9kZVxuICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBsaWdodCBhZmZlY3RzIHRoZSBiYWtlTm9kZVxuICAgIGxpZ2h0Q2FtZXJhUHJlcGFyZUFuZEN1bGwoYmFrZUxpZ2h0LCBiYWtlTm9kZSwgc2hhZG93Q2FtLCBjYXN0ZXJCb3VuZHMpIHtcblxuICAgICAgICBjb25zdCBsaWdodCA9IGJha2VMaWdodC5saWdodDtcbiAgICAgICAgbGV0IGxpZ2h0QWZmZWN0c05vZGUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcblxuICAgICAgICAgICAgLy8gdHdlYWsgZGlyZWN0aW9uYWwgbGlnaHQgY2FtZXJhIHRvIGZ1bGx5IHNlZSBhbGwgY2FzdGVycyBhbmQgdGhleSBhcmUgZnVsbHkgaW5zaWRlIHRoZSBmcnVzdHVtXG4gICAgICAgICAgICB0ZW1wVmVjLmNvcHkoY2FzdGVyQm91bmRzLmNlbnRlcik7XG4gICAgICAgICAgICB0ZW1wVmVjLnkgKz0gY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLnk7XG5cbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm5vZGUuc2V0UG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5ub2RlLnNldEV1bGVyQW5nbGVzKC05MCwgMCwgMCk7XG5cbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm5lYXJDbGlwID0gMDtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLmZhckNsaXAgPSBjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueSAqIDI7XG5cbiAgICAgICAgICAgIGNvbnN0IGZydXN0dW1TaXplID0gTWF0aC5tYXgoY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLngsIGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy56KTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm9ydGhvSGVpZ2h0ID0gZnJ1c3R1bVNpemU7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gZm9yIG90aGVyIGxpZ2h0IHR5cGVzLCB0ZXN0IGlmIGxpZ2h0IGFmZmVjdHMgdGhlIG5vZGVcbiAgICAgICAgICAgIGlmICghYmFrZUxpZ2h0LmxpZ2h0Qm91bmRzLmludGVyc2VjdHMoYmFrZU5vZGUuYm91bmRzKSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0QWZmZWN0c05vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBlciBtZXNoSW5zdGFuY2UgY3VsbGluZyBmb3Igc3BvdCBsaWdodCBvbmx5XG4gICAgICAgIC8vIChvbW5pIGxpZ2h0cyBjdWxsIHBlciBmYWNlIGxhdGVyLCBkaXJlY3Rpb25hbCBsaWdodHMgZG9uJ3QgY3VsbClcbiAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICBsZXQgbm9kZVZpc2libGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlc1tpXS5faXNWaXNpYmxlKHNoYWRvd0NhbSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW5vZGVWaXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgbGlnaHRBZmZlY3RzTm9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpZ2h0QWZmZWN0c05vZGU7XG4gICAgfVxuXG4gICAgLy8gc2V0IHVwIGxpZ2h0IGFycmF5IGZvciBhIHNpbmdsZSBsaWdodFxuICAgIHNldHVwTGlnaHRBcnJheShsaWdodEFycmF5LCBsaWdodCkge1xuXG4gICAgICAgIGxpZ2h0QXJyYXlbTElHSFRUWVBFX0RJUkVDVElPTkFMXS5sZW5ndGggPSAwO1xuICAgICAgICBsaWdodEFycmF5W0xJR0hUVFlQRV9PTU5JXS5sZW5ndGggPSAwO1xuICAgICAgICBsaWdodEFycmF5W0xJR0hUVFlQRV9TUE9UXS5sZW5ndGggPSAwO1xuXG4gICAgICAgIGxpZ2h0QXJyYXlbbGlnaHQudHlwZV1bMF0gPSBsaWdodDtcbiAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgfVxuXG4gICAgcmVuZGVyU2hhZG93TWFwKHNoYWRvd01hcFJlbmRlcmVkLCBjYXN0ZXJzLCBiYWtlTGlnaHQpIHtcblxuICAgICAgICBjb25zdCBsaWdodCA9IGJha2VMaWdodC5saWdodDtcbiAgICAgICAgY29uc3QgaXNDbHVzdGVyZWQgPSB0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICBpZiAoIXNoYWRvd01hcFJlbmRlcmVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIHNoYWRvdyBtYXAgZnJvbSB0aGUgY2FjaGUgdG8gYXZvaWQgcGVyIGxpZ2h0IGFsbG9jYXRpb25cbiAgICAgICAgICAgIGlmICghbGlnaHQuc2hhZG93TWFwICYmICFpc0NsdXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd01hcCA9IHRoaXMuc2hhZG93TWFwQ2FjaGUuZ2V0KHRoaXMuZGV2aWNlLCBsaWdodCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsLmN1bGwobGlnaHQsIGNhc3RlcnMsIHRoaXMuY2FtZXJhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93UmVuZGVyZXJMb2NhbC5jdWxsKGxpZ2h0LCBjYXN0ZXJzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaW5zaWRlUmVuZGVyUGFzcyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zaGFkb3dSZW5kZXJlci5yZW5kZXIobGlnaHQsIHRoaXMuY2FtZXJhLCBpbnNpZGVSZW5kZXJQYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHBvc3Rwcm9jZXNzVGV4dHVyZXMoZGV2aWNlLCBiYWtlTm9kZXMsIHBhc3NDb3VudCkge1xuXG4gICAgICAgIGNvbnN0IG51bURpbGF0ZXMyeCA9IDE7IC8vIDEgb3IgMiBkaWxhdGVzIChkZXBlbmRpbmcgb24gZmlsdGVyIGJlaW5nIGVuYWJsZWQpXG4gICAgICAgIGNvbnN0IGRpbGF0ZVNoYWRlciA9IHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNoYWRlckRpbGF0ZTtcblxuICAgICAgICAvLyBiaWxhdGVyYWwgZGVub2lzZSBmaWx0ZXIgLSBydW5zIGFzIGEgZmlyc3QgcGFzcywgYmVmb3JlIGRpbGF0ZVxuICAgICAgICBjb25zdCBmaWx0ZXJMaWdodG1hcCA9IHRoaXMuc2NlbmUubGlnaHRtYXBGaWx0ZXJFbmFibGVkO1xuICAgICAgICBpZiAoZmlsdGVyTGlnaHRtYXApIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnByZXBhcmVEZW5vaXNlKHRoaXMuc2NlbmUubGlnaHRtYXBGaWx0ZXJSYW5nZSwgdGhpcy5zY2VuZS5saWdodG1hcEZpbHRlclNtb290aG5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcbiAgICAgICAgZGV2aWNlLnNldERlcHRoU3RhdGUoRGVwdGhTdGF0ZS5OT0RFUFRIKTtcbiAgICAgICAgZGV2aWNlLnNldFN0ZW5jaWxTdGF0ZShudWxsLCBudWxsKTtcblxuICAgICAgICBmb3IgKGxldCBub2RlID0gMDsgbm9kZSA8IGJha2VOb2Rlcy5sZW5ndGg7IG5vZGUrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbbm9kZV07XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgYExNUG9zdDoke25vZGV9YCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXAgPSBub2RlUlQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wUlQgPSB0aGlzLnJlbmRlclRhcmdldHMuZ2V0KGxpZ2h0bWFwLndpZHRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wVGV4ID0gdGVtcFJULmNvbG9yQnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMucHJlcGFyZShsaWdodG1hcC53aWR0aCwgbGlnaHRtYXAuaGVpZ2h0KTtcblxuICAgICAgICAgICAgICAgIC8vIGJvdW5jZSBkaWxhdGUgYmV0d2VlbiB0ZXh0dXJlcywgZXhlY3V0ZSBkZW5vaXNlIG9uIHRoZSBmaXJzdCBwYXNzXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1EaWxhdGVzMng7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNldFNvdXJjZVRleHR1cmUobGlnaHRtYXApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiaWxhdGVyYWxGaWx0ZXJFbmFibGVkID0gZmlsdGVyTGlnaHRtYXAgJiYgcGFzcyA9PT0gMCAmJiBpID09PSAwO1xuICAgICAgICAgICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUlQsIGJpbGF0ZXJhbEZpbHRlckVuYWJsZWQgPyB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zaGFkZXJEZW5vaXNlIDogZGlsYXRlU2hhZGVyKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zZXRTb3VyY2VUZXh0dXJlKHRlbXBUZXgpO1xuICAgICAgICAgICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCBub2RlUlQsIGRpbGF0ZVNoYWRlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBiYWtlSW50ZXJuYWwocGFzc0NvdW50LCBiYWtlTm9kZXMsIGFsbE5vZGVzKSB7XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlTWF0ZXJpYWxzKGRldmljZSwgc2NlbmUsIHBhc3NDb3VudCk7XG4gICAgICAgIHRoaXMuc2V0dXBTY2VuZSgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvblxuICAgICAgICBzY2VuZS5sYXllcnMuX3VwZGF0ZSgpO1xuXG4gICAgICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94ZXMgZm9yIG5vZGVzXG4gICAgICAgIHRoaXMuY29tcHV0ZU5vZGVzQm91bmRzKGJha2VOb2Rlcyk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGxpZ2h0bWFwIHNpemVzIGFuZCBhbGxvY2F0ZSB0ZXh0dXJlc1xuICAgICAgICB0aGlzLmFsbG9jYXRlVGV4dHVyZXMoYmFrZU5vZGVzLCBwYXNzQ291bnQpO1xuXG4gICAgICAgIC8vIENvbGxlY3QgYmFrZWFibGUgbGlnaHRzLCBhbmQgYWxzbyBrZWVwIGFsbExpZ2h0cyBhbG9uZyB3aXRoIHRoZWlyIHByb3BlcnRpZXMgd2UgY2hhbmdlIHRvIHJlc3RvcmUgdGhlbSBsYXRlclxuICAgICAgICBjb25zdCBhbGxMaWdodHMgPSBbXSwgYmFrZUxpZ2h0cyA9IFtdO1xuICAgICAgICB0aGlzLnByZXBhcmVMaWdodHNUb0Jha2Uoc2NlbmUubGF5ZXJzLCBhbGxMaWdodHMsIGJha2VMaWdodHMpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMudXBkYXRlVHJhbnNmb3JtcyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gZ2V0IGFsbCBtZXNoSW5zdGFuY2VzIHRoYXQgY2FzdCBzaGFkb3dzIGludG8gbGlnaHRtYXAgYW5kIHNldCB0aGVtIHVwIGZvciByZWFsdGltZSBzaGFkb3cgY2FzdGluZ1xuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5wcmVwYXJlU2hhZG93Q2FzdGVycyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHNraW5uZWQgYW5kIG1vcnBoZWQgbWVzaGVzXG4gICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKGNhc3RlcnMpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmdwdVVwZGF0ZShjYXN0ZXJzKTtcblxuICAgICAgICAvLyBjb21wb3VuZCBib3VuZGluZyBib3ggZm9yIGFsbCBjYXN0ZXJzLCB1c2VkIHRvIGNvbXB1dGUgc2hhcmVkIGRpcmVjdGlvbmFsIGxpZ2h0IHNoYWRvd1xuICAgICAgICBjb25zdCBjYXN0ZXJCb3VuZHMgPSB0aGlzLmNvbXB1dGVCb3VuZHMoY2FzdGVycyk7XG5cbiAgICAgICAgbGV0IGksIGosIHJjdiwgbTtcblxuICAgICAgICAvLyBQcmVwYXJlIG1vZGVsc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tpXTtcbiAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAvLyBwYXRjaCBtZXNoSW5zdGFuY2VcbiAgICAgICAgICAgICAgICBtID0gcmN2W2pdO1xuXG4gICAgICAgICAgICAgICAgbS5zZXRMaWdodG1hcHBlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgbS5tYXNrID0gTUFTS19CQUtFOyAvLyBvbmx5IGFmZmVjdGVkIGJ5IExNIGxpZ2h0c1xuXG4gICAgICAgICAgICAgICAgLy8gcGF0Y2ggbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbS5tYXRlcmlhbC5saWdodE1hcCA/IG0ubWF0ZXJpYWwubGlnaHRNYXAgOiB0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgdGhpcy5ibGFja1RleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEaXNhYmxlIGFsbCBiYWtlYWJsZSBsaWdodHNcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IGJha2VMaWdodHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGJha2VMaWdodHNbal0ubGlnaHQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGlnaHRBcnJheSA9IFtbXSwgW10sIFtdXTtcbiAgICAgICAgbGV0IHBhc3MsIG5vZGU7XG4gICAgICAgIGxldCBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIEFjY3VtdWxhdGUgbGlnaHRzIGludG8gUkdCTSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZUxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZUxpZ2h0ID0gYmFrZUxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzQW1iaWVudExpZ2h0ID0gYmFrZUxpZ2h0IGluc3RhbmNlb2YgQmFrZUxpZ2h0QW1iaWVudDtcblxuICAgICAgICAgICAgLy8gbGlnaHQgY2FuIGJlIGJha2VkIHVzaW5nIG1hbnkgdmlydHVhbCBsaWdodHMgdG8gY3JlYXRlIHNvZnQgZWZmZWN0XG4gICAgICAgICAgICBsZXQgbnVtVmlydHVhbExpZ2h0cyA9IGJha2VMaWdodC5udW1WaXJ0dWFsTGlnaHRzO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb24gYmFraW5nIGlzIG5vdCBjdXJyZW50bHkgY29tcGF0aWJsZSB3aXRoIHZpcnR1YWwgbGlnaHRzLCBhcyB3ZSBlbmQgdXAgd2l0aCBubyB2YWxpZCBkaXJlY3Rpb24gaW4gbGlnaHRzIHBlbnVtYnJhXG4gICAgICAgICAgICBpZiAocGFzc0NvdW50ID4gMSAmJiBudW1WaXJ0dWFsTGlnaHRzID4gMSAmJiBiYWtlTGlnaHQubGlnaHQuYmFrZURpcikge1xuICAgICAgICAgICAgICAgIG51bVZpcnR1YWxMaWdodHMgPSAxO1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0xpZ2h0bWFwcGVyXFwncyBCQUtFX0NPTE9SRElSIG1vZGUgaXMgbm90IGNvbXBhdGlibGUgd2l0aCBMaWdodFxcJ3MgYmFrZU51bVNhbXBsZXMgbGFyZ2VyIHRoYW4gb25lLiBGb3JjaW5nIGl0IHRvIG9uZS4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgdmlydHVhbExpZ2h0SW5kZXggPSAwOyB2aXJ0dWFsTGlnaHRJbmRleCA8IG51bVZpcnR1YWxMaWdodHM7IHZpcnR1YWxMaWdodEluZGV4KyspIHtcblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBMaWdodDoke2Jha2VMaWdodC5saWdodC5fbm9kZS5uYW1lfToke3ZpcnR1YWxMaWdodEluZGV4fWApO1xuXG4gICAgICAgICAgICAgICAgLy8gcHJlcGFyZSB2aXJ0dWFsIGxpZ2h0XG4gICAgICAgICAgICAgICAgaWYgKG51bVZpcnR1YWxMaWdodHMgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGJha2VMaWdodC5wcmVwYXJlVmlydHVhbExpZ2h0KHZpcnR1YWxMaWdodEluZGV4LCBudW1WaXJ0dWFsTGlnaHRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBiYWtlTGlnaHQuc3RhcnRCYWtlKCk7XG4gICAgICAgICAgICAgICAgbGV0IHNoYWRvd01hcFJlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSB0aGlzLmxpZ2h0Q2FtZXJhUHJlcGFyZShkZXZpY2UsIGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKG5vZGUgPSAwOyBub2RlIDwgYmFrZU5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbbm9kZV07XG4gICAgICAgICAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRBZmZlY3RzTm9kZSA9IHRoaXMubGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbChiYWtlTGlnaHQsIGJha2VOb2RlLCBzaGFkb3dDYW0sIGNhc3RlckJvdW5kcyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRBZmZlY3RzTm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldHVwTGlnaHRBcnJheShsaWdodEFycmF5LCBiYWtlTGlnaHQubGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIubGlnaHRUZXh0dXJlQXRsYXMudXBkYXRlKGxpZ2h0QXJyYXlbTElHSFRUWVBFX1NQT1RdLCBsaWdodEFycmF5W0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgbGlnaHQgc2hhZG93IG1hcCBuZWVkcyB0byBiZSByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICBzaGFkb3dNYXBSZW5kZXJlZCA9IHRoaXMucmVuZGVyU2hhZG93TWFwKHNoYWRvd01hcFJlbmRlcmVkLCBjYXN0ZXJzLCBiYWtlTGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJMaWdodHMgPSBsaWdodEFycmF5W0xJR0hUVFlQRV9TUE9UXS5jb25jYXQobGlnaHRBcnJheVtMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLnVwZGF0ZShjbHVzdGVyTGlnaHRzLCB0aGlzLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSBvcmlnaW5hbCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrdXBNYXRlcmlhbHMocmN2KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSBiYWtlIGZpcnN0IHZpcnR1YWwgbGlnaHQgZm9yIHBhc3MgMSwgYXMgaXQgZG9lcyBub3QgaGFuZGxlIG92ZXJsYXBwaW5nIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPiAwICYmIHZpcnR1YWxMaWdodEluZGV4ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb24ndCBiYWtlIGFtYmllbnQgbGlnaHQgaW4gcGFzcyAxLCBhcyB0aGVyZSdzIG5vIG1haW4gZGlyZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQgJiYgcGFzcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYExNUGFzczoke3Bhc3N9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0bWFwIHNpemVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcFNpemUgPSBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdLmNvbG9yQnVmZmVyLndpZHRoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgbWF0Y2hpbmcgdGVtcCByZW5kZXIgdGFyZ2V0IHRvIHJlbmRlciB0b1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFJUID0gdGhpcy5yZW5kZXJUYXJnZXRzLmdldChsaWdodG1hcFNpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFRleCA9IHRlbXBSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IHNjZW5lLnVwZGF0ZVNoYWRlcnM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNoYWRlcnNVcGRhdGVkT24xc3RQYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwYXNzTWF0ZXJpYWwgPSB0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgbGFzdCB2aXJ0dWFsIGxpZ2h0IG9mIGFtYmllbnQgbGlnaHQsIG11bHRpcGx5IGFjY3VtdWxhdGVkIEFPIGxpZ2h0bWFwIHdpdGggYW1iaWVudCBsaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RWaXJ0dWFsTGlnaHRGb3JQYXNzID0gdmlydHVhbExpZ2h0SW5kZXggKyAxID09PSBudW1WaXJ0dWFsTGlnaHRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyAmJiBwYXNzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhc3NNYXRlcmlhbCA9IHRoaXMuYW1iaWVudEFPTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdXAgbWF0ZXJpYWwgZm9yIGJha2luZyBhIHBhc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByY3Zbal0ubWF0ZXJpYWwgPSBwYXNzTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBzaGFkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlU2hhZGVycyhyY3YpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwaW5nLXBvbmdpbmcgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNldENhbWVyYSh0aGlzLmNhbWVyYSwgdGVtcFJULCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IFBBU1NfRElSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25zdGFudEJha2VEaXIuc2V0VmFsdWUoYmFrZUxpZ2h0LmxpZ2h0LmJha2VEaXIgPyAxIDogMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLmFjdGl2YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWUgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbmRlckZvcndhcmQodGhpcy5jYW1lcmEsIHJjdiwgcmN2Lmxlbmd0aCwgbGlnaHRBcnJheSwgU0hBREVSX0ZPUldBUkRIRFIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2UudXBkYXRlRW5kKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdHMuc2hhZG93TWFwVGltZSArPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0cy5mb3J3YXJkVGltZSArPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdHMucmVuZGVyUGFzc2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVtcCByZW5kZXIgdGFyZ2V0IG5vdyBoYXMgbGlnaHRtYXAsIHN0b3JlIGl0IGZvciB0aGUgbm9kZVxuICAgICAgICAgICAgICAgICAgICAgICAgYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXSA9IHRlbXBSVDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHJlbGVhc2UgcHJldmlvdXMgbGlnaHRtYXAgaW50byB0ZW1wIHJlbmRlciB0YXJnZXQgcG9vbFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLnNldChsaWdodG1hcFNpemUsIG5vZGVSVCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtID0gcmN2W2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0uc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzW3Bhc3NdLCB0ZW1wVGV4KTsgLy8gcGluZy1wb25naW5nIGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5fc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfTE07IC8vIGZvcmNlIHVzaW5nIExNIGV2ZW4gaWYgbWF0ZXJpYWwgZG9lc24ndCBoYXZlIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBSZXZlcnQgdG8gb3JpZ2luYWwgbWF0ZXJpYWxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzdG9yZU1hdGVyaWFscyhyY3YpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJha2VMaWdodC5lbmRCYWtlKHRoaXMuc2hhZG93TWFwQ2FjaGUpO1xuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucG9zdHByb2Nlc3NUZXh0dXJlcyhkZXZpY2UsIGJha2VOb2RlcywgcGFzc0NvdW50KTtcblxuICAgICAgICAvLyByZXN0b3JlIGNoYW5nZXNcbiAgICAgICAgZm9yIChub2RlID0gMDsgbm9kZSA8IGFsbE5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG4gICAgICAgICAgICBhbGxOb2Rlc1tub2RlXS5yZXN0b3JlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlc3RvcmVMaWdodHMoYWxsTGlnaHRzKTtcbiAgICAgICAgdGhpcy5yZXN0b3JlU2NlbmUoKTtcblxuICAgICAgICAvLyBlbXB0eSBjYWNoZSB0byBtaW5pbWl6ZSBwZXJzaXN0ZW50IG1lbW9yeSB1c2UgLi4gaWYgc29tZSBjYWNoZWQgdGV4dHVyZXMgYXJlIG5lZWRlZCxcbiAgICAgICAgLy8gdGhleSB3aWxsIGJlIGFsbG9jYXRlZCBhZ2FpbiBhcyBuZWVkZWRcbiAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRtYXBwZXIgfTtcbiJdLCJuYW1lcyI6WyJNQVhfTElHSFRNQVBfU0laRSIsIlBBU1NfQ09MT1IiLCJQQVNTX0RJUiIsInRlbXBWZWMiLCJWZWMzIiwiTGlnaHRtYXBwZXIiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsInJvb3QiLCJzY2VuZSIsInJlbmRlcmVyIiwiYXNzZXRzIiwic2hhZG93TWFwQ2FjaGUiLCJfdGVtcFNldCIsIlNldCIsIl9pbml0Q2FsbGVkIiwicGFzc01hdGVyaWFscyIsImFtYmllbnRBT01hdGVyaWFsIiwiZm9nIiwiYW1iaWVudExpZ2h0IiwiQ29sb3IiLCJyZW5kZXJUYXJnZXRzIiwiTWFwIiwic3RhdHMiLCJyZW5kZXJQYXNzZXMiLCJsaWdodG1hcENvdW50IiwidG90YWxSZW5kZXJUaW1lIiwiZm9yd2FyZFRpbWUiLCJmYm9UaW1lIiwic2hhZG93TWFwVGltZSIsImNvbXBpbGVUaW1lIiwic2hhZGVyc0xpbmtlZCIsImRlc3Ryb3kiLCJMaWdodG1hcENhY2hlIiwiZGVjUmVmIiwiYmxhY2tUZXgiLCJpbml0QmFrZSIsImxpZ2h0bWFwRmlsdGVycyIsIkxpZ2h0bWFwRmlsdGVycyIsImNvbnN0YW50QmFrZURpciIsInNjb3BlIiwicmVzb2x2ZSIsIm1hdGVyaWFscyIsIlRleHR1cmUiLCJ3aWR0aCIsImhlaWdodCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwidHlwZSIsIlRFWFRVUkVUWVBFX1JHQk0iLCJuYW1lIiwiaW5jUmVmIiwiY2FtZXJhIiwiQ2FtZXJhIiwiY2xlYXJDb2xvciIsInNldCIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwiZnJ1c3R1bUN1bGxpbmciLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJhc3BlY3RSYXRpbyIsIm5vZGUiLCJHcmFwaE5vZGUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJsaWdodGluZ1BhcmFtcyIsIkxpZ2h0aW5nUGFyYW1zIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwibWF4VGV4dHVyZVNpemUiLCJzcmNQYXJhbXMiLCJsaWdodGluZyIsInNoYWRvd3NFbmFibGVkIiwic2hhZG93QXRsYXNSZXNvbHV0aW9uIiwiY29va2llc0VuYWJsZWQiLCJjb29raWVBdGxhc1Jlc29sdXRpb24iLCJhcmVhTGlnaHRzRW5hYmxlZCIsImNlbGxzIiwibWF4TGlnaHRzUGVyQ2VsbCIsIndvcmxkQ2x1c3RlcnMiLCJXb3JsZENsdXN0ZXJzIiwiZmluaXNoQmFrZSIsImJha2VOb2RlcyIsImRlc3Ryb3lSVCIsInJ0IiwiY29sb3JCdWZmZXIiLCJmb3JFYWNoIiwiY2xlYXIiLCJsZW5ndGgiLCJjcmVhdGVNYXRlcmlhbEZvclBhc3MiLCJwYXNzIiwiYWRkQW1iaWVudCIsIm1hdGVyaWFsIiwiU3RhbmRhcmRNYXRlcmlhbCIsImNodW5rcyIsIkFQSVZlcnNpb24iLCJDSFVOS0FQSV8xXzYyIiwidHJhbnNmb3JtVlMiLCJzaGFkZXJDaHVua3MiLCJiYWtlTG1FbmRDaHVuayIsInNoYWRlckNodW5rc0xpZ2h0bWFwcGVyIiwiYmFrZUxtRW5kUFMiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IiwidG9GaXhlZCIsImFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyIsImFtYmllbnQiLCJhbWJpZW50VGludCIsImJhc2VQUyIsImxpZ2h0bWFwUGl4ZWxGb3JtYXQiLCJlbmRQUyIsImxpZ2h0TWFwIiwiYmFrZURpckxtRW5kUFMiLCJvdXRwdXRBbHBoYVBTIiwib3V0cHV0QWxwaGFPcGFxdWVQUyIsIm91dHB1dEFscGhhUHJlbXVsUFMiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsImZvcmNlVXYxIiwidXBkYXRlIiwiY3JlYXRlTWF0ZXJpYWxzIiwicGFzc0NvdW50Iiwib25VcGRhdGVTaGFkZXIiLCJvcHRpb25zIiwibGl0T3B0aW9ucyIsImxpZ2h0TWFwV2l0aG91dEFtYmllbnQiLCJzZXBhcmF0ZUFtYmllbnQiLCJjcmVhdGVUZXh0dXJlIiwic2l6ZSIsInByb2ZpbGVySGludCIsIlRFWEhJTlRfTElHSFRNQVAiLCJtaXBtYXBzIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsImNvbGxlY3RNb2RlbHMiLCJhbGxOb2RlcyIsIl9ub2RlJG1vZGVsIiwiX25vZGUkbW9kZWwyIiwiX25vZGUkcmVuZGVyIiwiZW5hYmxlZCIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbCIsInB1c2giLCJCYWtlTWVzaE5vZGUiLCJsaWdodG1hcHBlZCIsInJlbmRlciIsImhhc1V2MSIsImkiLCJtZXNoIiwidmVydGV4QnVmZmVyIiwiRGVidWciLCJsb2ciLCJub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzIiwiaGFzIiwiYWRkIiwiX2NoaWxkcmVuIiwicHJlcGFyZVNoYWRvd0Nhc3RlcnMiLCJub2RlcyIsImNhc3RlcnMiLCJuIiwiY29tcG9uZW50IiwiY2FzdFNoYWRvd3MiLCJjYXN0U2hhZG93c0xpZ2h0bWFwIiwibWVzaGVzIiwidmlzaWJsZVRoaXNGcmFtZSIsInVwZGF0ZVRyYW5zZm9ybXMiLCJqIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjYWxjdWxhdGVMaWdodG1hcFNpemUiLCJkYXRhIiwic2l6ZU11bHQiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwic2NhbGUiLCJzcmNBcmVhIiwiYXNzZXQiLCJnZXQiLCJhcmVhIiwiX2FyZWEiLCJ4IiwieSIsInoiLCJ1diIsImFyZWFNdWx0IiwiYm91bmRzIiwiY29tcHV0ZU5vZGVCb3VuZHMiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJ0b3RhbEFyZWEiLCJNYXRoIiwic3FydCIsImxpZ2h0bWFwU2l6ZSIsIm1pbiIsIm1hdGgiLCJuZXh0UG93ZXJPZlR3byIsImxpZ2h0bWFwTWF4UmVzb2x1dGlvbiIsInNldExpZ2h0bWFwcGluZyIsInZhbHVlIiwic2hhZGVyRGVmcyIsIm1lc2hJbnN0YW5jZSIsInNldExpZ2h0bWFwcGVkIiwiX3NoYWRlckRlZnMiLCJtYXNrIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJ0ZXgiLCJGSUxURVJfTElORUFSIiwic2V0UmVhbHRpbWVMaWdodG1hcCIsIk1lc2hJbnN0YW5jZSIsImxpZ2h0bWFwUGFyYW1OYW1lcyIsImJha2UiLCJtb2RlIiwiQkFLRV9DT0xPUkRJUiIsImlzV2ViR1BVIiwid2Fybk9uY2UiLCJzdGFydFRpbWUiLCJub3ciLCJfdXBkYXRlU2t5IiwiZmlyZSIsInRpbWVzdGFtcCIsInRhcmdldCIsInN0YXJ0U2hhZGVycyIsIl9zaGFkZXJTdGF0cyIsImxpbmtlZCIsInN0YXJ0RmJvVGltZSIsIl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUiLCJzdGFydENvbXBpbGVUaW1lIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzaGFkb3dSZW5kZXJlciIsImZyYW1lVXBkYXRlIiwiYmFrZUludGVybmFsIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiYW1iaWVudEJha2UiLCJTSEFERVJERUZfTE1BTUJJRU5UIiwicG9wR3B1TWFya2VyIiwibm93VGltZSIsImFsbG9jYXRlVGV4dHVyZXMiLCJiYWtlTm9kZSIsIlJlbmRlclRhcmdldCIsImRlcHRoIiwicHJlcGFyZUxpZ2h0c1RvQmFrZSIsImxheWVyQ29tcG9zaXRpb24iLCJhbGxMaWdodHMiLCJiYWtlTGlnaHRzIiwiQmFrZUxpZ2h0QW1iaWVudCIsInNjZW5lTGlnaHRzIiwiX2xpZ2h0cyIsImxpZ2h0IiwiYmFrZUxpZ2h0IiwiQmFrZUxpZ2h0U2ltcGxlIiwiTUFTS19CQUtFIiwiaXNTdGF0aWMiLCJzaGFkb3dVcGRhdGVNb2RlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsInNvcnQiLCJyZXN0b3JlTGlnaHRzIiwicmVzdG9yZSIsInNldHVwU2NlbmUiLCJyZXZlcnRTdGF0aWMiLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiRk9HX05PTkUiLCJzZXRTY2VuZUNvbnN0YW50cyIsInJlc3RvcmVTY2VuZSIsIkJvdW5kaW5nQm94IiwiYWFiYiIsIm0iLCJjb21wdXRlTm9kZXNCb3VuZHMiLCJjb21wdXRlQm91bmRzIiwiYmFja3VwTWF0ZXJpYWxzIiwicmVzdG9yZU1hdGVyaWFscyIsImxpZ2h0Q2FtZXJhUHJlcGFyZSIsInNoYWRvd0NhbSIsIkxJR0hUVFlQRV9TUE9UIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNoYWRvd0NhbWVyYSIsIl9ub2RlIiwic2V0UG9zaXRpb24iLCJnZXRQb3NpdGlvbiIsInNldFJvdGF0aW9uIiwiZ2V0Um90YXRpb24iLCJyb3RhdGVMb2NhbCIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJuZWFyQ2xpcCIsImF0dGVudWF0aW9uRW5kIiwiZmFyQ2xpcCIsImZvdiIsIl9vdXRlckNvbmVBbmdsZSIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJsaWdodENhbWVyYVByZXBhcmVBbmRDdWxsIiwiY2FzdGVyQm91bmRzIiwibGlnaHRBZmZlY3RzTm9kZSIsImNlbnRlciIsInNldEV1bGVyQW5nbGVzIiwiZnJ1c3R1bVNpemUiLCJtYXgiLCJvcnRob0hlaWdodCIsImxpZ2h0Qm91bmRzIiwiaW50ZXJzZWN0cyIsIm5vZGVWaXNpYmxlIiwiX2lzVmlzaWJsZSIsInNldHVwTGlnaHRBcnJheSIsImxpZ2h0QXJyYXkiLCJMSUdIVFRZUEVfT01OSSIsInJlbmRlclNoYWRvd01hcCIsInNoYWRvd01hcFJlbmRlcmVkIiwiaXNDbHVzdGVyZWQiLCJzaGFkb3dNYXAiLCJfc2hhZG93UmVuZGVyZXJEaXJlY3Rpb25hbCIsIl9zaGFkb3dSZW5kZXJlckxvY2FsIiwiaW5zaWRlUmVuZGVyUGFzcyIsInBvc3Rwcm9jZXNzVGV4dHVyZXMiLCJudW1EaWxhdGVzMngiLCJkaWxhdGVTaGFkZXIiLCJzaGFkZXJEaWxhdGUiLCJmaWx0ZXJMaWdodG1hcCIsImxpZ2h0bWFwRmlsdGVyRW5hYmxlZCIsInByZXBhcmVEZW5vaXNlIiwibGlnaHRtYXBGaWx0ZXJSYW5nZSIsImxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyIsInNldEJsZW5kU3RhdGUiLCJCbGVuZFN0YXRlIiwiTk9CTEVORCIsInNldERlcHRoU3RhdGUiLCJEZXB0aFN0YXRlIiwiTk9ERVBUSCIsInNldFN0ZW5jaWxTdGF0ZSIsIm5vZGVSVCIsImxpZ2h0bWFwIiwidGVtcFJUIiwidGVtcFRleCIsInByZXBhcmUiLCJzZXRTb3VyY2VUZXh0dXJlIiwiYmlsYXRlcmFsRmlsdGVyRW5hYmxlZCIsImRyYXdRdWFkV2l0aFNoYWRlciIsInNoYWRlckRlbm9pc2UiLCJsYXllcnMiLCJfdXBkYXRlIiwidXBkYXRlQ3B1U2tpbk1hdHJpY2VzIiwiZ3B1VXBkYXRlIiwicmN2Iiwic2hhZGVyc1VwZGF0ZWRPbjFzdFBhc3MiLCJpc0FtYmllbnRMaWdodCIsIm51bVZpcnR1YWxMaWdodHMiLCJiYWtlRGlyIiwid2FybiIsInZpcnR1YWxMaWdodEluZGV4IiwicHJlcGFyZVZpcnR1YWxMaWdodCIsInN0YXJ0QmFrZSIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiY2x1c3RlckxpZ2h0cyIsImNvbmNhdCIsImdhbW1hQ29ycmVjdGlvbiIsInVwZGF0ZVNoYWRlcnMiLCJwYXNzTWF0ZXJpYWwiLCJsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyIsInNldENhbWVyYSIsInNldFZhbHVlIiwiYWN0aXZhdGUiLCJfZm9yd2FyZFRpbWUiLCJfc2hhZG93TWFwVGltZSIsInJlbmRlckZvcndhcmQiLCJTSEFERVJfRk9SV0FSREhEUiIsInVwZGF0ZUVuZCIsImVuZEJha2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpREEsTUFBTUEsaUJBQWlCLEdBQUcsSUFBSSxDQUFBO0FBRTlCLE1BQU1DLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDcEIsTUFBTUMsUUFBUSxHQUFHLENBQUMsQ0FBQTtBQUVsQixNQUFNQyxPQUFPLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFdBQVcsQ0FBQztBQUNkO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxLQUFLLEVBQUVDLFFBQVEsRUFBRUMsTUFBTSxFQUFFO0lBQy9DLElBQUksQ0FBQ0osTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxJQUFJLEdBQUdBLElBQUksQ0FBQTtJQUNoQixJQUFJLENBQUNDLEtBQUssR0FBR0EsS0FBSyxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsUUFBUSxHQUFHQSxRQUFRLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtBQUNwQixJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHRixRQUFRLENBQUNFLGNBQWMsQ0FBQTtBQUU3QyxJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0lBQ3pCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEtBQUssQ0FBQTs7QUFFeEI7SUFDQSxJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQyxpQkFBaUIsR0FBRyxJQUFJLENBQUE7SUFFN0IsSUFBSSxDQUFDQyxHQUFHLEdBQUcsRUFBRSxDQUFBO0FBQ2IsSUFBQSxJQUFJLENBQUNDLFlBQVksR0FBRyxJQUFJQyxLQUFLLEVBQUUsQ0FBQTs7QUFFL0I7QUFDQSxJQUFBLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0lBRTlCLElBQUksQ0FBQ0MsS0FBSyxHQUFHO0FBQ1RDLE1BQUFBLFlBQVksRUFBRSxDQUFDO0FBQ2ZDLE1BQUFBLGFBQWEsRUFBRSxDQUFDO0FBQ2hCQyxNQUFBQSxlQUFlLEVBQUUsQ0FBQztBQUNsQkMsTUFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZEMsTUFBQUEsT0FBTyxFQUFFLENBQUM7QUFDVkMsTUFBQUEsYUFBYSxFQUFFLENBQUM7QUFDaEJDLE1BQUFBLFdBQVcsRUFBRSxDQUFDO0FBQ2RDLE1BQUFBLGFBQWEsRUFBRSxDQUFBO0tBQ2xCLENBQUE7QUFDTCxHQUFBO0FBRUFDLEVBQUFBLE9BQU9BLEdBQUc7QUFFTjtBQUNBQyxJQUFBQSxhQUFhLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUNDLFFBQVEsQ0FBQyxDQUFBO0lBQ25DLElBQUksQ0FBQ0EsUUFBUSxHQUFHLElBQUksQ0FBQTs7QUFFcEI7SUFDQUYsYUFBYSxDQUFDRCxPQUFPLEVBQUUsQ0FBQTtJQUV2QixJQUFJLENBQUN6QixNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsSUFBSSxHQUFHLElBQUksQ0FBQTtJQUNoQixJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJLENBQUE7SUFDakIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUN0QixHQUFBO0VBRUF5QixRQUFRQSxDQUFDN0IsTUFBTSxFQUFFO0FBRWI7QUFDQSxJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNRLFdBQVcsRUFBRTtNQUNuQixJQUFJLENBQUNBLFdBQVcsR0FBRyxJQUFJLENBQUE7O0FBRXZCO0FBQ0EsTUFBQSxJQUFJLENBQUNzQixlQUFlLEdBQUcsSUFBSUMsZUFBZSxDQUFDL0IsTUFBTSxDQUFDLENBQUE7O0FBRWxEO01BQ0EsSUFBSSxDQUFDZ0MsZUFBZSxHQUFHaEMsTUFBTSxDQUFDaUMsS0FBSyxDQUFDQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUE7TUFDdEQsSUFBSSxDQUFDQyxTQUFTLEdBQUcsRUFBRSxDQUFBOztBQUVuQjtNQUNBLElBQUksQ0FBQ1AsUUFBUSxHQUFHLElBQUlRLE9BQU8sQ0FBQyxJQUFJLENBQUNwQyxNQUFNLEVBQUU7QUFDckNxQyxRQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSQyxRQUFBQSxNQUFNLEVBQUUsQ0FBQztBQUNUQyxRQUFBQSxNQUFNLEVBQUVDLGlCQUFpQjtBQUN6QkMsUUFBQUEsSUFBSSxFQUFFQyxnQkFBZ0I7QUFDdEJDLFFBQUFBLElBQUksRUFBRSxlQUFBO0FBQ1YsT0FBQyxDQUFDLENBQUE7O0FBRUY7QUFDQWpCLE1BQUFBLGFBQWEsQ0FBQ2tCLE1BQU0sQ0FBQyxJQUFJLENBQUNoQixRQUFRLENBQUMsQ0FBQTs7QUFFbkM7QUFDQSxNQUFBLE1BQU1pQixNQUFNLEdBQUcsSUFBSUMsTUFBTSxFQUFFLENBQUE7QUFDM0JELE1BQUFBLE1BQU0sQ0FBQ0UsVUFBVSxDQUFDQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFDakNILE1BQU0sQ0FBQ0ksZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO01BQzlCSixNQUFNLENBQUNLLGdCQUFnQixHQUFHLEtBQUssQ0FBQTtNQUMvQkwsTUFBTSxDQUFDTSxrQkFBa0IsR0FBRyxLQUFLLENBQUE7TUFDakNOLE1BQU0sQ0FBQ08sY0FBYyxHQUFHLEtBQUssQ0FBQTtNQUM3QlAsTUFBTSxDQUFDUSxVQUFVLEdBQUdDLHVCQUF1QixDQUFBO01BQzNDVCxNQUFNLENBQUNVLFdBQVcsR0FBRyxDQUFDLENBQUE7QUFDdEJWLE1BQUFBLE1BQU0sQ0FBQ1csSUFBSSxHQUFHLElBQUlDLFNBQVMsRUFBRSxDQUFBO01BQzdCLElBQUksQ0FBQ1osTUFBTSxHQUFHQSxNQUFNLENBQUE7QUFDeEIsS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxJQUFJLENBQUMzQyxLQUFLLENBQUN3RCx3QkFBd0IsRUFBRTtBQUVyQztBQUNBLE1BQUEsTUFBTUMsY0FBYyxHQUFHLElBQUlDLGNBQWMsQ0FBQzVELE1BQU0sQ0FBQzZELGtCQUFrQixFQUFFN0QsTUFBTSxDQUFDOEQsY0FBYyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUE7TUFDckcsSUFBSSxDQUFDSCxjQUFjLEdBQUdBLGNBQWMsQ0FBQTtBQUVwQyxNQUFBLE1BQU1JLFNBQVMsR0FBRyxJQUFJLENBQUM3RCxLQUFLLENBQUM4RCxRQUFRLENBQUE7QUFDckNMLE1BQUFBLGNBQWMsQ0FBQ00sY0FBYyxHQUFHRixTQUFTLENBQUNFLGNBQWMsQ0FBQTtBQUN4RE4sTUFBQUEsY0FBYyxDQUFDTyxxQkFBcUIsR0FBR0gsU0FBUyxDQUFDRyxxQkFBcUIsQ0FBQTtBQUV0RVAsTUFBQUEsY0FBYyxDQUFDUSxjQUFjLEdBQUdKLFNBQVMsQ0FBQ0ksY0FBYyxDQUFBO0FBQ3hEUixNQUFBQSxjQUFjLENBQUNTLHFCQUFxQixHQUFHTCxTQUFTLENBQUNLLHFCQUFxQixDQUFBO0FBRXRFVCxNQUFBQSxjQUFjLENBQUNVLGlCQUFpQixHQUFHTixTQUFTLENBQUNNLGlCQUFpQixDQUFBOztBQUU5RDtNQUNBVixjQUFjLENBQUNXLEtBQUssR0FBRyxJQUFJekUsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFDeEM4RCxjQUFjLENBQUNZLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtBQUVuQyxNQUFBLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUlDLGFBQWEsQ0FBQ3pFLE1BQU0sQ0FBQyxDQUFBO0FBQzlDLE1BQUEsSUFBSSxDQUFDd0UsYUFBYSxDQUFDN0IsSUFBSSxHQUFHLG9CQUFvQixDQUFBO0FBQ2xELEtBQUE7QUFDSixHQUFBO0VBRUErQixVQUFVQSxDQUFDQyxTQUFTLEVBQUU7SUFFbEIsSUFBSSxDQUFDeEMsU0FBUyxHQUFHLEVBQUUsQ0FBQTtJQUVuQixTQUFTeUMsU0FBU0EsQ0FBQ0MsRUFBRSxFQUFFO0FBQ25CO0FBQ0FuRCxNQUFBQSxhQUFhLENBQUNDLE1BQU0sQ0FBQ2tELEVBQUUsQ0FBQ0MsV0FBVyxDQUFDLENBQUE7O0FBRXBDO01BQ0FELEVBQUUsQ0FBQ3BELE9BQU8sRUFBRSxDQUFBO0FBQ2hCLEtBQUE7O0FBRUE7QUFDQSxJQUFBLElBQUksQ0FBQ1gsYUFBYSxDQUFDaUUsT0FBTyxDQUFFRixFQUFFLElBQUs7TUFDL0JELFNBQVMsQ0FBQ0MsRUFBRSxDQUFDLENBQUE7QUFDakIsS0FBQyxDQUFDLENBQUE7QUFDRixJQUFBLElBQUksQ0FBQy9ELGFBQWEsQ0FBQ2tFLEtBQUssRUFBRSxDQUFBOztBQUUxQjtBQUNBTCxJQUFBQSxTQUFTLENBQUNJLE9BQU8sQ0FBRXZCLElBQUksSUFBSztBQUN4QkEsTUFBQUEsSUFBSSxDQUFDMUMsYUFBYSxDQUFDaUUsT0FBTyxDQUFFRixFQUFFLElBQUs7UUFDL0JELFNBQVMsQ0FBQ0MsRUFBRSxDQUFDLENBQUE7QUFDakIsT0FBQyxDQUFDLENBQUE7QUFDRnJCLE1BQUFBLElBQUksQ0FBQzFDLGFBQWEsQ0FBQ21FLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDakMsS0FBQyxDQUFDLENBQUE7O0FBRUY7SUFDQSxJQUFJLENBQUN2RSxpQkFBaUIsR0FBRyxJQUFJLENBQUE7O0FBRTdCO0lBQ0EsSUFBSSxJQUFJLENBQUM4RCxhQUFhLEVBQUU7QUFDcEIsTUFBQSxJQUFJLENBQUNBLGFBQWEsQ0FBQy9DLE9BQU8sRUFBRSxDQUFBO01BQzVCLElBQUksQ0FBQytDLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDN0IsS0FBQTtBQUNKLEdBQUE7RUFFQVUscUJBQXFCQSxDQUFDbEYsTUFBTSxFQUFFRSxLQUFLLEVBQUVpRixJQUFJLEVBQUVDLFVBQVUsRUFBRTtBQUNuRCxJQUFBLE1BQU1DLFFBQVEsR0FBRyxJQUFJQyxnQkFBZ0IsRUFBRSxDQUFBO0FBQ3ZDRCxJQUFBQSxRQUFRLENBQUMxQyxJQUFJLEdBQUksbUJBQWtCd0MsSUFBSyxDQUFBLFNBQUEsRUFBV0MsVUFBVyxDQUFDLENBQUEsQ0FBQTtBQUMvREMsSUFBQUEsUUFBUSxDQUFDRSxNQUFNLENBQUNDLFVBQVUsR0FBR0MsYUFBYSxDQUFBO0lBQzFDSixRQUFRLENBQUNFLE1BQU0sQ0FBQ0csV0FBVyxHQUFHLHFCQUFxQixHQUFHQyxZQUFZLENBQUNELFdBQVcsQ0FBQzs7SUFFL0UsSUFBSVAsSUFBSSxLQUFLekYsVUFBVSxFQUFFO0FBQ3JCLE1BQUEsSUFBSWtHLGNBQWMsR0FBR0MsdUJBQXVCLENBQUNDLFdBQVcsQ0FBQztBQUN6RCxNQUFBLElBQUlWLFVBQVUsRUFBRTtBQUNaO0FBQ0E7QUFDQVEsUUFBQUEsY0FBYyxHQUFJLENBQUE7QUFDbEMsaUVBQUEsRUFBbUUxRixLQUFLLENBQUM2Riw0QkFBNEIsQ0FBQ0MsT0FBTyxDQUFDLENBQUMsQ0FBRSxDQUFBO0FBQ2pILDBDQUFBLEVBQTRDOUYsS0FBSyxDQUFDK0YsOEJBQThCLENBQUNELE9BQU8sQ0FBQyxDQUFDLENBQUUsQ0FBQTtBQUM1RjtBQUNBO0FBQ0EsZ0JBQUEsQ0FBaUIsR0FBR0osY0FBYyxDQUFBO0FBQ3RCLE9BQUMsTUFBTTtBQUNIUCxRQUFBQSxRQUFRLENBQUNhLE9BQU8sR0FBRyxJQUFJckYsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEN3RSxRQUFRLENBQUNjLFdBQVcsR0FBRyxJQUFJLENBQUE7QUFDL0IsT0FBQTtBQUNBZCxNQUFBQSxRQUFRLENBQUNFLE1BQU0sQ0FBQ2EsTUFBTSxHQUFHVCxZQUFZLENBQUNTLE1BQU0sSUFBSWxHLEtBQUssQ0FBQ21HLG1CQUFtQixLQUFLN0QsaUJBQWlCLEdBQUcsMkJBQTJCLEdBQUcsRUFBRSxDQUFDLENBQUE7QUFDbkk2QyxNQUFBQSxRQUFRLENBQUNFLE1BQU0sQ0FBQ2UsS0FBSyxHQUFHVixjQUFjLENBQUE7QUFDdENQLE1BQUFBLFFBQVEsQ0FBQ2tCLFFBQVEsR0FBRyxJQUFJLENBQUMzRSxRQUFRLENBQUE7QUFDckMsS0FBQyxNQUFNO01BQ0h5RCxRQUFRLENBQUNFLE1BQU0sQ0FBQ2EsTUFBTSxHQUFHVCxZQUFZLENBQUNTLE1BQU0sR0FBRyxvRUFBb0UsQ0FBQTtBQUNuSGYsTUFBQUEsUUFBUSxDQUFDRSxNQUFNLENBQUNlLEtBQUssR0FBR1QsdUJBQXVCLENBQUNXLGNBQWMsQ0FBQTtBQUNsRSxLQUFBOztBQUVBO0FBQ0FuQixJQUFBQSxRQUFRLENBQUNFLE1BQU0sQ0FBQ2tCLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDcENwQixJQUFBQSxRQUFRLENBQUNFLE1BQU0sQ0FBQ21CLG1CQUFtQixHQUFHLElBQUksQ0FBQTtBQUMxQ3JCLElBQUFBLFFBQVEsQ0FBQ0UsTUFBTSxDQUFDb0IsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQzFDdEIsUUFBUSxDQUFDdUIsSUFBSSxHQUFHQyxhQUFhLENBQUE7QUFDN0J4QixJQUFBQSxRQUFRLENBQUN5QixRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3pCekIsUUFBUSxDQUFDMEIsTUFBTSxFQUFFLENBQUE7QUFFakIsSUFBQSxPQUFPMUIsUUFBUSxDQUFBO0FBQ25CLEdBQUE7QUFFQTJCLEVBQUFBLGVBQWVBLENBQUNoSCxNQUFNLEVBQUVFLEtBQUssRUFBRStHLFNBQVMsRUFBRTtJQUN0QyxLQUFLLElBQUk5QixJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLEdBQUc4QixTQUFTLEVBQUU5QixJQUFJLEVBQUUsRUFBRTtBQUN6QyxNQUFBLElBQUksQ0FBQyxJQUFJLENBQUMxRSxhQUFhLENBQUMwRSxJQUFJLENBQUMsRUFBRTtBQUMzQixRQUFBLElBQUksQ0FBQzFFLGFBQWEsQ0FBQzBFLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQ0QscUJBQXFCLENBQUNsRixNQUFNLEVBQUVFLEtBQUssRUFBRWlGLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUNyRixPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3pFLGlCQUFpQixFQUFFO0FBQ3pCLE1BQUEsSUFBSSxDQUFDQSxpQkFBaUIsR0FBRyxJQUFJLENBQUN3RSxxQkFBcUIsQ0FBQ2xGLE1BQU0sRUFBRUUsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMzRSxNQUFBLElBQUksQ0FBQ1EsaUJBQWlCLENBQUN3RyxjQUFjLEdBQUcsVUFBVUMsT0FBTyxFQUFFO0FBQ3ZEO0FBQ0FBLFFBQUFBLE9BQU8sQ0FBQ0MsVUFBVSxDQUFDQyxzQkFBc0IsR0FBRyxJQUFJLENBQUE7QUFDaEQ7QUFDQUYsUUFBQUEsT0FBTyxDQUFDQyxVQUFVLENBQUNFLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFDekMsUUFBQSxPQUFPSCxPQUFPLENBQUE7T0FDakIsQ0FBQTtBQUNMLEtBQUE7QUFDSixHQUFBO0FBRUFJLEVBQUFBLGFBQWFBLENBQUNDLElBQUksRUFBRTdFLElBQUksRUFBRTtBQUN0QixJQUFBLE9BQU8sSUFBSVAsT0FBTyxDQUFDLElBQUksQ0FBQ3BDLE1BQU0sRUFBRTtBQUU1QnlILE1BQUFBLFlBQVksRUFBRUMsZ0JBQWdCO0FBRTlCckYsTUFBQUEsS0FBSyxFQUFFbUYsSUFBSTtBQUNYbEYsTUFBQUEsTUFBTSxFQUFFa0YsSUFBSTtBQUNaakYsTUFBQUEsTUFBTSxFQUFFLElBQUksQ0FBQ3JDLEtBQUssQ0FBQ21HLG1CQUFtQjtBQUN0Q3NCLE1BQUFBLE9BQU8sRUFBRSxLQUFLO01BQ2RsRixJQUFJLEVBQUUsSUFBSSxDQUFDdkMsS0FBSyxDQUFDbUcsbUJBQW1CLEtBQUs3RCxpQkFBaUIsR0FBR0UsZ0JBQWdCLEdBQUdrRixtQkFBbUI7QUFDbkdDLE1BQUFBLFNBQVMsRUFBRUMsY0FBYztBQUN6QkMsTUFBQUEsU0FBUyxFQUFFRCxjQUFjO0FBQ3pCRSxNQUFBQSxRQUFRLEVBQUVDLHFCQUFxQjtBQUMvQkMsTUFBQUEsUUFBUSxFQUFFRCxxQkFBcUI7QUFDL0J0RixNQUFBQSxJQUFJLEVBQUVBLElBQUFBO0FBQ1YsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBd0YsRUFBQUEsYUFBYUEsQ0FBQzNFLElBQUksRUFBRW1CLFNBQVMsRUFBRXlELFFBQVEsRUFBRTtBQUFBLElBQUEsSUFBQUMsV0FBQSxFQUFBQyxZQUFBLEVBQUFDLFlBQUEsQ0FBQTtBQUNyQyxJQUFBLElBQUksQ0FBQy9FLElBQUksQ0FBQ2dGLE9BQU8sRUFBRSxPQUFBOztBQUVuQjtBQUNBLElBQUEsSUFBSUMsYUFBYSxDQUFBO0lBQ2pCLElBQUksQ0FBQUosV0FBQSxHQUFBN0UsSUFBSSxDQUFDa0YsS0FBSyxLQUFBLElBQUEsSUFBVkwsV0FBQSxDQUFZSyxLQUFLLEtBQUFKLFlBQUEsR0FBSTlFLElBQUksQ0FBQ2tGLEtBQUssYUFBVkosWUFBQSxDQUFZRSxPQUFPLEVBQUU7TUFDMUMsSUFBSUosUUFBUSxFQUFFQSxRQUFRLENBQUNPLElBQUksQ0FBQyxJQUFJQyxZQUFZLENBQUNwRixJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ25ELE1BQUEsSUFBSUEsSUFBSSxDQUFDa0YsS0FBSyxDQUFDRyxXQUFXLEVBQUU7QUFDeEIsUUFBQSxJQUFJbEUsU0FBUyxFQUFFO0FBQ1g4RCxVQUFBQSxhQUFhLEdBQUdqRixJQUFJLENBQUNrRixLQUFLLENBQUNBLEtBQUssQ0FBQ0QsYUFBYSxDQUFBO0FBQ2xELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7QUFFQTtJQUNBLElBQUFGLENBQUFBLFlBQUEsR0FBSS9FLElBQUksQ0FBQ3NGLE1BQU0sS0FBWFAsSUFBQUEsSUFBQUEsWUFBQSxDQUFhQyxPQUFPLEVBQUU7TUFDdEIsSUFBSUosUUFBUSxFQUFFQSxRQUFRLENBQUNPLElBQUksQ0FBQyxJQUFJQyxZQUFZLENBQUNwRixJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ25ELE1BQUEsSUFBSUEsSUFBSSxDQUFDc0YsTUFBTSxDQUFDRCxXQUFXLEVBQUU7QUFDekIsUUFBQSxJQUFJbEUsU0FBUyxFQUFFO0FBQ1g4RCxVQUFBQSxhQUFhLEdBQUdqRixJQUFJLENBQUNzRixNQUFNLENBQUNMLGFBQWEsQ0FBQTtBQUM3QyxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLElBQUlBLGFBQWEsRUFBRTtNQUNmLElBQUlNLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFFakIsTUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1AsYUFBYSxDQUFDeEQsTUFBTSxFQUFFK0QsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsUUFBQSxJQUFJLENBQUNQLGFBQWEsQ0FBQ08sQ0FBQyxDQUFDLENBQUNDLElBQUksQ0FBQ0MsWUFBWSxDQUFDM0csTUFBTSxDQUFDd0csTUFBTSxFQUFFO1VBQ25ESSxLQUFLLENBQUNDLEdBQUcsQ0FBRSxDQUFBLG9CQUFBLEVBQXNCNUYsSUFBSSxDQUFDYixJQUFLLG1FQUFrRSxDQUFDLENBQUE7QUFDOUdvRyxVQUFBQSxNQUFNLEdBQUcsS0FBSyxDQUFBO0FBQ2QsVUFBQSxNQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFFQSxNQUFBLElBQUlBLE1BQU0sRUFBRTtRQUNSLE1BQU1NLHlCQUF5QixHQUFHLEVBQUUsQ0FBQTtBQUNwQyxRQUFBLEtBQUssSUFBSUwsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHUCxhQUFhLENBQUN4RCxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtBQUMzQyxVQUFBLE1BQU1DLElBQUksR0FBR1IsYUFBYSxDQUFDTyxDQUFDLENBQUMsQ0FBQ0MsSUFBSSxDQUFBOztBQUVsQztVQUNBLElBQUksSUFBSSxDQUFDM0ksUUFBUSxDQUFDZ0osR0FBRyxDQUFDTCxJQUFJLENBQUMsRUFBRTtBQUN6QjtBQUNBdEUsWUFBQUEsU0FBUyxDQUFDZ0UsSUFBSSxDQUFDLElBQUlDLFlBQVksQ0FBQ3BGLElBQUksRUFBRSxDQUFDaUYsYUFBYSxDQUFDTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5RCxXQUFDLE1BQU07QUFDSEssWUFBQUEseUJBQXlCLENBQUNWLElBQUksQ0FBQ0YsYUFBYSxDQUFDTyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3BELFdBQUE7QUFDQSxVQUFBLElBQUksQ0FBQzFJLFFBQVEsQ0FBQ2lKLEdBQUcsQ0FBQ04sSUFBSSxDQUFDLENBQUE7QUFDM0IsU0FBQTtBQUVBLFFBQUEsSUFBSSxDQUFDM0ksUUFBUSxDQUFDMEUsS0FBSyxFQUFFLENBQUE7O0FBRXJCO0FBQ0EsUUFBQSxJQUFJcUUseUJBQXlCLENBQUNwRSxNQUFNLEdBQUcsQ0FBQyxFQUFFO1VBQ3RDTixTQUFTLENBQUNnRSxJQUFJLENBQUMsSUFBSUMsWUFBWSxDQUFDcEYsSUFBSSxFQUFFNkYseUJBQXlCLENBQUMsQ0FBQyxDQUFBO0FBQ3JFLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsS0FBSyxJQUFJTCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd4RixJQUFJLENBQUNnRyxTQUFTLENBQUN2RSxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtBQUM1QyxNQUFBLElBQUksQ0FBQ2IsYUFBYSxDQUFDM0UsSUFBSSxDQUFDZ0csU0FBUyxDQUFDUixDQUFDLENBQUMsRUFBRXJFLFNBQVMsRUFBRXlELFFBQVEsQ0FBQyxDQUFBO0FBQzlELEtBQUE7QUFDSixHQUFBOztBQUVBO0VBQ0FxQixvQkFBb0JBLENBQUNDLEtBQUssRUFBRTtJQUV4QixNQUFNQyxPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ2xCLElBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdGLEtBQUssQ0FBQ3pFLE1BQU0sRUFBRTJFLENBQUMsRUFBRSxFQUFFO0FBQ25DLE1BQUEsTUFBTUMsU0FBUyxHQUFHSCxLQUFLLENBQUNFLENBQUMsQ0FBQyxDQUFDQyxTQUFTLENBQUE7QUFFcENBLE1BQUFBLFNBQVMsQ0FBQ0MsV0FBVyxHQUFHRCxTQUFTLENBQUNFLG1CQUFtQixDQUFBO01BQ3JELElBQUlGLFNBQVMsQ0FBQ0UsbUJBQW1CLEVBQUU7QUFFL0IsUUFBQSxNQUFNQyxNQUFNLEdBQUdOLEtBQUssQ0FBQ0UsQ0FBQyxDQUFDLENBQUNuQixhQUFhLENBQUE7QUFDckMsUUFBQSxLQUFLLElBQUlPLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2dCLE1BQU0sQ0FBQy9FLE1BQU0sRUFBRStELENBQUMsRUFBRSxFQUFFO0FBQ3BDZ0IsVUFBQUEsTUFBTSxDQUFDaEIsQ0FBQyxDQUFDLENBQUNpQixnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDakNOLFVBQUFBLE9BQU8sQ0FBQ2hCLElBQUksQ0FBQ3FCLE1BQU0sQ0FBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDM0IsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPVyxPQUFPLENBQUE7QUFDbEIsR0FBQTs7QUFFQTtFQUNBTyxnQkFBZ0JBLENBQUNSLEtBQUssRUFBRTtBQUVwQixJQUFBLEtBQUssSUFBSVYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHVSxLQUFLLENBQUN6RSxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtBQUNuQyxNQUFBLE1BQU1QLGFBQWEsR0FBR2lCLEtBQUssQ0FBQ1YsQ0FBQyxDQUFDLENBQUNQLGFBQWEsQ0FBQTtBQUM1QyxNQUFBLEtBQUssSUFBSTBCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzFCLGFBQWEsQ0FBQ3hELE1BQU0sRUFBRWtGLENBQUMsRUFBRSxFQUFFO1FBQzNDMUIsYUFBYSxDQUFDMEIsQ0FBQyxDQUFDLENBQUMzRyxJQUFJLENBQUM0RyxpQkFBaUIsRUFBRSxDQUFBO0FBQzdDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNBO0VBQ0FDLHFCQUFxQkEsQ0FBQzdHLElBQUksRUFBRTtBQUN4QixJQUFBLElBQUk4RyxJQUFJLENBQUE7SUFDUixNQUFNQyxRQUFRLEdBQUcsSUFBSSxDQUFDckssS0FBSyxDQUFDc0ssc0JBQXNCLElBQUksRUFBRSxDQUFBO0lBQ3hELE1BQU1DLEtBQUssR0FBRzdLLE9BQU8sQ0FBQTtJQUVyQixJQUFJOEssT0FBTyxFQUFFRixzQkFBc0IsQ0FBQTtJQUVuQyxJQUFJaEgsSUFBSSxDQUFDa0YsS0FBSyxFQUFFO0FBQ1o4QixNQUFBQSxzQkFBc0IsR0FBR2hILElBQUksQ0FBQ2tGLEtBQUssQ0FBQzhCLHNCQUFzQixDQUFBO0FBQzFELE1BQUEsSUFBSWhILElBQUksQ0FBQ2tGLEtBQUssQ0FBQ2lDLEtBQUssRUFBRTtBQUNsQkwsUUFBQUEsSUFBSSxHQUFHLElBQUksQ0FBQ2xLLE1BQU0sQ0FBQ3dLLEdBQUcsQ0FBQ3BILElBQUksQ0FBQ2tGLEtBQUssQ0FBQ2lDLEtBQUssQ0FBQyxDQUFDTCxJQUFJLENBQUE7UUFDN0MsSUFBSUEsSUFBSSxDQUFDTyxJQUFJLEVBQUU7VUFDWEgsT0FBTyxHQUFHSixJQUFJLENBQUNPLElBQUksQ0FBQTtBQUN2QixTQUFBO0FBQ0osT0FBQyxNQUFNLElBQUlySCxJQUFJLENBQUNrRixLQUFLLENBQUNvQyxLQUFLLEVBQUU7UUFDekJSLElBQUksR0FBRzlHLElBQUksQ0FBQ2tGLEtBQUssQ0FBQTtRQUNqQixJQUFJNEIsSUFBSSxDQUFDUSxLQUFLLEVBQUU7VUFDWkosT0FBTyxHQUFHSixJQUFJLENBQUNRLEtBQUssQ0FBQTtBQUN4QixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUMsTUFBTSxJQUFJdEgsSUFBSSxDQUFDc0YsTUFBTSxFQUFFO0FBQ3BCMEIsTUFBQUEsc0JBQXNCLEdBQUdoSCxJQUFJLENBQUNzRixNQUFNLENBQUMwQixzQkFBc0IsQ0FBQTtBQUMzRCxNQUFBLElBQUloSCxJQUFJLENBQUNzRixNQUFNLENBQUNyRyxJQUFJLEtBQUssT0FBTyxFQUFFO0FBQzlCLFFBQUEsSUFBSWUsSUFBSSxDQUFDc0YsTUFBTSxDQUFDZ0MsS0FBSyxFQUFFO1VBQ25CUixJQUFJLEdBQUc5RyxJQUFJLENBQUNzRixNQUFNLENBQUE7VUFDbEIsSUFBSXdCLElBQUksQ0FBQ1EsS0FBSyxFQUFFO1lBQ1pKLE9BQU8sR0FBR0osSUFBSSxDQUFDUSxLQUFLLENBQUE7QUFDeEIsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBLElBQUEsTUFBTUQsSUFBSSxHQUFHO0FBQUVFLE1BQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLE1BQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLE1BQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLE1BQUFBLEVBQUUsRUFBRSxDQUFBO0tBQUcsQ0FBQTtBQUN4QyxJQUFBLElBQUlSLE9BQU8sRUFBRTtBQUNURyxNQUFBQSxJQUFJLENBQUNFLENBQUMsR0FBR0wsT0FBTyxDQUFDSyxDQUFDLENBQUE7QUFDbEJGLE1BQUFBLElBQUksQ0FBQ0csQ0FBQyxHQUFHTixPQUFPLENBQUNNLENBQUMsQ0FBQTtBQUNsQkgsTUFBQUEsSUFBSSxDQUFDSSxDQUFDLEdBQUdQLE9BQU8sQ0FBQ08sQ0FBQyxDQUFBO0FBQ2xCSixNQUFBQSxJQUFJLENBQUNLLEVBQUUsR0FBR1IsT0FBTyxDQUFDUSxFQUFFLENBQUE7QUFDeEIsS0FBQTtBQUVBLElBQUEsTUFBTUMsUUFBUSxHQUFHWCxzQkFBc0IsSUFBSSxDQUFDLENBQUE7SUFDNUNLLElBQUksQ0FBQ0UsQ0FBQyxJQUFJSSxRQUFRLENBQUE7SUFDbEJOLElBQUksQ0FBQ0csQ0FBQyxJQUFJRyxRQUFRLENBQUE7SUFDbEJOLElBQUksQ0FBQ0ksQ0FBQyxJQUFJRSxRQUFRLENBQUE7O0FBRWxCO0lBQ0EsTUFBTXRCLFNBQVMsR0FBR3JHLElBQUksQ0FBQ3NGLE1BQU0sSUFBSXRGLElBQUksQ0FBQ2tGLEtBQUssQ0FBQTtJQUMzQyxNQUFNMEMsTUFBTSxHQUFHLElBQUksQ0FBQ0MsaUJBQWlCLENBQUN4QixTQUFTLENBQUNwQixhQUFhLENBQUMsQ0FBQTs7QUFFOUQ7QUFDQWdDLElBQUFBLEtBQUssQ0FBQ2EsSUFBSSxDQUFDRixNQUFNLENBQUNHLFdBQVcsQ0FBQyxDQUFBO0FBQzlCLElBQUEsSUFBSUMsU0FBUyxHQUFHWCxJQUFJLENBQUNFLENBQUMsR0FBR04sS0FBSyxDQUFDTyxDQUFDLEdBQUdQLEtBQUssQ0FBQ1EsQ0FBQyxHQUMxQkosSUFBSSxDQUFDRyxDQUFDLEdBQUdQLEtBQUssQ0FBQ00sQ0FBQyxHQUFHTixLQUFLLENBQUNRLENBQUMsR0FDMUJKLElBQUksQ0FBQ0ksQ0FBQyxHQUFHUixLQUFLLENBQUNNLENBQUMsR0FBR04sS0FBSyxDQUFDTyxDQUFDLENBQUE7SUFDMUNRLFNBQVMsSUFBSVgsSUFBSSxDQUFDSyxFQUFFLENBQUE7QUFDcEJNLElBQUFBLFNBQVMsR0FBR0MsSUFBSSxDQUFDQyxJQUFJLENBQUNGLFNBQVMsQ0FBQyxDQUFBO0lBRWhDLE1BQU1HLFlBQVksR0FBR0YsSUFBSSxDQUFDRyxHQUFHLENBQUNDLElBQUksQ0FBQ0MsY0FBYyxDQUFDTixTQUFTLEdBQUdqQixRQUFRLENBQUMsRUFBRSxJQUFJLENBQUNySyxLQUFLLENBQUM2TCxxQkFBcUIsSUFBSXRNLGlCQUFpQixDQUFDLENBQUE7QUFFL0gsSUFBQSxPQUFPa00sWUFBWSxDQUFBO0FBQ3ZCLEdBQUE7RUFFQUssZUFBZUEsQ0FBQ3RDLEtBQUssRUFBRXVDLEtBQUssRUFBRWhGLFNBQVMsRUFBRWlGLFVBQVUsRUFBRTtBQUVqRCxJQUFBLEtBQUssSUFBSWxELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1UsS0FBSyxDQUFDekUsTUFBTSxFQUFFK0QsQ0FBQyxFQUFFLEVBQUU7QUFDbkMsTUFBQSxNQUFNeEYsSUFBSSxHQUFHa0csS0FBSyxDQUFDVixDQUFDLENBQUMsQ0FBQTtBQUNyQixNQUFBLE1BQU1QLGFBQWEsR0FBR2pGLElBQUksQ0FBQ2lGLGFBQWEsQ0FBQTtBQUV4QyxNQUFBLEtBQUssSUFBSTBCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzFCLGFBQWEsQ0FBQ3hELE1BQU0sRUFBRWtGLENBQUMsRUFBRSxFQUFFO0FBRTNDLFFBQUEsTUFBTWdDLFlBQVksR0FBRzFELGFBQWEsQ0FBQzBCLENBQUMsQ0FBQyxDQUFBO0FBQ3JDZ0MsUUFBQUEsWUFBWSxDQUFDQyxjQUFjLENBQUNILEtBQUssQ0FBQyxDQUFBO0FBRWxDLFFBQUEsSUFBSUEsS0FBSyxFQUFFO0FBQ1AsVUFBQSxJQUFJQyxVQUFVLEVBQUU7WUFDWkMsWUFBWSxDQUFDRSxXQUFXLElBQUlILFVBQVUsQ0FBQTtBQUMxQyxXQUFBOztBQUVBO1VBQ0FDLFlBQVksQ0FBQ0csSUFBSSxHQUFHQyx1QkFBdUIsQ0FBQTs7QUFFM0M7VUFDQSxLQUFLLElBQUlwSCxJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLEdBQUc4QixTQUFTLEVBQUU5QixJQUFJLEVBQUUsRUFBRTtZQUN6QyxNQUFNcUgsR0FBRyxHQUFHaEosSUFBSSxDQUFDMUMsYUFBYSxDQUFDcUUsSUFBSSxDQUFDLENBQUNMLFdBQVcsQ0FBQTtZQUNoRDBILEdBQUcsQ0FBQzNFLFNBQVMsR0FBRzRFLGFBQWEsQ0FBQTtZQUM3QkQsR0FBRyxDQUFDekUsU0FBUyxHQUFHMEUsYUFBYSxDQUFBO1lBQzdCTixZQUFZLENBQUNPLG1CQUFtQixDQUFDQyxZQUFZLENBQUNDLGtCQUFrQixDQUFDekgsSUFBSSxDQUFDLEVBQUVxSCxHQUFHLENBQUMsQ0FBQTtBQUNoRixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lLLEVBQUFBLElBQUlBLENBQUNuRCxLQUFLLEVBQUVvRCxJQUFJLEdBQUdDLGFBQWEsRUFBRTtBQUU5QixJQUFBLE1BQU0vTSxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7SUFDMUIsSUFBSUEsTUFBTSxDQUFDZ04sUUFBUSxFQUFFO0FBQ2pCN0QsTUFBQUEsS0FBSyxDQUFDOEQsUUFBUSxDQUFDLG1EQUFtRCxDQUFDLENBQUE7QUFDbkUsTUFBQSxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsTUFBTUMsU0FBUyxHQUFHQyxHQUFHLEVBQUUsQ0FBQTs7QUFFdkI7QUFDQSxJQUFBLElBQUksQ0FBQ2pOLEtBQUssQ0FBQ2tOLFVBQVUsQ0FBQ3BOLE1BQU0sQ0FBQyxDQUFBO0FBRzdCQSxJQUFBQSxNQUFNLENBQUNxTixJQUFJLENBQUMsbUJBQW1CLEVBQUU7QUFDN0JDLE1BQUFBLFNBQVMsRUFBRUosU0FBUztBQUNwQkssTUFBQUEsTUFBTSxFQUFFLElBQUE7QUFDWixLQUFDLENBQUMsQ0FBQTtBQUdGLElBQUEsSUFBSSxDQUFDdk0sS0FBSyxDQUFDQyxZQUFZLEdBQUcsQ0FBQyxDQUFBO0FBQzNCLElBQUEsSUFBSSxDQUFDRCxLQUFLLENBQUNNLGFBQWEsR0FBRyxDQUFDLENBQUE7QUFDNUIsSUFBQSxJQUFJLENBQUNOLEtBQUssQ0FBQ0ksV0FBVyxHQUFHLENBQUMsQ0FBQTtBQUMxQixJQUFBLE1BQU1vTSxZQUFZLEdBQUd4TixNQUFNLENBQUN5TixZQUFZLENBQUNDLE1BQU0sQ0FBQTtBQUMvQyxJQUFBLE1BQU1DLFlBQVksR0FBRzNOLE1BQU0sQ0FBQzROLHlCQUF5QixDQUFBO0FBQ3JELElBQUEsTUFBTUMsZ0JBQWdCLEdBQUc3TixNQUFNLENBQUN5TixZQUFZLENBQUNsTSxXQUFXLENBQUE7O0FBRXhEO0lBQ0EsTUFBTW9ELFNBQVMsR0FBRyxFQUFFLENBQUE7O0FBRXBCO0lBQ0EsTUFBTXlELFFBQVEsR0FBRyxFQUFFLENBQUE7O0FBRW5CO0FBQ0EsSUFBQSxJQUFJc0IsS0FBSyxFQUFFO0FBRVA7QUFDQSxNQUFBLEtBQUssSUFBSVYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHVSxLQUFLLENBQUN6RSxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtRQUNuQyxJQUFJLENBQUNiLGFBQWEsQ0FBQ3VCLEtBQUssQ0FBQ1YsQ0FBQyxDQUFDLEVBQUVyRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDakQsT0FBQTs7QUFFQTtNQUNBLElBQUksQ0FBQ3dELGFBQWEsQ0FBQyxJQUFJLENBQUNsSSxJQUFJLEVBQUUsSUFBSSxFQUFFbUksUUFBUSxDQUFDLENBQUE7QUFFakQsS0FBQyxNQUFNO0FBRUg7TUFDQSxJQUFJLENBQUNELGFBQWEsQ0FBQyxJQUFJLENBQUNsSSxJQUFJLEVBQUUwRSxTQUFTLEVBQUV5RCxRQUFRLENBQUMsQ0FBQTtBQUV0RCxLQUFBO0lBRUEwRixhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLENBQUMvTixNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUE7O0FBRWxEO0FBQ0EsSUFBQSxJQUFJMkUsU0FBUyxDQUFDTSxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBRXRCLE1BQUEsSUFBSSxDQUFDOUUsUUFBUSxDQUFDNk4sY0FBYyxDQUFDQyxXQUFXLEVBQUUsQ0FBQTs7QUFFMUM7TUFDQSxNQUFNaEgsU0FBUyxHQUFHNkYsSUFBSSxLQUFLQyxhQUFhLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtNQUNoRCxJQUFJLENBQUNmLGVBQWUsQ0FBQ3JILFNBQVMsRUFBRSxLQUFLLEVBQUVzQyxTQUFTLENBQUMsQ0FBQTtBQUVqRCxNQUFBLElBQUksQ0FBQ3BGLFFBQVEsQ0FBQzdCLE1BQU0sQ0FBQyxDQUFBO01BQ3JCLElBQUksQ0FBQ2tPLFlBQVksQ0FBQ2pILFNBQVMsRUFBRXRDLFNBQVMsRUFBRXlELFFBQVEsQ0FBQyxDQUFBOztBQUVqRDtNQUNBLElBQUk4RCxVQUFVLEdBQUdpQyxZQUFZLENBQUE7TUFFN0IsSUFBSXJCLElBQUksS0FBS0MsYUFBYSxFQUFFO0FBQ3hCYixRQUFBQSxVQUFVLElBQUlrQyxlQUFlLENBQUE7QUFDakMsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSSxJQUFJLENBQUNsTyxLQUFLLENBQUNtTyxXQUFXLEVBQUU7QUFDeEJuQyxRQUFBQSxVQUFVLElBQUlvQyxtQkFBbUIsQ0FBQTtBQUNyQyxPQUFBO01BQ0EsSUFBSSxDQUFDdEMsZUFBZSxDQUFDckgsU0FBUyxFQUFFLElBQUksRUFBRXNDLFNBQVMsRUFBRWlGLFVBQVUsQ0FBQyxDQUFBOztBQUU1RDtBQUNBLE1BQUEsSUFBSSxDQUFDeEgsVUFBVSxDQUFDQyxTQUFTLENBQUMsQ0FBQTtBQUM5QixLQUFBO0FBRUFtSixJQUFBQSxhQUFhLENBQUNTLFlBQVksQ0FBQyxJQUFJLENBQUN2TyxNQUFNLENBQUMsQ0FBQTtBQUV2QyxJQUFBLE1BQU13TyxPQUFPLEdBQUdyQixHQUFHLEVBQUUsQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ25NLEtBQUssQ0FBQ0csZUFBZSxHQUFHcU4sT0FBTyxHQUFHdEIsU0FBUyxDQUFBO0lBQ2hELElBQUksQ0FBQ2xNLEtBQUssQ0FBQ1EsYUFBYSxHQUFHeEIsTUFBTSxDQUFDeU4sWUFBWSxDQUFDQyxNQUFNLEdBQUdGLFlBQVksQ0FBQTtJQUNwRSxJQUFJLENBQUN4TSxLQUFLLENBQUNPLFdBQVcsR0FBR3ZCLE1BQU0sQ0FBQ3lOLFlBQVksQ0FBQ2xNLFdBQVcsR0FBR3NNLGdCQUFnQixDQUFBO0lBQzNFLElBQUksQ0FBQzdNLEtBQUssQ0FBQ0ssT0FBTyxHQUFHckIsTUFBTSxDQUFDNE4seUJBQXlCLEdBQUdELFlBQVksQ0FBQTtBQUNwRSxJQUFBLElBQUksQ0FBQzNNLEtBQUssQ0FBQ0UsYUFBYSxHQUFHeUQsU0FBUyxDQUFDTSxNQUFNLENBQUE7QUFHM0NqRixJQUFBQSxNQUFNLENBQUNxTixJQUFJLENBQUMsaUJBQWlCLEVBQUU7QUFDM0JDLE1BQUFBLFNBQVMsRUFBRWtCLE9BQU87QUFDbEJqQixNQUFBQSxNQUFNLEVBQUUsSUFBQTtBQUNaLEtBQUMsQ0FBQyxDQUFBO0FBRU4sR0FBQTs7QUFFQTtBQUNBa0IsRUFBQUEsZ0JBQWdCQSxDQUFDOUosU0FBUyxFQUFFc0MsU0FBUyxFQUFFO0FBRW5DLElBQUEsS0FBSyxJQUFJK0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHckUsU0FBUyxDQUFDTSxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtBQUV2QztBQUNBLE1BQUEsTUFBTTBGLFFBQVEsR0FBRy9KLFNBQVMsQ0FBQ3FFLENBQUMsQ0FBQyxDQUFBO01BQzdCLE1BQU14QixJQUFJLEdBQUcsSUFBSSxDQUFDNkMscUJBQXFCLENBQUNxRSxRQUFRLENBQUNsTCxJQUFJLENBQUMsQ0FBQTs7QUFFdEQ7TUFDQSxLQUFLLElBQUkyQixJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLEdBQUc4QixTQUFTLEVBQUU5QixJQUFJLEVBQUUsRUFBRTtRQUN6QyxNQUFNcUgsR0FBRyxHQUFHLElBQUksQ0FBQ2pGLGFBQWEsQ0FBQ0MsSUFBSSxFQUFHLHVCQUF1QixHQUFHd0IsQ0FBRSxDQUFDLENBQUE7QUFDbkV0SCxRQUFBQSxhQUFhLENBQUNrQixNQUFNLENBQUM0SixHQUFHLENBQUMsQ0FBQTtRQUN6QmtDLFFBQVEsQ0FBQzVOLGFBQWEsQ0FBQ3FFLElBQUksQ0FBQyxHQUFHLElBQUl3SixZQUFZLENBQUM7QUFDNUM3SixVQUFBQSxXQUFXLEVBQUUwSCxHQUFHO0FBQ2hCb0MsVUFBQUEsS0FBSyxFQUFFLEtBQUE7QUFDWCxTQUFDLENBQUMsQ0FBQTtBQUNOLE9BQUE7O0FBRUE7TUFDQSxJQUFJLENBQUMsSUFBSSxDQUFDOU4sYUFBYSxDQUFDd0ksR0FBRyxDQUFDOUIsSUFBSSxDQUFDLEVBQUU7UUFDL0IsTUFBTWdGLEdBQUcsR0FBRyxJQUFJLENBQUNqRixhQUFhLENBQUNDLElBQUksRUFBRyw0QkFBNEIsR0FBR0EsSUFBSyxDQUFDLENBQUE7QUFDM0U5RixRQUFBQSxhQUFhLENBQUNrQixNQUFNLENBQUM0SixHQUFHLENBQUMsQ0FBQTtRQUN6QixJQUFJLENBQUMxTCxhQUFhLENBQUNrQyxHQUFHLENBQUN3RSxJQUFJLEVBQUUsSUFBSW1ILFlBQVksQ0FBQztBQUMxQzdKLFVBQUFBLFdBQVcsRUFBRTBILEdBQUc7QUFDaEJvQyxVQUFBQSxLQUFLLEVBQUUsS0FBQTtBQUNYLFNBQUMsQ0FBQyxDQUFDLENBQUE7QUFDUCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQUMsRUFBQUEsbUJBQW1CQSxDQUFDQyxnQkFBZ0IsRUFBRUMsU0FBUyxFQUFFQyxVQUFVLEVBQUU7QUFFekQ7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDOU8sS0FBSyxDQUFDbU8sV0FBVyxFQUFFO01BQ3hCLE1BQU16TixZQUFZLEdBQUcsSUFBSXFPLGdCQUFnQixDQUFDLElBQUksQ0FBQy9PLEtBQUssQ0FBQyxDQUFBO0FBQ3JEOE8sTUFBQUEsVUFBVSxDQUFDckcsSUFBSSxDQUFDL0gsWUFBWSxDQUFDLENBQUE7QUFDakMsS0FBQTs7QUFFQTtBQUNBLElBQUEsTUFBTXNPLFdBQVcsR0FBR0osZ0JBQWdCLENBQUNLLE9BQU8sQ0FBQTtBQUM1QyxJQUFBLEtBQUssSUFBSW5HLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2tHLFdBQVcsQ0FBQ2pLLE1BQU0sRUFBRStELENBQUMsRUFBRSxFQUFFO0FBQ3pDLE1BQUEsTUFBTW9HLEtBQUssR0FBR0YsV0FBVyxDQUFDbEcsQ0FBQyxDQUFDLENBQUE7O0FBRTVCO01BQ0EsTUFBTXFHLFNBQVMsR0FBRyxJQUFJQyxlQUFlLENBQUMsSUFBSSxDQUFDcFAsS0FBSyxFQUFFa1AsS0FBSyxDQUFDLENBQUE7QUFDeERMLE1BQUFBLFNBQVMsQ0FBQ3BHLElBQUksQ0FBQzBHLFNBQVMsQ0FBQyxDQUFBOztBQUV6QjtBQUNBLE1BQUEsSUFBSUQsS0FBSyxDQUFDNUcsT0FBTyxJQUFJLENBQUM0RyxLQUFLLENBQUM5QyxJQUFJLEdBQUdpRCxTQUFTLE1BQU0sQ0FBQyxFQUFFO0FBRWpEO1FBQ0FILEtBQUssQ0FBQ0ksUUFBUSxHQUFHLEtBQUssQ0FBQTtRQUV0QkosS0FBSyxDQUFDOUMsSUFBSSxHQUFHLFVBQVUsQ0FBQTtRQUN2QjhDLEtBQUssQ0FBQ0ssZ0JBQWdCLEdBQUdMLEtBQUssQ0FBQzNNLElBQUksS0FBS2lOLHFCQUFxQixHQUFHQyxxQkFBcUIsR0FBR0Msc0JBQXNCLENBQUE7QUFDOUdaLFFBQUFBLFVBQVUsQ0FBQ3JHLElBQUksQ0FBQzBHLFNBQVMsQ0FBQyxDQUFBO0FBQzlCLE9BQUE7QUFDSixLQUFBOztBQUVBO0lBQ0FMLFVBQVUsQ0FBQ2EsSUFBSSxFQUFFLENBQUE7QUFDckIsR0FBQTtFQUVBQyxhQUFhQSxDQUFDZixTQUFTLEVBQUU7QUFFckIsSUFBQSxLQUFLLElBQUkvRixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcrRixTQUFTLENBQUM5SixNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtBQUN2QytGLE1BQUFBLFNBQVMsQ0FBQy9GLENBQUMsQ0FBQyxDQUFDK0csT0FBTyxFQUFFLENBQUE7QUFDMUIsS0FBQTtBQUNKLEdBQUE7QUFFQUMsRUFBQUEsVUFBVUEsR0FBRztBQUVUO0lBQ0EsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBSyxDQUFBO0FBQ3pCLElBQUEsSUFBSSxJQUFJLENBQUMvUCxLQUFLLENBQUNnUSxtQkFBbUIsRUFBRTtBQUNoQyxNQUFBLElBQUksQ0FBQ2hRLEtBQUssQ0FBQ2dRLG1CQUFtQixHQUFHLEtBQUssQ0FBQTtNQUN0QyxJQUFJLENBQUNELFlBQVksR0FBRyxJQUFJLENBQUE7QUFDNUIsS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSSxDQUFDdFAsR0FBRyxHQUFHLElBQUksQ0FBQ1QsS0FBSyxDQUFDUyxHQUFHLENBQUE7SUFDekIsSUFBSSxDQUFDQyxZQUFZLENBQUMwSyxJQUFJLENBQUMsSUFBSSxDQUFDcEwsS0FBSyxDQUFDVSxZQUFZLENBQUMsQ0FBQTs7QUFFL0M7QUFDQSxJQUFBLElBQUksQ0FBQ1YsS0FBSyxDQUFDUyxHQUFHLEdBQUd3UCxRQUFRLENBQUE7O0FBRXpCO0FBQ0EsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDalEsS0FBSyxDQUFDbU8sV0FBVyxFQUFFO0FBQ3pCLE1BQUEsSUFBSSxDQUFDbk8sS0FBSyxDQUFDVSxZQUFZLENBQUNvQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN4QyxLQUFBOztBQUVBO0FBQ0EsSUFBQSxJQUFJLENBQUM3QyxRQUFRLENBQUNpUSxpQkFBaUIsRUFBRSxDQUFBO0FBQ3JDLEdBQUE7QUFFQUMsRUFBQUEsWUFBWUEsR0FBRztBQUVYLElBQUEsSUFBSSxDQUFDblEsS0FBSyxDQUFDUyxHQUFHLEdBQUcsSUFBSSxDQUFDQSxHQUFHLENBQUE7SUFDekIsSUFBSSxDQUFDVCxLQUFLLENBQUNVLFlBQVksQ0FBQzBLLElBQUksQ0FBQyxJQUFJLENBQUMxSyxZQUFZLENBQUMsQ0FBQTs7QUFFL0M7SUFDQSxJQUFJLElBQUksQ0FBQ3FQLFlBQVksRUFBRTtBQUNuQixNQUFBLElBQUksQ0FBQy9QLEtBQUssQ0FBQ2dRLG1CQUFtQixHQUFHLElBQUksQ0FBQTtBQUN6QyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtFQUNBN0UsaUJBQWlCQSxDQUFDNUMsYUFBYSxFQUFFO0FBRTdCLElBQUEsTUFBTTJDLE1BQU0sR0FBRyxJQUFJa0YsV0FBVyxFQUFFLENBQUE7QUFFaEMsSUFBQSxJQUFJN0gsYUFBYSxDQUFDeEQsTUFBTSxHQUFHLENBQUMsRUFBRTtNQUMxQm1HLE1BQU0sQ0FBQ0UsSUFBSSxDQUFDN0MsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDOEgsSUFBSSxDQUFDLENBQUE7QUFDbEMsTUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRy9ILGFBQWEsQ0FBQ3hELE1BQU0sRUFBRXVMLENBQUMsRUFBRSxFQUFFO1FBQzNDcEYsTUFBTSxDQUFDN0IsR0FBRyxDQUFDZCxhQUFhLENBQUMrSCxDQUFDLENBQUMsQ0FBQ0QsSUFBSSxDQUFDLENBQUE7QUFDckMsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE9BQU9uRixNQUFNLENBQUE7QUFDakIsR0FBQTs7QUFFQTtFQUNBcUYsa0JBQWtCQSxDQUFDL0csS0FBSyxFQUFFO0FBRXRCLElBQUEsS0FBSyxJQUFJVixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdVLEtBQUssQ0FBQ3pFLE1BQU0sRUFBRStELENBQUMsRUFBRSxFQUFFO0FBQ25DLE1BQUEsTUFBTVAsYUFBYSxHQUFHaUIsS0FBSyxDQUFDVixDQUFDLENBQUMsQ0FBQ1AsYUFBYSxDQUFBO01BQzVDaUIsS0FBSyxDQUFDVixDQUFDLENBQUMsQ0FBQ29DLE1BQU0sR0FBRyxJQUFJLENBQUNDLGlCQUFpQixDQUFDNUMsYUFBYSxDQUFDLENBQUE7QUFDM0QsS0FBQTtBQUNKLEdBQUE7O0FBRUE7RUFDQWlJLGFBQWFBLENBQUNqSSxhQUFhLEVBQUU7QUFFekIsSUFBQSxNQUFNMkMsTUFBTSxHQUFHLElBQUlrRixXQUFXLEVBQUUsQ0FBQTtBQUVoQyxJQUFBLEtBQUssSUFBSXRILENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1AsYUFBYSxDQUFDeEQsTUFBTSxFQUFFK0QsQ0FBQyxFQUFFLEVBQUU7TUFDM0NvQyxNQUFNLENBQUNFLElBQUksQ0FBQzdDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQzhILElBQUksQ0FBQyxDQUFBO0FBQ2xDLE1BQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcvSCxhQUFhLENBQUN4RCxNQUFNLEVBQUV1TCxDQUFDLEVBQUUsRUFBRTtRQUMzQ3BGLE1BQU0sQ0FBQzdCLEdBQUcsQ0FBQ2QsYUFBYSxDQUFDK0gsQ0FBQyxDQUFDLENBQUNELElBQUksQ0FBQyxDQUFBO0FBQ3JDLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPbkYsTUFBTSxDQUFBO0FBQ2pCLEdBQUE7RUFFQXVGLGVBQWVBLENBQUNsSSxhQUFhLEVBQUU7QUFDM0IsSUFBQSxLQUFLLElBQUlPLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1AsYUFBYSxDQUFDeEQsTUFBTSxFQUFFK0QsQ0FBQyxFQUFFLEVBQUU7TUFDM0MsSUFBSSxDQUFDN0csU0FBUyxDQUFDNkcsQ0FBQyxDQUFDLEdBQUdQLGFBQWEsQ0FBQ08sQ0FBQyxDQUFDLENBQUMzRCxRQUFRLENBQUE7QUFDakQsS0FBQTtBQUNKLEdBQUE7RUFFQXVMLGdCQUFnQkEsQ0FBQ25JLGFBQWEsRUFBRTtBQUM1QixJQUFBLEtBQUssSUFBSU8sQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHUCxhQUFhLENBQUN4RCxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtNQUMzQ1AsYUFBYSxDQUFDTyxDQUFDLENBQUMsQ0FBQzNELFFBQVEsR0FBRyxJQUFJLENBQUNsRCxTQUFTLENBQUM2RyxDQUFDLENBQUMsQ0FBQTtBQUNqRCxLQUFBO0FBQ0osR0FBQTtBQUVBNkgsRUFBQUEsa0JBQWtCQSxDQUFDN1EsTUFBTSxFQUFFcVAsU0FBUyxFQUFFO0FBRWxDLElBQUEsTUFBTUQsS0FBSyxHQUFHQyxTQUFTLENBQUNELEtBQUssQ0FBQTtBQUM3QixJQUFBLElBQUkwQixTQUFTLENBQUE7O0FBRWI7QUFDQSxJQUFBLElBQUkxQixLQUFLLENBQUMzTSxJQUFJLEtBQUtzTyxjQUFjLEVBQUU7TUFFL0IsTUFBTUMsZUFBZSxHQUFHNUIsS0FBSyxDQUFDNkIsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQTtNQUNwREgsU0FBUyxHQUFHRSxlQUFlLENBQUNFLFlBQVksQ0FBQTtBQUV4Q0osTUFBQUEsU0FBUyxDQUFDSyxLQUFLLENBQUNDLFdBQVcsQ0FBQ2hDLEtBQUssQ0FBQytCLEtBQUssQ0FBQ0UsV0FBVyxFQUFFLENBQUMsQ0FBQTtBQUN0RFAsTUFBQUEsU0FBUyxDQUFDSyxLQUFLLENBQUNHLFdBQVcsQ0FBQ2xDLEtBQUssQ0FBQytCLEtBQUssQ0FBQ0ksV0FBVyxFQUFFLENBQUMsQ0FBQTtNQUN0RFQsU0FBUyxDQUFDSyxLQUFLLENBQUNLLFdBQVcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFFdENWLFNBQVMsQ0FBQ3pOLFVBQVUsR0FBR29PLHNCQUFzQixDQUFBO0FBQzdDWCxNQUFBQSxTQUFTLENBQUNZLFFBQVEsR0FBR3RDLEtBQUssQ0FBQ3VDLGNBQWMsR0FBRyxJQUFJLENBQUE7QUFDaERiLE1BQUFBLFNBQVMsQ0FBQ2MsT0FBTyxHQUFHeEMsS0FBSyxDQUFDdUMsY0FBYyxDQUFBO01BQ3hDYixTQUFTLENBQUN2TixXQUFXLEdBQUcsQ0FBQyxDQUFBO0FBQ3pCdU4sTUFBQUEsU0FBUyxDQUFDZSxHQUFHLEdBQUd6QyxLQUFLLENBQUMwQyxlQUFlLEdBQUcsQ0FBQyxDQUFBO0FBRXpDLE1BQUEsSUFBSSxDQUFDM1IsUUFBUSxDQUFDNFIsbUJBQW1CLENBQUNqQixTQUFTLENBQUMsQ0FBQTtBQUNoRCxLQUFBO0FBQ0EsSUFBQSxPQUFPQSxTQUFTLENBQUE7QUFDcEIsR0FBQTs7QUFFQTtBQUNBO0VBQ0FrQix5QkFBeUJBLENBQUMzQyxTQUFTLEVBQUVYLFFBQVEsRUFBRW9DLFNBQVMsRUFBRW1CLFlBQVksRUFBRTtBQUVwRSxJQUFBLE1BQU03QyxLQUFLLEdBQUdDLFNBQVMsQ0FBQ0QsS0FBSyxDQUFBO0lBQzdCLElBQUk4QyxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFFM0IsSUFBQSxJQUFJOUMsS0FBSyxDQUFDM00sSUFBSSxLQUFLaU4scUJBQXFCLEVBQUU7QUFFdEM7QUFDQTlQLE1BQUFBLE9BQU8sQ0FBQzBMLElBQUksQ0FBQzJHLFlBQVksQ0FBQ0UsTUFBTSxDQUFDLENBQUE7QUFDakN2UyxNQUFBQSxPQUFPLENBQUNvTCxDQUFDLElBQUlpSCxZQUFZLENBQUMxRyxXQUFXLENBQUNQLENBQUMsQ0FBQTtNQUV2QyxJQUFJLENBQUNuSSxNQUFNLENBQUNXLElBQUksQ0FBQzROLFdBQVcsQ0FBQ3hSLE9BQU8sQ0FBQyxDQUFBO0FBQ3JDLE1BQUEsSUFBSSxDQUFDaUQsTUFBTSxDQUFDVyxJQUFJLENBQUM0TyxjQUFjLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBRTFDLE1BQUEsSUFBSSxDQUFDdlAsTUFBTSxDQUFDNk8sUUFBUSxHQUFHLENBQUMsQ0FBQTtNQUN4QixJQUFJLENBQUM3TyxNQUFNLENBQUMrTyxPQUFPLEdBQUdLLFlBQVksQ0FBQzFHLFdBQVcsQ0FBQ1AsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUVwRCxNQUFBLE1BQU1xSCxXQUFXLEdBQUc1RyxJQUFJLENBQUM2RyxHQUFHLENBQUNMLFlBQVksQ0FBQzFHLFdBQVcsQ0FBQ1IsQ0FBQyxFQUFFa0gsWUFBWSxDQUFDMUcsV0FBVyxDQUFDTixDQUFDLENBQUMsQ0FBQTtBQUNwRixNQUFBLElBQUksQ0FBQ3BJLE1BQU0sQ0FBQzBQLFdBQVcsR0FBR0YsV0FBVyxDQUFBO0FBRXpDLEtBQUMsTUFBTTtBQUVIO01BQ0EsSUFBSSxDQUFDaEQsU0FBUyxDQUFDbUQsV0FBVyxDQUFDQyxVQUFVLENBQUMvRCxRQUFRLENBQUN0RCxNQUFNLENBQUMsRUFBRTtBQUNwRDhHLFFBQUFBLGdCQUFnQixHQUFHLEtBQUssQ0FBQTtBQUM1QixPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBO0FBQ0EsSUFBQSxJQUFJOUMsS0FBSyxDQUFDM00sSUFBSSxLQUFLc08sY0FBYyxFQUFFO01BQy9CLElBQUkyQixXQUFXLEdBQUcsS0FBSyxDQUFBO0FBRXZCLE1BQUEsTUFBTWpLLGFBQWEsR0FBR2lHLFFBQVEsQ0FBQ2pHLGFBQWEsQ0FBQTtBQUM1QyxNQUFBLEtBQUssSUFBSU8sQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHUCxhQUFhLENBQUN4RCxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtRQUMzQyxJQUFJUCxhQUFhLENBQUNPLENBQUMsQ0FBQyxDQUFDMkosVUFBVSxDQUFDN0IsU0FBUyxDQUFDLEVBQUU7QUFDeEM0QixVQUFBQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQ2xCLFVBQUEsTUFBQTtBQUNKLFNBQUE7QUFDSixPQUFBO01BQ0EsSUFBSSxDQUFDQSxXQUFXLEVBQUU7QUFDZFIsUUFBQUEsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQzVCLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPQSxnQkFBZ0IsQ0FBQTtBQUMzQixHQUFBOztBQUVBO0FBQ0FVLEVBQUFBLGVBQWVBLENBQUNDLFVBQVUsRUFBRXpELEtBQUssRUFBRTtBQUUvQnlELElBQUFBLFVBQVUsQ0FBQ25ELHFCQUFxQixDQUFDLENBQUN6SyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQzVDNE4sSUFBQUEsVUFBVSxDQUFDQyxjQUFjLENBQUMsQ0FBQzdOLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDckM0TixJQUFBQSxVQUFVLENBQUM5QixjQUFjLENBQUMsQ0FBQzlMLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFFckM0TixVQUFVLENBQUN6RCxLQUFLLENBQUMzTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRzJNLEtBQUssQ0FBQTtJQUNqQ0EsS0FBSyxDQUFDbkYsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO0FBQ2pDLEdBQUE7QUFFQThJLEVBQUFBLGVBQWVBLENBQUNDLGlCQUFpQixFQUFFckosT0FBTyxFQUFFMEYsU0FBUyxFQUFFO0FBRW5ELElBQUEsTUFBTUQsS0FBSyxHQUFHQyxTQUFTLENBQUNELEtBQUssQ0FBQTtBQUM3QixJQUFBLE1BQU02RCxXQUFXLEdBQUcsSUFBSSxDQUFDL1MsS0FBSyxDQUFDd0Qsd0JBQXdCLENBQUE7QUFFdkQsSUFBQSxJQUFJLENBQUNzUCxpQkFBaUIsSUFBSTVELEtBQUssQ0FBQ3RGLFdBQVcsRUFBRTtBQUV6QztBQUNBLE1BQUEsSUFBSSxDQUFDc0YsS0FBSyxDQUFDOEQsU0FBUyxJQUFJLENBQUNELFdBQVcsRUFBRTtBQUNsQzdELFFBQUFBLEtBQUssQ0FBQzhELFNBQVMsR0FBRyxJQUFJLENBQUM3UyxjQUFjLENBQUN1SyxHQUFHLENBQUMsSUFBSSxDQUFDNUssTUFBTSxFQUFFb1AsS0FBSyxDQUFDLENBQUE7QUFDakUsT0FBQTtBQUVBLE1BQUEsSUFBSUEsS0FBSyxDQUFDM00sSUFBSSxLQUFLaU4scUJBQXFCLEVBQUU7QUFDdEMsUUFBQSxJQUFJLENBQUN2UCxRQUFRLENBQUNnVCwwQkFBMEIsQ0FBQ3ZNLElBQUksQ0FBQ3dJLEtBQUssRUFBRXpGLE9BQU8sRUFBRSxJQUFJLENBQUM5RyxNQUFNLENBQUMsQ0FBQTtBQUM5RSxPQUFDLE1BQU07UUFDSCxJQUFJLENBQUMxQyxRQUFRLENBQUNpVCxvQkFBb0IsQ0FBQ3hNLElBQUksQ0FBQ3dJLEtBQUssRUFBRXpGLE9BQU8sQ0FBQyxDQUFBO0FBQzNELE9BQUE7TUFFQSxNQUFNMEosZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQzlCLE1BQUEsSUFBSSxDQUFDbFQsUUFBUSxDQUFDNk4sY0FBYyxDQUFDbEYsTUFBTSxDQUFDc0csS0FBSyxFQUFFLElBQUksQ0FBQ3ZNLE1BQU0sRUFBRXdRLGdCQUFnQixDQUFDLENBQUE7QUFDN0UsS0FBQTtBQUVBLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBO0FBRUFDLEVBQUFBLG1CQUFtQkEsQ0FBQ3RULE1BQU0sRUFBRTJFLFNBQVMsRUFBRXNDLFNBQVMsRUFBRTtBQUU5QyxJQUFBLE1BQU1zTSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLElBQUEsTUFBTUMsWUFBWSxHQUFHLElBQUksQ0FBQzFSLGVBQWUsQ0FBQzJSLFlBQVksQ0FBQTs7QUFFdEQ7QUFDQSxJQUFBLE1BQU1DLGNBQWMsR0FBRyxJQUFJLENBQUN4VCxLQUFLLENBQUN5VCxxQkFBcUIsQ0FBQTtBQUN2RCxJQUFBLElBQUlELGNBQWMsRUFBRTtBQUNoQixNQUFBLElBQUksQ0FBQzVSLGVBQWUsQ0FBQzhSLGNBQWMsQ0FBQyxJQUFJLENBQUMxVCxLQUFLLENBQUMyVCxtQkFBbUIsRUFBRSxJQUFJLENBQUMzVCxLQUFLLENBQUM0VCx3QkFBd0IsQ0FBQyxDQUFBO0FBQzVHLEtBQUE7QUFFQTlULElBQUFBLE1BQU0sQ0FBQytULGFBQWEsQ0FBQ0MsVUFBVSxDQUFDQyxPQUFPLENBQUMsQ0FBQTtBQUN4Q2pVLElBQUFBLE1BQU0sQ0FBQ2tVLGFBQWEsQ0FBQ0MsVUFBVSxDQUFDQyxPQUFPLENBQUMsQ0FBQTtBQUN4Q3BVLElBQUFBLE1BQU0sQ0FBQ3FVLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFFbEMsSUFBQSxLQUFLLElBQUk3USxJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLEdBQUdtQixTQUFTLENBQUNNLE1BQU0sRUFBRXpCLElBQUksRUFBRSxFQUFFO0FBQ2hELE1BQUEsTUFBTWtMLFFBQVEsR0FBRy9KLFNBQVMsQ0FBQ25CLElBQUksQ0FBQyxDQUFBO01BRWhDc0ssYUFBYSxDQUFDQyxhQUFhLENBQUMsSUFBSSxDQUFDL04sTUFBTSxFQUFHLENBQUEsT0FBQSxFQUFTd0QsSUFBSyxDQUFBLENBQUMsQ0FBQyxDQUFBO01BRTFELEtBQUssSUFBSTJCLElBQUksR0FBRyxDQUFDLEVBQUVBLElBQUksR0FBRzhCLFNBQVMsRUFBRTlCLElBQUksRUFBRSxFQUFFO0FBRXpDLFFBQUEsTUFBTW1QLE1BQU0sR0FBRzVGLFFBQVEsQ0FBQzVOLGFBQWEsQ0FBQ3FFLElBQUksQ0FBQyxDQUFBO0FBQzNDLFFBQUEsTUFBTW9QLFFBQVEsR0FBR0QsTUFBTSxDQUFDeFAsV0FBVyxDQUFBO1FBRW5DLE1BQU0wUCxNQUFNLEdBQUcsSUFBSSxDQUFDMVQsYUFBYSxDQUFDOEosR0FBRyxDQUFDMkosUUFBUSxDQUFDbFMsS0FBSyxDQUFDLENBQUE7QUFDckQsUUFBQSxNQUFNb1MsT0FBTyxHQUFHRCxNQUFNLENBQUMxUCxXQUFXLENBQUE7QUFFbEMsUUFBQSxJQUFJLENBQUNoRCxlQUFlLENBQUM0UyxPQUFPLENBQUNILFFBQVEsQ0FBQ2xTLEtBQUssRUFBRWtTLFFBQVEsQ0FBQ2pTLE1BQU0sQ0FBQyxDQUFBOztBQUU3RDtRQUNBLEtBQUssSUFBSTBHLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3VLLFlBQVksRUFBRXZLLENBQUMsRUFBRSxFQUFFO0FBRW5DLFVBQUEsSUFBSSxDQUFDbEgsZUFBZSxDQUFDNlMsZ0JBQWdCLENBQUNKLFFBQVEsQ0FBQyxDQUFBO1VBQy9DLE1BQU1LLHNCQUFzQixHQUFHbEIsY0FBYyxJQUFJdk8sSUFBSSxLQUFLLENBQUMsSUFBSTZELENBQUMsS0FBSyxDQUFDLENBQUE7QUFDdEU2TCxVQUFBQSxrQkFBa0IsQ0FBQzdVLE1BQU0sRUFBRXdVLE1BQU0sRUFBRUksc0JBQXNCLEdBQUcsSUFBSSxDQUFDOVMsZUFBZSxDQUFDZ1QsYUFBYSxHQUFHdEIsWUFBWSxDQUFDLENBQUE7QUFFOUcsVUFBQSxJQUFJLENBQUMxUixlQUFlLENBQUM2UyxnQkFBZ0IsQ0FBQ0YsT0FBTyxDQUFDLENBQUE7QUFDOUNJLFVBQUFBLGtCQUFrQixDQUFDN1UsTUFBTSxFQUFFc1UsTUFBTSxFQUFFZCxZQUFZLENBQUMsQ0FBQTtBQUNwRCxTQUFBO0FBQ0osT0FBQTtBQUVBMUYsTUFBQUEsYUFBYSxDQUFDUyxZQUFZLENBQUMsSUFBSSxDQUFDdk8sTUFBTSxDQUFDLENBQUE7QUFDM0MsS0FBQTtBQUNKLEdBQUE7QUFFQWtPLEVBQUFBLFlBQVlBLENBQUNqSCxTQUFTLEVBQUV0QyxTQUFTLEVBQUV5RCxRQUFRLEVBQUU7QUFFekMsSUFBQSxNQUFNbEksS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO0FBQ3hCLElBQUEsTUFBTUYsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO0FBQzFCLElBQUEsTUFBTTBELHdCQUF3QixHQUFHeEQsS0FBSyxDQUFDd0Qsd0JBQXdCLENBQUE7SUFFL0QsSUFBSSxDQUFDc0QsZUFBZSxDQUFDaEgsTUFBTSxFQUFFRSxLQUFLLEVBQUUrRyxTQUFTLENBQUMsQ0FBQTtJQUM5QyxJQUFJLENBQUMrSSxVQUFVLEVBQUUsQ0FBQTs7QUFFakI7QUFDQTlQLElBQUFBLEtBQUssQ0FBQzZVLE1BQU0sQ0FBQ0MsT0FBTyxFQUFFLENBQUE7O0FBRXRCO0FBQ0EsSUFBQSxJQUFJLENBQUN2RSxrQkFBa0IsQ0FBQzlMLFNBQVMsQ0FBQyxDQUFBOztBQUVsQztBQUNBLElBQUEsSUFBSSxDQUFDOEosZ0JBQWdCLENBQUM5SixTQUFTLEVBQUVzQyxTQUFTLENBQUMsQ0FBQTs7QUFFM0M7SUFDQSxNQUFNOEgsU0FBUyxHQUFHLEVBQUU7QUFBRUMsTUFBQUEsVUFBVSxHQUFHLEVBQUUsQ0FBQTtJQUNyQyxJQUFJLENBQUNILG1CQUFtQixDQUFDM08sS0FBSyxDQUFDNlUsTUFBTSxFQUFFaEcsU0FBUyxFQUFFQyxVQUFVLENBQUMsQ0FBQTs7QUFFN0Q7QUFDQSxJQUFBLElBQUksQ0FBQzlFLGdCQUFnQixDQUFDOUIsUUFBUSxDQUFDLENBQUE7O0FBRS9CO0FBQ0EsSUFBQSxNQUFNdUIsT0FBTyxHQUFHLElBQUksQ0FBQ0Ysb0JBQW9CLENBQUNyQixRQUFRLENBQUMsQ0FBQTs7QUFFbkQ7QUFDQSxJQUFBLElBQUksQ0FBQ2pJLFFBQVEsQ0FBQzhVLHFCQUFxQixDQUFDdEwsT0FBTyxDQUFDLENBQUE7QUFDNUMsSUFBQSxJQUFJLENBQUN4SixRQUFRLENBQUMrVSxTQUFTLENBQUN2TCxPQUFPLENBQUMsQ0FBQTs7QUFFaEM7QUFDQSxJQUFBLE1BQU1zSSxZQUFZLEdBQUcsSUFBSSxDQUFDdkIsYUFBYSxDQUFDL0csT0FBTyxDQUFDLENBQUE7QUFFaEQsSUFBQSxJQUFJWCxDQUFDLEVBQUVtQixDQUFDLEVBQUVnTCxHQUFHLEVBQUUzRSxDQUFDLENBQUE7O0FBRWhCO0FBQ0EsSUFBQSxLQUFLeEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHckUsU0FBUyxDQUFDTSxNQUFNLEVBQUUrRCxDQUFDLEVBQUUsRUFBRTtBQUNuQyxNQUFBLE1BQU0wRixRQUFRLEdBQUcvSixTQUFTLENBQUNxRSxDQUFDLENBQUMsQ0FBQTtNQUM3Qm1NLEdBQUcsR0FBR3pHLFFBQVEsQ0FBQ2pHLGFBQWEsQ0FBQTtBQUU1QixNQUFBLEtBQUswQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdnTCxHQUFHLENBQUNsUSxNQUFNLEVBQUVrRixDQUFDLEVBQUUsRUFBRTtBQUM3QjtBQUNBcUcsUUFBQUEsQ0FBQyxHQUFHMkUsR0FBRyxDQUFDaEwsQ0FBQyxDQUFDLENBQUE7QUFFVnFHLFFBQUFBLENBQUMsQ0FBQ3BFLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUN2Qm9FLFFBQUFBLENBQUMsQ0FBQ2xFLElBQUksR0FBR2lELFNBQVMsQ0FBQzs7QUFFbkI7UUFDQWlCLENBQUMsQ0FBQzlELG1CQUFtQixDQUFDQyxZQUFZLENBQUNDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFNEQsQ0FBQyxDQUFDbkwsUUFBUSxDQUFDa0IsUUFBUSxHQUFHaUssQ0FBQyxDQUFDbkwsUUFBUSxDQUFDa0IsUUFBUSxHQUFHLElBQUksQ0FBQzNFLFFBQVEsQ0FBQyxDQUFBO0FBQ3BINE8sUUFBQUEsQ0FBQyxDQUFDOUQsbUJBQW1CLENBQUNDLFlBQVksQ0FBQ0Msa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDaEwsUUFBUSxDQUFDLENBQUE7QUFDNUUsT0FBQTtBQUNKLEtBQUE7O0FBRUE7QUFDQSxJQUFBLEtBQUt1SSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUc2RSxVQUFVLENBQUMvSixNQUFNLEVBQUVrRixDQUFDLEVBQUUsRUFBRTtNQUNwQzZFLFVBQVUsQ0FBQzdFLENBQUMsQ0FBQyxDQUFDaUYsS0FBSyxDQUFDNUcsT0FBTyxHQUFHLEtBQUssQ0FBQTtBQUN2QyxLQUFBO0lBRUEsTUFBTXFLLFVBQVUsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUE7SUFDL0IsSUFBSTFOLElBQUksRUFBRTNCLElBQUksQ0FBQTtJQUNkLElBQUk0Uix1QkFBdUIsR0FBRyxLQUFLLENBQUE7O0FBRW5DO0FBQ0EsSUFBQSxLQUFLcE0sQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHZ0csVUFBVSxDQUFDL0osTUFBTSxFQUFFK0QsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsTUFBQSxNQUFNcUcsU0FBUyxHQUFHTCxVQUFVLENBQUNoRyxDQUFDLENBQUMsQ0FBQTtBQUMvQixNQUFBLE1BQU1xTSxjQUFjLEdBQUdoRyxTQUFTLFlBQVlKLGdCQUFnQixDQUFBOztBQUU1RDtBQUNBLE1BQUEsSUFBSXFHLGdCQUFnQixHQUFHakcsU0FBUyxDQUFDaUcsZ0JBQWdCLENBQUE7O0FBRWpEO0FBQ0EsTUFBQSxJQUFJck8sU0FBUyxHQUFHLENBQUMsSUFBSXFPLGdCQUFnQixHQUFHLENBQUMsSUFBSWpHLFNBQVMsQ0FBQ0QsS0FBSyxDQUFDbUcsT0FBTyxFQUFFO0FBQ2xFRCxRQUFBQSxnQkFBZ0IsR0FBRyxDQUFDLENBQUE7QUFDcEJuTSxRQUFBQSxLQUFLLENBQUNxTSxJQUFJLENBQUMsc0hBQXNILENBQUMsQ0FBQTtBQUN0SSxPQUFBO01BRUEsS0FBSyxJQUFJQyxpQkFBaUIsR0FBRyxDQUFDLEVBQUVBLGlCQUFpQixHQUFHSCxnQkFBZ0IsRUFBRUcsaUJBQWlCLEVBQUUsRUFBRTtBQUV2RjNILFFBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDL04sTUFBTSxFQUFHLFNBQVFxUCxTQUFTLENBQUNELEtBQUssQ0FBQytCLEtBQUssQ0FBQ3hPLElBQUssQ0FBRzhTLENBQUFBLEVBQUFBLGlCQUFrQixFQUFDLENBQUMsQ0FBQTs7QUFFL0Y7UUFDQSxJQUFJSCxnQkFBZ0IsR0FBRyxDQUFDLEVBQUU7QUFDdEJqRyxVQUFBQSxTQUFTLENBQUNxRyxtQkFBbUIsQ0FBQ0QsaUJBQWlCLEVBQUVILGdCQUFnQixDQUFDLENBQUE7QUFDdEUsU0FBQTtRQUVBakcsU0FBUyxDQUFDc0csU0FBUyxFQUFFLENBQUE7UUFDckIsSUFBSTNDLGlCQUFpQixHQUFHLEtBQUssQ0FBQTtRQUU3QixNQUFNbEMsU0FBUyxHQUFHLElBQUksQ0FBQ0Qsa0JBQWtCLENBQUM3USxNQUFNLEVBQUVxUCxTQUFTLENBQUMsQ0FBQTtBQUU1RCxRQUFBLEtBQUs3TCxJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLEdBQUdtQixTQUFTLENBQUNNLE1BQU0sRUFBRXpCLElBQUksRUFBRSxFQUFFO0FBRTVDLFVBQUEsTUFBTWtMLFFBQVEsR0FBRy9KLFNBQVMsQ0FBQ25CLElBQUksQ0FBQyxDQUFBO1VBQ2hDMlIsR0FBRyxHQUFHekcsUUFBUSxDQUFDakcsYUFBYSxDQUFBO0FBRTVCLFVBQUEsTUFBTXlKLGdCQUFnQixHQUFHLElBQUksQ0FBQ0YseUJBQXlCLENBQUMzQyxTQUFTLEVBQUVYLFFBQVEsRUFBRW9DLFNBQVMsRUFBRW1CLFlBQVksQ0FBQyxDQUFBO1VBQ3JHLElBQUksQ0FBQ0MsZ0JBQWdCLEVBQUU7QUFDbkIsWUFBQSxTQUFBO0FBQ0osV0FBQTtVQUVBLElBQUksQ0FBQ1UsZUFBZSxDQUFDQyxVQUFVLEVBQUV4RCxTQUFTLENBQUNELEtBQUssQ0FBQyxDQUFBO0FBRWpELFVBQUEsSUFBSTFMLHdCQUF3QixFQUFFO1lBQzFCLElBQUksQ0FBQ3ZELFFBQVEsQ0FBQ3lWLGlCQUFpQixDQUFDN08sTUFBTSxDQUFDOEwsVUFBVSxDQUFDOUIsY0FBYyxDQUFDLEVBQUU4QixVQUFVLENBQUNDLGNBQWMsQ0FBQyxFQUFFLElBQUksQ0FBQ25QLGNBQWMsQ0FBQyxDQUFBO0FBQ3ZILFdBQUE7O0FBRUE7VUFDQXFQLGlCQUFpQixHQUFHLElBQUksQ0FBQ0QsZUFBZSxDQUFDQyxpQkFBaUIsRUFBRXJKLE9BQU8sRUFBRTBGLFNBQVMsQ0FBQyxDQUFBO0FBRS9FLFVBQUEsSUFBSTNMLHdCQUF3QixFQUFFO0FBQzFCLFlBQUEsTUFBTW1TLGFBQWEsR0FBR2hELFVBQVUsQ0FBQzlCLGNBQWMsQ0FBQyxDQUFDK0UsTUFBTSxDQUFDakQsVUFBVSxDQUFDQyxjQUFjLENBQUMsQ0FBQyxDQUFBO0FBQ25GLFlBQUEsSUFBSSxDQUFDdE8sYUFBYSxDQUFDdUMsTUFBTSxDQUFDOE8sYUFBYSxFQUFFLElBQUksQ0FBQzNWLEtBQUssQ0FBQzZWLGVBQWUsRUFBRSxJQUFJLENBQUNwUyxjQUFjLENBQUMsQ0FBQTtBQUM3RixXQUFBOztBQUVBO0FBQ0EsVUFBQSxJQUFJLENBQUNnTixlQUFlLENBQUN3RSxHQUFHLENBQUMsQ0FBQTtVQUV6QixLQUFLaFEsSUFBSSxHQUFHLENBQUMsRUFBRUEsSUFBSSxHQUFHOEIsU0FBUyxFQUFFOUIsSUFBSSxFQUFFLEVBQUU7QUFFckM7QUFDQSxZQUFBLElBQUlBLElBQUksR0FBRyxDQUFDLElBQUlzUSxpQkFBaUIsR0FBRyxDQUFDLEVBQUU7QUFDbkMsY0FBQSxNQUFBO0FBQ0osYUFBQTs7QUFFQTtBQUNBLFlBQUEsSUFBSUosY0FBYyxJQUFJbFEsSUFBSSxHQUFHLENBQUMsRUFBRTtBQUM1QixjQUFBLE1BQUE7QUFDSixhQUFBO1lBRUEySSxhQUFhLENBQUNDLGFBQWEsQ0FBQy9OLE1BQU0sRUFBRyxDQUFTbUYsT0FBQUEsRUFBQUEsSUFBSyxFQUFDLENBQUMsQ0FBQTs7QUFFckQ7QUFDQSxZQUFBLE1BQU1tUCxNQUFNLEdBQUc1RixRQUFRLENBQUM1TixhQUFhLENBQUNxRSxJQUFJLENBQUMsQ0FBQTtZQUMzQyxNQUFNd0csWUFBWSxHQUFHK0MsUUFBUSxDQUFDNU4sYUFBYSxDQUFDcUUsSUFBSSxDQUFDLENBQUNMLFdBQVcsQ0FBQ3pDLEtBQUssQ0FBQTs7QUFFbkU7WUFDQSxNQUFNbVMsTUFBTSxHQUFHLElBQUksQ0FBQzFULGFBQWEsQ0FBQzhKLEdBQUcsQ0FBQ2UsWUFBWSxDQUFDLENBQUE7QUFDbkQsWUFBQSxNQUFNOEksT0FBTyxHQUFHRCxNQUFNLENBQUMxUCxXQUFXLENBQUE7WUFFbEMsSUFBSUssSUFBSSxLQUFLLENBQUMsRUFBRTtjQUNaaVEsdUJBQXVCLEdBQUdsVixLQUFLLENBQUM4VixhQUFhLENBQUE7YUFDaEQsTUFBTSxJQUFJWix1QkFBdUIsRUFBRTtjQUNoQ2xWLEtBQUssQ0FBQzhWLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDOUIsYUFBQTtBQUVBLFlBQUEsSUFBSUMsWUFBWSxHQUFHLElBQUksQ0FBQ3hWLGFBQWEsQ0FBQzBFLElBQUksQ0FBQyxDQUFBO0FBQzNDLFlBQUEsSUFBSWtRLGNBQWMsRUFBRTtBQUNoQjtBQUNBLGNBQUEsTUFBTWEsdUJBQXVCLEdBQUdULGlCQUFpQixHQUFHLENBQUMsS0FBS0gsZ0JBQWdCLENBQUE7QUFDMUUsY0FBQSxJQUFJWSx1QkFBdUIsSUFBSS9RLElBQUksS0FBSyxDQUFDLEVBQUU7Z0JBQ3ZDOFEsWUFBWSxHQUFHLElBQUksQ0FBQ3ZWLGlCQUFpQixDQUFBO0FBQ3pDLGVBQUE7QUFDSixhQUFBOztBQUVBO0FBQ0EsWUFBQSxLQUFLeUosQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHZ0wsR0FBRyxDQUFDbFEsTUFBTSxFQUFFa0YsQ0FBQyxFQUFFLEVBQUU7QUFDN0JnTCxjQUFBQSxHQUFHLENBQUNoTCxDQUFDLENBQUMsQ0FBQzlFLFFBQVEsR0FBRzRRLFlBQVksQ0FBQTtBQUNsQyxhQUFBOztBQUVBO0FBQ0EsWUFBQSxJQUFJLENBQUM5VixRQUFRLENBQUM2VixhQUFhLENBQUNiLEdBQUcsQ0FBQyxDQUFBOztBQUVoQztBQUNBLFlBQUEsSUFBSSxDQUFDaFYsUUFBUSxDQUFDZ1csU0FBUyxDQUFDLElBQUksQ0FBQ3RULE1BQU0sRUFBRTJSLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUVsRCxJQUFJclAsSUFBSSxLQUFLeEYsUUFBUSxFQUFFO0FBQ25CLGNBQUEsSUFBSSxDQUFDcUMsZUFBZSxDQUFDb1UsUUFBUSxDQUFDL0csU0FBUyxDQUFDRCxLQUFLLENBQUNtRyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2xFLGFBQUE7O0FBRUE7QUFDQSxZQUFBLElBQUk3Uix3QkFBd0IsRUFBRTtBQUMxQixjQUFBLElBQUksQ0FBQ2MsYUFBYSxDQUFDNlIsUUFBUSxFQUFFLENBQUE7QUFDakMsYUFBQTtBQUVBLFlBQUEsSUFBSSxDQUFDbFcsUUFBUSxDQUFDbVcsWUFBWSxHQUFHLENBQUMsQ0FBQTtBQUM5QixZQUFBLElBQUksQ0FBQ25XLFFBQVEsQ0FBQ29XLGNBQWMsR0FBRyxDQUFDLENBQUE7QUFFaEMsWUFBQSxJQUFJLENBQUNwVyxRQUFRLENBQUNxVyxhQUFhLENBQUMsSUFBSSxDQUFDM1QsTUFBTSxFQUFFc1MsR0FBRyxFQUFFQSxHQUFHLENBQUNsUSxNQUFNLEVBQUU0TixVQUFVLEVBQUU0RCxpQkFBaUIsQ0FBQyxDQUFBO1lBRXhGelcsTUFBTSxDQUFDMFcsU0FBUyxFQUFFLENBQUE7WUFHbEIsSUFBSSxDQUFDMVYsS0FBSyxDQUFDTSxhQUFhLElBQUksSUFBSSxDQUFDbkIsUUFBUSxDQUFDb1csY0FBYyxDQUFBO1lBQ3hELElBQUksQ0FBQ3ZWLEtBQUssQ0FBQ0ksV0FBVyxJQUFJLElBQUksQ0FBQ2pCLFFBQVEsQ0FBQ21XLFlBQVksQ0FBQTtBQUNwRCxZQUFBLElBQUksQ0FBQ3RWLEtBQUssQ0FBQ0MsWUFBWSxFQUFFLENBQUE7O0FBR3pCO0FBQ0F5TixZQUFBQSxRQUFRLENBQUM1TixhQUFhLENBQUNxRSxJQUFJLENBQUMsR0FBR3FQLE1BQU0sQ0FBQTs7QUFFckM7WUFDQSxJQUFJLENBQUMxVCxhQUFhLENBQUNrQyxHQUFHLENBQUMySSxZQUFZLEVBQUUySSxNQUFNLENBQUMsQ0FBQTtBQUU1QyxZQUFBLEtBQUtuSyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdnTCxHQUFHLENBQUNsUSxNQUFNLEVBQUVrRixDQUFDLEVBQUUsRUFBRTtBQUM3QnFHLGNBQUFBLENBQUMsR0FBRzJFLEdBQUcsQ0FBQ2hMLENBQUMsQ0FBQyxDQUFBO0FBQ1ZxRyxjQUFBQSxDQUFDLENBQUM5RCxtQkFBbUIsQ0FBQ0MsWUFBWSxDQUFDQyxrQkFBa0IsQ0FBQ3pILElBQUksQ0FBQyxFQUFFc1AsT0FBTyxDQUFDLENBQUM7QUFDdEVqRSxjQUFBQSxDQUFDLENBQUNuRSxXQUFXLElBQUk4QixZQUFZLENBQUM7QUFDbEMsYUFBQTs7QUFFQUwsWUFBQUEsYUFBYSxDQUFDUyxZQUFZLENBQUN2TyxNQUFNLENBQUMsQ0FBQTtBQUN0QyxXQUFBOztBQUVBO0FBQ0EsVUFBQSxJQUFJLENBQUM0USxnQkFBZ0IsQ0FBQ3VFLEdBQUcsQ0FBQyxDQUFBO0FBQzlCLFNBQUE7QUFFQTlGLFFBQUFBLFNBQVMsQ0FBQ3NILE9BQU8sQ0FBQyxJQUFJLENBQUN0VyxjQUFjLENBQUMsQ0FBQTtBQUV0Q3lOLFFBQUFBLGFBQWEsQ0FBQ1MsWUFBWSxDQUFDdk8sTUFBTSxDQUFDLENBQUE7QUFDdEMsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUNzVCxtQkFBbUIsQ0FBQ3RULE1BQU0sRUFBRTJFLFNBQVMsRUFBRXNDLFNBQVMsQ0FBQyxDQUFBOztBQUV0RDtBQUNBLElBQUEsS0FBS3pELElBQUksR0FBRyxDQUFDLEVBQUVBLElBQUksR0FBRzRFLFFBQVEsQ0FBQ25ELE1BQU0sRUFBRXpCLElBQUksRUFBRSxFQUFFO0FBQzNDNEUsTUFBQUEsUUFBUSxDQUFDNUUsSUFBSSxDQUFDLENBQUN1TSxPQUFPLEVBQUUsQ0FBQTtBQUM1QixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUNELGFBQWEsQ0FBQ2YsU0FBUyxDQUFDLENBQUE7SUFDN0IsSUFBSSxDQUFDc0IsWUFBWSxFQUFFLENBQUE7O0FBRW5CO0FBQ0E7SUFDQSxJQUFJLENBQUMzTSx3QkFBd0IsRUFBRTtBQUMzQixNQUFBLElBQUksQ0FBQ3JELGNBQWMsQ0FBQzJFLEtBQUssRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBO0FBQ0o7Ozs7In0=
