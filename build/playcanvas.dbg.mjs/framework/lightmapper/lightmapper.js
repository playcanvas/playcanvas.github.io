/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
import { drawQuadWithShader } from '../../platform/graphics/simple-post-effect.js';
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

class Lightmapper {
  constructor(device, root, scene, renderer, assets) {
    this.device = device;
    this.root = root;
    this.scene = scene;
    this.renderer = renderer;
    this.assets = assets;
    this.shadowMapCache = renderer.shadowMapCache;
    this._tempSet = new Set();
    this._initCalled = false;

    this.passMaterials = [];
    this.ambientAOMaterial = null;
    this.fog = '';
    this.ambientLight = new Color();

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
    LightmapCache.decRef(this.blackTex);
    this.blackTex = null;

    LightmapCache.destroy();
    this.device = null;
    this.root = null;
    this.scene = null;
    this.renderer = null;
    this.assets = null;
  }
  initBake(device) {
    if (!this._initCalled) {
      this._initCalled = true;

      this.lightmapFilters = new LightmapFilters(device);

      this.constantBakeDir = device.scope.resolve('bakeDir');
      this.materials = [];

      this.blackTex = new Texture(this.device, {
        width: 4,
        height: 4,
        format: PIXELFORMAT_RGBA8,
        type: TEXTURETYPE_RGBM,
        name: 'lightmapBlack'
      });

      LightmapCache.incRef(this.blackTex);

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

    if (this.scene.clusteredLightingEnabled) {
      const lightingParams = new LightingParams(device.supportsAreaLights, device.maxTextureSize, () => {});
      this.lightingParams = lightingParams;
      const srcParams = this.scene.lighting;
      lightingParams.shadowsEnabled = srcParams.shadowsEnabled;
      lightingParams.shadowAtlasResolution = srcParams.shadowAtlasResolution;
      lightingParams.cookiesEnabled = srcParams.cookiesEnabled;
      lightingParams.cookieAtlasResolution = srcParams.cookieAtlasResolution;
      lightingParams.areaLightsEnabled = srcParams.areaLightsEnabled;

      lightingParams.cells = new Vec3(3, 3, 3);
      lightingParams.maxLightsPerCell = 4;
      this.worldClusters = new WorldClusters(device);
      this.worldClusters.name = 'ClusterLightmapper';
    }
  }
  finishBake(bakeNodes) {
    this.materials = [];
    function destroyRT(rt) {
      LightmapCache.decRef(rt.colorBuffer);

      rt.destroy();
    }

    this.renderTargets.forEach(rt => {
      destroyRT(rt);
    });
    this.renderTargets.clear();

    bakeNodes.forEach(node => {
      node.renderTargets.forEach(rt => {
        destroyRT(rt);
      });
      node.renderTargets.length = 0;
    });

    this.ambientAOMaterial = null;

    if (this.worldClusters) {
      this.worldClusters.destroy();
      this.worldClusters = null;
    }
  }
  createMaterialForPass(device, scene, pass, addAmbient) {
    const material = new StandardMaterial();
    material.name = `lmMaterial-pass:${pass}-ambient:${addAmbient}`;
    material.chunks.APIVersion = CHUNKAPI_1_55;
    material.chunks.transformVS = '#define UV1LAYOUT\n' + shaderChunks.transformVS;

    if (pass === PASS_COLOR) {
      let bakeLmEndChunk = shaderChunksLightmapper.bakeLmEndPS;
      if (addAmbient) {
        bakeLmEndChunk = `
                    dDiffuseLight = ((dDiffuseLight - 0.5) * max(${scene.ambientBakeOcclusionContrast.toFixed(1)} + 1.0, 0.0)) + 0.5;
                    dDiffuseLight += vec3(${scene.ambientBakeOcclusionBrightness.toFixed(1)});
                    dDiffuseLight = saturate(dDiffuseLight);
                    dDiffuseLight *= dAmbientLight;
                ` + bakeLmEndChunk;
      } else {
        material.ambient = new Color(0, 0, 0);
        material.ambientTint = true;
      }
      material.chunks.basePS = shaderChunks.basePS + (scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? '\n#define LIGHTMAP_RGBM\n' : '');
      material.chunks.endPS = bakeLmEndChunk;
      material.lightMap = this.blackTex;
    } else {
      material.chunks.basePS = shaderChunks.basePS + '\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n';
      material.chunks.endPS = shaderChunksLightmapper.bakeDirLmEndPS;
    }

    material.chunks.outputAlphaPS = '\n';
    material.chunks.outputAlphaOpaquePS = '\n';
    material.chunks.outputAlphaPremulPS = '\n';
    material.cull = CULLFACE_NONE;
    material.forceUv1 = true;
    material.update();
    return material;
  }
  createMaterials(device, scene, passCount) {
    for (let pass = 0; pass < passCount; pass++) {
      if (!this.passMaterials[pass]) {
        this.passMaterials[pass] = this.createMaterialForPass(device, scene, pass, false);
      }
    }

    if (!this.ambientAOMaterial) {
      this.ambientAOMaterial = this.createMaterialForPass(device, scene, 0, true);
      this.ambientAOMaterial.onUpdateShader = function (options) {
        options.litOptions.lightMapWithoutAmbient = true;
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

  collectModels(node, bakeNodes, allNodes) {
    var _node$model, _node$model2, _node$render;
    if (!node.enabled) return;

    let meshInstances;
    if ((_node$model = node.model) != null && _node$model.model && (_node$model2 = node.model) != null && _node$model2.enabled) {
      if (allNodes) allNodes.push(new BakeMeshNode(node));
      if (node.model.lightmapped) {
        if (bakeNodes) {
          meshInstances = node.model.model.meshInstances;
        }
      }
    }

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

          if (this._tempSet.has(mesh)) {
            bakeNodes.push(new BakeMeshNode(node, [meshInstances[i]]));
          } else {
            notInstancedMeshInstances.push(meshInstances[i]);
          }
          this._tempSet.add(mesh);
        }
        this._tempSet.clear();

        if (notInstancedMeshInstances.length > 0) {
          bakeNodes.push(new BakeMeshNode(node, notInstancedMeshInstances));
        }
      }
    }
    for (let i = 0; i < node._children.length; i++) {
      this.collectModels(node._children[i], bakeNodes, allNodes);
    }
  }

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

  updateTransforms(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const meshInstances = nodes[i].meshInstances;
      for (let j = 0; j < meshInstances.length; j++) {
        meshInstances[j].node.getWorldTransform();
      }
    }
  }

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

    const component = node.render || node.model;
    const bounds = this.computeNodeBounds(component.meshInstances);

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

          meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;

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

  bake(nodes, mode = BAKE_COLORDIR) {
    const device = this.device;
    const startTime = now();

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

    const bakeNodes = [];

    const allNodes = [];

    if (nodes) {
      for (let i = 0; i < nodes.length; i++) {
        this.collectModels(nodes[i], bakeNodes, null);
      }

      this.collectModels(this.root, null, allNodes);
    } else {
      this.collectModels(this.root, bakeNodes, allNodes);
    }
    DebugGraphics.pushGpuMarker(this.device, 'LMBake');

    if (bakeNodes.length > 0) {
      const passCount = mode === BAKE_COLORDIR ? 2 : 1;
      this.setLightmapping(bakeNodes, false, passCount);
      this.initBake(device);
      this.bakeInternal(passCount, bakeNodes, allNodes);

      let shaderDefs = SHADERDEF_LM;
      if (mode === BAKE_COLORDIR) {
        shaderDefs |= SHADERDEF_DIRLM;
      }

      if (this.scene.ambientBake) {
        shaderDefs |= SHADERDEF_LMAMBIENT;
      }
      this.setLightmapping(bakeNodes, true, passCount, shaderDefs);

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

  allocateTextures(bakeNodes, passCount) {
    for (let i = 0; i < bakeNodes.length; i++) {
      const bakeNode = bakeNodes[i];
      const size = this.calculateLightmapSize(bakeNode.node);

      for (let pass = 0; pass < passCount; pass++) {
        const tex = this.createTexture(size, 'lightmapper_lightmap_' + i);
        LightmapCache.incRef(tex);
        bakeNode.renderTargets[pass] = new RenderTarget({
          colorBuffer: tex,
          depth: false
        });
      }

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
    if (this.scene.ambientBake) {
      const ambientLight = new BakeLightAmbient(this.scene);
      bakeLights.push(ambientLight);
    }

    const sceneLights = layerComposition._lights;
    for (let i = 0; i < sceneLights.length; i++) {
      const light = sceneLights[i];

      const bakeLight = new BakeLightSimple(this.scene, light);
      allLights.push(bakeLight);

      if (light.enabled && (light.mask & MASK_BAKE) !== 0) {
        light.isStatic = false;
        light.mask = 0xFFFFFFFF;
        light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
        bakeLights.push(bakeLight);
      }
    }

    bakeLights.sort();
  }
  restoreLights(allLights) {
    for (let i = 0; i < allLights.length; i++) {
      allLights[i].restore();
    }
  }
  setupScene() {
    this.revertStatic = false;
    if (this.scene._needsStaticPrepare) {
      this.scene._needsStaticPrepare = false;
      this.revertStatic = true;
    }

    this.fog = this.scene.fog;
    this.ambientLight.copy(this.scene.ambientLight);

    this.scene.fog = FOG_NONE;

    if (!this.scene.ambientBake) {
      this.scene.ambientLight.set(0, 0, 0);
    }

    this.renderer.setSceneConstants();
  }
  restoreScene() {
    this.scene.fog = this.fog;
    this.scene.ambientLight.copy(this.ambientLight);

    if (this.revertStatic) {
      this.scene._needsStaticPrepare = true;
    }
  }

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

  computeNodesBounds(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const meshInstances = nodes[i].meshInstances;
      nodes[i].bounds = this.computeNodeBounds(meshInstances);
    }
  }

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

  lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds) {
    const light = bakeLight.light;
    let lightAffectsNode = true;
    if (light.type === LIGHTTYPE_DIRECTIONAL) {
      tempVec.copy(casterBounds.center);
      tempVec.y += casterBounds.halfExtents.y;
      this.camera.node.setPosition(tempVec);
      this.camera.node.setEulerAngles(-90, 0, 0);
      this.camera.nearClip = 0;
      this.camera.farClip = casterBounds.halfExtents.y * 2;
      const frustumSize = Math.max(casterBounds.halfExtents.x, casterBounds.halfExtents.z);
      this.camera.orthoHeight = frustumSize;
    } else {
      if (!bakeLight.lightBounds.intersects(bakeNode.bounds)) {
        lightAffectsNode = false;
      }
    }

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
      if (!light.shadowMap && !this.scene.clusteredLightingEnabled) {
        light.shadowMap = this.shadowMapCache.get(this.device, light);
      }
      if (light.type === LIGHTTYPE_DIRECTIONAL) {
        this.renderer._shadowRendererDirectional.cull(light, casters, this.camera);
        this.renderer._shadowRendererDirectional.render(light, this.camera);
      } else {
        this.renderer._shadowRendererLocal.cull(light, casters);
        this.renderer.renderShadowsLocal(lightArray[light.type], this.camera);
      }
    }
    return true;
  }
  postprocessTextures(device, bakeNodes, passCount) {
    const numDilates2x = 1;
    const dilateShader = this.lightmapFilters.shaderDilate;

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

    scene.layers._update();

    this.computeNodesBounds(bakeNodes);

    this.allocateTextures(bakeNodes, passCount);

    const allLights = [],
      bakeLights = [];
    this.prepareLightsToBake(scene.layers, allLights, bakeLights);

    this.updateTransforms(allNodes);

    const casters = this.prepareShadowCasters(allNodes);

    this.renderer.updateCpuSkinMatrices(casters);
    this.renderer.gpuUpdate(casters);

    const casterBounds = this.computeBounds(casters);
    let i, j, rcv, m;

    for (i = 0; i < bakeNodes.length; i++) {
      const bakeNode = bakeNodes[i];
      rcv = bakeNode.meshInstances;
      for (j = 0; j < rcv.length; j++) {
        m = rcv[j];
        m.setLightmapped(false);
        m.mask = MASK_BAKE;

        m.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], m.material.lightMap ? m.material.lightMap : this.blackTex);
        m.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], this.blackTex);
      }
    }

    for (j = 0; j < bakeLights.length; j++) {
      bakeLights[j].light.enabled = false;
    }
    const lightArray = [[], [], []];
    let pass, node;
    let shadersUpdatedOn1stPass = false;

    for (i = 0; i < bakeLights.length; i++) {
      const bakeLight = bakeLights[i];
      const isAmbientLight = bakeLight instanceof BakeLightAmbient;

      let numVirtualLights = bakeLight.numVirtualLights;

      if (passCount > 1 && numVirtualLights > 1 && bakeLight.light.bakeDir) {
        numVirtualLights = 1;
        Debug.warn('Lightmapper\'s BAKE_COLORDIR mode is not compatible with Light\'s bakeNumSamples larger than one. Forcing it to one.');
      }
      for (let virtualLightIndex = 0; virtualLightIndex < numVirtualLights; virtualLightIndex++) {
        DebugGraphics.pushGpuMarker(device, `Light:${bakeLight.light._node.name}:${virtualLightIndex}`);

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

          shadowMapRendered = this.renderShadowMap(shadowMapRendered, casters, lightArray, bakeLight);
          if (clusteredLightingEnabled) {
            const clusterLights = lightArray[LIGHTTYPE_SPOT].concat(lightArray[LIGHTTYPE_OMNI]);
            this.worldClusters.update(clusterLights, this.scene.gammaCorrection, this.lightingParams);
          }

          this.backupMaterials(rcv);
          for (pass = 0; pass < passCount; pass++) {
            if (pass > 0 && virtualLightIndex > 0) {
              break;
            }

            if (isAmbientLight && pass > 0) {
              break;
            }
            DebugGraphics.pushGpuMarker(device, `LMPass:${pass}`);

            const nodeRT = bakeNode.renderTargets[pass];
            const lightmapSize = bakeNode.renderTargets[pass].colorBuffer.width;

            const tempRT = this.renderTargets.get(lightmapSize);
            const tempTex = tempRT.colorBuffer;
            if (pass === 0) {
              shadersUpdatedOn1stPass = scene.updateShaders;
            } else if (shadersUpdatedOn1stPass) {
              scene.updateShaders = true;
            }
            let passMaterial = this.passMaterials[pass];
            if (isAmbientLight) {
              const lastVirtualLightForPass = virtualLightIndex + 1 === numVirtualLights;
              if (lastVirtualLightForPass && pass === 0) {
                passMaterial = this.ambientAOMaterial;
              }
            }

            for (j = 0; j < rcv.length; j++) {
              rcv[j].material = passMaterial;
            }

            this.renderer.updateShaders(rcv);

            this.renderer.setCamera(this.camera, tempRT, true);
            if (pass === PASS_DIR) {
              this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
            }

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

            bakeNode.renderTargets[pass] = tempRT;

            this.renderTargets.set(lightmapSize, nodeRT);
            for (j = 0; j < rcv.length; j++) {
              m = rcv[j];
              m.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tempTex);
              m._shaderDefs |= SHADERDEF_LM;
            }

            DebugGraphics.popGpuMarker(device);
          }

          this.restoreMaterials(rcv);
        }
        bakeLight.endBake(this.shadowMapCache);
        DebugGraphics.popGpuMarker(device);
      }
    }
    this.postprocessTextures(device, bakeNodes, passCount);

    for (node = 0; node < allNodes.length; node++) {
      allNodes[node].restore();
    }
    this.restoreLights(allLights);
    this.restoreScene();

    if (!clusteredLightingEnabled) {
      this.shadowMapCache.clear();
    }
  }
}

