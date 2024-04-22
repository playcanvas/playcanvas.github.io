import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { math } from '../core/math/math.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, CULLFACE_NONE } from '../platform/graphics/constants.js';
import { http } from '../platform/net/http.js';
import { LAYERID_WORLD, LAYERID_DEPTH, SORTMODE_NONE, LAYERID_SKYBOX, LAYERID_UI, SORTMODE_MANUAL, LAYERID_IMMEDIATE, SPECULAR_BLINN } from '../scene/constants.js';
import { setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { FrameGraph } from '../scene/frame-graph.js';
import { AreaLightLuts } from '../scene/area-light-luts.js';
import { Layer } from '../scene/layer.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { Scene } from '../scene/scene.js';
import { Material } from '../scene/materials/material.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { setDefaultMaterial } from '../scene/materials/default-material.js';
import { Asset } from './asset/asset.js';
import { AssetRegistry } from './asset/asset-registry.js';
import { BundleRegistry } from './bundle/bundle-registry.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { BundleHandler } from './handlers/bundle.js';
import { ResourceLoader } from './handlers/loader.js';
import { I18n } from './i18n/i18n.js';
import { ScriptRegistry } from './script/script-registry.js';
import { Entity } from './entity.js';
import { SceneRegistry } from './scene-registry.js';
import { script } from './script.js';
import { ApplicationStats } from './stats.js';
import { FILLMODE_KEEP_ASPECT, RESOLUTION_FIXED, RESOLUTION_AUTO, FILLMODE_FILL_WINDOW } from './constants.js';
import { setApplication, getApplication } from './globals.js';

class Progress {
  constructor(length) {
    this.length = length;
    this.count = 0;
  }
  inc() {
    this.count++;
  }
  done() {
    return this.count === this.length;
  }
}
let app = null;
class AppBase extends EventHandler {
  constructor(canvas) {
    super();
    this.frameRequestId = void 0;
    AppBase._applications[canvas.id] = this;
    setApplication(this);
    app = this;
    this._destroyRequested = false;
    this._inFrameUpdate = false;
    this._time = 0;
    this.timeScale = 1;
    this.maxDeltaTime = 0.1;
    this.frame = 0;
    this.autoRender = true;
    this.renderNextFrame = false;
    this.useLegacyScriptAttributeCloning = script.legacy;
    this._librariesLoaded = false;
    this._fillMode = FILLMODE_KEEP_ASPECT;
    this._resolutionMode = RESOLUTION_FIXED;
    this._allowResize = true;
    this.context = this;
  }
  init(appOptions) {
    const device = appOptions.graphicsDevice;
    this.graphicsDevice = device;
    this._initDefaultMaterial();
    this._initProgramLibrary();
    this.stats = new ApplicationStats(device);
    this._soundManager = appOptions.soundManager;
    this.loader = new ResourceLoader(this);
    this._entityIndex = {};
    this.scene = new Scene(device);
    this._registerSceneImmediate(this.scene);
    this.root = new Entity();
    this.root._enabledInHierarchy = true;
    this.assets = new AssetRegistry(this.loader);
    if (appOptions.assetPrefix) this.assets.prefix = appOptions.assetPrefix;
    this.bundles = new BundleRegistry(this.assets);
    this.enableBundles = typeof TextDecoder !== 'undefined';
    this.scriptsOrder = appOptions.scriptsOrder || [];
    this.scripts = new ScriptRegistry(this);
    this.i18n = new I18n(this);
    this.scenes = new SceneRegistry(this);
    this.defaultLayerWorld = new Layer({
      name: "World",
      id: LAYERID_WORLD
    });
    this.defaultLayerDepth = new Layer({
      name: "Depth",
      id: LAYERID_DEPTH,
      enabled: false,
      opaqueSortMode: SORTMODE_NONE
    });
    this.defaultLayerSkybox = new Layer({
      name: "Skybox",
      id: LAYERID_SKYBOX,
      opaqueSortMode: SORTMODE_NONE
    });
    this.defaultLayerUi = new Layer({
      name: "UI",
      id: LAYERID_UI,
      transparentSortMode: SORTMODE_MANUAL
    });
    this.defaultLayerImmediate = new Layer({
      name: "Immediate",
      id: LAYERID_IMMEDIATE,
      opaqueSortMode: SORTMODE_NONE
    });
    const defaultLayerComposition = new LayerComposition("default");
    defaultLayerComposition.pushOpaque(this.defaultLayerWorld);
    defaultLayerComposition.pushOpaque(this.defaultLayerDepth);
    defaultLayerComposition.pushOpaque(this.defaultLayerSkybox);
    defaultLayerComposition.pushTransparent(this.defaultLayerWorld);
    defaultLayerComposition.pushOpaque(this.defaultLayerImmediate);
    defaultLayerComposition.pushTransparent(this.defaultLayerImmediate);
    defaultLayerComposition.pushTransparent(this.defaultLayerUi);
    this.scene.layers = defaultLayerComposition;
    AreaLightLuts.createPlaceholder(device);
    this.renderer = new ForwardRenderer(device);
    this.renderer.scene = this.scene;
    this.frameGraph = new FrameGraph();
    this.lightmapper = null;
    if (appOptions.lightmapper) {
      this.lightmapper = new appOptions.lightmapper(device, this.root, this.scene, this.renderer, this.assets);
      this.once('prerender', this._firstBake, this);
    }
    this._batcher = null;
    if (appOptions.batchManager) {
      this._batcher = new appOptions.batchManager(device, this.root, this.scene);
      this.once('prerender', this._firstBatch, this);
    }
    this.keyboard = appOptions.keyboard || null;
    this.mouse = appOptions.mouse || null;
    this.touch = appOptions.touch || null;
    this.gamepads = appOptions.gamepads || null;
    this.elementInput = appOptions.elementInput || null;
    if (this.elementInput) this.elementInput.app = this;
    this.xr = appOptions.xr ? new appOptions.xr(this) : null;
    if (this.elementInput) this.elementInput.attachSelectEvents();
    this._inTools = false;
    this._skyboxAsset = null;
    this._scriptPrefix = appOptions.scriptPrefix || '';
    if (this.enableBundles) {
      this.loader.addHandler("bundle", new BundleHandler(this));
    }
    appOptions.resourceHandlers.forEach(resourceHandler => {
      const handler = new resourceHandler(this);
      this.loader.addHandler(handler.handlerType, handler);
    });
    this.systems = new ComponentSystemRegistry();
    appOptions.componentSystems.forEach(componentSystem => {
      this.systems.add(new componentSystem(this));
    });
    this._visibilityChangeHandler = this.onVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      if (document.hidden !== undefined) {
        this._hiddenAttr = 'hidden';
        document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
      } else if (document.mozHidden !== undefined) {
        this._hiddenAttr = 'mozHidden';
        document.addEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
      } else if (document.msHidden !== undefined) {
        this._hiddenAttr = 'msHidden';
        document.addEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
      } else if (document.webkitHidden !== undefined) {
        this._hiddenAttr = 'webkitHidden';
        document.addEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
      }
    }
    this.tick = makeTick(this);
  }
  static getApplication(id) {
    return id ? AppBase._applications[id] : getApplication();
  }
  _initDefaultMaterial() {
    const material = new StandardMaterial();
    material.name = "Default Material";
    material.shadingModel = SPECULAR_BLINN;
    setDefaultMaterial(this.graphicsDevice, material);
  }
  _initProgramLibrary() {
    const library = new ProgramLibrary(this.graphicsDevice, new StandardMaterial());
    setProgramLibrary(this.graphicsDevice, library);
  }
  get soundManager() {
    return this._soundManager;
  }
  get batcher() {
    return this._batcher;
  }
  get fillMode() {
    return this._fillMode;
  }
  get resolutionMode() {
    return this._resolutionMode;
  }
  configure(url, callback) {
    http.get(url, (err, response) => {
      if (err) {
        callback(err);
        return;
      }
      const props = response.application_properties;
      const scenes = response.scenes;
      const assets = response.assets;
      this._parseApplicationProperties(props, err => {
        this._parseScenes(scenes);
        this._parseAssets(assets);
        if (!err) {
          callback(null);
        } else {
          callback(err);
        }
      });
    });
  }
  preload(callback) {
    this.fire("preload:start");
    const assets = this.assets.list({
      preload: true
    });
    const progress = new Progress(assets.length);
    let _done = false;
    const done = () => {
      if (!this.graphicsDevice) {
        return;
      }
      if (!_done && progress.done()) {
        _done = true;
        this.fire("preload:end");
        callback();
      }
    };
    const total = assets.length;
    if (progress.length) {
      const onAssetLoad = asset => {
        progress.inc();
        this.fire('preload:progress', progress.count / total);
        if (progress.done()) done();
      };
      const onAssetError = (err, asset) => {
        progress.inc();
        this.fire('preload:progress', progress.count / total);
        if (progress.done()) done();
      };
      for (let i = 0; i < assets.length; i++) {
        if (!assets[i].loaded) {
          assets[i].once('load', onAssetLoad);
          assets[i].once('error', onAssetError);
          this.assets.load(assets[i]);
        } else {
          progress.inc();
          this.fire("preload:progress", progress.count / total);
          if (progress.done()) done();
        }
      }
    } else {
      done();
    }
  }
  _preloadScripts(sceneData, callback) {
    if (!script.legacy) {
      callback();
      return;
    }
    this.systems.script.preloading = true;
    const scripts = this._getScriptReferences(sceneData);
    const l = scripts.length;
    const progress = new Progress(l);
    const regex = /^http(s)?:\/\//;
    if (l) {
      const onLoad = (err, ScriptType) => {
        if (err) console.error(err);
        progress.inc();
        if (progress.done()) {
          this.systems.script.preloading = false;
          callback();
        }
      };
      for (let i = 0; i < l; i++) {
        let scriptUrl = scripts[i];
        if (!regex.test(scriptUrl.toLowerCase()) && this._scriptPrefix) scriptUrl = path.join(this._scriptPrefix, scripts[i]);
        this.loader.load(scriptUrl, 'script', onLoad);
      }
    } else {
      this.systems.script.preloading = false;
      callback();
    }
  }
  _parseApplicationProperties(props, callback) {
    if (typeof props.maxAssetRetries === 'number' && props.maxAssetRetries > 0) {
      this.loader.enableRetry(props.maxAssetRetries);
    }
    if (!props.useDevicePixelRatio) props.useDevicePixelRatio = props.use_device_pixel_ratio;
    if (!props.resolutionMode) props.resolutionMode = props.resolution_mode;
    if (!props.fillMode) props.fillMode = props.fill_mode;
    this._width = props.width;
    this._height = props.height;
    if (props.useDevicePixelRatio) {
      this.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
    }
    this.setCanvasResolution(props.resolutionMode, this._width, this._height);
    this.setCanvasFillMode(props.fillMode, this._width, this._height);
    if (props.layers && props.layerOrder) {
      const composition = new LayerComposition("application");
      const layers = {};
      for (const key in props.layers) {
        const data = props.layers[key];
        data.id = parseInt(key, 10);
        data.enabled = data.id !== LAYERID_DEPTH;
        layers[key] = new Layer(data);
      }
      for (let i = 0, len = props.layerOrder.length; i < len; i++) {
        const sublayer = props.layerOrder[i];
        const layer = layers[sublayer.layer];
        if (!layer) continue;
        if (sublayer.transparent) {
          composition.pushTransparent(layer);
        } else {
          composition.pushOpaque(layer);
        }
        composition.subLayerEnabled[i] = sublayer.enabled;
      }
      this.scene.layers = composition;
    }
    if (props.batchGroups) {
      const batcher = this.batcher;
      if (batcher) {
        for (let i = 0, len = props.batchGroups.length; i < len; i++) {
          const grp = props.batchGroups[i];
          batcher.addGroup(grp.name, grp.dynamic, grp.maxAabbSize, grp.id, grp.layers);
        }
      }
    }
    if (props.i18nAssets) {
      this.i18n.assets = props.i18nAssets;
    }
    this._loadLibraries(props.libraries, callback);
  }
  _loadLibraries(urls, callback) {
    const len = urls.length;
    let count = len;
    const regex = /^http(s)?:\/\//;
    if (len) {
      const onLoad = (err, script) => {
        count--;
        if (err) {
          callback(err);
        } else if (count === 0) {
          this.onLibrariesLoaded();
          callback(null);
        }
      };
      for (let i = 0; i < len; ++i) {
        let url = urls[i];
        if (!regex.test(url.toLowerCase()) && this._scriptPrefix) url = path.join(this._scriptPrefix, url);
        this.loader.load(url, 'script', onLoad);
      }
    } else {
      this.onLibrariesLoaded();
      callback(null);
    }
  }
  _parseScenes(scenes) {
    if (!scenes) return;
    for (let i = 0; i < scenes.length; i++) {
      this.scenes.add(scenes[i].name, scenes[i].url);
    }
  }
  _parseAssets(assets) {
    const list = [];
    const scriptsIndex = {};
    const bundlesIndex = {};
    if (!script.legacy) {
      for (let i = 0; i < this.scriptsOrder.length; i++) {
        const id = this.scriptsOrder[i];
        if (!assets[id]) continue;
        scriptsIndex[id] = true;
        list.push(assets[id]);
      }
      if (this.enableBundles) {
        for (const id in assets) {
          if (assets[id].type === 'bundle') {
            bundlesIndex[id] = true;
            list.push(assets[id]);
          }
        }
      }
      for (const id in assets) {
        if (scriptsIndex[id] || bundlesIndex[id]) continue;
        list.push(assets[id]);
      }
    } else {
      if (this.enableBundles) {
        for (const id in assets) {
          if (assets[id].type === 'bundle') {
            bundlesIndex[id] = true;
            list.push(assets[id]);
          }
        }
      }
      for (const id in assets) {
        if (bundlesIndex[id]) continue;
        list.push(assets[id]);
      }
    }
    for (let i = 0; i < list.length; i++) {
      const data = list[i];
      const asset = new Asset(data.name, data.type, data.file, data.data);
      asset.id = parseInt(data.id, 10);
      asset.preload = data.preload ? data.preload : false;
      asset.loaded = data.type === 'script' && data.data && data.data.loadingType > 0;
      asset.tags.add(data.tags);
      if (data.i18n) {
        for (const locale in data.i18n) {
          asset.addLocalizedAssetId(locale, data.i18n[locale]);
        }
      }
      this.assets.add(asset);
    }
  }
  _getScriptReferences(scene) {
    let priorityScripts = [];
    if (scene.settings.priority_scripts) {
      priorityScripts = scene.settings.priority_scripts;
    }
    const _scripts = [];
    const _index = {};
    for (let i = 0; i < priorityScripts.length; i++) {
      _scripts.push(priorityScripts[i]);
      _index[priorityScripts[i]] = true;
    }
    const entities = scene.entities;
    for (const key in entities) {
      if (!entities[key].components.script) {
        continue;
      }
      const scripts = entities[key].components.script.scripts;
      for (let i = 0; i < scripts.length; i++) {
        if (_index[scripts[i].url]) continue;
        _scripts.push(scripts[i].url);
        _index[scripts[i].url] = true;
      }
    }
    return _scripts;
  }
  start() {
    this.frame = 0;
    this.fire("start", {
      timestamp: now(),
      target: this
    });
    if (!this._librariesLoaded) {
      this.onLibrariesLoaded();
    }
    this.systems.fire('initialize', this.root);
    this.fire('initialize');
    this.systems.fire('postInitialize', this.root);
    this.systems.fire('postPostInitialize', this.root);
    this.fire('postinitialize');
    this.tick();
  }
  inputUpdate(dt) {
    if (this.controller) {
      this.controller.update(dt);
    }
    if (this.mouse) {
      this.mouse.update();
    }
    if (this.keyboard) {
      this.keyboard.update();
    }
    if (this.gamepads) {
      this.gamepads.update();
    }
  }
  update(dt) {
    this.frame++;
    this.graphicsDevice.updateClientRect();
    this.stats.frame.updateStart = now();
    if (script.legacy) this.systems.fire('fixedUpdate', 1.0 / 60.0);
    this.systems.fire(this._inTools ? 'toolsUpdate' : 'update', dt);
    this.systems.fire('animationUpdate', dt);
    this.systems.fire('postUpdate', dt);
    this.fire("update", dt);
    this.inputUpdate(dt);
    this.stats.frame.updateTime = now() - this.stats.frame.updateStart;
  }
  frameStart() {
    this.graphicsDevice.frameStart();
  }
  frameEnd() {
    this.graphicsDevice.frameEnd();
  }
  render() {
    this.stats.frame.renderStart = now();
    this.fire('prerender');
    this.root.syncHierarchy();
    if (this._batcher) {
      this._batcher.updateAll();
    }
    ForwardRenderer._skipRenderCounter = 0;
    this.renderComposition(this.scene.layers);
    this.fire('postrender');
    this.stats.frame.renderTime = now() - this.stats.frame.renderStart;
  }
  renderComposition(layerComposition) {
    this.renderer.buildFrameGraph(this.frameGraph, layerComposition);
    this.frameGraph.render(this.graphicsDevice);
  }
  _fillFrameStatsBasic(now, dt, ms) {
    const stats = this.stats.frame;
    stats.dt = dt;
    stats.ms = ms;
    if (now > stats._timeToCountFrames) {
      stats.fps = stats._fpsAccum;
      stats._fpsAccum = 0;
      stats._timeToCountFrames = now + 1000;
    } else {
      stats._fpsAccum++;
    }
    this.stats.drawCalls.total = this.graphicsDevice._drawCallsPerFrame;
    this.graphicsDevice._drawCallsPerFrame = 0;
  }
  _fillFrameStats() {
    let stats = this.stats.frame;
    stats.cameras = this.renderer._camerasRendered;
    stats.materials = this.renderer._materialSwitches;
    stats.shaders = this.graphicsDevice._shaderSwitchesPerFrame;
    stats.shadowMapUpdates = this.renderer._shadowMapUpdates;
    stats.shadowMapTime = this.renderer._shadowMapTime;
    stats.depthMapTime = this.renderer._depthMapTime;
    stats.forwardTime = this.renderer._forwardTime;
    const prims = this.graphicsDevice._primsPerFrame;
    stats.triangles = prims[PRIMITIVE_TRIANGLES] / 3 + Math.max(prims[PRIMITIVE_TRISTRIP] - 2, 0) + Math.max(prims[PRIMITIVE_TRIFAN] - 2, 0);
    stats.cullTime = this.renderer._cullTime;
    stats.sortTime = this.renderer._sortTime;
    stats.skinTime = this.renderer._skinTime;
    stats.morphTime = this.renderer._morphTime;
    stats.lightClusters = this.renderer._lightClusters;
    stats.lightClustersTime = this.renderer._lightClustersTime;
    stats.otherPrimitives = 0;
    for (let i = 0; i < prims.length; i++) {
      if (i < PRIMITIVE_TRIANGLES) {
        stats.otherPrimitives += prims[i];
      }
      prims[i] = 0;
    }
    this.renderer._camerasRendered = 0;
    this.renderer._materialSwitches = 0;
    this.renderer._shadowMapUpdates = 0;
    this.graphicsDevice._shaderSwitchesPerFrame = 0;
    this.renderer._cullTime = 0;
    this.renderer._layerCompositionUpdateTime = 0;
    this.renderer._lightClustersTime = 0;
    this.renderer._sortTime = 0;
    this.renderer._skinTime = 0;
    this.renderer._morphTime = 0;
    this.renderer._shadowMapTime = 0;
    this.renderer._depthMapTime = 0;
    this.renderer._forwardTime = 0;
    stats = this.stats.drawCalls;
    stats.forward = this.renderer._forwardDrawCalls;
    stats.culled = this.renderer._numDrawCallsCulled;
    stats.depth = 0;
    stats.shadow = this.renderer._shadowDrawCalls;
    stats.skinned = this.renderer._skinDrawCalls;
    stats.immediate = 0;
    stats.instanced = 0;
    stats.removedByInstancing = 0;
    stats.misc = stats.total - (stats.forward + stats.shadow);
    this.renderer._depthDrawCalls = 0;
    this.renderer._shadowDrawCalls = 0;
    this.renderer._forwardDrawCalls = 0;
    this.renderer._numDrawCallsCulled = 0;
    this.renderer._skinDrawCalls = 0;
    this.renderer._immediateRendered = 0;
    this.renderer._instancedDrawCalls = 0;
    this.stats.misc.renderTargetCreationTime = this.graphicsDevice.renderTargetCreationTime;
    stats = this.stats.particles;
    stats.updatesPerFrame = stats._updatesPerFrame;
    stats.frameTime = stats._frameTime;
    stats._updatesPerFrame = 0;
    stats._frameTime = 0;
  }
  setCanvasFillMode(mode, width, height) {
    this._fillMode = mode;
    this.resizeCanvas(width, height);
  }
  setCanvasResolution(mode, width, height) {
    this._resolutionMode = mode;
    if (mode === RESOLUTION_AUTO && width === undefined) {
      width = this.graphicsDevice.canvas.clientWidth;
      height = this.graphicsDevice.canvas.clientHeight;
    }
    this.graphicsDevice.resizeCanvas(width, height);
  }
  isHidden() {
    return document[this._hiddenAttr];
  }
  onVisibilityChange() {
    if (this.isHidden()) {
      if (this._soundManager) {
        this._soundManager.suspend();
      }
    } else {
      if (this._soundManager) {
        this._soundManager.resume();
      }
    }
  }
  resizeCanvas(width, height) {
    if (!this._allowResize) return undefined;
    if (this.xr && this.xr.session) return undefined;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    if (this._fillMode === FILLMODE_KEEP_ASPECT) {
      const r = this.graphicsDevice.canvas.width / this.graphicsDevice.canvas.height;
      const winR = windowWidth / windowHeight;
      if (r > winR) {
        width = windowWidth;
        height = width / r;
      } else {
        height = windowHeight;
        width = height * r;
      }
    } else if (this._fillMode === FILLMODE_FILL_WINDOW) {
      width = windowWidth;
      height = windowHeight;
    }
    this.graphicsDevice.canvas.style.width = width + 'px';
    this.graphicsDevice.canvas.style.height = height + 'px';
    this.updateCanvasSize();
    return {
      width: width,
      height: height
    };
  }
  updateCanvasSize() {
    var _this$xr;
    if (!this._allowResize || (_this$xr = this.xr) != null && _this$xr.active) {
      return;
    }
    if (this._resolutionMode === RESOLUTION_AUTO) {
      const canvas = this.graphicsDevice.canvas;
      this.graphicsDevice.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
    }
  }
  onLibrariesLoaded() {
    this._librariesLoaded = true;
    if (this.systems.rigidbody) {
      this.systems.rigidbody.onLibraryLoaded();
    }
  }
  applySceneSettings(settings) {
    let asset;
    if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
      const gravity = settings.physics.gravity;
      this.systems.rigidbody.gravity.set(gravity[0], gravity[1], gravity[2]);
    }
    this.scene.applySettings(settings);
    if (settings.render.hasOwnProperty('skybox')) {
      if (settings.render.skybox) {
        asset = this.assets.get(settings.render.skybox);
        if (asset) {
          this.setSkybox(asset);
        } else {
          this.assets.once('add:' + settings.render.skybox, this.setSkybox, this);
        }
      } else {
        this.setSkybox(null);
      }
    }
  }
  setAreaLightLuts(ltcMat1, ltcMat2) {
    if (ltcMat1 && ltcMat2) {
      AreaLightLuts.set(this.graphicsDevice, ltcMat1, ltcMat2);
    }
  }
  setSkybox(asset) {
    if (asset !== this._skyboxAsset) {
      const onSkyboxRemoved = () => {
        this.setSkybox(null);
      };
      const onSkyboxChanged = () => {
        this.scene.setSkybox(this._skyboxAsset ? this._skyboxAsset.resources : null);
      };
      if (this._skyboxAsset) {
        this.assets.off('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
        this.assets.off('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
        this._skyboxAsset.off('change', onSkyboxChanged, this);
      }
      this._skyboxAsset = asset;
      if (this._skyboxAsset) {
        this.assets.on('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
        this.assets.once('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
        this._skyboxAsset.on('change', onSkyboxChanged, this);
        if (this.scene.skyboxMip === 0 && !this._skyboxAsset.loadFaces) {
          this._skyboxAsset.loadFaces = true;
        }
        this.assets.load(this._skyboxAsset);
      }
      onSkyboxChanged();
    }
  }
  _firstBake() {
    var _this$lightmapper;
    (_this$lightmapper = this.lightmapper) == null || _this$lightmapper.bake(null, this.scene.lightmapMode);
  }
  _firstBatch() {
    var _this$batcher;
    (_this$batcher = this.batcher) == null || _this$batcher.generate();
  }
  _processTimestamp(timestamp) {
    return timestamp;
  }
  drawLine(start, end, color, depthTest, layer) {
    this.scene.drawLine(start, end, color, depthTest, layer);
  }
  drawLines(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.drawLines(positions, colors, depthTest, layer);
  }
  drawLineArrays(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.drawLineArrays(positions, colors, depthTest, layer);
  }
  drawWireSphere(center, radius, color = Color.WHITE, segments = 20, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawWireSphere(center, radius, color, segments, depthTest, layer);
  }
  drawWireAlignedBox(minPoint, maxPoint, color = Color.WHITE, depthTest = true, layer = this.scene.defaultDrawLayer, mat) {
    this.scene.immediate.drawWireAlignedBox(minPoint, maxPoint, color, depthTest, layer, mat);
  }
  drawMeshInstance(meshInstance, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
  }
  drawMesh(mesh, material, matrix, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
  }
  drawQuad(matrix, material, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(material, matrix, this.scene.immediate.getQuadMesh(), null, layer);
  }
  drawTexture(x, y, width, height, texture, material, layer = this.scene.defaultDrawLayer, filterable = true) {
    if (filterable === false && !this.graphicsDevice.isWebGPU) return;
    const matrix = new Mat4();
    matrix.setTRS(new Vec3(x, y, 0.0), Quat.IDENTITY, new Vec3(width, -height, 0.0));
    if (!material) {
      material = new Material();
      material.cull = CULLFACE_NONE;
      material.setParameter("colorMap", texture);
      material.shader = filterable ? this.scene.immediate.getTextureShader() : this.scene.immediate.getUnfilterableTextureShader();
      material.update();
    }
    this.drawQuad(matrix, material, layer);
  }
  drawDepthTexture(x, y, width, height, layer = this.scene.defaultDrawLayer) {
    const material = new Material();
    material.cull = CULLFACE_NONE;
    material.shader = this.scene.immediate.getDepthTextureShader();
    material.update();
    this.drawTexture(x, y, width, height, null, material, layer);
  }
  destroy() {
    var _this$lightmapper2, _this$xr2, _this$xr3, _this$_soundManager;
    if (this._inFrameUpdate) {
      this._destroyRequested = true;
      return;
    }
    const canvasId = this.graphicsDevice.canvas.id;
    this.fire('destroy', this);
    this.off('librariesloaded');
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
      document.removeEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
      document.removeEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
      document.removeEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
    }
    this._visibilityChangeHandler = null;
    this.root.destroy();
    this.root = null;
    if (this.mouse) {
      this.mouse.off();
      this.mouse.detach();
      this.mouse = null;
    }
    if (this.keyboard) {
      this.keyboard.off();
      this.keyboard.detach();
      this.keyboard = null;
    }
    if (this.touch) {
      this.touch.off();
      this.touch.detach();
      this.touch = null;
    }
    if (this.elementInput) {
      this.elementInput.detach();
      this.elementInput = null;
    }
    if (this.gamepads) {
      this.gamepads.destroy();
      this.gamepads = null;
    }
    if (this.controller) {
      this.controller = null;
    }
    this.systems.destroy();
    if (this.scene.layers) {
      this.scene.layers.destroy();
    }
    const assets = this.assets.list();
    for (let i = 0; i < assets.length; i++) {
      assets[i].unload();
      assets[i].off();
    }
    this.assets.off();
    this.bundles.destroy();
    this.bundles = null;
    this.i18n.destroy();
    this.i18n = null;
    const scriptHandler = this.loader.getHandler('script');
    scriptHandler == null || scriptHandler.clearCache();
    this.loader.destroy();
    this.loader = null;
    this.scene.destroy();
    this.scene = null;
    this.systems = null;
    this.context = null;
    this.scripts.destroy();
    this.scripts = null;
    this.scenes.destroy();
    this.scenes = null;
    (_this$lightmapper2 = this.lightmapper) == null || _this$lightmapper2.destroy();
    this.lightmapper = null;
    if (this._batcher) {
      this._batcher.destroy();
      this._batcher = null;
    }
    this._entityIndex = {};
    this.defaultLayerDepth.onPreRenderOpaque = null;
    this.defaultLayerDepth.onPostRenderOpaque = null;
    this.defaultLayerDepth.onDisable = null;
    this.defaultLayerDepth.onEnable = null;
    this.defaultLayerDepth = null;
    this.defaultLayerWorld = null;
    (_this$xr2 = this.xr) == null || _this$xr2.end();
    (_this$xr3 = this.xr) == null || _this$xr3.destroy();
    this.renderer.destroy();
    this.renderer = null;
    this.graphicsDevice.destroy();
    this.graphicsDevice = null;
    this.tick = null;
    this.off();
    (_this$_soundManager = this._soundManager) == null || _this$_soundManager.destroy();
    this._soundManager = null;
    script.app = null;
    AppBase._applications[canvasId] = null;
    if (getApplication() === this) {
      setApplication(null);
    }
    AppBase.cancelTick(this);
  }
  static cancelTick(app) {
    if (app.frameRequestId) {
      window.cancelAnimationFrame(app.frameRequestId);
      app.frameRequestId = undefined;
    }
  }
  getEntityFromIndex(guid) {
    return this._entityIndex[guid];
  }
  _registerSceneImmediate(scene) {
    this.on('postrender', scene.immediate.onPostRender, scene.immediate);
  }
}
AppBase._applications = {};
const _frameEndData = {};
const makeTick = function makeTick(_app) {
  const application = _app;
  return function (timestamp, frame) {
    var _application$xr2;
    if (!application.graphicsDevice) return;
    if (application.frameRequestId) {
      var _application$xr;
      (_application$xr = application.xr) == null || (_application$xr = _application$xr.session) == null || _application$xr.cancelAnimationFrame(application.frameRequestId);
      cancelAnimationFrame(application.frameRequestId);
      application.frameRequestId = null;
    }
    application._inFrameUpdate = true;
    setApplication(application);
    app = application;
    const currentTime = application._processTimestamp(timestamp) || now();
    const ms = currentTime - (application._time || currentTime);
    let dt = ms / 1000.0;
    dt = math.clamp(dt, 0, application.maxDeltaTime);
    dt *= application.timeScale;
    application._time = currentTime;
    if ((_application$xr2 = application.xr) != null && _application$xr2.session) {
      application.frameRequestId = application.xr.session.requestAnimationFrame(application.tick);
    } else {
      application.frameRequestId = platform.browser ? window.requestAnimationFrame(application.tick) : null;
    }
    if (application.graphicsDevice.contextLost) return;
    application._fillFrameStatsBasic(currentTime, dt, ms);
    application._fillFrameStats();
    application.fire("frameupdate", ms);
    let shouldRenderFrame = true;
    if (frame) {
      var _application$xr3;
      shouldRenderFrame = (_application$xr3 = application.xr) == null ? void 0 : _application$xr3.update(frame);
      application.graphicsDevice.defaultFramebuffer = frame.session.renderState.baseLayer.framebuffer;
    } else {
      application.graphicsDevice.defaultFramebuffer = null;
    }
    if (shouldRenderFrame) {
      application.update(dt);
      application.fire("framerender");
      if (application.autoRender || application.renderNextFrame) {
        application.updateCanvasSize();
        application.frameStart();
        application.render();
        application.frameEnd();
        application.renderNextFrame = false;
      }
      _frameEndData.timestamp = now();
      _frameEndData.target = application;
      application.fire("frameend", _frameEndData);
    }
    application._inFrameUpdate = false;
    if (application._destroyRequested) {
      application.destroy();
    }
  };
};

export { AppBase, app };
