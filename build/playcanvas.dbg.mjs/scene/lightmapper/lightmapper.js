/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { math } from '../../math/math.js';
import { Color } from '../../math/color.js';
import { Vec3 } from '../../math/vec3.js';
import { BoundingBox } from '../../shape/bounding-box.js';
import { PIXELFORMAT_R8_G8_B8_A8, TEXTURETYPE_RGBM, CHUNKAPI_1_55, CULLFACE_NONE, TEXHINT_LIGHTMAP, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, TEXTURETYPE_DEFAULT } from '../../graphics/constants.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../graphics/program-lib/chunks/chunks-lightmapper.js';
import { drawQuadWithShader } from '../../graphics/simple-post-effect.js';
import { RenderTarget } from '../../graphics/render-target.js';
import { Texture } from '../../graphics/texture.js';
import { DebugGraphics } from '../../graphics/debug-graphics.js';
import { MeshInstance } from '../mesh-instance.js';
import { LightingParams } from '../lighting/lighting-params.js';
import { WorldClusters } from '../lighting/world-clusters.js';
import { PROJECTION_ORTHOGRAPHIC, MASK_AFFECT_LIGHTMAPPED, BAKE_COLORDIR, MASK_BAKE, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, FOG_NONE, LIGHTTYPE_SPOT, PROJECTION_PERSPECTIVE, LIGHTTYPE_OMNI, SHADER_FORWARDHDR, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT } from '../constants.js';
import { Camera } from '../camera.js';
import { GraphNode } from '../graph-node.js';
import { StandardMaterial } from '../materials/standard-material.js';
import { BakeLightSimple } from './bake-light-simple.js';
import { BakeLightAmbient } from './bake-light-ambient.js';
import { BakeMeshNode } from './bake-mesh-node.js';
import { LightmapCache } from './lightmap-cache.js';
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
    this.shadowMapCache = renderer._shadowRenderer.shadowMapCache;
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
        format: PIXELFORMAT_R8_G8_B8_A8,
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
        options.lightMapWithoutAmbient = true;
        options.separateAmbient = true;
        return options;
      };
    }
  }

  createTexture(size, type, name) {
    return new Texture(this.device, {
      profilerHint: TEXHINT_LIGHTMAP,
      width: size,
      height: size,
      format: PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
      type: type,
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
        const tex = this.createTexture(size, TEXTURETYPE_DEFAULT, 'lightmapper_lightmap_' + i);
        LightmapCache.incRef(tex);
        bakeNode.renderTargets[pass] = new RenderTarget({
          colorBuffer: tex,
          depth: false
        });
      }

      if (!this.renderTargets.has(size)) {
        const tex = this.createTexture(size, TEXTURETYPE_DEFAULT, 'lightmapper_temp_lightmap_' + size);
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
        this.renderer._shadowRenderer.cullDirectional(light, casters, this.camera);
      } else {
        this.renderer._shadowRenderer.cullLocal(light, casters);
      }

      this.renderer.renderShadows(lightArray[light.type], this.camera);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9saWdodG1hcHBlci9saWdodG1hcHBlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQ0hVTktBUElfMV81NSxcbiAgICBDVUxMRkFDRV9OT05FLFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9ORUFSRVNULFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgIFRFWEhJTlRfTElHSFRNQVAsXG4gICAgVEVYVFVSRVRZUEVfREVGQVVMVCwgVEVYVFVSRVRZUEVfUkdCTVxufSBmcm9tICcuLi8uLi9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3NMaWdodG1hcHBlciB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jaHVua3MtbGlnaHRtYXBwZXIuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3Mvc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vbWVzaC1pbnN0YW5jZS5qcyc7XG5cbmltcG9ydCB7IExpZ2h0aW5nUGFyYW1zIH0gZnJvbSAnLi4vbGlnaHRpbmcvbGlnaHRpbmctcGFyYW1zLmpzJztcbmltcG9ydCB7IFdvcmxkQ2x1c3RlcnMgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcycpLkFzc2V0UmVnaXN0cnl9IEFzc2V0UmVnaXN0cnkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJykuRm9yd2FyZFJlbmRlcmVyfSBGb3J3YXJkUmVuZGVyZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBTY2VuZSAqL1xuXG5pbXBvcnQge1xuICAgIEJBS0VfQ09MT1JESVIsXG4gICAgRk9HX05PTkUsXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsXG4gICAgUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUsXG4gICAgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX0RJUkxNLCBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9MTUFNQklFTlQsXG4gICAgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBTSEFET1dVUERBVEVfUkVBTFRJTUUsIFNIQURPV1VQREFURV9USElTRlJBTUVcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENhbWVyYSB9IGZyb20gJy4uL2NhbWVyYS5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQgeyBCYWtlTGlnaHRTaW1wbGUgfSBmcm9tICcuL2Jha2UtbGlnaHQtc2ltcGxlLmpzJztcbmltcG9ydCB7IEJha2VMaWdodEFtYmllbnQgfSBmcm9tICcuL2Jha2UtbGlnaHQtYW1iaWVudC5qcyc7XG5pbXBvcnQgeyBCYWtlTWVzaE5vZGUgfSBmcm9tICcuL2Jha2UtbWVzaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwQ2FjaGUgfSBmcm9tICcuL2xpZ2h0bWFwLWNhY2hlLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwRmlsdGVycyB9IGZyb20gJy4vbGlnaHRtYXAtZmlsdGVycy5qcyc7XG5cbmNvbnN0IE1BWF9MSUdIVE1BUF9TSVpFID0gMjA0ODtcblxuY29uc3QgUEFTU19DT0xPUiA9IDA7XG5jb25zdCBQQVNTX0RJUiA9IDE7XG5cbmNvbnN0IHRlbXBWZWMgPSBuZXcgVmVjMygpO1xuXG4vKipcbiAqIFRoZSBsaWdodG1hcHBlciBpcyB1c2VkIHRvIGJha2Ugc2NlbmUgbGlnaHRzIGludG8gdGV4dHVyZXMuXG4gKi9cbmNsYXNzIExpZ2h0bWFwcGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTGlnaHRtYXBwZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGxpZ2h0bWFwcGVyLlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSByb290IC0gVGhlIHJvb3QgZW50aXR5IG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZSB0byBsaWdodG1hcC5cbiAgICAgKiBAcGFyYW0ge0ZvcndhcmRSZW5kZXJlcn0gcmVuZGVyZXIgLSBUaGUgcmVuZGVyZXIuXG4gICAgICogQHBhcmFtIHtBc3NldFJlZ2lzdHJ5fSBhc3NldHMgLSBSZWdpc3RyeSBvZiBhc3NldHMgdG8gbGlnaHRtYXAuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgcm9vdCwgc2NlbmUsIHJlbmRlcmVyLCBhc3NldHMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMucm9vdCA9IHJvb3Q7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IHJlbmRlcmVyO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IGFzc2V0cztcbiAgICAgICAgdGhpcy5zaGFkb3dNYXBDYWNoZSA9IHJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlci5zaGFkb3dNYXBDYWNoZTtcblxuICAgICAgICB0aGlzLl90ZW1wU2V0ID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9pbml0Q2FsbGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gaW50ZXJuYWwgbWF0ZXJpYWxzIHVzZWQgYnkgYmFraW5nXG4gICAgICAgIHRoaXMucGFzc01hdGVyaWFscyA9IFtdO1xuICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsID0gbnVsbDtcblxuICAgICAgICB0aGlzLmZvZyA9ICcnO1xuICAgICAgICB0aGlzLmFtYmllbnRMaWdodCA9IG5ldyBDb2xvcigpO1xuXG4gICAgICAgIC8vIGRpY3Rpb25hcnkgb2Ygc3BhcmUgcmVuZGVyIHRhcmdldHMgd2l0aCBjb2xvciBidWZmZXIgZm9yIGVhY2ggdXNlZCBzaXplXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cyA9IG5ldyBNYXAoKTtcblxuICAgICAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgICAgICAgcmVuZGVyUGFzc2VzOiAwLFxuICAgICAgICAgICAgbGlnaHRtYXBDb3VudDogMCxcbiAgICAgICAgICAgIHRvdGFsUmVuZGVyVGltZTogMCxcbiAgICAgICAgICAgIGZvcndhcmRUaW1lOiAwLFxuICAgICAgICAgICAgZmJvVGltZTogMCxcbiAgICAgICAgICAgIHNoYWRvd01hcFRpbWU6IDAsXG4gICAgICAgICAgICBjb21waWxlVGltZTogMCxcbiAgICAgICAgICAgIHNoYWRlcnNMaW5rZWQ6IDBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIC8vIHJlbGVhc2UgcmVmZXJlbmNlIHRvIHRoZSB0ZXh0dXJlXG4gICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKHRoaXMuYmxhY2tUZXgpO1xuICAgICAgICB0aGlzLmJsYWNrVGV4ID0gbnVsbDtcblxuICAgICAgICAvLyBkZXN0cm95IGFsbCBsaWdodG1hcHNcbiAgICAgICAgTGlnaHRtYXBDYWNoZS5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5kZXZpY2UgPSBudWxsO1xuICAgICAgICB0aGlzLnJvb3QgPSBudWxsO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG51bGw7XG4gICAgICAgIHRoaXMuYXNzZXRzID0gbnVsbDtcbiAgICB9XG5cbiAgICBpbml0QmFrZShkZXZpY2UpIHtcblxuICAgICAgICAvLyBvbmx5IGluaXRpYWxpemUgb25lIHRpbWVcbiAgICAgICAgaWYgKCF0aGlzLl9pbml0Q2FsbGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pbml0Q2FsbGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gbGlnaHRtYXAgZmlsdGVyaW5nIHNoYWRlcnNcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzID0gbmV3IExpZ2h0bWFwRmlsdGVycyhkZXZpY2UpO1xuXG4gICAgICAgICAgICAvLyBzaGFkZXIgcmVsYXRlZFxuICAgICAgICAgICAgdGhpcy5jb25zdGFudEJha2VEaXIgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnYmFrZURpcicpO1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbHMgPSBbXTtcblxuICAgICAgICAgICAgLy8gc21hbGwgYmxhY2sgdGV4dHVyZVxuICAgICAgICAgICAgdGhpcy5ibGFja1RleCA9IG5ldyBUZXh0dXJlKHRoaXMuZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IDQsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiA0LFxuICAgICAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsXG4gICAgICAgICAgICAgICAgdHlwZTogVEVYVFVSRVRZUEVfUkdCTSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnbGlnaHRtYXBCbGFjaydcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBpbmNyZWYgYmxhY2sgdGV4dHVyZSBpbiB0aGUgY2FjaGUgdG8gYXZvaWQgaXQgYmVpbmcgZGVzdHJveWVkXG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0aGlzLmJsYWNrVGV4KTtcblxuICAgICAgICAgICAgLy8gY2FtZXJhIHVzZWQgZm9yIGJha2luZ1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbmV3IENhbWVyYSgpO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyQ29sb3Iuc2V0KDAsIDAsIDAsIDApO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXIgPSB0cnVlO1xuICAgICAgICAgICAgY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbWVyYS5mcnVzdHVtQ3VsbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgY2FtZXJhLnByb2plY3Rpb24gPSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQztcbiAgICAgICAgICAgIGNhbWVyYS5hc3BlY3RSYXRpbyA9IDE7XG4gICAgICAgICAgICBjYW1lcmEubm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGxpZ2h0IGNsdXN0ZXIgc3RydWN0dXJlXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgbGlnaHQgcGFyYW1zLCBhbmQgYmFzZSBtb3N0IHBhcmFtZXRlcnMgb24gdGhlIGxpZ2h0aW5nIHBhcmFtcyBvZiB0aGUgc2NlbmVcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0aW5nUGFyYW1zID0gbmV3IExpZ2h0aW5nUGFyYW1zKGRldmljZS5zdXBwb3J0c0FyZWFMaWdodHMsIGRldmljZS5tYXhUZXh0dXJlU2l6ZSwgKCkgPT4ge30pO1xuICAgICAgICAgICAgdGhpcy5saWdodGluZ1BhcmFtcyA9IGxpZ2h0aW5nUGFyYW1zO1xuXG4gICAgICAgICAgICBjb25zdCBzcmNQYXJhbXMgPSB0aGlzLnNjZW5lLmxpZ2h0aW5nO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuc2hhZG93c0VuYWJsZWQgPSBzcmNQYXJhbXMuc2hhZG93c0VuYWJsZWQ7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5zaGFkb3dBdGxhc1Jlc29sdXRpb24gPSBzcmNQYXJhbXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuXG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5jb29raWVzRW5hYmxlZCA9IHNyY1BhcmFtcy5jb29raWVzRW5hYmxlZDtcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmNvb2tpZUF0bGFzUmVzb2x1dGlvbiA9IHNyY1BhcmFtcy5jb29raWVBdGxhc1Jlc29sdXRpb247XG5cbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLmFyZWFMaWdodHNFbmFibGVkID0gc3JjUGFyYW1zLmFyZWFMaWdodHNFbmFibGVkO1xuXG4gICAgICAgICAgICAvLyBzb21lIGN1c3RvbSBsaWdodG1hcHBpbmcgcGFyYW1zIC0gd2UgYmFrZSBzaW5nbGUgbGlnaHQgYSB0aW1lXG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5jZWxscyA9IG5ldyBWZWMzKDMsIDMsIDMpO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMubWF4TGlnaHRzUGVyQ2VsbCA9IDQ7XG5cbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycyA9IG5ldyBXb3JsZENsdXN0ZXJzKGRldmljZSk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMubmFtZSA9ICdDbHVzdGVyTGlnaHRtYXBwZXInO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZmluaXNoQmFrZShiYWtlTm9kZXMpIHtcblxuICAgICAgICB0aGlzLm1hdGVyaWFscyA9IFtdO1xuXG4gICAgICAgIGZ1bmN0aW9uIGRlc3Ryb3lSVChydCkge1xuICAgICAgICAgICAgLy8gdGhpcyBjYW4gY2F1c2UgcmVmIGNvdW50IHRvIGJlIDAgYW5kIHRleHR1cmUgZGVzdHJveWVkXG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZihydC5jb2xvckJ1ZmZlcik7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgcmVuZGVyIHRhcmdldCBpdHNlbGZcbiAgICAgICAgICAgIHJ0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNwYXJlIHJlbmRlciB0YXJnZXRzIGluY2x1ZGluZyBjb2xvciBidWZmZXJcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLmZvckVhY2goKHJ0KSA9PiB7XG4gICAgICAgICAgICBkZXN0cm95UlQocnQpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLmNsZWFyKCk7XG5cbiAgICAgICAgLy8gZGVzdHJveSByZW5kZXIgdGFyZ2V0cyBmcm9tIG5vZGVzIChidXQgbm90IGNvbG9yIGJ1ZmZlcilcbiAgICAgICAgYmFrZU5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyVGFyZ2V0cy5mb3JFYWNoKChydCkgPT4ge1xuICAgICAgICAgICAgICAgIGRlc3Ryb3lSVChydCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyVGFyZ2V0cy5sZW5ndGggPSAwO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyB0aGlzIHNoYWRlciBpcyBvbmx5IHZhbGlkIGZvciBzcGVjaWZpYyBicmlnaHRuZXNzIGFuZCBjb250cmFzdCB2YWx1ZXMsIGRpc3Bvc2UgaXRcbiAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVsZXRlIGxpZ2h0IGNsdXN0ZXJcbiAgICAgICAgaWYgKHRoaXMud29ybGRDbHVzdGVycykge1xuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVNYXRlcmlhbEZvclBhc3MoZGV2aWNlLCBzY2VuZSwgcGFzcywgYWRkQW1iaWVudCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBgbG1NYXRlcmlhbC1wYXNzOiR7cGFzc30tYW1iaWVudDoke2FkZEFtYmllbnR9YDtcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLkFQSVZlcnNpb24gPSBDSFVOS0FQSV8xXzU1O1xuICAgICAgICBtYXRlcmlhbC5jaHVua3MudHJhbnNmb3JtVlMgPSAnI2RlZmluZSBVVjFMQVlPVVRcXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTOyAvLyBkcmF3IFVWMVxuXG4gICAgICAgIGlmIChwYXNzID09PSBQQVNTX0NPTE9SKSB7XG4gICAgICAgICAgICBsZXQgYmFrZUxtRW5kQ2h1bmsgPSBzaGFkZXJDaHVua3NMaWdodG1hcHBlci5iYWtlTG1FbmRQUzsgLy8gZW5jb2RlIHRvIFJHQk1cbiAgICAgICAgICAgIGlmIChhZGRBbWJpZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gZGlmZnVzZSBsaWdodCBzdG9yZXMgYWNjdW11bGF0ZWQgQU8sIGFwcGx5IGNvbnRyYXN0IGFuZCBicmlnaHRuZXNzIHRvIGl0XG4gICAgICAgICAgICAgICAgLy8gYW5kIG11bHRpcGx5IGFtYmllbnQgbGlnaHQgY29sb3IgYnkgdGhlIEFPXG4gICAgICAgICAgICAgICAgYmFrZUxtRW5kQ2h1bmsgPSBgXG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgPSAoKGREaWZmdXNlTGlnaHQgLSAwLjUpICogbWF4KCR7c2NlbmUuYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdC50b0ZpeGVkKDEpfSArIDEuMCwgMC4wKSkgKyAwLjU7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgKz0gdmVjMygke3NjZW5lLmFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcy50b0ZpeGVkKDEpfSk7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgPSBzYXR1cmF0ZShkRGlmZnVzZUxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgZERpZmZ1c2VMaWdodCAqPSBkQW1iaWVudExpZ2h0O1xuICAgICAgICAgICAgICAgIGAgKyBiYWtlTG1FbmRDaHVuaztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYW1iaWVudCA9IG5ldyBDb2xvcigwLCAwLCAwKTsgICAgLy8gZG9uJ3QgYmFrZSBhbWJpZW50XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYW1iaWVudFRpbnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmVuZFBTID0gYmFrZUxtRW5kQ2h1bms7XG4gICAgICAgICAgICBtYXRlcmlhbC5saWdodE1hcCA9IHRoaXMuYmxhY2tUZXg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MuYmFzZVBTID0gc2hhZGVyQ2h1bmtzLmJhc2VQUyArICdcXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2RpckxpZ2h0TWFwO1xcbnVuaWZvcm0gZmxvYXQgYmFrZURpcjtcXG4nO1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmVuZFBTID0gc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIuYmFrZURpckxtRW5kUFM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhdm9pZCB3cml0aW5nIHVucmVsYXRlZCB0aGluZ3MgdG8gYWxwaGFcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLm91dHB1dEFscGhhUFMgPSAnXFxuJztcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLm91dHB1dEFscGhhT3BhcXVlUFMgPSAnXFxuJztcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLm91dHB1dEFscGhhUHJlbXVsUFMgPSAnXFxuJztcbiAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX05PTkU7XG4gICAgICAgIG1hdGVyaWFsLmZvcmNlVXYxID0gdHJ1ZTsgLy8gcHJvdmlkZSBkYXRhIHRvIHhmb3JtVXYxXG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9XG5cbiAgICBjcmVhdGVNYXRlcmlhbHMoZGV2aWNlLCBzY2VuZSwgcGFzc0NvdW50KSB7XG4gICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5wYXNzTWF0ZXJpYWxzW3Bhc3NdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXNzTWF0ZXJpYWxzW3Bhc3NdID0gdGhpcy5jcmVhdGVNYXRlcmlhbEZvclBhc3MoZGV2aWNlLCBzY2VuZSwgcGFzcywgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWF0ZXJpYWwgdXNlZCBvbiBsYXN0IHJlbmRlciBvZiBhbWJpZW50IGxpZ2h0IHRvIG11bHRpcGx5IGFjY3VtdWxhdGVkIEFPIGluIGxpZ2h0bWFwIGJ5IGFtYmllbnQgbGlnaHRcbiAgICAgICAgaWYgKCF0aGlzLmFtYmllbnRBT01hdGVyaWFsKSB7XG4gICAgICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsID0gdGhpcy5jcmVhdGVNYXRlcmlhbEZvclBhc3MoZGV2aWNlLCBzY2VuZSwgMCwgdHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmFtYmllbnRBT01hdGVyaWFsLm9uVXBkYXRlU2hhZGVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIExNIGFzIHdpdGhvdXQgYW1iaWVudCwgdG8gYWRkIGl0XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saWdodE1hcFdpdGhvdXRBbWJpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBhZGQgYW1iaWVudCB0byBkaWZmdXNlIGRpcmVjdGx5IGJ1dCBrZWVwIGl0IHNlcGFyYXRlLCB0byBhbGxvdyBBTyB0byBiZSBtdWx0aXBsaWVkIGluXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5zZXBhcmF0ZUFtYmllbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZVRleHR1cmUoc2l6ZSwgdHlwZSwgbmFtZSkge1xuXG4gICAgICAgIHJldHVybiBuZXcgVGV4dHVyZSh0aGlzLmRldmljZSwge1xuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgcHJvZmlsZXJIaW50OiBURVhISU5UX0xJR0hUTUFQLFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB3aWR0aDogc2l6ZSxcbiAgICAgICAgICAgIGhlaWdodDogc2l6ZSxcbiAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsXG4gICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgbmFtZTogbmFtZVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyByZWN1cnNpdmVseSB3YWxrIHRoZSBoaWVyYXJjaHkgb2Ygbm9kZXMgc3RhcnRpbmcgYXQgdGhlIHNwZWNpZmllZCBub2RlXG4gICAgLy8gY29sbGVjdCBhbGwgbm9kZXMgdGhhdCBuZWVkIHRvIGJlIGxpZ2h0bWFwcGVkIHRvIGJha2VOb2RlcyBhcnJheVxuICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIHdpdGggZ2VvbWV0cnkgdG8gYWxsTm9kZXMgYXJyYXlcbiAgICBjb2xsZWN0TW9kZWxzKG5vZGUsIGJha2VOb2RlcywgYWxsTm9kZXMpIHtcbiAgICAgICAgaWYgKCFub2RlLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICAvLyBtZXNoIGluc3RhbmNlcyBmcm9tIG1vZGVsIGNvbXBvbmVudFxuICAgICAgICBsZXQgbWVzaEluc3RhbmNlcztcbiAgICAgICAgaWYgKG5vZGUubW9kZWw/Lm1vZGVsICYmIG5vZGUubW9kZWw/LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChhbGxOb2RlcykgYWxsTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUpKTtcbiAgICAgICAgICAgIGlmIChub2RlLm1vZGVsLmxpZ2h0bWFwcGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJha2VOb2Rlcykge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzID0gbm9kZS5tb2RlbC5tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1lc2ggaW5zdGFuY2VzIGZyb20gcmVuZGVyIGNvbXBvbmVudFxuICAgICAgICBpZiAobm9kZS5yZW5kZXI/LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChhbGxOb2RlcykgYWxsTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUpKTtcbiAgICAgICAgICAgIGlmIChub2RlLnJlbmRlci5saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgICAgIGlmIChiYWtlTm9kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcyA9IG5vZGUucmVuZGVyLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGxldCBoYXNVdjEgPSB0cnVlO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZXNbaV0ubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MSkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5sb2coYExpZ2h0bWFwcGVyIC0gbm9kZSBbJHtub2RlLm5hbWV9XSBjb250YWlucyBtZXNoZXMgd2l0aG91dCByZXF1aXJlZCB1djEsIGV4Y2x1ZGluZyBpdCBmcm9tIGJha2luZy5gKTtcbiAgICAgICAgICAgICAgICAgICAgaGFzVXYxID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGhhc1V2MSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGlzIG1lc2ggYW4gaW5zdGFuY2Ugb2YgYWxyZWFkeSB1c2VkIG1lc2ggaW4gdGhpcyBub2RlXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl90ZW1wU2V0LmhhcyhtZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29sbGVjdCBlYWNoIGluc3RhbmNlIChvYmplY3Qgd2l0aCBzaGFyZWQgVkIpIGFzIHNlcGFyYXRlIFwibm9kZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUsIFttZXNoSW5zdGFuY2VzW2ldXSkpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcy5wdXNoKG1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RlbXBTZXQuYWRkKG1lc2gpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3RlbXBTZXQuY2xlYXIoKTtcblxuICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgYWxsIG5vbi1zaGFyZWQgb2JqZWN0cyBhcyBvbmUgXCJub2RlXCJcbiAgICAgICAgICAgICAgICBpZiAobm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGJha2VOb2Rlcy5wdXNoKG5ldyBCYWtlTWVzaE5vZGUobm9kZSwgbm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdE1vZGVscyhub2RlLl9jaGlsZHJlbltpXSwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlIGFsbCBtZXNoSW5zdGFuY2VzIHRoYXQgY2FzdCBzaGFkb3dzIGludG8gbGlnaHRtYXBzXG4gICAgcHJlcGFyZVNoYWRvd0Nhc3RlcnMobm9kZXMpIHtcblxuICAgICAgICBjb25zdCBjYXN0ZXJzID0gW107XG4gICAgICAgIGZvciAobGV0IG4gPSAwOyBuIDwgbm9kZXMubGVuZ3RoOyBuKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGVzW25dLmNvbXBvbmVudDtcblxuICAgICAgICAgICAgY29tcG9uZW50LmNhc3RTaGFkb3dzID0gY29tcG9uZW50LmNhc3RTaGFkb3dzTGlnaHRtYXA7XG4gICAgICAgICAgICBpZiAoY29tcG9uZW50LmNhc3RTaGFkb3dzTGlnaHRtYXApIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hlcyA9IG5vZGVzW25dLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaGVzW2ldLnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjYXN0ZXJzLnB1c2gobWVzaGVzW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2FzdGVycztcbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIHdvcmxkIHRyYW5zZm9ybSBmb3Igbm9kZXNcbiAgICB1cGRhdGVUcmFuc2Zvcm1zKG5vZGVzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG5vZGVzW2ldLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2pdLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE5vdGU6IHRoaXMgZnVuY3Rpb24gaXMgYWxzbyBjYWxsZWQgYnkgdGhlIEVkaXRvciB0byBkaXNwbGF5IGVzdGltYXRlZCBMTSBzaXplIGluIHRoZSBpbnNwZWN0b3IsXG4gICAgLy8gZG8gbm90IGNoYW5nZSBpdHMgc2lnbmF0dXJlLlxuICAgIGNhbGN1bGF0ZUxpZ2h0bWFwU2l6ZShub2RlKSB7XG4gICAgICAgIGxldCBkYXRhO1xuICAgICAgICBjb25zdCBzaXplTXVsdCA9IHRoaXMuc2NlbmUubGlnaHRtYXBTaXplTXVsdGlwbGllciB8fCAxNjtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSB0ZW1wVmVjO1xuXG4gICAgICAgIGxldCBzcmNBcmVhLCBsaWdodG1hcFNpemVNdWx0aXBsaWVyO1xuXG4gICAgICAgIGlmIChub2RlLm1vZGVsKSB7XG4gICAgICAgICAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyID0gbm9kZS5tb2RlbC5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICAgICAgaWYgKG5vZGUubW9kZWwuYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gdGhpcy5hc3NldHMuZ2V0KG5vZGUubW9kZWwuYXNzZXQpLmRhdGE7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5hcmVhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobm9kZS5tb2RlbC5fYXJlYSkge1xuICAgICAgICAgICAgICAgIGRhdGEgPSBub2RlLm1vZGVsO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLl9hcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgIHNyY0FyZWEgPSBkYXRhLl9hcmVhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChub2RlLnJlbmRlcikge1xuICAgICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IG5vZGUucmVuZGVyLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIudHlwZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIGlmIChub2RlLnJlbmRlci5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gbm9kZS5yZW5kZXI7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLl9hcmVhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5fYXJlYTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvcHkgYXJlYVxuICAgICAgICBjb25zdCBhcmVhID0geyB4OiAxLCB5OiAxLCB6OiAxLCB1djogMSB9O1xuICAgICAgICBpZiAoc3JjQXJlYSkge1xuICAgICAgICAgICAgYXJlYS54ID0gc3JjQXJlYS54O1xuICAgICAgICAgICAgYXJlYS55ID0gc3JjQXJlYS55O1xuICAgICAgICAgICAgYXJlYS56ID0gc3JjQXJlYS56O1xuICAgICAgICAgICAgYXJlYS51diA9IHNyY0FyZWEudXY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcmVhTXVsdCA9IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgfHwgMTtcbiAgICAgICAgYXJlYS54ICo9IGFyZWFNdWx0O1xuICAgICAgICBhcmVhLnkgKj0gYXJlYU11bHQ7XG4gICAgICAgIGFyZWEueiAqPSBhcmVhTXVsdDtcblxuICAgICAgICAvLyBib3VuZHMgb2YgdGhlIGNvbXBvbmVudFxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLnJlbmRlciB8fCBub2RlLm1vZGVsO1xuICAgICAgICBjb25zdCBib3VuZHMgPSB0aGlzLmNvbXB1dGVOb2RlQm91bmRzKGNvbXBvbmVudC5tZXNoSW5zdGFuY2VzKTtcblxuICAgICAgICAvLyB0b3RhbCBhcmVhIGluIHRoZSBsaWdodG1hcCBpcyBiYXNlZCBvbiB0aGUgd29ybGQgc3BhY2UgYm91bmRzIG9mIHRoZSBtZXNoXG4gICAgICAgIHNjYWxlLmNvcHkoYm91bmRzLmhhbGZFeHRlbnRzKTtcbiAgICAgICAgbGV0IHRvdGFsQXJlYSA9IGFyZWEueCAqIHNjYWxlLnkgKiBzY2FsZS56ICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWEueSAqIHNjYWxlLnggKiBzY2FsZS56ICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWEueiAqIHNjYWxlLnggKiBzY2FsZS55O1xuICAgICAgICB0b3RhbEFyZWEgLz0gYXJlYS51djtcbiAgICAgICAgdG90YWxBcmVhID0gTWF0aC5zcXJ0KHRvdGFsQXJlYSk7XG5cbiAgICAgICAgY29uc3QgbGlnaHRtYXBTaXplID0gTWF0aC5taW4obWF0aC5uZXh0UG93ZXJPZlR3byh0b3RhbEFyZWEgKiBzaXplTXVsdCksIHRoaXMuc2NlbmUubGlnaHRtYXBNYXhSZXNvbHV0aW9uIHx8IE1BWF9MSUdIVE1BUF9TSVpFKTtcblxuICAgICAgICByZXR1cm4gbGlnaHRtYXBTaXplO1xuICAgIH1cblxuICAgIHNldExpZ2h0bWFwcGluZyhub2RlcywgdmFsdWUsIHBhc3NDb3VudCwgc2hhZGVyRGVmcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGorKykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gbWVzaEluc3RhbmNlc1tqXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0TGlnaHRtYXBwZWQodmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaGFkZXJEZWZzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3NoYWRlckRlZnMgfD0gc2hhZGVyRGVmcztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgbGlnaHRzIHRoYXQgYWZmZWN0IGxpZ2h0bWFwcGVkIG9iamVjdHMgYXJlIHVzZWQgb24gdGhpcyBtZXNoIG5vdyB0aGF0IGl0IGlzIGJha2VkXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXNrID0gTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gbm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdLmNvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Lm1pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXgubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbcGFzc10sIHRleCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYW5kIGFwcGxpZXMgdGhlIGxpZ2h0bWFwcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RW50aXR5W118bnVsbH0gbm9kZXMgLSBBbiBhcnJheSBvZiBlbnRpdGllcyAod2l0aCBtb2RlbCBvciByZW5kZXIgY29tcG9uZW50cykgdG9cbiAgICAgKiByZW5kZXIgbGlnaHRtYXBzIGZvci4gSWYgbm90IHN1cHBsaWVkLCB0aGUgZW50aXJlIHNjZW5lIHdpbGwgYmUgYmFrZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttb2RlXSAtIEJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3JcbiAgICAgKiBidW1wL3NwZWN1bGFyKVxuICAgICAqXG4gICAgICogT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24uXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEJBS0VfQ09MT1JESVJ9LlxuICAgICAqL1xuICAgIGJha2Uobm9kZXMsIG1vZGUgPSBCQUtFX0NPTE9SRElSKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBza3lib3hcbiAgICAgICAgdGhpcy5zY2VuZS5fdXBkYXRlU2t5KGRldmljZSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBkZXZpY2UuZmlyZSgnbGlnaHRtYXBwZXI6c3RhcnQnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IHN0YXJ0VGltZSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5zdGF0cy5yZW5kZXJQYXNzZXMgPSAwO1xuICAgICAgICB0aGlzLnN0YXRzLnNoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnN0YXRzLmZvcndhcmRUaW1lID0gMDtcbiAgICAgICAgY29uc3Qgc3RhcnRTaGFkZXJzID0gZGV2aWNlLl9zaGFkZXJTdGF0cy5saW5rZWQ7XG4gICAgICAgIGNvbnN0IHN0YXJ0RmJvVGltZSA9IGRldmljZS5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lO1xuICAgICAgICBjb25zdCBzdGFydENvbXBpbGVUaW1lID0gZGV2aWNlLl9zaGFkZXJTdGF0cy5jb21waWxlVGltZTtcblxuICAgICAgICAvLyBCYWtlTWVzaE5vZGUgb2JqZWN0cyBmb3IgYmFraW5nXG4gICAgICAgIGNvbnN0IGJha2VOb2RlcyA9IFtdO1xuXG4gICAgICAgIC8vIGFsbCBCYWtlTWVzaE5vZGUgb2JqZWN0c1xuICAgICAgICBjb25zdCBhbGxOb2RlcyA9IFtdO1xuXG4gICAgICAgIC8vIGNvbGxlY3Qgbm9kZXMgLyBtZXNoSW5zdGFuY2VzIGZvciBiYWtpbmdcbiAgICAgICAgaWYgKG5vZGVzKSB7XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3Qgbm9kZXMgZm9yIGJha2luZyBiYXNlZCBvbiBzcGVjaWZpZWQgbGlzdCBvZiBub2Rlc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuY29sbGVjdE1vZGVscyhub2Rlc1tpXSwgYmFrZU5vZGVzLCBudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY29sbGVjdCBhbGwgbm9kZXMgZnJvbSB0aGUgc2NlbmVcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdE1vZGVscyh0aGlzLnJvb3QsIG51bGwsIGFsbE5vZGVzKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIGZyb20gdGhlIHJvb3Qgb2YgdGhlIHNjZW5lXG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHModGhpcy5yb290LCBiYWtlTm9kZXMsIGFsbE5vZGVzKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuZGV2aWNlLCAnTE1CYWtlJyk7XG5cbiAgICAgICAgLy8gYmFrZSBub2Rlc1xuICAgICAgICBpZiAoYmFrZU5vZGVzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgICAgLy8gZGlzYWJsZSBsaWdodG1hcHBpbmdcbiAgICAgICAgICAgIGNvbnN0IHBhc3NDb3VudCA9IG1vZGUgPT09IEJBS0VfQ09MT1JESVIgPyAyIDogMTtcbiAgICAgICAgICAgIHRoaXMuc2V0TGlnaHRtYXBwaW5nKGJha2VOb2RlcywgZmFsc2UsIHBhc3NDb3VudCk7XG5cbiAgICAgICAgICAgIHRoaXMuaW5pdEJha2UoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuYmFrZUludGVybmFsKHBhc3NDb3VudCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgICAgIC8vIEVuYWJsZSBuZXcgbGlnaHRtYXBzXG4gICAgICAgICAgICBsZXQgc2hhZGVyRGVmcyA9IFNIQURFUkRFRl9MTTtcblxuICAgICAgICAgICAgaWYgKG1vZGUgPT09IEJBS0VfQ09MT1JESVIpIHtcbiAgICAgICAgICAgICAgICBzaGFkZXJEZWZzIHw9IFNIQURFUkRFRl9ESVJMTTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbWFyayBsaWdodG1hcCBhcyBjb250YWluaW5nIGFtYmllbnQgbGlnaHRpbmdcbiAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfTE1BTUJJRU5UO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZXRMaWdodG1hcHBpbmcoYmFrZU5vZGVzLCB0cnVlLCBwYXNzQ291bnQsIHNoYWRlckRlZnMpO1xuXG4gICAgICAgICAgICAvLyBjbGVhbiB1cCBtZW1vcnlcbiAgICAgICAgICAgIHRoaXMuZmluaXNoQmFrZShiYWtlTm9kZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIGNvbnN0IG5vd1RpbWUgPSBub3coKTtcbiAgICAgICAgdGhpcy5zdGF0cy50b3RhbFJlbmRlclRpbWUgPSBub3dUaW1lIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLnNoYWRlcnNMaW5rZWQgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmxpbmtlZCAtIHN0YXJ0U2hhZGVycztcbiAgICAgICAgdGhpcy5zdGF0cy5jb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWUgLSBzdGFydENvbXBpbGVUaW1lO1xuICAgICAgICB0aGlzLnN0YXRzLmZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSAtIHN0YXJ0RmJvVGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5saWdodG1hcENvdW50ID0gYmFrZU5vZGVzLmxlbmd0aDtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGRldmljZS5maXJlKCdsaWdodG1hcHBlcjplbmQnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vd1RpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8vIHRoaXMgYWxsb2NhdGVzIGxpZ2h0bWFwIHRleHR1cmVzIGFuZCByZW5kZXIgdGFyZ2V0cy4gTm90ZSB0aGF0IHRoZSB0eXBlIHVzZWQgaGVyZSBpcyBhbHdheXMgVEVYVFVSRVRZUEVfREVGQVVMVCxcbiAgICAvLyBhcyB3ZSBwaW5nLXBvbmcgYmV0d2VlbiB2YXJpb3VzIHJlbmRlciB0YXJnZXRzIGFueXdheXMsIGFuZCBzaGFkZXIgdXNlcyBoYXJkY29kZWQgdHlwZXMgYW5kIGlnbm9yZXMgaXQgYW55d2F5cy5cbiAgICBhbGxvY2F0ZVRleHR1cmVzKGJha2VOb2RlcywgcGFzc0NvdW50KSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYWtlTm9kZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgLy8gcmVxdWlyZWQgbGlnaHRtYXAgc2l6ZVxuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gdGhpcy5jYWxjdWxhdGVMaWdodG1hcFNpemUoYmFrZU5vZGUubm9kZSk7XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmUgYW5kIHJlbmRlciB0YXJnZXQgZm9yIGVhY2ggcGFzcywgc3RvcmVkIHBlciBub2RlXG4gICAgICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5jcmVhdGVUZXh0dXJlKHNpemUsIFRFWFRVUkVUWVBFX0RFRkFVTFQsICgnbGlnaHRtYXBwZXJfbGlnaHRtYXBfJyArIGkpKTtcbiAgICAgICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXgpO1xuICAgICAgICAgICAgICAgIGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc10gPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IHRleCxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNpbmdsZSB0ZW1wb3JhcnkgcmVuZGVyIHRhcmdldCBvZiBlYWNoIHNpemVcbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXRzLmhhcyhzaXplKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuY3JlYXRlVGV4dHVyZShzaXplLCBURVhUVVJFVFlQRV9ERUZBVUxULCAoJ2xpZ2h0bWFwcGVyX3RlbXBfbGlnaHRtYXBfJyArIHNpemUpKTtcbiAgICAgICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5zZXQoc2l6ZSwgbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgsXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByZXBhcmVMaWdodHNUb0Jha2UobGF5ZXJDb21wb3NpdGlvbiwgYWxsTGlnaHRzLCBiYWtlTGlnaHRzKSB7XG5cbiAgICAgICAgLy8gYW1iaWVudCBsaWdodFxuICAgICAgICBpZiAodGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgY29uc3QgYW1iaWVudExpZ2h0ID0gbmV3IEJha2VMaWdodEFtYmllbnQodGhpcy5zY2VuZSk7XG4gICAgICAgICAgICBiYWtlTGlnaHRzLnB1c2goYW1iaWVudExpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjZW5lIGxpZ2h0c1xuICAgICAgICBjb25zdCBzY2VuZUxpZ2h0cyA9IGxheWVyQ29tcG9zaXRpb24uX2xpZ2h0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZUxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBzY2VuZUxpZ2h0c1tpXTtcblxuICAgICAgICAgICAgLy8gc3RvcmUgYWxsIGxpZ2h0cyBhbmQgdGhlaXIgb3JpZ2luYWwgc2V0dGluZ3Mgd2UgbmVlZCB0byB0ZW1wb3JhcmlseSBtb2RpZnlcbiAgICAgICAgICAgIGNvbnN0IGJha2VMaWdodCA9IG5ldyBCYWtlTGlnaHRTaW1wbGUodGhpcy5zY2VuZSwgbGlnaHQpO1xuICAgICAgICAgICAgYWxsTGlnaHRzLnB1c2goYmFrZUxpZ2h0KTtcblxuICAgICAgICAgICAgLy8gYmFrZSBsaWdodFxuICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQgJiYgKGxpZ2h0Lm1hc2sgJiBNQVNLX0JBS0UpICE9PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBiYWtlZCwgaXQgY2FuJ3QgYmUgdXNlZCBhcyBzdGF0aWNcbiAgICAgICAgICAgICAgICBsaWdodC5pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgbGlnaHQubWFzayA9IDB4RkZGRkZGRkY7XG4gICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93VXBkYXRlTW9kZSA9IGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA/IFNIQURPV1VQREFURV9SRUFMVElNRSA6IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgICAgICAgICAgYmFrZUxpZ2h0cy5wdXNoKGJha2VMaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzb3J0IGJha2UgbGlnaHRzIGJ5IHR5cGUgdG8gbWluaW1pemUgc2hhZGVyIHN3aXRjaGVzXG4gICAgICAgIGJha2VMaWdodHMuc29ydCgpO1xuICAgIH1cblxuICAgIHJlc3RvcmVMaWdodHMoYWxsTGlnaHRzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFsbExpZ2h0c1tpXS5yZXN0b3JlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFNjZW5lKCkge1xuXG4gICAgICAgIC8vIGxpZ2h0bWFwcGVyIG5lZWRzIG9yaWdpbmFsIG1vZGVsIGRyYXcgY2FsbHNcbiAgICAgICAgdGhpcy5yZXZlcnRTdGF0aWMgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuX25lZWRzU3RhdGljUHJlcGFyZSkge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5fbmVlZHNTdGF0aWNQcmVwYXJlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnJldmVydFN0YXRpYyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBiYWNrdXBcbiAgICAgICAgdGhpcy5mb2cgPSB0aGlzLnNjZW5lLmZvZztcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQuY29weSh0aGlzLnNjZW5lLmFtYmllbnRMaWdodCk7XG5cbiAgICAgICAgLy8gc2V0IHVwIHNjZW5lXG4gICAgICAgIHRoaXMuc2NlbmUuZm9nID0gRk9HX05PTkU7XG5cbiAgICAgICAgLy8gaWYgbm90IGJha2luZyBhbWJpZW50LCBzZXQgaXQgdG8gYmxhY2tcbiAgICAgICAgaWYgKCF0aGlzLnNjZW5lLmFtYmllbnRCYWtlKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLmFtYmllbnRMaWdodC5zZXQoMCwgMCwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcHBseSBzY2VuZSBzZXR0aW5nc1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFNjZW5lQ29uc3RhbnRzKCk7XG4gICAgfVxuXG4gICAgcmVzdG9yZVNjZW5lKCkge1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZm9nID0gdGhpcy5mb2c7XG4gICAgICAgIHRoaXMuc2NlbmUuYW1iaWVudExpZ2h0LmNvcHkodGhpcy5hbWJpZW50TGlnaHQpO1xuXG4gICAgICAgIC8vIFJldmVydCBzdGF0aWMgcHJlcHJvY2Vzc2luZ1xuICAgICAgICBpZiAodGhpcy5yZXZlcnRTdGF0aWMpIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX25lZWRzU3RhdGljUHJlcGFyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGJvdW5kaW5nIGJveCBmb3IgYSBzaW5nbGUgbm9kZVxuICAgIGNvbXB1dGVOb2RlQm91bmRzKG1lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICBjb25zdCBib3VuZHMgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgICAgICBpZiAobWVzaEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBib3VuZHMuY29weShtZXNoSW5zdGFuY2VzWzBdLmFhYmIpO1xuICAgICAgICAgICAgZm9yIChsZXQgbSA9IDE7IG0gPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgYm91bmRzLmFkZChtZXNoSW5zdGFuY2VzW21dLmFhYmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJvdW5kcztcbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGJvdW5kaW5nIGJveCBmb3IgZWFjaCBub2RlXG4gICAgY29tcHV0ZU5vZGVzQm91bmRzKG5vZGVzKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG5vZGVzW2ldLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBub2Rlc1tpXS5ib3VuZHMgPSB0aGlzLmNvbXB1dGVOb2RlQm91bmRzKG1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBjb21wb3VuZCBib3VuZGluZyBib3ggZm9yIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgY29tcHV0ZUJvdW5kcyhtZXNoSW5zdGFuY2VzKSB7XG5cbiAgICAgICAgY29uc3QgYm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBib3VuZHMuY29weShtZXNoSW5zdGFuY2VzWzBdLmFhYmIpO1xuICAgICAgICAgICAgZm9yIChsZXQgbSA9IDE7IG0gPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgYm91bmRzLmFkZChtZXNoSW5zdGFuY2VzW21dLmFhYmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJvdW5kcztcbiAgICB9XG5cbiAgICBiYWNrdXBNYXRlcmlhbHMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWxzW2ldID0gbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3RvcmVNYXRlcmlhbHMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsc1tpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxpZ2h0Q2FtZXJhUHJlcGFyZShkZXZpY2UsIGJha2VMaWdodCkge1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0ID0gYmFrZUxpZ2h0LmxpZ2h0O1xuICAgICAgICBsZXQgc2hhZG93Q2FtO1xuXG4gICAgICAgIC8vIG9ubHkgcHJlcGFyZSBjYW1lcmEgZm9yIHNwb3QgbGlnaHQsIG90aGVyIGNhbWVyYXMgbmVlZCB0byBiZSBhZGp1c3RlZCBwZXIgY3ViZW1hcCBmYWNlIC8gcGVyIG5vZGUgbGF0ZXJcbiAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICBzaGFkb3dDYW0gPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhO1xuXG4gICAgICAgICAgICBzaGFkb3dDYW0uX25vZGUuc2V0UG9zaXRpb24obGlnaHQuX25vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBzaGFkb3dDYW0uX25vZGUuc2V0Um90YXRpb24obGlnaHQuX25vZGUuZ2V0Um90YXRpb24oKSk7XG4gICAgICAgICAgICBzaGFkb3dDYW0uX25vZGUucm90YXRlTG9jYWwoLTkwLCAwLCAwKTtcblxuICAgICAgICAgICAgc2hhZG93Q2FtLnByb2plY3Rpb24gPSBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgICAgICAgICAgc2hhZG93Q2FtLm5lYXJDbGlwID0gbGlnaHQuYXR0ZW51YXRpb25FbmQgLyAxMDAwO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZhckNsaXAgPSBsaWdodC5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5hc3BlY3RSYXRpbyA9IDE7XG4gICAgICAgICAgICBzaGFkb3dDYW0uZm92ID0gbGlnaHQuX291dGVyQ29uZUFuZ2xlICogMjtcblxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci51cGRhdGVDYW1lcmFGcnVzdHVtKHNoYWRvd0NhbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNoYWRvd0NhbTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyBjYW1lcmEgLyBmcnVzdHVtIG9mIHRoZSBsaWdodCBmb3IgcmVuZGVyaW5nIHRoZSBiYWtlTm9kZVxuICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBsaWdodCBhZmZlY3RzIHRoZSBiYWtlTm9kZVxuICAgIGxpZ2h0Q2FtZXJhUHJlcGFyZUFuZEN1bGwoYmFrZUxpZ2h0LCBiYWtlTm9kZSwgc2hhZG93Q2FtLCBjYXN0ZXJCb3VuZHMpIHtcblxuICAgICAgICBjb25zdCBsaWdodCA9IGJha2VMaWdodC5saWdodDtcbiAgICAgICAgbGV0IGxpZ2h0QWZmZWN0c05vZGUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcblxuICAgICAgICAgICAgLy8gdHdlYWsgZGlyZWN0aW9uYWwgbGlnaHQgY2FtZXJhIHRvIGZ1bGx5IHNlZSBhbGwgY2FzdGVycyBhbmQgdGhleSBhcmUgZnVsbHkgaW5zaWRlIHRoZSBmcnVzdHVtXG4gICAgICAgICAgICB0ZW1wVmVjLmNvcHkoY2FzdGVyQm91bmRzLmNlbnRlcik7XG4gICAgICAgICAgICB0ZW1wVmVjLnkgKz0gY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLnk7XG5cbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm5vZGUuc2V0UG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5ub2RlLnNldEV1bGVyQW5nbGVzKC05MCwgMCwgMCk7XG5cbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm5lYXJDbGlwID0gMDtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLmZhckNsaXAgPSBjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueSAqIDI7XG5cbiAgICAgICAgICAgIGNvbnN0IGZydXN0dW1TaXplID0gTWF0aC5tYXgoY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLngsIGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy56KTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm9ydGhvSGVpZ2h0ID0gZnJ1c3R1bVNpemU7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gZm9yIG90aGVyIGxpZ2h0IHR5cGVzLCB0ZXN0IGlmIGxpZ2h0IGFmZmVjdHMgdGhlIG5vZGVcbiAgICAgICAgICAgIGlmICghYmFrZUxpZ2h0LmxpZ2h0Qm91bmRzLmludGVyc2VjdHMoYmFrZU5vZGUuYm91bmRzKSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0QWZmZWN0c05vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBlciBtZXNoSW5zdGFuY2UgY3VsbGluZyBmb3Igc3BvdCBsaWdodCBvbmx5XG4gICAgICAgIC8vIChvbW5pIGxpZ2h0cyBjdWxsIHBlciBmYWNlIGxhdGVyLCBkaXJlY3Rpb25hbCBsaWdodHMgZG9uJ3QgY3VsbClcbiAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICBsZXQgbm9kZVZpc2libGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlc1tpXS5faXNWaXNpYmxlKHNoYWRvd0NhbSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW5vZGVWaXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgbGlnaHRBZmZlY3RzTm9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpZ2h0QWZmZWN0c05vZGU7XG4gICAgfVxuXG4gICAgLy8gc2V0IHVwIGxpZ2h0IGFycmF5IGZvciBhIHNpbmdsZSBsaWdodFxuICAgIHNldHVwTGlnaHRBcnJheShsaWdodEFycmF5LCBsaWdodCkge1xuXG4gICAgICAgIGxpZ2h0QXJyYXlbTElHSFRUWVBFX0RJUkVDVElPTkFMXS5sZW5ndGggPSAwO1xuICAgICAgICBsaWdodEFycmF5W0xJR0hUVFlQRV9PTU5JXS5sZW5ndGggPSAwO1xuICAgICAgICBsaWdodEFycmF5W0xJR0hUVFlQRV9TUE9UXS5sZW5ndGggPSAwO1xuXG4gICAgICAgIGxpZ2h0QXJyYXlbbGlnaHQudHlwZV1bMF0gPSBsaWdodDtcbiAgICAgICAgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSA9IHRydWU7XG4gICAgfVxuXG4gICAgcmVuZGVyU2hhZG93TWFwKHNoYWRvd01hcFJlbmRlcmVkLCBjYXN0ZXJzLCBsaWdodEFycmF5LCBiYWtlTGlnaHQpIHtcblxuICAgICAgICBjb25zdCBsaWdodCA9IGJha2VMaWdodC5saWdodDtcbiAgICAgICAgaWYgKCFzaGFkb3dNYXBSZW5kZXJlZCAmJiBsaWdodC5jYXN0U2hhZG93cykge1xuXG4gICAgICAgICAgICAvLyBhbGxvY2F0ZSBzaGFkb3cgbWFwIGZyb20gdGhlIGNhY2hlIHRvIGF2b2lkIHBlciBsaWdodCBhbGxvY2F0aW9uXG4gICAgICAgICAgICBpZiAoIWxpZ2h0LnNoYWRvd01hcCAmJiAhdGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBsaWdodC5zaGFkb3dNYXAgPSB0aGlzLnNoYWRvd01hcENhY2hlLmdldCh0aGlzLmRldmljZSwgbGlnaHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93UmVuZGVyZXIuY3VsbERpcmVjdGlvbmFsKGxpZ2h0LCBjYXN0ZXJzLCB0aGlzLmNhbWVyYSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyLmN1bGxMb2NhbChsaWdodCwgY2FzdGVycyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIucmVuZGVyU2hhZG93cyhsaWdodEFycmF5W2xpZ2h0LnR5cGVdLCB0aGlzLmNhbWVyYSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwb3N0cHJvY2Vzc1RleHR1cmVzKGRldmljZSwgYmFrZU5vZGVzLCBwYXNzQ291bnQpIHtcblxuICAgICAgICBjb25zdCBudW1EaWxhdGVzMnggPSAxOyAvLyAxIG9yIDIgZGlsYXRlcyAoZGVwZW5kaW5nIG9uIGZpbHRlciBiZWluZyBlbmFibGVkKVxuICAgICAgICBjb25zdCBkaWxhdGVTaGFkZXIgPSB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zaGFkZXJEaWxhdGU7XG5cbiAgICAgICAgLy8gYmlsYXRlcmFsIGRlbm9pc2UgZmlsdGVyIC0gcnVucyBhcyBhIGZpcnN0IHBhc3MsIGJlZm9yZSBkaWxhdGVcbiAgICAgICAgY29uc3QgZmlsdGVyTGlnaHRtYXAgPSB0aGlzLnNjZW5lLmxpZ2h0bWFwRmlsdGVyRW5hYmxlZDtcbiAgICAgICAgaWYgKGZpbHRlckxpZ2h0bWFwKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5wcmVwYXJlRGVub2lzZSh0aGlzLnNjZW5lLmxpZ2h0bWFwRmlsdGVyUmFuZ2UsIHRoaXMuc2NlbmUubGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IG5vZGUgPSAwOyBub2RlIDwgYmFrZU5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tub2RlXTtcblxuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMuZGV2aWNlLCBgTE1Qb3N0OiR7bm9kZX1gKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVJUID0gYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcCA9IG5vZGVSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBSVCA9IHRoaXMucmVuZGVyVGFyZ2V0cy5nZXQobGlnaHRtYXAud2lkdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBUZXggPSB0ZW1wUlQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5wcmVwYXJlKGxpZ2h0bWFwLndpZHRoLCBsaWdodG1hcC5oZWlnaHQpO1xuXG4gICAgICAgICAgICAgICAgLy8gYm91bmNlIGRpbGF0ZSBiZXR3ZWVuIHRleHR1cmVzLCBleGVjdXRlIGRlbm9pc2Ugb24gdGhlIGZpcnN0IHBhc3NcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bURpbGF0ZXMyeDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMuc2V0U291cmNlVGV4dHVyZShsaWdodG1hcCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbGF0ZXJhbEZpbHRlckVuYWJsZWQgPSBmaWx0ZXJMaWdodG1hcCAmJiBwYXNzID09PSAwICYmIGkgPT09IDA7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRlbXBSVCwgYmlsYXRlcmFsRmlsdGVyRW5hYmxlZCA/IHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNoYWRlckRlbm9pc2UgOiBkaWxhdGVTaGFkZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNldFNvdXJjZVRleHR1cmUodGVtcFRleCk7XG4gICAgICAgICAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIG5vZGVSVCwgZGlsYXRlU2hhZGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJha2VJbnRlcm5hbChwYXNzQ291bnQsIGJha2VOb2RlcywgYWxsTm9kZXMpIHtcblxuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgPSBzY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG5cbiAgICAgICAgdGhpcy5jcmVhdGVNYXRlcmlhbHMoZGV2aWNlLCBzY2VuZSwgcGFzc0NvdW50KTtcbiAgICAgICAgdGhpcy5zZXR1cFNjZW5lKCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIHNjZW5lLmxheWVycy5fdXBkYXRlKCk7XG5cbiAgICAgICAgLy8gY29tcHV0ZSBib3VuZGluZyBib3hlcyBmb3Igbm9kZXNcbiAgICAgICAgdGhpcy5jb21wdXRlTm9kZXNCb3VuZHMoYmFrZU5vZGVzKTtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgbGlnaHRtYXAgc2l6ZXMgYW5kIGFsbG9jYXRlIHRleHR1cmVzXG4gICAgICAgIHRoaXMuYWxsb2NhdGVUZXh0dXJlcyhiYWtlTm9kZXMsIHBhc3NDb3VudCk7XG5cbiAgICAgICAgLy8gQ29sbGVjdCBiYWtlYWJsZSBsaWdodHMsIGFuZCBhbHNvIGtlZXAgYWxsTGlnaHRzIGFsb25nIHdpdGggdGhlaXIgcHJvcGVydGllcyB3ZSBjaGFuZ2UgdG8gcmVzdG9yZSB0aGVtIGxhdGVyXG4gICAgICAgIGNvbnN0IGFsbExpZ2h0cyA9IFtdLCBiYWtlTGlnaHRzID0gW107XG4gICAgICAgIHRoaXMucHJlcGFyZUxpZ2h0c1RvQmFrZShzY2VuZS5sYXllcnMsIGFsbExpZ2h0cywgYmFrZUxpZ2h0cyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRyYW5zZm9ybXNcbiAgICAgICAgdGhpcy51cGRhdGVUcmFuc2Zvcm1zKGFsbE5vZGVzKTtcblxuICAgICAgICAvLyBnZXQgYWxsIG1lc2hJbnN0YW5jZXMgdGhhdCBjYXN0IHNoYWRvd3MgaW50byBsaWdodG1hcCBhbmQgc2V0IHRoZW0gdXAgZm9yIHJlYWx0aW1lIHNoYWRvdyBjYXN0aW5nXG4gICAgICAgIGNvbnN0IGNhc3RlcnMgPSB0aGlzLnByZXBhcmVTaGFkb3dDYXN0ZXJzKGFsbE5vZGVzKTtcblxuICAgICAgICAvLyB1cGRhdGUgc2tpbm5lZCBhbmQgbW9ycGhlZCBtZXNoZXNcbiAgICAgICAgdGhpcy5yZW5kZXJlci51cGRhdGVDcHVTa2luTWF0cmljZXMoY2FzdGVycyk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuZ3B1VXBkYXRlKGNhc3RlcnMpO1xuXG4gICAgICAgIC8vIGNvbXBvdW5kIGJvdW5kaW5nIGJveCBmb3IgYWxsIGNhc3RlcnMsIHVzZWQgdG8gY29tcHV0ZSBzaGFyZWQgZGlyZWN0aW9uYWwgbGlnaHQgc2hhZG93XG4gICAgICAgIGNvbnN0IGNhc3RlckJvdW5kcyA9IHRoaXMuY29tcHV0ZUJvdW5kcyhjYXN0ZXJzKTtcblxuICAgICAgICBsZXQgaSwgaiwgcmN2LCBtO1xuXG4gICAgICAgIC8vIFByZXBhcmUgbW9kZWxzXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBiYWtlTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGJha2VOb2RlID0gYmFrZU5vZGVzW2ldO1xuICAgICAgICAgICAgcmN2ID0gYmFrZU5vZGUubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJjdi5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIC8vIHBhdGNoIG1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgICAgIG0gPSByY3Zbal07XG5cbiAgICAgICAgICAgICAgICBtLnNldExpZ2h0bWFwcGVkKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBtLm1hc2sgPSBNQVNLX0JBS0U7IC8vIG9ubHkgYWZmZWN0ZWQgYnkgTE0gbGlnaHRzXG5cbiAgICAgICAgICAgICAgICAvLyBwYXRjaCBtYXRlcmlhbFxuICAgICAgICAgICAgICAgIG0uc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzBdLCBtLm1hdGVyaWFsLmxpZ2h0TWFwID8gbS5tYXRlcmlhbC5saWdodE1hcCA6IHRoaXMuYmxhY2tUZXgpO1xuICAgICAgICAgICAgICAgIG0uc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCB0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERpc2FibGUgYWxsIGJha2VhYmxlIGxpZ2h0c1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgYmFrZUxpZ2h0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgYmFrZUxpZ2h0c1tqXS5saWdodC5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsaWdodEFycmF5ID0gW1tdLCBbXSwgW11dO1xuICAgICAgICBsZXQgcGFzcywgbm9kZTtcbiAgICAgICAgbGV0IHNoYWRlcnNVcGRhdGVkT24xc3RQYXNzID0gZmFsc2U7XG5cbiAgICAgICAgLy8gQWNjdW11bGF0ZSBsaWdodHMgaW50byBSR0JNIHRleHR1cmVzXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBiYWtlTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTGlnaHQgPSBiYWtlTGlnaHRzW2ldO1xuICAgICAgICAgICAgY29uc3QgaXNBbWJpZW50TGlnaHQgPSBiYWtlTGlnaHQgaW5zdGFuY2VvZiBCYWtlTGlnaHRBbWJpZW50O1xuXG4gICAgICAgICAgICAvLyBsaWdodCBjYW4gYmUgYmFrZWQgdXNpbmcgbWFueSB2aXJ0dWFsIGxpZ2h0cyB0byBjcmVhdGUgc29mdCBlZmZlY3RcbiAgICAgICAgICAgIGxldCBudW1WaXJ0dWFsTGlnaHRzID0gYmFrZUxpZ2h0Lm51bVZpcnR1YWxMaWdodHM7XG5cbiAgICAgICAgICAgIC8vIGRpcmVjdGlvbiBiYWtpbmcgaXMgbm90IGN1cnJlbnRseSBjb21wYXRpYmxlIHdpdGggdmlydHVhbCBsaWdodHMsIGFzIHdlIGVuZCB1cCB3aXRoIG5vIHZhbGlkIGRpcmVjdGlvbiBpbiBsaWdodHMgcGVudW1icmFcbiAgICAgICAgICAgIGlmIChwYXNzQ291bnQgPiAxICYmIG51bVZpcnR1YWxMaWdodHMgPiAxICYmIGJha2VMaWdodC5saWdodC5iYWtlRGlyKSB7XG4gICAgICAgICAgICAgICAgbnVtVmlydHVhbExpZ2h0cyA9IDE7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybignTGlnaHRtYXBwZXJcXCdzIEJBS0VfQ09MT1JESVIgbW9kZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIExpZ2h0XFwncyBiYWtlTnVtU2FtcGxlcyBsYXJnZXIgdGhhbiBvbmUuIEZvcmNpbmcgaXQgdG8gb25lLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCB2aXJ0dWFsTGlnaHRJbmRleCA9IDA7IHZpcnR1YWxMaWdodEluZGV4IDwgbnVtVmlydHVhbExpZ2h0czsgdmlydHVhbExpZ2h0SW5kZXgrKykge1xuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYExpZ2h0OiR7YmFrZUxpZ2h0LmxpZ2h0Ll9ub2RlLm5hbWV9OiR7dmlydHVhbExpZ2h0SW5kZXh9YCk7XG5cbiAgICAgICAgICAgICAgICAvLyBwcmVwYXJlIHZpcnR1YWwgbGlnaHRcbiAgICAgICAgICAgICAgICBpZiAobnVtVmlydHVhbExpZ2h0cyA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYmFrZUxpZ2h0LnByZXBhcmVWaXJ0dWFsTGlnaHQodmlydHVhbExpZ2h0SW5kZXgsIG51bVZpcnR1YWxMaWdodHMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJha2VMaWdodC5zdGFydEJha2UoKTtcbiAgICAgICAgICAgICAgICBsZXQgc2hhZG93TWFwUmVuZGVyZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRvd0NhbSA9IHRoaXMubGlnaHRDYW1lcmFQcmVwYXJlKGRldmljZSwgYmFrZUxpZ2h0KTtcblxuICAgICAgICAgICAgICAgIGZvciAobm9kZSA9IDA7IG5vZGUgPCBiYWtlTm9kZXMubGVuZ3RoOyBub2RlKyspIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tub2RlXTtcbiAgICAgICAgICAgICAgICAgICAgcmN2ID0gYmFrZU5vZGUubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEFmZmVjdHNOb2RlID0gdGhpcy5saWdodENhbWVyYVByZXBhcmVBbmRDdWxsKGJha2VMaWdodCwgYmFrZU5vZGUsIHNoYWRvd0NhbSwgY2FzdGVyQm91bmRzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodEFmZmVjdHNOb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBMaWdodEFycmF5KGxpZ2h0QXJyYXksIGJha2VMaWdodC5saWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5saWdodFRleHR1cmVBdGxhcy51cGRhdGUobGlnaHRBcnJheVtMSUdIVFRZUEVfU1BPVF0sIGxpZ2h0QXJyYXlbTElHSFRUWVBFX09NTkldLCB0aGlzLmxpZ2h0aW5nUGFyYW1zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbmRlciBsaWdodCBzaGFkb3cgbWFwIG5lZWRzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd01hcFJlbmRlcmVkID0gdGhpcy5yZW5kZXJTaGFkb3dNYXAoc2hhZG93TWFwUmVuZGVyZWQsIGNhc3RlcnMsIGxpZ2h0QXJyYXksIGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2x1c3RlckxpZ2h0cyA9IGxpZ2h0QXJyYXlbTElHSFRUWVBFX1NQT1RdLmNvbmNhdChsaWdodEFycmF5W0xJR0hUVFlQRV9PTU5JXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMudXBkYXRlKGNsdXN0ZXJMaWdodHMsIHRoaXMuc2NlbmUuZ2FtbWFDb3JyZWN0aW9uLCB0aGlzLmxpZ2h0aW5nUGFyYW1zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIG9yaWdpbmFsIG1hdGVyaWFsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJhY2t1cE1hdGVyaWFscyhyY3YpO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAocGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IGJha2UgZmlyc3QgdmlydHVhbCBsaWdodCBmb3IgcGFzcyAxLCBhcyBpdCBkb2VzIG5vdCBoYW5kbGUgb3ZlcmxhcHBpbmcgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFzcyA+IDAgJiYgdmlydHVhbExpZ2h0SW5kZXggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRvbid0IGJha2UgYW1iaWVudCBsaWdodCBpbiBwYXNzIDEsIGFzIHRoZXJlJ3Mgbm8gbWFpbiBkaXJlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0FtYmllbnRMaWdodCAmJiBwYXNzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgTE1QYXNzOiR7cGFzc31gKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGlnaHRtYXAgc2l6ZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZVJUID0gYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwU2l6ZSA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc10uY29sb3JCdWZmZXIud2lkdGg7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdldCBtYXRjaGluZyB0ZW1wIHJlbmRlciB0YXJnZXQgdG8gcmVuZGVyIHRvXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZW1wUlQgPSB0aGlzLnJlbmRlclRhcmdldHMuZ2V0KGxpZ2h0bWFwU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZW1wVGV4ID0gdGVtcFJULmNvbG9yQnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFzcyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlcnNVcGRhdGVkT24xc3RQYXNzID0gc2NlbmUudXBkYXRlU2hhZGVycztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2hhZGVyc1VwZGF0ZWRPbjFzdFBhc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY2VuZS51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHBhc3NNYXRlcmlhbCA9IHRoaXMucGFzc01hdGVyaWFsc1twYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0FtYmllbnRMaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvciBsYXN0IHZpcnR1YWwgbGlnaHQgb2YgYW1iaWVudCBsaWdodCwgbXVsdGlwbHkgYWNjdW11bGF0ZWQgQU8gbGlnaHRtYXAgd2l0aCBhbWJpZW50IGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFzdFZpcnR1YWxMaWdodEZvclBhc3MgPSB2aXJ0dWFsTGlnaHRJbmRleCArIDEgPT09IG51bVZpcnR1YWxMaWdodHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RWaXJ0dWFsTGlnaHRGb3JQYXNzICYmIHBhc3MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFzc01hdGVyaWFsID0gdGhpcy5hbWJpZW50QU9NYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCB1cCBtYXRlcmlhbCBmb3IgYmFraW5nIGEgcGFzc1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHJjdi5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJjdltqXS5tYXRlcmlhbCA9IHBhc3NNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIHNoYWRlclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci51cGRhdGVTaGFkZXJzKHJjdik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBpbmctcG9uZ2luZyBvdXRwdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuc2V0Q2FtZXJhKHRoaXMuY2FtZXJhLCB0ZW1wUlQsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFzcyA9PT0gUEFTU19ESVIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnN0YW50QmFrZURpci5zZXRWYWx1ZShiYWtlTGlnaHQubGlnaHQuYmFrZURpciA/IDEgOiAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcHJlcGFyZSBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMuYWN0aXZhdGUodGhpcy5yZW5kZXJlci5saWdodFRleHR1cmVBdGxhcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWUgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbmRlckZvcndhcmQodGhpcy5jYW1lcmEsIHJjdiwgcmN2Lmxlbmd0aCwgbGlnaHRBcnJheSwgU0hBREVSX0ZPUldBUkRIRFIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2UudXBkYXRlRW5kKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdHMuc2hhZG93TWFwVGltZSArPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0cy5mb3J3YXJkVGltZSArPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdHMucmVuZGVyUGFzc2VzKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVtcCByZW5kZXIgdGFyZ2V0IG5vdyBoYXMgbGlnaHRtYXAsIHN0b3JlIGl0IGZvciB0aGUgbm9kZVxuICAgICAgICAgICAgICAgICAgICAgICAgYmFrZU5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXSA9IHRlbXBSVDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHJlbGVhc2UgcHJldmlvdXMgbGlnaHRtYXAgaW50byB0ZW1wIHJlbmRlciB0YXJnZXQgcG9vbFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXRzLnNldChsaWdodG1hcFNpemUsIG5vZGVSVCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtID0gcmN2W2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0uc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzW3Bhc3NdLCB0ZW1wVGV4KTsgLy8gcGluZy1wb25naW5nIGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbS5fc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfTE07IC8vIGZvcmNlIHVzaW5nIExNIGV2ZW4gaWYgbWF0ZXJpYWwgZG9lc24ndCBoYXZlIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBSZXZlcnQgdG8gb3JpZ2luYWwgbWF0ZXJpYWxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzdG9yZU1hdGVyaWFscyhyY3YpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJha2VMaWdodC5lbmRCYWtlKHRoaXMuc2hhZG93TWFwQ2FjaGUpO1xuXG4gICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucG9zdHByb2Nlc3NUZXh0dXJlcyhkZXZpY2UsIGJha2VOb2RlcywgcGFzc0NvdW50KTtcblxuICAgICAgICAvLyByZXN0b3JlIGNoYW5nZXNcbiAgICAgICAgZm9yIChub2RlID0gMDsgbm9kZSA8IGFsbE5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG4gICAgICAgICAgICBhbGxOb2Rlc1tub2RlXS5yZXN0b3JlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlc3RvcmVMaWdodHMoYWxsTGlnaHRzKTtcbiAgICAgICAgdGhpcy5yZXN0b3JlU2NlbmUoKTtcblxuICAgICAgICAvLyBlbXB0eSBjYWNoZSB0byBtaW5pbWl6ZSBwZXJzaXN0ZW50IG1lbW9yeSB1c2UgLi4gaWYgc29tZSBjYWNoZWQgdGV4dHVyZXMgYXJlIG5lZWRlZCxcbiAgICAgICAgLy8gdGhleSB3aWxsIGJlIGFsbG9jYXRlZCBhZ2FpbiBhcyBuZWVkZWRcbiAgICAgICAgaWYgKCFjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRtYXBwZXIgfTtcbiJdLCJuYW1lcyI6WyJNQVhfTElHSFRNQVBfU0laRSIsIlBBU1NfQ09MT1IiLCJQQVNTX0RJUiIsInRlbXBWZWMiLCJWZWMzIiwiTGlnaHRtYXBwZXIiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsInJvb3QiLCJzY2VuZSIsInJlbmRlcmVyIiwiYXNzZXRzIiwic2hhZG93TWFwQ2FjaGUiLCJfc2hhZG93UmVuZGVyZXIiLCJfdGVtcFNldCIsIlNldCIsIl9pbml0Q2FsbGVkIiwicGFzc01hdGVyaWFscyIsImFtYmllbnRBT01hdGVyaWFsIiwiZm9nIiwiYW1iaWVudExpZ2h0IiwiQ29sb3IiLCJyZW5kZXJUYXJnZXRzIiwiTWFwIiwic3RhdHMiLCJyZW5kZXJQYXNzZXMiLCJsaWdodG1hcENvdW50IiwidG90YWxSZW5kZXJUaW1lIiwiZm9yd2FyZFRpbWUiLCJmYm9UaW1lIiwic2hhZG93TWFwVGltZSIsImNvbXBpbGVUaW1lIiwic2hhZGVyc0xpbmtlZCIsImRlc3Ryb3kiLCJMaWdodG1hcENhY2hlIiwiZGVjUmVmIiwiYmxhY2tUZXgiLCJpbml0QmFrZSIsImxpZ2h0bWFwRmlsdGVycyIsIkxpZ2h0bWFwRmlsdGVycyIsImNvbnN0YW50QmFrZURpciIsInNjb3BlIiwicmVzb2x2ZSIsIm1hdGVyaWFscyIsIlRleHR1cmUiLCJ3aWR0aCIsImhlaWdodCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwidHlwZSIsIlRFWFRVUkVUWVBFX1JHQk0iLCJuYW1lIiwiaW5jUmVmIiwiY2FtZXJhIiwiQ2FtZXJhIiwiY2xlYXJDb2xvciIsInNldCIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwiZnJ1c3R1bUN1bGxpbmciLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJhc3BlY3RSYXRpbyIsIm5vZGUiLCJHcmFwaE5vZGUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJsaWdodGluZ1BhcmFtcyIsIkxpZ2h0aW5nUGFyYW1zIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwibWF4VGV4dHVyZVNpemUiLCJzcmNQYXJhbXMiLCJsaWdodGluZyIsInNoYWRvd3NFbmFibGVkIiwic2hhZG93QXRsYXNSZXNvbHV0aW9uIiwiY29va2llc0VuYWJsZWQiLCJjb29raWVBdGxhc1Jlc29sdXRpb24iLCJhcmVhTGlnaHRzRW5hYmxlZCIsImNlbGxzIiwibWF4TGlnaHRzUGVyQ2VsbCIsIndvcmxkQ2x1c3RlcnMiLCJXb3JsZENsdXN0ZXJzIiwiZmluaXNoQmFrZSIsImJha2VOb2RlcyIsImRlc3Ryb3lSVCIsInJ0IiwiY29sb3JCdWZmZXIiLCJmb3JFYWNoIiwiY2xlYXIiLCJsZW5ndGgiLCJjcmVhdGVNYXRlcmlhbEZvclBhc3MiLCJwYXNzIiwiYWRkQW1iaWVudCIsIm1hdGVyaWFsIiwiU3RhbmRhcmRNYXRlcmlhbCIsImNodW5rcyIsIkFQSVZlcnNpb24iLCJDSFVOS0FQSV8xXzU1IiwidHJhbnNmb3JtVlMiLCJzaGFkZXJDaHVua3MiLCJiYWtlTG1FbmRDaHVuayIsInNoYWRlckNodW5rc0xpZ2h0bWFwcGVyIiwiYmFrZUxtRW5kUFMiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IiwidG9GaXhlZCIsImFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyIsImFtYmllbnQiLCJhbWJpZW50VGludCIsImVuZFBTIiwibGlnaHRNYXAiLCJiYXNlUFMiLCJiYWtlRGlyTG1FbmRQUyIsIm91dHB1dEFscGhhUFMiLCJvdXRwdXRBbHBoYU9wYXF1ZVBTIiwib3V0cHV0QWxwaGFQcmVtdWxQUyIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwiZm9yY2VVdjEiLCJ1cGRhdGUiLCJjcmVhdGVNYXRlcmlhbHMiLCJwYXNzQ291bnQiLCJvblVwZGF0ZVNoYWRlciIsIm9wdGlvbnMiLCJsaWdodE1hcFdpdGhvdXRBbWJpZW50Iiwic2VwYXJhdGVBbWJpZW50IiwiY3JlYXRlVGV4dHVyZSIsInNpemUiLCJwcm9maWxlckhpbnQiLCJURVhISU5UX0xJR0hUTUFQIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsImNvbGxlY3RNb2RlbHMiLCJhbGxOb2RlcyIsImVuYWJsZWQiLCJtZXNoSW5zdGFuY2VzIiwibW9kZWwiLCJwdXNoIiwiQmFrZU1lc2hOb2RlIiwibGlnaHRtYXBwZWQiLCJyZW5kZXIiLCJoYXNVdjEiLCJpIiwibWVzaCIsInZlcnRleEJ1ZmZlciIsIkRlYnVnIiwibG9nIiwibm90SW5zdGFuY2VkTWVzaEluc3RhbmNlcyIsImhhcyIsImFkZCIsIl9jaGlsZHJlbiIsInByZXBhcmVTaGFkb3dDYXN0ZXJzIiwibm9kZXMiLCJjYXN0ZXJzIiwibiIsImNvbXBvbmVudCIsImNhc3RTaGFkb3dzIiwiY2FzdFNoYWRvd3NMaWdodG1hcCIsIm1lc2hlcyIsInZpc2libGVUaGlzRnJhbWUiLCJ1cGRhdGVUcmFuc2Zvcm1zIiwiaiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY2FsY3VsYXRlTGlnaHRtYXBTaXplIiwiZGF0YSIsInNpemVNdWx0IiwibGlnaHRtYXBTaXplTXVsdGlwbGllciIsInNjYWxlIiwic3JjQXJlYSIsImFzc2V0IiwiZ2V0IiwiYXJlYSIsIl9hcmVhIiwieCIsInkiLCJ6IiwidXYiLCJhcmVhTXVsdCIsImJvdW5kcyIsImNvbXB1dGVOb2RlQm91bmRzIiwiY29weSIsImhhbGZFeHRlbnRzIiwidG90YWxBcmVhIiwiTWF0aCIsInNxcnQiLCJsaWdodG1hcFNpemUiLCJtaW4iLCJtYXRoIiwibmV4dFBvd2VyT2ZUd28iLCJsaWdodG1hcE1heFJlc29sdXRpb24iLCJzZXRMaWdodG1hcHBpbmciLCJ2YWx1ZSIsInNoYWRlckRlZnMiLCJtZXNoSW5zdGFuY2UiLCJzZXRMaWdodG1hcHBlZCIsIl9zaGFkZXJEZWZzIiwibWFzayIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwidGV4IiwiRklMVEVSX0xJTkVBUiIsInNldFJlYWx0aW1lTGlnaHRtYXAiLCJNZXNoSW5zdGFuY2UiLCJsaWdodG1hcFBhcmFtTmFtZXMiLCJiYWtlIiwibW9kZSIsIkJBS0VfQ09MT1JESVIiLCJzdGFydFRpbWUiLCJub3ciLCJfdXBkYXRlU2t5IiwiZmlyZSIsInRpbWVzdGFtcCIsInRhcmdldCIsInN0YXJ0U2hhZGVycyIsIl9zaGFkZXJTdGF0cyIsImxpbmtlZCIsInN0YXJ0RmJvVGltZSIsIl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUiLCJzdGFydENvbXBpbGVUaW1lIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJiYWtlSW50ZXJuYWwiLCJTSEFERVJERUZfTE0iLCJTSEFERVJERUZfRElSTE0iLCJhbWJpZW50QmFrZSIsIlNIQURFUkRFRl9MTUFNQklFTlQiLCJwb3BHcHVNYXJrZXIiLCJub3dUaW1lIiwiYWxsb2NhdGVUZXh0dXJlcyIsImJha2VOb2RlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsIlJlbmRlclRhcmdldCIsImRlcHRoIiwicHJlcGFyZUxpZ2h0c1RvQmFrZSIsImxheWVyQ29tcG9zaXRpb24iLCJhbGxMaWdodHMiLCJiYWtlTGlnaHRzIiwiQmFrZUxpZ2h0QW1iaWVudCIsInNjZW5lTGlnaHRzIiwiX2xpZ2h0cyIsImxpZ2h0IiwiYmFrZUxpZ2h0IiwiQmFrZUxpZ2h0U2ltcGxlIiwiTUFTS19CQUtFIiwiaXNTdGF0aWMiLCJzaGFkb3dVcGRhdGVNb2RlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsInNvcnQiLCJyZXN0b3JlTGlnaHRzIiwicmVzdG9yZSIsInNldHVwU2NlbmUiLCJyZXZlcnRTdGF0aWMiLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiRk9HX05PTkUiLCJzZXRTY2VuZUNvbnN0YW50cyIsInJlc3RvcmVTY2VuZSIsIkJvdW5kaW5nQm94IiwiYWFiYiIsIm0iLCJjb21wdXRlTm9kZXNCb3VuZHMiLCJjb21wdXRlQm91bmRzIiwiYmFja3VwTWF0ZXJpYWxzIiwicmVzdG9yZU1hdGVyaWFscyIsImxpZ2h0Q2FtZXJhUHJlcGFyZSIsInNoYWRvd0NhbSIsIkxJR0hUVFlQRV9TUE9UIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNoYWRvd0NhbWVyYSIsIl9ub2RlIiwic2V0UG9zaXRpb24iLCJnZXRQb3NpdGlvbiIsInNldFJvdGF0aW9uIiwiZ2V0Um90YXRpb24iLCJyb3RhdGVMb2NhbCIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJuZWFyQ2xpcCIsImF0dGVudWF0aW9uRW5kIiwiZmFyQ2xpcCIsImZvdiIsIl9vdXRlckNvbmVBbmdsZSIsInVwZGF0ZUNhbWVyYUZydXN0dW0iLCJsaWdodENhbWVyYVByZXBhcmVBbmRDdWxsIiwiY2FzdGVyQm91bmRzIiwibGlnaHRBZmZlY3RzTm9kZSIsImNlbnRlciIsInNldEV1bGVyQW5nbGVzIiwiZnJ1c3R1bVNpemUiLCJtYXgiLCJvcnRob0hlaWdodCIsImxpZ2h0Qm91bmRzIiwiaW50ZXJzZWN0cyIsIm5vZGVWaXNpYmxlIiwiX2lzVmlzaWJsZSIsInNldHVwTGlnaHRBcnJheSIsImxpZ2h0QXJyYXkiLCJMSUdIVFRZUEVfT01OSSIsInJlbmRlclNoYWRvd01hcCIsInNoYWRvd01hcFJlbmRlcmVkIiwic2hhZG93TWFwIiwiY3VsbERpcmVjdGlvbmFsIiwiY3VsbExvY2FsIiwicmVuZGVyU2hhZG93cyIsInBvc3Rwcm9jZXNzVGV4dHVyZXMiLCJudW1EaWxhdGVzMngiLCJkaWxhdGVTaGFkZXIiLCJzaGFkZXJEaWxhdGUiLCJmaWx0ZXJMaWdodG1hcCIsImxpZ2h0bWFwRmlsdGVyRW5hYmxlZCIsInByZXBhcmVEZW5vaXNlIiwibGlnaHRtYXBGaWx0ZXJSYW5nZSIsImxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyIsIm5vZGVSVCIsImxpZ2h0bWFwIiwidGVtcFJUIiwidGVtcFRleCIsInByZXBhcmUiLCJzZXRTb3VyY2VUZXh0dXJlIiwiYmlsYXRlcmFsRmlsdGVyRW5hYmxlZCIsImRyYXdRdWFkV2l0aFNoYWRlciIsInNoYWRlckRlbm9pc2UiLCJsYXllcnMiLCJfdXBkYXRlIiwidXBkYXRlQ3B1U2tpbk1hdHJpY2VzIiwiZ3B1VXBkYXRlIiwicmN2Iiwic2hhZGVyc1VwZGF0ZWRPbjFzdFBhc3MiLCJpc0FtYmllbnRMaWdodCIsIm51bVZpcnR1YWxMaWdodHMiLCJiYWtlRGlyIiwid2FybiIsInZpcnR1YWxMaWdodEluZGV4IiwicHJlcGFyZVZpcnR1YWxMaWdodCIsInN0YXJ0QmFrZSIsImxpZ2h0VGV4dHVyZUF0bGFzIiwiY2x1c3RlckxpZ2h0cyIsImNvbmNhdCIsImdhbW1hQ29ycmVjdGlvbiIsInVwZGF0ZVNoYWRlcnMiLCJwYXNzTWF0ZXJpYWwiLCJsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyIsInNldENhbWVyYSIsInNldFZhbHVlIiwiYWN0aXZhdGUiLCJfZm9yd2FyZFRpbWUiLCJfc2hhZG93TWFwVGltZSIsInJlbmRlckZvcndhcmQiLCJTSEFERVJfRk9SV0FSREhEUiIsInVwZGF0ZUVuZCIsImVuZEJha2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3REEsTUFBTUEsaUJBQWlCLEdBQUcsSUFBMUIsQ0FBQTtBQUVBLE1BQU1DLFVBQVUsR0FBRyxDQUFuQixDQUFBO0FBQ0EsTUFBTUMsUUFBUSxHQUFHLENBQWpCLENBQUE7QUFFQSxNQUFNQyxPQUFPLEdBQUcsSUFBSUMsSUFBSixFQUFoQixDQUFBOztBQUtBLE1BQU1DLFdBQU4sQ0FBa0I7RUFXZEMsV0FBVyxDQUFDQyxNQUFELEVBQVNDLElBQVQsRUFBZUMsS0FBZixFQUFzQkMsUUFBdEIsRUFBZ0NDLE1BQWhDLEVBQXdDO0lBQy9DLElBQUtKLENBQUFBLE1BQUwsR0FBY0EsTUFBZCxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsSUFBTCxHQUFZQSxJQUFaLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxLQUFMLEdBQWFBLEtBQWIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFFBQUwsR0FBZ0JBLFFBQWhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWNBLE1BQWQsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLQyxjQUFMLEdBQXNCRixRQUFRLENBQUNHLGVBQVQsQ0FBeUJELGNBQS9DLENBQUE7QUFFQSxJQUFBLElBQUEsQ0FBS0UsUUFBTCxHQUFnQixJQUFJQyxHQUFKLEVBQWhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxXQUFMLEdBQW1CLEtBQW5CLENBQUE7SUFHQSxJQUFLQyxDQUFBQSxhQUFMLEdBQXFCLEVBQXJCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxpQkFBTCxHQUF5QixJQUF6QixDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsR0FBTCxHQUFXLEVBQVgs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