export { Lightmapper };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvbGlnaHRtYXBwZXIvbGlnaHRtYXBwZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBDSFVOS0FQSV8xXzU1LFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1QsXG4gICAgUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaW1wbGUtcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IExpZ2h0aW5nUGFyYW1zIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHRpbmcvbGlnaHRpbmctcGFyYW1zLmpzJztcbmltcG9ydCB7IFdvcmxkQ2x1c3RlcnMgfSBmcm9tICcuLi8uLi9zY2VuZS9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MtbGlnaHRtYXBwZXIuanMnO1xuXG5pbXBvcnQge1xuICAgIEJBS0VfQ09MT1JESVIsXG4gICAgRk9HX05PTkUsXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsXG4gICAgUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUsXG4gICAgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX0RJUkxNLCBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9MTUFNQklFTlQsXG4gICAgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBTSEFET1dVUERBVEVfUkVBTFRJTUUsIFNIQURPV1VQREFURV9USElTRlJBTUVcbn0gZnJvbSAnLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENhbWVyYSB9IGZyb20gJy4uLy4uL3NjZW5lL2NhbWVyYS5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi8uLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQgeyBCYWtlTGlnaHRTaW1wbGUgfSBmcm9tICcuL2Jha2UtbGlnaHQtc2ltcGxlLmpzJztcbmltcG9ydCB7IEJha2VMaWdodEFtYmllbnQgfSBmcm9tICcuL2Jha2UtbGlnaHQtYW1iaWVudC5qcyc7XG5pbXBvcnQgeyBCYWtlTWVzaE5vZGUgfSBmcm9tICcuL2Jha2UtbWVzaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwQ2FjaGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcEZpbHRlcnMgfSBmcm9tICcuL2xpZ2h0bWFwLWZpbHRlcnMuanMnO1xuXG5jb25zdCBNQVhfTElHSFRNQVBfU0laRSA9IDIwNDg7XG5cbmNvbnN0IFBBU1NfQ09MT1IgPSAwO1xuY29uc3QgUEFTU19ESVIgPSAxO1xuXG5jb25zdCB0ZW1wVmVjID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBUaGUgbGlnaHRtYXBwZXIgaXMgdXNlZCB0byBiYWtlIHNjZW5lIGxpZ2h0cyBpbnRvIHRleHR1cmVzLlxuICovXG5jbGFzcyBMaWdodG1hcHBlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IExpZ2h0bWFwcGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgbGlnaHRtYXBwZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eX0gcm9vdCAtIFRoZSByb290IGVudGl0eSBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3NjZW5lL3NjZW5lLmpzJykuU2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lIHRvIGxpZ2h0bWFwLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJykuRm9yd2FyZFJlbmRlcmVyfSByZW5kZXJlciAtIFRoZVxuICAgICAqIHJlbmRlcmVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcycpLkFzc2V0UmVnaXN0cnl9IGFzc2V0cyAtIFJlZ2lzdHJ5IG9mIGFzc2V0cyB0b1xuICAgICAqIGxpZ2h0bWFwLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIHJvb3QsIHNjZW5lLCByZW5kZXJlciwgYXNzZXRzKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLnJvb3QgPSByb290O1xuICAgICAgICB0aGlzLnNjZW5lID0gc2NlbmU7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSByZW5kZXJlcjtcbiAgICAgICAgdGhpcy5hc3NldHMgPSBhc3NldHM7XG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUgPSByZW5kZXJlci5zaGFkb3dNYXBDYWNoZTtcblxuICAgICAgICB0aGlzLl90ZW1wU2V0ID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9pbml0Q2FsbGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gaW50ZXJuYWwgbWF0ZXJpYWxzIHVzZWQgYnkgYmFraW5nXG4gICAgICAgIHRoaXMucGFzc01hdGVyaWFscyA9IFtdO1xuICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsID0gbnVsbDtcblxuICAgICAgICB0aGlzLmZvZyA9ICcnO1xuICAgICAgICB0aGlzLmFtYmllbnRMaWdodCA9IG5ldyBDb2xvcigpO1xuXG4gICAgICAgIC8vIGRpY3Rpb25hcnkgb2Ygc3BhcmUgcmVuZGVyIHRhcmdldHMgd2l0aCBjb2xvciBidWZmZXIgZm9yIGVhY2ggdXNlZCBzaXplXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cyA9IG5ldyBNYXAoKTtcblxuICAgICAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgICAgICAgcmVuZGVyUGFzc2VzOiAwLFxuICAgICAgICAgICAgbGlnaHRtYXBDb3VudDogMCxcbiAgICAgICAgICAgIHRvdGFsUmVuZGVyVGltZTogMCxcbiAgICAgICAgICAgIGZvcndhcmRUaW1lOiAwLFxuICAgICAgICAgICAgZmJvVGltZTogMCxcbiAgICAgICAgICAgIHNoYWRvd01hcFRpbWU6IDAsXG4gICAgICAgICAgICBjb21waWxlVGltZTogMCxcbiAgICAgICAgICAgIHNoYWRlcnNMaW5rZWQ6IDBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIC8vIHJlbGVhc2UgcmVmZXJlbmNlIHRvIHRoZSB0ZXh0dXJlXG4gICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKHRoaXMuYmxhY2tUZXgpO1xuICAgICAgICB0aGlzLmJsYWNrVGV4ID0gbnVsbDtcblxuICAgICAgICAvLyBkZXN0cm95IGFsbCBsaWdodG1hcHNcbiAgICAgICAgTGlnaHRtYXBDYWNoZS5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5kZXZpY2UgPSBudWxsO1xuICAgICAgICB0aGlzLnJvb3QgPSBudWxsO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG51bGw7XG4gICAgICAgIHRoaXMuYXNzZXRzID0gbnVsbDtcbiAgICB9XG5cbiAgICBpbml0QmFrZShkZXZpY2UpIHtcblxuICAgICAgICAvLyBvbmx5IGluaXRpYWxpemUgb25lIHRpbWVcbiAgICAgICAgaWYgKCF0aGlzLl9pbml0Q2FsbGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pbml0Q2FsbGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gbGlnaHRtYXAgZmlsdGVyaW5nIHNoYWRlcnNcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzID0gbmV3IExpZ2h0bWFwRmlsdGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAvLyBzaGFkZXIgcmVsYXRlZFxuICAgICAgICAgICAgdGhpcy5jb25zdGFudEJha2VEaXIgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnYmFrZURpcicpO1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbHMgPSBbXTtcblxuICAgICAgICAgICAgLy8gc21hbGwgYmxhY2sgdGV4dHVyZVxuICAgICAgICAgICAgdGhpcy5ibGFja1RleCA9IG5ldyBUZXh0dXJlKHRoaXMuZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IDQsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiA0LFxuICAgICAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgICAgICAgICAgICAgdHlwZTogVEVYVFVSRVRZUEVfUkdCTSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnbGlnaHRtYXBCbGFjaydcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBpbmNyZWYgYmxhY2sgdGV4dHVyZSBpbiB0aGUgY2FjaGUgdG8gYXZvaWQgaXQgYmVpbmcgZGVzdHJveWVkXG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0aGlzLmJsYWNrVGV4KTtcblxuICAgICAgICAgICAgLy8gY2FtZXJhIHVzZWQgZm9yIGJha2luZ1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbmV3IENhbWVyYSgpO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyQ29sb3Iuc2V0KDAsIDAsIDAsIDApO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXIgPSB0cnVlO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtQ3VsbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgY2FtZXJhLnByb2plY3Rpb24gPSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQztcbiAgICAgICAgICAgIGNhbWVyYS5hc3BlY3RSYXRpbyA9IDE7XG4gICAgICAgICAgICBjYW1lcmEubm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGxpZ2h0IGNsdXN0ZXIgc3RydWN0dXJlXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgbGlnaHQgcGFyYW1zLCBhbmQgYmFzZSBtb3N0IHBhcmFtZXRlcnMgb24gdGhlIGxpZ2h0aW5nIHBhcmFtcyBvZiB0aGUgc2NlbmVcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0aW5nUGFyYW1zID0gbmV3IExpZ2h0aW5nUGFyYW1zKGRldmljZS5zdXBwb3J0c0FyZWFMaWdodHMsIGRldmljZS5tYXhUZXh0dXJlU2l6ZSwgKCkgPT4ge30pO1xuICAgICAgICAgICAgdGhpcy5saWdodGluZ1BhcmFtcyA9IGxpZ2h0aW5nUGFyYW1zO1xuXG4gICAgICAgICAgICBjb25zdCBzcmNQYXJhbXMgPSB0aGlzLnNjZW5lLmxpZ2h0aW5nO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuc2hhZG93c0VuYWJsZWQgPSBzcmNQYXJhbXMuc2hhZG93c0VuYWJsZWQ7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5zaGFkb3dBdGxhc1Jlc29sdXRpb24gPSBzcmNQYXJhbXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuXG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5jb29raWVzRW5hYmxlZCA9IHNyY1BhcmFtcy5jb29raWVzRW5hYmxlZDtcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmNvb2tpZUF0bGFzUmVzb2x1dGlvbiA9IHNyY1BhcmFtcy5jb29raWVBdGxhc1Jlc29sdXRpb247XG5cbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmFyZWFMaWdodHNFbmFibGVkID0gc3JjUGFyYW1zLmFyZWFMaWdodHNFbmFibGVkO1xuXG4gICAgICAgICAgICAvLyBzb21lIGN1c3RvbSBsaWdodG1hcHBpbmcgcGFyYW1zIC0gd2UgYmFrZSBzaW5nbGUgbGlnaHQgYSB0aW1lXG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5jZWxscyA9IG5ldyBWZWMzKDMsIDMsIDMpO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMubWF4TGlnaHRzUGVyQ2VsbCA9IDQ7XG5cbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycyA9IG5ldyBXb3JsZENsdXN0ZXJzKGRldmljZSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMubmFtZSA9ICdDbHVzdGVyTGlnaHRtYXBwZXInO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZmluaXNoQmFrZShiYWtlTm9kZXMpIHtcblxuICAgICAgICB0aGlzLm1hdGVyaWFscyA9IFtdO1xuXG4gICAgICAgIGZ1bmN0aW9uIGRlc3Ryb3lSVChydCkge1xuICAgICAgICAgICAgLy8gdGhpcyBjYW4gY2F1c2UgcmVmIGNvdW50IHRvIGJlIDAgYW5kIHRleHR1cmUgZGVzdHJveWVkXG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZihydC5jb2xvckJ1ZmZlcik7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgcmVuZGVyIHRhcmdldCBpdHNlbGZcbiAgICAgICAgICAgIHJ0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNwYXJlIHJlbmRlciB0YXJnZXRzIGluY2x1ZGluZyBjb2xvciBidWZmZXJcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLmZvckVhY2goKHJ0KSA9PiB7XG4gICAgICAgICAgICBkZXN0cm95UlQocnQpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLmNsZWFyKCk7XG5cbiAgICAgICAgLy8gZGVzdHJveSByZW5kZXIgdGFyZ2V0cyBmcm9tIG5vZGVzIChidXQgbm90IGNvbG9yIGJ1ZmZlcilcbiAgICAgICAgYmFrZU5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyVGFyZ2V0cy5mb3JFYWNoKChydCkgPT4ge1xuICAgICAgICAgICAgICAgIGRlc3Ryb3lSVChydCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyVGFyZ2V0cy5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyB0aGlzIHNoYWRlciBpcyBvbmx5IHZhbGlkIGZvciBzcGVjaWZpYyBicmlnaHRuZXNzIGFuZCBjb250cmFzdCB2YWx1ZXMsIGRpc3Bvc2UgaXRcbiAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVsZXRlIGxpZ2h0IGNsdXN0ZXJcbiAgICAgICAgaWYgKHRoaXMud29ybGRDbHVzdGVycykge1xuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVNYXRlcmlhbEZvclBhc3MoZGV2aWNlLCBzY2VuZSwgcGFzcywgYWRkQW1iaWVudCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBgbG1NYXRlcmlhbC1wYXNzOiR7cGFzc30tYW1iaWVudDoke2FkZEFtYmllbnR9YDtcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLkFQSVZlcnNpb24gPSBDSFVOS0FQSV8xXzU1O1xuICAgICAgICBtYXRlcmlhbC5jaHVua3MudHJhbnNmb3JtVlMgPSAnI2RlZmluZSBVVjFMQVlPVVRcXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTOyAvLyBkcmF3IFVWMVxuXG4gICAgICAgIGlmIChwYXNzID09PSBQQVNTX0NPTE9SKSB7XG4gICAgICAgICAgICBsZXQgYmFrZUxtRW5kQ2h1bmsgPSBzaGFkZXJDaHVua3NMaWdodG1hcHBlci5iYWtlTG1FbmRQUzsgLy8gZW5jb2RlIHRvIFJHQk1cbiAgICAgICAgICAgIGlmIChhZGRBbWJpZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gZGlmZnVzZSBsaWdodCBzdG9yZXMgYWNjdW11bGF0ZWQgQU8sIGFwcGx5IGNvbnRyYXN0IGFuZCBicmlnaHRuZXNzIHRvIGl0XG4gICAgICAgICAgICAgICAgLy8gYW5kIG11bHRpcGx5IGFtYmllbnQgbGlnaHQgY29sb3IgYnkgdGhlIEFPXG4gICAgICAgICAgICAgICAgYmFrZUxtRW5kQ2h1bmsgPSBgXG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgPSAoKGREaWZmdXNlTGlnaHQgLSAwLjUpICogbWF4KCR7c2NlbmUuYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdC50b0ZpeGVkKDEpfSArIDEuMCwgMC4wKSkgKyAwLjU7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgKz0gdmVjMygke3NjZW5lLmFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcy50b0ZpeGVkKDEpfSk7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgPSBzYXR1cmF0ZShkRGlmZnVzZUxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgZERpZmZ1c2VMaWdodCAqPSBkQW1iaWVudExpZ2h0O1xuICAgICAgICAgICAgICAgIGAgKyBiYWtlTG1FbmRDaHVuaztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYW1iaWVudCA9IG5ldyBDb2xvcigwLCAwLCAwKTsgICAgLy8gZG9uJ3QgYmFrZSBhbWJpZW50XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYW1iaWVudFRpbnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmJhc2VQUyA9IHNoYWRlckNodW5rcy5iYXNlUFMgKyAoc2NlbmUubGlnaHRtYXBQaXhlbEZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTggPyAnXFxuI2RlZmluZSBMSUdIVE1BUF9SR0JNXFxuJyA6ICcnKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5lbmRQUyA9IGJha2VMbUVuZENodW5rO1xuICAgICAgICAgICAgbWF0ZXJpYWwubGlnaHRNYXAgPSB0aGlzLmJsYWNrVGV4O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmJhc2VQUyA9IHNoYWRlckNodW5rcy5iYXNlUFMgKyAnXFxudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9kaXJMaWdodE1hcDtcXG51bmlmb3JtIGZsb2F0IGJha2VEaXI7XFxuJztcbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5lbmRQUyA9IHNoYWRlckNodW5rc0xpZ2h0bWFwcGVyLmJha2VEaXJMbUVuZFBTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXZvaWQgd3JpdGluZyB1bnJlbGF0ZWQgdGhpbmdzIHRvIGFscGhhXG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5vdXRwdXRBbHBoYVBTID0gJ1xcbic7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5vdXRwdXRBbHBoYU9wYXF1ZVBTID0gJ1xcbic7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5vdXRwdXRBbHBoYVByZW11bFBTID0gJ1xcbic7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICBtYXRlcmlhbC5mb3JjZVV2MSA9IHRydWU7IC8vIHByb3ZpZGUgZGF0YSB0byB4Zm9ybVV2MVxuICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgY3JlYXRlTWF0ZXJpYWxzKGRldmljZSwgc2NlbmUsIHBhc3NDb3VudCkge1xuICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucGFzc01hdGVyaWFsc1twYXNzXSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFzc01hdGVyaWFsc1twYXNzXSA9IHRoaXMuY3JlYXRlTWF0ZXJpYWxGb3JQYXNzKGRldmljZSwgc2NlbmUsIHBhc3MsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1hdGVyaWFsIHVzZWQgb24gbGFzdCByZW5kZXIgb2YgYW1iaWVudCBsaWdodCB0byBtdWx0aXBseSBhY2N1bXVsYXRlZCBBTyBpbiBsaWdodG1hcCBieSBhbWJpZW50IGxpZ2h0XG4gICAgICAgIGlmICghdGhpcy5hbWJpZW50QU9NYXRlcmlhbCkge1xuICAgICAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IHRoaXMuY3JlYXRlTWF0ZXJpYWxGb3JQYXNzKGRldmljZSwgc2NlbmUsIDAsIHRydWUpO1xuICAgICAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbC5vblVwZGF0ZVNoYWRlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBMTSBhcyB3aXRob3V0IGFtYmllbnQsIHRvIGFkZCBpdFxuICAgICAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5saWdodE1hcFdpdGhvdXRBbWJpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBhZGQgYW1iaWVudCB0byBkaWZmdXNlIGRpcmVjdGx5IGJ1dCBrZWVwIGl0IHNlcGFyYXRlLCB0byBhbGxvdyBBTyB0byBiZSBtdWx0aXBsaWVkIGluXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLnNlcGFyYXRlQW1iaWVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZShzaXplLCBuYW1lKSB7XG4gICAgICAgIHJldHVybiBuZXcgVGV4dHVyZSh0aGlzLmRldmljZSwge1xuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgcHJvZmlsZXJIaW50OiBURVhISU5UX0xJR0hUTUFQLFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB3aWR0aDogc2l6ZSxcbiAgICAgICAgICAgIGhlaWdodDogc2l6ZSxcbiAgICAgICAgICAgIGZvcm1hdDogdGhpcy5zY2VuZS5saWdodG1hcFBpeGVsRm9ybWF0LFxuICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICB0eXBlOiB0aGlzLnNjZW5lLmxpZ2h0bWFwUGl4ZWxGb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkE4ID8gVEVYVFVSRVRZUEVfUkdCTSA6IFRFWFRVUkVUWVBFX0RFRkFVTFQsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgbmFtZTogbmFtZVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyByZWN1cnNpdmVseSB3YWxrIHRoZSBoaWVyYXJjaHkgb2Ygbm9kZXMgc3RhcnRpbmcgYXQgdGhlIHNwZWNpZmllZCBub2RlXG4gICAgLy8gY29sbGVjdCBhbGwgbm9kZXMgdGhhdCBuZWVkIHRvIGJlIGxpZ2h0bWFwcGVkIHRvIGJha2VOb2RlcyBhcnJheVxuICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIHdpdGggZ2VvbWV0cnkgdG8gYWxsTm9kZXMgYXJyYXlcbiAgICBjb2xsZWN0TW9kZWxzKG5vZGUsIGJha2VOb2RlcywgYWxsTm9kZXMpIHtcbiAgICAgICAgaWYgKCFub2RlLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICAvLyBtZXNoIGluc3RhbmNlcyBmcm9tIG1vZGVsIGNvbXBvbmVudFxuICAgICAgICBsZXQgbWVzaEluc3RhbmNlcztcbiAgICAgICAgaWYgKG5vZGUubW9kZWw/Lm1vZGVsICYmIG5vZGUubW9kZWw/LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChhbGxOb2RlcykgYWxsTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUpKTtcbiAgICAgICAgICAgIGlmIChub2RlLm1vZGVsLmxpZ2h0bWFwcGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJha2VOb2Rlcykge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzID0gbm9kZS5tb2RlbC5tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1lc2ggaW5zdGFuY2VzIGZyb20gcmVuZGVyIGNvbXBvbmVudFxuICAgICAgICBpZiAobm9kZS5yZW5kZXI/LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChhbGxOb2RlcykgYWxsTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUpKTtcbiAgICAgICAgICAgIGlmIChub2RlLnJlbmRlci5saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgICAgIGlmIChiYWtlTm9kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcyA9IG5vZGUucmVuZGVyLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGxldCBoYXNVdjEgPSB0cnVlO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZXNbaV0ubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MSkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5sb2coYExpZ2h0bWFwcGVyIC0gbm9kZSBbJHtub2RlLm5hbWV9XSBjb250YWlucyBtZXNoZXMgd2l0aG91dCByZXF1aXJlZCB1djEsIGV4Y2x1ZGluZyBpdCBmcm9tIGJha2luZy5gKTtcbiAgICAgICAgICAgICAgICAgICAgaGFzVXYxID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGhhc1V2MSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGlzIG1lc2ggYW4gaW5zdGFuY2Ugb2YgYWxyZWFkeSB1c2VkIG1lc2ggaW4gdGhpcyBub2RlXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl90ZW1wU2V0LmhhcyhtZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29sbGVjdCBlYWNoIGluc3RhbmNlIChvYmplY3Qgd2l0aCBzaGFyZWQgVkIpIGFzIHNlcGFyYXRlIFwibm9kZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUsIFttZXNoSW5zdGFuY2VzW2ldXSkpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcy5wdXNoKG1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RlbXBTZXQuYWRkKG1lc2gpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3RlbXBTZXQuY2xlYXIoKTtcblxuICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgYWxsIG5vbi1zaGFyZWQgb2JqZWN0cyBhcyBvbmUgXCJub2RlXCJcbiAgICAgICAgICAgICAgICBpZiAobm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGJha2VOb2Rlcy5wdXNoKG5ldyBCYWtlTWVzaE5vZGUobm9kZSwgbm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdE1vZGVscyhub2RlLl9jaGlsZHJlbltpXSwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlIGFsbCBtZXNoSW5zdGFuY2VzIHRoYXQgY2FzdCBzaGFkb3dzIGludG8gbGlnaHRtYXBzXG4gICAgcHJlcGFyZVNoYWRvd0Nhc3RlcnMobm9kZXMpIHtcblxuICAgICAgICBjb25zdCBjYXN0ZXJzID0gW107XG4gICAgICAgIGZvciAobGV0IG4gPSAwOyBuIDwgbm9kZXMubGVuZ3RoOyBuKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGVzW25dLmNvbXBvbmVudDtcblxuICAgICAgICAgICAgY29tcG9uZW50LmNhc3RTaGFkb3dzID0gY29tcG9uZW50LmNhc3RTaGFkb3dzTGlnaHRtYXA7XG4gICAgICAgICAgICBpZiAoY29tcG9uZW50LmNhc3RTaGFkb3dzTGlnaHRtYXApIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hlcyA9IG5vZGVzW25dLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaGVzW2ldLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjYXN0ZXJzLnB1c2gobWVzaGVzW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2FzdGVycztcbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIHdvcmxkIHRyYW5zZm9ybSBmb3Igbm9kZXNcbiAgICB1cGRhdGVUcmFuc2Zvcm1zKG5vZGVzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG5vZGVzW2ldLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2pdLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE5vdGU6IHRoaXMgZnVuY3Rpb24gaXMgYWxzbyBjYWxsZWQgYnkgdGhlIEVkaXRvciB0byBkaXNwbGF5IGVzdGltYXRlZCBMTSBzaXplIGluIHRoZSBpbnNwZWN0b3IsXG4gICAgLy8gZG8gbm90IGNoYW5nZSBpdHMgc2lnbmF0dXJlLlxuICAgIGNhbGN1bGF0ZUxpZ2h0bWFwU2l6ZShub2RlKSB7XG4gICAgICAgIGxldCBkYXRhO1xuICAgICAgICBjb25zdCBzaXplTXVsdCA9IHRoaXMuc2NlbmUubGlnaHRtYXBTaXplTXVsdGlwbGllciB8fCAxNjtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSB0ZW1wVmVjO1xuXG4gICAgICAgIGxldCBzcmNBcmVhLCBsaWdodG1hcFNpemVNdWx0aXBsaWVyO1xuXG4gICAgICAgIGlmIChub2RlLm1vZGVsKSB7XG4gICAgICAgICAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyID0gbm9kZS5tb2RlbC5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICAgICAgaWYgKG5vZGUubW9kZWwuYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gdGhpcy5hc3NldHMuZ2V0KG5vZGUubW9kZWwuYXNzZXQpLmRhdGE7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5hcmVhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobm9kZS5tb2RlbC5fYXJlYSkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBub2RlLm1vZGVsO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLl9hcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgIHNyY0FyZWEgPSBkYXRhLl9hcmVhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChub2RlLnJlbmRlcikge1xuICAgICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IG5vZGUucmVuZGVyLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIudHlwZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIGlmIChub2RlLnJlbmRlci5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gbm9kZS5yZW5kZXI7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLl9hcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5fYXJlYTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvcHkgYXJlYVxuICAgICAgICBjb25zdCBhcmVhID0geyB4OiAxLCB5OiAxLCB6OiAxLCB1djogMSB9O1xuICAgICAgICBpZiAoc3JjQXJlYSkge1xuICAgICAgICAgICAgYXJlYS54ID0gc3JjQXJlYS54O1xuICAgICAgICAgICAgYXJlYS55ID0gc3JjQXJlYS55O1xuICAgICAgICAgICAgYXJlYS56ID0gc3JjQXJlYS56O1xuICAgICAgICAgICAgYXJlYS51diA9IHNyY0FyZWEudXY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcmVhTXVsdCA9IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgfHwgMTtcbiAgICAgICAgYXJlYS54ICo9IGFyZWFNdWx0O1xuICAgICAgICBhcmVhLnkgKj0gYXJlYU11bHQ7XG4gICAgICAgIGFyZWEueiAqPSBhcmVhTXVsdDtcblxuICAgICAgICAvLyBib3VuZHMgb2YgdGhlIGNvbXBvbmVudFxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLnJlbmRlciB8fCBub2RlLm1vZGVsO1xuICAgICAgICBjb25zdCBib3VuZHMgPSB0aGlzLmNvbXB1dGVOb2RlQm91bmRzKGNvbXBvbmVudC5tZXNoSW5zdGFuY2VzKTtcblxuICAgICAgICAvLyB0b3RhbCBhcmVhIGluIHRoZSBsaWdodG1hcCBpcyBiYXNlZCBvbiB0aGUgd29ybGQgc3BhY2UgYm91bmRzIG9mIHRoZSBtZXNoXG4gICAgICAgIHNjYWxlLmNvcHkoYm91bmRzLmhhbGZFeHRlbnRzKTtcbiAgICAgICAgbGV0IHRvdGFsQXJlYSA9IGFyZWEueCAqIHNjYWxlLnkgKiBzY2FsZS56ICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWEueSAqIHNjYWxlLnggKiBzY2FsZS56ICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWEueiAqIHNjYWxlLnggKiBzY2FsZS55O1xuICAgICAgICB0b3RhbEFyZWEgLz0gYXJlYS51djtcbiAgICAgICAgdG90YWxBcmVhID0gTWF0aC5zcXJ0KHRvdGFsQXJlYSk7XG5cbiAgICAgICAgY29uc3QgbGlnaHRtYXBTaXplID0gTWF0aC5taW4obWF0aC5uZXh0UG93ZXJPZlR3byh0b3RhbEFyZWEgKiBzaXplTXVsdCksIHRoaXMuc2NlbmUubGlnaHRtYXBNYXhSZXNvbHV0aW9uIHx8IE1BWF9MSUdIVE1BUF9TSVpFKTtcblxuICAgICAgICByZXR1cm4gbGlnaHRtYXBTaXplO1xuICAgIH1cblxuICAgIHNldExpZ2h0bWFwcGluZyhub2RlcywgdmFsdWUsIHBhc3NDb3VudCwgc2hhZGVyRGVmcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGorKykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gbWVzaEluc3RhbmNlc1tqXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0TGlnaHRtYXBwZWQodmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaGFkZXJEZWZzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3NoYWRlckRlZnMgfD0gc2hhZGVyRGVmcztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgbGlnaHRzIHRoYXQgYWZmZWN0IGxpZ2h0bWFwcGVkIG9iamVjdHMgYXJlIHVzZWQgb24gdGhpcyBtZXNoIG5vdyB0aGF0IGl0IGlzIGJha2VkXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXNrID0gTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gbm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdLmNvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Lm1pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXgubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbcGFzc10sIHRleCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYW5kIGFwcGxpZXMgdGhlIGxpZ2h0bWFwcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHlbXXxudWxsfSBub2RlcyAtIEFuIGFycmF5IG9mIGVudGl0aWVzICh3aXRoIG1vZGVsIG9yXG4gICAgICogcmVuZGVyIGNvbXBvbmVudHMpIHRvIHJlbmRlciBsaWdodG1hcHMgZm9yLiBJZiBub3Qgc3VwcGxpZWQsIHRoZSBlbnRpcmUgc2NlbmUgd2lsbCBiZSBiYWtlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21vZGVdIC0gQmFraW5nIG1vZGUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1J9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXBcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SRElSfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwICsgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uICh1c2VkIGZvclxuICAgICAqIGJ1bXAvc3BlY3VsYXIpXG4gICAgICpcbiAgICAgKiBPbmx5IGxpZ2h0cyB3aXRoIGJha2VEaXI9dHJ1ZSB3aWxsIGJlIHVzZWQgZm9yIGdlbmVyYXRpbmcgdGhlIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbi5cbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQkFLRV9DT0xPUkRJUn0uXG4gICAgICovXG4gICAgYmFrZShub2RlcywgbW9kZSA9IEJBS0VfQ09MT1JESVIpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHNreWJveFxuICAgICAgICB0aGlzLnNjZW5lLl91cGRhdGVTa3koZGV2aWNlKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGRldmljZS5maXJlKCdsaWdodG1hcHBlcjpzdGFydCcsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLnN0YXRzLnJlbmRlclBhc3NlcyA9IDA7XG4gICAgICAgIHRoaXMuc3RhdHMuc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMuc3RhdHMuZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICBjb25zdCBzdGFydFNoYWRlcnMgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmxpbmtlZDtcbiAgICAgICAgY29uc3Qgc3RhcnRGYm9UaW1lID0gZGV2aWNlLl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWU7XG4gICAgICAgIGNvbnN0IHN0YXJ0Q29tcGlsZVRpbWUgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmNvbXBpbGVUaW1lO1xuXG4gICAgICAgIC8vIEJha2VNZXNoTm9kZSBvYmplY3RzIGZvciBiYWtpbmdcbiAgICAgICAgY29uc3QgYmFrZU5vZGVzID0gW107XG5cbiAgICAgICAgLy8gYWxsIEJha2VNZXNoTm9kZSBvYmplY3RzXG4gICAgICAgIGNvbnN0IGFsbE5vZGVzID0gW107XG5cbiAgICAgICAgLy8gY29sbGVjdCBub2RlcyAvIG1lc2hJbnN0YW5jZXMgZm9yIGJha2luZ1xuICAgICAgICBpZiAobm9kZXMpIHtcblxuICAgICAgICAgICAgLy8gY29sbGVjdCBub2RlcyBmb3IgYmFraW5nIGJhc2VkIG9uIHNwZWNpZmllZCBsaXN0IG9mIG5vZGVzXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKG5vZGVzW2ldLCBiYWtlTm9kZXMsIG51bGwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IGFsbCBub2RlcyBmcm9tIHRoZSBzY2VuZVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKHRoaXMucm9vdCwgbnVsbCwgYWxsTm9kZXMpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3Qgbm9kZXMgZnJvbSB0aGUgcm9vdCBvZiB0aGUgc2NlbmVcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdE1vZGVscyh0aGlzLnJvb3QsIGJha2VOb2RlcywgYWxsTm9kZXMpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsICdMTUJha2UnKTtcblxuICAgICAgICAvLyBiYWtlIG5vZGVzXG4gICAgICAgIGlmIChiYWtlTm9kZXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAvLyBkaXNhYmxlIGxpZ2h0bWFwcGluZ1xuICAgICAgICAgICAgY29uc3QgcGFzc0NvdW50ID0gbW9kZSA9PT0gQkFLRV9DT0xPUkRJUiA/IDIgOiAxO1xuICAgICAgICAgICAgdGhpcy5zZXRMaWdodG1hcHBpbmcoYmFrZU5vZGVzLCBmYWxzZSwgcGFzc0NvdW50KTtcblxuICAgICAgICAgICAgdGhpcy5pbml0QmFrZShkZXZpY2UpO1xuICAgICAgICAgICAgdGhpcy5iYWtlSW50ZXJuYWwocGFzc0NvdW50LCBiYWtlTm9kZXMsIGFsbE5vZGVzKTtcblxuICAgICAgICAgICAgLy8gRW5hYmxlIG5ldyBsaWdodG1hcHNcbiAgICAgICAgICAgIGxldCBzaGFkZXJEZWZzID0gU0hBREVSREVGX0xNO1xuXG4gICAgICAgICAgICBpZiAobW9kZSA9PT0gQkFLRV9DT0xPUkRJUikge1xuICAgICAgICAgICAgICAgIHNoYWRlckRlZnMgfD0gU0hBREVSREVGX0RJUkxNO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBtYXJrIGxpZ2h0bWFwIGFzIGNvbnRhaW5pbmcgYW1iaWVudCBsaWdodGluZ1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUuYW1iaWVudEJha2UpIHtcbiAgICAgICAgICAgICAgICBzaGFkZXJEZWZzIHw9IFNIQURFUkRFRl9MTUFNQklFTlQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNldExpZ2h0bWFwcGluZyhiYWtlTm9kZXMsIHRydWUsIHBhc3NDb3VudCwgc2hhZGVyRGVmcyk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFuIHVwIG1lbW9yeVxuICAgICAgICAgICAgdGhpcy5maW5pc2hCYWtlKGJha2VOb2Rlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG5cbiAgICAgICAgY29uc3Qgbm93VGltZSA9IG5vdygpO1xuICAgICAgICB0aGlzLnN0YXRzLnRvdGFsUmVuZGVyVGltZSA9IG5vd1RpbWUgLSBzdGFydFRpbWU7XG4gICAgICAgIHRoaXMuc3RhdHMuc2hhZGVyc0xpbmtlZCA9IGRldmljZS5fc2hhZGVyU3RhdHMubGlua2VkIC0gc3RhcnRTaGFkZXJzO1xuICAgICAgICB0aGlzLnN0YXRzLmNvbXBpbGVUaW1lID0gZGV2aWNlLl9zaGFkZXJTdGF0cy5jb21waWxlVGltZSAtIHN0YXJ0Q29tcGlsZVRpbWU7XG4gICAgICAgIHRoaXMuc3RhdHMuZmJvVGltZSA9IGRldmljZS5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIC0gc3RhcnRGYm9UaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLmxpZ2h0bWFwQ291bnQgPSBiYWtlTm9kZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgZGV2aWNlLmZpcmUoJ2xpZ2h0bWFwcGVyOmVuZCcsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbm93VGltZSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLy8gdGhpcyBhbGxvY2F0ZXMgbGlnaHRtYXAgdGV4dHVyZXMgYW5kIHJlbmRlciB0YXJnZXRzLlxuICAgIGFsbG9jYXRlVGV4dHVyZXMoYmFrZU5vZGVzLCBwYXNzQ291bnQpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJha2VOb2Rlcy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAvLyByZXF1aXJlZCBsaWdodG1hcCBzaXplXG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHNpemUgPSB0aGlzLmNhbGN1bGF0ZUxpZ2h0bWFwU2l6ZShiYWtlTm9kZS5ub2RlKTtcblxuICAgICAgICAgICAgLy8gdGV4dHVyZSBhbmQgcmVuZGVyIHRhcmdldCBmb3IgZWFjaCBwYXNzLCBzdG9yZWQgcGVyIG5vZGVcbiAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLmNyZWF0ZVRleHR1cmUoc2l6ZSwgKCdsaWdodG1hcHBlcl9saWdodG1hcF8nICsgaSkpO1xuICAgICAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRleCk7XG4gICAgICAgICAgICAgICAgYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXSA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGV4LFxuICAgICAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2luZ2xlIHRlbXBvcmFyeSByZW5kZXIgdGFyZ2V0IG9mIGVhY2ggc2l6ZVxuICAgICAgICAgICAgaWYgKCF0aGlzLnJlbmRlclRhcmdldHMuaGFzKHNpemUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5jcmVhdGVUZXh0dXJlKHNpemUsICgnbGlnaHRtYXBwZXJfdGVtcF9saWdodG1hcF8nICsgc2l6ZSkpO1xuICAgICAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRleCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLnNldChzaXplLCBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IHRleCxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJlcGFyZUxpZ2h0c1RvQmFrZShsYXllckNvbXBvc2l0aW9uLCBhbGxMaWdodHMsIGJha2VMaWdodHMpIHtcblxuICAgICAgICAvLyBhbWJpZW50IGxpZ2h0XG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICBjb25zdCBhbWJpZW50TGlnaHQgPSBuZXcgQmFrZUxpZ2h0QW1iaWVudCh0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIGJha2VMaWdodHMucHVzaChhbWJpZW50TGlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2NlbmUgbGlnaHRzXG4gICAgICAgIGNvbnN0IHNjZW5lTGlnaHRzID0gbGF5ZXJDb21wb3NpdGlvbi5fbGlnaHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjZW5lTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IHNjZW5lTGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSBhbGwgbGlnaHRzIGFuZCB0aGVpciBvcmlnaW5hbCBzZXR0aW5ncyB3ZSBuZWVkIHRvIHRlbXBvcmFyaWx5IG1vZGlmeVxuICAgICAgICAgICAgY29uc3QgYmFrZUxpZ2h0ID0gbmV3IEJha2VMaWdodFNpbXBsZSh0aGlzLnNjZW5lLCBsaWdodCk7XG4gICAgICAgICAgICBhbGxMaWdodHMucHVzaChiYWtlTGlnaHQpO1xuXG4gICAgICAgICAgICAvLyBiYWtlIGxpZ2h0XG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCAmJiAobGlnaHQubWFzayAmIE1BU0tfQkFLRSkgIT09IDApIHtcblxuICAgICAgICAgICAgICAgIC8vIGlmIGJha2VkLCBpdCBjYW4ndCBiZSB1c2VkIGFzIHN0YXRpY1xuICAgICAgICAgICAgICAgIGxpZ2h0LmlzU3RhdGljID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBsaWdodC5tYXNrID0gMHhGRkZGRkZGRjtcbiAgICAgICAgICAgICAgICBsaWdodC5zaGFkb3dVcGRhdGVNb2RlID0gbGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMID8gU0hBRE9XVVBEQVRFX1JFQUxUSU1FIDogU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICBiYWtlTGlnaHRzLnB1c2goYmFrZUxpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNvcnQgYmFrZSBsaWdodHMgYnkgdHlwZSB0byBtaW5pbWl6ZSBzaGFkZXIgc3dpdGNoZXNcbiAgICAgICAgYmFrZUxpZ2h0cy5zb3J0KCk7XG4gICAgfVxuXG4gICAgcmVzdG9yZUxpZ2h0cyhhbGxMaWdodHMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbExpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWxsTGlnaHRzW2ldLnJlc3RvcmUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldHVwU2NlbmUoKSB7XG5cbiAgICAgICAgLy8gbGlnaHRtYXBwZXIgbmVlZHMgb3JpZ2luYWwgbW9kZWwgZHJhdyBjYWxsc1xuICAgICAgICB0aGlzLnJldmVydFN0YXRpYyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5zY2VuZS5fbmVlZHNTdGF0aWNQcmVwYXJlKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLl9uZWVkc1N0YXRpY1ByZXBhcmUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMucmV2ZXJ0U3RhdGljID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJhY2t1cFxuICAgICAgICB0aGlzLmZvZyA9IHRoaXMuc2NlbmUuZm9nO1xuICAgICAgICB0aGlzLmFtYmllbnRMaWdodC5jb3B5KHRoaXMuc2NlbmUuYW1iaWVudExpZ2h0KTtcblxuICAgICAgICAvLyBzZXQgdXAgc2NlbmVcbiAgICAgICAgdGhpcy5zY2VuZS5mb2cgPSBGT0dfTk9ORTtcblxuICAgICAgICAvLyBpZiBub3QgYmFraW5nIGFtYmllbnQsIHNldCBpdCB0byBibGFja1xuICAgICAgICBpZiAoIXRoaXMuc2NlbmUuYW1iaWVudEJha2UpIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuYW1iaWVudExpZ2h0LnNldCgwLCAwLCAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFwcGx5IHNjZW5lIHNldHRpbmdzXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2V0U2NlbmVDb25zdGFudHMoKTtcbiAgICB9XG5cbiAgICByZXN0b3JlU2NlbmUoKSB7XG5cbiAgICAgICAgdGhpcy5zY2VuZS5mb2cgPSB0aGlzLmZvZztcbiAgICAgICAgdGhpcy5zY2VuZS5hbWJpZW50TGlnaHQuY29weSh0aGlzLmFtYmllbnRMaWdodCk7XG5cbiAgICAgICAgLy8gUmV2ZXJ0IHN0YXRpYyBwcmVwcm9jZXNzaW5nXG4gICAgICAgIGlmICh0aGlzLnJldmVydFN0YXRpYykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5fbmVlZHNTdGF0aWNQcmVwYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94IGZvciBhIHNpbmdsZSBub2RlXG4gICAgY29tcHV0ZU5vZGVCb3VuZHMobWVzaEluc3RhbmNlcykge1xuXG4gICAgICAgIGNvbnN0IGJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGJvdW5kcy5jb3B5KG1lc2hJbnN0YW5jZXNbMF0uYWFiYik7XG4gICAgICAgICAgICBmb3IgKGxldCBtID0gMTsgbSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBtKyspIHtcbiAgICAgICAgICAgICAgICBib3VuZHMuYWRkKG1lc2hJbnN0YW5jZXNbbV0uYWFiYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm91bmRzO1xuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94IGZvciBlYWNoIG5vZGVcbiAgICBjb21wdXRlTm9kZXNCb3VuZHMobm9kZXMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbm9kZXNbaV0ubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIG5vZGVzW2ldLmJvdW5kcyA9IHRoaXMuY29tcHV0ZU5vZGVCb3VuZHMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGNvbXBvdW5kIGJvdW5kaW5nIGJveCBmb3IgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICBjb21wdXRlQm91bmRzKG1lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICBjb25zdCBib3VuZHMgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGJvdW5kcy5jb3B5KG1lc2hJbnN0YW5jZXNbMF0uYWFiYik7XG4gICAgICAgICAgICBmb3IgKGxldCBtID0gMTsgbSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBtKyspIHtcbiAgICAgICAgICAgICAgICBib3VuZHMuYWRkKG1lc2hJbnN0YW5jZXNbbV0uYWFiYik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm91bmRzO1xuICAgIH1cblxuICAgIGJhY2t1cE1hdGVyaWFscyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbHNbaV0gPSBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzdG9yZU1hdGVyaWFscyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMubWF0ZXJpYWxzW2ldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGlnaHRDYW1lcmFQcmVwYXJlKGRldmljZSwgYmFrZUxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbGlnaHQgPSBiYWtlTGlnaHQubGlnaHQ7XG4gICAgICAgIGxldCBzaGFkb3dDYW07XG5cbiAgICAgICAgLy8gb25seSBwcmVwYXJlIGNhbWVyYSBmb3Igc3BvdCBsaWdodCwgb3RoZXIgY2FtZXJhcyBuZWVkIHRvIGJlIGFkanVzdGVkIHBlciBjdWJlbWFwIGZhY2UgLyBwZXIgbm9kZSBsYXRlclxuICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcblxuICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbSA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmE7XG5cbiAgICAgICAgICAgIHNoYWRvd0NhbS5fbm9kZS5zZXRQb3NpdGlvbihsaWdodC5fbm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5fbm9kZS5zZXRSb3RhdGlvbihsaWdodC5fbm9kZS5nZXRSb3RhdGlvbigpKTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5fbm9kZS5yb3RhdGVMb2NhbCgtOTAsIDAsIDApO1xuXG4gICAgICAgICAgICBzaGFkb3dDYW0ucHJvamVjdGlvbiA9IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgICAgICAgICBzaGFkb3dDYW0ubmVhckNsaXAgPSBsaWdodC5hdHRlbnVhdGlvbkVuZCAvIDEwMDA7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZmFyQ2xpcCA9IGxpZ2h0LmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmFzcGVjdFJhdGlvID0gMTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5mb3YgPSBsaWdodC5fb3V0ZXJDb25lQW5nbGUgKiAyO1xuXG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnVwZGF0ZUNhbWVyYUZydXN0dW0oc2hhZG93Q2FtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2hhZG93Q2FtO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIGNhbWVyYSAvIGZydXN0dW0gb2YgdGhlIGxpZ2h0IGZvciByZW5kZXJpbmcgdGhlIGJha2VOb2RlXG4gICAgLy8gcmV0dXJucyB0cnVlIGlmIGxpZ2h0IGFmZmVjdHMgdGhlIGJha2VOb2RlXG4gICAgbGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbChiYWtlTGlnaHQsIGJha2VOb2RlLCBzaGFkb3dDYW0sIGNhc3RlckJvdW5kcykge1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gYmFrZUxpZ2h0LmxpZ2h0O1xuICAgICAgICBsZXQgbGlnaHRBZmZlY3RzTm9kZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuXG4gICAgICAgICAgICAvLyB0d2VhayBkaXJlY3Rpb25hbCBsaWdodCBjYW1lcmEgdG8gZnVsbHkgc2VlIGFsbCBjYXN0ZXJzIGFuZCB0aGV5IGFyZSBmdWxseSBpbnNpZGUgdGhlIGZydXN0dW1cbiAgICAgICAgICAgIHRlbXBWZWMuY29weShjYXN0ZXJCb3VuZHMuY2VudGVyKTtcbiAgICAgICAgICAgIHRlbXBWZWMueSArPSBjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueTtcblxuICAgICAgICAgICAgdGhpcy5jYW1lcmEubm9kZS5zZXRQb3NpdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm5vZGUuc2V0RXVsZXJBbmdsZXMoLTkwLCAwLCAwKTtcblxuICAgICAgICAgICAgdGhpcy5jYW1lcmEubmVhckNsaXAgPSAwO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEuZmFyQ2xpcCA9IGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy55ICogMjtcblxuICAgICAgICAgICAgY29uc3QgZnJ1c3R1bVNpemUgPSBNYXRoLm1heChjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueCwgY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLnopO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEub3J0aG9IZWlnaHQgPSBmcnVzdHVtU2l6ZTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBmb3Igb3RoZXIgbGlnaHQgdHlwZXMsIHRlc3QgaWYgbGlnaHQgYWZmZWN0cyB0aGUgbm9kZVxuICAgICAgICAgICAgaWYgKCFiYWtlTGlnaHQubGlnaHRCb3VuZHMuaW50ZXJzZWN0cyhiYWtlTm9kZS5ib3VuZHMpKSB7XG4gICAgICAgICAgICAgICAgbGlnaHRBZmZlY3RzTm9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcGVyIG1lc2hJbnN0YW5jZSBjdWxsaW5nIGZvciBzcG90IGxpZ2h0IG9ubHlcbiAgICAgICAgLy8gKG9tbmkgbGlnaHRzIGN1bGwgcGVyIGZhY2UgbGF0ZXIsIGRpcmVjdGlvbmFsIGxpZ2h0cyBkb24ndCBjdWxsKVxuICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgIGxldCBub2RlVmlzaWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gYmFrZU5vZGUubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzW2ldLl9pc1Zpc2libGUoc2hhZG93Q2FtKSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlVmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbm9kZVZpc2libGUpIHtcbiAgICAgICAgICAgICAgICBsaWdodEFmZmVjdHNOb2RlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGlnaHRBZmZlY3RzTm9kZTtcbiAgICB9XG5cbiAgICAvLyBzZXQgdXAgbGlnaHQgYXJyYXkgZm9yIGEgc2luZ2xlIGxpZ2h0XG4gICAgc2V0dXBMaWdodEFycmF5KGxpZ2h0QXJyYXksIGxpZ2h0KSB7XG5cbiAgICAgICAgbGlnaHRBcnJheVtMSUdIVFRZUEVfRElSRUNUSU9OQUxdLmxlbmd0aCA9IDA7XG4gICAgICAgIGxpZ2h0QXJyYXlbTElHSFRUWVBFX09NTkldLmxlbmd0aCA9IDA7XG4gICAgICAgIGxpZ2h0QXJyYXlbTElHSFRUWVBFX1NQT1RdLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgbGlnaHRBcnJheVtsaWdodC50eXBlXVswXSA9IGxpZ2h0O1xuICAgICAgICBsaWdodC52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZW5kZXJTaGFkb3dNYXAoc2hhZG93TWFwUmVuZGVyZWQsIGNhc3RlcnMsIGxpZ2h0QXJyYXksIGJha2VMaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gYmFrZUxpZ2h0LmxpZ2h0O1xuICAgICAgICBpZiAoIXNoYWRvd01hcFJlbmRlcmVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIHNoYWRvdyBtYXAgZnJvbSB0aGUgY2FjaGUgdG8gYXZvaWQgcGVyIGxpZ2h0IGFsbG9jYXRpb25cbiAgICAgICAgICAgIGlmICghbGlnaHQuc2hhZG93TWFwICYmICF0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd01hcCA9IHRoaXMuc2hhZG93TWFwQ2FjaGUuZ2V0KHRoaXMuZGV2aWNlLCBsaWdodCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsLmN1bGwobGlnaHQsIGNhc3RlcnMsIHRoaXMuY2FtZXJhKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsLnJlbmRlcihsaWdodCwgdGhpcy5jYW1lcmEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlckxvY2FsLmN1bGwobGlnaHQsIGNhc3RlcnMpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIucmVuZGVyU2hhZG93c0xvY2FsKGxpZ2h0QXJyYXlbbGlnaHQudHlwZV0sIHRoaXMuY2FtZXJhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHBvc3Rwcm9jZXNzVGV4dHVyZXMoZGV2aWNlLCBiYWtlTm9kZXMsIHBhc3NDb3VudCkge1xuXG4gICAgICAgIGNvbnN0IG51bURpbGF0ZXMyeCA9IDE7IC8vIDEgb3IgMiBkaWxhdGVzIChkZXBlbmRpbmcgb24gZmlsdGVyIGJlaW5nIGVuYWJsZWQpXG4gICAgICAgIGNvbnN0IGRpbGF0ZVNoYWRlciA9IHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNoYWRlckRpbGF0ZTtcblxuICAgICAgICAvLyBiaWxhdGVyYWwgZGVub2lzZSBmaWx0ZXIgLSBydW5zIGFzIGEgZmlyc3QgcGFzcywgYmVmb3JlIGRpbGF0ZVxuICAgICAgICBjb25zdCBmaWx0ZXJMaWdodG1hcCA9IHRoaXMuc2NlbmUubGlnaHRtYXBGaWx0ZXJFbmFibGVkO1xuICAgICAgICBpZiAoZmlsdGVyTGlnaHRtYXApIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnByZXBhcmVEZW5vaXNlKHRoaXMuc2NlbmUubGlnaHRtYXBGaWx0ZXJSYW5nZSwgdGhpcy5zY2VuZS5saWdodG1hcEZpbHRlclNtb290aG5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgbm9kZSA9IDA7IG5vZGUgPCBiYWtlTm9kZXMubGVuZ3RoOyBub2RlKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGJha2VOb2RlID0gYmFrZU5vZGVzW25vZGVdO1xuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGBMTVBvc3Q6JHtub2RlfWApO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBub2RlUlQgPSBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwID0gbm9kZVJULmNvbG9yQnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdGVtcFJUID0gdGhpcy5yZW5kZXJUYXJnZXRzLmdldChsaWdodG1hcC53aWR0aCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGVtcFRleCA9IHRlbXBSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnByZXBhcmUobGlnaHRtYXAud2lkdGgsIGxpZ2h0bWFwLmhlaWdodCk7XG5cbiAgICAgICAgICAgICAgICAvLyBib3VuY2UgZGlsYXRlIGJldHdlZW4gdGV4dHVyZXMsIGV4ZWN1dGUgZGVub2lzZSBvbiB0aGUgZmlyc3QgcGFzc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtRGlsYXRlczJ4OyBpKyspIHtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zZXRTb3VyY2VUZXh0dXJlKGxpZ2h0bWFwKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmlsYXRlcmFsRmlsdGVyRW5hYmxlZCA9IGZpbHRlckxpZ2h0bWFwICYmIHBhc3MgPT09IDAgJiYgaSA9PT0gMDtcbiAgICAgICAgICAgICAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGVtcFJULCBiaWxhdGVyYWxGaWx0ZXJFbmFibGVkID8gdGhpcy5saWdodG1hcEZpbHRlcnMuc2hhZGVyRGVub2lzZSA6IGRpbGF0ZVNoYWRlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMuc2V0U291cmNlVGV4dHVyZSh0ZW1wVGV4KTtcbiAgICAgICAgICAgICAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgbm9kZVJULCBkaWxhdGVTaGFkZXIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYmFrZUludGVybmFsKHBhc3NDb3VudCwgYmFrZU5vZGVzLCBhbGxOb2Rlcykge1xuXG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcblxuICAgICAgICB0aGlzLmNyZWF0ZU1hdGVyaWFscyhkZXZpY2UsIHNjZW5lLCBwYXNzQ291bnQpO1xuICAgICAgICB0aGlzLnNldHVwU2NlbmUoKTtcblxuICAgICAgICAvLyB1cGRhdGUgbGF5ZXIgY29tcG9zaXRpb25cbiAgICAgICAgc2NlbmUubGF5ZXJzLl91cGRhdGUoKTtcblxuICAgICAgICAvLyBjb21wdXRlIGJvdW5kaW5nIGJveGVzIGZvciBub2Rlc1xuICAgICAgICB0aGlzLmNvbXB1dGVOb2Rlc0JvdW5kcyhiYWtlTm9kZXMpO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBsaWdodG1hcCBzaXplcyBhbmQgYWxsb2NhdGUgdGV4dHVyZXNcbiAgICAgICAgdGhpcy5hbGxvY2F0ZVRleHR1cmVzKGJha2VOb2RlcywgcGFzc0NvdW50KTtcblxuICAgICAgICAvLyBDb2xsZWN0IGJha2VhYmxlIGxpZ2h0cywgYW5kIGFsc28ga2VlcCBhbGxMaWdodHMgYWxvbmcgd2l0aCB0aGVpciBwcm9wZXJ0aWVzIHdlIGNoYW5nZSB0byByZXN0b3JlIHRoZW0gbGF0ZXJcbiAgICAgICAgY29uc3QgYWxsTGlnaHRzID0gW10sIGJha2VMaWdodHMgPSBbXTtcbiAgICAgICAgdGhpcy5wcmVwYXJlTGlnaHRzVG9CYWtlKHNjZW5lLmxheWVycywgYWxsTGlnaHRzLCBiYWtlTGlnaHRzKTtcblxuICAgICAgICAvLyB1cGRhdGUgdHJhbnNmb3Jtc1xuICAgICAgICB0aGlzLnVwZGF0ZVRyYW5zZm9ybXMoYWxsTm9kZXMpO1xuXG4gICAgICAgIC8vIGdldCBhbGwgbWVzaEluc3RhbmNlcyB0aGF0IGNhc3Qgc2hhZG93cyBpbnRvIGxpZ2h0bWFwIGFuZCBzZXQgdGhlbSB1cCBmb3IgcmVhbHRpbWUgc2hhZG93IGNhc3RpbmdcbiAgICAgICAgY29uc3QgY2FzdGVycyA9IHRoaXMucHJlcGFyZVNoYWRvd0Nhc3RlcnMoYWxsTm9kZXMpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBza2lubmVkIGFuZCBtb3JwaGVkIG1lc2hlc1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnVwZGF0ZUNwdVNraW5NYXRyaWNlcyhjYXN0ZXJzKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5ncHVVcGRhdGUoY2FzdGVycyk7XG5cbiAgICAgICAgLy8gY29tcG91bmQgYm91bmRpbmcgYm94IGZvciBhbGwgY2FzdGVycywgdXNlZCB0byBjb21wdXRlIHNoYXJlZCBkaXJlY3Rpb25hbCBsaWdodCBzaGFkb3dcbiAgICAgICAgY29uc3QgY2FzdGVyQm91bmRzID0gdGhpcy5jb21wdXRlQm91bmRzKGNhc3RlcnMpO1xuXG4gICAgICAgIGxldCBpLCBqLCByY3YsIG07XG5cbiAgICAgICAgLy8gUHJlcGFyZSBtb2RlbHNcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGJha2VOb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbaV07XG4gICAgICAgICAgICByY3YgPSBiYWtlTm9kZS5tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcmN2Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgLy8gcGF0Y2ggbWVzaEluc3RhbmNlXG4gICAgICAgICAgICAgICAgbSA9IHJjdltqXTtcblxuICAgICAgICAgICAgICAgIG0uc2V0TGlnaHRtYXBwZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgIG0ubWFzayA9IE1BU0tfQkFLRTsgLy8gb25seSBhZmZlY3RlZCBieSBMTSBsaWdodHNcblxuICAgICAgICAgICAgICAgIC8vIHBhdGNoIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgbS5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMF0sIG0ubWF0ZXJpYWwubGlnaHRNYXAgPyBtLm1hdGVyaWFsLmxpZ2h0TWFwIDogdGhpcy5ibGFja1RleCk7XG4gICAgICAgICAgICAgICAgbS5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMV0sIHRoaXMuYmxhY2tUZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGlzYWJsZSBhbGwgYmFrZWFibGUgbGlnaHRzXG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBiYWtlTGlnaHRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBiYWtlTGlnaHRzW2pdLmxpZ2h0LmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpZ2h0QXJyYXkgPSBbW10sIFtdLCBbXV07XG4gICAgICAgIGxldCBwYXNzLCBub2RlO1xuICAgICAgICBsZXQgc2hhZGVyc1VwZGF0ZWRPbjFzdFBhc3MgPSBmYWxzZTtcblxuICAgICAgICAvLyBBY2N1bXVsYXRlIGxpZ2h0cyBpbnRvIFJHQk0gdGV4dHVyZXNcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGJha2VMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGJha2VMaWdodCA9IGJha2VMaWdodHNbaV07XG4gICAgICAgICAgICBjb25zdCBpc0FtYmllbnRMaWdodCA9IGJha2VMaWdodCBpbnN0YW5jZW9mIEJha2VMaWdodEFtYmllbnQ7XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0IGNhbiBiZSBiYWtlZCB1c2luZyBtYW55IHZpcnR1YWwgbGlnaHRzIHRvIGNyZWF0ZSBzb2Z0IGVmZmVjdFxuICAgICAgICAgICAgbGV0IG51bVZpcnR1YWxMaWdodHMgPSBiYWtlTGlnaHQubnVtVmlydHVhbExpZ2h0cztcblxuICAgICAgICAgICAgLy8gZGlyZWN0aW9uIGJha2luZyBpcyBub3QgY3VycmVudGx5IGNvbXBhdGlibGUgd2l0aCB2aXJ0dWFsIGxpZ2h0cywgYXMgd2UgZW5kIHVwIHdpdGggbm8gdmFsaWQgZGlyZWN0aW9uIGluIGxpZ2h0cyBwZW51bWJyYVxuICAgICAgICAgICAgaWYgKHBhc3NDb3VudCA+IDEgJiYgbnVtVmlydHVhbExpZ2h0cyA+IDEgJiYgYmFrZUxpZ2h0LmxpZ2h0LmJha2VEaXIpIHtcbiAgICAgICAgICAgICAgICBudW1WaXJ0dWFsTGlnaHRzID0gMTtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdMaWdodG1hcHBlclxcJ3MgQkFLRV9DT0xPUkRJUiBtb2RlIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggTGlnaHRcXCdzIGJha2VOdW1TYW1wbGVzIGxhcmdlciB0aGFuIG9uZS4gRm9yY2luZyBpdCB0byBvbmUuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IHZpcnR1YWxMaWdodEluZGV4ID0gMDsgdmlydHVhbExpZ2h0SW5kZXggPCBudW1WaXJ0dWFsTGlnaHRzOyB2aXJ0dWFsTGlnaHRJbmRleCsrKSB7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgTGlnaHQ6JHtiYWtlTGlnaHQubGlnaHQuX25vZGUubmFtZX06JHt2aXJ0dWFsTGlnaHRJbmRleH1gKTtcblxuICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgdmlydHVhbCBsaWdodFxuICAgICAgICAgICAgICAgIGlmIChudW1WaXJ0dWFsTGlnaHRzID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBiYWtlTGlnaHQucHJlcGFyZVZpcnR1YWxMaWdodCh2aXJ0dWFsTGlnaHRJbmRleCwgbnVtVmlydHVhbExpZ2h0cyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYmFrZUxpZ2h0LnN0YXJ0QmFrZSgpO1xuICAgICAgICAgICAgICAgIGxldCBzaGFkb3dNYXBSZW5kZXJlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93Q2FtID0gdGhpcy5saWdodENhbWVyYVByZXBhcmUoZGV2aWNlLCBiYWtlTGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChub2RlID0gMDsgbm9kZSA8IGJha2VOb2Rlcy5sZW5ndGg7IG5vZGUrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJha2VOb2RlID0gYmFrZU5vZGVzW25vZGVdO1xuICAgICAgICAgICAgICAgICAgICByY3YgPSBiYWtlTm9kZS5tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0QWZmZWN0c05vZGUgPSB0aGlzLmxpZ2h0Q2FtZXJhUHJlcGFyZUFuZEN1bGwoYmFrZUxpZ2h0LCBiYWtlTm9kZSwgc2hhZG93Q2FtLCBjYXN0ZXJCb3VuZHMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0QWZmZWN0c05vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXR1cExpZ2h0QXJyYXkobGlnaHRBcnJheSwgYmFrZUxpZ2h0LmxpZ2h0KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLmxpZ2h0VGV4dHVyZUF0bGFzLnVwZGF0ZShsaWdodEFycmF5W0xJR0hUVFlQRV9TUE9UXSwgbGlnaHRBcnJheVtMSUdIVFRZUEVfT01OSV0sIHRoaXMubGlnaHRpbmdQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVuZGVyIGxpZ2h0IHNoYWRvdyBtYXAgbmVlZHMgdG8gYmUgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93TWFwUmVuZGVyZWQgPSB0aGlzLnJlbmRlclNoYWRvd01hcChzaGFkb3dNYXBSZW5kZXJlZCwgY2FzdGVycywgbGlnaHRBcnJheSwgYmFrZUxpZ2h0KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbHVzdGVyTGlnaHRzID0gbGlnaHRBcnJheVtMSUdIVFRZUEVfU1BPVF0uY29uY2F0KGxpZ2h0QXJyYXlbTElHSFRUWVBFX09NTkldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycy51cGRhdGUoY2x1c3RlckxpZ2h0cywgdGhpcy5zY2VuZS5nYW1tYUNvcnJlY3Rpb24sIHRoaXMubGlnaHRpbmdQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgb3JpZ2luYWwgbWF0ZXJpYWxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYmFja3VwTWF0ZXJpYWxzKHJjdik7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgYmFrZSBmaXJzdCB2aXJ0dWFsIGxpZ2h0IGZvciBwYXNzIDEsIGFzIGl0IGRvZXMgbm90IGhhbmRsZSBvdmVybGFwcGluZyBsaWdodHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzID4gMCAmJiB2aXJ0dWFsTGlnaHRJbmRleCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZG9uJ3QgYmFrZSBhbWJpZW50IGxpZ2h0IGluIHBhc3MgMSwgYXMgdGhlcmUncyBubyBtYWluIGRpcmVjdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQW1iaWVudExpZ2h0ICYmIHBhc3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBMTVBhc3M6JHtwYXNzfWApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsaWdodG1hcCBzaXplXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlUlQgPSBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXBTaXplID0gYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXS5jb2xvckJ1ZmZlci53aWR0aDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IG1hdGNoaW5nIHRlbXAgcmVuZGVyIHRhcmdldCB0byByZW5kZXIgdG9cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBSVCA9IHRoaXMucmVuZGVyVGFyZ2V0cy5nZXQobGlnaHRtYXBTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBUZXggPSB0ZW1wUlQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhZGVyc1VwZGF0ZWRPbjFzdFBhc3MgPSBzY2VuZS51cGRhdGVTaGFkZXJzO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcGFzc01hdGVyaWFsID0gdGhpcy5wYXNzTWF0ZXJpYWxzW3Bhc3NdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQW1iaWVudExpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIGxhc3QgdmlydHVhbCBsaWdodCBvZiBhbWJpZW50IGxpZ2h0LCBtdWx0aXBseSBhY2N1bXVsYXRlZCBBTyBsaWdodG1hcCB3aXRoIGFtYmllbnQgbGlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyA9IHZpcnR1YWxMaWdodEluZGV4ICsgMSA9PT0gbnVtVmlydHVhbExpZ2h0cztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdFZpcnR1YWxMaWdodEZvclBhc3MgJiYgcGFzcyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXNzTWF0ZXJpYWwgPSB0aGlzLmFtYmllbnRBT01hdGVyaWFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IHVwIG1hdGVyaWFsIGZvciBiYWtpbmcgYSBwYXNzXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcmN2Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmN2W2pdLm1hdGVyaWFsID0gcGFzc01hdGVyaWFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1cGRhdGUgc2hhZGVyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnVwZGF0ZVNoYWRlcnMocmN2KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGluZy1wb25naW5nIG91dHB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRDYW1lcmEodGhpcy5jYW1lcmEsIHRlbXBSVCwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzID09PSBQQVNTX0RJUikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29uc3RhbnRCYWtlRGlyLnNldFZhbHVlKGJha2VMaWdodC5saWdodC5iYWtlRGlyID8gMSA6IDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwcmVwYXJlIGNsdXN0ZXJlZCBsaWdodGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycy5hY3RpdmF0ZSh0aGlzLnJlbmRlcmVyLmxpZ2h0VGV4dHVyZUF0bGFzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWUgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZSA9IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIucmVuZGVyRm9yd2FyZCh0aGlzLmNhbWVyYSwgcmN2LCByY3YubGVuZ3RoLCBsaWdodEFycmF5LCBTSEFERVJfRk9SV0FSREhEUik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS51cGRhdGVFbmQoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0cy5zaGFkb3dNYXBUaW1lICs9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRzLmZvcndhcmRUaW1lICs9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0cy5yZW5kZXJQYXNzZXMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZW1wIHJlbmRlciB0YXJnZXQgbm93IGhhcyBsaWdodG1hcCwgc3RvcmUgaXQgZm9yIHRoZSBub2RlXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdID0gdGVtcFJUO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgcmVsZWFzZSBwcmV2aW91cyBsaWdodG1hcCBpbnRvIHRlbXAgcmVuZGVyIHRhcmdldCBwb29sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuc2V0KGxpZ2h0bWFwU2l6ZSwgbm9kZVJUKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJjdi5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0gPSByY3Zbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbcGFzc10sIHRlbXBUZXgpOyAvLyBwaW5nLXBvbmdpbmcgaW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLl9zaGFkZXJEZWZzIHw9IFNIQURFUkRFRl9MTTsgLy8gZm9yY2UgdXNpbmcgTE0gZXZlbiBpZiBtYXRlcmlhbCBkb2Vzbid0IGhhdmUgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJldmVydCB0byBvcmlnaW5hbCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXN0b3JlTWF0ZXJpYWxzKHJjdik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYmFrZUxpZ2h0LmVuZEJha2UodGhpcy5zaGFkb3dNYXBDYWNoZSk7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wb3N0cHJvY2Vzc1RleHR1cmVzKGRldmljZSwgYmFrZU5vZGVzLCBwYXNzQ291bnQpO1xuXG4gICAgICAgIC8vIHJlc3RvcmUgY2hhbmdlc1xuICAgICAgICBmb3IgKG5vZGUgPSAwOyBub2RlIDwgYWxsTm9kZXMubGVuZ3RoOyBub2RlKyspIHtcbiAgICAgICAgICAgIGFsbE5vZGVzW25vZGVdLnJlc3RvcmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVzdG9yZUxpZ2h0cyhhbGxMaWdodHMpO1xuICAgICAgICB0aGlzLnJlc3RvcmVTY2VuZSgpO1xuXG4gICAgICAgIC8vIGVtcHR5IGNhY2hlIHRvIG1pbmltaXplIHBlcnNpc3RlbnQgbWVtb3J5IHVzZSAuLiBpZiBzb21lIGNhY2hlZCB0ZXh0dXJlcyBhcmUgbmVlZGVkLFxuICAgICAgICAvLyB0aGV5IHdpbGwgYmUgYWxsb2NhdGVkIGFnYWluIGFzIG5lZWRlZFxuICAgICAgICBpZiAoIWNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBMaWdodG1hcHBlciB9O1xuIl0sIm5hbWVzIjpbIk1BWF9MSUdIVE1BUF9TSVpFIiwiUEFTU19DT0xPUiIsIlBBU1NfRElSIiwidGVtcFZlYyIsIlZlYzMiLCJMaWdodG1hcHBlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwicm9vdCIsInNjZW5lIiwicmVuZGVyZXIiLCJhc3NldHMiLCJzaGFkb3dNYXBDYWNoZSIsIl90ZW1wU2V0IiwiU2V0IiwiX2luaXRDYWxsZWQiLCJwYXNzTWF0ZXJpYWxzIiwiYW1iaWVudEFPTWF0ZXJpYWwiLCJmb2ciLCJhbWJpZW50TGlnaHQiLCJDb2xvciIsInJlbmRlclRhcmdldHMiLCJNYXAiLCJzdGF0cyIsInJlbmRlclBhc3NlcyIsImxpZ2h0bWFwQ291bnQiLCJ0b3RhbFJlbmRlclRpbWUiLCJmb3J3YXJkVGltZSIsImZib1RpbWUiLCJzaGFkb3dNYXBUaW1lIiwiY29tcGlsZVRpbWUiLCJzaGFkZXJzTGlua2VkIiwiZGVzdHJveSIsIkxpZ2h0bWFwQ2FjaGUiLCJkZWNSZWYiLCJibGFja1RleCIsImluaXRCYWtlIiwibGlnaHRtYXBGaWx0ZXJzIiwiTGlnaHRtYXBGaWx0ZXJzIiwiY29uc3RhbnRCYWtlRGlyIiwic2NvcGUiLCJyZXNvbHZlIiwibWF0ZXJpYWxzIiwiVGV4dHVyZSIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfUkdCTSIsIm5hbWUiLCJpbmNSZWYiLCJjYW1lcmEiLCJDYW1lcmEiLCJjbGVhckNvbG9yIiwic2V0IiwiY2xlYXJDb2xvckJ1ZmZlciIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJmcnVzdHVtQ3VsbGluZyIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsImFzcGVjdFJhdGlvIiwibm9kZSIsIkdyYXBoTm9kZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0aW5nUGFyYW1zIiwiTGlnaHRpbmdQYXJhbXMiLCJzdXBwb3J0c0FyZWFMaWdodHMiLCJtYXhUZXh0dXJlU2l6ZSIsInNyY1BhcmFtcyIsImxpZ2h0aW5nIiwic2hhZG93c0VuYWJsZWQiLCJzaGFkb3dBdGxhc1Jlc29sdXRpb24iLCJjb29raWVzRW5hYmxlZCIsImNvb2tpZUF0bGFzUmVzb2x1dGlvbiIsImFyZWFMaWdodHNFbmFibGVkIiwiY2VsbHMiLCJtYXhMaWdodHNQZXJDZWxsIiwid29ybGRDbHVzdGVycyIsIldvcmxkQ2x1c3RlcnMiLCJmaW5pc2hCYWtlIiwiYmFrZU5vZGVzIiwiZGVzdHJveVJUIiwicnQiLCJjb2xvckJ1ZmZlciIsImZvckVhY2giLCJjbGVhciIsImxlbmd0aCIsImNyZWF0ZU1hdGVyaWFsRm9yUGFzcyIsInBhc3MiLCJhZGRBbWJpZW50IiwibWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwiY2h1bmtzIiwiQVBJVmVyc2lvbiIsIkNIVU5LQVBJXzFfNTUiLCJ0cmFuc2Zvcm1WUyIsInNoYWRlckNodW5rcyIsImJha2VMbUVuZENodW5rIiwic2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIiLCJiYWtlTG1FbmRQUyIsImFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QiLCJ0b0ZpeGVkIiwiYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzIiwiYW1iaWVudCIsImFtYmllbnRUaW50IiwiYmFzZVBTIiwibGlnaHRtYXBQaXhlbEZvcm1hdCIsImVuZFBTIiwibGlnaHRNYXAiLCJiYWtlRGlyTG1FbmRQUyIsIm91dHB1dEFscGhhUFMiLCJvdXRwdXRBbHBoYU9wYXF1ZVBTIiwib3V0cHV0QWxwaGFQcmVtdWxQUyIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwiZm9yY2VVdjEiLCJ1cGRhdGUiLCJjcmVhdGVNYXRlcmlhbHMiLCJwYXNzQ291bnQiLCJvblVwZGF0ZVNoYWRlciIsIm9wdGlvbnMiLCJsaXRPcHRpb25zIiwibGlnaHRNYXBXaXRob3V0QW1iaWVudCIsInNlcGFyYXRlQW1iaWVudCIsImNyZWF0ZVRleHR1cmUiLCJzaXplIiwicHJvZmlsZXJIaW50IiwiVEVYSElOVF9MSUdIVE1BUCIsIm1pcG1hcHMiLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwiY29sbGVjdE1vZGVscyIsImFsbE5vZGVzIiwiZW5hYmxlZCIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbCIsInB1c2giLCJCYWtlTWVzaE5vZGUiLCJsaWdodG1hcHBlZCIsInJlbmRlciIsImhhc1V2MSIsImkiLCJtZXNoIiwidmVydGV4QnVmZmVyIiwiRGVidWciLCJsb2ciLCJub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzIiwiaGFzIiwiYWRkIiwiX2NoaWxkcmVuIiwicHJlcGFyZVNoYWRvd0Nhc3RlcnMiLCJub2RlcyIsImNhc3RlcnMiLCJuIiwiY29tcG9uZW50IiwiY2FzdFNoYWRvd3MiLCJjYXN0U2hhZG93c0xpZ2h0bWFwIiwibWVzaGVzIiwidmlzaWJsZVRoaXNGcmFtZSIsInVwZGF0ZVRyYW5zZm9ybXMiLCJqIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjYWxjdWxhdGVMaWdodG1hcFNpemUiLCJkYXRhIiwic2l6ZU11bHQiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwic2NhbGUiLCJzcmNBcmVhIiwiYXNzZXQiLCJnZXQiLCJhcmVhIiwiX2FyZWEiLCJ4IiwieSIsInoiLCJ1diIsImFyZWFNdWx0IiwiYm91bmRzIiwiY29tcHV0ZU5vZGVCb3VuZHMiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJ0b3RhbEFyZWEiLCJNYXRoIiwic3FydCIsImxpZ2h0bWFwU2l6ZSIsIm1pbiIsIm1hdGgiLCJuZXh0UG93ZXJPZlR3byIsImxpZ2h0bWFwTWF4UmVzb2x1dGlvbiIsInNldExpZ2h0bWFwcGluZyIsInZhbHVlIiwic2hhZGVyRGVmcyIsIm1lc2hJbnN0YW5jZSIsInNldExpZ2h0bWFwcGVkIiwiX3NoYWRlckRlZnMiLCJtYXNrIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJ0ZXgiLCJGSUxURVJfTElORUFSIiwic2V0UmVhbHRpbWVMaWdodG1hcCIsIk1lc2hJbnN0YW5jZSIsImxpZ2h0bWFwUGFyYW1OYW1lcyIsImJha2UiLCJtb2RlIiwiQkFLRV9DT0xPUkRJUiIsInN0YXJ0VGltZSIsIm5vdyIsIl91cGRhdGVTa3kiLCJmaXJlIiwidGltZXN0YW1wIiwidGFyZ2V0Iiwic3RhcnRTaGFkZXJzIiwiX3NoYWRlclN0YXRzIiwibGlua2VkIiwic3RhcnRGYm9UaW1lIiwiX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSIsInN0YXJ0Q29tcGlsZVRpbWUiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsImJha2VJbnRlcm5hbCIsIlNIQURFUkRFRl9MTSIsIlNIQURFUkRFRl9ESVJMTSIsImFtYmllbnRCYWtlIiwiU0hBREVSREVGX0xNQU1CSUVOVCIsInBvcEdwdU1hcmtlciIsIm5vd1RpbWUiLCJhbGxvY2F0ZVRleHR1cmVzIiwiYmFrZU5vZGUiLCJSZW5kZXJUYXJnZXQiLCJkZXB0aCIsInByZXBhcmVMaWdodHNUb0Jha2UiLCJsYXllckNvbXBvc2l0aW9uIiwiYWxsTGlnaHRzIiwiYmFrZUxpZ2h0cyIsIkJha2VMaWdodEFtYmllbnQiLCJzY2VuZUxpZ2h0cyIsIl9saWdodHMiLCJsaWdodCIsImJha2VMaWdodCIsIkJha2VMaWdodFNpbXBsZSIsIk1BU0tfQkFLRSIsImlzU3RhdGljIiwic2hhZG93VXBkYXRlTW9kZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIlNIQURPV1VQREFURV9SRUFMVElNRSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJzb3J0IiwicmVzdG9yZUxpZ2h0cyIsInJlc3RvcmUiLCJzZXR1cFNjZW5lIiwicmV2ZXJ0U3RhdGljIiwiX25lZWRzU3RhdGljUHJlcGFyZSIsIkZPR19OT05FIiwic2V0U2NlbmVDb25zdGFudHMiLCJyZXN0b3JlU2NlbmUiLCJCb3VuZGluZ0JveCIsImFhYmIiLCJtIiwiY29tcHV0ZU5vZGVzQm91bmRzIiwiY29tcHV0ZUJvdW5kcyIsImJhY2t1cE1hdGVyaWFscyIsInJlc3RvcmVNYXRlcmlhbHMiLCJsaWdodENhbWVyYVByZXBhcmUiLCJzaGFkb3dDYW0iLCJMSUdIVFRZUEVfU1BPVCIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzaGFkb3dDYW1lcmEiLCJfbm9kZSIsInNldFBvc2l0aW9uIiwiZ2V0UG9zaXRpb24iLCJzZXRSb3RhdGlvbiIsImdldFJvdGF0aW9uIiwicm90YXRlTG9jYWwiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwibmVhckNsaXAiLCJhdHRlbnVhdGlvbkVuZCIsImZhckNsaXAiLCJmb3YiLCJfb3V0ZXJDb25lQW5nbGUiLCJ1cGRhdGVDYW1lcmFGcnVzdHVtIiwibGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbCIsImNhc3RlckJvdW5kcyIsImxpZ2h0QWZmZWN0c05vZGUiLCJjZW50ZXIiLCJzZXRFdWxlckFuZ2xlcyIsImZydXN0dW1TaXplIiwibWF4Iiwib3J0aG9IZWlnaHQiLCJsaWdodEJvdW5kcyIsImludGVyc2VjdHMiLCJub2RlVmlzaWJsZSIsIl9pc1Zpc2libGUiLCJzZXR1cExpZ2h0QXJyYXkiLCJsaWdodEFycmF5IiwiTElHSFRUWVBFX09NTkkiLCJyZW5kZXJTaGFkb3dNYXAiLCJzaGFkb3dNYXBSZW5kZXJlZCIsInNoYWRvd01hcCIsIl9zaGFkb3dSZW5kZXJlckRpcmVjdGlvbmFsIiwiX3NoYWRvd1JlbmRlcmVyTG9jYWwiLCJyZW5kZXJTaGFkb3dzTG9jYWwiLCJwb3N0cHJvY2Vzc1RleHR1cmVzIiwibnVtRGlsYXRlczJ4IiwiZGlsYXRlU2hhZGVyIiwic2hhZGVyRGlsYXRlIiwiZmlsdGVyTGlnaHRtYXAiLCJsaWdodG1hcEZpbHRlckVuYWJsZWQiLCJwcmVwYXJlRGVub2lzZSIsImxpZ2h0bWFwRmlsdGVyUmFuZ2UiLCJsaWdodG1hcEZpbHRlclNtb290aG5lc3MiLCJub2RlUlQiLCJsaWdodG1hcCIsInRlbXBSVCIsInRlbXBUZXgiLCJwcmVwYXJlIiwic2V0U291cmNlVGV4dHVyZSIsImJpbGF0ZXJhbEZpbHRlckVuYWJsZWQiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJzaGFkZXJEZW5vaXNlIiwibGF5ZXJzIiwiX3VwZGF0ZSIsInVwZGF0ZUNwdVNraW5NYXRyaWNlcyIsImdwdVVwZGF0ZSIsInJjdiIsInNoYWRlcnNVcGRhdGVkT24xc3RQYXNzIiwiaXNBbWJpZW50TGlnaHQiLCJudW1WaXJ0dWFsTGlnaHRzIiwiYmFrZURpciIsIndhcm4iLCJ2aXJ0dWFsTGlnaHRJbmRleCIsInByZXBhcmVWaXJ0dWFsTGlnaHQiLCJzdGFydEJha2UiLCJsaWdodFRleHR1cmVBdGxhcyIsImNsdXN0ZXJMaWdodHMiLCJjb25jYXQiLCJnYW1tYUNvcnJlY3Rpb24iLCJ1cGRhdGVTaGFkZXJzIiwicGFzc01hdGVyaWFsIiwibGFzdFZpcnR1YWxMaWdodEZvclBhc3MiLCJzZXRDYW1lcmEiLCJzZXRWYWx1ZSIsImFjdGl2YXRlIiwiX2ZvcndhcmRUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJyZW5kZXJGb3J3YXJkIiwiU0hBREVSX0ZPUldBUkRIRFIiLCJ1cGRhdGVFbmQiLCJlbmRCYWtlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK0NBLE1BQU1BLGlCQUFpQixHQUFHLElBQUksQ0FBQTtBQUU5QixNQUFNQyxVQUFVLEdBQUcsQ0FBQyxDQUFBO0FBQ3BCLE1BQU1DLFFBQVEsR0FBRyxDQUFDLENBQUE7QUFFbEIsTUFBTUMsT0FBTyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUsxQixNQUFNQyxXQUFXLENBQUM7RUFjZEMsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFQyxRQUFRLEVBQUVDLE1BQU0sRUFBRTtJQUMvQyxJQUFJLENBQUNKLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsSUFBSSxHQUFHQSxJQUFJLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxLQUFLLEdBQUdBLEtBQUssQ0FBQTtJQUNsQixJQUFJLENBQUNDLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7QUFDcEIsSUFBQSxJQUFJLENBQUNDLGNBQWMsR0FBR0YsUUFBUSxDQUFDRSxjQUFjLENBQUE7QUFFN0MsSUFBQSxJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQTtJQUN6QixJQUFJLENBQUNDLFdBQVcsR0FBRyxLQUFLLENBQUE7O0lBR3hCLElBQUksQ0FB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
