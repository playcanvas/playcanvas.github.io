/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision 1331860ee (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_R8_G8_B8_A8, TEXTURETYPE_RGBM, CHUNKAPI_1_55, CULLFACE_NONE, TEXHINT_LIGHTMAP, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, TEXTURETYPE_DEFAULT } from '../../platform/graphics/constants.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../shader-lib/chunks/chunks-lightmapper.js';
import { drawQuadWithShader } from '../../platform/graphics/simple-post-effect.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9saWdodG1hcHBlci9saWdodG1hcHBlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBDSFVOS0FQSV8xXzU1LFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1QsXG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsXG4gICAgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MtbGlnaHRtYXBwZXIuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vbWVzaC1pbnN0YW5jZS5qcyc7XG5cbmltcG9ydCB7IExpZ2h0aW5nUGFyYW1zIH0gZnJvbSAnLi4vbGlnaHRpbmcvbGlnaHRpbmctcGFyYW1zLmpzJztcbmltcG9ydCB7IFdvcmxkQ2x1c3RlcnMgfSBmcm9tICcuLi9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fSBBc3NldFJlZ2lzdHJ5ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcycpLkZvcndhcmRSZW5kZXJlcn0gRm9yd2FyZFJlbmRlcmVyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX0gU2NlbmUgKi9cblxuaW1wb3J0IHtcbiAgICBCQUtFX0NPTE9SRElSLFxuICAgIEZPR19OT05FLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIFNIQURFUl9GT1JXQVJESERSLFxuICAgIFNIQURFUkRFRl9ESVJMTSwgU0hBREVSREVGX0xNLCBTSEFERVJERUZfTE1BTUJJRU5ULFxuICAgIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQsXG4gICAgU0hBRE9XVVBEQVRFX1JFQUxUSU1FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDYW1lcmEgfSBmcm9tICcuLi9jYW1lcmEuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQmFrZUxpZ2h0U2ltcGxlIH0gZnJvbSAnLi9iYWtlLWxpZ2h0LXNpbXBsZS5qcyc7XG5pbXBvcnQgeyBCYWtlTGlnaHRBbWJpZW50IH0gZnJvbSAnLi9iYWtlLWxpZ2h0LWFtYmllbnQuanMnO1xuaW1wb3J0IHsgQmFrZU1lc2hOb2RlIH0gZnJvbSAnLi9iYWtlLW1lc2gtbm9kZS5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcENhY2hlIH0gZnJvbSAnLi9saWdodG1hcC1jYWNoZS5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcEZpbHRlcnMgfSBmcm9tICcuL2xpZ2h0bWFwLWZpbHRlcnMuanMnO1xuXG5jb25zdCBNQVhfTElHSFRNQVBfU0laRSA9IDIwNDg7XG5cbmNvbnN0IFBBU1NfQ09MT1IgPSAwO1xuY29uc3QgUEFTU19ESVIgPSAxO1xuXG5jb25zdCB0ZW1wVmVjID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBUaGUgbGlnaHRtYXBwZXIgaXMgdXNlZCB0byBiYWtlIHNjZW5lIGxpZ2h0cyBpbnRvIHRleHR1cmVzLlxuICovXG5jbGFzcyBMaWdodG1hcHBlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IExpZ2h0bWFwcGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSBsaWdodG1hcHBlci5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gcm9vdCAtIFRoZSByb290IGVudGl0eSBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUgdG8gbGlnaHRtYXAuXG4gICAgICogQHBhcmFtIHtGb3J3YXJkUmVuZGVyZXJ9IHJlbmRlcmVyIC0gVGhlIHJlbmRlcmVyLlxuICAgICAqIEBwYXJhbSB7QXNzZXRSZWdpc3RyeX0gYXNzZXRzIC0gUmVnaXN0cnkgb2YgYXNzZXRzIHRvIGxpZ2h0bWFwLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIHJvb3QsIHNjZW5lLCByZW5kZXJlciwgYXNzZXRzKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLnJvb3QgPSByb290O1xuICAgICAgICB0aGlzLnNjZW5lID0gc2NlbmU7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSByZW5kZXJlcjtcbiAgICAgICAgdGhpcy5hc3NldHMgPSBhc3NldHM7XG4gICAgICAgIHRoaXMuc2hhZG93TWFwQ2FjaGUgPSByZW5kZXJlci5fc2hhZG93UmVuZGVyZXIuc2hhZG93TWFwQ2FjaGU7XG5cbiAgICAgICAgdGhpcy5fdGVtcFNldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5faW5pdENhbGxlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGludGVybmFsIG1hdGVyaWFscyB1c2VkIGJ5IGJha2luZ1xuICAgICAgICB0aGlzLnBhc3NNYXRlcmlhbHMgPSBbXTtcbiAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5mb2cgPSAnJztcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQgPSBuZXcgQ29sb3IoKTtcblxuICAgICAgICAvLyBkaWN0aW9uYXJ5IG9mIHNwYXJlIHJlbmRlciB0YXJnZXRzIHdpdGggY29sb3IgYnVmZmVyIGZvciBlYWNoIHVzZWQgc2l6ZVxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgICAgICAgIHJlbmRlclBhc3NlczogMCxcbiAgICAgICAgICAgIGxpZ2h0bWFwQ291bnQ6IDAsXG4gICAgICAgICAgICB0b3RhbFJlbmRlclRpbWU6IDAsXG4gICAgICAgICAgICBmb3J3YXJkVGltZTogMCxcbiAgICAgICAgICAgIGZib1RpbWU6IDAsXG4gICAgICAgICAgICBzaGFkb3dNYXBUaW1lOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDAsXG4gICAgICAgICAgICBzaGFkZXJzTGlua2VkOiAwXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICAvLyByZWxlYXNlIHJlZmVyZW5jZSB0byB0aGUgdGV4dHVyZVxuICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZih0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgdGhpcy5ibGFja1RleCA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgbGlnaHRtYXBzXG4gICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IG51bGw7XG4gICAgfVxuXG4gICAgaW5pdEJha2UoZGV2aWNlKSB7XG5cbiAgICAgICAgLy8gb25seSBpbml0aWFsaXplIG9uZSB0aW1lXG4gICAgICAgIGlmICghdGhpcy5faW5pdENhbGxlZCkge1xuICAgICAgICAgICAgdGhpcy5faW5pdENhbGxlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwIGZpbHRlcmluZyBzaGFkZXJzXG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycyA9IG5ldyBMaWdodG1hcEZpbHRlcnMoZGV2aWNlKTtcblxuICAgICAgICAgICAgLy8gc2hhZGVyIHJlbGF0ZWRcbiAgICAgICAgICAgIHRoaXMuY29uc3RhbnRCYWtlRGlyID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2Jha2VEaXInKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWxzID0gW107XG5cbiAgICAgICAgICAgIC8vIHNtYWxsIGJsYWNrIHRleHR1cmVcbiAgICAgICAgICAgIHRoaXMuYmxhY2tUZXggPSBuZXcgVGV4dHVyZSh0aGlzLmRldmljZSwge1xuICAgICAgICAgICAgICAgIHdpZHRoOiA0LFxuICAgICAgICAgICAgICAgIGhlaWdodDogNCxcbiAgICAgICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgICAgICAgICAgICAgIHR5cGU6IFRFWFRVUkVUWVBFX1JHQk0sXG4gICAgICAgICAgICAgICAgbmFtZTogJ2xpZ2h0bWFwQmxhY2snXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gaW5jcmVmIGJsYWNrIHRleHR1cmUgaW4gdGhlIGNhY2hlIHRvIGF2b2lkIGl0IGJlaW5nIGRlc3Ryb3llZFxuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGhpcy5ibGFja1RleCk7XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSB1c2VkIGZvciBiYWtpbmdcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IG5ldyBDYW1lcmEoKTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhckNvbG9yLnNldCgwLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhckNvbG9yQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgICAgIGNhbWVyYS5jbGVhckRlcHRoQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICBjYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICBjYW1lcmEuZnJ1c3R1bUN1bGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbWVyYS5wcm9qZWN0aW9uID0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUM7XG4gICAgICAgICAgICBjYW1lcmEuYXNwZWN0UmF0aW8gPSAxO1xuICAgICAgICAgICAgY2FtZXJhLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBsaWdodCBjbHVzdGVyIHN0cnVjdHVyZVxuICAgICAgICBpZiAodGhpcy5zY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIGxpZ2h0IHBhcmFtcywgYW5kIGJhc2UgbW9zdCBwYXJhbWV0ZXJzIG9uIHRoZSBsaWdodGluZyBwYXJhbXMgb2YgdGhlIHNjZW5lXG4gICAgICAgICAgICBjb25zdCBsaWdodGluZ1BhcmFtcyA9IG5ldyBMaWdodGluZ1BhcmFtcyhkZXZpY2Uuc3VwcG9ydHNBcmVhTGlnaHRzLCBkZXZpY2UubWF4VGV4dHVyZVNpemUsICgpID0+IHt9KTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRpbmdQYXJhbXMgPSBsaWdodGluZ1BhcmFtcztcblxuICAgICAgICAgICAgY29uc3Qgc3JjUGFyYW1zID0gdGhpcy5zY2VuZS5saWdodGluZztcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLnNoYWRvd3NFbmFibGVkID0gc3JjUGFyYW1zLnNoYWRvd3NFbmFibGVkO1xuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gc3JjUGFyYW1zLnNoYWRvd0F0bGFzUmVzb2x1dGlvbjtcblxuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuY29va2llc0VuYWJsZWQgPSBzcmNQYXJhbXMuY29va2llc0VuYWJsZWQ7XG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5jb29raWVBdGxhc1Jlc29sdXRpb24gPSBzcmNQYXJhbXMuY29va2llQXRsYXNSZXNvbHV0aW9uO1xuXG4gICAgICAgICAgICBsaWdodGluZ1BhcmFtcy5hcmVhTGlnaHRzRW5hYmxlZCA9IHNyY1BhcmFtcy5hcmVhTGlnaHRzRW5hYmxlZDtcblxuICAgICAgICAgICAgLy8gc29tZSBjdXN0b20gbGlnaHRtYXBwaW5nIHBhcmFtcyAtIHdlIGJha2Ugc2luZ2xlIGxpZ2h0IGEgdGltZVxuICAgICAgICAgICAgbGlnaHRpbmdQYXJhbXMuY2VsbHMgPSBuZXcgVmVjMygzLCAzLCAzKTtcbiAgICAgICAgICAgIGxpZ2h0aW5nUGFyYW1zLm1heExpZ2h0c1BlckNlbGwgPSA0O1xuXG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMgPSBuZXcgV29ybGRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLm5hbWUgPSAnQ2x1c3RlckxpZ2h0bWFwcGVyJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZpbmlzaEJha2UoYmFrZU5vZGVzKSB7XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbHMgPSBbXTtcblxuICAgICAgICBmdW5jdGlvbiBkZXN0cm95UlQocnQpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgY2FuIGNhdXNlIHJlZiBjb3VudCB0byBiZSAwIGFuZCB0ZXh0dXJlIGRlc3Ryb3llZFxuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5kZWNSZWYocnQuY29sb3JCdWZmZXIpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IHJlbmRlciB0YXJnZXQgaXRzZWxmXG4gICAgICAgICAgICBydC5kZXN0cm95KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzcGFyZSByZW5kZXIgdGFyZ2V0cyBpbmNsdWRpbmcgY29sb3IgYnVmZmVyXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5mb3JFYWNoKChydCkgPT4ge1xuICAgICAgICAgICAgZGVzdHJveVJUKHJ0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5jbGVhcigpO1xuXG4gICAgICAgIC8vIGRlc3Ryb3kgcmVuZGVyIHRhcmdldHMgZnJvbSBub2RlcyAoYnV0IG5vdCBjb2xvciBidWZmZXIpXG4gICAgICAgIGJha2VOb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICBub2RlLnJlbmRlclRhcmdldHMuZm9yRWFjaCgocnQpID0+IHtcbiAgICAgICAgICAgICAgICBkZXN0cm95UlQocnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBub2RlLnJlbmRlclRhcmdldHMubGVuZ3RoID0gMDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdGhpcyBzaGFkZXIgaXMgb25seSB2YWxpZCBmb3Igc3BlY2lmaWMgYnJpZ2h0bmVzcyBhbmQgY29udHJhc3QgdmFsdWVzLCBkaXNwb3NlIGl0XG4gICAgICAgIHRoaXMuYW1iaWVudEFPTWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIC8vIGRlbGV0ZSBsaWdodCBjbHVzdGVyXG4gICAgICAgIGlmICh0aGlzLndvcmxkQ2x1c3RlcnMpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRDbHVzdGVycy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLndvcmxkQ2x1c3RlcnMgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlTWF0ZXJpYWxGb3JQYXNzKGRldmljZSwgc2NlbmUsIHBhc3MsIGFkZEFtYmllbnQpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gYGxtTWF0ZXJpYWwtcGFzczoke3Bhc3N9LWFtYmllbnQ6JHthZGRBbWJpZW50fWA7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5BUElWZXJzaW9uID0gQ0hVTktBUElfMV81NTtcbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLnRyYW5zZm9ybVZTID0gJyNkZWZpbmUgVVYxTEFZT1VUXFxuJyArIHNoYWRlckNodW5rcy50cmFuc2Zvcm1WUzsgLy8gZHJhdyBVVjFcblxuICAgICAgICBpZiAocGFzcyA9PT0gUEFTU19DT0xPUikge1xuICAgICAgICAgICAgbGV0IGJha2VMbUVuZENodW5rID0gc2hhZGVyQ2h1bmtzTGlnaHRtYXBwZXIuYmFrZUxtRW5kUFM7IC8vIGVuY29kZSB0byBSR0JNXG4gICAgICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgICAgIC8vIGRpZmZ1c2UgbGlnaHQgc3RvcmVzIGFjY3VtdWxhdGVkIEFPLCBhcHBseSBjb250cmFzdCBhbmQgYnJpZ2h0bmVzcyB0byBpdFxuICAgICAgICAgICAgICAgIC8vIGFuZCBtdWx0aXBseSBhbWJpZW50IGxpZ2h0IGNvbG9yIGJ5IHRoZSBBT1xuICAgICAgICAgICAgICAgIGJha2VMbUVuZENodW5rID0gYFxuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gKChkRGlmZnVzZUxpZ2h0IC0gMC41KSAqIG1heCgke3NjZW5lLmFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QudG9GaXhlZCgxKX0gKyAxLjAsIDAuMCkpICsgMC41O1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IHZlYzMoJHtzY2VuZS5hbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MudG9GaXhlZCgxKX0pO1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gc2F0dXJhdGUoZERpZmZ1c2VMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgKj0gZEFtYmllbnRMaWdodDtcbiAgICAgICAgICAgICAgICBgICsgYmFrZUxtRW5kQ2h1bms7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFtYmllbnQgPSBuZXcgQ29sb3IoMCwgMCwgMCk7ICAgIC8vIGRvbid0IGJha2UgYW1iaWVudFxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFtYmllbnRUaW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5lbmRQUyA9IGJha2VMbUVuZENodW5rO1xuICAgICAgICAgICAgbWF0ZXJpYWwubGlnaHRNYXAgPSB0aGlzLmJsYWNrVGV4O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmJhc2VQUyA9IHNoYWRlckNodW5rcy5iYXNlUFMgKyAnXFxudW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9kaXJMaWdodE1hcDtcXG51bmlmb3JtIGZsb2F0IGJha2VEaXI7XFxuJztcbiAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5lbmRQUyA9IHNoYWRlckNodW5rc0xpZ2h0bWFwcGVyLmJha2VEaXJMbUVuZFBTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXZvaWQgd3JpdGluZyB1bnJlbGF0ZWQgdGhpbmdzIHRvIGFscGhhXG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5vdXRwdXRBbHBoYVBTID0gJ1xcbic7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5vdXRwdXRBbHBoYU9wYXF1ZVBTID0gJ1xcbic7XG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5vdXRwdXRBbHBoYVByZW11bFBTID0gJ1xcbic7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9OT05FO1xuICAgICAgICBtYXRlcmlhbC5mb3JjZVV2MSA9IHRydWU7IC8vIHByb3ZpZGUgZGF0YSB0byB4Zm9ybVV2MVxuICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgY3JlYXRlTWF0ZXJpYWxzKGRldmljZSwgc2NlbmUsIHBhc3NDb3VudCkge1xuICAgICAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NDb3VudDsgcGFzcysrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucGFzc01hdGVyaWFsc1twYXNzXSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFzc01hdGVyaWFsc1twYXNzXSA9IHRoaXMuY3JlYXRlTWF0ZXJpYWxGb3JQYXNzKGRldmljZSwgc2NlbmUsIHBhc3MsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1hdGVyaWFsIHVzZWQgb24gbGFzdCByZW5kZXIgb2YgYW1iaWVudCBsaWdodCB0byBtdWx0aXBseSBhY2N1bXVsYXRlZCBBTyBpbiBsaWdodG1hcCBieSBhbWJpZW50IGxpZ2h0XG4gICAgICAgIGlmICghdGhpcy5hbWJpZW50QU9NYXRlcmlhbCkge1xuICAgICAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbCA9IHRoaXMuY3JlYXRlTWF0ZXJpYWxGb3JQYXNzKGRldmljZSwgc2NlbmUsIDAsIHRydWUpO1xuICAgICAgICAgICAgdGhpcy5hbWJpZW50QU9NYXRlcmlhbC5vblVwZGF0ZVNoYWRlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBMTSBhcyB3aXRob3V0IGFtYmllbnQsIHRvIGFkZCBpdFxuICAgICAgICAgICAgICAgIG9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gZG9uJ3QgYWRkIGFtYmllbnQgdG8gZGlmZnVzZSBkaXJlY3RseSBidXQga2VlcCBpdCBzZXBhcmF0ZSwgdG8gYWxsb3cgQU8gdG8gYmUgbXVsdGlwbGllZCBpblxuICAgICAgICAgICAgICAgIG9wdGlvbnMuc2VwYXJhdGVBbWJpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVUZXh0dXJlKHNpemUsIHR5cGUsIG5hbWUpIHtcblxuICAgICAgICByZXR1cm4gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHByb2ZpbGVySGludDogVEVYSElOVF9MSUdIVE1BUCxcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgd2lkdGg6IHNpemUsXG4gICAgICAgICAgICBoZWlnaHQ6IHNpemUsXG4gICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gcmVjdXJzaXZlbHkgd2FsayB0aGUgaGllcmFyY2h5IG9mIG5vZGVzIHN0YXJ0aW5nIGF0IHRoZSBzcGVjaWZpZWQgbm9kZVxuICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIHRoYXQgbmVlZCB0byBiZSBsaWdodG1hcHBlZCB0byBiYWtlTm9kZXMgYXJyYXlcbiAgICAvLyBjb2xsZWN0IGFsbCBub2RlcyB3aXRoIGdlb21ldHJ5IHRvIGFsbE5vZGVzIGFycmF5XG4gICAgY29sbGVjdE1vZGVscyhub2RlLCBiYWtlTm9kZXMsIGFsbE5vZGVzKSB7XG4gICAgICAgIGlmICghbm9kZS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgLy8gbWVzaCBpbnN0YW5jZXMgZnJvbSBtb2RlbCBjb21wb25lbnRcbiAgICAgICAgbGV0IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChub2RlLm1vZGVsPy5tb2RlbCAmJiBub2RlLm1vZGVsPy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoYWxsTm9kZXMpIGFsbE5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlKSk7XG4gICAgICAgICAgICBpZiAobm9kZS5tb2RlbC5saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgICAgIGlmIChiYWtlTm9kZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcyA9IG5vZGUubW9kZWwubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtZXNoIGluc3RhbmNlcyBmcm9tIHJlbmRlciBjb21wb25lbnRcbiAgICAgICAgaWYgKG5vZGUucmVuZGVyPy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoYWxsTm9kZXMpIGFsbE5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlKSk7XG4gICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIubGlnaHRtYXBwZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoYmFrZU5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMgPSBub2RlLnJlbmRlci5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBsZXQgaGFzVXYxID0gdHJ1ZTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2VzW2ldLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjEpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcubG9nKGBMaWdodG1hcHBlciAtIG5vZGUgWyR7bm9kZS5uYW1lfV0gY29udGFpbnMgbWVzaGVzIHdpdGhvdXQgcmVxdWlyZWQgdXYxLCBleGNsdWRpbmcgaXQgZnJvbSBiYWtpbmcuYCk7XG4gICAgICAgICAgICAgICAgICAgIGhhc1V2MSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChoYXNVdjEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3RJbnN0YW5jZWRNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2VzW2ldLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhpcyBtZXNoIGFuIGluc3RhbmNlIG9mIGFscmVhZHkgdXNlZCBtZXNoIGluIHRoaXMgbm9kZVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fdGVtcFNldC5oYXMobWVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbGxlY3QgZWFjaCBpbnN0YW5jZSAob2JqZWN0IHdpdGggc2hhcmVkIFZCKSBhcyBzZXBhcmF0ZSBcIm5vZGVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgYmFrZU5vZGVzLnB1c2gobmV3IEJha2VNZXNoTm9kZShub2RlLCBbbWVzaEluc3RhbmNlc1tpXV0pKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90ZW1wU2V0LmFkZChtZXNoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl90ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IGFsbCBub24tc2hhcmVkIG9iamVjdHMgYXMgb25lIFwibm9kZVwiXG4gICAgICAgICAgICAgICAgaWYgKG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBiYWtlTm9kZXMucHVzaChuZXcgQmFrZU1lc2hOb2RlKG5vZGUsIG5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZS5fY2hpbGRyZW5baV0sIGJha2VOb2RlcywgYWxsTm9kZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZSBhbGwgbWVzaEluc3RhbmNlcyB0aGF0IGNhc3Qgc2hhZG93cyBpbnRvIGxpZ2h0bWFwc1xuICAgIHByZXBhcmVTaGFkb3dDYXN0ZXJzKG5vZGVzKSB7XG5cbiAgICAgICAgY29uc3QgY2FzdGVycyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IG5vZGVzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2Rlc1tuXS5jb21wb25lbnQ7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5jYXN0U2hhZG93cyA9IGNvbXBvbmVudC5jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5jYXN0U2hhZG93c0xpZ2h0bWFwKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoZXMgPSBub2Rlc1tuXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlc1tpXS52aXNpYmxlVGhpc0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY2FzdGVycy5wdXNoKG1lc2hlc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNhc3RlcnM7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyB3b3JsZCB0cmFuc2Zvcm0gZm9yIG5vZGVzXG4gICAgdXBkYXRlVHJhbnNmb3Jtcyhub2Rlcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2Rlc1tpXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tqXS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb3RlOiB0aGlzIGZ1bmN0aW9uIGlzIGFsc28gY2FsbGVkIGJ5IHRoZSBFZGl0b3IgdG8gZGlzcGxheSBlc3RpbWF0ZWQgTE0gc2l6ZSBpbiB0aGUgaW5zcGVjdG9yLFxuICAgIC8vIGRvIG5vdCBjaGFuZ2UgaXRzIHNpZ25hdHVyZS5cbiAgICBjYWxjdWxhdGVMaWdodG1hcFNpemUobm9kZSkge1xuICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgY29uc3Qgc2l6ZU11bHQgPSB0aGlzLnNjZW5lLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgfHwgMTY7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGVtcFZlYztcblxuICAgICAgICBsZXQgc3JjQXJlYSwgbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcblxuICAgICAgICBpZiAobm9kZS5tb2RlbCkge1xuICAgICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IG5vZGUubW9kZWwubGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICAgICAgICAgIGlmIChub2RlLm1vZGVsLmFzc2V0KSB7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHRoaXMuYXNzZXRzLmdldChub2RlLm1vZGVsLmFzc2V0KS5kYXRhO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhLmFyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuYXJlYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG5vZGUubW9kZWwuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gbm9kZS5tb2RlbDtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICBzcmNBcmVhID0gZGF0YS5fYXJlYTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5yZW5kZXIpIHtcbiAgICAgICAgICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSBub2RlLnJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLnR5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIuX2FyZWEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IG5vZGUucmVuZGVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5fYXJlYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3JjQXJlYSA9IGRhdGEuX2FyZWE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb3B5IGFyZWFcbiAgICAgICAgY29uc3QgYXJlYSA9IHsgeDogMSwgeTogMSwgejogMSwgdXY6IDEgfTtcbiAgICAgICAgaWYgKHNyY0FyZWEpIHtcbiAgICAgICAgICAgIGFyZWEueCA9IHNyY0FyZWEueDtcbiAgICAgICAgICAgIGFyZWEueSA9IHNyY0FyZWEueTtcbiAgICAgICAgICAgIGFyZWEueiA9IHNyY0FyZWEuejtcbiAgICAgICAgICAgIGFyZWEudXYgPSBzcmNBcmVhLnV2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXJlYU11bHQgPSBsaWdodG1hcFNpemVNdWx0aXBsaWVyIHx8IDE7XG4gICAgICAgIGFyZWEueCAqPSBhcmVhTXVsdDtcbiAgICAgICAgYXJlYS55ICo9IGFyZWFNdWx0O1xuICAgICAgICBhcmVhLnogKj0gYXJlYU11bHQ7XG5cbiAgICAgICAgLy8gYm91bmRzIG9mIHRoZSBjb21wb25lbnRcbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5yZW5kZXIgfHwgbm9kZS5tb2RlbDtcbiAgICAgICAgY29uc3QgYm91bmRzID0gdGhpcy5jb21wdXRlTm9kZUJvdW5kcyhjb21wb25lbnQubWVzaEluc3RhbmNlcyk7XG5cbiAgICAgICAgLy8gdG90YWwgYXJlYSBpbiB0aGUgbGlnaHRtYXAgaXMgYmFzZWQgb24gdGhlIHdvcmxkIHNwYWNlIGJvdW5kcyBvZiB0aGUgbWVzaFxuICAgICAgICBzY2FsZS5jb3B5KGJvdW5kcy5oYWxmRXh0ZW50cyk7XG4gICAgICAgIGxldCB0b3RhbEFyZWEgPSBhcmVhLnggKiBzY2FsZS55ICogc2NhbGUueiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhLnkgKiBzY2FsZS54ICogc2NhbGUueiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhLnogKiBzY2FsZS54ICogc2NhbGUueTtcbiAgICAgICAgdG90YWxBcmVhIC89IGFyZWEudXY7XG4gICAgICAgIHRvdGFsQXJlYSA9IE1hdGguc3FydCh0b3RhbEFyZWEpO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0bWFwU2l6ZSA9IE1hdGgubWluKG1hdGgubmV4dFBvd2VyT2ZUd28odG90YWxBcmVhICogc2l6ZU11bHQpLCB0aGlzLnNjZW5lLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiB8fCBNQVhfTElHSFRNQVBfU0laRSk7XG5cbiAgICAgICAgcmV0dXJuIGxpZ2h0bWFwU2l6ZTtcbiAgICB9XG5cbiAgICBzZXRMaWdodG1hcHBpbmcobm9kZXMsIHZhbHVlLCBwYXNzQ291bnQsIHNoYWRlckRlZnMpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gbm9kZS5tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBqKyspIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbal07XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZGVyRGVmcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9zaGFkZXJEZWZzIHw9IHNoYWRlckRlZnM7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IGxpZ2h0cyB0aGF0IGFmZmVjdCBsaWdodG1hcHBlZCBvYmplY3RzIGFyZSB1c2VkIG9uIHRoaXMgbWVzaCBub3cgdGhhdCBpdCBpcyBiYWtlZFxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UubWFzayA9IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IG5vZGUucmVuZGVyVGFyZ2V0c1twYXNzXS5jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleC5taW5GaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4Lm1hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzW3Bhc3NdLCB0ZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIGFuZCBhcHBsaWVzIHRoZSBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VudGl0eVtdfG51bGx9IG5vZGVzIC0gQW4gYXJyYXkgb2YgZW50aXRpZXMgKHdpdGggbW9kZWwgb3IgcmVuZGVyIGNvbXBvbmVudHMpIHRvXG4gICAgICogcmVuZGVyIGxpZ2h0bWFwcyBmb3IuIElmIG5vdCBzdXBwbGllZCwgdGhlIGVudGlyZSBzY2VuZSB3aWxsIGJlIGJha2VkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbW9kZV0gLSBCYWtpbmcgbW9kZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcFxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1JESVJ9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXAgKyBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24gKHVzZWQgZm9yXG4gICAgICogYnVtcC9zcGVjdWxhcilcbiAgICAgKlxuICAgICAqIE9ubHkgbGlnaHRzIHdpdGggYmFrZURpcj10cnVlIHdpbGwgYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uLlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBCQUtFX0NPTE9SRElSfS5cbiAgICAgKi9cbiAgICBiYWtlKG5vZGVzLCBtb2RlID0gQkFLRV9DT0xPUkRJUikge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcblxuICAgICAgICAvLyB1cGRhdGUgc2t5Ym94XG4gICAgICAgIHRoaXMuc2NlbmUuX3VwZGF0ZVNreShkZXZpY2UpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgZGV2aWNlLmZpcmUoJ2xpZ2h0bWFwcGVyOnN0YXJ0Jywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBzdGFydFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuc3RhdHMucmVuZGVyUGFzc2VzID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5zdGF0cy5mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0U2hhZGVycyA9IGRldmljZS5fc2hhZGVyU3RhdHMubGlua2VkO1xuICAgICAgICBjb25zdCBzdGFydEZib1RpbWUgPSBkZXZpY2UuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZTtcbiAgICAgICAgY29uc3Qgc3RhcnRDb21waWxlVGltZSA9IGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWU7XG5cbiAgICAgICAgLy8gQmFrZU1lc2hOb2RlIG9iamVjdHMgZm9yIGJha2luZ1xuICAgICAgICBjb25zdCBiYWtlTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBhbGwgQmFrZU1lc2hOb2RlIG9iamVjdHNcbiAgICAgICAgY29uc3QgYWxsTm9kZXMgPSBbXTtcblxuICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIC8gbWVzaEluc3RhbmNlcyBmb3IgYmFraW5nXG4gICAgICAgIGlmIChub2Rlcykge1xuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IG5vZGVzIGZvciBiYWtpbmcgYmFzZWQgb24gc3BlY2lmaWVkIGxpc3Qgb2Ygbm9kZXNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHMobm9kZXNbaV0sIGJha2VOb2RlcywgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYWxsIG5vZGVzIGZyb20gdGhlIHNjZW5lXG4gICAgICAgICAgICB0aGlzLmNvbGxlY3RNb2RlbHModGhpcy5yb290LCBudWxsLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gY29sbGVjdCBub2RlcyBmcm9tIHRoZSByb290IG9mIHRoZSBzY2VuZVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0TW9kZWxzKHRoaXMucm9vdCwgYmFrZU5vZGVzLCBhbGxOb2Rlcyk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgJ0xNQmFrZScpO1xuXG4gICAgICAgIC8vIGJha2Ugbm9kZXNcbiAgICAgICAgaWYgKGJha2VOb2Rlcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIGRpc2FibGUgbGlnaHRtYXBwaW5nXG4gICAgICAgICAgICBjb25zdCBwYXNzQ291bnQgPSBtb2RlID09PSBCQUtFX0NPTE9SRElSID8gMiA6IDE7XG4gICAgICAgICAgICB0aGlzLnNldExpZ2h0bWFwcGluZyhiYWtlTm9kZXMsIGZhbHNlLCBwYXNzQ291bnQpO1xuXG4gICAgICAgICAgICB0aGlzLmluaXRCYWtlKGRldmljZSk7XG4gICAgICAgICAgICB0aGlzLmJha2VJbnRlcm5hbChwYXNzQ291bnQsIGJha2VOb2RlcywgYWxsTm9kZXMpO1xuXG4gICAgICAgICAgICAvLyBFbmFibGUgbmV3IGxpZ2h0bWFwc1xuICAgICAgICAgICAgbGV0IHNoYWRlckRlZnMgPSBTSEFERVJERUZfTE07XG5cbiAgICAgICAgICAgIGlmIChtb2RlID09PSBCQUtFX0NPTE9SRElSKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyRGVmcyB8PSBTSEFERVJERUZfRElSTE07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG1hcmsgbGlnaHRtYXAgYXMgY29udGFpbmluZyBhbWJpZW50IGxpZ2h0aW5nXG4gICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgICAgIHNoYWRlckRlZnMgfD0gU0hBREVSREVGX0xNQU1CSUVOVDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc2V0TGlnaHRtYXBwaW5nKGJha2VOb2RlcywgdHJ1ZSwgcGFzc0NvdW50LCBzaGFkZXJEZWZzKTtcblxuICAgICAgICAgICAgLy8gY2xlYW4gdXAgbWVtb3J5XG4gICAgICAgICAgICB0aGlzLmZpbmlzaEJha2UoYmFrZU5vZGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcblxuICAgICAgICBjb25zdCBub3dUaW1lID0gbm93KCk7XG4gICAgICAgIHRoaXMuc3RhdHMudG90YWxSZW5kZXJUaW1lID0gbm93VGltZSAtIHN0YXJ0VGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5zaGFkZXJzTGlua2VkID0gZGV2aWNlLl9zaGFkZXJTdGF0cy5saW5rZWQgLSBzdGFydFNoYWRlcnM7XG4gICAgICAgIHRoaXMuc3RhdHMuY29tcGlsZVRpbWUgPSBkZXZpY2UuX3NoYWRlclN0YXRzLmNvbXBpbGVUaW1lIC0gc3RhcnRDb21waWxlVGltZTtcbiAgICAgICAgdGhpcy5zdGF0cy5mYm9UaW1lID0gZGV2aWNlLl9yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUgLSBzdGFydEZib1RpbWU7XG4gICAgICAgIHRoaXMuc3RhdHMubGlnaHRtYXBDb3VudCA9IGJha2VOb2Rlcy5sZW5ndGg7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBkZXZpY2UuZmlyZSgnbGlnaHRtYXBwZXI6ZW5kJywge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBub3dUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvLyB0aGlzIGFsbG9jYXRlcyBsaWdodG1hcCB0ZXh0dXJlcyBhbmQgcmVuZGVyIHRhcmdldHMuIE5vdGUgdGhhdCB0aGUgdHlwZSB1c2VkIGhlcmUgaXMgYWx3YXlzIFRFWFRVUkVUWVBFX0RFRkFVTFQsXG4gICAgLy8gYXMgd2UgcGluZy1wb25nIGJldHdlZW4gdmFyaW91cyByZW5kZXIgdGFyZ2V0cyBhbnl3YXlzLCBhbmQgc2hhZGVyIHVzZXMgaGFyZGNvZGVkIHR5cGVzIGFuZCBpZ25vcmVzIGl0IGFueXdheXMuXG4gICAgYWxsb2NhdGVUZXh0dXJlcyhiYWtlTm9kZXMsIHBhc3NDb3VudCkge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmFrZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8vIHJlcXVpcmVkIGxpZ2h0bWFwIHNpemVcbiAgICAgICAgICAgIGNvbnN0IGJha2VOb2RlID0gYmFrZU5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IHRoaXMuY2FsY3VsYXRlTGlnaHRtYXBTaXplKGJha2VOb2RlLm5vZGUpO1xuXG4gICAgICAgICAgICAvLyB0ZXh0dXJlIGFuZCByZW5kZXIgdGFyZ2V0IGZvciBlYWNoIHBhc3MsIHN0b3JlZCBwZXIgbm9kZVxuICAgICAgICAgICAgZm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCBwYXNzQ291bnQ7IHBhc3MrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuY3JlYXRlVGV4dHVyZShzaXplLCBURVhUVVJFVFlQRV9ERUZBVUxULCAoJ2xpZ2h0bWFwcGVyX2xpZ2h0bWFwXycgKyBpKSk7XG4gICAgICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGV4KTtcbiAgICAgICAgICAgICAgICBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgsXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzaW5nbGUgdGVtcG9yYXJ5IHJlbmRlciB0YXJnZXQgb2YgZWFjaCBzaXplXG4gICAgICAgICAgICBpZiAoIXRoaXMucmVuZGVyVGFyZ2V0cy5oYXMoc2l6ZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLmNyZWF0ZVRleHR1cmUoc2l6ZSwgVEVYVFVSRVRZUEVfREVGQVVMVCwgKCdsaWdodG1hcHBlcl90ZW1wX2xpZ2h0bWFwXycgKyBzaXplKSk7XG4gICAgICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldHMuc2V0KHNpemUsIG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGV4LFxuICAgICAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcmVwYXJlTGlnaHRzVG9CYWtlKGxheWVyQ29tcG9zaXRpb24sIGFsbExpZ2h0cywgYmFrZUxpZ2h0cykge1xuXG4gICAgICAgIC8vIGFtYmllbnQgbGlnaHRcbiAgICAgICAgaWYgKHRoaXMuc2NlbmUuYW1iaWVudEJha2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGFtYmllbnRMaWdodCA9IG5ldyBCYWtlTGlnaHRBbWJpZW50KHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgYmFrZUxpZ2h0cy5wdXNoKGFtYmllbnRMaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY2VuZSBsaWdodHNcbiAgICAgICAgY29uc3Qgc2NlbmVMaWdodHMgPSBsYXllckNvbXBvc2l0aW9uLl9saWdodHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NlbmVMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gc2NlbmVMaWdodHNbaV07XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIGFsbCBsaWdodHMgYW5kIHRoZWlyIG9yaWdpbmFsIHNldHRpbmdzIHdlIG5lZWQgdG8gdGVtcG9yYXJpbHkgbW9kaWZ5XG4gICAgICAgICAgICBjb25zdCBiYWtlTGlnaHQgPSBuZXcgQmFrZUxpZ2h0U2ltcGxlKHRoaXMuc2NlbmUsIGxpZ2h0KTtcbiAgICAgICAgICAgIGFsbExpZ2h0cy5wdXNoKGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgIC8vIGJha2UgbGlnaHRcbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkICYmIChsaWdodC5tYXNrICYgTUFTS19CQUtFKSAhPT0gMCkge1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgYmFrZWQsIGl0IGNhbid0IGJlIHVzZWQgYXMgc3RhdGljXG4gICAgICAgICAgICAgICAgbGlnaHQuaXNTdGF0aWMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGxpZ2h0Lm1hc2sgPSAweEZGRkZGRkZGO1xuICAgICAgICAgICAgICAgIGxpZ2h0LnNoYWRvd1VwZGF0ZU1vZGUgPSBsaWdodC50eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgPyBTSEFET1dVUERBVEVfUkVBTFRJTUUgOiBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICAgICAgICAgIGJha2VMaWdodHMucHVzaChiYWtlTGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc29ydCBiYWtlIGxpZ2h0cyBieSB0eXBlIHRvIG1pbmltaXplIHNoYWRlciBzd2l0Y2hlc1xuICAgICAgICBiYWtlTGlnaHRzLnNvcnQoKTtcbiAgICB9XG5cbiAgICByZXN0b3JlTGlnaHRzKGFsbExpZ2h0cykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhbGxMaWdodHNbaV0ucmVzdG9yZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBTY2VuZSgpIHtcblxuICAgICAgICAvLyBsaWdodG1hcHBlciBuZWVkcyBvcmlnaW5hbCBtb2RlbCBkcmF3IGNhbGxzXG4gICAgICAgIHRoaXMucmV2ZXJ0U3RhdGljID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLnNjZW5lLl9uZWVkc1N0YXRpY1ByZXBhcmUpIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUuX25lZWRzU3RhdGljUHJlcGFyZSA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5yZXZlcnRTdGF0aWMgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYmFja3VwXG4gICAgICAgIHRoaXMuZm9nID0gdGhpcy5zY2VuZS5mb2c7XG4gICAgICAgIHRoaXMuYW1iaWVudExpZ2h0LmNvcHkodGhpcy5zY2VuZS5hbWJpZW50TGlnaHQpO1xuXG4gICAgICAgIC8vIHNldCB1cCBzY2VuZVxuICAgICAgICB0aGlzLnNjZW5lLmZvZyA9IEZPR19OT05FO1xuXG4gICAgICAgIC8vIGlmIG5vdCBiYWtpbmcgYW1iaWVudCwgc2V0IGl0IHRvIGJsYWNrXG4gICAgICAgIGlmICghdGhpcy5zY2VuZS5hbWJpZW50QmFrZSkge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5hbWJpZW50TGlnaHQuc2V0KDAsIDAsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXBwbHkgc2NlbmUgc2V0dGluZ3NcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRTY2VuZUNvbnN0YW50cygpO1xuICAgIH1cblxuICAgIHJlc3RvcmVTY2VuZSgpIHtcblxuICAgICAgICB0aGlzLnNjZW5lLmZvZyA9IHRoaXMuZm9nO1xuICAgICAgICB0aGlzLnNjZW5lLmFtYmllbnRMaWdodC5jb3B5KHRoaXMuYW1iaWVudExpZ2h0KTtcblxuICAgICAgICAvLyBSZXZlcnQgc3RhdGljIHByZXByb2Nlc3NpbmdcbiAgICAgICAgaWYgKHRoaXMucmV2ZXJ0U3RhdGljKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLl9uZWVkc1N0YXRpY1ByZXBhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBib3VuZGluZyBib3ggZm9yIGEgc2luZ2xlIG5vZGVcbiAgICBjb21wdXRlTm9kZUJvdW5kcyhtZXNoSW5zdGFuY2VzKSB7XG5cbiAgICAgICAgY29uc3QgYm91bmRzID0gbmV3IEJvdW5kaW5nQm94KCk7XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYm91bmRzLmNvcHkobWVzaEluc3RhbmNlc1swXS5hYWJiKTtcbiAgICAgICAgICAgIGZvciAobGV0IG0gPSAxOyBtIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IG0rKykge1xuICAgICAgICAgICAgICAgIGJvdW5kcy5hZGQobWVzaEluc3RhbmNlc1ttXS5hYWJiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBib3VuZHM7XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBib3VuZGluZyBib3ggZm9yIGVhY2ggbm9kZVxuICAgIGNvbXB1dGVOb2Rlc0JvdW5kcyhub2Rlcykge1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBub2Rlc1tpXS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgbm9kZXNbaV0uYm91bmRzID0gdGhpcy5jb21wdXRlTm9kZUJvdW5kcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgY29tcG91bmQgYm91bmRpbmcgYm94IGZvciBhbiBhcnJheSBvZiBtZXNoIGluc3RhbmNlc1xuICAgIGNvbXB1dGVCb3VuZHMobWVzaEluc3RhbmNlcykge1xuXG4gICAgICAgIGNvbnN0IGJvdW5kcyA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYm91bmRzLmNvcHkobWVzaEluc3RhbmNlc1swXS5hYWJiKTtcbiAgICAgICAgICAgIGZvciAobGV0IG0gPSAxOyBtIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IG0rKykge1xuICAgICAgICAgICAgICAgIGJvdW5kcy5hZGQobWVzaEluc3RhbmNlc1ttXS5hYWJiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBib3VuZHM7XG4gICAgfVxuXG4gICAgYmFja3VwTWF0ZXJpYWxzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsc1tpXSA9IG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXN0b3JlTWF0ZXJpYWxzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbHNbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsaWdodENhbWVyYVByZXBhcmUoZGV2aWNlLCBiYWtlTGlnaHQpIHtcblxuICAgICAgICBjb25zdCBsaWdodCA9IGJha2VMaWdodC5saWdodDtcbiAgICAgICAgbGV0IHNoYWRvd0NhbTtcblxuICAgICAgICAvLyBvbmx5IHByZXBhcmUgY2FtZXJhIGZvciBzcG90IGxpZ2h0LCBvdGhlciBjYW1lcmFzIG5lZWQgdG8gYmUgYWRqdXN0ZWQgcGVyIGN1YmVtYXAgZmFjZSAvIHBlciBub2RlIGxhdGVyXG4gICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuXG4gICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICAgICAgc2hhZG93Q2FtID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYTtcblxuICAgICAgICAgICAgc2hhZG93Q2FtLl9ub2RlLnNldFBvc2l0aW9uKGxpZ2h0Ll9ub2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgc2hhZG93Q2FtLl9ub2RlLnNldFJvdGF0aW9uKGxpZ2h0Ll9ub2RlLmdldFJvdGF0aW9uKCkpO1xuICAgICAgICAgICAgc2hhZG93Q2FtLl9ub2RlLnJvdGF0ZUxvY2FsKC05MCwgMCwgMCk7XG5cbiAgICAgICAgICAgIHNoYWRvd0NhbS5wcm9qZWN0aW9uID0gUFJPSkVDVElPTl9QRVJTUEVDVElWRTtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5uZWFyQ2xpcCA9IGxpZ2h0LmF0dGVudWF0aW9uRW5kIC8gMTAwMDtcbiAgICAgICAgICAgIHNoYWRvd0NhbS5mYXJDbGlwID0gbGlnaHQuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBzaGFkb3dDYW0uYXNwZWN0UmF0aW8gPSAxO1xuICAgICAgICAgICAgc2hhZG93Q2FtLmZvdiA9IGxpZ2h0Ll9vdXRlckNvbmVBbmdsZSAqIDI7XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlQ2FtZXJhRnJ1c3R1bShzaGFkb3dDYW0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzaGFkb3dDYW07XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgY2FtZXJhIC8gZnJ1c3R1bSBvZiB0aGUgbGlnaHQgZm9yIHJlbmRlcmluZyB0aGUgYmFrZU5vZGVcbiAgICAvLyByZXR1cm5zIHRydWUgaWYgbGlnaHQgYWZmZWN0cyB0aGUgYmFrZU5vZGVcbiAgICBsaWdodENhbWVyYVByZXBhcmVBbmRDdWxsKGJha2VMaWdodCwgYmFrZU5vZGUsIHNoYWRvd0NhbSwgY2FzdGVyQm91bmRzKSB7XG5cbiAgICAgICAgY29uc3QgbGlnaHQgPSBiYWtlTGlnaHQubGlnaHQ7XG4gICAgICAgIGxldCBsaWdodEFmZmVjdHNOb2RlID0gdHJ1ZTtcblxuICAgICAgICBpZiAobGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG5cbiAgICAgICAgICAgIC8vIHR3ZWFrIGRpcmVjdGlvbmFsIGxpZ2h0IGNhbWVyYSB0byBmdWxseSBzZWUgYWxsIGNhc3RlcnMgYW5kIHRoZXkgYXJlIGZ1bGx5IGluc2lkZSB0aGUgZnJ1c3R1bVxuICAgICAgICAgICAgdGVtcFZlYy5jb3B5KGNhc3RlckJvdW5kcy5jZW50ZXIpO1xuICAgICAgICAgICAgdGVtcFZlYy55ICs9IGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy55O1xuXG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5ub2RlLnNldFBvc2l0aW9uKHRlbXBWZWMpO1xuICAgICAgICAgICAgdGhpcy5jYW1lcmEubm9kZS5zZXRFdWxlckFuZ2xlcygtOTAsIDAsIDApO1xuXG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5uZWFyQ2xpcCA9IDA7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5mYXJDbGlwID0gY2FzdGVyQm91bmRzLmhhbGZFeHRlbnRzLnkgKiAyO1xuXG4gICAgICAgICAgICBjb25zdCBmcnVzdHVtU2l6ZSA9IE1hdGgubWF4KGNhc3RlckJvdW5kcy5oYWxmRXh0ZW50cy54LCBjYXN0ZXJCb3VuZHMuaGFsZkV4dGVudHMueik7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYS5vcnRob0hlaWdodCA9IGZydXN0dW1TaXplO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGZvciBvdGhlciBsaWdodCB0eXBlcywgdGVzdCBpZiBsaWdodCBhZmZlY3RzIHRoZSBub2RlXG4gICAgICAgICAgICBpZiAoIWJha2VMaWdodC5saWdodEJvdW5kcy5pbnRlcnNlY3RzKGJha2VOb2RlLmJvdW5kcykpIHtcbiAgICAgICAgICAgICAgICBsaWdodEFmZmVjdHNOb2RlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwZXIgbWVzaEluc3RhbmNlIGN1bGxpbmcgZm9yIHNwb3QgbGlnaHQgb25seVxuICAgICAgICAvLyAob21uaSBsaWdodHMgY3VsbCBwZXIgZmFjZSBsYXRlciwgZGlyZWN0aW9uYWwgbGlnaHRzIGRvbid0IGN1bGwpXG4gICAgICAgIGlmIChsaWdodC50eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgbGV0IG5vZGVWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBiYWtlTm9kZS5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXNbaV0uX2lzVmlzaWJsZShzaGFkb3dDYW0pKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVWaXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFub2RlVmlzaWJsZSkge1xuICAgICAgICAgICAgICAgIGxpZ2h0QWZmZWN0c05vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaWdodEFmZmVjdHNOb2RlO1xuICAgIH1cblxuICAgIC8vIHNldCB1cCBsaWdodCBhcnJheSBmb3IgYSBzaW5nbGUgbGlnaHRcbiAgICBzZXR1cExpZ2h0QXJyYXkobGlnaHRBcnJheSwgbGlnaHQpIHtcblxuICAgICAgICBsaWdodEFycmF5W0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0ubGVuZ3RoID0gMDtcbiAgICAgICAgbGlnaHRBcnJheVtMSUdIVFRZUEVfT01OSV0ubGVuZ3RoID0gMDtcbiAgICAgICAgbGlnaHRBcnJheVtMSUdIVFRZUEVfU1BPVF0ubGVuZ3RoID0gMDtcblxuICAgICAgICBsaWdodEFycmF5W2xpZ2h0LnR5cGVdWzBdID0gbGlnaHQ7XG4gICAgICAgIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgPSB0cnVlO1xuICAgIH1cblxuICAgIHJlbmRlclNoYWRvd01hcChzaGFkb3dNYXBSZW5kZXJlZCwgY2FzdGVycywgbGlnaHRBcnJheSwgYmFrZUxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbGlnaHQgPSBiYWtlTGlnaHQubGlnaHQ7XG4gICAgICAgIGlmICghc2hhZG93TWFwUmVuZGVyZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgLy8gYWxsb2NhdGUgc2hhZG93IG1hcCBmcm9tIHRoZSBjYWNoZSB0byBhdm9pZCBwZXIgbGlnaHQgYWxsb2NhdGlvblxuICAgICAgICAgICAgaWYgKCFsaWdodC5zaGFkb3dNYXAgJiYgIXRoaXMuc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgbGlnaHQuc2hhZG93TWFwID0gdGhpcy5zaGFkb3dNYXBDYWNoZS5nZXQodGhpcy5kZXZpY2UsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGxpZ2h0LnR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd1JlbmRlcmVyLmN1bGxEaXJlY3Rpb25hbChsaWdodCwgY2FzdGVycywgdGhpcy5jYW1lcmEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dSZW5kZXJlci5jdWxsTG9jYWwobGlnaHQsIGNhc3RlcnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbmRlclNoYWRvd3MobGlnaHRBcnJheVtsaWdodC50eXBlXSwgdGhpcy5jYW1lcmEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcG9zdHByb2Nlc3NUZXh0dXJlcyhkZXZpY2UsIGJha2VOb2RlcywgcGFzc0NvdW50KSB7XG5cbiAgICAgICAgY29uc3QgbnVtRGlsYXRlczJ4ID0gMTsgLy8gMSBvciAyIGRpbGF0ZXMgKGRlcGVuZGluZyBvbiBmaWx0ZXIgYmVpbmcgZW5hYmxlZClcbiAgICAgICAgY29uc3QgZGlsYXRlU2hhZGVyID0gdGhpcy5saWdodG1hcEZpbHRlcnMuc2hhZGVyRGlsYXRlO1xuXG4gICAgICAgIC8vIGJpbGF0ZXJhbCBkZW5vaXNlIGZpbHRlciAtIHJ1bnMgYXMgYSBmaXJzdCBwYXNzLCBiZWZvcmUgZGlsYXRlXG4gICAgICAgIGNvbnN0IGZpbHRlckxpZ2h0bWFwID0gdGhpcy5zY2VuZS5saWdodG1hcEZpbHRlckVuYWJsZWQ7XG4gICAgICAgIGlmIChmaWx0ZXJMaWdodG1hcCkge1xuICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMucHJlcGFyZURlbm9pc2UodGhpcy5zY2VuZS5saWdodG1hcEZpbHRlclJhbmdlLCB0aGlzLnNjZW5lLmxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBub2RlID0gMDsgbm9kZSA8IGJha2VOb2Rlcy5sZW5ndGg7IG5vZGUrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbbm9kZV07XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLmRldmljZSwgYExNUG9zdDoke25vZGV9YCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXAgPSBub2RlUlQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wUlQgPSB0aGlzLnJlbmRlclRhcmdldHMuZ2V0KGxpZ2h0bWFwLndpZHRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wVGV4ID0gdGVtcFJULmNvbG9yQnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5saWdodG1hcEZpbHRlcnMucHJlcGFyZShsaWdodG1hcC53aWR0aCwgbGlnaHRtYXAuaGVpZ2h0KTtcblxuICAgICAgICAgICAgICAgIC8vIGJvdW5jZSBkaWxhdGUgYmV0d2VlbiB0ZXh0dXJlcywgZXhlY3V0ZSBkZW5vaXNlIG9uIHRoZSBmaXJzdCBwYXNzXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1EaWxhdGVzMng7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGlnaHRtYXBGaWx0ZXJzLnNldFNvdXJjZVRleHR1cmUobGlnaHRtYXApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiaWxhdGVyYWxGaWx0ZXJFbmFibGVkID0gZmlsdGVyTGlnaHRtYXAgJiYgcGFzcyA9PT0gMCAmJiBpID09PSAwO1xuICAgICAgICAgICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0ZW1wUlQsIGJpbGF0ZXJhbEZpbHRlckVuYWJsZWQgPyB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zaGFkZXJEZW5vaXNlIDogZGlsYXRlU2hhZGVyKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpZ2h0bWFwRmlsdGVycy5zZXRTb3VyY2VUZXh0dXJlKHRlbXBUZXgpO1xuICAgICAgICAgICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCBub2RlUlQsIGRpbGF0ZVNoYWRlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzLmRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBiYWtlSW50ZXJuYWwocGFzc0NvdW50LCBiYWtlTm9kZXMsIGFsbE5vZGVzKSB7XG5cbiAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gc2NlbmUuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlTWF0ZXJpYWxzKGRldmljZSwgc2NlbmUsIHBhc3NDb3VudCk7XG4gICAgICAgIHRoaXMuc2V0dXBTY2VuZSgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBsYXllciBjb21wb3NpdGlvblxuICAgICAgICBzY2VuZS5sYXllcnMuX3VwZGF0ZSgpO1xuXG4gICAgICAgIC8vIGNvbXB1dGUgYm91bmRpbmcgYm94ZXMgZm9yIG5vZGVzXG4gICAgICAgIHRoaXMuY29tcHV0ZU5vZGVzQm91bmRzKGJha2VOb2Rlcyk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGxpZ2h0bWFwIHNpemVzIGFuZCBhbGxvY2F0ZSB0ZXh0dXJlc1xuICAgICAgICB0aGlzLmFsbG9jYXRlVGV4dHVyZXMoYmFrZU5vZGVzLCBwYXNzQ291bnQpO1xuXG4gICAgICAgIC8vIENvbGxlY3QgYmFrZWFibGUgbGlnaHRzLCBhbmQgYWxzbyBrZWVwIGFsbExpZ2h0cyBhbG9uZyB3aXRoIHRoZWlyIHByb3BlcnRpZXMgd2UgY2hhbmdlIHRvIHJlc3RvcmUgdGhlbSBsYXRlclxuICAgICAgICBjb25zdCBhbGxMaWdodHMgPSBbXSwgYmFrZUxpZ2h0cyA9IFtdO1xuICAgICAgICB0aGlzLnByZXBhcmVMaWdodHNUb0Jha2Uoc2NlbmUubGF5ZXJzLCBhbGxMaWdodHMsIGJha2VMaWdodHMpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMudXBkYXRlVHJhbnNmb3JtcyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gZ2V0IGFsbCBtZXNoSW5zdGFuY2VzIHRoYXQgY2FzdCBzaGFkb3dzIGludG8gbGlnaHRtYXAgYW5kIHNldCB0aGVtIHVwIGZvciByZWFsdGltZSBzaGFkb3cgY2FzdGluZ1xuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5wcmVwYXJlU2hhZG93Q2FzdGVycyhhbGxOb2Rlcyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHNraW5uZWQgYW5kIG1vcnBoZWQgbWVzaGVzXG4gICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlQ3B1U2tpbk1hdHJpY2VzKGNhc3RlcnMpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmdwdVVwZGF0ZShjYXN0ZXJzKTtcblxuICAgICAgICAvLyBjb21wb3VuZCBib3VuZGluZyBib3ggZm9yIGFsbCBjYXN0ZXJzLCB1c2VkIHRvIGNvbXB1dGUgc2hhcmVkIGRpcmVjdGlvbmFsIGxpZ2h0IHNoYWRvd1xuICAgICAgICBjb25zdCBjYXN0ZXJCb3VuZHMgPSB0aGlzLmNvbXB1dGVCb3VuZHMoY2FzdGVycyk7XG5cbiAgICAgICAgbGV0IGksIGosIHJjdiwgbTtcblxuICAgICAgICAvLyBQcmVwYXJlIG1vZGVsc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZU5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYWtlTm9kZSA9IGJha2VOb2Rlc1tpXTtcbiAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAvLyBwYXRjaCBtZXNoSW5zdGFuY2VcbiAgICAgICAgICAgICAgICBtID0gcmN2W2pdO1xuXG4gICAgICAgICAgICAgICAgbS5zZXRMaWdodG1hcHBlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgbS5tYXNrID0gTUFTS19CQUtFOyAvLyBvbmx5IGFmZmVjdGVkIGJ5IExNIGxpZ2h0c1xuXG4gICAgICAgICAgICAgICAgLy8gcGF0Y2ggbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbS5tYXRlcmlhbC5saWdodE1hcCA/IG0ubWF0ZXJpYWwubGlnaHRNYXAgOiB0aGlzLmJsYWNrVGV4KTtcbiAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgdGhpcy5ibGFja1RleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEaXNhYmxlIGFsbCBiYWtlYWJsZSBsaWdodHNcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IGJha2VMaWdodHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGJha2VMaWdodHNbal0ubGlnaHQuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGlnaHRBcnJheSA9IFtbXSwgW10sIFtdXTtcbiAgICAgICAgbGV0IHBhc3MsIG5vZGU7XG4gICAgICAgIGxldCBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIEFjY3VtdWxhdGUgbGlnaHRzIGludG8gUkdCTSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYmFrZUxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmFrZUxpZ2h0ID0gYmFrZUxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzQW1iaWVudExpZ2h0ID0gYmFrZUxpZ2h0IGluc3RhbmNlb2YgQmFrZUxpZ2h0QW1iaWVudDtcblxuICAgICAgICAgICAgLy8gbGlnaHQgY2FuIGJlIGJha2VkIHVzaW5nIG1hbnkgdmlydHVhbCBsaWdodHMgdG8gY3JlYXRlIHNvZnQgZWZmZWN0XG4gICAgICAgICAgICBsZXQgbnVtVmlydHVhbExpZ2h0cyA9IGJha2VMaWdodC5udW1WaXJ0dWFsTGlnaHRzO1xuXG4gICAgICAgICAgICAvLyBkaXJlY3Rpb24gYmFraW5nIGlzIG5vdCBjdXJyZW50bHkgY29tcGF0aWJsZSB3aXRoIHZpcnR1YWwgbGlnaHRzLCBhcyB3ZSBlbmQgdXAgd2l0aCBubyB2YWxpZCBkaXJlY3Rpb24gaW4gbGlnaHRzIHBlbnVtYnJhXG4gICAgICAgICAgICBpZiAocGFzc0NvdW50ID4gMSAmJiBudW1WaXJ0dWFsTGlnaHRzID4gMSAmJiBiYWtlTGlnaHQubGlnaHQuYmFrZURpcikge1xuICAgICAgICAgICAgICAgIG51bVZpcnR1YWxMaWdodHMgPSAxO1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0xpZ2h0bWFwcGVyXFwncyBCQUtFX0NPTE9SRElSIG1vZGUgaXMgbm90IGNvbXBhdGlibGUgd2l0aCBMaWdodFxcJ3MgYmFrZU51bVNhbXBsZXMgbGFyZ2VyIHRoYW4gb25lLiBGb3JjaW5nIGl0IHRvIG9uZS4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgdmlydHVhbExpZ2h0SW5kZXggPSAwOyB2aXJ0dWFsTGlnaHRJbmRleCA8IG51bVZpcnR1YWxMaWdodHM7IHZpcnR1YWxMaWdodEluZGV4KyspIHtcblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBMaWdodDoke2Jha2VMaWdodC5saWdodC5fbm9kZS5uYW1lfToke3ZpcnR1YWxMaWdodEluZGV4fWApO1xuXG4gICAgICAgICAgICAgICAgLy8gcHJlcGFyZSB2aXJ0dWFsIGxpZ2h0XG4gICAgICAgICAgICAgICAgaWYgKG51bVZpcnR1YWxMaWdodHMgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGJha2VMaWdodC5wcmVwYXJlVmlydHVhbExpZ2h0KHZpcnR1YWxMaWdodEluZGV4LCBudW1WaXJ0dWFsTGlnaHRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBiYWtlTGlnaHQuc3RhcnRCYWtlKCk7XG4gICAgICAgICAgICAgICAgbGV0IHNoYWRvd01hcFJlbmRlcmVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dDYW0gPSB0aGlzLmxpZ2h0Q2FtZXJhUHJlcGFyZShkZXZpY2UsIGJha2VMaWdodCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKG5vZGUgPSAwOyBub2RlIDwgYmFrZU5vZGVzLmxlbmd0aDsgbm9kZSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFrZU5vZGUgPSBiYWtlTm9kZXNbbm9kZV07XG4gICAgICAgICAgICAgICAgICAgIHJjdiA9IGJha2VOb2RlLm1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRBZmZlY3RzTm9kZSA9IHRoaXMubGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbChiYWtlTGlnaHQsIGJha2VOb2RlLCBzaGFkb3dDYW0sIGNhc3RlckJvdW5kcyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRBZmZlY3RzTm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldHVwTGlnaHRBcnJheShsaWdodEFycmF5LCBiYWtlTGlnaHQubGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIubGlnaHRUZXh0dXJlQXRsYXMudXBkYXRlKGxpZ2h0QXJyYXlbTElHSFRUWVBFX1NQT1RdLCBsaWdodEFycmF5W0xJR0hUVFlQRV9PTU5JXSwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyByZW5kZXIgbGlnaHQgc2hhZG93IG1hcCBuZWVkcyB0byBiZSByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICBzaGFkb3dNYXBSZW5kZXJlZCA9IHRoaXMucmVuZGVyU2hhZG93TWFwKHNoYWRvd01hcFJlbmRlcmVkLCBjYXN0ZXJzLCBsaWdodEFycmF5LCBiYWtlTGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsdXN0ZXJMaWdodHMgPSBsaWdodEFycmF5W0xJR0hUVFlQRV9TUE9UXS5jb25jYXQobGlnaHRBcnJheVtMSUdIVFRZUEVfT01OSV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLnVwZGF0ZShjbHVzdGVyTGlnaHRzLCB0aGlzLnNjZW5lLmdhbW1hQ29ycmVjdGlvbiwgdGhpcy5saWdodGluZ1BhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSBvcmlnaW5hbCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iYWNrdXBNYXRlcmlhbHMocmN2KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHBhc3MgPSAwOyBwYXNzIDwgcGFzc0NvdW50OyBwYXNzKyspIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSBiYWtlIGZpcnN0IHZpcnR1YWwgbGlnaHQgZm9yIHBhc3MgMSwgYXMgaXQgZG9lcyBub3QgaGFuZGxlIG92ZXJsYXBwaW5nIGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPiAwICYmIHZpcnR1YWxMaWdodEluZGV4ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb24ndCBiYWtlIGFtYmllbnQgbGlnaHQgaW4gcGFzcyAxLCBhcyB0aGVyZSdzIG5vIG1haW4gZGlyZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQgJiYgcGFzcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgYExNUGFzczoke3Bhc3N9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0bWFwIHNpemVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVSVCA9IGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcFNpemUgPSBiYWtlTm9kZS5yZW5kZXJUYXJnZXRzW3Bhc3NdLmNvbG9yQnVmZmVyLndpZHRoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXQgbWF0Y2hpbmcgdGVtcCByZW5kZXIgdGFyZ2V0IHRvIHJlbmRlciB0b1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFJUID0gdGhpcy5yZW5kZXJUYXJnZXRzLmdldChsaWdodG1hcFNpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGVtcFRleCA9IHRlbXBSVC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJzVXBkYXRlZE9uMXN0UGFzcyA9IHNjZW5lLnVwZGF0ZVNoYWRlcnM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNoYWRlcnNVcGRhdGVkT24xc3RQYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmUudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwYXNzTWF0ZXJpYWwgPSB0aGlzLnBhc3NNYXRlcmlhbHNbcGFzc107XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBbWJpZW50TGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgbGFzdCB2aXJ0dWFsIGxpZ2h0IG9mIGFtYmllbnQgbGlnaHQsIG11bHRpcGx5IGFjY3VtdWxhdGVkIEFPIGxpZ2h0bWFwIHdpdGggYW1iaWVudCBsaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RWaXJ0dWFsTGlnaHRGb3JQYXNzID0gdmlydHVhbExpZ2h0SW5kZXggKyAxID09PSBudW1WaXJ0dWFsTGlnaHRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0VmlydHVhbExpZ2h0Rm9yUGFzcyAmJiBwYXNzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhc3NNYXRlcmlhbCA9IHRoaXMuYW1iaWVudEFPTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdXAgbWF0ZXJpYWwgZm9yIGJha2luZyBhIHBhc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCByY3YubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByY3Zbal0ubWF0ZXJpYWwgPSBwYXNzTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBzaGFkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIudXBkYXRlU2hhZGVycyhyY3YpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwaW5nLXBvbmdpbmcgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNldENhbWVyYSh0aGlzLmNhbWVyYSwgdGVtcFJULCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MgPT09IFBBU1NfRElSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25zdGFudEJha2VEaXIuc2V0VmFsdWUoYmFrZUxpZ2h0LmxpZ2h0LmJha2VEaXIgPyAxIDogMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZENsdXN0ZXJzLmFjdGl2YXRlKHRoaXMucmVuZGVyZXIubGlnaHRUZXh0dXJlQXRsYXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZSA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXJGb3J3YXJkKHRoaXMuY2FtZXJhLCByY3YsIHJjdi5sZW5ndGgsIGxpZ2h0QXJyYXksIFNIQURFUl9GT1JXQVJESERSKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnVwZGF0ZUVuZCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRzLnNoYWRvd01hcFRpbWUgKz0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdHMuZm9yd2FyZFRpbWUgKz0gdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRzLnJlbmRlclBhc3NlcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlbXAgcmVuZGVyIHRhcmdldCBub3cgaGFzIGxpZ2h0bWFwLCBzdG9yZSBpdCBmb3IgdGhlIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGJha2VOb2RlLnJlbmRlclRhcmdldHNbcGFzc10gPSB0ZW1wUlQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCByZWxlYXNlIHByZXZpb3VzIGxpZ2h0bWFwIGludG8gdGVtcCByZW5kZXIgdGFyZ2V0IHBvb2xcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0cy5zZXQobGlnaHRtYXBTaXplLCBub2RlUlQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcmN2Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbSA9IHJjdltqXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1twYXNzXSwgdGVtcFRleCk7IC8vIHBpbmctcG9uZ2luZyBpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0uX3NoYWRlckRlZnMgfD0gU0hBREVSREVGX0xNOyAvLyBmb3JjZSB1c2luZyBMTSBldmVuIGlmIG1hdGVyaWFsIGRvZXNuJ3QgaGF2ZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmV2ZXJ0IHRvIG9yaWdpbmFsIG1hdGVyaWFsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3RvcmVNYXRlcmlhbHMocmN2KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBiYWtlTGlnaHQuZW5kQmFrZSh0aGlzLnNoYWRvd01hcENhY2hlKTtcblxuICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3Rwcm9jZXNzVGV4dHVyZXMoZGV2aWNlLCBiYWtlTm9kZXMsIHBhc3NDb3VudCk7XG5cbiAgICAgICAgLy8gcmVzdG9yZSBjaGFuZ2VzXG4gICAgICAgIGZvciAobm9kZSA9IDA7IG5vZGUgPCBhbGxOb2Rlcy5sZW5ndGg7IG5vZGUrKykge1xuICAgICAgICAgICAgYWxsTm9kZXNbbm9kZV0ucmVzdG9yZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZXN0b3JlTGlnaHRzKGFsbExpZ2h0cyk7XG4gICAgICAgIHRoaXMucmVzdG9yZVNjZW5lKCk7XG5cbiAgICAgICAgLy8gZW1wdHkgY2FjaGUgdG8gbWluaW1pemUgcGVyc2lzdGVudCBtZW1vcnkgdXNlIC4uIGlmIHNvbWUgY2FjaGVkIHRleHR1cmVzIGFyZSBuZWVkZWQsXG4gICAgICAgIC8vIHRoZXkgd2lsbCBiZSBhbGxvY2F0ZWQgYWdhaW4gYXMgbmVlZGVkXG4gICAgICAgIGlmICghY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLnNoYWRvd01hcENhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0bWFwcGVyIH07XG4iXSwibmFtZXMiOlsiTUFYX0xJR0hUTUFQX1NJWkUiLCJQQVNTX0NPTE9SIiwiUEFTU19ESVIiLCJ0ZW1wVmVjIiwiVmVjMyIsIkxpZ2h0bWFwcGVyIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJyb290Iiwic2NlbmUiLCJyZW5kZXJlciIsImFzc2V0cyIsInNoYWRvd01hcENhY2hlIiwiX3NoYWRvd1JlbmRlcmVyIiwiX3RlbXBTZXQiLCJTZXQiLCJfaW5pdENhbGxlZCIsInBhc3NNYXRlcmlhbHMiLCJhbWJpZW50QU9NYXRlcmlhbCIsImZvZyIsImFtYmllbnRMaWdodCIsIkNvbG9yIiwicmVuZGVyVGFyZ2V0cyIsIk1hcCIsInN0YXRzIiwicmVuZGVyUGFzc2VzIiwibGlnaHRtYXBDb3VudCIsInRvdGFsUmVuZGVyVGltZSIsImZvcndhcmRUaW1lIiwiZmJvVGltZSIsInNoYWRvd01hcFRpbWUiLCJjb21waWxlVGltZSIsInNoYWRlcnNMaW5rZWQiLCJkZXN0cm95IiwiTGlnaHRtYXBDYWNoZSIsImRlY1JlZiIsImJsYWNrVGV4IiwiaW5pdEJha2UiLCJsaWdodG1hcEZpbHRlcnMiLCJMaWdodG1hcEZpbHRlcnMiLCJjb25zdGFudEJha2VEaXIiLCJzY29wZSIsInJlc29sdmUiLCJtYXRlcmlhbHMiLCJUZXh0dXJlIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsInR5cGUiLCJURVhUVVJFVFlQRV9SR0JNIiwibmFtZSIsImluY1JlZiIsImNhbWVyYSIsIkNhbWVyYSIsImNsZWFyQ29sb3IiLCJzZXQiLCJjbGVhckNvbG9yQnVmZmVyIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsImZydXN0dW1DdWxsaW5nIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiYXNwZWN0UmF0aW8iLCJub2RlIiwiR3JhcGhOb2RlIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHRpbmdQYXJhbXMiLCJMaWdodGluZ1BhcmFtcyIsInN1cHBvcnRzQXJlYUxpZ2h0cyIsIm1heFRleHR1cmVTaXplIiwic3JjUGFyYW1zIiwibGlnaHRpbmciLCJzaGFkb3dzRW5hYmxlZCIsInNoYWRvd0F0bGFzUmVzb2x1dGlvbiIsImNvb2tpZXNFbmFibGVkIiwiY29va2llQXRsYXNSZXNvbHV0aW9uIiwiYXJlYUxpZ2h0c0VuYWJsZWQiLCJjZWxscyIsIm1heExpZ2h0c1BlckNlbGwiLCJ3b3JsZENsdXN0ZXJzIiwiV29ybGRDbHVzdGVycyIsImZpbmlzaEJha2UiLCJiYWtlTm9kZXMiLCJkZXN0cm95UlQiLCJydCIsImNvbG9yQnVmZmVyIiwiZm9yRWFjaCIsImNsZWFyIiwibGVuZ3RoIiwiY3JlYXRlTWF0ZXJpYWxGb3JQYXNzIiwicGFzcyIsImFkZEFtYmllbnQiLCJtYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJjaHVua3MiLCJBUElWZXJzaW9uIiwiQ0hVTktBUElfMV81NSIsInRyYW5zZm9ybVZTIiwic2hhZGVyQ2h1bmtzIiwiYmFrZUxtRW5kQ2h1bmsiLCJzaGFkZXJDaHVua3NMaWdodG1hcHBlciIsImJha2VMbUVuZFBTIiwiYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCIsInRvRml4ZWQiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MiLCJhbWJpZW50IiwiYW1iaWVudFRpbnQiLCJlbmRQUyIsImxpZ2h0TWFwIiwiYmFzZVBTIiwiYmFrZURpckxtRW5kUFMiLCJvdXRwdXRBbHBoYVBTIiwib3V0cHV0QWxwaGFPcGFxdWVQUyIsIm91dHB1dEFscGhhUHJlbXVsUFMiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsImZvcmNlVXYxIiwidXBkYXRlIiwiY3JlYXRlTWF0ZXJpYWxzIiwicGFzc0NvdW50Iiwib25VcGRhdGVTaGFkZXIiLCJvcHRpb25zIiwibGlnaHRNYXBXaXRob3V0QW1iaWVudCIsInNlcGFyYXRlQW1iaWVudCIsImNyZWF0ZVRleHR1cmUiLCJzaXplIiwicHJvZmlsZXJIaW50IiwiVEVYSElOVF9MSUdIVE1BUCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJjb2xsZWN0TW9kZWxzIiwiYWxsTm9kZXMiLCJlbmFibGVkIiwibWVzaEluc3RhbmNlcyIsIm1vZGVsIiwicHVzaCIsIkJha2VNZXNoTm9kZSIsImxpZ2h0bWFwcGVkIiwicmVuZGVyIiwiaGFzVXYxIiwiaSIsIm1lc2giLCJ2ZXJ0ZXhCdWZmZXIiLCJEZWJ1ZyIsImxvZyIsIm5vdEluc3RhbmNlZE1lc2hJbnN0YW5jZXMiLCJoYXMiLCJhZGQiLCJfY2hpbGRyZW4iLCJwcmVwYXJlU2hhZG93Q2FzdGVycyIsIm5vZGVzIiwiY2FzdGVycyIsIm4iLCJjb21wb25lbnQiLCJjYXN0U2hhZG93cyIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJtZXNoZXMiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwidXBkYXRlVHJhbnNmb3JtcyIsImoiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImNhbGN1bGF0ZUxpZ2h0bWFwU2l6ZSIsImRhdGEiLCJzaXplTXVsdCIsImxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJzY2FsZSIsInNyY0FyZWEiLCJhc3NldCIsImdldCIsImFyZWEiLCJfYXJlYSIsIngiLCJ5IiwieiIsInV2IiwiYXJlYU11bHQiLCJib3VuZHMiLCJjb21wdXRlTm9kZUJvdW5kcyIsImNvcHkiLCJoYWxmRXh0ZW50cyIsInRvdGFsQXJlYSIsIk1hdGgiLCJzcXJ0IiwibGlnaHRtYXBTaXplIiwibWluIiwibWF0aCIsIm5leHRQb3dlck9mVHdvIiwibGlnaHRtYXBNYXhSZXNvbHV0aW9uIiwic2V0TGlnaHRtYXBwaW5nIiwidmFsdWUiLCJzaGFkZXJEZWZzIiwibWVzaEluc3RhbmNlIiwic2V0TGlnaHRtYXBwZWQiLCJfc2hhZGVyRGVmcyIsIm1hc2siLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsInRleCIsIkZJTFRFUl9MSU5FQVIiLCJzZXRSZWFsdGltZUxpZ2h0bWFwIiwiTWVzaEluc3RhbmNlIiwibGlnaHRtYXBQYXJhbU5hbWVzIiwiYmFrZSIsIm1vZGUiLCJCQUtFX0NPTE9SRElSIiwic3RhcnRUaW1lIiwibm93IiwiX3VwZGF0ZVNreSIsImZpcmUiLCJ0aW1lc3RhbXAiLCJ0YXJnZXQiLCJzdGFydFNoYWRlcnMiLCJfc2hhZGVyU3RhdHMiLCJsaW5rZWQiLCJzdGFydEZib1RpbWUiLCJfcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwic3RhcnRDb21waWxlVGltZSIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiYmFrZUludGVybmFsIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiYW1iaWVudEJha2UiLCJTSEFERVJERUZfTE1BTUJJRU5UIiwicG9wR3B1TWFya2VyIiwibm93VGltZSIsImFsbG9jYXRlVGV4dHVyZXMiLCJiYWtlTm9kZSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJSZW5kZXJUYXJnZXQiLCJkZXB0aCIsInByZXBhcmVMaWdodHNUb0Jha2UiLCJsYXllckNvbXBvc2l0aW9uIiwiYWxsTGlnaHRzIiwiYmFrZUxpZ2h0cyIsIkJha2VMaWdodEFtYmllbnQiLCJzY2VuZUxpZ2h0cyIsIl9saWdodHMiLCJsaWdodCIsImJha2VMaWdodCIsIkJha2VMaWdodFNpbXBsZSIsIk1BU0tfQkFLRSIsImlzU3RhdGljIiwic2hhZG93VXBkYXRlTW9kZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIlNIQURPV1VQREFURV9SRUFMVElNRSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJzb3J0IiwicmVzdG9yZUxpZ2h0cyIsInJlc3RvcmUiLCJzZXR1cFNjZW5lIiwicmV2ZXJ0U3RhdGljIiwiX25lZWRzU3RhdGljUHJlcGFyZSIsIkZPR19OT05FIiwic2V0U2NlbmVDb25zdGFudHMiLCJyZXN0b3JlU2NlbmUiLCJCb3VuZGluZ0JveCIsImFhYmIiLCJtIiwiY29tcHV0ZU5vZGVzQm91bmRzIiwiY29tcHV0ZUJvdW5kcyIsImJhY2t1cE1hdGVyaWFscyIsInJlc3RvcmVNYXRlcmlhbHMiLCJsaWdodENhbWVyYVByZXBhcmUiLCJzaGFkb3dDYW0iLCJMSUdIVFRZUEVfU1BPVCIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzaGFkb3dDYW1lcmEiLCJfbm9kZSIsInNldFBvc2l0aW9uIiwiZ2V0UG9zaXRpb24iLCJzZXRSb3RhdGlvbiIsImdldFJvdGF0aW9uIiwicm90YXRlTG9jYWwiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwibmVhckNsaXAiLCJhdHRlbnVhdGlvbkVuZCIsImZhckNsaXAiLCJmb3YiLCJfb3V0ZXJDb25lQW5nbGUiLCJ1cGRhdGVDYW1lcmFGcnVzdHVtIiwibGlnaHRDYW1lcmFQcmVwYXJlQW5kQ3VsbCIsImNhc3RlckJvdW5kcyIsImxpZ2h0QWZmZWN0c05vZGUiLCJjZW50ZXIiLCJzZXRFdWxlckFuZ2xlcyIsImZydXN0dW1TaXplIiwibWF4Iiwib3J0aG9IZWlnaHQiLCJsaWdodEJvdW5kcyIsImludGVyc2VjdHMiLCJub2RlVmlzaWJsZSIsIl9pc1Zpc2libGUiLCJzZXR1cExpZ2h0QXJyYXkiLCJsaWdodEFycmF5IiwiTElHSFRUWVBFX09NTkkiLCJyZW5kZXJTaGFkb3dNYXAiLCJzaGFkb3dNYXBSZW5kZXJlZCIsInNoYWRvd01hcCIsImN1bGxEaXJlY3Rpb25hbCIsImN1bGxMb2NhbCIsInJlbmRlclNoYWRvd3MiLCJwb3N0cHJvY2Vzc1RleHR1cmVzIiwibnVtRGlsYXRlczJ4IiwiZGlsYXRlU2hhZGVyIiwic2hhZGVyRGlsYXRlIiwiZmlsdGVyTGlnaHRtYXAiLCJsaWdodG1hcEZpbHRlckVuYWJsZWQiLCJwcmVwYXJlRGVub2lzZSIsImxpZ2h0bWFwRmlsdGVyUmFuZ2UiLCJsaWdodG1hcEZpbHRlclNtb290aG5lc3MiLCJub2RlUlQiLCJsaWdodG1hcCIsInRlbXBSVCIsInRlbXBUZXgiLCJwcmVwYXJlIiwic2V0U291cmNlVGV4dHVyZSIsImJpbGF0ZXJhbEZpbHRlckVuYWJsZWQiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJzaGFkZXJEZW5vaXNlIiwibGF5ZXJzIiwiX3VwZGF0ZSIsInVwZGF0ZUNwdVNraW5NYXRyaWNlcyIsImdwdVVwZGF0ZSIsInJjdiIsInNoYWRlcnNVcGRhdGVkT24xc3RQYXNzIiwiaXNBbWJpZW50TGlnaHQiLCJudW1WaXJ0dWFsTGlnaHRzIiwiYmFrZURpciIsIndhcm4iLCJ2aXJ0dWFsTGlnaHRJbmRleCIsInByZXBhcmVWaXJ0dWFsTGlnaHQiLCJzdGFydEJha2UiLCJsaWdodFRleHR1cmVBdGxhcyIsImNsdXN0ZXJMaWdodHMiLCJjb25jYXQiLCJnYW1tYUNvcnJlY3Rpb24iLCJ1cGRhdGVTaGFkZXJzIiwicGFzc01hdGVyaWFsIiwibGFzdFZpcnR1YWxMaWdodEZvclBhc3MiLCJzZXRDYW1lcmEiLCJzZXRWYWx1ZSIsImFjdGl2YXRlIiwiX2ZvcndhcmRUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJyZW5kZXJGb3J3YXJkIiwiU0hBREVSX0ZPUldBUkRIRFIiLCJ1cGRhdGVFbmQiLCJlbmRCYWtlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBd0RBLE1BQU1BLGlCQUFpQixHQUFHLElBQTFCLENBQUE7QUFFQSxNQUFNQyxVQUFVLEdBQUcsQ0FBbkIsQ0FBQTtBQUNBLE1BQU1DLFFBQVEsR0FBRyxDQUFqQixDQUFBO0FBRUEsTUFBTUMsT0FBTyxHQUFHLElBQUlDLElBQUosRUFBaEIsQ0FBQTs7QUFLQSxNQUFNQyxXQUFOLENBQWtCO0VBV2RDLFdBQVcsQ0FBQ0MsTUFBRCxFQUFTQyxJQUFULEVBQWVDLEtBQWYsRUFBc0JDLFFBQXRCLEVBQWdDQyxNQUFoQyxFQUF3QztJQUMvQyxJQUFLSixDQUFBQSxNQUFMLEdBQWNBLE1BQWQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLElBQUwsR0FBWUEsSUFBWixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsS0FBTCxHQUFhQSxLQUFiLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxRQUFMLEdBQWdCQSxRQUFoQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjQSxNQUFkLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0MsY0FBTCxHQUFzQkYsUUFBUSxDQUFDRyxlQUFULENBQXlCRCxjQUEvQyxDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUtFLFFBQUwsR0FBZ0IsSUFBSUMsR0FBSixFQUFoQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsV0FBTCxHQUFtQixLQUFuQixDQUFBO0lBR0EsSUFBS0MsQ0FBQUEsYUFBTCxHQUFxQixFQUFyQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsaUJBQUwsR0FBeUIsSUFBekIsQ0FBQTtJQUVBLElBQUtDLENBQUFBLEdBQUwsR0FBVyxFQUFYLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0MsWUFBTCxHQUFvQixJQUFJQyxLQUFKLEVBQXBCLENBQUE7QUFHQSxJQUFBLElBQUEsQ0FBS0MsYUFBTCxHQUFxQixJQUFJQyxHQUFKLEVBQXJCLENBQUE7QUFFQSxJQUFBLElBQUEsQ0FBS0MsS0FBTCxHQUFhO0FBQ1RDLE1BQUFBLFlBQVksRUFBRSxDQURMO0FBRVRDLE1BQUFBLGFBQWEsRUFBRSxDQUZOO0FBR1RDLE1BQUFBLGVBQWUsRUFBRSxDQUhSO0FBSVRDLE1BQUFBLFdBQVcsRUFBRSxDQUpKO0FBS1RDLE1BQUFBLE9BQU8sRUFBRSxDQUxBO0FBTVRDLE1BQUFBLGFBQWEsRUFBRSxDQU5OO0FBT1RDLE1BQUFBLFdBQVcsRUFBRSxDQVBKO0FBUVRDLE1BQUFBLGFBQWEsRUFBRSxDQUFBO0tBUm5CLENBQUE7QUFVSCxHQUFBOztBQUVEQyxFQUFBQSxPQUFPLEdBQUc7QUFHTkMsSUFBQUEsYUFBYSxDQUFDQyxNQUFkLENBQXFCLElBQUEsQ0FBS0MsUUFBMUIsQ0FBQSxDQUFBO0lBQ0EsSUFBS0EsQ0FBQUEsUUFBTCxHQUFnQixJQUFoQixDQUFBO0FBR0FGLElBQUFBLGFBQWEsQ0FBQ0QsT0FBZCxFQUFBLENBQUE7SUFFQSxJQUFLMUIsQ0FBQUEsTUFBTCxHQUFjLElBQWQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLElBQUwsR0FBWSxJQUFaLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxLQUFMLEdBQWEsSUFBYixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsUUFBTCxHQUFnQixJQUFoQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjLElBQWQsQ0FBQTtBQUNILEdBQUE7O0VBRUQwQixRQUFRLENBQUM5QixNQUFELEVBQVM7SUFHYixJQUFJLENBQUMsSUFBS1MsQ0FBQUEsV0FBVixFQUF1QjtNQUNuQixJQUFLQSxDQUFBQSxXQUFMLEdBQW1CLElBQW5CLENBQUE7QUFHQSxNQUFBLElBQUEsQ0FBS3NCLGVBQUwsR0FBdUIsSUFBSUMsZUFBSixDQUFvQmhDLE1BQXBCLENBQXZCLENBQUE7TUFHQSxJQUFLaUMsQ0FBQUEsZUFBTCxHQUF1QmpDLE1BQU0sQ0FBQ2tDLEtBQVAsQ0FBYUMsT0FBYixDQUFxQixTQUFyQixDQUF2QixDQUFBO01BQ0EsSUFBS0MsQ0FBQUEsU0FBTCxHQUFpQixFQUFqQixDQUFBO0FBR0EsTUFBQSxJQUFBLENBQUtQLFFBQUwsR0FBZ0IsSUFBSVEsT0FBSixDQUFZLElBQUEsQ0FBS3JDLE1BQWpCLEVBQXlCO0FBQ3JDc0MsUUFBQUEsS0FBSyxFQUFFLENBRDhCO0FBRXJDQyxRQUFBQSxNQUFNLEVBQUUsQ0FGNkI7QUFHckNDLFFBQUFBLE1BQU0sRUFBRUMsdUJBSDZCO0FBSXJDQyxRQUFBQSxJQUFJLEVBQUVDLGdCQUorQjtBQUtyQ0MsUUFBQUEsSUFBSSxFQUFFLGVBQUE7QUFMK0IsT0FBekIsQ0FBaEIsQ0FBQTtBQVNBakIsTUFBQUEsYUFBYSxDQUFDa0IsTUFBZCxDQUFxQixJQUFBLENBQUtoQixRQUExQixDQUFBLENBQUE7QUFHQSxNQUFBLE1BQU1pQixNQUFNLEdBQUcsSUFBSUMsTUFBSixFQUFmLENBQUE7TUFDQUQsTUFBTSxDQUFDRSxVQUFQLENBQWtCQyxHQUFsQixDQUFzQixDQUF0QixFQUF5QixDQUF6QixFQUE0QixDQUE1QixFQUErQixDQUEvQixDQUFBLENBQUE7TUFDQUgsTUFBTSxDQUFDSSxnQkFBUCxHQUEwQixJQUExQixDQUFBO01BQ0FKLE1BQU0sQ0FBQ0ssZ0JBQVAsR0FBMEIsS0FBMUIsQ0FBQTtNQUNBTCxNQUFNLENBQUNNLGtCQUFQLEdBQTRCLEtBQTVCLENBQUE7TUFDQU4sTUFBTSxDQUFDTyxjQUFQLEdBQXdCLEtBQXhCLENBQUE7TUFDQVAsTUFBTSxDQUFDUSxVQUFQLEdBQW9CQyx1QkFBcEIsQ0FBQTtNQUNBVCxNQUFNLENBQUNVLFdBQVAsR0FBcUIsQ0FBckIsQ0FBQTtBQUNBVixNQUFBQSxNQUFNLENBQUNXLElBQVAsR0FBYyxJQUFJQyxTQUFKLEVBQWQsQ0FBQTtNQUNBLElBQUtaLENBQUFBLE1BQUwsR0FBY0EsTUFBZCxDQUFBO0FBQ0gsS0FBQTs7QUFHRCxJQUFBLElBQUksSUFBSzVDLENBQUFBLEtBQUwsQ0FBV3lELHdCQUFmLEVBQXlDO0FBR3JDLE1BQUEsTUFBTUMsY0FBYyxHQUFHLElBQUlDLGNBQUosQ0FBbUI3RCxNQUFNLENBQUM4RCxrQkFBMUIsRUFBOEM5RCxNQUFNLENBQUMrRCxjQUFyRCxFQUFxRSxNQUFNLEVBQTNFLENBQXZCLENBQUE7TUFDQSxJQUFLSCxDQUFBQSxjQUFMLEdBQXNCQSxjQUF0QixDQUFBO0FBRUEsTUFBQSxNQUFNSSxTQUFTLEdBQUcsSUFBSzlELENBQUFBLEtBQUwsQ0FBVytELFFBQTdCLENBQUE7QUFDQUwsTUFBQUEsY0FBYyxDQUFDTSxjQUFmLEdBQWdDRixTQUFTLENBQUNFLGNBQTFDLENBQUE7QUFDQU4sTUFBQUEsY0FBYyxDQUFDTyxxQkFBZixHQUF1Q0gsU0FBUyxDQUFDRyxxQkFBakQsQ0FBQTtBQUVBUCxNQUFBQSxjQUFjLENBQUNRLGNBQWYsR0FBZ0NKLFNBQVMsQ0FBQ0ksY0FBMUMsQ0FBQTtBQUNBUixNQUFBQSxjQUFjLENBQUNTLHFCQUFmLEdBQXVDTCxTQUFTLENBQUNLLHFCQUFqRCxDQUFBO0FBRUFULE1BQUFBLGNBQWMsQ0FBQ1UsaUJBQWYsR0FBbUNOLFNBQVMsQ0FBQ00saUJBQTdDLENBQUE7TUFHQVYsY0FBYyxDQUFDVyxLQUFmLEdBQXVCLElBQUkxRSxJQUFKLENBQVMsQ0FBVCxFQUFZLENBQVosRUFBZSxDQUFmLENBQXZCLENBQUE7TUFDQStELGNBQWMsQ0FBQ1ksZ0JBQWYsR0FBa0MsQ0FBbEMsQ0FBQTtBQUVBLE1BQUEsSUFBQSxDQUFLQyxhQUFMLEdBQXFCLElBQUlDLGFBQUosQ0FBa0IxRSxNQUFsQixDQUFyQixDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUt5RSxhQUFMLENBQW1CN0IsSUFBbkIsR0FBMEIsb0JBQTFCLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7RUFFRCtCLFVBQVUsQ0FBQ0MsU0FBRCxFQUFZO0lBRWxCLElBQUt4QyxDQUFBQSxTQUFMLEdBQWlCLEVBQWpCLENBQUE7O0lBRUEsU0FBU3lDLFNBQVQsQ0FBbUJDLEVBQW5CLEVBQXVCO0FBRW5CbkQsTUFBQUEsYUFBYSxDQUFDQyxNQUFkLENBQXFCa0QsRUFBRSxDQUFDQyxXQUF4QixDQUFBLENBQUE7QUFHQUQsTUFBQUEsRUFBRSxDQUFDcEQsT0FBSCxFQUFBLENBQUE7QUFDSCxLQUFBOztBQUdELElBQUEsSUFBQSxDQUFLWCxhQUFMLENBQW1CaUUsT0FBbkIsQ0FBNEJGLEVBQUQsSUFBUTtNQUMvQkQsU0FBUyxDQUFDQyxFQUFELENBQVQsQ0FBQTtLQURKLENBQUEsQ0FBQTtJQUdBLElBQUsvRCxDQUFBQSxhQUFMLENBQW1Ca0UsS0FBbkIsRUFBQSxDQUFBO0FBR0FMLElBQUFBLFNBQVMsQ0FBQ0ksT0FBVixDQUFtQnZCLElBQUQsSUFBVTtBQUN4QkEsTUFBQUEsSUFBSSxDQUFDMUMsYUFBTCxDQUFtQmlFLE9BQW5CLENBQTRCRixFQUFELElBQVE7UUFDL0JELFNBQVMsQ0FBQ0MsRUFBRCxDQUFULENBQUE7T0FESixDQUFBLENBQUE7QUFHQXJCLE1BQUFBLElBQUksQ0FBQzFDLGFBQUwsQ0FBbUJtRSxNQUFuQixHQUE0QixDQUE1QixDQUFBO0tBSkosQ0FBQSxDQUFBO0lBUUEsSUFBS3ZFLENBQUFBLGlCQUFMLEdBQXlCLElBQXpCLENBQUE7O0lBR0EsSUFBSSxJQUFBLENBQUs4RCxhQUFULEVBQXdCO01BQ3BCLElBQUtBLENBQUFBLGFBQUwsQ0FBbUIvQyxPQUFuQixFQUFBLENBQUE7TUFDQSxJQUFLK0MsQ0FBQUEsYUFBTCxHQUFxQixJQUFyQixDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0VBRURVLHFCQUFxQixDQUFDbkYsTUFBRCxFQUFTRSxLQUFULEVBQWdCa0YsSUFBaEIsRUFBc0JDLFVBQXRCLEVBQWtDO0FBQ25ELElBQUEsTUFBTUMsUUFBUSxHQUFHLElBQUlDLGdCQUFKLEVBQWpCLENBQUE7QUFDQUQsSUFBQUEsUUFBUSxDQUFDMUMsSUFBVCxHQUFpQixtQkFBa0J3QyxJQUFLLENBQUEsU0FBQSxFQUFXQyxVQUFXLENBQTlELENBQUEsQ0FBQTtBQUNBQyxJQUFBQSxRQUFRLENBQUNFLE1BQVQsQ0FBZ0JDLFVBQWhCLEdBQTZCQyxhQUE3QixDQUFBO0lBQ0FKLFFBQVEsQ0FBQ0UsTUFBVCxDQUFnQkcsV0FBaEIsR0FBOEIscUJBQXdCQyxHQUFBQSxZQUFZLENBQUNELFdBQW5FLENBQUE7O0lBRUEsSUFBSVAsSUFBSSxLQUFLMUYsVUFBYixFQUF5QjtBQUNyQixNQUFBLElBQUltRyxjQUFjLEdBQUdDLHVCQUF1QixDQUFDQyxXQUE3QyxDQUFBOztBQUNBLE1BQUEsSUFBSVYsVUFBSixFQUFnQjtBQUdaUSxRQUFBQSxjQUFjLEdBQUksQ0FBQTtBQUNsQyxpRUFBQSxFQUFtRTNGLEtBQUssQ0FBQzhGLDRCQUFOLENBQW1DQyxPQUFuQyxDQUEyQyxDQUEzQyxDQUE4QyxDQUFBO0FBQ2pILDBDQUFBLEVBQTRDL0YsS0FBSyxDQUFDZ0csOEJBQU4sQ0FBcUNELE9BQXJDLENBQTZDLENBQTdDLENBQWdELENBQUE7QUFDNUY7QUFDQTtBQUNBLGdCQUFBLENBTGlDLEdBS2JKLGNBTEosQ0FBQTtBQU1ILE9BVEQsTUFTTztRQUNIUCxRQUFRLENBQUNhLE9BQVQsR0FBbUIsSUFBSXJGLEtBQUosQ0FBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixDQUFuQixDQUFBO1FBQ0F3RSxRQUFRLENBQUNjLFdBQVQsR0FBdUIsSUFBdkIsQ0FBQTtBQUNILE9BQUE7O0FBQ0RkLE1BQUFBLFFBQVEsQ0FBQ0UsTUFBVCxDQUFnQmEsS0FBaEIsR0FBd0JSLGNBQXhCLENBQUE7QUFDQVAsTUFBQUEsUUFBUSxDQUFDZ0IsUUFBVCxHQUFvQixJQUFBLENBQUt6RSxRQUF6QixDQUFBO0FBQ0gsS0FqQkQsTUFpQk87TUFDSHlELFFBQVEsQ0FBQ0UsTUFBVCxDQUFnQmUsTUFBaEIsR0FBeUJYLFlBQVksQ0FBQ1csTUFBYixHQUFzQixvRUFBL0MsQ0FBQTtBQUNBakIsTUFBQUEsUUFBUSxDQUFDRSxNQUFULENBQWdCYSxLQUFoQixHQUF3QlAsdUJBQXVCLENBQUNVLGNBQWhELENBQUE7QUFDSCxLQUFBOztBQUdEbEIsSUFBQUEsUUFBUSxDQUFDRSxNQUFULENBQWdCaUIsYUFBaEIsR0FBZ0MsSUFBaEMsQ0FBQTtBQUNBbkIsSUFBQUEsUUFBUSxDQUFDRSxNQUFULENBQWdCa0IsbUJBQWhCLEdBQXNDLElBQXRDLENBQUE7QUFDQXBCLElBQUFBLFFBQVEsQ0FBQ0UsTUFBVCxDQUFnQm1CLG1CQUFoQixHQUFzQyxJQUF0QyxDQUFBO0lBQ0FyQixRQUFRLENBQUNzQixJQUFULEdBQWdCQyxhQUFoQixDQUFBO0lBQ0F2QixRQUFRLENBQUN3QixRQUFULEdBQW9CLElBQXBCLENBQUE7QUFDQXhCLElBQUFBLFFBQVEsQ0FBQ3lCLE1BQVQsRUFBQSxDQUFBO0FBRUEsSUFBQSxPQUFPekIsUUFBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFRDBCLEVBQUFBLGVBQWUsQ0FBQ2hILE1BQUQsRUFBU0UsS0FBVCxFQUFnQitHLFNBQWhCLEVBQTJCO0lBQ3RDLEtBQUssSUFBSTdCLElBQUksR0FBRyxDQUFoQixFQUFtQkEsSUFBSSxHQUFHNkIsU0FBMUIsRUFBcUM3QixJQUFJLEVBQXpDLEVBQTZDO0FBQ3pDLE1BQUEsSUFBSSxDQUFDLElBQUsxRSxDQUFBQSxhQUFMLENBQW1CMEUsSUFBbkIsQ0FBTCxFQUErQjtBQUMzQixRQUFBLElBQUEsQ0FBSzFFLGFBQUwsQ0FBbUIwRSxJQUFuQixDQUFBLEdBQTJCLEtBQUtELHFCQUFMLENBQTJCbkYsTUFBM0IsRUFBbUNFLEtBQW5DLEVBQTBDa0YsSUFBMUMsRUFBZ0QsS0FBaEQsQ0FBM0IsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztJQUdELElBQUksQ0FBQyxJQUFLekUsQ0FBQUEsaUJBQVYsRUFBNkI7QUFDekIsTUFBQSxJQUFBLENBQUtBLGlCQUFMLEdBQXlCLElBQUt3RSxDQUFBQSxxQkFBTCxDQUEyQm5GLE1BQTNCLEVBQW1DRSxLQUFuQyxFQUEwQyxDQUExQyxFQUE2QyxJQUE3QyxDQUF6QixDQUFBOztBQUNBLE1BQUEsSUFBQSxDQUFLUyxpQkFBTCxDQUF1QnVHLGNBQXZCLEdBQXdDLFVBQVVDLE9BQVYsRUFBbUI7UUFFdkRBLE9BQU8sQ0FBQ0Msc0JBQVIsR0FBaUMsSUFBakMsQ0FBQTtRQUVBRCxPQUFPLENBQUNFLGVBQVIsR0FBMEIsSUFBMUIsQ0FBQTtBQUNBLFFBQUEsT0FBT0YsT0FBUCxDQUFBO09BTEosQ0FBQTtBQU9ILEtBQUE7QUFDSixHQUFBOztBQUVERyxFQUFBQSxhQUFhLENBQUNDLElBQUQsRUFBTzdFLElBQVAsRUFBYUUsSUFBYixFQUFtQjtBQUU1QixJQUFBLE9BQU8sSUFBSVAsT0FBSixDQUFZLElBQUEsQ0FBS3JDLE1BQWpCLEVBQXlCO0FBRTVCd0gsTUFBQUEsWUFBWSxFQUFFQyxnQkFGYztBQUk1Qm5GLE1BQUFBLEtBQUssRUFBRWlGLElBSnFCO0FBSzVCaEYsTUFBQUEsTUFBTSxFQUFFZ0YsSUFMb0I7QUFNNUIvRSxNQUFBQSxNQUFNLEVBQUVDLHVCQU5vQjtBQU81QmlGLE1BQUFBLE9BQU8sRUFBRSxLQVBtQjtBQVE1QmhGLE1BQUFBLElBQUksRUFBRUEsSUFSc0I7QUFTNUJpRixNQUFBQSxTQUFTLEVBQUVDLGNBVGlCO0FBVTVCQyxNQUFBQSxTQUFTLEVBQUVELGNBVmlCO0FBVzVCRSxNQUFBQSxRQUFRLEVBQUVDLHFCQVhrQjtBQVk1QkMsTUFBQUEsUUFBUSxFQUFFRCxxQkFaa0I7QUFhNUJuRixNQUFBQSxJQUFJLEVBQUVBLElBQUFBO0FBYnNCLEtBQXpCLENBQVAsQ0FBQTtBQWVILEdBQUE7O0FBS0RxRixFQUFBQSxhQUFhLENBQUN4RSxJQUFELEVBQU9tQixTQUFQLEVBQWtCc0QsUUFBbEIsRUFBNEI7QUFBQSxJQUFBLElBQUEsV0FBQSxFQUFBLFlBQUEsRUFBQSxZQUFBLENBQUE7O0FBQ3JDLElBQUEsSUFBSSxDQUFDekUsSUFBSSxDQUFDMEUsT0FBVixFQUFtQixPQUFBO0FBR25CLElBQUEsSUFBSUMsYUFBSixDQUFBOztBQUNBLElBQUEsSUFBSSxDQUFBM0UsV0FBQUEsR0FBQUEsSUFBSSxDQUFDNEUsS0FBTCxLQUFZQSxJQUFBQSxJQUFBQSxXQUFBQSxDQUFBQSxLQUFaLElBQXFCNUUsQ0FBQUEsWUFBQUEsR0FBQUEsSUFBSSxDQUFDNEUsS0FBMUIsS0FBcUIsSUFBQSxJQUFBLFlBQUEsQ0FBWUYsT0FBckMsRUFBOEM7TUFDMUMsSUFBSUQsUUFBSixFQUFjQSxRQUFRLENBQUNJLElBQVQsQ0FBYyxJQUFJQyxZQUFKLENBQWlCOUUsSUFBakIsQ0FBZCxDQUFBLENBQUE7O0FBQ2QsTUFBQSxJQUFJQSxJQUFJLENBQUM0RSxLQUFMLENBQVdHLFdBQWYsRUFBNEI7QUFDeEIsUUFBQSxJQUFJNUQsU0FBSixFQUFlO0FBQ1h3RCxVQUFBQSxhQUFhLEdBQUczRSxJQUFJLENBQUM0RSxLQUFMLENBQVdBLEtBQVgsQ0FBaUJELGFBQWpDLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBR0QsSUFBQSxJQUFBLENBQUEsWUFBQSxHQUFJM0UsSUFBSSxDQUFDZ0YsTUFBVCxLQUFJLElBQUEsSUFBQSxZQUFBLENBQWFOLE9BQWpCLEVBQTBCO01BQ3RCLElBQUlELFFBQUosRUFBY0EsUUFBUSxDQUFDSSxJQUFULENBQWMsSUFBSUMsWUFBSixDQUFpQjlFLElBQWpCLENBQWQsQ0FBQSxDQUFBOztBQUNkLE1BQUEsSUFBSUEsSUFBSSxDQUFDZ0YsTUFBTCxDQUFZRCxXQUFoQixFQUE2QjtBQUN6QixRQUFBLElBQUk1RCxTQUFKLEVBQWU7QUFDWHdELFVBQUFBLGFBQWEsR0FBRzNFLElBQUksQ0FBQ2dGLE1BQUwsQ0FBWUwsYUFBNUIsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7QUFFRCxJQUFBLElBQUlBLGFBQUosRUFBbUI7TUFDZixJQUFJTSxNQUFNLEdBQUcsSUFBYixDQUFBOztBQUVBLE1BQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHUCxhQUFhLENBQUNsRCxNQUFsQyxFQUEwQ3lELENBQUMsRUFBM0MsRUFBK0M7QUFDM0MsUUFBQSxJQUFJLENBQUNQLGFBQWEsQ0FBQ08sQ0FBRCxDQUFiLENBQWlCQyxJQUFqQixDQUFzQkMsWUFBdEIsQ0FBbUNyRyxNQUFuQyxDQUEwQ2tHLE1BQS9DLEVBQXVEO0FBQ25ESSxVQUFBQSxLQUFLLENBQUNDLEdBQU4sQ0FBVyx1QkFBc0J0RixJQUFJLENBQUNiLElBQUssQ0FBM0MsaUVBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQThGLFVBQUFBLE1BQU0sR0FBRyxLQUFULENBQUE7QUFDQSxVQUFBLE1BQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTs7QUFFRCxNQUFBLElBQUlBLE1BQUosRUFBWTtRQUNSLE1BQU1NLHlCQUF5QixHQUFHLEVBQWxDLENBQUE7O0FBQ0EsUUFBQSxLQUFLLElBQUlMLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdQLGFBQWEsQ0FBQ2xELE1BQWxDLEVBQTBDeUQsQ0FBQyxFQUEzQyxFQUErQztBQUMzQyxVQUFBLE1BQU1DLElBQUksR0FBR1IsYUFBYSxDQUFDTyxDQUFELENBQWIsQ0FBaUJDLElBQTlCLENBQUE7O0FBR0EsVUFBQSxJQUFJLEtBQUtySSxRQUFMLENBQWMwSSxHQUFkLENBQWtCTCxJQUFsQixDQUFKLEVBQTZCO0FBRXpCaEUsWUFBQUEsU0FBUyxDQUFDMEQsSUFBVixDQUFlLElBQUlDLFlBQUosQ0FBaUI5RSxJQUFqQixFQUF1QixDQUFDMkUsYUFBYSxDQUFDTyxDQUFELENBQWQsQ0FBdkIsQ0FBZixDQUFBLENBQUE7QUFDSCxXQUhELE1BR087QUFDSEssWUFBQUEseUJBQXlCLENBQUNWLElBQTFCLENBQStCRixhQUFhLENBQUNPLENBQUQsQ0FBNUMsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7QUFDRCxVQUFBLElBQUEsQ0FBS3BJLFFBQUwsQ0FBYzJJLEdBQWQsQ0FBa0JOLElBQWxCLENBQUEsQ0FBQTtBQUNILFNBQUE7O1FBRUQsSUFBS3JJLENBQUFBLFFBQUwsQ0FBYzBFLEtBQWQsRUFBQSxDQUFBOztBQUdBLFFBQUEsSUFBSStELHlCQUF5QixDQUFDOUQsTUFBMUIsR0FBbUMsQ0FBdkMsRUFBMEM7VUFDdENOLFNBQVMsQ0FBQzBELElBQVYsQ0FBZSxJQUFJQyxZQUFKLENBQWlCOUUsSUFBakIsRUFBdUJ1Rix5QkFBdkIsQ0FBZixDQUFBLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxLQUFLLElBQUlMLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdsRixJQUFJLENBQUMwRixTQUFMLENBQWVqRSxNQUFuQyxFQUEyQ3lELENBQUMsRUFBNUMsRUFBZ0Q7TUFDNUMsSUFBS1YsQ0FBQUEsYUFBTCxDQUFtQnhFLElBQUksQ0FBQzBGLFNBQUwsQ0FBZVIsQ0FBZixDQUFuQixFQUFzQy9ELFNBQXRDLEVBQWlEc0QsUUFBakQsQ0FBQSxDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0VBR0RrQixvQkFBb0IsQ0FBQ0MsS0FBRCxFQUFRO0lBRXhCLE1BQU1DLE9BQU8sR0FBRyxFQUFoQixDQUFBOztBQUNBLElBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRixLQUFLLENBQUNuRSxNQUExQixFQUFrQ3FFLENBQUMsRUFBbkMsRUFBdUM7QUFDbkMsTUFBQSxNQUFNQyxTQUFTLEdBQUdILEtBQUssQ0FBQ0UsQ0FBRCxDQUFMLENBQVNDLFNBQTNCLENBQUE7QUFFQUEsTUFBQUEsU0FBUyxDQUFDQyxXQUFWLEdBQXdCRCxTQUFTLENBQUNFLG1CQUFsQyxDQUFBOztNQUNBLElBQUlGLFNBQVMsQ0FBQ0UsbUJBQWQsRUFBbUM7QUFFL0IsUUFBQSxNQUFNQyxNQUFNLEdBQUdOLEtBQUssQ0FBQ0UsQ0FBRCxDQUFMLENBQVNuQixhQUF4QixDQUFBOztBQUNBLFFBQUEsS0FBSyxJQUFJTyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHZ0IsTUFBTSxDQUFDekUsTUFBM0IsRUFBbUN5RCxDQUFDLEVBQXBDLEVBQXdDO0FBQ3BDZ0IsVUFBQUEsTUFBTSxDQUFDaEIsQ0FBRCxDQUFOLENBQVVpQixnQkFBVixHQUE2QixJQUE3QixDQUFBO0FBQ0FOLFVBQUFBLE9BQU8sQ0FBQ2hCLElBQVIsQ0FBYXFCLE1BQU0sQ0FBQ2hCLENBQUQsQ0FBbkIsQ0FBQSxDQUFBO0FBQ0gsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsT0FBT1csT0FBUCxDQUFBO0FBQ0gsR0FBQTs7RUFHRE8sZ0JBQWdCLENBQUNSLEtBQUQsRUFBUTtBQUVwQixJQUFBLEtBQUssSUFBSVYsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1UsS0FBSyxDQUFDbkUsTUFBMUIsRUFBa0N5RCxDQUFDLEVBQW5DLEVBQXVDO0FBQ25DLE1BQUEsTUFBTVAsYUFBYSxHQUFHaUIsS0FBSyxDQUFDVixDQUFELENBQUwsQ0FBU1AsYUFBL0IsQ0FBQTs7QUFDQSxNQUFBLEtBQUssSUFBSTBCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcxQixhQUFhLENBQUNsRCxNQUFsQyxFQUEwQzRFLENBQUMsRUFBM0MsRUFBK0M7QUFDM0MxQixRQUFBQSxhQUFhLENBQUMwQixDQUFELENBQWIsQ0FBaUJyRyxJQUFqQixDQUFzQnNHLGlCQUF0QixFQUFBLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0VBSURDLHFCQUFxQixDQUFDdkcsSUFBRCxFQUFPO0FBQ3hCLElBQUEsSUFBSXdHLElBQUosQ0FBQTtBQUNBLElBQUEsTUFBTUMsUUFBUSxHQUFHLElBQUEsQ0FBS2hLLEtBQUwsQ0FBV2lLLHNCQUFYLElBQXFDLEVBQXRELENBQUE7SUFDQSxNQUFNQyxLQUFLLEdBQUd4SyxPQUFkLENBQUE7SUFFQSxJQUFJeUssT0FBSixFQUFhRixzQkFBYixDQUFBOztJQUVBLElBQUkxRyxJQUFJLENBQUM0RSxLQUFULEVBQWdCO0FBQ1o4QixNQUFBQSxzQkFBc0IsR0FBRzFHLElBQUksQ0FBQzRFLEtBQUwsQ0FBVzhCLHNCQUFwQyxDQUFBOztBQUNBLE1BQUEsSUFBSTFHLElBQUksQ0FBQzRFLEtBQUwsQ0FBV2lDLEtBQWYsRUFBc0I7QUFDbEJMLFFBQUFBLElBQUksR0FBRyxJQUFBLENBQUs3SixNQUFMLENBQVltSyxHQUFaLENBQWdCOUcsSUFBSSxDQUFDNEUsS0FBTCxDQUFXaUMsS0FBM0IsQ0FBQSxDQUFrQ0wsSUFBekMsQ0FBQTs7UUFDQSxJQUFJQSxJQUFJLENBQUNPLElBQVQsRUFBZTtVQUNYSCxPQUFPLEdBQUdKLElBQUksQ0FBQ08sSUFBZixDQUFBO0FBQ0gsU0FBQTtBQUNKLE9BTEQsTUFLTyxJQUFJL0csSUFBSSxDQUFDNEUsS0FBTCxDQUFXb0MsS0FBZixFQUFzQjtRQUN6QlIsSUFBSSxHQUFHeEcsSUFBSSxDQUFDNEUsS0FBWixDQUFBOztRQUNBLElBQUk0QixJQUFJLENBQUNRLEtBQVQsRUFBZ0I7VUFDWkosT0FBTyxHQUFHSixJQUFJLENBQUNRLEtBQWYsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBO0FBQ0osS0FiRCxNQWFPLElBQUloSCxJQUFJLENBQUNnRixNQUFULEVBQWlCO0FBQ3BCMEIsTUFBQUEsc0JBQXNCLEdBQUcxRyxJQUFJLENBQUNnRixNQUFMLENBQVkwQixzQkFBckMsQ0FBQTs7QUFDQSxNQUFBLElBQUkxRyxJQUFJLENBQUNnRixNQUFMLENBQVkvRixJQUFaLEtBQXFCLE9BQXpCLEVBQWtDO0FBQzlCLFFBQUEsSUFBSWUsSUFBSSxDQUFDZ0YsTUFBTCxDQUFZZ0MsS0FBaEIsRUFBdUI7VUFDbkJSLElBQUksR0FBR3hHLElBQUksQ0FBQ2dGLE1BQVosQ0FBQTs7VUFDQSxJQUFJd0IsSUFBSSxDQUFDUSxLQUFULEVBQWdCO1lBQ1pKLE9BQU8sR0FBR0osSUFBSSxDQUFDUSxLQUFmLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUdELElBQUEsTUFBTUQsSUFBSSxHQUFHO0FBQUVFLE1BQUFBLENBQUMsRUFBRSxDQUFMO0FBQVFDLE1BQUFBLENBQUMsRUFBRSxDQUFYO0FBQWNDLE1BQUFBLENBQUMsRUFBRSxDQUFqQjtBQUFvQkMsTUFBQUEsRUFBRSxFQUFFLENBQUE7S0FBckMsQ0FBQTs7QUFDQSxJQUFBLElBQUlSLE9BQUosRUFBYTtBQUNURyxNQUFBQSxJQUFJLENBQUNFLENBQUwsR0FBU0wsT0FBTyxDQUFDSyxDQUFqQixDQUFBO0FBQ0FGLE1BQUFBLElBQUksQ0FBQ0csQ0FBTCxHQUFTTixPQUFPLENBQUNNLENBQWpCLENBQUE7QUFDQUgsTUFBQUEsSUFBSSxDQUFDSSxDQUFMLEdBQVNQLE9BQU8sQ0FBQ08sQ0FBakIsQ0FBQTtBQUNBSixNQUFBQSxJQUFJLENBQUNLLEVBQUwsR0FBVVIsT0FBTyxDQUFDUSxFQUFsQixDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLE1BQU1DLFFBQVEsR0FBR1gsc0JBQXNCLElBQUksQ0FBM0MsQ0FBQTtJQUNBSyxJQUFJLENBQUNFLENBQUwsSUFBVUksUUFBVixDQUFBO0lBQ0FOLElBQUksQ0FBQ0csQ0FBTCxJQUFVRyxRQUFWLENBQUE7SUFDQU4sSUFBSSxDQUFDSSxDQUFMLElBQVVFLFFBQVYsQ0FBQTtJQUdBLE1BQU10QixTQUFTLEdBQUcvRixJQUFJLENBQUNnRixNQUFMLElBQWVoRixJQUFJLENBQUM0RSxLQUF0QyxDQUFBO0lBQ0EsTUFBTTBDLE1BQU0sR0FBRyxJQUFLQyxDQUFBQSxpQkFBTCxDQUF1QnhCLFNBQVMsQ0FBQ3BCLGFBQWpDLENBQWYsQ0FBQTtBQUdBZ0MsSUFBQUEsS0FBSyxDQUFDYSxJQUFOLENBQVdGLE1BQU0sQ0FBQ0csV0FBbEIsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFJQyxTQUFTLEdBQUdYLElBQUksQ0FBQ0UsQ0FBTCxHQUFTTixLQUFLLENBQUNPLENBQWYsR0FBbUJQLEtBQUssQ0FBQ1EsQ0FBekIsR0FDQUosSUFBSSxDQUFDRyxDQUFMLEdBQVNQLEtBQUssQ0FBQ00sQ0FBZixHQUFtQk4sS0FBSyxDQUFDUSxDQUR6QixHQUVBSixJQUFJLENBQUNJLENBQUwsR0FBU1IsS0FBSyxDQUFDTSxDQUFmLEdBQW1CTixLQUFLLENBQUNPLENBRnpDLENBQUE7SUFHQVEsU0FBUyxJQUFJWCxJQUFJLENBQUNLLEVBQWxCLENBQUE7QUFDQU0sSUFBQUEsU0FBUyxHQUFHQyxJQUFJLENBQUNDLElBQUwsQ0FBVUYsU0FBVixDQUFaLENBQUE7SUFFQSxNQUFNRyxZQUFZLEdBQUdGLElBQUksQ0FBQ0csR0FBTCxDQUFTQyxJQUFJLENBQUNDLGNBQUwsQ0FBb0JOLFNBQVMsR0FBR2pCLFFBQWhDLENBQVQsRUFBb0QsSUFBQSxDQUFLaEssS0FBTCxDQUFXd0wscUJBQVgsSUFBb0NqTSxpQkFBeEYsQ0FBckIsQ0FBQTtBQUVBLElBQUEsT0FBTzZMLFlBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRURLLGVBQWUsQ0FBQ3RDLEtBQUQsRUFBUXVDLEtBQVIsRUFBZTNFLFNBQWYsRUFBMEI0RSxVQUExQixFQUFzQztBQUVqRCxJQUFBLEtBQUssSUFBSWxELENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdVLEtBQUssQ0FBQ25FLE1BQTFCLEVBQWtDeUQsQ0FBQyxFQUFuQyxFQUF1QztBQUNuQyxNQUFBLE1BQU1sRixJQUFJLEdBQUc0RixLQUFLLENBQUNWLENBQUQsQ0FBbEIsQ0FBQTtBQUNBLE1BQUEsTUFBTVAsYUFBYSxHQUFHM0UsSUFBSSxDQUFDMkUsYUFBM0IsQ0FBQTs7QUFFQSxNQUFBLEtBQUssSUFBSTBCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcxQixhQUFhLENBQUNsRCxNQUFsQyxFQUEwQzRFLENBQUMsRUFBM0MsRUFBK0M7QUFFM0MsUUFBQSxNQUFNZ0MsWUFBWSxHQUFHMUQsYUFBYSxDQUFDMEIsQ0FBRCxDQUFsQyxDQUFBO1FBQ0FnQyxZQUFZLENBQUNDLGNBQWIsQ0FBNEJILEtBQTVCLENBQUEsQ0FBQTs7QUFFQSxRQUFBLElBQUlBLEtBQUosRUFBVztBQUNQLFVBQUEsSUFBSUMsVUFBSixFQUFnQjtZQUNaQyxZQUFZLENBQUNFLFdBQWIsSUFBNEJILFVBQTVCLENBQUE7QUFDSCxXQUFBOztVQUdEQyxZQUFZLENBQUNHLElBQWIsR0FBb0JDLHVCQUFwQixDQUFBOztVQUdBLEtBQUssSUFBSTlHLElBQUksR0FBRyxDQUFoQixFQUFtQkEsSUFBSSxHQUFHNkIsU0FBMUIsRUFBcUM3QixJQUFJLEVBQXpDLEVBQTZDO1lBQ3pDLE1BQU0rRyxHQUFHLEdBQUcxSSxJQUFJLENBQUMxQyxhQUFMLENBQW1CcUUsSUFBbkIsRUFBeUJMLFdBQXJDLENBQUE7WUFDQW9ILEdBQUcsQ0FBQ3hFLFNBQUosR0FBZ0J5RSxhQUFoQixDQUFBO1lBQ0FELEdBQUcsQ0FBQ3RFLFNBQUosR0FBZ0J1RSxhQUFoQixDQUFBO1lBQ0FOLFlBQVksQ0FBQ08sbUJBQWIsQ0FBaUNDLFlBQVksQ0FBQ0Msa0JBQWIsQ0FBZ0NuSCxJQUFoQyxDQUFqQyxFQUF3RStHLEdBQXhFLENBQUEsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQWdCREssRUFBQUEsSUFBSSxDQUFDbkQsS0FBRCxFQUFRb0QsSUFBSSxHQUFHQyxhQUFmLEVBQThCO0lBRTlCLE1BQU0xTSxNQUFNLEdBQUcsSUFBQSxDQUFLQSxNQUFwQixDQUFBO0lBQ0EsTUFBTTJNLFNBQVMsR0FBR0MsR0FBRyxFQUFyQixDQUFBOztBQUdBLElBQUEsSUFBQSxDQUFLMU0sS0FBTCxDQUFXMk0sVUFBWCxDQUFzQjdNLE1BQXRCLENBQUEsQ0FBQTs7QUFHQUEsSUFBQUEsTUFBTSxDQUFDOE0sSUFBUCxDQUFZLG1CQUFaLEVBQWlDO0FBQzdCQyxNQUFBQSxTQUFTLEVBQUVKLFNBRGtCO0FBRTdCSyxNQUFBQSxNQUFNLEVBQUUsSUFBQTtLQUZaLENBQUEsQ0FBQTtBQU1BLElBQUEsSUFBQSxDQUFLL0wsS0FBTCxDQUFXQyxZQUFYLEdBQTBCLENBQTFCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0QsS0FBTCxDQUFXTSxhQUFYLEdBQTJCLENBQTNCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS04sS0FBTCxDQUFXSSxXQUFYLEdBQXlCLENBQXpCLENBQUE7QUFDQSxJQUFBLE1BQU00TCxZQUFZLEdBQUdqTixNQUFNLENBQUNrTixZQUFQLENBQW9CQyxNQUF6QyxDQUFBO0FBQ0EsSUFBQSxNQUFNQyxZQUFZLEdBQUdwTixNQUFNLENBQUNxTix5QkFBNUIsQ0FBQTtBQUNBLElBQUEsTUFBTUMsZ0JBQWdCLEdBQUd0TixNQUFNLENBQUNrTixZQUFQLENBQW9CMUwsV0FBN0MsQ0FBQTtJQUdBLE1BQU1vRCxTQUFTLEdBQUcsRUFBbEIsQ0FBQTtJQUdBLE1BQU1zRCxRQUFRLEdBQUcsRUFBakIsQ0FBQTs7QUFHQSxJQUFBLElBQUltQixLQUFKLEVBQVc7QUFHUCxNQUFBLEtBQUssSUFBSVYsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1UsS0FBSyxDQUFDbkUsTUFBMUIsRUFBa0N5RCxDQUFDLEVBQW5DLEVBQXVDO1FBQ25DLElBQUtWLENBQUFBLGFBQUwsQ0FBbUJvQixLQUFLLENBQUNWLENBQUQsQ0FBeEIsRUFBNkIvRCxTQUE3QixFQUF3QyxJQUF4QyxDQUFBLENBQUE7QUFDSCxPQUFBOztBQUdELE1BQUEsSUFBQSxDQUFLcUQsYUFBTCxDQUFtQixJQUFBLENBQUtoSSxJQUF4QixFQUE4QixJQUE5QixFQUFvQ2lJLFFBQXBDLENBQUEsQ0FBQTtBQUVILEtBVkQsTUFVTztBQUdILE1BQUEsSUFBQSxDQUFLRCxhQUFMLENBQW1CLElBQUEsQ0FBS2hJLElBQXhCLEVBQThCMkUsU0FBOUIsRUFBeUNzRCxRQUF6QyxDQUFBLENBQUE7QUFFSCxLQUFBOztBQUVEcUYsSUFBQUEsYUFBYSxDQUFDQyxhQUFkLENBQTRCLElBQUt4TixDQUFBQSxNQUFqQyxFQUF5QyxRQUF6QyxDQUFBLENBQUE7O0FBR0EsSUFBQSxJQUFJNEUsU0FBUyxDQUFDTSxNQUFWLEdBQW1CLENBQXZCLEVBQTBCO01BR3RCLE1BQU0rQixTQUFTLEdBQUd3RixJQUFJLEtBQUtDLGFBQVQsR0FBeUIsQ0FBekIsR0FBNkIsQ0FBL0MsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLZixlQUFMLENBQXFCL0csU0FBckIsRUFBZ0MsS0FBaEMsRUFBdUNxQyxTQUF2QyxDQUFBLENBQUE7TUFFQSxJQUFLbkYsQ0FBQUEsUUFBTCxDQUFjOUIsTUFBZCxDQUFBLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS3lOLFlBQUwsQ0FBa0J4RyxTQUFsQixFQUE2QnJDLFNBQTdCLEVBQXdDc0QsUUFBeEMsQ0FBQSxDQUFBO01BR0EsSUFBSTJELFVBQVUsR0FBRzZCLFlBQWpCLENBQUE7O01BRUEsSUFBSWpCLElBQUksS0FBS0MsYUFBYixFQUE0QjtBQUN4QmIsUUFBQUEsVUFBVSxJQUFJOEIsZUFBZCxDQUFBO0FBQ0gsT0FBQTs7QUFHRCxNQUFBLElBQUksSUFBS3pOLENBQUFBLEtBQUwsQ0FBVzBOLFdBQWYsRUFBNEI7QUFDeEIvQixRQUFBQSxVQUFVLElBQUlnQyxtQkFBZCxDQUFBO0FBQ0gsT0FBQTs7TUFDRCxJQUFLbEMsQ0FBQUEsZUFBTCxDQUFxQi9HLFNBQXJCLEVBQWdDLElBQWhDLEVBQXNDcUMsU0FBdEMsRUFBaUQ0RSxVQUFqRCxDQUFBLENBQUE7TUFHQSxJQUFLbEgsQ0FBQUEsVUFBTCxDQUFnQkMsU0FBaEIsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFFRDJJLElBQUFBLGFBQWEsQ0FBQ08sWUFBZCxDQUEyQixJQUFBLENBQUs5TixNQUFoQyxDQUFBLENBQUE7SUFFQSxNQUFNK04sT0FBTyxHQUFHbkIsR0FBRyxFQUFuQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUszTCxLQUFMLENBQVdHLGVBQVgsR0FBNkIyTSxPQUFPLEdBQUdwQixTQUF2QyxDQUFBO0lBQ0EsSUFBSzFMLENBQUFBLEtBQUwsQ0FBV1EsYUFBWCxHQUEyQnpCLE1BQU0sQ0FBQ2tOLFlBQVAsQ0FBb0JDLE1BQXBCLEdBQTZCRixZQUF4RCxDQUFBO0lBQ0EsSUFBS2hNLENBQUFBLEtBQUwsQ0FBV08sV0FBWCxHQUF5QnhCLE1BQU0sQ0FBQ2tOLFlBQVAsQ0FBb0IxTCxXQUFwQixHQUFrQzhMLGdCQUEzRCxDQUFBO0lBQ0EsSUFBS3JNLENBQUFBLEtBQUwsQ0FBV0ssT0FBWCxHQUFxQnRCLE1BQU0sQ0FBQ3FOLHlCQUFQLEdBQW1DRCxZQUF4RCxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtuTSxLQUFMLENBQVdFLGFBQVgsR0FBMkJ5RCxTQUFTLENBQUNNLE1BQXJDLENBQUE7QUFHQWxGLElBQUFBLE1BQU0sQ0FBQzhNLElBQVAsQ0FBWSxpQkFBWixFQUErQjtBQUMzQkMsTUFBQUEsU0FBUyxFQUFFZ0IsT0FEZ0I7QUFFM0JmLE1BQUFBLE1BQU0sRUFBRSxJQUFBO0tBRlosQ0FBQSxDQUFBO0FBS0gsR0FBQTs7QUFJRGdCLEVBQUFBLGdCQUFnQixDQUFDcEosU0FBRCxFQUFZcUMsU0FBWixFQUF1QjtBQUVuQyxJQUFBLEtBQUssSUFBSTBCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcvRCxTQUFTLENBQUNNLE1BQTlCLEVBQXNDeUQsQ0FBQyxFQUF2QyxFQUEyQztBQUd2QyxNQUFBLE1BQU1zRixRQUFRLEdBQUdySixTQUFTLENBQUMrRCxDQUFELENBQTFCLENBQUE7TUFDQSxNQUFNcEIsSUFBSSxHQUFHLElBQUt5QyxDQUFBQSxxQkFBTCxDQUEyQmlFLFFBQVEsQ0FBQ3hLLElBQXBDLENBQWIsQ0FBQTs7TUFHQSxLQUFLLElBQUkyQixJQUFJLEdBQUcsQ0FBaEIsRUFBbUJBLElBQUksR0FBRzZCLFNBQTFCLEVBQXFDN0IsSUFBSSxFQUF6QyxFQUE2QztRQUN6QyxNQUFNK0csR0FBRyxHQUFHLElBQUEsQ0FBSzdFLGFBQUwsQ0FBbUJDLElBQW5CLEVBQXlCMkcsbUJBQXpCLEVBQStDLHVCQUEwQnZGLEdBQUFBLENBQXpFLENBQVosQ0FBQTtRQUNBaEgsYUFBYSxDQUFDa0IsTUFBZCxDQUFxQnNKLEdBQXJCLENBQUEsQ0FBQTtBQUNBOEIsUUFBQUEsUUFBUSxDQUFDbE4sYUFBVCxDQUF1QnFFLElBQXZCLENBQStCLEdBQUEsSUFBSStJLFlBQUosQ0FBaUI7QUFDNUNwSixVQUFBQSxXQUFXLEVBQUVvSCxHQUQrQjtBQUU1Q2lDLFVBQUFBLEtBQUssRUFBRSxLQUFBO0FBRnFDLFNBQWpCLENBQS9CLENBQUE7QUFJSCxPQUFBOztNQUdELElBQUksQ0FBQyxLQUFLck4sYUFBTCxDQUFtQmtJLEdBQW5CLENBQXVCMUIsSUFBdkIsQ0FBTCxFQUFtQztRQUMvQixNQUFNNEUsR0FBRyxHQUFHLElBQUEsQ0FBSzdFLGFBQUwsQ0FBbUJDLElBQW5CLEVBQXlCMkcsbUJBQXpCLEVBQStDLDRCQUErQjNHLEdBQUFBLElBQTlFLENBQVosQ0FBQTtRQUNBNUYsYUFBYSxDQUFDa0IsTUFBZCxDQUFxQnNKLEdBQXJCLENBQUEsQ0FBQTtRQUNBLElBQUtwTCxDQUFBQSxhQUFMLENBQW1Ca0MsR0FBbkIsQ0FBdUJzRSxJQUF2QixFQUE2QixJQUFJNEcsWUFBSixDQUFpQjtBQUMxQ3BKLFVBQUFBLFdBQVcsRUFBRW9ILEdBRDZCO0FBRTFDaUMsVUFBQUEsS0FBSyxFQUFFLEtBQUE7QUFGbUMsU0FBakIsQ0FBN0IsQ0FBQSxDQUFBO0FBSUgsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVEQyxFQUFBQSxtQkFBbUIsQ0FBQ0MsZ0JBQUQsRUFBbUJDLFNBQW5CLEVBQThCQyxVQUE5QixFQUEwQztBQUd6RCxJQUFBLElBQUksSUFBS3RPLENBQUFBLEtBQUwsQ0FBVzBOLFdBQWYsRUFBNEI7QUFDeEIsTUFBQSxNQUFNL00sWUFBWSxHQUFHLElBQUk0TixnQkFBSixDQUFxQixJQUFBLENBQUt2TyxLQUExQixDQUFyQixDQUFBO01BQ0FzTyxVQUFVLENBQUNsRyxJQUFYLENBQWdCekgsWUFBaEIsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFHRCxJQUFBLE1BQU02TixXQUFXLEdBQUdKLGdCQUFnQixDQUFDSyxPQUFyQyxDQUFBOztBQUNBLElBQUEsS0FBSyxJQUFJaEcsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRytGLFdBQVcsQ0FBQ3hKLE1BQWhDLEVBQXdDeUQsQ0FBQyxFQUF6QyxFQUE2QztBQUN6QyxNQUFBLE1BQU1pRyxLQUFLLEdBQUdGLFdBQVcsQ0FBQy9GLENBQUQsQ0FBekIsQ0FBQTtNQUdBLE1BQU1rRyxTQUFTLEdBQUcsSUFBSUMsZUFBSixDQUFvQixJQUFLNU8sQ0FBQUEsS0FBekIsRUFBZ0MwTyxLQUFoQyxDQUFsQixDQUFBO01BQ0FMLFNBQVMsQ0FBQ2pHLElBQVYsQ0FBZXVHLFNBQWYsQ0FBQSxDQUFBOztBQUdBLE1BQUEsSUFBSUQsS0FBSyxDQUFDekcsT0FBTixJQUFpQixDQUFDeUcsS0FBSyxDQUFDM0MsSUFBTixHQUFhOEMsU0FBZCxNQUE2QixDQUFsRCxFQUFxRDtRQUdqREgsS0FBSyxDQUFDSSxRQUFOLEdBQWlCLEtBQWpCLENBQUE7UUFFQUosS0FBSyxDQUFDM0MsSUFBTixHQUFhLFVBQWIsQ0FBQTtRQUNBMkMsS0FBSyxDQUFDSyxnQkFBTixHQUF5QkwsS0FBSyxDQUFDbE0sSUFBTixLQUFld00scUJBQWYsR0FBdUNDLHFCQUF2QyxHQUErREMsc0JBQXhGLENBQUE7UUFDQVosVUFBVSxDQUFDbEcsSUFBWCxDQUFnQnVHLFNBQWhCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUdETCxJQUFBQSxVQUFVLENBQUNhLElBQVgsRUFBQSxDQUFBO0FBQ0gsR0FBQTs7RUFFREMsYUFBYSxDQUFDZixTQUFELEVBQVk7QUFFckIsSUFBQSxLQUFLLElBQUk1RixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHNEYsU0FBUyxDQUFDckosTUFBOUIsRUFBc0N5RCxDQUFDLEVBQXZDLEVBQTJDO0FBQ3ZDNEYsTUFBQUEsU0FBUyxDQUFDNUYsQ0FBRCxDQUFULENBQWE0RyxPQUFiLEVBQUEsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQUVEQyxFQUFBQSxVQUFVLEdBQUc7SUFHVCxJQUFLQyxDQUFBQSxZQUFMLEdBQW9CLEtBQXBCLENBQUE7O0FBQ0EsSUFBQSxJQUFJLElBQUt2UCxDQUFBQSxLQUFMLENBQVd3UCxtQkFBZixFQUFvQztBQUNoQyxNQUFBLElBQUEsQ0FBS3hQLEtBQUwsQ0FBV3dQLG1CQUFYLEdBQWlDLEtBQWpDLENBQUE7TUFDQSxJQUFLRCxDQUFBQSxZQUFMLEdBQW9CLElBQXBCLENBQUE7QUFDSCxLQUFBOztBQUdELElBQUEsSUFBQSxDQUFLN08sR0FBTCxHQUFXLElBQUtWLENBQUFBLEtBQUwsQ0FBV1UsR0FBdEIsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLQyxZQUFMLENBQWtCb0ssSUFBbEIsQ0FBdUIsSUFBSy9LLENBQUFBLEtBQUwsQ0FBV1csWUFBbEMsQ0FBQSxDQUFBO0FBR0EsSUFBQSxJQUFBLENBQUtYLEtBQUwsQ0FBV1UsR0FBWCxHQUFpQitPLFFBQWpCLENBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUMsSUFBQSxDQUFLelAsS0FBTCxDQUFXME4sV0FBaEIsRUFBNkI7TUFDekIsSUFBSzFOLENBQUFBLEtBQUwsQ0FBV1csWUFBWCxDQUF3Qm9DLEdBQXhCLENBQTRCLENBQTVCLEVBQStCLENBQS9CLEVBQWtDLENBQWxDLENBQUEsQ0FBQTtBQUNILEtBQUE7O0lBR0QsSUFBSzlDLENBQUFBLFFBQUwsQ0FBY3lQLGlCQUFkLEVBQUEsQ0FBQTtBQUNILEdBQUE7O0FBRURDLEVBQUFBLFlBQVksR0FBRztBQUVYLElBQUEsSUFBQSxDQUFLM1AsS0FBTCxDQUFXVSxHQUFYLEdBQWlCLEtBQUtBLEdBQXRCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS1YsS0FBTCxDQUFXVyxZQUFYLENBQXdCb0ssSUFBeEIsQ0FBNkIsS0FBS3BLLFlBQWxDLENBQUEsQ0FBQTs7SUFHQSxJQUFJLElBQUEsQ0FBSzRPLFlBQVQsRUFBdUI7QUFDbkIsTUFBQSxJQUFBLENBQUt2UCxLQUFMLENBQVd3UCxtQkFBWCxHQUFpQyxJQUFqQyxDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0VBR0QxRSxpQkFBaUIsQ0FBQzVDLGFBQUQsRUFBZ0I7QUFFN0IsSUFBQSxNQUFNMkMsTUFBTSxHQUFHLElBQUkrRSxXQUFKLEVBQWYsQ0FBQTs7QUFFQSxJQUFBLElBQUkxSCxhQUFhLENBQUNsRCxNQUFkLEdBQXVCLENBQTNCLEVBQThCO01BQzFCNkYsTUFBTSxDQUFDRSxJQUFQLENBQVk3QyxhQUFhLENBQUMsQ0FBRCxDQUFiLENBQWlCMkgsSUFBN0IsQ0FBQSxDQUFBOztBQUNBLE1BQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHNUgsYUFBYSxDQUFDbEQsTUFBbEMsRUFBMEM4SyxDQUFDLEVBQTNDLEVBQStDO1FBQzNDakYsTUFBTSxDQUFDN0IsR0FBUCxDQUFXZCxhQUFhLENBQUM0SCxDQUFELENBQWIsQ0FBaUJELElBQTVCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsT0FBT2hGLE1BQVAsQ0FBQTtBQUNILEdBQUE7O0VBR0RrRixrQkFBa0IsQ0FBQzVHLEtBQUQsRUFBUTtBQUV0QixJQUFBLEtBQUssSUFBSVYsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1UsS0FBSyxDQUFDbkUsTUFBMUIsRUFBa0N5RCxDQUFDLEVBQW5DLEVBQXVDO0FBQ25DLE1BQUEsTUFBTVAsYUFBYSxHQUFHaUIsS0FBSyxDQUFDVixDQUFELENBQUwsQ0FBU1AsYUFBL0IsQ0FBQTtNQUNBaUIsS0FBSyxDQUFDVixDQUFELENBQUwsQ0FBU29DLE1BQVQsR0FBa0IsSUFBS0MsQ0FBQUEsaUJBQUwsQ0FBdUI1QyxhQUF2QixDQUFsQixDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0VBR0Q4SCxhQUFhLENBQUM5SCxhQUFELEVBQWdCO0FBRXpCLElBQUEsTUFBTTJDLE1BQU0sR0FBRyxJQUFJK0UsV0FBSixFQUFmLENBQUE7O0FBRUEsSUFBQSxLQUFLLElBQUluSCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHUCxhQUFhLENBQUNsRCxNQUFsQyxFQUEwQ3lELENBQUMsRUFBM0MsRUFBK0M7TUFDM0NvQyxNQUFNLENBQUNFLElBQVAsQ0FBWTdDLGFBQWEsQ0FBQyxDQUFELENBQWIsQ0FBaUIySCxJQUE3QixDQUFBLENBQUE7O0FBQ0EsTUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUc1SCxhQUFhLENBQUNsRCxNQUFsQyxFQUEwQzhLLENBQUMsRUFBM0MsRUFBK0M7UUFDM0NqRixNQUFNLENBQUM3QixHQUFQLENBQVdkLGFBQWEsQ0FBQzRILENBQUQsQ0FBYixDQUFpQkQsSUFBNUIsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxPQUFPaEYsTUFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFFRG9GLGVBQWUsQ0FBQy9ILGFBQUQsRUFBZ0I7QUFDM0IsSUFBQSxLQUFLLElBQUlPLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdQLGFBQWEsQ0FBQ2xELE1BQWxDLEVBQTBDeUQsQ0FBQyxFQUEzQyxFQUErQztNQUMzQyxJQUFLdkcsQ0FBQUEsU0FBTCxDQUFldUcsQ0FBZixDQUFBLEdBQW9CUCxhQUFhLENBQUNPLENBQUQsQ0FBYixDQUFpQnJELFFBQXJDLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7RUFFRDhLLGdCQUFnQixDQUFDaEksYUFBRCxFQUFnQjtBQUM1QixJQUFBLEtBQUssSUFBSU8sQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1AsYUFBYSxDQUFDbEQsTUFBbEMsRUFBMEN5RCxDQUFDLEVBQTNDLEVBQStDO01BQzNDUCxhQUFhLENBQUNPLENBQUQsQ0FBYixDQUFpQnJELFFBQWpCLEdBQTRCLElBQUtsRCxDQUFBQSxTQUFMLENBQWV1RyxDQUFmLENBQTVCLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFFRDBILEVBQUFBLGtCQUFrQixDQUFDclEsTUFBRCxFQUFTNk8sU0FBVCxFQUFvQjtBQUVsQyxJQUFBLE1BQU1ELEtBQUssR0FBR0MsU0FBUyxDQUFDRCxLQUF4QixDQUFBO0FBQ0EsSUFBQSxJQUFJMEIsU0FBSixDQUFBOztBQUdBLElBQUEsSUFBSTFCLEtBQUssQ0FBQ2xNLElBQU4sS0FBZTZOLGNBQW5CLEVBQW1DO01BRS9CLE1BQU1DLGVBQWUsR0FBRzVCLEtBQUssQ0FBQzZCLGFBQU4sQ0FBb0IsSUFBcEIsRUFBMEIsQ0FBMUIsQ0FBeEIsQ0FBQTtNQUNBSCxTQUFTLEdBQUdFLGVBQWUsQ0FBQ0UsWUFBNUIsQ0FBQTs7TUFFQUosU0FBUyxDQUFDSyxLQUFWLENBQWdCQyxXQUFoQixDQUE0QmhDLEtBQUssQ0FBQytCLEtBQU4sQ0FBWUUsV0FBWixFQUE1QixDQUFBLENBQUE7O01BQ0FQLFNBQVMsQ0FBQ0ssS0FBVixDQUFnQkcsV0FBaEIsQ0FBNEJsQyxLQUFLLENBQUMrQixLQUFOLENBQVlJLFdBQVosRUFBNUIsQ0FBQSxDQUFBOztNQUNBVCxTQUFTLENBQUNLLEtBQVYsQ0FBZ0JLLFdBQWhCLENBQTRCLENBQUMsRUFBN0IsRUFBaUMsQ0FBakMsRUFBb0MsQ0FBcEMsQ0FBQSxDQUFBOztNQUVBVixTQUFTLENBQUNoTixVQUFWLEdBQXVCMk4sc0JBQXZCLENBQUE7QUFDQVgsTUFBQUEsU0FBUyxDQUFDWSxRQUFWLEdBQXFCdEMsS0FBSyxDQUFDdUMsY0FBTixHQUF1QixJQUE1QyxDQUFBO0FBQ0FiLE1BQUFBLFNBQVMsQ0FBQ2MsT0FBVixHQUFvQnhDLEtBQUssQ0FBQ3VDLGNBQTFCLENBQUE7TUFDQWIsU0FBUyxDQUFDOU0sV0FBVixHQUF3QixDQUF4QixDQUFBO0FBQ0E4TSxNQUFBQSxTQUFTLENBQUNlLEdBQVYsR0FBZ0J6QyxLQUFLLENBQUMwQyxlQUFOLEdBQXdCLENBQXhDLENBQUE7QUFFQSxNQUFBLElBQUEsQ0FBS25SLFFBQUwsQ0FBY29SLG1CQUFkLENBQWtDakIsU0FBbEMsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU9BLFNBQVAsQ0FBQTtBQUNILEdBQUE7O0VBSURrQix5QkFBeUIsQ0FBQzNDLFNBQUQsRUFBWVosUUFBWixFQUFzQnFDLFNBQXRCLEVBQWlDbUIsWUFBakMsRUFBK0M7QUFFcEUsSUFBQSxNQUFNN0MsS0FBSyxHQUFHQyxTQUFTLENBQUNELEtBQXhCLENBQUE7SUFDQSxJQUFJOEMsZ0JBQWdCLEdBQUcsSUFBdkIsQ0FBQTs7QUFFQSxJQUFBLElBQUk5QyxLQUFLLENBQUNsTSxJQUFOLEtBQWV3TSxxQkFBbkIsRUFBMEM7QUFHdEN0UCxNQUFBQSxPQUFPLENBQUNxTCxJQUFSLENBQWF3RyxZQUFZLENBQUNFLE1BQTFCLENBQUEsQ0FBQTtBQUNBL1IsTUFBQUEsT0FBTyxDQUFDK0ssQ0FBUixJQUFhOEcsWUFBWSxDQUFDdkcsV0FBYixDQUF5QlAsQ0FBdEMsQ0FBQTtBQUVBLE1BQUEsSUFBQSxDQUFLN0gsTUFBTCxDQUFZVyxJQUFaLENBQWlCbU4sV0FBakIsQ0FBNkJoUixPQUE3QixDQUFBLENBQUE7TUFDQSxJQUFLa0QsQ0FBQUEsTUFBTCxDQUFZVyxJQUFaLENBQWlCbU8sY0FBakIsQ0FBZ0MsQ0FBQyxFQUFqQyxFQUFxQyxDQUFyQyxFQUF3QyxDQUF4QyxDQUFBLENBQUE7QUFFQSxNQUFBLElBQUEsQ0FBSzlPLE1BQUwsQ0FBWW9PLFFBQVosR0FBdUIsQ0FBdkIsQ0FBQTtNQUNBLElBQUtwTyxDQUFBQSxNQUFMLENBQVlzTyxPQUFaLEdBQXNCSyxZQUFZLENBQUN2RyxXQUFiLENBQXlCUCxDQUF6QixHQUE2QixDQUFuRCxDQUFBO0FBRUEsTUFBQSxNQUFNa0gsV0FBVyxHQUFHekcsSUFBSSxDQUFDMEcsR0FBTCxDQUFTTCxZQUFZLENBQUN2RyxXQUFiLENBQXlCUixDQUFsQyxFQUFxQytHLFlBQVksQ0FBQ3ZHLFdBQWIsQ0FBeUJOLENBQTlELENBQXBCLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBSzlILE1BQUwsQ0FBWWlQLFdBQVosR0FBMEJGLFdBQTFCLENBQUE7QUFFSCxLQWZELE1BZU87TUFHSCxJQUFJLENBQUNoRCxTQUFTLENBQUNtRCxXQUFWLENBQXNCQyxVQUF0QixDQUFpQ2hFLFFBQVEsQ0FBQ2xELE1BQTFDLENBQUwsRUFBd0Q7QUFDcEQyRyxRQUFBQSxnQkFBZ0IsR0FBRyxLQUFuQixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBSUQsSUFBQSxJQUFJOUMsS0FBSyxDQUFDbE0sSUFBTixLQUFlNk4sY0FBbkIsRUFBbUM7TUFDL0IsSUFBSTJCLFdBQVcsR0FBRyxLQUFsQixDQUFBO0FBRUEsTUFBQSxNQUFNOUosYUFBYSxHQUFHNkYsUUFBUSxDQUFDN0YsYUFBL0IsQ0FBQTs7QUFDQSxNQUFBLEtBQUssSUFBSU8sQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1AsYUFBYSxDQUFDbEQsTUFBbEMsRUFBMEN5RCxDQUFDLEVBQTNDLEVBQStDO1FBQzNDLElBQUlQLGFBQWEsQ0FBQ08sQ0FBRCxDQUFiLENBQWlCd0osVUFBakIsQ0FBNEI3QixTQUE1QixDQUFKLEVBQTRDO0FBQ3hDNEIsVUFBQUEsV0FBVyxHQUFHLElBQWQsQ0FBQTtBQUNBLFVBQUEsTUFBQTtBQUNILFNBQUE7QUFDSixPQUFBOztNQUNELElBQUksQ0FBQ0EsV0FBTCxFQUFrQjtBQUNkUixRQUFBQSxnQkFBZ0IsR0FBRyxLQUFuQixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxPQUFPQSxnQkFBUCxDQUFBO0FBQ0gsR0FBQTs7QUFHRFUsRUFBQUEsZUFBZSxDQUFDQyxVQUFELEVBQWF6RCxLQUFiLEVBQW9CO0FBRS9CeUQsSUFBQUEsVUFBVSxDQUFDbkQscUJBQUQsQ0FBVixDQUFrQ2hLLE1BQWxDLEdBQTJDLENBQTNDLENBQUE7QUFDQW1OLElBQUFBLFVBQVUsQ0FBQ0MsY0FBRCxDQUFWLENBQTJCcE4sTUFBM0IsR0FBb0MsQ0FBcEMsQ0FBQTtBQUNBbU4sSUFBQUEsVUFBVSxDQUFDOUIsY0FBRCxDQUFWLENBQTJCckwsTUFBM0IsR0FBb0MsQ0FBcEMsQ0FBQTtJQUVBbU4sVUFBVSxDQUFDekQsS0FBSyxDQUFDbE0sSUFBUCxDQUFWLENBQXVCLENBQXZCLElBQTRCa00sS0FBNUIsQ0FBQTtJQUNBQSxLQUFLLENBQUNoRixnQkFBTixHQUF5QixJQUF6QixDQUFBO0FBQ0gsR0FBQTs7RUFFRDJJLGVBQWUsQ0FBQ0MsaUJBQUQsRUFBb0JsSixPQUFwQixFQUE2QitJLFVBQTdCLEVBQXlDeEQsU0FBekMsRUFBb0Q7QUFFL0QsSUFBQSxNQUFNRCxLQUFLLEdBQUdDLFNBQVMsQ0FBQ0QsS0FBeEIsQ0FBQTs7QUFDQSxJQUFBLElBQUksQ0FBQzRELGlCQUFELElBQXNCNUQsS0FBSyxDQUFDbkYsV0FBaEMsRUFBNkM7TUFHekMsSUFBSSxDQUFDbUYsS0FBSyxDQUFDNkQsU0FBUCxJQUFvQixDQUFDLElBQUt2UyxDQUFBQSxLQUFMLENBQVd5RCx3QkFBcEMsRUFBOEQ7QUFDMURpTCxRQUFBQSxLQUFLLENBQUM2RCxTQUFOLEdBQWtCLElBQUEsQ0FBS3BTLGNBQUwsQ0FBb0JrSyxHQUFwQixDQUF3QixJQUFLdkssQ0FBQUEsTUFBN0IsRUFBcUM0TyxLQUFyQyxDQUFsQixDQUFBO0FBQ0gsT0FBQTs7QUFFRCxNQUFBLElBQUlBLEtBQUssQ0FBQ2xNLElBQU4sS0FBZXdNLHFCQUFuQixFQUEwQztRQUN0QyxJQUFLL08sQ0FBQUEsUUFBTCxDQUFjRyxlQUFkLENBQThCb1MsZUFBOUIsQ0FBOEM5RCxLQUE5QyxFQUFxRHRGLE9BQXJELEVBQThELElBQUEsQ0FBS3hHLE1BQW5FLENBQUEsQ0FBQTtBQUNILE9BRkQsTUFFTztRQUNILElBQUszQyxDQUFBQSxRQUFMLENBQWNHLGVBQWQsQ0FBOEJxUyxTQUE5QixDQUF3Qy9ELEtBQXhDLEVBQStDdEYsT0FBL0MsQ0FBQSxDQUFBO0FBQ0gsT0FBQTs7QUFFRCxNQUFBLElBQUEsQ0FBS25KLFFBQUwsQ0FBY3lTLGFBQWQsQ0FBNEJQLFVBQVUsQ0FBQ3pELEtBQUssQ0FBQ2xNLElBQVAsQ0FBdEMsRUFBb0QsSUFBQSxDQUFLSSxNQUF6RCxDQUFBLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxHQUFBOztBQUVEK1AsRUFBQUEsbUJBQW1CLENBQUM3UyxNQUFELEVBQVM0RSxTQUFULEVBQW9CcUMsU0FBcEIsRUFBK0I7SUFFOUMsTUFBTTZMLFlBQVksR0FBRyxDQUFyQixDQUFBO0FBQ0EsSUFBQSxNQUFNQyxZQUFZLEdBQUcsSUFBS2hSLENBQUFBLGVBQUwsQ0FBcUJpUixZQUExQyxDQUFBO0FBR0EsSUFBQSxNQUFNQyxjQUFjLEdBQUcsSUFBSy9TLENBQUFBLEtBQUwsQ0FBV2dULHFCQUFsQyxDQUFBOztBQUNBLElBQUEsSUFBSUQsY0FBSixFQUFvQjtBQUNoQixNQUFBLElBQUEsQ0FBS2xSLGVBQUwsQ0FBcUJvUixjQUFyQixDQUFvQyxJQUFLalQsQ0FBQUEsS0FBTCxDQUFXa1QsbUJBQS9DLEVBQW9FLElBQUEsQ0FBS2xULEtBQUwsQ0FBV21ULHdCQUEvRSxDQUFBLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsS0FBSyxJQUFJNVAsSUFBSSxHQUFHLENBQWhCLEVBQW1CQSxJQUFJLEdBQUdtQixTQUFTLENBQUNNLE1BQXBDLEVBQTRDekIsSUFBSSxFQUFoRCxFQUFvRDtBQUNoRCxNQUFBLE1BQU13SyxRQUFRLEdBQUdySixTQUFTLENBQUNuQixJQUFELENBQTFCLENBQUE7TUFFQThKLGFBQWEsQ0FBQ0MsYUFBZCxDQUE0QixJQUFBLENBQUt4TixNQUFqQyxFQUEwQyxDQUFBLE9BQUEsRUFBU3lELElBQUssQ0FBeEQsQ0FBQSxDQUFBLENBQUE7O01BRUEsS0FBSyxJQUFJMkIsSUFBSSxHQUFHLENBQWhCLEVBQW1CQSxJQUFJLEdBQUc2QixTQUExQixFQUFxQzdCLElBQUksRUFBekMsRUFBNkM7QUFFekMsUUFBQSxNQUFNa08sTUFBTSxHQUFHckYsUUFBUSxDQUFDbE4sYUFBVCxDQUF1QnFFLElBQXZCLENBQWYsQ0FBQTtBQUNBLFFBQUEsTUFBTW1PLFFBQVEsR0FBR0QsTUFBTSxDQUFDdk8sV0FBeEIsQ0FBQTtRQUVBLE1BQU15TyxNQUFNLEdBQUcsSUFBQSxDQUFLelMsYUFBTCxDQUFtQndKLEdBQW5CLENBQXVCZ0osUUFBUSxDQUFDalIsS0FBaEMsQ0FBZixDQUFBO0FBQ0EsUUFBQSxNQUFNbVIsT0FBTyxHQUFHRCxNQUFNLENBQUN6TyxXQUF2QixDQUFBO1FBRUEsSUFBS2hELENBQUFBLGVBQUwsQ0FBcUIyUixPQUFyQixDQUE2QkgsUUFBUSxDQUFDalIsS0FBdEMsRUFBNkNpUixRQUFRLENBQUNoUixNQUF0RCxDQUFBLENBQUE7O1FBR0EsS0FBSyxJQUFJb0csQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR21LLFlBQXBCLEVBQWtDbkssQ0FBQyxFQUFuQyxFQUF1QztBQUVuQyxVQUFBLElBQUEsQ0FBSzVHLGVBQUwsQ0FBcUI0UixnQkFBckIsQ0FBc0NKLFFBQXRDLENBQUEsQ0FBQTtVQUNBLE1BQU1LLHNCQUFzQixHQUFHWCxjQUFjLElBQUk3TixJQUFJLEtBQUssQ0FBM0IsSUFBZ0N1RCxDQUFDLEtBQUssQ0FBckUsQ0FBQTtBQUNBa0wsVUFBQUEsa0JBQWtCLENBQUM3VCxNQUFELEVBQVN3VCxNQUFULEVBQWlCSSxzQkFBc0IsR0FBRyxJQUFBLENBQUs3UixlQUFMLENBQXFCK1IsYUFBeEIsR0FBd0NmLFlBQS9FLENBQWxCLENBQUE7QUFFQSxVQUFBLElBQUEsQ0FBS2hSLGVBQUwsQ0FBcUI0UixnQkFBckIsQ0FBc0NGLE9BQXRDLENBQUEsQ0FBQTtBQUNBSSxVQUFBQSxrQkFBa0IsQ0FBQzdULE1BQUQsRUFBU3NULE1BQVQsRUFBaUJQLFlBQWpCLENBQWxCLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTs7QUFFRHhGLE1BQUFBLGFBQWEsQ0FBQ08sWUFBZCxDQUEyQixJQUFBLENBQUs5TixNQUFoQyxDQUFBLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFFRHlOLEVBQUFBLFlBQVksQ0FBQ3hHLFNBQUQsRUFBWXJDLFNBQVosRUFBdUJzRCxRQUF2QixFQUFpQztJQUV6QyxNQUFNaEksS0FBSyxHQUFHLElBQUEsQ0FBS0EsS0FBbkIsQ0FBQTtJQUNBLE1BQU1GLE1BQU0sR0FBRyxJQUFBLENBQUtBLE1BQXBCLENBQUE7QUFDQSxJQUFBLE1BQU0yRCx3QkFBd0IsR0FBR3pELEtBQUssQ0FBQ3lELHdCQUF2QyxDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUtxRCxlQUFMLENBQXFCaEgsTUFBckIsRUFBNkJFLEtBQTdCLEVBQW9DK0csU0FBcEMsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUt1SSxVQUFMLEVBQUEsQ0FBQTs7SUFHQXRQLEtBQUssQ0FBQzZULE1BQU4sQ0FBYUMsT0FBYixFQUFBLENBQUE7O0lBR0EsSUFBSy9ELENBQUFBLGtCQUFMLENBQXdCckwsU0FBeEIsQ0FBQSxDQUFBO0FBR0EsSUFBQSxJQUFBLENBQUtvSixnQkFBTCxDQUFzQnBKLFNBQXRCLEVBQWlDcUMsU0FBakMsQ0FBQSxDQUFBO0lBR0EsTUFBTXNILFNBQVMsR0FBRyxFQUFsQjtVQUFzQkMsVUFBVSxHQUFHLEVBQW5DLENBQUE7SUFDQSxJQUFLSCxDQUFBQSxtQkFBTCxDQUF5Qm5PLEtBQUssQ0FBQzZULE1BQS9CLEVBQXVDeEYsU0FBdkMsRUFBa0RDLFVBQWxELENBQUEsQ0FBQTtJQUdBLElBQUszRSxDQUFBQSxnQkFBTCxDQUFzQjNCLFFBQXRCLENBQUEsQ0FBQTtBQUdBLElBQUEsTUFBTW9CLE9BQU8sR0FBRyxJQUFBLENBQUtGLG9CQUFMLENBQTBCbEIsUUFBMUIsQ0FBaEIsQ0FBQTtBQUdBLElBQUEsSUFBQSxDQUFLL0gsUUFBTCxDQUFjOFQscUJBQWQsQ0FBb0MzSyxPQUFwQyxDQUFBLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS25KLFFBQUwsQ0FBYytULFNBQWQsQ0FBd0I1SyxPQUF4QixDQUFBLENBQUE7QUFHQSxJQUFBLE1BQU1tSSxZQUFZLEdBQUcsSUFBQSxDQUFLdkIsYUFBTCxDQUFtQjVHLE9BQW5CLENBQXJCLENBQUE7QUFFQSxJQUFBLElBQUlYLENBQUosRUFBT21CLENBQVAsRUFBVXFLLEdBQVYsRUFBZW5FLENBQWYsQ0FBQTs7QUFHQSxJQUFBLEtBQUtySCxDQUFDLEdBQUcsQ0FBVCxFQUFZQSxDQUFDLEdBQUcvRCxTQUFTLENBQUNNLE1BQTFCLEVBQWtDeUQsQ0FBQyxFQUFuQyxFQUF1QztBQUNuQyxNQUFBLE1BQU1zRixRQUFRLEdBQUdySixTQUFTLENBQUMrRCxDQUFELENBQTFCLENBQUE7TUFDQXdMLEdBQUcsR0FBR2xHLFFBQVEsQ0FBQzdGLGFBQWYsQ0FBQTs7QUFFQSxNQUFBLEtBQUswQixDQUFDLEdBQUcsQ0FBVCxFQUFZQSxDQUFDLEdBQUdxSyxHQUFHLENBQUNqUCxNQUFwQixFQUE0QjRFLENBQUMsRUFBN0IsRUFBaUM7QUFFN0JrRyxRQUFBQSxDQUFDLEdBQUdtRSxHQUFHLENBQUNySyxDQUFELENBQVAsQ0FBQTtRQUVBa0csQ0FBQyxDQUFDakUsY0FBRixDQUFpQixLQUFqQixDQUFBLENBQUE7UUFDQWlFLENBQUMsQ0FBQy9ELElBQUYsR0FBUzhDLFNBQVQsQ0FBQTtRQUdBaUIsQ0FBQyxDQUFDM0QsbUJBQUYsQ0FBc0JDLFlBQVksQ0FBQ0Msa0JBQWIsQ0FBZ0MsQ0FBaEMsQ0FBdEIsRUFBMER5RCxDQUFDLENBQUMxSyxRQUFGLENBQVdnQixRQUFYLEdBQXNCMEosQ0FBQyxDQUFDMUssUUFBRixDQUFXZ0IsUUFBakMsR0FBNEMsSUFBQSxDQUFLekUsUUFBM0csQ0FBQSxDQUFBO1FBQ0FtTyxDQUFDLENBQUMzRCxtQkFBRixDQUFzQkMsWUFBWSxDQUFDQyxrQkFBYixDQUFnQyxDQUFoQyxDQUF0QixFQUEwRCxJQUFBLENBQUsxSyxRQUEvRCxDQUFBLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7QUFHRCxJQUFBLEtBQUtpSSxDQUFDLEdBQUcsQ0FBVCxFQUFZQSxDQUFDLEdBQUcwRSxVQUFVLENBQUN0SixNQUEzQixFQUFtQzRFLENBQUMsRUFBcEMsRUFBd0M7TUFDcEMwRSxVQUFVLENBQUMxRSxDQUFELENBQVYsQ0FBYzhFLEtBQWQsQ0FBb0J6RyxPQUFwQixHQUE4QixLQUE5QixDQUFBO0FBQ0gsS0FBQTs7SUFFRCxNQUFNa0ssVUFBVSxHQUFHLENBQUMsRUFBRCxFQUFLLEVBQUwsRUFBUyxFQUFULENBQW5CLENBQUE7SUFDQSxJQUFJak4sSUFBSixFQUFVM0IsSUFBVixDQUFBO0lBQ0EsSUFBSTJRLHVCQUF1QixHQUFHLEtBQTlCLENBQUE7O0FBR0EsSUFBQSxLQUFLekwsQ0FBQyxHQUFHLENBQVQsRUFBWUEsQ0FBQyxHQUFHNkYsVUFBVSxDQUFDdEosTUFBM0IsRUFBbUN5RCxDQUFDLEVBQXBDLEVBQXdDO0FBQ3BDLE1BQUEsTUFBTWtHLFNBQVMsR0FBR0wsVUFBVSxDQUFDN0YsQ0FBRCxDQUE1QixDQUFBO0FBQ0EsTUFBQSxNQUFNMEwsY0FBYyxHQUFHeEYsU0FBUyxZQUFZSixnQkFBNUMsQ0FBQTtBQUdBLE1BQUEsSUFBSTZGLGdCQUFnQixHQUFHekYsU0FBUyxDQUFDeUYsZ0JBQWpDLENBQUE7O0FBR0EsTUFBQSxJQUFJck4sU0FBUyxHQUFHLENBQVosSUFBaUJxTixnQkFBZ0IsR0FBRyxDQUFwQyxJQUF5Q3pGLFNBQVMsQ0FBQ0QsS0FBVixDQUFnQjJGLE9BQTdELEVBQXNFO0FBQ2xFRCxRQUFBQSxnQkFBZ0IsR0FBRyxDQUFuQixDQUFBO1FBQ0F4TCxLQUFLLENBQUMwTCxJQUFOLENBQVcsc0hBQVgsQ0FBQSxDQUFBO0FBQ0gsT0FBQTs7TUFFRCxLQUFLLElBQUlDLGlCQUFpQixHQUFHLENBQTdCLEVBQWdDQSxpQkFBaUIsR0FBR0gsZ0JBQXBELEVBQXNFRyxpQkFBaUIsRUFBdkYsRUFBMkY7QUFFdkZsSCxRQUFBQSxhQUFhLENBQUNDLGFBQWQsQ0FBNEJ4TixNQUE1QixFQUFxQyxDQUFRNk8sTUFBQUEsRUFBQUEsU0FBUyxDQUFDRCxLQUFWLENBQWdCK0IsS0FBaEIsQ0FBc0IvTixJQUFLLENBQUEsQ0FBQSxFQUFHNlIsaUJBQWtCLENBQTdGLENBQUEsQ0FBQSxDQUFBOztRQUdBLElBQUlILGdCQUFnQixHQUFHLENBQXZCLEVBQTBCO0FBQ3RCekYsVUFBQUEsU0FBUyxDQUFDNkYsbUJBQVYsQ0FBOEJELGlCQUE5QixFQUFpREgsZ0JBQWpELENBQUEsQ0FBQTtBQUNILFNBQUE7O0FBRUR6RixRQUFBQSxTQUFTLENBQUM4RixTQUFWLEVBQUEsQ0FBQTtRQUNBLElBQUluQyxpQkFBaUIsR0FBRyxLQUF4QixDQUFBO1FBRUEsTUFBTWxDLFNBQVMsR0FBRyxJQUFLRCxDQUFBQSxrQkFBTCxDQUF3QnJRLE1BQXhCLEVBQWdDNk8sU0FBaEMsQ0FBbEIsQ0FBQTs7QUFFQSxRQUFBLEtBQUtwTCxJQUFJLEdBQUcsQ0FBWixFQUFlQSxJQUFJLEdBQUdtQixTQUFTLENBQUNNLE1BQWhDLEVBQXdDekIsSUFBSSxFQUE1QyxFQUFnRDtBQUU1QyxVQUFBLE1BQU13SyxRQUFRLEdBQUdySixTQUFTLENBQUNuQixJQUFELENBQTFCLENBQUE7VUFDQTBRLEdBQUcsR0FBR2xHLFFBQVEsQ0FBQzdGLGFBQWYsQ0FBQTtBQUVBLFVBQUEsTUFBTXNKLGdCQUFnQixHQUFHLElBQUtGLENBQUFBLHlCQUFMLENBQStCM0MsU0FBL0IsRUFBMENaLFFBQTFDLEVBQW9EcUMsU0FBcEQsRUFBK0RtQixZQUEvRCxDQUF6QixDQUFBOztVQUNBLElBQUksQ0FBQ0MsZ0JBQUwsRUFBdUI7QUFDbkIsWUFBQSxTQUFBO0FBQ0gsV0FBQTs7QUFFRCxVQUFBLElBQUEsQ0FBS1UsZUFBTCxDQUFxQkMsVUFBckIsRUFBaUN4RCxTQUFTLENBQUNELEtBQTNDLENBQUEsQ0FBQTs7QUFFQSxVQUFBLElBQUlqTCx3QkFBSixFQUE4QjtBQUMxQixZQUFBLElBQUEsQ0FBS3hELFFBQUwsQ0FBY3lVLGlCQUFkLENBQWdDN04sTUFBaEMsQ0FBdUNzTCxVQUFVLENBQUM5QixjQUFELENBQWpELEVBQW1FOEIsVUFBVSxDQUFDQyxjQUFELENBQTdFLEVBQStGLEtBQUsxTyxjQUFwRyxDQUFBLENBQUE7QUFDSCxXQUFBOztVQUdENE8saUJBQWlCLEdBQUcsSUFBS0QsQ0FBQUEsZUFBTCxDQUFxQkMsaUJBQXJCLEVBQXdDbEosT0FBeEMsRUFBaUQrSSxVQUFqRCxFQUE2RHhELFNBQTdELENBQXBCLENBQUE7O0FBRUEsVUFBQSxJQUFJbEwsd0JBQUosRUFBOEI7QUFDMUIsWUFBQSxNQUFNa1IsYUFBYSxHQUFHeEMsVUFBVSxDQUFDOUIsY0FBRCxDQUFWLENBQTJCdUUsTUFBM0IsQ0FBa0N6QyxVQUFVLENBQUNDLGNBQUQsQ0FBNUMsQ0FBdEIsQ0FBQTtBQUNBLFlBQUEsSUFBQSxDQUFLN04sYUFBTCxDQUFtQnNDLE1BQW5CLENBQTBCOE4sYUFBMUIsRUFBeUMsSUFBSzNVLENBQUFBLEtBQUwsQ0FBVzZVLGVBQXBELEVBQXFFLElBQUEsQ0FBS25SLGNBQTFFLENBQUEsQ0FBQTtBQUNILFdBQUE7O1VBR0QsSUFBS3VNLENBQUFBLGVBQUwsQ0FBcUJnRSxHQUFyQixDQUFBLENBQUE7O1VBRUEsS0FBSy9PLElBQUksR0FBRyxDQUFaLEVBQWVBLElBQUksR0FBRzZCLFNBQXRCLEVBQWlDN0IsSUFBSSxFQUFyQyxFQUF5QztBQUdyQyxZQUFBLElBQUlBLElBQUksR0FBRyxDQUFQLElBQVlxUCxpQkFBaUIsR0FBRyxDQUFwQyxFQUF1QztBQUNuQyxjQUFBLE1BQUE7QUFDSCxhQUFBOztBQUdELFlBQUEsSUFBSUosY0FBYyxJQUFJalAsSUFBSSxHQUFHLENBQTdCLEVBQWdDO0FBQzVCLGNBQUEsTUFBQTtBQUNILGFBQUE7O0FBRURtSSxZQUFBQSxhQUFhLENBQUNDLGFBQWQsQ0FBNEJ4TixNQUE1QixFQUFxQyxDQUFBLE9BQUEsRUFBU29GLElBQUssQ0FBbkQsQ0FBQSxDQUFBLENBQUE7QUFHQSxZQUFBLE1BQU1rTyxNQUFNLEdBQUdyRixRQUFRLENBQUNsTixhQUFULENBQXVCcUUsSUFBdkIsQ0FBZixDQUFBO1lBQ0EsTUFBTWtHLFlBQVksR0FBRzJDLFFBQVEsQ0FBQ2xOLGFBQVQsQ0FBdUJxRSxJQUF2QixDQUFBLENBQTZCTCxXQUE3QixDQUF5Q3pDLEtBQTlELENBQUE7WUFHQSxNQUFNa1IsTUFBTSxHQUFHLElBQUt6UyxDQUFBQSxhQUFMLENBQW1Cd0osR0FBbkIsQ0FBdUJlLFlBQXZCLENBQWYsQ0FBQTtBQUNBLFlBQUEsTUFBTW1JLE9BQU8sR0FBR0QsTUFBTSxDQUFDek8sV0FBdkIsQ0FBQTs7WUFFQSxJQUFJSyxJQUFJLEtBQUssQ0FBYixFQUFnQjtjQUNaZ1AsdUJBQXVCLEdBQUdsVSxLQUFLLENBQUM4VSxhQUFoQyxDQUFBO2FBREosTUFFTyxJQUFJWix1QkFBSixFQUE2QjtjQUNoQ2xVLEtBQUssQ0FBQzhVLGFBQU4sR0FBc0IsSUFBdEIsQ0FBQTtBQUNILGFBQUE7O0FBRUQsWUFBQSxJQUFJQyxZQUFZLEdBQUcsSUFBQSxDQUFLdlUsYUFBTCxDQUFtQjBFLElBQW5CLENBQW5CLENBQUE7O0FBQ0EsWUFBQSxJQUFJaVAsY0FBSixFQUFvQjtBQUVoQixjQUFBLE1BQU1hLHVCQUF1QixHQUFHVCxpQkFBaUIsR0FBRyxDQUFwQixLQUEwQkgsZ0JBQTFELENBQUE7O0FBQ0EsY0FBQSxJQUFJWSx1QkFBdUIsSUFBSTlQLElBQUksS0FBSyxDQUF4QyxFQUEyQztnQkFDdkM2UCxZQUFZLEdBQUcsS0FBS3RVLGlCQUFwQixDQUFBO0FBQ0gsZUFBQTtBQUNKLGFBQUE7O0FBR0QsWUFBQSxLQUFLbUosQ0FBQyxHQUFHLENBQVQsRUFBWUEsQ0FBQyxHQUFHcUssR0FBRyxDQUFDalAsTUFBcEIsRUFBNEI0RSxDQUFDLEVBQTdCLEVBQWlDO0FBQzdCcUssY0FBQUEsR0FBRyxDQUFDckssQ0FBRCxDQUFILENBQU94RSxRQUFQLEdBQWtCMlAsWUFBbEIsQ0FBQTtBQUNILGFBQUE7O0FBR0QsWUFBQSxJQUFBLENBQUs5VSxRQUFMLENBQWM2VSxhQUFkLENBQTRCYixHQUE1QixDQUFBLENBQUE7WUFHQSxJQUFLaFUsQ0FBQUEsUUFBTCxDQUFjZ1YsU0FBZCxDQUF3QixLQUFLclMsTUFBN0IsRUFBcUMwUSxNQUFyQyxFQUE2QyxJQUE3QyxDQUFBLENBQUE7O1lBRUEsSUFBSXBPLElBQUksS0FBS3pGLFFBQWIsRUFBdUI7QUFDbkIsY0FBQSxJQUFBLENBQUtzQyxlQUFMLENBQXFCbVQsUUFBckIsQ0FBOEJ2RyxTQUFTLENBQUNELEtBQVYsQ0FBZ0IyRixPQUFoQixHQUEwQixDQUExQixHQUE4QixDQUE1RCxDQUFBLENBQUE7QUFDSCxhQUFBOztBQUdELFlBQUEsSUFBSTVRLHdCQUFKLEVBQThCO0FBQzFCLGNBQUEsSUFBQSxDQUFLYyxhQUFMLENBQW1CNFEsUUFBbkIsQ0FBNEIsSUFBS2xWLENBQUFBLFFBQUwsQ0FBY3lVLGlCQUExQyxDQUFBLENBQUE7QUFDSCxhQUFBOztBQUVELFlBQUEsSUFBQSxDQUFLelUsUUFBTCxDQUFjbVYsWUFBZCxHQUE2QixDQUE3QixDQUFBO0FBQ0EsWUFBQSxJQUFBLENBQUtuVixRQUFMLENBQWNvVixjQUFkLEdBQStCLENBQS9CLENBQUE7QUFFQSxZQUFBLElBQUEsQ0FBS3BWLFFBQUwsQ0FBY3FWLGFBQWQsQ0FBNEIsS0FBSzFTLE1BQWpDLEVBQXlDcVIsR0FBekMsRUFBOENBLEdBQUcsQ0FBQ2pQLE1BQWxELEVBQTBEbU4sVUFBMUQsRUFBc0VvRCxpQkFBdEUsQ0FBQSxDQUFBO0FBRUF6VixZQUFBQSxNQUFNLENBQUMwVixTQUFQLEVBQUEsQ0FBQTtBQUdBLFlBQUEsSUFBQSxDQUFLelUsS0FBTCxDQUFXTSxhQUFYLElBQTRCLElBQUtwQixDQUFBQSxRQUFMLENBQWNvVixjQUExQyxDQUFBO0FBQ0EsWUFBQSxJQUFBLENBQUt0VSxLQUFMLENBQVdJLFdBQVgsSUFBMEIsSUFBS2xCLENBQUFBLFFBQUwsQ0FBY21WLFlBQXhDLENBQUE7WUFDQSxJQUFLclUsQ0FBQUEsS0FBTCxDQUFXQyxZQUFYLEVBQUEsQ0FBQTtBQUlBK00sWUFBQUEsUUFBUSxDQUFDbE4sYUFBVCxDQUF1QnFFLElBQXZCLElBQStCb08sTUFBL0IsQ0FBQTtBQUdBLFlBQUEsSUFBQSxDQUFLelMsYUFBTCxDQUFtQmtDLEdBQW5CLENBQXVCcUksWUFBdkIsRUFBcUNnSSxNQUFyQyxDQUFBLENBQUE7O0FBRUEsWUFBQSxLQUFLeEosQ0FBQyxHQUFHLENBQVQsRUFBWUEsQ0FBQyxHQUFHcUssR0FBRyxDQUFDalAsTUFBcEIsRUFBNEI0RSxDQUFDLEVBQTdCLEVBQWlDO0FBQzdCa0csY0FBQUEsQ0FBQyxHQUFHbUUsR0FBRyxDQUFDckssQ0FBRCxDQUFQLENBQUE7Y0FDQWtHLENBQUMsQ0FBQzNELG1CQUFGLENBQXNCQyxZQUFZLENBQUNDLGtCQUFiLENBQWdDbkgsSUFBaEMsQ0FBdEIsRUFBNkRxTyxPQUE3RCxDQUFBLENBQUE7Y0FDQXpELENBQUMsQ0FBQ2hFLFdBQUYsSUFBaUIwQixZQUFqQixDQUFBO0FBQ0gsYUFBQTs7WUFFREgsYUFBYSxDQUFDTyxZQUFkLENBQTJCOU4sTUFBM0IsQ0FBQSxDQUFBO0FBQ0gsV0FBQTs7VUFHRCxJQUFLb1EsQ0FBQUEsZ0JBQUwsQ0FBc0IrRCxHQUF0QixDQUFBLENBQUE7QUFDSCxTQUFBOztBQUVEdEYsUUFBQUEsU0FBUyxDQUFDOEcsT0FBVixDQUFrQixJQUFBLENBQUt0VixjQUF2QixDQUFBLENBQUE7UUFFQWtOLGFBQWEsQ0FBQ08sWUFBZCxDQUEyQjlOLE1BQTNCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsSUFBQSxDQUFLNlMsbUJBQUwsQ0FBeUI3UyxNQUF6QixFQUFpQzRFLFNBQWpDLEVBQTRDcUMsU0FBNUMsQ0FBQSxDQUFBOztBQUdBLElBQUEsS0FBS3hELElBQUksR0FBRyxDQUFaLEVBQWVBLElBQUksR0FBR3lFLFFBQVEsQ0FBQ2hELE1BQS9CLEVBQXVDekIsSUFBSSxFQUEzQyxFQUErQztBQUMzQ3lFLE1BQUFBLFFBQVEsQ0FBQ3pFLElBQUQsQ0FBUixDQUFlOEwsT0FBZixFQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUtELENBQUFBLGFBQUwsQ0FBbUJmLFNBQW5CLENBQUEsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLc0IsWUFBTCxFQUFBLENBQUE7O0lBSUEsSUFBSSxDQUFDbE0sd0JBQUwsRUFBK0I7TUFDM0IsSUFBS3RELENBQUFBLGNBQUwsQ0FBb0I0RSxLQUFwQixFQUFBLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFyakNhOzs7OyJ9
